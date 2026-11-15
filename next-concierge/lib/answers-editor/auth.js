// Sign-in for the answers editor (/admin/answers). Server-only.
//
// One shared password, ANSWERS_EDITOR_PASSWORD, set in Vercel. Signing in sets
// an httpOnly cookie holding an expiry and an HMAC of it, keyed from the
// password, so changing the password signs everyone out. The cookie is
// SameSite=Strict, and every request that changes anything must also carry the
// x-answers-editor header, which a page on another site cannot send without a
// CORS preflight this app never grants.

import crypto from "node:crypto";

export const SESSION_COOKIE = "answers_editor";
export const SESSION_DAYS = 7;
const MIN_PASSWORD = 12;

const sha256 = (s) => crypto.createHash("sha256").update(s).digest();
const password = () => process.env.ANSWERS_EDITOR_PASSWORD || "";

/** True when a usable password is configured. */
export const editorPasswordSet = () => password().length >= MIN_PASSWORD;

const key = () => sha256(`answers-editor\0${password()}`);
const sign = (payload) => crypto.createHmac("sha256", key()).update(payload).digest("base64url");

/** Constant-time comparison against the configured password. */
export function passwordMatches(input) {
  if (!editorPasswordSet() || typeof input !== "string") return false;
  return crypto.timingSafeEqual(sha256(input), sha256(password()));
}

/** A fresh session cookie value and its lifetime in seconds. */
export function issueSession() {
  const maxAge = SESSION_DAYS * 24 * 3600;
  const exp = Math.floor(Date.now() / 1000) + maxAge;
  return { value: `${exp}.${sign(String(exp))}`, maxAge };
}

/** Whether a cookie value is a live session signed with the current password. */
export function sessionValid(value) {
  if (!editorPasswordSet() || typeof value !== "string") return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < Date.now() / 1000) return false;
  const want = Buffer.from(sign(exp));
  const got = Buffer.from(sig);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

function cookieFrom(req) {
  const header = req.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === SESSION_COOKIE) return decodeURIComponent(v.join("="));
  }
  return null;
}

/**
 * Null when the request may proceed, otherwise the Response to return.
 * `write` requests must also carry the anti-forgery header and, when the
 * browser sends one, an Origin matching this host.
 */
export function guard(req, { write = false } = {}) {
  const json = (status, error) =>
    new Response(JSON.stringify({ error }), {
      status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  if (!editorPasswordSet()) return json(503, "The editor is not set up: ANSWERS_EDITOR_PASSWORD is missing or shorter than 12 characters.");
  if (!sessionValid(cookieFrom(req))) return json(401, "Your session has ended. Sign in again.");
  if (write) {
    if (req.headers.get("x-answers-editor") !== "1") return json(403, "Missing editor header.");
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host;
    if (origin && new URL(origin).host !== host) return json(403, "Cross-site request refused.");
  }
  return null;
}
