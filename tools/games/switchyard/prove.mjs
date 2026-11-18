import { writeFileSync } from 'node:fs';
import { plans, makeYard } from '../../../src/games/switchyard/yards.js';
import { solve } from '../../../src/games/switchyard/solver.js';
const subset = process.argv.slice(2).filter(x => /^\d+$/.test(x)).map(Number);
const cert = [];
for (let i = 0; i < plans.length; i++) {
  if (subset.length && !subset.includes(i + 1)) continue;
  const y = makeYard(i),
    result = solve(y, y.start, Number(process.env.YARD_BUDGET) || 300000);
  console.log(String(i + 1).padStart(2), y.name, result.path?.length ?? (result.complete ? 'TRAPPED' : 'OVER BUDGET'), result.expanded);
  cert[i] = result.path?.map(x => x.toString(16)).join('') ?? null;
}
if (process.argv.includes('--save') && !subset.length && cert.every(Boolean)) {
  writeFileSync(new URL('../../../src/games/switchyard/station-book.js', import.meta.url), '// Shortest operating orders, generated and independently replayable with tools/games/switchyard/prove.mjs.\nexport const book = ' + JSON.stringify(cert, null, 2) + ';\n');
}
