import { simulate } from '../../../src/games/summitline/ai.js';
const seeds = Number(process.argv[2]) || 64;
const quantile = (rows, key, p) => rows.map(r => r[key]).sort((a, b) => a - b)[Math.floor((rows.length - 1) * p)];
for (const profile of ['newbie', 'steady', 'expert']) {
  const runs = Array.from({
    length: seeds
  }, (_, i) => simulate(profile, i * 7919 + 23));
  const time = [.1, .5, .9].map(p => quantile(runs, 'time', p).toFixed(1));
  const points = [.25, .5, .75].map(p => quantile(runs, 'score', p));
  console.log(profile + '  time p10/50/90=' + time.join('/') + 's  score p25/50/75=' + points.join('/') + '  longest p50=' + quantile(runs, 'span', .5) + '  phrases p50=' + quantile(runs, 'phrases', .5) + '  errors p50=' + quantile(runs, 'errors', .5));
}
