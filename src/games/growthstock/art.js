// GROWTH STOCK: everything on the farm, drawn in code with the arcade's ink outline: each stock at every stage (a
// little candle chart growing out of the soil), what it gives (its shares: coins with our own little pictures, never a
// company's logo), the soil, the bear and the bull. Sprites are drawn once per size and kept.
import { CROPS } from './crops.js';

export const INK = '#1d1238';
const TAU = Math.PI * 2;
const cache = new Map();

export function mix(a, b, t) {
  const p = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [r1, g1, b1] = p(a), [r2, g2, b2] = p(b);
  const c = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}
export const rgba = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;

function ink(c, s, fill) { if (fill) { c.fillStyle = fill; c.fill(); } c.lineWidth = Math.max(1.2, s * 0.034); c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); }
function shine(c, x, y, rx, ry, a = 0.55, rot = -0.5) { c.save(); c.fillStyle = `rgba(255,255,255,${a})`; c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fill(); c.restore(); }
// a leaf from (x, y) pointing at angle a, length l, width w
function leaf(c, s, x, y, a, l, w, color, vein = true) {
  c.save(); c.translate(x, y); c.rotate(a);
  c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(l * 0.45, -w, l, 0); c.quadraticCurveTo(l * 0.45, w, 0, 0); c.closePath();
  ink(c, s, color);
  if (vein) { c.beginPath(); c.moveTo(l * 0.1, 0); c.lineTo(l * 0.82, 0); c.lineWidth = Math.max(0.8, s * 0.016); c.strokeStyle = rgba(INK, 0.45); c.stroke(); }
  c.restore();
}
function stem(c, s, x0, y0, x1, y1, color, w = 0.05) {
  c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2 + s * 0.03, (y0 + y1) / 2, x1, y1);
  c.lineWidth = s * w + Math.max(1.2, s * 0.034) * 2; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke();
  c.lineWidth = s * w; c.strokeStyle = color; c.stroke();
}

// ---------- the stocks ----------
// A stock grows as a little candle chart: a vine rising out of the soil with green candles strung along it, each higher
// than the last, and its shares blooming at the tip as coins (one, two or three: what it gives). A ripe one left too
// long wilts: the vine flops, the candles turn red and the coins go grey. Drawn around (0, 0), the middle of the
// plot's soil, in a cell `s` pixels wide; plants grow upward (negative y).
// `stage`: 0 seed · 1 sprout · 2 growing · 3 ripe · 4 wilted
const UP = '#2fd6a6', DOWN = '#ff4d8d', VINE = '#4fbf5f', DEAD = '#9a8a5a';
// each stock's chart: its candles (body heights in cells; a negative one is a red candle in the middle of the climb),
// how tall the climb is, how fat the candles are, how long their wicks are
const SHAPE = {
  gme: { c: [0.12, 0.15, 0.18], tall: 0.84, w: 0.12, wick: 0.035 },
  ko: { c: [0.1, 0.11, 0.11, 0.12], tall: 0.7, w: 0.105, wick: 0.016 },
  aapl: { c: [0.12, 0.15, 0.13, 0.17], tall: 0.92, w: 0.11, wick: 0.03 },
  tsla: { c: [0.12, 0.2, -0.13, 0.24], tall: 0.98, w: 0.11, wick: 0.06 },
  amzn: { c: [0.13, 0.15, 0.15, 0.18], tall: 0.9, w: 0.11, wick: 0.028 },
  msft: { c: [0.14, 0.15, 0.17, 0.19], tall: 0.98, w: 0.11, wick: 0.024 },
  brka: { c: [0.18, 0.21, 0.25], tall: 0.96, w: 0.145, wick: 0.022 },
  nvda: { c: [0.12, -0.14, 0.2, 0.25], tall: 1.04, w: 0.11, wick: 0.065 },
  nflx: { c: [0.12, 0.14, 0.17], tall: 0.84, w: 0.12, wick: 0.032 },
};
const shapeOf = (id) => SHAPE[id] || SHAPE.aapl;
// one candle on its stalk: the stalk from the soil, the wick, then the body, centred on (x, y)
function candle(c, s, x, y, h, w, wick, color, { stalk = VINE, bend = 0 } = {}) {
  if (stalk) {
    c.beginPath(); c.moveTo(x - bend * 0.4, s * 0.05); c.quadraticCurveTo(x + bend, (y + h / 2 + s * 0.05) / 2, x, y + h / 2);
    c.lineCap = 'round'; c.lineWidth = s * 0.036 + Math.max(1.2, s * 0.03) * 2; c.strokeStyle = INK; c.stroke();
    c.lineWidth = s * 0.036; c.strokeStyle = stalk; c.stroke();
  }
  c.beginPath(); c.moveTo(x, y - h / 2 - wick); c.lineTo(x, y + h / 2 + wick * 0.6);
  c.lineCap = 'round'; c.lineWidth = Math.max(1.4, s * 0.026); c.strokeStyle = INK; c.stroke();
  c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, Math.min(w, h) * 0.24); ink(c, s, color);
  shine(c, x - w * 0.18, y - h * 0.28, w * 0.13, h * 0.2, 0.4, 0);
}

// what's drawn on each stock's coin: our own little pictures (never a company's logo), in a box from -1 to 1
const GLYPH = {
  pad(c, fg, bg) {          // a game controller
    c.fillStyle = fg;
    c.beginPath(); c.roundRect(-1, -0.45, 2, 0.88, 0.42); c.fill();
    c.beginPath(); c.arc(-0.6, 0.32, 0.38, 0, TAU); c.fill(); c.beginPath(); c.arc(0.6, 0.32, 0.38, 0, TAU); c.fill();
    c.fillStyle = bg; c.fillRect(-0.82, -0.07, 0.46, 0.15); c.fillRect(-0.665, -0.23, 0.15, 0.46);
    c.beginPath(); c.arc(0.42, -0.08, 0.11, 0, TAU); c.fill(); c.beginPath(); c.arc(0.66, 0.1, 0.11, 0, TAU); c.fill();
  },
  cup(c, fg, bg) {          // a cup with a straw
    c.fillStyle = fg; c.strokeStyle = fg; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0.08, -0.5); c.lineTo(0.32, -1.02); c.lineTo(0.62, -1.02); c.lineWidth = 0.17; c.stroke();
    c.beginPath(); c.moveTo(-0.56, -0.42); c.lineTo(0.56, -0.42); c.lineTo(0.4, 0.92); c.lineTo(-0.4, 0.92); c.closePath(); c.fill();
    c.beginPath(); c.roundRect(-0.7, -0.62, 1.4, 0.24, 0.1); c.fill();
    c.fillStyle = bg; c.beginPath(); c.moveTo(-0.5, 0.0); c.lineTo(0.5, 0.0); c.lineTo(0.48, 0.18); c.lineTo(-0.48, 0.18); c.closePath(); c.fill();
  },
  phone(c, fg, bg) {        // a phone
    c.fillStyle = fg; c.beginPath(); c.roundRect(-0.52, -0.95, 1.04, 1.9, 0.24); c.fill();
    c.fillStyle = bg; c.beginPath(); c.roundRect(-0.36, -0.72, 0.72, 1.24, 0.08); c.fill();
    c.beginPath(); c.arc(0, 0.73, 0.1, 0, TAU); c.fill();
  },
  bolt(c, fg) {             // a lightning bolt
    c.fillStyle = fg; c.beginPath();
    c.moveTo(0.22, -1.02); c.lineTo(-0.58, 0.14); c.lineTo(-0.06, 0.14); c.lineTo(-0.24, 1.02); c.lineTo(0.6, -0.2); c.lineTo(0.06, -0.2); c.closePath(); c.fill();
  },
  box(c, fg, bg) {          // a parcel
    c.fillStyle = fg; c.beginPath(); c.roundRect(-0.85, -0.6, 1.7, 1.4, 0.1); c.fill();
    c.fillStyle = bg; c.fillRect(-0.85, -0.18, 1.7, 0.1); c.fillRect(-0.13, -0.6, 0.26, 0.6);
  },
  cloud(c, fg) {            // a cloud
    c.fillStyle = fg;
    for (const [x, y, r] of [[-0.5, 0.18, 0.42], [0.02, -0.16, 0.58], [0.52, 0.18, 0.4]]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
    c.beginPath(); c.roundRect(-0.5, 0.1, 1.02, 0.5, 0.2); c.fill();
  },
  bank(c, fg) {             // a building with columns
    c.fillStyle = fg;
    c.beginPath(); c.moveTo(-1, -0.36); c.lineTo(0, -1); c.lineTo(1, -0.36); c.closePath(); c.fill();
    c.fillRect(-0.9, -0.4, 1.8, 0.18);
    for (const x of [-0.72, -0.27, 0.18, 0.63]) c.fillRect(x - 0.01, -0.14, 0.2, 0.72);
    c.fillRect(-1, 0.64, 2, 0.26);
  },
  chip(c, fg, bg) {         // a chip
    c.fillStyle = fg;
    for (const q of [-0.36, 0, 0.36]) { c.fillRect(q - 0.08, -0.98, 0.16, 0.36); c.fillRect(q - 0.08, 0.62, 0.16, 0.36); c.fillRect(-0.98, q - 0.08, 0.36, 0.16); c.fillRect(0.62, q - 0.08, 0.36, 0.16); }
    c.beginPath(); c.roundRect(-0.66, -0.66, 1.32, 1.32, 0.14); c.fill();
    c.fillStyle = bg; c.beginPath(); c.roundRect(-0.3, -0.3, 0.6, 0.6, 0.06); c.fill();
  },
  popcorn(c, fg, bg) {      // a bucket of popcorn
    c.fillStyle = fg;
    for (const [x, y, r] of [[-0.42, -0.28, 0.3], [0.42, -0.28, 0.3], [0, -0.42, 0.34], [-0.18, -0.74, 0.26], [0.22, -0.72, 0.26]]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
    c.beginPath(); c.moveTo(-0.66, -0.12); c.lineTo(0.66, -0.12); c.lineTo(0.44, 0.98); c.lineTo(-0.44, 0.98); c.closePath(); c.fill();
    c.fillStyle = bg;
    for (const x of [-0.24, 0.22]) { c.beginPath(); c.moveTo(x - 0.09, -0.12); c.lineTo(x + 0.09, -0.12); c.lineTo(x * 0.72 + 0.07, 0.98); c.lineTo(x * 0.72 - 0.07, 0.98); c.closePath(); c.fill(); }
  },
};
// a share: a coin in the stock's colour with its picture
export function drawCoin(c, x, y, r, id, { grey = false } = {}) {
  const cr = CROPS[id] || {};
  const face = grey ? mix(cr.color || '#cccccc', '#9a9aa6', 0.7) : cr.color || '#cccccc';
  const deep = grey ? mix(cr.deep || '#888888', '#6a6a76', 0.7) : cr.deep || '#888888';
  const lw = Math.max(1, r * 0.17);
  c.save();
  c.beginPath(); c.arc(x, y + r * 0.13, r, 0, TAU); c.fillStyle = deep; c.fill(); c.lineWidth = lw; c.strokeStyle = INK; c.stroke();
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = face; c.fill(); c.stroke();
  c.beginPath(); c.arc(x, y, r * 0.76, 0, TAU); c.lineWidth = Math.max(0.7, r * 0.07); c.strokeStyle = rgba(deep, 0.85); c.stroke();
  const g = GLYPH[cr.glyph];
  if (g) {
    c.save(); c.translate(x, y); c.scale(r * 0.46, r * 0.46);
    g(c, grey ? 'rgba(255,255,255,0.75)' : cr.dark ? INK : '#ffffff', face);
    c.restore();
  }
  shine(c, x - r * 0.42, y - r * 0.46, r * 0.22, r * 0.11, 0.55);
  c.restore();
}

function sprout(c, s) {
  stem(c, s, 0, s * 0.02, 0, -s * 0.1, VINE, 0.04);
  leaf(c, s, 0, -s * 0.06, -2.55, s * 0.15, s * 0.065, VINE);
  leaf(c, s, 0, -s * 0.06, -0.6, s * 0.15, s * 0.065, VINE);
  candle(c, s, 0, -s * 0.17, s * 0.08, s * 0.075, s * 0.02, UP, { stalk: null });
}
function seed(c, s, id) {
  drawCoin(c, s * 0.02, -s * 0.05, s * 0.06, id);
  c.beginPath(); c.ellipse(0, s * 0.01, s * 0.17, s * 0.065, 0, 0, TAU); ink(c, s, '#7a4e2e');
  c.fillStyle = '#a8784a'; for (const [x, y] of [[-0.08, 0.0], [0.07, 0.02]]) { c.beginPath(); c.arc(x * s, y * s, s * 0.014, 0, TAU); c.fill(); }
}
// the chart plant: a rising row of candles, each on its own stalk out of the soil, with the shares (coins) on top of
// the tallest ones; growing, it's shorter with a bud; wilted, the row falls, the candles go red and the coins drop
function chartPlant(c, s, id, st) {
  const sh = shapeOf(id), cr = CROPS[id] || { yield: 2 };
  const dead = st === 4, young = st === 2;
  const n = sh.c.length, span = s * (n >= 4 ? 0.5 : 0.4), x0 = -span / 2;
  const climb = s * 0.27 * sh.tall * (young ? 0.55 : 1), base = s * (young ? 0.06 : 0.08);
  const leafC = dead ? DEAD : VINE;
  leaf(c, s, x0 - s * 0.02, s * 0.02, -2.7, s * 0.2, s * 0.08, leafC);
  leaf(c, s, x0 + s * 0.02, s * 0.02, -0.35, s * 0.17, s * 0.07, leafC);
  const tops = [];
  for (let k = 0; k < n; k++) {
    const f = n > 1 ? k / (n - 1) : 1;
    const x = x0 + span * f;
    const hv = sh.c[dead ? n - 1 - k : k], down = dead || hv < 0;
    const h = Math.abs(hv) * s * (young ? 0.75 : 1.18);
    const lift = dead ? base * 0.45 + climb * 0.55 * (1 - f) : base + climb * f + (hv < 0 ? s * 0.04 : 0);
    const y = -lift - h / 2;
    candle(c, s, x, y, h, s * sh.w * (young ? 1 : 1.22), s * sh.wick * (young ? 0.6 : 1), down ? DOWN : UP, { stalk: leafC, bend: dead ? s * 0.06 * (k % 2 ? -1 : 1) : 0 });
    tops.push({ x, top: y - h / 2 - s * sh.wick * (young ? 0.6 : 1) });
  }
  if (young) {
    const t = tops[n - 1];
    leaf(c, s, t.x, t.top + s * 0.01, -2.3, s * 0.08, s * 0.035, VINE, false); leaf(c, s, t.x, t.top + s * 0.01, -0.8, s * 0.08, s * 0.035, VINE, false);
    drawCoin(c, t.x, t.top - s * 0.035, s * 0.05, id);
    return;
  }
  // the shares: one big coin, or two or three, on the tallest candles (fallen on the soil when it wilted)
  const k1 = Math.min(3, cr.yield), r = s * (k1 <= 1 ? 0.17 : k1 === 2 ? 0.13 : 0.115);
  for (let k = k1 - 1; k >= 0; k--) {
    if (dead) { drawCoin(c, x0 + span * (0.55 + k * 0.28) - s * 0.06, s * 0.02 - r * 0.25, r * 0.92, id, { grey: true }); continue; }
    const t = tops[n - 1 - k] || tops[n - 1];
    drawCoin(c, t.x + (k === 2 ? -s * 0.03 : 0), t.top - r * 0.82, r, id);
  }
}
// how big each stock is drawn in its plot (drawn in one size and scaled to fill the soil)
const SIZE = { gme: 1.18, ko: 1.14, aapl: 1.12, tsla: 1.1, amzn: 1.12, msft: 1.08, brka: 1.06, nvda: 1.06, nflx: 1.18 };
export function drawCrop(c, id, stage, s) {
  c.save();
  if (stage === 0) { c.scale(1.2, 1.2); seed(c, s, id); }
  else if (stage === 1) { c.scale(1.3, 1.3); sprout(c, s); }
  else { const k = SIZE[id] || 1.2; c.scale(k, k); chartPlant(c, s, id, stage); }
  c.restore();
}
// a stock's sprite, kept: drawn in a canvas 1.4 cells wide and 1.85 tall, anchored at the middle of its soil
export function cropSprite(id, stage, s, dpr = 1) {
  const px = Math.max(8, Math.round(s * dpr)), key = `c:${id}:${stage}:${px}`;
  let hit = cache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas'); cv.width = Math.round(px * 1.4); cv.height = Math.round(px * 1.85);
  const c = cv.getContext('2d'); c.translate(px * 0.7, px * 1.3);
  drawCrop(c, id, stage, px);
  hit = { canvas: cv, ax: 0.5, ay: 1.3 / 1.85, w: 1.4, h: 1.85 };
  cache.set(key, hit);
  return hit;
}

// ---------- what a stock gives: a share, the coin on the market and in the air ----------
export function drawProduce(c, id, x, y, r) { drawCoin(c, x, y - r * 0.06, r * 1.12, id); }
export function produceSprite(id, r, dpr = 1) {
  const px = Math.max(6, Math.round(r * dpr)), key = `p:${id}:${px}`;
  let hit = cache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas'); cv.width = cv.height = px * 3;
  const c = cv.getContext('2d');
  drawProduce(c, id, px * 1.5, px * 1.5, px);
  hit = { canvas: cv, half: 1.5 };
  cache.set(key, hit);
  return hit;
}
// the icon as a small canvas element for the page (the market's chips, the cards)
export function produceIcon(id, px = 28) {
  const dpr = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
  const cv = document.createElement('canvas');
  cv.width = cv.height = Math.round(px * dpr);
  cv.className = 'gs-icon';
  cv.style.width = cv.style.height = `${px}px`;
  const c = cv.getContext('2d'); c.scale(dpr, dpr);
  drawProduce(c, id, px / 2, px / 2 + px * 0.02, px * 0.37);
  return cv;
}

// ---------- the soil ----------
// a plot: its soil (dark when wet, pale and cracked when dry), furrows; locked plots are grass with a little sign
export function drawPlot(c, x, y, s, { open, w, locked, cost, hover, flash, comp, night }) {
  const r = s * 0.16, pad = s * 0.05;
  c.save(); c.translate(x, y);
  if (!open) {
    c.beginPath(); c.roundRect(pad, pad, s - pad * 2, s - pad * 2, r);
    c.fillStyle = hover ? '#6fd06a' : '#5cc25c'; c.fill();
    c.setLineDash([s * 0.06, s * 0.05]); c.lineWidth = Math.max(1, s * 0.022); c.strokeStyle = rgba(INK, 0.35); c.stroke(); c.setLineDash([]);
    if (cost != null) {
      const pw = s * 0.06;
      c.fillStyle = '#9a6a3a'; c.fillRect(s * 0.5 - pw / 2, s * 0.42, pw, s * 0.32);
      c.beginPath(); c.roundRect(s * 0.18, s * 0.22, s * 0.64, s * 0.26, s * 0.05); ink(c, s, '#ffe7b8');
      c.fillStyle = INK; c.font = `900 ${Math.round(s * 0.17)}px 'AK Display', system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(cost), s * 0.5, s * 0.355);
    }
    c.restore(); return;
  }
  const dry = 1 - Math.min(1, w * 1.3), wet = Math.max(0, (w - 0.55) / 0.45);
  const soil = mix(mix(mix('#6b4428', '#4b2c17', wet), '#b98a58', dry), '#2a2a52', night * 0.35);
  c.beginPath(); c.roundRect(pad, pad, s - pad * 2, s - pad * 2, r);
  c.fillStyle = soil; c.fill();
  c.lineWidth = Math.max(1.4, s * 0.034); c.strokeStyle = INK; c.stroke();
  c.save(); c.clip();
  c.strokeStyle = rgba('#2a160a', 0.28 - dry * 0.12); c.lineWidth = Math.max(1, s * 0.03);
  for (const k of [0.32, 0.5, 0.68]) { c.beginPath(); c.moveTo(s * 0.16, s * k); c.quadraticCurveTo(s * 0.5, s * (k - 0.03), s * 0.84, s * k); c.stroke(); }
  if (dry > 0.6) { c.strokeStyle = rgba('#5a3b1e', 0.5); c.lineWidth = Math.max(0.8, s * 0.014); c.beginPath(); c.moveTo(s * 0.25, s * 0.2); c.lineTo(s * 0.33, s * 0.3); c.lineTo(s * 0.3, s * 0.4); c.moveTo(s * 0.7, s * 0.62); c.lineTo(s * 0.62, s * 0.72); c.lineTo(s * 0.66, s * 0.8); c.stroke(); }
  if (wet > 0.2) { c.fillStyle = `rgba(255,236,210,${(0.22 * wet).toFixed(3)})`; for (const [px, py, rx] of [[0.27, 0.24, 0.06], [0.71, 0.58, 0.05], [0.4, 0.76, 0.04]]) { c.beginPath(); c.ellipse(px * s, py * s, rx * s, rx * s * 0.45, -0.3, 0, TAU); c.fill(); } }
  if (comp) { c.fillStyle = 'rgba(70,40,20,0.35)'; for (const [px, py] of [[0.25, 0.75], [0.7, 0.25], [0.78, 0.7], [0.3, 0.26]]) { c.beginPath(); c.arc(px * s, py * s, s * 0.035, 0, TAU); c.fill(); } }
  c.restore();
  if (hover) { c.beginPath(); c.roundRect(pad - 2, pad - 2, s - pad * 2 + 4, s - pad * 2 + 4, r + 2); c.lineWidth = Math.max(2, s * 0.045); c.strokeStyle = 'rgba(255,255,255,0.9)'; c.stroke(); }
  if (flash) { c.beginPath(); c.roundRect(pad, pad, s - pad * 2, s - pad * 2, r); c.fillStyle = rgba(flash.color, flash.a); c.fill(); }
  c.restore();
}

// a drop over a thirsty plot
export function drawDrop(c, x, y, r, a = 1) {
  c.save(); c.globalAlpha = a; c.translate(x, y);
  c.beginPath(); c.moveTo(0, -r * 1.3); c.bezierCurveTo(r * 0.9, -r * 0.2, r * 0.9, r, 0, r); c.bezierCurveTo(-r * 0.9, r, -r * 0.9, -r * 0.2, 0, -r * 1.3); c.closePath();
  c.fillStyle = '#59c8ff'; c.fill(); c.lineWidth = Math.max(1, r * 0.25); c.strokeStyle = INK; c.stroke();
  shine(c, -r * 0.25, -r * 0.05, r * 0.2, r * 0.32, 0.7, 0.3);
  c.restore();
}

// ---------- the bear and the bull ----------
export function drawBear(c, x, y, s, { t = 0, face = 1, eat = false, scared = 0, hop = 0, flee = false }) {
  c.save(); c.translate(x, y - Math.abs(Math.sin(t * 9)) * s * 0.04 - hop * s * 0.6); c.scale(face, 1);
  const fur = '#8a5a3a', light = '#c79a6a';
  c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.ellipse(0, s * 0.32, s * 0.38, s * 0.1, 0, 0, TAU); c.fill();
  const leg = Math.sin(t * 11) * s * 0.05;
  for (const [lx, d] of [[-0.2, 1], [0.18, -1]]) { c.beginPath(); c.roundRect(lx * s - s * 0.07, s * 0.1 + d * leg * 0.5, s * 0.14, s * 0.2, s * 0.06); ink(c, s, fur); }
  c.beginPath(); c.ellipse(0, s * 0.06, s * 0.36, s * 0.27, 0, 0, TAU); ink(c, s, fur);
  c.beginPath(); c.ellipse(s * 0.02, s * 0.1, s * 0.2, s * 0.15, 0, 0, TAU); c.fillStyle = light; c.fill();
  const hx = s * 0.26, hy = -s * 0.12 + (eat ? Math.abs(Math.sin(t * 14)) * s * 0.06 + s * 0.05 : 0);
  for (const ex of [-0.13, 0.13]) { c.beginPath(); c.arc(hx + ex * s, hy - s * 0.16, s * 0.08, 0, TAU); ink(c, s, fur); c.beginPath(); c.arc(hx + ex * s, hy - s * 0.16, s * 0.04, 0, TAU); c.fillStyle = light; c.fill(); }
  c.beginPath(); c.arc(hx, hy, s * 0.21, 0, TAU); ink(c, s, fur);
  c.beginPath(); c.ellipse(hx + s * 0.1, hy + s * 0.06, s * 0.1, s * 0.075, 0, 0, TAU); ink(c, s, light);
  c.fillStyle = INK; c.beginPath(); c.ellipse(hx + s * 0.15, hy + s * 0.03, s * 0.035, s * 0.025, 0, 0, TAU); c.fill();
  if (scared || flee) { c.lineWidth = Math.max(1, s * 0.03); c.strokeStyle = INK; for (const ex of [-0.04, 0.08]) { c.beginPath(); c.moveTo(hx + ex * s - s * 0.03, hy - s * 0.07); c.lineTo(hx + ex * s + s * 0.03, hy - s * 0.03); c.moveTo(hx + ex * s + s * 0.03, hy - s * 0.07); c.lineTo(hx + ex * s - s * 0.03, hy - s * 0.03); c.stroke(); } }
  else { c.fillStyle = INK; for (const ex of [-0.04, 0.08]) { c.beginPath(); c.arc(hx + ex * s, hy - s * 0.05, s * 0.028, 0, TAU); c.fill(); } c.fillStyle = '#fff'; for (const ex of [-0.04, 0.08]) { c.beginPath(); c.arc(hx + ex * s + s * 0.01, hy - s * 0.06, s * 0.009, 0, TAU); c.fill(); } }
  if (eat) { c.fillStyle = 'rgba(255,120,150,0.6)'; c.beginPath(); c.arc(hx - s * 0.1, hy + s * 0.04, s * 0.035, 0, TAU); c.fill(); }
  c.restore();
}
export function drawBull(c, x, y, s, t) {
  c.save(); c.translate(x, y - Math.abs(Math.sin(t * 16)) * s * 0.06);
  const hide = '#3a2a2a', light = '#6a4a40';
  c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(0, s * 0.3, s * 0.5, s * 0.1, 0, 0, TAU); c.fill();
  const leg = Math.sin(t * 22) * s * 0.08;
  for (const [lx, d] of [[-0.3, 1], [-0.15, -1], [0.18, 1], [0.32, -1]]) { c.beginPath(); c.roundRect(lx * s - s * 0.05, s * 0.05 + d * leg * 0.4, s * 0.1, s * 0.24, s * 0.04); ink(c, s, hide); }
  c.beginPath(); c.ellipse(0, -s * 0.02, s * 0.46, s * 0.24, -0.05, 0, TAU); ink(c, s, hide);
  c.beginPath(); c.moveTo(-s * 0.44, -s * 0.06); c.quadraticCurveTo(-s * 0.62, -s * 0.2, -s * 0.58, s * 0.02); c.lineWidth = Math.max(1, s * 0.03); c.strokeStyle = INK; c.stroke();
  const hx = s * 0.48, hy = -s * 0.04;
  c.beginPath(); c.ellipse(hx, hy, s * 0.18, s * 0.15, 0.3, 0, TAU); ink(c, s, hide);
  c.beginPath(); c.ellipse(hx + s * 0.12, hy + s * 0.06, s * 0.09, s * 0.07, 0.3, 0, TAU); ink(c, s, light);
  // two horns, curving out and up
  for (const d of [-1, 1]) {
    const bx = hx - s * 0.03 + d * s * 0.07, by = hy - s * 0.1;
    c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx + d * s * 0.16, by - s * 0.02, bx + d * s * 0.13, by - s * 0.2);
    c.lineWidth = s * 0.065; c.strokeStyle = INK; c.stroke(); c.lineWidth = s * 0.038; c.strokeStyle = '#f3e6c4'; c.stroke();
  }
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(hx + s * 0.02, hy - s * 0.04, s * 0.035, 0, TAU); c.fill(); c.fillStyle = INK; c.beginPath(); c.arc(hx + s * 0.03, hy - s * 0.04, s * 0.018, 0, TAU); c.fill();
  c.strokeStyle = '#ffd84a'; c.lineWidth = Math.max(1, s * 0.03); c.beginPath(); c.arc(hx + s * 0.15, hy + s * 0.08, s * 0.035, 0, TAU); c.stroke();
  c.restore();
}

// a flower or a tuft for the grass around the field
export function drawTuft(c, x, y, s, kind) {
  c.save(); c.translate(x, y);
  if (kind === 0) { c.strokeStyle = '#3e9e4a'; c.lineWidth = Math.max(1, s * 0.25); c.lineCap = 'round'; c.beginPath(); c.moveTo(-s, 0); c.lineTo(-s * 1.3, -s * 1.6); c.moveTo(0, 0); c.lineTo(0, -s * 2); c.moveTo(s, 0); c.lineTo(s * 1.3, -s * 1.6); c.stroke(); }
  else { const col = ['#ffd84a', '#ffffff', '#ff8ac0', '#b79cff'][kind % 4]; c.fillStyle = col; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; c.beginPath(); c.arc(Math.cos(a) * s * 0.9, Math.sin(a) * s * 0.9, s * 0.75, 0, TAU); c.fill(); } c.fillStyle = '#ffb12e'; c.beginPath(); c.arc(0, 0, s * 0.6, 0, TAU); c.fill(); }
  c.restore();
}
