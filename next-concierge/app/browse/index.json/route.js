// /browse/index.json — the name list the Find-by-name box filters.
//
// Static, built at deploy from the same feeds as the pages it links to (see
// lib/seo/browse.js). The box fetches it on first focus, not on page load, so a
// visitor who never types into it never downloads it.

import { browseEntries } from "@/lib/seo/browse";

export const dynamic = "force-static";

export function GET() {
  // Arrays, not objects: the keys would be a third of the file.
  const rows = browseEntries().map((e) => [e.k, e.n, e.t, e.p, e.u]);
  return new Response(JSON.stringify(rows), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      // It changes only when a deploy does; an hour in the browser, a day at
      // the edge with a revalidate behind it.
      "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
