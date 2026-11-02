import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarket } from '../src/games/trenchingsimulator/engine.js';
import { createPhomoState } from '../src/games/trenchingsimulator/boards/phomo-state.js';
import { createBasedOrders } from '../src/games/trenchingsimulator/boards/basedbott-data.js';
import { waitingForRealCoins } from '../src/games/trenchingsimulator/boards/common.js';
import { Element, installDom, viewModule, chartURL, phomoChartURL, byClass, byLabel, nodes } from './helpers/phomo-dom.js';

const mods = await Promise.all(['axium', 'basedbott', 'gngm-coin', 'board', 'phomo-coin'].map(name =>
  import(viewModule(new URL(`../src/games/trenchingsimulator/boards/${name}.js`, import.meta.url),
    { './gchart.js': chartURL, './phomo-chart.js': phomoChartURL }))));

function fixture(seed) {
  installDom();
  document.addEventListener = () => {}; document.removeEventListener = () => {}; document.querySelector = () => null;
  const additions = {
    parentElement: { get() { return this.parentNode; } },
    firstElementChild: { get() { return this.children[0] || null; } },
    prepend: { value(...items) { for (const n of items.reverse()) this.insertBefore(n, this.firstChild); } },
    contains: { value(n) { return n === this || nodes(this).includes(n); } },
    blur: { value() { document.activeElement = null; } },
    removeAttribute: { value(k) { delete this.attrs[k]; } },
  };
  const original = new Map(Object.keys(additions).map(k => [k, Object.getOwnPropertyDescriptor(Element.prototype, k)]));
  for (const [k, desc] of Object.entries(additions)) Object.defineProperty(Element.prototype, k, { ...desc, configurable: true });
  const market = createMarket({ seed, live: true, startSol: 10, solUsd: 200, config: { slippage: 1, priority: 'ultra' } });
  market.ext.view({ ext: true, sim: false, simPaused: true });
  const host = new Element('main'); document.body.append(host);
  const calls = [], ctx = { market, solUsd: 200, currency: 'sol', start: 10, run: { mode: 'live' },
    settings: () => ({ slippage: 1, priority: 'ultra' }), order(p) { calls.push(p); return market.order(p); },
    pushSub() {}, popSub() {}, onCoin() {}, openSettings() {} };
  return { market, host, calls, ctx, add() {
    const id = market.ext.add({ key: '0x1111111111111111111111111111111111111111', name: 'Actual Listing', ticker: 'ACTUAL',
      chain: 'base', src: 'clanker', practice: true, live: true, born: -1000, pic: '/actual-logo.png',
      real: { phase: 'migrating', sol: 100, tok: 1e8, liq: 200, estimated: false, fee: .003, exact: false, exactPool: false, progress: 1 } });
    assert.equal(market.row(id).phase, 'migrating'); assert.equal(market.row(id).practice, true);
    return id;
  }, cleanup() {
    for (const [k, desc] of original) if (desc) Object.defineProperty(Element.prototype, k, desc); else delete Element.prototype[k];
  } };
}

function confirmFill(f, id) {
  assert.equal(f.calls.at(-1)?.coin, id);
  assert.equal(f.calls.at(-1)?.side, 'buy');
  f.market.advanceTo(3);
  assert.equal(f.market.orders().at(-1).status, 'filled');
  assert.ok(f.market.positions().find(p => p.id === id)?.tokens > 0);
  assert.equal(f.market.stats(id).holders, null, 'simulated trades must not invent real holder totals');
}

test('Axium real migrating coin keeps quick buy and ticket active, with simulated-market disclosure', () => {
  const f = fixture('axium-real-practice'); let view;
  try {
    view = mods[0].mountAxium(f.host, f.ctx);
    assert.match(f.host.textContent, /Waiting for real coin listings/);
    const id = f.add(); view.update(1000);
    const card = nodes(f.host).find(n => n.classList.contains('ax-card') && n.dataset.key === String(id));
    assert.equal(byClass(card, 'ax-quick-buy').disabled, false);
    view.openCoin(id);
    const submit = byClass(f.host, 'ax-submit'); assert.equal(submit.disabled, false);
    byLabel(f.host, 'Buy amount (SOL)').value = '.1'; submit.closest('form').fire('submit');
    assert.match(byClass(f.host, 'ax-chart-label').textContent, /simulated prices\/volume/);
    confirmFill(f, id);
  } finally { view?.destroy(); f.cleanup(); }
});

test('BasedBott real migrating coin keeps quick buy, market ticket and conditional orders available', () => {
  const f = fixture('basedbott-real-practice'); let view;
  try {
    view = mods[1].mountBasedbott(f.host, f.ctx);
    assert.match(f.host.textContent, /Waiting for real coin listings/);
    const id = f.add(); view.update(1000);
    assert.equal(byLabel(f.host, 'Quick buy ACTUAL').disabled, false);
    view.openCoin(id);
    const submit = byClass(f.host, 'tbb-place'); assert.equal(submit.disabled, false);
    byLabel(f.host, 'Buy amount in SOL').value = '.1'; submit.click(); confirmFill(f, id);
    assert.match(f.host.textContent, /simulated prices\/volume/);
    const orders = createBasedOrders({ row: n => f.market.row(n), now: () => f.market.t, order: p => f.ctx.order(p) });
    orders.add({ coin: id, side: 'buy', sol: .1, target: f.market.row(id).mc }); orders.tick();
    assert.equal(orders.history()[0].status, 'submitted');
    assert.equal(orders.list().length, 0);
  } finally { view?.destroy(); f.cleanup(); }
});

test('GNGM real migrating coin remains buyable while its source migration is visible', () => {
  const f = fixture('gngm-real-practice'); const id = f.add(); let view;
  try {
    view = mods[2].mountCoin({ ctx: f.ctx, market: f.market, M: String, MN: String, MS: String, mc: String,
      U: { id: 'sol', name: 'SOL', per: 1 }, isUsd: false, px: 200, orderError: String,
      phone: { matches: false }, coarse: { matches: true }, info: n => f.market.info(n), statsOf: n => f.market.stats(n),
      smartIndexOf: () => null, openWallet() {}, shareCard() {}, close() {}, openSettings() {},
      limits: { add() {}, cancel() {}, of: () => [], autoOf: () => null, setAuto() {} } });
    f.host.append(view.el); view.open(id);
    const submit = byClass(f.host, 'tsg-place'); assert.equal(submit.getAttribute('aria-disabled'), 'false');
    assert.match(f.host.textContent, /Source coin migrating/);
    byLabel(f.host, 'Amount in SOL').value = '.1'; submit.click(); confirmFill(f, id);
    assert.match(f.host.textContent, /simulated prices\/volume/);
    f.market.ext.metadata(id, { phase: 'curve', src: 'pump.fun', progress: .6 }); view.fast(true);
    assert.match(byClass(f.host, 'tsg-curve-t').textContent, /60%.*as its source says/);
    assert.doesNotMatch(byClass(f.host, 'tsg-curve-t').textContent, /left|migrates at/);
  } finally { view?.destroy(); f.cleanup(); }
});

test('Pomp real migrating coin stays tradable and distinguishes practice liquidity from source progress', () => {
  const f = fixture('pomp-real-practice'); const id = f.add(); let view;
  try {
    view = mods[3].mountBoard(f.host, f.ctx); view.openCoin(id);
    const submit = byClass(f.host, 'tsb-place'); assert.equal(submit.getAttribute('aria-disabled'), 'false');
    byLabel(f.host, 'Amount in SOL').value = '.1'; submit.click(); confirmFill(f, id);
    assert.match(f.host.textContent, /simulated prices\/volume/);
    assert.match(f.host.textContent, /Practice liquidity/);
    assert.match(f.host.textContent, /practice pool stays open/);
  } finally { view?.destroy(); f.cleanup(); }
});

test('Phomo real migrating coin fills practice buys and labels swaps without implying real wallets', () => {
  const f = fixture('phomo-real-practice'); const id = f.add(); let view, state;
  try {
    state = createPhomoState(f.market, { solUsd: 200 });
    view = mods[4].mountPhomoCoin(f.host, f.ctx, id, { state });
    const submit = byClass(f.host, 'tspc-submit'); assert.equal(submit.disabled, true);
    byLabel(f.host, 'Buy amount in practice dollars').value = '20'; submit.closest('form').fire('submit'); confirmFill(f, id);
    view.update(5000);
    assert.match(byClass(f.host, 'tspc-chart-note').textContent, /prices, market cap, volume and swaps are simulated/);
    assert.doesNotMatch(f.host.textContent, /Chart follows real market cap|Unidentified live swap|Live market data/);
    assert.equal(state.tokens({ window: '5m' }).rows.find(r => r.id === id).practice, true);
  } finally { view?.destroy(); state?.destroy(); f.cleanup(); }
});

test('Empty real feed wording is limited to waiting discovery, not filtered or simulated markets', () => {
  assert.equal(waitingForRealCoins({ live: true, liveState: { seen: 0 } }), true);
  assert.equal(waitingForRealCoins({ live: true, liveState: { seen: 1 } }), false);
  assert.equal(waitingForRealCoins({ live: false, liveState: { seen: 0 } }), false);
  assert.equal(waitingForRealCoins({ live: true, ext: { liveCount: () => 0 } }), true);
  assert.equal(waitingForRealCoins({ live: true, liveState: () => ({ seen: 0 }) }), true);
});
