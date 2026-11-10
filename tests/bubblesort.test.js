// BUBBLE SORT (2026-11-09): its pure parts in Node. The board's geometry (cells and positions, neighbours on both kinds of
// rows), the path (one function for the guide and the shot: mirrored off the walls, never through a bubble, stuck in a
// free cell next to what it touched), matching, what falls, the SORT bubble's sort pass, WILD, BOMB, stones, locked
// bubbles, memories, misses and the push, the deadline, the score, all 30 levels' data (and the game's own player
// clearing each one), Endless, the demo's sequence, and that the same seed plays the same run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  Board, COLS, LIMIT, ROWS, W, RH, CONTACT, LAUNCHER, DEADLINE_Y, rowY, parseRows, rowsOf, SYMBOL,
  STONE, LOCK, MEMORY, SORT, WILD, BOMB, isColor,
} from '../src/games/bubblesort/grid.js';
import { trace, snap, clampAngle, MIN_ANGLE, MAX_ANGLE } from '../src/games/bubblesort/path.js';
import {
  groupOf, floating, sortRow, sortRowsFor, resolve, around, wildColour, dropValue, dropTotal, comboMult, Game,
  endlessBoard, rowMaker, starsFor, ENDLESS, METER, DROP_CAP,
} from '../src/games/bubblesort/rules.js';
import { LEVELS, BANKS, PER_BANK, levelAt } from '../src/games/bubblesort/levels.js';
import { chooseShot, autoplay, value } from '../src/games/bubblesort/ai.js';
import { demoGame, DEMO_TIMES, DEMO_BOARD } from '../src/games/bubblesort/demo.js';
import { LINES, line, shareText } from '../src/games/bubblesort/lines.js';
import { rng } from '../src/games/kit/fx.js';

const deg = (d) => (d * Math.PI) / 180;
const cellsOf = (b) => { const out = []; b.each((x, r, c) => out.push([r, c, x.k])); return out; };

// ---------- the grid ----------
test('grid: 11 across on wide rows, 10 on narrow ones, offset by half a bubble; the parity flips which is which', () => {
  const b = new Board();
  assert.equal(b.width(0), COLS);
  assert.equal(b.width(1), COLS - 1);
  assert.equal(b.x(0, 0), 1);
  assert.equal(b.x(0, 10), 21);
  assert.equal(b.x(1, 0), 2);
  assert.equal(b.x(1, 9), 20);
  assert.ok(Math.abs(b.y(3) - (1 + 3 * Math.sqrt(3))) < 1e-12);
  b.parity = 1;
  assert.equal(b.width(0), COLS - 1);
  assert.equal(b.width(1), COLS);
  assert.equal(b.has(0, 10), false, 'a narrow row has no 11th cell');
  assert.equal(b.has(-1, 0) || b.has(ROWS, 0), false);
});

test('grid: a cell and its position go both ways, on both kinds of rows', () => {
  for (const parity of [0, 1]) {
    const b = new Board();
    b.parity = parity;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < b.width(r); c++) {
        assert.deepEqual(b.cellAt(b.x(r, c), b.y(r)), { r, c });
        assert.deepEqual(b.cellAt(b.x(r, c) + 0.4, b.y(r) - 0.3), { r, c }, 'a point near a centre');
      }
    }
  }
});

test('grid: every cell\'s neighbours touch it (2 apart, centre to centre), six inside the board, fewer at the edges', () => {
  for (const parity of [0, 1]) {
    const b = new Board();
    b.parity = parity;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < b.width(r); c++) {
        const nb = b.neighbours(r, c, []);
        const n = nb.length / 2;
        const edge = c === 0 || c === b.width(r) - 1 || r === 0 || r === ROWS - 1;
        if (!edge) assert.equal(n, 6, `${r},${c}`);
        assert.ok(n >= 2 && n <= 6);
        for (let i = 0; i < nb.length; i += 2) {
          const d = Math.hypot(b.x(nb[i], nb[i + 1]) - b.x(r, c), b.y(nb[i]) - b.y(r));
          assert.ok(Math.abs(d - 2) < 1e-9, `${r},${c} → ${nb[i]},${nb[i + 1]}: ${d}`);
          assert.equal(b.distance(r, c, nb[i], nb[i + 1]), 1);
          // and back
          const back = b.neighbours(nb[i], nb[i + 1], []);
          assert.ok(back.some((v, j) => j % 2 === 0 && v === r && back[j + 1] === c));
        }
      }
    }
  }
  const b = new Board();
  assert.equal(b.distance(0, 0, 0, 3), 3);
  assert.equal(b.distance(0, 5, 2, 5), 2);
  assert.equal(b.distance(0, 0, 4, 2), 4);
});

test('grid: rows as written (wide rows 21 characters, narrow rows a space and 20) read and write back the same', () => {
  const rows = ['a b c d e f # * M . a', ' b c . . . . . . a b'];
  const b = parseRows(rows);
  assert.equal(b.at(0, 0).k, 1);
  assert.equal(b.at(0, 5).k, 6);
  assert.equal(b.at(0, 6).k, STONE);
  assert.equal(b.at(0, 7).k, LOCK);
  assert.equal(b.at(0, 8).k, MEMORY);
  assert.equal(b.at(0, 9), null);
  assert.equal(b.at(1, 0).k, 2);
  assert.deepEqual(rowsOf(b), rows);
  assert.throws(() => parseRows(['a b c d e f g h i j k']), /isn't a cell/);
  const ids = cellsOf(b).length;
  assert.equal(new Set(Array.from({ length: ids }, (_, i) => i + 1)).size, ids);
});

test('grid: the deadline sits under row 13, the launcher under it', () => {
  assert.equal(LIMIT, 14);
  assert.ok(Math.abs(DEADLINE_Y - (rowY(LIMIT - 1) + 1)) < 1e-12);
  assert.ok(LAUNCHER.y > DEADLINE_Y + 2);
  assert.equal(LAUNCHER.x, W / 2);
  const b = new Board();
  b.put(LIMIT - 1, 3, 1);
  assert.equal(b.overflow(), false);
  b.put(LIMIT, 3, 1);
  assert.equal(b.overflow(), true);
});

// ---------- the path ----------
test('path: straight up an empty board, it sticks to the ceiling right above the launcher', () => {
  const b = new Board();
  const p = trace(b, deg(90));
  assert.equal(p.hit, null);
  assert.equal(p.bounces, 0);
  assert.deepEqual(p.cell, { r: 0, c: 5 });
  assert.ok(Math.abs(p.end.y - rowY(0)) < 1e-9);
  assert.ok(Math.abs(p.length - (LAUNCHER.y - rowY(0))) < 1e-9);
});

test('path: the angle is kept between 10° and 170°', () => {
  assert.equal(clampAngle(0), MIN_ANGLE);
  assert.equal(clampAngle(Math.PI), MAX_ANGLE);
  assert.equal(clampAngle(deg(-30)), MIN_ANGLE);
  assert.ok(Math.abs(MIN_ANGLE - deg(10)) < 1e-12 && Math.abs(MAX_ANGLE - deg(170)) < 1e-12);
  const b = new Board();
  assert.deepEqual(trace(b, deg(2)), trace(b, deg(10)));
});

test('path: a bounce mirrors (the angle in equals the angle out) at the wall where a bubble\'s centre meets it', () => {
  const b = new Board();
  for (const a of [20, 35, 50, 130, 145, 160]) {
    const p = trace(b, deg(a));
    assert.ok(p.bounces >= 1, `${a}°`);
    for (let i = 1; i < p.points.length - 1; i++) {
      const prev = p.points[i - 1], at = p.points[i], next = p.points[i + 1];
      assert.ok(Math.abs(at.x - 1) < 1e-9 || Math.abs(at.x - (W - 1)) < 1e-9, `a bounce at a wall: ${at.x}`);
      const inX = at.x - prev.x, inY = at.y - prev.y, outX = next.x - at.x, outY = next.y - at.y;
      const li = Math.hypot(inX, inY), lo = Math.hypot(outX, outY);
      assert.ok(Math.abs(inX / li + outX / lo) < 1e-9, 'x flips');
      assert.ok(Math.abs(inY / li - outY / lo) < 1e-9, 'y keeps going');
    }
    // its length is the sum of its pieces
    let len = 0;
    for (let i = 1; i < p.points.length; i++) len += Math.hypot(p.points[i].x - p.points[i - 1].x, p.points[i].y - p.points[i - 1].y);
    assert.ok(Math.abs(len - p.length) < 1e-6);
  }
});

// the shortest distance from a point to a segment
const segDist = (px, py, a, b) => {
  const vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - a.x) * vx + (py - a.y) * vy) / l2)) : 0;
  return Math.hypot(a.x + vx * t - px, a.y + vy * t - py);
};
test('path: never through a bubble, touching exactly at CONTACT, landing in a free cell next to what it hit (or the ceiling\'s row)', () => {
  const rand = rng(11);
  let checked = 0;
  for (let n = 0; n < 40; n++) {
    const b = endlessBoard(rand, 3 + (n % 8), 4);
    // a few holes and a lowered ceiling now and then
    b.each((x, r, c) => { if (rand.next() < 0.18) b.rows[r][c] = null; });
    if (n % 5 === 0) { b.push(null); }
    for (let i = 0; i < 25; i++) {
      const a = MIN_ANGLE + (MAX_ANGLE - MIN_ANGLE) * rand.next();
      const p = trace(b, a);
      const pts = p.points;
      b.each((x, r, c) => {
        const bx = b.x(r, c), by = b.y(r);
        for (let s = 1; s < pts.length; s++) assert.ok(segDist(bx, by, pts[s - 1], pts[s]) >= CONTACT - 1e-6, 'never closer than CONTACT');
      });
      const { r, c } = p.cell;
      assert.equal(b.rows[r][c], null, 'a free cell');
      assert.ok(r >= b.top && b.has(r, c));
      if (p.hit) {
        assert.ok(Math.abs(Math.hypot(p.end.x - b.x(p.hit.r, p.hit.c), p.end.y - b.y(p.hit.r)) - CONTACT) < 1e-6, 'it touched at CONTACT');
        assert.equal(b.distance(r, c, p.hit.r, p.hit.c), 1, 'next to what it hit');
      } else {
        assert.equal(r, b.top, 'the ceiling\'s row');
        assert.ok(Math.abs(p.end.y - b.y(b.top)) < 1e-9);
      }
      // the nearest of the free cells next to it
      const d0 = Math.hypot(b.x(r, c) - p.end.x, b.y(r) - p.end.y);
      const near = p.hit ? b.neighbours(p.hit.r, p.hit.c, []) : Array.from({ length: b.width(b.top) }, (_, k) => [b.top, k]).flat();
      for (let j = 0; j < near.length; j += 2) {
        if (near[j] < b.top || b.rows[near[j]][near[j + 1]]) continue;
        assert.ok(d0 <= Math.hypot(b.x(near[j], near[j + 1]) - p.end.x, b.y(near[j]) - p.end.y) + 1e-9);
      }
      checked++;
    }
  }
  assert.equal(checked, 1000);
});

test('path: CONTACT is one fair number: a shot can\'t slip between two bubbles that touch, but passes a gap of one cell', () => {
  assert.ok(CONTACT > 1 && CONTACT < 2, 'smaller than a diameter (forgiving), more than a radius (fair)');
  const b = parseRows(['. . . . a . a . . . .']);
  // straight up between two bubbles one cell apart (centres 4 apart): it reaches the ceiling between them
  const between = trace(b, deg(90));
  assert.equal(between.hit, null);
  assert.deepEqual(between.cell, { r: 0, c: 5 });
  // two that touch (centres 2 apart): every shot aimed between their centres hits one of them
  const t = parseRows(['. . . . a a . . . . .', ' . . . . . . . . . .']);
  for (let x = 9; x <= 11; x += 0.05) {
    const p = trace(t, Math.atan2(LAUNCHER.y - rowY(0), x - LAUNCHER.x));
    assert.notEqual(p.hit, null, `aimed at x ${x.toFixed(2)}`);
    assert.equal(p.hit.r, 0);
  }
  // and a graze: a centre passing a bubble's centre at just more than CONTACT doesn't stick to it
  const g = parseRows(['. . . . . . . . . . .', ' . . . . . . . . . .', '. . . . . . . . . . .', ' . . . . . . . . . .', '. . . . . . . . . . .', ' . . . . . a . . . .']);
  const bx = g.x(5, 5);   // 12
  const miss = trace(g, Math.atan2(LAUNCHER.y - rowY(0), (bx - CONTACT - 0.05) - LAUNCHER.x + 0));
  assert.ok(miss.hit === null || miss.hit.r !== 5 || Math.abs(Math.hypot(miss.end.x - bx, miss.end.y - g.y(5)) - CONTACT) < 1e-6);
});

test('path: the guide is the shot: where the guide says, the bubble lands', () => {
  const g = new Game({ mode: 'level', def: levelAt(4), seed: 3 });
  for (let i = 0; i < 12 && g.status === 'play'; i++) {
    const a = deg(25 + ((i * 37) % 130));
    const guide = g.path(a);
    const k = g.loaded;
    const res = g.fire(a);
    assert.deepEqual({ r: res.r, c: res.c }, guide.cell);
    assert.equal(res.path.length, guide.length);
    assert.equal(res.k, k);
  }
});

// ---------- matching and falling ----------
test('match three: three or more of a colour pop, two don\'t; whatever they held up falls', () => {
  const b = parseRows([
    'b b b b b a b b b b b',
    ' . . . . a . . . . .',
    '. . . . c c c . . . .',
    ' . . . c c . . . . .',
  ]);
  // two a's: one more a under them makes three
  assert.equal(groupOf(b, 0, 5).length, 2);
  const res = resolve(b.clone(), 2, 3, 1);
  assert.equal(res.pops.length, 0, 'no a next to (2,3)');
  const hit = resolve(b, 1, 3, 1);
  assert.equal(hit.pops.length, 3, 'the two a\'s and the shot');
  assert.equal(hit.drops.length, 5, 'the c\'s they held');
  assert.ok(hit.drops.every((d) => d.k === 3));
  assert.equal(b.count(), 10);
  assert.deepEqual(floating(b), []);
});

test('floating: only what touches the ceiling (through anything: stones, locks, memories) stays up', () => {
  const b = parseRows([
    '# . . . . . . . . . a',
    ' * . . . . . . . . b',
    'M . . . . . . . . . .',
    ' . . . . c . . . . .',
  ]);
  const loose = floating(b).map(([r, c]) => `${r},${c}`);
  assert.deepEqual(loose, ['3,4'], 'the stone holds the lock, the lock the memory; the lone c floats');
});

// ---------- the SORT bubble ----------
test('the sort pass: groups the colours, stable (equal colours never swap), and its swaps replay it', () => {
  const rand = rng(5);
  for (let n = 0; n < 60; n++) {
    const b = new Board();
    for (let c = 0; c < 11; c++) if (rand.next() < 0.85) b.put(0, c, rand.next() < 0.12 ? STONE : 1 + Math.floor(rand.next() * 5));
    const before = b.rows[0].map((x) => (x ? { ...x } : null));
    const swaps = sortRow(b, 0);
    const after = b.rows[0];
    // the fixed pieces and the gaps stay where they were
    for (let c = 0; c < 11; c++) {
      if (!before[c] || !isColor(before[c].k)) assert.equal(after[c]?.id, before[c]?.id);
    }
    // the colours are in order, and equal colours keep their order (by id)
    const col = after.filter((x) => x && isColor(x.k));
    for (let i = 1; i < col.length; i++) {
      assert.ok(col[i - 1].k <= col[i].k);
      if (col[i - 1].k === col[i].k) {
        const was = before.filter((x) => x && isColor(x.k) && x.k === col[i].k).map((x) => x.id);
        assert.ok(was.indexOf(col[i - 1].id) < was.indexOf(col[i].id), 'stable');
      }
    }
    // the swaps, replayed on the row as it was, give the same row; each swap fixed an inversion
    const replay = before.slice();
    for (const s of swaps) {
      assert.equal(replay[s.a].id, s.ida);
      assert.equal(replay[s.b].id, s.idb);
      assert.ok(replay[s.a].k > replay[s.b].k);
      [replay[s.a], replay[s.b]] = [replay[s.b], replay[s.a]];
    }
    assert.deepEqual(replay.map((x) => x?.id ?? null), after.map((x) => x?.id ?? null));
    // as many swaps as inversions (bubble sort's own count)
    let inv = 0;
    const ks = before.filter((x) => x && isColor(x.k)).map((x) => x.k);
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) if (ks[i] > ks[j]) inv++;
    assert.equal(swaps.length, inv);
  }
});

test('the SORT bubble sorts its row and the one above (or the two above, when it landed under the stack), then 3+ groups pop', () => {
  const b = parseRows([
    'a b c a b c a b c a b',
    ' c a b c a b c a b c',
  ]);
  // under the stack: its own row is empty, so it sorts rows 0 and 1
  assert.deepEqual(sortRowsFor(b, 2), [0, 1]);
  const res = resolve(b, 2, 5, SORT);
  assert.ok(res.sort);
  assert.deepEqual(res.sort.rows, [0, 1]);
  assert.ok(res.sort.swaps[0].length > 0 && res.sort.swaps[1].length > 0);
  assert.equal(b.at(2, 5), null, 'it dissolved into the sort');
  assert.equal(res.pops.length, 21, 'every colour grouped: the whole thing pops');
  assert.equal(b.count(), 0);
  // inside the stack (two or more colours in its row): its own row and the one above
  const c = parseRows(['a a b b c c a a b b c', ' a b c . . . a b c a']);
  assert.deepEqual(sortRowsFor(c, 1), [0, 1]);
  // nothing to sort: nothing happens, and it isn't a miss
  const g = new Game({ mode: 'level', def: { ...levelAt(1), gifts: { 0: 'sort' } }, seed: 1 });
  g.board = parseRows(['. . . . . . . . . . a']);
  g.misses = 0;
  const r2 = g.fire(deg(120));
  assert.equal(r2.miss, false);
});

test('WILD joins the biggest group next to it; BOMB clears two cells around it (memories spared)', () => {
  const b = parseRows([
    'a a a b b . . . . . .',
    ' a . b . . . . . . .',
  ]);
  assert.equal(wildColour(b, 1, 1), 1, 'a (4 of them) beats b (3)');
  const res = resolve(b, 1, 1, WILD);
  assert.equal(res.wild, 1);
  assert.equal(res.pops.length, 5);
  const m = parseRows([
    'a b c d e f a b c d e',
    ' b c M d e f a b c d',
    'c d e f a b c d e f a',
  ]);
  const before = m.count();
  const r = resolve(m, 3, 3, BOMB);
  assert.ok(r.bomb.length > 0);
  assert.ok(r.bomb.every((x) => x.k !== MEMORY));
  assert.ok(m.at(1, 2) && m.at(1, 2).k === MEMORY, 'the memory stays');
  for (const [rr, cc] of around(m, 3, 3, 2)) if (rr < 3) assert.ok(!m.at(rr, cc) || m.at(rr, cc).k === MEMORY);
  assert.equal(before - m.count(), r.pops.length + r.drops.length);
});

test('stones never pop, locked bubbles break after pops next to them on two shots, memories are freed by falling', () => {
  // a stone next to a pop: still there; once nothing holds it, it falls
  const s = parseRows(['a a . . . . . . . . .', ' # . . . . . . . . .']);
  const r1 = resolve(s, 1, 1, 1);
  assert.equal(r1.pops.length, 3);
  assert.deepEqual(r1.drops.map((d) => d.k), [STONE]);
  // a lock: one hit, then the second breaks it
  const l = parseRows(['b b * a a . . . . . .', ' . . . . . . . . . .']);
  const h1 = resolve(l, 1, 1, 2);
  assert.equal(h1.cracked.length, 1);
  assert.equal(h1.broken.length, 0);
  assert.equal(l.at(0, 2).hits, 1);
  const h2 = resolve(l, 1, 3, 1);
  assert.equal(h2.broken.length, 1);
  assert.equal(l.at(0, 2), null);
  // a level of memories is won when all three have fallen
  const def = { n: 99, name: 't', goal: 'memories', shots: 10, stars: [3, 6], misses: 5, specials: [], gifts: {},
    rows: ['a a . . b b . . c c .', ' M . . . M . . . M .'] };
  const g = new Game({ mode: 'level', def, seed: 1 });
  assert.equal(g.memTotal, 3);
  g.queue = [1, 2]; let res = g.fire(Math.atan2(LAUNCHER.y - rowY(1), 1 - LAUNCHER.x + 0.6));
  assert.ok(res.freed >= 0);
  // free them straight away (the rules' own drop)
  g.board = parseRows(['. . . . . . . . . . .']);
  g.freed = 3;
  g.queue = [1];
  res = g.fire(deg(90));
  assert.equal(res.status, 'won');
});

// ---------- misses, the push, the deadline ----------
test('misses: N shots that pop nothing bring the stack down a row (the ceiling in a level, a new row in Endless); its shapes kept', () => {
  const def = { ...levelAt(1), misses: 3, shots: 50 };
  const g = new Game({ mode: 'level', def, seed: 2 });
  const xs = cellsOf(g.board).map(([r, c]) => g.board.x(r, c)).sort((a, b) => a - b);
  let pushes = 0;
  for (let i = 0; i < 3; i++) {
    g.queue[0] = g.queue[0] === 1 ? 2 : 1;
    // a lone bubble straight up the left side touches nothing of its own colour… or might; misses are counted only then
    const res = g.fire(deg(170));
    if (res.push) { pushes++; assert.equal(res.push.top, 1); }
  }
  if (pushes) {
    assert.equal(g.board.top, 1, 'the ceiling came down one row');
    // every bubble kept its x (a wide row is still wide)
    const xs2 = cellsOf(g.board).map(([r, c]) => g.board.x(r, c)).sort((a, b) => a - b);
    assert.ok(xs.every((x) => xs2.includes(x)));
  }
  // directly: a push keeps every bubble's position but one row down
  const b = parseRows(['a b c d e f a b c d e', ' a b c d e f a b c d']);
  const before = cellsOf(b).map(([r, c, k]) => [b.x(r, c), b.y(r), k]);
  b.push(null);
  const after = cellsOf(b).map(([r, c, k]) => [b.x(r, c), b.y(r) - RH, k]);
  assert.deepEqual(after.map((p) => p.map((v) => Math.round(v * 1e6) / 1e6)), before.map((p) => p.map((v) => Math.round(v * 1e6) / 1e6)));
  assert.equal(b.top, 1);
  // Endless: a new top row, the ceiling stays
  const e = new Game({ mode: 'endless', seed: 4 });
  const n0 = e.board.count();
  const p = e.pushDown('misses');
  assert.equal(e.board.top, 0);
  assert.equal(p.row.length, e.board.width(0));
  assert.equal(e.board.count(), n0 + p.row.length);
  assert.equal(e.rows, 1);
});

test('the deadline: a bubble left past the dashed line ends the run (overflow)', () => {
  const rows = [];
  for (let r = 0; r < LIMIT - 1; r++) rows.push(r % 2 ? ' c c c c c c c c c c' : 'c c c c c c c c c c c');
  rows[LIMIT - 2] = rows[LIMIT - 2].replace(/c/g, 'a');
  const def = { n: 98, name: 'full', goal: 'clear', shots: 30, stars: [5, 10], misses: 1, specials: [], gifts: {}, rows };
  const g = new Game({ mode: 'level', def, seed: 1 });
  assert.equal(g.danger, true);
  g.queue = [2, 2];
  const res = g.fire(deg(90));
  assert.equal(res.status, 'lost');
  assert.equal(res.reason, 'overflow');
});

// ---------- the score ----------
test('the score: a pop 10, a drop 10 · 2^k (at most 1,280 each), the combo ×1, ×1.5, ×2 … ×5', () => {
  assert.deepEqual([0, 1, 2, 3, 7, 8, 12].map(dropValue), [10, 20, 40, 80, 1280, 1280, 1280]);
  assert.equal(DROP_CAP, 1280);
  assert.equal(dropTotal(0), 0);
  assert.equal(dropTotal(3), 70);
  assert.equal(dropTotal(8), 2550);
  assert.equal(dropTotal(10), 2550 + 2 * 1280);
  assert.deepEqual([1, 2, 3, 4, 9, 20].map(comboMult), [1, 1.5, 2, 2.5, 5, 5]);
  assert.equal(METER, 3);
  // three popping shots in a row: the next bubble is a special (SORT, then WILD, then BOMB)
  const def = { n: 97, name: 'm', goal: 'clear', shots: 30, stars: [5, 10], misses: 5, specials: ['sort', 'wild', 'bomb'], gifts: {},
    rows: ['a a . b b . c c . a a', ' . . . . . . . . . .'] };
  const g = new Game({ mode: 'level', def, seed: 1 });
  const aimAt = (r, c) => Math.atan2(LAUNCHER.y - g.board.y(r), g.board.x(r, c) - LAUNCHER.x);
  g.queue = [1, 2]; let res = g.fire(aimAt(0, 0) + 0.0001);
  assert.ok(res.pops.length >= 3, 'a');
  assert.equal(res.mult, 1);
  g.queue = [2, 3]; res = g.fire(aimAt(0, 3));
  assert.ok(res.pops.length >= 3, 'b');
  assert.equal(res.mult, 1.5);
  g.queue = [3, 1]; res = g.fire(aimAt(0, 6));
  assert.ok(res.pops.length >= 3, 'c');
  assert.equal(res.mult, 2);
  assert.equal(res.special, SORT);
  assert.equal(g.loaded, SORT, 'loaded next');
});

// ---------- the levels ----------
test('levels: 30 in 3 banks of 10, each row the right size, known symbols, at most 6 colours, nothing floating', () => {
  assert.equal(LEVELS.length, 30);
  assert.equal(BANKS.length, 3);
  assert.equal(PER_BANK, 10);
  assert.deepEqual(LEVELS.map((l) => l.n), Array.from({ length: 30 }, (_, i) => i + 1));
  assert.equal(new Set(LEVELS.map((l) => l.name)).size, 30, 'every name its own');
  for (const l of LEVELS) {
    assert.equal(l.bank, Math.ceil(l.n / 10));
    assert.ok(l.rows.length >= 3 && l.rows.length <= 11, `${l.n}: rows`);
    l.rows.forEach((row, r) => {
      assert.equal(row.length, r % 2 ? 20 : 21, `${l.n} row ${r}: "${row}"`);
      const cells = r % 2 ? row.slice(1).split(' ') : row.split(' ');
      assert.equal(cells.length, r % 2 ? 10 : 11);
      for (const ch of cells) assert.ok(ch in SYMBOL, `${l.n}: "${ch}"`);
    });
    const b = parseRows(l.rows);
    assert.ok(b.colours().size >= 3 && b.colours().size <= 6, `${l.n}: colours`);
    assert.deepEqual(floating(b), [], `${l.n}: nothing floating at the start`);
    assert.equal(b.lowest() < LIMIT - 2, true, `${l.n}: room above the deadline`);
    const mem = b.count((k) => k === MEMORY);
    assert.ok(['clear', 'memories'].includes(l.goal));
    assert.equal(mem, l.goal === 'memories' ? 3 : 0, `${l.n}: memories`);
    // a clear level never has a stone in its top row (nothing could ever take it down without a bomb)
    if (l.goal === 'clear') for (let c = 0; c < 11; c++) assert.notEqual(b.at(0, c)?.k, STONE, `${l.n}: a stone on the ceiling`);
    assert.ok(Number.isInteger(l.shots) && l.shots >= 10 && l.shots <= 70, `${l.n}: shots ${l.shots}`);
    assert.ok(l.stars[0] >= 1 && l.stars[0] <= l.stars[1] && l.stars[1] < l.shots, `${l.n}: stars ${l.stars}`);
    assert.ok([4, 5].includes(l.misses));
    for (const s of l.specials) assert.ok(['sort', 'wild', 'bomb'].includes(s));
    for (const [i, gift] of Object.entries(l.gifts)) assert.ok(Number(i) >= 0 && (['sort', 'wild', 'bomb'].includes(gift) || /^[a-f]$/.test(gift)));
    if (l.tip !== null) {
      const plain = l.tip.replace(/SORT|WILD|BOMB/g, '');
      assert.equal(plain, plain.toLowerCase(), `${l.n}: her voice, lowercase`);
      assert.ok(l.tip.length <= 60, `${l.n}: a short tip`);
    }
  }
  // one idea at a time: the SORT bubble by level 5, its first gift there; the meter off before it
  assert.deepEqual(LEVELS.slice(0, 4).map((l) => l.specials.length), [0, 0, 0, 0]);
  assert.equal(levelAt(5).gifts[0], 'sort');
  assert.ok(levelAt(9).goal === 'memories' && LEVELS.slice(0, 8).every((l) => l.goal === 'clear'), 'memories from level 9');
  assert.ok(LEVELS.slice(0, 5).every((l) => !l.rows.join('').includes('#')), 'stones from level 6');
  assert.ok(LEVELS.slice(0, 10).every((l) => !l.rows.join('').includes('*')), 'locked bubbles from level 11');
  assert.ok(LEVELS.slice(0, 20).every((l) => parseRows(l.rows).colours().size <= 5), 'six colours from bank 3');
  assert.ok(LEVELS.some((l) => parseRows(l.rows).colours().size === 6));
  // the stars: more shots left, more stars
  const d = levelAt(4);
  assert.equal(starsFor(d, 0), 1);
  assert.equal(starsFor(d, d.stars[0]), 2);
  assert.equal(starsFor(d, d.stars[1]), 3);
});

test('levels: the game\'s own player clears level 1 within its shots with seed 1, and every level with one of three seeds', () => {
  const g = autoplay(new Game({ mode: 'level', def: levelAt(1), seed: 1 }));
  assert.equal(g.status, 'won');
  assert.ok(g.fired <= levelAt(1).shots);
  assert.equal(g.board.count(), 0);
  for (const l of LEVELS) {
    let won = false;
    for (let seed = 1; seed <= 3 && !won; seed++) won = autoplay(new Game({ mode: 'level', def: l, seed })).status === 'won';
    assert.ok(won, `level ${l.n}: ${l.name}`);
  }
});

// ---------- Endless ----------
test('Endless: starts with six rows of four colours, more colours and fewer misses as rows come in, a slow timer later', () => {
  const g = new Game({ mode: 'endless', seed: 9 });
  assert.equal(g.board.lowest(), ENDLESS.startRows - 1);
  assert.ok(g.board.colours().size <= 4);
  assert.equal(g.board.wide(0), true);
  assert.deepEqual([0, 10, 30].map(ENDLESS.missLimit), [5, 4, 3]);
  assert.deepEqual([0, 15, 35].map(ENDLESS.palette), [4, 5, 6]);
  assert.equal(g.timerOn, false);
  assert.equal(g.tick(100), null, 'no timer yet');
  g.rows = ENDLESS.timerFrom;
  assert.equal(g.timerOn, true);
  const t = g.tick(ENDLESS.interval(g.rows) + 0.01);
  assert.ok(t && t.push && t.push.by === 'timer');
  // a nearly empty board fills up again at once
  const e = new Game({ mode: 'endless', seed: 3 });
  e.board = parseRows(['a a . . . . . . . . .']);
  e.queue = [1, 2];
  const res = e.fire(Math.atan2(LAUNCHER.y - e.board.y(0), e.board.x(0, 2) - LAUNCHER.x));
  assert.equal(res.allClear, true);
  assert.ok(res.refill.length >= 1);
  assert.ok(e.board.count() > 0);
  assert.equal(res.points, 30 + 2500);
});

test('Endless: the loaded bubble is always a colour still on the board', () => {
  const g = new Game({ mode: 'endless', seed: 21 });
  for (let i = 0; i < 40 && g.status === 'play'; i++) {
    const pick = chooseShot(g);
    if (pick.swap) g.swap();
    g.fire(pick.angle);
    const have = g.board.colours();
    for (const k of g.queue) if (isColor(k) && have.size) assert.ok(have.has(k), `shot ${i}: ${k}`);
  }
});

// ---------- the same seed, the same run ----------
test('determinism: the same seed plays the same run; the player picks the same shot for the same board', () => {
  const run = (seed) => {
    const g = new Game({ mode: 'endless', seed });
    const trail = [];
    for (let i = 0; i < 25 && g.status === 'play'; i++) {
      const p = chooseShot(g);
      if (p.swap) g.swap();
      const res = g.fire(p.angle);
      trail.push(`${p.angle.toFixed(6)}:${res.r},${res.c}:${res.points}`);
    }
    return { trail, score: g.score, rows: rowsOf(g.board).join('|') };
  };
  assert.deepEqual(run(7), run(7));
  assert.notDeepEqual(run(7).trail, run(8).trail);
  const g = new Game({ mode: 'level', def: levelAt(12), seed: 5 });
  assert.deepEqual(chooseShot(g), chooseShot(g));
  assert.deepEqual(endlessBoard(rng(3), 6, 4).rows.flat().map((x) => x?.k ?? 0), endlessBoard(rng(3), 6, 4).rows.flat().map((x) => x?.k ?? 0));
  // the player's own judgement: a pop beats a miss
  const b = new Game({ mode: 'level', def: levelAt(1), seed: 1 });
  const pick = chooseShot(b, { swap: false });
  assert.ok(pick.v > 0);
  assert.ok(value(b, b.loaded, trace(b.board, pick.angle)) === pick.v);
});

// ---------- the demo (the arcade's preview) ----------
test('the demo: mid-game, then a pop, the SORT bubble (a cascade), and a big drop, at their times in the recorded window', () => {
  assert.equal(DEMO_TIMES.length, 4);
  for (let i = 1; i < 4; i++) assert.ok(DEMO_TIMES[i] > DEMO_TIMES[i - 1]);
  assert.ok(DEMO_TIMES[1] < 5.7 && DEMO_TIMES[3] < 9, 'its big moments land between 5.7 and 11.7 s');
  const play = () => {
    const g = demoGame(0, 7);
    assert.ok(g.board.count() > 60, 'mid-game: a full board');
    const out = [];
    for (let i = 0; i < 4; i++) {
      const k = g.loaded;
      const p = chooseShot(g, { swap: false });
      const res = g.fire(p.angle);
      out.push({ k, pops: res.pops.length, drops: res.drops.length, sort: Boolean(res.sort) });
    }
    return out;
  };
  const shots = play();
  assert.equal(shots[1].k, SORT);
  assert.ok(shots[1].sort && shots[1].pops >= 8, 'the SORT cascade');
  assert.ok(shots[0].pops >= 3, 'a pop first');
  assert.ok(Math.max(shots[2].drops, shots[3].drops) >= 15, 'a mega drop');
  assert.deepEqual(play(), shots, 'the same every time');
  assert.equal(DEMO_BOARD.gifts[1], 'sort');
  // after it: Endless runs, a new one each time
  assert.notDeepEqual(rowsOf(demoGame(1, 7).board), rowsOf(demoGame(2, 7).board));
});

// ---------- words ----------
test('AGI-1\'s lines: lowercase, short, never money; the share words', () => {
  const all = Object.values(LINES).flat();
  assert.ok(all.length >= 25, `${all.length} lines`);
  for (const s of all) {
    assert.ok(s.length <= 80, s);
    assert.equal(s.replace(/SORT|WILD|BOMB|O\(n²\)/g, '').toLowerCase(), s.replace(/SORT|WILD|BOMB|O\(n²\)/g, ''), `lowercase: ${s}`);
    assert.doesNotMatch(s, /\$AGI|\binvest|\bprofit|\bprice\b|\bpump\b|\bdump\b|\bbuy\b|\bsell\b/i);
  }
  const roll = rng(1);
  for (let i = 0; i < 30; i++) assert.ok(LINES.drop.includes(line('drop', roll.next())));
  assert.equal(shareText({ drop: 23, score: 999 }), 'I dropped 23 bubbles at once in BUBBLE SORT on agi1.app 🫧💜');
  assert.equal(shareText({ drop: 3, score: 12345 }), 'I scored 12,345 in BUBBLE SORT on agi1.app 🫧💜');
});

test('its code: the kit\'s shell with its id, nothing from elsewhere, no money words (the arcade\'s checks, run early)', () => {
  const dir = new URL('../src/games/bubblesort/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
  const code = files.map((f) => readFileSync(new URL(f, dir), 'utf8')).join('\n');
  assert.match(code, /createShell\(\{[\s\S]{0,200}game: 'bubblesort'/);
  assert.doesNotMatch(code, /fetch\(\s*['"`]\/api|XMLHttpRequest|navigator\.sendBeacon|new WebSocket|Math\.random\(\)\s*\*\s*\w+\.length/);
  assert.doesNotMatch(code, /\beval\(|new Function\(|setAttribute\(\s*['"]style['"]|\.innerHTML\s*=/);
  assert.doesNotMatch(code, /https?:\/\/(?!x\.com\/intent|www\.w3\.org)/);
  const words = [...code.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]).join('\n');
  assert.doesNotMatch(words, /\$AGI|\binvest|\bprofit|\bfinancial advice\b(?! )|\bprice\b|\bpump\b|\bdump\b/i);
  // the pure parts stay pure: no page, no clock in the rules
  for (const f of ['grid.js', 'path.js', 'rules.js', 'ai.js', 'levels.js', 'demo.js']) {
    const src = readFileSync(new URL(f, dir), 'utf8').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(src, /\b(document|window|requestAnimationFrame|performance|localStorage)\b|Math\.random/, f);
  }
  const css = readFileSync(new URL('style.css', dir), 'utf8');
  for (const m of css.matchAll(/z-index:\s*(-?\d+)/g)) assert.ok(Number(m[1]) < 9000);
  assert.doesNotMatch(css, /url\(/);
});
