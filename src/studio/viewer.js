// AGI-1's 3D character studio (2026-10-10): a character on its page (agi1.app/studio/<id>), in 3D with three.js. Its file
// (made by Meshy, kept small on our server: its bones and its moves, one clip each, named as Meshy's library names them
// (a move described in words: own_<its name>), idle first, then its library moves, then its own) comes from our own
// address; it stands in its idle and plays a move when its page
// asks (its chat box, its buttons). Nothing here talks to anyone. Loaded only on a character's page (three.js is big; the
// studio's own page never loads it). Since 2026-10-13 (the owner: "i wish theres more tools to customize the 3d like in
// meshy"): every move of the library and its moves described in words, and its page's tools (src/studio/stage-tools.js): its
// lights, how it's drawn (its colors, clay, a wireframe), a turntable spin, a zoom, its moves' speed and a frozen pose, and
// its pictures and clips' frames, drawn in the visitor's browser.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LOOPING, MOVE_LIBRARY, MOVE_BY_NAME, ownClip } from './rules.js';
import { LIGHTS, LOOKS, ZOOM, SPIN_TURN_S, SPEEDS, ratioFor } from './stage-tools.js';

const LOOPS = 3;          // a move that goes on (dance, walk, party) plays this many times, then it stands again
const FADE = 0.3;         // seconds from one move to the next
const FOV = 26;
const SAMPLES = 8;        // each move looked at this many times a second (6 to 20 times), to frame every pose of it
const VERTS = 1000;       // at most this many of a mesh's points looked at each time (a box, not a picture)

// Its clips, by move: by their names when every clip has one we know (the library's names, as Meshy names them; a move
// described in words, own_<its name>: server/studio.js), else in the order asked for (its file's: idle, its library moves,
// its own). "Armature|Idle" counts as "Idle" (Blender's way of naming them). → Map(move → clip)
const norm = (s) => String(s ?? '').split('|').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
export function clipsFor(animations, moves) {
  const byName = new Map(MOVE_LIBRARY.map((m) => [norm(m.clip), m.name]));
  for (const m of moves) if (!MOVE_BY_NAME.has(m)) byName.set(norm(ownClip(m)), m);
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

// Where the camera looks at a zoom: at ZOOM.MIN (1×) the middle of the box of every pose of its moves, as before; at ZOOM.MAX
// its face, a little under the top of its box standing still (rest: its idle's box, so a jump's top never pulls the camera
// into the air above it). moves, rest: Box3s → the height to look at (y)
export const HEAD = 0.13;
export function aimFor(moves, rest, zoom) {
  const z = Math.min(ZOOM.MAX, Math.max(ZOOM.MIN, Number(zoom) || ZOOM.MIN));
  const k = (z - ZOOM.MIN) / (ZOOM.MAX - ZOOM.MIN);
  const mid = (moves.min.y + moves.max.y) / 2;
  const face = rest.max.y - (rest.max.y - rest.min.y) * HEAD;
  return mid + (face - mid) * k;
}

// Its light rigs (src/studio/stage-tools.js LIGHTS): the soft room's light (env), a sky light (hemi: its sky, its ground, its
// strength), a sun (its color, strength and where it comes from) and two rim lights behind it ([strength, color]: on its left,
// on its right). Studio is the light it always had.
export const RIGS = {
  studio: { env: 0.75, hemi: [0xffffff, 0x3a2a5a, 0.9], sun: [0xffffff, 1.6, [1.2, 3, 2.4]], rims: [[0, 0xffffff], [0, 0xffffff]] },
  soft: { env: 1.05, hemi: [0xffffff, 0x4b4566, 1.3], sun: [0xffffff, 0.65, [0.3, 2.2, 3]], rims: [[0, 0xffffff], [0, 0xffffff]] },
  golden: { env: 0.5, hemi: [0xffe2c2, 0x3d2648, 0.6], sun: [0xffa04d, 2.4, [-2.6, 1.3, 1.6]], rims: [[0.9, 0xffc27a], [0, 0xffffff]] },
  neon: { env: 0.3, hemi: [0x8f86ff, 0x10081f, 0.45], sun: [0xffffff, 0.4, [0.5, 2.5, 2.5]], rims: [[3.2, 0xff3fd2], [3.2, 0x3fe7ff]] },
  moon: { env: 0.22, hemi: [0x7d8cff, 0x05060f, 0.4], sun: [0xc4d4ff, 1.1, [-1.4, 3, -1.8]], rims: [[1.6, 0x9fb6ff], [0, 0xffffff]] },
};
const RIM_AT = [[-2.2, 1.6, -2.4], [2.2, 1.6, -2.4]];
// how it's drawn: clay (one matte grey for all of it), and a wireframe over its own surface written to depth only (pushed back
// a little), so only the lines on the side facing the camera show, like a mesh in a 3D tool (not an x-ray of every line in it)
const CLAY = { color: 0xd9d3c9, roughness: 0.82, metalness: 0 };
const WIRE = { color: 0xa78bfa, opacity: 0.9 };

// → { play(move) → true if it has it, moves (the ones its file has), its tools (setLight, setLook, setSpin, setFrozen, setSpeed,
// setZoom, resetView, zoom), capture(long, draw), hires(long) → undo, onFrame(fn) → off, dispose() }. Throws when it can't be
// shown (no WebGL, its file can't be read): then its page shows its picture.
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
  scene.environmentIntensity = RIGS.studio.env;
  const hemi = new THREE.HemisphereLight(...RIGS.studio.hemi);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(RIGS.studio.sun[0], RIGS.studio.sun[1]);
  sun.position.set(...RIGS.studio.sun[2]);
  scene.add(sun);
  const rims = RIM_AT.map((at) => {
    const l = new THREE.DirectionalLight(0xffffff, 0);
    l.position.set(...at);
    scene.add(l);
    return l;
  });

  const gltf = await new GLTFLoader().loadAsync(url);
  const model = gltf.scene;
  const meshes = [];
  model.traverse((o) => {
    if (o.isMesh) {
      o.frustumCulled = false;                         // a skinned mesh's box is its rest pose's: a move could leave it
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m && 'metalness' in m && !m.metalnessMap && m.metalness > 0.2) m.metalness = 0.2;   // glTF's default (1) reads as chrome
      }
      meshes.push(o);
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
  const rest = poseBox(model);                         // standing in its idle: where its face is, for the zoom

  // a turntable: it turns about the middle of its box, under lights that stay where they are (like a real one)
  const mid = box.getCenter(new THREE.Vector3());
  const turn = new THREE.Group();
  turn.position.set(mid.x, 0, mid.z);
  scene.add(turn);
  model.position.x -= mid.x;
  model.position.z -= mid.z;
  turn.add(model);
  model.updateMatrixWorld(true);

  // the camera: its whole body (and every move of it), a little from above; closer at a zoom, toward its face
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 200);
  const controls = coarse ? null : new OrbitControls(camera, canvas);
  const FRONT = new THREE.Vector3(0, 0.08, 1).normalize();
  const _dir = new THREE.Vector3();
  let zoom = ZOOM.MIN, base = null;
  function place(dir) {
    const d = base.distance / zoom;
    const aim = new THREE.Vector3(base.center.x, aimFor(box, rest, zoom), base.center.z);
    camera.position.copy(aim).addScaledVector(dir, d * Math.hypot(1, 0.08));
    camera.near = d / 100; camera.far = base.distance * 10;
    camera.updateProjectionMatrix();
    camera.lookAt(aim);
    if (controls) { controls.target.copy(aim); controls.minDistance = d * 0.6; controls.maxDistance = d * 1.6; controls.update(); }
  }
  function frame() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    base = framing(box, camera.aspect);
    place(FRONT);
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

  // ---------- its tools (2026-10-13) ----------
  // its light
  function setLight(key) {
    const r = RIGS[key];
    if (!r || !Object.hasOwn(LIGHTS, key)) return false;
    scene.environmentIntensity = r.env;
    hemi.color.setHex(r.hemi[0]); hemi.groundColor.setHex(r.hemi[1]); hemi.intensity = r.hemi[2];
    sun.color.setHex(r.sun[0]); sun.intensity = r.sun[1]; sun.position.set(...r.sun[2]);
    r.rims.forEach(([strength, color], n) => { rims[n].intensity = strength; rims[n].color.setHex(color); });
    wake();
    return true;
  }
  // how it's drawn: its own colors, clay, or its wireframe (two more passes of each of its meshes, made the first time)
  const originals = new Map(meshes.map((o) => [o, o.material]));
  let clay = null, wireMats = null, passes = null;
  function wirePasses() {
    if (passes) return passes;
    wireMats = [
      new THREE.MeshBasicMaterial({ colorWrite: false, polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 2 }),
      new THREE.MeshBasicMaterial({ color: WIRE.color, wireframe: true, transparent: true, opacity: WIRE.opacity }),
    ];
    passes = meshes.flatMap((o) => wireMats.map((mat) => {
      const p = o.isSkinnedMesh ? new THREE.SkinnedMesh(o.geometry, mat) : new THREE.Mesh(o.geometry, mat);
      p.position.copy(o.position); p.quaternion.copy(o.quaternion); p.scale.copy(o.scale);
      if (o.isSkinnedMesh) p.bind(o.skeleton, o.bindMatrix);
      if (o.morphTargetInfluences) { p.morphTargetInfluences = o.morphTargetInfluences; p.morphTargetDictionary = o.morphTargetDictionary; }
      p.frustumCulled = false;
      p.visible = false;
      o.parent.add(p);
      return p;
    }));
    return passes;
  }
  let look = 'color';
  function setLook(key) {
    if (!Object.hasOwn(LOOKS, key)) return false;
    look = key;
    if (key === 'clay' && !clay) clay = new THREE.MeshStandardMaterial(CLAY);
    if (key === 'wire') wirePasses();
    for (const o of meshes) { o.visible = key !== 'wire'; o.material = key === 'clay' ? clay : originals.get(o); }
    for (const p of passes || []) p.visible = key === 'wire';
    wake();
    return true;
  }
  // its zoom (the user's own turn of the camera kept, on a computer), and back to the front at 1× (its turntable's turn too)
  function setZoom(z) {
    zoom = Math.min(ZOOM.MAX, Math.max(ZOOM.MIN, Number(z) || ZOOM.MIN));
    place(controls ? _dir.copy(camera.position).sub(controls.target).normalize() : FRONT);
    wake();
    return zoom;
  }
  function resetView() {
    zoom = ZOOM.MIN;
    turn.rotation.y = 0;
    place(FRONT);
    wake();
  }
  let spinning = false, frozen = false;
  const SPIN = (Math.PI * 2) / SPIN_TURN_S;
  // one frame drawn again at about `long` px on its longest side, then draw(canvas) at once (a WebGL canvas can only be read in
  // the task it was drawn in), then back to the screen's own pixels → what draw returns
  function capture(long, draw) {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    const own = renderer.getPixelRatio();
    renderer.setPixelRatio(ratioFor(w, h, long, own));
    renderer.setSize(w, h, false);
    renderer.render(scene, camera);
    try {
      return draw(canvas);
    } finally {
      renderer.setPixelRatio(own);
      renderer.setSize(w, h, false);
      renderer.render(scene, camera);
    }
  }
  // drawn with more pixels while a clip is recorded (about `long` px on its longest side) → undo
  function hires(long) {
    const own = renderer.getPixelRatio();
    const set = (r) => { renderer.setPixelRatio(r); renderer.setSize(Math.max(1, canvas.clientWidth), Math.max(1, canvas.clientHeight), false); };
    set(ratioFor(canvas.clientWidth, canvas.clientHeight, long, own));
    return () => set(own);
  }

  // drawn only while it's on screen (or a clip is being recorded: onFrame) and the page is shown, at most about 60 times a second
  const clock = new THREE.Clock();
  const after = new Set();
  let shown = true, raf = 0, last = 0;
  const live = () => (shown || after.size > 0) && document.visibilityState === 'visible';
  const loop = (t) => {
    raf = 0;
    if (!live()) return;
    raf = requestAnimationFrame(loop);
    if (t - last < 15) return;
    last = t;
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!frozen) mixer.update(dt);
    if (spinning) turn.rotation.y = (turn.rotation.y + dt * SPIN) % (Math.PI * 2);
    controls?.update();
    renderer.render(scene, camera);
    for (const fn of after) fn(canvas);
  };
  function wake() { if (!raf && live()) { clock.getDelta(); raf = requestAnimationFrame(loop); } }
  const seen = new IntersectionObserver((entries) => { shown = entries.some((e) => e.isIntersecting); wake(); });
  seen.observe(canvas);
  document.addEventListener('visibilitychange', wake);
  wake();

  return {
    play,
    moves: [...actions.keys()],
    setLight,
    setLook,
    get look() { return look; },
    setSpin(on) { spinning = on === true; wake(); },
    setFrozen(on) { frozen = on === true; wake(); },
    setSpeed(s) {
      if (!SPEEDS.includes(Number(s))) return false;
      mixer.timeScale = Number(s);
      return true;
    },
    setZoom,
    get zoom() { return zoom; },
    resetView,
    capture,
    hires,
    // fn(canvas) right after each frame is drawn (a clip's frames) → off
    onFrame(fn) { after.add(fn); wake(); return () => { after.delete(fn); }; },
    dispose() {
      cancelAnimationFrame(raf);
      after.clear();
      seen.disconnect(); resize.disconnect();
      document.removeEventListener('visibilitychange', wake);
      controls?.dispose();
      clay?.dispose();
      for (const m of wireMats || []) m.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
