// lib/lead-inbox.ts — the one way a lead reaches the advisors' inbox.
//
// It lived inside /api/handoff. The bucket-list watch (/api/watch) and its
// nightly digest send to the same inbox, and three copies of "POST to Formspree,
// log what it said, never show the visitor the provider's error" would drift
// the first time the endpoint changes.
//
// Env:
//   HANDOFF_ENDPOINT (optional) — Formspree (or any JSON webhook) URL. Defaults
//     to the project's Formspree form. Swap per environment without a redeploy.

import { flyoverLink, isHotelId } from "@/lib/atlas/flyover-bus";

const HANDOFF_ENDPOINT =
  process.env.HANDOFF_ENDPOINT || "https://formspree.io/f/mjgdzeye";

/**
 * POST one lead. `_subject` and `message` are what an advisor reads; every
 * other field is there for filtering in the inbox. Returns whether the inbox
 * took it. Failures are logged here, with the provider's own text, and never
 * thrown: each caller decides what the visitor sees.
 */
export async function sendToLeadInbox(
  payload: Record<string, string | number>,
  label = "Lead",
): Promise<boolean> {
  try {
    const res = await fetch(HANDOFF_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`${label} capture failed (${res.status}):`, detail.slice(0, 500));
      return false;
    }
    return true;
  } catch (err) {
    console.error(`${label} capture failed:`, err);
    return false;
  }
}

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * A flyover reel for each hotel among `items`, as "name: link" lines.
 *
 * The reel is the first thing an advisor can send back: no other agency can
 * answer "I'm thinking about the Hotel del Coronado" with a film of it. The
 * link is built from the id alone, on our own domain, so nothing a caller
 * supplies can turn it into a link somewhere else. `partner` is the referral
 * code to carry on the link (lib/referral.ts).
 */
export function reelLines(
  items: ReadonlyArray<{ type: string; id: string; name: string }>,
  partner?: string | null,
  max = 6,
): string[] {
  return items
    .filter((i) => i.type === "hotel" && isHotelId(i.id))
    .slice(0, max)
    .map((i) => `${i.name.slice(0, 120)}: ${flyoverLink(i.id, partner)}`);
}
