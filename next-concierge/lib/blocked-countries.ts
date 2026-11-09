// next-concierge/lib/blocked-countries.ts — countries the site does not serve.
//
// Owner decision, 23 September 2026: China is not a market for this business,
// and it was the source of the sustained Guide traffic that BotID classified
// "human" (every sampled guide_turn that afternoon was CN, one question every
// one to eight minutes, ~5x the normal daily volume, no inquiries). Blocked for
// the whole site, not only /api/guide: the atlas and its data are the product
// being copied, not just the model spend.
//
// Singapore and Hong Kong added 9 November 2026, same reasoning: no clients
// there, and the traffic was automated. Over the four weeks before, ~1,300 of
// ~1,310 SG/HK visitors were desktop Chrome (a handful on phones), with bursts
// like 634 pageviews from SG in one day. It was also inflating every
// before/after read of the site's numbers.
//
// Enforced for every page by the Vercel Firewall country rule (created as
// "China"; SG and HK added to it 9 November 2026), which refuses
// the request before it reaches a function and is not billed as usage. This
// helper is the second layer, in the Guide route only: the one endpoint that
// spends money stays covered if the firewall rule is ever switched off.
// (It used to run in middleware.ts on every request; removed 30 September 2026
// once the firewall rule was live, since each middleware run is billed.) Override with BLOCKED_COUNTRIES="CN,XX" (ISO 3166-1 alpha-2).
// Keep this list and the firewall rule's country list the same.

const BLOCKED = new Set(
  (process.env.BLOCKED_COUNTRIES ?? "CN,SG,HK")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean),
);

/** True when Vercel's edge geolocation places the request in a blocked country. */
export function isBlockedCountry(headers: Headers): boolean {
  const country = headers.get("x-vercel-ip-country")?.toUpperCase();
  return !!country && BLOCKED.has(country);
}

/** A plain refusal. No detail about why — nothing to tune an evasion against. */
export function blockedResponse(): Response {
  return new Response("Not available in your region.", {
    status: 403,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
