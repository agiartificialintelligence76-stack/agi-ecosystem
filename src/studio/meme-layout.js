// AGI Studio's memes (2026-10-11): a meme's words as shapes. The same code places them in the page's editor (drawn on a
// canvas, as the person types) and on our server (an SVG of the same shapes, put on the picture with sharp: no font is
// needed there), so what's saved is exactly what the editor showed. fonts: { classic, comic, marker, casual, bold, clean,
// emoji } as opentype.js reads them (src/studio/memes.js MEME_FONTS; the page: loadMemeFonts in views/meme-editor.js; our
// server: server/meme-render.js). Pure.
import { MEME_FONTS, MEME_FALLBACK, upper } from './memes.js';

const KERN = { kerning: true };
export const OUTLINE = 0.13;   // an outline's width, of the font size (half of it shows outside the letters)
const MIN_PX = 8;

const has = (font, ch) => Boolean(font) && font.charToGlyphIndex(ch) > 0;
// the font that draws this character: the layer's own, else Clean (Latin, Greek, Cyrillic), else the emoji font; or null
export function fontFor(fonts, fid, ch) {
  if (has(fonts[fid], ch)) return fonts[fid];
  if (has(fonts[MEME_FALLBACK], ch)) return fonts[MEME_FALLBACK];
  if (has(fonts.emoji, ch)) return fonts.emoji;
  return null;
}
// the characters of these words no font here can draw (each once)
export function missingChars(fonts, fid, text) {
  const out = [];
  for (const ch of String(text)) {
    if (ch === '\n' || ch === ' ') continue;
    if (!fontFor(fonts, fid, ch) && !out.includes(ch)) out.push(ch);
  }
  return out;
}
// whether the emoji font is needed for these words (the page loads it only then)
export const needsEmoji = (fonts, fid, text) => [...String(text)].some((ch) => ch !== '\n' && ch !== ' ' && !has(fonts[fid], ch) && !has(fonts[MEME_FALLBACK], ch));

// a line as runs of one font each
function runsOf(fonts, fid, line) {
  const runs = [];
  for (const ch of line) {
    const font = fontFor(fonts, fid, ch) || fonts[MEME_FALLBACK] || fonts[fid];
    const last = runs[runs.length - 1];
    if (last && last.font === font) last.text += ch;
    else runs.push({ font, text: ch });
  }
  return runs;
}
const widthOf = (runs, size) => runs.reduce((a, r) => a + r.font.getAdvanceWidth(r.text, size, KERN), 0);

// The words wrapped into lines no wider than maxW at this size (their own new lines kept; a word wider than a whole line is
// broken where it has to be)
export function wrapLines(fonts, fid, text, size, maxW) {
  const width = (s) => widthOf(runsOf(fonts, fid, s), size);
  const lines = [];
  for (const para of String(text).split('\n')) {
    let cur = '';
    for (const word of para.split(' ')) {
      if (!word) continue;
      const next = cur ? `${cur} ${word}` : word;
      if (width(next) <= maxW) { cur = next; continue; }
      if (cur) lines.push(cur);
      cur = '';
      if (width(word) <= maxW) { cur = word; continue; }
      let piece = '';
      for (const ch of word) {
        if (piece && width(piece + ch) > maxW) { lines.push(piece); piece = ch; } else piece += ch;
      }
      cur = piece;
    }
    if (cur) lines.push(cur);
  }
  return lines;
}

// A layer's words at the biggest size (up to its own, s × the canvas's width) whose lines fit its box. → { text, size, lines,
// lh (line height, px) }
export function fitLayer(fonts, layer, W, H) {
  const text = layer.u ? upper(layer.t) : String(layer.t);
  const lhEm = MEME_FONTS[layer.f]?.lh || 1.15;
  const maxW = Math.max(1, layer.w * W), maxH = Math.max(1, layer.h * H);
  const at = (size) => ({ size, lines: wrapLines(fonts, layer.f, text, size, maxW) });
  const fits = (r) => r.lines.length * r.size * lhEm <= maxH;
  let hi = Math.max(MIN_PX, layer.s * W);
  let best = at(hi);
  if (!fits(best)) {
    let lo = MIN_PX;
    best = at(lo);
    for (let k = 0; k < 14 && hi - lo > 0.5; k++) {
      const r = at((lo + hi) / 2);
      if (fits(r)) { lo = r.size; best = r; } else hi = r.size;
    }
  }
  return { text, size: best.size, lines: best.lines, lh: best.size * lhEm };
}

const capOf = (font, size) => {
  const os2 = font?.tables?.os2;
  const upm = font?.unitsPerEm || 1000;
  const cap = os2 && os2.sCapHeight > 0 ? os2.sCapHeight : 0.7 * upm;
  return (cap / upm) * size;
};
const f1 = (v) => (Math.round(v * 10) / 10).toString();

// A layer as shapes: → { d (SVG path data, the canvas's pixels), size, lines, bbox: { x1, y1, x2, y2 }, stroke (its outline's
// width, or 0), bg: { x, y, w, h, r } | null }. Its lines are aligned in its box (left, middle or right) and centered in it
// from the top of their capital letters to the last line's baseline.
export function layerShape(fonts, layer, W, H) {
  const fit = fitLayer(fonts, layer, W, H);
  const { size, lines, lh } = fit;
  const cx = layer.x * W, cy = layer.y * H, bw = layer.w * W;
  const left = cx - bw / 2, right = cx + bw / 2;
  const main = fonts[layer.f] || fonts[MEME_FALLBACK];
  const cap = capOf(main, size);
  const dy = cy - (-cap + (lines.length - 1) * lh) / 2;
  const cmds = [];
  lines.forEach((line, i) => {
    const runs = runsOf(fonts, layer.f, line);
    const lw = widthOf(runs, size);
    let x = layer.a === 'l' ? left : layer.a === 'r' ? right - lw : cx - lw / 2;
    const y = dy + i * lh;
    for (const r of runs) {
      cmds.push(...r.font.getPath(r.text, x, y, size, KERN).commands);
      x += r.font.getAdvanceWidth(r.text, size, KERN);
    }
  });
  let d = '';
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  const see = (x, y) => { if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y; };
  for (const c of cmds) {
    if (c.type === 'M' || c.type === 'L') { d += `${c.type}${f1(c.x)} ${f1(c.y)}`; see(c.x, c.y); }
    else if (c.type === 'C') { d += `C${f1(c.x1)} ${f1(c.y1)} ${f1(c.x2)} ${f1(c.y2)} ${f1(c.x)} ${f1(c.y)}`; see(c.x, c.y); see(c.x1, c.y1); see(c.x2, c.y2); }
    else if (c.type === 'Q') { d += `Q${f1(c.x1)} ${f1(c.y1)} ${f1(c.x)} ${f1(c.y)}`; see(c.x, c.y); see(c.x1, c.y1); }
    else if (c.type === 'Z') d += 'Z';
  }
  if (!Number.isFinite(x1)) { x1 = x2 = cx; y1 = y2 = cy; }
  const stroke = layer.o ? Math.max(1, size * OUTLINE) : 0;
  const padX = size * 0.28, padY = size * 0.2;
  const bg = layer.b ? { x: x1 - padX, y: y1 - padY, w: x2 - x1 + 2 * padX, h: y2 - y1 + 2 * padY, r: size * 0.18 } : null;
  return { d, size, lines: lines.length, bbox: { x1, y1, x2, y2 }, stroke, bg };
}

// The layers as an SVG of W × H (out: its size in pixels when it's drawn bigger or smaller, a video's say). Colors are only
// ever #rrggbb (src/studio/memes.js checkLayers), so nothing here is anyone's words but the shapes of their letters.
export function layersSvg(fonts, layers, W, H, { outW = W, outH = H } = {}) {
  let body = '';
  for (const l of layers || []) {
    const s = layerShape(fonts, l, W, H);
    if (s.bg) body += `<rect x="${f1(s.bg.x)}" y="${f1(s.bg.y)}" width="${f1(s.bg.w)}" height="${f1(s.bg.h)}" rx="${f1(s.bg.r)}" fill="${l.b}"/>`;
    if (!s.d) continue;
    if (s.stroke) body += `<path d="${s.d}" fill="none" stroke="${l.o}" stroke-width="${f1(s.stroke)}" stroke-linejoin="round" stroke-linecap="round"/>`;
    body += `<path d="${s.d}" fill="${l.c}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
}

// The layers drawn on a canvas's 2D context, in the canvas's own pixels (the page: W × H is the meme's canvas). shape: how a
// layer becomes shapes (the editor passes its own, which keeps them while only a layer's place changes, and may give a
// ready Path2D as s.path)
export function drawLayers(ctx, fonts, layers, W, H, shape = layerShape) {
  for (const l of layers || []) {
    const s = shape(fonts, l, W, H);
    if (s.bg) {
      ctx.fillStyle = l.b;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(s.bg.x, s.bg.y, s.bg.w, s.bg.h, s.bg.r); else ctx.rect(s.bg.x, s.bg.y, s.bg.w, s.bg.h);
      ctx.fill();
    }
    if (!s.d) continue;
    const p = s.path || new Path2D(s.d);
    if (s.stroke) {
      ctx.strokeStyle = l.o;
      ctx.lineWidth = s.stroke;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke(p);
    }
    ctx.fillStyle = l.c;
    ctx.fill(p);
  }
}

// Where each layer's words are, in the canvas's pixels (the share mark goes where none are: memes.js markSpot) → [{ x, y, w, h }]:
// its background, else its letters with their outline and a little room around them
export function wordBoxes(fonts, layers, W, H, shape = layerShape) {
  return (layers || []).map((l) => {
    const s = shape(fonts, l, W, H);
    if (s.bg) return { x: s.bg.x, y: s.bg.y, w: s.bg.w, h: s.bg.h };
    const pad = s.stroke / 2 + s.size * 0.08;
    return { x: s.bbox.x1 - pad, y: s.bbox.y1 - pad, w: s.bbox.x2 - s.bbox.x1 + 2 * pad, h: s.bbox.y2 - s.bbox.y1 + 2 * pad };
  });
}
