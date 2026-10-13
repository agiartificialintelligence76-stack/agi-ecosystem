// AGI Studio's launch video: the 3D model scene's figure. Juno's own 3D model, made for the video the way AGI Studio
// makes one (from her full-body picture: shaped, given bones, taught a move, its Wave), made ready once by media.mjs
// (/media/model/juno-3d.glb: never in git) and shown with three.js on its own WebGL canvas, which the scene copies onto
// the frame. Before it waves it stands in its move's first moment, eased in from the pose it was made in (arms out, an
// A-pose). Its move was made a little to one side and a little low: its hips are put back over the turntable and lifted
// 2.2 cm, so its feet stay on the floor. Everything is a function of the state it's given (no clock): a frame drawn
// twice is the same.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const MODEL_URL = '/media/model/juno-3d.glb';

// the joints lit up while it's given its bones: [our name]: its skeleton's bone
export const JOINTS = {
  hips: 'Hips', spine: 'Spine1', chest: 'Spine2', neck: 'Neck', head: 'Head', top: 'HeadTop_End',
  clavL: 'LeftShoulder', shoulderL: 'LeftArm', elbowL: 'LeftForeArm', handL: 'LeftHand',
  clavR: 'RightShoulder', shoulderR: 'RightArm', elbowR: 'RightForeArm', handR: 'RightHand',
  thighL: 'LeftUpLeg', kneeL: 'LeftLeg', ankleL: 'LeftFoot', toeL: 'LeftToeBase',
  thighR: 'RightUpLeg', kneeR: 'RightLeg', ankleR: 'RightFoot', toeR: 'RightToeBase',
};
// and how they connect
export const BONES = [
  ['hips', 'spine'], ['spine', 'chest'], ['chest', 'neck'], ['neck', 'head'], ['head', 'top'],
  ['chest', 'clavL'], ['clavL', 'shoulderL'], ['shoulderL', 'elbowL'], ['elbowL', 'handL'],
  ['chest', 'clavR'], ['clavR', 'shoulderR'], ['shoulderR', 'elbowR'], ['elbowR', 'handR'],
  ['hips', 'thighL'], ['thighL', 'kneeL'], ['kneeL', 'ankleL'], ['ankleL', 'toeL'],
  ['hips', 'thighR'], ['thighR', 'kneeR'], ['kneeR', 'ankleR'], ['ankleR', 'toeR'],
];
export const TOP = 1.72;          // its height (m), for the wireframe's reveal and the colors' sweep
const LIFT = 0.022;               // its move's hips sit 3 cm lower than its own pose's; its feet 2.2 cm under the floor

const boneOf = (skeleton, name) => skeleton.bones.find((b) => b.name.replace(/^mixamorig[:_]?/i, '') === name);

// Its move's hips over the turntable: the first key's x and z put back where its own pose has them (the same shift for
// every key, so the move itself is the same), and its height lifted so its feet stand on the floor.
export function centerHips(clip, hips) {
  const track = clip.tracks.find((tr) => tr.name === `${hips.name}.position`);
  if (!track) return 0;
  const v = track.values, dx = v[0] - hips.position.x, dz = v[2] - hips.position.z;
  for (let i = 0; i < v.length; i += 3) { v[i] -= dx; v[i + 1] += LIFT; v[i + 2] -= dz; }
  return Math.hypot(dx, dz);
}

export async function loadModel3D(size = 720, url = MODEL_URL) {
  const gltf = await new GLTFLoader().loadAsync(url);
  let mesh = null;
  gltf.scene.traverse((o) => { if (o.isSkinnedMesh && !mesh) mesh = o; });
  const clip = gltf.animations[0];
  if (!mesh || !clip) throw new Error('its file has no skinned mesh or no move');

  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 30);           // (its waving hand, 1.9 m up, in the picture)
  camera.position.set(0, 1.08, 4.35);
  camera.lookAt(0, 0.86, 0);

  scene.add(new THREE.HemisphereLight(0xe9e0ff, 0x2a1d3f, 0.65));
  const key = new THREE.DirectionalLight(0xffffff, 1.35); key.position.set(-2.2, 3.2, 3.4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xf2a5ff, 1.6); rim.position.set(2.6, 1.8, -2.6); scene.add(rim);
  const fill = new THREE.DirectionalLight(0x9ad8ff, 0.35); fill.position.set(3, 0.6, 2); scene.add(fill);

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

  // three passes of it: its colors (below the sweep), and above it, up to the reveal, its wireframe over its own surface
  // written to depth only (pushed back a little), so only the lines on the side facing the camera show, like a mesh being
  // built (not an x-ray of every line inside it)
  const solidClip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 10);           // keeps y <= sweep
  const wireAbove = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);              // keeps y >= sweep
  const wireBelow = new THREE.Plane(new THREE.Vector3(0, -1, 0), 10);            // keeps y <= reveal
  const wireMat = new THREE.MeshBasicMaterial({ color: 0xc4b5fd, wireframe: true, transparent: true, opacity: 0.55, clippingPlanes: [wireAbove, wireBelow] });
  const occMat = new THREE.MeshBasicMaterial({ colorWrite: false, polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 2, clippingPlanes: [wireAbove, wireBelow] });
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const m of mats) {
    m.clippingPlanes = [solidClip];
    if ('metalness' in m && !m.metalnessMap && m.metalness > 0.2) m.metalness = 0.2;   // glTF's default (1) reads as chrome
  }
  const passes = [occMat, wireMat].map((mat) => {
    const p = new THREE.SkinnedMesh(mesh.geometry, mat);
    p.position.copy(mesh.position); p.quaternion.copy(mesh.quaternion); p.scale.copy(mesh.scale);
    p.bind(mesh.skeleton, mesh.bindMatrix);
    p.frustumCulled = false;
    mesh.parent.add(p);
    return p;
  });
  mesh.frustumCulled = false;                    // its box is its own pose's: a move could take it out
  const root = new THREE.Group(); root.add(gltf.scene); scene.add(root);

  // its move: re-centred, then held at a time with a weight (0: the pose it was made in; 1: its move)
  const skeleton = mesh.skeleton;
  const hips = boneOf(skeleton, 'Hips');
  if (hips) centerHips(clip, hips);
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const action = mixer.clipAction(clip);
  action.play();                                  // (its own pose is kept as it is now, before any move)
  const joints = Object.fromEntries(Object.entries(JOINTS).map(([k, n]) => [k, boneOf(skeleton, n)]).filter(([, b]) => b));

  // render with a state: { rotY, reveal (0..1: the wireframe up to), sweep (0..1: the colors up to), pose (0..1: its
  // move's weight), clip (seconds into its move) }
  function render(st = {}) {
    const { rotY = 0, reveal = 1, sweep = 1, pose = 0, clip: at = 0 } = st;
    root.rotation.y = rotY;
    wireBelow.constant = reveal * TOP + 0.001;
    wireAbove.constant = sweep >= 1 ? -100 : -(sweep * TOP);     // (no wire, no hidden-line pass once it's painted)
    solidClip.constant = sweep >= 1 ? 100 : sweep * TOP;        // all of it once it's painted (a waving hand goes above its head)
    for (const p of passes) p.visible = sweep < 1 && reveal > 0;
    action.time = Math.min(Math.max(at, 0), clip.duration - 1e-4);
    action.setEffectiveWeight(Math.min(Math.max(pose, 0), 1));
    mixer.update(0);
    renderer.render(scene, camera);
    return cv;
  }

  // the joints on the canvas (pixels), for the bones overlay
  const v = new THREE.Vector3();
  function jointsOnScreen() {
    const out = {};
    scene.updateMatrixWorld(true);
    for (const [name, b] of Object.entries(joints)) {
      b.getWorldPosition(v);
      v.project(camera);
      out[name] = [(v.x * 0.5 + 0.5) * size, (-v.y * 0.5 + 0.5) * size];
    }
    return out;
  }

  // its pictures on the graphics card and its shaders made before the first frame that needs them (all three passes)
  render({ reveal: 1, sweep: 0.5 });
  render({});

  return { canvas: cv, render, jointsOnScreen, bones: BONES.filter(([a, b]) => joints[a] && joints[b]), size, clipLength: clip.duration };
}
