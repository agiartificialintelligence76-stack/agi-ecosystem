// Clean-up pass for AGI-1's splat model, run after the shirt print
// (tools/model/fix-shirt-logo.mjs). The owner (2026-10-28): "her hair ... looks
// awful", "the design of her looks scuffed". What it fixes:
//  1. A dark streak that flashed over her hair from some angles. The renderer
//     draws whichever splat is stored first in the wrong order for some camera
//     directions (splat-engine 0.3.2 / PlayCanvas 2.23.3). Moving that splat to
//     the end and leaving an invisible placeholder in slot 0 removes it without
//     losing anything.
//  2. Splats with no visible opacity (under 1/255) are dropped: nothing on screen
//     changes, and the browser sorts and skins fewer points.
//  3. Muddy patches in her hair: large, round, dark splats (not the thin dark
//     lines between locks, which give the hair its shape) are lifted toward the
//     colour of the hair around them.
//  4. Hair that hangs far from her arms (down her back) no longer follows her
//     arms: when she waves it stays with her upper body instead of being dragged
//     sideways. Hair resting on or beside her arms keeps following them, so it
//     does not stick out when her arms are lowered.
// Usage (from the project folder, after fix-shirt-logo.mjs):
//   node tools/model/polish-splat.mjs [output/agi1-splat-print.vsplat] [public/models/agi1-splat.vsplat]
// The source is fix-shirt-logo.mjs's output; it is never modified.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pc from 'playcanvas';
import { Armature, Pose, loadSkeletonLibrary } from '@viggle/splat-engine';
import { readVsplat, writeVsplat, selectSplats, sigmoid, hsv } from './vsplat-io.mjs';

const workspace = fileURLToPath(new URL('../../', import.meta.url));
const [sourceArg, destinationArg] = process.argv.slice(2);
const source = path.resolve(sourceArg || path.join(workspace, 'output/agi1-splat-print.vsplat'));
const destination = path.resolve(destinationArg || path.join(workspace, 'public/models/agi1-splat.vsplat'));
if (source === destination) throw new Error('Source and output must differ.');

const library = loadSkeletonLibrary(), names = library.boneNames441, parents = library.parents441;
const input = readVsplat(source);
if (input.header.blocks.joints.count !== names.length) throw new Error('Expected the 441-bone MetaHuman rig.');
const boneId = (name) => { const i = names.indexOf(name); if (i < 0) throw new Error(`Missing bone ${name}`); return i; };

// ---- 1 + 2: drop invisible splats, then keep slot 0 for an invisible placeholder
const VISIBLE = Math.log((1 / 255) / (1 - 1 / 255));
const kept = [];
for (let i = 0; i < input.n; i++) if (input.opacity[i] >= VISIBLE) kept.push(i);
const dropped = input.n - kept.length;
// The placeholder copies a dropped (invisible) splat when there is one, else the
// first splat with its opacity set to the minimum; the real first splat moves
// to the end.
const placeholder = dropped > 0 ? [...Array(input.n).keys()].find(i => input.opacity[i] < VISIBLE) : kept[0];
const model = selectSplats(input, [placeholder, ...kept]);
model.opacity[0] = input.header.blocks.opacity.min[0];
const n = model.n;

// ---- rest skeleton in model space
const armature = new Armature('polish', { numBones: names.length, boneNames: names, restIsPerCharacter: true,
  stdMaleRestTranslations: Float32Array.from(input.joints), stdMaleRestRotations: library.restRotations441, stdMaleParents: parents });
const rest = new Pose(names.length); rest.setToBind(armature.skeleton.bindT, armature.skeleton.bindR);
const world = []; armature.skeleton.applyLocal(rest, pc.Mat4.IDENTITY, world);
const joint = names.map((_, i) => world[i].getTranslation(new pc.Vec3()));

// ---- per-splat helpers
const colorOf = (i) => [model.color[i * 3], model.color[i * 3 + 1], model.color[i * 3 + 2]];
const scalesOf = (i) => [0, 1, 2].map(c => Math.exp(model.scale[i * 3 + c])).sort((a, b) => b - a);
const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const GOLDEN = 1, SHIRT = 2;
const colorClass = new Uint8Array(n);
for (let i = 1; i < n; i++) {
  const [h, s, v] = hsv(...colorOf(i));
  if ((h >= 24 && h <= 60 && s >= 0.18 && v >= 0.3) || (h >= 18 && h <= 45 && s >= 0.45 && v >= 0.12 && v < 0.6)) colorClass[i] = GOLDEN;
  else if (h >= 200 && h <= 320 && s >= 0.06) colorClass[i] = SHIRT;
}
const CELL = 0.02, grid = new Map();
const cellKey = (x, y, z) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;
for (let i = 1; i < n; i++) {
  const key = cellKey(model.pos[i * 3], model.pos[i * 3 + 1], model.pos[i * 3 + 2]);
  if (!grid.has(key)) grid.set(key, []);
  grid.get(key).push(i);
}
function neighbours(i, radius) {
  const x = model.pos[i * 3], y = model.pos[i * 3 + 1], z = model.pos[i * 3 + 2], out = [];
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), cz = Math.floor(z / CELL), reach = Math.ceil(radius / CELL);
  for (let a = -reach; a <= reach; a++) for (let b = -reach; b <= reach; b++) for (let c = -reach; c <= reach; c++) {
    const list = grid.get(`${cx + a},${cy + b},${cz + c}`);
    if (!list) continue;
    for (const j of list) {
      if (j === i) continue;
      const dx = model.pos[j * 3] - x, dy = model.pos[j * 3 + 1] - y, dz = model.pos[j * 3 + 2] - z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 <= radius * radius) out.push([j, d2]);
    }
  }
  return out;
}
const smooth = (a, b, t) => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); };

// ---- 3: lift muddy patches in the hair
// Hair is the golden splats outside the face (her face, neck and arms are warmer
// and pinker; the shirt is lavender). Only blob-shaped splats are changed: the
// second-largest axis tells a round smudge from a thin strand line.
let lifted = 0;
const newColor = Uint8Array.from(model.color);
for (let i = 1; i < n; i++) {
  if (colorClass[i] !== GOLDEN || model.pos[i * 3 + 1] < 0.95) continue;
  const alpha = sigmoid(model.opacity[i]);
  if (alpha < 0.1) continue;
  const [, middle] = scalesOf(i);
  const blob = smooth(0.0025, 0.005, middle);
  if (blob <= 0) continue;
  const around = neighbours(i, 0.03).filter(([j]) => colorClass[j] === GOLDEN && sigmoid(model.opacity[j]) > 0.2);
  if (around.length < 8) continue;
  around.sort(([a], [b]) => luminance(colorOf(a)) - luminance(colorOf(b)));
  const reference = colorOf(around[Math.floor(around.length * 0.6)][0]);
  const own = colorOf(i), lumOwn = luminance(own), lumRef = luminance(reference);
  const deficit = smooth(0.1, 0.35, (0.85 * lumRef - lumOwn) / Math.max(1, lumRef));
  const amount = blob * deficit;
  if (amount <= 0) continue;
  for (let c = 0; c < 3; c++) newColor[i * 3 + c] = Math.round(own[c] + (reference[c] * 0.9 - own[c]) * amount);
  lifted++;
}
model.color = newColor;

// ---- 4: hair far from the arms follows the upper body
const descendants = (root) => {
  const out = new Set([root]);
  for (let grew = true; grew;) { grew = false; for (let i = 0; i < names.length; i++) if (!out.has(i) && out.has(parents[i])) { out.add(i); grew = true; } }
  return out;
};
const armBones = new Set([...descendants(boneId('clavicle_l')), ...descendants(boneId('clavicle_r'))]);
const chain = [['head', joint[boneId('head')].y + 0.03], ['neck_02', joint[boneId('neck_02')].y], ['neck_01', joint[boneId('neck_01')].y],
  ['spine_05', joint[boneId('spine_05')].y], ['spine_04', joint[boneId('spine_04')].y]].map(([name, y]) => [boneId(name), y]);
const chainAt = (y) => {
  if (y >= chain[0][1]) return [[chain[0][0], 1]];
  for (let k = 0; k < chain.length - 1; k++) {
    const [a, ya] = chain[k], [b, yb] = chain[k + 1];
    if (y >= yb) { const t = smooth(0, 1, (y - yb) / (ya - yb)); return [[a, t], [b, 1 - t]]; }
  }
  return [[chain.at(-1)[0], 1]];
};
const segments = ['l', 'r'].flatMap(side => [
  [joint[boneId(`clavicle_${side}`)], joint[boneId(`upperarm_${side}`)]],
  [joint[boneId(`upperarm_${side}`)], joint[boneId(`lowerarm_${side}`)]],
  [joint[boneId(`lowerarm_${side}`)], joint[boneId(`hand_${side}`)]],
  [joint[boneId(`hand_${side}`)], joint[boneId(`middle_03_${side}`)]],
]);
const point = new pc.Vec3(), along = new pc.Vec3(), closest = new pc.Vec3();
const armDistance = () => {
  let best = Infinity;
  for (const [a, b] of segments) {
    along.sub2(b, a);
    const t = Math.max(0, Math.min(1, closest.sub2(point, a).dot(along) / along.lengthSq()));
    closest.copy(a).add(along.mulScalar(t));
    best = Math.min(best, point.distance(closest));
  }
  return best;
};
const paletteSlot = new Map(model.palette.map((bone, slot) => [bone, slot]));
let followBody = 0;
for (let i = 1; i < n; i++) {
  if (colorClass[i] === SHIRT) continue;
  const weights = [model.boneWeight[i * 3], model.boneWeight[i * 3 + 1], model.boneWeight[i * 3 + 2]];
  weights.push(Math.max(0, 255 - weights[0] - weights[1] - weights[2]));
  const bones = [0, 1, 2, 3].map(k => model.palette[model.boneIndex[i * 4 + k]]);
  let armWeight = 0;
  bones.forEach((bone, k) => { if (armBones.has(bone)) armWeight += weights[k] / 255; });
  if (armWeight <= 0) continue;
  point.set(model.pos[i * 3], model.pos[i * 3 + 1], model.pos[i * 3 + 2]);
  const far = smooth(0.08, 0.16, armDistance());
  if (far <= 0) continue;
  // Golden splats are hair; anything else counts only inside a mostly-golden neighbourhood.
  let hair = colorClass[i] === GOLDEN ? 1 : 0;
  if (!hair) {
    const around = neighbours(i, 0.015);
    const golden = around.filter(([j]) => colorClass[j] === GOLDEN).length;
    hair = around.length ? smooth(0.35, 0.6, golden / around.length) : 0;
  }
  const amount = far * hair;
  if (amount <= 0) continue;
  const mix = new Map();
  const add = (bone, w) => mix.set(bone, (mix.get(bone) || 0) + w);
  bones.forEach((bone, k) => {
    const w = weights[k] / 255;
    if (!armBones.has(bone)) add(bone, w);
    else { add(bone, w * (1 - amount)); for (const [target, t] of chainAt(point.y)) add(target, w * amount * t); }
  });
  const top = [...mix.entries()].filter(([bone, w]) => w > 1e-4 && paletteSlot.has(bone)).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const total = top.reduce((sum, [, w]) => sum + w, 0);
  while (top.length < 4) top.push([top[0][0], 0]);
  let stored = 0;
  for (let k = 0; k < 4; k++) {
    model.boneIndex[i * 4 + k] = paletteSlot.get(top[k][0]);
    if (k < 3) {
      const w = Math.min(255 - stored, Math.round(top[k][1] / total * 255));
      model.boneWeight[i * 3 + k] = w; stored += w;
    }
  }
  followBody++;
}

const bytes = writeVsplat(destination, model);
console.log(JSON.stringify({ source, destination, splatsIn: input.n, droppedInvisible: dropped, splatsOut: n,
  placeholderFrom: placeholder, liftedHairPatches: lifted, hairFollowsBody: followBody, bytes }, null, 2));
