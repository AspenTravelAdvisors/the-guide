// AboutTheGuide — what this site is, in plain text, on the home page.
//
// Server component, handed to GuideChat as its `about` slot from app/page.tsx,
// so it is in the prerendered HTML rather than painted after JS runs.
//
// Why it exists: Search Console filed the home page under "Crawled – currently
// not indexed" (November 2026). What a crawler got was ~250 words — header,
// menu, collection counts and a chat box — because the chat and the globe are
// the product and neither is text. The page is pinned to the viewport and never
// scrolls, so there is no "below the fold" to put an explanation in; it goes
// here, collapsed by default, at the foot of the welcome screen. Google reads
// text inside a closed <details>, and a visitor who wants it can open it.
//
// Facts only. Every claim here is one the rest of the site already makes and
// stands behind: the counts come from the live collection data, the benefits
// from the Virtuoso feed, "no rates, no live availability" from SiteFooter, and
// the 24-hour reply from ADVISOR_SLA (repeated as text below: that constant
// lives in a "use client" module, which a server component cannot read a
// plain value from).

import Link from "next/link";
import { COLLECTIONS, totalCount } from "@/lib/atlas-config";
import { ALL_ANSWERS } from "@/lib/answers";
import { AGENCY_NAME } from "@/lib/seo/site";

/** The answers most worth a first visitor's click. Missing slugs drop out. */
const POPULAR = [
  "hotel-brand-advisor-programs-compared",
  "four-seasons-preferred-partner-benefits",
  "world-cruises-compared",
  "best-antarctica-expedition-for-first-timers",
];

export default function AboutTheGuide() {
  // "More than 12,000", not "12,197": the exact figure is already in the
  // header, and a rounded one does not go stale between syncs.
  const total = totalCount();
  const floor = total >= 1000 ? Math.floor(total / 1000) * 1000 : total;
  const popular = POPULAR.map((slug) => ALL_ANSWERS.find((a) => a.slug === slug)).filter(
    (a): a is (typeof ALL_ANSWERS)[number] => Boolean(a),
  );

  return (
    <details className="about-guide">
      <summary>About The Guide</summary>
      <div className="about-guide-body">
        <p>
          The Guide is {AGENCY_NAME}&apos; AI travel concierge. Ask it what you would
          ask a well-travelled friend, like &ldquo;a quiet beach hotel in the Caribbean
          for March&rdquo; or &ldquo;Antarctica on a small ship&rdquo;, and it searches
          more than {floor.toLocaleString("en-US")} vetted hotels, villas, expedition
          cruises, world cruises, safaris, rail journeys, hotel yachts and private-jet
          expeditions, then plots what it finds on the globe.
        </p>
        <p>
          Everything here is booked through {AGENCY_NAME}, a Virtuoso agency. At most of
          the hotels, booking through us adds Virtuoso amenities: an upgrade when one is
          available, daily breakfast for two, and a hotel or resort credit. On cruises
          and journeys, current supplier offers are shown on every departure and combine
          with our advisor benefits.
        </p>
        <p>
          What The Guide won&apos;t do is pretend to know today&apos;s price. We hold no
          rates and no live availability. When you have a shortlist, send it to an
          advisor and you&apos;ll hear back within 24 hours with what&apos;s actually
          bookable.
        </p>
        <nav aria-label="Browse the collections">
          <span className="about-guide-label">Browse</span>
          <Link href="/hotels">Hotels A–Z</Link>
          <Link href="/villas">Villas A–Z</Link>
          <Link href="/journeys">Journeys A–Z</Link>
          <Link href="/answers">Answers</Link>
          {COLLECTIONS.map((c) => (
            <Link key={c.type} href={`/atlas/${c.type}`}>
              {c.nav}
            </Link>
          ))}
        </nav>
        {popular.length > 0 && (
          <nav aria-label="Popular questions">
            <span className="about-guide-label">Popular questions</span>
            {popular.map((a) => (
              <Link key={a.slug} href={`/answers/${a.slug}`}>
                {a.question}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </details>
  );
}
