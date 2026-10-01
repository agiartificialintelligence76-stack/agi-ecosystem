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
import { pieceAt, boxOf } from '../src/stage/live2d.js';
import { buildPuppet, createAgi1_2D, HEIGHT, FILES, BASE } from '../src/stage/agi1-2d.js';

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
  // the wave: her right arm (on the left of the picture) out, beat after beat, and down again
  const w = newAgi();
  w.agi.react('wave');
  let arm = -10, low = 10;
  w.run(2, () => { arm = Math.max(arm, w.agi.params.ParamArmRA); low = Math.min(low, w.agi.params.ParamArmRA); });
  assert.ok(arm > 8 && w.agi.waving, `her arm out: ${arm}`);
  w.run(2);
  assert.ok(!w.agi.waving && w.agi.params.ParamArmRA < 3, 'and down again');
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
  // her clips use the same model, framed by its eyes and waist, with a stencil buffer too
  const clip = read('tools/clips/page/clip.js');
  assert.match(clip, /const \{ eyes, waist \} = model\.landmarks;/);
  assert.match(clip, /stencil: true/);
});
