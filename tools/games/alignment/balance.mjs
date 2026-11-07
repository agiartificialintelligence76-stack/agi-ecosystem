// ALIGNMENT's balance check (2026-11-08): plays thousands of seeded runs with a few kinds of player and prints how long
// they last and which endings they find. Run: node tools/games/alignment/balance.mjs [runs]
import { createRun, draw, choose } from '../../../src/games/alignment/engine.js';
import { pickSide } from '../../../src/games/alignment/ai.js';
import { CARDS, ENDINGS, HELLOS } from '../../../src/games/alignment/cards.js';
import { rng } from '../../../src/games/kit/fx.js';

const N = Number(process.argv[2]) || 3000;
const story = (card) => ['left', 'right'].find((s) => card[s].set || card[s].next || card[s].end);
const POLICIES = {
  random: (run, r) => (r.next() < 0.5 ? 'left' : 'right'),
  // a player who reads the card well three times in four
  decent: (run, r) => { const g = pickSide(run); return r.next() < 0.75 ? g : g === 'left' ? 'right' : 'left'; },
  good: (run, r) => { const g = pickSide(run); return r.next() < 0.9 ? g : g === 'left' ? 'right' : 'left'; },
  greedy: (run) => pickSide(run),
  // follows every story it meets, otherwise plays well
  seeker: (run, r) => story(run.card) || pickSide(run, r, 30),
};
const seen = new Set();
for (const [name, policy] of Object.entries(POLICIES)) {
  const lens = [], ends = {};
  for (let i = 1; i <= N; i++) {
    const run = createRun(i * 7919, { first: HELLOS[i % HELLOS.length] }), r = rng(i * 104729);
    while (!run.over && run.day < (name === "greedy" ? 600 : 2000)) { draw(run); seen.add(run.card.id); choose(run, policy(run, r)); }
    lens.push(run.day);
    const e = run.over?.ending || 'none';
    ends[e] = (ends[e] || 0) + 1;
  }
  lens.sort((a, b) => a - b);
  const q = (p) => lens[Math.floor(p * (lens.length - 1))];
  const pct = (d) => ((lens.filter((x) => x >= d).length / N) * 100).toFixed(1);
  console.log(`${name.padEnd(7)} median ${q(0.5)} · p10 ${q(0.1)} · p90 ${q(0.9)} · max ${lens[lens.length - 1]} · ≥50: ${pct(50)}% · ≥100: ${pct(100)}% · ≥365: ${pct(365)}%`);
  console.log('        ' + ENDINGS.map((e) => `${e.id}:${ends[e.id] || 0}`).join(' ') + (ends.none ? ` none:${ends.none}` : ''));
}
const never = CARDS.filter((c) => !seen.has(c.id)).map((c) => c.id);
console.log(`cards: ${CARDS.length}; never dealt: ${never.length ? never.join(', ') : 'none'}`);
