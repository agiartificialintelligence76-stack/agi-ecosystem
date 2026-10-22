// Phomo's read models. All money is displayed in dollars; the existing engine still settles play-money orders.
// Traders here are the simulation's characters. Live coin data never acquires invented holders or identities.
import { KOLS } from '../names.js';
import { CHAIN_IDS } from '../live-chains.js';
import { trackItems, smartProfile, kolProfile } from './gngm-data.js';

export const PHOMO_CATEGORIES = Object.freeze([
  ['trending', 'Trending'], ['bluechips', 'Blue chips'], ['mostheld', 'Most held'],
  ['graduated', 'Graduated'], ['bonding', 'Bonding'], ['watchlist', 'Watchlist'],
].map(Object.freeze));
export const PHOMO_WINDOWS = Object.freeze(['5m', '1h', '4h', '24h']);
export const PHOMO_LIMITS = Object.freeze([25, 50, 100]);
export const PHOMO_SORTS = Object.freeze(['volume', 'marketCap', 'liquidity', 'change', 'holders', 'age', 'price']);
export const PHOMO_NETWORKS = Object.freeze(['all', 'simulated', ...CHAIN_IDS]);
export const WINDOW_SECONDS = Object.freeze({ '5m': 300, '1h': 3600, '4h': 14400, '24h': 86400 });
// A transparent game filter, rather than a claim that a token is safe or endorsed.
export const BLUE_CHIP_FILTER = Object.freeze({ marketCapUsd: 1_000_000, liquidityUsd: 50_000 });
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const value = (v) => (fin(v) ? v : null);
const positive = (v) => fin(v) && v > 0;
const toUsd = (v, px) => (fin(v) && positive(px) ? v * px : null);
const norm = (s) => String(s || '').trim().toLowerCase();
const METRICS = new WeakMap();
function cached(market, id) {
  const bucket = Math.floor(Date.now() / 1000);
  let memo = METRICS.get(market);
  if (!memo || memo.bucket !== bucket || memo.n !== market.n || memo.size !== (market.size && market.size.coins)) {
    memo = { bucket, n: market.n, size: market.size && market.size.coins, coins: new Map() };
    METRICS.set(market, memo);
  }
  if (!memo.coins.has(id)) {
    const row = market.row(id);
    memo.coins.set(id, { row, stats: row ? market.stats(id) : null,
      info: row && typeof market.info === 'function' ? market.info(id) : null, history: null });
  }
  return memo.coins.get(id);
}

export function clearPhomoCache(market) { METRICS.delete(market); }

export function coinKey(market, id) {
  const info = market && typeof market.info === 'function' ? market.info(id) : null;
  if (!info || typeof info.mint !== 'string') return null;
  return `${info.live ? info.chain || 'solana' : 'sim'}:${info.mint}`;
}

// For longer windows the engine has no provider percentage. Only calculate from an actually observed older quote.
export function historyWindow(candles, now, seconds, born = null) {
  const cd = (Array.isArray(candles) ? candles : []).filter((c) => c && fin(c.t) && positive(c.c));
  if (!cd.length || !fin(now) || !(seconds > 0)) return { change: null, volume: null };
  const start = now - seconds;
  let before = null;
  let latest = null;
  let volume = 0;
  for (const c of cd) {
    if (c.t > now) continue;
    latest = c;
    if (c.t <= start) before = c;
    if (c.t >= start && fin(c.v) && c.v >= 0) volume += c.v;
  }
  const sinceLaunch = fin(born) && born >= start && cd[0].t <= Math.floor(born);
  return { change: before && latest ? latest.c / before.c - 1 : null,
    volume: before || sinceLaunch ? volume : null };
}

export function tokenMetrics(market, id, { solUsd = market && market.solUsd, window = '1h' } = {}) {
  if (!market || typeof market.row !== 'function' || typeof market.stats !== 'function') return null;
  const cachedCoin = cached(market, id);
  const row = cachedCoin.row;
  const s = cachedCoin.stats;
  const info = cachedCoin.info;
  if (!row || !s) return null;
  const win = PHOMO_WINDOWS.includes(window) ? window : '1h';
  const px = positive(solUsd) ? solUsd : null;
  if ((win === '4h' || win === '24h') && !cachedCoin.history) {
    const candles = market.candles(id);
    cachedCoin.history = Object.fromEntries(['4h', '24h'].map((w) => [w, historyWindow(candles, market.t, WINDOW_SECONDS[w], s.born)]));
  }
  const history = cachedCoin.history && cachedCoin.history[win];
  const change = win === '5m' ? value(s.change5m) : win === '1h' ? value(s.change1h) : history.change;
  // The public engine API doesn't distinguish a provider's day volume from its observed fallback. A longer window
  // therefore needs retained coverage; an unavailable 4h/24h number stays blank rather than relabeling a shorter total.
  const volume = win === '5m' ? value(s.vol5m) : win === '1h' ? value(s.vol1h)
    : history.volume;
  return {
    id, key: coinKey(market, id), name: row.name, ticker: row.ticker, pic: row.pic || null, emoji: row.emoji,
    theme: row.theme, age: value(row.age), born: value(row.born), phase: row.phase,
    live: row.live === true, simulated: row.live !== true, tracked: row.tracked !== false,
    chain: row.live ? row.chain || info && info.chain || null : 'simulated', src: row.src || info && info.src || null,
    priceUsd: toUsd(s.price, px), practicePrice: row.live === true, marketCapUsd: toUsd(row.mc, px),
    liquidityUsd: s.live && s.estimated ? null : toUsd(s.liq, px),
    volumeUsd: toUsd(volume, px), change, holders: value(s.holders), transactions: value(s.txns),
    progress: value(s.progress), socials: row.socials || {}, watched: false, hidden: false,
  };
}

// The engine has integer IDs. Scan a bounded recent set, plus any explicitly watched older contract.
export function marketTokenRows(market, options = {}) {
  if (!market) return [];
  const ids = new Set();
  const size = market.size && market.size.coins;
  if (Number.isInteger(size) && size >= 0 && typeof market.row === 'function') {
    for (let id = Math.max(0, size - 2000); id < size; id++) ids.add(id);
  } else if (typeof market.lists === 'function') {
    const lists = market.lists({ limit: 100 });
    for (const key of ['new', 'stretch', 'migrated', 'trending', 'bump']) {
      for (const r of lists[key] || []) if (r && Number.isInteger(r.id)) ids.add(r.id);
    }
  }
  for (const id of options.includeIds || []) if (Number.isInteger(id)) ids.add(id);
  const shown = market.ext && market.ext.shown;
  const rows = [];
  for (const id of ids) {
    const r = market.row(id);
    if (!r || (shown && (r.live ? !shown.ext : !shown.sim))) continue;
    const m = tokenMetrics(market, id, options);
    if (m && m.key) rows.push(m);
  }
  return rows;
}

const SORT_FIELD = Object.freeze({ volume: 'volumeUsd', marketCap: 'marketCapUsd', liquidity: 'liquidityUsd',
  price: 'priceUsd', holders: 'holders', change: 'change', age: 'age' });
export function selectTokens(rows, options = {}) {
  const category = PHOMO_CATEGORIES.some(([id]) => id === options.category) ? options.category : 'trending';
  const sort = PHOMO_SORTS.includes(options.sort) ? options.sort : category === 'mostheld' ? 'holders' : 'volume';
  const direction = options.direction === 'asc' ? 1 : -1;
  const limit = PHOMO_LIMITS.includes(options.limit) ? options.limit : 25;
  const query = norm(options.query).replace(/^\$/, '');
  const network = PHOMO_NETWORKS.includes(options.network) ? options.network : 'all';
  const launchpad = norm(options.launchpad).slice(0, 80);
  const f = options.filters && typeof options.filters === 'object' ? options.filters : {};
  const watch = new Set(options.watchlist || []);
  const hide = new Set(options.hidden || []);
  const minimum = (v, n) => !fin(n) || (fin(v) && v >= n);
  const maximum = (v, n) => !fin(n) || (fin(v) && v <= n);
  const out = [];
  for (const original of Array.isArray(rows) ? rows : []) {
    if (!original || hide.has(original.key)) continue;
    const r = { ...original, watched: watch.has(original.key), hidden: false };
    if (network !== 'all' && r.chain !== network) continue;
    if (launchpad && launchpad !== 'all' && norm(r.src) !== launchpad) continue;
    if (query && !`${r.name} ${r.ticker} ${r.key}`.toLowerCase().includes(query)) continue;
    if (category === 'watchlist' && !r.watched) continue;
    if (category === 'graduated' && r.phase !== 'pool') continue;
    if (category === 'bonding' && r.phase !== 'curve' && r.phase !== 'migrating') continue;
    if (category === 'mostheld' && !fin(r.holders)) continue;
    if (category === 'bluechips' && !(r.marketCapUsd >= BLUE_CHIP_FILTER.marketCapUsd
      && r.liquidityUsd >= BLUE_CHIP_FILTER.liquidityUsd)) continue;
    if (!minimum(r.marketCapUsd, f.minMarketCap) || !maximum(r.marketCapUsd, f.maxMarketCap)
      || !minimum(r.liquidityUsd, f.minLiquidity) || !minimum(r.volumeUsd, f.minVolume)
      || !minimum(r.holders, f.minHolders) || !maximum(r.age, f.maxAge)
      || !minimum(r.change, f.minChange) || !maximum(r.change, f.maxChange)) continue;
    out.push(r);
  }
  const field = SORT_FIELD[sort];
  out.sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (!fin(av) || !fin(bv)) return Number(fin(bv)) - Number(fin(av)) || b.id - a.id;
    return (av - bv) * direction || b.id - a.id;
  });
  return { rows: out.slice(0, limit), total: out.length };
}

export function traderProfiles(market, { solUsd = market && market.solUsd } = {}) {
  if (!market) return [];
  const events = typeof market.feed === 'function' ? market.feed(0) : [];
  const wallets = typeof market.smartWallets === 'function' ? market.smartWallets() : [];
  const out = wallets.map((w) => {
    const p = smartProfile(w);
    if (!p) return null;
    return { key: `smart:${w.n}`, kind: 'smart', id: w.n, name: p.name, handle: `smartwallet${w.n + 1}`,
      address: p.addr, simulated: true, followers: null, pnlUsd: toUsd(p.run.pnl, solUsd),
      unrealizedUsd: toUsd(p.run.upnl, solUsd), weekPnlUsd: toUsd(p.week.pnl, solUsd),
      winRate: p.run.winRate, weekWinRate: p.week.winRate, volumeUsd: toUsd((w.in || 0) + (w.out || 0), solUsd),
      weekVolumeUsd: toUsd(p.week.vol, solUsd),
      trades: (w.buys || 0) + (w.sells || 0), holdings: (w.open || []).map((h) => ({ ...h,
        valueUsd: toUsd(h.value, solUsd), pnlUsd: toUsd(h.value + h.out - h.in, solUsd) })),
      week: p.week, run: p.run, last: value(w.last) };
  }).filter(Boolean);
  for (const k of KOLS) {
    const p = kolProfile(k.id, events);
    const activity = events.filter((e) => e.kol === k.id && (e.kind === 'kol_buy' || e.kind === 'kol_sell'));
    const holdings = [];
    for (const id of p.coins) {
      const s = market.stats(id);
      if (!s || s.live) continue;
      const h = (s.kols || []).find((x) => x.id === k.id);
      if (h && h.tok > 0) holdings.push({ coin: id, tok: h.tok, valueUsd: toUsd(h.tok * s.price, solUsd), pnlUsd: null });
    }
    out.push({ key: `kol:${k.id}`, kind: 'kol', id: k.id, name: `@${k.id}`, handle: k.id, address: p.addr,
      simulated: true, followers: k.followers, pnlUsd: null, unrealizedUsd: null, weekPnlUsd: null,
      winRate: null, weekWinRate: null, volumeUsd: toUsd(activity.reduce((sum, e) => sum + (fin(e.sol) ? e.sol : 0), 0), solUsd),
      weekVolumeUsd: null, trades: activity.length, holdings, week: null, run: null, last: activity.length ? activity[activity.length - 1].t : null });
  }
  return out;
}

export function selectTraders(profiles, { query = '', sort = 'pnl', following = false, followed = [], muted = [] } = {}) {
  const follow = new Set(followed);
  const mute = new Set(muted);
  const q = norm(query).replace(/^@/, '');
  const field = ({ pnl: 'pnlUsd', week: 'weekPnlUsd', winRate: 'winRate', weekWinRate: 'weekWinRate', volume: 'volumeUsd',
    weekVolume: 'weekVolumeUsd', followers: 'followers', activity: 'last' })[sort] || 'pnlUsd';
  const rows = profiles.filter((p) => !mute.has(p.key) && (!following || follow.has(p.key))
    && (!q || `${p.name} ${p.handle} ${p.address}`.toLowerCase().includes(q)))
    .map((p) => ({ ...p, followed: follow.has(p.key), muted: false }));
  rows.sort((a, b) => fin(a[field]) && fin(b[field]) ? b[field] - a[field] || a.key.localeCompare(b.key)
    : Number(fin(b[field])) - Number(fin(a[field])) || a.key.localeCompare(b.key));
  return rows.map((p, i) => ({ ...p, rank: i + 1 }));
}

export function socialFeed(market, { solUsd = market && market.solUsd, limit = 60 } = {}) {
  const events = market && typeof market.feed === 'function' ? market.feed(0) : [];
  return trackItems(events, { max: Math.min(300, Math.max(1, limit)) }).flatMap((e) => {
    const coin = market.row(e.coin);
    // The engine's NPCs are simulation actors, never evidence of a real wallet trading a live contract.
    if (!coin || coin.live) return [];
    const traderKey = e.who === 'kol' && e.kol ? `kol:${e.kol}` : e.who === 'smart' && Number.isInteger(e.smart) ? `smart:${e.smart}` : null;
    return [{ key: `${market.seed}:event:${e.q}`, q: e.q, t: e.t, coin: e.coin, traderKey,
      name: e.who === 'kol' ? `@${e.kol}` : e.who === 'smart' ? `Smart wallet ${e.smart + 1}` : 'A simulated whale',
      ticker: coin.ticker, side: e.side, amountUsd: toUsd(e.sol, solUsd), frac: e.frac, simulated: true,
      source: 'simulated', kind: 'trade' }];
  });
}

export function copyOrderFor(event, usdAmount, solUsd, market) {
  if (!event || !Number.isInteger(event.coin) || !market || !market.row(event.coin)) return { ok: false, error: 'no_coin' };
  if (event.side === 'buy') {
    const dollars = typeof usdAmount === 'number' ? usdAmount : Number(String(usdAmount || '').trim());
    if (!positive(dollars) || !positive(solUsd)) return { ok: false, error: 'bad' };
    return { ok: true, request: { coin: event.coin, side: 'buy', sol: dollars / solUsd } };
  }
  if (event.side === 'sell') {
    const position = market.positions().find((p) => p.id === event.coin && p.tokens > 0);
    if (!position) return { ok: false, error: 'no_tokens' };
    const frac = positive(event.frac) ? Math.min(1, event.frac) : 1;
    return { ok: true, request: { coin: event.coin, side: 'sell', frac } };
  }
  return { ok: false, error: 'bad' };
}
