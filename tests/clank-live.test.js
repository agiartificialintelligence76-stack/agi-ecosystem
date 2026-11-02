import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeClankCoin, normalizeClankCandles, normalizeClankChart, normalizeClankTrades, normalizeClankStats, normalizeClankRecentTrades, createClankService, createClankImageService, clankTerminalResponse, clankTerminalImage } from '../server/clank-live.js';
import { createClankFeed, createClankMarket } from '../src/games/trenchingsimulator/clank-live.js';
import { clankFeed } from '../src/games/trenchingsimulator/boards/clank-data.js';

const ETH = `0x${'0'.repeat(40)}`, A = `0x${'a'.repeat(40)}`, B = `0x${'b'.repeat(40)}`, STOCK = `0x${'c'.repeat(40)}`;
const NOW = 1793615000000;
const raw = (key = A, extra = {}) => ({ id: `market:4663:${key}`, address: key, name: 'Original Clank Coin', symbol: 'CLNK', image: `ipfs://b${'a'.repeat(58)}`,
  createdAt: '1793600000', quoteCurrency: STOCK, quoteSymbol: 'NVDA', marketCap: 20, holderCount: 7, progress: 8.2, state: 0, totalSupply: '1000000000000000000000000000', ...extra });
const coin = (key = A, extra = {}) => normalizeClankCoin(raw(key, extra), new Map([[STOCK, 200]]));
const wire = (coins = [coin()]) => ({ v: 1, source: 'clank.trade', chain: 'robinhood', at: NOW, coins, listed: coins.map((c) => c.address), trending: coins.map((c) => c.address), nextCursor: null, px: { eth: 2200 } });
const candle = (extra = {}) => ({ marketId: `market:4663:${A}`, interval: '1m', bucketStart: '1793614200', openX18: '20000000000', highX18: '22000000000', lowX18: '19000000000', closeX18: '21000000000', quoteVolumeRaw: '500000000000000000', ...extra });
const flush = async () => { for (let i = 0; i < 3; i++) await new Promise((resolve) => setImmediate(resolve)); };

test('Clank normalizes actual Robinhood quote pairs and requires their actual USD rate', () => {
  const c = coin();
  assert.equal(c.quoteAsset, 'NVDA'); assert.equal(c.marketCapUsd, 4000); assert.equal(c.holderCount, 7); assert.equal(c.totalSupply, 1e9);
  assert.ok(Math.abs(c.progress - .082) < 1e-12); assert.equal(c.image, true);
  assert.equal(normalizeClankCoin(raw(), new Map([[ETH, 2200]])), null, 'stock coins cannot be priced using ETH');
  assert.equal(normalizeClankCoin(raw(A, { id: `market:8453:${A}` }), new Map([[STOCK, 200]])), null);
  assert.equal(normalizeClankCoin(raw(A, { quoteCurrency: 'bad' }), new Map([[ETH, 2200]])), null);
  assert.equal(normalizeClankCoin(raw(A, { marketCapUsdg: 4321 }), new Map()).marketCapUsd, 4321);
});

test('Clank social links retain actual HTTPS destinations and discard executable URLs and misleading X links', () => {
  const c = coin(A, { twitter: 'https://x.com/actual_coin', website: 'https://example.com/project?x=1' });
  assert.equal(c.twitter, 'https://x.com/actual_coin'); assert.equal(c.website, 'https://example.com/project?x=1');
  for (const value of ['javascript:void(0)', 'data:text/html,hello', 'https://user:password@example.com/', 'http://example.com/']) {
    assert.equal(coin(A, { website: value }).website, null);
  }
  assert.equal(coin(A, { twitter: 'https://not-x.example/' }).twitter, null);
});

test('Clank global trade ticker preserves actual source order and quote units, excluding other chains', () => {
  const r = { id: '4663:actual-trade', address: A, symbol: 'CLNK', name: 'Coin', side: 'sell', quoteAmount: '1500000', quoteDecimals: 6, quoteSymbol: 'SPCX' };
  const result = normalizeClankRecentTrades([r, r, { ...r, id: '8453:other-chain' }, { ...r, id: '4663:bad', quoteDecimals: 99 }]);
  assert.equal(result.length, 1); assert.equal(result[0].quote, 1.5); assert.equal(result[0].quoteAsset, 'SPCX'); assert.equal(result[0].side, 'sell');
  assert.equal(result[0].t, undefined, 'the upstream ticker provides no timestamps');
});

test('Clank candles preserve official timestamps and OHLC values without inventing bars', () => {
  const payload = { marketId: `market:4663:${A}`, interval: '1m', candles: [candle(), candle({ bucketStart: '1793614380', closeX18: '22000000000' }), candle({ lowX18: '99999999999' })] };
  const bars = normalizeClankCandles(payload, coin(), '1m');
  assert.equal(bars.length, 2); assert.equal(bars[0].t, 1793614200); assert.equal(bars[1].t - bars[0].t, 180);
  assert.deepEqual(bars[0], { t: 1793614200, o: 4000, h: 4400, l: 3800, c: 4200, v: 100 });
  assert.deepEqual(normalizeClankCandles(payload, coin(), '5m'), []);
  assert.deepEqual(normalizeClankCandles(payload, { ...coin(), quoteUsd: null }, '1m'), []);
});

test('Clank chart exposes only the validated source index clock in seconds, never a wall-clock substitute', () => {
  const rawChart = { marketId: `market:4663:${A}`, interval: '1m', candles: [candle()], indexedThroughTimestamp: '1793614900' };
  const chart = normalizeClankChart(rawChart, coin(), '1m', NOW);
  assert.equal(chart.chartThrough, 1793614900); assert.equal(chart.candles.length, 1);
  for (const invalid of [undefined, null, 'not-a-clock', '1793614900000', '1793614000', 1793616000, 1793614900.5]) {
    assert.equal(normalizeClankChart({ ...rawChart, indexedThroughTimestamp: invalid }, coin(), '1m', NOW).chartThrough, null);
  }
  assert.deepEqual(normalizeClankChart(rawChart, coin(B), '1m', NOW), { candles: [], chartThrough: null });
  assert.deepEqual(normalizeClankChart(rawChart, coin(), '5m', NOW), { candles: [], chartThrough: null });
});

test('Clank trades retain actual trader, timestamp and amounts; duplicate and malformed rows are rejected', () => {
  const t = { id: 'actual-trade', trader: B, side: 'buy', timestamp: '1793614300', baseAmount: '10000000000000000000', quoteAmount: '500000000000000000', transactionHash: `0x${'1'.repeat(64)}` };
  const result = normalizeClankTrades({ trades: [t, t, { ...t, id: 'invalid', trader: 'invented' }] }, coin());
  assert.equal(result.length, 1); assert.equal(result[0].address, B); assert.equal(result[0].t, 1793614300);
  assert.equal(result[0].tokens, 10); assert.equal(result[0].quote, .5); assert.equal(result[0].usd, 100);
});

test('Clank service batches all stock rates, shares a bounded-time cache, and rejects arbitrary query targets', async () => {
  let calls = 0, now = NOW;
  const api = async (batch) => { calls++; return batch.map(([name, arg]) => ({ data: name === 'coins.list' ? { coins: [raw()], nextCursor: 'abc_123' }
    : name === 'coins.trending' ? [raw(B, { marketCapUsdg: 5432 })] : name === 'exchangeRates.tokenUsdg' ? { price: arg.token === STOCK ? 200 : 2200 } : null })); };
  const s = createClankService({ api, now: () => now, fetcher: async () => Response.json([{ symbol: 'NVDA', marketCap: 4e12, changePercent: -4.2, sparkline: [200, 201, 202] }]) });
  const [a, b] = await Promise.all([s.list(), s.list()]); assert.deepEqual(a, b); assert.equal(calls, 2);
  assert.equal(a.coins[0].marketCapUsd, 4000); assert.equal(a.coins[1].marketCapUsd, 5432);
  assert.deepEqual(a.stocks[0], { symbol: 'NVDA', marketCapUsd: 4e12, change24h: -4.2, candles: [{ close: 200 }, { close: 201 }, { close: 202 }], sparkline: [200, 201, 202] });
  await s.list(); assert.equal(calls, 2); now += 4000; await s.list(); assert.equal(calls, 4);
  const invalid = await clankTerminalResponse(new Request('https://agi1.app/api/checker?terminal=clank&url=https://elsewhere.test'), s);
  assert.equal(invalid.status, 400); assert.equal(calls, 4);
  const valid = await clankTerminalResponse(new Request('https://agi1.app/api/checker?terminal=clank'), s);
  assert.equal(valid.status, 200); assert.equal((await valid.json()).source, 'clank.trade');
});

test('Clank stats retain actual window counts and dollar volumes, leaving unknown windows absent', () => {
  const windows = normalizeClankStats({ marketId: `market:4663:${A}`, priceX18: '110', windows: {
    '5m': { startPriceX18: '100', buys: 3, sells: 2, buyers: 2, sellers: 1, buyVolumeRaw: '500000000000000000', sellVolumeRaw: '250000000000000000' },
    '1h': { startPriceX18: '100', buys: -1, sells: 2 },
  } }, coin());
  assert.equal(windows['5m'].volumeUsd, 150); assert.equal(windows['5m'].buys, 3); assert.ok(Math.abs(windows['5m'].change - .1) < 1e-12);
  assert.equal(windows['1h'], undefined); assert.equal(windows['1d'], undefined);
});

test('Clank real token images use a verified source CID, fixed hosts, validated image bytes and a shared cache', async () => {
  const sharp = (await import('sharp')).default;
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#446688' } }).png().toBuffer();
  const saved = globalThis.fetch, paths = [], key = `0x${'d'.repeat(40)}`, cid = `b${'a'.repeat(58)}`;
  globalThis.fetch = async (url) => {
    paths.push(String(url));
    if (String(url).startsWith('https://clank.trade/v1/trpc/coins.detail')) return Response.json([{ result: { data: raw(key, { image: `ipfs://${cid}` }) } }]);
    if (url === `https://gateway.pinata.cloud/ipfs/${cid}`) return new Response(bytes, { headers: { 'Content-Type': 'image/png' } });
    if (url === `https://ipfs.filebase.io/ipfs/${cid}`) throw new Error('gateway_down');
    throw new Error(`Unexpected host ${url}`);
  };
  try {
    const [a, b] = await Promise.all([clankTerminalImage(key), clankTerminalImage(key)]);
    assert.equal(a.status, 200); assert.equal(b.status, 200); assert.equal(a.headers.get('content-type'), 'image/webp');
    assert.ok((await a.arrayBuffer()).byteLength > 10); assert.equal(paths.length, 3);
    assert.equal((await clankTerminalImage(key)).status, 200); assert.equal(paths.length, 3);
    assert.equal((await clankTerminalImage('https://elsewhere.test/image.png')).status, 400); assert.equal(paths.length, 3);
  } finally { globalThis.fetch = saved; }
});

test('Clank logo failures recover without a failed cache entry, and separate coins share their source image', async () => {
  const sharp = (await import('sharp')).default;
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#446688' } }).png().toBuffer();
  let source = 'https://untrusted.example/image.png', fail = true, requests = 0;
  const image = createClankImageService({ imageSource: async () => source, fetcher: async () => {
    requests++; return new Response(fail ? '<html>gateway error</html>' : bytes);
  } });
  assert.equal((await image(A)).status, 404); assert.equal(requests, 0, 'an unvalidated source never reaches a gateway');
  source = `b${'c'.repeat(58)}`;
  const down = await image(A);
  assert.equal(down.status, 503); assert.equal(down.headers.get('cache-control'), 'no-store'); assert.equal(requests, 2);
  fail = false;
  const result = await Promise.all([image(A), image(B)]);
  assert.ok(result.every((r) => r.status === 200)); assert.equal(requests, 4, 'two tokens with one CID share one pair of gateway attempts');
  assert.equal((await image(STOCK)).status, 200); assert.equal(requests, 4, 'cached immutable content is reused across token addresses');
  assert.equal(coin(A, { image: 'https://untrusted.example/image.png' }).image, false);
});

test('Clank discovery logo bursts bound upstream downloads and reject excess work with a retryable response', async () => {
  const sharp = (await import('sharp')).default;
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#446688' } }).png().toBuffer();
  let active = 0, peak = 0, sources = 0;
  const image = createClankImageService({ imageSource: async () => `b${'a'.repeat(56)}${(++sources).toString(32).padStart(2, 'a').replace(/[0189]/g, 'z')}`,
    fetcher: async () => {
      peak = Math.max(peak, ++active);
      await new Promise((resolve) => setTimeout(resolve, 5)); active--;
      return new Response(bytes);
    } });
  const responses = await Promise.all(Array.from({ length: 40 }, (_, i) => image(`0x${(i + 1).toString(16).padStart(40, '0')}`)));
  assert.ok(peak <= 12, `at most six pictures with two fixed gateways each, observed ${peak}`);
  assert.equal(responses.filter((r) => r.status === 200).length, 30);
  assert.equal(responses.filter((r) => r.status === 503 && r.headers.get('retry-after') === '2').length, 10);
  assert.equal(active, 0);
});

test('Clank retains real USD-priced listings when optional stock prices are unavailable', async () => {
  const api = async (batch) => {
    if (batch[0][0] === 'exchangeRates.tokenUsdg') throw new Error('quotes_down');
    return [{ data: { coins: [raw()], nextCursor: null } }, { data: [raw(A, { marketCapUsdg: 4100, createdAt: undefined })] }];
  };
  const s = createClankService({ api, fetcher: async () => { throw new Error('stocks_down'); } });
  const result = await s.list(); assert.equal(result.coins.length, 1); assert.equal(result.coins[0].marketCapUsd, 4100);
  assert.equal(result.coins[0].createdAt, 1793600000000);
  assert.equal(result.coins[0].quoteUsd, null); assert.deepEqual(result.stocks, []);
});

function timerHarness() {
  let now = NOW, seq = 0; const tasks = new Map();
  return { now: () => now, timers: { set(fn, ms) { const id = ++seq; tasks.set(id, { fn, at: now + ms }); return id; }, clear(id) { tasks.delete(id); } },
    async advance(ms) { now += ms; for (const [id, t] of [...tasks]) if (t.at <= now) { tasks.delete(id); t.fn(); } await flush(); }, count: () => tasks.size };
}

test('Clank feed refreshes official listings and details, restricts chain, and stops pending work', async () => {
  const clock = timerHarness(); let count = 0;
  const feed = createClankFeed({ ...clock, fetch: async () => { count++; return Response.json(wire([coin(A, { marketCapUsdg: 4000 + count })])); } });
  feed.setChain('solana'); assert.equal(feed.chain, 'robinhood'); feed.start(); await flush();
  assert.equal(feed.status, 'live'); assert.equal(feed.coins().length, 1); assert.equal(feed.coins()[0].observedAt, NOW);
  await clock.advance(4000); assert.equal(count, 2); assert.equal(feed.coins()[0].marketCapUsd, 4002);
  feed.stop(); assert.equal(feed.status, 'idle'); assert.equal(feed.coins().length, 0); assert.equal(clock.count(), 0);
  await clock.advance(30000); assert.equal(count, 2);
  let resolve;
  const late = createClankFeed({ ...clock, fetch: () => new Promise((r) => { resolve = r; }) });
  late.start(); late.stop(); resolve(Response.json(wire())); await flush(); assert.equal(late.coins().length, 0); assert.equal(late.status, 'idle');
});

test('Clank practice uses only real identities and continues local trading through a metadata outage', async () => {
  const clock = timerHarness(); let fail = false;
  const feed = createClankFeed({ ...clock, fetch: async () => { if (fail) throw new Error('offline'); return Response.json(wire([coin(A), coin(B, { createdAt: '1793600100' })])); } });
  const m = createClankMarket({ feed, solUsd: 100, startSol: 10, config: { warmup: 500 }, wallNow: clock.now });
  assert.deepEqual(m.lists().new, []); assert.equal(m.size.coins, 0); assert.deepEqual(m.liveState().shown, { sim: false, ext: true, simPaused: true });
  feed.start(); await flush();
  const first = m.lists().trending[0]; assert.equal(first.ticker, 'CLNK'); assert.equal(first.live, true); assert.equal(first.quoteAsset, 'NVDA');
  assert.equal(first.holders, 7); assert.equal(first.mc, 40); assert.equal(first.pic, `/api/checker?terminal=clank&image=${A}`);
  const stats = m.stats(first.id); assert.equal(stats.holders, 7); assert.ok(stats.liq > 0); assert.equal(stats.buys5m, 0);
  assert.equal(stats.change5m, 0); assert.equal(stats.ath, 40); assert.equal(m.baseTime, NOW); assert.equal(m.clankPractice, true);
  assert.equal(m.lists().new[0].createdAt, 1793600100000); assert.equal(m.find(A)[0], first.id);
  fail = true; await clock.advance(4000); assert.equal(feed.status, 'down');
  assert.equal(m.lists().trending.length, 2); assert.ok(m.lists().trending.every((c) => c.live && c.tracked && !c.metadataLive));
  assert.equal(m.order({ coin: first.id, side: 'buy', sol: .1, slippage: 1 }).ok, true);
  m.advanceTo(120); assert.equal(m.size.coins, 2, 'fictional discovery stays paused through an outage');
  assert.equal(m.orders()[0].status, 'filled'); assert.ok(m.stats(first.id).vol > 0);
  assert.notEqual(m.stats(first.id).mc, first.mc); assert.equal(m.liveState().feed, 'down');
  m.destroy(); feed.stop();
});

test('a real Clank coin omitted from refreshed discovery keeps its independent practice market', async () => {
  const clock = timerHarness(); let first = true;
  const feed = createClankFeed({ ...clock, fetch: async () => { const out = wire(first ? [coin(A), coin(B)] : [coin(B)]); first = false; return Response.json(out); } });
  const m = createClankMarket({ feed, solUsd: 100, startSol: 10, wallNow: clock.now });
  feed.start(); await flush(); const id = m.find(A)[0];
  await clock.advance(25000); assert.equal(feed.status, 'live'); assert.equal(m.row(id).tracked, true);
  assert.notEqual(m.row(id).mc, 40); assert.equal(m.order({ coin: id, side: 'buy', sol: .1 }).ok, true);
  assert.equal(m.size.coins, 2); m.destroy(); feed.stop();
});

test('Clank practice orders stay available after tab suspension without needing fresh source prices', () => {
  let now = NOW;
  const c = { ...coin(), observedAt: NOW };
  const feed = { status: 'live', coins: () => [c], on: () => () => {}, watch: () => {}, picUrl: () => '/picture',
    detail: () => null, trending: () => [A], chainState: () => 'live' };
  const m = createClankMarket({ feed, startSol: 10, solUsd: 100, wallNow: () => now });
  const id = m.find(A)[0]; assert.equal(m.row(id).tracked, true);
  now += 21000;
  assert.equal(m.order({ coin: id, side: 'buy', sol: .1 }).ok, true);
  assert.equal(m.row(id).tracked, true); m.destroy();
});

test('Clank New uses source launch dates, so an old trending coin first seen now cannot become the newest', () => {
  const newest = { id: 1, live: true, createdAt: NOW - 1000, born: -1 }, older = { id: 2, live: true, createdAt: null, born: 0 };
  const m = { lists: () => ({ new: [newest], stretch: [], migrated: [older], trending: [older, newest] }) };
  assert.deepEqual(clankFeed(m, { sort: 'new' }).map((r) => r.id), [1, 2]);
  assert.deepEqual(clankFeed(m, { sort: 'trending' }).map((r) => r.id), [2, 1]);
});

test('Clank pagination can render more than 100 real coins in the same bonding phase', () => {
  const rows = Array.from({ length: 150 }, (_, id) => ({ id, live: true, createdAt: NOW - id * 1000, born: -id }));
  const m = { clankData: () => ({}), lists: ({ limit }) => ({ new: rows.slice(0, limit), stretch: [], migrated: [], trending: rows.slice(0, limit) }) };
  assert.equal(clankFeed(m, { sort: 'new', limit: 140 }).length, 140);
  assert.equal(clankFeed(m, { sort: 'trending', limit: 140 }).length, 140);
});

test('Clank search pagination uses its own cursor and clearing search restores the discovery cursor', async () => {
  const clock = timerHarness(), requests = [];
  const feed = createClankFeed({ ...clock, fetch: async (url) => {
    requests.push(url); const q = new URL(url, 'https://agi1.app').searchParams;
    return Response.json({ ...wire(), nextCursor: q.has('cursor') ? null : q.get('q') ? 'search_cursor' : 'main_cursor' });
  } });
  feed.start(); await flush(); await feed.search('cat'); await feed.loadMore();
  assert.ok(requests.at(-1).includes('cursor=search_cursor')); assert.ok(requests.at(-1).includes('q=cat')); assert.equal(feed.hasMore, false);
  await feed.search(''); assert.equal(feed.hasMore, true); await feed.loadMore();
  assert.ok(requests.at(-1).includes('cursor=main_cursor')); assert.equal(new URL(requests.at(-1), 'https://agi1.app').searchParams.has('q'), false);
  feed.stop();
});

function practiceHarness(seed = 'clank-local-practice', coins = [coin()]) {
  const listeners = new Set();
  const feed = { status: 'live', coins: () => coins, on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    watch: () => {}, picUrl: (a) => `/actual-picture/${a}`, detail: () => ({ windows: { '5m': { buys: 999, volumeUsd: 999999 } } }),
    trending: () => coins.map((c) => c.address), chainState: () => feed.status };
  const market = createClankMarket({ feed, seed, startSol: 20, solUsd: 100, wallNow: () => NOW });
  return { market, feed, snap(incoming) { for (const fn of listeners) fn({ type: 'snap', coins: incoming }); } };
}

test('Clank seeded practice evolves deterministically with local volume and never resets on source quote refresh', () => {
  const a = practiceHarness(), b = practiceHarness(), m = a.market, id = m.find(A)[0];
  assert.equal(m.clankPracticeStart(id), 0); assert.equal(m.clankPracticeSeed(id), 40);
  m.advanceTo(30); for (let t = .1; t < 30; t += .1) b.market.advanceTo(t); b.market.advanceTo(30);
  assert.deepEqual(m.candles(id), b.market.candles(id), 'frame chunking cannot alter practice ticks');
  const before = m.stats(id), bars = m.candles(id);
  assert.notEqual(before.mc, 40); assert.ok(before.vol > 0); assert.ok(bars.some((bar) => bar.v > 0 && bar.h > bar.l));
  assert.notEqual(before.buys5m, 999, 'official trade windows cannot overwrite simulated counts');
  a.snap([coin(A, { marketCapUsdg: 900000, name: 'Actual renamed coin', holderCount: 42 })]);
  assert.equal(m.row(id).name, 'Actual renamed coin'); assert.equal(m.row(id).holders, 42);
  assert.equal(m.clankData(id).marketCapUsd, 900000, 'fresh source metadata remains separately accessible');
  assert.equal(m.stats(id).mc, before.mc); assert.equal(m.stats(id).vol, before.vol); assert.deepEqual(m.candles(id), bars);
  assert.equal(m.clankPracticeSeed(id), 40);
  a.snap([coin(B, { marketCapUsdg: 8000 })]);
  const fresh = m.find(B)[0]; assert.equal(m.size.coins, 2); assert.equal(m.row(fresh).mc, 80);
  assert.equal(m.clankPracticeStart(fresh), 30); assert.equal(m.clankPracticeSeed(fresh), 80);
  m.advanceTo(40); assert.notEqual(m.row(fresh).mc, 80); assert.equal(m.size.coins, 2);
  m.destroy(); b.market.destroy();
});

test('Clank practice buys and sells move the same simulated pool and contribute to chart and window volume', () => {
  const bought = practiceHarness('clank-order-impact').market, control = practiceHarness('clank-order-impact').market;
  const sold = practiceHarness('clank-order-impact').market, id = bought.find(A)[0];
  for (const m of [bought, control, sold]) m.advanceTo(1);
  for (const m of [bought, sold]) assert.equal(m.order({ coin: id, side: 'buy', sol: .5, priority: 'ultra', slippage: 1 }).ok, true);
  for (const m of [bought, control, sold]) m.advanceTo(2);
  assert.equal(bought.orders()[0].status, 'filled'); assert.ok(bought.stats(id).mc > control.stats(id).mc);
  assert.equal(sold.order({ coin: id, side: 'sell', frac: 1, priority: 'ultra', slippage: 1 }).ok, true);
  bought.advanceTo(3); sold.advanceTo(3);
  assert.equal(sold.orders()[0].status, 'filled'); assert.equal(sold.orders()[0].side, 'sell');
  assert.ok(sold.stats(id).mc < bought.stats(id).mc); assert.equal(sold.positions()[0].open, false);
  assert.ok(sold.trades(id).some((t) => t.me && t.side === 'buy'));
  assert.ok(sold.trades(id).some((t) => t.me && t.side === 'sell'));
  const stats = sold.stats(id), bars = sold.candles(id), window = sold.clankPracticeWindows(id)['5m'];
  assert.ok(Math.abs(bars.reduce((sum, bar) => sum + bar.v, 0) - stats.vol) < 1e-10);
  assert.ok(Math.abs(window.volumeUsd - stats.vol * 100) < 1e-8);
  assert.equal(window.buys + window.sells, stats.txns); assert.ok(window.buyVolumeUsd > 0 && window.sellVolumeUsd > 0);
  for (const m of [bought, control, sold]) m.destroy();
});

test('Clank Live explicit local launches enter discovery and keep their practice market through source reconnects', () => {
  const h = practiceHarness('clank-local-launch'), m = h.market, source = m.find(A)[0];
  m.advanceTo(5);
  const funds = m.player.sol;
  const launched = m.launchCoin({ name: 'Local Practice Cat', ticker: 'LPCT', emoji: '🐱', pair: 'AAPL', line: 'Only in this practice run.' });
  assert.equal(m.canLaunchPractice, true); assert.equal(launched.ok, true); assert.equal(m.player.sol, funds);
  const id = launched.id;
  assert.notEqual(id, source); assert.equal(m.isExt(id), false);
  for (const read of [m.row, m.info, m.stats]) {
    const local = read(id);
    assert.equal(local.createdByPlayer, true); assert.equal(local.localPractice, true);
    assert.equal(local.practice, true); assert.equal(local.live, false);
    assert.equal(local.createdAt, NOW + 5000);
  }
  assert.equal(launched.coin.mint, null); assert.equal(launched.coin.devAddr, null);
  assert.equal(m.clankPracticeStart(id), 5); assert.equal(m.clankPracticeSeed(id), m.row(id).mc);
  assert.equal(clankFeed(m, { sort: 'new' })[0].id, id, 'local launch time compares correctly with source epoch timestamps');
  assert.ok(clankFeed(m, { sort: 'trending' }).some((r) => r.id === id));
  assert.deepEqual(clankFeed(m, { pair: 'AAPL' }).map((r) => r.id), [id]);
  assert.deepEqual(clankFeed(m, { pair: 'NVDA' }).map((r) => r.id), [source]);
  assert.deepEqual(m.find('$lpct'), [id]); assert.deepEqual(m.find('Local Practice Cat'), [id]);
  assert.equal(m.order({ coin: id, side: 'buy', sol: .2, priority: 'ultra', slippage: 1 }).ok, true);
  m.advanceTo(6); assert.equal(m.orders()[0].status, 'filled'); assert.ok(m.positions().find((p) => p.id === id)?.open);
  assert.equal(m.order({ coin: id, side: 'sell', frac: 1, priority: 'ultra', slippage: 1 }).ok, true);
  m.advanceTo(7); assert.equal(m.orders()[0].status, 'filled'); assert.equal(m.positions().find((p) => p.id === id).open, false);
  assert.ok(m.trades(id).some((t) => t.me && t.side === 'buy')); assert.ok(m.trades(id).some((t) => t.me && t.side === 'sell'));
  const window = m.clankPracticeWindows(id)['5m'];
  assert.ok(window.buyVolumeUsd > 0 && window.sellVolumeUsd > 0);
  assert.ok(Math.abs(window.volumeUsd - m.candles(id).reduce((sum, bar) => sum + bar.v, 0) * 100) < 1e-8);
  const before = m.stats(id), bars = m.candles(id), seed = m.clankPracticeSeed(id);
  h.feed.status = 'down'; h.snap([coin(A, { marketCapUsdg: 900000 })]);
  assert.deepEqual(m.stats(id), before); assert.deepEqual(m.candles(id), bars);
  h.feed.status = 'live'; h.snap([coin(A), coin(B)]);
  assert.deepEqual(m.stats(id), before); assert.deepEqual(m.candles(id), bars); assert.equal(m.clankPracticeSeed(id), seed);
  assert.equal(m.liveState().seen, 2, 'only actual source identities count as live listings');
  assert.equal(m.size.coins, 3); assert.equal(m.row(source).live, true);
  m.advanceTo(60); assert.equal(m.size.coins, 3, 'explicit creation does not enable fictional background discovery');
  assert.ok(m.stats(id).vol > before.vol); m.destroy();
});

test('Clank local creations never send source lookup, history, search or write requests', async () => {
  const clock = timerHarness(), requests = [], sourceReads = [];
  const feed = createClankFeed({ ...clock, fetch: async (url, options) => {
    requests.push({ url, options }); return Response.json({ ...wire(), nextCursor: 'source_next' });
  } });
  for (const key of ['detail', 'candles', 'interval', 'lookup']) {
    const original = feed[key]; feed[key] = (...args) => { sourceReads.push([key, ...args]); return original(...args); };
  }
  const watch = feed.watch; feed.watch = (ids) => { sourceReads.push(['watch', ...ids]); return watch(ids); };
  const m = createClankMarket({ feed, seed: 'clank-local-source-boundary', startSol: 10, solUsd: 100, wallNow: clock.now });
  feed.start(); await flush(); assert.equal(requests.length, 1);
  const launched = m.launchCoin({ name: 'Offline Local Cat', ticker: 'OFFCAT', pair: 'ETH', emoji: '🐱' });
  assert.equal(launched.ok, true); const id = launched.id;
  assert.equal(m.clankData(id), null); assert.deepEqual(m.clankTrades(id), []); assert.deepEqual(m.clankHolders(id), []);
  assert.deepEqual(m.clankCandles(id, '1s'), []); m.clankWatchInterval(id, '1s'); m.focus(id);
  assert.equal(await m.lookup(id), null); assert.equal(await m.lookup(m.info(id).mint), null);
  assert.equal(await m.lookup(`local:${id}`), null);
  assert.deepEqual(await m.clankSearch('Offline Local Cat'), [id]);
  assert.equal(m.clankHasMore(), false); assert.equal(await m.clankLoadMore(), false);
  assert.equal(m.order({ coin: id, side: 'buy', sol: .1, priority: 'ultra', slippage: 1 }).ok, true);
  m.advanceTo(2); assert.equal(m.orders()[0].status, 'filled'); await flush();
  assert.equal(requests.length, 1, 'launch, local chart, local search and practice trade cause no network request');
  assert.ok(sourceReads.every((entry) => entry.length === 1 && entry[0] === 'watch'), 'local IDs never reach any source reader');
  assert.deepEqual(feed.coins().map((c) => c.address), [A], 'local metadata never enters the authoritative source cache');
  await m.clankSearch('Original Clank Coin'); assert.equal(requests.length, 2, 'real discovery search remains available');
  assert.equal(m.clankHasMore(), true);
  for (const { url, options } of requests) {
    assert.equal(url.startsWith('/api/checker?terminal=clank'), true);
    assert.equal(options.method || 'GET', 'GET'); assert.equal(options.body, undefined); assert.equal(options.credentials, 'omit');
  }
  m.destroy(); feed.stop();
});
