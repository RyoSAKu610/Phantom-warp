// PHANTOM WARP 本体: カードをめくる・レア度の演出・タイムトラベル・レベル・図鑑
import { DATA_BASE, RARITY, WORLDS, cardsFrom, loadDay, loadManifest } from './data.js';
import { Stage } from './scenes.js';
import { buzz, confetti, emojiPop, flash, isMuted, mountFx, rarityBurst, setMuted, sfx, shake, tapBurst, unlockAudio } from './fx.js';
import {
  ACHIEVEMENTS, COMBO_WINDOW_MS, addXp, comboMultiplier, levelInfo, loadProgress, recordView, saveProgress,
  titleFor, unlockAchievements, updateStreak,
} from './progress.js';

const $ = (sel) => document.querySelector(sel);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? Math.min(ms, 120) : ms));
const params = new URLSearchParams(location.search);
// ?data=<URL> でデータ元を差し替え(ローカル確認用)。データを同梱する配信先は window.PHANTOM_WARP_DATA で指定
const BASE = params.get('data') || window.PHANTOM_WARP_DATA || DATA_BASE;

const storage = (() => { try { return localStorage; } catch (_) { return null; } })();
const progress = loadProgress(storage);
const stage = new Stage($('#stage'));
stage.start();
mountFx();

const state = {
  days: [],        // マニフェストの日付一覧(新しい順)
  dayIndex: 0,
  allCards: [],    // 選択日の全カード
  cards: [],       // ワールドで絞り込んだ後
  pos: 0,
  world: 'all',
  combo: 0,
  lastNext: 0,
  busy: false,
  offline: false,
  cache: new Map(),
};

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const fmtDate = (d) => (d ? d.replace(/-/g, '.') : '----.--.--');
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ---------- 触るたびに光る ----------
addEventListener('pointerdown', (e) => {
  const hue = WORLDS[stage.world].hue;
  tapBurst(e.clientX, e.clientY, hue);
  sfx.tick();
  buzz(6);
}, { passive: true });

// ---------- HUD ----------
function renderHud(levelUp = 0) {
  const info = levelInfo(progress.xp);
  $('#lvNum').textContent = info.level;
  $('#lvTitle').textContent = `${titleFor(info.level)} · ${progress.xp} XP`;
  $('#xpFill').style.width = `${(info.into / info.need) * 100}%`;
  $('#xpBar').setAttribute('aria-valuenow', String(Math.round((info.into / info.need) * 100)));
  $('#streak').textContent = `🔥${progress.streak.count}`;
  $('#dexCount').textContent = Object.keys(progress.collected).length;
  $('#soundBtn').textContent = isMuted() ? '🔇' : '🔊';
  if (levelUp) {
    const lv = $('.lv');
    lv.classList.remove('bump'); void lv.offsetWidth; lv.classList.add('bump');
  }
}

function setOdometer(date) { $('#odometer').textContent = fmtDate(date); }

function setHue(world) {
  document.documentElement.style.setProperty('--hue', WORLDS[world].hue);
}

function floatXp(amount, x, y) {
  if (!amount) return;
  const f = el('div', 'float-xp', `+${amount} XP`);
  f.style.left = x + 'px';
  f.style.top = y + 'px';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1300);
}

function toast(icon, label, text) {
  const t = el('div', 'toast');
  t.append(el('span', 'ic', icon));
  const body = el('div');
  body.append(el('b', '', label), el('span', '', text));
  t.append(body);
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 3800);
}

function showCombo() {
  const c = $('#combo');
  if (state.combo < 2) { c.classList.remove('on'); c.textContent = ''; return; }
  c.replaceChildren(document.createTextNode(`🔥${state.combo} COMBO`), el('small', '', `×${comboMultiplier(state.combo)}`));
  c.classList.remove('on'); void c.offsetWidth; c.classList.add('on');
  sfx.combo(Math.min(state.combo, 12));
}

async function celebrate(result) {
  saveProgress(storage, progress);
  renderHud(result.levelUp);
  for (const a of unlockAchievements(progress)) {
    saveProgress(storage, progress);
    sfx.achievement();
    buzz([20, 40, 20]);
    toast(a.icon, 'ACHIEVEMENT UNLOCKED', `${a.name} — ${a.desc}`);
  }
  if (result.levelUp) await cutin('LV', `LEVEL ${result.levelUp}`, titleFor(result.levelUp));
}

// ---------- 全画面の演出(レア度・レベルアップ) ----------
let skipCutin = null;
$('#cutin').addEventListener('click', () => skipCutin && skipCutin());

async function cutin(kind, big, small) {
  const box = $('#cutin');
  box.className = `cutin ${kind}`;
  box.hidden = false;
  let skipped = false;
  const wait = (ms) => new Promise((r) => { const t = setTimeout(r, ms); skipCutin = () => { skipped = true; clearTimeout(t); r(); }; });
  if (kind !== 'LV') {
    const cap = el('div', 'capsule');
    cap.style.setProperty('--cap', kind === 'UR' ? '#ff4bd8' : '#ffc400');
    box.replaceChildren(cap);
    sfx.suspense();
    buzz([10, 60, 10, 60, 10, 60]);
    if (!reduceMotion) await wait(900);
  }
  const text = el('div', 'cutin-text');
  text.append(el('big', '', big), el('small', '', small));
  box.replaceChildren(text);
  flash(kind === 'UR' ? '#ff9cf0' : kind === 'SR' ? '#ffe680' : '#9ff8ff');
  shake($('#app'), kind === 'UR' ? 1.6 : 1);
  if (kind === 'LV') { sfx.levelUp(); confetti(180); buzz([30, 50, 30, 50, 80]); }
  else { sfx.reveal(kind); rarityBurst(innerWidth / 2, innerHeight / 2, kind); if (kind === 'UR') confetti(140); buzz([40, 30, 80]); }
  if (!skipped) await wait(kind === 'LV' ? 1500 : 1100);
  skipCutin = null;
  box.hidden = true;
}

// ---------- カード ----------
function cardNode(card) {
  const node = el('article', `card r-${card.rarity}`);
  node.style.setProperty('--hue', WORLDS[card.world].hue);
  node.dataset.id = card.id;

  const top = el('div', 'card-top');
  top.append(el('span', 'rarity', `${card.rarity} · ${RARITY[card.rarity].name}`));
  const w = WORLDS[card.world];
  top.append(el('span', 'world-chip', `${w.emoji} ${w.label}`));
  top.append(el('span', 'pos', `${state.pos + 1} / ${state.cards.length}`));
  node.append(top);

  const body = el('div', 'card-body');
  body.append(el('h2', 'card-title', card.title));
  if (card.original) body.append(el('p', 'card-original', card.original));
  const summary = el('p', 'card-summary');
  if (!card.ja) summary.append(el('span', 'lang-chip', '原文'));
  summary.append(document.createTextNode(card.summary));
  body.append(summary);

  if (card.story) {
    const ol = el('ol', 'story');
    const step = (ic, label, content) => {
      const li = el('li');
      li.append(el('span', 'ic', ic));
      const d = el('div');
      d.append(el('b', '', label));
      if (content instanceof Node) d.append(content); else d.append(document.createTextNode(content));
      li.append(d);
      ol.append(li);
    };
    step('❓', '課題', card.story.problem);
    const flow = el('div', 'flow');
    card.story.method.forEach((m, i) => { if (i) flow.append(document.createTextNode('▶')); flow.append(el('span', '', m)); });
    step('🛠', '手法', flow);
    step('📊', '結果', card.story.result);
    step('🚀', '意義', card.story.impact);
    body.append(ol);
  }
  if (card.metric) {
    const m = el('div', 'metric', card.metric.value);
    m.append(el('small', '', card.metric.label));
    body.append(m);
  }
  if (card.point && !card.story) {
    const p = el('div', 'point');
    p.append(el('b', '', card.ja ? '💡 ポイント' : '💡 注目の結果（原文）'), document.createTextNode(card.point));
    body.append(p);
  }
  body.append(el('div', 'cats', card.categories.join(' · ')));
  node.append(body);

  const actions = el('div', 'card-actions');
  const collect = el('button', 'act collect', progress.collected[card.id] ? '💖 図鑑に登録済み' : '🤍 図鑑に入れる');
  collect.type = 'button';
  if (progress.collected[card.id]) collect.classList.add('collected');
  collect.addEventListener('click', (e) => toggleCollect(card, e.currentTarget, e));
  const open = el('a', 'act open', 'arXivで読む ↗');
  open.href = card.link;
  open.target = '_blank';
  open.rel = 'noopener';
  open.addEventListener('click', () => {
    const r = addXp(progress, 5);
    floatXp(5, innerWidth / 2, innerHeight * 0.7);
    celebrate(r);
  });
  actions.append(collect, open);
  node.append(actions);

  // ダブルタップで図鑑へ
  let lastTap = 0;
  node.addEventListener('pointerup', (e) => {
    if (e.target.closest('button, a')) return;
    const now = Date.now();
    if (now - lastTap < 320) toggleCollect(card, collect, e, true);
    lastTap = now;
  });
  attachSwipe(node);
  return node;
}

function toggleCollect(card, button, e, onlyAdd = false) {
  if (progress.collected[card.id]) {
    if (onlyAdd) { emojiPop(e.clientX, e.clientY, '💖', 4); return; }
    delete progress.collected[card.id];
    button.textContent = '🤍 図鑑に入れる';
    button.classList.remove('collected');
    saveProgress(storage, progress);
    renderHud();
    return;
  }
  progress.collected[card.id] = { title: card.title, rarity: card.rarity, world: card.world, link: card.link, date: currentDate(), at: Date.now() };
  button.textContent = '💖 図鑑に登録済み';
  button.classList.add('collected');
  sfx.collect();
  buzz([15, 30, 15]);
  emojiPop(e.clientX || innerWidth / 2, e.clientY || innerHeight / 2, '💖', 10);
  const r = addXp(progress, 15);
  floatXp(15, e.clientX || innerWidth / 2, (e.clientY || innerHeight / 2) - 30);
  celebrate(r);
}

function playCardIntro(node, card) {
  const steps = [...node.querySelectorAll('.story li')];
  steps.forEach((li, i) => setTimeout(() => { li.classList.add('on'); sfx.tick(); }, 450 + i * 380));
  const metric = node.querySelector('.metric');
  if (metric) setTimeout(() => { metric.classList.add('on'); sfx.reveal('R'); shake($('#app'), 0.5); }, 450 + steps.length * 380 + 150);
}

function currentDate() { return state.days[state.dayIndex] ? state.days[state.dayIndex].date : ''; }

async function showCard(direction = 1) {
  const deck = $('#deck');
  const card = state.cards[state.pos];
  const old = deck.querySelector('.card:not(.out-left):not(.out-right)');
  if (old) {
    old.classList.add(direction >= 0 ? 'out-left' : 'out-right');
    setTimeout(() => old.remove(), 460);
  }
  deck.querySelectorAll('.empty-card').forEach((n) => n.remove());
  if (!card) { deck.append(emptyCard()); return; }

  stage.setWorld(card.world);
  setHue(card.world);
  const firstTime = !progress.seen[card.id];
  if (firstTime && (card.rarity === 'SR' || card.rarity === 'UR')) await cutin(card.rarity, `${card.rarity}!!`, RARITY[card.rarity].name);

  const node = cardNode(card);
  deck.append(node);
  sfx.swipe();
  if (!firstTime || card.rarity === 'N' || card.rarity === 'R') {
    sfx.reveal(card.rarity);
    const r = node.getBoundingClientRect();
    rarityBurst(r.left + r.width / 2, r.top + 40, card.rarity);
  }
  playCardIntro(node, card);

  const result = recordView(progress, card, state.combo, currentDate());
  if (result.gained) {
    const r = node.getBoundingClientRect();
    floatXp(result.gained, r.left + r.width / 2, r.top + 30);
  }
  celebrate(result);
}

function emptyCard() {
  const box = el('article', 'card empty-card');
  const inner = el('div');
  inner.append(el('h2', '', 'この時代の論文を見尽くした！'), el('p', '', 'ほかの日付やワールドへワープしよう。'));
  const go = el('button', 'act open', '🎲 ランダムワープ');
  go.type = 'button';
  go.addEventListener('click', randomWarp);
  inner.append(go);
  box.append(inner);
  return box;
}

async function next() {
  if (state.busy || !state.cards.length) return;
  const now = Date.now();
  state.combo = now - state.lastNext < COMBO_WINDOW_MS ? state.combo + 1 : 1;
  state.lastNext = now;
  showCombo();
  if (state.pos >= state.cards.length - 1) { state.pos = state.cards.length; await showCard(1); return; }
  state.pos++;
  state.busy = true;
  try { await showCard(1); } finally { state.busy = false; }
}

async function prev() {
  if (state.busy || state.pos <= 0) return;
  state.pos--;
  state.busy = true;
  try { await showCard(-1); } finally { state.busy = false; }
}

// ---------- スワイプ ----------
function attachSwipe(node) {
  let startX = 0, startY = 0, dx = 0, active = false;
  node.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, a')) return;
    active = true; startX = e.clientX; startY = e.clientY; dx = 0;
  });
  node.addEventListener('pointermove', (e) => {
    if (!active) return;
    dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) < 10 || Math.abs(dy) > Math.abs(dx)) return;
    node.classList.add('dragging');
    node.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
  });
  const end = () => {
    if (!active) return;
    active = false;
    node.classList.remove('dragging');
    node.style.transform = '';
    if (dx < -70) next();
    else if (dx > 70) prev();
  };
  node.addEventListener('pointerup', end);
  node.addEventListener('pointercancel', end);
}

addEventListener('keydown', (e) => {
  if (!$('#intro').hidden || document.querySelector('dialog[open]')) return;
  if (['ArrowRight', 'ArrowDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); next(); }
  else if (['ArrowLeft', 'ArrowUp'].includes(e.key)) { e.preventDefault(); prev(); }
  else if (e.key === 'r') randomWarp();
});

// ---------- タイムトラベル ----------
async function getDayCards(index) {
  const day = state.days[index];
  if (state.cache.has(day.date)) return state.cache.get(day.date);
  const cards = await loadDay(day, BASE);
  state.cache.set(day.date, cards);
  return cards;
}

function rollDate(from, to, k) {
  // 日付を数字のように回して見せる
  const a = Date.parse(from || to), b = Date.parse(to);
  if (!isFinite(a) || !isFinite(b)) return fmtDate(to);
  const mid = new Date(a + (b - a) * k + (k < 1 ? Math.sin(k * 40) * 86400000 * 3 : 0));
  return `${mid.getFullYear()}.${String(mid.getMonth() + 1).padStart(2, '0')}.${String(mid.getDate()).padStart(2, '0')}`;
}

async function travel(dayIndex, { pos = 0, world = state.world } = {}) {
  if (state.busy) return;
  state.busy = true;
  const from = currentDate();
  const to = state.days[dayIndex].date;
  const box = $('#travel');
  box.hidden = false;
  stage.setWarp(1);
  sfx.warp();
  buzz([20, 80, 20, 80, 20, 200]);
  const load = getDayCards(dayIndex).then((c) => ({ ok: true, cards: c }), (err) => ({ ok: false, err }));
  const worlds = Object.keys(WORLDS);
  const minMs = reduceMotion ? 300 : 2300;
  const t0 = performance.now();
  let i = 0;
  while (performance.now() - t0 < minMs) {
    const k = Math.min(1, (performance.now() - t0) / minMs);
    $('#travelDate').textContent = rollDate(from, to, k);
    $('#travelFill').style.width = `${k * 100}%`;
    const w = WORLDS[worlds[i++ % worlds.length]];
    $('#travelScene').textContent = `${w.emoji} ${w.label}を通過中…`;
    stage.setWorld(worlds[(i - 1) % worlds.length]);
    setHue(worlds[(i - 1) % worlds.length]);
    await sleep(150);
  }
  const res = await load;
  $('#travelDate').textContent = fmtDate(to);
  $('#travelFill').style.width = '100%';
  $('#travelScene').textContent = res.ok ? '✦ 到着 ✦' : '⚠ 時空が乱れて到着できなかった…';
  await sleep(350);
  box.hidden = true;
  stage.setWarp(0);
  flash('#bdfcff', 500);
  shake($('#app'), 1.2);
  if (res.ok) {
    state.dayIndex = dayIndex;
    state.allCards = res.cards;
    applyWorld(world);
    const at = typeof pos === 'function' ? pos(state.cards) : pos;
    state.pos = Math.min(at, Math.max(0, state.cards.length - 1));
    setOdometer(to);
    state.busy = false;
    await showCard(1);
  } else {
    toast('⚠️', 'WARP FAILED', 'データを読み込めませんでした。少し待ってもう一度。');
    state.busy = false;
  }
}

function applyWorld(world) {
  state.world = world;
  state.cards = world === 'all' ? state.allCards : state.allCards.filter((c) => c.world === world);
}

async function randomWarp() {
  if (state.busy || !state.days.length) return;
  const dayIndex = Math.floor(Math.random() * state.days.length);
  await travel(dayIndex, { world: 'all', pos: (cards) => Math.floor(Math.random() * Math.min(cards.length, 300)) });
}

// ---------- ワールド・日付・図鑑 ----------
function openWorlds() {
  const grid = $('#worldGrid');
  grid.replaceChildren();
  const counts = {};
  for (const c of state.allCards) counts[c.world] = (counts[c.world] || 0) + 1;
  const entries = [['all', { emoji: '✨', label: 'すべてのワールド', name: 'ALL', hue: 260 }], ...Object.entries(WORLDS)];
  for (const [key, w] of entries) {
    const n = key === 'all' ? state.allCards.length : counts[key] || 0;
    if (key !== 'all' && !n) continue;
    const b = el('button', `world-btn${state.world === key ? ' current' : ''}`);
    b.type = 'button';
    b.style.setProperty('--h', w.hue);
    b.append(el('span', 'e', w.emoji), el('b', '', w.label), el('small', '', `${w.name} · ${n}本`));
    b.addEventListener('click', async () => {
      $('#worldDlg').close();
      await enterWorld(key);
    });
    grid.append(b);
  }
  $('#worldDlg').showModal();
}

async function enterWorld(key) {
  if (state.busy) return;
  state.busy = true;
  stage.setWarp(0.7);
  sfx.warp();
  if (key !== 'all') { stage.setWorld(key); setHue(key); }
  await sleep(900);
  stage.setWarp(0);
  flash('#ffffff', 350);
  applyWorld(key);
  state.pos = 0;
  state.busy = false;
  if (key !== 'all') toast(WORLDS[key].emoji, 'WORLD', `${WORLDS[key].label}に到着`);
  await showCard(1);
}

function openDates() {
  const grid = $('#dateGrid');
  grid.replaceChildren();
  state.days.forEach((d, i) => {
    const b = el('button', `date-btn${i === state.dayIndex ? ' current' : ''}`);
    b.type = 'button';
    b.style.setProperty('--h', (i * 37) % 360);
    const visited = progress.dates[d.date] ? '✓ 訪問済み' : '未踏の日';
    b.append(el('b', '', fmtDate(d.date)), el('small', '', `${d.count}本 · ${visited}`));
    b.addEventListener('click', () => { $('#timeDlg').close(); travel(i, { world: 'all' }); });
    grid.append(b);
  });
  $('#timeDlg').showModal();
}

function openDex() {
  const counts = { UR: 0, SR: 0, R: 0, N: 0 };
  for (const r of Object.values(progress.seen)) counts[r] = (counts[r] || 0) + 1;
  $('#dexStats').replaceChildren(...['UR', 'SR', 'R', 'N'].map((r) => {
    const d = el('div');
    d.append(el('b', '', String(counts[r])), el('small', '', `${r} 発見`));
    return d;
  }));
  $('#achievements').replaceChildren(...ACHIEVEMENTS.map((a) => {
    const d = el('div', `ach${progress.achievements[a.id] ? ' on' : ''}`);
    d.title = a.desc;
    d.append(el('div', 'ic', a.icon), el('small', '', a.name));
    return d;
  }));
  const list = $('#dexList');
  const items = Object.values(progress.collected).sort((a, b) => b.at - a.at);
  list.replaceChildren();
  if (!items.length) list.append(el('li', 'dex-empty', 'まだ空っぽ。気になった論文をダブルタップするか「🤍 図鑑に入れる」で集めよう。'));
  for (const it of items) {
    const li = el('li');
    const a = el('a');
    a.href = it.link; a.target = '_blank'; a.rel = 'noopener';
    const t = el('span', 't', it.title);
    t.append(el('span', 'm', `${(WORLDS[it.world] || WORLDS.other).emoji} ${fmtDate(it.date)}`));
    a.append(el('span', `rarity r-${it.rarity}`, it.rarity), t);
    li.append(a);
    list.append(li);
  }
  $('#dexDlg').showModal();
}

// ---------- 起動 ----------
$('#nextBtn').addEventListener('click', next);
$('#prevBtn').addEventListener('click', prev);
$('#randomBtn').addEventListener('click', randomWarp);
$('#worldBtn').addEventListener('click', openWorlds);
$('#timeBtn').addEventListener('click', openDates);
$('#dexBtn').addEventListener('click', openDex);
$('#soundBtn').addEventListener('click', () => { setMuted(!isMuted()); renderHud(); });

async function loadSample() {
  const res = await fetch('sample.json');
  const sample = await res.json();
  state.offline = true;
  state.days = [{ date: sample.date, count: sample.papers.length, path: '' }];
  state.cache.set(sample.date, cardsFrom(sample.papers, sample.briefings, sample.date));
  const note = el('div', 'offline', '📦 オフライン標本を表示中（最新データに接続できませんでした）');
  document.body.append(note);
}

const ready = (async () => {
  try {
    state.days = await loadManifest(BASE);
    if (!state.days.length) throw new Error('empty manifest');
  } catch (err) {
    console.warn('manifest:', err);
    await loadSample();
  }
})();

$('#boardBtn').addEventListener('click', async () => {
  unlockAudio();
  if (updateStreak(progress, todayLocal()) && progress.streak.count > 1) {
    setTimeout(() => toast('🔥', 'STREAK', `${progress.streak.count}日連続で来訪！`), 2800);
  }
  saveProgress(storage, progress);
  $('#intro').classList.add('leaving');
  $('#boardBtn').disabled = true;
  await ready;
  setTimeout(() => { $('#intro').hidden = true; }, 850);
  $('#app').hidden = false;
  renderHud();
  // 日付データの取得に失敗したら標本へ切り替えて続ける
  try {
    await travel(0, { world: 'all' });
    if (!state.allCards.length) throw new Error('no cards');
  } catch (err) {
    if (!state.offline) { await loadSample(); await travel(0, { world: 'all' }); }
  }
  let hinted = false;
  try { hinted = !!sessionStorage.getItem('pw-hint'); } catch (_) {}
  if (!state.offline && !hinted) {
    const hint = el('div', 'swipe-hint', '← スワイプ / NEXT で次の発見へ');
    $('#app').append(hint);
    setTimeout(() => hint.remove(), 6000);
    try { sessionStorage.setItem('pw-hint', '1'); } catch (_) {}
  }
});

renderHud();
