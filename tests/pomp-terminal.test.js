import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarket } from '../src/games/trenchingsimulator/engine.js';
import { pompRows, pompRange, pompCallouts } from '../src/games/trenchingsimulator/boards/pomp-data.js';
import { createPompWorkspace } from '../src/games/trenchingsimulator/boards/pomp-view.js';
import { installDom, byLabel, byText, byClass, nodes, Element, viewModule, chartURL } from './helpers/phomo-dom.js';

function fixture(live = false) {
  const rows = [
    { id: 0, name: 'First Coin', ticker: 'FIRST', born: 1, age: 90, mc: 100, vol: 12, vol5m: 2, ch5m: .1, phase: 'curve', txns: 6, holders: live ? null : 3, live },
    { id: 1, name: 'Second Coin', ticker: 'SECOND', born: 5, age: 86, mc: 200, vol: 25, vol5m: 5, ch5m: -.2, phase: 'pool', txns: 10, holders: live ? null : 5, live },
  ];
  return { rows, live, t: 100, lists: () => ({ new: [rows[0]], stretch: [rows[0]], migrated: [rows[1]], trending: rows.slice().reverse() }),
    row: id => rows.find(r => r.id === id), find: q => rows.filter(r => r.name.toLowerCase().includes(q.toLowerCase())).map(r => r.id),
    candles: () => [{ t: 1, c: 3 }, { t: 2, c: 7 }], stats: id => ({ ath: rows[id].mc * 2 }),
    feed: () => [{ q: 1, t: 90, c: 0, kind: 'launch' }], smartWallets: () => [{ n: 0, pnl: 1, upnl: 2, buys: 4, value: 6 }],
  };
}
function harness(live = false) {
  installDom(); const market = fixture(live), opened = [], launches = [];
  const ctx = { solUsd: 2, run: { mode: 'free' }, openSettings() {}, launchCoin: p => { launches.push(p); return { ok: true, id: 0, coin: { id: 0 } }; } };
  const view = createPompWorkspace({ market, ctx, openCoin: id => opened.push(id), openBag() {}, closeCoin() {},
    brand: document.createElement('div'), searchForm: document.createElement('form'), walletBtn: document.createElement('button') });
  const root = document.createElement('div'); root.append(view.rail, view.header, view.watchStrip, view.el, view.coinCalls, ...view.dialogs); document.body.append(root); view.update();
  return { root, view, market, opened, launches };
}

test('Pomp explorer combines all stages without duplicate source mutation and sorts/filters exact source values', () => {
  const m = fixture(); const before = JSON.stringify(m.rows);
  assert.deepEqual(pompRows(m, { tab: 'new' }).map(r => r.id), [1, 0]);
  assert.deepEqual(pompRows(m, { tab: 'oldest' }).map(r => r.id), [0, 1]);
  assert.deepEqual(pompRows(m, { minCap: 300, per: 2 }).map(r => r.id), [1]);
  assert.deepEqual(pompRows(m, { minVol: 20, maxVol: 30 }).map(r => r.id), [1]);
  assert.deepEqual(pompRows(m, { tab: 'watch', watch: new Set([0]) }).map(r => r.id), [0]);
  assert.deepEqual(pompRows(m, { query: 'first', graduated: true }), []);
  assert.equal(JSON.stringify(m.rows), before);
  assert.equal(pompRange('1.5m', 0), 1500000); assert.equal(pompRange('10K', 0), 10000);
  assert.equal(pompRange('', Infinity), Infinity); assert.equal(pompRange('-1', 0), null); assert.equal(pompRange('1<script>', 0), null);
});

test('Pomp preserves active feed nodes, opens coins, maintains watchlists and changes explorer layout', () => {
  const h = harness(); const trend = byClass(h.root, 'pomp-trend-list'), first = trend.firstChild;
  for (let i = 0; i < 100; i++) { h.market.rows[1].mc++; h.view.update(); }
  assert.equal(trend.firstChild, first); first.$.open.click(); assert.deepEqual(h.opened, [1]);
  byLabel(h.root, 'Explore').click();
  const table = byClass(h.root, 'pomp-coin-table'), tbody = table.lastChild, row = tbody.firstChild;
  row.$.star.click(); assert.equal(h.view.state.watch.has(1), true); assert.match(h.view.watchStrip.textContent, /SECOND/);
  byText(h.root, 'Watchlist').click(); assert.equal(tbody.children.length, 1); assert.equal(tbody.firstChild.dataset.key, '1');
  byLabel(h.root, 'grid view').click(); assert.equal(byClass(h.root, 'pomp-cards').children.length, 1);
  h.view.search('First'); assert.match(byClass(h.root, 'pomp-results').textContent, /Star a coin/);
  byText(h.root, 'Movers').click(); assert.equal(byClass(h.root, 'pomp-cards').firstChild.dataset.key, '0');
  h.view.destroy();
});

test('Pomp filter validation blocks reversed ranges and applies valid cap and volume values', () => {
  const h = harness(); byLabel(h.root, 'Explore').click(); byText(h.root, 'Filter').click();
  const dialog = h.view.dialogs[0], form = dialog.querySelector('form');
  byLabel(h.root, 'Minimum market cap').value = '500'; byLabel(h.root, 'Maximum market cap').value = '100';
  form.fire('submit'); assert.equal(dialog.open, true); assert.match(dialog.textContent, /valid minimum/);
  byLabel(h.root, 'Minimum market cap').value = '300'; byLabel(h.root, 'Maximum market cap').value = '1k';
  form.fire('submit'); assert.equal(dialog.open, false);
  assert.equal(byClass(h.root, 'pomp-coin-table').lastChild.children.length, 1);
});

test('Pomp live mode never invents public callouts or trader rankings and keeps missing holders unknown', () => {
  const h = harness(true); assert.deepEqual(pompCallouts(h.market), []);
  assert.match(byClass(h.root, 'pomp-call-list').textContent, /not included/);
  assert.match(byClass(h.root, 'pomp-leader-list').textContent, /Verified profiles will appear/);
  assert.doesNotMatch(h.view.el.textContent, /Trader 1|Launchpad/);
  byLabel(h.root, 'Explore').click(); const row = byClass(h.root, 'pomp-coin-table').lastChild.firstChild;
  assert.equal(row.$.cells[7].textContent, '—');
  byLabel(h.root, 'Create a coin').click(); assert.equal(h.view.dialogs[2].querySelector('form').lastChild.disabled, true);
});

test('Pomp practice create form opens the returned numeric coin ID and remains local', () => {
  const h = harness(); byLabel(h.root, 'Create a coin').click();
  byLabel(h.root, 'Coin name').value = 'Practice Coin'; byLabel(h.root, 'Ticker').value = 'test';
  h.view.dialogs[2].querySelector('form').fire('submit');
  assert.equal(h.launches.length, 1); assert.equal(h.launches[0].ticker, 'TEST'); assert.deepEqual(h.opened, [0]);
  assert.equal(h.view.dialogs[2].open, false);
});

test('Pomp terminal mounts existing market, preserves chart/order/portfolio navigation and tears down cleanly', async () => {
  installDom(); document.addEventListener = () => {}; document.removeEventListener = () => {}; document.querySelector = () => null;
  Element.prototype.prepend = function (...items) { for (const n of items.reverse()) this.insertBefore(n, this.firstChild); };
  Element.prototype.contains = function (n) { return n === this || nodes(this).includes(n); };
  Element.prototype.blur = function () { document.activeElement = null; };
  Element.prototype.removeAttribute = function (k) { delete this.attrs[k]; };
  const mod = await import(viewModule(new URL('../src/games/trenchingsimulator/boards/board.js', import.meta.url), { './gchart.js': chartURL }));
  const market = createMarket({ seed: 42, startSol: 10 }); market.step(60);
  const host = document.createElement('div'); document.body.append(host); let depth = 0;
  const terminal = mod.mountBoard(host, { market, solUsd: 150, currency: 'sol', start: 10, run: { mode: 'free' }, settings: () => ({ slippage: .3, priority: 'normal' }),
    order: p => market.order(p), pushSub: () => depth++, popSub: () => depth--, openSettings() {} });
  const id = market.lists().new[0]?.id ?? market.lists().trending[0].id; terminal.openCoin(id);
  assert.equal(depth, 1); assert.equal(terminal.sub(), true); assert.ok(globalThis.__phomoChart.sets.length);
  byText(terminal.el, 'About').click(); assert.equal(byClass(terminal.el, 'pomp-about-pane').hidden, false);
  byLabel(terminal.el, 'Your portfolio').click(); assert.equal(nodes(terminal.el).some(n => n.tagName === 'dialog' && n.open), true);
  terminal.closeSub(); assert.equal(terminal.sub(), false); terminal.destroy(); assert.equal(globalThis.__phomoChart.destroyed, true); assert.equal(host.children.length, 0);
});
