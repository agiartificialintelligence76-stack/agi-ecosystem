// AGI Studio's launch video: its pictures and clips (made once by tools/studio-promo/media.mjs into
// tools/studio-promo/media, which tools/studio-promo/make.mjs serves at /media/), as the renderer needs them.
// Pictures are decoded once, at load. A clip is a run of JPEG frames, a sharp one (720 × 1280) and a small one
// (360 × 640): a frame is asked for while drawing (vid()), and if it isn't decoded yet the draw notes it (a "miss"), the
// renderer waits for the misses (fill()) and draws the frame again. So every frame shows exactly the clips' frames for its
// time, however long they take to load. After each frame the next few frames of every clip it showed start loading
// (prefetch()), so a clip that plays rarely waits.
import { canvas } from '../../promo/page/kit.js';

const BASE = '/media/';
let INDEX = { pics: {}, vids: {} };
let scale = 1;
const pics = new Map();          // name → ImageBitmap
const softs = new Map();         // name → a small, blurred canvas (soft backdrops)
const caches = { f: new Map(), s: new Map() };      // `${name}:${i}` → ImageBitmap, oldest first (an LRU)
const CAP = { f: 72, s: 280 };
const pending = new Map();       // key → Promise
const misses = new Map();        // key → [size, name, i] asked for by the last draw and not decoded yet
const used = new Map();          // `${size}:${name}` → [size, name, i]: what the last draw showed (for prefetch)

export const setScale = (s) => { scale = s; };
export const index = () => INDEX;
export const has = (name) => !!(INDEX.pics[name] || INDEX.vids[name]);
export const clipInfo = (name) => INDEX.vids[name] || null;
export const clipLength = (name) => { const v = INDEX.vids[name]; return v ? v.n / v.fps : 0; };

async function bitmap(url, max = 0) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const blob = await res.blob();
  if (!max) return createImageBitmap(blob);
  const probe = await createImageBitmap(blob);
  const long = Math.max(probe.width, probe.height);
  if (long <= max) return probe;
  const k = max / long;
  probe.close();
  return createImageBitmap(blob, { resizeWidth: Math.round(probe.width * k), resizeHeight: Math.round(probe.height * k), resizeQuality: 'high' });
}

function softOf(src, w = 72) {
  const h = Math.max(8, Math.round((w * src.height) / src.width));
  const c = canvas(w, h), x = c.getContext('2d');
  x.filter = 'blur(2.2px)';
  x.imageSmoothingQuality = 'high';
  x.drawImage(src, -4, -4, w + 8, h + 8);
  return c;
}

export async function loadMedia() {
  try {
    const res = await fetch(`${BASE}index.json`);
    INDEX = res.ok ? await res.json() : { pics: {}, vids: {} };
  } catch { INDEX = { pics: {}, vids: {} }; }
  await Promise.all(Object.keys(INDEX.pics).map(async (name) => {
    try {
      const bm = await bitmap(`${BASE}pic/${name}.jpg`, 1500);
      pics.set(name, bm);
      softs.set(name, softOf(bm));
    } catch (e) { console.warn(`[media] ${name}: ${e.message}`); }
  }));
  return { pics: pics.size, vids: Object.keys(INDEX.vids).length };
}

export const pic = (name) => pics.get(name) || null;
export const soft = (name) => softs.get(name) || null;

// which run of frames: the sharp one when it's drawn taller than about 660 pixels on the video
const sizeFor = (h) => (h * scale > 660 ? 'f' : 's');
const keyOf = (size, name, i) => `${size}:${name}:${i}`;

// the frame of a clip at t seconds into it (looping, or held on its last frame with loop: false), for a box drawn h tall
export function frameIndex(name, t, { loop = true, rate = 1 } = {}) {
  const v = INDEX.vids[name];
  if (!v) return -1;
  let i = Math.floor(Math.max(0, t) * v.fps * rate + 1e-6);
  i = loop ? i % v.n : Math.min(i, v.n - 1);
  return i;
}
export function vid(name, t, h = 1080, o = {}) {
  const v = INDEX.vids[name];
  if (!v) return null;
  const size = o.size || sizeFor(h);
  const i = frameIndex(name, t, o);
  used.set(`${size}:${name}`, [size, name, i]);
  const cache = caches[size];
  const key = `${name}:${i}`;
  const bm = cache.get(key);
  if (bm) { cache.delete(key); cache.set(key, bm); return bm; }
  // not decoded yet: say so (the renderer waits and draws again); meanwhile the nearest one decoded, if any
  misses.set(keyOf(size, name, i), [size, name, i]);
  for (let d = 1; d < 6; d++) {
    const near = cache.get(`${name}:${(i - d + v.n) % v.n}`);
    if (near) return near;
  }
  return null;
}

function load(size, name, i) {
  const key = keyOf(size, name, i);
  if (pending.has(key)) return pending.get(key);
  const cache = caches[size];
  if (cache.has(`${name}:${i}`)) return Promise.resolve();
  const p = bitmap(`${BASE}vid/${name}/${size}/${String(i + 1).padStart(4, '0')}.jpg`)
    .then((bm) => {
      cache.set(`${name}:${i}`, bm);
      while (cache.size > CAP[size]) {
        const [k, old] = cache.entries().next().value;
        cache.delete(k);
        try { old.close(); } catch { /* closed */ }
      }
    })
    .catch((e) => console.warn(`[media] ${key}: ${e.message}`))
    .finally(() => pending.delete(key));
  pending.set(key, p);
  return p;
}

// a draw starts: forget what the last one asked for
export function beginFrame() { misses.clear(); used.clear(); }
export const missing = () => misses.size;
export async function fill() {
  const list = [...misses.values()];
  misses.clear();
  await Promise.all(list.map(([size, name, i]) => load(size, name, i)));
}
// the next few frames of every clip the last draw showed (not waited for)
export function prefetch(ahead = 5) {
  for (const [size, name, i] of used.values()) {
    const v = INDEX.vids[name];
    if (!v) continue;
    for (let d = 1; d <= ahead; d++) load(size, name, (i + d) % v.n);
  }
}

// a frame made soft (a blurred backdrop behind a clip): a shared small canvas, drawn at once by the caller
const softBuf = { c: null, x: null };
export function softFrame(src, w = 64) {
  if (!src) return null;
  const h = Math.max(8, Math.round((w * src.height) / src.width));
  if (!softBuf.c || softBuf.c.width !== w || softBuf.c.height !== h) {
    softBuf.c = canvas(w, h);
    softBuf.x = softBuf.c.getContext('2d');
    softBuf.x.filter = 'blur(2px)';
  }
  softBuf.x.clearRect(0, 0, w, h);
  softBuf.x.drawImage(src, -4, -4, w + 8, h + 8);
  return softBuf.c;
}
