// SYNAPSE (2026-11-08), an arcade-kit game on agi1.app/games: its generator and solver, the campaign's stored boards,
// the player's drawing rules (cutting, bridges, gates, winning), the Daily and Rush boards, the music in a board, the
// demo's player, AGI-1's lines and its files, all in Node (no browser). Run: node --test tests/synapse.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  generate, solve, uniqueBoard, gateUntilUnique, withGates, straightCells, encode, checksum, neighbors, dirOf, adjacent,
  CELL, DEAD, BRIDGE, GATE, UP, RIGHT, DOWN, LEFT, OPP,
} from '../src/games/synapse/puzzle.js';
import { Board } from '../src/games/synapse/rules.js';
import {
  PACKS, packSize, TOTAL_BOARDS, boardAt, packSum, storedSum, decodeGates, encodeGates, dayKey, dayNumber, daySeed,
  dailyBoard, dailySpec, nextStreak, rushBoard, rushSpec, RUSH, UNLOCK_AT,
} from '../src/games/synapse/packs.js';
import { SEEDS } from '../src/games/synapse/campaign.js';
import { SCALE, ROOT, VOICES, degreeOf, midiOf, firingPlan, bloomChord } from '../src/games/synapse/melody.js';
import { Autoplayer, planStrokes, strokeTime, prefill } from '../src/games/synapse/demo.js';
import { LINES, RUSH_END, RUSH_BEST, RUSH_CLOSE, say, rushLine, rushShare, dailyShare } from '../src/games/synapse/lines.js';
import { rng } from '../src/games/kit/fx.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// a board from a picture: '.' a cell, '#' a hole, '+' a bridge, '^>v<' a gate, letters the neurons (a pair each, the
// first one in reading order its source); its answer given as each color's cells (from its source)
function board(rows, sol = null) {
  const n = rows.length, N2 = n * n;
  const kind = new Uint8Array(N2), gdir = new Int8Array(N2).fill(-1), ends = {};
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const i = y * n + x;
    if (ch === '#') kind[i] = DEAD;
    else if (ch === '+') kind[i] = BRIDGE;
    else if ('^>v<'.includes(ch)) { kind[i] = GATE; gdir[i] = '^>v<'.indexOf(ch); }
    else if (/[A-Z]/.test(ch)) (ends[ch] = ends[ch] || []).push(i);
  }));
  const letters = Object.keys(ends).sort();
  const pairs = letters.map((k) => ({ s: ends[k][0], t: ends[k][1] }));
  return { n, kind, gdir, pairs, sol: sol || pairs.map(() => []), seed: 0 };
}
// draw a color along cells (pressing its first cell)
function draw(b, cells) {
  b.begin(b.pick(cells[0]));
  const out = [];
  for (let k = 1; k < cells.length; k++) out.push(b.stepTo(cells[k]));
  return { out, res: b.end() };
}
// every cell (and both lanes of every bridge) covered exactly once by an answer, each step to a neighbour, bridges
// and gates crossed straight, gates the arrow's way
function checkAnswer(pz, sol = pz.sol) {
  const { n, kind } = pz, N2 = n * n;
  const used = new Map();
  sol.forEach((P, c) => {
    assert.equal(P[0], pz.pairs[c].s, 'starts at its source');
    assert.equal(P[P.length - 1], pz.pairs[c].t, 'ends at its target');
    for (let k = 0; k < P.length; k++) {
      const v = P[k];
      assert.notEqual(kind[v], DEAD, 'never through a hole');
      if (k) assert.ok(adjacent(n, P[k - 1], v), 'one step at a time');
      let unit = v;
      if (kind[v] === BRIDGE || kind[v] === GATE) {
        assert.ok(k > 0 && k < P.length - 1, 'never ends on a bridge or a gate');
        const din = dirOf(n, P[k - 1], v), dout = dirOf(n, v, P[k + 1]);
        assert.equal(din, dout, 'straight through');
        if (kind[v] === BRIDGE) unit = din & 1 ? v : N2 + v;
        else assert.equal(din, pz.gdir[v], 'a gate: the arrow\'s way');
      }
      assert.ok(!used.has(unit), `cell ${v} used once`);
      used.set(unit, c);
    }
  });
  let units = 0;
  for (let i = 0; i < N2; i++) if (kind[i] !== DEAD) units += kind[i] === BRIDGE ? 2 : 1;
  assert.equal(used.size, units, 'every cell filled');
}

// ---------- the generator ----------
test('the generator: every cell covered by the answer, pairs at the ends of their paths and never side by side', () => {
  const specs = [
    { n: 5, pairs: [4, 5] }, { n: 6, pairs: [5, 6] }, { n: 7, pairs: [6, 8] }, { n: 7, pairs: [6, 7], holes: [3, 6] },
    { n: 8, pairs: [7, 8], bridges: [1, 2] }, { n: 9, pairs: [8, 10], holes: [4, 8], bridges: [0, 1] }, { n: 10, pairs: [9, 10] },
  ];
  for (const spec of specs) {
    for (let seed = 1; seed <= 6; seed++) {
      const pz = generate(spec, seed);
      assert.equal(pz.n, spec.n);
      assert.ok(pz.pairs.length >= spec.pairs[0] && pz.pairs.length <= spec.pairs[1], `${spec.n}: ${pz.pairs.length} pairs`);
      assert.ok(pz.pairs.length <= 10, 'ten colors at most');
      checkAnswer(pz);
      for (const [c, p] of pz.pairs.entries()) {
        assert.ok(!adjacent(pz.n, p.s, p.t), 'no pair whose neurons touch');
        assert.ok(pz.sol[c].length >= 3, 'paths of 3 cells or more');
        assert.equal(pz.kind[p.s], CELL); assert.equal(pz.kind[p.t], CELL);
      }
      // thin paths: no path touches itself (its cells side by side only where they follow each other)
      for (const P of pz.sol) {
        const at = new Map(P.map((v, k) => [v, k]));
        for (let k = 0; k < P.length; k++) {
          if (pz.kind[P[k]] === BRIDGE) continue;
          for (let d = 0; d < 4; d++) {
            const j = neighbors(pz.n)[P[k] * 4 + d];
            if (j < 0 || pz.kind[j] === BRIDGE || !at.has(j)) continue;
            assert.equal(Math.abs(at.get(j) - k), 1, 'a thin path');
          }
        }
      }
    }
  }
});

test('the generator: the same seed makes the same board, another seed another one; holes keep the board in one piece', () => {
  const spec = { n: 7, pairs: [6, 7], holes: [3, 6] };
  assert.equal(encode(generate(spec, 42)), encode(generate(spec, 42)));
  assert.notEqual(encode(generate(spec, 42)), encode(generate(spec, 43)));
  for (let seed = 1; seed <= 10; seed++) {
    const pz = generate(spec, seed), n = pz.n, nb = neighbors(n);
    const live = [...pz.kind.keys()].filter((i) => pz.kind[i] !== DEAD);
    assert.ok(live.length < n * n, 'some holes');
    const seen = new Set([live[0]]), stack = [live[0]];
    while (stack.length) { const i = stack.pop(); for (let d = 0; d < 4; d++) { const j = nb[i * 4 + d]; if (j >= 0 && pz.kind[j] !== DEAD && !seen.has(j)) { seen.add(j); stack.push(j); } } }
    assert.equal(seen.size, live.length, 'one piece');
  }
});

test('bridges: inside the board, each with four plain neighbours, crossed once across and once over; gates on straight cells, the answer\'s way', () => {
  for (let seed = 1; seed <= 8; seed++) {
    const pz = generate({ n: 8, pairs: [7, 9], bridges: [2, 3] }, seed);
    const n = pz.n, nb = neighbors(n);
    const bridges = [...pz.kind.keys()].filter((i) => pz.kind[i] === BRIDGE);
    assert.ok(bridges.length >= 2);
    for (const b of bridges) {
      for (let d = 0; d < 4; d++) assert.equal(pz.kind[nb[b * 4 + d]], CELL, 'four plain neighbours');
      for (const o of bridges) if (o !== b) assert.ok(Math.abs((o % n) - (b % n)) + Math.abs(((o / n) | 0) - ((b / n) | 0)) > 2, 'apart');
    }
    checkAnswer(pz);
  }
  const pz = generate({ n: 8, pairs: [5, 6] }, 3);
  const straight = straightCells(pz);
  assert.ok(straight.length > 5);
  const g = withGates(pz, straight.slice(0, 3).map((s) => s.cell));
  for (const s of straight.slice(0, 3)) { assert.equal(g.kind[s.cell], GATE); assert.equal(g.gdir[s.cell], s.dir); }
  checkAnswer(g);
  assert.throws(() => withGates(pz, [pz.pairs[0].s]), /no gate/, 'never on a neuron');
});

// ---------- the solver ----------
test('the solver: finds the board\'s own answer, and counts a second one when there is one', () => {
  // one pair from corner to corner of a 3 × 3: two ways to fill it (row by row, column by column)
  const two = board(['A..', '...', '..A']);
  const r2 = solve(two, { limit: 5, collect: true });
  assert.equal(r2.count, 2);
  for (const s of r2.solutions) checkAnswer(two, s);
  // a corridor: one way only
  assert.equal(solve(board(['A.A', '###', 'B.B']), { limit: 2 }).count, 1);
  // impossible: a pair walled off from each other
  assert.equal(solve(board(['A#A', '#.#', 'B#B']), { limit: 2 }).count, 0, 'no answer');
  // generated boards: the stored answer is among the answers found
  for (let seed = 1; seed <= 12; seed++) {
    const pz = generate({ n: 6, pairs: [5, 6] }, seed);
    const r = solve(pz, { limit: 2, collect: true });
    assert.ok(r.count >= 1);
    if (r.count === 1) assert.deepEqual(r.solutions[0], pz.sol);
    for (const s of r.solutions) checkAnswer(pz, s);
  }
});

test('the solver: bridges let two paths cross, gates only one way', () => {
  // A across the bridge, B over it: the only way
  const pz = board(['#B#', 'A+A', '#B#'], [[3, 4, 5], [1, 4, 7]]);
  assert.deepEqual(pz.pairs, [{ s: 3, t: 5 }, { s: 1, t: 7 }]);
  const r = solve(pz, { limit: 2, collect: true });
  assert.equal(r.count, 1);
  assert.deepEqual(r.solutions[0], pz.sol);
  // a gate pointing back at the source: no way through
  const g = board(['A>A', '###', '###']);
  assert.equal(solve(g, { limit: 2 }).count, 1, 'with the arrow');
  const back = board(['A<A', '###', '###']);
  assert.equal(solve(back, { limit: 2 }).count, 0, 'against the arrow: none');
  // a gate makes an open board unique
  const open = generate({ n: 7, pairs: [5, 5] }, 11);
  const res = gateUntilUnique(open, rng(5), { min: 2, max: 6 });
  assert.ok(res, 'gates found');
  const gated = withGates(open, res.gates);
  assert.equal(solve(gated, { limit: 2 }).count, 1);
  assert.ok(res.gates.length >= 2);
  checkAnswer(gated);
});

// ---------- the campaign ----------
test('the campaign: six packs of 24 boards, each one made from its stored seed exactly as picked, each with one answer', () => {
  assert.equal(PACKS.length, 6);
  assert.deepEqual(PACKS.map((p) => p.id), ['sprout', 'cortex', 'hippocampus', 'myelin', 'gatekeeper', 'neocortex']);
  assert.equal(TOTAL_BOARDS, 144);
  assert.ok(UNLOCK_AT > 0 && UNLOCK_AT < 24);
  const seen = new Set();
  for (let p = 0; p < PACKS.length; p++) {
    const pack = PACKS[p];
    assert.equal(packSize(pack), 24);
    assert.equal(SEEDS[pack.id].length, 24);
    const lines = [];
    for (let i = 0; i < 24; i++) {
      const pz = boardAt(p, i);
      const key = encode(pz);
      lines.push(key);
      assert.ok(!seen.has(key), 'no board twice');
      seen.add(key);
      checkAnswer(pz);
      const r = solve(pz, { limit: 2, budget: 400000 });
      assert.equal(r.count, 1, `${pack.id} ${i + 1}: one answer`);
      // the pack's twist
      if (pack.id === 'sprout') assert.equal(pz.n, 5);
      if (pack.id === 'cortex') assert.equal(pz.n, 6);
      if (pack.id === 'myelin') assert.ok(pz.kind.includes(BRIDGE));
      if (pack.id === 'gatekeeper') { assert.ok(pz.kind.includes(GATE)); assert.equal(pz.n, 8); }
      if (pack.id === 'neocortex') assert.ok(pz.n >= 9);
    }
    assert.equal(checksum(lines), storedSum(p), `${pack.id}: the generator still makes the picked boards`);
  }
  assert.equal(packSum(0), storedSum(0));
  assert.equal(encodeGates(decodeGates('a.1f.2c')), 'a.1f.2c');
  assert.deepEqual(decodeGates(''), []);
});

// ---------- the player's board ----------
test('drawing: from a neuron to its twin, back along itself to shorten it, a quick tap clears it', () => {
  const b = new Board(board(['A..A', '....', 'B..B', '....']));
  const { out, res } = draw(b, [0, 1, 2, 3]);
  assert.deepEqual(out, ['step', 'step', 'done']);
  assert.ok(res.changed && res.connected);
  assert.ok(b.connected(0));
  assert.equal(b.moves, 1);
  assert.equal(b.stats().pairs, 1);
  // past its twin: no further
  b.begin(b.pick(3));
  assert.equal(b.stepTo(7), false, 'nothing past the twin from its far end');
  assert.equal(b.stepTo(2), 'back', 'back along it');
  b.end();
  assert.deepEqual(b.paths[0], [0, 1, 2]);
  assert.equal(b.moves, 1, 'the same color again is the same move');
  // a lone neuron is no path; a tap on a path clears it
  b.begin(b.pick(1));
  b.end({ tap: true });
  assert.deepEqual(b.paths[0], []);
  // not into another color's neuron, not off a cell's neighbours, not into a hole
  const h = new Board(board(['A#A', '...', 'B.B']));
  h.begin(h.pick(0));
  assert.equal(h.stepTo(1), false, 'a hole');
  assert.equal(h.stepTo(4), false, 'not a neighbour');
  assert.equal(h.stepTo(3), 'step');
  assert.equal(h.stepTo(6), false, 'another color\'s neuron');
  h.cancel();
  assert.deepEqual(h.paths[0], [], 'cancelled: as it was');
});

test('cutting: a drag through another path cuts it for as long as it goes on, and lets it come back when it backs off', () => {
  const b = new Board(board(['A...', 'B..B', 'A...', '....']));
  // B goes straight across row 1
  draw(b, [4, 5, 6, 7]);
  assert.ok(b.connected(1));
  b.begin(b.pick(0));
  b.stepTo(1);
  assert.equal(b.stepTo(5), 'step');
  assert.deepEqual(b.view[1], [4], 'B cut at the crossing');
  assert.deepEqual(b.cutting(), [1]);
  b.stepTo(1);
  assert.deepEqual(b.view[1], [4, 5, 6, 7], 'B back as it was: the drag backed off');
  b.stepTo(5);
  b.end();
  assert.deepEqual(b.paths[1], [], 'let go across it: B is cut (a lone neuron is no path)');
  assert.equal(b.moves, 2);
  // undo brings B back
  assert.ok(b.undo());
  assert.ok(b.connected(1));
  assert.equal(b.undos, 1);
  assert.equal(b.perfect, false, 'an undo: not perfect');
});

test('bridges: one path across, one over the top, each straight on; both lanes must be filled', () => {
  const b = new Board(board(['#B#', 'A+A', '#B#']));
  // A across (left to right) through the bridge
  b.begin(b.pick(3));
  assert.equal(b.stepTo(4), 'step');
  assert.equal(b.stepTo(1), false, 'on a bridge: straight on only');
  assert.equal(b.stepTo(5), 'done');
  b.end();
  assert.ok(b.connected(0));
  assert.ok(!b.solved(), 'the lane over the top is still empty');
  assert.equal(b.stats().filled, b.stats().units - 1);
  // B over the top: crosses A without cutting it
  const { out } = draw(b, [1, 4, 7]);
  assert.deepEqual(out, ['step', 'done']);
  assert.ok(b.connected(0) && b.connected(1));
  assert.ok(b.solved());
  assert.equal(b.ownerAt(4, 1), 0);
  assert.equal(b.ownerAt(4, 0), 1);
  assert.ok(b.perfect);
});

test('gates: crossed the way the arrow points from the source, against it from the target, never sideways', () => {
  // the source of A is on the left (first in reading order), the gate points right
  const fwd = new Board(board(['A>.A', '....', '....', '....']));
  assert.equal(fwd.pz.pairs[0].s, 0, 'the source: first in reading order');
  let r = draw(fwd, [0, 1, 2, 3]);
  assert.deepEqual(r.out, ['step', 'step', 'done']);
  // from the target end the same path is drawn against the arrow (the flow still runs from the source)
  const rev = new Board(board(['A>.A', '....', '....', '....']));
  r = draw(rev, [3, 2, 1, 0]);
  assert.deepEqual(r.out, ['step', 'step', 'done']);
  // the wrong way: the gate says no
  const wrong = new Board(board(['A<.A', '....', '....', '....']));
  wrong.begin(wrong.pick(0));
  assert.equal(wrong.stepTo(1), 'gate');
  assert.equal(wrong.drag.blocked, 1);
  wrong.cancel();
  // sideways into a gate: no; and on a gate the head goes straight on
  const side = new Board(board(['....', 'A>.A', '....', '....']));
  side.begin(side.pick(4));
  assert.equal(side.stepTo(0), 'step');
  assert.equal(side.stepTo(1), 'step');
  assert.equal(side.stepTo(5), 'gate', 'down into a right-pointing gate');
  side.cancel();
  // the firing runs from the source: a path drawn from its target is turned round
  assert.deepEqual(rev.flows()[0], [0, 1, 2, 3]);
});

test('winning needs every pair and every cell; a restart clears, a hint draws the answer\'s path and cuts what\'s in its way', () => {
  // two pairs that connect directly but leave cells empty: not solved
  const b = new Board(board(['A.A', '...', 'B.B']));
  draw(b, [0, 1, 2]);
  draw(b, [6, 7, 8]);
  assert.equal(b.stats().pairs, 2);
  assert.ok(!b.solved(), 'the middle row is empty');
  assert.equal(b.stats().pct, 66);
  assert.ok(b.restart());
  assert.equal(b.stats().pairs, 0);
  assert.equal(b.moves, 0);
  // a real board: hints solve it path by path
  const real = new Board(boardAt(0, 0));
  draw(real, [real.pz.sol[1][0], ...real.pz.sol[1].slice(1, 2)]);
  let guard = 0;
  while (!real.solved() && guard++ < 20) assert.ok(real.hint() >= 0);
  assert.ok(real.solved());
  assert.equal(real.hint(), -1, 'nothing left to show');
  assert.ok(!real.perfect, 'hinted: not perfect');
  // drawing the answer path by path, once each: perfect
  const clean = new Board(boardAt(1, 3));
  for (const P of clean.pz.sol) draw(clean, P);
  assert.ok(clean.solved());
  assert.ok(clean.perfect);
  assert.equal(clean.moves, clean.K);
});

test('dragging fast: the head walks to a far cell a step at a time, and back along its own path at once', () => {
  const b = new Board(board(['A....', '.....', '.....', '.....', '....A']));
  b.begin(b.pick(0));
  const out = b.towards(12);
  assert.ok(out.length >= 2);
  assert.equal(b.head, 12);
  for (let k = 1; k < b.drag.cur.length; k++) assert.ok(adjacent(5, b.drag.cur[k - 1], b.drag.cur[k]));
  b.towards(1);
  assert.equal(b.head, 1);
  b.end();
});

// ---------- the Daily and Rush ----------
test('the Daily: three boards a day, the same for everyone that day, a new set the next; a streak counts days in a row', () => {
  const day = dayKey(new Date(2026, 10, 8, 23, 59));
  assert.equal(day, '2026-11-08');
  assert.equal(dayKey(new Date(2026, 0, 3)), '2026-01-03');
  assert.equal(dayNumber('2026-01-01'), 0);
  assert.equal(dayNumber('2026-11-08') - dayNumber('2026-11-07'), 1);
  assert.notEqual(daySeed('2026-11-08', 0), daySeed('2026-11-09', 0));
  assert.notEqual(daySeed('2026-11-08', 0), daySeed('2026-11-08', 1));
  for (let slot = 0; slot < 3; slot++) {
    const a = dailyBoard(day, slot), b = dailyBoard(day, slot);
    assert.ok(a, 'a board');
    assert.equal(encode(a), encode(b), 'the same board for everyone');
    assert.equal(solve(a, { limit: 2 }).count, 1, 'one answer');
    checkAnswer(a);
  }
  assert.notEqual(encode(dailyBoard(day, 0)), encode(dailyBoard('2026-11-09', 0)));
  // the big one turns by the day: plain, bridges, gates
  const kinds = ['2026-11-08', '2026-11-09', '2026-11-10'].map((k) => dailySpec(k, 2));
  assert.equal(new Set(kinds.map((s) => JSON.stringify(s))).size, 3);
  assert.equal(dailySpec(day, 0).n, 6);
  // the streak
  assert.deepEqual(nextStreak(null, '2026-11-08'), { last: '2026-11-08', n: 1 });
  assert.deepEqual(nextStreak({ last: '2026-11-07', n: 4 }, '2026-11-08'), { last: '2026-11-08', n: 5 });
  assert.deepEqual(nextStreak({ last: '2026-11-05', n: 4 }, '2026-11-08'), { last: '2026-11-08', n: 1 });
  assert.deepEqual(nextStreak({ last: '2026-11-08', n: 4 }, '2026-11-08'), { last: '2026-11-08', n: 4 });
  assert.deepEqual(nextStreak({ last: '2026-12-31', n: 9 }, '2027-01-01'), { last: '2027-01-01', n: 10 }, 'across the year');
});

test('Rush: three minutes, ten more for each board, small boards made live with one answer each, a bit bigger as it goes', () => {
  assert.equal(RUSH.seconds, 180);
  assert.equal(RUSH.bonus, 10);
  assert.equal(rushSpec(0).n, 5);
  assert.equal(rushSpec(5).n, 6);
  assert.equal(rushSpec(20).n, 7);
  for (let k = 0; k < 14; k++) {
    const pz = rushBoard(777, k);
    assert.ok(pz);
    assert.equal(pz.n, rushSpec(k).n);
    assert.equal(solve(pz, { limit: 2 }).count, 1);
  }
  assert.equal(encode(rushBoard(5, 3)), encode(rushBoard(5, 3)), 'a seed repeats');
  assert.notEqual(encode(rushBoard(5, 3)), encode(rushBoard(6, 3)));
});

test('live boards are fast: a 7 × 7 with its one answer checked in well under 60 ms', () => {
  const t0 = performance.now();
  const N = 30;
  for (let s = 1; s <= N; s++) assert.ok(uniqueBoard({ n: 7, pairs: [6, 7] }, s, { budget: 60000 }));
  const each = (performance.now() - t0) / N;
  assert.ok(each < 20, `${each.toFixed(1)} ms a board`);
});

// ---------- the music, the demo ----------
test('the music: a pentatonic grid (right and up are higher, folded past two octaves), a voice a color, the firing in time', () => {
  for (const n of [5, 7, 10]) {
    for (let i = 0; i < n * n; i++) {
      const d = degreeOf(n, i);
      assert.ok(d >= 0 && d <= 9);
      for (let c = 0; c < 10; c++) {
        const m = midiOf(n, i, c);
        assert.ok(SCALE.includes((((m - ROOT) % 12) + 12) % 12), 'always on the scale');
        assert.ok(m > 20 && m < 110);
      }
    }
  }
  assert.equal(degreeOf(5, 20), 0, 'bottom left: the lowest');
  assert.equal(degreeOf(5, 4), 8, 'top right: the highest');
  assert.equal(VOICES.length, 10);
  const pz = boardAt(2, 3), b = new Board(pz);
  for (const P of pz.sol) draw(b, P);
  const plan = firingPlan(pz.n, b.flows());
  assert.equal(plan.notes.length, pz.sol.reduce((s, P) => s + P.length, 0), 'a note a cell');
  assert.ok(plan.end <= 2.3 + 0.045 * 10 + 1e-9, 'the firing stays short');
  assert.ok(plan.step >= 0.07 && plan.step <= 0.13);
  for (let k = 1; k < plan.notes.length; k++) assert.ok(plan.notes[k].t >= plan.notes[k - 1].t);
  assert.equal(plan.notes.filter((x) => x.last).length, pz.pairs.length);
  assert.ok(bloomChord(7).length >= 3);
});

test('the demo\'s player: draws a half-drawn board to the end like a finger would, the same way every time, in the time it says', () => {
  for (const [p, i] of [[2, 4], [3, 10], [4, 2]]) {
    const runOnce = () => {
      const b = new Board(boardAt(p, i));
      prefill(b, [0, 2]);
      const est = strokeTime(planStrokes(b, { x: b.n / 2, y: b.n + 0.6 }), { pace: 0.12 });
      let done = false, t = 0;
      const ap = new Autoplayer(b, { pace: 0.12, hooks: { done() { done = true; } } });
      while (!done && t < 40) { ap.update(1 / 120); t += 1 / 120; }
      return { b, t, est };
    };
    const a = runOnce(), z = runOnce();
    assert.ok(a.b.solved(), 'solved');
    assert.ok(a.b.perfect, 'one stroke a color');
    assert.equal(a.t, z.t, 'the same every time');
    assert.ok(Math.abs(a.t - a.est) < 0.6, `its estimate (${a.est.toFixed(2)} s) holds (${a.t.toFixed(2)} s)`);
  }
});

// ---------- AGI-1's words, the files ----------
test('AGI-1\'s lines: in her voice (lowercase), never money; the share posts', () => {
  const all = [...Object.values(LINES).flat(), ...RUSH_END.flatMap(([, l]) => l), ...RUSH_BEST, ...RUSH_CLOSE];
  assert.ok(all.length >= 25);
  for (const l of all) {
    assert.equal(l, l.toLowerCase(), l);
    assert.ok(l.length < 70, l);
    assert.doesNotMatch(l, /\$AGI|\binvest|\bprofit|\bprice\b|\bpump\b|\bdump\b|\bbuy\b|\bsell\b|token|coin/i, l);
  }
  assert.equal(say('nothing'), '');
  assert.equal(rushLine(4, true, 2), RUSH_BEST[0]);
  assert.equal(rushLine(5, false, 6), RUSH_CLOSE[0]);
  assert.equal(rushLine(1, false, null), RUSH_END[0][1][0]);
  assert.equal(rushShare(7), 'My brain fired 7 boards in SYNAPSE rush on agi1.app 🧠💜');
  assert.equal(rushShare(1), 'My brain fired 1 board in SYNAPSE rush on agi1.app 🧠💜');
  assert.equal(dailyShare('3:42'), 'Daily SYNAPSE done in 3:42 on agi1.app 🧠💜');
});

test('its files: the intro first, the kit\'s shell with its id, its own styles, nothing from elsewhere', () => {
  const page = read('src/games/synapse/page.js').replace(/\/\/.*$/gm, '');
  assert.match(page, /^\s*import '\.\.\/intro\.js';\s*import '\.\/game\.js';/);
  const files = readdirSync(new URL('../src/games/synapse/', import.meta.url)).filter((f) => f.endsWith('.js'));
  const code = files.map((f) => read(`src/games/synapse/${f}`)).join('\n');
  assert.match(code, /createShell\(\{[\s\S]{0,200}game: 'synapse'/);
  assert.doesNotMatch(code, /Math\.random\(\)[^;\n]*\b(generate|solve|uniqueBoard)\(/, 'boards never from Math.random directly');
  assert.doesNotMatch(code, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket|\beval\(|new Function|innerHTML|setAttribute\(\s*['"]style/);
  assert.doesNotMatch(code, /https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
  const css = read('src/games/synapse/style.css');
  for (const m of css.matchAll(/z-index:\s*(\d+)/g)) assert.ok(Number(m[1]) < 9000);
  assert.doesNotMatch(css, /url\(/, 'no outside files');
  for (const f of ['puzzle.js', 'rules.js', 'packs.js', 'melody.js', 'demo.js', 'lines.js', 'campaign.js']) {
    assert.doesNotMatch(read(`src/games/synapse/${f}`), /document\.|window\./, `${f}: pure`);
  }
  // the directions line up with the solver's
  assert.deepEqual([UP, RIGHT, DOWN, LEFT].map((d) => OPP[d]), [DOWN, LEFT, UP, RIGHT]);
});
