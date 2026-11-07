// OVERCLOCK: the pinball physics. Pure (no DOM, no canvas): the same code runs the game, its demo player and the
// tests in Node. Units are the table's (600 × 1100, y grows down the table toward the flippers) and seconds.
//
// A ball is a circle. The walls are thick segments, circles and arcs; the flippers are tapered capsules turning about
// their pivots. Every 1/120 s tick is cut into substeps small enough that a ball never moves more than about 40% of its
// radius in one (so it can't tunnel through a wall or a flipper, at any speed it can reach), and each substep pushes a
// ball out of whatever it overlaps and bounces it off with that surface's restitution and friction, relative to the
// surface's own velocity (a flipper's swing is passed on to the ball where it touches).

export const BALL_R = 13;
export const GRAVITY = 2050;          // down the table, units/s² (a ball dropped at the top reaches the flippers in ~1 s)
export const MAX_V = 4300;            // nothing in the game moves a ball faster
export const DRAG = 0.035;            // rolling and air, per second
export const REST_V = 70;             // slower impacts than this don't bounce (a ball can rest and roll)

// ---------- colliders ----------
let nextId = 1;
const box = (c, x0, y0, x1, y1, pad) => {
  c.x0 = Math.min(x0, x1) - pad; c.y0 = Math.min(y0, y1) - pad;
  c.x1 = Math.max(x0, x1) + pad; c.y1 = Math.max(y0, y1) + pad;
  return c;
};
const base = (o) => ({
  id: nextId++, e: o.e ?? 0.45, f: o.f ?? 0.06, kick: o.kick ?? 0, kickMin: o.kickMin ?? 0, kickVar: o.kickVar ?? 0, kickAngle: o.kickAngle ?? 0,
  tag: o.tag || 'wall', ref: o.ref ?? null,
  on: o.on ?? true, oneWay: o.oneWay || null, sound: o.sound || 'wall',
});

// a wall along a→b, `r` thick on each side (its ends rounded)
export function seg(ax, ay, bx, by, o = {}) {
  const c = base(o);
  c.k = 0; c.ax = ax; c.ay = ay; c.bx = bx; c.by = by; c.r = o.r ?? 4;
  c.dx = bx - ax; c.dy = by - ay; c.len2 = c.dx * c.dx + c.dy * c.dy || 1e-9;
  const L = Math.sqrt(c.len2);
  c.nx = -c.dy / L; c.ny = c.dx / L;     // its left-hand normal (one-way walls use it)
  return box(c, ax, ay, bx, by, c.r);
}
// a round post or a pop bumper
export function circle(x, y, r, o = {}) {
  const c = base(o);
  c.k = 1; c.x = x; c.y = y; c.R = r;
  return box(c, x, y, x, y, r);
}
// a curved wall: the part of the circle (cx, cy, R) from angle a0 to a1 (radians, a0 < a1, y down), `r` thick
export function arc(cx, cy, R, a0, a1, o = {}) {
  const c = base(o);
  c.k = 2; c.x = cx; c.y = cy; c.R = R; c.a0 = a0; c.span = a1 - a0; c.r = o.r ?? 4;
  c.ex0 = cx + Math.cos(a0) * R; c.ey0 = cy + Math.sin(a0) * R;
  c.ex1 = cx + Math.cos(a1) * R; c.ey1 = cy + Math.sin(a1) * R;
  // its box: the end points and any of the four extremes the arc passes
  let x0 = Math.min(c.ex0, c.ex1), x1 = Math.max(c.ex0, c.ex1), y0 = Math.min(c.ey0, c.ey1), y1 = Math.max(c.ey0, c.ey1);
  for (let q = -4; q <= 8; q++) {
    const a = (q * Math.PI) / 2;
    if (a > a0 && a < a1) { x0 = Math.min(x0, cx + Math.cos(a) * R); x1 = Math.max(x1, cx + Math.cos(a) * R); y0 = Math.min(y0, cy + Math.sin(a) * R); y1 = Math.max(y1, cy + Math.sin(a) * R); }
  }
  return box(c, x0, y0, x1, y1, c.r);
}

// a flipper: a tapered capsule from its pivot (radius r1) to its tip (radius r2), `len` between their centres. It
// swings between `rest` and `up` (radians): fast up while held, back down on its spring when let go.
export const FLIP = { acc: 2600, maxW: 23, retAcc: 600, retMaxW: 15 };
export function flipper({ x, y, len, r1, r2, rest, up, tag = 'flipper', side }) {
  const sinP = (r1 - r2) / len;
  return {
    id: nextId++, x, y, len, r1, r2, rest, up, angle: rest, w: 0, held: false, tag, side,
    sinP, cosP: Math.sqrt(1 - sinP * sinP), e: 0.55, f: 0.22, dir: Math.sign(up - rest),
    x0: x - len - r1, y0: y - len - r1, x1: x + len + r1, y1: y + len + r1,
    moved: 0,                       // how far it swung since it was last at rest (for the sound and the AI)
  };
}

export function moveFlipper(f, dt) {
  const target = f.held ? f.up : f.rest;
  const d = target - f.angle;
  if (Math.abs(d) < 1e-9) { f.w = 0; return; }
  const dir = Math.sign(d);
  if (Math.sign(f.w) !== dir) f.w = 0;          // a solenoid reverses at once
  const acc = f.held ? FLIP.acc : FLIP.retAcc, maxW = f.held ? FLIP.maxW : FLIP.retMaxW;
  f.w += dir * acc * dt;
  if (Math.abs(f.w) > maxW) f.w = dir * maxW;
  f.angle += f.w * dt;
  if ((target - f.angle) * dir <= 0) { f.angle = target; f.w = 0; }
}

// ---------- the closest point ----------
// probe(c, x, y, out) → the distance from (x, y) to the collider's surface (negative inside), with out.nx/ny the
// surface's normal toward the point
function probeSeg(c, px, py, out) {
  let t = ((px - c.ax) * c.dx + (py - c.ay) * c.dy) / c.len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = c.ax + c.dx * t, qy = c.ay + c.dy * t;
  let nx = px - qx, ny = py - qy;
  const d = Math.sqrt(nx * nx + ny * ny);
  if (d > 1e-9) { nx /= d; ny /= d; } else {
    // right on the line: whichever side the wall's normal says (one-way walls: their solid side)
    nx = c.nx; ny = c.ny;
  }
  out.nx = nx; out.ny = ny; out.t = t;
  return d - c.r;
}
function probeCircle(c, px, py, out) {
  let nx = px - c.x, ny = py - c.y;
  const d = Math.sqrt(nx * nx + ny * ny);
  if (d > 1e-9) { nx /= d; ny /= d; } else { nx = 0; ny = -1; }
  out.nx = nx; out.ny = ny;
  return d - c.R;
}
function probeArc(c, px, py, out) {
  let rx = px - c.x, ry = py - c.y;
  const d = Math.sqrt(rx * rx + ry * ry);
  let a = Math.atan2(ry, rx) - c.a0;
  a -= Math.floor(a / (Math.PI * 2)) * Math.PI * 2;
  if (a <= c.span) {
    if (d > 1e-9) { rx /= d; ry /= d; } else { rx = 1; ry = 0; }
    const s = d >= c.R ? 1 : -1;
    out.nx = rx * s; out.ny = ry * s;
    return Math.abs(d - c.R) - c.r;
  }
  // past an end: its rounded tip
  const e0 = (px - c.ex0) ** 2 + (py - c.ey0) ** 2, e1 = (px - c.ex1) ** 2 + (py - c.ey1) ** 2;
  const ex = e0 < e1 ? c.ex0 : c.ex1, ey = e0 < e1 ? c.ey0 : c.ey1;
  let nx = px - ex, ny = py - ey;
  const dd = Math.sqrt(nx * nx + ny * ny);
  if (dd > 1e-9) { nx /= dd; ny /= dd; } else { nx = 0; ny = -1; }
  out.nx = nx; out.ny = ny;
  return dd - c.r;
}
export function probe(c, px, py, out) {
  return c.k === 0 ? probeSeg(c, px, py, out) : c.k === 1 ? probeCircle(c, px, py, out) : probeArc(c, px, py, out);
}

// The flipper's exact outline: its two end circles and the two lines tangent to both. In its own frame (u along it from
// the pivot, v across), mirrored so v ≥ 0.
export function probeFlipper(f, px, py, out) {
  const ca = Math.cos(f.angle), sa = Math.sin(f.angle);
  const rx = px - f.x, ry = py - f.y;
  const u = rx * ca + ry * sa;
  const v0 = -rx * sa + ry * ca;
  const s = v0 >= 0 ? 1 : -1, v = v0 * s;
  // the tangent edge on this side: normal n = (sinP, cosP), from T1 = r1·n to T2 = (len, 0) + r2·n
  const nU = f.sinP, nV = f.cosP;
  const t1u = f.r1 * nU, t1v = f.r1 * nV;
  const eU = nV, eV = -nU;                      // along the edge, toward the tip
  const t = (u - t1u) * eU + (v - t1v) * eV;
  const edgeLen = f.len * f.cosP;
  let lu, lv, d;
  if (t <= 0) {
    const m = Math.sqrt(u * u + v * v) || 1e-9;
    lu = u / m; lv = v / m; d = m - f.r1;
  } else if (t >= edgeLen) {
    const du = u - f.len, m = Math.sqrt(du * du + v * v) || 1e-9;
    lu = du / m; lv = v / m; d = m - f.r2;
  } else {
    lu = nU; lv = nV; d = (u - t1u) * nU + (v - t1v) * nV;
  }
  lv *= s;
  // back to the table's frame
  out.nx = lu * ca - lv * sa; out.ny = lu * sa + lv * ca;
  out.u = u;                                    // how far along the flipper (for the AI and the tests)
  return d;
}

// ---------- sensors (the ball passes over them: rollovers, gates, the spinner, the ramp's mouth) ----------
// a line: fires when a ball's centre crosses it (dir +1 crossing toward its left-hand normal, −1 the other way)
export function line(ax, ay, bx, by, o = {}) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
  return { id: nextId++, k: 3, ax, ay, bx, by, dx, dy, nx: -dy / L, ny: dx / L, tag: o.tag || 'line', ref: o.ref ?? null, on: true,
    x0: Math.min(ax, bx) - 2, y0: Math.min(ay, by) - 2, x1: Math.max(ax, bx) + 2, y1: Math.max(ay, by) + 2 };
}
// a spot: fires when a ball's centre comes within r of it (once, until it leaves)
export function spot(x, y, r, o = {}) {
  return { id: nextId++, k: 4, x, y, r, tag: o.tag || 'spot', ref: o.ref ?? null, on: true, x0: x - r, y0: y - r, x1: x + r, y1: y + r };
}

// did the segment p→q cross line l? → +1 / −1 / 0
function crossed(l, px, py, qx, qy) {
  const sp = (px - l.ax) * l.nx + (py - l.ay) * l.ny, sq = (qx - l.ax) * l.nx + (qy - l.ay) * l.ny;
  if ((sp > 0) === (sq > 0)) return 0;
  const k = sp / (sp - sq);
  const ix = px + (qx - px) * k, iy = py + (qy - py) * k;
  const t = ((ix - l.ax) * l.dx + (iy - l.ay) * l.dy) / (l.dx * l.dx + l.dy * l.dy);
  if (t < 0 || t > 1) return 0;
  return sq > 0 ? 1 : -1;
}

// ---------- the world ----------
// world: { colliders: [], flippers: [], sensors: [] }; a ball: { x, y, vx, vy, live, inSpot: Set }
// rng: () => [0, 1) (seeded by the game: the kicks' small differences repeat with the seed)
export function createWorld({ colliders = [], flippers = [], sensors = [], rng = null } = {}) {
  return { colliders, flippers, sensors, rng, t: 0 };
}

const hit = { nx: 0, ny: 0, t: 0, u: 0 };

// one contact: push the ball out and bounce it. vsx/vsy: the surface's own velocity at the contact. → impact speed
function resolve(b, pen, nx, ny, e, fr, vsx, vsy) {
  b.x += nx * pen; b.y += ny * pen;
  const rvx = b.vx - vsx, rvy = b.vy - vsy;
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0) return 0;
  const ee = -vn < REST_V ? 0 : e;
  const jn = -(1 + ee) * vn;
  // friction: the sliding part shrinks, never past zero
  let tx = rvx - vn * nx, ty = rvy - vn * ny;
  const ts = Math.sqrt(tx * tx + ty * ty);
  let jt = 0;
  if (ts > 1e-6) { jt = Math.min(ts, fr * jn); tx /= ts; ty /= ts; }
  b.vx += nx * jn - tx * jt;
  b.vy += ny * jn - ty * jt;
  return -vn;
}

// Advance every live ball by dt (one game tick), calling on.contact(collider|flipper, ball, speed) and
// on.sensor(sensor, ball, dir). Flippers move in the same substeps.
export function stepWorld(world, balls, dt, on = {}, gravity = GRAVITY) {
  let vmax = 0;
  for (const b of balls) if (b.live) vmax = Math.max(vmax, Math.hypot(b.vx, b.vy));
  let wmax = 0;
  for (const f of world.flippers) wmax = Math.max(wmax, Math.abs(f.w), f.held !== (f.angle === f.up) ? FLIP.maxW : 0);
  const reach = vmax * dt + wmax * 90 * dt;
  const n = Math.max(2, Math.min(16, Math.ceil(reach / (BALL_R * 0.4))));
  const h = dt / n;
  world.t = (world.t || 0) + dt;
  // the candidates near each ball over the whole tick (its box grown by how far it can go)
  for (const b of balls) {
    if (!b.live) continue;
    b.onFlipper = null;
    const pad = BALL_R + Math.hypot(b.vx, b.vy) * dt + 6;
    const x0 = b.x - pad, x1 = b.x + pad, y0 = b.y - pad, y1 = b.y + pad;
    const cand = b.cand || (b.cand = []), candF = b.candF || (b.candF = []), candS = b.candS || (b.candS = []);
    cand.length = 0; candF.length = 0; candS.length = 0;
    for (const c of world.colliders) if (c.on && c.x1 >= x0 && c.x0 <= x1 && c.y1 >= y0 && c.y0 <= y1) cand.push(c);
    for (const f of world.flippers) if (f.x1 >= x0 && f.x0 <= x1 && f.y1 >= y0 && f.y0 <= y1) candF.push(f);
    for (const s of world.sensors) if (s.on && s.x1 >= x0 && s.x0 <= x1 && s.y1 >= y0 && s.y0 <= y1) candS.push(s);
  }
  for (let i = 0; i < n; i++) {
    for (const f of world.flippers) {
      const before = f.angle;
      moveFlipper(f, h);
      f.moved += Math.abs(f.angle - before);
      if (f.angle === f.rest) f.moved = 0;
    }
    for (const b of balls) {
      if (!b.live) continue;
      b.vy += gravity * h;
      const k = 1 - DRAG * h;
      b.vx *= k; b.vy *= k;
      const sp = Math.hypot(b.vx, b.vy);
      if (sp > MAX_V) { b.vx *= MAX_V / sp; b.vy *= MAX_V / sp; }
      const px = b.x, py = b.y;
      b.x += b.vx * h; b.y += b.vy * h;
      // two passes, so a ball wedged between two surfaces settles
      for (let pass = 0; pass < 2; pass++) {
        for (const c of b.cand) {
          if (!c.on) continue;
          const d = probe(c, b.x, b.y, hit);
          const pen = BALL_R - d;
          if (pen <= 0) continue;
          if (c.oneWay) {
            // solid only from its normal's side: a ball on the other side passes through
            const side = (b.x - c.ax) * c.oneWay.x + (b.y - c.ay) * c.oneWay.y;
            const prev = (px - c.ax) * c.oneWay.x + (py - c.ay) * c.oneWay.y;
            if (side < 0 && prev < 0) continue;
            if (prev < -BALL_R * 0.5) continue;
          }
          const vin = -(b.vx * hit.nx + b.vy * hit.ny);
          const s = resolve(b, pen, hit.nx, hit.ny, c.e, c.f, 0, 0);
          if (c.kick && vin >= c.kickMin && (c.cool || 0) <= world.t) {
            // a pop bumper or a slingshot fires: the ball leaves at least about this fast, a little off the normal (no
            // two kicks are quite the same, so a ball can't ping-pong between the slingshots for ever)
            const r1 = world.rng ? world.rng() : 0.5, r2 = world.rng ? world.rng() : 0.5;
            const a = (r1 - 0.5) * 2 * (c.kickAngle || 0), ca = Math.cos(a), sa = Math.sin(a);
            const kx = hit.nx * ca - hit.ny * sa, ky = hit.nx * sa + hit.ny * ca;
            const want = c.kick * (1 + (r2 - 0.5) * 2 * (c.kickVar || 0));
            const vn = b.vx * kx + b.vy * ky;
            if (vn < want) { b.vx += kx * (want - vn); b.vy += ky * (want - vn); }
            c.cool = world.t + 0.05;
            on.contact?.(c, b, Math.max(s, vin), true);
          } else if (s > 0 || pass === 0) on.contact?.(c, b, s, false);
        }
        for (const f of b.candF) {
          const d = probeFlipper(f, b.x, b.y, hit);
          const pen = BALL_R - d;
          if (pen <= 0) continue;
          // the surface's velocity where the ball touches it: ω × (contact − pivot)
          const cx = b.x - hit.nx * d - f.x, cy = b.y - hit.ny * d - f.y;
          const vsx = -f.w * cy, vsy = f.w * cx;
          const s = resolve(b, pen, hit.nx, hit.ny, f.e, f.f, vsx, vsy);
          if (s > 0) on.contact?.(f, b, s, Math.abs(f.w) > 2);
          b.onFlipper = f;
          b.flipU = hit.u;
        }
      }
      // sensors
      for (const s of b.candS) {
        if (!s.on) continue;
        if (s.k === 3) {
          const dir = crossed(s, px, py, b.x, b.y);
          if (dir) on.sensor?.(s, b, dir);
        } else {
          const inside = (b.x - s.x) ** 2 + (b.y - s.y) ** 2 <= s.r * s.r;
          const was = b.inSpot.has(s.id);
          if (inside && !was) { b.inSpot.add(s.id); on.sensor?.(s, b, 1); } else if (!inside && was) b.inSpot.delete(s.id);
        }
      }
      // a last guard: a non-number never survives (a broken frame can't poison the run)
      if (!(Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.vx) && Number.isFinite(b.vy))) {
        b.x = px; b.y = py; b.vx = 0; b.vy = 0;
      }
    }
  }
  return n;
}

export function makeBall(x, y, vx = 0, vy = 0) {
  return { x, y, vx, vy, live: true, inSpot: new Set(), cand: [], candF: [], candS: [], onFlipper: null, flipU: 0 };
}
