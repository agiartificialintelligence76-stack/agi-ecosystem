// MERGE TO AGI (2026-11-08): the game's own player, for `?demo` (the gameplay preview on agi1.app/games) and the title
// screen's jar. For each column it can drop in (every 10 units, and right over each orb of its kind) it works out where
// the orb lands (./physics.js landing()) and scores the spot: a match there is worth a lot, a match beside it too, a low
// and flat pile is good, burying a smaller orb or going near the red line is bad. Pure (no DOM, no Math.random: its dice
// are a seeded kit rng), so a seed repeats the demo exactly.
import { JAR, landing, TICK } from './physics.js';
import { RADII, DROP_MAX } from './tiers.js';
import { LINE, drop, step, canDrop, clampX } from './rules.js';

const STEP_X = 10;
const spot = { y: 0, hit: null };

// the best x for the dropper's orb, with a little seeded wobble so it never plays the same way twice
export function chooseX(g, rand) {
  const t = g.current, r = RADII[t], orbs = g.world.orbs;
  let best = -Infinity, bestX = JAR.W / 2;
  const tryX = (x0) => {
    const x = clampX(x0, t);
    const s = scoreAt(orbs, x, t, r) + (rand ? rand.next() * 6 : 0);
    if (s > best) { best = s; bestX = x; }
  };
  for (let x = r; x <= JAR.W - r + 0.01; x += STEP_X) tryX(x);
  for (const o of orbs) if (o.tier === t) { tryX(o.x); tryX(o.x - 4); tryX(o.x + 4); }
  return bestX;
}

export function scoreAt(orbs, x, t, r) {
  landing(orbs, x, r, spot);
  const ly = spot.y, hit = spot.hit;
  let s = 0;
  if (hit && hit.tier === t) s += 120 + 14 * t;
  for (const o of orbs) {
    if (o === hit) continue;
    const dx = o.x - x, dy = o.y - ly;
    const gap = Math.sqrt(dx * dx + dy * dy) - o.r - r;
    if (gap > 9) continue;
    if (o.tier === t) s += 60;
    else if (hit && hit.tier === t && o.tier === t + 1) s += 34;   // its merge would chain
    else if (o.tier < t && o.y > ly) s -= 11 * (t - o.tier);        // burying a smaller one
    else if (o.tier === t + 1 || o.tier === t - 1) s += 6;
  }
  // a low pile, and a flat one
  s -= (JAR.H - ly) * 0.24;
  // big drops toward the walls, small ones anywhere
  if (t >= 4) s -= Math.min(x - r, JAR.W - r - x) * 0.03 * t;
  // never near the red line
  const room = ly - r - LINE;
  if (room < 70) s -= (70 - room) * 7;
  return s;
}

// the demo's lucky dropper: now and then it hands out a tier that's lying on top of the pile, so merges keep coming
export function luckyPicker(rand, chance = 0.55) {
  return (g) => {
    if (!rand.chance(chance)) return null;
    const orbs = g.world.orbs, top = [];
    for (const o of orbs) {
      if (o.tier > DROP_MAX) continue;
      landing(orbs, o.x, o.r, spot);
      if (spot.hit === o) top.push(o.tier);
    }
    if (!top.length) return null;
    top.sort((a, b) => b - a);
    // the bigger ones a little more often: bigger merges, bigger moments
    return top[Math.min(top.length - 1, Math.floor(rand.next() ** 1.6 * top.length))];
  };
}

// a mid-game jar for the demo: the player plays `drops` drops at speed (half a second of physics each); the run's score
// and pile stay, its events are dropped
export function prefill(g, rand, { drops = 40, stopAt = 0.6 } = {}) {
  for (let i = 0; i < drops && !g.over; i++) {
    while (!canDrop(g)) step(g);
    drop(g, chooseX(g, rand));
    for (let k = 0; k < Math.round(0.5 / TICK); k++) step(g);
    g.events.length = 0;
    // stop once the jar is about this full (the pile's top this far down from the rim to the floor)
    if (pileTop(g) < JAR.H * (1 - stopAt)) break;
  }
  // and let it settle
  for (let k = 0; k < Math.round(1 / TICK) && !g.over; k++) step(g);
  g.events.length = 0;
  g.danger = 0;
  return g;
}

// the top of the pile (orbs at rest only: one still falling doesn't count)
export function pileTop(g) {
  let top = JAR.H;
  for (const o of g.world.orbs) if (o.vx * o.vx + o.vy * o.vy < 80 * 80) top = Math.min(top, o.y - o.r);
  return top;
}
