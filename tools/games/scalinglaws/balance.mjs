// SCALING LAWS' balance (2026-11-24): its own player at three skill levels → how often each passes levels 1–30, how
// high it climbs the benchmark, how long a level takes; and how far each gets in Endless.
//   node tools/games/scalinglaws/balance.mjs [seeds]
import { playRun } from '../../../src/games/scalinglaws/ai.js';
const N = Number(process.argv[2]) || 10;
for (const profile of ['newbie', 'steady', 'expert']) {
  const row = [];
  for (const level of [1, 2, 3, 5, 8, 12, 16, 20, 30]) {
    let won = 0, steps = 0, t = 0;
    for (let s = 1; s <= N; s++) { const r = await playRun({ level, seed: s * 97, profile }); if (r.won) { won++; steps += r.step; } t += r.time; }
    row.push(`L${level} ${won}/${N} st${won ? Math.round(steps / won) : '-'} ${Math.round(t / N)}s`);
  }
  console.log(`${profile.padEnd(7)} ${row.join(' · ')}`);
}
for (const profile of ['newbie', 'steady', 'expert']) {
  const rs = [];
  for (let s = 1; s <= N; s++) rs.push(await playRun({ mode: 'endless', seed: s * 13, profile, maxTime: 900 }));
  const t = rs.map((r) => r.time).sort((a, b) => a - b);
  console.log(`endless ${profile.padEnd(7)} median ${Math.round(t[Math.floor(N / 2)])}s · longest ${Math.round(t[N - 1])}s · peak ${Math.max(...rs.map((r) => r.peak))}B`);
}
