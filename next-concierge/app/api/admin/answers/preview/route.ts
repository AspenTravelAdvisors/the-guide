// Live preview and checks for a page being edited. Nothing is saved here.

import { guard } from "@/lib/answers-editor/auth";
import { checkPage, linkContext, previewPage } from "@/lib/answers-editor/check";
import { branchAllowed, readAll } from "@/lib/answers-editor/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export async function POST(req: Request) {
  const refused = guard(req, { write: true });
  if (refused) return refused;
  let body: { branch?: string; page?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request." }, 400);
  }
  if (!body.page || typeof body.page !== "object") return json({ error: "No page to preview." }, 400);
  if (!branchAllowed(body.branch || "")) return json({ error: "That branch cannot be edited here." }, 400);
  try {
    const ctx = linkContext(await readAll(body.branch as string));
    return json({ preview: previewPage(body.page), problems: checkPage(body.page, ctx) });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Preview failed." }, 500);
  }
}
