// CONTEXT WINDOW's balance (2026-11-24): its own player at three skill levels, many seeds, Classic → how long a run
// lasts, how it scores, how far it gets and what ends it.   node tools/games/contextwindow/balance.mjs [runs]
import { playRun } from '../../../src/games/contextwindow/ai.js';
const N = Number(process.argv[2]) || 20;
const q = (xs, k) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * k))];
for (const profile of ['newbie', 'steady', 'expert']) {
  const rs = [];
  for (let s = 1; s <= N; s++) rs.push(await playRun({ seed: s * 7919, profile, maxTime: 1200 }));
  const causes = {};
  for (const r of rs) causes[r.cause || 'timeout'] = (causes[r.cause || 'timeout'] || 0) + 1;
  const t = rs.map((r) => r.time), sc = rs.map((r) => r.score), lv = rs.map((r) => r.level);
  console.log(`${profile.padEnd(7)} run ${Math.round(q(t, 0.1))}–${Math.round(q(t, 0.5))}–${Math.round(q(t, 0.9))}s (10/50/90%) · score median ${q(sc, 0.5)} · level median ${q(lv, 0.5)} · ended by ${JSON.stringify(causes)}`);
}
