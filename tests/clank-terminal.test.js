import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMarket } from '../src/games/trenchingsimulator/engine.js';
import { clankFeed, clankPair, validateClankLaunch } from '../src/games/trenchingsimulator/boards/clank-data.js';

test('Clank New includes every bonding phase in true launch order without duplicate rows', () => {
  const rows = [
    { id: 1, born: 10, pair: 'ETH' }, { id: 2, born: 30, pair: 'SPCX' },
    { id: 3, born: 20, pair: 'ETH' }, { id: 4, born: 30, pair: 'SPCX' },
  ];
  const market = { lists: () => ({ new: [rows[0], rows[1]], stretch: [rows[2], rows[1]], migrated: [rows[3]], trending: [rows[3], rows[1]] }),
    find: () => [2, 3], row: (id) => rows.find((r) => r.id === id) };
  assert.deepEqual(clankFeed(market, { sort: 'new' }).map((r) => r.id), [4, 2, 3, 1]);
  assert.deepEqual(clankFeed(market, { sort: 'new', pair: 'SPCX' }).map((r) => r.id), [4, 2]);
  assert.deepEqual(clankFeed(market, { query: 'some coin', pair: 'ETH' }).map((r) => r.id), [3]);
  assert.deepEqual(clankFeed(market, { limit: 1 }).map((r) => r.id), [4]);
});

test('Clank never labels an unknown live pairing as ETH', () => {
  assert.equal(clankPair({ live: true }), 'Unknown');
  assert.equal(clankPair({ live: true, pair: 'sol' }), 'Unknown');
  assert.equal(clankPair({ live: true, pair: 'ETH' }), 'Unknown');
  assert.equal(clankPair({ live: true, pair: '0x1234567890123456789012345678901234567890' }), 'Unknown');
  assert.equal(clankPair({ live: true, quoteAsset: 'spcx' }), 'SPCX');
  assert.equal(clankPair({ live: true, quoteAsset: 'unverified' }), 'Unknown');
  assert.equal(clankPair({ name: 'A simulated coin' }), 'ETH');
});

test('Clank launch validation rejects broken tickers, unknown pairs, and invalid money', () => {
  const valid = { name: ' Space cat ', ticker: '$cat', pair: 'SPCX', initialBuy: '10,50' };
  assert.deepEqual(validateClankLaunch(valid), { ok: true, name: 'Space cat', ticker: 'CAT', pair: 'SPCX', amount: 10.5 });
  for (const patch of [{ ticker: '<svg>' }, { ticker: 'WAYTOOLONGTICKER' }, { name: ' ' }, { pair: 'UNKNOWN' },
    { initialBuy: '-10' }, { initialBuy: 'Infinity' }, { initialBuy: '1e100' }]) {
    assert.equal(validateClankLaunch({ ...valid, ...patch }).ok, false, JSON.stringify(patch));
  }
  assert.equal(validateClankLaunch({ ...valid, initialBuy: '' }).amount, 0);
});

test('A newly created Clank coin is searchable and appears in the chosen stock-pair feed', () => {
  const market = createMarket({ seed: 'clank-launch-feed', startSol: 10, config: { warmup: 0 } });
  const fields = validateClankLaunch({ name: 'Launchpad Ghost', ticker: 'GHOST', pair: 'NVDA', initialBuy: '10' });
  const launched = market.launchCoin({ ...fields, emoji: '👻', line: 'A practice launch' });
  assert.equal(launched.ok, true);
  assert.equal(clankFeed(market, { sort: 'new', pair: 'NVDA' })[0].id, launched.id);
  assert.equal(clankFeed(market, { query: 'GHOST', pair: 'NVDA' })[0].id, launched.id);
  assert.equal(clankFeed(market, { query: 'GHOST', pair: 'SPCX' }).length, 0);
  assert.equal(market.quote({ coin: launched.id, side: 'buy', sol: fields.amount / 150 }).ok, true);
});
