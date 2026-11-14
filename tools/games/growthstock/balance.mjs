// GROWTH STOCK's balance: every season played by each of the game's own farmers, `seeds` times, as fast as the rules
// go. Prints the final gold (25th / 50th / 90th percentile), the stars it'd get, and how the farm was run.
//   node tools/games/growthstock/balance.mjs [seeds=16] [season …]
import { createSim, step } from '../../../src/games/growthstock/sim.js';
import { makeConfig, SEASONS, starsFor } from '../../../src/games/growthstock/seasons.js';
import { playOut } from '../../../src/games/growthstock/ai.js';

const args = process.argv.slice(2);
const seeds = Number(args[0]) || 16;
const only = args.slice(1);
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
for (const season of SEASONS) {
  if (only.length && !only.includes(season.id)) continue;
  console.log(`\n${season.q} ${season.name}  stars at ${season.stars.join(' / ')}`);
  for (const prof of ['newbie', 'casual', 'steady', 'expert']) {
    const runs = [];
    for (let k = 1; k <= seeds; k++) runs.push(playOut(createSim, step, makeConfig({ mode: 'season', season: season.id }), 1000 + k * 17, prof));
    const g = runs.map((S) => S.gold), st = runs.map((S) => S.stats);
    const stars = runs.map((S) => starsFor(season, S.gold));
    const line = [
      prof.padEnd(7),
      `gold ${String(Math.round(pct(g, 0.25))).padStart(5)} ${String(Math.round(pct(g, 0.5))).padStart(5)} ${String(Math.round(pct(g, 0.9))).padStart(5)}`,
      `★ ${[0, 1, 2, 3].map((n) => stars.filter((x) => x === n).length).join('/')}`,
      `harv ${Math.round(avg(st.map((s) => s.harvested)))}`,
      `bump ${Math.round(avg(st.map((s) => s.bumpers)))}`,
      `sold ${Math.round(avg(st.map((s) => s.sold)))}`,
      `best× ${avg(st.map((s) => s.bestRatio)).toFixed(2)}`,
      `wilt ${avg(st.map((s) => s.rotten)).toFixed(1)}`,
      `eaten ${avg(st.map((s) => s.eaten)).toFixed(1)}`,
      `orders ${avg(st.map((s) => s.orders)).toFixed(1)}`,
      `plots ${avg(runs.map((S) => S.plots.filter((p) => p.open).length)).toFixed(1)}`,
      `spr ${avg(runs.map((S) => S.sprinkler.level)).toFixed(1)}`,
      `barn ${avg(runs.map((S) => S.barn.level)).toFixed(1)}`,
      `bell ${Math.round(avg(st.map((s) => s.closing)))}`,
    ];
    if (process.env.CROPS) { const by = {}; for (const s of st) for (const [k, v] of Object.entries(s.byCrop)) by[k] = (by[k] || 0) + v / st.length; line.push(Object.entries(by).map(([k, v]) => `${k} ${Math.round(v)}`).join(' ')); }
    console.log('  ' + line.join('  '));
  }
}
