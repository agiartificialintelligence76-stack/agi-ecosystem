import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarket, KEEP } from '../src/games/trenchingsimulator/engine.js';
import { createCandleReader } from '../src/games/trenchingsimulator/boards/candle-reader.js';
import { createCandleStream } from '../src/games/trenchingsimulator/boards/chart-stream.js';

const candle = t => ({ t, o: 100, h: 102, l: 99, c: 101, v: 2, b: 1, s: 1 });
function fake(rows) {
  const calls = [];
  const m = { t: rows.at(-1)?.t || 0, rows, candles(id, since) {
    calls.push({ id, since }); return m.rows.filter(r => since == null || r.t >= since).map(r => ({ ...r }));
  } };
  return { m, calls };
}
test('chart reader reuses source history, reads only the open tail, and resets on history revision or rewind', () => {
  const { m, calls } = fake(Array.from({ length: 500 }, (_, i) => candle(i)));
  const reader = createCandleReader(m), stream = createCandleStream();
  const first = reader.read(1, 0); stream.update(first);
  assert.equal(reader.read(1, 0), first); assert.equal(stream.update(first).changed, false);
  assert.equal(calls.at(-1).since, 499);
  m.rows.at(-1).c = 101.5; m.rows.push(candle(500)); m.t = 500;
  assert.equal(reader.read(1, 0), first); assert.deepEqual(first, m.rows); assert.equal(stream.update(first).reset, false);
  m.rows[0].h = 120; const corrected = reader.read(1, 1);
  assert.notEqual(corrected, first); assert.equal(corrected[0].h, 120);
  m.t = 40; m.rows.length = 41;
  const rewound = reader.read(1, 1); assert.notEqual(rewound, corrected); assert.deepEqual(rewound, m.rows);
});
test('chart reader follows engine retention, dormant compaction, bounded sparklines and cache eviction', () => {
  const { m, calls } = fake(Array.from({ length: KEEP.candles + 64 }, (_, i) => candle(i)));
  const reader = createCandleReader(m, { maxEntries: 2 }); const first = reader.read(1);
  m.rows.push(candle(KEEP.candles + 64)); m.rows.splice(0, 65); m.t++;
  assert.equal(reader.read(1), first); assert.deepEqual(first, m.rows);
  m.t += 4000; m.rows = [candle(0), candle(4020)];
  const compacted = reader.read(1); assert.notEqual(compacted, first); assert.deepEqual(compacted, m.rows);
  m.t += 60; assert.equal(reader.read(1), compacted, 'unchanged dormant source retains identity');
  const spark = createCandleReader(m, { limit: 32 }); m.rows = Array.from({ length: 1000 }, (_, i) => candle(i));
  const small = spark.read(1); assert.equal(small.length, 32);
  m.rows.push(candle(1000)); m.t++; assert.equal(spark.read(1), small); assert.deepEqual(small, m.rows.slice(-32));
  assert.equal(calls.at(-1).since, 999);
  reader.read(2); reader.read(3); reader.read(1); assert.equal(calls.at(-1).since, undefined, 'evicted coin reloads correctly');
});
test('chart reader equals actual simulator candles across mutable fills and time advances', () => {
  const m = createMarket({ seed: 'stable-candle-reader' }); const reader = createCandleReader(m);
  const id = m.lists().migrated[0]?.id ?? m.lists().new[0].id;
  const rows = reader.read(id, m.stats(id).cdv);
  for (let t = 1; t <= 90; t++) {
    m.advanceTo(t); assert.equal(reader.read(id, m.stats(id).cdv), rows); assert.deepEqual(rows, m.candles(id));
  }
});
