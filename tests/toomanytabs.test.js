// TOO MANY TABS (2026-11-24): its rules in Node (no browser): every board is solvable (the order it was dealt in clears
// it, never holding more than six), what's free and what's covered, the taskbar (three alike close, seven freezes),
// Undo / Shuffle / Tab out / one revive, stars and the streak, levels growing, the same seed the same board, its own
// player clearing the levels, and AGI-1's lines.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../src/games/toomanytabs/rules.js';
import { playLevel } from '../src/games/toomanytabs/ai.js';
import { LINES, shareText } from '../src/games/toomanytabs/lines.js';
import { checkLines } from './helpers/agi1-lines.js';

const { createLevel, pick, settle, isFree, undo, shuffle, tabOut, revive, drain, update, TRAY, paramsFor } = T;

test('every board from level 1 to 60 clears in the order it was dealt, never holding more than six', () => {
  for (let level = 1; level <= 60; level++) for (const seed of [1, 7]) {
    const S = createLevel({ level, seed });
    assert.equal(S.tiles.length % 3, 0, 'in threes');
    assert.equal(S.tiles.length, paramsFor(level).tiles, `level ${level}: its size`);
    let most = 0;
    for (const id of S.solution) {
      assert.ok(isFree(S, S.tiles[id - 1]), `level ${level}: tab ${id} free at its turn`);
      assert.equal(pick(S, id), true);
      settle(S);
      most = Math.max(most, S.tray.length);
      assert.ok(!S.over || S.won, `level ${level}: never frozen`);
    }
    assert.equal(S.won, true, `level ${level} cleared`);
    assert.ok(most <= 6, `level ${level}: at most ${most} in the taskbar`);
  }
});

test('a tab is free only with nothing on a higher layer overlapping it', () => {
  const S = createLevel({ level: 6, seed: 3 });
  for (const t of S.tiles) {
    const over = S.tiles.some((u) => u.z > t.z && Math.abs(u.x - t.x) < 1 && Math.abs(u.y - t.y) < 1);
    assert.equal(isFree(S, t), !over);
  }
  const blocked = S.tiles.find((t) => !isFree(S, t));
  assert.equal(pick(S, blocked.id), false, 'a covered tab can’t be taken');
});

// a hand-made board: tabs side by side on one layer, kinds as given
function flat(kinds) {
  const S = createLevel({ level: 1, seed: 1 });
  S.tiles = kinds.map((k, i) => ({ id: i + 1, x: i % 7, y: Math.floor(i / 7), z: 0, kind: k, where: 'board' }));
  return S;
}

test('three alike close (with points and a streak); seven with none alike freezes the browser', () => {
  const S = flat([0, 0, 0, 1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 2]);
  for (const id of [1, 2, 3]) { pick(S, id); }
  settle(S);
  const e = drain(S).find((x) => x.type === 'triple');
  assert.ok(e); assert.equal(S.tray.length, 0); assert.equal(e.combo, 1);
  for (const id of [4, 5, 6]) pick(S, id);
  settle(S);
  assert.equal(drain(S).find((x) => x.type === 'triple').combo, 2, 'a streak within its window');
  update(S, T.TUNE.comboWindow + 0.1);
  assert.equal(S.combo, 0);
  for (const id of [7, 8, 9, 10, 11, 12, 13]) pick(S, id);
  settle(S);
  assert.equal(S.tray.length, TRAY);
  assert.equal(S.over, true); assert.equal(S.cause, 'full');
  assert.equal(revive(S), true, 'one revive: three out to the shelf');
  assert.equal(S.over, false); assert.equal(S.tray.length, TRAY - 3); assert.equal(S.shelf.length, 3);
  assert.equal(revive(S), false, 'only once');
});

test('the taskbar keeps kinds together; Undo, Shuffle and Tab out (one each)', () => {
  const S = flat([0, 1, 0, 2, 3, 4]);
  pick(S, 1); pick(S, 2); pick(S, 3);
  assert.deepEqual(S.tray.map((id) => S.tiles[id - 1].kind), [0, 0, 1], 'the second cat tab lands next to the first');
  assert.equal(undo(S), true);
  assert.equal(S.tiles[2].where, 'board'); assert.equal(undo(S), false, 'one undo a board');
  assert.equal(tabOut(S), true);
  assert.equal(S.shelf.length, 2); assert.equal(S.tray.length, 0);
  assert.equal(isFree(S, S.tiles[S.shelf[0] - 1]), true, 'shelf tabs can be taken back');
  const before = S.tiles.filter((t) => t.where === 'board').map((t) => t.kind).sort();
  assert.equal(shuffle(S), true);
  assert.deepEqual(S.tiles.filter((t) => t.where === 'board').map((t) => t.kind).sort(), before, 'the same kinds, dealt again');
  assert.equal(shuffle(S), false);
});

test('stars by time against par; a cleared board pays a bonus', () => {
  const S = createLevel({ level: 3, seed: 2 });
  for (const id of S.solution) { pick(S, id); settle(S); }
  assert.equal(S.won, true);
  assert.equal(T.starsOf(S), 3, 'instant');
  S.time = T.parOf(S) * 1.3; assert.equal(T.starsOf(S), 2);
  S.time = T.parOf(S) * 2; assert.equal(T.starsOf(S), 1);
  assert.ok(drain(S).some((e) => e.type === 'clear' && e.bonus >= 100));
});

test('levels grow: more tabs, more kinds, more layers', () => {
  const a = paramsFor(1), b = paramsFor(10), c = paramsFor(40);
  assert.ok(a.tiles < b.tiles && b.tiles <= c.tiles);
  assert.ok(a.kinds < b.kinds && b.kinds <= c.kinds);
  assert.ok(a.layers < b.layers);
  assert.deepEqual(createLevel({ level: 9, seed: 5 }).tiles, createLevel({ level: 9, seed: 5 }).tiles, 'the same seed, the same board');
});

test('its own player clears the levels (careful: all of them; careless: fails later ones)', () => {
  for (const level of [1, 4, 8, 14, 20]) for (const seed of [1, 2, 3]) {
    const r = playLevel(createLevel({ level, seed }), 'steady', seed);
    assert.equal(r.won, true, `steady clears level ${level} (seed ${seed})`);
  }
  let lost = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) if (!playLevel(createLevel({ level: 25, seed }), 'newbie', seed).won) lost++;
  assert.ok(lost >= 1, 'a careless player gets caught out on a hard level');
});

test('her lines', () => {
  checkLines(LINES);
  assert.match(shareText({ mode: 'levels', level: 7 }), /level 7 of TOO MANY TABS on agi1\.app/);
});
