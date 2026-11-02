// Axium's local terminal controls. Every number is derived from the simulator's market.
export const AXIUM_FILTERS = Object.freeze([
  ['age', 'Age (mins)'], ['top10', 'Top 10 holders (%)'], ['dev', 'Dev holding (%)'],
  ['snipers', 'Snipers (%)'], ['insiders', 'Insiders (%)'], ['bundlers', 'Bundle (%)'],
  ['holders', 'Holders'], ['smart', 'Pro traders'], ['liquidity', 'Liquidity ($)'],
  ['volume', 'Volume ($)'], ['mc', 'Market cap ($)'], ['txns', 'Transactions'],
  ['buys', 'Number of buys'], ['sells', 'Number of sells'],
]);
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const percent = (n) => finite(n) ? n * 100 : null;
export function axiumMetrics(row, stats, px) {
  return { age: finite(row?.age) ? row.age / 60 : null, top10: percent(row?.top10), dev: percent(row?.dev),
    snipers: percent(row?.snipers), insiders: percent(row?.insiders), bundlers: percent(row?.bundlers),
    holders: row?.holders ?? null, smart: stats?.smart ?? null, liquidity: stats?.liqUsd ?? null,
    volume: finite(row?.vol5m) ? row.vol5m * px : null, mc: finite(row?.mc) ? row.mc * px : null,
    txns: row?.txns5m ?? null, buys: stats?.buys5m ?? null, sells: stats?.sells5m ?? null };
}
export function axiumPasses(row, stats, filters, px, query = '') {
  if (!row) return false;
  if (query && !`${row.name} ${row.ticker}`.toLowerCase().includes(query.trim().toLowerCase())) return false;
  const metrics = axiumMetrics(row, stats, px);
  for (const [key, bounds] of Object.entries(filters || {})) {
    if (!Array.isArray(bounds)) continue;
    const [min, max] = bounds;
    if ((finite(min) || finite(max)) && !finite(metrics[key])) return false;
    if (finite(min) && metrics[key] < min) return false;
    if (finite(max) && metrics[key] > max) return false;
  }
  return true;
}
export function axiumTrigger(order, mc, now) {
  if (!finite(mc) || !(mc > 0)) return false;
  if (order.kind === 'dca') return now >= order.nextAt;
  return order.direction === 'above' ? mc >= order.target : mc <= order.target;
}
export function axiumFilterCount(filters) {
  return Object.values(filters || {}).filter((r) => Array.isArray(r) && r.some(finite)).length;
}
