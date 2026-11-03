// Card building, rarity and ordering from ResearchPhantom data, without network access.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RARITY, WORLDS, buildCard, cardsFrom, extractHighlights, loadDay, loadManifest, rarityOf, worldOf } from '../js/data.js';

assert.equal(worldOf(['quant-ph', 'cs.AI']), 'quantum', 'primary category decides the world');
assert.equal(worldOf(['math.CO', 'cs.CL']), 'nlp', 'cross-listed category is the fallback');
assert.equal(worldOf(['math.CO']), 'other');
assert.equal(worldOf(['astro-ph.GA']), 'physics');

const hl = extractHighlights("We study a worker's checks. It is a long setup. Speed improves by 24% over the baseline. Done.");
assert.equal(hl.lead, "We study a worker's checks. It is a long setup.");
assert.equal(hl.result, 'Speed improves by 24% over the baseline.');
assert.deepEqual(extractHighlights('We use cues (e.g. 3 million pings). It works on Fig. 2 data. Recall rises 12%.'), { lead: 'We use cues (e.g. 3 million pings). It works on Fig. 2 data.', result: 'Recall rises 12%.' }, 'abbreviations do not end a sentence');
const long = extractHighlights('A ' + 'very '.repeat(60) + 'long opening. Accuracy improves by 31% here. Done.');
assert.ok(long.lead.endsWith('…') && long.lead.length === 260, 'long openings are clipped');
assert.equal(long.result, 'Accuracy improves by 31% here.', 'a result inside a clipped opening is still highlighted');

const paper = { id: '2611.00001', title: 'Original title', summary: 'First. Second. Error drops by 40% on X.', categories: ['cs.AI'], link: 'https://arxiv.org/abs/2611.00001', announce_type: 'new' };
const full = { title_ja: '日本語題', summary_ja: '要約', problem: '課題', method: ['a', 'b'], result: '結果', impact: '意義', metric: { value: '40%', label: '誤差減' } };
const card = buildCard(paper, full);
assert.equal(card.title, '日本語題');
assert.equal(card.original, 'Original title');
assert.equal(card.summary, '要約');
assert.deepEqual(card.story, { problem: '課題', method: ['a', 'b'], result: '結果', impact: '意義' });
assert.deepEqual(card.metric, { value: '40%', label: '誤差減' });
assert.ok(['UR', 'SR', 'R'].includes(card.rarity), 'a full briefing with a metric and a numeric result is never normal');

const digest = buildCard(paper, { kind: 'digest', title_ja: '要約題', summary_ja: '短い要約', point: '40%減' });
assert.equal(digest.story, null, 'digest-only entries have no story');
assert.equal(digest.point, '40%減');
assert.ok(digest.ja);

const plain = buildCard({ ...paper, link: 'javascript:alert(1)' }, undefined);
assert.equal(plain.link, 'https://arxiv.org/abs/2611.00001', 'only arXiv links are used');
assert.equal(plain.ja, false);
assert.equal(plain.summary, 'First. Second.');
assert.equal(plain.point, 'Error drops by 40% on X.');
assert.ok(Object.keys(RARITY).includes(plain.rarity));
assert.equal(rarityOf(paper, full), rarityOf(paper, full), 'rarity is deterministic');
// Over many papers, richer data makes rarer cards more likely.
const tally = (sb, hl) => { const t = { UR: 0, SR: 0, R: 0, N: 0 }; for (let i = 0; i < 4000; i++) t[rarityOf({ id: 'p' + i, summary: '' }, sb, hl)]++; return t; };
const rich = tally(full, { result: 'x' }), poor = tally(undefined, { result: '' });
assert.equal(rich.N, 0);
assert.ok(rich.UR > 800 && rich.UR < 1600, `about 30% UR for the richest papers (${rich.UR})`);
assert.ok(poor.UR < 20 && poor.SR < 80 && poor.N > 3000, `plain papers are mostly normal (${JSON.stringify(poor)})`);

const cards = cardsFrom([paper, { ...paper, id: 'b', title: 'B' }, { ...paper, id: 'c', title: 'C' }, paper, { id: 'x' }], { b: full, c: { kind: 'digest', summary_ja: 's', title_ja: 't' } }, '2026-11-03');
assert.deepEqual(cards.map((c) => c.id), ['b', 'c', '2611.00001'], 'briefed first, then Japanese summaries; duplicates and incomplete papers dropped');

// The bundled offline sample is valid and every card belongs to a known world.
const sample = JSON.parse(readFileSync(new URL('../sample.json', import.meta.url)));
const sampleCards = cardsFrom(sample.papers, sample.briefings, sample.date);
assert.ok(sampleCards.length >= 20);
assert.ok(sampleCards.every((c) => WORLDS[c.world] && c.title && c.summary));
assert.ok(sampleCards.some((c) => c.story), 'the sample includes briefed papers');

// Loading goes through the manifest and tolerates a missing briefing file.
const base = 'https://example.test/';
const snap = { countries: { UNKNOWN: { institutions: { U: { papers: [paper] } } } } };
const day = { date: '2026-11-03', path: `data/snapshots/${'a'.repeat(64)}.json` };
const fake = async (url) => {
  if (url === base + 'data/manifest.json') return { ok: true, json: async () => ({ days: [day, { date: 'bad', path: '../x.json' }] }) };
  if (url === base + day.path) return { ok: true, json: async () => snap };
  return { ok: false, status: 404, json: async () => ({}) };
};
assert.deepEqual(await loadManifest(base, fake), [day], 'unexpected paths are ignored');
const loaded = await loadDay(day, base, fake);
assert.equal(loaded.length, 1);
assert.equal(loaded[0].ja, false);

console.log('PASS: worlds, highlights, card building, rarity, ordering, sample data, loading');
