import { plans, makeYard } from './yards.js';
import { key, legal, apply, solved } from './rules.js';
import { book } from './station-book.js';
import { mealScore, medal } from './progress.js';
const profiles = {
  newbie: {
    explore: .35,
    buffer: .17,
    inspect: 2.05,
    read: 6.2,
    lookahead: 1,
    scan: .32
  },
  steady: {
    explore: .12,
    buffer: .058,
    inspect: 1.61,
    read: 4.5,
    lookahead: 2,
    scan: .42
  },
  expert: {
    explore: .015,
    buffer: .008,
    inspect: .77,
    read: 2.2,
    lookahead: 3,
    scan: .13
  }
};
function randomizer(seed) {
  let s = seed >>> 0;
  return () => (s = Math.imul(1664525, s) + 1013904223 >>> 0) / 4294967296;
}
function returnTo(yard, s, wanted, depth) {
  if (key(yard, s) === wanted) return [];
  if (!depth) return null;
  for (const [a, n] of legal(yard, s)) {
    const tail = returnTo(yard, n, wanted, depth - 1);
    if (tail) return [a, ...tail];
  }
  return null;
}
// A controller occasionally explores a legal spur or attempts to push an unlinked car.
// If its trial can't return to the prior plan in two operations it physically undoes that action.
// All movement, collisions, coupling and score come from the cartridge rules.
export function simulate(persona, seed) {
  const cfg = profiles[persona],
    rng = randomizer(seed),
    out = {
      score: 0,
      seconds: 0,
      failed: 0,
      undone: 0,
      stars: 0,
      perfect: 0,
      yards: 0,
      wrongOrder: 0,
      extraLinks: 0,
      byLine: Array.from({
        length: 6
      }, () => []),
      hotspots: [0, 0, 0, 0, 0, 0]
    };
  for (let i = 0; i < plans.length; i++) {
    const y = makeYard(i),
      path = [...book[i]].map(ch => parseInt(ch, 16));
    let state = y.start,
      steps = 0,
      links = 0;
    const started = out.seconds;
    out.seconds += cfg.read * (1 + .16 * y.tickets.flat().length + .18 * y.devices.length);
    const think = () => out.seconds += (cfg.inspect + cfg.scan * Math.max(0, legal(y, state).length - 2)) * (.71 + .62 * rng()) * (1 + Math.min(.38, .045 * y.points.length / 3 + .043 * y.tickets.flat().length));
    function count(before, a, after) {
      if (a >= 4 && a <= 8) links++;
      if (a < 4 && after.cars.some((p, car) => p >= 0 && p !== before.cars[car] && y.windows.includes(p))) out.wrongOrder++;
    }
    for (const best of path) {
      if (rng() < cfg.buffer) {
        const blocked = [0, 1, 2, 3].filter(dir => !apply(y, state, dir));
        if (blocked.length) {
          if (apply(y, state, blocked[Math.floor(rng() * blocked.length)])) throw Error('bad buffer');
          out.failed++;
          out.hotspots[y.line]++;
          think();
        }
      }
      if (rng() < cfg.explore) {
        const options = legal(y, state).filter(([a, n]) => a !== best && !solved(n));
        if (options.length) {
          const [a, trial] = options[Math.floor(rng() * options.length)];
          const back = returnTo(y, trial, key(y, state), cfg.lookahead);
          think();
          if (back) {
            count(state, a, trial);
            state = trial;
            steps++;
            for (const a of back) {
              const after = apply(y, state, a);
              count(state, a, after);
              state = after;
              steps++;
              think();
            }
          } else {
            out.undone++;
            out.hotspots[y.line]++;
            think();
          }
        }
      }
      const next = apply(y, state, best);
      if (!next) throw Error(i + ' route');
      count(state, best, next);
      state = next;
      steps++;
      think();
    }
    if (!solved(state)) throw Error('unserved yard');
    out.byLine[y.line].push({
      steps,
      seconds: out.seconds - started
    });
    out.extraLinks += Math.max(0, links - path.filter(a => a >= 4 && a <= 8).length);
    out.yards++;
    out.score += mealScore(steps, path.length);
    out.stars += medal(steps, path.length);
    if (steps === path.length) out.perfect++;
  }
  return out;
}
