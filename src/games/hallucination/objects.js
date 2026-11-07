// HALLUCINATION (2026-11-08): the whole object library (./objects-home.js and ./objects-out.js) in one place, the color
// lists a recolor may choose from when a scene's palette has none of its own, and the two things every part of the game
// asks of an object: where it is (its box in the page) and how to draw it.
import { HOME } from './objects-home.js';
import { OUT } from './objects-out.js';

export const LIB = Object.freeze(Object.fromEntries(Object.entries({ ...HOME, ...OUT }).map(([type, d]) => [type, Object.freeze({ type, flip: false, kind: 'stand', muts: [], ...d })])));
export const TYPES = Object.freeze(Object.keys(LIB));

// color lists a parameter may be recolored from (a scene's palette may have its own list of the same name)
export const LISTS = Object.freeze({
  acc: ['#e86a7d', '#f2a65a', '#f7d06b', '#6cbf9a', '#6f9fd8', '#9b7bd4', '#fff1e0'],
  frost: ['#ffb3cf', '#fff4c9', '#c8f0dc', '#c9b6ff', '#8a5a44', '#ffffff'],
  sponge: ['#f6d7a7', '#e9b98a', '#8a5a44', '#f9c6d3'],
  fruit: ['#e2574c', '#9cc95a', '#f39a3c', '#f4d35e', '#8a5a9e'],
  fish: ['#f28c38', '#f27a9b', '#f4c84e', '#6fc3e8', '#9b7bd4'],
  screen: ['#8be0d0', '#c9b6ff', '#ffb3cf', '#ffe08a', '#8fc8ff'],
  cushion: ['#3a3550', '#fffaf0', '#f6b2c4', '#bfe6f5'],
  neon: ['#ff4da6', '#8b66ff', '#3ff0c3', '#ffc933', '#59c8ff'],
  lights: ['#ffd45c', '#ff8fb1', '#7fd6c2', '#8fb8ff', '#ffffff'],
  leaves: ['#6cbf7a', '#4f9d63', '#8fcf6a', '#3f8f80'],
  flowers: ['#ff8fb1', '#ffd45c', '#ffffff', '#c9a7ff', '#ff7a5c'],
  fridge: ['#bfe6f5', '#ffd6e0', '#fff4c9', '#c8f0dc', '#e4d9ff'],
  poles: ['#3a3550', '#2f6b5e', '#6b3bff', '#8a3a5c'],
  bulbs: ['#ffd27a', '#ffb3cf', '#bdf5e6', '#c9b6ff'],
  cars: ['#e2574c', '#ffc933', '#59c8ff', '#7fd6a2', '#ff8fb1', '#9b7bd4', '#fffaf0'],
  signs: ['#e2574c', '#3e7bd6', '#2f9e6e', '#ff8a3d', '#8b66ff'],
  cones: ['#ff8a3d', '#ff6fa8', '#ffc933'],
  hydrants: ['#e2574c', '#ffc933', '#6fb7e8'],
  birds: ['#6fb7e8', '#f39a3c', '#ff7aa8', '#ffd45c', '#7fd6a2'],
  clouds: ['#ffffff', '#ffe3ec', '#fff3d6', '#e6e0ff'],
  moons: ['#fff1b8', '#ffd98a', '#f5f0ff'],
  suns: ['#ffd45c', '#ffb03b', '#ffe27a', '#ff9a6a'],
  balloons: ['#ff6f91', '#ffd45c', '#59c8ff', '#7fd6a2', '#c9a7ff', '#ff9f68'],
  hulls: ['#e2574c', '#3e7bd6', '#ffc933', '#fffaf0', '#2f9e6e'],
  sails: ['#fffaf0', '#ffd45c', '#ff8fb1', '#9fd8ff'],
  lighthouses: ['#e2574c', '#3e7bd6', '#ff7aa8', '#2f9e6e'],
  crabs: ['#e2574c', '#ff7a5c', '#f39a3c', '#c9a7ff'],
  scoops: ['#ffd3e0', '#fff4c9', '#c8f0dc', '#8a5a44', '#d6c4ff'],
  houses: ['#fff4e0', '#ffd6c2', '#d8ecf7', '#e9f5d6', '#f6e1ff'],
  roofs: ['#e2574c', '#3e7bd6', '#8a5a44', '#2f9e6e', '#8b66ff'],
  shops: ['#c97a5e', '#5e7fc9', '#4fa58a', '#a46bc9', '#d9a066'],
  planets: ['#ff9f7a', '#8fd0f2', '#c9a7ff', '#7fd6a2', '#ffd45c'],
  panels: ['#6b8fd6', '#9b7bff', '#4fb3a8', '#e2a04c'],
  comets: ['#fff1a8', '#bfe6ff', '#ffc7de'],
  podlights: ['#c9a7ff', '#ff8fb1', '#7fd6c2', '#ffd45c'],
});
export const listOf = (pal, name = 'acc') => (pal && Array.isArray(pal[name]) && pal[name].length ? pal[name] : LISTS[name] || pal?.acc || LISTS.acc);

// ---------- where an object is ----------
// its box in the page: [x0, y0, x1, y1] (its own box, scaled, mirrored when it faces the other way)
export function boxOf(o) {
  const b = LIB[o.type].box(o.p);
  const s = o.s;
  let x0 = b[0] * s, x1 = b[2] * s;
  if (o.flip) { const t = x0; x0 = -x1; x1 = -t; }
  return [o.x + x0, o.y + b[1] * s, o.x + x1, o.y + b[3] * s];
}
// a part of it (a rect in its own units) in the page
export function partOf(o, rect) {
  if (!rect) return boxOf(o);
  const s = o.s;
  let x0 = rect[0] * s, x1 = rect[2] * s;
  if (o.flip) { const t = x0; x0 = -x1; x1 = -t; }
  return [o.x + x0, o.y + rect[1] * s, o.x + x1, o.y + rect[3] * s];
}
export const area = (b) => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
export function overlap(a, b) {
  const w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), h = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
  return w > 0 && h > 0 ? w * h : 0;
}
export const grow = (b, m) => [b[0] - m, b[1] - m, b[2] + m, b[3] + m];
export const union = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];

// ---------- drawing one ----------
// `S` is the pen of the picture (ink, line weight, shade…); its `flip` is set for the object being drawn
export function drawObject(ctx, o, S) {
  const def = LIB[o.type];
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(o.flip ? -o.s : o.s, o.s);
  const lw = S.lw;
  S.lw = lw / o.s;                      // the same ink weight whatever its size
  S.flip = Boolean(o.flip);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  def.draw(ctx, o.p, S);
  S.lw = lw;
  S.flip = false;
  ctx.restore();
}
