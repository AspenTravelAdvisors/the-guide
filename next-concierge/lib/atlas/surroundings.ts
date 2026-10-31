/**
 * A live survey of what stands around a hotel, from the browser.
 *
 * Most hotels have a stored framing (data/atlas/hotel/flyover-framing.json,
 * built by scripts/build-flyover-framing.mjs) and never need this. It runs for
 * the ones that do not, and in tune mode, where the operator wants to see what
 * the survey found. The geometry is lib/atlas/surroundings-core.ts, shared
 * with the build; this file only fetches:
 *
 *   buildings  OpenStreetMap, through the public Overpass API.
 *   terrain    Google's elevation service, already on the page for the
 *              camera's ground altitude.
 *
 * Both are best-effort with a deadline. Without them the shot falls back to
 * the reel's default angle, so a slow volunteer-run Overpass server can delay
 * a take but never break one.
 */

import { groundAltitudes } from "./google3d";
import {
  OVERPASS_URL,
  buildingsFrom,
  overpassQuery,
  terrainRing,
  type OsmWay,
  type Survey,
} from "./surroundings-core";

export { compass, obstaclesFrom, tallestNear, SURVEY_RADIUS, type Survey } from "./surroundings-core";

const OVERPASS_DEADLINE_MS = 7000;

async function fetchBuildings(lat: number, lng: number, radius: number): Promise<OsmWay[] | null> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), OVERPASS_DEADLINE_MS);
  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      body: new URLSearchParams({ data: overpassQuery(lat, lng, radius) }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { elements?: OsmWay[] };
    return json.elements ?? [];
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Survey everything within `radius` metres of the hotel. */
export async function surveySurroundings(
  lat: number,
  lng: number,
  ground: number,
  radius: number,
): Promise<Survey> {
  const ring = terrainRing(lat, lng);
  const [ways, elevations] = await Promise.all([
    fetchBuildings(lat, lng, radius),
    groundAltitudes(ring.map(({ lat: a, lng: b }) => ({ lat: a, lng: b }))),
  ]);
  const { buildings, hotelHeight } = buildingsFrom(ways ?? [], lat, lng);
  const terrain = elevations
    ? ring.map((p, i) => ({ bearing: p.bearing, distance: p.distance, top: elevations[i] - ground }))
    : [];
  return {
    buildings,
    terrain,
    hotelHeight,
    sources: { buildings: ways != null, terrain: elevations != null },
  };
}
