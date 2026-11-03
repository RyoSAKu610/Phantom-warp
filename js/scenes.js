// 背景のキャンバス。分野(ワールド)ごとに違う景色が常に動き、ワープ中は星が光の線になる。
// 触った位置・マウス・端末の傾きに反応する。

import { WORLDS } from './data.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン0123456789ABCDEFΣΔλψ∞';

// ---------- 各ワールドの景色 ----------
// init(w, h) で状態を作り、draw(g, t, w, h, s, ctx) で1コマ描く。ctx は { pointer, hue, energy }
const SCENES = {
  ai: {
    init(w, h) {
      const nodes = Array.from({ length: Math.round((w * h) / 26000) + 18 }, () => ({ x: rand(0, w), y: rand(0, h), vx: rand(-0.3, 0.3), vy: rand(-0.3, 0.3) }));
      return { nodes, pulses: [] };
    },
    draw(g, t, w, h, s, c) {
      const { nodes } = s;
      for (const n of nodes) {
        n.x += n.vx * c.energy; n.y += n.vy * c.energy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }
      g.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 170) {
            g.strokeStyle = `hsla(${c.hue} 100% 65% / ${(1 - d / 170) * 0.35})`;
            g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
            if (Math.random() < 0.0015 * c.energy) s.pulses.push({ a, b, k: 0 });
          }
        }
      }
      s.pulses = s.pulses.filter((p) => (p.k += 0.03 * c.energy) < 1);
      for (const p of s.pulses) {
        const x = p.a.x + (p.b.x - p.a.x) * p.k, y = p.a.y + (p.b.y - p.a.y) * p.k;
        glow(g, x, y, 10, `hsla(${c.hue + 40} 100% 75% / 0.9)`);
      }
      for (const n of nodes) {
        const near = Math.hypot(n.x - c.pointer.x, n.y - c.pointer.y) < 140;
        g.fillStyle = `hsla(${c.hue} 100% ${near ? 85 : 65}% / ${near ? 1 : 0.8})`;
        g.beginPath(); g.arc(n.x, n.y, near ? 4.5 : 2.5, 0, TAU); g.fill();
      }
    },
  },
  nlp: {
    init(w) {
      const size = 18;
      return { size, cols: Array.from({ length: Math.ceil(w / size) }, () => ({ y: rand(-800, 0), speed: rand(1.5, 4.5) })) };
    },
    draw(g, t, w, h, s, c) {
      g.font = `${s.size}px "Zen Kaku Gothic New", monospace`;
      s.cols.forEach((col, i) => {
        col.y += col.speed * c.energy;
        if (col.y > h + 400) { col.y = rand(-400, 0); col.speed = rand(1.5, 4.5); }
        for (let k = 0; k < 14; k++) {
          const y = col.y - k * s.size;
          if (y < -s.size || y > h) continue;
          const head = k === 0;
          g.fillStyle = head ? `hsla(${c.hue} 100% 88% / 0.95)` : `hsla(${c.hue} 90% 60% / ${0.5 - k * 0.033})`;
          g.fillText(GLYPHS[(i * 7 + Math.floor(y / s.size) + Math.floor(t / 300)) % GLYPHS.length], i * s.size, y);
        }
      });
    },
  },
  cv: {
    init(w, h) { return { dots: Array.from({ length: 140 }, () => ({ x: rand(0, w), y: rand(0, h), lit: 0 })) }; },
    draw(g, t, w, h, s, c) {
      const cx = w / 2 + (c.pointer.x - w / 2) * 0.08, cy = h / 2 + (c.pointer.y - h / 2) * 0.08;
      const R = Math.max(w, h) * 0.6;
      const ang = (t / 1400) * c.energy;
      for (let r = 60; r < R; r += 70) {
        g.strokeStyle = `hsla(${c.hue} 100% 60% / 0.18)`;
        g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
      }
      const grad = g.createConicGradient ? g.createConicGradient(ang, cx, cy) : null;
      if (grad) {
        grad.addColorStop(0, `hsla(${c.hue} 100% 60% / 0.35)`);
        grad.addColorStop(0.08, `hsla(${c.hue} 100% 60% / 0)`);
        grad.addColorStop(1, `hsla(${c.hue} 100% 60% / 0)`);
        g.fillStyle = grad;
        g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
      }
      for (const d of s.dots) {
        let da = Math.atan2(d.y - cy, d.x - cx) - ang;
        da = ((da % TAU) + TAU) % TAU;
        if (da > TAU - 0.25) d.lit = 1;
        d.lit *= 0.97;
        g.strokeStyle = `hsla(${c.hue + 30} 100% 70% / ${0.15 + d.lit * 0.85})`;
        g.strokeRect(d.x - 6, d.y - 6, 12, 12);
      }
      // 瞳
      glow(g, cx, cy, 70, `hsla(${c.hue} 100% 60% / 0.35)`);
      g.fillStyle = `hsla(${c.hue} 100% 85% / 0.9)`;
      g.beginPath(); g.arc(cx, cy, 9, 0, TAU); g.fill();
    },
  },
  physics: {
    init() { return { parts: Array.from({ length: 70 }, (_, i) => ({ ring: i % 3, a: rand(0, TAU), v: rand(0.006, 0.02) })), bursts: [] }; },
    draw(g, t, w, h, s, c) {
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.42;
      const tilts = [0.35, -0.6, 1.1];
      tilts.forEach((tilt, i) => {
        g.save(); g.translate(cx, cy); g.rotate(tilt + t / 20000);
        g.strokeStyle = `hsla(${c.hue + i * 25} 100% 65% / 0.3)`;
        g.lineWidth = 1.5;
        g.beginPath(); g.ellipse(0, 0, R, R * 0.32, 0, 0, TAU); g.stroke();
        g.restore();
      });
      for (const p of s.parts) {
        p.a += p.v * c.energy;
        const tilt = tilts[p.ring] + t / 20000;
        const ex = Math.cos(p.a) * R, ey = Math.sin(p.a) * R * 0.32;
        const x = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt), y = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt);
        glow(g, x, y, 8, `hsla(${c.hue + p.ring * 25} 100% 75% / 0.9)`);
      }
      if (Math.random() < 0.012 * c.energy) s.bursts.push({ k: 0 });
      s.bursts = s.bursts.filter((b) => (b.k += 0.025) < 1);
      for (const b of s.bursts) {
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * TAU;
          g.strokeStyle = `hsla(${c.hue + 60} 100% 75% / ${1 - b.k})`;
          g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * b.k * R * 0.6, cy + Math.sin(a) * b.k * R * 0.6); g.stroke();
        }
      }
      glow(g, cx, cy, 40, `hsla(${c.hue} 100% 70% / 0.5)`);
    },
  },
  bio: {
    init(w, h) { return { cells: Array.from({ length: 16 }, () => ({ x: rand(0, w), y: rand(0, h), r: rand(14, 46), vx: rand(-0.3, 0.3), vy: rand(-0.3, 0.3) })) }; },
    draw(g, t, w, h, s, c) {
      for (const cell of s.cells) {
        cell.x = (cell.x + cell.vx * c.energy + w) % w; cell.y = (cell.y + cell.vy * c.energy + h) % h;
        g.strokeStyle = `hsla(${c.hue} 70% 60% / 0.35)`;
        g.fillStyle = `hsla(${c.hue} 70% 40% / 0.08)`;
        g.beginPath(); g.arc(cell.x, cell.y, cell.r + Math.sin(t / 600 + cell.r) * 2, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = `hsla(${c.hue + 40} 80% 60% / 0.35)`;
        g.beginPath(); g.arc(cell.x + cell.r * 0.2, cell.y - cell.r * 0.15, cell.r * 0.3, 0, TAU); g.fill();
      }
      // 二重らせん
      const cy = h * 0.5, amp = Math.min(h * 0.18, 120), phase = (t / 900) * c.energy;
      for (let x = -20; x < w + 20; x += 14) {
        const k = x / 70 + phase;
        const y1 = cy + Math.sin(k) * amp, y2 = cy + Math.sin(k + Math.PI) * amp;
        const depth = (Math.cos(k) + 1) / 2;
        if (x % 28 === 0) {
          g.strokeStyle = `hsla(${c.hue + 60} 90% 70% / ${0.15 + depth * 0.25})`;
          g.beginPath(); g.moveTo(x, y1); g.lineTo(x, y2); g.stroke();
        }
        glow(g, x, y1, 4 + depth * 4, `hsla(${c.hue} 100% 70% / ${0.4 + depth * 0.6})`);
        glow(g, x, y2, 4 + (1 - depth) * 4, `hsla(${c.hue + 80} 100% 70% / ${0.4 + (1 - depth) * 0.6})`);
      }
    },
  },
  quantum: {
    init() { return {}; },
    draw(g, t, w, h, s, c) {
      const step = w < 600 ? 22 : 26;
      const s1 = { x: w * 0.3, y: h * 0.45 }, s2 = c.pointer.active ? c.pointer : { x: w * 0.7, y: h * 0.55 };
      const tt = (t / 260) * c.energy;
      for (let y = step / 2; y < h; y += step) {
        for (let x = step / 2; x < w; x += step) {
          const v = Math.sin(Math.hypot(x - s1.x, y - s1.y) / 22 - tt) + Math.sin(Math.hypot(x - s2.x, y - s2.y) / 22 - tt);
          const k = (v + 2) / 4;
          if (k < 0.25) continue;
          g.fillStyle = `hsla(${c.hue + k * 60} 100% ${50 + k * 30}% / ${k * k * 0.85})`;
          g.beginPath(); g.arc(x, y, 1 + k * 3, 0, TAU); g.fill();
        }
      }
    },
  },
  materials: {
    init() {
      const pts = [];
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) pts.push([i, j, k]);
      return { pts };
    },
    draw(g, t, w, h, s, c) {
      const ay = (t / 5000) * c.energy + (c.pointer.x / w - 0.5) * 0.8, ax = 0.5 + (c.pointer.y / h - 0.5) * 0.6;
      const scale = Math.min(w, h) * 0.11, cx = w / 2, cy = h / 2;
      const proj = s.pts.map(([x, y, z]) => {
        const x1 = x * Math.cos(ay) - z * Math.sin(ay), z1 = x * Math.sin(ay) + z * Math.cos(ay);
        const y1 = y * Math.cos(ax) - z1 * Math.sin(ax), z2 = y * Math.sin(ax) + z1 * Math.cos(ax);
        const p = 5 / (5 + z2);
        return { x: cx + x1 * scale * p * 1.6, y: cy + y1 * scale * p * 1.6, d: p, key: [x, y, z] };
      });
      g.lineWidth = 1;
      for (let i = 0; i < proj.length; i++) {
        for (let j = i + 1; j < proj.length; j++) {
          const a = proj[i].key, b = proj[j].key;
          if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) !== 1) continue;
          g.strokeStyle = `hsla(${c.hue} 90% 70% / ${0.08 + proj[i].d * 0.12})`;
          g.beginPath(); g.moveTo(proj[i].x, proj[i].y); g.lineTo(proj[j].x, proj[j].y); g.stroke();
        }
      }
      for (const p of proj) glow(g, p.x, p.y, 3 + p.d * 5, `hsla(${c.hue + 20} 100% 80% / ${0.35 + p.d * 0.5})`);
    },
  },
  energy: {
    init() { return { bolts: [], orbs: Array.from({ length: 6 }, () => ({ a: rand(0, TAU), r: rand(0.15, 0.4) })) }; },
    draw(g, t, w, h, s, c) {
      for (const o of s.orbs) {
        o.a += 0.004 * c.energy;
        const x = w / 2 + Math.cos(o.a) * w * o.r, y = h / 2 + Math.sin(o.a * 1.3) * h * o.r;
        glow(g, x, y, 60, `hsla(${c.hue} 100% 60% / 0.18)`);
      }
      if (Math.random() < 0.035 * c.energy) {
        const sx = rand(0, w), pts = [[sx, -10]];
        let x = sx, y = -10;
        const tx = c.pointer.active && Math.random() < 0.5 ? c.pointer.x : rand(0, w), ty = c.pointer.active ? c.pointer.y : rand(h * 0.5, h);
        while (y < ty) { y += rand(20, 50); x += (tx - x) * 0.15 + rand(-40, 40); pts.push([x, y]); }
        s.bolts.push({ pts, life: 1 });
      }
      s.bolts = s.bolts.filter((b) => (b.life -= 0.06) > 0);
      for (const b of s.bolts) {
        g.strokeStyle = `hsla(${c.hue + 20} 100% 85% / ${b.life})`;
        g.lineWidth = 2.5 * b.life;
        g.shadowColor = `hsl(${c.hue} 100% 60%)`;
        g.shadowBlur = 20;
        g.beginPath();
        b.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.stroke();
        g.shadowBlur = 0;
      }
    },
  },
  other: {
    init(w, h) { return { clouds: Array.from({ length: 7 }, () => ({ x: rand(0, w), y: rand(0, h), r: rand(160, 380), hue: rand(-60, 60), v: rand(-0.15, 0.15) })) }; },
    draw(g, t, w, h, s, c) {
      for (const cl of s.clouds) {
        cl.x = (cl.x + cl.v * c.energy + w + 400) % (w + 400) - 200;
        glow(g, cl.x, cl.y, cl.r, `hsla(${c.hue + cl.hue} 90% 55% / 0.14)`);
      }
    },
  },
};

function glow(g, x, y, r, color) {
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'transparent');
  g.fillStyle = grad;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
}

// ---------- 舞台 ----------
export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.pointer = { x: innerWidth / 2, y: innerHeight / 2, active: false };
    this.tilt = { x: 0, y: 0 };
    this.world = 'other';
    this.prev = null; // 切り替え中の前の景色
    this.mix = 1;
    this.warpLevel = 0; // 0〜1: 星が光の線になる度合い
    this.warpTarget = 0;
    this.states = {};
    this.resize();
    this.stars = Array.from({ length: 260 }, () => this.newStar(true));
    addEventListener('resize', () => { this.resize(); this.states = {}; });
    addEventListener('pointermove', (e) => { this.pointer.x = e.clientX; this.pointer.y = e.clientY; this.pointer.active = true; }, { passive: true });
    addEventListener('deviceorientation', (e) => {
      if (e.gamma == null) return;
      this.tilt.x = Math.max(-1, Math.min(1, e.gamma / 30));
      this.tilt.y = Math.max(-1, Math.min(1, (e.beta - 40) / 30));
    });
  }

  resize() {
    this.w = innerWidth; this.h = innerHeight;
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
  }

  newStar(anywhere) {
    return { x: rand(-1, 1), y: rand(-1, 1), z: anywhere ? rand(0.1, 1) : 1, hue: rand(-40, 40) };
  }

  state(key) {
    if (!this.states[key]) this.states[key] = SCENES[key].init(this.w, this.h);
    return this.states[key];
  }

  setWorld(key) {
    if (!SCENES[key] || key === this.world) return;
    this.prev = this.world;
    this.world = key;
    this.mix = 0;
  }

  // ワープ: level を上げると星が流れ、景色が速く動く
  setWarp(level) { this.warpTarget = level; }

  start() {
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(50, now - last); last = now;
      this.draw(now, dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  draw(t, dt) {
    const { g, w, h } = this;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.warpLevel += (this.warpTarget - this.warpLevel) * 0.06;
    const warp = this.warpLevel;
    // 残像: ワープ中ほど尾を引く
    g.fillStyle = `rgba(4, 3, 14, ${0.35 - warp * 0.25})`;
    g.fillRect(0, 0, w, h);

    const hue = WORLDS[this.world].hue;
    const energy = reduceMotion ? 0.2 : 1 + warp * 6;
    this.drawStars(hue, warp, dt);

    // 景色(切り替え中は前の景色と重ねる)
    const ox = this.tilt.x * 18 + (this.pointer.x / w - 0.5) * -14;
    const oy = this.tilt.y * 18 + (this.pointer.y / h - 0.5) * -14;
    g.save();
    g.translate(ox, oy);
    if (this.mix < 1) {
      this.mix = Math.min(1, this.mix + dt / 900);
      if (this.prev) {
        g.globalAlpha = (1 - this.mix) * (1 - warp * 0.6);
        SCENES[this.prev].draw(g, t, w, h, this.state(this.prev), { pointer: this.pointer, hue: WORLDS[this.prev].hue, energy });
      }
    }
    g.globalAlpha = this.mix * (1 - warp * 0.6);
    SCENES[this.world].draw(g, t, w, h, this.state(this.world), { pointer: this.pointer, hue, energy });
    g.restore();
    g.globalAlpha = 1;

    // 周辺減光
    const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'transparent');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = v;
    g.fillRect(0, 0, w, h);
  }

  drawStars(hue, warp, dt) {
    const { g, w, h } = this;
    const cx = w / 2 + this.tilt.x * 40, cy = h / 2 + this.tilt.y * 40;
    const speed = (reduceMotion ? 0.0002 : 0.0006 + warp * 0.03) * dt;
    const f = Math.max(w, h) * 0.6;
    for (const s of this.stars) {
      const pz = s.z;
      s.z -= speed;
      if (s.z <= 0.02) { Object.assign(s, this.newStar(false)); continue; }
      let x = cx + (s.x / s.z) * f, y = cy + (s.y / s.z) * f;
      // 触った場所の近くの星はよける
      const dx = x - this.pointer.x, dy = y - this.pointer.y, d = Math.hypot(dx, dy);
      if (d < 90 && d > 0) { x += (dx / d) * (90 - d) * 0.5; y += (dy / d) * (90 - d) * 0.5; }
      if (x < -50 || x > w + 50 || y < -50 || y > h + 50) { Object.assign(s, this.newStar(false)); continue; }
      const size = (1 - s.z) * 2.4 + 0.3;
      const light = 60 + (1 - s.z) * 35;
      if (warp > 0.08) {
        const px = cx + (s.x / pz) * f, py = cy + (s.y / pz) * f;
        g.strokeStyle = `hsla(${hue + s.hue} 100% ${light}% / ${0.4 + warp * 0.6})`;
        g.lineWidth = size;
        g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke();
      } else {
        g.fillStyle = `hsla(${hue + s.hue} 80% ${light}% / ${0.5 + (1 - s.z) * 0.5})`;
        g.fillRect(x, y, size, size);
      }
    }
  }
}

export const SCENE_KEYS = Object.keys(SCENES);
