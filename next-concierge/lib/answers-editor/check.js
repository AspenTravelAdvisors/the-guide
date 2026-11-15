// The answers editor's preview and checks. Server-only.
//
// The same fact engine the answer pages use resolves the draft, so the preview
// shows the counts and links the page will show. The checks are the ones
// scripts/verify-seo.mjs applies to a single answer, plus the house-style rules
// from the drafting brief as warnings. Errors block a save; warnings do not.
// CI still runs the full verifier on every push, so anything this file does not
// know about (cruise-atlas filter links, built output) is caught there.

import { facts, answerEvidence, bodyOf } from "@/lib/seo/answer-facts";
import { UnknownFactTerm, parseSupplierToken, parseLinkToken, stripLinks } from "@/lib/seo/facts.mjs";
import { ALL_ANSWERS, CATEGORY_ORDER } from "@/lib/answers";
import { allHotels } from "@/lib/seo/hotels";
import journeyFacts from "@/data/atlas/shared/journey-facts.json";
import { loadVillas } from "@/lib/villas.js";
import { ATLAS_TYPES } from "@/lib/atlas-config";

const TOKEN_RE = /\{\{[^}]*\}\}/g;

// ── link targets that exist ──────────────────────────────────────────────────
const hotelPaths = new Set(allHotels().map((h) => h.path).filter(Boolean));
const hotelHubs = new Set([...hotelPaths].map((p) => p.split("/")[2]));
const journeyCollections = new Set(journeyFacts.rows.map((r) => r.c));
const journeyPages = new Set(journeyFacts.rows.map((r) => `${r.c}/${r.s}`));
const villaHubs = new Set(loadVillas().villas.map((v) => v.destinationSlug).filter(Boolean));
const STATIC_PAGES = new Set(["/", "/answers", "/hotels", "/hotels/brands", "/villas", "/journeys", "/bucket-list", "/atlas/villa"]);

/**
 * Why a site path would not resolve, or null. `slugs` is every answer that is
 * live on the branch being edited; `held` the ones still waiting for release.
 */
function linkProblem(href, slugs, held) {
  const [pathname] = String(href || "").split("?");
  if (!pathname.startsWith("/")) return { level: "error", text: "must be a path on this site, starting with /" };
  if (STATIC_PAGES.has(pathname)) return null;
  let m;
  if ((m = /^\/answers\/([^/]+)$/.exec(pathname))) {
    if (slugs.has(m[1])) return null;
    if (held.has(m[1])) return { level: "error", text: "is an answer that has not been released yet. Link to it once it is live" };
    return { level: "error", text: "is not an answer on the site" };
  }
  if ((m = /^\/hotels\/([^/]+)\/([^/]+)$/.exec(pathname))) {
    return hotelPaths.has(pathname) ? null : { level: "error", text: "is not a hotel page" };
  }
  if ((m = /^\/hotels\/([^/]+)$/.exec(pathname))) {
    return hotelHubs.has(m[1]) ? null : { level: "error", text: "is a country with no hotels in the atlas" };
  }
  if ((m = /^\/journeys\/([^/]+)\/([^/]+)$/.exec(pathname))) {
    return journeyPages.has(`${m[1]}/${m[2]}`) ? null : { level: "error", text: "is not an itinerary page" };
  }
  if ((m = /^\/journeys\/([^/]+)$/.exec(pathname))) {
    return journeyCollections.has(m[1]) ? null : { level: "error", text: "is not a journeys collection" };
  }
  if ((m = /^\/villas\/([^/]+)$/.exec(pathname))) {
    return villaHubs.has(m[1]) ? null : { level: "error", text: "is a destination with no villas" };
  }
  if ((m = /^\/atlas\/([^/]+)\/?$/.exec(pathname))) {
    if (!ATLAS_TYPES.includes(m[1])) return { level: "error", text: "is not an atlas" };
    return href.includes("?") ? { level: "warning", text: "is an atlas filter link; CI checks that it shows results" } : null;
  }
  return { level: "warning", text: "is a path the editor cannot check; CI will" };
}

// ── walking the page ─────────────────────────────────────────────────────────
function* strings(node, at = "") {
  if (typeof node === "string") yield [at, node];
  else if (Array.isArray(node)) for (let i = 0; i < node.length; i += 1) yield* strings(node[i], at ? `${at}.${i}` : String(i));
  else if (node && typeof node === "object") for (const [k, v] of Object.entries(node)) yield* strings(v, at ? `${at}.${k}` : k);
}

/** Resolve one token alone; the error text when it cannot be. */
function tokenError(token) {
  try {
    facts.resolve(token);
    return null;
  } catch (err) {
    return err instanceof UnknownFactTerm ? err.message : String(err.message || err);
  }
}

const BANNED = ["once in a lifetime", "unparalleled", "breathtaking", "world-class", "nestled", "stunning"];

/**
 * Every problem with a page, as { level, path, message }. `path` names the
 * field ("capsule", "sections.1.table.rows.2.0") so the editor can point at it.
 */
export function checkPage(page, { slugs, held }) {
  const out = [];
  const add = (level, path, message) => out.push({ level, path, message });

  for (const f of ["question", "title", "description", "capsule"]) {
    if (!String(page[f] || "").trim()) add("error", f, `The ${f} is empty.`);
  }
  if (!CATEGORY_ORDER.includes(page.category)) add("error", "category", `Category must be one of: ${CATEGORY_ORDER.join(", ")}.`);
  if (!(page.answer || []).some((p) => String(p).trim())) add("error", "answer", "The answer needs at least one paragraph.");

  // Tokens: each must resolve, and counts must not be zero.
  for (const [at, text] of strings(page)) {
    for (const [token] of text.matchAll(TOKEN_RE)) {
      const why = tokenError(token);
      if (why) {
        add("error", at, `${token} cannot be resolved: ${why}`);
        continue;
      }
      const body = token.slice(2, -2);
      const kind = body.slice(0, body.indexOf(":"));
      const spec = body.slice(body.indexOf(":") + 1).trim();
      if (kind === "hotels" && facts.count(spec) === 0) add("error", at, `${token} matches no hotel. Check the spelling against the feed.`);
      if ((kind === "journeys" || kind === "departures") && facts.countJourneys(spec) === 0) add("error", at, `${token} matches no itinerary.`);
      if (kind === "villas" && facts.countVillas(spec) === 0) add("error", at, `${token} matches no villa.`);
      if (kind === "op" || kind === "brand") {
        const t = parseSupplierToken(kind, spec);
        const n = kind === "brand"
          ? facts.count(`brand=${encodeURIComponent(t.name)}`)
          : facts.countJourneys(`collection=${encodeURIComponent(t.collection)}&operator=${encodeURIComponent(t.name)}`);
        if (n === 0) add("error", at, `${token} matches nothing in the feed.`);
        else if (n === 1) add("warning", at, `${token} has only one listing, so it shows as plain words, not a link.`);
      }
      if (kind === "page") {
        const t = parseLinkToken("page", spec);
        const why2 = linkProblem(t.path, slugs, held);
        if (why2) add(why2.level, at, `${t.path} ${why2.text}.`);
      }
    }
  }

  // The capsule is lifted out whole by answer engines.
  const capsule = String(page.capsule || "");
  if (capsule) {
    if (/\{\{(op|brand|hotel|villa|page):/.test(capsule)) add("error", "capsule", "The capsule cannot contain links. Write the name instead.");
    let words = 0;
    try {
      words = stripLinks(facts.resolve(capsule)).trim().split(/\s+/).length;
    } catch {
      words = capsule.trim().split(/\s+/).length;
    }
    if (words < 25 || words > 90) add("error", "capsule", `The capsule is ${words} words. It must be 25 to 90 (aim for 40 to 70).`);
    else if (words < 40 || words > 70) add("warning", "capsule", `The capsule is ${words} words. The house aim is 40 to 70.`);
    if (/^(this|these|here|below|as (noted|above))\b/i.test(capsule.trim())) add("error", "capsule", "The capsule cannot open with This, These, Here, Below or As noted: it has to make sense on its own.");
  }

  (page.sections || []).forEach((s, i) => {
    if (!String(s.h2 || "").trim()) add("warning", `sections.${i}.h2`, `Section ${i + 1} has no heading.`);
    if (s.table) {
      const cols = (s.table.columns || []).length;
      if (!cols) add("error", `sections.${i}.table`, `The table in section ${i + 1} has no columns.`);
      if (!(s.table.rows || []).length) add("error", `sections.${i}.table`, `The table in section ${i + 1} has no rows.`);
      (s.table.rows || []).forEach((r, j) => {
        if (r.length !== cols) add("error", `sections.${i}.table.rows.${j}`, `Row ${j + 1} of the table in section ${i + 1} has ${r.length} cells for ${cols} columns.`);
      });
    }
    if (!s.table && !(s.paras || []).length && !(s.list || []).length) add("warning", `sections.${i}`, `Section ${i + 1} is empty.`);
  });

  if (page.evidence) {
    const e = page.evidence;
    if (!String(e.h2 || "").trim()) add("error", "evidence.h2", "The evidence table needs a heading.");
    try {
      if (!facts.select(e.query, { limit: 1 }).length) add("error", "evidence.query", "The evidence query matches no hotel, so the table would be empty.");
    } catch (err) {
      add("error", "evidence.query", `The evidence query is not valid: ${err.message}`);
    }
  }

  (page.faqs || []).forEach((f, i) => {
    if (!String(f.q || "").trim() || !String(f.a || "").trim()) add("error", `faqs.${i}`, `Question ${i + 1} needs both a question and an answer.`);
  });
  if (!(page.faqs || []).length) add("warning", "faqs", "There are no frequently asked questions.");

  (page.related || []).forEach((r, i) => {
    if (!String(r.label || "").trim()) add("error", `related.${i}.label`, `Related link ${i + 1} has no label.`);
    const why = linkProblem(r.href, slugs, held);
    if (why) add(why.level, `related.${i}.href`, `${r.href || "(empty)"} ${why.text}.`);
  });

  // House style, from the drafting brief. Warnings only.
  for (const [at, text] of strings(page)) {
    const plain = text.replace(TOKEN_RE, "");
    if (/[—–]/.test(plain)) add("warning", at, "Uses a long dash. The house style prefers commas and full stops.");
    if (/!/.test(plain)) add("warning", at, "Uses an exclamation mark.");
    for (const w of BANNED) if (plain.toLowerCase().includes(w)) add("warning", at, `Uses "${w}", which the house style avoids.`);
    if (/\$\s?\d/.test(plain)) add("warning", at, "Mentions a price. The pages avoid stating prices for specific properties.");
  }
  return out;
}

/** Wrap any token that will not resolve, so the preview can still render. */
function defang(node) {
  if (typeof node === "string") return node.replace(TOKEN_RE, (t) => (tokenError(t) ? `⟦${t.slice(2, -2)}⟧` : t));
  if (Array.isArray(node)) return node.map(defang);
  if (node && typeof node === "object") return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, defang(v)]));
  return node;
}

/** The page as it will render: plain-text head, linked body, evidence rows. */
export function previewPage(page) {
  const safe = defang(page);
  const plain = (s) => stripLinks(facts.resolve(String(s || "")));
  const body = bodyOf(safe);
  let evidence = null;
  if (safe.evidence) {
    try {
      evidence = answerEvidence(safe);
    } catch {
      evidence = { h2: safe.evidence.h2, note: safe.evidence.note, total: 0, shown: 0, rows: [] };
    }
    if (evidence) evidence = { ...evidence, h2: plain(evidence.h2), note: evidence.note ? plain(evidence.note) : null };
  }
  return {
    question: plain(safe.question),
    title: plain(safe.title),
    description: plain(safe.description),
    capsule: plain(safe.capsule),
    category: safe.category,
    updated: safe.updated || null,
    ...body,
    evidence,
    related: (safe.related || []).map((r) => ({ href: r.href, label: r.label })),
  };
}

/** Slugs live in the registry and on the branch, and the slugs still held. */
export function linkContext(all) {
  const slugs = new Set([...ALL_ANSWERS.map((a) => a.slug), ...(all.live || []).map((a) => a.slug)]);
  const held = new Set((all.held || []).map((d) => d.page.slug));
  for (const s of slugs) held.delete(s);
  return { slugs, held };
}
