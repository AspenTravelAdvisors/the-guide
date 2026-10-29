/**
 * The hotel flyover's choreography: one continuous camera move, as a pure
 * function of time.
 *
 * `/demo/hotel` (components/HotelFlyover) films a single property in Google
 * Photorealistic 3D for a reel or to send to a lead. The globe demo
 * (lib/demo.ts) sells the breadth of the catalogue; this sells the depth of one
 * entry — the view nothing but photogrammetry can give.
 *
 * The shot, in three movements:
 *
 *   glide    Open already close: a short drift down onto the building, so the
 *            first frame of the reel is the hotel itself rather than a map.
 *   hover    The close orbit. Inside INSPECT_RANGE (450 m), down where Google's
 *            mesh holds its real detail — façade, terraces, pool deck — and
 *            pushing slowly closer still as it turns.
 *   reveal   The pull-back. Range climbs an order of magnitude while the turn
 *            carries on, so the setting arrives around the building: the
 *            beach, the square, the ridge, the city. That is the payoff the
 *            hover is withholding.
 *
 * Nothing here touches the DOM, so scripts/verify-flyover.mjs can play it
 * forward frame by frame and check the claims a reel depends on: no jumps, no
 * reversals, and a hover that really is that close.
 */

export interface FlyoverOptions {
  /** Closest range of the hover, metres. The push-in ends a little inside it. */
  closeRange?: number;
  /** Tilt through the hover, degrees from straight down. */
  closeTilt?: number;
  /** Range the reveal pulls back to, metres. */
  revealRange?: number;
  /** Heading of the first frame, degrees. */
  heading?: number;
  /** Turn rate at cruise, degrees per second (at speed 1). */
  turn?: number;
  /** 1 is the reel's own pace; 0.75 is slower, 1.5 faster. */
  speed?: number;
}

export interface FlyoverCamera {
  range: number;
  tilt: number;
  heading: number;
}

interface Key {
  /** Seconds at speed 1. */
  t: number;
  range: number;
  tilt: number;
}

export interface FlyoverPlan {
  /** Total length in milliseconds, at the requested speed. */
  durationMs: number;
  /** Where each movement begins, milliseconds. */
  marks: { hover: number; reveal: number; end: number };
  keys: Key[];
  heading: number;
  turn: number;
  speed: number;
}

/*
 * The defaults are a reel's numbers.
 *
 * 240 m sits between INSPECT_RANGE (450 m, where a card opens) and the ~150 m
 * floor below which the mesh stops gaining detail and a tall building starts
 * to overrun the frame; the push-in ends at 0.82 of it, about 200 m. Tilt 62°
 * is a three-quarter view that still keeps the ground near the hotel in frame.
 * 3,200 m is the reveal because it holds a neighbourhood and its coastline or
 * skyline without turning back into a map.
 *
 * 9°/s turns the hover through roughly 150° — enough to walk round to the
 * other side of the building, short of a full lap that would show the same
 * façade twice.
 */
export const FLYOVER_CLOSE_RANGE = 240;
export const FLYOVER_CLOSE_TILT = 62;
export const FLYOVER_REVEAL_RANGE = 3200;
export const FLYOVER_TURN = 9;
/** The push-in, as a fraction of closeRange. */
const PUSH = 0.82;
/** Turn ease-in and ease-out, seconds at speed 1. */
const TURN_IN = 2;
const TURN_OUT = 4;

/** Google clamps hard below this and NaN blanks the element. */
const MIN_RANGE = 80;
/** The engine's own ceiling for a close camera (google3d DETAIL_TILT). */
const MAX_TILT = 67;

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);
const num = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
/** Ease in and out: zero velocity at both ends of every segment. */
const smooth = (x: number) => {
  const c = clamp(x, 0, 1);
  return c * c * c * (c * (c * 6 - 15) + 10);
};

export function flyoverPlan(opts: FlyoverOptions = {}): FlyoverPlan {
  const close = clamp(num(opts.closeRange, FLYOVER_CLOSE_RANGE), MIN_RANGE / PUSH, 2000);
  const tilt = clamp(num(opts.closeTilt, FLYOVER_CLOSE_TILT), 20, MAX_TILT - 3);
  const reveal = clamp(num(opts.revealRange, FLYOVER_REVEAL_RANGE), close * 4, 40000);
  const speed = clamp(num(opts.speed, 1), 0.25, 4);
  const turn = clamp(num(opts.turn, FLYOVER_TURN), 0, 45);
  const heading = ((num(opts.heading, 30) % 360) + 360) % 360;

  /*
   * Glide → hover → push → reveal → drift. The drift keeps the camera moving
   * under the end card: a frame that freezes the moment the text arrives reads
   * as the video having stalled.
   */
  const keys: Key[] = [
    { t: 0, range: close * 2.2, tilt: tilt - 6 },
    { t: 6, range: close, tilt },
    { t: 22, range: close * PUSH, tilt: Math.min(tilt + 3, MAX_TILT) },
    { t: 34, range: reveal, tilt: tilt - 12 },
    { t: 40, range: reveal * 1.08, tilt: tilt - 14 },
  ];
  const ms = (s: number) => Math.round((s * 1000) / speed);
  return {
    durationMs: ms(keys[keys.length - 1].t),
    marks: { hover: ms(keys[1].t), reveal: ms(keys[2].t), end: ms(keys[3].t) },
    keys,
    heading,
    turn,
    speed,
  };
}

/**
 * Seconds of full-rate turning by time `t`, with the turn eased in at the start
 * and out at the end — the integral of a smoothstep envelope, in closed form so
 * that any frame can be computed without replaying the ones before it.
 */
function turnedSeconds(t: number, total: number): number {
  const rin = Math.min(TURN_IN, total / 2);
  const rout = Math.min(TURN_OUT, total / 2);
  // ∫₀ˣ (3u² − 2u³) du = x³ − x⁴/2
  const F = (x: number) => x * x * x - (x * x * x * x) / 2;
  const tc = clamp(t, 0, total);
  const full = rin / 2 + (total - rin - rout) + rout / 2;
  if (tc <= rin) return rin * F(tc / rin);
  if (tc >= total - rout) return full - rout * F((total - tc) / rout);
  return rin / 2 + (tc - rin);
}

/** The camera at `ms` into the shot. Past the end it holds the last frame. */
export function flyoverCamera(plan: FlyoverPlan, ms: number): FlyoverCamera {
  // Work in speed-1 seconds; the plan's keys are written in them.
  const t = clamp((num(ms, 0) / 1000) * plan.speed, 0, plan.keys[plan.keys.length - 1].t);
  const { keys } = plan;
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const p = smooth((t - a.t) / (b.t - a.t || 1));
  // Range in log space: 200 m → 3 km reads as one even pull-back, where a
  // linear one crawls off the building and then lurches out to sea.
  const range = Math.exp(Math.log(a.range) + (Math.log(b.range) - Math.log(a.range)) * p);
  const tilt = a.tilt + (b.tilt - a.tilt) * p;
  const total = keys[keys.length - 1].t;
  const heading = (plan.heading + plan.turn * turnedSeconds(t, total)) % 360;
  return { range: Math.max(MIN_RANGE, range), tilt: clamp(tilt, 0, MAX_TILT), heading };
}

/**
 * Where to park the camera while the tiles are fetched before the take.
 *
 * Google streams the mesh for what is in front of the camera, and a building
 * seen only from one side is still low-detail on the others when the orbit
 * comes round to them. So the warm-up looks at the hotel from four sides at
 * hover distance, then from the reveal's height, and parks on the first frame.
 */
export function flyoverWarmup(plan: FlyoverPlan): FlyoverCamera[] {
  const hover = flyoverCamera(plan, plan.marks.reveal);
  const sides = [0, 90, 180, 270].map((d) => ({
    range: hover.range,
    tilt: hover.tilt,
    heading: (plan.heading + d) % 360,
  }));
  return [
    ...sides,
    flyoverCamera(plan, (plan.marks.reveal + plan.marks.end) / 2),
    flyoverCamera(plan, plan.durationMs),
    flyoverCamera(plan, 0),
  ];
}
