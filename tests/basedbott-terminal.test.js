import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBasedOrders, basedRows, sparklinePath, basedCsvCell } from '../src/games/trenchingsimulator/boards/basedbott-data.js';

test('BasedBott CSV treats formula-like token labels as text and preserves numeric trade data', () => {
  for (const label of ['=1+1', '+1+1', '-1+1', '@SUM(1)', ' \t=1+1', '\r\n+1', '\u0000=1']) {
    assert.equal(basedCsvCell(label), `"'${label}"`);
  }
  assert.equal(basedCsvCell('COIN, "cat"'), '"COIN, ""cat"""');
  assert.equal(basedCsvCell('normal\nlabel'), '"normal\nlabel"');
  assert.equal(basedCsvCell('ALPHA'), '"ALPHA"');
  for (const amount of [0, 0.031, -0.25, 1e-9, 100]) assert.equal(basedCsvCell(amount), `"${amount}"`);
});

function harness() {
  let time = 0;
  const rows = new Map([[0, { id: 0, mc: 100, phase: 'curve' }]]), calls = [], notices = [];
  const api = createBasedOrders({ row: id => rows.get(id), now: () => time,
    order: p => { calls.push(p); return { ok: true }; }, notify: (...n) => notices.push(n) });
  return { api, rows, calls, notices, setTime: t => { time = t; } };
}

test('BasedBott limits trigger once at the intended market-cap crossing and preserve execution settings', () => {
  const h = harness();
  assert.ok(h.api.add({ coin: 0, side: 'buy', sol: .5, target: 80, slippage: .2, priority: 'fast' }));
  h.api.tick(); assert.equal(h.calls.length, 0);
  h.rows.get(0).mc = 79; h.api.tick(); h.api.tick();
  assert.deepEqual(h.calls, [{ coin: 0, side: 'buy', sol: .5, slippage: .2, priority: 'fast' }]);
  assert.equal(h.api.list().length, 0);
  assert.equal(h.api.history()[0].status, 'submitted');
});

test('BasedBott cancels orders without executing and rejects invalid or non-finite sizes', () => {
  const h = harness();
  for (const bad of [0, -1, Infinity, NaN]) assert.equal(h.api.add({ coin: 0, side: 'buy', sol: bad, target: 150 }), null);
  assert.equal(h.api.add({ coin: 0, side: 'sell', frac: 1.1, target: 50 }), null);
  assert.equal(h.api.add({ coin: 0, side: 'buy', sol: 1, target: Infinity }), null);
  const o = h.api.add({ coin: 0, side: 'sell', frac: .5, target: 150 });
  assert.ok(h.api.cancel(o.id)); h.rows.get(0).mc = 200; h.api.tick(); assert.equal(h.calls.length, 0);
});

test('BasedBott DCA follows market time, does not flood after a gap, and stops at the requested count', () => {
  const h = harness(); h.api.add({ coin: 0, side: 'buy', sol: .1, mode: 'dca', interval: 10, count: 3 });
  h.setTime(9); h.api.tick(); assert.equal(h.calls.length, 0);
  h.setTime(10); h.api.tick(); h.api.tick(); assert.equal(h.calls.length, 1);
  h.setTime(100); h.api.tick(); assert.equal(h.calls.length, 2);
  h.api.tick(); assert.equal(h.calls.length, 2);
  h.setTime(110); h.api.tick(); assert.equal(h.calls.length, 3); assert.equal(h.api.list().length, 0);
});

test('BasedBott trailing stop follows new highs and migration snipe waits until the pool opens', () => {
  const h = harness(); h.api.add({ coin: 0, side: 'sell', frac: 1, mode: 'trail', drop: .2 });
  h.rows.get(0).mc = 200; h.api.tick(); h.rows.get(0).mc = 170; h.api.tick(); assert.equal(h.calls.length, 0);
  h.rows.get(0).mc = 159; h.api.tick(); assert.equal(h.calls.length, 1);
  h.api.add({ coin: 0, side: 'buy', sol: .25, mode: 'migration' });
  h.rows.get(0).phase = 'migrating'; h.api.tick(); assert.equal(h.calls.length, 1);
  h.rows.get(0).phase = 'pool'; h.api.tick(); assert.equal(h.calls.length, 2);
  assert.equal(h.api.add({ coin: 0, side: 'buy', sol: .25, mode: 'migration' }), null);
});

test('BasedBott alerts never place an order and failed conditional trades do not retry indefinitely', () => {
  const h = harness(); h.api.add({ coin: 0, side: 'alert', target: 120 }); h.rows.get(0).mc = 121; h.api.tick();
  assert.equal(h.calls.length, 0); assert.equal(h.notices[0][0].status, 'triggered');
  let calls = 0;
  const api = createBasedOrders({ row: () => ({ mc: 100, phase: 'pool' }), now: () => 10,
    order: () => { calls++; return { ok: false, error: 'not_enough_sol' }; } });
  api.add({ coin: 0, side: 'buy', sol: 999, target: 100 }); api.tick(); api.tick();
  assert.equal(calls, 1); assert.equal(api.history()[0].error, 'not_enough_sol');
});

test('BasedBott filtering combines real source/chain, watchlist and risk numbers without inventing missing holders', () => {
  const rows = [{ id: 0, name: 'Alpha', ticker: 'ALP', mc: 10, holders: 5, live: true, chain: 'base', src: 'clanker', born: 1 },
    { id: 1, name: 'Beta', ticker: 'BET', mc: 20, holders: null, live: true, chain: 'base', src: 'clanker', born: 2 },
    { id: 2, name: 'Gamma', ticker: 'GAM', mc: 30, holders: 50, born: 3 }];
  assert.deepEqual(basedRows(rows, { chain: 'base', source: 'clanker', minHolders: 1 }).map(r => r.id), [0]);
  assert.deepEqual(basedRows(rows, { sort: 'watching', watched: new Set([1, 2]), blacklist: new Set([2]) }).map(r => r.id), [1]);
  assert.deepEqual(basedRows(rows, { chain: 'simulated' }).map(r => r.id), [2]);
  assert.deepEqual(basedRows(rows, { minimum: 2000, maximum: 4000, solUsd: 150 }).map(r => r.id), [1]);
  assert.deepEqual(basedRows(rows, { query: '$alp' }).map(r => r.id), [0]);
});

test('BasedBott trend paths remain finite for constant and malformed candle input', () => {
  assert.equal(sparklinePath([{ c: 5 }]), '');
  assert.equal(sparklinePath([{ c: 2 }, { c: 2 }, { c: NaN }]), 'M0.0,28.0 L96.0,28.0');
  assert.doesNotMatch(sparklinePath([{ c: 2 }, { c: 8 }, { c: 4 }]), /NaN|Infinity/);
});
