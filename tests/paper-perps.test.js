import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaperPerps, PAPER_PERPS } from '../src/games/trenchingsimulator/paper-perps.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} ≈ ${expected}`);
function fixture(balance = 1000) {
  let now = 100000, cash = balance, marked = 0, feeTotal = 0, open = true;
  const calls = [];
  const account = { available: () => cash, reserve(key, amount) { if (amount > cash) return false; cash -= amount; marked += amount; calls.push(['reserve', amount]); return true; },
    mark(key, value, { feesUsd = 0 } = {}) { marked = value; feeTotal = Math.max(feeTotal, feesUsd); },
    settle(key, returned, { remainingEquityUsd, feesUsd }) { cash += returned; marked = remainingEquityUsd; feeTotal = Math.max(feeTotal, feesUsd); calls.push(['settle', returned]); } };
  const ledger = createPaperPerps({ account, now: () => now, isOpen: () => open });
  const quote = (price = 100, options = {}) => ledger.observeMarkets([{ coin: 'BTC', mark: price, leverage: 40 }], { at: now, ...options });
  quote();
  const order = patch => ledger.submit({ coin: 'BTC', side: 'long', kind: 'market', notional: 1000, leverage: 10, ...patch });
  return { ledger, quote, order, calls, account, get cash() { return cash; }, get total() { return cash + marked; }, get fees() { return feeTotal; },
    tick(ms) { now += ms; ledger.advance(); }, stop() { open = false; }, setCash(value) { cash = value; } };
}

test('paper collateral is shared with spot cash; exact close settles once and books cumulative fees only', () => {
  const f = fixture(), order = f.order(); assert.equal(order.ok, true);
  near(f.cash, 899.5); near(f.total, 999); near(f.fees, .5);
  assert.equal(f.order({ notional: 10000 }).error, 'balance');
  f.quote(110); near(f.ledger.snapshot().unrealized, 98.95); near(f.total, 1098.95);
  const closed = f.ledger.close(order.id); assert.equal(closed.ok, true);
  near(f.cash, 1098.95); near(closed.realized, 98.95); near(f.fees, 1.05);
  assert.equal(f.ledger.close(order.id).error, 'missing'); near(f.cash, 1098.95);
  assert.equal(f.ledger.snapshot().positions.length, 0); assert.equal(f.ledger.snapshot().filled, 2);
});

test('a limit reserves its collateral, fills only on an observed crossing, and cancellation releases unused money', () => {
  const f = fixture(), order = f.order({ kind: 'limit', limitPrice: 90 });
  assert.equal(order.ok, true); assert.equal(f.ledger.snapshot().positions.length, 0); near(f.total, 1000);
  f.quote(95); assert.equal(f.ledger.snapshot().pending.length, 1);
  f.quote(89); const position = f.ledger.snapshot().positions[0]; near(position.entry, 89);
  assert.equal(f.ledger.snapshot().pending.length, 0); assert.equal(f.ledger.cancel(order.id).error, 'missing');
  const pending = f.order({ side: 'short', kind: 'limit', limitPrice: 120 });
  const reservedCash = f.cash; assert.equal(f.ledger.cancel(pending.id).ok, true); near(f.cash, reservedCash + 100.5);
  assert.equal(f.ledger.cancel(pending.id).error, 'missing');
});

test('a gap through a pending limit and its stop fills and exits once at the actual observed mark', () => {
  const f = fixture(); f.order({kind:'limit',limitPrice:90,sl:85}); f.quote(80);
  const s=f.ledger.snapshot(); assert.equal(s.positions.length,0); assert.equal(s.pending.length,0);
  assert.deepEqual(s.fills.map(fill=>[fill.type,fill.price]),[['open',80],['stop_loss',80]]);
  near(s.realized,-1); near(f.total,999); f.tick(1000); assert.equal(f.ledger.snapshot().filled,2);
});

test('TWAP slices are bounded, never burst after a gap, and closing cancels remaining slices', () => {
  const f = fixture(), order = f.order({ kind: 'twap', slices: 4, durationMs: 30000, notional: 400 });
  assert.equal(order.ok, true); assert.equal(f.ledger.snapshot().pending[0].filledSlices, 1);
  f.tick(10000); assert.equal(f.ledger.snapshot().pending[0].filledSlices, 2);
  f.tick(120000); assert.equal(f.ledger.snapshot().pending[0].filledSlices, 2, 'stale prices cannot fill a missed slice');
  f.quote(110); assert.equal(f.ledger.snapshot().pending[0].filledSlices, 3, 'one observed quote does not backfill the missed schedule');
  f.ledger.advance(); assert.equal(f.ledger.snapshot().pending[0].filledSlices, 3);
  assert.equal(f.ledger.close(order.id, .5).ok, true); assert.equal(f.ledger.snapshot().pending.length, 0);
  const quantity = f.ledger.snapshot().positions[0].quantity;
  f.tick(10000); near(f.ledger.snapshot().positions[0].quantity, quantity);
});

test('isolated long and short protective exits act once and liquidation never spends other spot funds', () => {
  const long = fixture(), target = long.order({ tp: 110, sl: 95 });
  long.quote(111); assert.equal(long.ledger.snapshot().positions.length, 0);
  assert.equal(long.ledger.snapshot().fills.at(-1).type, 'take_profit');
  const cash = long.cash; long.quote(112); near(long.cash, cash);
  const short = fixture(); short.order({ side: 'short', tp: 90, sl: 105 }); short.quote(106);
  assert.equal(short.ledger.snapshot().fills.at(-1).type, 'stop_loss');
  const crashed = fixture(); crashed.order(); const outside = crashed.cash; crashed.quote(1);
  assert.equal(crashed.ledger.snapshot().fills.at(-1).type, 'liquidation');
  near(crashed.cash, outside); near(crashed.ledger.snapshot().equity, 0);
  assert.equal(crashed.ledger.close(target.id).error, 'missing');
});

test('paper orders refuse stale/out-of-order prices, invalid protection and inactive runs without touching cash', () => {
  const f = fixture(); f.tick(PAPER_PERPS.quoteAgeMs + 1);
  assert.equal(f.order().error, 'stale'); assert.equal(f.quote(110, { stale: true }), false);
  assert.equal(f.quote(110, { at: 1 }), false); assert.equal(f.quote(100), true);
  assert.equal(f.order({ leverage: 41 }).error, 'leverage'); assert.equal(f.order({ tp: 90 }).error, 'protection');
  assert.equal(f.order({ side: 'short', sl: 95 }).error, 'protection');
  assert.equal(f.order({ kind: 'twap', slices: 10000 }).error, 'twap');
  near(f.cash, 1000); f.stop(); assert.equal(f.order().error, 'free_only'); near(f.cash, 1000);
});

test('protection editing, partial settlement and run cleanup preserve net account totals', () => {
  const f = fixture(), order = f.order();
  assert.equal(f.ledger.updateProtection(order.id, { tp: 115, sl: 97 }).ok, true);
  assert.equal(f.ledger.updateProtection(order.id, { tp: 90 }).error, 'protection');
  f.quote(110); const before = f.total; f.ledger.close(order.id, .25); near(f.total, before);
  f.order({ kind: 'limit', limitPrice: 90 }); const total = f.total;
  f.ledger.destroy(); near(f.total, total); assert.equal(f.ledger.snapshot().pending.length, 0);
  assert.equal(f.ledger.submit({}).error, 'free_only');
  const snapshot = f.ledger.snapshot(); snapshot.positions[0].entry = 1;
  assert.notEqual(f.ledger.snapshot().positions[0].entry, 1);
});
