// Isolated, play-money perpetual positions. No network, wallet, timer or browser state.
// The run owns one collateral account; quoted marks never become spendable cash until settlement.
export const PAPER_PERPS = Object.freeze({ feeRate: .0005, maintenanceRate: .005, quoteAgeMs: 30000,
  positions: 20, pending: 40, history: 300, slices: 60, maxNotional: 1e9, maxLeverage: 100 });
const finite = n => typeof n === 'number' && Number.isFinite(n);
const positive = n => finite(n) && n > 0;
const clone = value => JSON.parse(JSON.stringify(value));
const sideSign = side => side === 'long' ? 1 : -1;
const coinOK = value => typeof value === 'string' && /^(?:[a-z][a-z0-9-]{0,19}:)?[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(value);

export function createPaperPerps({ account, now = Date.now, isOpen = () => true, key = 'phomo-perps' } = {}) {
  const quotes = new Map(), positions = new Map(), pending = new Map(), records = [], fills = [], listeners = new Set();
  let seq = 0, fillSeq = 0, dead = false, fees = 0, realized = 0, failed = 0, revision = 0;
  let closedWins = 0, closedLosses = 0, best = null, worst = null;
  const traded = new Set();
  const score = (p, total) => ({ id: p.id, ticker: p.coin, total, pnlPct: total / Math.max(1e-12, p.invested) });
  const time = () => Math.max(0, Number(now()) || 0);
  const available = () => { const value = account?.available?.(); return Math.max(0, finite(value) ? value : 0); };
  const fresh = coin => { const q = quotes.get(coin); return q && time() - q.at <= PAPER_PERPS.quoteAgeMs && q.at <= time() + 5000 ? q : null; };
  const priceOf = p => quotes.get(p.coin)?.price || p.entry;
  const gross = (p, price = priceOf(p)) => sideSign(p.side) * p.quantity * (price - p.entry);
  const exitFee = (p, price = priceOf(p)) => Math.min(Math.max(0, p.margin + gross(p, price)), p.quantity * price * PAPER_PERPS.feeRate);
  const positionEquity = p => Math.max(0, p.margin + gross(p) - exitFee(p));
  const reserved = () => [...pending.values()].reduce((sum, o) => sum + o.remainingMargin + o.remainingFee, 0);
  const equity = () => reserved() + [...positions.values()].reduce((sum, p) => sum + positionEquity(p), 0);
  const sync = () => account?.mark?.(key, equity(), { feesUsd: fees });
  const emit = () => { revision++; for (const fn of [...listeners]) fn(); };
  const result = (error) => ({ ok: false, error });
  const canTrade = () => !dead && Boolean(account?.reserve && account?.mark && account?.settle) && isOpen();
  const liquidation = p => Math.max(0, p.side === 'long'
    ? (p.quantity * p.entry - p.margin) / (p.quantity * (1 - PAPER_PERPS.maintenanceRate))
    : (p.quantity * p.entry + p.margin) / (p.quantity * (1 + PAPER_PERPS.maintenanceRate)));
  function event(type, p, notional, price, fee, extra = {}) {
    fills.push({ id: ++fillSeq, type, position: p.id, order: p.order, coin: p.coin, side: p.side,
      at: time(), price, notional, quantity: notional / price, fee, ...extra });
    if (fills.length > PAPER_PERPS.history) fills.shift();
  }
  function validate(input) {
    if (!canTrade()) return result('free_only');
    if (!input || !coinOK(input.coin) || !['long', 'short'].includes(input.side)
      || !['market', 'limit', 'twap'].includes(input.kind)) return result('invalid');
    const q = fresh(input.coin); if (!q) return result('stale');
    const notional = Number(input.notional), leverage = Number(input.leverage);
    if (!positive(notional) || notional < 1 || notional > PAPER_PERPS.maxNotional) return result('size');
    if (!Number.isInteger(leverage) || leverage < 1 || leverage > Math.min(PAPER_PERPS.maxLeverage, q.maxLeverage)) return result('leverage');
    const limitPrice = input.kind === 'limit' ? Number(input.limitPrice) : null;
    if (input.kind === 'limit' && !positive(limitPrice)) return result('limit');
    const reference = limitPrice || q.price;
    const tp = input.tp === '' || input.tp == null ? null : Number(input.tp);
    const sl = input.sl === '' || input.sl == null ? null : Number(input.sl);
    if (tp !== null && (!positive(tp) || (input.side === 'long' ? tp <= reference : tp >= reference))) return result('protection');
    if (sl !== null && (!positive(sl) || (input.side === 'long' ? sl >= reference : sl <= reference))) return result('protection');
    const slices = input.kind === 'twap' ? Number(input.slices ?? 6) : 1;
    const durationMs = input.kind === 'twap' ? Number(input.durationMs ?? 60000) : 0;
    if (!Number.isInteger(slices) || slices < 1 || slices > PAPER_PERPS.slices
      || input.kind === 'twap' && (slices < 2 || !finite(durationMs) || durationMs < 10000 || durationMs > 86400000)) return result('twap');
    const margin = notional / leverage, fee = notional * PAPER_PERPS.feeRate;
    if (!finite(margin + fee) || margin + fee > available() + 1e-8) return result('balance');
    return { ok: true, coin: input.coin, side: input.side, kind: input.kind, notional, leverage, limitPrice, tp, sl,
      margin, fee, slices, durationMs, liquidationPrice: liquidation({ side: input.side, quantity: notional / reference, entry: reference, margin }) };
  }
  function fill(o, q) {
    const last = o.filledSlices + 1 === o.slices;
    const notional = last ? o.remainingNotional : o.notional / o.slices;
    const margin = last ? o.remainingMargin : o.margin / o.slices;
    const fee = last ? o.remainingFee : o.fee / o.slices;
    let p = positions.get(o.id);
    if (!p) { p = { id: o.id, order: o.id, coin: o.coin, side: o.side, leverage: o.leverage, quantity: 0,
      margin: 0, entry: q.price, entryFees: 0, invested: 0, realized: 0, tp: o.tp, sl: o.sl, openedAt: time() }; positions.set(p.id, p); }
    const quantity = notional / q.price, total = p.quantity + quantity;
    p.entry = (p.entry * p.quantity + notional) / total; p.quantity = total;
    p.margin += margin; p.entryFees += fee; fees += fee;
    p.invested += margin + fee; traded.add(p.coin);
    o.remainingNotional = Math.max(0, o.remainingNotional - notional);
    o.remainingMargin = Math.max(0, o.remainingMargin - margin); o.remainingFee = Math.max(0, o.remainingFee - fee);
    o.filledSlices++; o.status = last ? 'filled' : 'partial'; o.filledAt = time();
    o.nextAt = time() + o.durationMs / Math.max(1, o.slices - 1);
    if (last) pending.delete(o.id);
    event('open', p, notional, q.price, fee); sync();
  }
  function cancelOrder(id, reason = 'cancelled') {
    const o = pending.get(id); if (!o) return result('missing');
    const returned = o.remainingMargin + o.remainingFee;
    pending.delete(id); o.status = reason; o.closedAt = time(); o.remainingMargin = o.remainingFee = o.remainingNotional = 0;
    account.settle(key, returned, { remainingEquityUsd: equity(), feesUsd: fees, realizedUsd: realized });
    return { ok: true, returned };
  }
  function closePosition(id, fraction = 1, reason = 'close', quote = null) {
    const p = positions.get(id), q = quote || fresh(p?.coin);
    if (!p) return result('missing');
    if (!q) return result('stale');
    if (!finite(fraction) || fraction <= 0 || fraction > 1) return result('fraction');
    // A close stops this position's remaining TWAP slices, so it cannot reopen itself later.
    if (pending.has(id)) cancelOrder(id);
    const quantity = p.quantity * fraction, margin = p.margin * fraction, entryFees = p.entryFees * fraction;
    const pnl = sideSign(p.side) * quantity * (q.price - p.entry);
    const fee = Math.min(Math.max(0, margin + pnl), quantity * q.price * PAPER_PERPS.feeRate);
    const returned = Math.max(0, margin + pnl - fee), net = returned - margin - entryFees;
    fees += fee; realized += net;
    event(reason, p, quantity * q.price, q.price, fee, { realized: net, returned, fraction });
    p.realized += net;
    if (fraction === 1) {
      const result = score(p, p.realized); if (result.total > 0) closedWins++; else closedLosses++;
      if (!best || result.total > best.total) best = result; if (!worst || result.total < worst.total) worst = result;
      positions.delete(id);
    } else { p.quantity -= quantity; p.margin -= margin; p.entryFees -= entryFees; }
    account.settle(key, returned, { remainingEquityUsd: equity(), feesUsd: fees, realizedUsd: realized });
    return { ok: true, returned, realized: net };
  }
  function process() {
    if (!canTrade()) return false;
    let changed = false;
    function riskExit(p, q) {
      const maintenance = p.quantity * q.price * PAPER_PERPS.maintenanceRate;
      const liquidated = p.margin + gross(p, q.price) <= maintenance;
      const stop = p.sl !== null && (p.side === 'long' ? q.price <= p.sl : q.price >= p.sl);
      const target = p.tp !== null && (p.side === 'long' ? q.price >= p.tp : q.price <= p.tp);
      if (!liquidated && !stop && !target) return false;
      closePosition(p.id, 1, liquidated ? 'liquidation' : stop ? 'stop_loss' : 'take_profit', q); return true;
    }
    // Existing risk exits are evaluated before new orders at the same observed mark.
    for (const p of [...positions.values()]) {
      const q = fresh(p.coin); if (!q) continue;
      if (riskExit(p, q)) changed = true;
    }
    for (const o of [...pending.values()]) {
      const q = fresh(o.coin); if (!q) continue;
      if (o.kind === 'limit' && !(o.side === 'long' ? q.price <= o.limitPrice : q.price >= o.limitPrice)) continue;
      if (o.kind === 'twap' && time() < o.nextAt) continue;
      fill(o, q); changed = true;
      // A gap may already have crossed this order's protection. Use the same observed
      // executable mark for the close, never the skipped limit or stop price.
      const position = positions.get(o.id); if (position) riskExit(position, q);
    }
    sync(); return changed;
  }
  return {
    preview: validate,
    submit(input) {
      const v = validate(input); if (!v.ok) return v;
      if (positions.size + [...pending.values()].filter(o => !positions.has(o.id)).length >= PAPER_PERPS.positions
        || pending.size >= PAPER_PERPS.pending) return result('capacity');
      if (!account.reserve(key, v.margin + v.fee)) return result('balance');
      const o = { ...v, id: ++seq, at: time(), status: 'pending', filledSlices: 0, remainingNotional: v.notional,
        remainingMargin: v.margin, remainingFee: v.fee, nextAt: time() };
      delete o.ok; pending.set(o.id, o); records.push(o);
      if (records.length > PAPER_PERPS.history) { const i = records.findIndex(r => !pending.has(r.id)); if (i >= 0) records.splice(i, 1); }
      process(); emit(); return { ok: true, id: o.id };
    },
    observeMarkets(rows, { at, stale = false } = {}) {
      if (dead || stale || !finite(at) || at > time() + 5000 || time() - at > PAPER_PERPS.quoteAgeMs) return false;
      let changed = false;
      for (const row of (Array.isArray(rows) ? rows : []).slice(0, 1000)) {
        const price = positive(row?.mark) ? row.mark : row?.price;
        if (!coinOK(row?.coin) || !positive(price) || price < 1e-12 || price > 1e15 || !positive(row.leverage) || row.leverage < 1) continue;
        if (quotes.get(row.coin)?.at > at) continue;
        quotes.set(row.coin, { price, at, maxLeverage: Math.min(PAPER_PERPS.maxLeverage, Math.floor(row.leverage)) }); changed = true;
      }
      while (quotes.size > 2000) { const unused = [...quotes.keys()].find(coin => ![...positions.values(), ...pending.values()].some(p => p.coin === coin)); if (!unused) break; quotes.delete(unused); }
      if (changed) { process(); emit(); } return changed;
    },
    advance() { if (process()) emit(); },
    cancel(id) { if (!canTrade()) return result('free_only'); const r = cancelOrder(id); if (r.ok) emit(); return r; },
    close(id, fraction = 1) { if (!canTrade()) return result('free_only'); const r = closePosition(id, fraction); if (r.ok) emit(); return r; },
    updateProtection(id, { tp = null, sl = null } = {}) {
      if (!canTrade()) return result('free_only'); const p = positions.get(id), q = fresh(p?.coin);
      if (!p) return result('missing'); if (!q) return result('stale');
      const target = tp === '' || tp == null ? null : Number(tp), stop = sl === '' || sl == null ? null : Number(sl);
      if (target !== null && (!positive(target) || (p.side === 'long' ? target <= q.price : target >= q.price))
        || stop !== null && (!positive(stop) || (p.side === 'long' ? stop >= q.price : stop <= q.price))) return result('protection');
      p.tp = target; p.sl = stop; emit(); return { ok: true };
    },
    snapshot() {
      const list = [...positions.values()].map(p => ({ ...p, mark: priceOf(p), unrealized: positionEquity(p) - p.margin - p.entryFees, equity: positionEquity(p),
        liquidationPrice: liquidation(p), stale: !fresh(p.coin) }));
      let wins = closedWins, losses = closedLosses, bestTrade = best, worstTrade = worst;
      for (const p of list) { const result = score(p, p.realized + p.unrealized); if (result.total > 0) wins++; else losses++;
        if (!bestTrade || result.total > bestTrade.total) bestTrade = result; if (!worstTrade || result.total < worstTrade.total) worstTrade = result; }
      return clone({ revision, available: available(), canTrade: canTrade(), placed: seq, filled: fillSeq, failed, realized,
        wins, losses, best: bestTrade, worst: worstTrade, markets: traded.size,
        unrealized: list.reduce((sum, p) => sum + p.unrealized, 0), fees, equity: equity(), reserved: reserved(),
        positions: list, pending: [...pending.values()], orders: records, fills,
        neededMarkets: [...new Set([...positions.values(), ...pending.values()].map(p => p.coin))] });
    },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    // Ending a run cancels unfilled slices and releases their reservation. Positions retain their last
    // observed valuation for the result; destroying a panel must never call this run-owned method.
    destroy() { if (dead) return; for (const id of [...pending.keys()]) cancelOrder(id, 'run_ended'); sync(); dead = true; listeners.clear(); },
  };
}
