// View-only launchpad selectors. Source rows are never modified and missing live metadata stays unknown.
export const POMP_TABS = Object.freeze([['movers', 'Movers'], ['new', 'New'], ['cap', 'Market cap'], ['oldest', 'Oldest'], ['trades', 'Last trade'], ['watch', 'Watchlist']]);
export function pompRows(market, { tab = 'movers', query = '', watch = new Set(), minCap = 0, maxCap = Infinity,
  minVol = 0, maxVol = Infinity, graduated = false, per = 1, limit = 60 } = {}) {
  const lists = market.lists({ limit: 100 });
  const ids = query.trim() ? market.find(query.trim()) : null;
  const rows = ids ? ids.map(id => market.row(id)).filter(Boolean)
    : [...new Map(['new', 'stretch', 'migrated', 'trending', 'bump'].flatMap(k => lists[k] || []).map(r => [r.id, r])).values()];
  return rows.filter(r => (tab !== 'watch' || watch.has(r.id)) && (!graduated || r.phase === 'pool')
    && r.mc * per >= minCap && r.mc * per <= maxCap && r.vol * per >= minVol && r.vol * per <= maxVol)
    .sort((a, b) => (tab === 'new' ? b.born - a.born : tab === 'oldest' ? a.born - b.born
      : tab === 'cap' ? b.mc - a.mc : tab === 'trades' ? (b.lastTrade ?? -Infinity) - (a.lastTrade ?? -Infinity)
        : (b.vol5m || 0) - (a.vol5m || 0)) || b.id - a.id).slice(0, Math.min(100, Math.max(1, limit)));
}
export function pompRange(value, fallback) {
  const match = /^\s*(\d+(?:\.\d+)?)\s*([km])?\s*$/i.exec(String(value));
  if (!match) return String(value).trim() ? null : fallback;
  const n = Number(match[1]) * (match[2]?.toLowerCase() === 'm' ? 1e6 : match[2]?.toLowerCase() === 'k' ? 1e3 : 1);
  return Number.isFinite(n) ? n : null;
}
export function pompCallouts(market, limit = 16) {
  if (market.live) return [];
  return (market.feed?.() || []).filter(e => e.c !== null && ['kol_buy', 'smart_buy', 'whale_buy', 'migrated', 'koth', 'launch'].includes(e.kind))
    .slice(-limit).reverse().map(e => ({ ...e, coin: market.row(e.c) })).filter(e => e.coin);
}
