// lib/watch.ts — "tell me when anything on my list changes".
//
// A traveler who saves a $40,000 suite and leaves an email to hear about it is
// the most qualified lead the site can produce, and until now nothing asked for
// that email. This module is the server half of the watch: what we remember
// about each saved item, how a night's data refresh is compared against it, and
// where the watches are kept.
//
// WHO GETS THE ALERT. The advisor, not the traveler. A change on a watched
// trip — a new Virtuoso offer on a hotel, new departure dates on a sailing, a
// trip that has dropped out of the feed — reaches the lead inbox as a short note
// naming the traveler, so an advisor writes to them personally with the news.
// That is a better touch than an automated email, and it needs no mail
// provider, unsubscribe handling or sender reputation to get right. The
// traveler is told exactly this when they sign up.
//
// WHAT IS COMPARED. A fingerprint per item, taken from the same server-side
// indexes the /hotels and /journeys pages read: for a hotel, the names of its
// live supplier promotions; for a route collection, the itinerary's promotions
// and its future departure dates. Villas have no feed signal worth reporting,
// and an item the indexes cannot find (some Guide results carry ids of their
// own) is kept with no fingerprint and never alerts. Nothing is ever reported
// on the night an item is first seen: that night only records the baseline.
//
// STORAGE. The shared Redis store in lib/kv.ts: one JSON value per watcher,
// keyed by a hash of their email so the key itself is not an address, and a
// set of those keys for the nightly pass to walk. Signing up again with the
// same email replaces the list, which is how a traveler updates it.
//
// Server-only: pulls the hotel feed and every route feed.

import { createHash } from "node:crypto";
import { activePromotions, getHotelById } from "@/lib/seo/hotels";
import { JOURNEY_COLLECTIONS, journeysIn } from "@/lib/seo/journeys";
import { kvPipeline } from "@/lib/kv";
import { SITE_URL } from "@/lib/site-url";

export interface Fingerprint {
  offers: string[];
  dates: string[];
}

export interface WatchItem {
  type: string;
  id: string;
  title: string;
  /** null: not found in the feed when last checked. Absent: never checkable. */
  fp?: Fingerprint | null;
}

export interface Watch {
  email: string;
  name: string;
  items: WatchItem[];
  partner: string | null;
  aiSource: string | null;
  createdAt: string;
  checkedAt: string | null;
}

export const WATCH_MAX_ITEMS = 30;
const SET_KEY = "watch:all";
const STORE_TIMEOUT_MS = 4000;

export const watchKey = (email: string) =>
  `watch:${createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 32)}`;

// ── fingerprints ────────────────────────────────────────────────────────────

const names = (promos: Array<{ name?: unknown }> | undefined) =>
  [...new Set((promos ?? []).map((p) => String(p?.name ?? "").trim()).filter(Boolean))].sort();

/** departure id → its itinerary, per collection, built on first use. */
const DEPARTURES = new Map<string, Map<string, ReturnType<typeof journeysIn>[number]>>();
function itineraryFor(type: string, id: string) {
  if (!JOURNEY_COLLECTIONS.includes(type)) return null;
  let index = DEPARTURES.get(type);
  if (!index) {
    index = new Map();
    for (const j of journeysIn(type)) {
      for (const d of j.departures) index.set(String(d.id), j);
    }
    DEPARTURES.set(type, index);
  }
  return index.get(id) ?? null;
}

/** Whether this kind of item can be checked at all. */
export const isCheckable = (type: string) => type === "hotel" || JOURNEY_COLLECTIONS.includes(type);

/**
 * The item as the feed has it today, or null when the feed no longer has it.
 * Only call for checkable types; anything else has nothing to compare.
 */
export function fingerprint(type: string, id: string, today = new Date()): Fingerprint | null {
  if (type === "hotel") {
    const h = getHotelById(id);
    return h ? { offers: names(activePromotions(h, today)), dates: [] } : null;
  }
  const j = itineraryFor(type, id);
  if (!j) return null;
  const from = today.toISOString().slice(0, 10);
  const dates = [
    ...new Set(
      j.departures
        .map((d: { startDate?: string | null }) => d.startDate || "")
        .filter((d: string) => d && d >= from),
    ),
  ].sort() as string[];
  return { offers: names(j.promotions), dates: dates.slice(0, 120) };
}

/** Where an advisor can look at the item, on our own site. */
export function itemLink(type: string, id: string): string | null {
  if (type === "hotel") {
    const h = getHotelById(id);
    return h?.path ? `${SITE_URL}${h.path}` : null;
  }
  const j = itineraryFor(type, id);
  return j ? `${SITE_URL}${j.path}` : null;
}

const fmtDate = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};

/**
 * What changed between two fingerprints, as sentences for the advisor, or []
 * when nothing worth a note did. `prev === undefined` is a first look and
 * never reports; so is a fingerprint going from null (not found) to found.
 */
export function describeChange(
  prev: Fingerprint | null | undefined,
  cur: Fingerprint | null,
): string[] {
  if (prev === undefined || prev === null) return [];
  if (cur === null) return ["No longer in the feed. It may have sold out or been withdrawn."];
  const out: string[] = [];
  const newOffers = cur.offers.filter((o) => !prev.offers.includes(o));
  if (newOffers.length) out.push(`New offer${newOffers.length > 1 ? "s" : ""}: ${newOffers.join("; ")}`);
  const newDates = cur.dates.filter((d) => !prev.dates.includes(d));
  if (newDates.length) {
    const shown = newDates.slice(0, 5).map(fmtDate).join(", ");
    const more = newDates.length > 5 ? ` and ${newDates.length - 5} more` : "";
    out.push(`New departure${newDates.length > 1 ? "s" : ""}: ${shown}${more}`);
  }
  return out;
}

// ── storage ─────────────────────────────────────────────────────────────────

/** Save (or replace) a watch. Returns false when the store is unavailable. */
export async function saveWatch(w: Watch): Promise<boolean> {
  const key = watchKey(w.email);
  const res = await kvPipeline(
    [
      ["SET", key, JSON.stringify(w)],
      ["SADD", SET_KEY, key],
    ],
    STORE_TIMEOUT_MS,
  );
  return res !== null;
}

/** Every watch, for the nightly pass. Null when the store cannot be read. */
export async function allWatches(): Promise<Array<{ key: string; watch: Watch }> | null> {
  const members = await kvPipeline([["SMEMBERS", SET_KEY]], STORE_TIMEOUT_MS);
  if (!members) return null;
  const keys = (Array.isArray(members[0]) ? members[0] : []).map(String);
  if (!keys.length) return [];
  const out: Array<{ key: string; watch: Watch }> = [];
  // MGET in slices, so one very long night does not become one enormous reply.
  for (let i = 0; i < keys.length; i += 100) {
    const slice = keys.slice(i, i + 100);
    const res = await kvPipeline([["MGET", ...slice]], STORE_TIMEOUT_MS);
    if (!res) return null;
    const values = Array.isArray(res[0]) ? res[0] : [];
    slice.forEach((key, n) => {
      try {
        const w = JSON.parse(String(values[n] ?? "")) as Watch;
        if (w && typeof w.email === "string" && Array.isArray(w.items)) out.push({ key, watch: w });
      } catch {
        /* a key whose value is gone or unreadable: skip it */
      }
    });
  }
  return out;
}

export async function writeWatch(key: string, w: Watch): Promise<boolean> {
  return (await kvPipeline([["SET", key, JSON.stringify(w)]], STORE_TIMEOUT_MS)) !== null;
}
