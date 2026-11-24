// TOO MANY TABS: the picture. Her wallpaper, a browser window holding the pile of tabs (each layer lifted a little, the
// tabs under others dimmed, the deep ones face down on harder boards), her taskbar of seven slots at the bottom and the
// shelf above it. Tabs fly where they go; three alike pop together.
import { Particles, FloatText, Shake, roundRect, star, clamp, ease, rgba, approach, TAU } from '../kit/fx.js';
import { REDUCED } from '../kit/env.js';
import { KINDS, TRAY, SHELF, GW, GH, isFree } from './rules.js';
import { tab } from './art.js';

const INK = '#170a36', PAPER = '#fffaf0';
const DISPLAY = "'AK Display', 'Arial Black', system-ui, sans-serif";
const MONO = "'AK Mono', ui-monospace, monospace";

export function createRenderer(canvas) {
  return {
    canvas, ctx: canvas.getContext('2d'), L: null, vis: new Map(), pops: [], wobble: new Map(),
    parts: new Particles(600), floats: new FloatText(), shake: new Shake({ max: 10 }), flash: 0, wall: null, wallId: '', cover: new Map(), hideDeep: false,
  };
}

// ---------- where things go ----------
export function layout(R, { w, h, dpr, top, bottom, left = 0, right = 0, floor = bottom }) {
  const pad = 10;
  const barH = clamp(Math.round(h * 0.034), 22, 30);
  const winTop = top + 4;
  // a short, wide screen (a phone held sideways): the pile on the left, the taskbar (and the helpers under it) on the right
  if (w > h * 1.35 && h - top < 560) {
    const split = left + (w - left - right) * 0.58;
    const boardTop = winTop + barH + 8, boardBottom = h - floor - 18;
    const ts = Math.max(16, Math.floor(Math.min((split - left - 40) / (GW + 0.5), (boardBottom - boardTop) / (GH + 0.5))));
    const bw = ts * GW, bh = ts * GH;
    const bx = Math.round(left + (split - left - bw) / 2), by = Math.round(boardTop + Math.max(0, (boardBottom - boardTop - bh) / 2) + ts * 0.15);
    const rw = w - right - split - 16;
    const ss = clamp(Math.floor((rw - 26) / 7.5), 30, 60);
    const gap = Math.max(4, Math.round(ss * 0.1));
    const trayW = TRAY * ss + (TRAY - 1) * gap + 20, trayH = ss + 18, shelfH = Math.round(ss * 0.74) + 8;
    const trayX = Math.round(split + (w - right - split - trayW) / 2);
    const trayY = Math.round(top + shelfH + 14 + Math.max(0, (h - bottom - top - shelfH - 14 - trayH) / 2));
    const win = { x: bx - 14, y: winTop, w: bw + 28, h: (by + bh + ts * 0.35) - winTop, barH };
    R.L = { w, h, dpr, ts, bx, by, bw, bh, ss, gap, lift: ts * 0.075, win, side: true,
      tray: { x: trayX, y: trayY, w: trayW, h: trayH }, shelf: { x: trayX + 10, y: trayY - shelfH - 2, h: shelfH, s: Math.round(ss * 0.74) } };
    R.wallId = '';
    return R.L;
  }
  const availW = Math.max(200, w - left - right - pad * 2);
  let ss = clamp(Math.floor((availW - 26) / 7.5), 34, 66);
  const trayH = ss + 18, shelfH = Math.round(ss * 0.74) + 8;
  const boardTop = winTop + barH + 8;
  const boardBottom = h - bottom - trayH - shelfH - 18;
  const ts = Math.max(18, Math.floor(Math.min((availW - 16) / (GW + 0.5), (boardBottom - boardTop) / (GH + 0.5))));
  ss = Math.min(ss, Math.round(ts * 1.06));
  const bw = ts * GW, bh = ts * GH;
  const bx = Math.round(left + (w - left - right - bw) / 2);
  const by = Math.round(boardTop + Math.max(0, (boardBottom - boardTop - bh) / 2) + ts * 0.15);
  const gap = Math.max(4, Math.round(ss * 0.1));
  const trayW = TRAY * ss + (TRAY - 1) * gap + 20;
  const trayX = Math.round((w - trayW) / 2), trayY = Math.round(h - bottom - trayH - 4);
  const win = { x: 0, y: winTop, w: Math.max(bw + 28, trayW), h: 0, barH };
  win.x = Math.round((w - win.w) / 2);
  win.h = (by + bh + ts * 0.35) - winTop;
  R.L = { w, h, dpr, ts, bx, by, bw, bh, ss, gap, lift: ts * 0.075, win,
    tray: { x: trayX, y: trayY, w: trayW, h: trayH }, shelf: { x: trayX + 10, y: trayY - shelfH - 2, h: shelfH, s: Math.round(ss * 0.74) } };
  R.wallId = '';
  return R.L;
}
export const tilePos = (R, t) => ({ x: R.L.bx + (t.x + 0.5) * R.L.ts - t.z * R.L.lift, y: R.L.by + (t.y + 0.5) * R.L.ts - t.z * R.L.lift * 1.3 });
export function slotPos(R, i) { const { tray, ss, gap } = R.L; return { x: tray.x + 10 + i * (ss + gap) + ss / 2, y: tray.y + tray.h / 2 }; }
export function shelfPos(R, i) { const sh = R.L.shelf; return { x: sh.x + i * (sh.s + 6) + sh.s / 2, y: sh.y + sh.h / 2 }; }

// which tab is under a point (the top one), or null
export function hit(R, S, px, py) {
  if (!R.L) return null;
  const sh = R.L.shelf;
  for (let i = 0; i < S.shelf.length; i++) { const p = shelfPos(R, i); if (Math.abs(px - p.x) <= sh.s / 2 + 3 && Math.abs(py - p.y) <= sh.s / 2 + 3) return S.tiles[S.shelf[i] - 1]; }
  const half = R.L.ts * 0.47;
  let best = null;
  for (const t of S.tiles) {
    if (t.where !== 'board') continue;
    const p = tilePos(R, t);
    if (Math.abs(px - p.x) <= half && Math.abs(py - p.y) <= half && (!best || t.z > best.z)) best = t;
  }
  return best;
}

// how many tabs cover each one (the deep ones are face down on harder boards)
export function recount(R, S) {
  R.cover.clear();
  const on = S.tiles.filter((t) => t.where === 'board');
  for (const t of on) {
    let n = 0;
    for (const u of on) if (u.z > t.z && Math.abs(u.x - t.x) < 0.999 && Math.abs(u.y - t.y) < 0.999) n++;
    R.cover.set(t.id, n);
  }
}

// ---------- her wallpaper (drawn once per size) ----------
function wallpaper(R, id, time) {
  const { L } = R;
  if (R.wallId === id && R.wall) return R.wall;
  const c = R.wall || document.createElement('canvas');
  c.width = Math.round(L.w * L.dpr); c.height = Math.round(L.h * L.dpr);
  const g = c.getContext('2d');
  g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  const grad = (a, b) => { const lg = g.createLinearGradient(0, 0, 0, L.h); lg.addColorStop(0, a); lg.addColorStop(1, b); g.fillStyle = lg; g.fillRect(0, 0, L.w, L.h); };
  switch (id) {
    case 'sunset':
      grad('#ff9a6b', '#4a1f7a');
      g.fillStyle = '#ffd36b'; g.beginPath(); g.arc(L.w * 0.75, L.h * 0.62, Math.min(L.w, L.h) * 0.2, 0, TAU); g.fill();
      g.fillStyle = 'rgba(74, 31, 122, .5)'; for (let i = 0; i < 6; i++) g.fillRect(0, L.h * 0.6 + i * 14, L.w, 5);
      break;
    case 'clouds':
      grad('#8fd3ff', '#cdb8ff');
      g.fillStyle = 'rgba(255, 250, 240, .75)';
      for (let i = 0; i < 9; i++) { const x = ((i * 173) % L.w), y = (i * 97) % L.h; for (let j = 0; j < 3; j++) { g.beginPath(); g.arc(x + j * 26, y + (j % 2) * 8, 24, 0, TAU); g.fill(); } }
      break;
    case 'arcade':
      grad('#1a0b3b', '#3a1b86');
      for (let x = -L.h; x < L.w; x += 36) { g.strokeStyle = 'rgba(255, 77, 166, .22)'; g.lineWidth = 10; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + L.h, L.h); g.stroke(); }
      break;
    case 'galaxy':
      grad('#06031a', '#2b1660');
      for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(255,250,240,${0.3 + (i % 5) / 8})`; g.fillRect((i * 7919) % L.w, (i * 104729) % L.h, i % 7 === 0 ? 2.5 : 1.3, i % 7 === 0 ? 2.5 : 1.3); }
      break;
    case 'hearts':
      grad('#ffb3d6', '#ff6fae');
      g.fillStyle = 'rgba(255, 250, 240, .35)';
      for (let y = 20; y < L.h; y += 48) for (let x = (y / 48 % 2) * 24 + 12; x < L.w; x += 48) { g.beginPath(); g.moveTo(x, y + 7); g.bezierCurveTo(x - 11, y, x - 6, y - 9, x, y - 4); g.bezierCurveTo(x + 6, y - 9, x + 11, y, x, y + 7); g.fill(); }
      break;
    default:
      grad('#1b0f44', '#0f0826');
      g.fillStyle = 'rgba(205, 184, 255, .13)';
      for (let y = 14; y < L.h; y += 26) for (let x = 14; x < L.w; x += 26) g.fillRect(x, y, 2, 2);
  }
  R.wall = c; R.wallId = id;
  return c;
}

export function draw(R, S, dt, { time = 0, wallpaperId = 'grid', hover = null, attract = false, rush = null } = {}) {
  const { ctx, L } = R;
  if (!L) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(wallpaper(R, wallpaperId, time), 0, 0);
  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  ctx.save();
  R.shake.apply(ctx, L.w / 2, L.h / 2);

  // the browser window
  const { win } = L;
  ctx.fillStyle = INK; roundRect(ctx, win.x, win.y + 6, win.w, win.h, 18); ctx.fill();
  ctx.fillStyle = 'rgba(28, 16, 70, .94)'; roundRect(ctx, win.x, win.y, win.w, win.h, 18); ctx.fill();
  ctx.fillStyle = PAPER; roundRect(ctx, win.x, win.y, win.w, win.barH, 18); ctx.fill(); ctx.fillRect(win.x, win.y + win.barH - 10, win.w, 10);
  ctx.lineWidth = 3; ctx.strokeStyle = INK; roundRect(ctx, win.x, win.y, win.w, win.h, 18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(win.x, win.y + win.barH); ctx.lineTo(win.x + win.w, win.y + win.barH); ctx.stroke();
  ['#ff5a5f', '#ffc933', '#3ff0c3'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(win.x + 16 + i * 15, win.y + win.barH / 2, win.barH * 0.2, 0, TAU); ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke(); });
  const open = S.tiles.filter((t) => t.where === 'board' || t.where === 'shelf').length + S.tray.length;
  ctx.fillStyle = INK; ctx.font = `800 ${Math.round(win.barH * 0.5)}px ${MONO}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText(`${open} tab${open === 1 ? '' : 's'} open`, win.x + win.w - 14, win.y + win.barH / 2 + 1);
  if (rush != null) { ctx.textAlign = 'left'; ctx.fillStyle = rush < 15 && Math.floor(time * 3) % 2 ? '#d6124f' : INK; ctx.fillText(`⏱ ${Math.ceil(rush)}s`, win.x + 62, win.y + win.barH / 2 + 1); }

  // the pile
  const on = S.tiles.filter((t) => t.where === 'board').sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);
  const s = L.ts * 0.94;
  for (const t of on) {
    const p = tilePos(R, t);
    const free = isFree(S, t);
    const covered = R.cover.get(t.id) || 0;
    const state = free ? 'free' : R.hideDeep && covered >= 2 ? 'hidden' : 'blocked';
    const wob = R.wobble.get(t.id);
    const ox = wob ? Math.sin(wob * 40) * wob * 18 : 0;
    const glow = hover && hover.id === t.id && free ? 0.9 : 0;
    tab(ctx, t.kind, p.x + ox, p.y, s, { state, lift: Math.max(2, L.lift * 1.2), glow });
  }

  // the taskbar
  const { tray, ss, gap } = L;
  const danger = S.tray.length >= TRAY - 2;
  ctx.fillStyle = INK; roundRect(ctx, tray.x, tray.y + 5, tray.w, tray.h, 18); ctx.fill();
  ctx.fillStyle = danger ? '#ffe0ea' : PAPER; roundRect(ctx, tray.x, tray.y, tray.w, tray.h, 18); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = danger && Math.floor(time * 4) % 2 ? '#ff4da6' : INK; ctx.stroke();
  for (let i = 0; i < TRAY; i++) {
    const p = slotPos(R, i);
    ctx.fillStyle = 'rgba(23, 10, 54, .08)'; roundRect(ctx, p.x - ss / 2, p.y - ss / 2, ss, ss, ss * 0.2); ctx.fill();
    ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(23, 10, 54, .3)'; ctx.stroke(); ctx.setLineDash([]);
  }
  // the shelf (when tabs are parked on it)
  if (S.shelf.length) {
    const sh = L.shelf;
    ctx.fillStyle = 'rgba(255, 250, 240, .16)'; roundRect(ctx, sh.x - 6, sh.y - 2, SHELF * (sh.s + 6) + 6, sh.h + 4, 12); ctx.fill();
    ctx.fillStyle = PAPER; ctx.font = `800 10px ${MONO}`; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText('SHELF', sh.x - 4, sh.y - 4);
  }
  // tabs on their way, in the taskbar, on the shelf
  const k = 1 - Math.exp(-dt * 18);
  const place = (id, tx, ty, ts) => {
    let v = R.vis.get(id);
    if (!v) { v = { x: tx, y: ty, s: ts }; R.vis.set(id, v); }
    v.x += (tx - v.x) * k; v.y += (ty - v.y) * k; v.s += (ts - v.s) * k;
    return v;
  };
  S.shelf.forEach((id, i) => { const p = shelfPos(R, i); const v = place(id, p.x, p.y, L.shelf.s); tab(ctx, S.tiles[id - 1].kind, v.x, v.y, v.s, { lift: 3 }); });
  S.tray.forEach((id, i) => { const p = slotPos(R, i); const v = place(id, p.x, p.y, ss * 0.92); tab(ctx, S.tiles[id - 1].kind, v.x, v.y - (1 - k) * 0, v.s, { lift: 3 }); });

  // three alike, coming together and popping
  for (let i = R.pops.length - 1; i >= 0; i--) {
    const pop = R.pops[i];
    pop.t += dt;
    const q = clamp(pop.t / 0.22, 0, 1);
    for (const m of pop.from) {
      const x = m.x + (pop.cx - m.x) * ease.inCubic(q), y = m.y + (pop.cy - m.y) * ease.inCubic(q);
      tab(ctx, pop.kind, x, y, m.s * (1 + 0.25 * Math.sin(q * Math.PI)), { lift: 3 });
    }
    if (q >= 1 && !pop.burst) {
      pop.burst = true;
      const color = KINDS[pop.kind].color;
      R.parts.burst({ x: pop.cx, y: pop.cy, count: 26, speed: [100, 380], life: [0.4, 0.9], size: [4, 9], colors: [color, PAPER, '#ffc933'], shape: 'star', spin: 8, drag: 2.5 });
      R.parts.burst({ x: pop.cx, y: pop.cy, count: 1, speed: [0, 0], life: [0.4, 0.4], size: [ss * 0.6, ss * 0.6], colors: [PAPER], shape: 'ring', grow: ss * 3 });
      R.floats.add({ x: pop.cx, y: pop.cy - ss * 0.7, text: `+${pop.pts}${pop.combo > 1 ? ` x${pop.combo}` : ''}`, color, size: 24 + pop.combo * 2, life: 0.95, rise: 56, font: `900 1em ${DISPLAY}` });
      R.shake.kick(0.08 + pop.combo * 0.04);
      R.pops.splice(i, 1);
    }
  }

  R.parts.draw(ctx);
  R.floats.draw(ctx);
  ctx.restore();
  if (attract) { ctx.fillStyle = 'rgba(15, 8, 38, .45)'; ctx.fillRect(0, 0, L.w, L.h); }
  if (R.flash > 0 && !REDUCED) { ctx.globalAlpha = Math.min(0.45, R.flash); ctx.fillStyle = '#ff4da6'; ctx.fillRect(0, 0, L.w, L.h); ctx.globalAlpha = 1; }
}

// ---------- effects ----------
export const fx = {
  pick(R, S, e, from) {
    if (!R.vis.has(e.id) && from) R.vis.set(e.id, { x: from.x, y: from.y, s: R.L.ts * 0.94 });
    if (from) R.parts.burst({ x: from.x, y: from.y, count: 6, speed: [40, 140], life: [0.2, 0.45], size: [3, 6], colors: [KINDS[e.kind].color, PAPER], drag: 4 });
  },
  triple(R, e) {
    const from = e.ids.map((id) => R.vis.get(id) || { x: R.L.tray.x + R.L.tray.w / 2, y: R.L.tray.y, s: R.L.ss });
    for (const id of e.ids) R.vis.delete(id);
    const mid = from[1] || from[0];
    R.pops.push({ kind: e.kind, from: from.map((v) => ({ ...v })), cx: mid.x, cy: mid.y, t: 0, pts: e.pts, combo: e.combo });
  },
  blocked(R, id) { R.wobble.set(id, 0.3); },
  full(R) { R.shake.kick(0.6); R.flash = 0.35; },
  clear(R) {
    const { L } = R;
    for (let i = 0; i < 4; i++) R.parts.burst({ x: L.w * (0.2 + i * 0.2), y: L.h * 0.35, count: 26, speed: [140, 460], life: [0.8, 1.6], size: [5, 10], colors: ['#ffc933', '#ff4da6', '#3ff0c3', '#59c8ff', PAPER], gravity: 420, shape: 'square', spin: 10, angle: [-Math.PI * 0.95, -Math.PI * 0.05] });
    R.floats.add({ x: L.w / 2, y: L.by + L.bh * 0.4, text: 'ALL CLOSED!', color: '#3ff0c3', size: 40, life: 1.6, rise: 30, font: `900 1em ${DISPLAY}` });
  },
  shuffle(R, S) { for (const t of S.tiles) if (t.where === 'board') R.wobble.set(t.id, 0.22); R.parts.burst({ x: R.L.bx + R.L.bw / 2, y: R.L.by + R.L.bh / 2, count: 30, speed: [100, 420], life: [0.4, 0.8], size: [3, 7], colors: ['#cdb8ff', PAPER], shape: 'spark' }); },
  update(R, dt) {
    R.parts.update(dt); R.floats.update(dt); R.shake.update(dt);
    R.flash = Math.max(0, R.flash - dt * 2);
    for (const [id, v] of R.wobble) { const n = v - dt; if (n <= 0) R.wobble.delete(id); else R.wobble.set(id, n); }
  },
  reset(R) { R.vis.clear(); R.pops.length = 0; R.parts.clear(); R.floats.clear(); R.wobble.clear(); R.flash = 0; },
};
