import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarket, PRIORITY } from '../src/games/trenchingsimulator/engine.js';
import { blankPhomoPrefs, PHOMO_SAVE_KEY } from '../src/games/trenchingsimulator/boards/phomo-state.js';
import { usd, signed, pct } from '../src/games/trenchingsimulator/format.js';
import { Element, installDom, coinModuleURL, socialModuleURL, viewModule, nodes, byClass, byLabel, byText } from './helpers/phomo-dom.js';

const { mountPhomo } = await import(viewModule(new URL('../src/games/trenchingsimulator/boards/phomo.js', import.meta.url), {
  './phomo-coin.js': coinModuleURL,
  './phomo-social.js': socialModuleURL,
}));

function fixture({ store = new Map(), market = null, chain = null, spotPrices = null } = {}) {
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
  const ctx = { market, chain, spotPrices, solUsd: 200, start: 100, colors: { accent: '#ff7a59' }, settings: () => ({ slippage: .2, priority: Object.keys(PRIORITY)[0] }),
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

test('Phomo table keeps sortable dollar metrics and applies anchored numeric filters immediately', () => {
  const f = fixture();
  try {
    const table = f.cls('ph-token-table');
    const headers = table.querySelectorAll('th');
    assert.equal(headers.length, 7);
    assert.equal(headers[1].textContent, 'Market cap');
    const check = (direction) => {
      const rows = table.querySelector('tbody').children;
      const caps = rows.map((r) => f.market.row(Number(r.dataset.key)).mc);
      assert.deepEqual(caps, [...caps].sort((a,b) => direction === 'asc' ? a - b : b - a));
      for (const row of rows) assert.equal(row.children[1].textContent, usd(f.market.row(Number(row.dataset.key)).mc*200));
      assert.equal(headers[1].getAttribute('aria-sort'), direction === 'asc' ? 'ascending' : 'descending');
      assert.equal(f.saved().ui.panels[0].sort, 'marketCap');
      assert.equal(f.saved().ui.panels[0].direction, direction);
    };
    f.text('Market cap').click(); check('desc');
    f.text('Market cap').click(); check('asc');
    f.label('1h market window').click();
    assert.equal(headers[3].textContent, '1h change');
    assert.equal(headers[4].textContent, '1h volume');
    f.text('Age ⌄').click();
    const max = f.label('Maximum age'); max.value = '60'; max.fire('input');
    assert.equal(f.saved().ui.panels[0].filters.maxAge,60);
    assert.ok(table.querySelector('tbody').children.every((r) => f.market.row(Number(r.dataset.key)).age <=60));
    f.text('Reset').click(); assert.equal(f.saved().ui.panels[0].filters.maxAge,undefined);
    f.text('Done').click(); assert.equal(f.cls('ph-popover'),undefined);
  } finally { f.view.destroy(); }
});

test('Phomo workspace persists watchlist, category and filters while panels split and close', () => {
  const f = fixture();
  assert.equal(f.host.querySelectorAll('.ph-panel').length, 1);
  f.cls('ph-star').click();
  assert.equal(f.saved().watchlist.length, 1);
  assert.ok(!f.cls('ph-watchstrip').textContent.includes('Star tokens'));
  f.nav('Watchlist');
  assert.equal(f.cls('ph-nav-rows').children.length, 1);
  assert.equal(f.cls('ph-table').querySelector('tbody').children.length, 25, 'watchlist rail preserves main discovery');
  f.nav('Tokens');
  byText(f.cls('ph-categories'),'Graduated').click();
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
  f.label('Phomo home').click();
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
  f.cls('phs-person').click();
  assert.ok(f.cls('phs-profile'));
  f.text('All swaps').click();
  assert.ok(f.cls('phs-profile-swaps'));
  f.text('Back').click();
  f.nav('Feed');
  const event = f.host.querySelectorAll('.phs-event').find((n) => n.textContent.includes('Bought'));
  const buy = event && byText(event,'Copy order');
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
  f.cls('phs-alert-form').fire('submit');
  assert.equal(f.saved().alerts.length, 1);
  assert.ok(f.cls('phs-alert'));
  f.refresh();
  assert.equal(f.saved().alerts[0].active, false);
  assert.equal(f.saved().notifications.length, 1);
  f.refresh();
  assert.equal(f.saved().notifications.length, 1);
  f.text('Delete').click();
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
    const first = () => f.cls('phs-table').querySelector('tbody').children[0];
    const choose = (node, value) => { node.value = value; node.fire('change'); };
    const check = (name, profit, win, volume) => {
      const row = first();
      assert.ok(row.children[1].textContent.includes(name));
      assert.equal(row.children[2].textContent, signed(profit, 'usd'));
      assert.equal(row.children[3].textContent, pct(win));
      assert.equal(row.children[4].textContent, usd(volume));
    };
    choose(period,'week'); choose(metric, 'volume'); check('Smart wallet 2', 600, .8, 20_000);
    choose(period, 'run'); check('Smart wallet 1', 4000, .9, 60_000);
    assert.equal(metric.value, 'volume');
    choose(period, 'week'); check('Smart wallet 2', 600, .8, 20_000);
    choose(metric, 'winRate'); check('Smart wallet 2', 600, .8, 20_000);
    choose(period, 'run'); check('Smart wallet 1', 4000, .9, 60_000);
    choose(metric, 'followers'); assert.equal(period.disabled, true);
    choose(metric, 'pnl'); assert.equal(period.disabled, false);
  } finally { f.view.destroy(); }
});

test('Phomo footer distinguishes coin-feed interruptions from continuing simulated prices and volume', () => {
  const market = createMarket({ seed: 'phomo-feed-status', startSol: 100, solUsd: 200 });
  let status = { feed: 'connecting', chainState: 'down' };
  market.liveState = () => status;
  const f = fixture({ market, chain: 'base' });
  try {
    const footer = f.cls('ph-status');
    assert.match(footer.textContent, /Connecting/);
    status = { feed: 'live', chainState: 'live' }; f.refresh();
    assert.match(footer.textContent, /Coin feed live · Base · simulated prices\/volume/);
    assert.equal(footer.classList.contains('is-down'), false);
    status = { feed: 'down', chainState: 'live' }; f.refresh();
    assert.match(footer.textContent, /Reconnecting/);
    assert.match(footer.title, /reconnecting.*practice prices keep moving/i);
    assert.equal(footer.classList.contains('is-down'), true);
    status = { feed: 'full', chainState: 'down' }; f.refresh(); assert.match(footer.textContent, /Feed full/);
    status = { feed: 'live', chainState: 'quiet' }; f.refresh(); assert.match(footer.textContent, /Quiet coin feed/);
    status = { feed: 'live', chainState: 'live' }; f.refresh(); assert.match(footer.textContent, /Coin feed live · Base/);
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

test('Phomo keeps discovery and one positions rail through coin and profile navigation', () => {
  const f = fixture();
  try {
    const positions = f.label('Your positions'), nav = f.cls('ph-nav-rows');
    const rows = f.cls('ph-token-table').querySelector('tbody').children;
    const first = Number(rows[0].dataset.key), second = Number(rows[1].dataset.key);
    f.view.openCoin(first);
    assert.equal(f.cls('ph-root').classList.contains('is-rail-collapsed'),false);
    assert.equal(f.cls('ph-nav-rows'),nav);
    assert.equal(positions.parentNode,f.cls('tspc-sidebar'));
    assert.equal(f.host.querySelectorAll('.ph-positions').length,1);
    const chart = globalThis.__phomoChart;
    f.view.openCoin(second);
    assert.equal(chart.destroyed,true);
    assert.equal(f.focus.at(-1),second);
    assert.equal(f.host.querySelectorAll('.ph-positions').length,1);
    f.label('Your profile').click();
    assert.ok(f.cls('phs-profile'));
    assert.equal(positions.parentNode,f.cls('ph-body'));
    assert.equal(positions.hidden,true);
    assert.equal(f.focus.at(-1),null);
    f.text('Back').click();
    assert.equal(f.view.sub(),false);
    assert.equal(positions.hidden,false);
    assert.equal(f.cls('ph-root').classList.contains('is-rail-collapsed'),true);
    assert.deepEqual(f.history(),{pushes:1,pops:1});
    assert.equal(f.orders.length,0);
  } finally { f.view.destroy(); }
});

test('Phomo keyboard dividers persist dimensions and automatic panels across reopen', () => {
  const f = fixture();
  f.label('Expand discovery panel').click();
  f.label('Resize discovery panel').fire('keydown',{key:'ArrowRight'});
  f.label('Resize positions panel').fire('keydown',{key:'ArrowLeft'});
  f.label('Resize token name column').fire('keydown',{key:'ArrowRight'});
  f.label('Collapse positions').click();
  f.label('Split right').click();
  f.label('Resize workspace panels').fire('keydown',{key:'ArrowRight'});
  const saved = f.saved().ui;
  assert.equal(saved.discoveryWidth,292);
  assert.equal(saved.positionsWidth,332);
  assert.equal(saved.panels[0].tokenNameWidth,312);
  assert.equal(saved.positionsCollapsed,true);
  assert.deepEqual(saved.panelSizes,[312,0]);
  f.view.destroy();
  const next = fixture({market:f.market,store:f.store});
  try {
    assert.equal(next.label('Collapse discovery panel').getAttribute('aria-expanded'),'true');
    assert.equal(next.label('Expand positions').getAttribute('aria-expanded'),'false');
    next.label('Resize workspace panels').fire('keydown',{key:'ArrowRight'});
    assert.deepEqual(next.saved().ui.panelSizes,[324,0]);
    assert.equal(next.orders.length,0);
  } finally { next.view.destroy(); }
});

test('Phomo row actions hide and restore a token without submitting orders', () => {
  const f = fixture();
  try {
    const row = f.cls('ph-token-table').querySelector('tbody').children[0], id = row.dataset.key;
    const more = nodes(row).find((n) => n.getAttribute('aria-label')?.startsWith('More actions'));
    more.click(); f.text('Hide token').click();
    assert.equal(f.saved().hidden.length,1);
    assert.equal(f.cls('ph-token-table').querySelector('tbody').children.some((n) => n.dataset.key === id),false);
    f.text('Filters').click(); f.text('Restore hidden tokens').click();
    assert.equal(f.saved().hidden.length,0);
    assert.equal(f.cls('ph-token-table').querySelector('tbody').children.some((n) => n.dataset.key === id),true);
    assert.equal(f.orders.length,0);
  } finally { f.view.destroy(); }
});

test('Phomo rich search switches trader and token results and opens a selected result safely', async () => {
  const f = fixture();
  try {
    const search = f.label('Search tokens, traders or contract address');
    search.value = 'smart'; search.fire('input');
    await new Promise((done) => setTimeout(done,180));
    f.label('Search traders').click();
    const rows = f.cls('ph-search-results').querySelectorAll('.ph-search-row');
    assert.ok(rows.length > 0);
    assert.ok(rows.every((n) => n.textContent.includes('Simulated trader')));
    search.fire('keydown',{key:'ArrowDown'});
    assert.equal(document.activeElement,rows[0]);
    rows[0].click();
    assert.ok(f.cls('phs-profile'));
    assert.equal(f.cls('ph-search-results').hidden,true);
    f.label('Phomo home').click();
    const id = Number(f.cls('ph-token-table').querySelector('tbody').children[0].dataset.key);
    search.value = f.market.row(id).ticker; search.fire('input');
    await new Promise((done) => setTimeout(done,180));
    f.label('Search tokens').click();
    const firstResult = f.market.find(search.value)[0];
    f.cls('ph-search').fire('submit');
    assert.equal(f.focus.at(-1),firstResult);
    assert.equal(f.orders.length,0);
  } finally { f.view.destroy(); }
});

test('Phomo position detail opens the sell form without submitting a second order', () => {
  const f = fixture();
  try {
    f.cls('ph-quickbuy').click(); f.market.advance(8); f.refresh();
    byText(f.cls('ph-position-list'),'View').click();
    assert.ok(f.cls('ph-position-modal'));
    assert.ok(f.cls('phs-position-detail').textContent.includes('Practice position'));
    const chart = globalThis.__phomoChart;
    byText(f.cls('phs-position-trade'),'Sell').click();
    assert.equal(chart.destroyed,true);
    assert.equal(f.cls('ph-position-modal'),undefined);
    assert.ok(f.cls('tspc-layout'));
    assert.equal(f.orders.length,1);
    assert.equal(f.text('Sell').getAttribute('aria-pressed'),'true');
  } finally { f.view.destroy(); }
});

test('Phomo footer uses supplied public spot quotes and leaves unsupported assets unknown', () => {
  let quotes = {sol:141.2,eth:2100.5,hype:78.17};
  const f = fixture({spotPrices:() => quotes});
  try {
    const ticker = f.cls('ph-ticker');
    assert.equal(ticker.children[0].textContent,'BTC —');
    assert.equal(ticker.children[1].textContent,'ETH $2,100.50');
    assert.equal(ticker.children[2].textContent,'SOL $141.20');
    assert.equal(ticker.children[3].textContent,'HYPE $78.17');
    assert.match(ticker.children[0].title,/not available/);
    quotes = {sol:142,hype:NaN}; f.refresh();
    assert.equal(ticker.children[2].textContent,'SOL $142.00');
    assert.equal(ticker.children[3].textContent,'HYPE —');
  } finally { f.view.destroy(); }
});

test('Phomo selecting a token on a phone closes the discovery drawer', () => {
  const before = globalThis.innerWidth; globalThis.innerWidth = 360;
  const f = fixture();
  try {
    const rows = f.cls('ph-token-table').querySelector('tbody').children;
    f.view.openCoin(Number(rows[0].dataset.key));
    assert.equal(f.cls('ph-root').classList.contains('is-rail-collapsed'),true);
    f.label('Expand discovery panel').click();
    assert.equal(f.cls('ph-root').classList.contains('is-rail-collapsed'),false);
    f.cls('ph-nav-token').click();
    assert.equal(f.cls('ph-root').classList.contains('is-rail-collapsed'),true);
    f.label('Your profile').click();
    assert.equal(f.cls('ph-root').classList.contains('is-rail-collapsed'),true);
    assert.equal(f.label('Your positions').hidden,true);
  } finally { f.view.destroy(); if (before === undefined) delete globalThis.innerWidth; else globalThis.innerWidth = before; }
});

test('Phomo side feed and watchlist preserve the central table and do not refresh its hidden rows', () => {
  const f=fixture();
  try {
    const table=f.cls('ph-token-table'), row=table.querySelector('tbody').children[0], holder=row.children[5].children[0];
    f.nav('Feed');
    assert.equal(f.cls('ph-token-table'),table); assert.equal(f.saved().ui.panels[0].kind,'tokens');
    assert.equal(f.saved().ui.navigationKind,'feed');
    assert.equal(f.cls('ph-nav-social').querySelector('.phs-social').classList.contains('is-compact'),true);
    f.refresh(); assert.equal(row.children[5].children[0],holder,'holder nodes remain stable across updates');
    f.nav('Tokens'); f.label('Collapse discovery panel').click();
    const id=Number(row.dataset.key); f.view.openCoin(id);
    const first=table.querySelector('tbody').children[0]; const text=first.textContent;
    f.market.advance(8); f.refresh();
    assert.equal(table.querySelector('tbody').children[0],first); assert.equal(first.textContent,text,'occluded discovery table receives no updates');
    f.view.closeSub(); f.refresh(); assert.notEqual(first.textContent,text,'discovery refreshes after returning');
  } finally {f.view.destroy();}
});

test('Phomo position modal pauses the covered token chart and resumes it when closed', () => {
  const clock=globalThis.performance;let now=1000;globalThis.performance={now:()=>now};
  const f=fixture();
  try {
    f.cls('ph-quickbuy').click();f.market.advance(8);now+=1000;f.refresh();
    f.view.openCoin(f.orders[0].coin);const coinChart=globalThis.__phomoChart;
    byText(f.cls('ph-position-list'),'View').click();const modalChart=globalThis.__phomoChart;
    assert.notEqual(modalChart,coinChart);const before=coinChart.sets.length;
    f.market.advance(3);now+=1000;f.refresh();assert.equal(coinChart.sets.length,before,'covered token chart is not painted');
    f.label('Close position').click();f.market.advance(3);now+=1000;f.refresh();
    assert.ok(coinChart.sets.length>before,'chart resumes with current market after closing');assert.equal(modalChart.destroyed,true);
  } finally {f.view.destroy();globalThis.performance=clock;}
});
