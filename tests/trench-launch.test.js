import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMarket, replay, cleanLaunch, MAX_PRACTICE_LAUNCHES } from '../src/games/trenchingsimulator/engine.js';
import { createRun } from '../src/games/trenchingsimulator/run.js';
import { captureRunReplay } from '../src/games/trenchingsimulator/replay-data.js';
import { createReplayArchive, validArchivedReplay } from '../src/games/trenchingsimulator/replay-archive.js';
import { liveCurrency } from '../src/games/trenchingsimulator/live-chains.js';

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
  assert.deepEqual(live.launchCoin(token), { ok: false, error: 'free_only' });
  assert.equal(live.size.coins, 0);
  for (let i = 0; i < MAX_PRACTICE_LAUNCHES; i++) assert.equal(market.launchCoin(token).ok, true);
  assert.deepEqual(market.launchCoin(token), { ok: false, error: 'launch_limit' });
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
