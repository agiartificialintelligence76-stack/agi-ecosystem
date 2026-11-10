// AIR GAP: how it looks. "An arcade table at midnight": a deep teal-black table with its air-hole grid, thick honey
// sticker rails with ink outlines and hard shadows, goals as dark slots with pink and mint lips, the centre line a dashed
// seam of brighter holes (the air gap). The score is lit in the table's own holes, like an LED board. Your mallet mint,
// hers pink with a heart cap, the puck honey with a white rim. Glow only on the puck's trail and a goal's flash.
//
// The table's still parts are drawn once into an offscreen canvas (again only when the screen changes); every frame
// draws that, then the moving parts in the table's own units (turned a quarter on a sideways screen), then the words.
import { W, H, MID, CORNER, PUCK_R, MOUTH, SLOT, mouthOf } from './physics.js';
import { RAIL, BOX, toScreen, dirToTable } from './layout.js';
import { chipPos, CHIP_R, LABEL, isOn, lagged, DURATION } from './match.js';
import { roundRect, star, clamp, ease, TAU } from '../kit/fx.js';

export const C = {
  ink: '#170a36', room: '#050d10', table: '#0a1a1f', hole: '#1a3a43', holeLit: '#2e6b78',
  honey: '#ffc933', honey2: '#ffe08a', honeyDeep: '#e0a100',
  mint: '#3ff0c3', mintDeep: '#12a582', pink: '#ff4da6', pinkDeep: '#c81d77',
  paper: '#fffaf0', lav: '#e4d9ff', lav2: '#cdb8ff', violet: '#8b66ff', sky: '#59c8ff', red: '#ff5a5f', green: '#2fd27a',
  slot: '#02070a', white: '#ffffff',
};
export const SIDE_COL = [C.mint, C.pink];
export const SIDE_DEEP = [C.mintDeep, C.pinkDeep];
export const KIND_COL = { firewall: C.red, split: C.violet, lag: C.sky, big: C.green, patch: C.lav2 };

const GRID = 25;
// 5 × 7 LED digits
const DIGITS = [
  '01110100011001110101110011000101110', '00100011000010000100001000010001110', '01110100010000100010001000100011111',
  '11111000100010000010000011000101110', '00010001100101010010111110001000010', '11111100001111000001000011000101110',
  '00110010001000011110100011000101110', '11111000010001000100010000100001000', '01110100011000101110100011000101110',
  '01110100011000101111000010001001100',
];

// ---------- helpers ----------
function rr(ctx, x, y, w, h, r) { roundRect(ctx, x, y, w, h, r); }
// the screen's down-right (where the hard shadows fall) in table units
const sh = { x: 0, y: 0 };
function shadowVec(L, px) {
  dirToTable(L, px * 0.75, px, sh);
  sh.x /= L.s; sh.y /= L.s;
  return sh;
}
// a heart (for her mallet's cap, her face's mood, the table's decal), centred on (x, y), `s` wide
export function heart(ctx, x, y, s) {
  const k = s / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + k * 0.9);
  ctx.bezierCurveTo(x - k * 1.25, y + k * 0.05, x - k * 0.95, y - k * 1.05, x, y - k * 0.42);
  ctx.bezierCurveTo(x + k * 0.95, y - k * 1.05, x + k * 1.25, y + k * 0.05, x, y + k * 0.9);
  ctx.closePath();
}

// The power-ups' icons, drawn in a box of `s` units centred on (x, y) (the chips, the banners, the side badges)
export function kindIcon(ctx, kind, x, y, s, col = C.ink) {
  const u = s / 24;
  ctx.save();
  ctx.translate(x, y); ctx.scale(u, u);
  ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (kind === 'firewall') {
    // a shield of bricks
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(8.5, -6.5); ctx.lineTo(8, 2); ctx.quadraticCurveTo(6.5, 8, 0, 11); ctx.quadraticCurveTo(-6.5, 8, -8, 2); ctx.lineTo(-8.5, -6.5); ctx.closePath(); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-7.5, -2); ctx.lineTo(7.5, -2); ctx.moveTo(-6.5, 4); ctx.lineTo(6.5, 4);
    ctx.moveTo(0, -8); ctx.lineTo(0, -2); ctx.moveTo(-3.5, -2); ctx.lineTo(-3.5, 4); ctx.moveTo(3.5, -2); ctx.lineTo(3.5, 4); ctx.moveTo(0, 4); ctx.lineTo(0, 9); ctx.stroke();
  } else if (kind === 'split') {
    // one puck, three ways
    ctx.beginPath(); ctx.arc(0, 7, 3.6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 3); ctx.lineTo(0, -8); ctx.moveTo(0, 2); ctx.lineTo(-7.5, -6); ctx.moveTo(0, 2); ctx.lineTo(7.5, -6); ctx.stroke();
    for (const [ax, ay, a] of [[0, -9.5, -Math.PI / 2], [-8.5, -7, -2.36], [8.5, -7, -0.79]]) {
      ctx.beginPath(); ctx.moveTo(ax + Math.cos(a) * 1.5, ay + Math.sin(a) * 1.5);
      ctx.lineTo(ax + Math.cos(a + 2.4) * 4, ay + Math.sin(a + 2.4) * 4); ctx.lineTo(ax + Math.cos(a - 2.4) * 4, ay + Math.sin(a - 2.4) * 4); ctx.closePath(); ctx.fill();
    }
  } else if (kind === 'lag') {
    // an hourglass
    ctx.beginPath(); ctx.moveTo(-7, -10); ctx.lineTo(7, -10); ctx.moveTo(-7, 10); ctx.lineTo(7, 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5.5, -10); ctx.quadraticCurveTo(-5.5, -2, 0, 0); ctx.quadraticCurveTo(5.5, -2, 5.5, -10);
    ctx.moveTo(-5.5, 10); ctx.quadraticCurveTo(-5.5, 2, 0, 0); ctx.quadraticCurveTo(5.5, 2, 5.5, 10); ctx.lineWidth = 2.2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-3.6, 8.6); ctx.quadraticCurveTo(0, 3, 3.6, 8.6); ctx.closePath(); ctx.fill();
  } else if (kind === 'big') {
    // a mallet, and arrows outward
    ctx.beginPath(); ctx.arc(0, 0, 4.6, 0, TAU); ctx.fill();
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2, c = Math.cos(a), s2 = Math.sin(a);
      ctx.beginPath(); ctx.moveTo(c * 7, s2 * 7); ctx.lineTo(c * 11, s2 * 11); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c * 12, s2 * 12); ctx.lineTo(c * 12 - c * 4.6 + s2 * 3, s2 * 12 - s2 * 4.6 - c * 3); ctx.lineTo(c * 12 - c * 4.6 - s2 * 3, s2 * 12 - s2 * 4.6 + c * 3); ctx.closePath(); ctx.fill();
    }
  } else if (kind === 'patch') {
    // a plaster
    ctx.rotate(-Math.PI / 4);
    rr(ctx, -11, -5, 22, 10, 5); ctx.lineWidth = 2.4; ctx.stroke();
    rr(ctx, -4, -5, 8, 10, 1.5); ctx.fill();
    ctx.fillStyle = col;
    for (const [dx, dy] of [[-7.5, -1.6], [-7.5, 1.6], [7.5, -1.6], [7.5, 1.6]]) { ctx.beginPath(); ctx.arc(dx, dy, 0.9, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

// ---------- the renderer ----------
export function createRenderer() {
  const R = {
    L: null, dpr: 1, w: 0, h: 0, key: '', layer: null, lctx: null, labels: ['YOU', 'AGI-1'],
    face: null, faceOk: false, digits: [{ v: -1, from: -1, t: 9 }, { v: -1, from: -1, t: 9 }], upside: false,
  };
  if (typeof Image !== 'undefined') {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { R.faceOk = true; };
    img.src = '/images/agi1-live-2d.webp';
    R.face = img;
  }

  // the table's transform: draw in table units from here
  R.toTable = (ctx, dx = 0, dy = 0) => {
    const L = R.L, d = R.dpr;
    if (!L.rot) ctx.setTransform(d * L.s, 0, 0, d * L.s, d * (L.ox + dx), d * (L.oy + dy));
    else ctx.setTransform(0, d * L.s, -d * L.s, 0, d * (L.ox + dx), d * (L.oy + dy));
  };
  R.toScreenSpace = (ctx) => ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);

  // the still layer, made again when the screen, the layout or the labels change
  R.prepare = (L, view, labels, fontsReady) => {
    const key = `${view.w}x${view.h}@${view.dpr}|${L.rot}|${L.s.toFixed(4)}|${L.ox.toFixed(1)},${L.oy.toFixed(1)}|${labels.join('/')}|${fontsReady}`;
    R.L = L; R.dpr = view.dpr; R.w = view.w; R.h = view.h;
    if (key === R.key) return;
    R.key = key; R.labels = labels;
    if (typeof document === 'undefined') return;
    if (!R.layer) { R.layer = document.createElement('canvas'); R.lctx = R.layer.getContext('2d', { alpha: false }); }
    R.layer.width = Math.max(1, Math.round(view.w * view.dpr));
    R.layer.height = Math.max(1, Math.round(view.h * view.dpr));
    drawStill(R, R.lctx);
  };

  R.draw = (ctx, S) => drawFrame(R, ctx, S);
  return R;
}

// ---------- the still layer: the room, the table ----------
function drawStill(R, g) {
  const L = R.L, d = R.dpr;
  g.setTransform(d, 0, 0, d, 0, 0);
  // the room: near black, a warm pool of light under the table, and a halftone of dots fading out to the edges
  g.fillStyle = C.room; g.fillRect(0, 0, R.w, R.h);
  const cx = L.left + L.w / 2, cy = L.top + L.h / 2;
  const pool = g.createRadialGradient(cx, cy, Math.min(L.w, L.h) * 0.2, cx, cy, Math.max(R.w, R.h) * 0.75);
  pool.addColorStop(0, 'rgba(63,240,195,0.07)'); pool.addColorStop(0.5, 'rgba(107,59,255,0.05)'); pool.addColorStop(1, 'rgba(5,13,16,0)');
  g.fillStyle = pool; g.fillRect(0, 0, R.w, R.h);
  g.fillStyle = 'rgba(205,184,255,0.06)';
  const step = 14;
  for (let y = step / 2; y < R.h; y += step) {
    for (let x = ((y / step) % 2 ? step / 2 : 0) + step / 4; x < R.w; x += step) {
      const k = Math.min(1, Math.hypot((x - cx) / (L.w * 0.9 + 1), (y - cy) / (L.h * 0.9 + 1)));
      if (k < 0.55) continue;
      g.beginPath(); g.arc(x, y, 1.1 * k, 0, TAU); g.fill();
    }
  }
  // the table, in its own units
  R.toTable(g);
  const sv = shadowVec(L, 9);
  const OUT = CORNER + RAIL;
  // its hard shadow
  g.fillStyle = 'rgba(2,6,8,0.85)';
  rr(g, -RAIL + sv.x, -RAIL + sv.y, W + RAIL * 2, H + RAIL * 2, OUT); g.fill();
  // the rails: honey, ink outlined, a lighter lip along the inside
  g.fillStyle = C.ink;
  rr(g, -RAIL - 4, -RAIL - 4, W + RAIL * 2 + 8, H + RAIL * 2 + 8, OUT + 4); g.fill();
  g.fillStyle = C.honey;
  rr(g, -RAIL, -RAIL, W + RAIL * 2, H + RAIL * 2, OUT); g.fill();
  g.strokeStyle = C.honey2; g.lineWidth = 5;
  rr(g, -RAIL + 7, -RAIL + 7, W + RAIL * 2 - 14, H + RAIL * 2 - 14, OUT - 7); g.stroke();
  // the bolts along the rails
  g.fillStyle = C.honeyDeep;
  for (let y = 170; y <= H - 170; y += 110) for (const x of [-RAIL / 2, W + RAIL / 2]) { g.beginPath(); g.arc(x, y, 4.2, 0, TAU); g.fill(); }
  for (const y of [-RAIL / 2, H + RAIL / 2]) for (const x of [125, W - 125]) { g.beginPath(); g.arc(x, y, 4.2, 0, TAU); g.fill(); }
  // the surface
  g.fillStyle = C.ink;
  rr(g, -4, -4, W + 8, H + 8, CORNER + 4); g.fill();
  g.fillStyle = C.table;
  rr(g, 0, 0, W, H, CORNER); g.fill();
  // a soft sheen across the middle (the light over the table)
  const sheen = g.createLinearGradient(0, 0, 0, H);
  sheen.addColorStop(0, 'rgba(255,255,255,0)'); sheen.addColorStop(0.5, 'rgba(120,220,230,0.05)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sheen; rr(g, 0, 0, W, H, CORNER); g.fill();
  // the air holes (the centre line's brighter, in dashes: the air gap)
  g.save();
  rr(g, 0, 0, W, H, CORNER); g.clip();
  for (let j = 1; j < H / GRID; j++) {
    const y = j * GRID;
    for (let i = 1; i < W / GRID; i++) {
      const x = i * GRID;
      if (!insideRounded(x, y, 10)) continue;
      const seam = y === MID;
      if (seam) {
        const on = i % 3 !== 0;
        g.fillStyle = on ? 'rgba(63,240,195,0.75)' : C.holeLit;
        g.beginPath(); g.arc(x, y, on ? 3.4 : 2.2, 0, TAU); g.fill();
      } else {
        g.fillStyle = C.hole;
        g.beginPath(); g.arc(x, y, 2, 0, TAU); g.fill();
      }
    }
  }
  // the markings: the centre circle, the creases in front of the goals
  g.lineWidth = 2.5;
  g.strokeStyle = 'rgba(63,240,195,0.22)';
  g.beginPath(); g.arc(W / 2, MID, 92, 0, TAU); g.stroke();
  g.fillStyle = 'rgba(63,240,195,0.35)'; g.beginPath(); g.arc(W / 2, MID, 5, 0, TAU); g.fill();
  for (const side of [0, 1]) {
    const y = side === 0 ? H : 0;
    g.strokeStyle = side === 0 ? 'rgba(63,240,195,0.2)' : 'rgba(255,77,166,0.22)';
    g.beginPath(); g.arc(W / 2, y, 150, side === 0 ? Math.PI : 0, side === 0 ? TAU : Math.PI); g.stroke();
  }
  g.restore();
  // the goals: dark slots through the rails, pink (hers) and mint (yours) lips
  for (const side of [0, 1]) drawSlot(g, side, mouthOf(false));
  // the air gap's label on the seam, and who's who on the end rails
  labelOnTable(R, g, 'AIR GAP', W - 64, MID, 'seam');
  labelOnTable(R, g, R.labels[0], W / 2, H + RAIL / 2 + 1, 'rail');
  labelOnTable(R, g, R.labels[1], W / 2, -RAIL / 2 + 1, 'rail');
  g.setTransform(1, 0, 0, 1, 0, 0);
}

function insideRounded(x, y, m) {
  if (x < m || x > W - m || y < m || y > H - m) return false;
  const k = CORNER - m;
  for (const [cx, cy] of [[CORNER, CORNER], [W - CORNER, CORNER], [CORNER, H - CORNER], [W - CORNER, H - CORNER]]) {
    if ((x < CORNER) === (cx === CORNER) && (y < CORNER || y > H - CORNER) && (y < CORNER) === (cy === CORNER)) {
      if (Math.hypot(x - cx, y - cy) > k) return false;
    }
  }
  return true;
}

function drawSlot(g, side, [l, r]) {
  const y = side === 0 ? H : 0, out = side === 0 ? 1 : -1;
  const y0 = side === 0 ? H - 3 : -RAIL - 6, hgt = RAIL + 9;
  g.fillStyle = C.ink;
  g.fillRect(l - 7, y0 - 2, r - l + 14, hgt + 4);
  g.fillStyle = C.slot;
  g.fillRect(l, y0, r - l, hgt);
  // the slot's depth: a gradient into the dark
  const gr = g.createLinearGradient(0, y, 0, y + out * (RAIL + 6));
  gr.addColorStop(0, 'rgba(255,255,255,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(l, y0, r - l, hgt);
  // the lips: the side's colour on both posts
  g.fillStyle = side === 0 ? C.mint : C.pink;
  g.fillRect(l - 7, y0 - 2, 7, hgt + 4);
  g.fillRect(r, y0 - 2, 7, hgt + 4);
}

// a small word on the table: the seam's label upright for the reader; a rail's along its rail, left of the slot
function labelOnTable(R, g, text, x, y, kind) {
  if (!text) return;
  const L = R.L;
  g.save();
  g.translate(x, y);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (kind === 'seam') {
    if (L.rot) g.rotate(-Math.PI / 2);
    g.font = "900 13px 'AK Display', 'Arial Black', sans-serif";
    const tw = g.measureText(text).width + 16;
    g.fillStyle = C.table; rr(g, -tw / 2, -10, tw, 20, 10); g.fill();
    g.strokeStyle = 'rgba(63,240,195,0.55)'; g.lineWidth = 2; rr(g, -tw / 2, -10, tw, 20, 10); g.stroke();
    g.fillStyle = 'rgba(63,240,195,0.9)';
    g.fillText(text, 0, 1);
  } else {
    g.font = "900 15px 'AK Display', 'Arial Black', sans-serif";
    g.fillStyle = C.ink;
    g.fillText(text, -(MOUTH / 2 + 78), 1);
  }
  g.restore();
}

// ---------- every frame ----------
// S: { M, t, trails, parts, banner, face, hint, digits, upside (2P on a touchscreen: side 1's words turned), flash: [s0, s1], chipPulse }
function drawFrame(R, ctx, S) {
  const L = R.L, M = S.M;
  R.toScreenSpace(ctx);
  ctx.drawImage(R.layer, 0, 0, R.w, R.h);
  R.toTable(ctx, S.shakeX || 0, S.shakeY || 0);
  // goals: PATCH plates, the lip's flash, FIREWALL
  for (const side of [0, 1]) {
    if (isOn(M, side, 'patch')) drawPatch(ctx, side, M.active[side], S.t);
    if (S.flash[side] > 0) goalFlash(ctx, side, S.flash[side]);
  }
  drawDigits(R, ctx, S);
  // the chip
  if (M.chip) drawChip(ctx, M.chip, S.t, L);
  // the serve's breath: a ring counting it down around the waiting puck
  // the pucks (trail first), the mallets
  const sv = shadowVec(L, 4);
  for (const p of M.pucks) drawTrail(ctx, S.trails.get(p.id), p);
  for (const m of M.mallets) drawMalletShadow(ctx, m, sv);
  for (const p of M.pucks) drawPuck(ctx, p, sv, S, M);
  for (const m of M.mallets) drawMallet(ctx, m, S, M, sv);
  for (const side of [0, 1]) if (isOn(M, side, 'firewall')) drawFirewall(ctx, side, M.active[side], S.t);
  S.parts?.draw(ctx);
  // the stall clock
  if (M.stall.t > 3.6 && M.pucks.length === 1 && M.phase === 'play') stallRing(ctx, M.pucks[0], M.stall.t, S.t);
  R.toScreenSpace(ctx);
}

// ---------- the score in the holes ----------
function drawDigits(R, ctx, S) {
  const L = R.L, M = S.M;
  for (const side of [0, 1]) {
    const dd = R.digits[side];
    const v = Math.min(99, M.score[side]);
    if (dd.v !== v) { dd.from = dd.v; dd.v = v; dd.t = dd.from < 0 ? 9 : 0; }
    dd.t += S.dt;
    const turned = side === 1 && S.upside;
    // which way is screen-right and screen-down for this reader, in table units
    const rx = !L.rot ? (turned ? -1 : 1) : 0, ry = !L.rot ? 0 : -1;
    const dx = !L.rot ? 0 : 1, dy = !L.rot ? (turned ? -1 : 1) : 0;
    const cy = side === 0 ? 750 : 250, cx = W / 2;
    const col = SIDE_COL[side];
    const k = dd.t;                         // the flip: old rows go dark top-down, new rows light top-down
    const showOld = k < 0.3 && dd.from >= 0;
    lightNumber(ctx, showOld ? dd.from : v, cx, cy, rx, ry, dx, dy, col, (row) => {
      if (showOld) return row / 7 < 1 - k / 0.3 ? 0.42 : 0;
      if (k < 0.3) return 0;
      const appear = (k - 0.3) / 0.35;
      if (row / 7 > appear) return 0;
      return k < 1.2 ? 0.95 : 0.42 + 0.53 * Math.max(0, 1 - (k - 1.2) / 0.6);
    });
  }
}
function lightNumber(ctx, n, cx, cy, rx, ry, dx, dy, col, alphaOf) {
  const s = String(n);
  const cols = s.length * 6 - 1;
  ctx.fillStyle = col;
  for (let ci = 0; ci < s.length; ci++) {
    const g = DIGITS[s.charCodeAt(ci) - 48] || DIGITS[0];
    for (let r = 0; r < 7; r++) {
      const a = alphaOf(r);
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      for (let c = 0; c < 5; c++) {
        if (g[r * 5 + c] !== '1') continue;
        const u = ci * 6 + c - (cols - 1) / 2, v = r - 3;
        const x = cx + (u * rx + v * dx) * GRID, y = cy + (u * ry + v * dy) * GRID;
        ctx.beginPath(); ctx.arc(x, y, 6.6, 0, TAU); ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
}

// ---------- goals and their power-ups ----------
function goalFlash(ctx, side, k) {
  const y = side === 0 ? H : 0;
  const [l, r] = mouthOf(false);
  const col = side === 0 ? '255,77,166' : '63,240,195';     // the scorer's colour at the goal they scored in
  const g = ctx.createRadialGradient(W / 2, y, 10, W / 2, y, 320);
  g.addColorStop(0, `rgba(${col},${0.55 * k})`); g.addColorStop(1, `rgba(${col},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, side === 0 ? H - 330 : 0, W, 330);
  ctx.fillStyle = `rgba(255,255,255,${0.8 * k})`;
  ctx.fillRect(l, side === 0 ? H - 4 : -4, r - l, 8);
}
function drawPatch(ctx, side, a, t) {
  const y = side === 0 ? H : 0;
  const [l0, r0] = mouthOf(false), [l1, r1] = mouthOf(true);
  const left = a.t;
  const k = Math.min(1, (a.dur - a.t) / 0.3);
  const blink = left < 1.2 && Math.floor(t * 8) % 2 ? 0.45 : 1;
  ctx.globalAlpha = blink;
  for (const [x0, x1] of [[l0, l0 + (l1 - l0) * k], [r0 - (r0 - r1) * k, r0]]) {
    const yy = side === 0 ? H - 7 : -7;
    ctx.fillStyle = C.ink; rr(ctx, x0 - 2, yy - 2, x1 - x0 + 4, 18, 6); ctx.fill();
    ctx.fillStyle = C.lav2; rr(ctx, x0, yy, x1 - x0, 14, 5); ctx.fill();
    ctx.fillStyle = C.ink;
    for (let x = x0 + 8; x < x1 - 4; x += 9) { ctx.beginPath(); ctx.arc(x, yy + 7, 1.6, 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  void y;
}
function drawFirewall(ctx, side, a, t) {
  const [l, r] = mouthOf(isPatchedGuess(a));
  const y = side === 0 ? H - 6 : 6;
  const fade = Math.min(1, (a.dur - a.t) / 0.25);
  const blink = a.t < 1.2 && Math.floor(t * 9) % 2 ? 0.35 : 1;
  const x0 = l - 10, x1 = l - 10 + (r - l + 20) * fade;
  ctx.globalAlpha = blink;
  ctx.fillStyle = C.ink; rr(ctx, x0 - 3, y - 10, x1 - x0 + 6, 20, 9); ctx.fill();
  ctx.save();
  rr(ctx, x0, y - 7, x1 - x0, 14, 7); ctx.clip();
  ctx.fillStyle = C.red; ctx.fillRect(x0, y - 7, x1 - x0, 14);
  ctx.fillStyle = C.honey;
  for (let x = x0 - 20; x < x1 + 20; x += 16) { ctx.beginPath(); ctx.moveTo(x, y + 7); ctx.lineTo(x + 8, y + 7); ctx.lineTo(x + 16, y - 7); ctx.lineTo(x + 8, y - 7); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  if (fade >= 1) {
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(W / 2, y, 13, 0, TAU); ctx.fill();
    ctx.fillStyle = C.paper; ctx.beginPath(); ctx.arc(W / 2, y, 10.5, 0, TAU); ctx.fill();
    kindIcon(ctx, 'firewall', W / 2, y, 16, C.ink);
  }
  ctx.globalAlpha = 1;
}
const isPatchedGuess = () => false;

// ---------- the chip ----------
const cp = { x: 0, y: 0, k: 0 };
function drawChip(ctx, chip, t, L) {
  chipPos(chip, cp);
  const col = KIND_COL[chip.kind];
  const bob = chip.state === 'on' ? Math.sin(t * 4) * 1.5 : 0;
  const pulse = chip.state === 'on' ? 1 + Math.sin(t * 6) * 0.04 : 1;
  const s = CHIP_R * 0.95 * pulse;
  const sv = shadowVec(L, 3);
  ctx.save();
  ctx.translate(cp.x, cp.y + bob);
  // the pins
  ctx.fillStyle = C.lav;
  for (let i = -1; i <= 1; i++) {
    for (const [px, py, w, h] of [[i * 11 - 3, -s - 6, 6, 7], [i * 11 - 3, s - 1, 6, 7], [-s - 6, i * 11 - 3, 7, 6], [s - 1, i * 11 - 3, 7, 6]]) {
      ctx.fillStyle = C.ink; ctx.fillRect(px - 1.5, py - 1.5, w + 3, h + 3);
      ctx.fillStyle = C.lav; ctx.fillRect(px, py, w, h);
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; rr(ctx, -s + sv.x, -s + sv.y, s * 2, s * 2, 9); ctx.fill();
  ctx.fillStyle = C.ink; rr(ctx, -s - 3, -s - 3, s * 2 + 6, s * 2 + 6, 11); ctx.fill();
  ctx.fillStyle = col; rr(ctx, -s, -s, s * 2, s * 2, 9); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; rr(ctx, -s + 4, -s + 4, s * 2 - 8, 7, 3.5); ctx.fill();
  ctx.restore();
  // the icon, upright for the screen
  ctx.save();
  ctx.translate(cp.x, cp.y + bob);
  if (L.rot) ctx.rotate(-Math.PI / 2);
  kindIcon(ctx, chip.kind, 0, 1, s * 1.35, C.ink);
  ctx.restore();
}

// ---------- pucks and mallets ----------
function drawTrail(ctx, tr, p) {
  if (!tr || tr.n < 2) return;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const n = tr.n;
  for (let i = 1; i < n; i++) {
    const a = tr.pts[(tr.i - n + i - 1 + tr.max) % tr.max], b = tr.pts[(tr.i - n + i + tr.max) % tr.max];
    const k = i / n;
    const sp = Math.min(1, b.v / 2200);
    if (sp < 0.15) continue;
    ctx.strokeStyle = `rgba(255,201,51,${0.32 * k * sp})`;
    ctx.lineWidth = PUCK_R * 2 * (0.35 + 0.65 * k);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = `rgba(255,240,190,${0.5 * k * sp})`;
    ctx.lineWidth = PUCK_R * 0.7 * k;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  void p;
}
function drawPuck(ctx, p, sv, S, M) {
  const ghost = p.ghost > 0;
  const r = p.r;
  // a served puck pops in, and waits half-see-through, its ring counting the breath down
  const born = M.phase === 'serve' ? Math.min(1, M.phaseT / 0.22) : 1;
  const sc = born < 1 ? ease.outBack(born) : 1;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(sc, sc);
  ctx.globalAlpha = ghost ? 0.82 : 1;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.arc(sv.x, sv.y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(0, 0, r + 3, 0, TAU); ctx.fill();
  ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.fillStyle = C.honey; ctx.beginPath(); ctx.arc(0, 0, r - 5, 0, TAU); ctx.fill();
  ctx.strokeStyle = C.honeyDeep; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, r - 11, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.ellipse(-sv.x * 1.6, -sv.y * 1.6, r * 0.32, r * 0.22, Math.atan2(sv.y, sv.x), 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  if (ghost) {
    const k = 1 - p.ghost;
    ctx.strokeStyle = SIDE_COL[M.serveTo]; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, r + 11, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
  }
  ctx.restore();
  void S;
}
function drawMalletShadow(ctx, m, sv) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.arc(m.x + sv.x * 1.6, m.y + sv.y * 1.6, m.r, 0, TAU); ctx.fill();
}
function drawMallet(ctx, m, S, M, sv) {
  const side = m.side, col = SIDE_COL[side], deep = SIDE_DEEP[side];
  const lag = lagged(M, side);
  let x = m.x, y = m.y;
  if (lag) { x += Math.sin(S.t * 53) * 2.5; y += Math.cos(S.t * 47) * 2.5; }
  const hitK = S.squash?.[side] || 0;
  const r = m.r * (1 + hitK * 0.06);
  if (lag) {
    // a glitch: the colour channels slip apart
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = C.sky; ctx.beginPath(); ctx.arc(x - 5, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(x + 5, y, r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // the base
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(x, y, r + 3.5, 0, TAU); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = deep; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, r * 0.72, 0, TAU); ctx.stroke();
  // the knob, raised toward the light
  const kr = r * 0.46;
  const kx = x - sv.x * 1.1, ky = y - sv.y * 1.1;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(x + sv.x * 0.4, y + sv.y * 0.4, kr, 0, TAU); ctx.fill();
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(kx, ky, kr + 3, 0, TAU); ctx.fill();
  ctx.fillStyle = deep; ctx.beginPath(); ctx.arc(kx, ky, kr, 0, TAU); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(kx - sv.x * 0.5, ky - sv.y * 0.5, kr * 0.84, 0, TAU); ctx.fill();
  // her cap: a heart (P2's in two-player: a star)
  ctx.save();
  ctx.translate(kx - sv.x * 0.5, ky - sv.y * 0.5);
  if (S.L.rot) ctx.rotate(-Math.PI / 2);
  if (side === 1 && S.upside) ctx.rotate(Math.PI);
  if (side === 1) {
    ctx.fillStyle = C.paper;
    if (S.mode === '2p') { star(ctx, 0, 0, kr * 0.62, kr * 0.28, 5, 0); ctx.fill(); }
    else { heart(ctx, 0, 1, kr * 1.05); ctx.fill(); }
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.ellipse(0, -kr * 0.25, kr * 0.42, kr * 0.26, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
  // BIG MALLET: a ring that breathes
  if (isOn(M, side, 'big')) {
    ctx.strokeStyle = KIND_COL.big; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -S.t * 40;
    ctx.beginPath(); ctx.arc(x, y, r + 10, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
  }
}
function stallRing(ctx, p, st, t) {
  const left = 7 - st;
  const k = 1 - left / 3.4;
  ctx.strokeStyle = Math.floor(t * 6) % 2 ? C.red : C.honey;
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 14, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(1 - k, 0, 1)); ctx.stroke();
}

// ---------- the words over the table (screen space) ----------
// a sticker banner: big words on a pill, popping in; `rot` turns it for the player at the far end
export function banner(ctx, x, y, b, size, rot = 0) {
  const t = b.t, life = b.life;
  const kin = Math.min(1, t / 0.28), kout = Math.max(0, (t - (life - 0.25)) / 0.25);
  const sc = (kin < 1 ? ease.outBack(kin) : 1) * (1 - kout * 0.2);
  const a = 1 - kout;
  if (a <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot + (b.tilt || 0));
  ctx.scale(sc, sc);
  ctx.globalAlpha = a;
  ctx.font = `900 ${size}px 'AK Display', 'Arial Black', sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tw = ctx.measureText(b.text).width;
  const icon = b.kind ? size * 1.05 : 0;
  const w = tw + size * 1.2 + icon, h = size * 1.55;
  ctx.fillStyle = C.ink; rr(ctx, -w / 2 + 5, -h / 2 + 6, w, h, h / 2); ctx.fill();
  ctx.fillStyle = b.bg || C.honey; rr(ctx, -w / 2, -h / 2, w, h, h / 2); ctx.fill();
  ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(2.5, size * 0.11); rr(ctx, -w / 2, -h / 2, w, h, h / 2); ctx.stroke();
  if (b.kind) kindIcon(ctx, b.kind, -w / 2 + size * 0.65 + icon * 0.35, 1, size * 0.95, C.ink);
  ctx.fillStyle = b.fg || C.ink;
  ctx.fillText(b.text, icon / 2, size * 0.06);
  if (b.sub) {
    ctx.font = `800 ${Math.round(size * 0.42)}px 'AK Mono', ui-monospace, monospace`;
    const sw = ctx.measureText(b.sub).width + size * 0.7, shh = size * 0.72;
    ctx.fillStyle = C.ink; rr(ctx, -sw / 2, h / 2 + 4, sw, shh, shh / 2); ctx.fill();
    ctx.fillStyle = C.paper; ctx.fillText(b.sub, 0, h / 2 + 4 + shh / 2 + 1);
  }
  ctx.restore();
}

// her face in a sticker badge, its mood marks, and her speech bubble
export function drawFace(R, ctx, x, y, size, mood, t, bubble, side = 'right') {
  const r = size / 2;
  let wob = 0, dy = 0;
  if (mood.kind === 'smug') wob = Math.sin(mood.t * 9) * 0.12 * Math.max(0, 1 - mood.t / 1.2);
  if (mood.kind === 'flustered') { wob = Math.sin(mood.t * 40) * 0.06 * Math.max(0, 1 - mood.t / 0.8); }
  if (mood.kind === 'cheer') dy = -Math.abs(Math.sin(mood.t * 8)) * 5;
  ctx.save();
  ctx.translate(x, y + dy);
  ctx.rotate(wob);
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(2, 3, r + 3, 0, TAU); ctx.fill();
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(0, 0, r + 3, 0, TAU); ctx.fill();
  ctx.fillStyle = C.lav; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  if (R.faceOk) {
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, r - 2.5, 0, TAU); ctx.clip();
    // her face from the 2D art: centre (300, 300), 150 around
    ctx.drawImage(R.face, 150, 150, 300, 300, -r, -r, size, size);
    if (mood.kind === 'flustered' || mood.kind === 'blush') {
      ctx.fillStyle = 'rgba(255,77,140,0.38)';
      ctx.beginPath(); ctx.ellipse(-r * 0.42, r * 0.3, r * 0.2, r * 0.11, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(r * 0.44, r * 0.3, r * 0.2, r * 0.11, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  ctx.strokeStyle = C.pink; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r - 1, 0, TAU); ctx.stroke();
  ctx.restore();
  // her mood, as a little mark by her face
  const mx = x + r * 0.78, my = y - r * 0.78;
  if (mood.kind === 'doze') {
    ctx.font = `900 ${Math.round(size * 0.3)}px 'AK Display', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < 2; i++) {
      const k = (t * 0.8 + i * 0.5) % 1;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.strokeText('z', mx + k * 10, my - k * 16);
      ctx.fillStyle = C.lav; ctx.fillText('z', mx + k * 10, my - k * 16);
    }
    ctx.globalAlpha = 1;
  } else if (mood.kind === 'flustered' && mood.t < 2.4) {
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.ellipse(mx + 1, my + 2, 6, 8.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = C.sky; ctx.beginPath(); ctx.moveTo(mx, my - 9); ctx.quadraticCurveTo(mx + 6, my, mx, my + 6); ctx.quadraticCurveTo(mx - 6, my, mx, my - 9); ctx.fill();
  } else if ((mood.kind === 'smug' || mood.kind === 'cheer') && mood.t < 2.4) {
    const k = 1 + Math.sin(t * 8) * 0.12;
    ctx.fillStyle = C.ink; heart(ctx, mx + 1, my + 2, 17 * k); ctx.fill();
    ctx.fillStyle = C.pink; heart(ctx, mx, my, 14 * k); ctx.fill();
  }
  if (bubble) drawBubble(ctx, x, y, r, bubble, side);
}
function drawBubble(ctx, x, y, r, b, side) {
  const k = b.t < 0.2 ? ease.outBack(b.t / 0.2) : b.t > b.life - 0.25 ? Math.max(0, (b.life - b.t) / 0.25) : 1;
  if (k <= 0) return;
  const size = b.size || 16;
  ctx.font = `italic 400 ${size}px 'AK Serif', Georgia, serif`;
  const maxW = b.maxW || 260;
  const words = b.text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const tryL = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(tryL).width > maxW - 22 && cur) { lines.push(cur); cur = w; } else cur = tryL;
  }
  if (cur) lines.push(cur);
  const lw = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const w = lw + 22, h = lines.length * size * 1.18 + 14;
  let bx, by;
  if (side === 'right') { bx = x + r + 12; by = y - h / 2; }
  else if (side === 'left') { bx = x - r - 12 - w; by = y - h / 2; }
  else { bx = x - w / 2; by = y + r + 12; }
  ctx.save();
  ctx.globalAlpha = Math.min(1, k);
  const ox = side === 'right' ? bx : side === 'left' ? bx + w : bx + w / 2, oy = side === 'below' ? by : by + h / 2;
  ctx.translate(ox, oy); ctx.scale(Math.max(0.5, k), Math.max(0.5, k)); ctx.translate(-ox, -oy);
  ctx.fillStyle = C.ink; rr(ctx, bx + 3, by + 4, w, h, 12); ctx.fill();
  ctx.fillStyle = C.white; rr(ctx, bx, by, w, h, 12); ctx.fill();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; rr(ctx, bx, by, w, h, 12); ctx.stroke();
  // its tail toward her face
  ctx.fillStyle = C.white; ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5;
  ctx.beginPath();
  if (side === 'right') { ctx.moveTo(bx + 1, by + h / 2 - 7); ctx.lineTo(bx - 9, by + h / 2); ctx.lineTo(bx + 1, by + h / 2 + 7); }
  else if (side === 'left') { ctx.moveTo(bx + w - 1, by + h / 2 - 7); ctx.lineTo(bx + w + 9, by + h / 2); ctx.lineTo(bx + w - 1, by + h / 2 + 7); }
  else { ctx.moveTo(bx + w / 2 - 7, by + 1); ctx.lineTo(bx + w / 2, by - 9); ctx.lineTo(bx + w / 2 + 7, by + 1); }
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, bx + 11, by + 7 + size * 0.62 + i * size * 1.18));
  ctx.restore();
}

// a power-up's badge by its side's end (its icon and the time it has left), screen space
export function powerBadge(ctx, x, y, size, a) {
  const k = clamp(a.t / a.dur, 0, 1);
  const col = KIND_COL[a.kind];
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(x + 2, y + 3, size / 2 + 2, 0, TAU); ctx.fill();
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(x, y, size / 2 + 2, 0, TAU); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, size / 2 - 1, 0, TAU); ctx.fill();
  ctx.strokeStyle = C.paper; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.arc(x, y, size / 2 - 3.5, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
  kindIcon(ctx, a.kind, x, y + 0.5, size * 0.56, C.ink);
}

export { toScreen, LABEL, DURATION, BOX, SLOT };
