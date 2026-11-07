// JAILBREAK: plays every level with the game's own AI, in Node, and prints how it went (cleared, its time, lives
// lost, the bricks it broke). Used to check that every level can be cleared and to set the levels' par times.
//   node tools/games/jailbreak/simulate.mjs [--seeds 4] [--level 2-3] [--H 700] [--endless 12]
import { LEVELS } from '../../../src/games/jailbreak/levels.js';
import { createSim, startLevel, step } from '../../../src/games/jailbreak/sim.js';
import { createAI, think } from '../../../src/games/jailbreak/ai.js';
import { generateLayer } from '../../../src/games/jailbreak/endless.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const seeds = Number(opt('seeds', 4)), only = opt('level', null), H = Number(opt('H', 700)), endless = Number(opt('endless', 0));
const DT = 1 / 120, LIMIT = 400;

function play(def, seed) {
  const s = createSim({ seed, H, mode: 'story' });
  startLevel(s, def, { H });
  s.lives = 99;
  const ai = createAI();
  let t = 0;
  while (t < LIMIT && s.phase !== 'clear' && s.phase !== 'over') {
    const input = think(s, ai, DT);
    step(s, DT, input);
    s.events.length = 0;
    t += DT;
  }
  return { cleared: s.phase === 'clear', time: s.playT, lost: s.levelLost, broken: s.broken, score: s.score, bestCombo: s.bestCombo };
}

const list = endless ? Array.from({ length: endless }, (_, i) => generateLayer(i + 1, 7)) : LEVELS.filter((l) => !only || l.id === only);
for (const def of list) {
  const runs = Array.from({ length: seeds }, (_, i) => play(def, 11 + i * 97));
  const ok = runs.every((r) => r.cleared);
  const times = runs.map((r) => r.time);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`${String(def.id).padEnd(5)} ${String(def.name).padEnd(20)} ${ok ? 'clear' : 'STUCK'}  time ${mean.toFixed(1).padStart(6)}s  [${times.map((t) => t.toFixed(0)).join(' ')}]  lost ${runs.map((r) => r.lost).join(',')}  par ${def.par ?? '-'}  combo ${Math.max(...runs.map((r) => r.bestCombo))}`);
}
