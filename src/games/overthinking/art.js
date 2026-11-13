// OVERTHINKING: its pictures, drawn in code. Every thought is a small glossy creature with its own outline (color is
// never the only way to tell two kinds apart): a heart, a star, a crescent moon, a bitten cookie, a cat's head, a note;
// and the odd ones: a spiky cringe, a what-if, her phone, a eureka bulb, a deep-breath bubble, a chamomile flower.
// Bodies are drawn once per size into small canvases (sprites) and stamped each frame; faces are drawn live, so their
// eyes can follow your pen. Nothing is loaded from anywhere.
import { KINDS, SPECIALS, specOf } from './kinds.js';

const TAU = Math.PI * 2;
export const INK = '#170a36';

const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export function mix(a, b, t) {
  const A = hex(a), B = hex(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}
export const rgba = (h, a) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };

// ---------- each body's outline, in a box about 2 × 2 around its middle ----------
const PATHS = {
  heart(c) {
    c.moveTo(0, 0.92);
    c.bezierCurveTo(-1.42, 0.02, -0.98, -1.12, 0, -0.44);
    c.bezierCurveTo(0.98, -1.12, 1.42, 0.02, 0, 0.92);
    c.closePath();
  },
  star(c) {
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.52 : 1.02, a = (i / 10) * TAU - Math.PI / 2;
      c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r + 0.04);
    }
    c.closePath();
  },
  moon(c) {
    // a crescent: a disc with a bite out of its upper right
    c.arc(-0.1, 0.06, 1, 0.428, 4.678, false);
    c.arc(0.35, -0.24, 0.85, 4.107, 0.999, true);
    c.closePath();
  },
  cookie(c) {
    c.arc(0, 0, 1, -0.324, 5.1506, false);
    c.arc(0.74, -0.66, 0.4, 3.803, 1.024, true);
    c.closePath();
  },
  cat(c) {
    c.moveTo(-0.86, -0.18); c.lineTo(-0.74, -1.02); c.lineTo(-0.16, -0.66); c.closePath();
    c.moveTo(0.86, -0.18); c.lineTo(0.74, -1.02); c.lineTo(0.16, -0.66); c.closePath();
    c.moveTo(0.9, 0.12); c.ellipse(0, 0.12, 0.9, 0.82, 0, 0, TAU);
  },
  note(c) {
    c.moveTo(0.42, 0.36); c.ellipse(-0.2, 0.42, 0.62, 0.5, -0.32, 0, TAU);
    c.moveTo(0.22, 0.4); c.lineTo(0.22, -0.92); c.lineTo(0.42, -0.92); c.lineTo(0.42, 0.4); c.closePath();
    c.moveTo(0.32, -0.94);
    c.bezierCurveTo(0.62, -0.84, 0.98, -0.6, 0.86, -0.16);
    c.bezierCurveTo(0.78, -0.42, 0.56, -0.56, 0.32, -0.6);
    c.closePath();
  },
  cringe(c) {
    for (let i = 0; i < 18; i++) {
      const r = i % 2 ? 0.7 : 1.12, a = (i / 18) * TAU - Math.PI / 2;
      c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
  },
  whatif(c) { c.arc(0, 0, 0.96, 0, TAU); },
  phone(c) {
    const w = 0.62, h = 1.02, r = 0.2;
    c.moveTo(-w + r, -h); c.arcTo(w, -h, w, h, r); c.arcTo(w, h, -w, h, r); c.arcTo(-w, h, -w, -h, r); c.arcTo(-w, -h, w, -h, r); c.closePath();
  },
  eureka(c) {
    c.arc(0, -0.2, 0.74, 0.62 * Math.PI, 0.38 * Math.PI, false);
    c.lineTo(0.3, 0.86); c.lineTo(-0.3, 0.86); c.closePath();
  },
  breath(c) { c.arc(0, 0, 0.96, 0, TAU); },
  tea(c) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      c.moveTo(Math.cos(a) * 0.62 + 0.4 * Math.cos(a), Math.sin(a) * 0.62 + 0.4 * Math.sin(a));
      c.ellipse(Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0.42, 0.27, a, 0, TAU);
    }
    c.moveTo(0.5, 0); c.arc(0, 0, 0.5, 0, TAU);
  },
};

// where each face sits on its body, and how big its eyes are (in radii)
const FACES = {
  heart: { x: 0, y: -0.06, gap: 0.34, eye: 0.115 },
  star: { x: 0, y: 0.08, gap: 0.24, eye: 0.1 },
  moon: { x: -0.36, y: 0.2, gap: 0.21, eye: 0.09, sleepy: true },
  cookie: { x: -0.06, y: 0.08, gap: 0.32, eye: 0.115 },
  cat: { x: 0, y: 0.1, gap: 0.36, eye: 0.125, cat: true },
  note: { x: -0.2, y: 0.42, gap: 0.24, eye: 0.095 },
  tea: { x: 0, y: -0.02, gap: 0.18, eye: 0.07 },
  sun: { x: 0, y: -0.08, gap: 0.3, eye: 0.1 },
  whatif: null, phone: null, eureka: null, breath: null, cringe: { x: 0, y: -0.02, gap: 0.27, eye: 0.11, cringe: true },
};

function bodyGradient(c, color, deep) {
  const g = c.createRadialGradient(-0.36, -0.42, 0.06, 0, 0, 1.45);
  g.addColorStop(0, mix(color, '#ffffff', 0.62));
  g.addColorStop(0.38, color);
  g.addColorStop(1, deep);
  return g;
}

// one body, its middle at 0,0 and its radius 1 (the caller scales): ink outline, a puffed glossy fill, its details
export function drawBody(c, kind) {
  const sp = specOf(kind);
  const path = PATHS[kind];
  if (!sp || !path) return;
  const puff = kind === 'cringe' ? 0.06 : kind === 'star' ? 0.3 : kind === 'cat' || kind === 'note' ? 0.16 : kind === 'tea' ? 0.06 : 0.1;
  const ink = kind === 'cringe' ? '#ff3d6e' : INK, inkW = kind === 'cringe' ? 0.09 : 0.11;
  c.lineJoin = kind === 'cringe' ? 'miter' : 'round'; c.lineCap = 'round';
  let fill;
  if (kind === 'cringe') { fill = c.createRadialGradient(-0.2, -0.3, 0.05, 0, 0, 1.2); fill.addColorStop(0, '#4a2a7a'); fill.addColorStop(1, '#170a2e'); }
  else if (kind === 'phone') { fill = c.createLinearGradient(0, -1, 0, 1); fill.addColorStop(0, '#3a2a66'); fill.addColorStop(1, '#1a1036'); }
  else if (kind === 'breath') { fill = c.createRadialGradient(-0.3, -0.35, 0.05, 0, 0, 1); fill.addColorStop(0, 'rgba(255,255,255,.55)'); fill.addColorStop(0.5, 'rgba(160,230,255,.22)'); fill.addColorStop(1, 'rgba(120,200,255,.42)'); }
  else if (kind === 'tea') { fill = c.createRadialGradient(0, 0, 0.2, 0, 0, 1.1); fill.addColorStop(0, '#ffffff'); fill.addColorStop(1, '#ffe9c2'); }
  else fill = bodyGradient(c, sp.color, sp.deep);

  c.beginPath(); path(c);
  c.strokeStyle = ink; c.lineWidth = puff + inkW * 2; c.stroke();
  if (puff > 0.07) { c.strokeStyle = fill; c.lineWidth = puff; c.stroke(); }
  c.fillStyle = fill; c.fill();

  // its details
  if (kind === 'cookie') {
    c.fillStyle = '#7a3b12';
    for (const [x, y, r] of [[-0.48, -0.36, 0.13], [0.16, -0.56, 0.1], [0.5, 0.36, 0.13], [-0.22, 0.6, 0.11], [-0.7, 0.2, 0.09], [0.26, 0.74, 0.08]]) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  } else if (kind === 'cat') {
    c.fillStyle = '#ff9ccb';
    c.beginPath(); c.moveTo(-0.7, -0.44); c.lineTo(-0.66, -0.82); c.lineTo(-0.4, -0.66); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0.7, -0.44); c.lineTo(0.66, -0.82); c.lineTo(0.4, -0.66); c.closePath(); c.fill();
    c.strokeStyle = rgba(INK, 0.55); c.lineWidth = 0.035;
    for (const s of [-1, 1]) for (const dy of [0.02, 0.16]) { c.beginPath(); c.moveTo(s * 0.52, 0.36 + dy); c.lineTo(s * 0.98, 0.3 + dy * 1.6); c.stroke(); }
  } else if (kind === 'tea') {
    const g = c.createRadialGradient(-0.12, -0.14, 0.03, 0, 0, 0.5);
    g.addColorStop(0, '#fff0a0'); g.addColorStop(1, '#ffb800');
    c.beginPath(); c.arc(0, 0, 0.46, 0, TAU); c.fillStyle = g; c.fill();
    c.strokeStyle = INK; c.lineWidth = 0.07; c.stroke();
  } else if (kind === 'whatif') {
    c.strokeStyle = '#fffaf0'; c.lineWidth = 0.2; c.lineCap = 'round';
    c.beginPath(); c.arc(0, -0.24, 0.3, Math.PI * 1.05, Math.PI * 0.42, false); c.lineTo(0, 0.16); c.stroke();
    c.beginPath(); c.arc(0, 0.5, 0.115, 0, TAU); c.fillStyle = '#fffaf0'; c.fill();
  } else if (kind === 'phone') {
    const g = c.createLinearGradient(0, -0.8, 0, 0.7);
    g.addColorStop(0, '#9dffe6'); g.addColorStop(1, '#3fb8ff');
    c.fillStyle = g;
    c.beginPath(); c.rect(-0.46, -0.78, 0.92, 1.42); c.fill();
    c.fillStyle = rgba(INK, 0.85);
    for (let i = 0; i < 3; i++) { c.beginPath(); c.rect(-0.34, -0.62 + i * 0.34, i === 1 ? 0.5 : 0.68, 0.14); c.fill(); }
    c.beginPath(); c.arc(0.5, -0.86, 0.3, 0, TAU); c.fillStyle = '#ff4da6'; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.08; c.stroke();
    c.fillStyle = '#fffaf0'; c.beginPath(); c.rect(0.455, -1.02, 0.09, 0.32); c.fill();
  } else if (kind === 'eureka') {
    c.strokeStyle = INK; c.lineWidth = 0.07;
    c.beginPath(); c.moveTo(-0.3, 0.52); c.lineTo(0.3, 0.52); c.moveTo(-0.3, 0.7); c.lineTo(0.3, 0.7); c.stroke();
    c.strokeStyle = '#e08a00'; c.lineWidth = 0.08; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(-0.24, 0.32); c.lineTo(-0.14, -0.14); c.lineTo(0, 0.1); c.lineTo(0.14, -0.14); c.lineTo(0.24, 0.32); c.stroke();
  } else if (kind === 'breath') {
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 0.09; c.lineCap = 'round';
    for (const [y, w] of [[-0.26, 0.42], [0.02, 0.56], [0.3, 0.36]]) {
      c.beginPath(); c.moveTo(-w, y); c.bezierCurveTo(-w / 2, y - 0.16, 0, y + 0.16, w, y - 0.04); c.stroke();
    }
  }
  // a gloss on top (not on the dark ones)
  if (kind !== 'cringe' && kind !== 'phone' && kind !== 'tea') {
    c.save();
    c.translate(kind === 'moon' ? -0.62 : kind === 'note' ? -0.5 : -0.4, kind === 'moon' ? -0.3 : kind === 'note' ? 0.16 : -0.46);
    c.rotate(-0.6);
    c.beginPath(); c.ellipse(0, 0, kind === 'note' ? 0.16 : 0.22, kind === 'note' ? 0.08 : 0.11, 0, 0, TAU);
    c.fillStyle = 'rgba(255,255,255,.62)'; c.fill();
    c.restore();
  }
}

// its face, drawn live at the body's place: `look` (−1..1 each way) where its eyes point, `blink` 0..1 (1: shut),
// `mood`: 'calm' · 'happy' (about to be resolved) · 'scared' (mixed up, startled) · 'sleepy'
export function drawFace(c, kind, x, y, r, { lookX = 0, lookY = 0, blink = 0, mood = 'calm' } = {}) {
  const f = FACES[kind];
  if (!f) return;
  const cx = x + f.x * r, cy = y + f.y * r, gap = f.gap * r, e = f.eye * r;
  if (f.cringe) {
    // eyes screwed shut, a wobbly mouth
    c.strokeStyle = '#ff6b93'; c.lineWidth = Math.max(1.2, r * 0.085); c.lineCap = 'round'; c.lineJoin = 'round';
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(cx + s * (gap + e), cy - e); c.lineTo(cx + s * (gap - e * 0.6), cy); c.lineTo(cx + s * (gap + e), cy + e); c.stroke(); }
    c.beginPath(); c.moveTo(cx - gap * 0.7, cy + r * 0.34);
    for (let i = 1; i <= 4; i++) c.lineTo(cx - gap * 0.7 + (i / 4) * gap * 1.4, cy + r * 0.34 + (i % 2 ? -1 : 1) * r * 0.05);
    c.stroke();
    return;
  }
  const lx = lookX * e * 0.55, ly = lookY * e * 0.55;
  const shut = f.sleepy || mood === 'sleepy' || mood === 'happy' || blink > 0.6;
  c.lineCap = 'round';
  if (shut) {
    // closed: little arcs (smiling up when happy, resting down when asleep)
    c.strokeStyle = INK; c.lineWidth = Math.max(1.1, e * 0.62);
    for (const s of [-1, 1]) {
      c.beginPath();
      if (mood === 'happy') c.arc(cx + s * gap, cy + e * 0.5, e * 1.05, Math.PI * 1.15, Math.PI * 1.85);
      else c.arc(cx + s * gap, cy - e * 0.3, e * 1.05, Math.PI * 0.15, Math.PI * 0.85);
      c.stroke();
    }
  } else {
    const big = mood === 'scared' ? 1.28 : 1;
    for (const s of [-1, 1]) {
      c.beginPath(); c.ellipse(cx + s * gap + lx, cy + ly, e * big, e * 1.32 * big, 0, 0, TAU);
      c.fillStyle = INK; c.fill();
      c.beginPath(); c.arc(cx + s * gap + lx - e * 0.3, cy + ly - e * 0.45, e * 0.36, 0, TAU);
      c.fillStyle = '#fff'; c.fill();
    }
  }
  // cheeks
  if (r > 9 && !f.cat) {
    c.fillStyle = 'rgba(255,90,150,.3)';
    for (const s of [-1, 1]) { c.beginPath(); c.ellipse(cx + s * (gap + e * 1.9), cy + e * 1.7, e * 1.05, e * 0.62, 0, 0, TAU); c.fill(); }
  }
  // its mouth
  const my = cy + e * (f.cat ? 1.9 : 2.1);
  c.strokeStyle = INK; c.lineWidth = Math.max(1, e * 0.5);
  if (f.cat) {
    c.fillStyle = '#ff7ab8'; c.beginPath(); c.moveTo(cx - e * 0.55, my - e * 0.7); c.lineTo(cx + e * 0.55, my - e * 0.7); c.lineTo(cx, my - e * 0.05); c.closePath(); c.fill();
    c.beginPath(); c.arc(cx - e * 0.62, my + e * 0.1, e * 0.62, 0, Math.PI); c.stroke();
    c.beginPath(); c.arc(cx + e * 0.62, my + e * 0.1, e * 0.62, 0, Math.PI); c.stroke();
  } else if (mood === 'scared') {
    c.beginPath(); c.ellipse(cx, my + e * 0.2, e * 0.5, e * 0.7, 0, 0, TAU); c.fillStyle = INK; c.fill();
  } else if (mood === 'happy') {
    c.beginPath(); c.arc(cx, my - e * 0.2, e * 0.95, 0.1 * Math.PI, 0.9 * Math.PI); c.closePath(); c.fillStyle = INK; c.fill();
  } else {
    c.beginPath(); c.arc(cx, my - e * 0.5, e * 0.85, 0.18 * Math.PI, 0.82 * Math.PI); c.stroke();
  }
}

// ---------- sprites: a body drawn once per size ----------
const sprites = new Map();
// → { canvas, half } : stamp it with drawImage(canvas, x - half, y - half, half * 2, half * 2); `px` its radius on screen
export function sprite(kind, px, dpr = 1) {
  const size = Math.max(4, Math.round(px * dpr));
  const key = `${kind}:${size}`;
  let s = sprites.get(key);
  if (s) return s;
  const box = 1.5;                             // the canvas reaches this many radii from the middle (ears, spikes, the outline)
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.ceil(size * box * 2);
  const c = canvas.getContext('2d');
  c.translate(canvas.width / 2, canvas.height / 2);
  c.scale(size, size);
  drawBody(c, kind);
  s = { canvas, box };
  if (sprites.size > 160) sprites.clear();
  sprites.set(key, s);
  return s;
}

// a soft round glow in one color (drawn with 'lighter', it adds light)
const glows = new Map();
export function glow(color) {
  let g = glows.get(color);
  if (g) return g;
  g = document.createElement('canvas');
  g.width = g.height = 96;
  const c = g.getContext('2d');
  const grad = c.createRadialGradient(48, 48, 0, 48, 48, 48);
  grad.addColorStop(0, rgba(color, 0.55));
  grad.addColorStop(0.35, rgba(color, 0.22));
  grad.addColorStop(1, rgba(color, 0));
  c.fillStyle = grad;
  c.fillRect(0, 0, 96, 96);
  glows.set(color, g);
  return g;
}

export const colorOf = (kind) => (KINDS[kind] || SPECIALS[kind])?.color || '#ffffff';
// the color its light has (a cringe glows red, her phone mint)
export const lightOf = (kind) => (kind === 'cringe' ? '#ff3d6e' : kind === 'phone' ? '#3ff0c3' : kind === 'tea' ? '#ffe9a0' : colorOf(kind));

// a thought as a small picture for the page (a sticker, a journal page's tab): a canvas `px` across, with its face
export function portrait(kind, px = 44) {
  const dpr = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.round(px * dpr);
  canvas.className = 'ot-thought';
  canvas.style.width = canvas.style.height = `${px}px`;
  const c = canvas.getContext('2d');
  const r = (px * dpr) / 3.1;
  c.translate(canvas.width / 2, canvas.height / 2 + r * 0.05);
  c.save(); c.scale(r, r); drawBody(c, kind); c.restore();
  drawFace(c, kind, 0, 0, r, { mood: kind === 'moon' ? 'sleepy' : 'calm' });
  return canvas;
}
