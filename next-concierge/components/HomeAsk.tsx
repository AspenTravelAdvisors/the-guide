"use client";

// The two client hooks the long homepage needs, and nothing else: the sections
// themselves are server-rendered HTML (components/HomeSections.jsx), so a
// crawler reads them and a phone does not hydrate them.
//
// HomeAsk — "Ask about this" on a row. Scrolls back up to The Guide and asks it,
// through the same pipeline as a pin or a chip (lib/atlas/ask), so the answer
// streams into the chat the visitor is now looking at.
//
// HomeBackToGuide — once The Guide has scrolled out of view, a pill that brings
// it back. Without it the only way to talk to the Guide from the middle of the
// page is to scroll a long way up.
//
// HomeMoreBelow — phones only (CSS). The first screen is The Guide and the top
// of the globe, with nothing to say a magazine of photos runs beneath them. A
// small pill at the foot of the screen says so and scrolls there on a tap; it
// steps aside as soon as the first section's own text has come into view.

import { useEffect, useRef, useState } from "react";
import { askGuide, askGuideHref } from "@/lib/atlas/ask";
import { homeSectionAsk, homeBackToGuide } from "@/lib/analytics";

function scrollHome(): void {
  const el = document.querySelector<HTMLElement>(".home-scroll");
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el?.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
}

export function HomeAsk({ text, label = "Ask about it", section }: { text: string; label?: string; section: string }) {
  return (
    <button
      type="button"
      className="home-row-ask"
      onClick={() => {
        homeSectionAsk(section);
        scrollHome();
        if (!askGuide(text, "home")) window.location.href = askGuideHref(text, "home");
      }}
    >
      {label}
    </button>
  );
}

export function HomeBackToGuide() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(".home-scroll");
    if (!el) return;
    const onScroll = () => setShow(el.scrollTop > el.clientHeight * 0.8);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <button
      type="button"
      className="home-back"
      data-show={show ? "true" : "false"}
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
      onClick={() => {
        homeBackToGuide();
        scrollHome();
        window.dispatchEvent(new Event("bevvip:guide-open"));
      }}
    >
      Ask The Guide
    </button>
  );
}

export function HomeMoreBelow() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(".home-scroll");
    const below = document.querySelector<HTMLElement>(".home-below");
    if (!el || !below) return;
    // Shown until the sections' first lines are on screen: from there the text
    // itself says there is more, and the pill would only sit on top of it.
    const onScroll = () =>
      setShow(below.getBoundingClientRect().top > el.getBoundingClientRect().bottom - 24);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return (
    <button
      type="button"
      className="home-more"
      data-show={show ? "true" : "false"}
      aria-hidden={!show}
      tabIndex={show ? 0 : -1}
      onClick={() => {
        const el = document.querySelector<HTMLElement>(".home-scroll");
        const below = document.querySelector<HTMLElement>(".home-below");
        if (!el || !below) return;
        const top = el.scrollTop + below.getBoundingClientRect().top - el.getBoundingClientRect().top - 8;
        const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        el.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
      }}
    >
      Trip inspiration below <span aria-hidden="true">↓</span>
    </button>
  );
}

/**
 * A row or villa-tile photo. Every one was checked when the page was built
 * (lib/home-sections.js), but a supplier can delete a photo afterwards. When
 * one fails it leaves a `.home-thumb-gone` marker, and the CSS hides the
 * whole row or tile around it (`:has`): a magazine shows a story with its
 * picture or not at all, never a placeholder or a broken-image icon.
 */
export function HomeThumb({ src }: { src: string }) {
  const [ok, setOk] = useState(true);
  const ref = useRef<HTMLImageElement>(null);
  // An image can fail before hydration attaches onError; catch that case too.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setOk(false);
  }, []);
  if (!ok) return <span className="home-thumb-gone" hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} src={src} alt="" loading="lazy" decoding="async" onError={() => setOk(false)} />;
}
