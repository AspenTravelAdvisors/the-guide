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

if (failed) {
  console.error(`\nverify-flyover: ${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nverify-flyover: all checks passed");
