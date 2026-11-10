// AIR GAP: the table's physics. Pure (no DOM, no canvas): the same code runs the game, its demo, the title's attract
// match, the tests and the balance tool in Node. Units are the table's (600 × 1000) and seconds. y grows toward the
// bottom goal (side 0's: you, or P1); side 1's goal (AGI-1's, or P2's) is at y = 0.
//
// The puck glides with very little drag and bounces off the rails. The mallets are kinematic: each chases its target
// (a finger, the mouse, the keys or AGI-1's brain) at a high but capped speed, inside its own half, and its velocity
// comes from that motion. Every 1/120 s tick is cut into substeps small enough that nothing moves more than ~40% of the
// puck's radius in one; the puck is swept against each mallet (the moment they touch, both moving), then pushed out of
// the rails. A puck squeezed between a mallet and a rail stops the mallet instead of being pumped faster and faster.

import { len, dexp } from './dmath.js';
export const W = 600, H = 1000, MID = H / 2;
export const CORNER = 80;                 // the rails' rounded corners
export const PUCK_R = 26, MALLET_R = 42, BIG = 1.4;
export const MOUTH = 204;                 // each goal's mouth: 34% of the end's width
export const SLOT = 48;                   // how deep the goal slot's side walls go behind the line
export const RAIL_E = 0.9, MALLET_E = 0.95, PUCKS_E = 0.92;
export const PUCK_MAX = 2800, TURBO_MAX = 3400;   // ≈ 2.8 table lengths a second (Turbo: 3.4)
export const MALLET_MAX = 2400;
export const DRAG = 0.16, TURBO_DRAG = 0.1;       // per second
export const DECEL = 6;                   // a slow puck comes to rest (units/s²)
export const FOLLOW = 80;                 // how hard a player's mallet chases its target (per second)
const RAIL_KEEP = 0.97, MALLET_F = 0.12;   // a rail keeps 97% of the puck's slide along it (never all or nothing)
// a puck rattling in a gap (a mallet, then the rail, then the mallet again within a blink) loses most of its bounce:
// a squeeze ends in a clean pinch, never in a puck pumped up to full speed
const RATTLE = 0.05, RATTLE_MALLET_E = 0.12, RATTLE_RAIL_E = 0.3;

// ---------- the goals' mouths ----------
// side's mouth as [left, right] (PATCH halves it)
export function mouthOf(patched = false) {
  const w = patched ? MOUTH / 2 : MOUTH;
  return [(W - w) / 2, (W + w) / 2];
}
export const goalY = (side) => (side === 0 ? H : 0);

// ---------- the rails ----------
// colliders: { k: 0 } a segment (a thickness r), { k: 1 } a rounded corner (the puck stays inside its arc)
function seg(list, ax, ay, bx, by, tag, side = -1, r = 0) {
  const dx = bx - ax, dy = by - ay;
  list.push({ k: 0, ax, ay, bx, by, dx, dy, len2: dx * dx + dy * dy || 1e-9, r, tag, side,
    x0: Math.min(ax, bx) - r, y0: Math.min(ay, by) - r, x1: Math.max(ax, bx) + r, y1: Math.max(ay, by) + r });
}
export function buildWalls({ patch = [false, false], firewall = [false, false] } = {}) {
  const list = [];
  seg(list, 0, CORNER, 0, H - CORNER, 'rail');
  seg(list, W, CORNER, W, H - CORNER, 'rail');
  for (const side of [0, 1]) {
    const y = goalY(side), out = side === 0 ? 1 : -1;
    const [l, r] = mouthOf(patch[side]);
    seg(list, CORNER, y, l, y, 'end', side);
    seg(list, r, y, W - CORNER, y, 'end', side);
    seg(list, l, y, l, y + out * SLOT, 'slot', side);
    seg(list, r, y, r, y + out * SLOT, 'slot', side);
    if (firewall[side]) seg(list, l - 8, y - out * 6, r + 8, y - out * 6, 'firewall', side, 5);
  }
  for (const [cx, cy, qx, qy] of [[CORNER, CORNER, -1, -1], [W - CORNER, CORNER, 1, -1], [CORNER, H - CORNER, -1, 1], [W - CORNER, H - CORNER, 1, 1]]) {
    list.push({ k: 1, cx, cy, qx, qy, R: CORNER, tag: 'rail', side: -1,
      x0: qx < 0 ? -1 : cx, x1: qx < 0 ? cx : W + 1, y0: qy < 0 ? -1 : cy, y1: qy < 0 ? cy : H + 1 });
  }
  return list;
}

// distance from the collider's surface to (px, py) (negative: past it), with out.nx/ny the way out
function probe(c, px, py, out) {
  if (c.k === 0) {
    let t = ((px - c.ax) * c.dx + (py - c.ay) * c.dy) / c.len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    let nx = px - (c.ax + c.dx * t), ny = py - (c.ay + c.dy * t);
    const d = Math.sqrt(nx * nx + ny * ny);
    if (d > 1e-9) { nx /= d; ny /= d; } else { nx = 0; ny = c.side === 0 ? -1 : 1; }
    out.nx = nx; out.ny = ny;
    return d - c.r;
  }
  // a corner: only for a point in its quarter; the inside of the arc is free
  if ((px - c.cx) * c.qx <= 0 || (py - c.cy) * c.qy <= 0) return Infinity;
  let nx = c.cx - px, ny = c.cy - py;
  const d = Math.sqrt(nx * nx + ny * ny);
  if (d > 1e-9) { nx /= d; ny /= d; } else { nx = -c.qx; ny = -c.qy; }
  out.nx = nx; out.ny = ny;
  return c.R - d;
}

// ---------- bodies ----------
export function makePuck(id, x, y, vx = 0, vy = 0) {
  return { id, x, y, vx, vy, r: PUCK_R, ghost: 0, noPP: 0, lost: false, railT: 9, malletT: 9 };
}
export function makeMallet(side) {
  const y = side === 0 ? H - 130 : 130;
  return { side, x: W / 2, y, px: W / 2, py: y, vx: 0, vy: 0, r: MALLET_R, rt: MALLET_R, tx: W / 2, ty: y,
    max: MALLET_MAX, follow: FOLLOW, lag: 0, hx: W / 2, hy: y, holdT: 0, blocked: 0 };
}

// where a mallet of radius r may be on its side: inside the rails (and their rounded corners), never past the air gap
const C = { x: 0, y: 0 };
export function confine(x, y, r, side, out = C) {
  const lo = side === 0 ? MID + r : r, hi = side === 0 ? H - r : MID - r;
  x = x < r ? r : x > W - r ? W - r : x;
  y = y < lo ? lo : y > hi ? hi : y;
  const k = CORNER - r;
  if (k > 0 && (x < CORNER || x > W - CORNER) && (side === 0 ? y > H - CORNER : y < CORNER)) {
    const cx = x < CORNER ? CORNER : W - CORNER, cy = side === 0 ? H - CORNER : CORNER;
    const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
    if (d > k) { x = cx + (dx * k) / d; y = cy + (dy * k) / d; }
  }
  out.x = x; out.y = y;
  return out;
}

// one substep of a mallet's chase: toward its target, capped, confined; its velocity is the motion it made
function moveMallet(m, h) {
  m.px = m.x; m.py = m.y;
  if (m.r !== m.rt) {
    const step = 170 * h;
    m.r = Math.abs(m.rt - m.r) <= step ? m.rt : m.r + Math.sign(m.rt - m.r) * step;
  }
  let tx = m.tx, ty = m.ty;
  if (m.lag > 0) {
    // LAG: the mallet only hears where to go eight times a second, and goes there at half speed
    m.holdT -= h;
    if (m.holdT <= 0) { m.hx = tx; m.hy = ty; m.holdT = 0.125; }
    tx = m.hx; ty = m.hy;
  }
  const c = confine(tx, ty, m.r, m.side);
  let vx = (c.x - m.x) * m.follow, vy = (c.y - m.y) * m.follow;
  const max = m.max * (m.lag > 0 ? 0.5 : 1);
  const sp = Math.sqrt(vx * vx + vy * vy);
  if (sp > max) { vx *= max / sp; vy *= max / sp; }
  const n = confine(m.x + vx * h, m.y + vy * h, m.r, m.side);
  m.x = n.x; m.y = n.y;
  m.vx = (m.x - m.px) / h; m.vy = (m.y - m.py) / h;
}

function cap(p, max) {
  const s2 = p.vx * p.vx + p.vy * p.vy;
  if (s2 > max * max) { const k = max / Math.sqrt(s2); p.vx *= k; p.vy *= k; }
}

// the puck against one mallet over the substep: swept (both moving), so a full-speed puck can't pass through it
function sweep(p, p0x, p0y, m, h, S, ev) {
  const R = p.r + m.r;
  const d0x = p0x - m.px, d0y = p0y - m.py;
  const c0 = d0x * d0x + d0y * d0y - R * R;
  let nx, ny;
  if (c0 > 0) {
    // not touching at the start: when (if ever) in this substep do they touch?
    const ex = (p.x - m.x) - d0x, ey = (p.y - m.y) - d0y;
    const a = ex * ex + ey * ey, b = 2 * (d0x * ex + d0y * ey);
    if (a < 1e-12 || b >= 0) return;
    const disc = b * b - 4 * a * c0;
    if (disc < 0) return;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    if (t < 0 || t > 1) return;
    const mcx = m.px + (m.x - m.px) * t, mcy = m.py + (m.y - m.py) * t;
    const pcx = p0x + (p.x - p0x) * t, pcy = p0y + (p.y - p0y) * t;
    nx = (pcx - mcx) / R; ny = (pcy - mcy) / R;
    const s = impulse(p, m, nx, ny, S.puckMax, p.railT < RATTLE ? RATTLE_MALLET_E : MALLET_E);
    p.malletT = 0;
    // the rest of the substep with its new velocity, never inside the mallet where it ends up
    p.x = pcx + p.vx * (1 - t) * h; p.y = pcy + p.vy * (1 - t) * h;
    separate(p, m, R);
    if (s > 0) ev?.push({ type: 'hit', side: m.side, speed: s, x: mcx + nx * m.r, y: mcy + ny * m.r, puck: p.id, out: len(p.vx, p.vy), soft: s < 30 });
    return;
  }
  // already touching (a serve that ends under a mallet, a mallet that grew): push it out where it is now
  let dx = p.x - m.x, dy = p.y - m.y, d = Math.sqrt(dx * dx + dy * dy);
  if (d >= R) return;
  if (d < 1e-6) { dx = 0; dy = m.side === 0 ? -1 : 1; d = 1; }
  nx = dx / d; ny = dy / d;
  p.x = m.x + nx * R; p.y = m.y + ny * R;
  const s = impulse(p, m, nx, ny, S.puckMax, p.railT < RATTLE ? RATTLE_MALLET_E : MALLET_E);
  p.malletT = 0;
  if (s > 0) ev?.push({ type: 'hit', side: m.side, speed: s, x: m.x + nx * m.r, y: m.y + ny * m.r, puck: p.id, out: len(p.vx, p.vy), soft: s < 30 });
}
function separate(p, m, R) {
  const dx = p.x - m.x, dy = p.y - m.y, d = Math.sqrt(dx * dx + dy * dy);
  if (d >= R || d < 1e-6) return;
  p.x = m.x + (dx / d) * R; p.y = m.y + (dy / d) * R;
}
// the mallet's motion goes into the puck: relative velocity along the contact normal, bounced back (restitution), and
// a little of the sliding part (a sweep across the puck drags it sideways). → the impact speed
function impulse(p, m, nx, ny, max, e = MALLET_E) {
  const rvx = p.vx - m.vx, rvy = p.vy - m.vy;
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0) return 0;
  const j = -(1 + e) * vn;
  let tx = rvx - vn * nx, ty = rvy - vn * ny;
  const ts = Math.sqrt(tx * tx + ty * ty);
  let jt = 0;
  if (ts > 1e-6) { jt = Math.min(ts, MALLET_F * j); tx /= ts; ty /= ts; }
  p.vx += nx * j - tx * jt; p.vy += ny * j - ty * jt;
  cap(p, max);
  return -vn;
}

const hit = { nx: 0, ny: 0 };
function rails(p, walls, ev) {
  for (let pass = 0; pass < 2; pass++) {
    for (const c of walls) {
      if (p.x + p.r < c.x0 || p.x - p.r > c.x1 || p.y + p.r < c.y0 || p.y - p.r > c.y1) continue;
      const d = probe(c, p.x, p.y, hit);
      const pen = p.r - d;
      if (pen <= 0) continue;
      p.x += hit.nx * pen; p.y += hit.ny * pen;
      const vn = p.vx * hit.nx + p.vy * hit.ny;
      if (vn >= 0) continue;
      const e = p.malletT < RATTLE && c.tag !== 'firewall' ? RATTLE_RAIL_E : RAIL_E;
      const tx = (p.vx - vn * hit.nx) * RAIL_KEEP, ty = (p.vy - vn * hit.ny) * RAIL_KEEP;
      p.vx = tx - hit.nx * vn * e; p.vy = ty - hit.ny * vn * e;
      p.railT = 0;
      if (-vn > 40) ev?.push({ type: c.tag === 'firewall' ? 'block' : c.tag === 'slot' ? 'post' : 'rail', speed: -vn, x: p.x - hit.nx * p.r, y: p.y - hit.ny * p.r, side: c.side, puck: p.id });
    }
  }
}

// a puck still touching a mallet after the rails pushed it back is squeezed: the mallet gives way, and neither keeps
// pushing into the other (no pumping, no jitter)
function pinch(p, m) {
  const R = p.r + m.r;
  const dx = p.x - m.x, dy = p.y - m.y, d = Math.sqrt(dx * dx + dy * dy);
  if (d >= R - 0.01 || d < 1e-6) return;
  const nx = dx / d, ny = dy / d, pen = R - d;
  const c = confine(m.x - nx * pen, m.y - ny * pen, m.r, m.side);
  m.x = c.x; m.y = c.y;
  m.blocked = 0.05;
  const mvn = m.vx * nx + m.vy * ny;
  if (mvn > 0) { m.vx -= nx * mvn; m.vy -= ny * mvn; }
  const rvn = (p.vx - m.vx) * nx + (p.vy - m.vy) * ny;
  if (rvn < 0) { p.vx -= nx * rvn; p.vy -= ny * rvn; }
}

function pucksTouch(a, b, ev) {
  if (a.noPP > 0 || b.noPP > 0 || a.ghost > 0 || b.ghost > 0) return;
  const R = a.r + b.r;
  const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
  if (d2 >= R * R || d2 < 1e-9) return;
  const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, pen = (R - d) / 2;
  a.x -= nx * pen; a.y -= ny * pen; b.x += nx * pen; b.y += ny * pen;
  const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (vn >= 0) return;
  const j = (-(1 + PUCKS_E) * vn) / 2;
  a.vx -= nx * j; a.vy -= ny * j; b.vx += nx * j; b.vy += ny * j;
  if (-vn > 60) ev?.push({ type: 'clink', speed: -vn, x: a.x + nx * a.r, y: a.y + ny * a.r });
}

// ---------- one tick ----------
// S: { pucks, mallets, walls, puckMax, drag } → moves everything by dt, pushing events into ev. → the substep count
export function stepPhysics(S, dt, ev = null) {
  let vmax = 0, mmax = 0;
  for (const p of S.pucks) vmax = Math.max(vmax, len(p.vx, p.vy));
  for (const m of S.mallets) mmax = Math.max(mmax, m.max);
  const n = Math.max(2, Math.min(16, Math.ceil(((vmax + mmax) * dt) / (PUCK_R * 0.4))));
  const h = dt / n;
  const keep = dexp(-(S.drag ?? DRAG) * h);
  const max = S.puckMax || PUCK_MAX;
  for (let i = 0; i < n; i++) {
    for (const m of S.mallets) { moveMallet(m, h); if (m.blocked > 0) m.blocked -= h; }
    for (const p of S.pucks) {
      if (p.lost) continue;
      if (p.ghost > 0) p.ghost = Math.max(0, p.ghost - h);
      if (p.noPP > 0) p.noPP = Math.max(0, p.noPP - h);
      p.railT += h; p.malletT += h;
      const p0x = p.x, p0y = p.y;
      p.vx *= keep; p.vy *= keep;
      const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (sp > 0) {
        const ns = sp < 2 ? 0 : sp - DECEL * h;
        const k = ns > 0 ? ns / sp : 0;
        p.vx *= k; p.vy *= k;
      }
      p.x += p.vx * h; p.y += p.vy * h;
      if (p.ghost <= 0) for (const m of S.mallets) sweep(p, p0x, p0y, m, h, S, ev);
      rails(p, S.walls, ev);
      if (p.ghost <= 0) for (const m of S.mallets) pinch(p, m);
      cap(p, max);
      // a last guard: a broken number or a puck off the table never survives
      if (!(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.vx) && Number.isFinite(p.vy))) { p.x = p0x; p.y = p0y; p.vx = 0; p.vy = 0; }
      if (p.x < -40 || p.x > W + 40 || p.y < -SLOT - 120 || p.y > H + SLOT + 120) p.lost = true;
      else if ((p.x < p.r - 6 || p.x > W - p.r + 6) && p.y > 0 && p.y < H) {
        // (never happens with the substeps: a guard against anything that tries)
        p.x = p.x < W / 2 ? p.r : W - p.r; p.vx = -p.vx * RAIL_E;
      }
    }
    for (let a = 0; a < S.pucks.length; a++) for (let b = a + 1; b < S.pucks.length; b++) pucksTouch(S.pucks[a], S.pucks[b], ev);
  }
  return n;
}

// did the puck go in? → the side that scored (−1: not yet). A goal: the whole puck past the goal line (it can only get
// there through the mouth: the rails and the slot's walls keep it out everywhere else)
export function scored(p) {
  if (p.y - p.r > H) return 1;
  if (p.y + p.r < 0) return 0;
  return -1;
}
