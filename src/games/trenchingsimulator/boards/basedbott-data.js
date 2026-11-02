// BasedBott's session-local automations. Targets are stored in engine SOL units; inputs are converted by the view.
// BasedBot reference: docs.basedbot.app/web-app/webapp/trading and /quick-setup-guide/trading-automations.
// These are conditional practice orders, checked on the market clock, and never operate outside this run.
export function createBasedOrders({ row, order, now, notify = () => {} }) {
  let seq = 0;
  const pending = new Map();
  const history = [];
  const add = (input) => {
    if (!input || !Number.isInteger(input.coin) || !['buy', 'sell', 'alert'].includes(input.side)) return null;
    if (input.side === 'buy' && !(Number.isFinite(input.sol) && input.sol > 0)) return null;
    if (input.side === 'sell' && !(Number.isFinite(input.frac) && input.frac > 0 && input.frac <= 1)) return null;
    const current = row(input.coin);
    if (!current || !(current.mc > 0)) return null;
    const mode = input.mode || 'limit';
    if (!['limit', 'dca', 'trail', 'migration'].includes(mode)) return null;
    if (mode === 'limit' && !(Number.isFinite(input.target) && input.target > 0)) return null;
    if (mode === 'dca' && !(Number.isFinite(input.interval) && input.interval >= 5 && Number.isInteger(input.count) && input.count >= 2 && input.count <= 100)) return null;
    if (mode === 'trail' && !(Number.isFinite(input.drop) && input.drop > 0 && input.drop < 1 && input.side === 'sell')) return null;
    if (mode === 'migration' && (current.phase === 'pool' || input.side !== 'buy')) return null;
    const item = { ...input, mode, id: ++seq, direction: input.target < current.mc ? 'down' : 'up',
      high: current.mc, next: now() + (mode === 'dca' ? input.interval : 0), remaining: input.count || 1, status: 'waiting' };
    pending.set(item.id, item);
    return { ...item };
  };
  const tick = () => {
    for (const item of [...pending.values()]) {
      const r = row(item.coin);
      if (!r) { pending.delete(item.id); continue; }
      item.high = Math.max(item.high, r.mc);
      const hit = item.mode === 'dca' ? now() >= item.next
        : item.mode === 'migration' ? r.phase === 'pool'
          : item.mode === 'trail' ? r.mc <= item.high * (1 - item.drop)
            : item.direction === 'down' ? r.mc <= item.target : r.mc >= item.target;
      if (!hit || (!r.practice && r.phase === 'migrating')) continue;
      const result = item.side === 'alert' ? { ok: true } : order({ coin: item.coin, side: item.side,
        ...(item.side === 'buy' ? { sol: item.sol } : { frac: item.frac }),
        ...(item.slippage == null ? {} : { slippage: item.slippage }), ...(item.priority ? { priority: item.priority } : {}) });
      const status = result?.ok ? item.side === 'alert' ? 'triggered' : 'submitted' : 'failed';
      history.unshift({ ...item, status, at: now(), error: result?.error || null });
      if (history.length > 100) history.length = 100;
      if (result?.ok && item.mode === 'dca' && --item.remaining > 0) item.next = now() + item.interval;
      else pending.delete(item.id);
      notify({ ...item, status, error: result?.error || null }, r);
    }
  };
  return { add, tick, cancel: (id) => pending.delete(id), list: () => [...pending.values()].map(x => ({ ...x })),
    history: () => history.map(x => ({ ...x })), clear: () => pending.clear() };
}

export function basedRows(rows, { sort = 'top', query = '', watched = new Set(), viewed = new Map(),
  blacklist = new Set(), minimum = 0, maximum = Infinity, minHolders = 0, chain = 'all', source = 'all', solUsd = 150 } = {}) {
  const q = query.trim().replace(/^\$/, '').toLowerCase();
  const result = rows.filter(r => !blacklist.has(r.id)
    && (!q || `${r.name} ${r.ticker}`.toLowerCase().includes(q))
    && (chain === 'all' || r.chain === chain || (!r.live && chain === 'simulated'))
    && (source === 'all' || (source === 'simulated' ? !r.live : r.src === source))
    && r.mc * solUsd >= minimum && r.mc * solUsd <= maximum
    && (!minHolders || Number.isFinite(r.holders) && r.holders >= minHolders)
    && (sort !== 'watching' || watched.has(r.id)) && (sort !== 'dexpaid' || r.dexPaid));
  return result.sort((a, b) => (sort === 'new' ? b.born - a.born : sort === 'surge' ? (b.ch5m || 0) - (a.ch5m || 0)
    : sort === 'viewed' ? (viewed.get(b.id) || 0) - (viewed.get(a.id) || 0)
      : sort === 'trending' ? (b.vol5m || 0) - (a.vol5m || 0) : b.mc - a.mc) || b.id - a.id);
}

export function sparklinePath(candles, width = 96, height = 30) {
  const points = candles.slice(-32).map(c => c.c).filter(Number.isFinite);
  if (points.length < 2) return '';
  const low = Math.min(...points), high = Math.max(...points), range = high - low || 1;
  return points.map((v, i) => `${i ? 'L' : 'M'}${(i * width / (points.length - 1)).toFixed(1)},${(height - 2 - (v - low) / range * (height - 4)).toFixed(1)}`).join(' ');
}

// Live token labels are untrusted text. CSV quoting protects delimiters, while the apostrophe
// keeps spreadsheet apps from evaluating a label as a formula. Actual numbers retain their format.
export function basedCsvCell(value) {
  let text = String(value);
  if (typeof value === 'string' && /^[\s\u0000-\u001f\u007f-\u009f]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
