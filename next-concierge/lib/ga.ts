// lib/ga.ts — Google Analytics 4 for The Guide.
//
// The measurement ID is the Aspen Travel Advisors property, the same one that
// already records aspentraveladvisors.com. One property, two hosts, stitched
// by the linker in gaBootstrapSource(). Override it with
// NEXT_PUBLIC_GA_MEASUREMENT_ID when a preview should report somewhere else.
// The variable is inlined at build time, like every other NEXT_PUBLIC_*.
//
// Events go out through gtag(), which the bootstrap script installs. If a
// caller fires before that script (a click during hydration), the stub below
// queues onto the same dataLayer and gtag.js drains it when it loads.
//
// Nothing in this file accepts a name, an email, a phone number, or a message.
// Page views drop the query params that carry a traveler's own words (`ask`,
// `q`) and anything that looks like an email address.

const DEFAULT_MEASUREMENT_ID = "G-NM7HBQRWDS";

/** GA4 measurement IDs. Anything else is refused rather than interpolated into a script. */
const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;

function resolveMeasurementId(): string {
  const fromEnv = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  if (!fromEnv) return DEFAULT_MEASUREMENT_ID;
  return MEASUREMENT_ID_PATTERN.test(fromEnv) ? fromEnv : "";
}

export const GA_MEASUREMENT_ID = resolveMeasurementId();

/**
 * Hosts whose sessions are one session.
 *
 * gtag treats each entry as that host and its subdomains, so
 * www.aspentraveladvisors.com is covered by aspentraveladvisors.com.
 * expeditionbucketlist.com (the brand site) is a different property and is
 * not listed.
 */
export const GA_LINKER_DOMAINS = [
  "guide.expeditionbucketlist.com",
  "aspentraveladvisors.com",
] as const;

/**
 * Inline bootstrap for <head>. It only queues commands; gtag.js itself is
 * loaded afterwards by next/script (afterInteractive). The queue has to exist
 * before hydration, or the first page_view is recorded before the linker
 * config and can be dropped.
 */
export function gaBootstrapSource(): string {
  if (!GA_MEASUREMENT_ID) return "";
  const config = {
    send_page_view: false,
    linker: {
      domains: [...GA_LINKER_DOMAINS],
      accept_incoming: true,
    },
  };
  return [
    "window.dataLayer=window.dataLayer||[];",
    "function gtag(){dataLayer.push(arguments);}",
    "window.gtag=gtag;",
    "gtag('js',new Date());",
    `gtag('config',${JSON.stringify(GA_MEASUREMENT_ID)},${JSON.stringify(config)});`,
  ].join("");
}

/** Query keys whose values are the traveler's own words, or contact fields. */
const REDACTED_QUERY_PARAMS = new Set([
  "ask",
  "q",
  "email",
  "name",
  "phone",
  "message",
  "messages",
  "notes",
  "note",
  "brief",
  "contact",
]);

const EMAILISH = /[^@\s]+@[^@\s]+\.[^@\s]+/;

/**
 * Param names that must never be forwarded, even if a caller passes them.
 * `campaign_name` is allowed: the "name" there is a utm slug, not a person.
 */
const BLOCKED_PARAM =
  /(^|_)(email|e_mail|phone|tel|first_name|last_name|full_name|message|messages|notes|note|brief|transcript|contact|password)($|_)/i;

const PARAM_NAME = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
const PARAM_VALUE_MAX = 100;

export type GaParams = Record<string, string | number | boolean>;

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

/** Path plus query, with free text and contact fields removed. */
export function analyticsPagePath(pathname: string, search: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname || ""}`;
  const raw = search.startsWith("?") ? search.slice(1) : search;
  if (!raw) return path || "/";
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return path || "/";
  }
  for (const key of [...params.keys()]) {
    const values = params.getAll(key);
    if (REDACTED_QUERY_PARAMS.has(key.toLowerCase()) || values.some((value) => EMAILISH.test(value))) {
      params.delete(key);
    }
  }
  const next = params.toString();
  return next ? `${path}?${next}` : path || "/";
}

function installGtagStub() {
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag === "function") return;
  window.gtag = function gtag() {
    // gtag.js reads the Arguments object. A rest array is a different shape.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer?.push(arguments);
  };
}

function sanitizeParams(params: GaParams): GaParams {
  const out: GaParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (!PARAM_NAME.test(key) || BLOCKED_PARAM.test(key)) continue;
    if (typeof value === "string") {
      if (EMAILISH.test(value)) continue;
      out[key] = value.slice(0, PARAM_VALUE_MAX);
    } else if (typeof value === "number") {
      if (Number.isFinite(value)) out[key] = value;
    } else if (typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out;
}

/** A GA4 event. No-ops on the server and when the measurement ID was refused. */
export function gaEvent(name: string, params?: GaParams): void {
  if (typeof window === "undefined" || !GA_MEASUREMENT_ID) return;
  if (!PARAM_NAME.test(name)) return;
  try {
    installGtagStub();
    window.gtag?.("event", name, params ? sanitizeParams(params) : undefined);
  } catch {
    /* analytics must never break a user flow */
  }
}

/**
 * One page_view for a client navigation, including the first load.
 *
 * `send_page_view` is off on the config tag so this is the only sender.
 * page_location / page_path / page_title are gtag's own page fields, not
 * custom parameters, so they are not run through the 100-character trim.
 */
export function gaPageView(pagePath: string): void {
  if (typeof window === "undefined" || !GA_MEASUREMENT_ID) return;
  try {
    installGtagStub();
    const path = pagePath.startsWith("/") ? pagePath : `/${pagePath}`;
    window.gtag?.("event", "page_view", {
      page_path: path,
      page_location: `${window.location.origin}${path}`,
      page_title: document.title,
    });
  } catch {
    /* analytics must never break a user flow */
  }
}
