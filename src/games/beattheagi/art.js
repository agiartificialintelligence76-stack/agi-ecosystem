// BEAT THE AGI (2026-11-08): its pictures, drawn once per size into small canvases (the frame draws them with one
// drawImage each). "Sticker board game night": a chunky honey board with an ink outline and a hard shadow, round holes
// onto a deep violet stage, your pink stones embossed with a heart, AGI-1's mint stones embossed with a circuit, all
// flat and glossy with an ink rim. Her portrait is her 2D art in a round sticker.
import { roundRect } from '../kit/fx.js';
import { PAD, SHADOW, FEET } from './layout.js';

export const INK = '#170a36';
export const C = {
  ink: INK, paper: '#fffaf0', honey: '#ffc933', honeyDeep: '#dd9f12', honeyLight: '#ffe48f',
  stage: '#1a0d33', stageDeep: '#12082a', stageLight: '#2a1752',
  pink: '#ff4da6', pinkDeep: '#cf2f80', pinkLight: '#ffa3d2',
  mint: '#3ff0c3', mintDeep: '#14b087', mintLight: '#b4fff0',
  lav: '#e4d9ff', lav2: '#cdb8ff', violet: '#6b3bff', red: '#ff5a5f', sky: '#7fd6ff',
};

function canvasOf(w, h) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil(w));
  cv.height = Math.max(1, Math.ceil(h));
  return cv;
}

// a heart centred on (x, y), `s` wide
export function heartPath(ctx, x, y, s) {
  const k = s / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + k * 0.92);
  ctx.bezierCurveTo(x - k * 1.25, y + k * 0.05, x - k * 1.02, y - k * 1.05, x, y - k * 0.42);
  ctx.bezierCurveTo(x + k * 1.02, y - k * 1.05, x + k * 1.25, y + k * 0.05, x, y + k * 0.92);
  ctx.closePath();
}

// the circuit on AGI-1's stones: a chip with six traces ending in pads
function circuitPath(ctx, x, y, s, padR) {
  const h = s * 0.2;
  ctx.beginPath();
  roundRect(ctx, x - h, y - h, h * 2, h * 2, h * 0.35);
  const traces = [
    [[-h, -h * 0.45], [-s * 0.34, -h * 0.45], [-s * 0.42, -s * 0.24]],
    [[-h, h * 0.45], [-s * 0.4, h * 0.45]],
    [[h, -h * 0.45], [s * 0.4, -h * 0.45]],
    [[h, h * 0.45], [s * 0.34, h * 0.45], [s * 0.42, s * 0.24]],
    [[-h * 0.2, -h], [-h * 0.2, -s * 0.42]],
    [[h * 0.3, h], [h * 0.3, s * 0.3], [s * 0.12, s * 0.42]],
  ];
  return { traces, h, padR };
}
function drawCircuit(ctx, x, y, s, color, lw) {
  const { traces, h } = circuitPath(ctx, x, y, s, s * 0.06);
  ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // the chip (drawn by circuitPath into the current path)
  ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, h * 0.32, 0, Math.PI * 2); ctx.fill();
  for (const t of traces) {
    ctx.beginPath();
    t.forEach(([px, py], i) => (i ? ctx.lineTo(x + px, y + py) : ctx.moveTo(x + px, y + py)));
    ctx.stroke();
    const [ex, ey] = t[t.length - 1];
    ctx.beginPath(); ctx.arc(x + ex, y + ey, s * 0.055, 0, Math.PI * 2); ctx.fill();
  }
}

// One stone (who: 1 pink, 2 mint) of radius r (CSS px) at pixel ratio dpr → a canvas 2r + 2 wide (drawn centred)
export function makeStone(who, r, dpr) {
  const size = Math.ceil((r * 2 + 4) * dpr);
  const cv = canvasOf(size, size);
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  const x = r + 2, y = r + 2;
  const [base, deep, light] = who === 1 ? [C.pink, C.pinkDeep, C.pinkLight] : [C.mint, C.mintDeep, C.mintLight];
  const rim = Math.max(1.6, r * 0.085);
  // the ink rim
  g.fillStyle = INK; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  // the body, a darker lip at the bottom right (its thickness), the face
  g.fillStyle = deep; g.beginPath(); g.arc(x, y, r - rim, 0, Math.PI * 2); g.fill();
  g.fillStyle = base; g.beginPath(); g.arc(x - r * 0.03, y - r * 0.05, r - rim - r * 0.06, 0, Math.PI * 2); g.fill();
  // the pressed ring
  g.strokeStyle = deep; g.globalAlpha = 0.55; g.lineWidth = Math.max(1, r * 0.06);
  g.beginPath(); g.arc(x - r * 0.03, y - r * 0.05, r * 0.66, 0, Math.PI * 2); g.stroke();
  g.globalAlpha = 1;
  // the emblem, embossed: a dark copy a little lower, the light one on top
  const ex = x - r * 0.03, ey = y - r * 0.03;
  if (who === 1) {
    g.fillStyle = deep; heartPath(g, ex + r * 0.035, ey + r * 0.06, r * 0.74); g.fill();
    g.fillStyle = light; heartPath(g, ex, ey, r * 0.74); g.fill();
  } else {
    g.save(); g.translate(r * 0.03, r * 0.05); drawCircuit(g, ex, ey, r * 1.05, deep, Math.max(1, r * 0.075)); g.restore();
    drawCircuit(g, ex, ey, r * 1.05, light, Math.max(1, r * 0.075));
  }
  // gloss: a soft white crescent at the top left
  g.save();
  g.beginPath(); g.arc(x, y, r - rim, 0, Math.PI * 2); g.clip();
  g.globalAlpha = 0.5; g.fillStyle = '#ffffff';
  g.beginPath(); g.ellipse(x - r * 0.38, y - r * 0.5, r * 0.36, r * 0.15, -0.62, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 0.85;
  g.beginPath(); g.arc(x - r * 0.62, y - r * 0.12, r * 0.07, 0, Math.PI * 2); g.fill();
  g.restore();
  return { canvas: cv, size: size / dpr, half: (size / dpr) / 2 };
}

// The board behind the stones: its hard shadow, its feet, and the deep violet stage seen through the holes.
// → { canvas, x, y (where its top left goes, relative to the board's), w, h }
export function makeBack(L, dpr) {
  const Cc = L.C, b = L.board;
  const ox = Cc * 0.6, oy = Cc * 0.1;
  const w = b.w + SHADOW * Cc + ox * 2, h = b.h + SHADOW * Cc + FEET * Cc + oy * 2 + Cc * 0.1;
  const cv = canvasOf(w * dpr, h * dpr);
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  const x = ox, y = oy, rad = Cc * 0.34, lw = Math.max(2.2, Cc * 0.058);
  // the stand: a flared foot under each end of the board (its shadow first, then the board's, then the feet)
  const feet = [x + PAD * Cc + Cc * 0.5, x + b.w - PAD * Cc - Cc * 0.5];
  const footPath = (cx, dx, dy) => {
    const top = y + b.h - Cc * 0.25 + dy, bot = y + b.h + FEET * Cc + dy, tw = Cc * 0.42, bw = Cc * 0.72;
    g.beginPath();
    g.moveTo(cx - tw + dx, top);
    g.lineTo(cx + tw + dx, top);
    g.lineTo(cx + bw + dx, bot - Cc * 0.1);
    g.quadraticCurveTo(cx + bw + dx, bot, cx + bw - Cc * 0.1 + dx, bot);
    g.lineTo(cx - bw + Cc * 0.1 + dx, bot);
    g.quadraticCurveTo(cx - bw + dx, bot, cx - bw + dx, bot - Cc * 0.1);
    g.closePath();
  };
  g.fillStyle = INK;
  for (const fx of feet) { footPath(fx, SHADOW * Cc, SHADOW * Cc * 0.6); g.fill(); }
  roundRect(g, x + SHADOW * Cc, y + SHADOW * Cc, b.w, b.h, rad); g.fill();
  for (const fx of feet) {
    footPath(fx, 0, 0);
    g.fillStyle = C.honeyDeep; g.fill();
    g.lineWidth = lw; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke();
  }
  // the stage behind the holes
  const grd = g.createLinearGradient(0, y, 0, y + b.h);
  grd.addColorStop(0, C.stageLight); grd.addColorStop(0.55, C.stage); grd.addColorStop(1, C.stageDeep);
  g.fillStyle = grd;
  roundRect(g, x + lw, y + lw, b.w - 2 * lw, b.h - 2 * lw, rad * 0.8); g.fill();
  return { canvas: cv, dx: -ox, dy: -oy, w, h };
}

// The board's face: honey, its holes cut out, an ink outline, a little light on its top edge and a shadow inside each
// hole's top. → { canvas, dx, dy, w, h }
export function makeFace(L, dpr) {
  const Cc = L.C, b = L.board;
  const ox = 4, oy = 4;
  const w = b.w + ox * 2, h = b.h + oy * 2;
  const cv = canvasOf(w * dpr, h * dpr);
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  const x = ox, y = oy, rad = Cc * 0.34, lw = Math.max(2.2, Cc * 0.058);
  const hole = L.hole;
  const cx = (c) => x + PAD * Cc + (c + 0.5) * Cc, cy = (r) => y + PAD * Cc + (5 - r + 0.5) * Cc;
  const facePath = () => {
    g.beginPath();
    roundRect(g, x, y, b.w, b.h, rad);
    for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) { g.moveTo(cx(c) + hole, cy(r)); g.arc(cx(c), cy(r), hole, 0, Math.PI * 2); }
  };
  facePath();
  g.fillStyle = C.honey; g.fill('evenodd');
  // light along the top, a deeper honey along the bottom (inside the face only)
  g.save();
  facePath(); g.clip('evenodd');
  const sh = g.createLinearGradient(0, y, 0, y + b.h);
  sh.addColorStop(0, 'rgba(255,240,190,0.55)'); sh.addColorStop(0.08, 'rgba(255,240,190,0)');
  sh.addColorStop(0.9, 'rgba(160,100,0,0)'); sh.addColorStop(1, 'rgba(160,100,0,0.28)');
  g.fillStyle = sh; g.fillRect(x, y, b.w, b.h);
  // each hole's rim catches the light on its lower right
  g.strokeStyle = C.honeyLight; g.lineWidth = Math.max(1.2, Cc * 0.04); g.lineCap = 'round';
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
    g.beginPath(); g.arc(cx(c), cy(r), hole + Cc * 0.045, 0.1 * Math.PI, 0.45 * Math.PI); g.stroke();
  }
  g.restore();
  // inside each hole: the frame's shadow on the stone, a crescent at its top
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
    g.save();
    g.beginPath(); g.arc(cx(c), cy(r), hole, 0, Math.PI * 2); g.clip();
    g.beginPath();
    g.arc(cx(c), cy(r), hole + 1, 0, Math.PI * 2);
    g.arc(cx(c) + Cc * 0.02, cy(r) + Cc * 0.11, hole, 0, Math.PI * 2, true);
    g.fillStyle = 'rgba(12,4,32,0.42)'; g.fill();
    g.restore();
  }
  // the ink lines
  g.lineWidth = lw; g.strokeStyle = INK; g.lineJoin = 'round';
  g.beginPath(); roundRect(g, x, y, b.w, b.h, rad); g.stroke();
  g.lineWidth = lw * 0.82;
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) { g.beginPath(); g.arc(cx(c), cy(r), hole, 0, Math.PI * 2); g.stroke(); }
  return { canvas: cv, dx: -ox, dy: -oy, w, h };
}

// Her portrait: a square crop of her 2D art (head and shoulders), as a circle of diameter d → a canvas
export const PORTRAIT_CROP = { sx: 132, sy: 128, s: 312 };
export function makePortrait(img, d, dpr) {
  const size = Math.ceil(d * dpr);
  const cv = canvasOf(size, size);
  const g = cv.getContext('2d');
  g.beginPath(); g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); g.clip();
  g.fillStyle = '#2b1657'; g.fillRect(0, 0, size, size);
  const bg = g.createRadialGradient(size * 0.5, size * 0.42, size * 0.1, size * 0.5, size * 0.5, size * 0.6);
  bg.addColorStop(0, '#4a2a8a'); bg.addColorStop(1, '#22104a');
  g.fillStyle = bg; g.fillRect(0, 0, size, size);
  if (img && img.naturalWidth) {
    const { sx, sy, s } = PORTRAIT_CROP;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, sx, sy, s, s, 0, 0, size, size);
  }
  return cv;
}
