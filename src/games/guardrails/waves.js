// GUARDRAILS: the waves. The first eleven are written by hand (each one meets you with one new trick), then a seeded
// generator takes over, a boss every tenth wave, harder every wave, forever (endless after 30). The same map, wave and
// seed always give the same wave, so the preview of the next wave is exactly what comes.
import { CREATURES, BOSSES, WALKERS, MAP } from './data.js';
import { rng } from '../kit/fx.js';

// how tough a gremlin is at a wave (its hp × this), and what it's worth (its reward × this)
export const hpMul = (w) => (1 + 0.1 * (w - 1) + 0.019 * (w - 1) ** 2) * 1.05 ** Math.max(0, w - 22);
export const rewardMul = (w) => 1 + 0.025 * (w - 1);
// a harder map is harder later, not at once: its toughness comes in over its first 15 waves
export const mapHp = (m, w) => 1 + (m - 1) * Math.min(1, (w - 1) / 15);
export const isBossWave = (w) => w > 0 && w % 10 === 0;
export const bossOf = (w) => (isBossWave(w) ? BOSSES[(w / 10 - 1) % BOSSES.length] : null);
// the break before a wave (after the last one has fully walked in) and what sending it early pays a second
export const breakBefore = (w) => (isBossWave(w) ? 18 : 14);
export const earlyRate = (w) => 1.2 + 0.06 * w;
// a wave cleared: its bonus (more when nothing got through)
export const clearBonus = (w, perfect) => Math.round((8 + 2 * w) * (perfect ? 1.5 : 1));

// [kind, count, gap between them (s), start (s after the wave begins)]
const EARLY = {
  1: [['ignore', 8, 1.1, 0]],
  2: [['ignore', 12, 0.85, 0]],
  3: [['ignore', 8, 0.9, 0], ['shot', 10, 0.22, 7]],
  4: [['ignore', 8, 0.9, 0], ['role', 3, 1.6, 4]],
  5: [['shot', 12, 0.2, 0], ['sudo', 4, 1.2, 3.5], ['ignore', 8, 0.8, 7]],
  6: [['smuggler', 5, 1.6, 0], ['ignore', 10, 0.7, 3]],
  7: [['blob', 4, 1.9, 0], ['ignore', 8, 0.7, 2], ['role', 4, 1.2, 6]],
  8: [['shot', 16, 0.18, 0], ['sudo', 6, 0.9, 4], ['smuggler', 4, 1.4, 7]],
  9: [['novel', 5, 1.6, 0], ['ignore', 10, 0.6, 2], ['blob', 3, 1.8, 8]],
  10: [['ignore', 10, 0.7, 0], ['megaprompt', 1, 0, 4], ['shot', 12, 0.2, 9]],
  11: [['grandma', 2, 3, 0], ['ignore', 12, 0.6, 1], ['role', 5, 1, 6]],
};
// how often each kind is picked by the generator, and how fast its group walks in (the gap between two of them)
const WEIGHT = { ignore: 3, shot: 2, role: 2, sudo: 2, smuggler: 2, blob: 2, novel: 2, grandma: 1.2 };
// the most of a kind in one group (a wave of nothing but sudos isn't a wave, it's a stampede)
const CAP = { ignore: (w) => 10 + w, shot: (w) => 14 + w, role: (w) => 6 + (w >> 1), sudo: (w) => 5 + (w >> 1), smuggler: (w) => 4 + (w >> 2),
  blob: (w) => 3 + (w >> 2), novel: (w) => 4 + (w >> 2), grandma: (w) => 1 + Math.floor(w / 6) };
const GAP = { ignore: 0.6, shot: 0.17, role: 0.9, sudo: 0.7, smuggler: 1.2, blob: 1.5, novel: 1.3, grandma: 2.6 };

const waveSeed = (mapId, w, seed) => {
  let h = (seed >>> 0) ^ 0x9e3779b9;
  for (const ch of `${mapId}:${w}`) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return h >>> 0;
};

// a wave's groups: [{ kind, n, gap, at, path }] (path: which entrance, for a map with two)
export function waveOf(mapId, w, seed = 1) {
  const paths = MAP[mapId].paths.length;
  const r = rng(waveSeed(mapId, w, seed));
  let groups;
  if (EARLY[w]) groups = EARLY[w].map(([kind, n, gap, at]) => ({ kind, n, gap, at }));
  else {
    groups = [];
    let budget = 18 + 3.4 * w;
    const boss = bossOf(w);
    if (boss) { budget *= 0.55; }
    const count = 2 + (w > 17 ? 1 : 0) + (w > 26 ? 1 : 0);
    const pool = WALKERS.map((k) => ({ k, weight: WEIGHT[k] * (k === 'grandma' || k === 'blob' ? 1 + w / 40 : 1) }));
    const picked = [];
    while (picked.length < count) {
      const p = r.weighted(pool.filter((x) => !picked.includes(x.k)));
      picked.push(p.k);
    }
    const shares = picked.map(() => 0.8 + r.next() * 0.45);
    const total = shares.reduce((a, b) => a + b, 0);
    const tight = Math.max(0.45, 1 - 0.014 * w);
    let at = 0;
    picked.forEach((k, i) => {
      const n = Math.min(CAP[k](w), Math.max(2, Math.round((budget * shares[i]) / total / CREATURES[k].cost)));
      const gap = +(GAP[k] * tight).toFixed(3);
      groups.push({ kind: k, n, gap, at: +at.toFixed(2) });
      at += Math.min(n * gap * 0.55, 8) + 1.5 + r.next() * 2;
    });
    if (boss) groups.splice(1, 0, { kind: boss, n: 1, gap: 0, at: 4 });
  }
  // two entrances: groups take turns (a boss takes the longer way in)
  groups.forEach((g, i) => { g.path = paths === 1 ? 0 : CREATURES[g.kind].boss ? 1 : i % paths; });
  return groups;
}

// what the next wave holds, for its preview: [{ kind, n }] (bosses first, then the most numerous)
export function previewOf(mapId, w, seed = 1) {
  const tally = new Map();
  for (const g of waveOf(mapId, w, seed)) tally.set(g.kind, (tally.get(g.kind) || 0) + g.n);
  return [...tally].map(([kind, n]) => ({ kind, n, boss: Boolean(CREATURES[kind].boss) }))
    .sort((a, b) => (b.boss - a.boss) || (b.n - a.n));
}

// a wave's spawns, one per gremlin, in the order they walk in: [{ at, kind, path }]
export function spawnsOf(mapId, w, seed = 1) {
  const out = [];
  for (const g of waveOf(mapId, w, seed)) for (let i = 0; i < g.n; i++) out.push({ at: g.at + i * g.gap, kind: g.kind, path: g.path });
  return out.sort((a, b) => a.at - b.at);
}
