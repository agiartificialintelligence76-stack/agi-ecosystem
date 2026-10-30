import { SKIN_REGIONS_A } from './skin-regions-a.js';
import { SKIN_REGIONS_B, ACCESSORY_REGIONS_B } from './skin-regions-b.js';

// Coordinates are traced on each original 512px sprite. Similar skin and hair
// colors must be separated by anatomy, never by a shared face-shaped fallback.
export const SKIN_REGIONS = [...SKIN_REGIONS_A, ...SKIN_REGIONS_B];
const masks = new Map();
const LENSES = {
  23: [[[209,156],[228,140],[255,130],[290,123],[326,119],[352,125],[372,137],[384,151],[386,171],[370,170],[350,167],[326,166],[299,171],[272,181],[248,187],[226,186],[212,178]]],
};

export function skinMask(character) {
  if (masks.has(character)) return masks.get(character);
  const result = new Uint8Array(512 * 512);
  const anatomy = SKIN_REGIONS[character] || [];
  // Faces/eyes and fixed accessories are immutable (1). Neck/arm boundaries
  // (3) may overlap keyed violet collars/hem pixels. Glass is a separate tint (2).
  const regions = [
    ...anatomy.slice(1).map((polygon) => [polygon, 3]),
    ...anatomy.slice(0, 1).map((polygon) => [polygon, 1]),
    ...(ACCESSORY_REGIONS_B[character] || []).map((polygon) => [polygon, 1]),
    ...(LENSES[character] || []).map((polygon) => [polygon, 2]),
  ];
  for (const [polygon, material] of regions) {
    const ys = polygon.map(([, y]) => y);
    const minY = Math.max(0, Math.floor(Math.min(...ys))), maxY = Math.min(511, Math.ceil(Math.max(...ys)));
    // Fill scanline spans rather than testing every pixel against every edge.
    // Detailed pixel contours therefore stay fast on the first randomization.
    for (let y = minY; y <= maxY; y++) {
      const intersections = [], sampleY = y + .5;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
        if ((yi > sampleY) !== (yj > sampleY)) intersections.push(xi + (sampleY - yi) * (xj - xi) / (yj - yi));
      }
      intersections.sort((a, b) => a - b);
      for (let i = 0; i + 1 < intersections.length; i += 2) {
        const left = Math.max(0, Math.ceil(intersections[i] - .5));
        const right = Math.min(512, Math.ceil(intersections[i + 1] - .5));
        if (right > left) result.fill(material, y * 512 + left, y * 512 + right);
      }
    }
  }
  masks.set(character, result);
  return result;
}
