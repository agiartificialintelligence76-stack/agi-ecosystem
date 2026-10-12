// AGI Studio's photo editor (2026-10-12, the editor; the owner's choice: "Photo editor (Recommended)"): its numbers, with no
// page around them (src/studio/views/photo-editor.js draws with them in the browser; our server checks a saved one's size
// with them; tests/influencer.test.js checks them in Node). Free, no AI: a photo turned, flipped, cropped to a photo shape,
// lit and filtered (one color matrix for all of it, the same on every browser), with words and stickers on it.
import { EDITOR, BANNER, MARK_LOOK } from './rules.js';

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------- its shape ----------
// width over height of each shape a photo can be (an X banner: X's own 3:1)
export const ASPECT = { tall: 9 / 16, square: 1, wide: 16 / 9, banner: BANNER.W / BANNER.H };
// a picture turned by rot degrees (0, 90, 180, 270): its size
export const turned = (w, h, rot) => (rot % 180 === 0 ? { w, h } : { w: h, h: w });
// a shape from a picture's size (as media.js shapeOfSize)
export const shapeOfSize = (w, h) => (h > w * 1.15 ? 'tall' : w > h * 1.15 ? 'wide' : 'square');
// the crop's width over height: a crop choice on a picture of w × h (turned); an X banner stays 3:1; Original its own, unless
// that's none of our shapes (then the nearest one's: a saved one must be one, sizeFits)
export function aspectOf(crop, w, h, banner = false) {
  if (banner) return ASPECT.banner;
  if (crop !== 'original' && Object.hasOwn(ASPECT, crop) && crop !== 'banner') return ASPECT[crop];
  const own = w / h, near = ASPECT[shapeOfSize(w, h)];
  return Math.abs(own / near - 1) <= 0.015 ? own : near;
}
// the shape a crop is saved as: the one picked, else the picture's own (turned); an X banner stays one
export function shapeOfCrop(crop, w, h, banner = false) {
  if (banner) return 'banner';
  return crop !== 'original' && Object.hasOwn(ASPECT, crop) && crop !== 'banner' ? crop : shapeOfSize(w, h);
}
// The biggest box of that aspect inside w × h, made smaller by zoom (1 to EDITOR.ZOOM_MAX), its middle at (cx, cy) (fractions
// of w and h), kept inside → { x, y, w, h } in pixels
export function cropBox({ w, h, aspect, zoom = 1, cx = 0.5, cy = 0.5 }) {
  let bw = w, bh = w / aspect;
  if (bh > h) { bh = h; bw = h * aspect; }
  const z = clamp(Number(zoom) || 1, 1, EDITOR.ZOOM_MAX);
  bw /= z;
  bh /= z;
  return { x: clamp(cx * w - bw / 2, 0, w - bw), y: clamp(cy * h - bh / 2, 0, h - bh), w: bw, h: bh };
}
// A saved (or downloaded) picture's size: its crop's own pixels, at least 1080 and at most EDITOR.PX on its longest side; an X
// banner exactly 1500 × 500
export function outSize(box, banner = false) {
  if (banner) return { w: BANNER.W, h: BANNER.H };
  const long = Math.max(box.w, box.h);
  const k = clamp(long, Math.min(1080, EDITOR.PX), EDITOR.PX) / long;
  return { w: Math.max(1, Math.round(box.w * k)), h: Math.max(1, Math.round(box.h * k)) };
}
// Our server's check of a saved one: its size fits its shape (an X banner exactly; the others within 2%), 256 to EDITOR.PX
// pixels a side
export function sizeFits(shape, w, h) {
  if (!Number.isInteger(w) || !Number.isInteger(h) || !Object.hasOwn(ASPECT, shape)) return false;
  if (shape === 'banner') return w === BANNER.W && h === BANNER.H;
  return Math.min(w, h) >= 256 && Math.max(w, h) <= EDITOR.PX && Math.abs(w / h / ASPECT[shape] - 1) <= 0.02;
}

// ---------- its colors: one matrix ----------
// 4 × 5 (rows red, green, blue, alpha; the fifth column adds, in 0–255), like a color matrix filter: mul(b, a) is a, then b
export const IDENTITY = Object.freeze([1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0]);
export function mul(b, a) {
  const out = new Array(20);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      let v = c === 4 ? b[r * 5 + 4] : 0;
      for (let k = 0; k < 4; k++) v += b[r * 5 + k] * a[k * 5 + c];
      out[r * 5 + c] = v;
    }
  }
  return out;
}
const LUM = [0.2126, 0.7152, 0.0722];
const scaleM = (k) => [k, 0, 0, 0, 0, 0, k, 0, 0, 0, 0, 0, k, 0, 0, 0, 0, 0, 1, 0];
const contrastM = (k) => { const o = 128 * (1 - k); return [k, 0, 0, 0, o, 0, k, 0, 0, o, 0, 0, k, 0, o, 0, 0, 0, 1, 0]; };
const satM = (s) => {
  const [r, g, b] = LUM;
  return [r * (1 - s) + s, g * (1 - s), b * (1 - s), 0, 0, r * (1 - s), g * (1 - s) + s, b * (1 - s), 0, 0, r * (1 - s), g * (1 - s), b * (1 - s) + s, 0, 0, 0, 0, 0, 1, 0];
};
const shiftM = (r, g, b) => [1, 0, 0, 0, r, 0, 1, 0, 0, g, 0, 0, 1, 0, b, 0, 0, 0, 1, 0];
const tintM = (r, g, b) => [r, 0, 0, 0, 0, 0, g, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, 1, 0];
const SEPIA = [0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0, 0, 0, 0, 0, 1, 0];
const partway = (m, t) => m.map((v, i) => IDENTITY[i] * (1 - t) + v * t);
// each filter (EDITOR_FILTERS' keys)
export const FILTER_M = {
  none: [...IDENTITY],
  vivid: mul(contrastM(1.1), satM(1.4)),
  warm: mul(shiftM(12, 4, -10), tintM(1.06, 1, 0.9)),
  cool: mul(shiftM(-8, 2, 12), tintM(0.92, 1, 1.08)),
  mono: satM(0),
  vintage: mul(shiftM(14, 10, 4), mul(contrastM(0.9), partway(SEPIA, 0.65))),
  fade: mul(shiftM(18, 18, 18), mul(contrastM(0.82), satM(0.85))),
  noir: mul(contrastM(1.35), satM(0)),
};
// The light's sliders (EDITOR_LIGHT's keys, each -100 to 100) after a filter → its one matrix
export function colorMatrix(light = {}, filter = 'none') {
  const v = (k) => clamp(Number(light?.[k]) || 0, -100, 100) / 100;
  let m = FILTER_M[filter] || [...IDENTITY];
  m = mul(scaleM(1 + v('bright') * 0.6), m);
  m = mul(contrastM(1 + v('contrast') * 0.8), m);
  m = mul(satM(1 + v('sat')), m);
  m = mul(shiftM(v('warm') * 30, v('warm') * 6, -v('warm') * 30), m);
  return m;
}
export const isIdentity = (m) => m.every((x, i) => Math.abs(x - IDENTITY[i]) < 1e-9);
// The matrix on a picture's pixels (RGBA, 0–255: an ImageData's), in place (a Uint8ClampedArray rounds and clamps)
export function applyMatrix(px, m) {
  const [a0, a1, a2, , a4, b0, b1, b2, , b4, c0, c1, c2, , c4] = m;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2];
    px[i] = a0 * r + a1 * g + a2 * b + a4;
    px[i + 1] = b0 * r + b1 * g + b2 * b + b4;
    px[i + 2] = c0 * r + c1 * g + c2 * b + c4;
  }
  return px;
}

// ---------- its words and stickers ----------
// a layer's place: its middle (x, y: fractions of the picture), its size (of the picture's shorter side: a text's letters, a
// sticker's height), its turn in degrees
export const LAYER = { TEXT: { min: 0.03, max: 0.2, start: 0.075 }, STICKER: { min: 0.06, max: 0.5, start: 0.18 } };
export function newText(text, n = 0) {
  return { kind: 'text', text: String(text), font: 'clean', color: 'white', style: 'outline', x: 0.5, y: clamp(0.82 - n * 0.12, 0.12, 0.88), size: LAYER.TEXT.start, turn: 0 };
}
export function newSticker(emoji, n = 0) {
  const spots = [[0.5, 0.42], [0.28, 0.28], [0.72, 0.28], [0.3, 0.62], [0.7, 0.62]];
  const [x, y] = spots[n % spots.length];
  return { kind: 'sticker', emoji: String(emoji), x, y, size: LAYER.STICKER.start, turn: 0 };
}
// a layer kept inside the picture and its limits
export function tidyLayer(l) {
  const lim = l.kind === 'text' ? LAYER.TEXT : LAYER.STICKER;
  return { ...l, x: clamp(Number(l.x) || 0, 0, 1), y: clamp(Number(l.y) || 0, 0, 1), size: clamp(Number(l.size) || lim.start, lim.min, lim.max), turn: clamp(Math.round(Number(l.turn) || 0), -180, 180) };
}
// Its words wrapped to lines no wider than max (measure(text) → its width); a word wider than max stays whole on its line
export function wrapWords(text, max, measure) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && measure(next) > max) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}
// A point (fractions of the picture) inside a layer's box (its middle, its width and height in fractions, its turn)?
export function hitLayer(box, px, py, w, h) {
  const t = (-box.turn * Math.PI) / 180;
  const dx = (px - box.x) * w, dy = (py - box.y) * h;
  const rx = dx * Math.cos(t) - dy * Math.sin(t), ry = dx * Math.sin(t) + dy * Math.cos(t);
  return Math.abs(rx) <= (box.w * w) / 2 + 6 && Math.abs(ry) <= (box.h * h) / 2 + 6;
}

// ---------- the share mark ----------
// Where it goes on a picture of w × h (server/inf-mark.js markFor, bottom right), from its picture's own size (mw0 × mh0)
export function markPlace(w, h, mw0, mh0) {
  const short = Math.max(1, Math.min(w, h));
  const mw = Math.max(MARK_LOOK.MIN_W, Math.round(short * MARK_LOOK.SHARE));
  const mh = Math.round((mh0 / Math.max(1, mw0)) * mw);
  const m = Math.round(short * MARK_LOOK.MARGIN);
  return { x: Math.max(0, w - mw - m), y: Math.max(0, h - mh - m), w: mw, h: mh };
}

// ---------- what's saved ----------
// The editor's state, from the start: nothing changed
export const startState = () => ({ rot: 0, flip: false, crop: 'original', zoom: 1, cx: 0.5, cy: 0.5, light: { bright: 0, contrast: 0, sat: 0, warm: 0 }, filter: 'none', layers: [] });
// anything changed from the start?
export function changed(s) {
  const a = startState();
  return s.rot !== a.rot || s.flip !== a.flip || s.crop !== a.crop || Math.abs(s.zoom - 1) > 1e-6 || Math.abs(s.cx - 0.5) > 1e-6 || Math.abs(s.cy - 0.5) > 1e-6
    || Object.keys(a.light).some((k) => (Number(s.light?.[k]) || 0) !== 0) || s.filter !== 'none' || (s.layers || []).length > 0;
}
// its texts' words, as our server checks them (each one's, non-empty)
export const wordsOf = (s) => (s.layers || []).filter((l) => l.kind === 'text').map((l) => String(l.text).trim()).filter(Boolean);
