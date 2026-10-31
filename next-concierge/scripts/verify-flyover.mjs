/**
 * The hotel flyover's shot: does the camera do what the reel needs?
 *
 * `/demo/hotel` is filmed, so its failures are the ones a viewer sees in the
 * first second and nobody catches by reading code: a frame where the camera
 * jumps, a turn that stutters or reverses, a "close" hover that is actually at
 * neighbourhood distance, a reveal that stops short. All of them live in the
 * motion, so this plays the real choreography (lib/atlas/flyover.ts, imported
 * as-is — Node strips its types) forward at 60 fps and checks it frame by
 * frame, at the default pace and at the other speeds the URL allows.
 *
 *   node scripts/verify-flyover.mjs
 */

import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const { flyoverPlan, flyoverCamera, flyoverWarmup, FLYOVER_CLOSE_RANGE } = await import(
  pathToFileURL(join(ROOT, "lib/atlas/flyover.ts")).href
);

let failed = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

/** Shortest signed difference between two headings. */
const turnDelta = (a, b) => ((b - a + 540) % 360) - 180;

function play(plan) {
  const frames = [];
  for (let t = 0; t <= plan.durationMs + 1; t += 1000 / 60) frames.push({ t, ...flyoverCamera(plan, t) });
  return frames;
}

for (const speed of [1, 0.75, 1.5]) {
  const plan = flyoverPlan({ speed });
  const frames = play(plan);
  const tag = `speed ${speed}`;

  check(
    `${tag}: every frame is a real camera`,
    frames.every((f) => [f.range, f.tilt, f.heading].every(Number.isFinite)),
  );

  // Continuity. At 60 fps no frame may move range by more than a few percent
  // or tilt by more than a fraction of a degree — anything more is a cut.
  let worstRange = 0;
  let worstTilt = 0;
  let worstTurn = 0;
  let reversed = 0;
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1];
    const b = frames[i];
    worstRange = Math.max(worstRange, Math.abs(Math.log(b.range / a.range)));
    worstTilt = Math.max(worstTilt, Math.abs(b.tilt - a.tilt));
    const d = turnDelta(a.heading, b.heading);
    worstTurn = Math.max(worstTurn, Math.abs(d));
    if (d < -1e-9) reversed++;
  }
  check(`${tag}: no frame jumps in range`, worstRange < 0.02, `worst ${(worstRange * 100).toFixed(2)}%/frame`);
  check(`${tag}: no frame jumps in tilt`, worstTilt < 0.2, `worst ${worstTilt.toFixed(3)}°/frame`);
  check(`${tag}: the turn never reverses`, reversed === 0, `${reversed} frames turn backwards`);
  check(`${tag}: the turn never whips`, worstTurn < 0.5, `worst ${worstTurn.toFixed(3)}°/frame`);

  // The turn eases in and out rather than starting and stopping dead.
  const d0 = Math.abs(turnDelta(frames[0].heading, frames[1].heading));
  const dn = Math.abs(turnDelta(frames.at(-2).heading, frames.at(-1).heading));
  check(`${tag}: the turn eases in and out`, d0 < 0.01 && dn < 0.01, `first ${d0}, last ${dn}`);

  // The hover is close — inside the atlas's own inspection range (450 m) for
  // all of it, and at its tightest under the default close range.
  const hover = frames.filter((f) => f.t >= plan.marks.hover && f.t <= plan.marks.reveal);
  const hoverMax = Math.max(...hover.map((f) => f.range));
  const hoverMin = Math.min(...hover.map((f) => f.range));
  check(`${tag}: the whole hover is inside 450 m`, hoverMax <= 450, `reaches ${hoverMax.toFixed(0)} m`);
  check(`${tag}: the hover pushes in past its close range`, hoverMin < FLYOVER_CLOSE_RANGE, `${hoverMin.toFixed(0)} m`);
  const hoverTurn = Math.abs(
    hover.slice(1).reduce((s, f, i) => s + turnDelta(hover[i].heading, f.heading), 0),
  );
  check(
    `${tag}: the hover walks round the building without lapping it`,
    hoverTurn >= 90 && hoverTurn < 360,
    `${hoverTurn.toFixed(0)}°`,
  );

  // The reveal opens up an order of magnitude, and keeps going under the card.
  const atEnd = flyoverCamera(plan, plan.marks.end);
  check(`${tag}: the reveal pulls back at least 10×`, atEnd.range >= hoverMin * 10, `${atEnd.range.toFixed(0)} m`);
  const last = frames.at(-1);
  check(`${tag}: the camera still drifts under the end card`, last.range > atEnd.range);
  const out = frames.filter((f) => f.t >= plan.marks.reveal);
  check(
    `${tag}: once pulling back, it never pushes in again`,
    out.every((f, i) => i === 0 || f.range >= out[i - 1].range - 1e-9),
  );

  // The tilt never exceeds what the engine allows a close camera (DETAIL_TILT).
  check(`${tag}: tilt stays legal`, frames.every((f) => f.tilt >= 0 && f.tilt <= 67));

  // Past the end the camera holds rather than snapping somewhere.
  const held = flyoverCamera(plan, plan.durationMs + 5000);
  check(
    `${tag}: past the end the frame holds`,
    Math.abs(held.range - last.range) < 1e-6 && Math.abs(turnDelta(held.heading, last.heading)) < 0.01,
  );

  // The warm-up visits the hotel from four sides at hover distance, and parks
  // on the first frame so the take starts where the warm-up left the camera.
  const warm = flyoverWarmup(plan);
  const sides = new Set(warm.filter((c) => c.range <= 450).map((c) => Math.round(c.heading / 90) % 4));
  check(`${tag}: the warm-up sees the hotel from four sides`, sides.size === 4);
  const park = warm.at(-1);
  const f0 = flyoverCamera(plan, 0);
  check(
    `${tag}: the warm-up parks on the first frame`,
    park.range === f0.range && park.tilt === f0.tilt && park.heading === f0.heading,
  );
}

// The URL's tuning is clamped, never trusted: nonsense must still make a shot.
for (const opts of [
  { closeRange: -5, closeTilt: 400, revealRange: 0, speed: 0, turn: "fast" },
  { closeRange: Infinity, heading: -725, speed: 99 },
  { closeRange: 120, revealRange: 200 },
]) {
  const plan = flyoverPlan(opts);
  const frames = play(plan);
  check(
    `tuning ${JSON.stringify(opts)} still makes a valid shot`,
    plan.durationMs > 0 &&
      frames.every((f) => [f.range, f.tilt, f.heading].every(Number.isFinite) && f.range >= 80 && f.tilt <= 67) &&
      flyoverCamera(plan, plan.marks.end).range > flyoverCamera(plan, plan.marks.reveal).range,
  );
}

// ── Clearance: the automatic angle ──────────────────────────────────────────
{
  const {
    clearanceProfile,
    bestApproach,
    optionsForView,
    MIN_AUTO_TILT,
  } = await import(pathToFileURL(join(ROOT, "lib/atlas/flyover.ts")).href);
  const plan = flyoverPlan();
  const reach = plan.keys[1].range * 1.15;
  const norm = (d) => ((d % 360) + 360) % 360;
  /** Camera bearings (from the hotel) the hover passes through for a heading. */
  const hoverBearings = (h) => {
    const p = flyoverPlan({ heading: h });
    const out = [];
    for (let i = 0; i <= 24; i++) {
      const t = p.marks.hover + ((p.marks.reveal - p.marks.hover) * i) / 24;
      out.push(norm(flyoverCamera(p, t).heading + 180));
    }
    return out;
  };

  // Nothing around it: the framing asked for is kept exactly.
  const open = bestApproach(plan, clearanceProfile([], reach));
  check("an open site keeps the requested heading and tilt", open.heading === plan.heading && open.tilt === plan.keys[1].tilt && open.clear);

  // Obstacles beyond the camera are behind it and must not steepen anything.
  const far = bestApproach(plan, clearanceProfile([{ from: 0, to: 359, distance: reach + 50, rise: 300 }], reach));
  check("towers behind the camera are ignored", far.tilt === plan.keys[1].tilt);

  // The Palace case: towers close to the north, mid-rise blocks either side,
  // and only 100° of the south open — narrower than the ~150° the hover walks,
  // so the sides have to be cleared by looking down over them.
  const boxed = [
    { from: 270, to: 90, distance: 35, rise: 100 },
    { from: 60, to: 130, distance: 60, rise: 60 },
    { from: 230, to: 300, distance: 60, rise: 60 },
  ];
  const prof = clearanceProfile(boxed, reach);
  const a = bestApproach(plan, prof);
  const bearings = hoverBearings(a.heading);
  check(
    "a hotel boxed in on three sides is shot from its open side",
    bearings.every((b) => b > 85 && b < 275),
    `hover passes bearings ${Math.round(Math.min(...bearings))}–${Math.round(Math.max(...bearings))}`,
  );
  check("…and steeper than the default, to clear the side buildings", a.tilt < plan.keys[1].tilt && a.tilt >= MIN_AUTO_TILT, `tilt ${a.tilt}`);
  // Whatever it chose actually clears: camera elevation over every obstacle it passes.
  const elev = 90 - (a.tilt + (plan.keys[2].tilt - plan.keys[1].tilt));
  const worstNeed = Math.max(...bearings.map((b) => prof[Math.floor(b / 5) % 72]));
  check("…and the chosen tilt clears everything the hover passes", !a.clear || elev >= worstNeed, `${elev}° vs ${worstNeed}°`);

  // Hemmed in everywhere: steepest allowed, and it says so rather than pretending.
  const canyon = bestApproach(plan, clearanceProfile([{ from: 0, to: 359.9, distance: 25, rise: 150 }], reach));
  check("a canyon on every side stops at the steepest allowed tilt and says so", canyon.tilt === MIN_AUTO_TILT && !canyon.clear);

  // A narrow tower between bin centres still counts.
  const thin = clearanceProfile([{ from: 101, to: 102, distance: 50, rise: 80 }], reach);
  check("a tower narrower than one bin still blocks its bearing", thin[20] > 50);

  // A heading pinned by hand is kept; only the tilt is worked out.
  const pinned = bestApproach(plan, prof, 123);
  check("a hand-set heading is kept", pinned.heading === 123);

  // Tune mode's round trip: the saved options put the mid-hover on the view.
  for (const view of [{ range: 300, tilt: 50, heading: 200 }, { range: 180, tilt: 40, heading: 5 }]) {
    const p2 = flyoverPlan(optionsForView(plan, view));
    const mid = flyoverCamera(p2, (p2.marks.hover + p2.marks.reveal) / 2);
    check(
      `tune link for ${JSON.stringify(view)} passes back through it`,
      Math.abs(mid.range - view.range) / view.range < 0.01 &&
        Math.abs(mid.tilt - view.tilt) < 0.2 &&
        Math.abs(norm(mid.heading - view.heading + 180) - 180) < 1,
      JSON.stringify(mid),
    );
  }

  // A steep auto tilt still makes a smooth shot that lifts toward the horizon on the way out.
  const steep = flyoverPlan({ closeTilt: MIN_AUTO_TILT });
  const sf = play(steep);
  let jump = 0;
  for (let i = 1; i < sf.length; i++) jump = Math.max(jump, Math.abs(sf[i].tilt - sf[i - 1].tilt));
  check("a steep hover still never jumps in tilt", jump < 0.2, `${jump}`);
  check(
    "a steep hover's reveal lifts back toward the horizon",
    flyoverCamera(steep, steep.marks.end).tilt > flyoverCamera(steep, steep.marks.reveal).tilt + 10,
  );
}

// ── The atlas cut: the hotel panel's Flyover ────────────────────────────────
{
  const { flyoverShortPlan, hoverBearing } = await import(pathToFileURL(join(ROOT, "lib/atlas/flyover.ts")).href);
  const norm = (d) => ((d % 360) + 360) % 360;
  for (const [from, bearing] of [
    [{ range: 450, tilt: 55, heading: 300 }, undefined],
    [{ range: 450, tilt: 55, heading: 300 }, 180],
    [{ range: 3000, tilt: 20, heading: 10 }, 350],
  ]) {
    const plan = flyoverShortPlan(from, { bearing });
    const frames = play(plan);
    const tag = `atlas cut from ${from.range} m @${from.heading}°${bearing != null ? ` to the ${bearing}° side` : ""}`;
    const f0 = frames[0];
    check(
      `${tag}: starts exactly where the atlas camera is`,
      Math.abs(f0.range - from.range) < 1e-6 && Math.abs(f0.tilt - from.tilt) < 1e-6 && Math.abs(turnDelta(f0.heading, from.heading)) < 1e-6,
    );
    let jr = 0, jt = 0, jh = 0;
    for (let i = 1; i < frames.length; i++) {
      jr = Math.max(jr, Math.abs(Math.log(frames[i].range / frames[i - 1].range)));
      jt = Math.max(jt, Math.abs(frames[i].tilt - frames[i - 1].tilt));
      jh = Math.max(jh, Math.abs(turnDelta(frames[i - 1].heading, frames[i].heading)));
    }
    check(`${tag}: no jumps`, jr < 0.03 && jt < 0.3 && jh < 1, `range ${jr.toFixed(3)}, tilt ${jt.toFixed(2)}, turn ${jh.toFixed(2)}`);
    check(`${tag}: about twenty seconds`, plan.durationMs >= 18000 && plan.durationMs <= 26000);
    const hover = frames.filter((f) => f.t >= plan.marks.hover && f.t <= plan.marks.reveal);
    check(`${tag}: the hover is close`, Math.max(...hover.map((f) => f.range)) <= 300);
    check(`${tag}: and it pulls back to show the setting`, frames.at(-1).range >= 2000);
    if (bearing != null) {
      const mid = flyoverCamera(plan, (plan.marks.hover + plan.marks.reveal) / 2);
      check(`${tag}: the hover is on the side asked for`, Math.abs(turnDelta(norm(mid.heading + 180), bearing)) < 3, `${norm(mid.heading + 180)}`);
    }
  }
}

if (failed) {
  console.error(`\nverify-flyover: ${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nverify-flyover: all checks passed");
