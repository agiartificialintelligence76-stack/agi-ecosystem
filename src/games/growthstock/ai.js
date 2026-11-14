// GROWTH STOCK: the game's own farmers. They play with the same actions as a person (`act` on a plot, `sell`, `buy`,
// `deliver`, `shoo`) and a finger that has to travel from plot to plot, so the demo looks like someone playing and the
// balance tool and the tests measure something a person could do. They only know what a player knows: the news that's
// been announced (never the bull, the bear or a rumour before it happens).
import { CROPS } from './crops.js';
import { bend, clockOf, WEATHER } from './seasons.js';
import { act, sell, buy, deliver, shoo, select, have, barnCount, barnCap, nextCost, ripe, thirsty, growing, plotXY, allEvents, TUNE, COLS, ROWS } from './sim.js';

export const PROFILES = Object.freeze({
  // speed: plots a second the finger moves · think: seconds between looks · plan: uses the news · margin: how far over
  // the usual rate it waits to sell · buys: expands the farm · bear: seconds to notice the bear · water: waters at all
  newbie: { speed: 3.2, think: [1.1, 2.2], plan: false, margin: -0.1, buys: 0.3, bear: 3.2, water: 0.6, mix: 0.35, impact: false },
  casual: { speed: 4.6, think: [0.6, 1.2], plan: false, margin: 0, buys: 0.7, bear: 1.6, water: 0.85, mix: 0.7, impact: true },
  steady: { speed: 6.5, think: [0.3, 0.6], plan: true, margin: 0.08, buys: 1, bear: 0.9, water: 1, mix: 1, impact: true },
  expert: { speed: 9, think: [0.15, 0.3], plan: true, margin: 0.12, buys: 1.6, bear: 0.45, water: 1, mix: 1, impact: true },
  demo: { speed: 5.5, think: [0.25, 0.45], plan: true, margin: 0.1, buys: 1.2, bear: 0.6, water: 1, mix: 1, impact: true },
});

export function createBot(profile = 'steady', seed = 1) {
  const p = PROFILES[profile] || PROFILES.steady;
  let a = seed >>> 0 || 1;
  const rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { p, name: profile, rnd, wait: 0.6, cur: { x: COLS / 2, y: ROWS + 0.4 }, path: [], bearT: 0, down: false, last: null };
}

// what a crop is expected to fetch at hour h, from what's been announced (the season, the fairs, trends, gluts)
function expected(S, id, h) {
  const c = CROPS[id], s = S.cfg.seasonAt(clockOf(h).day);
  let f = c.base * (s.seasonal?.[id] || 1);
  for (const e of allEvents(S)) if (S.seen.has(e.id) && e.crop === id && e.type !== 'order' && e.type !== 'rumor') f *= bend(e, h);
  return f;
}
// how much of a crop is already coming (in the barn and growing)
const pipeline = (S, id) => have(S, id) + S.plots.filter((q) => q.open && q.crop === id && !q.rot).length * CROPS[id].yield;

// the best seed to plant now: the most gold an hour, counting the news, the weather, and how much of it is coming
function bestSeed(S, bot) {
  const s = S.cfg.seasonAt(clockOf(S.h).day), w = WEATHER[S.weather];
  let best = null;
  for (const id of s.crops) {
    const c = CROPS[id];
    if (S.gold < c.seed) continue;
    const speed = (w.frost && c.frost ? 1.3 : w.grow) * (S.compost > 0 ? TUNE.compost.speed : 1);
    const hours = c.grow / Math.max(0.3, speed);
    if (S.h + hours > S.cfg.end - 1.5) continue;                       // it would never be sold
    const at = S.h + hours + 3;
    const rate = bot.p.plan ? expected(S, id, at) : c.base;
    // what's already coming of it will push its rate down when it's sold: a farmer who knows the market spreads out
    const coming = pipeline(S, id);
    const crowd = bot.p.impact ? 1 / (1 + c.impact * coming * 0.8) : 1;
    if (bot.p.impact && S.plots.filter((q) => q.open && q.crop === id && !q.rot).length >= Math.max(3, S.plots.filter((q) => q.open).length * 0.4)) continue;
    const units = c.yield + (bot.p.water > 0.9 || S.sprinkler.level ? 1 : 0);
    let v = (units * rate * crowd - c.seed) / hours;
    v *= 0.9 + 0.2 * bot.rnd() * (1 - bot.p.mix * 0.5);
    if (!best || v > best.v) best = { id, v };
  }
  if (bot.p.mix < 0.5 && bot.rnd() > bot.p.mix) return s.crops.find((id) => S.gold >= CROPS[id].seed) || null;
  return best && best.v > 0 ? best.id : null;
}

// selling: a stock goes when it's above its usual rate by a share of its own swing (a careful farmer waits for a bit
// more, a hurried one takes what's there), it's held for a fair or a trend that's been announced, and it all goes when
// the barn is nearly full or the bell is near. Every share sold pushes the rate down, so a careful farmer stops when
// it's pushed back to usual.
const swing = (c) => c.vol / Math.sqrt(2 * c.rev);
function sellPass(S, bot) {
  const end = S.cfg.end, full = barnCount(S) / barnCap(S);
  for (const id in S.barn.items) {
    const n = have(S, id); if (!n) continue;
    const c = CROPS[id], m = S.market[id], sw = swing(c);
    const now = bot.p.plan ? expected(S, id, S.h) : c.base;
    const hurry = S.h > end - 3 || full > 0.9;
    if (bot.p.plan && !hurry) {
      let ahead = now;
      for (let dh = 2; dh <= Math.min(30, end - S.h - 1); dh += 2) ahead = Math.max(ahead, expected(S, id, S.h + dh));
      if (ahead > now * 1.25 && m.r < ahead * 0.88) continue;                 // a fair is coming: keep it for then
    }
    const want = now * Math.exp(bot.p.margin * sw * 6);
    if (!hurry && m.r < want) continue;
    const floor = hurry ? (S.h > end - 1 ? 0 : now * 0.8) : now * Math.exp((bot.p.margin - 0.1) * sw * 6);
    let k = 0;
    while (k < n && (!bot.p.impact || S.market[id].r >= floor)) { sell(S, id, 1); k++; if (!bot.p.impact && k >= Math.ceil(n * 0.6)) break; }
  }
}

function buyPass(S, bot) {
  if (bot.p.buys <= 0) return;
  const left = S.cfg.end - S.h, reserve = 40;
  const planted = S.plots.filter((q) => q.open).length;
  const sCost = nextCost(S, 'sprinkler');
  if (sCost != null && S.sprinkler.level === 0 && left > 70 && S.gold > sCost + reserve && bot.rnd() < bot.p.buys * 0.5 && planted >= 12) buy(S, 'sprinkler');
  const pCost = nextCost(S, 'plot');
  if (pCost != null && left > 40 && S.gold > pCost * (2.2 / bot.p.buys) + reserve) {
    const open = new Set(S.plots.filter((q) => q.open).map((q) => q.i));
    const near = S.plots.filter((q) => !q.open).sort((a, b) => ring(a.i) - ring(b.i) || a.i - b.i)[0];
    if (near && open.size < 25) buy(S, 'plot', near.i);
  }
  const bCost = nextCost(S, 'barn');
  if (bCost != null && left > 30 && barnCount(S) / barnCap(S) > 0.7 && S.gold > bCost + reserve * 2) buy(S, 'barn');
}
const ring = (i) => Math.max(Math.abs((i % COLS) - 2), Math.abs(Math.floor(i / COLS) - 2));

// The farmer's turn: a look round, then the finger goes from plot to plot.
export function drive(bot, S, dt) {
  if (S.over) return;
  // the bear first: a few taps on it
  if (S.bear && S.bear.state !== 'flee') {
    bot.bearT += dt;
    if (bot.bearT > bot.p.bear) {
      const b = S.bear;
      if (goto(bot, b.x, b.y - 0.1, bot.p.speed * 1.4, dt)) { shoo(S); bot.bearT = bot.p.bear * 0.5; bot.last = { x: b.x, y: b.y, t: 0.25, tap: true }; }
      return;
    }
  } else bot.bearT = 0;
  bot.wait -= dt;
  if (bot.wait <= 0 && !bot.path.length) {
    bot.wait = bot.p.think[0] + (bot.p.think[1] - bot.p.think[0]) * bot.rnd();
    if (S.order && have(S, S.order.crop) >= S.order.n) deliver(S);
    sellPass(S, bot);
    buyPass(S, bot);
    bot.path = plan(S, bot);
  }
  if (bot.path.length) {
    const i = bot.path[0], q = plotXY(i);
    if (goto(bot, q.x, q.y, bot.p.speed, dt)) {
      bot.path.shift();
      const p = S.plots[i];
      if (p.open && !p.crop) { const id = bestSeed(S, bot); if (id) { select(S, id); act(S, i); } }
      else act(S, i, { water: bot.rnd() < bot.p.water || bot.p.water >= 1 });
      bot.last = { x: q.x, y: q.y, t: 0.2 };
    }
  }
  if (bot.last) { bot.last.t -= dt; if (bot.last.t <= 0) bot.last = null; }
}

// where the finger goes next: ripe (if there's room), rotten, thirsty, empty; nearest first
function plan(S, bot) {
  const room = barnCap(S) - barnCount(S);
  const jobs = [];
  for (const p of S.plots) {
    if (!p.open) continue;
    if (ripe(p)) { if (room >= CROPS[p.crop].yield + 1) jobs.push(p.i); }
    else if (p.rot) jobs.push(p.i);
    else if (thirsty(p) && !S.sprinkler.level) jobs.push(p.i);
    else if (!p.crop && bestSeed(S, bot)) jobs.push(p.i);
  }
  const out = [];
  let at = { ...bot.cur };
  const left = new Set(jobs);
  while (left.size && out.length < 10) {
    let best = null, bd = Infinity;
    for (const i of left) { const q = plotXY(i), d = Math.hypot(q.x - at.x, q.y - at.y); if (d < bd) { bd = d; best = i; } }
    out.push(best); left.delete(best); at = plotXY(best);
  }
  return out;
}

function goto(bot, x, y, v, dt) {
  const c = bot.cur, dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy);
  if (d < 0.05) return true;
  const s = Math.min(d, v * dt);
  c.x += (dx / d) * s; c.y += (dy / d) * s;
  return d - s < 0.05;
}

// for the tests and the balance tool: a whole run, as fast as the rules go
export function playOut(createSim, step, cfg, seed, profile, { maxT = 1200, onStep = null } = {}) {
  const S = createSim(cfg, seed), bot = createBot(profile, seed * 7 + 3);
  const dt = 1 / 30;
  while (!S.over && S.t < maxT) { drive(bot, S, dt); step(S, dt); S.out.length = 0; if (onStep) onStep(S); }
  return S;
}
export { growing };
