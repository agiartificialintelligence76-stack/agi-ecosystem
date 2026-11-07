// SYNAPSE (2026-11-08): picks the campaign's boards. For each pack's segment it walks through generator seeds, keeps
// the boards that have exactly one answer (src/games/synapse/puzzle.js's solver), a good spread of path lengths and
// not too many tiny pairs, then takes an even spread of them by difficulty (how hard the solver had to search) and
// writes them easiest first to src/games/synapse/campaign.js, with a checksum per pack (tests/synapse.test.js checks
// the generator still makes exactly these boards, and that each one still has one answer).
// Run: node tools/games/synapse/pick.mjs            (about a minute)
import { writeFileSync } from 'node:fs';
import { generate, solve, gateUntilUnique, withGates, encode, checksum } from '../../../src/games/synapse/puzzle.js';
import { rng } from '../../../src/games/kit/fx.js';

// the packs' shapes, without their seeds (packs.js imports campaign.js, which this script writes)
const { PACKS } = await import('../../../src/games/synapse/packs.js').catch(async () => {
  // a first run: campaign.js doesn't exist yet
  writeFileSync(new URL('../../../src/games/synapse/campaign.js', import.meta.url), 'export const SEEDS = {};\nexport const SUMS = {};\n');
  return import('../../../src/games/synapse/packs.js');
});
const encodeGates = (cells) => cells.map((c) => c.toString(36)).join('.');

// how much of the pack's difficulty range to use (the first pack stays gentle, the last leans hard)
const RANGE = { sprout: [0, 0.6], cortex: [0.1, 0.85], hippocampus: [0.2, 1], myelin: [0.2, 1], gatekeeper: [0.2, 1], neocortex: [0.25, 1] };
// how hard a board feels: how much the solver had to search, plus how far its paths wander from the straight way
// between their neurons (a pair whose path is a straight line or an L is easy to see)
function difficulty(pz, nodes) {
  const n = pz.n;
  let detour = 0;
  pz.sol.forEach((P) => {
    const a = P[0], b = P[P.length - 1];
    detour += P.length - 1 - (Math.abs((a % n) - (b % n)) + Math.abs(((a / n) | 0) - ((b / n) | 0)));
  });
  return nodes + 4 * detour;
}
// the most search a board may need (so the tests that re-check every board stay fast)
const MAX_NODES = { 5: 4000, 6: 6000, 7: 9000, 8: 12000, 9: 14000, 10: 16000 };

function good(pz) {
  const lens = pz.sol.map((P) => P.length);
  const cells = lens.reduce((a, b) => a + b, 0);
  const tiny = lens.filter((l) => l <= 3).length;
  if (tiny > Math.max(1, Math.floor(pz.pairs.length / 3))) return false;
  if (Math.max(...lens) > Math.max(9, cells * 0.4)) return false;
  // at least one long, winding path
  const turns = pz.sol.map((P) => { let t = 0; for (let k = 1; k + 1 < P.length; k++) if ((P[k] - P[k - 1]) !== (P[k + 1] - P[k])) t++; return t; });
  return Math.max(...turns) >= 3;
}

const out = {}, sums = {};
const seen = new Set();
for (const pack of PACKS) {
  const entries = [];
  const t0 = performance.now();
  pack.segments.forEach((seg, si) => {
    const spec = seg.spec;
    const cands = [];
    const want = seg.count * 3;
    const base = (parseInt(checksum([`${pack.id}:${si}`]), 36) % 900000) + 1000;
    for (let s = base; cands.length < want && s < base + 40000; s++) {
      const { gates, ...shape } = spec;
      let pz = generate(shape, s);
      let extra;
      if (gates) {
        const r = rng(s * 31 + 7);
        const g = gateUntilUnique(pz, r, { min: gates[0], max: gates[1], budget: 200000 });
        if (!g || g.needed < 1 || g.gates.length > gates[1]) continue;
        pz = withGates(pz, g.gates);
        extra = encodeGates(g.gates);
      }
      if (!good(pz)) continue;
      const res = solve(pz, { limit: 2, budget: 200000 });
      if (res.count !== 1 || res.nodes > MAX_NODES[pz.n]) continue;
      const key = encode(pz);
      if (seen.has(key)) continue;
      seen.add(key);
      cands.push({ s, nodes: res.nodes, score: difficulty(pz, res.nodes), extra, key });
    }
    if (cands.length < seg.count) throw new Error(`${pack.id} segment ${si}: only ${cands.length} boards`);
    cands.sort((a, b) => a.score - b.score);
    const [lo, hi] = RANGE[pack.id];
    const picked = [];
    for (let k = 0; k < seg.count; k++) {
      const q = lo + (hi - lo) * (seg.count === 1 ? 0 : k / (seg.count - 1));
      let idx = Math.min(cands.length - 1, Math.round(q * (cands.length - 1)));
      while (picked.includes(cands[idx]) && idx < cands.length - 1) idx++;
      while (picked.includes(cands[idx]) && idx > 0) idx--;
      picked.push(cands[idx]);
    }
    picked.sort((a, b) => a.score - b.score);
    for (const c of picked) entries.push(c.extra ? [si, c.s, c.extra] : [si, c.s]);
    console.log(`${pack.id} #${si}: ${cands.length} candidates, difficulty ${picked[0].score}…${picked[picked.length - 1].score}`);
  });
  out[pack.id] = entries;
  console.log(`${pack.id}: ${entries.length} boards in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
}
const body = Object.entries(out).map(([id, list]) => `  ${id}: [\n${list.map((e) => `    ${JSON.stringify(e).replaceAll('"', "'")},`).join('\n')}\n  ],`).join('\n');
// the checksums, from the boards exactly as the game makes them (packs.js boardAt: the seed, then its gates)
for (const pack of PACKS) {
  sums[pack.id] = checksum(out[pack.id].map(([si, seed, gates]) => {
    const pz = generate(pack.segments[si].spec, seed);
    return encode(gates ? withGates(pz, gates.split('.').map((x) => parseInt(x, 36))) : pz);
  }));
}
writeFileSync(new URL('../../../src/games/synapse/campaign.js', import.meta.url),
  `// SYNAPSE: the campaign's boards as generator seeds, picked by tools/games/synapse/pick.mjs (don't edit by hand).
// Each entry: [segment of its pack, seed] or [segment, seed, its gates (base-36 cells joined by dots)].
export const SEEDS = {\n${body}\n};\n// a checksum of each pack's boards (tests/synapse.test.js: the generator still makes exactly these)
export const SUMS = ${JSON.stringify(sums).replaceAll('"', "'").replaceAll(',', ', ').replaceAll(':', ': ')};\n`);
console.log('wrote src/games/synapse/campaign.js', sums);
