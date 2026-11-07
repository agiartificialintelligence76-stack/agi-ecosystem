// JAILBREAK: plays levels with the game's own AI, in Node, and prints how it went (cleared, its time, lives lost, the
// best combo). Used to check that every level can be cleared, and to set the levels' par times (--pars: the AI's
// median time over 20 runs, at a short and a tall field, × 1.3, up to the next 5 s; paste the JSON into levels.js).
//   node tools/games/jailbreak/simulate.mjs [--seeds 4] [--level 2-3] [--H 700] [--endless 12] [--pars]
import { LEVELS } from '../../../src/games/jailbreak/levels.js';
import { createSim, startLevel, step } from '../../../src/games/jailbreak/sim.js';
import { createAI, think } from '../../../src/games/jailbreak/ai.js';
import { generateLayer } from '../../../src/games/jailbreak/endless.js';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const seeds = Number(opt('seeds', 4)), only = opt('level', null), H = Number(opt('H', 700)), endless = Number(opt('endless', 0));
const DT = 1 / 120, LIMIT = 420;

function play(def, seed, h = H) {
  const s = createSim({ seed, H: h, mode: endless ? 'endless' : 'story' });
  startLevel(s, def, { H: h, intro: 0 });
  s.lives = 99;
  const ai = createAI();
  let t = 0;
  while (t < LIMIT && s.phase !== 'clear' && s.phase !== 'over') {
    step(s, DT, think(s, ai, DT));
    s.events.length = 0;
    t += DT;
  }
  return { cleared: s.phase === 'clear', time: s.playT, lost: s.levelLost, broken: s.broken, score: s.score, bestCombo: s.bestCombo };
}

if (args.includes('--pars')) {
  const out = {};
  for (const L of LEVELS) {
    const times = [];
    for (let k = 0; k < 10; k++) for (const h of [620, 760]) times.push(play(L, 31 + k * 101, h).time);
    times.sort((a, b) => a - b);
    const med = times[times.length >> 1];
    out[L.id] = Math.ceil((med * 1.3) / 5) * 5;
    console.log(`${L.id.padEnd(4)} ${L.name.padEnd(20)} median ${med.toFixed(0).padStart(4)} s → par ${out[L.id]} (now ${L.par})`);
  }
  console.log(JSON.stringify(out));
} else {
  const list = endless ? Array.from({ length: endless }, (_, i) => generateLayer(i + 1, 7)) : LEVELS.filter((l) => !only || l.id === only);
  for (const def of list) {
    const runs = Array.from({ length: seeds }, (_, i) => play(def, 11 + i * 97));
    const ok = runs.every((r) => r.cleared);
    const times = runs.map((r) => r.time);
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`${String(def.id).padEnd(5)} ${String(def.name).padEnd(20)} ${ok ? 'clear' : 'STUCK'}  time ${mean.toFixed(1).padStart(6)}s  [${times.map((t) => t.toFixed(0)).join(' ')}]  lost ${runs.map((r) => r.lost).join(',')}  par ${def.par ?? '-'}  combo ${Math.max(...runs.map((r) => r.bestCombo))}`);
  }
}
