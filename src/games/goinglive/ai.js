// GOING LIVE: the game's own streamers. They play a stream the way a person does (a moment to notice each thing, now and
// then a miss, a heart caught or not, the big moment tapped as fast as their thumbs go), choose what to stream and spend
// their views on the room. The tile's preview plays with `demo`; tools/games/goinglive/balance.mjs runs whole careers
// with the others to tune the numbers; the tests hold the promises.
import { createStream, step, tap, drain } from './stream.js';
import { TUNE } from './data.js';
import { newCareer, unlocked, appeal, startViewers, busyOf, upgrade, bestUpgrades, applyStream, idleRate, trendOf, isOpen, nextRoom, moveRoom } from './econ.js';
import { dice } from './stream.js';

// react: seconds to notice (± half); miss: the chance of not tapping something that needs it; heart: the chance of
// catching a heart; mash: taps a second in the big moment; pick: how well they choose what to stream; shop: how well they
// spend (1 = the best upgrades for what they stream, 0 = whatever they can get)
export const PROFILES = Object.freeze({
  newbie: { react: 1.45, miss: 0.2, heart: 0.3, mash: 4.6, pick: 0.2, shop: 0.2 },
  casual: { react: 1.0, miss: 0.1, heart: 0.55, mash: 6.5, pick: 0.6, shop: 0.6 },
  good: { react: 0.68, miss: 0.045, heart: 0.8, mash: 8.5, pick: 0.85, shop: 0.85 },
  pro: { react: 0.45, miss: 0.015, heart: 0.95, mash: 10.5, pick: 1, shop: 1 },
  demo: { react: 0.75, miss: 0.06, heart: 0.85, mash: 8, pick: 0.8, shop: 0.9 },
});

export function createPlayer(profile = 'good', seed = 1) {
  return { name: profile, p: PROFILES[profile] || PROFILES.good, r: dice((seed ^ 0x2545f491) >>> 0), plan: new Map(), mashT: 0, last: null };
}
// one step of a stream: decide about what's new, tap what's due (`last`: the target it tapped, for the page to show)
export function playStep(bot, S, dt) {
  bot.last = null;
  const { p, r } = bot;
  for (const x of S.targets) {
    if (bot.plan.has(x.id)) continue;
    const want = x.kind === 'heart' ? r() < p.heart : x.kind === 'clip' ? r() < Math.min(1, p.heart + 0.1) : r() >= p.miss;
    bot.plan.set(x.id, want ? x.born + Math.max(0.18, p.react * r.range(0.55, 1.45)) : Infinity);
  }
  for (const x of [...S.targets]) {
    const at = bot.plan.get(x.id);
    if (!(S.t >= at)) continue;
    if (x.kind === 'big') {
      bot.mashT -= dt;
      if (bot.mashT <= 0) { bot.mashT = 1 / (p.mash * r.range(0.8, 1.2)); tap(S, x.id); bot.last = x; }
    } else { tap(S, x.id); bot.last = x; bot.plan.delete(x.id); }
  }
}
// a new stream: what it planned for the last one is forgotten (a stream's targets count from 1 again)
export function resetPlayer(bot) { bot.plan.clear(); bot.mashT = 0; bot.last = null; }
// a whole stream, as fast as the rules go
export function playStream(S, bot, dt = 1 / 30) {
  resetPlayer(bot);
  while (!S.over) { playStep(bot, S, dt); step(S, dt); drain(S); }
  return S.over;
}

// what to stream: the best draw, or (a less careful player) whatever they like
export function chooseCat(c, bot) {
  const open = unlocked(c), tr = trendOf(c);
  const ranked = open.map((k) => ({ id: k.id, a: appeal(c, k.id, { trend: tr }) })).sort((a, b) => b.a - a.a);
  if (bot.r() < bot.p.pick) return ranked[0].id;
  return bot.r.pick(ranked).id;
}
// spend views on the room: the best upgrades for what they stream (or a random one they can get)
export function shop(c, bot, { cats = null } = {}) {
  const open = cats || unlocked(c).map((k) => k.id);
  // a bigger room first, when they can (a careful player saves for it once they have the followers)
  const r = nextRoom(c);
  if (r && c.followers >= r.at) { if (moveRoom(c)) return shop(c, bot, { cats }); if (bot.r() < bot.p.shop) return; }
  for (let guard = 0; guard < 40; guard++) {
    let pick = null;
    if (bot.r() < bot.p.shop) {
      const all = open.flatMap((id) => bestUpgrades(c, id).map((u) => ({ ...u, id })));
      all.sort((a, b) => b.per - a.per);
      pick = all.find((u) => u.tier.cost <= c.views && u.gain > 0) || null;
    } else {
      const can = bestUpgrades(c, open[0]).filter((u) => u.tier.cost <= c.views);
      pick = can.length ? bot.r.pick(can) : null;
    }
    if (!pick || !upgrade(c, pick.slot)) break;
  }
}
// A whole career: `streams` streams, `hub` seconds in her room between them (it earns), the time each milestone came.
export function career(profile = 'good', { streams = 80, seed = 1, hub = 25, until = Infinity } = {}) {
  const bot = createPlayer(profile, seed), c = newCareer();
  const log = [];
  let time = 0;
  for (let i = 0; i < streams && c.followers < until; i++) {
    const cat = chooseCat(c, bot);
    const S = createStream({ cat, v0: startViewers(c, cat), busy: busyOf(c.followers), followers: c.followers, seed: seed * 1000 + i + 1 });
    const res = playStream(S, bot);
    applyStream(c, res);
    time += TUNE.dur + hub;
    c.views += idleRate(c) * hub;
    shop(c, bot);
    log.push({ i: i + 1, time, cat, followers: c.followers, views: Math.round(c.views), peak: res.peak, grade: res.grade, open: isOpen(c, 'dance') });
  }
  return { c, log, time };
}
