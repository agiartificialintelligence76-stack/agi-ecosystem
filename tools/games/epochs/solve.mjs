// EPOCHS level checker (2026-11-08). For each level: the fewest epochs it can be solved in, a shortest solution for
// that many (every epoch's inputs searched together: an echo's recording can be any inputs at all, so solving with k
// epochs is a search over k bodies moving at once in the last epoch), and whether the level's own reference solution
// (its `sol`) really solves it, with its par.
//
//   node tools/games/epochs/solve.mjs            every level
//   node tools/games/epochs/solve.mjs 3-2 4-1     some levels
//   node tools/games/epochs/solve.mjs --map file  a draft level (a JSON level in a file)
//
// (A relaxation, so it can only say a level is easier than it is, never harder: good for catching shortcuts.)
import { readFileSync } from 'node:fs';
import { LEVELS } from '../../../src/games/epochs/levels.js';
import { parseLevel, initWorld, cloneWorld, tick, keyOf, WON, ZAPPED, charOf, playSolution } from '../../../src/games/epochs/engine.js';

export function solve(L, k, { maxStates = 1_500_000, T = L.T } = {}) {
  const W0 = initWorld(L, k);
  const seen = new Map([[keyOf(W0), null]]);
  let frontier = [{ W: W0, key: keyOf(W0) }];
  const combos = [];
  const rec = (pre) => { if (pre.length === k) { combos.push(pre); return; } for (const a of [-1, 0, 1, 2, 3]) rec([...pre, a]); };
  rec([]);
  for (let depth = 0; depth < T; depth++) {
    const next = [];
    for (const node of frontier) {
      for (const c of combos) {
        // a gone echo has no moves worth trying
        let skip = false;
        for (let i = 0; i < k - 1; i++) if (node.W.bs[i] === 2 && c[i] !== -1) { skip = true; break; }
        if (skip) continue;
        const W = cloneWorld(node.W);
        tick(L, W, c, null);
        if (W.status === ZAPPED) continue;
        const key = keyOf(W);
        if (seen.has(key)) continue;
        seen.set(key, { parent: node.key, c });
        if (W.status === WON) return { key, seen, depth: depth + 1, states: seen.size, path: rebuild(seen, key, k) };
        next.push({ W, key });
      }
      if (seen.size > maxStates) return { gaveUp: true, states: seen.size };
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return { none: true, states: seen.size };
}

function rebuild(seen, key, k) {
  const steps = [];
  while (seen.get(key)) { const s = seen.get(key); steps.push(s.c); key = s.parent; }
  steps.reverse();
  const per = Array.from({ length: k }, (_, i) => steps.map((c) => c[i]));
  return per;
}

// tidy a joint solution: echoes' moves that don't matter become waits (from the end), then trailing waits go
export function tidy(L, per) {
  const k = per.length;
  const works = (p) => {
    const W = initWorld(L, k);
    for (let t = 0; t < p[k - 1].length; t++) {
      tick(L, W, p.map((s) => (t < s.length ? s[t] : -1)), null);
      if (W.status === ZAPPED) return false;
      if (W.status === WON) return t === p[k - 1].length - 1;
    }
    return false;
  };
  const out = per.map((s) => s.slice());
  for (let i = 0; i < k - 1; i++) {
    for (let t = out[i].length - 1; t >= 0; t--) {
      if (out[i][t] === -1) continue;
      const keep = out[i][t];
      out[i][t] = -1;
      if (!works(out)) out[i][t] = keep;
    }
    while (out[i].length && out[i][out[i].length - 1] === -1) out[i].pop();
  }
  return out.map((s) => s.map(charOf).join(''));
}

function report(def) {
  const L = parseLevel(def);
  const lines = [`${def.id} ${def.name}  ${L.w}x${L.h}  T=${def.T} K=${def.K}${L.problems.length ? `  PROBLEMS: ${L.problems.join('; ')}` : ''}`];
  let minK = null;
  for (let k = 1; k <= def.K; k++) {
    const t0 = Date.now();
    const r = solve(L, k);
    const ms = Date.now() - t0;
    if (r.gaveUp) { lines.push(`  k=${k}: gave up after ${r.states} states (${ms} ms)`); continue; }
    if (r.none) { lines.push(`  k=${k}: no solution (${r.states} states, ${ms} ms)`); continue; }
    const sol = tidy(L, r.path);
    lines.push(`  k=${k}: solved in ${r.depth} ticks (${r.states} states, ${ms} ms): ${JSON.stringify(sol)}  total ${sol.reduce((s, x) => s + x.length, 0)}`);
    minK = k;
    break;
  }
  if (def.sol) {
    const p = playSolution(L, def.sol);
    lines.push(`  reference: ${p.won ? `solves it: ${p.epochs} epochs, ${p.ticks} ticks` : `FAILS: ${p.why}`}${minK != null && p.won && p.epochs !== minK ? `  (can be done in ${minK})` : ''}`);
  }
  return lines.join('\n');
}

const args = process.argv.slice(2);
if (args[0] === '--map') {
  const def = JSON.parse(readFileSync(args[1], 'utf8'));
  console.log(report(def));
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const pick = args.length ? LEVELS.filter((l) => args.includes(l.id)) : LEVELS;
  for (const def of pick) console.log(report(def));
}
