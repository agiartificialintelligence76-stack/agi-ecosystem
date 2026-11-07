// EPOCHS: check every level's reference solution, and look for a shorter one (fewer moves in all, the same epochs):
// greedily drops single moves (waits first) while the solution still solves the level. Prints any improvement.
//   node tools/games/epochs/refs.mjs
import { LEVELS } from '../../../src/games/epochs/levels.js';
import { parseLevel, playSolution } from '../../../src/games/epochs/engine.js';

let bad = 0;
for (const def of LEVELS) {
  const L = parseLevel(def);
  const ok = (sol) => { const p = playSolution(L, sol); return p.won && p.epochs === def.sol.length; };
  if (L.problems.length) { console.log(`${def.id}: PROBLEMS ${L.problems.join('; ')}`); bad++; }
  if (!ok(def.sol)) { console.log(`${def.id}: reference FAILS: ${playSolution(L, def.sol).why}`); bad++; continue; }
  let sol = def.sol.slice();
  for (let pass = 0, again = true; again && pass < 20; pass++) {
    again = false;
    for (const prefer of ['W', null]) {
      for (let e = 0; e < sol.length; e++) {
        for (let i = sol[e].length - 1; i >= 0; i--) {
          if (prefer && sol[e][i] !== prefer) continue;
          const next = sol.slice();
          next[e] = sol[e].slice(0, i) + sol[e].slice(i + 1);
          if (ok(next)) { sol = next; again = true; }
        }
      }
    }
  }
  const before = def.sol.join('').length, after = sol.join('').length;
  const longest = Math.max(...def.sol.map((s) => s.length));
  console.log(`${def.id} ${def.name}: ok, ${def.sol.length} epochs, ${before} ticks (T ${def.T}, longest ${longest})${after < before ? `  → shorter (${after}): ${JSON.stringify(sol)}` : ''}`);
}
if (bad) process.exitCode = 1;
