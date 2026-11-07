// HEARTBEAT (2026-11-08): the pictures drawn once and reused every frame (offscreen canvases): the four notes (hearts in
// the lanes' colours, ink outline, a hard ink shadow and a shine, like the arcade's stickers), a missed note, the
// receptors on the hit line, the keycaps, and the stage lights' beam.
import { shade, rgba } from '../kit/fx.js';

export const INK = '#170a36';
export const PAPER = '#fffaf0';
export const LANE_COLORS = Object.freeze(['#ff4da6', '#ffc933', '#3ff0c3', '#8b66ff']);
export const LANE_NAMES = Object.freeze(['pink', 'honey', 'mint', 'violet']);

const SIZE = 128;            // a sprite's side (px): drawn smaller, never bigger

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w); c.height = Math.ceil(h);
  return c;
}

// a heart centred on (cx, cy), `s` wide
export function heartPath(ctx, cx, cy, s) {
  const w = s, h = s * 0.92;
  const top = cy - h * 0.5, bottom = cy + h * 0.5;
  ctx.beginPath();
  ctx.moveTo(cx, bottom);
  ctx.bezierCurveTo(cx - w * 0.1, bottom - h * 0.14, cx - w * 0.5, top + h * 0.58, cx - w * 0.5, top + h * 0.3);
  ctx.bezierCurveTo(cx - w * 0.5, top + h * 0.06, cx - w * 0.33, top - h * 0.02, cx - w * 0.22, top);
  ctx.bezierCurveTo(cx - w * 0.1, top + h * 0.01, cx - w * 0.02, top + h * 0.08, cx, top + h * 0.2);
  ctx.bezierCurveTo(cx + w * 0.02, top + h * 0.08, cx + w * 0.1, top + h * 0.01, cx + w * 0.22, top);
  ctx.bezierCurveTo(cx + w * 0.33, top - h * 0.02, cx + w * 0.5, top + h * 0.06, cx + w * 0.5, top + h * 0.3);
  ctx.bezierCurveTo(cx + w * 0.5, top + h * 0.58, cx + w * 0.1, bottom - h * 0.14, cx, bottom);
  ctx.closePath();
}

// a note: { canvas, w, h, cx, cy, s } — a sticker: its colour in an ink line, a paper die-cut border, an ink edge and a
// hard ink shadow, a shine on its left lobe. Draw it with its centre at the note's place.
function heartSprite(color, { grey = false, ring = false } = {}) {
  const pad = SIZE * 0.2;
  const c = canvas(SIZE + pad * 2, SIZE + pad * 2 + SIZE * 0.08);
  const g = c.getContext('2d');
  const cx = c.width / 2, cy = pad + SIZE * 0.5;
  const s = SIZE * 0.8;                       // the coloured heart
  const rim = SIZE * 0.085;                   // the paper border around it
  const fill = grey ? '#7d7396' : color;
  g.lineJoin = 'round';
  // the hard shadow, then the paper border with its ink edge
  heartPath(g, cx, cy + SIZE * 0.075, s + rim * 2);
  g.fillStyle = INK;
  g.fill();
  heartPath(g, cx, cy, s + rim * 2);
  g.fillStyle = grey ? '#b9b0cf' : PAPER;
  g.fill();
  g.lineWidth = SIZE * 0.045;
  g.strokeStyle = INK;
  g.stroke();
  // the body: lighter at the top, in its ink line
  heartPath(g, cx, cy, s);
  const gr = g.createLinearGradient(0, cy - s / 2, 0, cy + s / 2);
  gr.addColorStop(0, shade(fill, 0.3));
  gr.addColorStop(0.55, fill);
  gr.addColorStop(1, shade(fill, -0.14));
  g.fillStyle = gr;
  g.fill();
  g.lineWidth = SIZE * 0.05;
  g.strokeStyle = INK;
  g.stroke();
  if (ring) {
    // FEVER: a honey glint inside
    g.lineWidth = SIZE * 0.035;
    g.strokeStyle = 'rgba(255,233,168,0.95)';
    heartPath(g, cx, cy + s * 0.02, s * 0.66);
    g.stroke();
  }
  if (!grey) {
    g.save();
    g.translate(cx - s * 0.23, cy - s * 0.19);
    g.rotate(-0.6);
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.beginPath();
    g.ellipse(0, 0, s * 0.12, s * 0.058, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(s * 0.18, s * 0.065, s * 0.032, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  return { canvas: c, w: c.width, h: c.height, cx, cy, s: s + rim * 2 };
}

// a receptor on the hit line: a heart-shaped hole in the string, rimmed ink · paper · its colour; filled when pressed
function receptorSprite(color, pressed) {
  const pad = SIZE * 0.2;
  const c = canvas(SIZE + pad * 2, SIZE + pad * 2);
  const g = c.getContext('2d');
  const cx = c.width / 2, cy = c.height / 2;
  const s = SIZE * 0.86;
  g.lineJoin = 'round';
  heartPath(g, cx, cy, s);
  if (pressed) {
    const gr = g.createLinearGradient(0, cy - s / 2, 0, cy + s / 2);
    gr.addColorStop(0, shade(color, 0.45));
    gr.addColorStop(1, color);
    g.fillStyle = gr;
  } else {
    g.fillStyle = 'rgba(12,6,30,0.62)';
  }
  g.fill();
  heartPath(g, cx, cy, s);
  g.lineWidth = SIZE * 0.17;
  g.strokeStyle = INK;
  g.stroke();
  g.lineWidth = SIZE * 0.1;
  g.strokeStyle = PAPER;
  g.stroke();
  g.lineWidth = SIZE * 0.045;
  g.strokeStyle = pressed ? INK : color;
  g.stroke();
  return { canvas: c, w: c.width, h: c.height, cx, cy, s };
}

// a keycap: paper, ink, a hard shadow, its letter
function keycapSprite(label, dpr) {
  const w = 34 * dpr, h = 34 * dpr, sh = 4 * dpr;
  const c = canvas(w + 4 * dpr, h + sh + 4 * dpr);
  const g = c.getContext('2d');
  const x = 2 * dpr, y = 2 * dpr, r = 9 * dpr;
  const rr = (yy) => { g.beginPath(); g.moveTo(x + r, yy); g.arcTo(x + w, yy, x + w, yy + h, r); g.arcTo(x + w, yy + h, x, yy + h, r); g.arcTo(x, yy + h, x, yy, r); g.arcTo(x, yy, x + w, yy, r); g.closePath(); };
  rr(y + sh); g.fillStyle = INK; g.fill();
  rr(y); g.fillStyle = PAPER; g.fill();
  g.lineWidth = 2.5 * dpr; g.strokeStyle = INK; g.stroke();
  g.fillStyle = INK;
  g.font = `900 ${16 * dpr}px 'AK Display', 'Arial Black', sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label, x + w / 2, y + h / 2 + 1 * dpr);
  return { canvas: c, w: c.width / dpr, h: c.height / dpr };
}

// a stage light's beam: bright at its source, fading along its length and to its edges
function beamSprite() {
  const w = 96, h = 512;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const along = y / h;
    const spread = 0.18 + along * 0.82;                 // it widens as it goes
    const fall = Math.pow(1 - along, 1.4) * 0.9 + 0.1;
    for (let x = 0; x < w; x++) {
      const across = Math.abs(x / w - 0.5) * 2 / spread;
      const a = across >= 1 ? 0 : (1 - across * across) * fall;
      const i = (y * w + x) * 4;
      img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255; img.data[i + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

// a soft round light (crowd lights, glows)
function dotSprite() {
  const s = 32;
  const c = canvas(s, s);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.3, 'rgba(255,255,255,0.7)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, s, s);
  return c;
}

// tinted copies of a white sprite (for 'lighter' drawing in the lanes' colours)
function tinted(src, color) {
  const c = canvas(src.width, src.height);
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

export function createSprites() {
  const notes = LANE_COLORS.map((c) => heartSprite(c));
  const fever = LANE_COLORS.map((c) => heartSprite(c, { ring: true }));
  const missed = heartSprite('#7d7396', { grey: true });
  const receptors = LANE_COLORS.map((c) => receptorSprite(c, false));
  const pressed = LANE_COLORS.map((c) => receptorSprite(c, true));
  const beamWhite = beamSprite();
  const beams = [...LANE_COLORS, '#ffffff'].map((c) => tinted(beamWhite, c));
  const dotWhite = dotSprite();
  const dots = [...LANE_COLORS, '#ffffff', '#cdb8ff'].map((c) => tinted(dotWhite, c));
  let keycaps = null, keyDpr = 0;
  return {
    notes, fever, missed, receptors, pressed, beams, dots,
    keycaps(labels, dpr) {
      if (!keycaps || keyDpr !== dpr) { keycaps = labels.map((l) => keycapSprite(l, dpr)); keyDpr = dpr; }
      return keycaps;
    },
  };
}

// draw a sprite centred at (x, y), `size` CSS px wide for its heart
export function drawHeart(ctx, sp, x, y, size, alpha = 1) {
  const k = size / sp.s;
  const w = sp.w * k, h = sp.h * k;
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.drawImage(sp.canvas, x - sp.cx * k, y - sp.cy * k, w, h);
  if (alpha !== 1) ctx.globalAlpha = 1;
}
