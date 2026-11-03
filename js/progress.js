// 経験値・レベル・連続日数・実績(ブラウザの localStorage に保存。DOMに依存しない)

import { RARITY, WORLDS } from './data.js';

export function emptyProgress() {
  return { xp: 0, seen: {}, collected: {}, worlds: {}, dates: {}, rarities: {}, streak: { last: '', count: 0 }, bestCombo: 0, achievements: {} };
}

// レベル n から n+1 に必要な経験値は 80 + 40n
export function levelInfo(xp) {
  let level = 1, need = 120, rest = Math.max(0, Math.floor(xp));
  while (rest >= need) { rest -= need; level++; need = 80 + 40 * level; }
  return { level, into: rest, need };
}

export const TITLES = ['見習い時間旅行者', '論文スカウト', '時空ハンター', '知の冒険者', '未来の目撃者', '時の賢者', 'タイムロード'];
export const titleFor = (level) => TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 3))];

export const COMBO_WINDOW_MS = 7000;
// コンボが続くほど経験値の倍率が上がる(最大3倍)
export const comboMultiplier = (combo) => Math.min(3, 1 + Math.floor(combo / 5) * 0.5);

export const ACHIEVEMENTS = [
  { id: 'first', icon: '🚀', name: '初ワープ', desc: '最初の論文を発見', test: (s) => count(s.seen) >= 1 },
  { id: 'ten', icon: '📚', name: '10本読破', desc: '論文を10本発見', test: (s) => count(s.seen) >= 10 },
  { id: 'fifty', icon: '🏛', name: '50本読破', desc: '論文を50本発見', test: (s) => count(s.seen) >= 50 },
  { id: 'hundred', icon: '🌠', name: '100本読破', desc: '論文を100本発見', test: (s) => count(s.seen) >= 100 },
  { id: 'sr', icon: '✨', name: 'SR引き当て', desc: 'SUPER RAREを発見', test: (s) => (s.rarities.SR || 0) + (s.rarities.UR || 0) >= 1 },
  { id: 'ur', icon: '🌈', name: 'UR降臨', desc: 'ULTRA RAREを発見', test: (s) => (s.rarities.UR || 0) >= 1 },
  { id: 'worlds4', icon: '🗺', name: '4つの世界', desc: '4つのワールドを訪問', test: (s) => count(s.worlds) >= 4 },
  { id: 'worldsAll', icon: '🪐', name: '全世界制覇', desc: `${Object.keys(WORLDS).length}つのワールドをすべて訪問`, test: (s) => count(s.worlds) >= Object.keys(WORLDS).length },
  { id: 'time3', icon: '⏳', name: 'タイムトラベラー', desc: '3つの日付へワープ', test: (s) => count(s.dates) >= 3 },
  { id: 'collect5', icon: '💖', name: 'コレクター', desc: '5本を図鑑に保存', test: (s) => count(s.collected) >= 5 },
  { id: 'combo10', icon: '🔥', name: '10コンボ', desc: 'テンポよく10本連続', test: (s) => s.bestCombo >= 10 },
  { id: 'streak3', icon: '📅', name: '3日連続', desc: '3日続けて来訪', test: (s) => s.streak.count >= 3 },
];

function count(obj) { return Object.keys(obj || {}).length; }

// 新しく達成したものだけを返し、記録する
export function unlockAchievements(state) {
  const fresh = ACHIEVEMENTS.filter((a) => !state.achievements[a.id] && a.test(state));
  for (const a of fresh) state.achievements[a.id] = Date.now();
  return fresh;
}

// 論文を初めて見たときの経験値(2回目以降は0)
export function viewXp(state, card, combo) {
  if (state.seen[card.id]) return 0;
  return Math.round(RARITY[card.rarity].xp * comboMultiplier(combo));
}

export function recordView(state, card, combo, date) {
  const gained = viewXp(state, card, combo);
  if (gained) {
    state.seen[card.id] = card.rarity;
    state.rarities[card.rarity] = (state.rarities[card.rarity] || 0) + 1;
  }
  state.worlds[card.world] = true;
  if (date) state.dates[date] = true;
  state.bestCombo = Math.max(state.bestCombo, combo);
  return addXp(state, gained);
}

// 経験値を足し、レベルが上がったかを返す
export function addXp(state, amount) {
  const before = levelInfo(state.xp).level;
  state.xp += amount;
  const after = levelInfo(state.xp).level;
  return { gained: amount, levelUp: after > before ? after : 0 };
}

// 日付は 'YYYY-MM-DD'(端末の現地時間)
export function updateStreak(state, today) {
  const { last } = state.streak;
  if (last === today) return false;
  const yesterday = new Date(today + 'T00:00:00');
  yesterday.setDate(yesterday.getDate() - 1);
  const y = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  state.streak = { last: today, count: last === y ? state.streak.count + 1 : 1 };
  return true;
}

export function loadProgress(storage) {
  try {
    const raw = storage && storage.getItem('pw-progress');
    if (raw) return { ...emptyProgress(), ...JSON.parse(raw) };
  } catch (_) {}
  return emptyProgress();
}

export function saveProgress(storage, state) {
  try { storage && storage.setItem('pw-progress', JSON.stringify(state)); } catch (_) {}
}
