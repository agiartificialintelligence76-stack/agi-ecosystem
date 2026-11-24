// WEB SCRAPER's balance (2026-11-24): a round with a bot in every portal → where the player's portal finishes against
// rivals of each skill, how big it gets, how often it's swallowed; and Scrape it all's share of the city.
//   node tools/games/webscraper/balance.mjs [seeds]
import { playRound } from '../../../src/games/webscraper/ai.js';
import { makeCity } from '../../../src/games/webscraper/rules.js';
const N = Number(process.argv[2]) || 10;
const c = makeCity(1);
console.log(`city: ${c.items.length} things, ${c.total} data in all`);
for (const profile of ['newbie', 'steady', 'expert']) {
  const ranks = [], size = [], deaths = [], share = [];
  for (let s = 1; s <= N; s++) { const r = await playRound({ seed: s * 17, profile, rivals: 'steady' }); ranks.push(r.rank); size.push(r.best * 2); deaths.push(r.deaths); }
  for (let s = 1; s <= Math.ceil(N / 2); s++) share.push((await playRound({ mode: 'solo', seed: s * 17, profile })).share);
  const wins = ranks.filter((k) => k === 1).length;
  console.log(`${profile.padEnd(7)} vs steady rivals: 1st ${wins}/${N}, ranks ${ranks.join(',')} · widest ${Math.max(...size).toFixed(1)} m · swallowed ${deaths.reduce((a, b) => a + b, 0)}× · solo ${share.join('%, ')}%`);
}
