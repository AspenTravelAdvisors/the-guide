// The Guide's take — rendered on hotel and journey pages when a note exists.
// See lib/seo/guide-takes.js for where the notes come from and why.
//
// `data-guide-take` marks the block so scripts/draft-guide-takes.mjs can leave
// it out when it reads a page back as the source of facts: a note must never
// be written from a previous note.

import { guideTake } from "@/lib/seo/guide-takes";

export default function GuideTake({ path }) {
  const note = guideTake(path);
  if (!note) return null;
  return (
    <section className="guide-take" data-guide-take="">
      <h2>The Guide&apos;s take</h2>
      <p>{note}</p>
      <p className="guide-take-source">
        Written by The Guide from the facts on this page.
      </p>
    </section>
  );
}
