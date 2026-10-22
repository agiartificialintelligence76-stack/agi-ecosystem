import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarket } from '../src/games/trenchingsimulator/engine.js';
import { createPhomoState, cleanPhomoPrefs, blankPhomoPrefs, PHOMO_SAVE_KEY } from '../src/games/trenchingsimulator/boards/phomo-state.js';
import { closedPositionStats, positionDetail, profileEquity } from '../src/games/trenchingsimulator/boards/phomo-data.js';
import { Element, installDom, socialModuleURL, byLabel, byClass, byText, nodes } from './helpers/phomo-dom.js';

const { mountPhomoSocial, mountPhomoProfile, mountPhomoPosition } = await import(socialModuleURL);
function fixture() {
  const store = installDom(), market = createMarket({ seed: 12345, solUsd: 100, startSol: 100 });
  const state = createPhomoState(market, { storage: localStorage, playerName: 'Player' });
  const host = new Element('main'); document.body.append(host);
  const opens = [], cards = []; let replayOpens = 0;
  const ctx = { market, solUsd: 100, playerName: () => 'Player', saveCard: (w) => cards.push(w), openReplays: () => replayOpens++ };
  const coin = market.lists({ limit: 1 }).new[0].id;
  const hooks = { state, onCoin: (...args) => opens.push(args), onTrader: (...args) => opens.push(args), onPosition: (...args) => opens.push(args), onShare: (p) => cards.push(p) };
  return { store, market, state, host, ctx, coin, hooks, opens, cards, replayOpens: () => replayOpens };
}
const form = (root, n = 0) => root.querySelectorAll('form')[n];
const fill = (root, label, value) => { const n = byLabel(root, label); assert.ok(n, label); n.value = value; return n; };

test('Phomo state validates local identity and saved dimensions without losing automatic panel sizes', () => {
  const f = fixture();
  f.state.setProfile({ displayName: 'Local\u0001 person', handle: 'name<script>', bio: 'x'.repeat(500), avatar: 'evil', banner: 'url(https://bad)' });
  f.state.setPrefs({ ui: { discoveryWidth: 900, positionsWidth: 20, panelSizes: [0, 600, -2, 99999, 500], positionsCollapsed: true,
    panels: [{ kind: 'tokens', tokenNameWidth: 999 }] } });
  const restored = createPhomoState(f.market, { storage: localStorage });
  assert.equal(restored.profile('you').name, 'Local person'); assert.equal(restored.profile('you').handle, 'namescript');
  assert.equal(restored.profile('you').bio.length, 160); assert.equal(restored.profile('you').avatar, '🍜');
  assert.equal(restored.profile('you').banner, 'violet');
  assert.deepEqual(restored.prefs.ui.panelSizes, [0, 600, 220, 1800]);
  assert.equal(restored.prefs.ui.discoveryWidth, 420); assert.equal(restored.prefs.ui.positionsWidth, 240);
  assert.equal(restored.prefs.ui.panels[0].tokenNameWidth, 420); assert.equal(restored.prefs.ui.positionsCollapsed, true);
  assert.ok(f.store.has(PHOMO_SAVE_KEY)); assert.equal(cleanPhomoPrefs(blankPhomoPrefs()).ui.panels[0].tokenNameWidth, 210);
});

test('Closed token statistics exclude open or unknown positions; observed equity never manufactures a full period', () => {
  const stats = closedPositionStats([
    { open: true, buys: 1, total: 99, first: 0, last: 10 },
    { open: false, buys: 1, total: 2, first: 0, last: 20 },
    { open: false, buys: 2, total: -1, first: 10, last: 30 },
    { open: false, buys: 1, total: 0, first: 20, last: 40 },
    { open: false, buys: 1, total: null }, { open: false, buys: 0, total: 1 },
  ], 100);
  assert.deepEqual(stats, { count: 3, wins: 1, losses: 1, breakeven: 1, winRate: 1 / 3, pnlUsd: 100, averageHold: 20 });
  const market = { t: 100, solUsd: 100, equity: () => [{ t: 90, v: 10 }, { t: 100, v: 11 }] };
  assert.deepEqual(profileEquity(market, 86400), { points: [{ t: 90, v: 1000 }, { t: 100, v: 1100 }], observed: 10, changeUsd: 100 });
  assert.equal(profileEquity(market, 1).changeUsd, null);
});

test('Phomo feed supports real local replies, edits and deletion without changing authors or executing an order', () => {
  const f = fixture(), parent = f.state.addNote({ text: 'Initial thesis', coin: f.coin }).note;
  const view = mountPhomoSocial(f.host, f.ctx, { ...f.hooks, kind: 'feed' });
  byLabel(f.host, 'Open conversation').click(); byText(f.host, 'Write reply').click();
  fill(f.host, 'Reply text', 'Reply by me'); form(byClass(f.host, 'phs-overlay').parentNode, 1).fire('submit');
  assert.equal(f.state.notes({ parentKey: parent.id })[0].text, 'Reply by me');
  const replyEvent = f.state.feed().find((e) => e.parentKey === parent.id); assert.equal(replyEvent.traderKey, 'you');
  assert.equal(f.state.feed({ replies: false, types: ['note'] }).length, 1);
  f.state.editNote(parent.id, 'Edited thesis'); view.update(true);
  assert.ok(f.host.textContent.includes('Edited thesis')); assert.equal(f.state.editNote(parent.id, '').ok, false);
  f.state.removeNote(parent.id); view.update(true); assert.equal(f.state.notes().some((n) => n.id === parent.id), false);
  assert.equal(f.market.orders(300).length, 0); view.destroy();
});

test('Price alerts can pause, edit and rearm; a triggered rule notifies once per explicit rearm', () => {
  const f = fixture(), result = f.state.addAlert({ coin: f.coin, metric: 'marketCap', valueUsd: 1 });
  f.state.updateAlert(result.alert.id, { active: false }); f.state.tick(); assert.equal(f.state.notifications().length, 0);
  assert.equal(f.state.updateAlert(result.alert.id, { valueUsd: -1 }).ok, false);
  assert.equal(f.state.updateAlert(result.alert.id, { active: true, valueUsd: 2 }).ok, true);
  f.state.tick(); f.state.tick(); assert.equal(f.state.notifications().length, 1);
  assert.equal(f.state.alerts()[0].active, false);
  f.state.updateAlert(result.alert.id, { rearm: true }); f.state.tick(); f.state.tick(); assert.equal(f.state.notifications().length, 2);
  assert.equal(f.market.orders(300).length, 0);
});

test('Trader alert filters reject disabled or below-threshold activity and use held values rather than invented cash', () => {
  const rows = [{ id: 0, ticker: 'TEST', name: 'Token', live: false, born: 0, mc: 100 }], events = [];
  const market = { seed: 'alerts', t: 100, n: 1, solUsd: 100, startSol: 100, size: { coins: 1 }, player: { worth: 100 },
    get feedSeq() { return events.at(-1)?.q || 0; }, row: (id) => rows[id], info: () => ({ mint: 'mint', live: false }), find: () => [0],
    stats: () => ({ price: 1, mc: 100, liq: 1, vol5m: 1, vol1h: 1, kols: [] }), candles: () => [], orders: () => [], positions: () => [], isExt: () => false,
    feed: () => events, smartWallets: () => [{ n: 0, addr: 'smart', d7: { pnl: 0, trades: 0, won: 0, lost: 0, vol: 0, dist: [] }, buys: 1, sells: 0, in: 10, out: 0, pnl: 0, upnl: 0, value: 10, open: [{ coin: 0, tok: 1, in: 10, out: 0, value: 10 }] }] };
  const s = createPhomoState(market); s.toggleFollow('smart:0');
  const add = () => { events.push({ q: events.length + 1, t: 100, kind: 'smart_buy', c: 0, smart: 0, sol: 2 }); s.tick(); };
  s.setTraderAlerts({ disabled: ['smart:0'] }); add(); assert.equal(s.notifications().length, 0);
  s.setTraderAlerts({ disabled: [], minTradeUsd: 300 }); add(); assert.equal(s.notifications().length, 0);
  s.setTraderAlerts({ minTradeUsd: 100, minPortfolioUsd: 1001 }); add(); assert.equal(s.notifications().length, 0);
  s.setTraderAlerts({ minPortfolioUsd: 900, minMarketCapUsd: 11000 }); add(); assert.equal(s.notifications().length, 0);
  s.setTraderAlerts({ minMarketCapUsd: 9000, maxMarketCapUsd: 11000 }); add(); assert.equal(s.notifications().length, 1);
});

test('Alerts view refreshes arriving token choices, edits saved rules and reuses rows through empty transitions', () => {
  const f = fixture(), view = mountPhomoSocial(f.host, f.ctx, { ...f.hooks, kind: 'alerts' });
  const coinInput = byLabel(f.host, 'Alert token'), before = new Set(coinInput.children.map((n) => n.value));
  f.market.advance(150); view.update(true); assert.ok(coinInput.children.some((n) => !before.has(n.value)), 'newly arriving tokens become alert choices without remounting');
  coinInput.value = String(f.coin); fill(f.host, 'Alert threshold in dollars', '1'); form(f.host).fire('submit');
  assert.equal(f.state.alerts().length, 1); assert.ok(!byClass(f.host, 'phs-alert').textContent.includes('No price alerts'));
  byText(f.host, 'Pause').click(); assert.equal(f.state.alerts()[0].active, false);
  byText(f.host, 'Edit').click(); fill(f.host, 'Alert threshold in dollars', '2'); form(f.host).fire('submit');
  assert.equal(f.state.alerts()[0].valueUsd, 2); byText(f.host, 'Resume').click(); f.state.tick(); view.update(true);
  assert.ok(byText(f.host, 'Rearm')); byText(f.host, 'Rearm').click(); assert.equal(f.state.alerts()[0].firedAt, null);
  view.destroy();
});

test('Position detail uses recorded history, paginates eleven swaps, and Buy/Sell only open forms', () => {
  const f = fixture();
  assert.equal(f.market.order({ coin: f.coin, side: 'buy', sol: .25, slippage: .99 }).ok, true); f.market.advance(5);
  const real = positionDetail(f.market, f.coin); assert.equal(real.history.length, 1); assert.equal(real.investedUsd, f.market.positions()[0].invested * 100);
  assert.equal(real.averageEntryUsd, f.market.positions()[0].cost / f.market.positions()[0].tokens * 100);
  const original = f.market.orders;
  f.market.orders = () => Array.from({ length: 24 }, (_, i) => ({ id: i, coin: f.coin, status: 'filled', doneAt: i, side: 'buy', tok: 10, spent: i + 1, mc: 100 }));
  const before = f.market.player.sol, view = mountPhomoPosition(f.host, f.ctx, { coin: f.coin }, f.hooks), chart = globalThis.__phomoChart;
  assert.equal(chart.sets.at(-1).tf, 1, 'ALL keeps short recorded histories in individual one-second candles');
  byText(f.host, '4H').click(); assert.equal(chart.sets.at(-1).tf, 1, 'a long selected window does not fabricate a long retained history');
  assert.equal(f.host.querySelector('tbody').children.length, 11); byText(f.host, 'Next').click(); assert.ok(f.host.textContent.includes('2 / 3'));
  byText(f.host, 'Next').click(); assert.equal(f.host.querySelector('tbody').children.length, 2);
  fill(f.host, 'Minimum transaction size in dollars', '2300').fire('input'); assert.equal(f.host.querySelector('tbody').children.length, 2);
  byText(f.host, 'Buy').click(); byText(f.host, 'Sell').click(); assert.deepEqual(f.opens, [[f.coin, { side: 'buy' }], [f.coin, { side: 'sell' }]]);
  assert.equal(f.market.player.sol, before); byText(f.host, 'Line').click(); assert.equal(chart.style, 'line');
  byText(f.host, 'Swaps').click(); assert.deepEqual(chart.sets.at(-1).marks, []);
  view.destroy(); assert.equal(chart.destroyed, true); f.market.orders = original;
});

test('Profile editing, real equity and saved replays remain local and share the Phomo card schema', () => {
  const f = fixture(); f.market.advance(8);
  const view = mountPhomoProfile(f.host, f.ctx, 'you', f.hooks);
  assert.ok(f.host.textContent.includes('Practice cash')); assert.ok(f.host.querySelector('svg'));
  byText(f.host, 'Edit profile').click(); fill(f.host, 'Display name', 'Local Name'); fill(f.host, 'Username', 'local_name'); fill(f.host, 'Bio', 'A local bio.');
  form(byClass(f.host, 'phs-modal')).fire('submit'); assert.equal(f.state.profile('you').bio, 'A local bio.'); assert.ok(f.host.textContent.includes('Local Name'));
  byText(f.host, 'Saved replays').click(); assert.equal(f.replayOpens(), 1);
  byText(f.host, 'Share').click(); assert.equal(f.cards[0].brand, 'social'); assert.ok(Array.isArray(f.cards[0].rows)); assert.equal(typeof f.cards[0].big, 'string');
  byLabel(f.host, 'Profile position asset type').value = 'perps'; byLabel(f.host, 'Profile position asset type').fire('change');
  assert.ok(f.host.textContent.includes('Perps are view-only on web')); assert.equal(f.market.orders().length, 0);
  view.destroy(); assert.equal(f.host.children.length, 0);
});
