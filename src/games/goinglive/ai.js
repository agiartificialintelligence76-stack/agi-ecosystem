// GOING LIVE: the game's own players. In a live stream they tap the way a person does (a moment to notice each thing, now
// and then a miss, the big moment as fast as their thumbs go). In her career they pick video ideas, buy and place things,
// spend idea points, catch the drone, zap the bots and go live when the meter's full. The tile's preview plays with
// `demo`; tools/games/goinglive/balance.mjs runs whole careers with the others to tune the numbers; the tests hold the
// promises.
import { createStream, step, tap, drain, dice } from './stream.js';
import { itemOf, pointsOf, PERKS, TUNE } from './data.js';
import { layer, store } from './room.js';
import {
  newCareer, tick, drain as drainCareer, startVideo, expected, expectedFollowers, slotsOf, shopItems, canBuy, buy, boxLeft, tapBox, openBox, placeFromInv,
  autoSpot, hasSpot, canPerk, buyPerk, canMoveHome, moveHome, liveReady, liveStart, liveDone, catchDrone, zap, pet, scores, newIdeas, ideasReady,
} from './econ.js';

// react: seconds to notice (± half); miss: the chance of not tapping something that needs it; heart: the chance of
// catching a heart; mash: taps a second in the big moment; pick: how well they choose an idea; shop: how well they spend;
// catch: the chance they catch the drone and zap the bots; every: seconds between their looks at the shop
export const PROFILES = Object.freeze({
  newbie: { react: 1.45, miss: 0.2, heart: 0.3, mash: 4.6, pick: 0.35, shop: 0.3, catch: 0.3, every: 30 },
  casual: { react: 1.0, miss: 0.1, heart: 0.55, mash: 6.5, pick: 0.65, shop: 0.6, catch: 0.55, every: 18 },
  good: { react: 0.68, miss: 0.045, heart: 0.8, mash: 8.5, pick: 0.85, shop: 0.85, catch: 0.8, every: 10 },
  pro: { react: 0.45, miss: 0.015, heart: 0.95, mash: 10.5, pick: 1, shop: 1, catch: 0.95, every: 6 },
  demo: { react: 0.75, miss: 0.06, heart: 0.85, mash: 8, pick: 0.8, shop: 0.9, catch: 0.9, every: 8 },
});

export function createPlayer(profile = 'good', seed = 1) {
  return { name: profile, p: PROFILES[profile] || PROFILES.good, r: dice((seed ^ 0x2545f491) >>> 0), plan: new Map(), mashT: 0, last: null, shopT: 0 };
}
// ---------- a live stream ----------
// one step: decide about what's new, tap what's due (`last`: the target it tapped, for the page to show)
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

// ---------- her career ----------
// the idea that grows her channel most (or, for a less careful player, any)
export function pickIdea(c, bot) {
  const s = scores(c), v = c.ideas.map((x, k) => ({ k, e: expectedFollowers(c, x, s) })).sort((a, b) => b.e - a.e);
  return bot.r() < bot.p.pick ? v[0].k : v[Math.floor(bot.r() * v.length)].k;
}
// the topics her room is best at (a careful player builds on them)
const topOf = (c) => Object.entries(scores(c)).sort((a, b) => b[1] - a[1]).slice(0, 4).map((x) => x[0]);
// what a thing is worth to them: its points (her best topics count most) for the room it takes up (a small thing: its
// place on a surface; a rug: only other rugs compete)
export function worth(x, top) {
  const p = pointsOf(x);
  let v = 0;
  for (const k in p) v += p[k] * (top.includes(k) ? 1 : 0.35);
  return v / (x.place === 'top' ? x.w : x.w * x.h);
}
const isLastDesk = (c, t) => itemOf(t.id).desk && c.items.filter((u) => itemOf(u.id).desk && layer(u) === 'floor').length <= 1;
// the least worth of what's on that layer of her room (never her last desk)
function worstOn(c, L, top) {
  let w = Infinity;
  for (const t of c.items) if (layer(t) === L && !isLastDesk(c, t)) w = Math.min(w, worth(itemOf(t.id), top));
  return w;
}
// a careful player makes room for something much better: puts away the least worth on its layer, worst first, until it
// fits (tried on a copy first, so nothing's put away for nothing)
export function makeRoom(c, id, top = topOf(c)) {
  const L = layer({ id }), v = worth(itemOf(id), top);
  const worse = c.items.filter((t) => layer(t) === L && !isLastDesk(c, t) && worth(itemOf(t.id), top) * 2 <= v)
    .sort((a, b) => worth(itemOf(a.id), top) - worth(itemOf(b.id), top)).slice(0, 4);
  const sim = { ...c, items: [...c.items], inv: { ...c.inv } }, out = [];
  for (const t of worse) { store(sim, t.uid); out.push(t.uid); if (autoSpot(sim, id)) { for (const u of out) store(c, u); return true; } }
  return false;
}
// what's best to buy. A careful player: the most worth for the room it takes, if it fits or is worth making room for (so
// it saves up for good things); a less careful one: anything that fits
export function pickBuy(c, bot) {
  const can = shopItems(c).filter((x) => canBuy(c, x.id));
  if (!can.length) return null;
  if (bot.r() >= bot.p.shop) {
    const fits = can.filter((x) => hasSpot(c, x.id)), x = fits[Math.floor(bot.r() * fits.length)];
    return x && autoSpot(c, x.id) ? x.id : null;
  }
  const top = topOf(c), ranked = can.map((x) => ({ x, v: worth(x, top) })).sort((a, b) => b.v - a.v);
  for (const { x, v } of ranked.slice(0, 8)) {
    if (c.deliveries.some((d) => d.id === x.id) || c.inv[x.id]) continue;
    if (autoSpot(c, x.id) || worstOn(c, layer({ id: x.id }), top) * 2 <= v) return x.id;
  }
  return null;
}
// her things that are put away: the best placed first; a careful player makes room for something much better
function placeThings(c, bot) {
  const top = topOf(c);
  for (const id of Object.keys(c.inv).sort((a, b) => worth(itemOf(b), top) - worth(itemOf(a), top))) {
    let at = autoSpot(c, id);
    if (!at && bot.r() < bot.p.shop && makeRoom(c, id, top)) at = autoSpot(c, id);
    if (at) placeFromInv(c, id, at.x, at.y, { on: at.on });
  }
}
const PERK_ORDER = ['slot2', 'thumbs', 'fast', 'old', 'radar', 'express', 'energy', 'follow', 'slot3', 'mail'];
// one look at everything (every `dt` seconds of play)
export function playCareer(c, bot, dt = 0.5) {
  tick(c, dt);
  const evs = drainCareer(c);
  // the drone and the bots
  for (const e of evs) {
    if (e.type === 'drone' && bot.r() < bot.p.catch) bot.droneAt = c.clock + bot.p.react * 2;
    if (e.type === 'bot' && bot.r() < bot.p.catch) (bot.zaps ||= []).push({ id: e.bot.id, at: c.clock + bot.p.react * 3 });
  }
  if (bot.droneAt && c.clock >= bot.droneAt) { catchDrone(c); bot.droneAt = 0; }
  if (bot.zaps?.length) bot.zaps = bot.zaps.filter((z) => { if (c.clock >= z.at) { zap(c, z.id); return false; } return true; });
  // videos
  while (c.uploads.length < slotsOf(c)) {
    if (ideasReady(c) && bot.p.pick > 0.6) {
      const s = scores(c), best = Math.max(...c.ideas.map((x) => expected(c, x, s)));
      if (c.ideas.every((x) => expected(c, x, s) < best * 0.8) && bot.r() < 0.3) newIdeas(c);
    }
    if (!startVideo(c, pickIdea(c, bot))) break;
  }
  // boxes: tap the ones on their way now and then, open the ones that came, place what's in them
  let opened = false;
  for (const d of [...c.deliveries]) {
    if (boxLeft(c, d) > 0) { if (bot.r() < bot.p.catch * dt) tapBox(c, d.uid); continue; }
    opened = Boolean(openBox(c, d.uid)) || opened;
  }
  // the shop and her room, now and then (and as soon as a box is opened)
  bot.shopT -= dt;
  if (opened && bot.shopT > 0) placeThings(c, bot);
  if (bot.shopT <= 0) {
    bot.shopT = bot.p.every * bot.r.range(0.6, 1.4);
    if (canMoveHome(c)) moveHome(c);
    placeThings(c, bot);
    for (let k = 0; k < 6; k++) { const id = pickBuy(c, bot); if (!id || !buy(c, id)) break; }
    for (const id of PERK_ORDER) while (canPerk(c, id)) buyPerk(c, id);
    if (c.items.some((t) => itemOf(t.id).pet) && bot.r() < bot.p.catch) pet(c);
  }
  // live, when the meter's full
  if (liveReady(c) && !c.uploads.some((u) => c.clock - u.start < 0.1)) {
    const L = liveStart(c);
    const S = createStream({ cat: L.topic, v0: L.v0, busy: L.busy, followers: c.followers, seed: c.seed * 7919 + c.totals.live + 1 });
    const out = playStream(S, bot);
    tick(c, TUNE.dur, { events: false }); drainCareer(c);
    liveDone(c, out);
  }
  drainCareer(c);
}
// A whole career: `seconds` of play (or until `until` followers) → the career and when each milestone came
export function career(profile = 'good', { seconds = 3600, seed = 1, until = Infinity, dt = 0.5 } = {}) {
  const bot = createPlayer(profile, seed), c = newCareer(seed);
  const log = [], snap = () => ({ t: Math.round(c.clock), f: c.followers, views: Math.round(c.views), level: c.level, home: c.home, items: c.items.length, videos: c.videos });
  let lastF = -1;
  while (c.clock < seconds && c.followers < until) {
    playCareer(c, bot, dt);
    if (Math.floor(c.clock / 60) !== lastF) { lastF = Math.floor(c.clock / 60); log.push(snap()); }
  }
  // where it ended (a milestone reached between two minutes)
  if (log[log.length - 1]?.f !== c.followers) log.push(snap());
  return { c, log };
}
export { PERKS };
