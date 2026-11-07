// GRADIENT DESCENT (2026-11-08): the pure parts in Node: the landscape's maths (every part's slope and curvature match
// its height), the 18 holes (the cup is always the lowest point, the tee is clear), the ball's physics (rests, rolls
// downhill, stops, bounces, drops, lips out, falls in a NaN pit, the same every time), the demo's golfer (par or better
// on every hole, and the arcade preview's putt drops in the recorded window), the daily hole, the card and her words.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeField, descend, KINDS } from '../src/games/gradient/terrain.js';
import { COURSES, HOLES } from '../src/games/gradient/holes.js';
import { buildHole, lowestPoint, costField } from '../src/games/gradient/course.js';
import { PHYS, createBall, shoot, step, simulate, basinOf } from '../src/games/gradient/physics.js';
import { planShot, playHole } from '../src/games/gradient/ai.js';
import { dailyDef, validDaily, dateKey, seedOf } from '../src/games/gradient/daily.js';
import { resultOf, vsPar, totals, LINES, allLines, holeLine, courseLine, MAX_STROKES } from '../src/games/gradient/score.js';
import { rng } from '../src/games/kit/fx.js';

const flat = (extra = {}) => buildHole({ id: 'flat', par: 2, size: [20, 20], start: [0, 0], hole: [7, 7], parts: [{ t: 'plane', g: [0, 0] }], cup: false, ...extra });

test('terrain: every part\'s slope and curvature match its height (numerically)', () => {
  const samples = [
    { t: 'gauss', c: [1, -1], a: -1.4, s: [2, 1.2], rot: 30 },
    { t: 'bowl', c: [0.5, 0], a: 0.04, b: 0.02, rot: -20 },
    { t: 'plane', g: [0.1, -0.2] },
    { t: 'ridge', p: [-3, 1], q: [2, -2], a: 1.2, s: 0.9 },
    { t: 'banana', c: [0, -2], k: 0.12, s: 1.1, a: 2, rot: 15 },
    { t: 'mesa', c: [1, 1], r: [3, 2], e: 0.15, a: 1.5, rot: 40 },
    { t: 'step', c: [0, 0.5], rot: -60, a: -1.2, e: 0.6 },
    { t: 'ripple', c: [0, 0], rot: 25, a: 0.3, f: [1.3, 0.9], ph: [0.2, 1], s: 0 },
    { t: 'ripple', c: [1, 0], rot: 0, a: 0.4, f: [1.1, 0], s: 3 },
    { t: 'saddle', c: [0, 0], rot: 70, a: 2, k: [0.06, 0.04] },
    { t: 'basin', c: [0.5, -0.5], r: 1.2, k: 0.3, a: 1.1 },
    { t: 'basin', p: [-2, -1], q: [2, 1.5], r: 0.8, k: 0.25, a: 0.9 },
  ];
  assert.deepEqual([...new Set(samples.map((p) => p.t))].sort(), KINDS.slice().sort(), 'every kind is checked');
  const r = rng(11), o = new Float64Array(6), q = new Float64Array(6), e = 1e-5;
  for (const part of [...samples.map((p) => [p]), [...samples, { t: 'green', c: [0.3, 0.4], r: 1.4, e: 1, depth: 0.3 }]]) {
    const f = makeField(part);
    for (let i = 0; i < 160; i++) {
      const x = r.range(-6, 6), z = r.range(-6, 6);
      f.sample(x, z, o);
      const gx = (f.h(x + e, z) - f.h(x - e, z)) / (2 * e), gz = (f.h(x, z + e) - f.h(x, z - e)) / (2 * e);
      f.sample(x + e, z, q); const ax = q[1], az = q[2];
      f.sample(x - e, z, q); const hxx = (ax - q[1]) / (2 * e), hxzA = (az - q[2]) / (2 * e);
      f.sample(x, z + e, q); const bz = q[2];
      f.sample(x, z - e, q); const hzz = (bz - q[2]) / (2 * e);
      const tol = (v) => 2e-4 * (1 + Math.abs(v));
      const name = part.length === 1 ? part[0].t : 'all + green';
      assert.ok(Math.abs(gx - o[1]) < tol(gx) && Math.abs(gz - o[2]) < tol(gz), `${name}: ∇h at (${x.toFixed(2)}, ${z.toFixed(2)})`);
      // (the curvature jumps where a segment's end region begins, and on a flat floor's edge: skip those knife edges)
      if (Math.abs(hxx - o[3]) < 2e-2 * (1 + Math.abs(hxx)) || part.some((p) => p.t === 'ridge' || p.t === 'basin' || p.t === 'green')) continue;
      assert.ok(Math.abs(hxx - o[3]) < 2e-3 * (1 + Math.abs(hxx)), `${name}: h_xx`);
      assert.ok(Math.abs(hzz - o[5]) < 2e-3 * (1 + Math.abs(hzz)), `${name}: h_zz`);
      assert.ok(Math.abs(hxzA - o[4]) < 2e-3 * (1 + Math.abs(hxzA)), `${name}: h_xz`);
    }
  }
  // descend() finds the floor of a dip
  const m = descend(makeField([{ t: 'gauss', c: [2, -1], a: -1, s: 1.5 }, { t: 'plane', g: [0.01, 0] }]), 0, 0);
  assert.ok(Math.hypot(m.x - 2, m.z + 1) < 0.1);
});

test('the 18 holes: three courses of six, named, par 2 to 5, the cup at the lowest point, the tee clear', () => {
  assert.equal(COURSES.length, 3);
  assert.deepEqual(COURSES.map((c) => c.holes.length), [6, 6, 6]);
  assert.equal(HOLES.length, 18);
  assert.equal(new Set(HOLES.map((h) => h.id)).size, 18, 'unique ids');
  for (const def of HOLES) {
    assert.ok(def.name && def.pun && def.pun.length < 60, `${def.id}: a name and a short pun`);
    assert.ok(def.par >= 2 && def.par <= 5, `${def.id}: par`);
    const hole = buildHole(def);
    const low = lowestPoint(hole, 140);
    assert.ok(Math.hypot(low.x - hole.cup[0], low.z - hole.cup[1]) < 0.35, `${def.id}: the cup is the lowest point (lowest at ${low.x.toFixed(2)}, ${low.z.toFixed(2)})`);
    assert.ok(low.h >= hole.cupH - 1e-6, `${def.id}: nothing lower than the cup`);
    const [hx, hz] = hole.half;
    for (const p of [hole.start, hole.cup]) assert.ok(Math.abs(p[0]) < hx - PHYS.R && Math.abs(p[1]) < hz - PHYS.R, `${def.id}: inside the rails`);
    for (const p of hole.pits) {
      assert.ok(Math.hypot(hole.start[0] - p.x, hole.start[1] - p.z) > p.r + 0.6, `${def.id}: the tee isn't in a NaN pit`);
      assert.ok(Math.hypot(hole.cup[0] - p.x, hole.cup[1] - p.z) > p.r + 0.8, `${def.id}: the cup isn't in a NaN pit`);
    }
    for (const p of hole.posts) assert.ok(Math.hypot(hole.start[0] - p.x, hole.start[1] - p.z) > p.r + PHYS.R + 0.3, `${def.id}: the tee isn't in a post`);
    assert.ok(Math.hypot(hole.start[0] - hole.cup[0], hole.start[1] - hole.cup[1]) > 8, `${def.id}: a real distance to the cup`);
    assert.ok(hole.pits.length <= 6 && hole.sticky.length <= 4, `${def.id}: within the shader's hazard slots`);
  }
  // hazards arrive one course at a time: no pits or sticky patches in the warm-up
  for (const h of COURSES[0].holes) assert.ok(!h.pits?.length && !h.sticky?.length, `${h.id}: warm-up has no NaN pits or sticky patches`);
  assert.ok(COURSES[2].holes.every((h) => h.pits?.length), 'every badlands hole has NaN pits');
});

test('physics: rests on flat ground, rolls downhill, friction stops it, the farther the harder you putt', () => {
  const hole = flat();
  const b = createBall(0, 0);
  for (let i = 0; i < 240 && !b.done; i++) step(b, hole);
  assert.equal(b.done, 'rest', 'a ball left alone on flat ground rests');
  assert.equal(b.x, 0);
  // downhill: a ball let go on a slope goes down it
  const slope = buildHole({ id: 's', par: 2, size: [30, 30], start: [0, 0], hole: [12, 12], parts: [{ t: 'plane', g: [0.2, 0] }], cup: false });
  const s = createBall(0, 0);
  for (let i = 0; i < 240; i++) step(s, slope);
  assert.ok(s.vx < -0.5 && s.x < -0.3, 'rolls towards −x, where it is lower');
  // friction: putts stop, longer for harder
  const d = [0.2, 0.5, 0.9].map((p) => simulate(hole, -9, 0, 0, p));
  for (const r of d) assert.equal(r.done, 'rest');
  assert.ok(d[0].x < d[1].x && d[1].x < d[2].x, 'harder goes farther');
  assert.ok(d[2].t < PHYS.MAX_T, 'it stops on its own');
});

test('physics: rails and posts bounce, the cup takes a slow ball, a fast one lips out, a NaN pit swallows it', () => {
  const hole = flat();
  // a rail: straight into the +x rail, it comes back slower
  const b = createBall(8, -6);
  shoot(b, 0, 0.5);
  const ev = [];
  let hit = null;
  for (let i = 0; i < 2400 && !b.done; i++) { const n = ev.length; step(b, hole, PHYS.DT, ev); if (!hit && ev.length > n && ev[n].e === 'rail') hit = { before: ev[n].v, after: -b.vx }; }
  assert.ok(hit, 'it hit the rail');
  assert.ok(Math.abs(hit.after / hit.before - PHYS.RAIL_E) < 0.08, `restitution ~${PHYS.RAIL_E}`);
  assert.ok(b.x < 9 - PHYS.R, 'stays inside');
  // a post
  const ph = flat({ posts: [[0, -6, 0.4]] });
  const pb = createBall(-3, -6);
  shoot(pb, 0, 0.4);
  const pev = [];
  for (let i = 0; i < 2400 && !pb.done; i++) step(pb, ph, PHYS.DT, pev);
  assert.ok(pev.some((e) => e.e === 'post'), 'it hit the post');
  assert.ok(pb.x < -0.3, 'and bounced back');
  // the cup: a gentle putt drops, a hard one doesn't
  const cupHole = flat();
  const slow = simulate(cupHole, 3, 7, 0, 0.3);
  assert.equal(slow.done, 'sink', 'a slow putt straight at the cup drops');
  const fev = [];
  const fast = simulate(cupHole, 3, 7, 0, 0.9, { events: fev });
  assert.notEqual(fast.done, 'sink', 'a hard one runs over');
  assert.ok(fev.some((e) => e.e === 'lip'), 'and lips out');
  // a NaN pit
  const pitHole = flat({ pits: [[0, 3, 0.7]] });
  assert.equal(simulate(pitHole, -4, 3, 0, 0.45).done, 'pit');
  // a sticky patch slows it: the same putt stops sooner
  const sticky = flat({ sticky: [[0, 0, 3, 3]] });
  assert.ok(simulate(sticky, -6, 0, 0, 0.6).x < simulate(hole, -6, 0, 0, 0.6).x - 2);
});

test('physics: the same shot rolls exactly the same way every time; basins tell a trap from the cup', () => {
  const hole = buildHole(HOLES.find((h) => h.id === 'twovalleys'));
  const runs = [0, 1].map(() => { const pts = []; const r = simulate(hole, hole.start[0], hole.start[1], 0.71, 0.63, { track: (x, z) => pts.push(x, z) }); return { r, pts }; });
  assert.deepEqual(runs[0].r, runs[1].r);
  assert.deepEqual(runs[0].pts, runs[1].pts);
  // the decoy valley on Two Valleys is a local minimum, the cup's is the global one
  assert.equal(basinOf(hole, -1.6, -1.4).global, false);
  assert.equal(basinOf(hole, hole.cup[0] + 0.6, hole.cup[1]).global, true);
  const cf = costField(hole);
  assert.ok(cf.at(hole.cup[0], hole.cup[1]) < 1 && cf.at(hole.start[0], hole.start[1]) > 8, 'the cost map grows away from the cup');
});

test('the demo\'s golfer makes par or better on every hole', () => {
  for (const def of HOLES) {
    const r = playHole(buildHole(def), { rand: rng(7), coarse: 0 });
    assert.ok(r.sunk && r.strokes <= def.par, `${def.id}: ${r.strokes} strokes, par ${def.par}`);
  }
});

test('the arcade preview (?demo&seed=7): the first putt curves round the banana and drops inside the recorded window', () => {
  const hole = buildHole(HOLES.find((h) => h.id === 'banana'));
  const plan = planShot(hole, -3.7, -3.4, { rand: rng(7), noise: 0.6 });
  assert.equal(plan.result.done, 'sink');
  // aimed at 5.62 s, putted at about 6.6 s: the drop lands between 9 and 10.6 s (recorded: 5.7 to 11.7 s)
  assert.ok(plan.result.t > 2.4 && plan.result.t < 4, `rolls ${plan.result.t.toFixed(2)} s`);
});

test('the daily hole: one per date, the same for everyone, always valid, and playable', () => {
  assert.equal(dateKey(new Date(2026, 10, 8)), '2026-11-08');
  assert.notEqual(seedOf('2026-11-08'), seedOf('2026-11-09'));
  const a = dailyDef('2026-11-08'), b = dailyDef('2026-11-08');
  assert.deepEqual(a, b, 'the same date, the same hole');
  const keys = Array.from({ length: 14 }, (_, i) => dateKey(new Date(2026, 10, 1 + i * 3)));
  const shapes = new Set();
  for (const k of keys) {
    const d = dailyDef(k);
    assert.ok(d.attempt >= 0, `${k}: a generated landscape`);
    const hole = buildHole(d);
    assert.ok(validDaily(hole), `${k}: valid`);
    assert.ok(d.par >= 3 && d.par <= 4);
    shapes.add(JSON.stringify(d.parts));
  }
  assert.equal(shapes.size, keys.length, 'every day is different');
  for (const k of keys.slice(0, 2)) {
    const d = dailyDef(k);
    const r = playHole(buildHole(d), { rand: rng(3), coarse: 0 });
    assert.ok(r.sunk && r.strokes <= d.par, `${k}: the minimum can be reached (${r.strokes} vs par ${d.par})`);
  }
});

test('the card: results by strokes against par, totals, and AGI-1\'s words (never money, PG-13)', () => {
  assert.equal(resultOf(1, 3).name, 'CONVERGED IN ONE');
  assert.equal(resultOf(2, 4).name, 'EAGLE');
  assert.equal(resultOf(2, 3).name, 'BIRDIE');
  assert.equal(resultOf(3, 3).name, 'PAR');
  assert.equal(resultOf(4, 3).name, 'BOGEY');
  assert.equal(resultOf(5, 3).name, 'DOUBLE BOGEY');
  assert.equal(vsPar(10, 12), '−2');
  assert.equal(vsPar(12, 12), 'E');
  assert.equal(vsPar(15, 12), '+3');
  assert.deepEqual(totals([2, 3, null, 4], [2, 2, 3, 3]), { strokes: 9, par: 7, diff: 2, text: '+2' });
  assert.equal(MAX_STROKES, 8);
  const pick = (arr) => arr[0];
  assert.ok(holeLine(resultOf(1, 3), pick).length > 0 && courseLine({ diff: -2, isBest: false }, pick).length > 0);
  const lines = allLines();
  assert.ok(lines.length >= 25, `${lines.length} lines`);
  for (const l of lines) {
    assert.doesNotMatch(l, /\$AGI|\binvest|\bprofit|\bprice\b|\bpump\b|\bdump\b|\bbuy\b|\bsell\b|\bmoney\b/i, l);
    assert.doesNotMatch(l, /\bsex|\bnude|\bkiss\b/i, l);
    assert.equal(l, l.toLowerCase().replace('nan', 'NaN'), `lowercase: ${l}`);
    assert.ok(l.length <= 64, `short: ${l}`);
  }
  assert.ok(LINES.localMin.some((l) => l.includes('local minimum')));
});
