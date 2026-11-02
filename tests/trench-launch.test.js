import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMarket, replay, cleanLaunch, MAX_PRACTICE_LAUNCHES } from '../src/games/trenchingsimulator/engine.js';
import { createRun } from '../src/games/trenchingsimulator/run.js';
import { captureRunReplay } from '../src/games/trenchingsimulator/replay-data.js';
import { createReplayArchive, validArchivedReplay } from '../src/games/trenchingsimulator/replay-archive.js';
import { liveCurrency, toReal } from '../src/games/trenchingsimulator/live-chains.js';

const token = { name: 'Practice Cat', ticker: 'PCAT', emoji: '🐱', pair: 'NVDA', line: 'A coin for this practice run.' };

test('practice launches enter discovery immediately and can be traded and replayed exactly', () => {
  const market = createMarket({ seed: 'practice-launch-replay', startSol: 10 });
  market.lists(); // exercise the discovery cache before the launch
  const before = market.size.coins;
  const launched = market.launchCoin(token);
  assert.equal(launched.ok, true);
  assert.equal(launched.id, before);
  assert.equal(launched.coin.name, token.name);
  assert.equal(launched.coin.createdByPlayer, true);
  assert.equal(market.row(launched.id).pair, 'NVDA');
  assert.equal(market.lists().new[0].id, launched.id);
  assert.equal(market.player.sol, 10, 'creating the practice token does not grant or remove funds');
  assert.equal(market.order({ coin: launched.id, side: 'buy', sol: 0.2, slippage: 0.5 }).ok, true);
  market.advance(15);
  assert.ok(market.positions().some((p) => p.id === launched.id && p.tokens > 0));
  const restored = replay({ seed: market.seed, solUsd: market.solUsd, startSol: market.startSol,
    config: market.config, log: market.log(), until: market.n });
  assert.deepEqual(restored.info(launched.id), market.info(launched.id));
  assert.deepEqual(restored.row(launched.id), market.row(launched.id));
  assert.deepEqual(restored.player, market.player);
  assert.deepEqual(restored.orders(), market.orders());
});

test('invalid launches and live-market launches cannot mutate a market', () => {
  const market = createMarket({ seed: 'launch-validation', config: { warmup: 0 } });
  for (const data of [null, {}, { ...token, name: ' ' }, { ...token, ticker: '<script>' }, { ...token, pair: 'FAKE' }]) {
    assert.equal(market.launchCoin(data).ok, false);
  }
  assert.equal(market.size.coins, 0);
  assert.deepEqual(market.log(), []);
  assert.deepEqual(cleanLaunch({ ...token, ticker: 'pcat', name: '\u202ePractice Cat\u0000' }), token);
  const live = createMarket({ live: true, config: { warmup: 0 } });
  assert.equal(live.canLaunchPractice, false);
  assert.equal(market.canLaunchPractice, true);
  assert.deepEqual(live.launchCoin(token), { ok: false, error: 'free_only' });
  assert.equal(live.size.coins, 0);
  for (let i = 0; i < MAX_PRACTICE_LAUNCHES; i++) assert.equal(market.launchCoin(token).ok, true);
  assert.deepEqual(market.launchCoin(token), { ok: false, error: 'launch_limit' });
});

function mixedLiveMarket(options = {}) {
  const market = createMarket({ seed: 'live-local-launch', startSol: 10, ...options,
    live: true, allowLivePracticeLaunch: true, config: { ...options.config, warmup: 0, launchesPerMin: 30 } });
  market.ext.view({ ext: true, sim: false, simPaused: true });
  market.ext.add({ key: '0x' + '1'.repeat(40), name: 'Source token', ticker: 'SOURCE', chain: 'robinhood',
    src: 'clank.trade', practice: true, live: true, real: toReal({ k: 'u', mu: 15000, lu: 12000, pg: .2,
      gr: false, cl: false }, { solUsd: market.solUsd }) });
  return market;
}

test('explicit Live practice launches are visible, searchable and active without enabling fictional background launches', () => {
  const market = mixedLiveMarket();
  assert.equal(market.canLaunchPractice, true);
  assert.throws(() => { market.canLaunchPractice = false; }, TypeError, 'the factory capability is read-only');
  market.lists();
  const funds = market.player;
  const launched = market.launchCoin(token);
  assert.equal(launched.ok, true);
  assert.equal(launched.id, 1, 'source and local identities have distinct stable IDs');
  assert.deepEqual(market.player, funds, 'creation never grants or spends any money or tokens');
  assert.deepEqual(market.ext.ids(), [0], 'a local creation never enters the imported source registry');
  assert.equal(market.isExt(launched.id), false);
  for (const read of [market.row, market.info, market.stats]) {
    const coin = read(launched.id);
    assert.equal(coin.createdByPlayer, true);
    assert.equal(coin.practice, true);
    assert.notEqual(coin.live, true, 'fictional identity cannot be labeled as an on-chain source coin');
    assert.notEqual(coin.standIn, true, 'an explicit player creation is not a fallback listing');
  }
  assert.equal(market.info(launched.id).mint, null, 'no fictional on-chain address is exposed');
  assert.equal(market.info(launched.id).devAddr, null);
  assert.equal(market.info(launched.id).dev, 'Practice creator');
  assert.deepEqual(market.find('$pcat'), [launched.id]);
  assert.deepEqual(market.find('Practice Cat'), [launched.id]);
  assert.ok(market.lists().new.some(r => r.id === launched.id));
  assert.equal(market.order({ coin: launched.id, side: 'buy', sol: .2, priority: 'ultra', slippage: 1 }).ok, true);
  assert.equal(market.log()[0].kind, 'launch', 'complete launch metadata is logged before its first order');
  assert.equal(market.log()[1].coin, launched.id);
  market.advance(2);
  assert.ok(market.positions().find(p => p.id === launched.id)?.tokens > 0);
  const initialVolume = market.stats(launched.id).vol;
  market.advance(28);
  assert.equal(market.size.coins, 2, 'source-only mode still forbids every automatic fictional launch');
  assert.deepEqual(market.ext.shown, { ext: true, sim: false, simPaused: true });
  assert.ok(market.stats(launched.id).vol > initialVolume, 'the player-created coin has its normal simulated crowd');
  assert.ok(market.trades(launched.id, 120).some(t => !t.me));
  const window = market.ext.practiceWindows(launched.id)['5m'];
  assert.ok(window.buyVolume > 0 && window.sellVolume > 0);
  assert.ok(Math.abs(window.volume - market.stats(launched.id).vol5m) < 1e-8);
  assert.equal(window.buys + window.sells, market.stats(launched.id).txns5m);
});

test('Live launch opt-in retains validation, the twenty-creation cap and zero automatic debits', () => {
  for (const value of [undefined, false, 1, 'true']) {
    const market = createMarket({ live: true, allowLivePracticeLaunch: value, config: { warmup: 0 } });
    assert.equal(market.canLaunchPractice, false, 'only literal true authorizes Live creation');
    assert.deepEqual(market.launchCoin(token), { ok: false, error: 'free_only' });
  }
  const market = mixedLiveMarket();
  for (const data of [null, {}, { ...token, ticker: '<script>' }, { ...token, pair: 'FAKE' }]) {
    assert.deepEqual(market.launchCoin(data), { ok: false, error: 'bad_launch' });
  }
  assert.equal(market.size.coins, 1);
  assert.deepEqual(market.log(), []);
  for (let i = 0; i < MAX_PRACTICE_LAUNCHES; i++) assert.equal(market.launchCoin({ ...token, ticker: `PC${i}` }).ok, true);
  assert.deepEqual(market.launchCoin(token), { ok: false, error: 'launch_limit' });
  assert.equal(market.size.coins, MAX_PRACTICE_LAUNCHES + 1);
  assert.equal(market.player.sol, 10);
  assert.equal(market.player.held, 0);
  assert.equal(market.player.pending, 0);
  assert.equal(market.log().length, MAX_PRACTICE_LAUNCHES);
  assert.equal(market.ext.practiceSkipTo(3600), false, 'local simulation plans cannot be silently clock-skipped');
});

test('mixed Live source and local practice coins survive recorded replay and archive round trips', () => {
  const run = createRun({ seed: 'mixed-live-archive', mode: 'free', terminal: 'clank', currency: 'usd', startSol: 10,
    live: 'robinhood', realTime: true, makeMarket: mixedLiveMarket });
  run.market.clankPractice = true;
  const local = run.market.launchCoin(token);
  for (const id of [0, local.id]) assert.equal(run.order({ coin: id, side: 'buy', sol: .1, priority: 'ultra', slippage: 1 }).ok, true);
  for (let i = 0; i < 30; i++) run.tick(.2);
  const record = captureRunReplay(run);
  assert.equal(record.live, true);
  assert.equal(record.practice, true);
  assert.equal(record.replayable, false, 'a mixed source session uses captured observations rather than seed reconstruction');
  assert.deepEqual(record.coins.map(c => c.id).sort(), [0, local.id]);
  assert.equal(record.coins.find(c => c.id === 0).live, true);
  const coin = record.coins.find(c => c.id === local.id);
  assert.equal(coin.live, false);
  assert.equal(coin.name, token.name);
  assert.equal(coin.ticker, token.ticker);
  assert.ok(coin.candles.length > 0 && coin.candles.some(c => c.v > 0));
  assert.ok(record.orders.some(o => o.coin === local.id && o.status === 'filled'));
  assert.equal(validArchivedReplay(record), true);
  const data = new Map();
  const storage = { getItem: k => data.get(k), setItem: (k, v) => data.set(k, v) };
  const saved = createReplayArchive(storage).save(record);
  assert.equal(saved.ok, true);
  assert.deepEqual(createReplayArchive(storage).get(saved.id), JSON.parse(JSON.stringify(record)));
});

test('a launched coin survives saved replay validation and malformed launch logs are rejected', () => {
  const run = createRun({ seed: 'launch-archive', mode: 'free', terminal: 'clank', currency: 'usd', startSol: 10 });
  const result = run.market.launchCoin(token);
  assert.equal(run.order({ coin: result.id, side: 'buy', sol: 0.1 }).ok, true);
  for (let i = 0; i < 30; i++) run.tick(0.5);
  const record = captureRunReplay(run);
  assert.equal(record.replayable, true);
  assert.equal(record.log[0].kind, 'launch');
  assert.equal(validArchivedReplay(record), true);
  const data = new Map();
  const storage = { getItem: (k) => data.get(k), setItem: (k, v) => data.set(k, v) };
  const archive = createReplayArchive(storage);
  const saved = archive.save(record);
  assert.equal(saved.ok, true);
  assert.deepEqual(createReplayArchive(storage).get(saved.id).log, JSON.parse(JSON.stringify(record.log)));
  assert.equal(validArchivedReplay({ ...record, log: [{ ...record.log[0], pair: 'UNKNOWN' }] }), false);
  assert.equal(liveCurrency('clank', 'robinhood'), 'usd');
});
