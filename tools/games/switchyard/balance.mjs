import { simulate } from '../../../src/games/switchyard/ai.js';
import { lines } from '../../../src/games/switchyard/yards.js';
const runs = Number(process.argv[2]) || 64,
  quantile = (a, p) => [...a].sort((x, y) => x - y)[Math.floor(p * (a.length - 1))];
console.log('36 certified yards per simulated shift. Time includes persona decision and ticket-reading time.');
for (const profile of ['newbie', 'steady', 'expert']) {
  const shifts = Array.from({
    length: runs
  }, (_, i) => simulate(profile, 73 + i * 7919));
  const stat = (name, ps) => ps.map(p => quantile(shifts.map(r => r[name]), p)).map(Math.round).join('/');
  const times = shifts.map(r => r.seconds / 60);
  const worst = lines.map((line, i) => [line, shifts.reduce((total, r) => total + r.hotspots[i], 0)]).sort((a, b) => b[1] - a[1])[0];
  console.log(profile + ' · minutes p10/50/90 ' + [.1, .5, .9].map(p => quantile(times, p).toFixed(1)).join('/') + ' · score p25/50/75 ' + stat('score', [.25, .5, .75]) + ' · buffer stops ' + stat('failed', [.5]) + ' · undone dead ends ' + stat('undone', [.5]) + ' · wrong-order window arrivals ' + stat('wrongOrder', [.5]) + ' · extra coupler changes ' + stat('extraLinks', [.5]) + ' · exact yards ' + stat('perfect', [.5]) + '/36 · most trouble ' + worst[0] + ' (' + worst[1] + ' errors across ' + runs + ' shifts)');
  console.log('  line action p25/50/75 and median yard seconds: ' + lines.map((name, i) => {
    const rows = shifts.flatMap(r => r.byLine[i]);
    return name + ' ' + [.25, .5, .75].map(p => quantile(rows.map(r => r.steps), p)).join('/') + ' (' + Math.round(quantile(rows.map(r => r.seconds), .5)) + 's)';
  }).join(' · '));
}
