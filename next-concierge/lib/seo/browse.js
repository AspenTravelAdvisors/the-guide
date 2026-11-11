// Find by name — every hotel, villa and journey, in one alphabetical list.
//
// The hubs at /hotels, /villas and /journeys file the inventory by PLACE: to
// reach one property you pick its country first. That is the right shape for
// someone deciding where to go and the wrong one for someone who already knows
// what they want ("is the Cadogan in here?"), who had no way in short of asking
// The Guide and waiting for a reply. This module is the name-first index behind
// /browse, the letter pages under it, and the filter box on the hubs and the
// 404 page (components/FindByName.tsx).
//
// It reads the same three sources the hubs do — allHotels(), the villa feed,
// journeysIn() — so a name is listed here exactly when it has a page, and the
// link is the page's own path rather than one rebuilt from the name.
//
// Server-only: it pulls the hotel, villa and journey feeds.

import { allHotels } from "@/lib/seo/hotels";
import { loadVillas } from "@/lib/villas.js";
import { villaPath } from "@/lib/seo/villas";
import { JOURNEY_COLLECTIONS, journeysIn } from "@/lib/seo/journeys";

/** What a journey is called in the singular, for the tag beside its name. */
const JOURNEY_KIND = {
  cruise: "Expedition cruise",
  worldcruise: "World cruise",
  yacht: "Yacht voyage",
  train: "Rail journey",
  jet: "Private jet journey",
  safari: "Safari",
};

const clean = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();

const fold = (s) =>
  clean(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/**
 * The name an A–Z list files under: without a leading "The".
 *
 * Several hundred hotels are "The Something", and filed as written they would
 * make T the longest letter and bury the name a reader is actually scanning
 * for. Directories have dropped the article for this reason for as long as
 * there have been directories. The name is still SHOWN as written, and the
 * filter box matches it either way.
 */
const sortKey = (name) => fold(name).replace(/^the\s+/, "");

/** "a"…"z", or "0-9" for a name that starts with anything else. */
export function letterOf(name) {
  const c = sortKey(name).charAt(0);
  return c >= "a" && c <= "z" ? c : "0-9";
}

export const LETTERS = [..."abcdefghijklmnopqrstuvwxyz", "0-9"];
export const letterLabel = (l) => (l === "0-9" ? "0–9" : l.toUpperCase());

let CACHE = null;

/**
 * Every named page, sorted by name.
 *
 * Each entry: `k` — "h" hotel, "v" villa, "j" journey; `n` — the name; `t` —
 * what it is ("Hotel", "Expedition cruise"); `p` — where, or who runs it;
 * `u` — the page. Short keys because this list also ships to the browser as
 * /browse/index.json, seven thousand times over.
 */
export function browseEntries() {
  if (CACHE) return CACHE;
  const out = [];

  for (const h of allHotels()) {
    out.push({
      k: "h",
      n: clean(h.name),
      t: "Hotel",
      p: [h.city, h.country].map(clean).filter(Boolean).join(", "),
      u: h.path,
    });
  }

  for (const v of loadVillas().villas) {
    // The same test villaDestinations() applies: a villa without a destination
    // has no hub, and its detail route has no first segment.
    if (!v.destinationSlug || !v.slug || !clean(v.name)) continue;
    out.push({
      k: "v",
      n: clean(v.name),
      t: "Villa",
      p: [v.location, v.destination]
        .map(clean)
        .filter((x, i, a) => x && a.indexOf(x) === i)
        .join(", "),
      u: villaPath(v),
    });
  }

  for (const type of JOURNEY_COLLECTIONS) {
    for (const j of journeysIn(type)) {
      out.push({
        k: "j",
        n: clean(j.title),
        t: JOURNEY_KIND[type] || "Journey",
        p: clean(j.operator),
        u: j.path,
      });
    }
  }

  out.sort(
    (a, b) =>
      sortKey(a.n).localeCompare(sortKey(b.n), "en") ||
      a.p.localeCompare(b.p, "en") ||
      a.u.localeCompare(b.u),
  );
  CACHE = out;
  return out;
}

/** How many names file under each letter, in LETTERS order. */
export function letterCounts() {
  const counts = new Map(LETTERS.map((l) => [l, 0]));
  for (const e of browseEntries()) counts.set(letterOf(e.n), counts.get(letterOf(e.n)) + 1);
  return LETTERS.map((l) => ({ letter: l, label: letterLabel(l), count: counts.get(l) }));
}

export const entriesUnder = (letter) => browseEntries().filter((e) => letterOf(e.n) === letter);

export function browseTotals() {
  const all = browseEntries();
  const by = (k) => all.filter((e) => e.k === k).length;
  return { all: all.length, hotels: by("h"), villas: by("v"), journeys: by("j") };
}
