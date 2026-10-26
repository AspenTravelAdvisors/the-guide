"use client";

/**
 * "Search as I move the map" — the shared half of the map-area limit.
 *
 * Both the villa atlas and the collection atlases can limit their card list to
 * what is on screen. That used to need a "Search this area" click after every
 * pan; the list now follows the camera on its own, on desktop and phones alike,
 * the way travellers expect a map search to behave. One rule makes that safe:
 *
 *   ONLY THE VISITOR'S OWN MOVES COUNT. The atlases move the camera themselves —
 *   a filter change refits the map to its results, a shared link flies to its
 *   view, the home globe spins. None of those is the visitor asking "what is
 *   here?", and narrowing the list to a frame the visitor never chose would
 *   fight the filter they just picked. Mapbox marks gesture-driven moves (drag,
 *   wheel, pinch, keyboard, the zoom buttons) with `originalEvent`; programmatic
 *   ones carry none, and that is the whole test.
 *
 * The preference is per viewer and per device (localStorage). The route
 * atlases (cruises, rail, jets, yachts, safaris) keep their own preference and
 * start with it OFF: there the visitor zooms in to inspect a route, and a list
 * that narrows to the frame on every zoom fights that. The place atlases
 * (villas, hotels) share the other one and start with it on.
 */

import { useCallback, useEffect, useState } from "react";

const KEY = "atlas.followMap";
const ROUTE_KEY = "atlas.followMap.routes";

/** How long the camera must sit still before the list follows it. */
export const FOLLOW_DELAY_MS = 450;

/**
 * Whether the list follows the map, and the setter for the toggle. On by
 * default for the place atlases, off for the route atlases (`routes`); while
 * it is off the "Search this area" button stands in.
 */
export function useFollowMap(
  { routes = false }: { routes?: boolean } = {},
): { follow: boolean; available: boolean; setFollow: (on: boolean) => void } {
  const key = routes ? ROUTE_KEY : KEY;
  const [pref, setPref] = useState(!routes);
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(key);
      if (v === "0") setPref(false);
      else if (v === "1") setPref(true);
    } catch { /* storage is a convenience, never required */ }
  }, [key]);
  const setFollow = useCallback((on: boolean) => {
    setPref(on);
    try { window.localStorage.setItem(key, on ? "1" : "0"); } catch { /* noop */ }
  }, [key]);
  return { follow: pref, available: true, setFollow };
}

/**
 * The visible area as a bbox both list filters understand: [west, south, east,
 * north] in degrees, longitudes wrapped into ±180 (a box that then has
 * west > east straddles the antimeridian, which both filters already handle).
 *
 * Returns null when the whole width of the world is in view. At low zoom Mapbox
 * reports longitudes past ±180 — a west of -400 is the map repeating — and a
 * box that wide limits nothing, so the honest answer is "no area limit".
 */
export function viewportBox(
  west: number, south: number, east: number, north: number,
): [number, number, number, number] | null {
  if (![west, south, east, north].every(Number.isFinite)) return null;
  if (east - west >= 360) return null;
  const wrap = (x: number) => ((((x + 180) % 360) + 360) % 360) - 180;
  const r = (n: number) => Math.round(n * 1e5) / 1e5;
  return [r(wrap(west)), r(Math.max(-90, south)), r(wrap(east)), r(Math.min(90, north))];
}
