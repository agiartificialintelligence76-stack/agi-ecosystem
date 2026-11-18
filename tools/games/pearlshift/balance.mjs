import { simulate } from '../../../src/games/pearlshift/ai.js';
const count = Number(process.argv[2]) || 64;
const q = (rows, k, p) => rows.map(x => x[k]).sort((a, b) => a - b)[Math.floor((rows.length - 1) * p)];
for (const profile of ['newbie', 'steady', 'expert']) {
  const rows = Array.from({
    length: count
  }, (_, i) => simulate(profile, i * 7919 + 23));
  console.log(profile + '  time p10/50/90=' + [.1, .5, .9].map(v => q(rows, 'time', v).toFixed(1)).join('/') + 's  score p25/50/75=' + [.25, .5, .75].map(v => q(rows, 'score', v)).join('/') + '  fixes=' + q(rows, 'finds', .5) + '  pings=' + q(rows, 'pings', .5) + '  misses=' + q(rows, 'misses', .5) + '  exact=' + q(rows, 'exact', .5));
}
