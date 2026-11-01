// lib/referral.ts — which referral partner, if any, sent this visitor.
//
// The other half of lib/arrival.ts. That file credits answer engines; this one
// credits people: the wealth manager, private banker, family office or club
// secretary who sends a client a Guide link as a gift. Their clients are
// already qualified for the trips here, so each partner is worth more than any
// channel we can buy, and the only thing that keeps a partner sending is being
// able to show them what their introductions became. So the code in their link
// has to survive all the way to the advisor's email.
//
// A link is any page with `?ref=<code>`; codes and the names that go with them
// live in data/partners.json. FIRST TOUCH, KEPT FOR 90 DAYS — longer than the
// AI arrival's 30, because a client handed a link at a quarterly review may not
// act on it until the next one. A later link from a different partner does not
// take the credit away from the first.
//
// Storage can be missing or throw (private windows, blocked site data); every
// access is guarded and a failure just means "no partner".

import partnerData from "@/data/partners.json";

const KEY = "ebl.referral";
const TTL_MS = 90 * 24 * 60 * 60 * 1000;

export interface Partner {
  name: string;
  firm?: string | null;
}

export interface Referral {
  /** The code from the link, normalized. */
  code: string;
  /** First page they landed on, path only. */
  landing: string;
  at: number;
}

const PARTNERS = (partnerData as { partners: Record<string, Partner> }).partners;

/** A code as it may be stored and sent, or null for anything that is not one. */
export function normalizeReferralCode(value: unknown): string | null {
  const v = String(value ?? "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{1,39}$/.test(v) ? v : null;
}

/** The partner a code names, or null when the code is not in data/partners.json. */
export function partnerFor(code: string | null | undefined): Partner | null {
  if (!code || !Object.hasOwn(PARTNERS, code)) return null;
  return PARTNERS[code];
}

/** "Jane Smith, Example Private Wealth", for the ribbon and the advisor email. */
export function partnerLabel(p: Partner): string {
  return p.firm ? `${p.name}, ${p.firm}` : p.name;
}

let memo: Referral | null = null;

function read(): Referral | null {
  if (memo) return memo;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as Referral;
    if (!r || !normalizeReferralCode(r.code) || !(Date.now() - r.at < TTL_MS)) return null;
    return r;
  } catch {
    return null;
  }
}

/**
 * Record this page load's referral code, if it has one and none is on file.
 * Returns the referral only when it was newly recorded, so the caller can emit
 * a one-off analytics event without double-counting reloads.
 */
export function captureReferral(): Referral | null {
  if (typeof window === "undefined") return null;
  if (read()) return null;

  let code: string | null = null;
  try {
    code = normalizeReferralCode(new URLSearchParams(window.location.search).get("ref"));
  } catch {
    /* malformed query */
  }
  if (!code) return null;

  const referral: Referral = { code, landing: window.location.pathname, at: Date.now() };
  memo = referral;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(referral));
  } catch {
    /* storage unavailable — this visit still counts */
  }
  window.dispatchEvent(new Event("ebl:referral"));
  return referral;
}

/** The referral code this visitor arrived with, or null. Safe on the server. */
export function referralCode(): string | null {
  if (typeof window === "undefined") return null;
  return read()?.code ?? null;
}
