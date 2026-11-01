#!/usr/bin/env node
/**
 * Draft "The Guide's take" travel notes for hotel and journey pages.
 *
 *   node scripts/draft-guide-takes.mjs --paths scripts/guide-takes-pilot.txt
 *   node scripts/draft-guide-takes.mjs --paths list.txt --limit 20
 *   node scripts/draft-guide-takes.mjs --paths list.txt --dry-run   # fetch + print facts, spend nothing
 *   node scripts/draft-guide-takes.mjs --paths list.txt --force     # rewrite notes that already exist
 *
 * Runs from .github/workflows/guide-takes.yml, which opens the result as a pull
 * request. Nothing written here is published until that PR is merged.
 *
 * WHERE THE FACTS COME FROM. Each note is written from the page it will sit on,
 * as that page is published on the live site — the supplier description, the
 * benefits on file, the itinerary, the offers. Not from the raw feeds: the page
 * is what a reader can check the note against, so it is the only fair source.
 * The "Related" / "Nearby" / "Book it" sections are cut first (they describe
 * OTHER properties), and so is any existing note, so a note is never written
 * from a previous note.
 *
 * TWO PASSES. A writer pass drafts the note and lists every claim in it beside
 * the page words that support it. A checker pass, with no stake in the draft,
 * reads the page and the note and fails anything the page does not say. A
 * failed note gets one rewrite with the checker's own words; if it fails again
 * it is dropped and listed in the PR body, never published.
 *
 * Why the checker exists: in the first hand-written sample, an otherwise good
 * note called two ships "named for the men who got there first". One of them
 * never went to Antarctica. True-sounding general knowledge is the failure mode
 * here, and across thousands of pages it would be published in the agency's
 * name.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const STORE = path.join(root, 'data/notes/guide-takes.json');
const PR_BODY = path.join(root, 'guide-takes-pr-body.md');

const MODEL = 'claude-opus-5-5';
const CONCURRENCY = 4;

// ── arguments ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const BASE = value('base', 'https://guide.expeditionbucketlist.com').replace(/\/$/, '');
const pathsFile = value('paths', null);
const limit = Number(value('limit', '0')) || Infinity;
const dryRun = flag('dry-run');
const force = flag('force');

if (!pathsFile) {
  console.error('Usage: node scripts/draft-guide-takes.mjs --paths <file> [--limit N] [--dry-run] [--force]');
  process.exit(1);
}

const store = JSON.parse(fs.readFileSync(STORE, 'utf8'));
const wanted = fs
  .readFileSync(path.resolve(root, pathsFile), 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))
  .filter((p) => /^\/(hotels\/[^/]+\/[^/]+|journeys\/[^/]+\/[^/]+)$/.test(p))
  .filter((p) => force || !store[p])
  .slice(0, limit);

console.log(`${wanted.length} page(s) to write${dryRun ? ' (dry run)' : ''}.`);

// ── reading a page back as facts ────────────────────────────────────────────
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', middot: '·', rarr: '→' };
const decode = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);

/** Section headings whose content is about other listings or is navigation. */
const DROP_HEADINGS = /^(Related in the atlas|Nearby in the atlas|Book it, or ask about it|More in )/i;

function pageFacts(html) {
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
  if (!article) return null;
  let body = article
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ');
  // Split on section boundaries and keep only the sections about this page.
  body = body
    .split(/(?=<section\b)/i)
    .filter((chunk) => {
      if (/data-guide-take/i.test(chunk.slice(0, 200))) return false;
      const h2 = chunk.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1];
      return !(h2 && DROP_HEADINGS.test(decode(h2.replace(/<[^>]+>/g, '')).trim()));
    })
    .join(' ');
  const text = decode(
    body
      .replace(/<(h1|h2|h3|p|li|tr|div|section)\b[^>]*>/gi, '\n')
      .replace(/<(td|th)\b[^>]*>/gi, ' | ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
  return text.length > 200 ? text : null;
}

async function fetchFacts(p) {
  const res = await fetch(`${BASE}${p}`, { headers: { 'user-agent': 'guide-takes-drafter' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const facts = pageFacts(await res.text());
  if (!facts) throw new Error('could not read the page body');
  return facts;
}

// ── prompts ─────────────────────────────────────────────────────────────────
const WRITER = `You write "The Guide's take": a short travel note that sits on one hotel or journey page of The Guide, the travel site of Aspen Travel Advisors, directly under the supplier's own description.

Voice: in the spirit of a classic mail-order travel catalogue. Evocative, a little wry, confident and sensory. Short sentences, the occasional fragment. Plain description or second person ("you"). Never first person: no "I", no "we stayed", no memories or anecdotes. Nobody at the agency is claiming to have been there.

Hard rules:
- Use only facts stated in the PAGE FACTS. Add nothing from general knowledge, however true it is: no history, no people, no geography, no climate or seasons, no comparisons with other places, unless the page states it.
- No numbers, prices, dates or offer terms unless they appear in the page facts exactly as written.
- Include one practical tip a traveller can act on, drawn from the facts: a room or cabin to ask for, a benefit worth using, a day to plan around, when to arrive.
- If the page lists booking benefits, you may mention one or two, framed as booked through Aspen.
- 60 to 95 words, one paragraph. No headings, lists, emoji or exclamation marks.
- Do not reuse the page's opening sentence, and do not copy any run of more than five words from the page.
- The agency is Aspen Travel Advisors. Never name any other brand as who the traveller books with.

Return JSON with "note" (the text) and "claims": every factual statement in the note, each with "support", the words in the page facts that back it.`;

const CHECKER = `You check a short travel note against the page it was written from. You did not write it and have no reason to defend it.

The note passes only if every factual statement in it is directly supported by the PAGE FACTS. Fail it for:
- any fact the page does not state, including general knowledge that may well be true;
- any number, price, date or offer term that is not exactly in the page;
- first-person experience ("I", "we stayed", "when we were there");
- a fact that belongs to something else mentioned on the page;
- overstatement that changes the meaning (the page says "many rooms", the note says "every room");
- naming any brand other than Aspen Travel Advisors as who the traveller books with.

Evocative phrasing, mood and opinion that make no factual claim are fine. Do not fail a note for style.

Return JSON: "verdict" ("pass" or "fail") and "problems" (empty when it passes; otherwise each problem stated plainly, quoting the note).`;

const NOTE_SCHEMA = {
  type: 'object',
  properties: {
    note: { type: 'string' },
    claims: {
      type: 'array',
      items: {
        type: 'object',
        properties: { claim: { type: 'string' }, support: { type: 'string' } },
        required: ['claim', 'support'],
        additionalProperties: false,
      },
    },
  },
  required: ['note', 'claims'],
  additionalProperties: false,
};

const CHECK_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['pass', 'fail'] },
    problems: { type: 'array', items: { type: 'string' } },
  },
  required: ['verdict', 'problems'],
  additionalProperties: false,
};

// ── the model calls ─────────────────────────────────────────────────────────
const client = dryRun ? null : new Anthropic();
const usage = { input: 0, cached: 0, output: 0 };

async function ask(system, schema, content) {
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
    // The same instructions on every call, so all but the first read from cache.
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content }],
  });
  const message = await stream.finalMessage();
  const u = message.usage;
  usage.input += u.input_tokens || 0;
  usage.cached += u.cache_read_input_tokens || 0;
  usage.output += u.output_tokens || 0;
  if (message.stop_reason === 'refusal') throw new Error('the model declined');
  if (message.stop_reason === 'max_tokens') throw new Error('cut off at max_tokens');
  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text);
}

const wordCount = (s) => s.trim().split(/\s+/).length;

async function draft(p, facts) {
  const factsBlock = `PAGE: ${BASE}${p}\n\nPAGE FACTS:\n${facts}`;
  let feedback = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    const written = await ask(
      WRITER,
      NOTE_SCHEMA,
      feedback
        ? `${factsBlock}\n\nA checker rejected your previous note for these reasons. Write a new note that fixes every one:\n${feedback}`
        : factsBlock,
    );
    const note = String(written.note || '').trim();
    const words = wordCount(note);
    if (words < 45 || words > 120) {
      feedback = `- The note was ${words} words; it must be 60 to 95.`;
      continue;
    }
    const check = await ask(CHECKER, CHECK_SCHEMA, `${factsBlock}\n\nNOTE TO CHECK:\n${note}`);
    if (check.verdict === 'pass') return { note, attempt };
    feedback = check.problems.map((x) => `- ${x}`).join('\n') || '- (no reason given)';
  }
  return { rejected: feedback };
}

// ── run ─────────────────────────────────────────────────────────────────────
const written = [];
const rejected = [];
const failed = [];
const today = new Date().toISOString().slice(0, 10);

async function work(p) {
  try {
    const facts = await fetchFacts(p);
    if (dryRun) {
      console.log(`\n=== ${p}\n${facts.slice(0, 1500)}${facts.length > 1500 ? '\n…' : ''}`);
      return;
    }
    const result = await draft(p, facts);
    if (result.note) {
      store[p] = { note: result.note, written: today };
      written.push({ path: p, note: result.note, attempt: result.attempt });
      console.log(`✓ ${p}${result.attempt > 1 ? ' (on rewrite)' : ''}`);
    } else {
      rejected.push({ path: p, reasons: result.rejected });
      console.log(`✗ ${p} — failed the check twice`);
    }
  } catch (e) {
    failed.push({ path: p, error: e.message });
    console.log(`! ${p} — ${e.message}`);
  }
}

const queue = [...wanted];
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length) await work(queue.shift());
  }),
);

if (dryRun) process.exit(0);

// Sorted keys, so each run's diff shows only the notes it added.
const sorted = Object.fromEntries(Object.entries(store).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(STORE, `${JSON.stringify(sorted, null, 2)}\n`);

const lines = [
  `"The Guide's take" notes drafted by \`scripts/draft-guide-takes.mjs\` (${MODEL}).`,
  '',
  `Each note was written only from its page's published text and passed a separate fact-check against that text. **${written.length} written**, ${rejected.length} rejected by the checker, ${failed.length} could not be fetched.`,
  '',
  `Tokens: ${usage.input.toLocaleString()} input (+${usage.cached.toLocaleString()} from cache), ${usage.output.toLocaleString()} output.`,
  '',
  'Skim a few against their pages before merging. Anything that reads wrong can be edited or deleted in `data/notes/guide-takes.json`.',
  '',
  '## Notes',
  '',
  ...written.flatMap((w) => [`**[${w.path}](${BASE}${w.path})**${w.attempt > 1 ? ' _(passed on rewrite)_' : ''}`, '', `> ${w.note}`, '']),
];
if (rejected.length) {
  lines.push('## Rejected by the checker (not included)', '');
  for (const r of rejected) lines.push(`- \`${r.path}\`\n${r.reasons.split('\n').map((l) => `  ${l}`).join('\n')}`);
  lines.push('');
}
if (failed.length) {
  lines.push('## Could not be read', '');
  for (const f of failed) lines.push(`- \`${f.path}\` — ${f.error}`);
}
fs.writeFileSync(PR_BODY, `${lines.join('\n')}\n`);
console.log(`\nWrote ${written.length}, rejected ${rejected.length}, failed ${failed.length}. PR body: ${path.relative(root, PR_BODY)}`);
