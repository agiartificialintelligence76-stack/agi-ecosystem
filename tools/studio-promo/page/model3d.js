// AGI Studio's launch video: the 3D model scene's figure. AGI Studio makes a 3D model from an influencer's full-body
// picture (the 3D service: shaped, given bones, taught moves); no real one was made for the video, so this is an
// illustration in Juno's colors (lavender hoodie, jeans, purple braids, glasses, headphones), built and posed in code
// with three.js, and labeled "Illustration" where it's shown. Everything is a function of the state it's given (no
// clock), drawn on its own WebGL canvas that the scene copies onto the frame.
import * as THREE from 'three';

const COL = {
  skin: 0x8a5634, hoodie: 0xb9a2e6, hoodie2: 0x9d84d6, jeans: 0x41618f, jeans2: 0x34507a, shoe: 0xf1eff6, sole: 0xc9c5d6,
  hair: 0x6c4fb0, hair2: 0x8467c8, glasses: 0x26222f, phones: 0x2c2a35, cup: 0x3ff0c3, eye: 0xffffff, iris: 0x2a1c14, mouth: 0x6e1f2c,
};

// the joints (their names, for the bones overlay) and how they connect
const BONES = [
  ['hips', 'spine'], ['spine', 'chest'], ['chest', 'neck'], ['neck', 'head'],
  ['chest', 'shoulderL'], ['shoulderL', 'elbowL'], ['elbowL', 'handL'],
  ['chest', 'shoulderR'], ['shoulderR', 'elbowR'], ['elbowR', 'handR'],
  ['hips', 'thighL'], ['thighL', 'kneeL'], ['kneeL', 'ankleL'],
  ['hips', 'thighR'], ['thighR', 'kneeR'], ['kneeR', 'ankleR'],
];

export function createModel3D(size = 720) {
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 30);
  camera.position.set(0, 1.08, 4.35);
  camera.lookAt(0, 0.86, 0);

  scene.add(new THREE.HemisphereLight(0xd9ccff, 0x2a1d3f, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(-2.2, 3.2, 3.4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xf2a5ff, 1.7); rim.position.set(2.6, 1.8, -2.6); scene.add(rim);
  const fill = new THREE.DirectionalLight(0x9ad8ff, 0.55); fill.position.set(3, 0.6, 2); scene.add(fill);

  // the turntable: a soft shadow and a thin ring
  const shadowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.002; scene.add(shadow);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.635, 96), new THREE.MeshBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.003; scene.add(ring);

  // two passes of every mesh: its colors (below the sweep) and a wireframe (above it, up to the reveal)
  const solidClip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 10);           // keeps y <= sweep
  const wireAbove = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);              // keeps y >= sweep
  const wireBelow = new THREE.Plane(new THREE.Vector3(0, -1, 0), 10);            // keeps y <= reveal
  const wireMat = new THREE.MeshBasicMaterial({ color: 0xc4b5fd, wireframe: true, transparent: true, opacity: 0.75, clippingPlanes: [wireAbove, wireBelow] });
  // the wireframe's hidden lines: each mesh's own surface, written to depth only (pushed back a little), so only the
  // lines on the side facing the camera show, like a mesh being built (not an x-ray of every shape inside it)
  const occMat = new THREE.MeshBasicMaterial({ colorWrite: false, polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 2, clippingPlanes: [wireAbove, wireBelow] });
  const mats = new Map();
  const mat = (color, o = {}) => {
    const k = `${color}:${o.r ?? 0.62}`;
    if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.62, metalness: 0, clippingPlanes: [solidClip] }));
    return mats.get(k);
  };
  const add = (parent, geo, color, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], o = {}) => {
    const solid = new THREE.Mesh(geo, mat(color, o));
    const occ = new THREE.Mesh(geo, occMat);
    const wire = new THREE.Mesh(geo, wireMat);
    for (const m of [solid, occ, wire]) { m.position.set(...pos); m.rotation.set(...rot); m.scale.set(...scale); parent.add(m); }
    return solid;
  };
  const joint = (parent, name, pos) => {
    const j = new THREE.Group(); j.name = name; j.position.set(...pos); parent.add(j); joints[name] = j; return j;
  };
  const joints = {};
  const cap = (r, h) => new THREE.CapsuleGeometry(r, h, 10, 24);
  const sph = (r) => new THREE.SphereGeometry(r, 40, 28);

  // ---- the body ----
  const root = new THREE.Group(); scene.add(root);
  const hips = joint(root, 'hips', [0, 0.92, 0]);
  add(hips, cap(0.142, 0.06), COL.jeans, [0, 0, 0], [0, 0, Math.PI / 2], [1, 1, 0.78]);
  const spine = joint(hips, 'spine', [0, 0.1, 0]);
  const chest = joint(spine, 'chest', [0, 0.22, 0]);
  // the hoodie: a rounded torso from the waist to the shoulders
  // (down past the waist, as a hoodie is worn: the jeans show from the hips down)
  const prof = [[0.0, -0.37], [0.14, -0.37], [0.162, -0.33], [0.166, -0.22], [0.168, -0.12], [0.172, 0.0], [0.178, 0.08], [0.165, 0.15], [0.12, 0.2], [0.06, 0.225], [0.0, 0.23]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  add(chest, new THREE.LatheGeometry(prof, 48), COL.hoodie, [0, 0.02, 0], [0, 0, 0], [1.12, 1, 0.74]);
  add(chest, new THREE.CylinderGeometry(0.166, 0.163, 0.05, 48), COL.hoodie2, [0, -0.325, 0], [0, 0, 0], [1.12, 1, 0.75]);  // its hem
  add(chest, new THREE.TorusGeometry(0.075, 0.032, 14, 30), COL.hoodie2, [0, 0.215, -0.035], [Math.PI / 2 - 0.35, 0, 0]);   // its hood
  add(chest, new THREE.BoxGeometry(0.18, 0.08, 0.02), COL.hoodie2, [0, -0.215, 0.124], [0, 0, 0]);                          // its pocket
  for (const s of [-1, 1]) add(chest, new THREE.CylinderGeometry(0.0055, 0.0055, 0.1, 8), 0xf4f1fa, [s * 0.032, 0.13, 0.126], [0.08, 0, s * 0.06], [1, 1, 1], { r: 0.5 }); // its strings
  // headphones around the neck
  add(chest, new THREE.TorusGeometry(0.09, 0.016, 10, 36, Math.PI * 1.2), COL.phones, [0, 0.235, 0.0], [Math.PI / 2 - 0.15, 0, -0.6 * Math.PI]);
  for (const s of [-1, 1]) add(chest, new THREE.CylinderGeometry(0.042, 0.042, 0.03, 24), COL.phones, [s * 0.09, 0.225, 0.05], [0, 0, Math.PI / 2 + s * 0.3]);
  for (const s of [-1, 1]) add(chest, new THREE.CylinderGeometry(0.03, 0.03, 0.032, 20), COL.cup, [s * 0.092, 0.225, 0.051], [0, 0, Math.PI / 2 + s * 0.3], [1, 1, 1], { r: 0.35 });
  const neck = joint(chest, 'neck', [0, 0.24, 0]);
  add(neck, new THREE.CylinderGeometry(0.042, 0.048, 0.09, 20), COL.skin, [0, 0.03, 0]);
  const head = joint(neck, 'head', [0, 0.085, 0]);
  add(head, sph(0.112), COL.skin, [0, 0.09, 0.005], [0, 0, 0], [0.93, 1.05, 0.98]);
  for (const s of [-1, 1]) add(head, sph(0.022), COL.skin, [s * 0.104, 0.085, 0.0], [0, 0, 0], [0.6, 1, 0.9]);              // ears
  // eyes, glasses, a smile
  for (const s of [-1, 1]) {
    add(head, sph(0.021), COL.eye, [s * 0.04, 0.105, 0.092], [0, 0, 0], [1, 1.1, 0.55], { r: 0.25 });
    add(head, sph(0.0115), COL.iris, [s * 0.04, 0.103, 0.104], [0, 0, 0], [1, 1.1, 0.5], { r: 0.3 });
    add(head, new THREE.TorusGeometry(0.034, 0.0055, 10, 32), COL.glasses, [s * 0.041, 0.104, 0.111]);
  }
  add(head, new THREE.CylinderGeometry(0.004, 0.004, 0.018, 8), COL.glasses, [0, 0.106, 0.114], [0, 0, Math.PI / 2]);
  add(head, new THREE.TorusGeometry(0.026, 0.0055, 8, 24, Math.PI), COL.mouth, [0, 0.052, 0.1], [0, 0, Math.PI]);
  // hair: a cap and braids
  add(head, new THREE.SphereGeometry(0.121, 40, 24, 0, Math.PI * 2, 0, 1.75), COL.hair, [0, 0.1, -0.008], [-0.32, 0, 0], [0.98, 1.05, 1.04]);
  const braids = [];
  for (let i = 0; i < 13; i++) {
    const a = -1.1 + (i / 12) * 2.2;                                   // around the back, from one side to the other
    const b = new THREE.Group();
    b.position.set(Math.sin(a) * 0.105, 0.11, -Math.cos(a) * 0.09);
    b.rotation.set(0.08 + 0.12 * Math.cos(a), 0, Math.sin(a) * 0.22);
    head.add(b);
    add(b, cap(0.017, 0.27 + 0.04 * Math.cos(i * 1.7)), i % 2 ? COL.hair : COL.hair2, [0, -0.17, 0]);
    braids.push(b);
  }
  // arms
  for (const s of [1, -1]) {
    const side = s > 0 ? 'L' : 'R';
    const sh = joint(chest, `shoulder${side}`, [s * 0.2, 0.13, 0]);
    add(sh, sph(0.06), COL.hoodie, [0, 0, 0]);
    add(sh, cap(0.054, 0.19), COL.hoodie, [0, -0.13, 0]);
    const el = joint(sh, `elbow${side}`, [0, -0.27, 0]);
    add(el, cap(0.049, 0.17), COL.hoodie, [0, -0.11, 0]);
    add(el, new THREE.CylinderGeometry(0.052, 0.05, 0.035, 20), COL.hoodie2, [0, -0.215, 0]);                             // the cuff
    const hd = joint(el, `hand${side}`, [0, -0.255, 0]);
    add(hd, sph(0.043), COL.skin, [0, -0.025, 0], [0, 0, 0], [0.85, 1.1, 0.62]);
    add(hd, cap(0.013, 0.03), COL.skin, [s * 0.034, -0.012, 0.012], [0, 0, s * 0.7]);                                    // its thumb
  }
  // legs
  for (const s of [1, -1]) {
    const side = s > 0 ? 'L' : 'R';
    const th = joint(hips, `thigh${side}`, [s * 0.085, -0.02, 0]);
    add(th, cap(0.074, 0.29), COL.jeans, [0, -0.2, 0]);
    const kn = joint(th, `knee${side}`, [0, -0.41, 0]);
    add(kn, cap(0.061, 0.31), COL.jeans2, [0, -0.19, 0]);
    const an = joint(kn, `ankle${side}`, [0, -0.4, 0]);
    add(an, cap(0.052, 0.11), COL.shoe, [0, -0.035, 0.045], [Math.PI / 2, 0, 0], [1.05, 1, 0.9], { r: 0.45 });
    add(an, new THREE.BoxGeometry(0.11, 0.022, 0.24), COL.sole, [0, -0.075, 0.045], [0, 0, 0], [1, 1, 1], { r: 0.5 });
  }

  const v = new THREE.Vector3();
  // pose: { breath, sway, wave (0..1), waveT (seconds into the wave), look }
  function pose(p) {
    const { breath = 0, sway = 0, wave = 0, waveT = 0 } = p;
    hips.position.y = 0.92 + Math.sin(breath) * 0.004;
    hips.rotation.z = sway * 0.03;
    spine.rotation.z = -sway * 0.02;
    chest.rotation.x = Math.sin(breath) * 0.015;
    head.rotation.z = -sway * 0.03 + wave * 0.1;
    head.rotation.x = -0.02;
    // arms at rest: a little out, elbows soft
    joints.shoulderL.rotation.set(0, 0, 0.13 + Math.sin(breath) * 0.01);
    joints.elbowL.rotation.set(-0.12, 0, 0.04);
    // the right arm waves: up and out, the forearm swinging
    const wv = wave;
    joints.shoulderR.rotation.set(0.0, 0, -0.13 - wv * 2.25);
    joints.elbowR.rotation.set(-0.12 * (1 - wv), 0, -0.04 - wv * (0.78 + 0.38 * Math.sin(waveT * 11)));
    joints.handR.rotation.set(0, 0, -wv * 0.25 * Math.sin(waveT * 11 + 0.6));
    joints.thighL.rotation.set(0, 0, -0.02 - sway * 0.02); joints.thighR.rotation.set(0, 0, 0.02 - sway * 0.02);
    joints.kneeL.rotation.set(0.02, 0, 0); joints.kneeR.rotation.set(0.02, 0, 0);
    braids.forEach((b, i) => { b.rotation.z = Math.sin(b.position.x * 9) * 0.2 + sway * 0.04 + Math.sin(breath * 0.5 + i) * 0.015; });
  }

  // render with a state: { rotY, reveal (0..1: the wireframe shown up to), sweep (0..1: the colors up to), …pose }
  function render(st) {
    const top = 1.78;
    root.rotation.y = st.rotY || 0;
    wireBelow.constant = (st.reveal ?? 1) * top + 0.001;
    const sweep = st.sweep ?? 1;
    wireAbove.constant = sweep >= 1 ? -100 : -(sweep * top);     // (no wire, no hidden-line pass once it's painted)
    solidClip.constant = sweep >= 1 ? 100 : sweep * top;        // all of it once it's painted (a waving hand goes above its head)
    wireMat.opacity = 0.75 * (st.sweep >= 1 ? 0 : 1);
    pose(st);
    renderer.render(scene, camera);
    return cv;
  }

  // the joints on the canvas (pixels), for the bones overlay
  function jointsOnScreen() {
    const out = {};
    scene.updateMatrixWorld(true);
    for (const [name, j] of Object.entries(joints)) {
      j.getWorldPosition(v);
      v.project(camera);
      out[name] = [(v.x * 0.5 + 0.5) * size, (-v.y * 0.5 + 0.5) * size];
    }
    return out;
  }

  return { canvas: cv, render, jointsOnScreen, bones: BONES, size };
}
