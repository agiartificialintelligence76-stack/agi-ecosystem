// Offline transparent loading portrait from the exact shipped splat bytes.
// Reads the model only; no generation service and no change to the 3D asset.
// Usage: node tools/model/render-splat-portrait.mjs [input.vsplat] [output.webp]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { Matrix4, Quaternion } from 'three';

const workspace = fileURLToPath(new URL('../../', import.meta.url));
const source = path.resolve(process.argv[2] || path.join(workspace, 'public/models/agi1-splat.vsplat'));
const destination = path.resolve(process.argv[3] || path.join(workspace, 'public/images/agi1-live-splat.webp'));
if (source === destination) throw new Error('The portrait must not replace its source model.');
const bytes = fs.readFileSync(source);
if (bytes.toString('utf8', 0, 8) !== 'VIGGCHAR' || bytes.readUInt32LE(8) !== 1) throw new Error('Expected VIGGCHAR v1.');
const headerLength = bytes.readUInt32LE(16);
const header = JSON.parse(bytes.toString('utf8', 20, 20 + headerLength));
const base = 20 + headerLength, count = header.numSplats;
const read = (name, i, c) => {
  const block = header.blocks[name], size = block.dtype === 'u16' ? 2 : 1;
  const at = base + block.offset + (c * count + i) * size;
  const n = size === 2 ? bytes.readUInt16LE(at) : bytes[at];
  return block.min ? block.min[c] + n * (block.max[c] - block.min[c]) / (size === 2 ? 65535 : 255) : n;
};
// Head, shoulders, and complete shirt. The crop ends at the waist.
const width = 640, height = 800, top = 1.9, bottom = 1.17;
const scale = height / (top - bottom), left = -width / scale / 2;
const rgb = new Float32Array(width * height * 3), alpha = new Float32Array(width * height);
const points = [];
for (let i = 0; i < count; i++) {
  const p = [0, 1, 2].map(c => read('position', i, c));
  if (p[1] < bottom - 0.07 || p[1] > top + 0.03 || Math.abs(p[2]) > 0.4) continue;
  const xyz = [0, 1, 2].map(c => read('rotation', i, c) / 255 * 2 - 1);
  points.push({ p, q: new Quaternion(...xyz, Math.sqrt(Math.max(0, 1 - xyz.reduce((sum, v) => sum + v * v, 0)))),
    s: [0, 1, 2].map(c => Math.exp(read('scale', i, c))), color: [0, 1, 2].map(c => read('color', i, c)),
    alpha: 1 / (1 + Math.exp(-read('opacity', i, 0))) });
}
const matrix = new Matrix4();
// The supplied character faces +X, so nearer splats composite last.
for (const point of points.sort((a, b) => a.p[0] - b.p[0])) {
  matrix.makeRotationFromQuaternion(point.q);
  const m = matrix.elements;
  let xx = 0, xy = 0, yy = 0;
  for (let axis = 0; axis < 3; axis++) {
    xx += m[axis * 4 + 2] ** 2 * point.s[axis] ** 2;
    yy += m[axis * 4 + 1] ** 2 * point.s[axis] ** 2;
    xy += m[axis * 4 + 2] * m[axis * 4 + 1] * point.s[axis] ** 2;
  }
  xx *= scale * scale; xy *= scale * scale; yy *= scale * scale;
  const determinant = xx * yy - xy * xy;
  if (determinant < 1e-9) continue;
  const centerX = (-point.p[2] - left) * scale, centerY = (top - point.p[1]) * scale;
  const radiusX = Math.ceil(Math.sqrt(xx) * 3), radiusY = Math.ceil(Math.sqrt(yy) * 3);
  for (let y = Math.max(0, Math.floor(centerY - radiusY)); y < Math.min(height, centerY + radiusY); y++) {
    for (let x = Math.max(0, Math.floor(centerX - radiusX)); x < Math.min(width, centerX + radiusX); x++) {
      const dx = x - centerX, dy = y - centerY;
      const distance = (yy * dx * dx - 2 * xy * dx * dy + xx * dy * dy) / determinant;
      if (distance > 9) continue;
      const coverage = point.alpha * Math.exp(-distance / 2), pixel = y * width + x;
      for (let c = 0; c < 3; c++) rgb[pixel * 3 + c] = rgb[pixel * 3 + c] * (1 - coverage) + point.color[c] * coverage;
      alpha[pixel] = alpha[pixel] * (1 - coverage) + coverage;
    }
  }
}
const rgba = Buffer.alloc(width * height * 4);
for (let i = 0; i < alpha.length; i++) {
  const a = alpha[i];
  for (let c = 0; c < 3; c++) rgba[i * 4 + c] = a > 0.001 ? Math.round(rgb[i * 3 + c] / a) : 0;
  rgba[i * 4 + 3] = Math.round(a * 255);
}
await sharp(rgba, { raw: { width, height, channels: 4 } }).webp({ quality: 92, alphaQuality: 100, effort: 6 }).toFile(destination);
console.log(JSON.stringify({ source, destination, width, height, bytes: fs.statSync(destination).size, alpha: true }));
