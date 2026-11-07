// EPOCHS: try draft levels against the solver (a scratch list; the real levels live in src/games/epochs/levels.js).
//   node tools/games/epochs/draft.mjs
import { parseLevel, playSolution } from '../../../src/games/epochs/engine.js';
import { solve, tidy } from './solve.mjs';

export function check(def, { maxK = def.K, maxStates } = {}) {
  const L = parseLevel(def);
  const out = [`${def.id} ${def.name}  ${L.w}x${L.h}  T=${def.T} K=${def.K}${L.problems.length ? `  PROBLEMS: ${L.problems.join('; ')}` : ''}`];
  for (let k = 1; k <= maxK; k++) {
    const t0 = Date.now();
    const r = solve(L, k, maxStates ? { maxStates } : {});
    const ms = Date.now() - t0;
    if (r.gaveUp) { out.push(`  k=${k}: gave up (${r.states} states, ${ms} ms)`); continue; }
    if (r.none) { out.push(`  k=${k}: none (${r.states} states, ${ms} ms)`); continue; }
    const sol = tidy(L, r.path);
    out.push(`  k=${k}: ${r.depth} ticks (${r.states} st, ${ms} ms) ${JSON.stringify(sol)} total ${sol.reduce((s, x) => s + x.length, 0)}`);
    break;
  }
  if (def.sol) {
    const p = playSolution(L, def.sol);
    out.push(`  ref: ${p.won ? `OK ${p.epochs} epochs ${p.ticks} ticks` : `FAILS ${p.why}`}`);
  }
  console.log(out.join('\n'));
}
