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
  /**
   * Tilt the reveal settles to. Kept apart from closeTilt because a hover that
   * had to look steeply down over its neighbours (see bestApproach) has no
   * neighbours left to clear at 3 km, and the reveal should lift toward the
   * horizon there rather than carry the plan view out with it.
   */
  revealTilt?: number;
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
  const revealTilt = clamp(num(opts.revealTilt, FLYOVER_CLOSE_TILT - 12), 10, MAX_TILT - 3);
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
    { t: 34, range: reveal, tilt: revealTilt },
    { t: 40, range: reveal * 1.08, tilt: revealTilt - 2 },
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

/* ── Clearance: when a hotel needs a steeper angle ──────────────────────────
 *
 * A short building in a tall city (the Palace in San Francisco) or at the foot
 * of a mountain (Aspen) is hidden by its surroundings from a camera at the
 * reel's 62°: the line from the camera to the hotel passes through a
 * neighbour. Whether it does is geometry, not taste. Anything standing `rise`
 * metres above the point the camera looks at, `distance` metres away, hides
 * that point from every camera on its side lower than atan(rise / distance)
 * above the horizontal. The camera's own elevation angle is 90° − tilt.
 *
 * So from the heights around the hotel (components/HotelFlyover gathers them:
 * buildings from OpenStreetMap, terrain from Google's elevation service) this
 * builds the angle each side of the building needs, then picks the side the
 * hover should walk round and the tilt that clears it. The orbit only covers
 * ~150° of the building, so a hotel boxed in on three sides can still be shot
 * from its open fourth — Market Street, the beach, the valley floor.
 */

export interface Obstacle {
  /** Bearings from the hotel, degrees clockwise from north, of its two edges. */
  from: number;
  to: number;
  /** Horizontal distance from the hotel to its nearest point, metres. */
  distance: number;
  /** Height of its top above the point the camera looks at, metres. */
  rise: number;
}

export interface Approach {
  /** The `heading` option that puts the hover on the clearest side. */
  heading: number;
  /** The hover tilt that clears that side, never steeper than MIN_AUTO_TILT. */
  tilt: number;
  /** Elevation angle the worst point of that side needs, degrees. */
  need: number;
  /** False when even MIN_AUTO_TILT does not clear it: the best there is. */
  clear: boolean;
}

export const CLEARANCE_BINS = 72;
/** Degrees of daylight kept over the top of whatever is in the way. */
const CLEARANCE_MARGIN = 5;
/** The steepest the automatic angle goes. Steeper is a plan view, not a hotel. */
export const MIN_AUTO_TILT = 30;

const norm = (deg: number) => ((deg % 360) + 360) % 360;
const DEG = 180 / Math.PI;

/**
 * The elevation angle a camera needs to see over everything on each side of
 * the hotel, in CLEARANCE_BINS bins by bearing from the hotel. Only what
 * stands within `reach` counts: anything further away is behind the camera.
 */
export function clearanceProfile(obstacles: Obstacle[], reach: number): number[] {
  const width = 360 / CLEARANCE_BINS;
  const need = new Array<number>(CLEARANCE_BINS).fill(0);
  for (const o of obstacles) {
    if (!(o.distance <= reach) || !(o.rise > 0)) continue;
    const angle = Math.atan2(o.rise, Math.max(o.distance, 1)) * DEG;
    const start = norm(o.from);
    const span = norm(o.to - o.from);
    for (let b = 0; b < CLEARANCE_BINS; b++) {
      const centre = (b + 0.5) * width;
      const inside = norm(centre - start) <= span;
      // A narrow tower can fall between two bin centres; it still blocks.
      const edge = b === Math.floor(start / width) || b === Math.floor(norm(o.to) / width);
      if ((inside || edge) && angle > need[b]) need[b] = angle;
    }
  }
  return need;
}

/** Bearings the hover covers, relative to the plan's `heading`. */
function hoverOffsets(plan: FlyoverPlan): number[] {
  const out: number[] = [];
  const { hover, reveal } = plan.marks;
  for (let i = 0; i <= 24; i++) {
    const cam = flyoverCamera(plan, hover + ((reveal - hover) * i) / 24);
    out.push(norm(cam.heading - plan.heading));
  }
  return out;
}

/**
 * The side to hover on and the tilt to hover at.
 *
 * Every starting heading is tried in 5° steps; the one whose hover arc needs
 * the least elevation wins, then the one needing least on average, then the
 * one nearest the heading asked for — so a hotel with nothing around it keeps
 * the framing it was given instead of being turned for no reason. `only`
 * pins the heading (one set by hand) and asks just for the tilt it needs.
 */
export function bestApproach(plan: FlyoverPlan, profile: number[], only?: number): Approach {
  const base = plan.keys[1].tilt;
  const push = plan.keys[2].tilt - base;
  const offsets = hoverOffsets(plan);
  const width = 360 / profile.length;
  let best = { heading: plan.heading, worst: Infinity, mean: Infinity, off: Infinity };
  const candidates =
    only != null && Number.isFinite(only) ? [norm(only)] : Array.from({ length: 72 }, (_, i) => i * 5);
  for (const h of candidates) {
    let worst = 0;
    let sum = 0;
    for (const o of offsets) {
      // The camera stands opposite the way it faces.
      const bearing = norm(h + o + 180);
      const n = profile[Math.floor(bearing / width) % profile.length] || 0;
      worst = Math.max(worst, n);
      sum += n;
    }
    const mean = sum / offsets.length;
    const off = Math.abs(norm(h - plan.heading + 180) - 180);
    const better =
      worst < best.worst - 0.5 ||
      (Math.abs(worst - best.worst) <= 0.5 &&
        (mean < best.mean - 0.5 || (Math.abs(mean - best.mean) <= 0.5 && off < best.off)));
    if (better) best = { heading: h, worst, mean, off };
  }
  // The hover tilts up by `push` as it closes in; clear the steeper end of it.
  const wanted = 90 - best.worst - CLEARANCE_MARGIN - push;
  return {
    heading: best.heading,
    tilt: clamp(Math.min(base, wanted), MIN_AUTO_TILT, base),
    need: best.worst,
    clear: wanted >= MIN_AUTO_TILT,
  };
}

/**
 * The options that make the middle of the hover pass through `view` — what
 * tune mode saves when the operator has found the frame by hand. The middle,
 * not the start, so the shot turns through the chosen frame rather than
 * leaving it.
 */
export function optionsForView(
  plan: FlyoverPlan,
  view: FlyoverCamera,
): Required<Pick<FlyoverOptions, "closeRange" | "closeTilt" | "heading">> {
  const mid = flyoverCamera(plan, (plan.marks.hover + plan.marks.reveal) / 2);
  const close = plan.keys[1];
  return {
    closeRange: Math.round(view.range * (close.range / mid.range)),
    closeTilt: Math.round((view.tilt - (mid.tilt - close.tilt)) * 10) / 10,
    heading: Math.round(norm(view.heading - (mid.heading - plan.heading))),
  };
}
