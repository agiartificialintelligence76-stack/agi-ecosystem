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

// ---------- finer meshes (2026-10-03) ----------
// A piece's triangles split in 4, `levels` times (her arms: they bend in code, src/stage/agi1-2d-arms.js, and Live2D's own
// meshes are too coarse there: her elbow showed as a few straight cuts, the owner's close-up). Every new vertex lies inside
// one of the piece's own triangles, so it's a fixed mix of at most 3 of its vertices: it follows the piece exactly, and
// takes its texture coordinates the same way. Returns, per vertex, which vertices it mixes (`from`, 3 each) and how much
// (`w`, 3 each), and the new triangles.
export function refineMesh(indices, vertexCount, levels = 2) {
  const mix = [];                                    // per vertex: Map(original vertex → weight)
  for (let v = 0; v < vertexCount; v++) mix.push(new Map([[v, 1]]));
  let tris = Array.from(indices);
  for (let l = 0; l < levels; l++) {
    const mid = new Map(), next = [];
    const middle = (a, b) => {
      const key = a < b ? a * 1e6 + b : b * 1e6 + a;
      let m = mid.get(key);
      if (m === undefined) {
        const w = new Map();
        for (const [k, x] of mix[a]) w.set(k, (w.get(k) || 0) + x / 2);
        for (const [k, x] of mix[b]) w.set(k, (w.get(k) || 0) + x / 2);
        m = mix.push(w) - 1;
        mid.set(key, m);
      }
      return m;
    };
    for (let k = 0; k < tris.length; k += 3) {
      const a = tris[k], b = tris[k + 1], c = tris[k + 2];
      const ab = middle(a, b), bc = middle(b, c), ca = middle(c, a);
      next.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
    }
    tris = next;
  }
  const count = mix.length, from = new Uint32Array(count * 3), w = new Float32Array(count * 3);
  mix.forEach((m, v) => {
    const parts = [...m].filter(([, x]) => x > 1e-7).sort((p, q) => q[1] - p[1]);
    if (parts.length > 3) throw new Error('refineMesh: a vertex mixes more than 3');
    parts.forEach(([k, x], j) => { from[v * 3 + j] = k; w[v * 3 + j] = x; });
  });
  return { count, from, w, indices: count < 65536 ? Uint16Array.from(tris) : Uint32Array.from(tris) };
}
// a piece's finer vertices from its own (2 numbers each: x, y; or u, v)
export function mixInto(src, fine, out) {
  const { from, w, count } = fine;
  for (let v = 0, o = 0; v < count; v++, o += 3) {
    const a = from[o] * 2, b = from[o + 1] * 2, c = from[o + 2] * 2, wa = w[o], wb = w[o + 1], wc = w[o + 2];
    out[v * 2] = src[a] * wa + src[b] * wb + src[c] * wc;
    out[v * 2 + 1] = src[a + 1] * wa + src[b + 1] * wb + src[c + 1] * wc;
  }
  return out;
}

// The model's pieces as three.js meshes. `order`: where she draws among the stage's things (renderOrder: after the floor,
// before the hearts); her own pieces fit between order and order + 0.02, in Live2D's order. `refine`: { piece index:
// levels } for pieces drawn with a finer mesh (see refineMesh): their vertices this frame are in `fine[i].positions`, filled
// from Live2D's by expand() (call it after Live2D's update; then change them if you like, before sync()).
export function buildMeshes(core, map, { order = 1, refine = {} } = {}) {
  const D = core.drawables;
  const group = new THREE.Group();
  group.name = 'live2d';
  const meshes = [], proxies = [], fine = {};
  for (let i = 0; i < D.count; i++) {
    const levels = refine[i] || 0;
    const f = levels > 0 ? refineMesh(D.indices[i], D.vertexCounts[i], levels) : null;
    if (f) fine[i] = Object.assign(f, { positions: new Float32Array(f.count * 2) });
    const n = f ? f.count : D.vertexCounts[i];
    const g = new THREE.BufferGeometry();
    const pos = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    pos.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', pos);
    // (Live2D's v points up, like three.js's)
    g.setAttribute('uv', new THREE.BufferAttribute(f ? mixInto(D.vertexUvs[i], f, new Float32Array(n * 2)) : Float32Array.from(D.vertexUvs[i]), 2));
    g.setIndex(new THREE.BufferAttribute(f ? f.indices : Uint16Array.from(D.indices[i]), 1));
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

  // The finer pieces' vertices from Live2D's, this frame (after its update, before anything turns them)
  function expand() {
    for (const i in fine) mixInto(D.vertexPositions[i], fine[i], fine[i].positions);
  }
  // After the model's update: copy where each piece is, its opacity, its order and its colors
  function sync() {
    const flags = D.dynamicFlags, op = D.opacities, ro = D.renderOrders;
    const mul = D.multiplyColors, scr = D.screenColors;
    for (let i = 0; i < D.count; i++) {
      const mesh = meshes[i];
      const f = fine[i], src = f ? f.positions : D.vertexPositions[i], attr = mesh.geometry.attributes.position, dst = attr.array;
      for (let k = 0, n = f ? f.count : D.vertexCounts[i]; k < n; k++) { dst[k * 3] = src[k * 2]; dst[k * 3 + 1] = src[k * 2 + 1]; }
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
  expand();
  return { group, meshes, proxies, fine, expand, sync, setMap, dispose };
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
