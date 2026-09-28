// AGI-1 in 2D (2026-09-27): the small, pure pieces of her motion (no three.js, no browser), so tests can check them.
// Used by src/stage/agi1-2d.js.

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export function smoothstep(e0, e1, x) {
  let t = (x - e0) / (e1 - e0);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
}
export const DEG = Math.PI / 180;

// ---------- which AGI-1 the visitor picked: '3d' (the default) or '2d', remembered in the browser ----------
export const STYLE_KEY = 'agi1_style';
export function readStyle(value) { return value === '2d' ? '2d' : '3d'; }

// ---------- smooth noise (the same every time for the same seed), for her idle drift ----------
export function makeNoise(seed) {
  const p = new Float32Array(256);
  let s = (Math.floor(seed * 48271) + 11) % 2147483647;
  if (s <= 0) s += 2147483646;
  for (let i = 0; i < 256; i++) { s = (s * 16807) % 2147483647; p[i] = (s / 2147483647) * 2 - 1; }
  return (x) => {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return p[i & 255] * (1 - u) + p[(i + 1) & 255] * u;
  };
}
// a few octaves: slow drifts with a little detail on top (about -1..1)
export function makeDrift(seed) {
  const a = makeNoise(seed), b = makeNoise(seed + 17.3), c = makeNoise(seed + 41.9);
  return (t) => a(t) * 0.62 + b(t * 2.13 + 11.1) * 0.28 + c(t * 4.37 + 3.3) * 0.1;
}

// ---------- "second-order" smoothing: follows a target like a real body part would ----------
// f: how quickly it follows (Hz), z: damping (1 = no overshoot, below 1 a little bounce), r: how it starts (0 = slowly,
// 1 = at once, above 1 it anticipates). Stable at any frame rate.
export class Follow {
  constructor(x = 0, f = 2, z = 1, r = 0) {
    this.set(f, z, r);
    this.xp = x; this.y = x; this.v = 0;
  }
  set(f, z, r = 0) {
    this.k1 = z / (Math.PI * f);
    this.k2 = 1 / ((2 * Math.PI * f) * (2 * Math.PI * f));
    this.k3 = (r * z) / (2 * Math.PI * f);
    return this;
  }
  reset(x) { this.xp = x; this.y = x; this.v = 0; }
  step(dt, x) {
    if (!(dt > 0)) return this.y;
    const xd = (x - this.xp) / dt;
    this.xp = x;
    const k2 = Math.max(this.k2, (dt * dt) / 2 + (dt * this.k1) / 2, dt * this.k1);
    this.y += dt * this.v;
    this.v += (dt * (x + this.k3 * xd - this.y - this.k1 * this.v)) / k2;
    return this.y;
  }
}

// ---------- her chest: soft, natural follow-through (2026-09-28, the owner's request) ----------
// The lower part of her chest trails her body a little when it moves (a hop, a sway, her dance), overshoots once or twice
// and settles, like soft tissue under a t-shirt. Natural, never exaggerated (the site is PG-13): at most a few pixels of
// her 1536 px picture, a soft limit instead of a hard stop, nothing at all while she stands still.
// f / z: the spring (Hz, damping); gainX / gainY: how much of her body's lag shows; hop: how much of a hop's height the
// spring feels (a hop is a much bigger move than her sway or her dance's bounce); maxX / maxY: the soft limits (art px).
export const CHEST = { f: 2.8, z: 0.34, gainX: 0.4, gainY: 0.6, hop: 0.36, maxX: 3.5, maxY: 7 };
const soft = (v, m) => m * Math.tanh(v / m);
export class Jiggle {
  constructor(p = CHEST) {
    this.p = p;
    this.fx = new Follow(0, p.f, p.z, 0); this.fy = new Follow(0, p.f, p.z, 0);
    this.tx = 0; this.ty = 0; this.x = 0; this.y = 0; this.ready = false;
  }
  // tx, ty: where the middle of her chest is this frame (art px, after her pose and her hop)
  reset(tx, ty) { this.fx.reset(tx); this.fy.reset(ty); this.tx = tx; this.ty = ty; this.x = 0; this.y = 0; this.ready = true; return this; }
  step(dt, tx, ty) {
    if (!this.ready) return this.reset(tx, ty);
    if (!(dt > 0)) return this;
    // small steps between last frame's target and this one: the same motion at 30, 60 or 144 frames a second
    const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n, x0 = this.tx, y0 = this.ty;
    for (let i = 1; i <= n; i++) { const u = i / n; this.fx.step(h, x0 + (tx - x0) * u); this.fy.step(h, y0 + (ty - y0) * u); }
    this.tx = tx; this.ty = ty;
    this.x = soft((this.fx.y - tx) * this.p.gainX, this.p.maxX);
    this.y = soft((this.fy.y - ty) * this.p.gainY, this.p.maxY);
    return this;
  }
}
// How much each point of her body picture moves with it (0..1): two soft ovals, one per side, strongest on their lower
// half; the top of her chest (and the AGI print on her shirt) stays with her body. c: RIG.chest.
export function chestWeight(x, y, c) {
  const lobe = (cx) => {
    const e = ((x - cx) / c.rx) ** 2 + ((y - c.cy) / c.ry) ** 2;
    return e < 1 ? (1 - e) * (1 - e) : 0;
  };
  return (1 - (1 - lobe(c.L)) * (1 - lobe(c.R))) * smoothstep(c.top, c.full, y);
}

// ---------- blinking ----------
// How closed her eyes are, t seconds into a blink: shut in 70 ms (speeding up, as a lid falls), closed for 40 ms, open
// in 150 ms (slowing down at the end). 0 = open, 1 = closed.
export const BLINK = { close: 0.07, hold: 0.04, open: 0.15 };
export function blinkAmount(t) {
  if (!(t >= 0)) return 0;
  const { close, hold, open } = BLINK;
  if (t < close) { const u = t / close; return u * u; }
  if (t < close + hold) return 1;
  const u = (t - close - hold) / open;
  if (u >= 1) return 0;
  return 1 - (1 - (1 - u) * (1 - u));        // eases out: quick at first, gentle at the end
}
export const blinkLength = () => BLINK.close + BLINK.hold + BLINK.open;
// When the next blink comes: every 2 to 6 seconds, now and then a quick second one.
export function nextBlinkGap(rand = Math.random) {
  return rand() < 0.14 ? 0.18 + rand() * 0.1 : 2 + rand() * 4;
}

// ---------- her eyelids ----------
// Each eye's white has a top and a bottom edge, sampled at 9 points across (from the rig). Given how closed her upper lid
// is (c), how much she smiles with her eyes (s: the lower lid rises), "^^" (h) and wide eyes (w), this gives where her
// upper and lower lids are, at the same 9 points. Closed, her lid is a soft "‿"; with "^^" it's an arch "∩".
export function lidCurves(eye, { c = 0, s = 0, h = 0, w = 0 } = {}, out = { top: new Float32Array(9), bot: new Float32Array(9) }) {
  const { top, bot } = eye;
  const n = top.length, mid = (n - 1) / 2;
  const tm = top[mid], bm = bot[mid], hgt = bm - tm;
  for (let i = 0; i < n; i++) {
    const u = (i - mid) / mid;                               // -1 .. 1 across the eye
    const bow = 1 - u * u;
    const corner = lerp((top[0] + bot[0]) / 2, (top[n - 1] + bot[n - 1]) / 2, (u + 1) / 2);
    const closed = corner + (bm - 0.36 * hgt - corner) * Math.pow(bow, 0.8);     // "‿", two thirds of the way down
    const arch = corner + 1.4 - (corner + 1.4 - (tm + 0.5 * hgt)) * Math.pow(bow, 0.7);   // "∩" across the middle
    let up = lerp(top[i] - 1.6 * w * bow, closed, clamp(c, 0, 1));
    let lo = lerp(bot[i], bot[i] - 0.42 * (bot[i] - top[i]) * Math.sqrt(bow), clamp(s, 0, 1));
    up = lerp(up, arch, clamp(h, 0, 1));
    lo = lerp(lo, arch + 0.3, clamp(h, 0, 1));
    if (lo < up) lo = up;
    out.top[i] = up; out.bot[i] = lo;
  }
  return out;
}
// the value of a 9-point curve at x (between x0 and x1; flat beyond the ends)
export function curveAt(arr, x0, x1, x) {
  const n = arr.length - 1;
  const t = clamp((x - x0) / (x1 - x0), 0, 1) * n;
  const i = Math.min(n - 1, Math.floor(t));
  return lerp(arr[i], arr[i + 1], t - i);
}

// ---------- her head turning (2.5D) ----------
// Her face is painted flat, so turning her head moves each point by how far in front of (or behind) the middle of her
// head it sits: the tip of her nose moves most, her ears hardly, the back of her hair the other way. Like a painted
// ball turning. yaw/pitch in radians; z in art pixels; (cx, cy) the middle of her head. Writes [x, y] into out.
export function turnPoint(x, y, z, cx, cy, yaw, pitch, out) {
  const X = x - cx, Y = y - cy;
  const cyw = Math.cos(yaw), syw = Math.sin(yaw);
  const X1 = X * cyw + z * syw;
  const Z1 = -X * syw + z * cyw;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const Y2 = Y * cp + Z1 * sp;
  out[0] = cx + X1; out[1] = cy + Y2;
  return out;
}
// How far in front of the middle of her head a point of her face is: her eyes, nose and mouth move together (a flat
// middle, as anime faces are drawn), then less and less toward the outline of her face and her ears, smoothly (a sharp
// edge here would crease the picture when she turns).
export const HEAD = { cx: 512, cy: 152, depth: 60, rx: 92, ry: 128, flat: 0.35 };
export function faceDepth(x, y) {
  const dx = (x - HEAD.cx) / HEAD.rx, dy = (y - HEAD.cy) / HEAD.ry;
  const r = Math.sqrt(dx * dx + dy * dy);
  return HEAD.depth * (1 - smoothstep(HEAD.flat, 1, r));
}

// ---------- her elbows: one picture per arm, bent like an arm ----------
// Each point of her arm's picture turns around her elbow by part of the elbow's bend b (radians from rest), depending on
// its angle `alpha` around her elbow at rest: 0 = toward her wrist, going round the inside of her elbow up to beta0 =
// toward her shoulder; negative = round the outside (the point of her elbow).
//  • Outside (elbowOuter): a wedge at the point of her elbow turns part of the way, spread like a fan, and is drawn in
//    toward her elbow, so her outline there becomes a round cap as wide as her arm, joining her upper arm and forearm
//    (both straight) smoothly. The rest of her arm turns with its own bone: her forearm by b, her upper arm not at all.
//  • Inside (elbowInner): the arm is drawn twice, 'upper' and 'fore', each cut along the line from her elbow to the
//    crease, the corner where the inside outlines of her upper arm and forearm meet (creaseAngle): the upper arm's copy
//    keeps its side unturned, the forearm's copy its side turned by b, so the two outlines meet exactly there, however far
//    she bends. Both copies are the same outside, and neither folds over itself (what would is on the cut-away side).
export const ELBOW = { round: 0.96 };                      // the wedge at the point of her elbow: ±55° at rest
export function wrapAngle(a, hi = Math.PI) {                // into (hi - 2π, hi]
  const T = Math.PI * 2;
  a = ((a - hi) % T + T) % T + hi;
  return a > hi ? a - T : a;
}
export function elbowOuter(alpha, b, beta0, out = {}) {
  const half = Math.PI - beta0 / 2;                        // half the outside angle at rest
  const psi = alpha + half;                                // from the point of her elbow
  const w = smoothstep(-ELBOW.round, ELBOW.round, psi);
  out.turn = b * w;
  out.scale = 1;
  if (Math.abs(psi) < ELBOW.round) {
    // at rest her outline here is her upper arm's and forearm's straight edges, facing ±eps from the point of her elbow;
    // bent, it should be those edges with a round cap between them: each direction is drawn in (or not) to get there
    const eps = half - Math.PI / 2, psi2 = psi + b * (w - 0.5);
    out.scale = Math.cos(Math.abs(psi) - eps) / Math.cos(Math.max(0, Math.abs(psi2) - eps - b / 2));
  }
  return out;
}
export function elbowInner(alpha, b, beta0, crease, part) {
  if (part === 'upper') return alpha >= crease ? 0 : b * (1 - alpha / crease);
  const f0 = crease - b;                                   // her forearm's side of the crease, before it turned
  return alpha <= f0 ? b : (b * (beta0 - alpha)) / (beta0 - f0);
}
// Where the crease is (its angle from her unbent forearm) when she bends by b: the direction in which her upper arm's
// inside outline (unturned) and her forearm's (turned by b) are the same distance from her elbow. `inner`: her outline's
// distance from her elbow every `step` radians round the inside (RIG.elbows). Small bends: halfway between the two.
export function creaseAngle(b, beta0, inner, step = 4 * DEG) {
  const lo = Math.max(b, 0) + 0.05, hi = Math.min(beta0, beta0 + b) - 0.05;
  const half = clamp((b + beta0) / 2, lo, hi);
  if (!(hi > lo)) return (b + beta0) / 2;
  const d = (a) => {
    const t = clamp(a / step, 0, inner.length - 1), i = Math.min(inner.length - 2, Math.floor(t));
    return lerp(inner[i], inner[i + 1], t - i);
  };
  let found = half;
  for (let a = lo, prev = NaN; a <= hi + 1e-9; a += 0.02) {
    const g = d(a) - d(a - b);
    if (g >= 0 && prev < 0) { found = a - 0.02 * (g / (g - prev)); break; }
    prev = g;
  }
  return lerp(half, clamp(found, lo, hi), smoothstep(0.08, 0.35, Math.abs(b)));
}
// how far she can bend (radians from rest): not so far that her forearm passes through her upper arm, and only a little
// the other way
export const elbowLimits = (beta0) => [-0.38, beta0 - 0.12];

// ---------- her mouth while she talks ----------
// From how loud she is (0..1): how open her mouth is. Opens quickly on a syllable, closes a little slower, never all the
// way open (like her 3D mouth since 2026-09-26).
export function mouthTarget(level) { return Math.min(0.9, Math.max(0, (level - 0.05) * 1.15)); }
export function mouthStep(open, level, dt) {
  const want = mouthTarget(level);
  const next = open + (want - open) * (1 - Math.exp(-dt * (want > open ? 20 : 9)));
  return want === 0 && next < 0.01 ? 0 : next;
}

// ---------- 2D affine transforms: [a, b, c, d, e, f] means x' = a x + c y + e, y' = b x + d y + f ----------
export const IDENTITY = [1, 0, 0, 1, 0, 0];
export function mul(m, n, out = new Array(6)) {
  const a = m[0] * n[0] + m[2] * n[1], b = m[1] * n[0] + m[3] * n[1];
  const c = m[0] * n[2] + m[2] * n[3], d = m[1] * n[2] + m[3] * n[3];
  const e = m[0] * n[4] + m[2] * n[5] + m[4], f = m[1] * n[4] + m[3] * n[5] + m[5];
  out[0] = a; out[1] = b; out[2] = c; out[3] = d; out[4] = e; out[5] = f;
  return out;
}
// turn by `deg` degrees around (px, py) (positive = clockwise on screen, as y points down)
export function rotAround(px, py, deg, out = new Array(6)) {
  const r = deg * DEG, c = Math.cos(r), s = Math.sin(r);
  out[0] = c; out[1] = s; out[2] = -s; out[3] = c; out[4] = px - c * px + s * py; out[5] = py - s * px - c * py;
  return out;
}
export function translate(x, y, out = new Array(6)) { out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 1; out[4] = x; out[5] = y; return out; }
export function scaleAround(px, py, sx, sy, out = new Array(6)) {
  out[0] = sx; out[1] = 0; out[2] = 0; out[3] = sy; out[4] = px - sx * px; out[5] = py - sy * py; return out;
}
export function apply(m, x, y, out) { out[0] = m[0] * x + m[2] * y + m[4]; out[1] = m[1] * x + m[3] * y + m[5]; return out; }
