// 効果音(WebAudioで合成、音声ファイル不要)・触ったときの粒子・紙吹雪・振動・画面の揺れ

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- 音 ----------
let ctx = null;
let master = null;
let muted = false;
try { muted = localStorage.getItem('pw-muted') === '1'; } catch (_) {}

export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ctx.destination);
}

export function setMuted(value) {
  muted = value;
  try { localStorage.setItem('pw-muted', value ? '1' : '0'); } catch (_) {}
  if (master) master.gain.value = value ? 0 : 0.5;
}
export const isMuted = () => muted;

function tone(freq, start, dur, { type = 'sine', gain = 0.3, slide = 0 } = {}) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(start, dur, { gain = 0.2, from = 400, to = 4000 } = {}) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + start;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t);
}

const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98];

export const sfx = {
  tick() { tone(1400 + Math.random() * 400, 0, 0.05, { type: 'triangle', gain: 0.12 }); },
  swipe() { noise(0, 0.25, { gain: 0.12, from: 800, to: 3000 }); tone(300, 0, 0.2, { type: 'sine', gain: 0.1, slide: 500 }); },
  warp() {
    noise(0, 2.2, { gain: 0.35, from: 120, to: 6000 });
    tone(80, 0, 2.2, { type: 'sawtooth', gain: 0.08, slide: 900 });
    tone(55, 2.0, 0.6, { type: 'sine', gain: 0.35, slide: -20 });
  },
  reveal(rarity) {
    const n = { N: 2, R: 3, SR: 5, UR: 8 }[rarity] || 2;
    for (let i = 0; i < n; i++) tone(NOTES[i], i * 0.07, 0.35, { type: 'triangle', gain: 0.18 });
    if (rarity === 'UR' || rarity === 'SR') {
      tone(NOTES[n] || 1760, n * 0.07, 0.9, { type: 'sine', gain: 0.25 });
      noise(0, 0.6, { gain: 0.15, from: 2000, to: 9000 });
    }
  },
  suspense() { tone(110, 0, 1.1, { type: 'sawtooth', gain: 0.06, slide: 220 }); noise(0, 1.1, { gain: 0.08, from: 200, to: 2500 }); },
  collect() { tone(880, 0, 0.12, { type: 'square', gain: 0.08 }); tone(1320, 0.08, 0.2, { type: 'triangle', gain: 0.15 }); },
  combo(level) { tone(600 + level * 80, 0, 0.12, { type: 'square', gain: 0.07 }); },
  levelUp() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.11, 0.3, { type: 'square', gain: 0.1 }));
    tone(1046.5, 0.45, 0.9, { type: 'triangle', gain: 0.2 });
    tone(1318.51, 0.45, 0.9, { type: 'triangle', gain: 0.15 });
  },
  achievement() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.06, 0.25, { type: 'triangle', gain: 0.14 })); },
};

// ---------- 振動 ----------
export function buzz(pattern) {
  if (reduceMotion) return;
  try { navigator.vibrate && navigator.vibrate(pattern); } catch (_) {}
}

// ---------- 画面の揺れ・フラッシュ ----------
export function shake(el, strength = 1) {
  if (reduceMotion || !el) return;
  el.style.setProperty('--shake', String(strength));
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

export function flash(color = '#fff', ms = 450) {
  const f = document.createElement('div');
  f.className = 'flash';
  f.style.background = color;
  f.style.animationDuration = ms + 'ms';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), ms + 50);
}

// ---------- 粒子(前面のキャンバス) ----------
const canvas = document.createElement('canvas');
canvas.className = 'fx-layer';
canvas.setAttribute('aria-hidden', 'true');
const g = canvas.getContext('2d');
let particles = [];
let running = false;
const DPR = Math.min(window.devicePixelRatio || 1, 2);

function resize() {
  canvas.width = innerWidth * DPR;
  canvas.height = innerHeight * DPR;
}

export function mountFx() {
  document.body.appendChild(canvas);
  resize();
  addEventListener('resize', resize);
}

function loop() {
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.clearRect(0, 0, innerWidth, innerHeight);
  g.globalCompositeOperation = 'lighter';
  particles = particles.filter((p) => p.life > 0);
  for (const p of particles) {
    p.life -= 1;
    p.vx *= p.drag; p.vy = p.vy * p.drag + p.gravity;
    p.x += p.vx; p.y += p.vy;
    p.rot += p.spin;
    const a = Math.max(0, p.life / p.max);
    g.globalAlpha = a;
    g.fillStyle = p.color;
    if (p.kind === 'ring') {
      g.strokeStyle = p.color;
      g.lineWidth = 2 * a + 0.5;
      g.beginPath();
      g.arc(p.x, p.y, p.size * (1 - a) * 3 + 4, 0, Math.PI * 2);
      g.stroke();
    } else if (p.kind === 'confetti') {
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.globalCompositeOperation = 'source-over';
      g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      g.restore();
    } else if (p.kind === 'star') {
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.beginPath();
      for (let i = 0; i < 4; i++) {
        g.rotate(Math.PI / 2);
        g.moveTo(0, 0); g.lineTo(p.size * 0.25, p.size * 0.25); g.lineTo(0, p.size); g.lineTo(-p.size * 0.25, p.size * 0.25);
      }
      g.fill();
      g.restore();
    } else {
      g.beginPath();
      g.arc(p.x, p.y, p.size * a + 0.4, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  if (particles.length) requestAnimationFrame(loop);
  else running = false;
}

function add(p) {
  particles.push({ vx: 0, vy: 0, drag: 0.94, gravity: 0, rot: Math.random() * 6, spin: 0, kind: 'dot', size: 3, ...p, max: p.life });
  if (!running) { running = true; requestAnimationFrame(loop); }
}

// 触ったところに波紋と火花
export function tapBurst(x, y, hue = 190) {
  if (reduceMotion) return;
  add({ x, y, kind: 'ring', life: 26, size: 10, color: `hsl(${hue} 100% 70%)` });
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 4;
    add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 22 + Math.random() * 14, size: 1.5 + Math.random() * 2.5, color: `hsl(${hue + Math.random() * 60 - 30} 100% ${60 + Math.random() * 25}%)` });
  }
}

// レア度の演出: 中心から放射する光の粒と星
export function rarityBurst(x, y, rarity) {
  const count = { N: 18, R: 40, SR: 90, UR: 180 }[rarity] || 18;
  const hues = { N: [200, 220], R: [270, 300], SR: [38, 55], UR: [0, 360] }[rarity];
  for (let i = 0; i < (reduceMotion ? count / 6 : count); i++) {
    const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * (rarity === 'UR' ? 14 : 9);
    const hue = hues[0] + Math.random() * (hues[1] - hues[0]);
    add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 0.95, life: 40 + Math.random() * 40,
      kind: Math.random() < 0.3 ? 'star' : 'dot', size: 2 + Math.random() * (rarity === 'UR' ? 8 : 5), spin: (Math.random() - 0.5) * 0.3,
      color: `hsl(${hue} 100% ${60 + Math.random() * 30}%)` });
  }
}

export function confetti(amount = 120) {
  const n = reduceMotion ? amount / 6 : amount;
  for (let i = 0; i < n; i++) {
    add({ x: Math.random() * innerWidth, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 4,
      gravity: 0.08, drag: 0.99, life: 140 + Math.random() * 80, kind: 'confetti', size: 8 + Math.random() * 6,
      spin: (Math.random() - 0.5) * 0.4, color: `hsl(${Math.random() * 360} 95% 60%)` });
  }
}

// ハートや絵文字が飛び出す
export function emojiPop(x, y, emoji = '❤️', count = 8) {
  if (reduceMotion) count = 1;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'emoji-pop';
    el.textContent = emoji;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.setProperty('--dx', (Math.random() - 0.5) * 220 + 'px');
    el.style.setProperty('--dy', -80 - Math.random() * 180 + 'px');
    el.style.setProperty('--rot', (Math.random() - 0.5) * 90 + 'deg');
    el.style.animationDelay = i * 30 + 'ms';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }
}
