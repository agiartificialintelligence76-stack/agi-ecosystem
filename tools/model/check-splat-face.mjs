// CPU visual QA of the actual shipped splats under the runtime facial poses.
import fs from 'node:fs';
import sharp from 'sharp';
import * as pc from 'playcanvas';
import { Armature, Pose, loadSkeletonLibrary } from '@viggle/splat-engine';
import { createAgi1SplatFace } from '../../src/stage/agi1-splat-face.js';
const library = await loadSkeletonLibrary(), bytes = fs.readFileSync('public/models/agi1-splat.vsplat');
const length = bytes.readUInt32LE(16), h = JSON.parse(bytes.subarray(20, 20 + length)), base = 20 + length;
const read = (name, i, c) => {
  const b = h.blocks[name], size = { u8: 1, u16: 2, f32: 4 }[b.dtype], at = base + b.offset + (c * b.count + i) * size;
  const n = size === 4 ? bytes.readFloatLE(at) : size === 2 ? bytes.readUInt16LE(at) : bytes[at];
  return b.min ? b.min[c] + n * (b.max[c] - b.min[c]) / (size === 2 ? 65535 : 255) : n;
};
const bt = new Float32Array(library.restTranslations441);
for (let i = 0; i < 441; i++) {
  const name = library.boneNames441[i];
  if (name.startsWith('FACIAL_') || name.includes('toe_')) continue;
  for (let c = 0; c < 3; c++) bt[i * 3 + c] = read('joints', i, c);
}
const arm = new Armature('face QA', { numBones: 441, boneNames: library.boneNames441, restIsPerCharacter: true,
  stdMaleRestTranslations: bt, stdMaleRestRotations: library.restRotations441, stdMaleParents: library.parents441 });
const face = createAgi1SplatFace(arm), inverse = arm.skeleton.inverseBindPose;
const points = [];
for (let i = 0; i < h.numSplats; i++) {
  const p = new pc.Vec3(...[0, 1, 2].map(c => read('position', i, c)));
  if (p.y < 1.59 || p.y > 1.82 || Math.abs(p.z) > 0.115) continue;
  const xyz = [0, 1, 2].map(c => read('rotation', i, c) / 255 * 2 - 1);
  const rotation = new pc.Quat(...xyz, Math.sqrt(Math.max(0, 1 - xyz.reduce((sum, n) => sum + n * n, 0))));
  const covarianceAxes = [new pc.Vec3(1, 0, 0), new pc.Vec3(0, 1, 0), new pc.Vec3(0, 0, 1)].map((v, c) => rotation.transformVector(v).mulScalar(Math.exp(read('scale', i, c))));
  const joints = [], weights = []; let sum = 0;
  for (let c = 0; c < 4; c++) {
    joints.push(h.blocks.boneIndex.palette[read('boneIndex', i, c)]);
    const weight = c < 3 ? read('boneWeight', i, c) : Math.max(0, 255 - sum); sum += weight; weights.push(weight / 255);
  }
  points.push({ p, covarianceAxes, joints, weights, rgb: [0, 1, 2].map(c => read('color', i, c)), alpha: 1 / (1 + Math.exp(-read('opacity', i, 0))) });
}
for (const [name, state] of Object.entries({ neutral: { blink: 0, mouth: 0, smile: 0 }, blink: { blink: 1, mouth: 0, smile: 0 }, talk: { blink: 0, mouth: 0.8, smile: 0.12 } })) {
  const pose = new Pose(441); pose.setToBind(arm.skeleton.bindT, arm.skeleton.bindR); face.apply(pose, state);
  const matrices = []; arm.skeleton.applyLocal(pose, pc.Mat4.IDENTITY, matrices);
  // Match the engine's default rigid palette: animated scale is stripped
  // before composing with inverse bind, including the eye's local scale.
  const skins = matrices.map((m, i) => {
    const rigid = m.clone(), d = rigid.data;
    for (let c = 0; c < 3; c++) {
      const start = c * 4, length = Math.hypot(d[start], d[start + 1], d[start + 2]);
      for (let r = 0; r < 3; r++) d[start + r] /= Math.max(length, 1e-8);
    }
    return new pc.Mat4().mul2(rigid, inverse[i]);
  });
  const posed = points.map(point => {
    const matrix = new pc.Mat4(); matrix.data.fill(0);
    point.joints.forEach((j, k) => { for (let c = 0; c < 16; c++) matrix.data[c] += skins[j].data[c] * point.weights[k]; });
    return { ...point, p: matrix.transformPoint(point.p), axes: point.covarianceAxes.map(v => matrix.transformVector(v)) };
  });
  const W = 640, H = 640, k = W / 0.21, top = 1.815, left = -0.105, pixels = new Float32Array(W * H * 3).fill(45);
  for (const v of posed.sort((a, b) => a.p.x - b.p.x)) {
    let xx = 0, xy = 0, yy = 0;
    for (const axis of v.axes) { xx += axis.z ** 2; yy += axis.y ** 2; xy += axis.z * axis.y; }
    xx *= k * k; xy *= k * k; yy *= k * k;
    const det = xx * yy - xy * xy; if (det < 1e-9) continue;
    const x = (-v.p.z - left) * k, y = (top - v.p.y) * k, rx = Math.ceil(Math.sqrt(xx) * 3), ry = Math.ceil(Math.sqrt(yy) * 3);
    for (let py = Math.max(0, Math.floor(y - ry)); py < Math.min(H, y + ry); py++) for (let px = Math.max(0, Math.floor(x - rx)); px < Math.min(W, x + rx); px++) {
      const dx = px - x, dy = py - y, distance = (yy * dx * dx - 2 * xy * dx * dy + xx * dy * dy) / det;
      if (distance > 9) continue;
      const opacity = v.alpha * Math.exp(-distance / 2), at = (py * W + px) * 3;
      for (let c = 0; c < 3; c++) pixels[at + c] = pixels[at + c] * (1 - opacity) + v.rgb[c] * opacity;
    }
  }
  await sharp(Buffer.from(pixels.map(v => Math.round(v))), { raw: { width: W, height: H, channels: 3 } }).png().toFile(`output/agi1-face-${name}.png`);
}
console.log('Wrote neutral, blink and talk visual QA from the final asset.');
