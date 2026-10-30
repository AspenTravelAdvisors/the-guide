import type { Metadata } from "next";
import atlasDispatch from "@/lib/atlas/index.js";
import HotelFlyover, { type FlyoverHotel, type FlyoverSettings } from "@/components/HotelFlyover";

/**
 * `/demo/hotel?hotel=<id>` — a close photoreal flyover of one property, for a
 * reel or a link to a lead. See components/HotelFlyover for the stage and
 * lib/atlas/flyover.ts for the shot.
 *
 * By default the page measures what stands around the hotel first — building
 * heights from OpenStreetMap, terrain from Google — and picks the open side
 * and a steep enough angle to see over the rest (lib/atlas/flyover.ts,
 * "Clearance"). A short hotel among towers, or under a mountain, needs it.
 *
 * The quickest way to get a hotel right is `tune=1`: frame it by eye on the
 * real tiles, Preview, and Copy link — the link carries every value below.
 *
 * Tuning, all optional; anything set here beats the survey:
 *
 *   tune=1     Frame by hand and copy a link that keeps the framing.
 *   lat, lng   Re-centre on the building. The feed's coordinates are 3–4
 *              decimals, which can be 30–50 m off — nothing at the atlas's
 *              450 m, but the hover is half that.
 *   lift       Metres above the ground to look at (default: ~45% of the
 *              hotel's mapped height, else 15).
 *   range      Closest hover range in metres (default 240; more for a tower).
 *   tilt       Hover tilt, degrees from straight down (default 62, steeper
 *              when the neighbours need it).
 *   reveal     Range the pull-back ends at, metres (default 3200).
 *   heading    The first frame's compass heading (default: the open side).
 *   auto=0     Skip the survey: the reel's fixed default angle.
 *   turn       Degrees per second of turn (default 9).
 *   speed      0.75 slower, 1.5 faster (default 1).
 *   labels=1   Google's place labels over the imagery.
 *   clean=1    No captions or end card, for an editor adding their own.
 *   autoplay=1 Roll once the tiles are in instead of waiting for Play.
 *   warm=0     Skip the tile warm-up.
 *   pin=0      No marker on the hotel during the pull-back.
 *
 * Not for the index: it is a film set, not a page.
 */

export const metadata: Metadata = {
  title: "Hotel flyover",
  robots: { index: false, follow: false },
};

/**
 * Hotel del Coronado: free-standing on the beach with nothing taller beside
 * it, a roof that is the whole point of the building, and San Diego's skyline
 * across the bay for the reveal. Ritz Paris was the first default and drew as
 * a roofless shell in the first real takes (2026-10-30). The cause was not
 * pinned down from here; the Ritz is built round courtyards, which a coarse
 * mesh can render as walls with nothing between them.
 */
const DEFAULT_HOTEL = "h_00936";

type Params = Record<string, string | string[] | undefined>;

interface HotelRecord {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const numberParam = (sp: Params, key: string): number | undefined => {
  const raw = first(sp[key]);
  if (raw == null || raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
};
const flag = (sp: Params, key: string, fallback: boolean) => {
  const raw = first(sp[key]);
  if (raw == null) return fallback;
  return !/^(0|false|no|off)$/i.test(raw.trim());
};

export default async function HotelFlyoverPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const id = first(sp.hotel)?.trim() || DEFAULT_HOTEL;
  const rec = atlasDispatch.getById("hotel", id) as HotelRecord | null;
  const lat = numberParam(sp, "lat") ?? rec?.lat ?? undefined;
  const lng = numberParam(sp, "lng") ?? rec?.lng ?? undefined;

  if (!rec || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return (
      <div className="flyover">
        <div className="fo-cover">
          <p className="fo-cover-name">No hotel to fly to</p>
          <p className="fo-cover-status">
            {rec ? `${rec.name} has no coordinates on file.` : `Nothing in the collection has the id “${id}”.`}
          </p>
          <a className="fo-play" href="/atlas/hotel">
            Find one on the atlas
          </a>
        </div>
      </div>
    );
  }

  const city = String(rec.city || "").trim();
  const country = String(rec.country || "").trim();
  const place = city && country && city !== country ? `${city}, ${country}` : city || country;

  const hotel: FlyoverHotel = { id: rec.id, name: rec.name, place, lat: lat!, lng: lng! };
  const settings: FlyoverSettings = {
    closeRange: numberParam(sp, "range"),
    closeTilt: numberParam(sp, "tilt"),
    revealRange: numberParam(sp, "reveal"),
    heading: numberParam(sp, "heading"),
    turn: numberParam(sp, "turn"),
    speed: numberParam(sp, "speed"),
    lift: numberParam(sp, "lift") != null ? Math.max(0, numberParam(sp, "lift")!) : undefined,
    labels: flag(sp, "labels", false),
    clean: flag(sp, "clean", false),
    autoplay: flag(sp, "autoplay", false),
    warm: flag(sp, "warm", true),
    pin: flag(sp, "pin", true),
    auto: flag(sp, "auto", true),
    tune: flag(sp, "tune", false),
  };

  return <HotelFlyover hotel={hotel} settings={settings} />;
}
