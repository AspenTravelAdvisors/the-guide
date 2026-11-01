// app/api/watch/digest/route.ts — the nightly pass over every bucket-list watch.
//
// Run by Vercel Cron (vercel.json) a few hours after the nightly Virtuoso sync
// has deployed, so it compares against the data that sync brought in. For each
// watch it re-takes the fingerprint of every item (lib/watch.ts), and when
// anything changed it sends ONE note to the lead inbox: who the traveler is,
// what changed on which trip, links to each trip on our site and the flyover
// reel for any hotel. An advisor forwards the news personally. Then it stores
// the new fingerprints, so a change is reported once.
//
// Auth: Vercel sends `Authorization: Bearer $CRON_SECRET` on cron requests when
// CRON_SECRET is set on the project. Without the secret this route refuses
// everyone, rather than letting anyone on the internet trigger a pass.
//
// `?dry=1` reports what it would send without sending or storing anything.

import { reelLines, sendToLeadInbox } from "@/lib/lead-inbox";
import { partnerFor, partnerLabel } from "@/lib/referral";
import {
  allWatches,
  describeChange,
  fingerprint,
  isCheckable,
  itemLink,
  writeWatch,
} from "@/lib/watch";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const dry = new URL(req.url).searchParams.get("dry") === "1";

  const watches = await allWatches();
  if (watches === null) {
    console.error("Watch digest: the store could not be read.");
    return Response.json({ ok: false, error: "store unavailable" }, { status: 503 });
  }

  const now = new Date();
  let notified = 0;
  let failed = 0;
  const report: Array<{ watcher: string; changes: number }> = [];

  for (const { key, watch } of watches) {
    const changes: Array<{ title: string; link: string | null; notes: string[] }> = [];
    const items = watch.items.map((item) => {
      if (!isCheckable(item.type)) return item;
      const cur = fingerprint(item.type, item.id, now);
      const notes = describeChange(item.fp, cur);
      if (notes.length) changes.push({ title: item.title, link: itemLink(item.type, item.id), notes });
      return { ...item, fp: cur };
    });

    if (changes.length) {
      report.push({ watcher: key, changes: changes.length });
      if (dry) continue;

      const referrer = partnerFor(watch.partner);
      const lines: string[] = [];
      lines.push(
        `News on ${watch.name || watch.email}'s bucket list (${watch.email}). Write to them with it.`,
      );
      if (referrer) lines.push(`Referred by: ${partnerLabel(referrer)}.`);
      lines.push("");
      for (const c of changes) {
        lines.push(c.title);
        for (const n of c.notes) lines.push(`  ${n}`);
        if (c.link) lines.push(`  ${c.link}`);
        lines.push("");
      }
      const reels = reelLines(
        watch.items.map((i) => ({ type: i.type, id: i.id, name: i.title })),
        watch.partner,
      );
      if (reels.length) {
        lines.push("— Flyover reels for the hotels on their list —");
        for (const r of reels) lines.push(` • ${r}`);
      }

      const sent = await sendToLeadInbox(
        {
          _subject: `Bucket-list news — ${watch.name || watch.email} — ${changes
            .map((c) => c.title)
            .slice(0, 2)
            .join(", ")}${changes.length > 2 ? "…" : ""}`,
          name: watch.name || "(not given)",
          email: watch.email,
          category: "watch-digest",
          source: "watch",
          partner: watch.partner ?? "",
          message: lines.join("\n"),
        },
        "Watch digest",
      );
      // Not sent: keep the old fingerprints, so tomorrow's pass reports it again.
      if (!sent) {
        failed++;
        continue;
      }
      notified++;
    }

    if (!dry) await writeWatch(key, { ...watch, items, checkedAt: now.toISOString() });
  }

  return Response.json({ ok: true, dry, watches: watches.length, notified, failed, report });
}
