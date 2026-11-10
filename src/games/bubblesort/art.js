// BUBBLE SORT's art: "candy glass in a memory bank". Every bubble is a glossy sticker candy (flat colour, a darker rim, the
// ink outline, a white crescent of light) with its own drawn glyph, so colour is never the only cue: a heart, a star, a
// bolt, a drop, a leaf, a moon. Each kind is drawn once per size onto its own small canvas (at the screen's pixel ratio)
// and stamped from there every frame.
import { STONE, LOCK, MEMORY, SORT, WILD, BOMB } from './grid.js';
import { star as starPath } from '../kit/fx.js';

export const INK = '#170a36';
export const C = Object.freeze({
  ink: INK, ink2: '#4a3d6e', paper: '#fffaf0', lav: '#e4d9ff', lav2: '#cdb8ff', violet: '#6b3bff', violet2: '#8b66ff',
  pink: '#ff4da6', honey: '#ffc933', mint: '#3ff0c3', red: '#ff5a5f', sky: '#59c8ff',
  board: '#120c2e', board2: '#1b1442', night: '#0b0720',
});
// the six colours: [fill, rim, glyph ink, name, glyph]
export const COLORS = Object.freeze([
  null,
  { fill: '#ff5fae', rim: '#d42f80', glyph: '#ffffff', name: 'pink', shape: 'heart' },
  { fill: '#ffc933', rim: '#d99610', glyph: INK, name: 'honey', shape: 'star' },
  { fill: '#8c66ff', rim: '#5a33d6', glyph: '#ffffff', name: 'violet', shape: 'bolt' },
  { fill: '#4fc4ff', rim: '#1d8ed4', glyph: INK, name: 'sky', shape: 'drop' },
  { fill: '#45eec4', rim: '#15b58c', glyph: INK, name: 'mint', shape: 'leaf' },
  { fill: '#f5f0ff', rim: '#b8a6ea', glyph: '#4a2fb8', name: 'pearl', shape: 'moon' },
]);
export const RAINBOW = ['#ff5fae', '#ffc933', '#45eec4', '#4fc4ff', '#8c66ff', '#ff8fd0'];
export const fillOf = (k) => (k >= 1 && k <= 6 ? COLORS[k].fill : k === STONE ? '#6a5c94' : k === LOCK ? '#cdb8ff' : k === MEMORY ? '#ffc933' : '#ffffff');

// ---------- glyphs: drawn in a box of size s around (0, 0) ----------
function heart(g, s) {
  g.beginPath();
  g.moveTo(0, s * 0.42);
  g.bezierCurveTo(-s * 0.62, s * 0.02, -s * 0.5, -s * 0.5, 0, -s * 0.2);
  g.bezierCurveTo(s * 0.5, -s * 0.5, s * 0.62, s * 0.02, 0, s * 0.42);
  g.closePath();
}
function bolt(g, s) {
  const p = [[0.12, -0.5], [-0.32, 0.06], [-0.04, 0.06], [-0.14, 0.5], [0.32, -0.08], [0.04, -0.08], [0.16, -0.5]];
  g.beginPath();
  p.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](x * s, y * s));
  g.closePath();
}
function drop(g, s) {
  g.beginPath();
  g.moveTo(0, -s * 0.5);
  g.bezierCurveTo(s * 0.12, -s * 0.28, s * 0.36, -s * 0.06, s * 0.36, s * 0.16);
  g.arc(0, s * 0.16, s * 0.36, 0, Math.PI);
  g.bezierCurveTo(-s * 0.36, -s * 0.06, -s * 0.12, -s * 0.28, 0, -s * 0.5);
  g.closePath();
}
function leaf(g, s) {
  g.beginPath();
  g.moveTo(-s * 0.4, s * 0.4);
  g.quadraticCurveTo(-s * 0.46, -s * 0.36, s * 0.42, -s * 0.42);
  g.quadraticCurveTo(s * 0.36, s * 0.46, -s * 0.4, s * 0.4);
  g.closePath();
}
// a crescent: drawn on its own little canvas (a disc with a disc cut out), then stamped
function moon(g, s, colour) {
  const n = Math.max(4, Math.ceil(s * 1.2));
  const cv = makeCanvas(n, n), m = cv.getContext('2d');
  m.translate(n / 2, n / 2);
  m.fillStyle = colour;
  m.beginPath(); m.arc(0, 0, s * 0.42, 0, Math.PI * 2); m.fill();
  m.globalCompositeOperation = 'destination-out';
  m.beginPath(); m.arc(s * 0.2, -s * 0.14, s * 0.36, 0, Math.PI * 2); m.fill();
  g.drawImage(cv, -n / 2, -n / 2);
}
export function glyph(g, shape, s, colour) {
  g.fillStyle = colour;
  if (shape === 'moon') { moon(g, s, colour); return; }
  if (shape === 'heart') heart(g, s);
  else if (shape === 'star') starPath(g, 0, 0, s * 0.5, s * 0.22, 5, 0);
  else if (shape === 'bolt') bolt(g, s);
  else if (shape === 'drop') drop(g, s);
  else if (shape === 'leaf') leaf(g, s);
  g.fill();
  if (shape === 'leaf') {
    g.strokeStyle = colour === INK ? 'rgba(255,255,255,0.55)' : 'rgba(23,10,54,0.35)';
    g.lineWidth = s * 0.07; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-s * 0.3, s * 0.3); g.quadraticCurveTo(0, 0, s * 0.3, -s * 0.32); g.stroke();
  }
}

export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// ---------- one candy: drawn centred at (0, 0), radius r (the outline included) ----------
function candy(g, r, fill, rim, { gloss = true, rainbow = false } = {}) {
  const ow = Math.max(1.2, r * 0.11);
  g.fillStyle = INK;
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
  const ri = r - ow;
  if (rainbow) {
    for (let i = 0; i < 6; i++) {
      g.fillStyle = RAINBOW[i];
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, ri, (i / 6) * Math.PI * 2 - Math.PI / 2, ((i + 1) / 6) * Math.PI * 2 - Math.PI / 2); g.closePath(); g.fill();
    }
    g.fillStyle = fill;
    g.beginPath(); g.arc(0, 0, ri * 0.78, 0, Math.PI * 2); g.fill();
  } else {
    g.fillStyle = rim;
    g.beginPath(); g.arc(0, 0, ri, 0, Math.PI * 2); g.fill();
    g.fillStyle = fill;
    g.beginPath(); g.arc(-ri * 0.07, -ri * 0.08, ri * 0.88, 0, Math.PI * 2); g.fill();
  }
  if (gloss) {
    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineCap = 'round';
    g.lineWidth = ri * 0.17;
    g.beginPath(); g.arc(0, 0, ri * 0.66, Math.PI * 1.06, Math.PI * 1.42); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath(); g.arc(-ri * 0.06, -ri * 0.68, ri * 0.085, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  return ri;
}

function drawKind(g, k, r, hits = 0) {
  if (k >= 1 && k <= 6) {
    const col = COLORS[k];
    const ri = candy(g, r, col.fill, col.rim);
    glyph(g, col.shape, ri * 1.05, col.glyph);
    return;
  }
  if (k === STONE) {
    const ri = candy(g, r, '#6c5e96', '#4a3d6e', { gloss: false });
    // chiselled facets
    g.strokeStyle = 'rgba(23,10,54,0.55)'; g.lineWidth = Math.max(1, r * 0.07); g.lineJoin = 'round';
    g.beginPath(); g.moveTo(-ri * 0.62, -ri * 0.1); g.lineTo(-ri * 0.15, -ri * 0.32); g.lineTo(ri * 0.28, -ri * 0.08); g.lineTo(ri * 0.62, -ri * 0.3);
    g.moveTo(-ri * 0.15, -ri * 0.32); g.lineTo(-ri * 0.05, ri * 0.25); g.lineTo(ri * 0.45, ri * 0.4);
    g.moveTo(-ri * 0.05, ri * 0.25); g.lineTo(-ri * 0.5, ri * 0.38); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.beginPath(); g.moveTo(-ri * 0.62, -ri * 0.1); g.lineTo(-ri * 0.15, -ri * 0.32); g.lineTo(-ri * 0.32, -ri * 0.62); g.closePath(); g.fill();
    return;
  }
  if (k === LOCK) {
    const ri = candy(g, r, '#d9caff', '#a58ef0');
    const s = ri * 0.95;
    // the padlock
    g.strokeStyle = INK; g.lineWidth = s * 0.14; g.lineCap = 'round';
    g.beginPath(); g.arc(0, -s * 0.12, s * 0.24, Math.PI, 0); g.lineTo(s * 0.24, s * 0.02); g.moveTo(-s * 0.24, -s * 0.12); g.lineTo(-s * 0.24, s * 0.02); g.stroke();
    g.fillStyle = INK;
    roundRectPath(g, -s * 0.36, -s * 0.02, s * 0.72, s * 0.5, s * 0.1); g.fill();
    g.fillStyle = '#ffc933';
    g.beginPath(); g.arc(0, s * 0.2, s * 0.08, 0, Math.PI * 2); g.fill();
    if (hits > 0) {
      // cracked: one more pop next to it and it breaks
      g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(1.2, r * 0.09); g.lineJoin = 'round';
      g.beginPath(); g.moveTo(-ri * 0.7, -ri * 0.45); g.lineTo(-ri * 0.3, -ri * 0.15); g.lineTo(-ri * 0.42, ri * 0.15); g.lineTo(-ri * 0.05, ri * 0.55);
      g.moveTo(ri * 0.72, -ri * 0.3); g.lineTo(ri * 0.38, ri * 0.02); g.lineTo(ri * 0.6, ri * 0.35); g.stroke();
      g.strokeStyle = INK; g.lineWidth = Math.max(1, r * 0.045); g.stroke();
    }
    return;
  }
  if (k === MEMORY) {
    // a gold frame around a heart: a memory to set free
    const ow = Math.max(1.2, r * 0.11);
    g.fillStyle = INK; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(0, 0, r - ow, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e09a10'; g.beginPath(); g.arc(r * 0.05, r * 0.06, (r - ow) * 0.74, 0, Math.PI * 2); g.fill();
    g.fillStyle = INK; g.beginPath(); g.arc(0, 0, (r - ow) * 0.7, 0, Math.PI * 2); g.fill();
    const ri = (r - ow) * 0.7 - ow * 0.7;
    g.fillStyle = '#fff4fb'; g.beginPath(); g.arc(0, 0, ri, 0, Math.PI * 2); g.fill();
    glyph(g, 'heart', ri * 1.5, '#ff4da6');
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = r * 0.1; g.lineCap = 'round';
    g.beginPath(); g.arc(0, 0, (r - ow) * 0.86, Math.PI * 1.1, Math.PI * 1.4); g.stroke();
    return;
  }
  if (k === SORT) {
    const ri = candy(g, r, '#fffaf0', '#fffaf0', { rainbow: true });
    // ⇅: two arrows
    const s = ri * 0.62;
    g.strokeStyle = INK; g.fillStyle = INK; g.lineWidth = s * 0.2; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [x, dir] of [[-s * 0.38, -1], [s * 0.38, 1]]) {
      g.beginPath(); g.moveTo(x, -dir * s * 0.62); g.lineTo(x, dir * s * 0.32); g.stroke();
      g.beginPath(); g.moveTo(x - s * 0.3, dir * s * 0.22); g.lineTo(x, dir * s * 0.66); g.lineTo(x + s * 0.3, dir * s * 0.22); g.closePath(); g.fill();
    }
    gloss(g, ri);
    return;
  }
  if (k === WILD) {
    const ow = Math.max(1.2, r * 0.11), ri = r - ow;
    g.fillStyle = INK; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 6; i++) {
      g.fillStyle = RAINBOW[i];
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, ri, (i / 6) * Math.PI * 2 - Math.PI / 2, ((i + 1) / 6) * Math.PI * 2 - Math.PI / 2); g.closePath(); g.fill();
    }
    // a four-point sparkle
    g.fillStyle = '#ffffff'; g.strokeStyle = INK; g.lineWidth = Math.max(1, r * 0.08); g.lineJoin = 'round';
    starPath(g, 0, 0, ri * 0.62, ri * 0.2, 4, 0); g.fill(); g.stroke();
    gloss(g, ri);
    return;
  }
  if (k === BOMB) {
    const ri = candy(g, r, '#2b1a5c', '#2b1a5c', { rainbow: true, gloss: false });
    // the bomb: a round body, a fuse and its spark
    const s = ri * 0.8;
    g.fillStyle = INK; g.beginPath(); g.arc(0, s * 0.1, s * 0.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4a3d6e'; roundRectPath(g, s * 0.12, -s * 0.52, s * 0.3, s * 0.26, s * 0.06); g.fill();
    g.strokeStyle = '#ffc933'; g.lineWidth = s * 0.1; g.lineCap = 'round';
    g.beginPath(); g.moveTo(s * 0.28, -s * 0.5); g.quadraticCurveTo(s * 0.42, -s * 0.78, s * 0.62, -s * 0.66); g.stroke();
    g.fillStyle = '#ffffff'; starPath(g, s * 0.64, -s * 0.68, s * 0.22, s * 0.08, 4, 0.3); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.arc(-s * 0.18, -s * 0.06, s * 0.1, 0, Math.PI * 2); g.fill();
  }
}
function gloss(g, ri) {
  g.save();
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineCap = 'round'; g.lineWidth = ri * 0.14;
  g.beginPath(); g.arc(0, 0, ri * 0.78, Math.PI * 1.08, Math.PI * 1.38); g.stroke();
  g.restore();
}
export function roundRectPath(g, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

// ---------- the sprite sheet: every kind at one size (CSS px radius `r`, drawn at `dpr`) ----------
export function makeSprites(r, dpr) {
  const pad = Math.ceil(r * 0.08) + 1;
  const size = Math.ceil((r + pad) * 2 * dpr);
  const half = size / 2 / dpr;
  const one = (k, hits = 0) => {
    const cv = makeCanvas(size, size), g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, size / 2, size / 2);
    drawKind(g, k, r, hits);
    return cv;
  };
  const sheet = { r, half, size, dpr, kinds: new Map(), cracked: null };
  for (const k of [1, 2, 3, 4, 5, 6, STONE, LOCK, MEMORY, SORT, WILD, BOMB]) sheet.kinds.set(k, one(k));
  sheet.cracked = one(LOCK, 1);
  return sheet;
}
// stamp a kind at (x, y) CSS px, scaled `s`
export function stamp(g, sheet, k, x, y, s = 1, hits = 0) {
  const cv = k === LOCK && hits > 0 ? sheet.cracked : sheet.kinds.get(k);
  if (!cv) return;
  const h = sheet.half * s;
  g.drawImage(cv, x - h, y - h, h * 2, h * 2);
}
