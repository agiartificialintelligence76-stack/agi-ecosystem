// OVERCLOCK: how the table looks. A motherboard as a pinball table: a deep violet board with honey traces and pads,
// CPU cores for pop bumpers, RAM sticks for the top lanes, a GPU card for the drop targets, a CPU socket, a cooling fan
// for the spinner, capacitors for posts, a ribbon for the PCIe ramp, a chrome ball. Everything that never moves is
// drawn once into three layers at the screen's scale (the board and its traces · the traces running hot · the parts);
// a frame draws those three pictures, then what moves.
import { BALL_R } from './physics.js';
import {
  W, H, ARCH, GATE_A, FLIPPERS, BUMPERS, LANES, LANE_GUIDES, TARGETS, TARGET_HALF, TARGET_TILT, SOCKET, SPINNER, SLINGS, GUIDES,
  ORBIT_L, ORBIT_GATE, RAMP_WALL, RAMP_TOP, ORBIT_R, U_DEFLECT, RAMP, INSERTS, PLUNGER, arcY, MID,
} from './table.js';
import { SKILL_BANDS } from './sim.js';
import { DW, DH } from './dmd.js';
import { rng as makeRng } from '../kit/fx.js';

export const C = {
  pcb: '#12061f', pcb2: '#1a0a2e', grid: '#21103a', ink: '#170a36', paper: '#fffaf0', lav: '#e4d9ff', lav2: '#cdb8ff',
  violet: '#6b3bff', violet2: '#8b66ff', pink: '#ff4da6', honey: '#ffc933', mint: '#3ff0c3', gold: '#d9a63c', goldDim: '#7a5a24',
  orange: '#ff8a3d', chip: '#26123f', chip2: '#341b55', ram: '#0f6b57', ramChip: '#0a2a24', red: '#ff5a5f',
};
const TAU = Math.PI * 2;
export const FRAME = 10;                 // the cabinet's rail around the table (units)

function canvas(w, h) {
  const c = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(w, h) : document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// ---------- paths ----------
function capsule(ctx, ax, ay, bx, by, r) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-6;
  const nx = (-dy / L) * r, ny = (dx / L) * r;
  const a = Math.atan2(dy, dx);
  ctx.moveTo(ax + nx, ay + ny);
  ctx.arc(ax, ay, r, a + Math.PI / 2, a - Math.PI / 2);
  ctx.lineTo(bx - nx, by - ny);
  ctx.arc(bx, by, r, a - Math.PI / 2, a + Math.PI / 2);
  ctx.closePath();
}
function flipperPath(ctx, f, angle = f.angle) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const tx = f.x + ca * f.len, ty = f.y + sa * f.len;
  const p = Math.asin((f.r1 - f.r2) / f.len);
  ctx.beginPath();
  ctx.arc(f.x, f.y, f.r1, angle + Math.PI / 2 + p, angle - Math.PI / 2 - p);
  ctx.arc(tx, ty, f.r2, angle - Math.PI / 2 - p, angle + Math.PI / 2 + p);
  ctx.closePath();
}
// a rounded rectangle centred on (x, y), turned by a
function rrect(ctx, x, y, w, h, r, a = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  const x0 = -w / 2, y0 = -h / 2;
  ctx.beginPath();
  ctx.moveTo(x0 + r, y0); ctx.arcTo(x0 + w, y0, x0 + w, y0 + h, r); ctx.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
  ctx.arcTo(x0, y0 + h, x0, y0, r); ctx.arcTo(x0, y0, x0 + w, y0, r); ctx.closePath();
  ctx.restore();
}
function arrowPath(ctx, x, y, a, len = 30, wid = 20) {
  const ca = Math.cos(a), sa = Math.sin(a);
  const P = (u, v) => [x + ca * u - sa * v, y + sa * u + ca * v];
  const pts = [P(len / 2, 0), P(-len * 0.05, -wid / 2), P(-len * 0.05, -wid / 4.2), P(-len / 2, -wid / 4.2), P(-len / 2, wid / 4.2), P(-len * 0.05, wid / 4.2), P(-len * 0.05, wid / 2)];
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
}
const mono = (px, w = 700) => `${w} ${px}px 'AK Mono', ui-monospace, monospace`;
const disp = (px, w = 900) => `${w} ${px}px 'AK Display', 'Arial Black', sans-serif`;

// ---------- the board: background, grid, traces ----------
function traces(seed = 11) {
  // buses of parallel traces in 45° steps, and short runs ending in pads (the same every time)
  const r = makeRng(seed);
  const runs = [];
  const dirs = [[1, 0], [0.7071, 0.7071], [0, 1], [-0.7071, 0.7071], [-1, 0], [-0.7071, -0.7071], [0, -1], [0.7071, -0.7071]];
  const bus = (x, y, steps, n, gap = 7) => {
    for (let k = 0; k < n; k++) {
      let px = x, py = y;
      const pts = [];
      let first = true;
      for (const [d, len] of steps) {
        const [dx, dy] = dirs[d];
        if (first) { px += -dy * gap * k; py += dx * gap * k; pts.push([px, py]); first = false; }
        px += dx * (len + (d % 2 ? 0 : 0)); py += dy * len;
        pts.push([px, py]);
      }
      runs.push({ pts, pad: k === n - 1 || r.chance(0.5), w: 2.2 });
    }
  };
  // from the cores toward the edges, under the lanes, down the sides, around the socket
  bus(196, 245, [[3, 60], [2, 120], [3, 40], [2, 160]], 4);
  bus(355, 236, [[1, 50], [2, 110], [1, 40], [2, 90]], 4);
  bus(250, 330, [[2, 50], [3, 30], [2, 30]], 3);
  bus(300, 330, [[2, 40], [1, 30], [2, 30]], 3);
  bus(30, 700, [[0, 40], [1, 40], [2, 50]], 3);
  bus(160, 520, [[0, 40], [1, 60], [0, 50], [2, 60]], 4);
  bus(470, 520, [[4, 30], [3, 60], [2, 80]], 3);
  bus(440, 360, [[2, 60], [3, 40], [2, 30]], 4);
  bus(140, 300, [[1, 40], [0, 30], [1, 50]], 3);
  bus(220, 600, [[0, 140], [1, 30]], 3, 8);
  bus(250, 700, [[0, 80], [2, 40], [0, 70]], 3);
  bus(180, 800, [[1, 40], [0, 120], [7, 40]], 2, 9);
  for (let i = 0; i < 26; i++) {
    let x = r.range(40, 540), y = r.range(170, 980);
    const pts = [[x, y]];
    let d = r.int(0, 7);
    for (let s = 0; s < r.int(1, 3); s++) {
      const len = r.range(16, 60);
      x += dirs[d][0] * len; y += dirs[d][1] * len;
      pts.push([x, y]);
      d = (d + (r.chance(0.5) ? 1 : 7)) % 8;
    }
    runs.push({ pts, pad: true, w: 1.6 });
  }
  return runs;
}
const TRACES = traces();

function drawBoard(ctx) {
  // the board and a fine grid (the solder mask's texture)
  ctx.fillStyle = C.pcb;
  ctx.fillRect(-FRAME, -FRAME, W + FRAME * 2, H + FRAME * 2);
  ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 20) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y <= H; y += 20) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1;
  // mounting holes, a few silkscreen marks
  ctx.strokeStyle = C.goldDim; ctx.lineWidth = 3;
  for (const [x, y] of [[44, 330], [520, 600], [40, 1020], [530, 1020]]) { ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.stroke(); }
}
function drawTraces(ctx, color, padColor, alpha) {
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const t of TRACES) {
    ctx.strokeStyle = color; ctx.lineWidth = t.w;
    ctx.beginPath();
    t.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
    if (t.pad) {
      const [x, y] = t.pts[t.pts.length - 1];
      ctx.fillStyle = padColor; ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill();
      ctx.fillStyle = C.pcb; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ---------- the parts that never move ----------
const rails = () => [ORBIT_L, RAMP_WALL, RAMP_TOP, ORBIT_R, U_DEFLECT, ...GUIDES];
function railStroke(ctx, pts, r, color = C.lav2) {
  const path = () => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  path(); ctx.save(); ctx.translate(3, 4); ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = r * 2 + 3; ctx.stroke(); ctx.restore();
  path(); ctx.strokeStyle = C.ink; ctx.lineWidth = r * 2 + 3; ctx.stroke();
  path(); ctx.strokeStyle = color; ctx.lineWidth = r * 2 - 1; ctx.stroke();
  ctx.save(); ctx.translate(-0.8, -0.8); path(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
}
function post(ctx, x, y, r = 7) {
  // a capacitor seen from above: a can with its stripe
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.arc(x + 3, y + 4, r + 1.5, 0, TAU); ctx.fill();
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(x, y, r + 1.5, 0, TAU); ctx.fill();
  ctx.fillStyle = C.paper; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = C.pink; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(x, y, r - 2, -0.6, 0.9); ctx.stroke();
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, TAU); ctx.fill();
}
function label(ctx, txt, x, y, { size = 11, color = 'rgba(255,250,240,.5)', a = 0, align = 'center', font = mono } = {}) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  ctx.font = font(size); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillText(txt, 0, 0);
  ctx.restore();
}

function drawParts(ctx, sprite) {
  // the shooter lane's floor and the apron's shadow line
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.fillRect(560, 300, 34, 800);
  // the cabinet: the side rails and the top arch, a thick ink band with a violet edge
  ctx.lineCap = 'butt';
  const cab = () => {
    ctx.beginPath();
    ctx.moveTo(14, H + 20); ctx.lineTo(14, ARCH.y);
    ctx.arc(ARCH.x, ARCH.y, ARCH.out + 4, Math.PI, TAU);
    ctx.lineTo(598, H + 20);
  };
  cab(); ctx.strokeStyle = C.ink; ctx.lineWidth = 16; ctx.stroke();
  cab(); ctx.strokeStyle = C.violet; ctx.lineWidth = 6; ctx.stroke();
  cab(); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.2; ctx.stroke();
  // the shooter lane's wall and its curve over the top
  railStroke(ctx, [[556, H + 10], [556, ARCH.y]], 4);
  ctx.beginPath(); ctx.arc(ARCH.x, ARCH.y, ARCH.inner, GATE_A, TAU);
  ctx.strokeStyle = C.ink; ctx.lineWidth = 11; ctx.stroke();
  ctx.beginPath(); ctx.arc(ARCH.x, ARCH.y, ARCH.inner, GATE_A, TAU); ctx.strokeStyle = C.lav2; ctx.lineWidth = 7; ctx.stroke();
  // the gates (thin one-way flaps)
  const gate = (ax, ay, bx, by) => { ctx.strokeStyle = C.honey; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); };
  gate(ARCH.x + Math.cos(GATE_A) * ARCH.inner, ARCH.y + Math.sin(GATE_A) * ARCH.inner, ARCH.x + Math.cos(GATE_A) * (ARCH.out + 2), ARCH.y + Math.sin(GATE_A) * (ARCH.out + 2));
  gate(ORBIT_GATE[0][0] + 2, ORBIT_GATE[0][1], ORBIT_GATE[1][0], ORBIT_GATE[1][1]);
  // RAM sticks: the lane guides
  for (const x of LANE_GUIDES) {
    const y0 = arcY(x) + 36 - 5, y1 = 142 + 5;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; rrect(ctx, x + 3, (y0 + y1) / 2 + 4, 12, y1 - y0, 3); ctx.fill();
    ctx.fillStyle = C.ink; rrect(ctx, x, (y0 + y1) / 2, 13, y1 - y0 + 2, 3.5); ctx.fill();
    ctx.fillStyle = C.ram; rrect(ctx, x, (y0 + y1) / 2, 9, y1 - y0 - 2, 2); ctx.fill();
    ctx.fillStyle = C.ramChip;
    for (let y = y0 + 6; y < y1 - 14; y += 11) ctx.fillRect(x - 3, y, 6, 7);
    ctx.fillStyle = C.gold;
    for (let i = -1; i <= 1; i++) ctx.fillRect(x - 3.4 + (i + 1) * 2.4, y1 - 9, 1.4, 6);
  }
  // the rails
  for (const r of rails()) railStroke(ctx, r, 4);
  // lanes' letters under the lights (silkscreen)
  // the in/outlane posts
  for (const g of GUIDES) post(ctx, g[0][0], g[0][1], 7);
  // the slingshots: pink plastic triangles, the kicking rubber white
  for (const s of SLINGS) {
    const tri = () => { ctx.beginPath(); ctx.moveTo(...s.a); ctx.lineTo(...s.b); ctx.lineTo(...s.c); ctx.closePath(); };
    ctx.save(); ctx.translate(4, 5); tri(); ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fill(); ctx.restore();
    tri(); ctx.lineJoin = 'round'; ctx.strokeStyle = C.ink; ctx.lineWidth = 13; ctx.stroke();
    tri(); ctx.fillStyle = C.pink; ctx.fill();
    ctx.strokeStyle = C.paper; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(...s.a); ctx.lineTo(...s.b); ctx.lineTo(...s.c); ctx.stroke();
    // a stripe and a little bolt
    const cx = (s.a[0] + s.b[0] + s.c[0]) / 3, cy = (s.a[1] + s.b[1] + s.c[1]) / 3;
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(cx - 2, cy - 4, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(cx - 2, cy - 4, 2.6, 0, TAU); ctx.fill();
    for (const p of [s.a, s.b, s.c]) post(ctx, p[0], p[1], 6);
  }
  // the CPU cores' chip bodies (their caps are drawn live)
  BUMPERS.forEach((b, i) => {
    const s = b.r * 2 + 8;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; rrect(ctx, b.x + 4, b.y + 5, s, s, 13); ctx.fill();
    // pins
    ctx.fillStyle = C.gold;
    for (let k = -2; k <= 2; k++) {
      const o = k * 9.5;
      ctx.fillRect(b.x + o - 1.6, b.y - s / 2 - 5, 3.2, 6); ctx.fillRect(b.x + o - 1.6, b.y + s / 2 - 1, 3.2, 6);
      ctx.fillRect(b.x - s / 2 - 5, b.y + o - 1.6, 6, 3.2); ctx.fillRect(b.x + s / 2 - 1, b.y + o - 1.6, 6, 3.2);
    }
    ctx.fillStyle = C.ink; rrect(ctx, b.x, b.y, s + 3, s + 3, 14); ctx.fill();
    ctx.fillStyle = C.chip2; rrect(ctx, b.x, b.y, s - 2, s - 2, 12); ctx.fill();
    ctx.fillStyle = C.chip; rrect(ctx, b.x, b.y, s - 10, s - 10, 9); ctx.fill();
    label(ctx, `CORE ${i}`, b.x, b.y + s / 2 + 12, { size: 8.5, color: 'rgba(255,250,240,.45)' });
  });
  // the GPU card behind the targets: a long board with fins and its gold edge
  {
    const cx = TARGETS[1].x, cy = TARGETS[1].y - 22, a = TARGET_TILT;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; rrect(ctx, cx + 4, cy + 5, 178, 46, 8, a); ctx.fill();
    ctx.fillStyle = C.ink; rrect(ctx, cx, cy, 180, 48, 9, a); ctx.fill();
    ctx.fillStyle = '#2c1650'; rrect(ctx, cx, cy, 172, 40, 7, a); ctx.fill();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
    ctx.strokeStyle = 'rgba(205,184,255,.35)'; ctx.lineWidth = 2;
    for (let x = -78; x <= 78; x += 7) { ctx.beginPath(); ctx.moveTo(x, -15); ctx.lineTo(x, 2); ctx.stroke(); }
    ctx.fillStyle = C.gold;
    for (let x = -80; x < 80; x += 5) ctx.fillRect(x, -21, 3, 4);
    ctx.font = mono(8.5); ctx.fillStyle = 'rgba(255,250,240,.55)'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText('GPU · 3 CORES', 80, -9);
    ctx.restore();
  }
  // the CPU socket: a gold frame, a pin grid, its hole
  {
    const { x, y } = SOCKET, s = 66;
    ctx.fillStyle = 'rgba(0,0,0,.45)'; rrect(ctx, x + 4, y + 5, s, s, 6); ctx.fill();
    ctx.fillStyle = C.ink; rrect(ctx, x, y, s + 4, s + 4, 7); ctx.fill();
    ctx.fillStyle = C.gold; rrect(ctx, x, y, s, s, 5); ctx.fill();
    ctx.fillStyle = '#3b2160'; rrect(ctx, x, y, s - 10, s - 10, 3); ctx.fill();
    ctx.fillStyle = 'rgba(217,166,60,.7)';
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) if (Math.hypot(i, j) > 2.2) ctx.fillRect(x + i * 7 - 1, y + j * 7 - 1, 2, 2);
    ctx.fillStyle = C.honey; ctx.beginPath(); ctx.moveTo(x - s / 2 + 4, y + s / 2 - 4); ctx.lineTo(x - s / 2 + 14, y + s / 2 - 4); ctx.lineTo(x - s / 2 + 4, y + s / 2 - 14); ctx.fill();
    label(ctx, 'SOCKET AGI-1', x, y + s / 2 + 11, { size: 8.5, color: 'rgba(255,250,240,.5)' });
  }
  // the fan's housing over the right orbit (its rotor is drawn live)
  {
    const x = (SPINNER.x0 + SPINNER.x1) / 2, y = SPINNER.y;
    ctx.fillStyle = 'rgba(0,0,0,.4)'; rrect(ctx, x + 3, y + 4, 50, 50, 8); ctx.fill();
    ctx.fillStyle = C.ink; rrect(ctx, x, y, 52, 52, 9); ctx.fill();
    ctx.fillStyle = '#2a1748'; rrect(ctx, x, y, 46, 46, 7); ctx.fill();
    ctx.fillStyle = '#0d0418'; ctx.beginPath(); ctx.arc(x, y, 20, 0, TAU); ctx.fill();
    for (const [dx, dy] of [[-18, -18], [18, -18], [-18, 18], [18, 18]]) { ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(x + dx, y + dy, 2.2, 0, TAU); ctx.fill(); }
    label(ctx, 'FAN', x, y + 36, { size: 8.5, color: 'rgba(255,250,240,.5)' });
  }
  // silkscreen: the board's name, the ramp's and the orbits' names
  label(ctx, 'PCIe ×16', 104, 610, { size: 10, a: -1.37, color: 'rgba(255,250,240,.45)' });
  label(ctx, 'ORBIT', 40, 520, { size: 9, a: -Math.PI / 2, color: 'rgba(255,250,240,.35)' });
  label(ctx, 'ORBIT', 528, 515, { size: 9, a: -Math.PI / 2, color: 'rgba(255,250,240,.35)' });
  label(ctx, 'AGI-1 MAINBOARD · REV 2.6', MID, 960, { size: 9, color: 'rgba(255,250,240,.28)' });
  // the apron: the plate the flippers stand on
  {
    const plate = () => {
      ctx.beginPath();
      ctx.moveTo(14, 1036); ctx.lineTo(172, 1036); ctx.lineTo(236, 1070); ctx.lineTo(236, H + 20); ctx.lineTo(14, H + 20); ctx.closePath();
      ctx.moveTo(556, 1036); ctx.lineTo(402, 1036); ctx.lineTo(338, 1070); ctx.lineTo(338, H + 20); ctx.lineTo(556, H + 20); ctx.closePath();
    };
    ctx.save(); ctx.translate(0, -3); plate(); ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fill(); ctx.restore();
    plate(); ctx.fillStyle = C.ink; ctx.fill();
    ctx.strokeStyle = C.violet; ctx.lineWidth = 3; ctx.stroke();
    label(ctx, 'OVERCLOCK', 112, 1072, { size: 15, font: disp, color: C.lav });
    label(ctx, 'FLIP FAST · RUN HOT', 112, 1088, { size: 7.5, color: 'rgba(228,217,255,.6)' });
    label(ctx, 'AGI-1 · 3 BALLS', 452, 1072, { size: 9, color: 'rgba(228,217,255,.7)' });
    label(ctx, 'REPLAY · LOCAL', 452, 1087, { size: 7.5, color: 'rgba(228,217,255,.45)' });
  }
  // the plunger's housing
  ctx.fillStyle = C.ink; ctx.fillRect(558, 1084, 38, 30);
  // her pixel figure printed on the board between the slingshots
  if (sprite) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, MID - 31, 708, 62, 124);
    ctx.restore();
  }
}

// ---------- the renderer ----------
export function createRenderer() {
  const R = { scale: 0, dpr: 1, layers: null, sprite: null, ball: null, glow: {}, dotMask: null, dotKey: '', dmdC: null, dmdImg: null };
  R.setSprite = (img) => { R.sprite = img; R.scale = 0; };
  // (re)draws the static layers for this scale
  R.prepare = (scale, dpr) => {
    if (Math.abs(scale - R.scale) < 1e-4 && dpr === R.dpr && R.layers) return;
    R.scale = scale; R.dpr = dpr;
    const k = scale * dpr;
    const w = Math.ceil((W + FRAME * 2) * k), h = Math.ceil((H + FRAME * 2) * k);
    const mk = () => { const c = canvas(w, h); const g = c.getContext('2d'); g.setTransform(k, 0, 0, k, FRAME * k, FRAME * k); return [c, g]; };
    const [a, ga] = mk(); drawBoard(ga); drawTraces(ga, C.gold, C.gold, 0.5);
    const [hot, gh] = mk(); drawTraces(gh, C.pink, C.orange, 1);
    const [p, gp] = mk(); drawParts(gp, R.sprite);
    R.layers = { a, hot, p, w, h };
    // the ball: chrome, lit from the top left
    const bs = Math.ceil((BALL_R * 2 + 4) * k);
    const bc = canvas(bs, bs), gb = bc.getContext('2d');
    gb.setTransform(k, 0, 0, k, 0, 0);
    const c0 = BALL_R + 2;
    const g = gb.createRadialGradient(c0 - 4, c0 - 5, 1, c0, c0, BALL_R);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, '#e9e6f2'); g.addColorStop(0.62, '#9a95ad'); g.addColorStop(0.9, '#4c4663'); g.addColorStop(1, '#2b2540');
    gb.fillStyle = g; gb.beginPath(); gb.arc(c0, c0, BALL_R, 0, TAU); gb.fill();
    gb.fillStyle = 'rgba(255,77,166,.28)'; gb.beginPath(); gb.ellipse(c0 + 2, c0 + 7, 8, 3.5, 0, 0, TAU); gb.fill();
    gb.fillStyle = 'rgba(255,255,255,.95)'; gb.beginPath(); gb.ellipse(c0 - 4.5, c0 - 5, 3.4, 2.3, -0.6, 0, TAU); gb.fill();
    gb.strokeStyle = 'rgba(23,10,54,.9)'; gb.lineWidth = 1.4; gb.beginPath(); gb.arc(c0, c0, BALL_R - 0.4, 0, TAU); gb.stroke();
    R.ball = bc; R.ballSize = bs / k;
    // soft glows for lit inserts, one per colour
    for (const [name, col] of [['honey', C.honey], ['pink', C.pink], ['mint', C.mint], ['orange', C.orange], ['white', '#ffffff']]) {
      const s = Math.ceil(64 * k), gc = canvas(s, s), gg = gc.getContext('2d');
      const rg = gg.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      rg.addColorStop(0, col); rg.addColorStop(0.35, `${col}88`); rg.addColorStop(1, `${col}00`);
      gg.fillStyle = rg; gg.fillRect(0, 0, s, s);
      R.glow[name] = gc;
    }
  };

  // the table, in units (the caller has set the transform: 1 unit = scale CSS px, the table's top-left at 0,0)
  R.draw = (ctx, S, v) => {
    const L = R.layers;
    if (!L) return;
    const k = R.scale;
    // the static layers: drawn in device pixels exactly where they belong (no resampling)
    ctx.save();
    const m = ctx.getTransform();
    ctx.setTransform(1, 0, 0, 1, Math.round(m.e - FRAME * k * R.dpr), Math.round(m.f - FRAME * k * R.dpr));
    ctx.drawImage(L.a, 0, 0);
    if (v.heat > 0.01) { ctx.globalAlpha = Math.min(1, v.heat); ctx.drawImage(L.hot, 0, 0); ctx.globalAlpha = 1; }
    ctx.drawImage(L.p, 0, 0);
    ctx.restore();
    drawLive(ctx, S, v, R);
  };

  // ---------- the dot-matrix display ----------
  R.paintDMD = (ctx, dmd, x, y, w, h, { glow = 0.35 } = {}) => {
    if (!R.dmdC) { R.dmdC = canvas(DW, DH); R.dmdG = R.dmdC.getContext('2d'); R.dmdImg = R.dmdG.createImageData(DW, DH); }
    const img = R.dmdImg.data, buf = dmd.buf;
    for (let i = 0; i < buf.length; i++) {
      const c = DOT[buf[i]] || DOT[0];
      const o = i * 4;
      img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2]; img[o + 3] = 255;
    }
    R.dmdG.putImageData(R.dmdImg, 0, 0);
    const dpr = R.dpr;
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    const key = `${pw}x${ph}`;
    if (R.dotKey !== key) {
      // the mask: the bezel's black with a round hole for each dot
      R.dotKey = key;
      const mc = canvas(pw, ph), mg = mc.getContext('2d');
      mg.fillStyle = '#07030d'; mg.fillRect(0, 0, pw, ph);
      mg.globalCompositeOperation = 'destination-out';
      const sx = pw / DW, sy = ph / DH, rr = Math.min(sx, sy) * 0.42;
      mg.beginPath();
      for (let j = 0; j < DH; j++) for (let i = 0; i < DW; i++) { const cx = (i + 0.5) * sx, cy = (j + 0.5) * sy; mg.moveTo(cx + rr, cy); mg.arc(cx, cy, rr, 0, TAU); }
      mg.fill();
      R.dotMask = mc;
    }
    ctx.save();
    const m = ctx.getTransform();
    const X = Math.round(m.a * x + m.e), Y = Math.round(m.d * y + m.f);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(R.dmdC, X, Y, pw, ph);
    ctx.drawImage(R.dotMask, X, Y);
    if (glow > 0) {
      ctx.imageSmoothingEnabled = true;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = glow;
      ctx.drawImage(R.dmdC, X - pw / DW, Y - ph / DH, pw + (2 * pw) / DW, ph + (2 * ph) / DH);
    }
    ctx.restore();
  };
  return R;
}
// the dots' colours: off, amber 1–4, pink 5–8
const DOT = [[38, 16, 8], [118, 52, 12], [178, 84, 18], [236, 128, 34], [255, 190, 92], [96, 22, 56], [168, 36, 98], [236, 66, 148], [255, 150, 200]];

// ---------- what moves ----------
function insert(ctx, R, x, y, a, on, col, glowName, { len = 30, wid = 20, blink = 0, t = 0 } = {}) {
  const lit = on && (!blink || Math.sin(t * blink * TAU) > -0.2);
  if (lit) { const s = 52; ctx.globalAlpha = 0.75; ctx.drawImage(R.glow[glowName], x - s / 2, y - s / 2, s, s); ctx.globalAlpha = 1; }
  arrowPath(ctx, x, y, a, len, wid);
  ctx.fillStyle = lit ? col : 'rgba(255,255,255,.08)'; ctx.fill();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.stroke();
  if (lit) { arrowPath(ctx, x - 1, y - 1.5, a, len * 0.6, wid * 0.45); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fill(); }
}
function roundInsert(ctx, R, x, y, r, on, col, glowName, txt, { t = 0, blink = 0 } = {}) {
  const lit = on && (!blink || Math.sin(t * blink * TAU) > -0.2);
  if (lit) { const s = r * 5; ctx.globalAlpha = 0.7; ctx.drawImage(R.glow[glowName], x - s / 2, y - s / 2, s, s); ctx.globalAlpha = 1; }
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(x, y, r + 2, 0, TAU); ctx.fill();
  ctx.fillStyle = lit ? col : '#2a1847'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  if (lit) { ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.35, r * 0.35, 0, TAU); ctx.fill(); }
  if (txt) { ctx.font = disp(r * 1.05); ctx.fillStyle = lit ? C.ink : 'rgba(228,217,255,.45)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x, y + r * 0.06); }
}

function drawLive(ctx, S, v, R) {
  const t = v.t, Rs = S.R, F = S.flash;
  const agi = Rs.agi > 0, mb = Rs.multiball;
  const all = agi && Math.sin(t * 8 * TAU / 2) > -0.3;   // AGI MODE: every shot blinks
  // inserts: arrows at the shots
  const I = INSERTS;
  insert(ctx, R, I.ramp.x, I.ramp.y, I.ramp.a, mb || all || Rs.mission?.on === 'ramp', mb ? C.pink : C.mint, mb ? 'pink' : 'mint', { blink: mb ? 3 : 0, t });
  insert(ctx, R, I.orbitL.x, I.orbitL.y, I.orbitL.a, all || Rs.mission?.on === 'orbit', C.mint, 'mint', { t });
  insert(ctx, R, I.orbitR.x, I.orbitR.y, I.orbitR.a, all || Rs.mission?.on === 'orbit' || Rs.mission?.on === 'spin', C.mint, 'mint', { t });
  insert(ctx, R, I.gpu.x, I.gpu.y, I.gpu.a, all || (!Rs.lockLit && !mb), C.honey, 'honey', { blink: Rs.mission?.on === 'gpuAll' ? 2 : 0, t, len: 26, wid: 18 });
  const sockOn = Rs.agiReady || Rs.lockLit || all;
  insert(ctx, R, I.socket.x, I.socket.y, I.socket.a, sockOn, Rs.agiReady ? C.pink : C.honey, Rs.agiReady ? 'pink' : 'honey', { blink: 2.5, t });
  // the R-A-M lane lights
  LANES.forEach((l, i) => {
    const skill = S.phase === 'launch' && Rs.skillLane === i;
    roundInsert(ctx, R, l.x, 96, 10, Rs.ram[i] || skill || all || F.lane[i] > 0.3, skill ? C.pink : C.mint, skill ? 'pink' : 'mint', 'RAM'[i], { t, blink: skill ? 3 : 0 });
  });
  // the multiplier row and the four mission lights (toward AGI MODE)
  for (let i = 0; i < 5; i++) roundInsert(ctx, R, MID - 64 + i * 32, 905, 10.5, Rs.bonusX >= i + 2, C.honey, 'honey', `${i + 2}×`, { t });
  roundInsert(ctx, R, MID, 652, 18, Rs.agiReady || agi, C.pink, 'pink', 'AGI', { t, blink: Rs.agiReady ? 2 : 0 });
  for (let i = 0; i < 4; i++) roundInsert(ctx, R, MID - 39 + i * 26, 690, 7, Rs.wizard > i || Rs.agiReady || agi, C.pink, 'pink', `${i + 1}`, { t, blink: Rs.agiReady ? 2 : 0 });
  // lock lights by the socket, ball save between the flippers
  for (let i = 0; i < 2; i++) roundInsert(ctx, R, SOCKET.x - 14 + i * 28, SOCKET.y + 62, 6.5, Rs.locked > i || (mb && Math.sin(t * 12) > 0), C.honey, 'honey', '', { t });
  roundInsert(ctx, R, MID, 1004, 11, Rs.ballSave > 0, C.mint, 'mint', 'SAVE', { t, blink: Rs.ballSave > 0 && Rs.ballSave < 2.5 ? 4 : 0 });
  // the socket's ring (lock lit / AGI ready) and the ball sitting in it
  if (sockOn || F.socket > 0.05) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 7);
    ctx.strokeStyle = Rs.agiReady ? C.pink : C.honey; ctx.lineWidth = 3 + F.socket * 4;
    ctx.globalAlpha = Math.max(F.socket, sockOn ? 0.45 + pulse * 0.5 : 0);
    ctx.beginPath(); ctx.arc(SOCKET.x, SOCKET.y, SOCKET.r + 6 + pulse * 3, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = '#05020a'; ctx.beginPath(); ctx.arc(SOCKET.x, SOCKET.y, SOCKET.r, 0, TAU); ctx.fill();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke();
  // drop targets
  S.T.targets.forEach((c, i) => {
    const tg = TARGETS[i], down = Rs.gpu[i];
    ctx.save(); ctx.translate(tg.x, tg.y); ctx.rotate(TARGET_TILT);
    if (down) {
      ctx.fillStyle = '#0a0414'; ctx.fillRect(-TARGET_HALF, -3, TARGET_HALF * 2, 6);
      ctx.font = disp(11); ctx.fillStyle = C.mint; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('GPU'[i], 0, 18);
    } else {
      const f = F.target[i];
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(-TARGET_HALF + 3, -6 + 4, TARGET_HALF * 2, 13);
      ctx.fillStyle = C.ink; ctx.fillRect(-TARGET_HALF - 1.5, -7.5, TARGET_HALF * 2 + 3, 15);
      ctx.fillStyle = f > 0.2 ? '#ffffff' : all ? C.honey : C.mint; ctx.fillRect(-TARGET_HALF, -6, TARGET_HALF * 2, 12);
      ctx.font = disp(11); ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('GPU'[i], 0, 0.5);
    }
    ctx.restore();
  });
  // pop bumper caps: flash, grow, a ring
  BUMPERS.forEach((b, i) => {
    const f = F.pop[i];
    const r = 17 * (1 + f * 0.16);
    if (f > 0.02) {
      ctx.globalAlpha = f; ctx.drawImage(R.glow[v.overclock ? 'pink' : 'honey'], b.x - 46, b.y - 46, 92, 92); ctx.globalAlpha = 1;
      ctx.strokeStyle = v.overclock ? C.pink : C.honey; ctx.lineWidth = 3 * f;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 6 + (1 - f) * 22, 0, TAU); ctx.stroke();
    }
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(b.x, b.y, r + 3, 0, TAU); ctx.fill();
    ctx.fillStyle = f > 0.35 ? '#ffffff' : agi ? C.pink : v.overclock ? C.orange : C.honey;
    ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(b.x - r * 0.32, b.y - r * 0.36, r * 0.32, 0, TAU); ctx.fill();
    ctx.font = disp(9); ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(i), b.x + 0.5, b.y + 1);
  });
  // slingshot rubbers bow out when they kick
  SLINGS.forEach((s, i) => {
    const f = F.sling[i];
    if (f < 0.04) return;
    const mx = (s.a[0] + s.c[0]) / 2, my = (s.a[1] + s.c[1]) / 2;
    const dx = s.c[0] - s.a[0], dy = s.c[1] - s.a[1], L = Math.hypot(dx, dy);
    const nx = (i === 0 ? dy : -dy) / L, ny = (i === 0 ? -dx : dx) / L;
    ctx.strokeStyle = C.honey; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(...s.a); ctx.quadraticCurveTo(mx + nx * 10 * f, my + ny * 10 * f, ...s.c); ctx.stroke();
  });
  // the fan
  {
    const x = (SPINNER.x0 + SPINNER.x1) / 2, y = SPINNER.y, a = S.spinner.a, w = Math.abs(S.spinner.w);
    if (w > 18) { ctx.fillStyle = 'rgba(205,184,255,.35)'; ctx.beginPath(); ctx.arc(x, y, 18, 0, TAU); ctx.fill(); }
    ctx.fillStyle = w > 18 ? 'rgba(228,217,255,.5)' : C.lav2;
    for (let k = 0; k < 5; k++) {
      const b = a + (k * TAU) / 5;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.arc(x, y, 17, b, b + 0.72); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = v.overclock ? C.pink : C.honey; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fill();
  }
  // the plunger: its spring pulled down, the power meter with the R-A-M bands
  {
    const pull = S.plunger.pull, y0 = 1080 + pull * 26;
    ctx.strokeStyle = C.lav2; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) { const yy = y0 + 4 + (i / 8) * (1110 - y0 - 4); ctx.lineTo(577 + (i % 2 ? 6 : -6), yy); }
    ctx.stroke();
    ctx.fillStyle = C.ink; ctx.fillRect(566, y0 - 4, 22, 8);
    ctx.fillStyle = C.honey; ctx.fillRect(568, y0 - 2.5, 18, 5);
    if (S.phase === 'launch' && S.balls.some((b) => b.mode === 'plunger')) {
      const top = 820, bot = 1040, x0 = 564, ww = 26;
      ctx.fillStyle = 'rgba(7,3,13,.85)'; rrect(ctx, x0 + ww / 2, (top + bot) / 2, ww + 6, bot - top + 6, 5); ctx.fill();
      for (const b of SKILL_BANDS) {
        const ya = bot - b.p1 * (bot - top), yb = bot - b.p0 * (bot - top);
        const lit = b.lane === Rs.skillLane;
        ctx.fillStyle = lit ? (Math.sin(t * 10) > 0 ? C.pink : '#a0285e') : '#3b2160';
        ctx.fillRect(x0 + 2, ya + 1, ww - 4, yb - ya - 2);
        ctx.font = disp(10); ctx.fillStyle = lit ? C.ink : 'rgba(228,217,255,.6)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('RAM'[b.lane], x0 + ww / 2, (ya + yb) / 2 + 0.5);
      }
      const py = bot - pull * (bot - top);
      ctx.fillStyle = C.mint; ctx.fillRect(x0 - 3, py - 2, ww + 6, 4);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.strokeRect(x0 - 3, py - 2, ww + 6, 4);
    }
  }
  // the balls on the board (under the ramp), their trails and shadows
  for (const b of S.balls) if (b.mode !== 'ramp' && b.mode !== 'locked') ball(ctx, R, b, v, 1);
  // flippers
  for (const f of [S.T.flippers.L, S.T.flippers.R, S.T.flippers.U]) {
    ctx.save(); ctx.translate(4, 5); flipperPath(ctx, f); ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fill(); ctx.restore();
    flipperPath(ctx, f);
    ctx.fillStyle = C.paper; ctx.fill();
    ctx.lineJoin = 'round'; ctx.strokeStyle = C.ink; ctx.lineWidth = 3.2; ctx.stroke();
    // the rubber on its edge: pink, lit hot in OVERCLOCK
    ctx.save(); ctx.clip();
    flipperPath(ctx, f); ctx.strokeStyle = v.overclock ? C.orange : C.pink; ctx.lineWidth = 7; ctx.globalAlpha = 0.9; ctx.stroke();
    ctx.restore();
    flipperPath(ctx, f); ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(f.x, f.y, 6.5, 0, TAU); ctx.fill();
    ctx.fillStyle = C.honey; ctx.beginPath(); ctx.arc(f.x, f.y, 4, 0, TAU); ctx.fill();
  }
  // the PCIe ramp: a translucent ribbon over the board, its contacts in honey
  drawRamp(ctx, v);
  for (const b of S.balls) if (b.mode === 'ramp') ball(ctx, R, b, v, 1.14);
}

function drawRamp(ctx, v) {
  const P = RAMP.pts;
  const path = () => { ctx.beginPath(); P.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // clear plastic: a faint tint and a soft shadow on the board under it
  ctx.save(); ctx.translate(7, 9); path(); ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.lineWidth = 30; ctx.stroke(); ctx.restore();
  path(); ctx.strokeStyle = v.multiball ? 'rgba(255,77,166,.13)' : 'rgba(205,184,255,.08)'; ctx.lineWidth = 32; ctx.stroke();
  // gold contacts across it (they run toward the exit while a ball rides it)
  ctx.strokeStyle = C.gold; ctx.lineWidth = 1.6;
  const off = (v.t * 160) % 22;
  ctx.beginPath();
  for (let s = 8 + off; s < RAMP.total - 8; s += 22) {
    let i = 1;
    while (i < RAMP.len.length - 1 && RAMP.len[i] < s) i++;
    const a = P[i - 1], b = P[i];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    ctx.moveTo(b[0] - nx * 9, b[1] - ny * 9); ctx.lineTo(b[0] + nx * 9, b[1] + ny * 9);
  }
  ctx.globalAlpha = v.rampLit ? 0.75 : 0.32; ctx.stroke(); ctx.globalAlpha = 1;
  // its two rails
  for (const side of [-1, 1]) {
    ctx.beginPath();
    for (let i = 0; i < P.length; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      const x = P[i][0] - (dy / L) * 15 * side, y = P[i][1] + (dx / L) * 15 * side;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.strokeStyle = 'rgba(23,10,54,.85)'; ctx.lineWidth = 4.2; ctx.stroke();
    ctx.strokeStyle = v.multiball ? C.pink : C.lav2; ctx.lineWidth = 2; ctx.stroke();
  }
}

function ball(ctx, R, b, v, scale) {
  const x = b.rx ?? b.x, y = b.ry ?? b.y;
  // a trail when it's fast
  const tr = b.trail;
  if (tr && tr.n > 1) {
    for (let i = 1; i < tr.n; i++) {
      const p = tr.pts[(tr.i - i + tr.pts.length) % tr.pts.length];
      const a = (1 - i / tr.n) * Math.min(1, tr.speed / 2400) * 0.35;
      if (a < 0.02) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = v.overclock ? C.orange : C.lav;
      ctx.beginPath(); ctx.arc(p[0], p[1], BALL_R * (1 - i / (tr.n + 2)) * scale, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  const s = R.ballSize * scale;
  ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.beginPath(); ctx.arc(x + 3.5 * scale, y + 5 * scale, BALL_R * scale, 0, TAU); ctx.fill();
  ctx.drawImage(R.ball, x - s / 2, y - s / 2, s, s);
}

// keeps each ball's recent spots (for its trail): call once a frame
export function trackTrails(S, dt) {
  for (const b of S.balls) {
    const tr = b.trail || (b.trail = { pts: Array.from({ length: 7 }, () => [b.x, b.y]), i: 0, n: 0, speed: 0 });
    tr.i = (tr.i + 1) % tr.pts.length;
    tr.pts[tr.i][0] = b.x; tr.pts[tr.i][1] = b.y;
    tr.n = Math.min(tr.pts.length, tr.n + 1);
    tr.speed = b.mode === 'ramp' ? b.rv : Math.hypot(b.vx, b.vy);
  }
}

