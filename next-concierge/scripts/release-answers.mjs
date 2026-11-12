#!/usr/bin/env node
/**
 * Release answer pages that were drafted ahead of time.
 *
 *   node scripts/release-answers.mjs             # release every draft due this month
 *   node scripts/release-answers.mjs --count 8   # release the next 8, whatever their month
 *   node scripts/release-answers.mjs --check     # verify every held draft, release nothing
 *
 * data/answers/scheduled.json is a holding pen: finished drafts, each with the
 * month it is meant to go out (`release`, YYYY-MM) and the claims a reviewer
 * should check (`review_notes`, never published). Nothing in the pen is on the
 * site. This script moves the due drafts into data/answers/generated.js, where
 * the monthly workflow opens them as a pull request exactly as it does for
 * pages drafted on the day, so the same rule holds: nothing publishes until a
 * person merges that PR.
 *
 * To change the cadence, edit the `release` months in scheduled.json. The order
 * of the file is the order pages go out within a month.
 *
 * A draft sat in the pen while the feed moved under it, so each one goes back
 * through verify:seo on its way out. One that no longer passes (an operator the
 * feed dropped, a page that was retired) stays in the pen and is named in the
 * PR body with the verifier's words; it never blocks the others.
 *
 * No API calls and no cost. scripts/draft-answers.mjs takes over again once the
 * pen is empty.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { repoRoot } from '../lib/virtuoso/env.mjs';

const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
const opt = name => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
};
const CHECK = flag('check');
const COUNT = opt('count') ? Math.max(1, Number(opt('count')) || 1) : null;

const SCHEDULED = path.join(repoRoot, 'data/answers/scheduled.json');
const BACKLOG = path.join(repoRoot, 'data/answers/backlog.json');
const GENERATED = path.join(repoRoot, 'data/answers/generated.js');
const PR_BODY = path.join(repoRoot, 'answers-pr-body.md');
const today = new Date().toISOString().slice(0, 10);
const thisMonth = today.slice(0, 7);

const pen = JSON.parse(fs.readFileSync(SCHEDULED, 'utf8'));
const { generatedAnswers } = await import(pathToFileURL(GENERATED).href);
const generatedSrc = fs.readFileSync(GENERATED, 'utf8');
const header = generatedSrc.split('export const generatedAnswers')[0];

function writeGenerated(list) {
  fs.writeFileSync(
    GENERATED,
    `${header}export const generatedAnswers = ${JSON.stringify(list, null, 2)};\n`,
  );
}

/** verify-seo's failures for these slugs, keyed by slug. Empty when all pass. */
function verify(slugs) {
  const run = spawnSync(process.execPath, ['scripts/verify-seo.mjs'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const out = new Map();
  if (run.status === 0) return out;
  for (const line of (run.stderr || '').split('\n')) {
    if (!line.includes('✗')) continue;
    const slug = slugs.find(s => line.includes(`${s}:`));
    if (!slug) continue; // someone else's failure is not this draft's problem
    out.set(slug, [...(out.get(slug) || []), line.replace(/^\s*✗\s*/, '')]);
  }
  return out;
}

// ── --check: every held draft, nothing released ─────────────────────────────
if (CHECK) {
  const pages = pen.drafts.map(d => d.page);
  const slugs = pages.map(p => p.slug);
  const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i || generatedAnswers.some(a => a.slug === s));
  writeGenerated([...generatedAnswers, ...pages]);
  const problems = verify(slugs);
  fs.writeFileSync(GENERATED, generatedSrc);
  for (const s of dupes) console.log(`✗ ${s}: slug is already in use`);
  for (const [slug, lines] of problems) for (const l of lines) console.log(`✗ ${l}`);
  const months = {};
  for (const d of pen.drafts) months[d.release] = (months[d.release] || 0) + 1;
  console.log(
    `${pen.drafts.length} held drafts (${Object.entries(months).map(([m, n]) => `${m}: ${n}`).join(', ') || 'none'}); ` +
      `${problems.size + dupes.length} failing.`,
  );
  process.exit(problems.size || dupes.length ? 1 : 0);
}

// ── release ─────────────────────────────────────────────────────────────────
const due = COUNT
  ? pen.drafts.slice(0, COUNT)
  : pen.drafts.filter(d => d.release <= thisMonth);

if (!due.length) {
  console.log(
    pen.drafts.length
      ? `Nothing is due in ${thisMonth}; ${pen.drafts.length} drafts are held for later months.`
      : 'The holding pen is empty.',
  );
  fs.writeFileSync(PR_BODY, '');
  process.exit(0);
}

const backlog = JSON.parse(fs.readFileSync(BACKLOG, 'utf8'));
const released = [];
const held = [];
let list = [...generatedAnswers];

for (const draft of due) {
  const page = { ...draft.page, updated: today };
  if (list.some(a => a.slug === page.slug)) {
    held.push({ draft, why: ['slug is already in use'] });
    continue;
  }
  writeGenerated([...list, page]);
  const problems = verify([page.slug]).get(page.slug);
  if (problems) {
    held.push({ draft, why: problems });
    console.log(`✗ ${page.slug}: ${problems.join('; ')}`);
    continue;
  }
  list = [...list, page];
  released.push(draft);
  const topic = backlog.topics.find(t => t.id === draft.topic);
  if (topic) {
    delete topic.release;
    Object.assign(topic, { status: 'drafted', drafted: draft.drafted, released: today, slug: page.slug });
  }
  console.log(`✓ /answers/${page.slug}`);
}
writeGenerated(list);

const gone = new Set(released);
pen.drafts = pen.drafts.filter(d => !gone.has(d));
fs.writeFileSync(SCHEDULED, `${JSON.stringify(pen, null, 2)}\n`);
fs.writeFileSync(BACKLOG, `${JSON.stringify(backlog, null, 2)}\n`);

const left = pen.drafts.length;
const body = [
  `Answer pages released from the holding pen (\`data/answers/scheduled.json\`) by \`scripts/release-answers.mjs\`. All of them passed \`verify:seo\` today: every count is a live query against the feed, and every link resolves.`,
  '',
  '**Nothing publishes until this PR is merged.** These were written ahead of time, so read each page for anything that has changed since its draft date (ships entering service, routes, programme rules) as well as the notes below. Edit `next-concierge/data/answers/generated.js` directly on this branch if anything needs changing.',
  '',
  ...released.flatMap(({ page, drafted, review_notes: notes = [] }) => [
    `### ${page.question}`,
    `\`/answers/${page.slug}\` · ${page.category} · drafted ${drafted}`,
    '',
    `> ${page.capsule}`,
    '',
    notes.length ? 'Check before merging:' : 'No specific claims flagged.',
    ...notes.map(n => `- [ ] ${n}`),
    '',
  ]),
  ...(held.length
    ? [
        '### Held back: no longer passes the verifier',
        ...held.map(h => `- \`${h.draft.page.slug}\`: ${h.why.join('; ')}`),
        '',
        'These stay in `scheduled.json`. Fix the draft there and it goes out with the next release.',
        '',
      ]
    : []),
  left
    ? `${left} draft${left === 1 ? '' : 's'} still held for later months.`
    : 'The holding pen is now empty. From next month `scripts/draft-answers.mjs` drafts from the backlog again, so **add topics to `data/answers/backlog.json`.**',
].join('\n');
fs.writeFileSync(PR_BODY, released.length || held.length ? body : '');

console.log(`\n${released.length} released, ${held.length} held back, ${left} still in the pen.`);
