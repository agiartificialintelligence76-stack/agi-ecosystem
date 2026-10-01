// Figure 1: the 3D stage. A minimal "studio": the page background shows through, neutral white light,
// a faint dial on the floor and a soft contact shadow. AGI-1 stands in the middle. (The Arena's champion card, a second
// thing to show here, left with the Arena on 2026-09-28.)
// main.js loads this file only after the page's text is showing, because three.js is large.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createEffects, POP_HEART_COLORS } from './effects.js';
import { createAgi1, buildIdleClip, addFace } from './agi1.js';
import { talkLevel, pretendTalk } from '../lib/talk.js';
import { STYLE_KEY, DEFAULT_STYLE, readStyle } from './agi1-2d-motion.js';   // (AGI-1 in 2D itself, src/stage/agi1-2d.js, loads only when needed)

// Phones get a lighter copy of AGI-1 (1024 px textures instead of 2048: 1.7 MB instead of 2.2 MB, and about a
// quarter of the graphics memory). It looks the same at phone size (checked side by side, 2026-09-24).
const MODELS = {
  agi1: { url: '/models/agi1.glb', phoneUrl: '/models/agi1-phone.glb', label: 'AGI-1', height: 1.62, clip: 'Dont_You_Dare', idle: true },
};

// Colors of the 3D bits for each theme (the page behind the transparent canvas does the rest). Pop mode (2026-09-27): her
// stage is a pink comic panel (light) or a deep violet one (dark), so the floor dial is ink or lavender, and hearts violet or
// pink so they show on it.
const THEMES = {
  light: { line: 0x111111, lineOpacity: 0.16, shadow: 0.2, accent: 0xc7285f, exposure: 1.0 },
  dark: { line: 0xffffff, lineOpacity: 0.17, shadow: 0.5, accent: 0xff5c93, exposure: 1.05 },
  'pop-light': { line: 0x170a36, lineOpacity: 0.22, shadow: 0.34, accent: 0x6b3bff, exposure: 1.0 },
  'pop-dark': { line: 0xe4d9ff, lineOpacity: 0.2, shadow: 0.55, accent: 0xff4da6, exposure: 1.05 },
};

const TARGET = new THREE.Vector3(0, 0.78, 0);   // the camera looks at her middle
const HOME = new THREE.Vector3(0.3, 1.25, 4.7); // where the camera rests (in front, slightly to the right)
const HOME_DIST = HOME.distanceTo(TARGET);      // the camera's distance at 1× (about 4.7)
// Zoom (2026-09-25): how close each model can be seen, and what the camera moves toward as it zooms in. At 1× it looks at
// the middle of the stage as before; zooming in, the aim slides up to AGI-1's face (between her head and head-top bones),
// and follows it while she moves.
// `top`: frame her like a portrait photographer would, with the top of her head near the top of the picture, so each step
// in crops from the bottom up (knees up, waist up, face) instead of centering on her middle.
const ZOOM = {
  agi1: { max: 8, bones: ['mixamorigHead', 'mixamorigHeadTop_End'], at: 0.42, lift: 0, top: true },
  // AGI-1 in 2D (2026-09-27): up to 3× (head and shoulders); closer than that, a flat picture only gets blurrier
  agi1_2d: { max: 3, at: 0.42, lift: 0, top: true },
};
const ZOOM_STEP = 1.75;                         // one press of + or − (1× → 1.75× → 3.1× → 5.4× → 8×)

// ---------- small helpers ----------
function tween(ms, ease, onUpdate, onDone) {
  const t0 = performance.now();
  (function frame() {
    const p = Math.min(1, (performance.now() - t0) / ms);
    onUpdate(ease(p));
    if (p < 1) requestAnimationFrame(frame); else onDone?.();
  })();
}
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const easeInCubic = (x) => x * x * x;

// Scale a model to `targetHeight` and stand it in the middle of the floor.
// Its size is measured at several moments of its main animation, following the skeleton.
function fitToFloor(root, mixer, clip, targetHeight) {
  const times = clip ? [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((k) => clip.duration * k) : [0];
  const box = new THREE.Box3();
  for (const t of times) {
    if (mixer) mixer.setTime(t);
    root.updateMatrixWorld(true);
    box.union(new THREE.Box3().setFromObject(root, true));
  }
  const size = box.getSize(new THREE.Vector3());
  if (!(size.y > 0) || !Number.isFinite(size.y)) return null;
  const s = targetHeight / size.y;
  root.scale.multiplyScalar(s);
  box.min.multiplyScalar(s); box.max.multiplyScalar(s);          // the root sits at the origin, so scaling is exact
  const center = box.getCenter(new THREE.Vector3());
  root.position.set(-center.x, -box.min.y, -center.z);
  box.translate(root.position);
  if (mixer) mixer.setTime(0);
  return box;                                                      // her space on the floor, used for tap detection
}

// AGI-1's dance was made for a slightly different standing height than her idle, so her feet would hover above
// the floor while she dances. This measures her feet during the dance and during the idle, and moves the dance's
// hips by the difference. It uses a separate mixer and puts every bone back afterwards: the main mixer only rewrites
// bones whose animated value changes, so a bone left in a dance pose would otherwise stay that way.
function groundDance(root, idleClip, danceClip) {
  const hips = root.getObjectByName('mixamorigHips');
  const track = danceClip.tracks.find((t) => t.name === `${hips?.name}.position`);
  const feet = ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'].map((n) => root.getObjectByName('mixamorig' + n)).filter(Boolean);
  if (!hips || !track || !feet.length) return 0;
  const bones = [];
  root.traverse((o) => { if (o.isBone) bones.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]); });
  const mixer = new THREE.AnimationMixer(root);
  const v = new THREE.Vector3();
  const lowestFoot = (clip, samples) => {
    const action = mixer.clipAction(clip).play();
    let min = Infinity;
    for (let k = 0; k < samples; k++) {
      mixer.setTime((clip.duration * k) / samples);
      root.updateMatrixWorld(true);
      for (const f of feet) min = Math.min(min, f.getWorldPosition(v).y);
    }
    action.stop();
    return min;
  };
  const lift = lowestFoot(danceClip, 60) - lowestFoot(idleClip, 8);   // how much higher her feet are in the dance
  mixer.uncacheRoot(root);
  for (const [b, p, q, sc] of bones) { b.position.copy(p); b.quaternion.copy(q); b.scale.copy(sc); }
  root.updateMatrixWorld(true);
  if (!Number.isFinite(lift) || Math.abs(lift) < 0.003) return 0;
  const from = hips.parent.worldToLocal(new THREE.Vector3(0, 0, 0));
  const d = hips.parent.worldToLocal(new THREE.Vector3(0, -lift, 0)).sub(from);   // straight down, in the hips' space
  for (let i = 0; i < track.values.length; i += 3) {
    track.values[i] += d.x; track.values[i + 1] += d.y; track.values[i + 2] += d.z;
  }
  return lift;
}

// A soft round shadow, drawn once on a small canvas.
function makeShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.45, 'rgba(0,0,0,.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// The floor dial: two thin rings with tick marks between them, like a measuring turntable.
function makeDial(material, segments) {
  const group = new THREE.Group();
  const ring = (r) => {
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), material);
  };
  group.add(ring(0.92), ring(0.99));
  const ticks = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2, outer = i % 6 === 0 ? 0.99 : 0.955;
    ticks.push(new THREE.Vector3(Math.cos(a) * 0.92, 0, Math.sin(a) * 0.92), new THREE.Vector3(Math.cos(a) * outer, 0, Math.sin(a) * outer));
  }
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ticks), material));
  return group;
}

export function startStage(wrap) {
  const canvas = wrap.querySelector('canvas');
  const statusEl = wrap.querySelector('[data-stage-status]');
  const nameEl = document.getElementById('modelName');
  const noteEl = document.getElementById('modelNote');          // the rest of the caption
  const NOTE = noteEl?.textContent || '';
  const buttons = [...wrap.querySelectorAll('[data-model]')];

  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 700;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Phones get fewer pixels and no antialiasing.
  const Q = { dpr: Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2), antialias: !mobile, segments: mobile ? 96 : 160 };
  const themeName = () => `${document.documentElement.dataset.skin === 'pop' ? 'pop-' : ''}${document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'}`;

  const setStatus = (text, busy = true) => {
    statusEl.textContent = text;
    statusEl.classList.toggle('busy', busy && !!text);
  };

  let renderer;
  try {
    // (stencil: AGI-1 in 2D clips her irises to her eye whites with it, as her Live2D model asks: src/stage/live2d.js)
    renderer = new THREE.WebGLRenderer({ canvas, antialias: Q.antialias, alpha: true, stencil: true, powerPreference: 'high-performance' });
  } catch (err) {
    console.warn('[stage] WebGL is not available', err);
    setStatus('The 3D view needs WebGL. Try another browser.', false);
    return;
  }
  renderer.setPixelRatio(Q.dpr);
  renderer.setClearColor(0x000000, 0);                   // transparent: the page's own background shows
  renderer.toneMapping = THREE.NeutralToneMapping;       // keeps her texture colors true
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // ---------- scene, camera, controls ----------
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(30, 2, 0.05, 50);
  camera.position.copy(HOME);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(TARGET);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.enableZoom = false;                            // our own zoom (below): the mouse wheel keeps scrolling the page
  controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;        // two fingers turn the view while they pinch (like a map)
  controls.minPolarAngle = 1.05;
  controls.maxPolarAngle = 1.62;
  canvas.style.touchAction = 'pan-y';                     // phones: vertical swipes still scroll the page (not when zoomed in)

  // What the camera does: `zoom` eases toward `goal` (set by the buttons, a pinch or a trackpad), `intro` is the slow push-in
  // when she first appears, and `focus` is where it looks (it slides from the stage's middle to her face as you zoom in).
  const view = { zoom: 1, goal: 1, intro: reducedMotion ? 1 : 1.14, focus: TARGET.clone() };
  // The live views (the chat's, 2026-09-25, and ClankChecker's, 2026-09-26; see "live views" below): is the canvas in one
  // now (`cam`: which one), and what decides it.
  const dock = { on: false, cam: null, heroNear: true, saved: null, heroKind: null, helloAt: -Infinity };
  let agi1Parts = null;                                  // her head, chest and hands, to frame her in the live view
  const attention = { state: 'idle', el: null };          // what she's doing in the chat (src/chat/chat.js: 'agi1:state')

  // The camera stays in front of her. If someone drags it around, it glides back 5 s after they let go.
  let homeTimer = null, homing = null;
  controls.addEventListener('start', () => { clearTimeout(homeTimer); homing = null; });
  controls.addEventListener('end', () => { clearTimeout(homeTimer); homeTimer = setTimeout(goHome, 5000); });
  // It glides back to the front angle; a zoom stays as it is.
  function goHome() {
    const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    const to = new THREE.Spherical().setFromVector3(HOME.clone().sub(TARGET));
    const turn = THREE.MathUtils.euclideanModulo(to.theta - from.theta + Math.PI, Math.PI * 2) - Math.PI; // the short way round
    homing = { from, to, turn, t: 0, seconds: reducedMotion ? 0.01 : 1.6 };
  }
  function updateHoming(dt) {
    if (!homing) return;
    homing.t += dt;
    const p = Math.min(1, homing.t / homing.seconds), e = p * p * (3 - 2 * p);
    const { from, to, turn } = homing;
    camera.position.setFromSphericalCoords(
      camera.position.distanceTo(controls.target), THREE.MathUtils.lerp(from.phi, to.phi, e), from.theta + turn * e,
    ).add(controls.target);
    if (p >= 1) homing = null;
  }

  // ---------- neutral studio light ----------
  const hemi = new THREE.HemisphereLight(0xffffff, 0x9a9a9a, 1.25);
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(2.4, 4.2, 3.6);
  const fill = new THREE.DirectionalLight(0xffffff, 0.75);
  fill.position.set(-3.2, 2.2, 2.4);
  const rim = new THREE.DirectionalLight(0xffffff, 1.5);   // from behind: separates her from the background
  rim.position.set(-1.2, 3.2, -4);
  scene.add(hemi, key, fill, rim);

  // ---------- floor: a faint dial and a soft contact shadow ----------
  const dialMaterial = new THREE.LineBasicMaterial({ transparent: true, depthWrite: false });
  const dial = makeDial(dialMaterial, Q.segments);
  dial.position.y = 0.002;
  scene.add(dial);
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: makeShadowTexture(), color: 0x000000, transparent: true, depthWrite: false });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.35), shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.001;
  scene.add(shadow);

  const lineColor = new THREE.Color(), accentColor = new THREE.Color();
  let theme = THEMES[themeName()];
  let glowLevel = 0;                                       // AGI-1's "love"/"shy": the dial blushes for a moment
  function applyTheme() {
    theme = THEMES[themeName()];
    lineColor.set(theme.line);
    accentColor.set(theme.accent);
    shadowMaterial.opacity = theme.shadow;
    renderer.toneMappingExposure = theme.exposure;
  }
  applyTheme();
  addEventListener('agi:theme', applyTheme);
  addEventListener('agi:skin', applyTheme);

  const stageRoot = new THREE.Group();                     // models stand on the floor (y = 0)
  scene.add(stageRoot);
  const effects = createEffects(scene, { mobile });
  // (Pop mode's pink stage: white, violet and honey hearts instead of pink ones)
  const tintHearts = () => effects.setHeartColors(themeName() === 'pop-light' ? POP_HEART_COLORS : null);
  tintHearts();
  addEventListener('agi:theme', tintHearts);
  addEventListener('agi:skin', tintHearts);

  // ---------- models ----------
  const loader = new GLTFLoader();
  const models = {};                                       // loaded models, by name
  const pending = {};
  let current = null;
  let switching = false;
  let agi1 = null;                                        // the AGI-1 on stage now, 3D or 2D (they take the same commands)
  // AGI-1 in 2D (2026-09-27, the owner's idea): visitors pick which AGI-1 they see, with the "3D · 2D" buttons on the
  // stage and in her live views. Remembered in the browser; 2D by default since 2026-10-01 (the owner: "i want the 2d
  // model to be shown first instead of 3d"; 3D before). Each is downloaded only when it's needed.
  const agi1s = { agi1: null, agi1_2d: null };           // both controllers, once loaded
  const partsOf = { agi1: null, agi1_2d: null };          // what the live views frame her by, for each
  let style = DEFAULT_STYLE;
  try { style = readStyle(localStorage.getItem(STYLE_KEY)); } catch { /* private mode: the default */ }
  const slot = (kind) => (kind === 'agi1' && style === '2d' ? 'agi1_2d' : kind);   // which model "AGI-1" should be
  let agi1Slot = null;                                    // which AGI-1 is on stage now ('agi1' or 'agi1_2d')
  const onStageKey = () => (current === 'agi1' ? agi1Slot || slot('agi1') : current);
  const flatOnStage = () => current === 'agi1' && agi1Slot === 'agi1_2d';
  const eachAgi1 = (fn) => { for (const c of Object.values(agi1s)) if (c) fn(c); };
  function activate() {
    const k = agi1Slot || slot('agi1');
    agi1 = agi1s[k] || null;
    agi1Parts = partsOf[k] || null;
  }

  async function loadAgi1_2D() {
    const { loadAgi1_2D: load, createAgi1_2D } = await import('./agi1-2d.js');
    const m = await load({ renderer, onProgress: (p) => { if (current !== 'agi1' || slot('agi1') === 'agi1_2d') setStatus(`Loading 2D… ${Math.round(p * 100)}%`); } });
    try {
      if (renderer.extensions.has('KHR_parallel_shader_compile')) await renderer.compileAsync(m.holder, camera, scene);
      else renderer.compile(m.holder, camera, scene);
    } catch { /* then her first frame does it */ }
    m.create = (opts) => createAgi1_2D(m, opts);
    return m;
  }

  async function loadModel(kind) {
    if (kind === 'agi1_2d') return loadAgi1_2D();
    const def = MODELS[kind];
    const gltf = await loader.loadAsync(mobile && def.phoneUrl ? def.phoneUrl : def.url, (ev) => {
      if (ev.total) setStatus(`Loading weights… ${Math.min(99, Math.round((ev.loaded / ev.total) * 100))}%`);
    });
    const root = gltf.scene;
    root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
    const mixer = new THREE.AnimationMixer(root);
    const clip = gltf.animations.find((a) => a.name === def.clip)
      || gltf.animations.filter((a) => a.duration > 0.5)[0] || gltf.animations[0] || null;
    // AGI-1 stands in a calm idle (built in code) and dances now and then. (A model without an idle just plays its loop.)
    const idleClip = def.idle ? buildIdleClip(root) : null;
    const main = idleClip || clip;
    const action = main ? mixer.clipAction(main) : null;
    const dance = idleClip && clip ? mixer.clipAction(clip) : null;
    action?.play();
    const box = fitToFloor(root, mixer, main, def.height);
    if (idleClip && clip) groundDance(root, idleClip, clip);   // her feet stay on the floor while she dances

    // holder: moved by the stage (swap in/out). fx: moved by reactions (hop, spin). root: the model itself.
    const holder = new THREE.Group();
    const fx = new THREE.Group();
    holder.add(fx);
    fx.add(root);
    // An invisible box around the model, for detecting taps (much cheaper than testing every triangle).
    const hitBox = new THREE.Mesh(
      new THREE.BoxGeometry(...(box ? box.getSize(new THREE.Vector3()).toArray() : [0.6, def.height, 0.6])),
      new THREE.MeshBasicMaterial(),
    );
    hitBox.visible = false;
    if (box) box.getCenter(hitBox.position); else hitBox.position.y = def.height / 2;
    fx.add(hitBox);
    // AGI-1's mouth and eyelids (2026-09-25): a small addition to her shader, so it's added before the next step
    const face = kind === 'agi1' ? addFace(root) : null;
    // Prepare the model's shaders before she appears, so her first frame doesn't freeze for a moment (most noticeable
    // on phones). Browsers that can do it in the background do; the others do it now, while "Loading" still shows.
    try {
      if (renderer.extensions.has('KHR_parallel_shader_compile')) await renderer.compileAsync(holder, camera, scene);
      else renderer.compile(holder, camera, scene);
    } catch { /* then her first frame does it */ }
    const focusBones = (ZOOM[kind]?.bones || []).map((n) => root.getObjectByName(n)).filter(Boolean);
    return { kind, root, holder, fx, mixer, action, clip, hitBox, idle: idleClip ? action : null, dance, danceClip: dance ? clip : null, focusBones, face };
  }

  function getModel(kind) {
    if (models[kind]) return Promise.resolve(models[kind]);
    pending[kind] ??= loadModel(kind).then((m) => {
      models[kind] = m;
      if (kind === 'agi1' || kind === 'agi1_2d') {
        const opts = { camera, effects, reducedMotion, onGlow: (_color, strength) => { glowLevel = Math.max(glowLevel, strength); } };
        const c = kind === 'agi1' ? createAgi1(m, opts) : m.create(opts);
        c.setAttention(attention.state);
        c.setCloseUp(dock.on);
        agi1s[kind] = c;
        if (kind === 'agi1') {
          const bone = (n) => m.root.getObjectByName(n);
          const parts = { headTop: bone('mixamorigHeadTop_End'), head: bone('mixamorigHead'), chest: bone('mixamorigSpine2'),
            hands: ['Right', 'Left'].map((side) => [bone(`mixamorig${side}Hand`), bone(`mixamorig${side}HandMiddle4`), bone(`mixamorig${side}ForeArm`)])
              .filter(([hand]) => hand) };                // [wrist, fingertips, elbow]
          if (parts.headTop && parts.head && parts.chest) partsOf.agi1 = parts;
        } else {
          // her 2D rig has markers in the same places: the middle of her face, the top of her hair, her chest, her hands
          partsOf.agi1_2d = { head: m.marks.head, headTop: m.marks.headTop, chest: m.marks.chest, hands: m.marks.hands };
        }
        activate();
      }
      return m;
    }).catch((err) => {
      delete pending[kind];                                // so pressing the button again retries
      throw err;
    });
    return pending[kind];
  }

  function setButtons(kind) {
    buttons.forEach((b) => {
      const on = b.dataset.model === kind;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  // what goes with the model: the caption's name
  function setDetails(kind) {
    if (nameEl) nameEl.textContent = MODELS[kind].label;
    if (noteEl) noteEl.textContent = NOTE;
  }

  async function show(kind) {
    if (kind === current || switching) return;
    switching = true;
    setButtons(kind);
    let incoming;
    const want = slot(kind);
    try {
      if (!models[want]) setStatus(want === 'agi1_2d' ? 'Loading 2D…' : 'Loading weights…');
      incoming = await getModel(want);
    } catch (err) {
      console.error('[stage] could not load', kind, err);
      setStatus("Couldn't load the model. Refresh to try again.", false);
      setButtons(current);
      switching = false;
      return;
    }
    setStatus('');
    const outgoing = current ? models[onStageKey()] : null;
    current = kind;
    if (kind === 'agi1') agi1Slot = want;
    activate();
    setDetails(kind);
    setZoom(1);                                            // every model starts at 1×
    applyStyle();

    const bringIn = () => {
      stageRoot.add(incoming.holder);
      if (kind === 'agi1' && agi1) {                   // she waves whenever she arrives
        agi1.hello();
        if (dock.on) dock.helloAt = performance.now();    // (arriving in a live view counts as its hello)
      }
      if (reducedMotion) { incoming.holder.scale.setScalar(1); switching = false; return; }
      tween(420, easeOutCubic, (p) => incoming.holder.scale.setScalar(0.9 + 0.1 * p), () => { switching = false; });
    };
    if (!outgoing) { bringIn(); reveal(); return; }
    if (reducedMotion) { stageRoot.remove(outgoing.holder); bringIn(); return; }
    tween(160, easeInCubic, (p) => outgoing.holder.scale.setScalar(Math.max(0.001, 1 - 0.1 * p)), () => {
      stageRoot.remove(outgoing.holder);
      outgoing.holder.scale.setScalar(1);
      bringIn();
    });
  }

  let revealed = false;
  function reveal() {
    if (revealed) return;
    revealed = true;
    wrap.classList.add('ready');
    if (dock.on) dock.cam.box.classList.add('is-live');     // she was loading while you were already in a live view
    if (zoomBox) zoomBox.hidden = false;
    applyStyle();
    if (reducedMotion) return;
    tween(1500, easeOutCubic, (p) => { view.intro = 1.14 - 0.14 * p; });            // a slow push-in
  }

  buttons.forEach((b) => b.addEventListener('click', () => show(b.dataset.model)));

  // ---------- pointer: where AGI-1 looks, and taps ----------
  const pointer = { x: 0, y: 0, active: false, lastMove: 0 };
  const toCanvasCoords = (clientX, clientY) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * 2 - 1, y: -((clientY - r.top) / r.height) * 2 + 1 };
  };
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' && !e.buttons) return;
    Object.assign(pointer, toCanvasCoords(e.clientX, e.clientY), { active: true, lastMove: performance.now() });
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { pointer.active = false; });

  const raycaster = new THREE.Raycaster();
  let down = null;
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 600;
    down = null;
    if (moved > 8 || !quick || !current || switching || pinched) return;   // that was a drag (rotate) or a pinch, not a tap
    const p = toCanvasCoords(e.clientX, e.clientY);
    raycaster.setFromCamera(new THREE.Vector2(p.x, p.y), camera);
    const m = models[onStageKey()];
    if (!m || !raycaster.intersectObject(m.hitBox, false).length) return;
    if (current === 'agi1') agi1?.react('tap');
    else if (!reducedMotion) tween(500, (x) => x, (q) => { m.fx.position.y = Math.sin(q * Math.PI) * 0.12; });
  });

  // ---------- zoom (2026-09-25) ----------
  // + and − (one step each), the "2.4× · reset" pill, a two-finger pinch on phones, and a pinch on a laptop's trackpad
  // (browsers send that as a wheel with Ctrl). A plain mouse wheel keeps scrolling the page. While zoomed in, one finger
  // turns the view instead of scrolling the page (zoom back out to scroll over the stage again).
  const zoomBox = wrap.querySelector('[data-zoom-box]');
  const zoomIn = wrap.querySelector('[data-zoom="in"]');
  const zoomOut = wrap.querySelector('[data-zoom="out"]');
  const zoomReset = wrap.querySelector('[data-zoom="reset"]');
  const zoomValue = wrap.querySelector('[data-zoom-value]');
  let shyAt = -Infinity;
  const zoomMax = () => ZOOM[onStageKey()]?.max || 1;
  function setZoom(z) {
    const max = zoomMax();
    view.goal = THREE.MathUtils.clamp(z, 1, max);
    if (view.goal < 1.02) view.goal = 1;
    if (reducedMotion) view.zoom = view.goal;
    renderZoom();
    eachAgi1((c) => c.setCloseUp(dock.on || (current === 'agi1' && view.goal > 2)));   // close up (or in the chat): no surprise dances
    // all the way in on AGI-1: she gets shy (at most every 30 s)
    if (current === 'agi1' && view.goal >= max - 0.01 && performance.now() - shyAt > 30_000) {
      shyAt = performance.now();
      setTimeout(() => { if (current === 'agi1' && view.goal >= zoomMax() - 0.01) agi1?.react('shy'); }, 400);
    }
  }
  function renderZoom() {
    if (!zoomIn) return;
    const zoomed = view.goal > 1;
    zoomIn.setAttribute('aria-disabled', String(!current || view.goal >= zoomMax() - 0.01));
    zoomOut.setAttribute('aria-disabled', String(!zoomed));
    zoomReset.hidden = !zoomed;
    zoomValue.textContent = `${view.goal.toFixed(1)}×`;
    zoomReset.setAttribute('aria-label', `Zoom ${view.goal.toFixed(1)} times. Reset to 1×`);
    // (2D: a flat picture doesn't turn, so one finger always scrolls the page)
    canvas.style.touchAction = zoomed && !dock.on && !flatOnStage() ? 'none' : 'pan-y';
  }
  const zoomButton = (b, factor) => b?.addEventListener('click', () => { if (b.getAttribute('aria-disabled') !== 'true') setZoom(view.goal * factor); });
  zoomButton(zoomIn, ZOOM_STEP);
  zoomButton(zoomOut, 1 / ZOOM_STEP);
  zoomReset?.addEventListener('click', () => setZoom(1));

  // pinch: two fingers on the stage
  const touches = new Map();
  let pinch = null, pinched = false;
  const spread = () => { const [a, b] = [...touches.values()]; return Math.max(12, Math.hypot(a.x - b.x, a.y - b.y)); };
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || dock.on) return;     // in the chat's live view, swipes scroll the page
    if (!touches.size) pinched = false;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) { pinch = { d: spread(), z: view.goal }; pinched = true; }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && touches.size === 2) setZoom((pinch.z * spread()) / pinch.d);
  });
  const lift = (e) => {
    touches.delete(e.pointerId);
    if (touches.size < 2 && pinch) {
      pinch = null;
      if (view.goal < 1.15) setZoom(1);     // almost 1×: snap back, so a swipe over the stage scrolls the page again
    }
  };
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', lift);
  // trackpad pinch (a wheel with Ctrl): zoom; a normal wheel is left alone, so the page scrolls
  canvas.addEventListener('wheel', (e) => {
    if (!e.ctrlKey || !current || dock.on) return;
    e.preventDefault();
    setZoom(view.goal * Math.exp(-THREE.MathUtils.clamp(e.deltaY, -25, 25) * 0.012));
  }, { passive: false });

  // Each frame: ease the zoom, slide the aim toward the model's face as the zoom grows, follow it smoothly (her moves
  // don't shake the camera), and put the camera at the zoomed distance in the direction it already has.
  const vFocus = new THREE.Vector3(), vWant = new THREE.Vector3(), vOffset = new THREE.Vector3(), vTmp = new THREE.Vector3();
  function focusPoint(out) {
    const m = current && models[onStageKey()], z = current && ZOOM[onStageKey()];
    if (!m || !z) return out.copy(TARGET);
    const [a, b] = m.focusBones || [];
    if (!a) return out.copy(TARGET);
    a.getWorldPosition(out);
    if (b) out.lerp(b.getWorldPosition(vTmp), z.at);
    out.y += z.lift;
    return out;
  }
  function updateView(dt) {
    const max = zoomMax();
    if (view.goal > max) view.goal = max;
    view.zoom += (view.goal - view.zoom) * (reducedMotion ? 1 : 1 - Math.exp(-dt * 9));
    if (Math.abs(view.goal - view.zoom) < 0.0005) view.zoom = view.goal;
    const dist = (HOME_DIST / view.zoom) * view.intro;
    const t = max > 1 ? THREE.MathUtils.clamp((view.zoom - 1) / (max - 1), 0, 1) : 0;
    const s = 1 - Math.pow(1 - t, 2.2);           // the aim moves early rather than late
    vWant.lerpVectors(TARGET, focusPoint(vFocus), s);
    const top = ZOOM[onStageKey()]?.top && models[onStageKey()]?.focusBones?.[1];
    if (top) {
      // the top of her head stays just inside the top of the picture (the aim never goes above her face or below the middle)
      const visible = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      vWant.y = THREE.MathUtils.clamp(top.getWorldPosition(vTmp).y + 0.03 - 0.42 * visible, TARGET.y, Math.max(TARGET.y, vFocus.y));
    }
    view.focus.lerp(vWant, 1 - Math.exp(-dt * 7));
    vOffset.copy(camera.position).sub(controls.target);
    if (vOffset.lengthSq() < 1e-8) vOffset.copy(HOME).sub(TARGET);
    vOffset.setLength(dist);
    controls.target.copy(view.focus);
    camera.position.copy(view.focus).add(vOffset);
    if (current === 'agi1' && agi1Slot === 'agi1' && view.zoom > 3) sharpenAgi1();
    // AGI-1 in 2D: her 4096 px texture for close-ups, on computers only (phones' graphics memory is kept for the page)
    if (current === 'agi1' && agi1Slot === 'agi1_2d' && view.zoom > 1.9 && !mobile) models.agi1_2d?.sharpen?.();
  }

  // Phones start with the lighter copy of AGI-1 (1024 px textures): sharp enough at normal size, soft up close. The first
  // time someone zooms in past 3×, the computer copy's 2048 px textures are downloaded once (about 2.2 MB) and swapped in.
  let sharpening = false;
  async function sharpenAgi1() {
    if (sharpening || !mobile || !MODELS.agi1.phoneUrl || !models.agi1) return;
    sharpening = true;
    try {
      const gltf = await loader.loadAsync(MODELS.agi1.url);
      const meshes = (root) => { const list = []; root.traverse((o) => { if (o.isMesh) list.push(o); }); return list; };
      const sharp = meshes(gltf.scene), mine = meshes(models.agi1.root);
      const old = new Set();
      mine.forEach((mesh, i) => {
        const from = sharp[i]?.material, to = mesh.material;
        if (!from || !to || sharp[i].name !== mesh.name) return;
        for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) {
          if (from[key] && to[key]) { old.add(to[key]); to[key] = from[key]; }
        }
      });
      for (const t of old) t.dispose();                   // the blurry ones leave the graphics memory
      for (const m of sharp) m.geometry.dispose();       // only the textures were needed
      view.sharp = true;
    } catch (err) {
      console.warn('[stage] sharper textures for the close-up could not load', err);
    }
  }

  // Other parts of the site (the chat) can ask AGI-1 to react, or bring someone on stage.
  addEventListener('agi1:react', (e) => { if (current === 'agi1') agi1?.react(e.detail); });
  addEventListener('agi:stage', (e) => { if (MODELS[e.detail]) show(e.detail); });
  // what she's doing in the chat: 'listening' (you're typing: she looks at the box), 'thinking' (her reply is on its way)
  addEventListener('agi1:state', (e) => {
    const d = e.detail || {};
    attention.state = d.state === 'listening' || d.state === 'thinking' ? d.state : 'idle';
    attention.el = d.look instanceof Element ? d.look : null;
    eachAgi1((c) => c.setAttention(attention.state));
  });

  // ---------- live views: the chat's (2026-09-25) and ClankChecker's (2026-09-26) ----------
  // While you chat, this stage is far up the page, so her reactions to the chat went unseen. Now the same canvas (one 3D
  // scene: nothing is downloaded or drawn twice) moves into a live view further down the page when that view is on screen
  // and this stage isn't, and comes back just before this stage scrolls into view again: the chat's ([data-cam], index.html)
  // and, since 2026-09-26, ClankChecker's ([data-live-cam], under the coin you asked her about). In there she's framed like
  // a video call: head and shoulders, widening when she waves (her hops and spins show as movement, the camera doesn't follow
  // those), with her mouth moving as she talks, and her eyes on the box while you type (or on the scan while she reads it).
  const DOCK_LABEL = 'AGI-1, live in 2D. She reacts to the chat.';
  const cams = [...document.querySelectorAll('[data-cam], [data-live-cam]')]
    .map((box) => ({
      box, view: box.querySelector('[data-cam-view]'), label: box.dataset.camLabel || DOCK_LABEL,
      hello: !('camQuiet' in box.dataset),               // she waves when you arrive (not in ClankChecker: she answers there)
      seen: false, visible: false, ratio: 0,
    }))
    .filter((c) => c.view);
  const HERO_LABEL = canvas.getAttribute('aria-label') || '';
  const DOCK_FOV = 24;                                    // a longer lens than the stage's, as for a portrait
  const DOCK_DIR = HOME.clone().sub(TARGET).normalize();  // seen from the same side as on the stage
  const THINK_LOOK = { x: 1.3, y: 1.35 };                 // thinking: up and to the side, away from the chat
  const frame = { x: 0, top: 0, h: 0, ready: false };    // the part of her the live view shows (eased)
  const unFx = new THREE.Matrix4(), vPose = new THREE.Vector3(), vDock = new THREE.Vector3();
  const vHead = new THREE.Vector3(), vDepth = new THREE.Vector3();

  // into a live view: from the stage, or straight from another live view
  function dockIn(cam) {
    if (dock.on) {                                        // (from another live view: its look stays behind)
      dock.cam.box.classList.remove('is-live');
      dock.cam.box.style.setProperty('--glow', '0');
    } else {
      dock.saved = { pos: camera.position.clone(), target: controls.target.clone(), focus: view.focus.clone() };
      controls.enabled = false;                           // no dragging her around in there
      clearTimeout(homeTimer); homing = null;
      down = null; pinch = null; touches.clear();
    }
    dock.on = true;
    dock.cam = cam;
    camGlow = -1;
    cam.view.append(canvas);
    canvas.setAttribute('aria-label', styled(cam.label));
    canvas.style.touchAction = 'pan-y';
    frame.ready = false;
    resize();                                             // (this also gives the canvas its look in there before it fades in)
    eachAgi1((c) => c.setCloseUp(true));
    // she waves when you arrive at the chat (not again within a minute)
    if (cam.hello && current === 'agi1' && agi1 && performance.now() - dock.helloAt > 60_000) { dock.helloAt = performance.now(); agi1.hello(); }
    if (current) { frameDock(0); renderer.render(scene, camera); }
    requestAnimationFrame(() => cam.box.classList.toggle('is-live', dock.on && dock.cam === cam && revealed));
  }
  function dockOut() {
    const cam = dock.cam;
    dock.on = false;
    dock.cam = null;
    cam.box.classList.remove('is-live');
    cam.box.style.setProperty('--glow', '0'); camGlow = 0;   // no blush left on the still picture
    wrap.prepend(canvas);
    canvas.setAttribute('aria-label', styled(HERO_LABEL));
    if (dock.saved) {
      camera.position.copy(dock.saved.pos);
      controls.target.copy(dock.saved.target);
      view.focus.copy(dock.saved.focus);
    }
    controls.enabled = true;
    resize();
    renderZoom();
    eachAgi1((c) => c.setCloseUp(current === 'agi1' && view.goal > 2));
    const back = dock.heroKind;                           // another model was on stage before: back it comes
    dock.heroKind = null;
    if (back && back !== current && !switching) show(back);
    if (current) renderer.render(scene, camera);
  }
  // The stage wins whenever it's near the screen; otherwise a live view gets her once it's (a fifth) on screen. She stays in
  // the one she's in while it's still on screen; else the one most on screen gets her.
  function updateDock() {
    if (!cams.length) return;
    if (dock.heroNear) { if (dock.on) dockOut(); return; }
    if (dock.on && dock.cam.seen) return;
    const next = cams.filter((c) => c.seen).sort((a, b) => b.ratio - a.ratio)[0];
    if (next) dockIn(next);
  }

  // Where the live view looks: her head, shoulders and hair, plus a hand while it's up (a wave). Measured without her hops
  // and spins (the `fx` group), so those show as movement instead of the camera following them.
  function frameDock(dt) {
    const m = current && models[onStageKey()];
    if (!m) return;
    const aspect = camera.aspect || 1;
    let top, x0, x1, z = 0.05;
    m.fx.updateWorldMatrix(true, false);                  // this frame's hop and spin
    unFx.copy(m.fx.matrixWorld).invert().premultiply(m.holder.matrixWorld);
    const at = (bone) => bone.getWorldPosition(vPose).applyMatrix4(unFx);
    let bottom = Infinity, hands = 0;                     // hands: which side a raised hand is on (-1 her right, +1 her left)
    // head and shoulders (a little more in the taller desktop view), wider only for a raised hand
    const base = THREE.MathUtils.lerp(0.54, 0.5, THREE.MathUtils.smoothstep(aspect, 0.9, 1.8));
    if (current === 'agi1' && agi1Parts) {
      const head = vHead.copy(at(agi1Parts.head));
      z = head.z; x0 = head.x - 0.2; x1 = head.x + 0.2;   // her hair is about this wide
      top = at(agi1Parts.headTop).y + 0.07;
      const chestY = at(agi1Parts.chest).y;
      // A raised hand is held a little in front of her face, so it looks a little wider out than it is (2026-09-26: her
      // fingers were cut off by the edge while she waved)
      const dist = (frame.ready ? frame.h : base) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
      const keep = (p, pad) => {
        const k = dist / Math.max(dist * 0.5, dist - vDepth.copy(p).sub(head).dot(DOCK_DIR));
        const px = head.x + (p.x - head.x) * k;
        x0 = Math.min(x0, px - pad); x1 = Math.max(x1, px + pad);
      };
      for (const [hand, tip, elbow] of agi1Parts.hands) {
        const p = at(hand);
        if (p.y <= chestY) continue;                      // only a raised hand counts
        hands += Math.sign(p.x - head.x);
        keep(p, 0.07);
        if (tip) {
          const q = at(tip);                              // her fingertips (spread: a little wider than the hand)
          keep(q, 0.06);
          top = Math.max(top, q.y + 0.06);
        } else top = Math.max(top, p.y + 0.19);
        if (elbow) {                                      // and the whole arm: never an elbow cut off by the edge
          const e = at(elbow);
          keep(e, 0.06);
          bottom = Math.min(bottom, e.y - 0.06);
        }
      }
    } else {                                              // the card for a moment, while AGI-1 is on her way
      top = (MODELS[current]?.height || CARD_Y + 0.3) + 0.1; x0 = -0.45; x1 = 0.45;
    }
    // never wider than her waist up (0.78 m tall): then her waving hand stays in and her hair on the other side may touch
    // the edge, so the view stays a portrait
    const h = Math.min(0.78, Math.max(base, (x1 - x0) / aspect, top - bottom));
    const x = (x0 + x1) / 2 + Math.sign(hands) * Math.max(0, x1 - x0 - h * aspect) / 2;
    if (!frame.ready || reducedMotion || !(dt > 0)) Object.assign(frame, { x, top, h, ready: true });
    else {
      const k = (rate) => 1 - Math.exp(-dt * rate);
      // each side of the picture moves out quickly (a hand going up) and comes back in slowly (2026-09-26: easing the middle
      // of the picture instead lagged behind her hand, so her fingers touched the edge as her wave began)
      const half = (frame.h * aspect) / 2, want = (h * aspect) / 2;
      let left = frame.x - half, right = frame.x + half;
      left += (x - want - left) * k(x - want < left ? 9 : 1.1);
      right += (x + want - right) * k(x + want > right ? 9 : 1.1);
      frame.x = (left + right) / 2;
      frame.h = (right - left) / aspect;
      frame.top += (top - frame.top) * k(top > frame.top ? 5 : 1.1);
    }
    const dist = frame.h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    // a hop: the camera rises with 60% of it, so it shows without her head leaving the picture
    vDock.set(frame.x, frame.top - frame.h / 2 + 0.6 * Math.max(0, m.fx.position.y), z);
    camera.position.copy(vDock).addScaledVector(DOCK_DIR, dist);
    camera.lookAt(vDock);
  }

  // Where she looks this frame (a point in the canvas's -1..1 coordinates, or null = at you)
  function lookTarget() {
    if (dock.on && attention.state === 'listening' && attention.el?.isConnected) {
      const r = attention.el.getBoundingClientRect();     // the box you're typing in
      if (r.width) {
        const p = toCanvasCoords(r.left + r.width / 2, r.top + r.height / 2);
        return { x: THREE.MathUtils.clamp(p.x, -1.8, 1.8), y: THREE.MathUtils.clamp(p.y, -0.9, 1) };
      }
    }
    if (dock.on && attention.state === 'thinking') return THINK_LOOK;
    const fresh = pointer.active && performance.now() - pointer.lastMove < 6000;
    // in the chat she looks at you, unless your pointer is right over her; on the stage she follows it (not when zoomed in)
    if (dock.on) return fresh && Math.abs(pointer.x) < 1.3 && Math.abs(pointer.y) < 1.3 ? pointer : null;
    return fresh && view.zoom <= 2 ? pointer : null;
  }

  // "love" and "shy" make the stage's floor glow pink; in a live view, the view blushes instead
  let camGlow = -1;
  function paintCam() {
    const g = Math.round(Math.min(1, glowLevel) * 40) / 40;
    if (g !== camGlow) { camGlow = g; dock.cam.box.style.setProperty('--glow', String(g)); }
  }

  // ---------- AGI-1 in 3D or 2D (2026-09-27) ----------
  // The "3D · 2D" buttons: on the stage (bottom left, while AGI-1 is on it) and in her live views (top right). They all
  // show the same choice; it's remembered in the browser ('agi1_style') and sent as 'agi:agi1-style'.
  const styleButtons = [...document.querySelectorAll('[data-dim]')];
  const styleBox = wrap.querySelector('[data-dim-box]');
  const hintEl = wrap.querySelector('.stage-hint');
  const HINT = { '2d': 'tap to say hi', '3d': 'drag to rotate · tap to say hi' };
  const stills = [...document.querySelectorAll('.pg-cam-still, .chk-cam-still')];
  const STILL = { '3d': '/images/agi1-live.webp', '2d': '/images/agi1-live-2d.webp' };
  // her labels say which one she is ("AGI-1, in 2D. Tap to say hi.": a flat picture doesn't turn; "AGI-1, in 3D. Drag to
  // rotate, tap to say hi."). Before she's on stage, the one she's going to be.
  function styled(text) {
    const s = String(text);
    if (current === 'agi1' && agi1Slot ? flatOnStage() : slot('agi1') === 'agi1_2d') {
      return s.replace(/in 3D/g, 'in 2D').replace(/\s*Drag to rotate,\s*tap/i, ' Tap');
    }
    return s.replace(/in 2D/g, 'in 3D').replace(/(in 3D\.)\s*Tap/i, '$1 Drag to rotate, tap');
  }
  function applyStyle() {
    for (const b of styleButtons) {
      const on = b.dataset.dim === style;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    }
    if (styleBox) styleBox.hidden = !(revealed && current === 'agi1');
    const flat = flatOnStage();
    controls.enableRotate = !flat;                        // a flat picture doesn't turn: no dragging her around
    if (hintEl) hintEl.textContent = flat || (!current && style === '2d') ? HINT['2d'] : HINT['3d'];
    canvas.setAttribute('aria-label', styled(dock.on ? dock.cam.label : HERO_LABEL));
    for (const img of stills) {
      const src = STILL[style];
      if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    }
    renderZoom();
  }
  let styleSwap = Promise.resolve();
  function setStyle(next) {
    next = readStyle(next);
    try { localStorage.setItem(STYLE_KEY, next); } catch { /* private mode: for this visit only */ }
    if (next === style) { applyStyle(); return styleSwap; }
    style = next;
    applyStyle();
    dispatchEvent(new CustomEvent('agi:agi1-style', { detail: style }));
    styleSwap = styleSwap.then(() => swapAgi1()).catch((err) => console.error('[stage] style switch', err));
    return styleSwap;
  }
  // Swap the AGI-1 on stage (or in a live view) for the other one: a quick shrink out and grow in, as between models.
  async function swapAgi1() {
    const to = slot('agi1');
    if (current !== 'agi1') { getModel(to).catch(() => {}); return; }   // ready for when she's back on stage
    while (switching) await new Promise((r) => setTimeout(r, 60));
    const from = agi1Slot;
    if (!from || from === to || current !== 'agi1') return;
    let incoming;
    try {
      if (!models[to]) setStatus(to === 'agi1_2d' ? 'Loading 2D…' : 'Loading weights…');
      incoming = await getModel(to);
    } catch (err) {
      console.error('[stage] could not load', to, err);
      setStatus("Couldn't load that version of AGI-1. Refresh to try again.", false);
      setTimeout(() => { if (statusEl.textContent.startsWith("Couldn't load that")) setStatus(''); }, 5000);
      style = from === 'agi1_2d' ? '2d' : '3d';          // stay with the one she is
      try { localStorage.setItem(STYLE_KEY, style); } catch { /* */ }
      applyStyle();
      return;
    }
    setStatus('');
    if (current !== 'agi1' || slot('agi1') !== to || agi1Slot !== from) return;   // something else happened meanwhile
    const outgoing = models[from];
    agi1Slot = to;
    activate();
    if (view.goal > zoomMax()) setZoom(zoomMax());
    if (style === '2d' && !dock.on) goHome();            // back to the front, where a picture looks right
    eachAgi1((c) => c.setCloseUp(dock.on || view.goal > 2));
    switching = true;
    const bringIn = () => {
      stageRoot.add(incoming.holder);
      agi1?.hello();
      if (dock.on) dock.helloAt = performance.now();
      applyStyle();
      if (reducedMotion) { incoming.holder.scale.setScalar(1); switching = false; return; }
      tween(380, easeOutCubic, (p) => incoming.holder.scale.setScalar(0.9 + 0.1 * p), () => { switching = false; });
    };
    if (!outgoing || !outgoing.holder.parent) { bringIn(); return; }
    if (reducedMotion) { stageRoot.remove(outgoing.holder); bringIn(); return; }
    tween(150, easeInCubic, (p) => outgoing.holder.scale.setScalar(Math.max(0.001, 1 - 0.1 * p)), () => {
      stageRoot.remove(outgoing.holder);
      outgoing.holder.scale.setScalar(1);
      bringIn();
    });
  }
  for (const b of styleButtons) b.addEventListener('click', () => setStyle(b.dataset.dim));
  addEventListener('agi:agi1-style-request', (e) => setStyle(e.detail));
  applyStyle();

  // ---------- size, visibility ----------
  function resize() {
    const host = dock.on ? dock.cam.view : wrap;
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = dock.on ? DOCK_FOV : camera.aspect < 0.9 ? 36 : camera.aspect < 1.5 ? 33 : 29;
    camera.updateProjectionMatrix();
  }
  const sizes = new ResizeObserver(() => resize());
  sizes.observe(wrap);
  for (const cam of cams) sizes.observe(cam.view);
  resize();
  // drawn only while its place is on screen (the stage, or the live view she's in)
  let heroVisible = true;
  new IntersectionObserver((entries) => { heroVisible = entries[entries.length - 1].isIntersecting; }, { threshold: 0.02 }).observe(wrap);
  if (cams.length) {
    // "near": within 160 px of the screen, so the canvas is back on the stage before you see it
    new IntersectionObserver((entries) => { dock.heroNear = entries[entries.length - 1].isIntersecting; updateDock(); },
      { rootMargin: '160px 0px' }).observe(wrap);
    const watch = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const cam = cams.find((c) => c.box === e.target);
        if (!cam) continue;
        cam.visible = e.isIntersecting;
        cam.ratio = e.isIntersecting ? e.intersectionRatio : 0;
        cam.seen = e.isIntersecting && e.intersectionRatio >= 0.2;
      }
      updateDock();
    }, { threshold: [0, 0.2, 0.5, 0.8] });
    for (const cam of cams) watch.observe(cam.box);
  }
  const onScreen = () => (dock.on ? dock.cam.visible : heroVisible);

  // ---------- one animation step (dt = seconds since the last step) ----------
  function step(dt) {
    if (dock.on) {
      // the chat is with AGI-1: if another model was on stage, she takes over (it comes back with the stage)
      if (current && current !== 'agi1' && !switching) { dock.heroKind ??= current; show('agi1'); }
    } else {
      updateView(dt);
      updateHoming(dt);
      controls.update(dt);
    }
    glowLevel = Math.max(0, glowLevel - dt * 0.8);
    dialMaterial.color.lerpColors(lineColor, accentColor, Math.min(1, glowLevel));
    dialMaterial.opacity = theme.lineOpacity + Math.min(1, glowLevel) * 0.5;
    if (current) {
      if (current === 'agi1' && agi1) agi1.beforeMixer(); // 0. undo last frame's wave/look, so they never stick
      models[onStageKey()]?.mixer?.update(dt);              // 1. the idle (or the dance) sets her pose (3D)
      if (current === 'agi1' && agi1) {
        agi1.setPointer(lookTarget());                     // your pointer, the chat box, or you
        agi1.setTalk(talkLevel());                         // how loud she's talking right now (src/lib/talk.js)
        agi1.update(dt);                                   // 2. her reactions adjust it
      }
    }
    effects.update(dt);
    if (dock.on) { frameDock(dt); paintCam(); }             // after her pose, so the live view frames this frame's pose
  }

  // ---------- the loop ----------
  // At most about 60 frames a second: 90/120 Hz phone screens would otherwise draw twice as often for no
  // visible gain, which costs battery.
  const MIN_FRAME_MS = 12;
  let last = performance.now();
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    if (!onScreen() || document.hidden) { last = now; return; }   // don't draw what nobody can see
    if (now - last < MIN_FRAME_MS) return;
    const dt = Math.min((now - last) / 1000, 0.05);        // a long pause (e.g. another tab) doesn't cause a jump
    last = now;
    step(dt);
    renderer.render(scene, camera);
  });

  // ---------- ?dev: buttons to test AGI-1's reactions ----------
  if (new URLSearchParams(location.search).has('dev')) {
    const panel = document.createElement('div');
    panel.className = 'devp';
    for (const type of ['wave', 'happy', 'shy', 'love', 'jealous', 'celebrate', 'sad', 'dance', 'okay', 'hmm', 'worried']) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = type;
      b.addEventListener('click', () => dispatchEvent(new CustomEvent('agi1:react', { detail: type })));
      panel.appendChild(b);
    }
    // a whole market moment (her chat line, the notification, her voice), as if the market had just moved (src/chat/chat.js)
    for (const [label, detail] of [['market up', 'up'], ['market down', 'down']]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', () => dispatchEvent(new CustomEvent('agi:market-preview', { detail })));
      panel.appendChild(b);
    }
    wrap.appendChild(panel);
    // For testing only (never used by the page itself).
    const camName = (cam) => (!cam ? null : cam.box.hasAttribute('data-cam') ? 'chat' : cam.box.dataset.liveCam || 'cam');
    window.__agiStage = {
      get current() { return current; }, get switching() { return switching; }, get agi1() { return agi1; }, goHome,
      show, renderer, camera, controls, models, view, setZoom, focusPoint: () => focusPoint(new THREE.Vector3()),
      // the live views: is the canvas in one (and which: 'chat' or 'checker'), what it frames, and what she's doing
      get docked() { return dock.on; }, get dockedIn() { return camName(dock.cam); },
      get dock() { return { ...dock, cam: camName(dock.cam), camSeen: Boolean(dock.cam?.seen), saved: !!dock.saved }; },
      get frame() { return { ...frame }; },
      get attention() { return attention.state; }, talkLevel: () => talkLevel(), pretendTalk,
      get look() { return themeName(); },                  // which colors the stage uses: light, dark, pop-light, pop-dark
      get style() { return style; }, setStyle,              // AGI-1 in 3D or 2D (2026-09-27)
      get agi1Model() { return current === 'agi1' ? models[agi1Slot] || null : null; },
      // Fast-forward the animation by `seconds` (30 steps per second), then draw one frame.
      advance(seconds) {
        for (let i = 0, n = Math.round(seconds * 30); i < n; i++) step(1 / 30);
        renderer.render(scene, camera);
      },
    };
  }

  setStatus(slot('agi1') === 'agi1_2d' ? 'Loading 2D…' : 'Loading weights…');
  show('agi1');
}
