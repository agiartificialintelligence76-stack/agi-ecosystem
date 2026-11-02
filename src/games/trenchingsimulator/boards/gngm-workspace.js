// Scanner controls are local to a run. These selectors never mutate market rows or invent unknown live metrics.
export function scannerRows(rows, { query = '', hidden = new Set(), watched = new Set(), showHidden = false,
  onlyWatched = false } = {}) {
  const words = String(query).toLowerCase().split(',').map((s) => s.trim()).filter(Boolean).slice(0, 5);
  return (Array.isArray(rows) ? rows : []).filter((row) => row && (showHidden ? hidden.has(row.id) : !hidden.has(row.id))
    && (!onlyWatched || watched.has(row.id))
    && (!words.length || words.some((word) => `${row.ticker || ''} ${row.name || ''}`.toLowerCase().includes(word))));
}

export function toggleScannerItem(set, id) {
  if (!Number.isInteger(id) || id < 0) return false;
  if (set.has(id)) { set.delete(id); return false; }
  set.add(id); return true;
}

export function scannerFlow(stats) {
  const buys = stats && Number.isFinite(stats.buys5m) ? stats.buys5m : null;
  const sells = stats && Number.isFinite(stats.sells5m) ? stats.sells5m : null;
  return { buys, sells, fraction: buys !== null && sells !== null && buys + sells > 0 ? buys / (buys + sells) : null };
}

export function makeScannerDca({ coin, sol, count, interval, now }) {
  if (!Number.isInteger(coin) || coin < 0 || !Number.isFinite(sol) || !Number.isInteger(count)
    || count < 2 || count > 20 || sol / count < .001 || !Number.isFinite(interval) || interval < 2 || interval > 3600
    || !Number.isFinite(now)) return null;
  return { kind: 'dca', coin, side: 'buy', sol: sol / count, total: sol, count, remaining: count, interval, next: now };
}

export function stepScannerDca(order, now, place) {
  if (!order || order.kind !== 'dca' || order.remaining < 1 || now < order.next) return order;
  const result = place({ coin: order.coin, side: 'buy', sol: order.sol });
  if (!result || !result.ok) return { ...order, remaining: 0, error: result?.error || 'failed' };
  // A suspended tab never sends a burst of overdue orders; one slice starts a new interval.
  return { ...order, remaining: order.remaining - 1, next: now + order.interval };
}
