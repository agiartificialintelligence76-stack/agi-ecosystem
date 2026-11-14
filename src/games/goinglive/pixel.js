// GOING LIVE: the pixel art, all drawn in code (no image files): AGI-1 as a little pixel girl (her poses, her outfits),
// her pets, the spam bots, the fan-mail drone, deliveries and mystery boxes, what floats over her head, every thing for
// her room and her six homes. Each sprite is drawn once at its own size (art pixels) on a small canvas, lit from the top
// left (its edges a little lighter on top and left, darker underneath and right), given a dark outline, and kept
// (`sprite(key)`); the page scales the room up by a whole number of screen pixels, so every art pixel stays a crisp
// square. Ours from scratch: no other game’s art.
import { itemOf } from './data.js';

export const CELL = 16, ROW = 8, WROW = 16;
export const INK = '#2a1440';

// ---------- the kit ----------
const made = new Map();
const canvasOf = (w, h) => {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
};
// a drawing kit on a sprite’s canvas, in art pixels (integers)
export function kit(ctx) {
  const R = (x, y, w, h, c) => { if (w <= 0 || h <= 0 || !c) return; ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const P = (x, y, c) => R(x, y, 1, 1, c);
  // an ellipse filling the box x, y, w, h (crisp: whole pixels, row by row)
  const oval = (x, y, w, h, c) => {
    for (let j = 0; j < h; j++) {
      const t = (j + 0.5 - h / 2) / (h / 2), half = (w / 2) * Math.sqrt(Math.max(0, 1 - t * t));
      const a = Math.round(x + w / 2 - half), b = Math.round(x + w / 2 + half);
      R(a, y + j, b - a, 1, c);
    }
  };
  // a 3/4 box: its front face from (x, y) h tall, its top face d deep above it; lit top, darker front, a crease between
  const box = (x, y, w, h, d, top, front, crease = null) => {
    R(x, y - d, w, d, top); R(x, y, w, h, front);
    R(x, y, w, 1, crease || shade(front, -0.12));
    R(x, y - d, w, 1, shade(top, 0.12));
  };
  // a hole the shape of an ellipse (the ring light’s middle, a bowl’s open top)
  const hole = (x, y, w, h) => {
    for (let j = 0; j < h; j++) {
      const t = (j + 0.5 - h / 2) / (h / 2), half = (w / 2) * Math.sqrt(Math.max(0, 1 - t * t));
      const a = Math.round(x + w / 2 - half), b = Math.round(x + w / 2 + half);
      if (b > a) ctx.clearRect(a, Math.round(y + j), b - a, 1);
    }
  };
  const line = (x0, y0, x1, y1, c) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) P(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
  };
  // a soft two-tone gradient, top to bottom (a wall, a sky)
  const fade = (x, y, w, h, a, b, steps = 4) => { for (let i = 0; i < steps; i++) R(x, y + Math.round((h * i) / steps), w, Math.ceil(h / steps), mix(a, b, i / (steps - 1 || 1))); };
  return { ctx, R, P, oval, box, line, hole, fade, shade };
}

// a colour lighter (k > 0) or darker (k < 0)
export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (k > 0) { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; } else { r *= 1 + k; g *= 1 + k; b *= 1 + k; }
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}
export function mix(a, b, t) {
  const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((p >> s) & 255) * (1 - t) + ((q >> s) & 255) * t);
  return `#${[ch(16), ch(8), ch(0)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
// the light: a pixel with nothing above it a little lighter, nothing left of it a touch lighter, nothing under or right
// of it darker (every shape gets a rim of light and a soft shadow side)
function light(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data, out = new Uint8ClampedArray(d);
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 127;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (d[i + 3] <= 127) continue;
    let m = 0;
    if (!on(x, y - 1)) m += 0.2;
    if (!on(x - 1, y)) m += 0.08;
    if (!on(x, y + 1)) m -= 0.16;
    if (!on(x + 1, y)) m -= 0.1;
    if (!m) continue;
    for (let k = 0; k < 3; k++) { const v = d[i + k]; out[i + k] = m > 0 ? v + (255 - v) * m : v * (1 + m); }
  }
  img.data.set(out); ctx.putImageData(img, 0, 0);
}
// the outline: every empty pixel next to a drawn one (left, right, up, down) gets the ink
function outline(ctx, w, h, color = INK) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data, out = new Uint8Array(w * h);
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 127;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    d[i + 3] = d[i + 3] > 127 ? 255 : 0;
    if (!on(x, y) && (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) out[y * w + x] = 1;
  }
  const n = parseInt(color.slice(1), 16);
  for (let k = 0; k < out.length; k++) if (out[k]) { d[k * 4] = (n >> 16) & 255; d[k * 4 + 1] = (n >> 8) & 255; d[k * 4 + 2] = n & 255; d[k * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
}
// a sprite: drawn once at w × h art pixels (plus a pixel all round for its outline) → { canvas, w, h } (its art pixels
// start at 1, 1 on the canvas)
export function sprite(key, w, h, draw, { ink = INK, outlined = true, lit = true } = {}) {
  if (made.has(key)) return made.get(key);
  const cv = canvasOf(w + 2, h + 2), ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.save(); ctx.translate(1, 1); draw(kit(ctx)); ctx.restore();
  if (lit && outlined) light(ctx, w + 2, h + 2);
  if (outlined) outline(ctx, w + 2, h + 2, ink);
  const s = { canvas: cv, w, h };
  made.set(key, s);
  return s;
}
export const forget = (prefix = '') => { for (const k of [...made.keys()]) if (k.startsWith(prefix)) made.delete(k); };

// ---------- AGI-1: a little pixel girl (20 × 27; her feet’s middle at 10, 27) ----------
const HAIR = '#ffd36e', HAIR_L = '#ffeaa8', HAIR_D = '#e0a447', HAIR_DD = '#c98a34', SKIN = '#ffdcc6', SKIN_D = '#f3b79c', EYE = '#4b2a63', EYE_L = '#c57a3c';
const SHOE = '#ffffff', SHOE_D = '#d6cbe9', BLUSH = '#ff9fbd', MOUTH = '#c44f6a';
// her outfits (the dresser changes them): her shirt and her shorts
export const OUTFITS = Object.freeze([
  { name: 'Lavender', shirt: '#c9a2f2', shirtD: '#a67fe0', shorts: '#efe6ff', shortsD: '#c7b2f2' },
  { name: 'Bubblegum', shirt: '#ff9ccf', shirtD: '#e66fa8', shorts: '#fff0f7', shortsD: '#f3c6dc' },
  { name: 'Mint', shirt: '#7fe0c4', shirtD: '#4fbf9f', shorts: '#e8fff7', shortsD: '#b9ead9' },
  { name: 'Sky', shirt: '#86c6ff', shirtD: '#4f8fe0', shorts: '#eaf4ff', shortsD: '#bcd6f2' },
  { name: 'Neon night', shirt: '#3e3263', shirtD: '#2a2145', shorts: '#ff4da6', shortsD: '#d9358a' },
  { name: 'Sunny', shirt: '#ffd36e', shirtD: '#e0a447', shorts: '#fff6dc', shortsD: '#f0dca8' },
]);
export const HER = { w: 20, h: 27, fx: 10 };
// `pose`: stand, blink, talk, walk0…3 and run0…3 (to the right; mirrored for the left), cheer, wave, sit (on a seat,
// facing us), sleep, dance0…3, hold:mic / book / snack / cup / can, hug, pray, vr, hide; from behind: type0/1 (sitting at
// her desk), play0/1 (at a game, an instrument), paint0/1, cook0/1, tinker0/1, drums0/1, back0
export function herSprite(pose, outfit = 0) {
  const o = OUTFITS[((outfit % OUTFITS.length) + OUTFITS.length) % OUTFITS.length];
  return sprite(`her:${pose}:${outfit}`, HER.w, HER.h, (g) => { g.ctx.translate(2, 3); drawHer(g, pose, o); }, { lit: false });
}
const BACK = ['type', 'back', 'play', 'paint', 'cook', 'tinker', 'drums'];
function drawHer(g, pose, O) {
  const { R, P, oval } = g;
  const kind = pose.replace(/\d+$/, ''), f = Number((/\d+$/.exec(pose) || ['0'])[0]);
  if (kind === 'sleep') return drawHerAsleep(g, O);
  if (kind === 'hide') return;
  const back = BACK.includes(kind), seated = kind === 'sit' || kind === 'type';
  const side = kind === 'walk' || kind === 'run', dance = kind === 'dance';
  const top = seated ? 3 : dance && f === 2 ? 1 : 0;
  const sway = dance ? [0, 1, 0, -1][f] : 0;
  const SHIRT = O.shirt, SHIRT_D = O.shirtD, SHORTS = O.shorts, SHORTS_D = O.shortsD;
  // her long hair, behind her
  R(3 + sway, 6 + top, 10, 11 - (seated ? 2 : 0), HAIR_D);
  oval(3 + sway, 13 + top, 10, 6 - (seated ? 2 : 0), HAIR_D);
  R(4 + sway, 16 + top - (seated ? 2 : 0), 8, 1, HAIR_DD);
  // legs and shoes
  if (!seated) {
    const step = side ? [0, 1, 0, -1][f] : 0, wide = dance && (f === 0 || f === 2) ? 1 : 0;
    R(6 - step - wide, 19, 2, 3, SKIN); R(9 + step + wide, 19, 2, 3, SKIN);
    R(5 - step - wide, 22, 3, 2, SHOE); R(9 + step + wide, 22, 3, 2, SHOE);
    R(5 - step - wide, 23, 3, 1, SHOE_D); R(9 + step + wide, 23, 3, 1, SHOE_D);
  } else if (!back) {
    // sitting, facing us: knees forward
    R(5, 19, 6, 2, SKIN); R(5, 21, 2, 2, SKIN); R(9, 21, 2, 2, SKIN); R(4, 22, 3, 2, SHOE); R(9, 22, 3, 2, SHOE);
  }
  // shorts and shirt
  const hip = dance ? [0, 1, 0, -1][f] : 0;
  R(5 + hip, 17 + top - (seated ? 1 : 0), 6, 3, SHORTS); R(5 + hip, 19 + top - (seated ? 1 : 0), 6, 1, SHORTS_D);
  R(5, 12 + top, 6, 6, SHIRT); R(5, 16 + top, 6, 1, SHIRT_D); R(5, 12 + top, 1, 5, shade(SHIRT, 0.12));
  // arms
  const up = kind === 'cheer' || (dance && f === 0), wave = kind === 'wave';
  const leftUp = dance && f === 1, rightUp = dance && f === 3;
  if (back) {
    if (kind === 'type') { R(3, 13 + top, 2, 3, SHIRT); R(11, 13 + top, 2, 3, SHIRT); R(3 + (f ? 1 : 0), 16 + top, 2, 1, SKIN); R(11 - (f ? 1 : 0), 16 + top, 2, 1, SKIN); }
    else if (kind === 'play') { R(3, 13, 2, 2, SHIRT); R(11, 13, 2, 2, SHIRT); R(4 + f, 15, 2, 1, SKIN); R(10 - f, 15, 2, 1, SKIN); }
    else if (kind === 'paint') {
      R(3, 12, 1, 3, SHIRT); R(3, 15, 1, 2, SKIN); oval(0, 15, 5, 3, '#e8d39a'); P(1, 16, '#ff4da6'); P(3, 16, '#3fa9ff');
      R(11, 11, 2, 2, SHIRT); R(12, 8 + f, 1, 3, SKIN); R(12, 4 + f, 1, 4, '#a06a3c'); P(12, 3 + f, ['#ff4da6', '#3fa9ff'][f]);
    } else if (kind === 'cook') { R(3, 12, 1, 3, SHIRT); R(3, 15, 1, 2, SKIN); R(11, 13, 2, 2, SHIRT); R(10 - f, 15, 2, 1, SKIN); R(9 - f, 13, 1, 3, '#9a92b2'); }
    else if (kind === 'tinker') { R(3, 12, 1, 3, SHIRT); R(3, 15, 1, 2, SKIN); R(11, 13, 2, 2, SHIRT); R(10, 14 - f, 2, 1, SKIN); R(11, 12 - f, 3, 2, '#9a92b2'); P(13, 11 - f, '#9a92b2'); }
    else if (kind === 'drums') {
      if (!f) { R(3, 10 + top, 2, 4, SHIRT); R(11, 10 + top, 2, 4, SHIRT); R(3, 8 + top, 1, 3, SKIN); R(12, 8 + top, 1, 3, SKIN); R(2, 4 + top, 1, 5, '#e2b27c'); R(13, 4 + top, 1, 5, '#e2b27c'); }
      else { R(3, 13 + top, 2, 3, SHIRT); R(11, 13 + top, 2, 3, SHIRT); R(4, 16 + top, 2, 1, SKIN); R(10, 16 + top, 2, 1, SKIN); R(1, 16 + top, 3, 1, '#e2b27c'); R(12, 16 + top, 3, 1, '#e2b27c'); }
    } else { R(4, 12, 1, 3, SHIRT); R(11, 12, 1, 3, SHIRT); R(4, 15, 1, 2, SKIN); R(11, 15, 1, 2, SKIN); }
  } else if (up) {
    R(3, 12 + top, 2, 2, SHIRT); R(11, 12 + top, 2, 2, SHIRT);
  } else if (kind.startsWith('hold') || kind === 'hug' || kind === 'pray') {
    R(4, 12 + top, 1, 3, SHIRT); R(11, 12 + top, 1, 3, SHIRT);
    if (kind === 'pray') { R(5, 14 + top, 2, 1, SKIN); R(9, 14 + top, 2, 1, SKIN); R(7, 12 + top, 2, 3, SKIN); }
    else { R(5, 15 + top, 2, 1, SKIN); R(9, 15 + top, 2, 1, SKIN); }
  } else {
    R(4, 12 + top, 1, 3, SHIRT); R(11, 12 + top, 1, 3, SHIRT);
    if (!leftUp) R(4, 15 + top, 1, 2 + (side ? 0 : 1), SKIN);
    if (wave || rightUp) R(12, 12 + top, 1, 2, SHIRT); else R(11, 15 + top, 1, 2 + (side ? 0 : 1), SKIN);
    if (leftUp) R(3, 12 + top, 1, 2, SHIRT);
  }
  // the AGI on her shirt (a little white mark)
  if (!back) { R(6, 14 + top, 1, 2, '#ffffff'); R(8, 14 + top, 1, 2, '#ffffff'); R(7, 14 + top, 1, 1, '#ffffff'); R(9, 14 + top, 1, 1, SHIRT_D); }
  // her head
  oval(3 + sway, 2 + top, 10, 11, back ? HAIR : SKIN);
  if (!back) {
    // hair: the top, the bangs, the sides
    oval(2 + sway, 0 + top, 12, 7, HAIR);
    R(2 + sway, 3 + top, 2, 9, HAIR); R(12 + sway, 3 + top, 2, 9, HAIR);
    R(4 + sway, 5 + top, 1, 2, HAIR); R(7 + sway, 5 + top, 2, 1, HAIR); R(11 + sway, 5 + top, 1, 2, HAIR);
    R(5 + sway, 1 + top, 4, 1, HAIR_L); R(4 + sway, 2 + top, 2, 1, HAIR_L); P(10 + sway, 1 + top, HAIR_L);
    R(2 + sway, 10 + top, 1, 3, HAIR_D); R(13 + sway, 10 + top, 1, 3, HAIR_D);
    // the face
    const blink = kind === 'blink' || kind === 'pray';
    const happy = up || dance || wave || kind === 'hug';
    if (side) {
      R(9, 7 + top, 2, blink ? 1 : 2, EYE); if (!blink) P(10, 7 + top, '#ffffff');
      R(11, 9 + top, 1, 1, BLUSH); R(9, 10 + top, 2, 1, MOUTH);
      R(3, 3 + top, 3, 9, HAIR); R(3, 11 + top, 2, 2, HAIR_D);
    } else {
      const x = 5 + sway;
      if (blink) { R(x, 8 + top, 2, 1, EYE); R(x + 4, 8 + top, 2, 1, EYE); }
      else if (happy) { P(x, 8 + top, EYE); P(x + 1, 7 + top, EYE); P(x + 2, 8 + top, EYE); P(x + 4, 8 + top, EYE); P(x + 5, 7 + top, EYE); P(x + 6, 8 + top, EYE); }
      else {
        R(x, 7 + top, 2, 2, EYE); R(x + 4, 7 + top, 2, 2, EYE);
        P(x, 7 + top, '#ffffff'); P(x + 4, 7 + top, '#ffffff'); P(x + 1, 8 + top, EYE_L); P(x + 5, 8 + top, EYE_L);
      }
      R(x - 1, 9 + top, 1, 1, BLUSH); R(x + 6, 9 + top, 1, 1, BLUSH);
      if (kind === 'talk' || happy || kind === 'hold:mic') { R(x + 2, 10 + top, 2, 1, MOUTH); P(x + 2, 11 + top, MOUTH); P(x + 3, 11 + top, '#ff7f9e'); } else R(x + 2, 10 + top, 2, 1, MOUTH);
    }
    if (up) { R(1, 5 + top, 2, 8, SKIN); R(13, 5 + top, 2, 8, SKIN); R(1, 4 + top, 2, 1, SKIN); R(13, 4 + top, 2, 1, SKIN); }
    if (leftUp) { R(1, 5, 2, 8, SKIN); R(1, 4, 2, 1, SKIN); }
    if (wave || rightUp) { R(13, 6 + top, 2, 7, SKIN); R(13, 5 + top, 3, 2, SKIN); }
    // what she’s holding
    if (kind === 'hold:mic') { R(10, 13, 2, 3, SKIN); R(10, 9, 2, 2, '#3d3459'); R(10, 11, 1, 3, '#9a92b2'); }
    if (kind === 'hold:book') { R(5, 13, 6, 4, '#ff6fb5'); R(5, 13, 6, 1, '#ffffff'); R(8, 13, 1, 4, '#d9358a'); }
    if (kind === 'hold:snack') { oval(6, 12, 4, 4, '#ffffff'); R(6, 14, 4, 2, '#3d3459'); }
    if (kind === 'hold:cup') { R(6, 13, 3, 3, '#ffffff'); P(9, 14, '#ffffff'); R(6, 13, 3, 1, '#a06a3c'); }
    if (kind === 'hold:can') { R(11, 14, 4, 3, '#2fd6a6'); R(15, 13, 2, 1, '#2fd6a6'); R(12, 13, 2, 1, '#1f9f80'); }
    if (kind === 'hug') { oval(5, 12, 7, 6, '#ff9ccf'); R(5, 11, 2, 2, '#ff9ccf'); R(10, 11, 2, 2, '#ff9ccf'); P(7, 14, INK); P(9, 14, INK); R(4, 14, 2, 2, SKIN); R(11, 14, 2, 2, SKIN); }
    if (kind === 'vr') { R(3, 6 + top, 10, 3, '#ffffff'); R(4, 7 + top, 8, 1, '#3d3459'); P(5, 7 + top, '#7fe0ff'); P(10, 7 + top, '#7fe0ff'); R(2, 6 + top, 1, 2, '#c9c2da'); R(13, 6 + top, 1, 2, '#c9c2da'); }
  } else {
    // from behind: all hair, a highlight, a bow
    R(2, 3 + top, 12, 10, HAIR); oval(2, 0 + top, 12, 7, HAIR);
    R(4, 2 + top, 5, 1, HAIR_L); R(3, 4 + top, 1, 4, HAIR_L);
    R(7, 6 + top, 1, 9, HAIR_D); R(2, 12 + top, 12, 2, HAIR_D);
    R(6, 1 + top, 4, 2, '#ff6fb5'); P(5, 1 + top, '#ff6fb5'); P(10, 1 + top, '#ff6fb5');
  }
}
function drawHerAsleep(g, O) {
  const { R, oval } = g;
  // lying on her side, under a blanket (the bed draws the pillow): her head on the left
  oval(1, 12, 9, 9, HAIR); R(2, 16, 4, 4, HAIR_D);
  oval(3, 14, 6, 6, SKIN); R(4, 17, 2, 1, EYE); R(7, 17, 1, 1, EYE); R(3, 18, 1, 1, BLUSH);
  R(8, 16, 8, 7, O.shirt); R(8, 20, 8, 3, O.shirtD);
}
// her face up close when she’s live (32 × 32): idle, blink, talk, happy
export function bustSprite(pose, outfit = 0) {
  const O = OUTFITS[((outfit % OUTFITS.length) + OUTFITS.length) % OUTFITS.length];
  return sprite(`bust:${pose}:${outfit}`, 32, 32, (g) => {
    const { R, P, oval } = g;
    R(4, 12, 24, 20, HAIR_D); oval(4, 22, 24, 12, HAIR_D);
    R(8, 24, 16, 8, O.shirt); R(6, 27, 20, 5, O.shirt); R(8, 30, 16, 2, O.shirtD);
    R(13, 27, 2, 3, '#ffffff'); R(17, 27, 2, 3, '#ffffff'); R(15, 27, 2, 1, '#ffffff');
    R(14, 21, 4, 4, SKIN_D);
    oval(7, 4, 18, 19, SKIN);
    oval(5, 0, 22, 13, HAIR); R(5, 6, 3, 17, HAIR); R(24, 6, 3, 17, HAIR);
    R(8, 9, 2, 3, HAIR); R(13, 10, 3, 1, HAIR); R(19, 10, 2, 2, HAIR); R(22, 9, 2, 3, HAIR);
    R(10, 2, 7, 1, HAIR_L); R(8, 3, 3, 1, HAIR_L); R(6, 18, 2, 6, HAIR_D); R(24, 18, 2, 6, HAIR_D);
    if (pose === 'blink' || pose === 'happy') {
      R(10, 15, 4, 1, EYE); R(18, 15, 4, 1, EYE);
      if (pose === 'happy') { P(10, 14, EYE); P(13, 14, EYE); P(18, 14, EYE); P(21, 14, EYE); R(10, 15, 4, 1, SKIN); R(18, 15, 4, 1, SKIN); R(11, 14, 2, 1, EYE); R(19, 14, 2, 1, EYE); }
    } else {
      R(10, 13, 4, 4, EYE); R(18, 13, 4, 4, EYE);
      R(10, 13, 2, 2, '#ffffff'); R(18, 13, 2, 2, '#ffffff'); R(12, 16, 2, 1, EYE_L); R(20, 16, 2, 1, EYE_L);
    }
    R(8, 17, 2, 1, BLUSH); R(22, 17, 2, 1, BLUSH);
    if (pose === 'talk' || pose === 'happy') { R(15, 18, 3, 2, MOUTH); R(15, 19, 3, 1, '#ff8aa8'); } else R(15, 18, 2, 1, MOUTH);
  }, { lit: false });
}

// ---------- her pets (12 × 10 or so), a spam bot, the drone ----------
const CATS = {
  cat: { a: '#8d8aa6', d: '#6f6b8c', l: '#b9b6cf', eye: '#2a1440' },
  holocat: { a: '#7fd8ff', d: '#3fa9ff', l: '#c9f4ff', eye: '#ffffff' },
};
export function catSprite(pose, kind = 'cat') {
  const C = CATS[kind] || CATS.cat;
  return sprite(`cat:${kind}:${pose}`, 12, 10, ({ R, P, oval }) => {
    if (pose === 'sleep') { oval(1, 4, 10, 6, C.a); oval(7, 3, 5, 5, C.a); R(2, 8, 8, 1, C.d); R(8, 5, 1, 1, C.d); R(10, 5, 1, 1, C.d); P(7, 2, C.a); P(11, 2, C.a); R(3, 5, 4, 1, C.l); return; }
    const f = pose === 'walk1' ? 1 : 0;
    R(2, 4, 7, 4, C.a); R(1, 3 - f, 1, 3, C.d); P(0, 2 - f, C.d);
    R(2, 8, 1, 2, C.d); R(4 + f, 8, 1, 2, C.d); R(6 - f, 8, 1, 2, C.d); R(8, 8, 1, 2, C.d);
    oval(7, 1, 5, 5, C.a); P(7, 0, C.a); P(11, 0, C.a); R(8, 3, 1, 1, C.eye); R(10, 3, 1, 1, C.eye); P(9, 4, '#ff9fbd'); R(3, 5, 4, 2, C.l);
    if (kind === 'holocat') { R(2, 6, 7, 1, '#c9f4ff'); P(5, 2, '#ffffff'); }
  });
}
export function dogSprite(pose) {
  return sprite(`dog:${pose}`, 13, 11, ({ R, P }) => {
    const f = pose === 'walk1' ? 1 : 0;
    R(2, 4, 8, 4, '#dfe6f2'); R(2, 7, 8, 1, '#aeb8cc'); R(0, 3 - f, 2, 1, '#aeb8cc');
    R(3, 8, 1, 3, '#7a8299'); R(5 + f, 8, 1, 3, '#7a8299'); R(7 - f, 8, 1, 3, '#7a8299'); R(9, 8, 1, 3, '#7a8299');
    R(8, 0, 5, 5, '#dfe6f2'); R(9, 2, 3, 1, '#2fd6a6'); P(10, 2, '#ffffff'); R(8, 0, 1, 2, '#aeb8cc'); P(12, 4, '#ff9fbd');
  });
}
// her robot butler: a little round robot with a tray and a cup of tea
export function butlerSprite(pose) {
  return sprite(`butler:${pose}`, 12, 16, ({ R, P, oval }) => {
    const f = pose === 'walk1' ? 1 : 0;
    oval(2, 2, 8, 7, '#e8edf6'); R(3, 4, 6, 2, '#3d3459'); P(4, 4, '#7fe0ff'); P(7, 4, '#7fe0ff');
    R(5, 0, 1, 2, '#9aa3b8'); P(5, 0, '#ff4da6');
    R(3, 8, 6, 5, '#c9cfdc'); R(3, 8, 6, 1, '#ffffff'); R(5, 10, 2, 1, '#ff4da6');
    R(0, 7 - f, 3, 1, '#9aa3b8'); R(9, 6 + f, 3, 1, '#9aa3b8'); R(9, 5 + f, 3, 1, '#c9a2f2'); R(10, 3 + f, 1, 2, '#ffffff');
    oval(3, 13, 3, 3, '#3d3459'); oval(6, 13, 3, 3, '#3d3459');
  });
}
export function botSprite(f) {
  return sprite(`bot:${f}`, 10, 11, ({ R, P }) => {
    R(2, 2, 6, 6, '#c9cfdc'); R(2, 6, 6, 2, '#9aa3b8'); R(3, 3, 4, 2, '#2a1440'); P(3, 3, '#ff3b5c'); P(6, 3, '#ff3b5c');
    R(4, 0, 2, 2, '#9aa3b8'); P(4 + (f ? 1 : 0), 0, '#ff3b5c');
    R(3, 8, 1, 3 - f, '#6e7690'); R(6, 8, 1, 2 + f, '#6e7690'); R(0, 4 + f, 2, 1, '#9aa3b8'); R(8, 5 - f, 2, 1, '#9aa3b8');
  });
}
export function droneSprite(f) {
  return sprite(`drone:${f}`, 18, 13, ({ R, P }) => {
    R(1, 1, f ? 6 : 4, 1, '#c9cfdc'); R(11, 1, f ? 6 : 4, 1, '#c9cfdc');
    R(3, 2, 1, 2, '#6e7690'); R(14, 2, 1, 2, '#6e7690');
    R(3, 3, 12, 3, '#ff8ac0'); R(3, 5, 12, 1, '#e0609a'); R(7, 3, 4, 2, '#7fe0ff'); P(8, 3, '#ffffff');
    R(8, 6, 1, 2, '#6e7690'); R(5, 8, 8, 5, '#ffd36e'); R(5, 8, 8, 1, '#ffe9a8'); R(8, 8, 2, 5, '#ff4da6'); R(5, 10, 8, 1, '#ff4da6');
  });
}
// a delivery box (on its way, or here), and a mystery box (bronze, silver, gold): a big question mark
export function boxSprite(state) {
  return sprite(`box:${state}`, 14, 12, ({ R, box }) => {
    box(1, 5, 12, 7, 4, '#e8b67a', '#d39a5c');
    R(6, 1, 2, 11, state === 'ready' ? '#ff4da6' : '#b9824a'); R(1, 7, 12, 1, state === 'ready' ? '#ff4da6' : '#b9824a');
    if (state === 'ready') { R(4, 0, 3, 2, '#ff4da6'); R(7, 0, 3, 2, '#ff4da6'); }
  });
}
const BOXC = { bronze: ['#e7a26b', '#c47a45', '#ff4da6'], silver: ['#dfe7f4', '#aab7cf', '#6b74ff'], gold: ['#ffd84a', '#e0a020', '#ff4da6'] };
export function mysterySprite(tier = 'bronze', f = 0) {
  const [a, d, rib] = BOXC[tier] || BOXC.bronze;
  return sprite(`mystery:${tier}:${f}`, 18, 17, ({ R, P, box }) => {
    const lift = f === 1 ? 1 : 0;
    box(1, 7, 16, 10, 5, shade(a, 0.15), a);
    R(1, 15, 16, 2, d);
    R(8, 2, 2, 15, rib); R(1, 9, 16, 2, rib);
    R(4, 0 - lift, 4, 3, rib); R(10, 0 - lift, 4, 3, rib); R(8, 1 - lift, 2, 2, shade(rib, -0.2));
    // the question mark
    R(4, 10, 3, 1, '#ffffff'); R(6, 11, 1, 2, '#ffffff'); R(5, 13, 1, 1, '#ffffff'); P(5, 15, '#ffffff');
    if (tier === 'gold') { P(14, 9, '#ffffff'); P(3, 12, '#fff6c9'); }
  });
}
// what floats over her head while she’s busy (9 × 9)
const EMOTES = {
  zzz: ({ R }) => { R(1, 5, 4, 1, '#7fd8ff'); R(3, 6, 1, 1, '#7fd8ff'); R(2, 7, 1, 1, '#7fd8ff'); R(1, 8, 4, 1, '#7fd8ff'); R(5, 0, 3, 1, '#ffffff'); R(6, 1, 1, 1, '#ffffff'); R(5, 2, 3, 1, '#ffffff'); },
  game: ({ R, P }) => { R(1, 3, 7, 4, '#9a92b2'); R(0, 4, 1, 3, '#9a92b2'); R(8, 4, 1, 3, '#9a92b2'); R(2, 4, 1, 1, '#ffffff'); P(1, 5, '#ffffff'); P(3, 5, '#ffffff'); P(6, 4, '#ff4da6'); P(7, 5, '#3fa9ff'); },
  star: ({ R, P }) => { R(4, 0, 1, 9, '#ffd84a'); R(0, 4, 9, 1, '#ffd84a'); R(2, 2, 5, 5, '#ffd84a'); P(4, 4, '#ffffff'); },
  sparkle: ({ R }) => { R(4, 0, 1, 9, '#ffffff'); R(0, 4, 9, 1, '#ffffff'); R(3, 3, 3, 3, '#fff6c9'); },
  heart: ({ R }) => { R(1, 1, 3, 2, '#ff4da6'); R(5, 1, 3, 2, '#ff4da6'); R(0, 2, 9, 3, '#ff4da6'); R(1, 5, 7, 1, '#ff4da6'); R(2, 6, 5, 1, '#ff4da6'); R(3, 7, 3, 1, '#ff4da6'); R(4, 8, 1, 1, '#ff4da6'); R(2, 2, 1, 1, '#ffc3e2'); },
  note: ({ R }) => { R(5, 0, 1, 6, '#9b6bff'); R(6, 0, 2, 1, '#9b6bff'); R(7, 1, 1, 2, '#9b6bff'); R(2, 5, 4, 3, '#9b6bff'); },
  gear: ({ R, P }) => { R(2, 2, 5, 5, '#c9c2da'); R(3, 0, 3, 9, '#c9c2da'); R(0, 3, 9, 3, '#c9c2da'); R(3, 3, 3, 3, '#676084'); P(4, 4, '#c9c2da'); },
  book: ({ R }) => { R(0, 2, 4, 6, '#ffffff'); R(5, 2, 4, 6, '#ffffff'); R(4, 2, 1, 6, '#ff6fb5'); R(1, 4, 2, 1, '#c9c2da'); R(6, 4, 2, 1, '#c9c2da'); R(1, 6, 2, 1, '#c9c2da'); },
  bubble: ({ R, P, oval }) => { oval(0, 3, 5, 5, '#9fe2ff'); oval(5, 0, 4, 4, '#9fe2ff'); P(1, 4, '#ffffff'); P(6, 1, '#ffffff'); void R; },
  food: ({ R, oval }) => { oval(1, 0, 7, 8, '#ffffff'); R(2, 5, 5, 3, '#3d3459'); R(3, 2, 1, 1, '#ffe0e8'); },
  steam: ({ R }) => { R(1, 4, 1, 3, '#ffffff'); R(2, 2, 1, 2, '#ffffff'); R(4, 3, 1, 4, '#ffffff'); R(5, 1, 1, 2, '#ffffff'); R(7, 4, 1, 3, '#ffffff'); },
  sweat: ({ R }) => { R(4, 0, 1, 2, '#7fd8ff'); R(3, 2, 3, 3, '#7fd8ff'); R(3, 2, 1, 1, '#ffffff'); },
  drop: ({ R }) => { R(2, 1, 1, 2, '#3fa9ff'); R(1, 3, 3, 2, '#3fa9ff'); R(6, 4, 1, 2, '#3fa9ff'); R(5, 6, 3, 2, '#3fa9ff'); },
  splash: ({ R }) => { R(1, 4, 2, 2, '#7fd8ff'); R(4, 1, 2, 3, '#7fd8ff'); R(7, 4, 2, 2, '#7fd8ff'); R(3, 6, 4, 2, '#3fa9ff'); },
  claw: ({ R }) => { R(4, 0, 1, 4, '#9a92b2'); R(2, 4, 5, 1, '#9a92b2'); R(2, 5, 1, 2, '#9a92b2'); R(6, 5, 1, 2, '#9a92b2'); R(3, 7, 3, 2, '#ff9ccf'); },
  gift: ({ R }) => { R(1, 3, 7, 6, '#ff4da6'); R(0, 2, 9, 2, '#ff7fbe'); R(4, 2, 1, 7, '#ffd84a'); R(2, 0, 2, 2, '#ffd84a'); R(5, 0, 2, 2, '#ffd84a'); },
  puff: ({ R, oval }) => { oval(0, 3, 5, 5, '#c9c2dc'); oval(3, 1, 6, 6, '#e6e0f2'); R(2, 6, 5, 2, '#c9c2dc'); },
};
export const EMOTE_IDS = Object.keys(EMOTES);
export function emoteSprite(kind) {
  if (!EMOTES[kind]) return null;
  return sprite(`emote:${kind}`, 9, 9, (g) => EMOTES[kind](g), { lit: false, outlined: kind !== 'steam' });
}

// ---------- the things in her room ----------
// Each: `ph` its height in art pixels (a floor thing’s front edge at the bottom, its top face above its front face; a
// thing for the wall is h × 16; a rug h × 8), `frames` (if it moves), and how to draw it (W wide, H tall, frame f,
// variant v: { view, night } for windows).
const WOOD = '#e2b27c', WOOD_M = '#c98f5c', WOOD_D = '#a06a3c', WHITE = '#fbf7ff', OFF = '#e6def4', GRAY_L = '#c9c2da', GRAY = '#9a92b2', GRAY_D = '#676084', DARK = '#3d3459';
const PINK = '#ff9ccf', HOT = '#ff4da6', LAV = '#c9a2f2', PURPLE = '#9b6bff', DEEP = '#6b3fd0', MINT = '#6fe8c6', TEAL = '#2fb8a0', SKY = '#7fd8ff', BLUE = '#4f8ff0', NAVY = '#3046a8';
const YELLOW = '#ffd36e', GOLD = '#f0b432', ORANGE = '#ff9a3d', RED = '#ff5468', GREEN = '#62d84c', LEAF = '#3fbf6a', LEAF_D = '#2a8f4c', LEAF_L = '#7fe08a', GLOW = '#9ff6ff', SCREEN = '#3b8fd8', BLACK = '#251b3d';
const legs = (R, xs, y, h, c = WOOD_D) => { for (const x of xs) R(x, y, 2, h, c); };
const screenOn = (R, x, y, w, h, f, tint = SCREEN) => { R(x, y, w, h, tint); R(x + 1, y + 1, w - 2, 1, GLOW); R(x + 1, y + 3 + (f % 2), Math.max(1, w - 4), 1, shade(tint, 0.35)); };
const leaf = (R, P, x, y, c = LEAF) => { R(x, y, 3, 2, c); P(x + 1, y - 1, c); P(x + 1, y, LEAF_L); };
export const ART = {
  // desk & tech
  desk: { ph: 23, draw: ({ R, box }, W, H) => {
    box(0, H - 15, W, 3, 8, '#efc591', WOOD_M); R(0, H - 22, W, 1, '#f6d6aa');
    legs(R, [1, W - 3], H - 12, 12); legs(R, [5, W - 7], H - 12, 9, '#8a5730');
    R(W - 18, H - 11, 14, 6, WOOD_M); R(W - 18, H - 11, 14, 1, WOOD_D); R(W - 12, H - 9, 3, 1, '#f6d6aa'); R(W - 18, H - 6, 14, 1, WOOD_D);
    R(3, H - 21, 4, 4, '#ffffff'); R(7, H - 20, 1, 2, '#ffffff'); R(3, H - 21, 4, 1, '#a06a3c');
  } },
  laptop: { ph: 9, frames: 2, draw: ({ R }, W, H, f) => { R(3, H - 2, 11, 2, GRAY_L); R(3, H - 1, 11, 1, GRAY); R(4, H - 9, 9, 7, DARK); screenOn(R, 5, H - 8, 7, 5, f); R(6, H - 6, 3, 1, HOT); R(4, H - 2, 9, 1, '#e6def4'); } },
  stool: { ph: 14, draw: ({ R, box, line }, W, H) => { box(2, H - 9, 12, 2, 4, '#ffb3d6', '#e0609a'); R(4, H - 12, 8, 1, '#ffd1e6'); line(4, H - 7, 11, H - 1, GRAY_D); line(11, H - 7, 4, H - 1, GRAY_D); R(6, H - 4, 4, 1, GRAY); } },
  bed: { ph: 34, draw: ({ R, box, P }, W, H) => {
    R(0, H - 26, 6, 26, WOOD_M); R(0, H - 26, 6, 2, '#efc591'); R(1, H - 22, 4, 1, WOOD_D); R(2, H - 18, 2, 6, WOOD_D);
    box(5, H - 9, W - 5, 9, 16, WHITE, WOOD_M); R(5, H - 9, W - 5, 1, WOOD_D);
    R(18, H - 25, W - 19, 16, PINK); R(18, H - 25, W - 19, 2, '#ffc3e2'); R(18, H - 10, W - 19, 1, '#e66fa8');
    for (let x = 22; x < W - 2; x += 8) { R(x, H - 21, 3, 3, '#ffc3e2'); P(x + 1, H - 20, '#fff0f7'); }
    R(18, H - 17, W - 19, 1, '#ff8fc4');
    R(7, H - 24, 10, 7, OFF); R(7, H - 24, 10, 2, WHITE); R(8, H - 20, 8, 1, '#d8cfe9'); R(W - 3, H - 14, 3, 14, WOOD_M);
  } },
  window: { ph: 32, wall: true, draw: (g, W, H, f, v) => windowArt(g, W, H, v, { panes: 2, curtain: true }) },
  webcam: { ph: 9, draw: ({ R, oval }) => { R(6, 6, 4, 3, GRAY_D); R(7, 4, 2, 2, GRAY); oval(3, 0, 10, 6, OFF); oval(6, 1, 4, 4, DARK); R(7, 2, 1, 1, SKY); R(11, 1, 1, 1, RED); } },
  mic: { ph: 13, draw: ({ R, oval }) => { R(4, 11, 8, 2, GRAY_D); R(7, 6, 2, 5, GRAY); oval(4, 0, 8, 8, GRAY_L); R(5, 2, 6, 1, GRAY); R(5, 4, 6, 1, GRAY); R(6, 1, 2, 1, WHITE); } },
  ringlight: { ph: 34, draw: ({ R, oval, hole }, W, H) => { R(7, 14, 2, H - 16, GRAY_D); R(3, H - 2, 10, 2, GRAY_D); oval(0, 0, 16, 16, WHITE); hole(3, 3, 10, 10); R(6, 13, 4, 2, GRAY); R(2, 4, 1, 3, '#fff6c9'); } },
  console: { ph: 8, draw: ({ R, box }) => { box(1, 4, 14, 4, 3, OFF, GRAY_L); R(3, 5, 4, 1, PURPLE); R(11, 5, 2, 2, RED); R(1, 0, 6, 2, GRAY); R(2, 0, 1, 1, HOT); } },
  pc: { ph: 30, frames: 3, draw: ({ R, box, oval }, W, H, f) => {
    box(2, H - 24, 12, 24, 6, GRAY_D, DARK); R(4, H - 21, 8, 1, '#5a4f80');
    R(4, H - 19, 8, 13, '#2e2547'); R(4, H - 19, 8, 1, '#7f74b0');
    for (let i = 0; i < 2; i++) { oval(5, H - 17 + i * 6, 6, 5, [HOT, SKY, MINT][(i + f) % 3]); oval(7, H - 16 + i * 6, 2, 3, '#2e2547'); }
    R(10, H - 4, 2, 1, GREEN); R(4, H - 4, 3, 1, '#5a4f80');
  } },
  monitor: { ph: 18, frames: 2, draw: ({ R }, W, H, f) => { R(12, H - 3, 8, 3, GRAY_D); R(15, H - 6, 2, 3, GRAY); R(1, H - 18, 30, 12, DARK); screenOn(R, 2, H - 17, 28, 10, f, '#5b6cf0'); R(5, H - 14, 6, 4, HOT); R(14, H - 12, 9, 2, MINT); R(14, H - 9, 6, 1, YELLOW); } },
  cornerdesk: { ph: 24, draw: ({ R, box }, W, H) => { box(0, H - 16, W, 3, 8, WHITE, OFF); legs(R, [2], H - 13, 13, GRAY_L); R(W - 22, H - 13, 20, 13, PINK); R(W - 22, H - 13, 20, 1, '#e66fa8'); for (let i = 0; i < 3; i++) { R(W - 20, H - 11 + i * 4, 16, 3, '#ffb3d6'); R(W - 14, H - 10 + i * 4, 4, 1, HOT); } } },
  tablet: { ph: 5, draw: ({ R, line }) => { R(1, 2, 14, 3, DARK); R(2, 2, 11, 2, '#4a3f70'); line(9, 0, 13, 3, GRAY_L); R(13, 3, 1, 1, HOT); } },
  buttons: { ph: 6, draw: ({ R, box }) => { box(1, 3, 14, 3, 3, DARK, BLACK); for (let i = 0; i < 4; i++) R(2 + i * 3, 0, 2, 2, [HOT, SKY, YELLOW, MINT][i]); } },
  studiomic: { ph: 22, draw: ({ R, line, oval }) => { R(1, 20, 6, 2, GRAY_D); line(3, 19, 3, 10, GRAY_D); line(3, 10, 10, 4, GRAY_D); oval(8, 0, 7, 11, DARK); R(9, 2, 5, 1, GRAY_D); R(9, 5, 5, 1, GRAY_D); R(9, 8, 5, 1, GRAY_D); R(10, 1, 2, 1, GRAY); } },
  dual: { ph: 17, frames: 2, draw: ({ R }, W, H, f) => { for (const x of [0, 16]) { R(x + 1, H - 17, 15, 11, DARK); screenOn(R, x + 2, H - 16, 13, 9, f + x / 16, x ? '#2f9fd8' : '#7a5cf0'); } R(14, H - 6, 4, 6, GRAY_D); R(10, H - 2, 12, 2, GRAY_D); } },
  greenscreen: { ph: 38, draw: ({ R }, W, H) => { R(1, 0, W - 2, 2, GRAY_D); R(2, 2, W - 4, H - 6, '#3fd16b'); R(2, 2, W - 4, 2, '#7ef09a'); R(2, H - 8, W - 4, 2, '#2fae55'); legs(R, [1, W - 3], H - 4, 4, GRAY_D); } },
  arcade: { ph: 36, frames: 2, draw: ({ R, box }, W, H, f) => { box(1, H - 30, 14, 30, 4, PURPLE, DEEP); R(1, H - 34, 14, 4, HOT); R(3, H - 33, 10, 1, '#ff9ccf'); R(3, H - 26, 10, 8, BLACK); screenOn(R, 4, H - 25, 8, 6, f, '#ff6fb5'); R(3, H - 16, 10, 3, GRAY_D); R(5, H - 16, 1, 1, RED); R(9, H - 15, 1, 1, YELLOW); R(11, H - 15, 1, 1, SKY); R(4, H - 10, 8, 6, DEEP); R(6, H - 8, 4, 1, '#ff9ccf'); } },
  vr: { ph: 26, draw: ({ R, oval }) => { R(7, 10, 2, 14, GRAY_D); R(3, 24, 10, 2, GRAY_D); oval(2, 2, 12, 9, WHITE); R(3, 4, 10, 4, DARK); R(4, 5, 3, 1, SKY); R(9, 5, 3, 1, SKY); R(1, 4, 1, 3, GRAY); R(14, 4, 1, 3, GRAY); } },
  rack: { ph: 40, frames: 3, draw: ({ R, box }, W, H, f) => { box(1, H - 34, 14, 34, 6, GRAY_D, BLACK); for (let i = 0; i < 6; i++) { R(3, H - 31 + i * 5, 10, 3, '#3a3156'); R(4 + ((i + f) % 3) * 2, H - 30 + i * 5, 1, 1, [GREEN, SKY, HOT][(i + f) % 3]); R(11, H - 30 + i * 5, 1, 1, i % 2 ? GREEN : YELLOW); } } },
  robotarm: { ph: 20, frames: 4, draw: ({ R, line, oval }, W, H, f) => { R(2, H - 3, 10, 3, GRAY_D); oval(4, H - 7, 6, 5, ORANGE); const a = [0, 2, 4, 2][f]; line(7, H - 6, 12, H - 13 - a, ORANGE); line(8, H - 6, 13, H - 13 - a, ORANGE); line(12, H - 13 - a, 21, H - 15 + a, ORANGE); R(20, H - 16 + a, 4, 2, GRAY_D); R(22, H - 14 + a, 1, 3, GRAY_D); R(24, H - 14 + a, 1, 3, GRAY_D); } },
  holo: { ph: 40, frames: 4, draw: ({ R, oval }, W, H, f) => { oval(1, H - 8, W - 2, 8, GRAY_D); oval(3, H - 8, W - 6, 6, SKY); for (let i = 0; i < 5; i++) R(6 + i * 4, 4 + ((i * 7 + f * 3) % 9), 1, H - 16 - ((i * 7 + f * 3) % 9), i % 2 ? '#bff6ff' : '#7fe0ff'); oval(10, 6 + (f % 2), 12, 12, '#c9f7ff'); R(14, 10 + (f % 2), 2, 2, DEEP); R(18, 10 + (f % 2), 2, 2, DEEP); } },
  quantum: { ph: 34, frames: 4, draw: ({ R, box, oval }, W, H, f) => { box(1, H - 10, W - 2, 10, 8, GRAY_L, GRAY); for (let i = 0; i < 4; i++) oval(6 + i * 1, H - 34 + i * 5, W - 12 - i * 2, 5, i % 2 ? GOLD : YELLOW); R(15, H - 30, 2, 20, GOLD); R(4, H - 6, 4, 2, [SKY, HOT, MINT, YELLOW][f]); R(W - 8, H - 6, 4, 2, [HOT, MINT, YELLOW, SKY][f]); } },
  // seats & beds
  beanbag: { ph: 14, draw: ({ R, oval }) => { oval(0, 2, 32, 12, HOT); oval(2, 2, 26, 8, '#ff7fbe'); R(6, 4, 8, 2, '#ffb3d6'); R(20, 9, 6, 1, '#d9358a'); } },
  gamerchair: { ph: 28, draw: ({ R, box, oval }) => { oval(3, 0, 10, 16, BLACK); R(5, 3, 6, 9, HOT); R(6, 1, 4, 1, HOT); R(7, 5, 2, 5, '#ff9ccf'); box(2, 17, 12, 3, 4, BLACK, DARK); R(7, 20, 2, 5, GRAY_D); R(3, 25, 10, 2, GRAY_D); R(1, 13, 2, 5, BLACK); R(13, 13, 2, 5, BLACK); } },
  sofa: { ph: 22, draw: ({ R, box }, W, H) => {
    R(1, H - 21, W - 2, 10, PURPLE); R(1, H - 21, W - 2, 2, '#b893ff');
    box(1, H - 9, W - 2, 7, 6, '#b893ff', DEEP); R(0, H - 17, 4, 15, DEEP); R(W - 4, H - 17, 4, 15, DEEP); R(0, H - 17, 4, 1, '#8f62ef'); R(W - 4, H - 17, 4, 1, '#8f62ef');
    R(16, H - 15, 1, 6, DEEP); R(32, H - 15, 1, 6, DEEP); legs(R, [3, W - 5], H - 2, 2, WOOD_D);
    R(6, H - 19, 6, 5, YELLOW); R(7, H - 18, 2, 1, '#fff2c0'); R(W - 13, H - 19, 6, 5, MINT); R(W - 12, H - 18, 2, 1, '#d5fff2');
  } },
  eggchair: { ph: 34, draw: ({ R, oval, line }) => { line(8, 0, 8, 4, GRAY_D); oval(0, 4, 16, 24, WHITE); oval(3, 8, 10, 17, PINK); R(4, 20, 8, 3, '#ffc3e2'); R(7, 28, 2, 4, GRAY_D); R(3, 32, 10, 2, GRAY_D); } },
  canopy: { ph: 44, draw: ({ R, box }, W, H) => {
    R(1, 0, 2, H - 2, WOOD_D); R(W - 3, 0, 2, H - 2, WOOD_D); R(1, 0, W - 2, 3, PINK); for (let x = 3; x < W - 3; x += 6) R(x, 3, 3, 4, '#ffc3e2');
    R(0, H - 30, 7, 30, WOOD_M); box(6, H - 10, W - 9, 10, 16, WHITE, WOOD_M);
    R(20, H - 26, W - 23, 16, LAV); R(20, H - 26, W - 23, 2, '#e4cfff'); for (let x = 24; x < W - 4; x += 7) R(x, H - 21, 4, 4, '#e4cfff');
    R(8, H - 25, 11, 8, OFF); R(8, H - 25, 11, 2, WHITE); R(W - 4, H - 16, 4, 16, WOOD_M);
  } },
  throne: { ph: 38, draw: ({ R, box }, W, H) => { R(3, 0, W - 6, 24, HOT); R(3, 0, W - 6, 3, GOLD); for (let i = 0; i < 4; i++) R(5 + i * 6, -1 + 0, 3, 3, GOLD); R(7, 5, W - 14, 14, '#ff7fbe'); box(1, H - 12, W - 2, 6, 7, '#ff7fbe', DEEP); R(0, H - 22, 4, 16, GOLD); R(W - 4, H - 22, 4, 16, GOLD); legs(R, [2, W - 4], H - 6, 6, GOLD); } },
  // furniture
  sidetable: { ph: 18, draw: ({ R, box }) => { box(1, 8, 14, 3, 6, '#efc591', WOOD_M); R(2, 11, 12, 5, WOOD_M); R(6, 13, 4, 1, WOOD_D); legs(R, [2, 12], 16, 2); } },
  lamp: { ph: 32, draw: ({ R }) => { R(7, 10, 2, 20, GRAY_D); R(3, 30, 10, 2, GRAY_D); R(2, 0, 12, 9, YELLOW); for (let x = 3; x < 13; x += 3) R(x, 1, 1, 7, '#ffe29a'); R(1, 8, 14, 2, GOLD); R(4, 1, 8, 1, '#fff2c0'); } },
  rug: { flat: true, draw: ({ oval, R }, W, H) => { oval(0, 0, W, H, '#ff9ccf'); oval(3, 2, W - 6, H - 4, '#ffc3e2'); oval(10, 5, W - 20, H - 10, '#ff9ccf'); for (let x = 6; x < W - 6; x += 6) R(x, H / 2, 2, 1, '#ffe0ef'); } },
  lavalamp: { ph: 16, frames: 4, draw: ({ R, oval }, W, H, f) => { R(5, 13, 6, 3, GRAY_D); R(6, 3, 4, 10, '#ff6fb5'); R(6, 1, 4, 2, GRAY_D); oval(6, 4 + f, 3, 3, YELLOW); oval(7, 9 - f, 2, 3, ORANGE); } },
  coffeetable: { ph: 15, draw: ({ R, box }, W, H) => { box(0, H - 8, W, 3, 7, '#efc591', WOOD_M); legs(R, [2, W - 4], H - 5, 5); R(8, H - 11, 6, 3, WHITE); R(14, H - 10, 1, 2, WHITE); R(20, H - 12, 4, 4, '#ff6fb5'); } },
  bookshelf: { ph: 42, draw: ({ R, box, P }, W, H) => {
    box(0, H - 34, W, 34, 8, '#efc591', WOOD_M);
    for (let s = 0; s < 3; s++) {
      const y = H - 31 + s * 11; R(2, y, W - 4, 9, WOOD_D); R(2, y + 9, W - 4, 1, '#efc591');
      let x = 3;
      for (let b = 0; b < 7; b++) { const w = 2 + ((b * 7 + s) % 3), tall = b % 3 === 0 ? 2 : 0, col = [HOT, SKY, YELLOW, MINT, PURPLE, ORANGE, LAV][(b + s * 2) % 7]; R(x, y + 1 + tall, w, 8 - tall, col); R(x, y + 3 + tall, w, 1, shade(col, 0.35)); P(x, y + 1 + tall, shade(col, 0.4)); x += w + 1; if (x > W - 6) break; }
    }
  } },
  dresser: { ph: 24, draw: ({ R, box }, W, H) => { box(0, H - 16, W, 16, 8, WHITE, OFF); for (let i = 0; i < 3; i++) { R(2, H - 14 + i * 5, W - 4, 4, PINK); R(W / 2 - 2, H - 13 + i * 5, 4, 1, HOT); } legs(R, [1, W - 3], H - 1, 1, GRAY_L); R(4, H - 22, 3, 6, '#7fd8ff'); R(W - 9, H - 21, 5, 5, '#ffd36e'); } },
  starrug: { flat: true, draw: ({ R }, W, H) => { R(0, 0, W, H, DEEP); R(2, 1, W - 4, H - 2, PURPLE); for (let i = 0; i < 9; i++) { const x = 4 + ((i * 19) % (W - 8)), y = 2 + ((i * 7) % (H - 4)); R(x, y, 3, 1, YELLOW); R(x + 1, y - 1, 1, 3, YELLOW); } } },
  aquarium: { ph: 26, frames: 4, draw: ({ R, box }, W, H, f) => { box(0, H - 8, W, 8, 6, WOOD_M, WOOD_D); R(1, H - 26, W - 2, 18, '#4fb8e8'); R(1, H - 26, W - 2, 2, '#9fe2ff'); R(2, H - 11, W - 4, 3, '#e8d39a'); R(5, H - 16, 2, 5, LEAF); R(24, H - 18, 2, 7, LEAF); const fx = [6, 12, 18, 12][f]; R(fx, H - 21, 4, 2, ORANGE); R(fx - 1, H - 21, 1, 2, '#ffb36e'); R(26 - fx, H - 15, 3, 2, YELLOW); R(10, H - 24 + (f % 2), 1, 1, WHITE); } },
  // kitchen
  minifridge: { ph: 26, draw: ({ R, box }, W, H) => { box(1, H - 18, 14, 18, 6, WHITE, OFF); R(1, H - 12, 14, 1, GRAY_L); R(11, H - 16, 1, 3, GRAY); R(11, H - 9, 1, 4, GRAY); R(4, H - 15, 4, 2, PINK); R(3, H - 7, 3, 3, '#ffd36e'); } },
  stove: { ph: 24, draw: ({ R, box, oval }, W, H) => { box(0, H - 16, W, 16, 8, GRAY_L, WHITE); R(2, H - 13, W - 4, 7, BLACK); R(3, H - 12, W - 6, 1, '#ff8a5c'); for (const x of [4, 18]) oval(x, H - 23, 10, 5, DARK); R(9, H - 26, 6, 3, GRAY_D); R(2, H - 4, 3, 2, GRAY); oval(18, H - 27, 10, 6, '#c9c2da'); } },
  espresso: { ph: 16, draw: ({ R, box }) => { box(2, 4, 12, 12, 3, RED, '#d93a50'); R(4, 7, 8, 3, DARK); R(6, 10, 4, 1, GRAY_D); R(6, 12, 4, 3, WHITE); R(4, 1, 3, 2, GRAY_D); } },
  popcorn: { ph: 34, frames: 3, draw: ({ R, box }, W, H, f) => { box(1, H - 10, 14, 10, 4, RED, '#d93a50'); R(2, H - 30, 12, 20, '#ffe9a8'); R(2, H - 30, 12, 1, WHITE); for (let i = 0; i < 6; i++) R(3 + ((i * 5 + f) % 10), H - 18 - ((i * 3 + f * 2) % 8), 2, 2, WHITE); R(2, H - 14, 12, 4, YELLOW); R(1, H - 34, 14, 4, RED); R(3, H - 33, 10, 1, YELLOW); } },
  counter: { ph: 26, draw: ({ R, box }, W, H) => { box(0, H - 16, W, 16, 8, WHITE, '#9fe2d3'); for (let i = 0; i < 3; i++) { R(2 + i * 16, H - 13, 13, 11, '#bff0e5'); R(7 + i * 16, H - 9, 3, 1, TEAL); } R(18, H - 22, 10, 4, GRAY_L); R(21, H - 25, 1, 3, GRAY); R(34, H - 21, 6, 5, '#ff9a3d'); } },
  pizzaoven: { ph: 36, frames: 3, draw: ({ R, box, oval }, W, H, f) => { box(0, H - 12, W, 12, 6, '#d98a5c', '#b8663c'); oval(1, H - 36, W - 2, 26, '#e0956a'); oval(9, H - 28, W - 18, 14, BLACK); oval(11, H - 24, W - 22, 8, ['#ff8a3d', '#ffb03d', '#ff6a3d'][f % 3]); R(W / 2 - 3, H - 40, 6, 6, GRAY_D); } },
  bobabar: { ph: 30, draw: ({ R, box }, W, H) => { box(0, H - 18, W, 18, 6, PINK, '#ff7fbe'); R(2, H - 15, W - 4, 3, WHITE); for (let i = 0; i < 4; i++) { R(4 + i * 7, H - 28, 5, 9, '#ffe3c6'); R(4 + i * 7, H - 22, 5, 3, '#c98f5c'); R(4 + i * 7, H - 23, 5, 1, BLACK); R(6 + i * 7, H - 30, 1, 3, HOT); } } },
  // music & dance
  guitar: { ph: 32, wall: true, draw: ({ R, oval }) => { R(7, 2, 2, 16, WOOD_D); R(6, 0, 4, 3, BLACK); oval(2, 15, 12, 10, HOT); oval(3, 22, 10, 9, HOT); oval(6, 20, 4, 4, BLACK); R(7, 16, 2, 12, '#ffe9a8'); } },
  synth: { ph: 20, draw: ({ R, box, line }, W, H) => { box(0, H - 12, W, 4, 6, DARK, BLACK); for (let i = 0; i < 14; i++) R(2 + i * 2, H - 17, 1, 5, WHITE); for (let i = 0; i < 14; i += 2) R(3 + i * 2, H - 17, 1, 3, BLACK); line(4, H - 8, 2, H, GRAY_D); line(W - 4, H - 8, W - 2, H, GRAY_D); line(12, H - 8, 18, H, GRAY_D); line(20, H - 8, 14, H, GRAY_D); R(26, H - 19, 3, 1, HOT); } },
  discoball: { ph: 16, wall: true, frames: 4, draw: ({ R, oval }, W, H, f) => { R(7, 0, 2, 4, GRAY_D); oval(2, 4, 12, 12, GRAY_L); for (let i = 0; i < 6; i++) R(3 + ((i * 3 + f) % 9), 6 + ((i * 5) % 8), 2, 1, [WHITE, SKY, PINK][(i + f) % 3]); } },
  treadmill: { ph: 24, frames: 2, draw: ({ R, box, line }, W, H, f) => { box(0, H - 5, W, 5, 8, BLACK, GRAY_D); for (let x = 2 + f * 2; x < W - 2; x += 4) R(x, H - 12, 1, 6, '#4a3f70'); R(1, H - 12, W - 2, 1, DARK); line(W - 6, H - 8, W - 4, H - 24, GRAY_L); line(W - 5, H - 8, W - 3, H - 24, GRAY_L); R(W - 9, H - 24, 8, 3, DARK); R(W - 7, H - 23, 3, 1, MINT); } },
  drums: { ph: 26, draw: ({ R, oval, line }, W, H) => { oval(8, H - 18, 16, 16, RED); oval(10, H - 16, 12, 12, WHITE); R(15, H - 12, 2, 4, RED); oval(0, H - 16, 10, 5, GRAY_L); oval(22, H - 16, 10, 5, GRAY_L); R(4, H - 12, 2, 12, GRAY_D); R(26, H - 12, 2, 12, GRAY_D); line(1, H - 24, 9, H - 22, GOLD); R(4, H - 23, 2, 1, GRAY_D); } },
  piano: { ph: 30, draw: ({ R, box }, W, H) => { R(1, H - 30, W - 2, 14, BLACK); R(2, H - 29, W - 4, 2, '#3e3360'); box(0, H - 13, W, 4, 6, WHITE, BLACK); for (let i = 0; i < 22; i++) R(1 + i * 2, H - 19, 1, 6, WHITE); for (let i = 0; i < 22; i++) if (i % 7 !== 2 && i % 7 !== 6) R(2 + i * 2, H - 19, 1, 3, BLACK); legs(R, [2, W - 4], H - 9, 9, BLACK); R(W / 2 - 4, H - 27, 8, 6, WHITE); R(W / 2 - 3, H - 25, 6, 1, GRAY_L); } },
  dj: { ph: 30, frames: 4, draw: ({ R, box, oval }, W, H, f) => { box(0, H - 16, W, 16, 6, DARK, BLACK); for (let i = 0; i < 6; i++) R(3 + i * 7, H - 12, 5, 8, ['#ff4da6', '#7f6bff', '#2fd6a6', '#ffd36e', '#ff9a3d', '#7fe0ff'][(i + f) % 6]); oval(4, H - 26, 12, 6, GRAY_D); oval(W - 16, H - 26, 12, 6, GRAY_D); R(9, H - 24, 2, 2, HOT); R(W - 11, H - 24, 2, 2, SKY); R(20, H - 24, 8, 3, GRAY); R(22 + (f % 2) * 2, H - 23, 2, 1, MINT); } },
  dancefloor: { flat: true, frames: 4, draw: ({ R }, W, H, f) => { for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 8) R(x, y, 8, 4, ['#ff4da6', '#7f6bff', '#2fd6a6', '#ffd36e'][((x >> 3) + (y >> 2) + f) % 4]); for (let x = 0; x < W; x += 8) R(x, 0, 1, H, '#2a1440'); for (let y = 0; y < H; y += 4) R(0, y, W, 1, '#2a1440'); } },
  // art
  easel: { ph: 34, draw: ({ R, line }) => { line(3, 33, 8, 2, WOOD_D); line(13, 33, 8, 2, WOOD_D); line(8, 6, 8, 33, WOOD_M); R(2, 6, 12, 14, WHITE); R(3, 8, 4, 4, HOT); R(8, 10, 5, 3, SKY); R(4, 14, 8, 3, YELLOW); R(1, 20, 14, 2, WOOD_M); } },
  artdesk: { ph: 24, draw: ({ R, box, line }, W, H) => { box(0, H - 15, W, 3, 8, WHITE, LAV); legs(R, [2, W - 4], H - 12, 12, GRAY_L); R(4, H - 21, 10, 5, YELLOW); R(17, H - 22, 2, 6, HOT); R(20, H - 21, 2, 5, SKY); R(23, H - 23, 2, 7, MINT); line(30, H - 22, 40, H - 18, PURPLE); R(34, H - 12, 10, 6, LAV); } },
  sculpture: { ph: 40, draw: ({ R, box, oval }) => { box(1, 28, 14, 12, 4, OFF, GRAY_L); oval(3, 2, 10, 12, WHITE); oval(1, 10, 14, 14, WHITE); R(5, 6, 6, 2, GRAY_L); R(4, 16, 8, 6, OFF); R(6, 24, 4, 4, WHITE); } },
  gallery: { ph: 32, wall: true, draw: ({ R }) => { const fr = [[1, 1, 14, 12, HOT], [17, 0, 12, 16, SKY], [31, 2, 16, 11, YELLOW], [2, 16, 12, 14, MINT], [16, 18, 16, 12, PURPLE], [34, 15, 12, 15, ORANGE]]; for (const [x, y, w, h, c] of fr) { R(x, y, w, h, GOLD); R(x + 1, y + 1, w - 2, h - 2, c); R(x + 2, y + h - 4, w - 4, 2, shade(c, -0.25)); R(x + 3, y + 2, 2, 2, WHITE); } } },
  // plants
  cactus: { ph: 13, draw: ({ R }) => { R(5, 9, 6, 4, '#e0956a'); R(5, 9, 6, 1, '#f0b08a'); R(7, 1, 3, 8, LEAF); R(5, 4, 2, 3, LEAF); R(10, 3, 2, 3, LEAF); R(8, 2, 1, 6, LEAF_L); R(8, 0, 1, 1, HOT); } },
  pottedplant: { ph: 22, draw: ({ R, P, oval }) => { R(4, 15, 8, 7, '#e0956a'); R(3, 15, 10, 2, '#f0b08a'); R(5, 18, 6, 1, '#c97a50'); oval(0, 0, 9, 10, LEAF); oval(7, 2, 9, 9, LEAF_D); oval(3, 6, 10, 10, LEAF); leaf(R, P, 3, 3); leaf(R, P, 9, 6, LEAF_L); } },
  monstera: { ph: 38, draw: ({ R, oval, line }) => { R(4, 30, 8, 8, WHITE); R(3, 30, 10, 2, OFF); line(8, 30, 4, 12, LEAF_D); line(8, 30, 12, 8, LEAF_D); oval(-1, 6, 10, 12, LEAF); oval(7, 0, 10, 12, LEAF); oval(3, 14, 12, 12, LEAF_D); R(2, 10, 1, 4, LEAF_D); R(11, 4, 1, 5, LEAF_D); R(8, 18, 1, 5, LEAF); R(3, 8, 2, 1, LEAF_L); R(10, 2, 2, 1, LEAF_L); } },
  hangingplant: { ph: 16, wall: true, draw: ({ R, oval, line }) => { line(8, 0, 8, 4, WOOD_D); R(4, 4, 8, 5, WHITE); oval(1, 7, 6, 9, LEAF); oval(9, 7, 6, 9, LEAF_D); oval(5, 8, 6, 6, LEAF); R(3, 9, 1, 2, LEAF_L); } },
  bonsai: { ph: 14, draw: ({ R, oval }) => { R(2, 11, 12, 3, '#3b6fd0'); R(1, 11, 14, 1, '#6f9bf0'); R(7, 6, 2, 5, WOOD_D); oval(1, 1, 8, 6, LEAF); oval(7, 0, 8, 6, LEAF_D); oval(4, 3, 6, 4, LEAF_L); } },
  tree: { ph: 52, draw: ({ R, oval }, W, H) => { R(10, H - 9, 12, 9, '#e0956a'); R(9, H - 9, 14, 2, '#f0b08a'); R(15, H - 26, 3, 17, WOOD_D); oval(1, 0, 18, 18, LEAF); oval(13, 4, 18, 18, LEAF_D); oval(5, 12, 22, 16, LEAF); R(8, 5, 3, 3, LEAF_L); R(20, 10, 3, 2, LEAF_L); R(12, 16, 2, 2, LEAF_L); } },
  // pets & plushies
  bear: { ph: 12, draw: ({ R, oval }) => { oval(3, 5, 10, 7, '#c98f5c'); oval(4, 0, 8, 7, '#c98f5c'); R(4, 0, 2, 2, '#c98f5c'); R(10, 0, 2, 2, '#c98f5c'); R(6, 3, 1, 1, BLACK); R(9, 3, 1, 1, BLACK); R(7, 4, 2, 1, '#e0b07a'); R(6, 7, 4, 3, '#e0b07a'); R(7, 10, 2, 1, HOT); } },
  bunny: { ph: 15, draw: ({ R, oval }) => { R(5, 0, 2, 6, WHITE); R(9, 0, 2, 6, WHITE); R(5, 1, 1, 4, PINK); R(10, 1, 1, 4, PINK); oval(4, 4, 8, 7, WHITE); oval(3, 9, 10, 6, WHITE); R(6, 7, 1, 1, BLACK); R(9, 7, 1, 1, BLACK); R(7, 8, 2, 1, PINK); } },
  fishbowl: { ph: 13, frames: 4, draw: ({ R, oval, hole }, W, H, f) => { oval(2, 1, 12, 12, '#bfe9ff'); hole(4, 0, 8, 3); oval(3, 4, 10, 8, '#7fd0ff'); R(5 + f, 7, 3, 2, ORANGE); R(4 + f, 7, 1, 2, '#ffb36e'); R(4, 1, 8, 1, '#e6f8ff'); } },
  cat: { ph: 10, pet: true, draw: () => {} },
  cattree: { ph: 40, draw: ({ R, box, oval }) => { box(0, 38, 16, 2, 4, GRAY_L, GRAY); R(6, 10, 4, 28, '#e8d39a'); for (let y = 12; y < 38; y += 3) R(6, y, 4, 1, '#c9b06a'); box(1, 22, 14, 3, 5, PURPLE, DEEP); box(2, 8, 12, 3, 5, PURPLE, DEEP); oval(3, 0, 10, 6, PINK); } },
  giantplush: { ph: 30, draw: ({ R, oval }) => { oval(2, 12, 28, 18, PINK); oval(5, 0, 22, 18, PINK); oval(5, 0, 7, 7, PINK); oval(20, 0, 7, 7, PINK); R(7, 2, 3, 3, '#ffc3e2'); R(22, 2, 3, 3, '#ffc3e2'); R(11, 8, 2, 2, BLACK); R(19, 8, 2, 2, BLACK); R(14, 11, 4, 2, HOT); oval(9, 17, 14, 10, '#ffc3e2'); } },
  robodog: { ph: 11, pet: true, draw: () => {} },
  plushpile: { ph: 40, draw: ({ R, oval }) => { const c = [[0, 22, 14, 18, PINK], [12, 20, 14, 20, YELLOW], [22, 24, 10, 16, MINT], [4, 10, 12, 14, LAV], [14, 6, 12, 15, SKY], [9, 0, 10, 11, HOT]]; for (const [x, y, w, h, col] of c) { oval(x, y, w, h, col); R(x + w / 2 - 2, y + h / 3, 1, 1, BLACK); R(x + w / 2 + 1, y + h / 3, 1, 1, BLACK); } } },
  // on the wall
  gameposter: { ph: 32, wall: true, draw: ({ R }) => { R(1, 1, 14, 30, NAVY); R(2, 2, 12, 28, BLUE); R(3, 18, 10, 10, '#2f3fa0'); R(5, 6, 6, 6, YELLOW); R(6, 7, 1, 1, BLACK); R(9, 7, 1, 1, BLACK); R(4, 13, 8, 2, HOT); R(4, 24, 3, 2, MINT); R(9, 22, 3, 2, MINT); R(3, 3, 10, 1, '#7fb0ff'); } },
  starposter: { ph: 32, wall: true, draw: ({ R }) => { R(1, 1, 14, 30, PINK); R(2, 2, 12, 28, '#ffc3e2'); R(7, 6, 2, 12, YELLOW); R(3, 10, 10, 3, YELLOW); R(5, 8, 6, 7, YELLOW); R(4, 22, 8, 2, HOT); R(5, 26, 6, 1, HOT); } },
  clock: { ph: 16, wall: true, frames: 4, draw: ({ R, oval, line }, W, H, f) => { oval(1, 1, 14, 14, WHITE); oval(3, 3, 10, 10, '#fff6e0'); R(8, 3, 1, 1, GRAY_D); R(8, 12, 1, 1, GRAY_D); R(3, 8, 1, 1, GRAY_D); R(12, 8, 1, 1, GRAY_D); line(8, 8, 8, 5, BLACK); const h = [[11, 8], [10, 11], [6, 11], [5, 6]][f]; line(8, 8, h[0], h[1], HOT); } },
  wallshelf: { ph: 16, wall: true, draw: ({ R, oval }) => { R(0, 11, 32, 3, WOOD_M); R(0, 11, 32, 1, '#efc591'); R(3, 14, 2, 2, WOOD_D); R(27, 14, 2, 2, WOOD_D); R(2, 4, 4, 7, HOT); R(6, 5, 3, 6, SKY); R(9, 3, 3, 8, YELLOW); oval(15, 4, 7, 7, WHITE); R(17, 6, 1, 1, BLACK); R(20, 6, 1, 1, BLACK); R(25, 6, 5, 5, LEAF); } },
  meme: { ph: 16, wall: true, draw: ({ R }) => { R(1, 1, 14, 14, GOLD); R(2, 2, 12, 12, WHITE); R(4, 4, 8, 6, '#ffe3c6'); R(5, 6, 1, 1, BLACK); R(10, 6, 1, 1, BLACK); R(6, 8, 4, 1, BLACK); R(3, 11, 10, 1, BLACK); R(4, 12, 8, 1, BLACK); } },
  map: { ph: 16, wall: true, draw: ({ R }) => { R(0, 1, 32, 14, '#9fe2ff'); R(1, 2, 30, 12, '#bfeeff'); R(4, 4, 7, 5, LEAF); R(6, 9, 3, 3, LEAF); R(14, 3, 5, 4, LEAF); R(15, 7, 3, 5, LEAF); R(22, 4, 7, 4, LEAF); R(25, 10, 4, 2, LEAF); R(16, 5, 1, 1, RED); } },
  neon: { ph: 16, wall: true, outlined: false, draw: ({ R }) => {
    const c = '#ff5fb5';
    R(3, 3, 1, 10, c); R(8, 3, 1, 10, c); R(4, 2, 4, 1, c); R(4, 8, 4, 1, c);
    R(11, 3, 1, 9, c); R(12, 2, 5, 1, c); R(12, 12, 5, 1, c); R(16, 8, 1, 4, c); R(14, 8, 2, 1, c);
    R(20, 2, 1, 11, c);
    R(26, 4, 2, 2, c); R(30, 4, 2, 2, c); R(25, 5, 1, 3, c); R(32, 5, 1, 3, c); R(28, 5, 2, 1, c); R(26, 8, 6, 1, c); R(27, 9, 4, 1, c); R(28, 10, 2, 1, c);
  } },
  bigwindow: { ph: 32, wall: true, draw: (g, W, H, f, v) => windowArt(g, W, H, v, { panes: 3, curtain: true }) },
  tv: { ph: 32, wall: true, frames: 4, draw: ({ R }, W, H, f) => { R(1, 3, 30, 22, BLACK); R(1, 3, 30, 1, '#4a3f70'); screenOn(R, 2, 4, 28, 20, f, ['#5b6cf0', '#ff6fb5', '#2fd6a6', '#ff9a3d'][f]); R(6, 9, 8, 8, YELLOW); R(17, 12, 9, 4, WHITE); R(14, 25, 4, 3, GRAY_D); R(10, 28, 12, 1, GRAY_D); } },
  ledwall: { ph: 32, wall: true, frames: 4, draw: ({ R }, W, H, f) => { R(0, 0, W, H, BLACK); for (let y = 2; y < H - 1; y += 3) for (let x = 2; x < W - 1; x += 3) R(x, y, 2, 2, ['#ff4da6', '#7f6bff', '#2fd6a6', '#ffd36e', '#7fe0ff'][(Math.floor(x / 3) + Math.floor(y / 3) + f) % 5]); } },
  spacewindow: { ph: 32, wall: true, draw: (g, W, H, f, v) => windowArt(g, W, H, { ...v, view: 'space' }, { panes: 1, round: true }) },
  // silly stuff
  duck: { ph: 9, draw: ({ R, oval }) => { oval(3, 4, 10, 5, YELLOW); oval(8, 0, 6, 6, YELLOW); R(13, 3, 3, 2, ORANGE); R(10, 2, 1, 1, BLACK); R(5, 5, 4, 1, GOLD); } },
  banana: { ph: 6, draw: ({ R }) => { R(3, 3, 9, 2, YELLOW); R(2, 2, 2, 2, YELLOW); R(11, 1, 2, 3, YELLOW); R(1, 1, 1, 1, '#6a4a2a'); R(13, 0, 1, 1, '#6a4a2a'); R(4, 4, 7, 1, GOLD); } },
  whoopee: { ph: 6, draw: ({ oval, R }) => { oval(0, 0, 14, 6, HOT); R(13, 2, 3, 2, HOT); oval(2, 1, 6, 2, '#ff9ccf'); } },
  trophy: { ph: 14, draw: ({ R, oval }) => { R(4, 12, 8, 2, WOOD_D); R(7, 8, 2, 4, GOLD); oval(3, 0, 10, 9, GOLD); R(1, 2, 2, 4, GOLD); R(13, 2, 2, 4, GOLD); R(5, 1, 2, 4, YELLOW); } },
  ballpit: { ph: 22, draw: ({ R, box, oval }, W, H) => { box(0, H - 8, W, 8, 16, '#ff9ccf', HOT); for (let r = 0; r < 4; r++) for (let x = 1 + (r % 2) * 2; x < W - 4; x += 4) oval(x, H - 26 + r * 4 + ((x * 7 + r) % 3), 4, 4, [RED, YELLOW, SKY, MINT, PURPLE][(x * 3 + r * 2) % 5]); R(0, H - 8, W, 1, '#ff7fbe'); } },
  clawmachine: { ph: 40, frames: 3, draw: ({ R, box, line }, W, H, f) => { box(1, H - 14, 14, 14, 4, HOT, '#d9358a'); R(1, H - 38, 14, 24, '#bfeeff'); R(1, H - 40, 14, 3, HOT); R(2, H - 37, 12, 1, WHITE); line(8, H - 37, 8, H - 30 + f, GRAY_D); R(6, H - 30 + f, 5, 1, GRAY_D); R(6, H - 29 + f, 1, 2, GRAY_D); R(10, H - 29 + f, 1, 2, GRAY_D); for (let i = 0; i < 5; i++) R(2 + i * 2.5, H - 18 - (i % 2) * 2, 2, 2, [YELLOW, MINT, PINK, SKY, ORANGE][i]); R(4, H - 10, 3, 2, YELLOW); } },
  confetti: { ph: 30, draw: ({ R, line, oval }, W, H) => { R(3, H - 4, 10, 4, GRAY_D); line(5, H - 4, 8, H - 12, GRAY_D); oval(4, H - 26, 8, 16, HOT); R(5, H - 26, 6, 3, YELLOW); R(6, H - 20, 4, 2, WHITE); for (let i = 0; i < 6; i++) R(2 + i * 2, H - 30 + (i % 3), 1, 2, [YELLOW, MINT, SKY][i % 3]); } },
  statue: { ph: 42, draw: ({ R, box, oval }) => { box(1, 32, 14, 10, 4, '#ffe9a8', GOLD); oval(4, 0, 9, 9, YELLOW); R(3, 3, 2, 12, GOLD); R(12, 3, 2, 12, GOLD); R(5, 9, 7, 10, GOLD); R(6, 19, 5, 4, YELLOW); R(6, 23, 2, 9, GOLD); R(9, 23, 2, 9, GOLD); R(13, 6, 2, 6, YELLOW); R(6, 2, 2, 1, '#fff6c9'); } },
  // ---------- only in mystery boxes ----------
  snackjar: { ph: 13, draw: ({ R, P, oval }) => { R(4, 0, 8, 2, HOT); R(3, 2, 10, 11, '#d8f4ff'); R(3, 2, 10, 1, '#ffffff'); for (let i = 0; i < 9; i++) oval(4 + (i % 3) * 3, 5 + Math.floor(i / 3) * 2.5, 3, 3, [RED, YELLOW, MINT, PINK, SKY, ORANGE][i % 6]); P(4, 3, '#ffffff'); } },
  moonlamp: { ph: 14, draw: ({ R, P, oval }) => { R(5, 12, 6, 2, WOOD_D); R(7, 9, 2, 3, WOOD_M); oval(2, 0, 12, 11, '#fff3c0'); oval(4, 2, 3, 3, '#f3dc8a'); oval(9, 5, 3, 3, '#f3dc8a'); P(5, 7, '#f3dc8a'); R(3, 2, 2, 1, '#ffffff'); } },
  rocketlamp: { ph: 32, draw: ({ R, P, oval }) => { R(4, 28, 8, 4, GRAY_D); oval(4, 0, 8, 12, WHITE); R(4, 6, 8, 18, WHITE); R(4, 6, 1, 18, '#ffffff'); oval(6, 9, 4, 4, '#7fd8ff'); P(7, 10, '#ffffff'); R(5, 3, 6, 2, RED); R(1, 18, 3, 6, RED); R(12, 18, 3, 6, RED); R(6, 24, 4, 4, ORANGE); R(7, 26, 2, 2, YELLOW); } },
  bubbler: { ph: 24, frames: 4, draw: ({ R, P, oval }, W, H, f) => { R(3, H - 10, 10, 10, SKY); R(3, H - 10, 10, 1, '#c9f4ff'); R(5, H - 7, 6, 3, BLUE); R(6, H - 14, 2, 4, GRAY_D); oval(4, H - 18, 6, 5, GRAY_L); for (let i = 0; i < 4; i++) { const y = ((i * 5 + f * 3) % 12); oval(7 + (i % 2) * 4, y, 4, 4, ['#ffc3e2', '#c9f4ff', '#fff3c0', '#e4cfff'][i]); P(8 + (i % 2) * 4, y + 1, '#ffffff'); } } },
  snowglobe: { ph: 13, frames: 3, draw: ({ R, P, oval }, W, H, f) => { R(3, 10, 10, 3, WOOD_D); R(4, 10, 8, 1, WOOD_M); oval(2, 0, 12, 11, '#d8f4ff'); R(6, 5, 4, 4, '#ff9ccf'); R(5, 4, 6, 1, '#d9358a'); R(7, 7, 2, 2, '#ffd36e'); for (let i = 0; i < 5; i++) P(4 + ((i * 3 + f * 2) % 8), 2 + ((i * 2 + f) % 6), '#ffffff'); } },
  capsule: { ph: 30, draw: ({ R, P, oval, box }, W, H) => { box(1, H - 12, 14, 12, 4, RED, '#d93a50'); R(5, H - 8, 6, 4, DARK); oval(7, H - 6, 2, 2, YELLOW); oval(1, 0, 14, 16, '#d8f4ff'); for (let i = 0; i < 7; i++) oval(3 + (i % 3) * 3.5, 5 + Math.floor(i / 3) * 3.5, 4, 4, [HOT, YELLOW, MINT, SKY, ORANGE, PURPLE, PINK][i]); R(3, 1, 4, 1, '#ffffff'); P(2, 3, '#ffffff'); } },
  karaoke: { ph: 26, draw: ({ R, oval, box }, W, H) => { box(1, H - 16, 14, 16, 4, DARK, BLACK); oval(4, H - 14, 8, 8, GRAY_D); oval(6, H - 12, 4, 4, '#4a3f70'); R(3, H - 4, 10, 2, [HOT, SKY, YELLOW][0]); R(5, H - 4, 2, 2, SKY); R(9, H - 4, 2, 2, YELLOW); R(7, H - 24, 2, 4, GRAY); oval(6, H - 26, 4, 4, GRAY_L); } },
  neuralart: { ph: 32, wall: true, draw: ({ R, line, oval }, W, H) => { R(0, 0, W, H, GOLD); R(1, 1, W - 2, H - 2, '#1f1840'); const n = [[6, 8], [6, 16], [6, 24], [16, 6], [16, 13], [16, 20], [16, 27], [26, 12], [26, 21]]; for (const a of [0, 1, 2]) for (const b of [3, 4, 5, 6]) line(n[a][0], n[a][1], n[b][0], n[b][1], '#5a4fa0'); for (const a of [3, 4, 5, 6]) for (const b of [7, 8]) line(n[a][0], n[a][1], n[b][0], n[b][1], '#7f6bff'); n.forEach(([x, y], i) => oval(x - 2, y - 2, 4, 4, [HOT, SKY, MINT, YELLOW][i % 4])); } },
  losscurve: { ph: 32, wall: true, draw: ({ R, line }) => { R(1, 1, 14, 30, WHITE); R(2, 2, 12, 28, '#f6f2ff'); R(3, 6, 1, 20, DARK); R(3, 25, 10, 1, DARK); line(4, 8, 6, 15, HOT); line(6, 15, 8, 19, HOT); line(8, 19, 10, 22, HOT); line(10, 22, 13, 23, HOT); R(3, 3, 9, 1, PURPLE); R(5, 28, 6, 1, GRAY); } },
  plushagi: { ph: 13, draw: ({ R, P, oval }) => { oval(3, 6, 10, 7, '#c9a2f2'); R(6, 8, 1, 2, '#ffffff'); R(8, 8, 1, 2, '#ffffff'); P(7, 8, '#ffffff'); oval(2, 0, 12, 9, '#ffd36e'); oval(4, 2, 8, 6, '#ffdcc6'); R(5, 4, 1, 2, '#4b2a63'); R(10, 4, 1, 2, '#4b2a63'); P(7, 6, '#c44f6a'); R(2, 3, 2, 6, '#ffd36e'); R(12, 3, 2, 6, '#ffd36e'); } },
  brainjar: { ph: 16, frames: 2, draw: ({ R, P, oval }, W, H, f) => { R(3, 14, 10, 2, GRAY_D); R(4, 0, 8, 2, GRAY); R(3, 2, 10, 12, '#d8f4ff'); oval(4, 5, 8, 7, f ? '#ff8ac0' : '#ff9ccf'); R(7, 6, 1, 5, '#e0609a'); P(6, 7, '#ffc3e2'); P(9, 9, '#ffc3e2'); P(5 + f, 3, '#ffffff'); P(10, 4 - f, '#ffffff'); R(3, 2, 1, 12, '#ffffff'); } },
  gpushrine: { ph: 28, frames: 2, draw: ({ R, P, box }, W, H, f) => { box(0, H - 10, 16, 10, 5, '#efc591', WOOD_M); R(1, H - 7, 14, 1, WOOD_D); R(3, H - 22, 10, 7, DARK); R(3, H - 22, 10, 1, '#5a4f80'); R(4, H - 20, 3, 3, GRAY_D); R(9, H - 20, 3, 3, GRAY_D); R(4, H - 16, 8, 1, GREEN); R(1, H - 19, 2, 6, WHITE); R(13, H - 19, 2, 6, WHITE); P(1 + f, H - 21, ORANGE); P(14 - f, H - 21, ORANGE); P(1 + f, H - 20, YELLOW); P(14 - f, H - 20, YELLOW); } },
  jukebox: { ph: 34, frames: 3, draw: ({ R, oval, box }, W, H, f) => { box(1, H - 20, 14, 20, 3, WOOD_M, WOOD_D); oval(1, H - 34, 14, 18, WOOD_M); oval(3, H - 31, 10, 12, ['#ff4da6', '#ffd36e', '#7fe0ff'][f]); oval(5, H - 29, 6, 8, '#fff3c0'); R(3, H - 17, 10, 6, DARK); for (let i = 0; i < 4; i++) R(4 + i * 2.5, H - 16, 1, 4, [HOT, YELLOW, MINT, SKY][(i + f) % 4]); R(4, H - 8, 8, 2, GOLD); } },
  gamingpod: { ph: 30, draw: ({ R, oval }, W, H) => { oval(0, 4, W, H - 4, DARK); oval(2, 6, W - 4, H - 8, '#4a3f70'); R(4, 8, 10, 7, BLACK); R(5, 9, 8, 5, '#5b6cf0'); R(18, 8, 10, 7, BLACK); R(19, 9, 8, 5, '#ff6fb5'); R(10, 18, 12, 8, HOT); R(11, 19, 10, 1, '#ff9ccf'); R(6, H - 5, 20, 3, GRAY_D); R(13, 0, 6, 5, PURPLE); } },
  ramenbar: { ph: 34, draw: ({ R, P, box }, W, H) => { box(0, H - 16, W, 16, 8, '#efc591', WOOD_M); R(0, H - 34, W, 4, RED); for (let i = 0; i < 4; i++) { R(2 + i * 12, H - 30, 10, 7, i % 2 ? '#ffffff' : '#ffe3e3'); P(6 + i * 12, H - 27, RED); } for (let i = 0; i < 3; i++) { R(6 + i * 14, H - 28 + 6, 8, 4, WHITE); R(6 + i * 14, H - 28 + 6, 8, 1, '#ffd36e'); R(10 + i * 14, H - 26, 1, 4, WOOD_D); } R(2, H - 13, W - 4, 1, WOOD_D); } },
  wallaquarium: { ph: 32, wall: true, frames: 4, draw: ({ R, P }, W, H, f) => { R(0, 0, W, H, GRAY_D); R(2, 2, W - 4, H - 4, '#4fb8e8'); R(2, 2, W - 4, 3, '#9fe2ff'); R(2, H - 7, W - 4, 5, '#e8d39a'); for (let i = 0; i < 4; i++) R(6 + i * 11, H - 14, 2, 7, LEAF); const fx = [8, 16, 26, 16][f]; R(fx, 12, 5, 3, ORANGE); P(fx - 1, 13, '#ffb36e'); R(W - fx - 6, 20, 4, 2, YELLOW); R(20, 8, 4, 2, HOT); P(12, 6 + (f % 2) * 2, WHITE); P(34, 9 - (f % 2), WHITE); } },
  holocat: { ph: 10, pet: true, draw: () => {} },
  robobutler: { ph: 16, pet: true, draw: () => {} },
  goldmic: { ph: 15, draw: ({ R, P, oval }) => { R(4, 13, 8, 2, GOLD); R(7, 7, 2, 6, GOLD); oval(4, 0, 8, 8, '#ffd84a'); R(5, 2, 6, 1, GOLD); R(5, 4, 6, 1, GOLD); P(6, 1, '#ffffff'); P(13, 1, '#ffffff'); P(1, 5, '#fff6c9'); } },
  slide: { ph: 40, draw: ({ R, line }, W, H) => { R(1, 6, 2, H - 6, GRAY_D); R(9, 6, 2, H - 6, GRAY_D); for (let y = 10; y < H - 2; y += 5) R(3, y, 6, 1, GRAY); R(0, 4, 12, 3, RED); const cols = [RED, ORANGE, YELLOW, GREEN, SKY, PURPLE]; for (let i = 0; i < 6; i++) line(11, 6 + i, W - 2, H - 7 + i, cols[i]); R(W - 6, H - 3, 6, 3, PURPLE); } },
  cloudbed: { ph: 26, draw: ({ R, oval }, W, H) => { oval(0, H - 16, W, 16, WHITE); oval(4, H - 22, 16, 14, WHITE); oval(16, H - 25, 18, 16, WHITE); oval(30, H - 21, 16, 13, WHITE); R(4, H - 8, W - 8, 2, '#e6e0f2'); R(8, H - 18, 10, 6, '#ffc3e2'); R(22, H - 17, 10, 6, '#c9f4ff'); R(36, H - 16, 8, 5, '#fff3c0'); } },
  agicore: { ph: 40, frames: 4, draw: ({ R, P, oval, box }, W, H, f) => { box(2, H - 8, W - 4, 8, 6, GRAY_D, DARK); oval(4, H - 38, W - 8, 30, ['#7fe0ff', '#9ff6ff', '#c9f7ff', '#9ff6ff'][f]); oval(8, H - 34, W - 16, 22, '#ffffff'); oval(11, H - 31, W - 22, 16, ['#ff9ccf', '#c9a2f2', '#ffd36e', '#c9a2f2'][f]); R(4, H - 24 + (f % 2), W - 8, 2, PURPLE); R(W / 2 - 1, H - 38, 2, 30, '#b46bff'); P(10, H - 32, '#ffffff'); R(11, H - 6, 3, 2, MINT); R(W - 14, H - 6, 3, 2, HOT); } },
};
// the plaques: a mic on a coloured shield
for (const [id, color] of [['bronze', '#d08a4e'], ['silver', '#c9d4e3'], ['gold', '#ffc933'], ['diamond', '#7fe0ff'], ['ruby', '#ff4d8d'], ['galaxy', '#9b6bff']]) {
  ART[`plaque_${id}`] = { ph: 16, wall: true, draw: ({ R, oval }) => { R(2, 1, 12, 13, WOOD_M); R(3, 2, 10, 11, color); R(4, 3, 2, 3, shade(color, 0.45)); oval(6, 4, 4, 5, WHITE); R(7, 9, 2, 3, WHITE); R(5, 12, 6, 1, WHITE); R(3, 14, 10, 2, WOOD_D); } };
}
export const ITEM_ART_IDS = Object.keys(ART);

// a thing’s sprite (`f` its frame; `v` { view, night } for the windows) → { canvas, w, h }
export function itemSprite(id, f = 0, v = {}) {
  const art = ART[id], def = itemOf(id);
  if (!art || !def) return null;
  if (id === 'cat' || id === 'holocat') return catSprite(f % 2 ? 'walk0' : 'sit', id);
  if (id === 'robodog') return dogSprite(`walk${f % 2}`);
  if (id === 'robobutler') return butlerSprite(`walk${f % 2}`);
  const W = def.w * CELL, H = art.flat ? def.h * ROW : def.place === 'wall' ? def.h * WROW : art.ph;
  const n = art.frames || 1, fr = ((f % n) + n) % n;
  const key = `item:${id}:${fr}${art.wall && /window/.test(id) ? `:${v.view}:${v.night ? 1 : 0}` : ''}`;
  return sprite(key, W, H, (g) => art.draw(g, W, H, fr, v), { outlined: art.outlined !== false });
}
export const framesOf = (id) => ART[id]?.frames || 1;
// a pet’s sprite, by its pose
export function petSprite(id, pose) {
  if (id === 'robodog') return dogSprite(pose === 'sleep' ? 'walk0' : pose);
  if (id === 'robobutler') return butlerSprite(pose === 'sleep' ? 'walk0' : pose);
  return catSprite(pose, id);
}

// ---------- her room: walls, floor, the frame round it ----------
export const SIDE = 6, CEIL = 8, BASE = 3, LIP = 6;
export function roomGeom(home) {
  const W = home.cols * CELL + SIDE * 2, wallTop = CEIL, wallBottom = CEIL + home.wall * WROW;
  const floorTop = wallBottom + BASE, floorBottom = floorTop + home.rows * ROW;
  return { W, H: floorBottom + LIP, x0: SIDE, wallTop, wallBottom, floorTop, floorBottom, cols: home.cols, rows: home.rows, wall: home.wall };
}
const hash = (a, b = 0) => { let h = (a * 374761393 + b * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export function roomSprite(home) {
  const G = roomGeom(home);
  return sprite(`room:${home.id}`, G.W, G.H, ({ R, P }) => {
    const { W, H, x0, wallTop, wallBottom, floorTop, floorBottom } = G, iw = W - 2 * x0, wh = wallBottom - wallTop;
    const A = home.wallA, B = home.wallB;
    R(0, 0, W, H, '#2a1440');
    // the wall and its paper
    R(x0, wallTop, iw, wh, A);
    if (home.paper === 'dots') { for (let y = wallTop + 4; y < wallBottom; y += 8) for (let x = x0 + (((y - wallTop) / 8) % 2 ? 4 : 0) + 2; x < x0 + iw; x += 8) { R(x, y, 2, 2, B); P(x, y, shade(B, 0.25)); } }
    else if (home.paper === 'stripes') { for (let x = x0 + 2; x < x0 + iw; x += 10) { R(x, wallTop, 4, wh, B); R(x + 5, wallTop, 1, wh, shade(A, 0.3)); } }
    else if (home.paper === 'brick') {
      for (let r = 0, y = wallTop; y < wallBottom; r++, y += 5) for (let x = x0 - (r % 2) * 6; x < x0 + iw; x += 12) {
        const c = mix(A, B, hash(x, r)); R(Math.max(x0, x), y, Math.min(11, x0 + iw - Math.max(x0, x)), 4, c); R(Math.max(x0, x), y, Math.min(11, x0 + iw - Math.max(x0, x)), 1, shade(c, 0.12));
      }
      for (let y = wallTop + 4; y < wallBottom; y += 5) R(x0, y, iw, 1, '#e8cdb8');
    } else if (home.paper === 'panels') { for (let x = x0; x < x0 + iw; x += 32) { R(x, wallTop, 1, wh, B); R(x + 1, wallTop, 1, wh, shade(A, 0.3)); } R(x0, wallBottom - Math.round(wh * 0.38), iw, 2, B); R(x0, wallBottom - Math.round(wh * 0.38) - 1, iw, 1, shade(A, 0.3)); }
    else if (home.paper === 'damask') { for (let y = wallTop + 6; y < wallBottom; y += 12) for (let x = x0 + ((y / 12) % 2 ? 8 : 2); x < x0 + iw; x += 16) { R(x + 2, y, 2, 6, B); R(x, y + 2, 6, 2, B); P(x + 2, y + 2, '#ffc933'); } R(x0, wallBottom - 14, iw, 1, '#ffc933'); R(x0, wallBottom - 13, iw, 13, shade(A, -0.15)); }
    else { for (let x = x0; x < x0 + iw; x += 24) { R(x, wallTop, 1, wh, '#211b44'); for (let y = wallTop + 4; y < wallBottom; y += 16) { P(x + 3, y, '#6a62a8'); P(x + 20, y, '#6a62a8'); } } R(x0, wallTop + 22, iw, 2, '#251e4c'); R(x0, wallTop + 22, iw, 1, '#7fe0ff'); }
    // light: the wall a little darker up by the ceiling and in its corners
    for (let k = 0; k < 4; k++) { R(x0, wallTop + k, iw, 1, shade(A, -0.22 + k * 0.05)); }
    for (let k = 0; k < 5; k++) { R(x0 + k, wallTop, 1, wh, shade(A, -0.2 + k * 0.04)); R(x0 + iw - 1 - k, wallTop, 1, wh, shade(A, -0.2 + k * 0.04)); }
    // a socket now and then, low on the wall
    for (let x = x0 + 40; x < x0 + iw - 20; x += 112) { R(x, wallBottom - 7, 5, 5, '#ffffff'); P(x + 1, wallBottom - 5, '#9a92b2'); P(x + 3, wallBottom - 5, '#9a92b2'); }
    // the ceiling: a beam, its trim, little lights
    R(0, 0, W, wallTop, '#3a2a5e'); R(0, wallTop - 2, W, 2, home.trim); R(0, wallTop - 2, W, 1, shade(home.trim, 0.3));
    for (let x = x0 + 24; x < x0 + iw; x += 64) { R(x, 1, 8, 3, '#fff3c0'); R(x + 1, 4, 6, 1, '#ffe08a'); }
    // the baseboard
    R(x0, wallBottom, iw, BASE, WHITE); R(x0, wallBottom, iw, 1, '#ffffff'); R(x0, wallBottom + BASE - 1, iw, 1, shade(home.floorA, -0.3));
    // the floor
    const F = home.floorA, FB = home.floorB;
    R(x0, floorTop, iw, floorBottom - floorTop, F);
    for (let r = 0; r < home.rows; r++) {
      const y = floorTop + r * ROW;
      if (home.floor === 'planks') { for (let x = x0 - ((r * 13) % 32), k = 0; x < x0 + iw; x += 32, k++) { const c = mix(F, FB, hash(k, r) * 0.7); R(Math.max(x0, x), y, Math.min(31, x0 + iw - Math.max(x0, x)), ROW - 1, c); R(Math.max(x0, x), y, Math.min(31, x0 + iw - Math.max(x0, x)), 1, shade(c, 0.1)); if (hash(r, k) > 0.7) P(Math.max(x0, x) + 8 + ((k * 7) % 14), y + 3, shade(FB, -0.15)); } R(x0, y + ROW - 1, iw, 1, shade(FB, -0.12)); }
      else if (home.floor === 'herring') { for (let x = x0; x < x0 + iw; x += 8) { const c = (x / 8 + r) % 2 ? F : FB; R(x, y, 8, ROW, c); R(x, y + ((x / 8 + r) % 2 ? 0 : ROW - 1), 8, 1, shade(c, -0.1)); R(x, y, 1, ROW, shade(c, 0.08)); } }
      else if (home.floor === 'concrete') { for (let x = x0; x < x0 + iw; x += 2) if (hash(x, r * 7) > 0.82) P(x, y + Math.floor(hash(r, x) * ROW), hash(x + 1, r) > 0.5 ? FB : shade(F, 0.12)); if (r % 2 === 0) R(x0, y, iw, 1, FB); for (let x = x0; x < x0 + iw; x += 48) R(x, y, 1, ROW, FB); }
      else if (home.floor === 'marble') { for (let x = 0; x < home.cols; x++) { const c = (x + r) % 2 ? FB : F; R(x0 + x * CELL, y, CELL, ROW, c); if (hash(x, r) > 0.5) { P(x0 + x * CELL + 3, y + 2, shade(c, -0.12)); P(x0 + x * CELL + 4, y + 3, shade(c, -0.12)); P(x0 + x * CELL + 5, y + 3, shade(c, -0.12)); } } }
      else if (home.floor === 'carpet') { for (let x = x0; x < x0 + iw; x += 2) if (hash(x, r) > 0.6) P(x + (r % 2), y + Math.floor(hash(r, x) * ROW), FB); }
      else { R(x0, y, iw, 1, '#3a3858'); for (let x = x0 + 2; x < x0 + iw; x += 4) P(x, y + 4, '#5f5c82'); if (r % 3 === 1) for (let x = x0; x < x0 + iw; x += 12) R(x, y + 2, 6, 1, '#ffd84a'); }
    }
    // light: the floor a little darker by the wall
    R(x0, floorTop, iw, 1, shade(F, -0.35)); R(x0, floorTop + 1, iw, 1, shade(F, -0.2));
    // the side walls, the front edge of the floor
    R(0, wallTop, x0, floorBottom - wallTop, shade(A, -0.32)); R(W - x0, wallTop, x0, floorBottom - wallTop, shade(A, -0.32));
    R(0, floorTop, x0, floorBottom - floorTop, shade(F, -0.38)); R(W - x0, floorTop, x0, floorBottom - floorTop, shade(F, -0.38));
    R(x0 - 1, wallTop, 1, floorBottom - wallTop, shade(A, -0.5)); R(W - x0, wallTop, 1, floorBottom - wallTop, shade(A, -0.5));
    R(0, floorBottom, W, LIP, shade(F, -0.45)); R(0, floorBottom, W, 1, shade(F, -0.6));
  }, { outlined: false, lit: false });
}

// the view out of a window: her home’s (suburb, city, skyline, garden, space), by day or by night; curtains on some
function windowArt({ R, oval }, W, H, v = {}, { panes = 2, round = false, curtain = false } = {}) {
  const night = Boolean(v.night), view = v.view || 'suburb';
  const sky = view === 'space' ? '#141038' : night ? '#2b2a6e' : view === 'skyline' ? '#ffb38a' : view === 'garden' ? '#8fd4ff' : '#9fdcff';
  R(1, 1, W - 2, H - 4, round ? DARK : WHITE);
  const x0 = 3, y0 = 3, w = W - 6, h = H - 8;
  R(x0, y0, w, h, sky);
  if (!night && view !== 'space') R(x0, y0 + Math.round(h * 0.55), w, Math.round(h * 0.45), shade(sky, 0.12));
  if (view === 'space' || night) for (let i = 0; i < 9; i++) R(x0 + ((i * 13) % w), y0 + ((i * 7) % (h - 4)), 1, 1, '#ffffff');
  if (view === 'suburb') {
    if (!night) { oval(x0 + 3, y0 + 2, 8, 4, '#ffffff'); oval(x0 + w - 12, y0 + 4, 9, 4, '#ffffff'); } else oval(x0 + w - 8, y0 + 2, 5, 5, '#fff3c0');
    R(x0, y0 + h - 6, w, 6, night ? '#2f6e4a' : '#6fd27a');
    for (let i = 0; i < Math.floor(w / 9); i++) { const hx = x0 + 2 + i * 9; R(hx, y0 + h - 11, 6, 6, ['#ff9a8a', '#ffd36e', '#c9a2f2'][i % 3]); R(hx - 1, y0 + h - 13, 8, 2, '#d0556a'); R(hx + 2, y0 + h - 8, 2, 3, night ? '#ffd36e' : '#7a4a3a'); }
  } else if (view === 'city' || view === 'skyline') {
    const tall = view === 'skyline' ? 1.4 : 1;
    for (let i = 0; i < Math.ceil(w / 5); i++) { const bh = Math.min(h - 2, Math.round((6 + ((i * 7) % 9)) * tall)), bx = x0 + i * 5; R(bx, y0 + h - bh, 4, bh, night ? '#3a3470' : view === 'skyline' ? '#a0688a' : '#8a7fc0'); for (let k = 2; k < bh - 1; k += 3) R(bx + 1, y0 + h - bh + k, 1, 1, night ? '#ffd36e' : '#e8e0ff'); }
    if (view === 'skyline' && !night) oval(x0 + w - 10, y0 + 2, 7, 7, '#ffe08a');
  } else if (view === 'garden') {
    if (night) oval(x0 + w - 8, y0 + 2, 5, 5, '#fff3c0'); else oval(x0 + 3, y0 + 3, 9, 4, '#ffffff');
    oval(x0 - 6, y0 + h - 9, w * 0.7, 14, night ? '#2f6e4a' : '#5ec46e'); oval(x0 + w * 0.4, y0 + h - 11, w * 0.8, 16, night ? '#27603f' : '#4fb35f');
    for (let i = 0; i < Math.floor(w / 7); i++) { const tx = x0 + 3 + i * 7; R(tx + 1, y0 + h - 7, 1, 4, '#7a4a3a'); oval(tx - 1, y0 + h - 12, 6, 6, night ? '#2a8f4c' : '#3fbf6a'); R(tx + 3, y0 + h - 3, 1, 1, ['#ff4da6', '#ffd36e', '#ffffff'][i % 3]); }
  } else if (view === 'space') {
    oval(x0 + w - 14, y0 + h - 12, 14, 14, '#3b8fd8'); R(x0 + w - 11, y0 + h - 9, 4, 3, '#62d84c'); R(x0 + w - 6, y0 + h - 6, 3, 2, '#62d84c'); oval(x0 + 3, y0 + 3, 4, 4, '#dcd8ff');
  }
  // the frame and its bars
  const frame = round ? GRAY_L : WHITE;
  R(1, 1, W - 2, 2, frame); R(1, H - 5, W - 2, 2, frame); R(1, 1, 2, H - 4, frame); R(W - 3, 1, 2, H - 4, frame);
  for (let k = 1; k < panes; k++) R(Math.round((W * k) / panes) - 1, 1, 2, H - 4, frame);
  if (panes > 1 && !round) R(1, Math.round(H / 2) - 2, W - 2, 1, frame);
  R(0, H - 3, W, 3, WOOD_M); R(0, H - 3, W, 1, '#efc591');
  if (curtain) { R(0, 0, W, 2, '#ff8ac0'); R(0, 2, 4, H - 6, '#ff9ccf'); R(W - 4, 2, 4, H - 6, '#ff9ccf'); R(1, 2, 1, H - 6, '#ffc3e2'); R(W - 3, 2, 1, H - 6, '#ffc3e2'); }
}
