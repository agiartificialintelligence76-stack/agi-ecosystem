import fs from 'node:fs/promises';
import sharp from 'sharp';
import { SKIN_REGIONS_A } from '../../src/pfp/skin-regions-a.js';
import { skinMask } from '../../src/pfp/skin-mask.js';
import { recolorPixels, rgbToHsl } from '../../src/pfp/engine.js';

const destination = 'output/pfp-boundary-fix/a';
await fs.mkdir(destination, { recursive: true });
const total = 512 * 512;
function raster(poly) {
  const result = new Uint8Array(total);
  for (let y = 0; y < 512; y++) {
    const xs = [];
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [a, b] = poly[i], [c, d] = poly[j];
      if ((b > y + .5) !== (d > y + .5)) xs.push(a + (y + .5 - b) * (c - a) / (d - b));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) result.fill(1, y * 512 + Math.max(0, Math.ceil(xs[i] - .5)), y * 512 + Math.min(512, Math.ceil(xs[i + 1] - .5)));
  }
  return result;
}
function neighbors(p) {
  const x = p % 512, y = Math.floor(p / 512), r = [];
  if (x) r.push(p - 1); if (x < 511) r.push(p + 1); if (y) r.push(p - 512); if (y < 511) r.push(p + 512);
  return r;
}
function trace(mask) {
  const edges = new Map();
  const add = (a, b) => { const k = a.join(','); (edges.get(k) || edges.set(k, []).get(k)).push(b); };
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const p = y * 512 + x;
    if (!mask[p]) continue;
    if (!y || !mask[p - 512]) add([x, y], [x + 1, y]);
    if (x === 511 || !mask[p + 1]) add([x + 1, y], [x + 1, y + 1]);
    if (y === 511 || !mask[p + 512]) add([x + 1, y + 1], [x, y + 1]);
    if (!x || !mask[p - 1]) add([x, y + 1], [x, y]);
  }
  const loops = [];
  while (edges.size) {
    const start = edges.keys().next().value.split(',').map(Number), loop = [start];
    let at = start;
    for (let i = 0; i < 20000; i++) {
      const k = at.join(','), next = edges.get(k)?.pop();
      if (!next) break;
      if (!edges.get(k).length) edges.delete(k);
      if (next[0] === start[0] && next[1] === start[1]) break;
      loop.push(next); at = next;
    }
    const area = loop.reduce((sum, [x, y], i) => { const [a, b] = loop[(i + 1) % loop.length]; return sum + x * b - a * y; }, 0);
    if (area <= 0) continue;
    // Remove only exactly collinear vertices; preserve source-pixel coverage.
    loops.push(loop.filter((p, i) => {
      const a = loop[(i + loop.length - 1) % loop.length], b = loop[(i + 1) % loop.length];
      return (p[0] - a[0]) * (b[1] - p[1]) !== (p[1] - a[1]) * (b[0] - p[0]);
    }));
  }
  return loops;
}
const corrections = {}, report = [];
for (let character = 0; character < 16; character++) {
  const source = await sharp(`public/pfp/v1/character-${character}.png`).ensureAlpha().raw().toBuffer();
  const original = SKIN_REGIONS_A[character];
  const oldMask = new Uint8Array(total);
  for (const poly of original.slice(1)) { const m = raster(poly); for (let p = 0; p < total; p++) if (m[p]) oldMask[p] = 3; }
  const originalFace = raster(original[0]); for (let p = 0; p < total; p++) if (originalFace[p]) oldMask[p] = 1;
  const hsl = Array.from({ length: total }, (_, p) => rgbToHsl(...source.subarray(p * 4, p * 4 + 3)));
  const golden = Uint8Array.from(hsl, ([h, s, l], p) => Number(source[p * 4 + 3] > 32 && h >= 36.5 && h < 72 && s > .3 && l > .15 && l < .96));
  const seen = new Uint8Array(total), hair = new Uint8Array(total);
  for (let p = 0; p < total; p++) {
    if (!golden[p] || seen[p]) continue;
    const q = [p]; seen[p] = 1;
    for (let i = 0; i < q.length; i++) for (const n of neighbors(q[i])) if (golden[n] && !seen[n]) { q.push(n); seen[n] = 1; }
    if (q.length >= 100 && q.filter((n) => !oldMask[n]).length > q.length / 2) for (const n of q) hair[n] = 1;
  }
  // Follow the amber antialiasing of a connected strand, never isolated warm
  // collar/skin highlights. The source skin remains below this hue boundary.
  for (let pass = 0; pass < 2; pass++) {
    const grown = Uint8Array.from(hair);
    for (let p = 0; p < total; p++) {
      if (hair[p] || oldMask[p] !== 3 || !neighbors(p).some((n) => hair[n])) continue;
      const [h, s, l] = hsl[p];
      if (h >= 34.5 && h < 72 && s > .24 && l > .15 && l < .96) grown[p] = 1;
    }
    hair.set(grown);
  }
  if (character === 8) {
    // The curl at the left of the throat is an unusually amber shadow rather
    // than bright gold. These source-pixel rows follow its visible skin edge.
    const leftEdge = [244,244,244,245,245,245,245,245,245,245,245,244,244,245,245,246,247,247,249,249,247,247,247,247,247,247,247,247,247,247];
    for (let row = 0; row < leftEdge.length; row++) for (let x = 230; x < leftEdge[row]; x++) {
      const p = (298 + row) * 512 + x;
      if (oldMask[p] === 3) hair[p] = 1;
    }
  }
  const newRegions = [original[0]];
  let removed = 0, added = 0;
  for (const poly of original.slice(1)) {
    const mask = raster(poly);
    for (let p = 0; p < total; p++) if (mask[p] && hair[p]) { mask[p] = 0; removed++; }
    const ys = poly.map((p) => p[1]), minY = Math.min(...ys), maxY = Math.max(...ys);
    // Coarse neck polygons cut across the curved pale skin/collar boundary.
    // Follow the connected peach pixels below the neck midpoint until the
    // violet fabric begins. Hair has already been identified independently.
    if (maxY - minY > 45 || minY > 430) {
      for (let pass = 0; pass < 8; pass++) {
        const grown = Uint8Array.from(mask);
        for (let p = 0; p < total; p++) {
          if (mask[p] || hair[p] || source[p * 4 + 3] < 128 || Math.floor(p / 512) < minY + (maxY - minY) * .30 || !neighbors(p).some((n) => mask[n])) continue;
          const [h, s, l] = hsl[p];
          if ((h < 80 || h > 345) && s > .08 && l > .68) { grown[p] = 1; added++; }
        }
        mask.set(grown);
      }
    }
    newRegions.push(...trace(mask));
  }
  corrections[character] = newRegions;
  const replacement = new Uint8Array(total);
  for (const p of newRegions.slice(1)) { const m = raster(p); for (let i = 0; i < total; i++) if (m[i]) replacement[i] = 3; }
  const face = raster(newRegions[0]); for (let i = 0; i < total; i++) if (face[i]) replacement[i] = 1;
  const tiles = [];
  const configs = [{ label: 'Source', hair: 1, outfit: 0 }, { label: 'Before: burgundy / forest', hair: 4, outfit: 4 }, { label: 'After: burgundy / forest', hair: 4, outfit: 4 }, { label: 'After: moonlight / tangerine', hair: 11, outfit: 6 }];
  for (let i = 0; i < configs.length; i++) {
    skinMask(character).set(i < 2 ? oldMask : replacement);
    const result = recolorPixels(Uint8ClampedArray.from(source), { character, ...configs[i] });
    const png = await sharp(result, { raw: { width: 512, height: 512, channels: 4 } }).flatten({ background: '#30343e' }).png().toBuffer();
    await fs.writeFile(`${destination}/character-${character}-${i}.png`, png);
    tiles.push({ input: png, left: i * 512, top: 28 });
    tiles.push({ input: Buffer.from(`<svg width="512" height="28"><text x="8" y="20" font-family="Arial" font-size="15" fill="white">${character}: ${configs[i].label}</text></svg>`), left: i * 512, top: 0 });
  }
  skinMask(character).set(oldMask);
  await sharp({ create: { width: 2048, height: 540, channels: 3, background: '#191c24' } }).composite(tiles).png().toFile(`${destination}/character-${character}-proof.png`);
  report.push({ character, removedHairPixels: removed, addedSkinEdgePixels: added });
}
await fs.writeFile('src/pfp/skin-corrections-a.js', '// Pixel-aligned anatomy boundary corrections for looks 0–15.\n// These override the original contours without modifying the source artwork.\nexport const SKIN_CORRECTIONS_A = ' + JSON.stringify(corrections) + ';\n');
await fs.writeFile(`${destination}/report.json`, JSON.stringify(report, null, 2));
for (let start = 0; start < 16; start += 2) {
  const tiles = [];
  for (let n = start; n < start + 2; n++) for (let v = 2; v <= 3; v++) {
    tiles.push({ input: `${destination}/character-${n}-${v}.png`, left: (v - 2) * 512, top: (n - start) * 540 + 28 });
    tiles.push({ input: Buffer.from(`<svg width="512" height="28"><text x="8" y="20" font-size="16" fill="white">Character ${n} / ${v === 2 ? 'Burgundy forest' : 'Moonlight tangerine'}</text></svg>`), left: (v - 2) * 512, top: (n - start) * 540 });
  }
  await sharp({ create: { width: 1024, height: 1080, channels: 3, background: '#191c24' } }).composite(tiles).png().toFile(`${destination}/review-${start}.png`);
}
console.log(report);
