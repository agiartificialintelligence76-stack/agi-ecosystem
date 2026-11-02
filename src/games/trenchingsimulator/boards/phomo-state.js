// Phomo's local preferences and interactions. No account, wallet, external social message or automatic order.
// The board calls tick(); copying only happens after an explicit copyTrade() call through the supplied run callback.
import { PHOMO_CATEGORIES, PHOMO_WINDOWS, PHOMO_LIMITS, PHOMO_SORTS, PHOMO_NETWORKS, coinKey, marketTokenRows, selectTokens,
  tokenMetrics, traderProfiles, selectTraders, socialFeed, copyOrderFor, closedPositionStats } from './phomo-data.js';
import { cleanProfileImage, cleanProfileX } from './phomo-profile-image.js';

export const PHOMO_SAVE_KEY = 'trench_phomo_v1';
export const PHOMO_BOUNDS = Object.freeze({ watchlist: 200, hidden: 300, followed: 80, muted: 80, likes: 300,
  notes: 100, alerts: 40, notifications: 100, seen: 300, text: 500, panels: 4 });
const FILTERS = ['minMarketCap', 'maxMarketCap', 'minLiquidity', 'minVolume', 'minHolders', 'maxAge', 'minChange', 'maxChange'];
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const text = (v, max = 220) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, max) : '';
const seedOf = (v) => typeof v === 'string' || fin(v) ? text(String(v)) : '';
const clone = (v) => {
  // Image strings are immutable. Do not reserialize up to 768 KB on every preferences read.
  if (v?.profile) {
    const { avatarImage, bannerImage, ...profile } = v.profile;
    const copy = JSON.parse(JSON.stringify({ ...v, profile }));
    copy.profile.avatarImage = avatarImage; copy.profile.bannerImage = bannerImage; return copy;
  }
  return JSON.parse(JSON.stringify(v));
};
const strings = (v, n) => [...new Set((Array.isArray(v) ? v : []).map((s) => text(s)).filter(Boolean))].slice(-n);
const category = (v) => PHOMO_CATEGORIES.some(([k]) => k === v) ? v : 'trending';
const windowOf = (v) => PHOMO_WINDOWS.includes(v) ? v : '1h';
const networkOf = (v) => PHOMO_NETWORKS.includes(v) ? v : 'all';
const launchpadOf = (v) => text(v, 80).toLowerCase() || 'all';
const filtersOf = (v) => Object.fromEntries(FILTERS.filter((k) => v && fin(v[k]) && Math.abs(v[k]) <= 1e15).map((k) => [k, v[k]]));
const presets = (v, fallback, max) => Array.isArray(v) && v.length === 4 && v.every((n) => fin(n) && n > 0 && n <= max)
  ? [...v] : [...fallback];

export function blankPhomoPrefs() {
  return { v: 1, category: 'trending', window: '1h', sort: 'volume', direction: 'desc', limit: 25, query: '', filters: {},
    network: 'all', launchpad: 'all',
    buyPresets: [10, 100, 500, 1000], sellPresets: [10, 25, 50, 100], slippageMode: 'auto', slippage: 0.2,
    ui: { panels: [{ kind: 'tokens', category: 'trending', window: '1h' }],
      layout: 'columns', quickBuy: 10, rail: true, navigationKind:'leaderboard', discoveryWidth: 280, positionsWidth: 320,
      positionsCollapsed: false, panelSizes: [] },
    profile: { displayName: '', handle: '', bio: '', avatar: '🍜', banner: 'violet', avatarImage: null, bannerImage: null, twitterUrl: '' },
    traderAlerts: { disabled: [], minTradeUsd: 0, minPortfolioUsd: 0, minMarketCapUsd: 0, maxMarketCapUsd: null },
    watchlist: [], hidden: [], followed: [], muted: [], likes: [], notes: [], alerts: [], notifications: [], seen: [] };
}

export function cleanPhomoPrefs(raw) {
  const d = blankPhomoPrefs();
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return d;
  d.category = category(raw.category);
  d.window = windowOf(raw.window);
  if (PHOMO_SORTS.includes(raw.sort)) d.sort = raw.sort;
  if (raw.direction === 'asc') d.direction = 'asc';
  if (PHOMO_LIMITS.includes(raw.limit)) d.limit = raw.limit;
  d.query = text(raw.query, 100);
  d.filters = filtersOf(raw.filters);
  d.network = networkOf(raw.network);
  d.launchpad = launchpadOf(raw.launchpad);
  d.buyPresets = presets(raw.buyPresets, d.buyPresets, 1_000_000);
  d.sellPresets = presets(raw.sellPresets, d.sellPresets, 100);
  if (raw.slippageMode === 'custom') d.slippageMode = 'custom';
  if (fin(raw.slippage) && raw.slippage >= 0.001 && raw.slippage <= 0.99) d.slippage = raw.slippage;
  const u = raw.ui;
  if (u && typeof u === 'object') {
    if (u.layout === 'rows') d.ui.layout = 'rows';
    if (fin(u.quickBuy) && u.quickBuy > 0 && u.quickBuy <= 1_000_000) d.ui.quickBuy = u.quickBuy;
    if (typeof u.rail === 'boolean') d.ui.rail = u.rail;
    if (['tokens','watchlist','perps','feed','leaderboard','alerts'].includes(u.navigationKind)) d.ui.navigationKind=u.navigationKind;
    if (fin(u.discoveryWidth)) d.ui.discoveryWidth = Math.max(220, Math.min(420, u.discoveryWidth));
    if (fin(u.positionsWidth)) d.ui.positionsWidth = Math.max(240, Math.min(480, u.positionsWidth));
    if (typeof u.positionsCollapsed === 'boolean') d.ui.positionsCollapsed = u.positionsCollapsed;
    if (Array.isArray(u.panelSizes)) d.ui.panelSizes = u.panelSizes.slice(0, 4).filter(fin).map((n) => n === 0 ? 0 : Math.max(220, Math.min(1800, n)));
    if (Array.isArray(u.panels)) {
      const panels = u.panels.slice(0, PHOMO_BOUNDS.panels).filter((p) => p && ['tokens', 'watchlist', 'perps', 'feed', 'leaderboard', 'alerts', 'clans'].includes(p.kind));
      if (panels.length) d.ui.panels = panels.map((p) => ({ kind: p.kind, category: category(p.category), window: windowOf(p.window),
        sort: PHOMO_SORTS.includes(p.sort) ? p.sort : 'volume', direction: p.direction === 'asc' ? 'asc' : 'desc',
        limit: PHOMO_LIMITS.includes(p.limit) ? p.limit : 25, query: text(p.query, 100), filters: filtersOf(p.filters),
        network: networkOf(p.network), launchpad: launchpadOf(p.launchpad),
        tokenNameWidth: fin(p.tokenNameWidth) ? Math.max(220, Math.min(420, p.tokenNameWidth)) : 300 }));
    }
  }
  if (raw.profile && typeof raw.profile === 'object') {
    d.profile.displayName = text(raw.profile.displayName, 40);
    d.profile.handle = text(raw.profile.handle, 30).replace(/[^a-zA-Z0-9_]/g, '');
    d.profile.bio = text(raw.profile.bio, 160);
    if (['🍜', '🐱', '🐸', '🦊', '🪙', '🚀', '🌙', '🐋'].includes(raw.profile.avatar)) d.profile.avatar = raw.profile.avatar;
    if (['violet', 'ocean', 'forest', 'sunset', 'midnight'].includes(raw.profile.banner)) d.profile.banner = raw.profile.banner;
    d.profile.avatarImage = cleanProfileImage(raw.profile.avatarImage, 'avatar');
    d.profile.bannerImage = cleanProfileImage(raw.profile.bannerImage, 'banner');
    d.profile.twitterUrl = cleanProfileX(raw.profile.twitterUrl);
  }
  if (raw.traderAlerts && typeof raw.traderAlerts === 'object') {
    d.traderAlerts.disabled = strings(raw.traderAlerts.disabled, PHOMO_BOUNDS.followed);
    for (const k of ['minTradeUsd', 'minPortfolioUsd', 'minMarketCapUsd', 'maxMarketCapUsd']) {
      const n = raw.traderAlerts[k]; if (fin(n) && n >= 0 && n <= 1e15) d.traderAlerts[k] = n;
    }
  }
  for (const k of ['watchlist', 'hidden', 'followed', 'muted', 'likes', 'seen']) d[k] = strings(raw[k], PHOMO_BOUNDS[k]);
  d.notes = (Array.isArray(raw.notes) ? raw.notes : []).slice(-PHOMO_BOUNDS.notes).flatMap((n) => {
    if (!n || !text(n.id) || !text(n.text, PHOMO_BOUNDS.text)) return [];
    return [{ id: text(n.id), text: text(n.text, PHOMO_BOUNDS.text), coinKey: text(n.coinKey) || null,
      seed: seedOf(n.seed), traderKey: text(n.traderKey) || null, parentKey: text(n.parentKey) || null,
      at: fin(n.at) ? n.at : 0, t: fin(n.t) ? n.t : 0, editedAt: fin(n.editedAt) ? n.editedAt : null }];
  });
  d.alerts = (Array.isArray(raw.alerts) ? raw.alerts : []).slice(-PHOMO_BOUNDS.alerts).flatMap((a) => {
    if (!a || !text(a.id) || !text(a.coinKey) || !['price', 'marketCap'].includes(a.metric)
      || !['above', 'below'].includes(a.direction) || !fin(a.valueUsd) || a.valueUsd <= 0 || a.valueUsd > 1e15) return [];
    return [{ id: text(a.id), coinKey: text(a.coinKey), metric: a.metric, direction: a.direction, valueUsd: a.valueUsd,
      active: a.active !== false, createdAt: fin(a.createdAt) ? a.createdAt : 0, firedAt: fin(a.firedAt) ? a.firedAt : null }];
  });
  d.notifications = (Array.isArray(raw.notifications) ? raw.notifications : []).slice(-PHOMO_BOUNDS.notifications).flatMap((n) => {
    if (!n || !text(n.id) || !text(n.text, 200)) return [];
    return [{ id: text(n.id), text: text(n.text, 200), kind: n.kind === 'price' ? 'price' : 'trader',
      coinKey: text(n.coinKey) || null, traderKey: text(n.traderKey) || null, at: fin(n.at) ? n.at : 0,
      read: n.read === true, simulated: n.simulated === true }];
  });
  return d;
}

export function createPhomoState(market, { storage = null, solUsd = market && market.solUsd, order = null,
  playerName = null, now = Date.now, onChange = null, kols = null, paperPerps = null } = {}) {
  let prefs;
  try { prefs = cleanPhomoPrefs(JSON.parse(storage && storage.getItem(PHOMO_SAVE_KEY) || 'null')); }
  catch { prefs = blankPhomoPrefs(); }
  let dead = false;
  let sequence = 0;
  let lastFeed = market && market.feedSeq || 0;
  let profiles = null;
  let profilesAt = -Infinity;
  let publicRevision = null;
  const username = () => prefs.profile.displayName || text(typeof playerName === 'function' ? playerName() : playerName, 40) || 'You';
  const nextId = (kind) => {
    let id;
    do { id = `${kind}:${now()}:${++sequence}`; }
    while ([...prefs.notes, ...prefs.alerts, ...prefs.notifications].some((x) => x.id === id));
    return id;
  };
  const emit = () => { if (!dead && typeof onChange === 'function') onChange(); };
  const save = () => {
    prefs = cleanPhomoPrefs(prefs);
    try { if (storage) storage.setItem(PHOMO_SAVE_KEY, JSON.stringify(prefs)); } catch { /* private/full storage */ }
    emit();
  };
  const keyOf = (id) => Number.isInteger(id) ? coinKey(market, id) : null;
  const resolve = (key) => {
    if (!key || typeof market.find !== 'function') return null;
    const mint = key.slice(key.indexOf(':') + 1);
    return market.find(mint).find((id) => keyOf(id) === key) ?? null;
  };
  const getProfiles = () => {
    if (market.live) {
      const rev=kols?.revision ?? Math.floor(now()/1000);
      if(profiles&&publicRevision===rev)return profiles;
      const source = kols?.snapshot();
      publicRevision=rev;
      profiles=(source?.traders || []).map(p => ({ ...p, kind:'real', simulated:false, paper:false,
        pnlUsd:null, dailyPnlUsd:fin(p.pnlSol) && source.solUsd > 0 ? p.pnlSol * source.solUsd : null,
        weekPnlUsd:null, unrealizedUsd:null, volumeUsd:null, weekVolumeUsd:null, followers:null,
        trades:null, holdings:[], week:null, run:null, last:null, sourceAt:source.asOf }));
      return profiles;
    }
    if (!profiles || now() - profilesAt >= 1000) {
      profiles = traderProfiles(market, { solUsd });
      profilesAt = now();
    }
    return profiles;
  };
  const validTrader = (key) => typeof key === 'string' && getProfiles().some((p) => p.key === key);
  const toggle = (list, key) => {
    if (!key || dead) return false;
    const i = prefs[list].indexOf(key);
    if (i >= 0) prefs[list].splice(i, 1);
    else prefs[list].push(key);
    save();
    return i < 0;
  };
  const notify = (n, seenKey) => {
    if (prefs.seen.includes(seenKey)) return false;
    prefs.seen.push(seenKey);
    prefs.notifications.push({ id: nextId('notification'), at: now(), read: false, ...n });
    return true;
  };
  const ownProfile = () => {
    const p = market.player;
    const positions = market.positions();
    const filled = market.orders(300).filter((o) => o.status === 'filled');
    const paperFills = (paperPerps?.snapshot()?.fills || []).filter((f) => fin(f.notional) && f.notional > 0);
    const closed = closedPositionStats(positions, solUsd);
    return { key: 'you', kind: 'you', id: 'you', name: username(), handle: prefs.profile.handle || username(), address: p.address,
      bio: prefs.profile.bio, avatar: prefs.profile.avatar, banner: prefs.profile.banner,
      avatarImage: prefs.profile.avatarImage, bannerImage: prefs.profile.bannerImage, twitterUrl: prefs.profile.twitterUrl,
      simulated: true, paper: true, followers: null, pnlUsd: (p.worth - market.startSol) * solUsd,
      unrealizedUsd: positions.reduce((sum, x) => sum + x.pnl, 0) * solUsd, weekPnlUsd: null,
      winRate: closed.winRate, closed, weekWinRate: null, volumeUsd: filled.reduce((sum, o) => sum + (o.side === 'buy' ? o.spent : o.got), 0) * solUsd
        + paperFills.reduce((sum, f) => sum + f.notional, 0),
      trades: filled.length + paperFills.length, holdings: positions.filter((p0) => p0.open).map((p0) => ({ coin: p0.id, tok: p0.tokens,
        valueUsd: p0.value * solUsd, pnlUsd: p0.pnl * solUsd })), week: null, run: null, followed: false, muted: false };
  };

  const api = {
    get prefs() { const p=clone(prefs); if(market.live&&kols)p.followed=[...new Set([...p.followed,...getProfiles().filter(t=>t.followed).map(t=>t.id)])];return p; },
    setProfile(patch = {}) { if (dead || !patch || typeof patch !== 'object') return; prefs.profile = { ...prefs.profile, ...patch }; save(); },
    setTraderAlerts(patch = {}) { if (dead || !patch || typeof patch !== 'object') return; prefs.traderAlerts = { ...prefs.traderAlerts, ...patch }; save(); },
    setPrefs(patch = {}) {
      if (dead || !patch || typeof patch !== 'object') return clone(prefs);
      // UI callers can update preferences, never replace notification/history books through this entry point.
      for (const k of ['category', 'window', 'sort', 'direction', 'limit', 'query', 'network', 'launchpad', 'buyPresets', 'sellPresets', 'slippageMode', 'slippage']) {
        if (Object.hasOwn(patch, k)) prefs[k] = patch[k];
      }
      if (patch.filters && typeof patch.filters === 'object') prefs.filters = { ...prefs.filters, ...patch.filters };
      if (patch.ui && typeof patch.ui === 'object') prefs.ui = { ...prefs.ui, ...patch.ui };
      save();
      return clone(prefs);
    },
    tokens(overrides = {}) {
      const options = { ...prefs, ...overrides, filters: { ...prefs.filters, ...(overrides.filters || {}) },
        watchlist: prefs.watchlist, hidden: prefs.hidden };
      const includeIds = prefs.watchlist.map(resolve).filter((id) => id !== null);
      return selectTokens(marketTokenRows(market, { solUsd, window: options.window, includeIds }), options);
    },
    toggleWatch(id) { return toggle('watchlist', keyOf(id)); },
    isWatched(id) { return prefs.watchlist.includes(keyOf(id)); },
    toggleHide(id) { return toggle('hidden', keyOf(id)); },
    isHidden(id) { return prefs.hidden.includes(keyOf(id)); },
    restoreHidden() { prefs.hidden = []; save(); },
    traders(options = {}) { return selectTraders(getProfiles(), { ...options, followed: api.prefs.followed, muted: prefs.muted }); },
    profile(key) {
      if (key === 'you') return ownProfile();
      const p = getProfiles().find((x) => x.key === key);
      return p ? { ...p, followed: api.isFollowing(key), muted: prefs.muted.includes(key) } : null;
    },
    traderForAddress(address) {
      if (address === market.player.address) return 'you';
      const p = getProfiles().find((x) => x.address === address);
      return p ? p.key : null;
    },
    toggleFollow(key) { if(typeof key!=='string')return false;if(market.live&&key.startsWith('kolscan:'))return kols?.toggleFollow(key)||false;return validTrader(key) ? toggle('followed', key) : false; },
    isFollowing(key) { return typeof key==='string' && (market.live&&key.startsWith('kolscan:') ? !!kols?.isFollowing(key) : prefs.followed.includes(key)); },
    toggleMute(key) { return validTrader(key) ? toggle('muted', key) : false; },
    isMuted(key) { return prefs.muted.includes(key); },
    feed({ following = false, limit = 60, traderKey = null, types = null, replies = true } = {}) {
      const rows = socialFeed(market, { solUsd, limit: 300 });
      for (const o of market.orders(120)) {
        if (o.status !== 'filled') continue;
        rows.push({ key: `${market.seed}:order:${o.id}`, q: null, t: o.doneAt, coin: o.coin, traderKey: 'you', name: username(),
          ticker: o.ticker, side: o.side, amountUsd: (o.side === 'buy' ? o.spent : o.got) * solUsd, frac: o.frac,
          simulated: !market.isExt(o.coin), paper: true, source: 'you', kind: 'trade' });
      }
      for (const n of api.notes()) {
        if (n.seed !== seedOf(market.seed)) continue;
        const r = n.coin === null ? null : market.row(n.coin);
        rows.push({ key: n.id, t: n.t, coin: n.coin, traderKey: 'you', aboutTrader: n.traderKey,
          name: username(), ticker: r ? r.ticker : null, text: n.text, parentKey: n.parentKey, simulated: false,
          paper: true, source: 'note', kind: 'note' });
      }
      for (const p of market.positions()) {
        if (p.open || !p.buys || !fin(p.total)) continue;
        rows.push({ key: `${market.seed}:closed:${p.id}:${p.last}`, t: p.last, coin: p.id, traderKey: 'you', name: username(),
          ticker: p.ticker, pnlUsd: p.total * solUsd, simulated: !market.isExt(p.id), paper: true, source: 'you', kind: 'closed' });
      }
      return rows.filter((e) => (!e.traderKey || !prefs.muted.includes(e.traderKey))
        && (replies || !e.parentKey) && (!Array.isArray(types) || types.includes(e.kind))
        && (!following || e.traderKey === 'you' || prefs.followed.includes(e.traderKey))
        && (!traderKey || e.traderKey === traderKey))
        .sort((a, b) => b.t - a.t || b.key.localeCompare(a.key)).slice(0, Math.max(1, Math.min(100, limit)))
        .map((e) => ({ ...e, liked: prefs.likes.includes(e.key), likes: prefs.likes.includes(e.key) ? 1 : 0,
          notes: prefs.notes.filter((n) => n.parentKey === e.key).length }));
    },
    toggleLike(key) { return toggle('likes', text(key)); },
    isLiked(key) { return prefs.likes.includes(key); },
    addNote({ text: raw, coin = null, traderKey = null, parentKey = null } = {}) {
      const body = text(raw, PHOMO_BOUNDS.text);
      const key = coin === null ? null : keyOf(coin);
      if (!body || (coin !== null && !key) || (traderKey && traderKey !== 'you' && !validTrader(traderKey))) return { ok: false, error: 'bad' };
      const note = { id: nextId('note'), text: body, coinKey: key, seed: seedOf(market.seed), traderKey,
        parentKey: text(parentKey) || null, at: now(), t: market.t };
      prefs.notes.push(note);
      save();
      return { ok: true, note: { ...note, coin } };
    },
    removeNote(id) { prefs.notes = prefs.notes.filter((n) => n.id !== id); save(); },
    editNote(id, raw) {
      const n = prefs.notes.find((x) => x.id === id), body = text(raw, PHOMO_BOUNDS.text);
      if (dead || !n || !body) return { ok: false, error: 'bad' };
      n.text = body; n.editedAt = now(); save(); return { ok: true };
    },
    notes({ coin = null, traderKey = null, parentKey = null } = {}) {
      const key = coin === null ? null : keyOf(coin);
      return prefs.notes.filter((n) => (!key || n.coinKey === key) && (!traderKey || n.traderKey === traderKey)
        && (!parentKey || n.parentKey === parentKey)).map((n) => ({ ...n, coin: resolve(n.coinKey) })).reverse();
    },
    addAlert({ coin, metric = 'price', direction = 'above', valueUsd } = {}) {
      const key = keyOf(coin);
      if (!key || !['price', 'marketCap'].includes(metric) || !['above', 'below'].includes(direction)
        || !fin(valueUsd) || valueUsd <= 0 || valueUsd > 1e15) return { ok: false, error: 'bad' };
      if (prefs.alerts.filter((a) => a.active).length >= PHOMO_BOUNDS.alerts) return { ok: false, error: 'full' };
      const alert = { id: nextId('alert'), coinKey: key, metric, direction, valueUsd, active: true, createdAt: now(), firedAt: null };
      prefs.alerts.push(alert);
      save();
      return { ok: true, alert: { ...alert, coin } };
    },
    removeAlert(id) { prefs.alerts = prefs.alerts.filter((a) => a.id !== id); save(); },
    updateAlert(id, patch = {}) {
      const a = prefs.alerts.find((x) => x.id === id);
      if (dead || !a || !patch || typeof patch !== 'object') return { ok: false, error: 'bad' };
      const next = { ...a };
      for (const k of ['metric', 'direction', 'valueUsd']) if (Object.hasOwn(patch, k)) next[k] = patch[k];
      if (Object.hasOwn(patch, 'coin')) next.coinKey = keyOf(patch.coin);
      if (!next.coinKey || !['price', 'marketCap'].includes(next.metric) || !['above', 'below'].includes(next.direction)
        || !fin(next.valueUsd) || next.valueUsd <= 0 || next.valueUsd > 1e15) return { ok: false, error: 'bad' };
      if (typeof patch.active === 'boolean') next.active = patch.active;
      if (patch.rearm === true) {
        next.active = true; next.firedAt = null;
        // A deliberately rearmed rule can notify again, without duplicating any past notification.
        prefs.seen = prefs.seen.filter((key) => key !== a.id);
      }
      Object.assign(a, next); save(); return { ok: true };
    },
    alerts() { return prefs.alerts.map((a) => ({ ...a, coin: resolve(a.coinKey) })); },
    tick() {
      if (dead) return;
      let changed = false;
      const events = socialFeed(market, { solUsd, limit: 300 }).filter((e) => e.q > lastFeed);
      lastFeed = Math.max(lastFeed, market.feedSeq || 0);
      for (const e of events.reverse()) {
        if (!e.traderKey || !prefs.followed.includes(e.traderKey) || prefs.muted.includes(e.traderKey)) continue;
        const f = prefs.traderAlerts;
        if (f.disabled.includes(e.traderKey) || (f.minTradeUsd > 0 && !(e.amountUsd >= f.minTradeUsd))) continue;
        if (f.minPortfolioUsd > 0) {
          const p = getProfiles().find((p0) => p0.key === e.traderKey);
          if (!p || !p.holdings.every((h) => fin(h.valueUsd)) || p.holdings.reduce((s, h) => s + h.valueUsd, 0) < f.minPortfolioUsd) continue;
        }
        if (f.minMarketCapUsd > 0 || f.maxMarketCapUsd !== null) {
          const r = tokenMetrics(market, e.coin, { solUsd });
          if (!r || !fin(r.marketCapUsd) || r.marketCapUsd < f.minMarketCapUsd || (f.maxMarketCapUsd !== null && r.marketCapUsd > f.maxMarketCapUsd)) continue;
        }
        changed = notify({ text: `${e.name} ${e.side === 'buy' ? 'bought' : 'sold'} $${e.ticker} · simulated trader`,
          kind: 'trader', coinKey: keyOf(e.coin), traderKey: e.traderKey, simulated: true }, e.key) || changed;
      }
      for (const a of prefs.alerts) {
        if (!a.active) continue;
        const id = resolve(a.coinKey);
        const r = id === null ? null : tokenMetrics(market, id, { solUsd });
        if (!r || !r.tracked) continue;
        const v = a.metric === 'price' ? r.priceUsd : r.marketCapUsd;
        if (!fin(v) || !(a.direction === 'above' ? v >= a.valueUsd : v <= a.valueUsd)) continue;
        a.active = false;
        a.firedAt = now();
        const metric = a.metric === 'price' ? r.practicePrice ? 'practice-unit price' : 'price' : 'market cap';
        changed = notify({ text: `$${r.ticker} ${metric} is ${a.direction} $${a.valueUsd.toLocaleString('en-US')}`,
          kind: 'price', coinKey: a.coinKey, traderKey: null, simulated: r.simulated }, a.id) || changed;
      }
      if (changed) save();
    },
    notifications({ unreadOnly = false } = {}) {
      return prefs.notifications.filter((n) => !unreadOnly || !n.read).map((n) => ({ ...n, coin: resolve(n.coinKey) })).reverse();
    },
    markRead(id = null) { for (const n of prefs.notifications) if (id === null || n.id === id) n.read = true; save(); },
    copyTrade(event, usdAmount) {
      if (dead || typeof order !== 'function') return { ok: false, error: 'unavailable' };
      const found = typeof event === 'string' ? api.feed({ limit: 100 }).find((e) => e.key === event) : event;
      const result = copyOrderFor(found, usdAmount, solUsd, market);
      if (!result.ok) return result;
      const settings = prefs.slippageMode === 'custom' ? { slippage: prefs.slippage } : {};
      return order({ ...result.request, ...settings });
    },
    destroy() { dead = true; profiles = null; },
  };
  return api;
}
