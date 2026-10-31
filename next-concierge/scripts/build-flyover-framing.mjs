/**
 * Survey every hotel once, and store how its photoreal views should frame it.
 *
 * lib/atlas/framing.ts turns what stands around a hotel into a camera — which
 * side is open, how steeply to look, how close to come. The browser can work
 * that out live (lib/atlas/surroundings.ts), but then every card that opens
 * waits on a volunteer-run OpenStreetMap server. So it is done here, ahead of
 * time, into data/atlas/hotel/flyover-framing.json, which the atlas arrival,
 * the hotel panel's Flyover and the /demo/hotel reel all read.
 *
 * Sources, one per kind of obstacle:
 *   buildings  OpenStreetMap through the public Overpass API, one query per
 *              hotel, spaced out as its usage policy asks.
 *   terrain    The open Terrarium elevation tiles on AWS (no key). The browser
 *              uses Google's elevation service instead, but the site's Maps
 *              key is restricted to its own pages and will not serve a build.
 *
 * Resumable and incremental: it surveys hotels with no framing first, then the
 * oldest, up to --limit per run, writes after every hotel, and stops early if
 * Overpass keeps refusing. Run it again and it carries on. The workflow in
 * .github/workflows/flyover-framing.yml does exactly that until every hotel
 * is done, and from then on re-surveys the oldest few each week.
 *
 *   node scripts/build-flyover-framing.mjs [--limit 300] [--ids h_1,h_2]
 *        [--stale-days 180] [--dry]
 *   OVERPASS_URL=… overrides the server (a mirror, or a fixture in testing).
 *
 * The geometry is the app's own (lib/atlas/surroundings-core.ts and
 * lib/atlas/framing.ts), imported directly — Node strips their types, and the
 * small resolver below lets their extensionless imports find each other — so
 * a framing built here is exactly what the browser would have worked out.
 */

import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { register } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inflateSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data/atlas/hotel/flyover-framing.json");
const HOTELS = join(ROOT, "data/atlas/hotel/luxury-hotels.json");

// The app's modules import each other without extensions, as a bundler allows.
register(
  "data:text/javascript," +
    encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (err) {
    if (/^\\.\\.?\\//.test(spec) && !/\\.[cm]?[jt]s$/.test(spec)) return next(spec + ".ts", ctx);
    throw err;
  }
}`),
);

const core = await import(pathToFileURL(join(ROOT, "lib/atlas/surroundings-core.ts")).href);
const { framingFromSurvey } = await import(pathToFileURL(join(ROOT, "lib/atlas/framing.ts")).href);

/* ── Arguments ─────────────────────────────────────────────────────────── */

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const LIMIT = Number(arg("limit", 300));
const STALE_DAYS = Number(arg("stale-days", 180));
const ONLY = arg("ids", "") ? new Set(arg("ids", "").split(",").map((s) => s.trim())) : null;
const DRY = args.includes("--dry");
const OVERPASS_URL = process.env.OVERPASS_URL || core.OVERPASS_URL;
/** Overpass asks for no more than about one request a second from one client. */
const OVERPASS_GAP_MS = Number(process.env.OVERPASS_GAP_MS ?? 1500);
/** Give up on the run (not the hotel) after this many refusals in a row. */
const MAX_STRIKES = 5;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── Terrain: Terrarium tiles ──────────────────────────────────────────── */

const TERRAIN_ZOOM = 14; // ~7–10 m a pixel: finer than the 80 m rings need
const tiles = new Map();

/** A minimal PNG decoder: 8-bit RGB/RGBA, non-interlaced — what Terrarium serves. */
function decodePng(buf) {
  let pos = 8;
  let width = 0, height = 0, channels = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const depth = data[8], color = data[9], interlace = data[12];
      if (depth !== 8 || interlace !== 0 || (color !== 2 && color !== 6)) throw new Error(`unsupported PNG (${depth}/${color}/${interlace})`);
      channels = color === 6 ? 4 : 3;
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[y * stride + x - channels] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + x] = v & 255;
    }
  }
  return { width, height, channels, data: out };
}

async function tile(z, x, y) {
  const key = `${z}/${x}/${y}`;
  if (!tiles.has(key)) {
    tiles.set(
      key,
      (async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const res = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${key}.png`);
            if (res.ok) return decodePng(Buffer.from(await res.arrayBuffer()));
          } catch {
            /* retried below */
          }
          await sleep(500 * (attempt + 1));
        }
        return null;
      })(),
    );
  }
  return tiles.get(key);
}

/** Elevation in metres at a point, or null if its tile would not load. */
async function elevation(lat, lng) {
  const n = 2 ** TERRAIN_ZOOM;
  const fx = ((lng + 180) / 360) * n;
  const φ = (lat * Math.PI) / 180;
  const fy = ((1 - Math.log(Math.tan(φ) + 1 / Math.cos(φ)) / Math.PI) / 2) * n;
  const t = await tile(TERRAIN_ZOOM, Math.floor(fx), Math.floor(fy));
  if (!t) return null;
  const px = Math.min(t.width - 1, Math.floor((fx % 1) * t.width));
  const py = Math.min(t.height - 1, Math.floor((fy % 1) * t.height));
  const i = (py * t.width + px) * t.channels;
  return t.data[i] * 256 + t.data[i + 1] + t.data[i + 2] / 256 - 32768;
}

/* ── Buildings: Overpass ───────────────────────────────────────────────── */

let lastOverpass = 0;
/** The footprints round a point; null when Overpass will not answer. */
async function footprints(lat, lng) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const wait = lastOverpass + OVERPASS_GAP_MS * (attempt + 1) ** 2 - Date.now();
    if (wait > 0) await sleep(wait);
    lastOverpass = Date.now();
    try {
      const res = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "expedition-bucket-list-flyover-framing/1 (+https://guide.expeditionbucketlist.com)",
        },
        body: new URLSearchParams({ data: core.overpassQuery(lat, lng) }),
        signal: AbortSignal.timeout(40000),
      });
      if (res.ok) return (await res.json()).elements ?? [];
      // 429 / 504: the server is busy, not the query wrong — back off and retry.
      if (res.status !== 429 && res.status < 500) return null;
    } catch {
      /* network or timeout: retried */
    }
  }
  return null;
}

/* ── The run ───────────────────────────────────────────────────────────── */

async function survey(h) {
  const ways = await footprints(h.lat, h.lng);
  if (!ways) return null;
  const ground = await elevation(h.lat, h.lng);
  const ring = core.terrainRing(h.lat, h.lng);
  const heights = ground == null ? null : await Promise.all(ring.map((p) => elevation(p.lat, p.lng)));
  const terrain =
    heights && heights.every((e) => e != null)
      ? ring.map((p, i) => ({ bearing: p.bearing, distance: p.distance, top: heights[i] - ground }))
      : [];
  const { buildings, hotelHeight } = core.buildingsFrom(ways, h.lat, h.lng);
  return { buildings, terrain, hotelHeight, sources: { buildings: true, terrain: terrain.length > 0 } };
}

/** One hotel a line, keys sorted: a re-survey diffs as the lines that moved. */
function serialise(file) {
  const ids = Object.keys(file.hotels).sort();
  const lines = ids.map((id) => `  ${JSON.stringify(id)}: ${JSON.stringify(file.hotels[id])}`);
  return `{\n "version": 1,\n "hotels": {\n${lines.join(",\n")}\n }\n}\n`;
}

function save(file) {
  if (DRY) return;
  const tmp = `${OUT}.tmp`;
  writeFileSync(tmp, serialise(file));
  renameSync(tmp, OUT);
}

const file = JSON.parse(readFileSync(OUT, "utf8"));
file.hotels ??= {};
const hotels = JSON.parse(readFileSync(HOTELS, "utf8")).filter(
  (h) => h?.id && Number.isFinite(h.lat) && Number.isFinite(h.lng) && (!ONLY || ONLY.has(h.id)),
);

// A hotel the catalogue no longer carries has no framing to keep.
const live = new Set(hotels.map((h) => h.id));
let dropped = 0;
if (!ONLY) {
  for (const id of Object.keys(file.hotels)) {
    if (!live.has(id)) {
      delete file.hotels[id];
      dropped++;
    }
  }
}

const staleBefore = new Date(Date.now() - STALE_DAYS * 86400000).toISOString().slice(0, 10);
const due = hotels
  .filter((h) => ONLY || !file.hotels[h.id] || file.hotels[h.id].at < staleBefore)
  .sort((a, b) => (file.hotels[a.id]?.at ?? "").localeCompare(file.hotels[b.id]?.at ?? ""))
  .slice(0, LIMIT);

console.log(
  `flyover framing: ${Object.keys(file.hotels).length}/${hotels.length} surveyed; ${due.length} due this run` +
    (dropped ? `; ${dropped} dropped (no longer in the catalogue)` : ""),
);

const today = new Date().toISOString().slice(0, 10);
let done = 0, failed = 0, strikes = 0, steep = 0;
for (const h of due) {
  const s = await survey(h);
  if (!s) {
    failed++;
    strikes++;
    console.log(`  ✗ ${h.id} ${h.name} — Overpass did not answer`);
    if (strikes >= MAX_STRIKES) {
      console.log(`  Overpass refused ${MAX_STRIKES} in a row; stopping here. The next run carries on.`);
      break;
    }
    continue;
  }
  strikes = 0;
  const f = framingFromSurvey(s);
  file.hotels[h.id] = { ...f, at: today };
  done++;
  if (f.tilt < 60) steep++;
  console.log(
    `  ✓ ${h.id} ${h.name} — ${s.buildings.length} buildings, ` +
      `hover ${f.range} m @${f.tilt}° from ${core.compass(f.bearing)}, arrive ${f.arrive.range} m @${f.arrive.tilt}°` +
      (f.height != null ? `, ${f.height} m tall` : "") +
      (s.sources.terrain ? "" : ", no terrain") +
      (f.clear ? "" : ", boxed in"),
  );
  save(file);
}
save(file);

console.log(
  `\nflyover framing: surveyed ${done} (${steep} needed a steeper angle), ${failed} failed; ` +
    `${Object.keys(file.hotels).length}/${hotels.length} now have a framing${DRY ? " (dry run: nothing written)" : ""}`,
);
if (due.length && !done) process.exitCode = 1;
