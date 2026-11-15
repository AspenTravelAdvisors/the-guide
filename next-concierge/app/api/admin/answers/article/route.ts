// Load and save one article in the answers editor.

import { guard } from "@/lib/answers-editor/auth";
import { checkPage, linkContext } from "@/lib/answers-editor/check";
import { branchAllowed, readAll, readArticle, saveArticle, StoreError } from "@/lib/answers-editor/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const fail = (err: unknown) =>
  json(
    { error: err instanceof Error ? err.message : "Something went wrong." },
    err instanceof StoreError ? err.status : 500,
  );

const sourceOk = (s: unknown): s is "held" | "live" => s === "held" || s === "live";
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const today = () => new Date().toISOString().slice(0, 10);

export async function GET(req: Request) {
  const refused = guard(req);
  if (refused) return refused;
  const q = new URL(req.url).searchParams;
  const branch = q.get("branch") || "";
  const source = q.get("source");
  const slug = q.get("slug") || "";
  if (!branchAllowed(branch) || !sourceOk(source) || !slug) return json({ error: "Bad request." }, 400);
  try {
    const { entry, version } = await readArticle(branch, source, slug);
    return json({ entry, version });
  } catch (err) {
    return fail(err);
  }
}

type SaveBody = {
  branch?: string;
  source?: string;
  slug?: string;
  version?: string;
  page?: Record<string, unknown> & { slug?: string };
  meta?: { release?: string; approved?: boolean; review_notes?: string[]; checked_notes?: string[] };
  stampUpdated?: boolean;
};

export async function PUT(req: Request) {
  const refused = guard(req, { write: true });
  if (refused) return refused;
  let body: SaveBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request." }, 400);
  }
  const { branch = "", source, slug = "", version = "", page, meta = {} } = body;
  if (!branchAllowed(branch) || !sourceOk(source) || !slug || !version || !page) {
    return json({ error: "Bad request." }, 400);
  }
  // The slug is the page's address: fixed once drafted.
  if (page.slug !== slug) return json({ error: "The slug cannot be changed in the editor." }, 400);

  try {
    const all = await readAll(branch);
    const errors = checkPage(page, linkContext(all)).filter((p) => p.level === "error");
    if (errors.length) {
      return json({ error: "Fix the errors before saving.", problems: errors }, 422);
    }

    const { entry } = await readArticle(branch, source, slug);
    let next: Record<string, unknown>;
    let what: string;
    if (source === "held") {
      const notes = (meta.review_notes || []).map(String).filter((n) => n.trim());
      const checked = (meta.checked_notes || []).map(String).filter((n) => notes.includes(n));
      const release = meta.release && MONTH.test(meta.release) ? meta.release : (entry as { release: string }).release;
      next = {
        ...(entry as object),
        release,
        approved: !!meta.approved,
        review_notes: notes,
        checked_notes: checked,
        page,
      };
      what = "held draft";
    } else {
      next = body.stampUpdated ? { ...page, updated: today() } : page;
      what = "answer page";
    }
    const question = String(page.question || slug);
    const saved = await saveArticle(
      branch,
      source,
      slug,
      version,
      next,
      `Edit ${what}: ${question}\n\nSaved in the answers editor (/admin/answers).`,
    );
    return json({ ok: true, entry: next, ...saved });
  } catch (err) {
    return fail(err);
  }
}
