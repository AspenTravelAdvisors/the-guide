// /hotels/brands/[brand] — every property one hotel brand has in the atlas, with
// the amenities Aspen's programmes add, a map, and how it compares.
//
// See lib/seo/suppliers.js for why supplier pages exist. Static: built from the
// same merged hotel feed as /hotels/[destination]/[slug].

import Link from "next/link";
import { notFound } from "next/navigation";
import { hotelBrands, getHotelBrand } from "@/lib/seo/suppliers";
import { ALL_ANSWERS, SITE_URL } from "@/lib/answers";
import { orgRef } from "@/lib/seo/site";
import { jsonLd } from "@/lib/seo/json-ld";
import SiteFooter from "@/components/SiteFooter";
import SupplierMap from "@/components/SupplierMap";
import AnswerAdvisorCta from "@/components/AnswerAdvisorCta";

export const revalidate = false;
export const dynamicParams = false;

export function generateStaticParams() {
  return hotelBrands().map((b) => ({ brand: b.slug }));
}

const nf = new Intl.NumberFormat("en-US");
const plural = (n, one, many) => `${nf.format(n)} ${n === 1 ? one : many}`;

const BRAND_ANSWERS = {
  "four-seasons": ["four-seasons-preferred-partner-benefits", "which-four-seasons-have-swimmable-beaches", "ritz-carlton-vs-four-seasons-vs-rosewood"],
  "ritz-carlton": ["ritz-carlton-vs-four-seasons-vs-rosewood"],
  rosewood: ["ritz-carlton-vs-four-seasons-vs-rosewood"],
  aman: ["best-aman-for-first-timers"],
};
const GENERAL_ANSWERS = ["hotel-brand-advisor-programs-compared", "virtuoso-perks-vs-booking-direct", "do-travel-advisors-cost-more"];

export async function generateMetadata({ params }) {
  const { brand } = await params;
  const b = getHotelBrand(brand);
  if (!b) return {};
  const title = `${b.name} Hotels: ${plural(b.hotels.length, "property", "properties")} in ${plural(b.countries.length, "country", "countries")}, with VIP amenities`;
  const description = `Every ${b.name} hotel in the atlas${b.programs[0] ? `, booked with ${b.programs[0].name} amenities` : ""}${
    b.amenities[0] ? ` such as ${b.amenities.slice(0, 2).map((a) => a.text.toLowerCase()).join(" and ")}` : ""
  }. Map, list by country, and how ${b.name} compares. Book with Aspen Travel Advisors.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}${b.path}` },
    openGraph: { title, description, type: "website", url: `${SITE_URL}${b.path}` },
  };
}

export default async function BrandPage({ params }) {
  const { brand } = await params;
  const b = getHotelBrand(brand);
  if (!b) notFound();

  const url = `${SITE_URL}${b.path}`;
  const byCountry = new Map();
  for (const h of b.hotels) byCountry.set(h.country, [...(byCountry.get(h.country) || []), h]);
  const countries = [...byCountry.entries()].sort((a, c) => c[1].length - a[1].length || a[0].localeCompare(c[0]));
  const program = b.programs[0]?.name || null;
  const answers = [...(BRAND_ANSWERS[b.slug] || []), ...GENERAL_ANSWERS]
    .map((slug) => ALL_ANSWERS.find((a) => a.slug === slug))
    .filter(Boolean);
  const others = hotelBrands().filter((o) => o.slug !== b.slug).slice(0, 14);
  const dots = b.hotels
    .filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lng))
    .map((h) => ({ at: [h.lng, h.lat], label: `${h.name}, ${h.city || h.country}` }));
  const askHref = `/?ask=${encodeURIComponent(`Which ${b.name} would suit my trip, and what would Aspen add?`)}`;

  const faq = [
    {
      q: `How many ${b.name} hotels are in the atlas?`,
      a: `${plural(b.hotels.length, "property", "properties")} in ${plural(b.countries.length, "country", "countries")}, led by ${b.countries
        .slice(0, 3)
        .map((c) => `${c.name} (${c.n})`)
        .join(", ")}.`,
    },
    b.amenities.length > 0 && {
      q: `What do you get booking ${b.name} through Aspen Travel Advisors?`,
      a: `Amenities on top of the rate${program ? `, through ${program}` : ""}. Most ${b.name} properties in the atlas list: ${b.amenities
        .slice(0, 4)
        .map((a) => a.text.toLowerCase())
        .join("; ")}. Each hotel's page lists its own amenities and the year they apply to.`,
    },
    {
      q: `Does booking ${b.name} through an advisor cost more?`,
      a: `Usually not. Advisor programmes book the hotel's own flexible rate, the hotel pays the advisor, and the amenities come on top. The Guide holds no rates, so your advisor quotes the current price for your dates.`,
    },
    {
      q: `How do I book a ${b.name} hotel?`,
      a: `Through Aspen Travel Advisors. Ask The Guide which property fits, or ask an advisor to check dates and price it with the amenities included.`,
    },
  ].filter(Boolean);

  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": `${url}#page`,
      url,
      name: `${b.name} hotels`,
      publisher: orgRef(),
      about: { "@type": "Brand", name: b.name },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: b.hotels.length,
        itemListElement: b.hotels.map((h, i) => ({
          "@type": "ListItem",
          position: i + 1,
          item: { "@type": "Hotel", "@id": `${SITE_URL}${h.path}#hotel`, name: h.name, url: `${SITE_URL}${h.path}` },
        })),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Hotels", item: `${SITE_URL}/hotels` },
        { "@type": "ListItem", position: 2, name: "Brands", item: `${SITE_URL}/hotels/brands` },
        { "@type": "ListItem", position: 3, name: b.name, item: url },
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
        <Link href="/hotels">Hotels</Link>
        <span aria-hidden="true"> / </span>
        <Link href="/hotels/brands">Brands</Link>
        <span aria-hidden="true"> / </span>
        <span>{b.name}</span>
      </nav>

      <header className="supplier-head">
        <p className="supplier-eyebrow">Hotel brand</p>
        <h1>{b.name} hotels</h1>
        <p className="supplier-sub">
          {plural(b.hotels.length, "property", "properties")} · {plural(b.countries.length, "country", "countries")}
          {program ? ` · ${program}` : ""}
        </p>
      </header>

      <div className="answers-lead">
        <p>
          {b.profile?.summary ? `${b.profile.summary} ` : ""}
          The atlas holds {plural(b.hotels.length, `${b.name} property`, `${b.name} properties`)}, from{" "}
          {b.countries.slice(0, 4).map((c) => c.name).join(", ")}
          {b.countries.length > 4 ? ` and ${plural(b.countries.length - 4, "other country", "other countries")}` : ""}.
          {program ? ` Booked through Aspen Travel Advisors, they carry ${program} amenities on top of the rate.` : ""}
        </p>
      </div>

      <dl className="supplier-glance">
        <div><dt>Properties</dt><dd>{nf.format(b.hotels.length)}</dd></div>
        <div><dt>Countries</dt><dd>{nf.format(b.countries.length)}</dd></div>
        {b.rooms > 0 && <div><dt>Rooms listed</dt><dd>{nf.format(b.rooms)}</dd></div>}
        {b.programs.length > 0 && <div><dt>Advisor programmes</dt><dd>{b.programs.map((p) => p.name).join(", ")}</dd></div>}
        <div><dt>Book with</dt><dd>Aspen Travel Advisors</dd></div>
      </dl>

      {b.amenities.length > 0 && (
        <section>
          <h2>What Aspen adds at most {b.name} hotels</h2>
          <ul>
            {b.amenities.map((a) => (
              <li key={a.text}>
                {a.text} <span className="supplier-muted">({a.n} of {b.hotels.length})</span>
              </li>
            ))}
          </ul>
          <p className="supplier-caption">Amenities vary by property and year; each hotel page lists its own.</p>
        </section>
      )}

      <AnswerAdvisorCta lead={`Choosing between ${b.name} hotels? An Aspen advisor will check your dates and price it with the amenities included.`} />

      {dots.length > 1 && (
        <section>
          <h2>Where {b.name} is</h2>
          <SupplierMap title={`Map of ${b.name} hotels`} dots={dots} caption={`${plural(dots.length, "property", "properties")}.`} />
        </section>
      )}

      <section>
        <h2>Every {b.name} hotel, by country</h2>
        {countries.map(([country, hotels]) => (
          <div key={country} className="supplier-country">
            <h3>{country} <span className="supplier-muted">{hotels.length}</span></h3>
            <ul className="supplier-itins">
              {hotels.map((h) => (
                <li key={h.path}>
                  <Link href={h.path} className="supplier-itin-name">{h.name}</Link>
                  <span className="answers-desc">
                    {[h.city, h.numberOfRooms ? `${h.numberOfRooms} rooms` : null, h.program, h.perksYear ? `amenities ${h.perksYear}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="answers-faq">
        <h2>Questions people ask about {b.name}</h2>
        {faq.map((f) => (
          <details key={f.q} open>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>

      <section>
        <h2>Other hotel brands</h2>
        <div className="answers-table-scroll">
          <table>
            <thead><tr><th>Brand</th><th>Properties</th><th>Countries</th><th>Programme</th></tr></thead>
            <tbody>
              {others.map((o) => (
                <tr key={o.slug}>
                  <th scope="row"><Link href={o.path}>{o.name}</Link></th>
                  <td>{nf.format(o.hotels.length)}</td>
                  <td>{nf.format(o.countries.length)}</td>
                  <td>{o.programs[0]?.name || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p><Link href="/hotels/brands">All {hotelBrands().length} brands</Link></p>
      </section>

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
          <Link href={askHref}>Ask The Guide about {b.name}</Link>, or see every property on the{" "}
          <Link href="/atlas/hotel">hotel atlas</Link>. Booked through Aspen Travel Advisors.
        </p>
      </aside>
      <SiteFooter />
    </article>
  );
}
