// GOING LIVE's balance: whole careers by each of the game's own streamers, as fast as the rules go. Prints, for each kind
// of player, how many streams (and minutes, with half a minute in her room between streams) it takes to reach each
// milestone (the median of `seeds` careers), and how its streams went.
//   node tools/games/goinglive/balance.mjs [seeds=8] [streams=120]
import { career } from '../../../src/games/goinglive/ai.js';
import { CATS, ROOMS, RIVALS } from '../../../src/games/goinglive/data.js';

const seeds = Number(process.argv[2]) || 8, streams = Number(process.argv[3]) || 120;
const marks = [
  ...CATS.slice(2).map((k) => [k.short, k.unlock]),
  ...ROOMS.slice(1).map((r) => [r.name.split(' ')[0], r.at]),
  ['#1', RIVALS[0].f + 1],
].sort((a, b) => a[1] - b[1]);
const med = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length < a.length / 2 ? null : s[Math.floor(s.length / 2)]; };
for (const prof of ['newbie', 'casual', 'good', 'pro']) {
  const runs = [];
  for (let k = 1; k <= seeds; k++) runs.push(career(prof, { streams, seed: k * 31 }));
  const cells = marks.map(([name, at]) => {
    const hits = runs.map((r) => r.log.find((x) => x.followers >= at));
    const n = med(hits.map((h) => h?.i ?? null)), m = med(hits.map((h) => (h ? h.time / 60 : null)));
    return `${name} ${n == null ? '—' : `${n}/${Math.round(m)}m`}`;
  });
  const grades = {}; for (const r of runs) for (const x of r.log) grades[x.grade] = (grades[x.grade] || 0) + 1;
  const end = med(runs.map((r) => r.c.followers));
  console.log(`${prof.padEnd(7)} ${cells.join('  ')}  | end ${Math.round(end).toLocaleString('en-US')} · grades ${Object.entries(grades).map(([g, n]) => `${g}${n}`).join(' ')}`);
}
// the first streams of a good player, one by one
const one = career('good', { streams: 12, seed: 31 });
console.log('\ngood, first streams:', one.log.map((x) => `${x.i}:${x.cat} ${x.followers}f ${x.peak}pk ${x.views}v`).join(' | '));
