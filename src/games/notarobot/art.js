// I'M NOT A ROBOT: every picture in the game, drawn on a canvas in one chunky style ("the friendly internet"): flat
// fills, the arcade's ink outline at one weight (LW, in the check's own units, whatever the size of the thing), one
// white highlight from the top left, hard ink shadows under things that stand up. Cats, toasters, clouds, frogs, robots,
// people, bugs, traffic lights, the cursors and the hand. Each one is drawn around (x, y) at size s.
import { roundRect, star as starPath, TAU } from '../kit/fx.js';

export const INK = '#170a36';
export const LW = 2.6;
export const C = Object.freeze({
  ink: INK, ink2: '#4a3d6e', paper: '#fffaf0', white: '#ffffff', lav: '#e4d9ff', lav2: '#cdb8ff', violet: '#6b3bff',
  violet2: '#8b66ff', pink: '#ff4da6', honey: '#ffc933', mint: '#3ff0c3', red: '#ff5a5f', green: '#2fd27a', sky: '#59c8ff',
  desk: '#0f1d3a', desk2: '#16284d', desk3: '#22396b', grey: '#aab1c2', grey2: '#7d8599', metal: '#d3dae6', skin1: '#ffd9bd',
  cream: '#fff3d6', tan: '#d9a066', brown: '#9a6a43', leaf: '#4fcf6a', orange: '#ff9a3d', blush: '#ff9cc7', sky2: '#bfe8ff',
});
export const DISPLAY = "'AK Display', 'Arial Black', system-ui, sans-serif";
export const MONO = "'AK Mono', ui-monospace, Menlo, monospace";
export const SANS = "'AK Sans', ui-sans-serif, system-ui, sans-serif";
export const SERIF = "'AK Serif', Georgia, serif";

// ---------- text ----------
export function font(g, weight, size, family = DISPLAY, stretch = null) {
  g.font = `${weight} ${Math.max(1, Math.round(size * 10) / 10)}px ${family}`;
  if ('fontStretch' in g) g.fontStretch = family === DISPLAY ? (stretch || 'semi-expanded') : 'normal';
}
// sticker words: an ink shadow, an ink outline, a bright fill
export function sticker(g, text, x, y, size, fill, { stroke = INK, shadow = 0.09, outline = 0.16, align = 'center', base = 'middle', weight = 900, stretch = 'expanded', maxW = 0 } = {}) {
  font(g, weight, size, DISPLAY, stretch);
  if (maxW) {
    const w = g.measureText(text).width;
    if (w > maxW) { size *= maxW / w; font(g, weight, size, DISPLAY, stretch); }
  }
  g.textAlign = align;
  g.textBaseline = base;
  g.lineJoin = 'round';
  g.miterLimit = 2;
  g.strokeStyle = stroke;
  // (a line width of 0 is ignored by the canvas, which keeps the last one: no outline means no stroke at all)
  const lw = size * outline;
  if (lw > 0) g.lineWidth = lw;
  if (shadow) {
    g.fillStyle = stroke;
    if (lw > 0) g.strokeText(text, x, y + size * shadow);
    g.fillText(text, x, y + size * shadow);
  }
  if (lw > 0) g.strokeText(text, x, y);
  g.fillStyle = fill;
  g.fillText(text, x, y);
  return size;
}
export function words(g, text, x, y, size, color = INK, { family = SANS, weight = 700, align = 'center', base = 'middle', maxW = 0, stretch = null } = {}) {
  font(g, weight, size, family, stretch);
  if (maxW) {
    const w = g.measureText(text).width;
    if (w > maxW) font(g, weight, size * maxW / w, family, stretch);
  }
  g.textAlign = align;
  g.textBaseline = base;
  g.fillStyle = color;
  g.fillText(text, x, y);
}

// ---------- paths and fills ----------
export function inked(g, fill, lw = LW) {
  if (fill) { g.fillStyle = fill; g.fill(); }
  g.lineWidth = lw;
  g.strokeStyle = INK;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.stroke();
}
export function rr(g, x, y, w, h, r) { roundRect(g, x, y, w, h, r); }
export function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, Math.max(0.1, r), 0, TAU); }
export function ellipse(g, x, y, rx, ry, rot = 0) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); }
// a card that stands up off the page: a hard ink shadow, then the card
export function card(g, x, y, w, h, r, fill, { off = 4, lw = LW } = {}) {
  if (off) { rr(g, x + off * 0.6, y + off, w, h, r); g.fillStyle = INK; g.fill(); }
  rr(g, x, y, w, h, r);
  inked(g, fill, lw);
}
// the light from the top left: a short white arc inside a round shape
export function shine(g, x, y, r, { a0 = 3.55, a1 = 4.35, w = 0.16, alpha = 0.85 } = {}) {
  g.save();
  g.globalAlpha *= alpha;
  g.strokeStyle = C.white;
  g.lineCap = 'round';
  g.lineWidth = Math.max(1.6, r * w);
  g.beginPath();
  g.arc(x, y, r * 0.7, a0, a1);
  g.stroke();
  g.restore();
}
export function shineLine(g, x1, y1, x2, y2, w = 3.2, alpha = 0.85) {
  g.save();
  g.globalAlpha *= alpha;
  g.strokeStyle = C.white; g.lineCap = 'round'; g.lineWidth = w;
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  g.restore();
}
function dot(g, x, y, r, fill = INK) { circle(g, x, y, r); g.fillStyle = fill; g.fill(); }
function line(g, pts, lw = LW, color = INK) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.lineWidth = lw; g.strokeStyle = color; g.lineCap = 'round'; g.lineJoin = 'round';
  g.stroke();
}

// ---------- the sticker button (the kit's buttons, on the canvas) ----------
export function button(g, x, y, w, h, text, { fill = C.honey, press = 0, size = 0, r = null, color = INK, off = 5, family = DISPLAY } = {}) {
  const p = Math.min(1, Math.max(0, press));
  const dy = off * 0.8 * p;
  const rad = r ?? h / 2;
  rr(g, x, y + off, w, h, rad); g.fillStyle = INK; g.fill();
  rr(g, x, y + dy, w, h, rad);
  inked(g, fill, LW + 0.4);
  if (text) {
    const fs = size || h * 0.42;
    if (family === DISPLAY) font(g, 900, fs, DISPLAY, 'expanded'); else font(g, 750, fs, family);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = color;
    g.fillText(text, x + w / 2, y + h / 2 + dy + fs * 0.04);
  }
}

// ---------- marks ----------
export function check(g, x, y, s, fill = C.mint, k = 1) {
  const w = s * 0.24;
  const pts = [x - s * 0.36, y + s * 0.02, x - s * 0.1, y + s * 0.28, x + s * 0.4, y - s * 0.3];
  // drawn up to k (0..1) of its length: the tick being made
  const a = Math.hypot(pts[2] - pts[0], pts[3] - pts[1]), b = Math.hypot(pts[4] - pts[2], pts[5] - pts[3]);
  const L = (a + b) * Math.max(0, Math.min(1, k));
  const path = () => {
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    if (L <= a) { g.lineTo(pts[0] + (pts[2] - pts[0]) * L / a, pts[1] + (pts[3] - pts[1]) * L / a); return; }
    g.lineTo(pts[2], pts[3]);
    const u = (L - a) / b;
    g.lineTo(pts[2] + (pts[4] - pts[2]) * u, pts[3] + (pts[5] - pts[3]) * u);
  };
  if (L <= 0.5) return;
  g.lineCap = 'round'; g.lineJoin = 'round';
  path(); g.strokeStyle = INK; g.lineWidth = w + LW * 2; g.stroke();
  path(); g.strokeStyle = fill; g.lineWidth = w; g.stroke();
}
export function cross(g, x, y, s, fill = C.pink) {
  const w = s * 0.22, d = s * 0.32;
  for (const [lw, col] of [[w + LW * 2, INK], [w, fill]]) {
    g.lineCap = 'round'; g.strokeStyle = col; g.lineWidth = lw;
    g.beginPath(); g.moveTo(x - d, y - d); g.lineTo(x + d, y + d); g.moveTo(x + d, y - d); g.lineTo(x - d, y + d); g.stroke();
  }
}
export function heartPath(g, x, y, s) {
  const w = s * 0.5;
  g.beginPath();
  g.moveTo(x, y + s * 0.42);
  g.bezierCurveTo(x - w * 1.1, y - s * 0.05, x - w * 0.95, y - s * 0.5, x, y - s * 0.2);
  g.bezierCurveTo(x + w * 0.95, y - s * 0.5, x + w * 1.1, y - s * 0.05, x, y + s * 0.42);
  g.closePath();
}

// ---------- cursors ----------
// the arrow cursor, its tip at (x, y)
export function arrowCursor(g, x, y, s, fill = C.white) {
  const k = s / 20;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x, y + 17 * k);
  g.lineTo(x + 4.2 * k, y + 13.2 * k);
  g.lineTo(x + 7.2 * k, y + 19.6 * k);
  g.lineTo(x + 10.2 * k, y + 18.2 * k);
  g.lineTo(x + 7.3 * k, y + 12 * k);
  g.lineTo(x + 12.4 * k, y + 12 * k);
  g.closePath();
  inked(g, fill, Math.max(1.6, LW * 0.8));
}
// the pointing hand (the demo's player, the hint icons): its fingertip at (x, y)
export function hand(g, x, y, s, { press = 0, fill = C.white, angle = -0.2 } = {}) {
  const k = s / 44;
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.scale(k * (1 - press * 0.08), k * (1 - press * 0.08));
  const lw = LW / k * 0.95;
  // index finger, then the fist
  g.beginPath();
  g.moveTo(-5.5, 3);
  g.arcTo(-5.5, -4, 0, -4, 5.5);
  g.arcTo(5.5, -4, 5.5, 3, 5.5);
  g.lineTo(5.5, 18);
  // the folded fingers' knuckles
  g.quadraticCurveTo(8, 14.5, 11, 15);
  g.quadraticCurveTo(15.5, 15.8, 15.6, 20);
  g.quadraticCurveTo(19.2, 18.6, 21.4, 22);
  g.quadraticCurveTo(25.4, 22, 25.4, 27);
  g.lineTo(25.4, 34);
  g.quadraticCurveTo(25, 46, 12, 47);
  g.lineTo(2, 47);
  g.quadraticCurveTo(-8, 46.5, -12, 38);
  // the thumb
  g.lineTo(-17.5, 27);
  g.quadraticCurveTo(-19.5, 22, -15, 21);
  g.quadraticCurveTo(-11, 20.5, -8.5, 25.5);
  g.lineTo(-5.5, 30);
  g.closePath();
  g.fillStyle = fill; g.fill();
  g.lineWidth = lw; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke();
  // knuckle creases and the cuff
  line(g, [5.5, 21, 5.5, 26], lw * 0.8);
  line(g, [15.6, 22, 15.6, 27], lw * 0.8);
  g.globalAlpha *= 0.85;
  line(g, [-2.8, 1, -2.8, 9], lw * 0.9, C.white);
  g.restore();
}

// ---------- the pictures ----------
// her cat: a fluffy grey striped head
export function cat(g, x, y, s, { mood = 0, blink = 0, color = C.grey } = {}) {
  const r = s * 0.42;
  // ears
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(x + sx * r * 0.92, y - r * 0.28);
    g.lineTo(x + sx * r * 0.82, y - r * 1.2);
    g.lineTo(x + sx * r * 0.18, y - r * 0.82);
    g.closePath();
    inked(g, color);
    g.beginPath();
    g.moveTo(x + sx * r * 0.76, y - r * 0.45);
    g.lineTo(x + sx * r * 0.74, y - r * 0.98);
    g.lineTo(x + sx * r * 0.38, y - r * 0.74);
    g.closePath();
    g.fillStyle = C.blush; g.fill();
  }
  ellipse(g, x, y, r, r * 0.86);
  inked(g, color);
  // stripes
  g.save();
  ellipse(g, x, y, r - LW / 2, r * 0.86 - LW / 2); g.clip();
  g.strokeStyle = C.grey2; g.lineCap = 'round'; g.lineWidth = r * 0.12;
  g.beginPath();
  g.moveTo(x, y - r * 0.86); g.lineTo(x, y - r * 0.5);
  g.moveTo(x - r * 0.26, y - r * 0.82); g.lineTo(x - r * 0.2, y - r * 0.56);
  g.moveTo(x + r * 0.26, y - r * 0.82); g.lineTo(x + r * 0.2, y - r * 0.56);
  g.moveTo(x - r * 1.02, y + r * 0.02); g.lineTo(x - r * 0.72, y + r * 0.06);
  g.moveTo(x + r * 1.02, y + r * 0.02); g.lineTo(x + r * 0.72, y + r * 0.06);
  g.stroke();
  // a pale muzzle
  ellipse(g, x, y + r * 0.34, r * 0.46, r * 0.32); g.fillStyle = C.cream; g.fill();
  g.restore();
  // eyes
  const ey = y - r * 0.04, ex = r * 0.4;
  if (blink > 0.5 || mood > 0.5) {
    for (const sx of [-1, 1]) {
      g.beginPath(); g.arc(x + sx * ex, ey + r * 0.06, r * 0.13, Math.PI * 1.1, Math.PI * 1.9);
      g.lineWidth = LW; g.strokeStyle = INK; g.lineCap = 'round'; g.stroke();
    }
  } else {
    for (const sx of [-1, 1]) {
      ellipse(g, x + sx * ex, ey, r * 0.14, r * 0.17); g.fillStyle = INK; g.fill();
      dot(g, x + sx * ex - r * 0.04, ey - r * 0.06, r * 0.05, C.white);
    }
  }
  // nose and mouth
  g.beginPath();
  g.moveTo(x - r * 0.1, y + r * 0.2); g.lineTo(x + r * 0.1, y + r * 0.2); g.lineTo(x, y + r * 0.31); g.closePath();
  g.fillStyle = C.pink; g.fill();
  g.lineWidth = LW * 0.7; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke();
  g.beginPath();
  g.moveTo(x - r * 0.18, y + r * 0.42);
  g.quadraticCurveTo(x - r * 0.09, y + r * 0.5, x, y + r * 0.34);
  g.quadraticCurveTo(x + r * 0.09, y + r * 0.5, x + r * 0.18, y + r * 0.42);
  g.lineWidth = LW * 0.8; g.stroke();
  // whiskers
  g.lineWidth = LW * 0.6;
  g.beginPath();
  for (const sx of [-1, 1]) {
    g.moveTo(x + sx * r * 0.5, y + r * 0.3); g.lineTo(x + sx * r * 1.15, y + r * 0.2);
    g.moveTo(x + sx * r * 0.5, y + r * 0.4); g.lineTo(x + sx * r * 1.12, y + r * 0.46);
  }
  g.stroke();
  shine(g, x - r * 0.05, y - r * 0.05, r, { a0: 3.75, a1: 4.4, w: 0.13 });
}

export function dog(g, x, y, s) {
  const r = s * 0.42;
  ellipse(g, x, y, r * 0.95, r * 0.88); inked(g, C.tan);
  // floppy ears
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(x + sx * r * 0.55, y - r * 0.7);
    g.quadraticCurveTo(x + sx * r * 1.35, y - r * 0.6, x + sx * r * 1.12, y + r * 0.35);
    g.quadraticCurveTo(x + sx * r * 0.85, y + r * 0.5, x + sx * r * 0.7, y + r * 0.1);
    g.closePath();
    inked(g, C.brown);
  }
  ellipse(g, x, y + r * 0.35, r * 0.48, r * 0.36); inked(g, C.cream, LW * 0.8);
  for (const sx of [-1, 1]) { dot(g, x + sx * r * 0.36, y - r * 0.12, r * 0.12); dot(g, x + sx * r * 0.33, y - r * 0.17, r * 0.04, C.white); }
  ellipse(g, x, y + r * 0.2, r * 0.17, r * 0.12); g.fillStyle = INK; g.fill();
  g.beginPath(); g.moveTo(x, y + r * 0.3); g.lineTo(x, y + r * 0.44); g.lineWidth = LW * 0.8; g.strokeStyle = INK; g.stroke();
  // tongue
  g.beginPath(); g.moveTo(x - r * 0.12, y + r * 0.5); g.quadraticCurveTo(x, y + r * 0.86, x + r * 0.12, y + r * 0.5); g.closePath(); inked(g, C.pink, LW * 0.7);
  shine(g, x, y - r * 0.05, r, { a0: 3.8, a1: 4.4, w: 0.13 });
}

export function toaster(g, x, y, s, { pop = 0 } = {}) {
  const w = s * 0.86, h = s * 0.56;
  // two slices of toast
  for (const sx of [-1, 1]) {
    const tx = x + sx * w * 0.2, ty = y - h * 0.42 - pop * s * 0.12;
    rr(g, tx - w * 0.15, ty - h * 0.3, w * 0.3, h * 0.6, w * 0.08);
    inked(g, '#f1c27d');
    rr(g, tx - w * 0.1, ty - h * 0.24, w * 0.2, h * 0.4, w * 0.05); g.fillStyle = '#ffe2b0'; g.fill();
  }
  rr(g, x - w / 2, y - h * 0.35, w, h, h * 0.3);
  inked(g, C.metal);
  // slots, lever, dial
  for (const sx of [-1, 1]) { rr(g, x + sx * w * 0.2 - w * 0.13, y - h * 0.3, w * 0.26, h * 0.08, 3); g.fillStyle = INK; g.fill(); }
  rr(g, x + w * 0.47, y - h * 0.1, w * 0.1, h * 0.14, 3); inked(g, C.pink, LW * 0.8);
  circle(g, x, y + h * 0.18, h * 0.1); inked(g, C.honey, LW * 0.8);
  // feet
  for (const sx of [-1, 1]) { rr(g, x + sx * w * 0.32 - w * 0.07, y + h * 0.62, w * 0.14, h * 0.12, 3); g.fillStyle = INK; g.fill(); }
  shineLine(g, x - w * 0.36, y - h * 0.12, x - w * 0.36, y + h * 0.3, LW * 1.4);
}

export function cloud(g, x, y, s) {
  const blobs = [[-0.24, 0.06, 0.24], [0.02, -0.12, 0.3], [0.27, 0.05, 0.22], [0.02, 0.14, 0.22]];
  for (const [bx, by, br] of blobs) { circle(g, x + bx * s, y + by * s, br * s + LW); g.fillStyle = INK; g.fill(); }
  for (const [bx, by, br] of blobs) { circle(g, x + bx * s, y + by * s, br * s); g.fillStyle = C.white; g.fill(); }
  // a lavender shade underneath
  g.save();
  for (const [bx, by, br] of blobs) { circle(g, x + bx * s, y + by * s, br * s); }
  g.restore();
  ellipse(g, x + s * 0.02, y + s * 0.24, s * 0.34, s * 0.07); g.fillStyle = C.lav; g.fill();
  shine(g, x + s * 0.02, y - s * 0.12, s * 0.3, { a0: 3.6, a1: 4.6, w: 0.14, alpha: 0 });
  // little face (clouds are friendly)
  dot(g, x - s * 0.08, y + s * 0.04, s * 0.03); dot(g, x + s * 0.1, y + s * 0.04, s * 0.03);
  g.beginPath(); g.arc(x + s * 0.01, y + s * 0.07, s * 0.05, 0.2, Math.PI - 0.2); g.lineWidth = LW * 0.7; g.strokeStyle = INK; g.stroke();
}

export function frog(g, x, y, s) {
  const r = s * 0.42;
  // eye bumps
  for (const sx of [-1, 1]) { circle(g, x + sx * r * 0.52, y - r * 0.55, r * 0.36); inked(g, C.leaf); }
  ellipse(g, x, y + r * 0.08, r * 1.02, r * 0.72); inked(g, C.leaf);
  for (const sx of [-1, 1]) {
    circle(g, x + sx * r * 0.52, y - r * 0.58, r * 0.22); inked(g, C.white, LW * 0.8);
    dot(g, x + sx * r * 0.52, y - r * 0.55, r * 0.11);
  }
  g.beginPath(); g.moveTo(x - r * 0.55, y + r * 0.12); g.quadraticCurveTo(x, y + r * 0.55, x + r * 0.55, y + r * 0.12);
  g.lineWidth = LW; g.strokeStyle = INK; g.lineCap = 'round'; g.stroke();
  for (const sx of [-1, 1]) { ellipse(g, x + sx * r * 0.68, y + r * 0.18, r * 0.14, r * 0.08); g.fillStyle = C.blush; g.fill(); }
  shine(g, x - r * 0.05, y + r * 0.05, r * 0.95, { a0: 3.5, a1: 4.1, w: 0.13 });
}

export function owl(g, x, y, s) {
  const r = s * 0.42;
  g.beginPath();
  g.moveTo(x - r * 0.85, y - r * 0.35); g.lineTo(x - r * 0.7, y - r * 1.05); g.lineTo(x - r * 0.3, y - r * 0.75);
  g.lineTo(x + r * 0.3, y - r * 0.75); g.lineTo(x + r * 0.7, y - r * 1.05); g.lineTo(x + r * 0.85, y - r * 0.35);
  g.quadraticCurveTo(x + r * 1.05, y + r * 0.9, x, y + r * 0.95);
  g.quadraticCurveTo(x - r * 1.05, y + r * 0.9, x - r * 0.85, y - r * 0.35);
  g.closePath();
  inked(g, C.brown);
  for (const sx of [-1, 1]) { circle(g, x + sx * r * 0.36, y - r * 0.2, r * 0.3); inked(g, C.honey, LW * 0.8); dot(g, x + sx * r * 0.36, y - r * 0.2, r * 0.13); }
  g.beginPath(); g.moveTo(x - r * 0.1, y + r * 0.08); g.lineTo(x + r * 0.1, y + r * 0.08); g.lineTo(x, y + r * 0.3); g.closePath(); inked(g, C.orange, LW * 0.7);
  shine(g, x, y, r, { a0: 3.7, a1: 4.3, w: 0.12 });
}

// a robot head and shoulders (FIND THE BOT, the bubbles, the end of a run)
export function robot(g, x, y, s, { mustache = false, blink = 0, color = '#c9d1e3', eye = C.mint, t = 0 } = {}) {
  const w = s * 0.62, h = s * 0.5;
  const top = y - h * 0.62;
  // antenna
  line(g, [x, top, x, top - s * 0.17]);
  circle(g, x, top - s * 0.2, s * 0.07); inked(g, C.pink, LW * 0.9);
  // shoulders
  rr(g, x - w * 0.72, y + h * 0.42, w * 1.44, h * 0.5, h * 0.22); inked(g, C.violet2);
  // ear bolts
  for (const sx of [-1, 1]) { rr(g, x + sx * w * 0.5 - (sx < 0 ? w * 0.14 : 0), y - h * 0.22, w * 0.14, h * 0.34, 3); inked(g, C.grey); }
  rr(g, x - w / 2, top, w, h, h * 0.2);
  inked(g, color);
  // eyes: square, glowing
  const ey = top + h * 0.38;
  for (const sx of [-1, 1]) {
    const bw = w * 0.2, bh = blink > 0.5 ? h * 0.05 : w * 0.2;
    rr(g, x + sx * w * 0.2 - bw / 2, ey - bh / 2, bw, bh, 2.5); inked(g, eye, LW * 0.8);
  }
  // grille mouth
  rr(g, x - w * 0.24, top + h * 0.66, w * 0.48, h * 0.16, 3); inked(g, C.white, LW * 0.8);
  g.beginPath();
  for (let i = 1; i < 4; i++) { const lx = x - w * 0.24 + (w * 0.48 * i) / 4; g.moveTo(lx, top + h * 0.66); g.lineTo(lx, top + h * 0.82); }
  g.lineWidth = LW * 0.6; g.strokeStyle = INK; g.stroke();
  if (mustache) moustache(g, x, top + h * 0.6, w * 0.62, Math.sin(t * 9) * 0.08);
  shineLine(g, x - w * 0.36, top + h * 0.2, x - w * 0.36, top + h * 0.55, LW * 1.2);
}

// the cardboard "human disguise" mustache (her, and the robot hiding in the crowd)
export function moustache(g, x, y, w, rot = 0, fill = '#b98a52') {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  const h = w * 0.34;
  g.beginPath();
  g.moveTo(0, -h * 0.2);
  g.bezierCurveTo(w * 0.18, -h * 0.75, w * 0.42, -h * 0.55, w * 0.5, -h * 0.05);
  g.bezierCurveTo(w * 0.56, h * 0.25, w * 0.4, h * 0.32, w * 0.36, h * 0.05);
  g.bezierCurveTo(w * 0.26, h * 0.28, w * 0.1, h * 0.25, 0, h * 0.08);
  g.bezierCurveTo(-w * 0.1, h * 0.25, -w * 0.26, h * 0.28, -w * 0.36, h * 0.05);
  g.bezierCurveTo(-w * 0.4, h * 0.32, -w * 0.56, h * 0.25, -w * 0.5, -h * 0.05);
  g.bezierCurveTo(-w * 0.42, -h * 0.55, -w * 0.18, -h * 0.75, 0, -h * 0.2);
  g.closePath();
  inked(g, fill, Math.max(1.4, Math.min(LW, w * 0.06)));
  // cardboard: a corrugated edge line
  g.globalAlpha *= 0.55;
  g.beginPath(); g.moveTo(-w * 0.32, -h * 0.12); g.quadraticCurveTo(0, -h * 0.02, w * 0.32, -h * 0.12);
  g.lineWidth = Math.max(1, w * 0.035); g.strokeStyle = '#7d5a2f'; g.stroke();
  g.restore();
}

const SKINS = ['#ffd9bd', '#f2b98f', '#d18f62', '#a8673f', '#7a4a2d', '#ffe6d1'];
const HAIRS = ['#2b1d16', '#5a3725', '#e9c46a', '#c0503a', '#1b1b2f', '#8b5cf6', '#f4a3c4'];
const SHIRTS = [C.pink, C.sky, C.honey, C.mint, C.violet2, C.orange, C.lav2, C.green];
export const LOOKS = { skins: SKINS.length, hairs: HAIRS.length, shirts: SHIRTS.length, styles: 4 };
// a little person in the crowd (look: { skin, hair, shirt, style } as indexes)
export function person(g, x, y, s, look, { blink = 0 } = {}) {
  const r = s * 0.25;
  const skin = SKINS[look.skin % SKINS.length], hair = HAIRS[look.hair % HAIRS.length], shirt = SHIRTS[look.shirt % SHIRTS.length];
  // body
  g.beginPath();
  g.moveTo(x - r * 1.45, y + s * 0.5);
  g.quadraticCurveTo(x - r * 1.45, y + r * 0.75, x, y + r * 0.75);
  g.quadraticCurveTo(x + r * 1.45, y + r * 0.75, x + r * 1.45, y + s * 0.5);
  g.closePath();
  inked(g, shirt);
  const hy = y - r * 0.15;
  // long hair behind the head
  if (look.style === 2) { rr(g, x - r * 1.08, hy - r * 0.6, r * 2.16, r * 1.85, r * 0.8); inked(g, hair); }
  circle(g, x, hy, r); inked(g, skin);
  // hair on top
  g.beginPath();
  if (look.style === 0) { g.arc(x, hy, r, Math.PI * 1.02, Math.PI * 1.98); g.quadraticCurveTo(x, hy - r * 0.3, x - r, hy - r * 0.05); }
  else if (look.style === 1) { circle(g, x, hy - r * 1.05, r * 0.42); inked(g, hair, LW * 0.9); g.beginPath(); g.arc(x, hy, r, Math.PI * 1.05, Math.PI * 1.95); g.quadraticCurveTo(x, hy - r * 0.45, x - r, hy - r * 0.1); }
  else if (look.style === 2) { g.arc(x, hy, r, Math.PI * 1.0, Math.PI * 2.0); g.quadraticCurveTo(x + r * 0.2, hy - r * 0.25, x - r * 0.05, hy - r * 0.55); g.quadraticCurveTo(x - r * 0.4, hy - r * 0.2, x - r, hy); }
  else { for (const [bx, by] of [[-0.6, -0.7], [0, -0.95], [0.6, -0.7], [-0.9, -0.2], [0.9, -0.2]]) { g.moveTo(x + bx * r + r * 0.42, hy + by * r); g.arc(x + bx * r, hy + by * r, r * 0.42, 0, TAU); } }
  g.closePath();
  inked(g, hair, LW * 0.9);
  // face
  const ey = hy + r * 0.12;
  if (blink > 0.5) {
    g.beginPath(); g.moveTo(x - r * 0.48, ey); g.lineTo(x - r * 0.2, ey); g.moveTo(x + r * 0.2, ey); g.lineTo(x + r * 0.48, ey);
    g.lineWidth = LW * 0.7; g.strokeStyle = INK; g.stroke();
  } else {
    dot(g, x - r * 0.34, ey, r * 0.12); dot(g, x + r * 0.34, ey, r * 0.12);
  }
  g.beginPath(); g.arc(x, ey + r * 0.22, r * 0.24, 0.35, Math.PI - 0.35); g.lineWidth = LW * 0.7; g.strokeStyle = INK; g.lineCap = 'round'; g.stroke();
}

// a software bug: a round red beetle with spots, facing `rot` (radians, 0 = right)
export function bug(g, x, y, s, rot = 0, t = 0, { splat = 0 } = {}) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  const r = s * 0.42;
  if (splat > 0) {
    g.scale(1 + splat * 0.35, 1 - splat * 0.55);
  }
  // legs (they scuttle)
  g.beginPath();
  for (let i = -1; i <= 1; i++) {
    const wig = Math.sin(t * 22 + i * 2) * r * 0.18 * (1 - splat);
    for (const sy of [-1, 1]) { g.moveTo(i * r * 0.5, sy * r * 0.5); g.lineTo(i * r * 0.62 + wig * sy, sy * r * 1.05); }
  }
  g.lineWidth = LW * 0.9; g.strokeStyle = INK; g.lineCap = 'round'; g.stroke();
  // antennae
  g.beginPath(); g.moveTo(r * 0.9, -r * 0.2); g.quadraticCurveTo(r * 1.3, -r * 0.3, r * 1.4, -r * 0.6); g.moveTo(r * 0.9, r * 0.2); g.quadraticCurveTo(r * 1.3, r * 0.3, r * 1.4, r * 0.6); g.stroke();
  circle(g, r * 0.88, 0, r * 0.4); inked(g, INK);
  ellipse(g, -r * 0.05, 0, r * 0.95, r * 0.82); inked(g, C.red);
  g.beginPath(); g.moveTo(r * 0.48, 0); g.lineTo(-r * 0.98, 0); g.lineWidth = LW * 0.8; g.stroke();
  for (const [sx, sy, sr] of [[-0.4, -0.38, 0.16], [0.15, -0.42, 0.13], [-0.45, 0.38, 0.14], [0.12, 0.44, 0.13]]) dot(g, sx * r, sy * r, sr * r);
  dot(g, r * 1.02, -r * 0.16, r * 0.08, C.white); dot(g, r * 1.02, r * 0.16, r * 0.08, C.white);
  shine(g, -r * 0.05, 0, r * 0.9, { a0: 3.6, a1: 4.2, w: 0.14 });
  g.restore();
}

// the street (HOW MANY?)
export function trafficLight(g, x, y, s, lit = -1) {
  const w = s * 0.34, h = s * 0.78;
  rr(g, x - s * 0.04, y + h * 0.4, s * 0.08, s * 0.5, 2); inked(g, C.grey2);
  rr(g, x - w / 2, y - h * 0.6, w, h, w * 0.28); inked(g, '#3b3460');
  const cols = [C.red, C.honey, C.green];
  for (let i = 0; i < 3; i++) {
    circle(g, x, y - h * 0.6 + h * (0.19 + i * 0.31), w * 0.3);
    inked(g, lit < 0 || lit === i ? cols[i] : '#5b5480', LW * 0.75);
  }
}
export function tree(g, x, y, s) {
  rr(g, x - s * 0.07, y, s * 0.14, s * 0.42, 3); inked(g, C.brown);
  const blobs = [[-0.18, -0.08, 0.2], [0.18, -0.08, 0.2], [0, -0.28, 0.24], [0, 0.02, 0.2]];
  for (const [bx, by, br] of blobs) { circle(g, x + bx * s, y + by * s, br * s + LW); g.fillStyle = INK; g.fill(); }
  for (const [bx, by, br] of blobs) { circle(g, x + bx * s, y + by * s, br * s); g.fillStyle = C.leaf; g.fill(); }
  shine(g, x - s * 0.04, y - s * 0.24, s * 0.22, { a0: 3.6, a1: 4.4, w: 0.16 });
}
export function cone(g, x, y, s) {
  g.beginPath(); g.moveTo(x - s * 0.08, y - s * 0.36); g.lineTo(x + s * 0.08, y - s * 0.36); g.lineTo(x + s * 0.24, y + s * 0.3); g.lineTo(x - s * 0.24, y + s * 0.3); g.closePath();
  inked(g, C.orange);
  g.beginPath(); g.moveTo(x - s * 0.14, y - s * 0.08); g.lineTo(x + s * 0.14, y - s * 0.08); g.lineTo(x + s * 0.17, y + s * 0.06); g.lineTo(x - s * 0.17, y + s * 0.06); g.closePath(); g.fillStyle = C.white; g.fill();
  rr(g, x - s * 0.32, y + s * 0.28, s * 0.64, s * 0.1, 3); inked(g, C.orange);
}
export function lamp(g, x, y, s) {
  rr(g, x - s * 0.035, y - s * 0.36, s * 0.07, s * 0.8, 2); inked(g, C.grey2);
  g.beginPath(); g.moveTo(x, y - s * 0.36); g.quadraticCurveTo(x, y - s * 0.52, x + s * 0.2, y - s * 0.5); g.lineWidth = LW * 1.6; g.strokeStyle = INK; g.stroke();
  ellipse(g, x + s * 0.22, y - s * 0.46, s * 0.12, s * 0.07); inked(g, C.honey, LW * 0.8);
}
export function house(g, x, y, s) {
  const w = s * 0.62;
  rr(g, x - w / 2, y - s * 0.12, w, s * 0.5, 4); inked(g, C.cream);
  g.beginPath(); g.moveTo(x - w * 0.66, y - s * 0.08); g.lineTo(x, y - s * 0.48); g.lineTo(x + w * 0.66, y - s * 0.08); g.closePath(); inked(g, C.pink);
  rr(g, x - w * 0.12, y + s * 0.1, w * 0.24, s * 0.28, 3); inked(g, C.violet2, LW * 0.8);
  rr(g, x + w * 0.18, y - s * 0.02, w * 0.2, w * 0.2, 3); inked(g, C.sky2, LW * 0.8);
}
export function rocket(g, x, y, s) {
  const w = s * 0.32;
  g.beginPath(); g.moveTo(x - w * 0.8, y + s * 0.3); g.lineTo(x - w * 0.5, y + s * 0.02); g.lineTo(x - w * 0.5, y + s * 0.32); g.closePath(); inked(g, C.pink);
  g.beginPath(); g.moveTo(x + w * 0.8, y + s * 0.3); g.lineTo(x + w * 0.5, y + s * 0.02); g.lineTo(x + w * 0.5, y + s * 0.32); g.closePath(); inked(g, C.pink);
  g.beginPath(); g.moveTo(x - w * 0.3, y + s * 0.34); g.quadraticCurveTo(x, y + s * 0.62, x + w * 0.3, y + s * 0.34); g.closePath(); inked(g, C.honey);
  g.beginPath(); g.moveTo(x, y - s * 0.48); g.quadraticCurveTo(x + w * 0.62, y - s * 0.22, x + w * 0.5, y + s * 0.36); g.lineTo(x - w * 0.5, y + s * 0.36); g.quadraticCurveTo(x - w * 0.62, y - s * 0.22, x, y - s * 0.48); g.closePath();
  inked(g, C.white);
  circle(g, x, y - s * 0.08, w * 0.24); inked(g, C.sky, LW * 0.8);
  shineLine(g, x - w * 0.3, y - s * 0.18, x - w * 0.34, y + s * 0.18, LW * 1.2);
}
export function icecream(g, x, y, s) {
  g.beginPath(); g.moveTo(x - s * 0.2, y - s * 0.02); g.lineTo(x + s * 0.2, y - s * 0.02); g.lineTo(x, y + s * 0.5); g.closePath(); inked(g, C.honey);
  g.save(); g.clip();
  g.beginPath();
  for (let i = -3; i <= 3; i++) { g.moveTo(x + i * s * 0.09 - s * 0.2, y - s * 0.02); g.lineTo(x + i * s * 0.09 + s * 0.2, y + s * 0.5); g.moveTo(x + i * s * 0.09 + s * 0.2, y - s * 0.02); g.lineTo(x + i * s * 0.09 - s * 0.2, y + s * 0.5); }
  g.lineWidth = LW * 0.5; g.strokeStyle = '#c48a1d'; g.stroke();
  g.restore();
  circle(g, x, y - s * 0.16, s * 0.24); inked(g, C.pink);
  circle(g, x + s * 0.04, y - s * 0.44, s * 0.07); inked(g, C.red, LW * 0.8);
  shine(g, x, y - s * 0.16, s * 0.24, { a0: 3.5, a1: 4.4, w: 0.16 });
}
export function fish(g, x, y, s, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.beginPath(); g.moveTo(-s * 0.28, 0); g.lineTo(-s * 0.5, -s * 0.2); g.lineTo(-s * 0.5, s * 0.2); g.closePath(); inked(g, C.sky);
  ellipse(g, 0, 0, s * 0.34, s * 0.2); inked(g, C.sky);
  dot(g, s * 0.18, -s * 0.04, s * 0.04);
  g.beginPath(); g.arc(-s * 0.02, 0, s * 0.12, -0.9, 0.9); g.lineWidth = LW * 0.6; g.strokeStyle = INK; g.stroke();
  g.restore();
}

// shapes for ODD ONE (one family each, so only one thing differs)
export function shape(g, kind, x, y, s, fill, rot = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  const r = s * 0.42;
  switch (kind) {
    case 'circle': circle(g, 0, 0, r); break;
    case 'square': rr(g, -r * 0.88, -r * 0.88, r * 1.76, r * 1.76, r * 0.22); break;
    case 'triangle': g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 0.98, r * 0.72); g.lineTo(-r * 0.98, r * 0.72); g.closePath(); break;
    case 'star': starPath(g, 0, 0, r * 1.08, r * 0.48, 5, 0); break;
    case 'heart': heartPath(g, 0, r * 0.05, r * 2); break;
    case 'diamond': g.beginPath(); g.moveTo(0, -r * 1.05); g.lineTo(r * 0.78, 0); g.lineTo(0, r * 1.05); g.lineTo(-r * 0.78, 0); g.closePath(); break;
    case 'arrow':
      g.beginPath(); g.moveTo(r, 0); g.lineTo(0, -r * 0.85); g.lineTo(0, -r * 0.36); g.lineTo(-r * 0.92, -r * 0.36); g.lineTo(-r * 0.92, r * 0.36); g.lineTo(0, r * 0.36); g.lineTo(0, r * 0.85); g.closePath(); break;
    case 'moon':
      g.beginPath(); g.arc(0, 0, r, Math.PI * 0.32, Math.PI * 1.68); g.arc(r * 0.5, 0, r * 0.82, Math.PI * 1.45, Math.PI * 0.55, true); g.closePath(); break;
    default: circle(g, 0, 0, r);
  }
  inked(g, fill, LW + 0.2);
  g.restore();
}

// a round human face (SMILE!, SHAKE NO!): smile from -1 (frown) to 1 (grin); turn from -1 to 1 (looking aside)
export function face(g, x, y, s, { smile = 0, turn = 0, skin = '#ffd9bd', hair = '#5a3725', blush = 0, sweat = 0, happy = false } = {}) {
  const r = s * 0.46;
  const tx = turn * r * 0.32;
  // ears
  for (const sx of [-1, 1]) { circle(g, x + sx * r * 0.98 - tx * 0.4, y + r * 0.08, r * 0.16); inked(g, skin); }
  circle(g, x, y, r); inked(g, skin);
  // hair cap
  g.beginPath();
  g.arc(x, y, r, Math.PI * 1.06, Math.PI * 1.94);
  g.quadraticCurveTo(x + tx + r * 0.3, y - r * 0.5, x + tx - r * 0.1, y - r * 0.72);
  g.quadraticCurveTo(x + tx - r * 0.4, y - r * 0.45, x - r * 0.98, y - r * 0.2);
  g.closePath();
  inked(g, hair);
  const ey = y + r * 0.02;
  for (const sx of [-1, 1]) {
    const ex = x + tx + sx * r * 0.36;
    if (happy) {
      g.beginPath(); g.arc(ex, ey + r * 0.08, r * 0.13, Math.PI * 1.15, Math.PI * 1.85); g.lineWidth = LW; g.strokeStyle = INK; g.lineCap = 'round'; g.stroke();
    } else {
      ellipse(g, ex, ey, r * 0.1, r * 0.13); g.fillStyle = INK; g.fill();
      dot(g, ex - r * 0.03, ey - r * 0.05, r * 0.035, C.white);
    }
  }
  if (blush > 0) {
    g.save(); g.globalAlpha *= Math.min(1, blush);
    for (const sx of [-1, 1]) { ellipse(g, x + tx + sx * r * 0.58, ey + r * 0.28, r * 0.15, r * 0.08); g.fillStyle = C.blush; g.fill(); }
    g.restore();
  }
  // the mouth: a curve whose corners rise with `smile`
  const mw = r * 0.46, my = y + r * 0.45, sm = Math.max(-1, Math.min(1, smile));
  const cy = my - sm * r * 0.2, mid = my + sm * r * 0.24;
  g.beginPath();
  g.moveTo(x + tx - mw, cy);
  g.quadraticCurveTo(x + tx, mid + (mid - cy) * 0.6, x + tx + mw, cy);
  if (sm > 0.55) { g.quadraticCurveTo(x + tx, cy + (mid - cy) * 0.6, x + tx - mw, cy); g.closePath(); inked(g, C.white, LW * 0.9); }
  else { g.lineWidth = LW * 1.1; g.strokeStyle = INK; g.lineCap = 'round'; g.stroke(); }
  if (sweat > 0) {
    g.save(); g.globalAlpha *= Math.min(1, sweat);
    g.beginPath(); g.moveTo(x + r * 0.78, y - r * 0.55); g.quadraticCurveTo(x + r * 0.95, y - r * 0.28, x + r * 0.78, y - r * 0.22); g.quadraticCurveTo(x + r * 0.62, y - r * 0.28, x + r * 0.78, y - r * 0.55);
    inked(g, C.sky, LW * 0.7); g.restore();
  }
}

// a little paper picture strip: hills, a sun and a cloud (SLIDE IT!'s puzzle)
export function scenery(g, x, y, w, h, t = 0) {
  g.save();
  rr(g, x, y, w, h, 12); g.clip();
  g.fillStyle = C.sky2; g.fillRect(x, y, w, h);
  circle(g, x + w * 0.8, y + h * 0.3, h * 0.16); inked(g, C.honey);
  g.beginPath(); g.moveTo(x, y + h * 0.72);
  g.quadraticCurveTo(x + w * 0.25, y + h * 0.42, x + w * 0.5, y + h * 0.7);
  g.quadraticCurveTo(x + w * 0.72, y + h * 0.5, x + w, y + h * 0.66);
  g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.closePath(); inked(g, C.leaf);
  g.beginPath(); g.moveTo(x, y + h * 0.86); g.quadraticCurveTo(x + w * 0.4, y + h * 0.72, x + w, y + h * 0.9); g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.closePath(); inked(g, C.green);
  cloud(g, x + w * 0.28 + Math.sin(t * 0.8) * 6, y + h * 0.26, h * 0.32);
  g.restore();
  rr(g, x, y, w, h, 12); inked(g, null);
}

// the puzzle piece's outline (a square with a knob on top and right), centred at x, y
export function piecePath(g, x, y, s) {
  const h = s / 2, k = s * 0.16;
  g.beginPath();
  g.moveTo(x - h, y - h);
  g.lineTo(x - k, y - h);
  g.arc(x, y - h - k * 0.35, k * 1.05, Math.PI * 0.82, Math.PI * 0.18, false);
  g.lineTo(x + h, y - h);
  g.lineTo(x + h, y - k);
  g.arc(x + h + k * 0.35, y, k * 1.05, Math.PI * 1.32, Math.PI * 0.68, false);
  g.lineTo(x + h, y + h);
  g.lineTo(x - h, y + h);
  g.closePath();
}
