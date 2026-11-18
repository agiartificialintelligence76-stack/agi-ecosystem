import { depots } from '../../../src/games/waxworks/dispatch.js';
import { deliver } from '../../../src/games/waxworks/crew.js';
import { solve } from '../../../src/games/waxworks/solver.js';
const quant = (list, p) => {
  const vals = [...list].sort((a, b) => a - b);
  return vals[Math.floor((vals.length - 1) * p)];
};
const certs = depots.map((d) => solve(d));
console.log(
  '42 authored depots · five worlds · shortest routes ' +
    Math.min(...certs.map((c) => c.par)) +
    '–' +
    Math.max(...certs.map((c) => c.par)) +
    ' rolls.'
);
console.log(
  '12 seeded shifts per crew. Time includes modeled thinking, physical inputs, route checks and corrections. Every intermediate footprint uses the production reducer.'
);
for (const persona of ['newcomer', 'regular', 'expert']) {
  const shifts = Array.from({ length: 12 }, (_, i) => depots.map((d) => deliver(d, persona, 17 * i + 3))),
    runs = shifts.flat();
  const q = (key, p) =>
      quant(
        runs.map((r) => r[key]),
        p
      ),
    sum = (key) => runs.reduce((n, r) => n + r[key], 0);
  console.log(
    persona +
      ' · solved ' +
      runs.filter((r) => r.solved).length +
      '/' +
      runs.length +
      ' · season median ' +
      quant(
        shifts.map((a) => a.reduce((x, r) => x + r.seconds, 0) / 60),
        0.5
      ).toFixed(1) +
      ' min · depot P50/P90 ' +
      q('seconds', 0.5).toFixed(0) +
      '/' +
      q('seconds', 0.9).toFixed(0) +
      ' s · actions ' +
      q('commands', 0.5) +
      '/' +
      q('commands', 0.9) +
      ' · score P10/50/90 ' +
      [0.1, 0.5, 0.9].map((p) => q('score', p)).join('/') +
      ' · edges/undo/hints ' +
      [sum('edges'), sum('undos'), sum('hints')].join('/') +
      ' · median world min ' +
      [0, 1, 2, 3, 4]
        .map((world) =>
          quant(
            shifts.map(
              (r) => r.filter((_, i) => depots[i].world === world).reduce((n, x) => n + x.seconds, 0) / 60
            ),
            0.5
          ).toFixed(1)
        )
        .join('/')
  );
}
if (process.argv.includes('--depots')) for (const d of depots) console.log(d.id, d.name, d.certificate);
