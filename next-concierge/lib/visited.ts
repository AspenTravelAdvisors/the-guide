/**
 * Properties and ships Aspen Travel Advisors has personally visited.
 *
 * The file at data/visited-properties.json is the only source of truth.
 * Matching lives in visited-match.mjs so the site and scripts/verify-visited.mjs
 * share one implementation. Entries marked confidence "uncertain" stay in the
 * file for the owner and are not claimed anywhere a traveler can see.
 *
 * How to add a place is in next-concierge/README.md, "Properties the advisors
 * have visited".
 */

import visitedFile from "@/data/visited-properties.json";
import { createVisitedIndex, visitedConfidence, visitedIsClaimed } from "./visited-match.mjs";

export type VisitedConfidence = "certain" | "likely" | "uncertain";

export interface VisitedListing {
  collection?: string;
  id?: string;
  vessel?: string;
  operator?: string;
}

export interface VisitedProperty {
  name: string;
  place?: string;
  kind?: string;
  source?: string;
  aliases?: string[];
  listings?: VisitedListing[];
  /** A date or a month, written however the note was kept ("2026-03", "March 2024"). */
  visited?: string | null;
  /** Insider tip. Shown on the property page, and passed to The Guide. */
  notes?: string | null;
  /** Image URLs. Shown on the property page when present. */
  photos?: string[];
  confidence?: VisitedConfidence;
  reviewNote?: string;
}

interface VisitedFile {
  _readme?: string;
  properties: VisitedProperty[];
}

const data = visitedFile as VisitedFile;
const index = createVisitedIndex(data.properties as unknown as Record<string, unknown>[]);

export const VISITED_PROPERTIES: readonly VisitedProperty[] = data.properties;

export { visitedConfidence, visitedIsClaimed };

export function visitsForRecord(raw: object | null | undefined): VisitedProperty[] {
  return index.visitsForRecord(raw);
}

export function hotelVisits(id: string | null | undefined): VisitedProperty[] {
  return index.hotelVisits(id);
}

/** Sets `advisorVisited` when this offering is one the advisors have been to. */
export function stampAdvisorVisited<T extends object>(offering: T): T {
  if (visitsForRecord(offering).length) {
    (offering as T & { advisorVisited?: boolean }).advisorVisited = true;
  }
  return offering;
}

/** Marks search results the model and the result cards both read. */
export function annotateVisitedPayload(payload: unknown): void {
  if (!payload || typeof payload !== "object") return;
  const record = payload as { results?: unknown; related?: unknown; hotels?: unknown };
  const walk = (results: unknown) => {
    if (!Array.isArray(results)) return;
    for (const item of results) {
      if (!item || typeof item !== "object") continue;
      if (visitsForRecord(item).length) {
        (item as { advisorVisited?: boolean }).advisorVisited = true;
      }
    }
  };
  walk(record.results);
  if (Array.isArray(record.related)) {
    for (const rel of record.related) {
      if (rel && typeof rel === "object") walk((rel as { results?: unknown }).results);
    }
  }
  if (record.hotels) annotateVisitedPayload(record.hotels);
}

/** The block appended to the Guide's system prompt. */
export function visitedGuideSection(): string {
  return index.visitedGuideSection();
}
