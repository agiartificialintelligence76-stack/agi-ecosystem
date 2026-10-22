import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarket, PRIORITY } from '../src/games/trenchingsimulator/engine.js';
import { blankPhomoPrefs, PHOMO_SAVE_KEY } from '../src/games/trenchingsimulator/boards/phomo-state.js';
import { usd, signed, pct, age } from '../src/games/trenchingsimulator/format.js';
import { Element, installDom, coinModuleURL, viewModule, nodes, byClass, byLabel, byText } from './helpers/phomo-dom.js';

const { mountPhomo } = await import(viewModule(new URL('../src/games/trenchingsimulator/boards/phomo.js', import.meta.url), {
  './phomo-coin.js': coinModuleURL,
}));

function fixture({ store = new Map(), market = null, chain = null } = {}) {
  installDom(store);
  if (!store.has(PHOMO_SAVE_KEY)) {
    const prefs = blankPhomoPrefs();
    prefs.ui.panels = [{ kind: 'tokens', category: 'trending', window: '5m' }];
    store.set(PHOMO_SAVE_KEY, JSON.stringify(prefs));
  }
  market ||= createMarket({ seed: 'phomo-terminal-ui', startSol: 100, solUsd: 200 });
  const host = new Element('main'); document.body.append(host);
  const orders = [], focus = [];
  let pushes = 0, pops = 0, playerName = 'Player';
  const ctx = { market, chain, solUsd: 200, start: 100, colors: { accent: '#ff7a59' }, settings: () => ({ slippage: .2, priority: Object.keys(PRIORITY)[0] }),
    playerName: () => playerName, setPlayerName: (name) => { playerName = name; return { ok: true, name }; },
    order(p) { orders.push(p); return market.order({ slippage: .2, priority: Object.keys(PRIORITY)[0], ...p }); },
    onCoin: (id) => focus.push(id), pushSub: () => { pushes++; }, popSub: () => { pops++; }, openSettings() {} };
  const view = mountPhomo(host, ctx);
  const label = (s) => byLabel(host, s), text = (s) => byText(host, s), cls = (s) => byClass(host, s);
  const nav = (s) => byLabel(cls('ph-rail'), s).click();
  const saved = () => JSON.parse(store.get(PHOMO_SAVE_KEY));
  let time = 0;
  const refresh = () => { time += 1000; view.update(time); };
  return { host, market, store, view, orders, focus, nav, label, text, cls, saved, refresh,
    history: () => ({ pushes, pops }) };
}

test('Phomo shows token ages in their own sortable column without shifting price-change or volume headers', () => {
  const f = fixture();
  try {
    const table = f.cls('ph-token-table');
    const headers = table.querySelectorAll('th');
    assert.equal(headers.length, 8);
    assert.equal(headers[3].textContent, 'Age');
    const check = (direction) => {
      const rows = table.querySelector('tbody').children;
      const ages = rows.map((r) => f.market.row(Number(r.dataset.key)).age);
      assert.deepEqual(ages, [...ages].sort((a,b) => direction === 'asc' ? a - b : b - a));
      for (const row of rows) assert.equal(row.children[3].textContent, age(f.market.row(Number(row.dataset.key)).age));
      assert.equal(headers[3].getAttribute('aria-sort'), direction === 'asc' ? 'ascending' : 'descending');
      assert.equal(f.saved().ui.panels[0].sort, 'age');
      assert.equal(f.saved().ui.panels[0].direction, direction);
    };
    f.text('Age').click(); check('desc');
    f.text('Age').click(); check('asc');
    f.label('1h market window').click();
    assert.equal(headers[3].textContent, 'Age');
    assert.equal(headers[4].textContent, '1h change');
    assert.equal(headers[5].textContent, '1h volume');
    assert.ok(table.querySelector('tbody').children[0].textContent.includes('Simulated'));
  } finally { f.view.destroy(); }
});

test('Phomo workspace persists watchlist, category and filters while panels split and close', () => {
  const f = fixture();
  assert.equal(f.host.querySelectorAll('.ph-panel').length, 1);
  f.cls('ph-star').click();
  assert.equal(f.saved().watchlist.length, 1);
  assert.ok(!f.cls('ph-watchstrip').textContent.includes('Star tokens'));
  f.nav('Watchlist');
  assert.equal(f.cls('ph-table').querySelector('tbody').children.length, 1);
  f.nav('Tokens');
  f.text('Graduated').click();
  assert.equal(f.saved().ui.panels[0].category, 'graduated');
  f.text('Filters').click();
  f.label('Minimum market cap ($)').value = '12345';
  f.cls('ph-form').fire('submit');
  assert.equal(f.saved().ui.panels[0].filters.minMarketCap, 12345);
  f.label('Split right').click();
  assert.equal(f.host.querySelectorAll('.ph-panel').length, 2);
  f.label('Close panel').click();
  assert.equal(f.host.querySelectorAll('.ph-panel').length, 1);
  const { market, store } = f;
  f.view.destroy();
  const reopened = fixture({ market, store });
  assert.equal(reopened.saved().watchlist.length, 1);
  assert.equal(reopened.saved().ui.panels[0].category, 'graduated');
  assert.equal(reopened.saved().ui.panels[0].filters.minMarketCap, 12345);
  reopened.view.destroy();
});

test('Phomo quick buy uses practice dollars, fills positions and clears coin focus when closing', () => {
  const f = fixture();
  f.label('Quick-buy dollars').value = '40';
  f.label('Quick-buy dollars').fire('change');
  f.cls('ph-quickbuy').click();
  assert.equal(f.orders.length, 1);
  assert.equal(f.orders[0].sol, .2);
  f.market.advance(8); f.refresh();
  assert.ok(f.cls('ph-position-list').querySelector('.ph-position'));
  assert.ok(!f.cls('ph-position-list').textContent.includes('No open positions'));
  const id = f.orders[0].coin;
  f.view.openCoin(id);
  assert.equal(f.view.sub(), true);
  assert.equal(f.focus.at(-1), id);
  f.cls('tspc-back').click();
  assert.equal(f.view.sub(), false);
  assert.equal(f.focus.at(-1), null);
  assert.deepEqual(f.history(), { pushes: 1, pops: 1 });
  f.view.destroy();
  assert.equal(f.host.children.length, 0);
});

test('Phomo trader follow and profile activity support a single explicit copy order', () => {
  const f = fixture();
  f.nav('Leaderboard');
  const follow = f.text('Follow');
  assert.ok(follow);
  follow.click();
  assert.equal(f.saved().followed.length, 1);
  f.cls('ph-trader-link').click();
  assert.ok(f.cls('ph-profile'));
  f.text('Activity').click();
  assert.ok(f.cls('ph-profile-list'));
  f.text('← Back').click();
  f.nav('Feed');
  const buy = f.host.querySelectorAll('.ph-copy').find((n) => n.textContent.startsWith('Copy $'));
  assert.ok(buy, 'warm-up simulation provides a visible buy event');
  buy.click();
  assert.equal(f.orders.length, 1);
  assert.equal(f.orders[0].side, 'buy');
  assert.equal(f.orders[0].sol, f.saved().ui.quickBuy / 200);
  f.view.destroy();
});

test('Phomo alert creation replaces its empty state, triggers once, persists and can be removed', () => {
  const f = fixture();
  f.nav('Alerts');
  const choose = f.label('Alert token');
  const option = choose.children.find((n) => n.getAttribute('value') !== '');
  choose.value = option.getAttribute('value');
  f.label('Alert threshold in dollars').value = '0.01';
  f.cls('ph-alert-form').fire('submit');
  assert.equal(f.saved().alerts.length, 1);
  assert.ok(!f.cls('ph-alert-list').textContent.includes('No price alerts'));
  f.refresh();
  assert.equal(f.saved().alerts[0].active, false);
  assert.equal(f.saved().notifications.length, 1);
  f.refresh();
  assert.equal(f.saved().notifications.length, 1);
  f.text('Remove').click();
  assert.equal(f.saved().alerts.length, 0);
  f.view.destroy();
});

test('Phomo restores available filters after changing market mode without losing other saved panels', async () => {
  const prefs = blankPhomoPrefs();
  prefs.ui.panels = [{ kind: 'tokens', category: 'trending', window: '5m', network: 'base', launchpad: 'dex' },
    { kind: 'tokens', category: 'bonding', window: '5m', network: 'simulated', launchpad: 'all' }];
  const f = fixture({ store: new Map([[PHOMO_SAVE_KEY, JSON.stringify(prefs)]]) });
  try {
    await Promise.resolve();
    assert.equal(f.label('Network').value, 'all');
    assert.equal(f.label('Launchpad').value, 'all');
    assert.equal(f.cls('ph-table').hidden, false, 'available simulated tokens remain visible');
    assert.equal(f.saved().ui.panels.length, 2, 'normalizing the first panel preserves the second');
    assert.deepEqual(f.saved().ui.panels.map((p) => [p.network, p.launchpad]), [['all','all'], ['simulated','all']]);
    assert.equal(f.saved().ui.panels[1].category, 'bonding');
  } finally { f.view.destroy(); }
});

test('Phomo leaderboard keeps the selected metric and displayed amounts consistent with its period', () => {
  const market = createMarket({ seed: 'phomo-rank-periods', startSol: 100, solUsd: 200 });
  market.smartWallets = () => [
    { n: 0, addr: 'first', in: 300, out: 0, pnl: 20, won: 9, lost: 1, buys: 10, sells: 0, open: [],
      d7: { pnl: 1, trades: 10, won: 2, lost: 8, vol: 10 } },
    { n: 1, addr: 'second', in: 30, out: 0, pnl: 5, won: 2, lost: 8, buys: 10, sells: 0, open: [],
      d7: { pnl: 3, trades: 10, won: 8, lost: 2, vol: 100 } },
  ];
  const f = fixture({ market });
  try {
    f.nav('Leaderboard');
    const metric = f.label('Rank traders by'), period = f.label('Trader ranking period');
    const first = () => f.cls('ph-trader-table').querySelector('tbody').children[0];
    const choose = (node, value) => { node.value = value; node.fire('change'); };
    const check = (name, profit, win, volume) => {
      const row = first();
      assert.ok(row.children[1].textContent.includes(name));
      assert.equal(row.children[2].textContent, signed(profit, 'usd'));
      assert.equal(row.children[3].textContent, pct(win));
      assert.equal(row.children[4].textContent, usd(volume));
    };
    choose(metric, 'volume'); check('Smart wallet 2', 600, .8, 20_000);
    choose(period, 'pnl'); check('Smart wallet 1', 4000, .9, 60_000);
    assert.equal(metric.value, 'volume');
    choose(period, 'week'); check('Smart wallet 2', 600, .8, 20_000);
    choose(metric, 'winRate'); check('Smart wallet 2', 600, .8, 20_000);
    choose(period, 'pnl'); check('Smart wallet 1', 4000, .9, 60_000);
    choose(metric, 'followers'); assert.equal(period.disabled, true);
    choose(metric, 'pnl'); assert.equal(period.disabled, false);
  } finally { f.view.destroy(); }
});

test('Phomo footer describes live-feed interruptions and recovery without claiming disconnected quotes are live', () => {
  const market = createMarket({ seed: 'phomo-feed-status', startSol: 100, solUsd: 200 });
  let status = { feed: 'connecting', chainState: 'down' };
  market.liveState = () => status;
  const f = fixture({ market, chain: 'base' });
  try {
    const footer = f.cls('ph-status');
    assert.match(footer.textContent, /Connecting/);
    status = { feed: 'live', chainState: 'live' }; f.refresh();
    assert.match(footer.textContent, /● Live · Base/);
    assert.equal(footer.classList.contains('is-down'), false);
    status = { feed: 'down', chainState: 'live' }; f.refresh();
    assert.match(footer.textContent, /Reconnecting/);
    assert.match(footer.title, /isn't reachable/);
    assert.equal(footer.classList.contains('is-down'), true);
    status = { feed: 'full', chainState: 'down' }; f.refresh(); assert.match(footer.textContent, /Feed full/);
    status = { feed: 'live', chainState: 'quiet' }; f.refresh(); assert.match(footer.textContent, /Quiet market/);
    status = { feed: 'live', chainState: 'live' }; f.refresh(); assert.match(footer.textContent, /● Live · Base/);
  } finally { f.view.destroy(); }
});

test('Phomo launchpad choices refresh when live sources arrive while retaining a valid active filter', () => {
  const market = createMarket({ seed: 'phomo-source-arrivals', startSol: 100, solUsd: 200, live: 'base' });
  const f = fixture({ market, chain: 'base' });
  const add = (n, src) => market.ext.add({ key: `0x${String(n).padStart(40,'0')}`, name: `Live source ${n}`, ticker: `LIVE${n}`,
    chain: 'base', src, live: true, real: { phase: 'pool', sol: 100, tok: 1e8, liq: 200, estimated: false } });
  try {
    const choice = f.label('Launchpad');
    assert.deepEqual(choice.children.map((o) => o.value), ['all']);
    add(1,'dex'); f.refresh();
    assert.deepEqual(choice.children.map((o) => o.value), ['all','dex']);
    choice.value = 'dex'; choice.fire('change');
    assert.equal(f.saved().ui.panels[0].launchpad, 'dex');
    add(2,'clank.trade'); f.refresh();
    assert.deepEqual(choice.children.map((o) => o.value), ['all','clank.trade','dex']);
    assert.equal(choice.value, 'dex');
    assert.equal(f.saved().ui.panels[0].launchpad, 'dex');
    assert.equal(f.cls('ph-count').textContent, '1 tokens');
    choice.value = 'clank.trade'; choice.fire('change');
    assert.equal(f.cls('ph-count').textContent, '1 tokens');
    assert.ok(f.cls('ph-table').textContent.includes('LIVE2'));
  } finally { f.view.destroy(); }
});
