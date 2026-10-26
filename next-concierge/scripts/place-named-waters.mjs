#!/usr/bin/env node
/**
 * place-named-waters — give the expedition feed's unplaced cruising days a
 * representative position, so a voyage made of them has a route to trace.
 *
 *   node scripts/place-named-waters.mjs           write the anchors
 *   node scripts/place-named-waters.mjs --check   exit 1 if anything would change
 *
 * The ledger is data/atlas/shared/named-waters.json; its _meta says why it
 * exists and what it deliberately leaves out. In short: the feed places every
 * port and no open water, so an Ushuaia round trip of Drake Passage and
 * "Antarctica (Cruising)" days is a route from a place to itself.
 *
 * ── What gets written, and where ───────────────────────────────────────────
 *
 * A placed stop gains a FOURTH slot, the ledger key:
 *
 *     ["Drake Passage (Cruising)", null, null, "drake-passage"]
 *
 * and the document gains a top-level `waters` table, key -> {ll, label, r,
 * note}. lat/lng stay null on purpose. A dozen consumers read p[1]/p[2] as
 * "this is a port": the port filter, journey facts, gateway hotels, cruise
 * regions, the SEO pages. None of them should start counting the Drake Passage
 * as a port of call, and none of them have to change to keep it that way. Only
 * the route drawing (lib/atlas/adapters/cruise.ts, build-sea-routes, the
 * Leaflet atlas) reads the fourth slot.
 *
 * ── When an anchor is refused ──────────────────────────────────────────────
 *
 * A name is not a place on every voyage. "Northwest Passage" is a day between
 * Fury and Hecla Strait and Cambridge Bay on one sailing and a day between
 * Erik Cove and Fury and Hecla on the same sailing a week earlier. One point
 * fits the first and bends the second a thousand kilometres west. So each run
 * of unplaced stops is judged against the fixed points either side of it.
 *
 * Two kinds of anchor. A DESTINATION (the peninsula, the Falklands, Shetland,
 * a fjord) is somewhere the ship goes on purpose, so it is the detour and is
 * accepted as long as one of the voyage's real ports is within its `maxKm`;
 * that is what keeps the same name on a ship half a world away unplaced. A
 * PASSAGE (`passage: true`: the Drake, the Inside Passage, the Northwest
 * Passage) is water passed through on the way, and has to be on the way. For
 * each stretch of passages, P and Q are the nearest fixed points before and
 * after it, a real port or a destination:
 *
 *   P == Q (within LOOP_KM)   an out-and-back. Accepted.
 *   P != Q                    accepted when P -> passages -> Q is no longer
 *                             than DETOUR x the direct distance, plus SLACK_KM
 *                             so a short hop is not refused for rounding.
 *   only one of P, Q          the voyage starts or ends at sea. Accepted.
 *
 * Idempotent: every run strips the fourth slot first and decides again, so a
 * ledger edit or a feed refresh lands cleanly. npm run build:atlas runs it
 * straight after fix:ports and before build:sea-routes, which routes through
 * the anchors.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LEDGER = "data/atlas/shared/named-waters.json";
const ROUTES = "public/maps/cruise/data/itinerary-routes.json";

const LOOP_KM = 50;
const DETOUR = 1.6;
const SLACK_KM = 150;

const R_EARTH = 6371;
const rad = (d) => (d * Math.PI) / 180;
const km = (a, b) => {
  const s = Math.sin(rad(b[0] - a[0]) / 2) ** 2
    + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(s)));
};
const pathKm = (pts) => pts.slice(1).reduce((t, p, i) => t + km(pts[i], p), 0);

const check = process.argv.includes("--check");

const ledger = JSON.parse(readFileSync(join(ROOT, LEDGER), "utf8"));
const before = readFileSync(join(ROOT, ROUTES), "utf8");
const doc = JSON.parse(before);

const byName = new Map();
for (const w of ledger.waters || []) for (const n of w.names) byName.set(n, w);

const placed = new Map();   // key -> stops placed
const refused = new Map();  // key -> stops refused
const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1);
let traceableBefore = 0, traceableAfter = 0;

const distinct = (pts) => new Set(pts.map((p) => `${p[0]},${p[1]}`)).size > 1;

for (const days of Object.values(doc.routes || {})) {
  const stops = [];
  for (const day of days) {
    for (const p of day.p || []) {
      if (p.length > 3) p.length = 3;   // decide again from scratch
      stops.push(p);
    }
  }
  const real = stops.filter((p) => p[1] != null && p[2] != null).map((p) => [p[1], p[2]]);
  if (distinct(real)) traceableBefore++;

  // Runs of unplaced stops between placed ones.
  let i = 0;
  while (i < stops.length) {
    if (stops[i][1] != null) { i++; continue; }
    let j = i;
    while (j < stops.length && stops[j][1] == null) j++;
    const run = stops.slice(i, j);
    const A = i > 0 ? [stops[i - 1][1], stops[i - 1][2]] : null;
    const B = j < stops.length ? [stops[j][1], stops[j][2]] : null;
    i = j;

    const hits = [];
    for (const p of run) {
      const w = byName.get(p[0]);
      if (!w) continue;
      const nearest = real.length ? Math.min(...real.map((r) => km(r, w.ll))) : Infinity;
      if (nearest > w.maxKm) { bump(refused, w.key); continue; }
      hits.push({ p, w });
    }
    if (!hits.length) continue;

    // The path the map would draw: consecutive days at one anchor are one call.
    const via = [];
    for (const h of hits) {
      const last = via[via.length - 1];
      if (last && last.w === h.w) last.hits.push(h);
      else via.push({ w: h.w, hits: [h], ok: !h.w.passage });
    }
    // Destinations are fixed points; each stretch of passages between two
    // fixed points must lie on the way from one to the other.
    const fixed = (k) => (k < 0 ? A : k >= via.length ? B : via[k].w.ll);
    for (let k = 0; k < via.length; k++) {
      if (via[k].ok) continue;
      let e = k;
      while (e < via.length && !via[e].ok) e++;
      const P = fixed(k - 1), Q = fixed(e);
      const pts = via.slice(k, e).map((v) => v.w.ll);
      const ok = P && Q && km(P, Q) > LOOP_KM
        ? pathKm([P, ...pts, Q]) <= DETOUR * km(P, Q) + SLACK_KM
        : !!(P || Q);
      for (let m = k; m < e; m++) via[m].ok = ok;
      k = e - 1;
    }
    for (const v of via) {
      for (const h of v.hits) {
        if (v.ok) { h.p[3] = h.w.key; bump(placed, h.w.key); } else bump(refused, h.w.key);
      }
    }
  }

  const drawn = stops.map((p) => (p[1] != null ? [p[1], p[2]] : p[3] ? byName.get(p[0]).ll : null)).filter(Boolean);
  if (distinct(drawn)) traceableAfter++;
}

doc.waters = {};
for (const w of ledger.waters || []) {
  if (!placed.has(w.key)) continue;
  doc.waters[w.key] = { ll: w.ll, label: w.label, r: w.radiusKm || 0, ...(w.note ? { note: w.note } : {}) };
}

const after = JSON.stringify(doc);

console.log("");
console.log(check ? "named waters (check only)" : "named waters");
console.log("=".repeat(78));
for (const w of ledger.waters || []) {
  const n = placed.get(w.key) || 0, r = refused.get(w.key) || 0;
  console.log(`  ${w.label.padEnd(26)} ${String(n).padStart(5)} placed  ${r ? `${r} refused` : ""}`);
}
console.log("");
console.log(`  traceable sailings: ${traceableBefore} -> ${traceableAfter} of ${Object.keys(doc.routes || {}).length}`);
console.log("");

if (after === before) {
  console.log("  already applied");
  process.exit(0);
}
if (check) {
  console.error("named waters are not applied to the data — run: npm run place:waters");
  process.exit(1);
}
writeFileSync(join(ROOT, ROUTES), after);
console.log(`  wrote ${ROUTES}`);
