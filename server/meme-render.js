// AGI Studio's memes (2026-10-11), on our server: a meme's picture put on its template's canvas, and its words drawn on it
// with the same fonts and layout as the page's editor (src/studio/meme-layout.js: shapes in an SVG, put on with sharp, so no
// font has to be installed here). The fonts are the page's own files (public/fonts/meme/): each named here as it is, so
// Vercel's file tracer ships them with the functions that load this file (/api/launch and /api/feed).
import { readFileSync } from 'node:fs';
import { MEME_CANVAS, picBox, markSpot, MARK_PREFER } from '../src/studio/memes.js';
import { layersSvg, missingChars, wordBoxes } from '../src/studio/meme-layout.js';

let fonts = null;
const buf = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
// The fonts, read once per server copy (about 300 KB)
export async function memeFonts() {
  if (fonts) return fonts;
  const opentype = (await import('opentype.js')).default;
  const read = (b) => opentype.parse(buf(b));
  fonts = {
    classic: read(readFileSync(new URL('../public/fonts/meme/anton-v1.woff', import.meta.url))),
    comic: read(readFileSync(new URL('../public/fonts/meme/bangers-v1.woff', import.meta.url))),
    marker: read(readFileSync(new URL('../public/fonts/meme/marker-v1.woff', import.meta.url))),
    casual: read(readFileSync(new URL('../public/fonts/meme/comicneue-v1.woff', import.meta.url))),
    bold: read(readFileSync(new URL('../public/fonts/meme/archivo-v1.woff', import.meta.url))),
    clean: read(readFileSync(new URL('../public/fonts/meme/notosans-v1.woff', import.meta.url))),
    emoji: read(readFileSync(new URL('../public/fonts/meme/emoji-v1.woff', import.meta.url))),
  };
  return fonts;
}

// The first layer with a character no font here draws → { n, chars } (null: every one can be drawn)
export async function undrawable(layers) {
  const f = await memeFonts();
  for (let n = 0; n < (layers || []).length; n++) {
    const chars = missingChars(f, layers[n].f, layers[n].t);
    if (chars.length) return { n, chars };
  }
  return null;
}

// (2026-10-14) Where the share mark goes on this meme: where it covers none of its words (memes.js markSpot), for a photo's
// download ('photo': bottom right first) or its video ('video': top left first) → 'br', 'bl', 'tr', 'tl', 'mr' or 'ml'
export async function markSpotFor(layers, tpl, kind = 'photo') {
  const c = MEME_CANVAS[tpl.canvas];
  return markSpot(wordBoxes(await memeFonts(), layers, c.w, c.h), c.w, c.h, MARK_PREFER[kind] || MARK_PREFER.photo);
}

// (2026-10-14) The AI's picture cut to fit its template's picture area (cover) → a JPEG of exactly that size: kept beside the
// meme (<job>.pic.jpg) as its picture without words, what an edit, someone added or its video starts from
export async function picOf(sharp, aiBytes, tpl) {
  const p = picBox(tpl);
  return sharp(aiBytes, { limitInputPixels: 40_000_000 }).rotate().resize(p.w, p.h, { fit: 'cover', position: 'centre' }).jpeg({ quality: 92 }).toBuffer();
}

// The template's canvas with the AI's picture in its place (cut to fit), its own color around it → a JPEG (the meme without
// its words: what its words are drawn on). aiBytes may be its picture already cut (picOf): it's then put on as it is.
export async function composeBase(sharp, aiBytes, tpl) {
  const c = MEME_CANVAS[tpl.canvas];
  const p = picBox(tpl);
  const pic = await sharp(aiBytes, { limitInputPixels: 40_000_000 }).rotate().resize(p.w, p.h, { fit: 'cover', position: 'centre' }).toBuffer();
  return sharp({ create: { width: c.w, height: c.h, channels: 3, background: tpl.bg || '#ffffff' } })
    .composite([{ input: pic, left: p.x, top: p.y }]).jpeg({ quality: 90 }).toBuffer();
}

// The meme with its words → { jpg (the canvas's size), webp (384 px, for the pages) }
export async function renderMeme(sharp, baseBytes, layers, tpl) {
  const c = MEME_CANVAS[tpl.canvas];
  const svg = Buffer.from(layersSvg(await memeFonts(), layers, c.w, c.h));
  const flat = await sharp(baseBytes, { limitInputPixels: 40_000_000 }).resize(c.w, c.h, { fit: 'fill' }).composite([{ input: svg, left: 0, top: 0 }]).png().toBuffer();
  const [jpg, webp] = await Promise.all([
    sharp(flat).jpeg({ quality: 90 }).toBuffer(),
    sharp(flat).resize(384, 384, { fit: 'inside' }).webp({ quality: 80 }).toBuffer(),
  ]);
  return { jpg, webp };
}

// Only its words, on a see-through picture of w × h (a video's own size: its player shows it over the video, and its download
// has it drawn in)
export async function wordsPng(sharp, layers, tpl, w = null, h = null) {
  const c = MEME_CANVAS[tpl.canvas];
  const outW = Math.round(w || c.w), outH = Math.round(h || c.h);
  return sharp(Buffer.from(layersSvg(await memeFonts(), layers, c.w, c.h, { outW, outH }))).png().toBuffer();
}
