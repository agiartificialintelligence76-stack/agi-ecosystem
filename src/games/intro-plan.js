// AGI GAMES intro, its plan (2026-10-20, the owner: "can you add a short loading screen for every game like an intro "AGI
// GAMES" its gonna an 8bit version of AGI and the loading is like her smashing up the word AGI GAMES and its gonna go
// bigger"): what's on the screen at any moment, as numbers. The word AGI GAMES in 8-bit letters drops in, AGI-1 in 8-bit
// (her frames: ./intro-sprite.js) falls onto it and hops across it, letter by letter, spins up, dives and smashes it; the
// word grows with a boing while she floats above it; then a pixel wipe shows the game underneath. A later load in the
// same tab gets a short one (the letters pop in, she spins down and smashes it).
// Pure, no DOM: ./intro-run.js draws it, tests/intro.test.js reads it in Node. Sizes are the canvas's own device pixels,
// and every edge is rounded to a whole pixel, so it stays crisp at any size. The letters are bold arcade-style ones (7 × 7,
// their uprights two pixels wide), banded light to deep honey with a pink shadow: thin 5 × 7 letters under a shadow as
// wide as their strokes read as a jumble (looked at in its first contact sheets).
import { SIZE, FEET } from './intro-sprite.js';

export const COLORS = {
  ink: '#170a36',       // the night behind it all (and her outline)
  honey: '#ffc933',     // the letters (their middle band)
  pink: '#ff5c93',      // their shadow, one letter pixel down-right
  white: '#ffffff',     // a letter she just landed on, for a moment
  star: '#e4d9ff',      // lavender stars
};
// the letters' rows, top to bottom: light honey, honey, deep honey (an 8-bit logo's bands)
export const BANDS = ['#ffe680', '#ffe680', '#ffc933', '#ffc933', '#ffc933', '#ffa62b', '#ffa62b'];
export const BITS = ['#ffc933', '#ff5c93', '#e4d9ff', '#ffffff'];   // what flies off the letters

// 7 × 7 letters, "#" lit: bold, their uprights two pixels wide (the I sits half a pixel right of its cell's middle: an
// upright two pixels wide can't be centred in 7)
export const GLYPHS = {
  A: ['..###..', '.##.##.', '##...##', '##...##', '#######', '##...##', '##...##'],
  G: ['.#####.', '##...##', '##.....', '##..###', '##...##', '##...##', '.#####.'],
  I: ['.######', '...##..', '...##..', '...##..', '...##..', '...##..', '.######'],
  M: ['##...##', '###.###', '#######', '##.#.##', '##...##', '##...##', '##...##'],
  E: ['#######', '##.....', '##.....', '######.', '##.....', '##.....', '#######'],
  S: ['.######', '##.....', '##.....', '.#####.', '.....##', '.....##', '######.'],
  ' ': ['.......', '.......', '.......', '.......', '.......', '.......', '.......'],
};
export const WORD = 'AGI GAMES';
export const GW = 7;                               // a letter's width in letter pixels
export const ADV = GW + 1;                         // its 7 columns and a gap
export const COLS = WORD.length * ADV - 1;        // 71: the word's width in letter pixels
export const ROWS = 7;
export const MID = 4;                              // the G of GAMES: the word's middle, where she smashes it
export const LANDS = [0, 1, 2, 4, 5, 6, 7, 8];    // the letters she lands on, in order (the space is jumped over)
export const SEED = 0xa61;                         // the same intro every time
export const SKIP_WIPE = 0.25;                     // a tap or a key: the wipe, at once and quicker (seconds)
export const FLASH = 0.4;                          // the smash's white flash at its brightest (its alpha)

// When everything happens, in seconds. The full one is about 2.5 s; the short one (a later load in the same tab) 1.2 s.
export const FULL = {
  name: 'full',
  letters: { stagger: 0.035, dur: 0.22, how: 'drop' },   // each falls from above the screen and bounces a little
  enter: { from: 0.30, to: 0.48 },                      // she falls onto the first letter
  lands: [0.48, 0.58, 0.68, 0.83, 0.93, 1.03, 1.13, 1.23],   // her landings on LANDS (over the space: a longer hop)
  spin: { from: 1.23, to: 1.51 },                        // a spin jump up, above the middle
  dive: { from: 1.51, to: 1.62 },
  impact: 1.62,                                          // she smashes it
  grow: { from: 1.62, to: 2.10 },                        // the word goes bigger, with a boing
  wipe: { from: 2.18, to: 2.52 },
  end: 2.52,
};
export const SHORT = {
  name: 'short',
  letters: { stagger: 0.012, dur: 0.09, how: 'pop' },   // each pops in from nothing
  enter: null,
  lands: [],
  spin: { from: 0.12, to: 0.36 },                        // she falls in spinning, straight above the middle
  dive: { from: 0.36, to: 0.46 },
  impact: 0.46,
  grow: { from: 0.46, to: 0.86 },
  wipe: { from: 0.90, to: 1.20 },
  end: 1.20,
};
const CROUCH = 0.07;      // after the smash she crouches this long, then bounces up and floats
const FLOAT_IN = 0.28;    // her rise to where she floats
const BOB = 0.9;          // her bob's period, floating
const DEBRIS_LIFE = 0.7;

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const prog = (t, a, b) => clamp01((t - a) / (b - a));
export const ease = {
  outBack: (u, s = 1.70158) => 1 + (s + 1) * (u - 1) ** 3 + s * (u - 1) ** 2,
  outCubic: (u) => 1 - (1 - u) ** 3,
  outQuad: (u) => 1 - (1 - u) * (1 - u),
  inOutSine: (u) => (1 - Math.cos(Math.PI * u)) / 2,
  // a spring: past 1 by about a quarter, back, a little past again, settled (exactly 1 at the end)
  boing: (u) => (u >= 1 ? 1 : 1 - Math.exp(-6.5 * u) * Math.cos(4.5 * Math.PI * u)),
};

// A small, seeded random generator (mulberry32): the same numbers every time for a seed
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Sizes for a canvas of W × H device pixels: p, a letter pixel (the word is 71 of them wide, 72 with its shadow), at the
// start and at the end (pEnd: the word gone bigger); k, one of her pixels, at the start and at the end. The word's middle
// is a little under the screen's (cy), so she has room above it.
export function layout(W, H) {
  W = Math.max(1, Math.round(W));
  H = Math.max(1, Math.round(H));
  const wide = COLS + 1, tall = ROWS + 1;
  const p = Math.max(2, Math.floor(Math.min((0.7 * W) / wide, (0.11 * H) / tall)));
  const pEnd = Math.max(p, Math.min(Math.floor((0.9 * W) / wide), Math.round(p * 1.7), Math.floor((0.2 * H) / tall)));
  const k = Math.max(1, Math.round(p * 0.25));
  const kEnd = Math.max(k, Math.round(pEnd * 0.25));
  return { W, H, p, pEnd, k, kEnd, cx: Math.round(W / 2), cy: Math.round(H * 0.6), margin: Math.round(H * 0.04) };
}

// The word at a letter pixel of q: its face's left edge, its letters' bottom (their baseline), each letter's middle. The
// word and its shadow (one letter pixel down-right) together are centred, 72 letter pixels.
export function wordAt(L, q) {
  const left = L.cx - ((COLS + 1) * q) / 2;
  const base = L.cy + (ROWS * q) / 2;
  return { left, base, top: base - ROWS * q, mid: (i) => left + (i * ADV + GW / 2) * q };
}

// A letter's lit pixels as rectangles [x, y, w, h, row], each row's runs merged: its bottom middle at (bx, by), a letter
// pixel of q, squashed or stretched by sx, sy. Edges are rounded, so neighbours share them (never a gap, never an overlap).
export function glyphRects(ch, bx, by, q, sx = 1, sy = 1) {
  const rows = GLYPHS[ch] || GLYPHS[' '];
  const out = [];
  const w = q * sx, h = q * sy;
  for (let r = 0; r < ROWS; r++) {
    const row = rows[r];
    const y0 = Math.round(by - (ROWS - r) * h), y1 = Math.round(by - (ROWS - 1 - r) * h);
    if (y1 <= y0) continue;
    for (let c = 0; c < GW;) {
      if (row[c] !== '#') { c++; continue; }
      let e = c;
      while (e < GW && row[e] === '#') e++;
      const x0 = Math.round(bx + (c - GW / 2) * w), x1 = Math.round(bx + (e - GW / 2) * w);
      if (x1 > x0) out.push([x0, y0, x1 - x0, y1 - y0, r]);
      c = e;
    }
  }
  return out;
}

// a squash: at once, then back, a little past (a stretch: negative), settled after 0.17 s
function bump(dt, amp) {
  if (dt < 0) return 0;
  if (dt < 0.03) return (amp * dt) / 0.03;
  const u = (dt - 0.03) / 0.14;
  return u >= 1 ? 0 : amp * (1 - ease.outBack(u, 2.4));
}
// a letter dropping in from above the screen: falling (gravity), then a small hop where it lands
function dropY(u, D, q) {
  if (u >= 1) return 0;
  if (u < 0.72) { const a = u / 0.72; return -D * (1 - a * a); }
  return -Math.sin((Math.PI * (u - 0.72)) / 0.28) * 0.8 * q;
}
const waveAt = (tl, i) => tl.impact + (Math.abs(i * ADV + GW / 2 - COLS / 2) / (COLS / 2)) * 0.08;

// The letter pixel now (the word grows after the smash) and her pixel now (whole device pixels: her pixels stay square)
export function qAt(P, t) {
  const g = prog(t, P.tl.grow.from, P.tl.grow.to);
  if (g <= 0) return P.L.p;
  if (g >= 1) return P.L.pEnd;
  const d = P.L.pEnd - P.L.p, b = ease.boing(g);
  // its overshoot made smaller when the screen has no room for all of it (so it never flattens against the cap)
  const room = d > 0 ? clamp01((P.qCap - P.L.pEnd) / (d * (BOING_MAX - 1))) : 0;
  return Math.min(P.qCap, P.L.p + d * (b > 1 ? 1 + (b - 1) * room : b));
}
const BOING_MAX = (() => { let m = 1; for (let i = 0; i <= 2000; i++) m = Math.max(m, ease.boing(i / 2000)); return m; })();
export function kAt(P, t) {
  const g = prog(t, P.tl.grow.from, P.tl.grow.to);
  if (g >= 1) return P.L.kEnd;
  return Math.max(P.L.k, Math.round(P.L.k + (P.L.kEnd - P.L.k) * ease.outBack(g)));
}

// One letter at time t (null: not in yet, or the space): where it is, its squash, and whether she just hit it
export function letterAt(P, i, t) {
  const tl = P.tl, ch = WORD[i];
  if (ch === ' ') return null;
  const a = tl.letters.stagger * i;
  const u = prog(t, a, a + tl.letters.dur);
  if (u <= 0) return null;
  const q = qAt(P, t);
  const w = wordAt(P.L, q);
  let dy = 0, s = 1, b = 0, hit = 0, pop = 0;
  if (tl.letters.how === 'drop') {
    dy = dropY(u, P.L.cy + 4 * q + 2, q);
    b += bump(t - (a + 0.72 * tl.letters.dur), 0.45);           // it lands
  } else s = ease.outBack(u, 2.2);
  const j = LANDS.indexOf(i);
  if (j >= 0 && j < tl.lands.length && t >= tl.lands[j]) {    // she landed on it
    const tL = tl.lands[j];
    b += bump(t - tL, 1);
    pop = ease.outBack(prog(t, tL, tL + 0.15));
    hit = Math.max(hit, 1 - prog(t, tL, tL + 0.08));
  }
  const tw = waveAt(tl, i);                                    // the smash's wave
  if (t >= tw) { b += bump(t - tw, i === MID ? 1.3 : 0.85); hit = Math.max(hit, 1 - prog(t, tw, tw + 0.1)); }
  const grown = 1 + 0.1 * pop * (1 - prog(t, tl.grow.from, tl.grow.to));   // a letter she landed on is a little bigger
  const sx = (1 + 0.12 * b) * s * grown, sy = (1 - 0.22 * b) * s * grown;
  const bx = w.mid(i), by = w.base + dy;
  return { i, ch, q, bx, by, sx, sy, top: by - ROWS * q * sy, hit };
}

// AGI-1 at time t (null: not here yet): her frame (stand, crouch, air, dive; back, the far half of her spin), her feet's
// middle (x, y), her pixel k, and flip (her width's sign and size: -1 to 1, for a spin)
export function herAt(P, t, still = false) {
  const tl = P.tl, L = P.L;
  const k = kAt(P, t);
  const on = (i) => letterAt(P, i, t);
  const keepIn = (y, kk = k) => Math.max(y, L.margin + FEET.y * kk);    // the top of her head stays on the screen
  const tf = tl.impact + CROUCH;
  // floating above the word's middle, after the smash
  if (t >= tf) {
    const m = on(MID), q = qAt(P, t);
    const up = ease.outBack(prog(t, tf, tf + FLOAT_IN), 2);
    const bob = still ? 0 : Math.sin(((t - tf) / BOB) * 2 * Math.PI) * 0.22 * prog(t, tf + 0.2, tf + 0.5);
    return { frame: 'air', x: m.bx, y: keepIn(m.top - q * (1.4 * up + bob)), k, flip: 1 };
  }
  // the smash: crouched on the middle letter
  if (t >= tl.impact) { const m = on(MID); return { frame: 'crouch', x: m.bx, y: m.top, k, flip: 1 }; }
  // the dive, straight down onto the middle (from the top of her spin jump: apex)
  if (t >= tl.dive.from) {
    const mid0 = on(MID), apex = keepIn(mid0.top - 6.5 * L.p);
    const v = prog(t, tl.dive.from, tl.dive.to);
    return { frame: 'dive', x: mid0.bx, y: apex + (mid0.top - apex) * v * v, k, flip: 1 };
  }
  // the spin jump (from the last letter she landed on; or, the short one, from above the screen)
  if (t >= tl.spin.from) {
    const mid0 = on(MID), apex = keepIn(mid0.top - 6.5 * L.p);
    const u = prog(t, tl.spin.from, tl.spin.to);
    const from = tl.lands.length ? on(LANDS[tl.lands.length - 1]) : null;
    if (from && u < 0.15) return { frame: 'crouch', x: from.bx, y: from.top, k, flip: 1 };
    const v = from ? (u - 0.15) / 0.85 : u;
    const x0 = from ? from.bx : mid0.bx, y0 = from ? from.top : -2 * k;
    const flip = Math.cos(2 * Math.PI * v);                    // her width as she turns round once
    return {
      // turned away (the far half of her turn): her back, mirrored (her front's "AGI" read backwards there)
      frame: flip < 0 ? 'back' : 'air',
      x: x0 + (mid0.bx - x0) * ease.inOutSine(v), y: y0 + (apex - y0) * ease.outCubic(v), k, flip,
    };
  }
  // hopping across the word
  if (tl.lands.length && t >= tl.lands[0]) {
    let j = 0;
    while (j + 1 < tl.lands.length && t >= tl.lands[j + 1]) j++;
    const a = on(LANDS[j]), b = on(LANDS[j + 1]);
    const u = prog(t, tl.lands[j], tl.lands[j + 1]);
    if (u < 0.25) return { frame: 'crouch', x: a.bx, y: a.top, k, flip: 1 };
    const v = (u - 0.25) / 0.75;
    const h = (LANDS[j + 1] - LANDS[j] > 1 ? 4 : 3) * L.p;
    return { frame: 'air', x: a.bx + (b.bx - a.bx) * v, y: a.top + (b.top - a.top) * v - h * 4 * v * (1 - v), k, flip: 1 };
  }
  // falling in, onto the first letter
  if (tl.enter && t >= tl.enter.from) {
    const u = prog(t, tl.enter.from, tl.enter.to), a = on(LANDS[0]);
    const y0 = -2 * k;
    return { frame: 'dive', x: a.bx, y: y0 + (a.top - y0) * u * u, k, flip: 1 };
  }
  return null;
}

// Everything that doesn't change while it plays: the sizes, the stars, the bits that fly off, the wipe's blocks
export function makePlan(W, H, tl = FULL, seed = SEED) {
  const L = layout(W, H);
  // qCap: the most a letter pixel ever is, even for a moment: the end letters stay inside the screen. Their middles are
  // 32.5 letter pixels from the word's, and each is up to about 1.115 times as wide while the word grows (the smash's
  // wave, its landing), with half of its 7 columns and its shadow's 1: 32.5 + 4.5 × 1.115 ≈ 37.6
  const P = { W: L.W, H: L.H, L, tl, qCap: Math.max(L.p, (L.W / 2 - 2) / 37.6), stars: [], bits: [], blocks: [], B: 0 };
  const r = rng(seed);
  // 36 lavender stars (a quarter of them bigger), each twinkling at its own pace
  const z = Math.max(1, Math.round(L.p / 5));
  for (let n = 0; n < 36; n++) {
    P.stars.push({ x: Math.floor(r() * L.W), y: Math.floor(r() * L.H), z: r() < 0.25 ? 2 * z : z, f: 0.5 + r() * 1.3, ph: r() });
  }
  // bits that fly off: a puff where she lands, and 28 when she smashes it (3 off each letter as its wave passes, the
  // rest off the middle)
  const bit = (t0, x0, y0, q, speed, spread, life, g, sizeMin, sizeMax) => {
    const ang = -Math.PI / 2 + (r() * 2 - 1) * spread;
    const v = q * (speed[0] + r() * (speed[1] - speed[0]));
    P.bits.push({
      t0, x0, y0, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, g: g * q, life,
      z: Math.max(1, Math.round(q * (sizeMin + r() * (sizeMax - sizeMin)))), c: BITS[Math.floor(r() * BITS.length)],
    });
  };
  tl.lands.forEach((tL, j) => {
    const a = letterAt(P, LANDS[j], tL);
    for (let n = 0; n < 3; n++) bit(tL, a.bx + (r() * 2 - 1) * 2 * L.p, a.top, L.p, [4, 9], 1.1, 0.25, 50, 0.3, 0.45);
  });
  for (let i = 0; i < WORD.length; i++) {
    if (WORD[i] === ' ') continue;
    const tw = waveAt(tl, i), a = letterAt(P, i, tw);
    for (let n = 0; n < (i === MID ? 7 : 3); n++) bit(tw, a.bx + (r() * 2 - 1) * 2.5 * a.q, a.top, a.q, [10, 24], 1.25, DEBRIS_LIFE, 60, 0.4, 0.85);
  }
  // the wipe: blocks of B × B, each clearing after a delay (mostly by how far it is from the smash, a little at random)
  const B = Math.max(8, Math.round(Math.min(L.W, L.H) / 12));
  const far = Math.hypot(Math.max(L.cx, L.W - L.cx), Math.max(L.cy, L.H - L.cy));
  for (let y = 0; y < L.H; y += B) {
    for (let x = 0; x < L.W; x += B) {
      const w = Math.min(B, L.W - x), h = Math.min(B, L.H - y);
      const d = 0.65 * (Math.hypot(x + w / 2 - L.cx, y + h / 2 - L.cy) / far) + 0.35 * r();
      P.blocks.push({ x, y, w, h, d: clamp01(d) });
    }
  }
  P.B = B;
  return P;
}

// The frame at time t, ready to draw (./intro-run.js): the stars [x, y, size, alpha], a shake [x, y] for everything but
// the stars, the letters (their shadows' and faces' rectangles [x, y, w, h, row], their colour: white for a moment, else
// null for BANDS), the bits [x, y, size, colour, alpha], her,
// a white flash's alpha, and the wipe's holes [x, y, w, h] (cleared: the game shows through). skipAt: when a tap or a key
// started the quick wipe. still: "reduce motion"'s card (no twinkle, bob, bits, shake or flash).
export function scene(P, t, { skipAt = null, still = false } = {}) {
  const tl = P.tl, L = P.L;
  let w0 = tl.wipe.from, wd = tl.wipe.to - tl.wipe.from;
  if (skipAt != null && skipAt < w0) { w0 = skipAt; wd = SKIP_WIPE; }
  const out = { t, done: t >= w0 + wd, stars: [], shake: [0, 0], letters: [], bits: [], her: null, flash: 0, holes: [] };
  for (const s of P.stars) {
    const tw = still ? 0.7 : 0.5 + 0.5 * Math.sin(2 * Math.PI * (t * s.f + s.ph));
    out.stars.push([s.x, s.y, s.z, still ? 0.6 : [0.25, 0.6, 1][Math.min(2, Math.floor(tw * 3))]]);
  }
  if (!still && t >= tl.impact) {
    const u = prog(t, tl.impact, tl.impact + 0.3);
    const amp = 0.5 * L.p * (1 - u) ** 2;
    out.shake = [Math.round(amp * Math.sin((t - tl.impact) * 97)), Math.round(amp * Math.cos((t - tl.impact) * 73))];
    // a white flash, at most FLASH: one, never a strobe (at 0.55 the whole screen went grey in its first contact sheets)
    const f = prog(t, tl.impact, tl.impact + 0.16);
    out.flash = f < 1 ? FLASH * (1 - f) ** 2 : 0;
  }
  for (let i = 0; i < WORD.length; i++) {
    const a = letterAt(P, i, t);
    if (!a) continue;
    out.letters.push({
      i, top: a.top, x: a.bx, color: a.hit > 0.5 ? COLORS.white : null,   // null: its BANDS, row by row
      shadow: glyphRects(a.ch, a.bx + a.q * a.sx, a.by + a.q * a.sy, a.q, a.sx, a.sy),
      face: glyphRects(a.ch, a.bx, a.by, a.q, a.sx, a.sy),
    });
  }
  if (!still) {
    for (const b of P.bits) {
      const dt = t - b.t0;
      if (dt < 0 || dt > b.life) continue;
      const alpha = dt > 0.7 * b.life ? 0.5 : 1;
      out.bits.push([Math.round(b.x0 + b.vx * dt - b.z / 2), Math.round(b.y0 + b.vy * dt + 0.5 * b.g * dt * dt - b.z / 2), b.z, b.c, alpha]);
    }
  }
  out.her = herAt(P, t, still);
  if (out.her) out.her = { ...out.her, x: Math.round(out.her.x), y: Math.round(out.her.y) };
  if (t >= w0) {
    const u = (t - w0) / wd;
    for (const b of P.blocks) {
      const pr = clamp01((u - 0.6 * b.d) / 0.4);
      if (pr <= 0) continue;
      if (pr >= 1) { out.holes.push([b.x, b.y, b.w, b.h]); continue; }
      const s = Math.round(P.B * ease.outQuad(pr));
      if (s <= 0) continue;
      const x0 = Math.max(b.x, Math.round(b.x + b.w / 2 - s / 2)), y0 = Math.max(b.y, Math.round(b.y + b.h / 2 - s / 2));
      const x1 = Math.min(b.x + b.w, x0 + s), y1 = Math.min(b.y + b.h, y0 + s);
      if (x1 > x0 && y1 > y0) out.holes.push([x0, y0, x1 - x0, y1 - y0]);
    }
  }
  return out;
}

// "Reduce motion": one still card, the word gone bigger and her floating above it
export const stillScene = (P) => scene(P, P.tl.grow.to + 0.03, { still: true });

// her sprite's box on the screen for a frame of herAt() (the whole sprite, at her pixel size): left, top, right, bottom
export function herBox(h) {
  const w = Math.max(1, Math.round(SIZE.w * h.k * Math.abs(h.flip)));
  const left = Math.round(h.x - w / 2), top = Math.round(h.y - FEET.y * h.k);
  return { left, top, right: left + w, bottom: top + SIZE.h * h.k };
}
