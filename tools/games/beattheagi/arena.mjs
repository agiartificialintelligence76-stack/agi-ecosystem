// BEAT THE AGI: a balance check. Plays the ladder's levels against each other (each pairing both ways round, seeded)
// and prints who won and how long each level took per move.
//   node tools/games/beattheagi/arena.mjs [games per pairing = 6] [AGI budget ms = 300]
import { createSearcher } from '../../../src/games/beattheagi/engine.js';
import { decide, LEVELS } from '../../../src/games/beattheagi/levels.js';
import { emptyBoard, drop, PINK, MINT, other } from '../../../src/games/beattheagi/rules.js';

const N = Number(process.argv[2] || 6);
const BUDGET = Number(process.argv[3] || 300);
const sa = createSearcher({ bits: 20 }), sb = createSearcher({ bits: 20 });
const time = {};

function game(la, lb, seed, aFirst) {
  const cells = emptyBoard();
  sa.clear(); sb.clear();
  let who = aFirst ? PINK : MINT;          // PINK is level a
  for (let ply = 0; ply < 42; ply++) {
    const lv = who === PINK ? la : lb;
    const t0 = performance.now();
    const res = decide(who === PINK ? sa : sb, cells, who, lv, { seed: seed * 977 + ply, budget: BUDGET, now: () => performance.now() });
    const dt = performance.now() - t0;
    (time[lv] ||= []).push(dt);
    const d = drop(cells, res.move, who);
    if (d.line) return who === PINK ? 'a' : 'b';
    if (d.full) return 'draw';
    who = other(who);
  }
  return 'draw';
}

const pairs = process.argv[4] ? JSON.parse(process.argv[4]) : [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]];
for (const [a, b] of pairs) {
  const tally = { a: 0, b: 0, draw: 0 };
  for (let g = 0; g < N; g++) tally[game(a, b, g + 1, g % 2 === 0)]++;
  console.log(`${LEVELS[a].id} vs ${LEVELS[b].id}: ${tally.a}-${tally.draw}-${tally.b} (W-D-L for ${LEVELS[a].id})`);
}
for (const [lv, ts] of Object.entries(time)) {
  ts.sort((x, y) => x - y);
  console.log(`${LEVELS[lv].id}: ${ts.length} moves, median ${ts[ts.length >> 1].toFixed(1)} ms, max ${ts[ts.length - 1].toFixed(1)} ms`);
}
