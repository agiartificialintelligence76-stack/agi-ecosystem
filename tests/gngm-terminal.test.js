import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scannerRows, toggleScannerItem, scannerFlow, makeScannerDca, stepScannerDca } from '../src/games/trenchingsimulator/boards/gngm-workspace.js';
import { createMarket } from '../src/games/trenchingsimulator/engine.js';
import { Element, installDom, viewModule, chartURL, byClass, byLabel, byText, nodes } from './helpers/phomo-dom.js';

const { mountCoin } = await import(viewModule(new URL('../src/games/trenchingsimulator/boards/gngm-coin.js', import.meta.url), { './gchart.js': chartURL }));

test('GNGM keyword, hidden and watched views preserve identity and unknown live metrics', () => {
  const rows = [{ id: 1, ticker: 'FROG', name: 'Blue Frog', holders: null, live: true }, { id: 2, ticker: 'CAT', name: 'Cloud Cat' }];
  const hidden = new Set(), watched = new Set();
  assert.equal(toggleScannerItem(watched, 1), true); assert.equal(toggleScannerItem(hidden, 2), true);
  assert.deepEqual(scannerRows(rows, { hidden, watched, onlyWatched: true, query: 'blue, dog' }), [rows[0]]);
  assert.equal(scannerRows(rows, { hidden })[0], rows[0]); assert.equal(rows[0].holders, null);
  assert.deepEqual(scannerRows(rows, { hidden, showHidden: true }), [rows[1]]);
  assert.equal(toggleScannerItem(hidden, 2), false); assert.deepEqual(scannerRows(rows, { hidden }), rows);
  assert.equal(toggleScannerItem(watched, NaN), false); assert.equal(watched.size, 1);
  assert.deepEqual(scannerFlow({ buys5m: null, sells5m: 0 }), { buys: null, sells: 0, fraction: null });
  assert.equal(scannerFlow({ buys5m: 3, sells5m: 1 }).fraction, .75);
});

test('GNGM DCA uses simulator fills at the chosen cadence, finishes its total, and never bursts on resume', () => {
  const m = createMarket({ seed: 'gngm-dca', startSol: 10, config: { slippage: 1, priority: 'ultra' } });
  const id = m.lists().migrated[0]?.id ?? m.lists().new[0].id;
  let o = makeScannerDca({ coin: id, sol: .3, count: 3, interval: 2, now: m.t });
  const calls = [];
  const place = (input) => { calls.push(input); return m.order(input); };
  o = stepScannerDca(o, 0, place); assert.equal(o.remaining, 2);
  m.advanceTo(1); o = stepScannerDca(o, 1, place); assert.equal(calls.length, 1);
  m.advanceTo(2); o = stepScannerDca(o, 2, place); assert.equal(o.remaining, 1);
  m.advanceTo(30); o = stepScannerDca(o, 30, place); assert.equal(calls.length, 3); assert.equal(o.remaining, 0);
  m.advanceTo(31); assert.equal(m.orders().filter((x) => x.status === 'filled').length, 3);
  assert.ok(Math.abs(calls.reduce((sum, x) => sum + x.sol, 0) - .3) < 1e-12);
  let resumed = makeScannerDca({ coin: id, sol: 1, count: 5, interval: 10, now: 0 });
  resumed = stepScannerDca(resumed, 300, () => ({ ok: true }));
  assert.equal(resumed.remaining, 4); assert.equal(resumed.next, 310);
  resumed = stepScannerDca(resumed, 310, () => ({ ok: false, error: 'funds' }));
  assert.equal(resumed.remaining, 0); assert.equal(resumed.error, 'funds');
  assert.equal(makeScannerDca({ coin: id, sol: .001, count: 20, interval: 10, now: 0 }), null);
});

test('GNGM phone Sell exits the desktop buy-only DCA ticket and submits a sell', () => {
  installDom();
  Object.defineProperty(Element.prototype, 'parentElement', { configurable: true, get() { return this.parentNode; } });
  Element.prototype.prepend = function (...children) { for (const child of children.reverse()) this.insertBefore(child, this.firstChild); };
  const market = createMarket({ seed: 'gngm-phone-sell', startSol: 10, config: { slippage: 1, priority: 'ultra' } });
  const id = market.lists().migrated[0]?.id ?? market.lists().new[0].id;
  const schedules = [], submitted = [], phone = { matches: false };
  const order = p => { submitted.push(p); return market.order(p); };
  const ctx = { start: 10, settings: () => ({ slippage: 1, priority: 'ultra' }), order };
  const coin = mountCoin({ ctx, market, M: String, MN: String, MS: String, mc: String,
    U: { id: 'sol', name: 'SOL', per: 1 }, isUsd: false, px: 150, orderError: String, phone, coarse: { matches: true },
    info: id => market.info(id), statsOf: id => market.stats(id), smartIndexOf: () => null, openWallet() {}, shareCard() {}, close() {}, openSettings() {},
    limits: { add: o => schedules.push({ ...o, id: schedules.length + 1 }), cancel() {}, of: id => schedules.filter(o => o.coin === id), autoOf: () => null, setAuto() {} } });
  document.body.append(coin.el);
  try {
    coin.open(id); byText(coin.el, 'DCA').click();
    byLabel(coin.el, 'Amount in SOL').value = '.03';
    byLabel(coin.el, 'DCA number of buys').value = '3'; byLabel(coin.el, 'DCA seconds between buys').value = '2';
    byClass(coin.el, 'tsg-place').click(); assert.equal(schedules.length, 1);
    let schedule = schedules[0];
    for (const t of [0, 2, 4]) { market.advanceTo(t); schedule = stepScannerDca(schedule, market.t, order); }
    market.advanceTo(5); assert.equal(schedule.remaining, 0);
    assert.ok(market.positions().find(p => p.id === id)?.open);
    phone.matches = true; coin.onPhone(true);
    nodes(coin.el).find(n => n.classList.contains('tsg-barbtn') && n.textContent === 'Sell').click();
    assert.equal(byClass(coin.el, 'tsg-sheet').open, true);
    assert.equal(byText(coin.el, 'Market').getAttribute('aria-pressed'), 'true');
    assert.equal(byText(coin.el, 'DCA').getAttribute('aria-pressed'), 'false');
    const sell = nodes(coin.el).find(n => n.classList.contains('tsg-side') && n.textContent === 'Sell');
    assert.equal(sell.disabled, false); assert.equal(sell.getAttribute('aria-pressed'), 'true');
    assert.match(byClass(coin.el, 'tsg-place').textContent, /^Sell /);
    byLabel(coin.el, 'How much of it to sell, in percent').value = '100'; byClass(coin.el, 'tsg-place').click();
    assert.equal(submitted.at(-1).side, 'sell'); assert.equal(submitted.at(-1).frac, 1);
    assert.equal(schedules.length, 1, 'Sell must not create a new buy schedule');
  } finally { coin.destroy(); delete Element.prototype.parentElement; delete Element.prototype.prepend; }
});
