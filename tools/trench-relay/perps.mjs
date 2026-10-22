// Read-only perpetual market data. Only these public Hyperliquid info requests can leave this module;
// browser messages never supply an upstream URL, account, order, signature, or time range.
import { trustedJson } from './lib/net.mjs';

export const PERPS_INFO = 'https://api.hyperliquid.xyz/info';
export const PERPS_INTERVALS = Object.freeze({ '1m': 60000, '5m': 300000, '15m': 900000, '1h': 3600000, '4h': 14400000, '1d': 86400000 });
export const PERPS_LIMITS = Object.freeze({ clients: 200, perIp: 8, perMinute: 40, concurrent: 3, candles: 180,
  cacheEntries: 100, marketMs: 10000, candleMs: 30000, dexMs: 3600000, staleMs: 300000, timeoutMs: 8000, maxBytes: 2000000 });
const DEX = /^[a-z][a-z0-9-]{0,19}$/;
const COIN = /^(?:[a-z][a-z0-9-]{0,19}:)?[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;
const number = (v) => {
  if (typeof v !== 'number' && !(typeof v === 'string' && v.length < 60 && v.trim() !== '')) return null;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= 1e18 ? n : null;
};
const positive = (v) => { const n = number(v); return n !== null && n > 0 ? n : null; };
const nonnegative = (v) => { const n = number(v); return n !== null && n >= 0 ? n : null; };
const cleanWord = (s) => typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u2069]/g, '').trim().slice(0, 50) : '';
const err = (code) => Object.assign(new Error(code), { code });

export function parsePerpDexs(raw) {
  if (!Array.isArray(raw)) throw err('unavailable');
  const out = [{ id: '', name: 'Hyperliquid' }];
  const seen = new Set(['']);
  for (const row of raw.slice(0, 100)) {
    if (!row || !DEX.test(row.name) || seen.has(row.name)) continue;
    seen.add(row.name);
    out.push({ id: row.name, name: cleanWord(row.fullName) || row.name });
  }
  return out;
}

export function parsePerpMarkets(raw, dex = '') {
  if (!Array.isArray(raw) || !Array.isArray(raw[0]?.universe) || !Array.isArray(raw[1])) throw err('unavailable');
  const seen = new Set();
  const out = [];
  for (const [i, asset] of raw[0].universe.slice(0, 1000).entries()) {
    const coin = asset?.name;
    if (typeof coin !== 'string' || !COIN.test(coin) || asset.isDelisted === true || seen.has(coin)) continue;
    if (dex ? !coin.startsWith(`${dex}:`) : coin.includes(':')) continue;
    seen.add(coin);
    const q = raw[1][i] || {};
    const mark = positive(q.markPx);
    const mid = positive(q.midPx);
    const oracle = positive(q.oraclePx);
    const previous = positive(q.prevDayPx);
    const price = mid ?? mark;
    const oi = nonnegative(q.openInterest);
    const leverage = positive(asset.maxLeverage);
    out.push({ coin, symbol: coin.split(':').at(-1), dex, price, mark, mid, oracle,
      change: price !== null && previous !== null ? number(price / previous - 1) : null,
      volume: nonnegative(q.dayNtlVlm), funding: number(q.funding), openInterest: oi,
      openInterestUsd: oi !== null && mark !== null ? nonnegative(oi * mark) : null,
      leverage: leverage !== null && leverage <= 1000 ? leverage : null });
  }
  return out.sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1) || a.coin.localeCompare(b.coin));
}

export function parsePerpCandles(raw, coin, interval, start, end) {
  if (!Array.isArray(raw)) throw err('unavailable');
  const rows = new Map();
  for (const c of raw.slice(0, 5000)) {
    if (!c || c.s !== coin || c.i !== interval || !Number.isSafeInteger(c.t) || c.t < start || c.t > end) continue;
    const o = positive(c.o), h = positive(c.h), l = positive(c.l), close = positive(c.c);
    if ([o, h, l, close].some((v) => v === null) || h < Math.max(o, close) || l > Math.min(o, close) || h < l) continue;
    rows.set(c.t, { t: c.t, o, h, l, c: close, v: nonnegative(c.v) });
  }
  return [...rows.values()].sort((a, b) => a.t - b.t).slice(-PERPS_LIMITS.candles);
}

export function createPerps({ fetchJson = trustedJson, now = Date.now, limits = {} } = {}) {
  const L = { ...PERPS_LIMITS, ...limits };
  const cache = new Map(), pending = new Map(), failed = new Map(), clients = new Set();
  const calls = [];
  let inFlight = 0, closed = false;
  async function request(body) {
    const t = now();
    while (calls.length && calls[0] <= t - 60000) calls.shift();
    if (closed) throw err('unavailable');
    if (inFlight >= L.concurrent || calls.length >= L.perMinute) throw err('busy');
    inFlight++;
    calls.push(t);
    try { return await fetchJson(PERPS_INFO, { method: 'POST', body, timeoutMs: L.timeoutMs, maxBytes: L.maxBytes }); }
    catch { throw err('unavailable'); }
    finally { inFlight--; }
  }
  async function cached(key, ttl, read) {
    const old = cache.get(key);
    if (old && now() - old.at < ttl) return { ...old, stale: false };
    if (pending.has(key)) return pending.get(key);
    if (failed.has(key) && now() - failed.get(key) < 3000) {
      if (old && now() - old.at <= L.staleMs) return { ...old, stale: true };
      throw err('unavailable');
    }
    const work = (async () => {
      try {
        const value = await read();
        const item = { data: value, at: now() };
        cache.delete(key);
        cache.set(key, item);
        while (cache.size > L.cacheEntries) cache.delete(cache.keys().next().value);
        failed.delete(key);
        return { ...item, stale: false };
      } catch (e) {
        failed.set(key, now());
        while (failed.size > L.cacheEntries) failed.delete(failed.keys().next().value);
        if (old && now() - old.at <= L.staleMs) return { ...old, stale: true };
        throw e;
      } finally { pending.delete(key); }
    })();
    pending.set(key, work);
    return work;
  }
  const dexs = () => cached('dexs', L.dexMs, async () => parsePerpDexs(await request({ type: 'perpDexs' })));
  async function markets(dex = '') {
    if (typeof dex !== 'string' || (dex !== '' && !DEX.test(dex))) throw err('bad_request');
    if (dex && !(await dexs()).data.some((d) => d.id === dex)) throw err('bad_request');
    return cached(`markets:${dex}`, L.marketMs, async () => parsePerpMarkets(await request({ type: 'metaAndAssetCtxs', ...(dex ? { dex } : {}) }), dex));
  }
  async function candles(coin, interval) {
    if (typeof coin !== 'string' || !COIN.test(coin) || !Object.hasOwn(PERPS_INTERVALS, interval)) throw err('bad_request');
    const dex = coin.includes(':') ? coin.split(':')[0] : '';
    const known = await markets(dex);
    if (!known.data.some((m) => m.coin === coin)) throw err('unknown_market');
    return cached(`candles:${coin}:${interval}`, L.candleMs, async () => {
      const end = now();
      const step = PERPS_INTERVALS[interval];
      const start = Math.floor(end / step) * step - step * (L.candles - 1);
      return parsePerpCandles(await request({ type: 'candleSnapshot', req: { coin, interval, startTime: start, endTime: end } }), coin, interval, start, end);
    });
  }
  function attach(ws) {
    if (closed || clients.size >= L.clients) { ws.close(1013, 'busy'); return; }
    const c = { ws, tokens: 8, at: now(), work: 0, alive: true };
    clients.add(c);
    const send = (m) => {
      if (!clients.has(c) || ws.readyState !== 1) return;
      if (ws.bufferedAmount > 1000000) { ws.close(1013, 'slow'); return; }
      try { ws.send(JSON.stringify(m)); } catch { ws.close(); }
    };
    ws.on('error', () => {});
    ws.on('close', () => clients.delete(c));
    ws.on('pong', () => { c.alive = true; });
    ws.on('message', async (data, binary) => {
      if (binary || data.length > 512) { ws.close(1008, 'bad message'); return; }
      c.tokens = Math.min(8, c.tokens + Math.max(0, now() - c.at) / 1000);
      c.at = now();
      if (c.tokens < 1) { ws.close(1008, 'too many messages'); return; }
      c.tokens--;
      let m;
      try { m = JSON.parse(String(data)); } catch { return; }
      if (!m || !Number.isSafeInteger(m.id) || m.id < 0 || !['dexs', 'markets', 'candles'].includes(m.op)) return send({ t: 'error', id: m?.id ?? null, code: 'bad_request' });
      if (c.work >= 2) return send({ t: 'error', id: m.id, code: 'busy' });
      c.work++;
      try {
        const result = m.op === 'dexs' ? await dexs() : m.op === 'markets' ? await markets(m.dex ?? '') : await candles(m.coin, m.interval);
        send({ t: m.op, id: m.id, ...result, ...(m.op === 'markets' ? { dex: m.dex ?? '' } : {}),
          ...(m.op === 'candles' ? { coin: m.coin, interval: m.interval } : {}) });
      } catch (e) { send({ t: 'error', id: m.id, code: ['busy', 'bad_request', 'unknown_market'].includes(e.code) ? e.code : 'unavailable' }); }
      finally { c.work--; }
    });
    send({ t: 'ready' });
  }
  const ping = setInterval(() => {
    for (const c of clients) {
      if (!c.alive) { c.ws.terminate(); clients.delete(c); continue; }
      c.alive = false;
      try { c.ws.ping(); } catch { c.ws.terminate(); clients.delete(c); }
    }
  }, 25000);
  ping.unref?.();
  return { attach, dexs, markets, candles,
    stats: () => ({ clients: clients.size, cached: cache.size, inFlight, callsLastMinute: calls.filter((t) => t > now() - 60000).length }),
    close() { closed = true; clearInterval(ping); for (const c of clients) c.ws.close(1001, 'stopping'); clients.clear(); cache.clear(); failed.clear(); },
  };
}
