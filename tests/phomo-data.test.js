import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarket } from '../src/games/trenchingsimulator/engine.js';
import { PHOMO_LIMITS, BLUE_CHIP_FILTER, coinKey, historyWindow, tokenMetrics, marketTokenRows, selectTokens,
  traderProfiles, selectTraders, socialFeed, copyOrderFor, clearPhomoCache, createPhomoCandleWindow } from '../src/games/trenchingsimulator/boards/phomo-data.js';
import { PHOMO_SAVE_KEY, PHOMO_BOUNDS, blankPhomoPrefs, cleanPhomoPrefs,
  createPhomoState } from '../src/games/trenchingsimulator/boards/phomo-state.js';

function fixture(count = 3) {
  const rows = Array.from({ length: count }, (_, id) => ({ id, name: `Coin ${id}`, ticker: `COIN${id}`, born: 0,
    age: 100000, phase: id % 2 ? 'curve' : 'pool', mc: 10000 + id * 1000, holders: 100 - id,
    progress: id % 2 ? 0.4 : 1, theme: 'ai', emoji: '🪙', socials: {} }));
  const events = [];
  const orders = [];
  const positions = [];
  const stats = rows.map((r) => ({ ...r, price: r.mc / 1e9, liq: 1000, vol5m: 30 + r.id, vol1h: 100 + r.id,
    vol: 10000, change5m: 0.1, change1h: -0.2, txns: 50, kols: [], estimated: false }));
  const histories = rows.map(() => [{ t: 0, o: 1, h: 1, l: 1, c: 1, v: 2 },
    { t: 90000, o: 1, h: 1.5, l: 1, c: 1.5, v: 3 }, { t: 100000, o: 1.5, h: 2, l: 1.5, c: 2, v: 4 }]);
  let statCalls = 0;
  let candleCalls = 0;
  const market = {
    seed: 'phomo-fixture', solUsd: 100, t: 100000, n: 1, startSol: 100,
    get size() { return { coins: rows.length }; },
    get feedSeq() { return events.at(-1)?.q || 0; },
    player: { sol: 80, worth: 110, address: 'player-address' },
    row: (id) => rows[id] || null,
    stats: (id) => { statCalls++; return stats[id] || null; },
    candles: (id) => { candleCalls++; return histories[id] || []; },
    info: (id) => rows[id] ? { ...rows[id], mint: `mint${id}`, chain: rows[id].live ? 'robinhood' : null } : null,
    find: (q) => rows.filter((r) => `mint${r.id}` === q).map((r) => r.id),
    feed: (since = 0) => events.filter((e) => e.q > since),
    orders: () => orders.map((o) => ({ ...o })), positions: () => positions.map((p) => ({ ...p })),
    isExt: (id) => rows[id]?.live === true,
    smartWallets: () => [{ n: 0, addr: 'smart-address', d7: { pnl: 30, trades: 10, won: 6, lost: 4, vol: 100, dist: [1, 2, 3, 4, 0] },
      buys: 2, sells: 1, in: 20, out: 25, won: 1, lost: 0, pnl: 5, upnl: 2, value: 10,
      open: [{ coin: 0, tok: 100, in: 8, out: 0, value: 10 }], last: 99999 }],
  };
  return { market, rows, stats, events, orders, positions, histories, calls: () => ({ statCalls, candleCalls }) };
}
function memory() {
  const values = new Map();
  return { getItem: (k) => values.get(k) || null, setItem: (k, v) => values.set(k, v) };
}

test('Phomo token models use dollars, separate price units, and leave unavailable history and real depth unknown', () => {
  const f = fixture();
  const m = tokenMetrics(f.market, 0, { window: '5m' });
  assert.equal(m.priceUsd, 0.001);
  assert.equal(m.marketCapUsd, 1_000_000);
  assert.equal(m.volumeUsd, 3000);
  assert.equal(m.change, 0.1);
  assert.equal(m.key, 'sim:mint0');
  assert.equal(m.practicePrice, false);
  assert.equal(tokenMetrics(f.market, 0, { window: '1h' }).change, -0.2);
  assert.equal(tokenMetrics(f.market, 0, { window: '4h' }).change, 1);
  assert.equal(tokenMetrics(f.market, 0, { window: '24h' }).volumeUsd, 700);
  f.rows[2].live = true;
  f.rows[2].chain = 'robinhood';
  Object.assign(f.stats[2], { live: true, estimated: true, holders: null, change5m: null, change1h: null });
  f.histories[2] = [{ t: 100000, o: 200, h: 200, l: 200, c: 200, v: 0 }];
  clearPhomoCache(f.market);
  const live = tokenMetrics(f.market, 2, { window: '24h' });
  assert.equal(live.practicePrice, true);
  assert.equal(live.liquidityUsd, null);
  assert.equal(live.holders, null);
  assert.equal(live.change, null);
  assert.equal(live.volumeUsd, null, 'an observed total is not relabeled as 24h volume');
  assert.equal(coinKey(f.market, 2), 'robinhood:mint2');
  assert.deepEqual(historyWindow([], 100, 60), { change: null, volume: null });
  assert.equal(historyWindow([{ t: 100, c: 20, v: 5 }], 100, 60).change, null);
});

test('Phomo categories, numeric filters, search, watch/hide and sorting produce correct totals and bounded result counts', () => {
  const rows = Array.from({ length: 120 }, (_, id) => ({ id, key: `sim:${id}`, name: `Token ${id}`, ticker: `T${id}`,
    phase: id % 2 ? 'curve' : 'pool', marketCapUsd: BLUE_CHIP_FILTER.marketCapUsd + id,
    liquidityUsd: BLUE_CHIP_FILTER.liquidityUsd, volumeUsd: id, change: id / 100, holders: id === 0 ? null : id, age: id }));
  for (const limit of PHOMO_LIMITS) {
    const found = selectTokens(rows, { limit });
    assert.equal(found.total, 120);
    assert.equal(found.rows.length, limit);
    assert.equal(found.rows[0].id, 119);
  }
  assert.equal(selectTokens(rows, { category: 'graduated' }).total, 60);
  assert.equal(selectTokens(rows, { category: 'bonding' }).total, 60);
  assert.equal(selectTokens(rows, { category: 'bluechips' }).total, 120);
  assert.equal(selectTokens(rows, { category: 'mostheld' }).total, 119);
  assert.deepEqual(selectTokens(rows, { category: 'watchlist', watchlist: ['sim:2', 'sim:3'], hidden: ['sim:3'] }).rows.map((r) => r.id), [2]);
  const filtered = selectTokens(rows, { filters: { minVolume: 50, maxAge: 70 }, sort: 'age', direction: 'asc' });
  assert.equal(filtered.total, 21);
  assert.equal(filtered.rows[0].id, 50);
  assert.equal(selectTokens(rows, { query: '$T119' }).rows[0].id, 119);
  const unknown = [{ ...rows[0], volumeUsd: null }, { ...rows[1], volumeUsd: 0 }];
  assert.equal(selectTokens(unknown, { direction: 'asc' }).rows[0].id, 1, 'unknown metrics sort last');
});

test('Phomo network and source filters use actual coin metadata and persist independently per panel', () => {
  const f = fixture();
  Object.assign(f.rows[1], { live: true, chain: 'robinhood', src: 'clank.trade' });
  Object.assign(f.rows[2], { live: true, chain: 'base', src: 'dex' });
  const rows = marketTokenRows(f.market);
  assert.deepEqual(selectTokens(rows, { network: 'robinhood' }).rows.map((r) => r.id), [1]);
  assert.deepEqual(selectTokens(rows, { network: 'simulated' }).rows.map((r) => r.id), [0]);
  assert.deepEqual(selectTokens(rows, { launchpad: 'CLANK.TRADE' }).rows.map((r) => r.id), [1]);
  assert.equal(selectTokens(rows, { network: 'base', launchpad: 'clank.trade' }).total, 0);
  assert.equal(selectTokens(rows, { network: 'all', launchpad: 'all' }).total, 3);
  const storage = memory();
  const state = createPhomoState(f.market, { storage });
  state.setPrefs({ network: 'robinhood', launchpad: 'clank.trade',
    ui: { panels: [{ kind: 'tokens', network: 'robinhood', launchpad: 'clank.trade' }, { kind: 'tokens', network: 'base', launchpad: 'dex' }] } });
  const restored = createPhomoState(f.market, { storage });
  assert.deepEqual(restored.tokens().rows.map((r) => r.id), [1]);
  assert.equal(restored.prefs.ui.panels[1].network, 'base');
  assert.equal(restored.prefs.ui.panels[1].launchpad, 'dex');
  restored.setPrefs({ network: 'not-a-chain', launchpad: 'x'.repeat(500) });
  assert.equal(restored.prefs.network, 'all');
  assert.equal(restored.prefs.launchpad.length, 80);
  const originalInfo = f.market.info;
  f.market.info = (id) => id === 1 ? { ...originalInfo(id), chain: 'robinhood', src: 'clank.trade' } : originalInfo(id);
  delete f.rows[1].chain; delete f.rows[1].src; clearPhomoCache(f.market);
  assert.equal(tokenMetrics(f.market, 1).chain, 'robinhood');
  assert.equal(tokenMetrics(f.market, 1).src, 'clank.trade');
});

test('Phomo metrics cache is shared across panels and windows, with bounded candidates plus watched older IDs', () => {
  const f = fixture();
  const oldNow = Date.now;
  Date.now = () => 123000;
  try {
    for (const window of ['5m', '1h', '4h', '24h']) marketTokenRows(f.market, { window });
    assert.equal(f.calls().statCalls, 3);
    assert.equal(f.calls().candleCalls, 3, 'both long-window summaries share one candle read');
    f.market.n++;
    marketTokenRows(f.market, { window: '1h' });
    assert.equal(f.calls().statCalls, 6);
  } finally { Date.now = oldNow; }
  const many = fixture(2010);
  assert.equal(marketTokenRows(many.market).length, 2000);
  assert.equal(marketTokenRows(many.market, { includeIds: [0] }).length, 2001);
  many.market.ext = { shown: { sim: false, ext: true } };
  assert.equal(marketTokenRows(many.market).length, 0, 'paused simulation coins stay out of a live-only board');
});

test('Phomo trader profiles and social activity are explicitly simulated and never assign NPC trades to a live coin', () => {
  const f = fixture();
  f.events.push({ q: 1, t: 100, kind: 'smart_buy', c: 0, smart: 0, sol: 2 },
    { q: 2, t: 101, kind: 'kol_buy', c: 1, kol: 'trenchwitch', sol: 3 },
    { q: 3, t: 102, kind: 'smart_buy', c: 2, smart: 0, sol: 4 });
  f.rows[2].live = true;
  const feed = socialFeed(f.market);
  assert.equal(feed.length, 2);
  assert.ok(feed.every((e) => e.simulated && e.coin !== 2));
  assert.equal(feed.find((e) => e.coin === 0).traderKey, 'smart:0');
  assert.equal(feed.find((e) => e.coin === 1).traderKey, 'kol:trenchwitch');
  const profiles = traderProfiles(f.market);
  assert.ok(profiles.length > 1 && profiles.every((p) => p.simulated));
  assert.equal(profiles.find((p) => p.key === 'smart:0').weekPnlUsd, 3000);
  assert.equal(profiles.find((p) => p.key === 'kol:trenchwitch').pnlUsd, null);
  assert.deepEqual(selectTraders(profiles, { following: true, followed: ['smart:0'] }).map((p) => p.key), ['smart:0']);
  assert.equal(selectTraders(profiles, { query: 'trenchwitch', muted: ['kol:trenchwitch'] }).length, 0);
});

test('Phomo preferences and local interaction books validate and cap stored input without touching the game save', () => {
  const raw = blankPhomoPrefs();
  assert.equal(raw.ui.panels.length, 1, 'the workspace opens with one main discovery table');
  const specialPanels = cleanPhomoPrefs({ ...raw, ui: { panels: [{ kind: 'perps' }, { kind: 'watchlist' }] } });
  assert.deepEqual(specialPanels.ui.panels.map((p) => p.kind), ['perps', 'watchlist']);
  raw.watchlist = Array.from({ length: 1000 }, (_, i) => `sim:${i}`);
  raw.limit = 999999;
  raw.window = 'never';
  raw.buyPresets = [-1, 0, 1, Infinity];
  raw.ui = { panels: Array.from({ length: 8 }, () => ({ kind: 'tokens', category: 'watchlist', limit: 100 })), layout: 'rows', quickBuy: 25, rail: false };
  const clean = cleanPhomoPrefs(raw);
  assert.equal(clean.watchlist.length, PHOMO_BOUNDS.watchlist);
  assert.equal(clean.ui.panels.length, 4);
  assert.equal(clean.limit, 25);
  assert.equal(clean.window, '1h');
  assert.deepEqual(clean.buyPresets, [10, 100, 500, 1000]);
  const storage = memory();
  storage.setItem('trench_v1', 'untouched');
  const f = fixture();
  const s = createPhomoState(f.market, { storage, now: () => 12345 });
  s.setPrefs({ ui: { layout: 'rows', quickBuy: 100 }, buyPresets: [5, 25, 50, 100], sellPresets: [10, 20, 30, 100], slippageMode: 'custom', slippage: 0.1 });
  s.toggleWatch(0); s.toggleHide(1); s.toggleFollow('smart:0');
  const note = s.addNote({ text: 'A local note', coin: 0 });
  assert.equal(note.ok, true);
  const restored = createPhomoState(f.market, { storage, now: () => 12345 });
  assert.equal(restored.isWatched(0), true);
  assert.equal(restored.isHidden(1), true);
  assert.equal(restored.isFollowing('smart:0'), true);
  assert.equal(restored.prefs.ui.layout, 'rows');
  assert.deepEqual(restored.prefs.buyPresets, [5, 25, 50, 100]);
  assert.notEqual(restored.addNote({ text: 'Another', coin: 0 }).note.id, note.note.id, 'restored clocks cannot collide with local IDs');
  assert.equal(storage.getItem('trench_v1'), 'untouched');
  assert.ok(storage.getItem(PHOMO_SAVE_KEY));
  const broken = createPhomoState(f.market, { storage: { getItem() { throw Error(); }, setItem() { throw Error(); } } });
  assert.equal(broken.toggleWatch(0), true);
});

test('Phomo connects its dollar trades, own activity, holdings and local notes to the real game engine', () => {
  const market = createMarket({ seed: 12345, solUsd: 100, startSol: 100 });
  const storage = memory();
  const state = createPhomoState(market, { storage, order: market.order, playerName: () => 'Paper player' });
  const coin = market.lists({ limit: 1 }).new[0].id;
  state.setPrefs({ slippageMode: 'custom', slippage: 0.99 });
  assert.equal(state.copyTrade({ coin, side: 'buy' }, 25).ok, true);
  assert.equal(market.orders(1)[0].sol, 0.25);
  market.advance(5);
  assert.equal(market.orders(1)[0].status, 'filled');
  const own = state.profile('you');
  assert.equal(own.name, 'Paper player');
  assert.equal(own.volumeUsd, 25);
  assert.equal(own.holdings[0].coin, coin);
  assert.equal(own.pnlUsd, (market.netWorth() - 100) * 100);
  assert.equal(own.unrealizedUsd, market.positions()[0].pnl * 100);
  const event = state.feed({ traderKey: 'you' }).find((e) => e.kind === 'trade');
  assert.equal(event.amountUsd, 25);
  assert.equal(event.coin, coin);
  assert.equal(event.paper, true);
  assert.equal(state.traderForAddress(market.player.address), 'you');
  state.addNote({ text: 'My observed thesis', coin });
  const restored = createPhomoState(market, { storage });
  assert.equal(restored.notes({ coin })[0].text, 'My observed thesis');
  assert.equal(restored.feed({ traderKey: 'you' }).some((e) => e.kind === 'note'), true, 'numeric input seed persists as the engine string seed');
  const f = fixture();
  f.market.seed = 17;
  const numeric = createPhomoState(f.market, { storage: memory() });
  numeric.addNote({ text: 'Numeric seed adapter' });
  assert.equal(numeric.feed().find((e) => e.kind === 'note').text, 'Numeric seed adapter');
});

test('Phomo watches, hidden rows, notes, likes, following and muted feeds perform their actions locally', () => {
  const f = fixture();
  f.events.push({ q: 1, t: 100, kind: 'smart_buy', c: 0, smart: 0, sol: 2 });
  const s = createPhomoState(f.market, { playerName: 'Player' });
  s.toggleWatch(0);
  assert.equal(s.tokens({ category: 'watchlist' }).rows[0].id, 0);
  s.toggleHide(0);
  assert.equal(s.tokens({ category: 'watchlist' }).total, 0);
  s.restoreHidden();
  const event = s.feed()[0];
  s.toggleLike(event.key);
  s.addNote({ text: 'Watching this one', coin: 0, parentKey: event.key });
  assert.equal(s.feed().find((e) => e.key === event.key).likes, 1);
  assert.equal(s.feed().find((e) => e.key === event.key).notes, 1);
  assert.equal(s.notes({ coin: 0 }).length, 1);
  assert.equal(s.feed({ following: true }).filter((e) => e.source === 'simulated').length, 0);
  s.toggleFollow('smart:0');
  assert.equal(s.feed({ following: true }).filter((e) => e.source === 'simulated').length, 1);
  s.toggleMute('smart:0');
  assert.equal(s.feed().filter((e) => e.source === 'simulated').length, 0);
  assert.equal(s.profile('you').name, 'Player');
  assert.equal(s.traderForAddress('smart-address'), 'smart:0');
  assert.equal(s.traderForAddress('unknown-address'), null);
  s.removeNote(s.notes()[0].id);
  assert.equal(s.notes().length, 0);
});

test('Phomo price and followed-trader alerts fire once, keep bounded records, and never place an order', () => {
  const f = fixture();
  let orders = 0;
  const s = createPhomoState(f.market, { now: () => 100, order: () => { orders++; return { ok: true }; } });
  s.toggleFollow('smart:0');
  const added = s.addAlert({ coin: 0, metric: 'marketCap', direction: 'above', valueUsd: 999999 });
  assert.equal(added.ok, true);
  f.events.push({ q: 1, t: 100001, kind: 'smart_buy', c: 0, smart: 0, sol: 1 });
  s.tick(); s.tick();
  assert.equal(s.notifications().length, 2);
  assert.equal(s.alerts()[0].active, false);
  assert.equal(orders, 0);
  s.markRead();
  assert.equal(s.notifications({ unreadOnly: true }).length, 0);
  s.toggleMute('smart:0');
  f.events.push({ q: 2, t: 100002, kind: 'smart_sell', c: 0, smart: 0, sol: 1 });
  s.tick();
  assert.equal(s.notifications().length, 2);
  s.removeAlert(added.alert.id);
  assert.equal(s.alerts().length, 0);
  for (let i = 0; i < PHOMO_BOUNDS.alerts; i++) assert.equal(s.addAlert({ coin: 0, valueUsd: 99 }).ok, true);
  assert.equal(s.addAlert({ coin: 0, valueUsd: 99 }).error, 'full');
  s.destroy();
  f.events.push({ q: 3, t: 100003, kind: 'smart_buy', c: 0, smart: 0, sol: 1 });
  s.tick();
  assert.equal(s.notifications().length, 2);
});

test('Phomo one-tap copy converts the chosen dollars and uses the player holding for sells, with no auto-copy', () => {
  const f = fixture();
  const sent = [];
  const s = createPhomoState(f.market, { order: (request) => { sent.push(request); return { ok: true, order: { id: sent.length } }; } });
  s.setPrefs({ slippageMode: 'custom', slippage: 0.1 });
  assert.equal(s.copyTrade({ coin: 0, side: 'buy' }, 25).ok, true);
  assert.deepEqual(sent[0], { coin: 0, side: 'buy', sol: 0.25, slippage: 0.1 });
  assert.equal(s.copyTrade({ coin: 0, side: 'sell', frac: 0.25 }, 25).error, 'no_tokens');
  f.positions.push({ id: 0, tokens: 1000, open: true });
  assert.equal(s.copyTrade({ coin: 0, side: 'sell', frac: 0.25 }, 25).ok, true);
  assert.deepEqual(sent[1], { coin: 0, side: 'sell', frac: 0.25, slippage: 0.1 });
  assert.equal(copyOrderFor({ coin: 0, side: 'buy' }, -100, 100, f.market).error, 'bad');
  assert.equal(copyOrderFor({ coin: 999, side: 'buy' }, 25, 100, f.market).error, 'no_coin');
  s.destroy();
  assert.equal(s.copyTrade({ coin: 0, side: 'buy' }, 25).error, 'unavailable');
  assert.equal(sent.length, 2);
});

test('Phomo position windows preserve streaming identity and accept corrected or retained history', () => {
  const pick=createPhomoCandleWindow(); let rows=Array.from({length:700},(_,t)=>({t,c:t+1}));
  assert.equal(pick(rows,Infinity,699),rows);
  const selected=pick(rows,300,699); assert.deepEqual(selected,rows.filter(r=>r.t>=399));
  rows[699]={t:699,c:900}; rows.push({t:700,c:800});
  assert.equal(pick(rows,300,700),selected); assert.deepEqual(selected,rows.filter(r=>r.t>=400));
  rows.splice(0,600); assert.equal(pick(rows,300,700),selected); assert.deepEqual(selected,rows,'retention does not leave a disconnected historical prefix');
  const correction=rows.map(r=>({...r,c:r.c+10})); const corrected=pick(correction,300,700);
  assert.notEqual(corrected,selected); assert.deepEqual(corrected,correction,'an older closed candle correction is not lost');
  const rewind=[{t:1,c:4},{t:2,c:5}]; assert.deepEqual(pick(rewind,300,2),rewind);
  assert.deepEqual(pick(rewind,300,999),[]); rewind.push({t:1000,c:6}); assert.deepEqual(pick(rewind,300,1000),[{t:1000,c:6}]);
});
