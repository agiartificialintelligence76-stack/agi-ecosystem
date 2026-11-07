// SYNAPSE (2026-11-08): its look, "bioluminescent neural tissue, as a clean toy". A deep navy board of soft inset wells,
// neurons as round nodes with an ink outline and little dendrite spikes, paths as thick tubes with a lighter core, ten
// colors that each carry their own glyph (so color is never the only cue). Glow only when the network fires.
// Sprites are drawn once per size into small canvases and stamped each frame.
import { PALETTE, roundRect, star, mix, rgba } from '../kit/fx.js';

export const INK = PALETTE.ink;
export const NAVY = '#0a0f24';          // the page (the theme color)
export const BOARD = '#141c42';         // the board's surface
export const WELL = '#0b1131';          // a cell's well
export const WELL_HI = '#1d2858';       // the lit lower lip of a well
export const MUTED = '#8e8bc0';         // gates and bridges, quiet
export const DISPLAY = "'AK Display', 'Arial Black', system-ui, sans-serif";
export const MONO = "'AK Mono', ui-monospace, Menlo, monospace";
export const SERIF = "'AK Serif', Georgia, serif";

// the ten neuron colors, in the order boards use them (the first few as far apart as can be), each with its glyph
export const COLORS = Object.freeze([
  { name: 'pink', hex: '#ff4da6', glyph: 'circle' },
  { name: 'honey', hex: '#ffc933', glyph: 'square' },
  { name: 'sky', hex: '#59c8ff', glyph: 'triangle' },
  { name: 'mint', hex: '#3ff0c3', glyph: 'diamond' },
  { name: 'violet', hex: '#9b7bff', glyph: 'star' },
  { name: 'orange', hex: '#ff8a3d', glyph: 'plus' },
  { name: 'lime', hex: '#b8ef45', glyph: 'hex' },
  { name: 'red', hex: '#ff5a5f', glyph: 'cross' },
  { name: 'white', hex: '#f3efff', glyph: 'ring' },
  { name: 'tan', hex: '#d4a373', glyph: 'bars' },
]);
export const colorOf = (c) => COLORS[c % COLORS.length];
// the tube's lighter core, and its darker side
export const CORE = COLORS.map((c) => mix(c.hex, '#ffffff', 0.55));
export const DEEP = COLORS.map((c) => mix(c.hex, '#0a0f24', 0.35));

const canvasOf = (w, h) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
};

// a glyph centred on (x, y), r its half-size (filled or stroked with the current styles by the caller)
export function glyph(g, kind, x, y, r) {
  g.beginPath();
  switch (kind) {
    case 'circle': g.arc(x, y, r * 0.78, 0, Math.PI * 2); break;
    case 'square': roundRect(g, x - r * 0.7, y - r * 0.7, r * 1.4, r * 1.4, r * 0.22); break;
    case 'triangle':
      g.moveTo(x, y - r * 0.92); g.lineTo(x + r * 0.9, y + r * 0.66); g.lineTo(x - r * 0.9, y + r * 0.66); g.closePath(); break;
    case 'diamond':
      g.moveTo(x, y - r); g.lineTo(x + r * 0.8, y); g.lineTo(x, y + r); g.lineTo(x - r * 0.8, y); g.closePath(); break;
    case 'star': star(g, x, y + r * 0.06, r * 1.02, r * 0.46, 5); break;
    case 'plus': {
      const a = r * 0.3, b = r * 0.9;
      g.moveTo(x - a, y - b); g.lineTo(x + a, y - b); g.lineTo(x + a, y - a); g.lineTo(x + b, y - a); g.lineTo(x + b, y + a);
      g.lineTo(x + a, y + a); g.lineTo(x + a, y + b); g.lineTo(x - a, y + b); g.lineTo(x - a, y + a); g.lineTo(x - b, y + a);
      g.lineTo(x - b, y - a); g.lineTo(x - a, y - a); g.closePath(); break;
    }
    case 'hex':
      for (let k = 0; k < 6; k++) { const t = (k / 6) * Math.PI * 2; g[k ? 'lineTo' : 'moveTo'](x + Math.cos(t) * r * 0.86, y + Math.sin(t) * r * 0.86); }
      g.closePath(); break;
    case 'cross': {
      const a = r * 0.27, b = r * 0.82;
      for (let k = 0; k < 4; k++) {
        const t = Math.PI / 4 + (k * Math.PI) / 2, c = Math.cos(t), s = Math.sin(t), pc = Math.cos(t + Math.PI / 2), ps = Math.sin(t + Math.PI / 2);
        const pts = [[a * c - a * pc, a * s - a * ps], [b * c - a * pc, b * s - a * ps], [b * c + a * pc, b * s + a * ps], [a * c + a * pc, a * s + a * ps]];
        pts.forEach(([px, py], i) => g[k === 0 && i === 0 ? 'moveTo' : 'lineTo'](x + px, y + py));
      }
      g.closePath(); break;
    }
    case 'ring': g.arc(x, y, r * 0.82, 0, Math.PI * 2); g.moveTo(x + r * 0.42, y); g.arc(x, y, r * 0.42, 0, Math.PI * 2, true); break;
    case 'bars': for (const dx of [-0.6, -0.1, 0.4]) roundRect(g, x + dx * r, y - r * 0.82, r * 0.34, r * 1.64, r * 0.12); break;
    default: g.arc(x, y, r * 0.6, 0, Math.PI * 2);
  }
}

// a neuron: its body, its dendrites (a few short spikes, turned its own way), its glyph in ink, a small highlight.
// → { canvas, size (CSS px), r }
export function neuronSprite(c, C, dpr, seed = 0) {
  const col = colorOf(c);
  const r = C * 0.33, S = Math.ceil(C * 1.0);
  const cv = canvasOf(S * dpr, S * dpr);
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  const cx = S / 2, cy = S / 2;
  const ow = Math.max(1.6, C * 0.05);
  // dendrites: a few thin tapered branches curling off the body, each its own length and turn
  const spikes = 6, turn = (seed * 0.917) % (Math.PI * 2);
  const branch = (t, len, bend, w0) => {
    const ux = Math.cos(t), uy = Math.sin(t), px = -uy, py = ux;
    const bx = cx + ux * r * 0.78, by = cy + uy * r * 0.78;
    const tx = cx + Math.cos(t + bend) * len, ty = cy + Math.sin(t + bend) * len;
    const mx = cx + Math.cos(t + bend * 0.45) * (r + len) * 0.55, my = cy + Math.sin(t + bend * 0.45) * (r + len) * 0.55;
    g.moveTo(bx + px * w0, by + py * w0);
    g.quadraticCurveTo(mx + px * w0 * 0.45, my + py * w0 * 0.45, tx, ty);
    g.quadraticCurveTo(mx - px * w0 * 0.45, my - py * w0 * 0.45, bx - px * w0, by - py * w0);
    g.closePath();
  };
  g.beginPath();
  for (let k = 0; k < spikes; k++) {
    const t = turn + (k / spikes) * Math.PI * 2 + Math.sin(k * 2.3 + seed) * 0.25;
    const len = r * (1.3 + 0.18 * Math.sin(k * 1.7 + seed * 3.1));
    branch(t, len, Math.sin(k * 3.7 + seed) * 0.42, r * 0.17);
  }
  g.lineJoin = 'round';
  g.strokeStyle = INK; g.lineWidth = ow * 1.7; g.stroke();
  g.fillStyle = col.hex; g.fill();
  // body
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2);
  g.lineWidth = ow * 2; g.stroke();
  g.fillStyle = col.hex; g.fill();
  // a soft shade below and a highlight up top: a toy, lit from above
  g.save();
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
  g.fillStyle = rgba('#0a0f24', 0.2); g.beginPath(); g.arc(cx + r * 0.2, cy + r * 0.45, r * 0.95, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.42)'; g.beginPath(); g.ellipse(cx - r * 0.34, cy - r * 0.42, r * 0.34, r * 0.2, -0.6, 0, Math.PI * 2); g.fill();
  g.restore();
  // its glyph
  g.fillStyle = INK;
  glyph(g, col.glyph, cx, cy + r * 0.04, r * 0.5);
  g.fill('evenodd');
  return { canvas: cv, size: S, r };
}

// a soft round light (additive): for the firing's glow
export function glowSprite(hex, size, dpr) {
  const S = Math.ceil(size);
  const cv = canvasOf(S * dpr, S * dpr);
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, rgba(hex, 0.9));
  grad.addColorStop(0.25, rgba(hex, 0.45));
  grad.addColorStop(0.6, rgba(hex, 0.12));
  grad.addColorStop(1, rgba(hex, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  return { canvas: cv, size: S };
}

// a bridge's deck: a raised slab the vertical lane runs along, over the lane that goes under (it hides that lane's
// middle, and casts a shadow on it)
export function deckSprite(C, dpr) {
  const S = Math.ceil(C);
  const cv = canvasOf(S * dpr, S * dpr);
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  const ow = Math.max(1.6, C * 0.045);
  const w = C * 0.7, x = (S - w) / 2;
  // its shadow on the lane underneath
  g.fillStyle = 'rgba(4,6,18,0.5)';
  g.fillRect(x - C * 0.08, C * 0.24, w + C * 0.16, C * 0.52);
  // the slab: open at the top and bottom (it carries on into the cells above and below)
  g.fillStyle = '#26306a';
  g.fillRect(x, -1, w, S + 2);
  g.fillStyle = 'rgba(255,255,255,0.07)';
  g.fillRect(x + w * 0.12, -1, w * 0.18, S + 2);
  g.strokeStyle = INK; g.lineWidth = ow;
  g.beginPath(); g.moveTo(x, -1); g.lineTo(x, S + 1); g.moveTo(x + w, -1); g.lineTo(x + w, S + 1); g.stroke();
  // its railings
  g.strokeStyle = '#7f88d8'; g.lineWidth = Math.max(1.2, C * 0.028);
  g.beginPath(); g.moveTo(x + ow * 1.4, C * 0.1); g.lineTo(x + ow * 1.4, C * 0.9); g.moveTo(x + w - ow * 1.4, C * 0.1); g.lineTo(x + w - ow * 1.4, C * 0.9); g.stroke();
  return { canvas: cv, size: S };
}

// the board itself (its shadow, its ink outline, its surface and every well), drawn once per layout.
// L: { n, C (cell pitch), x, y (the grid's corner), pad }; kind: the board's cells. → { canvas, x, y, w, h }
export function boardSprite(L, kind, dpr) {
  const { n, C } = L;
  const pad = L.pad, ow = Math.max(2.4, C * 0.055), sh = Math.max(4, C * 0.09);
  const m = pad + ow + sh + 4;
  const W = n * C + m * 2, H = n * C + m * 2;
  const cv = canvasOf(W * dpr, H * dpr);
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  const ox = m, oy = m;
  const live = (x, y) => x >= 0 && y >= 0 && x < n && y < n && kind[y * n + x] !== 1;
  // the board's outline: every live cell grown by `grow`, rounded on the outside, joined to its neighbours
  const blob = (grow, r, dx = 0, dy = 0) => {
    g.beginPath();
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (!live(x, y)) continue;
      const px = ox + x * C + dx, py = oy + y * C + dy;
      roundRect(g, px - grow, py - grow, C + grow * 2, C + grow * 2, r);
      g.fill();
      if (live(x + 1, y)) g.fillRect(px + C / 2, py - grow, C, C + grow * 2);
      if (live(x, y + 1)) g.fillRect(px - grow, py + C / 2, C + grow * 2, C);
      if (live(x + 1, y) && live(x, y + 1) && live(x + 1, y + 1)) g.fillRect(px + C / 2, py + C / 2, C, C);
    }
  };
  const r = pad + C * 0.12;
  g.fillStyle = INK; blob(pad + ow, r + ow, 0, sh);       // hard shadow
  g.fillStyle = INK; blob(pad + ow, r + ow);              // outline
  g.fillStyle = BOARD; blob(pad, r);                      // surface
  // a faint light from the top of the board
  g.save();
  g.globalCompositeOperation = 'source-atop';
  const lg = g.createLinearGradient(0, oy - pad, 0, oy + n * C + pad);
  lg.addColorStop(0, 'rgba(120,140,255,0.10)');
  lg.addColorStop(1, 'rgba(0,0,0,0.12)');
  g.fillStyle = lg;
  g.fillRect(0, 0, W, H);
  g.restore();
  // the wells: sunk into the surface, a darker top lip, a lit lower lip, a few specks of texture
  const inset = C * 0.075, wr = C * 0.2;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!live(x, y)) continue;
    const px = ox + x * C + inset, py = oy + y * C + inset, s = C - inset * 2;
    roundRect(g, px, py + C * 0.03, s, s, wr); g.fillStyle = WELL_HI; g.fill();
    roundRect(g, px, py, s, s, wr); g.fillStyle = WELL; g.fill();
    g.save();
    roundRect(g, px, py, s, s, wr); g.clip();
    g.fillStyle = 'rgba(0,0,0,0.32)'; g.fillRect(px, py, s, C * 0.06);
    g.fillStyle = 'rgba(160,170,255,0.05)';
    const h = (x * 73 + y * 151) % 97;
    for (let k = 0; k < 3; k++) {
      const sx = px + ((h * (k + 3) * 13) % 89) / 89 * s, sy = py + ((h * (k + 5) * 7) % 83) / 83 * s;
      g.beginPath(); g.arc(sx, sy, C * 0.03, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
  return { canvas: cv, x: L.x - m, y: L.y - m, w: W, h: H };
}

// the page behind the board: navy, a few huge soft cell shapes far behind (tissue), no glow
export function backdropSprite(W, H, dpr) {
  const cv = canvasOf(W * dpr, H * dpr);
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  g.fillStyle = NAVY; g.fillRect(0, 0, W, H);
  const v = g.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, Math.max(W, H) * 0.75);
  v.addColorStop(0, '#121a3f'); v.addColorStop(1, NAVY);
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  // tissue: big faint rings (cell membranes), fixed places
  const s = Math.max(W, H);
  const blobs = [[0.08, 0.18, 0.22], [0.92, 0.12, 0.16], [0.86, 0.78, 0.26], [0.14, 0.86, 0.18], [0.5, 1.04, 0.3], [0.62, -0.06, 0.2]];
  g.lineWidth = Math.max(1, s * 0.0016);
  for (const [bx, by, br] of blobs) {
    g.strokeStyle = 'rgba(130,150,255,0.055)';
    g.fillStyle = 'rgba(80,95,200,0.035)';
    g.beginPath(); g.arc(bx * W, by * H, br * s, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.arc(bx * W + br * s * 0.18, by * H - br * s * 0.1, br * s * 0.22, 0, Math.PI * 2); g.stroke();
  }
  // a fine speckle
  g.fillStyle = 'rgba(200,210,255,0.05)';
  let h = 2166136261;
  for (let k = 0; k < Math.min(220, (W * H) / 5000); k++) {
    h = Math.imul(h ^ k, 16777619) >>> 0;
    const x = (h % 10007) / 10007 * W;
    h = Math.imul(h ^ (k * 7), 16777619) >>> 0;
    const y = (h % 10009) / 10009 * H;
    g.fillRect(x, y, 1.5, 1.5);
  }
  return cv;
}
