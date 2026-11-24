// CONTEXT WINDOW: the picture, drawn on one canvas in the kit's Pop sticker style (ink outlines, hard shadows, honey /
// pink / mint / sky / violet). Her cursor is her face; her tail is a chain of sticker tiles in the order she ate them, the
// thought she's holding outlined and breathing; the strip over the board is her context window, 24 slots, newest first.
import { Particles, FloatText, Shake, roundRect, star, clamp, lerp, ease, rgba, shade, TAU } from '../kit/fx.js';
import { REDUCED } from '../kit/env.js';
import { COLORS, SPAM, TUNE, frontRun } from './rules.js';

export const PAL = Object.freeze({
  honey: '#ffc933', pink: '#ff4da6', mint: '#3ff0c3', sky: '#59c8ff', violet: '#9b7bff', spam: '#8f88a6',
  ink: '#170a36', paper: '#fffaf0', lav: '#e4d9ff', red: '#ff5a5f', bg: '#0f0826', board: '#1b1044', cell: '#211452',
});
export const colorOf = (c) => (c === SPAM ? PAL.spam : PAL[COLORS[c]] || PAL.paper);
const DISPLAY = "'AK Display', 'Arial Black', system-ui, sans-serif";
const MONO = "'AK Mono', ui-monospace, monospace";

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const face = new Image();
  face.decoding = 'async';
  face.src = '/images/landing/agi1-face.webp';
  return { canvas, ctx, face, parts: new Particles(700), floats: new FloatText(), shake: new Shake({ max: 12 }), flash: 0, flashColor: PAL.paper, freeze: 0, L: null, t: 0 };
}

// where the board goes: as big as fits between the top bar and her panel, whole cells only
export function layout(R, { w, h, dpr, top, bottom, left = 0, right = 0 }, W, H) {
  const stripH = clamp(Math.round(Math.min(w, h) * 0.04), 14, 22);
  const availW = w - left - right - 16, availH = h - top - bottom - stripH - 14;
  const cell = Math.max(10, Math.floor(Math.min(availW / W, availH / H, 52)));
  const bw = cell * W, bh = cell * H;
  const bx = Math.round(left + (w - left - right - bw) / 2);
  const by = Math.round(top + stripH + 10 + Math.max(0, (availH - bh) / 2));
  R.L = { w, h, dpr, cell, bx, by, bw, bh, W, H, strip: { x: bx, y: by - stripH - 7, w: bw, h: stripH } };
  return R.L;
}
export const cellCenter = (R, x, y) => ({ x: R.L.bx + (x + 0.5) * R.L.cell, y: R.L.by + (y + 0.5) * R.L.cell });

// ---------- shapes ----------
function heart(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.78);
  ctx.bezierCurveTo(x - r * 1.25, y - r * 0.05, x - r * 0.62, y - r * 1.05, x, y - r * 0.38);
  ctx.bezierCurveTo(x + r * 0.62, y - r * 1.05, x + r * 1.25, y - r * 0.05, x, y + r * 0.78);
  ctx.closePath();
}
export function glyph(ctx, c, x, y, r) {
  ctx.fillStyle = PAL.ink; ctx.strokeStyle = PAL.ink;
  switch (c) {
    case 0: star(ctx, x, y, r, r * 0.46, 5); ctx.fill(); break;
    case 1: heart(ctx, x, y + r * 0.05, r * 0.92); ctx.fill(); break;
    case 2: ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.78, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.78, y); ctx.closePath(); ctx.fill(); break;
    case 3: ctx.lineWidth = Math.max(1.5, r * 0.42); ctx.beginPath(); ctx.arc(x, y, r * 0.66, 0, TAU); ctx.stroke(); break;
    case 4: ctx.beginPath(); ctx.moveTo(x, y - r * 0.92); ctx.lineTo(x + r * 0.92, y + r * 0.72); ctx.lineTo(x - r * 0.92, y + r * 0.72); ctx.closePath(); ctx.fill(); break;
    case SPAM: {
      ctx.lineWidth = Math.max(1.4, r * 0.28); ctx.lineCap = 'round';
      const e = r * 0.34;
      for (const sx of [-0.45, 0.45]) {
        ctx.beginPath(); ctx.moveTo(x + sx * r - e, y - r * 0.3 - e); ctx.lineTo(x + sx * r + e, y - r * 0.3 + e);
        ctx.moveTo(x + sx * r + e, y - r * 0.3 - e); ctx.lineTo(x + sx * r - e, y - r * 0.3 + e); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(x - r * 0.55, y + r * 0.5);
      for (let i = 1; i <= 4; i++) ctx.lineTo(x - r * 0.55 + i * r * 0.275, y + r * (i % 2 ? 0.28 : 0.5));
      ctx.stroke();
      break;
    }
    default: break;
  }
}
function tile(ctx, x, y, s, fill, { shadow = true, line = 2, r = 0.28 } = {}) {
  if (shadow) { ctx.fillStyle = PAL.ink; roundRect(ctx, x - s / 2, y - s / 2 + Math.max(1.5, s * 0.08), s, s, s * r); ctx.fill(); }
  ctx.fillStyle = fill; roundRect(ctx, x - s / 2, y - s / 2, s, s, s * r); ctx.fill();
  ctx.lineWidth = line; ctx.strokeStyle = PAL.ink; ctx.stroke();
}

function drawToken(R, t, time) {
  const { ctx, L } = R;
  const { x, y } = cellCenter(R, t.x, t.y);
  const born = clamp(t.age / 0.28, 0, 1);
  const bob = 1 + Math.sin(time * 4.2 + t.id) * 0.05;
  const s = L.cell * 0.78 * ease.outBack(born) * bob;
  if (s <= 1) return;
  const blink = t.life < 3 && Math.floor(time * 8) % 2 === 0;
  ctx.globalAlpha = blink ? 0.45 : 1;
  const r = s * 0.3;
  switch (t.kind) {
    case 'color': tile(ctx, x, y, s, colorOf(t.c)); glyph(ctx, t.c, x, y, r); break;
    case 'spam': tile(ctx, x, y, s, PAL.spam); glyph(ctx, SPAM, x, y, r); break;
    case 'wild': {
      const g = ctx.createLinearGradient(x - s / 2, y - s / 2, x + s / 2, y + s / 2);
      g.addColorStop(0, PAL.honey); g.addColorStop(0.35, PAL.pink); g.addColorStop(0.7, PAL.sky); g.addColorStop(1, PAL.mint);
      tile(ctx, x, y, s, g); ctx.fillStyle = PAL.paper; star(ctx, x, y, r * 1.15, r * 0.5, 4, time * 1.5); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = PAL.ink; ctx.stroke();
      break;
    }
    case 'clear':
      tile(ctx, x, y, s, PAL.lav);
      ctx.fillStyle = PAL.ink; ctx.font = `900 ${Math.round(s * 0.36)}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('/clr', x, y + s * 0.03);
      break;
    case 'boost':
      tile(ctx, x, y, s, PAL.honey);
      ctx.fillStyle = PAL.ink; ctx.font = `900 ${Math.round(s * 0.46)}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('×2', x, y + s * 0.04);
      break;
    case 'coffee': {
      tile(ctx, x, y, s, '#c8a27a');
      ctx.fillStyle = PAL.paper; ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.6;
      roundRect(ctx, x - r * 0.8, y - r * 0.45, r * 1.4, r * 1.3, r * 0.25); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + r * 0.72, y + r * 0.15, r * 0.32, -1.2, 1.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - r * 0.3, y - r * 0.65); ctx.quadraticCurveTo(x - r * 0.05, y - r * 0.9, x - r * 0.3, y - r * 1.15); ctx.stroke();
      break;
    }
    case 'heart':
      tile(ctx, x, y, s, PAL.paper);
      ctx.fillStyle = PAL.red; heart(ctx, x, y + r * 0.05, r * 1.05); ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = PAL.ink; ctx.stroke();
      break;
    default: break;
  }
  ctx.globalAlpha = 1;
}

// the trail she wears: how her segments are filled and outlined
function segStyle(trail, c, i, time) {
  const base = colorOf(c);
  switch (trail) {
    case 'pastel': return { fill: c === SPAM ? base : shade(base, 0.42), line: PAL.ink };
    case 'neon': return { fill: c === SPAM ? '#3a3350' : '#140b30', line: base, glow: base };
    case 'glow': return { fill: base, line: PAL.ink, glow: PAL.honey };
    case 'rainbow': return { fill: base, line: `hsl(${(time * 140 + i * 24) % 360} 95% 62%)` };
    case 'galaxy': return { fill: c === SPAM ? '#4a4460' : shade(base, -0.55), line: base, stars: true };
    default: return { fill: base, line: PAL.ink };
  }
}

export function draw(R, S, alpha, dt, { trail = 'sticker', time = 0, attract = false } = {}) {
  const { ctx, L } = R;
  if (!L) return;
  R.t = time;
  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  // the background: night violet, a few slow glyphs drifting up
  ctx.fillStyle = PAL.bg; ctx.fillRect(0, 0, L.w, L.h);
  const g = ctx.createRadialGradient(L.w / 2, L.h * 0.45, 0, L.w / 2, L.h * 0.45, Math.max(L.w, L.h) * 0.7);
  g.addColorStop(0, '#2a1660'); g.addColorStop(1, PAL.bg);
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h);
  ctx.globalAlpha = 0.07;
  for (let i = 0; i < 14; i++) {
    const gx = ((i * 97.3) % 1) * L.w + ((i * 211) % L.w), gy = L.h - (((time * (10 + (i % 5) * 4)) + i * 131) % (L.h + 60)) + 30;
    glyph(ctx, i % 5, gx % L.w, gy, 8 + (i % 3) * 5);
  }
  ctx.globalAlpha = 1;

  ctx.save();
  R.shake.apply(ctx, L.w / 2, L.h / 2);
  // the board
  const { bx, by, bw, bh, cell } = L;
  const edge = S.level >= 2 ? [PAL.honey, PAL.pink, PAL.mint, PAL.sky, PAL.violet][(S.level - 1) % 5] : PAL.ink;
  ctx.fillStyle = PAL.ink; roundRect(ctx, bx - 5, by - 5 + 6, bw + 10, bh + 10, 16); ctx.fill();
  ctx.fillStyle = PAL.board; roundRect(ctx, bx - 5, by - 5, bw + 10, bh + 10, 16); ctx.fill();
  ctx.fillStyle = PAL.cell;
  for (let y = 0; y < S.H; y++) for (let x = (y % 2); x < S.W; x += 2) ctx.fillRect(bx + x * cell, by + y * cell, cell, cell);
  ctx.lineWidth = 3; ctx.strokeStyle = edge; roundRect(ctx, bx - 5, by - 5, bw + 10, bh + 10, 16); ctx.stroke();
  if (S.cfg.wrap) {   // Zen: the edges are open (dashed)
    ctx.setLineDash([6, 8]); ctx.lineWidth = 2; ctx.strokeStyle = rgba(PAL.mint, 0.6); roundRect(ctx, bx - 1, by - 1, bw + 2, bh + 2, 12); ctx.stroke(); ctx.setLineDash([]);
  }

  // firewalls
  for (const piece of S.wallList) for (const c of piece) {
    const x = bx + c.x * cell, y = by + c.y * cell;
    ctx.fillStyle = PAL.ink; roundRect(ctx, x + 1, y + 3, cell - 2, cell - 2, cell * 0.18); ctx.fill();
    ctx.fillStyle = '#ff6b5e'; roundRect(ctx, x + 1, y + 1, cell - 2, cell - 2, cell * 0.18); ctx.fill();
    ctx.strokeStyle = PAL.ink; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 2, y + cell / 2); ctx.lineTo(x + cell - 2, y + cell / 2); ctx.moveTo(x + cell * 0.45, y + 2); ctx.lineTo(x + cell * 0.45, y + cell / 2);
    ctx.moveTo(x + cell * 0.7, y + cell / 2); ctx.lineTo(x + cell * 0.7, y + cell - 2); ctx.stroke();
  }

  for (const t of S.tokens) drawToken(R, t, time);

  // her tail: connectors first, then the tiles from the oldest to the newest
  const k = S.over ? 1 : clamp(alpha, 0, 1);
  const pos = S.body.map((s) => {
    const far = Math.abs(s.x - s.px) > 1.5 || Math.abs(s.y - s.py) > 1.5;
    const t = s.slide ? ease.outCubic(k) : far ? 1 : k;
    return cellCenter(R, lerp(s.px, s.x, t), lerp(s.py, s.y, t));
  });
  const hk = Math.abs(S.head.x - S.head.px) > 1.5 || Math.abs(S.head.y - S.head.py) > 1.5 ? 1 : k;
  const head = cellCenter(R, lerp(S.head.px, S.head.x, hk), lerp(S.head.py, S.head.y, hk));
  // the chain that links them: a soft band under the tiles, so her tail reads as one train of thought
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(228, 217, 255, .32)'; ctx.lineWidth = cell * 0.5;
  ctx.beginPath();
  let prev = head;
  for (const p of pos) {
    if (Math.hypot(p.x - prev.x, p.y - prev.y) < cell * 1.6) { ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); }
    prev = p;
  }
  ctx.stroke();
  const run = frontRun(S);
  const breathe = 1 + Math.sin(time * 7) * 0.05;
  for (let i = S.body.length - 1; i >= 0; i--) {
    const s = S.body[i], p = pos[i];
    const st = segStyle(trail, s.c, i, time);
    const held = i < run && run >= 3;
    const size = cell * (held ? 0.86 * breathe : 0.8) * clamp((S.time - s.born) / 0.18 + 0.4, 0.4, 1);
    if (st.glow && !REDUCED) { ctx.shadowColor = st.glow; ctx.shadowBlur = cell * 0.4; }
    tile(ctx, p.x, p.y, size, st.fill, { shadow: !st.glow, line: 2 });
    ctx.shadowBlur = 0;
    if (st.line !== PAL.ink) { ctx.lineWidth = 2.2; ctx.strokeStyle = st.line; roundRect(ctx, p.x - size / 2, p.y - size / 2, size, size, size * 0.28); ctx.stroke(); }
    if (st.stars) { ctx.fillStyle = PAL.paper; for (let j = 0; j < 3; j++) ctx.fillRect(p.x - size * 0.3 + ((s.id * 7 + j * 11) % 10) / 10 * size * 0.6, p.y - size * 0.3 + ((s.id * 3 + j * 5) % 10) / 10 * size * 0.6, 1.5, 1.5); }
    glyph(ctx, s.c, p.x, p.y, size * 0.27);
    if (st.line !== PAL.ink && s.c !== SPAM) { ctx.fillStyle = st.line; ctx.globalAlpha = 0.9; glyph(ctx, s.c, p.x, p.y, size * 0.27); ctx.globalAlpha = 1; }
    if (held) {
      ctx.lineWidth = 2.5; ctx.strokeStyle = PAL.paper;
      roundRect(ctx, p.x - size / 2 - 3, p.y - size / 2 - 3, size + 6, size + 6, size * 0.34); ctx.stroke();
    }
  }
  // her face, and her cursor in front of it
  const hr = cell * 0.6;
  const dx = S.dir.x, dy = S.dir.y;
  ctx.fillStyle = PAL.paper; ctx.strokeStyle = PAL.ink; ctx.lineWidth = 2;
  ctx.beginPath();
  const cx = head.x + dx * hr * 1.15, cy = head.y + dy * hr * 1.15;
  ctx.moveTo(cx + dx * cell * 0.3, cy + dy * cell * 0.3);
  ctx.lineTo(cx - dy * cell * 0.2, cy + dx * cell * 0.2);
  ctx.lineTo(cx + dy * cell * 0.2, cy - dx * cell * 0.2);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = PAL.ink; ctx.beginPath(); ctx.arc(head.x, head.y + 2.5, hr + 2, 0, TAU); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(head.x, head.y, hr, 0, TAU); ctx.closePath();
  ctx.fillStyle = PAL.lav; ctx.fill();
  if (R.face.complete && R.face.naturalWidth) { ctx.clip(); ctx.drawImage(R.face, head.x - hr * 1.12, head.y - hr * 1.06, hr * 2.24, hr * 2.24); }
  ctx.restore();
  ctx.lineWidth = 2.5; ctx.strokeStyle = S.over ? PAL.red : PAL.ink; ctx.beginPath(); ctx.arc(head.x, head.y, hr, 0, TAU); ctx.stroke();
  if (S.boostT > 0) { ctx.lineWidth = 2; ctx.strokeStyle = PAL.honey; ctx.setLineDash([4, 4]); ctx.lineDashOffset = -time * 30; ctx.beginPath(); ctx.arc(head.x, head.y, hr + 5, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }

  // ready: which way she'll go
  if (S.ready > 0 && !attract) {
    const a = 0.55 + Math.sin(time * 9) * 0.35;
    ctx.globalAlpha = a; ctx.fillStyle = PAL.paper;
    for (let i = 1; i <= 3; i++) {
      const ax = head.x + dx * cell * (0.9 + i * 0.7), ay = head.y + dy * cell * (0.9 + i * 0.7);
      ctx.beginPath(); ctx.moveTo(ax + dx * 6, ay + dy * 6); ctx.lineTo(ax - dy * 6 - dx * 4, ay + dx * 6 - dy * 4); ctx.lineTo(ax + dy * 6 - dx * 4, ay - dx * 6 - dy * 4); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  R.parts.draw(ctx);
  R.floats.draw(ctx);
  ctx.restore();

  if (attract) { ctx.fillStyle = 'rgba(15, 8, 38, .5)'; ctx.fillRect(0, 0, L.w, L.h); } else drawStrip(R, S, time);
  // chain and power-ups, in the board's top right corner
  let bxr = bx + bw - 8;
  const pill = (text, fill, k2) => {
    ctx.font = `900 ${Math.max(11, Math.round(cell * 0.42))}px ${DISPLAY}`;
    const tw = ctx.measureText(text).width + 16, ph = Math.max(18, cell * 0.66);
    const x = bxr - tw, y = by + 8;
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = PAL.ink; roundRect(ctx, x, y + 2, tw, ph, ph / 2); ctx.fill();
    ctx.fillStyle = fill; roundRect(ctx, x, y, tw, ph, ph / 2); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = PAL.ink; ctx.stroke();
    if (k2 != null) { ctx.fillStyle = rgba(PAL.ink, 0.25); ctx.fillRect(x + 6, y + ph - 5, (tw - 12) * k2, 2.5); }
    ctx.fillStyle = PAL.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + tw / 2, y + ph / 2 + 1);
    ctx.globalAlpha = 1;
    bxr = x - 6;
  };
  if (!attract) {
    if (S.chain >= 2) pill(`CHAIN ×${S.chain}`, PAL.pink, S.chainT / TUNE.chainWindow);
    if (S.boostT > 0) pill('×2', PAL.honey, S.boostT / TUNE.boostT);
    if (S.coffeeT > 0) pill('SLOW', '#c8a27a', S.coffeeT / TUNE.coffeeT);
  }

  if (R.flash > 0 && !REDUCED) {
    ctx.globalAlpha = Math.min(0.5, R.flash);
    ctx.fillStyle = R.flashColor; ctx.fillRect(0, 0, L.w, L.h);
    ctx.globalAlpha = 1;
  }
}

// her context window: 24 slots over the board, newest first
function drawStrip(R, S, time) {
  const { ctx, L } = R;
  const { x, y, w, h } = L.strip;
  const n = TUNE.limit, gap = 2;
  const label = `${S.body.length}/${n}`;
  ctx.font = `700 ${Math.round(h * 0.62)}px ${MONO}`;
  const lw = ctx.measureText(label).width + 12;
  const sw = (w - lw - gap * (n - 1)) / n;
  const full = S.body.length >= n - 3;
  ctx.fillStyle = full && Math.floor(time * 4) % 2 ? PAL.red : PAL.paper;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + h / 2 + 1);
  for (let i = 0; i < n; i++) {
    const sx = x + lw + i * (sw + gap);
    const s = S.body[i];
    ctx.fillStyle = s ? colorOf(s.c) : 'rgba(255,250,240,.08)';
    roundRect(ctx, sx, y, sw, h, Math.min(5, sw / 3)); ctx.fill();
    if (s) { ctx.lineWidth = 1.5; ctx.strokeStyle = PAL.ink; ctx.stroke(); }
    if (i >= n - 3) { ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(PAL.red, s ? 1 : 0.55); roundRect(ctx, sx, y, sw, h, Math.min(5, sw / 3)); ctx.stroke(); }
  }
}

// ---------- effects for the rules' events ----------
const FONT = `900 1em ${DISPLAY}`;
export const fx = {
  eat(R, e) {
    const p = cellCenter(R, e.x, e.y);
    R.parts.burst({ x: p.x, y: p.y, count: 8, speed: [40, 150], life: [0.25, 0.5], size: [3, 6], colors: [e.c === SPAM || e.c == null ? PAL.paper : colorOf(e.c)], drag: 4 });
    R.parts.burst({ x: p.x, y: p.y, count: 1, speed: [0, 0], life: [0.35, 0.35], size: [R.L.cell * 0.5, R.L.cell * 0.5], colors: [PAL.paper], shape: 'ring', grow: R.L.cell * 2 });
  },
  commit(R, e) {
    let sx = 0, sy = 0;
    for (const c of e.cells) {
      const p = cellCenter(R, c.x, c.y);
      sx += p.x; sy += p.y;
      R.parts.burst({ x: p.x, y: p.y, count: 10, speed: [80, 300], life: [0.4, 0.9], size: [3, 8], colors: [colorOf(e.c), PAL.paper], gravity: 280, drag: 2, shape: 'square', spin: 8 });
    }
    const cx = sx / e.cells.length, cy = sy / e.cells.length;
    const big = e.n >= 5;
    R.parts.burst({ x: cx, y: cy, count: big ? 24 : 12, speed: [120, 380], life: [0.5, 1], size: [4, 9], colors: [PAL.honey, PAL.paper, colorOf(e.c)], shape: 'star', spin: 6, drag: 2.5 });
    R.floats.add({ x: cx, y: cy, text: `+${e.pts.toLocaleString('en-US')}`, color: colorOf(e.c), size: Math.min(46, 22 + e.n * 3.5), life: 1.1, rise: 70, font: FONT });
    if (e.chain >= 2) R.floats.add({ x: cx, y: cy + 30, text: `CHAIN ×${e.chain}`, color: PAL.paper, size: 18, life: 1, rise: 46, font: FONT });
    if (big) R.floats.add({ x: R.L.bx + R.L.bw / 2, y: R.L.by + R.L.bh * 0.32, text: e.n >= 7 ? 'GALAXY BRAIN' : e.n >= 6 ? 'HUGE THOUGHT' : 'BIG THOUGHT', color: PAL.honey, size: 34, life: 1.3, rise: 30, font: FONT });
    R.shake.kick(0.1 + Math.min(0.45, e.n * 0.05));
    if (big && !REDUCED) { R.freeze = 0.07; R.flash = 0.18; R.flashColor = PAL.paper; }
  },
  shatter(R, e) {
    const p = cellCenter(R, e.x, e.y);
    R.parts.burst({ x: p.x, y: p.y, count: 14, speed: [100, 320], life: [0.4, 0.8], size: [2, 6], colors: [PAL.spam, PAL.paper, '#cfc8e6'], gravity: 500, shape: 'square', spin: 12 });
  },
  join(R, e, head) {
    R.floats.add({ x: head.x, y: head.y - R.L.cell, text: `JOINED ×${e.n}`, color: PAL.mint, size: 22, life: 1.1, rise: 50, font: FONT });
  },
  forget(R, e) {
    const p = cellCenter(R, e.x, e.y);
    R.parts.burst({ x: p.x, y: p.y, count: 12, speed: [30, 120], life: [0.6, 1.2], size: [3, 7], colors: [colorOf(e.c), PAL.spam], gravity: 420, shape: 'square', spin: 4 });
    R.floats.add({ x: p.x, y: p.y, text: 'forgot…', color: PAL.spam, size: 18, life: 1.1, rise: 40, font: FONT });
    R.shake.kick(0.25);
    if (!REDUCED) { R.flash = 0.22; R.flashColor = PAL.red; }
  },
  clear(R, e) {
    for (const c of e.cells) { const p = cellCenter(R, c.x, c.y); R.parts.burst({ x: p.x, y: p.y, count: 8, speed: [60, 180], life: [0.3, 0.6], size: [3, 6], colors: [PAL.lav, PAL.paper], shape: 'spark' }); }
  },
  special(R, e) {
    const p = cellCenter(R, e.x, e.y);
    const label = { wild: 'WILD', clear: '/CLEAR', boost: '×2 POINTS', coffee: 'SLOW-MO', heart: '+1 HEART' }[e.kind] || '';
    R.parts.burst({ x: p.x, y: p.y, count: 16, speed: [80, 260], life: [0.4, 0.8], size: [3, 7], colors: [PAL.honey, PAL.pink, PAL.mint, PAL.sky], shape: 'star', spin: 6 });
    if (label) R.floats.add({ x: p.x, y: p.y - 8, text: label, color: PAL.paper, size: 20, life: 1, rise: 48, font: FONT });
  },
  wall(R, e) {
    for (const c of e.cells) { const p = cellCenter(R, c.x, c.y); R.parts.burst({ x: p.x, y: p.y, count: 10, speed: [40, 160], life: [0.3, 0.7], size: [3, 6], colors: ['#ff6b5e', PAL.paper], shape: 'square' }); }
  },
  level(R, level) {
    R.floats.add({ x: R.L.bx + R.L.bw / 2, y: R.L.by + R.L.bh * 0.45, text: `LEVEL ${level}`, color: PAL.honey, size: 44, life: 1.5, rise: 26, font: FONT });
  },
  crash(R, e) {
    const p = cellCenter(R, e.x, e.y);
    R.parts.burst({ x: p.x, y: p.y, count: 40, speed: [120, 460], life: [0.5, 1.2], size: [4, 10], colors: [PAL.pink, PAL.red, PAL.paper, PAL.honey], gravity: 300, shape: 'star', spin: 10 });
    R.shake.kick(0.75);
    if (!REDUCED) { R.flash = 0.4; R.flashColor = PAL.red; }
  },
  update(R, dt) {
    R.parts.update(dt); R.floats.update(dt); R.shake.update(dt);
    R.flash = Math.max(0, R.flash - dt * 2.2);
  },
  clear_all(R) { R.parts.clear(); R.floats.clear(); R.flash = 0; R.freeze = 0; },
};
