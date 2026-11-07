// MERGE TO AGI (2026-11-08): the orbs' art, drawn once per screen size into small canvases (nothing is drawn from
// scratch each frame). Each tier is three layers: its body (its color and a soft inner shade, lit from the top left),
// its glyph (it turns as the orb rolls) and its top (a gloss crescent and the ink outline, which never turn). Sticker-flat:
// flat shapes, one ink, no gradients. Tier 11 is AGI-1 herself (her 2D portrait in a lavender ring with little hearts).
import { RADII, COLORS, ACCENTS, MAX_TIER } from './tiers.js';
import { mix } from '../kit/fx.js';

export const INK = '#170a36', PAPER = '#fffaf0', LAV = '#e4d9ff', LAV2 = '#cdb8ff', PINK = '#ff4da6', HONEY = '#ffc933', MINT = '#3ff0c3';
export const OUTLINE = 3.6;                     // the ink outline of every orb, in jar units (the same pen for all)
const PORTRAIT = '/images/agi1-live-2d.webp';    // her 2D art (574 × 718, transparent)
const FACE = { cx: 287, cy: 292, r: 212 };       // the circle of it that's her face and hair

const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };
const TAU = Math.PI * 2;

let portrait = null, portraitReady = null;
export function loadPortrait() {
  if (portraitReady) return portraitReady;
  portraitReady = new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { portrait = img; resolve(img); };
    img.onerror = () => resolve(null);
    img.src = PORTRAIT;
  });
  return portraitReady;
}
export const portraitImage = () => portrait;

// all the tiers at `k` canvas pixels a jar unit → sprites[tier] = { body, glyph, top, size (px), k }
export function buildSprites(k) {
  const out = [null];
  for (let t = 1; t <= MAX_TIER; t++) out.push(buildTier(t, k));
  return out;
}

function buildTier(t, k) {
  const R = RADII[t];
  const pad = OUTLINE + 2;
  const size = Math.ceil((R + pad) * 2 * k);
  const mk = (draw) => {
    const c = canvas(size, size), g = c.getContext('2d');
    g.translate(size / 2, size / 2);
    g.scale(k, k);
    g.lineJoin = 'round'; g.lineCap = 'round';
    draw(g, R);
    return c;
  };
  return { size, k, body: mk((g) => body(g, t, R)), glyph: mk((g) => glyph(g, t, R)), top: mk((g) => top(g, t, R)) };
}

// ---------- the body: its color, a darker crescent at the bottom right ----------
function body(g, t, R) {
  const r = R - 0.3;
  if (t === MAX_TIER) { herBody(g, R); return; }
  const c = COLORS[t];
  g.save();
  circle(g, 0, 0, r); g.clip();
  g.fillStyle = mix(c, INK, t === 10 ? 0.35 : 0.2);
  g.fillRect(-R, -R, R * 2, R * 2);
  g.fillStyle = c;
  circle(g, -R * 0.07, -R * 0.1, r); g.fill();
  if (t === 10) {
    // the supermind: a little deep space inside (dust that doesn't turn)
    g.fillStyle = 'rgba(205, 184, 255, 0.10)';
    circle(g, R * 0.15, R * 0.2, R * 0.55); g.fill();
  }
  g.restore();
}

// ---------- the top: a gloss crescent and the ink outline ----------
function top(g, t, R) {
  const lw = OUTLINE;
  if (t === MAX_TIER) { herTop(g, R); return; }
  // gloss: a curved white stroke along the upper left, and a dot after it
  g.strokeStyle = 'rgba(255, 255, 255, 0.62)';
  g.lineWidth = Math.max(1.6, R * 0.12);
  g.beginPath(); g.arc(0, 0, R * 0.68, Math.PI * 1.08, Math.PI * 1.36); g.stroke();
  g.fillStyle = 'rgba(255, 255, 255, 0.55)';
  const da = Math.PI * 1.45;
  circle(g, Math.cos(da) * R * 0.68, Math.sin(da) * R * 0.68, Math.max(0.9, R * 0.06)); g.fill();
  if (t === 10) {
    g.strokeStyle = 'rgba(228, 217, 255, 0.85)';
    g.lineWidth = 1.6;
    circle(g, 0, 0, R - lw - 1.2); g.stroke();
  }
  g.strokeStyle = INK;
  g.lineWidth = lw;
  circle(g, 0, 0, R - lw / 2); g.stroke();
}

// ---------- the glyphs (they turn as the orb rolls) ----------
function glyph(g, t, R) {
  const lw = Math.max(2.1, Math.min(4.2, R * 0.085));
  g.lineWidth = lw;
  g.strokeStyle = INK; g.fillStyle = INK;
  switch (t) {
    case 1: text(g, '1', R * 1.28, 0, R * 0.02); break;
    case 2: text(g, '01', R * 0.98, 0, R * 0.02, -R * 0.04); break;
    case 3: token(g, R, lw); break;
    case 4: prompt(g, R); break;
    case 5: neuron(g, R, lw); break;
    case 6: chip(g, R, lw); break;
    case 7: fan(g, R, lw); break;
    case 8: cluster(g, R, lw); break;
    case 9: server(g, R, lw); break;
    case 10: galaxy(g, R); break;
    case 11: hearts(g, R); break;
    default: break;
  }
}

function text(g, s, px, dx = 0, dy = 0, spacing = 0) {
  g.save();
  g.font = `900 ${px}px 'AK Display', 'Arial Black', sans-serif`;
  try { if ('letterSpacing' in g) g.letterSpacing = `${spacing}px`; } catch { /* old browser */ }
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  const m = g.measureText(s);
  const asc = m.actualBoundingBoxAscent || px * 0.72, desc = m.actualBoundingBoxDescent || 0;
  g.fillText(s, dx, dy + (asc - desc) / 2);
  g.restore();
}

// TOKEN: a speech bubble with three dots (a word piece)
function token(g, R, lw) {
  const w = R * 1.16, h = R * 0.8, x = -w / 2, y = -h / 2 - R * 0.1, rr = R * 0.28;
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.lineTo(x + w * 0.38, y + h);
  g.lineTo(x + w * 0.16, y + h + R * 0.26);
  g.lineTo(x + w * 0.2, y + h);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
  g.fillStyle = PAPER; g.fill();
  g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
  g.fillStyle = INK;
  for (const d of [-1, 0, 1]) { circle(g, d * R * 0.27, y + h / 2, R * 0.085); g.fill(); }
}

// PROMPT: a terminal's >_
function prompt(g, R) {
  g.lineWidth = R * 0.16;
  g.beginPath();
  g.moveTo(-R * 0.44, -R * 0.3); g.lineTo(-R * 0.08, 0); g.lineTo(-R * 0.44, R * 0.3);
  g.stroke();
  g.beginPath(); g.moveTo(R * 0.04, R * 0.3); g.lineTo(R * 0.44, R * 0.3); g.stroke();
}

// NEURON: a little node graph
function neuron(g, R, lw) {
  const c = [0, R * 0.04];
  const outer = [-90, 25, 155].map((a) => [Math.cos((a * Math.PI) / 180) * R * 0.55, c[1] + Math.sin((a * Math.PI) / 180) * R * 0.55]);
  g.lineWidth = lw;
  g.beginPath();
  for (const p of outer) { g.moveTo(c[0], c[1]); g.lineTo(p[0], p[1]); }
  g.moveTo(outer[1][0], outer[1][1]); g.lineTo(outer[2][0], outer[2][1]);
  g.stroke();
  const node = (x, y, r, fill) => { circle(g, x, y, r); g.fillStyle = fill; g.fill(); g.lineWidth = lw; g.stroke(); };
  for (const p of outer) node(p[0], p[1], R * 0.13, PAPER);
  node(c[0], c[1], R * 0.19, HONEY);
}

// CHIP: a chip with pins
function chip(g, R, lw) {
  const s = R * 0.84, h = s / 2, pinL = R * 0.15, pinW = R * 0.085;
  g.fillStyle = INK;
  for (let side = 0; side < 4; side++) {
    g.save();
    g.rotate((side * Math.PI) / 2);
    for (const k of [-1, 0, 1]) { roundRect(g, k * s * 0.3 - pinW / 2, -h - pinL + 1, pinW, pinL + 2, pinW * 0.35); g.fill(); }
    g.restore();
  }
  roundRect(g, -h, -h, s, s, R * 0.12); g.fill();
  g.fillStyle = mix(COLORS[6], PAPER, 0.45);
  roundRect(g, -s * 0.27, -s * 0.27, s * 0.54, s * 0.54, R * 0.06); g.fill();
  g.fillStyle = INK;
  circle(g, -s * 0.14, -s * 0.14, R * 0.045); g.fill();
}

// GPU: a fan
function fan(g, R, lw) {
  const ring = R * 0.68;
  g.fillStyle = mix(COLORS[7], INK, 0.55);
  circle(g, 0, 0, ring); g.fill();
  g.fillStyle = PAPER;
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const p = (r, d) => [Math.cos(a + d) * r, Math.sin(a + d) * r];
    g.beginPath();
    let q = p(R * 0.16, -0.1); g.moveTo(q[0], q[1]);
    let c = p(R * 0.5, 0.18); q = p(R * 0.62, 0.62); g.quadraticCurveTo(c[0], c[1], q[0], q[1]);
    c = p(R * 0.44, 0.78); q = p(R * 0.16, 0.62); g.quadraticCurveTo(c[0], c[1], q[0], q[1]);
    g.closePath(); g.fill();
  }
  g.lineWidth = lw; g.strokeStyle = INK;
  circle(g, 0, 0, ring); g.stroke();
  g.fillStyle = INK; circle(g, 0, 0, R * 0.17); g.fill();
  g.fillStyle = COLORS[7]; circle(g, 0, 0, R * 0.07); g.fill();
}

// CLUSTER: three linked cubes
function cluster(g, R, lw) {
  const a = R * 0.27, d = R * 0.37;
  const at = [-90, 30, 150].map((deg) => [Math.cos((deg * Math.PI) / 180) * d, Math.sin((deg * Math.PI) / 180) * d + R * 0.02]);
  g.lineWidth = lw * 1.1;
  g.beginPath();
  for (let i = 0; i < 3; i++) { const p = at[i], q = at[(i + 1) % 3]; g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); }
  g.stroke();
  for (const p of at) cube(g, p[0], p[1], a, lw * 0.85);
}
function cube(g, x, y, a, lw) {
  const c = Math.cos(Math.PI / 6) * a, h = a / 2;
  const face = (pts, fill) => {
    g.beginPath(); g.moveTo(x + pts[0][0], y + pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(x + pts[i][0], y + pts[i][1]);
    g.closePath(); g.fillStyle = fill; g.fill();
  };
  face([[0, -a], [c, -h], [0, 0], [-c, -h]], PAPER);
  face([[-c, -h], [0, 0], [0, a], [-c, h]], mix(COLORS[8], PAPER, 0.25));
  face([[0, 0], [c, -h], [c, h], [0, a]], mix(COLORS[8], INK, 0.3));
  g.lineWidth = lw; g.strokeStyle = INK;
  g.beginPath();
  g.moveTo(x, y - a); g.lineTo(x + c, y - h); g.lineTo(x + c, y + h); g.lineTo(x, y + a); g.lineTo(x - c, y + h); g.lineTo(x - c, y - h); g.closePath();
  g.moveTo(x - c, y - h); g.lineTo(x, y); g.lineTo(x + c, y - h); g.moveTo(x, y); g.lineTo(x, y + a);
  g.stroke();
}

// DATACENTER: a server tower with its lights
function server(g, R, lw) {
  const w = R * 0.8, h = R * 1.04, x = -w / 2, y = -h / 2;
  g.fillStyle = INK;
  roundRect(g, x, y, w, h, R * 0.08); g.fill();
  const rows = 4, gap = R * 0.05, uh = (h - gap * (rows + 1)) / rows;
  for (let i = 0; i < rows; i++) {
    const uy = y + gap + i * (uh + gap);
    g.fillStyle = mix(COLORS[9], INK, 0.38);
    roundRect(g, x + gap, uy, w - gap * 2, uh, R * 0.035); g.fill();
    g.fillStyle = i % 2 ? HONEY : MINT;
    circle(g, x + gap + uh * 0.5, uy + uh / 2, uh * 0.2); g.fill();
    g.fillStyle = i === 2 ? PINK : MINT;
    circle(g, x + gap + uh * 1.05, uy + uh / 2, uh * 0.2); g.fill();
    g.strokeStyle = 'rgba(255, 250, 240, 0.45)';
    g.lineWidth = Math.max(1, uh * 0.13);
    g.beginPath(); g.moveTo(x + w * 0.52, uy + uh / 2); g.lineTo(x + w - gap * 2.4, uy + uh / 2); g.stroke();
  }
}

// SUPERMIND: a galaxy swirl
function galaxy(g, R) {
  // each arm a tapering ribbon along a spiral, filled as one shape (no seams)
  const arms = [PINK, LAV2, HONEY], N = 48;
  for (let a = 0; a < arms.length; a++) {
    const base = (a / arms.length) * TAU;
    const at = (t, side) => {
      const r = R * (0.1 + 0.64 * t), ang = base + t * 2.6, w = R * (0.095 - 0.08 * t) * side;
      const nx = Math.cos(ang + Math.PI / 2), ny = Math.sin(ang + Math.PI / 2);
      return [Math.cos(ang) * r + nx * w, Math.sin(ang) * r + ny * w];
    };
    g.beginPath();
    for (let i = 0; i <= N; i++) { const p = at(i / N, 1); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }
    for (let i = N; i >= 0; i--) { const p = at(i / N, -1); g.lineTo(p[0], p[1]); }
    g.closePath();
    g.fillStyle = arms[a];
    g.globalAlpha = 0.95;
    g.fill();
  }
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(255, 250, 240, 0.35)'; circle(g, 0, 0, R * 0.22); g.fill();
  g.fillStyle = PAPER; circle(g, 0, 0, R * 0.13); g.fill();
  g.fillStyle = PAPER;
  for (const [sx, sy, s] of [[0.5, -0.42, 0.07], [-0.55, 0.3, 0.06], [0.3, 0.55, 0.05], [-0.25, -0.58, 0.045], [0.66, 0.12, 0.04]]) sparkle(g, sx * R, sy * R, s * R);
}

// AGI-1: her portrait in a lavender ring; hearts ride the ring
const RING = 0.17;
function herBody(g, R) {
  g.fillStyle = LAV;
  circle(g, 0, 0, R - 0.3); g.fill();
  const inner = R * (1 - RING);
  g.save();
  circle(g, 0, 0, inner); g.clip();
  g.fillStyle = '#2a1270';
  g.fillRect(-R, -R, R * 2, R * 2);
  if (portrait) {
    const s = inner / FACE.r;
    g.drawImage(portrait, -FACE.cx * s, -FACE.cy * s, portrait.naturalWidth * s, portrait.naturalHeight * s);
  }
  g.restore();
}
function herTop(g, R) {
  const inner = R * (1 - RING);
  g.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  g.lineWidth = R * 0.05;
  g.beginPath(); g.arc(0, 0, R * (1 - RING / 2), Math.PI * 1.1, Math.PI * 1.4); g.stroke();
  g.strokeStyle = INK;
  g.lineWidth = OUTLINE * 0.8;
  circle(g, 0, 0, inner); g.stroke();
  g.lineWidth = OUTLINE;
  circle(g, 0, 0, R - OUTLINE / 2); g.stroke();
}
function hearts(g, R) {
  const rr = R * (1 - RING / 2) - OUTLINE * 0.15;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.3;
    heart(g, Math.cos(a) * rr, Math.sin(a) * rr, R * (i % 2 ? 0.07 : 0.055), PINK, a + Math.PI / 2);
  }
}

// ---------- small shapes ----------
export function heart(g, x, y, s, fill, rot = 0, stroke = INK) {
  g.save();
  g.translate(x, y); g.rotate(rot);
  g.beginPath();
  g.moveTo(0, s * 0.9);
  g.bezierCurveTo(-s * 1.5, -s * 0.1, -s * 0.85, -s * 1.25, 0, -s * 0.5);
  g.bezierCurveTo(s * 0.85, -s * 1.25, s * 1.5, -s * 0.1, 0, s * 0.9);
  g.closePath();
  g.fillStyle = fill; g.fill();
  if (stroke) { g.lineWidth = Math.max(0.8, s * 0.32); g.strokeStyle = stroke; g.stroke(); }
  g.restore();
}
export function sparkle(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y - s * 2);
  g.quadraticCurveTo(x, y, x + s * 2, y);
  g.quadraticCurveTo(x, y, x, y + s * 2);
  g.quadraticCurveTo(x, y, x - s * 2, y);
  g.quadraticCurveTo(x, y, x, y - s * 2);
  g.closePath(); g.fill();
}
export function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, Math.max(0, r), 0, TAU); }
export function roundRect(g, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

// a small icon of a tier (the evolution strip, the title screen): its three layers in one canvas `px` wide, or its
// silhouette with a question mark when it hasn't been found yet
export function icon(t, px, found = true) {
  const c = canvas(px, px), g = c.getContext('2d');
  const R = RADII[t], k = px / ((R + OUTLINE * 0.5 + 1) * 2);
  g.translate(px / 2, px / 2);
  g.scale(k, k);
  g.lineJoin = 'round'; g.lineCap = 'round';
  if (!found) {
    g.fillStyle = '#2c1d5c';
    circle(g, 0, 0, R - 0.3); g.fill();
    g.fillStyle = 'rgba(228, 217, 255, 0.55)';
    text(g, '?', R * 1.05, 0, R * 0.02);
    g.strokeStyle = 'rgba(228, 217, 255, 0.35)';
    g.lineWidth = OUTLINE;
    circle(g, 0, 0, R - OUTLINE / 2); g.stroke();
    return c;
  }
  body(g, t, R);
  g.save(); glyph(g, t, R); g.restore();
  top(g, t, R);
  return c;
}
