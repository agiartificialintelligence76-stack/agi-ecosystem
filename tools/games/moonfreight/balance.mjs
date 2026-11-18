import { choose, options, seeded, placement } from '../../../src/games/moonfreight/ai.js';
import { copyBalls, simulateShot, respot, dist } from '../../../src/games/moonfreight/physics.js';
import { rack } from '../../../src/games/moonfreight/tables.js';
import { targets, ruling } from '../../../src/games/moonfreight/rules.js';
const cfg = {
  newbie: {
    skill: 0,
    think: 9.4
  },
  steady: {
    skill: 2,
    think: 9.2
  },
  expert: {
    skill: 5,
    think: 6.5
  }
};
export function play(profile, seed) {
  const {
      skill,
      think
    } = cfg[profile],
    rng = seeded(seed);
  let innings = 5,
    chalk = 0,
    racks = 0,
    turn = 0,
    seconds = 0,
    score = 0,
    legal = 0,
    first = 0,
    pots = 0,
    scratches = 0,
    empty = 0,
    leave = 0,
    banks = 0;
  let table = rack(0, 0, seed),
    balls = copyBalls(table.balls);
  while (innings > 0 && turn < 165) {
    const shot = choose(balls, table.wells, 0, skill, rng, table.condition),
      eligible = targets(balls, 0),
      before = balls,
      out = simulateShot(balls, table.wells, shot);
    balls = out.balls;
    const v = ruling(before, out.log, 0, shot.called, table.condition);
    turn++;
    seconds += out.log.time + think * (.72 + .57 * rng());
    first += Number(eligible.includes(out.log.first));
    legal += Number(!v.foul);
    pots += v.foul ? 0 : v.own;
    score += v.foul ? 0 : v.own * 105 + 24;
    if (!v.foul && v.own) {
      chalk += v.own;
      if (chalk >= 2) {
        innings = Math.min(8, innings + 1);
        chalk -= 2;
      }
    }
    if (shot.rail && !v.foul && v.own) banks++;
    if (out.log.pots.some(p => !p.id)) {
      scratches++;
      respot(balls, 0);
    }
    if (v.returnMoon) {
      const m = balls.find(b => b.suit === 'moon');
      respot(balls, m.id, 530, 200);
    }
    const potential = targets(balls, 0);
    if (potential.length) leave += Math.min(...balls.filter(b => potential.includes(b.id)).map(b => dist(b.x, b.y, balls[0].x, balls[0].y)));
    if (v.win) {
      score += 400 + table.level * 115;
      racks++;
      innings = Math.min(6, innings + 2);
      table = rack(Math.min(racks, 5), racks % 3, seed + racks);
      balls = copyBalls(table.balls);
    } else if (!v.keep) {
      empty++;
      innings--;
      if (v.ballInHand) {
        const [x, y] = placement(balls, 0, skill, rng);
        respot(balls, 0, x, y);
      }
    }
  }
  return {
    seconds,
    score,
    turn,
    first: first / turn,
    legal: legal / turn,
    rate: pots / turn,
    scratches,
    empty,
    leave: leave / turn,
    banks,
    racks
  };
}
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/moonfreight/balance.mjs')) {
  const n = Number(process.argv[2]) || 20;
  for (const tag of Object.keys(cfg)) {
    const rows = Array.from({
        length: n
      }, (_, i) => play(tag, 173 + i * 7919)),
      q = (k, p = .5) => rows.map(r => r[k]).sort((a, b) => a - b)[Math.floor((n - 1) * p)];
    console.log(tag + ' · seconds p10/50/90 ' + [.1, .5, .9].map(p => q('seconds', p).toFixed(1)).join('/') + ' · score p25/50/75 ' + [.25, .5, .75].map(p => q('score', p)).join('/') + ' · first contact ' + (q('first') * 100).toFixed(0) + '% · legal pots/stroke ' + q('rate').toFixed(2) + ' · scratches/rack ' + (rows.reduce((s, r) => s + r.scratches, 0) / rows.reduce((s, r) => s + r.racks + 1, 0)).toFixed(2) + ' · empty innings ' + q('empty') + ' · average leave ' + q('leave').toFixed(0) + ' felt units · scored banks ' + rows.reduce((s, r) => s + r.banks, 0));
  }
}
