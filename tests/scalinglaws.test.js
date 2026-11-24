// SCALING LAWS (2026-11-24): its rules in Node (no browser): the gates' maths, the crowd's shape (squeezed to the road),
// a gate picks its side by where the crowd is, hazards knock parameters off (and Robustness softens it), rivals trade one
// for one, the edges, the benchmark staircase and the score, Endless keeps building track, the same seed the same track,
// its own player passing levels, and AGI-1's lines.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as S0 from '../src/games/scalinglaws/rules.js';
import { playRun } from '../src/games/scalinglaws/ai.js';
import { LINES, shareText } from '../src/games/scalinglaws/lines.js';
import { checkLines } from './helpers/agi1-lines.js';

const { apply, opText, isGood, formation, unitAt, createRun, update, drain, makeTrack, stepCost, MULTS, TUNE, params } = S0;
const run1 = (S, secs, x = 0) => { for (let t = 0; t < secs && !S.over; t += 1 / 60) update(S, 1 / 60, x); };
// a run with a track we lay ourselves
function lab(items, opts = {}) {
  const S = createRun({ level: 1, seed: 1, ...opts });
  S.items = items.map((it, i) => ({ id: 500 + i, ...it }));
  S.items.sort((a, b) => a.z - b.z);
  S.length = 60;
  return S;
}

test('the gates’ maths, and how they read', () => {
  assert.equal(apply({ t: '+', v: 12 }, 10), 22);
  assert.equal(apply({ t: 'x', v: 3 }, 10), 30);
  assert.equal(apply({ t: '-', v: 15 }, 10), 0, 'never below zero');
  assert.equal(apply({ t: '/', v: 2 }, 11), 5);
  assert.deepEqual(['+5', '×2', '-8', '÷3'], [{ t: '+', v: 5 }, { t: 'x', v: 2 }, { t: '-', v: 8 }, { t: '/', v: 3 }].map(opText));
  assert.equal(isGood({ t: 'x', v: 2 }), true); assert.equal(isGood({ t: '/', v: 2 }), false);
});

test('the crowd is a sunflower that never gets wider than the road allows (it gets longer instead)', () => {
  for (const n of [1, 10, 100, 1000, 20000]) {
    const f = formation(n);
    assert.ok(f.r <= TUNE.maxR + 1e-9, `${n}: ${f.r}`);
    let far = 0;
    for (let i = 0; i < Math.min(n, 400); i++) far = Math.max(far, Math.abs(unitAt(i, f).x));
    assert.ok(far <= f.r + 1e-9);
  }
  assert.ok(formation(1000).depth > formation(50).depth, 'a big crowd runs as a column');
});

test('a gate pair: the side the crowd is on is the one it runs through', () => {
  const L = lab([{ kind: 'gates', z: 3, ops: [{ t: 'x', v: 2 }, { t: '-', v: 5 }] }]);
  run1(L, 1, -0.6);
  assert.equal(L.n, 20);
  const R = lab([{ kind: 'gates', z: 3, ops: [{ t: 'x', v: 2 }, { t: '-', v: 5 }] }]);
  run1(R, 1, 0.6);
  assert.equal(R.n, 5);
  assert.ok(drain(R).some((e) => e.type === 'gate' && !e.better), 'the worse pick is noted');
});

test('a wall lets through only the parameters in its gap; Robustness softens hazards', () => {
  const W = lab([{ kind: 'wall', z: 3, gap: [-1, 0] }]);
  W.n = 100;
  run1(W, 1, -0.5);
  const lostLeft = 100 - W.n;
  const W2 = lab([{ kind: 'wall', z: 3, gap: [-1, 0] }]);
  W2.n = 100;
  run1(W2, 1, 0.5);
  assert.ok(100 - W2.n > lostLeft + 30, 'on the wrong side most of the crowd is stopped');
  const tough = lab([{ kind: 'wall', z: 3, gap: [-1, 0] }], { upgrades: { robust: 6 } });
  tough.n = 100;
  run1(tough, 1, 0.5);
  assert.ok(tough.n > W2.n, 'Robustness keeps more of them');
});

test('a rival model trades one for one; bigger wins, smaller loses the run', () => {
  const win = lab([{ kind: 'rival', z: 4, n: 30, n0: 30 }]);
  win.n = 50;
  run1(win, 3);
  assert.equal(win.n, 20); assert.equal(win.stats.rivals, 1);
  const lose = lab([{ kind: 'rival', z: 4, n: 60, n0: 60 }]);
  lose.n = 50;
  run1(lose, 3);
  assert.equal(lose.over, true); assert.equal(lose.cause, 'rival');
});

test('the benchmark: each step takes its cost, the highest reached multiplies the score', () => {
  const S = lab([]);
  S.n = 37; S.cost = 5;
  run1(S, 30);
  assert.equal(S.won, true);
  assert.equal(S.step, 7, '7 steps of 5 from 37');
  assert.equal(S.score, Math.round(37 * MULTS[6] * 10) + S.gems);
  assert.ok(stepCost(110, 1) >= 10, 'sized from the par crowd');
});

test('tracks: the same seed, the same track; every level has gates first; Endless keeps building', () => {
  assert.deepEqual(makeTrack({ level: 5, seed: 9 }), makeTrack({ level: 5, seed: 9 }));
  for (let level = 1; level <= 20; level++) {
    const t = makeTrack({ level, seed: 3 });
    assert.equal(t.items[0].kind === 'gem' ? t.items.find((i) => i.kind !== 'gem').kind : t.items[0].kind, 'gates', `level ${level} starts with gates`);
    assert.ok(t.length >= TUNE.length0 && t.length <= TUNE.lengthMax);
  }
  const E = createRun({ mode: 'endless', seed: 4, upgrades: { pretrain: 12 } });
  run1(E, 40, 0);
  assert.ok(E.built > 200 || E.over, 'the track keeps coming');
  assert.equal(params(128), '128B'); assert.equal(params(1500), '1.5T');
});

test('its own player passes most levels (a careful one), and Endless lasts a while', async () => {
  let won = 0;
  for (const level of [1, 3, 6, 10, 15]) for (const seed of [1, 2]) if ((await playRun({ level, seed: seed * 97, profile: 'expert' })).won) won++;
  assert.ok(won >= 9, `expert passed ${won}/10`);
  const e = await playRun({ mode: 'endless', seed: 13, profile: 'steady', maxTime: 400 });
  assert.ok(e.time > 20, `endless lasted ${e.time}s`);
  assert.deepEqual(await playRun({ level: 4, seed: 5 }), await playRun({ level: 4, seed: 5 }), 'the same run twice');
});

test('her lines', () => {
  checkLines(LINES);
  assert.match(shareText({ mode: 'campaign', level: 3, params: '200B', step: 9 }), /level 3 of SCALING LAWS with 200B/);
  void drain;
});
