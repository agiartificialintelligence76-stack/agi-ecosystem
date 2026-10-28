// Restore the shirt's AGI print in the supplied VIGGCHAR v1 character.
// The original remains untouched. Existing splats are only recolored inside
// the front-shirt print; fine ink splats follow that surface and inherit its
// skin weights, so the print bends with the shirt instead of floating on it.
// Usage: node tools/model/fix-shirt-logo.mjs [source.vsplat] [output.vsplat]
// Optional QA projection: --preview output/agi1-shirt-after.png
// Optional tuning (defaults are the shipped ones): --surface 0.15 (cloth opacity that counts as its
// front), --slope-ease 0.5, --lift 0.0015 (metres of ink in front of it), --outline-alpha 0.25.
// Since 2026-10-28 its output is an intermediate (output/agi1-splat-print.vsplat):
// tools/model/polish-splat.mjs then writes the shipped public/models/agi1-splat.vsplat.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import sharp from 'sharp';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { hsv } from './vsplat-io.mjs';

const workspace = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const previewAt = args.indexOf('--preview');
const preview = previewAt >= 0 ? args.splice(previewAt, 2)[1] : null;
const elevationAt = args.indexOf('--elevation');
const elevation = elevationAt >= 0 ? Number(args.splice(elevationAt, 2)[1]) : 0;
const yawAt = args.indexOf('--yaw');
const yaw = yawAt >= 0 ? Number(args.splice(yawAt, 2)[1]) : 0;
const surfaceAt = args.indexOf('--surface');
const SURFACE_OPACITY = surfaceAt >= 0 ? Number(args.splice(surfaceAt, 2)[1]) : 0.15;
const easeAt = args.indexOf('--slope-ease');
const SLOPE_EASE = easeAt >= 0 ? Number(args.splice(easeAt, 2)[1]) : 0.5;
const liftAt = args.indexOf('--lift');
const LIFT_OPTION = liftAt >= 0 ? Number(args.splice(liftAt, 2)[1]) : null;
const outlineAt = args.indexOf('--outline-alpha');
const OUTLINE_OPTION = outlineAt >= 0 ? Number(args.splice(outlineAt, 2)[1]) : null;
const source = path.resolve(args[0] || path.join(workspace, 'new agi 3d model/Blonde Anime Girl_high.vsplat'));
const destination = path.resolve(args[1] || path.join(workspace, 'output/agi1-splat-print.vsplat'));
fs.mkdirSync(path.dirname(destination), { recursive: true });
if (source === destination) throw new Error('Source and output must differ; preserve the supplied original.');

const bytes = fs.readFileSync(source);
if (bytes.toString('utf8', 0, 8) !== 'VIGGCHAR' || bytes.readUInt32LE(8) !== 1) throw new Error('Expected VIGGCHAR v1.');
const headerLength = bytes.readUInt32LE(16);
const header = JSON.parse(bytes.toString('utf8', 20, 20 + headerLength));
const payload = 20 + headerLength, oldCount = header.numSplats;
const sizeOf = { u8: 1, u16: 2, f32: 4 };
const raw = (name, i, c) => {
  const b = header.blocks[name], at = payload + b.offset + (c * b.count + i) * sizeOf[b.dtype];
  return b.dtype === 'u16' ? bytes.readUInt16LE(at) : b.dtype === 'f32' ? bytes.readFloatLE(at) : bytes[at];
};
const value = (name, i, c) => {
  const b = header.blocks[name], n = raw(name, i, c);
  return b.min ? b.min[c] + n * (b.max[c] - b.min[c]) / (b.dtype === 'u16' ? 65535 : 255) : n;
};
const points = Array.from({ length: oldCount }, (_, i) => ({
  i, p: [0, 1, 2].map(c => value('position', i, c)),
  rgb: [0, 1, 2].map(c => value('color', i, c)),
  scale: [0, 1, 2].map(c => Math.exp(value('scale', i, c))),
  alpha: 1 / (1 + Math.exp(-value('opacity', i, 0))),
}));
// Coordinates are the original character's metres: front +X, up +Y,
// viewer-right -Z. This rectangle covers the old lettering and its glow.
const erase = { minY: 1.385, maxY: 1.457, minZ: -0.081, maxZ: 0.081, minX: 0.09 };
const print = { minY: 1.399, maxY: 1.449, minZ: -0.072, maxZ: 0.068 };
const cleanCloth = points.filter(v => v.p[0] > 0.08 && v.p[1] > 1.36 && v.p[1] < 1.48 && Math.abs(v.p[2]) < 0.12
  && v.rgb[2] - v.rgb[1] > 63 && v.rgb[2] - v.rgb[0] > 29 && v.alpha > 0.35);
const surface = points.filter(v => v.p[0] > 0.09 && v.p[1] > 1.38 && v.p[1] < 1.47 && Math.abs(v.p[2]) < 0.095
  && Math.max(...v.scale) < 0.014 && v.alpha > 0.55);
const frontCover = points.filter(v => v.p[0] > 0.09 && v.p[1] > 1.34 && v.p[1] < 1.5 && Math.abs(v.p[2]) < 0.13).map(v => {
  const xyz = [0, 1, 2].map(c => raw('rotation', v.i, c) / 255 * 2 - 1);
  const q = new Quaternion(...xyz, Math.sqrt(Math.max(0, 1 - xyz.reduce((a, n) => a + n * n, 0))));
  const e = new Matrix4().makeRotationFromQuaternion(q).elements;
  let yy = 0, yz = 0, zz = 0;
  for (let j = 0; j < 3; j++) {
    yy += e[j * 4 + 1] ** 2 * v.scale[j] ** 2;
    zz += e[j * 4 + 2] ** 2 * v.scale[j] ** 2;
    yz += e[j * 4 + 1] * e[j * 4 + 2] * v.scale[j] ** 2;
  }
  return { v, yy, yz, zz, determinant: yy * zz - yz * yz };
});
if (cleanCloth.length < 60 || surface.length < 80) throw new Error('Shirt calibration does not match this source.');
const dist2 = (a, y, z) => (a.p[1] - y) ** 2 + (a.p[2] - z) ** 2;
const nearest = (pool, y, z, n) => pool.map(v => ({ v, d: dist2(v, y, z) })).sort((a, b) => a.d - b.d).slice(0, n);
let recolored = 0;
for (const v of points) {
  const [x, y, z] = v.p;
  if (x < erase.minX || y < erase.minY || y > erase.maxY || z < erase.minZ || z > erase.maxZ) continue;
  const tint = Math.max(0, Math.min(1, (77 - (v.rgb[2] - v.rgb[1])) / 26));
  if (tint <= 0) continue;
  const neighbors = nearest(cleanCloth, y, z, 10);
  const color = [0, 0, 0]; let weight = 0;
  for (const { v: n, d } of neighbors) {
    const w = 1 / (0.00008 + d + (n.p[0] - x) ** 2 * 0.1);
    weight += w; n.rgb.forEach((c, i) => color[i] += c * w);
  }
  v.rgb = v.rgb.map((c, i) => Math.round(c * (1 - tint) + color[i] / weight * tint));
  recolored++;
}

// A real typeface gives a deliberate A counter and G crossbar. Only a glyph
// coverage mask is rasterized; no garment image is pasted onto the character.
const fontBytes = fs.readFileSync(path.join(workspace, 'public/fonts/meme/notosans-v1.woff'));
const font = opentype.parse(fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength));
const glyph = font.getPath('AGI', 0, 0, 100), bounds = glyph.getBoundingBox();
if (glyph.toPathData(4).includes('NaN')) throw new Error('Invalid outline in the print font.');
const maskWidth = 700, maskHeight = 250;
const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${maskWidth}" height="${maskHeight}" viewBox="${bounds.x1} ${bounds.y1} ${bounds.x2 - bounds.x1} ${bounds.y2 - bounds.y1}"><path fill="white" d="${glyph.toPathData(4)}"/></svg>`;
const mask = await sharp(Buffer.from(maskSvg)).ensureAlpha().raw().toBuffer();
const coverage = (u, v) => mask[(Math.min(maskHeight - 1, Math.floor(v * maskHeight)) * maskWidth + Math.min(maskWidth - 1, Math.floor(u * maskWidth))) * 4 + 3] / 255;

// Local least-squares surface fit avoids a flat sticker on the curved chest.
// Its normal also orients each fine Gaussian tangent to the cloth.
function clothAt(y, z) {
  const neighbors = nearest(surface, y, z, 22);
  const m = Array.from({ length: 3 }, () => [0, 0, 0, 0]);
  for (const { v, d } of neighbors) {
    const basis = [1, v.p[1] - y, v.p[2] - z], w = v.alpha / (0.000025 + d);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) m[r][c] += w * basis[r] * basis[c];
      m[r][3] += w * basis[r] * v.p[0];
    }
  }
  for (let c = 0; c < 3; c++) {
    let pivot = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(m[r][c]) > Math.abs(m[pivot][c])) pivot = r;
    [m[c], m[pivot]] = [m[pivot], m[c]];
    const divisor = m[c][c];
    if (Math.abs(divisor) < 1e-12) throw new Error('Degenerate shirt surface.');
    for (let j = c; j < 4; j++) m[c][j] /= divisor;
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const factor = m[r][c];
      for (let j = c; j < 4; j++) m[r][j] -= factor * m[c][j];
    }
  }
  const [x, dy, dz] = m.map(row => row[3]);
  const normal = new Vector3(1, -dy, -dz).normalize();
  const tangent = new Vector3(dy, 1, 0).normalize();
  const across = new Vector3().crossVectors(normal, tangent).normalize();
  const rotation = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(normal, tangent, across));
  if (rotation.w < 0) rotation.set(-rotation.x, -rotation.y, -rotation.z, -rotation.w);
  const donor = neighbors.reduce((a, n) => n.d + (n.v.p[0] - x) ** 2 < a.d + (a.v.p[0] - x) ** 2 ? n : a).v;
  // Splats sort at their centres, including broad cloth Gaussians whose
  // footprint reaches into this point. Place ink at the rendered surface: the
  // depth where the cloth seen from the front becomes SURFACE_OPACITY opaque.
  // (Taking the frontmost Gaussian that covers the point at all, as the first
  // version did, lifted the top of the word to her bust's front depth, so from
  // the side it stood off her upper chest.)
  const covering = [];
  for (const { v, yy, yz, zz, determinant } of frontCover) {
    if (determinant <= 0) continue;
    const dy = y - v.p[1], dz = z - v.p[2];
    const r2 = (zz * dy * dy - 2 * yz * dy * dz + yy * dz * dz) / determinant;
    const opacity = v.alpha * Math.exp(-r2 / 2);
    if (opacity > 0.01) covering.push([v.p[0], opacity]);
  }
  covering.sort((a, b) => b[0] - a[0]);
  let front = x, clear = 1;
  for (const [depth, opacity] of covering) {
    clear *= 1 - opacity;
    if (1 - clear >= SURFACE_OPACITY) { front = Math.max(x, depth); break; }
  }
  return { x: front, normal, rotation, donor };
}
// A continuous surface is essential: switching between individual Gaussian
// depths makes cracks appear from an elevated camera. The first version fitted
// one quadratic and pushed it in front of every sample, which left the letters
// up to 2-3 cm in front of the cloth where her chest curves away: from 45-65°
// the word floated beside her like a sticker (2026-10-28). Instead, sample the
// cloth's rendered front on a fine grid, smooth it, and keep the ink in front of
// the local bumps only, so the print wraps around the curve like real ink.
const GRID_PAD = 0.008, GRID_STEP = 0.0015;
const gridY0 = print.minY - GRID_PAD, gridZ0 = print.minZ - GRID_PAD;
const gridRows = Math.ceil((print.maxY - print.minY + 2 * GRID_PAD) / GRID_STEP) + 1;
const gridCols = Math.ceil((print.maxZ - print.minZ + 2 * GRID_PAD) / GRID_STEP) + 1;
const frontGrid = new Float64Array(gridRows * gridCols);
for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
  frontGrid[r * gridCols + c] = clothAt(gridY0 + r * GRID_STEP, gridZ0 + c * GRID_STEP).x;
}
// Separable Gaussian blur (clamped edges) of a grid, sigma in grid cells.
function blur(grid, sigma) {
  const radius = Math.ceil(sigma * 3), kernel = [];
  for (let k = -radius; k <= radius; k++) kernel.push(Math.exp(-k * k / (2 * sigma * sigma)));
  const sum = kernel.reduce((a, b) => a + b, 0);
  const pass = (src, alongRows) => {
    const out = new Float64Array(src.length);
    for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const rr = alongRows ? Math.min(gridRows - 1, Math.max(0, r + k)) : r;
        const cc = alongRows ? c : Math.min(gridCols - 1, Math.max(0, c + k));
        acc += src[rr * gridCols + cc] * kernel[k + radius];
      }
      out[r * gridCols + c] = acc / sum;
    }
    return out;
  };
  return pass(pass(grid, true), false);
}
const smoothFront = blur(frontGrid, 0.005 / GRID_STEP);
// Local clearance: the ink must stay in front of nearby bumps the blur
// flattened, but only by what is actually there (a robust local maximum).
const bumps = new Float64Array(frontGrid.length), window = Math.round(0.008 / GRID_STEP);
for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
  const local = [];
  for (let dr = -window; dr <= window; dr++) for (let dc = -window; dc <= window; dc++) {
    const rr = r + dr, cc = c + dc;
    if (rr < 0 || cc < 0 || rr >= gridRows || cc >= gridCols) continue;
    local.push(frontGrid[rr * gridCols + cc] - smoothFront[rr * gridCols + cc]);
  }
  local.sort((a, b) => a - b);
  bumps[r * gridCols + c] = Math.max(0, local[Math.floor(0.9 * (local.length - 1))]);
}
const clearance = blur(bumps, 0.004 / GRID_STEP);
const INK_LIFT = LIFT_OPTION ?? 0.0015;
// Where the shirt slopes away (the top of the word, on her upper chest) the
// front camera sees the cloth at a glancing angle and needs little clearance,
// while any clearance shows as a white sliver above her outline from the side.
const slopeAt = (k) => {
  const r = Math.floor(k / gridCols), c = k % gridCols;
  const at = (rr, cc) => smoothFront[Math.min(gridRows - 1, Math.max(0, rr)) * gridCols + Math.min(gridCols - 1, Math.max(0, cc))];
  return Math.hypot((at(r + 1, c) - at(r - 1, c)) / (2 * GRID_STEP), (at(r, c + 1) - at(r, c - 1)) / (2 * GRID_STEP));
};
const inkDepth = Float64Array.from(smoothFront, (x, k) => x + clearance[k] / (1 + (slopeAt(k) / SLOPE_EASE) ** 2) + INK_LIFT);
// Keep the print inside the shirt's outline seen from the side (2026-10-28).
// The shirt is made of soft, centimetre-wide Gaussians, so its surface is a haze
// a few millimetres deep, and ink placed where it reads white from the front
// stood edge-on past that haze from about 75-90°: a white fin along her upper
// chest's outline (worse in the nod before the skin weights below). For each
// level side view the shirt alone is splatted (orthographic, rest pose); where a
// view would see ink with less than OUTLINE_ALPHA of shirt behind it, the ink
// moves back along -X, at most OUTLINE_MOST: further back the shirt's haze
// starts to tint the tops of the letters from the front. From the front the
// letters keep their place.
const shirtColoured = (rgb) => { const [h, s] = hsv(...rgb); return h >= 230 && h <= 300 && s > 0.1; };
const OUTLINE_YAWS = [45, 60, 75, 90].flatMap(yaw => [yaw, -yaw]);
const OUTLINE_ALPHA = OUTLINE_OPTION ?? 0.25, OUTLINE_MOST = 0.003, OUTLINE_PIXEL = 0.0004, OUTLINE_STEP = 0.00025;
const outlinePivot = new Vector3(0.05, 1.42, 0);
const shirtSplats = points.filter(v => v.alpha > 0.02 && v.p[0] > 0 && v.p[1] > 1.3 && v.p[1] < 1.56 && Math.abs(v.p[2]) < 0.2 && shirtColoured(v.rgb)).map(v => {
  const xyz = [0, 1, 2].map(c => raw('rotation', v.i, c) / 255 * 2 - 1);
  return { v, q: new Quaternion(...xyz, Math.sqrt(Math.max(0, 1 - xyz.reduce((a, n) => a + n * n, 0)))) };
});
const outlineViews = OUTLINE_YAWS.map((yaw) => {
  const turn = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw * Math.PI / 180);
  const project = (x, y, z) => { const p = new Vector3(x, y, z).sub(outlinePivot).applyQuaternion(turn).add(outlinePivot); return [-p.z, p.y]; };
  // the window: every grid point, at any depth the search may try, plus 2 cm
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (let k = 0; k < inkDepth.length; k++) for (const back of [0, OUTLINE_MOST]) {
    const [u, v] = project(inkDepth[k] - back, gridY0 + Math.floor(k / gridCols) * GRID_STEP, gridZ0 + (k % gridCols) * GRID_STEP);
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
  }
  u0 -= 0.02; v0 -= 0.02; u1 += 0.02; v1 += 0.02;
  const W = Math.ceil((u1 - u0) / OUTLINE_PIXEL) + 1, H = Math.ceil((v1 - v0) / OUTLINE_PIXEL) + 1;
  const logClear = new Float64Array(W * H), e = new Matrix4();
  for (const { v, q } of shirtSplats) {
    const [cu, cv] = project(...v.p);
    e.makeRotationFromQuaternion(q.clone().premultiply(turn));
    const m = e.elements; let a = 0, b = 0, d = 0;
    for (let j = 0; j < 3; j++) { a += m[j * 4 + 2] ** 2 * v.scale[j] ** 2; d += m[j * 4 + 1] ** 2 * v.scale[j] ** 2; b += m[j * 4 + 2] * m[j * 4 + 1] * v.scale[j] ** 2; }
    const det = a * d - b * b; if (det <= 0) continue;
    const ru = 3 * Math.sqrt(a), rv = 3 * Math.sqrt(d);
    if (cu + ru < u0 || cu - ru > u1 || cv + rv < v0 || cv - rv > v1) continue;
    for (let py = Math.max(0, Math.floor((v1 - cv - rv) / OUTLINE_PIXEL)); py <= Math.min(H - 1, Math.ceil((v1 - cv + rv) / OUTLINE_PIXEL)); py++) {
      for (let px = Math.max(0, Math.floor((cu - ru - u0) / OUTLINE_PIXEL)); px <= Math.min(W - 1, Math.ceil((cu + ru - u0) / OUTLINE_PIXEL)); px++) {
        // image u is -z after the turn, so the 2D covariance's off-diagonal flips sign
        const du = u0 + px * OUTLINE_PIXEL - cu, dv = v1 - py * OUTLINE_PIXEL - cv;
        const r2 = (d * du * du + 2 * b * du * dv + a * dv * dv) / det;
        if (r2 > 9) continue;
        logClear[py * W + px] += Math.log(1 - Math.min(0.999, v.alpha * Math.exp(-r2 / 2)));
      }
    }
  }
  const alphaAt = (x, y, z) => {
    const [u, v] = project(x, y, z), fx = (u - u0) / OUTLINE_PIXEL, fy = (v1 - v) / OUTLINE_PIXEL;
    const px = Math.floor(fx), py = Math.floor(fy);
    if (px < 0 || py < 0 || px >= W - 1 || py >= H - 1) return 0;
    const tx = fx - px, ty = fy - py, at = (xx, yy) => logClear[yy * W + xx];
    return 1 - Math.exp((at(px, py) * (1 - tx) + at(px + 1, py) * tx) * (1 - ty) + (at(px, py + 1) * (1 - tx) + at(px + 1, py + 1) * tx) * ty);
  };
  return { yaw, alphaAt };
});
const pushBack = new Float64Array(inkDepth.length);
for (let k = 0; k < inkDepth.length; k++) {
  const y = gridY0 + Math.floor(k / gridCols) * GRID_STEP, z = gridZ0 + (k % gridCols) * GRID_STEP;
  let back = 0;
  while (back < OUTLINE_MOST && !outlineViews.every(view => view.alphaAt(inkDepth[k] - back, y, z) >= OUTLINE_ALPHA)) back += OUTLINE_STEP;
  pushBack[k] = back;
}
// Smooth it without losing the amount needed (a robust local maximum, then a blur).
const pushLocal = new Float64Array(pushBack.length), reach = Math.round(0.003 / GRID_STEP);
for (let r = 0; r < gridRows; r++) for (let c = 0; c < gridCols; c++) {
  let most = 0;
  for (let dr = -reach; dr <= reach; dr++) for (let dc = -reach; dc <= reach; dc++) {
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && cc >= 0 && rr < gridRows && cc < gridCols) most = Math.max(most, pushBack[rr * gridCols + cc]);
  }
  pushLocal[r * gridCols + c] = most;
}
const pushSmooth = blur(pushLocal, 0.0015 / GRID_STEP);
for (let k = 0; k < inkDepth.length; k++) inkDepth[k] -= pushSmooth[k];
const outlineStats = { views: OUTLINE_YAWS.length, cellsMoved: pushBack.filter(b => b > 0).length, cells: pushBack.length,
  mostMovedBack: +Math.max(...pushSmooth).toFixed(4) };
const gridAt = (grid, y, z) => {
  const fr = Math.min(gridRows - 1.001, Math.max(0, (y - gridY0) / GRID_STEP));
  const fc = Math.min(gridCols - 1.001, Math.max(0, (z - gridZ0) / GRID_STEP));
  const r = Math.floor(fr), c = Math.floor(fc), tr = fr - r, tc = fc - c;
  const at = (rr, cc) => grid[rr * gridCols + cc];
  return (at(r, c) * (1 - tc) + at(r, c + 1) * tc) * (1 - tr) + (at(r + 1, c) * (1 - tc) + at(r + 1, c + 1) * tc) * tr;
};
// For the log: how far the old single-surface placement stood off the cloth.
const surfaceStats = (() => {
  let most = 0, total = 0, count = 0;
  for (let k = 0; k < inkDepth.length; k++) { const gap = inkDepth[k] - frontGrid[k]; most = Math.max(most, gap); total += gap; count++; }
  return { meanGapToClothFront: +(total / count).toFixed(4), largestGap: +most.toFixed(4) };
})();
// The print moves exactly like the shirt under it (2026-10-28): every ink splat
// takes the smoothly blended skin weights of the visible cloth around it, all of
// their bones (the spine, and the collarbones and upper arms near the top). The
// first version gave the ink smooth spine-only weights (spine_04/05), so it did
// not follow the shirt's collarbone and arm influence: during the nod the top of
// the word stood up to 6 mm off the shirt (from the side, a white fin above her
// outline) and in the wave parts of it sank up to 6 mm into the cloth. A smooth
// kernel (not a nearest donor) keeps neighbouring letters from splitting.
const WEIGHT_SIGMA = 0.006, WEIGHT_DEPTH = 0.006;
const clothDonors = points.filter(v => v.p[0] > 0.06 && v.p[1] > print.minY - 0.03 && v.p[1] < print.maxY + 0.03
  && Math.abs(v.p[2]) < 0.13 && v.alpha > 0.3 && shirtColoured(v.rgb)).map(v => {
  const slots = [0, 1, 2, 3].map(k => raw('boneIndex', v.i, k));
  const w = [0, 1, 2].map(k => raw('boneWeight', v.i, k));
  w.push(Math.max(0, 255 - w[0] - w[1] - w[2]));
  return { v, slots, w };
});
if (clothDonors.length < 300) throw new Error('Shirt skin weights do not match this source.');
function clothWeights(x, y, z) {
  const blend = new Map();
  for (const { v, slots, w } of clothDonors) {
    const across = (v.p[1] - y) ** 2 + (v.p[2] - z) ** 2;
    if (across > (3 * WEIGHT_SIGMA) ** 2) continue;
    const k = v.alpha * Math.exp(-across / (2 * WEIGHT_SIGMA ** 2) - (x - v.p[0]) ** 2 / (2 * WEIGHT_DEPTH ** 2));
    for (let j = 0; j < 4; j++) if (w[j] > 0) blend.set(slots[j], (blend.get(slots[j]) || 0) + k * w[j]);
  }
  // The engine skins each splat with at most four bones: keep the strongest four.
  const top = [...blend.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (!top.length) throw new Error(`No shirt under the print at ${y.toFixed(3)}, ${z.toFixed(3)}.`);
  const total = top.reduce((sum, [, w]) => sum + w, 0);
  // Whole 255ths that add up to exactly 255 (largest remainders get the spare
  // units): three are stored and the engine gives the fourth bone what is left,
  // so a rounding overshoot would otherwise become a negative fourth weight.
  const exact = top.map(([, w]) => w / total * 255), units = exact.map(Math.floor);
  let spare = 255 - units.reduce((sum, u) => sum + u, 0);
  for (const j of exact.map((e, j) => j).sort((a, b) => (exact[b] - units[b]) - (exact[a] - units[a]))) {
    if (spare <= 0) break;
    units[j]++; spare--;
  }
  const boneIndex = top.map(([slot]) => slot), boneWeight = [0, 1, 2].map(j => units[j] || 0);
  while (boneIndex.length < 4) boneIndex.push(boneIndex[0]); // unused slots repeat the first bone at weight 0
  return { boneIndex, boneWeight };
}
function printAt(y, z) {
  const h = GRID_STEP;
  const slopeY = (gridAt(smoothFront, y + h, z) - gridAt(smoothFront, y - h, z)) / (2 * h);
  const slopeZ = (gridAt(smoothFront, y, z + h) - gridAt(smoothFront, y, z - h)) / (2 * h);
  const normal = new Vector3(1, -slopeY, -slopeZ).normalize();
  const tangent = new Vector3(slopeY, 1, 0).normalize();
  const across = new Vector3().crossVectors(normal, tangent).normalize();
  const rotation = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(normal, tangent, across));
  if (rotation.w < 0) rotation.set(-rotation.x, -rotation.y, -rotation.z, -rotation.w);
  const x = gridAt(inkDepth, y, z);
  return { x, rotation, ...clothWeights(x, y, z) };
}
const additions = [], step = 0.0007;
const cols = Math.ceil((print.maxZ - print.minZ) / step), rows = Math.ceil((print.maxY - print.minY) / step);
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
  const u = (c + 0.5) / cols, v = (r + 0.5) / rows, alpha = coverage(u, v);
  if (alpha < 0.15) continue;
  const y = print.maxY - v * (print.maxY - print.minY), z = print.maxZ - u * (print.maxZ - print.minZ);
  const fitted = printAt(y, z);
  additions.push({ p: [fitted.x, y, z], scale: [0.0003, 0.00065, 0.00065], q: fitted.rotation,
    rgb: [249, 247, 253], alpha: alpha * 0.96, boneIndex: fitted.boneIndex, boneWeight: fitted.boneWeight });
}

const count = oldCount + additions.length, blocks = {}, payloadParts = [];
let offset = 0;
for (const [name, original] of Object.entries(header.blocks)) {
  const b = { ...original, offset }, scalarSize = sizeOf[b.dtype];
  if (name === 'joints') {
    payloadParts.push(bytes.subarray(payload + original.offset, payload + original.offset + original.length));
  } else {
    b.count = count; b.length = count * b.components * scalarSize;
    const out = Buffer.alloc(b.length);
    for (let c = 0; c < b.components; c++) {
      bytes.copy(out, c * count * scalarSize, payload + original.offset + c * oldCount * scalarSize, payload + original.offset + (c + 1) * oldCount * scalarSize);
      if (name === 'color') for (const v of points) out[c * count + v.i] = v.rgb[c];
      for (let j = 0; j < additions.length; j++) {
        const v = additions[j], at = (c * count + oldCount + j) * scalarSize;
        let n;
        if (name === 'position') n = v.p[c];
        else if (name === 'scale') n = Math.log(v.scale[c]);
        else if (name === 'rotation') n = ([v.q.x, v.q.y, v.q.z][c] + 1) * 127.5;
        else if (name === 'color') n = v.rgb[c];
        else if (name === 'opacity') n = Math.log(v.alpha / (1 - v.alpha));
        else if (name === 'boneIndex' || name === 'boneWeight') n = v[name][c];
        else throw new Error(`Unsupported block: ${name}`);
        if (b.min) n = (n - b.min[c]) / (b.max[c] - b.min[c]) * (b.dtype === 'u16' ? 65535 : 255);
        const quantized = Math.max(0, Math.min(b.dtype === 'u16' ? 65535 : 255, Math.round(n)));
        if (scalarSize === 2) out.writeUInt16LE(quantized, at); else out[at] = quantized;
      }
    }
    payloadParts.push(out);
  }
  blocks[name] = b; offset += b.length;
  const padding = (4 - offset % 4) % 4;
  if (padding) { payloadParts.push(Buffer.alloc(padding)); offset += padding; }
}
const json = JSON.stringify({ ...header, numSplats: count, blocks });
const encodedHeader = Buffer.from(json + ' '.repeat((4 - Buffer.byteLength(json) % 4) % 4));
const output = Buffer.alloc(20);
output.write('VIGGCHAR'); output.writeUInt32LE(1, 8);
output.writeUInt32LE(20 + encodedHeader.length + offset, 12);
output.writeUInt32LE(encodedHeader.length, 16);
const result = Buffer.concat([output, encodedHeader, ...payloadParts]);
fs.writeFileSync(destination, result);
console.log(JSON.stringify({ source, destination, originalSplats: oldCount, recoloredSplats: recolored, inkSplats: additions.length,
  erase, print, surface: surfaceStats, outline: outlineStats, bytes: result.length, originalBytes: bytes.length }, null, 2));

if (preview) {
  // Orthographic +X inspection, using Gaussian covariance/opacity and front
  // compositing. This is QA only; the website renders the real skinned asset.
  const W = 900, H = 900, y0 = 1, y1 = 1.65, z0 = -0.325, k = W / 0.65;
  const pixels = new Float32Array(W * H * 3).fill(45), matrix = new Matrix4();
  const resultBase = 20 + result.readUInt32LE(16);
  const decoded = (name, i, c) => {
    const b = blocks[name], at = resultBase + b.offset + (c * count + i) * sizeOf[b.dtype];
    const n = b.dtype === 'u16' ? result.readUInt16LE(at) : result[at];
    return b.min ? b.min[c] + n * (b.max[c] - b.min[c]) / (b.dtype === 'u16' ? 65535 : 255) : n;
  };
  const angle = elevation * Math.PI / 180, turn = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -angle)
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw * Math.PI / 180));
  const finalPoints = Array.from({ length: count }, (_, i) => {
    const xyz = [0, 1, 2].map(c => decoded('rotation', i, c) / 255 * 2 - 1);
    const q = new Quaternion(...xyz, Math.sqrt(Math.max(0, 1 - xyz.reduce((a, n) => a + n * n, 0))));
    const position = new Vector3(...[0, 1, 2].map(c => decoded('position', i, c))).sub(new Vector3(0.05, 1.325, 0)).applyQuaternion(turn).add(new Vector3(0.05, 1.325, 0));
    return { p: position.toArray(), q: q.premultiply(turn), rgb: [0, 1, 2].map(c => decoded('color', i, c)),
      scale: [0, 1, 2].map(c => Math.exp(decoded('scale', i, c))), alpha: 1 / (1 + Math.exp(-decoded('opacity', i, 0))) };
  });
  for (const v of finalPoints.filter(v => v.p[1] >= y0 && v.p[1] <= y1 && Math.abs(v.p[2]) < 0.33).sort((a, b) => a.p[0] - b.p[0])) {
    matrix.makeRotationFromQuaternion(v.q);
    const e = matrix.elements;
    let a = 0, b = 0, d = 0;
    for (let j = 0; j < 3; j++) {
      a += e[j * 4 + 2] ** 2 * v.scale[j] ** 2;
      d += e[j * 4 + 1] ** 2 * v.scale[j] ** 2;
      b += e[j * 4 + 2] * e[j * 4 + 1] * v.scale[j] ** 2;
    }
    a *= k * k; b *= k * k; d *= k * k;
    const det = a * d - b * b; if (det < 1e-8) continue;
    const x = (-v.p[2] - z0) * k, y = (y1 - v.p[1]) * k;
    const rx = Math.ceil(Math.sqrt(a) * 3), ry = Math.ceil(Math.sqrt(d) * 3);
    for (let py = Math.max(0, Math.floor(y - ry)); py < Math.min(H, y + ry); py++) for (let px = Math.max(0, Math.floor(x - rx)); px < Math.min(W, x + rx); px++) {
      const dx = px - x, dy = py - y, r2 = (d * dx * dx - 2 * b * dx * dy + a * dy * dy) / det;
      if (r2 > 9) continue;
      const alpha = v.alpha * Math.exp(-r2 / 2), at = (py * W + px) * 3;
      for (let c = 0; c < 3; c++) pixels[at + c] = pixels[at + c] * (1 - alpha) + v.rgb[c] * alpha;
    }
  }
  await sharp(Buffer.from(pixels.map(v => Math.round(v))), { raw: { width: W, height: H, channels: 3 } }).png().toFile(preview);
}
