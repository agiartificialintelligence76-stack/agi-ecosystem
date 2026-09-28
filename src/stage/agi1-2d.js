// AGI-1 in 2D (2026-09-27, the owner's idea: visitors choose which AGI-1 they see on the stage and in the live views).
// The owner's 2D art (agi 2d anime/agi-vtuber.html), cleaned up and rigged like a VTuber model, drawn by the same 3D
// stage as her 3D model (one canvas, one scene): flat layers that bend (their corners are moved every frame), in this
// order from back to front: back hair, body, arms, face, her eyes, brows and mouth, front hair.
//
// How she moves (what makes a VTuber look alive):
//  • her head turns in 2.5D: each point of her face moves by how far in front of the middle of her head it sits (her
//    nose most, her ears hardly, the back of her hair the other way), so a small turn reads as a real one;
//  • she's never still: slow drifts of her head and body, breathing (her shoulders rise), her weight shifting;
//  • her eyes lead and her head follows: quick little eye movements, then a slower turn of her head;
//  • she blinks (a real lid: it falls fast and rises slowly, now and then twice), her lids and lower lids shape her
//    smiles, "^^" when she's delighted, a soft "‿" when her eyes close;
//  • her mouth follows her voice (src/lib/talk.js, the same as her 3D mouth), a new shape on each syllable;
//  • her hair swings on springs: its roots follow her head, its ends her body, lagging behind every move;
//  • the lower part of her chest follows through softly when her body moves (a hop, a sway, her dance) and settles,
//    subtle on purpose (Jiggle and chestWeight() in agi1-2d-motion.js);
//  • each arm is one picture that bends like an arm: a round elbow outside, a clean crease inside (elbowOuter() and
//    elbowInner() in agi1-2d-motion.js); she waves with her forearm up and her open hand by her head, palm to you, her
//    hand trailing a little behind her forearm.
// Every reaction the 3D AGI-1 has (agi1:react) has a 2D version, with the same timing, faces and hearts.
//
// The controller returned by createAgi1_2D has the same methods as src/stage/agi1.js's, so the stage uses either.
import * as THREE from 'three';
import { RIG } from './agi1-2d-rig.js';
import {
  Follow, makeDrift, blinkAmount, blinkLength, nextBlinkGap, lidCurves, turnPoint, faceDepth, HEAD, mouthStep,
  elbowOuter, elbowInner, creaseAngle, elbowLimits, wrapAngle, clamp, lerp, smoothstep, mul, rotAround, translate,
  scaleAround, apply, DEG, Jiggle, chestWeight, CHEST,
} from './agi1-2d-motion.js';

export const HEIGHT = 1.62;                        // as tall as the 3D AGI-1, in world units (metres)
const K = HEIGHT / (RIG.feet - RIG.top);           // world units per art pixel
const FIRST_DANCE_AFTER = 14;                      // like the 3D AGI-1: a little dance 14 s after she arrives,
const DANCE_GAP = [35, 55];                        // then every 35 to 55 s (never up close)
const DANCE_LENGTH = 6;
const ORDER = 1;                                   // her layers draw after the floor, and before the hearts (2)

// ---------- loading: her pictures and her meshes ----------
export async function loadAgi1_2D({ renderer, base = '/models/agi1-2d/', onProgress = () => {} }) {
  const files = [...new Set([...Object.values(RIG.layers).map((l) => l.file), RIG.atlas.file])];
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => onProgress(Math.min(0.99, loaded / total));
  const loader = new THREE.TextureLoader(manager);
  const tex = {};
  await Promise.all(files.map((f) => loader.loadAsync(base + f).then((t) => { tex[f] = t; })));
  const aniso = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() || 1);
  for (const t of Object.values(tex)) {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
  }
  return buildPuppet(tex);
}

// Which grid cells of a layer have any paint in them (so the mesh only covers her, not the empty corners)
function occupancy(image, cw, ch) {
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(image, 0, 0, cw, ch);
  const d = g.getImageData(0, 0, cw, ch).data;
  const occ = new Uint8Array(cw * ch);
  for (let i = 0; i < cw * ch; i++) if (d[i * 4 + 3] > 0) occ[i] = 1;
  // one more cell around the paint, so edges never fall outside the mesh
  const grown = occ.slice();
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    if (!occ[y * cw + x]) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < cw && yy < ch) grown[yy * cw + xx] = 1;
    }
  }
  return grown;
}

// A grid mesh over a box (art pixels), only where `occ` says so (all of it without `occ`). `refine` ({ x, y, r, sub }):
// finer cells (each cell cut into sub × sub) within r of (x, y), where the picture bends most (her elbows)
function gridGeometry(box, sp, occ, uvOf, refine = null) {
  const cw = Math.max(1, Math.ceil(box.w / sp)), ch = Math.max(1, Math.ceil(box.h / sp));
  const sub = refine ? refine.sub : 1, fs = sp / sub, fw = cw * sub + 1;
  const id = new Map();
  const P = [], U = [], I = [];
  const vert = (fx, fy) => {                          // a corner on the fine grid
    const k = fy * fw + fx;
    let i = id.get(k);
    if (i === undefined) {
      i = P.length / 2;
      id.set(k, i);
      const x = box.x + Math.min(fx * fs, box.w), y = box.y + Math.min(fy * fs, box.h);
      P.push(x, y);
      const [u, v] = uvOf(x, y);
      U.push(u, v);
    }
    return i;
  };
  const cell = (fx, fy, n) => {
    const a = vert(fx, fy), b = vert(fx + n, fy), c = vert(fx, fy + n), d = vert(fx + n, fy + n);
    I.push(a, c, b, b, c, d);
  };
  for (let gy = 0; gy < ch; gy++) for (let gx = 0; gx < cw; gx++) {
    if (occ && !occ[gy * cw + gx]) continue;
    if (refine && Math.hypot(box.x + (gx + 0.5) * sp - refine.x, box.y + (gy + 0.5) * sp - refine.y) < refine.r) {
      for (let j = 0; j < sub; j++) for (let i = 0; i < sub; i++) cell(gx * sub + i, gy * sub + j, 1);
    } else cell(gx * sub, gy * sub, sub);
  }
  const n = P.length / 2;
  const rest = new Float32Array(P);
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = rest[i * 2]; pos[i * 3 + 1] = rest[i * 2 + 1]; }
  const attr = new THREE.BufferAttribute(pos, 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', attr);
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(U), 2));
  g.setAttribute('aArt', new THREE.BufferAttribute(rest.slice(), 2));   // where each corner sits on her picture
  g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(I, 1) : new THREE.Uint16BufferAttribute(I, 1));
  return { g, rest, n };
}

const layerUV = (box) => (x, y) => [(x - box.x) / box.w, 1 - (y - box.y) / box.h];
const atlasUV = (f) => (x, y) => {
  const S = RIG.atlas.size;
  return [(f.a[0] + (x - f.x)) / S, 1 - (f.a[1] + (y - f.y)) / S];
};

function basicMaterial(map) {
  return new THREE.MeshBasicMaterial({
    map, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
  });
}

// her arms: each arm's picture is drawn twice, each copy keeping its own side of the crease inside her elbow (see
// elbowInner in agi1-2d-motion.js). `aSide`: how far each corner is from the crease's line (≥ 0 on her upper arm's side).
// The two copies are cut exactly along the same line, so nothing is drawn twice and nothing is missing.
function armMaterial(map, upper) {
  return new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    uniforms: { uMap: { value: map } },
    vertexShader: /* glsl */`
      attribute float aSide;
      varying vec2 vUv;
      varying float vSide;
      void main() { vUv = uv; vSide = aSide; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap;
      varying vec2 vUv;
      varying float vSide;
      void main() {
        if (${upper ? 'vSide < 0.0' : 'vSide >= 0.0'}) discard;
        gl_FragColor = texture2D(uMap, vUv);
        #include <colorspace_fragment>
      }`,
  });
}

// ---------- her eyes, mouth and blush are drawn by small shaders (sharp at any zoom) ----------
const CURVE_GLSL = /* glsl */`
  float curveAt(float arr[9], float x0, float x1, float x) {
    float t = clamp((x - x0) / (x1 - x0), 0.0, 1.0) * 8.0;
    float y = arr[0];
    for (int k = 0; k < 8; k++) { if (t >= float(k)) y = mix(arr[k], arr[k + 1], clamp(t - float(k), 0.0, 1.0)); }
    return y;
  }`;
const VERT = /* glsl */`
  attribute vec2 aArt;
  varying vec2 vArt;
  void main() { vArt = aArt; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

function eyeMaterial(atlas, side) {
  const e = RIG.eyes[side], w = RIG.features[`eye${side}_white`], i = RIG.features[`eye${side}_iris`];
  return new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    uniforms: {
      uAtlas: { value: atlas }, uSize: { value: RIG.atlas.size },
      uWhite: { value: new THREE.Vector4(w.a[0], w.a[1], w.w, w.h) }, uIris: { value: new THREE.Vector4(i.a[0], i.a[1], i.w, i.h) },
      uBox: { value: new THREE.Vector4(w.x, w.y, w.w, w.h) },
      uIrisC: { value: new THREE.Vector2(e.iris[0], e.iris[1]) }, uIrisOff: { value: new THREE.Vector2() }, uIrisScale: { value: 1 },
      uTop: { value: e.top.slice() }, uBot: { value: e.bot.slice() }, uRange: { value: new THREE.Vector2(e.x0, e.x1) },
      uOpacity: { value: 1 },
    },
    vertexShader: VERT,
    fragmentShader: /* glsl */`
      uniform sampler2D uAtlas; uniform float uSize; uniform vec4 uWhite, uIris, uBox;
      uniform vec2 uIrisC, uIrisOff, uRange; uniform float uIrisScale, uOpacity;
      uniform float uTop[9]; uniform float uBot[9];
      varying vec2 vArt;
      ${CURVE_GLSL}
      vec4 piece(vec4 rect, vec2 art) {
        vec2 q = art - uBox.xy;
        if (q.x < 0.0 || q.y < 0.0 || q.x > uBox.z || q.y > uBox.w) return vec4(0.0);
        vec2 px = rect.xy + q;
        return texture2D(uAtlas, vec2(px.x / uSize, 1.0 - px.y / uSize));
      }
      void main() {
        vec4 white = piece(uWhite, vArt);
        vec4 iris = piece(uIris, (vArt - uIrisC - uIrisOff) / uIrisScale + uIrisC);
        float top = curveAt(uTop, uRange.x, uRange.y, vArt.x);
        float bot = curveAt(uBot, uRange.x, uRange.y, vArt.x);
        float aa = max(fwidth(vArt.y) * 0.75, 0.3);
        float m = white.a * smoothstep(top - aa, top + aa, vArt.y) * (1.0 - smoothstep(bot - aa, bot + aa, vArt.y));
        // the shadow her lashes cast on her eye, just under the lid
        float sh = 1.0 - 0.3 * (1.0 - smoothstep(0.0, 3.4, vArt.y - top));
        vec3 col = mix(white.rgb * sh, iris.rgb * mix(1.0, sh, 0.7), iris.a);
        gl_FragColor = vec4(col, m * uOpacity);
        #include <colorspace_fragment>
      }`,
  });
}

// her mouth: a soft line that smiles a little when it's closed (like her painted one), a rounded dark opening when she
// talks (her tongue only when it's wide open), the corners up when she smiles and down when she pouts; her lips a soft
// pink around it. Colors picked from her painted lips.
function mouthMaterial() {
  const c = RIG.mouth.center;
  return new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    uniforms: {
      uC: { value: new THREE.Vector2(c[0], c[1]) },
      uOpen: { value: 0 }, uSmile: { value: 0.18 }, uPout: { value: 0 }, uWide: { value: 0 }, uOpacity: { value: 1 },
    },
    vertexShader: VERT,
    fragmentShader: /* glsl */`
      uniform vec2 uC; uniform float uOpen, uSmile, uPout, uWide, uOpacity;
      varying vec2 vArt;
      float blob(vec2 p, vec2 c, vec2 r) { vec2 q = (p - c) / r; return exp(-dot(q, q) * 1.6); }
      void main() {
        float aa = max(fwidth(vArt.x) * 0.75, 0.18);
        float open = clamp(uOpen, 0.0, 1.0);
        float rnd = max(0.0, -uWide) * smoothstep(0.1, 0.5, open);
        float hw = 14.0 * (1.0 + 0.08 * uWide) * (1.0 - 0.3 * uPout) * (1.0 - 0.12 * open) * (1.0 - 0.28 * rnd);
        vec2 p = vArt - uC;
        float u = p.x / hw, au = min(abs(u), 1.0), bow = 1.0 - au * au;
        // her resting mouth smiles a little: the corners up (a frown or a pout brings them down)
        float lift = (uSmile >= 0.0 ? 1.1 + 2.4 * uSmile : 1.1 + 3.4 * uSmile) - 1.3 * uPout;
        float lineY = -lift * au * au;
        float h = open * (10.0 + 4.5 * rnd - 2.0 * max(0.0, uWide));
        float top = lineY - h * 0.16 * pow(bow, 0.9);
        float bot = lineY + h * 0.84 * pow(bow, 0.55);
        float edge = step(abs(u), 1.0);
        float inside = min(min(p.y - top, bot - p.y), (1.0 - abs(u)) * hw);
        float mIn = smoothstep(-aa, aa, inside) * step(0.015, open);
        // her lips: a soft pink, the lower one fuller, with a little light on it
        float lips = blob(p, vec2(0.0, bot + 3.0), vec2(hw * 0.58, 2.3)) * 0.42 + blob(p, vec2(0.0, top - 1.9), vec2(hw * 0.62, 1.4)) * 0.14;
        vec4 o = vec4(vec3(0.94, 0.6, 0.6), lips);
        float shine = blob(p, vec2(-hw * 0.12, bot + 3.4), vec2(1.7, 0.9)) * 0.35 * (1.0 - 0.5 * open);
        o = mix(o, vec4(vec3(1.0, 0.92, 0.9), 1.0), shine);
        // inside: dark at the top, warmer lower down; her tongue when it's quite open
        float depth = clamp((p.y - top) / max(bot - top, 0.01), 0.0, 1.0);
        vec3 inner = mix(vec3(0.27, 0.07, 0.1), vec3(0.5, 0.16, 0.2), depth);
        vec2 tq = vec2(p.x / (hw * 0.56), (p.y - (bot - h * 0.2)) / max(h * 0.32, 0.01));
        inner = mix(inner, vec3(0.86, 0.45, 0.5), smoothstep(1.0, 0.72, length(tq)) * smoothstep(0.35, 0.6, open) * 0.9);
        o = mix(o, vec4(inner, 1.0), mIn);
        // the line of her mouth (its upper edge when open): thin in the middle, a little heavier toward the corners,
        // fading out at the very ends; and small darker corners
        float half_ = 0.52 + 0.3 * au * au;
        float line = (1.0 - smoothstep(half_ - aa, half_ + aa, abs(p.y - top))) * smoothstep(1.1, 0.88, abs(u));
        float lower = (1.0 - smoothstep(0.35 - aa, 0.35 + aa, abs(p.y - bot))) * edge * smoothstep(0.02, 0.2, open) * 0.5;
        float corners = 0.0;
        for (int s = -1; s <= 1; s += 2) corners = max(corners, 1.0 - smoothstep(0.5, 1.0, length(p - vec2(float(s) * hw, -lift))));
        float la = max(max(line * 0.92, corners * 0.7), lower);
        o = mix(o, vec4(vec3(0.64, 0.29, 0.3) * (1.0 - 0.3 * open), 1.0), la);
        // (colors are written as they are: this material skips the linear-to-sRGB step on purpose)
        gl_FragColor = vec4(o.rgb, o.a * uOpacity);
      }`,
  });
}

function blushMaterial(center) {
  return new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
    uniforms: { uC: { value: new THREE.Vector2(center[0], center[1]) }, uBlush: { value: 0 } },
    vertexShader: VERT,
    fragmentShader: /* glsl */`
      uniform vec2 uC; uniform float uBlush; varying vec2 vArt;
      void main() {
        float aa = max(fwidth(vArt.x) * 0.8, 0.25);
        vec2 d = (vArt - uC) / vec2(15.0, 8.6);
        float glow = exp(-dot(d, d) * 1.7) * 0.5 * uBlush;
        // three little strokes when she really blushes
        float strokes = 0.0;
        for (int k = -1; k <= 1; k++) {
          vec2 a = uC + vec2(float(k) * 4.2 - 1.4, 2.1), b = uC + vec2(float(k) * 4.2 + 1.4, -2.1);
          vec2 pa = vArt - a, ba = b - a;
          float t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
          strokes = max(strokes, 1.0 - smoothstep(0.45 - aa, 0.45 + aa, length(pa - ba * t)));
        }
        strokes *= clamp((uBlush - 0.55) * 1.8, 0.0, 1.0);
        vec3 col = mix(vec3(1.0, 0.42, 0.52), vec3(0.87, 0.3, 0.41), strokes);
        gl_FragColor = vec4(col, max(glow, strokes * 0.85));
      }`,
  });
}

// ---------- the puppet ----------
function buildPuppet(tex) {
  const holder = new THREE.Group();          // moved by the stage (switching in and out)
  const fx = new THREE.Group();              // hops and squashes
  const art = new THREE.Group();             // art pixels → world: she stands on the floor, facing you
  art.scale.set(K, -K, K);
  art.position.set(-512 * K, RIG.feet * K, 0);
  holder.add(fx);
  fx.add(art);
  const atlas = tex[RIG.atlas.file];
  const layers = {};
  let order = 0;
  const addMesh = (name, geo, material) => {
    const mesh = new THREE.Mesh(geo.g, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = ORDER + (order++) / 100;
    art.add(mesh);
    layers[name] = { name, mesh, rest: geo.rest, n: geo.n, pos: geo.g.attributes.position };
    return layers[name];
  };
  const layer = (name) => {
    const L = RIG.layers[name], t = tex[L.file];
    const cw = Math.ceil(L.w / L.grid), ch = Math.ceil(L.h / L.grid);
    return addMesh(name, gridGeometry(L, L.grid, occupancy(t.image, cw, ch), layerUV(L)), basicMaterial(t));
  };
  const feature = (name, box, sp, material) => addMesh(name, gridGeometry(box, sp, null, atlasUV(RIG.features[name] || { a: [0, 0], x: 0, y: 0 })), material);
  // her arms: each one picture, drawn twice (her upper arm's side of her elbow's crease, then her forearm's), with finer
  // cells around her elbow, where it bends round
  const arm = (s) => {
    const Lr = RIG.layers['arm' + s], t = tex[Lr.file], el = RIG.joints['arm' + s].el;
    const occ = occupancy(t.image, Math.ceil(Lr.w / Lr.grid), Math.ceil(Lr.h / Lr.grid));
    for (const part of ['u', 'f']) {
      const geo = gridGeometry(Lr, Lr.grid, occ, layerUV(Lr), { x: el[0], y: el[1], r: 64, sub: 2 });
      const side = new THREE.BufferAttribute(new Float32Array(geo.n), 1);
      side.setUsage(THREE.DynamicDrawUsage);
      geo.g.setAttribute('aSide', side);
      addMesh(`arm${s}_${part}`, geo, armMaterial(t, part === 'u')).side = side;
    }
  };
  layer('backHair');
  layer('body');
  arm('L'); arm('R');
  layer('face');
  for (const s of ['L', 'R']) {
    const c = RIG.cheeks[s];
    addMesh('blush' + s, gridGeometry({ x: c[0] - 22, y: c[1] - 12, w: 44, h: 24 }, 11, null, () => [0, 0]), blushMaterial(c));
  }
  for (const s of ['L', 'R']) {
    const f = RIG.features[`eye${s}_white`];
    addMesh('eye' + s, gridGeometry(f, 6, null, () => [0, 0]), eyeMaterial(atlas, s));
  }
  for (const s of ['L', 'R']) feature(`eye${s}_lashD`, RIG.features[`eye${s}_lashD`], 5, basicMaterial(atlas));
  for (const s of ['L', 'R']) feature(`eye${s}_lashU`, RIG.features[`eye${s}_lashU`], 4, basicMaterial(atlas));
  for (const s of ['L', 'R']) feature(`brow${s}`, RIG.features[`brow${s}`], 6, basicMaterial(atlas));
  const mc = RIG.mouth.center;
  addMesh('mouth', gridGeometry({ x: mc[0] - 30, y: mc[1] - 14, w: 60, h: 34 }, 10, null, () => [0, 0]), mouthMaterial());
  layer('frontHair');

  // markers the stage frames her by (like the 3D model's bones)
  const marker = (name) => { const o = new THREE.Object3D(); o.name = name; art.add(o); return o; };
  const marks = {
    head: marker('head'), headTop: marker('headTop'), chest: marker('chest'),
    hands: ['L', 'R'].map((s) => [marker(`wrist${s}`), marker(`tip${s}`), marker(`elbow${s}`)]),
  };
  // an invisible box around her, for taps
  const hitBox = new THREE.Mesh(new THREE.BoxGeometry(0.56, HEIGHT, 0.24), new THREE.MeshBasicMaterial());
  hitBox.visible = false;
  hitBox.position.y = HEIGHT / 2;
  fx.add(hitBox);
  return {
    kind: 'agi1_2d', holder, fx, root: art, art, layers, marks, hitBox, mixer: null,
    focusBones: [marks.head, marks.headTop],
    dispose() {
      for (const L of Object.values(layers)) { L.mesh.geometry.dispose(); L.mesh.material.dispose(); }
      for (const t of Object.values(tex)) t.dispose();
    },
  };
}

// ---------- her rig: how each corner of each layer follows her joints ----------
const J = RIG.joints;
// a point of her arm at rest: its angle around her elbow, how much her shoulder turns it (0 at the top of her sleeve),
// how much of her upper arm's shortening moves it (1 from near her elbow on), how much her hand turns it
function armRest(A, j, x, y, out) {
  out.alpha = wrapAngle(A.sg * (Math.atan2(y - j.el[1], x - j.el[0]) - A.Af), A.beta0);
  const d = (x - j.sh[0]) * A.ux + (y - j.sh[1]) * A.uy;
  out.wS = smoothstep(-38, 26, d);
  out.k = clamp((d + 10) / (A.ul - 40), 0, 1);
  out.wW = smoothstep(-8, 12, (x - j.wr[0]) * A.fx + (y - j.wr[1]) * A.fy);
  return out;
}
function prepare(model) {
  const L = model.layers;
  const V = {};
  // her body: legs stay on the floor, hips, waist and chest bend a little, her neck follows her head at the top
  {
    const b = L.body, n = b.n, W = new Float32Array(n * 5), zb = new Float32Array(n), cw = new Float32Array(n);
    for (let v = 0; v < n; v++) {
      const x = b.rest[v * 2], y = b.rest[v * 2 + 1];
      let w = [0, 0, 0, 0, 0];                    // root, pelvis, spine, neck, head
      if (y < 300) {
        const toNeck = smoothstep(300, 262, y), toHead = smoothstep(250, 196, y) * 0.75;
        w = [0, 0, 1 - toNeck, toNeck * (1 - toHead), toNeck * toHead];
      } else if (y < 560) w = [0, 0, 1, 0, 0];
      else if (y < 640) { const t = smoothstep(560, 640, y); w = [0, t, 1 - t, 0, 0]; }
      else { const t = smoothstep(700, 1280, y); w = [t, 1 - t, 0, 0, 0]; }
      W.set(w, v * 5);
      // her chest is rounder than her sides: it moves a little more when her body turns
      if (y > 290 && y < 620) zb[v] = 36 * Math.sqrt(Math.max(0, 1 - ((x - 512) / 150) ** 2)) * smoothstep(290, 360, y) * smoothstep(620, 540, y);
      // how much this point moves with her chest's follow-through (0 for most of her body)
      cw[v] = chestWeight(x, y, RIG.chest);
    }
    V.body = { W, zb, cw };
  }
  // arms: for each corner, its angle around her elbow (elbowOuter / elbowInner), how far along her upper arm it is (the
  // top of her sleeve blends into her shoulder; her upper arm gets shorter when it comes toward you) and how much it turns
  // with her hand at the wrist. Her arms mirror each other: sg = 1 for her right arm (on the left of the picture), -1 for
  // her left.
  for (const s of ['L', 'R']) {
    const j = J['arm' + s], sg = s === 'L' ? 1 : -1, Lr = L[`arm${s}_u`];
    const ux = j.el[0] - j.sh[0], uy = j.el[1] - j.sh[1], ul = Math.hypot(ux, uy);
    const fx = j.wr[0] - j.el[0], fy = j.wr[1] - j.el[1], fl = Math.hypot(fx, fy);
    const Af = Math.atan2(fy, fx);
    const A = {
      sg, Af, ul, ux: ux / ul, uy: uy / ul, fx: fx / fl, fy: fy / fl,
      beta0: wrapAngle(sg * (Math.atan2(-uy, -ux) - Af), Math.PI * 2),     // the inside angle of her elbow at rest
    };
    const n = Lr.n, rs = {};
    A.alpha = new Float32Array(n); A.wS = new Float32Array(n); A.wW = new Float32Array(n); A.k = new Float32Array(n);
    for (let v = 0; v < n; v++) {
      armRest(A, j, Lr.rest[v * 2], Lr.rest[v * 2 + 1], rs);
      A.alpha[v] = rs.alpha; A.wS[v] = rs.wS; A.wW[v] = rs.wW; A.k[v] = rs.k;
    }
    // the stage's markers: her wrist, fingertips and elbow
    A.marks = [j.wr, j.tip, j.el].map(([x, y]) => ({ x, y, ...armRest(A, j, x, y, {}) }));
    V['arm' + s] = A;
  }
  // her face and everything on it: how far in front of the middle of her head each corner is
  const depthOf = (Lr, extra) => {
    const z = new Float32Array(Lr.n);
    for (let v = 0; v < Lr.n; v++) z[v] = faceDepth(Lr.rest[v * 2], Lr.rest[v * 2 + 1]) + extra;
    return z;
  };
  V.face = depthOf(L.face, 0);
  for (const name of ['blushL', 'blushR', 'eyeL', 'eyeR', 'eyeL_lashD', 'eyeR_lashD', 'eyeL_lashU', 'eyeR_lashU', 'browL', 'browR', 'mouth']) V[name] = depthOf(L[name], 1);
  // hair: the roots follow her head (in front of her face, or behind it), the ends her body, with springs in between
  const hairPrep = (Lr, def, depth) => {
    const n = Lr.n, z = new Float32Array(n), sf = new Float32Array(n);
    const ca = new Uint8Array(n), wb = new Float32Array(n), seg = new Uint8Array(n), fr = new Float32Array(n);
    const xs = def.xs;
    for (let v = 0; v < n; v++) {
      const x = Lr.rest[v * 2], y = Lr.rest[v * 2 + 1];
      sf[v] = smoothstep(def.follow[0], def.follow[1], y);
      z[v] = depth(x, y) * (1 - sf[v]);
      let j = 0;
      while (j < xs.length - 2 && x > xs[j + 1]) j++;
      ca[v] = j;
      wb[v] = xs.length > 1 ? smoothstep(0, 1, (x - xs[j]) / (xs[j + 1] - xs[j])) : 0;
      const u = clamp((y - def.y0) / (def.y1 - def.y0), 0, 1) * (def.n - 1);
      seg[v] = Math.min(def.n - 2, Math.floor(u));
      fr[v] = u - seg[v];
    }
    return { z, sf, ca, wb, seg, fr, def, depth };
  };
  V.backHair = hairPrep(L.backHair, RIG.hair.back, () => -18);
  V.frontHair = hairPrep(L.frontHair, RIG.hair.front, (x, y) => faceDepth(x, y) + 7);   // just in front of her face
  return V;
}

// A chain of springs: one lock of hair
class Chain {
  constructor(x, def, stiff, prep) {
    this.x = x; this.def = def; this.n = def.n; this.prep = prep;
    const n = this.n;
    this.ry = new Float32Array(n); this.sf = new Float32Array(n); this.z = new Float32Array(n); this.k = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1), y = def.y0 + (def.y1 - def.y0) * u;
      this.ry[i] = y;
      this.sf[i] = smoothstep(def.follow[0], def.follow[1], y);
      this.z[i] = prep.depth(x, y) * (1 - this.sf[i]);
      this.k[i] = lerp(stiff.k0, stiff.k1, Math.pow(u, 0.7));
    }
    Object.assign(this, { kc: stiff.kc, zeta: stiff.zeta, maxX: stiff.maxX, maxY: stiff.maxY, wind: stiff.wind, seed: Math.random() * 100 });
    this.X = new Float32Array(2 * n); this.Vv = new Float32Array(2 * n); this.T = new Float32Array(2 * n); this.O = new Float32Array(2 * n);
    this.ready = false;
  }
}

// ---------- the controller ----------
export function createAgi1_2D(model, { camera, effects, reducedMotion = false, onGlow = () => {} }) {
  const L = model.layers;
  const V = prepare(model);
  const RM = reducedMotion;
  const drift = Array.from({ length: 12 }, (_, i) => makeDrift(i * 7.31 + 1.7));
  const tmp = [0, 0], tmp2 = [0, 0];

  // hair chains
  const backStiff = { k0: 320, k1: 16, kc: 58, zeta: 0.34, maxX: 46, maxY: 12, wind: 190 };
  const frontStiff = { k0: 520, k1: 36, kc: 80, zeta: 0.4, maxX: 24, maxY: 6, wind: 110 };
  const chains = {
    backHair: RIG.hair.back.xs.map((x) => new Chain(x, RIG.hair.back, backStiff, V.backHair)),
    frontHair: RIG.hair.front.xs.map((x) => new Chain(x, RIG.hair.front, frontStiff, V.frontHair)),
  };
  const push = { x: 0, y: 0 };                         // a push on her hair from her whole body moving (a hop), art px/s²
  const jig = new Jiggle();                            // her chest's soft follow-through (art px)
  const chestAt = [0, 0];

  // ---------- her pose: every joint follows its target like a real body part ----------
  const F = {
    headYaw: new Follow(0, 1.35, 0.82, 0.25), headPitch: new Follow(0, 1.35, 0.85, 0.2), headRoll: new Follow(0, 1.1, 0.8, 0),
    bodyYaw: new Follow(0, 0.7, 0.9, 0), pelvisRoll: new Follow(0, 0.8, 0.8, 0), spineRoll: new Follow(0, 0.9, 0.75, 0),
    rootX: new Follow(0, 0.6, 0.9, 0), rootY: new Follow(0, 3, 0.7, 0), shrug: new Follow(0, 2.2, 0.8, 0),
    eyeX: new Follow(0, 7.5, 1, 0), eyeY: new Follow(0, 7.5, 1, 0),
    // arms: a little bounce, the forearm and hand trailing behind (overlapping action)
    shL: new Follow(0, 2.1, 0.62, 0.1), elL: new Follow(0, 2.8, 0.52, 0), wrL: new Follow(0, 3.6, 0.42, 0), scL: new Follow(1, 2, 1, 0),
    shR: new Follow(0, 2.1, 0.62, 0.1), elR: new Follow(0, 2.8, 0.52, 0), wrR: new Follow(0, 3.6, 0.42, 0), scR: new Follow(1, 2, 1, 0),
  };
  const P = {};                                          // this frame's pose
  for (const k in F) P[k] = F[k].y;

  // ---------- state ----------
  let clock = 0, closeUp = false, attention = 'idle';
  const look = { pointer: null, awayUntil: 0, away: { yaw: 0, pitch: 0, ex: 0, ey: 0 }, atViewerUntil: 0 };
  const sacc = { x: 0, y: 0, next: 0.6 };
  const talk = { level: 0, open: 0, slow: 0, env: 0, t: 0, wide: new Follow(0, 7, 1, 0), wideTo: 0, was: 0 };
  const blink = { t: -1, next: 1.2 + Math.random() * 2 };
  let blinkAmt = 0;
  // expressions: the same moods and faces as the 3D AGI-1 (src/stage/agi1.js), plus her brows
  const FACES = {
    calm: { smile: 0.18 },
    listening: { smile: 0.34, squint: 0.1, browUp: 0.15 },
    thinking: { smile: -0.06, pout: 0.25, squint: 0.2, lids: 0.22, browUp: 0.3, browAng: 0.25 },
    dancing: { smile: 0.75, squint: 0.35, grin: 0.2, browUp: 0.2 },
    neutral: { smile: 0.18 },
    happy: { smile: 1, squint: 0.55, blush: 0.3, grin: 0.35, pulse: 1.1, browUp: 0.35 },
    love: { smile: 0.72, squint: 0.3, blush: 0.95, lids: 0.3, grin: 0.12, pulse: 0.9, after: 0.8, browUp: 0.2, browAng: 0.35 },
    shy: { smile: 0.3, blush: 1, lids: 0.5, browUp: 0.1, browAng: 0.6 },
    wave: { smile: 0.85, squint: 0.3, grin: 0.28, pulse: 0.7, browUp: 0.35 },
    jealous: { smile: -0.5, pout: 1, squint: 0.25, lids: 0.25, blush: 0.3, browUp: -0.35, browAng: -0.8 },
    celebrate: { smile: 1, squint: 0.6, blush: 0.45, grin: 0.45, pulse: 1.4, browUp: 0.5 },
    sad: { smile: -0.9, pout: 0.35, lids: 0.42, browUp: 0.2, browAng: 1 },
    okay: { smile: 0.55, squint: 0.2, browUp: 0.1 },
    hmm: { smile: 0.05, pout: 0.55, squint: 0.3, lids: 0.12, browUp: 0.25, browAng: -0.25, browTilt: 0.5 },
    worried: { smile: -0.55, pout: 0.2, lids: 0.18, browUp: 0.3, browAng: 0.9 },
  };
  const EXPR_KEYS = ['smile', 'pout', 'squint', 'blush', 'lids', 'grin', 'browUp', 'browAng', 'browTilt'];
  const expr = { mood: null, until: 0, pulseFrom: 0, pulseUntil: 0, happy: 0 };
  for (const k of EXPR_KEYS) expr[k] = FACES.calm[k] || 0;
  // body moves
  const act = { wave: -1, waveNear: 0, hop: -1, sway: -1, nod: -1, shake: -1, hmm: -1, cheer: -1 };
  let dancing = false, danceT = 0, nextDance = FIRST_DANCE_AFTER, danceW = 0;
  let lastFxY = 0, lastFxV = 0;

  function setMood(mood) {
    const f = FACES[mood];
    if (!f) return;
    expr.mood = mood === 'neutral' ? null : mood;
    expr.until = clock + 4.5;
    expr.pulseFrom = clock + (RM ? 0 : f.after || 0);
    expr.pulseUntil = f.pulse ? expr.pulseFrom + f.pulse : 0;
  }
  function applyExpression(dt) {
    if (expr.mood && talk.env > 0.05) expr.until = Math.max(expr.until, clock + 2.5);   // it holds while she talks
    if (expr.mood && clock >= expr.until) expr.mood = null;
    const rest = dancing ? 'dancing' : attention === 'listening' || attention === 'thinking' ? attention : 'calm';
    const want = FACES[expr.mood || rest];
    for (const k of EXPR_KEYS) {
      const to = want[k] || 0;
      expr[k] += (to - expr[k]) * (1 - Math.exp(-dt * (Math.abs(to) > Math.abs(expr[k]) ? 9 : 2.5)));
    }
    expr.happy += ((clock >= expr.pulseFrom && clock < expr.pulseUntil ? 1 : 0) - expr.happy) * (1 - Math.exp(-dt * 14));
  }

  // ---------- where she looks ----------
  const vHead = new THREE.Vector3();
  function lookTargets() {
    // from the pointer (or the chat box) to her head, on the screen
    let dx = 0, dy = 0;
    if (clock < look.atViewerUntil || !look.pointer) { dx = 0; dy = 0; }
    else {
      model.marks.head.getWorldPosition(vHead).project(camera);
      dx = clamp(look.pointer.x, -3, 3) - vHead.x;
      dy = clamp(look.pointer.y, -3, 3) - vHead.y;
    }
    const aspect = camera.aspect || 1;
    let yaw = clamp(dx * 0.42 * Math.min(aspect, 1.6), -0.55, 0.55);      // radians before the limits below
    let pitch = clamp(-dy * 0.3, -0.45, 0.45);
    let ex = clamp(dx * 1.1 * Math.min(aspect, 1.6), -1, 1), ey = clamp(-dy * 0.9, -1, 1);
    if (clock < look.awayUntil) ({ yaw, pitch, ex, ey } = look.away);
    return { yaw, pitch, ex, ey };
  }

  // ---------- one frame ----------
  function update(dt) {
    if (!(dt > 0)) return;
    clock += dt;
    const mo = RM ? 0.45 : 1;                          // how much she drifts
    applyExpression(dt);
    // blinking (and a blink when her attention shifts or her eyes jump far)
    if (blink.t < 0 && clock >= blink.next) blink.t = 0;
    if (blink.t >= 0) {
      blink.t += dt;
      blinkAmt = blinkAmount(blink.t);
      if (blink.t >= blinkLength()) { blink.t = -1; blinkAmt = 0; blink.next = clock + nextBlinkGap(); }
    }
    // talking: her mouth opens with each syllable, a new shape each time; her head nods on the louder words
    talk.open = mouthStep(talk.open, talk.level, dt);
    const on = talk.level > 0.05 ? 1 : 0;
    talk.env += (on - talk.env) * (1 - Math.exp(-dt * (on ? 5 : 1.4)));
    talk.slow += (talk.level - talk.slow) * (1 - Math.exp(-dt * 4));
    talk.t = talk.env > 0.001 ? talk.t + dt : 0;
    if (talk.level > 0.16 && talk.was <= 0.09) talk.wideTo = -0.5 + Math.random() * 1.2;   // a new syllable
    if (talk.level < 0.09) talk.wideTo *= 0.9;
    talk.was = talk.level;
    const wide = talk.wide.step(dt, talk.wideTo);

    // ---------- saccades: her eyes jump a little, now and then ----------
    if (clock >= sacc.next) {
      const far = Math.random() < 0.3;
      sacc.x = far ? 0 : (Math.random() - 0.5) * 0.5;
      sacc.y = far ? 0 : (Math.random() - 0.5) * 0.3;
      sacc.next = clock + 0.7 + Math.random() * 2.2;
    }
    const lt = lookTargets();
    const tg = {};
    const t = clock;
    // her head: where she looks, a slow drift, and the chat's attention
    const tilt = attention === 'thinking' ? 7 : attention === 'listening' ? -4 : 0;
    const w1 = Math.sin(talk.t * Math.PI * 2 * 0.9), w2 = Math.sin(talk.t * Math.PI * 2 * 0.37), w3 = Math.sin(talk.t * Math.PI * 2 * 0.23 + 1);
    tg.headYaw = lt.yaw * 0.62 + mo * 0.07 * drift[0](t * 0.13) + talk.env * 0.03 * w3;
    tg.headPitch = lt.pitch * 0.55 + mo * 0.045 * drift[1](t * 0.11) + talk.slow * 0.06 + talk.env * 0.018 * w1;
    tg.headRoll = tilt + mo * 2.6 * drift[2](t * 0.09) + talk.env * 1.8 * w2 - lt.yaw * 6;
    tg.eyeX = clamp(lt.ex + (look.pointer && clock >= look.atViewerUntil ? sacc.x * 0.3 : sacc.x), -1, 1);
    tg.eyeY = clamp(lt.ey + (look.pointer && clock >= look.atViewerUntil ? sacc.y * 0.3 : sacc.y), -1, 1);
    // her body: follows her head a little, sways slowly, shifts her weight
    tg.bodyYaw = F.headYaw.y * 0.35 + mo * 0.03 * drift[3](t * 0.07);
    tg.pelvisRoll = mo * 0.9 * drift[4](t * 0.08);
    tg.spineRoll = mo * 1.2 * drift[5](t * 0.1);
    tg.rootX = mo * 3 * drift[6](t * 0.06);
    tg.rootY = 0;
    tg.shrug = 0;
    // her arms hang and swing back when her body sways (gravity), with a little life of their own
    const bodyTurn = F.pelvisRoll.y + F.spineRoll.y;
    tg.shL = -bodyTurn * 0.8 + mo * 1.3 * drift[7](t * 0.21); tg.elL = mo * 1.4 * drift[8](t * 0.23); tg.wrL = 0; tg.scL = 1;
    tg.shR = -bodyTurn * 0.8 + mo * 1.3 * drift[9](t * 0.19); tg.elR = -mo * 1.4 * drift[10](t * 0.2); tg.wrR = 0; tg.scR = 1;

    // ---------- the reactions, on top ----------
    applyMoves(dt, tg);
    // the limits, so she never turns too far
    tg.headYaw = clamp(tg.headYaw, -0.18, 0.18);       // about 10°: past that, flat art starts to show its seams
    tg.headPitch = clamp(tg.headPitch, -0.12, 0.14);
    tg.headRoll = clamp(tg.headRoll, -11, 11);
    for (const k in F) P[k] = F[k].step(dt, tg[k]);
    // a big jump of her eyes brings a blink now and then, as with people
    if (Math.abs(tg.eyeX - P.eyeX) > 0.55 && blink.t < 0 && Math.random() < 0.02 * 60 * dt) blink.next = clock;

    // breathing: a little slower than one breath every 4 s, quicker while she talks
    const breath = 0.5 - 0.5 * Math.cos((Math.PI * 2 * clock) / (talk.env > 0.3 ? 3.4 : 4.3));
    pose(breath);
    deform(dt);
    face(wide);
    markers();
    body3D(dt);
  }

  // ---------- reactions (body) ----------
  const ease = (x) => x * x * (3 - 2 * x);
  function applyMoves(dt, tg) {
    // the wave: her right arm (on the left of the picture): the elbow out, the forearm up, the open hand by her head,
    // swinging from the elbow, the hand trailing behind. Up close (the chat, zoomed in) a smaller, video-call wave.
    if (act.wave >= 0) {
      act.wave += dt;
      const a = act.wave;
      act.waveNear += ((closeUp ? 1 : 0) - act.waveNear) * (1 - Math.exp(-dt * 5));
      const n = act.waveNear;
      const up = smoothstep(0.08, 0.5, a) * (1 - smoothstep(2.35, 2.95, a));
      const beat = Math.sin((a - 0.45) * Math.PI * 2 * 1.75) * smoothstep(0.42, 0.62, a) * (1 - smoothstep(2.2, 2.45, a));
      tg.shL = lerp(tg.shL, lerp(46, 22, n) + beat * 2.5, up);
      tg.scL = lerp(1, lerp(1, 0.86, n), up);            // (up close her upper arm comes a little toward you: shorter)
      tg.elL = lerp(tg.elL, lerp(104, 138, n) + beat * lerp(15, 12, n), up);
      tg.wrL = beat * 9 * up;
      tg.spineRoll += 1.4 * up;                        // she leans a little away from her raised arm
      tg.headRoll -= 3 * up;                           // and tilts her head toward her hand
      if (a > 3.1) act.wave = -1;
    }
    // a happy hop (a tap, "happy", "celebrate"): a little crouch first, up, and a soft landing
    if (act.hop >= 0) {
      act.hop += dt;
      const p = act.hop / 0.66;
      if (p >= 1) act.hop = -1;
      else {
        const arms = Math.sin(Math.min(1, p / 0.8) * Math.PI);
        tg.shL += 8 * arms; tg.shR -= 8 * arms;       // her arms lift a little as she jumps
      }
    }
    // "celebrate": both arms up in a little cheer, then down
    if (act.cheer >= 0) {
      act.cheer += dt;
      const e = smoothstep(0, 0.25, act.cheer) * (1 - smoothstep(1.1, 1.6, act.cheer));
      tg.shL += 30 * e; tg.shR -= 30 * e; tg.elL += 55 * e; tg.elR -= 55 * e;
      if (act.cheer > 1.6) act.cheer = -1;
    }
    // "love": a happy sway from side to side (the 3D AGI-1 spins; a flat picture can't)
    if (act.sway >= 0) {
      act.sway += dt;
      const p = act.sway / 1.1;
      if (p >= 1) act.sway = -1;
      else {
        const s = Math.sin(p * Math.PI * 2) * Math.sin(p * Math.PI);
        tg.spineRoll += 6 * s; tg.pelvisRoll -= 2 * s; tg.headRoll -= 7 * s; tg.rootX += 8 * s;
        tg.shL += 6 * Math.abs(s); tg.shR -= 6 * Math.abs(s);
      }
    }
    // nods ('nod', 'okay'), a slow shake of her head ('worried') and a tilt ('hmm')
    if (act.nod >= 0) {
      act.nod += dt;
      if (act.nod >= 0.55) act.nod = -1; else tg.headPitch += Math.sin((act.nod / 0.55) * Math.PI) * 0.11;
    }
    if (act.shake >= 0) {
      act.shake += dt;
      if (act.shake >= 1.4) act.shake = -1;
      else tg.headYaw += Math.sin(act.shake * Math.PI * 2 * 1.5) * 0.12 * Math.sin((act.shake / 1.4) * Math.PI);
    }
    if (act.hmm >= 0) {
      act.hmm += dt;
      if (act.hmm >= 1.9) act.hmm = -1; else tg.headRoll += 8 * Math.sin((act.hmm / 1.9) * Math.PI);
    }
    // shy: shoulders up a little, arms in
    if (clock < look.awayUntil && expr.mood === 'shy') { tg.shrug += 4; tg.shL -= 4; tg.shR += 4; }
    if (expr.mood === 'sad') { tg.shrug -= 3; }
    // her little dance: hips swaying on the beat, a bounce, her head and arms moving with it
    updateDance(dt);
    if (danceW > 0.001) {
      const b = danceT * 1.9;                          // beats (about 114 a minute)
      const w = danceW * (RM ? 0 : 1);
      tg.rootX += w * 12 * Math.sin(Math.PI * b);
      tg.rootY += w * (-7 * (0.5 - 0.5 * Math.cos(Math.PI * 2 * b)));
      tg.pelvisRoll += w * 4 * Math.sin(Math.PI * b);
      tg.spineRoll -= w * 2.5 * Math.sin(Math.PI * b + 0.5);
      tg.headRoll += w * 5 * Math.sin(Math.PI * b + 1.1);
      tg.headPitch += w * 0.05 * Math.sin(Math.PI * 2 * b);
      // her arms swing with her hips, elbows bouncing a little on each beat, shoulders too
      const bounce = 0.5 - 0.5 * Math.cos(Math.PI * 2 * b);
      tg.shL += w * (4 + 7 * Math.sin(Math.PI * b)); tg.elL += w * (10 + 12 * bounce);
      tg.shR -= w * (4 - 7 * Math.sin(Math.PI * b)); tg.elR -= w * (10 + 12 * bounce);
      tg.shrug += w * 3 * bounce;
    }
  }
  function startDance() {
    if (dancing || act.wave >= 0 || RM) return;
    dancing = true; danceT = 0;
  }
  function updateDance(dt) {
    if (dancing) {
      danceT += dt;
      if (danceT >= DANCE_LENGTH) { dancing = false; nextDance = clock + DANCE_GAP[0] + Math.random() * (DANCE_GAP[1] - DANCE_GAP[0]); }
    } else if (act.wave < 0 && !RM && clock >= nextDance) {
      if (closeUp) nextDance = clock + 6; else startDance();
    }
    const want = dancing ? smoothstep(0, 0.6, danceT) * (1 - smoothstep(DANCE_LENGTH - 0.8, DANCE_LENGTH, danceT)) : 0;
    danceW += (want - danceW) * (1 - Math.exp(-dt * 6));
  }

  // hops and squashes move her whole picture (like the 3D model's reactions group, so the live views frame them the same)
  function body3D(dt) {
    let y = 0, squash = 0;
    if (act.hop >= 0 && !RM) {
      const p = act.hop / 0.66;
      if (p < 0.12) squash = -0.035 * Math.sin((p / 0.12) * Math.PI / 2);          // crouch
      else if (p < 0.88) { const q = (p - 0.12) / 0.76; y = Math.sin(q * Math.PI) * 0.12; squash = 0.03 * Math.cos(q * Math.PI); }
      else squash = -0.03 * Math.sin(((p - 0.88) / 0.12) * Math.PI);               // landing
    }
    model.fx.position.y = y;
    model.fx.scale.set(1 - squash * 0.5, 1 + squash, 1);
    // the hop pushes her hair: it lags behind as she goes up, flies up a little as she comes down
    const v = (y - lastFxY) / dt, a = (v - lastFxV) / dt;
    lastFxY = y; lastFxV = v;
    push.y = clamp(a / K, -60000, 60000) * 0.5;       // world units/s² → art px/s² (y down in art: up acceleration pushes hair down)
  }

  // ---------- the pose: each joint's transform ----------
  const M = {
    root: [1, 0, 0, 1, 0, 0], pelvis: [1, 0, 0, 1, 0, 0], spine: [1, 0, 0, 1, 0, 0], neck: [1, 0, 0, 1, 0, 0], head: [1, 0, 0, 1, 0, 0],
    shoulderL: [1, 0, 0, 1, 0, 0], shoulderR: [1, 0, 0, 1, 0, 0],
  };
  const T1 = new Array(6), T2 = new Array(6);
  const bodyYawSin = { v: 0 };
  function pose(breath) {
    translate(P.rootX, P.rootY, M.root);
    mul(M.root, rotAround(J.hip[0], J.hip[1], P.pelvisRoll, T1), M.pelvis);
    mul(M.pelvis, rotAround(J.waist[0], J.waist[1], P.spineRoll, T1), T2);
    mul(T2, scaleAround(J.waist[0], J.waist[1], 1 + 0.0022 * breath, 1 + 0.0042 * breath, T1), M.spine);
    mul(M.spine, rotAround(J.neck[0], J.neck[1], P.headRoll * 0.3, T1), M.neck);
    mul(M.neck, rotAround(J.head[0], J.head[1], P.headRoll * 0.7, T1), M.head);
    bodyYawSin.v = Math.sin(P.bodyYaw);
    for (const s of ['L', 'R']) {
      const j = J['arm' + s], A = V['arm' + s];
      // her shoulders rise a little as she breathes (and when she shrugs)
      mul(M.spine, translate(0, -(1.6 * breath + P.shrug), T1), M['shoulder' + s]);
      // her elbow's bend (from rest, radians; her two arms mirror each other) and the crease's direction once bent
      const [lo, hi] = elbowLimits(A.beta0);
      A.b = clamp(A.sg * P['el' + s] * DEG, lo, hi);
      A.crease = creaseAngle(A.b, A.beta0, RIG.elbows[s]);
      const c = A.Af + A.sg * A.crease;
      A.cx = Math.cos(c); A.cy = Math.sin(c);
      // her upper arm coming toward you looks shorter: her elbow (and all below it) moves up along it
      A.short = (P['sc' + s] - 1) * A.ul;
      A.ex = j.el[0] + A.short * A.ux; A.ey = j.el[1] + A.short * A.uy;
      A.wr = A.sg * P['wr' + s] * DEG;
      A.sh = P['sh' + s] * DEG;
      // (the turns most corners share, worked out once a frame)
      A.cb = Math.cos(A.sg * A.b); A.sb = Math.sin(A.sg * A.b);
      A.cw = Math.cos(A.wr); A.sw = Math.sin(A.wr);
      A.cs = Math.cos(A.sh); A.ss = Math.sin(A.sh);
    }
  }

  // ---------- moving every corner ----------
  function deformBody() {
    const b = L.body, r = b.rest, p = b.pos.array, W = V.body.W, zb = V.body.zb, cw = V.body.cw, sy = bodyYawSin.v;
    const bones = [M.root, M.pelvis, M.spine, M.neck, M.head];
    const jx = jig.x, jy = jig.y;
    for (let v = 0, n = b.n; v < n; v++) {
      const c = cw[v], x = r[v * 2] + zb[v] * sy + c * jx, y = r[v * 2 + 1] + c * jy;
      let X = 0, Y = 0;
      for (let k = 0; k < 5; k++) {
        const w = W[v * 5 + k];
        if (w === 0) continue;
        const m = bones[k];
        X += w * (m[0] * x + m[2] * y + m[4]); Y += w * (m[1] * x + m[3] * y + m[5]);
      }
      p[v * 3] = X; p[v * 3 + 1] = Y;
    }
    b.pos.needsUpdate = true;
  }
  // One point of her arm: her hand turns at the wrist (only her forearm's copy has a hand to turn), everything turns
  // around her elbow (elbowOuter: a round elbow outside; elbowInner: the crease inside), her upper arm gets shorter when it comes
  // toward you, her shoulder turns it all (less toward the top of her sleeve, which stays with her body), and her body
  // carries it. out = [x, y, which side of the crease (≥ 0: her upper arm's)].
  function armPoint(A, j, m, x, y, alpha, wS, wW, k, part, out) {
    if (part === 'fore' && wW > 0 && A.wr !== 0) {
      const c = wW === 1 ? A.cw : Math.cos(A.wr * wW), sn = wW === 1 ? A.sw : Math.sin(A.wr * wW);
      const dx = x - j.wr[0], dy = y - j.wr[1];
      x = j.wr[0] + c * dx - sn * dy; y = j.wr[1] + sn * dx + c * dy;
    }
    let turn, scale = 1;
    if (alpha < 0) { elbowOuter(alpha, A.b, A.beta0, eo); turn = eo.turn; scale = eo.scale; }
    else turn = elbowInner(alpha, A.b, A.beta0, A.crease, part);
    let c, sn;
    if (turn === 0) { c = scale; sn = 0; } else if (turn === A.b) { c = A.cb * scale; sn = A.sb * scale; } else {
      c = Math.cos(A.sg * turn) * scale; sn = Math.sin(A.sg * turn) * scale;
    }
    const dx = x - j.el[0], dy = y - j.el[1];
    x = j.el[0] + c * dx - sn * dy + A.short * k * A.ux;
    y = j.el[1] + sn * dx + c * dy + A.short * k * A.uy;
    out[2] = A.sg * (A.cx * (y - A.ey) - A.cy * (x - A.ex));
    if (wS > 0 && A.sh !== 0) {
      const c2 = wS === 1 ? A.cs : Math.cos(A.sh * wS), s2 = wS === 1 ? A.ss : Math.sin(A.sh * wS);
      const qx = x - j.sh[0], qy = y - j.sh[1];
      x = j.sh[0] + c2 * qx - s2 * qy; y = j.sh[1] + s2 * qx + c2 * qy;
    }
    out[0] = m[0] * x + m[2] * y + m[4]; out[1] = m[1] * x + m[3] * y + m[5];
    return out;
  }
  const aP = [0, 0, 0], eo = { turn: 0, scale: 1 };
  function deformArm(s) {
    const A = V['arm' + s], j = J['arm' + s], m = M['shoulder' + s];
    for (const part of ['upper', 'fore']) {
      const Lr = L[`arm${s}_${part === 'upper' ? 'u' : 'f'}`], r = Lr.rest, p = Lr.pos.array, sd = Lr.side.array;
      for (let v = 0, n = Lr.n; v < n; v++) {
        armPoint(A, j, m, r[v * 2], r[v * 2 + 1], A.alpha[v], A.wS[v], A.wW[v], A.k[v], part, aP);
        p[v * 3] = aP[0]; p[v * 3 + 1] = aP[1]; sd[v] = aP[2];
      }
      Lr.pos.needsUpdate = true; Lr.side.needsUpdate = true;
    }
  }
  // a point of her head (turned in 2.5D, then carried by her head)
  function headPoint(x, y, z, out) {
    turnPoint(x, y, z, HEAD.cx, HEAD.cy, P.headYaw, P.headPitch, out);
    return apply(M.head, out[0], out[1], out);
  }
  function deformHead(Lr, Z, pre) {
    const r = Lr.rest, p = Lr.pos.array;
    for (let v = 0, n = Lr.n; v < n; v++) {
      let x = r[v * 2], y = r[v * 2 + 1];
      if (pre) { pre(x, y, tmp2); x = tmp2[0]; y = tmp2[1]; }
      headPoint(x, y, Z[v], tmp);
      p[v * 3] = tmp[0]; p[v * 3 + 1] = tmp[1];
    }
    Lr.pos.needsUpdate = true;
  }
  // hair: the head part and the body part, blended down its length, then the springs
  function hairTarget(x, y, z, sf, out) {
    headPoint(x, y, z, out);
    const S = M.spine, bx = S[0] * x + S[2] * y + S[4], by = S[1] * x + S[3] * y + S[5];
    out[0] += (bx - out[0]) * sf; out[1] += (by - out[1]) * sf;
    return out;
  }
  function stepChains(list, dt) {
    const n = Math.max(1, Math.ceil(dt * 120)), h = dt / n;
    for (const c of list) {
      for (let i = 0; i < c.n; i++) {
        hairTarget(c.x, c.ry[i], c.z[i], c.sf[i], tmp);
        c.T[i * 2] = tmp[0]; c.T[i * 2 + 1] = tmp[1];
      }
      if (!c.ready) { c.X.set(c.T); c.Vv.fill(0); c.ready = true; }
    }
    for (let s = 0; s < n; s++) {
      const tt = clock - dt + s * h;
      for (const c of list) {
        const X = c.X, Vv = c.Vv, T = c.T;
        X[0] = T[0]; X[1] = T[1];
        const gust = RM ? 0 : c.wind * (drift[11](tt * 0.32 + c.seed) * 0.9 + 0.3 * Math.sin(tt * 1.7 + c.seed * 2.1) + 0.15);
        for (let i = 1; i < c.n; i++) {
          const j = i * 2, q = j - 2, k = c.k[i], u = i / (c.n - 1);
          const damp = 2 * Math.sqrt(k + c.kc) * c.zeta;
          const tx = X[q] + T[j] - T[q], ty = X[q + 1] + T[j + 1] - T[q + 1];
          const fx = k * (T[j] - X[j]) + c.kc * (tx - X[j]) + gust * Math.pow(u, 1.3) + push.x * u;
          const fy = k * (T[j + 1] - X[j + 1]) + c.kc * (ty - X[j + 1]) + push.y * u * 0.5;
          Vv[j] += (fx - damp * Vv[j]) * h; Vv[j + 1] += (fy - damp * Vv[j + 1]) * h;
          X[j] += Vv[j] * h; X[j + 1] += Vv[j + 1] * h;
          let ox = X[j] - T[j], oy = X[j + 1] - T[j + 1];
          const mx = c.maxX * u, my = c.maxY * u;
          if (ox > mx) { ox = mx; Vv[j] *= 0.5; } else if (ox < -mx) { ox = -mx; Vv[j] *= 0.5; }
          if (oy > my) { oy = my; Vv[j + 1] *= 0.5; } else if (oy < -my) { oy = -my; Vv[j + 1] *= 0.5; }
          X[j] = T[j] + ox; X[j + 1] = T[j + 1] + oy;
        }
      }
    }
    for (const c of list) for (let i = 0; i < 2 * c.n; i++) c.O[i] = c.X[i] - c.T[i];
  }
  function deformHair(name) {
    const Lr = L[name], H = V[name], list = chains[name], r = Lr.rest, p = Lr.pos.array;
    for (let v = 0, n = Lr.n; v < n; v++) {
      hairTarget(r[v * 2], r[v * 2 + 1], H.z[v], H.sf[v], tmp);
      const a = list[H.ca[v]], b = list[Math.min(list.length - 1, H.ca[v] + 1)];
      const i = H.seg[v], f = H.fr[v], w = H.wb[v];
      const oax = a.O[i * 2] + (a.O[i * 2 + 2] - a.O[i * 2]) * f, oay = a.O[i * 2 + 1] + (a.O[i * 2 + 3] - a.O[i * 2 + 1]) * f;
      const obx = b.O[i * 2] + (b.O[i * 2 + 2] - b.O[i * 2]) * f, oby = b.O[i * 2 + 1] + (b.O[i * 2 + 3] - b.O[i * 2 + 1]) * f;
      p[v * 3] = tmp[0] + oax + (obx - oax) * w;
      p[v * 3 + 1] = tmp[1] + oay + (oby - oay) * w;
    }
    Lr.pos.needsUpdate = true;
  }
  // her chest's follow-through: a soft spring behind the middle of her chest, which moves with her pose (her sway, her
  // weight, her dance, her 2.5D turn) and her hop (model.fx, in world units: up is -y in her picture)
  function chestStep(dt) {
    const c = RIG.chest;
    apply(M.spine, c.cx + 36 * bodyYawSin.v, c.cy, chestAt);
    const ty = chestAt[1] - (model.fx.position.y / K) * CHEST.hop;
    if (RM) jig.reset(chestAt[0], ty);                 // "reduce motion": no follow-through
    else jig.step(dt, chestAt[0], ty);
  }
  function deform(dt) {
    chestStep(dt);
    deformBody();
    deformArm('L'); deformArm('R');
    stepChains(chains.backHair, dt); stepChains(chains.frontHair, dt);
    push.x *= Math.exp(-dt * 8);
    deformHair('backHair'); deformHair('frontHair');
    deformHead(L.face, V.face);
  }

  // ---------- her face: eyes, lids, lashes, brows, mouth, blush ----------
  const lids = { L: { top: new Float32Array(9), bot: new Float32Array(9) }, R: { top: new Float32Array(9), bot: new Float32Array(9) } };
  const openTop = { L: Float32Array.from(RIG.eyes.L.top), R: Float32Array.from(RIG.eyes.R.top) };
  function face(wide) {
    const hp = clamp(expr.happy, 0, 1);
    const closure = 1 - (1 - blinkAmt) * (1 - clamp(expr.lids, 0, 0.9));
    const state = { c: closure, s: clamp(expr.squint, 0, 1) * (1 - hp), h: hp, w: 0 };
    for (const s of ['L', 'R']) {
      const eye = RIG.eyes[s];
      lidCurves(eye, state, lids[s]);
      const mat = L['eye' + s].mesh.material;
      mat.uniforms.uTop.value = Array.from(lids[s].top);
      mat.uniforms.uBot.value = Array.from(lids[s].bot);
      mat.uniforms.uIrisOff.value.set(P.eyeX * 4.2, P.eyeY * 2.3);
      deformHead(L['eye' + s], V['eye' + s]);
      // the upper lash rides on the lid: each column moves down with it (and gets a little thinner as it closes)
      const top = lids[s].top, e0 = eye.x0, e1 = eye.x1, ot = openTop[s];
      const thin = 1 - 0.28 * Math.max(closure, hp);
      deformHead(L[`eye${s}_lashU`], V[`eye${s}_lashU`], (x, y, out) => {
        const u = (x - e0) / (e1 - e0);
        const uc = clamp(u, 0, 1), t8 = uc * 8, i = Math.min(7, Math.floor(t8)), f = t8 - i;
        let dy = (top[i] + (top[i + 1] - top[i]) * f) - (ot[i] + (ot[i + 1] - ot[i]) * f);
        if (u < 0 || u > 1) dy *= clamp(1 - Math.abs(u < 0 ? u : u - 1) * 2.2, 0.35, 1);   // her lash's wing moves less
        const edge = ot[i] + (ot[i + 1] - ot[i]) * f;
        out[0] = x; out[1] = edge + (y - edge) * thin + dy;
        return out;
      });
      // the lower lash rides on the lower lid; it fades when her eyes close into "^^"
      const bot = lids[s].bot, ob = eye.bot;
      deformHead(L[`eye${s}_lashD`], V[`eye${s}_lashD`], (x, y, out) => {
        const uc = clamp((x - e0) / (e1 - e0), 0, 1), t8 = uc * 8, i = Math.min(7, Math.floor(t8)), f = t8 - i;
        out[0] = x; out[1] = y + (bot[i] + (bot[i + 1] - bot[i]) * f) - (ob[i] + (ob[i + 1] - ob[i]) * f);
        return out;
      });
      L[`eye${s}_lashD`].mesh.material.opacity = (1 - hp) * (1 - 0.55 * closure);
      // brows: up, down, and tilted (sad: the inner ends up; cross: down)
      const bd = RIG.brows[s], pv = bd.pivot;
      const up = (expr.browUp + (s === 'L' ? expr.browTilt : -expr.browTilt * 0.3) + talk.slow * 0.25) * 3.6;
      const ang = expr.browAng * 9 * bd.inner * -1;
      const c = Math.cos(ang * Math.PI / 180), sn = Math.sin(ang * Math.PI / 180);
      deformHead(L['brow' + s], V['brow' + s], (x, y, out) => {
        const dx = x - pv[0], dy = y - pv[1];
        out[0] = pv[0] + dx * c - dy * sn; out[1] = pv[1] + dx * sn + dy * c - up;
        return out;
      });
      L['blush' + s].mesh.material.uniforms.uBlush.value = clamp(expr.blush, 0, 1.2);
      deformHead(L['blush' + s], V['blush' + s]);
    }
    const m = L.mouth.mesh.material.uniforms;
    m.uOpen.value = clamp(Math.max(talk.open, expr.grin * (1 - 0.5 * talk.env)), 0, 1);
    m.uSmile.value = clamp(expr.smile * (1 - 0.3 * talk.env), -1, 1);
    m.uPout.value = clamp(expr.pout, 0, 1);
    m.uWide.value = clamp(wide * talk.env + (expr.smile > 0.6 ? 0.3 : 0), -1, 1);
    deformHead(L.mouth, V.mouth);
  }

  // ---------- markers for the stage's framing ----------
  const vM = [0, 0];
  function markers() {
    const mk = model.marks;
    headPoint(RIG.marks.head[0], RIG.marks.head[1], faceDepth(RIG.marks.head[0], RIG.marks.head[1]), vM); mk.head.position.set(vM[0], vM[1], 0);
    headPoint(RIG.marks.headTop[0], RIG.marks.headTop[1], -10, vM); mk.headTop.position.set(vM[0], vM[1], 0);
    apply(M.spine, RIG.marks.chest[0], RIG.marks.chest[1], vM); mk.chest.position.set(vM[0], vM[1], 0);
    ['L', 'R'].forEach((s, i) => {
      const A = V['arm' + s], j = J['arm' + s], m = M['shoulder' + s];
      mk.hands[i].forEach((o, q) => {                     // her wrist, fingertips and elbow, on her forearm
        const r = A.marks[q];
        armPoint(A, j, m, r.x, r.y, r.alpha, r.wS, r.wW, r.k, 'fore', aP);
        o.position.set(aP[0], aP[1], 0);
      });
    });
  }

  // ---------- reactions ----------
  const worldPos = (o, lift = 0) => o.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, lift, 0));
  function awayLook(yaw, pitch, ex, ey, seconds) {
    look.away = { yaw, pitch, ex, ey };
    look.awayUntil = clock + seconds;
  }
  function startWave() {
    if (act.wave >= 0) return;
    dancing = false;
    act.wave = 0;
    act.waveNear = closeUp ? 1 : 0;
    look.atViewerUntil = clock + 3;
  }
  function react(type) {
    setMood(type === 'tap' ? 'happy' : type);
    const mk = model.marks;
    switch (type) {
      case 'neutral': break;
      case 'wave': startWave(); break;
      case 'tap':
      case 'happy':
        if (!RM && act.hop < 0) act.hop = 0;
        effects?.spawnHearts(worldPos(mk.chest, 0.1), { count: 9 });
        look.atViewerUntil = clock + 1.6;
        break;
      case 'love':
        if (!RM && act.sway < 0) act.sway = 0;
        effects?.spawnHearts(worldPos(mk.head, 0.05), { count: 18, spread: 0.6, size: 0.12, rise: 1 });
        look.atViewerUntil = clock + 2.2;
        onGlow(0xff5c8a, 1.2);
        break;
      case 'shy':
        awayLook(-0.2, 0.17, -0.8, 0.85, 2.4);            // down and to the side
        effects?.spawnHearts(worldPos(mk.head, 0.1), { count: 4, spread: 0.25, size: 0.07, rise: 0.5 });
        onGlow(0xff5c8a, 0.7);
        break;
      case 'celebrate':
        if (!RM && act.hop < 0) act.hop = 0;
        if (!RM) act.cheer = 0;
        effects?.spawnHearts(worldPos(mk.head, 0.05), { count: 24, spread: 0.7, size: 0.12, rise: 1.1 });
        look.atViewerUntil = clock + 2.5;
        onGlow(0xff5c8a, 1);
        if (!closeUp && !dancing) nextDance = clock + 0.9;
        break;
      case 'sad': awayLook(0.02, 0.2, 0, 0.9, 3.5); break;             // she looks down for a few seconds
      case 'jealous': awayLook(-0.24, -0.02, -1, -0.15, 1.6); break;   // a glance away
      case 'dance': startDance(); break;
      case 'nod': if (act.nod < 0) act.nod = 0; break;
      case 'okay': if (act.nod < 0) act.nod = 0; look.atViewerUntil = clock + 1.6; break;
      case 'hmm': if (act.hmm < 0) act.hmm = 0; look.atViewerUntil = clock + 1.9; break;
      case 'worried': if (act.shake < 0) act.shake = 0; look.atViewerUntil = clock + 2; break;
      default: console.warn('[agi1_2d] unknown reaction:', type);
    }
  }
  function hello() {
    startWave();
    setMood('wave');
    nextDance = clock + FIRST_DANCE_AFTER;
  }

  // the first frame: settle everything where it belongs (no swinging in from nowhere)
  update(1 / 60);
  for (const list of Object.values(chains)) for (const c of list) c.ready = false;
  update(1 / 60);

  return {
    update, react, hello,
    beforeMixer() {},                                  // (the 3D AGI-1 needs this; nothing to undo here)
    setPointer(pointer) { look.pointer = pointer ? { x: pointer.x, y: pointer.y } : null; },
    setCloseUp(on) { closeUp = !!on; },
    setTalk(level) { talk.level = Number.isFinite(level) ? clamp(level, 0, 1) : 0; },
    setAttention(mode) {
      const next = mode === 'listening' || mode === 'thinking' ? mode : 'idle';
      if (next !== attention && next !== 'idle' && blink.t < 0) blink.next = clock + 0.15;
      attention = next;
    },
    get style() { return '2d'; },
    get dancing() { return dancing; },
    get mouthOpen() { return talk.open; },
    get blinking() { return blinkAmt; },
    get attention() { return attention; },
    get mood() { return expr.mood; },
    get expression() {
      return { smile: expr.smile, pout: expr.pout, squint: expr.squint, blush: expr.blush, lids: expr.lids, happy: expr.happy,
        blink: blinkAmt, mouth: L.mouth.mesh.material.uniforms.uOpen.value };
    },
    get hair() {
      let lag = 0;
      for (const c of chains.backHair) lag = Math.max(lag, Math.hypot(c.O[(c.n - 1) * 2], c.O[(c.n - 1) * 2 + 1]));
      return { lag: lag * K, twist: 0, flare: 0, on: true };
    },
    get pose() { return { ...P }; },
    get chest() { return { x: jig.x, y: jig.y, on: !RM }; },   // her chest's follow-through right now (art px)
    get waving() { return act.wave >= 0; },
  };
}
