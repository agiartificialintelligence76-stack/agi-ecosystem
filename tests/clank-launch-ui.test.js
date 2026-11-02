import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarket } from '../src/games/trenchingsimulator/engine.js';
import { createClankMarket } from '../src/games/trenchingsimulator/clank-live.js';
import { installDom, Element, nodes, byClass, byLabel, byText, viewModule } from './helpers/phomo-dom.js';

// Exercise the actual mounted form and market. Rendering-only services do not need
// browser layout or a WebGL context to verify launch and initial-order behavior.
const moduleURL = (source) => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const replacements = {
  './clank-chart.js': moduleURL('export function createClankChart(){return {set(){},view(){},destroy(){}}}'),
  './clank-ticker.js': moduleURL('export function createClankTicker(){return {update(){},visible(){},destroy(){}}}'),
  './clank-images.js': moduleURL('export function createClankImageQueue(){return {add(){},destroy(){}}}'),
};
const NOW = 1_793_600_000_000;
const ADDRESS = '0x' + 'a'.repeat(40);
const appendNodes = Element.prototype.append;

function dom() {
  installDom();
  document.hidden = false; document.addEventListener = () => {}; document.removeEventListener = () => {};
  globalThis.window = { scrollTo() {} };
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} };
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  Element.prototype.append = function (...items) {
    appendNodes.call(this, ...items.map(item => item instanceof Element ? item : document.createTextNode(String(item))));
  };
  Element.prototype.removeAttribute = function (key) { delete this.attrs[key]; };
  Element.prototype.contains = function (node) { return nodes(this).includes(node); };
  Object.defineProperty(Element.prototype, 'firstElementChild', { configurable: true, get() { return this.children[0] || null; } });
  const create = document.createElement;
  document.createElement = (tag) => {
    const node = create(tag), style = new Map();
    node.style = { setProperty: (key, value) => style.set(key, value), getPropertyValue: (key) => style.get(key) || '' };
    return node;
  };
}

function publicFeed() {
  const watched = [];
  return { status: 'live', watched,
    coins: () => [{ address: ADDRESS, name: 'Public Coin', ticker: 'PUBLIC', marketCapUsd: 5000,
      liquidityUsd: 2000, phase: 'curve', progress: .2, createdAt: NOW - 50000, quoteAsset: 'ETH' }],
    on: () => () => {}, watch: (ids) => watched.push([...ids]), picUrl: () => '',
    trending: () => [ADDRESS], detail: () => null, candles: () => [], stocks: () => [], recentTrades: () => [],
    chainState: () => 'live', interval() {}, search: async () => [], hasMore: false,
  };
}

async function harness(t, { kind = 'clank', mode = 'free', over = false, start = 10 } = {}) {
  dom();
  const feed = publicFeed();
  const market = kind === 'clank'
    ? createClankMarket({ feed, seed: 'launch-ui', solUsd: 100, startSol: start, wallNow: () => NOW })
    : createMarket({ live: true, seed: 'launch-disabled', solUsd: 100, startSol: start, config: { warmup: 0 } });
  const launched = [], ordered = [], focused = [];
  const run = { mode, over, live: 'robinhood' };
  const host = document.createElement('div'); document.body.append(host);
  const { mountClank } = await import(viewModule(new URL('../src/games/trenchingsimulator/boards/clank.js', import.meta.url), replacements));
  let terminal; const intervals = [], realSetInterval = globalThis.setInterval;
  globalThis.setInterval = (...args) => { const timer = realSetInterval(...args); intervals.push(timer); return timer; };
  t.after(() => { globalThis.setInterval = realSetInterval; terminal?.destroy(); intervals.forEach(clearInterval); market.destroy?.(); });
  terminal = mountClank(host, { market, run, solUsd: 100, currency: 'usd', start,
    settings: () => ({ slippage: .5, priority: 'fast' }),
    launchCoin: (input) => { launched.push(input); return market.launchCoin(input); },
    order: (input) => { ordered.push(input); return market.order(input); },
    onCoin: (id) => { focused.push(id); market.focus?.(id); },
    pushSub() {}, popSub() {}, openSettings() {}, playerName: () => 'Tester',
  });
  return { terminal, root: terminal.el, market, feed, run, launched, ordered, focused };
}

function openLaunch(h, values = {}) {
  byText(h.root, 'Launch coin').click();
  const fields = { 'Coin name': 'Local Ghost', Ticker: 'ghost', 'Paired asset': 'NVDA',
    Description: 'A local practice coin', 'Initial buy (USD)': '10', ...values };
  for (const [label, value] of Object.entries(fields)) byLabel(h.root, label).value = value;
  byLabel(h.root, 'Coin name').fire('input');
  return byClass(h.root, 'tsc-launch-form');
}

test('Live Clank launches a local coin, places exactly one initial buy, and keeps its created card local', async (t) => {
  const h = await harness(t), form = openLaunch(h, { 'Website link': 'https://example.com/local-ghost', 'Twitter / X link': 'javascript:alert(1)' });
  assert.equal(h.market.canLaunchPractice, true);
  assert.equal(byClass(h.root, 'tsc-launch-submit').disabled, false);
  form.fire('submit');
  assert.equal(h.launched.length, 1); assert.equal(h.ordered.length, 1);
  const id = h.ordered[0].coin;
  assert.equal(h.ordered[0].sol, .1); assert.equal(h.ordered[0].side, 'buy');
  assert.equal(h.market.row(id).live, false);
  assert.equal(h.market.info(id).line, 'A local practice coin');
  assert.equal(h.market.row(id).pair, 'NVDA');
  assert.equal(h.root.dataset.view, 'coin'); assert.equal(h.focused.at(-1), id);
  assert.match(byClass(h.root, 'tsc-coin-sub').textContent, /local|practice coin/i);
  assert.doesNotMatch(byClass(h.root, 'tsc-coin-sub').textContent, /undefined|0x[a-f0-9]{6}/i);
  const links = nodes(byClass(h.root, 'tsc-coin-links')).filter(n => n.tagName === 'a');
  assert.deepEqual(links.map(link => link.getAttribute('href')), ['https://example.com/local-ghost']);
  assert.equal(links[0].getAttribute('rel'), 'noopener noreferrer');
  assert.equal(h.market.orders().length, 1);
  // A queued second submit sees reset fields and cannot create another coin/order.
  form.fire('submit'); assert.equal(h.launched.length, 1); assert.equal(h.ordered.length, 1);
  byText(h.root, 'Explore').click();
  assert.equal(byText(h.root, 'New').getAttribute('aria-pressed'), 'true');
  assert.match(byClass(h.root, 'tsc-grid').textContent, /Local Ghost/);
  byText(h.root, 'Profile').click(); byText(h.root, 'Created coins').click();
  const card = byClass(h.root, 'tsc-card');
  assert.ok(card); assert.match(card.textContent, /Local Ghost/);
  assert.match(byClass(card, 'tsc-card-address').textContent, /local|practice|simulated/i);
  for (const copy of nodes(card).filter(n => /Copy .* address/.test(n.getAttribute('aria-label') || ''))) assert.equal(copy.hidden, true);
  assert.equal(byClass(card, 'tsc-card-live').hidden, true);
  assert.ok(h.feed.watched.every(ids => ids.every(address => address === ADDRESS)), 'a local identity never enters public feed watches');
});

test('Live Clank zero-buy launch creates one local coin without placing or charging an order', async (t) => {
  const h = await harness(t), before = h.market.player.sol;
  openLaunch(h, { 'Initial buy (USD)': '' }).fire('submit');
  assert.equal(h.launched.length, 1); assert.equal(h.ordered.length, 0);
  assert.equal(h.market.player.sol, before); assert.equal(h.root.dataset.view, 'coin');
});

test('Clank rejects invalid fields and an initial buy that cannot leave room for fees before creating anything', async (t) => {
  const h = await harness(t);
  const form = openLaunch(h, { Ticker: '<script>' }); form.fire('submit');
  assert.equal(h.launched.length, 0); assert.equal(h.ordered.length, 0);
  assert.match(byClass(h.root, 'tsc-error').textContent, /letters|numbers/i);
  byLabel(h.root, 'Ticker').value = 'GHOST'; byLabel(h.root, 'Initial buy (USD)').value = '1000'; form.fire('submit');
  assert.equal(h.launched.length, 0); assert.equal(h.ordered.length, 0);
  assert.match(byClass(h.root, 'tsc-error').textContent, /fees|money/i);
  byLabel(h.root, 'Initial buy (USD)').value = '0.01'; form.fire('submit');
  assert.equal(h.launched.length, 0); assert.match(byClass(h.root, 'tsc-error').textContent, /smallest/i);
});

test('Clank reports the practice-launch limit without adding a twenty-first coin or initial order', async (t) => {
  const h = await harness(t);
  for (let i = 0; i < 20; i++) openLaunch(h, { 'Coin name': `Local Coin ${i}`, Ticker: `LC${i}`, 'Initial buy (USD)': '' }).fire('submit');
  const count = h.market.size.coins;
  openLaunch(h, { 'Initial buy (USD)': '' }).fire('submit');
  assert.equal(h.market.size.coins, count); assert.equal(h.ordered.length, 0);
  assert.equal(h.root.dataset.view, 'launch');
  assert.match(byClass(h.root, 'tsc-error').textContent, /(?:limit|up to).*20|20.*limit/i);
});

for (const [label, options] of [['finished run', { over: true }], ['challenge run', { mode: 'challenge' }], ['ordinary Live market', { kind: 'ordinary' }]]) {
  test(`Clank launch remains blocked in a ${label}, including direct form submission`, async (t) => {
    const h = await harness(t, options), form = openLaunch(h);
    assert.equal(byClass(h.root, 'tsc-launch-submit').disabled, true);
    form.fire('submit'); assert.equal(h.launched.length, 0); assert.equal(h.ordered.length, 0);
    assert.equal(h.root.dataset.view, 'launch');
  });
}
