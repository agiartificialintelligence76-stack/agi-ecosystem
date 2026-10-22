import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarket } from '../src/games/trenchingsimulator/engine.js';
import { createPhomoState } from '../src/games/trenchingsimulator/boards/phomo-state.js';
import { traderProfiles } from '../src/games/trenchingsimulator/boards/phomo-data.js';
import { viewModule, installDom, Element, nodes, byClass, byLabel, byText } from './helpers/phomo-dom.js';

const { aggregateClan, mountPhomoClans, PHOMO_CLANS } = await import(viewModule(new URL('../src/games/trenchingsimulator/boards/phomo-clans.js', import.meta.url)));

test('clan aggregation deduplicates NPC membership, sums known positions, and keeps complete P&L unknown when incomplete', () => {
  const market = { row: (id) => id === 9 ? { id, live: true } : id < 5 ? { id, ticker: `T${id}` } : null };
  const first = { key: 'smart:0', kind: 'smart', simulated: true, pnlUsd: 20, unrealizedUsd: 3, trades: 4,
    holdings: [{ coin: 1, tok: 10, valueUsd: 100, pnlUsd: 10 }, { coin: 2, tok: 4, valueUsd: 20, pnlUsd: -2 },
      { coin: 9, tok: 5, valueUsd: 9000, pnlUsd: 5000 }] };
  const second = { key: 'smart:1', kind: 'smart', simulated: true, pnlUsd: -5, unrealizedUsd: 7, trades: 3,
    holdings: [{ coin: 1, tok: 8, valueUsd: 50, pnlUsd: -4 }, { coin: 1, tok: 8, valueUsd: 50, pnlUsd: -4 }] };
  const rows = [first, first, second, { ...first, key: 'human', simulated: false }, { ...first, key: 'you' }, { ...first, key: 'kol:caller', kind: 'kol' }];
  const group = aggregateClan(market, rows, 'smart');
  assert.equal(group.memberCount, 2); assert.equal(group.trades, 7); assert.equal(group.pnlUsd, 25);
  assert.equal(group.positionUsd, 170); assert.equal(group.holdings.length, 2);
  assert.deepEqual(group.holdings[0].memberKeys, ['smart:0', 'smart:1']);
  assert.equal(group.holdings[0].members, 2); assert.equal(group.holdings[0].positionUsd, 150); assert.equal(group.holdings[0].pnlUsd, 6);
  assert.deepEqual(group.top.map((h) => h.coin), [1, 2]);
  second.pnlUsd = null; second.holdings[0].pnlUsd = null;
  const incomplete = aggregateClan(market, rows, 'smart');
  assert.equal(incomplete.pnlUsd, null); assert.equal(incomplete.knownPnlMembers, 1);
  assert.equal(incomplete.holdings[0].pnlUsd, null); assert.equal(incomplete.holdings[0].positionUsd, 150);
  assert.equal(aggregateClan(market, rows, 'not-a-clan'), null);
});

test('clan membership and metrics come from actual engine profiles; fictional callers do not acquire invented P&L', () => {
  const market = createMarket({ seed: 'phomo-clan-aggregation', solUsd: 100 });
  market.advance(120);
  const profiles = traderProfiles(market), smart = aggregateClan(market, profiles, 'smart'), kol = aggregateClan(market, profiles, 'kol');
  assert.equal(smart.memberCount, market.smartWallets().length);
  assert.equal(smart.pnlUsd, market.smartWallets().reduce((sum, p) => sum + (p.pnl + p.upnl) * 100, 0));
  assert.equal(smart.trades, market.smartWallets().reduce((sum, p) => sum + p.buys + p.sells, 0));
  assert.equal(kol.memberCount, profiles.filter((p) => p.kind === 'kol').length);
  assert.equal(kol.pnlUsd, null); assert.equal(kol.knownPnlMembers, 0);
  for (const h of kol.holdings) assert.equal(h.pnlUsd, null);
  assert.ok(smart.holdings.every((h) => h.members > 0 && h.memberKeys.every((key) => smart.members.some((p) => p.key === key))));
});

test('clan directory, follow-all, member navigation and private thesis use existing state without ordering', () => {
  installDom();
  const market = createMarket({ seed: 'phomo-clans-ui', solUsd: 100 });
  market.advance(10);
  const state = createPhomoState(market, { storage: globalThis.localStorage }), host = new Element('main');
  const visits = [], coinVisits = [];
  const view = mountPhomoClans(host, { market, solUsd: 100 }, { state, onTrader: (key) => visits.push(key), onCoin: (id) => coinVisits.push(id) });
  assert.equal(nodes(host).filter((n) => n.classList.contains('phc-directory-card')).length, PHOMO_CLANS.length);
  byClass(host, 'phc-directory-card').fire('click');
  assert.match(host.textContent, /Signal Society/); assert.match(host.textContent, /all simulated/);
  const all = nodes(host).find((n) => n.tagName === 'button' && /^Follow all/.test(n.textContent));
  all.fire('click');
  const profiles = traderProfiles(market).filter((p) => p.kind === 'smart');
  assert.ok(profiles.every((p) => state.isFollowing(p.key)));
  assert.ok(traderProfiles(market).filter((p) => p.kind === 'kol').every((p) => !state.isFollowing(p.key)));
  assert.equal(market.orders(100).length, 0, 'following a clan never places any practice or real order');
  byClass(host, 'phc-person').fire('click'); assert.ok(visits[0].startsWith('smart:'));
  byText(host, 'Thesis').fire('click');
  byLabel(host, 'Clan thesis').value = 'Observe entries <script>local text</script>';
  byClass(host, 'phc-composer').fire('submit');
  assert.match(host.textContent, /Observe entries <script>local text<\/script>/);
  assert.equal(nodes(host).some((n) => n.tagName === 'script'), false);
  assert.equal(state.notes().length, 1); assert.equal(state.notes()[0].traderKey, null, 'note is not attributed to a fictional member');
  byText(host, 'Delete').fire('click'); assert.equal(state.notes().length, 0);
  byText(host, 'Clans').fire('click'); assert.equal(nodes(host).filter((n) => n.classList.contains('phc-directory-card')).length, 2);
  view.destroy(); assert.equal(host.children.length, 0);
});
