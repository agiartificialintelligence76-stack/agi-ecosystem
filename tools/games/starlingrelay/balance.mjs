import { productions } from '../../../src/games/starlingrelay/productions.js';
import { rehearse } from '../../../src/games/starlingrelay/directors.js';
import { prove } from '../../../src/games/starlingrelay/score.js';
const quant = (list, p) => {
  const sort = [...list].sort((a, b) => a - b);
  return sort[Math.floor((sort.length - 1) * p)];
};
const proofs = productions.map(prove);
console.log(
  '42 authored productions · five acts · total scored beats ' +
    productions.reduce((n, s) => n + s.beats.length * s.plots, 0) +
    ' · exact printed-ink range ' +
    Math.min(...proofs.map((p) => p.par)) +
    '–' +
    Math.max(...proofs.map((p) => p.par))
);
console.log(
  'All 42 scenes offered independently to each director, 12 seeds. Times model reading, composition, repairs and real beat playback.'
);
for (const persona of ['newcomer', 'regular', 'expert']) {
  const rows = Array.from({ length: 12 }, (_, seed) =>
    productions.map((s) => rehearse(s, persona, seed * 23 + 7))
  );
  const all = rows.flat(),
    won = all.filter((r) => r.solved),
    q = (key, p) =>
      quant(
        all.map((r) => r[key]),
        p
      );
  const totals = rows.map((r) => r.reduce((n, x) => n + x.seconds, 0) / 60);
  console.log(
    persona +
      ' · solved ' +
      won.length +
      '/' +
      all.length +
      ' · season median ' +
      quant(totals, 0.5).toFixed(1) +
      ' min · scene P50/P90 ' +
      q('seconds', 0.5).toFixed(0) +
      '/' +
      q('seconds', 0.9).toFixed(0) +
      ' s · score P10/50/90 ' +
      [0.1, 0.5, 0.9].map((p) => q('score', p)).join('/') +
      ' · attempts ' +
      q('attempts', 0.5) +
      ' · ink above par P50/P90 ' +
      [0.5, 0.9]
        .map((p) =>
          quant(
            won.map((r) => r.ink - r.par),
            p
          )
        )
        .join('/') +
      ' · rejected timing/ink ' +
      all.reduce((n, r) => n + r.wrong, 0) +
      '/' +
      all.reduce((n, r) => n + r.over, 0)
  );
}
if (process.argv.includes('--scenes'))
  for (const s of productions) {
    const p = prove(s);
    console.log(s.id, s.name, p.par, JSON.stringify({ main: p.main, dance: p.dance }));
  }
