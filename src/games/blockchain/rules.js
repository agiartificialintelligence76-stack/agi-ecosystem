// BLOCKCHAIN's rules (2026-11-08): the 8 × 8 board, its pieces, placing one, clearing full rows and columns, the score
// and the CHAIN. Pure: no page, no clock, no dice, so tests/blockchain.test.js runs every rule in Node.
//
// A run (its state, a drop, its end) is in ./run.js; the dealer of new trays in ./gen.js.

export const N = 8;
export const CELLS = N * N;

// the seven candy colors: a board cell holds its color's index + 1 (0 is empty)
export const COLORS = ['honey', 'pink', 'mint', 'violet', 'sky', 'coral', 'lime'];
const COLOR = Object.fromEntries(COLORS.map((c, i) => [c, i]));

// The pieces (no turning them, like the genre): drawn as little pictures, '#' a block. `weight` is how often the dealer
// picks it before the board's crowding and the run's length change that (./gen.js); `huge` ones are capped per tray.
const FAMILIES = [
  // family     color     weight (each shape)  huge   shapes
  ['dot', 'violet', 3, false, [['#']]],
  ['i2', 'lime', 7, false, [['##'], ['#', '#']]],
  ['i3', 'honey', 7, false, [['###'], ['#', '#', '#']]],
  ['i4', 'coral', 5, false, [['####'], ['#', '#', '#', '#']]],
  ['i5', 'pink', 3.5, true, [['#####'], ['#', '#', '#', '#', '#']]],
  ['o2', 'sky', 8, false, [['##', '##']]],
  ['o3', 'mint', 2.5, true, [['###', '###', '###']]],
  ['rect', 'violet', 3, true, [['###', '###'], ['##', '##', '##']]],
  ['corner', 'mint', 4.5, false, [['##', '#.'], ['##', '.#'], ['#.', '##'], ['.#', '##']]],
  ['bigl', 'sky', 2, true, [['###', '#..', '#..'], ['###', '..#', '..#'], ['#..', '#..', '###'], ['..#', '..#', '###']]],
  ['t', 'pink', 2.5, false, [['###', '.#.'], ['.#.', '###'], ['#.', '##', '#.'], ['.#', '##', '.#']]],
  ['sz', 'coral', 2, false, [['.##', '##.'], ['#.', '##', '.#'], ['##.', '.##'], ['.#', '##', '#.']]],
  ['l4', 'violet', 1.5, false, [['#.', '#.', '##'], ['.#', '.#', '##'], ['##', '#.', '#.'], ['##', '.#', '.#'],
    ['###', '#..'], ['###', '..#'], ['#..', '###'], ['..#', '###']]],
];
// pieces that get rarer as the run goes on (easy) and more common (awkward): the difficulty curve in ./gen.js
export const EASY = new Set(['dot', 'i2']);
export const AWKWARD = new Set(['sz', 't', 'l4', 'bigl', 'corner']);

function makePiece(family, color, weight, huge, rows, k) {
  const cells = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') cells.push([x, y]); }));
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
  return Object.freeze({
    id: `${family}-${k}`,
    family, color: COLOR[color], weight, huge, w, h, n: cells.length,
    cells: Object.freeze(cells.map((c) => Object.freeze(c))),
    offs: Object.freeze(cells.map(([x, y]) => y * N + x)),
  });
}
export const PIECES = Object.freeze(FAMILIES.flatMap(([family, color, weight, huge, shapes]) =>
  shapes.map((rows, k) => makePiece(family, color, weight, huge, rows, k))));
// its id: its family and which of its shapes (i2-0 is the flat one, i2-1 the upright one…)
export const PIECE = Object.freeze(Object.fromEntries(PIECES.map((p, i) => [p.id, i])));

export const emptyBoard = () => new Uint8Array(CELLS);
export const filled = (board) => { let n = 0; for (let i = 0; i < CELLS; i++) if (board[i]) n++; return n; };

// does piece p fit with its top-left at (x, y)?
export function fits(board, p, x, y) {
  if (x < 0 || y < 0 || x + p.w > N || y + p.h > N) return false;
  const o = y * N + x;
  const offs = p.offs;
  for (let i = 0; i < offs.length; i++) if (board[o + offs[i]]) return false;
  return true;
}
// how many places it fits (0: nowhere), and whether it fits anywhere at all
export function fitCount(board, p) {
  let n = 0;
  for (let y = 0; y + p.h <= N; y++) for (let x = 0; x + p.w <= N; x++) if (fits(board, p, x, y)) n++;
  return n;
}
export function fitsAnywhere(board, p) {
  for (let y = 0; y + p.h <= N; y++) for (let x = 0; x + p.w <= N; x++) if (fits(board, p, x, y)) return true;
  return false;
}

// the rows and columns that are full, as bit masks (bit r: row r; bit c: column c)
export function fullLines(board) {
  let rows = 0, cols = 0;
  for (let r = 0; r < N; r++) {
    let full = true;
    for (let c = 0; c < N; c++) if (!board[r * N + c]) { full = false; break; }
    if (full) rows |= 1 << r;
  }
  for (let c = 0; c < N; c++) {
    let full = true;
    for (let r = 0; r < N; r++) if (!board[r * N + c]) { full = false; break; }
    if (full) cols |= 1 << c;
  }
  return { rows, cols };
}
export const bits = (mask) => { const out = []; for (let i = 0; i < N; i++) if (mask & (1 << i)) out.push(i); return out; };
export const popcount = (mask) => { let n = 0; while (mask) { n += mask & 1; mask >>= 1; } return n; };

// Place p at (x, y) on `board` (changed in place) and clear what it fills: → { placed: [cell…], rows, cols (masks),
// lines, cleared: [{ i, c }…] (each cleared cell once, with the color it had) }. The caller checked fits() first.
export function apply(board, p, x, y, color = p.color) {
  const o = y * N + x, v = color + 1;
  const placed = p.offs.map((d) => o + d);
  for (const i of placed) board[i] = v;
  // only the rows and columns the piece touches can have become full
  let rows = 0, cols = 0;
  for (let r = y; r < y + p.h; r++) {
    let full = true;
    for (let c = 0; c < N; c++) if (!board[r * N + c]) { full = false; break; }
    if (full) rows |= 1 << r;
  }
  for (let c = x; c < x + p.w; c++) {
    let full = true;
    for (let r = 0; r < N; r++) if (!board[r * N + c]) { full = false; break; }
    if (full) cols |= 1 << c;
  }
  const cleared = [];
  if (rows || cols) {
    for (let i = 0; i < CELLS; i++) {
      if ((rows & (1 << ((i / N) | 0))) || (cols & (1 << (i % N)))) { cleared.push({ i, c: board[i] - 1 }); }
    }
    for (const { i } of cleared) board[i] = 0;
  }
  return { placed, rows, cols, lines: popcount(rows) + popcount(cols), cleared };
}

// ---------- the score and the CHAIN ----------
export const SCORE = Object.freeze({ perCell: 1, perCleared: 10, perfect: 300 });
export const CHAIN_GRACE = 2;     // a chain survives this many drops without a clear; the next one breaks it

// The chain after a drop: a clear adds a link (and refills the grace); a drop without one uses up grace, and the third in
// a row breaks it. → { chain, misses, broke }
export function nextChain(chain, misses, cleared) {
  if (cleared) return { chain: chain + 1, misses: 0, broke: false };
  if (chain <= 0) return { chain: 0, misses: 0, broke: false };
  const m = misses + 1;
  if (m > CHAIN_GRACE) return { chain: 0, misses: 0, broke: true };
  return { chain, misses: m, broke: false };
}
// the links left on the meter (3 full after a clear, one fewer for each drop without one; none without a chain)
export const linksLeft = (chain, misses) => (chain > 0 ? CHAIN_GRACE + 1 - misses : 0);
export const multiplier = (chain) => Math.max(1, chain);

// points for one drop: +1 a block placed; 10 a cleared block × the lines it cleared × the chain; +300 × chain for a
// perfect clear (the board empty after a clear)
export function points({ placed, cleared, lines, chain, perfect }) {
  const place = placed * SCORE.perCell;
  const clear = lines ? SCORE.perCleared * cleared * lines * multiplier(chain) : 0;
  const bonus = perfect ? SCORE.perfect * multiplier(chain) : 0;
  return { place, clear, bonus, total: place + clear + bonus };
}
