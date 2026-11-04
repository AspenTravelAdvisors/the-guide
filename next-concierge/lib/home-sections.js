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
 */
const SECTIONS = [
  {
    id: "hotels",
    collection: "hotel",
    label: "VIP Hotels",
    headline: "Kyoto in April is booked in winter",
    body: "The cherry trees along the Kamo River flower for about ten days, and the rooms that look onto them are spoken for months ahead. Spring in the Caribbean fills on the same calendar.",
    brand: "Four Seasons",
    hotelIds: ["h_00651", "h_02501", "h_00692", "h_00695", "h_00680"],
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
    id: "yachts",
    collection: "yacht",
    label: "Luxury Hotel Yachts",
    headline: "Three masts, fifty-four suites, harbours too small for ships",
    body: "Orient Express Corinthian raises her rigid sails off the Riviera in May. The harbours she uses cannot take a cruise ship, which is rather the point.",
    operator: "Orient Express Sailing Yachts",
    window: [6, 11],
    pins: [/^legendary rivieras/i, /^sailing the cyclades/i, /sicily and malta/i, /venice film festival/i, /coastal charms and glamour of spain/i],
    prefer: /riviera|cyclades|sicily|venice|spain/i,
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
    prefer: /sanctuary|migration|gorilla|victoria falls|grand safari/i,
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
    headline: "From one pole to the other, in fifty-four days",
    body: "The long voyages sell their best cabins a year and a half out. Most can be taken as a segment if a hundred days is more sea than you want.",
    operator: "Princess Cruises",
    window: [2, 20],
    pins: [/pole-to-pole/i, /north pacific – singapore to los angeles/i, /south pacific – los angeles to singapore/i, /world cruise – roundtrip ft/i],
    prefer: /pole|singapore|world cruise/i,
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
  // One row per distinct cleaned title: Belmond files "Paris to Venice" twice.
  const seen = new Set();
  return [...pinned, ...scored.filter((x) => !pinned.includes(x))
    .sort(
      (a, b) =>
        Number(b.preferred) - Number(a.preferred) ||
        (a.inWindow[0]?.startDate || "9999").localeCompare(b.inWindow[0]?.startDate || "9999") ||
        b.j.departures.length - a.j.departures.length,
    )]
    .filter((x) => {
      const k = cleanTitle(x.j.title).toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 5)
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

function operatorCard(op, s) {
  const facts = [];
  if (s.collection === "jet" && op.vesselFacts[0]) {
    facts.push(["Aircraft", op.vesselFacts[0].name]);
    if (op.vesselFacts[0].guests) facts.push(["Guests", String(op.vesselFacts[0].guests)]);
  } else {
    for (const v of op.vesselFacts.slice(0, 3)) facts.push([v.name, v.guests ? `${v.guests} guests` : v.detail || ""]);
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
 * The photo for a villa destination's tile: its highest-rate villa that has a
 * photo. Rated villas only, so "Call for Pricing" never wins by default; the
 * rate picks the picture and is never shown. Ties go to the larger house.
 */
function villaCover(slug) {
  const d = getVillaDestination(slug);
  const best = (d?.villas || [])
    .filter((v) => v.imageUrl && v.nightlyFromUsd)
    .sort((a, b) => b.nightlyFromUsd - a.nightlyFromUsd || (b.bedrooms || 0) - (a.bedrooms || 0))[0];
  return best
    ? { photo: best.imageUrl, pictured: [best.name, best.location].filter(Boolean).join(", "), count: d.count }
    : { photo: null, pictured: null, count: d?.count || 0 };
}

/** The resolved sections, in page order. A section with nothing to show is dropped. */
/** @returns {any[]} */
export function homeSections() {
  return SECTIONS.map((s) => {
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
      const { rows, card } = hotelSection(s);
      return rows.length ? { ...base, rows, card } : null;
    }
    if (s.collection === "villa") {
      return {
        ...base,
        destinations: s.destinations.map(([slug, name]) => ({ name, href: `/villas/${slug}`, ...villaCover(slug) })),
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
    const rows = journeyRows(op, s);
    return rows.length ? { ...base, rows, card: operatorCard(op, s) } : null;
  }).filter(Boolean);
}

/** @returns {any[]} */
export function homeQuestions() {
  return QUESTIONS.map(([tag, slug]) => {
    const a = answer(slug);
    return a ? { ...a, tag } : null;
  }).filter(Boolean);
}
