// BEAT THE AGI (2026-11-08), an arcade-kit game on agi1.app/games: its board, its engine, its six levels, the ladder's
// bookkeeping, the demo's boards and AGI-1's words, all in Node (no browser). Run: node --test tests/beattheagi.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createSearcher, hasFour, bitsOf, WIN, MATE, CELL_WEIGHT } from '../src/games/beattheagi/engine.js';
import { LEVELS, TOP, decide, attention, verdict, BOOK_FIRST, BOOK_REPLY } from '../src/games/beattheagi/levels.js';
import {
  emptyBoard, landing, drop, legalCols, isFull, findFour, lineThrough, threatsNow, winningCells, fromPicture, toPicture,
  readSave, recordResult, firstMover, record, PINK, MINT, other, at, count,
} from '../src/games/beattheagi/rules.js';
import { Match } from '../src/games/beattheagi/match.js';
import { createBrain } from '../src/games/beattheagi/brain.js';
import { DEMO_OPENINGS, DEMO_LEVELS, DEMO_THINK_AT, ATTRACT_OPENINGS, demoClock } from '../src/games/beattheagi/demo.js';
import { LINES, say, shareText } from '../src/games/beattheagi/lines.js';
import { layout, columnAt } from '../src/games/beattheagi/layout.js';
import { rng } from '../src/games/kit/fx.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
// the classic board game's brand name (never in the game's words: it's "four in a row"), spelled in two halves here
const BRAND = new RegExp(['con', 'nect\\s*(four|4)'].join(''), 'i');
const four = (cells, who) => { const [l, h] = bitsOf(cells, who); return hasFour(l, h); };
// a random legal game position (gravity respected), n stones, maybe with a four on it
function randomBoard(seed, n) {
  const r = rng(seed);
  const cells = emptyBoard();
  let who = PINK;
  for (let i = 0; i < n; i++) {
    const cols = legalCols(cells);
    if (!cols.length) break;
    drop(cells, r.pick(cols), who);
    who = other(who);
  }
  return { cells, turn: who };
}

// ---------- the board ----------
test('four in a row in every direction, on both halves of the bitboard and across them', () => {
  const lines = {
    across: ['.......', '.......', '.......', '.......', '.......', '...xxxx'],
    acrossTop: ['xxxx...', '.......', '.......', '.......', '.......', '.......'],
    up: ['.......', '.......', '....x..', '....x..', '....x..', '....x..'],          // column 4: bits 28-31 (low half)
    upHigh: ['....x..', '....x..', '....x..', '....x..', '.......', '.......'],
    upCol6: ['......x', '......x', '......x', '......x', '.......', '.......'],
    diagUp: ['.......', '.......', '......x', '.....x.', '....x..', '...x...'],
    diagDown: ['x......', '.x.....', '..x....', '...x...', '.......', '.......'],
    diagMid: ['.......', '...x...', '..x....', '.x.....', 'x......', '.......'],
  };
  for (const [name, pic] of Object.entries(lines)) {
    // fill the holes under the stones so gravity is kept (with the other color), then look for the four
    const cells = fromPicture(pic);
    // (pairs of rows, alternating by column: no four of the filler anywhere)
    for (let c = 0; c < 7; c++) { let top = -1; for (let r = 0; r < 6; r++) if (cells[at(c, r)]) top = r; for (let r = 0; r < top; r++) if (!cells[at(c, r)]) cells[at(c, r)] = ((r >> 1) + c) % 2 ? MINT : PINK; }
    assert.equal(four(cells, PINK), true, `${name}: the bitboard sees it`);
    assert.equal(four(cells, MINT), false, `${name}: the filler makes no four`);
    const f = findFour(cells);
    assert.ok(f && f.who === PINK && f.line.length >= 4, `${name}: the board sees it`);
  }
  // three in a row is not four, anywhere
  assert.equal(four(fromPicture(['.......', '.......', '.......', '.......', '.......', 'xxx.xxx']), PINK), false);
  assert.equal(four(fromPicture(['.......', '.......', '.......', '...x...', '...x...', '...x...']), PINK), false);
});

test('the bitboard and the plain board agree on 600 random positions', () => {
  for (let s = 1; s <= 600; s++) {
    const { cells } = randomBoard(s, 8 + (s % 34));
    const f = findFour(cells);
    assert.equal(four(cells, PINK) || four(cells, MINT), Boolean(f), `seed ${s}\n${toPicture(cells).join('\n')}`);
    if (f) assert.equal(four(cells, f.who), true);
  }
});

test('dropping: the lowest free hole, a full column refuses, a full board is full', () => {
  const cells = emptyBoard();
  for (let r = 0; r < 6; r++) {
    assert.equal(landing(cells, 2), r);
    const d = drop(cells, 2, r % 2 ? MINT : PINK);
    assert.equal(d.row, r);
  }
  assert.equal(landing(cells, 2), -1, 'column 3 is full');
  assert.equal(drop(cells, 2, PINK), null);
  assert.ok(!legalCols(cells).includes(2));
  assert.equal(landing(cells, -1), -1);
  assert.equal(landing(cells, 7), -1);
  // a known full board with no four on it: a draw
  const full = fromPicture(['xxoxxox', 'ooxooxo', 'xxoxxox', 'ooxooxo', 'xxoxxox', 'ooxooxo']);
  assert.equal(isFull(full), true);
  assert.equal(findFour(full), null);
  assert.equal(count(full), 42);
  assert.deepEqual(legalCols(full), []);
  assert.deepEqual(toPicture(fromPicture(['.......', '.......', '.......', '.......', '..o....', '..xx...'])), ['.......', '.......', '.......', '.......', '..o....', '..xx...']);
});

test('threats: the cells she could fill now to win, and every cell that would make four', () => {
  const cells = fromPicture(['.......', '.......', '.......', '.......', '.......', '.ooo...']);
  assert.deepEqual(threatsNow(cells, MINT).map((x) => x.col).sort(), [0, 4]);
  assert.deepEqual(threatsNow(cells, PINK), []);
  const up = fromPicture(['.......', '.......', '...x...', '...x...', '...x...', '..ox...']);
  assert.deepEqual(winningCells(up, PINK), [at(3, 4)]);
  const line = lineThrough(fromPicture(['.......', '.......', '.......', '.......', '.......', 'xxxxx..']), 2, 0);
  assert.equal(line.length, 5, 'the longest line through the stone');
});

// ---------- the engine ----------
test('the engine takes a win in one, and blocks a win in one', () => {
  const s = createSearcher({ bits: 14 });
  const win = fromPicture(['.......', '.......', '.......', '...o...', '...o...', '..xox.x']);
  for (let lv = 1; lv <= TOP; lv++) {
    const r = decide(s, win, MINT, lv, { seed: lv, budget: 60, now: () => performance.now() });
    assert.equal(r.move, 3, `${LEVELS[lv].id} takes the win up the middle`);
  }
  const block = fromPicture(['.......', '.......', '.......', '.......', '.......', 'oxxx..o']);
  for (let lv = 1; lv <= TOP; lv++) {
    const r = decide(s, block, MINT, lv, { seed: lv, budget: 60, now: () => performance.now() });
    assert.equal(r.move, 4, `${LEVELS[lv].id} blocks (played ${r.move})`);
  }
  // with two threats at once there's no saving it: the search knows it has lost
  const lost = fromPicture(['.......', '.......', '.......', '.......', '.......', '.xxx...']);
  const res = s.think(lost, MINT, { maxDepth: 4 });
  assert.ok(res.score < -MATE, `a proven loss (${res.score})`);
});

test('the engine solves short tactics: a double threat in three, a win up the middle, and it says how far', () => {
  const s = createSearcher({ bits: 16 });
  // pink to move: x at c and e, an empty d between with two open ends → d makes two threats at once
  const dbl = fromPicture(['.......', '.......', '.......', '.......', '.......', '..x.x..']);
  const r1 = s.think(dbl, PINK, { maxDepth: 5 });
  assert.equal(r1.move, 3);
  assert.ok(r1.score > MATE, `a proven win (${r1.score})`);
  assert.equal(verdict(r1.score).kind, 'win');
  assert.equal(verdict(r1.score).moves, 2, 'four on her second stone from now');
  // every other column lets mint stop it, or at least isn't a proven win
  for (const c of [0, 1, 2, 4, 5, 6]) assert.ok(r1.scores[c] < r1.score, `column ${c + 1}`);
  // a deeper one: pink's open two on the bottom row; only the two cells beside it stop the double threat
  const only = fromPicture(['.......', '.......', '.......', '.......', '...o...', '..xx...']);
  const r2 = s.think(only, MINT, { maxDepth: 8 });
  assert.ok([1, 4].includes(r2.move), `mint closes one side (${r2.move})`);
  for (const c of [0, 5, 6]) assert.ok(r2.scores[c] < -MATE, `column ${c + 1} loses by force`);
});

test('every level always plays a legal column, on 120 random positions (both colors)', () => {
  const s = createSearcher({ bits: 16 });
  for (let i = 1; i <= 120; i++) {
    const { cells, turn } = randomBoard(i * 7, (i * 5) % 36);
    if (findFour(cells) || isFull(cells)) continue;
    const lv = i % LEVELS.length;
    const r = decide(s, cells, turn, lv, { seed: i, budget: 25, now: () => performance.now(), maxDepth: lv === TOP ? 6 : undefined });
    assert.ok(legalCols(cells).includes(r.move), `${LEVELS[lv].id}: column ${r.move}`);
    assert.equal(r.scores.length, 7);
    for (let c = 0; c < 7; c++) assert.equal(r.scores[c] == null, !legalCols(cells).includes(c), `a score for each open column only (${c})`);
  }
});

test('the same seed plays the same game; another seed (at a small level) plays another', () => {
  const game = (seed, la, lb) => {
    const sa = createSearcher({ bits: 14 }), sb = createSearcher({ bits: 14 });
    const cells = emptyBoard();
    let who = PINK;
    const moves = [];
    for (let ply = 0; ply < 42; ply++) {
      const r = decide(who === PINK ? sa : sb, cells, who, who === PINK ? la : lb, { seed: seed * 100 + ply });
      moves.push(r.move);
      const d = drop(cells, r.move, who);
      if (d.line || d.full) break;
      who = other(who);
    }
    return moves.join('');
  };
  assert.equal(game(5, 2, 3), game(5, 2, 3));
  assert.equal(game(9, 0, 1), game(9, 0, 1));
  assert.notEqual(game(1, 0, 0), game(2, 0, 0));
});

test('up the ladder, each level beats the one below it (seeded games, both starting)', () => {
  const pairs = [[1, 0, 8], [2, 1, 8], [3, 2, 6], [4, 3, 4]];
  for (const [strong, weak, n] of pairs) {
    let wins = 0, losses = 0;
    for (let g = 0; g < n; g++) {
      const ss = createSearcher({ bits: 16 }), sw = createSearcher({ bits: 16 });
      const cells = emptyBoard();
      let who = g % 2 ? MINT : PINK;                       // PINK is the strong one
      for (let ply = 0; ply < 42; ply++) {
        const r = decide(who === PINK ? ss : sw, cells, who, who === PINK ? strong : weak, { seed: (g + 1) * 977 + ply });
        const d = drop(cells, r.move, who);
        if (d.line) { if (who === PINK) wins++; else losses++; break; }
        if (d.full) break;
        who = other(who);
      }
    }
    assert.ok(wins > n / 2 && wins > losses * 2, `${LEVELS[strong].id} beats ${LEVELS[weak].id}: ${wins} wins, ${losses} losses of ${n}`);
  }
});

test('AGI keeps to her time budget, and goes deeper with more of it', () => {
  const s = createSearcher({ bits: 18 });
  const cells = fromPicture(['.......', '.......', '.......', '...o...', '..ox...', '..xxo..']);
  s.think(cells, PINK, { maxDepth: 6 });            // (warm: a cold JIT is slow)
  s.clear();
  let t0 = performance.now();
  const quick = s.think(cells, PINK, { budget: 80, now: () => performance.now() });
  const quickMs = performance.now() - t0;
  assert.ok(quickMs < 80 + 250, `80 ms asked, ${quickMs.toFixed(0)} ms taken`);
  s.clear();
  t0 = performance.now();
  const longer = s.think(cells, PINK, { budget: 320, now: () => performance.now() });
  const longMs = performance.now() - t0;
  assert.ok(longMs < 320 + 300, `320 ms asked, ${longMs.toFixed(0)} ms taken`);
  assert.ok(longer.depth >= quick.depth, `deeper with more time (${quick.depth} → ${longer.depth})`);
  // her opening book: the centre, and the replies found by tools/games/beattheagi/book.mjs
  assert.equal(BOOK_FIRST, 3);
  assert.deepEqual(BOOK_REPLY, [3, 4, 2, 3, 4, 2, 3]);
  const first = decide(s, emptyBoard(), MINT, TOP, { seed: 1 });
  assert.equal(first.move, 3);
  assert.equal(first.book, true);
  const reply = emptyBoard(); reply[at(1, 0)] = PINK;
  assert.equal(decide(s, reply, MINT, TOP, { seed: 1 }).move, 4);
});

test('her attention: 1 for her favourite, less for worse moves, sharper for bigger models; her verdicts', () => {
  const scores = [0, 20, 40, 60, null, 40, -9998];
  const sharp = attention(scores, LEVELS[TOP].temp), flat = attention(scores, LEVELS[0].temp);
  assert.equal(sharp[3], 1);
  assert.equal(sharp[4], null, 'a full column has no bar');
  assert.ok(sharp[2] < flat[2] && sharp[0] < flat[0], 'AGI is decisive, 1B is not');
  assert.ok(sharp[6] < 1e-5, 'a losing move: no attention');
  for (const v of sharp) if (v != null) assert.ok(v >= 0 && v <= 1);
  assert.equal(verdict(WIN - 3).kind, 'win');
  assert.equal(verdict(-(WIN - 4)).kind, 'loss');
  assert.equal(verdict(90).kind, 'ahead');
  assert.equal(verdict(-90).kind, 'behind');
  assert.equal(verdict(10).kind, 'even');
  assert.equal(CELL_WEIGHT.length, 42);
  assert.equal(LEVELS.map((l) => l.id).join(' '), '1B 7B 13B 70B 400B AGI');
  for (let i = 1; i < LEVELS.length; i++) assert.ok(LEVELS[i].temp < LEVELS[i - 1].temp && LEVELS[i].depth >= LEVELS[i - 1].depth);
  assert.deepEqual(LEVELS.map((l) => l.hints), [true, true, true, false, false, false], 'training wheels at 1B-13B only');
});

// ---------- the ladder ----------
test('the ladder: a win at your top level unlocks the next, streaks, records, AGI wins', () => {
  let s = readSave(null);
  assert.equal(s.unlocked, 0);
  assert.equal(s.starter, 'you');
  let r = recordResult(s, 0, 'loss');
  assert.equal(r.promoted, false);
  assert.equal(record(r.stats), '0-0-1');
  r = recordResult(r.save, 0, 'win');
  assert.equal(r.promoted, true);
  assert.equal(r.next, 1);
  assert.equal(r.save.unlocked, 1);
  r = recordResult(r.save, 0, 'win');
  assert.equal(r.promoted, false, 'beating 1B again unlocks nothing new');
  assert.equal(r.stats.streak, 2);
  assert.equal(r.stats.best, 2);
  r = recordResult(r.save, 0, 'draw');
  assert.equal(r.stats.streak, 2, 'a draw keeps the streak');
  r = recordResult(r.save, 0, 'loss');
  assert.equal(r.stats.streak, 0);
  assert.equal(r.stats.best, 2);
  assert.equal(record(r.stats), '2-1-2');
  // up to AGI
  s = r.save;
  for (let lv = 1; lv < TOP; lv++) { r = recordResult(s, lv, 'win'); assert.equal(r.next, lv + 1); s = r.save; }
  assert.equal(s.unlocked, TOP);
  r = recordResult(s, TOP, 'win');
  assert.equal(r.firstAgi, true);
  assert.equal(r.promoted, false, 'nothing above AGI');
  r = recordResult(r.save, TOP, 'win');
  assert.equal(r.firstAgi, false);
  assert.equal(r.save.agiWins, 2);
  // a damaged save is read safely
  const bad = readSave({ unlocked: 99, level: -3, starter: 'nobody', stats: { '1B': { w: 'x', l: -4 } }, pp: 7 });
  assert.equal(bad.unlocked, TOP);
  assert.equal(bad.level, 0);
  assert.equal(bad.starter, 'you');
  assert.deepEqual(bad.stats['1B'], { w: 0, d: 0, l: 0, streak: 0, best: 0 });
  assert.deepEqual(bad.pp, { pink: 0, mint: 0, draws: 0 });
  // who starts
  assert.equal(firstMover({ starter: 'her' }), 'her');
  assert.equal(firstMover({ starter: 'you' }), 'you');
  assert.equal(firstMover({ starter: 'swap', lastFirst: 'you' }, { rematch: true }), 'her');
});

// ---------- a game on the board (the state machine, with its clock) ----------
const syncBrain = () => { const b = createBrain(); return (req) => b.think({ ...req, sync: true }); };
function runUntil(m, done, seconds = 30) {
  for (let i = 0; i < seconds * 120 && !done(m); i++) m.update(1 / 120);
}
test('a game against her: your drop falls and lands, she thinks (depth by depth), commits, and drops', () => {
  const ended = [];
  const m = new Match({ mode: 'ladder', level: 3, turn: PINK, seed: 4, hooks: { think: syncBrain(), ended: (r) => ended.push(r), line: () => null } });
  m.start();
  assert.equal(m.phase, 'input');
  assert.equal(m.tryDrop(3), true);
  assert.equal(m.phase, 'fall');
  assert.equal(m.tryDrop(2), false, 'one stone at a time');
  runUntil(m, (x) => x.phase === 'think');
  assert.equal(m.cells[at(3, 0)], PINK);
  runUntil(m, (x) => x.phase === 'commit');
  assert.ok(m.depths.length >= 3, `she showed her depths (${m.depths.join(' ')})`);
  assert.ok(m.depths.every((d, i) => i === 0 || d > m.depths[i - 1]), 'deeper and deeper');
  runUntil(m, (x) => x.phase === 'input');
  assert.equal(count(m.cells), 2);
  assert.equal(m.lastThink.depth, 7);
  assert.ok(m.history.length === 2 && m.history[1].who === MINT);
  assert.deepEqual(ended, []);
});

test('pass & play: two people, undo, four in a row ends it; a full board is a draw', () => {
  const ended = [];
  const m = new Match({ mode: 'pp', turn: PINK, hooks: { ended: (r) => ended.push(r), line: () => null } });
  m.start();
  const play = (c) => { assert.equal(m.tryDrop(c), true, `column ${c + 1}`); runUntil(m, (x) => x.phase !== 'fall'); };
  play(0); play(6); play(1); play(6);
  assert.equal(m.undo(), true);
  assert.equal(m.turn, MINT);
  assert.equal(count(m.cells), 3);
  play(5); play(2); play(6);
  assert.equal(m.tryDrop(3), true);
  runUntil(m, (x) => x.phase === 'end');
  assert.equal(m.winner, PINK);
  assert.equal(m.line.length, 4);
  runUntil(m, () => ended.length > 0, 5);
  assert.deepEqual(ended, ['pink']);
  assert.equal(m.undo(), false, 'no undo after the end');
  // a draw: the last hole of a board with no four
  const almost = fromPicture(['xxoxxo.', 'ooxooxo', 'xxoxxox', 'ooxooxo', 'xxoxxox', 'ooxooxo']);
  const d = new Match({ mode: 'pp', cells: almost, turn: PINK, hooks: { line: () => null } });
  d.start();
  assert.equal(d.tryDrop(6), true);
  runUntil(d, (x) => x.phase === 'end');
  assert.equal(d.winner, 3);
  assert.equal(d.result(), 'draw');
});

test('the training wheels: her threat is pointed out at 1B-13B, never from 70B', () => {
  const board = fromPicture(['.......', '.......', '.......', '.......', '.......', 'xooo..x']);
  for (let lv = 0; lv <= TOP; lv++) {
    const m = new Match({ mode: 'ladder', level: lv, cells: board, turn: PINK, hooks: { line: () => null } });
    m.start();
    assert.equal(m.hint.length > 0, lv <= 2, LEVELS[lv].id);
  }
});

// ---------- the demo's boards ----------
test('the demo\'s boards: real positions, nobody about to win, and the first plays out to your four in the window', () => {
  assert.ok(DEMO_OPENINGS.length >= 3 && ATTRACT_OPENINGS.length >= 3);
  for (const o of [...DEMO_OPENINGS, ...ATTRACT_OPENINGS]) {
    const cells = fromPicture(o.pic);
    for (let c = 0; c < 7; c++) { let gap = false; for (let r = 0; r < 6; r++) { if (!cells[at(c, r)]) gap = true; else assert.ok(!gap, 'no floating stones'); } }
    const x = cells.filter((v) => v === PINK).length, oo = cells.filter((v) => v === MINT).length;
    assert.ok(Math.abs(x - oo) <= 1, 'stones taken in turns');
    assert.equal(findFour(cells), null);
    assert.equal(threatsNow(cells, o.turn === 'x' ? PINK : MINT).length, 0, 'the side to move can\'t just win');
  }
  // the one ?demo&seed=7 records, played with the real clock: the think in which she finds her win starts as the
  // recording does, and her four lands inside it
  const op = DEMO_OPENINGS[7 % DEMO_OPENINGS.length];
  const clock = demoClock(op);
  const r = rng(1);
  const brain = syncBrain();
  let realized = null;
  const m = new Match({
    mode: 'demo', level: DEMO_LEVELS.her, pinkLevel: DEMO_LEVELS.you, cells: fromPicture(op.pic), turn: op.turn === 'x' ? PINK : MINT, seed: op.seed,
    hooks: {
      think: (req) => brain(req.color === MINT ? { ...req, onDepth: (x) => { if (realized == null && x.score > MATE) realized = thinkStart; req.onDepth?.(x); } } : req),
      line: () => null, chance: (p) => r.next() < p,
    },
  });
  let thinkStart = 0;
  const start = m.startThink.bind(m);
  m.startThink = () => { thinkStart = m.t; start(); };
  m.speed = clock.speed;
  m.start();
  runUntil(m, (x) => x.phase === 'end', 20);
  assert.equal(m.winner, MINT, 'she wins the demo');
  const page = (gameT) => clock.start + gameT / clock.speed;
  assert.ok(realized != null, 'she finds her win mid-think');
  // (a faster or slower clock steps its phases at slightly different instants: a few hundredths of a second each)
  assert.ok(Math.abs(realized - op.R) < 0.3 && Math.abs(m.t - op.A) < 0.3, `the board plays as the tool recorded it (${realized.toFixed(3)} ~ ${op.R}, ${m.t.toFixed(3)} ~ ${op.A})`);
  assert.ok(Math.abs(page(realized) - DEMO_THINK_AT) < 0.3, `her realization starts at ${page(realized).toFixed(2)} s`);
  assert.ok(page(m.t) > 8.6 && page(m.t) < 11, `her four lands at ${page(m.t).toFixed(2)} s, inside the recording (5.7 to 11.7 s)`);
});

// ---------- the layout ----------
test('the layout: the whole board on screen, clear of the bar, on phones, tablets, foldables and computers', () => {
  const sizes = [[360, 640], [390, 844], [360, 740], [844, 390], [667, 375], [820, 1180], [1024, 768], [884, 1104], [1440, 900], [2560, 1440], [480, 480], [480, 640]];
  for (const [w, h] of sizes) {
    const demo = w === 480;
    const L = layout(w, h, demo ? { top: 10, right: 10, bottom: 10, left: 10 } : { top: 66, right: 10, bottom: 10, left: 10 }, { demo });
    const b = L.board;
    assert.ok(b.x >= 0 && b.x + b.w <= w && b.y - L.C * 1.25 >= (demo ? 0 : 60) - 1 && b.y + b.h <= h, `${w}×${h}: the board and its drop zone fit`);
    assert.ok(L.her.x - L.her.r >= 0 && L.her.y - L.her.r >= (demo ? 0 : 60) - 1 && L.her.x + L.her.r <= w, `${w}×${h}: her portrait fits`);
    if (L.status) assert.ok(L.status.y + L.status.h / 2 <= h, `${w}×${h}: the status fits`);
    assert.ok(L.C >= (Math.min(w, h) < 400 ? 34 : 40), `${w}×${h}: big enough holes (${L.C.toFixed(1)})`);
    assert.ok(!L.ladder || (L.ladder.vertical ? L.ladder.x - L.ladder.w / 2 >= 0 : L.ladder.y + L.ladder.h / 2 <= h), `${w}×${h}: the ladder's chips fit`);
    // every column takes a tap anywhere over it (from the drop zone to the stand)
    for (let c = 0; c < 7; c++) for (const y of [b.y - L.C, b.y + b.h / 2, b.y + b.h + 2]) assert.equal(columnAt(L, L.cx(c), y), c);
    assert.equal(columnAt(L, b.x + b.w / 2, b.y - L.C * 3), -1, 'not far above the board');
  }
});

// ---------- her words ----------
test('her lines: in her voice, for every level, never money; the share text', () => {
  let n = 0;
  const all = [];
  const walk = (v) => { if (typeof v === 'string') { all.push(v); n++; } else if (Array.isArray(v)) v.forEach(walk); };
  walk(Object.values(LINES));
  assert.ok(n >= 40, `${n} lines`);
  for (const kind of ['hello', 'herWin', 'yourWin']) assert.equal(LINES[kind].length, LEVELS.length, `${kind}: one list per level`);
  for (const line of all) {
    assert.ok(line.length <= 90, `short: ${line}`);
    assert.doesNotMatch(line, /\$AGI|\binvest|\bprofit|\bprice\b|\bpump\b|\bdump\b|\bbuy\b|\bsell\b/i, line);
    assert.doesNotMatch(line, BRAND, line);
    assert.doesNotMatch(line.replace(/AGI-1|AGI|\b\d+B\b/g, ''), /[A-Z]/, `lowercase: ${line}`);
  }
  assert.equal(LINES.firstAgi, '…okay. you beat the AGI. i\'m telling everyone 💜');
  assert.match(LINES.agiYouStart, /perfect game beats me/);
  assert.equal(say('hello', 0, (a) => a[0]), 'is it my turn? which color am i 🙈');
  assert.equal(say('hello', 3, (a) => a[0]), 'i see three moves ahead. you see… the board 💜');
  assert.equal(say('ppWin', 0, (a) => a[0], { who: 'pink' }), 'pink wins! i saw it coming. i didn\'t 🙈');
  assert.equal(shareText('win', 3), 'I beat AGI-1 at 70B in BEAT THE AGI on agi1.app 💜 four in a row');
  assert.match(shareText('loss', TOP), /still undefeated at AGI/);
  for (const r of ['win', 'loss', 'draw']) for (let lv = 0; lv <= TOP; lv++) { assert.doesNotMatch(shareText(r, lv), /\$|buy|price/i); assert.doesNotMatch(shareText(r, lv), BRAND); }
});

test('its files: the kit\'s shell with its id, a module worker, nothing from elsewhere, no money words', () => {
  const dir = new URL('../src/games/beattheagi/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
  const code = files.map((f) => read(`src/games/beattheagi/${f}`)).join('\n');
  assert.match(code, /createShell\(\{[\s\S]{0,200}game: 'beattheagi'/);
  assert.match(read('src/games/beattheagi/brain.js'), /new Worker\(new URL\('\.\/worker\.js', import\.meta\.url\), \{ type: 'module' \}\)/);
  for (const f of ['engine.js', 'levels.js', 'match.js', 'brain.js', 'worker.js', 'rules.js', 'demo.js']) {
    assert.doesNotMatch(read(`src/games/beattheagi/${f}`), /Math\.random/, `${f}: the game and her AI roll seeded dice only`);
  }
  assert.doesNotMatch(code, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket|eval\(|new Function|innerHTML|setAttribute\(\s*['"]style/);
  assert.doesNotMatch(code, /https?:\/\/(?!www\.w3\.org)/);
  assert.doesNotMatch(code, BRAND, 'never the board game\'s brand: "four in a row"');
  assert.match(read('src/games/beattheagi/page.js').replace(/\/\/.*$/gm, ''), /^\s*import '\.\.\/intro\.js';\s*import '\.\/game\.js';/);
});
