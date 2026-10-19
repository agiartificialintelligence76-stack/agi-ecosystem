// AGI Studio's video editor (2026-10-12, the editor; the owner's choice: "Video editor": "trim, text on it (a layer drawn in the
// browser as a PNG, so the server needs no fonts), change its shape (9:16, 1:1, 16:9); ffmpeg on our server makes an H.264 MP4
// … free, 10 a day per wallet"): its numbers, with no page around them (src/studio/views/video-editor.js draws with them in
// the browser; our server checks a saved one with them and makes it with ffmpeg: server/inf-cut.js; tests/influencer.test.js
// checks them in Node). One of its own videos or trend videos: a part of it (1 to 15 seconds), its shape (its own, or Vertical
// 9:16, Square 1:1, Wide 16:9: a crop, zoomed and moved), with or without its sound, and its words and stickers drawn in the
// browser as one transparent picture at its size (src/studio/views/layers.js).
//   A cut, as the page sends it and our server keeps it: { start, length (seconds, in tenths), shape, src: [its video's width,
//   height], box: [x, y, w, h] (its crop, in thousandths of its video, whole numbers), sound }
import { VIDEO_EDITOR, MARK_LOOK } from './rules.js';
import { isMarkSpot } from './memes.js';

export const CUT_SHAPES = { original: 'Original', tall: 'Vertical 9:16', square: 'Square 1:1', wide: 'Wide 16:9' };
// each shape's size (a long video's parts' sizes too: server/inf-mark.js PART.SIZE)
export const CUT_SIZE = { tall: [720, 1280], square: [960, 960], wide: [1280, 720] };
export const START_MAX = 600;                  // where a part may start, at most (seconds: a long video is a minute)
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const even = (v) => Math.max(2, 2 * Math.floor(v / 2 + 1e-6));
const tenths = (v) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-6;
export const toTenth = (v) => Math.round(Number(v) * 10) / 10;

// A video whose share mark is in it already (a long video's parts were each encoded with it; one saved from the video editor;
// since 2026-10-14 a template meme's video, its words and mark drawn in by our clock: its row's layers, or its page's view's
// template): edited only as it is (its own shape, the whole picture), and given no second one (its words are kept off the mark)
export const ownMark = (j) => j?.kind === 'video'
  && (j.editor === true || (j.model === 'long' && Number(j.parts) > 1) || Array.isArray(j.layers) || j.template === true);
// (2026-10-14) Where a video's own share mark is: a meme video's where its words aren't (its row's mark_spot, its view's markSpot:
// src/studio/memes.js markSpot), a cut's where the video it's cut from had it (its cut's spot), else top left
export const markSpotOf = (j) => [j?.mark_spot, j?.markSpot, j?.cut?.spot].find(isMarkSpot) || 'tl';

// A cut's size: a shape's own; "Original" its video's own shape, made smaller to at most AREA pixels (never bigger), its sides
// even (H.264 keeps its colors in 2 × 2 blocks) → [w, h], or null without a video's size
export function cutSize(shape, w, h) {
  if (Object.hasOwn(CUT_SIZE, shape)) return [...CUT_SIZE[shape]];
  const W = Number(w), H = Number(h);
  if (!(W > 0 && H > 0)) return null;
  const k = Math.min(1, Math.sqrt(VIDEO_EDITOR.AREA / (W * H)));
  return [even(W * k), even(H * k)];
}
// its shape as a photo shape is named (what our server keeps for "Original", and the page's tiles): tall, square or wide
export const shapeOfSize = (w, h) => (h > w * 1.15 ? 'tall' : w > h * 1.15 ? 'wide' : 'square');
export const storedShape = (shape, w, h) => (Object.hasOwn(CUT_SIZE, shape) ? shape : shapeOfSize(...(cutSize(shape, w, h) || [w, h])));
// a shape's width over height, on a video of w × h
export const aspectOfCut = (shape, w, h) => (Object.hasOwn(CUT_SIZE, shape) ? CUT_SIZE[shape][0] / CUT_SIZE[shape][1] : w / h);

// The biggest box of a shape's aspect inside a video of w × h, made smaller by zoom (1 to ZOOM_MAX), its middle at (cx, cy)
// (fractions of the video), kept inside → { x, y, w, h } in the video's pixels
export function cropBox({ shape, w, h, zoom = 1, cx = 0.5, cy = 0.5 }) {
  const a = aspectOfCut(shape, w, h);
  let bw = w, bh = w / a;
  if (bh > h) { bh = h; bw = h * a; }
  const z = clamp(Number(zoom) || 1, 1, VIDEO_EDITOR.ZOOM_MAX);
  bw /= z;
  bh /= z;
  return { x: clamp(cx * w - bw / 2, 0, w - bw), y: clamp(cy * h - bh / 2, 0, h - bh), w: bw, h: bh };
}
// A box in a video's pixels → in thousandths of it, whole numbers, inside it ([x, y, w, h])
export function thousandths(b, W, H) {
  const t = (v, of) => Math.round((v / of) * 1000);
  const w = clamp(t(b.w, W), 1, 1000), h = clamp(t(b.h, H), 1, 1000);
  return [clamp(t(b.x, W), 0, 1000 - w), clamp(t(b.y, H), 0, 1000 - h), w, h];
}

// Our server's check of a cut (and the page's own, before it asks): → { ok: true, cut } (tidied: its numbers as whole tenths)
// or { ok: false, why: 'start' | 'length' | 'shape' | 'src' | 'box' | 'sound' | 'bad' }
export function cutSpec(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return { ok: false, why: 'bad' };
  const start = Number(c.start), length = Number(c.length);
  if (typeof c.start !== 'number' || !Number.isFinite(start) || start < 0 || start > START_MAX || !tenths(start)) return { ok: false, why: 'start' };
  if (typeof c.length !== 'number' || !Number.isFinite(length) || length < VIDEO_EDITOR.MIN_S || length > VIDEO_EDITOR.MAX_S || !tenths(length)) return { ok: false, why: 'length' };
  if (typeof c.shape !== 'string' || !Object.hasOwn(CUT_SHAPES, c.shape)) return { ok: false, why: 'shape' };
  const src = c.src;
  if (!Array.isArray(src) || src.length !== 2 || !src.every((v) => Number.isInteger(v) && v >= 64 && v <= 4096)) return { ok: false, why: 'src' };
  const box = c.box;
  if (!Array.isArray(box) || box.length !== 4 || !box.every((v) => Number.isInteger(v) && v >= 0 && v <= 1000)) return { ok: false, why: 'box' };
  const [x, y, w, h] = box, [W, H] = src;
  if (w < 1 || h < 1 || x + w > 1000 || y + h > 1000) return { ok: false, why: 'box' };
  const pw = (w / 1000) * W, ph = (h / 1000) * H;
  // its shorter side, in the video's own pixels; its shape (within 3%: thousandths are rounded)
  if (Math.min(pw, ph) < VIDEO_EDITOR.MIN_BOX_PX) return { ok: false, why: 'box' };
  if (Math.abs(pw / ph / aspectOfCut(c.shape, W, H) - 1) > 0.03) return { ok: false, why: 'box' };
  if (typeof c.sound !== 'boolean') return { ok: false, why: 'sound' };
  return { ok: true, cut: { start: toTenth(start), length: toTenth(length), shape: c.shape, src: [W, H], box: [x, y, w, h], sound: c.sound } };
}
// …and one whose video carries its share mark already (ownMark): only as it is (its own shape, the whole picture)
export const asItIs = (c) => c?.shape === 'original' && Array.isArray(c.box) && c.box.join(',') === '0,0,1000,1000';

// A cut's crop in its video's own pixels (our server's, for ffmpeg): at exactly its size's shape (centred in the box asked for:
// thousandths are a hair off), even, inside the video → { x, y, w, h }
export function cropPixels(box, W, H, outW, outH) {
  const [bx, by, bw, bh] = box.map((v) => v / 1000);
  let w = bw * W, h = bh * H;
  const a = outW / outH;
  if (w / h > a) w = h * a; else h = w / a;
  w = Math.min(even(w), even(W));
  h = Math.min(even(h), even(H));
  const cx = (bx + bw / 2) * W, cy = (by + bh / 2) * H;
  const x = 2 * Math.floor(clamp(cx - w / 2, 0, W - w) / 2), y = 2 * Math.floor(clamp(cy - h / 2, 0, H - h) / 2);
  return { x, y, w, h };
}

// Where the share mark goes on a cut of w × h (top left, as server/inf-mark.js markFor puts it on videos: TikTok's, Reels' and
// Shorts' own buttons sit at the bottom right), from its picture's own size (mw0 × mh0) → { x, y, w, h }
export const markTopLeft = (w, h, mw0, mh0) => markBox(w, h, mw0, mh0, 'tl');
// (2026-10-14) …at any of its spots (a meme video's mark goes where its words aren't: markSpotOf) → { x, y, w, h }
export function markBox(w, h, mw0, mh0, spot = 'tl') {
  const short = Math.max(1, Math.min(w, h));
  const mw = Math.max(MARK_LOOK.MIN_W, Math.round(short * MARK_LOOK.SHARE));
  const mh = Math.round((mh0 / Math.max(1, mw0)) * mw);
  const m = Math.round(short * MARK_LOOK.MARGIN);
  const s = isMarkSpot(spot) ? spot : 'tl';
  const x = s[1] === 'l' ? m : Math.max(0, w - mw - m);
  const y = s[0] === 't' ? m : s[0] === 'b' ? Math.max(0, h - mh - m) : Math.max(0, Math.round((h - mh) / 2));
  return { x, y, w: mw, h: mh };
}

// ---------- the page's state ----------
// From the start: its whole length (up to MAX_S from its start), its own shape, the whole picture, its sound (sound: whether its
// video has any; a silent one's starts off, and stays off), no words
export const startCut = (duration, sound = true) => ({ start: 0, end: toTenth(Math.min(Number(duration) || VIDEO_EDITOR.MAX_S, VIDEO_EDITOR.MAX_S)), shape: 'original', zoom: 1, cx: 0.5, cy: 0.5, sound: sound === true, layers: [] });
// Its part kept inside the video and the editor's limits (a tenth of a second at a time): start before end, 1 to MAX_S long
export function tidyTrim(start, end, duration) {
  const d = Math.max(VIDEO_EDITOR.MIN_S, toTenth(Number(duration) || 0) || VIDEO_EDITOR.MIN_S);
  let s = clamp(toTenth(start), 0, Math.max(0, d - VIDEO_EDITOR.MIN_S));
  let e = clamp(toTenth(end), s + VIDEO_EDITOR.MIN_S, Math.min(d, s + VIDEO_EDITOR.MAX_S));
  s = toTenth(s);
  e = toTenth(e);
  return { start: s, end: e };
}
// anything changed from the start? (sound: whether its video has any, as startCut: a silent video's start, its sound off, is
// no change: Save waits for one; found 2026-10-12, a silent video's Save on as it opened)
export function cutChanged(st, duration, sound = true) {
  const a = startCut(duration, sound);
  return st.start !== a.start || st.end !== a.end || st.shape !== a.shape || Math.abs(st.zoom - 1) > 1e-6 || Math.abs(st.cx - 0.5) > 1e-6
    || Math.abs(st.cy - 0.5) > 1e-6 || st.sound !== a.sound || (st.layers || []).length > 0;
}
// The cut as our server gets it, from the page's state and its video's size
export function cutOf(st, W, H) {
  const b = cropBox({ shape: st.shape, w: W, h: H, zoom: st.zoom, cx: st.cx, cy: st.cy });
  return { start: toTenth(st.start), length: toTenth(st.end - st.start), shape: st.shape, src: [W, H], box: thousandths(b, W, H), sound: st.sound === true };
}
