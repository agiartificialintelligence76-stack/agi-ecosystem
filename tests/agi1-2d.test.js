// AGI-1 in 2D: her Live2D model since 2026-10-01 (the owner's VTuber project), 2D first. The pure parts of her motion
// (src/stage/agi1-2d-motion.js), her model's physics (src/stage/live2d-physics.js, checked against Live2D's own runtime),
// her model's files (public/models/agi1-live2d/), her controller run in Node with Live2D's real runtime (no browser), and
// the "3D · 2D" buttons on the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import * as THREE from 'three';
import {
  readStyle, STYLE_KEY, DEFAULT_STYLE, Follow, makeDrift, blinkAmount, blinkLength, nextBlinkGap, BLINK, eyeOpen, LIDS_MIN,
  mouthTarget, mouthStep, chestLimit, CHEST, lookAt,
} from '../src/stage/agi1-2d-motion.js';
import { createPhysics, normalize, turnBetween } from '../src/stage/live2d-physics.js';
import { pieceAt, boxOf, refineMesh, mixInto } from '../src/stage/live2d.js';
import { buildPuppet, createAgi1_2D, HEIGHT, FILES, BASE, ARMS, HIPS, ARM_REFINE } from '../src/stage/agi1-2d.js';
import { measureArm, bendArm, ARM_PIECES, REACH, shoulderLimit } from '../src/stage/agi1-2d-arms.js';

const url = (p) => new URL(`../${p}`, import.meta.url);
const read = (p) => readFileSync(url(p), 'utf8');
const MODEL = 'public/models/agi1-live2d/';

// Live2D's runtime (Cubism Core) in a sandbox of its own: in Node it would look for CommonJS (__dirname), so it gets a
// plain context, like a page without a browser
const Core = (() => {
  const box = vm.createContext({ console: { log() {}, warn() {}, error() {} }, Math, Float32Array, Int32Array, Uint16Array, Uint8Array, Int8Array,
    ArrayBuffer, DataView, Uint32Array, Int16Array, Float64Array, Object, Array, Error, TypeError, RangeError });
  vm.runInContext(`${read(MODEL + FILES.core)}\n;this.Live2DCubismCore = Live2DCubismCore;`, box);
  return box.Live2DCubismCore;
})();
const physicsJson = JSON.parse(read(MODEL + FILES.physics));
function newModel() {
  const buf = readFileSync(url(MODEL + FILES.moc));
  const moc = Core.Moc.fromArrayBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const core = Core.Model.fromMoc(moc);
  return { moc, core };
}
function newPuppet() {
  const { moc, core } = newModel();
  return buildPuppet({ core, moc, physicsJson, texture: new THREE.Texture() });
}
function newAgi(opts = {}) {
  const m = newPuppet();
  const camera = new THREE.PerspectiveCamera(30, 1.5, 0.05, 50);
  camera.position.set(0.3, 1.25, 4.7);
  camera.lookAt(0, 0.78, 0);
  camera.updateMatrixWorld();
  const scene = new THREE.Scene();
  scene.add(m.holder);
  scene.updateMatrixWorld(true);
  const hearts = [];
  const agi = createAgi1_2D(m, { camera, effects: { spawnHearts: (_p, o) => hearts.push(o.count) }, ...opts });
  const run = (seconds, each = () => {}, dt = 1 / 60) => {
    for (let i = 0, n = Math.round(seconds / dt); i < n; i++) { agi.update(dt); scene.updateMatrixWorld(true); each(); }
  };
  return { m, agi, run, hearts, camera };
}

test('which AGI-1: 2D unless the visitor picked 3D (the owner, 2026-10-01: "i want the 2d model to be shown first")', () => {
  assert.equal(STYLE_KEY, 'agi1_style');
  assert.equal(DEFAULT_STYLE, '2d');
  assert.equal(readStyle('3d'), '3d');
  for (const v of [null, undefined, '', '2d', '3D', ' 3d', '3d ', 'true', '1']) assert.equal(readStyle(v), '2d', String(v));
});

test('her body parts follow their targets like a body part: they get there, bounce only when asked to, at any frame rate', () => {
  for (const dt of [1 / 120, 1 / 60, 1 / 30, 0.05]) {
    const calm = new Follow(0, 2, 1), bouncy = new Follow(0, 2, 0.4);
    let over = 0, overB = 0;
    for (let t = 0; t < 4; t += dt) { over = Math.max(over, calm.step(dt, 1)); overB = Math.max(overB, bouncy.step(dt, 1)); }
    assert.ok(Math.abs(calm.y - 1) < 0.01 && Math.abs(bouncy.y - 1) < 0.02, `settles (dt ${dt})`);
    assert.ok(over < 1.02, `no overshoot when damped (dt ${dt}): ${over}`);
    assert.ok(overB > 1.1 && overB < 1.6, `a little bounce, never wild (dt ${dt}): ${overB}`);
  }
  const f = new Follow(0, 1.3, 0.8);
  assert.equal(f.step(0, 5), 0, 'no time, no move');
  assert.ok(Number.isFinite(f.step(0.2, 5)), 'a long frame stays finite');
  // her slow drifts: smooth and the same every time
  const d1 = makeDrift(3.3), d2 = makeDrift(3.3);
  let maxStep = 0, maxAbs = 0;
  for (let t = 0; t < 60; t += 0.01) {
    assert.equal(d1(t), d2(t));
    maxStep = Math.max(maxStep, Math.abs(d1(t + 0.01) - d1(t)));
    maxAbs = Math.max(maxAbs, Math.abs(d1(t)));
  }
  assert.ok(maxAbs <= 1 && maxAbs > 0.3 && maxStep < 0.08, `about -1..1, no jumps (${maxAbs}, ${maxStep})`);
});

test('her eyes: a quick blink (2 to 6 s apart), lids a mood lowers only a little, and eyes that close in a smile', () => {
  assert.equal(blinkAmount(-0.1), 0);
  assert.equal(blinkAmount(BLINK.close + BLINK.hold / 2), 1);
  assert.equal(blinkAmount(blinkLength() + 0.01), 0);
  assert.ok(BLINK.close < BLINK.open, 'shuts faster than it opens');
  let quick = 0;
  for (let i = 0; i < 2000; i++) {
    const g = nextBlinkGap();
    assert.ok((g >= 0.18 && g <= 0.28) || (g >= 2 && g <= 6), String(g));
    if (g < 1) quick++;
  }
  assert.ok(quick > 150 && quick < 450, `now and then a quick second blink (${quick} of 2000)`);
  // her model's eyes look clean open, a little lowered (to LIDS_MIN) or closed; a mood never holds them in between
  assert.equal(eyeOpen(0, 0, 0), 1);
  assert.equal(eyeOpen(1, 0, 0), 0, 'a blink closes them');
  assert.equal(eyeOpen(0, 0, 1), 0, 'a smile closes them');
  for (let l = 0; l <= 1.5; l += 0.05) assert.ok(eyeOpen(0, l, 0) >= LIDS_MIN - 1e-9, `lids ${l}: never further than ${LIDS_MIN}`);
  assert.ok(LIDS_MIN >= 0.85, 'her model shows its lids cross-fading below about 0.85');
});

test('her mouth while she talks: opens on each syllable, closes a little slower, never all the way', () => {
  assert.equal(mouthTarget(0), 0);
  assert.equal(mouthTarget(1), 0.9);
  let open = 0;
  for (let i = 0; i < 6; i++) open = mouthStep(open, 0.8, 1 / 60);
  const opened = open, want = mouthTarget(0.8);
  assert.ok(opened > 0.6, `quick to open (${opened})`);
  // in one frame, more of the way open than of the way shut
  const up = mouthStep(0, 0.8, 1 / 60) / want, down = 1 - mouthStep(want, 0, 1 / 60) / want;
  assert.ok(up > down * 1.5 && down > 0.05, `slower to close (${up.toFixed(2)} vs ${down.toFixed(2)})`);
  for (let i = 0; i < 120; i++) open = mouthStep(open, 0, 1 / 60);
  assert.equal(open, 0, 'and shut when quiet');
});

test('where she looks: toward your pointer, her eyes first (they reach their limit before her head), at you without one', () => {
  assert.deepEqual(lookAt(null, { x: 0, y: 0 }), { lx: 0, ly: 0, ex: 0, ey: 0 });
  const right = lookAt({ x: 0.5, y: 0 }, { x: 0, y: 0 }, 1.5);
  assert.ok(right.lx > 0 && right.ex > right.lx, 'to the right, her eyes more than her head');
  const up = lookAt({ x: 0, y: 0.6 }, { x: 0, y: 0 }, 1.5);
  assert.ok(up.ly > 0 && up.ey > up.ly, 'up (her model\'s up is positive)');
  const far = lookAt({ x: 9, y: -9 }, { x: 0, y: 0 }, 9);
  for (const v of Object.values(far)) assert.ok(Math.abs(v) <= 1, 'never past -1..1, wherever the pointer is');
});

test('her chest: natural and subtle (the site is PG-13): scaled down, softly limited, inside a circle', () => {
  assert.ok(CHEST.scale <= 0.3 && CHEST.max <= 0.2, 'a fraction of her model\'s tuning');
  // measured on her model: at the limit, her chest moves at most about 0.4% of her height (her model as tuned: 2%)
  const { core } = newModel();
  const P = core.parameters, D = core.drawables, ids = Array.from(P.ids);
  const at = (y, x = 0) => {
    P.values.set(P.defaultValues);
    P.values[ids.indexOf('ParamChestY')] = y; P.values[ids.indexOf('ParamChestX')] = x;
    core.update();
    return Array.from({ length: D.count }, (_, i) => Float32Array.from(D.vertexPositions[i]));
  };
  const rest = at(0), height = boxOf(core, [...Array(D.count).keys()].filter((i) => D.opacities[i] > 0.01)).y1 - boxOf(core, [...Array(D.count).keys()]).y0;
  for (const [y, x] of [[CHEST.max, 0], [-CHEST.max, 0], [0, CHEST.max], [CHEST.max * 0.7, CHEST.max * 0.7]]) {
    let most = 0;
    at(y, x).forEach((v, i) => { for (let k = 0; k < v.length; k += 2) most = Math.max(most, Math.hypot(v[k] - rest[i][k], v[k + 1] - rest[i][k + 1])); });
    assert.ok(most / height < 0.0045, `chest (${y}, ${x}): ${(most / height * 100).toFixed(2)}% of her height`);
  }
  for (const [x, y] of [[0, 0], [0.2, 0], [1, 1], [-3, 2], [0, -5]]) {
    const [cx, cy] = chestLimit(x, y);
    assert.ok(Math.hypot(cx, cy) <= CHEST.max + 1e-9, `inside the circle (${x}, ${y})`);
    assert.ok(Math.sign(cx) === Math.sign(x) && Math.sign(cy) === Math.sign(y), 'the same way');
  }
  const [small] = chestLimit(0.02, 0);
  assert.ok(Math.abs(small - 0.02) < 1e-3, 'a small move is left as it is');
});

test('her physics: the same as Live2D\'s own runtime (recorded from it), still when she is, the same at any frame rate', () => {
  const { core } = newModel();
  const ids = Array.from(core.parameters.ids), min = Float32Array.from(core.parameters.minimumValues), max = Float32Array.from(core.parameters.maximumValues);
  const I = (id) => ids.indexOf(id);
  const OUT = ['ParamHairFront', 'ParamHairSide', 'ParamHairBack', 'ParamChestY', 'ParamChestX'];
  const drive = (v, t) => {
    v[I('ParamAngleX')] = 20 * Math.sin(t * 2); v[I('ParamAngleZ')] = 8 * Math.sin(t * 3 + 1); v[I('ParamAngleY')] = 10 * Math.sin(t * 0.8);
    v[I('ParamBodyAngleY')] = 6 * Math.max(0, Math.sin(t * 4)) ** 2; v[I('ParamBodyAngleZ')] = 5 * Math.sin(t * 1.3);
  };
  // recorded on 2026-10-01 from pixi-live2d-display 0.4.0's Cubism 4 framework (the runtime her physics were tuned with),
  // 60 steps a second; this physics shows each step one frame later (it blends between the last two steps)
  const GOLD = {
    15: [0.068236, 0.004979, 0.004979, -0.055539, -0.014615], 45: [0.031786, 0.034174, 0.034174, -0.320345, 0.007069],
    90: [0.037809, 0.051545, 0.051545, -0.011502, -0.001221], 180: [-0.068002, -0.095963, -0.095963, 0.075086, -0.0043],
  };
  const values = Float32Array.from(core.parameters.defaultValues);
  const ph = createPhysics(physicsJson, { ids, min, max });
  for (let n = 1; n <= 181; n++) {
    drive(values, n / 60);
    ph.evaluate(values, 1 / 60);
    const g = GOLD[n - 1];
    if (g) OUT.forEach((id, k) => assert.ok(Math.abs(values[I(id)] - g[k]) < 2e-6, `${id} at frame ${n - 1}: ${values[I(id)]} vs ${g[k]}`));
  }
  // still when she is: nothing moves at rest
  const still = Float32Array.from(core.parameters.defaultValues), ph2 = createPhysics(physicsJson, { ids, min, max });
  for (let n = 0; n < 300; n++) ph2.evaluate(still, 1 / 60);
  for (const id of OUT) assert.equal(Math.abs(still[I(id)]), 0, `${id} at rest`);
  // the same at 30 and 60 frames a second (fixed steps inside), within a few hundredths
  const a = createPhysics(physicsJson, { ids, min, max }), b = createPhysics(physicsJson, { ids, min, max });
  const va = Float32Array.from(core.parameters.defaultValues), vb = Float32Array.from(core.parameters.defaultValues);
  let diff = 0;
  for (let n = 1; n < 300; n++) {
    drive(va, n / 30); a.evaluate(va, 1 / 30);
    drive(vb, (2 * n - 1) / 60); b.evaluate(vb, 1 / 60); drive(vb, n / 30); b.evaluate(vb, 1 / 60);
    for (const id of OUT) diff = Math.max(diff, Math.abs(va[I(id)] - vb[I(id)]));
  }
  assert.ok(diff < 0.08, `30 vs 60 frames a second: ${diff}`);
  // her chest's scale on the site multiplies the output; the parameter's range is never left
  const c = createPhysics(physicsJson, { ids, min, max });
  c.setScale('ParamChestY', 0);
  const vc = Float32Array.from(core.parameters.defaultValues);
  for (let n = 1; n < 120; n++) { drive(vc, n / 60); c.evaluate(vc, 1 / 60); assert.equal(Math.abs(vc[I('ParamChestY')]), 0); }
  // its small pieces
  assert.equal(normalize(0, -30, 30, -10, 10, 0, false), -0);
  assert.equal(normalize(30, -30, 30, -10, 10, 0, true), 10, 'the end of the parameter is the end of the setting');
  assert.equal(normalize(99, -30, 30, -10, 10, 0, true), 10, 'kept inside the parameter');
  assert.equal(normalize(15, -30, 30, -10, 10, 0, false), -5, 'not reflected: the other way, as in Live2D');
  assert.ok(Math.abs(turnBetween(0, 1, 1, 0) + Math.PI / 2) < 1e-12 && Math.abs(turnBetween(-1, -0.0001, -1, 0.0001)) < 0.001);
});

test('her model\'s files: Live2D\'s runtime as it is, her model with the parameters her motion uses, her pieces and clipping, two textures', () => {
  // Cubism Core is redistributed as it is (Live2D's license): never changed or re-minified
  const core = read(MODEL + FILES.core);
  assert.match(core.slice(0, 400), /Live2D Cubism Core\s+\* \(C\) 2019 Live2D Inc\. All rights reserved\.[\s\S]*live2d-proprietary-software-license-agreement_en\.html/);
  assert.equal(createHash('sha256').update(readFileSync(url(MODEL + FILES.core))).digest('hex'), '29b32715c117b2c00ddd9e978cb0eb951105f56477b40f309d9feb3290bf1386');
  assert.doesNotMatch(core, /WebAssembly|new Function|[^\w.]eval\(/, 'no eval and no WebAssembly: the site\'s strict CSP stays as it is');
  assert.match(read(MODEL + 'NOTICE.txt'), /Live2D Cubism Core \(c\) Live2D Inc\., redistributed as is/);
  assert.equal(FILES.texture, 'AGI-1.2048.webp');
  assert.equal(BASE, '/models/agi1-live2d/');
  // her model
  const { core: m } = newModel();
  const P = m.parameters, D = m.drawables, ids = Array.from(P.ids);
  const range = (id) => { const i = ids.indexOf(id); assert.ok(i >= 0, `${id} is in her model`); return [P.minimumValues[i], P.maximumValues[i]]; };
  assert.deepEqual(range('ParamAngleX'), [-30, 30]);
  assert.deepEqual(range('ParamAngleY'), [-30, 30]);
  assert.deepEqual(range('ParamAngleZ'), [-30, 30]);
  for (const id of ['ParamBodyAngleX', 'ParamBodyAngleY', 'ParamBodyAngleZ', 'ParamArmLA', 'ParamArmRA']) assert.deepEqual(range(id), [-10, 10]);
  for (const id of ['ParamEyeLOpen', 'ParamEyeROpen', 'ParamMouthOpenY', 'ParamCheek', 'ParamBreath']) assert.deepEqual(range(id), [0, 1]);
  for (const id of ['ParamEyeBallX', 'ParamEyeBallY', 'ParamChestX', 'ParamChestY', 'ParamHairFront', 'ParamHairSide', 'ParamHairBack']) assert.deepEqual(range(id), [-1, 1]);
  assert.equal(D.count, 52, 'her 52 pieces');
  // clipping: only the irises and the light in her eyes, to her eye whites
  const pieces = Array.from(D.ids);
  const clipped = pieces.filter((_, i) => D.maskCounts[i] > 0).sort();
  assert.deepEqual(clipped, ['eye_highlight_L', 'eye_highlight_R', 'eye_iris_L', 'eye_iris_R']);
  for (const name of clipped) {
    const i = pieces.indexOf(name);
    assert.deepEqual(Array.from(D.masks[i]).map((j) => pieces[j]), [`eye_white_${name.slice(-1)}`]);
  }
  for (let i = 0; i < D.count; i++) assert.equal(D.constantFlags[i] & 3, 0, `${pieces[i]}: normal blending`);
  // the physics file: her hair and chest
  assert.deepEqual(physicsJson.PhysicsSettings.flatMap((s) => s.Output.map((o) => o.Destination.Id)), ['ParamHairFront', 'ParamHairSide', 'ParamHairBack', 'ParamChestY', 'ParamChestX']);
  // two textures: WebP, 2048 px (everyone) and 4096 px (close-ups on computers)
  for (const [file, size, maxBytes] of [[FILES.texture, 2048, 600_000], [FILES.sharp, 4096, 1_400_000]]) {
    const b = readFileSync(url(MODEL + file));
    assert.equal(b.toString('ascii', 0, 4) + b.toString('ascii', 8, 16), 'RIFFWEBPVP8X', `${file} is a WebP with transparency`);
    assert.equal(1 + b.readUIntLE(24, 3), size, `${file}: ${size} px wide`);
    assert.equal(1 + b.readUIntLE(27, 3), size, `${file}: ${size} px tall`);
    assert.ok(b.length < maxBytes, `${file}: ${b.length} bytes`);
  }
  // what a visitor who sees her in 2D downloads: under 800 KB (her 3D model for computers is 2.2 MB)
  const bytes = [FILES.core, FILES.moc, FILES.physics, FILES.texture].reduce((n, f) => n + statSync(url(MODEL + f)).size, 0);
  assert.ok(bytes < 800_000, `${bytes} bytes`);
  assert.ok(existsSync(url('public/images/agi1-live-2d.webp')), 'her 2D still picture for the live views');
  assert.ok(!existsSync(url('public/models/agi1-2d')), 'the 2D rig before her Live2D model is gone');
});

test('her puppet: standing on the floor, HEIGHT tall, her markers on her face, her hair and her chest, taps only on her', () => {
  const { m, agi, camera } = newAgi();
  assert.ok(Math.abs(m.K - HEIGHT / 1.4554) < 0.002, `world units per model unit: ${m.K}`);
  const head = m.marks.head.getWorldPosition(new THREE.Vector3()), top = m.marks.headTop.getWorldPosition(new THREE.Vector3());
  const chest = m.marks.chest.getWorldPosition(new THREE.Vector3());
  assert.ok(head.y > 1.35 && head.y < 1.5 && Math.abs(head.x) < 0.05, `her face: ${head.toArray()}`);
  assert.ok(top.y > head.y + 0.12 && top.y <= HEIGHT + 0.01, `the top of her hair: ${top.y}`);
  assert.ok(chest.y > 1 && chest.y < head.y - 0.15, `her chest: ${chest.y}`);
  assert.ok(Math.abs(m.landmarks.eyes - 1.441) < 0.01 && Math.abs(m.landmarks.waist - 0.993) < 0.01, 'her eyes and waist, for her clips');
  assert.equal(m.meshes.meshes.length, 52);
  assert.equal(m.meshes.proxies.length, 4, 'four masks: her eye whites, for her irises and the light in her eyes');
  for (const p of m.meshes.proxies) assert.ok(p.renderOrder < m.meshes.meshes[p.userData.of].renderOrder, `${p.name}: just before what it clips`);
  for (const mesh of m.meshes.meshes) assert.ok(mesh.renderOrder > 1 && mesh.renderOrder < 1.03, 'after the floor, before the hearts');
  // taps: a ray at her face hits her face, beside her hits nothing
  const ray = new THREE.Raycaster();
  ray.set(new THREE.Vector3(head.x, head.y, 3), new THREE.Vector3(0, 0, -1));
  assert.equal(ray.intersectObject(m.hitBox, false)[0]?.piece, 'face');
  ray.set(new THREE.Vector3(0.62, 1.1, 3), new THREE.Vector3(0, 0, -1));
  assert.equal(ray.intersectObject(m.hitBox, false).length, 0, 'the air beside her');
  ray.setFromCamera(new THREE.Vector2(0, 0.95), camera);
  assert.equal(ray.intersectObject(m.hitBox, false).length, 0, 'above her');
  // the pure helpers the stage uses
  assert.equal(pieceAt(m.core, 9, 9), -1);
  const b = boxOf(m.core, [Array.from(m.core.drawables.ids).indexOf('face')]);
  assert.ok(b.x1 > b.x0 && b.y1 > b.y0 && Math.abs(b.cx) < 0.02);
  assert.equal(agi.style, '2d');
});

test('her controller: every reaction, her moods on her model, a hop she lands, her wave, a tap on her face, talking', () => {
  const { m, agi, run, hearts } = newAgi();
  run(0.5);
  for (const type of ['wave', 'happy', 'love', 'shy', 'celebrate', 'sad', 'jealous', 'dance', 'nod', 'okay', 'hmm', 'worried', 'neutral', 'tap']) {
    agi.react(type);
    run(0.2);
  }
  run(5);
  assert.deepEqual(hearts, [9, 18, 4, 24, 9], 'hearts for happy, love, shy, celebrate and a tap');
  // a hop: up about 12 cm, her chest following through within the PG-13 limits, back on the floor
  const h = newAgi();
  h.run(1);
  h.agi.react('happy');
  let high = 0, chest = 0;
  h.run(0.8, () => { high = Math.max(high, h.m.fx.position.y); chest = Math.max(chest, Math.hypot(h.agi.chest.x, h.agi.chest.y)); });
  assert.ok(high > 0.1 && high < 0.13, `the hop: ${high}`);
  assert.ok(chest > 0.05 && chest <= CHEST.max + 1e-6, `her chest follows a little: ${chest}`);
  h.run(1.5);
  assert.equal(h.m.fx.position.y, 0, 'landed');
  assert.ok(Math.hypot(h.agi.chest.x, h.agi.chest.y) < 0.03, `and settled: ${h.agi.chest.y}`);
  // happy: her eyes close in a smile for a moment, her cheeks blush, her mouth opens a little; then calm
  const e = newAgi();
  e.run(1);
  e.agi.react('happy');
  let shut = 1, blush = 0, mouth = 0;
  e.run(0.7, () => { shut = Math.min(shut, e.agi.params.ParamEyeLOpen); blush = Math.max(blush, e.agi.params.ParamCheek); mouth = Math.max(mouth, e.agi.params.ParamMouthOpenY); });
  assert.ok(shut < 0.05 && blush > 0.25 && mouth > 0.2, `eyes ${shut}, blush ${blush}, mouth ${mouth}`);
  e.run(6);
  assert.equal(e.agi.mood, null, 'the mood fades');
  assert.ok(e.agi.params.ParamCheek < 0.05, 'and the blush');
  // the wave (the owner, 2026-10-01: "why dont the 2d model wave anymore"): her right forearm (on the left of the picture)
  // comes up, her elbow low by her side, her hand up by her face, waving from side to side; then down by her side again
  // (her upper arm only lifts a little: see "her arms never lift past what her drawing allows")
  const w = newAgi();
  const where = (o) => o.getWorldPosition(new THREE.Vector3());
  const [wristR, tipR, elbowR] = w.m.marks.hands[0];
  const restWrist = where(wristR), face = where(w.m.marks.head), chestY = where(w.m.marks.chest).y;
  w.agi.react('wave');
  let raised = -9, xs = [], elbowLow = true;
  w.run(2.2, () => {
    const p = where(wristR), tip = where(tipR), el = where(elbowR);
    raised = Math.max(raised, tip.y);
    if (w.agi.pose.elR > 110) { xs.push(p.x); elbowLow = elbowLow && el.y < p.y - 0.1 && el.y < chestY; }
  });
  assert.ok(w.agi.waving, 'waving');
  assert.ok(raised > face.y - 0.12, `her hand up by her face: fingertips ${raised.toFixed(2)} m, the middle of her face ${face.y.toFixed(2)} m`);
  assert.ok(Math.min(...xs) < face.x - 0.2, 'beside her face, not over it');
  assert.ok(elbowLow, 'her elbow low by her side, below her hand');
  assert.ok(Math.max(...xs) - Math.min(...xs) > 0.03, `her hand waves from side to side: ${(Math.max(...xs) - Math.min(...xs)).toFixed(3)} m`);
  assert.ok(where(wristR).y > chestY, 'a raised hand: the live views widen to keep it in');
  w.run(2.5);
  assert.ok(!w.agi.waving && where(wristR).y < chestY - 0.3 && Math.abs(where(wristR).y - restWrist.y) < 0.08, 'and down by her side again');
  // shy and sad: she looks down (and away)
  for (const [type, side] of [['shy', -1], ['sad', 0]]) {
    const s = newAgi();
    s.run(0.5);
    s.agi.react(type);
    s.run(1.2);
    assert.ok(s.agi.params.ParamAngleY < -4, `${type}: down (${s.agi.params.ParamAngleY})`);
    assert.ok(s.agi.params.ParamEyeBallY < -0.5, `${type}: her eyes too`);
    if (side) assert.ok(Math.sign(s.agi.params.ParamAngleX) === side, `${type}: and away`);
  }
  // a tap on her face makes her blush
  const t = newAgi();
  const head = t.m.marks.head.getWorldPosition(new THREE.Vector3());
  const ray = new THREE.Raycaster(new THREE.Vector3(head.x, head.y, 3), new THREE.Vector3(0, 0, -1));
  assert.equal(ray.intersectObject(t.m.hitBox, false).length, 1);
  t.agi.react('tap');
  t.run(0.4);
  assert.ok(t.agi.params.ParamCheek > 0.6, `a blush: ${t.agi.params.ParamCheek}`);
  // talking: her mouth follows her voice and shuts when she's quiet
  const v = newAgi();
  v.agi.setTalk(0.8);
  v.run(0.2);
  assert.ok(v.agi.params.ParamMouthOpenY > 0.7);
  v.agi.setTalk(0);
  v.run(1);
  assert.equal(v.agi.params.ParamMouthOpenY, 0);
  // her head never turns past where her flat art shows its seams, wherever the pointer goes
  const l = newAgi();
  let most = 0, up = -99, down = 99, hair = 0;
  for (const p of [{ x: 3, y: 3 }, { x: -3, y: -3 }, { x: 3, y: -3 }, { x: -3, y: 3 }]) {
    l.agi.setPointer(p);
    l.run(1.5, () => {
      const q = l.agi.params;
      most = Math.max(most, Math.abs(q.ParamAngleX)); up = Math.max(up, q.ParamAngleY); down = Math.min(down, q.ParamAngleY);
      hair = Math.max(hair, l.agi.hair.lag);
    });
  }
  assert.ok(most <= 20.5 && up <= 12.5 && down >= -15.5, `turns: ${most}, ${up}, ${down}`);
  assert.ok(most > 12, 'but she does turn toward you');
  assert.ok(hair > 0.03, `her hair swings when she turns: ${hair}`);
  l.agi.setPointer(null);
  l.run(4);
  assert.ok(l.agi.hair.lag < 0.03, `and settles: ${l.agi.hair.lag}`);
});

test('her arms and hips, moved in code (2026-10-01, "she moves like a stick"): real joints, rigid bones, a sleeve that folds, feet that stay', () => {
  const { core } = newModel();
  const D = core.drawables, ids = Array.from(D.ids);
  core.parameters.values.set(core.parameters.defaultValues);
  core.update();
  const rest = ids.map((_, i) => Float32Array.from(D.vertexPositions[i]));
  const rig = { rest: (i) => rest[i], indices: (i) => D.indices[i], find: (n) => ids.indexOf(n) };
  // Live2D works out every piece afresh on each update, so turning them in place after it is safe
  D.vertexPositions[ids.indexOf('hand_R')][0] += 0.5;
  core.update();
  assert.equal(D.vertexPositions[ids.indexOf('hand_R')][0], rest[ids.indexOf('hand_R')][0], 'Live2D rewrites what we turned');
  for (const side of ['R', 'L']) {
    const arm = measureArm(rig, side);
    const out = side === 'R' ? -1 : 1;
    const { S, E, W, tip } = arm.rest;
    // her joints where her pieces overlap: the shoulder under her sleeve, the elbow, the wrist, her fingertips at the bottom
    assert.ok(S[1] > 0.33 && S[1] < 0.39 && Math.abs(S[0]) > 0.1 && Math.abs(S[0]) < 0.14, `${side} shoulder ${S}`);
    assert.ok(E[1] > 0.17 && E[1] < 0.21 && Math.abs(E[0]) > 0.18 && Math.abs(E[0]) < 0.22, `${side} elbow ${E}`);
    assert.ok(W[1] > 0.03 && W[1] < 0.07 && Math.abs(W[0]) > 0.28 && Math.abs(W[0]) < 0.31, `${side} wrist ${W}`);
    assert.ok(tip[1] < -0.06 && Math.sign(tip[0]) === out, `${side} fingertips ${tip}`);
    // her model's A-pose: arms about 25° out from straight down, a little more from the elbow (a real arm's carrying angle)
    assert.ok(arm.down.upper > 18 && arm.down.upper < 30 && arm.down.fore > arm.down.upper, `${side}: ${JSON.stringify(arm.down)}`);
    // no turn: nothing moves
    const copy = ids.map((_, i) => Float32Array.from(rest[i]));
    bendArm(arm, {}, (i) => copy[i], (i) => copy[i]);
    for (const i of Object.keys(arm.weights).map(Number)) assert.deepEqual(Array.from(copy[i]), Array.from(rest[i]), `${ids[i]} unchanged`);
    // her wave: her hand up by her face (on her side), her elbow low below it, her hand and forearm the same shape (bones
    // are rigid)
    const turned = ids.map((_, i) => Float32Array.from(rest[i]));
    bendArm(arm, { shoulder: ARMS.wave.shoulder, elbow: ARMS.wave.elbow }, (i) => rest[i], (i) => turned[i]);
    assert.ok(arm.now.tip[1] > 0.44 && Math.abs(arm.now.tip[0]) > 0.25 && Math.sign(arm.now.tip[0]) === out, `${side} hand up: ${arm.now.tip}`);
    assert.ok(arm.now.E[1] < arm.now.W[1] - 0.12 && Math.abs(arm.now.E[0]) > Math.abs(S[0]), `${side} elbow out and low, below her hand`);
    const hand = ids.indexOf(ARM_PIECES[side].hand), a = rest[hand], b = turned[hand];
    let worst = 0;
    for (let k = 2; k < a.length; k += 2) worst = Math.max(worst, Math.abs(Math.hypot(a[k] - a[0], a[k + 1] - a[1]) - Math.hypot(b[k] - b[0], b[k + 1] - b[1])));
    assert.ok(worst < 1e-5, `${side} hand keeps its shape (${worst})`);
    // her arm lifted as far as it goes: her sleeve's top still on her shoulder while its opening goes with her arm
    const lifted = ids.map((_, i) => Float32Array.from(rest[i]));
    bendArm(arm, { shoulder: REACH.shoulder }, (i) => rest[i], (i) => lifted[i]);
    const sleeve = ids.indexOf(ARM_PIECES[side].sleeve);
    let top = 0, opening = 0;
    for (let k = 0; k < rest[sleeve].length; k += 2) {
      const moved = Math.hypot(lifted[sleeve][k] - rest[sleeve][k], lifted[sleeve][k + 1] - rest[sleeve][k + 1]);
      if (rest[sleeve][k + 1] > S[1] + 0.05) top = Math.max(top, moved);
      if (rest[sleeve][k + 1] < S[1] - 0.06) opening = Math.max(opening, moved);
    }
    assert.ok(top < 0.004 && opening > 0.015, `${side} sleeve: its top ${top.toFixed(4)}, its opening ${opening.toFixed(3)}`);
    // her arms never lift past what her drawing allows (2026-10-01, the owner's screenshot of her dance, "what is this lol":
    // lifted 64°, the inside of her sleeves, drawn on her shirt, showed under them like torn flaps). Asked for more, an
    // arm eases into REACH; below its last 5°, exactly what was asked.
    for (const askFor of [0, 9, REACH.shoulder - 5, REACH.shoulder, 30, 64, 90]) {
      bendArm(arm, { shoulder: askFor }, (i) => rest[i], (i) => turned[i]);
      const u = [arm.now.E[0] - arm.now.S[0], arm.now.E[1] - arm.now.S[1]];
      const lift = (Math.atan2(u[0], -u[1]) * 180 / Math.PI) * (side === 'R' ? -1 : 1) - arm.down.upper;
      assert.ok(lift <= REACH.shoulder + 1e-6, `${side} asked for ${askFor}°, lifted ${lift.toFixed(2)}°`);
      if (askFor <= REACH.shoulder - 5) assert.ok(Math.abs(lift - askFor) < 1e-6, `${side} ${askFor}° as asked: ${lift}`);
      else assert.ok(lift > REACH.shoulder - 5, `${side} ${askFor}°: up to the limit (${lift.toFixed(2)}°)`);
    }
    assert.equal(shoulderLimit(-20), -20, 'down toward her body: as asked');
  }
  // in her controller: arms relaxed by her sides (not her model's A-pose), her weight shifting while her shoes stay put
  const { m, agi, run } = newAgi();
  const shoes = ['shoe_L', 'shoe_R'].map((n) => ids.indexOf(n));
  const shoesAt = () => shoes.map((i) => Array.from(m.core.drawables.vertexPositions[i]));
  const hands = () => ['R', 'L'].map((s) => m.arms[s].now.W[0] + m.posture.hip);
  run(0.1);
  const [wr, wl] = hands();
  assert.ok(Math.abs(wr) < 0.27 && Math.abs(wl) < 0.27, `her wrists close to her sides: ${wr.toFixed(3)}, ${wl.toFixed(3)} (A-pose: about ±0.295)`);
  const feet = shoesAt();
  let hipMost = 0, headMost = 0, turn = 0, tilt = 0, slid = 0;
  const head0 = m.marks.head.position.x;
  const watch = () => {
    headMost = Math.max(headMost, Math.abs(m.marks.head.position.x - head0));
    turn = Math.max(turn, Math.abs(agi.params.ParamAngleX)); tilt = Math.max(tilt, Math.abs(agi.params.ParamAngleZ));
    shoesAt().forEach((v, i) => v.forEach((x, k) => { slid = Math.max(slid, Math.abs(x - feet[i][k])); }));
    slid = Math.max(slid, Math.abs(m.fx.position.x));
  };
  // never still: in her first 12 s (before her first little dance) she looks around, tilts her head and shifts her weight
  run(12, () => { hipMost = Math.max(hipMost, Math.abs(m.posture.hip)); watch(); });
  assert.ok(hipMost > HIPS.idle * 0.5 && hipMost <= HIPS.idle * 1.25, `her hips shift, about 1.5 cm at most: ${hipMost.toFixed(4)}`);
  assert.ok(turn > 5 && tilt > 3, `she looks around (${turn.toFixed(1)}) and tilts her head (${tilt.toFixed(1)})`);
  assert.ok(headMost > 0.006, `her head sways: ${headMost.toFixed(3)}`);
  // …and her dance (14 s after she arrives): her hips sway more, her hands up by her shoulders; her shoes still never slide
  let danced = 0, handsUp = false;
  run(8, () => {
    danced = Math.max(danced, Math.abs(m.posture.hip));
    handsUp ||= m.arms.R.now.tip[1] > m.arms.R.now.S[1] && m.arms.L.now.tip[1] > m.arms.L.now.S[1];
    watch();
  });
  assert.ok(agi.dancing || danced > HIPS.idle * 1.3, 'her little dance');
  assert.ok(danced <= HIPS.dance * 1.3 && handsUp, `her hips ${danced.toFixed(4)}, her hands up by her shoulders`);
  assert.ok(slid < 1e-6, `her shoes never slide, nor her whole figure (${slid})`);
  // in every reaction, on the stage and up close, her upper arms stay inside what her drawing allows (REACH)
  const lifted = (arm) => {
    const u = [arm.now.E[0] - arm.now.S[0], arm.now.E[1] - arm.now.S[1]];
    return (Math.atan2(u[0], -u[1]) * 180 / Math.PI) * (arm.side === 'R' ? -1 : 1) - arm.down.upper;
  };
  for (const near of [false, true]) {
    const r = newAgi();
    r.agi.setCloseUp(near);
    let most = -99;
    for (const type of ['wave', 'celebrate', 'happy', 'love', 'tap', 'dance', 'shy', 'sad', 'jealous', 'okay']) {
      r.agi.react(type);
      r.run(near || type !== 'dance' ? 2 : 6.5, () => { most = Math.max(most, lifted(r.m.arms.R), lifted(r.m.arms.L)); });
    }
    assert.ok(most <= REACH.shoulder + 1e-6 && most > 4, `${near ? 'up close' : 'on the stage'}: her arms lift ${most.toFixed(2)}° at most`);
  }
  // up close (zoomed in, or her live view in the chat): a dance in progress ends softly, her hands come down
  const d = newAgi();
  d.agi.react('dance');
  d.run(1.5);
  assert.ok(d.agi.dancing);
  d.agi.setCloseUp(true);
  d.run(1);
  assert.ok(!d.agi.dancing, 'the dance ends');
  d.run(1);
  assert.ok(d.m.arms.R.now.tip[1] < 0 && d.m.arms.L.now.tip[1] < 0, 'her hands down by her sides');
});

test('finer meshes for her arms (2026-10-03): each triangle split in 4, every new vertex a fixed mix of at most 3 of the piece\'s own', () => {
  // a square of two triangles
  const idx = [0, 1, 2, 0, 2, 3], quad = [0, 0, 1, 0, 1, 1, 0, 1];
  for (const levels of [0, 1, 2, 3]) {
    const f = refineMesh(idx, 4, levels);
    assert.equal(f.indices.length / 3, 2 * 4 ** levels, `${levels}: triangles`);
    for (let v = 0; v < f.count; v++) {
      const w = [f.w[v * 3], f.w[v * 3 + 1], f.w[v * 3 + 2]];
      assert.ok(w.every((x) => x >= 0) && Math.abs(w[0] + w[1] + w[2] - 1) < 1e-6, `${levels}: vertex ${v} mixes ${w}`);
      for (let j = 0; j < 3; j++) assert.ok(f.from[v * 3 + j] < 4);
    }
    for (const i of f.indices) assert.ok(i < f.count);
    // it follows the piece exactly: any affine change of the piece's vertices, mixed, is the same change of the mixed ones
    const moved = quad.map((x, k) => (k % 2 ? 0.3 * quad[k - 1] + 1.7 * x - 0.2 : 0.9 * x - 0.4 * quad[k + 1] + 0.5));
    const a = mixInto(quad, f, new Float32Array(f.count * 2)), b = mixInto(moved, f, new Float32Array(f.count * 2));
    for (let v = 0; v < f.count; v++) {
      assert.ok(Math.abs(b[v * 2] - (0.9 * a[v * 2] - 0.4 * a[v * 2 + 1] + 0.5)) < 1e-5);
      assert.ok(Math.abs(b[v * 2 + 1] - (0.3 * a[v * 2] + 1.7 * a[v * 2 + 1] - 0.2)) < 1e-5);
    }
  }
  // on her: her arms' pieces only (sleeves, upper arms, forearms, hands), drawn with them, covering exactly the same area;
  // her upper arms and forearms the finest (their elbow), her hands and sleeves a step less
  const m = newPuppet(), D = m.core.drawables, ids = Array.from(D.ids);
  const arms = Object.values(ARM_PIECES).flatMap((p) => Object.entries(p));
  assert.deepEqual(Object.keys(m.meshes.fine).map((i) => ids[i]).sort(), arms.map(([, name]) => name).sort());
  assert.ok(ARM_REFINE.upper === 3 && ARM_REFINE.fore === 3 && ARM_REFINE.hand === 2 && ARM_REFINE.sleeve === 2);
  const area = (p, idx) => { let s = 0; for (let k = 0; k < idx.length; k += 3) { const a = idx[k] * 2, b = idx[k + 1] * 2, c = idx[k + 2] * 2; s += Math.abs((p[b] - p[a]) * (p[c + 1] - p[a + 1]) - (p[c] - p[a]) * (p[b + 1] - p[a + 1])) / 2; } return s; };
  for (const [part, name] of arms) {
    const i = ids.indexOf(name), f = m.meshes.fine[i], n = 4 ** ARM_REFINE[part];
    assert.equal(f.indices.length, D.indices[i].length * n, `${name}: ${n} triangles for one`);
    assert.equal(m.meshes.meshes[i].geometry.attributes.position.count, f.count, `${name} is drawn with its finer mesh`);
    assert.ok(Math.abs(area(f.positions, f.indices) - area(D.vertexPositions[i], D.indices[i])) < 1e-9, `${name}: the same area`);
  }
  assert.equal(m.meshes.meshes[ids.indexOf('shirt')].geometry.attributes.position.count, D.vertexCounts[ids.indexOf('shirt')], 'everything else as her model has it');
});

test('her sleeve and her elbow (2026-10-03, the owner\'s close-ups): no slit beside her chest, her elbow her artist\'s shape with a smooth outside, nothing poking out', () => {
  const m = newPuppet(), core = m.core, D = core.drawables, ids = Array.from(D.ids), fine = m.meshes.fine;
  const set = (R, L) => {
    core.parameters.values.set(core.parameters.defaultValues);
    core.update();
    m.posture.R = { shoulder: 0, elbow: 0, wrist: 0, ...R };
    m.posture.L = { shoulder: 0, elbow: 0, wrist: 0, ...L };
    m.posture.hip = 0;
    m.deform();
    return {
      fine: Object.fromEntries(Object.keys(fine).map((i) => [i, Float32Array.from(fine[i].positions)])),
      own: Object.fromEntries(Object.keys(fine).map((i) => [i, Float32Array.from(D.vertexPositions[i])])),
    };
  };
  const rest = set({}, {});
  const idxOf = (kind, i) => (kind === 'fine' ? fine[i].indices : D.indices[i]);
  // where a point at rest is inside a piece's triangles: then where that point goes
  const locate = (p, idx, x, y) => {
    for (let k = 0; k < idx.length; k += 3) {
      const a = idx[k] * 2, b = idx[k + 1] * 2, c = idx[k + 2] * 2;
      const det = (p[b + 1] - p[c + 1]) * (p[a] - p[c]) + (p[c] - p[b]) * (p[a + 1] - p[c + 1]);
      if (Math.abs(det) < 1e-14) continue;
      const l1 = ((p[b + 1] - p[c + 1]) * (x - p[c]) + (p[c] - p[b]) * (y - p[c + 1])) / det;
      const l2 = ((p[c + 1] - p[a + 1]) * (x - p[c]) + (p[a] - p[c]) * (y - p[c + 1])) / det;
      if (l1 >= -1e-9 && l2 >= -1e-9 && 1 - l1 - l2 >= -1e-9) return [a, b, c, l1, l2, 1 - l1 - l2];
    }
    return null;
  };
  const at = (q, [a, b, c, l1, l2, l3]) => [q[a] * l1 + q[b] * l2 + q[c] * l3, q[a + 1] * l1 + q[b + 1] * l2 + q[c + 1] * l3];
  // how far a point is outside a piece (0 inside)
  const outside = (p, idx, x, y) => {
    let best = Infinity;
    const seg = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; let t = ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1e-12); t = t < 0 ? 0 : t > 1 ? 1 : t; return Math.hypot(ax + t * dx - x, ay + t * dy - y); };
    for (let k = 0; k < idx.length; k += 3) {
      const a = idx[k] * 2, b = idx[k + 1] * 2, c = idx[k + 2] * 2;
      const d1 = (x - p[b]) * (p[a + 1] - p[b + 1]) - (p[a] - p[b]) * (y - p[b + 1]);
      const d2 = (x - p[c]) * (p[b + 1] - p[c + 1]) - (p[b] - p[c]) * (y - p[c + 1]);
      const d3 = (x - p[a]) * (p[c + 1] - p[a + 1]) - (p[c] - p[a]) * (y - p[a + 1]);
      if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) return 0;
      best = Math.min(best, seg(p[a], p[a + 1], p[b], p[b + 1]), seg(p[b], p[b + 1], p[c], p[c + 1]), seg(p[c], p[c + 1], p[a], p[a + 1]));
    }
    return best;
  };
  const unit = (x, y) => { const l = Math.hypot(x, y); return [x / l, y / l]; };
  for (const side of ['R', 'L']) {
    const P = ARM_PIECES[side], up = ids.indexOf(P.upper), sl = ids.indexOf(P.sleeve), fo = ids.indexOf(P.fore), ha = ids.indexOf(P.hand);
    // her arms relaxed by her sides: the top of her upper arm, under her sleeve, moves exactly like her sleeve there (it
    // turned in full before, and showed in a slit beside her chest)
    const relaxed = set(ARMS.rest, ARMS.rest).fine;
    let under = 0, slit = 0;
    for (let v = 0; v < rest.fine[up].length; v += 2) {
      const loc = locate(rest.fine[sl], fine[sl].indices, rest.fine[up][v], rest.fine[up][v + 1]);
      if (!loc) continue;
      under++;
      const s = at(relaxed[sl], loc);
      slit = Math.max(slit, Math.hypot(s[0] - relaxed[up][v], s[1] - relaxed[up][v + 1]));
    }
    assert.ok(under > 50 && slit < 2e-4, `${side}: ${under} points of her upper arm under her sleeve, apart by ${slit.toExponential(1)} at most`);
    // her elbow, in every bent pose: her forearm turns round her elbow joint as her artist drew her arm (her forearm's soft
    // top over the end of her upper arm; for one night it bent like a round tube instead, the owner: "what is this lol,
    // before was better"), with
    //  • the end of her upper arm (past her elbow joint, under her forearm's top at rest) staying under her forearm: it
    //    turned only halfway before, and poked out below her elbow as a little flap, 3 to 4 mm;
    //  • the outside of her elbow a smooth curve on her finer meshes: on her model's own, it turns 40° and more from one
    //    point to the next 4 mm along (the flat cuts in the owner's close-up);
    //  • her hand keeping its exact shape.
    const arm = m.arms[side], { S, E, W } = arm.rest;
    const uS = unit(E[0] - S[0], E[1] - S[1]), uE = unit(W[0] - E[0], W[1] - E[1]), u = unit(uS[0] + uE[0], uS[1] + uE[1]), n = [-u[1], u[0]];
    const half = { pos: 0, neg: 0 };                // her arm's half width at her elbow, on each side of its middle
    for (const i of [up, fo]) {
      for (let k = 0; k < rest.own[i].length; k += 2) {
        const dx = rest.own[i][k] - E[0], dy = rest.own[i][k + 1] - E[1];
        if (Math.abs(dx * u[0] + dy * u[1]) > 0.05) continue;
        const d = dx * n[0] + dy * n[1];
        half.pos = Math.max(half.pos, d); half.neg = Math.max(half.neg, -d);
      }
    }
    const end = [];
    for (let v = 0; v < rest.fine[up].length; v += 2) {
      const x = rest.fine[up][v], y = rest.fine[up][v + 1];
      if ((x - E[0]) * uS[0] + (y - E[1]) * uS[1] > 0 && !outside(rest.fine[fo], fine[fo].indices, x, y)) end.push(v);
    }
    assert.ok(end.length > 100, `${side}: the end of her upper arm, under her forearm (${end.length} points)`);
    for (const [name, pose] of Object.entries({ wave: ARMS.wave, waveNear: ARMS.waveNear, cheer: ARMS.cheer, dance: ARMS.dance })) {
      const q = set(pose, pose);
      let poke = 0;
      for (const v of end) poke = Math.max(poke, outside(q.fine[fo], fine[fo].indices, q.fine[up][v], q.fine[up][v + 1]));
      assert.ok(poke < 2e-3, `${side} ${name}: the end of her upper arm pokes out by ${poke.toExponential(1)} at most`);
      const out = (side === 'R' ? -1 : 1) * pose.elbow > 0 ? -1 : 1;     // the outside of the bend
      const h = (out > 0 ? half.pos : half.neg) * 0.7;
      const turn = {};
      for (const kind of ['fine', 'own']) {
        const pts = [];
        for (let t = -0.07; t <= 0.07 + 1e-9; t += 0.004) {
          const x = E[0] + u[0] * t + n[0] * h * out, y = E[1] + u[1] * t + n[1] * h * out;
          const inFore = locate(rest[kind][fo], idxOf(kind, fo), x, y), loc = inFore || locate(rest[kind][up], idxOf(kind, up), x, y);
          if (loc) pts.push(at(inFore ? q[kind][fo] : q[kind][up], loc));
        }
        assert.ok(pts.length > 30, `${side} ${name}: ${pts.length} points along the outside of her elbow`);
        turn[kind] = 0;
        for (let k = 2; k < pts.length; k++) {
          const a = Math.atan2(pts[k - 1][1] - pts[k - 2][1], pts[k - 1][0] - pts[k - 2][0]);
          const b = Math.atan2(pts[k][1] - pts[k - 1][1], pts[k][0] - pts[k - 1][0]);
          let d = (Math.abs(b - a) * 180) / Math.PI;
          if (d > 180) d = 360 - d;
          turn[kind] = Math.max(turn[kind], d);
        }
      }
      assert.ok(turn.fine < 25 && turn.own > 35, `${side} ${name}: the outside of her elbow turns ${turn.fine.toFixed(1)}° at most between points (her model's own mesh: ${turn.own.toFixed(1)}°)`);
      const a0 = rest.fine[ha], a1 = q.fine[ha];
      let worst = 0;
      for (let k = 2; k < a0.length; k += 2) worst = Math.max(worst, Math.abs(Math.hypot(a0[k] - a0[0], a0[k + 1] - a0[1]) - Math.hypot(a1[k] - a1[0], a1[k + 1] - a1[1])));
      assert.ok(worst < 1e-5, `${side} ${name}: her hand keeps its shape (${worst})`);
    }
  }
});

test('"reduce motion": no hops, no sways, no dance, no chest follow-through; her moods and blushes stay', () => {
  const { m, agi, run } = newAgi({ reducedMotion: true });
  let high = 0, chest = 0, root = 0;
  for (const type of ['happy', 'celebrate', 'love', 'dance']) {
    agi.react(type);
    run(1.5, () => { high = Math.max(high, m.fx.position.y); chest = Math.max(chest, Math.abs(agi.chest.x) + Math.abs(agi.chest.y)); root = Math.max(root, Math.abs(m.fx.position.x)); });
  }
  run(20);
  assert.equal(high, 0, 'no hop');
  assert.equal(chest, 0, 'no follow-through');
  assert.ok(root < 0.01, 'no sway');
  assert.equal(agi.dancing, false, 'no dance');
  agi.react('love');
  run(0.5);
  assert.ok(agi.params.ParamCheek > 0.5, 'still blushes');
});

test('the page: "3D · 2D" on the stage and in both live views, 2D pressed at first, and her 2D code and files only load when needed', () => {
  const html = read('index.html');
  const groups = html.match(/<div class="dstyle [^"]*" role="group" aria-label="AGI-1's style"[^>]*>/g) || [];
  assert.equal(groups.length, 3, 'the stage, the chat and ClankChecker');
  assert.match(html, /<div class="dstyle dstyle-stage" role="group" aria-label="AGI-1's style" data-dim-box hidden>/, 'the stage\'s shows once she\'s there');
  assert.equal((html.match(/<button class="dstyle-btn" type="button" data-dim="3d" aria-pressed="false" title="AGI-1 in 3D">3D<\/button>/g) || []).length, 3);
  assert.equal((html.match(/<button class="dstyle-btn is-on" type="button" data-dim="2d" aria-pressed="true" title="AGI-1 in 2D, anime style">2D<\/button>/g) || []).length, 3);
  assert.match(html, /<canvas id="stage" aria-label="AGI-1, in 2D\. Tap to say hi\.">/);
  assert.match(html, /<span class="stage-hint">tap to say hi<\/span>/);
  assert.equal((html.match(/-cam-still" src="\/images\/agi1-live-2d\.webp"/g) || []).length, 2, 'both live views\' still pictures: 2D');
  assert.ok(!/<script>|style="/.test(html), 'no inline scripts or styles');
  assert.doesNotMatch(html, /live2dcubismcore/, 'Live2D\'s runtime isn\'t on the page: it loads with her');
  const stage = read('src/stage/stage.js');
  assert.match(stage, /await import\('\.\/agi1-2d\.js'\)/, 'her 2D code is a separate file');
  assert.doesNotMatch(stage, /^import .*agi1-2d\.js';$/m, 'never loaded up front');
  assert.match(stage, /let style = DEFAULT_STYLE;\n\s+try \{ style = readStyle\(localStorage\.getItem\(STYLE_KEY\)\); \}/, 'remembered in the browser, 2D by default');
  assert.match(stage, /new THREE\.WebGLRenderer\(\{ canvas, antialias: Q\.antialias, alpha: true, stencil: true,/, 'a stencil buffer for her clipping');
  assert.match(stage, /agi1_2d: \{ max: 3,/, 'zoom: up to 3× in 2D');
  assert.match(stage, /agi1Slot === 'agi1_2d' && view\.zoom > 1\.9 && !mobile\) models\.agi1_2d\?\.sharpen\?\.\(\)/, 'her sharper texture only for close-ups on computers');
  const live2d = read('src/stage/live2d.js');
  assert.match(live2d, /s\.src = src;/);
  assert.doesNotMatch(live2d + read('src/stage/agi1-2d.js'), /https?:\/\//, 'nothing from other sites');
  const main = read('src/main.js');
  assert.match(main, /readStyle\(localStorage\.getItem\(STYLE_KEY\)\) === '3d'\) \{\n\s+for \(const img of document\.querySelectorAll\('\.pg-cam-still, \.chk-cam-still'\)\) img\.setAttribute\('src', '\/images\/agi1-live\.webp'\)/,
    'her live views\' still picture is the 3D one only for visitors who picked 3D');
  const css = read('src/styles/hero.css');
  assert.match(css, /\.dstyle-stage \{ position: absolute; left: 16px; bottom: 14px;/);
  assert.match(css, /\.dstyle-cam \.dstyle-btn \{ min-width: 30px; min-height: 24px;/, 'big enough to tap');
  // she talks when she's tapped (2026-10-01): a line from src/stage/tap-lines.js, her words in a bubble, through the page's
  // one voice (never over her own voice, never in a call, silent when the visitor switched her voice off)
  assert.match(stage, /if \(current === 'agi1'\) agi1\?\.react\(tapTalk\(\)\);/);
  assert.match(stage, /document\.querySelector\('\[data-cam\]\.is-call'\) \|\| \(voice\?\.busy\?\.\(\) && !say\.mine\)/);
  assert.match(stage, /voice\?\.available && voice\.chosen\?\.\(\) !== 'off'/);
  assert.match(stage, /bubble\.setAttribute\('aria-live', 'polite'\)/);
  assert.doesNotMatch(stage, /innerHTML/, 'her words are text, never HTML');
  assert.match(read('src/styles/hero.css'), /\.agi-say \{[^}]*pointer-events: none;/, 'the bubble never blocks a tap');
  // her clips use the same model, framed by its eyes and waist, with a stencil buffer too
  const clip = read('tools/clips/page/clip.js');
  assert.match(clip, /const \{ eyes, waist \} = model\.landmarks;/);
  assert.match(clip, /stencil: true/);
});
