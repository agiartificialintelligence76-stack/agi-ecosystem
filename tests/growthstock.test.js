// GROWTH STOCK (2026-11-14), an arcade-kit game on agi1.app/games: AGI-1's farm, where the crops are stocks (the owner:
// "Stocks are the crops", then "i want real stock names"). The stocks (nine real tickers, made-up rates), the four
// quarters and the week's news, the rules (plant, water, a bumper share, harvest, a full barn, wilting, selling pushes
// the rate down, land, sprinklers, a bigger barn, compost, orders, the bear and the bull, the closing bell; shares never
// spoil), the same seed giving the same week, the game's own farmers in every quarter, what's kept, her words and the
// farm's news (about the farm, never the companies; never money talk), and its code. All in Node (no browser).
// Run: node --test tests/growthstock.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { CROPS, CROP_IDS, cropOf, tickOf, hourly } from '../src/games/growthstock/crops.js';
import {
  HOUR, START_H, END_H, DAYS, WEATHER, SEASONS, seasonOf, MAX_STARS, starsFor, dice, hashOf, dateKey, dailySeed, dailySeason,
  dayBefore, endlessSeason, makeConfig, planDay, bend, clockOf, clockLabel,
} from '../src/games/growthstock/seasons.js';
import {
  STEP, COLS, ROWS, TUNE, createSim, drain, step, act, sell, buy, deliver, shoo, select, have, barnCount, barnCap, nextCost,
  fairOf, changeOf, ripe, growing, thirsty, closingBell, plotXY, cropsOfRun,
} from '../src/games/growthstock/sim.js';
import { PROFILES, createBot, drive, playOut } from '../src/games/growthstock/ai.js';
import { STICKERS, stickerOf, fresh, load, applyRun, totalStars, seasonOpen, endlessOpen, nextSeason } from '../src/games/growthstock/progress.js';
import { headline, effectOf, whenOf, orderText, BUYERS, say, TIPS, endLine, shareText } from '../src/games/growthstock/lines.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const MONEY = /\$AGI|\binvest|\bprofit|financial advice|\bprice|\bpump|\bdump|\bbuy\b|\bmoon\b|\bnfa\b/i;
// run the rules for `hours` of play, `fn` called every step
function run(S, hours, fn) { const n = Math.round(hours * HOUR / STEP); for (let k = 0; k < n && !S.over; k++) { fn?.(S); step(S, STEP); } }
const sim = (season = 'q1', seed = 7) => createSim(makeConfig({ mode: 'season', season }), seed);

// ---------- the stocks ----------
test('the stocks: nine real tickers with their companies, our own coin pictures, every one in a quarter, about the same gold an hour', () => {
  assert.deepEqual(CROP_IDS, ['gme', 'ko', 'aapl', 'tsla', 'amzn', 'msft', 'brka', 'nvda', 'nflx']);
  assert.deepEqual(CROP_IDS.map(tickOf), ['GME', 'KO', 'AAPL', 'TSLA', 'AMZN', 'MSFT', 'BRK.A', 'NVDA', 'NFLX']);
  assert.deepEqual(CROP_IDS.map((id) => CROPS[id].name), ['GameStop', 'Coca-Cola', 'Apple', 'Tesla', 'Amazon', 'Microsoft', 'Berkshire Hathaway', 'NVIDIA', 'Netflix']);
  const glyphs = new Set();
  for (const id of CROP_IDS) {
    const c = cropOf(id);
    assert.equal(c.id, id);
    assert.match(c.color, /^#[0-9a-f]{6}$/); assert.match(c.deep, /^#[0-9a-f]{6}$/);
    assert.match(c.glyph, /^(pad|cup|phone|bolt|box|cloud|bank|chip|popcorn)$/, `${id}: one of our own little pictures`);
    glyphs.add(c.glyph);
    assert.ok(c.blurb.length > 8 && !MONEY.test(c.blurb), `${id}: its note says how it grows, never money`);
    assert.ok(c.grow >= 8 && c.grow <= 44 && c.yield >= 1 && c.yield <= 3 && c.seed > 0 && c.base > c.seed / c.yield, id);
    const h = hourly(c);
    assert.ok(h > 0.75 && h < 1.45, `${id}: about one gold an hour a plot at its usual rate (${h.toFixed(2)})`);
    assert.ok(SEASONS.some((s) => s.crops.includes(id)), `${id}: grown in a quarter`);
    assert.equal(c.shelf, undefined, `${id}: shares keep (nothing spoils)`);
  }
  assert.equal(glyphs.size, CROP_IDS.length, 'a picture each');
  assert.deepEqual(CROP_IDS.filter((id) => CROPS[id].jumpy), ['tsla', 'nvda'], 'the two that leap on a rumour');
  assert.deepEqual(CROP_IDS.filter((id) => CROPS[id].frost), ['nflx'], 'the one that likes the cold and the dark');
  assert.equal(cropOf('nope'), null);
  assert.equal(tickOf('xyz'), 'XYZ');
});

// ---------- the quarters and the week ----------
test('the quarters: four seasons of four or five stocks, a fair each for one of them, stars that climb, Endless and the Daily', () => {
  assert.deepEqual(SEASONS.map((s) => [s.id, s.q, s.name]), [['q1', 'Q1', 'Spring'], ['q2', 'Q2', 'Summer'], ['q3', 'Q3', 'Autumn'], ['q4', 'Q4', 'Winter']]);
  for (const s of SEASONS) {
    assert.ok(s.crops.length >= 4 && s.crops.length <= 5 && s.crops.every((id) => CROPS[id]), s.id);
    assert.ok(s.crops.includes(s.fair.crop), `${s.id}: its fair wants one of its stocks`);
    assert.ok(s.stars[0] < s.stars[1] && s.stars[1] < s.stars[2], `${s.id}: stars climb`);
    for (const k of Object.keys(s.weather)) assert.ok(WEATHER[k], k);
    for (const k of Object.keys(s.seasonal)) assert.ok(s.crops.includes(k), `${s.id}: ${k}`);
    assert.equal(starsFor(s, s.stars[0] - 1), 0); assert.equal(starsFor(s, s.stars[0]), 1); assert.equal(starsFor(s, s.stars[2] + 99), 3);
  }
  assert.equal(MAX_STARS, 12);
  assert.equal(seasonOf('q3').fair.crop, 'brka');
  assert.equal(SEASONS.filter((s) => s.crops.includes('nflx')).map((s) => s.id).join(), 'q4', 'NFLX is winter\'s, with the frost');
  assert.ok(SEASONS.every((s) => !s.weather.frost || s.crops.includes('nflx')), 'frost only where NFLX grows');
  assert.equal(endlessSeason(1).id, 'q1'); assert.equal(endlessSeason(8).id, 'q2'); assert.equal(endlessSeason(29).id, 'q1');
  const cfg = makeConfig({ mode: 'endless' });
  assert.equal(cfg.end, Infinity);
  assert.deepEqual(cropsOfRun(cfg).sort(), [...CROP_IDS].sort(), 'Endless has every stock\'s market');
  assert.equal(dateKey(new Date('2026-11-14T23:00:00Z')), '2026-11-14');
  assert.equal(dayBefore('2026-11-01'), '2026-10-31');
  assert.equal(dailySeed('2026-11-14'), dailySeed('2026-11-14'));
  assert.notEqual(dailySeed('2026-11-14'), dailySeed('2026-11-15'));
  assert.ok(SEASONS.includes(dailySeason('2026-11-14')));
  assert.equal(makeConfig({ mode: 'daily', key: '2026-11-14' }).season.id, dailySeason('2026-11-14').id);
  assert.equal(START_H, 6); assert.equal(END_H, 162);
  assert.equal(clockLabel(START_H), 'Mon 6 AM'); assert.equal(clockLabel(END_H), 'Sun 6 PM');
  assert.equal(DAYS[clockOf(END_H).day - 1], 'Sun');
  assert.equal(hashOf('a'), hashOf('a'));
  const a = dice(5), b = dice(5);
  for (let k = 0; k < 20; k++) assert.equal(a(), b());
});

test('the week\'s news: planned a day at a time from the seed alone; a rumour only for a jumpy stock; the fair announced days ahead', () => {
  for (const s of SEASONS) {
    const cfg = makeConfig({ mode: 'season', season: s.id });
    let fairs = 0;
    for (let d = 1; d <= 7; d++) {
      const p = planDay(cfg, 99, d), q = planDay(cfg, 99, d);
      assert.deepEqual(p, q, 'the same seed, the same day');
      assert.ok(s.weather[p.weather], `${s.id} day ${d}: its own weather`);
      for (const e of p.events) {
        if (e.crop) assert.ok(s.crops.includes(e.crop), `${e.type}: one of the quarter's stocks`);
        if (e.type === 'rumor') assert.ok(CROPS[e.crop].jumpy);
        if (e.type === 'fair') { fairs++; assert.equal(e.crop, s.fair.crop); assert.ok(e.start - e.news >= 24, 'announced at least a day ahead'); }
        if (e.type === 'order') assert.ok(e.n >= 2 && e.pay > CROPS[e.crop].base, 'an order pays more than usual');
        assert.ok(e.end >= e.start);
      }
    }
    assert.equal(fairs, 1, `${s.id}: one fair a week`);
  }
  const e = { start: 10, end: 20, mult: 2, ramp: 2 };
  assert.equal(bend(e, 5), 1); assert.equal(bend(e, 9), 1.5); assert.equal(bend(e, 15), 2); assert.equal(bend(e, 23), 1);
  const r = { start: 10, end: 15, mult: 2, ramp: 1, crash: { end: 25, mult: 0.6 } };
  assert.ok(bend(r, 12) === 2 && bend(r, 20) < 1 && bend(r, 30) === 1, 'a rumour leaps, falls back too far, then settles');
});

// ---------- the rules ----------
test('a plot: plant the chosen stock (it costs), water it, it grows, ripe it\'s harvested into the barn, one more share when it never went dry', () => {
  const S = sim('q1', 3);
  assert.equal(S.sel, 'gme');
  assert.equal(S.plots.filter((p) => p.open).length, 9, 'the middle three by three');
  const g0 = S.gold;
  assert.deepEqual(act(S, 12), { type: 'plant', i: 12, crop: 'gme' });
  assert.equal(S.gold, g0 - CROPS.gme.seed);
  assert.ok(growing(S.plots[12]));
  assert.equal(act(S, 0).type, 'locked', 'a locked plot only says what it costs');
  run(S, CROPS.gme.grow * 0.5, (s) => { if (thirsty(s.plots[12])) act(s, 12); });
  assert.ok(growing(S.plots[12]) && S.plots[12].g > 0.3);
  run(S, CROPS.gme.grow, (s) => { if (thirsty(s.plots[12])) act(s, 12); });
  assert.ok(ripe(S.plots[12]));
  const r = act(S, 12);
  assert.equal(r.type, 'harvest'); assert.equal(r.bump, true); assert.equal(r.n, CROPS.gme.yield + 1);
  assert.equal(have(S, 'gme'), 3); assert.equal(barnCount(S), 3);
  assert.equal(S.plots[12].crop, null);
  // a dry one: no bumper
  select(S, 'ko'); act(S, 11);
  S.plots[11].w = 0;
  run(S, 45);
  assert.ok(ripe(S.plots[11]) || S.plots[11].rot);
  if (ripe(S.plots[11])) { const h = act(S, 11); assert.equal(h.bump, false); assert.equal(h.n, CROPS.ko.yield); }
  // not enough gold: nothing planted
  select(S, 'tsla'); S.gold = 3;
  assert.equal(act(S, 13).type, 'broke');
  assert.equal(S.plots[13].crop, null);
  select(S, 'nvda');
  assert.equal(S.sel, 'tsla', 'only a stock of the quarter can be chosen');
});

test('a ripe stock left too long wilts (a tap clears it); shares in the barn never spoil; a full barn won\'t take more', () => {
  const S = sim('q1', 4);
  act(S, 12);
  S.plots[12].g = 1; S.plots[12].ripeH = 0;
  run(S, TUNE.rotH + 1);
  assert.equal(S.plots[12].rot, true, 'wilted');
  assert.ok(drain(S).some((e) => e.type === 'rot'));
  assert.equal(act(S, 12).type, 'clear');
  assert.equal(S.stats.rotten, 1);
  // shares keep: a week in the barn
  S.barn.items.ko.push({ n: 5 });
  run(S, 120);
  assert.equal(have(S, 'ko'), 5, 'still five KO shares a week later');
  assert.ok(!drain(S).some((e) => e.type === 'spoil'));
  // full
  S.barn.items.gme.push({ n: barnCap(S) - barnCount(S) });
  select(S, 'gme'); act(S, 11); S.plots[11].g = 1;
  assert.equal(act(S, 11).type, 'full');
  assert.ok(ripe(S.plots[11]), 'it waits on its plot');
});

test('selling: every share pushes the rate down a little, it comes back with time; gold, stats and the best sale', () => {
  const S = sim('q2', 5), twin = sim('q2', 5);
  S.barn.items.amzn.push({ n: 12 });
  const m = S.market.amzn, r0 = m.r, g0 = S.gold;
  const a = sell(S, 'amzn', 1);
  assert.equal(a.n, 1); assert.ok(Math.abs(a.gold - r0) < 1e-9, 'the first at the rate shown');
  assert.ok(m.r < r0, 'pushed down');
  const b = sell(S, 'amzn', 5);
  assert.equal(b.n, 5); assert.ok(b.gold < 5 * r0);
  assert.equal(have(S, 'amzn'), 6);
  assert.ok(Math.abs(S.gold - (g0 + a.gold + b.gold)) < 1e-9);
  assert.equal(S.stats.sold, 6);
  assert.ok(S.stats.bestSale.crop === 'amzn' && S.stats.bestRatio > 0);
  const gap = m.x - twin.market.amzn.x;
  assert.ok(gap < -0.1, 'below where it would have been');
  run(S, 12); run(twin, 12);
  assert.ok(Math.abs(m.x - twin.market.amzn.x) < Math.abs(gap) * 0.4, 'it comes back with time');
  assert.deepEqual(sell(S, 'gme', 3), { n: 0, gold: 0 }, 'nothing in the barn, nothing sold');
  assert.ok(Number.isFinite(changeOf(S, 'amzn')));
});

test('the farm\'s tools: land (dearer each time), a bigger barn, sprinklers that water by themselves, compost', () => {
  const S = sim('q1', 6);
  S.gold = 5000;
  const c1 = nextCost(S, 'plot');
  assert.deepEqual(buy(S, 'plot', 0), { what: 'plot', i: 0, cost: c1 });
  assert.ok(S.plots[0].open && nextCost(S, 'plot') > c1);
  assert.equal(buy(S, 'plot', 0), null, 'an open plot isn\'t bought twice');
  assert.equal(barnCap(S), 40);
  buy(S, 'barn'); assert.equal(barnCap(S), 80); buy(S, 'barn'); assert.equal(barnCap(S), 160);
  assert.equal(nextCost(S, 'barn'), null, 'the biggest barn');
  buy(S, 'sprinkler');
  act(S, 12); S.plots[12].w = 0.1;
  run(S, 0.5);
  assert.ok(S.plots[12].w > 0.9, 'watered by the sprinklers');
  buy(S, 'compost');
  assert.equal(S.compost, TUNE.compost.n);
  act(S, 13);
  assert.equal(S.plots[13].comp, true); assert.equal(S.compost, TUNE.compost.n - 1);
  S.gold = 1;
  assert.equal(buy(S, 'compost'), null, 'not enough gold');
});

test('orders, the bear (three taps) and the bull: what they do to the farm', () => {
  const S = sim('q2', 8);
  S.order = { crop: 'msft', n: 3, pay: 50, until: S.h + 10, who: 1 };
  assert.equal(deliver(S), null, 'not enough shares yet');
  S.barn.items.msft.push({ n: 4 });
  const g0 = S.gold;
  assert.deepEqual(deliver(S), { gold: 150 });
  assert.equal(S.gold, g0 + 150); assert.equal(have(S, 'msft'), 1); assert.equal(S.order, null);
  assert.match(orderText({ crop: 'msft', n: 3, who: 1 }), /^Unit 7 wants 3 MSFT$/);
  // the bear: walks in, eats, three taps send it off
  const B = sim('q3', 12);
  B.gold = 9999;
  for (const p of B.plots) if (p.open) { select(B, 'aapl'); act(B, p.i); p.g = 1; }
  const ev = { id: 'test:bear', type: 'bear', news: B.h, start: B.h, end: B.h + 12, mult: 0.82, ramp: 0.5, from: 0, wander: 0.5 };
  B.days[1].events.push(ev);
  run(B, 0.2);
  assert.ok(B.bear, 'a bear');
  const mood = fairOf(B, 'aapl') / CROPS.aapl.base;
  assert.ok(mood < 1, 'the market is down while it\'s here');
  for (let k = 0; k < 3; k++) { B.bear.hop = 0; shoo(B); }
  assert.equal(B.bear.state, 'flee'); assert.equal(B.stats.shooed, 1);
  run(B, 4);
  assert.equal(B.bear, null, 'gone');
});

test('the closing bell: Sunday 6 PM, whatever\'s in the barn sold at the market, the week over', () => {
  const S = sim('q1', 2);
  S.barn.items.ko.push({ n: 6 });
  run(S, END_H - START_H + 1);
  assert.ok(S.over, 'over');
  assert.equal(have(S, 'ko'), 0);
  assert.equal(S.stats.closing > 0, true);
  assert.equal(S.over.gold, S.gold);
  const ev = drain(S);
  assert.ok(ev.some((e) => e.type === 'close'));
  closingBell(S);
  assert.equal(drain(S).filter((e) => e.type === 'close').length, 0, 'once');
});

test('the same seed and the same actions give the same week; the market\'s stream doesn\'t depend on the player', () => {
  const a = sim('q4', 31), b = sim('q4', 31);
  run(a, 60); run(b, 60);
  assert.deepEqual(a.market.nflx.candles, b.market.nflx.candles);
  assert.equal(a.weather, b.weather);
  const c = sim('q4', 31), d = sim('q4', 31);
  c.barn.items.ko.push({ n: 30 });
  run(c, 10); run(d, 10);
  sell(c, 'ko', 30);
  run(c, 40); run(d, 40);
  assert.deepEqual(c.market.nvda.candles, d.market.nvda.candles, 'another stock\'s market is untouched by selling KO');
  assert.equal(c.weather, d.weather);
  assert.notDeepEqual(sim('q4', 32).market.nflx.candles, a.market.nflx.candles, 'another seed, another market');
});

// ---------- the game's own farmers ----------
test('the game\'s own farmers play every quarter to the bell, the same each time, and a careful one earns a star everywhere', () => {
  assert.deepEqual(Object.keys(PROFILES), ['newbie', 'casual', 'steady', 'expert', 'demo']);
  for (const s of SEASONS) {
    const cfg = () => makeConfig({ mode: 'season', season: s.id });
    const golds = [];
    for (const seed of [1017, 1034, 1051]) {
      const A = playOut(createSim, step, cfg(), seed, 'steady'), B = playOut(createSim, step, cfg(), seed, 'steady');
      assert.ok(A.over, `${s.id}: to the bell`);
      assert.equal(A.gold, B.gold, `${s.id}: the same farmer, the same seed, the same gold`);
      golds.push(A.gold);
    }
    golds.sort((x, y) => x - y);
    assert.ok(golds[1] >= s.stars[0], `${s.id}: a careful farmer gets a star (${Math.round(golds[1])} vs ${s.stars[0]})`);
    const n = playOut(createSim, step, cfg(), 1017, 'newbie');
    assert.ok(n.gold > s.start, `${s.id}: even a newbie ends up ahead`);
  }
  // the preview's farmer moves a finger the page draws
  const S = createSim(makeConfig({ mode: 'demo' }), 7), bot = createBot('demo', 18);
  for (let k = 0; k < 600; k++) { drive(bot, S, STEP); step(S, STEP); }
  assert.ok(bot.cur && Number.isFinite(bot.cur.x) && bot.cur.x >= -1 && bot.cur.x <= COLS + 1 && bot.cur.y <= ROWS + 1);
  assert.ok(S.stats.planted > 0, 'it plants');
  assert.deepEqual(plotXY(12), { x: 2.5, y: 2.5 });
});

// ---------- what's kept ----------
test('what\'s kept: stars and bests per quarter, the Daily\'s streak, Endless, totals, stickers; quarters open one after another', () => {
  let save = fresh();
  assert.equal(totalStars(save), 0); assert.equal(nextSeason(save), 'q1');
  assert.equal(seasonOpen(save, 'q1'), true); assert.equal(seasonOpen(save, 'q2'), false); assert.equal(endlessOpen(save), false);
  const stats = { harvested: 40, sold: 38, earned: 900, orders: 3, shooed: 1, bumpers: 16, bestRatio: 2.9, bestSale: { crop: 'tsla', ratio: 2.9 }, rotten: 0, eaten: 0, bullSold: 160, byCrop: { nvda: 31, ko: 9 } };
  let r = applyRun(save, { mode: 'season', season: 'q1', gold: seasonOf('q1').stars[1] + 5, stats, open: 25 });
  save = r.save;
  assert.equal(r.stars, 2); assert.equal(r.isBest, true);
  assert.equal(totalStars(save), 2); assert.equal(seasonOpen(save, 'q2'), true); assert.equal(endlessOpen(save), true);
  assert.equal(nextSeason(save), 'q2');
  assert.deepEqual(r.newStickers.map((s) => s.id).sort(), ['bull', 'bumper', 'chips', 'clean', 'first', 'land', 'orders', 'shoo', 'spike', 'top'].sort());
  r = applyRun(save, { mode: 'season', season: 'q1', gold: 10, stats: { harvested: 1 } });
  assert.equal(r.save.seasons.q1.stars, 2, 'a worse run keeps the stars'); assert.equal(r.save.seasons.q1.played, 2);
  assert.equal(r.newStickers.length, 0);
  save = r.save;
  for (const [k, n] of [['2026-11-12', 1], ['2026-11-13', 2], ['2026-11-14', 3]]) { r = applyRun(save, { mode: 'daily', key: k, gold: 500, stats: {} }); save = r.save; assert.equal(save.daily.streak, n); }
  assert.ok(r.newStickers.some((s) => s.id === 'daily'));
  r = applyRun(save, { mode: 'daily', key: '2026-11-16', gold: 100, stats: {} });
  assert.equal(r.save.daily.streak, 1, 'a missed day starts it again');
  r = applyRun(save, { mode: 'endless', gold: 4000, days: 12, stats: {} });
  assert.deepEqual(r.save.endless, { best: 4000, days: 12 });
  assert.deepEqual(load(JSON.parse(JSON.stringify(r.save))), r.save, 'kept as it was');
  assert.deepEqual(load({ v: 2 }), fresh(), 'anything else starts fresh');
  assert.deepEqual(load({ v: 1, stickers: ['first', 'ube', 'nope'] }).stickers, ['first'], 'only stickers that exist');
  for (const s of STICKERS) assert.ok(stickerOf(s.id) && (CROPS[s.art] || ['bear', 'bull', 'coin'].includes(s.art)), s.id);
});

// ---------- her words and the news ----------
test('her words and the farm\'s news: tickers, never money talk, never about the companies; buyers are made-up robots', () => {
  const lines = [];
  for (const id of CROP_IDS) {
    for (const [type, why] of [['trend', 8], ['glut', 6], ['rumor', 5]]) for (let w = 0; w < why; w++) lines.push(headline({ type, crop: id, start: 30, why: w }, 10));
    lines.push(headline({ type: 'fair', crop: id, name: 'The Harvest Fair', start: 30 }, 29));
    for (const k of ['spike', 'crash', 'flooded', 'fair']) for (let q = 0; q < 6; q++) lines.push(say(k, id, q / 6));
    lines.push(orderText({ crop: id, n: 4, who: 3 }));
  }
  for (const id of CROP_IDS) assert.ok(lines.some((l) => l.includes(tickOf(id))), `${id}: named by its ticker`);
  for (const k of ['morning', 'bump', 'rot', 'full', 'broke', 'bear', 'shooed', 'bearFull', 'bull', 'expire', 'evening', 'lastDay', 'bell']) for (let q = 0; q < 5; q++) lines.push(say(k, null, q / 5));
  for (const k of ['q1', 'q2', 'q3', 'q4', 'daily', 'endless']) for (let q = 0; q < 3; q++) lines.push(say('open', k, q / 3));
  for (const k of Object.keys(WEATHER)) lines.push(say('weather', k, 0));
  for (let q = 0; q < 3; q++) lines.push(say('order', { crop: 'ko', n: 5, who: q }, q / 3), say('deliver', 120, q / 3), say('bigSale', 80, q / 3));
  lines.push(...Object.values(TIPS));
  for (const stars of [0, 1, 2, 3]) for (let q = 0; q < 3; q++) lines.push(endLine({ mode: 'season', stars }, q / 3));
  lines.push(endLine({ mode: 'endless', days: 9, gold: '1,234' }, 0));
  for (const l of lines) {
    assert.ok(typeof l === 'string' && l.length > 3, l);
    assert.doesNotMatch(l, MONEY, `never money talk: ${l}`);
    assert.doesNotMatch(l, /\b(ceo|earnings|revenue|lawsuit|scandal|fraud|bankrupt|recall|layoffs?|stock price|shares? (?:of|in) (?:the )?company)\b/i, `the news is about the farm, never the companies: ${l}`);
    assert.doesNotMatch(l, /undefined|NaN|\$\{/, l);
  }
  assert.deepEqual(BUYERS, ['Robo Fund', 'Unit 7', 'Bolt Capital', 'the canteen bot', 'Servo & Sons', 'Pixel Pension']);
  assert.equal(whenOf(30, 10), 'tomorrow'); assert.equal(whenOf(10, 10), 'today'); assert.equal(whenOf(60, 10), 'on Wed');
  assert.equal(headline({ type: 'fair', crop: 'tsla', name: 'The Spring Fair', start: 150 }, 100), 'The Spring Fair on Sun: TSLA wanted');
  assert.equal(effectOf({ type: 'glut' }).up, false); assert.equal(effectOf({ type: 'trend' }).up, true);
  assert.equal(shareText({ mode: 'season', gold: '3,120', q: 'Q1', season: 'Spring' }), 'I farmed 3,120 gold in GROWTH STOCK (Q1 Spring) 🌱📈 AGI-1’s farm, where stocks grow as candle charts. Made-up rates, play gold only.');
  assert.match(shareText({ mode: 'daily', gold: '900' }), /today’s Daily/);
  assert.match(shareText({ mode: 'endless', gold: '9', days: 3 }), /3 endless days/);
});

// ---------- its code ----------
test('its code: the kit\'s shell with its id, its rules free of the page, nothing from elsewhere, its page says the rates are made up', () => {
  const dir = new URL('../src/games/growthstock/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
  for (const f of ['crops.js', 'seasons.js', 'sim.js', 'ai.js', 'progress.js']) {
    const code = read(`src/games/growthstock/${f}`).replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(code, /\b(document|window|navigator|localStorage|Math\.random|requestAnimationFrame|performance|Date\.now)\b/, `${f}: pure and seeded`);
  }
  assert.doesNotMatch(read('src/games/growthstock/lines.js').replace(/\/\/.*$/gm, ''), /\b(document|window|navigator|localStorage)\b/);
  const game = read('src/games/growthstock/game.js');
  assert.match(game, /createShell\(\{\s*game: 'growthstock'/);
  assert.match(game, /shell\.started\(\{ count: !QA \}\)/, 'a run counts one play (never in a test page)');
  assert.match(game, /const persist = \(\) => QA \|\| shell\.store\.update/, 'a test page keeps nothing');
  assert.match(game, /fine: 'Real company names, made-up rates and news · play gold only/, 'the title says only the names are real');
  for (const f of files) {
    const code = read(`src/games/growthstock/${f}`);
    assert.doesNotMatch(code, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket|eval\(|new Function|\.innerHTML\s*=|setAttribute\(\s*['"]style/, f);
    assert.doesNotMatch(code, /https?:\/\/(?!www\.w3\.org)/, f);
  }
  assert.match(read('src/games/growthstock/page.js').replace(/\/\/.*$/gm, ''), /^\s*import '\.\.\/intro\.js';\s*import '\.\/game\.js';/);
  const css = read('src/games/growthstock/style.css').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of css.matchAll(/(^|[\s,>+~(])\.([a-zA-Z][\w-]*)/g)) assert.match(m[2], /^(gs-|ak\b|ak-|is-)/, `style.css: .${m[2]}`);
  assert.doesNotMatch(css, /url\(\s*['"]?https?:|@import/);
  const html = read('growthstock.html');
  assert.match(html, /<div class="gi" id="agi-intro" aria-hidden="true"><\/div>\s*<main id="ak-root">/);
  assert.match(html, /No wallet needed\./);
  assert.match(html, /Real names, made-up rates and news, play gold only\./, 'its description says so');
  assert.doesNotMatch(html, /\bbuy\b|style=|<style|onclick/i);
  assert.match(html, /__SITE__\/cards\/games\/growthstock\.jpg/);
});
