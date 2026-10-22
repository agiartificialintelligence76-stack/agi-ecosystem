import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarket, PRIORITY } from '../src/games/trenchingsimulator/engine.js';
import { createPhomoState } from '../src/games/trenchingsimulator/boards/phomo-state.js';
import { Element, installDom, coinModuleURL } from './helpers/phomo-dom.js';

const { mountPhomoCoin } = await import(coinModuleURL);

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
  f.form().fire('submit'); f.market.advance(8); f.view.update(10000);
  assert.ok(!f.cls('tspc-table').textContent.includes('No practice positions'));
  assert.ok(f.cls('tspc-table').textContent.includes('Practice account'));
  assert.ok(!f.cls('tspc-table').textContent.includes('Simulated trader'));
  f.view.destroy();
});

test('Phomo coin thesis, watch, filtering and chart controls retain functional state without inserting markup', () => {
  const f = fixture();
  f.byText('☆ Watch').fire('click');
  assert.equal(f.state.isWatched(f.id), true);
  f.byText('Thesis').fire('click');
  f.label('Your thesis for this coin').value = 'Practice note <script> stays text';
  f.cls('tspc-thesis-form').fire('submit');
  assert.equal(f.state.notes({ coin: f.id })[0].text, 'Practice note <script> stays text');
  assert.ok(f.cls('tspc-thesis-list').textContent.includes('<script> stays text'));
  assert.ok(!f.nodes().some((n) => n.tagName === 'script'));
  f.byText('5m').fire('click');
  assert.equal(globalThis.__phomoChart.sets.at(-1).tf, 300);
  f.byText('Price').fire('click');
  assert.equal(globalThis.__phomoChart.views.at(-1).mode, 'price');
  f.byText('RSI 14').fire('click');
  assert.deepEqual(globalThis.__phomoChart.indicators, ['rsi']);
  f.view.destroy();
});
