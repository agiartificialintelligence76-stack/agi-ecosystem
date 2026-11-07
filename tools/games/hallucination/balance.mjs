// HALLUCINATION (2026-11-08): a balance check of the difference engine. Makes many scenes at every level and prints how
// often each kind of hallucination happens, how big the changes are by level, and which objects never change.
//   node tools/games/hallucination/balance.mjs [scenes=600]
import { makeScene, difficulty, KINDS } from '../../../src/games/hallucination/scene.js';
import { LIB } from '../../../src/games/hallucination/objects.js';

const n = Number(process.argv[2]) || 600;
const kinds = Object.fromEntries(KINDS.map((k) => [k, 0])), types = {}, byLevel = {};
const t0 = Date.now();
for (let i = 0; i < n; i++) {
  const level = 1 + (i % 12);
  const sc = makeScene((i * 2654435761 + 99) >>> 0, level);
  for (const d of sc.diffs) {
    kinds[d.kind]++;
    types[d.type] = (types[d.type] || 0) + 1;
    const a = (d.region[2] - d.region[0]) * (d.region[3] - d.region[1]);
    (byLevel[level] ||= []).push(a);
  }
}
console.log(`${n} scenes in ${Date.now() - t0} ms`);
console.log('kinds:', kinds);
for (const [l, list] of Object.entries(byLevel)) {
  list.sort((a, b) => a - b);
  console.log(`level ${l.padStart(2)}: change area median ${Math.round(list[list.length >> 1])}, smallest ${Math.round(list[0])} (min ${Math.round(difficulty(Number(l)).minArea)})`);
}
console.log('never changed:', Object.keys(LIB).filter((t) => !types[t]).join(' ') || 'none');
