/**
 * The home globe's demonstration — one script, four ways in.
 *
 * It exists because the legend is a FOCUS control (see soloLayer in
 * AtlasShell): it shows one collection or all of them, never "these three so
 * far", so the one story the globe tells best — watch it fill — cannot be
 * told by clicking. The demo stages that build itself.
 *
 *   intro    A first visit to `/`. Title, build, total, then the page is
 *            handed over with the Guide collapsed. Any touch skips it. Plays once per browser, and
 *            replaces the four-stop ambient tour that used to run on arrival.
 *   howto    "How this works" (or `/?howto` from any other page). The intro
 *            again, ending on a card that offers the explainer slides.
 *   layers   `/?demo=layers` — a capture mode for filming: the build and the
 *            total, with the page chrome cleared and nothing skippable.
 *   ask      `/?demo` or `/?demo=<question>` — the capture with the real Guide
 *            answering a question live, ending on a card that hands the
 *            visitor into that same conversation.
 *
 * Everything that asks "is a demo playing" asks here, and the answer is
 * computed once per page load: the intro marks itself seen as it starts, and
 * a component whose effect ran a tick later must not get a different answer.
 */

import type { OfferingType } from "./types";

export const DEMO_PARAM = "demo";
export const HOWTO_PARAM = "howto";
/** Set once the intro has played (or been skipped) in this browser. */
const INTRO_SEEN_KEY = "bevvip.introSeen";

/**
 * Asked when `?demo` carries no question of its own.
 *
 * Two collections in one sentence on purpose: the Guide answers it with a
 * safari search AND a hotel search, so the globe plots a shortlist that no
 * single legend row could have produced.
 */
export const DEMO_DEFAULT_QUESTION =
  "Two weeks in Africa next spring: the Great Migration on safari, then somewhere spectacular in Cape Town to finish.";

/**
 * The order collections switch on: sparsest first, densest last.
 *
 * By catalogue size rather than by the Explore menu's `order`, because the
 * build is a crescendo — 109 trains and 125 jets read as scattered points, and
 * the frame should only fill up once the villas and expedition sailings land.
 */
export const DEMO_BUILD_ORDER: OfferingType[] = [
  "train",
  "jet",
  "worldcruise",
  "safari",
  "yacht",
  "hotel",
  "villa",
  "cruise",
];

export type DemoMode =
  | { kind: "off" }
  | { kind: "intro" }
  | { kind: "howto" }
  | { kind: "layers" }
  | { kind: "ask"; question: string };

/** Filming modes: chrome cleared, chat kept off the saved transcript. */
export function isCapture(mode: DemoMode): boolean {
  return mode.kind === "layers" || mode.kind === "ask";
}

/*
 * A link that already says where to look. The intro would hide the pins it
 * points at and spend fifteen seconds before the answer it was sent for.
 * Campaign tags (utm_*) are deliberately NOT here: a first visit from an ad is
 * exactly the visit the intro is for.
 */
const LANDING_INTENT_PARAMS = ["ask", "style", "flat", "engine", "@"];

let atLoad: DemoMode | undefined;

/** What plays on THIS page load. Client only; "off" on the server. */
export function demoMode(): DemoMode {
  if (typeof window === "undefined") return { kind: "off" };
  if (!atLoad) atLoad = readMode();
  return atLoad;
}

/** A demo plays on this page load — the globe starts with an empty stage. */
export function demoRequested(): boolean {
  return demoMode().kind !== "off";
}

function readMode(): DemoMode {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(window.location.search);
  } catch {
    return { kind: "off" };
  }

  const raw = params.get(DEMO_PARAM);
  if (raw !== null) {
    const value = raw.trim();
    if (value.toLowerCase() === "layers") return { kind: "layers" };
    // `?demo`, `?demo=` and `?demo=1` all mean the default question.
    if (!value || value === "1" || value.toLowerCase() === "true") {
      return { kind: "ask", question: DEMO_DEFAULT_QUESTION };
    }
    return { kind: "ask", question: value };
  }

  if (params.has(HOWTO_PARAM)) {
    // One-shot: a refresh after the demo should not replay it.
    stripParam(HOWTO_PARAM);
    markIntroSeen();
    return { kind: "howto" };
  }

  if (LANDING_INTENT_PARAMS.some((p) => params.has(p))) return { kind: "off" };
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return { kind: "off" };
  try {
    if (window.localStorage.getItem(INTRO_SEEN_KEY)) return { kind: "off" };
  } catch {
    // Storage blocked: no way to remember a showing, so never impose one.
    return { kind: "off" };
  }
  // Marked now, not when it finishes: a visitor who leaves or skips half way
  // has seen it as far as they wanted to.
  markIntroSeen();
  return { kind: "intro" };
}

function markIntroSeen() {
  try {
    window.localStorage.setItem(INTRO_SEEN_KEY, "1");
  } catch {
    /* storage blocked */
  }
}

export function stripParam(name: string) {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(name)) return;
    url.searchParams.delete(name);
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  } catch {
    /* leave the URL as-is */
  }
}

/**
 * "How this works", from anywhere.
 *
 * On the home page the globe is right there, so the demo plays in place. On
 * any other page there is no globe to play it on, so this goes home and asks
 * for it there — the explainer slides follow from its end card either way.
 */
export function startHowItWorks() {
  if (document.querySelector("[data-demo-host]")) {
    window.dispatchEvent(new Event("bevvip:how-it-works"));
  } else {
    window.location.href = `/?${HOWTO_PARAM}`;
  }
}

/**
 * The stage: which collections the globe draws at all. `null` is "every
 * collection", the normal state; an array is the demo's partial build.
 */
export interface DemoStageDetail {
  keys: string[] | null;
}

/** Atlas → demo: the collections whose pins are on the map. */
export interface DemoLoadedDetail {
  keys: string[];
}

/**
 * Demo → home split: show The Guide, or leave it collapsed. `done` marks the
 * demo's last word on it — the run is over and the page is the visitor's.
 */
export interface DemoGuideDetail {
  open: boolean;
  done?: boolean;
}
