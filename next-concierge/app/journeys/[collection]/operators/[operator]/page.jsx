// /journeys/[collection]/operators/[operator] — everything one operator runs in
// one collection: its itineraries, every upcoming departure, its ships or
// aircraft, a route map, and how it compares with the others.
//
// The reason and the rules are in lib/seo/suppliers.js. Static for the same
// reason as the itinerary pages: it resolves from committed JSON, so it is the
// same bytes on every request until the next deploy.

import Link from "next/link";
import { notFound } from "next/navigation";
import { collectionMeta } from "@/lib/seo/journeys";
import {
  journeyOperators,
  getJourneyOperator,
  journeyOperatorParams,
  fmtDay,
  fmtMonth,
  yearSpan,
  regionName,
} from "@/lib/seo/suppliers";
import { ALL_ANSWERS, SITE_URL } from "@/lib/answers";
import { orgRef } from "@/lib/seo/site";
import { jsonLd } from "@/lib/seo/json-ld";
import SiteFooter from "@/components/SiteFooter";
import SupplierMap from "@/components/SupplierMap";
import AnswerAdvisorCta from "@/components/AnswerAdvisorCta";

export const revalidate = false;
export const dynamicParams = false;

export function generateStaticParams() {
  return journeyOperatorParams();
}

const nf = new Intl.NumberFormat("en-US");
const plural = (n, one, many) => `${nf.format(n)} ${n === 1 ? one : many}`;

/** The explainers worth linking from each collection's operator pages. */
const COLLECTION_ANSWERS = {
  jet: ["private-jet-journeys-explained"],
  cruise: [
    "best-antarctica-expedition-for-first-timers",
    "best-arctic-expedition-svalbard-greenland-northwest-passage",
    "ponant-vs-lindblad-vs-silversea-expeditions",
    "galapagos-lindblad-vs-silversea-vs-aqua",
    "which-expedition-ships-have-the-highest-guide-ratio",
  ],
  worldcruise: ["world-cruises-compared", "world-cruise-segments-explained"],
  yacht: ["ritz-carlton-vs-four-seasons-vs-orient-express-vs-aman-yachts", "yacht-charter-vs-luxury-yacht-cruise"],
  train: ["best-luxury-train-journeys", "venice-simplon-orient-express-worth-it", "rocky-mountaineer-vs-via-rail-canadian"],
  safari: [
    "which-safari-operator-should-you-book",
    "botswana-vs-kenya-vs-south-africa-first-safari",
    "best-time-to-see-the-great-migration-month-by-month",
    "gorilla-trekking-rwanda-vs-uganda",
  ],
};

/** What the operator's "vessel" is called in each collection. */
const VESSEL_WORD = { jet: "Aircraft", train: "Trains", safari: null, cruise: "Ships", worldcruise: "Ships", yacht: "Yachts" };

function dateSpan(op) {
  if (!op.firstDate) return op.onRequest ? "On request" : null;
  const a = fmtMonth(op.firstDate);
  const b = fmtMonth(op.lastDate);
  return a === b ? a : `${a} to ${b}`;
}

function lengthSpan(op) {
  if (op.minDays == null) return null;
  return op.minDays === op.maxDays ? `${op.minDays} days` : `${op.minDays} to ${op.maxDays} days`;
}

export async function generateMetadata({ params }) {
  const { collection, operator } = await params;
  const op = getJourneyOperator(collection, operator);
  const meta = collectionMeta(collection);
  if (!op || !meta) return {};
  const span = yearSpan(op.firstDate, op.lastDate);
  const title = `${op.name} ${meta.label.toLowerCase()}: ${plural(op.itineraries.length, "itinerary", "itineraries")}${
    op.departures.length ? `, ${plural(op.departures.length, "departure", "departures")}${span ? ` ${span}` : ""}` : ""
  }`;
  const description = [
    `Every ${op.name} ${meta.noun} in the atlas on one page`,
    op.departures.length ? `with ${plural(op.departures.length, "departure", "departures")} from ${fmtMonth(op.firstDate)}` : null,
    lengthSpan(op),
    op.vesselFacts[0]?.guests ? `${op.vesselFacts[0].guests} guests` : null,
  ]
    .filter(Boolean)
    .join(", ")
    .concat(". Route maps, dates and how it compares. Book with Aspen Travel Advisors.");
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}${op.path}` },
    robots: op.indexable ? undefined : { index: false, follow: true },
    openGraph: { title, description, type: "website", url: `${SITE_URL}${op.path}` },
  };
}

export default async function OperatorPage({ params }) {
  const { collection, operator } = await params;
  const op = getJourneyOperator(collection, operator);
  const meta = collectionMeta(collection);
  if (!op || !meta) notFound();

  const url = `${SITE_URL}${op.path}`;
  const span = dateSpan(op);
  const length = lengthSpan(op);
  const vesselWord = VESSEL_WORD[collection];
  const topRegions = op.regions.slice(0, 4).map((r) => r.name);
  const topCountries = op.countries.slice(0, 6).map((c) => c.name);
  const answers = (COLLECTION_ANSWERS[collection] || [])
    .map((slug) => ALL_ANSWERS.find((a) => a.slug === slug))
    .filter(Boolean);
  const askHref = `/?ask=${encodeURIComponent(`Which ${op.name} ${meta.noun} would suit me, and when does it depart?`)}`;

  // The map: the routes with the soonest departures, simplified, so a large
  // fleet still renders as a readable page rather than a megabyte of SVG.
  const mapped = op.itineraries.filter((j) => j.geometry.length > 1 || j.stops.filter((s) => s.at).length > 1).slice(0, 24);
  const thin = (pts) => {
    const step = Math.max(1, Math.ceil(pts.length / 160));
    return pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
  };
  const lines = mapped.map((j) => ({
    label: j.title,
    points: thin(j.geometry.length > 1 ? j.geometry : j.stops.filter((s) => s.at).map((s) => s.at)),
  }));
  const dotsSeen = new Set();
  const dots = [];
  for (const j of mapped.slice(0, 12)) {
    for (const s of j.stops) {
      if (!s.at || dotsSeen.has(s.name)) continue;
      dotsSeen.add(s.name);
      dots.push({ at: s.at, label: s.name });
    }
  }

  const others = journeyOperators(collection)
    .filter((o) => o.slug !== op.slug)
    .sort((a, b) => b.itineraries.length - a.itineraries.length)
    .slice(0, 12);

  const faq = [
    {
      q: `How many ${op.name} ${meta.nounPlural} are there?`,
      a: `The atlas holds ${plural(op.itineraries.length, meta.noun, meta.nounPlural)} from ${op.name}${
        op.departures.length ? `, with ${plural(op.departures.length, "departure", "departures")} listed` : ""
      }${op.onRequest ? `${op.departures.length ? " and" : ","} ${plural(op.onRequest, "itinerary", "itineraries")} running on dates you choose` : ""}.`,
    },
    op.firstDate && {
      q: `When do ${op.name} departures run?`,
      a: `The listed departures run from ${fmtDay(op.firstDate)} to ${fmtDay(op.lastDate)}. Dates come from the supplier feed and are refreshed nightly; an advisor confirms availability before anything is held.`,
    },
    length && {
      q: `How long are ${op.name} ${meta.nounPlural}?`,
      a: `${length}.${topRegions.length ? ` Most of them visit ${topRegions.join(", ")}.` : ""}`,
    },
    op.vesselFacts.length > 0 && {
      q: collection === "jet" ? `What aircraft does ${op.name} fly?` : `Which ${vesselWord ? vesselWord.toLowerCase() : "vessels"} does ${op.name} use?`,
      a: op.vesselFacts
        .slice(0, 4)
        .map((v) => `${v.name}${v.guests ? `, ${v.guests} guests` : ""}`)
        .join("; ")
        .concat(". Capacities are the published configuration and can change by departure."),
    },
    {
      q: `How much does a ${op.name} ${meta.noun} cost?`,
      a: `Prices are set per departure and change with the season and the cabin. The Guide holds no rates, so nothing on this page is a price. An Aspen Travel Advisors advisor quotes the current fare for your dates and tells you what booking through Aspen adds.`,
    },
    {
      q: `How do I book ${op.name}?`,
      a: `Through Aspen Travel Advisors. Your advisor checks availability on the departure you want, arranges the flights and the nights before and after, and stays your contact while you travel.`,
    },
  ].filter(Boolean);

  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": `${url}#page`,
      url,
      name: `${op.name} ${meta.label}`,
      publisher: orgRef(),
      about: { "@type": "Organization", name: op.name },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: op.itineraries.length,
        itemListElement: op.itineraries.map((j, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: { "@type": "TouristTrip", "@id": `${SITE_URL}${j.path}#trip`, name: j.title, url: `${SITE_URL}${j.path}` },
        })),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Journeys", item: `${SITE_URL}/journeys` },
        { "@type": "ListItem", position: 2, name: meta.label, item: `${SITE_URL}/journeys/${collection}` },
        { "@type": "ListItem", position: 3, name: op.name, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];

  return (
    <article className="answers-wrap answers-article supplier-page">
      {ld.map((node, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(node) }} />
      ))}

      <nav className="answers-crumbs">
        <Link href="/journeys">Journeys</Link>
        <span aria-hidden="true"> / </span>
        <Link href={`/journeys/${collection}`}>{meta.label}</Link>
        <span aria-hidden="true"> / </span>
        <span>{op.name}</span>
      </nav>

      <header className="supplier-head">
        <p className="supplier-eyebrow">{meta.label}</p>
        <h1>{op.name}</h1>
        <p className="supplier-sub">
          {[plural(op.itineraries.length, "itinerary", "itineraries"), op.departures.length ? plural(op.departures.length, "departure", "departures") : null, span]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      <div className="answers-lead">
        <p>
          {op.profile?.summary ? `${op.profile.summary} ` : ""}
          The atlas holds {plural(op.itineraries.length, meta.noun, meta.nounPlural)} from {op.name}
          {op.departures.length
            ? `, with ${plural(op.departures.length, "departure", "departures")} listed from ${fmtMonth(op.firstDate)} to ${fmtMonth(op.lastDate)}`
            : ""}
          {op.onRequest ? `${op.departures.length ? ", and" : ","} ${plural(op.onRequest, "itinerary", "itineraries")} on dates you choose` : ""}.
          {length ? ` They run ${length}.` : ""}
          {topRegions.length ? ` Most visit ${topRegions.join(", ")}.` : ""}
        </p>
      </div>

      <dl className="supplier-glance">
        <div><dt>{meta.nounPlural[0].toUpperCase() + meta.nounPlural.slice(1)}</dt><dd>{nf.format(op.itineraries.length)}</dd></div>
        <div><dt>Departures listed</dt><dd>{op.departures.length ? nf.format(op.departures.length) : "On request"}</dd></div>
        {span && <div><dt>Dates</dt><dd>{span}</dd></div>}
        {length && <div><dt>Length</dt><dd>{length}</dd></div>}
        {vesselWord && op.vessels.length > 0 && (
          <div><dt>{vesselWord}</dt><dd>{op.vessels.slice(0, 4).join(", ")}{op.vessels.length > 4 ? ` +${op.vessels.length - 4}` : ""}</dd></div>
        )}
        {collection === "jet" && op.vesselFacts[0] && (
          <div><dt>Aircraft</dt><dd>{op.vesselFacts[0].name}{op.vesselFacts[0].guests ? `, ${op.vesselFacts[0].guests} guests` : ""}</dd></div>
        )}
        {topCountries.length > 0 && collection !== "cruise" && (
          <div><dt>Countries</dt><dd>{topCountries.join(", ")}</dd></div>
        )}
        <div><dt>Book with</dt><dd>Aspen Travel Advisors</dd></div>
      </dl>

      <AnswerAdvisorCta lead={`Want a ${op.name} departure held, or a second opinion on which one? An Aspen advisor will check dates and price it for you.`} />

      {lines.length > 0 && (
        <section>
          <h2>Where {op.name} goes</h2>
          <SupplierMap
            title={`Routes of ${op.name} ${meta.nounPlural}`}
            lines={lines}
            dots={dots}
            caption={
              mapped.length < op.itineraries.length
                ? `The ${mapped.length} ${meta.nounPlural} with the soonest departures, of ${op.itineraries.length}. Each route is drawn from its itinerary stops.`
                : `Every ${meta.noun}, drawn from its itinerary stops.`
            }
          />
        </section>
      )}

      {op.vesselFacts.length > 0 && collection !== "jet" && (
        <section>
          <h2>The {vesselWord ? vesselWord.toLowerCase() : "fleet"}</h2>
          <div className="answers-table-scroll">
            <table>
              <thead><tr><th>Name</th><th>Guests</th><th>Details</th></tr></thead>
              <tbody>
                {op.vesselFacts.map((v) => (
                  <tr key={v.name}>
                    <th scope="row">{v.name}</th>
                    <td>{v.guests ?? "—"}</td>
                    <td>{[v.detail, v.note].filter(Boolean).join(". ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="supplier-caption">Published figures, compiled July 2026. Capacities change with refits and charters; an advisor confirms them for your departure.</p>
        </section>
      )}
      {collection === "jet" && op.vesselFacts[0] && (
        <section>
          <h2>The aircraft</h2>
          <p>
            {op.vesselFacts[0].name}
            {op.vesselFacts[0].guests ? `, configured for ${op.vesselFacts[0].guests} guests` : ""}.{" "}
            {op.vesselFacts[0].detail ? `${op.vesselFacts[0].detail}.` : ""} {op.vesselFacts[0].note || ""}
          </p>
        </section>
      )}

      <section>
        <h2>Every {op.name} {meta.noun}</h2>
        <ul className="supplier-itins">
          {op.itineraries.map((j) => {
            const next = j.departures.filter((d) => d.startDate && op.departures.some((x) => x.id === d.id));
            const stops = [...new Set(j.stops.map((s) => s.name))];
            return (
              <li key={j.slug}>
                <Link href={j.path} className="supplier-itin-name">{j.title}</Link>
                <span className="answers-desc">
                  {[
                    j.days ? `${j.days} days` : null,
                    j.vessels.join(", ") || null,
                    j.regions.slice(0, 3).map((r) => regionName(collection, r)).join(", ") || null,
                    j.onDemand
                      ? `on request${j.window ? `, ${j.window.replace(/^Valid for Departures( Now Through)?:\s*/i, "through ")}` : ""}`
                      : next.length
                        ? `${plural(next.length, "departure", "departures")}, next ${fmtDay(next[0].startDate)}`
                        : "no upcoming dates listed",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {stops.length > 1 && collection !== "cruise" && (
                  <span className="supplier-stops">
                    {stops.slice(0, 9).join(" → ")}
                    {stops.length > 9 ? " …" : ""}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {op.departures.length > 0 && (
        <section>
          <h2>Upcoming departures</h2>
          <div className="answers-table-scroll">
            <table>
              <caption>
                {op.departures.length > 60 ? `The next 60 of ${nf.format(op.departures.length)} departures. ` : ""}
                Dates come from the supplier feed and are refreshed nightly.
              </caption>
              <thead>
                <tr><th>Departs</th><th>{meta.noun[0].toUpperCase() + meta.noun.slice(1)}</th><th>Days</th>{vesselWord && collection !== "jet" ? <th>{vesselWord.replace(/s$/, "")}</th> : null}</tr>
              </thead>
              <tbody>
                {op.departures.slice(0, 60).map((d) => (
                  <tr key={`${d.journey.slug}-${d.id}`}>
                    <th scope="row">{fmtDay(d.startDate)}</th>
                    <td><Link href={d.journey.path}>{d.journey.title}</Link></td>
                    <td>{d.days ?? d.journey.days ?? "—"}</td>
                    {vesselWord && collection !== "jet" ? <td>{d.vessel || "—"}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="answers-faq">
        <h2>Questions people ask about {op.name}</h2>
        {faq.map((f) => (
          <details key={f.q} open>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>

      {others.length > 0 && (
        <section>
          <h2>Compare with other operators</h2>
          <div className="answers-table-scroll">
            <table>
              <thead><tr><th>Operator</th><th>{meta.nounPlural[0].toUpperCase() + meta.nounPlural.slice(1)}</th><th>Departures</th><th>Length</th></tr></thead>
              <tbody>
                {others.map((o) => (
                  <tr key={o.slug}>
                    <th scope="row"><Link href={o.path}>{o.name}</Link></th>
                    <td>{nf.format(o.itineraries.length)}</td>
                    <td>{o.departures.length ? nf.format(o.departures.length) : "On request"}</td>
                    <td>{lengthSpan(o) || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {answers.length > 0 && (
        <section>
          <h2>Before you choose</h2>
          <ul>
            {answers.map((a) => (
              <li key={a.slug}><Link href={`/answers/${a.slug}`}>{a.question || a.title}</Link></li>
            ))}
          </ul>
        </section>
      )}

      <aside className="answers-related">
        <h2>Book it, or ask about it</h2>
        <p className="answers-cta">
          <Link href={askHref}>Ask The Guide about {op.name}</Link>, or see every {meta.noun} on the{" "}
          <Link href={`/atlas/${collection}`}>{meta.label.toLowerCase()} atlas</Link>. Booked through Aspen Travel Advisors.
        </p>
        <AnswerAdvisorCta lead={`Ready to choose a ${op.name} departure? An advisor will price it with the benefits Aspen adds.`} />
      </aside>
      <SiteFooter />
    </article>
  );
}
