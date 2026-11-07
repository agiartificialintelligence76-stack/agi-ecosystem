// BEAT THE AGI (2026-11-08): the board as the game shows it, and the ladder's bookkeeping. Pure JavaScript (no DOM),
// tested in tests/beattheagi.test.js.
//
// `cells`: 42 numbers, index r * 7 + c, row 0 at the bottom; 0 empty, 1 pink (you, or the first player in pass &
// play), 2 mint (AGI-1, or the second player).
import { LEVELS, TOP } from './levels.js';

export const COLS = 7, ROWS = 6, CELLS = 42;
export const PINK = 1, MINT = 2;
export const other = (who) => (who === PINK ? MINT : PINK);
export const at = (c, r) => r * 7 + c;

export const emptyBoard = () => new Array(CELLS).fill(0);
// the row a stone dropped in `col` lands on (-1: the column is full)
export function landing(cells, col) {
  if (col < 0 || col >= COLS) return -1;
  for (let r = 0; r < ROWS; r++) if (!cells[at(col, r)]) return r;
  return -1;
}
export const legalCols = (cells) => [0, 1, 2, 3, 4, 5, 6].filter((c) => !cells[at(c, ROWS - 1)]);
export const isFull = (cells) => legalCols(cells).length === 0;
export const count = (cells) => cells.reduce((n, v) => n + (v ? 1 : 0), 0);

// The four (or more) in a row through cell (c, r) for its owner, longest first, as cell indexes in order along the
// line; null when there's none.
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
export function lineThrough(cells, c, r) {
  const who = cells[at(c, r)];
  if (!who) return null;
  let found = null;
  for (const [dx, dy] of DIRS) {
    const run = [at(c, r)];
    for (let k = 1; ; k++) {
      const x = c + dx * k, y = r + dy * k;
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS || cells[at(x, y)] !== who) break;
      run.push(at(x, y));
    }
    for (let k = 1; ; k++) {
      const x = c - dx * k, y = r - dy * k;
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS || cells[at(x, y)] !== who) break;
      run.unshift(at(x, y));
    }
    if (run.length >= 4 && (!found || run.length > found.length)) found = run;
  }
  return found;
}
// any four on the board: { who, line } or null
export function findFour(cells) {
  for (let i = 0; i < CELLS; i++) {
    if (!cells[i]) continue;
    const line = lineThrough(cells, i % 7, (i / 7) | 0);
    if (line) return { who: cells[i], line };
  }
  return null;
}

// Drop a stone: → { row, line (a four through it or null), full (the board is full) } or null if the column is full
export function drop(cells, col, who) {
  const row = landing(cells, col);
  if (row < 0) return null;
  cells[at(col, row)] = who;
  return { row, line: lineThrough(cells, col, row), full: isFull(cells) };
}

// The empty cells `who` could fill right now to make four (her threats, for the training wheels)
export function threatsNow(cells, who) {
  const out = [];
  for (const c of legalCols(cells)) {
    const r = landing(cells, c);
    cells[at(c, r)] = who;
    if (lineThrough(cells, c, r)) out.push({ col: c, row: r });
    cells[at(c, r)] = 0;
  }
  return out;
}
// Every empty cell (playable or not) that would make four for `who` (to see a threat being built)
export function winningCells(cells, who) {
  const out = [];
  for (let i = 0; i < CELLS; i++) {
    if (cells[i]) continue;
    cells[i] = who;
    if (lineThrough(cells, i % 7, (i / 7) | 0)) out.push(i);
    cells[i] = 0;
  }
  return out;
}

// A board from a picture (tests, the demo's openings): rows top first, '.' empty, 'x' pink, 'o' mint
export function fromPicture(rows) {
  const cells = emptyBoard();
  rows.forEach((row, i) => {
    const r = ROWS - 1 - i;
    [...row].forEach((ch, c) => { cells[at(c, r)] = ch === 'x' ? PINK : ch === 'o' ? MINT : 0; });
  });
  return cells;
}
export const toPicture = (cells) => Array.from({ length: ROWS }, (_, i) => {
  const r = ROWS - 1 - i;
  return Array.from({ length: COLS }, (_, c) => '.xo'[cells[at(c, r)]]).join('');
});

// ---------- the ladder's save ----------
// { unlocked: 0..5 (the highest level she'll play), level (the one picked), starter: 'you' | 'her' | 'swap',
//   stats: { [id]: { w, d, l, streak, best } }, agiWins, firstStarter }
export function readSave(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  const stats = {};
  for (const L of LEVELS) {
    const x = s.stats?.[L.id] || {};
    stats[L.id] = { w: num(x.w), d: num(x.d), l: num(x.l), streak: num(x.streak), best: num(x.best) };
  }
  const unlocked = Math.min(TOP, num(s.unlocked));
  return {
    unlocked,
    level: Math.min(unlocked, num(s.level ?? unlocked)),
    starter: ['you', 'her', 'swap'].includes(s.starter) ? s.starter : 'you',
    stats,
    agiWins: num(s.agiWins),
    lastFirst: s.lastFirst === 'her' ? 'her' : 'you',
    pp: { pink: num(s.pp?.pink), mint: num(s.pp?.mint), draws: num(s.pp?.draws) },
  };
}
function num(v) { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0; }

// A game at `level` ended ('win' | 'draw' | 'loss', from the player's side) → the new save and what changed
export function recordResult(save, level, result) {
  const s = readSave(save);
  const id = LEVELS[level].id;
  const st = s.stats[id];
  if (result === 'win') { st.w++; st.streak++; st.best = Math.max(st.best, st.streak); }
  else if (result === 'draw') { st.d++; }
  else { st.l++; st.streak = 0; }
  let promoted = false, firstAgi = false;
  if (result === 'win' && level === s.unlocked && level < TOP) { s.unlocked = level + 1; promoted = true; }
  if (result === 'win' && level === TOP) { firstAgi = s.agiWins === 0; s.agiWins++; }
  return { save: s, promoted, firstAgi, next: promoted ? level + 1 : null, stats: st };
}

// who starts the next game at this level: the player's choice, or turns
export function firstMover(save, { rematch = false } = {}) {
  const s = readSave(save);
  if (s.starter === 'you') return 'you';
  if (s.starter === 'her') return 'her';
  return rematch ? (s.lastFirst === 'you' ? 'her' : 'you') : s.lastFirst;
}
export const record = (st) => `${st.w}-${st.d}-${st.l}`;
