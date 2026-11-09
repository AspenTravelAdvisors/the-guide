// GET /api/hotel/luxury-hotels — filter/search/paginate the hotel inventory.
// Returns { total, count, results, deepLink }. Backed by the in-process
// lib/atlas hotel backend; reached same-origin by the hotel map iframe via the
// next.config rewrite (/maps/hotel/api/luxury-hotels).

import atlasDispatch from "@/lib/atlas/index.js";
import { isRateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Generous browsing budget in its own bucket, the same one the villa search
// has: a traveler on the map never meets it, a script walking every id does.
const RATE = { bucket: "hotel", max: 120, windowMs: 60_000 };

export async function GET(req: Request) {
  const limited = await isRateLimited(req, {}, RATE);
  if (limited) return limited;

  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  const result = atlasDispatch.queryAtlas("hotel", params);
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
    },
  });
}
