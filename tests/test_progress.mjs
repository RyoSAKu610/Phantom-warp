// XP, levels, combos, streaks and achievements.
import assert from 'node:assert/strict';
import { addXp, comboMultiplier, emptyProgress, levelInfo, loadProgress, recordView, saveProgress, unlockAchievements, updateStreak, viewXp } from '../js/progress.js';

assert.deepEqual(levelInfo(0), { level: 1, into: 0, need: 120 });
assert.deepEqual(levelInfo(120), { level: 2, into: 0, need: 160 });
assert.deepEqual(levelInfo(300), { level: 3, into: 20, need: 200 });

assert.equal(comboMultiplier(1), 1);
assert.equal(comboMultiplier(5), 1.5);
assert.equal(comboMultiplier(50), 3, 'combo multiplier is capped');

const s = emptyProgress();
const card = { id: 'p1', rarity: 'SR', world: 'ai' };
assert.equal(viewXp(s, card, 5), 75);
let r = recordView(s, card, 5, '2026-11-03');
assert.equal(r.gained, 75);
assert.equal(recordView(s, card, 5, '2026-11-03').gained, 0, 'no XP for a paper seen before');
assert.deepEqual(unlockAchievements(s).map((a) => a.id), ['first', 'sr']);
assert.deepEqual(unlockAchievements(s), [], 'achievements unlock once');

r = addXp(s, 200);
assert.equal(r.levelUp, 2, 'level up is reported with the new level');

assert.equal(updateStreak(s, '2026-11-01'), true);
assert.equal(updateStreak(s, '2026-11-01'), false, 'same day does not count twice');
updateStreak(s, '2026-11-02');
assert.equal(s.streak.count, 2);
updateStreak(s, '2026-11-05');
assert.equal(s.streak.count, 1, 'a missed day resets the streak');
updateStreak(s, '2026-11-06'); updateStreak(s, '2026-11-07');
assert.ok(unlockAchievements(s).some((a) => a.id === 'streak3'));

const store = new Map();
const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
saveProgress(storage, s);
assert.equal(loadProgress(storage).xp, s.xp);
assert.equal(loadProgress({ getItem: () => '{broken' }).xp, 0, 'corrupt storage starts fresh');

console.log('PASS: levels, combo multiplier, view XP, achievements, streaks, storage');
