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

/**
 * A row photo that removes itself if it fails, so the lettered placeholder
 * behind it shows instead of a broken-image icon. Supplier photo hosts do go
 * missing, and a row of broken icons reads as a broken page.
 */
export function HomeThumb({ src }: { src: string }) {
  const [ok, setOk] = useState(true);
  const ref = useRef<HTMLImageElement>(null);
  // An image can fail before hydration attaches onError; catch that case too.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setOk(false);
  }, []);
  if (!ok) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} src={src} alt="" loading="lazy" decoding="async" onError={() => setOk(false)} />;
}
