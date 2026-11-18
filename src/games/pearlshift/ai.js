import { createSurvey, move, depth, tune, ping, broadcast, abandon, observations, step, drain } from './rules.js';
import { bestFix } from './acoustics.js';
import { unit } from './catalog.js';
const pilots = {
  newbie: {
    pace: 4.7,
    aim: .15,
    hear: .70
  },
  steady: {
    pace: 3.55,
    aim: .071,
    hear: .89
  },
  expert: {
    pace: 2.25,
    aim: .021,
    hear: .992
  },
  demo: {
    pace: .96,
    aim: .008,
    hear: 1
  }
};
const spots = [[.22, .72], [.76, .77], [.18, .27], [.77, .23], [.47, .86]];
// Read a trace from the same receivers the player sees. A bot only knows a fix from deposited bearings.
export function surveyor(profile = 'demo', seed = 7) {
  const p = pilots[profile];
  let wait = .72,
    turn = 0,
    station = -1,
    spot = 0;
  return {
    drive(s, dt) {
      if (s.ended || s.phase !== 'scan') return;
      if (s.serial !== station) {
        station = s.serial;
        spot = s.samples.length;
        wait = p.pace * .55;
      }
      wait -= dt;
      if (wait > 0) return;
      wait = p.pace;
      const dice = () => unit(seed, turn++),
        target = s.request,
        ob = observations(s).find(o => o.species === target);
      if (s.tuned !== target && dice() < p.hear) {
        tune(s);
        return;
      }
      if (ob.layers !== 0 && dice() < p.hear) {
        depth(s, ob.layers > 0 ? 1 : -1);
        return;
      }
      const fix = bestFix(s.samples.filter(p => p.depth === s.receiver.depth), s.tuned);
      if (fix) {
        const error = p.aim * (1 + Math.min(.7, s.region.speed)),
          dx = (dice() + dice() - 1) * error,
          dy = (dice() + dice() - 1) * error;
        move(s, fix.x + dx, fix.y + dy);
        broadcast(s);
        if (s.scanMisses >= 2 && s.budget > 0) {
          const a = spots[spot++ % spots.length];
          move(s, ...a);
          ping(s);
        }
      } else if (s.budget > 0) {
        const a = spots[spot++ % spots.length];
        move(s, a[0] + (dice() - .5) * .07, a[1] + (dice() - .5) * .07);
        ping(s);
      } else abandon(s);
    }
  };
}
export function simulate(profile, seed = 7, mode = 'night', limit = 1200) {
  const s = createSurvey({
      mode,
      seed
    }),
    pilot = surveyor(profile, seed + 111),
    dt = 1 / 20;
  while (!s.ended && s.time < limit) {
    pilot.drive(s, dt);
    step(s, dt);
    drain(s);
  }
  return {
    time: s.time,
    score: s.score,
    finds: s.total,
    pings: s.spent,
    misses: s.mistakes,
    region: s.shift.region,
    exact: s.perfect
  };
}
