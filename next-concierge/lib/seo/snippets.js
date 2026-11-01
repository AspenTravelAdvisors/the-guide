// Search-result titles and descriptions for the hotel and journey pages.
//
// Bing's own data (November 2026) is why this file exists. The Guide ranked
// between positions 2 and 7 for hundreds of searches naming a specific trip —
// "hx ultimate norway", "belmond paris to venice", "national geographic around
// the world by private jet" — and almost nobody clicked. The pages' titles were
// the trip's name and its operator, and their descriptions the supplier's own
// marketing copy, so in the results each one looked like a copy of the
// supplier's page sitting just below the supplier's page.
//
// A snippet has one job: say what this page has that the supplier's does not.
// For an itinerary that is every departure on one page, the date range and the
// offers running now; for a hotel, the amenities a booking through us carries.
// Every claim is read off the record, so a snippet cannot promise a perk the
// page does not show.
//
// Pure functions of a record, so they can be checked without loading a feed.

const DESC_MAX = 200;
/**
 * Roughly where Bing and Google cut a title off. Past it, what gets dropped is
 * the end — which is exactly the part that differs from the supplier's title —
 * so a long name is shortened before the suffix is.
 */
const TITLE_MAX = 76;

const clean = (s) =>
  String(s == null ? "" : s)
    .replace(/\s+/g, " ")
    .trim();

const fold = (s) =>
  clean(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Join sentences in order, stopping before the first that would pass `max`.
 * The first always goes in — cut at a word if it alone is too long — because a
 * description that drops its lead says nothing at all.
 */
function fit(parts, max = DESC_MAX) {
  const [lead, ...rest] = parts.filter(Boolean);
  if (!lead) return "";
  let out = lead.length > max ? `${lead.slice(0, max - 1).replace(/\s+\S*$/, "")}…` : lead;
  for (const p of rest) {
    const next = `${out} ${p}`;
    if (next.length > max) break;
    out = next;
  }
  return out;
}

/**
 * The part of a name before its subtitle, when there is one worth keeping.
 * `parens` also cuts at a parenthetical — right for a hotel ("Beverly Wilshire,
 * Beverly Hills (A Four Seasons Hotel)"), wrong for a voyage, where "(82 days)"
 * is what tells two versions of one route apart.
 */
const headOf = (name, parens = false) => {
  const head = name.split(parens ? /\s+[–—-]\s+|:\s+|\s+\(/ : /\s+[–—-]\s+|:\s+/)[0];
  return head.length >= 10 && head !== name ? head : null;
};

/**
 * Subtitle-less names that more than one itinerary shares. A title cut to one of
 * these would read the same on every page that shares it — Ponant runs dozens
 * of "Ocean Voyage – <A> to <B>", where the subtitle IS the trip — so those keep
 * their subtitles. Pass every title in the collection.
 */
export function sharedHeads(titles) {
  const seen = new Map();
  for (const t of titles) {
    const h = headOf(clean(t).replace(/\s*\(\d{4}\)$/, ""));
    if (h) seen.set(fold(h), (seen.get(fold(h)) || 0) + 1);
  }
  return new Set([...seen].filter(([, n]) => n > 1).map(([h]) => h));
}

/**
 * The first of `candidates` (most complete first) that leaves room for
 * `suffix`, or the shortest of them when none does.
 */
function shortName(candidates, suffix) {
  const room = TITLE_MAX - suffix.length;
  const list = [...new Set(candidates.filter(Boolean))];
  return list.find((c) => c.length <= room) || list.reduce((a, b) => (b.length < a.length ? b : a));
}

/** "HX Expeditions'", "Belmond's". */
const possessive = (s) => (/s$/i.test(s) ? `${s}'` : `${s}'s`);

/**
 * Whether a supplier promotion is meant for travelers. The Virtuoso feed also
 * carries offers addressed to advisors — "2% Bonus Commission" on 76 sailings,
 * "Enhanced Commission: 20% on rooms", an invitation for New York advisors —
 * which must never be shown to a traveler as an offer. Used by the hotel and
 * journey pages (lib/seo/hotels.js, lib/seo/journeys.js) and the snippets.
 */
export const isTravelerOffer = (p) =>
  !/commission|\badvisors?\b|\bagents?\b|incentive|\bfam\b/i.test(clean(p?.name));

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthYear = (iso) => {
  const m = /^(\d{4})-(\d{2})/.exec(iso || "");
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : "";
};

// ── hotels ──────────────────────────────────────────────────────────────────

/**
 * One amenity line, as a few words, or null for a line that does not reduce
 * to a plain promise. The feed's lines are nearly uniform ("Upgrade on arrival,
 * subject to availability", "$100 USD equivalent Food & Beverage credit…"), so
 * a handful of patterns cover almost every property; anything conditional —
 * "Stays of 7+ nights…", "Bookings in our Master Suites…" — is left to the
 * page, where it can be read with its condition.
 */
export function shortPerk(line) {
  const s = clean(line);
  if (/^upgrade/i.test(s) && !/not applicable/i.test(s)) return "room upgrade";
  if (/breakfast/i.test(s) && !/already included/i.test(s) && /^daily|^complimentary daily/i.test(s))
    return "daily breakfast";
  const credit = /^\$(\d[\d,]*)\s*(?:USD)?\s*(?:equivalent\s+)?(food\s*&\s*beverage|resort|spa|hotel|dining)?/i.exec(s);
  if (credit && /credit/i.test(s)) {
    const kind = (credit[2] || "").toLowerCase().replace(/\s*&\s*/, " & ");
    return `$${credit[1]} ${kind ? `${kind} ` : ""}credit`;
  }
  if (/early check-?in/i.test(s) && /late check-?out/i.test(s)) return "early check-in & late check-out";
  return null;
}

/** "Virtuoso", "Four Seasons Preferred Partner"; a parenthesised roster dropped. */
const programName = (p) => clean(p).replace(/\s*\(.*\)\s*$/, "");

export function hotelSnippet(h) {
  const name = clean(h.name);
  const city = clean(h.city);
  const place = city && !fold(name).includes(fold(city)) ? `${name}, ${city}` : name;
  const program = programName(h.program);
  /*
   * `hideAmenities` is the supplier's "hide amenities from consumers" flag. The
   * snippet names the programme but never lists what it includes for these.
   */
  const perks = h.hideAmenities
    ? []
    : [...new Set((h.vipUpgrades || []).map(shortPerk).filter(Boolean))];
  const year = h.perksYear && !h.perksStale ? `${h.perksYear} ` : "";
  const offers = (h.activeOffers || []).map((p) => clean(p.name)).filter(Boolean);

  const suffix = perks.length
    ? `: ${year}${program || "VIP"} perks`
    : program
      ? `: ${program} booking`
      : offers.length
        ? ": offers, rooms & booking"
        : ": rooms, map & booking";
  const head = headOf(name, true);
  const title = `${shortName([place, name, head && city ? `${head}, ${city}` : null, head], suffix)}${suffix}`;

  // A name that already says the city ("Beverly Wilshire, Beverly Hills") is
  // not followed by it again.
  const where = [fold(name).includes(fold(city)) ? null : city, clean(h.country)]
    .filter(Boolean)
    .join(", ");
  const description = fit([
    perks.length
      ? `Book ${name} through Aspen Travel Advisors for ${year}${program || "VIP"} amenities: ${perks.join(", ")}.`
      : program
        ? `${name}${where ? ` in ${where}` : ""}: a ${program} hotel, booked through Aspen Travel Advisors.`
        : `${name}${where ? ` in ${where}` : ""}, booked through Aspen Travel Advisors.`,
    offers.length === 1
      ? `Offer now: ${offers[0]}.`
      : offers.length > 1
        ? `${offers.length} offers now, including ${offers[0]}.`
        : null,
    "Rooms, the map and a 3D view on one page.",
  ]);
  return { title, description };
}

// ── journeys ────────────────────────────────────────────────────────────────

/**
 * `shared` is sharedHeads() over the itinerary's collection; without it no title
 * is cut to its head, which is always safe and only sometimes long.
 */
export function journeySnippet(j, { today = new Date(), shared = null } = {}) {
  // "Venice to Paris aboard the Venice Simplon-Orient Express (2026)": the year
  // belongs to a season, and the departures line says which ones are on sale.
  const title = clean(j.title).replace(/\s*\(\d{4}\)$/, "");
  const operator = clean(j.operator);
  const named = operator && !fold(title).includes(fold(operator)) ? `${title} (${operator})` : title;
  const from = today.toISOString().slice(0, 10);
  const future = (j.departures || [])
    .map((d) => d.startDate)
    .filter((d) => d && d >= from)
    .sort();
  const n = future.length;
  const y1 = future[0]?.slice(0, 4);
  const y2 = future[n - 1]?.slice(0, 4);
  const years = !n ? "" : y1 === y2 ? y1 : `${y1}–${y2.slice(2)}`;
  const offers = (j.promotions || []).map((p) => clean(p?.name)).filter(Boolean);
  const days = j.days ? `${j.days}-day ` : "";

  // On-demand journeys (most rail and tour programmes) have no dated
  // departures in the feed; the page says "On request" or the season window.
  const suffix = j.onDemand
    ? ": dates on request"
    : n > 1
      ? `: ${n} departures, ${years}`
      : n === 1
        ? `: ${monthYear(future[0])} departure`
        : `: ${days}itinerary, day by day`;
  // The operator stays as long as anything can: people search "hx ultimate
  // norway", so the title keeps "HX" before it keeps the subtitle.
  const cut = headOf(title);
  const head = cut && shared && !shared.has(fold(cut)) ? cut : null;
  const titleOut = `${shortName(
    [named, head && operator ? `${head} (${operator})` : null, title, head],
    suffix,
  )}${suffix}`;

  const whose = operator && operator !== title ? `${possessive(operator)} ` : "";
  const description = fit([
    j.onDemand
      ? `${whose}${days}${title}, on dates you request, with the day-by-day route on a map.`
      : n > 1
        ? `Every departure of ${whose}${days}${title} on one page: ${n} dates from ${monthYear(future[0])} to ${monthYear(future[n - 1])}, with the day-by-day route on a map.`
        : n === 1
          ? `${whose}${days}${title}, departing ${monthYear(future[0])}, with the day-by-day route on a map.`
          : `${whose}${days}${title}, day by day on a map. Ask an advisor for upcoming dates.`,
    offers.length ? `Offer${offers.length > 1 ? "s" : ""} now: ${offers.slice(0, 2).join("; ")}.` : null,
    "Planned and booked by Aspen Travel Advisors, a Virtuoso agency.",
  ]);
  return { title: titleOut, description };
}
