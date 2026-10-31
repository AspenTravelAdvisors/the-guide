"use client";

/**
 * `/demo/hotel` — one property in photoreal 3D, filmed as a single shot.
 *
 * The camera work is lib/atlas/flyover.ts; this is the stage around it. Two
 * things happen before the take, behind the cover card, and both decide
 * whether it is usable:
 *
 *   framing What stands around the hotel decides the shot (lib/atlas/
 *           framing.ts): a short building among towers, or under a mountain,
 *           is hidden from the reel's default angle, so the hover goes round
 *           the open side and looks down steeply enough to clear the rest; a
 *           tall one is looked at halfway up, from further back. Most hotels
 *           carry a stored framing from the build; for the rest the page
 *           surveys live (lib/atlas/surroundings.ts) behind the cover card.
 *   warm    Google streams the mesh for what the camera is looking at, so a
 *           cold orbit at 200 m shows the building as melted low-detail shapes
 *           refining as it turns. The camera visits the hotel from four sides
 *           and from the reveal's height first.
 *
 * Then the operator presses Space (or Play) and starts recording on their own
 * beat; `?autoplay=1` rolls as soon as the tiles are in, for a link sent to a
 * lead. `?tune=1` hands the camera to the operator instead: they frame the
 * hotel by eye on the real tiles, preview the shot through that frame, and
 * copy a link that keeps it.
 *
 * The camera is driven per frame rather than by flyCameraTo/Around, because
 * the shot is one continuous move — a turn that never stops while the range
 * closes in and then opens up — and the engine's own animations can do either
 * half of that but not both at once.
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
  headingForBearing,
  optionsForView,
  type FlyoverCamera,
  type FlyoverOptions,
  type FlyoverPlan,
} from "@/lib/atlas/flyover";
import { DEFAULT_LIFT, framingFromSurvey, type HotelFraming } from "@/lib/atlas/framing";
import { SURVEY_RADIUS, compass, surveySurroundings, tallestNear, type Survey } from "@/lib/atlas/surroundings";

export interface FlyoverHotel {
  id: string;
  name: string;
  place: string;
  lat: number;
  lng: number;
}

export interface FlyoverSettings extends FlyoverOptions {
  /** Metres above the ground the camera looks at; unset, the survey decides. */
  lift?: number;
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
  /** Measure the surroundings and choose the side and angle from them. */
  auto: boolean;
  /** Hand the camera to the operator to frame by eye. */
  tune: boolean;
}

type Phase = "loading" | "surveying" | "warming" | "ready" | "playing" | "ended" | "tuning" | "unavailable";
type Beat = "name" | "reveal" | "end" | null;

/** The longest a warm-up stop waits for the tiles. Steady often never re-fires
 *  for a view already cached, so this is also the cached case's exit. */
const SETTLE_CAP_MS = 4000;
/** A steady report this soon after a camera move is the PREVIOUS view's. */
const SETTLE_MIN_MS = 250;
/** Where the reveal has pulled back enough that the building needs a marker. */
const PIN_AT = 0.3;
/** How far past the hover range an obstacle counts (as in lib/atlas/framing). */
const REACH = 1.15;

const round = (n: number) => Math.round(n);

interface Framing {
  plan: FlyoverPlan;
  options: FlyoverOptions;
  lift: number;
  /** The hotel's framing the shot was built from, stored or surveyed live. */
  hotelFraming: HotelFraming | null;
}

/**
 * The shot for this hotel: what the URL asked for, with everything it left
 * unset filled in from the hotel's framing. A value in the URL always wins —
 * it is someone's judgement made on the real tiles.
 */
function frameShot(settings: FlyoverSettings, f: HotelFraming | null): Framing {
  const lift = settings.lift ?? f?.lift ?? DEFAULT_LIFT;
  let options: FlyoverOptions = {
    ...settings,
    closeRange: settings.closeRange ?? f?.range,
    closeTilt: settings.closeTilt ?? f?.tilt,
  };
  if (settings.heading == null && f) options = { ...options, heading: headingForBearing(flyoverPlan(options), f.bearing) };
  return { plan: flyoverPlan(options), options, lift, hotelFraming: f };
}

const midHover = (plan: FlyoverPlan) => (plan.marks.hover + plan.marks.reveal) / 2;
/** The side of the building the hover looks at: the camera stands opposite its heading. */
const sideOf = (plan: FlyoverPlan) => compass(flyoverCamera(plan, midHover(plan)).heading + 180);

export default function HotelFlyover({
  hotel,
  settings,
  stored,
}: {
  hotel: FlyoverHotel;
  settings: FlyoverSettings;
  /** The hotel's framing from the build, when it has been surveyed. */
  stored: HotelFraming | null;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map3DElement | null>(null);
  const pinRef = useRef<Marker3D | null>(null);
  const rafRef = useRef(0);
  const groundRef = useRef(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [beat, setBeat] = useState<Beat>(null);
  const [warmed, setWarmed] = useState<[number, number]>([0, 0]);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [framing, setFraming] = useState<Framing>(() => frameShot(settings, settings.auto ? stored : null));
  const [live, setLive] = useState<FlyoverCamera | null>(null);
  const [link, setLink] = useState("");
  const phaseRef = useRef<Phase>("loading");
  phaseRef.current = phase;

  /** The plan the next take plays — the framing's, until a tune preview replaces it. */
  const planRef = useRef<FlyoverPlan>(framing.plan);
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

  const centre = (lift: number) => {
    const map = mapRef.current;
    if (!map) return;
    try {
      map.center = { lat: hotel.lat, lng: hotel.lng, altitude: groundRef.current + lift };
    } catch {
      /* detached */
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
    const plan = planRef.current;
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

  /* ── Tune mode ────────────────────────────────────────────────────────── */

  const readView = () => {
    const map = mapRef.current;
    if (!map) return null;
    const c = map.center;
    const view = { range: Number(map.range), tilt: Number(map.tilt), heading: Number(map.heading) };
    if (!c || ![c.lat, c.lng, view.range, view.tilt, view.heading].every(Number.isFinite)) return null;
    return { ...view, lat: c.lat, lng: c.lng, lift: Math.max(0, Number(c.altitude) - groundRef.current) };
  };

  /** Back to the operator, framed where the middle of the current hover is. */
  const tune = () => {
    stop();
    showPin(false);
    setBeat(null);
    aim(flyoverCamera(planRef.current, midHover(planRef.current)));
    setPhase("tuning");
  };

  /** The shot as it would play through what the operator has framed. */
  const previewView = () => {
    const view = readView();
    if (!view) return;
    planRef.current = flyoverPlan({ ...framing.options, ...optionsForView(planRef.current, view) });
    play();
  };

  const copyView = () => {
    const view = readView();
    if (!view) return;
    const o = optionsForView(planRef.current, view);
    const url = new URL(window.location.href);
    url.searchParams.delete("tune");
    url.searchParams.set("hotel", hotel.id);
    url.searchParams.set("lat", view.lat.toFixed(6));
    url.searchParams.set("lng", view.lng.toFixed(6));
    url.searchParams.set("lift", String(round(view.lift)));
    url.searchParams.set("range", String(o.closeRange));
    url.searchParams.set("tilt", String(o.closeTilt));
    url.searchParams.set("heading", String(o.heading));
    const text = url.toString();
    setLink(text);
    navigator.clipboard?.writeText(text).catch(() => {
      /* the link is on screen to copy by hand */
    });
  };

  const resetToAuto = () => {
    planRef.current = framing.plan;
    centre(framing.lift);
    tune();
  };

  const playRef = useRef(play);
  playRef.current = play;
  const tuneRef = useRef(tune);
  tuneRef.current = tune;

  // The live camera, for the operator to read while framing.
  useEffect(() => {
    if (phase !== "tuning") return;
    const timer = window.setInterval(() => setLive(readView()), 300);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* ── Mount, survey, warm, roll ────────────────────────────────────────── */

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
      const ground = await groundAltitude(hotel.lat, hotel.lng);
      groundRef.current = ground;
      if (cancelled) return;

      // A stored framing needs no survey; tune mode surveys anyway, because
      // the operator wants to see what stands there.
      let f: HotelFraming | null = settings.auto ? stored : null;
      if (settings.auto && (!stored || settings.tune)) {
        setPhase("surveying");
        const found = await surveySurroundings(hotel.lat, hotel.lng, ground, SURVEY_RADIUS);
        if (cancelled) return;
        setSurvey(found);
        f ??= framingFromSurvey(found);
      }
      const framed = frameShot(settings, f);
      setFraming(framed);
      planRef.current = framed.plan;
      const plan = framed.plan;

      const { Map3DElement, MapMode, Marker3DElement, AltitudeMode } = libs.maps3d;
      const first = settings.tune ? flyoverCamera(plan, midHover(plan)) : flyoverCamera(plan, 0);
      const map = new Map3DElement({
        center: { lat: hotel.lat, lng: hotel.lng, altitude: ground + framed.lift },
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

      if (settings.tune) {
        // The operator is about to fly round it by hand; that is the warm-up.
        setPhase("tuning");
        return;
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
      if (e.target instanceof HTMLInputElement) return;
      const p = phaseRef.current;
      if ((e.key === " " || e.key === "Enter") && (p === "ready" || p === "ended")) {
        e.preventDefault();
        playRef.current();
      } else if ((e.key === "r" || e.key === "R") && (p === "playing" || p === "ended")) {
        playRef.current();
      } else if (e.key === "Escape" && p === "playing") {
        if (settings.tune) return tuneRef.current();
        stop();
        setBeat(null);
        setPhase("ended");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const words = !settings.clean;
  const { hotelFraming } = framing;
  const steepened =
    settings.closeTilt == null && hotelFraming && hotelFraming.tilt < flyoverPlan({}).keys[1].tilt - 0.5;

  return (
    <div className="flyover">
      <div ref={hostRef} className="fo-map" />

      {/* While the take runs, a stray click or scroll must not grab the
          camera; the shield takes them instead of the map. */}
      {phase === "playing" && <div className="fo-shield" aria-hidden="true" />}

      {(phase === "loading" || phase === "surveying" || phase === "warming") && (
        <div className="fo-cover">
          <p className="fo-cover-name">{hotel.name}</p>
          <p className="fo-cover-place">{hotel.place}</p>
          <p className="fo-cover-status">
            {phase === "loading"
              ? "Loading photoreal 3D…"
              : phase === "surveying"
                ? "Measuring what stands around it…"
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
          {steepened && hotelFraming && (
            <p className="fo-cover-status fo-cover-note">
              Angle steepened to {round(hotelFraming.tilt)}° to clear what stands around it · hover on the{" "}
              {sideOf(framing.plan)} side
            </p>
          )}
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

      {phase === "tuning" && (
        <TunePanel
          hotel={hotel}
          survey={survey}
          stored={!!stored}
          framing={framing}
          live={live}
          link={link}
          onPreview={previewView}
          onCopy={copyView}
          onReset={resetToAuto}
        />
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
          {settings.tune ? (
            <>
              <button type="button" onClick={() => tuneRef.current()}>
                Back to tuning
              </button>
              <button type="button" onClick={() => playRef.current()}>
                Replay
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => playRef.current()}>
                Replay
              </button>
              <a href={atlasHref}>Explore this hotel</a>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The operator's panel in tune mode: what the survey found, what it chose,
 * where the camera is now, and the two things to do with it.
 */
function TunePanel({
  hotel,
  survey,
  stored,
  framing,
  live,
  link,
  onPreview,
  onCopy,
  onReset,
}: {
  hotel: FlyoverHotel;
  survey: Survey | null;
  stored: boolean;
  framing: Framing;
  live: FlyoverCamera | null;
  link: string;
  onPreview: () => void;
  onCopy: () => void;
  onReset: () => void;
}) {
  const reach = framing.plan.keys[1].range * REACH;
  const tallest = survey ? tallestNear(survey, reach) : null;
  const terrainTop = survey?.terrain.length ? Math.max(...survey.terrain.map((t) => t.top)) : null;
  const f = framing.hotelFraming;

  return (
    <aside className="fo-tune">
      <h2>{hotel.name}</h2>
      <ul>
        {!survey ? (
          <li>Survey off — the reel’s default angle.</li>
        ) : (
          <>
            <li>
              {survey.sources.buildings
                ? `${survey.buildings.length} buildings mapped within ${SURVEY_RADIUS} m`
                : "OpenStreetMap did not answer — no building heights"}
            </li>
            <li>
              {survey.hotelHeight != null
                ? `Hotel about ${round(survey.hotelHeight)} m tall — looking ${round(framing.lift)} m up`
                : `Hotel height unknown — looking ${round(framing.lift)} m up`}
            </li>
            {tallest && tallest.top > framing.lift && (
              <li>
                Tallest within {round(reach)} m: {tallest.kind === "terrain" ? "ground rising to " : ""}
                {round(tallest.top)} m, {round(tallest.distance)} m to the {compass(tallest.bearing)}
              </li>
            )}
            <li>
              {!survey.sources.terrain
                ? "Terrain unavailable"
                : terrainTop != null && terrainTop > 10
                  ? `Ground rises up to ${round(terrainTop)} m within ${SURVEY_RADIUS} m`
                  : "Terrain flat"}
            </li>
          </>
        )}
        <li className="fo-tune-auto">
          {f
            ? `${stored ? "Stored" : "Auto"}: tilt ${round(f.tilt)}° on the ${sideOf(framing.plan)} side${
                f.clear ? "" : " — boxed in; the best there is"
              }`
            : `Shot: tilt ${round(framing.plan.keys[1].tilt)}° on the ${sideOf(framing.plan)} side`}
        </li>
      </ul>
      <p className="fo-tune-live">
        {live
          ? `Now: ${round(live.range)} m · tilt ${round(live.tilt)}° · heading ${round(live.heading)}°`
          : "Now: —"}
      </p>
      <p className="fo-tune-hint">
        Frame the hotel the way the middle of the hover should see it. The shot turns through this view.
      </p>
      <div className="fo-tune-btns">
        <button type="button" className="primary" onClick={onPreview}>
          Preview
        </button>
        <button type="button" onClick={onCopy}>
          Copy link
        </button>
        <button type="button" onClick={onReset}>
          Reset to auto
        </button>
      </div>
      {link && <input className="fo-tune-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />}
    </aside>
  );
}
