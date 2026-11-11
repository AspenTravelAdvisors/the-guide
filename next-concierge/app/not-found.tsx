// The 404 page, which the site did not have — Next's default said
// "This page could not be found." in black on white, with no header link back
// and no way forward.
//
// The likeliest reader is not lost at random. Property and itinerary pages are
// built from feeds that change: a hotel leaves the programme, a voyage is
// retired, and every link anyone saved to it now lands here. That reader knows
// the NAME of what they were looking for, so the page leads with the box that
// finds things by name, already focused. A reader who doesn't is offered The
// Guide.

import type { Metadata } from "next";
import Link from "next/link";
import FindByName from "@/components/FindByName";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="answers-wrap">
      <header className="answers-head">
        <h1>That page isn&apos;t here</h1>
        <p>
          The hotel or journey may have left the collection, or the link may be an old one.
          If you know its name, find it below. If not,{" "}
          <Link href="/">describe the trip to The Guide</Link> and it will find what fits.
        </p>
      </header>

      <FindByName autoFocus />

      <section className="answers-group">
        <p className="browse-byplace">
          Or browse: <Link href="/browse">everything A–Z</Link> ·{" "}
          <Link href="/hotels">hotels by country</Link> ·{" "}
          <Link href="/villas">villas by destination</Link> ·{" "}
          <Link href="/journeys">journeys by collection</Link>
        </p>
      </section>
      <SiteFooter />
    </div>
  );
}
