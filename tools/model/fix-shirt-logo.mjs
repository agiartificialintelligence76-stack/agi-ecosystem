// Restore the shirt's AGI print in the supplied VIGGCHAR v1 character.
// The original remains untouched. Existing splats are only recolored inside
// the front-shirt print; fine ink splats follow that surface and inherit its
// skin weights, so the print bends with the shirt instead of floating on it.
// Usage: node tools/model/fix-shirt-logo.mjs [source.vsplat] [output.vsplat]
// Optional QA projection: --preview output/agi1-shirt-after.png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import sharp from 'sharp';
import { Matrix4, Quaternion, Vector3 } from 'three';

const workspace = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const previewAt = args.indexOf('--preview');
const preview = previewAt >= 0 ? args.splice(previewAt, 2)[1] : null;
const elevationAt = args.indexOf('--elevation');
const elevation = elevationAt >= 0 ? Number(args.splice(elevationAt, 2)[1]) : 0;
const yawAt = args.indexOf('--yaw');
const yaw = yawAt >= 0 ? Number(args.splice(yawAt, 2)[1]) : 0;
const source = path.resolve(args[0] || path.join(workspace, 'new agi 3d model/Blonde Anime Girl_high.vsplat'));
const destination = path.resolve(args[1] || path.join(workspace, 'public/models/agi1-splat.vsplat'));
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
  // footprint reaches into this point. Place ink at that rendered surface.
  let front = x;
  for (const { v, yy, yz, zz, determinant } of frontCover) {
    if (determinant <= 0 || v.p[0] <= front) continue;
    const dy = y - v.p[1], dz = z - v.p[2];
    const r2 = (zz * dy * dy - 2 * yz * dy * dz + yy * dz * dz) / determinant;
    if (v.alpha * Math.exp(-r2 / 2) > 0.035) front = v.p[0];
  }
  return { x: front, normal, rotation, donor };
}
// A continuous surface is essential: switching between individual Gaussian
// depths makes cracks appear from an elevated camera. Fit the visible cloth
// envelope once, then evaluate the same smooth curve for the whole word.
const yCenter = (print.minY + print.maxY) / 2, zCenter = (print.minZ + print.maxZ) / 2;
const basisAt = (y, z) => { const dy = y - yCenter, dz = z - zCenter; return [1, dy, dz, dy * dy, dy * dz, dz * dz]; };
const samples = [];
for (let r = 0; r <= 10; r++) for (let c = 0; c <= 24; c++) {
  const y = print.minY + r / 10 * (print.maxY - print.minY), z = print.minZ + c / 24 * (print.maxZ - print.minZ);
  samples.push({ basis: basisAt(y, z), x: clothAt(y, z).x });
}
const equation = Array.from({ length: 6 }, () => Array(7).fill(0));
for (const sample of samples) for (let r = 0; r < 6; r++) {
  for (let c = 0; c < 6; c++) equation[r][c] += sample.basis[r] * sample.basis[c];
  equation[r][6] += sample.basis[r] * sample.x;
}
for (let c = 0; c < 6; c++) {
  let pivot = c;
  for (let r = c + 1; r < 6; r++) if (Math.abs(equation[r][c]) > Math.abs(equation[pivot][c])) pivot = r;
  [equation[c], equation[pivot]] = [equation[pivot], equation[c]];
  const divisor = equation[c][c];
  for (let j = c; j < 7; j++) equation[c][j] /= divisor;
  for (let r = 0; r < 6; r++) {
    if (r === c) continue;
    const factor = equation[r][c];
    for (let j = c; j < 7; j++) equation[r][j] -= factor * equation[c][j];
  }
}
const coefficients = equation.map(row => row[6]);
const evaluate = basis => basis.reduce((sum, term, i) => sum + term * coefficients[i], 0);
const surfaceMargin = Math.max(...samples.map(s => s.x - evaluate(s.basis))) + 0.004;
const spine4 = header.blocks.boneIndex.palette.indexOf(5), spine5 = header.blocks.boneIndex.palette.indexOf(6);
if (spine4 < 0 || spine5 < 0) throw new Error('Expected MetaHuman torso bones.');
const torsoDonors = surface.map(v => {
  let w4 = 0, w5 = 0, sum = 0;
  for (let i = 0; i < 4; i++) {
    const index = raw('boneIndex', v.i, i), weight = i < 3 ? raw('boneWeight', v.i, i) : Math.max(0, 255 - sum);
    sum += weight;
    if (index === spine4) w4 += weight; if (index === spine5) w5 += weight;
  }
  return { v, upper: w4 + w5 > 0 ? w5 / (w4 + w5) : 0.3 };
});
function printAt(y, z) {
  const basis = basisAt(y, z), dy = basis[1], dz = basis[2];
  const slopeY = coefficients[1] + 2 * coefficients[3] * dy + coefficients[4] * dz;
  const slopeZ = coefficients[2] + coefficients[4] * dy + 2 * coefficients[5] * dz;
  const normal = new Vector3(1, -slopeY, -slopeZ).normalize();
  const tangent = new Vector3(slopeY, 1, 0).normalize();
  const across = new Vector3().crossVectors(normal, tangent).normalize();
  const rotation = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(normal, tangent, across));
  if (rotation.w < 0) rotation.set(-rotation.x, -rotation.y, -rotation.z, -rotation.w);
  let upper = 0, total = 0;
  for (const donor of torsoDonors) {
    const w = Math.exp(-dist2(donor.v, y, z) / (2 * 0.015 ** 2)) * donor.v.alpha;
    upper += donor.upper * w; total += w;
  }
  // Smooth torso-only weights prevent a nearest donor's arm influence from
  // splitting adjacent letters when AGI-1 lowers or waves her arms.
  const w5 = Math.round(upper / total * 255);
  return { x: evaluate(basis) + surfaceMargin, rotation, boneIndex: [spine4, spine5, 0, 0], boneWeight: [255 - w5, w5, 0] };
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
  erase, print, surfaceMargin, bytes: result.length, originalBytes: bytes.length }, null, 2));

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
