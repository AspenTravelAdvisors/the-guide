// /hotels/brands — every hotel brand with a page, and the journey operators
// beside them, so a crawler reaching any hub can walk to every supplier page.

import Link from "next/link";
import { hotelBrands, journeyOperators } from "@/lib/seo/suppliers";
import { JOURNEY_COLLECTIONS, collectionMeta } from "@/lib/seo/journeys";
import { SITE_URL } from "@/lib/answers";
import SiteFooter from "@/components/SiteFooter";

export const revalidate = false;

const nf = new Intl.NumberFormat("en-US");

export function generateMetadata() {
  const n = hotelBrands().length;
  return {
    title: `Hotel Brands and Travel Operators: ${n} brands, every operator`,
    description: `Every luxury hotel brand in the atlas, from Four Seasons and Aman to Rosewood and Belmond, plus every cruise, yacht, rail, jet and safari operator. Each with its full list, map and dates.`,
    alternates: { canonical: `${SITE_URL}/hotels/brands` },
  };
}

export default function BrandsIndex() {
  const brands = hotelBrands();
  return (
    <div className="answers-wrap">
      <nav className="answers-crumbs">
        <Link href="/hotels">Hotels</Link>
        <span aria-hidden="true"> / </span>
        <span>Brands</span>
      </nav>
      <header className="answers-head">
        <h1>Hotel brands and travel operators</h1>
        <p>
          Every brand and operator in the atlas with its own page: what it runs or owns, where, when, and what booking
          through Aspen Travel Advisors adds.
        </p>
      </header>

      <section className="answers-group">
        <h2>Hotel brands</h2>
        <ul className="supplier-index">
          {brands.map((b) => (
            <li key={b.slug}>
              <Link href={b.path}>{b.name}</Link>
              <span className="answers-desc">
                {nf.format(b.hotels.length)} properties · {nf.format(b.countries.length)} countries
              </span>
            </li>
          ))}
        </ul>
      </section>

      {JOURNEY_COLLECTIONS.map((c) => {
        const meta = collectionMeta(c);
        const ops = journeyOperators(c).filter((o) => o.indexable);
        if (!ops.length) return null;
        return (
          <section key={c} className="answers-group">
            <h2>{meta.label}</h2>
            <ul className="supplier-index">
              {ops.map((o) => (
                <li key={o.slug}>
                  <Link href={o.path}>{o.name}</Link>
                  <span className="answers-desc">
                    {nf.format(o.itineraries.length)} {meta.nounPlural}
                    {o.departures.length ? ` · ${nf.format(o.departures.length)} departures` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <SiteFooter />
    </div>
  );
}
