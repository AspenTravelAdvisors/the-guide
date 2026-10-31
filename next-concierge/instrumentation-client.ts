// next-concierge/instrumentation-client.ts — client half of BotID.
//
// Runs on every page load and attaches BotID's signals to requests aimed at the
// protected paths below. The server half (lib/guide-botid.ts) reads the verdict.
//
// ENFORCING. /api/guide refuses a model round to a caller classified as
// automated and hands that visitor to an advisor instead — never a 403, never
// an error bubble. The rule and the reasoning live in lib/guide-botid.ts.
//
// Only /api/guide is protected. It is the one endpoint that spends money with a
// third party per call; the browsing APIs are Vercel compute only and are
// covered by the WAF rate limits.
//
// SECURE CONTEXTS ONLY. BotID's challenge needs WebCrypto (`crypto.subtle`),
// which browsers withhold outside a secure context — and an https iframe is
// NOT a secure context when the page embedding it is plain http (every
// ancestor has to be secure). Without this guard BotID's fetch wrapper threw on
// every /api/guide call from such an embed ("undefined is not an object
// (evaluating 'crypto[...]...')") and the traveler saw only an error bubble.
// Skipping it there sends the turn without BotID's signal, which the server
// treats like any other unsigned caller (see lib/guide-botid.ts): a route to an
// advisor rather than a model round. That is the designed failure mode; an
// error bubble never is. The real cure is serving the embedding page over https.
import { initBotId } from "botid/client/core";

const webCryptoAvailable =
  typeof window !== "undefined" &&
  window.isSecureContext !== false &&
  typeof globalThis.crypto?.subtle?.importKey === "function";

if (webCryptoAvailable) {
  initBotId({
    protect: [{ path: "/api/guide", method: "POST" }],
  });
}
