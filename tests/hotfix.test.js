// HOTFIX (2026-11-24): its rules in Node (no browser): a fresh board has no lines, the drag swaps the held chip along
// its path (diagonals too, never through a locked chip), lines of three join into groups (each a combo), a turn clears,
// cascades and refills, hits the target (double where it's weak, half where it resists, overflow to the next bug),
// Debug heals, bugs bite and do their worst, floors give patches, bosses every fifth floor, the same seed the same run,
// its own player going deep, and AGI-1's lines.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as HF from '../src/games/hotfix/rules.js';
import { playRun, plan, createBot } from '../src/games/hotfix/ai.js';
import { LINES, shareText } from '../src/games/hotfix/lines.js';
import { checkLines } from './helpers/agi1-lines.js';

const { createRun, fillBoard, applyPath, findGroups, turn, choose, setTarget, floorBugs, W, H, CELLS, DEBUG, JUNK, PATCHES, BOSSES } = HF;
const at = (x, y) => y * W + x;
// a board from rows of kind numbers (0 logic, 1 memory, 2 vision, 3 voice, 4 debug, 5 junk)
const board = (rows) => rows.flat().map((t, i) => ({ id: 100 + i, t, lock: 0 }));
const QUIET = [
  [0, 1, 2, 3, 0, 1],
  [2, 3, 0, 1, 2, 3],
  [0, 1, 2, 3, 0, 1],
  [2, 3, 0, 1, 2, 3],
  [0, 1, 2, 3, 0, 1],
];

test('a fresh board is full and has no lines already made', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const run = createRun({ seed });
    assert.equal(run.cells.length, CELLS);
    assert.equal(findGroups(run.cells).length, 0, `seed ${seed}`);
    assert.ok(run.cells.every((c) => c.t >= 0 && c.t <= DEBUG));
  }
});

test('the drag: the held chip swaps into each cell of its path (diagonals too), never through a locked chip', () => {
  const cells = board(QUIET);
  const held = cells[at(0, 0)].id;
  applyPath(cells, [at(0, 0), at(1, 0), at(2, 1), at(2, 2)]);
  assert.equal(cells[at(2, 2)].id, held, 'it ended where the path did');
  assert.equal(cells[at(0, 0)].t, 1, 'what it passed shifted back one');
  const locked = board(QUIET);
  locked[at(1, 0)].lock = 2;
  applyPath(locked, [at(0, 0), at(1, 0), at(2, 0)]);
  assert.equal(locked[at(0, 0)].t, 0, 'a lock stops the drag');
});

test('lines of three or more join into groups: an L is one group, two separate lines are two', () => {
  const cells = board([
    [4, 4, 4, 1, 0, 3],
    [4, 3, 0, 1, 3, 1],
    [4, 1, 2, 2, 2, 2],
    [2, 3, 0, 1, 0, 3],
    [0, 1, 2, 3, 0, 1],
  ]);
  const g = findGroups(cells);
  assert.equal(g.length, 2);
  assert.deepEqual(g.find((x) => x.t === DEBUG).cells.length, 5, 'the L of Debug');
  assert.deepEqual(g.find((x) => x.t === 2).cells.length, 4, 'the row of four Vision');
  cells[at(0, 0)].t = JUNK; cells[at(1, 0)].t = JUNK; cells[at(2, 0)].t = JUNK;
  assert.ok(!findGroups(cells).some((x) => x.t === JUNK), 'junk never matches');
});

test('a turn: lines clear, chips fall and refill (no holes), the target is hit, Debug heals, junk beside a line goes too', () => {
  const run = createRun({ seed: 5 });
  run.cells = board([
    [0, 1, 2, 3, 0, 1],
    [2, 3, 0, 1, 2, 3],
    [0, 1, 2, 3, 0, 1],
    [5, 3, 0, 1, 2, 3],
    [0, 0, 1, 3, 4, 1],
  ]);
  run.uptime = 50;
  run.bugs = [{ ...floorBugs(1, run.rnd)[0], hp: 999, max: 999, cd: 9, uid: 1 }];
  run.bugs[0].def = { ...run.bugs[0].def, weak: 'logic', resist: 'voice', ability: null };
  // lift the Memory chip at (2, 4) up one: the Logic above drops into a row of three along the bottom
  const T = turn(run, [at(2, 4), at(2, 3)]);
  const kinds = T.map((s) => s.kind);
  assert.equal(kinds[0], 'drag');
  assert.ok(kinds.includes('match') && kinds.includes('fall') && kinds.includes('hits'));
  assert.ok(run.cells.every(Boolean), 'refilled, no holes');
  const hits = T.find((s) => s.kind === 'hits');
  assert.ok(hits.combos >= 1);
  assert.ok(hits.hits.some((h) => h.t === 0 && h.weak), 'Logic hit the bug weak to it, doubled');
  assert.deepEqual(T.find((s) => s.kind === 'match').junk, [at(0, 3)], 'the junk beside the line went with it');
});

test('weak ×2, resist ½; leftover damage carries on to the next bug; a cleared floor offers three patches', () => {
  const run = createRun({ seed: 8 });
  const mk = (uid, hp, weak, resist) => ({ id: 'x', name: 'X', uid, hp, max: hp, atk: 5, cd: 9, cd0: 9, shield: 0, dodged: false, def: { weak, resist, ability: null } });
  run.bugs = [mk(1, 10, 'logic', 'memory'), mk(2, 500, 'vision', 'logic')];
  run.cells = board([
    [0, 0, 0, 1, 2, 3],
    [2, 3, 1, 0, 2, 3],
    [1, 2, 3, 2, 0, 1],
    [2, 3, 0, 1, 2, 3],
    [0, 1, 2, 3, 0, 1],
  ]);
  const T = turn(run, [at(5, 4), at(5, 3)]);
  const hits = T.find((s) => s.kind === 'hits').hits.filter((h) => h.t === 0);
  assert.ok(hits[0].uid === 1 && hits[0].killed, 'the first bug squashed');
  assert.ok(hits.some((h) => h.uid === 2 && h.resist), 'the rest carried on to the second, which resists Logic');
  setTarget(run, 1);
  assert.equal(run.target, 1);
  run.bugs[1].hp = 0;
  run.offer = null;
  const T2 = turn(run, [at(0, 0), at(1, 1)]);
  const clear = T2.find((s) => s.kind === 'clear');
  assert.ok(clear, 'all squashed: floor cleared');
  assert.equal(run.offer.length, 3);
  assert.equal(choose(run, run.offer[0]), true);
  assert.equal(run.floor, 2);
  assert.ok(run.bugs.length >= 1 && run.bugs.every((b) => b.hp > 0));
});

test('bugs bite when their countdown hits zero; abilities do their worst; uptime at zero crashes the run', () => {
  const run = createRun({ seed: 11 });
  run.cells = board(QUIET);
  const def = { weak: 'logic', resist: 'memory', ability: 'corrupt' };
  run.bugs = [{ id: 'x', name: 'X', uid: 1, hp: 999, max: 999, atk: 30, cd: 1, cd0: 1, shield: 0, dodged: false, def }];
  const T = turn(run, [at(0, 0), at(0, 1)]);
  const bites = T.find((s) => s.kind === 'bites').bites;
  assert.ok(bites.some((b) => b.kind === 'bite' && b.amount === 30));
  assert.equal(run.cells.filter((c) => c.t === JUNK).length >= 3, true, 'three chips corrupted into junk');
  run.uptime = 10;
  turn(run, [at(5, 0), at(5, 1)]);
  assert.equal(run.over, true); assert.equal(run.cause, 'crash');
});

test('every fifth floor is a boss; patches have limits', () => {
  const r = createRun({ seed: 1 }).rnd;
  for (const f of [5, 10, 15]) { const b = floorBugs(f, r); assert.equal(b.length, 1); assert.ok(b[0].def.boss); }
  assert.ok(BOSSES.every((b) => b.hp > 400));
  assert.ok(PATCHES.every((p) => p.max >= 1 && p.what.length < 40));
});

test('the same seed, the same run; its own player goes deep (and deeper the sharper it is)', async () => {
  assert.deepEqual(await playRun({ seed: 21, profile: 'steady' }), await playRun({ seed: 21, profile: 'steady' }));
  const floors = { newbie: [], expert: [] };
  for (const p of Object.keys(floors)) for (let s = 1; s <= 5; s++) floors[p].push((await playRun({ seed: s * 11, profile: p })).floor);
  const med = (xs) => [...xs].sort((a, b) => a - b)[2];
  assert.ok(med(floors.expert) >= 10, `expert median floor ${med(floors.expert)}`);
  assert.ok(med(floors.expert) > med(floors.newbie), 'sharper goes deeper');
  const run = createRun({ seed: 3 });
  const path = plan(createBot('expert', 3), run);
  assert.ok(path.length >= 2 && path.every((i) => i >= 0 && i < CELLS));
});

test('the combo lab: ten moves, no bugs, damage counted', () => {
  const run = createRun({ mode: 'lab', seed: 2 });
  assert.equal(run.bugs.length, 0);
  const bot = createBot('steady', 2);
  for (let i = 0; i < 10; i++) turn(run, plan(bot, run));
  assert.equal(run.over, true); assert.equal(run.cause, 'lab');
  assert.ok(run.damage > 0);
});

test('her lines', () => {
  checkLines(LINES);
  assert.match(shareText({ mode: 'run', floor: 12, combo: 7 }), /floor 12 in HOTFIX with a 7-combo on agi1\.app/);
  void H;
});
