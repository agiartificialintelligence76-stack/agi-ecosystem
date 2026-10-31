// Source artwork blends golden hair and peach skin into violet fabric at edges.
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
    if (!source[i + 3] || skin[p] === 1 || skin[p] === 2) continue;
    const [h, s, l] = toHsl(source[i], source[i + 1], source[i + 2]);
    // HSL saturation is misleading close to white: cream print must neither
    // recolor nor become a false golden-hair anchor for adjacent fabric.
    if (h < 100 && Math.min(source[i], source[i + 1], source[i + 2]) >= 200) continue;
    if (skin[p] === 3) {
      // Peach anatomy is immutable. Only its pink/violet antialiasing may carry
      // fabric color; changing hair must never affect this second blend type.
      if (h < 70 && s > .18 && l > .12) material[p] = 3;
      else if (h > 245 && h < 295 && s > .30) material[p] = 2;
      else if (h >= 295 && h < 350 && l > .12) candidates.push([p, 3]);
      continue;
    }
    // Brown under-hair is also a reliable foreground anchor. It uses the
    // same warm-shadow range as the main recolorer; gold-only seeds leave
    // mixed mauve edges around shaded curls without any foreground sample.
    const warmHairShadow = h >= 24 && h < 36 && s > .26 && l > .23 && l < .73;
    if ((h >= 36 && h < 70 && s > .44) || warmHairShadow) material[p] = 1;
    // Fabric seen through a small curl can be muted by shadow. Its violet hue
    // remains unambiguous below the saturation of the broad garment panels.
    else if (h > 245 && h < 295 && s > .30) material[p] = 2;
    else if (l > .10 && !(l > .78 && s < .24)) candidates.push([p, 1]);
  }
  const plan = [];
  for (const [p, foreground] of candidates) {
    const x = p % SIZE, y = Math.floor(p / SIZE), i = p * 4;
    const foregroundColors = [], fabric = [];
    const collect = (radius, outerOnly = false) => {
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (outerOnly && Math.abs(dx) <= 6 && Math.abs(dy) <= 6) continue;
      if (x + dx < 0 || x + dx >= SIZE || y + dy < 0 || y + dy >= SIZE) continue;
      const q = p + dy * SIZE + dx, distance = dx * dx + dy * dy;
      if (material[q] === foreground) foregroundColors.push([q * 4, distance]);
      else if (material[q] === 2) fabric.push([q * 4, distance]);
    }
    };
    collect(6);
    // The last pixels of a tapered curl may be farther from unmixed hair.
    // Expand only when a local material is missing, retaining local fits.
    if (!foregroundColors.length || !fabric.length) collect(12, true);
    if (!foregroundColors.length || !fabric.length) continue;
    foregroundColors.sort((a, b) => a[1] - b[1]); fabric.sort((a, b) => a[1] - b[1]);
    let best = null, bestScore = Infinity;
    for (const [a, da] of foregroundColors.slice(0, 12)) for (const [b, db] of fabric.slice(0, 12)) {
      let aa = 0, bb = 0, ab = 0, pa = 0, pb = 0;
      for (let c = 0; c < 3; c++) {
        aa += source[a + c] ** 2; bb += source[b + c] ** 2;
        ab += source[a + c] * source[b + c];
        pa += source[i + c] * source[a + c]; pb += source[i + c] * source[b + c];
      }
      const denominator = aa * bb - ab * ab;
      const foregroundWeight = (pa * bb - pb * ab) / denominator;
      const fabricWeight = (pb * aa - pa * ab) / denominator;
      const total = foregroundWeight + fabricWeight;
      if (!Number.isFinite(total) || total < .3 || total > 1.8 || foregroundWeight < .04 || fabricWeight < .04) continue;
      let error = 0;
      for (let c = 0; c < 3; c++) error += (source[i + c] - (source[a + c] * foregroundWeight + source[b + c] * fabricWeight)) ** 2;
      const score = error + (da + db) * 2 + (total - 1) ** 2 * 25;
      if (error < 900 && score < bestScore) { best = [i, a, b, foregroundWeight, fabricWeight]; bestScore = score; }
    }
    if (best) plan.push(best);
  }
  if (cache.size >= 16) cache.delete(cache.keys().next().value);
  cache.set(key, plan);
  return plan;
}

export function recolorMaterialEdges(source, result, plan) {
  for (const [i, a, b, foregroundWeight, fabricWeight] of plan) {
    // The original-palette mixture must remain exact, including when a hair
    // change leaves both anchors of a protected skin/fabric edge unchanged.
    if ([0, 1, 2].every((c) => result[a + c] === source[a + c] && result[b + c] === source[b + c])) continue;
    // A local two-material fit has a small residual. Keeping its RGB chroma
    // carries the source violet fringe into green cloth or pale hair. Preserve
    // only its luminance, so edge texture remains without the obsolete hue.
    const residual = [0, 1, 2].map((c) => source[i + c]
      - source[a + c] * foregroundWeight - source[b + c] * fabricWeight);
    const lightResidual = residual[0] * .2126 + residual[1] * .7152 + residual[2] * .0722;
    for (let c = 0; c < 3; c++) {
      result[i + c] = Math.max(0, Math.min(255, Math.round(result[a + c] * foregroundWeight
        + result[b + c] * fabricWeight + lightResidual)));
    }
  }
}
