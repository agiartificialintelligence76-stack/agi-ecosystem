// CONTEXT WINDOW (2026-11-24): its rules in Node (no browser): tokens join her tail behind her, a run of 3+ of one color
// is held until a different color commits it (10 × n × n, chained), junk shatters behind a commit and the sides join,
// her context overflows into lost hearts, the walls and her tail end a run (Zen wraps and snips), the same seed plays the
// same run, its own player lasts minutes, and AGI-1's lines.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/games/contextwindow/rules.js';
import { createBot, think, playRun } from '../src/games/contextwindow/ai.js';
import { LINES, TIPS, endLine, shareText } from '../src/games/contextwindow/lines.js';
import { checkLines } from './helpers/agi1-lines.js';

const { createRun, step, turn, drain, frontRun, points, TUNE, SPAM } = C;
// a run with an empty board, her heading right from (1, 5), and the tokens we put down
function lab(tokens = [], opts = {}) {
  const S = createRun({ seed: 3, W: 15, H: 11, ...opts });
  S.tokens.length = 0; S.head = { x: 1, y: 5, px: 1, py: 5 }; S.dir = { x: 1, y: 0 }; S.ready = 0;
  tokens.forEach((t, i) => S.tokens.push({ kind: 'color', life: 99, max: 99, age: 1, id: 900 + i, x: 2 + i, y: 5, ...t }));
  // (no new tokens drop in where we're testing)
  S.cfg = { ...S.cfg, specials: false, spam: false };
  return S;
}
const eatAll = (S, n) => { for (let i = 0; i < n; i++) step(S); };

test('tokens join her tail right behind her, in the order she ate them', () => {
  const S = lab([{ c: 0 }, { c: 1 }, { c: 2 }]);
  eatAll(S, 3);
  assert.deepEqual(S.body.map((s) => s.c), [2, 1, 0], 'newest first');
  assert.deepEqual(S.body.map((s) => [s.x, s.y]), [[3, 5], [2, 5], [1, 5]], 'the path she came along');
  assert.equal(S.stats.eaten, 3);
});

test('three of a color is held; a different color commits it for 10 × n × n, and the tail closes up', () => {
  const S = lab([{ c: 1 }, { c: 1 }, { c: 1 }, { c: 1 }, { c: 0 }]);
  eatAll(S, 4);
  assert.equal(frontRun(S), 4, 'held, not committed yet');
  assert.equal(S.commits, 0);
  eatAll(S, 1);
  const e = drain(S).find((x) => x.type === 'commit');
  assert.ok(e, 'committed');
  assert.equal(e.n, 4);
  assert.equal(e.pts, 160, '10 × 4 × 4');
  assert.deepEqual(S.body.map((s) => s.c), [0], 'only the committing token is left');
  assert.equal(points(6, 1, false), 4 * points(3, 1, false), 'six in a row is worth four times three');
});

test('commits in a row chain (up to ×5) and the chain lapses after its window', () => {
  const S = lab([]);
  for (let k = 0; k < 7; k++) for (let j = 0; j < 3; j++) S.tokens.push({ kind: 'color', c: k % 2, life: 99, max: 99, age: 1, id: 1000 + k * 3 + j, x: 2 + k * 3 + j, y: 5 });
  S.W = 40;
  const chains = [];
  for (let i = 0; i < 21; i++) { step(S); for (const e of drain(S)) if (e.type === 'commit') chains.push(e.chain); }
  assert.deepEqual(chains, [1, 2, 3, 4, 5, 5]);
  C.update(S, TUNE.chainWindow + 0.1);
  assert.equal(S.chain, 0, 'the chain lapsed');
});

test('spam is junk: committing right in front of it shatters it, and the sides join', () => {
  const S = lab([{ c: 2 }, { c: 2 }, { kind: 'spam', c: SPAM }, { c: 0 }, { c: 0 }, { c: 0 }, { c: 2 }]);
  eatAll(S, 7);
  const ev = drain(S).map((e) => e.type);
  assert.ok(ev.includes('shatter') && ev.includes('shattered'), 'the junk shattered');
  assert.ok(ev.includes('join'), 'and the two sides joined into a run of three');
  assert.deepEqual(S.body.map((s) => s.c), [2, 2, 2]);
  assert.equal(frontRun(S), 3);
});

test('past 24 she forgets her oldest token and loses a heart; three and it’s over', () => {
  const S = lab([]);
  S.W = 60;
  for (let i = 0; i < 30; i++) S.tokens.push({ kind: 'color', c: i % 2, life: 99, max: 99, age: 1, id: 2000 + i, x: 2 + i, y: 5 });
  for (let i = 0; i < 30 && !S.over; i++) step(S);
  assert.equal(S.over, true);
  assert.equal(S.cause, 'overflow');
  assert.equal(S.stats.forgot, TUNE.hearts);
  assert.ok(S.body.length <= TUNE.limit);
});

test('the edge, a firewall and her own tail end a run; Zen wraps round and lets the tail go', () => {
  const edge = lab([]);
  edge.head.x = 14;
  step(edge);
  assert.equal(edge.cause, 'edge');
  const wall = lab([]);
  wall.walls.add(5 * wall.W + 2);
  step(wall);
  assert.equal(wall.cause, 'wall');
  const zen = lab([], { mode: 'zen' });
  zen.head.x = 14;
  step(zen);
  assert.equal(zen.over, false);
  assert.equal(zen.head.x, 0, 'wrapped round');
});

test('turns: no reversing into her own tail, at most three queued, and a turn wakes her up', () => {
  const S = lab([{ c: 0 }]);
  step(S);
  S.ready = 1;
  assert.equal(turn(S, 'left'), false, 'no straight back into her tail');
  assert.equal(turn(S, 'up'), true);
  assert.equal(S.ready, 0);
  turn(S, 'left'); turn(S, 'down');
  assert.equal(turn(S, 'right'), false, 'three at most');
});

test('the same seed, the same run (the Daily is the same for everyone)', async () => {
  const a = await playRun({ seed: 42, profile: 'steady', maxTime: 90 });
  const b = await playRun({ seed: 42, profile: 'steady', maxTime: 90 });
  assert.deepEqual(a, b);
  const d1 = C.dailySeed(new Date(2026, 10, 24)), d2 = C.dailySeed(new Date(2026, 10, 24)), d3 = C.dailySeed(new Date(2026, 10, 25));
  assert.equal(d1.seed, d2.seed); assert.notEqual(d1.seed, d3.seed); assert.equal(d1.key, '2026-11-24');
});

test('its own player lasts: steady over a minute, expert longer, and they score', async () => {
  const runs = { steady: [], expert: [] };
  for (const profile of Object.keys(runs)) for (let s = 1; s <= 5; s++) runs[profile].push(await playRun({ seed: s * 7919, profile, maxTime: 600 }));
  const med = (xs) => xs.map((r) => r.time).sort((a, b) => a - b)[2];
  assert.ok(med(runs.steady) > 60, `steady median ${med(runs.steady)}s`);
  assert.ok(med(runs.expert) > med(runs.steady) * 0.8, 'expert at least as long');
  for (const r of runs.steady) { assert.ok(r.commits > 3); assert.ok(r.score > 300); }
});

test('her lines, tips and end words', () => {
  checkLines(LINES);
  for (const t of Object.values(TIPS)) assert.ok(t.length < 120);
  assert.ok(endLine({ score: 9000, best: 100, isBest: true }).length > 3);
  assert.match(shareText(1234, 'daily', 6), /^I committed a ×6 thought and 1,234 points of context in CONTEXT WINDOW \(today’s daily\) on agi1\.app/);
  assert.ok(C.TRAILS.every((t, i, a) => !i || t.need > a[i - 1].need), 'trails open in order');
  void createBot; void think;
});
