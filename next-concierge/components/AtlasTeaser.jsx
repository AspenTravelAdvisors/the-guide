// The atlas, introduced from a detail page.
//
// Many visitors arrive on a hotel or itinerary page from search and never see
// the homepage, so they never learn the globe exists. The only way to it from
// here used to be "See it on the map" in the last paragraph. This card sits
// under the title instead: a small live map of this place (a hotel's pin with
// the other hotels around it as faint dots, or a trip's drawn route), a pulsing
// pin, and one button into the interactive atlas, framed on this item.
//
// Drawn on the server as SVG, like components/SupplierMap: no map library and
// no client JavaScript, so a detail page stays a fast, crawlable page. The
// motion (the pin's pulse, the route drawing itself in) is CSS and stops under
// prefers-reduced-motion. The land is the same cached Natural Earth file, in
// the same 10-units-per-degree plate carrée.

import Link from "next/link";
import { allHotels } from "@/lib/seo/hotels";
import { ATLASES, totalCount } from "@/lib/atlas-config";
import { unroll } from "@/components/SupplierMap";

const W = 3600;
const H = 1800;
const x = (lng) => (lng + 180) * 10;
const y = (lat) => (90 - lat) * 10;
const nf = new Intl.NumberFormat("en-US");

/** Width:height of the card's map. The card's CSS aspect-ratio matches. */
const RATIO = 3;
/** Where the subject sits across the card: right of centre, clear of the text. */
const FOCUS_X = 0.7;

/**
 * @param {{
 *   href: string,
 *   collection: string,
 *   name: string,
 *   pin?: number[] | null,
 *   route?: number[][],
 *   stops?: number[][],
 *   selfId?: string,
 * }} props  Coordinates are [lng, lat].
 */
export default function AtlasTeaser({ href, collection, name, pin = null, route = [], stops = [], selfId }) {
  const line = unroll(route.length > 1 ? route : stops);
  const centre = line.length ? line.reduce((s, p) => s + p[0], 0) / line.length : null;
  const near = (p) => {
    if (centre == null) return p;
    let lng = p[0];
    while (lng - centre > 180) lng -= 360;
    while (centre - lng > 180) lng += 360;
    return [lng, p[1]];
  };
  const stopPts = stops.filter((p) => p && Number.isFinite(p[0]) && Number.isFinite(p[1])).map(near);
  const focus = pin && Number.isFinite(pin[0]) && Number.isFinite(pin[1]) ? pin : line[0] || stopPts[0] || null;
  if (!focus) return null;

  // Frame: the content's box, padded, placed so it sits right of centre, then
  // widened or heightened to RATIO. A single pin gets a regional window.
  const pts = line.length > 1 ? line : stopPts.length > 1 ? stopPts : [focus];
  let minX = Math.min(...pts.map((p) => x(p[0])));
  let maxX = Math.max(...pts.map((p) => x(p[0])));
  let minY = Math.min(...pts.map((p) => y(p[1])));
  let maxY = Math.max(...pts.map((p) => y(p[1])));
  const cw = Math.max(maxX - minX, 260) * 1.3;
  const ch = Math.max(maxY - minY, 130) * 1.35;
  let w = Math.max(cw / 0.55, ch * RATIO);
  let h = w / RATIO;
  if (h > H) { h = H; w = h * RATIO; }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  minX = cx - w * FOCUS_X;
  minY = Math.max(-20, Math.min(cy - h / 2, H - h + 20));

  // The rest of the hotel inventory in view, faintly: the card's quiet
  // argument that this is one of thousands on the map.
  const inView = (lng, lat) => {
    const px = x(lng), py = y(lat);
    return px >= minX && px <= minX + w && py >= minY && py <= minY + h;
  };
  const context = [];
  for (const o of allHotels()) {
    if (o.id === selfId || !Number.isFinite(o.lat) || !Number.isFinite(o.lng)) continue;
    for (const shift of [0, -360, 360]) {
      if (inView(o.lng + shift, o.lat)) { context.push([o.lng + shift, o.lat]); break; }
    }
    if (context.length >= 500) break;
  }

  const r = Math.max(3, w / 170);
  const color = ATLASES[collection]?.color || "var(--gold)";
  const total = nf.format(totalCount());
  // The title is just above the card, so the line does not repeat it.
  const lead = pin ? "See where it is on the globe" : "Follow the route on the globe";

  return (
    <Link href={href} className="atlas-teaser" style={{ "--tc": color }} aria-label={`Open ${name} in the interactive atlas`}>
      <svg viewBox={`${minX.toFixed(0)} ${minY.toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect x={minX} y={minY} width={w} height={h} className="supplier-map-sea" />
        {[-W, 0, W].map((dx) => (
          <image key={dx} href="/maps/shared/land-equirect.svg" x={dx} y={0} width={W} height={H} />
        ))}
        {context.map((p, i) => (
          <circle key={i} cx={x(p[0])} cy={y(p[1])} r={r * 0.42} className="at-ctx" />
        ))}
        {line.length > 1 && (
          <polyline
            className="at-route"
            pathLength={1}
            points={line.map((p) => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(" ")}
            strokeWidth={Math.max(2, w / 420)}
          />
        )}
        {stopPts.slice(0, 40).map((p, i) => (
          <circle key={`s${i}`} cx={x(p[0])} cy={y(p[1])} r={r * 0.55} className="at-stop" />
        ))}
        <circle cx={x(focus[0])} cy={y(focus[1])} r={r * 3.2} className="at-pulse" />
        <circle cx={x(focus[0])} cy={y(focus[1])} r={r * 1.35} className="at-pin" strokeWidth={r * 0.45} />
      </svg>
      <span className="at-text">
        <span className="at-eyebrow">The Atlas · interactive</span>
        <span className="at-line">
          {lead}, among {total} stays and journeys.
        </span>
        <span className="at-btn">Open the map →</span>
      </span>
    </Link>
  );
}
