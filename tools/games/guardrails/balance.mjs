// GUARDRAILS: the balance check. Plays whole runs with the game's own builder (src/games/guardrails/ai.js), no browser,
// and prints how far each plan gets on each map (waves held, hearts left, where the hearts went), so the waves can be
// tuned: a reasonable build should hold wave 10 on THE CHAT with hearts to spare and reach the 20s; filters alone
// should fall early. Run: node tools/games/guardrails/balance.mjs [maxWave] [seeds]
import { createSim } from '../../../src/games/guardrails/sim.js';
import { createAI } from '../../../src/games/guardrails/ai.js';

const MAX = Number(process.argv[2]) || 40;
const SEEDS = Number(process.argv[3]) || 4;
const DT = 1 / 30;

export function play({ map = 'chat', seed = 1, plan = 'balanced', maxWave = MAX, sendEarly = 0, log = false } = {}) {
  const sim = createSim({ map, seed });
  const ai = createAI(sim, { plan, sendEarly });
  const lost = new Map();
  const perWave = [];
  let hearts = sim.hearts;
  ai.think(); ai.think();
  sim.sendWave();
  let guard = 0;
  while (!sim.over && sim.cleared < maxWave && guard++ < 60 * 60 * 90) {
    sim.update(DT);
    ai.update(DT);
    for (const e of sim.drain()) {
      if (e.type === 'leak') lost.set(e.kind, (lost.get(e.kind) || 0) + e.n);
      if (e.type === 'clear') { perWave.push({ w: e.wave, hearts: sim.hearts, compute: sim.compute, towers: sim.towers.length, t: sim.t }); if (log) console.log(`  w${e.wave} cleared  hearts ${sim.hearts}  compute ${sim.compute}  towers ${sim.towers.length}  t ${sim.t.toFixed(0)}s`); }
    }
    hearts = sim.hearts;
  }
  return { map, seed, plan, cleared: sim.cleared, hearts, over: sim.over, t: Math.round(sim.t), lost: Object.fromEntries(lost), perWave, towers: sim.towers.length,
    spent: sim.towers.reduce((s, t) => s + t.spent, 0) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [map, plan] of [['chat', 'balanced'], ['inbox', 'balanced'], ['server', 'balanced'], ['chat', 'filters']]) {
    const rows = [];
    for (let seed = 1; seed <= SEEDS; seed++) rows.push(play({ map, seed, plan }));
    const avg = rows.reduce((s, r) => s + r.cleared, 0) / rows.length;
    console.log(`${map.padEnd(7)} ${plan.padEnd(9)} waves held: ${rows.map((r) => `${r.cleared}${r.over ? '' : '+'}(${r.hearts}♥)`).join(' ')}  avg ${avg.toFixed(1)}`);
    const lost = {};
    for (const r of rows) for (const [k, v] of Object.entries(r.lost)) lost[k] = (lost[k] || 0) + v;
    console.log(`         hearts lost to: ${Object.entries(lost).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    const w10 = rows.map((r) => r.perWave.find((p) => p.w === 10)).filter(Boolean);
    if (w10.length) console.log(`         at wave 10: hearts ${w10.map((p) => p.hearts).join('/')}, towers ${w10.map((p) => p.towers).join('/')}, t ${w10.map((p) => Math.round(p.t)).join('/')}s`);
  }
}
