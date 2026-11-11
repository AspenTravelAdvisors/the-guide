"use client";

// Back-button scroll memory for the page scrollers.
//
// The browser restores scroll on Back only for the WINDOW, and nothing here
// scrolls the window: `.app` is pinned to the viewport and each page scrolls
// inside its own column (`.home-scroll` on the home page, `.answers-wrap` on
// every document page). So Back always landed at the top of the page a reader
// had been halfway down. This remembers each scroller's position per URL and
// puts it back when the reader returns with Back or Forward — and only then:
// following a link to a page still opens it at the top.
//
// Positions live in sessionStorage so they also survive a full page load: a
// reload, or Back from an outside site when the browser did not keep the page
// in its back-forward cache.

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SCROLLERS = "main.page .home-scroll, main.page .answers-wrap";
const STORE = "scroll-memory:v1";
const MAX_KEYS = 60;
const POP_TTL_MS = 15000;
const RESTORE_FOR_MS = 2000;

let positions = null;
let pending = null; // { key, at } — set on popstate, consumed by the next page
let firstMount = true;
let saveTimer = 0;

const keyNow = () => location.pathname + location.search;
const findScroller = () => document.querySelector(SCROLLERS);

function load() {
  if (positions) return positions;
  try {
    positions = JSON.parse(sessionStorage.getItem(STORE) || "{}") || {};
  } catch {
    positions = {};
  }
  return positions;
}

function persist() {
  saveTimer = 0;
  try {
    const keys = Object.keys(positions);
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_KEYS))) delete positions[k];
    sessionStorage.setItem(STORE, JSON.stringify(positions));
  } catch {
    /* private mode or full storage: memory still works for this tab's session */
  }
}

function remember(key, y) {
  const p = load();
  delete p[key]; // re-insert so the newest keys are the ones kept
  p[key] = Math.round(y);
  if (!saveTimer) saveTimer = window.setTimeout(persist, 250);
}

/**
 * Put the scroller back at `y`. The page may still be filling in (sections,
 * images, the globe), so keep reapplying for a short while until the column is
 * tall enough — and stop the moment the reader scrolls themselves.
 */
function restore(key, y) {
  const started = performance.now();
  let raf = 0;
  const stop = () => {
    cancelAnimationFrame(raf);
    for (const ev of ["wheel", "touchstart", "keydown", "pointerdown"]) {
      window.removeEventListener(ev, stop, true);
    }
  };
  for (const ev of ["wheel", "touchstart", "keydown", "pointerdown"]) {
    window.addEventListener(ev, stop, { capture: true, passive: true });
  }
  const step = () => {
    const el = findScroller();
    if (el && el.dataset.scrollKey === key) {
      // `.home-scroll` is smooth-scrolling; a restore should be instant.
      const prev = el.style.scrollBehavior;
      el.style.scrollBehavior = "auto";
      el.scrollTop = y;
      el.style.scrollBehavior = prev;
      if (Math.abs(el.scrollTop - y) < 2 && performance.now() - started > 300) return stop();
    }
    if (performance.now() - started > RESTORE_FOR_MS) return stop();
    raf = requestAnimationFrame(step);
  };
  step();
}

export default function ScrollMemory() {
  const pathname = usePathname();

  // Listeners, once.
  useEffect(() => {
    const onScroll = (e) => {
      const el = e.target;
      if (!(el instanceof HTMLElement) || !el.dataset.scrollKey) return;
      remember(el.dataset.scrollKey, el.scrollTop);
    };
    const onPop = () => {
      pending = { key: keyNow(), at: Date.now() };
    };
    const onHide = () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
        persist();
      }
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("popstate", onPop);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  // Each page: tag its scroller with its URL, and restore if we came back.
  useEffect(() => {
    const key = keyNow();
    const el = findScroller();
    let back = false;
    if (firstMount) {
      firstMount = false;
      const nav = performance.getEntriesByType?.("navigation")?.[0];
      // A reload keeps its place too, as it would on a window-scrolled page.
      back = nav?.type === "back_forward" || nav?.type === "reload";
    }
    if (pending && pending.key === key && Date.now() - pending.at < POP_TTL_MS) back = true;
    pending = null;
    if (!el) return;
    el.dataset.scrollKey = key;
    const y = load()[key];
    if (back && y > 0) restore(key, y);
  }, [pathname]);

  return null;
}
