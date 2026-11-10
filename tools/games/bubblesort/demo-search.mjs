// BUBBLE SORT's demo (the arcade's preview, 2026-11-09): finds a mid-game board for `?demo` where the game's own player,
// with the first bubbles given (a colour, then the SORT bubble, then two more colours), pops something, then lands the
// SORT for a cascade, then drops a big piece: the moments the 6-second preview should catch. Prints the best boards.
//   node tools/games/bubblesort/demo-search.mjs [--from 1] [--to 4000]
import { rng } from '../../../src/games/kit/fx.js';
import { Game, endlessBoard } from '../../../src/games/bubblesort/rules.js';
import { chooseShot } from '../../../src/games/bubblesort/ai.js';
import { rowsOf, SORT } from '../../../src/games/bubblesort/grid.js';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? Number(args[i + 1]) : d; };
const found = [];
for (let seed = opt('from', 1); seed <= opt('to', 4000); seed++) {
  for (const rows of [8, 9]) {
    const board = endlessBoard(rng(seed), rows, 4);
    for (const [x, y, z] of [[1, 2, 3], [2, 3, 1], [3, 1, 4], [4, 2, 1]]) {
      const g = new Game({ mode: 'endless', seed: 7, board: board.clone() });
      g.gifts = { 0: 'abcd'[x - 1], 1: 'sort', 2: 'abcd'[y - 1], 3: 'abcd'[z - 1] };
      g.queue = []; g.drawn = 0; g.refill();
      const shots = [];
      for (let i = 0; i < 4 && g.status === 'play'; i++) {
        const k = g.loaded;
        const pick = chooseShot(g, { swap: false });
        const res = g.fire(pick.angle);
        shots.push({ k, pops: res.pops.length, drops: res.drops.length, bounces: res.path.bounces, sort: Boolean(res.sort), special: res.special, left: g.board.count(), refill: res.refill.length });
      }
      if (shots.length < 4) continue;
      const [a, b, c, d] = shots;
      if (!b.sort || a.pops < 3 || b.pops < 8 || b.left < 30 || c.refill || d.refill) continue;
      const big = Math.max(c.drops, d.drops);
      if (big < 10) continue;
      const score = Math.min(30, b.pops) + Math.min(24, b.drops) * 1.5 + Math.min(30, big) * 2 + (c.bounces || d.bounces ? 4 : 0) - (a.drops > 8 ? 10 : 0);
      found.push({ seed, rows, gifts: g.gifts, score, shots });
    }
  }
}
found.sort((p, q) => q.score - p.score);
for (const f of found.slice(0, 6)) {
  console.log(JSON.stringify({ seed: f.seed, rows: f.rows, gifts: f.gifts, score: f.score }), f.shots.map((s) => `${s.k}:${s.pops}p/${s.drops}d${s.bounces ? '/b' : ''} (${s.left})`).join('  '));
  console.log(rowsOf(endlessBoard(rng(f.seed), f.rows, 4)).join('\n'));
}
