// A static route map for the supplier pages, drawn on the server as SVG.
//
// No map library and no client JavaScript: these pages exist to be read by a
// crawler and skimmed on a phone, and a WebGL globe is the wrong tool for both.
// The land is one cached file (public/maps/shared/land-equirect.svg, Natural
// Earth 1:110m in plate carrée, 10 units per degree) and the routes are
// polylines in the same coordinate system, so the two cannot drift apart.
//
// Coordinates arrive as [lng, lat]. Each line is "unrolled" so a route that
// crosses the antimeridian (Samoa to Australia, Alaska to Japan) keeps going
// east instead of jumping back across the map, and the land is tiled three
// times wide so the unrolled part still has coastlines under it.

const W = 3600;
const H = 1800;
const x = (lng) => (lng + 180) * 10;
const y = (lat) => (90 - lat) * 10;

function unroll(points) {
  const out = [];
  let shift = 0;
  let prev = null;
  for (const [lng, lat] of points) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    let l = lng + shift;
    if (prev != null) {
      while (l - prev > 180) { l -= 360; shift -= 360; }
      while (prev - l > 180) { l += 360; shift += 360; }
    }
    out.push([l, lat]);
    prev = l;
  }
  return out;
}

/**
 * @param {{ lines?: {points: number[][], color?: string, label?: string}[],
 *           dots?: {at: number[], label?: string, color?: string}[],
 *           title: string, caption?: string }} props
 */
export default function SupplierMap({ lines = [], dots = [], title, caption }) {
  const drawn = lines.map((l) => ({ ...l, points: unroll(l.points || []) })).filter((l) => l.points.length > 1);
  // Dots follow the lines across the antimeridian: each is shifted by whole
  // turns to sit nearest the routes' centre, so a stop on an unrolled route
  // lands on the route rather than a map-width away from it.
  const linePts = drawn.flatMap((l) => l.points);
  const centre = linePts.length ? linePts.reduce((s, p) => s + p[0], 0) / linePts.length : null;
  const pts = dots
    .filter((d) => d.at && Number.isFinite(d.at[0]) && Number.isFinite(d.at[1]))
    .map((d) => {
      if (centre == null) return d;
      let lng = d.at[0];
      while (lng - centre > 180) lng -= 360;
      while (centre - lng > 180) lng += 360;
      return { ...d, at: [lng, d.at[1]] };
    });
  const all = [...drawn.flatMap((l) => l.points), ...pts.map((d) => d.at)];
  if (all.length < 2) return null;

  // Frame the content, padded, at a ratio between 1.5:1 and 2.2:1.
  let minX = Math.min(...all.map((p) => x(p[0])));
  let maxX = Math.max(...all.map((p) => x(p[0])));
  let minY = Math.min(...all.map((p) => y(p[1])));
  let maxY = Math.max(...all.map((p) => y(p[1])));
  let w = Math.max(maxX - minX, 200);
  let h = Math.max(maxY - minY, 120);
  const padX = w * 0.12 + 40;
  const padY = h * 0.18 + 40;
  minX -= padX; maxX = minX + w + padX * 2; w = maxX - minX;
  minY -= padY; maxY = minY + h + padY * 2; h = maxY - minY;
  if (w / h < 1.5) { const nw = h * 1.5; minX -= (nw - w) / 2; w = nw; }
  if (w / h > 2.2) { const nh = w / 2.2; minY -= (nh - h) / 2; h = nh; }
  if (h > H) { minY = 0; h = H; }
  minY = Math.max(-40, Math.min(minY, H - h + 40));

  const r = Math.max(2.5, w / 260);
  const stroke = Math.max(1.6, w / 520);

  return (
    <figure className="supplier-map">
      <svg viewBox={`${minX.toFixed(0)} ${minY.toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}`} role="img" aria-label={title}>
        <title>{title}</title>
        <rect x={minX} y={minY} width={w} height={h} className="supplier-map-sea" />
        {[-W, 0, W].map((dx) => (
          <image key={dx} href="/maps/shared/land-equirect.svg" x={dx} y={0} width={W} height={H} />
        ))}
        {drawn.map((l, i) => (
          <polyline
            key={i}
            points={l.points.map((p) => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(" ")}
            fill="none"
            stroke={l.color || "var(--gold)"}
            strokeOpacity={0.85}
            strokeWidth={stroke}
            strokeLinejoin="round"
            strokeLinecap="round"
          >
            {l.label ? <title>{l.label}</title> : null}
          </polyline>
        ))}
        {pts.map((d, i) => (
          <circle key={i} cx={x(d.at[0])} cy={y(d.at[1])} r={r} fill={d.color || "var(--gold-light)"} stroke="#09090b" strokeWidth={r * 0.35}>
            {d.label ? <title>{d.label}</title> : null}
          </circle>
        ))}
      </svg>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
