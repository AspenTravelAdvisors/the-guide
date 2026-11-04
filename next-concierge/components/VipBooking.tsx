"use client";

/**
 * Reserve at VIP rates — the hotel's self-serve booking action, and the access
 * code the booking site will ask for.
 *
 * This is the automated revenue path: a traveller who just wants the hotel
 * books it themselves at the VIP rate codes, with the Virtuoso benefits, and
 * no advisor time is spent. So it is drawn as a full button with the same
 * weight as "Talk to an advisor", not as a link under the address.
 *
 * The access code gets its own callout rather than a line of grey text. The
 * booking site (Aspen Travel Advisors, powered by TravelWits) opens on a
 * password screen; a traveller who arrives without having noticed "VIP" is at a
 * dead end, at the exact moment they meant to book.
 *
 * The URL comes from lib/atlas/booking.js like every other booking link: a
 * search of this property, at the traveller's dates when The Guide has them,
 * when the hotel has a TravelWits identity; otherwise the booking site's front
 * door. It is computed after mount because the dates live in the browser (the
 * shared trip), and a hotel page is built once at deploy — any date baked into
 * its HTML would be stale by the next morning. Until then the link is the front
 * door, so it works without JavaScript too.
 */

import { useEffect, useState } from "react";
import { bookingLink, TW_ACCESS_CODE } from "@/lib/atlas/booking.js";
import { getTrip, onTrip } from "@/lib/trip-state";
import { bookingClicked } from "@/lib/analytics";
import type { TripState } from "@/lib/types";

export interface VipBookingHotel {
  id: string;
  name?: string | null;
  city?: string | null;
  country?: string | null;
  adminRegion?: string | null;
  tw?: { hotelId?: string | number; lat?: number; lon?: number; label?: string } | null;
  bookUrl?: string | null;
  bookPassword?: string | null;
}

type Booking = NonNullable<ReturnType<typeof bookingLink>>;

function linkFor(hotel: VipBookingHotel, trip: TripState | null): Booking | null {
  return bookingLink(
    {
      type: "hotel",
      id: hotel.id,
      name: hotel.name,
      city: hotel.city,
      country: hotel.country,
      adminRegion: hotel.adminRegion,
      ...(hotel.tw ? { tw: hotel.tw } : {}),
      ...(hotel.bookUrl ? { bookUrl: hotel.bookUrl } : {}),
      ...(hotel.bookPassword ? { bookPassword: hotel.bookPassword } : {}),
    },
    trip,
  );
}

/** The front door, before the trip is known (and with no JavaScript). */
function frontDoor(hotel: VipBookingHotel): string | null {
  const raw = String(hotel.bookUrl || "").trim();
  if (!raw) return null;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

export default function VipBooking({
  hotel,
  variant = "panel",
}: {
  hotel: VipBookingHotel;
  /** "panel": inside the atlas side panel. "card": beside the map on a hotel page. */
  variant?: "panel" | "card";
}) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const update = (trip: TripState | null) => setBooking(linkFor(hotel, trip));
    update(getTrip());
    return onTrip(update);
    // The record is replaced, not mutated, when a different hotel opens.
  }, [hotel]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2400);
    return () => window.clearTimeout(t);
  }, [copied]);

  const url = booking?.url || frontDoor(hotel);
  if (!url) return null;
  const code = String(hotel.bookPassword || "").trim() || TW_ACCESS_CODE;
  const prefilled = booking?.kind === "deep";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // No clipboard on this origin: the code is printed large right here.
    }
  };

  return (
    <div className={`vip-booking vip-booking--${variant}`}>
      {variant === "card" && <p className="vb-eyebrow">VIP rates · Virtuoso benefits</p>}
      <a
        className="vb-btn"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => bookingClicked("hotel", booking ? !booking.needsDates : false)}
      >
        Reserve at VIP rates <span aria-hidden="true">→</span>
      </a>
      <div className="vb-code" role="note" aria-label={`Access code: ${code}`}>
        <span className="vb-code-label">Access code</span>
        <strong className="vb-code-value">{code}</strong>
        <button type="button" className="vb-code-copy" onClick={copy}>
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
      <p className="vb-hint">
        {prefilled
          ? "Your hotel is preselected. Enter the code when prompted."
          : "Enter the code when prompted, then search for this hotel."}
      </p>
    </div>
  );
}
