// STACKED (2026-11-08): its rules, in Node (no browser): the slice on both axes (exact, tiny, a miss), the perfect
// tolerance and the streak's regrowth, the speed curve, the points, the zones, a run from start to miss, the AI that
// plays the demo (deterministic), the floors' colours and the skies, and AGI-1's lines (no money talk).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as L from '../src/games/stacked/logic.js';
import { RAMP, THEMES, floorRgb, floorHex, themeNumbers, blendInto, hexToRgb, rgbToHex } from '../src/games/stacked/theme.js';
import { LINES, endLine, allLines } from '../src/games/stacked/lines.js';
import { rng } from '../src/games/kit/fx.js';

const { BASE, SPAWN, resolveDrop, perfectTolerance } = L;
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const sq = (x = 0, z = 0, w = BASE, d = BASE) => ({ x, z, w, d });

// ---------- the slice ----------

test('a cut along X keeps the overlap and drops the overhang on the side it slid past', () => {
  const below = sq();
  for (const delta of [0.5, -0.5, 1.2, -2.9]) {
    const r = resolveDrop(below, sq(delta), 'x');
    assert.equal(r.kind, 'cut');
    assert.ok(near(r.placed.w, BASE - Math.abs(delta)), 'kept = size − |delta|');
    assert.ok(near(r.fallen.w, Math.abs(delta)), 'fallen = |delta|');
    assert.ok(near(r.placed.w + r.fallen.w, BASE), 'nothing lost or made');
    assert.equal(r.placed.d, BASE); assert.equal(r.fallen.d, BASE);
    assert.ok(near(r.placed.x, delta / 2), 'the kept part is centred on the overlap');
    // the fallen part touches the kept part and sits on delta's side
    const keptEdge = r.placed.x + Math.sign(delta) * r.placed.w / 2;
    const fallEdge = r.fallen.x - Math.sign(delta) * r.fallen.w / 2;
    assert.ok(near(keptEdge, fallEdge), 'they meet at the floor below\'s edge');
    assert.ok(near(keptEdge, Math.sign(delta) * BASE / 2));
  }
});

test('a cut along Z mirrors it, and the other axis is never touched', () => {
  const below = sq(0.3, -0.2, 2.4, 2.2);
  const r = resolveDrop(below, { x: 0.3, z: -0.2 + 0.7, w: 2.4, d: 2.2 }, 'z');
  assert.equal(r.kind, 'cut');
  assert.ok(near(r.placed.d, 1.5)); assert.ok(near(r.fallen.d, 0.7));
  assert.equal(r.placed.w, 2.4); assert.equal(r.placed.x, 0.3);
  assert.ok(near(r.placed.z, -0.2 + 0.35));
  assert.ok(near(r.fallen.z, -0.2 + 1.1 + 0.35));
});

test('exact drops and drops inside the tolerance snap perfectly (nothing lost); just outside, a cut', () => {
  const below = sq(0.4, -0.3, 2.5, 2.8);
  const tol = perfectTolerance(2.5);
  for (const e of [0, tol * 0.5, -tol * 0.99, tol]) {
    const r = resolveDrop(below, { ...below, x: below.x + e }, 'x');
    assert.equal(r.kind, 'perfect', `error ${e}`);
    assert.deepEqual([r.placed.x, r.placed.z, r.placed.w, r.placed.d], [below.x, below.z, below.w, below.d]);
    assert.equal(r.fallen, null);
  }
  const r = resolveDrop(below, { ...below, x: below.x + tol * 1.05 }, 'x');
  assert.equal(r.kind, 'cut');
  assert.ok(r.fallen.w > 0 && r.fallen.w < tol * 1.1, 'a tiny sliver falls');
});

test('a miss: no overlap at all (or only touching) ends it, the whole floor falls', () => {
  const below = sq();
  for (const delta of [BASE, BASE + 0.01, -BASE - 1, SPAWN]) {
    const r = resolveDrop(below, sq(delta), 'x');
    assert.equal(r.kind, 'miss', `delta ${delta}`);
    assert.equal(r.placed, null);
    assert.equal(r.fallen.w, BASE);
  }
  // a hair of overlap still counts (and it's a close one)
  const r = resolveDrop(below, sq(BASE - 0.01), 'x');
  assert.equal(r.kind, 'cut'); assert.ok(r.close); assert.ok(near(r.placed.w, 0.01, 1e-9));
});

test('the perfect tolerance: 3.5% of the size, never under 0.06 units or 24 ms of travel', () => {
  assert.ok(near(perfectTolerance(3), 0.105));
  assert.ok(near(perfectTolerance(1), 0.06), 'the minimum on a small floor');
  assert.ok(near(perfectTolerance(0.2), 0.06));
  assert.ok(near(perfectTolerance(1, 5), 0.12), 'a fast floor keeps a fair window');
  for (const size of [0.3, 1, 2, 3]) for (const speed of [0, 3, 4, 5]) {
    const tol = perfectTolerance(size, speed);
    assert.ok(tol >= 0.06 && tol >= 0.035 * size - 1e-12 && tol >= speed * 0.024 - 1e-12);
    assert.ok(tol / size <= 0.4 || size < 0.3, 'never silly');
  }
});

test('the streak: from 6 perfects in a row each perfect grows the floor back a little, never past the lobby', () => {
  const below = sq(0, 0, 2, 2.6);
  for (let streak = 0; streak < 5; streak++) {
    const r = resolveDrop(below, { ...below }, 'x', { streak });
    assert.equal(r.kind, 'perfect'); assert.equal(r.grew, 0); assert.equal(r.streak, streak + 1); assert.equal(r.placed.w, 2);
  }
  const r6 = resolveDrop(below, { ...below }, 'x', { streak: 5 });
  assert.equal(r6.streak, 6);
  assert.ok(near(r6.grew, L.GROW.step)); assert.ok(near(r6.placed.w, 2 + L.GROW.step));
  assert.equal(r6.placed.d, 2.6, 'only along the axis it slid');
  // it grows along Z on a Z floor
  const rz = resolveDrop(below, { ...below }, 'z', { streak: 9 });
  assert.ok(near(rz.placed.d, 2.6 + L.GROW.step)); assert.equal(rz.placed.w, 2);
  // capped at BASE
  const full = resolveDrop(sq(0, 0, BASE - 0.05), sq(0, 0, BASE - 0.05), 'x', { streak: 20 });
  assert.ok(near(full.placed.w, BASE)); assert.ok(near(full.grew, 0.05));
  const max = resolveDrop(sq(), sq(), 'x', { streak: 20 });
  assert.equal(max.grew, 0); assert.equal(max.placed.w, BASE);
  // a cut breaks the streak
  assert.equal(resolveDrop(sq(), sq(0.5), 'x', { streak: 12 }).streak, 0);
});

// ---------- speed, points, zones ----------

test('the speed starts slow and rises with height, smoothly, never past its cap', () => {
  assert.equal(L.speedAt(0), L.SPEED.start);
  let prev = 0;
  for (let f = 0; f <= 1000; f += 5) {
    const v = L.speedAt(f);
    assert.ok(v >= prev, 'never slower higher up');
    assert.ok(v <= L.SPEED.max);
    prev = v;
  }
  assert.ok(L.speedAt(25) - L.SPEED.start < 0.5, 'the first zone stays gentle');
  assert.ok(L.speedAt(170) > L.SPEED.max - 1e-9, 'its cap in orbit');
  assert.equal(L.speedAt(1000), L.SPEED.max, 'and no faster');
});

test('points: +1 a floor, +1 a perfect, +5 on every 10th perfect in a row, none for a miss', () => {
  assert.equal(L.pointsFor('cut', 0), 1);
  assert.equal(L.pointsFor('perfect', 1), 2);
  assert.equal(L.pointsFor('perfect', 9), 2);
  assert.equal(L.pointsFor('perfect', 10), 7);
  assert.equal(L.pointsFor('perfect', 20), 7);
  assert.equal(L.pointsFor('perfect', 21), 2);
  assert.equal(L.pointsFor('miss', 10), 0);
});

test('the zones by height, and the altitude in metres', () => {
  const at = (f) => L.zoneOf(f).id;
  assert.deepEqual([0, 24, 25, 49, 50, 89, 90, 139, 140, 999].map(at),
    ['city', 'city', 'rain', 'rain', 'sunrise', 'sunrise', 'strato', 'strato', 'orbit', 'orbit']);
  assert.deepEqual(L.ZONES.map((z) => z.name), ['City night', 'Rain clouds', 'Above the clouds', 'Stratosphere', 'Orbit']);
  assert.deepEqual(L.nextZone(20), { zone: L.ZONES[1], floors: 5 });
  assert.equal(L.nextZone(140), null);
  assert.equal(L.altitude(312), 1248);
  assert.equal(L.altitudeText(312), '1,248 m');
  assert.equal(L.altitudeText(0), '0 m');
});

// ---------- a run ----------

test('a run: floors alternate X and Z, swing from beyond the edge, and the points add up', () => {
  const run = L.createRun();
  assert.equal(L.heightOf(run), 0);
  assert.equal(run.axis, 'x'); assert.equal(run.offset, -SPAWN);
  assert.ok(near(run.moving.x, -SPAWN)); assert.equal(run.moving.z, 0);
  // it swings: past +SPAWN it comes back
  L.stepRun(run, (2 * SPAWN + 0.5) / run.speed);
  assert.equal(run.dir, -1); assert.ok(near(run.offset, SPAWN - 0.5, 1e-9));
  // a perfect: line it up
  run.offset = 0.01; run.moving.x = 0.01;
  let ev = L.dropRun(run);
  assert.equal(ev.kind, 'perfect'); assert.equal(ev.points, 2); assert.equal(ev.height, 1); assert.equal(run.score, 2);
  assert.equal(run.axis, 'z', 'floor 2 slides along Z'); assert.ok(near(run.moving.z, -SPAWN));
  // a cut
  run.offset = 0.8; run.moving.z = 0.8;
  ev = L.dropRun(run);
  assert.equal(ev.kind, 'cut'); assert.equal(run.streak, 0); assert.equal(run.score, 3);
  assert.ok(near(L.topOf(run).d, BASE - 0.8));
  // a miss ends it
  run.offset = SPAWN; run.moving.x = SPAWN;
  ev = L.dropRun(run);
  assert.equal(ev.kind, 'miss'); assert.ok(run.over); assert.equal(L.dropRun(run), null);
  assert.equal(L.heightOf(run), 2);
  const s = L.summary(run);
  assert.equal(s.floors, 2); assert.equal(s.score, 3); assert.equal(s.perfects, 1); assert.equal(s.altitudeText, '8 m');
});

test('a tap\'s delay: the drop can use where the floor was a moment ago, never before it appeared', () => {
  const run = L.createRun();
  L.stepRun(run, 0.5);
  const now = run.offset;
  assert.ok(near(L.offsetAt(run, 0.02), now - run.speed * 0.02));
  assert.ok(near(L.offsetAt(run, 5), -SPAWN), 'clamped to its first moment');
  // across a turn it bounces back the same way
  run.offset = SPAWN - 0.01; run.dir = -1; run.age = 1;
  assert.ok(near(L.offsetAt(run, 0.02), SPAWN - (run.speed * 0.02 - 0.01)));
});

test('the zone event fires once, on the floor that reaches a new zone', () => {
  const run = L.createRun();
  const zones = [];
  for (let i = 0; i < 60; i++) {
    run.offset = 0; if (run.axis === 'x') run.moving.x = L.topOf(run).x; else run.moving.z = L.topOf(run).z;
    const ev = L.dropRun(run);
    if (ev.zone >= 0) zones.push([ev.height, ev.zone]);
  }
  assert.deepEqual(zones, [[25, 1], [50, 2]]);
  assert.equal(run.bestStreak, 60);
  assert.equal(run.score, 60 * 2 + 6 * 5, 'perfects and the ×10s');
});

test('the AI: deterministic with a seed, mostly perfect with a few cuts, and it builds a tall tower', () => {
  const build = (seed) => L.prebuild(L.createRun(), 60, rng(seed));
  const a = build(7), b = build(7), c = build(8);
  assert.deepEqual(a.floors, b.floors, 'the same seed, the same tower');
  assert.notDeepEqual(a.floors, c.floors);
  assert.equal(L.heightOf(a), 60);
  assert.ok(!a.over);
  assert.ok(a.perfects > 30 && a.cuts >= 2, `${a.perfects} perfects, ${a.cuts} cuts`);
  for (const f of a.floors) assert.ok(f.w > 0.5 && f.w <= BASE + 1e-9 && f.d > 0.5 && f.d <= BASE + 1e-9);
  // crossing: it fires between two steps when the floor passes the aim
  assert.ok(L.crosses(-0.1, 0.1, 0)); assert.ok(L.crosses(0.1, -0.1, 0)); assert.ok(!L.crosses(0.2, 0.3, 0));
  // the demo can play it out in real steps
  const r = rng(3), run = L.createRun();
  let aim = L.aimFor(r), prev = run.offset, steps = 0;
  while (L.heightOf(run) < 40 && !run.over && steps < 120 * 120) {
    L.stepRun(run, 1 / 120); steps++;
    if (L.crosses(prev, run.offset, aim.error)) { L.dropRun(run); aim = L.aimFor(r); }
    prev = run.offset;
  }
  assert.equal(L.heightOf(run), 40, 'it reaches 40 floors');
  assert.ok(steps / 120 < 60, `in under a minute (${(steps / 120).toFixed(1)} s)`);
});

// ---------- the look ----------

test('the floors\' colours ramp smoothly through the palette and keep cycling up in orbit', () => {
  assert.equal(floorHex(0), RAMP[0][1]);
  for (const [f, hex] of RAMP) assert.equal(floorHex(f), hex);
  let worst = 0;
  for (let f = 0; f < 600; f++) {
    const a = floorRgb(f), b = floorRgb(f + 1);
    for (const v of [...a, ...b]) assert.ok(v >= 0 && v <= 1);
    worst = Math.max(worst, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
  }
  assert.ok(worst < 0.12, `neighbouring floors stay close (${worst.toFixed(3)})`);
  assert.equal(floorHex(1000), floorHex(1000 + 90), 'a cycle of 90 floors in orbit');
  assert.equal(rgbToHex(hexToRgb('#3ff0c3')), '#3ff0c3');
});

test('the skies: one per zone, the same keys in each, and they blend', () => {
  assert.deepEqual(THEMES.map((t) => t.id), L.ZONES.map((z) => z.id));
  const keys = Object.keys(THEMES[0]).sort();
  for (const t of THEMES) {
    assert.deepEqual(Object.keys(t).sort(), keys, t.id);
    for (const [k, v] of Object.entries(t)) if (typeof v === 'string' && k !== 'id') assert.match(v, /^#[0-9a-f]{6}$/, `${t.id}.${k}`);
  }
  const a = themeNumbers(THEMES[0]), b = themeNumbers(THEMES[2]);
  const half = blendInto({}, a, b, 0.5);
  assert.ok(near(half.lit, (THEMES[0].lit + THEMES[2].lit) / 2));
  assert.ok(near(half.top[1], (a.top[1] + b.top[1]) / 2));
  assert.deepEqual(blendInto({}, a, b, 0).top, a.top);
});

// ---------- words ----------

test('AGI-1\'s lines: her voice, no money talk, and the end line fits the run', () => {
  const lines = allLines();
  assert.ok(lines.length >= 16, `${lines.length} lines`);
  for (const line of lines) {
    assert.equal(line, line.toLowerCase(), `lowercase: ${line}`);
    assert.ok(!/\b(buy|sell|price|\$|agi\b|invest|profit|pump|dump|moon|token|coin|money|gain)/i.test(line), `no money talk: ${line}`);
    assert.ok(line.length <= 60, `short: ${line}`);
  }
  const first = (arr) => arr[0];
  assert.equal(endLine({ floors: 3, isBest: false, next: L.nextZone(3), bestStreak: 0 }, first), LINES.low[0]);
  assert.equal(endLine({ floors: 30, isBest: true, next: L.nextZone(30), bestStreak: 0 }, first), LINES.best[0]);
  assert.equal(endLine({ floors: 47, isBest: false, next: L.nextZone(47), bestStreak: 0 }, first), 'so close to above the clouds… one more? 💜');
  assert.equal(endLine({ floors: 70, isBest: false, next: L.nextZone(70), bestStreak: 2 }, first), LINES.high[0]);
});

test('the share text and the game\'s files keep the arcade\'s rules', () => {
  const src = ['game.js', 'scene.js', 'logic.js', 'theme.js', 'lines.js', 'sound.js', 'shaders.js', 'hud.js']
    .map((f) => { try { return readFileSync(new URL(`../src/games/stacked/${f}`, import.meta.url), 'utf8'); } catch { return ''; } }).join('\n');
  assert.ok(!/Math\.random\(\)/.test(src.replace(/\/\/.*$/gm, '')), 'gameplay never uses Math.random (the demo replays with a seed)');
  assert.ok(!/\beval\(|new Function\(|setAttribute\(\s*['"]style/.test(src), 'nothing the CSP refuses');
  assert.ok(!/https?:\/\/(?!agi1\.app)/.test(src.replace(/\/\/.*$/gm, '')), 'nothing from another site');
  const page = readFileSync(new URL('../src/games/stacked/page.js', import.meta.url), 'utf8');
  assert.match(page, /^[\s\S]*?import '\.\.\/intro\.js';/);
});
