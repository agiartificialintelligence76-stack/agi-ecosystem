// Dedicated Clank.trade identities and discovery. Each real coin's first public quote seeds a local practice
// market; later source quotes only refresh metadata, never the simulated price/volume or the player's fills.
// Automatic fictional discovery stays off. Explicit player-created coins remain local to this practice run.
import { createMarket } from './engine.js';
import { toReal } from './live-chains.js';

const ADDRESS = /^0x[0-9a-f]{40}$/;
const INTERVALS = ['1s', '5s', '15s', '1m', '5m', '15m'];
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const validCoin = (c) => c && ADDRESS.test(c.address) && typeof c.name === 'string' && c.name.length <= 80
  && typeof c.ticker === 'string' && c.ticker.length <= 32 && finite(c.marketCapUsd) && c.marketCapUsd > 0 && c.marketCapUsd < 1e15
  && ['curve', 'migrating', 'pool'].includes(c.phase);
const merge = (old, next) => ({ ...old, ...Object.fromEntries(Object.entries(next).filter(([, v]) => v !== null && v !== undefined && v !== '')) });

export function createClankFeed({ url = '/api/checker?terminal=clank', fetch: fetcher = globalThis.fetch, now = Date.now,
  timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id) }, listMs = 4000, detailMs = 3000 } = {}) {
  const S = { status: 'idle', wanted: false, generation: 0, coins: new Map(), details: new Map(), intervals: new Map(),
    watch: [], px: {}, stocks: [], recentTrades: [], next: null, paged: false, query: '', queryNext: null, querySeq: 0,
    listed: [], trending: [], timers: new Set(), aborts: new Set(), pending: new Map() };
  const listeners = new Set();
  const emit = (event) => { for (const fn of [...listeners]) { try { fn(event); } catch { /* isolate view listeners */ } } };
  const status = (value) => { if (S.status !== value) { S.status = value; emit({ type: 'status', status: value }); } };
  const later = (fn, ms) => { const id = timers.set(() => { S.timers.delete(id); fn(); }, ms); S.timers.add(id); };
  async function request(params, generation = S.generation) {
    const qs = new URLSearchParams(params), target = `${url}${qs.size ? `&${qs}` : ''}`;
    if (S.pending.has(target)) return S.pending.get(target);
    if (S.pending.size >= 16) throw new Error('busy');
    const stop = new AbortController(); S.aborts.add(stop);
    const timeout = timers.set(() => stop.abort(), 22000);
    const task = (async () => {
      const response = await fetcher(target, { signal: stop.signal, credentials: 'omit', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('unavailable');
      const raw = await response.text();
      if (raw.length > 2_000_000) throw new Error('too_large');
      const payload = JSON.parse(raw);
      if (generation !== S.generation || !S.wanted) throw new Error('stopped');
      if (payload?.v !== 1 || payload.source !== 'clank.trade' || payload.chain !== 'robinhood' || !Array.isArray(payload.coins)) throw new Error('invalid_source');
      const coins = payload.coins.filter(validCoin).slice(0, 300);
      for (const c of coins) S.coins.set(c.address, { ...merge(S.coins.get(c.address), c), observedAt: now() });
      while (S.coins.size > 500) {
        const candidate = [...S.coins.keys()].find((key) => !S.watch.includes(key));
        if (!candidate) break; S.coins.delete(candidate); S.intervals.delete(candidate);
        for (const key of S.details.keys()) if (key.startsWith(`${candidate}:`)) S.details.delete(key);
      }
      if (finite(payload.px?.eth) && payload.px.eth > 0) S.px.eth = payload.px.eth;
      if (Array.isArray(payload.stocks) && payload.stocks.length) S.stocks = payload.stocks.slice(0, 30);
      if (Array.isArray(payload.recentTrades)) S.recentTrades = payload.recentTrades.slice(0, 50);
      if (payload.address && ADDRESS.test(payload.address)) {
        const detail = { ...payload, coin: S.coins.get(payload.address), updatedAt: now() };
        S.details.set(`${payload.address}:${payload.interval}`, detail);
        while (S.details.size > 120) S.details.delete(S.details.keys().next().value);
        emit({ type: 'detail', address: payload.address, detail });
      }
      if (Array.isArray(payload.trending)) S.trending = payload.trending.filter((a) => ADDRESS.test(a));
      emit({ type: 'snap', coins: coins.map((c) => S.coins.get(c.address)) });
      return payload;
    })().finally(() => { timers.clear(timeout); S.aborts.delete(stop); if (S.pending.get(target) === task) S.pending.delete(target); });
    S.pending.set(target, task);
    return task;
  }
  async function listLoop(generation) {
    if (!S.wanted || generation !== S.generation) return;
    try {
      const result = await request({}, generation);
      if (!S.paged) S.next = result.nextCursor || null;
      S.listed = [...new Set([...(result.listed || []), ...S.listed])].slice(0, 500);
      status('live'); emit({ type: 'chains' });
    } catch { if (generation === S.generation && S.wanted) status('down'); }
    if (S.wanted && generation === S.generation) later(() => listLoop(generation), listMs);
  }
  async function detailLoop(generation) {
    if (!S.wanted || generation !== S.generation) return;
    await Promise.allSettled(S.watch.map((a) => request({ a, interval: S.intervals.get(a) || '1m' }, generation)));
    if (S.wanted && generation === S.generation) later(() => detailLoop(generation), detailMs);
  }
  const readDetail = (key) => S.details.get(`${key}:${S.intervals.get(key) || '1m'}`) || null;
  return {
    source: 'clank',
    start() { if (S.wanted) return; S.wanted = true; S.generation++; status('connecting'); listLoop(S.generation); detailLoop(S.generation); },
    stop() {
      S.wanted = false; S.generation++; for (const id of S.timers) timers.clear(id); S.timers.clear();
      for (const c of S.aborts) c.abort(); S.aborts.clear(); S.pending.clear(); S.coins.clear(); S.details.clear();
      S.watch = []; S.intervals.clear(); S.stocks = []; S.recentTrades = []; S.next = null; S.paged = false; S.query = ''; S.queryNext = null; S.querySeq++;
      S.listed = []; S.trending = []; status('idle');
    },
    setChain() { /* Clank.trade's verified market namespace is Robinhood Chain 4663 only. */ },
    watch(ids) {
      const next = (Array.isArray(ids) ? ids : []).filter((a) => ADDRESS.test(a)).slice(0, 8);
      const added = next.filter((a) => !S.watch.includes(a)); S.watch = next;
      if (S.wanted) for (const a of added) request({ a, interval: S.intervals.get(a) || '1m' }).catch(() => {});
    },
    interval(key, value) {
      if (!ADDRESS.test(key) || !INTERVALS.includes(value)) return;
      if (S.intervals.get(key) === value) return;
      S.intervals.set(key, value);
      if (S.wanted) request({ a: key, interval: value }).catch(() => {});
    },
    async lookup(raw) {
      const key = typeof raw === 'string' ? raw.toLowerCase() : '';
      if (!ADDRESS.test(key)) return null;
      const result = await request({ a: key, interval: S.intervals.get(key) || '1m' });
      return result.missing ? null : S.coins.get(key) || null;
    },
    async search(query) {
      const q = String(query).trim().slice(0, 80), seq = ++S.querySeq;
      S.query = q; S.queryNext = null;
      if (!q) return [];
      const result = await request({ q });
      if (seq === S.querySeq) S.queryNext = result.nextCursor || null;
      return result.listed || [];
    },
    async loadMore() {
      const q = S.query, seq = S.querySeq, cursor = q ? S.queryNext : S.next;
      if (!cursor) return false;
      const result = await request({ cursor, ...(q ? { q } : {}) });
      if (q) { if (seq === S.querySeq) S.queryNext = result.nextCursor || null; }
      else { S.paged = true; S.next = result.nextCursor || null; }
      S.listed = [...new Set([...S.listed, ...(result.listed || [])])].slice(0, 500); return true;
    },
    get hasMore() { return Boolean(S.query ? S.queryNext : S.next); },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get status() { return S.status; }, get chain() { return 'robinhood'; }, get px() { return { ...S.px }; },
    chainState(id = 'robinhood') { return id === 'robinhood' && S.status === 'live' ? 'live' : 'down'; },
    newCoins() { return [...S.coins.values()].filter((c) => c.createdAt && now() - c.createdAt < 3600000).length; },
    coins: () => [...S.coins.values()], detail: readDetail,
    candles: (key, interval) => S.details.get(`${key}:${interval}`)?.candles || [],
    trending: () => [...S.trending], stocks: () => [...S.stocks], recentTrades: () => [...S.recentTrades], picUrl: (key) => `${url}&image=${key}`,
  };
}

export function createClankMarket({ feed, chain = 'robinhood', seed, solUsd = 150, startSol, config = {}, wallNow = Date.now } = {}) {
  const px = Number.isFinite(solUsd) && solUsd > 0 ? solUsd : 150;
  const m = createMarket({ seed, solUsd: px, startSol, config: { ...config, warmup: 0 }, live: true, allowLivePracticeLaunch: true });
  const ext = m.ext, byAddress = new Map(), addresses = new Map(), metadata = new Map(), starts = new Map(), seeds = new Map();
  const localIds = new Set();
  const base = wallNow() - m.t * 1000;
  m.baseTime = base; m.clankPractice = true;
  let dead = false, focus = null, watchAt = -Infinity, localQuery = false;
  ext.view({ ext: true, sim: false, simPaused: true });
  const real = (c) => toReal({ k: 'u', mu: c.marketCapUsd, lu: c.liquidityUsd || null, pg: c.progress, gr: c.phase === 'pool', cl: c.phase === 'migrating' }, { solUsd: px });
  function upsert(c) {
    if (!validCoin(c)) return null;
    const state = real(c); if (!state) return null;
    let id = byAddress.get(c.address);
    if (id === undefined) {
      id = ext.add({ key: c.address, chain: 'robinhood', src: 'clank.trade', name: c.name, ticker: c.ticker,
        pic: c.image ? feed.picUrl(c.address) : null, by: c.creator, born: c.createdAt ? (c.createdAt - base) / 1000 : m.t,
        pair: c.quoteAsset || 'Unknown', live: true, practice: true, real: state });
      if (id === null) return null; byAddress.set(c.address, id); addresses.set(id, c.address);
      starts.set(id, m.t); seeds.set(id, c.marketCapUsd / px);
    } else if (c.image && !metadata.get(id)?.image) ext.pic(id, feed.picUrl(c.address));
    metadata.set(id, merge(metadata.get(id), c));
    return id;
  }
  function catchUp() { const t = (wallNow() - base) / 1000; if (t - m.t > 2) m.advanceTo(Math.min(t, m.t + 3600)); }
  const off = feed.on((event) => {
    if (dead) return;
    if (event.type === 'snap') { catchUp(); for (const c of event.coins) upsert(c); }
  });
  for (const c of feed.coins()) upsert(c);
  const rawRow = m.row, rawInfo = m.info, rawStats = m.stats;
  const localCoin = (id, value) => localIds.has(id) && value?.createdByPlayer === true;
  const localView = (value) => ({ ...value, live: false, practice: true, localPractice: true,
    createdAt: base + value.born * 1000 });
  m.row = (id) => {
    const row = rawRow(id), c = metadata.get(id);
    if (localCoin(id, row)) return localView(row);
    if (!row || !c) return null;
    return { ...row, name: c.name, ticker: c.ticker, quoteAsset: c.quoteAsset, holders: c.holderCount,
      progress: c.progress, phase: c.phase, trendingRank: c.trendingRank, priceChange: row.ch5m, createdAt: c.createdAt,
      practice: true, metadataLive: feed.status === 'live' };
  };
  m.info = (id) => {
    const info = rawInfo(id), c = metadata.get(id);
    if (localCoin(id, info)) return localView(info);
    return info && c ? { ...info, quoteAsset: c.quoteAsset, name: c.name, ticker: c.ticker, line: c.description || '', dev: c.creatorUsername || c.creatorName || c.creator || '—' } : null;
  };
  m.stats = (id) => {
    const s = rawStats(id), c = metadata.get(id);
    if (localCoin(id, s)) return localView(s);
    if (!s || !c) return null;
    return { ...s, name: c.name, ticker: c.ticker, progress: c.progress, phase: c.phase,
      holders: c.holderCount, practice: true, metadataLive: feed.status === 'live' };
  };
  const launchCoin = m.launchCoin;
  m.launchCoin = (input) => {
    if (dead) return { ok: false, error: 'over' };
    const result = launchCoin(input);
    if (result?.ok && rawRow(result.id)?.createdByPlayer) {
      localIds.add(result.id); starts.set(result.id, m.t); seeds.set(result.id, rawRow(result.id).mc);
      return { ...result, coin: m.info(result.id) };
    }
    return result;
  };
  m.lists = ({ limit = 100 } = {}) => {
    const cap = Math.max(1, Math.min(500, limit)), rows = [...addresses.keys(), ...localIds].map(m.row).filter(Boolean);
    const fresh = [...rows].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0) || b.id - a.id);
    const ranks = new Map(feed.trending().map((a, i) => [a, i]));
    const trending = rows.filter((r) => ranks.has(addresses.get(r.id))).sort((a, b) => ranks.get(addresses.get(a.id)) - ranks.get(addresses.get(b.id)));
    trending.push(...fresh.filter((r) => !ranks.has(addresses.get(r.id))));
    return { new: fresh.filter((r) => r.phase === 'curve' && !(r.progress >= .5)).slice(0, cap),
      stretch: fresh.filter((r) => r.phase === 'migrating' || r.phase === 'curve' && r.progress >= .5).slice(0, cap),
      migrated: fresh.filter((r) => r.phase === 'pool').slice(0, cap), trending: trending.slice(0, cap), bump: fresh.slice(0, cap), koth: null };
  };
  const localMatches = (q) => [...localIds].filter((id) => {
    const row = rawRow(id); return row && (row.ticker.toLowerCase().includes(q) || row.name.toLowerCase().includes(q));
  });
  const queryOf = (query) => String(query).trim().replace(/^\$/, '').toLowerCase();
  m.find = (query) => {
    const q = queryOf(query);
    return [...localMatches(q), ...[...metadata].filter(([, c]) => c.address === q || c.ticker.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)).map(([id]) => id)];
  };
  function watch(force = false) {
    if (!force && wallNow() - watchAt < 2000) return; watchAt = wallNow();
    const ids = [...new Set([focus, ...m.positions().filter((p) => p.open).map((p) => p.id)])].filter((id) => addresses.has(id));
    feed.watch(ids.slice(0, 8).map((id) => addresses.get(id)));
  }
  const advanceTo = m.advanceTo;
  m.advanceTo = (t) => { const result = advanceTo(t); watch(); return result; };
  m.focus = (id) => { focus = addresses.has(id) ? id : null; watch(true); };
  m.lookup = async (a) => {
    if (dead || typeof a !== 'string' || !ADDRESS.test(a.toLowerCase())) return null;
    const c = await feed.lookup(a); return dead || !c ? null : upsert(c);
  };
  const detail = (id) => addresses.has(id) ? feed.detail(addresses.get(id)) : null;
  m.clankData = (id) => { const c = metadata.get(id); return c ? { ...c, ...detail(id), status: feed.status } : null; };
  m.clankPracticeStart = (id) => starts.get(id) ?? null;
  m.clankPracticeSeed = (id) => seeds.get(id) ?? null;
  m.clankPracticeWindows = (id) => {
    const windows = ext.practiceWindows(id); if (!windows) return null;
    return Object.fromEntries(Object.entries(windows).map(([key, w]) => [key, w ? { buys: w.buys, sells: w.sells,
      buyers: w.buyers, sellers: w.sellers, buyVolumeUsd: w.buyVolume * px, sellVolumeUsd: w.sellVolume * px,
      volumeUsd: w.volume * px, change: w.change } : null]));
  };
  m.clankTrades = (id) => detail(id)?.trades || [];
  m.clankHolders = (id) => detail(id)?.holders || [];
  m.clankStocks = () => feed.stocks();
  m.clankRecentTrades = () => feed.recentTrades().map((r) => ({ ...r, coin: byAddress.get(r.address) ?? null, pic: r.image ? feed.picUrl(r.address) : null }));
  m.clankCandles = (id, interval = '1m') => addresses.has(id) ? feed.candles(addresses.get(id), interval) : [];
  m.clankWatchInterval = (id, interval) => { if (addresses.has(id)) feed.interval(addresses.get(id), interval); };
  m.clankSearch = async (q) => {
    if (dead) return [];
    localQuery = Boolean(queryOf(q) && localMatches(queryOf(q)).length);
    if (!localQuery) await feed.search(q);
    return dead ? [] : m.find(q);
  };
  m.clankLoadMore = () => localQuery ? Promise.resolve(false) : feed.loadMore();
  m.clankHasMore = () => !localQuery && feed.hasMore;
  m.liveState = () => ({ chain: 'robinhood', feed: feed.status, chainState: feed.chainState(), seen: addresses.size,
    shown: ext.shown, practice: true });
  m.liveTraded = () => m.positions().filter((p) => m.isExt(p.id) && p.buys > 0).length;
  m.destroy = () => { if (dead) return; dead = true; off(); feed.watch([]); };
  return m;
}
