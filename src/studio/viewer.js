// AGI-1's 3D character studio (2026-10-10): a character on its page (agi1.app/studio/<id>), in 3D with three.js. Its file
// (made by Meshy, kept small on our server: its bones and its moves, one clip each, named as Meshy's library names them
// and in src/studio/rules.js MOVES' order) comes from our own address; it stands in its idle and plays a move when its page
// asks (its chat box, its buttons). Nothing here talks to anyone. Loaded only on a character's page (three.js is big; the
// studio's own page never loads it).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LOOPING, MOVES } from './rules.js';

const LOOPS = 3;          // a move that goes on (dance, walk, party) plays this many times, then it stands again
const FADE = 0.3;         // seconds from one move to the next
const FOV = 26;
const SAMPLES = 8;        // each move looked at this many times a second (6 to 20 times), to frame every pose of it
const VERTS = 1000;       // at most this many of a mesh's points looked at each time (a box, not a picture)

// Its clips, by move: by the library's names when every clip has one (Meshy names them so), else in the order asked for.
// "Armature|Idle" counts as "Idle" (Blender's way of naming them). → Map(move → clip)
const norm = (s) => String(s ?? '').split('|').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
export function clipsFor(animations, moves) {
  const byName = new Map(MOVES.map((m) => [norm(m.clip), m.name]));
  const named = animations.map((c) => byName.get(norm(c.name)));
  const out = new Map();
  if (named.length && named.every(Boolean) && new Set(named).size === named.length) {
    animations.forEach((c, i) => { if (moves.includes(named[i])) out.set(named[i], c); });
  } else {
    animations.forEach((c, i) => { if (i < moves.length) out.set(moves[i], c); });
  }
  return out;
}

// A move that walks its hips across the floor plays in place: of the node that travels furthest across the floor (its
// hips, or its root), the drift from its first key to its last is taken out, a little more at each key. Only across the
// floor, as the world sees it (whatever its armature's turn and scale): a jump still jumps, and a sway still sways.
// → the same clip, changed
const _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _d = new THREE.Vector3();
export function inPlace(clip, model) {
  let best = null, most = 1e-9;
  for (const track of clip.tracks) {
    if (track.getValueSize() !== 3 || track.times.length < 2) continue;
    const { nodeName, propertyName } = THREE.PropertyBinding.parseTrackName(track.name);
    if (propertyName !== 'position') continue;
    const node = model.getObjectByName(nodeName);
    if (!node) continue;
    const v = track.values, n = track.times.length;
    if (node.parent) node.parent.matrixWorld.decompose(_p, _q, _s); else { _q.identity(); _s.set(1, 1, 1); }
    _d.set(v[(n - 1) * 3] - v[0], v[(n - 1) * 3 + 1] - v[1], v[(n - 1) * 3 + 2] - v[2]).multiply(_s).applyQuaternion(_q);
    const across = Math.hypot(_d.x, _d.z);
    if (across > most) { most = across; best = { track, q: _q.clone(), s: _s.clone(), d: _d.clone() }; }
  }
  if (!best) return clip;
  // the drift across the floor, back in the node's own terms
  const local = new THREE.Vector3(best.d.x, 0, best.d.z).applyQuaternion(best.q.invert()).divide(best.s);
  const { times: t, values: v } = best.track;
  const t0 = t[0], span = t[t.length - 1] - t0 || 1;
  for (let i = 0; i < t.length; i++) {
    const k = (t[i] - t0) / span;
    v[i * 3] -= local.x * k; v[i * 3 + 1] -= local.y * k; v[i * 3 + 2] -= local.z * k;
  }
  return clip;
}

// Where a model's points are right now (its bones' pose), a few of each mesh's, into a box (world terms)
const _v = new THREE.Vector3();
export function poseBox(model, box = new THREE.Box3()) {
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    const pos = o.isMesh && o.geometry?.attributes?.position;
    if (!pos) return;
    const step = Math.max(1, Math.ceil(pos.count / VERTS));
    for (let i = 0; i < pos.count; i += step) box.expandByPoint(o.getVertexPosition(i, _v).applyMatrix4(o.matrixWorld));
  });
  return box;
}

// When to look at a move: evenly through it, and where a node it moves is furthest one way or another (a jump's top).
// → its times (seconds), each once
export function lookTimes(clip) {
  const d = Math.max(clip.duration, 1e-3), n = Math.min(20, Math.max(6, Math.round(d * SAMPLES) + 1));
  const times = new Set(Array.from({ length: n }, (_, i) => (d * i) / (n - 1)));
  for (const track of clip.tracks) {
    const size = track.getValueSize();
    if (size !== 3 || !track.name.endsWith('.position')) continue;
    const v = track.values;
    for (let axis = 0; axis < 3; axis++) {
      let lo = 0, hi = 0;
      for (let k = 1; k < track.times.length; k++) {
        if (v[k * 3 + axis] < v[lo * 3 + axis]) lo = k;
        if (v[k * 3 + axis] > v[hi * 3 + axis]) hi = k;
      }
      times.add(track.times[lo]); times.add(track.times[hi]);
    }
  }
  return [...times].map((t) => Math.min(Math.max(t, 0), d - 1e-4)).sort((a, b) => a - b);
}

// The box of every pose of its moves, so a raised arm or a jump stays in the picture. Its bones are put back as they
// were after. → a Box3
export function movesBox(model, clips) {
  const rest = [];
  model.traverse((o) => rest.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]));
  const box = new THREE.Box3();
  const mixer = new THREE.AnimationMixer(model);
  for (const clip of clips) {
    const action = mixer.clipAction(clip);
    action.play();
    for (const t of lookTimes(clip)) {
      mixer.setTime(t);
      poseBox(model, box);
    }
    action.stop();
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(model);
  for (const [o, p, q, s] of rest) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(s); }
  model.updateMatrixWorld(true);
  if (box.isEmpty()) poseBox(model, box);
  return box;
}

// The camera that frames a box (its whole height, with a little room), for a canvas of this shape. → { distance, center }
export function framing(box, aspect, fov = FOV) {
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const t = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const byHeight = (size.y * 0.56) / t, byWidth = (Math.max(size.x, size.z) * 0.6) / (t * Math.max(aspect, 0.2));
  return { distance: Math.max(byHeight, byWidth) + size.z / 2, center };
}

// → { play(move) → true if it has it, moves (the ones its file has), dispose() }. Throws when it can't be shown (no
// WebGL, its file can't be read): then its page shows its picture.
export async function createViewer(canvas, { url, moves, onMove = () => {} }) {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, alpha: true, powerPreference: 'high-performance' });
  try {
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    return await build(renderer, canvas, { url, moves, onMove, coarse });
  } catch (err) {
    renderer.dispose();
    throw err;
  }
}

async function build(renderer, canvas, { url, moves, onMove, coarse }) {
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  room.dispose?.();
  scene.environmentIntensity = 0.75;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a2a5a, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(1.2, 3, 2.4);
  scene.add(sun);

  const gltf = await new GLTFLoader().loadAsync(url);
  const model = gltf.scene;
  model.traverse((o) => {
    if (o.isMesh) {
      o.frustumCulled = false;                         // a skinned mesh's box is its rest pose's: a move could leave it
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m && 'metalness' in m && !m.metalnessMap && m.metalness > 0.2) m.metalness = 0.2;   // glTF's default (1) reads as chrome
      }
    }
  });
  scene.add(model);
  model.updateMatrixWorld(true);

  // its moves, each in place, and the box all of them fit in
  const clips = clipsFor(gltf.animations, moves);
  for (const clip of clips.values()) inPlace(clip, model);
  if (!clips.size) throw new Error('no moves');
  const box = movesBox(model, [...clips.values()]);
  const mixer = new THREE.AnimationMixer(model);
  const actions = new Map([...clips].map(([move, clip]) => [move, mixer.clipAction(clip)]));
  const idle = actions.get('idle') || actions.values().next().value;
  idle.setLoop(THREE.LoopRepeat, Infinity).play();
  let current = idle;
  mixer.update(0);

  // the camera: its whole body (and every move of it), a little from above
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 200);
  const controls = coarse ? null : new OrbitControls(camera, canvas);
  function frame() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const { distance, center } = framing(box, camera.aspect);
    camera.position.set(center.x, center.y + distance * 0.08, center.z + distance);
    camera.near = distance / 100; camera.far = distance * 10;
    camera.updateProjectionMatrix();
    camera.lookAt(center);
    if (controls) { controls.target.copy(center); controls.minDistance = distance * 0.6; controls.maxDistance = distance * 1.6; controls.update(); }
  }
  if (controls) {
    Object.assign(controls, { enableZoom: false, enablePan: false, enableDamping: true, dampingFactor: 0.08, rotateSpeed: 0.6 });
    controls.minPolarAngle = Math.PI * 0.25; controls.maxPolarAngle = Math.PI * 0.55;   // never from under its feet
  }
  frame();
  const resize = new ResizeObserver(() => frame());
  resize.observe(canvas);

  // a move, asked for: from whatever it's doing, back to standing when it's done
  function fadeTo(action) {
    if (action === current) { action.reset().play(); return; }
    action.reset().setEffectiveWeight(1).play();
    current.crossFadeTo(action, FADE, false);
    current = action;
  }
  mixer.addEventListener('finished', (e) => { if (e.action === current && current !== idle) { fadeTo(idle); onMove('idle'); } });
  function play(name) {
    const action = actions.get(name);
    if (!action) return false;
    if (action !== idle) {
      const loops = LOOPING.has(name);
      action.setLoop(loops ? THREE.LoopRepeat : THREE.LoopOnce, loops ? LOOPS : 1);
      action.clampWhenFinished = true;
    }
    fadeTo(action);
    onMove(name);
    wake();
    return true;
  }

  // drawn only while it's on screen and the page is shown, at most about 60 times a second
  const clock = new THREE.Clock();
  let shown = true, raf = 0, last = 0;
  const loop = (t) => {
    raf = 0;
    if (!shown || document.visibilityState !== 'visible') return;
    raf = requestAnimationFrame(loop);
    if (t - last < 15) return;
    last = t;
    mixer.update(Math.min(clock.getDelta(), 0.1));
    controls?.update();
    renderer.render(scene, camera);
  };
  function wake() { if (!raf && shown && document.visibilityState === 'visible') { clock.getDelta(); raf = requestAnimationFrame(loop); } }
  const seen = new IntersectionObserver((entries) => { shown = entries.some((e) => e.isIntersecting); wake(); });
  seen.observe(canvas);
  document.addEventListener('visibilitychange', wake);
  wake();

  return {
    play,
    moves: [...actions.keys()],
    dispose() {
      cancelAnimationFrame(raf);
      seen.disconnect(); resize.disconnect();
      document.removeEventListener('visibilitychange', wake);
      controls?.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
