/**
 * What stands around a hotel: the geometry, with no fetching in it.
 *
 * Shared by the browser (lib/atlas/surroundings.ts, a live survey when a hotel
 * has no stored framing) and the build (scripts/build-flyover-framing.mjs,
 * which stores one for every hotel). Pure functions over OpenStreetMap
 * footprints and terrain samples, so both get the same answer, and so this
 * file runs in Node with its types stripped — it has no imports a stripped
 * file could not resolve (the one below is a type, and is erased).
 */

import type { Obstacle } from "./flyover";

export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
/** How far round the hotel to look. Past the hover camera nothing can block it. */
export const SURVEY_RADIUS = 420;
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

export interface OsmWay {
  type: string;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

const norm = (deg: number) => ((deg % 360) + 360) % 360;

/** The Overpass query for every building footprint within `radius` of a point. */
export function overpassQuery(lat: number, lng: number, radius = SURVEY_RADIUS): string {
  const around = `(around:${Math.round(radius)},${lat},${lng})`;
  return `[out:json][timeout:20];(way["building"]${around};way["building:part"]${around};);out tags geom;`;
}

/** Metres east/north of the hotel — flat-earth, fine across a few hundred metres. */
function projector(lat0: number, lng0: number) {
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110540;
  return (lat: number, lng: number) => ({ x: (lng - lng0) * kx, y: (lat - lat0) * ky });
}

export function parseHeight(tags: Record<string, string>): number | null {
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

/** OpenStreetMap footprints → obstacles round the hotel, and the hotel's own height. */
export function buildingsFrom(
  ways: OsmWay[],
  lat: number,
  lng: number,
): { buildings: Building[]; hotelHeight: number | null } {
  const project = projector(lat, lng);
  const buildings: Building[] = [];
  let hotelHeight: number | null = null;
  let nearest: { d: number; h: number | null; i: number } | null = null;
  for (const w of ways) {
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
  return { buildings, hotelHeight };
}

/** Where to sample the ground: rings of bearings round the hotel. */
export function terrainRing(lat: number, lng: number) {
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
  return ring;
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
