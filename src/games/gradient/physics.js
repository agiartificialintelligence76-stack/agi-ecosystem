// GRADIENT DESCENT (2026-11-08): the ball. A point rolling on the landscape h(x, z), integrated at 240 Hz: the slope
// pulls it downhill (a ball on a surface: a = −(g + vᵀHv)·∇h / (1 + |∇h|²), the curvature term is the "normal
// correction": a valley presses it down, a crest lightens it), rolling resistance and a little drag slow it (much more
// on a sticky "weight decay" patch), the rails and the bumper posts bounce it, the cup takes it when it's slow enough
// (too fast: a lip-out), a NaN pit swallows it. Pure and deterministic: the same shot, the same roll, every time (the
// aim preview and the demo's AI run this very code).
import { descend } from './terrain.js';

export const PHYS = Object.freeze({
  DT: 1 / 240,
  G: 9.2,            // gravity for a rolling ball (units/s²)
  A0: 0.4,           // rolling resistance (units/s²): the ball rests only on slopes under ~2.5°
  DRAG: 0.62,        // speed drag (1/s): long putts ease out instead of rolling forever
  A_LOW: 0.34,       // extra grip as it slows (below LOW_V): a ball never creeps forever down a gentle slope
  LOW_V: 0.5,
  STICKY_A0: 3.4,    // …on a weight-decay patch
  STICKY_DRAG: 2.2,
  VSHOT: 14.5,       // a full-power putt (units/s): about 20 units on flat ground
  VCAP: 20,          // the speed limit
  R: 0.26,           // the ball's radius
  CUP: 0.56,         // the cup: the ball's centre within this of its centre is over it
  DROP: 0.36,        // seconds over the cup it needs to drop in (the faster, the shorter its time over it)
  REST_V: 0.045,     // slower than this…
  REST_T: 0.25,      // …for this long: at rest
  RAIL_E: 0.62,      // the rails' bounce
  POST_E: 0.78,      // the bumpers' bounce
  MAX_T: 26,         // a roll never lasts longer (it always stops well before)
  MIN_POWER: 0.03,   // a pull shorter than this is a cancel
});

export const shotSpeed = (power) => PHYS.VSHOT * Math.max(0, Math.min(1, power));

// The ball's state (plain numbers: cheap to copy for the preview and the AI)
export function createBall(x, z) {
  return { x, z, vx: 0, vz: 0, t: 0, restT: 0, lip: false, done: null, moving: false, speed: 0, sticky: false };
}

export function shoot(ball, angle, power) {
  const v = shotSpeed(power);
  ball.vx = Math.cos(angle) * v;
  ball.vz = Math.sin(angle) * v;
  ball.t = 0; ball.restT = 0; ball.lip = false; ball.done = null; ball.moving = true; ball.speed = v;
}

const F = new Float64Array(6);

export function inSticky(hole, x, z) {
  const zs = hole.sticky;
  for (let i = 0; i < zs.length; i++) {
    const s = zs[i];
    const dx = (x - s.x) / s.rx, dz = (z - s.z) / s.rz;
    if (dx * dx + dz * dz < 1) return true;
  }
  return false;
}

export function inPit(hole, x, z, grow = 0) {
  const ps = hole.pits;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    const dx = x - p.x, dz = z - p.z, r = p.r + grow;
    if (dx * dx + dz * dz < r * r) return i;
  }
  return -1;
}

// One step of `dt` seconds. Events (when `ev` is given) are pushed as small objects: { e: 'rail' | 'post' | 'lip' |
// 'sink' | 'pit' | 'rest', v (speed), i (which post or pit) }. Returns the ball's `done` (null while it rolls).
export function step(ball, hole, dt = PHYS.DT, ev = null) {
  if (ball.done) return ball.done;
  const P = PHYS;
  hole.field.sample(ball.x, ball.z, F);
  const gx = F[1], gz = F[2];
  let vx = ball.vx, vz = ball.vz;
  // gravity along the slope, with the curvature's push (kept within sane bounds on a sharp crest or a deep fold)
  const vHv = F[3] * vx * vx + 2 * F[4] * vx * vz + F[5] * vz * vz;
  let geff = P.G + vHv;
  geff = geff < P.G * 0.25 ? P.G * 0.25 : geff > P.G * 3 ? P.G * 3 : geff;
  const q = 1 + gx * gx + gz * gz;
  vx -= (geff * gx / q) * dt;
  vz -= (geff * gz / q) * dt;
  // rolling resistance and drag (they slow it to a stop, never push it back)
  const sticky = hole.sticky.length ? inSticky(hole, ball.x, ball.z) : false;
  ball.sticky = sticky;
  let s = Math.sqrt(vx * vx + vz * vz);
  if (s > 0) {
    const grip = s < P.LOW_V ? P.A_LOW * (1 - s / P.LOW_V) : 0;
    const slow = ((sticky ? P.STICKY_A0 : P.A0) + grip + (sticky ? P.STICKY_DRAG : P.DRAG) * s) * dt;
    const ns = s > slow ? s - slow : 0;
    const k = ns / s;
    vx *= k; vz *= k; s = ns;
  }
  if (s > P.VCAP) { const k = P.VCAP / s; vx *= k; vz *= k; s = P.VCAP; }
  let x = ball.x + vx * dt, z = ball.z + vz * dt;

  // the rails
  const bx = hole.half[0] - P.R, bz = hole.half[1] - P.R;
  if (x < -bx || x > bx) {
    x = x < -bx ? -bx : bx;
    if ((x < 0 && vx < 0) || (x > 0 && vx > 0)) { ev?.push({ e: 'rail', v: Math.abs(vx) }); vx = -vx * P.RAIL_E; vz *= 0.94; }
  }
  if (z < -bz || z > bz) {
    z = z < -bz ? -bz : bz;
    if ((z < 0 && vz < 0) || (z > 0 && vz > 0)) { ev?.push({ e: 'rail', v: Math.abs(vz) }); vz = -vz * P.RAIL_E; vx *= 0.94; }
  }
  // the bumper posts
  const posts = hole.posts;
  for (let i = 0; i < posts.length; i++) {
    const p = posts[i];
    const dx = x - p.x, dz = z - p.z, rr = p.r + P.R;
    const d2 = dx * dx + dz * dz;
    if (d2 < rr * rr) {
      const d = Math.sqrt(d2) || 1e-6, nx = dx / d, nz = dz / d;
      x = p.x + nx * rr; z = p.z + nz * rr;
      const vn = vx * nx + vz * nz;
      if (vn < 0) { ev?.push({ e: 'post', v: -vn, i }); vx -= (1 + P.POST_E) * vn * nx; vz -= (1 + P.POST_E) * vn * nz; }
    }
  }
  ball.x = x; ball.z = z; ball.vx = vx; ball.vz = vz;
  s = Math.sqrt(vx * vx + vz * vz);
  ball.speed = s;
  ball.t += dt;

  // a NaN pit
  if (hole.pits.length) {
    const pi = inPit(hole, x, z);
    if (pi >= 0) { ball.done = 'pit'; ball.moving = false; ev?.push({ e: 'pit', v: s, i: pi }); return ball.done; }
  }
  // the cup: over it long enough to drop (the faster, the shorter the chord it crosses is in time), else a lip-out
  const cx = hole.cup[0] - x, cz = hole.cup[1] - z;
  const cd2 = cx * cx + cz * cz;
  if (cd2 < P.CUP * P.CUP) {
    if (!ball.lip) {
      // how far off-centre its line passes (b), and the chord it would cross over the cup
      const b = s > 1e-6 ? Math.abs((vx * cz - vz * cx) / s) : 0;
      const chord = 2 * Math.sqrt(Math.max(0, P.CUP * P.CUP - b * b));
      const vcap = Math.max(0.8, chord / P.DROP);
      if (s <= vcap) { sink(ball, ev, s); return ball.done; }
      // a lip-out: it catches the rim and is flung off to the side, slower (a ball barely too fast swings the most)
      const k = Math.max(0, Math.min(1, (vcap * 1.9 - s) / (vcap * 0.9)));
      const side = vx * cz - vz * cx >= 0 ? -1 : 1;
      const th = side * (0.28 + 0.95 * k) * (0.55 + 0.45 * (1 - b / P.CUP));
      const ct = Math.cos(th), st = Math.sin(th), keep = 0.86 - 0.26 * k;
      const nvx = (vx * ct - vz * st) * keep, nvz = (vx * st + vz * ct) * keep;
      ball.vx = nvx; ball.vz = nvz; ball.lip = true;
      ev?.push({ e: 'lip', v: s });
    } else if (s < 0.9 && cd2 < P.CUP * P.CUP * 0.6) { sink(ball, ev, s); return ball.done; }
  } else if (ball.lip && cd2 > (P.CUP + 0.12) * (P.CUP + 0.12)) ball.lip = false;

  // at rest
  if (s < P.REST_V) {
    ball.restT += dt;
    if (ball.restT >= P.REST_T) { ball.done = 'rest'; ball.moving = false; ball.vx = 0; ball.vz = 0; ev?.push({ e: 'rest', v: 0 }); }
  } else ball.restT = 0;
  if (!ball.done && ball.t > P.MAX_T) { ball.done = 'rest'; ball.moving = false; ball.vx = 0; ball.vz = 0; ev?.push({ e: 'rest', v: 0 }); }
  return ball.done;
}

function sink(ball, ev, s) {
  ball.done = 'sink'; ball.moving = false;
  ev?.push({ e: 'sink', v: s });
}

// A whole shot from (x, z): where it ends and how. `track(x, z, t)` is called every `every` steps (the preview's dots).
// `maxT` cuts it short (the preview's first half second). Returns { x, z, done, t, bounces }.
const SIM = createBall(0, 0);
export function simulate(hole, x, z, angle, power, { maxT = PHYS.MAX_T, track = null, every = 6, events = null } = {}) {
  const b = SIM;
  b.x = x; b.z = z; b.vx = 0; b.vz = 0; b.restT = 0; b.lip = false; b.done = null; b.sticky = false;
  shoot(b, angle, power);
  const steps = Math.ceil(maxT / PHYS.DT);
  let bounces = 0;
  const ev = events;
  for (let i = 0; i < steps; i++) {
    const n0 = ev ? ev.length : 0;
    const d = step(b, hole, PHYS.DT, ev);
    if (ev && ev.length > n0) for (let k = n0; k < ev.length; k++) if (ev[k].e === 'rail' || ev[k].e === 'post') bounces++;
    if (track && (i % every === 0 || d)) track(b.x, b.z, b.t);
    if (d) return { x: b.x, z: b.z, done: d, t: b.t, bounces };
  }
  return { x: b.x, z: b.z, done: null, t: b.t, bounces };
}

// The valley the ball rests in: the nearest minimum downhill of it (is it the course's lowest point, or a trap?)
export function basinOf(hole, x, z) {
  const m = descend(hole.field, x, z, { bounds: [hole.half[0] - PHYS.R, hole.half[1] - PHYS.R] });
  const d = Math.hypot(m.x - hole.cup[0], m.z - hole.cup[1]);
  return { ...m, global: d < 1.2, dist: d };
}
