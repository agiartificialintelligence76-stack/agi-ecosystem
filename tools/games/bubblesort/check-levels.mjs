// BUBBLE SORT's level checker (2026-11-09): plays every level with the game's own player (src/games/bubblesort/ai.js) on
// a few seeds and reports how it goes: won, shots used, stars, biggest drop. The shots and star lines in levels.js were
// set from it (a person aims less perfectly than the player here, so a level gives about twice what it needs).
//   node tools/games/bubblesort/check-levels.mjs [--seeds 12] [--suggest | --write] [level …]
// (--write puts the suggested shots and stars into src/games/bubblesort/levels.js)
import { LEVELS } from '../../../src/games/bubblesort/levels.js';
import { Game, starsFor } from '../../../src/games/bubblesort/rules.js';
import { autoplay } from '../../../src/games/bubblesort/ai.js';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? Number(args[i + 1]) : d; };
const seeds = opt('seeds', 12);
const only = args.filter((a, i) => /^\d+$/.test(a) && args[i - 1] !== '--seeds').map(Number);
const write = args.includes('--write');
const suggest = args.includes('--suggest') || write;
const changes = new Map();
const q = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
for (const def of LEVELS) {
  if (only.length && !only.includes(def.n)) continue;
  const big = { ...def, shots: 200, misses: def.misses };
  const used = [], drops = [], wins = [], stars = [], banks = [];
  for (let s = 1; s <= seeds; s++) {
    const g = autoplay(new Game({ mode: 'level', def: big, seed: s }), { maxShots: 220 });
    wins.push(g.status === 'won');
    used.push(g.fired);
    drops.push(g.stats.biggestDrop);
    banks.push(g.stats.banks);
    // with the level's own shots
    const real = autoplay(new Game({ mode: 'level', def, seed: s }), { maxShots: 220 });
    stars.push(real.status === 'won' ? starsFor(def, real.shotsLeft) : 0);
  }
  const med = q(used, 0.5), p90 = q(used, 0.9);
  const line = `${String(def.n).padStart(2)} ${def.name.padEnd(20)} won ${wins.filter(Boolean).length}/${seeds}  used med ${med} p90 ${p90} max ${Math.max(...used)}  drop≤${Math.max(...drops)}  banks ${q(banks, 0.5)}  stars(now ${def.shots}) ${stars.join('')}`;
  if (suggest) {
    const factor = def.n <= 10 ? 2.1 : def.n <= 20 ? 1.85 : 1.7;
    const shots = Math.max(def.n <= 3 ? 16 : 18, Math.ceil(p90 * factor + 2));
    const three = shots - Math.ceil(med * 1.25), two = shots - Math.ceil(med * 1.7);
    const st = [Math.max(1, two), Math.max(2, three)];
    console.log(`${line}\n    → shots: ${shots}, stars: [${st.join(', ')}]`);
    changes.set(def.n, { shots, stars: st });
  } else console.log(line);
}

if (write) {
  const { readFileSync, writeFileSync } = await import('node:fs');
  const path = new URL('../../../src/games/bubblesort/levels.js', import.meta.url);
  let js = readFileSync(path, 'utf8');
  for (const [n, { shots, stars }] of changes) {
    const re = new RegExp(`(\\n    n: ${n}, name: [^\\n]*?)shots: \\d+, stars: \\[\\d+, \\d+\\]`);
    if (!re.test(js)) throw new Error(`level ${n}: not found`);
    js = js.replace(re, `$1shots: ${shots}, stars: [${stars[0]}, ${stars[1]}]`);
  }
  writeFileSync(path, js);
  console.log(`written: ${changes.size} levels`);
}
