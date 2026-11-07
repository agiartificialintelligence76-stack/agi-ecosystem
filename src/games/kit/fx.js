// AGI arcade kit: the small things that make a game feel good: easing, tweens, particles, screen shake, floating
// numbers, seeded dice, and a few maths and color helpers. All plain JavaScript, no DOM (games draw them on a canvas).
import { REDUCED } from './env.js';

// ---------- maths ----------
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const remap = (v, a, b, c, d) => lerp(c, d, clamp(invLerp(a, b, v), 0, 1));
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
export const TAU = Math.PI * 2;
// frame-rate independent smoothing: move `a` toward `b`, `rate` per second (e.g. 10 = quick)
export const approach = (a, b, rate, dt) => lerp(b, a, Math.exp(-rate * dt));
export const wrap = (v, n) => ((v % n) + n) % n;

// ---------- easing (t in 0..1) ----------
export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  outCubic: (t) => 1 - (1 - t) ** 3,
  inCubic: (t) => t * t * t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outQuart: (t) => 1 - (1 - t) ** 4,
  outExpo: (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t, s = 1.70158) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2,
  outElastic: (t) => (t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
  outBounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

// ---------- tweens: change numbers on an object over time ----------
// const tw = new Tweens(); tw.to(obj, { x: 100, scale: 1 }, 0.3, ease.outBack, { delay, done }); tw.update(dt) each frame
export class Tweens {
  constructor() { this.list = []; }
  to(target, props, dur, fn = ease.outCubic, { delay = 0, done = null } = {}) {
    const from = {};
    for (const k of Object.keys(props)) from[k] = target[k];
    const tw = { target, from, props, dur: Math.max(1e-6, dur), fn, t: -delay, done };
    this.list.push(tw);
    return tw;
  }
  kill(target) { this.list = this.list.filter((t) => t.target !== target); }
  clear() { this.list.length = 0; }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const tw = this.list[i];
      tw.t += dt;
      if (tw.t < 0) continue;
      const k = clamp(tw.t / tw.dur, 0, 1), e = tw.fn(k);
      for (const p of Object.keys(tw.props)) tw.target[p] = lerp(tw.from[p], tw.props[p], e);
      if (k >= 1) { this.list.splice(i, 1); tw.done?.(tw.target); }
    }
  }
}

// ---------- seeded dice (mulberry32): the same seed, the same run ----------
export function rng(seed = (Math.random() * 2 ** 32) >>> 0) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => Math.floor(lo + (hi - lo + 1) * next()),       // lo..hi inclusive
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    sign: () => (next() < 0.5 ? -1 : 1),
    weighted: (items, weightOf = (x) => x.weight) => {
      const total = items.reduce((s, x) => s + weightOf(x), 0);
      let roll = next() * total;
      for (const x of items) { roll -= weightOf(x); if (roll <= 0) return x; }
      return items[items.length - 1];
    },
    shuffle: (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },
    get state() { return a; },
  };
  return r;
}

// ---------- particles: a pool drawn on a 2D canvas ----------
// const parts = new Particles(600); parts.burst({ x, y, count: 24, speed: [80, 260], life: [0.4, 0.9], size: [3, 7],
//   colors: ['#ffc933', '#ff4da6'], gravity: 600, drag: 2, shape: 'circle' | 'square' | 'spark' | 'ring' | 'star' })
// parts.update(dt); parts.draw(ctx)
export class Particles {
  constructor(max = 500) {
    this.max = max;
    this.items = [];
  }
  get count() { return this.items.length; }
  burst({ x, y, count = 16, speed = [60, 240], angle = [0, TAU], life = [0.4, 0.8], size = [2, 6], colors = ['#fff'],
    gravity = 0, drag = 1.5, shape = 'circle', spin = 0, grow = 0, vx = 0, vy = 0, fade = true, stroke = null }) {
    const n = REDUCED ? Math.ceil(count / 3) : count;
    for (let i = 0; i < n; i++) {
      if (this.items.length >= this.max) this.items.shift();
      const a = angle[0] + Math.random() * (angle[1] - angle[0]);
      const sp = speed[0] + Math.random() * (speed[1] - speed[0]);
      const l = life[0] + Math.random() * (life[1] - life[0]);
      this.items.push({
        x, y, vx: Math.cos(a) * sp + vx, vy: Math.sin(a) * sp + vy, life: l, max: l,
        size: size[0] + Math.random() * (size[1] - size[0]), color: colors[(Math.random() * colors.length) | 0],
        gravity, drag, shape, rot: Math.random() * TAU, spin: (Math.random() * 2 - 1) * spin, grow, fade, stroke,
      });
    }
  }
  update(dt) {
    const items = this.items;
    for (let i = items.length - 1; i >= 0; i--) {
      const p = items[i];
      p.life -= dt;
      if (p.life <= 0) { items.splice(i, 1); continue; }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy = p.vy * k + p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.spin * dt;
      p.size = Math.max(0, p.size + p.grow * dt);
    }
  }
  draw(ctx) {
    for (const p of this.items) {
      const t = p.life / p.max;
      ctx.globalAlpha = p.fade ? Math.min(1, t * 1.6) : 1;
      ctx.fillStyle = p.color;
      const s = p.size;
      switch (p.shape) {
        case 'square':
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-s / 2, -s / 2, s, s); ctx.restore(); break;
        case 'spark': {
          const len = Math.hypot(p.vx, p.vy) * 0.045 + s;
          const a = Math.atan2(p.vy, p.vx);
          ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1, s * 0.45); ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.cos(a) * len, p.y - Math.sin(a) * len); ctx.stroke();
          break;
        }
        case 'ring':
          ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1, s * 0.25);
          ctx.beginPath(); ctx.arc(p.x, p.y, s * (1.6 - t), 0, TAU); ctx.stroke(); break;
        case 'star':
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); star(ctx, 0, 0, s, s * 0.45, 5); ctx.fill(); ctx.restore(); break;
        default:
          ctx.beginPath(); ctx.arc(p.x, p.y, s / 2, 0, TAU); ctx.fill();
      }
      if (p.stroke) { ctx.strokeStyle = p.stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  }
  clear() { this.items.length = 0; }
}

export function star(ctx, x, y, outer, inner, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer, a = (i / (points * 2)) * TAU - Math.PI / 2;
    ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

// ---------- screen shake (trauma-based: kick(0.3), decays; nothing with "reduce motion") ----------
export class Shake {
  constructor({ max = 14, decay = 1.6 } = {}) { this.trauma = 0; this.max = max; this.decay = decay; this.t = 0; this.x = 0; this.y = 0; this.r = 0; }
  kick(amount = 0.3) { if (!REDUCED) this.trauma = Math.min(1, this.trauma + amount); }
  update(dt) {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - this.decay * dt);
    const k = this.trauma * this.trauma * this.max;
    this.x = k * (Math.sin(this.t * 61.3) * 0.6 + Math.sin(this.t * 23.7) * 0.4);
    this.y = k * (Math.cos(this.t * 57.1) * 0.6 + Math.cos(this.t * 19.9) * 0.4);
    this.r = k * 0.0018 * Math.sin(this.t * 41.3);
  }
  apply(ctx, cx = 0, cy = 0) {
    if (!this.trauma) return;
    ctx.translate(cx, cy); ctx.rotate(this.r); ctx.translate(-cx + this.x, -cy + this.y);
  }
}

// ---------- floating words and numbers ("+120", "PERFECT", "COMBO ×4") ----------
// const pops = new FloatText(); pops.add({ x, y, text: '+120', color, size: 26, font: 'Anybody' }); update(dt); draw(ctx)
export class FloatText {
  constructor() { this.items = []; }
  add({ x, y, text, color = '#fff', size = 24, life = 0.9, rise = 60, font = "800 1em 'AK Display', system-ui, sans-serif", stroke = '#170a36', strokeWidth = null, scale = 1 }) {
    this.items.push({ x, y, text: String(text), color, size, life, max: life, rise, font, stroke, strokeWidth, scale });
  }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const f = this.items[i];
      f.life -= dt;
      if (f.life <= 0) this.items.splice(i, 1);
    }
  }
  draw(ctx) {
    for (const f of this.items) {
      const t = 1 - f.life / f.max;                         // 0 → 1
      const pop = t < 0.18 ? ease.outBack(t / 0.18) : 1;    // a quick pop in
      const a = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
      const size = f.size * pop * f.scale;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = f.font.replace('1em', `${size}px`);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const y = f.y - ease.outCubic(t) * f.rise;
      if (f.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = f.strokeWidth ?? Math.max(2, size * 0.16); ctx.strokeStyle = f.stroke; ctx.strokeText(f.text, f.x, y); }
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, y);
      ctx.restore();
    }
  }
  clear() { this.items.length = 0; }
}

// ---------- colors ----------
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(lerp(v, B[i], t)));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
export const shade = (hex, amt) => (amt < 0 ? mix(hex, '#000000', -amt) : mix(hex, '#ffffff', amt));

// ---------- the arcade's palette (the site's Pop mode colors) ----------
export const PALETTE = Object.freeze({
  ink: '#170a36', ink2: '#4a3d6e', paper: '#fffaf0', lav: '#e4d9ff', lav2: '#cdb8ff',
  violet: '#6b3bff', violet2: '#8b66ff', violetDeep: '#4a1fd6', pink: '#ff4da6', honey: '#ffc933', mint: '#3ff0c3',
  red: '#ff5a5f', green: '#2fd27a', sky: '#59c8ff', night: '#0f0826',
});

// A rounded rectangle path (every browser: no reliance on ctx.roundRect)
export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// numbers the way the arcade shows them: 12,345 · 1.2M (compact) · 3.4e18 → 3.4Qi (idle games)
const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
export function fmt(n, { compact = false, digits = 1 } = {}) {
  if (!Number.isFinite(n)) return '∞';
  if (!compact || Math.abs(n) < 10000) return Math.round(n).toLocaleString('en-US');
  const e = Math.min(SUFFIX.length - 1, Math.floor(Math.log10(Math.abs(n)) / 3));
  const v = n / 10 ** (e * 3);
  if (e === SUFFIX.length - 1 && Math.abs(v) >= 1000) return n.toExponential(2).replace('+', '');
  return `${v.toFixed(v >= 100 ? 0 : digits).replace(/\.0+$/, '')}${SUFFIX[e]}`;
}
export const fmtTime = (sec) => {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
