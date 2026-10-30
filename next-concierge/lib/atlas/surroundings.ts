/**
 * What stands around a hotel, for the flyover's automatic angle.
 *
 * lib/atlas/flyover.ts turns heights into a camera angle; this gathers the
 * heights. Two sources, because the two places the reel was found failing
 * fail for different reasons:
 *
 *   buildings  OpenStreetMap, through the public Overpass API: footprints with
 *              `height` or `building:levels`. Downtown San Francisco is mapped
 *              tower by tower; a small town may carry footprints without
 *              heights, which count as a modest two storeys rather than as
 *              nothing.
 *   terrain    Google's elevation service, already on the page for the
 *              camera's ground altitude, sampled on rings round the hotel —
 *              which is what puts Aspen Mountain behind The Little Nell.
 *
 * Both are best-effort with a deadline. Without them the shot falls back to
 * the reel's default angle, exactly as before this existed, so a slow
 * volunteer-run Overpass server can delay a take but never break one.
 */

import { groundAltitudes } from "./google3d";
import type { Obstacle } from "./flyover";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const OVERPASS_DEADLINE_MS = 7000;
/** A footprint with no height or levels: two storeys, not zero. */
const UNKNOWN_HEIGHT = 7;
const LEVEL_HEIGHT = 3.2;
/** A footprint this close to the hotel's point is taken to be the hotel. */
const SELF_RADIUS = 20;

const TERRAIN_BEARINGS = 36;
const TERRAIN_RINGS = [80, 160, 240, 320, 420];

export interface Building {
  from: number;
  to: number;
  distance: number;
  /** Height of its top above the hotel's ground, metres. */
  top: number;
}

export interface Survey {
  buildings: Building[];
  /** Terrain samples: height above the hotel's ground at bearing/distance. */
  terrain: { bearing: number; distance: number; top: number }[];
  /** The hotel's own height, when its footprint carries one. */
  hotelHeight: number | null;
  /** Which sources answered, for tune mode to say so. */
  sources: { buildings: boolean; terrain: boolean };
}

const norm = (deg: number) => ((deg % 360) + 360) % 360;

/** Metres east/north of the hotel — flat-earth, fine across a few hundred metres. */
function projector(lat0: number, lng0: number) {
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110540;
  return (lat: number, lng: number) => ({ x: (lng - lng0) * kx, y: (lat - lat0) * ky });
}

function parseHeight(tags: Record<string, string>): number | null {
  const raw = tags.height ?? tags["building:height"];
  if (raw) {
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n > 0) return /ft|'/.test(raw) ? n * 0.3048 : n;
  }
  const levels = parseFloat(tags["building:levels"] ?? "");
  if (Number.isFinite(levels) && levels > 0) {
    const roof = parseFloat(tags["roof:levels"] ?? "");
    return (levels + (Number.isFinite(roof) ? roof : 0)) * LEVEL_HEIGHT;
  }
  return null;
}

/** Distance from the origin to segment ab. */
function segDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / len)) : 0;
  return Math.hypot(a.x + t * dx, a.y + t * dy);
}

function containsOrigin(pts: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > 0 !== b.y > 0 && 0 < ((b.x - a.x) * (0 - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * The bearings a footprint spans as seen from the hotel: the arc left when the
 * widest gap between its corners' bearings is taken away.
 */
function bearingSpan(pts: { x: number; y: number }[]): { from: number; to: number } {
  const b = pts.map((p) => norm((Math.atan2(p.x, p.y) * 180) / Math.PI)).sort((m, n) => m - n);
  let gap = -1;
  let after = 0;
  for (let i = 0; i < b.length; i++) {
    const next = i + 1 < b.length ? b[i + 1] : b[0] + 360;
    if (next - b[i] > gap) {
      gap = next - b[i];
      after = i;
    }
  }
  return { from: b[(after + 1) % b.length], to: b[after] };
}

interface OsmWay {
  type: string;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

async function fetchBuildings(lat: number, lng: number, radius: number) {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), OVERPASS_DEADLINE_MS);
  try {
    const around = `(around:${Math.round(radius)},${lat},${lng})`;
    const query = `[out:json][timeout:8];(way["building"]${around};way["building:part"]${around};);out tags geom;`;
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      body: new URLSearchParams({ data: query }),
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
  const project = projector(lat, lng);
  const ring: { lat: number; lng: number; bearing: number; distance: number }[] = [];
  for (const distance of TERRAIN_RINGS) {
    for (let i = 0; i < TERRAIN_BEARINGS; i++) {
      const bearing = (360 * i) / TERRAIN_BEARINGS;
      const r = (bearing * Math.PI) / 180;
      ring.push({
        bearing,
        distance,
        lat: lat + (distance * Math.cos(r)) / 110540,
        lng: lng + (distance * Math.sin(r)) / (111320 * Math.cos((lat * Math.PI) / 180)),
      });
    }
  }

  const [ways, elevations] = await Promise.all([
    fetchBuildings(lat, lng, radius),
    groundAltitudes(ring.map(({ lat: a, lng: b }) => ({ lat: a, lng: b }))),
  ]);

  const buildings: Building[] = [];
  let hotelHeight: number | null = null;
  let nearest: { d: number; h: number | null; i: number } | null = null;
  for (const w of ways ?? []) {
    const geom = w.geometry;
    if (!geom || geom.length < 3) continue;
    const tags = w.tags ?? {};
    const isPart = !tags.building && !!tags["building:part"];
    const h = parseHeight(tags);
    // A part with no height adds nothing its outline does not already say.
    if (isPart && h == null) continue;
    const pts = geom.map((g) => project(g.lat, g.lon));
    if (containsOrigin(pts)) {
      // The hotel itself (or a part of it): its height, never an obstacle.
      if (h != null) hotelHeight = Math.max(hotelHeight ?? 0, h);
      continue;
    }
    let distance = Infinity;
    for (let i = 0; i < pts.length; i++) {
      distance = Math.min(distance, segDistance(pts[i], pts[(i + 1) % pts.length]));
    }
    buildings.push({ ...bearingSpan(pts), distance, top: h ?? UNKNOWN_HEIGHT });
    if (distance < SELF_RADIUS && (!nearest || distance < nearest.d)) {
      nearest = { d: distance, h, i: buildings.length - 1 };
    }
  }
  // The feed's point can fall in the street beside the building. With no
  // footprint around the point, the closest one within a few metres is the hotel.
  if (hotelHeight == null && nearest) {
    hotelHeight = nearest.h;
    buildings.splice(nearest.i, 1);
  }

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

/** The survey as obstacles to a camera looking at `aim` metres above the ground. */
export function obstaclesFrom(survey: Survey, aim: number): Obstacle[] {
  const half = 180 / TERRAIN_BEARINGS;
  return [
    ...survey.buildings.map((b) => ({ from: b.from, to: b.to, distance: b.distance, rise: b.top - aim })),
    ...survey.terrain.map((t) => ({
      from: norm(t.bearing - half),
      to: norm(t.bearing + half),
      distance: t.distance,
      rise: t.top - aim,
    })),
  ];
}

/** The tallest thing within `reach`, for tune mode to name. */
export function tallestNear(survey: Survey, reach: number) {
  let best: { top: number; bearing: number; distance: number; kind: "building" | "terrain" } | null = null;
  for (const b of survey.buildings) {
    if (b.distance > reach) continue;
    const bearing = norm(b.from + norm(b.to - b.from) / 2);
    if (!best || b.top > best.top) best = { top: b.top, bearing, distance: b.distance, kind: "building" };
  }
  for (const t of survey.terrain) {
    if (t.distance > reach) continue;
    if (!best || t.top > best.top) best = { top: t.top, bearing: t.bearing, distance: t.distance, kind: "terrain" };
  }
  return best;
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export function compass(bearing: number): string {
  return COMPASS[Math.round(norm(bearing) / 45) % 8];
}
