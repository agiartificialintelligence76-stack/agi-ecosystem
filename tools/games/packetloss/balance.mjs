// PACKET LOSS: plays the demo's AI through mazes headless (no browser) and prints how each went: the time to deliver,
// the hits taken, the gremlins quarantined, the keys used. A way to check the mazes, the speeds and the AI after a
// change. Run: node tools/games/packetloss/balance.mjs [seeds=6] [mazes=8] [caution=1]
import { createSim, step, nextMaze, STEP } from '../../../src/games/packetloss/sim.js';
import { createAI, drive } from '../../../src/games/packetloss/ai.js';
import { MAZES } from '../../../src/games/packetloss/mazes.js';

const seeds = Number(process.argv[2] || 6), mazes = Number(process.argv[3] || 8), caution = Number(process.argv[4] || 1);
const t0 = performance.now();
const rows = [];
for (let m = 0; m < mazes; m++) {
  const res = [];
  for (let s = 1; s <= seeds; s++) {
    const S = createSim({ seed: s, maze: m });
    const ai = createAI({ caution });
    let steps = 0, keys = 0;
    while (S.phase !== 'clear' && S.phase !== 'lost' && steps < 120 * 240) {
      drive(ai, S);
      step(S, STEP);
      for (const e of S.events) if (e.type === 'key') keys++;
      S.events.length = 0;
      steps++;
    }
    res.push({ s, phase: S.phase, t: S.t, hits: S.hits, q: S.quarantined, keys, signal: S.signal, left: S.bitsLeft });
  }
  const ok = res.filter((r) => r.phase === 'clear');
  const avg = (k) => (res.reduce((a, r) => a + r[k], 0) / res.length).toFixed(1);
  rows.push(`${String(m + 1).padStart(2)} ${MAZES[m].name.padEnd(17)} cleared ${ok.length}/${res.length}  time ${avg('t')}s  hits ${avg('hits')}  quarantined ${avg('q')}  keys ${avg('keys')}  ${res.filter((r) => r.phase !== 'clear').map((r) => `[seed ${r.s}: ${r.phase} ${r.left} left]`).join(' ')}`);
}
console.log(rows.join('\n'));
console.log(`(${((performance.now() - t0) / 1000).toFixed(2)} s)`);
void nextMaze;
