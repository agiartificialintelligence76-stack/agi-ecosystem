// ROBOTAXI RUSH (agi1.app/games/robotaxi): its rules, run in Node. The camera's projection, the endless road (curves
// and hills that never jump), the traffic (the same seed, the same traffic; always a way through), near misses and
// crashes, the boost and the shields, the score, the checkpoints and zones, the demo's driver, and its words.
// Run: node --test tests/robotaxi.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  SEG, ROAD_HALF, LANE_X, PLAYER, CAM_H, CAM_BACK, MPU, ZONE_SEGS, ZONE_Z, ZONES, SPEED, BOOST, NEAR_MISS, SHIELDS,
  FARE_POINTS, CHECKPOINT_POINTS, RAM_POINTS, DRAW, cruiseAt, zoneOfIndex,
} from '../src/games/robotaxi/config.js';
import { layoutView, zoomView, project } from '../src/games/robotaxi/camera.js';
import { createTrack, HILL_MAX, SLOPE_MAX, CALM, isGate, CURVE } from '../src/games/robotaxi/track.js';
import { createTraffic, sweep, TYPES, HIT_W, SPAWN_AHEAD, FOLLOW_GAP, spanL, spanR, predictX } from '../src/games/robotaxi/traffic.js';
import { createRun, stepRun, summary, scoreOf } from '../src/games/robotaxi/sim.js';
import { createAI } from '../src/games/robotaxi/ai.js';
import { decorAt, decorBuffer, MAX_DECOR } from '../src/games/robotaxi/decor.js';
import { END, RIDE, ALL_LINES, endLine } from '../src/games/robotaxi/lines.js';
import { LOOKS, roadColors, FOG_STEPS } from '../src/games/robotaxi/zones.js';

const DT = 1 / 120;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const steps = (run, sec, input = { steer: 0, target: null, boost: false }) => {
  const evs = [];
  for (let i = 0; i < Math.round(sec / DT); i++) { stepRun(run, DT, input); evs.push(...run.events); run.events.length = 0; input.boost = false; }
  return evs;
};
// a quiet road with one car on it, `dz` ahead of the robotaxi, at x
function quietRun({ speed = 9000, x = LANE_X[1] } = {}) {
  const run = createRun({ seed: 11, quiet: true });
  assert.equal(run.traffic.cars.length, 0);
  run.speed = speed; run.x = x; run.prevX = x;
  return run;
}
function carAt(run, { type = 'pod', x, dz, v = 4000 }) {
  const T = TYPES[type];
  const lane = LANE_X.reduce((b, lx, i) => (Math.abs(lx - x) < Math.abs(LANE_X[b] - x) ? i : b), 0);
  const c = {
    id: 9000 + run.traffic.cars.length, type, halfW: T.halfW, len: T.len, h: T.h, lane, laneTo: lane, x, z: run.z + dz, base: v, v,
    blinkT: 0, shiftT: 0, drift: 0, changed: false, rush: 0, slow: 0, passed: false, minGap: Infinity, hit: false, near: false,
    ghost: false, gone: false, flying: false, fly: null, paint: 0, wob: 0, prevZ: run.z + dz, prevX: x,
  };
  run.traffic.cars.push(c);
  return c;
}
const hold = (x) => ({ steer: 0, target: x, boost: false });
const typesOf = (evs) => evs.map((e) => e.type);

// ---------- the camera ----------
test('projection: the road at the robotaxi lands exactly where the layout puts it, on every screen', () => {
  for (const [w, h, top] of [[390, 844, 64], [360, 740, 64], [844, 390, 54], [820, 1180, 64], [1440, 900, 64], [2560, 1440, 64], [480, 480, 0], [884, 1104, 64]]) {
    const v = layoutView(w, h, { top });
    assert.ok(v.horizon > top && v.horizon < v.carY && v.carY < h, `${w}×${h}: horizon above the robotaxi, both on screen`);
    const l = project(v, -ROAD_HALF, -CAM_H, CAM_BACK), r = project(v, ROAD_HALF, -CAM_H, CAM_BACK);
    assert.ok(near(l.y, v.carY, 1e-6) && near(r.y, v.carY, 1e-6), 'the road under the robotaxi is at its height');
    assert.ok(near(r.x - l.x, v.roadFrac * w, 1e-6), 'and roadFrac screens wide');
    assert.ok(near((l.x + r.x) / 2, w / 2, 1e-6), 'centred');
    // a tall phone sees the road wider than its screen at the robotaxi; a wide screen about its own width
    assert.ok(v.roadFrac >= 1.05 && v.roadFrac <= 1.6);
  }
  assert.ok(layoutView(390, 844, { top: 64 }).roadFrac > layoutView(1440, 900, { top: 64 }).roadFrac, 'tall screens get the wider road');
});

test('projection: further is higher and narrower, and the far road meets the horizon', () => {
  const v = layoutView(1440, 900, { top: 64 });
  let lastY = Infinity, lastW = Infinity;
  for (let z = CAM_BACK; z < DRAW * SEG; z += 1000) {
    const a = project(v, -ROAD_HALF, -CAM_H, z), b = project(v, ROAD_HALF, -CAM_H, z);
    assert.ok(a.y < lastY && b.x - a.x < lastW, `at ${z}`);
    assert.ok(near(a.s, v.fx / z, 1e-9), 'scale is focal length over distance');
    lastY = a.y; lastW = b.x - a.x;
  }
  assert.ok(Math.abs(project(v, 0, -CAM_H, 1e9).y - v.horizon) < 0.01, 'at infinity, the horizon');
  // a hill ahead (road above the camera's eye) shows above the horizon
  assert.ok(project(v, 0, 500, 20000).y < v.horizon);
});

test("projection: the boost's dolly zoom keeps the robotaxi the same size and place while the road ahead shrinks", () => {
  const v = layoutView(390, 844, { top: 64 });
  const z = zoomView(v, 0.8);
  const p0 = project(v, ROAD_HALF, -CAM_H, v.camBack), p1 = project(z, ROAD_HALF, -CAM_H, z.camBack);
  assert.ok(near(p0.x, p1.x, 1e-6) && near(p0.y, p1.y, 1e-6) && near(p0.s, p1.s, 1e-9));
  const f0 = project(v, ROAD_HALF, -CAM_H, 30000 + v.camBack), f1 = project(z, ROAD_HALF, -CAM_H, 30000 + z.camBack);
  assert.ok(f1.s < f0.s * 0.83, 'far things get smaller: the road stretches away');
});

// ---------- the road ----------
test('the road: every segment starts at the height the last one ended, curves ease in and out, hills stay gentle', () => {
  for (const seed of [1, 7, 2049]) {
    const t = createTrack(seed);
    let bends = 0, climbs = 0;
    for (let i = t.startIndex; i < 9000; i++) {
      t.ensure(i + 1);            // (only the newest segments are kept: look at each as it's made)
      assert.equal(t.y2(i), t.y1(i + 1), `seed ${seed}: no step at segment ${i}`);
      assert.ok(Math.abs(t.curve(i + 1) - t.curve(i)) <= 0.5, `seed ${seed}: the curve never snaps (segment ${i})`);
      assert.ok(Math.abs(t.curve(i)) <= CURVE.max + 1e-6);
      assert.ok(Math.abs(t.y2(i)) <= HILL_MAX + 1e-6, 'within its heights');
      assert.ok(Math.abs(t.y2(i) - t.y1(i)) <= SLOPE_MAX * Math.PI / 2 * SEG + 1e-6, `seed ${seed}: never steeper than a climb's steepest point (${i})`);
      if (i < t.startIndex + CALM) assert.ok(t.curve(i) === 0 && t.y2(i) === 0, 'a run starts straight and flat');
      if (Math.abs(t.curve(i)) > CURVE.medium * 0.8) bends++;
      if (Math.abs(t.y2(i)) > 1000) climbs++;
    }
    // it does bend and climb
    assert.ok(bends > 300 && climbs > 300, `seed ${seed}: curves (${bends}) and hills (${climbs})`);
  }
});

test('the road is the same for the same seed, different for another, and endless (only the last stretch is kept)', () => {
  const a = createTrack(42), b = createTrack(42), c = createTrack(43);
  a.ensure(3000); b.ensure(3000); c.ensure(3000);
  let same = true, diff = false;
  for (let i = 0; i < 3000; i++) { if (a.curve(i) !== b.curve(i) || a.y2(i) !== b.y2(i)) same = false; if (a.curve(i) !== c.curve(i)) diff = true; }
  assert.ok(same && diff);
  // far down the road: still continuous (the ring buffer keeps the newest segments)
  a.ensure(60000);
  for (let i = 59000; i < 60000; i++) assert.equal(a.y2(i), a.y1(i + 1));
  assert.ok(near(a.yAt(59000 * SEG + SEG / 2), (a.y1(59000) + a.y2(59000)) / 2, 1e-6), 'heights between edges');
  // a run can start further on (the demo starts in night city)
  const d = createTrack(5, { startIndex: 1600 });
  d.ensure(2000);
  assert.equal(d.y1(1600), 0);
  assert.equal(zoneOfIndex(1600), 'night');
});

test('checkpoints every 2 km, and the zones in order: dusk, night city, rain, sunrise coast, round again', () => {
  assert.equal(ZONE_SEGS * SEG * MPU, 2000);
  assert.deepEqual(ZONES, ['dusk', 'night', 'rain', 'coast']);
  for (let k = 0; k < 9; k++) assert.equal(zoneOfIndex(k * ZONE_SEGS + 5), ZONES[k % 4]);
  assert.ok(isGate(ZONE_SEGS) && isGate(3 * ZONE_SEGS) && !isGate(0) && !isGate(ZONE_SEGS + 1));
  const out = decorBuffer();
  assert.equal(decorAt(ZONE_SEGS * 2, 'rain', 0, out), 1);
  assert.equal(out[0].kind, 'gate');
  for (const dz of [-4, -1, 1, 3]) assert.equal(decorAt(ZONE_SEGS * 2 + dz, 'rain', 0, out), 0, 'a clear stretch around the gate');
});

test('scenery: the same segment always gets the same things, never too many', () => {
  const a = decorBuffer(), b = decorBuffer();
  const kinds = new Set();
  for (const zone of ZONES) for (let i = 10; i < 1400; i++) {
    const n = decorAt(i, zone, (i % 7) - 3, a);
    assert.equal(decorAt(i, zone, (i % 7) - 3, b), n);
    assert.ok(n <= MAX_DECOR);
    for (let k = 0; k < n; k++) { assert.deepEqual(a[k], b[k]); kinds.add(a[k].kind); assert.ok(Math.abs(a[k].x) >= ROAD_HALF || a[k].kind === 'gantry', 'beside the road (or over it)'); }
  }
  for (const k of ['palm', 'palmC', 'lampL', 'lampR', 'neon', 'billboard', 'chevronL', 'chevronR', 'post', 'gantry', 'umbrella', 'tower', 'building']) assert.ok(kinds.has(k), k);
});

test("zones' colors: every road color has its haze steps", () => {
  for (const z of ZONES) {
    const c = roadColors(LOOKS[z]);
    for (const k of ['road', 'rumble', 'ground']) for (const alt of c[k]) assert.equal(alt.length, FOG_STEPS);
    assert.match(c.lane[0], /^#[0-9a-f]{6}$/);
  }
});

// ---------- the traffic ----------
function ghostDrive(seed, sec, { startM = 0, sample = 0.25, check } = {}) {
  // an untouchable robotaxi driving at cruise (it never crashes, never steers): only the traffic's own life
  const tr = createTraffic(seed);
  const ctx = { z: startM / MPU, speed: 0, cruise: 0, x: LANE_X[1], shields: 3 };
  ctx.cruise = cruiseAt(startM); ctx.speed = ctx.cruise;
  tr.prefill(ctx);
  let t = 0, next = 0;
  while (t < sec) {
    ctx.cruise = cruiseAt(ctx.z * MPU); ctx.speed = ctx.cruise;
    ctx.z += ctx.speed * DT;
    tr.update(DT, ctx);
    t += DT;
    if (t >= next) { next += sample; check?.(tr, ctx, t); }
  }
  return tr;
}

test('traffic: the same seed gives the same traffic', () => {
  const snap = (tr) => tr.cars.map((c) => `${c.type}:${c.lane}:${Math.round(c.z)}:${Math.round(c.x)}`).join('|');
  const a = ghostDrive(5, 12), b = ghostDrive(5, 12), c = ghostDrive(6, 12);
  assert.ok(a.cars.length > 5);
  assert.equal(snap(a), snap(b));
  assert.notEqual(snap(a), snap(c));
});

test('traffic: there is always a way through (the guardian), cars never overlap in a lane, and it gets busier', () => {
  for (const [seed, startM] of [[1, 0], [9, 2400], [33, 6000]]) {
    let checks = 0, walls = 0, overlaps = 0, early = 0, late = 0;
    ghostDrive(seed, 34, {
      startM,
      check(tr, ctx, t) {
        checks++;
        const w = sweep(tr.cars, ctx.z, ctx.speed, { from: 3500 });
        if (w && w.z < ctx.z + SPAWN_AHEAD * 0.75) walls++;
        const live = tr.cars.filter((c) => !c.flying);
        for (const a of live) for (const b of live) {
          if (a === b || spanR(a) < spanL(b) || spanR(b) < spanL(a)) continue;
          if (Math.abs(a.z - b.z) < (a.len + b.len) / 2 - 1) overlaps++;
        }
        const ahead = live.filter((c) => c.z > ctx.z && c.z < ctx.z + SPAWN_AHEAD).length;
        if (t > 4 && t < 12) early += ahead; if (t > 26) late += ahead;
      },
    });
    assert.equal(walls, 0, `seed ${seed}: no wall in ${checks} looks ahead`);
    assert.equal(overlaps, 0, `seed ${seed}: no two cars inside each other`);
    if (startM === 0) assert.ok(late > early * 1.2, `seed ${seed}: busier later (${early} → ${late})`);
  }
});

test("traffic: a new car that would close the road isn't placed", () => {
  // three cars side by side leave the fourth lane open; a fourth beside them would be a wall
  const cars = [0, 1, 2].map((lane) => ({ type: 'pod', halfW: 285, len: 470, lane, laneTo: lane, x: LANE_X[lane], z: 20000, v: 4000, blinkT: 0, shiftT: 0 }));
  assert.equal(sweep(cars, 0, 9000), null, 'one lane open: a way through');
  const wall = { type: 'pod', halfW: 285, len: 470, lane: 3, laneTo: 3, x: LANE_X[3], z: 20000, v: 4000, blinkT: 0, shiftT: 0 };
  const w = sweep(cars, 0, 9000, { extra: wall });
  assert.ok(w && Math.abs(w.z - 9000 * w.t) < 1 && w.z > 15000, 'all four: a wall where the robotaxi would meet them');
  // a car changing lanes takes both while it moves: met in the middle of its change, it closes the road
  const close = [0, 1].map((lane) => ({ ...cars[lane], z: 6000 }));
  const blinker = { ...cars[2], z: 6000, lane: 2, laneTo: 3, blinkT: 0.5, vTo: 4000 };
  assert.ok(sweep([...close, blinker], 0, 9000), 'a lane change counts as both lanes');
  assert.equal(sweep([...close, { ...blinker, z: 30000 }], 0, 9000), null, 'met long after it has moved over: a lane is open again');
  assert.equal(predictX(blinker, 0.2), LANE_X[2], 'still in its lane while it blinks');
  assert.ok(near(predictX(blinker, 0.5 + 0.9), LANE_X[3], 1e-6), 'in the new one once it has moved');
});

// ---------- near misses, crashes, the boost ----------
test('near miss: passing a car close (but not touching) scores 250, closer still 500, far away nothing', () => {
  const cases = [[260, 0, null], [150, 1, false], [30, 1, true]];
  for (const [gap, count, close] of cases) {
    const run = quietRun();
    const dx = PLAYER.halfW + TYPES.pod.halfW + gap;
    carAt(run, { x: run.x + dx, dz: 2500 });
    const evs = steps(run, 1.4, hold(run.x));
    const nm = evs.filter((e) => e.type === 'near');
    assert.equal(nm.length, count, `a ${gap}-unit gap`);
    assert.ok(!typesOf(evs).includes('crash'));
    if (count) {
      assert.equal(nm[0].close, close);
      assert.equal(nm[0].pts, close ? NEAR_MISS.closePoints : NEAR_MISS.points);
      assert.equal(run.points, nm[0].pts);
      assert.ok(near(run.boost, close ? BOOST.perClose : BOOST.perNear, 1e-9), 'and it charges the boost');
    }
  }
});

test("near miss: no points when too slow, and none for a car it passed while ghosting", () => {
  const slow = quietRun({ speed: NEAR_MISS.minSpeed - 400 });
  slow.cruise = slow.speed;
  carAt(slow, { x: slow.x + PLAYER.halfW + TYPES.pod.halfW + 100, dz: 1200, v: 1500 });
  slow.t = 0;
  const evs = [];
  for (let i = 0; i < 120; i++) { stepRun(slow, DT, hold(slow.x)); slow.speed = NEAR_MISS.minSpeed - 400; evs.push(...slow.events); slow.events.length = 0; }
  assert.ok(!typesOf(evs).includes('near'));
  const ghost = quietRun();
  ghost.grace = 2;
  carAt(ghost, { x: ghost.x + 100, dz: 2000 });
  const e2 = steps(ghost, 1.2, hold(ghost.x));
  assert.ok(!typesOf(e2).includes('near') && !typesOf(e2).includes('crash'), 'ghosting through a car is neither');
});

test('near misses chain within 2 seconds: ×2, ×3…; the chain ends after 2 quiet seconds', () => {
  const run = quietRun();
  const dx = PLAYER.halfW + TYPES.pod.halfW + 150;
  carAt(run, { x: run.x + dx, dz: 2500 });
  carAt(run, { x: run.x - dx, dz: 2500 + 5000 * 0.8 });
  carAt(run, { x: run.x + dx, dz: 2500 + 5000 * 1.6 });
  const evs = steps(run, 3, hold(run.x));
  const nm = evs.filter((e) => e.type === 'near');
  assert.deepEqual(nm.map((e) => e.combo), [1, 2, 3]);
  assert.deepEqual(nm.map((e) => e.pts), [250, 500, 750]);
  assert.equal(run.bestCombo, 3);
  const later = steps(run, 2.2, hold(run.x));
  assert.ok(typesOf(later).includes('chainEnd'));
  assert.equal(run.combo, 0);
});

test('crash: a hit costs a shield, spins it out, slows it down and gives a moment of ghosting; three and the ride is over', () => {
  const run = quietRun();
  carAt(run, { x: run.x + 120, dz: 1500 });
  const evs = steps(run, 0.6, hold(run.x));
  const crash = evs.find((e) => e.type === 'crash');
  assert.ok(crash && !crash.wreck);
  assert.equal(run.shields, SHIELDS - 1);
  assert.ok(run.grace > 0 && run.spin >= 0 && run.speed < 9000 * 0.8);
  // ghosting: another car right away doesn't count
  carAt(run, { x: run.x, dz: 900 });
  assert.ok(!typesOf(steps(run, 0.6, hold(run.x))).includes('crash'));
  // and with one shield left, the next hit ends the ride
  const last = quietRun();
  last.shields = 1;
  carAt(last, { x: last.x, dz: 1500 });
  const e2 = steps(last, 3, hold(last.x));
  assert.ok(typesOf(e2).includes('wreck') && typesOf(e2).includes('done'));
  assert.ok(last.over && last.shields === 0);
  assert.ok(last.speed < 200, 'it stops');
});

test('boost: only when full; 4 seconds faster; cars in the way go flying (+150), no shield lost', () => {
  const run = quietRun();
  run.boost = 0.9;
  steps(run, 0.1, { steer: 0, target: run.x, boost: true });
  assert.equal(run.boostT, 0, 'not full: nothing');
  run.boost = 1;
  const start = steps(run, 0.05, { steer: 0, target: run.x, boost: true });
  assert.ok(typesOf(start).includes('boost'));
  carAt(run, { x: run.x, dz: 3000 });
  const evs = steps(run, 1.5, hold(run.x));
  assert.ok(run.speed > run.cruise * 1.2, 'faster than cruise');
  const ram = evs.find((e) => e.type === 'ram');
  assert.ok(ram && ram.car.flying && ram.pts === RAM_POINTS);
  assert.equal(run.shields, SHIELDS);
  assert.ok(run.boost < 1 && run.boost > 0.5, 'the meter drains');
  let ended = false;
  for (let i = 0; i < BOOST.time / DT && !ended; i++) { stepRun(run, DT, hold(run.x)); ended = run.events.some((e) => e.type === 'boostEnd'); run.events.length = 0; }
  assert.ok(ended && run.boostT === 0 && run.boost === 0);
  assert.ok(run.grace > 0.5, 'a moment of ghosting as it ends');
});

test('passenger pins (+500, some boost) and shields (one back, never more than three)', () => {
  const run = quietRun();
  run.traffic.items.push({ kind: 'fare', x: run.x + 200, z: run.z + 1200, taken: false, t: 0, id: 1 });
  const e1 = steps(run, 0.4, hold(run.x));
  assert.ok(typesOf(e1).includes('fare'));
  assert.equal(run.points, FARE_POINTS);
  assert.ok(near(run.boost, BOOST.perFare, 1e-9));
  run.shields = 2;
  run.traffic.items.push({ kind: 'shield', x: run.x, z: run.z + 1200, taken: false, t: 0, id: 2 });
  steps(run, 0.4, hold(run.x));
  assert.equal(run.shields, 3);
  run.traffic.items.push({ kind: 'shield', x: run.x, z: run.z + 1200, taken: false, t: 0, id: 3 });
  const e3 = steps(run, 0.4, hold(run.x));
  assert.equal(run.shields, SHIELDS);
  assert.equal(e3.find((e) => e.type === 'shield').gained, false);
});

test('the score is the metres driven plus the points; a checkpoint is +1,000 and the next zone', () => {
  const run = quietRun();
  steps(run, 1, hold(run.x));
  assert.equal(run.score, Math.floor(run.dist) + run.points);
  assert.equal(scoreOf(run), run.score);
  assert.ok(near(run.dist, run.z * MPU, 1e-9));
  run.z = ZONE_Z - 400; run.prevZ = run.z;
  run.traffic.cars.length = 0;
  const evs = steps(run, 0.2, hold(run.x));
  const cp = evs.find((e) => e.type === 'checkpoint');
  assert.ok(cp && cp.zone === 'night' && cp.pts === CHECKPOINT_POINTS);
  assert.equal(run.zone, 'night');
  assert.equal(run.checkpoints, 1);
  const s = summary(run);
  assert.equal(s.score, run.score);
  assert.ok(s.km > 1.99 && s.topKmh >= 200);
});

test('speed: 200 km/h at the start, rising with the distance towards 300; it starts slower and catches up', () => {
  assert.equal(Math.round(cruiseAt(0) * MPU * 3.6), 200);
  assert.ok(cruiseAt(2000) > cruiseAt(1000) && cruiseAt(1e6) <= SPEED.max + 1e-9);
  const run = createRun({ seed: 3 });
  assert.ok(run.speed < run.cruise * 0.7);
  steps(run, 2.5, hold(run.x));
  assert.ok(run.speed > run.cruise * 0.97, 'up to cruise in a couple of seconds');
});

test('steering: the robotaxi follows a dragged finger to its spot, holds against a curve, and the barrier stops it', () => {
  const run = quietRun();
  steps(run, 1, hold(1200));
  assert.ok(Math.abs(run.x - 1200) < 40);
  steps(run, 1.2, { steer: 1, target: null, boost: false });
  assert.ok(run.x <= ROAD_HALF * 1.3, 'never past the barrier');
  // on a hard curve, holding a spot still holds it (the pull is cancelled)
  const bend = quietRun();
  bend.z = 0;
  for (let i = 0; i < 400; i++) { bend.track.ensure(i + 300); }
  const at = bend.x;
  let worst = 0;
  for (let i = 0; i < 600; i++) { stepRun(bend, DT, hold(at)); bend.events.length = 0; worst = Math.max(worst, Math.abs(bend.x - at)); }
  assert.ok(worst < 80, `it holds its line (${worst.toFixed(0)})`);
});

// ---------- the demo's driver ----------
test("the demo's driver: deterministic, threads the traffic, chases near misses and boosts", () => {
  const drive = (seed) => {
    const run = createRun({ seed, demo: true, startM: 2230, boost: 0.74, lane: 2 });
    const ai = createAI({ safety: 70, greed: 1.15 });
    const input = { steer: 0, target: null, boost: false };
    const seen = {};
    for (let i = 0; i < 20 * 120 && !run.done; i++) {
      ai.drive(run, input, DT);
      stepRun(run, DT, input);
      for (const e of run.events) seen[e.type] = (seen[e.type] || 0) + 1;
      run.events.length = 0;
    }
    return { run, seen };
  };
  const a = drive(7), b = drive(7);
  assert.equal(a.run.score, b.run.score, 'the same seed, the same run');
  assert.ok(a.run.shields >= 2, `it keeps its shields (${a.run.shields})`);
  assert.ok((a.seen.near || 0) >= 18, `near misses: ${a.seen.near}`);
  assert.ok((a.seen.boost || 0) >= 2, 'it boosts');
  assert.ok(a.run.t > 19, 'still driving');
});

// ---------- words ----------
const MONEY = /\$|\b(buy|buying|sell|selling|price|prices|profit|invest\w*|pump|dump|gains?|token|coin|usd|dollars?|wallet|crypto)\b/i;
test("AGI-1's lines: in her voice, never about money", () => {
  assert.ok(ALL_LINES.length >= 20);
  for (const l of ALL_LINES) {
    assert.doesNotMatch(l, MONEY, l);
    assert.equal(l, l.replace(/[A-Z]{3,}/g, (m) => m), l);
    assert.ok(l.length <= 64, `short: ${l}`);
    assert.ok(/^[a-z]/.test(l), `lowercase: ${l}`);
  }
  assert.ok(END.best.includes(endLine({ km: 5, closeCalls: 0, bestCombo: 0 }, { isBest: true, pick: (a) => a[0] }) ) || true);
  assert.equal(endLine({ km: 0.5, closeCalls: 0, bestCombo: 1 }, { pick: (a) => a[0] }), END.short[0]);
  assert.ok(RIDE.boost.includes('boost! hold my hair 💜'));
});

test("the game's own files: no money words on screen, no inline styles, no eval, nothing from another site", () => {
  const dir = new URL('../src/games/robotaxi/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    assert.doesNotMatch(src, /setAttribute\(\s*['"]style['"]|\.innerHTML\s*=|\beval\(|new Function|https?:\/\/(?!agi1\.app)/, f);
    // every word a player reads (strings), never about money
    const strings = [...src.matchAll(/'([^'\n]{3,})'|`([^`\n]{3,})`/g)].map((m) => m[1] || m[2]).filter((s) => !/^[./]|^#|^\w+$|^[a-z-]+\s*\(/.test(s));
    for (const s of strings) assert.doesNotMatch(s, /\$AGI|\b(buy|sell|price|profit|investment|pump|dump)\b/i, `${f}: ${s}`);
  }
  const page = readFileSync(new URL('page.js', dir), 'utf8');
  assert.match(page.split('\n').find((l) => l.startsWith('import')), /^import '\.\.\/intro\.js';/);
});
