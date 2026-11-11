// /browse/<letter> — every name under one letter.
//
// Plain HTML links, so the A–Z works without JS and a crawler can follow it.
// Not submitted for indexing: a page of names is a way to reach the pages that
// say something, not one itself, and the hubs already carry the same links in
// text a search engine can rank. `follow` keeps the links counting.

import { notFound } from "next/navigation";
import FindByName from "@/components/FindByName";
import SiteFooter from "@/components/SiteFooter";
import { SITE_URL } from "@/lib/answers";
import { LETTERS, entriesUnder, letterLabel } from "@/lib/seo/browse";
import { ByPlace, LetterRow, NameList } from "../BrowseParts";

export const dynamicParams = false;

export function generateStaticParams() {
  return LETTERS.filter((l) => entriesUnder(l).length > 0).map((letter) => ({ letter }));
}

const nf = new Intl.NumberFormat("en-US");

export async function generateMetadata({ params }) {
  const { letter } = await params;
  const label = letterLabel(letter);
  return {
    title: `Hotels, Villas and Journeys — ${label}`,
    description: `Every hotel, private villa and journey in the Expedition Bucket List atlas whose name starts with ${label}.`,
    alternates: { canonical: `${SITE_URL}/browse/${letter}` },
    robots: { index: false, follow: true },
  };
}

export default async function BrowseLetter({ params }) {
  const { letter } = await params;
  if (!LETTERS.includes(letter)) notFound();
  const entries = entriesUnder(letter);
  if (entries.length === 0) notFound();
  const label = letterLabel(letter);

  return (
    <div className="answers-wrap">
      <header className="answers-head">
        <h1>Find by name: {label}</h1>
        <p>
          {nf.format(entries.length)} {entries.length === 1 ? "name" : "names"} under {label}
          {letter !== "0-9" && (
            <>
              {" "}
              — filed without a leading &ldquo;The&rdquo;, so The Peninsula is under P
            </>
          )}
          .
        </p>
      </header>

      <FindByName />

      <section className="answers-group">
        <LetterRow current={letter} />
        <NameList entries={entries} />
        <ByPlace />
      </section>
      <SiteFooter />
    </div>
  );
}
