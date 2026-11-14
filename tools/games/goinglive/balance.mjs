// GOING LIVE's balance: whole careers played by each of the game's own players, as fast as the rules go. Prints, for each
// kind of player, the minutes of play it takes to reach each milestone (the median of `seeds` careers), and where they
// are at a few points in time.
//   node tools/games/goinglive/balance.mjs [seeds=6] [minutes=240] [profiles=newbie,casual,good,pro]
import { career } from '../../../src/games/goinglive/ai.js';
import { HOMES, RIVALS } from '../../../src/games/goinglive/data.js';

const seeds = Number(process.argv[2]) || 6, minutes = Number(process.argv[3]) || 240;
const profiles = (process.argv[4] || 'newbie,casual,good,pro').split(',');
const marks = [['100', 100], ['1K', 1000], ['10K', 1e4], ['100K', 1e5], ['1M', 1e6], ['10M', 1e7], ['#1', RIVALS[0].f + 1]];
const med = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length < a.length / 2 ? null : s[Math.floor(s.length / 2)]; };
const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(Math.round(n)));
for (const prof of profiles) {
  const t0 = Date.now(), runs = [];
  for (let k = 1; k <= seeds; k++) runs.push(career(prof, { seconds: minutes * 60, seed: k * 31 }));
  const cells = marks.map(([name, at]) => { const m = med(runs.map((r) => r.log.find((x) => x.f >= at)?.t ?? null)); return `${name} ${m == null ? '—' : `${Math.round(m / 60)}m`}`; });
  const homes = HOMES.slice(1).map((h, i) => { const m = med(runs.map((r) => r.log.find((x) => x.home >= i + 1)?.t ?? null)); return `${h.name.split(' ')[0]} ${m == null ? '—' : `${Math.round(m / 60)}m`}`; });
  console.log(`${prof.padEnd(7)} ${cells.join('  ')} | ${homes.join('  ')}   (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  for (const at of [5, 15, 30, 60, 120, 240].filter((m) => m <= minutes)) {
    const rows = runs.map((r) => r.log.find((x) => x.t >= at * 60) || r.log[r.log.length - 1]);
    const f = med(rows.map((x) => x.f)), L = med(rows.map((x) => x.level)), it = med(rows.map((x) => x.items)), v = med(rows.map((x) => x.videos));
    console.log(`         at ${String(at).padStart(3)}m: ${fmt(f).padStart(6)} followers · level ${L} · ${it} things · ${v} videos`);
  }
}
