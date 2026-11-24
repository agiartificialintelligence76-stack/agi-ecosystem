// TOO MANY TABS' balance (2026-11-24): its own player at three skill levels on levels 1–40 → how often each clears,
// how long it takes against par, and how often it needed the revive. Also proves every board's dealt order clears.
//   node tools/games/toomanytabs/balance.mjs [seeds]
import { createLevel, pick, settle, parOf, paramsFor } from '../../../src/games/toomanytabs/rules.js';
import { playLevel } from '../../../src/games/toomanytabs/ai.js';
const N = Number(process.argv[2]) || 10;
let bad = 0;
for (let level = 1; level <= 80; level++) for (let seed = 1; seed <= 3; seed++) {
  const S = createLevel({ level, seed });
  for (const id of S.solution) { pick(S, id); settle(S); }
  if (!S.won) bad++;
}
console.log(`dealt orders: ${bad ? `${bad} FAILED` : 'every board from level 1 to 80 clears'}`);
for (const profile of ['newbie', 'steady', 'expert']) {
  const row = [];
  for (const level of [1, 3, 5, 8, 12, 16, 20, 25, 30, 40]) {
    let won = 0, revived = 0, t = 0;
    for (let s = 1; s <= N; s++) { const S = createLevel({ level, seed: s * 31 }); const r = playLevel(S, profile, s); if (r.won) { won++; t += r.time / parOf(S); } if (r.revived) revived++; }
    row.push(`L${level} ${won}/${N}${revived ? ` r${revived}` : ''}${won ? ` ${(t / won).toFixed(2)}×par` : ''}`);
  }
  console.log(`${profile.padEnd(7)} ${row.join(' · ')}`);
}
console.log('sizes:', [1, 5, 10, 20, 30].map((l) => `L${l} ${paramsFor(l).tiles} tabs/${paramsFor(l).kinds} kinds/${paramsFor(l).layers} layers`).join(' · '));
