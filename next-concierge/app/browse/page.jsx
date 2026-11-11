// /browse — Find by name.
//
// Every hotel, villa and journey that has a page, found by typing part of its
// name, or by first letter. The hubs file the same pages by place; this files
// them by name, for the visitor who already knows what they are looking for.
// See lib/seo/browse.js.

import Link from "next/link";
import FindByName from "@/components/FindByName";
import SiteFooter from "@/components/SiteFooter";
import { SITE_URL } from "@/lib/answers";
import { browseTotals } from "@/lib/seo/browse";
import { ByPlace, LetterRow } from "./BrowseParts";

const nf = new Intl.NumberFormat("en-US");

export const metadata = {
  title: "Find by Name — Every Hotel, Villa and Journey A–Z",
  description:
    "Look up any luxury hotel, private villa, expedition cruise, world cruise, rail, yacht, jet or safari journey in the Expedition Bucket List atlas by name, A–Z.",
  alternates: { canonical: `${SITE_URL}/browse` },
};

export default function BrowsePage() {
  const t = browseTotals();
  return (
    <div className="answers-wrap">
      <header className="answers-head">
        <h1>Find by name</h1>
        <p>
          Every hotel, villa and journey in the atlas — {nf.format(t.hotels)} hotels,{" "}
          {nf.format(t.villas)} villas and {nf.format(t.journeys)} journeys. Type part of a
          name, or pick a letter. Not sure what you&apos;re looking for?{" "}
          <Link href="/">Describe the trip to The Guide</Link> instead.
        </p>
      </header>

      <FindByName autoFocus syncUrl />

      <section className="answers-group">
        <h2>A–Z</h2>
        <LetterRow />
        <ByPlace />
      </section>
      <SiteFooter />
    </div>
  );
}
