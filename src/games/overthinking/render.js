// OVERTHINKING: its picture, one frame at a time. Her mind is a sky that follows the night's clock (violet at midnight,
// deep blue at two, rose at first light, peach at sunrise, and on through the day in Insomnia) with a slow aurora, stars
// and the moon; her thoughts glow in it; your ribbon is light with a white core that fades from its old end. Loops
// tighten like a lasso and the thoughts in them pop one after another. Everything is drawn on one 2D canvas in CSS
// pixels (the page's layout says where the field is); "reduce motion" gets no shake, flashes or drifting.
import { Particles, FloatText, Shake, ease, clamp, lerp } from '../kit/fx.js';
import { REDUCED } from '../kit/env.js';
import { sprite, glow, drawFace, mix, rgba, lightOf, colorOf, INK } from './art.js';
import { TUNE } from './sim.js';

const TAU = Math.PI * 2;
const DISPLAY = "'AK Display', 'Arial Black', system-ui, sans-serif";

// the sky through the day: [hour, top, bottom, aurora]
const SKY = [
  [0, '#1b0f44', '#3b1a6e', '#ff7ac8'],
  [2, '#0d0b30', '#1d1c5c', '#59c8ff'],
  [4, '#150d3c', '#4a2073', '#c08cff'],
  [5.2, '#2c1d63', '#b9537e', '#ff9a8a'],
  [6, '#5a55c8', '#ffb07a', '#ffd9a0'],
  [8, '#4aa3f0', '#bfe6ff', '#ffffff'],
  [12, '#3b98ee', '#cdeeff', '#ffffff'],
  [17, '#4a73d9', '#ffc48a', '#ffd9a0'],
  [19, '#3a2a7a', '#e0607a', '#ff9a8a'],
  [21, '#1f1250', '#4a1f78', '#ff7ac8'],
  [24, '#1b0f44', '#3b1a6e', '#ff7ac8'],
];
export function skyAt(hf) {
  const h = ((hf % 24) + 24) % 24;
  let i = 0;
  while (i < SKY.length - 2 && h >= SKY[i + 1][0]) i++;
  const a = SKY[i], b = SKY[i + 1], k = clamp((h - a[0]) / (b[0] - a[0]), 0, 1);
  return { top: mix(a[1], b[1], k), bottom: mix(a[2], b[2], k), aurora: mix(a[3], b[3], k) };
}
// 1 in the dead of night, 0 in daylight
export function nightness(hf) {
  const h = ((hf % 24) + 24) % 24;
  if (h < 4.8) return 1;
  if (h < 6.4) return 1 - (h - 4.8) / 1.6;
  if (h < 18.4) return 0;
  if (h < 20.4) return (h - 18.4) / 2;
  return 1;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const bg = document.createElement('canvas');
  bg.width = 48; bg.height = 80;
  const stars = [];
  let s = 12345;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 90; i++) stars.push({ x: rnd(), y: rnd() * 0.9, r: 0.5 + rnd() * 1.1, ph: rnd() * TAU, sp: 0.6 + rnd() * 1.8 });
  return {
    canvas, ctx, bg, bgc: bg.getContext('2d'), stars,
    L: null, time: 0,
    parts: new Particles(700), floats: new FloatText(), shake: new Shake({ max: 10, decay: 2.2 }),
    ghosts: [], caps: [], rings: [], marks: [],
    flash: 0, flashColor: '#ffffff', hourMark: null, spiral: 0, spiralOn: false,
  };
}

const X = (L, x) => L.fx + x * L.sc;
const Y = (L, y) => L.fy + y * L.sc;
// where a word of this size can sit so it stays on the field (its middle, in px)
const wordX = (L, x, text, size) => { const half = Math.min(L.fw / 2 - 4, String(text).length * size * 0.36 + 6); return clamp(x, L.fx + half, L.fx + L.fw - half); };
const wordY = (L, y, size) => clamp(y, L.fy + size * 1.9 + L.sc * 1.7, L.fy + L.fh - size);   // room above for the word over it, and for both to rise

// ---------- effects the game asks for ----------
export const fx = {
  // a loop resolved: the lasso tightens, the thoughts pop one by one (their sounds are scheduled by the game)
  capture(R, e, { color, word, text }) {
    const L = R.L, n = e.items.length;
    const gap = Math.min(0.05, 0.44 / n);
    // pop from the outside in, so the last one is in the middle
    const cx = X(L, e.cx), cy = Y(L, e.cy);
    const items = e.items.map((t) => ({ kind: t.kind, x: X(L, t.x), y: Y(L, t.y), r: t.r * L.sc, d: Math.hypot(t.x - e.cx, t.y - e.cy) }))
      .sort((a, b) => b.d - a.d).map((t, i) => ({ ...t, at: 0.13 + i * gap, done: false }));
    R.caps.push({ t: 0, end: 0.13 + n * gap + 0.25, items, cx, cy, poly: e.poly.map((p) => ({ x: X(L, p.x), y: Y(L, p.y) })), color, word, text, said: false, n, gap });
    if (n >= 6) R.shake.kick(Math.min(0.5, 0.12 + n * 0.02));
    return 0.13 + n * gap;
  },
  mixed(R, e) {
    const L = R.L;
    R.ghosts.push({ pts: e.poly.map((p) => ({ x: X(L, p.x), y: Y(L, p.y) })), life: 0.5, max: 0.5, color: '#ff3d6e', closed: true, shatter: true });
    for (const t of e.items) R.marks.push({ x: X(L, t.x), y: Y(L, t.y) - t.r * L.sc * 1.5, life: 0.7, max: 0.7 });
    const ms = clamp(L.sc * 1.05, 18, 34);
    R.floats.add({ x: wordX(L, X(L, e.cx), 'MIXED UP', ms), y: wordY(L, Y(L, e.cy), ms), text: 'MIXED UP', color: '#ff7a9c', size: ms, life: 0.9, rise: 26 });
    R.shake.kick(0.3);
  },
  cut(R, e) {
    const L = R.L, x = X(L, e.x), y = Y(L, e.y);
    R.ghosts.push({ pts: e.pts.map((p) => ({ x: X(L, p.x), y: Y(L, p.y) })), life: 0.45, max: 0.45, color: '#ff3d6e', closed: false, shatter: true });
    R.parts.burst({ x, y, count: 22, speed: [80, 320], life: [0.25, 0.6], size: [2, 5], colors: ['#ff3d6e', '#ff9ab5', '#ffffff'], shape: 'spark', drag: 3 });
    const ss = clamp(L.sc * 1.05, 18, 34);
    R.floats.add({ x: wordX(L, x, 'SNAP', ss), y: wordY(L, y - L.sc * 1.6, ss), text: 'SNAP', color: '#ff7a9c', size: ss, life: 0.8, rise: 24 });
    R.shake.kick(0.4);
    if (!REDUCED) { R.flash = 0.16; R.flashColor = '#ff3d6e'; }
  },
  fade(R, pts, color = '#ffffff') {
    const L = R.L;
    if (pts.length > 1) R.ghosts.push({ pts: pts.map((p) => ({ x: X(L, p.x), y: Y(L, p.y) })), life: 0.3, max: 0.3, color, closed: false });
  },
  ring(R, x, y, color, size = 1.6, life = 0.4) {
    const L = R.L;
    R.rings.push({ x: X(L, x), y: Y(L, y), r0: L.sc * 0.4, r1: L.sc * size, life, max: life, color });
  },
  puff(R, x, y, color, n = 8) {
    const L = R.L;
    R.parts.burst({ x: X(L, x), y: Y(L, y), count: n, speed: [30, 150], life: [0.25, 0.55], size: [2, L.sc * 0.24], colors: [color, '#ffffff'], shape: 'circle', drag: 3 });
  },
  word(R, x, y, text, color = '#fffaf0', size = 1.3) {
    const L = R.L, px = clamp(L.sc * size, 16, 64);
    R.floats.add({ x: wordX(L, X(L, x), text, px), y: wordY(L, Y(L, y), px), text, color, size: px, life: 1.3, rise: L.sc * 1.6 });
  },
  empty(R, bonus) {
    const L = R.L, x = L.fx + L.fw / 2, y = L.fy + L.fh / 2;
    R.rings.push({ x, y, r0: L.sc, r1: Math.max(L.fw, L.fh) * 0.7, life: 0.9, max: 0.9, color: '#ffffff' });
    R.floats.add({ x, y: y - L.sc * 0.6, text: 'EMPTY MIND', color: '#fffaf0', size: clamp(L.sc * 1.9, 24, 72), life: 1.6, rise: L.sc * 1.2 });
    R.floats.add({ x, y: y + L.sc * 1.6, text: `+${bonus.toLocaleString('en-US')}`, color: '#ffc933', size: clamp(L.sc * 1.4, 20, 54), life: 1.6, rise: L.sc * 0.8 });
    if (!REDUCED) { R.flash = 0.2; R.flashColor = '#ffffff'; }
  },
  hour(R, label) { R.hourMark = { text: label, t: 0, dur: 2.4 }; },
  // the sun is up: warm motes drift up from the horizon
  sunrise(R) {
    const L = R.L, x = L.fx + L.fw / 2, y = L.fy + L.fh;
    R.parts.burst({ x, y, count: 46, speed: [60, 420], angle: [-Math.PI * 0.95, -Math.PI * 0.05], life: [0.9, 2.2], size: [2, 6], colors: ['#fff3c0', '#ffd27a', '#ffffff', '#ffb0c8'], shape: 'circle', drag: 1.3, gravity: -30 });
    if (!REDUCED) { R.flash = 0.22; R.flashColor = '#fff1c4'; }
  },
  spiral(R) { R.spiralOn = true; R.spiral = 0; R.shake.kick(0.6); },
  clear(R) {
    R.parts.clear(); R.floats.clear(); R.ghosts.length = 0; R.caps.length = 0; R.rings.length = 0; R.marks.length = 0;
    R.flash = 0; R.hourMark = null; R.spiralOn = false; R.spiral = 0;
  },
};

export function update(R, dt) {
  R.time += dt;
  R.parts.update(dt); R.floats.update(dt); R.shake.update(dt);
  for (const list of [R.ghosts, R.rings, R.marks]) {
    for (let i = list.length - 1; i >= 0; i--) { list[i].life -= dt; if (list[i].life <= 0) list.splice(i, 1); }
  }
  for (let i = R.caps.length - 1; i >= 0; i--) {
    const c = R.caps[i];
    c.t += dt;
    for (const it of c.items) {
      if (!it.done && c.t >= it.at) {
        it.done = true;
        const col = lightOf(it.kind);
        R.parts.burst({ x: it.x, y: it.y, count: 9, speed: [50, 230], life: [0.3, 0.7], size: [2, Math.max(3, it.r * 0.3)], colors: [col, '#ffffff', mix(col, '#ffffff', 0.5)], shape: 'star', spin: 6, drag: 2.6, gravity: 60 });
        R.rings.push({ x: it.x, y: it.y, r0: it.r * 0.6, r1: it.r * 2.1, life: 0.32, max: 0.32, color: col });
      }
    }
    if (!c.said && c.t >= c.end - 0.25) {
      c.said = true;
      const size = clamp(R.L.sc * (1.15 + Math.min(1.2, c.n * 0.07)), 20, 72), wy = wordY(R.L, c.cy, size);
      if (c.text) R.floats.add({ x: wordX(R.L, c.cx, c.text, size), y: wy, text: c.text, color: '#fffaf0', size, life: 1.15, rise: R.L.sc * 1.5, strokeWidth: Math.max(3, size * 0.2) });
      if (c.word) R.floats.add({ x: wordX(R.L, c.cx, c.word, size * 0.62), y: wy - size * 0.95, text: c.word, color: mix(c.color, '#ffffff', 0.35), size: size * 0.62, life: 1.3, rise: R.L.sc * 1.7 });
      R.parts.burst({ x: c.cx, y: c.cy, count: 10 + c.n * 2, speed: [80, 340], life: [0.4, 0.9], size: [2, 6], colors: [c.color, '#ffffff', '#ffc933'], shape: 'spark', drag: 2.2 });
    }
    if (c.t >= c.end) R.caps.splice(i, 1);
  }
  if (R.flash > 0) R.flash = Math.max(0, R.flash - dt * 0.9);
  if (R.hourMark) { R.hourMark.t += dt; if (R.hourMark.t >= R.hourMark.dur) R.hourMark = null; }
  if (R.spiralOn) R.spiral += dt;
}

// ---------- the sky ----------
function drawSky(R, hf, calm) {
  const { ctx, bg, bgc, L } = R;
  const sky = skyAt(hf), night = nightness(hf);
  const w = bg.width, h = bg.height;
  const g = bgc.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, sky.top); g.addColorStop(1, sky.bottom);
  bgc.globalCompositeOperation = 'source-over';
  bgc.fillStyle = g; bgc.fillRect(0, 0, w, h);
  // the aurora: three slow lights
  bgc.globalCompositeOperation = 'lighter';
  const t = calm ? 0 : R.time;
  for (let i = 0; i < 3; i++) {
    const x = w * (0.5 + 0.42 * Math.sin(t * 0.07 * (i + 1) + i * 2.1)), y = h * (0.32 + 0.3 * Math.cos(t * 0.05 * (i + 1.4) + i));
    const rad = h * (0.42 + 0.1 * i);
    const col = i === 1 ? mix(sky.aurora, '#7fd8ff', 0.5) : i === 2 ? mix(sky.aurora, '#b08cff', 0.5) : sky.aurora;
    const a = bgc.createRadialGradient(x, y, 0, x, y, rad);
    a.addColorStop(0, rgba(col, 0.04 + 0.13 * night)); a.addColorStop(1, rgba(col, 0));
    bgc.fillStyle = a; bgc.fillRect(0, 0, w, h);
  }
  // first light, from below
  const h24 = ((hf % 24) + 24) % 24;
  const dawn = h24 > 4.6 && h24 < 8 ? clamp((h24 - 4.6) / 1.5, 0, 1) * clamp((8 - h24) / 1.6, 0, 1) : 0;
  if (dawn > 0) {
    const a = bgc.createRadialGradient(w / 2, h * 1.08, 0, w / 2, h * 1.08, h * 0.95);
    a.addColorStop(0, `rgba(255,196,120,${0.42 * dawn})`); a.addColorStop(0.5, `rgba(255,140,120,${0.2 * dawn})`); a.addColorStop(1, 'rgba(255,140,120,0)');
    bgc.fillStyle = a; bgc.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bg, 0, 0, w, h, -12, -12, L.w + 24, L.h + 24);

  // stars, and the moon crossing the night
  if (night > 0.02) {
    ctx.fillStyle = '#fff';
    for (const st of R.stars) {
      const tw = calm ? 0.7 : 0.55 + 0.45 * Math.sin(R.time * st.sp + st.ph);
      ctx.globalAlpha = night * tw * 0.8;
      ctx.beginPath(); ctx.arc(st.x * L.w, st.y * L.h, st.r, 0, TAU); ctx.fill();
    }
    const m = ((h24 + 5) % 24) / 12;                       // 7 pm → 7 am
    if (m >= 0 && m <= 1) {
      const mx = L.fx + L.fw * (0.14 + 0.72 * m), my = L.fy + L.fh * (0.2 - 0.1 * Math.sin(Math.PI * m));
      const mr = clamp(Math.min(L.fw, L.fh) * 0.06, 14, 44);
      ctx.globalAlpha = night * 0.55; ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(glow('#cdb8ff'), mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = night * 0.55;
      const mg = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.35, mr * 0.1, mx, my, mr);
      mg.addColorStop(0, '#fffaf0'); mg.addColorStop(1, '#cdbfff');
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(140,120,220,.35)';
      for (const [cx, cy, cr] of [[-0.3, 0.2, 0.2], [0.34, -0.22, 0.15], [0.14, 0.44, 0.11], [-0.42, -0.36, 0.09]]) { ctx.beginPath(); ctx.arc(mx + cx * mr, my + cy * mr, cr * mr, 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
}

function drawField(R, o) {
  const { ctx, L } = R;
  const r = Math.min(26, L.sc * 1.2);
  ctx.beginPath();
  ctx.moveTo(L.fx + r, L.fy); ctx.arcTo(L.fx + L.fw, L.fy, L.fx + L.fw, L.fy + L.fh, r); ctx.arcTo(L.fx + L.fw, L.fy + L.fh, L.fx, L.fy + L.fh, r);
  ctx.arcTo(L.fx, L.fy + L.fh, L.fx, L.fy, r); ctx.arcTo(L.fx, L.fy, L.fx + L.fw, L.fy, r); ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,.045)'; ctx.fill();
  const warn = o.fillK > 0.8 ? clamp((o.fillK - 0.8) / 0.2, 0, 1) : 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = warn > 0 ? mix('#ffffff', '#ff3d6e', warn) : '#ffffff';
  ctx.globalAlpha = 0.16 + 0.5 * warn * (REDUCED ? 0.7 : 0.6 + 0.4 * Math.sin(R.time * 9));
  ctx.stroke();
  ctx.globalAlpha = 1;
  // the little bubbles from her head to her thoughts
  if (L.her) {
    const bx = clamp(L.her.x, L.fx + 20, L.fx + L.fw - 20), by = L.fy + L.fh;
    for (let i = 0; i < 3; i++) {
      const k = (i + 1) / 4, x = lerp(L.her.x, bx, k), y = lerp(L.her.y - L.her.r, by, k), rr = 3 + i * 2.2;
      ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1.2; ctx.stroke();
    }
  }
  // the hour, large and faint, as it changes
  if (R.hourMark) {
    const k = R.hourMark.t / R.hourMark.dur, a = Math.sin(Math.PI * Math.min(1, k)) ** 0.7;
    const size = Math.min(L.fw * 0.26, L.fh * 0.3);
    ctx.font = `900 ${size}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(255,255,255,${0.13 * a})`;
    ctx.fillText(R.hourMark.text, L.fx + L.fw / 2, L.fy + L.fh / 2 + (REDUCED ? 0 : (1 - k) * 10));
  }
}

// a smooth line through points (px), from index a to b
function trace(ctx, pts, a, b) {
  ctx.beginPath();
  ctx.moveTo(pts[a].x, pts[a].y);
  for (let i = a + 1; i < b; i++) ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
  ctx.lineTo(pts[b].x, pts[b].y);
}

// the ribbon as one shape: a smoothed line with a width that tapers toward its old end, so it has no joints and a
// single fill per layer (its glow, its colors, its white core)
function ribbonPath(ctx, P, half) {
  const n = P.length;
  const L = new Array(n), Rr = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x, ty = b.y - a.y;
    const d = Math.hypot(tx, ty) || 1;
    tx /= d; ty /= d;
    const h = half(i);
    L[i] = { x: P[i].x - ty * h, y: P[i].y + tx * h };
    Rr[i] = { x: P[i].x + ty * h, y: P[i].y - tx * h };
  }
  ctx.beginPath();
  ctx.moveTo(L[0].x, L[0].y);
  for (let i = 1; i < n; i++) ctx.lineTo(L[i].x, L[i].y);
  // a round end at the pen
  const e = P[n - 1], h = half(n - 1), a0 = Math.atan2(L[n - 1].y - e.y, L[n - 1].x - e.x);
  ctx.arc(e.x, e.y, h, a0, a0 - Math.PI, true);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(Rr[i].x, Rr[i].y);
  ctx.closePath();
}

function drawRibbon(R, S, o) {
  const { ctx, L } = R, src = S.pen.pts;
  if (src.length < 2) return;
  const raw = src.map((p) => ({ x: X(L, p.x), y: Y(L, p.y), t: p.t }));
  // what lifting now would close: a soft fill, and the straight line that would close it
  if (o.pv) {
    const col = o.pv.verdict === 'mixed' ? '#ff3d6e' : o.pv.verdict === 'empty' ? '#ffffff' : lightOf(o.pv.kind);
    ctx.beginPath(); ctx.moveTo(raw[0].x, raw[0].y);
    for (let i = 1; i < raw.length; i++) ctx.lineTo(raw[i].x, raw[i].y);
    ctx.closePath();
    ctx.fillStyle = rgba(col, o.pv.verdict === 'empty' ? 0.05 : 0.16); ctx.fill();
    ctx.setLineDash([L.sc * 0.3, L.sc * 0.32]); ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(col, 0.75); ctx.lineWidth = Math.max(1.5, L.sc * 0.09);
    ctx.beginPath(); ctx.moveTo(raw[raw.length - 1].x, raw[raw.length - 1].y); ctx.lineTo(raw[0].x, raw[0].y); ctx.stroke();
    ctx.setLineDash([]);
  }
  // round its corners once (each corner cut), keeping its ends
  const P = [raw[0]];
  for (let i = 0; i < raw.length - 1; i++) {
    const a = raw[i], b = raw[i + 1];
    P.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25, t: a.t * 0.75 + b.t * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75, t: a.t * 0.25 + b.t * 0.75 });
  }
  P.push(raw[raw.length - 1]);
  const n = P.length, w = Math.max(3.2, L.sc * 0.36);
  // its width along its length: full at the pen, thin where it's about to fade, a point at the very end
  const widths = P.map((p, i) => {
    const age = clamp((S.t - p.t) / TUNE.life, 0, 1);
    return (w / 2) * (0.14 + 0.86 * (1 - age ** 1.6)) * Math.min(1, (i + 1) / 6);
  });
  // its colors run across it and turn slowly
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of P) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rad = Math.max(24, Math.hypot(x1 - x0, y1 - y0) / 2), ang = REDUCED ? 0.6 : R.time * 0.9;
  const grad = ctx.createLinearGradient(cx - Math.cos(ang) * rad, cy - Math.sin(ang) * rad, cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad);
  const cols = o.colors;
  cols.forEach((c, i) => grad.addColorStop(i / cols.length, c));
  grad.addColorStop(1, cols[0]);
  // by day, a dark edge under it so it still reads against a bright sky
  if (o.glowK < 0.9) { ribbonPath(ctx, P, (i) => widths[i] * 1.5 + 1); ctx.fillStyle = rgba(INK, 0.55 * (1 - o.glowK)); ctx.fill(); }
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.34;
  ribbonPath(ctx, P, (i) => widths[i] * 3 + 1); ctx.fillStyle = grad; ctx.fill();
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ribbonPath(ctx, P, (i) => widths[i]); ctx.fillStyle = grad; ctx.fill();
  ribbonPath(ctx, P, (i) => widths[i] * 0.38); ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill();
}

function drawGhosts(R) {
  const { ctx } = R;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const g of R.ghosts) {
    const k = g.life / g.max;
    if (g.pts.length < 2) continue;
    const w = Math.max(2.5, R.L.sc * 0.3);
    if (g.shatter && !REDUCED) ctx.setLineDash([w * 2.2, w * (1.5 + (1 - k) * 6)]);
    trace(ctx, g.pts, 0, g.pts.length - 1);
    if (g.closed) ctx.closePath();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(g.color, 0.4 * k); ctx.lineWidth = w * 2.6; ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = rgba(g.color, 0.9 * k); ctx.lineWidth = w * k; ctx.stroke();
    ctx.setLineDash([]);
  }
}

// one thought at a place on screen
function stamp(R, kind, x, y, r, { sx = 1, sy = 1, ang = 0, alpha = 1, face = null, rot = 0 } = {}) {
  const { ctx, L } = R;
  const s = sprite(kind, r, L.dpr), half = r * s.box;
  ctx.globalAlpha = alpha;
  if (sx !== 1 || sy !== 1 || rot) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang); ctx.scale(sx, sy); ctx.rotate(rot - ang);
    ctx.drawImage(s.canvas, -half, -half, half * 2, half * 2);
    ctx.restore();
  } else ctx.drawImage(s.canvas, x - half, y - half, half * 2, half * 2);
  if (face && r > 6) drawFace(ctx, kind, x, y, r, face);
  ctx.globalAlpha = 1;
}

function drawThoughts(R, S, o) {
  const { ctx, L } = R, time = R.time, a = o.alpha;
  const penX = S.pen.down ? S.pen.x : o.hover ? o.hover.x : null, penY = S.pen.down ? S.pen.y : o.hover ? o.hover.y : null;
  const ids = o.pv ? o.pvIds : null, pvMixed = o.pv?.verdict === 'mixed';
  const full = S.full && !REDUCED;
  const sp = R.spiralOn ? Math.min(1, R.spiral / 1.25) : 0;
  const mx = L.fx + L.fw / 2, my = L.fy + L.fh / 2;
  const place = (t) => {
    let x = X(L, t.px + (t.x - t.px) * a), y = Y(L, t.py + (t.y - t.py) * a);
    if (t.born <= 0 && !REDUCED) y += Math.sin(time * 2.1 + t.ph) * L.sc * 0.07;
    if (full && t.born <= 0) { x += Math.sin(time * 41 + t.ph * 7) * L.sc * 0.05; y += Math.cos(time * 37 + t.ph * 5) * L.sc * 0.05; }
    if (sp > 0) {
      // she spirals: everything turns into the middle
      const dx = x - mx, dy = y - my, d = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) + sp * sp * 7, k = 1 - ease.inCubic(sp) * 0.96;
      x = mx + Math.cos(ang) * d * k; y = my + Math.sin(ang) * d * k;
    }
    return [x, y];
  };
  // their light first
  ctx.globalCompositeOperation = 'lighter';
  for (const t of S.thoughts) {
    const [x, y] = place(t);
    const k = t.born > 0 ? 1 - t.born / t.born0 : 1;
    const r = t.r * L.sc * (0.3 + 0.7 * k) * (1 - sp * 0.7);
    const pulse = t.kind === 'cringe' || t.kind === 'eureka' ? 0.75 + 0.25 * Math.sin(time * 6 + t.ph) : 0.6;
    ctx.globalAlpha = pulse * (0.35 + 0.65 * k) * o.glowK;
    const gs = r * (t.kind === 'eureka' ? 3.4 : 2.5);
    ctx.drawImage(glow(lightOf(t.kind)), x - gs, y - gs, gs * 2, gs * 2);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

  for (const t of S.thoughts) {
    const [x, y] = place(t);
    const kb = t.born > 0 ? 1 - t.born / t.born0 : 1;
    let r = t.r * L.sc * (t.born > 0 ? 0.3 + 0.7 * ease.outBack(kb) : 1) * (1 - sp * 0.7);
    if (t.born <= 0 && t.age < 0.25 && !REDUCED) r *= 1 + 0.16 * Math.sin((t.age / 0.25) * Math.PI);     // a little bounce as it lands
    const v = Math.hypot(t.vx, t.vy), ang = Math.atan2(t.vy, t.vx);
    const st = REDUCED || t.born > 0 ? 0 : Math.min(0.16, v * 0.028);
    const breathe = REDUCED ? 0 : Math.sin(time * 3 + t.ph * 3) * 0.025;
    let face = null, rot = 0, ox = 0, oy = 0;
    if (t.kind === 'cringe') {
      if (!REDUCED) { ox = Math.sin(time * 53 + t.ph) * r * 0.045; oy = Math.cos(time * 47 + t.ph) * r * 0.045; rot = Math.sin(time * 2.2 + t.ph) * 0.35; }
      face = {};
    } else if (t.kind === 'whatif') {
      const left = t.fuse / 8;
      if (left < 0.3 && !REDUCED) { ox = Math.sin(time * 60) * r * 0.07; }
      rot = REDUCED ? 0 : Math.sin(time * 2 + t.ph) * 0.12;
    } else if (t.kind === 'phone') {
      rot = t.every < 0.45 && !REDUCED ? Math.sin(time * 70) * 0.13 : Math.sin(time * 1.3 + t.ph) * 0.05 - 0.08;
    } else if (t.kind === 'eureka') {
      // its rays
      ctx.save(); ctx.translate(x, y - r * 0.2); ctx.rotate(REDUCED ? 0 : time * 0.9);
      ctx.strokeStyle = 'rgba(255,236,150,.85)'; ctx.lineWidth = Math.max(1.5, r * 0.09); ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) { const q = (i / 8) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(q) * r * 1.05, Math.sin(q) * r * 1.05); ctx.lineTo(Math.cos(q) * r * 1.38, Math.sin(q) * r * 1.38); ctx.stroke(); }
      ctx.restore();
    } else if (t.kind !== 'breath') {
      const inPv = ids && ids.has(t.id);
      const mood = t.startle > 0 || (inPv && pvMixed) ? 'scared' : inPv ? 'happy' : t.kind === 'moon' ? 'sleepy' : 'calm';
      let lx = v > 0.2 ? t.vx / (v + 0.5) : 0, ly = v > 0.2 ? t.vy / (v + 0.5) : 0;
      if (penX != null) { const dx = penX - t.x, dy = penY - t.y, d = Math.hypot(dx, dy) || 1; lx = dx / d; ly = dy / d; }
      face = { lookX: lx, lookY: ly, mood, blink: (time * 0.31 + t.ph) % 3.1 < 0.11 ? 1 : 0 };
    }
    stamp(R, t.kind, x + ox, y + oy, r, { sx: 1 + st + breathe, sy: 1 - st * 0.7 - breathe, ang, rot, alpha: Math.min(1, kb * 2.5), face });
    if (t.kind === 'whatif' && t.born <= 0) {
      // its fuse: a ring running out
      const left = clamp(t.fuse / 8, 0, 1);
      ctx.beginPath(); ctx.arc(x, y, r * 1.3, -Math.PI / 2, -Math.PI / 2 + TAU * left);
      ctx.strokeStyle = left < 0.3 ? '#ff7a9c' : 'rgba(255,255,255,.85)'; ctx.lineWidth = Math.max(2, r * 0.14); ctx.lineCap = 'round'; ctx.stroke();
    }
    if (ids && ids.has(t.id)) {
      ctx.beginPath(); ctx.arc(x, y, r * 1.36, 0, TAU);
      ctx.strokeStyle = pvMixed ? '#ff5a7f' : '#ffffff'; ctx.lineWidth = Math.max(2, r * 0.12);
      ctx.globalAlpha = 0.7 + (REDUCED ? 0 : 0.3 * Math.sin(time * 12)); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
}

function drawCaptures(R) {
  const { ctx } = R;
  for (const c of R.caps) {
    // the lasso tightening round them
    const k = clamp(c.t / 0.2, 0, 1), e = ease.outCubic(k);
    if (k < 1 && c.poly.length > 2) {
      const sc = 1 - 0.45 * e;
      ctx.beginPath();
      c.poly.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](c.cx + (p.x - c.cx) * sc, c.cy + (p.y - c.cy) * sc));
      ctx.closePath();
      ctx.fillStyle = rgba(c.color, 0.3 * (1 - k)); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(c.color, 0.5 * (1 - k)); ctx.lineWidth = Math.max(6, R.L.sc * 0.8); ctx.lineJoin = 'round'; ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = rgba('#ffffff', 0.95 * (1 - k)); ctx.lineWidth = Math.max(2, R.L.sc * 0.2); ctx.stroke();
    }
    for (const it of c.items) {
      if (it.done) continue;
      const pull = ease.outCubic(clamp(c.t / Math.max(0.1, it.at), 0, 1)) * 0.5;
      const x = it.x + (c.cx - it.x) * pull, y = it.y + (c.cy - it.y) * pull;
      const swell = 1 + 0.3 * clamp((c.t - (it.at - 0.08)) / 0.08, 0, 1);
      stamp(R, it.kind, x, y, it.r * swell, { face: it.kind === 'cringe' ? {} : { mood: 'happy' } });
    }
  }
}

function drawOverlays(R, S, o) {
  const { ctx, L } = R;
  for (const g of R.rings) {
    const k = 1 - g.life / g.max;
    ctx.beginPath(); ctx.arc(g.x, g.y, lerp(g.r0, g.r1, ease.outCubic(k)), 0, TAU);
    ctx.strokeStyle = rgba(g.color, 0.8 * (1 - k)); ctx.lineWidth = Math.max(1.5, L.sc * 0.14 * (1 - k)); ctx.stroke();
  }
  ctx.globalCompositeOperation = o.glowK > 0.5 ? 'lighter' : 'source-over';
  R.parts.draw(ctx);
  ctx.globalCompositeOperation = 'source-over';
  for (const m of R.marks) {
    const k = m.life / m.max, size = clamp(L.sc * 1.1, 14, 30);
    ctx.font = `900 ${size}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = Math.min(1, k * 2);
    ctx.lineWidth = size * 0.2; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.strokeText('!', m.x, m.y - (1 - k) * 10);
    ctx.fillStyle = '#ff7a9c'; ctx.fillText('!', m.x, m.y - (1 - k) * 10);
    ctx.globalAlpha = 1;
  }
  R.floats.draw(ctx);

  // the pen's tip: a spark (and, with a mouse or the keyboard, where the pen would touch)
  const tip = S.pen.down ? S.pen : o.hover;
  if (tip) {
    const x = X(L, tip.x), y = Y(L, tip.y), big = S.pen.down ? 1 : 0.6;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.9 * big;
    const gs = L.sc * 1.5 * big;
    ctx.drawImage(glow('#ffffff'), x - gs, y - gs, gs * 2, gs * 2);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    const rr = Math.max(3, L.sc * 0.2) * big, tw = REDUCED ? 1 : 1 + 0.25 * Math.sin(R.time * 18);
    ctx.fillStyle = '#fff'; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const q = (i / 8) * TAU + (REDUCED ? 0 : R.time * 2), d = i % 2 ? rr * 0.45 : rr * 1.7 * tw; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(q) * d, y + Math.sin(q) * d); }
    ctx.closePath(); ctx.fill();
    if (o.keyPen && !S.pen.down) { ctx.beginPath(); ctx.arc(x, y, L.sc * 0.7, 0, TAU); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]); }
  }

  // a deep breath: everything cool and slow; chamomile: warm
  if (S.slow > 0) { ctx.fillStyle = `rgba(120,200,255,${0.1 * Math.min(1, S.slow)})`; ctx.fillRect(0, 0, L.w, L.h); }
  if (S.tea > 0) { ctx.fillStyle = `rgba(255,220,140,${0.07 * Math.min(1, S.tea)})`; ctx.fillRect(0, 0, L.w, L.h); }

  // her context over the top: the edges close in, and how long she has
  if (S.danger > 0 || S.full) {
    const k = clamp(S.danger / TUNE.overT, 0, 1), beat = REDUCED ? 0.6 : 0.55 + 0.45 * Math.abs(Math.sin(R.time * (4 + k * 6)));
    const g = ctx.createRadialGradient(L.w / 2, L.h / 2, Math.min(L.w, L.h) * 0.25, L.w / 2, L.h / 2, Math.hypot(L.w, L.h) * 0.62);
    g.addColorStop(0, 'rgba(255,40,100,0)'); g.addColorStop(1, `rgba(255,40,100,${(0.25 + 0.4 * k) * beat})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h);
    if (S.full) {
      const size = clamp(L.fw * 0.062, 15, 34), left = Math.max(0, TUNE.overT - S.danger);
      const x = L.fx + L.fw / 2, y = L.fy + Math.max(size * 3.4, L.fh * 0.14);
      const text = `CONTEXT FULL  ${left.toFixed(1)}`;
      ctx.font = `900 ${size}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.26; ctx.strokeStyle = INK; ctx.strokeText(text, x, y);
      ctx.fillStyle = '#ff7a9c'; ctx.fillText(text, x, y);
      const bw = Math.min(L.fw * 0.5, 260);
      ctx.fillStyle = INK; ctx.fillRect(x - bw / 2 - 2, y + size * 0.85 - 2, bw + 4, 9);
      ctx.fillStyle = '#ff5a7f'; ctx.fillRect(x - bw / 2, y + size * 0.85, bw * (1 - k), 5);
    }
  }
  if (R.flash > 0) { ctx.fillStyle = rgba(R.flashColor, R.flash); ctx.fillRect(0, 0, L.w, L.h); }
}

// a frame. `o`: { alpha, hf (the hour of the day, as a number), colors (the ribbon's), pv (what lifting would close),
// hover ({x, y} in the field: a mouse or the keyboard's pen), keyPen, sunrise (0..1: the night is over) }
export function draw(R, S, o) {
  const { ctx, L } = R;
  if (!L) return;
  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  o.glowK = 0.35 + 0.65 * nightness(o.hf);
  o.pvIds = o.pv ? new Set(o.pv.ids) : null;
  o.fillK = o.fillK || 0;
  drawSky(R, o.hf, REDUCED);
  ctx.save();
  R.shake.apply(ctx, L.w / 2, L.h / 2);
  drawField(R, o);
  drawGhosts(R);
  if (o.hint) drawHint(R, o.hint);
  drawRibbon(R, S, o);
  drawThoughts(R, S, o);
  drawCaptures(R);
  drawOverlays(R, S, o);
  ctx.restore();
  // the night is over: the sun comes up behind her
  if (o.sunrise > 0) drawSun(R, o.sunrise);
  // behind the title's words: the same game, quieter
  if (o.dim > 0) { ctx.fillStyle = `rgba(18,10,42,${o.dim})`; ctx.fillRect(0, 0, L.w, L.h); }
}

// Sunrise: the sun comes up from under the field and rests on its edge, behind her: a warm disc with a sleepy smile,
// slow rays, and the whole sky a little golden. `k`: 0 → 1 as it rises.
function drawSun(R, k) {
  const { ctx, L } = R;
  const up = ease.outBack(clamp(k * 1.1, 0, 1), 1.1);
  const r = clamp(Math.min(L.fw, L.fh) * 0.19, 34, 128);
  const x = L.fx + L.fw / 2, y = lerp(L.fy + L.fh + r * 1.4, L.fy + L.fh - r * 0.5, up);
  const t = REDUCED ? 0 : R.time;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const wash = ctx.createRadialGradient(x, y, r * 0.5, x, y, Math.max(L.w, L.h) * 0.9);
  wash.addColorStop(0, `rgba(255,190,110,${0.3 * k})`); wash.addColorStop(0.4, `rgba(255,140,120,${0.12 * k})`); wash.addColorStop(1, 'rgba(255,140,120,0)');
  ctx.fillStyle = wash; ctx.fillRect(0, 0, L.w, L.h);
  // rays: long and short in turn, turning slowly
  ctx.translate(x, y); ctx.rotate(t * 0.1);
  const rays = 16, reach = r * (3.3 + 0.2 * Math.sin(t * 1.2));
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * TAU, half = i % 2 ? 0.07 : 0.11, len = reach * (i % 2 ? 0.7 : 1);
    const g = ctx.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
    g.addColorStop(0, `rgba(255,226,140,${0.42 * k})`); g.addColorStop(1, 'rgba(255,226,140,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a - half) * r * 0.9, Math.sin(a - half) * r * 0.9);
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    ctx.lineTo(Math.cos(a + half) * r * 0.9, Math.sin(a + half) * r * 0.9);
    ctx.closePath(); ctx.fill();
  }
  ctx.rotate(-t * 0.1); ctx.translate(-x, -y);
  ctx.globalAlpha = clamp(k * 1.4, 0, 1);
  ctx.drawImage(glow('#ffe9a8'), x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
  // the sun itself, drawn like one of her thoughts
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const d = ctx.createRadialGradient(x - r * 0.32, y - r * 0.38, r * 0.08, x, y, r * 1.05);
  d.addColorStop(0, '#fffbe6'); d.addColorStop(0.55, '#ffe27a'); d.addColorStop(1, '#ffb454');
  ctx.fillStyle = d; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.lineWidth = Math.max(2.5, r * 0.075); ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath(); ctx.ellipse(x - r * 0.42, y - r * 0.5, r * 0.2, r * 0.12, -0.6, 0, TAU); ctx.fill();
  drawFace(ctx, 'sun', x, y, r, { mood: 'happy' });
  ctx.restore();
}

// a new player's first loop: a dotted circle where one could go, and a spark going round it
function drawHint(R, hint) {
  const { ctx, L } = R;
  const x = X(L, hint.x), y = Y(L, hint.y), r = hint.r * L.sc, t = REDUCED ? 0.6 : R.time;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(t * 0.5);
  ctx.setLineDash([L.sc * 0.45, L.sc * 0.4]); ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = Math.max(2, L.sc * 0.13);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  const a = t * 2.6, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r, gs = L.sc * 1.2;
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(glow('#ffffff'), px - gs, py - gs, gs * 2, gs * 2);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, Math.max(3, L.sc * 0.2), 0, TAU); ctx.fill();
}

// its colors for the page (the meter, a chip): the kind's own
export { colorOf, lightOf };
