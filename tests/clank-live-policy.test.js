import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAINS, feedWords } from '../src/games/trenchingsimulator/live-chains.js';
import { terminalLiveChains, terminalLiveChain, terminalFeedWords, CLANK_LIVE_NOTE } from '../src/games/trenchingsimulator/terminal-live.js';

test('Clank Live always chooses Robinhood, including saved or forged chain selections', () => {
  assert.deepEqual(terminalLiveChains('clank').map(c => c.id), ['robinhood']);
  for (const chain of [...CHAINS.map(c => c.id), null, 'unknown']) {
    assert.equal(terminalLiveChain('clank', chain), 'robinhood');
  }
  assert.equal(terminalLiveChains('pro'), CHAINS);
  assert.equal(terminalLiveChain('pro', 'base'), 'base');
  assert.equal(terminalLiveChain('pro', 'unknown'), 'solana');
});

test('Clank labels separate real coin listings from simulated prices and volume', () => {
  assert.match(CLANK_LIVE_NOTE, /prices and volume are simulated/i);
  assert.match(CLANK_LIVE_NOTE, /not the real market/i);
  for (const connection of ['idle', 'connecting', 'down', 'full', 'live']) {
    for (const chain of ['live', 'quiet', 'down', 'off']) {
      const words = terminalFeedWords('clank', connection, chain, 'robinhood');
      assert.doesNotMatch(words.text, /stand.?in|fill in|prices are paused|trading resumes/i);
      assert.equal(words.tone === 'live', connection === 'live' && chain === 'live');
    }
  }
  assert.match(terminalFeedWords('clank', 'live', 'live', 'robinhood').text, /simulated prices & volume/);
  assert.match(terminalFeedWords('clank', 'down', 'down', 'robinhood').text, /practice prices keep moving/);
  assert.deepEqual(terminalFeedWords('board', 'down', 'down', 'solana'), feedWords('down', 'down', 'solana'));
});
