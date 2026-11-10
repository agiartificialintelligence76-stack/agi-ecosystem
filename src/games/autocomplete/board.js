// AUTOCOMPLETE (2026-11-09): the board of tiles (5 wide, 6 tall), made from seeded dice. Pure (no DOM).
//
// Every board, and every board after a refill, keeps words to find: at least 25 words, 12 of them words people know
// (AGI-1's vocabulary), one of those 6 letters or more. A refill that would break that draws its new tiles again (the
// same dice, so the same seed always gives the same game), then, rarely, a few old ones too.
import { drawTile } from './tiles.js';
import { solve, SIZE, COLS, ROWS } from './solver.js';

export const GUARANTEE = Object.freeze({ words: 25, common: 12, long: 6 });

// how good a board is: { ok, words (solve()'s map), common, long }
export function checkBoard(tiles, dict) {
  const words = solve(tiles, dict);
  let common = 0, long = 0;
  for (const w of words.keys()) {
    if (dict.rankOf(w) < 0) continue;
    common++;
    if (w.length >= GUARANTEE.long) long++;
  }
  return { ok: words.size >= GUARANTEE.words && common >= GUARANTEE.common && long > 0, words, common, long };
}

// a new board: { tiles, check }
export function newBoard(dict, rng, { attempts = 80 } = {}) {
  let best = null;
  for (let a = 0; a < attempts; a++) {
    const tiles = new Array(SIZE).fill(null);
    for (const i of rng.shuffle([...Array(SIZE).keys()])) tiles[i] = drawTile(tiles, rng);
    const check = checkBoard(tiles, dict);
    if (check.ok) return { tiles, check, attempts: a + 1 };
    if (!best || check.common > best.check.common) best = { tiles, check, attempts: a + 1 };
  }
  return best;
}

// take tiles away (cells), let the rest fall, drop new ones in from the top. → { tiles, moves: [{ id, from, to }],
// spawns: [{ id, to, from }] (rows: `from` above the board is negative), check, rerolls }
export function refill(tiles, removed, dict, rng, { keep = [] } = {}) {
  const next = tiles.slice();
  for (const i of removed) next[i] = null;
  const moves = [];
  for (let c = 0; c < COLS; c++) {
    const col = [];
    for (let r = ROWS - 1; r >= 0; r--) { const t = next[r * COLS + c]; if (t) col.push({ t, from: r }); }
    for (let r = ROWS - 1, k = 0; r >= 0; r--, k++) {
      const item = col[k];
      next[r * COLS + c] = item ? item.t : null;
      if (item && item.from !== r) moves.push({ id: item.t.id, from: item.from, to: r });
    }
  }
  const empty = [];
  for (let i = 0; i < SIZE; i++) if (!next[i]) empty.push(i);
  const fill = (cells) => { for (const i of cells) next[i] = drawTile(next, rng); };
  fill(empty);
  let check = checkBoard(next, dict), rerolls = 0;
  // still good? if not: the new tiles again, then a few old ones as well (never a glitch or a kept tile)
  for (let a = 0; !check.ok && a < 40; a++) {
    rerolls++;
    const cells = empty.slice();
    if (a >= 10) {
      const old = [];
      for (let i = 0; i < SIZE; i++) if (!empty.includes(i) && !next[i].glitch && !keep.includes(next[i].id)) old.push(i);
      rng.shuffle(old);
      cells.push(...old.slice(0, Math.min(old.length, 2 + Math.floor((a - 10) / 4))));
    }
    for (const i of cells) next[i] = null;
    fill(cells);
    check = checkBoard(next, dict);
  }
  // the new tiles at the top of a column drop in from above it, stacked in their order; an old tile drawn again (a
  // rare reroll) pops in where it is
  const spawns = [];
  for (let c = 0; c < COLS; c++) {
    const drops = [];
    for (let r = 0; r < ROWS; r++) {
      const i = r * COLS + c;
      if (empty.includes(i)) drops.push(r);
      else if (!tiles.includes(next[i])) spawns.push({ id: next[i].id, to: r, from: r, pop: true });
    }
    for (const r of drops) spawns.push({ id: next[r * COLS + c].id, to: r, from: r - drops.length - 0.35, pop: false });
  }
  return { tiles: next, moves, spawns, check, rerolls };
}

// a cell's column and row
export const rowOf = (i) => Math.floor(i / COLS);
export const colOf = (i) => i % COLS;
