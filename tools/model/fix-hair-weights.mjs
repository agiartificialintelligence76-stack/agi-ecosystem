// Re-weights AGI-1's hair so it follows her head and upper back instead of her arms.
//
// Why: the model is one single mesh (body + hair + clothes). The automatic rigging tied a lot of the long hair
// to the shoulder and arm bones, so when she moves her arms, the hair is dragged sideways ("exploding hair").
// How: 1) find the hair by its texture color (golden blonde; skin is pinker, the top is lavender),
//      2) clean that mask (no stray specks) and soften its border so there is no visible seam,
//      3) give hair vertices new weights along the head → neck → upper back chain, based on their height.
// Usage: node fix-hair-weights.mjs <in.glb> <out.glb>
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const [, , IN, OUT] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.readBinary(new Uint8Array(readFileSync(IN)));
const node = doc.getRoot().listNodes().find((n) => n.getMesh() && n.getSkin());
const skin = node.getSkin();
const prim = node.getMesh().listPrimitives()[0];
const POS = prim.getAttribute('POSITION'), UV = prim.getAttribute('TEXCOORD_0');
const J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0');
const N = POS.getCount();
const names = skin.listJoints().map((j) => j.getName().replace(':', ''));
const jointIndex = (n) => { const i = names.indexOf(n); if (i < 0) throw new Error('missing bone ' + n); return i; };

// ---- 1. hair by texture color ----
const tex = prim.getMaterial().getBaseColorTexture();
const S = 2048;
const img = await sharp(Buffer.from(tex.getImage())).resize(S, S).removeAlpha().raw().toBuffer();
const hue = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < 1e-6) return [0, 0];
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; return [h, d / mx]; };
const isHairColor = new Uint8Array(N); const uv = [];
for (let v = 0; v < N; v++) {
  UV.getElement(v, uv);
  const x = Math.min(S - 1, Math.max(0, Math.floor(uv[0] * S))), y = Math.min(S - 1, Math.max(0, Math.floor(uv[1] * S)));
  let r = 0, g = 0, b = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const i = (Math.min(S - 1, Math.max(0, y + dy)) * S + Math.min(S - 1, Math.max(0, x + dx))) * 3; r += img[i]; g += img[i + 1]; b += img[i + 2];
  }
  const [h, s] = hue(r, g, b);
  isHairColor[v] = s >= 0.12 && h >= 24 && h < 60 ? 1 : 0;   // skin ≈ 15–22°, hair ≈ 27–35°, top ≈ 260–280°
}

// ---- 2. mesh neighbors (vertices at the same spot are one point: UV seams split them) ----
const p = [], key = new Map(), weld = new Int32Array(N);
for (let v = 0; v < N; v++) { POS.getElement(v, p); const k = p.map((c) => Math.round(c * 1e4)).join(','); if (!key.has(k)) key.set(k, key.size); weld[v] = key.get(k); }
const M = key.size, nbr = Array.from({ length: M }, () => new Set());
const idx = prim.getIndices().getArray();
for (let f = 0; f < idx.length; f += 3) {
  const a = weld[idx[f]], b = weld[idx[f + 1]], c = weld[idx[f + 2]];
  nbr[a].add(b).add(c); nbr[b].add(a).add(c); nbr[c].add(a).add(b);
}
let hair = new Float32Array(M); const cnt = new Float32Array(M);
for (let v = 0; v < N; v++) { hair[weld[v]] += isHairColor[v]; cnt[weld[v]]++; }
for (let i = 0; i < M; i++) hair[i] /= cnt[i];
const smooth = (a, times) => { for (let t = 0; t < times; t++) { const b = new Float32Array(M);
  for (let i = 0; i < M; i++) { let s = a[i], n = 1; for (const j of nbr[i]) { s += a[j]; n++; } b[i] = s / n; } a = b; } return a; };
// majority vote twice (removes stray specks), then a soft 3-step border
for (let k = 0; k < 2; k++) { hair = smooth(hair, 1); for (let i = 0; i < M; i++) hair[i] = hair[i] >= 0.5 ? 1 : 0; }
const hairness = smooth(hair, 3);

// ---- 3. new weights for hair: head → neck → upper back, by height ----
// Joint positions in the bind pose (T-pose) = inverse of the inverse-bind matrices.
const IBM = skin.getInverseBindMatrices(); const m = [];
const jointPos = (n) => { IBM.getElement(jointIndex(n), m);
  const [a, b, c, , d, e, f, , g, h, i, , tx, ty, tz] = m;   // column-major 3×3 R + translation t; position = -R⁻¹ t
  const det = a * (e * i - f * h) - d * (b * i - c * h) + g * (b * f - c * e);
  const inv = [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det, (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det, (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det];
  // inv is R⁻¹ in column-major; apply to t
  return [-(inv[0] * tx + inv[3] * ty + inv[6] * tz), -(inv[1] * tx + inv[4] * ty + inv[7] * tz), -(inv[2] * tx + inv[5] * ty + inv[8] * tz)];
};
const CHAIN = ['mixamorigSpine', 'mixamorigSpine1', 'mixamorigSpine2', 'mixamorigNeck', 'mixamorigHead'].map((n) => ({ n, j: jointIndex(n), y: jointPos(n)[1] }));
console.log('anchor heights:', CHAIN.map((c) => `${c.n.replace('mixamorig', '')} ${c.y.toFixed(3)}`).join(' · '));
const anchor = (y) => {           // piecewise-linear blend between the two nearest chain joints
  if (y >= CHAIN[CHAIN.length - 1].y) return [[CHAIN[CHAIN.length - 1].j, 1]];
  if (y <= CHAIN[0].y) return [[CHAIN[0].j, 1]];
  for (let k = 0; k < CHAIN.length - 1; k++) {
    const lo = CHAIN[k], hi = CHAIN[k + 1];
    if (y >= lo.y && y <= hi.y) { const t = (y - lo.y) / (hi.y - lo.y); return [[lo.j, 1 - t], [hi.j, t]]; }
  }
};
const ARM = new Set(names.map((n, i) => (/Shoulder|Arm|Hand/.test(n) ? i : -1)).filter((i) => i >= 0));
let changed = 0, armBefore = 0, armAfter = 0; const j4 = [], w4 = [];
for (let v = 0; v < N; v++) {
  J.getElement(v, j4); W.getElement(v, w4);
  const h = hairness[weld[v]];
  for (let k = 0; k < 4; k++) if (ARM.has(j4[k])) armBefore += w4[k];
  if (h > 0.001) {
    POS.getElement(v, p);
    const mix = new Map();
    for (let k = 0; k < 4; k++) if (w4[k] > 0) mix.set(j4[k], (mix.get(j4[k]) || 0) + w4[k] * (1 - h));
    for (const [j, w] of anchor(p[1])) mix.set(j, (mix.get(j) || 0) + w * h);
    const top = [...mix.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((s, [, w]) => s + w, 0);
    for (let k = 0; k < 4; k++) { j4[k] = top[k] ? top[k][0] : 0; w4[k] = top[k] ? top[k][1] / sum : 0; }
    J.setElement(v, j4); W.setElement(v, w4); changed++;
  }
  for (let k = 0; k < 4; k++) if (ARM.has(j4[k])) armAfter += w4[k];
}
console.log(`hair-colored vertices: ${isHairColor.reduce((a, b) => a + b, 0)} of ${N} · re-weighted: ${changed}`);
console.log(`total weight on shoulder/arm bones: ${armBefore.toFixed(0)} → ${armAfter.toFixed(0)}`);
writeFileSync(OUT, await io.writeBinary(doc));
console.log('wrote', OUT);
