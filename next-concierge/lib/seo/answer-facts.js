// The fact engine, bound to the shipped data. Server-only.
//
// lib/seo/facts.mjs holds the semantics and no data; this file is the Next-side
// loader for it. scripts/verify-seo.mjs is the other loader. Neither carries a
// second copy of what a term means.

import { makeFacts, LINK_MARK_RE, stripLinks } from "@/lib/seo/facts.mjs";
import { COLLECTIONS } from "@/lib/atlas-config";
import { ALL_ANSWERS, getAnswer, answersByCategory } from "@/lib/answers";
import { allHotels, hotelPath } from "@/lib/seo/hotels";
import journeyFacts from "@/data/atlas/shared/journey-facts.json";
import { loadVillas } from "@/lib/villas.js";

// The hotels the entity pages serve, so a row in an evidence table and the page
// it links to are the same record — program overrides and slugs included.
const HOTELS = allHotels();

const COLLECTION_COUNTS = Object.fromEntries(
  COLLECTIONS.map((c) => [c.type, c.count]),
);

// The supplier-page lookup, loaded only by the one surface that links: the
// answer page body. lib/seo/suppliers.js reads every route feed, and the
// /answers index and /llms.txt, which import this module too, have no use for it.
/** @type {null | ((kind: string, collection: string, name: string) => string | null)} */
let supplierHref = null;

/*
 * Journeys arrive as a generated artifact, not as the route feeds.
 *
 * A live import would pull every route atlas plus 3.6MB of cruise route
 * geometry into this bundle to count rows. scripts/build-journey-facts.mjs
 * precomputes exactly the countable fields, one row per itinerary, using the
 * same grouping the /journeys pages serve from — so a count in a sentence and
 * the page it links to cannot disagree about what an itinerary is.
 */
export const facts = makeFacts(
  HOTELS,
  COLLECTION_COUNTS,
  journeyFacts.rows,
  loadVillas().villas,
  (kind, collection, name) => (supplierHref ? supplierHref(kind, collection, name) : null),
);

/**
 * Resolve an answer's `evidence` block into real, linkable properties.
 *
 * This is the part the Virtuoso sync makes possible. Before it, an answer page
 * could assert "the quietest resorts in Italy" and support the claim with
 * nothing a reader or a crawler could follow. Now the claim is followed
 * immediately by the properties it is about — named, counted, linked to their
 * own pages, and regenerated from the supplier feed on every build.
 */
export function answerEvidence(a) {
  if (!a || !a.evidence) return null;
  const e = a.evidence;
  const rows = facts.select(e.query, { limit: e.limit || 12, sort: e.sort || "name" });
  const total = facts.count(e.query);
  return {
    h2: e.h2,
    note: e.note || null,
    total,
    shown: rows.length,
    rows: rows.map((h) => ({
      id: h.id,
      name: h.name,
      where: [h.city, h.country].filter(Boolean).join(", "),
      program: h.program,
      brand: h.brand,
      rooms: Number.isFinite(h.numberOfRooms) ? h.numberOfRooms : null,
      perks: (h.vipUpgrades || []).length,
      href: hotelPath(h),
    })),
  };
}

/**
 * The registry, resolved. Every surface that renders answer PROSE reads from
 * here rather than from lib/answers.js directly.
 *
 * That indirection is not decoration — it is the fix for a bug this file
 * caused. The detail page resolved its own record and the index page did not,
 * so `/answers` and `/llms.txt` published `{{hotels:program=Virtuoso}}` in
 * their descriptions while the page those descriptions pointed at read
 * correctly. One resolved accessor per consumer is one too many; there is now
 * exactly one, and lib/answers.js stays token-bearing so robots.js and
 * sitemap.js (which read only slugs and dates) never load the hotel feed.
 */
export const resolvedAnswers = () => ALL_ANSWERS.map((a) => facts.resolveDeep(a));

export function resolvedAnswer(slug) {
  const raw = getAnswer(slug);
  return raw ? facts.resolveDeep(raw) : null;
}

export function resolvedAnswersByCategory() {
  return answersByCategory().map(({ category, answers }) => ({
    category,
    answers: answers.map((a) => facts.resolveDeep(a)),
  }));
}

/**
 * The parts of an answer the page renders as prose — lead, sections, FAQs —
 * with supplier tokens linked, each supplier page linked once, at its first
 * mention in reading order.
 *
 * Everything else about the page (title, description, capsule, JSON-LD) keeps
 * reading `resolvedAnswer`, which is plain text. The capsule in particular is
 * never linked: it is the paragraph built to be lifted out whole, and the
 * Article block's `speakable` points at it.
 *
 * The order below is the page's order (the lead; each section's table, then
 * paragraphs, then list; the FAQs). If the page template changes the order,
 * change it here too, or the link moves to a later mention.
 */
export async function answerBody(slug) {
  const raw = getAnswer(slug);
  if (!raw) return null;
  supplierHref ??= (await import("@/lib/seo/suppliers")).supplierHref;

  const linked = (node) => facts.resolveDeep(node, { linked: true });
  const seen = new Set();
  const once = (text) =>
    typeof text !== "string"
      ? text
      : text.replace(LINK_MARK_RE, (mark, href, label) => {
          if (seen.has(href)) return label;
          seen.add(href);
          return mark;
        });

  const answer = linked(raw.answer || []).map(once);
  const sections = linked(raw.sections || []).map((s) => {
    const out = { ...s };
    if (s.h2) out.h2 = stripLinks(s.h2);
    if (s.table) {
      out.table = {
        ...s.table,
        caption: stripLinks(s.table.caption),
        columns: s.table.columns.map(stripLinks),
        rows: s.table.rows.map((r) => r.map(once)),
      };
    }
    if (s.paras) out.paras = s.paras.map(once);
    if (s.list) out.list = s.list.map(once);
    return out;
  });
  const faqs = linked(raw.faqs || []).map((f) => ({ q: stripLinks(f.q), a: once(f.a) }));
  return { answer, sections, faqs };
}
