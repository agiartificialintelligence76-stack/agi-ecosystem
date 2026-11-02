import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarket, PRIORITY } from '../src/games/trenchingsimulator/engine.js';
import { createPhomoState } from '../src/games/trenchingsimulator/boards/phomo-state.js';
import { Element, installDom, coinModuleURL } from './helpers/phomo-dom.js';

const { mountPhomoCoin, coinActivityWindow } = await import(coinModuleURL);

function fixture({ live = false } = {}) {
  installDom();
  const market = createMarket({ seed: 'phomo-coin-smoke', solUsd: 200, startSol: 100, live });
  const id = live ? market.ext.add({ key: '0x1111111111111111111111111111111111111111', name: 'Live Test', ticker: 'LIVE',
    chain: 'base', live: true, real: { phase: 'pool', sol: 100, tok: 1e8, liq: null, estimated: true,
      fee: .003, exact: false, exactPool: false, progress: 1 } }) : market.lists({ limit: 50 }).new.find((r) => r.phase === 'curve').id;
  if (live) market.ext.view({ ext: true, sim: false, simPaused: true });
  const state = createPhomoState(market, { solUsd: 200 });
  const requests = [];
  const host = new Element('main');
  const ctx = { market, solUsd: 200, settings: () => ({ slippage: .2, priority: Object.keys(PRIORITY)[0] }),
    order(p) { requests.push(p); return market.order(p); } };
  const view = mountPhomoCoin(host, ctx, id, { state });
  const nodes = (n = host) => [n, ...n.childNodes.flatMap((x) => nodes(x))];
  const cls = (s) => nodes().find((n) => n.className.split(' ').includes(s));
  const label = (s) => nodes().find((n) => n.getAttribute('aria-label') === s);
  const byText = (s) => nodes().find((n) => n.tagName === 'button' && n.textContent === s);
  const form = () => cls('tspc-order-card').children.find((n) => n.tagName === 'form');
  return { market, id, state, requests, host, ctx, view, nodes, cls, label, byText, form };
}

test('Phomo coin converts dollar buys and partial/full sells through the existing practice engine', () => {
  const f = fixture({ live: true });
  assert.equal(f.label('Buy amount in practice dollars').value, '');
  assert.equal(f.cls('tspc-submit').disabled, true);
  f.byText('$100').fire('click');
  f.form().fire('submit');
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].sol, .5);
  f.market.advance(8); f.view.update(9000);
  const before = f.market.positions().find((p) => p.id === f.id).tokens;
  assert.ok(before > 0);
  f.byText('Sell').fire('click');
  f.label('Percentage of your holding to sell').value = '25';
  f.form().fire('submit');
  assert.equal(f.requests.at(-1).frac, .25);
  f.market.advance(8); f.view.update(18000);
  const after = f.market.positions().find((p) => p.id === f.id).tokens;
  assert.equal(after, before - Math.floor(before * .25));
  f.byText('100%').fire('click'); f.form().fire('submit');
  assert.equal(f.requests.at(-1).frac, 1);
  f.market.advance(8); f.view.update(27000);
  assert.equal(f.market.positions().find((p) => p.id === f.id).tokens, 0);
  assert.ok(f.cls('tspc-submit').disabled);
  f.view.destroy();
  assert.equal(f.host.children.length, 0);
  assert.equal(globalThis.__phomoChart.destroyed, true);
});

test('Phomo coin saves editable presets and custom slippage, rejects invalid settings', () => {
  const f = fixture();
  f.label('Swap settings').fire('click');
  const settingsForm = f.cls('tspc-settings').children.find((n) => n.tagName === 'form');
  f.label('Buy preset 1 in dollars').value = '12';
  f.label('Slippage mode').value = 'custom';
  f.label('Custom slippage percentage').value = '5';
  settingsForm.fire('submit');
  assert.equal(f.state.prefs.buyPresets[0], 12);
  assert.equal(f.state.prefs.slippage, .05);
  assert.equal(f.cls('tspc-settings').open, false);
  f.byText('$12').fire('click'); f.form().fire('submit');
  assert.equal(f.requests.at(-1).sol, .06);
  assert.equal(f.requests.at(-1).slippage, .05);
  f.label('Swap settings').fire('click');
  f.label('Sell preset 1 in percent').value = '101';
  settingsForm.fire('submit');
  assert.equal(f.state.prefs.sellPresets[0], 10);
  assert.equal(f.cls('tspc-settings').open, true);
  f.view.destroy();
});

test('Phomo coin keeps unknown live holders/liquidity/supply blank and removes empty table rows after a buy', () => {
  const f = fixture({ live: true });
  const dlValue = (title) => f.nodes().find((n) => n.tagName === 'dt' && n.textContent === title).parentNode.children[1].textContent;
  assert.equal(dlValue('Holders'), '—');
  assert.equal(dlValue('Top 10'), '—');
  assert.equal(dlValue('Liquidity'), '—');
  assert.equal(dlValue('Supply'), '—');
  assert.ok(f.nodes().some((n) => n.tagName === 'dt' && n.textContent === 'Price · practice unit'));
  assert.ok(f.cls('tspc-table').textContent.includes('No practice positions'));
  f.byText('$100').fire('click'); f.form().fire('submit'); f.market.advance(8); f.view.update(10000);
  assert.ok(!f.cls('tspc-table').textContent.includes('No practice positions'));
  assert.ok(f.cls('tspc-table').textContent.includes('Practice account'));
  assert.ok(!f.cls('tspc-table').textContent.includes('Simulated trader'));
  f.view.destroy();
});

test('Phomo coin thesis, watch, filtering and chart controls retain functional state without inserting markup', () => {
  const f = fixture();
  f.label('Watch token').fire('click');
  assert.equal(f.state.isWatched(f.id), true);
  f.byText('Thesis').fire('click');
  f.label('Your thesis for this coin').value = 'Practice note <script> stays text';
  f.cls('tspc-thesis-form').fire('submit');
  assert.equal(f.state.notes({ coin: f.id })[0].text, 'Practice note <script> stays text');
  assert.ok(f.cls('tspc-thesis-list').textContent.includes('<script> stays text'));
  assert.ok(!f.nodes().some((n) => n.tagName === 'script'));
  f.label('Candle interval').value = '300';
  f.label('Candle interval').fire('change');
  assert.equal(globalThis.__phomoChart.sets.at(-1).tf, 300);
  f.byText('Price').fire('click');
  assert.equal(globalThis.__phomoChart.views.at(-1).mode, 'price');
  f.byText('RSI 14').fire('click');
  assert.deepEqual(globalThis.__phomoChart.indicators, ['rsi']);
  f.view.destroy();
});

test('Phomo keeps focused trader controls mounted as holder values and swap ages change', () => {
  const f=fixture({live:true});
  try {
    f.byText('$100').fire('click'); f.form().fire('submit'); f.market.advance(8); f.view.update(10000);
    const table=f.cls('tspc-table'), holder=table.querySelector('tbody').children[0], trader=holder.children[0].children[0];
    f.market.advance(3); f.view.update(14000);
    assert.equal(table.querySelector('tbody').children[0],holder); assert.equal(holder.children[0].children[0],trader);
    f.byText('Swaps').fire('click');
    const swap=table.querySelector('tbody').children[0], swapTrader=swap.children[0].children[0], oldAge=swap.children[4].textContent;
    f.market.advance(3); f.view.update(18000);
    assert.equal(table.querySelector('tbody').children[0],swap); assert.equal(swap.children[0].children[0],swapTrader);
    assert.notEqual(swap.children[4].textContent,oldAge); assert.equal(f.requests.length,1);
  } finally {f.view.destroy();}
});

test('Phomo token alert and saved chart layout work without submitting a trade', () => {
  const f = fixture();
  try {
    f.label('Candle interval').value = '300'; f.label('Candle interval').fire('change');
    f.byText('Price').fire('click'); f.label('Chart style').value = 'line'; f.label('Chart style').fire('change');
    f.byText('RSI 14').fire('click'); f.label('Save chart layout').fire('click');
    const saved = JSON.parse(localStorage.getItem('trench_phomo_chart_v1'));
    assert.equal(saved.tf, 300); assert.equal(saved.mode, 'price'); assert.equal(saved.style, 'line');
    assert.deepEqual(saved.indicators, ['rsi']);
    f.label('Create token price alert').fire('click');
    f.label('Token alert threshold in dollars').value = '-1';
    const dialog = f.cls('tspc-alert-settings'), form = dialog.querySelector('form');
    form.fire('submit'); assert.equal(f.state.alerts().length, 0); assert.equal(dialog.open, true);
    f.label('Token alert threshold in dollars').value = String(f.market.stats(f.id).price * 220);
    form.fire('submit'); assert.equal(f.state.alerts().length, 1); assert.equal(dialog.open, false);
    assert.equal(f.state.alerts()[0].metric, 'price'); assert.equal(f.requests.length, 0);
    f.view.destroy();
    const host = new Element('main'), reopened = mountPhomoCoin(host, f.ctx, f.id, { state: f.state });
    assert.equal(globalThis.__phomoChart.sets.at(-1).tf, 300);
    assert.equal(globalThis.__phomoChart.style, 'line'); assert.deepEqual(globalThis.__phomoChart.indicators, ['rsi']);
    reopened.destroy();
  } finally { f.view.destroy(); }
});

test('Phomo activity windows never invent directional volume or fill unavailable history', () => {
  const cd = [
    { t: 0, b: 2, s: 1, v: 8, buyVol: 5, sellVol: 3 },
    { t: 100, b: 1, s: 2, v: 7, buyVol: 4, sellVol: 3 },
    { t: 200, b: 1, s: 0, v: 2, buyVol: 2, sellVol: 0 },
  ];
  assert.deepEqual(coinActivityWindow(cd, 200, 300, 0), { buys: 4, sells: 3, volume: 17, buyVolume: 11, sellVolume: 6 });
  assert.deepEqual(coinActivityWindow(cd, 200, 150, 0), { buys: 2, sells: 2, volume: 9, buyVolume: 6, sellVolume: 3 });
  assert.equal(coinActivityWindow(cd.slice(1), 200, 300, 0), null, 'trimmed history does not become a complete longer window');
  const undirected = cd.map(({ buyVol, sellVol, ...bar }) => bar);
  assert.equal(coinActivityWindow(undirected, 200, 300, 0).buyVolume, null);
  assert.equal(coinActivityWindow(undirected, 200, 300, 0).volume, 17);
  assert.equal(coinActivityWindow(cd, 100, 300, 0).volume, 15, 'future bars are excluded');
});

test('Phomo thesis-only holder filter stays local and both following toggles stay synchronized', () => {
  const f = fixture({ live: true });
  try {
    f.byText('$100').fire('click'); f.form().fire('submit'); f.market.advance(8); f.view.update(10000);
    const filter = f.label('Show holders with a thesis only'); filter.checked = true; filter.fire('change');
    assert.ok(f.cls('tspc-table').textContent.includes('No practice positions'));
    f.state.addNote({ coin: f.id, text: 'Local conviction' }); f.view.update(12000);
    assert.ok(f.cls('tspc-table').textContent.includes('Local conviction'));
    const following = f.nodes().filter((n) => n.tagName === 'label' && n.textContent === 'Following only').map((n) => n.firstChild);
    following[0].checked = true; following[0].fire('change');
    assert.equal(following.length, 2); assert.equal(following[1].checked, true); assert.equal(f.requests.length, 1);
  } finally { f.view.destroy(); }
});
