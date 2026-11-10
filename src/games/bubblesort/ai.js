// BUBBLE SORT: its own player (the demo, the title's live board, the level checker and the tests). For each of 181
// angles (and with the next bubble swapped in), it traces the exact path, lands it on a copy of the board, and scores
// what happens: pops, drops (worth four pops each), memories freed, the goal met; minus the risk of sitting low, a miss
// that brings the stack down, a special wasted. Pure and deterministic: the same board, the same choice.
import { trace, MIN_ANGLE, MAX_ANGLE } from './path.js';
import { resolve } from './rules.js';
import { LIMIT, MEMORY, isColor, isSpecial } from './grid.js';

const STEPS = 181;
export const ANGLES = Array.from({ length: STEPS }, (_, i) => MIN_ANGLE + ((MAX_ANGLE - MIN_ANGLE) * i) / (STEPS - 1));

// how good it is to land kind `k` where `p` (a traced path) lands, on `game`'s board
export function value(game, k, p) {
  const b = game.board.clone();
  const res = resolve(b, p.cell.r, p.cell.c, k);
  const popped = res.pops.length + res.broken.length;
  let v = popped + res.drops.length * 4 + res.freed * 40 + res.cracked.length * 1.5;
  // drops are worth more the more of them (the score doubles each)
  if (res.drops.length >= 6) v += res.drops.length * 2;
  const left = b.count();
  if (game.mode === 'level') {
    if (game.goal === 'clear' && left === 0) v += 1000;
    if (game.goal === 'memories' && game.freed + res.freed >= game.memTotal) v += 1000;
    // memories still up: being under them (holding them up) is good to pop
    if (game.goal === 'memories' && popped) v += 0.5 * res.drops.filter((d) => d.k === MEMORY).length;
  }
  if (!popped) {
    // no pop: a good place sits next to its own colour (two now, three next time) and doesn't hide others
    if (isColor(k)) {
      const nb = b.neighbours(p.cell.r, p.cell.c, []);
      let same = 0;
      for (let j = 0; j < nb.length; j += 2) if (b.rows[nb[j]][nb[j + 1]]?.k === k) same++;
      v += same * 0.6 - 0.2;
    }
    if (!isSpecial(k)) v -= game.misses + 1 >= game.missLimit ? 2.5 : 0.4;
    else v -= 4;   // a special that does nothing: wasted
  }
  // low means danger (the deadline)
  const low = b.lowest();
  if (low >= LIMIT - 4) v -= (low - (LIMIT - 5)) * 1.6;
  if (b.overflow()) v -= 5000;
  return v;
}

// → { angle, swap, v, cell } (the middle of the run of angles that land in the best cell: an aim that isn't on a knife's
// edge), or null when there's nothing to fire
export function chooseShot(game, { swap = true, angles = ANGLES } = {}) {
  if (game.status !== 'play' || !game.loaded) return null;
  const kinds = [game.loaded];
  if (swap && game.next && game.next !== game.loaded) kinds.push(game.next);
  let best = null;
  for (let ki = 0; ki < kinds.length; ki++) {
    const k = kinds[ki];
    const memo = new Map();
    let run = null;
    const close = () => {
      if (!run) return;
      const mid = run.i0 + Math.floor((run.i1 - run.i0) / 2);
      const width = run.i1 - run.i0 + 1;
      // the same value: the wider run wins (an easier aim), then the loaded bubble (no swap)
      if (!best || run.v > best.v + 1e-9 || (Math.abs(run.v - best.v) <= 1e-9 && ki === best.ki && width > best.width)) {
        best = { angle: angles[mid], swap: ki === 1, v: run.v, cell: run.cell, width, ki };
      }
      run = null;
    };
    for (let i = 0; i < angles.length; i++) {
      const p = trace(game.board, angles[i]);
      const id = p.cell.r * 16 + p.cell.c;
      let v = memo.get(id);
      if (v === undefined) { v = value(game, k, p); memo.set(id, v); }
      if (run && run.id === id) run.i1 = i;
      else { close(); run = { id, i0: i, i1: i, v, cell: p.cell }; }
    }
    close();
  }
  return best && { angle: best.angle, swap: best.swap, v: best.v, cell: best.cell };
}

// plays a whole run to its end (the tests, the level checker): → the game
export function autoplay(game, { maxShots = 400, swap = true } = {}) {
  for (let n = 0; n < maxShots && game.status === 'play'; n++) {
    const pick = chooseShot(game, { swap });
    if (!pick) break;
    if (pick.swap) game.swap();
    game.fire(pick.angle);
  }
  return game;
}
