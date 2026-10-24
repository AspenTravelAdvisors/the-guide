"use client";

/**
 * The home globe's demonstration. See lib/demo.ts for the four ways in.
 *
 * One script, driven through the same event bus the product already runs on,
 * so nothing here is a mock of the site — it IS the site, conducted:
 *
 *   1. Title    — "Eight collections. One globe." over an empty planet.
 *   2. Build    — the collections switch on one beat at a time, sparsest
 *                 first, with each one's name and size and a running total.
 *   3. Question — capture only (`/?demo`): a question types itself, the real
 *                 Guide answers it, and the globe flies to the shortlist.
 *   4. Ending   — the first-visit intro hands the Guide over; "How this
 *                 works" offers the explainer slides; a capture ends on the
 *                 brand card, with the way into its conversation.
 *
 * A traveller's run (intro, howto) gives way to any touch, scroll or key. A
 * capture does not: someone is filming it, and a stray click must not end
 * the take.
 */

import { useEffect, useRef, useState } from "react";
import { ATLASES, collectionsHeadline } from "@/lib/atlas-config";
import {
  DEMO_BUILD_ORDER,
  DEMO_PARAM,
  demoMode,
  isCapture,
  stripParam,
  type DemoGuideDetail,
  type DemoLoadedDetail,
  type DemoMode,
  type DemoStageDetail,
} from "@/lib/demo";

/*
 * The beat, two ways.
 *
 * CAPTURE is tuned to be filmed at 1x and still read at 2x: every caption is
 * on screen for at least a second and a half, on a rhythm someone can cut
 * music to. VISIT is the same story told to someone who arrived to use the
 * site, and has to finish inside the ~17s the old ambient tour took — and
 * well inside HomeSplit's 22s dead man's switch, which reveals the Guide
 * regardless.
 */
const CAPTURE = {
  line: 1300,
  hold: 1200,
  beat: 1500,
  total: 3000,
  // How long the build waits for feeds still in flight before starting anyway.
  loadCap: 15000,
};
const VISIT = {
  line: 900,
  hold: 700,
  beat: 950,
  total: 2200,
  loadCap: 6000,
};
/** The intro's last line, on screen while the Guide slides in under it. */
const HANDOVER_MS = 1800;
const TYPE_CHAR_MS = 34;
const QUESTION_HOLD_MS = 900;
const ANSWER_HOLD_MS = 7000;
/** How long the question waits for the Guide's shortlist before moving on. */
const ANSWER_CAP_MS = 45000;
/** The panel's slide, before the explainer slides measure what they point at. */
const PANEL_SETTLE_MS = 480;

const NUMBER_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const nf = new Intl.NumberFormat("en-US");

interface Chip {
  label: string;
  color: string;
  count: number;
}

interface Scene {
  title: string[];
  /** The running total, or null while it is not on screen. */
  total: number | null;
  chip: Chip | null;
  /** The question, as far as it has been typed. */
  quote: string | null;
  caption: string | null;
  end: boolean;
}

const BLANK: Scene = { title: [], total: null, chip: null, quote: null, caption: null, end: false };

interface Run {
  mode: DemoMode;
  /** Bumped per start, so "How this works" mid-run restarts the script. */
  id: number;
}

const stage = (keys: string[] | null) =>
  window.dispatchEvent(new CustomEvent<DemoStageDetail>("bevvip:atlas-stage", { detail: { keys } }));
const guide = (open: boolean) =>
  window.dispatchEvent(new CustomEvent<DemoGuideDetail>("bevvip:demo-guide", { detail: { open } }));

export default function AtlasDemo() {
  const [run, setRun] = useState<Run | null>(null);
  const [scene, setScene] = useState<Scene>(BLANK);
  const shown = useCountUp(scene.total);
  const loadedRef = useRef<Set<string>>(new Set());
  const plottedRef = useRef(false);
  /** Ends the current run in place; set by the run's own effect. */
  const finishRef = useRef<() => void>(() => {});

  // What plays on arrival, and "How this works" for every run after it.
  useEffect(() => {
    const atLoad = demoMode();
    if (atLoad.kind !== "off") setRun({ mode: atLoad, id: 1 });
    const onHowTo = () => setRun((r) => ({ mode: { kind: "howto" }, id: (r?.id ?? 1) + 1 }));
    window.addEventListener("bevvip:how-it-works", onHowTo);
    return () => window.removeEventListener("bevvip:how-it-works", onHowTo);
  }, []);

  // Heard for the page's whole life: a demo started minutes in still needs to
  // know what has loaded, and the atlas answers its first stage change.
  useEffect(() => {
    const onLoaded = (e: Event) => {
      loadedRef.current = new Set((e as CustomEvent<DemoLoadedDetail>).detail?.keys ?? []);
    };
    const onPlot = () => {
      plottedRef.current = true;
    };
    window.addEventListener("bevvip:atlas-loaded", onLoaded as EventListener);
    window.addEventListener("bevvip:atlas-plot", onPlot);
    return () => {
      window.removeEventListener("bevvip:atlas-loaded", onLoaded as EventListener);
      window.removeEventListener("bevvip:atlas-plot", onPlot);
    };
  }, []);

  useEffect(() => {
    if (!run) return;
    const { mode } = run;
    const capture = isCapture(mode);
    const pace = capture ? CAPTURE : VISIT;
    const root = document.documentElement;
    const rootClass = capture ? "demo-on" : "intro-on";
    root.classList.add(rootClass);

    let cancelled = false;
    let skippable = !capture;
    const timers = new Set<number>();
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const t = window.setTimeout(() => {
          timers.delete(t);
          resolve();
        }, ms);
        timers.add(t);
      });
    /** Resolve once `ok()` holds or `capMs` has passed, polling at 100ms. */
    const until = async (ok: () => boolean, capMs: number) => {
      const start = Date.now();
      while (!cancelled && !ok() && Date.now() - start < capMs) await sleep(100);
    };
    const set = (patch: Partial<Scene>) => {
      if (!cancelled) setScene((s) => ({ ...s, ...patch }));
    };

    /**
     * Stop wherever the script is and leave the page as a visitor uses it:
     * every collection drawn, the Guide out, the overlay gone. Every ending
     * and every skip comes through here.
     */
    const finish = () => {
      if (cancelled) return;
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      stage(null);
      guide(true);
      root.classList.remove(rootClass);
      setScene(BLANK);
      setRun(null);
    };
    finishRef.current = finish;

    // A traveller's run yields to the first sign they want the page instead.
    const onSkip = (e: Event) => {
      if (!skippable) return;
      if (e instanceof KeyboardEvent && (e.metaKey || e.ctrlKey || e.altKey || e.key === "Shift")) return;
      finish();
    };
    // Esc ends a capture too, for whoever is operating it.
    const onEsc = (e: KeyboardEvent) => {
      if (capture && e.key === "Escape") exitCapture();
    };
    const skipEvents = ["pointerdown", "wheel", "keydown"] as const;
    skipEvents.forEach((t) => window.addEventListener(t, onSkip, { capture: true, passive: true }));
    window.addEventListener("keydown", onEsc);

    const order = DEMO_BUILD_ORDER.filter((t) => t in ATLASES);

    (async () => {
      // Park the Guide and clear the stage. On arrival both are already so
      // (the atlas starts a demo load empty); for "How this works" they are
      // not, and the stage change is also what gets the atlas to report what
      // it has loaded.
      setScene(BLANK);
      guide(false);
      stage([]);

      // ── 1. Title ────────────────────────────────────────────────────────
      const n = NUMBER_WORDS[order.length] ?? String(order.length);
      set({ title: [`${n} collections.`] });
      await sleep(pace.line);
      set({ title: [`${n} collections.`, "One globe."] });
      await sleep(pace.hold);
      // The title doubles as the cover for a cold load: it holds until every
      // feed is on the map, so no beat switches on a collection still empty.
      await until(() => order.every((t) => loadedRef.current.has(t)), pace.loadCap);
      if (cancelled) return;

      // ── 2. Build ────────────────────────────────────────────────────────
      set({ title: [], total: 0 });
      const on: string[] = [];
      let total = 0;
      for (const type of order) {
        if (cancelled) return;
        const c = ATLASES[type];
        on.push(type);
        total += c.count;
        stage([...on]);
        set({ chip: { label: c.nav, color: c.color, count: c.count }, total });
        await sleep(pace.beat);
      }
      // Hand the stage back: from here on the globe is in its ordinary state,
      // and anything the Guide plots is drawn exactly as a traveller sees it.
      stage(null);
      set({ chip: null, caption: collectionsHeadline().replace(/^[\d,]+ /, "") });
      await sleep(pace.total);
      if (cancelled) return;

      // ── 3. Question (capture only) ──────────────────────────────────────
      if (mode.kind === "ask") {
        set({ total: null, caption: "Now ask it something." });
        await sleep(QUESTION_HOLD_MS);
        const q = mode.question;
        for (let i = 1; i <= q.length; i++) {
          if (cancelled) return;
          set({ quote: q.slice(0, i) });
          await sleep(TYPE_CHAR_MS);
        }
        await sleep(QUESTION_HOLD_MS);
        plottedRef.current = false;
        guide(true);
        // The real Guide, through the same pipeline as the composer — the
        // beat a static recording of the site could never produce. Asked
        // exactly once: "Continue in chat" keeps this transcript, it does not
        // ask again.
        window.dispatchEvent(new CustomEvent("bevvip:guide-ask", { detail: { text: q, source: "dock" } }));
        set({ quote: null, caption: "Searching every collection at once…" });
        await until(() => plottedRef.current, ANSWER_CAP_MS);
        if (cancelled) return;
        set({ caption: "Technology finds the options." });
        await sleep(ANSWER_HOLD_MS);
        if (cancelled) return;
      }

      // ── 4. Ending ───────────────────────────────────────────────────────
      if (mode.kind === "intro") {
        // The Guide arrives under its own cue rather than after the overlay
        // has gone: the last line and the composer are one beat.
        set({ total: null, caption: "Ask The Guide anything." });
        guide(true);
        await sleep(HANDOVER_MS);
        finish();
        return;
      }
      // The card is the whole frame: the Guide is parked so an open panel
      // cannot sit beside it (desktop) or show through it (phone). And it is
      // a card with buttons, so a click on it is an answer, not a skip.
      skippable = false;
      guide(false);
      set({ total: null, caption: null, quote: null, end: true });
    })();

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      root.classList.remove(rootClass);
      skipEvents.forEach((t) => window.removeEventListener(t, onSkip, { capture: true }));
      window.removeEventListener("keydown", onEsc);
    };
  }, [run]);

  /**
   * Leave a capture without reloading. The page becomes the ordinary home
   * page in place, and the conversation the capture asked for — if it asked
   * one — becomes the visitor's own, saved from now on (see GuideChat).
   */
  function exitCapture() {
    stripParam(DEMO_PARAM);
    window.dispatchEvent(new Event("bevvip:demo-handoff"));
    finishRef.current();
  }

  function openSlides() {
    finishRef.current();
    // The first slide points at the composer, so it has to be on screen —
    // finish() just sent the panel sliding in.
    window.setTimeout(() => window.dispatchEvent(new Event("bevvip:start-tour")), PANEL_SETTLE_MS);
  }

  const mode = run?.mode;
  const capture = !!mode && isCapture(mode);

  return (
    <>
      {/* How "How this works" knows the globe is on this page. */}
      <span data-demo-host hidden />
      {mode && (
        <div className={`atlas-demo${capture ? "" : " ad-visit"}`} aria-live="polite">
          {scene.title.length > 0 && (
            <h2 className="ad-title">
              {scene.title.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </h2>
          )}

          {scene.total !== null && (
            <div className="ad-total">
              <strong>{nf.format(shown)}</strong>
              {scene.caption && <span className="ad-cap">{scene.caption}</span>}
            </div>
          )}

          {scene.chip && (
            <div className="ad-chip" key={scene.chip.label}>
              <i style={{ background: scene.chip.color }} />
              <span>{scene.chip.label}</span>
              <b>+{nf.format(scene.chip.count)}</b>
            </div>
          )}

          {scene.total === null && scene.caption && !scene.end && (
            <p className="ad-line" key={scene.caption}>{scene.caption}</p>
          )}

          {scene.quote !== null && (
            <blockquote className="ad-quote">
              “{scene.quote}
              <span className="ad-caret" aria-hidden="true" />”
            </blockquote>
          )}

          {!capture && !scene.end && (
            <button type="button" className="ad-skip" onClick={() => finishRef.current()}>
              Skip intro
            </button>
          )}

          {scene.end && (
            <div className="ad-end">
              <p className="ad-end-a">Technology finds the options.</p>
              <p className="ad-end-b">We make them VIP.</p>
              <p className="ad-end-c">
                Book with Aspen Travel Advisors
                <span>guide.expeditionbucketlist.com</span>
              </p>
              {mode.kind === "howto" ? (
                <div className="ad-ctrl ad-ctrl-visit">
                  <button type="button" className="primary" onClick={openSlides}>
                    How to use it
                  </button>
                  <button type="button" onClick={() => finishRef.current()}>
                    Start exploring
                  </button>
                </div>
              ) : (
                <div className="ad-ctrl">
                  <button type="button" onClick={exitCapture}>
                    {mode.kind === "ask" ? "Continue in chat" : "Exit demo"}
                  </button>
                  <button type="button" onClick={() => window.location.reload()}>
                    Replay
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/**
 * The running total, counted up rather than swapped.
 *
 * Each beat adds a collection's size to the target and the figure climbs to it
 * over most of the beat — the number moving is half of what makes the build
 * read as accumulation instead of as a list.
 */
function useCountUp(target: number | null, ms = 900): number {
  const [value, setValue] = useState(0);
  const valueRef = useRef(0);
  valueRef.current = value;

  useEffect(() => {
    if (target === null) return;
    const from = target === 0 ? 0 : valueRef.current;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);

  return value;
}
