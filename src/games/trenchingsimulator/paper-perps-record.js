// Explicit export schema for public-mark paper trades. Never carries account callbacks or source payloads.
const pick = (row, keys) => Object.fromEntries(keys.map(key => [key, row[key] ?? null]));
const orderFields = ['id', 't', 'coin', 'side', 'kind', 'status', 'notional', 'leverage', 'limitPrice', 'tp', 'sl', 'slices', 'durationMs', 'filledSlices', 'remainingNotional'];
const fillFields = ['id', 't', 'position', 'order', 'coin', 'side', 'type', 'price', 'notional', 'quantity', 'fee', 'realized', 'returned', 'fraction'];
const positionFields = ['id', 'coin', 'side', 'leverage', 'quantity', 'margin', 'entry', 'mark', 'tp', 'sl', 'unrealized', 'equity', 'liquidationPrice', 'stale'];
const summaryFields = ['placed', 'filled', 'failed', 'realized', 'unrealized', 'fees', 'equity'];
export function capturePaperPerps(run) {
  const source = run.paperPerpsRecord?.(); if (!source?.placed) return null;
  return { ...pick(source, summaryFields), orders: source.orders.slice(-300).map(o => pick(o, orderFields)),
    fills: source.fills.slice(-300).map(o => pick(o, fillFields)), positions: source.positions.slice(0, 20).map(p => pick(p, positionFields)) };
}
const finite = n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1e100;
const nonnegative = n => finite(n) && n >= 0;
const id = n => Number.isSafeInteger(n) && n > 0;
const fields = (row, list) => row && typeof row === 'object' && !Array.isArray(row) && Object.keys(row).length === list.length && list.every(k => Object.hasOwn(row, k));
const nullablePrice = n => n === null || finite(n) && n > 0;
const coin = c => typeof c === 'string' && /^(?:[a-z][a-z0-9-]{0,19}:)?[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(c);
const side = s => ['long', 'short'].includes(s);
const rows = (value, cap, check) => Array.isArray(value) && value.length <= cap && value.every(check) && new Set(value.map(r => r.id)).size === value.length;
const ordered = value => value.every((r, i) => !i || r.t >= value[i - 1].t);
export function validPaperPerps(record, duration) {
  if (!fields(record, [...summaryFields, 'orders', 'fills', 'positions']) || !summaryFields.every(k => finite(record[k]))
    || !['placed', 'filled', 'failed'].every(k => Number.isSafeInteger(record[k]) && record[k] >= 0) || record.placed < 1
    || record.fees < 0 || record.equity < 0) return false;
  const timed = row => finite(row.t) && row.t >= 0 && row.t <= duration;
  if (!rows(record.orders, 300, o => fields(o, orderFields) && id(o.id) && timed(o) && coin(o.coin) && side(o.side)
    && ['market', 'limit', 'twap'].includes(o.kind) && ['pending', 'partial', 'filled', 'cancelled', 'run_ended'].includes(o.status)
    && finite(o.notional) && o.notional >= 1 && o.notional <= 1e9 && Number.isInteger(o.leverage) && o.leverage >= 1 && o.leverage <= 100
    && ['limitPrice', 'tp', 'sl'].every(k => nullablePrice(o[k])) && (o.kind !== 'limit' || o.limitPrice > 0)
    && Number.isInteger(o.slices) && o.slices >= 1 && o.slices <= 60 && Number.isInteger(o.filledSlices) && o.filledSlices >= 0 && o.filledSlices <= o.slices
    && nonnegative(o.durationMs) && o.durationMs <= 86400000 && nonnegative(o.remainingNotional) && o.remainingNotional <= o.notional) || !ordered(record.orders)) return false;
  if (!rows(record.fills, 300, f => fields(f, fillFields) && id(f.id) && id(f.position) && id(f.order) && timed(f) && coin(f.coin) && side(f.side)
    && ['open', 'close', 'take_profit', 'stop_loss', 'liquidation'].includes(f.type) && finite(f.price) && f.price > 0
    && ['notional', 'quantity', 'fee'].every(k => nonnegative(f[k])) && (f.realized === null || finite(f.realized))
    && (f.returned === null || nonnegative(f.returned)) && (f.fraction === null || finite(f.fraction) && f.fraction > 0 && f.fraction <= 1)) || !ordered(record.fills)) return false;
  return rows(record.positions, 20, p => fields(p, positionFields) && id(p.id) && coin(p.coin) && side(p.side)
    && Number.isInteger(p.leverage) && p.leverage >= 1 && p.leverage <= 100 && ['quantity', 'margin', 'entry', 'mark', 'equity', 'liquidationPrice'].every(k => nonnegative(p[k]))
    && finite(p.unrealized) && nullablePrice(p.tp) && nullablePrice(p.sl) && typeof p.stale === 'boolean');
}
