// JAILBREAK: the game playing itself, for ?demo (the preview on agi1.app/games) and behind the title screen. It reads
// the field the way a player would: where each falling ball will land (wall bounces included), where on the paddle to
// take it so it flies at the thickest bricks left (or at THE WARDEN), when there's time to catch a good power-up on
// the way, and when to step away from a hazard or a bomb. It moves the paddle no faster than a quick thumb. Pure.
import { fold, offsetFor, paddleAngle } from './physics.js';
import { BALL_R, POWERS } from './sim.js';
import { CELL_W, CELL_H, COLS, GRID_TOP } from './levels.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function createAI({ speed = 1250, serveDelay = 0.45, holdFor = 0.28, wobble = 0.025 } = {}) {
  return { speed, serveDelay, holdFor, wobble, x: null, aimT: 0, aimX: 208, aimY: 140, wait: 0, target: null, keepT: 0, bank: false };
}

// where to send the ball: a brick it can actually hit (one with open space next to it that the ball can get to), in
// the thickest part of what's left, straight from the paddle or, when steel or a shut gate is in the way, off a side
// wall (a bank shot). It keeps its target for a while (no dithering), and picks again once it's broken.
const MAXR = 14;
const grid = new Array(MAXR * COLS), open = new Uint8Array(MAXR * COLS);
function aimPoint(s, ai) {
  const B = s.boss;
  if (B && !B.dead && B.dying <= 0) { ai.aimX = B.x + clamp(B.cfg.sway * 40, 0, 60) * Math.cos(B.sw); ai.aimY = B.y; ai.target = null; return; }
  grid.fill(null); open.fill(0);
  let rows = 0;
  for (const k of s.bricks) {
    if (!k.alive || k.attached) continue;
    const r = Math.round((k.y - GRID_TOP) / CELL_H), c = clamp(Math.floor((k.x + k.w / 2) / CELL_W), 0, COLS - 1);
    if (r < 0 || r >= MAXR) continue;
    grid[r * COLS + c] = k;
    if (r + 1 > rows) rows = r + 1;
  }
  // the empty cells the ball can reach without breaking anything: from below, and the gap above once it's reached
  const q = [];
  const visit = (r, c) => {
    if (r < 0 || r >= rows || c < 0 || c >= COLS) return;
    const i = r * COLS + c;
    if (open[i] || grid[i]) return;
    open[i] = 1; q.push(i);
  };
  for (let c = 0; c < COLS; c++) visit(rows - 1, c);
  let top = false;
  while (q.length) {
    const i = q.pop(), r = (i / COLS) | 0, c = i % COLS;
    if (r === 0 && !top) { top = true; for (let cc = 0; cc < COLS; cc++) visit(0, cc); }
    visit(r - 1, c); visit(r + 1, c); visit(r, c - 1); visit(r, c + 1);
  }
  const isOpen = (r, c) => (r >= rows) || (r < 0 ? top : c >= 0 && c < COLS && open[r * COLS + c] === 1);
  const P = s.paddle;
  // is the path from the paddle to (tx, ty) (a straight line, folded off the side walls) clear of steel and shut gates
  // and of other bricks (the last stretch into the target's own cell doesn't count)?
  const clear = (tx, ty, self) => {
    const n = Math.ceil(Math.hypot(tx - P.x, P.y - ty) / 9);
    for (let i = 1; i < n; i++) {
      const x = fold(P.x + ((tx - P.x) * i) / n, 0, s.W), y = P.y + ((ty - P.y) * i) / n;
      const rr = Math.floor((y - GRID_TOP) / CELL_H), cc = clamp(Math.floor(x / CELL_W), 0, COLS - 1);
      if (rr < 0 || rr >= rows) continue;
      const k = grid[rr * COLS + cc];
      if (k && k !== self) return k.kind === 'steel' || (k.kind === 'gate' && !s.gatesOpen) ? 2 : 1;
    }
    return 0;
  };
  // the target it has: kept while it's there and still clear
  const keep = ai.target && ai.target.alive && ai.keepT > 0;
  if (keep) {
    const k = ai.target;
    const tx = ai.bank ? ai.aimX : k.x + k.w / 2;
    if (clear(tx, k.y + k.h, k) < 2) { ai.aimY = k.y + k.h; if (!ai.bank) ai.aimX = tx; return; }
  }
  let best = -Infinity, pick = null, px = s.W / 2, pyy = 140, bank = false;
  for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) {
    const k = grid[r * COLS + c];
    if (!k || !k.required) continue;
    if (!(isOpen(r + 1, c) || isOpen(r - 1, c) || isOpen(r, c - 1) || isOpen(r, c + 1))) continue;
    // thick around it (more to break once it's in), lower is easier
    let score = 0;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      if (r + dr < 0 || r + dr >= rows || c + dc < 0 || c + dc >= COLS) continue;
      const n = grid[(r + dr) * COLS + c + dc];
      if (n && n.required) score += 1;
    }
    score += r * 0.4 + ((Math.sin(s.t * 1.3 + r * 7.3 + c * 3.7) + 1) * 0.8);
    const tx = k.x + k.w / 2, ty = k.y + k.h;
    let ax = tx, banked = false;
    const direct = clear(tx, ty, k);
    if (direct) {
      // off the left or right wall instead?
      const left = clear(-tx, ty, k), right = clear(2 * s.W - tx, ty, k);
      if (left === 0 && (right !== 0 || Math.abs(P.x + tx) < Math.abs(2 * s.W - tx - P.x))) { ax = -tx; banked = true; score -= 2; }
      else if (right === 0) { ax = 2 * s.W - tx; banked = true; score -= 2; }
      else score -= direct === 2 ? 60 : 4;
    }
    if (score > best) { best = score; pick = k; px = ax; pyy = ty; bank = banked; }
  }
  ai.target = pick; ai.keepT = 2.2; ai.bank = bank;
  ai.aimX = px;
  ai.aimY = pyy;
}

// → the input for one step: { x, dir, action }
export function think(s, ai, dt) {
  const P = s.paddle, W = s.W;
  const out = { x: null, dir: 0, action: false };
  if (ai.x == null || !Number.isFinite(ai.x)) ai.x = P.x;
  ai.aimT -= dt; ai.keepT -= dt;
  if (ai.aimT <= 0 || (ai.target && !ai.target.alive)) { ai.aimT = 0.25; aimPoint(s, ai); }
  const py = P.y - BALL_R;
  let tBest = Infinity, xLand = 0, ball = null;
  for (const b of s.balls) {
    if (b.stuck || b.vy <= 0 || b.y >= py) continue;
    const t = (py - b.y) / b.vy;
    if (t < tBest) { tBest = t; xLand = fold(b.x + b.vx * t, b.r, W); ball = b; }
  }
  let target = P.x;
  if (ball) {
    const ang = (Math.atan2(py - ai.aimY, ai.aimX - xLand) * 180) / Math.PI;
    let u = clamp(offsetFor(ang), -0.72, 0.72) + ai.wobble * Math.sin(s.t * 1.9 + ball.id);
    if (tBest < 0.22) u *= 0.35;            // no time: just take it
    target = xLand - clamp(u, -0.8, 0.8) * (P.w / 2);
  } else if (s.phase === 'serve' || s.phase === 'intro') {
    // line the serve up with the bricks: the ball leaves at its serve angle from just right of the middle
    const a = paddleAngle(0.16);
    target = ai.aimX - (py - ai.aimY) / Math.tan(a) - 0.16 * (P.w / 2);
  } else {
    let low = null;
    for (const b of s.balls) if (!b.stuck && (!low || b.y > low.y)) low = b;
    target = low ? P.x + (low.x - P.x) * 0.5 : W / 2;
  }
  const half = P.w / 2;
  // power-ups: a good one if there's time to fetch it and still meet the ball; out of the way of a hazard
  for (const c of s.capsules) {
    const tc = Math.max(0, (P.y - c.y) / Math.max(90, c.vy));
    if (POWERS[c.type]?.good) {
      const go = Math.abs(c.x - P.x) / ai.speed;
      const back = ball ? Math.abs(xLand - c.x) / ai.speed : 0;
      if (tc > go && (!ball || tc + back < tBest - 0.08)) { target = c.x; break; }
    } else if (Math.abs(c.x - target) < half + 18 && tc < (ball ? tBest + 0.5 : 2)) {
      const alt = c.x < target ? c.x + half + 22 : c.x - half - 22;
      if (!ball || Math.abs(alt - xLand) < half - 2) target = alt;
    }
  }
  for (const m of s.bombs) {
    const tm = Math.max(0, (P.y - m.y) / Math.max(60, m.vy));
    if (tm < 1.2 && Math.abs(m.x - target) < half + m.r + 6) {
      const alt = m.x < target ? m.x + half + m.r + 10 : m.x - half - m.r - 10;
      if (!ball || Math.abs(alt - xLand) < half - 2) target = alt;
    }
  }
  target = clamp(target, half, W - half);
  const max = ai.speed * dt;
  ai.x += clamp(target - ai.x, -max, max);
  ai.x = clamp(ai.x, half, W - half);
  out.x = ai.x;
  if (s.phase === 'serve') {
    ai.wait += dt;
    if (ai.wait >= ai.serveDelay && Math.abs(target - ai.x) < 6) { out.action = true; ai.wait = 0; }
  } else if (s.phase === 'live' && s.balls.some((b) => b.stuck)) {
    ai.wait += dt;
    if (ai.wait >= ai.holdFor) { out.action = true; ai.wait = 0; }
  } else ai.wait = 0;
  return out;
}
