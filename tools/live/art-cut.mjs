// AGI-1's live show (2026-10-07, her painted set): makes the paintings Google's image AI painted on the owner's server
// (tools/live/art.mjs, copied to the PC's _source-assets/art) ready for her set: one of each (tools/live/art-picks.json
// says which), her backdrops at the set's size, and the people she meets and the things she wears cut out of their green
// background (keyed: the green, and any green showing through a gap or a glass, made see-through; the green spilled on
// their edges taken out), cropped to what's left and made small. Into tools/live/page/art/<group>/<id>.webp, which her set
// finds when it's built (tools/live/page/paint.js). Claude runs it after looking at every picture; nothing here talks to
// the network.
//
//   node tools/live/art-cut.mjs <the art folder>                  every picture (the picks in tools/live/art-picks.json)
//   node tools/live/art-cut.mjs <the art folder> --only omar,paris these again
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { artList, extOf } from './art.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
export const OUT = join(ROOT, 'tools/live/page/art');
export const PICKS_FILE = join(ROOT, 'tools/live/art-picks.json');
// how big each kind ends up: a backdrop at the set's size; a person about as tall as she's shown (a little more, for the
// camera moving in); a thing she wears at most this wide or tall
export const SIZE = { backdrop: { w: 1280, h: 720 }, people: 640, accessories: 512 };
// pictures whose middle shows the background on purpose: a glass visor, clear lenses, a gap in a headband (green seen
// through it, a little tinted, is keyed out too)
export const SEE_THROUGH = { helmet: 0.38, glasses: 0.45, nova: 0.5 };
// pictures with green parts of their own that touch the background (the hibiscus' leaves, painted on a lighter green):
// only what's nearly the background's own green is keyed from the edges in (else its leaves came out grey and half
// see-through)
export const GREEN_INSIDE = { 'flower-hibiscus': 0.8 };
// a glass whose reflections were painted tinted by the green behind it (the helmet's visor: two mint stripes): those
// become what a reflection on glass is, a see-through white
export const GLASS_GLINTS = { helmet: true };
export function whitenGlints(rgba, w, h) {
  let n = 0;
  for (let p = 0; p < w * h; p++) {
    const o = p * 4, r = rgba[o], g = rgba[o + 1], b = rgba[o + 2];
    if (!rgba[o + 3]) continue;
    const m = Math.max(r, b);
    if (g - m <= 12) continue;
    const v = Math.min(255, Math.round((r + g + b) / 3 + 18));
    rgba[o] = v; rgba[o + 1] = v; rgba[o + 2] = Math.min(255, v + 6);
    rgba[o + 3] = Math.round(rgba[o + 3] * 0.6);
    n++;
  }
  return n;
}

// headphones painted from the front, their cups facing us: on her the inside of each cup (its cushion, dark) showed in the
// gaps between her face and the hair beside it, like black patches by her eyes. Seen from the front, cups at the sides of
// a head show only their outer part, so only that is kept: per row, `keep` of each cup's width from its outer edge (its
// stripe and shell), the rest fading out over a few pixels. The band and its arms stay as painted.
export const OUTER_CUPS = { 'headphones-midnight': 0.5, 'headphones-gamer': 0.5 };
export function outerCups(rgba, w, h, keep = 0.5) {
  const mid = Math.floor(w / 2), solid = (x, y) => rgba[(y * w + x) * 4 + 3] >= 128;
  const e = Math.max(2, Math.round(w * 0.012));
  let n = 0;
  for (const side of [-1, 1]) {
    // each row's span on this side: its outer and inner edge (where it's solid)
    const xs = side < 0 ? [...Array(mid).keys()] : [...Array(w - mid).keys()].map((k) => w - 1 - k);
    const rows = [];
    for (let y = 0; y < h; y++) {
      let o = -1, i = -1;
      for (const x of xs) if (solid(x, y)) { if (o < 0) o = x; i = x; }
      rows.push(o < 0 ? null : { o, i, wide: Math.abs(i - o) });
    }
    // the cups: from the first row in the picture's lower part much wider than the band's arms, down to the bottom
    const first = rows.findIndex((r, y) => y > h * 0.4 && r && r.wide > w * 0.14);
    if (first < 0) continue;
    const cut = rows.map((r) => (r ? r.o + (r.i - r.o) * keep : null));
    // (from a few rows above it: the top of a cup's rim begins faint)
    for (let y = Math.max(0, first - Math.round(h * 0.03)); y < h; y++) {
      // (the line, smoothed over a few rows: a painted glow on a cup's outer side shouldn't make it jagged)
      let s = 0, c = 0;
      for (let k = Math.max(first, y - 8); k <= Math.min(h - 1, Math.max(first, y) + 8); k++) if (cut[k] !== null) { s += cut[k]; c++; }
      if (!c) continue;
      const line = s / c;
      for (const x of xs) {
        const d = side < 0 ? x - line : line - x;             // how far inside the line (toward the middle)
        const o = (y * w + x) * 4 + 3;
        if (!rgba[o] || d <= -e) continue;
        const keepA = d >= e ? 0 : 1 - (d + e) / (2 * e);
        const a = Math.round(rgba[o] * keepA);
        if (a !== rgba[o]) { rgba[o] = a; n++; }
      }
    }
  }
  return n;
}

// cat ears on a headband painted whole: on her the band's two ends came down past her bangs, beside her eyes (white lines
// with the white ears, black ones with the black). Below the ears, where only the band's thin ends are, it fades out: on a
// head, the rest of a headband is under the hair.
export const BAND_ENDS = { 'catears-black': true, 'catears-white': true };
export function trimBandEnds(rgba, w, h) {
  const solid = (x, y) => rgba[(y * w + x) * 4 + 3] >= 128;
  // the ears' bottom: the lowest row with something wide in it (the band's ends are thin)
  let ears = -1;
  for (let y = h - 1; y >= 0 && ears < 0; y--) {
    let run = 0;
    for (let x = 0; x < w; x++) { run = solid(x, y) ? run + 1 : 0; if (run > w * 0.1) { ears = y; break; } }
  }
  if (ears < 0) return 0;
  const from = ears + Math.round(h * 0.02), fade = Math.max(2, Math.round(h * 0.04));
  let n = 0;
  for (let y = from; y < h; y++) {
    const k = Math.max(0, 1 - (y - from) / fade);
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4 + 3;
      if (!rgba[o]) continue;
      const a = Math.round(rgba[o] * k);
      if (a !== rgba[o]) { rgba[o] = a; n++; }
    }
  }
  return n;
}

// a hat painted a little from below, its inside showing under its cuff (the beanie: a brown oval): on her that oval sat
// over her forehead like a visor. The inside goes (found from its middle by its color: everything under its top edge, in
// its columns), so the cuff's own bottom line is the hat's edge, with her hair under it.
export const HAT_INSIDE = { 'beanie-yellow': true };
export function dropHatInside(rgba, w, h) {
  const at = (x, y) => (y * w + x) * 4;
  // its color: the middle of a small box around where the inside is (the middle, near the bottom)
  const box = [];
  for (let y = Math.round(h * 0.85); y <= Math.round(h * 0.9); y++) for (let x = Math.round(w * 0.45); x <= Math.round(w * 0.55); x++) {
    const o = at(x, y); if (rgba[o + 3] > 200) box.push([rgba[o], rgba[o + 1], rgba[o + 2]]);
  }
  if (box.length < 20) return 0;
  const mid = [0, 1, 2].map((c) => box.map((p) => p[c]).sort((a, b) => a - b)[box.length >> 1]);
  // what's that color (its shaded cuff can be too: the inside is found where it's that color all around, so it can't
  // leak into the cuff through a gap in the line between them, then grown back to its edge)
  const m = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const o = p * 4;
    m[p] = rgba[o + 3] > 128 && Math.abs(rgba[o] - mid[0]) + Math.abs(rgba[o + 1] - mid[1]) + Math.abs(rgba[o + 2] - mid[2]) < 40 ? 1 : 0;
  }
  const r = 3, sat = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += m[y * w + x]; sat[(y + 1) * (w + 1) + x + 1] = sat[y * (w + 1) + x + 1] + row; } }
  const full = (x, y) => {
    const xa = Math.max(0, x - r), ya = Math.max(0, y - r), xb = Math.min(w, x + r + 1), yb = Math.min(h, y + r + 1);
    return sat[yb * (w + 1) + xb] - sat[ya * (w + 1) + xb] - sat[yb * (w + 1) + xa] + sat[ya * (w + 1) + xa] === (xb - xa) * (yb - ya);
  };
  const sx = Math.round(w * 0.5), sy = Math.round(h * 0.875);
  if (!m[sy * w + sx] || !full(sx, sy)) return 0;
  const core = new Uint8Array(w * h), stack = [sy * w + sx];
  core[sy * w + sx] = 1;
  while (stack.length) {
    const p = stack.pop(), x = p % w, y = (p - x) / w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < h * 0.6 || nx >= w || ny >= h) continue;
      const q = ny * w + nx;
      if (!core[q] && m[q] && full(nx, ny)) { core[q] = 1; stack.push(q); }
    }
  }
  // grown back to its edge (only what's its color, a few pixels out)
  const top = new Int32Array(w).fill(h);
  let x0 = w, x1 = -1, count = 0;
  for (let y = Math.floor(h * 0.6); y < h; y++) for (let x = 0; x < w; x++) {
    if (!m[y * w + x]) continue;
    let inside = core[y * w + x] === 1;
    for (let dy = -r; dy <= r && !inside; dy++) for (let dx = -r; dx <= r && !inside; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && core[ny * w + nx]) inside = true;
    }
    if (!inside) continue;
    count++;
    if (y < top[x]) top[x] = y;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
  }
  if (count < w * h * 0.01) return 0;
  // everything under its top edge, in its columns, goes (its top edge smoothed over a few columns)
  let n = 0;
  for (let x = x0; x <= x1; x++) {
    let s = 0, c = 0;
    for (let k = Math.max(x0, x - 3); k <= Math.min(x1, x + 3); k++) if (top[k] < h) { s += top[k]; c++; }
    if (!c) continue;
    const t = Math.round(s / c);
    for (let y = t; y < h; y++) { const o = at(x, y); if (rgba[o + 3]) { rgba[o + 3] = y === t ? rgba[o + 3] >> 1 : 0; n++; } }
  }
  return n;
}

// (2026-10-08, the owner's screenshot: the conical hat perched above her head, "a black chin-strap loop across her forehead")
// a hat painted from a little below, the band inside it and its chin straps painted dark and thick: on her (her head inside
// it now: the hat's underside behind her head, outfits.js) they hung over her face. They go: what's dark and thicker than
// the painting's own lines (they're thin) is painted over from what's either side of it, across its narrower way (the band
// from the lining above and below it, the straps from either side); where a strap hangs below the brim, there's nothing
// either side, so it's gone.
export const HAT_STRAPS = { conical: true };
export function dropStraps(rgba, w, h, { dark = 80, thick = 2, long = 10 } = {}) {
  const at = (x, y) => (y * w + x) * 4;
  const lum = (o) => 0.3 * rgba[o] + 0.59 * rgba[o + 1] + 0.11 * rgba[o + 2];
  const d = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) d[p] = rgba[p * 4 + 3] > 128 && lum(p * 4) < dark ? 1 : 0;
  // thick: still dark `thick` pixels in every direction (the painting's lines are thinner), and for a while (`long`
  // pixels at least: where two of its lines meet, they're that thick for a moment, and stay), then grown back over its
  // edges (their soft, lighter rims too: all of what's that close)
  const core = new Uint8Array(w * h);
  for (let y = thick; y < h - thick; y++) for (let x = thick; x < w - thick; x++) {
    let all = 1;
    for (let k = -thick; k <= thick && all; k++) if (!d[(y + k) * w + x] || !d[y * w + x + k]) all = 0;
    core[y * w + x] = all;
  }
  const seen = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    if (!core[p] || seen[p]) continue;
    const blob = [p], stack = [p];
    let x0 = w, x1 = -1, y0 = h, y1 = -1;
    seen[p] = 1;
    while (stack.length) {
      const q = stack.pop(), x = q % w, y = (q - x) / w;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, r = ny * w + nx;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && core[r] && !seen[r]) { seen[r] = 1; blob.push(r); stack.push(r); }
      }
    }
    if (Math.max(x1 - x0, y1 - y0) + 1 < long) for (const q of blob) core[q] = 0;
  }
  const grow = thick + 4, m = new Uint8Array(w * h);
  let count = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!core[y * w + x]) continue;
    for (let dy = -grow; dy <= grow; dy++) for (let dx = -grow; dx <= grow; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || dx * dx + dy * dy > grow * grow) continue;
      const q = ny * w + nx;
      if (!m[q]) { m[q] = 1; count++; }
    }
  }
  if (!count) return 0;
  // painted over from the outside in: each pixel across its narrower way, from the nearest clean pixels either side
  // (their colors and their alpha: nothing either side, nothing here; a color only from a side that's there, so the green
  // keyed out round it never tints it). Only across a stroke's own width at first (32 px, then a little more each pass):
  // where it's covered further both ways (a strap's top, where it meets the band), on a later pass, from what the passes
  // before filled in (never along the strap, from below the brim: its top came out half see-through).
  const out = Uint8ClampedArray.from(rgba), MAX = 40, PASSES = 6, FIRST = 32, MORE = 16;
  const end = (x, y, dx, dy) => {
    for (let k = 1; k <= MAX; k++) {
      const px = x + k * dx, py = y + k * dy;
      if (px < 0 || py < 0 || px >= w || py >= h) return [k, -1];          // past the picture's edge: nothing there
      if (!m[py * w + px]) return [k, at(px, py)];
    }
    return null;
  };
  let left = count;
  for (let pass = 0; pass < PASSES && left; pass++) {
    const done = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!m[y * w + x]) continue;
      const L = end(x, y, -1, 0), R = end(x, y, 1, 0), U = end(x, y, 0, -1), Dn = end(x, y, 0, 1);
      const across = L && R ? L[0] + R[0] : Infinity, down = U && Dn ? U[0] + Dn[0] : Infinity, last = pass === PASSES - 1;
      let A, B;
      if (!last && Math.min(across, down) > FIRST + MORE * pass) continue;
      if (across <= down && across < Infinity) [A, B] = [L, R];
      else if (down < Infinity) [A, B] = [U, Dn];
      else [A, B] = L || R ? [L, R] : [U, Dn];                              // the last pass: what's there
      const ka = A ? A[0] : 1, kb = B ? B[0] : 1, t = ka / (ka + kb), pa = A ? A[1] : -1, pb = B ? B[1] : -1, o = at(x, y);
      const wa = (pa >= 0 ? out[pa + 3] : 0) * (1 - t), wb = (pb >= 0 ? out[pb + 3] : 0) * t;
      out[o + 3] = Math.round(wa + wb);
      for (let c = 0; c < 3; c++) out[o + c] = wa + wb > 0 ? Math.round(((pa >= 0 ? out[pa + c] : 0) * wa + (pb >= 0 ? out[pb + c] : 0) * wb) / (wa + wb)) : 0;
      done.push(y * w + x);
    }
    for (const p of done) m[p] = 0;
    left -= done.length;
  }
  rgba.set(out);
  return count;
}

// (2026-10-08) glasses asked for with "clear see-through lenses", painted milky over the green (the green seen through
// them pale, about three parts white, and as solid as the frame): on her they hid her eyes. Their lenses made clear: in
// each half, from the middle of what's there below its temples, what's inside the dark line round the lens (its frame's
// inner edge), a faint tint left (`alpha`), and the glints painted on it (lighter than the lens) kept, a see-through white
// (`glint` at most). A lens that isn't closed by its line all the way round (its fill running out into its frame, to
// within `margin` px of what's see-through, or to the picture's edge) is left as it is.
export const CLEAR_LENSES = { glasses: { alpha: 0.08, glint: 0.7 } };
export function clearLenses(rgba, w, h, { alpha = 0.08, glint = 0.7, line = 150, tint = [226, 244, 236], margin = 6 } = {}) {
  const lum = (o) => 0.3 * rgba[o] + 0.59 * rgba[o + 1] + 0.11 * rgba[o + 2];
  // what's near the see-through outside (within `margin` px: a lens is inside its frame, farther in than that)
  const near = new Uint8Array(w * h), row = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let last = -1e9;
    for (let x = 0; x < w; x++) { if (rgba[(y * w + x) * 4 + 3] <= 128) last = x; if (x - last <= margin) row[y * w + x] = 1; }
    last = 1e9;
    for (let x = w - 1; x >= 0; x--) { if (rgba[(y * w + x) * 4 + 3] <= 128) last = x; if (last - x <= margin) row[y * w + x] = 1; }
  }
  for (let x = 0; x < w; x++) {
    let last = -1e9;
    for (let y = 0; y < h; y++) { if (row[y * w + x]) last = y; if (y - last <= margin) near[y * w + x] = 1; }
    last = 1e9;
    for (let y = h - 1; y >= 0; y--) { if (row[y * w + x]) last = y; if (last - y <= margin) near[y * w + x] = 1; }
  }
  const lenses = [];
  for (const half of [0, 1]) {
    const x0 = half ? Math.floor(w / 2) : 0, x1 = half ? w : Math.floor(w / 2);
    let sx = 0, sy = 0, c = 0;
    for (let y = Math.floor(h * 0.25); y < h; y++) for (let x = x0; x < x1; x++) if (rgba[(y * w + x) * 4 + 3] > 200) { sx += x; sy += y; c++; }
    if (!c) continue;
    const seed = Math.round(sy / c) * w + Math.round(sx / c);
    if (rgba[seed * 4 + 3] <= 200 || lum(seed * 4) < line) continue;
    const inLens = new Uint8Array(w * h), stack = [seed], pixels = [];
    inLens[seed] = 1;
    let open = false;
    while (stack.length && !open) {
      const p = stack.pop(), x = p % w, y = (p - x) / w;
      pixels.push(p);
      if (!x || !y || x === w - 1 || y === h - 1 || near[p]) { open = true; break; }
      for (const q of [p - 1, p + 1, p - w, p + w]) {
        if (inLens[q]) continue;
        const o = q * 4;
        if (rgba[o + 3] <= 128) { open = true; break; }
        if (lum(o) >= line) { inLens[q] = 1; stack.push(q); }
      }
    }
    if (!open) lenses.push(pixels);
  }
  for (const pixels of lenses) {
    // the lens' own fill (the middle of its brightness), and lighter than that: a glint
    const ls = pixels.map((p) => lum(p * 4)).sort((a, b) => a - b), mid = ls[ls.length >> 1];
    for (const p of pixels) {
      const o = p * 4, g = Math.max(0, Math.min(1, (lum(o) - mid - 8) / 24));
      for (let k = 0; k < 3; k++) rgba[o + k] = Math.round(tint[k] + (255 - tint[k]) * g);
      rgba[o + 3] = Math.round(255 * (alpha + (glint - alpha) * g));
    }
  }
  return lenses.map((l) => l.length);
}

// (2026-10-08) until their own painting is there (Google skipped them in the owner's first run), three are made from a
// painting asked for in the same words but another color, its colors turned (the drawing as painted): the mint star clips
// from the golden ones, Istanbul's light blue scarf from Paris' light red one, Rio's pink hibiscus from Palawan's red one
// (only its reds: its leaves stay green). Their own painting, once it's there, is used instead.
export const STAND_INS = {
  'clips-mint': { from: 'clips-honey', hue: 125 },
  'scarf-istanbul': { from: 'scarf-paris', hue: -150 },
  'flower-pink': { from: 'flower-hibiscus', hue: -28, reds: true },
};
// a picture's colors turned around the color wheel by `deg`, each pixel's lightness and saturation as they were; `reds`:
// only reds and pinks (softly, by how red), the rest as it is; greys and the line work's black stay
export function turnHue(rgba, w, h, deg, { reds = false } = {}) {
  let n = 0;
  for (let p = 0; p < w * h; p++) {
    const o = p * 4;
    if (!rgba[o + 3]) continue;
    const r = rgba[o] / 255, g = rgba[o + 1] / 255, b = rgba[o + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (d < 0.06) continue;                                   // (grey, white, black: as they are)
    const s = d / (1 - Math.abs(2 * l - 1));
    let hue = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue *= 60;
    let k = 1;
    if (reds) { const off = Math.min(Math.abs(hue - 360), hue); k = off < 35 ? 1 : off > 60 ? 0 : (60 - off) / 25; }
    if (!k) continue;
    const hh = (((hue + deg * k) % 360) + 360) % 360 / 60;
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((hh % 2) - 1)), m = l - c / 2;
    const [r1, g1, b1] = hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
    rgba[o] = Math.round((r1 + m) * 255); rgba[o + 1] = Math.round((g1 + m) * 255); rgba[o + 2] = Math.round((b1 + m) * 255);
    n++;
  }
  return n;
}

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// ---------- keying ----------
// The green: the middle color of the picture's border where it's green (else pure #00FF00). How green a pixel is: how much
// more green it has than red or blue, against the background's own (1 = the background, 0 = no green at all). The
// background is what's green and joined to the picture's edges (so a green shirt in the middle of a person stays); inside,
// only the background's own green (a gap between an arm and the body, or seen through glass) is keyed. (Asked for pure
// #00FF00, the models now and then painted a softer green: a pastel one, or an olive one behind the conical hat, 150,204,69.)
export function keyColor(px, w, h, ch = 4) {
  const rs = [], gs = [], bs = [];
  const take = (x, y) => {
    const i = (y * w + x) * ch, r = px[i], g = px[i + 1], b = px[i + 2];
    if (g > r + 40 && g > b + 40) { rs.push(r); gs.push(g); bs.push(b); }
  };
  const band = Math.max(2, Math.round(Math.min(w, h) * 0.01));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < band || y < band || x >= w - band || y >= h - band) take(x, y);
  if (rs.length < 20) return [0, 255, 0];
  const mid = (a) => a.sort((p, q) => p - q)[a.length >> 1];
  return [mid(rs), mid(gs), mid(bs)];
}
export function keyOut(px, w, h, { ch = 4, seeThrough = 0, grow = 0.3, key = keyColor(px, w, h, ch) } = {}) {
  const [kr, kg, kb] = key;
  const kd = Math.max(40, kg - Math.max(kr, kb));
  const n = w * h, kk = new Float32Array(n);
  // how green each pixel is (1: the background's green; below 0: more red or blue than green, like skin, hair or outlines)
  for (let p = 0; p < n; p++) {
    const i = p * ch;
    kk[p] = (px[i + 1] - Math.max(px[i], px[i + 2])) / kd;
  }
  // the background: from the edges, through what's green enough
  const bg = new Uint8Array(n), queue = new Int32Array(n);
  let qh = 0, qt = 0;
  const seed = (p) => { if (!bg[p] && kk[p] >= Math.max(0.5, grow)) { bg[p] = 1; queue[qt++] = p; } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (qh < qt) {
    const p = queue[qh++], x = p % w, y = (p - x) / w;
    for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
      if (q >= 0 && !bg[q] && kk[q] >= grow) { bg[q] = 1; queue[qt++] = q; }
    }
  }
  // inside: only the background's own green (a gap, or seen through glass: seeThrough says how tinted it may be)
  const lo = seeThrough > 0 ? seeThrough : 0.8;
  for (let p = 0; p < n; p++) if (!bg[p] && kk[p] >= lo) bg[p] = 2;
  // the edge: what's next to the background (3 pixels), where a pixel can be part green
  const R = 3, edge = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    if (!bg[p]) continue;
    const x = p % w, y = (p - x) / w;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h && !bg[yy * w + xx]) edge[yy * w + xx] = 1;
    }
  }
  // what the thing's own color would be there (how green it is), from the pixels of it nearby that are surely it
  const sure = (p) => !bg[p] && !edge[p];
  function ownGreen(x, y) {
    for (const r of [4, 8]) {
      let s = 0, c = 0;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const q = yy * w + xx;
        if (sure(q)) { s += kk[q]; c += 1; }
      }
      if (c >= 3) return Math.min(0.6, s / c);
    }
    return -0.1;
  }
  const out = Buffer.alloc(n * 4);
  for (let p = 0; p < n; p++) {
    const i = p * ch, o = p * 4;
    let a = 1;
    const k = kk[p];
    if (bg[p] || edge[p]) {
      // part green, part itself: how much of it is the thing (1 − its green, against how green the thing is itself);
      // the background and its small shades (or a tinted gap) fully see-through
      const full = bg[p] === 2 ? Math.min(0.97, lo + 0.17) : 0.8;
      if (k >= full) a = 0;
      else {
        const x = p % w, y = (p - x) / w, f = ownGreen(x, y);
        a = clamp01((1 - k) / Math.max(0.05, 1 - f));
      }
    }
    let r = px[i], g = px[i + 1], b = px[i + 2];
    if (a > 0 && a < 1) {
      // its own color, without the background mixed into it
      r = (r - (1 - a) * kr) / a; g = (g - (1 - a) * kg) / a; b = (b - (1 - a) * kb) / a;
    }
    out[o] = Math.round(Math.min(255, Math.max(0, r)));
    out[o + 1] = Math.round(Math.min(255, Math.max(0, g)));
    out[o + 2] = Math.round(Math.min(255, Math.max(0, b)));
    out[o + 3] = Math.round(a * 255);
  }
  // the green spilled on the edges: no more green than red or blue there (unless the thing itself is green)
  for (let p = 0; p < n; p++) {
    const o = p * 4;
    if (!edge[p] || out[o + 3] === 0) continue;
    const x = p % w, y = (p - x) / w;
    if (ownGreen(x, y) > 0.1) continue;
    const m = Math.max(out[o], out[o + 2]);
    if (out[o + 1] > m) out[o + 1] = m + Math.round((out[o + 1] - m) * 0.2);
  }
  return out;
}
// specks: what's left apart from the thing itself and much smaller than it (a crumb of the background, or a mark in a corner)
// goes, with its soft edge; parts of the thing that are apart from it but not tiny (a second clip, a lens) stay
export function dropSpecks(rgba, w, h, { keep = 0.02 } = {}) {
  const n = w * h, comp = new Int32Array(n).fill(-1), sizes = [];
  const stack = new Int32Array(n);
  for (let p = 0; p < n; p++) {
    if (comp[p] !== -1 || rgba[p * 4 + 3] < 128) continue;
    const id = sizes.length;
    let sp = 0, size = 0;
    stack[sp++] = p; comp[p] = id;
    while (sp) {
      const q = stack[--sp], x = q % w, y = (q - x) / w;
      size += 1;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const r = yy * w + xx;
        if (comp[r] === -1 && rgba[r * 4 + 3] >= 128) { comp[r] = id; stack[sp++] = r; }
      }
    }
    sizes.push(size);
  }
  if (!sizes.length) return { dropped: 0 };
  const big = Math.max(...sizes), min = big * keep;
  const kept = new Uint8Array(n);
  for (let p = 0; p < n; p++) if (comp[p] >= 0 && sizes[comp[p]] >= min) kept[p] = 1;
  // near what stays (3 pixels): its soft edge stays too
  const near = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    if (!kept[p]) continue;
    const x = p % w, y = (p - x) / w;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h) near[yy * w + xx] = 1;
    }
  }
  let dropped = 0;
  for (let p = 0; p < n; p++) {
    if (rgba[p * 4 + 3] && !kept[p] && !(near[p] && rgba[p * 4 + 3] < 128)) { rgba[p * 4 + 3] = 0; dropped += 1; }
  }
  return { dropped, parts: sizes.filter((s) => s >= min).length };
}
// ---------- a backdrop's light panel ----------
// Asked to keep the right side calm for her, the image models sometimes painted a see-through light panel there (a
// rectangle of the picture washed toward white: out = in·(1 − a) + c·a, with a about 0.2–0.45). That's undone: a and c
// per channel from the picture on both sides of each edge of the panel (it carries on there), the panel's pixels
// turned back, and the few columns at each edge (where the JPEG rings) bridged with a straight blend. x0..x1: the
// panel's columns in the picture's own pixels (x1 = its width: up to the right edge).
export function unPanel(px, w, h, ch, x0, x1) {
  const L = (x, y) => { const i = (y * w + x) * ch; return (px[i] + px[i + 1] + px[i + 2]) / 3; };
  const colMean = (x) => { let s = 0; for (let y = 0; y < h; y++) s += L(x, y); return s / h; };
  // the exact edge: the biggest step within 5 columns of where it was said to be
  const snap = (e) => {
    let best = e, top = -1;
    for (let x = Math.max(1, e - 5); x < Math.min(w, e + 5); x++) { const d = Math.abs(colMean(x) - colMean(x - 1)); if (d > top) { top = d; best = x; } }
    return best;
  };
  x0 = x0 > 0 ? snap(x0) : 0;
  x1 = x1 < w ? snap(x1) : w;
  if (x1 - x0 < 16) throw new Error(`the panel ${x0}..${x1} is too narrow`);
  const pairs = [];
  for (let k = 4; k < 8; k++) {
    if (x0 > 0) pairs.push([x0 - k, x0 + k - 1]);
    if (x1 < w) pairs.push([x1 + k - 1, x1 - k]);
  }
  if (!pairs.length) throw new Error('a panel needs at least one edge inside the picture');
  const fit = [];
  for (let c = 0; c < 3; c++) {
    const xs = [], ys = [];
    for (const [o, i] of pairs) for (let y = 0; y < h; y++) { xs.push(px[(y * w + o) * ch + c]); ys.push(px[(y * w + i) * ch + c]); }
    let keep = xs.map(() => true), m = 1, b = 0;
    for (let round = 0; round < 5; round++) {          // a straight line, then without the rows where the picture changes
      let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
      xs.forEach((x, j) => { if (keep[j]) { n++; sx += x; sy += ys[j]; sxx += x * x; sxy += x * ys[j]; } });
      const den = n * sxx - sx * sx;
      if (n < 20 || Math.abs(den) < 1e-6) break;
      m = (n * sxy - sx * sy) / den; b = (sy - m * sx) / n;
      let ss = 0;
      xs.forEach((x, j) => { if (keep[j]) ss += (ys[j] - (m * x + b)) ** 2; });
      const s = Math.sqrt(ss / n) || 1;
      keep = xs.map((x, j) => Math.abs(ys[j] - (m * x + b)) < 2.5 * s);
    }
    if (!(m > 0.3 && m < 0.98)) throw new Error(`no light panel to undo at ${x0}..${x1} (channel ${c}: ${m.toFixed(2)})`);
    fit.push({ m, b });
  }
  const at = (x, y, c) => (y * w + x) * ch + c;
  for (let y = 0; y < h; y++) for (let x = x0; x < x1; x++) for (let c = 0; c < 3; c++) {
    const i = at(x, y, c);
    px[i] = Math.max(0, Math.min(255, Math.round((px[i] - fit[c].b) / fit[c].m)));
  }
  for (const e of [x0 > 0 ? x0 : -1, x1 < w ? x1 : -1].filter((e) => e >= 4 && e + 3 < w)) {
    const l = e - 4, r = e + 3;
    for (let y = 0; y < h; y++) for (let x = l + 1; x < r; x++) {
      const t = (x - l) / (r - l);
      for (let c = 0; c < 3; c++) px[at(x, y, c)] = Math.round(px[at(l, y, c)] * (1 - t) + px[at(r, y, c)] * t);
    }
  }
  return { x0, x1, alpha: fit.map((f) => +(1 - f.m).toFixed(3)) };
}

// a pick in art-picks.json: which of a picture's paintings (1, 2…; 0: none, drawn in code), or { k, flip, panel, crop }:
// that one mirrored left to right (a landmark painted on her side), and/or with its light panel undone (its columns),
// and/or only a part of it ([x, y, width, height] in its own pixels, 16:9: a picture painted as two, its seam put where
// she stands)
export function pickOf(v) {
  if (Number.isInteger(v)) return { k: v, flip: false, panel: null, crop: null };
  if (v && typeof v === 'object' && Number.isInteger(v.k)) {
    const nums = (a, n) => (Array.isArray(a) && a.length === n && a.every((x) => Number.isFinite(Number(x))) ? a.map(Number) : null);
    return { k: v.k, flip: v.flip === true, panel: nums(v.panel, 2), crop: nums(v.crop, 4) };
  }
  throw new Error(`a pick is a number or { k, flip, panel, crop }: ${JSON.stringify(v)}`);
}

// what's left: its box (a few pixels around it)
export function opaqueBox(rgba, w, h, { margin = 6, min = 10 } = {}) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (rgba[(y * w + x) * 4 + 3] >= min) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - margin); y0 = Math.max(0, y0 - margin); x1 = Math.min(w - 1, x1 + margin); y1 = Math.min(h - 1, y1 + margin);
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

export function cropRaw(rgba, w, { left, top, width, height }) {
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) out.set(rgba.subarray(((top + y) * w + left) * 4, ((top + y) * w + left + width) * 4), y * width * 4);
  return out;
}

// ---------- one picture ----------
export async function cutOne(sharp, file, item, { out = OUT, flip = false, panel = null, crop = null, like = item.id, turn = null } = {}) {
  const dst = join(out, item.group, `${item.id}.webp`);
  mkdirSync(dirname(dst), { recursive: true });
  if (['places', 'rooms', 'rides'].includes(item.group)) {
    let img = sharp(file), undone = null;
    if (panel) {
      const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
      undone = unPanel(data, info.width, info.height, info.channels, panel[0], panel[1]);
      img = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
    }
    if (crop) {
      const [left, top, width, height] = crop;
      if (Math.abs(width / height - 16 / 9) > 0.02) throw new Error(`${item.group}/${item.id}: a crop is 16:9 (${width} × ${height})`);
      img = sharp(await img.extract({ left, top, width, height }).toBuffer());
    }
    if (flip) img = img.flop();
    const buf = await img.resize(SIZE.backdrop.w, SIZE.backdrop.h, { fit: 'cover', position: 'centre' }).webp({ quality: 80, effort: 6 }).toBuffer();
    writeFileSync(dst, buf);
    return { file: dst, bytes: buf.length, width: SIZE.backdrop.w, height: SIZE.backdrop.h, undone };
  }
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // (`like`: whose own way of cutting applies: a stand-in's painting is cut as its own)
  const rgba = keyOut(data, info.width, info.height, { ch: info.channels, seeThrough: SEE_THROUGH[like] || 0, grow: GREEN_INSIDE[like] || 0.3 });
  dropSpecks(rgba, info.width, info.height);
  if (GLASS_GLINTS[like]) whitenGlints(rgba, info.width, info.height);
  if (turn) turnHue(rgba, info.width, info.height, turn.hue, { reds: turn.reds === true });
  const box = opaqueBox(rgba, info.width, info.height);
  if (!box) throw new Error(`${item.group}/${item.id}: nothing left after the green was keyed out`);
  // (its box first, then its own shape: where its cups are is measured on the headphones themselves)
  const own = cropRaw(rgba, info.width, box);
  if (OUTER_CUPS[like]) outerCups(own, box.width, box.height, OUTER_CUPS[like]);
  // (its size stays: where it sits on her is measured on the whole picture)
  if (BAND_ENDS[like]) trimBandEnds(own, box.width, box.height);
  if (HAT_INSIDE[like]) dropHatInside(own, box.width, box.height);
  // (what's left of a strap below its brim, cut off from the hat by it: a speck now, and it goes too)
  if (HAT_STRAPS[like] && dropStraps(own, box.width, box.height)) dropSpecks(own, box.width, box.height);
  if (CLEAR_LENSES[like]) clearLenses(own, box.width, box.height, CLEAR_LENSES[like]);
  let img = sharp(own, { raw: { width: box.width, height: box.height, channels: 4 } });
  img = item.group === 'people'
    ? img.resize({ height: Math.min(SIZE.people, box.height), withoutEnlargement: true })
    : img.resize({ width: SIZE.accessories, height: SIZE.accessories, fit: 'inside', withoutEnlargement: true });
  const buf = await img.webp({ quality: 90, alphaQuality: 100, effort: 6 }).toBuffer();
  writeFileSync(dst, buf);
  const meta = await sharp(buf).metadata();
  return { file: dst, bytes: buf.length, width: meta.width, height: meta.height };
}

// ---------- all of them ----------
export async function cutAll(from, { only = [], picks = null, out = OUT, log = console } = {}) {
  const sharp = (await import('sharp')).default;
  const chosen = picks || (existsSync(PICKS_FILE) ? JSON.parse(readFileSync(PICKS_FILE, 'utf8')) : {});
  const list = artList().filter((x) => !only.length || only.includes(x.id) || only.includes(`${x.group}/${x.id}`));
  const done = [], missing = [];
  for (const item of list) {
    const { k, flip, panel, crop } = pickOf(chosen[`${item.group}/${item.id}`] ?? 1);
    if (k === 0) continue;                                // (none of its pictures was good enough: drawn in code)
    let file = join(from, item.group, `${item.id}-${k}.${extOf(item.group)}`), stand = null;
    if (!existsSync(file) && STAND_INS[item.id]) {
      // (its own painting isn't there: a stand-in, if the one it's made from is; that one's own pick)
      const si = STAND_INS[item.id], sk = pickOf(chosen[`${item.group}/${si.from}`] ?? 1).k || 1;
      const sf = join(from, item.group, `${si.from}-${sk}.${extOf(item.group)}`);
      if (existsSync(sf)) { file = sf; stand = si; }
    }
    if (!existsSync(file)) { missing.push(`${item.group}/${item.id}-${k}`); continue; }
    const r = await cutOne(sharp, file, item, { out, flip, panel, crop, like: stand ? stand.from : item.id, turn: stand });
    done.push({ ...r, id: item.id, group: item.group, k, standIn: stand ? stand.from : null });
    const extra = [crop && `its part ${crop.join(', ')}`, flip && 'mirrored', r.undone && `its light panel undone (${r.undone.x0}..${r.undone.x1}, ${r.undone.alpha.join('/')})`].filter(Boolean);
    log.log(`${item.group}/${item.id} (${stand ? `for now ${stand.from}'s picture, its colors turned` : `picture ${k}`}${extra.length ? `, ${extra.join(', ')}` : ''}): ${r.width} × ${r.height}, ${Math.round(r.bytes / 1024)} KB`);
  }
  if (missing.length) log.log(`not there (drawn in code until they are): ${missing.join(', ')}`);
  return { done, missing };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [from, ...rest] = process.argv.slice(2);
  if (!from) { console.error('node tools/live/art-cut.mjs <the art folder> [--only omar,paris]'); process.exit(2); }
  const i = rest.indexOf('--only');
  const only = i >= 0 ? String(rest[i + 1] || '').split(',').map((s) => s.trim()).filter(Boolean) : [];
  const r = await cutAll(from, { only });
  console.log(`${r.done.length} made ready in ${OUT}${r.missing.length ? `, ${r.missing.length} not there` : ''}`);
}
