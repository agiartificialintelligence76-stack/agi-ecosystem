// JAYWALK's 3D view (2026-11-08): a pastel voxel diorama of 2049 drawn with three.js. Mint parks, cream sidewalks,
// blue-grey asphalt with honey lines, glowing violet data rivers, gravel maglev lines; ink-outlined toys that move.
// Everything repeated is instanced (one draw for every car of a kind, every tree, every row of sidewalk), rows are laid
// out again only when the window of rows on screen moves, and nothing is allocated per frame. Real shadows on
// computers (a small shadow map that follows the camera); soft blob shadows on phones and tablets.
import * as THREE from 'three';
import { voxGeometry, voxMaterials } from './voxel.js';
import * as M from './models.js';
import {
  T, HALF, SPAN, isSafe, entX, trainShown, trainWarning, slotPos, VEHICLES,
} from './world.js';
import { CHARACTER_MODELS } from './models.js';

export const TOP = Object.freeze({ park: 0.12, walk: 0.16, road: 0, bike: 0.02, rail: 0.05, river: -0.3 });
const RIVER_Y = TOP.river;
const DECK = RIVER_Y + M.RAFT_TOP / 16;          // a raft's deck
const CHAR_UNIT = 1 / 18.5;
const BG = '#d7cbff';
const PITCH = THREE.MathUtils.degToRad(54);
const YAW = THREE.MathUtils.degToRad(-13);
const FOV = 30;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const damp = (a, b, rate, dt) => b + (a - b) * Math.exp(-rate * dt);
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// colors: a hex darkened or lightened (for the street's sides, outside the playable columns)
function shadeHex(hex, k) {
  const c = new THREE.Color(hex);
  const t = new THREE.Color(k < 0 ? '#2a1a52' : '#ffffff');
  c.lerp(t, Math.abs(k));
  return `#${c.getHexString()}`;
}

// ---------- instanced batches: one model, many copies (its ink hull shares the copies' matrices) ----------
class Batch {
  constructor(parent, geo, mats, cap, { hull = true, cast = false, receive = false, colors = false, material = null, order = 0 } = {}) {
    this.mesh = new THREE.InstancedMesh(geo.body, material || mats.pair, cap);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = cast;
    this.mesh.receiveShadow = receive;
    this.mesh.renderOrder = order;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    parent.add(this.mesh);
    if (colors) {
      this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
      this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    this.hull = null;
    if (hull && geo.hull) {
      this.hull = new THREE.InstancedMesh(geo.hull, mats.ink, cap);
      this.hull.instanceMatrix = this.mesh.instanceMatrix;
      this.hull.count = 0;
      this.hull.frustumCulled = false;
      parent.add(this.hull);
    }
    this.arr = this.mesh.instanceMatrix.array;
    this.cols = this.mesh.instanceColor?.array || null;
    this.cap = cap;
    this.n = 0;
  }
  begin() { this.n = 0; }
  put(x, y, z, rot = 0, sx = 1, sy = 1, sz = 1) {
    if (this.n >= this.cap) return -1;
    const c = Math.cos(rot), s = Math.sin(rot), a = this.arr, o = this.n * 16;
    a[o] = c * sx; a[o + 1] = 0; a[o + 2] = -s * sx; a[o + 3] = 0;
    a[o + 4] = 0; a[o + 5] = sy; a[o + 6] = 0; a[o + 7] = 0;
    a[o + 8] = s * sz; a[o + 9] = 0; a[o + 10] = c * sz; a[o + 11] = 0;
    a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1;
    return this.n++;
  }
  // a full matrix (tumbling things)
  putMatrix(m) {
    if (this.n >= this.cap) return -1;
    m.toArray(this.arr, this.n * 16);
    return this.n++;
  }
  tint(i, r, g, b) { if (this.cols && i >= 0) { this.cols[i * 3] = r; this.cols[i * 3 + 1] = g; this.cols[i * 3 + 2] = b; } }
  end() {
    this.mesh.count = this.n;
    if (this.hull) this.hull.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  set visible(v) { this.mesh.visible = v; if (this.hull) this.hull.visible = v; }
}

// ---------- the data river: a glowing surface with packets of light drifting with the current ----------
const RIVER_VS = `
#include <common>
#include <fog_pars_vertex>
varying vec3 vW;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const RIVER_FS = `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
uniform float uFlow;
uniform float uSeed;
uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uGlow;
uniform vec3 uPink;
varying vec3 vW;
varying vec2 vUv;
float h1(float n) { return fract(sin(n * 91.345 + 47.853) * 43758.5453); }
void main() {
  float y = vUv.y;
  float x = vW.x - uFlow * uTime;
  vec3 col = mix(uDeep, uMid, 0.35 + 0.65 * sin(y * 3.14159));
  // three streams of light across the row, broken into packets that drift with the current
  float lane = floor(y * 3.0);
  float ly = fract(y * 3.0);
  float line = 1.0 - smoothstep(0.05, 0.16, abs(ly - 0.5));
  float scale = 0.42 + 0.3 * h1(lane + uSeed);
  float d = fract(x * scale + h1(lane * 7.0 + uSeed) * 9.0);
  float pkt = smoothstep(0.0, 0.04, d) * (1.0 - smoothstep(0.28, 0.36, d));
  vec3 pc = h1(lane * 3.0 + uSeed * 5.0) > 0.45 ? uGlow : uPink;
  col = mix(col, pc, line * pkt * 0.95);
  col += uGlow * line * 0.07;
  // a soft bright edge along each bank
  float bank = 1.0 - smoothstep(0.0, 0.07, min(y, 1.0 - y));
  col = mix(col, uGlow, bank * 0.45);
  // ripples
  col += 0.05 * sin(x * 2.3 + y * 9.0 + uTime * 1.7) * uGlow;
  // outside the street: dimmer
  col *= mix(1.0, 0.7, smoothstep(4.45, 4.75, abs(vW.x)));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

// ---------- the rows' own geometry (cell units): one per kind of row, laid out by instancing ----------
function rowBoxes(kind, variant = 0) {
  const b = [];
  const S = SPAN + 0.5, E = HALF + 0.5;
  const slab = (top, color, side = shadeHex(color, -0.2)) => {
    b.push([-S, -1.4, -0.5, -E, top, 0.5, side], [-E, -1.4, -0.5, E, top, 0.5, color], [E, -1.4, -0.5, S, top, 0.5, side]);
  };
  const rnd = (k) => hash(k * 13.17 + variant * 101.3 + kind.length * 7.7);
  if (kind === 'park') {
    slab(TOP.park, variant % 2 ? '#8ce3bd' : '#95eac6');
    for (let k = 0; k < 26; k++) {
      const x = -S + 1 + rnd(k) * (2 * S - 2), z = -0.38 + rnd(k + 50) * 0.76;
      const out = Math.abs(x) > E;
      const c = rnd(k + 90) > 0.6 ? '#7cd6ad' : '#a5f0d0';
      b.push([x - 0.09, TOP.park, z - 0.06, x + 0.09, TOP.park + 0.05, z + 0.06, out ? shadeHex(c, -0.2) : c]);
    }
  } else if (kind === 'walk') {
    slab(TOP.walk - 0.02, '#e8d9bd');
    for (let x = -SPAN; x <= SPAN; x++) {
      const odd = (x + variant) % 2 !== 0;
      const c = odd ? '#fff4df' : '#fbeccf';
      b.push([x - 0.46, TOP.walk - 0.02, -0.44, x + 0.46, TOP.walk, 0.44, Math.abs(x) > HALF ? shadeHex(c, -0.2) : c]);
    }
  } else if (kind === 'road') {
    slab(TOP.road, '#4a5277', '#3a4062');
  } else if (kind === 'bike') {
    slab(TOP.bike, '#f7a3c7', shadeHex('#f7a3c7', -0.22));
    for (const z of [-0.45, 0.39]) {
      b.push([-E, TOP.bike, z, E, TOP.bike + 0.008, z + 0.06, '#ffffff'], [-S, TOP.bike, z, -E, TOP.bike + 0.008, z + 0.06, '#d9d2ea'], [E, TOP.bike, z, S, TOP.bike + 0.008, z + 0.06, '#d9d2ea']);
    }
  } else if (kind === 'rail') {
    slab(TOP.rail, '#aaa3c4', '#8c85a8');
    for (let x = -SPAN; x <= SPAN; x += 0.5) b.push([x - 0.08, TOP.rail, -0.42, x + 0.08, TOP.rail + 0.05, 0.42, Math.abs(x) > HALF ? '#5a5277' : '#6f6690']);
    for (const z of [-0.3, 0.24]) b.push([-S, TOP.rail + 0.05, z, S, TOP.rail + 0.11, z + 0.06, '#eeebfa']);
    b.push([-S, TOP.rail, -0.05, S, TOP.rail + 0.025, 0.05, '#3ff0c3', 'g']);
  }
  return b;
}

// ---------- the view ----------
export function createView(canvas, { mobile = false, reduced = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: false, stencil: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(BG);
  const shadows = !mobile;
  if (shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
  }
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 30, 60);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 200);

  const hemi = new THREE.HemisphereLight('#ffffff', '#b9a8e6', 1.75);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff3e3', 1.9);
  const SUN_DIR = new THREE.Vector3(-0.5, 1, 0.42).normalize();
  sun.position.copy(SUN_DIR).multiplyScalar(30);
  scene.add(sun, sun.target);
  if (shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = sun.shadow.camera;
    s.left = -18; s.right = 18; s.top = 20; s.bottom = -20; s.near = 1; s.far = 80;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
  }

  const mats = voxMaterials();
  mats.ink.fog = true;
  const geoCache = new Map();
  const geo = (name, make, unit = 1 / 16, outline = 0.55) => {
    let g = geoCache.get(name);
    if (!g) { g = voxGeometry(make(), { unit, outline }); geoCache.set(name, g); }
    return g;
  };

  // ---- the street ----
  const world3 = new THREE.Group();
  scene.add(world3);
  const ROWKINDS = { park: [0, 1, 2], walk: [0, 1], road: [0], bike: [0], rail: [0] };
  const slabs = {};
  for (const [kind, variants] of Object.entries(ROWKINDS)) {
    for (const v of variants) slabs[`${kind}${v}`] = new Batch(world3, voxGeometry(rowBoxes(kind, v), { unit: 1, outline: 0 }), mats, 64, { hull: false, receive: shadows, colors: true });
  }
  const markGeo = {
    dash: voxGeometry([[-0.34, 0, -0.035, 0.34, 0.012, 0.035, '#ffffff']], { unit: 1, outline: 0 }),
    line: voxGeometry([[-SPAN - 0.5, 0, -0.03, SPAN + 0.5, 0.012, 0.03, '#ffffff']], { unit: 1, outline: 0 }),
  };
  const dashes = new Batch(world3, markGeo.dash, mats, 900, { hull: false, colors: true });
  const lines = new Batch(world3, markGeo.line, mats, 80, { hull: false, colors: true });

  const PROP_CAP = { tree: 420, tree2: 360, bush: 320, flowers: 200, lamp: 200, planter: 200 };
  const props = {};
  for (const kind of Object.keys(M.PROP_MODELS)) {
    props[kind] = new Batch(world3, geo(`prop:${kind}`, M.PROP_MODELS[kind]), mats, PROP_CAP[kind] || 160, { cast: shadows && kind !== 'chev' && kind !== 'flowers', hull: kind !== 'chev' && kind !== 'flowers' });
  }

  // the data rivers (one mesh a row, sharing one shader and one clock)
  const riverTime = { value: 0 };
  const riverBase = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uFlow: { value: 0 }, uSeed: { value: 0 },
      uDeep: { value: new THREE.Color('#5a33d6') }, uMid: { value: new THREE.Color('#7b58ff') },
      uGlow: { value: new THREE.Color('#8ff4ff') }, uPink: { value: new THREE.Color('#ff9ad5') },
    }]),
    vertexShader: RIVER_VS, fragmentShader: RIVER_FS, fog: true,
  });
  const riverGeo = new THREE.PlaneGeometry(2 * SPAN + 1, 1).rotateX(-Math.PI / 2);
  const rivers = [];
  for (let k = 0; k < 24; k++) {
    const m = riverBase.clone();
    m.uniforms.uTime = riverTime;
    const mesh = new THREE.Mesh(riverGeo, m);
    mesh.visible = false;
    mesh.receiveShadow = false;
    world3.add(mesh);
    rivers.push(mesh);
  }

  // ---- things that move ----
  const movers = new THREE.Group();
  scene.add(movers);
  const vehicles = {};
  for (const [kind, spec] of Object.entries(VEHICLES)) {
    for (let v = 0; v < spec.colors; v++) vehicles[`${kind}${v}`] = new Batch(movers, geo(`veh:${kind}${v}`, () => M.VEHICLE_MODELS[kind](v)), mats, 48, { cast: shadows });
  }
  const rafts = {};
  for (const n of [2, 3, 4]) rafts[`rack${n}`] = new Batch(movers, geo(`rack${n}`, () => M.rackModel(n)), mats, 48, { cast: shadows });
  for (const n of [1, 2, 3]) rafts[`pads${n}`] = new Batch(movers, geo(`pads${n}`, () => M.padsModel(n)), mats, 64, { cast: shadows });
  const trains = {};
  for (const part of ['head', 'mid', 'tail']) trains[part] = new Batch(movers, geo(`train:${part}`, () => M.trainModel(part)), mats, 40, { cast: shadows });
  const hearts = {
    small: new Batch(movers, geo('heart', () => M.heartModel()), mats, 48, { cast: shadows }),
    big: new Batch(movers, geo('heart:big', () => M.heartModel('#ffc933', '#fff3c4')), mats, 16, { cast: shadows }),
  };
  const lampGeo = voxGeometry([[-1.1, -1.1, -0.6, 1.1, 1.1, 0.6, '#ffffff', 'g']], { unit: 1 / 16, outline: 0 });
  const lamps = new Batch(movers, lampGeo, mats, 48, { hull: false, colors: true });
  const glowMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  const glowGeo = { body: new THREE.BoxGeometry(2 * HALF + 1.4, 0.02, 0.92) };
  const warnGlow = new Batch(movers, glowGeo, mats, 16, { hull: false, colors: true, material: glowMat, order: 2 });

  // soft round shadows (phones and tablets: no shadow maps)
  let blobs = null;
  if (!shadows) {
    const shape = new THREE.Shape();
    const r = 0.18;
    shape.moveTo(-0.5 + r, -0.5); shape.lineTo(0.5 - r, -0.5); shape.quadraticCurveTo(0.5, -0.5, 0.5, -0.5 + r);
    shape.lineTo(0.5, 0.5 - r); shape.quadraticCurveTo(0.5, 0.5, 0.5 - r, 0.5); shape.lineTo(-0.5 + r, 0.5);
    shape.quadraticCurveTo(-0.5, 0.5, -0.5, 0.5 - r); shape.lineTo(-0.5, -0.5 + r); shape.quadraticCurveTo(-0.5, -0.5, -0.5 + r, -0.5);
    const g = new THREE.ShapeGeometry(shape, 3).rotateX(-Math.PI / 2);
    const m = new THREE.MeshBasicMaterial({ color: '#3a2470', transparent: true, opacity: 0.2, depthWrite: false, fog: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    blobs = new Batch(movers, { body: g }, mats, 700, { hull: false, material: m, order: 1 });
  }
  const blob = (x, y, z, w, d, rot = 0) => { if (blobs) blobs.put(x + 0.07, y + 0.006, z + 0.05, rot, w, 1, d); };

  // ---- her (or her cat), the drone, the effects ----
  const player = new THREE.Group();
  const squash = new THREE.Group();
  player.add(squash);
  const pBody = new THREE.Mesh(new THREE.BufferGeometry(), mats.pair);
  const pHull = new THREE.Mesh(new THREE.BufferGeometry(), mats.ink);
  pBody.castShadow = shadows;
  squash.add(pBody, pHull);
  scene.add(player);
  let charId = '';
  function setCharacter(id) {
    if (id === charId) return;
    charId = id;
    const g = geo(`char:${id}`, CHARACTER_MODELS[id] || CHARACTER_MODELS.agi, CHAR_UNIT, 0.5);
    pBody.geometry = g.body;
    pHull.geometry = g.hull;
  }

  const drone = new THREE.Group();
  const dg = geo('drone', M.droneModel, 1 / 16, 0.5);
  const dBody = new THREE.Mesh(dg.body, mats.pair);
  dBody.castShadow = shadows;
  drone.add(dBody, new THREE.Mesh(dg.hull, mats.ink));
  const rg = geo('rotor', M.rotorModel, 1 / 16, 0);
  const rotors = [[9.4, 0], [-9.4, 0], [0, 9.4], [0, -9.4]].map(([x, z]) => {
    const m = new THREE.Mesh(rg.body, mats.pair);
    m.position.set(x / 16, 4.1 / 16, z / 16);
    drone.add(m);
    return m;
  });
  drone.visible = false;
  scene.add(drone);

  const sg = geo('spark', M.sparkModel, 1 / 16, 0);
  const stars = [0, 1, 2].map(() => { const m = new THREE.Mesh(sg.body, mats.pair); m.visible = false; scene.add(m); return m; });

  // particles: little cubes
  const PCAP = reduced ? 120 : 260;
  const bitMat = new THREE.MeshBasicMaterial({ color: '#ffffff', fog: true });
  const bits = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), bitMat, PCAP);
  bits.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PCAP * 3), 3);
  bits.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bits.frustumCulled = false;
  bits.count = 0;
  scene.add(bits);
  const parts = [];
  // rings on the water
  const ringGeo = new THREE.RingGeometry(0.78, 1, 28).rotateX(-Math.PI / 2);
  const rings = [0, 1, 2, 3, 4, 5].map(() => {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#c9fbff', transparent: true, depthWrite: false, fog: true }));
    m.visible = false;
    scene.add(m);
    return { mesh: m, t: 0, life: 0, size: 1 };
  });

  // painted words on the street: every 25 rows, and the line of her best
  const decals = new Map();
  let fontsReady = false;
  function paint(text, { w = 1024, h = 256, color = '#ffffff', size = 150, line = null, sub = null } = {}) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    if (line) {
      g.fillStyle = line;
      for (let x = 8; x < w; x += 64) g.fillRect(x, h - 26, 40, 14);
    }
    g.font = `900 ${size}px 'AK Display', 'Arial Black', sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = size * 0.16;
    g.strokeStyle = 'rgba(42,26,82,.55)';
    const y = line ? h * 0.42 : h / 2;
    g.strokeText(text, w / 2, y);
    g.fillStyle = color;
    g.fillText(text, w / 2, y);
    if (sub) { g.font = `800 ${size * 0.34}px 'AK Display', sans-serif`; g.lineWidth = 6; g.strokeText(sub, w / 2, y + size * 0.62); g.fillText(sub, w / 2, y + size * 0.62); }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }
  function decal(key, i, top, text, opts, wCells = 4.4, hCells = 1.1, z = 0, opacity = 0.9) {
    if (decals.has(key)) return decals.get(key);
    const tex = paint(text, opts);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(wCells, hCells).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity, depthWrite: false, fog: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    }));
    m.position.set(0, top + 0.004, -i + z);
    m.renderOrder = 1;
    scene.add(m);
    const d = { mesh: m, i };
    decals.set(key, d);
    return d;
  }
  function dropDecal(key) {
    const d = decals.get(key);
    if (!d) return;
    scene.remove(d.mesh);
    d.mesh.geometry.dispose();
    d.mesh.material.map.dispose();
    d.mesh.material.dispose();
    decals.delete(key);
  }

  // ---- sizes and the camera's framing ----
  let W = 1, H = 1, dist = 24, ahead = 3, back = 8, front = 26, topInset = 0;
  const camPos = new THREE.Vector3(), camTarget = new THREE.Vector3();
  const offset = new THREE.Vector3(Math.sin(YAW) * Math.cos(PITCH), Math.sin(PITCH), Math.cos(YAW) * Math.cos(PITCH));
  function resize(w, h, { top = 0 } = {}) {
    W = Math.max(1, w); H = Math.max(1, h); topInset = top;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    const tv = Math.tan(THREE.MathUtils.degToRad(FOV) / 2), th = tv * camera.aspect;
    // enough columns across (portrait phones), enough rows ahead (landscape)
    const wide = camera.aspect > 1;
    const needW = wide ? 13 : 11.6;
    const needRows = wide ? (H < 560 ? 12.5 : 14.5) : 13;
    dist = Math.max(needW / (2 * th), (needRows * Math.sin(PITCH)) / (2 * tv));
    // the player sits low enough to see what's coming, clear of the top bar
    ahead = wide ? 2.6 : 3.4;
    camera.near = Math.max(1, dist * 0.35);
    camera.far = dist * 2.6 + 30;
    camera.updateProjectionMatrix();
    scene.fog.near = dist * 1.02 + 2;
    scene.fog.far = dist * 1.02 + (wide ? 26 : 30);
    // how many rows the camera sees behind and ahead of its target
    const ground = (ndcY) => {
      const v = new THREE.Vector3(0, ndcY, 0.5);
      camera.position.copy(offset).multiplyScalar(dist);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      v.unproject(camera).sub(camera.position).normalize();
      if (v.y >= -0.02) return -60;
      const k = -camera.position.y / v.y;
      return camera.position.z + v.z * k;
    };
    back = Math.ceil(Math.max(4, ground(-1.05) + 2));
    front = Math.ceil(Math.min(48, -ground(1.05) + 3));
  }

  // ---- laying out the rows on screen (when the window moves) ----
  let lo = 1e9, hi = -1e9, curWorld = null, bestRow = 0;
  function layout(world, from, to) {
    lo = from; hi = to; curWorld = world;
    for (const b of Object.values(slabs)) b.begin();
    dashes.begin(); lines.begin();
    for (const b of Object.values(props)) b.begin();
    let ri = 0;
    for (let i = from; i <= to; i++) {
      const row = world.row(i);
      const z = -i;
      if (row.type === T.RIVER) {
        const m = rivers[ri++];
        if (m) {
          m.visible = true;
          m.position.set(0, RIVER_Y, z);
          m.material.uniforms.uFlow.value = row.speed * row.dir;
          m.material.uniforms.uSeed.value = (i * 0.618) % 7;
        }
      } else {
        const key = row.type === T.PARK ? `park${((i % 3) + 3) % 3}` : row.type === T.WALK ? `walk${((i % 2) + 2) % 2}` : `${row.type}0`;
        const s = slabs[key];
        const k = s.put(0, 0, z);
        const tint = row.type === T.PARK && (i % 2) ? 0.96 : 1;
        s.tint(k, tint, tint, tint);
      }
      if (row.type === T.ROAD) {
        const next = world.row(i + 1), prev = world.row(i - 1);
        if (next.type === T.ROAD) {
          if (next.dir !== row.dir) {
            for (const dz of [-0.07, 0.07]) { const k = lines.put(0, TOP.road + 0.002, z - 0.5 + dz); lines.tint(k, 1, 0.73, 0.12); }
          } else {
            for (let x = -SPAN + ((i * 0.37) % 1.6); x <= SPAN; x += 1.6) { const k = dashes.put(x, TOP.road + 0.002, z - 0.5); dashes.tint(k, 1, 1, 1); }
          }
        } else { const k = lines.put(0, TOP.road + 0.002, z - 0.42); lines.tint(k, 0.92, 0.9, 1); }
        if (prev.type !== T.ROAD) { const k = lines.put(0, TOP.road + 0.002, z + 0.42); lines.tint(k, 0.92, 0.9, 1); }
      }
      const top = TOP[row.type];
      for (const p of row.props) {
        const b = props[p.kind];
        if (!b) continue;
        let rot = p.rot * Math.PI / 2;
        let pz = z;
        if (p.kind === 'vend' || p.kind === 'bench') rot = p.rot % 2 ? 0 : (p.rot === 2 ? Math.PI / 2 * (p.x < 0 ? -1 : 1) : 0);
        if (p.kind === 'signal') { rot = 0; pz = z + 0.43; }
        if (p.kind === 'chev') rot = p.rot ? Math.PI : 0;
        const jx = p.kind === 'chev' || p.kind === 'signal' || Math.abs(p.x) <= HALF ? 0 : (hash(i * 31 + p.x) - 0.5) * 0.3;
        b.put(p.x + jx, top, pz, rot, 1, p.kind === 'tree' || p.kind === 'tree2' ? 0.9 + hash(i + p.x * 3) * 0.25 : 1, 1);
      }
    }
    for (let k = ri; k < rivers.length; k++) rivers[k].visible = false;
    for (const b of Object.values(slabs)) b.end();
    dashes.end(); lines.end();
    for (const b of Object.values(props)) b.end();
    // painted milestones and her best
    for (const [key, d] of decals) if (d.i < from - 2 || d.i > to + 2) dropDecal(key);
    if (fontsReady) {
      for (let i = Math.ceil(Math.max(1, from) / 25) * 25; i <= to; i += 25) {
        const row = world.row(i);
        if (row.type === T.RIVER || row.type === T.RAIL) continue;
        decal(`m${i}`, i, TOP[row.type], String(i), { size: 170, color: row.type === T.ROAD ? '#ffffff' : '#ffffff' }, 2.6, 0.65, 0, row.type === T.ROAD ? 0.85 : 0.9);
      }
      if (bestRow > 0 && bestRow >= from && bestRow <= to) {
        const row = world.row(bestRow);
        decal(`best${bestRow}`, bestRow, row.type === T.RIVER ? RIVER_Y + 0.02 : TOP[row.type], 'BEST', { size: 120, color: '#ff4da6', line: '#ff4da6', sub: String(bestRow) }, 2 * HALF + 1, (2 * HALF + 1) / 4, -0.35, 1);
      }
    }
  }

  // ---- the moving things, every frame ----
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3();
  function drawMovers(world, t, run) {
    for (const b of Object.values(vehicles)) b.begin();
    for (const b of Object.values(rafts)) b.begin();
    for (const b of Object.values(trains)) b.begin();
    hearts.small.begin(); hearts.big.begin(); lamps.begin(); warnGlow.begin();
    if (blobs) {
      blobs.begin();
      for (let i = lo; i <= hi; i++) {
        const row = world.row(i);
        if (!isSafe(row.type)) continue;
        for (const p of row.props) if (p.kind !== 'flowers' && p.kind !== 'chev') blob(p.x, TOP[row.type], -i, 0.8, 0.8);
      }
    }
    const blink = Math.floor(t * 4) % 2;
    for (let i = lo; i <= hi; i++) {
      const row = world.row(i);
      const z = -i;
      if (row.type === T.ROAD || row.type === T.BIKE) {
        const top = TOP[row.type];
        const rot = row.dir > 0 ? 0 : Math.PI;
        for (const e of row.ents) {
          const x = entX(row, e, t);
          if (Math.abs(x) > SPAN + 2) continue;
          const bob = Math.abs(Math.sin(t * 14 + e.id * 1.7)) * 0.012;
          vehicles[`${e.kind}${e.v || 0}`]?.put(x, top + bob, z, rot);
          blob(x, top, z, e.len + 0.15, 0.86);
        }
      } else if (row.type === T.RIVER) {
        for (const e of row.ents) {
          const x = entX(row, e, t);
          if (Math.abs(x) > SPAN + 3) continue;
          const bob = Math.sin(t * 2.4 + e.id * 1.3) * 0.025;
          const b = e.kind === 'rack' ? rafts[`rack${e.len}`] : rafts[`pads${e.len}`];
          b?.put(x, RIVER_Y + bob, z, 0);
          blob(x, RIVER_Y + 0.01, z, e.len * 0.95, 0.92);
        }
      } else if (row.type === T.RAIL) {
        const tr = trainShown(row, t);
        if (tr) {
          const cars = Math.round(row.rail.len / 2.5);
          for (let k = 0; k < cars; k++) {
            const cx = tr.lo + 1.25 + k * 2.5;
            if (Math.abs(cx) > SPAN + 3) continue;
            const first = k === 0, last = k === cars - 1;
            // the nose leads: at the high end going right, at the low end going left
            const part = row.dir > 0 ? (last ? 'head' : first ? 'tail' : 'mid') : (first ? 'head' : last ? 'tail' : 'mid');
            const rot = part === 'tail' ? (row.dir > 0 ? Math.PI : 0) : (row.dir > 0 ? 0 : Math.PI);
            trains[part].put(cx, TOP.rail + 0.05, z, part === 'mid' ? 0 : rot);
            blob(cx, TOP.rail, z, 2.5, 0.9);
          }
        }
        const warn = trainWarning(row, t);
        for (const p of row.props) {
          if (p.kind !== 'signal') continue;
          for (const s of [-1, 1]) {
            const k = lamps.put(p.x + s * 0.09, TOP.rail + 0.875, z + 0.43 + 0.08, 0);
            const on = warn && (blink ? s > 0 : s < 0);
            if (on) lamps.tint(k, 2.2, 0.35, 0.4); else lamps.tint(k, 0.3, 0.12, 0.22);
          }
        }
        if (warn) {
          const k = warnGlow.put(0, TOP.rail + 0.02, z, 0);
          const a = 0.25 + 0.2 * blink;
          warnGlow.tint(k, a, 0.02, 0.06);
        }
      }
      // hearts: spinning, bobbing (the ones she has picked up are gone)
      const top = row.type === T.RIVER ? DECK : TOP[row.type];
      for (const h of row.hearts) {
        if (run && run.got.has(`${i}:${h.x}`)) continue;
        const b = h.big ? hearts.big : hearts.small;
        const s = h.big ? 1.45 : 1;
        b.put(h.x, top + 0.18 + Math.sin(t * 3 + h.x) * 0.06, z, t * 2.2 + h.x, s, s, s);
        blob(h.x, top, z, 0.42 * s, 0.42 * s);
      }
    }
    for (const b of Object.values(vehicles)) b.end();
    for (const b of Object.values(rafts)) b.end();
    for (const b of Object.values(trains)) b.end();
    hearts.small.end(); hearts.big.end(); lamps.end(); warnGlow.end();
  }

  // ---- her pose ----
  const FACING = { up: 0, down: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 };
  const pose = { x: 0, y: 0, z: 0, rot: 0, sx: 1, sy: 1, sz: 1, tilt: 0, roll: 0 };
  let rotNow = 0, landT = 1, charge = 0, chargeTarget = 0, idlePhase = 0;
  const surf = (world, i, onRaft) => (onRaft ? DECK : TOP[world.row(i).type] ?? 0);
  const easeOut = (k) => 1 - (1 - k) * (1 - k);
  function playerPose(run, t, dt, { title = false } = {}) {
    const w = run.world;
    let x = run.x, z = -run.row, y = surf(w, run.row, Boolean(run.ride));
    let sx = 1, sy = 1, sz = 1, tilt = 0, roll = 0;
    const h = run.hop;
    if (h && !h.bump) {
      const k = clamp(h.t / h.dur, 0, 1), e = easeOut(k);
      const fx = h.fromRide ? slotPos(w.row(h.fromRow), h.fromRide.e, h.fromRide.k, t) : h.fromX;
      const tx = h.raft ? slotPos(w.row(h.toRow), h.raft, h.slot, t) : h.toX;
      x = fx + (tx - fx) * e;
      z = -(h.fromRow + (h.toRow - h.fromRow) * e);
      const y0 = surf(w, h.fromRow, Boolean(h.fromRide)), y1 = surf(w, h.toRow, Boolean(h.raft));
      y = y0 + (y1 - y0) * k + Math.sin(Math.PI * k) * 0.42;
      const st = k < 0.5 ? 1 + 0.16 * Math.sin(Math.PI * k * 2) : 1;
      sy = st; sx = sz = 1 / Math.sqrt(st);
      landT = 0;
    } else if (h && h.bump) {
      const k = clamp(h.t / h.dur, 0, 1);
      const [dr, dx] = { up: [1, 0], down: [-1, 0], left: [0, -1], right: [0, 1] }[h.dir];
      const push = Math.sin(Math.PI * k) * 0.14;
      x += dx * push; z -= dr * push;
      y += Math.sin(Math.PI * k) * 0.16;
    }
    if (run.ride && (!h || h.bump)) y += Math.sin(t * 2.4 + run.ride.e.id * 1.3) * 0.025;
    // landing squash, and the squash while a finger is down (she's about to hop)
    landT = Math.min(1, landT + dt / 0.16);
    if (landT < 1 && !(h && !h.bump)) {
      const q = Math.sin(Math.PI * landT) * (1 - landT * 0.4);
      sy *= 1 - 0.2 * q; sx *= 1 + 0.12 * q; sz *= 1 + 0.12 * q;
    }
    charge = damp(charge, chargeTarget, 26, dt);
    if (charge > 0.01 && !(h && !h.bump)) { sy *= 1 - 0.14 * charge; sx *= 1 + 0.07 * charge; sz *= 1 + 0.07 * charge; }
    // idle: a little breathing bob
    idlePhase += dt;
    if (!h) sy *= 1 + Math.sin(idlePhase * 3.2) * 0.018;
    const want = title ? Math.PI : FACING[run.facing] ?? 0;
    let d = want - rotNow;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    rotNow += d * (1 - Math.exp(-dt * 28));
    pose.x = x; pose.y = y; pose.z = z; pose.rot = rotNow; pose.sx = sx; pose.sy = sy; pose.sz = sz; pose.tilt = tilt; pose.roll = roll;
    return pose;
  }

  // ---- her outs ----
  function deathPose(run, age) {
    const d = run.death;
    const w = run.world;
    const row = w.row(d.row);
    const base = row.type === T.RIVER ? RIVER_Y : TOP[row.type] ?? 0;
    pose.rot = rotNow; pose.tilt = 0; pose.roll = 0;
    if (d.kind === 'car') {
      // flat as a sticker, stars going round
      const k = Math.min(1, age / 0.07);
      pose.x = d.x; pose.z = -d.row; pose.y = base + 0.01;
      pose.sx = 1 + 0.45 * k; pose.sz = 1 + 0.45 * k; pose.sy = 1 - 0.9 * k;
      if (!d.spun) { d.spun = true; d.rot0 = rotNow + (hash(d.t * 9) - 0.5) * 0.8; }
      pose.rot = d.rot0;
    } else if (d.kind === 'train') {
      const tt = Math.min(age, 1.6);
      const dir = d.dir || 1;
      pose.x = d.x + dir * (13 * tt);
      pose.y = base + 0.4 + 9 * tt - 9 * tt * tt;
      pose.z = -d.row - 1.2 * tt;
      pose.sx = pose.sy = pose.sz = 1;
      pose.roll = -dir * tt * 14;
      pose.rot = rotNow + tt * 6;
    } else if (d.kind === 'splash' || d.kind === 'edge') {
      const k = Math.min(1, age / 0.55);
      pose.x = d.x; pose.z = -d.row;
      pose.y = RIVER_Y + 0.1 - k * 0.9;
      pose.sx = pose.sz = 1 - k * 0.25; pose.sy = 1 - k * 0.25;
      pose.tilt = Math.sin(age * 18) * 0.12 * (1 - k);
    } else if (d.kind === 'drone') {
      const g = droneGrab(run, age);
      pose.x = g.x; pose.y = g.y - 0.86; pose.z = g.z;
      pose.sx = pose.sz = 1; pose.sy = 1 + (age > 0.4 ? 0.06 : 0);
      pose.tilt = age > 0.4 ? Math.sin(age * 9) * 0.25 : 0;
    }
    return pose;
  }

  // the security drone: hovering over her as a warning, swooping down to take her, leaving otherwise
  const dr = { x: 0, y: 12, z: 0, vis: 0, spin: 0 };
  function droneGrab(run, age) {
    const d = run.death;
    const top = (TOP[run.world.row(d.row).type] ?? 0);
    const tx = d.x, tz = -d.row;
    if (age < 0.38) {
      const k = age / 0.38, e = k * k;
      return { x: tx + (1 - e) * 1.5, y: top + 1.1 + (1 - e) * 5, z: tz + (1 - e) * 1.2 };
    }
    const u = age - 0.38;
    return { x: tx - u * 1.5, y: top + 1.1 + u * u * 9 + u * 2, z: tz - u * 5 };
  }
  function drawDrone(run, t, dt, warn) {
    let want = false, x = dr.x, y = dr.y, z = dr.z;
    if (run && !run.alive && run.death.kind === 'drone') {
      const g = droneGrab(run, run.t - run.death.t);
      x = g.x; y = g.y; z = g.z; want = true;
    } else if (run && warn) {
      want = true;
      x = damp(dr.x, pose.x + Math.sin(t * 1.3) * 0.8, 5, dt);
      z = damp(dr.z, pose.z + 0.4, 5, dt);
      y = damp(dr.y, (pose.y || 0) + 3.4 + Math.sin(t * 3.1) * 0.15, 4, dt);
    } else {
      y = dr.y + dt * 9;
    }
    dr.x = x; dr.y = y; dr.z = z;
    dr.vis = want ? 1 : (y > (pose.y || 0) + 12 ? 0 : dr.vis);
    drone.visible = dr.vis > 0;
    if (!want && !drone.visible) { dr.y = (pose.y || 0) + 14; dr.x = pose.x; dr.z = pose.z; }
    drone.position.set(x, y, z);
    drone.rotation.set(0, Math.sin(t * 0.9) * 0.4, Math.sin(t * 2.3) * 0.06);
    dr.spin += dt * 40;
    for (const r of rotors) r.rotation.y = dr.spin;
  }

  // ---- particles and rings ----
  const pcol = new THREE.Color();
  function burst({ x, y, z, n = 10, speed = [1, 3], up = [1, 3], colors = ['#ffffff'], size = [0.06, 0.12], life = [0.35, 0.7], gravity = 9, spread = Math.PI * 2, angle = 0, drag = 1.5 }) {
    const count = reduced ? Math.ceil(n / 3) : n;
    for (let k = 0; k < count; k++) {
      if (parts.length >= PCAP) parts.shift();
      const a = angle + (Math.random() - 0.5) * spread, sp = speed[0] + Math.random() * (speed[1] - speed[0]);
      const l = life[0] + Math.random() * (life[1] - life[0]);
      parts.push({
        x, y, z, vx: Math.cos(a) * sp, vz: -Math.sin(a) * sp, vy: up[0] + Math.random() * (up[1] - up[0]),
        life: l, max: l, s: size[0] + Math.random() * (size[1] - size[0]), g: gravity, drag,
        c: colors[(Math.random() * colors.length) | 0], rx: Math.random() * 6, ry: Math.random() * 6, spin: (Math.random() - 0.5) * 14,
      });
    }
  }
  function ring(x, y, z, { size = 1, life = 0.7, color = '#c9fbff' } = {}) {
    const r = rings.find((q) => q.t >= q.life) || rings[0];
    r.t = 0; r.life = life; r.size = size;
    r.mesh.position.set(x, y, z);
    r.mesh.material.color.set(color);
    r.mesh.visible = true;
  }
  function updateFx(dt) {
    let n = 0;
    for (let k = parts.length - 1; k >= 0; k--) {
      const p = parts[k];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(k, 1); continue; }
      const f = Math.exp(-p.drag * dt);
      p.vx *= f; p.vz *= f; p.vy -= p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rx += p.spin * dt; p.ry += p.spin * 0.7 * dt;
    }
    for (const p of parts) {
      const s = p.s * Math.min(1, (p.life / p.max) * 2.2);
      tmpE.set(p.rx, p.ry, 0);
      tmpQ.setFromEuler(tmpE);
      tmpM.compose(tmpV.set(p.x, p.y, p.z), tmpQ, tmpS.set(s, s, s));
      bits.setMatrixAt(n, tmpM);
      pcol.set(p.c);
      bits.setColorAt(n, pcol);
      n++;
    }
    bits.count = n;
    bits.instanceMatrix.needsUpdate = true;
    if (bits.instanceColor) bits.instanceColor.needsUpdate = true;
    for (const r of rings) {
      if (r.t >= r.life) { r.mesh.visible = false; continue; }
      r.t += dt;
      const k = Math.min(1, r.t / r.life);
      const s = r.size * (0.25 + k * 1.1);
      r.mesh.scale.set(s, 1, s);
      r.mesh.material.opacity = (1 - k) * 0.85;
    }
  }

  // ---- the camera ----
  const cam = { row: 0, x: 0, shakeX: 0, shakeY: 0, ready: false };
  function updateCamera(px, pz, dt, snap) {
    const row = -pz;
    const wantX = clamp(px * 0.5, -1.7, 1.7);
    if (snap || !cam.ready) { cam.row = row; cam.x = wantX; cam.ready = true; }
    cam.row = damp(cam.row, row, 6.5, dt);
    cam.x = damp(cam.x, wantX, 4, dt);
    camTarget.set(cam.x, 0, -(cam.row + ahead));
    camPos.copy(offset).multiplyScalar(dist).add(camTarget);
    camPos.x += cam.shakeX; camPos.y += cam.shakeY;
    camera.position.copy(camPos);
    camera.lookAt(camTarget.x + cam.shakeX * 0.5, camTarget.y, camTarget.z);
    if (shadows) {
      sun.target.position.set(camTarget.x, 0, camTarget.z - 2);
      sun.position.copy(SUN_DIR).multiplyScalar(30).add(sun.target.position);
      sun.target.updateMatrixWorld();
    }
  }

  // ---- one frame ----
  // state: { world, run, t, dt, title, warn, shake: { x, y }, snap }
  function render(state) {
    const { world, run, t, dt } = state;
    riverTime.value = t;
    if (run) {
      if (run.alive) playerPose(run, t, dt, { title: state.title });
      else deathPose(run, Math.max(0, run.t - run.death.t));
    }
    cam.shakeX = state.shake?.x || 0;
    cam.shakeY = state.shake?.y || 0;
    const focusZ = run && !run.alive && run.death.kind === 'train' ? -run.death.row : pose.z;
    const focusX = run && !run.alive && run.death.kind === 'train' ? run.death.x : pose.x;
    updateCamera(focusX, focusZ, dt, state.snap);
    const from = Math.floor(cam.row) - back, to = Math.ceil(cam.row) + front;
    if (world !== curWorld || from !== lo || to !== hi || state.relayout) layout(world, from, to);
    drawMovers(world, t, run);
    // her
    player.position.set(pose.x, pose.y, pose.z);
    player.rotation.set(pose.tilt, pose.rot, pose.roll, 'YXZ');
    squash.scale.set(pose.sx, pose.sy, pose.sz);
    player.visible = Boolean(run);
    if (run && blobs && !(!run.alive && (run.death.kind === 'drone' || run.death.kind === 'train'))) {
      const ground = run.ride || (run.hop?.raft) ? DECK : TOP[world.row(Math.round(-pose.z)).type] ?? 0;
      const lift = Math.max(0, pose.y - ground);
      const s = 0.62 * Math.max(0.5, 1 - lift * 0.6);
      blob(pose.x, ground, pose.z, s, s);
    }
    if (blobs) blobs.end();
    // the dizzy stars over a flattened her
    const flat = run && !run.alive && run.death.kind === 'car';
    for (let k = 0; k < stars.length; k++) {
      stars[k].visible = Boolean(flat);
      if (!flat) continue;
      const a = t * 4 + (k * Math.PI * 2) / 3;
      stars[k].position.set(pose.x + Math.cos(a) * 0.42, pose.y + 0.5 + Math.sin(t * 6 + k) * 0.05, pose.z + Math.sin(a) * 0.32);
      stars[k].rotation.set(t * 3, t * 4 + k, 0);
      const s = 0.9 + Math.sin(t * 8 + k * 2) * 0.15;
      stars[k].scale.set(s, s, s);
    }
    drawDrone(run, t, dt, state.warn);
    updateFx(dt);
    renderer.render(scene, camera);
  }

  // a 3D point on the screen (CSS pixels): for the floating words
  const pv = new THREE.Vector3();
  function project(x, y, z) {
    pv.set(x, y, z).project(camera);
    return { x: (pv.x * 0.5 + 0.5) * W, y: (-pv.y * 0.5 + 0.5) * H, behind: pv.z > 1 };
  }

  // a picture of a character for the picker: rendered once, kept as an image
  const thumbs = new Map();
  function thumb(id, size = 160) {
    if (thumbs.has(id)) return thumbs.get(id);
    const S = size * 2;
    const rt = new THREE.WebGLRenderTarget(S, S, { colorSpace: THREE.SRGBColorSpace, samples: 4 });
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight('#ffffff', '#b9a8e6', 2.1));
    const l = new THREE.DirectionalLight('#fff3e3', 2.0);
    l.position.set(-1.2, 2, 2.4);
    sc.add(l);
    const g = geo(`char:${id}`, CHARACTER_MODELS[id] || CHARACTER_MODELS.agi, CHAR_UNIT, 0.5);
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(g.body, mats.pair), new THREE.Mesh(g.hull, mats.ink));
    grp.rotation.y = Math.PI + 0.5;
    sc.add(grp);
    const box = g.body.boundingBox;
    const h = box.max.y - box.min.y;
    const cy = box.min.y + h * 0.52;
    const cm = new THREE.PerspectiveCamera(24, 1, 0.1, 50);
    const dd = (h * 0.62) / Math.tan(THREE.MathUtils.degToRad(12));
    cm.position.set(0.15, cy + dd * 0.32, dd);
    cm.lookAt(0, cy, 0);
    const prevFog = sc.fog;
    sc.background = null;
    renderer.setRenderTarget(rt);
    renderer.setClearColor('#000000', 0);
    renderer.clear();
    renderer.render(sc, cm);
    const px = new Uint8Array(S * S * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, S, S, px);
    renderer.setRenderTarget(null);
    renderer.setClearColor(BG, 1);
    rt.dispose();
    void prevFog;
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    for (let yy = 0; yy < S; yy++) img.data.set(px.subarray((S - 1 - yy) * S * 4, (S - yy) * S * 4), yy * S * 4);
    ctx.putImageData(img, 0, 0);
    const out = document.createElement('canvas');
    out.width = size; out.height = size;
    const o = out.getContext('2d');
    o.imageSmoothingQuality = 'high';
    o.drawImage(c, 0, 0, size, size);
    const url = out.toDataURL('image/png');
    thumbs.set(id, url);
    return url;
  }

  return {
    renderer, scene, camera,
    resize, render, project, thumb, burst, ring, setCharacter,
    get pose() { return pose; },
    setBest(row) { if (row !== bestRow) { for (const k of [...decals.keys()]) if (k.startsWith('best')) dropDecal(k); bestRow = row; lo = 1e9; } },
    fontsLoaded() { fontsReady = true; lo = 1e9; },
    charge(on) { chargeTarget = on ? 1 : 0; },
    landed() { landT = 0; },
    resetCamera() { cam.ready = false; rotNow = 0; landT = 1; charge = 0; chargeTarget = 0; parts.length = 0; dr.y = 14; },
    surfaceAt(world, i, raft = false) { return raft ? DECK : TOP[world.row(i).type] ?? 0; },
    get deck() { return DECK; },
  };
}
