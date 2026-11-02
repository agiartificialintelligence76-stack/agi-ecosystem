import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarket } from '../src/games/trenchingsimulator/engine.js';
import { paintBasedTable } from '../src/games/trenchingsimulator/boards/basedbott-table.js';
import { Element, installDom, viewModule, chartURL, byClass, byLabel, byText } from './helpers/phomo-dom.js';

const { mountBasedbott } = await import(viewModule(new URL('../src/games/trenchingsimulator/boards/basedbott.js', import.meta.url), { './gchart.js': chartURL }));
test('BasedBott table keeps focused actions and scroll containers while values and callbacks update', () => {
  installDom(); const host = new Element('main'); document.body.append(host); const actions = [];
  const paint = (value) => paintBasedTable(host, 'orders', ['Token', 'Amount', 'Action'], [{ id: 12, cells: ['COIN', value,
    { text: 'Cancel', className: 'tbb-cancel', action: () => actions.push(value) }] }]);
  paint('1 SOL'); const wrap = host.firstChild, row = host.querySelector('tbody').firstChild, cancel = row.querySelector('button'); cancel.focus();
  for (let i = 0; i < 40; i++) paint(`${i} SOL`);
  assert.equal(host.firstChild, wrap); assert.equal(host.querySelector('tbody').firstChild, row);
  assert.equal(row.querySelector('button'), cancel); assert.equal(document.activeElement, cancel); assert.ok(cancel.isConnected);
  assert.ok(row.textContent.includes('39 SOL')); cancel.click(); assert.deepEqual(actions, ['39 SOL']);
  paintBasedTable(host, 'orders', ['Token', 'Amount', 'Action'], []);
  assert.equal(host.firstChild, wrap); assert.equal(host.querySelector('tbody').children.length, 0); assert.equal(cancel.isConnected, false);
});
test('BasedBott real order controls survive price refreshes, cancel once, and charts retain their candle array', () => {
  installDom(); document.addEventListener = () => {}; document.removeEventListener = () => {};
  const market = createMarket({ seed: 'basedbott-render', startSol: 10, solUsd: 200 });
  const host = new Element('main'); document.body.append(host); const calls = [];
  const ctx = { market, solUsd: 200, currency: 'sol', start: 10, settings: () => ({ slippage: .5, priority: 'fast' }),
    order: p => { calls.push(p); return market.order(p); }, openSettings() {}, pushSub() {}, popSub() {}, onCoin() {} };
  const view = mountBasedbott(host, ctx);
  try {
    const id = market.lists().new[0].id; view.openCoin(id);
    const chartRows = globalThis.__phomoChart.sets.at(-1).candles;
    const type = byLabel(host, 'Order type'); type.value = 'limit'; type.fire('change');
    byLabel(host, 'Buy amount in SOL').value = '.1';
    byLabel(host, 'Target market cap in USD').value = String(market.row(id).mc * 200 * 100);
    byClass(host, 'tbb-place').click();
    const cancel = byClass(host, 'tbb-cancel'), row = cancel.closest('tr'); cancel.focus();
    for (let now = 250; now <= 2000; now += 250) view.update(now);
    assert.equal(byClass(host, 'tbb-cancel'), cancel); assert.equal(cancel.closest('tr'), row);
    assert.equal(document.activeElement, cancel); assert.ok(cancel.isConnected);
    assert.equal(globalThis.__phomoChart.sets.at(-1).candles, chartRows);
    cancel.click(); assert.equal(byClass(host, 'tbb-cancel'), undefined); assert.equal(calls.length, 0);
    byText(host, 'Trades').click(); const table = byClass(host, 'tbb-coin-table').querySelector('tbody'); const trade = table.firstChild;
    view.update(3000); assert.equal(table.firstChild, trade, 'an unchanged trade row is retained');
  } finally { view.destroy(); }
});
