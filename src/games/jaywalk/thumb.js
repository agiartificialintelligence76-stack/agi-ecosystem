// JAYWALK: a character's picture for the looks (2026-11-08), drawn from the same voxel boxes as the 3D model by a tiny
// software rasterizer (a depth buffer, flat-shaded faces, an ink outline around the silhouette), so the picker needs no
// read-back from the GPU and its pictures have see-through backgrounds. Done once per look, a few milliseconds each.
import { CHARACTER_MODELS } from './models.js';

const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]] },
  { n: [0, 1, 0], c: [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]] },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { n: [0, 0, -1], c: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]] },
];

// boxes → an RGBA image (size × size): her front three-quarter, lit from the upper left
export function rasterize(boxes, size, { yaw = -0.62, pitch = 0.32, pad = 0.1, outline = 3, ink = '#1d0f45' } = {}) {
  // the camera looks at her face (she faces -z): from the front, a little to her right, a little above
  const camDir = norm([Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)]);
  const f = [-camDir[0], -camDir[1], -camDir[2]];
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  const light = norm([-0.45, 1, -0.7]);
  // fit
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const b of boxes) {
    for (const cx of [b[0], b[3]]) for (const cy of [b[1], b[4]]) for (const cz of [b[2], b[5]]) {
      const p = [cx, cy, cz];
      const sx = dot(p, r), sy = dot(p, u);
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
  }
  const span = Math.max(x1 - x0, y1 - y0);
  const k = (size * (1 - 2 * pad)) / span;
  const ox = size / 2 - ((x0 + x1) / 2) * k, oy = size / 2 + ((y0 + y1) / 2) * k;
  const W = size, H = size;
  const depth = new Float32Array(W * H).fill(Infinity);
  const rgba = new Uint8ClampedArray(W * H * 4);
  const tri = (a, b, c, col) => {
    const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), maxX = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
    const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), maxY = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(area) < 1e-9) return;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        let w0 = (b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px);
        let w1 = (c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px);
        let w2 = (a[0] - px) * (b[1] - py) - (a[1] - py) * (b[0] - px);
        if (area < 0) { w0 = -w0; w1 = -w1; w2 = -w2; }
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const s = Math.abs(area);
        const z = (w0 * a[2] + w1 * b[2] + w2 * c[2]) / s;
        const i = y * W + x;
        if (z >= depth[i]) continue;
        depth[i] = z;
        rgba[i * 4] = col[0]; rgba[i * 4 + 1] = col[1]; rgba[i * 4 + 2] = col[2]; rgba[i * 4 + 3] = 255;
      }
    }
  };
  for (const b of boxes) {
    const lo = [Math.min(b[0], b[3]), Math.min(b[1], b[4]), Math.min(b[2], b[5])], hi = [Math.max(b[0], b[3]), Math.max(b[1], b[4]), Math.max(b[2], b[5])];
    const base = hexRgb(b[6]);
    const glow = (b[7] || '').includes('g');
    for (const face of FACES) {
      if (dot(face.n, f) >= 0) continue;   // facing away
      const sh = glow ? 1 : Math.min(1.08, 0.62 + 0.48 * Math.max(0, dot(face.n, light)));
      const col = base.map((v) => Math.min(255, v * sh));
      const pts = face.c.map((q) => {
        const p = [lo[0] + (hi[0] - lo[0]) * q[0], lo[1] + (hi[1] - lo[1]) * q[1], lo[2] + (hi[2] - lo[2]) * q[2]];
        return [ox + dot(p, r) * k, oy - dot(p, u) * k, dot(p, f)];
      });
      tri(pts[0], pts[1], pts[2], col);
      tri(pts[0], pts[2], pts[3], col);
    }
  }
  // the sticker outline: ink around the silhouette
  if (outline > 0) {
    const inkC = hexRgb(ink);
    const solid = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) solid[i] = rgba[i * 4 + 3] ? 1 : 0;
    const R = outline, R2 = R * R + 0.5;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (solid[i]) continue;
        let hit = false;
        for (let dy = -R; dy <= R && !hit; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= H) continue;
          for (let dx = -R; dx <= R; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= W || dx * dx + dy * dy > R2) continue;
            if (solid[yy * W + xx]) { hit = true; break; }
          }
        }
        if (hit) { rgba[i * 4] = inkC[0]; rgba[i * 4 + 1] = inkC[1]; rgba[i * 4 + 2] = inkC[2]; rgba[i * 4 + 3] = 255; }
      }
    }
  }
  return rgba;
}

const cache = new Map();
// a look's picture as a data: URL (PNG), size × size CSS pixels, drawn at twice that and scaled down smoothly
export function thumbOf(id, size = 112) {
  if (cache.has(id)) return cache.get(id);
  const make = CHARACTER_MODELS[id] || CHARACTER_MODELS.agi;
  const S = size * 2;
  const big = document.createElement('canvas');
  big.width = S; big.height = S;
  const img = new ImageData(rasterize(make(), S, { outline: Math.max(2, Math.round(S / 70)) }), S, S);
  big.getContext('2d').putImageData(img, 0, 0);
  const out = document.createElement('canvas');
  out.width = size; out.height = size;
  const g = out.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(big, 0, 0, size, size);
  const url = out.toDataURL('image/png');
  cache.set(id, url);
  return url;
}
