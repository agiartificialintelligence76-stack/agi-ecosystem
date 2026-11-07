// OVERCLOCK: the plunger's skill-shot bands. For each R-A-M lane, the widest run of launch speeds that all roll
// through that lane first (cleanly, every time): sim.js's SKILL_BANDS maps the power meter's three middle fifths onto
// them. node tools/games/overclock/calibrate.mjs
import { stepWorld, makeBall } from '../../../src/games/overclock/physics.js';
import { buildTable, PLUNGER } from '../../../src/games/overclock/table.js';

const DT = 1 / 120;
function firstLane(v0) {
  const T = buildTable(1);
  const b = makeBall(PLUNGER.x, PLUNGER.y, 0, -v0);
  let first = null, out = false;
  for (let i = 0; i < 120 * 3 && first == null; i++) {
    stepWorld(T.world, [b], DT, { sensor(s) { if (s.tag === 'launched') out = true; if (first == null && s.tag === 'lane') first = s.ref; if (first == null && s.tag === 'orbit') first = 'orbit'; }, contact(c) { if (first == null && c.tag === 'pop') first = 'pop'; } });
    if (out && b.y > 520 && first == null) first = 'miss';
  }
  return first ?? 'none';
}
const step = 0.5, runs = [];
let cur = null;
for (let v = 2090; v <= 2300; v += step) {
  const l = firstLane(v);
  if (cur && cur.lane === l) cur.v1 = v; else { cur = { lane: l, v0: v, v1: v }; runs.push(cur); }
}
for (const lane of [0, 1, 2]) {
  const best = runs.filter((r) => r.lane === lane).sort((a, b) => (b.v1 - b.v0) - (a.v1 - a.v0))[0];
  if (!best) { console.log(`lane ${lane}: never`); continue; }
  // keep a margin inside the run
  const m = Math.min(1.5, (best.v1 - best.v0) * 0.15);
  console.log(`lane ${lane}: ${best.v0}–${best.v1} (width ${best.v1 - best.v0}) → use ${best.v0 + m}–${best.v1 - m}`);
}
console.log(runs.filter((r) => r.v1 - r.v0 >= 2).map((r) => `${r.lane}:${r.v0}-${r.v1}`).join('  '));
// and the bands as the game has them: every power in a band reaches its lane
const { launchSpeed, SKILL_BANDS } = await import('../../../src/games/overclock/sim.js');
for (const b of SKILL_BANDS) {
  let ok = 0, n = 0;
  for (let p = b.p0; p <= b.p1 + 1e-9; p += 0.01) { n++; if (firstLane(launchSpeed(p)) === b.lane) ok++; }
  console.log(`band for lane ${b.lane}: ${ok}/${n} powers reach it`);
}
