import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarket } from '../src/games/trenchingsimulator/engine.js';
import { AXIUM_FILTERS, axiumPasses, axiumTrigger } from '../src/games/trenchingsimulator/boards/axium-data.js';
import { Element, installDom, viewModule, chartURL, phomoChartURL, byClass, byLabel, byText } from './helpers/phomo-dom.js';

const { mountAxium } = await import(viewModule(new URL('../src/games/trenchingsimulator/boards/axium.js', import.meta.url), { './gchart.js': chartURL, './phomo-chart.js': phomoChartURL }));
function fixture() {
  installDom();
  const market = createMarket({ seed: 'axium-functional', startSol: 100, solUsd: 200 });
  const host = new Element('main'); document.body.append(host);
  const orders = [], focus = []; let pushes = 0, pops = 0;
  const ctx = { market, solUsd: 200, currency: 'sol', start: 100, settings: () => ({ slippage: .5, priority: 'fast' }),
    order(p) { orders.push(p); return market.order({ ...p, slippage: .5, priority: 'fast' }); },
    openSettings() {}, pushSub() { pushes++; }, popSub() { pops++; }, onCoin(id) { focus.push(id); } };
  const view = mountAxium(host, ctx);
  let now = 0;
  return { market, host, view, orders, focus, label: (s) => byLabel(host, s), cls: (s) => byClass(host, s), text: (s) => byText(host, s),
    refresh() { now += 1000; view.update(now); }, history: () => ({ pushes, pops }) };
}
test('Axium numeric filters use actual units and reject missing live metrics only when constrained', () => {
  assert.equal(AXIUM_FILTERS.length, 14);
  const r = { name: 'Example', ticker: 'EX', age: 120, mc: 50, vol5m: 20, top10: .2, holders: null };
  assert.ok(axiumPasses(r, {}, { age: [1, 3], mc: [10000, 10000], top10: [0, 25] }, 200));
  assert.equal(axiumPasses(r, {}, { holders: [1, null] }, 200), false);
  assert.ok(axiumPasses(r, {}, {}, 200, 'ex'));
  assert.equal(axiumPasses(r, {}, {}, 200, 'different'), false);
});
test('Axium trigger checks distinguish stop, limit and scheduled DCA orders', () => {
  assert.ok(axiumTrigger({ direction: 'above', target: 100 }, 101, 0));
  assert.equal(axiumTrigger({ direction: 'below', target: 100 }, 101, 0), false);
  assert.ok(axiumTrigger({ kind: 'dca', nextAt: 10 }, 1, 10));
  assert.equal(axiumTrigger({ kind: 'dca', nextAt: 10 }, 1, 9), false);
  assert.equal(axiumTrigger({ direction: 'above', target: 100 }, null, 0), false);
});
test('Axium keeps Pulse rows keyed and quick buy places the amount from its own column', () => {
  const f = fixture();
  try {
    const card = f.cls('ax-card'), id = Number(card.dataset.key);
    f.refresh(); assert.equal(f.cls('ax-card'), card);
    f.label('New Pairs quick-buy amount (SOL)').value = '2';
    f.label('New Pairs quick-buy amount (SOL)').fire('input');
    byClass(card, 'ax-quick-buy').click();
    assert.deepEqual(f.orders.at(-1), { coin: id, side: 'buy', sol: 2 });
  } finally { f.view.destroy(); }
});
test('Axium per-column search empties and restores the feed without stale empty messages', () => {
  const f = fixture();
  try {
    const list = f.cls('ax-feed'), search = f.label('Search New Pairs');
    search.value = 'no-match-token-abcdef'; search.fire('input');
    assert.equal(list.children.length, 1); assert.ok(list.textContent.includes('No tokens'));
    search.value = ''; search.fire('input');
    assert.ok(list.children.length > 1); assert.equal(list.textContent.includes('No tokens'), false);
  } finally { f.view.destroy(); }
});
test('Axium watchlist, sorting and filter submission affect visible tokens', () => {
  const f = fixture();
  try {
    const first = f.cls('ax-card'), id = first.dataset.key;
    byClass(first, 'ax-card-star').click();
    f.label('Show watchlist').click();
    assert.equal(f.cls('ax-discover').hidden, false);
    const body = f.cls('ax-discover').querySelector('tbody');
    assert.equal(body.children.length, 1); assert.equal(body.children[0].dataset.key, id);
    f.text('Pulse').click(); f.label('New Pairs filters').click();
    f.label('Minimum Market cap ($)').value = '999999999999';
    f.cls('ax-filter-form').fire('submit');
    assert.ok(f.cls('ax-feed').textContent.includes('No tokens'));
  } finally { f.view.destroy(); }
});
test('Axium token view uses candles, routes buy/sell and restores coin focus on back', () => {
  const f = fixture();
  try {
    const id = Number(f.cls('ax-card').dataset.key);
    f.view.openCoin(id); assert.equal(f.view.sub(), true); assert.deepEqual(f.history(), { pushes: 1, pops: 0 });
    assert.ok(globalThis.__phomoChart.sets.at(-1).candles.length);
    f.label('Buy amount (SOL)').value = '1'; f.cls('ax-ticket').fire('submit');
    assert.deepEqual(f.orders.at(-1), { coin: id, side: 'buy', sol: 1 });
    f.text('Sell').click(); f.label('Sell percentage').value = '25'; f.cls('ax-ticket').fire('submit');
    assert.deepEqual(f.orders.at(-1), { coin: id, side: 'sell', frac: .25 });
    f.label('1m candles').click(); assert.equal(globalThis.__phomoChart.sets.at(-1).tf, 60);
    f.label('Trend line').click(); assert.equal(globalThis.__phomoChart.tool, 'trend');
    f.label('Logarithmic scale').click(); assert.equal(globalThis.__phomoChart.scale, 'log');
    f.label('Chart style').value = 'line'; f.label('Chart style').fire('change'); assert.equal(globalThis.__phomoChart.style, 'line');
    f.label('Back to Pulse').click(); assert.equal(f.view.sub(), false); assert.equal(f.focus.at(-1), null); assert.deepEqual(f.history(), { pushes: 1, pops: 1 });
    assert.equal(globalThis.__phomoChart.destroyed, true);
  } finally { f.view.destroy(); }
});
test('Axium trigger orders execute through the account and can be canceled before execution', () => {
  const f = fixture();
  try {
    const id = Number(f.cls('ax-card').dataset.key); f.view.openCoin(id);
    f.text('Limit').click(); f.label('Buy amount (SOL)').value = '1';
    f.label('Target market cap ($)').value = String(f.market.row(id).mc * 200 * 2);
    f.cls('ax-ticket').fire('submit');
    assert.equal(f.orders.length, 0); f.refresh(); assert.equal(f.orders.length, 1);
    f.cls('ax-ticket').fire('submit'); f.text('Cancel').click(); f.refresh(); assert.equal(f.orders.length, 1);
    f.text('DCA').click(); f.label('Buy amount (SOL)').value = '0.2';
    f.label('DCA order count').value = '3'; f.label('DCA interval (seconds)').value = '5';
    f.cls('ax-ticket').fire('submit'); f.refresh(); assert.equal(f.orders.length, 2);
    f.refresh(); assert.equal(f.orders.length, 2, 'A repeated wall-clock refresh does not accelerate market-clock DCA');
  } finally { f.view.destroy(); }
});
test('Axium tracker and portfolio tabs render actual market data without shape errors', () => {
  const f = fixture();
  try {
    f.text('Trackers').click(); assert.ok(f.cls('ax-tracker-wallets').children.length > 0);
    const follow = f.cls('ax-tracker-wallets').querySelector('button'); follow.click(); assert.equal(follow.textContent, 'Tracking');
    f.text('Portfolio').click(); assert.ok(f.cls('ax-portfolio').textContent.includes('Available balance'));
    f.text('History').click(); f.refresh(); assert.ok(f.cls('ax-portfolio').textContent.includes('No orders yet'));
  } finally { f.view.destroy(); }
});
