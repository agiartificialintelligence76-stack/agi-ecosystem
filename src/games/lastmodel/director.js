// LAST MODEL STANDING: the spawn director. It decides what comes, and when, from the run's clock and its own seeded dice:
// a budget that grows every second buys bots from a mix that shifts with time (crawlers from 0:40, captchas and trolls
// from 2:00, ghosts after), with set pieces on top: swarmlet flocks, rings that close in, elites that drop a cache, and
// the bosses at 3:00, 6:00 and 9:00. Pure: the same seed and the same clock give the same orders (tests/lastmodel.test.js).
// The sim turns each order into bots just off the screen.
import { ENEMIES, BOSSES, ENEMY_CAP, WIN_TIME, minutes } from './rules.js';

export const RINGS = [150, 300, 450, 570];
// a budget per second (bots' cost), gentle at first, steeper later, and much steeper in overtime
export function budgetRate(t) {
  const m = minutes(t), o = Math.max(0, m - WIN_TIME / 60);
  return 1.65 + 0.62 * m + 0.29 * m * m + 4 * o + 2 * o * o;
}
// how many bots may be alive at once at this time
export const capAt = (t) => Math.min(ENEMY_CAP, Math.round(60 + 34 * minutes(t)));
// the mix: each kind's weight at this time (0: not yet)
export function mixAt(t) {
  const m = minutes(t);
  return [
    ['spam', 10],
    ['crawler', m >= 0.66 ? 3 + 0.6 * m : 0],
    ['troll', m >= 1.75 ? 1.5 + 0.22 * m : 0],
    ['captcha', m >= 2 ? 1.1 + 0.42 * m : 0],
    ['ghost', m >= 2.4 ? 2.2 + 0.3 * m : 0],
  ].filter(([, w]) => w > 0);
}
export const eliteEvery = (t) => (t >= WIN_TIME ? 24 : t >= 360 ? 44 : 55);

export function createDirector(rng, { from = 0, busy = 1 } = {}) {
  // a run that starts later (the demo) skips what would have come before
  let budget = 0, nextKind = null, nextElite = Math.max(75, from + 20), nextFlock = Math.max(52, from + 8);
  let ring = RINGS.filter((t) => t <= from).length, boss = BOSSES.filter((b) => b.t <= from).length;
  const pickKind = (t) => rng.weighted(mixAt(t), (x) => x[1])[0];
  return {
    get boss() { return boss; },
    // one step of `dt` seconds ending at `t`; `alive` bots now, `bossAlive` while a boss fights. → a list of orders:
    // { kind, mode: 'edge' | 'ring' | 'flock' | 'boss', n, elite, ang }
    step(t, dt, { alive = 0, bossAlive = false } = {}) {
      const out = [];
      // the bosses, on time
      while (boss < BOSSES.length && t >= BOSSES[boss].t) {
        out.push({ kind: BOSSES[boss].kind, mode: 'boss', n: 1, elite: false, ang: rng.range(0, Math.PI * 2) });
        boss++;
      }
      // rings that close in around her
      while (ring < RINGS.length && t >= RINGS[ring]) {
        const m = minutes(t);
        out.push({ kind: ring >= 2 ? 'captcha' : 'spam', mode: 'ring', n: ring >= 2 ? 16 + Math.round(2 * m) : 26 + Math.round(3 * m), elite: false, ang: 0 });
        ring++;
      }
      // a flock of swarmlets from one side
      if (t >= nextFlock) {
        const m = minutes(t);
        out.push({ kind: 'swarm', mode: 'flock', n: Math.min(32, 8 + Math.round(2.4 * m)), elite: false, ang: rng.range(0, Math.PI * 2) });
        nextFlock = t + rng.range(24, 34);
      }
      // an elite now and then (drops a cache)
      if (t >= nextElite) {
        out.push({ kind: pickKind(t), mode: 'edge', n: 1, elite: true, ang: rng.range(0, Math.PI * 2) });
        nextElite = t + eliteEvery(t);
      }
      // the steady stream, bought with the budget (less while a boss fights; nothing past the cap)
      budget += budgetRate(t) * dt * (bossAlive ? 0.5 : 1) * busy;
      budget = Math.min(budget, 40);
      let room = capAt(t) - alive;
      for (let guard = 0; guard < 24 && room > 0; guard++) {
        if (!nextKind) nextKind = pickKind(t);
        const cost = ENEMIES[nextKind].cost;
        if (budget < cost) break;
        budget -= cost;
        out.push({ kind: nextKind, mode: 'edge', n: 1, elite: false, ang: rng.range(0, Math.PI * 2) });
        nextKind = null;
        room--;
      }
      return out;
    },
  };
}
