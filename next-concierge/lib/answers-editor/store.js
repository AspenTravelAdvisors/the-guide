// Where the answers editor reads and saves. Server-only.
//
// Two files hold every page the editor can change:
//
//   data/answers/scheduled.json  drafts held for a later month (not on the site)
//   data/answers/generated.js    pages that are live, or in a release PR
//
// In production every save is a commit to GitHub through the contents API,
// using ANSWERS_EDITOR_GITHUB_TOKEN (a fine-grained token with Contents
// read/write and Pull requests read on this one repository). The site deploys
// from git, so a saved live page goes out with the next deploy, and a saved
// held draft goes out when its month is released.
//
// In development with no token, the editor works on the files on disk.
//
// Saves are checked per article, not per file: the client sends the version
// of the article it loaded, the server re-reads the file, and the save goes
// ahead only if that one article is unchanged. Edits to two different
// articles never collide; two edits to the same one are refused with a clear
// message instead of one silently overwriting the other.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const REPO = process.env.ANSWERS_EDITOR_REPO || "AspenTravelAdvisors/the-guide";
const BASE = process.env.ANSWERS_EDITOR_BRANCH || "main";
const PREFIX = "next-concierge/";
export const FILES = {
  held: "data/answers/scheduled.json",
  live: "data/answers/generated.js",
};
const GEN_MARK = "export const generatedAnswers";

const token = () => process.env.ANSWERS_EDITOR_GITHUB_TOKEN || "";

/** "github", "local" (development only) or null when saving is not set up. */
export function storeMode() {
  if (token()) return "github";
  if (process.env.NODE_ENV !== "production") return "local";
  return null;
}

export class StoreError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ── GitHub transport ─────────────────────────────────────────────────────────

async function gh(pathname, init = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO}${pathname}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token()}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "the-guide-answers-editor",
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
    cache: "no-store",
  });
  if (res.ok) return res.json();
  const detail = await res.text().catch(() => "");
  if (res.status === 401) throw new StoreError(502, "GitHub refused the editor's token. Check ANSWERS_EDITOR_GITHUB_TOKEN in Vercel.");
  if (res.status === 403) throw new StoreError(502, "GitHub refused the request. The token needs Contents: read and write on this repository.");
  if (res.status === 404) throw new StoreError(404, "Not found on GitHub. The branch may have been merged or deleted.");
  if (res.status === 409 || res.status === 422) throw new StoreError(409, "conflict");
  throw new StoreError(502, `GitHub error ${res.status}: ${detail.slice(0, 200)}`);
}

const cache = new Map(); // `${branch}:${file}` -> { text, sha, at }
const TTL = 10_000;

async function readFile(branch, file) {
  if (storeMode() === "local") {
    return { text: fs.readFileSync(path.join(process.cwd(), file), "utf8"), sha: null };
  }
  const k = `${branch}:${file}`;
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < TTL) return hit;
  const meta = await gh(`/contents/${PREFIX}${file}?ref=${encodeURIComponent(branch)}`);
  // The contents API leaves out the body of files over 1 MB; the blob API does not.
  let b64 = meta.content;
  if (!b64 || meta.encoding === "none") b64 = (await gh(`/git/blobs/${meta.sha}`)).content;
  const out = { text: Buffer.from(b64, "base64").toString("utf8"), sha: meta.sha, at: Date.now() };
  cache.set(k, out);
  return out;
}

async function writeFile(branch, file, text, sha, message) {
  if (storeMode() === "local") {
    fs.writeFileSync(path.join(process.cwd(), file), text);
    return { commitUrl: null };
  }
  cache.delete(`${branch}:${file}`);
  const res = await gh(`/contents/${PREFIX}${file}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: Buffer.from(text, "utf8").toString("base64"),
      sha,
      branch,
    }),
  });
  return { commitUrl: res.commit?.html_url || null };
}

// ── the two file formats ─────────────────────────────────────────────────────

function parse(file, text) {
  if (file === FILES.held) {
    const pen = JSON.parse(text);
    return { list: pen.drafts, wrap: (drafts) => `${JSON.stringify({ ...pen, drafts }, null, 2)}\n` };
  }
  const at = text.indexOf(GEN_MARK);
  if (at < 0) throw new StoreError(500, "generated.js is not in the format the scripts write.");
  const header = text.slice(0, at);
  const body = text.slice(text.indexOf("=", at) + 1).trim().replace(/;$/, "");
  let list;
  try {
    list = JSON.parse(body);
  } catch {
    throw new StoreError(500, "generated.js was edited by hand into something other than JSON, so the editor cannot read it.");
  }
  return { list, wrap: (l) => `${header}${GEN_MARK} = ${JSON.stringify(l, null, 2)};\n` };
}

const slugOf = (source, entry) => (source === "held" ? entry.page.slug : entry.slug);

/** A short fingerprint of one article as stored, for conflict checks. */
export const versionOf = (entry) =>
  crypto.createHash("sha256").update(JSON.stringify(entry)).digest("hex").slice(0, 16);

// ── what the routes call ─────────────────────────────────────────────────────

/** Branches the editor can work on: the base branch and open answer-release PRs. */
export async function listBranches() {
  if (storeMode() !== "github") return [{ name: "local", label: "This computer's files" }];
  const out = [{ name: BASE, label: `${BASE} (what the site is built from)` }];
  try {
    const pulls = await gh(`/pulls?state=open&per_page=50`);
    for (const p of pulls) {
      if (p.head?.repo?.full_name === REPO && /^answers\//.test(p.head.ref)) {
        out.push({ name: p.head.ref, label: `PR #${p.number}: ${p.title}`, url: p.html_url });
      }
    }
  } catch {
    // Without pull request access the editor still works on the base branch.
  }
  return out;
}

export const defaultBranch = () => (storeMode() === "github" ? BASE : "local");

/**
 * Both files, parsed. A branch with no scheduled.json simply has no held drafts.
 * @returns {Promise<{ held: any[], live: any[] }>}
 */
export async function readAll(branch) {
  /** @type {{ held: any[], live: any[] }} */
  const out = { held: [], live: [] };
  for (const [source, file] of Object.entries(FILES)) {
    try {
      out[source] = parse(file, (await readFile(branch, file)).text).list;
    } catch (err) {
      if (err instanceof StoreError && err.status === 404 && source === "held") out[source] = [];
      else throw err;
    }
  }
  return out;
}

export async function readArticle(branch, source, slug) {
  const { text } = await readFile(branch, FILES[source]);
  const entry = parse(FILES[source], text).list.find((e) => slugOf(source, e) === slug);
  if (!entry) throw new StoreError(404, gone(source));
  return { entry, version: versionOf(entry) };
}

const gone = (source) =>
  source === "held"
    ? "This draft is no longer in the holding file. It has probably been released: look for it under Live pages, or in this month's release PR."
    : "This page is no longer in generated.js on this branch.";

/**
 * Replace one article if it still matches `version`. Retries once when the
 * file moved underneath for an unrelated reason (another article saved).
 */
export async function saveArticle(branch, source, slug, version, next, message) {
  const file = FILES[source];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt) cache.delete(`${branch}:${file}`);
    const { text, sha } = await readFile(branch, file);
    const { list, wrap } = parse(file, text);
    const i = list.findIndex((e) => slugOf(source, e) === slug);
    if (i < 0) throw new StoreError(404, gone(source));
    if (versionOf(list[i]) !== version) {
      throw new StoreError(
        409,
        "This article was changed somewhere else since you opened it (another tab, another person, or the monthly job). Reload it to see the latest, then make your edit again.",
      );
    }
    const updated = [...list];
    updated[i] = next;
    try {
      const { commitUrl } = await writeFile(branch, file, wrap(updated), sha, message);
      return { version: versionOf(next), commitUrl };
    } catch (err) {
      if (!(err instanceof StoreError && err.message === "conflict") || attempt) {
        if (err instanceof StoreError && err.message === "conflict") {
          throw new StoreError(409, "The file changed while saving. Try saving again.");
        }
        throw err;
      }
    }
  }
  throw new StoreError(500, "Save failed.");
}

/** Only the base branch and answer-release branches may be edited. */
export function branchAllowed(branch) {
  if (storeMode() === "local") return branch === "local";
  return branch === BASE || /^answers\/[\w.-]+$/.test(branch || "");
}
