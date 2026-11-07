// JAILBREAK: the ball's physics, pure (no DOM, no clock, no dice). A circle swept against boxes (bricks, the paddle,
// the Warden) and the three walls, so a ball never passes through anything at any speed; reflection by the contact
// normal; the paddle's angle control (where it lands on the paddle → where it goes, 20° to 160°); a minimum climb so
// no ball crawls sideways forever. tests/jailbreak.test.js runs all of it in Node.

export const EPS = 1e-9;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const DEG = Math.PI / 180;

// A hit, reused: `t` the fraction of the move (0..1) where the circle first touches, (nx, ny) the surface's normal
export const newHit = () => ({ t: 1, nx: 0, ny: 0 });

// The circle (center p, radius r, moving by d) against a rounded corner at c (radius r too, the Minkowski sum)
function corner(px, py, dx, dy, cx, cy, r, out) {
  const ox = px - cx, oy = py - cy;
  const c = ox * ox + oy * oy - r * r;
  const b = ox * dx + oy * dy;
  if (c <= 0) {                       // already touching it: a hit now, if it's moving in
    if (b >= 0) return false;
    const d = Math.sqrt(ox * ox + oy * oy) || 1;
    out.t = 0; out.nx = ox / d; out.ny = oy / d;
    return true;
  }
  const a = dx * dx + dy * dy;
  if (a < EPS || b >= 0) return false;
  const disc = b * b - a * c;
  if (disc < 0) return false;
  const t = (-b - Math.sqrt(disc)) / a;
  if (t < 0 || t > 1) return false;
  out.t = t; out.nx = (ox + dx * t) / r; out.ny = (oy + dy * t) / r;
  return true;
}

// A circle of radius r at (px, py) moving by (dx, dy) against the box [x0, x1] × [y0, y1]: true and `out` filled when
// it touches the box during the move (out.t: 0..1), false when it doesn't (or it's moving away from it). The box grown
// by r with rounded corners (the Minkowski sum): its faces by the slab method, its corners as circles, so a glancing
// corner hit bounces off the corner's real normal. A circle that starts overlapping a face is pushed out at t = 0.
export function sweepBox(px, py, dx, dy, r, x0, y0, x1, y1, out) {
  const ex0 = x0 - r, ex1 = x1 + r, ey0 = y0 - r, ey1 = y1 + r;
  let tin = -Infinity, tout = Infinity, nx = 0, ny = 0;
  if (dx > EPS || dx < -EPS) {
    const ta = (ex0 - px) / dx, tb = (ex1 - px) / dx;
    const t0 = ta < tb ? ta : tb, t1 = ta < tb ? tb : ta;
    if (t0 > tin) { tin = t0; nx = dx > 0 ? -1 : 1; ny = 0; }
    if (t1 < tout) tout = t1;
  } else if (px < ex0 || px > ex1) return false;
  if (dy > EPS || dy < -EPS) {
    const ta = (ey0 - py) / dy, tb = (ey1 - py) / dy;
    const t0 = ta < tb ? ta : tb, t1 = ta < tb ? tb : ta;
    if (t0 > tin) { tin = t0; nx = 0; ny = dy > 0 ? -1 : 1; }
    if (t1 < tout) tout = t1;
  } else if (py < ey0 || py > ey1) return false;
  if (tin > tout || tout < 0 || tin > 1) return false;
  // where its center is as it reaches the grown box (or now, when it's already inside it)
  const t = tin > 0 ? tin : 0;
  const hx = px + dx * t, hy = py + dy * t;
  const sx = hx < x0 ? -1 : hx > x1 ? 1 : 0;
  const sy = hy < y0 ? -1 : hy > y1 ? 1 : 0;
  if (sx && sy) return corner(px, py, dx, dy, sx < 0 ? x0 : x1, sy < 0 ? y0 : y1, r, out);
  if (tin >= 0) { out.t = tin; out.nx = nx; out.ny = ny; return true; }
  // it started overlapping a face: out the shallowest way, if it's moving in
  let qx = sx, qy = sy;
  if (!sx && !sy) {                   // its center inside the box itself
    const l = hx - x0, rr = x1 - hx, u = hy - y0, d = y1 - hy;
    const m = Math.min(l, rr, u, d);
    if (m === u) qy = -1; else if (m === d) qy = 1; else if (m === l) qx = -1; else qx = 1;
  }
  if (dx * qx + dy * qy >= 0) return false;
  out.t = 0; out.nx = qx; out.ny = qy;
  return true;
}

// The walls: x = 0 (left), x = W (right), y = 0 (top). The bottom is open: that's where balls are lost.
export function sweepWalls(px, py, dx, dy, r, W, out) {
  let best = Infinity, nx = 0, ny = 0;
  if (dx < 0) { const t = (r - px) / dx; if (t < best) { best = t; nx = 1; ny = 0; } }
  else if (dx > 0) { const t = (W - r - px) / dx; if (t < best) { best = t; nx = -1; ny = 0; } }
  if (dy < 0) { const t = (r - py) / dy; if (t < best) { best = t; nx = 0; ny = 1; } }
  if (best > 1) return false;
  out.t = best < 0 ? 0 : best; out.nx = nx; out.ny = ny;
  return true;
}

// Bounce `v` ({ vx, vy }) off a surface with normal n (only when it's moving into it)
export function reflect(v, nx, ny) {
  const d = v.vx * nx + v.vy * ny;
  if (d < 0) { v.vx -= 2 * d * nx; v.vy -= 2 * d * ny; }
  return v;
}

// Never flatter than this: a ball always climbs or falls at least sin(15°) of its speed (keeps its own direction)
export const MIN_SIN = Math.sin(15 * DEG);
export function minClimb(v, minSin = MIN_SIN) {
  const s = Math.hypot(v.vx, v.vy);
  if (!s) return v;
  const min = s * minSin;
  if (Math.abs(v.vy) < min) {
    const sy = v.vy > 0 ? 1 : -1;      // dead sideways: up
    v.vy = sy * min;
    v.vx = (v.vx < 0 ? -1 : 1) * Math.sqrt(Math.max(0, s * s - min * min));
  }
  return v;
}

// The paddle's angle control: its left edge sends the ball up-left at 160°, its middle straight up (90°), its right
// edge up-right at 20°, in a straight line between (so it's learnable).
export const ANGLE_EDGE = 20, ANGLE_SPAN = 70;
export const paddleOffset = (ballX, paddleX, halfW) => clamp((ballX - paddleX) / halfW, -1, 1);
export const paddleAngle = (offset) => (90 - clamp(offset, -1, 1) * ANGLE_SPAN) * DEG;
export function launchVelocity(offset, speed) {
  const a = paddleAngle(offset);
  return { vx: Math.cos(a) * speed, vy: -Math.sin(a) * speed };
}
// …and back: the offset that sends it at `deg` degrees (for the demo's aim)
export const offsetFor = (deg) => clamp((90 - deg) / ANGLE_SPAN, -1, 1);

// Turn a velocity by `rad` (the multiball's split, the anti-stall nudge)
export function rotate(v, rad) {
  const c = Math.cos(rad), s = Math.sin(rad);
  const vx = v.vx * c - v.vy * s, vy = v.vx * s + v.vy * c;
  v.vx = vx; v.vy = vy;
  return v;
}

// Where a ball at x moving by dx lands between walls at r and W - r (a fold, for predictions)
export function fold(x, r, W) {
  const L = W - 2 * r;
  if (L <= 0) return W / 2;
  let u = (x - r) % (2 * L);
  if (u < 0) u += 2 * L;
  if (u > L) u = 2 * L - u;
  return u + r;
}
