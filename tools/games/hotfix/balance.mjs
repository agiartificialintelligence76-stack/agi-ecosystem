// HOTFIX's balance (2026-11-24): its own player at three skill levels → the floor each run ends on (bosses are on
// every fifth), how many turns a run lasts, and the best combo.   node tools/games/hotfix/balance.mjs [seeds]
import { playRun } from '../../../src/games/hotfix/ai.js';
const N = Number(process.argv[2]) || 12;
for (const profile of ['newbie', 'steady', 'expert']) {
  const rs = [];
  for (let s = 1; s <= N; s++) rs.push(await playRun({ seed: s * 11, profile }));
  const fl = rs.map((r) => r.floor).sort((a, b) => a - b), tu = rs.map((r) => r.turns).sort((a, b) => a - b);
  console.log(`${profile.padEnd(7)} floors ${fl.join(',')} (median ${fl[Math.floor(N / 2)]}) · turns median ${tu[Math.floor(N / 2)]} · best combo ${Math.max(...rs.map((r) => r.bestCombo))}`);
}
