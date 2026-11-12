#!/usr/bin/env node
/**
 * Write the held answer drafts as one readable Markdown file for review:
 *   node scripts/review-scheduled.mjs [out.md]
 * Counts and links are resolved from the live feed, so it reads as the page will.
 * review_notes (the claims to check) come first under each page.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repoRoot } from '../lib/virtuoso/env.mjs';
import { makeFacts } from '../lib/seo/facts.mjs';

const require = createRequire(import.meta.url);
const read = rel => JSON.parse(fs.readFileSync(path.join(repoRoot, rel), 'utf8'));
const { applyHotelOverlays } = require('../lib/atlas/hotel-overlays.js');
const { isNotAPlace } = require('../lib/atlas/country-overrides.js');
const hotels = applyHotelOverlays(read('data/atlas/hotel/luxury-hotels.json')).filter(h => !isNotAPlace(h.country));
const collections = {
  hotel: hotels.length,
  villa: require('../lib/villas.js').loadVillas().villas.length,
  cruise: read('data/atlas/cruise/sailings.json').rows.length,
  worldcruise: read('data/atlas/world/itinerary.json').TRIPS.length,
  train: read('data/atlas/train/itinerary.json').TRIPS.length,
  yacht: read('data/atlas/yacht/itinerary.json').TRIPS.length,
  jet: read('data/atlas/jet/itinerary.json').TRIPS.length,
  safari: read('data/atlas/safari/itinerary.json').TRIPS.length,
};
const facts = makeFacts(hotels, collections, read('data/atlas/shared/journey-facts.json').rows, require('../lib/villas.js').loadVillas().villas);
const R = s => facts.resolve(String(s ?? ''));
const cell = s => R(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

const pen = read('data/answers/scheduled.json');
const out = [`# Held answer pages: review copy\n`, `${pen.drafts.length} drafts. Counts are live from the feed. Not published.\n`];
const months = [...new Set(pen.drafts.map(d => d.release))];
out.push('## Contents\n');
for (const m of months) {
  out.push(`**${m}**\n`);
  for (const d of pen.drafts.filter(x => x.release === m)) out.push(`- [${d.page.question}](#${d.page.slug})`);
  out.push('');
}
for (const d of pen.drafts) {
  const p = d.page;
  out.push('\n---\n', `<a id="${p.slug}"></a>`, `## ${p.question}`, `\`/answers/${p.slug}\` · ${p.category} · releases ${d.release}\n`);
  out.push(`**Title:** ${R(p.title)}\n`, `**Meta description:** ${R(p.description)}\n`);
  out.push('### Check before publishing\n', ...d.review_notes.map(n => `- [ ] ${n}`), '');
  out.push('### Capsule\n', `> ${R(p.capsule)}\n`, '### Answer\n', ...p.answer.map(a => `${R(a)}\n`));
  for (const s of p.sections) {
    out.push(`### ${s.h2}\n`);
    if (s.table) {
      if (s.table.caption) out.push(`*${R(s.table.caption)}*\n`);
      out.push(`| ${s.table.columns.map(cell).join(' | ')} |`, `|${s.table.columns.map(() => '---').join('|')}|`);
      for (const r of s.table.rows) out.push(`| ${r.map(cell).join(' | ')} |`);
      out.push('');
    }
    for (const x of s.paras || []) out.push(`${R(x)}\n`);
    for (const x of s.list || []) out.push(`- ${R(x)}`);
    if (s.list) out.push('');
  }
  if (p.evidence) {
    const rows = facts.select(p.evidence.query, { sort: p.evidence.sort || 'name', limit: p.evidence.limit || 12 });
    out.push(`### Evidence table: ${p.evidence.h2}\n`, `*${R(p.evidence.note)}*\n`, `Query \`${p.evidence.query}\`, shows: ${rows.map(h => h.name).join('; ')}\n`);
  }
  out.push('### FAQs\n');
  for (const f of p.faqs) out.push(`**${R(f.q)}**\n\n${R(f.a)}\n`);
  out.push('### Related\n', ...p.related.map(r => `- ${r.label} → \`${r.href}\``), '');
}
const dest = path.resolve(process.argv[2] || path.join(repoRoot, '../review/held-answers.md'));
fs.writeFileSync(dest, out.join('\n'));
console.log(`${dest} (${(fs.statSync(dest).size / 1024).toFixed(0)} KB)`);
