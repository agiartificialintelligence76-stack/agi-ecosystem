import { simulate } from '../../../src/games/cloudkitchen/barista.js';
const n = Number(process.argv[2]) || 64,
  q = (rows, key, p) => rows.map(r => r[key]).sort((a, b) => a - b)[Math.floor((rows.length - 1) * p)];
for (const who of ['newbie', 'steady', 'expert']) for (const layout of ['touch', 'keyboard']) {
  const rows = Array.from({
    length: n
  }, (_, i) => simulate(who, 173 + i * 7919, 'endless', 0, layout));
  const days = Array.from({
    length: n
  }, (_, i) => simulate(who, 31 + i * 727, 'week', 0, layout));
  const wasted = rows.reduce((sum, r) => (sum[r.waste] = (sum[r.waste] || 0) + 1, sum), {});
  console.log(who + ' ' + layout + ' · survival p10/50/90 ' + [.1, .5, .9].map(p => q(rows, 'seconds', p).toFixed(1)).join('/') + 's · score p25/50/75 ' + [.25, .5, .75].map(p => q(rows, 'score', p)).join('/') + ' · served ' + q(rows, 'served', .5) + ' · abandoned ' + q(rows, 'lost', .5) + ' · clean ' + q(rows, 'perfect', .5) + ' · busiest ' + Object.keys(wasted).sort((a, b) => wasted[b] - wasted[a])[0] + ' · opening shifts completed ' + days.filter(r => r.complete).length + '/' + n);
}
