import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/games/trenchingsimulator/run.js';
import { replay } from '../src/games/trenchingsimulator/engine.js';
import { captureRunReplay, replayFrame, replayTradeAt, createReplayClock, sampleReplayPoints,
  REPLAY_LIMITS } from '../src/games/trenchingsimulator/replay-data.js';
import { createReplayArchive, validArchivedReplay, REPLAY_ARCHIVE_KEY, REPLAY_ARCHIVE_LIMITS }
  from '../src/games/trenchingsimulator/replay-archive.js';

const candle = (t, price) => ({ t, o: price, h: price * 1.1, l: price * 0.9, c: price, v: 2 });
const replayStorage = () => { const entries = new Map(); return { getItem: (k) => entries.get(k) ?? null,
  setItem: (k, v) => entries.set(k, v) }; };
function liveFixture() {
  const bars = [candle(0, 100), candle(10, 200), candle(20, 300)];
  const equity = [{ t: 0, v: 10 }, { t: 10, v: 12 }, { t: 20, v: 11 }];
  const orders = [{ id: 1, coin: 0, ticker: 'REAL', side: 'buy', t: 1, doneAt: 8, status: 'filled', sol: 1, spent: 1, tok: 100, mc: 120 },
    { id: 2, coin: 0, ticker: 'REAL', side: 'sell', t: 12, doneAt: 13, status: 'filled', frac: 0.5, got: 0.6, tok: 50 },
    { id: 3, coin: 0, ticker: 'REAL', side: 'sell', t: 19, doneAt: null, status: 'pending', frac: 1 }];
  const market = { seed: 'live-fixture', live: true, solUsd: 100, startSol: 10, n0: 0, n: 400, t: 20, config: {},
    orders: () => orders, candles: () => bars, equity: () => equity, positions: () => [{ id: 0 }],
    row: () => ({ id: 0, ticker: 'REAL', name: 'A recorded real coin', born: -86400, live: true }),
    log() { throw Error('A live replay must never request a simulation log'); } };
  const run = { market, seed: market.seed, live: 'robinhood', realTime: true, clock: 20, solUsd: 100, start: 10, terminal: 'social', result: () => ({ placed: 3 }) };
  return { run, bars, equity, orders };
}

test('real-coin practice recordings retain simulated-price provenance and reopen alongside legacy live recordings', () => {
  const legacy = captureRunReplay(liveFixture().run);
  assert.equal(legacy.practice, undefined);
  assert.equal(validArchivedReplay(legacy), true);
  for (const flag of ['livePractice', 'clankPractice']) {
    const { run } = liveFixture(); run.market[flag] = true;
    const record = captureRunReplay(run);
    assert.equal(record.practice, true);
    assert.equal(record.live, true);
    assert.equal(record.replayable, false, 'real discovery is recorded, never recreated from a seed');
    const storage = replayStorage(), archive = createReplayArchive(storage, { now: () => 1000 });
    const saved = archive.save(record, 'Practice on real coins');
    assert.equal(saved.ok, true);
    assert.deepEqual(createReplayArchive(storage).get(saved.id), record);
    assert.equal(validArchivedReplay({ ...record, practice: 'true' }), false);
  }
});

test('a recorded simulated run retains the exact seed, configuration and order steps, independently of playback', () => {
  const run = createRun({ seed: 12345, startSol: 100, solUsd: 100, terminal: 'social', currency: 'usd' });
  const coin = run.market.lists({ limit: 1 }).new[0].id;
  assert.equal(run.order({ coin, side: 'buy', sol: 0.25, slippage: 0.99 }).ok, true);
  for (let i = 0; i < 20; i++) run.tick(0.25);
  assert.equal(run.order({ coin, side: 'sell', frac: 0.5, slippage: 0.99 }).ok, true);
  for (let i = 0; i < 20; i++) run.tick(0.25);
  run.end();
  const record = captureRunReplay(run);
  assert.equal(validArchivedReplay(record), true, 'a finished simulated run must pass the archive validator');
  assert.equal(record.live, false);
  assert.equal(record.replayable, true);
  assert.equal(record.orders.length, 2);
  assert.equal(record.orders.every((o) => o.status === 'filled'), true);
  const again = replay({ seed: record.seed, solUsd: record.solUsd, startSol: record.startSol,
    config: record.config, log: record.log, until: record.until });
  assert.deepEqual(again.orders(), run.market.orders());
  assert.deepEqual(again.positions(), run.market.positions());
  assert.deepEqual(again.equity(0), run.market.equity(0));
  assert.equal(replayFrame(record, record.duration, coin).worth, run.market.equity(0).at(-1).v);
  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(record.coins[0].candles[0]), true);
  const saved = JSON.stringify(record);
  run.market.advance(2);
  assert.equal(JSON.stringify(record), saved, 'later market mutation cannot change the captured run');
  assert.throws(() => { record.orders[0].spent = 999; }, TypeError);
});

test('live replay uses retained observations only, hides future closes and fills, and never fabricates a path', () => {
  const f = liveFixture();
  const record = captureRunReplay(f.run);
  assert.equal(record.live, true);
  assert.equal(record.chain, 'robinhood');
  assert.equal(record.replayable, false);
  assert.deepEqual(record.log, []);
  const early = replayFrame(record, 5, 0);
  assert.equal(early.marketCap, null, 'the close/high/low of the first stored candle are not known before it completes');
  assert.deepEqual(early.candles, []);
  assert.deepEqual(early.equity, [{ t: 0, v: 10 }]);
  assert.equal(early.worth, 10, 'no interpolation using the later value');
  assert.equal(early.orders[0].status, 'pending');
  assert.equal(early.orders[0].spent, 0);
  assert.equal(early.marks.length, 0);
  const middle = replayFrame(record, 10, 0);
  assert.equal(middle.marketCap, 100);
  assert.equal(middle.candles.length, 1);
  assert.deepEqual(middle.marks, [{ t: 8, side: 'buy' }]);
  assert.equal(middle.worth, 12);
  assert.equal(middle.pnl, 2);
  const end = replayFrame(record, 999, 0);
  assert.equal(end.time, 20);
  assert.equal(end.candles.length, 3);
  assert.equal(end.marketCap, 300);
  assert.equal(end.orders[2].status, 'pending', 'an order pending at capture never acquires an invented fill');
  assert.equal(replayFrame(record, -100, 0).time, 0);
  f.bars[0].c = 12345; f.equity[0].v = 999; f.orders[0].spent = 999;
  assert.equal(record.coins[0].candles[0].c, 100);
  assert.equal(record.equity[0].v, 10);
  assert.equal(record.orders[0].spent, 1);
});

test('missing live chart and portfolio history stay unknown even when the current token quote exists', () => {
  const f = liveFixture();
  f.bars.length = 0; f.equity.length = 0;
  const record = captureRunReplay(f.run), frame = replayFrame(record, 20);
  assert.deepEqual(frame.candles, []);
  assert.deepEqual(frame.equity, []);
  assert.equal(frame.marketCap, null);
  assert.equal(frame.worth, null);
  assert.equal(frame.pnl, null);
  assert.equal(record.coverage.equityFrom, null);
});

test('recorded runs survive reopening, stay independent of returned records, and can be removed', () => {
  const store = replayStorage(), archive = createReplayArchive(store, { now: () => 1720000000000 });
  const record = captureRunReplay(liveFixture().run);
  assert.equal(validArchivedReplay(record), true);
  const saved = archive.save(record, 'Phomo · Free play');
  assert.equal(saved.ok, true);
  const reopened = createReplayArchive(store);
  assert.equal(reopened.list()[0].trades, 2);
  assert.deepEqual(reopened.get(saved.id), record);
  const detached = reopened.get(saved.id); detached.orders[0].spent = 99;
  assert.equal(reopened.get(saved.id).orders[0].spent, record.orders[0].spent);
  assert.equal(reopened.remove(saved.id), true);
  assert.deepEqual(createReplayArchive(store).list(), []);
  assert.equal(reopened.remove('absent'), false);
});

test('replay archive caps saved runs and storage while keeping the newest recordings', () => {
  const store = replayStorage(); let at = 1;
  const archive = createReplayArchive(store, { now: () => at++ });
  const record = captureRunReplay(liveFixture().run);
  for (let i = 0; i < 12; i++) assert.equal(archive.save(record, `Run ${i}`).ok, true);
  assert.equal(archive.list().length, REPLAY_ARCHIVE_LIMITS.runs);
  assert.equal(archive.list()[0].label, 'Run 11');
  assert.equal(archive.list().at(-1).label, 'Run 4');
  assert.ok(store.getItem(REPLAY_ARCHIVE_KEY).length < REPLAY_ARCHIVE_LIMITS.characters);
});

test('damaged or unavailable replay storage fails safely without accepting invalid history', () => {
  const store = replayStorage(), record = captureRunReplay(liveFixture().run);
  store.setItem(REPLAY_ARCHIVE_KEY, '{broken');
  assert.deepEqual(createReplayArchive(store).list(), []);
  const bad = JSON.parse(JSON.stringify(record)); bad.coins[0].candles[0].availableAt = -1;
  assert.equal(validArchivedReplay(bad), false);
  store.setItem(REPLAY_ARCHIVE_KEY, JSON.stringify({ v: 1, runs: [{ id: 'bad', at: 1, record: bad }] }));
  assert.deepEqual(createReplayArchive(store).list(), []);
  const failed = createReplayArchive({ getItem() { throw Error('blocked'); }, setItem() { throw Error('quota'); } });
  assert.equal(failed.save(record).reason, 'storage');
  assert.deepEqual(failed.list(), []);
  assert.equal(createReplayArchive(null).save(record).ok, false);
  assert.equal(createReplayArchive(store).save(bad).reason, 'invalid');
});

test('saved replay validation rejects ambiguous or malformed chronology while preserving a real pre-run candle', () => {
  const record = captureRunReplay(liveFixture().run);
  const invalid = (mutate) => { const r = JSON.parse(JSON.stringify(record)); mutate(r); assert.equal(validArchivedReplay(r), false); };
  invalid((r) => r.equity.reverse());
  invalid((r) => r.coins[0].candles.reverse());
  invalid((r) => { r.coins[0].candles[1].t = r.coins[0].candles[0].t; });
  invalid((r) => { r.coins[0].candles[0].availableAt = 15; r.coins[0].candles[1].availableAt = 12; });
  invalid((r) => { r.orders[1].id = r.orders[0].id; });
  invalid((r) => r.orders.reverse());
  invalid((r) => r.coins.push(JSON.parse(JSON.stringify(r.coins[0]))));
  invalid((r) => { r.orders[0].doneAt = null; });
  invalid((r) => { r.orders[0].spent = -1; });
  invalid((r) => { r.coins[0].candles[0].h = 1; });
  invalid((r) => { r.coins[0].candles[0].v = -1; });
  invalid((r) => { r.coverage = []; });
  invalid((r) => { r.config.untrusted = { nested: { payload: 'unexpected' } }; });
  invalid((r) => { r.orders[0].unexpected = { payload: true }; });
  invalid((r) => { r.solUsd = Number.MAX_VALUE; });
  const before = JSON.parse(JSON.stringify(record));
  before.coins[0].candles[0].t = -600;
  assert.equal(validArchivedReplay(before), true, 'a retained candle before run start is legitimate');
});

test('replay archive quota failures keep old recordings and failed removals intact', () => {
  let blocked = false;
  const data = replayStorage(), store = { getItem: data.getItem, setItem: (k, v) => { if (blocked) throw Error('quota'); data.setItem(k, v); } };
  const archive = createReplayArchive(store), record = captureRunReplay(liveFixture().run);
  const first = archive.save(record, 'Keep this'); assert.equal(first.ok, true);
  const before = data.getItem(REPLAY_ARCHIVE_KEY); blocked = true;
  assert.equal(archive.save(record, 'Cannot fit').reason, 'storage');
  assert.equal(archive.list().length, 1); assert.equal(archive.list()[0].id, first.id);
  assert.equal(archive.remove(first.id), false); assert.equal(archive.list().length, 1);
  assert.equal(data.getItem(REPLAY_ARCHIVE_KEY), before);
  assert.deepEqual(archive.get(first.id), record, 'the previous recording remains exportable after quota errors');
});

test('archive reload ignores duplicate IDs, unsafe filenames and oversized records', () => {
  const store = replayStorage(), record = captureRunReplay(liveFixture().run);
  store.setItem(REPLAY_ARCHIVE_KEY, JSON.stringify({ v: 1, runs: [
    { id: 'one', at: 1, label: 'First', record }, { id: 'one', at: 2, label: 'Duplicate', record },
    { id: '../bad', at: 3, label: 'Unsafe name', record }, { id: 'bad-date', at: 1e100, label: 'Invalid date', record },
  ] }));
  const archive = createReplayArchive(store);
  assert.deepEqual(archive.list().map((x) => x.label), ['First']); assert.deepEqual(archive.get('one'), record);
  const deeplyNested = JSON.parse(JSON.stringify(record)); deeplyNested.extra = { child: { child: { child: true } } };
  assert.equal(archive.save(deeplyNested).reason, 'invalid');
  const large = JSON.parse(JSON.stringify(record)); large.duration = 2000; large.coins = [];
  for (let id = 0; id < REPLAY_LIMITS.coins && JSON.stringify(large).length <= REPLAY_ARCHIVE_LIMITS.record; id++) {
    large.coins.push({ id, name: 'Large history', ticker: 'BIG', live: true, born: 0, from: 1, trimmed: false,
      candles: Array.from({ length: 2000 }, (_, t) => ({ t, o: 1500000000000, h: 2000000000000, l: 1000000000000, c: 1500000000000, v: 1, availableAt: t + 1 })) });
  }
  assert.equal(validArchivedReplay(large), true);
  assert.equal(archive.save(large).reason, 'large');
  const payload = JSON.stringify({ v: 1, runs: [{ id: 'large', at: 1, label: 'Too large', record: large }] });
  assert.ok(payload.length <= REPLAY_ARCHIVE_LIMITS.characters, 'exercise the per-record limit, not only the whole archive limit');
  store.setItem(REPLAY_ARCHIVE_KEY, payload); assert.deepEqual(createReplayArchive(store).list(), []);
});

test('replay capture is bounded across orders, tokens, candles, equity and simulation logs', () => {
  const bars = Array.from({ length: 3000 }, (_, t) => candle(t, 100 + t));
  const equity = Array.from({ length: 8000 }, (_, t) => ({ t, v: 100 + (t % 50) }));
  const orders = Array.from({ length: 360 }, (_, id) => ({ id, coin: id % 120, side: 'buy', ticker: `C${id % 120}`,
    t: id, doneAt: id + 0.5, status: 'filled', sol: 0.1 }));
  const market = { seed: 'large', solUsd: 100, startSol: 100, n0: 0, n: 160000,
    orders: () => orders, candles: () => bars, equity: () => equity,
    row: (id) => ({ id, ticker: `C${id}`, name: `Coin ${id}`, born: 0 }),
    positions: () => Array.from({ length: 120 }, (_, id) => ({ id })),
    log: () => Array.from({ length: 301 }, (_, n) => ({ n, coin: 0, side: 'buy', sol: 0.1 })) };
  const record = captureRunReplay({ market, clock: 8000, result: () => ({ placed: 360 }) });
  assert.equal(record.orders.length, REPLAY_LIMITS.orders);
  assert.equal(record.coins.length, REPLAY_LIMITS.coins);
  assert.ok(record.coins.every((c) => c.candles.length <= REPLAY_LIMITS.candles));
  assert.ok(record.coins.reduce((n, c) => n + c.candles.length, 0) <= REPLAY_LIMITS.totalCandles);
  assert.equal(record.equity.length, REPLAY_LIMITS.equity);
  assert.deepEqual(record.equity[0], equity[0]);
  assert.deepEqual(record.equity.at(-1), equity.at(-1));
  assert.ok(record.equity.every((p) => equity[p.t].v === p.v), 'sampling chooses real points');
  assert.equal(record.coverage.ordersTrimmed, true);
  assert.equal(record.coverage.coinsTrimmed, true);
  assert.equal(record.coverage.candlesTrimmed, true);
  assert.equal(record.coverage.equitySampled, true);
  assert.equal(record.coverage.logComplete, false);
  assert.equal(record.replayable, false);
  assert.deepEqual(record.log, []);
  const omittedOrder = record.orders.find((o) => !record.coins.some((c) => c.id === o.coin));
  assert.ok(omittedOrder, 'the order retention can outlast some token charts');
  const missing = replayFrame(record, record.duration, omittedOrder.coin);
  assert.equal(missing.coin, null, 'selecting an omitted token must never substitute another token');
  assert.deepEqual(missing.candles, []);
  assert.equal(missing.marketCap, null);
  assert.equal(sampleReplayPoints([{ t: 0, v: 1 }, { t: 1, v: Infinity }]).length, 1);
});

test('playback supports pause, speeds, scrubbing backward, restarting and exact trade jumps without running a market', () => {
  const record = captureRunReplay(liveFixture().run);
  const timer = createReplayClock(record.duration);
  assert.equal(timer.time, 0); assert.equal(timer.playing, false);
  timer.advance(10); assert.equal(timer.time, 0);
  timer.play(); timer.advance(2); assert.equal(timer.time, 2);
  timer.setSpeed(2); timer.advance(3); assert.equal(timer.time, 8);
  timer.pause(); timer.advance(100); assert.equal(timer.time, 8);
  assert.equal(replayTradeAt(record, timer.time).id, 2);
  assert.equal(replayTradeAt(record, timer.time, -1), null);
  timer.seek(13); assert.equal(replayTradeAt(record, timer.time, -1).id, 1);
  assert.equal(replayTradeAt(record, timer.time), null);
  timer.seek(4); assert.equal(replayFrame(record, timer.time).orders[0].status, 'pending');
  timer.setSpeed(4); assert.equal(timer.setSpeed(999), 4);
  timer.play(); timer.advance(-2); assert.equal(timer.time, 4);
  timer.advance(4); assert.equal(timer.time, 20); assert.equal(timer.playing, false);
  timer.play(); assert.equal(timer.time, 0); assert.equal(timer.playing, true);
  timer.seek(Infinity); assert.equal(timer.time, 0);
  const zero = createReplayClock(0); zero.play(); assert.equal(zero.playing, false);
  assert.equal(captureRunReplay(null), null);
});
