// GET /api/hotel/luxury-hotels/:id — one full hotel record, or 404.
// Backed by the in-process lib/atlas hotel backend.

import atlasDispatch from "@/lib/atlas/index.js";
import { isRateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Generous browsing budget in its own bucket, the same one the villa search
// has: a traveler on the map never meets it, a script walking every id does.
const RATE = { bucket: "hotel", max: 120, windowMs: 60_000 };

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const limited = await isRateLimited(req, {}, RATE);
  if (limited) return limited;

  const { id } = await ctx.params;
  const rec = atlasDispatch.getById("hotel", String(id || ""));
  if (!rec) {
    return new Response(JSON.stringify({ error: "Not found", id }), {
      status: 404,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
  return new Response(JSON.stringify(rec), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
    },
  });
}
