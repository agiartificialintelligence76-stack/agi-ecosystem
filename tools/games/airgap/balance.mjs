// AIR GAP balance check: AGI-1's settings play each other headless (the game's own physics, rules and brains), so a
// change to the physics or a personality can be checked before anyone plays it. Each setting should beat the ones below
// it most of the time, matches should take a sensible time, and goals should come from real shots.
//
//   node tools/games/airgap/balance.mjs [matches per pair = 6] [--to 7] [--classic]
import { createMatch, stepMatch } from '../../../src/games/airgap/match.js';
import { createBrain, think, PERSONAS } from '../../../src/games/airgap/ai.js';

const args = process.argv.slice(2);
const n = Number(args.find((a) => /^\d+$/.test(a)) || 6);
const to = args.includes('--to') ? Number(args[args.indexOf('--to') + 1]) || 7 : 7;
const powerups = !args.includes('--classic');
const DT = 1 / 120;

export function play(bottom, top, seed, { to: target = to, limit = 600 } = {}) {
  const M = createMatch({ seed, to: target, powerups });
  const A = createBrain(bottom, seed * 7 + 1, 0), B = createBrain(top, seed * 13 + 5, 1);
  let t = 0, hits = 0, maxSpeed = 0, stalls = 0, chips = 0;
  while (M.phase !== 'over' && t < limit) {
    think(A, M, DT); think(B, M, DT);
    stepMatch(M, DT);
    for (const e of M.ev) {
      if (e.type === 'hit') { hits++; maxSpeed = Math.max(maxSpeed, e.out); }
      if (e.type === 'stall') stalls++;
      if (e.type === 'powerup') chips++;
    }
    M.ev.length = 0;
    t += DT;
  }
  return { winner: M.winner, score: M.score, t, hits, maxSpeed, stalls, chips, longest: M.stats.longest };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const L = PERSONAS.length;
  console.log(`AIR GAP balance: ${n} matches a pair, to ${to}, power-ups ${powerups ? 'on' : 'off'}`);
  const t0 = Date.now();
  for (let a = 0; a < L; a++) {
    const row = [];
    for (let b = 0; b < L; b++) {
      if (a === b) { row.push('   —   '); continue; }
      let wins = 0, time = 0, stalls = 0, goalsA = 0, goalsB = 0;
      for (let i = 0; i < n; i++) {
        // half the matches each way up (bottom / top), so the table's sides don't decide it
        const r = i % 2 ? play(b, a, 1000 + i * 31 + a * 7 + b) : play(a, b, 1000 + i * 31 + a * 7 + b);
        const aSide = i % 2 ? 1 : 0;
        if (r.winner === aSide) wins++;
        goalsA += r.score[aSide]; goalsB += r.score[1 - aSide];
        time += r.t; stalls += r.stalls;
      }
      row.push(`${String(wins).padStart(2)}/${n} ${String(Math.round(time / n)).padStart(3)}s${stalls ? ` s${stalls}` : ''}`);
    }
    console.log(`${PERSONAS[a].id.padEnd(12)} ${row.join(' | ')}`);
  }
  console.log(`(row beats column: wins/matches, mean match length; s = stalls) in ${Date.now() - t0} ms`);
}
