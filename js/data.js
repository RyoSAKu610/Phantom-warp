// 論文データの読み込みと整形(DOMに依存しない純粋な処理。テストからも読み込む)
// データ源は本家 ResearchPhantom が毎日公開している保存データ(読み取りのみ)。

export const DATA_BASE = 'https://howly23v.github.io/ResearchPhantom/';

// 本家のカテゴリボタンと同じ分類。各「ワールド」が背景の場面になる
export const WORLDS = {
  ai: { name: 'AI', label: 'AIの惑星', emoji: '🤖', cats: ['cs.AI', 'cs.LG'], hue: 190 },
  nlp: { name: 'NLP', label: 'ことばの海', emoji: '💬', cats: ['cs.CL'], hue: 150 },
  cv: { name: 'VISION', label: 'まなざしの塔', emoji: '👁', cats: ['cs.CV'], hue: 45 },
  physics: { name: 'PHYSICS', label: '粒子の宇宙', emoji: '⚛️', cats: ['physics', 'hep', 'astro', 'gr-qc', 'nucl'], hue: 265 },
  bio: { name: 'BIO', label: '生命の森', emoji: '🧬', cats: ['q-bio'], hue: 120 },
  quantum: { name: 'QUANTUM', label: '量子の深淵', emoji: '🔮', cats: ['quant-ph'], hue: 290 },
  materials: { name: 'MATERIALS', label: '結晶の洞窟', emoji: '💎', cats: ['cond-mat'], hue: 205 },
  energy: { name: 'ENERGY', label: '雷の高原', emoji: '⚡', cats: ['eess'], hue: 30 },
  other: { name: 'COSMOS', label: '未知の星雲', emoji: '🌌', cats: [], hue: 320 },
};

export function worldOf(categories) {
  const primary = (categories || [])[0] || '';
  for (const [key, w] of Object.entries(WORLDS)) {
    if (w.cats.some((c) => primary.includes(c))) return key;
  }
  for (const [key, w] of Object.entries(WORLDS)) {
    if (w.cats.some((c) => (categories || []).some((x) => x.includes(c)))) return key;
  }
  return 'other';
}

// 文の区切りは「. の後に空白と大文字(または終わり)」。e.g. や 3.5 では切らない
export function splitSentences(text) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return [];
  return s.split(/(?<=[.!?。])\s+(?=[A-Z"'(\[])|(?<=。)/).map((x) => x.trim()).filter(Boolean);
}

export function clip(text, max) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

const RESULT_WORDS = /%|×|\b\d+(?:\.\d+)?x\b|times|fold|improv|outperform|reduc|achiev|accura|faster|speedup|lower|higher|increase|decrease/i;

// 英語要旨しか無い論文: 冒頭2文と「数字の出てくる成果の一文」
export function extractHighlights(summary) {
  const sents = splitSentences(summary);
  const opening = sents.slice(0, 2).join(' ');
  const shown = opening.length <= 260 ? 2 : 0;
  const result = sents.slice(shown).find((s) => /\d/.test(s) && RESULT_WORDS.test(s)) || '';
  return { lead: clip(opening, 260), result: clip(result, 200) };
}

// 1本の論文を、画面に出す形にまとめる
export function buildCard(paper, briefing) {
  const sb = briefing || null;
  const full = !!(sb && sb.kind !== 'digest' && sb.problem);
  const hl = extractHighlights(paper.summary);
  const ja = !!(sb && sb.summary_ja);
  return {
    id: String(paper.id),
    title: sb && sb.title_ja ? sb.title_ja : paper.title,
    original: sb && sb.title_ja ? paper.title : '',
    summary: ja ? sb.summary_ja : hl.lead,
    ja,
    point: full ? sb.result : (sb && sb.point) || hl.result,
    story: full ? { problem: sb.problem, method: sb.method || [], result: sb.result, impact: sb.impact } : null,
    metric: full && sb.metric && sb.metric.value ? { value: sb.metric.value, label: sb.metric.label || '' } : null,
    world: worldOf(paper.categories),
    categories: (paper.categories || []).slice(0, 3),
    link: /^https:\/\/arxiv\.org\//.test(paper.link || '') ? paper.link : `https://arxiv.org/abs/${encodeURIComponent(paper.id)}`,
    rarity: rarityOf(paper, sb, hl),
  };
}

// ガチャ風のレア度。解説の充実度と数値成果で決まり、同じ論文はいつも同じレア度
export const RARITY = {
  UR: { label: 'UR', name: 'ULTRA RARE', xp: 120 },
  SR: { label: 'SR', name: 'SUPER RARE', xp: 50 },
  R: { label: 'R', name: 'RARE', xp: 20 },
  N: { label: 'N', name: 'NORMAL', xp: 10 },
};

export function hashString(s) {
  let h = 2166136261;
  for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

// 充実度(解説・数値成果)で確率が上がる「くじ」。同じ論文はいつも同じ結果になる
export function rarityOf(paper, sb, hl = extractHighlights(paper.summary)) {
  let score = 0;
  if (sb && sb.kind !== 'digest' && sb.problem) score += 3;
  else if (sb && sb.summary_ja) score += 1;
  if (sb && sb.metric && sb.metric.value) score += 1;
  if (hl.result || (sb && /\d/.test(sb.point || ''))) score += 1;
  const luck = hashString(paper.id);
  // [UR, SR, R] になる下限。score が高いほど当たりやすい
  const table = score >= 5 ? [0.7, 0.25, 0] : score === 4 ? [0.92, 0.55, 0] : score === 3 ? [0.98, 0.85, 0.3] : score === 2 ? [0.995, 0.97, 0.5] : [0.999, 0.99, 0.8];
  if (luck > table[0]) return 'UR';
  if (luck > table[1]) return 'SR';
  if (luck > table[2]) return 'R';
  return 'N';
}

export function snapshotPapers(snapshot) {
  const out = [];
  for (const country of Object.values((snapshot && snapshot.countries) || {})) {
    for (const inst of Object.values(country.institutions || {})) out.push(...(inst.papers || []));
  }
  return out;
}

// 表示順: 解説つき → 日本語要約つき → その他。各段の中は日付ごとに決まった順でシャッフル
export function orderCards(cards, seed) {
  const tier = (c) => (c.story ? 0 : c.ja ? 1 : 2);
  return [...cards].sort((a, b) => tier(a) - tier(b) || hashString(seed + a.id) - hashString(seed + b.id));
}

export async function loadManifest(base = DATA_BASE, fetchImpl = fetch) {
  const res = await fetchImpl(base + 'data/manifest.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`manifest ${res.status}`);
  const manifest = await res.json();
  return (manifest.days || []).filter((d) => /^data\/snapshots\/[a-f0-9]{64}\.json$/.test(d.path));
}

export async function loadDay(day, base = DATA_BASE, fetchImpl = fetch) {
  const [snapRes, briefRes] = await Promise.all([
    fetchImpl(base + day.path),
    fetchImpl(base + day.path.replace('data/snapshots/', 'data/briefings/')).catch(() => null),
  ]);
  if (!snapRes.ok) throw new Error(`snapshot ${snapRes.status}`);
  const snapshot = await snapRes.json();
  let briefings = {};
  if (briefRes && briefRes.ok) {
    try { briefings = await briefRes.json(); } catch (_) { briefings = {}; }
  }
  return cardsFrom(snapshotPapers(snapshot), briefings, day.date);
}

export function cardsFrom(papers, briefings, seed) {
  const seen = new Set();
  const cards = [];
  for (const p of papers) {
    if (!p || !p.id || !p.title || seen.has(p.id)) continue;
    seen.add(p.id);
    cards.push(buildCard(p, briefings[p.id]));
  }
  return orderCards(cards, seed);
}
