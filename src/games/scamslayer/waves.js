// SCAM SLAYER: what gets thrown, when and where (pure, no DOM, seeded: the same seed throws the same volleys).
//
// A volley is 1 to 6 stickers thrown up from below the screen on parabolic arcs, in a pattern (a row, a fan, a cross, a
// one-after-another wave, a column), sometimes with a heart or a rug among them. Each throw is aimed at its peak, and
// every peak is on the screen (under the top bar, inside the sides). A rug is never thrown where a scam is: for its
// first moments in the air it keeps well clear of every scam of its volley, so a fair swipe at a scam never meets a
// rug by surprise. Later in a run the volleys come faster and bigger, gravity pulls harder, rugs come more often.
import { KINDS, SCAMS, POWERS, roleOf } from './kinds.js';
import { throwTo, closestApproach } from './geom.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// how far into a run it feels: 0 (the first seconds) to 1 (a few minutes in). Blitz starts warm and climbs fast.
export function difficulty(mode, t) {
  if (mode === 'blitz') return clamp(0.28 + (0.64 * t) / 60, 0, 0.95);
  return 1 - Math.exp(-Math.max(0, t) / 85);
}

// Gravity in units/s²: on every screen a throw that rises 60% of the play height takes 1.05 s to its peak, so the game
// has the same rhythm on a tall phone and a wide monitor. It pulls up to a third harder late in a run.
export function baseGravity(H, top) {
  const P = Math.max(240, H - top);
  return (2 * 0.6 * P) / (1.05 * 1.05);
}
export const gravityAt = (H, top, diff) => baseGravity(H, top) * (1 + 0.32 * clamp(diff, 0, 1));

// where peaks may be: under the top bar (a sticker's radius below it) and in the upper part of the screen
export function peakBand(f, r) {
  const P = Math.max(240, f.H - f.top);
  const lo = f.top + r * 1.08;
  const hi = Math.max(lo + 24, Math.min(f.top + 0.58 * P, f.H - r * 2.2));
  return [lo, hi];
}
export const xBand = (f, r) => [r * 1.25, f.W - r * 1.25];

// the clearance a hazard keeps from a scam of its volley, as a multiple of their radii, over its first `span` seconds
export const CLEAR = Object.freeze({ rug: { k: 1.35, span: 0.75 }, heart: { k: 1.1, span: 0.5 } });

function makeThrow(kind, x0, y0, xp, yp, g, at, spin) {
  const t = throwTo(x0, y0, xp, yp, g);
  return { kind, x0, y0, vx: t.vx, vy: t.vy, g, at, spin, rot: 0 };
}

// Is a volley fair? Every rug (and heart) keeps its clearance from every scam thrown with it.
export function isFair(launches) {
  for (const a of launches) {
    const ra = roleOf(a.kind);
    if (ra !== 'rug' && ra !== 'heart') continue;
    const c = CLEAR[ra];
    for (const b of launches) {
      const rb = roleOf(b.kind);
      if (b === a || (rb !== 'scam' && rb !== 'power')) continue;
      const need = (KINDS[a.kind].r + KINDS[b.kind].r) * c.k;
      const from = Math.max(a.at, b.at);
      if (closestApproach(a, b, from, from + c.span) < need) return false;
    }
  }
  return true;
}

function pickScam(r, prev) {
  let k = r.pick(SCAMS);
  if (k === prev) k = r.pick(SCAMS);
  return k;
}

export function pickPower(r, last) {
  const options = POWERS.filter((p) => p !== last);
  return r.pick(options);
}

// how many stickers fit side by side in one row across the screen
export const across = (W) => Math.max(2, Math.floor((W * 0.78) / (2.2 * 54)));

function patternFor(r, n, W) {
  if (n === 1) return 'single';
  const row = n <= across(W);
  const opts = [
    ['spread', row ? 3 : 0],
    ['cross', n === 2 || n === 4 ? 2.5 : 0],
    ['stagger', 2.6],
    ['fan', n >= 3 ? 2 : 0],
    ['column', n <= 4 ? 1.6 : 0],
  ].filter((o) => o[1] > 0);
  return r.weighted(opts, (o) => o[1])[0];
}

// the throws' starts, peaks and delays for a pattern (y0: just under the bottom edge)
function slots(pattern, n, r, f, diff) {
  const { W, H } = f;
  const R = 54;
  const [lo, hi] = peakBand(f, R);
  const [xl, xh] = xBand(f, R);
  const y0 = H + R;
  const out = [];
  const add = (x0, xp, yp, at) => out.push({ x0: clamp(x0, R * 0.6, W - R * 0.6), xp: clamp(xp, xl, xh), yp: clamp(yp, lo, hi), at, y0 });
  switch (pattern) {
    case 'single': {
      const x0 = r.range(0.22 * W, 0.78 * W);
      add(x0, x0 + r.range(-0.2, 0.2) * W, r.range(lo, hi), 0);
      break;
    }
    case 'spread': {
      const drift = r.range(-0.08, 0.08) * W;
      const base = r.range(lo, lerp(lo, hi, 0.65));
      const span = Math.min(0.76, (n * 2.3 * R) / W + 0.12);
      for (let i = 0; i < n; i++) {
        const x0 = W * (0.5 - span / 2 + (span * (i + 0.5)) / n) + r.range(-0.02, 0.02) * W;
        add(x0, x0 + drift, base + r.range(-0.05, 0.05) * (H - f.top), r.range(0, 0.06));
      }
      break;
    }
    case 'fan': {
      const c = r.range(0.4, 0.6) * W;
      const peaks = [];
      for (let i = 0; i < n; i++) peaks.push(W * (0.16 + (0.68 * (i + 0.5)) / n));
      r.shuffle(peaks);
      for (let i = 0; i < n; i++) add(c + r.range(-0.04, 0.04) * W, peaks[i], r.range(lo, hi), i * 0.035);
      break;
    }
    case 'cross': {
      for (let i = 0; i < n; i++) {
        const left = i % 2 === 0;
        const x0 = left ? r.range(0.08, 0.24) * W : r.range(0.76, 0.92) * W;
        const xp = left ? r.range(0.56, 0.76) * W : r.range(0.24, 0.44) * W;
        add(x0, xp, r.range(lo, hi), Math.floor(i / 2) * 0.32 + (left ? 0 : r.range(0, 0.12)));
      }
      break;
    }
    case 'stagger': {
      const ltr = r.chance(0.5);
      const step = lerp(0.24, 0.14, diff);
      const base = r.range(lo, lerp(lo, hi, 0.7));
      for (let i = 0; i < n; i++) {
        const k = ltr ? i : n - 1 - i;
        const x0 = W * (0.14 + (0.72 * (k + 0.5)) / n);
        add(x0, x0 + r.range(-0.05, 0.05) * W, base + r.range(-0.06, 0.06) * (H - f.top), i * step);
      }
      break;
    }
    case 'column': {
      const xp = r.range(0.3, 0.7) * W;
      const gap = Math.min((hi - lo) / Math.max(1, n - 1), 2.6 * R);
      for (let i = 0; i < n; i++) add(xp + r.range(-0.16, 0.16) * W, xp + r.range(-0.025, 0.025) * W, lo + gap * i + r.range(0, 8), i * 0.05);
      break;
    }
    default: break;
  }
  return out;
}

// a rug or a heart, thrown where it keeps clear of the volley's scams; null when there's no fair place for it
function placeHazard(kind, r, f, diff, launches, g) {
  const R = KINDS[kind].r;
  const [lo, hi] = peakBand(f, R);
  const [xl, xh] = xBand(f, R);
  const maxAt = launches.reduce((m, l) => Math.max(m, l.at), 0);
  const spin = roleOf(kind) === 'heart' ? r.range(-0.7, 0.7) : r.range(-1.8, 1.8);
  for (let k = 0; k < 16; k++) {
    const x0 = r.range(0.1, 0.9) * f.W;
    const xp = clamp(x0 + r.range(-0.24, 0.24) * f.W, xl, xh);
    const l = makeThrow(kind, x0, f.H + R, xp, r.range(lo, hi), g, r.range(0, maxAt + 0.18), spin);
    if (isFair([...launches, l])) return l;
  }
  return null;
}

function rushVolley(r, c, diff, g) {
  const f = c;
  const n = c.mode === 'blitz' ? r.int(10, 13) : r.int(8, 11);
  const step = lerp(0.16, 0.1, diff);
  const R = 54;
  const [lo, hi] = peakBand(f, R);
  const launches = [];
  let prev = null;
  const goldAt = r.chance(0.2) ? r.int(2, n - 1) : -1;
  for (let i = 0; i < n; i++) {
    const right = i % 2 === 1;
    const x0 = (right ? r.range(0.62, 0.9) : r.range(0.1, 0.38)) * f.W;
    const kind = i === goldAt ? 'golden' : (prev = pickScam(r, prev));
    launches.push(makeThrow(kind, x0, f.H + R, r.range(0.18, 0.82) * f.W, r.range(lo, hi), g, i * step, r.range(-2.4, 2.4)));
  }
  return { launches, gap: 1.15, tag: 'rush', has: { golden: goldAt >= 0, power: null, rush: true } };
}

// One volley. `c`: { W, H, top, t (how far into the run it feels, s), mode, n (volleys so far), due: { golden, power
// (a power's name or null), rush }, opening (a demo's first volley: a long row to slice in one go) }
// → { launches: [{ kind, x0, y0, vx, vy, g, at, spin, rot }], gap (s after its last throw), tag, has }
export function planVolley(r, c) {
  const diff = difficulty(c.mode === 'blitz' ? 'blitz' : 'classic', c.t);
  const g = gravityAt(c.H, c.top, diff);
  const f = { W: c.W, H: c.H, top: c.top };
  const due = c.due || {};
  if (due.rush) return rushVolley(r, c, diff, g);

  let n;
  if (c.opening) n = Math.min(5, across(c.W));
  else if (c.mode === 'classic' && c.n < 4) n = [1, 1, 2, 2][c.n];
  else if (c.mode === 'blitz') n = r.int(Math.round(lerp(2, 3.4, diff)), Math.round(lerp(3.4, 6.4, diff)));
  else n = r.int(Math.max(1, Math.round(lerp(1, 3, diff))), Math.round(lerp(2.4, 6, diff)));
  n = clamp(n, 1, 6);
  const pattern = c.opening ? 'spread' : patternFor(r, n, c.W);
  const s = slots(pattern, n, r, f, diff);

  const kinds = [];
  let prev = null;
  for (let i = 0; i < s.length; i++) kinds.push(prev = pickScam(r, prev));
  const has = { golden: false, power: null, rush: false };
  const free = s.map((_, i) => i);
  r.shuffle(free);
  if (due.golden && free.length) { kinds[free.pop()] = 'golden'; has.golden = true; }
  if (due.power && free.length) { kinds[free.pop()] = due.power; has.power = due.power; }

  const launches = s.map((p, i) => makeThrow(kinds[i], p.x0, p.y0, p.xp, p.yp, g, p.at, r.range(-2.2, 2.2)));

  // hazards: rugs from 10 s in (5 in Blitz), hearts from 20 s (8 in Blitz); more often later on
  const rugFrom = c.mode === 'blitz' ? 5 : 10, heartFrom = c.mode === 'blitz' ? 8 : 20;
  if (!c.opening && c.t >= rugFrom && r.chance(lerp(0.24, 0.55, diff))) {
    const count = diff > 0.55 && r.chance(0.3) ? 2 : 1;
    for (let i = 0; i < count; i++) { const h = placeHazard('rug', r, f, diff, launches, g); if (h) launches.push(h); }
  }
  if (!c.opening && c.t >= heartFrom && r.chance(lerp(0.2, 0.36, diff))) {
    const count = diff > 0.7 && r.chance(0.25) ? 2 : 1;
    for (let i = 0; i < count; i++) { const h = placeHazard('heart', r, f, diff, launches, g); if (h) launches.push(h); }
  }
  const gap = (lerp(1.55, 0.72, diff) * r.range(0.9, 1.12) + 0.05 * n) * (c.mode === 'blitz' ? 0.85 : 1);
  return { launches, gap, tag: pattern, has };
}

// Frenzy: scams thrown in from both sides, one at a time, fast (no hearts, no rugs, nothing lost if they fall)
export function frenzyLaunch(r, c) {
  const diff = difficulty(c.mode === 'blitz' ? 'blitz' : 'classic', c.t);
  const g = gravityAt(c.H, c.top, diff);
  const kind = r.pick(SCAMS);
  const R = KINDS[kind].r;
  const left = r.chance(0.5);
  const P = Math.max(240, c.H - c.top);
  const y0 = c.top + r.range(0.5, 0.82) * P;
  const [lo] = peakBand(c, R);
  const yp = r.range(lo, Math.max(lo + 10, Math.min(y0 - 0.18 * P, c.top + 0.42 * P)));
  const xp = (left ? r.range(0.3, 0.66) : r.range(0.34, 0.7)) * c.W;
  const l = makeThrow(kind, left ? -R * 0.9 : c.W + R * 0.9, y0, xp, yp, g, 0, r.range(-3, 3));
  l.bonus = true;
  return l;
}
