// MERGE TO AGI (2026-11-08): one run's rules, on top of the jar's physics (./physics.js): the dropper and its queue, the
// drop cooldown, points and chains, the red line and its timer, the end of the run. Pure: no DOM, no clock of its own
// (it moves on one physics tick at a time), no Math.random (a seeded kit rng: the same seed and drops, the same run).
import { rng } from '../kit/fx.js';
import { createWorld, JAR, TICK, CHAIN_T } from './physics.js';
import { RADII, MAX_TIER, SINGULARITY, DROP_MAX, points, spawnTier } from './tiers.js';

export const LINE = 34;           // the red line (logical y, below the rim at 0): an orb whose top stays above it…
export const OVER_T = 2.0;        // …this long (s) ends the run
export const EXEMPT_T = 1.2;      // s a dropped orb is exempt (it falls through the line on its way in)
export const SETTLED_V = 320;     // units/s: an orb flying faster than this isn't "settled" (a pop, a bounce)
export const COOLDOWN = 0.45;     // s between drops
export const DROP_TOP = -112;     // the dropper: its orb hangs from here (its top), so its centre is DROP_TOP + r
export const dropY = (tier) => DROP_TOP + RADII[tier];
export const clampX = (x, tier) => Math.max(RADII[tier], Math.min(JAR.W - RADII[tier], x));

// a new run: `seed` makes the queue; `pick(game)` may choose the next tier itself (the demo's lucky dropper), else null
export function createGame({ seed = 1, pick = null } = {}) {
  const g = {
    seed, rand: rng(seed >>> 0), pick,
    world: createWorld(),
    time: 0, ticks: 0, score: 0, merges: 0, drops: 0,
    chain: 0, lastMerge: -99, longestChain: 0,
    top: 0,                      // the biggest tier seen this run (dropped or made); 12 once there was a SINGULARITY
    biggest: 0,                  // the biggest tier made by a merge
    singularities: 0,
    current: 0, next: 0, queued: 0, cooldown: 0,
    danger: 0, near: Infinity, overLine: false, over: false,
    events: [],
  };
  g.current = take(g);
  g.next = take(g);
  g.top = g.current;
  return g;
}

function take(g) {
  const t = g.pick?.(g);
  const tier = Number.isInteger(t) && t >= 1 && t <= DROP_MAX ? t : spawnTier(g.rand, g.queued);
  g.queued++;
  return tier;
}

export const canDrop = (g) => !g.over && g.cooldown <= 0;

// drop the dropper's orb at x (clamped inside the jar); → the new orb, or null (cooling down, or the run is over)
export function drop(g, x) {
  if (!canDrop(g)) return null;
  const tier = g.current;
  const o = g.world.add(tier, clampX(x, tier), dropY(tier), { exempt: EXEMPT_T, vy: 40 });
  g.drops++;
  g.cooldown = COOLDOWN;
  g.current = g.next;
  g.next = take(g);
  if (tier > g.top) g.top = tier;
  if (g.current > g.top) g.top = g.current;
  g.events.push({ type: 'drop', tier, x: o.x, y: o.y, orb: o });
  return o;
}

// one physics tick (1/120 s of the run's own time). Its events are appended to g.events (the game reads and clears them).
export function step(g) {
  if (g.over) return g.events;
  g.time += TICK;
  g.ticks++;
  if (g.cooldown > 0) g.cooldown = Math.max(0, g.cooldown - TICK);
  const evs = g.world.step();
  for (const e of evs) {
    if (e.type === 'merge' || e.type === 'singularity') score(g, e);
    g.events.push(e);
  }
  // the red line: an orb (not just dropped, not flying) whose top is above it; its timer ends the run
  let near = Infinity, overLine = false;
  for (const o of g.world.orbs) {
    if (o.exempt > 0) continue;
    const gap = o.y - o.r - LINE;
    if (gap < near) near = gap;
    if (gap < 0 && o.vx * o.vx + o.vy * o.vy < SETTLED_V * SETTLED_V) overLine = true;
  }
  g.near = near;
  g.overLine = overLine;
  if (overLine) g.danger += TICK;
  else g.danger = Math.max(0, g.danger - TICK * 3);
  if (g.danger >= OVER_T) {
    g.danger = OVER_T;
    g.over = true;
    g.events.push({ type: 'over', score: g.score, time: g.time });
  }
  return g.events;
}

// points and chains for a merge (or the SINGULARITY): the physics says which step of a chain it is (a merge set off by
// a merge less than CHAIN_T ago: ./physics.js), and that step is the multiplier
function score(g, e) {
  g.chain = e.chain || 1;
  g.lastMerge = g.time;
  e.points = points(e.tier) * g.chain;
  g.score += e.points;
  g.merges++;
  if (g.chain > g.longestChain) g.longestChain = g.chain;
  const made = e.type === 'singularity' ? SINGULARITY : e.tier;
  if (e.type === 'singularity') g.singularities++;
  if (made > g.biggest) g.biggest = Math.min(made, SINGULARITY);
  e.first = made > g.top;               // the first of its kind this run
  if (made > g.top) g.top = made;
}

// how full the jar is, 0 (empty) to 1 (the pile's top at the red line): for the warning glow and the demo's player
export function fullness(g) {
  if (!Number.isFinite(g.near)) return 0;
  return Math.max(0, Math.min(1, 1 - g.near / (JAR.H - LINE)));
}

export { MAX_TIER, SINGULARITY, CHAIN_T };
