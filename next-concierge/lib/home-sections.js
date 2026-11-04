// The long homepage's editorial sections, resolved from the live feeds.
//
// The homepage used to be one screen: The Guide over the globe. Real traffic
// (with the two bot weeks of September and October removed) showed most
// visitors arriving on deep pages and very few reaching an advisor, and Bing
// showed people searching by operator. So below the globe the page now reads
// like a magazine: one section per collection, each led by the operator people
// search for, with that operator's itineraries that depart inside the
// collection's booking window.
//
// What is edited by hand is only the editorial layer below: the order, the
// operator, the headline, two sentences, and the booking window. The trips
// themselves are picked from the feed at build time by those rules, so they
// restock with the nightly sync instead of going stale on the page.
//
// REVIEW THIS FILE MONTHLY, with the curated-jet refresh. The headlines are
// seasonal ("Kyoto in April is booked in winter") and are the one part that can
// age. EDITION below is shown on the page, so a stale edition is visible.
//
// Server-only: reads every feed through lib/seo/suppliers.js.

import http from "node:http";
import https from "node:https";
import { getJourneyOperator, getHotelBrand, fmtDay, fmtMonth, regionName } from "@/lib/seo/suppliers";
import { getHotelById } from "@/lib/seo/hotels";
import { slugify } from "@/lib/seo/journey-key.mjs";
import { ALL_ANSWERS } from "@/lib/answers";
import { getVillaDestination } from "@/lib/seo/villas";

export const EDITION = {
  label: "Winter 2026–27",
  reviewed: "2026-11-04",
  season:
    "The best of next year is being spoken for now. Polar ships sell from the smallest cabins up, the camps along the Mara fill for August, and a private jet around the world carries fewer than a hundred guests. What follows is what we would book this winter, collection by collection.",
};

/**
 * Order mostly follows atlas visits 12 Oct – 4 Nov 2026, bot weeks excluded:
 * hotels 825, jets 711, safari 282, expedition 268, then villas, world
 * cruises 88, yachts 82, rail 28. The exception is yachts, placed third by
 * choice to sit with hotels and jets: a hotel yacht is the hotel traveler's
 * way onto the water, and it is a product we want seen, not one the traffic
 * has found yet.
 *
 * `window` is months from today in which a departure makes an itinerary
 * eligible; itineraries sold on dates you choose are always eligible.
 * `pins` are the products the headline and Bing searches name ("a&k
 * sanctuary", "pole to pole", "paris to venice"), shown first and in that
 * order while they are eligible. A pin whose product has sold out or left the
 * feed simply matches nothing; `prefer` and the date order fill its place.
 *
 * Every row carries its own photograph, or it is not shown. A magazine does
 * not print placeholders, so a candidate is passed over when it has no photo,
 * when its photo is already used higher in the section (feeds file many
 * itineraries under one brochure image), or when the photo host answers the
 * build's check with an error. The next candidate takes its place. A section
 * can therefore show fewer than ROWS when its operator has fewer photos than
 * that (Ritz-Carlton has one per yacht).
 */
const SECTIONS = [
  {
    id: "hotels",
    collection: "hotel",
    label: "VIP Hotels",
    headline: "Kyoto in April is booked in winter",
    body: "The cherry trees along the Kamo River flower for about ten days, and the rooms that look onto them are spoken for months ahead. Spring in the Caribbean fills on the same calendar.",
    brand: "Four Seasons",
    // Nevis has no photo in the feed today; The Ocean Club is the spare that
    // takes its place until it does. See ROWS.
    hotelIds: ["h_00651", "h_02501", "h_00692", "h_00695", "h_00680", "h_02088"],
    answers: ["four-seasons-preferred-partner-benefits"],
  },
  {
    id: "jets",
    collection: "jet",
    label: "Private Jet Expeditions",
    headline: "Twenty-five days, one seat, the same plane every morning",
    body: "You unpack once. The jet waits on the apron while you are at Petra or on Easter Island, and the next continent is a long lunch away.",
    operator: "National Geographic",
    window: [1, 24],
    answers: ["private-jet-journeys-explained"],
  },
  {
    // Ritz-Carlton, not Orient Express: the largest hotel-yacht programme on
    // the atlas (255 sailings to Orient Express's 91) and the only one whose
    // sailings carry Virtuoso offers. The feed has one photo per yacht, so
    // the one-photo-per-row rule shows one voyage per yacht. Ilma's and
    // Luminara's photos are the yachts at sea and suit any voyage; Evrima's
    // is the Pitons of St Lucia, so Evrima's row is her October crossing to
    // the Caribbean (which is why the window runs to 12), not the Riviera.
    id: "yachts",
    collection: "yacht",
    label: "Luxury Hotel Yachts",
    headline: "A Ritz-Carlton that docks in Monte Carlo",
    body: "Three yachts of 298 to 452 guests, each with a marina at the stern: Ilma on the Riviera next summer, Luminara in Alaska, and Evrima crossing to the Caribbean for the winter. Booked through Aspen, every sailing carries a Virtuoso offer, most often a $300 onboard experience.",
    operator: "Ritz-Carlton Yacht Collection",
    window: [6, 12],
    pins: [/^monte carlo to monte carlo/i, /^whittier to vancouver/i, /^lisbon to san juan/i],
    prefer: /^(monte carlo to monte carlo|whittier to vancouver|lisbon to san juan|venice to athens)/i,
    answers: ["ritz-carlton-vs-four-seasons-vs-orient-express-vs-aman-yachts"],
  },
  {
    id: "safari",
    collection: "safari",
    label: "Safari Journeys",
    headline: "The dry season is already being spoken for",
    body: "July to September, when the grass is short and the Mara River becomes a crossing point, is when the best camps fill. Most of them fill a year ahead.",
    operator: "Abercrombie & Kent",
    window: [6, 14],
    pins: [/sanctuary great migration/i, /sanctuary botswana safari and victoria/i, /sanctuary gorilla trekking in uganda/i, /sanctuary tanzania and kenya wildlife/i, /grand safari in southern africa/i],
    prefer: /migration|gorilla|victoria falls|grand safari|kenya|tanzania|botswana/i,
    answers: ["which-safari-operator-should-you-book", "best-time-to-see-the-great-migration-month-by-month"],
  },
  {
    id: "expedition",
    collection: "cruise",
    label: "Expedition Cruises",
    headline: "Greenland next summer, Antarctica the season after",
    body: "Polar ships sell from the top deck down, and the small ones first. The Arctic summer and the next Antarctic season are both open.",
    operator: "HX Expeditions",
    window: [7, 16],
    pins: [/grand greenland – mythical/i, /^circumnavigating svalbard$/i, /northwest passage – across/i, /highlights of antarctica/i, /^ultimate norway – arctic/i],
    prefer: /greenland|svalbard|northwest passage|antarctica|ultimate norway/i,
    answers: ["best-arctic-expedition-svalbard-greenland-northwest-passage", "best-antarctica-expedition-for-first-timers"],
  },
  {
    id: "villas",
    collection: "villa",
    label: "Private Villas",
    headline: "A summer villa is a winter decision",
    body: "The houses that sleep twelve with the water below them go first, usually by the end of January. These are the places our travelers ask for most.",
    destinations: [
      ["st-barthelemy", "St Barthélemy"], ["italy", "Italy"], ["france", "France"], ["greece", "Greece"],
      ["turks-caicos", "Turks & Caicos"], ["hawaii", "Hawaii"], ["spain", "Spain"], ["croatia", "Croatia"],
      ["los-cabos", "Los Cabos"], ["anguilla", "Anguilla"],
    ],
    answers: ["best-caribbean-villas-for-12-guests"],
  },
  {
    id: "world",
    collection: "worldcruise",
    label: "World Cruises",
    // Seabourn, not Princess: the most world-cruise sailings on the atlas (84)
    // and a line that fits the rest of the page. Its own Pole to Pole keeps
    // the Bing "pole to pole" searches answered. One photo per ship in the
    // feed, so up to four rows: Venture, Pursuit, Quest and Encore.
    headline: "From one pole to the other, in ninety-five days",
    body: "Seabourn Venture leaves Reykjavík next August for Greenland and the Northwest Passage, then sails south by the Caribbean and Brazil to South Georgia, with 264 guests and two submarines aboard. The long voyages sell their best suites a year and a half out, and most can be taken as a shorter segment.",
    operator: "Seabourn",
    window: [2, 20],
    pins: [/pole to pole/i, /^across three continents/i, /^cape to cape world cruise – miami to southampton/i, /^in-depth japan exploration/i],
    prefer: /pole|three continents|world cruise|japan/i,
    answers: ["world-cruise-segments-explained", "world-cruises-compared"],
  },
  {
    id: "rail",
    collection: "train",
    label: "Rail Journeys",
    headline: "Paris to Venice overnight, in a carriage from the 1920s",
    body: "Dinner is black tie if you want it to be, and the Alps go by at breakfast. Belmond runs four of the great trains.",
    operator: "Belmond Trains",
    window: [1, 18],
    pins: [/^paris to venice/i, /^paris to istanbul/i, /^grand tour of scotland/i, /^tiger express/i, /^wales,/i],
    prefer: /paris to venice|paris to istanbul|grand tour|tiger|wales/i,
    answers: ["venice-simplon-orient-express-worth-it", "best-luxury-train-journeys"],
  },
];

const QUESTIONS = [
  ["Jets", "private-jet-journeys-explained"],
  ["Hotels", "four-seasons-preferred-partner-benefits"],
  ["Expedition", "best-arctic-expedition-svalbard-greenland-northwest-passage"],
  ["Safari", "which-safari-operator-should-you-book"],
  ["Rail", "rocky-mountaineer-vs-via-rail-canadian"],
  ["Expedition", "galapagos-lindblad-vs-silversea-vs-aqua"],
  ["World cruises", "world-cruise-segments-explained"],
  ["Expedition", "polar-bear-trip-svalbard-vs-churchill"],
  ["Booking", "virtuoso-perks-vs-booking-direct"],
  ["Rail", "venice-simplon-orient-express-worth-it"],
];

/** Rows per section, at most. */
const ROWS = 5;

/*
 * Does this photo URL answer with an image? Asked once per URL per build (the
 * static prerender) with a HEAD request; all three photo hosts in the feeds
 * (Virtuoso, National Geographic, the villa supplier) answer HEAD.
 *
 * node:https rather than fetch, on purpose: Next patches fetch, and an
 * uncached fetch here would take the homepage out of static prerendering.
 *
 * Only a definite answer removes a photo: an error status or a page that is
 * not an image. A timeout or a network failure keeps it (true), so a slow
 * host during one build cannot empty the page; HomeThumb hides the row in
 * the browser if the photo really is gone.
 */
const photoChecks = new Map();
function photoWorks(url) {
  if (!photoChecks.has(url)) photoChecks.set(url, headImage(url, 2));
  return photoChecks.get(url);
}
function headImage(url, redirects) {
  const { request } = url.startsWith("http:") ? http : https;
  return new Promise((resolve) => {
    let req;
    try {
      req = request(url, { method: "HEAD", timeout: 6000, headers: { "user-agent": "Mozilla/5.0 (The Guide photo check)" } }, (res) => {
        res.resume();
        const { statusCode: code = 0, headers } = res;
        if (code >= 300 && code < 400 && headers.location && redirects > 0) {
          resolve(headImage(new URL(headers.location, url).href, redirects - 1));
        } else if (code >= 400) {
          resolve(false);
        } else {
          resolve(code >= 200 && code < 300 ? /^image\//i.test(String(headers["content-type"] || "image/")) : true);
        }
      });
    } catch {
      return resolve(true);
    }
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(true));
    req.end();
  });
}

/**
 * The first `n` candidates, in order, that have a photo of their own that
 * works. `photo` reads a candidate's photo URL.
 * @template T
 * @param {T[]} candidates
 * @param {(c: T) => string | null | undefined} photo
 * @param {number} n
 * @returns {Promise<T[]>}
 */
async function withOwnPhotos(candidates, photo, n) {
  const urls = [...new Set(candidates.map(photo).filter(Boolean))];
  const ok = new Map(await Promise.all(urls.map(async (u) => [u, await photoWorks(u)])));
  const used = new Set();
  const out = [];
  for (const c of candidates) {
    const u = photo(c);
    if (!u || used.has(u) || !ok.get(u)) continue;
    used.add(u);
    out.push(c);
    if (out.length === n) break;
  }
  return out;
}

const answer = (slug) => {
  const a = ALL_ANSWERS.find((x) => x.slug === slug);
  return a ? { slug, href: `/answers/${slug}`, text: a.question || a.title } : null;
};

const isoPlusMonths = (n) => {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};

const cleanTitle = (s) =>
  String(s)
    .replace(/\s*\(\d+ (days|nights)\)$/i, "")
    .replace(/, a Belmond Train$/i, "")
    .replace(/, (Venice Simplon-Orient-Express|Royal Scotsman|Eastern & Oriental Express|Britannic Explorer)$/i, "");

/** @returns {any[]} */
function journeyRows(op, s) {
  const from = isoPlusMonths(s.window[0]);
  const to = isoPlusMonths(s.window[1]);
  const scored = op.itineraries
    .map((j) => {
      const inWindow = j.departures.filter((d) => d.startDate && d.startDate >= from && d.startDate <= to);
      const eligible = j.onDemand || inWindow.length > 0;
      return { j, inWindow, eligible, preferred: s.prefer ? s.prefer.test(j.title) : false };
    })
    .filter((x) => x.eligible);
  // Pinned products first, in pin order, each at its earliest eligible date.
  const byDate = (a, b) => (a.inWindow[0]?.startDate || "9999").localeCompare(b.inWindow[0]?.startDate || "9999");
  const pinned = [];
  for (const re of s.pins || []) {
    const hit = scored.filter((x) => re.test(x.j.title) && !pinned.includes(x)).sort(byDate)[0];
    if (hit) pinned.push(hit);
  }
  // After the pins, only what `prefer` names: a row that has left the
  // section's story (an Amazon cruise under the Mara headline) reads worse
  // than one row fewer, and the photo rule can now leave slots to fill.
  // One row per distinct cleaned title: Belmond files "Paris to Venice" twice,
  // and "Wales" again as "Wales (Autumn)".
  const seen = new Set();
  return [...pinned, ...scored.filter((x) => !pinned.includes(x) && (!s.prefer || x.preferred))
    .sort(
      (a, b) =>
        Number(b.preferred) - Number(a.preferred) ||
        (a.inWindow[0]?.startDate || "9999").localeCompare(b.inWindow[0]?.startDate || "9999") ||
        b.j.departures.length - a.j.departures.length,
    )]
    .filter((x) => {
      const k = cleanTitle(x.j.title).replace(/\s*\((spring|summer|autumn|fall|winter)\)$/i, "").toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map(({ j, inWindow }) => ({
      title: cleanTitle(j.title),
      href: j.path,
      thumb: j.thumb,
      meta: [j.days ? `${j.days} days` : null, j.vessels[0] || j.countries[0] || (j.regions[0] ? regionName(s.collection, j.regions[0]) : null)]
        .filter(Boolean)
        .join(" · "),
      when: j.onDemand
        ? { main: "Your dates", sub: null }
        : { main: fmtDay(inWindow[0].startDate), sub: inWindow.length > 1 ? `${inWindow.length} departures` : null },
      ask: `Tell me about ${cleanTitle(j.title)} with ${op.name}. Which departure would suit me?`,
    }));
}

function operatorCard(op, s, rows) {
  const facts = [];
  // The ships the rows sail on come first, in row order, so the card names
  // the ship in the lead story (Seabourn Venture) rather than the first three
  // in the facts file.
  const shown = (v) => {
    const i = rows.findIndex((r) => r.meta.includes(v.name));
    return i < 0 ? rows.length : i;
  };
  const vessels = [...op.vesselFacts].sort((a, b) => shown(a) - shown(b));
  if (s.collection === "jet" && op.vesselFacts[0]) {
    facts.push(["Aircraft", op.vesselFacts[0].name]);
    if (op.vesselFacts[0].guests) facts.push(["Guests", String(op.vesselFacts[0].guests)]);
  } else {
    for (const v of vessels.slice(0, 3)) facts.push([v.name, v.guests ? `${v.guests} guests` : v.detail || ""]);
  }
  facts.push(["On the atlas", `${op.itineraries.length} itineraries${op.departures.length ? ` · ${op.departures.length} departures` : ""}`]);
  if (op.firstDate) facts.push(["Dates", `${fmtMonth(op.firstDate)} to ${fmtMonth(op.lastDate)}`]);
  return {
    eyebrow: "Featured operator",
    name: op.name,
    text: op.profile?.summary || null,
    facts,
    cta: { label: `Every ${op.name} departure`, href: op.path },
  };
}

function hotelSection(s) {
  const b = getHotelBrand(slugify(s.brand));
  const rows = (s.hotelIds || [])
    .map(getHotelById)
    .filter(Boolean)
    .map((h) => ({
      title: h.name,
      href: h.path,
      thumb: h.thumb,
      meta: [`${h.city ? `${h.city}, ` : ""}${h.country}`, h.program].filter(Boolean).join(" · "),
      when: h.perksYear ? { main: `${h.perksYear} amenities`, sub: null } : null,
      ask: `Tell me about ${h.name}. What does Aspen add, and when is it best?`,
    }));
  return {
    rows,
    card: b && {
      eyebrow: b.programs[0] ? `Featured brand · ${b.programs[0].name}` : "Featured brand",
      name: b.name,
      text: `${b.hotels.length} ${b.name} properties on the atlas. Booked through Aspen, each stay carries the same extras on top of the rate.`,
      perks: b.amenities.slice(0, 4).map((a) => a.text),
      facts: [],
      cta: { label: `All ${b.hotels.length} ${b.name} hotels`, href: b.path },
    },
  };
}

/**
 * The photo for a villa destination's tile: its highest-rate villa whose
 * photo works. Rated villas only, so "Call for Pricing" never wins by default;
 * the rate picks the picture and is never shown. Ties go to the larger house.
 * A destination with no working photo is left off the page.
 */
async function villaCover(slug) {
  const d = getVillaDestination(slug);
  const ranked = (d?.villas || [])
    .filter((v) => v.imageUrl && v.nightlyFromUsd)
    .sort((a, b) => b.nightlyFromUsd - a.nightlyFromUsd || (b.bedrooms || 0) - (a.bedrooms || 0))
    .slice(0, 4);
  for (const v of ranked) {
    if (await photoWorks(v.imageUrl)) {
      return { photo: v.imageUrl, pictured: [v.name, v.location].filter(Boolean).join(", "), count: d.count };
    }
  }
  return null;
}

/** The resolved sections, in page order. A section with nothing to show is dropped. */
/** @returns {Promise<any[]>} */
export async function homeSections() {
  const sections = await Promise.all(SECTIONS.map(async (s) => {
    const base = {
      id: s.id,
      collection: s.collection,
      label: s.label,
      headline: s.headline,
      body: s.body,
      atlas: `/atlas/${s.collection}`,
      answers: (s.answers || []).map(answer).filter(Boolean),
    };
    if (s.collection === "hotel") {
      const { rows: all, card } = hotelSection(s);
      const rows = await withOwnPhotos(all, (r) => r.thumb, ROWS);
      return rows.length ? { ...base, rows, card } : null;
    }
    if (s.collection === "villa") {
      const covers = await Promise.all(s.destinations.map(([slug]) => villaCover(slug)));
      return {
        ...base,
        destinations: s.destinations
          .map(([slug, name], i) => covers[i] && { name, href: `/villas/${slug}`, ...covers[i] })
          .filter(Boolean),
        card: {
          eyebrow: "Start here",
          name: "Villas by destination",
          text: "Every villa has its bedroom count, its setting and what the house includes.",
          facts: [],
          cta: { label: "All villas", href: "/villas" },
        },
      };
    }
    const op = getJourneyOperator(s.collection, slugify(s.operator));
    if (!op) return null;
    const rows = await withOwnPhotos(journeyRows(op, s), (r) => r.thumb, ROWS);
    return rows.length ? { ...base, rows, card: operatorCard(op, s, rows) } : null;
  }));
  return sections.filter(Boolean);
}

/** @returns {any[]} */
export function homeQuestions() {
  return QUESTIONS.map(([tag, slug]) => {
    const a = answer(slug);
    return a ? { ...a, tag } : null;
  }).filter(Boolean);
}
