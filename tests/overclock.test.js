// OVERCLOCK (2026-11-08): neon pinball on AGI-1's motherboard. Its pure parts in Node: the physics (bounces, no
// tunnelling at any speed, flippers that cradle and pass on their swing, pop bumpers, the ramp's speed), the rules
// (R-A-M and the bonus multiplier, G-P-U, locks and multiball, the growing jackpot, ball save, tilt, the extra ball,
// missions and AGI MODE, the end-of-ball bonus), the plunger's skill shot, a whole game played twice with one seed,
// the dot-matrix display and AGI-1's words.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { seg, circle, arc, createWorld, stepWorld, makeBall, probe, probeFlipper, flipper, BALL_R, MAX_V } from '../src/games/overclock/physics.js';
import { buildTable, FLIPPERS, PLUNGER, DRAIN_Y, RAMP_LINE, RAMP_MIN_V, W, H } from '../src/games/overclock/table.js';
import * as rules from '../src/games/overclock/rules.js';
import { createSim, stepSim, launchSpeed, SKILL_BANDS, DT, inPlay } from '../src/games/overclock/sim.js';
import { createAI, think } from '../src/games/overclock/ai.js';
import * as D from '../src/games/overclock/dmd.js';
import { LINES, endLine } from '../src/games/overclock/lines.js';
import { rng } from '../src/games/kit/fx.js';

const tick = (world, balls, n = 1, on) => { for (let i = 0; i < n; i++) stepWorld(world, balls, DT, on); };
const speed = (b) => Math.hypot(b.vx, b.vy);
const tmp = { nx: 0, ny: 0 };

test('a wall: the ball bounces at the mirrored angle, losing some of its speed into the wall', () => {
  const w = createWorld({ colliders: [seg(0, 500, 1000, 500, { e: 0.5, f: 0 })] });
  const b = makeBall(400, 400, 600, 600);
  tick(w, [b], 30, undefined);
  // gravity is on: compare with the same ball's mirror image on its way back up
  const w2 = createWorld({ colliders: [seg(0, 500, 1000, 500, { e: 0.5, f: 0 })] });
  const c = makeBall(400, 400, 600, 600);
  let hit = null;
  stepWorld(w2, [c], DT, { contact: (_, __, s) => { hit = s; } });
  for (let i = 0; i < 40 && hit == null; i++) stepWorld(w2, [c], DT, { contact: (_, __, s) => { hit = s; } });
  assert.ok(hit > 500, `it hit the wall (${hit})`);
  assert.ok(c.vy < 0, 'it comes back up');
  assert.ok(Math.abs(c.vx - 600) < 600 * 0.02, 'no friction: the speed along the wall is kept (only a little air drag)');
  assert.ok(Math.abs(-c.vy / hit - 0.5) < 0.08, `the speed into the wall comes back × its restitution (${(-c.vy / hit).toFixed(2)})`);
  assert.ok(b.y < 500 - BALL_R + 0.5, 'and it never ends up in the wall');
});

test('no tunnelling: balls fired at the top speed at every wall, post, bumper and flipper never go through', () => {
  const T = buildTable(3);
  const r = rng(11);
  const solids = [...T.world.colliders.filter((c) => c.tag !== 'gate'), ...T.world.flippers];
  let shots = 0, worst = 0;
  for (const target of solids) {
    for (let k = 0; k < 16; k++) {
      // a point on (or by) it, and a ball coming at it from a random side
      let tx, ty;
      if (target.k === 0) { const u = r.next(); tx = target.ax + target.dx * u; ty = target.ay + target.dy * u; }
      else if (target.k === 1) { tx = target.x; ty = target.y; }
      else if (target.k === 2) { const a = target.a0 + r.next() * target.span; tx = target.x + Math.cos(a) * target.R; ty = target.y + Math.sin(a) * target.R; }
      else { tx = target.x + Math.cos(target.angle) * target.len * r.next(); ty = target.y + Math.sin(target.angle) * target.len * r.next(); }
      const a = r.range(0, Math.PI * 2);
      const b = makeBall(tx - Math.cos(a) * 120, ty - Math.sin(a) * 120, Math.cos(a) * MAX_V, Math.sin(a) * MAX_V);
      // only from open table: never start inside something
      let blocked = false;
      for (const c of T.world.colliders) if (c.on && probe(c, b.x, b.y, tmp) < BALL_R + 1) blocked = true;
      for (const f of T.world.flippers) if (probeFlipper(f, b.x, b.y, tmp) < BALL_R + 1) blocked = true;
      const inArch = b.y > 300 || Math.hypot(b.x - 306, b.y - 300) < 288 - BALL_R - 2;
      if (blocked || !inArch || b.x < 18 + BALL_R || b.x > 594 - BALL_R || b.y > H) continue;
      for (const f of T.world.flippers) f.held = r.chance(0.5);
      shots++;
      for (let i = 0; i < 30; i++) {
        stepWorld(T.world, [b], DT);
        let deep = 0;
        for (const c of solids) { const d = c.k == null ? probeFlipper(c, b.x, b.y, tmp) : probe(c, b.x, b.y, tmp); deep = Math.max(deep, BALL_R - d); }
        worst = Math.max(worst, deep);
        assert.ok(b.x > 14 && b.x < W, `still inside the cabinet (${b.x.toFixed(0)}, ${b.y.toFixed(0)})`);
        if (b.y > DRAIN_Y) break;
      }
    }
  }
  assert.ok(shots > 250, `${shots} shots`);
  assert.ok(worst < BALL_R * 0.5, `never more than a little into anything after a tick (deepest ${worst.toFixed(2)})`);
});

test('flippers: a held flipper cradles the ball; a flip sends it up faster the further out it sits', () => {
  // cradle: a ball rolling down the left inlane onto a held flipper comes to rest by its base
  const T = buildTable(1);
  T.flippers.L.held = true;
  const b = makeBall(84, 800, 0, 200);
  tick(T.world, [b], 240);
  assert.ok(speed(b) < 15, `at rest (${speed(b).toFixed(1)})`);
  assert.equal(b.onFlipper, T.flippers.L, 'on the flipper');
  assert.ok(b.y < 990, 'not drained');
  // the flip: a ball sitting on the flipper's top at u (from the pivot) leaves faster the further out it sits (up to its
  // sweet spot), and further across the table (the aim)
  const shot = (u) => {
    const w = createWorld({ flippers: [flipper(FLIPPERS.L)] });
    const f = w.flippers[0];
    const ca = Math.cos(f.angle), sa = Math.sin(f.angle);
    const off = BALL_R + f.r1 + (f.r2 - f.r1) * (u / f.len) + 0.5;
    const ball = makeBall(f.x + ca * u + sa * off, f.y + sa * u - ca * off, 0, 0);
    f.held = true;
    let best = 0, ang = 0;
    for (let i = 0; i < 30; i++) { stepWorld(w, [ball], DT, undefined, 0); const v = speed(ball); if (v > best) { best = v; ang = Math.atan2(-ball.vy, ball.vx); } }
    return { v: best, deg: (ang * 180) / Math.PI };
  };
  const a = shot(20), b2 = shot(35), c = shot(50), tip = shot(78);
  assert.ok(a.v < b2.v && b2.v < c.v, `${a.v.toFixed(0)} < ${b2.v.toFixed(0)} < ${c.v.toFixed(0)}`);
  assert.ok(c.v / a.v > 1.4, 'the speed follows the swing (ω × r)');
  assert.ok(tip.v > 1600, `a flip near the tip is a real shot (${tip.v.toFixed(0)} u/s)`);
  assert.ok(a.deg - tip.deg > 12, `and later on the flipper aims further across (${a.deg.toFixed(0)}° → ${tip.deg.toFixed(0)}°)`);
});

test('a pop bumper kicks a slow ball away hard; a slingshot kicks too', () => {
  const w = createWorld({ colliders: [circle(300, 300, 27, { kick: 1060, kickVar: 0, tag: 'pop' })], rng: rng(1).next });
  const b = makeBall(300, 300 - 27 - BALL_R + 1, 0, 30);
  let fired = 0;
  stepWorld(w, [b], DT, { contact: (_, __, ___, f) => { if (f) fired++; } }, 0);
  assert.equal(fired, 1);
  assert.ok(speed(b) > 1000, `kicked (${speed(b).toFixed(0)})`);
  assert.ok(b.vy < -900, 'away from the bumper');
  const T = buildTable(2);
  const sl = T.slings[0];
  const n = { x: -sl.nx, y: -sl.ny };   // the face looks into the playfield
  const mx = (sl.ax + sl.bx) / 2, my = (sl.ay + sl.by) / 2;
  const c = makeBall(mx + n.x * 40, my + n.y * 40, -n.x * 500, -n.y * 500);
  let kicked = false;
  tick(T.world, [c], 10, { contact: (cc, __, ___, f) => { if (cc.tag === 'sling' && f) kicked = true; } });
  assert.ok(kicked, 'the slingshot fired');
  assert.ok((c.vx * n.x + c.vy * n.y) > 450, 'and sent the ball back out');
});

test('the ramp: only a ball going up its mouth fast enough rides it; it comes back down to the right inlane', () => {
  const run = (v) => {
    const S = createSim({ seed: 5 });
    S.balls.length = 0;
    const b = makeBall((RAMP_LINE[0][0] + RAMP_LINE[1][0]) / 2, RAMP_LINE[0][1] + 30, 0, -v);
    b.mode = 'play'; b.id = 99;
    S.balls.push(b);
    S.plunger.ready = false;
    const seen = [];
    let out = null;
    for (let i = 0; i < 120 * 3; i++) { stepSim(S, DT); for (const e of S.ev) { seen.push(e.type); if (e.type === 'rampOut') out = e; } S.ev.length = 0; }
    return { seen, out };
  };
  const fast = run(RAMP_MIN_V + 500);
  assert.ok(fast.seen.includes('rampIn') && fast.seen.includes('ramp') && fast.seen.includes('rampOut'), fast.seen.join(','));
  assert.ok(fast.out.x > 450 && fast.out.y > 700, 'it comes back down on the right, into the inlane');
  const slow = run(RAMP_MIN_V - 250);
  assert.ok(!slow.seen.includes('rampIn'), 'too slow: it rolls back');
  assert.ok(slow.seen.includes('rampFail'));
});

test('R-A-M: lanes light, the flipper buttons move them, all three raise the bonus multiplier and reset', () => {
  const R = rules.createRules(1);
  rules.hit(R, 'lane', 0);
  assert.deepEqual(R.ram, [true, false, false]);
  rules.flipperPress(R, 'R');
  assert.deepEqual(R.ram, [false, true, false], 'the right button moves them right');
  rules.flipperPress(R, 'L');
  assert.deepEqual(R.ram, [true, false, false], 'the left one back');
  rules.hit(R, 'lane', 1); rules.hit(R, 'lane', 2);
  assert.deepEqual(R.ram, [false, false, false], 'all three: reset');
  assert.equal(R.bonusX, 2);
  for (let k = 0; k < 10; k++) for (let i = 0; i < 3; i++) rules.hit(R, 'lane', i);
  assert.equal(R.bonusX, rules.BONUS_X_MAX, 'capped');
  // the skill shot's lane moves with the buttons while the ball waits, and pays when the plunge lands there
  const S = rules.createRules(2);
  const lane0 = S.skillLane;
  rules.flipperPress(S, 'R', true);
  assert.equal(S.skillLane, (lane0 + 1) % 3);
  rules.armSkill(S);
  rules.hit(S, 'lane', S.skillLane);
  assert.ok(S.fx.some((e) => e.type === 'skill'));
  const before = S.score;
  rules.armSkill(S);
  rules.hit(S, 'pop', 0);
  rules.hit(S, 'lane', S.skillLane);
  assert.ok(S.score - before < rules.POINTS.skill, 'anything else first: no skill shot');
});

test('G-P-U lights the lock; two locks start MULTIBALL; the ramp then scores a jackpot that grows', () => {
  const R = rules.createRules(3);
  for (let i = 0; i < 3; i++) rules.hit(R, 'target', i);
  assert.equal(R.lockLit, true);
  assert.ok(R.gpuReset > 0, 'the bank will come back up');
  assert.equal(rules.gpuDue(R, 2), true);
  rules.gpuUp(R);
  assert.deepEqual(R.gpu, [false, false, false]);
  assert.equal(rules.socket(R), 'lock');
  assert.equal(R.locked, 1);
  assert.equal(R.lockLit, false);
  assert.equal(rules.socket(R), 'kick', 'unlit: just points');
  for (let i = 0; i < 3; i++) rules.hit(R, 'target', i);
  assert.equal(rules.socket(R), 'multiball');
  assert.equal(R.multiball, true);
  assert.ok(R.ballSave >= rules.MB_SAVE, 'a ball save as it starts');
  const j0 = R.jackpot;
  rules.hit(R, 'ramp');
  const jp = R.fx.filter((e) => e.type === 'jackpot');
  assert.equal(jp.length, 1);
  assert.equal(jp[0].pts, j0);
  assert.equal(R.jackpot, j0 + rules.JACKPOT_STEP, 'the next one is worth more');
  rules.hit(R, 'pop', 1);
  assert.equal(R.jackpot, j0 + rules.JACKPOT_STEP + rules.JACKPOT_POP, 'and every core hit adds to it');
  assert.equal(rules.drain(R, 2), 'saved', 'during the save every ball comes back');
  R.ballSave = 0;
  assert.equal(rules.drain(R, 2), 'gone');
  assert.equal(R.multiball, true);
  assert.equal(rules.drain(R, 1), 'gone');
  assert.equal(R.multiball, false, 'one ball left: multiball is over');
});

test('ball save: 8 s from the gate, once a ball; tilt: three quick nudges, no points, no bonus', () => {
  const R = rules.createRules(4);
  rules.launched(R);
  assert.equal(R.ballSave, rules.BALL_SAVE);
  rules.tick(R, 5);
  assert.ok(Math.abs(R.ballSave - 3) < 1e-9);
  assert.equal(rules.drain(R, 0), 'saved');
  rules.launched(R);
  assert.ok(R.ballSave < 3.01, 'no fresh save for the same ball');
  rules.tick(R, 4);
  assert.equal(rules.drain(R, 0), 'gone');
  const T = rules.createRules(5);
  rules.hit(T, 'ramp');
  assert.equal(rules.nudge(T), 'ok');
  rules.tick(T, 3);
  assert.equal(rules.nudge(T), 'ok', 'nudges far apart are fine');
  assert.equal(rules.nudge(T), 'danger');
  assert.equal(rules.nudge(T), 'tilt');
  const s = T.score;
  rules.hit(T, 'ramp');
  assert.equal(T.score, s, 'tilted: nothing scores');
  const end = rules.endBall(T);
  assert.equal(end.total, 0, 'and the bonus is lost');
  assert.equal(T.tilted, false, 'the next ball is clean');
});

test('the extra ball comes once, at its score; the end-of-ball bonus counts what this ball did × the multiplier', () => {
  const R = rules.createRules(6);
  rules.addPoints(R, rules.EXTRA_AT);
  rules.addPoints(R, rules.EXTRA_AT);
  assert.equal(R.fx.filter((e) => e.type === 'extraBall').length, 1);
  assert.equal(rules.endBall(R).next, 'again', 'shoot again: the same ball');
  assert.equal(R.ball, 1);
  const B = rules.createRules(7);
  rules.hit(B, 'ramp'); rules.hit(B, 'ramp'); rules.hit(B, 'lane', 0);
  for (let i = 0; i < 3; i++) rules.hit(B, 'lane', i);
  const b = rules.bonusLines(B);
  const ramps = b.lines.find((l) => l.label === 'RAMPS');
  assert.equal(ramps.n, 2);
  assert.equal(b.x, 2);
  assert.equal(b.total, b.lines.reduce((s, l) => s + l.pts, 0) * 2);
  const score = B.score;
  const end = rules.endBall(B);
  assert.equal(B.score, score + b.total);
  assert.equal(end.next, 'next');
  assert.equal(B.ball, 2);
  assert.equal(B.bonusX, 1, 'the multiplier starts over');
  B.ball = 3;
  assert.equal(rules.endBall(B).next, 'over');
});

test('missions run one at a time; four done light AGI MODE at the socket; OVERCLOCK at full heat', () => {
  const R = rules.createRules(8);
  assert.equal(R.mission.id, 'cores', 'the first one teaches the table');
  for (let k = 0; k < 5; k++) for (let i = 0; i < 3; i++) rules.hit(R, 'pop', i);
  assert.equal(R.missionsDone, 1);
  assert.equal(R.mission, null, 'a breath before the next');
  rules.tick(R, 3);
  assert.ok(R.mission && R.mission.id !== 'cores');
  // finish three more by their own switches
  const doMission = () => {
    const m = R.mission;
    for (let n = 0; n < 40 && R.mission === m; n++) {
      if (m.on === 'ramAll') for (let i = 0; i < 3; i++) rules.hit(R, 'lane', i);
      else if (m.on === 'gpuAll') { for (let i = 0; i < 3; i++) rules.hit(R, 'target', i); rules.gpuUp(R); }
      else if (m.on === 'socket') rules.socket(R);
      else rules.hit(R, m.on, 0);
    }
    rules.tick(R, 3);
  };
  doMission(); doMission(); doMission();
  assert.equal(R.missionsDone, 4);
  assert.equal(R.agiReady, true);
  R.lockLit = true;
  assert.equal(rules.socket(R), 'agi', 'AGI MODE first');
  assert.equal(R.agi, rules.AGI_S);
  const s = R.score;
  rules.hit(R, 'ramp');
  assert.ok(R.score - s >= rules.AGI_POINTS.ramp, 'every shot worth a fortune');
  rules.tick(R, rules.AGI_S + 1);
  assert.ok(R.fx.some((e) => e.type === 'agiEnd'));
  // heat: hits warm the board; full heat doubles the points for a while, then it cools down
  const H2 = rules.createRules(9);
  for (let i = 0; i < 200 && !H2.overclock; i++) rules.hit(H2, 'pop', i % 3);
  assert.ok(H2.overclock > 0);
  const before = H2.score;
  rules.hit(H2, 'orbit');
  assert.equal(H2.score - before, rules.POINTS.orbit * 2);
  rules.tick(H2, rules.OVERCLOCK_S + 0.1);
  assert.equal(H2.overclock, 0);
  assert.ok(H2.cool > 0, 'cooling down');
});

test('the plunger: more pull, more speed; each R-A-M band of the meter rolls the ball through its own lane', () => {
  for (let p = 0; p < 1; p += 0.01) assert.ok(launchSpeed(p + 0.01) >= launchSpeed(p), `monotonic at ${p.toFixed(2)}`);
  for (const band of SKILL_BANDS) {
    const T = buildTable(1);
    const b = makeBall(PLUNGER.x, PLUNGER.y, 0, -launchSpeed((band.p0 + band.p1) / 2));
    let first = null;
    for (let i = 0; i < 360 && first == null; i++) stepWorld(T.world, [b], DT, { sensor: (s) => { if (s.tag === 'lane' && first == null) first = s.ref; } });
    assert.equal(first, band.lane, `the middle of band ${band.lane}`);
  }
});

test('a whole game: the same seed plays the same game; it ends; the AI keeps balls alive and scores', () => {
  const play = (seed, secs) => {
    const S = createSim({ seed });
    const ai = createAI(seed);
    let maxBalls = 0;
    for (let i = 0; i < secs * 120 && !S.over; i++) { think(ai, S, DT); stepSim(S, DT); S.ev.length = 0; maxBalls = Math.max(maxBalls, inPlay(S)); }
    return { score: S.R.score, t: S.t, over: S.over, ball: S.R.ball, maxBalls };
  };
  const a = play(21, 40), b = play(21, 40), c = play(22, 40);
  assert.deepEqual(a, b, 'deterministic');
  assert.notDeepEqual(a, c, 'another seed, another game');
  assert.ok(a.score > 0);
  const full = play(23, 60 * 20);
  assert.equal(full.over, true, 'every game ends');
  assert.ok(full.t > 30, `and lasts a while with a good player (${full.t.toFixed(0)} s)`);
});

test('the display: every mission\'s name fits it, its words are its own, and AGI-1\'s lines never talk money', () => {
  for (const m of rules.MISSIONS) {
    assert.ok(D.textWidth(m.name, 'med') <= 98 || D.textWidth(m.name, 'small') <= 98, m.name);
    assert.ok(D.textWidth(`${m.short} ${m.goal}/${m.goal}`, 'small') <= 52, `${m.short}: its status line`);
    assert.ok(m.goal > 0);
  }
  const d = D.createDMD();
  for (const kind of ['jackpot', 'multiball', 'overclock', 'agi', 'drain', 'tilt', 'lock', 'lit', 'skill', 'save', 'extra', 'missionDone', 'agiEnd']) {
    D.reset(d);
    D.show(d, kind, { pts: 123456, n: 1, wizard: 2, mission: rules.MISSIONS[0], text: 'TILT' });
    for (let t = 0; t < 3; t += 0.25) { D.update(d, 0.25); D.draw(d, { score: 9876543, ball: 1, balls: 3, bonusX: 2, heat: 50, mission: rules.MISSIONS[1], progress: 3 }); }
    assert.ok(d.buf.some((v) => v > 0), `${kind} draws something`);
    assert.ok(d.buf.every((v) => v >= 0 && v <= 8), `${kind}: only its nine dot levels`);
  }
  const all = [...Object.values(LINES).flat(), ...[0, 300000, 1.2e6, 4e6, 9e6].map((s) => endLine(s, { rnd: () => 0.5 })), endLine(5, { best: true, rnd: () => 0.1 })];
  for (const l of all) {
    assert.doesNotMatch(l, /\$AGI|\binvest|\bprofit|\bprice\b|\bpump\b|\bdump\b|\bbuy\b|\bsell\b/i, l);
    assert.equal(l, l.replace(/[A-Z]{2,}/g, (m) => (['AGI', 'JACKPOT', 'MODE'].includes(m) ? m : m.toLowerCase())), `her voice is lowercase: ${l}`);
  }
  // the game's own files: no requests, nothing from elsewhere, no Math.random in the rules, the sim or the AI
  const dir = new URL('../src/games/overclock/', import.meta.url);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    const code = readFileSync(new URL(f, dir), 'utf8');
    if (['physics.js', 'table.js', 'rules.js', 'sim.js', 'ai.js', 'dmd.js'].includes(f)) assert.doesNotMatch(code, /Math\.random/, `${f} is seeded`);
    assert.doesNotMatch(code, /fetch\(|XMLHttpRequest|https?:\/\//, f);
  }
});
