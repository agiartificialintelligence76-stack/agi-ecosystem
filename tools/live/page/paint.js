// AGI-1's live show (2026-10-07, the owner after a preview of her trips: "so bad", then "Painted art"): the paintings of her
// set. tools/live/art.mjs has Google's image AI paint them once on the owner's server; Claude picks one of each, cuts out the
// people and the things she wears (their green background keyed out) and makes them small (tools/live/art-cut.mjs) into
// tools/live/page/art/<group>/<id>.webp: her places, her rooms, the inside of each vehicle she rides in, the people she meets,
// and the hats, glasses, flowers and scarves of her outfits. Vite finds them when her set is built (import.meta.glob): a
// painting that isn't there yet is drawn in code as before (places.js, rooms.js, people.js, outfits.js).
// Only this page's own files: nothing here talks to the network.
// (Vite writes the list in when her set is built; in Node, where tests read these files, there's none)
let FILES = {};
try { FILES = import.meta.glob('./art/*/*.webp', { eager: true, query: '?url', import: 'default' }); } catch { FILES = {}; }

export const GROUPS = ['places', 'rooms', 'rides', 'people', 'accessories'];
export const PAINTED = {};
for (const [path, url] of Object.entries(FILES)) {
  const m = /^\.\/art\/([a-z]+)\/([a-z0-9-]+)\.webp$/.exec(path);
  if (m && GROUPS.includes(m[1])) PAINTED[`${m[1]}/${m[2]}`] = url;
}
export const paintedUrl = (group, id) => PAINTED[`${group}/${id}`] || null;
export const isPainted = (group, id) => Boolean(paintedUrl(group, id));

// a painting, loaded and decoded (null: none, or it couldn't be read). The newest few are kept: a backdrop is 1280 × 720,
// almost 4 MB once decoded, and once it's drawn on her set's canvas its picture isn't needed any more
const KEEP = 6;
const cache = new Map();
export function paintLoad(group, id) {
  const url = paintedUrl(group, id);
  if (!url) return Promise.resolve(null);
  if (cache.has(url)) {
    const p = cache.get(url);
    cache.delete(url);
    cache.set(url, p);
    return p;
  }
  const p = new Promise((done) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    img.decode().then(() => done(img), () => done(null));
  });
  cache.set(url, p);
  while (cache.size > KEEP) cache.delete(cache.keys().next().value);
  return p;
}

// a backdrop on her set's canvas (1280 × 720): the painting fills it, cut to its shape if it isn't 16:9
export function drawPainting(img, canvas) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const w = img.naturalWidth * s, h = img.naturalHeight * s;
  g.clearRect(0, 0, W, H);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}
