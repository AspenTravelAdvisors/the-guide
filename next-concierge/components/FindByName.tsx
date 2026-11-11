"use client";

// FindByName — a box that filters every hotel, villa and journey by name.
//
// For the visitor who already knows what they want. The Guide is for the one
// who doesn't, and the two are kept apart on purpose: this box never sends
// anything to the Guide, and when it finds nothing it says so and points there
// instead of guessing.
//
// The list it filters is /browse/index.json (lib/seo/browse.js), fetched on
// first focus — not on mount — so pages that carry the box (the hubs, the 404)
// cost nothing for a visitor who never uses it. `kinds` scopes it: the hotel
// hub's box finds only hotels.
//
// Results are plain links. Arrow keys move between them, Enter on the box opens
// the first; a screen reader hears the match count through a live region.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Kind = "h" | "v" | "j";
type Row = [Kind, string, string, string, string]; // kind, name, type, place, url

type Entry = {
  kind: Kind;
  name: string;
  type: string;
  place: string;
  url: string;
  hayName: string;
  hayAll: string;
};

const SHOW = 40;

/** Case, accents, "&" and punctuation all fold away: "ritz carlton" finds "Ritz-Carlton". */
function fold(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// One fetch per page view, shared by every box on the page.
let LOAD: Promise<Entry[]> | null = null;
function loadIndex(): Promise<Entry[]> {
  if (!LOAD) {
    LOAD = fetch("/browse/index.json")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<Row[]>;
      })
      .then((rows) =>
        rows.map(([kind, name, type, place, url]) => {
          const hayName = ` ${fold(name)}`;
          return { kind, name, type, place, url, hayName, hayAll: `${hayName} ${fold(place)}` };
        }),
      )
      .catch((e) => {
        LOAD = null; // let the next focus try again
        throw e;
      });
  }
  return LOAD;
}

/**
 * Every word of the query must appear somewhere in the name or the place.
 * Ranked: the name starts with the query, then a word in the name does, then
 * all the words are in the name, then the rest. Within a rank the list's own
 * A–Z order stands.
 */
function match(entries: Entry[], query: string): Entry[] {
  const q = fold(query);
  if (!q) return [];
  const words = q.split(" ");
  const ranked: Entry[][] = [[], [], [], []];
  for (const e of entries) {
    if (!words.every((w) => e.hayAll.includes(w))) continue;
    if (e.hayName.startsWith(` ${q}`) || e.hayName.startsWith(` the ${q}`)) ranked[0].push(e);
    else if (e.hayName.includes(` ${q}`)) ranked[1].push(e);
    else if (words.every((w) => e.hayName.includes(w))) ranked[2].push(e);
    else ranked[3].push(e);
  }
  return ranked.flat();
}

const NOUN: Record<string, string> = {
  h: "hotel",
  v: "villa",
  j: "journey",
};

export default function FindByName({
  kinds,
  placeholder,
  autoFocus = false,
  syncUrl = false,
  label = "Find by name",
}: {
  /** Limit the box to these kinds; all three when omitted. */
  kinds?: Kind[];
  placeholder?: string;
  autoFocus?: boolean;
  /** Keep the query in ?q= so Back and a shared link return to the same results. */
  syncUrl?: boolean;
  label?: string;
}) {
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const kindKey = (kinds ?? []).join("");

  const ensureLoaded = useCallback(() => {
    if (entries) return;
    setFailed(false);
    loadIndex().then(
      (all) => setEntries(kindKey ? all.filter((e) => kindKey.includes(e.kind)) : all),
      () => setFailed(true),
    );
  }, [entries, kindKey]);

  // Arriving at /browse?q=… (Back, or a shared link) restores the search.
  useEffect(() => {
    if (!syncUrl) return;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) {
      setQuery(q);
      ensureLoaded();
    }
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (autoFocus) ensureLoaded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!syncUrl) return;
    const url = new URL(window.location.href);
    if (query.trim()) url.searchParams.set("q", query.trim());
    else url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url);
  }, [query, syncUrl]);

  const results = useMemo(() => (entries ? match(entries, query) : []), [entries, query]);
  const shown = results.slice(0, SHOW);
  const typed = query.trim().length > 0;

  const scope =
    kinds && kinds.length === 1 ? NOUN[kinds[0]] : "hotel, villa or journey";

  let status = "";
  if (typed) {
    if (failed) status = "The name list didn’t load. Try again in a moment.";
    else if (!entries) status = "Loading names…";
    else if (results.length === 0) status = `No ${scope} by that name.`;
    else if (results.length > SHOW)
      status = `${results.length.toLocaleString("en-US")} matches — showing the first ${SHOW}. Keep typing to narrow it.`;
    else status = `${results.length} ${results.length === 1 ? "match" : "matches"}`;
  }

  function focusResult(i: number) {
    const links = listRef.current?.querySelectorAll<HTMLAnchorElement>("a");
    if (!links || links.length === 0) return;
    if (i < 0) {
      inputRef.current?.focus();
      return;
    }
    links[Math.min(i, links.length - 1)]?.focus();
  }

  return (
    <div className="find" role="search">
      <label className="find-label" htmlFor={`find-${kindKey || "all"}`}>
        {label}
      </label>
      <div className="find-box">
        <span className="find-glyph" aria-hidden="true">
          <svg viewBox="0 0 20 20" width="16" height="16">
            <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12.7 12.7 17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <input
          ref={inputRef}
          id={`find-${kindKey || "all"}`}
          type="search"
          inputMode="search"
          enterKeyHint="go"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          placeholder={placeholder ?? "Type a name, or part of one…"}
          value={query}
          onFocus={ensureLoaded}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              focusResult(0);
            } else if (e.key === "Enter" && shown.length > 0) {
              e.preventDefault();
              listRef.current?.querySelector<HTMLAnchorElement>("a")?.click();
            } else if (e.key === "Escape" && query) {
              e.preventDefault();
              setQuery("");
            }
          }}
          aria-describedby={`find-status-${kindKey || "all"}`}
        />
        {query && (
          <button
            type="button"
            className="find-clear"
            aria-label="Clear"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
          >
            ×
          </button>
        )}
      </div>

      <p className="find-status" id={`find-status-${kindKey || "all"}`} aria-live="polite">
        {status}
        {typed && entries && results.length === 0 && (
          <>
            {" "}
            <Link href="/">Describe the trip to The Guide</Link> instead, and it will look
            for you.
          </>
        )}
      </p>

      {shown.length > 0 && (
        <ul
          className="find-results"
          ref={listRef}
          onKeyDown={(e) => {
            const links = [...(listRef.current?.querySelectorAll("a") ?? [])];
            const i = links.indexOf(document.activeElement as HTMLAnchorElement);
            if (i === -1) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              focusResult(i + 1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              focusResult(i - 1);
            } else if (e.key === "Escape") {
              e.preventDefault();
              inputRef.current?.focus();
            }
          }}
        >
          {shown.map((e) => (
            <li key={e.url}>
              <Link href={e.url}>
                <span className="find-name">{e.name}</span>
                <span className="find-meta">
                  <span className="find-type" data-kind={e.kind}>
                    {e.type}
                  </span>
                  {e.place && <span className="find-place">{e.place}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
