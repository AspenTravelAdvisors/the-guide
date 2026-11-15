"use client";

// The answers editor. Pick an article on the left, edit it in the middle, see
// it as the page will look on the right, and save: each save is one commit.
// Server side: app/api/admin/answers/* and lib/answers-editor/*.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import styles from "./AnswersEditor.module.css";

// ── types ────────────────────────────────────────────────────────────────────
type Table = { caption?: string; columns: string[]; rows: string[][] };
type Section = { h2: string; paras?: string[]; list?: string[]; table?: Table };
type Evidence = { h2: string; note: string; query: string; sort: string; limit: number };
type Page = {
  slug: string;
  category: string;
  question: string;
  title: string;
  description: string;
  updated?: string;
  capsule: string;
  answer: string[];
  sections: Section[];
  evidence?: Evidence | null;
  faqs: { q: string; a: string }[];
  related: { href: string; label: string }[];
  [extra: string]: unknown;
};
type Note = { text: string; checked: boolean };
type Meta = { release: string; approved: boolean; notes: Note[]; topic?: string; drafted?: string };
type Source = "held" | "live";
type Summary = {
  source: Source;
  slug: string;
  question: string;
  category: string;
  release?: string;
  approved?: boolean;
  notes?: number;
  checked?: number;
  updated?: string | null;
  version: string;
};
type Branch = { name: string; label: string; url?: string };
type Problem = { level: "error" | "warning"; path: string; message: string };
type EvidenceRow = { id: string; name: string; where: string; rooms: number | null; perks: number; href: string };
type Preview = {
  question: string;
  title: string;
  description: string;
  capsule: string;
  category: string;
  updated: string | null;
  answer: string[];
  sections: Section[];
  faqs: { q: string; a: string }[];
  evidence: { h2: string; note: string | null; total: number; shown: number; rows: EvidenceRow[] } | null;
  related: { href: string; label: string }[];
};
type Open = { source: Source; slug: string; version: string; page: Page; meta: Meta | null; saved: string };

// ── helpers ──────────────────────────────────────────────────────────────────
async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", "x-answers-editor": "1", ...(init.headers || {}) },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) {
    window.location.reload();
    throw new Error("Signed out.");
  }
  if (!res.ok) {
    const err = new Error(body.error || `Request failed (${res.status}).`) as Error & { status?: number; problems?: Problem[] };
    err.status = res.status;
    err.problems = body.problems;
    throw err;
  }
  return body as T;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const monthLabel = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
};

function monthOptions(current?: string) {
  const out = new Set<string>();
  const d = new Date();
  for (let i = 0; i < 15; i += 1) {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + i, 1));
    out.add(x.toISOString().slice(0, 7));
  }
  if (current) out.add(current);
  return [...out].sort();
}

const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/** The page in the key order the scripts write, empty optional parts dropped. */
function normalize(p: Page): Page {
  const sections = p.sections.map((s) => {
    const out: Section = { h2: s.h2 };
    if (s.table) {
      out.table = s.table.caption ? { caption: s.table.caption, columns: s.table.columns, rows: s.table.rows } : { columns: s.table.columns, rows: s.table.rows };
    }
    const paras = (s.paras || []).filter((x) => x.trim());
    const list = (s.list || []).filter((x) => x.trim());
    if (paras.length) out.paras = paras;
    if (list.length) out.list = list;
    return out;
  });
  const known = ["slug", "category", "question", "title", "description", "updated", "capsule", "answer", "sections", "evidence", "faqs", "related"];
  const out: Page = {
    slug: p.slug,
    category: p.category,
    question: p.question,
    title: p.title,
    description: p.description,
    ...(p.updated ? { updated: p.updated } : {}),
    capsule: p.capsule,
    answer: p.answer.filter((x) => x.trim()),
    sections,
    ...(p.evidence ? { evidence: { ...p.evidence, limit: Number(p.evidence.limit) || 12 } } : {}),
    faqs: p.faqs,
    related: p.related,
  };
  for (const [k, v] of Object.entries(p)) if (!known.includes(k)) out[k] = v;
  return out;
}

function toPage(raw: Record<string, unknown>): Page {
  const p = clone(raw) as Page;
  p.answer ||= [];
  p.sections ||= [];
  p.faqs ||= [];
  p.related ||= [];
  return p;
}

const fingerprint = (o: Open | null) => (o ? JSON.stringify([normalize(o.page), o.meta]) : "");

// ── small controls ───────────────────────────────────────────────────────────
function AutoText({
  value,
  onChange,
  rows = 2,
  placeholder,
  id,
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  id?: string;
  mono?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      id={id}
      className={`${styles.input} ${styles.textarea} ${mono ? styles.mono : ""}`}
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Issues({ problems, path, exact }: { problems: Problem[]; path: string; exact?: boolean }) {
  const mine = problems.filter((p) => p.path === path || (!exact && p.path.startsWith(`${path}.`)));
  if (!mine.length) return null;
  return (
    <ul className={styles.issues}>
      {mine.map((p, i) => (
        <li key={i} className={p.level === "error" ? styles.issueError : styles.issueWarn}>
          {p.message}
        </li>
      ))}
    </ul>
  );
}

function RowTools({
  index,
  count,
  move,
  remove,
  what,
}: {
  index: number;
  count: number;
  move: (from: number, to: number) => void;
  remove: (i: number) => void;
  what: string;
}) {
  return (
    <span className={styles.rowTools}>
      <button type="button" className={styles.iconBtn} onClick={() => move(index, index - 1)} disabled={index === 0} aria-label={`Move ${what} up`} title="Move up">
        ↑
      </button>
      <button type="button" className={styles.iconBtn} onClick={() => move(index, index + 1)} disabled={index === count - 1} aria-label={`Move ${what} down`} title="Move down">
        ↓
      </button>
      <button
        type="button"
        className={`${styles.iconBtn} ${styles.danger}`}
        onClick={() => {
          if (window.confirm(`Remove this ${what}?`)) remove(index);
        }}
        aria-label={`Remove ${what}`}
        title="Remove"
      >
        ×
      </button>
    </span>
  );
}

const moved = <T,>(arr: T[], from: number, to: number) => {
  if (to < 0 || to >= arr.length) return arr;
  const out = [...arr];
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x);
  return out;
};

function TextList({
  items,
  onChange,
  what,
  path,
  problems,
  rows = 3,
}: {
  items: string[];
  onChange: (v: string[]) => void;
  what: string;
  path: string;
  problems: Problem[];
  rows?: number;
}) {
  return (
    <div className={styles.stack}>
      {items.map((t, i) => (
        <div key={i} className={styles.listItem} data-path={`${path}.${i}`}>
          <div className={styles.listHead}>
            <span className={styles.small}>
              {what} {i + 1}
            </span>
            <RowTools index={i} count={items.length} what={what.toLowerCase()} move={(a, b) => onChange(moved(items, a, b))} remove={(k) => onChange(items.filter((_, j) => j !== k))} />
          </div>
          <AutoText value={t} rows={rows} onChange={(v) => onChange(items.map((x, j) => (j === i ? v : x)))} />
          <Issues problems={problems} path={`${path}.${i}`} />
        </div>
      ))}
      <button type="button" className={styles.addBtn} onClick={() => onChange([...items, ""])}>
        + Add {what.toLowerCase()}
      </button>
    </div>
  );
}

function TableEditor({ table, onChange, path, problems }: { table: Table; onChange: (t: Table) => void; path: string; problems: Problem[] }) {
  const cols = table.columns.length;
  const setCell = (r: number, c: number, v: string) => onChange({ ...table, rows: table.rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)) });
  return (
    <div className={styles.tableEd} data-path={`${path}.table`}>
      <label className={styles.label}>Table caption (optional)</label>
      <AutoText value={table.caption || ""} rows={1} onChange={(v) => onChange({ ...table, caption: v })} />
      <div className={styles.gridScroll}>
        <table className={styles.grid}>
          <thead>
            <tr>
              {table.columns.map((c, j) => (
                <th key={j}>
                  <AutoText value={c} rows={1} onChange={(v) => onChange({ ...table, columns: table.columns.map((x, k) => (k === j ? v : x)) })} />
                  <button
                    type="button"
                    className={`${styles.miniBtn} ${styles.danger}`}
                    onClick={() => {
                      if (window.confirm("Remove this column and every cell in it?")) {
                        onChange({ ...table, columns: table.columns.filter((_, k) => k !== j), rows: table.rows.map((r) => r.filter((_, k) => k !== j)) });
                      }
                    }}
                  >
                    Remove column
                  </button>
                </th>
              ))}
              <th className={styles.gridAct} />
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i}>
                {Array.from({ length: Math.max(cols, row.length) }, (_, j) => (
                  <td key={j}>
                    <AutoText value={row[j] ?? ""} rows={2} onChange={(v) => setCell(i, j, v)} />
                  </td>
                ))}
                <td className={styles.gridAct}>
                  <RowTools index={i} count={table.rows.length} what="row" move={(a, b) => onChange({ ...table, rows: moved(table.rows, a, b) })} remove={(k) => onChange({ ...table, rows: table.rows.filter((_, x) => x !== k) })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.inline}>
        <button type="button" className={styles.addBtn} onClick={() => onChange({ ...table, rows: [...table.rows, Array(cols).fill("")] })}>
          + Add row
        </button>
        <button type="button" className={styles.addBtn} onClick={() => onChange({ ...table, columns: [...table.columns, ""], rows: table.rows.map((r) => [...r, ""]) })}>
          + Add column
        </button>
      </div>
      <Issues problems={problems} path={`${path}.table`} />
    </div>
  );
}

// ── preview ──────────────────────────────────────────────────────────────────
const MARK = /\u0001([^\u0002]*)\u0002([^\u0003]*)\u0003|⟦([^⟧]*)⟧/g;

function Prose({ text }: { text: string }) {
  if (typeof text !== "string") return null;
  const out: React.ReactNode[] = [];
  let at = 0;
  for (const m of text.matchAll(MARK)) {
    if ((m.index ?? 0) > at) out.push(text.slice(at, m.index));
    if (m[3] !== undefined) {
      out.push(
        <mark key={m.index} className={styles.badToken} title="This token cannot be resolved">
          {`{{${m[3]}}}`}
        </mark>,
      );
    } else {
      out.push(
        <a key={m.index} href={m[1]} target="_blank" rel="noreferrer">
          {m[2]}
        </a>,
      );
    }
    at = (m.index ?? 0) + m[0].length;
  }
  if (at < text.length) out.push(text.slice(at));
  return <>{out}</>;
}

function PagePreview({ p }: { p: Preview }) {
  return (
    <>
      <div className={styles.serp}>
        <p className={styles.small}>How it can appear in search</p>
        <p className={styles.serpTitle}>{p.title}</p>
        <p className={styles.serpUrl}>guide.expeditionbucketlist.com › answers</p>
        <p className={styles.serpDesc}>{p.description}</p>
      </div>
      <article className="answers-wrap answers-article">
        <nav className="answers-crumbs">
          <span>Answers</span>
          <span aria-hidden="true"> / </span>
          <span>{p.category}</span>
        </nav>
        <h1>{p.question}</h1>
        <p className="answers-updated">By Aspen Travel Advisors · Last verified {p.updated || "on release"}</p>
        {p.capsule && <p className="answers-capsule">{p.capsule}</p>}
        <div className="answers-lead">
          {p.answer.map((x, i) => (
            <p key={i}>
              <Prose text={x} />
            </p>
          ))}
        </div>
        {p.sections.map((s, i) => (
          <section key={i}>
            {s.h2 && <h2>{s.h2}</h2>}
            {s.table && (
              <div className="answers-table-scroll">
                <table>
                  {s.table.caption && <caption>{s.table.caption}</caption>}
                  <thead>
                    <tr>
                      {s.table.columns.map((c, j) => (
                        <th key={j}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.table.rows.map((r, j) => (
                      <tr key={j}>
                        {r.map((cell, k) =>
                          k === 0 ? (
                            <th key={k} scope="row">
                              <Prose text={cell} />
                            </th>
                          ) : (
                            <td key={k}>
                              <Prose text={cell} />
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(s.paras || []).map((x, j) => (
              <p key={j}>
                <Prose text={x} />
              </p>
            ))}
            {s.list && (
              <ul>
                {s.list.map((x, j) => (
                  <li key={j}>
                    <Prose text={x} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
        {p.evidence && (
          <section className="answers-evidence">
            <h2>{p.evidence.h2}</h2>
            {p.evidence.note && <p>{p.evidence.note}</p>}
            {p.evidence.rows.length ? (
              <div className="answers-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Property</th>
                      <th>Where</th>
                      <th>Rooms</th>
                      <th>Benefits listed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.evidence.rows.map((r) => (
                      <tr key={r.id}>
                        <th scope="row">
                          <a href={r.href} target="_blank" rel="noreferrer">
                            {r.name}
                          </a>
                        </th>
                        <td>{r.where}</td>
                        <td>{r.rooms ?? "—"}</td>
                        <td>{r.perks || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.badToken}>This query matches no hotels, so the table would not appear.</p>
            )}
            {p.evidence.total > p.evidence.shown && (
              <p className="answers-evidence-more">
                Showing {p.evidence.shown} of {p.evidence.total.toLocaleString("en-US")} matching properties in the atlas.
              </p>
            )}
          </section>
        )}
        <section className="answers-faq">
          <h2>Frequently asked</h2>
          {p.faqs.map((f, i) => (
            <details key={i} open>
              <summary>{f.q}</summary>
              <p>
                <Prose text={f.a} />
              </p>
            </details>
          ))}
        </section>
        <aside className="answers-related">
          <h2>Go deeper</h2>
          <ul>
            {p.related.map((r, i) => (
              <li key={i}>
                <a href={r.href} target="_blank" rel="noreferrer">
                  {r.label}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      </article>
    </>
  );
}

// ── the editor ───────────────────────────────────────────────────────────────
export default function AnswersEditor({ mode }: { mode: "github" | "local" }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branch, setBranch] = useState<string>("");
  const [categories, setCategories] = useState<string[]>([]);
  const [articles, setArticles] = useState<Summary[]>([]);
  const [listError, setListError] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Open | null>(null);
  const [loading, setLoading] = useState(false);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error" | "conflict"; text: string; url?: string | null } | null>(null);
  const [stamp, setStamp] = useState(true);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [drawer, setDrawer] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const formRef = useRef<HTMLElement>(null);
  const dirty = !!open && fingerprint(open) !== open.saved;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // ── the list ──
  const loadList = useCallback(async (b?: string) => {
    setListError("");
    try {
      const q = b ? `?branch=${encodeURIComponent(b)}` : "";
      const res = await api<{ branch: string; branches: Branch[]; categories: string[]; articles: Summary[] }>(`/api/admin/answers${q}`);
      setBranch(res.branch);
      setBranches(res.branches);
      setCategories(res.categories);
      setArticles(res.articles);
    } catch (err) {
      setListError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const confirmLeave = () => !dirtyRef.current || window.confirm("You have unsaved changes to this article. Leave without saving?");

  // ── one article ──
  async function openArticle(source: Source, slug: string, force = false) {
    if (!force && !confirmLeave()) return;
    setLoading(true);
    setStatus(null);
    setProblems([]);
    setPreview(null);
    setDrawer(false);
    try {
      const res = await api<{ entry: Record<string, unknown>; version: string }>(
        `/api/admin/answers/article?branch=${encodeURIComponent(branch)}&source=${source}&slug=${encodeURIComponent(slug)}`,
      );
      let page: Page;
      let meta: Meta | null = null;
      if (source === "held") {
        const e = res.entry as { page: Record<string, unknown>; release: string; approved?: boolean; review_notes?: string[]; checked_notes?: string[]; topic?: string; drafted?: string };
        page = toPage(e.page);
        const checked = new Set(e.checked_notes || []);
        meta = {
          release: e.release,
          approved: !!e.approved,
          notes: (e.review_notes || []).map((text) => ({ text, checked: checked.has(text) })),
          topic: e.topic,
          drafted: e.drafted,
        };
      } else {
        page = toPage(res.entry);
      }
      const o: Open = { source, slug, version: res.version, page, meta, saved: "" };
      o.saved = fingerprint(o);
      setOpen(o);
      setStamp(true);
      formRef.current?.scrollTo({ top: 0 });
    } catch (err) {
      setStatus({ kind: "error", text: (err as Error).message });
    }
    setLoading(false);
  }

  const setPage = (fn: (p: Page) => Page) => setOpen((o) => (o ? { ...o, page: fn(o.page) } : o));
  const setMeta = (fn: (m: Meta) => Meta) => setOpen((o) => (o && o.meta ? { ...o, meta: fn(o.meta) } : o));
  const field = <K extends keyof Page>(k: K) => (v: Page[K]) => setPage((p) => ({ ...p, [k]: v }));

  // ── live preview and checks, a moment after typing stops ──
  const pageJson = open ? JSON.stringify(normalize(open.page)) : "";
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(async () => {
      setChecking(true);
      try {
        const res = await api<{ preview: Preview; problems: Problem[] }>("/api/admin/answers/preview", {
          method: "POST",
          body: JSON.stringify({ branch, page: JSON.parse(pageJson) }),
        });
        setPreview(res.preview);
        setProblems(res.problems);
      } catch {
        // A failed preview is not worth an alert; the next edit retries.
      }
      setChecking(false);
    }, 700);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageJson, branch]);

  // ── saving ──
  const save = useCallback(async () => {
    if (!open || saving) return;
    setSaving(true);
    setStatus(null);
    const page = normalize(open.page);
    try {
      const res = await api<{ version: string; commitUrl: string | null; entry: Record<string, unknown> }>("/api/admin/answers/article", {
        method: "PUT",
        body: JSON.stringify({
          branch,
          source: open.source,
          slug: open.slug,
          version: open.version,
          page,
          stampUpdated: open.source === "live" && stamp,
          meta: open.meta
            ? {
                release: open.meta.release,
                approved: open.meta.approved,
                review_notes: open.meta.notes.map((n) => n.text),
                checked_notes: open.meta.notes.filter((n) => n.checked).map((n) => n.text),
              }
            : undefined,
        }),
      });
      setOpen((o) => {
        if (!o) return o;
        const savedPage = open.source === "live" ? toPage(res.entry) : o.page;
        const next = { ...o, version: res.version, page: savedPage };
        next.saved = fingerprint(next);
        return next;
      });
      const when = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      setStatus({
        kind: "ok",
        text: mode === "local" ? `Saved to this computer's files at ${when}.` : `Saved at ${when}.`,
        url: res.commitUrl,
      });
      void loadList(branch);
    } catch (err) {
      const e = err as Error & { status?: number; problems?: Problem[] };
      if (e.problems) setProblems(e.problems);
      setStatus({ kind: e.status === 409 ? "conflict" : "error", text: e.message });
    }
    setSaving(false);
  }, [open, saving, branch, stamp, mode, loadList]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirtyRef.current) void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  async function signOut() {
    if (!confirmLeave()) return;
    await fetch("/api/admin/answers/session", { method: "DELETE" });
    window.location.reload();
  }

  // ── sidebar groups ──
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (a: Summary) => !q || a.question.toLowerCase().includes(q) || a.slug.includes(q) || a.category.toLowerCase().includes(q);
    const held = articles.filter((a) => a.source === "held" && match(a));
    const months = [...new Set(held.map((a) => a.release || ""))].sort();
    const out = months.map((m) => ({ key: `held-${m}`, title: `Held for ${monthLabel(m)}`, items: held.filter((a) => a.release === m) }));
    const live = articles.filter((a) => a.source === "live" && match(a));
    if (live.length) out.push({ key: "live", title: branch === "main" || branch === "local" ? "Live pages" : "Pages in this release", items: live });
    return out;
  }, [articles, query, branch]);

  const errors = problems.filter((p) => p.level === "error");
  const warnings = problems.filter((p) => p.level === "warning");
  const branchInfo = branches.find((b) => b.name === branch);

  const jumpTo = (path: string) => {
    let p = path;
    while (p) {
      const el = document.querySelector<HTMLElement>(`[data-path="${CSS.escape(p)}"]`);
      if (el) {
        setView("edit");
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add(styles.flash);
        window.setTimeout(() => el.classList.remove(styles.flash), 1600);
        return;
      }
      p = p.includes(".") ? p.slice(0, p.lastIndexOf(".")) : "";
    }
  };

  // ── render ──
  const page = open?.page;
  const meta = open?.meta;
  const notesDone = meta ? meta.notes.filter((n) => n.checked).length : 0;

  return (
    <div className={styles.shell}>
      <header className={styles.top}>
        <button type="button" className={`${styles.ghost} ${styles.drawerBtn}`} onClick={() => setDrawer((d) => !d)}>
          ☰ Articles
        </button>
        <div className={styles.brand}>
          <span className={styles.eyebrow}>The Guide</span>
          <span className={styles.brandTitle}>Answers editor</span>
        </div>
        <div className={styles.topRight}>
          {open && (
            <div className={styles.viewTabs} role="tablist" aria-label="Edit or preview">
              <button type="button" role="tab" aria-selected={view === "edit"} className={view === "edit" ? styles.tabOn : styles.tab} onClick={() => setView("edit")}>
                Edit
              </button>
              <button type="button" role="tab" aria-selected={view === "preview"} className={view === "preview" ? styles.tabOn : styles.tab} onClick={() => setView("preview")}>
                Preview
              </button>
            </div>
          )}
          {branches.length > 1 && (
            <select
              className={styles.select}
              value={branch}
              aria-label="Branch"
              onChange={(e) => {
                if (!confirmLeave()) return;
                setOpen(null);
                setPreview(null);
                void loadList(e.target.value);
              }}
            >
              {branches.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.label}
                </option>
              ))}
            </select>
          )}
          {branchInfo?.url && (
            <a className={styles.ghost} href={branchInfo.url} target="_blank" rel="noreferrer">
              Open PR
            </a>
          )}
          <a className={`${styles.ghost} ${styles.hideNarrow}`} href="/answers" target="_blank" rel="noreferrer">
            Live site
          </a>
          <button type="button" className={`${styles.ghost} ${styles.hideNarrow}`} onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className={styles.body} data-view={view} data-drawer={drawer ? "open" : "closed"}>
        {/* ── sidebar ── */}
        <nav className={styles.side} aria-label="Articles">
          <input className={`${styles.input} ${styles.search}`} placeholder="Search articles" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search articles" />
          {mode === "local" && <p className={styles.localNote}>Development mode: saves write to the files on this computer.</p>}
          {listError && <p className={styles.issueError}>{listError}</p>}
          {!articles.length && !listError && <p className={styles.small}>Loading…</p>}
          {groups.map((g) => (
            <section key={g.key} className={styles.group}>
              <h2 className={styles.groupTitle}>
                {g.title} <span className={styles.count}>{g.items.length}</span>
              </h2>
              <ul className={styles.items}>
                {g.items.map((a) => {
                  const active = open?.slug === a.slug && open?.source === a.source;
                  return (
                    <li key={`${a.source}:${a.slug}`}>
                      <button type="button" className={`${styles.item} ${active ? styles.itemActive : ""}`} onClick={() => openArticle(a.source, a.slug)}>
                        <span className={styles.itemQ}>
                          {active && dirty && <span className={styles.dot} aria-label="Unsaved changes" />}
                          {a.question}
                        </span>
                        <span className={styles.itemMeta}>
                          <span>{a.category}</span>
                          {a.source === "held" ? (
                            <>
                              <span className={a.notes && a.checked === a.notes ? styles.pillOk : styles.pill}>
                                {a.checked}/{a.notes} checked
                              </span>
                              {a.approved && <span className={styles.pillOk}>Approved</span>}
                            </>
                          ) : (
                            <span className={styles.pill}>{a.updated ? `Verified ${a.updated}` : "Live"}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <div className={styles.showNarrow}>
            <a className={styles.ghost} href="/answers" target="_blank" rel="noreferrer">
              Live site
            </a>
            <button type="button" className={styles.ghost} onClick={signOut}>
              Sign out
            </button>
          </div>
        </nav>

        {/* ── form ── */}
        <main className={styles.form} ref={formRef}>

          {!open && !loading && (
            <div className={styles.empty}>
              <h1 className={styles.emptyTitle}>Choose an article to audit</h1>
              <p>
                Held drafts are not on the site yet. They go out in a pull request in their release month, so edits here are safe to make at any pace. Live pages
                are published: saving one updates the site on the next deploy.
              </p>
              <p>Each article lists the claims to check. Tick them off as you verify them, mark the draft approved when you are happy, and save.</p>
            </div>
          )}
          {loading && <p className={styles.pad}>Loading…</p>}

          {open && page && (
            <div className={styles.formInner}>
              <div className={styles.titleRow}>
                <div>
                  <p className={styles.small}>
                    {open.source === "held" ? `Held draft · releases ${meta ? monthLabel(meta.release) : ""}` : "Live page"} · /answers/{open.slug}
                  </p>
                  <h1 className={styles.formTitle}>{page.question || "Untitled"}</h1>
                </div>
                <button type="button" className={styles.ghost} onClick={() => setShowHelp((h) => !h)} aria-expanded={showHelp}>
                  {showHelp ? "Hide" : "How counts and links work"}
                </button>
              </div>

              {showHelp && (
                <div className={styles.help}>
                  <p>Never type a count. Write a token and the page fills in the live number from the atlas. The preview shows what each one becomes.</p>
                  <ul>
                    <li>
                      <code>{"{{hotels:country=Italy&perks=true}}"}</code> hotels matching a filter
                    </li>
                    <li>
                      <code>{"{{journeys:operator=Seabourn}}"}</code> itineraries, and <code>{"{{departures:…}}"}</code> their departure dates
                    </li>
                    <li>
                      <code>{"{{villas:destination=Hawaii}}"}</code> villas; <code>{"{{collection:yacht}}"}</code> a whole collection
                    </li>
                    <li>
                      <code>{"{{hotel:The Little Nell}}"}</code> or <code>{"{{hotel:Exact Feed Name|words to show}}"}</code> a link to a hotel page
                    </li>
                    <li>
                      <code>{"{{page:/hotels/italy|words to show}}"}</code> a link to any page on the site
                    </li>
                    <li>
                      <code>{"{{op:yacht/Four Seasons Yachts|Four Seasons}}"}</code> and <code>{"{{brand:Aman}}"}</code> supplier links
                    </li>
                  </ul>
                  <p>Write an ampersand inside a value as %26. A token that matches nothing is flagged in red and blocks the save.</p>
                </div>
              )}

              {/* checks summary */}
              <div className={`${styles.card} ${errors.length ? styles.cardError : ""}`}>
                <div className={styles.cardHead}>
                  <h2 className={styles.h2}>Checks</h2>
                  <span className={styles.small}>{checking ? "Checking…" : errors.length || warnings.length ? `${errors.length} to fix · ${warnings.length} to consider` : "All clear"}</span>
                </div>
                {problems.length > 0 && (
                  <ul className={styles.problemList}>
                    {[...errors, ...warnings].map((p, i) => (
                      <li key={i}>
                        <button type="button" className={p.level === "error" ? styles.issueError : styles.issueWarn} onClick={() => jumpTo(p.path)}>
                          {p.message}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* review: held drafts */}
              {meta && (
                <div className={styles.card}>
                  <div className={styles.cardHead}>
                    <h2 className={styles.h2}>Review</h2>
                    <span className={styles.small}>
                      {notesDone} of {meta.notes.length} claims checked
                    </span>
                  </div>
                  <div className={styles.progress} aria-hidden="true">
                    <span style={{ width: `${meta.notes.length ? (100 * notesDone) / meta.notes.length : 0}%` }} />
                  </div>
                  <ul className={styles.notes}>
                    {meta.notes.map((n, i) => (
                      <li key={i} className={styles.note}>
                        <input
                          type="checkbox"
                          className={styles.check}
                          checked={n.checked}
                          aria-label={`Claim ${i + 1} checked`}
                          onChange={(e) => setMeta((m) => ({ ...m, notes: m.notes.map((x, j) => (j === i ? { ...x, checked: e.target.checked } : x)) }))}
                        />
                        <AutoText value={n.text} rows={1} onChange={(v) => setMeta((m) => ({ ...m, notes: m.notes.map((x, j) => (j === i ? { ...x, text: v } : x)) }))} />
                        <button
                          type="button"
                          className={`${styles.iconBtn} ${styles.danger}`}
                          title="Remove this note"
                          aria-label="Remove this note"
                          onClick={() => setMeta((m) => ({ ...m, notes: m.notes.filter((_, j) => j !== i) }))}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button type="button" className={styles.addBtn} onClick={() => setMeta((m) => ({ ...m, notes: [...m.notes, { text: "", checked: false }] }))}>
                    + Add a note
                  </button>
                  <div className={styles.inline}>
                    <label className={styles.inlineLabel}>
                      Release in
                      <select className={styles.select} value={meta.release} onChange={(e) => setMeta((m) => ({ ...m, release: e.target.value }))}>
                        {monthOptions(meta.release).map((m) => (
                          <option key={m} value={m}>
                            {monthLabel(m)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.inlineLabel}>
                      <input type="checkbox" className={styles.check} checked={meta.approved} onChange={(e) => setMeta((m) => ({ ...m, approved: e.target.checked }))} />
                      Approved for release
                    </label>
                  </div>
                  <p className={styles.small}>Checked claims and approval are shown on the release pull request. The draft still goes out only when that PR is merged.</p>
                </div>
              )}

              {open.source === "live" && (
                <div className={styles.card}>
                  <h2 className={styles.h2}>Publishing</h2>
                  <p className={styles.small}>
                    {branch === "main" ? "This page is live. Saving updates the site on the next deploy, a few minutes after you save." : "This page is in a release pull request. It goes live when the PR is merged."}
                  </p>
                  <label className={styles.inlineLabel}>
                    <input type="checkbox" className={styles.check} checked={stamp} onChange={(e) => setStamp(e.target.checked)} />
                    Set &ldquo;Last verified&rdquo; to today when I save (currently {page.updated || "not set"})
                  </label>
                </div>
              )}

              {/* basics */}
              <div className={styles.card}>
                <h2 className={styles.h2}>The question</h2>
                <div className={styles.field} data-path="question">
                  <label className={styles.label}>Question (the page heading)</label>
                  <AutoText value={page.question} rows={1} onChange={field("question")} />
                  <Issues problems={problems} path="question" />
                </div>
                <div className={styles.field} data-path="category">
                  <label className={styles.label}>Category</label>
                  <select className={styles.select} value={page.category} onChange={(e) => field("category")(e.target.value)}>
                    {(categories.includes(page.category) ? categories : [page.category, ...categories]).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <Issues problems={problems} path="category" />
                </div>
                <div className={styles.field} data-path="title">
                  <label className={styles.label}>
                    Search title <span className={styles.hint}>{page.title.length} characters · about 60 show in search</span>
                  </label>
                  <AutoText value={page.title} rows={1} onChange={field("title")} />
                  <Issues problems={problems} path="title" />
                </div>
                <div className={styles.field} data-path="description">
                  <label className={styles.label}>
                    Search description <span className={styles.hint}>{page.description.length} characters · about 160 show in search</span>
                  </label>
                  <AutoText value={page.description} rows={2} onChange={field("description")} />
                  <Issues problems={problems} path="description" />
                </div>
              </div>

              <div className={styles.card}>
                <h2 className={styles.h2}>The short answer</h2>
                <div className={styles.field} data-path="capsule">
                  <label className={styles.label}>
                    Capsule{" "}
                    <span className={styles.hint}>
                      {wordCount(page.capsule)} words · aim for 40 to 70 · must make sense on its own, with no links
                    </span>
                  </label>
                  <AutoText value={page.capsule} rows={4} onChange={field("capsule")} />
                  <Issues problems={problems} path="capsule" exact />
                </div>
                <div className={styles.field} data-path="answer">
                  <label className={styles.label}>Answer paragraphs</label>
                  <TextList items={page.answer} onChange={field("answer")} what="Paragraph" path="answer" problems={problems} rows={5} />
                  <Issues problems={problems} path="answer" exact />
                </div>
              </div>

              {/* sections */}
              {page.sections.map((s, i) => {
                const setSection = (fn: (x: Section) => Section) => setPage((p) => ({ ...p, sections: p.sections.map((x, j) => (j === i ? fn(x) : x)) }));
                return (
                  <div key={i} className={styles.card} data-path={`sections.${i}`}>
                    <div className={styles.cardHead}>
                      <h2 className={styles.h2}>Section {i + 1}</h2>
                      <RowTools
                        index={i}
                        count={page.sections.length}
                        what="section"
                        move={(a, b) => setPage((p) => ({ ...p, sections: moved(p.sections, a, b) }))}
                        remove={(k) => setPage((p) => ({ ...p, sections: p.sections.filter((_, j) => j !== k) }))}
                      />
                    </div>
                    <div className={styles.field} data-path={`sections.${i}.h2`}>
                      <label className={styles.label}>Heading</label>
                      <AutoText value={s.h2} rows={1} onChange={(v) => setSection((x) => ({ ...x, h2: v }))} />
                      <Issues problems={problems} path={`sections.${i}.h2`} />
                    </div>
                    {s.table ? (
                      <div className={styles.field}>
                        <div className={styles.listHead}>
                          <span className={styles.label}>Table</span>
                          <button
                            type="button"
                            className={`${styles.miniBtn} ${styles.danger}`}
                            onClick={() => {
                              if (window.confirm("Remove this table?")) setSection((x) => ({ ...x, table: undefined }));
                            }}
                          >
                            Remove table
                          </button>
                        </div>
                        <TableEditor table={s.table} onChange={(t) => setSection((x) => ({ ...x, table: t }))} path={`sections.${i}`} problems={problems} />
                      </div>
                    ) : (
                      <button type="button" className={styles.addBtn} onClick={() => setSection((x) => ({ ...x, table: { columns: ["", ""], rows: [["", ""]] } }))}>
                        + Add a table
                      </button>
                    )}
                    <div className={styles.field} data-path={`sections.${i}.paras`}>
                      <label className={styles.label}>Paragraphs</label>
                      <TextList items={s.paras || []} onChange={(v) => setSection((x) => ({ ...x, paras: v }))} what="Paragraph" path={`sections.${i}.paras`} problems={problems} rows={4} />
                    </div>
                    <div className={styles.field} data-path={`sections.${i}.list`}>
                      <label className={styles.label}>Bullet points</label>
                      <TextList items={s.list || []} onChange={(v) => setSection((x) => ({ ...x, list: v }))} what="Bullet" path={`sections.${i}.list`} problems={problems} rows={2} />
                    </div>
                    <Issues problems={problems} path={`sections.${i}`} exact />
                  </div>
                );
              })}
              <button type="button" className={styles.addBtn} onClick={() => setPage((p) => ({ ...p, sections: [...p.sections, { h2: "", paras: [""] }] }))}>
                + Add a section
              </button>

              {/* evidence */}
              <div className={styles.card} data-path="evidence">
                <div className={styles.cardHead}>
                  <h2 className={styles.h2}>Hotel table</h2>
                  <label className={styles.inlineLabel}>
                    <input
                      type="checkbox"
                      className={styles.check}
                      checked={!!page.evidence}
                      onChange={(e) =>
                        setPage((p) => ({
                          ...p,
                          evidence: e.target.checked ? { h2: "", note: "", query: "country=", sort: "perks", limit: 12 } : null,
                        }))
                      }
                    />
                    Show a table of matching hotels
                  </label>
                </div>
                {page.evidence && (
                  <>
                    <div className={styles.field} data-path="evidence.h2">
                      <label className={styles.label}>Heading</label>
                      <AutoText value={page.evidence.h2} rows={1} onChange={(v) => setPage((p) => ({ ...p, evidence: { ...(p.evidence as Evidence), h2: v } }))} />
                      <Issues problems={problems} path="evidence.h2" />
                    </div>
                    <div className={styles.field} data-path="evidence.note">
                      <label className={styles.label}>Note under the heading (say what the table leaves out)</label>
                      <AutoText value={page.evidence.note} rows={2} onChange={(v) => setPage((p) => ({ ...p, evidence: { ...(p.evidence as Evidence), note: v } }))} />
                      <Issues problems={problems} path="evidence.note" />
                    </div>
                    <div className={styles.field} data-path="evidence.query">
                      <label className={styles.label}>
                        Hotel filter <span className={styles.hint}>e.g. country=Peru&amp;perks=true</span>
                      </label>
                      <AutoText mono value={page.evidence.query} rows={1} onChange={(v) => setPage((p) => ({ ...p, evidence: { ...(p.evidence as Evidence), query: v } }))} />
                      <Issues problems={problems} path="evidence.query" />
                      {preview?.evidence && (
                        <p className={styles.small}>
                          Matches {preview.evidence.total.toLocaleString("en-US")} {preview.evidence.total === 1 ? "hotel" : "hotels"}
                          {preview.evidence.total > preview.evidence.shown ? `, showing ${preview.evidence.shown}` : ""}.
                        </p>
                      )}
                    </div>
                    <div className={styles.inline}>
                      <label className={styles.inlineLabel}>
                        Order
                        <select className={styles.select} value={page.evidence.sort} onChange={(e) => setPage((p) => ({ ...p, evidence: { ...(p.evidence as Evidence), sort: e.target.value } }))}>
                          <option value="perks">Most benefits first</option>
                          <option value="name">By name</option>
                          <option value="rooms">Largest first</option>
                          <option value="smallest">Smallest first</option>
                        </select>
                      </label>
                      <label className={styles.inlineLabel}>
                        Show up to
                        <input
                          type="number"
                          min={1}
                          max={30}
                          className={`${styles.input} ${styles.num}`}
                          value={page.evidence.limit}
                          onChange={(e) => setPage((p) => ({ ...p, evidence: { ...(p.evidence as Evidence), limit: Number(e.target.value) || 1 } }))}
                        />
                      </label>
                    </div>
                  </>
                )}
              </div>

              {/* faqs */}
              <div className={styles.card} data-path="faqs">
                <h2 className={styles.h2}>Frequently asked</h2>
                <div className={styles.stack}>
                  {page.faqs.map((f, i) => (
                    <div key={i} className={styles.listItem} data-path={`faqs.${i}`}>
                      <div className={styles.listHead}>
                        <span className={styles.small}>Question {i + 1}</span>
                        <RowTools
                          index={i}
                          count={page.faqs.length}
                          what="question"
                          move={(a, b) => setPage((p) => ({ ...p, faqs: moved(p.faqs, a, b) }))}
                          remove={(k) => setPage((p) => ({ ...p, faqs: p.faqs.filter((_, j) => j !== k) }))}
                        />
                      </div>
                      <AutoText value={f.q} rows={1} placeholder="Question" onChange={(v) => setPage((p) => ({ ...p, faqs: p.faqs.map((x, j) => (j === i ? { ...x, q: v } : x)) }))} />
                      <AutoText value={f.a} rows={3} placeholder="Answer" onChange={(v) => setPage((p) => ({ ...p, faqs: p.faqs.map((x, j) => (j === i ? { ...x, a: v } : x)) }))} />
                      <Issues problems={problems} path={`faqs.${i}`} />
                    </div>
                  ))}
                  <button type="button" className={styles.addBtn} onClick={() => setPage((p) => ({ ...p, faqs: [...p.faqs, { q: "", a: "" }] }))}>
                    + Add a question
                  </button>
                </div>
              </div>

              {/* related */}
              <div className={styles.card} data-path="related">
                <h2 className={styles.h2}>Go deeper links</h2>
                <div className={styles.stack}>
                  {page.related.map((r, i) => (
                    <div key={i} className={styles.listItem} data-path={`related.${i}`}>
                      <div className={styles.listHead}>
                        <span className={styles.small}>Link {i + 1}</span>
                        <RowTools
                          index={i}
                          count={page.related.length}
                          what="link"
                          move={(a, b) => setPage((p) => ({ ...p, related: moved(p.related, a, b) }))}
                          remove={(k) => setPage((p) => ({ ...p, related: p.related.filter((_, j) => j !== k) }))}
                        />
                      </div>
                      <AutoText value={r.label} rows={1} placeholder="Words to show" onChange={(v) => setPage((p) => ({ ...p, related: p.related.map((x, j) => (j === i ? { ...x, label: v } : x)) }))} />
                      <AutoText mono value={r.href} rows={1} placeholder="/answers/…" onChange={(v) => setPage((p) => ({ ...p, related: p.related.map((x, j) => (j === i ? { ...x, href: v } : x)) }))} />
                      <Issues problems={problems} path={`related.${i}`} />
                    </div>
                  ))}
                  <button type="button" className={styles.addBtn} onClick={() => setPage((p) => ({ ...p, related: [...p.related, { href: "", label: "" }] }))}>
                    + Add a link
                  </button>
                </div>
              </div>
              <div className={styles.spacer} />
            </div>
          )}

          {open && (
            <div className={styles.saveBar}>
              <div className={styles.saveStatus} role="status">
                {status ? (
                  <span className={status.kind === "ok" ? styles.okText : styles.errText}>
                    {status.text}{" "}
                    {status.url && (
                      <a href={status.url} target="_blank" rel="noreferrer">
                        View change
                      </a>
                    )}
                    {status.kind === "conflict" && (
                      <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={() => {
                          if (window.confirm("Reload this article? Your unsaved edits will be lost, so copy anything you need first.")) void openArticle(open.source, open.slug, true);
                        }}
                      >
                        Reload article
                      </button>
                    )}
                  </span>
                ) : dirty ? (
                  <span>Unsaved changes{errors.length ? ` · ${errors.length} to fix before saving` : ""}</span>
                ) : (
                  <span className={styles.small}>No changes</span>
                )}
              </div>
              <div className={styles.saveBtns}>
                <button
                  type="button"
                  className={styles.ghost}
                  disabled={!dirty || saving}
                  onClick={() => {
                    if (window.confirm("Discard your unsaved changes to this article?")) void openArticle(open.source, open.slug, true);
                  }}
                >
                  Discard
                </button>
                <button type="button" className={styles.primary} disabled={!dirty || saving || errors.length > 0} onClick={() => void save()} title="Save (Ctrl or Cmd + S)">
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          )}
        </main>

        {/* ── preview ── */}
        <aside className={styles.preview} aria-label="Preview">
          {preview ? (
            <PagePreview p={preview} />
          ) : (
            <p className={styles.pad}>{open ? "Preparing the preview…" : "The page preview appears here."}</p>
          )}
        </aside>
      </div>
    </div>
  );
}
