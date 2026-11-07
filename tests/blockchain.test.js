// BLOCKCHAIN (2026-11-08), an arcade-kit game on agi1.app/games: its rules, its dealer, its demo player, AGI-1's lines and
// its files, all in Node (no browser). Run: node --test tests/blockchain.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  N, CELLS, COLORS, PIECES, PIECE, emptyBoard, filled, fits, fitCount, fitsAnywhere, apply, fullLines, bits,
  nextChain, linksLeft, multiplier, points, SCORE, CHAIN_GRACE,
} from '../src/games/blockchain/rules.js';
import { dealTray, weightOf, canClear, DEAL } from '../src/games/blockchain/gen.js';
import { createGame, play, stuck, room, inTray, deal } from '../src/games/blockchain/run.js';
import { chooseMove, demoOpening, messyBoard, boardValue } from '../src/games/blockchain/ai.js';
import { LINES, END, END_BEST, say, endLine, shareText } from '../src/games/blockchain/lines.js';
import { rng } from '../src/games/kit/fx.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const P = (id) => PIECES[PIECE[id]];
// a board from a picture: '.' empty, a digit a color (1-7), '#' color 1
const board = (rows) => {
  const b = emptyBoard();
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') b[y * N + x] = ch === '#' ? 1 : Number(ch); }));
  return b;
};
const picture = (b) => Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => (b[y * N + x] ? '#' : '.')).join(''));
const shapeOf = (p) => Array.from({ length: p.h }, (_, y) => Array.from({ length: p.w }, (_, x) => (p.cells.some(([cx, cy]) => cx === x && cy === y) ? '#' : '.')).join(''));

// ---------- the pieces ----------
test('the pieces: every shape of the spec, no turning (each orientation its own piece), none twice', () => {
  const fam = (f) => PIECES.filter((p) => p.family === f);
  assert.equal(fam('dot').length, 1);
  for (const f of ['i2', 'i3', 'i4', 'i5']) {
    assert.equal(fam(f).length, 2, `${f}: flat and upright`);
    const n = Number(f[1]);
    assert.deepEqual(fam(f).map((p) => [p.w, p.h]).sort(), [[1, n], [n, 1]].sort(), f);
  }
  assert.deepEqual(shapeOf(P('o2-0')), ['##', '##']);
  assert.deepEqual(shapeOf(P('o3-0')), ['###', '###', '###']);
  assert.deepEqual(fam('rect').map(shapeOf), [['###', '###'], ['##', '##', '##']]);
  assert.equal(fam('corner').length, 4, 'small L (the 2 × 2 corner), four ways');
  assert.equal(fam('bigl').length, 4, 'big L, four ways');
  assert.equal(fam('t').length, 4, 'T, four ways');
  assert.equal(fam('sz').length, 4, 'S and Z, flat and upright');
  assert.ok(fam('corner').every((p) => p.n === 3) && fam('bigl').every((p) => p.n === 5) && fam('t').every((p) => p.n === 4));
  const seen = new Set(PIECES.map((p) => shapeOf(p).join('/')));
  assert.equal(seen.size, PIECES.length, 'no shape twice');
  assert.equal(new Set(PIECES.map((p) => p.id)).size, PIECES.length, 'unique ids');
  for (const p of PIECES) {
    assert.ok(p.w <= 5 && p.h <= 5 && p.n === p.cells.length && p.n === p.offs.length, p.id);
    assert.ok(p.color >= 0 && p.color < COLORS.length, `${p.id}: one of the seven colors`);
    assert.ok(p.weight > 0, p.id);
    // its box is tight: a block in its first and last row and column
    assert.ok([0, p.h - 1].every((y) => p.cells.some((c) => c[1] === y)) && [0, p.w - 1].every((x) => p.cells.some((c) => c[0] === x)), p.id);
  }
  assert.equal(COLORS.length, 7);
});

// ---------- fitting and placing ----------
test('fits: inside the board and only on empty cells', () => {
  const b = emptyBoard();
  const i5 = P('i5-0'), o3 = P('o3-0'), dot = P('dot-0');
  assert.ok(fits(b, i5, 0, 0) && fits(b, i5, 3, 7));
  assert.ok(!fits(b, i5, 4, 0), 'sticks out on the right');
  assert.ok(!fits(b, i5, -1, 0) && !fits(b, i5, 0, -1) && !fits(b, o3, 0, 6), 'off the board');
  assert.equal(fitCount(b, i5), 4 * 8);
  assert.equal(fitCount(b, o3), 36);
  assert.equal(fitCount(b, dot), CELLS);
  b[3 * N + 3] = 1;
  assert.ok(!fits(b, o3, 1, 1) && !fits(b, o3, 3, 3) && fits(b, o3, 4, 4));
  // a corner piece only needs its own blocks free, not its whole box
  const corner = P('corner-0');   // ##/#.
  assert.deepEqual(shapeOf(corner), ['##', '#.']);
  assert.ok(fits(b, corner, 2, 2), 'the empty corner of its box may sit on a block');
  assert.ok(fitsAnywhere(b, o3));
});

test('a drop fills its cells with its color, and full rows and columns clear together (each cell once)', () => {
  // row 2 and column 5 are missing only (5, 2): a dot there clears both, 15 cells
  const b = board([
    '.....1..',
    '.....2..',
    '7777.777',
    '.....3..',
    '.....4..',
    '.....5..',
    '.....6..',
    '.....7..',
  ]);
  b[2 * N + 4] = 1;
  const a = apply(b, P('dot-0'), 5, 2);
  assert.deepEqual(bits(a.rows), [2]);
  assert.deepEqual(bits(a.cols), [5]);
  assert.equal(a.lines, 2);
  assert.equal(a.cleared.length, 15, 'the crossing cell once');
  assert.equal(new Set(a.cleared.map((c) => c.i)).size, 15);
  assert.equal(filled(b), 0, 'nothing left');
  assert.ok(a.cleared.some((c) => c.i === 2 * N + 5 && c.c === P('dot-0').color), 'the dropped block clears too, in its color');
  // two rows at once with an upright domino
  const c = board(['........', '........', '........', '........', '........', '........', '1111111.', '2222222.']);
  const r = apply(c, P('i2-1'), 7, 6);
  assert.deepEqual([bits(r.rows), bits(r.cols), r.lines, r.cleared.length], [[6, 7], [], 2, 16]);
  // no line: nothing cleared, the piece stays
  const d = emptyBoard();
  const q = apply(d, P('t-0'), 2, 3, 4);
  assert.deepEqual([q.lines, q.cleared.length, filled(d)], [0, 0, 4]);
  assert.deepEqual(q.placed.sort((x, y) => x - y), [3 * N + 2, 3 * N + 3, 3 * N + 4, 4 * N + 3]);
  assert.ok(q.placed.every((i) => d[i] === 5), 'its color + 1 in each cell');
  assert.deepEqual(fullLines(d), { rows: 0, cols: 0 });
});

test('rows and columns in the same drop: a 3 × 3 square can clear three rows and three columns at once', () => {
  const b = emptyBoard();
  for (let i = 0; i < CELLS; i++) b[i] = 1 + (i % 7);
  for (let y = 2; y < 5; y++) for (let x = 2; x < 5; x++) b[y * N + x] = 0;
  const a = apply(b, P('o3-0'), 2, 2);
  assert.deepEqual([bits(a.rows), bits(a.cols), a.lines, a.cleared.length], [[2, 3, 4], [2, 3, 4], 6, 3 * 8 + 3 * 8 - 9]);
  assert.equal(filled(b), CELLS - 39);
});

// ---------- the score and the chain ----------
test('points: +1 a block placed; 10 a cleared block × lines × chain; +300 × chain for a perfect clear', () => {
  assert.deepEqual(points({ placed: 4, cleared: 0, lines: 0, chain: 0, perfect: false }), { place: 4, clear: 0, bonus: 0, total: 4 });
  assert.equal(points({ placed: 1, cleared: 8, lines: 1, chain: 1, perfect: false }).total, 1 + 80);
  assert.equal(points({ placed: 2, cleared: 16, lines: 2, chain: 1, perfect: false }).total, 2 + 320);
  assert.equal(points({ placed: 1, cleared: 15, lines: 2, chain: 3, perfect: false }).total, 1 + 10 * 15 * 2 * 3);
  assert.equal(points({ placed: 1, cleared: 8, lines: 1, chain: 4, perfect: true }).total, 1 + 320 + 1200);
  assert.deepEqual(SCORE, { perCell: 1, perCleared: 10, perfect: 300 });
  assert.equal(multiplier(0), 1);
  assert.equal(multiplier(5), 5);
});

test('the chain: each clear adds a link; it survives two drops without a clear, and the third breaks it', () => {
  assert.equal(CHAIN_GRACE, 2);
  let c = { chain: 0, misses: 0 };
  const step = (cleared) => { c = nextChain(c.chain, c.misses, cleared); return c; };
  assert.deepEqual(step(false), { chain: 0, misses: 0, broke: false }, 'no chain: nothing to break');
  assert.deepEqual(step(true), { chain: 1, misses: 0, broke: false });
  assert.equal(linksLeft(c.chain, c.misses), 3);
  assert.deepEqual(step(true), { chain: 2, misses: 0, broke: false });
  assert.deepEqual(step(false), { chain: 2, misses: 1, broke: false });
  assert.equal(linksLeft(c.chain, c.misses), 2);
  assert.deepEqual(step(false), { chain: 2, misses: 2, broke: false });
  assert.equal(linksLeft(c.chain, c.misses), 1);
  assert.deepEqual(step(true), { chain: 3, misses: 0, broke: false }, 'a clear in time keeps it, and refills it');
  step(false); step(false);
  assert.deepEqual(step(false), { chain: 0, misses: 0, broke: true }, 'the third drop without a clear breaks it');
  assert.equal(linksLeft(c.chain, c.misses), 0);
});

// a run with a board and tray we choose (the dealer's dice still come from the seed)
const rigged = (rows, tray, seed = 5) => createGame({ seed, board: board(rows), tray: tray.map((id) => (id ? PIECE[id] : -1)) });

test('a run: scoring with the chain, the multiplier on the clear that grows it, and a break after three misses', () => {
  const s = rigged([
    '1111111.', '2222222.', '........', '........', '........', '........', '........', '........',
  ], ['dot-0', 'dot-0', 'i2-1']);
  // the dot clears row 0: chain 1, ×1
  const a = play(s, 0, 7, 0);
  assert.equal(a.lines, 1);
  assert.equal(a.chain, 1);
  assert.equal(a.points, 1 + 80);
  assert.equal(a.mult, 1);
  // a drop without a clear: the chain holds, one link gone
  const b = play(s, 1, 0, 5);
  assert.deepEqual([b.lines, b.chain, b.misses, b.points], [0, 1, 1, 1]);
  assert.equal(s.score, 81 + 1);
  // the upright domino can't clear row 1 now (row 0 is empty): it fits at (7, 1) and fills (7, 1) and (7, 2)
  const c = play(s, 2, 7, 1);
  assert.equal(c.lines, 1, 'row 1');
  assert.deepEqual([c.chain, c.mult, c.points], [2, 2, 2 + 10 * 8 * 1 * 2]);
  assert.ok(c.dealt, 'the last piece of the tray: a new tray of three');
  assert.equal(s.tray.filter((t) => t >= 0).length, 3);
  assert.equal(s.pieces, 3);
  assert.equal(s.lines, 2);
  assert.equal(s.bestChain, 2);
});

test('three drops in a row without a clear break the chain (and the meter says so)', () => {
  const s = rigged(['1111111.', '........', '........', '........', '........', '........', '........', '........'], ['dot-0', 'dot-0', 'dot-0']);
  play(s, 0, 7, 0);
  assert.equal(s.chain, 1);
  s.tray = [PIECE['dot-0'], PIECE['dot-0'], PIECE['dot-0']];
  const m1 = play(s, 0, 0, 7), m2 = play(s, 1, 2, 7), m3 = play(s, 2, 4, 7);
  assert.deepEqual([m1.broke, m2.broke, m3.broke], [false, false, true]);
  assert.deepEqual([m1.chain, m2.chain, m3.chain], [1, 1, 0]);
  assert.equal(m3.chainBefore, 1);
  assert.equal(s.bestChain, 1);
});

test('a perfect clear: the board empty after a clear, +300 × chain, counted', () => {
  const s = rigged(['........', '........', '........', '........', '........', '........', '........', '3333.333'], ['dot-0', 'i2-0', null]);
  const r = play(s, 0, 4, 7);
  assert.ok(r.perfect);
  assert.equal(filled(s.board), 0);
  assert.equal(r.points, 1 + 80 + 300 * 1);
  assert.equal(s.perfects, 1);
  // not perfect: something is left
  const t = rigged(['1.......', '........', '........', '........', '........', '........', '........', '3333.333'], ['dot-0', 'i2-0', null]);
  assert.equal(play(t, 0, 4, 7).perfect, false);
});

test('game over: when no piece left in the tray fits anywhere; a drop that isn\'t allowed changes nothing', () => {
  // a checkerboard of holes: only single blocks fit
  const rows = Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => ((x + y) % 2 ? '1' : '.')).join(''));
  const s = rigged(rows, ['o2-0', 'i3-0', 'corner-0']);
  assert.equal(stuck(s), true);
  assert.equal(s.over, true);
  assert.equal(room(s), 0);
  assert.equal(play(s, 0, 0, 0), null, 'nothing is played once it\'s over');
  // the same board with a dot in the tray: not over, and the dot has 32 places
  const t = rigged(rows, ['o2-0', 'dot-0', null]);
  assert.equal(t.over, false);
  assert.equal(room(t), 32);
  assert.equal(play(t, 0, 0, 0), null, 'a piece where it doesn\'t fit: refused');
  assert.equal(play(t, 2, 0, 0), null, 'an empty slot: refused');
  const before = picture(t.board).join('/');
  assert.equal(play(t, 1, 1, 0), null, 'a block on a block: refused');
  assert.equal(picture(t.board).join('/'), before);
  // the dot fills a hole without a clear, and the domino still fits nowhere: over
  const r = play(t, 1, 0, 0);
  assert.ok(r && r.over && t.over);
  assert.deepEqual(inTray(t).map(([slot, p]) => [slot, p.id]), [[0, 'o2-0']]);
});

// ---------- the dealer ----------
test('the dealer: every new tray has a piece that fits, even on a crowded board', () => {
  const roll = rng(1234);
  let checked = 0;
  for (let k = 0; k < 400; k++) {
    // random boards from nearly empty to nearly full (no full lines)
    const b = messyBoard(roll, 0.1 + roll.next() * 0.55);
    // and some single holes punched in a full board
    if (k % 5 === 0) { b.fill(1); for (let r = 0; r < N; r++) b[r * N + roll.int(0, N - 1)] = 0; }
    for (const turn of [0, 3, 10, 50]) {
      const tray = dealTray(b, roll, turn);
      assert.equal(tray.length, 3);
      assert.ok(tray.every((t) => Number.isInteger(t) && t >= 0 && t < PIECES.length));
      assert.ok(tray.some((t) => fitsAnywhere(b, PIECES[t])), `a piece fits:\n${picture(b).join('\n')}`);
      const huge = tray.filter((t) => PIECES[t].huge).length;
      assert.ok(huge <= (turn < DEAL.earlyTurns ? DEAL.hugeEarly : DEAL.hugeLater), 'never too many huge pieces');
      checked++;
    }
  }
  assert.equal(checked, 1600);
});

test('the dealer: a crowded board gets smaller pieces, and the run grows harder slowly', () => {
  const avg = (fill, turn) => {
    const ws = PIECES.map((p) => weightOf(p, fill, turn));
    const total = ws.reduce((a, b) => a + b, 0);
    return PIECES.reduce((s, p, i) => s + p.n * ws[i], 0) / total;
  };
  assert.ok(avg(0.7, 0) < avg(0.5, 0) && avg(0.5, 0) < avg(0.1, 0), 'smaller as it fills');
  // the same draws, seen on many trays: an empty board's pieces are bigger than a crowded one's
  const roll = rng(99);
  const size = (b) => { let n = 0; for (let k = 0; k < 300; k++) n += dealTray(b, roll, 5).reduce((s, t) => s + PIECES[t].n, 0); return n / 900; };
  const crowded = board(['111.11.1', '1.1111.1', '11.1.111', '1111.11.', '.1.11111', '11111.11', '1.1.1111', '111111.1']);
  assert.ok(size(crowded) < size(emptyBoard()) - 0.5);
  // later trays: fewer single blocks and dominoes, more awkward shapes
  const share = (turn, fams) => {
    const ws = PIECES.map((p) => weightOf(p, 0.2, turn));
    const t = ws.reduce((a, b) => a + b, 0);
    return PIECES.reduce((s, p, i) => s + (fams.includes(p.family) ? ws[i] : 0), 0) / t;
  };
  assert.ok(share(60, ['dot', 'i2']) < share(0, ['dot', 'i2']));
  assert.ok(share(60, ['sz', 't', 'l4']) > share(0, ['sz', 't', 'l4']));
});

test('the dealer: never three huge pieces early, and the first trays hold at most one', () => {
  const roll = rng(4242);
  for (let k = 0; k < 2000; k++) {
    const tray = dealTray(emptyBoard(), roll, k % 6);
    assert.ok(tray.filter((t) => PIECES[t].huge).length <= 1);
  }
});

test('canClear: whether a piece can finish a line somewhere', () => {
  const b = board(['1111111.', '........', '........', '........', '........', '........', '........', '........']);
  assert.ok(canClear(b, PIECE['dot-0']));
  assert.ok(canClear(b, PIECE['i2-1']));
  assert.ok(!canClear(b, PIECE['o3-0']), 'a 3 × 3 can\'t reach the gap without covering a block');
  assert.ok(!canClear(emptyBoard(), PIECE['i5-0']));
});

// ---------- the same seed, the same run ----------
test('determinism: the same seed deals the same trays and the demo player plays the same run', () => {
  const runOf = (seed, drops = 120) => {
    const s = createGame({ seed });
    const log = [s.tray.join(',')];
    for (let i = 0; i < drops && !s.over; i++) {
      const m = chooseMove(s);
      const r = play(s, m.slot, m.x, m.y);
      log.push(`${m.slot}@${m.x},${m.y}:${r.points}:${s.tray.join(',')}`);
    }
    return { log: log.join('|'), score: s.score, over: s.over };
  };
  const a = runOf(7), b = runOf(7), c = runOf(8);
  assert.equal(a.log, b.log);
  assert.equal(a.score, b.score);
  assert.notEqual(a.log, c.log);
  // trays alone
  const t1 = createGame({ seed: 31 }), t2 = createGame({ seed: 31 });
  for (let i = 0; i < 20; i++) assert.deepEqual(deal(t1), deal(t2));
});

// ---------- the demo player ----------
test('the demo player: only drops that fit, takes an obvious clear, plays a long run to its end', () => {
  const s = rigged(['1111111.', '1111111.', '........', '........', '........', '........', '........', '........'], ['o2-0', 'i2-1', 'dot-0']);
  const m = chooseMove(s);
  assert.deepEqual([m.slot, m.x, m.y], [1, 7, 0], 'the upright domino in the gap: two rows');
  const g = createGame({ seed: 3 });
  let drops = 0, clears = 0;
  while (!g.over && drops < 5000) {
    const mv = chooseMove(g);
    assert.ok(mv && fits(g.board, PIECES[g.tray[mv.slot]], mv.x, mv.y));
    const r = play(g, mv.slot, mv.x, mv.y);
    if (r.lines) clears++;
    drops++;
  }
  assert.ok(drops >= 40, `it lasts (${drops} drops)`);
  assert.ok(clears / drops > 0.3, 'it clears often');
  assert.equal(chooseMove(rigged(Array(8).fill('1.1.1.1.'), ['o2-0', null, null])), null, 'nothing fits: no move');
  assert.ok(Number.isFinite(boardValue(emptyBoard())) && boardValue(emptyBoard()) > boardValue(messyBoard(rng(1), 0.5)));
});

test('the demo\'s opening: half full, no full line, and its very first drop clears (fireworks at once)', () => {
  for (const seed of [1, 2, 3, 7, 19]) {
    const o = demoOpening(seed);
    const n = filled(o.board);
    assert.ok(n >= CELLS * 0.3 && n <= CELLS * 0.6, `seed ${seed}: ${n} blocks`);
    assert.deepEqual(fullLines(o.board), { rows: 0, cols: 0 });
    const s = createGame({ seed: o.seed, board: o.board });
    const mv = chooseMove(s);
    assert.ok(play(s, mv.slot, mv.x, mv.y).lines >= 1, `seed ${seed}: the first drop clears`);
    // and the same seed, the same opening
    assert.deepEqual(demoOpening(seed), o);
  }
});

// ---------- AGI-1's words ----------
const MONEY = /\b(?:buy|sell|price|profit|gains?|invest\w*|pump|dump|moon|token|coin|wallet|dollars?|cash|money|lambo|hodl|\$[A-Za-z])\b|\$/i;
test('AGI-1\'s lines: her voice (lowercase, short), no money talk, PG-13; one for every score and every moment', () => {
  const all = [...Object.values(LINES).flat(), ...END.flatMap(([, l]) => l), ...END_BEST];
  assert.ok(all.length >= 20, `${all.length} lines`);
  const onBoard = new Set(Object.values(LINES).flat());
  for (const line of all) {
    assert.equal(line, line.toLowerCase(), `lowercase: ${line}`);
    assert.ok(line.length <= (onBoard.has(line) ? 42 : 60), `short enough for the board, or the end card: ${line}`);
    assert.doesNotMatch(line, MONEY, line);
    assert.doesNotMatch(line, /\b(?:sexy|hot|naked|kiss me|bed)\b/i, line);
  }
  for (const k of ['start', 'first', 'chain', 'bigChain', 'multi', 'huge', 'perfect', 'danger', 'broke', 'best']) assert.ok(LINES[k].length >= 2, k);
  assert.ok(LINES.chain.includes('chain\'s alive, keep feeding it 💜'));
  assert.ok(LINES.perfect.includes('a perfect clear?? marry me (jk… unless)'));
  assert.ok(LINES.danger.includes('babe there\'s no room 🙈'));
  assert.equal(say('chain', 7, (a) => a[1]), '×7?? don\'t you dare stop');
  assert.ok(END.every(([, l], i) => l.length >= 2 && (i === 0 || END[i - 1][0] < END[i][0])));
  assert.equal(endLine(100, false), END[0][1][0]);
  assert.equal(endLine(1e9, false), END.at(-1)[1][0]);
  assert.equal(endLine(5, true), END_BEST[0]);
});

test('the share post: the spec\'s words, the player\'s numbers, no money talk', () => {
  const t = shareText({ lines: 1284, bestChain: 7, score: 12345 });
  assert.equal(t, 'I confirmed 1,284 blocks with a ×7 chain in BLOCKCHAIN on agi1.app 💜 12,345 points');
  assert.doesNotMatch(t.replace('agi1.app', ''), MONEY);
  assert.match(shareText({ lines: 0, bestChain: 0, score: 0 }), /×1 chain/);
});

// ---------- its files ----------
const FILES = readdirSync(new URL('../src/games/blockchain/', import.meta.url)).filter((f) => /\.(js|css)$/.test(f));
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
test('its files: the intro first; the site\'s CSP (no inline styles, eval, string timers or other sites); pure rules', () => {
  const page = read('src/games/blockchain/page.js');
  const imports = [...page.matchAll(/^import\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  assert.equal(imports[0], '../intro.js');
  for (const f of FILES) {
    const s = code(read(`src/games/blockchain/${f}`));
    assert.doesNotMatch(s, /\beval\s*\(|new\s+Function\b|set(?:Timeout|Interval)\(\s*['"`]/, `${f}: no eval`);
    assert.doesNotMatch(s, /setAttribute\(\s*['"]style|style\s*=\s*["'`]|innerHTML|outerHTML|insertAdjacentHTML|document\.write/, `${f}: no inline styles or HTML strings`);
    assert.doesNotMatch(s, /https?:\/\/(?!agi1\.app)|\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|@import/, `${f}: nothing from another site, no calls`);
    assert.doesNotMatch(s, /localStorage|sessionStorage|indexedDB/, `${f}: keeps things only through the kit's store`);
  }
  // the rules, the dealer, the run, the player and her lines: no page, no clock, no Math.random
  for (const f of ['rules.js', 'gen.js', 'run.js', 'ai.js', 'lines.js']) {
    const s = code(read(`src/games/blockchain/${f}`));
    assert.doesNotMatch(s, /\b(?:window|document|navigator|performance|requestAnimationFrame|matchMedia)\b|Math\.random|Date\.now|new Date\b/, `${f}: pure`);
  }
  const css = read('src/games/blockchain/style.css');
  for (const m of css.matchAll(/z-index:\s*(-?\d+)/g)) assert.ok(Number(m[1]) < 1000, 'under the intro and the kit\'s cards');
});
