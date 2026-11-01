// "The Guide's take" — a short travel note per hotel and journey page.
//
// The notes are written by scripts/draft-guide-takes.mjs from the page's own
// published text, fact-checked against that same text, and reviewed as a pull
// request before they merge. This file only reads them. Keyed by page path
// ("/hotels/<destination>/<slug>", "/journeys/<collection>/<slug>"), so a
// listing that drops out of the feed simply loses its note with its page.
//
// Why they exist: Search Console filed ~1,750 of these pages under "Crawled –
// currently not indexed" (November 2026). Most of their text is the supplier's
// own description, which Google already has from the supplier. A note in our
// own voice, built from the facts on the page, is the part only this site has.

import takes from "@/data/notes/guide-takes.json";

/** The note for a page path, or null when there isn't one yet. */
export function guideTake(path) {
  const entry = takes[path];
  return entry && typeof entry.note === "string" && entry.note.trim() ? entry.note.trim() : null;
}
