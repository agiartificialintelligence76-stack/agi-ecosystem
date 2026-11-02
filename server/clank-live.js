// Clank's public read-only market API. One fixed upstream, bounded shared caches, no account or wallet calls.
import { clankApi, readLimited, hedged, looksLike, PICTURE_TYPES } from './coins.js';

export const CLANK_ADDRESS = /^0x[0-9a-f]{40}$/;
export const CLANK_INTERVALS = Object.freeze(['1s', '5s', '15s', '1m', '5m', '15m']);
const ETH = '0x0000000000000000000000000000000000000000';
const CID = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{50,100})$/;
const pictureCid = (raw) => {
  if (typeof raw !== 'string') return null;
  const value = raw.startsWith('ipfs://') ? raw.slice(7).replace(/^ipfs\//, '') : raw;
  return CID.test(value) ? value : null;
};
const publicLink = (value, twitter = false) => {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || (twitter && !['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname))) return null;
    return url.href;
  } catch { return null; }
};
const address = (v) => typeof v === 'string' && CLANK_ADDRESS.test(v.toLowerCase()) ? v.toLowerCase() : null;
const num = (v) => typeof v === 'number' || typeof v === 'string' && v.length < 90 && v.trim() ? Number(v) : NaN;
const positive = (v) => Number.isFinite(num(v)) && num(v) > 0 ? num(v) : null;
const nonnegative = (v) => Number.isFinite(num(v)) && num(v) >= 0 ? num(v) : null;
const text = (v, cap = 80) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, cap) : '';
const whole = (v, decimals = 18) => typeof v === 'string' && /^\d{1,78}$/.test(v) && Number.isInteger(decimals) && decimals >= 0 && decimals <= 36
  ? Number(v) / 10 ** decimals : null;
const data = (a) => a?.data ?? null;
const sourceMarket = (raw, key) => typeof raw?.id === 'string' && raw.id.toLowerCase() === `market:4663:${key}`;

export function normalizeClankCoin(raw, rates = new Map(), extra = {}) {
  const key = address(raw?.address);
  if (!key || !sourceMarket(raw, key)) return null;
  const name = text(raw.name), ticker = text(raw.symbol, 32);
  if (!name || !ticker) return null;
  const quoteAddress = address(raw.quoteCurrency);
  const quoteUsd = quoteAddress ? positive(rates.get(quoteAddress)) : null;
  const nativeMc = nonnegative(raw.marketCap);
  const marketCapUsd = positive(raw.marketCapUsdg) ?? (quoteUsd && nativeMc !== null ? nativeMc * quoteUsd : null);
  if (!(marketCapUsd > 0 && marketCapUsd < 1e15)) return null;
  const stage = num(raw.state), progress = nonnegative(raw.progress);
  return { address: key, name, ticker, image: Boolean(pictureCid(raw.image)), createdAt: positive(raw.createdAt) ? num(raw.createdAt) * 1000 : null,
    creator: address(raw.creator), creatorName: text(raw.creatorProfile?.name, 50) || null, creatorUsername: text(raw.creatorProfile?.username, 50) || null,
    twitter: publicLink(raw.twitter, true), website: publicLink(raw.website),
    quoteAddress, quoteAsset: text(raw.quoteSymbol, 20) || null, quoteUsd,
    quoteDecimals: Number.isInteger(raw.quoteDecimals) && raw.quoteDecimals >= 0 && raw.quoteDecimals <= 36 ? raw.quoteDecimals : 18,
    marketCapUsd, liquidityUsd: quoteUsd && nonnegative(raw.liquidityQuote) !== null ? num(raw.liquidityQuote) * quoteUsd : null,
    totalSupply: positive(whole(raw.totalSupply)), holderCount: Number.isInteger(raw.holderCount) && raw.holderCount >= 0 ? raw.holderCount : null,
    progress: progress === null ? null : Math.min(1, progress / 100), phase: stage === 1 || stage === 2 ? 'migrating' : stage === 3 || raw.isLive === true ? 'pool' : 'curve',
    priceChange: Number.isFinite(num(raw.priceChangePercent)) ? num(raw.priceChangePercent) / 100 : null,
    volumeUsd: nonnegative(raw.volumeUsdg), description: text(raw.description, 500),
    ...extra };
}

export function normalizeClankCandles(raw, coin, interval) {
  if (!coin || raw?.marketId?.toLowerCase() !== `market:4663:${coin.address}` || raw.interval !== interval || !Array.isArray(raw.candles)) return [];
  if (!(coin.totalSupply > 0 && coin.quoteUsd > 0)) return [];
  const scale = coin.totalSupply * coin.quoteUsd / 1e18;
  const rows = new Map();
  for (const bar of raw.candles.slice(-1000)) {
    if (bar?.marketId?.toLowerCase() !== `market:4663:${coin.address}` || bar.interval !== interval) continue;
    const t = num(bar.bucketStart), o = num(bar.openX18) * scale, h = num(bar.highX18) * scale, l = num(bar.lowX18) * scale, c = num(bar.closeX18) * scale;
    const volume = whole(bar.quoteVolumeRaw, coin.quoteDecimals), v = volume === null ? NaN : volume * coin.quoteUsd;
    if (!Number.isSafeInteger(t) || t < 1e9 || ![o, h, l, c, v].every(Number.isFinite) || l <= 0 || h < Math.max(o, c) || l > Math.min(o, c) || v < 0) continue;
    rows.set(t, { t, o, h, l, c, v });
  }
  return [...rows.values()].sort((a, b) => a.t - b.t);
}

export function normalizeClankChart(raw, coin, interval, now = Date.now()) {
  if (!coin || raw?.marketId?.toLowerCase() !== `market:4663:${coin.address}` || raw.interval !== interval) return { candles: [], chartThrough: null };
  const candles = normalizeClankCandles(raw, coin, interval);
  const through = num(raw.indexedThroughTimestamp);
  // The source clock is epoch seconds. Never substitute the browser/server clock for an absent index watermark.
  const chartThrough = Number.isSafeInteger(through) && through >= 1e9 && through < 1e11
    && through <= Math.floor(now / 1000) + 300 && (!candles.length || through >= candles.at(-1).t) ? through : null;
  return { candles, chartThrough };
}

export function normalizeClankTrades(raw, coin) {
  if (!Array.isArray(raw?.trades) || !coin) return [];
  const found = new Set();
  return raw.trades.slice(0, 100).flatMap((r) => {
    const id = text(r?.id, 220), trader = address(r?.trader), t = num(r?.timestamp), tokens = whole(r?.baseAmount), quote = whole(r?.quoteAmount, coin.quoteDecimals);
    if (!id || found.has(id) || !trader || !['buy', 'sell'].includes(r.side) || !Number.isSafeInteger(t) || t < 1e9 || !(tokens > 0 && quote >= 0)) return [];
    found.add(id);
    return [{ id, side: r.side, address: trader, name: text(r.profile?.name, 50) || null, t, tokens, quote,
      usd: coin.quoteUsd ? quote * coin.quoteUsd : null, tx: /^0x[0-9a-f]{64}$/i.test(r.transactionHash) ? r.transactionHash.toLowerCase() : null }];
  }).sort((a, b) => b.t - a.t);
}

export function normalizeClankStats(raw, coin) {
  if (!coin || raw?.marketId?.toLowerCase() !== `market:4663:${coin.address}` || !coin.quoteUsd) return {};
  const price = positive(raw.priceX18), windows = {};
  for (const key of ['5m', '1h', '4h', '1d']) {
    const r = raw.windows?.[key]; if (!r) continue;
    const buy = whole(r.buyVolumeRaw, coin.quoteDecimals), sell = whole(r.sellVolumeRaw, coin.quoteDecimals);
    if (![r.buys, r.sells, r.buyers, r.sellers].every((n) => Number.isSafeInteger(n) && n >= 0) || buy === null || sell === null) continue;
    const start = positive(r.startPriceX18);
    windows[key] = { buys: r.buys, sells: r.sells, buyers: r.buyers, sellers: r.sellers,
      buyVolumeUsd: buy * coin.quoteUsd, sellVolumeUsd: sell * coin.quoteUsd, volumeUsd: (buy + sell) * coin.quoteUsd,
      change: price && start ? price / start - 1 : null };
  }
  return windows;
}

export function normalizeClankRecentTrades(raw) {
  const seen = new Set();
  return (Array.isArray(raw) ? raw : []).slice(0, 50).flatMap((r) => {
    const key = address(r?.address), id = text(r?.id, 220), quote = whole(r?.quoteAmount, r?.quoteDecimals), ticker = text(r?.symbol, 32);
    if (!key || !id.startsWith('4663:') || seen.has(id) || !ticker || !['buy', 'sell'].includes(r.side) || !(quote >= 0) || quote === null) return [];
    seen.add(id);
    return [{ id, address: key, name: text(r.name), ticker, side: r.side, quote, quoteAsset: text(r.quoteSymbol, 20) || null, image: Boolean(pictureCid(r.image)) }];
  });
}

export function createClankService({ api = clankApi, fetcher = globalThis.fetch, now = Date.now } = {}) {
  const cache = new Map(), pending = new Map(), pictures = new Map();
  const rememberPictures = (raw) => {
    for (const r of raw) { const a = address(r?.address), cid = pictureCid(r?.image); if (a && cid && sourceMarket(r, a)) pictures.set(a, cid); }
    while (pictures.size > 1000) pictures.delete(pictures.keys().next().value);
  };
  async function memo(key, ttl, make) {
    const hit = cache.get(key);
    if (hit && now() - hit.at < ttl) return hit.value;
    if (pending.has(key)) return pending.get(key);
    if (pending.size >= 32) throw new Error('busy');
    const promise = make().then((value) => {
      cache.set(key, { at: now(), value });
      while (cache.size > 128) cache.delete(cache.keys().next().value);
      return value;
    }).finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  }
  const ask = (calls) => api(calls, { timeoutMs: 6000, hedgeMs: 1800 });
  async function publicJson(path, limit = 1_500_000) {
    return hedged(async (signal) => {
      const res = await fetcher(`https://clank.trade${path}`, { signal,
        headers: { Accept: 'application/json' }, credentials: 'omit', redirect: 'error' });
      if (!res.ok) throw new Error('unavailable');
      const bytes = await readLimited(res, limit); if (!bytes) throw new Error('too_big');
      return JSON.parse(bytes.toString('utf8'));
    }, 6000, 1500);
  }
  const stocks = () => memo('stocks', 60000, async () => {
    const raw = await publicJson('/v1/stocks/featured', 100000);
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, 30).flatMap((r) => {
      if (!/^[A-Z0-9]{1,12}$/.test(r?.symbol) || !positive(r.marketCap)) return [];
      const values = Array.isArray(r.sparkline) ? r.sparkline.filter((v) => Number.isFinite(v) && v > 0).slice(-200) : [];
      return [{ symbol: r.symbol, marketCapUsd: num(r.marketCap), change24h: Number.isFinite(num(r.changePercent)) ? num(r.changePercent) : null,
        candles: values.map((close) => ({ close })), sparkline: values }];
    });
  });
  async function ratesFor(raw) {
    const keys = [...new Set([ETH, ...raw.map((r) => address(r?.quoteCurrency)).filter(Boolean)])].slice(0, 24);
    const answers = await ask(keys.map((token) => ['exchangeRates.tokenUsdg', { token }]));
    return new Map(keys.map((key, i) => [key, positive(data(answers[i])?.price)]).filter(([, value]) => value));
  }
  async function list({ cursor = '', query = '' } = {}) {
    return memo(`list:${cursor}:${query}`, 3500, async () => {
      const args = { ...(cursor ? { cursor } : {}), ...(query ? { query } : {}) };
      const [answer, stockRows] = await Promise.all([ask([['coins.list', args], ['coins.trending', {}], ['coins.recentTrades', {}]]), stocks().catch(() => [])]);
      const page = data(answer[0]), trending = data(answer[1]);
      if (!Array.isArray(page?.coins) || !Array.isArray(trending)) throw new Error('unavailable');
      const raw = [...page.coins.slice(0, 100), ...trending.slice(0, 100)]; rememberPictures(raw);
      // Trending already contains authoritative USD caps. A missing optional pair quote must not hide those coins.
      const rates = await ratesFor(raw).catch(() => new Map());
      const coins = new Map(), ranks = new Map(trending.map((c, i) => [address(c.address), i]));
      const merged = new Map();
      for (const r of raw) { const key = address(r?.address); if (key) merged.set(key, { ...merged.get(key), ...Object.fromEntries(Object.entries(r).filter(([, v]) => v !== null && v !== undefined)) }); }
      for (const r of merged.values()) {
        const c = normalizeClankCoin(r, rates, { trendingRank: ranks.get(address(r.address)) ?? null });
        if (!c) continue;
        const old = coins.get(c.address);
        coins.set(c.address, old ? { ...old, ...Object.fromEntries(Object.entries(c).filter(([, v]) => v !== null && v !== '')) } : c);
      }
      return { v: 1, source: 'clank.trade', chain: 'robinhood', at: now(), coins: [...coins.values()], stocks: stockRows,
        recentTrades: normalizeClankRecentTrades(data(answer[2])),
        listed: page.coins.map((c) => address(c.address)).filter(Boolean), trending: trending.map((c) => address(c.address)).filter(Boolean),
        nextCursor: typeof page.nextCursor === 'string' && page.nextCursor.length <= 1024 ? page.nextCursor : null,
        px: { ...(rates.get(ETH) ? { eth: rates.get(ETH) } : {}) } };
    });
  }
  async function candles(coin, interval) {
    const params = new URLSearchParams({ interval, from: '0', to: String(Math.floor(now() / 1000)), limit: '500' });
    return normalizeClankChart(await publicJson(`/v1/markets/4663:${coin.address}/candles?${params}`), coin, interval, now());
  }
  async function detail(key, interval = '1m') {
    return memo(`detail:${key}:${interval}`, 2200, async () => {
      const answer = await ask([['coins.detail', { address: key }], ['coins.trades', { address: key, limit: 100 }], ['coins.holders', { address: key }], ['coins.liquidity', { address: key }]]);
      const raw = data(answer[0]);
      if (!raw || address(raw.address) !== key || !sourceMarket(raw, key)) return { v: 1, source: 'clank.trade', chain: 'robinhood', at: now(), coins: [], missing: true };
      rememberPictures([raw]);
      const rates = await ratesFor([raw]), liquidity = data(answer[3]);
      const coin = normalizeClankCoin({ ...raw, ...(positive(liquidity?.liquidityQuote) ? { liquidityQuote: num(liquidity.liquidityQuote) } : {}) }, rates);
      if (!coin) throw new Error('price_unavailable');
      const holderData = data(answer[2]);
      const holders = (Array.isArray(holderData?.holders) ? holderData.holders : []).slice(0, 100).flatMap((h) => {
        const a = address(h.address), tokens = whole(h.balance);
        return a && tokens !== null && Number.isFinite(tokens) ? [{ address: a, tokens, share: coin.totalSupply ? tokens / coin.totalSupply : null }] : [];
      });
      const [chart, stat] = await Promise.allSettled([candles(coin, interval), publicJson(`/v1/markets/4663:${key}/stats`)]);
      const chartData = chart.status === 'fulfilled' ? chart.value : { candles: [], chartThrough: null };
      const chartStatus = chart.status === 'fulfilled' ? 'live' : 'down';
      return { v: 1, source: 'clank.trade', chain: 'robinhood', at: now(), coins: [coin], address: key, interval,
        trades: normalizeClankTrades(data(answer[1]), coin), holders, ...chartData, chartStatus,
        windows: stat.status === 'fulfilled' ? normalizeClankStats(stat.value, coin) : {},
        tradesStatus: Array.isArray(data(answer[1])?.trades) ? 'live' : 'down', holdersStatus: Array.isArray(holderData?.holders) ? 'live' : 'down',
        px: { ...(rates.get(ETH) ? { eth: rates.get(ETH) } : {}) } };
    });
  }
  async function imageSource(key) {
    if (!CLANK_ADDRESS.test(key)) return null;
    if (pictures.has(key)) return pictures.get(key);
    return memo(`image:${key}`, 3000, async () => {
      const [answer] = await ask([['coins.detail', { address: key }]]);
      const raw = data(answer); if (address(raw?.address) !== key) return null;
      rememberPictures([raw]); return pictures.get(key) || null;
    });
  }
  return { list, detail, imageSource };
}

const service = createClankService();
export function createClankImageService({ imageSource = service.imageSource, fetcher = (...args) => fetch(...args) } = {}) {
  const cache = new Map(), pending = new Map(), contentPending = new Map(), queue = [];
  let active = 0, cachedBytes = 0;
  // A discovery page can contain dozens of logos. Bound both upstream downloads and queued work.
  const acquire = () => {
    if (active < 6) { active++; return Promise.resolve(); }
    if (queue.length >= 24) return Promise.reject(new Error('busy'));
    return new Promise((resolve, reject) => {
      const entry = { resolve, timer: setTimeout(() => {
        const index = queue.indexOf(entry); if (index >= 0) queue.splice(index, 1);
        reject(new Error('busy'));
      }, 2500) };
      queue.push(entry);
    });
  };
  const release = () => {
    const next = queue.shift();
    if (next) { clearTimeout(next.timer); next.resolve(); } else active--;
  };
  async function content(cid, deadline) {
    const hit = cache.get(cid);
    if (hit) { cache.delete(cid); cache.set(cid, hit); return hit; }
    if (contentPending.has(cid)) return contentPending.get(cid);
    const task = (async () => {
      const stops = [];
      const attempt = async (base) => {
        const stop = new AbortController(); stops.push(stop);
        // Cold IPFS retrieval frequently exceeds ten seconds. Keep the whole request within its server budget.
        const timer = setTimeout(() => stop.abort(), Math.max(1, Math.min(16000, deadline - Date.now())));
        try {
          const response = await fetcher(`${base}${cid}`, { signal: stop.signal, redirect: 'error', credentials: 'omit',
            headers: { Accept: 'image/webp,image/avif,image/png,image/jpeg,image/gif' } });
          if (!response.ok) { response.body?.cancel().catch(() => {}); throw new Error('unavailable'); }
          const body = await readLimited(response, 8_000_000);
          if (!body || ![...PICTURE_TYPES].some((type) => looksLike(type, body))) throw new Error('not_image');
          return body;
        } finally { clearTimeout(timer); }
      };
      let original;
      try { original = await Promise.any(['https://gateway.pinata.cloud/ipfs/', 'https://ipfs.filebase.io/ipfs/'].map(attempt)); }
      finally { stops.forEach((s) => s.abort()); }
      const sharp = (await import('sharp')).default;
      const result = await sharp(original, { limitInputPixels: 50_000_000, animated: false, failOn: 'error' })
        .timeout({ seconds: 2 }).rotate().resize(512, 512, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
      if (!result.length || result.length > 1000000) throw new Error('too_big');
      // Several real listings share an immutable CID. Download and decode that picture only once.
      cache.set(cid, result); cachedBytes += result.length;
      while (cache.size > 128 || cachedBytes > 16_000_000) {
        const first = cache.keys().next().value; cachedBytes -= cache.get(first).length; cache.delete(first);
      }
      return result;
    })().finally(() => contentPending.delete(cid));
    contentPending.set(cid, task);
    return task;
  }
  return async (key) => {
    if (!CLANK_ADDRESS.test(key)) return Response.json({ error: 'bad_request' }, { status: 400 });
    try {
      if (!pending.has(key)) {
        if (pending.size >= 30) throw new Error('busy');
        const deadline = Date.now() + 22000;
        const work = (async () => {
          await acquire();
          try {
            const cid = pictureCid(await imageSource(key));
            if (!cid) throw new Error('missing');
            return await content(cid, deadline);
          } finally { release(); }
        })();
        // Sharp's processing timer excludes its thread-pool wait. Return before the 25s endpoint limit even
        // when other image work occupies those threads; the bounded pipeline still releases its own slot.
        let timer;
        const task = Promise.race([work, new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('unavailable')), 24000);
        })]).finally(() => { clearTimeout(timer); pending.delete(key); });
        pending.set(key, task);
      }
      return new Response(await pending.get(key), { headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400',
        'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
    } catch (error) {
      // Neither a cold gateway nor a temporarily missing source is a permanent missing-image cache entry.
      return Response.json({ error: error.message === 'missing' ? 'no_picture' : 'unavailable' }, {
        status: error.message === 'missing' ? 404 : 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '2' } });
    }
  };
}
export const clankTerminalImage = createClankImageService();
export async function clankTerminalResponse(request, instance = service) {
  const params = new URL(request.url).searchParams;
  const allowed = new Set(['terminal', 'a', 'interval', 'cursor', 'q']);
  const bad = () => Response.json({ error: 'bad_request' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  if (request.method !== 'GET') return Response.json({ error: 'method_not_allowed' }, { status: 405 });
  if ([...params.keys()].some((k) => !allowed.has(k)) || [...params.keys()].some((k) => params.getAll(k).length !== 1) || params.get('terminal') !== 'clank') return bad();
  const key = params.get('a'), interval = params.get('interval') || '1m', cursor = params.get('cursor') || '', query = params.get('q') || '';
  if ((key && !CLANK_ADDRESS.test(key)) || !CLANK_INTERVALS.includes(interval) || cursor.length > 1024 || !/^[A-Za-z0-9_-]*$/.test(cursor) || query.length > 80 || /[\u0000-\u001f]/.test(query) || key && (cursor || query)) return bad();
  try {
    const body = key ? await instance.detail(key, interval) : await instance.list({ cursor, query });
    return Response.json(body, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=2', 'X-Content-Type-Options': 'nosniff' } });
  } catch {
    return Response.json({ error: 'unavailable', source: 'clank.trade' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
