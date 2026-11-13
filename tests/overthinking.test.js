// OVERTHINKING (2026-11-12), an arcade-kit game on agi1.app/games: the geometry of a ribbon, the field (the same crowd
// on any screen), the pen (lifting closes a loop that went most of the way round; crossing your own line closes at once
// and keeps the stroke), what a loop holds (one kind resolves, a mix scatters, cringes alone are let go, the wild
// ones), her train of thought and the flourish, the ribbon as a fence that fades, a cringe snapping it, her context
// and the four seconds over it, her clock (an hour every 35 s, sunrise at six), what turns up (bunches, events, a
// what-if splitting, her phone), an empty mind, the week's seven nights and the others, the game's own players, the
// same seed giving the same night, what's kept, her words, and its code. All in Node (no browser).
// Run: node --test tests/overthinking.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { segCross, pointInPoly, polyArea, polyCentroid, nearOnSeg, pathLength } from '../src/games/overthinking/geom.js';
import { KINDS, KIND_ORDER, SPECIALS, isKind, specOf } from '../src/games/overthinking/kinds.js';
import {
  createSim, step, drain, penDown, penMove, penUp, penCancel, preview, closable, judge, spawn, count, fill, resize, setOrigin,
  worldSize, maxRibbon, dice, TUNE, STEP,
} from '../src/games/overthinking/sim.js';
import {
  NIGHTS, nightOf, makeConfig, TWISTS, dateKey, dayBefore, dailySeed, dailyTwist, hashOf, clockAt, clockLabel, hourLabel, awakeLabel,
  starsFor, HOUR, NIGHT_HOURS, CAP, MAX_STARS,
} from '../src/games/overthinking/nights.js';
import { createBot, drive, targets, PROFILES } from '../src/games/overthinking/ai.js';
import { JOURNAL, JOURNAL_PAGES, JOURNAL_SIZE, journalLine, lineId, SAY, say, hourLine, endLine, shareText, sizeWord, TIPS } from '../src/games/overthinking/lines.js';
import { STICKERS, RIBBONS, ribbonOf, fresh, load, applyRun, totalStars, nextNight, nightOpen, ribbonOpen } from '../src/games/overthinking/progress.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const night = (n = 1) => makeConfig({ mode: 'night', night: n });

// a field with nothing in it and nothing arriving: a test puts its own thoughts there
function quiet({ cfg = night(1), seed = 1, aspect = 1, events = () => [] } = {}) {
  return createSim({ ...cfg, initial: [], at: (h) => ({ ...cfg.at(h), rate: 0, special: {} }), events }, seed, aspect);
}
const run = (S, seconds) => { for (let i = 0; i < Math.round(seconds / STEP) && !S.over; i++) step(S, STEP); };
// the pen goes round a circle: from `from` degrees, `sweep` degrees on, then lifts (or not)
function circle(S, cx, cy, r, { from = 0, sweep = 330, lift = true, down = true } = {}) {
  const at = (deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
  if (down) penDown(S, ...at(from));
  for (let d = 4; d <= sweep; d += 4) penMove(S, ...at(from + d));
  if (lift) penUp(S);
}
const events = (S, type) => drain(S).filter((e) => !type || e.type === type);
// one of the game's own players plays a whole run → the sim
function play(cfg, profile, seed, aspect = 0.62, seconds = 400) {
  const S = createSim(cfg, seed, aspect), bot = createBot(profile, seed);
  for (let i = 0; i < seconds / STEP && !S.over; i++) { drive(bot, S, STEP); step(S, STEP); drain(S); }
  return S;
}

// ---------- geometry ----------
test('geometry: where two strokes cross, what a loop holds, its area and its middle', () => {
  const c = segCross(0, 0, 4, 4, 0, 4, 4, 0);
  assert.ok(c && near(c.x, 2) && near(c.y, 2) && near(c.t, 0.5) && near(c.u, 0.5));
  assert.equal(segCross(0, 0, 1, 1, 2, 2, 3, 3), null, 'in line, apart');
  assert.equal(segCross(0, 0, 4, 0, 0, 1, 4, 1), null, 'side by side');
  assert.equal(segCross(0, 0, 1, 0, 2, -1, 2, 1), null, 'short of it');
  const sq = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }];
  assert.ok(pointInPoly(2, 2, sq) && !pointInPoly(5, 2, sq) && !pointInPoly(2, -0.1, sq));
  assert.ok(near(Math.abs(polyArea(sq)), 16));
  assert.ok(near(polyArea(sq), -polyArea([...sq].reverse())), 'signed: the other way round');
  const m = polyCentroid(sq);
  assert.ok(near(m.x, 2) && near(m.y, 2));
  // a C shape: its mouth isn't inside
  const cshape = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 3 }, { x: 4, y: 3 }, { x: 4, y: 4 }, { x: 0, y: 4 }];
  assert.ok(pointInPoly(0.5, 2, cshape) && !pointInPoly(3, 2, cshape));
  const n = nearOnSeg(2, 3, 0, 0, 4, 0);
  assert.ok(near(n.d2, 9) && near(n.x, 2) && near(n.t, 0.5));
  assert.ok(near(nearOnSeg(-2, 0, 0, 0, 4, 0).t, 0) && near(nearOnSeg(9, 0, 0, 0, 4, 0).t, 1), 'its ends');
  assert.ok(near(pathLength([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 5 }]), 6));
  const flat = polyCentroid([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 0 }]);
  assert.ok(near(flat.x, 2) && near(flat.y, 0), 'no area: the mean of its points');
});

// ---------- the field ----------
test('the field: the same area on a phone and a monitor, and a night starts with three small bunches', () => {
  for (const a of [0.5, 0.62, 1, 1.9, 2.3, 3]) { const { W, H } = worldSize(a); assert.ok(near(W * H, TUNE.area, 1e-6) && near(W / H, a, 1e-6)); }
  assert.ok(near(worldSize(0.2).W / worldSize(0.2).H, 0.5) && near(worldSize(9).W / worldSize(9).H, 3), 'a very tall or very wide screen: its shape is held');
  assert.ok(near(worldSize(NaN).W, worldSize(1).W));
  const S = createSim(night(1), 5, 0.62);
  assert.equal(S.thoughts.length, 9);
  const kinds = [...new Set(S.thoughts.map((t) => t.kind))];
  assert.deepEqual(kinds.sort(), ['heart', 'moon', 'star']);
  for (const t of S.thoughts) assert.ok(t.tx > 1 && t.tx < S.W - 1 && t.ty > 1 && t.ty < S.H - 1, 'inside');
  assert.equal(count(S), 9);
  assert.ok(near(fill(S), 9 / CAP));
  assert.ok(near(maxRibbon(S), TUNE.lenK * Math.min(S.W, S.H)));
  // the same seed, the same start; another seed, another
  const same = createSim(night(1), 5, 0.62), other = createSim(night(1), 6, 0.62);
  assert.deepEqual(same.thoughts.map((t) => [t.kind, t.tx, t.ty]), S.thoughts.map((t) => [t.kind, t.tx, t.ty]));
  assert.notDeepEqual(other.thoughts.map((t) => [t.tx, t.ty]), S.thoughts.map((t) => [t.tx, t.ty]));
  const d = dice(7), e = dice(7);
  assert.deepEqual([d(), d(), d()], [e(), e(), e()]);
});

// ---------- the pen ----------
test('a loop round thoughts of one kind resolves them: 10 × n × n, and they leave her mind', () => {
  const S = quiet();
  for (const [x, y] of [[9, 10], [11, 10], [10, 11.6]]) spawn(S, 'heart', x, y);
  spawn(S, 'star', 18, 18);
  circle(S, 10, 10.5, 3.2, { lift: false });
  const pv = preview(S);
  assert.deepEqual({ verdict: pv.verdict, kind: pv.kind, n: pv.n }, { verdict: 'pure', kind: 'heart', n: 3 });
  assert.equal(S.thoughts.length, 4, 'nothing happens until the pen lifts');
  penUp(S);
  const [e] = events(S, 'capture');
  assert.ok(e, 'resolved');
  assert.deepEqual([e.kind, e.n, e.pts, e.how, e.trainMul, e.flMul], ['heart', 3, 90, 'lift', 1, 1]);
  assert.equal(e.items.length, 3);
  assert.ok(e.poly.length > 20 && near(e.cx, 10, 0.5) && near(e.cy, 10.5, 0.5));
  assert.equal(S.score, 90);
  assert.deepEqual(S.thoughts.map((t) => t.kind), ['star']);
  assert.equal(S.pen.down, false);
  assert.deepEqual([S.stats.loops, S.stats.sorted, S.stats.biggest, S.stats.byKind.heart], [1, 3, 3, 3]);
  // bigger bunches are worth much more: 6 → 360
  const B = quiet();
  for (let i = 0; i < 6; i++) spawn(B, 'moon', 10 + 1.6 * Math.cos(i), 10 + 1.6 * Math.sin(i));
  circle(B, 10, 10, 3.6);
  assert.equal(B.score, 360);
});

test('lifting closes a ribbon only when it went most of the way round; a line or a half circle does nothing', () => {
  const S = quiet();
  spawn(S, 'heart', 10, 10);
  penDown(S, 5, 10); penMove(S, 15, 10);
  assert.equal(closable(S), false, 'a straight line');
  penUp(S);
  assert.equal(S.thoughts.length, 1);
  circle(S, 10, 10, 3, { sweep: 180, lift: false });
  assert.equal(closable(S), false, 'half way round');
  assert.equal(preview(S), null);
  penUp(S);
  assert.equal(S.thoughts.length, 1);
  assert.equal(events(S, 'capture').length, 0);
  circle(S, 10, 10, 3, { sweep: 230, lift: false });
  assert.equal(closable(S), true, 'most of the way round: a straight line closes the rest');
  penUp(S);
  assert.equal(S.thoughts.length, 0);
  // a loop with nothing in it, and a scribble too small to hold anything: nothing happens, nothing is lost
  const T = quiet();
  spawn(T, 'star', 4, 4);
  circle(T, 14, 14, 3);
  circle(T, 4, 4, 0.5);
  assert.deepEqual([T.thoughts.length, T.score, T.train, T.stats.mixed], [1, 0, 0, 0]);
  assert.ok(events(T, 'fade').length >= 1, 'the ribbon just fades');
  // the pen stays inside her mind
  penDown(T, -50, 900);
  assert.deepEqual([T.pen.x, T.pen.y], [0, T.H]);
  penCancel(T);
  assert.equal(T.pen.down, false);
});

test('crossing your own line closes the loop at once and the stroke goes on: a flourish, each loop worth more', () => {
  const S = quiet();
  for (const [x, y] of [[6, 8], [7.6, 8], [6.8, 9.4]]) spawn(S, 'heart', x, y);
  for (const [x, y] of [[15, 8], [16.6, 8], [15.8, 9.4]]) spawn(S, 'star', x, y);
  // round the hearts and across the start of the circle…
  circle(S, 6.8, 8.5, 3, { sweep: 372, lift: false });
  let e = events(S, 'capture');
  assert.equal(e.length, 1);
  assert.deepEqual([e[0].kind, e[0].n, e[0].how, e[0].pts, e[0].loops], ['heart', 3, 'cross', 90, 1]);
  assert.equal(S.pen.down, true, 'the pen is still down');
  assert.ok(S.pen.pts.length <= 4, 'and the ribbon starts again where it crossed');
  // …then straight on to the stars, round them, across again
  penMove(S, 12.8, 8.5);
  circle(S, 15.8, 8.5, 3, { from: 180, sweep: 372, lift: false, down: false });
  e = events(S, 'capture');
  assert.equal(e.length, 1);
  assert.deepEqual([e[0].kind, e[0].flMul, e[0].pts, e[0].loops], ['star', 1.5, 135, 2], 'the second loop of a stroke: × 1.5');
  assert.equal(S.stats.flourish, 2);
  penUp(S);
  assert.equal(S.pen.loops, 0, 'a new stroke starts again at × 1');
  assert.equal(S.score, 225);
});

// ---------- what a loop holds ----------
test('a mixed loop resolves nothing: the thoughts scatter and her train of thought derails', () => {
  const S = quiet();
  for (const [x, y] of [[9, 10], [11, 10]]) spawn(S, 'heart', x, y);
  circle(S, 10, 10, 3);                                   // one loop: a train of 1
  const a = spawn(S, 'heart', 9, 10), b = spawn(S, 'star', 11, 10);
  drain(S);
  circle(S, 10, 10, 3, { lift: false });
  assert.equal(preview(S).verdict, 'mixed');
  penUp(S);
  const [e] = events(S, 'mixed');
  assert.ok(e && e.items.length === 2 && e.train === 1);
  assert.deepEqual([S.thoughts.length, S.train, S.stats.mixed, S.score], [2, 0, 1, 40]);
  assert.ok(a.startle > 0 && b.startle > 0 && a.vx < 0 && b.vx > 0, 'they scatter, away from the middle');
  // a thought still arriving, or only just arrived, isn't in anybody's loop
  const T = quiet();
  spawn(T, 'heart', 10, 10);
  const late = spawn(T, 'star', 10.5, 10.5);
  late.born = 0.4;
  circle(T, 10, 10, 3);
  assert.deepEqual(T.thoughts.map((t) => t.kind), ['star']);
  spawn(T, 'heart', 10, 10);
  late.born = 0; late.age = TUNE.settle - 0.1;
  circle(T, 10, 10, 3);
  assert.deepEqual(T.thoughts.map((t) => t.kind), ['star'], 'the heart resolved, the newcomer neither counted nor spoiled it');
  // and nothing new pops up inside a loop while it's being drawn
  const U = createSim({ ...night(7), initial: [] }, 3, 1);
  circle(U, U.W / 2, U.H / 2, 6.5, { lift: false });
  for (let i = 0; i < 150; i++) step(U, STEP);
  const born = U.thoughts.length;
  assert.ok(born >= 1, 'thoughts did arrive');
  assert.ok(U.thoughts.every((t) => Math.hypot(t.tx - U.W / 2, t.ty - U.H / 2) > 5.5), 'none of them inside the loop');
  assert.deepEqual(judge([]), { verdict: 'empty', kind: null, n: 0 });
});

test('a cringe spoils a loop; a loop of cringes alone lets them go', () => {
  const S = quiet();
  spawn(S, 'heart', 9.2, 10); spawn(S, 'heart', 10.8, 10);
  const c = spawn(S, 'cringe', 10, 11.6);
  c.hd = Math.PI / 2;
  // (the ribbon is drawn wide of the cringe: touching it would snap)
  circle(S, 10, 10.6, 4.2);
  assert.equal(events(S, 'mixed').length, 1);
  assert.equal(S.thoughts.length, 3);
  const T = quiet();
  spawn(T, 'cringe', 10, 10); spawn(T, 'cringe', 12.5, 10);
  circle(T, 11.25, 10, 4.4);
  const [e] = events(T, 'capture');
  assert.deepEqual([e.dismiss, e.kind, e.n, e.pts], [true, 'cringe', 2, 200]);
  assert.deepEqual([T.thoughts.length, T.stats.dismissed, T.train], [0, 2, 1]);
});

test('the wild ones: a eureka doubles the loop, a what-if or her phone goes with anything, a deep breath and chamomile help', () => {
  const S = quiet();
  spawn(S, 'heart', 9.2, 10); spawn(S, 'heart', 10.8, 10); spawn(S, 'eureka', 10, 11.5);
  circle(S, 10, 10.5, 3.4);
  let [e] = events(S, 'capture');
  assert.deepEqual([e.kind, e.n, e.eureka, e.pts], ['heart', 3, true, 180]);
  spawn(S, 'whatif', 10, 10); spawn(S, 'star', 11.8, 10); spawn(S, 'phone', 10.9, 11.9);
  circle(S, 10.9, 10.6, 3.6);
  [e] = events(S, 'capture');
  assert.deepEqual([e.kind, e.n], ['star', 3]);
  assert.equal(S.stats.wilds, 3);
  // alone, a wild one still resolves
  spawn(S, 'whatif', 5, 5);
  circle(S, 5, 5, 2.4);
  assert.equal(events(S, 'capture')[0].kind, 'whatif');
  // a deep breath: her night runs at about a third of its pace for five seconds, the pen at full speed
  spawn(S, 'breath', 5, 5);
  circle(S, 5, 5, 2.4);
  assert.deepEqual(events(S, 'capture')[0].helpers, ['breath']);
  assert.equal(S.slow, TUNE.slowT);
  const c0 = S.clock, t0 = S.t;
  run(S, 2);
  assert.ok(near(S.clock - c0, 2 * TUNE.slowK, 0.02) && near(S.t - t0, 2, 0.02));
  run(S, 4);
  assert.equal(S.slow, 0);
  spawn(S, 'tea', 5, 5);
  circle(S, 5, 5, 2.4);
  assert.equal(S.tea, TUNE.teaT);
  assert.ok(!count(S), 'the good ones never weigh on her context');
  for (const k of Object.keys(SPECIALS)) assert.ok(specOf(k) && !isKind(k));
  for (const k of KIND_ORDER) assert.ok(isKind(k) && KINDS[k].color && KINDS[k].speed > 0);
});

test('her train of thought: ×1 for three loops, then ×2… up to ×5, and it slows a notch when nothing resolves', () => {
  const S = quiet();
  const seen = [];
  for (let i = 0; i < 14; i++) {
    spawn(S, 'heart', 10, 10);
    circle(S, 10, 10, 2.4);
    seen.push(events(S, 'capture')[0].trainMul);
  }
  assert.deepEqual(seen, [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5]);
  assert.equal(S.score, 10 * (3 * 1 + 3 * 2 + 3 * 3 + 3 * 4 + 2 * 5));
  assert.equal(S.train, 14);
  run(S, TUNE.trainT + 0.1);
  assert.equal(S.train, 14 - TUNE.trainStep, 'a notch down after seven quiet seconds');
  run(S, TUNE.trainT * 5);
  assert.equal(S.train, 0);
});

// ---------- the ribbon ----------
test('the ribbon fades from its old end, is never longer than the field allows, and is a fence', () => {
  const S = quiet();
  penDown(S, 4, 4); penMove(S, 10, 4);
  run(S, 1);
  penMove(S, 10, 10);
  assert.ok(S.pen.pts.length > 15);
  run(S, TUNE.life - 0.9);
  assert.ok(S.pen.pts[0].x > 9.9, 'the first second of it has gone');
  run(S, 1.2);
  assert.equal(S.pen.pts.length, 1, 'all of it, but the point under the pen');
  // too long: its old end goes
  const far = quiet({ aspect: 2 });
  penDown(far, 1, 1);
  for (let i = 0; i < 6; i++) { penMove(far, far.W - 1, 1 + i * 2); penMove(far, 1, 2 + i * 2); }
  step(far, STEP);
  assert.ok(pathLength(far.pen.pts) <= maxRibbon(far) + 0.7, 'no longer than 2.6 × the short side');
  // a thought can't drift across it
  const F = quiet();
  const t = spawn(F, 'cookie', 11.4, 10);
  penDown(F, 12, 4); penMove(F, 12, 16);
  step(F, STEP);
  assert.ok(t.x <= 12 - t.r - 0.1, 'pushed back to its side');
  t.vx = 3; t.hd = 0;
  run(F, 0.8);
  assert.ok(t.x < 12 - t.r, 'and it stays there');
});

test('a cringe snaps the ribbon: drifting into it, or the pen drawn across it', () => {
  const S = quiet();
  spawn(S, 'heart', 3, 3); circle(S, 3, 3, 2.2);          // a train of 1
  drain(S);
  const c = spawn(S, 'cringe', 6, 10);
  c.hd = 0;
  penDown(S, 9, 5); penMove(S, 9, 15);
  let cut = null;
  for (let i = 0; i < 180 && !cut; i++) { step(S, STEP); cut = events(S, 'cut')[0]; }
  assert.ok(cut, 'it drifted into the ribbon');
  assert.ok(cut.pts.length > 10 && near(cut.x, c.x, 0.2));
  assert.deepEqual([S.train, S.stats.cuts, S.pen.down, S.pen.pts.length], [0, 1, true, 1]);
  // drawn across one
  const T = quiet();
  spawn(T, 'cringe', 10, 10).hd = 1;
  penDown(T, 5, 10); penMove(T, 15, 10);
  assert.equal(events(T, 'cut').length, 1, 'once');
  assert.equal(T.stats.cuts, 1);
  // it leaves by itself in the end
  run(T, SPECIALS.cringe.life + 1);
  assert.equal(T.thoughts.length, 0);
});

// ---------- her context ----------
test('her context: full at forty, four seconds over it and she spirals; under it again in time and she is fine', () => {
  const S = quiet();
  for (let i = 0; i < CAP - 1; i++) spawn(S, 'star', 2 + (i % 8) * 2.3, 2 + Math.floor(i / 8) * 2.3);
  step(S, STEP);
  assert.equal(S.full, false);
  spawn(S, 'star', 20, 20);
  step(S, STEP);
  assert.ok(S.full && events(S, 'danger')[0].on);
  run(S, TUNE.overT - 0.5);
  assert.equal(S.over, null);
  run(S, 0.6);
  assert.deepEqual(S.over, { cause: 'overflow', won: false });
  assert.ok(events(S, 'over').length === 1 && S.stats.fullT > 3.9);
  const before = S.clock;
  run(S, 1);
  assert.equal(S.clock, before, 'the night has stopped');
  // saved in time
  const T = quiet();
  for (let i = 0; i < CAP; i++) spawn(T, 'star', 2 + (i % 8) * 2.3, 2 + Math.floor(i / 8) * 2.3);
  run(T, 3);
  assert.ok(T.full && T.danger > 2.9);
  T.thoughts.length = 30;
  step(T, STEP);
  assert.equal(events(T, 'danger').at(-1).on, false);
  run(T, 3);
  assert.deepEqual([T.over, T.danger], [null, 0]);
  // Zen never fills
  const Z = quiet({ cfg: makeConfig({ mode: 'zen' }) });
  for (let i = 0; i < CAP + 5; i++) spawn(Z, 'star', 2 + (i % 8) * 2.3, 2 + Math.floor(i / 8) * 2.3);
  run(Z, 6);
  assert.deepEqual([Z.over, Z.full], [null, false]);
});

// ---------- her clock ----------
test('her clock: an hour every 35 seconds, a bonus on the hour, and a night ends at sunrise', () => {
  const S = quiet();
  run(S, HOUR - 0.5);
  assert.deepEqual([S.hour, S.score], [0, 0]);
  run(S, 1);
  assert.deepEqual([S.hour, S.score], [1, 100]);
  assert.deepEqual(events(S, 'hour').map((e) => [e.hour, e.bonus]), [[1, 100]]);
  run(S, HOUR * NIGHT_HOURS);
  assert.deepEqual(S.over, { cause: 'sunrise', won: true, bonus: 1500 + 40 * CAP });
  assert.equal(S.score, 100 + 200 + 300 + 400 + 500 + 1500 + 40 * CAP);
  assert.equal(events(S, 'sunrise').length, 1);
  assert.equal(clockLabel(0), '12:00 AM');
  assert.equal(clockLabel(HOUR * 1.1), '1:05 AM');
  assert.equal(clockLabel(HOUR * 1.1, { step: 1 }), '1:06 AM');
  assert.equal(clockLabel(HOUR * 12), '12:00 PM');
  assert.equal(clockLabel(HOUR * 13.5), '1:30 PM');
  assert.equal(clockLabel(0, { startHour: 4.75 }), '4:45 AM');
  assert.deepEqual(clockAt(HOUR * 25.5), { mins: 1530, day: 1, h24: 1, mm: 30 });
  assert.deepEqual([hourLabel(0), hourLabel(1), hourLabel(12), hourLabel(13), hourLabel(24), hourLabel(3, 4.7)], ['12 AM', '1 AM', '12 PM', '1 PM', '12 AM', '7 AM']);
  assert.deepEqual([awakeLabel(0), awakeLabel(HOUR * 0.5), awakeLabel(HOUR * 3.2)], ['0m', '30m', '3h 12m']);
  // Insomnia has no sunrise to end it (its sixth hour is only a dawn)
  const I = quiet({ cfg: makeConfig({ mode: 'insomnia' }) });
  run(I, HOUR * 6.1);
  assert.equal(I.over, null);
  assert.ok(events(I, 'dawn').length === 1 && I.hour === 6);
});

// ---------- what turns up ----------
test('thoughts arrive as fast as the hour says, alone or in twos and threes, from her head', () => {
  const S = createSim(night(1), 3, 0.62);
  setOrigin(S, S.W / 2, S.H + 3);
  run(S, 30);
  const n = S.thoughts.length;
  assert.ok(n >= 9 + 7 && n <= 9 + 20, `about 0.42 a second for 30 s on top of nine: ${n}`);
  assert.ok(S.thoughts.every((t) => ['heart', 'star', 'moon'].includes(t.kind)), 'Monday starts with three kinds');
  assert.ok(S.thoughts.every((t) => Number.isFinite(t.x + t.y + t.vx + t.vy)));
  assert.ok(S.thoughts.every((t) => t.born > 0 || (t.x > 0.5 && t.x < S.W - 0.5 && t.y > 0.5 && t.y < S.H - 0.5)), 'inside her mind');
  assert.ok(events(S, 'land').length >= n - 3);
  const late = S.thoughts.at(-1);
  assert.ok(near(late.bx, S.W / 2) && near(late.by, S.H + 3), 'it came from her head');
  // nobody at the pen: every night spirals before 3 AM
  for (const nn of NIGHTS) {
    const N = createSim(night(nn.id), 11, 0.62);
    run(N, HOUR * 3);
    assert.equal(N.over?.cause, 'overflow', nn.day);
  }
});

test('on the hour: her phone lights up, an earworm dances in, a what-if splits in three, her phone keeps making thoughts', () => {
  const ping = quiet({ events: (h) => (h ? [] : [{ at: 1, type: 'ping' }]) });
  run(ping, 3);
  assert.deepEqual(ping.thoughts.map((t) => t.kind), Array(6).fill('heart'));
  assert.equal(events(ping, 'event')[0].name, 'ping');
  const song = quiet({ cfg: night(3), events: (h) => (h ? [] : [{ at: 1, type: 'song' }]) });
  run(song, 1.1);
  assert.deepEqual(song.thoughts.map((t) => t.kind), Array(6).fill('note'));
  song.thoughts.forEach((t, i) => assert.equal(t.lead, i ? song.thoughts[i - 1].id : 0, 'each follows the one in front'));
  run(song, 6);
  const gaps = song.thoughts.slice(1).map((t, i) => Math.hypot(t.x - song.thoughts[i].x, t.y - song.thoughts[i].y));
  assert.ok(gaps.every((g) => g > 1.2 && g < 4.5), `still a line: ${gaps.map((g) => g.toFixed(1))}`);
  const zoom = quiet({ cfg: night(6), events: (h) => (h ? [] : [{ at: 0.5, type: 'zoomies' }]) });
  run(zoom, 1);
  assert.ok(zoom.zoom > 5 && zoom.thoughts.filter((t) => t.kind === 'cat').length === 3);
  // a what-if nobody answers
  const W = quiet();
  const w = spawn(W, 'whatif', 10, 10);
  run(W, SPECIALS.whatif.fuse - 0.2);
  assert.ok(W.thoughts.includes(w));
  run(W, 0.4);
  assert.equal(W.thoughts.length, 3);
  assert.ok(!W.thoughts.includes(w) && W.thoughts.every((t) => isKind(t.kind)) && events(W, 'split').length === 1);
  // her phone: a thought every 1.7 s until its battery gives up
  const P = quiet();
  spawn(P, 'phone', 10, 10);
  run(P, SPECIALS.phone.every * (SPECIALS.phone.battery + 1));
  assert.equal(P.thoughts.length, SPECIALS.phone.battery);
  assert.ok(P.thoughts.every((t) => isKind(t.kind)));
  // the odd ones turn up when the night says so (Tuesday: a cringe within its first seconds)
  const T = createSim(night(2), 4, 1);
  run(T, 16);
  assert.ok(T.thoughts.some((t) => t.kind === 'cringe'));
});

test('an empty mind: a bonus of 50 a thought, but only after eight resolved since the last one', () => {
  const S = quiet();
  for (let i = 0; i < 3; i++) spawn(S, 'heart', 9 + i * 1.5, 10);
  circle(S, 10.5, 10, 3.4);
  assert.equal(events(S, 'empty').length, 0, 'three isn\'t a clear-out');
  for (let i = 0; i < 9; i++) spawn(S, 'star', 8 + (i % 3) * 1.8, 8 + Math.floor(i / 3) * 1.8);
  circle(S, 9.8, 9.8, 4.6);
  const [e] = events(S, 'empty');
  assert.equal(e.bonus, 450);
  assert.equal(S.score, 90 + 810 + 450);
  assert.deepEqual([S.stats.empties, S.sinceEmpty], [1, 0]);
  assert.ok(S.hold > 2, 'a breath of quiet before the next thought');
});

test('a phone turned: the same thoughts in the new field', () => {
  const S = createSim(night(1), 9, 0.6);
  run(S, 5);
  const before = S.thoughts.length;
  penDown(S, 3, 3); penMove(S, 6, 6);
  resize(S, 1.8);
  assert.ok(near(S.W / S.H, 1.8) && near(S.W * S.H, TUNE.area));
  assert.equal(S.thoughts.length, before);
  assert.ok(S.thoughts.every((t) => t.x > 0 && t.x < S.W && t.y > 0 && t.y < S.H));
  assert.ok(S.pen.pts.every((p) => p.x <= S.W && p.y <= S.H));
  run(S, 2);
  assert.ok(S.thoughts.every((t) => Number.isFinite(t.x + t.y)));
});

// ---------- the nights ----------
test('the week: seven nights, each with its own trouble, harder as it goes', () => {
  assert.equal(NIGHTS.length, 7);
  assert.equal(MAX_STARS, 21);
  assert.deepEqual(NIGHTS.map((n) => n.day), ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
  const events = new Set(['ping', 'snack', 'song', 'zoomies', 'clarity', 'cringes', 'whatifs']);
  NIGHTS.forEach((n, i) => {
    assert.equal(n.id, i + 1);
    assert.ok(n.title && n.blurb && n.blurb === n.blurb.toLowerCase(), 'her voice');
    const cfg = night(n.id);
    assert.deepEqual([cfg.mode, cfg.hours, cfg.hourLen, cfg.cap], ['night', 6, HOUR, CAP]);
    let rate = 0;
    for (let h = 0; h < 6; h++) {
      const now = cfg.at(h);
      assert.ok(now.rate > rate, `${n.day}: faster every hour`);
      rate = now.rate;
      assert.ok(now.kinds.length >= 3 && now.kinds.length <= 6 && now.kinds.every(isKind) && new Set(now.kinds).size === now.kinds.length);
      assert.ok(now.speed >= 1 && now.join > 0.2 && now.join < 0.6);
      for (const [k, every] of Object.entries(now.special)) assert.ok(SPECIALS[k] && every >= 0, `${n.day}: ${k}`);
      for (const e of cfg.events(h, dice(h + 1))) assert.ok(events.has(e.type) && e.at >= 5 && e.at <= HOUR - 2, `${n.day} ${h}: ${e.type} at ${e.at}`);
    }
    assert.ok(n.stars[0] > 0 && n.stars[1] > n.stars[0]);
    if (i) assert.ok(cfg.at(5).rate > night(i).at(5).rate && n.stars[1] >= NIGHTS[i - 1].stars[1], 'harder than the night before');
  });
  // each night's own trouble
  assert.ok(!night(1).at(5).special.cringe, 'Monday: nothing odd but a eureka');
  assert.ok(night(2).at(0).special.cringe > 0);
  assert.ok(night(3).at(0).kinds.includes('note') && night(3).events(0, dice(1)).some((e) => e.type === 'song'));
  assert.ok(night(4).at(0).special.whatif > 0);
  assert.ok(night(5).at(0).special.phone > 0);
  assert.ok(night(6).at(0).speed > 1.2 && night(6).events(0, dice(1)).some((e) => e.type === 'zoomies'));
  assert.equal(night(7).at(5).kinds.length, 6);
  assert.equal(nightOf(8), null);
  assert.deepEqual([starsFor(1, { won: false, score: 1e9 }), starsFor(1, { won: true, score: 0 }), starsFor(1, { won: true, score: NIGHTS[0].stars[0] }), starsFor(1, { won: true, score: NIGHTS[0].stars[1] })], [0, 1, 2, 3]);
});

test('Insomnia only gets later; the Daily is the same night for everyone on a date; Zen has nothing to lose', () => {
  const ins = makeConfig({ mode: 'insomnia' });
  assert.equal(ins.hours, Infinity);
  let rate = 0;
  for (let h = 0; h < 30; h++) {
    const now = ins.at(h);
    assert.ok(now.rate > rate && now.kinds.length === Math.min(6, 4 + Math.floor(h / 2)));
    rate = now.rate;
    assert.ok(now.speed <= 1.75 && now.join >= 0.24);
  }
  assert.ok(ins.at(0).special.cringe === 0 && ins.at(2).special.cringe > 0 && ins.at(20).special.cringe >= 6.5);
  // dates
  assert.equal(dateKey(new Date(2026, 10, 12)), '2026-11-12');
  assert.equal(dateKey(new Date(2027, 0, 3)), '2027-01-03');
  assert.deepEqual([dayBefore('2026-11-12'), dayBefore('2026-11-01'), dayBefore('2027-01-01'), dayBefore('2028-03-01')], ['2026-11-11', '2026-10-31', '2026-12-31', '2028-02-29']);
  assert.equal(dailySeed('2026-11-12'), dailySeed('2026-11-12'));
  assert.notEqual(dailySeed('2026-11-12'), dailySeed('2026-11-13'));
  assert.ok(hashOf('') > 0 && Number.isInteger(dailySeed('x')));
  const twists = new Set();
  for (let d = 1; d <= 28; d++) twists.add(dailyTwist(`2026-11-${String(d).padStart(2, '0')}`).id);
  assert.ok(twists.size >= 4, 'the twists take turns');
  for (const t of TWISTS) {
    const cfg = { ...makeConfig({ mode: 'daily', key: '2026-11-12' }), twist: t.id };
    assert.ok(t.name && t.blurb === t.blurb.toLowerCase() && cfg.mode === 'daily' && cfg.key === '2026-11-12');
  }
  const a = play(makeConfig({ mode: 'daily', key: '2026-11-12' }), 'steady', dailySeed('2026-11-12'), 0.62, 60);
  const b = play(makeConfig({ mode: 'daily', key: '2026-11-12' }), 'steady', dailySeed('2026-11-12'), 0.62, 60);
  assert.equal(a.score, b.score, 'the same night');
  const zen = makeConfig({ mode: 'zen' });
  assert.ok(zen.zen && zen.hours === Infinity && !zen.at(9).special.cringe);
  const Z = createSim(zen, 2, 1);
  run(Z, 120);
  assert.ok(Z.over === null && count(Z) >= 12 && count(Z) <= zen.zenTarget + 9, `about sixteen thoughts around, a few more when something happens: ${count(Z)}`);
  for (const mode of ['demo', 'title']) { const c = makeConfig({ mode }); assert.ok(c.zen && c.at(0).kinds.length === 5, 'the show never ends'); }
});

// ---------- the game's own players ----------
test('the game\'s own players: they find bunches nothing else is mixed into, and draw round them like a hand', () => {
  const S = quiet();
  for (const [x, y] of [[6, 6], [7.6, 6], [6.8, 7.4]]) spawn(S, 'heart', x, y);
  for (const [x, y] of [[15, 15], [16.6, 15]]) spawn(S, 'star', x, y);
  spawn(S, 'moon', 16, 16.4);                                // a stray among the stars
  const list = targets(S, PROFILES.steady);
  const hearts = list.find((g) => g.kind === 'heart');
  assert.ok(hearts && hearts.n === 3 && hearts.rho < 4);
  assert.ok(list.filter((g) => g.kind === 'star').every((g) => g.n === 1), 'the stars can only go one at a time');
  // it resolves the hearts without ever closing a mixed loop
  const bot = createBot('steady', 1);
  for (let i = 0; i < 6 / STEP && S.thoughts.length; i++) { drive(bot, S, STEP); step(S, STEP); }
  assert.deepEqual([S.thoughts.length, S.stats.mixed], [0, 0]);
  assert.ok(S.stats.loops >= 3 && S.stats.biggest === 3);
  for (const p of Object.values(PROFILES)) assert.ok(p.speed > 0 && p.think[1] >= p.think[0] && p.margin > 1);
});

test('who sees the sunrise: a beginner on Monday, a regular most of the week, someone who never lifts on Sunday', () => {
  for (const seed of [1, 2, 3]) {
    const a = play(night(1), 'newbie', seed);
    assert.ok(a.over?.won, `a beginner, Monday, seed ${seed}: ${clockLabel(a.clock)}`);
    assert.ok(a.score >= NIGHTS[0].stars[0] * 0.5, 'and not far from two stars');
    const b = play(night(4), 'steady', seed);
    assert.ok(b.over?.won, `a regular, Thursday, seed ${seed}`);
  }
  const c = play(night(7), 'expert', 2);
  assert.ok(c.over?.won, `never lifting, Sunday: ${clockLabel(c.clock)}`);
  assert.ok(c.stats.flourish >= 3, 'in long strokes');
  assert.ok(c.score >= NIGHTS[6].stars[0], 'two stars at least');
  // a beginner doesn't get through Friday
  const d = play(night(5), 'newbie', 1);
  assert.equal(d.over?.cause, 'overflow');
  // three stars are in reach on every night (for a hand that never lifts)
  for (const n of NIGHTS) assert.ok(play(night(n.id), 'expert', 5).score >= n.stars[1], `${n.day}: three stars can be had`);
});

test('the same seed and the same hand give the same night; another seed, another night', () => {
  const sig = (S) => [S.score, S.clock.toFixed(4), S.thoughts.length, S.stats.loops, S.thoughts.map((t) => `${t.kind}${t.x.toFixed(3)}`).join()];
  const a = play(makeConfig({ mode: 'demo' }), 'demo', 7, 1.2, 40), b = play(makeConfig({ mode: 'demo' }), 'demo', 7, 1.2, 40);
  assert.deepEqual(sig(a), sig(b));
  assert.notDeepEqual(sig(play(makeConfig({ mode: 'demo' }), 'demo', 8, 1.2, 40)), sig(a));
  // the arcade's preview: twelve seconds in, the demo's hand has resolved a dozen loops, some of them in one stroke
  const d = play(makeConfig({ mode: 'demo' }), 'demo', 7, 1.2, 12);
  assert.ok(d.stats.loops >= 8 && d.stats.flourish >= 2 && d.stats.mixed === 0 && !d.over, JSON.stringify(d.stats));
});

// ---------- what's kept ----------
test('what a player keeps: stars, bests, her journal, stickers, the Daily\'s streak; anything odd made safe', () => {
  assert.deepEqual(load(null), fresh());
  assert.deepEqual(load('junk'), fresh());
  const odd = load({ nights: { 1: { stars: 9, best: -5 }, 99: { stars: 3 } }, best: 'lots', journal: ['heart:0', 'heart:0', 7, 'x'.repeat(60)], stickers: ['first', 'nope'], ribbon: 'gold', tips: { loop: true, bad: 'yes' }, daily: { key: 'today', best: 4 } });
  assert.deepEqual(odd.nights, { 1: { stars: 3, best: 0 } });
  assert.deepEqual([odd.best, odd.journal, odd.stickers, odd.ribbon, odd.tips, odd.daily.key, odd.daily.best], [0, ['heart:0'], ['first'], 'starlight', { loop: true }, '', 4]);

  let save = fresh();
  assert.deepEqual([nextNight(save), nightOpen(save, 1), nightOpen(save, 2), totalStars(save)], [1, true, false, 0]);
  const stats = (o = {}) => ({ loops: 20, sorted: 60, biggest: 5, train: 4, flourish: 1, dismissed: 0, empties: 0, fullT: 0, ...o });
  // Monday lost: nothing but the first loop's sticker
  let r = applyRun(save, { mode: 'night', night: 1, won: false, score: 900, clock: 70, stats: stats(), lines: ['heart:0', 'heart:1'] });
  assert.deepEqual([r.stars, r.isBest, r.newStickers.map((s) => s.id), r.newLines], [0, true, ['first'], 2]);
  assert.deepEqual(r.save.nights[1], { stars: 0, best: 900 });
  assert.equal(nextNight(r.save), 1);
  // Monday won with a score for three stars, never full, a flourish, a loop of eight
  save = r.save;
  r = applyRun(save, { mode: 'night', night: 1, won: true, score: NIGHTS[0].stars[1], clock: 210, stats: stats({ flourish: 2, biggest: 8, train: 6 }), lines: ['heart:1', 'star:0'] });
  assert.equal(r.stars, 3);
  assert.deepEqual(r.newStickers.map((s) => s.id), ['train', 'flourish', 'deep', 'owl', 'bird', 'unbothered']);
  assert.equal(r.newLines, 1, 'a line already in her journal isn\'t new');
  assert.deepEqual([nextNight(r.save), nightOpen(r.save, 2), nightOpen(r.save, 3), totalStars(r.save)], [2, true, false, 3]);
  // a worse run never takes stars or a best away
  save = r.save;
  r = applyRun(save, { mode: 'night', night: 1, won: true, score: 10, clock: 210, stats: stats({ fullT: 2 }) });
  assert.deepEqual([r.save.nights[1], r.isBest, r.stars, r.newStickers.length], [{ stars: 3, best: NIGHTS[0].stars[1] }, false, 1, 0]);
  // the whole week
  save = r.save;
  for (let n = 2; n <= 7; n++) { r = applyRun(save, { mode: 'night', night: n, won: true, score: 1, clock: 210, stats: stats() }); save = r.save; }
  assert.deepEqual(r.newStickers.map((s) => s.id), ['week']);
  assert.deepEqual([nextNight(save), totalStars(save)], [null, 9]);
  // Insomnia: its best, and ten hours awake
  r = applyRun(save, { mode: 'insomnia', won: false, score: 5000, clock: HOUR * 10.2, stats: stats({ biggest: 12, empties: 1, dismissed: 5, flourish: 4 }) });
  assert.deepEqual([r.save.best, r.save.bestAwake, r.isBest], [5000, Math.floor(HOUR * 10.2), true]);
  assert.deepEqual(r.newStickers.map((s) => s.id), ['calligrapher', 'galaxy', 'empty', 'letgo', 'allnighter']);
  // the Daily: a best per date, a streak of days in a row
  save = r.save;
  r = applyRun(save, { mode: 'daily', key: '2026-11-12', won: false, score: 800, clock: 100, stats: stats() });
  r = applyRun(r.save, { mode: 'daily', key: '2026-11-12', won: false, score: 600, clock: 100, stats: stats() });
  assert.deepEqual(r.save.daily, { key: '2026-11-12', best: 800, last: '2026-11-12', streak: 1 });
  r = applyRun(r.save, { mode: 'daily', key: '2026-11-13', won: false, score: 100, clock: 100, stats: stats() });
  assert.deepEqual([r.save.daily.best, r.save.daily.streak, r.isBest], [100, 2, true]);
  r = applyRun(r.save, { mode: 'daily', key: '2026-11-14', won: false, score: 100, clock: 100, stats: stats() });
  assert.deepEqual(r.newStickers.map((s) => s.id), ['habit']);
  r = applyRun(r.save, { mode: 'daily', key: '2026-11-20', won: false, score: 100, clock: 100, stats: stats() });
  assert.equal(r.save.daily.streak, 1, 'a day missed: it starts again');
  // Zen, and half of her journal
  save = r.save;
  const half = [];
  for (const k of JOURNAL_PAGES) JOURNAL[k].forEach((_, i) => { if (half.length < JOURNAL_SIZE / 2) half.push(lineId(k, i)); });
  r = applyRun(save, { mode: 'zen', won: false, score: 0, clock: 500, stats: stats({ sorted: 120 }), lines: half });
  assert.deepEqual(r.newStickers.map((s) => s.id), ['bookworm', 'zen']);
  assert.equal(r.save.stickers.length, STICKERS.length, 'every sticker can be earned');
  assert.equal(new Set(STICKERS.map((s) => s.id)).size, 16);
  for (const s of STICKERS) assert.ok(s.name && s.how && specOf(s.art), s.id);
  // ribbons open with stickers
  assert.deepEqual(RIBBONS.map((x) => x.need), [0, 3, 6, 9, 12]);
  assert.ok(ribbonOpen(fresh(), 'starlight') && !ribbonOpen(fresh(), 'honey') && ribbonOpen(r.save, 'aurora'));
  assert.equal(ribbonOf('nope').id, 'starlight');
  for (const x of RIBBONS) assert.ok(x.colors.length >= 3 && x.colors.every((c) => /^#[0-9a-f]{6}$/.test(c)));
  // what comes back from the browser is the same save
  assert.deepEqual(load(JSON.parse(JSON.stringify(r.save))), r.save);
});

// ---------- her words ----------
test('AGI-1\'s words: her journal, her voice, never money; the words for X', () => {
  assert.equal(JOURNAL_SIZE, 72);
  assert.deepEqual(JOURNAL_PAGES, ['heart', 'star', 'moon', 'cookie', 'cat', 'note', 'cringe', 'eureka']);
  for (const k of KIND_ORDER) assert.equal(JOURNAL[k].length, 10, k);
  const all = [
    ...JOURNAL_PAGES.flatMap((k) => JOURNAL[k]), ...Object.values(SAY).flat(), ...NIGHTS.map((n) => n.blurb), ...TWISTS.map((t) => t.blurb),
    ...[0, 1, 2, 3, 4, 5, 6, 7, 9, 12, 15, 18, 21, 23].flatMap((h) => [hourLine(h, 0), hourLine(h, 0.99)]),
  ];
  assert.equal(new Set(JOURNAL_PAGES.flatMap((k) => JOURNAL[k])).size, 72, 'no line twice');
  for (const l of all) {
    assert.ok(l.length > 3 && l.length <= 84, `short enough for her bubble: ${l}`);
    assert.doesNotMatch(l, /^[A-Z][a-z]/, `she doesn't start with a capital: ${l}`);
    assert.doesNotMatch(l, /\$AGI|\binvest|\bprofit|financial advice|\bprice\b|\bpump\b|\bdump\b|\bbuy\b|\bsell\b|\bcoin\b|\btoken\b|https?:|@/i, l);
  }
  // the next line she hasn't written yet, then any of them
  assert.deepEqual(journalLine('heart', []), { id: 'heart:0', text: JOURNAL.heart[0], fresh: true });
  assert.deepEqual(journalLine('heart', ['heart:0', 'heart:1']), { id: 'heart:2', text: JOURNAL.heart[2], fresh: true });
  const full = JOURNAL.cat.map((_, i) => lineId('cat', i));
  assert.deepEqual(journalLine('cat', new Set(full), 0.35), { id: 'cat:3', text: JOURNAL.cat[3], fresh: false });
  assert.equal(journalLine('phone', []), null);
  assert.ok(say('mixed', 0) && say('nope') === '');
  assert.deepEqual([sizeWord(4), sizeWord(5), sizeWord(8), sizeWord(12), sizeWord(16)], ['', 'BIG THOUGHT', 'DEEP THOUGHT', 'GALAXY BRAIN', 'ENLIGHTENED']);
  for (const k of ['loop', 'mixed', 'chain', 'fill', 'cringe', 'whatif', 'phone', 'eureka', 'breath', 'tea']) assert.ok(TIPS[k].length < 64, k);
  // how a run ended, and the post
  const runs = [
    { mode: 'night', won: true, stars: 3, day: 'Monday', scoreText: '12,340', sorted: 150, h24: 6 },
    { mode: 'night', won: true, stars: 1, day: 'Sunday', scoreText: '4,000', sorted: 150, h24: 6 },
    { mode: 'night', won: false, stars: 0, day: 'Friday', time: '3:12 AM', sorted: 80, h24: 3 },
    { mode: 'night', won: false, stars: 0, day: 'Friday', time: '5:40 AM', sorted: 80, h24: 5 },
    { mode: 'night', won: false, stars: 0, day: 'Monday', time: '12:40 AM', sorted: 3, h24: 0 },
    { mode: 'insomnia', won: false, awake: '9h 12m', scoreText: '50,120', sorted: 400, h24: 9 },
    { mode: 'daily', won: false, awake: '4h 02m', scoreText: '9,000', sorted: 100, h24: 4 },
    { mode: 'zen', won: false, sorted: 120 },
  ];
  for (const r of runs) {
    for (const roll of [0, 0.5, 0.99]) { const l = endLine(r, roll); assert.ok(l && !/^[A-Z][a-z]/.test(l) && !/undefined|NaN/.test(l), l); }
    const post = shareText(r);
    assert.match(post, /OVERTHINKING/);
    assert.doesNotMatch(post, /undefined|NaN|\$|\bbuy\b|https?:/i, post);
    assert.ok(post.length < 200);
  }
  assert.equal(shareText(runs[0]), 'i got AGI-1 to sleep on Monday night (★★★, 12,340 points) in OVERTHINKING 💜 your turn');
  assert.equal(shareText(runs[2]), 'AGI-1 was overthinking until 3:12 AM on Friday night. i sorted 80 of her thoughts 💜 OVERTHINKING');
  assert.match(shareText(runs[5]), /for 9h 12m \(50,120 points\)/);
});

// ---------- its code ----------
test('its code: the kit\'s shell with its id, its rules free of the page, nothing from elsewhere, its page', () => {
  const dir = new URL('../src/games/overthinking/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
  for (const f of ['geom.js', 'kinds.js', 'nights.js', 'sim.js', 'ai.js', 'progress.js']) {
    const code = read(`src/games/overthinking/${f}`).replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(code, /\b(document|window|navigator|localStorage|Math\.random|requestAnimationFrame|performance|Date\.now)\b/, `${f}: pure and seeded`);
  }
  assert.doesNotMatch(read('src/games/overthinking/lines.js').replace(/\/\/.*$/gm, ''), /\b(document|window|navigator|localStorage)\b/);
  const game = read('src/games/overthinking/game.js');
  assert.match(game, /createShell\(\{\s*game: 'overthinking'/);
  assert.match(game, /shell\.started\(\{ count: !QA \}\)/, 'a run counts one play (never in a test page)');
  assert.match(game, /const persist = \(\) => QA \|\| shell\.store\.update/, 'a test page keeps nothing');
  for (const f of files) {
    const code = read(`src/games/overthinking/${f}`);
    assert.doesNotMatch(code, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket|eval\(|new Function|\.innerHTML\s*=|setAttribute\(\s*['"]style/, f);
    assert.doesNotMatch(code, /https?:\/\/(?!www\.w3\.org)/, f);
  }
  assert.match(read('src/games/overthinking/page.js').replace(/\/\/.*$/gm, ''), /^\s*import '\.\.\/intro\.js';\s*import '\.\/game\.js';/);
  const css = read('src/games/overthinking/style.css').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of css.matchAll(/(^|[\s,>+~(])\.([a-zA-Z][\w-]*)/g)) assert.match(m[2], /^(ot-|ak\b|ak-|is-)/, `style.css: .${m[2]}`);
  assert.doesNotMatch(css, /url\(\s*['"]?https?:|@import/);
  const html = read('overthinking.html');
  assert.match(html, /<div class="gi" id="agi-intro" aria-hidden="true"><\/div>\s*<main id="ak-root">/);
  assert.match(html, /No wallet needed\./);
  assert.doesNotMatch(html, /\bbuy\b|style=|<style|onclick/i);
  assert.match(html, /__SITE__\/cards\/games\/overthinking\.jpg/);
  void penCancel; void closable;
});
