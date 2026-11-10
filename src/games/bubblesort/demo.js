// BUBBLE SORT's own runs for the screen: `?demo` (the arcade's preview, recorded 5.7 to 11.7 s after the page opens) and
// the title's board playing itself behind the logo. The demo starts mid-game on a board found by
// tools/games/bubblesort/demo-search.mjs: its first bubbles are given (a colour, the SORT bubble, two colours), so the
// player pops a cluster, lands the SORT (its rows hop into order, a cascade pops), pops again, and the meter's SORT then
// drops 31 at once, each at its time below. After that it plays on by itself, forever, a new run after each end.
import { rng } from '../kit/fx.js';
import { Game, endlessBoard } from './rules.js';

export const DEMO_BOARD = Object.freeze({ seed: 1736, rows: 9, gifts: Object.freeze({ 0: 'b', 1: 'sort', 2: 'c', 3: 'a' }) });
// when the first four shots fire (seconds after the page opened): the SORT lands at about 5.8 s, the big drop at about 10 s
export const DEMO_TIMES = Object.freeze([4.4, 5.45, 7.95, 9.05]);

export function demoGame(k = 0, seed = 7) {
  if (k === 0) {
    const g = new Game({ mode: 'endless', seed: 7, board: endlessBoard(rng(DEMO_BOARD.seed), DEMO_BOARD.rows, 4) });
    g.gifts = { ...DEMO_BOARD.gifts };
    g.queue = []; g.drawn = 0; g.refill();
    return g;
  }
  const s = ((seed * 7919 + k * 104729) >>> 0) || 1;
  return new Game({ mode: 'endless', seed: s, board: endlessBoard(rng(s), 8, 4) });
}
export function attractGame(seed) {
  return new Game({ mode: 'endless', seed, board: endlessBoard(rng(seed), 8, 4) });
}
