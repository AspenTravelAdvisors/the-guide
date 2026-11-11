// Live atlas facts for the answer pages — the query engine, with no I/O.
//
// The problem this solves is written down in data/answers/hotels.js: "Counts
// cited in copy were computed from luxury-hotels.json ... on the `updated`
// date. These are prose, so they are a dated snapshot rather than a live
// figure." Every nightly Virtuoso sync moves those figures and nothing moves
// the sentences. An answer page that says "57 Four Seasons Preferred Partner
// properties" when the feed holds a different number is exactly the page an
// answer engine should not cite, and the citation is the entire point of the
// surface.
//
// So the copy no longer states counts. It states QUERIES — `{{hotels:program=
// Four Seasons Preferred Partner}}` — and the number is computed from the
// shipped feed when the page renders. The same queries drive the evidence
// tables, so the sentence and the table under it cannot disagree.
//
// Pure by design: the hotel rows are passed in. That is what lets the Next
// pages and scripts/verify-seo.mjs share ONE implementation rather than each
// carrying a copy of the filter semantics — the drift this repository keeps
// paying for (four copies of the NDJSON reader, two definitions of the CSS
// detector) starts exactly here.

const nf = new Intl.NumberFormat("en-US");

const fold = (s) =>
  String(s == null ? "" : s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const asList = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
const hasFolded = (arr, want) => asList(arr).some((x) => fold(x) === want);

/**
 * One `key=value` term of a spec. Unknown keys throw rather than matching
 * nothing: a typo that silently returns 0 would put "0 Four Seasons Preferred
 * Partner properties" into published copy, which is worse than a red build.
 */
const TERMS = {
  program: (h, v) => fold(h.program) === v,
  brand: (h, v) => fold(h.brand) === v,
  chain: (h, v) => fold(h.chain) === v,
  category: (h, v) => fold(h.category) === v,
  country: (h, v) => fold(h.country) === v,
  city: (h, v) => fold(h.city) === v,
  region: (h, v) => fold(h.adminRegion) === v || fold(h.region) === v,
  propertyType: (h, v) => fold(h.propertyType) === v,
  experience: (h, v) => hasFolded(h.experiences, v),
  vibe: (h, v) => hasFolded(h.vibes, v),
  tag: (h, v) => hasFolded(h.tags, v),
  amenity: (h, v) => hasFolded(h.roomAmenities, v),
  // The name, matched at a word boundary — for families the feed does not brand
  // consistently ("Aman" has to cover Amanpuri, Amangiri and Amanzoe, which
  // carry no shared `brand` value).
  //
  // A plain `includes` was the first version and it was wrong in the quiet way:
  // "aman" also matched Salamander Middleburg, La Samanna and Las Alamandas,
  // so the page would have published 36 Amans and named 32. The value must
  // begin where a word does; it may still run past the end of one, which is
  // what catches Amanpuri and "The Ritz-Carlton Bacara" alike.
  name: (h, v) => new RegExp(`(^|[^a-z0-9])${escapeRe(v)}`).test(fold(h.name)),
  perks: (h, v) => (asList(h.vipUpgrades).length > 0) === (v !== "false"),
  promo: (h, v) => Boolean(h.hasPromotion) === (v !== "false"),
  sustainable: (h, v) => (asList(h.sustainability).length > 0) === (v !== "false"),
  supplier: (h, v) => fold(h.source) === v,
  roomsMin: (h, v) => Number.isFinite(h.numberOfRooms) && h.numberOfRooms >= Number(v),
  roomsMax: (h, v) => Number.isFinite(h.numberOfRooms) && h.numberOfRooms <= Number(v),
};

/**
 * The same idea over the journey artifact (data/atlas/shared/journey-facts.json).
 *
 * A separate table because the vocabularies genuinely differ: a hotel has a
 * programme and a category, a journey has an operator and a length, and folding
 * them into one namespace would mean `{{hotels:operator=…}}` silently matching
 * nothing. Short keys because 1,991 rows ship in the bundle — see the generator.
 */
const JOURNEY_TERMS = {
  collection: (j, v) => fold(j.c) === v,
  operator: (j, v) => fold(j.o) === v,
  country: (j, v) => hasFolded(j.co, v),
  region: (j, v) => hasFolded(j.r, v),
  vessel: (j, v) => hasFolded(j.v, v),
  title: (j, v) => new RegExp(`(^|[^a-z0-9])${escapeRe(v)}`).test(fold(j.t)),
  daysMin: (j, v) => Number.isFinite(j.d) && j.d >= Number(v),
  daysMax: (j, v) => Number.isFinite(j.d) && j.d <= Number(v),
  world: (j, v) => Boolean(j.w) === (v !== "false"),
  onDemand: (j, v) => Boolean(j.od) === (v !== "false"),
  promo: (j, v) => Boolean(j.p) === (v !== "false"),
};

/**
 * And over the villa feed, as lib/villas.js normalises it — so `priceMax` reads
 * the same published nightly rate a villa card shows, never the base rate
 * behind it, and a "Call for Pricing" villa has no price to be under.
 */
const VILLA_TERMS = {
  region: (v, x) => fold(v.region) === x,
  destination: (v, x) => fold(v.destination) === x,
  location: (v, x) => fold(v.location) === x,
  name: (v, x) => fold(v.name) === x,
  sleepsMin: (v, x) => Number.isFinite(v.sleeps) && v.sleeps >= Number(x),
  priceMax: (v, x) => Number.isFinite(v.nightlyFromUsd) && v.nightlyFromUsd <= Number(x),
  priced: (v, x) => Number.isFinite(v.nightlyFromUsd) === (x !== "false"),
};

export class UnknownFactTerm extends Error {}

/*
 * Supplier links inside answer prose.
 *
 *   {{op:cruise/Silversea}}                                   "Silversea", linked
 *   {{op:cruise/National Geographic-Lindblad Expeditions|Lindblad}}   "Lindblad", linked
 *   {{brand:Four Seasons}}                                    the hotel brand page
 *
 * The token names the supplier the way the feed does (the same name a
 * `{{departures:operator=…}}` token uses) and, after the bar, the words the
 * sentence wants. It never carries a URL: the path is looked up from the
 * supplier pages that actually exist at build, so a page that is retired, or
 * drops to a single itinerary and goes noindex, takes the link with it and the
 * sentence keeps its words.
 *
 * Plain resolution — every consumer that is not the answer page body: titles,
 * descriptions, JSON-LD, llms.txt, the /answers index — gets the words only.
 * Linked resolution wraps them in a marker that only components/AnswerProse
 * reads. The marker uses control characters, which no authored copy contains,
 * so it cannot collide with a bracket in a sentence; and because plain is the
 * default, a surface that forgets about links publishes text, not markers.
 */
const LINK_OPEN = "\u0001";
const LINK_MID = "\u0002";
const LINK_CLOSE = "\u0003";
export const LINK_MARK_RE = /\u0001([^\u0002]*)\u0002([^\u0003]*)\u0003/g;
const linkMark = (href, label) => `${LINK_OPEN}${href}${LINK_MID}${label}${LINK_CLOSE}`;
/** The words of every link marker, without the link. */
export const stripLinks = (text) =>
  typeof text === "string" ? text.replace(LINK_MARK_RE, (_m, _href, label) => label) : text;

/**
 * `"cruise/Silversea|the Silversea fleet"` -> its parts. Throws on a missing
 * collection or name: a malformed token is a typo, and a typo is a red build.
 */
export function parseSupplierToken(kind, arg) {
  const bar = arg.indexOf("|");
  const target = (bar < 0 ? arg : arg.slice(0, bar)).trim();
  const words = bar < 0 ? "" : arg.slice(bar + 1).trim();
  if (kind === "brand") {
    if (!target) throw new UnknownFactTerm(`{{brand:${arg}}} names no brand`);
    return { kind, collection: "hotel", name: target, label: words || target };
  }
  const slash = target.indexOf("/");
  const collection = slash < 0 ? "" : target.slice(0, slash).trim();
  const name = slash < 0 ? "" : target.slice(slash + 1).trim();
  if (!collection || !name) {
    throw new UnknownFactTerm(`{{op:${arg}}} must be written {{op:<collection>/<operator>|<words>}}`);
  }
  return { kind, collection, name, label: words || name };
}

/**
 * Entity and page links inside answer prose.
 *
 *   {{hotel:Claridge's}}                         "Claridge's", linked to its page
 *   {{hotel:Aman Kyoto|Aman's Kyoto forest}}     other words, same page
 *   {{hotel:The Oberoi Beach Resort@Hurghada}}   "@city" when a name repeats
 *   {{hotel:#<id>|Fonteverde}}                   by feed id, for a name with a "|"
 *   {{page:/hotels/italy|Italy's hotels}}        any page on the site
 *   {{villa:Loblolly@British Virgin Islands}}    a villa's detail page ("@destination")
 *
 * `hotel:` names the property exactly as the feed does (case and accents
 * folded), and the path is the entity page's own, so a renamed or retired
 * property fails the build rather than publishing a dead link. `page:` carries
 * a site path, which scripts/verify-seo.mjs checks with the same rules as an
 * answer's related links. Both resolve to plain words everywhere except the
 * answer page body, exactly like the supplier tokens above.
 */
export function parseLinkToken(kind, arg) {
  const bar = arg.indexOf("|");
  const target = (bar < 0 ? arg : arg.slice(0, bar)).trim();
  const words = bar < 0 ? "" : arg.slice(bar + 1).trim();
  if (kind === "page") {
    if (!target.startsWith("/")) throw new UnknownFactTerm(`{{page:${arg}}} must name a site path starting with "/"`);
    if (!words) throw new UnknownFactTerm(`{{page:${arg}}} needs words after a "|"`);
    return { kind, path: target, label: words };
  }
  const at = target.lastIndexOf("@");
  const name = (at < 0 ? target : target.slice(0, at)).trim();
  const city = at < 0 ? "" : target.slice(at + 1).trim();
  if (!name) throw new UnknownFactTerm(`{{${kind}:${arg}}} names no property`);
  if (target.startsWith("#")) {
    if (!words) throw new UnknownFactTerm(`{{hotel:${arg}}} needs words after a "|"`);
    return { kind, name: target, city: "", label: words };
  }
  return { kind, name, city, label: words || name };
}

/**
 * `"country=Italy&experience=Wellness"` -> a predicate. `"*"` matches all.
 *
 * A value containing an ampersand is percent-escaped, query-string style:
 * `operator=Abercrombie %26 Kent`. That is not decoration — `&` is the term
 * separator, so "Abercrombie & Kent" and "Ker & Downey" parsed as a term called
 * " Kent" and failed the build the first time they were written. Escaping is
 * the smallest fix that keeps the spec readable; the alternative was a second
 * separator nobody would remember.
 */
export function parseSpec(spec, terms = TERMS) {
  const raw = String(spec || "").trim();
  if (!raw || raw === "*") return () => true;
  const decode = (v) => {
    try {
      return decodeURIComponent(v);
    } catch {
      return v; // a stray % is a literal, not a parse error
    }
  };
  const tests = raw.split("&").map((part) => {
    const at = part.indexOf("=");
    if (at < 0) {
      throw new UnknownFactTerm(
        `term "${part}" is not key=value` +
          (part.trim() ? ' — an ampersand inside a value must be written %26' : ""),
      );
    }
    const key = part.slice(0, at).trim();
    const value = fold(decode(part.slice(at + 1)));
    const test = terms[key];
    if (!test) {
      throw new UnknownFactTerm(
        `unknown term "${key}" — known: ${Object.keys(terms).join(", ")}`,
      );
    }
    return (row) => test(row, value);
  });
  return (row) => tests.every((t) => t(row));
}

const SORTS = {
  name: (a, b) => String(a.name).localeCompare(String(b.name)),
  rooms: (a, b) => (b.numberOfRooms || 0) - (a.numberOfRooms || 0),
  smallest: (a, b) =>
    (a.numberOfRooms || Number.MAX_SAFE_INTEGER) -
    (b.numberOfRooms || Number.MAX_SAFE_INTEGER),
  perks: (a, b) => asList(b.vipUpgrades).length - asList(a.vipUpgrades).length,
};

/**
 * Bind the engine to a set of hotel rows and the collection totals.
 *
 * `collections` is `{ hotel: 2240, cruise: 3662, ... }` — the same figures
 * audit-listings.mjs already gates against lib/atlas-config.ts, so a token and
 * the home-page headline cannot drift apart either.
 */
export function makeFacts(hotels, collections = {}, journeys = [], villas = [], supplierHref = null) {
  const rows = Array.isArray(hotels) ? hotels : [];
  const journeyRows = Array.isArray(journeys) ? journeys : [];
  const villaRows = Array.isArray(villas) ? villas : [];

  function select(spec, { limit = 0, sort = "name" } = {}) {
    const match = parseSpec(spec);
    const out = rows.filter(match);
    const cmp = SORTS[sort];
    if (!cmp) throw new UnknownFactTerm(`unknown sort "${sort}"`);
    out.sort(cmp);
    return limit > 0 ? out.slice(0, limit) : out;
  }

  const count = (spec) => rows.filter(parseSpec(spec)).length;

  const JOURNEY_SORTS = {
    departures: (a, b) => b.n - a.n,
    days: (a, b) => (b.d || 0) - (a.d || 0),
    shortest: (a, b) => (a.d || Number.MAX_SAFE_INTEGER) - (b.d || Number.MAX_SAFE_INTEGER),
    title: (a, b) => String(a.t).localeCompare(String(b.t)),
  };

  function selectJourneys(spec, { limit = 0, sort = "departures" } = {}) {
    const match = parseSpec(spec, JOURNEY_TERMS);
    const out = journeyRows.filter(match);
    const cmp = JOURNEY_SORTS[sort];
    if (!cmp) throw new UnknownFactTerm(`unknown journey sort "${sort}"`);
    out.sort(cmp);
    return limit > 0 ? out.slice(0, limit) : out;
  }

  const countJourneys = (spec) => journeyRows.filter(parseSpec(spec, JOURNEY_TERMS)).length;

  /** Departures behind the matching itineraries, which is the other honest count. */
  const countDepartures = (spec) =>
    journeyRows.filter(parseSpec(spec, JOURNEY_TERMS)).reduce((n, j) => n + j.n, 0);

  const countVillas = (spec) => villaRows.filter(parseSpec(spec, VILLA_TERMS)).length;

  /**
   * The lowest published nightly rate among the matching villas. Throws when
   * none match — which is the point when the spec names one villa: a villa
   * the copy recommends that has left the feed fails the build instead of
   * staying on the page at last season's price.
   */
  function villaFrom(spec) {
    const rates = villaRows
      .filter(parseSpec(spec, VILLA_TERMS))
      .map((v) => v.nightlyFromUsd)
      .filter(Number.isFinite);
    if (!rates.length) throw new UnknownFactTerm(`no priced villa matches "${spec}"`);
    return `$${nf.format(Math.round(Math.min(...rates)))}`;
  }

  /**
   * The one property a `{{hotel:…}}` token names. Zero matches or two is a
   * thrown error: a sentence recommending a hotel that has left the feed, or
   * that could mean either of two, is not one to publish.
   */
  function hotelNamed({ name, city }) {
    if (name.startsWith("#")) {
      const byId = rows.find((h) => String(h.id) === name.slice(1).trim());
      if (byId) return byId;
      throw new UnknownFactTerm(`{{hotel:${name}}} matches no property id in the feed`);
    }
    const key = (x) => fold(x).replace(/[\u2018\u2019]/g, "'");
    const want = key(name);
    const where = key(city);
    const hits = rows.filter((h) => key(h.name) === want && (!where || key(h.city) === where));
    if (hits.length === 1) return hits[0];
    throw new UnknownFactTerm(
      hits.length
        ? `{{hotel:${name}}} matches ${hits.length} properties — add "@<city>"`
        : `{{hotel:${name}${city ? "@" + city : ""}}} matches no property in the feed`,
    );
  }

  /** The one villa a `{{villa:Name@Destination}}` token names; throws like hotelNamed. */
  function villaNamed({ name, city }) {
    const want = fold(name);
    const where = fold(city);
    const hits = villaRows.filter((v) => fold(v.name) === want && (!where || fold(v.destination) === where));
    if (hits.length === 1) return hits[0];
    throw new UnknownFactTerm(
      hits.length
        ? `{{villa:${name}}} matches ${hits.length} villas — add "@<destination>"`
        : `{{villa:${name}${city ? "@" + city : ""}}} matches no villa in the feed`,
    );
  }
  const villaHref = (v) => (v.destinationSlug && v.slug ? `/atlas/villa/${v.destinationSlug}/${v.slug}` : null);

  /**
   * Replace every `{{…}}` token in a string.
   *
   *   {{hotels:program=Marriott STARS}}   the count matching a spec
   *   {{collection:cruise}}               a collection's shipped total
   *   {{villas:region=Caribbean&sleepsMin=12}}   villas matching a spec
   *   {{villaFrom:name=Loblolly}}         lowest published nightly rate, "$728"
   *   {{op:cruise/Silversea|Silversea}}   supplier words, linked when `linked`
   *   {{brand:Aman}}                      (see parseSupplierToken above)
   *   {{hotel:Claridge's}}                a property, linked to its page
   *   {{page:/hotels/italy|Italy}}        any site page (see parseLinkToken)
   *   {{villa:Loblolly@British Virgin Islands}}   a villa, linked to its page
   *
   * An unresolvable token throws. The alternative — leaving `{{…}}` in the
   * rendered HTML — publishes the template to the crawler that was supposed to
   * cite it.
   *
   * `linked` turns supplier tokens into link markers for AnswerProse. It needs
   * the `supplierHref(kind, collection, name)` lookup passed to makeFacts; the
   * lookup returns the page's path, or null when there is no indexable page,
   * and then the words go out unlinked.
   */
  function resolve(text, { linked = false } = {}) {
    if (typeof text !== "string") return text;
    return text.replace(/\{\{([^}]+)\}\}/g, (_m, body) => {
      const at = String(body).indexOf(":");
      const kind = at < 0 ? String(body).trim() : body.slice(0, at).trim();
      const arg = at < 0 ? "" : body.slice(at + 1).trim();
      if (kind === "op" || kind === "brand") {
        const t = parseSupplierToken(kind, arg);
        const href = linked && supplierHref ? supplierHref(t.kind, t.collection, t.name) : null;
        return href ? linkMark(href, t.label) : t.label;
      }
      if (kind === "hotel" || kind === "page" || kind === "villa") {
        const t = parseLinkToken(kind, arg);
        const href =
          kind === "page" ? t.path : kind === "villa" ? villaHref(villaNamed(t)) : hotelNamed(t).path || null;
        return linked && href ? linkMark(href, t.label) : t.label;
      }
      if (kind === "hotels") return nf.format(count(arg));
      // Two journey tokens, because both numbers are true and they differ by a
      // factor of two and a half. `journeys:` counts ITINERARIES — pages, the
      // thing a reader browses. `departures:` counts sailing dates behind them.
      // Writing "3,662 expedition sailings" and linking to 902 pages is the
      // kind of near-miss that makes a page look wrong to someone checking.
      if (kind === "journeys") return nf.format(countJourneys(arg));
      if (kind === "departures") return nf.format(countDepartures(arg));
      if (kind === "villas") return nf.format(countVillas(arg));
      if (kind === "villaFrom") return villaFrom(arg);
      if (kind === "collection") {
        const n = collections[arg];
        if (!Number.isFinite(n)) {
          throw new UnknownFactTerm(`unknown collection "${arg}"`);
        }
        return nf.format(n);
      }
      throw new UnknownFactTerm(`unknown token kind "${kind}" in {{${body}}}`);
    });
  }

  /** Walk an answer record, resolving tokens in every string it renders. */
  function resolveDeep(node, opts) {
    if (typeof node === "string") return resolve(node, opts);
    if (Array.isArray(node)) return node.map((n) => resolveDeep(n, opts));
    if (node && typeof node === "object") {
      const out = {};
      for (const [k, v] of Object.entries(node)) out[k] = resolveDeep(v, opts);
      return out;
    }
    return node;
  }

  return {
    count, select, resolve, resolveDeep, hotelNamed, villaNamed,
    countJourneys, countDepartures, selectJourneys, countVillas, villaFrom,
    total: rows.length,
    totalJourneys: journeyRows.length,
  };
}
