/**
 * How to look at one hotel: its stored framing.
 *
 * Every photoreal view of a hotel used to arrive the same way — 450 m out,
 * 55° down, facing north — whatever stood around it. That frames a resort on
 * an open beach well and hides a six-storey hotel among towers completely.
 * The survey (lib/atlas/surroundings-core) knows which side is open and how
 * steeply the camera has to look to see over the rest; this turns it into the
 * numbers each view needs, so the build can store them per hotel
 * (data/atlas/hotel/flyover-framing.json) and no visitor waits on a survey.
 *
 * Three views read it:
 *   the atlas arrival     a card opens on the photoreal engine (Atlas3DLayer)
 *   the panel's Flyover   the short cut, played in place
 *   the reel              /demo/hotel
 */

import {
  FLYOVER_CLOSE_RANGE,
  bestApproach,
  clearanceProfile,
  flyoverPlan,
  hoverBearing,
} from "./flyover";
import { obstaclesFrom, type Survey } from "./surroundings-core";

export interface HotelFraming {
  /** The open side: bearing from the hotel to the camera mid-hover, degrees. */
  bearing: number;
  /** Hover tilt that clears that side, degrees from straight down. */
  tilt: number;
  /** Closest hover range, metres. */
  range: number;
  /** Height above the ground the camera looks at, metres. */
  lift: number;
  /** The atlas's arrival when a card opens. Its slow orbit sees every side. */
  arrive: { range: number; tilt: number };
  /** The hotel's mapped height, metres, when OpenStreetMap carries one. */
  height: number | null;
  /** False when boxed in: the steepest allowed angle still clips something. */
  clear: boolean;
}

/** Looked-at height with nothing better to go on: a low-rise façade. */
export const DEFAULT_LIFT = 15;
/** Above this a hotel is a tower, and every view keeps its distance. */
const TOWER = 45;

/*
 * The arrival.
 *
 * 340 m for a hotel with room round it — inside google3d's 450 m default,
 * which was chosen blind to contain whatever might be there, and close enough
 * that the mesh is the building rather than the block. A tower keeps back by
 * its own height. The arrival orbits all the way round, so unlike the reel it
 * cannot just pick the open side: its tilt clears all but the worst 15% of
 * bearings (one tower on one side should not turn every hotel beside it into a
 * plan view), between 35° and google3d's INSPECT_TILT of 55°.
 */
const ARRIVE_RANGE = 340;
const ARRIVE_TILT_MAX = 55;
const ARRIVE_TILT_MIN = 35;
const ARRIVE_PERCENTILE = 0.85;
const MARGIN = 5;
/** How far past the camera's range an obstacle still counts. */
const REACH = 1.15;

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

export function framingFromSurvey(survey: Survey): HotelFraming {
  const h = survey.hotelHeight;
  const tower = h != null && h > TOWER;
  const lift = h != null ? clamp(h * 0.45, 10, 200) : DEFAULT_LIFT;
  const obstacles = obstaclesFrom(survey, lift);

  // The reel and the Flyover: the open side, and the tilt that clears it.
  const range = tower ? Math.max(FLYOVER_CLOSE_RANGE, h! * 1.9) : FLYOVER_CLOSE_RANGE;
  const plan = flyoverPlan({ closeRange: range });
  const approach = bestApproach(plan, clearanceProfile(obstacles, range * REACH));
  const bearing = hoverBearing(flyoverPlan({ closeRange: range, heading: approach.heading }));

  // The atlas arrival.
  const arriveRange = tower ? Math.max(ARRIVE_RANGE, h! * 2.2) : ARRIVE_RANGE;
  const profile = clearanceProfile(obstacles, arriveRange * REACH).slice().sort((a, b) => a - b);
  const need = profile[Math.floor((profile.length - 1) * ARRIVE_PERCENTILE)] ?? 0;
  const arriveTilt = clamp(90 - need - MARGIN, ARRIVE_TILT_MIN, ARRIVE_TILT_MAX);

  return {
    bearing: Math.round(bearing),
    tilt: Math.round(approach.tilt * 10) / 10,
    range: Math.round(range),
    lift: Math.round(lift),
    arrive: { range: Math.round(arriveRange), tilt: Math.round(arriveTilt) },
    height: h != null ? Math.round(h) : null,
    clear: approach.clear,
  };
}

/** The stored file: framings by hotel id, and when each was surveyed. */
export interface FramingFile {
  version: 1;
  hotels: Record<string, HotelFraming & { at: string }>;
}
