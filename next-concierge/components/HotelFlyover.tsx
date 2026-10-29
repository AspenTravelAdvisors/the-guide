"use client";

/**
 * `/demo/hotel` — one property in photoreal 3D, filmed as a single shot.
 *
 * The camera work is lib/atlas/flyover.ts; this is the stage around it. The
 * part that decides whether the take is usable is the warm-up: Google streams
 * the mesh for what the camera is looking at, so a cold orbit at 200 m shows
 * the building as melted low-detail shapes refining as it turns. Behind the
 * cover card the camera visits the hotel from four sides and from the reveal's
 * height first, so by the time the shot rolls every frame of it is drawn.
 *
 * Then the operator presses Space (or Play) and starts recording on their own
 * beat; `?autoplay=1` rolls as soon as the tiles are in, for a link sent to a
 * lead. The camera is driven per frame rather than by flyCameraTo/Around,
 * because the shot is one continuous move — a turn that never stops while the
 * range closes in and then opens up — and the engine's own animations can do
 * either half of that but not both at once.
 */

import { useEffect, useRef, useState } from "react";
import {
  Google3DUnavailable,
  HOTEL_ACCENT,
  groundAltitude,
  loadGoogle3D,
  type Map3DElement,
  type Marker3D,
} from "@/lib/atlas/google3d";
import {
  flyoverCamera,
  flyoverPlan,
  flyoverWarmup,
  type FlyoverCamera,
  type FlyoverOptions,
} from "@/lib/atlas/flyover";

export interface FlyoverHotel {
  id: string;
  name: string;
  place: string;
  lat: number;
  lng: number;
}

export interface FlyoverSettings extends FlyoverOptions {
  /** Metres above the ground the camera looks at — raise it for a tower. */
  lift: number;
  /** Google's road and place labels over the imagery. */
  labels: boolean;
  /** No captions or end card, for an editor adding their own. */
  clean: boolean;
  /** Roll as soon as the tiles are in, without waiting for Play. */
  autoplay: boolean;
  /** Skip the warm-up (faster to start, rougher first lap). */
  warm: boolean;
  /** Mark the hotel once the reveal has pulled back far enough to lose it. */
  pin: boolean;
}

type Phase = "loading" | "warming" | "ready" | "playing" | "ended" | "unavailable";
type Beat = "name" | "reveal" | "end" | null;

/** The longest a warm-up stop waits for the tiles. Steady often never re-fires
 *  for a view already cached, so this is also the cached case's exit. */
const SETTLE_CAP_MS = 4000;
/** A steady report this soon after a camera move is the PREVIOUS view's. */
const SETTLE_MIN_MS = 250;
/** Where the reveal has pulled back enough that the building needs a marker. */
const PIN_AT = 0.3;

export default function HotelFlyover({
  hotel,
  settings,
}: {
  hotel: FlyoverHotel;
  settings: FlyoverSettings;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map3DElement | null>(null);
  const pinRef = useRef<Marker3D | null>(null);
  const rafRef = useRef(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [beat, setBeat] = useState<Beat>(null);
  const [warmed, setWarmed] = useState<[number, number]>([0, 0]);
  const phaseRef = useRef<Phase>("loading");
  phaseRef.current = phase;

  const planRef = useRef(flyoverPlan(settings));
  const plan = planRef.current;
  const atlasHref = `/atlas/hotel?hotel=${encodeURIComponent(hotel.id)}`;

  /* ── The camera ───────────────────────────────────────────────────────── */

  const aim = (cam: FlyoverCamera) => {
    const map = mapRef.current;
    if (!map) return;
    try {
      map.range = cam.range;
      map.tilt = cam.tilt;
      map.heading = cam.heading;
    } catch {
      /* detached mid-frame */
    }
  };

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  };

  const showPin = (on: boolean) => {
    const map = mapRef.current;
    const pin = pinRef.current;
    if (!map || !pin) return;
    if (on && !pin.isConnected) map.append(pin);
    if (!on && pin.isConnected) pin.remove();
  };

  const play = () => {
    if (!mapRef.current) return;
    stop();
    showPin(false);
    setBeat(null);
    setPhase("playing");
    const { marks, durationMs, speed } = plan;
    const pinAt = marks.reveal + (marks.end - marks.reveal) * PIN_AT;
    const s = (ms: number) => ms / speed;
    let last: Beat = null;
    let start = 0;
    const frame = (now: number) => {
      if (!start) start = now;
      const t = now - start;
      aim(flyoverCamera(plan, t));
      if (settings.pin) showPin(t >= pinAt);
      const next: Beat =
        t >= marks.end + s(600)
          ? "end"
          : t >= marks.reveal + s(2500) && t < marks.end - s(300)
            ? "reveal"
            : t >= s(1200) && t < marks.reveal - s(800)
              ? "name"
              : null;
      if (next !== last) {
        last = next;
        setBeat(next);
      }
      if (t < durationMs) rafRef.current = requestAnimationFrame(frame);
      else {
        rafRef.current = 0;
        setPhase("ended");
      }
    };
    rafRef.current = requestAnimationFrame(frame);
  };

  const playRef = useRef(play);
  playRef.current = play;

  /* ── Mount, warm, roll ────────────────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;
    document.documentElement.classList.add("flyover-on");

    const settle = (map: Map3DElement) =>
      new Promise<void>((resolve) => {
        const t0 = performance.now();
        let timer = 0;
        const done = () => {
          map.removeEventListener("gmp-steadychange", onSteady);
          window.clearTimeout(timer);
          resolve();
        };
        const onSteady = (e: Event) => {
          if ((e as Event & { isSteady?: boolean }).isSteady && performance.now() - t0 > SETTLE_MIN_MS) done();
        };
        map.addEventListener("gmp-steadychange", onSteady);
        timer = window.setTimeout(done, SETTLE_CAP_MS);
      });

    (async () => {
      let libs;
      try {
        libs = await loadGoogle3D();
      } catch (err) {
        if (!cancelled) setPhase("unavailable");
        if (!(err instanceof Google3DUnavailable)) console.error(err);
        return;
      }
      if (cancelled) return;
      const { Map3DElement, MapMode, Marker3DElement, AltitudeMode } = libs.maps3d;
      const ground = await groundAltitude(hotel.lat, hotel.lng);
      if (cancelled) return;
      const first = flyoverCamera(plan, 0);
      const map = new Map3DElement({
        center: { lat: hotel.lat, lng: hotel.lng, altitude: ground + settings.lift },
        range: first.range,
        tilt: first.tilt,
        heading: first.heading,
        mode: settings.labels ? MapMode.HYBRID : MapMode.SATELLITE,
      });
      map.style.width = "100%";
      map.style.height = "100%";
      map.style.display = "block";
      host.appendChild(map);
      mapRef.current = map;

      try {
        const { PinElement } = libs.marker;
        const pin = new Marker3DElement({
          position: { lat: hotel.lat, lng: hotel.lng, altitude: 40 },
          altitudeMode: AltitudeMode.RELATIVE_TO_MESH,
        });
        pin.append(
          new PinElement({ background: HOTEL_ACCENT, borderColor: "#fffaf0", glyphColor: "#fffaf0", scale: 1.15 }),
        );
        pinRef.current = pin;
      } catch {
        /* no pin is a reveal without a marker, not a broken take */
      }

      if (settings.warm) {
        const stops = flyoverWarmup(plan);
        setPhase("warming");
        for (let i = 0; i < stops.length; i++) {
          if (cancelled) return;
          setWarmed([i, stops.length]);
          aim(stops[i]);
          await settle(map);
        }
      } else {
        aim(first);
        await settle(map);
      }
      if (cancelled) return;
      setPhase("ready");
      if (settings.autoplay) playRef.current();
    })();

    return () => {
      cancelled = true;
      stop();
      document.documentElement.classList.remove("flyover-on");
      const map = mapRef.current;
      if (map) map.remove();
      mapRef.current = null;
    };
    // Mounted once per page: the hotel and settings come from the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── The operator's keys ──────────────────────────────────────────────── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const p = phaseRef.current;
      if ((e.key === " " || e.key === "Enter") && (p === "ready" || p === "ended")) {
        e.preventDefault();
        playRef.current();
      } else if ((e.key === "r" || e.key === "R") && (p === "playing" || p === "ended")) {
        playRef.current();
      } else if (e.key === "Escape" && p === "playing") {
        stop();
        setBeat(null);
        setPhase("ended");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const words = !settings.clean;

  return (
    <div className="flyover">
      <div ref={hostRef} className="fo-map" />

      {/* While the take runs, a stray click or scroll must not grab the
          camera; the shield takes them instead of the map. */}
      {phase === "playing" && <div className="fo-shield" aria-hidden="true" />}

      {(phase === "loading" || phase === "warming") && (
        <div className="fo-cover">
          <p className="fo-cover-name">{hotel.name}</p>
          <p className="fo-cover-place">{hotel.place}</p>
          <p className="fo-cover-status">
            {phase === "loading"
              ? "Loading photoreal 3D…"
              : `Drawing the hotel in 3D · ${warmed[0] + 1} of ${warmed[1]}`}
          </p>
        </div>
      )}

      {phase === "ready" && !settings.autoplay && (
        <div className="fo-cover fo-ready">
          <p className="fo-cover-name">{hotel.name}</p>
          <p className="fo-cover-place">{hotel.place}</p>
          <button type="button" className="fo-play" onClick={() => playRef.current()} autoFocus>
            Play
          </button>
          <p className="fo-cover-status">Space to play · R to replay · Esc to stop</p>
        </div>
      )}

      {phase === "unavailable" && (
        <div className="fo-cover">
          <p className="fo-cover-name">{hotel.name}</p>
          <p className="fo-cover-status">Photoreal 3D is not available right now.</p>
          <a className="fo-play" href={atlasHref}>
            Open on the atlas
          </a>
        </div>
      )}

      {words && beat === "name" && (
        <div className="fo-third" key="name">
          <strong>{hotel.name}</strong>
          <span>{hotel.place}</span>
        </div>
      )}

      {words && beat === "reveal" && (
        <p className="fo-line" key="reveal">
          See exactly where you’ll be.
        </p>
      )}

      {words && beat === "end" && (
        <div className="fo-end">
          <p className="fo-end-hotel">{hotel.name}</p>
          <p className="fo-end-a">Technology finds the options.</p>
          <p className="fo-end-b">We make them VIP.</p>
          <p className="fo-end-c">
            Book with Aspen Travel Advisors
            <span>guide.expeditionbucketlist.com</span>
          </p>
        </div>
      )}

      {phase === "ended" && (
        <div className="fo-ctrl">
          <button type="button" onClick={() => playRef.current()}>
            Replay
          </button>
          <a href={atlasHref}>Explore this hotel</a>
        </div>
      )}
    </div>
  );
}
