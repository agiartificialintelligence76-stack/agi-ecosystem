// WEB SCRAPER: the rival scrapers' minds (and the player's, in the demo, the tests and the balance tool). Every few
// tenths of a second a portal looks round: what it could swallow nearby (worth more when bigger, less when far), a
// smaller portal worth chasing, a bigger one to run from. It heads for the best of them, and runs when it must. Their
// skill is how far they look, how brave they are and how often they dither.
import { near, canEat, TUNE } from './rules.js';
import { rng } from '../kit/fx.js';

export const PROFILES = Object.freeze({
  newbie: { look: 7, brave: 0.4, dither: 0.25, think: 0.5 },
  steady: { look: 10, brave: 0.7, dither: 0.08, think: 0.3 },
  expert: { look: 14, brave: 0.9, dither: 0.02, think: 0.2 },
});
export function createBrain(profile = 'steady', seed = 1) {
  const rnd = rng(seed ^ 0xa11ce);
  return { p: PROFILES[profile] || PROFILES.steady, rnd, t: 0, want: { x: 0, y: 0 }, wander: rnd.next() * 6.28 };
}

export function think(brain, S, h, dt) {
  brain.t -= dt;
  if (brain.t > 0) return brain.want;
  const p = brain.p;
  brain.t = p.think * (0.8 + brain.rnd.next() * 0.4);
  const look = p.look + h.r * 2.5;
  let bx = 0, by = 0, best = 0;
  // food: worth more when it's bigger, less when it's far
  for (const it of near(S, h.x, h.y, look)) {
    if (!canEat(h, it.r)) continue;
    const d = Math.hypot(it.x - h.x, it.y - h.y) + 0.5;
    const v = (it.value + 2) / (d * d * 0.35 + 1);
    bx += ((it.x - h.x) / d) * v; by += ((it.y - h.y) / d) * v;
    best += v;
  }
  // other portals: chase the smaller, run from the bigger
  let fx = 0, fy = 0, chase = null;
  for (const o of S.holes) {
    if (o === h || o.dead > 0) continue;
    const d = Math.hypot(o.x - h.x, o.y - h.y) + 0.1;
    if (o.r >= h.r * TUNE.holeEat * 0.97 && d < o.r * 2.5 + 5) { const k = 6 / d; fx -= ((o.x - h.x) / d) * k; fy -= ((o.y - h.y) / d) * k; }
    else if (h.r >= o.r * TUNE.holeEat && d < look * p.brave && (!chase || d < chase.d)) chase = { o, d };
  }
  let x = bx, y = by;
  if (chase) { const k = 3 + best; x += ((chase.o.x - h.x) / chase.d) * k; y += ((chase.o.y - h.y) / chase.d) * k; }
  if (fx || fy) { const k = Math.max(1, best) * 3; x = x * 0.3 + fx * k; y = y * 0.3 + fy * k; }
  if (Math.hypot(x, y) < 0.01 || brain.rnd.chance(p.dither)) {
    // nothing near: wander toward the middle of the city
    brain.wander += brain.rnd.range(-0.8, 0.8);
    x = Math.cos(brain.wander) + (S.size / 2 - h.x) * 0.02; y = Math.sin(brain.wander) + (S.size / 2 - h.y) * 0.02;
  }
  // away from the edges
  const m = 3 + h.r;
  if (h.x < m) x += 2; if (h.y < m) y += 2; if (h.x > S.size - m) x -= 2; if (h.y > S.size - m) y -= 2;
  const n = Math.hypot(x, y) || 1;
  brain.want = { x: x / n, y: y / n };
  return brain.want;
}

// a whole round with bots in every seat → { rank, score, share, best size }
export async function playRound({ mode = 'battle', seed = 1, profile = 'steady', rivals = 'steady' } = {}) {
  const { createRound, update, drain, rankOf, share } = await import('./rules.js');
  const S = createRound({ mode, seed });
  const brains = new Map(S.holes.map((h, i) => [h, createBrain(h.you ? profile : rivals, seed + i * 31)]));
  const dt = 1 / 30;
  while (!S.over) { update(S, dt, (h) => think(brains.get(h), S, h, dt)); drain(S); }
  return { rank: rankOf(S, S.me), score: S.me.score, share: share(S), best: S.me.best, deaths: S.me.deaths, kills: S.me.kills, scores: S.holes.map((h) => h.score) };
}
