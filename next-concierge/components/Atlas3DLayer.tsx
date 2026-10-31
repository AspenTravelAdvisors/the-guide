"use client";

/**
 * The photoreal engine, mounted inside the shared atlas shell.
 *
 * Google Photorealistic 3D Tiles are real photogrammetry mesh of the actual
 * buildings — Mapbox has no equivalent, and the work order is emphatic that for
 * a luxury travel product this is the single most persuasive thing the app
 * does. It used to live only in `public/maps/hotel/index.html`, reachable
 * through an iframe, which is why it was a destination rather than a view.
 *
 * Here it is a *layer*: it sits in the same box as the Mapbox canvas, takes the
 * camera from it on the way in and hands one back on the way out, and draws the
 * collection the rail has filtered rather than a second copy of the whole
 * inventory. Everything the traveller established — filters, selection, camera
 * — survives the switch, which is the whole difference between an engine choice
 * and another page.
 *
 * Camera behaviour is ported from the standalone atlas, including the fix for
 * the deep-link orbit race recorded in STATE.md (2026-07-29): `gmp-animationend`
 * also fires when a flight is INTERRUPTED, so an orbit armed naively starts
 * while its own fly-in is still running, and the two fight for the camera every
 * frame. The `seq`/80%-elapsed guard below is what makes that safe.
 */

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  DETAIL_RANGE,
  INSPECT_RANGE,
  INSPECT_TILT,
  categoryColor,
  flightDuration,
  groundAltitude,
  loadGoogle3D,
  tiltForRange,
  type Camera3D,
  type Map3DElement,
  type Marker3D,
} from "@/lib/atlas/google3d";
import { flyoverCamera, flyoverShortPlan } from "@/lib/atlas/flyover";
import { FLYOVER_EVENT, setFlyoverState, type FlyoverRequest } from "@/lib/atlas/flyover-bus";
import { hotelFlyover } from "@/lib/analytics";

/** One property on the photoreal map. */
export interface Point3D {
  id: string;
  lng: number;
  lat: number;
  name: string;
  category?: string | null;
}

export interface Camera3DState {
  lat: number;
  lng: number;
  range: number;
  tilt: number;
  heading: number;
}

/** What the shell can ask of the engine once it is live. */
export interface Atlas3DHandle {
  /** The camera right now, for handing back to Mapbox on the way out. */
  getCamera(): Camera3DState | null;
  /** Fly to a property at inspection range, optionally with the cinematic orbit. */
  focus(id: string, opts?: { orbit?: boolean }): void;
  /** Frame a set of points — the photoreal equivalent of fitBounds. */
  fit(points: Point3D[]): void;
}

interface Props {
  ref?: RefObject<Atlas3DHandle | null>;
  /** Everything currently passing the filters. */
  points: Point3D[];
  /** The open property, drawn larger and orbited. */
  selectedId?: string | null;
  onSelect: (id: string) => void;
  /** Where to put the camera on mount — handed over from Mapbox. */
  initialCamera: Camera3DState;
  /** The engine could not start; the shell falls back to Mapbox. */
  onUnavailable: (reason: "nokey" | "load") => void;
  /** Fired once the first frame is up, so the shell can drop its spinner. */
  onReady?: () => void;
}

/** Resting pin sizes, from the standalone atlas. */
const BASE_SCALE = 0.7;
const SELECTED_SCALE = 1.25;
/** Appending 2,500 web components at once locks the main thread; chunk it. */
const APPEND_CHUNK = 250;
/**
 * Above this the field is drawn as it is; below it every point gets a marker.
 * The standalone atlas drew all 2,501 and it was survivable, but it was also
 * the only thing on the page. Here the Mapbox canvas, the rail and the card
 * list are all still mounted, so the ceiling is lower and honest.
 */
const MAX_MARKERS = 1200;
/**
 * The longest the orbit waits for the tiles to finish streaming. Google fires
 * `gmp-steadychange` only on a CHANGE, so a property whose tiles were already
 * cached never reports steady again; this is that case's start, not a timeout.
 */
const ORBIT_STEADY_WAIT = 3500;
/** Looked-at height for the Flyover with nothing better known: a low-rise façade. */
const FLYOVER_LIFT = 15;
/** The atlas's slow orbit, which also takes over when a flyover ends. */
const ORBIT_MS = 240000;
const ORBIT_ROUNDS = 3;
const ease = (x: number) => {
  const c = Math.min(Math.max(x, 0), 1);
  return c * c * (3 - 2 * c);
};

export default function Atlas3DLayer({
  ref,
  points,
  selectedId,
  onSelect,
  initialCamera,
  onUnavailable,
  onReady,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map3DElement | null>(null);
  const markersRef = useRef<Map<string, Marker3D & { _pin?: { scale: number } }>>(new Map());
  const pointsRef = useRef<Point3D[]>(points);
  const selectedRef = useRef<string | null>(selectedId ?? null);
  const onSelectRef = useRef(onSelect);
  const libsRef = useRef<Awaited<ReturnType<typeof loadGoogle3D>> | null>(null);
  /*
   * The engine loads asynchronously, so the marker effect below runs once
   * before there is anything to append to. Without this flag it would never run
   * again for an unchanged `points` — the field would stay empty until the next
   * filter change. Flipping state on load is what re-runs it.
   */
  const [live, setLive] = useState(false);

  // Camera bookkeeping — see the orbit-race note in the file header.
  const flySeq = useRef(0);
  const orbitArm = useRef<(() => void) | null>(null);
  const orbitHold = useRef<(() => void) | null>(null);
  const tiltTimer = useRef<number>(0);
  /** The Flyover's frame loop, while one is playing. */
  const flyoverRaf = useRef(0);

  pointsRef.current = points;
  onSelectRef.current = onSelect;

  /* ── Camera ─────────────────────────────────────────────────────────── */

  const stopOrbit = useCallback(() => {
    // The Flyover is camera motion like the orbit, and yields to the same things.
    if (flyoverRaf.current) {
      cancelAnimationFrame(flyoverRaf.current);
      flyoverRaf.current = 0;
      setFlyoverState({ playing: null });
    }
    const map = mapRef.current;
    if (!map) return;
    if (orbitArm.current) {
      map.removeEventListener("gmp-animationend", orbitArm.current);
      orbitArm.current = null;
    }
    orbitHold.current?.();
    try {
      map.stopCameraAnimation?.();
    } catch {
      /* the element may already be detached */
    }
  }, []);

  const flyTo = useCallback(
    (opts: {
      lat: number;
      lng: number;
      range?: number;
      tilt?: number;
      heading?: number;
      duration?: number;
      orbit?: boolean;
      altitude?: number;
    }) => {
      const map = mapRef.current;
      if (!map) return;
      stopOrbit();
      const seq = ++flySeq.current;
      const heading = opts.heading ?? 0;
      const range = opts.range ?? DETAIL_RANGE;
      const tilt = tiltForRange(opts.tilt ?? 45, range);

      const go = (altitude: number) => {
        if (seq !== flySeq.current) return; // superseded while awaiting elevation
        const center = { lat: opts.lat, lng: opts.lng, altitude };
        const endCamera: Camera3D = { center, tilt, range, heading };
        if (typeof map.flyCameraTo === "function") {
          try {
            const durationMillis = opts.duration ?? 2200;
            map.flyCameraTo({ endCamera, durationMillis });
            if (opts.orbit && typeof map.flyCameraAround === "function") {
              /*
               * Arm the orbit on the end of THIS flight, not on any animation
               * end. `gmp-animationend` also fires when an earlier flight is
               * interrupted, so a deep link that frames a property and then
               * opens it would arm the orbit while this flight is still
               * running — and flyCameraAround re-sets the camera every frame,
               * so the two fight and the view never settles. An early event
               * belongs to the flight we just superseded: re-arm and wait.
               */
              const t0 = Date.now();
              const arm = () => {
                if (seq !== flySeq.current) {
                  orbitArm.current = null;
                  return;
                }
                if (Date.now() - t0 < durationMillis * 0.8) {
                  map.addEventListener("gmp-animationend", arm, { once: true });
                  return;
                }
                orbitArm.current = null;
                /*
                 * Hold the orbit until the tiles have streamed in. A camera
                 * that never stops moving never lets the mesh refine — on a
                 * phone the property sat as low-detail mesh for the whole
                 * orbit. Let it settle sharp, then turn.
                 */
                let timer = 0;
                const onSteady = (e: Event) => {
                  if ((e as Event & { isSteady?: boolean }).isSteady) begin();
                };
                const release = () => {
                  map.removeEventListener("gmp-steadychange", onSteady);
                  window.clearTimeout(timer);
                  orbitHold.current = null;
                };
                const begin = () => {
                  release();
                  if (seq !== flySeq.current) return;
                  try {
                    map.flyCameraAround?.({
                      camera: endCamera,
                      durationMillis: ORBIT_MS,
                      rounds: ORBIT_ROUNDS,
                    });
                  } catch {
                    /* orbit is decoration; the arrival already happened */
                  }
                };
                orbitHold.current = release;
                map.addEventListener("gmp-steadychange", onSteady);
                timer = window.setTimeout(begin, ORBIT_STEADY_WAIT);
              };
              orbitArm.current = arm;
              map.addEventListener("gmp-animationend", arm, { once: true });
            }
            return;
          } catch {
            /* fall through to an instant set */
          }
        }
        try {
          map.center = center;
          map.range = range;
          map.tilt = tilt;
          map.heading = heading;
        } catch {
          /* detached */
        }
      };

      if (opts.altitude != null) return go(opts.altitude);
      // Terrain only matters up close; on wide framings a few km of elevation
      // is negligible, so skip the lookup and fly immediately.
      if (range > 120000) return go(0);
      groundAltitude(opts.lat, opts.lng).then(go);
    },
    [stopOrbit],
  );

  /**
   * Frame a set of points. The east-west span is scaled by the viewport aspect
   * ratio so the framing is consistent in portrait and landscape — on a tall
   * screen the horizontal extent is the binding constraint.
   */
  const fit = useCallback(
    (pts: Point3D[]) => {
      if (!pts.length) return;
      if (pts.length === 1) {
        flyTo({ lat: pts[0].lat, lng: pts[0].lng, range: 3400, tilt: 60, duration: 2000 });
        return;
      }
      let minLa = 90, maxLa = -90, minLo = 180, maxLo = -180;
      for (const p of pts) {
        if (p.lat < minLa) minLa = p.lat;
        if (p.lat > maxLa) maxLa = p.lat;
        if (p.lng < minLo) minLo = p.lng;
        if (p.lng > maxLo) maxLo = p.lng;
      }
      const cLat = (minLa + maxLa) / 2;
      const cLng = (minLo + maxLo) / 2;
      const latSpan = maxLa - minLa;
      const lngSpan = (maxLo - minLo) * Math.cos((cLat * Math.PI) / 180);
      const host = hostRef.current;
      const aspect = Math.max((host?.clientWidth || 1) / (host?.clientHeight || 1), 0.35);
      const effSpan = Math.max(latSpan, lngSpan / aspect);
      let range = effSpan * 111000 * 2.6; // pad so every pin reveals, never tight
      if (!Number.isFinite(range) || range <= 0) range = 9000;
      range = Math.min(Math.max(range, 9000), 12000000);
      flyTo({ lat: cLat, lng: cLng, range, tilt: effSpan > 6 ? 0 : 45, duration: 2400 });
    },
    [flyTo],
  );

  const focus = useCallback(
    (id: string, opts?: { orbit?: boolean }) => {
      const p = pointsRef.current.find((x) => x.id === id);
      if (!p) return;
      /*
       * INSPECT_RANGE, not DETAIL_RANGE: opening a card is a request to look at
       * the BUILDING, and the standalone atlas's 2.6 km arrival answered it with
       * the neighbourhood. The orbit inherits this range, so the property turns
       * at inspection distance rather than circling a block — which is the whole
       * argument for photogrammetry over extruded footprints.
       *
       * The flight is timed from where the camera actually IS (see
       * flightDuration): at 450 m the move between two properties is a journey
       * across the ground, and a fixed 1.8s made it a cut. Measured live rather
       * than from the previous selection, so a second click mid-flight measures
       * from wherever the camera has got to and stays proportionate.
       */
      const here = mapRef.current?.center;
      flyTo({
        lat: p.lat,
        lng: p.lng,
        range: INSPECT_RANGE,
        tilt: INSPECT_TILT,
        duration: flightDuration(
          Number(here?.lat),
          Number(here?.lng),
          p.lat,
          p.lng,
        ),
        orbit: opts?.orbit ?? true,
      });
    },
    [flyTo],
  );

  /**
   * The hotel panel's Flyover: lib/atlas/flyover.ts's short cut, played in place.
   *
   * Driven per frame for the same reason as the reel — one continuous move,
   * turning while the range closes and opens — and starting from wherever the
   * camera is, so pressing it mid-orbit continues the motion instead of cutting.
   * The centre eases onto the building during the glide in, which also covers
   * a camera the traveller has panned away. It takes a flight sequence number
   * like any flight, so a card click, a gesture or a new search ends it exactly
   * as they end the orbit; when it runs out, the slow orbit carries on from its
   * last frame.
   */
  const flyover = useCallback(
    (id: string) => {
      const p = pointsRef.current.find((x) => x.id === id);
      if (!mapRef.current || !p) return;
      stopOrbit();
      const seq = ++flySeq.current;
      groundAltitude(p.lat, p.lng).then((ground) => {
        const map = mapRef.current;
        if (seq !== flySeq.current || !map) return;
        const target = { lat: p.lat, lng: p.lng, altitude: ground + FLYOVER_LIFT };
        const c0 = map.center;
        const from0 =
          c0 && [c0.lat, c0.lng, c0.altitude].every((n) => Number.isFinite(Number(n)))
            ? { lat: Number(c0.lat), lng: Number(c0.lng), altitude: Number(c0.altitude) }
            : target;
        const plan = flyoverShortPlan({
          range: Number(map.range),
          tilt: Number(map.tilt),
          heading: Number(map.heading),
        });
        setFlyoverState({ playing: id });
        hotelFlyover(id, "played");
        let start = 0;
        const frame = (now: number) => {
          if (seq !== flySeq.current || mapRef.current !== map) return;
          if (!start) start = now;
          const t = now - start;
          const cam = flyoverCamera(plan, t);
          try {
            // Eased onto the building during the glide, then left alone.
            if (t <= plan.marks.hover + 100) {
              const k = ease(t / plan.marks.hover);
              map.center = {
                lat: from0.lat + (target.lat - from0.lat) * k,
                lng: from0.lng + (target.lng - from0.lng) * k,
                altitude: from0.altitude + (target.altitude - from0.altitude) * k,
              };
            }
            map.range = cam.range;
            map.tilt = cam.tilt;
            map.heading = cam.heading;
          } catch {
            /* detached mid-frame */
          }
          if (t < plan.durationMs) {
            flyoverRaf.current = requestAnimationFrame(frame);
            return;
          }
          flyoverRaf.current = 0;
          setFlyoverState({ playing: null });
          try {
            map.flyCameraAround?.({
              camera: { center: target, range: cam.range, tilt: cam.tilt, heading: cam.heading },
              durationMillis: ORBIT_MS,
              rounds: ORBIT_ROUNDS,
            });
          } catch {
            /* the orbit is decoration; the flyover already happened */
          }
        };
        flyoverRaf.current = requestAnimationFrame(frame);
      });
    },
    [stopOrbit],
  );

  // The panel's button reaches the engine through lib/atlas/flyover-bus, and
  // the engine tells it whether there is anything to press.
  useEffect(() => {
    if (!live) return;
    setFlyoverState({ available: true, playing: null });
    const onRequest = (e: Event) => {
      const { id, play } = (e as CustomEvent<FlyoverRequest>).detail ?? {};
      if (!id) return;
      if (play) flyover(id);
      else stopOrbit();
    };
    window.addEventListener(FLYOVER_EVENT, onRequest);
    return () => {
      window.removeEventListener(FLYOVER_EVENT, onRequest);
      setFlyoverState({ available: false, playing: null });
    };
  }, [live, flyover, stopOrbit]);

  useImperativeHandle(
    ref,
    (): Atlas3DHandle => ({
      getCamera() {
        const map = mapRef.current;
        if (!map) return null;
        const c = map.center;
        if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return null;
        return {
          lat: c.lat,
          lng: c.lng,
          range: Number(map.range) || DETAIL_RANGE,
          tilt: Number(map.tilt) || 0,
          heading: Number(map.heading) || 0,
        };
      },
      focus,
      fit,
    }),
    [focus, fit],
  );

  /* ── Mount ──────────────────────────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    loadGoogle3D()
      .then((libs) => {
        if (cancelled) return;
        libsRef.current = libs;
        const { Map3DElement, MapMode } = libs.maps3d;
        const map = new Map3DElement({
          center: {
            lat: initialCamera.lat,
            lng: initialCamera.lng,
            altitude: 0,
          },
          range: initialCamera.range,
          tilt: tiltForRange(initialCamera.tilt, initialCamera.range),
          heading: initialCamera.heading,
          mode: MapMode.HYBRID,
        });
        map.style.width = "100%";
        map.style.height = "100%";
        map.style.display = "block";
        // Single-finger pan on mobile, and scroll-to-zoom without holding Ctrl.
        try {
          map.gestureHandling = "greedy";
        } catch {
          /* older builds ignore it */
        }
        host.appendChild(map);
        mapRef.current = map;

        /*
         * Flatten tilt as the camera pulls out, debounced.
         *
         * Writing tilt on every `gmp-rangechange` cancels the in-flight
         * inertial zoom, which made zooming OUT feel sticky — out lowers the
         * max tilt, so it was the only direction that kept writing. Let the
         * range settle, then flatten once.
         */
        const syncTilt = () => {
          tiltTimer.current = 0;
          const m = mapRef.current;
          if (!m) return;
          const next = tiltForRange(Number(m.tilt), Number(m.range));
          if (Number.isFinite(next) && Number(m.tilt) > next + 0.4) {
            try {
              m.tilt = next;
            } catch {
              /* detached */
            }
          }
        };
        const scheduleTilt = () => {
          if (tiltTimer.current) window.clearTimeout(tiltTimer.current);
          tiltTimer.current = window.setTimeout(syncTilt, 160);
        };
        map.addEventListener("gmp-rangechange", scheduleTilt);

        // A gesture on the map yields the camera to the traveller: without this
        // an open property's orbit keeps re-setting the camera every frame and
        // the map only becomes movable once the panel is closed.
        const yieldCamera = (e: Event) => {
          const path = typeof e.composedPath === "function" ? e.composedPath() : [];
          if (path.indexOf(map) >= 0 || e.target === map || map.contains(e.target as Node)) {
            stopOrbit();
          }
        };
        for (const type of ["pointerdown", "wheel"]) {
          window.addEventListener(type, yieldCamera, { capture: true, passive: true });
        }
        (map as unknown as { _yieldCamera?: (e: Event) => void })._yieldCamera = yieldCamera;

        setLive(true);
        onReady?.();
      })
      .catch((err: { reason?: "nokey" | "load" }) => {
        if (cancelled) return;
        onUnavailable(err?.reason === "nokey" ? "nokey" : "load");
      });

    return () => {
      cancelled = true;
      if (tiltTimer.current) window.clearTimeout(tiltTimer.current);
      if (flyoverRaf.current) cancelAnimationFrame(flyoverRaf.current);
      flyoverRaf.current = 0;
      const map = mapRef.current;
      if (map) {
        const yieldCamera = (map as unknown as { _yieldCamera?: (e: Event) => void })._yieldCamera;
        if (yieldCamera) {
          for (const type of ["pointerdown", "wheel"]) {
            window.removeEventListener(type, yieldCamera, { capture: true });
          }
        }
        try {
          map.stopCameraAnimation?.();
        } catch {
          /* already gone */
        }
        map.remove();
      }
      mapRef.current = null;
      markersRef.current.clear();
    };
    // Mount once. `initialCamera` is the handover value, not a live binding —
    // re-running this on every camera nudge would rebuild the engine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Markers ────────────────────────────────────────────────────────── */

  useEffect(() => {
    const map = mapRef.current;
    const libs = libsRef.current;
    if (!live || !map || !libs) return;
    const { Marker3DInteractiveElement, AltitudeMode } = libs.maps3d;
    const { PinElement } = libs.marker;

    const wanted = points.slice(0, MAX_MARKERS);
    const wantedIds = new Set(wanted.map((p) => p.id));
    const drawn = markersRef.current;

    // Drop what the filters removed.
    for (const [id, marker] of drawn) {
      if (wantedIds.has(id)) continue;
      marker.remove();
      drawn.delete(id);
    }

    const toAdd = wanted.filter((p) => !drawn.has(p.id));
    let cancelled = false;
    let frame = 0;
    let i = 0;

    const chunk = () => {
      if (cancelled) return;
      const end = Math.min(i + APPEND_CHUNK, toAdd.length);
      for (; i < end; i++) {
        const p = toAdd[i];
        const marker = new Marker3DInteractiveElement({
          position: { lat: p.lat, lng: p.lng, altitude: 12 },
          altitudeMode: AltitudeMode.RELATIVE_TO_MESH,
        }) as Marker3D & { _pin?: { scale: number } };
        try {
          const pin = new PinElement({
            background: categoryColor(p.category),
            borderColor: "#fffaf0",
            glyphColor: "#fffaf0",
            scale: p.id === selectedRef.current ? SELECTED_SCALE : BASE_SCALE,
          });
          marker.append(pin);
          marker._pin = pin;
        } catch {
          /* a marker without its pin still marks the spot */
        }
        marker.addEventListener("gmp-click", () => onSelectRef.current(p.id));
        map.append(marker);
        drawn.set(p.id, marker);
      }
      if (i < toAdd.length) frame = requestAnimationFrame(chunk);
    };
    chunk();

    return () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
    };
  }, [points, live]);

  /* ── Selection ──────────────────────────────────────────────────────── */

  useEffect(() => {
    selectedRef.current = selectedId ?? null;
    for (const [id, marker] of markersRef.current) {
      if (!marker._pin) continue;
      try {
        marker._pin.scale = id === selectedId ? SELECTED_SCALE : BASE_SCALE;
      } catch {
        /* detached */
      }
    }
    if (!live) return;
    if (selectedId) focus(selectedId, { orbit: true });
    else stopOrbit();
  }, [selectedId, focus, stopOrbit, live]);

  return <div ref={hostRef} className="atlas-3d" />;
}
