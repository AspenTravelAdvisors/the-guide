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
import { isRateLimited, isRouteSaturated } from "@/lib/rate-limit";

// ── Who may send, and how much ──────────────────────────────────────────────
//
// The two forms that write to the inbox (/api/handoff, /api/watch) used to
// share the Guide's per-IP minute counter and nothing else. That left the inbox
// open to the same shape of flood that drained the Guide in September: a proxy
// pool where no single address is ever fast. Three limits, each in its own
// bucket so sending a request never eats a traveler's chat allowance:
//
//   per IP, per minute   a burst from one address
//   per IP, per day      one address pacing itself
//   everyone, per hour   the pool. Far above any real day's leads (a normal day
//                        is a handful), so only a flood meets it.
//
// A real traveler turned away by any of them is told how to reach a person
// directly: a lost lead costs more here than a spam email does.
const LEAD_IP_PER_MINUTE = Number(process.env.LEAD_RATE_MAX) || 5;
const LEAD_IP_PER_DAY = Number(process.env.LEAD_RATE_DAILY_MAX) || 20;
const LEAD_ALL_PER_HOUR = Number(process.env.LEAD_RATE_GLOBAL_MAX) || 60;
const HOUR_MS = 60 * 60 * 1000;

const REACH_US =
  "That didn't go through just now. Please call Aspen Travel Advisors on 970.925.1002 " +
  "or email Book@BeVvip.com and an advisor will pick it up.";

/** The per-IP limits for one lead form. A 429 to return, or null to proceed. */
export async function leadRateLimited(
  req: Request,
  cors: Record<string, string>,
  form: "handoff" | "watch",
): Promise<Response | null> {
  return (
    (await isRateLimited(req, cors, { bucket: form, max: LEAD_IP_PER_MINUTE })) ??
    (await isRateLimited(req, cors, {
      bucket: `${form}-day`,
      max: LEAD_IP_PER_DAY,
      windowMs: 24 * HOUR_MS,
      message: REACH_US,
    }))
  );
}

/**
 * The hourly ceiling across both forms and every caller. Call it once a
 * submission has passed validation and is about to be sent, so malformed
 * requests cannot use up the allowance real leads need.
 */
export function leadInboxSaturated(cors: Record<string, string>): Promise<Response | null> {
  return isRouteSaturated(cors, {
    bucket: "leads",
    globalMax: LEAD_ALL_PER_HOUR,
    windowMs: HOUR_MS,
    message: REACH_US,
  });
}

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
