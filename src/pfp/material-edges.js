// Source artwork blends golden hair into violet fabric at their shared edges.
// A hard hue switch cannot recolor those mixed pixels: reconstruct their two
// local materials, then carry the same mixture into the selected palette.
const cache = new Map();
const SIZE = 512;

export function materialEdgePlan(source, skin, character, toHsl) {
  let hash = 2166136261, visible = 0;
  for (let p = 0; p < SIZE * SIZE; p++) {
    const i = p * 4;
    if (source[i + 3]) visible++;
    hash = Math.imul(hash ^ source[i], 16777619);
    hash = Math.imul(hash ^ source[i + 1], 16777619);
    hash = Math.imul(hash ^ source[i + 2], 16777619);
    hash = Math.imul(hash ^ source[i + 3] ^ skin[p], 16777619);
  }
  // Small synthetic pixel probes do not describe a material boundary.
  if (visible < 4096) return [];
  const key = `${character}:${hash >>> 0}`;
  if (cache.has(key)) return cache.get(key);
  const material = new Uint8Array(SIZE * SIZE);
  const candidates = [];
  for (let p = 0; p < material.length; p++) {
    const i = p * 4;
    if (!source[i + 3] || skin[p]) continue;
    const [h, s, l] = toHsl(source[i], source[i + 1], source[i + 2]);
    // HSL saturation is misleading close to white: cream print must neither
    // recolor nor become a false golden-hair anchor for adjacent fabric.
    if (h < 100 && Math.min(source[i], source[i + 1], source[i + 2]) >= 200) continue;
    if (h >= 36 && h < 70 && s > .44) material[p] = 1;
    else if (h > 245 && h < 295 && s > .44) material[p] = 2;
    else if (l > .10 && !(l > .78 && s < .24)) candidates.push(p);
  }
  const plan = [];
  for (const p of candidates) {
    const x = p % SIZE, y = Math.floor(p / SIZE), i = p * 4;
    const hair = [], fabric = [];
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      if (x + dx < 0 || x + dx >= SIZE || y + dy < 0 || y + dy >= SIZE) continue;
      const q = p + dy * SIZE + dx, distance = dx * dx + dy * dy;
      if (material[q] === 1) hair.push([q * 4, distance]);
      else if (material[q] === 2) fabric.push([q * 4, distance]);
    }
    if (!hair.length || !fabric.length) continue;
    hair.sort((a, b) => a[1] - b[1]); fabric.sort((a, b) => a[1] - b[1]);
    let best = null, bestScore = Infinity;
    for (const [a, da] of hair.slice(0, 12)) for (const [b, db] of fabric.slice(0, 12)) {
      let aa = 0, bb = 0, ab = 0, pa = 0, pb = 0;
      for (let c = 0; c < 3; c++) {
        aa += source[a + c] ** 2; bb += source[b + c] ** 2;
        ab += source[a + c] * source[b + c];
        pa += source[i + c] * source[a + c]; pb += source[i + c] * source[b + c];
      }
      const denominator = aa * bb - ab * ab;
      const hairWeight = (pa * bb - pb * ab) / denominator;
      const fabricWeight = (pb * aa - pa * ab) / denominator;
      const total = hairWeight + fabricWeight;
      if (!Number.isFinite(total) || total < .3 || total > 1.8 || hairWeight < .04 || fabricWeight < .04) continue;
      let error = 0;
      for (let c = 0; c < 3; c++) error += (source[i + c] - (source[a + c] * hairWeight + source[b + c] * fabricWeight)) ** 2;
      const score = error + (da + db) * 2 + (total - 1) ** 2 * 25;
      if (error < 900 && score < bestScore) { best = [i, a, b, hairWeight, fabricWeight]; bestScore = score; }
    }
    if (best) plan.push(best);
  }
  if (cache.size >= 16) cache.delete(cache.keys().next().value);
  cache.set(key, plan);
  return plan;
}

export function recolorMaterialEdges(source, result, plan) {
  for (const [i, a, b, hairWeight, fabricWeight] of plan) {
    for (let c = 0; c < 3; c++) {
      result[i + c] = Math.max(0, Math.min(255, Math.round(source[i + c]
        + (result[a + c] - source[a + c]) * hairWeight
        + (result[b + c] - source[b + c]) * fabricWeight)));
    }
  }
}
