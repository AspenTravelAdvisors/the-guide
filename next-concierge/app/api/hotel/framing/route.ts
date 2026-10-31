// GET /api/hotel/framing — every hotel's stored photoreal framing (lib/atlas/framing).
//
// Fetched once, when the photoreal engine mounts, rather than per card: the
// arrival needs it the moment a card opens, and a request in that gap is a
// flight that waits. Built by scripts/build-flyover-framing.mjs; a hotel not in
// it simply arrives on the defaults.

import framing from "@/data/atlas/hotel/flyover-framing.json";

export const dynamic = "force-static";

export function GET() {
  return Response.json(framing.hotels ?? {}, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
