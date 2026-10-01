// AGI-1 in 2D (2026-10-01): her Live2D model, drawn by the stage's own three.js renderer (one canvas, one scene: the zoom,
// the live views, her hearts and the "3D · 2D" switch work as for her 3D model). Live2D's own runtime, Cubism Core
// (public/models/agi1-live2d/live2dcubismcore.min.js, © Live2D Inc., used as it is), reads her model file and works out,
// every frame, where each piece of her is; this file draws those pieces: one three.js mesh per Live2D "drawable", in
// Live2D's order, with its opacity and blend mode, and the clipping Live2D uses (her irises and the light in her eyes are
// cut to her eye whites: done with the stencil buffer, so the stage's renderer is made with `stencil: true`).
// Live2D's own drawing code isn't used (it needs its own WebGL setup); this does the same with three.js.
import * as THREE from 'three';

// ---------- Cubism Core: loaded once, as a plain script (it defines window.Live2DCubismCore) ----------
let corePromise = null;
export function loadCubismCore(src) {
  if (globalThis.Live2DCubismCore) return Promise.resolve(globalThis.Live2DCubismCore);
  corePromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => (globalThis.Live2DCubismCore ? resolve(globalThis.Live2DCubismCore) : reject(new Error('Cubism Core is missing')));
    s.onerror = () => { corePromise = null; s.remove(); reject(new Error("Cubism Core didn't load")); };
    document.head.appendChild(s);
  });
  return corePromise;
}

// ---------- materials ----------
// The texture is uploaded with premultiplied alpha (clean edges when it's filtered, as Live2D does) and drawn as it is:
// no color-space conversion and no tone mapping, so her colors are exactly the model's.
const VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = /* glsl */`
  uniform sampler2D map;
  uniform float opacity;
  uniform vec3 mulColor;
  uniform vec3 scrColor;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(map, vUv);
    c.rgb *= mulColor;
    c.rgb = c.rgb + scrColor * c.a - c.rgb * scrColor;
    gl_FragColor = c * opacity;
  }`;
// a mask: only marks the stencil buffer where its picture is (at least half opaque), draws no color
const MASK_FRAG = /* glsl */`
  uniform sampler2D map;
  varying vec2 vUv;
  void main() { if (texture2D(map, vUv).a < 0.5) discard; gl_FragColor = vec4(0.0); }`;

// Live2D's constant flags: 1 additive, 2 multiplicative, 4 double-sided, 8 an inverted mask
function setBlend(m, flags) {
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation;
  m.blendEquationAlpha = THREE.AddEquation;
  if (flags & 1) {
    m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneFactor; m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor;
  } else if (flags & 2) {
    m.blendSrc = THREE.DstColorFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor; m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor;
  } else {
    m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor; m.blendSrcAlpha = THREE.OneFactor; m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  }
}
function drawMaterial(map, flags) {
  const m = new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, opacity: { value: 1 }, mulColor: { value: new THREE.Color(1, 1, 1) }, scrColor: { value: new THREE.Color(0, 0, 0) } },
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
  });
  setBlend(m, flags);
  return m;
}
function maskMaterial(map, ref) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map } },
    vertexShader: VERT, fragmentShader: MASK_FRAG,
    transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, colorWrite: false,
    stencilWrite: true, stencilRef: ref, stencilFunc: THREE.AlwaysStencilFunc, stencilWriteMask: 0xff, stencilFuncMask: 0xff,
    stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.ReplaceStencilOp,
  });
}
function clipTo(m, ref, inverted) {
  // test only (three.js turns the stencil test on with stencilWrite; the write mask 0 keeps the buffer as it is)
  Object.assign(m, {
    stencilWrite: true, stencilRef: ref, stencilFunc: inverted ? THREE.NotEqualStencilFunc : THREE.EqualStencilFunc,
    stencilFuncMask: 0xff, stencilWriteMask: 0, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.KeepStencilOp,
  });
}

// The model's pieces as three.js meshes. `order`: where she draws among the stage's things (renderOrder: after the floor,
// before the hearts); her own pieces fit between order and order + 0.02, in Live2D's order.
export function buildMeshes(core, map, { order = 1 } = {}) {
  const D = core.drawables;
  const group = new THREE.Group();
  group.name = 'live2d';
  const meshes = [], proxies = [];
  for (let i = 0; i < D.count; i++) {
    const n = D.vertexCounts[i];
    const g = new THREE.BufferGeometry();
    const pos = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    pos.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', pos);
    g.setAttribute('uv', new THREE.BufferAttribute(Float32Array.from(D.vertexUvs[i]), 2));   // (Live2D's v points up, like three.js's)
    g.setIndex(new THREE.BufferAttribute(Uint16Array.from(D.indices[i]), 1));
    const mesh = new THREE.Mesh(g, drawMaterial(map, D.constantFlags[i]));
    mesh.name = D.ids[i];
    mesh.frustumCulled = false;
    mesh.userData.ro = -1;
    group.add(mesh);
    meshes.push(mesh);
  }
  // clipping: before each clipped piece, its masks mark the stencil buffer with a number of its own (1, 2, 3…), and the
  // piece only draws where that number is
  let ref = 0;
  for (let i = 0; i < D.count; i++) {
    if (!D.maskCounts[i]) continue;
    ref = Math.min(255, ref + 1);
    clipTo(meshes[i].material, ref, (D.constantFlags[i] & 8) !== 0);
    for (const j of D.masks[i]) {
      const proxy = new THREE.Mesh(meshes[j].geometry, maskMaterial(map, ref));   // (the mask's own shape, moving with it)
      proxy.name = `${D.ids[j]}→${D.ids[i]}`;
      proxy.frustumCulled = false;
      proxy.userData = { of: i, mask: j };
      group.add(proxy);
      proxies.push(proxy);
    }
  }

  // After the model's update: copy where each piece is, its opacity, its order and its colors
  function sync() {
    const flags = D.dynamicFlags, op = D.opacities, ro = D.renderOrders;
    const mul = D.multiplyColors, scr = D.screenColors;
    for (let i = 0; i < D.count; i++) {
      const mesh = meshes[i];
      const src = D.vertexPositions[i], attr = mesh.geometry.attributes.position, dst = attr.array;
      for (let k = 0, n = D.vertexCounts[i]; k < n; k++) { dst[k * 3] = src[k * 2]; dst[k * 3 + 1] = src[k * 2 + 1]; }
      attr.needsUpdate = true;
      mesh.visible = (flags[i] & 1) !== 0 && op[i] > 0.002;
      mesh.material.uniforms.opacity.value = op[i];
      if (mul && mul.length >= (i + 1) * 4) mesh.material.uniforms.mulColor.value.setRGB(mul[i * 4], mul[i * 4 + 1], mul[i * 4 + 2]);
      if (scr && scr.length >= (i + 1) * 4) mesh.material.uniforms.scrColor.value.setRGB(scr[i * 4], scr[i * 4 + 1], scr[i * 4 + 2]);
      if (ro[i] !== mesh.userData.ro) { mesh.userData.ro = ro[i]; mesh.renderOrder = order + (ro[i] * 2 + 1) * 2e-4; }
    }
    for (const p of proxies) {
      p.visible = meshes[p.userData.of].visible && (flags[p.userData.mask] & 1) !== 0;
      p.renderOrder = order + ro[p.userData.of] * 2 * 2e-4;                 // just before the piece it clips
    }
  }

  function setMap(next) {
    for (const m of [...meshes, ...proxies]) m.material.uniforms.map.value = next;
  }
  function dispose() {
    for (const m of meshes) { m.geometry.dispose(); m.material.dispose(); }
    for (const p of proxies) p.material.dispose();
  }
  return { group, meshes, proxies, sync, setMap, dispose };
}

// Which of her pieces is at (x, y) (model units), the frontmost first; -1 for none. For taps: only visible, mostly opaque
// pieces count, and only inside their triangles (her outline, not a box around her).
export function pieceAt(core, x, y, minOpacity = 0.5) {
  const D = core.drawables;
  const byOrder = [];
  for (let i = 0; i < D.count; i++) if ((D.dynamicFlags[i] & 1) && D.opacities[i] >= minOpacity) byOrder.push(i);
  byOrder.sort((a, b) => D.renderOrders[b] - D.renderOrders[a]);
  for (const i of byOrder) {
    const p = D.vertexPositions[i], idx = D.indices[i];
    for (let k = 0; k < D.indexCounts[i]; k += 3) {
      const a = idx[k] * 2, b = idx[k + 1] * 2, c = idx[k + 2] * 2;
      const d1 = (x - p[b]) * (p[a + 1] - p[b + 1]) - (p[a] - p[b]) * (y - p[b + 1]);
      const d2 = (x - p[c]) * (p[b + 1] - p[c + 1]) - (p[b] - p[c]) * (y - p[c + 1]);
      const d3 = (x - p[a]) * (p[c + 1] - p[a + 1]) - (p[c] - p[a]) * (y - p[a + 1]);
      if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) return i;
    }
  }
  return -1;
}

// The middle and the box of a few pieces right now (model units), for the stage's markers
export function boxOf(core, indices, out = { x0: 0, y0: 0, x1: 0, y1: 0, cx: 0, cy: 0 }) {
  const D = core.drawables;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, sx = 0, sy = 0, n = 0;
  for (const i of indices) {
    if (i < 0) continue;
    const p = D.vertexPositions[i];
    for (let k = 0; k < p.length; k += 2) {
      const x = p[k], y = p[k + 1];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      sx += x; sy += y; n++;
    }
  }
  if (!n) return out;
  Object.assign(out, { x0, y0, x1, y1, cx: sx / n, cy: sy / n });
  return out;
}
