// The answers editor's index: branches it can work on and every article on one.

import { guard } from "@/lib/answers-editor/auth";
import { branchAllowed, defaultBranch, listBranches, readAll, storeMode, StoreError, versionOf } from "@/lib/answers-editor/store";
import { CATEGORY_ORDER } from "@/lib/answers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

type Held = {
  release: string;
  topic: string;
  drafted?: string;
  approved?: boolean;
  review_notes?: string[];
  checked_notes?: string[];
  page: { slug: string; question: string; category: string };
};
type Live = { slug: string; question: string; category: string; updated?: string };

export async function GET(req: Request) {
  const refused = guard(req);
  if (refused) return refused;
  const mode = storeMode();
  if (!mode) {
    return json({ error: "Saving is not set up: add ANSWERS_EDITOR_GITHUB_TOKEN in Vercel." }, 503);
  }
  const branch = new URL(req.url).searchParams.get("branch") || defaultBranch();
  if (!branchAllowed(branch)) return json({ error: "That branch cannot be edited here." }, 400);
  try {
    const [branches, all] = await Promise.all([listBranches(), readAll(branch)]);
    const held = (all.held as Held[]).map((d) => {
      const notes = d.review_notes || [];
      const checked = new Set(d.checked_notes || []);
      return {
        source: "held" as const,
        slug: d.page.slug,
        question: d.page.question,
        category: d.page.category,
        release: d.release,
        approved: !!d.approved,
        notes: notes.length,
        checked: notes.filter((n) => checked.has(n)).length,
        version: versionOf(d),
      };
    });
    const live = (all.live as Live[]).map((a) => ({
      source: "live" as const,
      slug: a.slug,
      question: a.question,
      category: a.category,
      updated: a.updated || null,
      version: versionOf(a),
    }));
    return json({ mode, branch, branches, categories: CATEGORY_ORDER, articles: [...held, ...live] });
  } catch (err) {
    const status = err instanceof StoreError ? err.status : 500;
    return json({ error: err instanceof Error ? err.message : "Could not read the articles." }, status);
  }
}
