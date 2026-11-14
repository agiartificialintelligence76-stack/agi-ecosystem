// GROWTH STOCK: the rules, pure (no page, no clock of its own) and seeded: the same seed and the same actions give the
// same week. The page calls `step(S, dt)` 60 times a second and the actions (`act`, `sell`, `buy`, `deliver`, `shoo`);
// what happened comes out of `drain(S)` as events for the picture and the sound.
//
// The farm is a 5 × 5 field (the middle 3 × 3 open at first) in world units: a plot is 1 × 1. Time is in hours since the
// run's Monday 00:00 (`S.h`), 1.75 seconds of play an hour. Every stock has a market: its rate is its usual rate, bent by
// the season and the news (`seasons.js`), times exp(x), where x wanders (it always comes back) every quarter hour from a
// random stream of its own, and every share sold pushes x down a little. Nothing the player does changes that stream:
// two players of the same Daily see the same market until they sell into it.
import { CROPS } from './crops.js';
import { HOUR, START_H, WEATHER, planDay, bend, dice, hashOf, clockOf } from './seasons.js';

export const STEP = 1 / 60;
export const COLS = 5, ROWS = 5;
export const TUNE = Object.freeze({
  open: [6, 7, 8, 11, 12, 13, 16, 17, 18],           // the middle 3 × 3
  plotCost: [25, 30, 35, 40, 50, 60, 70, 80, 95, 110, 125, 140, 160, 180, 200, 225],
  dryH: 9,            // hours a watered plot stays wet in the sun
  dryGrow: 0.4,       // how fast a crop grows while its soil is dry
  bumperDry: 1.5,     // hours dry a crop may go and still be a bumper crop (one more)
  rotH: 18,           // hours a ripe stock waits on its plot before it wilts
  barn: [40, 80, 160], barnCost: [0, 120, 320],
  sprinkler: [0, 5, 2.5], sprinklerCost: [0, 150, 320],   // hours between waterings, by level
  compost: { cost: 40, n: 6, speed: 1.6 },
  tick: 0.25,         // the market moves every quarter hour
  history: 9,         // days of candles before the week starts
  jump: 0.006,        // a jumpy crop's chance of a leap, a tick
  bear: { speed: 1.5, eat: 1.9, scare: 3, stay: 15, max: 5, reach: 0.75 },
});

const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const emit = (S, type, data = {}) => { S.out.push({ type, ...data }); };
export const drain = (S) => { const o = S.out; S.out = []; return o; };
export const plotXY = (i) => ({ x: (i % COLS) + 0.5, y: Math.floor(i / COLS) + 0.5 });

// ---------- a new run ----------
export function createSim(cfg, seed = 1) {
  const S = {
    cfg, seed: seed >>> 0 || 1, t: 0, h: START_H, gold: cfg.start, out: [], over: null,
    plots: Array.from({ length: COLS * ROWS }, (_, i) => ({ i, open: Boolean(cfg.openAll) || TUNE.open.includes(i), crop: null, g: 0, w: 0, dryH: 0, ripeH: 0, rot: false, comp: false, bornH: 0 })),
    bought: 0, barn: { level: 0, items: {} }, sprinkler: { level: 0, nextH: Infinity }, compost: 0,
    sel: cfg.seasonAt(1).crops[0], days: {}, seen: new Set(), news: [], order: null, bear: null,
    tickH: START_H, weather: 'sun', market: {}, stats: freshStats(),
  };
  const ids = cropsOfRun(cfg);
  S.mr = dice((S.seed ^ 0x5bd1e995) >>> 0);                     // the market's own stream
  S.br = dice((S.seed ^ 0x27d4eb2f) >>> 0);                     // the bear's choices
  for (const id of ids) S.market[id] = newMarket(S, id);
  for (const id of ids) S.barn.items[id] = [];
  plan(S);
  S.weather = S.days[1].weather;
  for (const id of ids) marketTick(S, id, 0);                    // the opening rates
  for (const e of allEvents(S)) if (e.news <= S.h && !S.seen.has(e.id)) announce(S, e, true);
  emit(S, 'open', { season: cfg.seasonAt(1).id });
  return S;
}
function freshStats() {
  return { harvested: 0, byCrop: {}, bumpers: 0, sold: 0, earned: 0, bestRatio: 0, bestSale: null, orders: 0, shooed: 0, eaten: 0, rotten: 0, opened: 0, planted: 0, watered: 0, bullSold: 0, closing: 0, peakBarn: 0 };
}
export function cropsOfRun(cfg) {
  if (!cfg.endless || cfg.mode !== 'endless') return [...cfg.season.crops];
  const all = new Set(); for (let d = 1; d <= 28; d += 7) for (const c of cfg.seasonAt(d).crops) all.add(c);
  return [...all];
}

// a crop's market, with nine days of history drawn from a stream of its own (so the week's stream is untouched)
function newMarket(S, id) {
  const c = CROPS[id], r = dice((S.seed ^ hashOf(`hist:${id}`)) >>> 0);
  const base = c.base * (S.cfg.seasonAt(1).seasonal?.[id] || 1);
  const m = { id, x: 0, r: base, fair: base, candles: [], live: null, spark: [], prevClose: base, open: base };
  let x = r.normal() * c.vol * 2;
  for (let d = -TUNE.history + 1; d <= 0; d++) {
    let o = null, hi = -Infinity, lo = Infinity, cl = 0;
    for (let q = 0; q < 24 / TUNE.tick; q++) {
      x += c.rev * TUNE.tick * -x + c.vol * Math.sqrt(TUNE.tick) * r.normal();
      if (c.jumpy && r() < TUNE.jump) x += (r() < 0.55 ? 1 : -1) * r.range(0.12, 0.3);
      const v = base * Math.exp(x);
      if (o == null) o = v;
      hi = Math.max(hi, v); lo = Math.min(lo, v); cl = v;
      if (d === 0 && q % 2 === 0) m.spark.push(v);
    }
    m.candles.push({ day: d, o, h: hi, l: lo, c: cl });
  }
  m.x = x; m.prevClose = m.candles[m.candles.length - 1].c;
  return m;
}

// ---------- the plan: a day at a time, a few days ahead ----------
function plan(S) {
  const d = clockOf(S.h).day;
  for (let k = d; k <= d + 3; k++) if (!S.days[k]) S.days[k] = planDay(S.cfg, S.seed, k);
  for (const k in S.days) if (Number(k) < d - 2) delete S.days[k];           // Endless: the past is forgotten
}
export const allEvents = (S) => Object.values(S.days).flatMap((p) => p.events);
export const dayPlan = (S, day) => S.days[day] || (S.days[day] = planDay(S.cfg, S.seed, day));

// ---------- the market ----------
// a crop's usual rate at hour h: its base, its season, the news about it, and the mood (bull, bear) of the whole market
export function fairOf(S, id, h = S.h) {
  const c = CROPS[id], s = S.cfg.seasonAt(clockOf(h).day);
  let f = c.base * (s.seasonal?.[id] || 1);
  for (const e of allEvents(S)) {
    if (e.crop === id && (e.type === 'fair' || e.type === 'trend' || e.type === 'glut' || e.type === 'rumor')) f *= bend(e, h);
    else if (e.type === 'bull' || e.type === 'bear') f *= bend(e, h);
  }
  return f;
}
export const moodOf = (S, h = S.h) => allEvents(S).filter((e) => e.type === 'bull' || e.type === 'bear').reduce((m, e) => m * bend(e, h), 1);
export const rateOf = (S, id) => S.market[id]?.r ?? 0;

function marketTick(S, id, dtH) {
  const c = CROPS[id], m = S.market[id];
  if (dtH > 0) {
    m.x += c.rev * dtH * -m.x + c.vol * Math.sqrt(dtH) * S.mr.normal();
    if (c.jumpy && S.mr() < TUNE.jump) m.x += (S.mr() < 0.55 ? 1 : -1) * S.mr.range(0.12, 0.3);
  }
  m.fair = fairOf(S, id);
  m.r = m.fair * Math.exp(m.x);
  touch(S, m);
}
function touch(S, m) {
  const day = clockOf(S.h).day;
  if (!m.live || m.live.day !== day) {
    if (m.live) { m.candles.push(m.live); m.prevClose = m.live.c; if (m.candles.length > 40) m.candles.shift(); }
    m.live = { day, o: m.r, h: m.r, l: m.r, c: m.r };
  }
  m.live.h = Math.max(m.live.h, m.r); m.live.l = Math.min(m.live.l, m.r); m.live.c = m.r;
}
// the % change since yesterday's close
export const changeOf = (S, id) => { const m = S.market[id]; return m ? m.r / m.prevClose - 1 : 0; };

// ---------- the barn ----------
export const have = (S, id) => sum(S.barn.items[id] || [], (b) => b.n);
export const barnCount = (S) => sum(Object.keys(S.barn.items), (id) => have(S, id));
export const barnCap = (S) => TUNE.barn[S.barn.level];
function take(S, id, n) {
  const b = S.barn.items[id]; let got = 0;
  while (got < n && b.length) { const k = Math.min(n - got, b[0].n); b[0].n -= k; got += k; if (b[0].n <= 0) b.shift(); }
  return got;
}

// ---------- what the player does ----------
export const select = (S, id) => { if (S.market[id] && S.cfg.seasonAt(clockOf(S.h).day).crops.includes(id)) S.sel = id; };
export const growing = (p) => p.open && p.crop && !p.rot && p.g < 1;
export const ripe = (p) => p.open && p.crop && !p.rot && p.g >= 1;
export const thirsty = (p) => growing(p) && p.w < 0.34;

// The one action of a plot (a tap, or a finger passing over it): clear a rotten crop, harvest a ripe one, water a dry
// one, or plant the chosen seed in empty soil. A locked plot only says what it costs (buying it is `buy`).
export function act(S, i, { water = true, plant = true } = {}) {
  const p = S.plots[i];
  if (!p || S.over) return null;
  if (!p.open) return { type: 'locked', i, cost: nextCost(S, 'plot') };
  if (p.rot) { clearPlot(p); S.stats.rotten++; emit(S, 'clear', { i }); return { type: 'clear', i }; }
  if (ripe(p)) {
    const c = CROPS[p.crop], bump = p.dryH <= TUNE.bumperDry, n = c.yield + (bump ? 1 : 0);
    if (barnCount(S) + n > barnCap(S)) { emit(S, 'full', { i, crop: p.crop }); return { type: 'full', i }; }
    S.barn.items[p.crop].push({ n });
    const st = S.stats; st.harvested += n; st.byCrop[p.crop] = (st.byCrop[p.crop] || 0) + n; if (bump) st.bumpers++;
    st.peakBarn = Math.max(st.peakBarn, barnCount(S));
    const crop = p.crop; clearPlot(p);
    emit(S, 'harvest', { i, crop, n, bump });
    return { type: 'harvest', i, crop, n, bump };
  }
  if (growing(p)) {
    if (!water || p.w >= 0.75) return null;
    p.w = 1; S.stats.watered++;
    emit(S, 'water', { i });
    return { type: 'water', i };
  }
  if (!p.crop && plant) {
    const c = CROPS[S.sel];
    if (!c) return null;
    if (S.gold < c.seed) { emit(S, 'broke', { i, need: c.seed }); return { type: 'broke', i, need: c.seed }; }
    S.gold -= c.seed;
    Object.assign(p, { crop: c.id, g: 0, w: 1, dryH: 0, ripeH: 0, rot: false, comp: S.compost > 0, bornH: S.h });
    if (S.compost > 0) S.compost--;
    S.stats.planted++;
    emit(S, 'plant', { i, crop: c.id });
    return { type: 'plant', i, crop: c.id };
  }
  return null;
}
function clearPlot(p) { Object.assign(p, { crop: null, g: 0, w: p.w, dryH: 0, ripeH: 0, rot: false, comp: false }); }

// Sell up to n of a crop, oldest first, each at the rate it's at when it goes (every unit pushes the rate down).
export function sell(S, id, n = 1) {
  const m = S.market[id], c = CROPS[id];
  if (!m || S.over) return { n: 0, gold: 0 };
  let k = 0, gold = 0;
  const before = m.r;
  while (k < n && have(S, id) > 0) {
    take(S, id, 1);
    gold += m.r; k++;
    const ratio = m.r / c.base;
    if (ratio > S.stats.bestRatio) { S.stats.bestRatio = ratio; S.stats.bestSale = { crop: id, rate: m.r, ratio }; }
    m.x -= c.impact;
    m.r = m.fair * Math.exp(m.x);
    touch(S, m);
  }
  if (!k) return { n: 0, gold: 0 };
  S.gold += gold;
  S.stats.sold += k; S.stats.earned += gold;
  if (moodOf(S) > 1.05) S.stats.bullSold += gold;
  emit(S, 'sell', { crop: id, n: k, gold, from: before, to: m.r });
  return { n: k, gold };
}

export function nextCost(S, what) {
  if (what === 'plot') return S.bought < TUNE.plotCost.length ? TUNE.plotCost[S.bought] : null;
  if (what === 'barn') return S.barn.level + 1 < TUNE.barn.length ? TUNE.barnCost[S.barn.level + 1] : null;
  if (what === 'sprinkler') return S.sprinkler.level + 1 < TUNE.sprinkler.length ? TUNE.sprinklerCost[S.sprinkler.level + 1] : null;
  if (what === 'compost') return TUNE.compost.cost;
  return null;
}
export function buy(S, what, i = null) {
  const cost = nextCost(S, what);
  if (cost == null || S.over) return null;
  if (S.gold < cost) { emit(S, 'broke', { need: cost, what }); return null; }
  if (what === 'plot') {
    const p = S.plots[i];
    if (!p || p.open) return null;
    p.open = true; p.w = 0; S.bought++; S.stats.opened++;
  } else if (what === 'barn') S.barn.level++;
  else if (what === 'sprinkler') { S.sprinkler.level++; S.sprinkler.nextH = S.h; }
  else if (what === 'compost') S.compost += TUNE.compost.n;
  S.gold -= cost;
  emit(S, 'buy', { what, i, cost });
  return { what, i, cost };
}

export function deliver(S) {
  const o = S.order;
  if (!o || S.over || have(S, o.crop) < o.n) return null;
  take(S, o.crop, o.n);
  const gold = o.n * o.pay;
  S.gold += gold; S.stats.orders++; S.stats.earned += gold;
  S.order = null;
  emit(S, 'deliver', { crop: o.crop, n: o.n, gold, who: o.who });
  return { gold };
}

// a tap on the bear: three and it runs off (and the bear market goes with it)
export function shoo(S) {
  const b = S.bear;
  if (!b || b.state === 'flee' || S.over) return null;
  b.scared++; b.hop = 0.3; b.eatT = 0;
  if (b.scared >= TUNE.bear.scare) { leave(S, 'shooed'); S.stats.shooed++; }
  emit(S, 'shoo', { n: b.scared, gone: b.state === 'flee' });
  return b.scared;
}
export const bearAt = (S, x, y) => S.bear && S.bear.state !== 'flee' && Math.hypot(S.bear.x - x, S.bear.y - y) < TUNE.bear.reach;

// ---------- the clock ----------
export function step(S, dt) {
  if (S.over) return;
  S.t += dt;
  const dtH = dt / HOUR, before = S.h;
  S.h += dtH;
  const c0 = clockOf(before), c1 = clockOf(S.h);
  if (c1.day !== c0.day) newDay(S, c1.day);
  if (Math.floor(S.h) !== Math.floor(before)) emit(S, 'hour', { h: Math.floor(S.h) });
  // the news, things starting and ending
  for (const e of allEvents(S)) {
    if (!S.seen.has(e.id) && S.h >= e.news) announce(S, e, false);
    if (S.seen.has(e.id) && !e.on && S.h >= e.start && !e.done) begin(S, e);
    if (e.on && S.h >= e.end && e.type !== 'bear') finishEvent(S, e);
  }
  const w = WEATHER[S.weather];
  // the soil and the crops
  for (const p of S.plots) {
    if (!p.open) continue;
    if (w.rain) p.w = 1;
    else if (p.crop && !p.rot) p.w = Math.max(0, p.w - dtH / TUNE.dryH * w.dry);
    if (!p.crop || p.rot) continue;
    if (p.g < 1) {
      const c = CROPS[p.crop];
      if (p.w <= 0) p.dryH += dtH;
      const night = c1.night && c.frost ? 1.25 : 1;
      const wg = w.frost && c.frost ? 1.3 : w.grow;
      p.g += dtH / c.grow * (p.w > 0 ? 1 : TUNE.dryGrow) * wg * night * (p.comp ? TUNE.compost.speed : 1);
      if (p.g >= 1) { p.g = 1; p.ripeH = 0; emit(S, 'ripe', { i: p.i, crop: p.crop }); }
    } else {
      p.ripeH += dtH;
      if (p.ripeH >= TUNE.rotH) { p.rot = true; emit(S, 'rot', { i: p.i, crop: p.crop }); }
    }
  }
  // sprinklers
  if (S.sprinkler.level && S.h >= S.sprinkler.nextH) {
    S.sprinkler.nextH = S.h + TUNE.sprinkler[S.sprinkler.level];
    let n = 0; for (const p of S.plots) if (growing(p) && p.w < 0.95) { p.w = 1; n++; }
    if (n) emit(S, 'sprinkle', { n });
  }
  // the market, every quarter hour
  while (S.tickH + TUNE.tick <= S.h) {
    S.tickH += TUNE.tick;
    for (const id in S.market) marketTick(S, id, TUNE.tick);
    for (const id in S.market) { const m = S.market[id]; if (Math.round(S.tickH / TUNE.tick) % 2 === 0) { m.spark.push(m.r); if (m.spark.length > 48) m.spark.shift(); } }
  }
  // the order runs out
  if (S.order && S.h >= S.order.until) { emit(S, 'expire', { crop: S.order.crop }); S.order = null; }
  bearStep(S, dt);
  if (S.h >= S.cfg.end) closingBell(S);
}

function newDay(S, day) {
  plan(S);
  S.weather = dayPlan(S, day).weather;
  const s0 = S.cfg.seasonAt(day - 1), s1 = S.cfg.seasonAt(day);
  if (s1 !== s0) {
    // Endless: a new season. What's in the barn that the new season doesn't grow goes at the market now.
    let n = 0, gold = 0;
    for (const id in S.barn.items) if (!s1.crops.includes(id)) { const r = sell(S, id, Infinity); n += r.n; gold += r.gold; }
    if (!s1.crops.includes(S.sel)) S.sel = s1.crops[0];
    emit(S, 'season', { season: s1.id, n, gold });
  }
  emit(S, 'day', { day, weather: S.weather, tomorrow: dayPlan(S, day + 1).weather });
}

function announce(S, e, quiet) {
  S.seen.add(e.id);
  if (e.type === 'bull' || e.type === 'bear' || e.type === 'order') return;      // these just happen
  S.news.unshift({ id: e.id, type: e.type, crop: e.crop, start: e.start, end: e.end, mult: e.mult, name: e.name, why: e.why });
  if (S.news.length > 8) S.news.pop();
  emit(S, 'news', { e, quiet });
}
function begin(S, e) {
  e.on = true;
  if (e.type === 'order') {
    if (!S.order && S.market[e.crop]) { S.order = { crop: e.crop, n: e.n, pay: e.pay, until: e.end, who: e.who, id: e.id }; emit(S, 'order', { ...S.order }); }
    e.done = true; e.on = false;
  } else if (e.type === 'bear') spawnBear(S, e);
  else if (e.type === 'bull') emit(S, 'bull', { e });
  else emit(S, 'start', { e });
}
function finishEvent(S, e) { e.on = false; e.done = true; emit(S, 'end', { e }); }

// ---------- the bear ----------
function spawnBear(S, e) {
  if (S.bear) { e.on = false; e.done = true; e.end = e.start; return; }
  const side = e.from, k = 0.15 + e.wander * 0.7;
  const at = [{ x: k * COLS, y: -1 }, { x: COLS + 1, y: k * ROWS }, { x: k * COLS, y: ROWS + 1 }, { x: -1, y: k * ROWS }][side];
  S.bear = { x: at.x, y: at.y, target: null, eatT: 0, scared: 0, stayT: 0, ate: 0, state: 'walk', hop: 0, face: 1, ev: e, walk: 0 };
  emit(S, 'bear', { e });
}
function leave(S, why) {
  const b = S.bear; if (!b) return;
  b.state = 'flee'; b.target = null;
  const ex = b.x < COLS / 2 ? -1.5 : COLS + 1.5;
  b.tx = ex; b.ty = clamp(b.y, -0.5, ROWS + 0.5);
  b.ev.end = S.h; b.ev.on = false; b.ev.done = true;
  emit(S, 'bearleft', { why, ate: b.ate });
}
function bearTarget(S) {
  const b = S.bear;
  const food = S.plots.filter((p) => p.open && p.crop && !p.rot && (p.g >= 1 || p.g > 0.45));
  if (!food.length) return null;
  const score = (p) => Math.hypot(plotXY(p.i).x - b.x, plotXY(p.i).y - b.y) - (p.g >= 1 ? 2 : 0) + S.br() * 0.6;
  return food.sort((a, c) => score(a) - score(c))[0].i;
}
function bearStep(S, dt) {
  const b = S.bear;
  if (!b) return;
  b.hop = Math.max(0, b.hop - dt);
  if (b.state !== 'flee') {
    b.stayT += dt;
    if (b.stayT > TUNE.bear.stay || b.ate >= TUNE.bear.max) leave(S, 'full');
  }
  if (b.state === 'flee') {
    move(b, b.tx, b.ty, TUNE.bear.speed * 2.6, dt);
    if (Math.abs(b.x - b.tx) < 0.1) { S.bear = null; emit(S, 'beargone', {}); }
    return;
  }
  if (b.state === 'eat') {
    const p = S.plots[b.target];
    if (!p.crop || p.rot) { b.state = 'walk'; b.target = null; return; }
    if (b.hop > 0) return;
    b.eatT += dt;
    if (b.eatT >= TUNE.bear.eat) {
      const crop = p.crop; clearPlot(p); b.ate++; S.stats.eaten++;
      emit(S, 'eaten', { i: p.i, crop });
      b.state = 'walk'; b.target = null; b.eatT = 0;
    }
    return;
  }
  if (b.target == null || !S.plots[b.target].crop) b.target = bearTarget(S);
  if (b.target == null) { if (b.stayT > 3) leave(S, 'bored'); return; }
  const q = plotXY(b.target);
  if (b.hop > 0) return;
  if (move(b, q.x, q.y + 0.05, TUNE.bear.speed, dt)) { b.state = 'eat'; b.eatT = 0; }
}
function move(b, tx, ty, v, dt) {
  const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy);
  if (d < 0.04) return true;
  const s = Math.min(d, v * dt);
  b.x += (dx / d) * s; b.y += (dy / d) * s; b.walk += s;
  if (Math.abs(dx) > 0.02) b.face = dx > 0 ? 1 : -1;
  return d - s < 0.04;
}

// ---------- the closing bell: what's left in the barn goes at the market, one by one ----------
export function closingBell(S) {
  if (S.over) return;
  let n = 0, gold = 0;
  for (const id in S.barn.items) { const r = sell(S, id, Infinity); n += r.n; gold += r.gold; }
  S.stats.closing = gold;
  S.over = { gold: S.gold, closing: { n, gold } };
  emit(S, 'close', { n, gold, total: S.gold });
}
