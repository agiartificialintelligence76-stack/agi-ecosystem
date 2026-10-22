import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { attackAnimation, heroAnimation, enemyAnimation, animationSheet } from '../src/games/vladrunner2049/animation.js';
import { createRenderer } from '../src/games/vladrunner2049/render.js';
import sharp from 'sharp';

test('a running hero uses every drawn phase, driven by traveled distance and stable during hitstop', () => {
  const frames = [];
  for (let phase = 0; phase < 8; phase++) {
    const hero = { kind: 'vlad', pose: 'run', moveSpeed: 260, runCycle: (phase + .1) / 8 * Math.PI * 2 };
    frames.push(heroAnimation(hero).frame);
    assert.deepEqual(heroAnimation({ ...hero, animTime: 200 }), heroAnimation(hero), 'wall-clock age cannot advance a frozen run');
  }
  assert.deepEqual(frames, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(heroAnimation({ pose: 'run', moveSpeed: 0, runCycle: 8 }).pose, 'idle');
});

test('combo drawings anticipate, contact, follow through and recover on the actual damage windows', () => {
  for (const stage of [1, 2, 3]) {
    const attack = { stage, duration: .4, impactAt: .1, activeUntil: .18, cancelAt: .3 };
    const steps = stage === 3
      ? [[0, 0], [.047, 0], [.05, 1], [.099, 1], [.1, 2], [.13, 2], [.22, 2], [.35, 3]]
      : [[0, 0], [.099, 0], [.1, 1], [.13, 1], [.17, 2], [.22, 2], [.35, 3]];
    for (const [age, expected] of steps) {
      const animation = attackAnimation({ ...attack, age });
      assert.equal(animation.frame, (stage - 1) * 4 + expected);
      assert.equal(animation.phase, age < .1 ? 'windup' : age <= .18 ? 'active' : 'recovery');
      if (age < .1 || age >= .27) assert.equal(animation.trail, 0, 'no strike glow during windup or late recovery');
    }
  }
  assert.equal(attackAnimation({ kind: 'heavy' }).stage, 3);
});

test('hurt, air, dodge and special poses take precedence without discarding a live airborne attack', () => {
  assert.equal(heroAnimation({ dead: true, attack: { kind: 'light' } }).pose, 'hurt');
  assert.equal(heroAnimation({ hurtTime: .2, hurtDuration: .4, pose: 'punch' }).recoil, .5);
  assert.equal(heroAnimation({ z: 80, attack: { kind: 'air', stage: 3, age: .1 } }).suffix, 'Combo');
  assert.equal(heroAnimation({ z: 80, attack: { kind: 'air', stage: 1, age: .1 } }).stage, 3);
  assert.equal(heroAnimation({ z: 80, pose: 'jump' }).frame, 5);
  assert.equal(heroAnimation({ dodgeTime: .2, pose: 'run' }).pose, 'dodge');
  assert.equal(heroAnimation({ attack: { kind: 'special' }, pose: 'special' }).frame, 7);
});

test('directional atlases preserve lettering; missing sequences return the established character art', () => {
  const action = { suffix: 'Run', frame: 5, fallback: 2 }, e = { kind: 'agi', face: -1 };
  const assets = { agi: {}, agiLeft: {}, agiRun: {}, agiRunLeft: {} };
  assert.deepEqual(animationSheet(assets, e, action), { key: 'agiRunLeft', frame: 5, rows: 2, cols: 4, mirror: false });
  assert.deepEqual(animationSheet({ agi: {}, agiLeft: {} }, e, action), { key: 'agiLeft', frame: 2, rows: 2, cols: 4, mirror: false });
  assert.equal(animationSheet({ vlad: {}, vladCombo: {} }, { kind: 'vlad', face: -1 }, { suffix: 'Combo', frame: 9, fallback: 4 }).mirror, true);
});

test('enemy windup is visibly distinct from the damaging attack and recoil', () => {
  const start = enemyAnimation({ telegraph: true, windup: .7, totalWindup: .7 });
  const end = enemyAnimation({ telegraph: true, windup: .02, totalWindup: .7 });
  assert.equal(start.pose, 'windup'); assert.equal(start.trail, 0); assert.ok(end.lean < start.lean);
  const impact = enemyAnimation({ attackTime: .35, attackDuration: .36 });
  assert.equal(impact.column, 2); assert.ok(impact.trail > .5);
  assert.equal(enemyAnimation({ attackTime: .04, attackDuration: .36 }).column, 0);
  assert.equal(enemyAnimation({ hurtTime: .2, hurtDuration: .2, telegraph: true }).column, 3);
  assert.equal(enemyAnimation({ chargeTime: .12, attackTime: 0 }).column, 2, 'a damaging charge holds its attack drawing through the full charge');
  assert.deepEqual([0, 1, 2, 3].map(i => enemyAnimation({ pose: 'run', runCycle: (i + .1) / 4 * Math.PI * 2 }).frame), [0, 1, 2, 3]);
  assert.equal(enemyAnimation({ hurtTime: .25, hurtDuration: .25 }).frame, 8);
  assert.equal(enemyAnimation({ hurtTime: .15, hurtDuration: .25 }).frame, 9);
  assert.equal(enemyAnimation({ hurtTime: .15, hurtDuration: .25, z: 30 }).frame, 10);
  assert.equal(enemyAnimation({ hurtTime: .05, hurtDuration: .25, landingTime: .1 }).frame, 11);
  assert.equal(enemyAnimation({ dead: true, deadTime: .4 }).frame, 11);
});

function drawingContext() {
  const calls = [], gradient = { addColorStop() {} };
  const context = new Proxy({ globalAlpha: 1 }, { get(target, key) {
    if (key in target) return target[key];
    if (String(key).startsWith('create')) return () => gradient;
    return (...args) => { calls.push({ op: key, args }); };
  } });
  const canvas = { width: 1280, height: 720, getContext: () => context,
    getBoundingClientRect: () => ({ width: 1280, height: 720, left: 0, top: 0 }) };
  return { canvas, calls };
}

test('renderer selects real sequence cells with a shared anatomical anchor and falls back safely', () => {
  const { canvas, calls } = drawingContext();
  const base = { width: 1600, height: 800 }, run = { width: 1600, height: 800 }, combo = { width: 1600, height: 1200 };
  const assets = { vlad: base, vladRun: run, vladCombo: combo,
    animationMeta: { vladRun: { anchorX: 190, baseline: 350, sourceHeight: 320, height: 214 } } };
  const renderer = createRenderer(canvas, assets, { shake: false, reducedMotion: true });
  const hero = { kind: 'vlad', id: 1, face: 1, x: 400, y: 550, z: 0, hp: 100, maxHp: 100, pose: 'run', moveSpeed: 260, runCycle: Math.PI * 1.3 };
  const state = { elapsed: 1, simulationTime: 1, players: [hero], enemies: [], effects: [], events: [] };
  renderer.draw(state);
  const running = calls.find(call => call.op === 'drawImage' && call.args[0] === run);
  assert.ok(running, 'running selects the new eight-frame atlas');
  assert.equal(running.args[1], 400); assert.equal(running.args[2], 400, 'phase five is row two, column two');
  assert.ok(Math.abs(running.args[5] - -190 * 214 / 320) < 1e-9); assert.ok(Math.abs(running.args[6] - -350 * 214 / 320) < 1e-9);
  calls.length = 0;
  hero.attack = { kind: 'light', stage: 2, duration: .4, impactAt: .1, activeUntil: .18, age: .1 };
  renderer.draw(state);
  assert.ok(calls.some(call => call.op === 'drawImage' && call.args[0] === combo));
  delete assets.vladCombo; calls.length = 0;
  renderer.draw(state);
  assert.ok(calls.some(call => call.op === 'drawImage' && call.args[0] === base));
  for (const call of calls) for (const value of call.args) if (typeof value === 'number') assert.ok(Number.isFinite(value), `${String(call.op)} receives finite coordinates`);
  renderer.destroy();
});

// This small raster canvas adapter runs the production silhouette extraction on
// the actual art without requiring a browser or native canvas package in CI.
class RasterCanvas {
  static scans = 0;
  constructor(width, height) { this.width = width; this.height = height; }
  getContext() { return {
    drawImage: image => { this.pixels = image.pixels; },
    getImageData: () => { RasterCanvas.scans++; return { data: this.pixels }; },
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: image => { this.pixels = image.data; },
  }; }
}
function visibleDrawing(call) {
  const [image, , , width, height, x, y, drawnWidth, drawnHeight] = call.args;
  let top = height, bottom = -1, pixels = 0;
  for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
    if (image.pixels[(py * width + px) * 4 + 3] < 64) continue;
    top = Math.min(top, py); bottom = Math.max(bottom, py); pixels++;
  }
  return { top: y + top / height * drawnHeight,
    bottom: y + (bottom + 1) / height * drawnHeight,
    height: (bottom - top + 1) / height * drawnHeight, pixels, x, drawnWidth };
}

test('shipped combo silhouettes stay whole across grid edges, keep the floor, and preserve crouching', async () => {
  const original = globalThis.OffscreenCanvas;
  globalThis.OffscreenCanvas = RasterCanvas;
  try {
    for (const [kind, face, key, filename] of [
      ['vlad', 1, 'vladCombo', 'vlad-combo'],
      ['agi', 1, 'agiCombo', 'agi-combo'],
      ['agi', -1, 'agiComboLeft', 'agi-combo-left'],
    ]) {
      const { data, info } = await sharp(fileURLToPath(new URL(`../public/images/vladrunner2049/${filename}.webp`, import.meta.url))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const img = { width: info.width, height: info.height, pixels: data };
      const { canvas, calls } = drawingContext(), renderer = createRenderer(canvas, { [key]: img }, { reducedMotion: true, shake: false });
      assert.deepEqual(await renderer.prepareAssets(), { prepared: 1, total: 1 });
      const scansBeforeCombat = RasterCanvas.scans;
      const hero = { id: 1, kind, face, x: 600, y: 550, z: 0, hp: 100, maxHp: 100, pose: 'idle' };
      const drawings = [];
      for (let index = 0; index < 12; index++) {
        const stage = Math.floor(index / 4) + 1;
        hero.attack = { stage, duration: .4, impactAt: .1, activeUntil: .18, age: (stage === 3 ? [.04, .075, .11, .35] : [.04, .11, .18, .35])[index % 4] };
        calls.length = 0;
        renderer.draw({ elapsed: 1, simulationTime: 1, players: [hero], enemies: [], effects: [], events: [] });
        const call = calls.find(call => call.op === 'drawImage' && call.args[0] instanceof RasterCanvas);
        assert.ok(call, `${key} frame ${index} uses its isolated silhouette`);
        const drawing = visibleDrawing(call); drawings.push(drawing);
        assert.ok(drawing.pixels > 34000, `${key} frame ${index} retains a whole drawing, including limbs beyond its nominal cell`);
        assert.ok(drawing.bottom > -6 && drawing.bottom < 3, `${key} frame ${index} remains on the shared floor (${drawing.bottom})`);
      }
      assert.ok(drawings[8].height < drawings[0].height * .86, `${key} crouch remains compressed rather than being resized to standing height`);
      assert.equal(RasterCanvas.scans, scansBeforeCombat, 'starting any combo reuses prepared silhouettes instead of scanning the sheet during combat');
      renderer.destroy();
    }
  } finally { if (original) globalThis.OffscreenCanvas = original; else delete globalThis.OffscreenCanvas; }
});
