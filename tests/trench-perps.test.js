import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { WebSocket } from 'ws';
import { readFileSync } from 'node:fs';
import { createPerps, parsePerpMarkets, parsePerpCandles, parsePerpDexs, PERPS_INFO, PERPS_LIMITS } from '../tools/trench-relay/perps.mjs';
import { startRelay } from '../tools/trench-relay/server.mjs';
import { readConfig } from '../tools/trench-relay/lib/config.mjs';
import { createLog } from '../tools/trench-relay/lib/log.mjs';
import { createPerpsClient, parsePerpsReply, perpsUrl, selectPerpMarkets, perpChartWindow } from '../src/games/trenchingsimulator/boards/phomo-perps.js';

const AT = 1792000100000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn) { for (let i = 0; i < 100; i++) { if (fn()) return; await sleep(10); } assert.fail('expected response did not arrive'); }
const fixture = (dex = '') => [{ universe: [{ name: dex ? `${dex}:TSLA` : 'BTC', maxLeverage: 20 }, { name: 'BAD', isDelisted: true }] },
  [{ markPx: '100', midPx: '102', oraclePx: '101', prevDayPx: '80', dayNtlVlm: '500000', funding: '-0.0001', openInterest: '30' }, {}]];
const candle = (t, over = {}) => ({ t, s: 'BTC', i: '15m', o: '100', h: '105', l: '98', c: '102', v: '30', ...over });
const mockFetch = (calls = []) => async (url, opts) => {
  calls.push({ url, ...opts });
  if (opts.body.type === 'perpDexs') return [null, { name: 'xyz', fullName: 'XYZ' }];
  if (opts.body.type === 'metaAndAssetCtxs') return fixture(opts.body.dex);
  if (opts.body.type === 'candleSnapshot') return [candle(opts.body.req.endTime, { s: opts.body.req.coin, i: opts.body.req.interval })];
  throw new Error('unexpected request');
};

test('perps parse only observed market fields, keep unknowns null and validate OHLC identities and ranges', () => {
  assert.deepEqual(parsePerpDexs([null, { name: 'xyz', fullName: 'XYZ' }, { name: 'https://evil' }, { name: 'xyz' }]),
    [{ id: '', name: 'Hyperliquid' }, { id: 'xyz', name: 'XYZ' }]);
  const [btc] = parsePerpMarkets(fixture());
  assert.deepEqual([btc.coin, btc.price, btc.mark, btc.mid, btc.oracle, btc.volume, btc.leverage], ['BTC', 102, 100, 102, 101, 500000, 20]);
  assert.equal(btc.change, 0.2749999999999999);
  assert.equal(btc.funding, -0.0001);
  assert.equal(btc.openInterestUsd, 3000);
  const raw = fixture();
  raw[1][0] = { markPx: '0', midPx: '', oraclePx: null, prevDayPx: '0', dayNtlVlm: 'NaN', funding: 'Infinity' };
  const [unknown] = parsePerpMarkets(raw);
  for (const key of ['price', 'mark', 'mid', 'oracle', 'change', 'volume', 'funding', 'openInterest', 'openInterestUsd']) assert.equal(unknown[key], null, key);
  assert.equal(parsePerpMarkets(fixture('xyz'), 'xyz')[0].coin, 'xyz:TSLA');
  assert.equal(parsePerpMarkets(fixture('xyz')).length, 0);
  assert.throws(() => parsePerpMarkets({}), /unavailable/);
  const rows = parsePerpCandles([candle(AT), candle(AT - 900000), candle(AT, { c: '103' }), candle(AT - 1, { s: 'ETH' }),
    candle(AT - 2, { i: '1m' }), candle(AT - 3, { h: '99' }), candle(AT - 4, { l: '110' }),
    candle(AT + 1), candle(AT - 5, { o: '' })], 'BTC', '15m', AT - 900000, AT);
  assert.deepEqual(rows.map((r) => [r.t, r.c]), [[AT - 900000, 102], [AT, 103]]);
});

test('perps cache shares requests, validates known assets and uses only bounded public info POSTs', async () => {
  const calls = [];
  const p = createPerps({ fetchJson: mockFetch(calls), now: () => AT });
  try {
    const [a, b] = await Promise.all([p.markets(), p.markets()]);
    assert.deepEqual(a, b); assert.equal(calls.length, 1);
    await p.markets(); assert.equal(calls.length, 1);
    await p.markets('xyz');
    assert.deepEqual(calls.map((c) => c.body.type), ['metaAndAssetCtxs', 'perpDexs', 'metaAndAssetCtxs']);
    const c = await p.candles('BTC', '15m');
    assert.equal(c.data[0].c, 102);
    const req = calls.at(-1).body.req;
    assert.equal(req.endTime, AT);
    assert.ok(req.startTime >= AT - 180 * 900000);
    assert.equal(req.coin, 'BTC');
    assert.equal(req.interval, '15m');
    await p.candles('BTC', '15m'); assert.equal(calls.length, 4);
    const before = calls.length;
    for (const [coin, tf] of [['https://evil', '15m'], ['BTC', '2s'], ['UNKNOWN', '15m'], ['__proto__', '15m']]) await assert.rejects(p.candles(coin, tf));
    for (const dex of ['https://evil', 'XYZ', 'unlisted']) await assert.rejects(p.markets(dex));
    assert.equal(calls.length, before, 'malformed or unknown markets never reach the API');
    assert.ok(calls.every((x) => x.url === PERPS_INFO && x.method === 'POST' && x.timeoutMs === 8000 && x.maxBytes === 2000000));
    assert.ok(calls.every((x) => ['perpDexs', 'metaAndAssetCtxs', 'candleSnapshot'].includes(x.body.type)));
  } finally { p.close(); }
});

test('perps stale responses keep their original timestamp, expire, and avoid retry storms', async () => {
  let now = AT, down = false, n = 0;
  const p = createPerps({ now: () => now, fetchJson: async () => { n++; if (down) throw new Error('private upstream details'); return fixture(); } });
  try {
    assert.equal((await p.markets()).at, AT);
    now += 10001; down = true;
    const stale = await p.markets();
    assert.equal(stale.stale, true); assert.equal(stale.at, AT);
    await p.markets(); assert.equal(n, 2, 'failures have a cooldown');
    now += PERPS_LIMITS.staleMs;
    await assert.rejects(p.markets(), /unavailable/);
    now += 3001; down = false;
    const recovered = await p.markets();
    assert.equal(recovered.stale, false); assert.equal(recovered.at, now);
  } finally { p.close(); }
});

test('perps bound shared upstream concurrency, request budget and cache growth', async () => {
  const release = [];
  const p = createPerps({ now: () => AT, limits: { concurrent: 1 }, fetchJson: () => new Promise((r) => release.push(r)) });
  try {
    const first = p.markets();
    await assert.rejects(p.dexs(), /busy/);
    release[0](fixture()); await first;
  } finally { p.close(); }
  const calls = [];
  const budget = createPerps({ fetchJson: mockFetch(calls), now: () => AT, limits: { perMinute: 1 } });
  try { await budget.markets(); await assert.rejects(budget.candles('BTC', '1m'), /busy/); assert.equal(calls.length, 1); }
  finally { budget.close(); }
  const bounded = createPerps({ fetchJson: mockFetch(), now: () => AT, limits: { cacheEntries: 2 } });
  try { await bounded.markets(); await bounded.candles('BTC', '1m'); await bounded.candles('BTC', '15m'); assert.equal(bounded.stats().cached, 2); }
  finally { bounded.close(); }
});

class Socket extends EventEmitter {
  constructor() { super(); this.readyState = 1; this.bufferedAmount = 0; this.sent = []; }
  send(s) { this.sent.push(JSON.parse(s)); }
  close(code) { this.code = code; this.readyState = 3; this.emit('close'); }
  terminate() { this.close(1006); }
  ping() {}
  say(m) { this.emit('message', Buffer.from(JSON.stringify(m)), false); }
}
test('perps sockets reject trading methods and cap client work without exposing API errors', async () => {
  const calls = [];
  const p = createPerps({ fetchJson: mockFetch(calls), now: () => AT });
  const s = new Socket(); p.attach(s);
  try {
    assert.deepEqual(s.sent[0], { t: 'ready' });
    s.say({ id: 1, op: 'order', user: 'wallet', signature: 'secret' });
    assert.equal(s.sent.at(-1).code, 'bad_request'); assert.equal(calls.length, 0);
    s.say({ id: 2, op: 'markets' });
    await until(() => s.sent.some((m) => m.id === 2));
    assert.equal(s.sent.find((m) => m.id === 2).t, 'markets');
    for (let i = 3; i < 15; i++) s.say({ id: i, op: 'markets' });
    await until(() => s.sent.some((m) => m.code === 'busy'));
    s.emit('message', Buffer.alloc(513), false);
    assert.equal(s.code, 1008);
  } finally { p.close(); }
});

test('browser perps replies validate data and sort real values with unknown metrics last', () => {
  const parsed = parsePerpsReply(JSON.stringify({ t: 'markets', id: 2, dex: '', at: AT, stale: false, data: parsePerpMarkets(fixture()) }));
  assert.equal(parsed.data[0].coin, 'BTC');
  assert.equal(parsePerpsReply(JSON.stringify({ ...parsed, dex: 'evil/', data: [] })), null);
  const bad = { ...parsed.data[0], mark: null, volume: '50000' };
  assert.equal(parsePerpsReply(JSON.stringify({ ...parsed, data: [bad] })).data[0].volume, null);
  const rows = [{ coin: 'BTC', volume: 10, change: 0.1 }, { coin: 'ETH', volume: 30, change: -0.2 }, { coin: 'UNKNOWN', volume: null, change: null }];
  assert.deepEqual(selectPerpMarkets(rows).map((r) => r.coin), ['ETH', 'BTC', 'UNKNOWN']);
  assert.deepEqual(selectPerpMarkets(rows, { sort: 'gainers' }).map((r) => r.coin), ['BTC', 'ETH', 'UNKNOWN']);
  assert.deepEqual(selectPerpMarkets(rows, { sort: 'losers' }).map((r) => r.coin), ['ETH', 'BTC', 'UNKNOWN']);
  assert.deepEqual(selectPerpMarkets(rows, { query: 'eth' }).map((r) => r.coin), ['ETH']);
  assert.equal(perpsUrl({ hostname: 'agi1.app', search: '?relay=ws://evil/ws' }), 'wss://live.agi1.app/perps');
  assert.equal(perpsUrl({ hostname: 'localhost', search: '?relay=ws://localhost:8787/ws' }), 'ws://localhost:8787/perps');
  const csp = JSON.parse(readFileSync('vercel.json', 'utf8')).headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;
  assert.ok(csp.includes('wss://live.agi1.app')); assert.ok(!csp.includes('hyperliquid'));
});

test('perps chart zoom and pan select only the available historical candles', () => {
  assert.deepEqual(perpChartWindow(180, 90, 0), { start: 90, end: 180, count: 90 });
  assert.deepEqual(perpChartWindow(180, 30, 40), { start: 110, end: 140, count: 30 });
  assert.deepEqual(perpChartWindow(180, 30, 900), { start: 0, end: 30, count: 30 });
  assert.deepEqual(perpChartWindow(12, 90, 0), { start: 0, end: 12, count: 12 });
  assert.deepEqual(perpChartWindow(0), { start: 0, end: 0, count: 0 });
  assert.deepEqual(perpChartWindow(180, 5, -10), { start: 165, end: 180, count: 15 });
});

test('browser perps client resolves requests, cancels on stop and reconnects without stale responses', async () => {
  const made = [], timers = new Set();
  class BrowserSocket {
    constructor(url) { this.url = url; this.readyState = 1; this.sent = []; made.push(this); }
    send(t) { this.sent.push(JSON.parse(t)); }
    close() { this.readyState = 3; }
    msg(o) { this.onmessage({ data: JSON.stringify(o) }); }
  }
  const c = createPerpsClient({ WebSocket: BrowserSocket, location: { hostname: 'agi1.app' },
    timers: { set: (fn, ms) => { const t = { fn, ms }; timers.add(t); return t; }, clear: (t) => timers.delete(t) } });
  try {
    c.start(); made[0].msg({ t: 'ready' });
    const p = c.request('markets', { dex: '' });
    const ask = made[0].sent.at(-1);
    made[0].msg({ t: 'markets', id: ask.id, dex: '', at: AT, data: parsePerpMarkets(fixture()) });
    assert.equal((await p).data[0].price, 102); assert.equal(timers.size, 0);
    const cancelled = assert.rejects(c.request('candles', { coin: 'BTC', interval: '15m' }), /unavailable/);
    c.stop(); await cancelled; assert.equal(timers.size, 0); assert.equal(made[0].readyState, 3);
    c.start(); made[1].msg({ t: 'ready' });
    const dropped = assert.rejects(c.request('markets'), /unavailable/);
    made[1].onclose(); await dropped;
    assert.equal(c.status, 'down');
    const retry = [...timers].find((t) => t.ms === 2000); assert.ok(retry); retry.fn();
    assert.equal(made.length, 3);
    made[0].msg({ t: 'ready' }); assert.equal(c.status, 'connecting', 'old socket messages are ignored');
  } finally { c.stop(); }
});

test('relay perps route enforces site origins and reads a market without a wallet or extra CSP origin', async () => {
  const docker = readFileSync('tools/trench-relay/Dockerfile', 'utf8');
  assert.match(docker, /COPY\s+server\.mjs\s+perps\.mjs\s+\.\//, 'the deployed relay image includes its market module');
  const { cfg, problems } = readConfig({ TRENCH_CHAINS: 'bnb', TRENCH_PORT: '0', TRENCH_HOST: '127.0.0.1', TRENCH_ORIGINS: 'http://localhost:4173', TRENCH_ROOMS: 'off' });
  const calls = [];
  const upstream = mockFetch(calls);
  const relay = await startRelay(cfg, { problems, log: createLog({ write() {} }),
    fetchJson: (url, opts) => url === PERPS_INFO ? upstream(url, opts) : Promise.resolve([]) });
  const sockets = [];
  try {
    const url = `ws://127.0.0.1:${relay.port}/perps`;
    const refused = new WebSocket(url, { origin: 'https://evil.example' }); sockets.push(refused);
    await new Promise((resolve, reject) => { refused.on('unexpected-response', (_req, res) => { assert.equal(res.statusCode, 403); res.resume(); refused.terminate(); resolve(); }); refused.on('open', () => reject(new Error('wrong origin accepted'))); refused.on('error', () => {}); });
    const ws = new WebSocket(url, { origin: 'http://localhost:4173' }); sockets.push(ws);
    const got = []; ws.on('message', (d) => got.push(JSON.parse(String(d))));
    await until(() => got.some((m) => m.t === 'ready'));
    ws.send(JSON.stringify({ op: 'markets', id: 1 }));
    await until(() => got.some((m) => m.t === 'markets'));
    assert.equal(got.find((m) => m.t === 'markets').data[0].coin, 'BTC');
    assert.equal(relay.health().perps.clients, 1);
    assert.equal(calls.length, 1);
  } finally { for (const ws of sockets) ws.terminate(); await relay.close(); }
});
