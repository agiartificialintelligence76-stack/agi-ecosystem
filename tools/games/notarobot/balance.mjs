// I'M NOT A ROBOT: how often the demo's hand passes each check at each level, and how long it takes (a balance check).
// node tools/games/notarobot/balance.mjs [runs]
import { CHECKS } from '../../../src/games/notarobot/checks/index.js';
import { Run } from '../../../src/games/notarobot/run.js';
import { createBot } from '../../../src/games/notarobot/bot.js';
const N = Number(process.argv[2]) || 20, DT = 1 / 120;
for (const c of CHECKS) {
  const row = [];
  for (const level of [1, 2, 3]) {
    let pass = 0, time = 0; const why = {};
    for (let s = 1; s <= N; s++) {
      const run = new Run({ seed: s * 101 + level, checks: [c, { ...c, id: `${c.id}2` }], tempo: [0, 1, 4, 7][level] });
      run.make = ((orig) => function (def, _l, T, boss, step) { return orig.call(this, def, level, T, boss, step); })(run.make);
      const bot = createBot(s * 7 + 1, { blunderRate: 0 });
      let res = null;
      for (let k = 0; k < 120 * 12 && !res; k++) {
        bot.update(DT, run); run.update(DT);
        for (const e of run.events) if (e.type === 'pass' || e.type === 'fail') res = e;
        run.events.length = 0;
      }
      if (res?.type === 'pass') { pass++; time += run.cur.el / run.cur.T; } else why[res?.why] = (why[res?.why] || 0) + 1;
    }
    row.push(`L${level} ${String(pass).padStart(2)}/${N} ${pass ? (time / pass * 100).toFixed(0).padStart(3) + '%' : '  - '} ${Object.entries(why).map(([k, v]) => `${k}:${v}`).join(',')}`);
  }
  console.log(c.id.padEnd(8), row.join('  |  '));
}
