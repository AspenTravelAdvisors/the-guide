// Supplier pages: one per operator per journey collection, one per hotel brand.
//
// Why these exist. Bing's query report for The Guide is mostly an operator name
// plus a product: "national geographic private jet", "hx ultimate norway",
// "a&k sanctuary kenya", "belmond paris to venice". We ranked 3–6 for dozens of
// those and got almost no clicks, because no page answered at the operator
// level. The itinerary pages each answer one route; the collection hubs list
// every operator at once. These pages answer "everything this operator runs,
// and when".
//
// Everything here is derived from the same entity layers the itinerary and
// hotel pages use (lib/seo/journeys.js, lib/seo/hotels.js), so an operator page
// can never list an itinerary whose own page does not exist, and the counts it
// states are the counts the hubs state.
//
// Server-only, for the same reason as those two modules: it reads every feed.

import { journeysIn, JOURNEY_COLLECTIONS, collectionMeta } from "@/lib/seo/journeys";
import { allHotels } from "@/lib/seo/hotels";
import { SITE_URL } from "@/lib/answers";
import { slugify } from "@/lib/seo/journey-key.mjs";

import brandProfiles from "@/data/atlas/shared/brand-profiles.json";
import cruiseShips from "@/data/atlas/cruise/ships.json";
import worldShips from "@/data/atlas/world/ships.json";
import yachtShips from "@/data/atlas/yacht/ships.json";
import trainFacts from "@/data/atlas/train/train.json";
import planeFacts from "@/data/atlas/jet/plane.json";
import jetRaw from "@/data/atlas/jet/itinerary.json";
import trainRaw from "@/data/atlas/train/itinerary.json";
import yachtRaw from "@/data/atlas/yacht/itinerary.json";
import worldRaw from "@/data/atlas/world/itinerary.json";
import safariRaw from "@/data/atlas/safari/itinerary.json";

/**
 * An operator page with one itinerary is a page about one itinerary, which
 * already has a page. It is still built (the collection hub links every
 * operator, and a link to a 404 is worse than a short page) but it is noindex,
 * so it cannot compete with the itinerary page for the same query.
 */
export const MIN_INDEXED_ITINERARIES = 2;
/** Hotel brands need two properties for a page at all; one is a hotel page. */
export const MIN_BRAND_HOTELS = 2;

const today = () => new Date().toISOString().slice(0, 10);
const norm = (s) =>
  String(s == null ? "" : s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/* ── Brand profiles: the one-line positioning we hold for ~120 suppliers ── */

const PROFILE_BY_NAME = (() => {
  const m = new Map();
  for (const p of Object.values(brandProfiles)) {
    if (!p || !p.brandId) continue;
    for (const name of [p.displayName, p.brandId, ...(p.aliases || [])]) {
      const k = norm(name);
      if (k && !m.has(k)) m.set(k, p);
    }
  }
  return m;
})();

// Feed labels that do not fold onto a profile name or alias by themselves.
const PROFILE_ALIASES = {
  "national geographic lindblad expeditions": "lindblad expeditions",
  "hx expeditions": "hurtigruten expeditions hx",
  "ponant explorations": "ponant",
};

/** @returns {any} */
export function profileFor(name, collection) {
  const k = norm(name);
  const p = PROFILE_BY_NAME.get(PROFILE_ALIASES[k] || k);
  if (!p) return null;
  // A hotel brand's profile must not describe its trains or jets: Belmond the
  // hotel group and Belmond the train operator are positioned differently.
  if (collection && p.appliesTo && !p.appliesTo.includes(collection)) return null;
  return p;
}

/* ── Vessel facts: ship, train or aircraft, from the compiled fact files ── */

const SHIP_FACTS = new Map();
for (const s of cruiseShips.ships || []) SHIP_FACTS.set(s.ship.trim(), { ...s, kind: "ship" });
for (const s of worldShips.ships || []) SHIP_FACTS.set(s.ship.trim(), { ...s, kind: "ship" });
for (const s of yachtShips.ships || []) SHIP_FACTS.set(s.ship.trim(), { ...s, kind: "yacht" });
for (const t of trainFacts.trains || []) SHIP_FACTS.set(t.train.trim(), { ...t, ship: t.train, kind: "train" });

/** The jet program's aircraft, keyed by the operator label the feed shows. */
const PLANE_BY_OPERATOR = (() => {
  const m = new Map();
  for (const [key, b] of Object.entries(jetRaw.BRANDS || {})) {
    const plane = (planeFacts.planes || []).find((p) => p.brand === key);
    if (plane && b?.short) m.set(b.short, plane);
  }
  return m;
})();

function vesselFacts(collection, operator, vessels) {
  if (collection === "jet") {
    const p = PLANE_BY_OPERATOR.get(operator);
    return p
      ? [{ name: p.aircraft, guests: p.guests, detail: [p.config, p.crew].filter(Boolean).join(". "), note: p.notes }]
      : [];
  }
  return vessels
    .map((v) => SHIP_FACTS.get(String(v).trim()))
    .filter(Boolean)
    .map((s) => ({
      name: s.ship,
      guests: s.guests ?? null,
      detail: [
        s.suites ? `${s.suites} suites` : null,
        s.lengthM ? `${s.lengthM} m` : null,
        s.launched ? `launched ${s.launched}` : null,
        s.iceClass ? `ice class ${s.iceClass}` : null,
        s.expeditionTeam ? `${s.expeditionTeam} expedition staff` : null,
        s.cabins || null,
        s.class || null,
      ]
        .filter(Boolean)
        .join(" · "),
      note: s.notes || null,
    }));
}

/* ── Region names ──
   The journey entities carry region KEYS ("SEASIA", "EASTAFRICA") because that
   is what the atlas filters on. A page says the region's short name instead.
   Cruise regions are already names and pass through unchanged. */
const REGION_NAMES = (() => {
  const m = {};
  for (const [c, raw] of [["jet", jetRaw], ["train", trainRaw], ["yacht", yachtRaw], ["worldcruise", worldRaw], ["safari", safariRaw]]) {
    m[c] = {};
    for (const [k, v] of Object.entries(raw.REGIONS || {})) m[c][k] = v?.ab || v?.name || k;
  }
  return m;
})();
/** @type {(collection: string, key: string) => string} */
export const regionName = (collection, key) => REGION_NAMES[collection]?.[key] || key;

/* ── Journey operators ── */

function upcomingDepartures(j, on) {
  return j.departures.filter((d) => d.startDate && d.startDate >= on);
}

/** @returns {any[]} */
function buildOperators(collection) {
  const on = today();
  const groups = new Map();
  for (const j of journeysIn(collection)) {
    if (!j.operator) continue;
    const g = groups.get(j.operator) || { name: j.operator, itineraries: [] };
    g.itineraries.push(j);
    groups.set(j.operator, g);
  }

  const taken = new Set();
  const out = [];
  for (const g of [...groups.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    let slug = slugify(g.name) || "operator";
    if (taken.has(slug)) slug = `${slug}-${taken.size}`;
    taken.add(slug);

    const itineraries = [...g.itineraries].sort((a, b) => {
      const na = upcomingDepartures(a, on)[0]?.startDate || "9999";
      const nb = upcomingDepartures(b, on)[0]?.startDate || "9999";
      return na.localeCompare(nb) || a.title.localeCompare(b.title);
    });
    const departures = itineraries
      .flatMap((j) => upcomingDepartures(j, on).map((d) => ({ ...d, journey: j })))
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const onRequest = itineraries.filter((j) => j.onDemand);
    const days = itineraries.map((j) => j.days).filter((d) => Number.isFinite(d) && d > 0);
    const vessels = [...new Set(itineraries.flatMap((j) => j.vessels))].sort();
    const regions = countBy(itineraries.flatMap((j) => j.regions.map((r) => regionName(collection, r))));
    const countries = countBy(itineraries.flatMap((j) => j.countries));

    out.push({
      kind: "journey",
      collection,
      slug,
      name: g.name,
      path: `/journeys/${collection}/operators/${slug}`,
      itineraries,
      departures,
      onRequest: onRequest.length,
      firstDate: departures[0]?.startDate || null,
      lastDate: departures[departures.length - 1]?.startDate || null,
      minDays: days.length ? Math.min(...days) : null,
      maxDays: days.length ? Math.max(...days) : null,
      vessels,
      vesselFacts: vesselFacts(collection, g.name, vessels),
      regions,
      countries,
      profile: profileFor(g.name, collection),
      indexable: itineraries.length >= MIN_INDEXED_ITINERARIES,
    });
  }
  return out;
}

function countBy(list) {
  const m = new Map();
  for (const x of list) if (x) m.set(x, (m.get(x) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, n]) => ({ name, n }));
}

const OP_CACHE = new Map();
/** @returns {any[]} */
export function journeyOperators(collection) {
  if (!collectionMeta(collection)) return [];
  if (!OP_CACHE.has(collection)) OP_CACHE.set(collection, buildOperators(collection));
  return OP_CACHE.get(collection);
}
/** @type {(collection: string, slug: string) => any} */
export const getJourneyOperator = (collection, slug) =>
  journeyOperators(collection).find((o) => o.slug === slug) || null;
/** The operator page an itinerary belongs to, for linking back up. */
/** @type {(collection: string, operatorName: string) => string | null} */
export const operatorPathFor = (collection, operatorName) =>
  journeyOperators(collection).find((o) => o.name === operatorName)?.path || null;

/** @returns {{collection: string, operator: string}[]} */
export function journeyOperatorParams() {
  return JOURNEY_COLLECTIONS.flatMap((collection) =>
    journeyOperators(collection).map((o) => ({ collection, operator: o.slug })),
  );
}

/* ── Hotel brands ── */

let BRANDS = null;
/** @returns {any[]} */
function buildBrands() {
  const groups = new Map();
  for (const h of allHotels()) {
    if (!h.brand) continue;
    const g = groups.get(h.brand) || { name: h.brand, hotels: [] };
    g.hotels.push(h);
    groups.set(h.brand, g);
  }
  return [...groups.values()]
    .filter((g) => g.hotels.length >= MIN_BRAND_HOTELS)
    .map((g) => {
      const hotels = [...g.hotels].sort(
        (a, b) => a.country.localeCompare(b.country) || String(a.city).localeCompare(String(b.city)) || a.name.localeCompare(b.name),
      );
      const slug = slugify(g.name);
      return {
        kind: "hotel",
        collection: "hotel",
        slug,
        name: g.name,
        path: `/hotels/brands/${slug}`,
        hotels,
        countries: countBy(hotels.map((h) => h.country)),
        programs: countBy(hotels.map((h) => h.program)),
        amenities: commonAmenities(hotels),
        rooms: hotels.reduce((n, h) => n + (Number(h.numberOfRooms) || 0), 0),
        profile: profileFor(g.name, "hotel"),
        indexable: true,
      };
    })
    .sort((a, b) => b.hotels.length - a.hotels.length || a.name.localeCompare(b.name));
}

/**
 * The amenities most of a brand's properties share, phrased the way the feed
 * phrases them but with the legal tail cut ("…(not combinable, no cash value)").
 * A line counts when at least a third of the brand's hotels carry it.
 */
function commonAmenities(hotels) {
  const shorten = (s) =>
    String(s)
      .replace(/\s*\(.*$/, "")
      .replace(/\s+equivalent\b/i, "")
      .replace(/^Daily Full breakfast/i, "Daily breakfast")
      .replace(/,? served in .*$/i, "")
      .trim();
  const key = (s) => norm(shorten(s)).replace(/\b\d+\b/g, "#");
  const counts = new Map();
  for (const h of hotels) {
    const seen = new Set();
    for (const line of h.vipUpgrades || []) {
      const k = key(line);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      const c = counts.get(k) || { text: shorten(line), n: 0 };
      c.n++;
      counts.set(k, c);
    }
  }
  const floor = Math.max(2, Math.ceil(hotels.length / 3));
  return [...counts.values()]
    .filter((c) => c.n >= floor && !/not applicable/i.test(c.text))
    .sort((a, b) => b.n - a.n)
    .slice(0, 6);
}

/** @returns {any[]} */
export function hotelBrands() {
  return (BRANDS ??= buildBrands());
}
/** @type {(slug: string) => any} */
export const getHotelBrand = (slug) => hotelBrands().find((b) => b.slug === slug) || null;
/** @type {(brandName: string) => string | null} */
export const brandPathFor = (brandName) => hotelBrands().find((b) => b.name === brandName)?.path || null;

/* ── Sitemap ── */

/** @returns {{url: string, priority: number}[]} */
export function supplierSitemapEntries() {
  return [
    { url: `${SITE_URL}/hotels/brands`, priority: 0.7 },
    ...hotelBrands().map((b) => ({ url: `${SITE_URL}${b.path}`, priority: 0.6 })),
    ...JOURNEY_COLLECTIONS.flatMap((c) =>
      journeyOperators(c)
        .filter((o) => o.indexable)
        .map((o) => ({ url: `${SITE_URL}${o.path}`, priority: 0.6 })),
    ),
  ];
}

/* ── Formatting shared by the pages ── */

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const asDate = (iso) => new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
export const fmtMonth = (iso) => (iso ? MONTH.format(asDate(iso)) : null);
export const fmtDay = (iso) => (iso ? DAY.format(asDate(iso)) : null);
export const yearSpan = (a, b) => {
  if (!a) return null;
  const ya = String(a).slice(0, 4);
  const yb = String(b || a).slice(0, 4);
  return ya === yb ? ya : `${ya}–${yb.slice(2)}`;
};
