// JAYWALK: voxel models as three.js geometry. A model is a list of boxes [x0, y0, z0, x1, y1, z1, color, flags]
// (models.js); this merges them into one BufferGeometry with flat faces and colors baked per vertex (tops brightest,
// bottoms dark, so every toy reads as solid from the game's high camera), plus an "ink hull": the same boxes a little
// bigger, drawn back-faces-only in ink behind the model, for the sticker outline. Flags: 'g' glows (an unlit
// material: lights, LEDs, the data river's sparks), 'n' no outline.
import * as THREE from 'three';

// a face: its outward normal, its 4 corners on the unit cube, its baked shade
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], shade: 0.9 },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], shade: 0.9 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.5 },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], shade: 0.96 },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], shade: 0.84 },
];
// counter-clockwise from outside, whatever order the corners above came in
for (const f of FACES) {
  const [a, b, c] = f.c;
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  if (cr[0] * f.n[0] + cr[1] * f.n[1] + cr[2] * f.n[2] < 0) f.c.reverse();
}

const colorCache = new Map();
function linear(hex) {
  let c = colorCache.get(hex);
  if (!c) { c = new THREE.Color(hex); colorCache.set(hex, c); }
  return c;
}

// boxes → { body, hull } (hull: null when outline is 0). unit: model units per world unit (16 = 16 voxels a cell).
export function voxGeometry(boxes, { unit = 1 / 16, outline = 0.55, offset = [0, 0, 0], shadeBottom = true } = {}) {
  const lit = { p: [], n: [], c: [] }, glow = { p: [], n: [], c: [] };
  const hp = [], hn = [];
  for (const b of boxes) {
    const [x0, y0, z0, x1, y1, z1, hex, flags = ''] = b;
    const g = flags.includes('g');
    const col = linear(hex);
    const dst = g ? glow : lit;
    const lo = [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], hi = [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)];
    for (const f of FACES) {
      const s = g ? 1 : (f.n[1] < 0 && !shadeBottom ? 0.8 : f.shade);
      for (const k of [0, 1, 2, 0, 2, 3]) {
        const q = f.c[k];
        dst.p.push((lo[0] + (hi[0] - lo[0]) * q[0]) * unit + offset[0], (lo[1] + (hi[1] - lo[1]) * q[1]) * unit + offset[1], (lo[2] + (hi[2] - lo[2]) * q[2]) * unit + offset[2]);
        dst.n.push(f.n[0], f.n[1], f.n[2]);
        dst.c.push(col.r * s, col.g * s, col.b * s);
      }
    }
    if (outline > 0 && !flags.includes('n')) {
      const e = outline;
      for (const f of FACES) {
        for (const k of [0, 1, 2, 0, 2, 3]) {
          const q = f.c[k];
          hp.push((lo[0] - e + (hi[0] - lo[0] + 2 * e) * q[0]) * unit + offset[0], (lo[1] - e + (hi[1] - lo[1] + 2 * e) * q[1]) * unit + offset[1], (lo[2] - e + (hi[2] - lo[2] + 2 * e) * q[2]) * unit + offset[2]);
          hn.push(f.n[0], f.n[1], f.n[2]);
        }
      }
    }
  }
  const body = new THREE.BufferGeometry();
  const nLit = lit.p.length / 3, nGlow = glow.p.length / 3;
  body.setAttribute('position', new THREE.Float32BufferAttribute([...lit.p, ...glow.p], 3));
  body.setAttribute('normal', new THREE.Float32BufferAttribute([...lit.n, ...glow.n], 3));
  body.setAttribute('color', new THREE.Float32BufferAttribute([...lit.c, ...glow.c], 3));
  body.addGroup(0, nLit, 0);
  if (nGlow) body.addGroup(nLit, nGlow, 1);
  body.computeBoundingSphere();
  body.computeBoundingBox();
  let hull = null;
  if (hp.length) {
    hull = new THREE.BufferGeometry();
    hull.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3));
    hull.setAttribute('normal', new THREE.Float32BufferAttribute(hn, 3));
    hull.computeBoundingSphere();
  }
  return { body, hull };
}

// the ink hull's material. A model made of many boxes has hulls that can sit in front of its own other boxes (the
// underside of her hair's hull is in front of her shirt, seen from above): pushing the hull a little away from the
// camera (`push`, world units) hides it behind the model's own surfaces, so it only ever outlines against what's behind.
export function inkMaterial(push = 0.15, color = '#1d0f45') {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>',
      `#include <project_vertex>\n  mvPosition.z -= ${push.toFixed(3)};\n  gl_Position = projectionMatrix * mvPosition;`);
  };
  m.customProgramCacheKey = () => `jw-ink-${push.toFixed(3)}`;
  return m;
}

// the shared materials: lit voxels, glowing voxels, the ink hulls (things on the street; characters, deeper)
export function voxMaterials() {
  const lit = new THREE.MeshLambertMaterial({ vertexColors: true });
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  const ink = inkMaterial(0.14);
  const inkChar = inkMaterial(0.32);
  return { lit, glow, ink, inkChar, pair: [lit, glow] };
}
