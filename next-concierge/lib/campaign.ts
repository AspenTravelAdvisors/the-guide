// lib/campaign.ts — which post, email or ad brought this visitor.
//
// Vercel Web Analytics can break traffic down by utm_* only on Enterprise or
// with the Web Analytics Plus add-on; on this plan the query API refuses it
// (402). Custom-event properties have no such limit, so the campaign is read
// off the landing URL here and carried on events instead:
//
//   campaign_arrival   once per visitor per campaign — the denominator
//   advisor_request_sent / booking_clicked carry `campaign` — the numerator
//
// which is enough to answer the question the dashboard cannot: which Instagram
// post sends people who go on to ask, rather than people who look and leave.
//
// First touch, 30 days, same shape as lib/arrival.ts (the AI-assistant source).
// A later visit with a different campaign is recorded as its own arrival but
// does not take the credit; the first campaign keeps it.
//
// Instagram's own links arrive without utm tags unless they are added, so this
// only measures what is tagged. Tag the link in bio and every story link, e.g.
//   https://guide.expeditionbucketlist.com/atlas/jet?utm_source=instagram&utm_medium=social&utm_campaign=<post>

const KEY = "bevvip:campaign";
const SEEN_KEY = "bevvip:campaigns-seen";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Campaign values are free text in someone else's URL; keep them bounded. */
const MAX_LEN = 80;

export interface Campaign {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  landing: string;
  at: number;
}

let memo: Campaign | null = null;

function clean(v: string | null): string {
  return (v ?? "").trim().toLowerCase().slice(0, MAX_LEN);
}

function read(): Campaign | null {
  if (memo) return memo;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Campaign;
    if (!c || typeof c.campaign !== "string" || !(Date.now() - c.at < TTL_MS)) return null;
    memo = c;
    return c;
  } catch {
    return null;
  }
}

function seen(): string[] {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Read utm_* off this page load. Returns the campaign only the first time this
 * visitor arrives on it, so the caller can emit one event without counting
 * reloads (the tags stay in the URL on refresh).
 */
export function captureCampaign(): Campaign | null {
  if (typeof window === "undefined") return null;
  let q: URLSearchParams;
  try {
    q = new URLSearchParams(window.location.search);
  } catch {
    return null;
  }
  const source = clean(q.get("utm_source"));
  const campaign = clean(q.get("utm_campaign"));
  if (!source && !campaign) return null;

  const c: Campaign = {
    source: source || "none",
    medium: clean(q.get("utm_medium")) || "none",
    campaign: campaign || "none",
    content: clean(q.get("utm_content")) || "none",
    landing: window.location.pathname,
    at: Date.now(),
  };

  const id = `${c.source}|${c.campaign}|${c.content}`;
  const already = seen();
  if (already.includes(id)) return null;

  if (!read()) memo = c;
  try {
    if (memo === c) window.localStorage.setItem(KEY, JSON.stringify(c));
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...already, id].slice(-20)));
  } catch {
    /* storage unavailable — this page view still counts via the return value */
  }
  return c;
}

/** The first campaign that brought this visitor, e.g. "jet-nov-reel", or null. */
export function campaignName(): string | null {
  if (typeof window === "undefined") return null;
  return read()?.campaign ?? null;
}
