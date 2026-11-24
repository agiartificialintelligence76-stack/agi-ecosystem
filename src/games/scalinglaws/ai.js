// SCALING LAWS: a player made of code, for the demo (the previews on agi1.app/games), the title's attract run, the tests
// and the balance tool (tools/games/scalinglaws/balance.mjs). It reads the next few metres: the better gate of a pair
// (the one that leaves the bigger crowd), the gap in a wall, the side of the road away from a hole, where a saw will be
// when the crowd gets there, and crystals when nothing else matters. Its skill is how far ahead it looks, how often it
// picks the worse gate, and how late it reacts.
import { apply, sawX, formation, TUNE } from './rules.js';
import { rng, clamp } from '../kit/fx.js';

export const PROFILES = Object.freeze({
  newbie: { look: 7, wrong: 0.3, jitter: 0.25, react: 0.35 },
  steady: { look: 11, wrong: 0.06, jitter: 0.06, react: 0.12 },
  expert: { look: 14, wrong: 0, jitter: 0, react: 0.05 },
});
export const createBot = (profile = 'steady', seed = 1) => ({ p: PROFILES[profile] || PROFILES.steady, rnd: rng(seed ^ 0xbeef), tx: 0, t: 0, choice: new Map() });

// where it wants the crowd to be (−1..1)
export function steer(bot, S, dt = 1 / 60) {
  const p = bot.p;
  bot.t -= dt;
  if (bot.t > 0) return bot.tx;
  bot.t = p.react;
  const f = formation(S.n);
  const safe = 0.95 - f.r;
  let want = null, urgency = 99;
  const tail = f.r * f.depth * 0.62 + 0.3;
  for (const it of S.items) {
    if (it.done) continue;
    // (a hole stays a worry until the whole crowd is past it)
    if (it.kind === 'pit' ? it.z1 < S.z - tail : it.z < S.z - 0.5) continue;
    const ahead = Math.max(0, it.z - S.z);
    if (ahead > p.look) break;
    let x = null;
    if (it.kind === 'gates') {
      let side = bot.choice.get(it.id);
      if (side == null) {
        const a = apply(it.ops[0], S.n), b = apply(it.ops[1], S.n);
        side = a === b ? (S.x < 0 ? 0 : 1) : a > b ? 0 : 1;
        if (bot.rnd.chance(p.wrong)) side = 1 - side;
        bot.choice.set(it.id, side);
      }
      x = side ? 0.5 : -0.5;
    } else if (it.kind === 'wall') x = (it.gap[0] + it.gap[1]) / 2;
    else if (it.kind === 'pit') x = it.x[0] < 0 ? Math.max(it.x[1] + f.r + 0.06, 0.2) : Math.min(it.x[0] - f.r - 0.06, -0.2);
    else if (it.kind === 'saw') {
      const tAt = S.time + ahead / TUNE.speed;
      const sx = sawX(it, tAt);
      x = sx > 0 ? sx - 0.62 : sx + 0.62;
    } else if (it.kind === 'gem' && urgency > 50) { if (want == null) { want = it.x; urgency = 60; } continue; }
    else continue;
    if (ahead < urgency) { want = x; urgency = ahead; }
  }
  const target = want == null ? 0 : want;
  bot.tx = clamp(target + (bot.rnd.next() - 0.5) * p.jitter, -safe, safe);
  return bot.tx;
}

// a whole level played by a bot → { won, n, score, z, time, … }
export async function playRun({ level = 1, seed = 1, profile = 'steady', mode = 'campaign', upgrades = {}, maxTime = 600 } = {}) {
  const { createRun, update, drain } = await import('./rules.js');
  const S = createRun({ level, seed, mode, upgrades });
  const bot = createBot(profile, seed);
  const dt = 1 / 60;
  while (!S.over && S.time < maxTime) { update(S, dt, steer(bot, S, dt)); drain(S); }
  return { won: S.won, score: S.score, n: S.atFinale, step: S.step, z: S.z, time: S.time, cause: S.cause, peak: S.peak, gems: S.gems, stats: S.stats };
}
