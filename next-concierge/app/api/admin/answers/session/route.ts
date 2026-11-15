// Sign in to and out of the answers editor. See lib/answers-editor/auth.js.

import { editorPasswordSet, issueSession, passwordMatches, SESSION_COOKIE } from "@/lib/answers-editor/auth";
import { isRateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });

const cookie = (value: string, maxAge: number) =>
  `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;

export async function POST(req: Request) {
  if (req.headers.get("x-answers-editor") !== "1") return json({ error: "Missing editor header." }, 403);
  if (!editorPasswordSet()) {
    return json({ error: "The editor is not set up yet: add ANSWERS_EDITOR_PASSWORD (12 characters or more) in Vercel." }, 503);
  }
  // Five tries per quarter hour per address. A shared password is only as good
  // as the guessing it can be put through.
  const limited = await isRateLimited(req, {}, {
    bucket: "answers-editor-login",
    max: 5,
    windowMs: 15 * 60_000,
    message: "Too many sign-in attempts. Wait fifteen minutes and try again.",
  });
  if (limited) return limited;

  let password = "";
  try {
    password = String((await req.json())?.password ?? "");
  } catch {
    /* fall through to the refusal */
  }
  if (!passwordMatches(password)) return json({ error: "That password is not right." }, 401);
  const s = issueSession();
  return json({ ok: true }, 200, { "set-cookie": cookie(s.value, s.maxAge) });
}

export async function DELETE() {
  return json({ ok: true }, 200, { "set-cookie": cookie("", 0) });
}
