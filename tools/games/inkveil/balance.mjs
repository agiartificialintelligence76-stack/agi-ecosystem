import { rooms } from '../../../src/games/inkveil/rooms.js';
import { campaignRun, contractRun } from '../../../src/games/inkveil/ai.js';
import { witnesses, dossiers } from '../../../src/games/inkveil/dossiers.js';
const q = (values, p) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * p)];
console.log(
  rooms.length +
    ' exhibits, ' +
    dossiers.length +
    ' contracts. Both clean pars (' +
    Math.min(...witnesses.map((p) => p.par)) +
    '–' +
    Math.max(...witnesses.map((p) => p.par)) +
    ') and the unrestricted shortest exits are proved. Model times include inspection, committed footwork, aiming and recovery.'
);
for (const persona of ['newcomer', 'regular', 'expert']) {
  const seasons = Array.from({ length: 12 }, (_, i) => rooms.map((r) => campaignRun(r, persona, 31 + i * 19)));
  const all = seasons.flat(),
    sum = (a, k) => a.reduce((t, x) => t + x[k], 0),
    won = all.filter((r) => r.clear),
    sec = seasons.map((rs) => sum(rs, 'seconds') / 60);
  console.log(
    persona +
      ' campaign · ' +
      won.length +
      '/' +
      all.length +
      ' exits · whole archive P50 ' +
      q(sec, 0.5).toFixed(1) +
      ' min · median beats over clean par ' +
      q(
        won.map((r) => r.turns - r.par),
        0.5
      ) +
      ' · first/finale unassisted quiet ' +
      seasons.filter((a) => a[0].cleanFirst).length +
      '/12, ' +
      seasons.filter((a) => a.at(-1).cleanFirst).length +
      '/12 · hints ' +
      sum(all, 'hints')
  );
  const contracts = Array.from({ length: 36 }, (_, i) => contractRun(i * 17 + 1, persona));
  const quant = (k, p) =>
    q(
      contracts.map((r) => r[k]),
      p
    );
  console.log(
    persona +
      ' Noir · time P10/50/90 ' +
      [0.1, 0.5, 0.9].map((p) => quant('seconds', p).toFixed(0)).join('/') +
      ' s · median cases/turns ' +
      quant('rooms', 0.5) +
      '/' +
      quant('turns', 0.5) +
      ' · score P10/50/90 ' +
      [0.1, 0.5, 0.9].map((p) => quant('score', p)).join('/') +
      ' · throws/diversions ' +
      sum(contracts, 'throws') +
      '/' +
      sum(contracts, 'diverted') +
      ' · sightings patrol/camera ' +
      sum(contracts, 'cones') +
      '/' +
      sum(contracts, 'camera') +
      ' · footsteps heard/hood beats ' +
      sum(contracts, 'heard') +
      '/' +
      sum(contracts, 'hood') +
      ' · budget exhausted ' +
      contracts.filter((r) => r.alerts === 3).length +
      '/36'
  );
}
