import test from 'node:test';
import assert from 'node:assert/strict';
import { Element, installDom, nodes, byLabel, byClass, viewModule, phomoChartURL } from './helpers/phomo-dom.js';
const helper = viewModule(new URL('../src/games/trenchingsimulator/boards/phomo-perps-chart.js',import.meta.url), {'./phomo-chart.js':phomoChartURL});
const { mountPhomoPerps } = await import(viewModule(new URL('../src/games/trenchingsimulator/boards/phomo-perps.js',import.meta.url), {'./phomo-perps-chart.js':helper}));

function fixture() {
  installDom();
  Element.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 300 });
  const operations = [];
  Element.prototype.getContext = () => new Proxy({}, { get: (o, key) => o[key] || ((...args) => operations.push([key, ...args])) });
  const listeners = new Set(), calls = [], life = { starts: 0, stops: 0 };
  const client = { status: 'idle', onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    start() { life.starts++; this.status = 'live'; for (const fn of listeners) fn('live'); },
    stop() { life.stops++; this.status = 'idle'; },
    async request(op, args = {}) {
      calls.push({ op, ...args });
      if (op === 'dexs') return { data: [{ id: '', name: 'Hyperliquid' }] };
      if (op === 'markets') return { dex: '', at: 1792000100000, data: [{ coin: 'BTC', symbol: 'BTC', dex: '', price: 100,
        mark: 100, mid: 101, oracle: 99, change: .1, volume: 5000, funding: null, openInterest: null, openInterestUsd: null, leverage: 20 }] };
      if (op === 'candles') return { coin: args.coin, interval: args.interval, data: [
        { t: 1792000000000, o: 100, h: 105, l: 99, c: 104, v: 10 }, { t: 1792000060000, o: 104, h: 107, l: 102, c: 106, v: 8 }] };
      throw new Error('unexpected operation');
    } };
  return { client, listeners, calls, operations, life };
}
const flush = () => new Promise((done) => setImmediate(done));

test('perpetual view docks its compact market list and shared positions without reconnecting or taking ownership', async () => {
  const f = fixture(), host = new Element('main'), discovery = new Element('nav'), positions = new Element('aside');
  positions.textContent = 'Shared practice spot positions';
  const view = mountPhomoPerps(host, { perpsClient: f.client }, { discoveryHost: discovery, positionsHost: positions });
  await flush();
  assert.ok(byClass(discovery, 'php-market-panel'));
  assert.equal(byClass(host, 'php-nav-slot').hidden, true);
  assert.equal(positions.parentNode, byClass(host, 'php-positions-slot'));
  assert.match(host.textContent, /BTC Perpetual/); assert.match(host.textContent, /Trading is not available/);
  const funding = nodes(host).find((n) => n.tagName === 'dt' && n.textContent === 'Funding rate');
  assert.equal(funding.nextSibling.textContent, '—');
  view.setHosts();
  assert.equal(positions.parentNode, null); assert.equal(discovery.children.length, 0);
  assert.ok(byClass(host, 'php-market-panel')); assert.equal(byClass(host, 'php-nav-slot').hidden, false);
  assert.equal(f.life.starts, 1, 'layout changes must not create a second subscription');
  view.setHosts({ discoveryHost: discovery, positionsHost: positions });
  const anotherOwner = new Element('aside'); anotherOwner.append(positions);
  view.setHosts(); assert.equal(positions.parentNode, anotherOwner, 'undocking never removes a slot already moved by its owner');
  view.setHosts({ discoveryHost: discovery }); view.destroy();
  assert.equal(discovery.children.length, 0); assert.equal(host.children.length, 0); assert.equal(f.listeners.size, 0);
  assert.equal(f.life.stops, 1); assert.ok(f.calls.every((c) => ['markets', 'candles', 'dexs'].includes(c.op)));
});

test('perpetual line control redraws observed prices and keeps interval requests read-only', async () => {
  const f = fixture(), host = new Element('main');
  const view = mountPhomoPerps(host, { perpsClient: f.client }); await flush();
  assert.equal(globalThis.__phomoChart.sets.at(-1).candles[0].o,100e9, 'USD prices normalize for the shared price adapter');
  const styles = byLabel(host, 'Perpetual chart style'); styles.value = 'line'; styles.fire('change');
  assert.equal(globalThis.__phomoChart.style,'line');
  const interval = nodes(host).find((n) => n.tagName === 'button' && n.textContent === '1h'); interval.fire('click'); await flush();
  assert.equal(f.calls.filter((c) => c.op === 'candles').at(-1).interval, '1h');
  assert.match(byClass(host, 'php-chart').getAttribute('aria-label'), /2 observed candles/);
  view.setActive(false); assert.equal(f.client.status, 'idle');
  const count = f.calls.length; view.update(); assert.equal(f.calls.length, count);
  view.setActive(true); await flush(); assert.equal(f.client.status, 'live'); view.destroy();
});
