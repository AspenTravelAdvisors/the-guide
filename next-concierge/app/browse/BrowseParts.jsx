// The pieces /browse and /browse/<letter> share: the letter row and the list.
// Server components — the list is plain HTML links, readable without JS.

import Link from "next/link";
import { letterCounts } from "@/lib/seo/browse";

const nf = new Intl.NumberFormat("en-US");

/** A B C … 0–9, each with its count; the current letter marked. */
export function LetterRow({ current = null }) {
  return (
    <nav className="browse-letters" aria-label="Names by first letter">
      {letterCounts().map(({ letter, label, count }) =>
        count === 0 ? (
          <span key={letter} className="browse-letter" aria-disabled="true">
            {label}
          </span>
        ) : (
          <Link
            key={letter}
            className="browse-letter"
            href={`/browse/${letter}`}
            aria-current={letter === current ? "page" : undefined}
            title={`${nf.format(count)} names`}
          >
            {label}
          </Link>
        ),
      )}
    </nav>
  );
}

/** One letter's names, in order, each with what it is and where. */
export function NameList({ entries }) {
  return (
    <ul className="browse-list">
      {entries.map((e) => (
        <li key={e.u}>
          <Link href={e.u}>{e.n}</Link>
          <span className="find-meta">
            <span className="find-type" data-kind={e.k}>
              {e.t}
            </span>
            {e.p && <span className="find-place">{e.p}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The place-first hubs, for a reader who would rather browse by country. */
export function ByPlace() {
  return (
    <p className="browse-byplace">
      Or browse by place: <Link href="/hotels">hotels by country</Link> ·{" "}
      <Link href="/villas">villas by destination</Link> ·{" "}
      <Link href="/journeys">journeys by collection</Link> ·{" "}
      <Link href="/hotels/brands">hotel brands</Link>
    </p>
  );
}
