// app/api/watch/route.ts — a traveler asks to hear when their saved trips change.
//
// Two things happen, in this order of importance:
//
//   1. The lead inbox hears about it at once. An email attached to a list of
//      specific trips is a lead whether or not anything ever changes, so it
//      goes to the advisors the same way a hand-off does — with the list, the
//      flyover reels for its hotels, and who sent the traveler.
//   2. The list is stored with today's fingerprint of each item, for the
//      nightly pass (app/api/watch/digest) to compare against. See lib/watch.ts.
//
// If the store is down the request still succeeds, because (1) is the part
// that cannot be lost; the response says `stored: false` and the inbox email
// says the automatic alerts are not running for this one.

import { corsHeaders } from "@/lib/guide-cors";
import { arrivalLabel, classifyAiSource } from "@/lib/arrival";
import { normalizeReferralCode, partnerFor, partnerLabel } from "@/lib/referral";
import {
  EMAIL_RE,
  leadInboxSaturated,
  leadRateLimited,
  reelLines,
  sendToLeadInbox,
} from "@/lib/lead-inbox";
import {
  WATCH_MAX_ITEMS,
  fingerprint,
  isCheckable,
  saveWatch,
  type Watch,
  type WatchItem,
} from "@/lib/watch";

export const runtime = "nodejs";
export const maxDuration = 30;

const clip = (s: unknown, max: number) => {
  const t = typeof s === "string" ? s.trim() : "";
  return t.length > max ? t.slice(0, max) + "…" : t;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

const FAILED = "Sorry, that didn't go through. Please try again in a moment.";

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: Request) {
  const cors = corsHeaders(req);
  const limited = await leadRateLimited(req, cors, "watch");
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON." }, { status: 400, headers: cors });
  }
  if (!isRecord(raw)) {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400, headers: cors });
  }

  const email = clip(raw.email, 200);
  if (!EMAIL_RE.test(email)) {
    return Response.json(
      { ok: false, error: "Please enter a valid email." },
      { status: 422, headers: cors },
    );
  }

  const seen = new Set<string>();
  const items: WatchItem[] = (Array.isArray(raw.items) ? raw.items : [])
    .filter(isRecord)
    .map((r) => ({ type: clip(r.type, 20), id: clip(r.id, 40), title: clip(r.title, 160) }))
    .filter((r) => {
      const k = `${r.type}:${r.id}`;
      if (!r.type || !r.id || !r.title || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, WATCH_MAX_ITEMS)
    .map((r) => (isCheckable(r.type) ? { ...r, fp: fingerprint(r.type, r.id) } : r));
  if (!items.length) {
    return Response.json(
      { ok: false, error: "There is nothing on the list to watch yet." },
      { status: 422, headers: cors },
    );
  }

  const saturated = await leadInboxSaturated(cors);
  if (saturated) return saturated;

  const name = clip(raw.name, 80);
  const partner = normalizeReferralCode(raw.partner);
  const ai = classifyAiSource(typeof raw.aiSource === "string" ? raw.aiSource : null);
  const now = new Date().toISOString();
  const watch: Watch = {
    email,
    name,
    items,
    partner,
    aiSource: ai,
    createdAt: now,
    checkedAt: now,
  };

  const stored = await saveWatch(watch);

  const referrer = partnerFor(partner);
  const lines: string[] = [];
  lines.push(`${name || email} asked to be told when anything on their bucket list changes.`);
  lines.push("They were told an advisor will email them when there is a new offer or new dates.");
  if (referrer) lines.push(`Referred by: ${partnerLabel(referrer)} (link code ${partner}). Thank them.`);
  else if (partner) lines.push(`Referral code: ${partner} (not in data/partners.json yet)`);
  if (ai) lines.push(`Found us through: ${arrivalLabel(ai)}`);
  if (!stored) {
    lines.push("");
    lines.push("NOTE: the watch store was unavailable, so no automatic alerts will follow for this list.");
  }
  lines.push("");
  lines.push(`— Watching (${items.length}) —`);
  for (const i of items) lines.push(` • ${i.title}`);
  const reels = reelLines(
    items.map((i) => ({ type: i.type, id: i.id, name: i.title })),
    partner,
  );
  if (reels.length) {
    lines.push("");
    lines.push("— Send first: flyover reels —");
    for (const r of reels) lines.push(` • ${r}`);
  }

  const sent = await sendToLeadInbox(
    {
      _subject: `Bucket-list watch — ${name || email} — ${items.length} trip${items.length > 1 ? "s" : ""}${
        referrer ? ` — via ${referrer.name}` : ""
      }`,
      name: name || "(not given)",
      email,
      category: "watch",
      source: "bucketlist",
      shortlist: items.map((i) => i.title).join(", "),
      partner: partner ?? "",
      aiSource: ai ?? "",
      message: lines.join("\n"),
    },
    "Watch",
  );

  if (!sent && !stored) {
    return Response.json({ ok: false, error: FAILED }, { status: 502, headers: cors });
  }
  return Response.json({ ok: true, stored, count: items.length }, { headers: cors });
}
