// AIR GAP: choose the demo's openings. Each candidate seed opens the demo match (3–3, Tryhard against Competitive, the
// SPLIT chip rigged onto the puck's way) and plays its first 12 seconds headless; a good one lands the SPLIT 5.9–7.2 s
// in (the preview records 5.7–11.7 s) with at least one goal after it inside the recording. The physics is
// bit-identical in every engine (dmath.js), so what this finds in Node is what the browser plays.
//
//   node tools/games/airgap/demo-seeds.mjs [how many seeds = 400]
import { createDemo, rigTick } from '../../../src/games/airgap/demo.js';
import { think } from '../../../src/games/airgap/ai.js';
import { stepMatch } from '../../../src/games/airgap/match.js';

export function timeline(seed, secs = 12) {
  const DT = 1 / 120, D = createDemo(seed);
  let split = -1, chip = -1;
  const goals = [];
  for (let i = 0; i < secs * 120; i++) {
    think(D.brains[0], D.M, DT); think(D.brains[1], D.M, DT); rigTick(D);
    stepMatch(D.M, DT);
    for (const e of D.M.ev) {
      if (e.type === 'powerup' && split < 0) split = D.M.t;
      if (e.type === 'goal') goals.push(D.M.t);
      if (e.type === 'chipIn' && chip < 0) chip = D.M.t;
    }
    D.M.ev.length = 0;
  }
  return { seed, chip, split, goals };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = Number(process.argv[2]) || 400;
  const good = [];
  for (let seed = 1; seed <= n; seed++) {
    const r = timeline(seed);
    const after = r.goals.filter((t) => t > r.split + 0.2 && t > 6 && t < 11.3);
    if (r.split >= 5.9 && r.split <= 7.2 && after.length && r.chip < 5.6 && !r.goals.some((t) => t < 5.6)) good.push({ ...r, after });
  }
  good.sort((a, b) => b.after.length - a.after.length);
  console.log(`${good.length} good openings of ${n}`);
  for (const g of good.slice(0, 20)) console.log(g.seed, 'chip', g.chip.toFixed(2), 'split', g.split.toFixed(2), 'goals', g.after.map((t) => t.toFixed(2)).join(' '));
}
