// JAILBREAK: the game playing itself, for ?demo (the preview on agi1.app/games) and behind the title screen. It reads
// the field the way a player would: where each falling ball will land (wall bounces included), where on the paddle to
// take it so it flies at the thickest bricks left (or at THE WARDEN), when there's time to catch a good power-up on
// the way, and when to step away from a hazard or a bomb. It moves the paddle no faster than a quick thumb. Pure.
import { fold, offsetFor, paddleAngle } from './physics.js';
import { BALL_R, POWERS } from './sim.js';
import { CELL_W, COLS } from './levels.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function createAI({ speed = 1250, serveDelay = 0.45, holdFor = 0.28, wobble = 0.1 } = {}) {
  return { speed, serveDelay, holdFor, wobble, x: null, aimT: 0, aimX: 208, aimY: 140, wait: 0 };
}

// where to send the ball: the column with the most bricks left (its neighbours count half), at its lowest brick
function aimPoint(s, ai) {
  const B = s.boss;
  if (B && !B.dead && B.dying <= 0) { ai.aimX = B.x; ai.aimY = B.y; return; }
  const cols = new Float64Array(COLS), low = new Float64Array(COLS);
  for (const k of s.bricks) {
    if (!k.alive || !k.required) continue;
    const c = clamp(Math.floor((k.x + k.w / 2) / CELL_W), 0, COLS - 1);
    cols[c] += k.hp;
    if (k.y + k.h > low[c]) low[c] = k.y + k.h;
  }
  let best = -1, bc = 6;
  for (let c = 0; c < COLS; c++) {
    const v = cols[c] + 0.5 * (cols[c - 1] || 0) + 0.5 * (cols[c + 1] || 0);
    if (v > best) { best = v; bc = c; }
  }
  ai.aimX = bc * CELL_W + CELL_W / 2;
  ai.aimY = low[bc] > 0 ? low[bc] : 140;
}

// → the input for one step: { x, dir, action }
export function think(s, ai, dt) {
  const P = s.paddle, W = s.W;
  const out = { x: null, dir: 0, action: false };
  if (ai.x == null || !Number.isFinite(ai.x)) ai.x = P.x;
  ai.aimT -= dt;
  if (ai.aimT <= 0) { ai.aimT = 0.3; aimPoint(s, ai); }
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
