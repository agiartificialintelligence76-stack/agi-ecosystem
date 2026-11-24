// HOTFIX: the picture. The bugs up top (drawn in code: round bodies, wiggly legs, antennae, eyes that follow her chips,
// their HP, countdowns and what they're weak to), her uptime bar, and the 6 × 5 board of chips below: glossy sticker
// orbs with an icon each, falling into place, popping in groups, the held one under the finger.
import { Particles, FloatText, Shake, roundRect, star, clamp, rgba, shade, TAU } from '../kit/fx.js';
import { REDUCED } from '../kit/env.js';
import { KINDS, W, H, JUNK, xy } from './rules.js';

const INK = '#170a36', PAPER = '#fffaf0';
const DISPLAY = "'AK Display', 'Arial Black', system-ui, sans-serif";
const MONO = "'AK Mono', ui-monospace, monospace";

export function createRenderer(canvas) {
  return { canvas, ctx: canvas.getContext('2d'), L: null, vis: new Map(), pops: [], parts: new Particles(700), floats: new FloatText(), shake: new Shake({ max: 12 }), flash: 0, flashColor: '#ff5a5f', lunge: new Map(), hurt: new Map() };
}

// the bugs' zone, her row, the board
export function layout(R, { w, h, dpr, top, bottom, left = 0, right = 0 }) {
  const herRow = 62;
  const availH = h - top - bottom - 12;
  // a short, wide screen (a phone held sideways): the board on the right, the bugs and her uptime on the left
  if (w > h * 1.25 && availH < 620) {
    const cell = clamp(Math.floor(Math.min((availH - 4) / H, (w - left - right) * 0.52 / W)), 30, 92);
    const bw = cell * W, bh = cell * H;
    const half = (w - left - right) / 2;
    const bx = Math.round(left + half + Math.max(8, (half - bw) / 2));
    const by = Math.round(top + 6 + (availH - bh) / 2);
    const lx = left + 14, lw = Math.max(160, bx - lx - 18);
    const herY = by + bh - herRow;
    R.L = { w, h, dpr, cell, bx, by, bw, bh, herY, herRow, wide: true, bugs: { x: lx, y: top + 4, w: lw, h: Math.max(90, herY - top - 10) }, bar: { x: lx, y: herY + 8, w: lw, h: herRow - 16 } };
    return R.L;
  }
  const availW = Math.min(560, w - left - right - 20);
  let cell = Math.floor(Math.min(availW / W, (availH - herRow - 150) / H));
  cell = clamp(cell, 36, 92);
  const bw = cell * W, bh = cell * H;
  const bx = Math.round(left + (w - left - right - bw) / 2);
  const by = Math.round(h - bottom - bh - 8);
  const herY = by - herRow - 6;
  const bugs = { x: 0, y: top + 6, w: Math.min(w - 20, 620), h: Math.max(110, herY - top - 12) };
  bugs.x = Math.round((w - bugs.w) / 2);
  R.L = { w, h, dpr, cell, bx, by, bw, bh, herY, herRow, bugs, bar: { x: bx, y: herY + 8, w: bw, h: herRow - 16 } };
  return R.L;
}
export const cellAt = (R, px, py) => {
  const { bx, by, cell } = R.L;
  const x = Math.floor((px - bx) / cell), y = Math.floor((py - by) / cell);
  return x >= 0 && y >= 0 && x < W && y < H ? y * W + x : -1;
};
export const cellCenter = (R, i) => { const p = xy(i); return { x: R.L.bx + (p.x + 0.5) * R.L.cell, y: R.L.by + (p.y + 0.5) * R.L.cell }; };

// ---------- chips ----------
function icon(ctx, t, x, y, r) {
  ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  switch (t) {
    case 0: ctx.beginPath(); ctx.moveTo(x + r * 0.15, y - r); ctx.lineTo(x - r * 0.55, y + r * 0.12); ctx.lineTo(x - r * 0.02, y + r * 0.12); ctx.lineTo(x - r * 0.2, y + r); ctx.lineTo(x + r * 0.58, y - r * 0.18); ctx.lineTo(x + r * 0.06, y - r * 0.18); ctx.closePath(); ctx.fill(); break;
    case 1: ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.8, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.8, y); ctx.closePath(); ctx.fill(); ctx.fillStyle = PAPER; ctx.beginPath(); ctx.moveTo(x, y - r * 0.45); ctx.lineTo(x + r * 0.32, y); ctx.lineTo(x, y + r * 0.1); ctx.closePath(); ctx.fill(); break;
    case 2: ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, 0, 0, TAU); ctx.fill(); ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(x, y, r * 0.38, 0, TAU); ctx.fill(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, r * 0.18, 0, TAU); ctx.fill(); break;
    case 3: ctx.beginPath(); ctx.moveTo(x, y + r * 0.85); ctx.bezierCurveTo(x - r * 1.3, y, x - r * 0.6, y - r * 1.05, x, y - r * 0.35); ctx.bezierCurveTo(x + r * 0.6, y - r * 1.05, x + r * 1.3, y, x, y + r * 0.85); ctx.closePath(); ctx.fill(); break;
    case 4: ctx.fillRect(x - r * 0.25, y - r * 0.85, r * 0.5, r * 1.7); ctx.fillRect(x - r * 0.85, y - r * 0.25, r * 1.7, r * 0.5); break;
    default:
      ctx.lineWidth = Math.max(1.5, r * 0.28);
      ctx.beginPath(); ctx.moveTo(x - r * 0.7, y - r * 0.2); for (let i = 1; i <= 5; i++) ctx.lineTo(x - r * 0.7 + i * r * 0.28, y + (i % 2 ? r * 0.35 : -r * 0.2)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - r * 0.5, y - r * 0.6); ctx.lineTo(x - r * 0.2, y - r * 0.6); ctx.moveTo(x + r * 0.2, y - r * 0.6); ctx.lineTo(x + r * 0.5, y - r * 0.6); ctx.stroke();
  }
}
export function chip(ctx, t, x, y, r, { lock = 0, glow = 0 } = {}) {
  const color = KINDS[t].color;
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y + r * 0.12, r, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, shade(color, 0.5)); g.addColorStop(0.55, color); g.addColorStop(1, shade(color, -0.2));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.09); ctx.strokeStyle = INK; ctx.stroke();
  icon(ctx, t, x, y + r * 0.04, r * 0.45);
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(x - r * 0.38, y - r * 0.5, r * 0.22, r * 0.12, -0.6, 0, TAU); ctx.fill();
  if (glow) { ctx.globalAlpha = glow; ctx.lineWidth = 3; ctx.strokeStyle = PAPER; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
  if (lock) {
    ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, r * 0.12);
    ctx.beginPath(); ctx.moveTo(x - r * 0.9, y - r * 0.9); ctx.lineTo(x + r * 0.9, y + r * 0.9); ctx.moveTo(x + r * 0.9, y - r * 0.9); ctx.lineTo(x - r * 0.9, y + r * 0.9); ctx.stroke();
    ctx.fillStyle = '#c9c4dd'; roundRect(ctx, x - r * 0.32, y - r * 0.05, r * 0.64, r * 0.5, r * 0.1); ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y - r * 0.05, r * 0.2, Math.PI, 0); ctx.stroke();
  }
}

// ---------- bugs ----------
function bug(ctx, b, x, y, s, time, { target = false, lunge = 0, hurt = 0 } = {}) {
  const def = b.def, dead = b.hp <= 0;
  const bob = Math.sin(time * 3 + b.uid) * s * 0.04;
  const ly = y + bob + lunge * s * 0.25;
  ctx.save();
  if (hurt > 0) ctx.translate(Math.sin(time * 70) * hurt * 8, 0);
  if (dead) ctx.globalAlpha = 0.25;
  // legs
  ctx.strokeStyle = '#cdb8ff'; ctx.lineWidth = Math.max(2, s * 0.05); ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) for (const side of [-1, 1]) {
    const k = Math.sin(time * 9 + i * 2 + side) * s * 0.05;
    ctx.beginPath(); ctx.moveTo(x + side * s * 0.3, ly + s * (0.05 + i * 0.14)); ctx.lineTo(x + side * s * 0.62, ly + s * (0.02 + i * 0.16) + k); ctx.lineTo(x + side * s * 0.7, ly + s * (0.18 + i * 0.16) + k); ctx.stroke();
  }
  // antennae
  ctx.strokeStyle = '#cdb8ff';
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(x + side * s * 0.12, ly - s * 0.38); ctx.quadraticCurveTo(x + side * s * 0.3, ly - s * 0.75, x + side * s * 0.38 + Math.sin(time * 4) * s * 0.05, ly - s * 0.68); ctx.stroke();
    ctx.fillStyle = def.color; ctx.beginPath(); ctx.arc(x + side * s * 0.38 + Math.sin(time * 4) * s * 0.05, ly - s * 0.68, s * 0.07, 0, TAU); ctx.fill(); ctx.stroke();
  }
  ctx.strokeStyle = INK;
  // body
  ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x, ly + s * 0.08, s * 0.44, s * 0.4, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = def.color; ctx.beginPath(); ctx.ellipse(x, ly, s * 0.44, s * 0.4, 0, 0, TAU); ctx.fill();
  ctx.lineWidth = Math.max(2, s * 0.05); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(x - s * 0.16, ly - s * 0.2, s * 0.14, s * 0.07, -0.5, 0, TAU); ctx.fill();
  // its glyph
  ctx.fillStyle = rgba(INK, 0.75); ctx.font = `900 ${Math.max(9, s * 0.2)}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(def.glyph, x, ly + s * 0.16);
  // eyes (x_x when squashed)
  for (const side of [-1, 1]) {
    const ex = x + side * s * 0.15, ey = ly - s * 0.1;
    if (dead) { ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ex - 4, ey - 4); ctx.lineTo(ex + 4, ey + 4); ctx.moveTo(ex + 4, ey - 4); ctx.lineTo(ex - 4, ey + 4); ctx.stroke(); continue; }
    ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(ex, ey, s * 0.1, 0, TAU); ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ex, ey + s * 0.03, s * 0.05, 0, TAU); ctx.fill();
  }
  if (def.boss && !dead) { ctx.fillStyle = '#ffc933'; star(ctx, x, ly - s * 0.52, s * 0.14, s * 0.06, 5); ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke(); }
  if (b.shield > 0 && !dead) { ctx.strokeStyle = rgba('#59c8ff', 0.8); ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.ellipse(x, ly, s * 0.58, s * 0.54, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  ctx.restore();
  if (target && !dead) {
    ctx.strokeStyle = PAPER; ctx.lineWidth = 2.5;
    const r = s * 0.6, a = time * 1.5;
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x, y, r, a + k * TAU / 4, a + k * TAU / 4 + 0.6); ctx.stroke(); }
  }
}

export function bugSlots(R, bugs) {
  const { bugs: Z } = R.L;
  const n = Math.max(1, bugs.length);
  const s = clamp(Math.min(Z.w / n * 0.62, Z.h * 0.5), 36, 150) * (bugs.length === 1 && bugs[0]?.def.boss ? 1.25 : 1);
  return bugs.map((b, i) => ({ x: Z.x + (Z.w / n) * (i + 0.5), y: Z.y + Z.h * 0.46, s }));
}
export function bugAt(R, bugs, px, py) {
  const slots = bugSlots(R, bugs);
  for (let i = 0; i < slots.length; i++) if (Math.hypot(px - slots[i].x, py - slots[i].y) < slots[i].s * 0.7) return i;
  return -1;
}

function bar(ctx, x, y, w, h, k, fill, back = 'rgba(255,250,240,.15)') {
  ctx.fillStyle = back; roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
  if (k > 0) { ctx.fillStyle = fill; roundRect(ctx, x, y, Math.max(h, w * clamp(k, 0, 1)), h, h / 2); ctx.fill(); }
  ctx.lineWidth = 2; ctx.strokeStyle = INK; roundRect(ctx, x, y, w, h, h / 2); ctx.stroke();
}

// the whole frame. `cells`: the board to show (a snapshot while a turn plays back), `held`: { id, x, y } under the finger
export function draw(R, run, cells, dt, { time = 0, held = null, timer = null, combo = 0, popping = null, attract = false, uptime = run.uptime } = {}) {
  const { ctx, L } = R;
  if (!L) return;
  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, L.h);
  g.addColorStop(0, '#120a2e'); g.addColorStop(1, '#1d0f45');
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h);
  // faint code lines behind the bugs
  ctx.fillStyle = 'rgba(205, 184, 255, .06)';
  for (let i = 0; i < 18; i++) { const y = L.bugs.y + ((i * 23 + time * 8) % Math.max(1, L.bugs.h)); ctx.fillRect(L.bugs.x + ((i * 37) % 80), y, 40 + ((i * 53) % 160), 4); }
  ctx.save();
  R.shake.apply(ctx, L.w / 2, L.h / 2);

  // the bugs
  const slots = bugSlots(R, run.bugs);
  run.bugs.forEach((b, i) => {
    const p = slots[i];
    bug(ctx, b, p.x, p.y, p.s, time, { target: i === run.target && run.bugs.length > 1, lunge: R.lunge.get(b.uid) || 0, hurt: R.hurt.get(b.uid) || 0 });
    if (b.hp <= 0 && !(R.hurt.get(b.uid) > 0)) return;
    const bw = Math.min(p.s * 1.25, (L.bugs.w / run.bugs.length) * 0.86);
    bar(ctx, p.x - bw / 2, p.y + p.s * 0.62, bw, 10, b.hp / b.max, b.def.boss ? '#ff5a5f' : '#ff7ab8');
    ctx.font = `800 ${clamp(p.s * 0.13, 10, 14)}px ${DISPLAY}`; ctx.fillStyle = PAPER; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(b.name.toUpperCase(), p.x, p.y + p.s * 0.62 + 14);
    // its countdown
    const cx = p.x + p.s * 0.48, cy = p.y - p.s * 0.42;
    ctx.fillStyle = b.cd <= 1 ? '#ff5a5f' : '#ffc933'; ctx.beginPath(); ctx.arc(cx, cy, 13, 0, TAU); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = INK; ctx.font = `900 13px ${MONO}`; ctx.textBaseline = 'middle'; ctx.fillText(String(Math.max(0, b.cd)), cx, cy + 1);
    // weak / resists: little chips under the name
    const wy = p.y + p.s * 0.62 + 34;
    const wk = KINDS.findIndex((k) => k.id === b.def.weak), rs = KINDS.findIndex((k) => k.id === b.def.resist);
    ctx.font = `800 10px ${MONO}`; ctx.fillStyle = PAPER; ctx.textAlign = 'right'; ctx.fillText('×2', p.x - 4, wy);
    chip(ctx, wk, p.x - 30, wy, 7);
    ctx.textAlign = 'left'; ctx.fillText('½', p.x + 26, wy);
    chip(ctx, rs, p.x + 16, wy, 7);
  });

  // her uptime (and the drag's clock over it)
  const B = L.bar;
  const bx2 = B.x + 62;
  const bw2 = B.x + B.w - bx2;
  ctx.font = `800 11px ${MONO}`; ctx.fillStyle = PAPER; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillText(run.mode === 'lab' ? `MOVES ${run.lab}` : `UPTIME ${Math.ceil(uptime)}/${run.max}`, bx2 + 2, B.y + B.h * 0.42);
  if (run.mode !== 'lab') bar(ctx, bx2, B.y + B.h * 0.5, bw2, 14, uptime / run.max, uptime < run.max * 0.3 ? '#ff5a5f' : '#3ff0c3');
  if (timer != null) bar(ctx, bx2, B.y + B.h * 0.5 + 18, bw2, 7, timer, timer < 0.25 ? '#ff4da6' : '#ffc933');

  // the board
  const { bx, by, bw, bh, cell } = L;
  ctx.fillStyle = INK; roundRect(ctx, bx - 6, by - 6 + 6, bw + 12, bh + 12, 18); ctx.fill();
  ctx.fillStyle = '#2a1660'; roundRect(ctx, bx - 6, by - 6, bw + 12, bh + 12, 18); ctx.fill();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { ctx.fillStyle = (x + y) % 2 ? '#33207a' : '#2c1a6b'; ctx.fillRect(bx + x * cell, by + y * cell, cell, cell); }
  ctx.lineWidth = 3; ctx.strokeStyle = INK; roundRect(ctx, bx - 6, by - 6, bw + 12, bh + 12, 18); ctx.stroke();
  const k = 1 - Math.exp(-dt * 16);
  const seen = new Set();
  const r = cell * 0.41;
  ctx.save(); ctx.beginPath(); ctx.rect(bx - 6, by - 6, bw + 12, bh + 12); ctx.clip();
  cells.forEach((c, i) => {
    if (!c) return;
    seen.add(c.id);
    if (held && held.id === c.id) return;
    const p = cellCenter(R, i);
    let v = R.vis.get(c.id);
    if (!v) { v = { x: p.x, y: p.y, s: 1 }; R.vis.set(c.id, v); }
    v.x += (p.x - v.x) * k; v.y += (p.y - v.y) * Math.min(1, k * 1.15);
    const pop = popping && popping.has(i) ? popping.get(i) : 0;
    chip(ctx, c.t, v.x, v.y, r * (1 + pop * 0.25), { lock: c.lock, glow: pop });
  });
  ctx.restore();
  for (const id of R.vis.keys()) if (!seen.has(id)) R.vis.delete(id);
  // the held chip, under the finger, bigger
  if (held) {
    const c = cells.find((q) => q && q.id === held.id);
    if (c) { ctx.globalAlpha = 0.9; chip(ctx, c.t, held.x, held.y - 6, r * 1.18); ctx.globalAlpha = 1; R.vis.set(c.id, { x: held.x, y: held.y, s: 1 }); }
  }
  if (combo >= 2) {
    const size = 30 + Math.min(10, combo) * 3;
    ctx.font = `900 ${size}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.strokeText(`${combo} COMBO`, bx + bw / 2, by + bh * 0.5);
    ctx.fillStyle = combo >= 6 ? '#ff4da6' : combo >= 4 ? '#ffc933' : PAPER; ctx.fillText(`${combo} COMBO`, bx + bw / 2, by + bh * 0.5);
  }
  R.parts.draw(ctx);
  R.floats.draw(ctx);
  ctx.restore();
  if (attract) { ctx.fillStyle = 'rgba(15, 8, 38, .5)'; ctx.fillRect(0, 0, L.w, L.h); }
  if (R.flash > 0 && !REDUCED) { ctx.globalAlpha = Math.min(0.4, R.flash); ctx.fillStyle = R.flashColor; ctx.fillRect(0, 0, L.w, L.h); ctx.globalAlpha = 1; }
}

// ---------- effects ----------
const FONT = `900 1em ${DISPLAY}`;
export const fx = {
  pop(R, group) {
    const color = KINDS[group.t].color;
    for (const i of group.cells) { const p = cellCenter(R, i); R.parts.burst({ x: p.x, y: p.y, count: 7, speed: [60, 240], life: [0.3, 0.6], size: [3, 7], colors: [color, PAPER], shape: 'star', spin: 6, drag: 3 }); }
  },
  junk(R, cells) { for (const i of cells) { const p = cellCenter(R, i); R.parts.burst({ x: p.x, y: p.y, count: 10, speed: [80, 260], life: [0.3, 0.7], size: [2, 6], colors: ['#8f88a6', PAPER], shape: 'square', gravity: 500, spin: 10 }); } },
  hit(R, slot, h) {
    const color = KINDS[h.t]?.color || PAPER;
    R.parts.burst({ x: slot.x, y: slot.y, count: h.weak ? 16 : 8, speed: [80, 300], life: [0.3, 0.6], size: [3, 8], colors: [color, PAPER], shape: 'spark' });
    R.floats.add({ x: slot.x + (Math.random() - 0.5) * slot.s * 0.6, y: slot.y - slot.s * 0.3, text: `${h.amount}${h.weak ? '!' : ''}`, color: h.weak ? '#ffc933' : h.resist ? '#cdb8ff' : color, size: h.weak ? 30 : h.resist ? 18 : 24, life: 0.9, rise: 50, font: FONT });
  },
  kill(R, slot) {
    R.parts.burst({ x: slot.x, y: slot.y, count: 30, speed: [120, 420], life: [0.5, 1.1], size: [4, 10], colors: ['#ffc933', '#ff4da6', '#3ff0c3', PAPER], shape: 'star', spin: 8, drag: 2 });
    R.floats.add({ x: slot.x, y: slot.y - slot.s * 0.6, text: 'SQUASHED', color: '#3ff0c3', size: 24, life: 1.1, rise: 40, font: FONT });
    R.shake.kick(0.25);
  },
  heal(R, n) { R.floats.add({ x: R.L.bar.x + R.L.bar.w * 0.7, y: R.L.bar.y, text: `+${n}`, color: '#3ff0c3', size: 22, life: 0.9, rise: 34, font: FONT }); },
  bite(R, n) { R.floats.add({ x: R.L.bar.x + R.L.bar.w * 0.7, y: R.L.bar.y, text: `−${n}`, color: '#ff5a5f', size: 26, life: 1, rise: 30, font: FONT }); R.shake.kick(0.45); R.flash = 0.3; R.flashColor = '#ff5a5f'; },
  mark(R, cells, color) { for (const i of cells) { const p = cellCenter(R, i); R.parts.burst({ x: p.x, y: p.y, count: 12, speed: [40, 160], life: [0.3, 0.7], size: [3, 6], colors: [color, PAPER], shape: 'ring', grow: 30 }); } },
  update(R, dt) {
    R.parts.update(dt); R.floats.update(dt); R.shake.update(dt);
    R.flash = Math.max(0, R.flash - dt * 2);
    for (const m of [R.lunge, R.hurt]) for (const [id, v] of m) { const n = v - dt * 2.5; if (n <= 0) m.delete(id); else m.set(id, n); }
  },
  reset(R) { R.vis.clear(); R.parts.clear(); R.floats.clear(); R.flash = 0; R.lunge.clear(); R.hurt.clear(); },
};
