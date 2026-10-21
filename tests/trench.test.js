// TRENCHING SIMULATOR's engine (2026-10-20): its bonding curve's exact numbers, its dice, the same market from the same
// seed (with orders too, read or not, in steps or in chunks), a run played again from its log, every token always
// somewhere, its fates' odds and its coins' names; the smart wallets' records and their board; the player's money to
// the last fee, every order refused and why, each priority's delay, sandwich bots, a buy that completes a curve and an
// order caught by its migration, a sleeping coin woken, coins following their plans, two hours in a row, and every
// read. Pure: no network, no clock, no settings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUPPLY, RESERVED, START_MC, GRAD_SOL, GRAD_MC, GRAD_M, FEES, newCurve, curveAtM, curveM, buy, sell, buyQuote, mOf,
} from '../src/games/trenchingsimulator/curve.js';
import { makeRng, seedOf, hash32 } from '../src/games/trenchingsimulator/rng.js';
import { ODDS, COPY_ODDS, fateOdds, smartWeight, smartHistory, targetAt } from '../src/games/trenchingsimulator/fates.js';
import {
  makeName, tickerOk, nameOk, THEME_IDS, METAS, SMART_COUNT, smartAddress, isB58,
} from '../src/games/trenchingsimulator/names.js';
import {
  createMarket, replay, INFORMED, PRIORITY, MIN_BUY, BASE_FEE, DEFAULTS, KEEP, MAX_STEPS, DT, normalizeConfig, addressFrom,
} from '../src/games/trenchingsimulator/engine.js';

const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} is not ${b}`);
const feeOf = (p) => PRIORITY[p].fee + BASE_FEE;

// everything a terminal could read about a market, as one string
function snap(m) {
  const coins = [];
  for (let i = 0; i < m.size.coins; i++) coins.push([m.stats(i), m.holders(i, 100), m.candles(i)]);
  return JSON.stringify([m.t, m.n, m.lists(), m.player, m.positions(), m.orders(300), m.feed(0), m.tape(400),
    m.counts, m.meta, m.heat, m.koth, coins, m.equity(), m.smartWallets()]);
}

// every token is somewhere: its holders, its curve (and the pool's reserve), or its pool; and its holders' list and
// map are the same wallets, each at its place in the list
function conserve(m) {
  const bad = [];
  for (let id = 0; id < m.size.coins; id++) {
    const c = m.debug.coin(id);
    let sum = 0;
    if (c.hlist.length !== c.holders.size) bad.push(`${id}: ${c.hlist.length} in its list, ${c.holders.size} in its map`);
    c.hlist.forEach((h, i) => {
      sum += h.tok;
      if (!Number.isInteger(h.tok) || h.tok <= 0) bad.push(`${id}: a holder with ${h.tok}`);
      if (h.i !== i || c.holders.get(h.key) !== h) bad.push(`${id}: ${h.key} out of place`);
    });
    const total = c.mk.phase === 'pool' ? sum + c.mk.pool.tok : sum + c.mk.curve.left + RESERVED;
    if (total !== SUPPLY) bad.push(`${id}: ${total} tokens`);
  }
  return bad;
}

// a few orders on a few coins, the same way every time
function trade(m) {
  const out = [];
  for (let k = 0; k < 4; k++) {
    const L = m.lists();
    const all = [...(L.new || []), ...(L.stretch || []), ...(L.migrated || [])];
    if (!all.length) continue;
    const pick = all[(k * 3) % all.length].id;
    const r = m.order({ coin: pick, side: 'buy', sol: 0.2 + 0.1 * k, slippage: 0.3, priority: k % 2 ? 'turbo' : 'fast' });
    out.push(r.ok ? r.order.id : r.error);
    m.advance(7);
    if (k === 2) out.push(m.order({ coin: pick, side: 'sell', frac: 0.5 }).ok);
  }
  m.advance(20);
  return out;
}

test("the curve has pump.fun's numbers, and a full buy pays only for what it gets", () => {
  near(START_MC, 27.959, 0.001, 'its start');
  near(GRAD_SOL, 85.005, 0.001, 'the SOL it raises');
  near(GRAD_MC, 410.88, 0.01, 'its market cap when sold out');
  near(GRAD_M, 14.696, 0.001, 'how many times its start');
  assert.equal(RESERVED, 206_900_000);
  for (const m of [1, 2, 5, 10, 14]) near(curveM(curveAtM(m)), m, 0.001, `curveAtM(${m})`);
  const mk = { phase: 'curve', curve: newCurve(), pool: null };
  const q = buyQuote(mk, 200);
  assert.ok(q.full && q.used < 200 && q.used > GRAD_SOL, 'a buy bigger than the curve pays for what is left');
  // a buy then the same tokens sold back: never more SOL out than in
  const mk2 = { phase: 'curve', curve: newCurve(), pool: null };
  const b = buy(mk2, 1);
  const s = sell(mk2, b.out);
  assert.ok(s.sol < 1 && s.sol > 1 - 2.1 * FEES.curve, `round trip ${s.sol}`);
  assert.equal(mk2.curve.left, newCurve().left);
});

test('the dice: the same seed gives the same numbers, and close seeds land far apart', () => {
  const a = makeRng(seedOf('run', 'coin', 1));
  const b = makeRng(seedOf('run', 'coin', 1));
  for (let i = 0; i < 1000; i++) assert.equal(a.f(), b.f());
  assert.notEqual(seedOf('run', 'coin', 1), seedOf('run', 'coin', 2));
  assert.notEqual(hash32('a'), hash32('b'));
  const r = makeRng(7);
  for (let i = 0; i < 2000; i++) {
    const x = r.f();
    assert.ok(x >= 0 && x < 1);
    assert.ok(Number.isFinite(r.normal()) && r.poisson(3) >= 0 && r.poisson(50) >= 0);
  }
});

test('the same seed makes the same market, with orders too', () => {
  const a = createMarket({ seed: 'same' });
  const b = createMarket({ seed: 'same' });
  assert.deepEqual(trade(a), trade(b));
  assert.equal(snap(a), snap(b));
  const c = createMarket({ seed: 'other' });
  trade(c);
  assert.notEqual(snap(a), snap(c));
});

test('a run played again from its log is the same run', () => {
  const a = createMarket({ seed: 'replay', config: { mev: true } });
  trade(a);
  const r = replay({ seed: 'replay', config: { mev: true }, log: a.log(), until: a.n });
  assert.equal(snap(r), snap(a));
});

test('in steps or in chunks, read or not, the market is the same', () => {
  const a = createMarket({ seed: 'chunks' });
  const b = createMarket({ seed: 'chunks' });
  for (let i = 0; i < 600; i++) {
    a.step();
    if (i % 37 === 0) {
      a.lists();
      a.tape(50);
      a.feed(0);
      a.quote({ coin: 0, side: 'buy', sol: 0.5 });
      a.smartWallets();
      for (let k = 0; k < a.size.coins; k += 7) {
        a.stats(k);
        a.holders(k);
        a.trades(k);
        a.comments(k);
        a.candles(k, 0);
        a.info(k);
        a.row(k);
      }
      a.netWorth();
      a.maxBuy('turbo');
      a.positions();
      a.find('a');
      a.equity(0);
    }
  }
  b.advance(60);
  assert.equal(snap(a), snap(b));
});

test('every token is always somewhere, and nothing is NaN, after half an hour', () => {
  const m = createMarket({ seed: 'conserve', config: { mev: true } });
  for (let i = 0; i < 6; i++) {
    trade(m);
    m.advance(240);
    assert.deepEqual(conserve(m), []);
  }
  const s = snap(m);
  assert.ok(!s.includes('NaN') && !s.includes('Infinity') && !s.includes('null,null,null'), 'NaN or Infinity in a read');
  assert.ok(m.counts.launched > 100 && m.counts.migrated > 0, JSON.stringify(m.counts));
});

test("the fates' odds add up, and copies and hot themes move them the right way", () => {
  const sum = (o) => Object.values(o).reduce((x, y) => x + y, 0);
  for (const o of [ODDS, COPY_ODDS, fateOdds({}), fateOdds({ copy: true })]) near(sum(o), 1, 1e-9, 'its odds');
  // a hot theme's are weights (META_BOOST on its runners and moons): their share goes up, nothing else's does
  const hot = fateOdds({ hot: true });
  assert.ok(hot.moon / sum(hot) > ODDS.moon && hot.runner / sum(hot) > ODDS.runner, 'a hot theme makes runners likelier');
  assert.ok(hot.dud / sum(hot) < ODDS.dud, 'and duds rarer');
  const copy = fateOdds({ copy: true });
  assert.ok(!copy.moon && !copy.runner && copy.rug > ODDS.rug, 'a copy never runs');
  assert.ok(INFORMED > 0 && INFORMED < 1);
});

test("its coins' names: PG-13, never a real coin's ticker or AGI, over thousands of draws", () => {
  const r = makeRng(seedOf('names'));
  for (let i = 0; i < 5000; i++) {
    const n = makeName(r, THEME_IDS[i % THEME_IDS.length]);
    assert.ok(tickerOk(n.ticker), `ticker ${n.ticker}`);
    assert.ok(nameOk(n.name), `name ${n.name}`);
  }
  for (const t of ['PEPE', 'DOGE', 'WIF', 'BONK', 'AGI', 'XAGI', 'COIN', 'HOOD', 'META', 'TSLA']) assert.equal(tickerOk(t), false, t);
});

// every number in it is finite (null is fine)
function finiteDeep(x, path = '$') {
  if (typeof x === 'number') {
    assert.ok(Number.isFinite(x), `${path} is ${x}`);
    return;
  }
  if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) finiteDeep(v, `${path}.${k}`);
}

// how closely two lists of numbers go together (Pearson's r)
function corr(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  return sxy / Math.sqrt(sxx * syy);
}

const isAddr = (a) => typeof a === 'string' && a.length === 44 && isB58(a);
const LISTS = ['new', 'stretch', 'migrated', 'trending', 'bump'];
// a seed whose six 2 SOL buys at 60% slippage get sandwiched 5 times (measured): so its "none" below means something
const NONE_SEED = 'mev3';

test("the smart wallets' odds, and their week before the run", () => {
  near(smartWeight(0, 'good'), 0.4, 1e-12, 'good at 0');
  near(smartWeight(1, 'good'), 1.9, 1e-12, 'good at 1');
  near(smartWeight(0, 'bad'), 1.9, 1e-12, 'bad at 0');
  near(smartWeight(1, 'bad'), 0.4, 1e-12, 'bad at 1');
  for (let i = 0; i < 10; i++) {
    const q = i / 10;
    const q2 = (i + 1) / 10;
    assert.ok(smartWeight(q2, 'good') > smartWeight(q, 'good'), `good rises at ${q}`);
    assert.ok(smartWeight(q2, 'bad') < smartWeight(q, 'bad'), `bad falls at ${q}`);
    assert.equal(smartWeight(q, 'slow'), 1);
    assert.equal(smartWeight(q), 1);
    assert.ok(smartWeight(q, 'good') > 0 && smartWeight(q, 'bad') > 0);
  }
  // the same dice, the same week
  assert.deepEqual(smartHistory(makeRng(seedOf('week', 7)), 0.6), smartHistory(makeRng(seedOf('week', 7)), 0.6));
  const qs = [];
  const rates = [];
  for (let i = 0; i < 400; i++) {
    const q = makeRng(seedOf('q', i)).f();
    const h = smartHistory(makeRng(seedOf('h', i)), q);
    assert.ok(Number.isInteger(h.trades) && h.trades >= 25 && h.trades <= 140, `trades ${h.trades}`);
    assert.ok(Number.isInteger(h.won) && h.won >= 0 && h.lost >= 0, JSON.stringify(h));
    assert.equal(h.won + h.lost, h.trades);
    assert.ok(Number.isFinite(h.vol) && h.vol > 0, `vol ${h.vol}`);
    assert.ok(Number.isFinite(h.pnl), `pnl ${h.pnl}`);
    qs.push(q);
    rates.push(h.won / h.trades);
  }
  // a better wallet wins more often, with luck in it (measured: 0.685)
  const r = corr(qs, rates);
  assert.ok(r > 0.45 && r < 0.9, `r ${r}`);
});

test("the smart money board: each wallet's record, what it holds and what that's worth", () => {
  const m = createMarket({ seed: 'smart' });
  m.advance(300);
  const W = m.smartWallets();
  const Q = m.debug.smartQuality();
  assert.equal(W.length, SMART_COUNT);
  // every smart wallet holding a coin is on the board with it
  let mHolders = 0;
  for (let id = 0; id < m.size.coins; id++) {
    for (const h of m.debug.coin(id).hlist) {
      if (!/^m\d+$/.test(h.key)) continue;
      mHolders++;
      assert.equal(h.label, 'smart', `${id} ${h.key}`);
      assert.ok(W[Number(h.key.slice(1))].open.some((o) => o.coin === id), `${h.key} holds ${id}`);
    }
  }
  let opens = 0;
  W.forEach((w, k) => {
    assert.equal(w.n, k);
    assert.equal(w.addr, smartAddress(k));
    assert.ok(isAddr(w.addr));
    // its quality and its week come from the run's seed alone
    assert.equal(Q[k], makeRng(seedOf('smart', 'smart', k)).f());
    assert.deepEqual(w.d7, smartHistory(makeRng(seedOf('smart', 'smart7', k)), Q[k]));
    assert.ok(w.won + w.lost <= Math.min(w.buys, w.sells), `${k}: ${JSON.stringify(w)}`);
    let value = 0;
    let upnl = 0;
    w.open.forEach((o, i) => {
      if (i > 0) assert.ok(o.coin > w.open[i - 1].coin, 'sorted by coin');
      const h = m.debug.coin(o.coin).holders.get(`m${k}`);
      assert.ok(h && h.label === 'smart');
      assert.equal(o.tok, h.tok);
      assert.equal(o.in, h.in);
      assert.equal(o.out, h.out);
      assert.ok(o.value >= 0);
      value += o.value;
      upnl += o.value + o.out - o.in;
    });
    near(w.value, value, 1e-9, `${k}: value`);
    near(w.upnl, upnl, 1e-9, `${k}: upnl`);
    finiteDeep(w, `wallet ${k}`);
    if (w.last === null) assert.equal(w.buys, 0);
    else assert.ok(w.last <= m.t);
    opens += w.open.length;
  });
  assert.equal(mHolders, opens);
  assert.ok(W.filter((w) => w.buys > 0).length >= 20, 'most wallets traded');
  assert.ok(W.reduce((s, w) => s + w.won + w.lost, 0) > 0, 'some closed a position');
  // copies: changing what it gave changes nothing in the market
  W[0].d7.trades = -1;
  assert.notEqual(m.smartWallets()[0].d7.trades, -1);
  Q[0] = 5;
  assert.notEqual(m.debug.smartQuality()[0], 5);
});

test("the player's money to the last fee: a quote, a buy, its position, a sell", () => {
  const start = 2;
  const m = createMarket({ seed: 'money', startSol: start });
  const tf = DEFAULTS.terminalFee;
  const fee = feeOf('fast');
  const id = m.lists().new.find((r) => r.age > 120 && r.phase === 'curve').id;
  // a quote: what it would spend and get, and every fee
  const q = m.quote({ coin: id, side: 'buy', sol: 0.5 });
  assert.equal(q.ok, true, JSON.stringify(q));
  assert.equal(q.spent, 0.5);
  assert.equal(q.refund, 0);
  assert.equal(q.full, false);
  assert.equal(q.minTokens, Math.floor(q.tokens * (1 - 0.2)));
  assert.equal(q.fees.network, fee);
  near(q.fees.terminal, 0.5 * tf, 1e-12, 'terminal fee');
  near(q.fees.market, 0.5 * (1 - tf) * FEES.curve, 1e-12, 'market fee');
  assert.equal(q.enough, true);
  assert.equal(q.slippage, 0.2);
  assert.equal(q.priority, 'fast');
  assert.ok(q.impact > 0);
  assert.ok(q.mcAfter > q.spot * SUPPLY);
  // the order: its SOL held, not spent, until it lands
  const r = m.order({ coin: id, side: 'buy', sol: 0.5 });
  assert.equal(r.ok, true, JSON.stringify(r));
  const o = r.order;
  assert.equal(o.status, 'pending');
  assert.equal(o.hold, 0.5 + fee);
  assert.equal(o.t, m.t);
  assert.ok(o.landAt - o.t >= PRIORITY.fast.lo - 1e-9 && o.landAt - o.t <= PRIORITY.fast.hi + 1e-9);
  near(m.player.sol + m.player.held, start, 1e-12, 'held, not spent');
  assert.equal(m.player.pending, 1);
  assert.equal(m.stats(id).pending.length, 1);
  m.advance(2);
  const f = m.orders(1)[0];
  assert.equal(f.id, o.id);
  assert.equal(f.status, 'filled', JSON.stringify(f));
  assert.equal(f.doneAt, f.landAt);
  assert.equal(m.player.held, 0);
  assert.equal(m.player.pending, 0);
  near(m.player.fees.priority, fee, 1e-15, 'its priority fee');
  near(f.spent, 0.5, 1e-12, 'spent');
  near(m.player.sol, start - f.spent - fee, 1e-12, 'SOL after');
  near(m.player.fees.terminal, f.spent * tf, 1e-12, 'terminal paid');
  // its position: what it cost, to the last fee, and what it's worth
  const [p] = m.positions();
  assert.equal(p.id, id);
  assert.equal(p.open, true);
  assert.equal(p.buys, 1);
  assert.equal(p.tokens, f.tok);
  near(p.cost, f.spent + fee, 1e-12, 'its cost');
  assert.equal(p.invested, p.cost);
  near(m.player.worth, m.player.sol + p.value, 1e-12, 'worth');
  near(p.pnl, p.value - p.cost, 1e-12, 'pnl');
  // all of it sold: what it made or lost is exactly what the SOL shows
  const s = m.order({ coin: id, side: 'sell', slippage: 1 });
  assert.equal(s.ok, true, JSON.stringify(s));
  assert.equal(s.order.hold, fee);
  assert.equal(s.order.frac, 1);
  m.advance(2);
  const g = m.orders(1)[0];
  assert.equal(g.status, 'filled', JSON.stringify(g));
  assert.equal(g.tok, f.tok);
  const [p2] = m.positions();
  assert.equal(p2.tokens, 0);
  assert.equal(p2.cost, 0);
  assert.equal(p2.open, false);
  assert.equal(p2.sells, 1);
  near(p2.realized, m.player.sol - start, 1e-9, 'realized is in its SOL');
  assert.equal(m.player.worth, m.player.sol);
  near(m.player.fees.priority, 2 * fee, 1e-15, 'two fees');
  assert.equal(m.player.held, 0);
  assert.deepEqual(m.stats(id).me, { tokens: 0, cost: 0, value: 0, realized: p2.realized });
});

test('every order the engine refuses, and why; its settings and limits; its addresses', () => {
  const m = createMarket({ seed: 'err', config: { warmup: 120 } });
  const fresh = createMarket({ seed: 'err', config: { warmup: 120 } });
  const id = m.lists().new[0].id;
  const buy = (o) => ({ coin: id, side: 'buy', sol: 0.1, ...o });
  const sell = (o) => ({ coin: id, side: 'sell', ...o });
  const no = (p, error, quoteToo = true) => {
    assert.deepEqual(m.order(p), { ok: false, error }, `order ${JSON.stringify(p)}`);
    if (quoteToo) assert.deepEqual(m.quote(p), { ok: false, error }, `quote ${JSON.stringify(p)}`);
  };
  no(buy({ coin: 99999 }), 'no_coin');
  no(buy({ side: 'hold' }), 'bad');
  for (const sol of [MIN_BUY / 10, NaN, 'x']) no(buy({ sol }), 'min_buy');
  // more than it has: refused, while a quote says how it would go and that it isn't enough
  for (const sol of [5, 1]) {
    no(buy({ sol }), 'not_enough_sol', false);
    const q = m.quote(buy({ sol }));
    assert.equal(q.ok, true);
    assert.equal(q.enough, false);
  }
  no(sell(), 'no_tokens');
  for (const priority of ['warp', 'toString']) no(buy({ priority }), 'bad');
  no(buy({ slippage: 'x' }), 'bad');
  for (const frac of [0, 1.5]) no(sell({ frac }), 'bad');
  no(null, 'no_coin');
  for (const coin of ['3x', -1, 1.5]) no(buy({ coin }), 'no_coin');
  assert.deepEqual(m.quote(sell({ tokens: -5 })), { ok: false, error: 'bad' });
  assert.equal(m.quote(buy({ coin: String(id) })).ok, true);
  // nothing of all that was kept, held or charged
  assert.deepEqual(m.log(), []);
  assert.deepEqual(m.orders(), []);
  assert.equal(m.player.sol, 1);
  assert.equal(m.player.held, 0);
  assert.deepEqual(m.player.fees, { terminal: 0, market: 0, priority: 0, failed: 0, mev: 0 });
  // and the refusals drew no dice: its first real order lands as on a market that never saw them
  const a = m.order(buy({ coin: String(id) }));
  const b = fresh.order(buy());
  assert.ok(a.ok && b.ok);
  assert.equal(a.order.coin, id);
  assert.equal(a.order.landAt, b.order.landAt);
  // its settings, each kept inside its range
  assert.deepEqual(normalizeConfig(), { ...DEFAULTS });
  assert.deepEqual(normalizeConfig(null), { ...DEFAULTS });
  assert.deepEqual(normalizeConfig('fast'), { ...DEFAULTS });
  const one = (k, v) => normalizeConfig({ [k]: v })[k];
  for (const [v, w] of [[0, 0.5], [100, 30], ['abc', 7], [Infinity, 7], ['12', 12], [null, 7]]) {
    assert.equal(one('launchesPerMin', v), w, `launchesPerMin ${v}`);
  }
  for (const [v, w] of [[-5, 0], [1e9, 3600], [12.6, 13]]) assert.equal(one('warmup', v), w, `warmup ${v}`);
  for (const [v, w] of [[1, 0.05], [-1, 0]]) assert.equal(one('terminalFee', v), w, `terminalFee ${v}`);
  for (const [v, w] of [[0, 0.005], [5, 1]]) assert.equal(one('slippage', v), w, `slippage ${v}`);
  for (const [v, w] of [['toString', 'fast'], ['ULTRA', 'fast'], ['ultra', 'ultra']]) {
    assert.equal(one('priority', v), w, `priority ${v}`);
  }
  for (const [v, w] of [['yes', false], [1, false], [true, true]]) assert.equal(one('mev', v), w, `mev ${v}`);
  assert.deepEqual(Object.keys(normalizeConfig({ extra: 1 })).sort(), Object.keys(DEFAULTS).sort());
  // a market's start: its SOL and its dollar price, kept sane
  const lim = (o = {}) => createMarket({ seed: 'lim', ...o, config: { warmup: 0, ...(o.config || {}) } });
  for (const v of [-1, 'x', 0, Infinity, NaN]) {
    const x = lim({ startSol: v });
    assert.equal(x.startSol, 1, `startSol ${v}`);
    assert.equal(x.player.sol, 1);
  }
  assert.equal(lim({ startSol: 5e9 }).startSol, 1e6);
  const half = lim({ startSol: '2.5' });
  assert.equal(half.startSol, 2.5);
  assert.equal(half.player.sol, 2.5);
  for (const v of [-3, 'x', 0]) assert.equal(lim({ solUsd: v }).solUsd, 150, `solUsd ${v}`);
  assert.equal(lim({ solUsd: 99 }).solUsd, 99);
  assert.equal(lim({ config: { priority: 'warp' } }).config.priority, 'fast');
  // addresses: 44 base58 characters, the same number the same address, different numbers different ones
  const a1 = addressFrom(12345);
  assert.ok(isAddr(a1));
  assert.equal(addressFrom(12345), a1);
  const many = new Set();
  for (let h = 0; h < 1000; h++) many.add(addressFrom(h));
  assert.equal(many.size, 1000);
  assert.equal(addressFrom(-1), addressFrom(2 ** 32 - 1));
  assert.equal(m.player.address, addressFrom(seedOf('err', 'me')));
});

test('time: steps and seconds, advance and advanceTo, the same market', () => {
  const a = createMarket({ seed: 'clock' });
  const b = createMarket({ seed: 'clock' });
  const c = createMarket({ seed: 'clock' });
  assert.equal(a.n0, DEFAULTS.warmup / DT);
  assert.equal(a.n, a.n0);
  assert.equal(a.t, 0);
  for (let i = 0; i < 600; i++) assert.equal(a.advance(DT), 1);
  assert.equal(b.advance(60), 600);
  assert.equal(c.advanceTo(37.3), 373);
  near(c.t, 37.3, 1e-9, 'its time');
  assert.equal(c.advanceTo(60), 227);
  // never back, never on nonsense
  for (const x of [10, 59.99, NaN, 'x', Infinity, -Infinity, undefined]) assert.equal(c.advanceTo(x), 0, `advanceTo(${x})`);
  for (const x of [-5, 'x', NaN, null, 0, 0.04]) assert.equal(c.advance(x), 0, `advance(${x})`);
  for (const x of [a, b, c]) {
    assert.equal(x.t, 60);
    assert.equal(x.n, x.n0 + 600);
  }
  const s = snap(a);
  assert.equal(snap(b), s);
  assert.equal(snap(c), s);
});

test("each priority's delay and fee, and a market's own priority and slippage", () => {
  const m = createMarket({ seed: 'prio', startSol: 10 });
  const id = m.lists().new.find((r) => r.age > 60).id;
  let fees = 0;
  for (const p of ['fast', 'turbo', 'ultra']) {
    const { lo, hi } = PRIORITY[p];
    for (let i = 0; i < 5; i++) {
      const r = m.order({ coin: id, side: 'buy', sol: 0.05, slippage: 1, priority: p });
      assert.equal(r.ok, true, JSON.stringify(r));
      assert.equal(r.order.priority, p);
      assert.equal(r.order.fee, feeOf(p));
      const d = r.order.landAt - r.order.t;
      assert.ok(d >= lo - 1e-9 && d <= hi + 1e-9, `${p} lands after ${d} s`);
      fees += feeOf(p);
    }
    m.advance(1);
  }
  const os = m.orders(15);
  assert.equal(os.length, 15);
  for (const o of os) {
    assert.equal(o.status, 'filled', JSON.stringify(o));
    assert.equal(o.doneAt, o.landAt);
  }
  assert.equal(m.player.pending, 0);
  assert.equal(m.player.held, 0);
  near(m.player.fees.priority, fees, 1e-12, 'their priority fees');
  assert.equal(m.order({ coin: id, side: 'buy', sol: 0.05, slippage: null }).order.slippage, 0.2);
  // a market's own settings are what an order takes when it says nothing
  const t = createMarket({ seed: 'prio2', startSol: 10, config: { priority: 'turbo', slippage: 0.3, warmup: 120 } });
  const id2 = t.lists().new[0].id;
  const o = t.order({ coin: id2, side: 'buy', sol: 0.05 }).order;
  assert.equal(o.priority, 'turbo');
  assert.equal(o.fee, feeOf('turbo'));
  assert.equal(o.slippage, 0.3);
  assert.ok(o.landAt - o.t >= PRIORITY.turbo.lo - 1e-9 && o.landAt - o.t <= PRIORITY.turbo.hi + 1e-9);
  for (const [sl, want] of [[5, 1], [0, 0.005], [null, 0.3], ['0.25', 0.25]]) {
    assert.equal(t.order({ coin: id2, side: 'buy', sol: 0.05, slippage: sl }).order.slippage, want, `slippage ${sl}`);
  }
  const q = t.quote({ coin: id2, side: 'buy', sol: 0.05, slippage: 9 });
  assert.equal(q.slippage, 1);
  assert.equal(q.priority, 'turbo');
  assert.equal(q.fees.network, feeOf('turbo'));
});

test('sandwich bots: only when they can, never past the slippage, every token back where it was', () => {
  const tf = DEFAULTS.terminalFee;
  let tries = 0;
  let hits = 0;
  for (let s = 0; s < 6; s++) {
    const m = createMarket({ seed: `mev${s}`, startSol: 50, config: { mev: true } });
    let lost = 0;
    for (let k = 0; k < 6; k++) {
      const L = m.lists();
      const pick = L.new[k] || L.new[0];
      const r = m.order({ coin: pick.id, side: 'buy', sol: 2, slippage: 0.6 });
      assert.equal(r.ok, true, JSON.stringify(r));
      tries++;
      m.advance(1.5);
      const o = m.orders(20).find((x) => x.id === r.order.id);
      assert.equal(o.status, 'filled', JSON.stringify(o));
      if (!o.mev) continue;
      hits++;
      assert.notEqual(o.priority, 'ultra');
      assert.ok(o.slippage > 0.15);
      for (const x of ['lostTok', 'lostSol', 'got']) assert.ok(o.mev[x] >= 0, `${x} ${o.mev[x]}`);
      assert.ok(o.mev.sol >= 0.01, `the bot's buy ${o.mev.sol}`);
      // the player's buy still got at least the rate its slippage allowed
      assert.ok(o.tok / (o.spent * (1 - tf)) >= o.minRate * (1 - 1e-9), 'never past its slippage');
      assert.ok(m.trades(o.coin, 120).some((x) => x.label === 'mev'), 'its trades show the bot');
      lost += o.mev.lostSol;
    }
    m.advance(5);
    near(m.player.fees.mev, lost, 1e-9, `mev${s}: losses`);
    // the bots sold right after: none of them holds anything
    for (let id = 0; id < m.size.coins; id++) {
      assert.ok(!m.debug.coin(id).hlist.some((h) => h.label === 'mev'), `a bot still holds ${id}`);
    }
    assert.deepEqual(conserve(m), []);
  }
  assert.equal(tries, 36);
  assert.ok(hits >= 6, `${hits} sandwiches`);
  // the same orders on a seed that gets sandwiched: never at ultra, never at 15%, never with bots off
  const none = (config, ord) => {
    const m = createMarket({ seed: NONE_SEED, startSol: 50, config });
    for (let k = 0; k < 6; k++) {
      const L = m.lists();
      const pick = L.new[k] || L.new[0];
      assert.ok(m.order({ coin: pick.id, side: 'buy', sol: 2, ...ord }).ok);
      m.advance(1.5);
    }
    m.advance(5);
    return m.orders(50).filter((o) => o.mev).length;
  };
  assert.ok(none({ mev: true }, { slippage: 0.6 }) >= 2, 'its own sandwiches');
  assert.equal(none({ mev: true }, { slippage: 0.6, priority: 'ultra' }), 0, 'ultra outruns them');
  assert.equal(none({ mev: true }, { slippage: 0.15 }), 0, 'no room at 15%');
  assert.equal(none({ mev: false }, { slippage: 0.9 }), 0, 'switched off');
});

test('a buy that completes the curve: the rest comes back, an order behind it fails, the coin migrates', () => {
  const m = createMarket({ seed: 'grad', startSol: 200 });
  const id = m.lists().new[0].id;
  const f1 = feeOf('ultra');
  const f2 = feeOf('fast');
  // more than its curve has left: only what's left is spent
  const q = m.quote({ coin: id, side: 'buy', sol: 150, slippage: 1, priority: 'ultra' });
  assert.equal(q.ok, true, JSON.stringify(q));
  assert.equal(q.full, true);
  assert.ok(q.spent < 150);
  near(q.refund, 150 - q.spent, 1e-9, 'its refund');
  const r1 = m.order({ coin: id, side: 'buy', sol: 150, slippage: 1, priority: 'ultra' });
  const r2 = m.order({ coin: id, side: 'buy', sol: 0.05, slippage: 1, priority: 'fast' });
  assert.ok(r1.ok && r2.ok);
  assert.ok(r1.order.landAt < r2.order.landAt, 'ultra lands first');
  near(m.player.sol, 200 - 150 - f1 - 0.05 - f2, 1e-9, 'both held');
  const before = m.counts.migrated;
  m.advance(1);
  const all = m.orders(10);
  const o1 = all.find((o) => o.id === r1.order.id);
  const o2 = all.find((o) => o.id === r2.order.id);
  assert.equal(o1.status, 'filled', JSON.stringify(o1));
  assert.ok(o1.spent > 80 && o1.spent < 150, `spent ${o1.spent}`);
  // the order behind it meets a coin on its way to its pool: it fails, its SOL back, its fee paid
  assert.equal(o2.status, 'failed');
  assert.equal(o2.reason, 'migrating');
  assert.equal(o2.doneAt, o2.landAt);
  assert.equal(m.debug.coin(id).mk.phase, 'migrating');
  near(m.player.sol, 200 - o1.spent - f1 - f2, 1e-9, 'the rest came back');
  assert.equal(m.player.fees.failed, f2);
  near(m.player.fees.priority, f1 + f2, 1e-12, 'both fees');
  assert.equal(m.player.held, 0);
  for (const p of [{ side: 'buy', sol: 1 }, { side: 'sell' }]) {
    assert.deepEqual(m.order({ coin: id, ...p }), { ok: false, error: 'migrating' });
    assert.deepEqual(m.quote({ coin: id, ...p }), { ok: false, error: 'migrating' });
  }
  // while it migrates: worth something (at its pool's opening price), at the top of the final stretch
  assert.ok(m.player.worth > m.player.sol);
  assert.ok(m.positions().find((p) => p.id === id).value > 0, "valued at its pool's opening price");
  const st = m.lists().stretch.find((r) => r.id === id);
  assert.ok(st && st.phase === 'migrating' && st.progress === 1);
  const fd = m.feed(0);
  assert.ok(fd.some((e) => e.kind === 'migrate' && e.c === id));
  assert.ok(!fd.some((e) => e.kind === 'whale_buy' && e.l === 'me'), 'the player is never a whale in the feed');
  assert.equal(typeof m.stats(id).gradAt, 'number');
  assert.equal(m.stats(id).migratedAt, null);
  // its pool opens
  m.advance(10);
  assert.equal(m.debug.coin(id).mk.phase, 'pool');
  assert.ok(m.counts.migrated >= before + 1);
  assert.ok(m.feed(0).some((e) => e.kind === 'migrated' && e.c === id));
  assert.ok(m.lists().migrated.some((r) => r.id === id));
  assert.equal(typeof m.stats(id).migratedAt, 'number');
  // and half of it sells there
  const half = m.order({ coin: id, side: 'sell', frac: 0.5, slippage: 1 });
  assert.equal(half.ok, true, JSON.stringify(half));
  m.advance(2);
  const h = m.orders(1)[0];
  assert.equal(h.status, 'filled', JSON.stringify(h));
  assert.equal(h.tok, Math.floor(o1.tok * 0.5));
  assert.equal(m.positions().find((p) => p.id === id).open, true);
  assert.deepEqual(conserve(m), []);
});

test('a sleeping coin wakes for an order and sleeps again, and its run plays again the same', () => {
  const m = createMarket({ seed: 'sleep' });
  const asleep = [];
  for (let id = 0; id < m.size.coins; id++) if (m.debug.coin(id).asleep) asleep.push(id);
  assert.ok(asleep.length > 10, `${asleep.length} asleep`);
  const id = asleep[0];
  const c = m.debug.coin(id);
  const awake0 = m.size.awake;
  const mc0 = m.stats(id).mc;
  const r = m.order({ coin: id, side: 'buy', sol: 0.2, slippage: 1 });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(c.asleep, false);
  assert.equal(m.size.awake, awake0 + 1);
  m.advance(3);
  assert.equal(m.orders(1)[0].status, 'filled');
  assert.ok(m.stats(id).mc > mc0, 'the buy moved its price');
  const s = m.order({ coin: id, side: 'sell', slippage: 1 });
  assert.equal(s.ok, true, JSON.stringify(s));
  m.advance(3);
  assert.equal(m.orders(1)[0].status, 'filled');
  assert.equal(c.asleep, true);
  assert.equal(snap(replay({ seed: 'sleep', log: m.log(), until: m.n })), snap(m));
});

test('coins follow their plans, with noise', () => {
  const m = createMarket({ seed: 'track' });
  const errs = [];
  for (let k = 0; k < 10; k++) {
    m.advance(30);
    for (let id = 0; id < m.size.coins; id++) {
      const c = m.debug.coin(id);
      if (c.mk.phase === 'migrating') continue;
      const age = m.t - c.born;
      if (age < 5 || age > c.plan.dieAt) continue;
      errs.push(Math.log(mOf(c.mk)) - Math.log(targetAt(c.plan.pts, age)));
    }
  }
  // how far its market cap is from its plan, in log space (measured: mean 0.058, mean |e| 0.146)
  const mean = errs.reduce((s, x) => s + x, 0) / errs.length;
  const mabs = errs.reduce((s, x) => s + Math.abs(x), 0) / errs.length;
  assert.ok(errs.length > 100, `${errs.length} looks`);
  assert.ok(Math.abs(mean) < 0.25, `mean ${mean}`);
  assert.ok(mabs < 0.35, `mean |e| ${mabs}`);
});

test('two hours in a row: an hour a call at most, its equity every second, old coins compacted, nothing NaN', () => {
  const m = createMarket({ seed: 'long' });
  assert.equal(m.advanceTo(1e9), MAX_STEPS);
  assert.equal(m.t, 3600);
  assert.equal(m.advance(99999), MAX_STEPS);
  assert.equal(m.t, 7200);
  const eq = m.equity();
  assert.equal(eq.length, 7201);
  assert.equal(eq[0].t, 0);
  assert.equal(eq[eq.length - 1].t, 7200);
  let compacted = 0;
  for (let id = 0; id < m.size.coins; id++) {
    finiteDeep(m.stats(id), `stats(${id})`);
    const c = m.debug.coin(id);
    if (!c.compacted) continue;
    compacted++;
    assert.equal(c.asleep, true);
    assert.ok(c.trades.length <= 20);
    const cd = m.candles(id);
    assert.ok(cd.every((x) => x.t % 60 === 0), `${id}: candles are minutes`);
    finiteDeep(cd, `candles(${id})`);
    finiteDeep(m.holders(id, 100), `holders(${id})`);
    finiteDeep(m.trades(id, 120), `trades(${id})`);
    finiteDeep(m.row(id), `row(${id})`);
  }
  assert.ok(compacted > 100, `${compacted} compacted`);
  finiteDeep(m.lists(), 'lists');
  assert.ok(m.feed(0).length <= KEEP.feed + 64);
  assert.deepEqual(conserve(m), []);
});

test('every read: equity, the feed, holders, find, info, the lists, trades, candles, comments, the tape, bad ids', () => {
  const m = createMarket({ seed: 'reads' });
  // the player's worth every second (nothing done: the SOL it started with)
  m.advance(10);
  const eq = m.equity();
  assert.equal(eq.length, 11);
  eq.forEach((e, i) => {
    assert.equal(e.t, i);
    assert.equal(e.v, 1);
  });
  assert.equal(m.equity(5).length, 6);
  assert.equal(m.equity('x').length, 11);
  assert.equal(m.equity(11).length, 0);
  m.advance(170);

  // the feed: its kinds, in order, each about a coin (or the meta)
  const KINDS = new Set(['launch', 'whale_buy', 'migrate', 'migrated', 'smart_buy', 'dev_sell', 'kol_sell', 'smart_sell',
    'kol_buy', 'rug', 'dex_paid', 'cto', 'meta', 'koth']);
  const all = m.feed(0);
  assert.ok(all.length > 50, `${all.length} items`);
  let latest = -Infinity;
  all.forEach((e, i) => {
    if (i > 0) assert.ok(e.q > all[i - 1].q, 'its numbers only grow');
    assert.ok(KINDS.has(e.kind), e.kind);
    assert.ok(e.t <= m.t + 1e-9, `${e.kind} at ${e.t}`);
    assert.ok(e.t >= latest - DT - 1e-9, `${e.kind} at ${e.t} after ${latest}`);
    latest = Math.max(latest, e.t);
    if (e.kind === 'meta') {
      assert.equal(e.c, null);
      assert.equal(e.ticker, null);
      assert.ok(METAS.includes(e.theme), e.theme);
    } else assert.equal(e.ticker, m.info(e.c).ticker);
  });
  assert.ok(all.some((e) => e.kind === 'launch'));
  assert.equal(m.feedSeq, all[all.length - 1].q);
  assert.deepEqual(m.feed(m.feedSeq), []);
  const mid = all[Math.floor(all.length / 2)].q;
  assert.deepEqual(m.feed(mid), all.filter((e) => e.q > mid));
  assert.deepEqual(m.feed('x'), all);

  // holders: ranked, every token somewhere, the smart wallets' and the dev's addresses
  const SMARTS = new Set(Array.from({ length: SMART_COUNT }, (_, k) => smartAddress(k)));
  let devs = 0;
  for (let id = 0; id < m.size.coins; id += 5) {
    const c = m.debug.coin(id);
    const h = m.holders(id, 100);
    assert.equal(h.count, c.hlist.length);
    assert.equal(h.pool.kind, c.mk.phase);
    assert.equal(h.list.length, Math.min(100, h.count));
    let sum = 0;
    h.list.forEach((x, i) => {
      assert.equal(x.rank, i + 1);
      if (i > 0) assert.ok(x.tok <= h.list[i - 1].tok, `${id}: ranked`);
      assert.equal(x.pct, x.tok / SUPPLY);
      assert.ok(isAddr(x.addr), x.addr);
      assert.equal(x.me, false);
      if (x.label === 'smart' && !x.kol) assert.ok(SMARTS.has(x.addr), `${id}: ${x.addr}`);
      sum += x.tok;
    });
    if (h.count <= 100) assert.equal(sum + h.pool.tok, SUPPLY, `${id}: every token`);
    const dev = h.list.filter((x) => x.label === 'dev');
    if (dev.length === 1 && c.holders.has('dev')) {
      assert.equal(dev[0].addr, m.info(id).devAddr);
      devs++;
    }
    assert.equal(m.holders(id, 0).list.length, Math.min(20, h.count));
    assert.equal(m.holders(id).list.length, Math.min(20, h.count));
    assert.equal(m.holders(id, 500).list.length, Math.min(100, h.count));
  }
  assert.ok(devs > 0, 'a dev wallet');

  // find: by ticker ($ or not, any case), by mint, by a part of a name
  const pick = m.info(m.lists().new[0].id);
  const byTicker = m.find(`$${pick.ticker.toLowerCase()}`);
  assert.ok(byTicker.includes(pick.id));
  assert.ok(byTicker.length <= 20);
  byTicker.forEach((id, i) => {
    assert.equal(m.info(id).ticker, pick.ticker);
    if (i > 0) assert.ok(id < byTicker[i - 1], 'newest first');
  });
  assert.deepEqual(m.find(pick.mint), [pick.id]);
  assert.deepEqual(m.find(addressFrom(424242)), []);
  let spaced = null;
  for (let id = m.size.coins - 1; id >= 0 && !spaced; id--) {
    const x = m.info(id);
    if (x.name.includes(' ')) spaced = x;
  }
  assert.ok(spaced, 'a name with a space');
  assert.ok(m.find(spaced.name.toLowerCase()).includes(spaced.id), spaced.name);
  for (const q of ['', '   ', 42, null]) assert.deepEqual(m.find(q), [], `find(${q})`);
  assert.ok(m.find('a').length <= 20);

  // info
  for (let id = 0; id < m.size.coins; id += 7) {
    const x = m.info(id);
    assert.equal(x.id, id);
    assert.ok(isAddr(x.mint) && x.mint.endsWith('pump'), x.mint);
    assert.ok(isAddr(x.devAddr), x.devAddr);
    assert.ok(x.born <= m.t);
    assert.deepEqual(m.find(x.mint), [id]);
  }

  // the lists: kept for the step, each in its order, each row a coin's row
  const L1 = m.lists();
  assert.equal(m.lists(), L1, 'the same lists for the same step');
  for (const k of LISTS) assert.ok(L1[k].length <= 30, k);
  L1.new.forEach((r, i) => {
    assert.equal(r.phase, 'curve');
    assert.ok(r.progress < 0.5);
    if (i > 0) assert.ok(r.id < L1.new[i - 1].id, 'new: newest first');
  });
  L1.stretch.forEach((r, i) => {
    assert.ok(r.phase === 'migrating' || r.progress >= 0.5);
    const p = L1.stretch[i - 1];
    if (p) assert.ok(r.progress < p.progress || (r.progress === p.progress && r.id < p.id), 'stretch: furthest first');
  });
  L1.migrated.forEach((r, i) => {
    assert.equal(r.phase, 'pool');
    const p = L1.migrated[i - 1];
    if (p) assert.ok(r.migratedAt < p.migratedAt || (r.migratedAt === p.migratedAt && r.id < p.id), 'migrated: newest first');
  });
  L1.trending.forEach((r, i) => {
    assert.ok(r.lastTrade >= m.t - 300);
    const p = L1.trending[i - 1];
    if (p) assert.ok(r.vol5m < p.vol5m || (r.vol5m === p.vol5m && r.id < p.id), 'trending: busiest first');
  });
  // bump order: the live coins (a trade in the last five minutes) by their last trade, newest first, as many as trending
  const live = [];
  for (let id = 0; id < m.size.coins; id++) {
    const r = m.row(id);
    if (r.lastTrade !== null && r.lastTrade >= m.t - 300) live.push(r);
  }
  live.sort((a, b) => b.lastTrade - a.lastTrade || b.id - a.id);
  assert.ok(live.length > 1, 'bump: some live coins');
  assert.equal(L1.trending.length, Math.min(30, live.length));
  assert.deepEqual(L1.bump.map((r) => r.id), live.slice(0, 30).map((r) => r.id), 'bump: the newest trades first');
  assert.ok(L1.koth === null || L1.koth.koth === true);
  for (const k of LISTS) for (const r of L1[k]) assert.deepEqual(m.row(r.id), r);
  assert.ok(m.lists({ limit: 5 }).new.length <= 5);
  const a0 = m.lists({ limit: 0 });
  assert.equal(m.lists(), a0);
  const big = m.lists({ limit: 500 });
  for (const k of LISTS) assert.ok(big[k].length <= 100, k);
  const lx = m.lists({ limit: 'x' });
  for (const k of LISTS) assert.ok(lx[k].length <= 30, k);
  assert.equal(m.lists(null), m.lists());
  const L2 = m.lists();
  m.step();
  assert.notEqual(m.lists(), L2, 'new lists for a new step');

  // trades, candles and comments
  for (let id = 0; id < m.size.coins; id += 3) {
    const tr = m.trades(id, 200);
    assert.ok(tr.length <= KEEP.trades);
    tr.forEach((x, i) => {
      if (i > 0) assert.ok(x.t <= tr[i - 1].t, `${id}: newest first`);
      assert.ok(x.side === 'buy' || x.side === 'sell');
      assert.ok(isAddr(x.addr), x.addr);
      assert.equal(x.me, false);
    });
    assert.ok(m.trades(id, 0).length <= 50);
    const cd = m.candles(id);
    cd.forEach((x, i) => {
      if (i > 0) assert.ok(x.t > cd[i - 1].t, `${id}: candles in order`);
      assert.ok(x.l <= Math.min(x.o, x.c) && x.h >= Math.max(x.o, x.c), `${id}: its candle at ${x.t}`);
    });
    if (cd.length > 2) {
      const since = cd[Math.floor(cd.length / 2)].t;
      assert.deepEqual(m.candles(id, since), cd.filter((x) => x.t >= since));
    }
    assert.ok(m.comments(id).length <= KEEP.chat);
  }

  // the tape
  const tp = m.tape(1000);
  assert.ok(tp.length > 0 && tp.length <= KEEP.tape);
  for (const x of tp) assert.equal(x.ticker, m.info(x.coin).ticker);
  assert.ok(m.tape(0).length <= 50);

  // nothing of the player's
  assert.deepEqual(m.positions(), []);
  assert.deepEqual(m.orders(), []);
  assert.deepEqual(m.log(), []);

  // a coin that isn't one: nothing, never an error
  for (const bad of [99999, -1, 'x', null, undefined, 1.5, '3x', {}]) {
    for (const f of ['stats', 'row', 'info', 'holders', 'trades', 'candles', 'comments']) {
      assert.equal(m[f](bad), null, `${f}(${String(bad)})`);
    }
    assert.equal(m.debug.coin(bad), null);
  }
});
