/**
 * The hotel panel's Flyover button ⇄ the photoreal engine.
 *
 * The panel (components/HotelDossier) and the engine (components/Atlas3DLayer)
 * sit in different branches of the atlas tree and neither owns the other, so
 * they meet here, the way the demo's events do: the engine says whether it is
 * drawing and which hotel it is flying, and the panel asks it to fly. The
 * button only exists while the engine is drawing — on the flat map there is no
 * building to fly round.
 */

import { SITE_URL } from "@/lib/site-url.js";

export interface FlyoverState {
  /** The photoreal engine is mounted and drawing. */
  available: boolean;
  /** The hotel whose flyover is playing, or null. */
  playing: string | null;
}

let state: FlyoverState = { available: false, playing: null };
const subscribers = new Set<(s: FlyoverState) => void>();

export function flyoverState(): FlyoverState {
  return state;
}

export function setFlyoverState(patch: Partial<FlyoverState>) {
  state = { ...state, ...patch };
  subscribers.forEach((fn) => fn(state));
}

export function onFlyoverState(fn: (s: FlyoverState) => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export const FLYOVER_EVENT = "bevvip:hotel-flyover";

export interface FlyoverRequest {
  id: string;
  /** false stops the one playing. */
  play: boolean;
}

export function requestFlyover(id: string, play = true) {
  window.dispatchEvent(new CustomEvent<FlyoverRequest>(FLYOVER_EVENT, { detail: { id, play } }));
}

/**
 * The full reel for this hotel, for an advisor to send a lead: on the public
 * domain whatever host the panel is open on, and rolling by itself once the
 * tiles are in, because the person opening it never saw a Play button before.
 *
 * `ref` is a referral partner's code (lib/referral.ts). A reel is the link most
 * likely to be forwarded — to a spouse, to the friends on the trip — so the
 * partner who introduced the traveler rides along on it.
 */
export function flyoverLink(id: string, ref?: string | null): string {
  const partner = ref ? `&ref=${encodeURIComponent(ref)}` : "";
  return `${SITE_URL}/demo/hotel?hotel=${encodeURIComponent(id)}&autoplay=1${partner}`;
}

/** Hotel ids as the feed writes them: h_00936, h_v6164008. */
export const isHotelId = (id: unknown): id is string =>
  typeof id === "string" && /^h_v?\d{1,10}$/.test(id);
