// The owner's new character is a skinned Gaussian splat, with a separately
// retargeted hello clip. Keep the existing stage camera, controls and effects.
import * as THREE from 'three';
import * as pc from 'playcanvas';
import { Scene, Character, Animation } from '@viggle/splat-engine';
import { createSplatMotion } from './agi1-splat-motion.js';
import { createAgi1SplatFace } from './agi1-splat-face.js';

export const AGI1_SPLAT_ASSETS = {
  character: '/models/agi1-splat.vsplat?v=20261025-logo2',
  hello: '/models/agi1-wave-hello.glb?v=20261025-hand',
};
const HEIGHT = 1.62;
const SOURCE_HEIGHT = 1.8667856454849243;
const HELLO_NAME = 'agi1-hello';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Separate from the renderer so a greeting's once-only/replay behavior can be
// checked without a GPU. Repeated requests while waving do not restart it.
export function createGreetingPlayback(character, { name = HELLO_NAME, duration = 1.7 } = {}) {
  let elapsed = 0, active = false;
  return {
    start() {
      if (active) return false;
      if (character.crossfadeTo(name, { duration: 0.2, loop: false, rootMotion: false }) === false) return false;
      elapsed = 0;
      active = true;
      return true;
    },
    update(dt) {
      if (!active || !Number.isFinite(dt) || dt <= 0) return;
      elapsed += dt;
      if (elapsed >= duration) {
        active = false;
        character.armature.stop(0.3);
      }
    },
    get active() { return active; },
  };
}

export async function loadAgi1Splat({ canvas, camera, mobile = false, reducedMotion = false, onProgress = () => {} }) {
  const overlay = document.createElement('canvas');
  overlay.className = 'agi1-splat-canvas';
  overlay.setAttribute('aria-hidden', 'true');
  Object.assign(overlay.style, {
    position: 'absolute', inset: '0', width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: '1', visibility: 'hidden',
  });
  canvas.parentElement?.append(overlay);
  let scene;
  try {
    onProgress(0.05);
    scene = await Scene.create(overlay, {
      backend: 'webgl', antialias: false, depth: true,
      // This also requests an alpha-capable backbuffer in splat-engine 0.3.2.
      preserveDrawingBuffer: true, bgColor: { r: 0, g: 0, b: 0, a: 0 },
      maxPixelRatio: mobile ? 1 : 1.5, fov: camera.fov, near: camera.near, far: camera.far,
    });
    const character = await Character.load(scene, AGI1_SPLAT_ASSETS.character, {
      name: 'AGI-1', position: { x: 0, y: 0, z: 0 },
    });
    onProgress(0.7);
    const clip = await Animation.loadGlb(scene, AGI1_SPLAT_ASSETS.hello, HELLO_NAME);
    onProgress(0.95);

    const holder = new THREE.Group(), fx = new THREE.Group(), root = new THREE.Group();
    holder.add(fx); fx.add(root);
    root.name = 'AGI-1 splat';
    root.scale.setScalar(HEIGHT / SOURCE_HEIGHT);
    // The supplied character faces +X; the website's front camera faces +Z.
    root.rotation.y = -Math.PI / 2;
    const hitBox = new THREE.Mesh(new THREE.BoxGeometry(0.72, HEIGHT, 0.48), new THREE.MeshBasicMaterial());
    hitBox.visible = false;
    hitBox.position.y = HEIGHT / 2;
    fx.add(hitBox);
    const mark = (name, x, y, z) => {
      const point = new THREE.Object3D(); point.name = name;
      point.position.set(x, y, z); root.add(point); return point;
    };
    const marks = {
      head: mark('head', 0, 1.63, 0), headTop: mark('headTop', 0, SOURCE_HEIGHT, 0),
      chest: mark('chest', 0, 1.3, 0),
      hands: ['r', 'l'].map((side) => [
        mark(`hand_${side}`, 0, 0.9, side === 'l' ? 0.3 : -0.3),
        mark(`middle_03_${side}`, 0, 0.8, side === 'l' ? 0.3 : -0.3),
        mark(`lowerarm_${side}`, 0, 1.1, side === 'l' ? 0.3 : -0.3),
      ]),
    };
    const mount = new pc.Entity('AGI-1 stage transform');
    scene.contentRoot.addChild(mount);
    character.armature.entity.reparent(mount);
    character.setPosition(0, 0, 0);
    const arm = character.armature;
    const boneIds = Object.fromEntries(arm.rigBoneNames.map((name, i) => [name.toLowerCase(), i]));
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    const invRoot = new THREE.Matrix4(), jointPos = new pc.Vec3();
    const sync = (sourceCamera = camera) => {
      root.updateWorldMatrix(true, true);
      root.matrixWorld.decompose(p, q, s);
      mount.setPosition(p.x, p.y, p.z);
      mount.setRotation(q.x, q.y, q.z, q.w);
      mount.setLocalScale(s.x, s.y, s.z);
      sourceCamera.updateWorldMatrix(true, false);
      sourceCamera.matrixWorld.decompose(p, q, s);
      scene.cameraEntity.setPosition(p.x, p.y, p.z);
      scene.cameraEntity.setRotation(q.x, q.y, q.z, q.w);
      const cam = scene.cameraEntity.camera;
      cam.fov = sourceCamera.getEffectiveFOV();
      cam.nearClip = sourceCamera.near; cam.farClip = sourceCamera.far;
      cam.aspectRatioMode = pc.ASPECT_MANUAL;
      cam.aspectRatio = sourceCamera.aspect;
    };
    const updateMarks = () => {
      invRoot.copy(root.matrixWorld).invert();
      const place = (marker, bone, lift = 0) => {
        const m = arm.boneWorldMatrices[boneIds[bone]];
        if (!m) return;
        m.getTranslation(jointPos);
        marker.position.set(jointPos.x, jointPos.y, jointPos.z).applyMatrix4(invRoot);
        marker.position.y += lift;
      };
      place(marks.head, 'head', 0.07);
      place(marks.headTop, 'head', 0.27);
      place(marks.chest, 'spine_05');
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? 'r' : 'l';
        ['hand', 'middle_03', 'lowerarm'].forEach((name, j) => place(marks.hands[i][j], `${name}_${side}`));
      }
      root.updateMatrixWorld(true);
    };

    // Initialize PlayCanvas, then give ownership of all ticks to the existing
    // stage loop. Hidden tabs/offscreen stages do no extra rendering or posing.
    scene.app.start();
    cancelAnimationFrame(scene.app.frameRequestId);
    scene.app.frameRequestId = null;
    scene.app.autoRender = false;
    let disposed = false, controller;
    const model = {
      kind: 'agi1', root, holder, fx, hitBox, marks,
      mixer: null, focusBones: [marks.head, marks.headTop],
      create(opts) {
        controller ??= createController({ character, clip, fx, marks, sync, updateMarks, scene, reducedMotion, ...opts });
        return controller;
      },
      setVisible(on) { overlay.style.visibility = on && holder.parent ? 'visible' : 'hidden'; },
      render(sourceCamera = camera) {
        if (disposed) return;
        const host = canvas.parentElement;
        if (host && overlay.parentElement !== host) host.append(overlay);
        const visible = !!holder.parent && holder.visible && canvas.isConnected;
        overlay.style.visibility = visible ? 'visible' : 'hidden';
        if (!visible) return;
        // Match the stage's drawing buffer exactly, including its pixel cap.
        // Do not emit PC's framerender event here: its resize observer would
        // otherwise apply a second, independent device-pixel-ratio calculation.
        const w = Math.max(1, canvas.width), h = Math.max(1, canvas.height);
        if (overlay.width !== w || overlay.height !== h) scene.graphicsDevice.setResolution(w, h);
        sync(sourceCamera);
        scene.app.render();
        scene.app.fire('frameend');
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        scene.destroy(); overlay.remove();
        hitBox.geometry.dispose(); hitBox.material.dispose();
      },
    };
    sync();
    onProgress(1);
    return model;
  } catch (error) {
    scene?.destroy(); overlay.remove();
    throw error;
  }
}

function createController({ character, clip, fx, marks, sync, updateMarks, scene, effects, onGlow = () => {}, reducedMotion }) {
  const arm = character.armature;
  const motion = createSplatMotion(arm, { reducedMotion });
  const face = createAgi1SplatFace(arm);
  const greeting = createGreetingPlayback(character, { duration: Math.max(0.1, (clip.numFrames - 1) / 30) });
  let clock = 0, level = 0, attention = 'idle', mood = 'neutral';
  let pointer = null, closeUp = false, hop = -1, spin = -1, nod = -1, shake = -1, dance = -1;
  let moodUntil = 0;
  arm.poseModifier = (pose) => {
    motion.apply(pose, { waving: greeting.active });
    face.apply(pose);
  };
  // Prepare the relaxed pose before the holder becomes visible. The first
  // hello then blends from this pose, instead of exposing the bind-pose arms.
  sync();
  arm.forcePoseRefresh();
  updateMarks();
  const hearts = (marker, count) => effects?.spawnHearts(marker.getWorldPosition(new THREE.Vector3()), { count });
  function react(type) {
    mood = type === 'tap' ? 'happy' : type;
    moodUntil = clock + 4.5;
    if (type === 'wave') greeting.start();
    if (type === 'happy' || type === 'tap' || type === 'celebrate') {
      if (!reducedMotion) hop = 0;
      hearts(marks.chest, type === 'celebrate' ? 18 : 8);
    }
    if (type === 'love') { if (!reducedMotion) spin = 0; hearts(marks.head, 18); onGlow(0xff5c8a, 1); }
    if (type === 'shy') { hearts(marks.head, 4); onGlow(0xff5c8a, 0.5); }
    if (type === 'nod' || type === 'okay') nod = 0;
    if (type === 'worried') shake = 0;
    if (type === 'dance' && !closeUp && !reducedMotion && !greeting.active) dance = 0;
  }
  return {
    beforeMixer() {},
    update(dt) {
      dt = Number.isFinite(dt) ? clamp(dt, 0, 0.1) : 0;
      clock += dt; greeting.update(dt);
      if (clock >= moodUntil) mood = 'neutral';
      fx.position.y = 0; fx.rotation.y = 0;
      if (hop >= 0) { hop += dt; if (hop >= 0.62) hop = -1; else fx.position.y = Math.sin(hop / 0.62 * Math.PI) * 0.1; }
      if (spin >= 0) { spin += dt; if (spin >= 0.9) spin = -1; else { const t = spin / 0.9; fx.rotation.y = (t * t * (3 - 2 * t)) * Math.PI * 2; } }
      if (nod >= 0 && (nod += dt) >= 0.6) nod = -1;
      if (shake >= 0 && (shake += dt) >= 1.3) shake = -1;
      if (dance >= 0 && (dance += dt) >= 4) dance = -1;
      motion.update(dt, { pointer, level, attention, closeUp, waving: greeting.active, dance, nod, shake, mood });
      face.update(dt, { level, mood, attention });
      sync(); scene.app.update(dt); updateMarks();
    },
    react,
    hello() { mood = 'wave'; moodUntil = clock + 3; dance = -1; greeting.start(); },
    setPointer(value) { pointer = value; },
    setTalk(value) { level = Number.isFinite(value) ? clamp(value, 0, 1) : 0; },
    setAttention(value) { attention = value === 'thinking' || value === 'listening' ? value : 'idle'; },
    setCloseUp(value) { closeUp = !!value; if (closeUp) dance = -1; },
    get dancing() { return dance >= 0; }, get waving() { return greeting.active; },
    blink() { face.blinkNow(); },
    get mouthOpen() { return face.mouthOpen; }, get blinking() { return face.blink; },
    get attention() { return attention; }, get mood() { return mood; },
    get expression() { return face.expression; }, get hair() { return { on: false, lag: 0, twist: 0, flare: 0 }; },
  };
}
