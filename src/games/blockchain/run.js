// BLOCKCHAIN's run (2026-11-08): its state, a drop and its end, on top of ./rules.js and ./gen.js. Pure and seeded:
// the same seed and the same drops make the same run (tests/blockchain.test.js).
//
//   const s = createGame({ seed: 7 });           a new run: an empty board and its first tray of three
//   const r = play(s, slot, x, y);               the piece in tray slot 0-2 with its top-left cell at (x, y), or null
//   r.points, r.rows, r.cols, r.cleared, r.chain, r.perfect, r.dealt, r.over …   (what the screen animates)
import { rng as dice } from '../kit/fx.js';
import { PIECES, emptyBoard, filled, fits, fitsAnywhere, fitCount, apply, nextChain, multiplier, points } from './rules.js';
import { dealTray } from './gen.js';

// createGame({ seed, board, tray, turn }) → the run's state. `board` (64 cells) and `tray` (piece numbers) may be given
// (the demo's opening, tests); otherwise an empty board and a dealt tray.
export function createGame({ seed = 1, board = null, tray = null, turn = 0, roll = null } = {}) {
  const s = {
    seed, rng: roll || dice((seed >>> 0) || 1), board: board ? Uint8Array.from(board) : emptyBoard(), turn,
    tray: [-1, -1, -1],
    score: 0, chain: 0, misses: 0, bestChain: 0, lines: 0, pieces: 0, perfects: 0, cleared: 0, biggest: 0,
    over: false,
  };
  if (tray) s.tray = [0, 1, 2].map((k) => (tray[k] == null ? -1 : tray[k]));
  else deal(s);
  s.over = stuck(s);
  return s;
}
export function deal(s) {
  s.tray = dealTray(s.board, s.rng, s.turn);
  s.turn++;
  return s.tray;
}
// the pieces still in the tray: [slot, piece]
export const inTray = (s) => s.tray.flatMap((t, slot) => (t >= 0 ? [[slot, PIECES[t]]] : []));
// no piece left in the tray fits anywhere: the run is over
export const stuck = (s) => inTray(s).every(([, p]) => !fitsAnywhere(s.board, p));
// how much room the tray has: the places its pieces fit, together (small: danger)
export const room = (s) => inTray(s).reduce((n, [, p]) => n + fitCount(s.board, p), 0);

// Drop the piece in `slot` with its top-left at (x, y): → what happened (for the screen), or null if it can't go there
export function play(s, slot, x, y) {
  if (s.over) return null;
  const t = s.tray[slot];
  if (t == null || t < 0) return null;
  const p = PIECES[t];
  if (!fits(s.board, p, x, y)) return null;
  const chainBefore = s.chain;
  const a = apply(s.board, p, x, y);
  const ch = nextChain(s.chain, s.misses, a.lines > 0);
  const perfect = a.lines > 0 && filled(s.board) === 0;
  const pts = points({ placed: a.placed.length, cleared: a.cleared.length, lines: a.lines, chain: ch.chain, perfect });
  s.tray[slot] = -1;
  s.chain = ch.chain;
  s.misses = ch.misses;
  s.bestChain = Math.max(s.bestChain, s.chain);
  s.score += pts.total;
  s.lines += a.lines;
  s.pieces++;
  s.cleared += a.cleared.length;
  s.biggest = Math.max(s.biggest, a.lines);
  if (perfect) s.perfects++;
  let dealt = false;
  if (s.tray.every((v) => v < 0)) { deal(s); dealt = true; }
  s.over = stuck(s);
  return {
    slot, piece: t, x, y, color: p.color,
    placed: a.placed, rows: a.rows, cols: a.cols, lines: a.lines, cleared: a.cleared,
    chain: s.chain, chainBefore, misses: s.misses, broke: ch.broke, mult: a.lines ? multiplier(s.chain) : 0,
    perfect, points: pts.total, parts: pts, dealt, over: s.over, score: s.score,
  };
}
