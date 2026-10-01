// AGI-1 in 2D: the small, pure pieces of her motion (no three.js, no browser), so tests can check them. Used by
// src/stage/agi1-2d.js (her Live2D model since 2026-10-01), and by the page to know which AGI-1 the visitor picked.

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export function smoothstep(e0, e1, x) {
  let t = (x - e0) / (e1 - e0);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
}

// ---------- which AGI-1 the visitor picked: '2d' (the default since 2026-10-01, the owner's choice) or '3d' ----------
// remembered in the browser; anything but an exact '3d' is 2D
export const STYLE_KEY = 'agi1_style';
export const DEFAULT_STYLE = '2d';
export function readStyle(value) { return value === '3d' ? '3d' : '2d'; }

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

// ---------- her eyes on the Live2D model ----------
// How open her eyes are (her model's ParamEyeLOpen / ParamEyeROpen, 1 = open): a blink, her lids lowered a little by a
// mood (shy, sad, dreamy, thinking) and her eyes closed in a smile (happy moments). Her model's eyes look clean open, a
// little lowered (down to LIDS_MIN) and closed (her closed lids are a soft "‿"); in between they cross-fade, which only
// looks right for a moment, so a mood never holds them there: they pass through quickly (a blink, a smile).
export const LIDS_MIN = 0.86;
export function eyeOpen(blink, lids, shut) {
  const rest = 1 - (1 - LIDS_MIN) * clamp(lids, 0, 1);
  return rest * (1 - clamp(blink, 0, 1)) * (1 - clamp(shut, 0, 1));
}

// ---------- her mouth while she talks ----------
// From how loud she is (0..1): how open her mouth is. Opens quickly on a syllable, closes a little slower, never all the
// way open (like her 3D mouth since 2026-09-26).
export function mouthTarget(level) { return Math.min(0.9, Math.max(0, (level - 0.05) * 1.15)); }
export function mouthStep(open, level, dt) {
  const want = mouthTarget(level);
  const next = open + (want - open) * (1 - Math.exp(-dt * (want > open ? 20 : 9)));
  return want === 0 && next < 0.01 ? 0 : next;
}

// ---------- her chest: natural, never exaggerated (the site is PG-13: the owner's rule for every feature) ----------
// Her model's chest physics (ParamChestY up and down, ParamChestX sideways, each -1..1) were tuned "really bouncy" for
// another use (at 1 her chest moves 2% of her height); on this site they're scaled down (CHEST.scale, on the physics'
// outputs) and softly limited (CHEST.max: at most about 0.4% of her height, as the 2D AGI-1 before her, 2026-09-28), and
// the two together stay inside a circle, so she moves like a person in a t-shirt: a hop moves it a little and it settles.
export const CHEST = { scale: 0.25, max: 0.2 };
export function chestLimit(x, y, max = CHEST.max) {
  let sx = max * Math.tanh(x / max), sy = max * Math.tanh(y / max);
  const r = Math.hypot(sx, sy);
  if (r > max) { sx *= max / r; sy *= max / r; }
  return [sx, sy];
}

// ---------- where she looks ----------
// From the pointer and her head (both in the canvas's -1..1 coordinates; the pointer may be off the canvas, up to ±3) and
// the canvas's shape: her head's turn (lx, ly) and her eyes' (ex, ey), each -1..1, positive = to the right and up (as
// her model's parameters go). Her eyes reach the edge of their range sooner than her head: they lead, it follows.
export function lookAt(pointer, head, aspect = 1) {
  if (!pointer) return { lx: 0, ly: 0, ex: 0, ey: 0 };
  const a = Math.min(aspect || 1, 1.6);
  const dx = clamp(pointer.x, -3, 3) - head.x, dy = clamp(pointer.y, -3, 3) - head.y;
  return {
    lx: clamp(dx * 0.6 * a, -1, 1), ly: clamp(dy * 0.55, -1, 1),
    ex: clamp(dx * 1.1 * a, -1, 1), ey: clamp(dy * 0.9, -1, 1),
  };
}
