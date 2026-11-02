import { CHAINS, chainById, DEFAULT_CHAIN, feedWords } from './live-chains.js';

const CLANK_CHAINS = Object.freeze(CHAINS.filter((chain) => chain.id === 'robinhood'));
export const CLANK_LIVE_NOTE = 'Real Clank.trade coins and logos from Robinhood Chain. Prices start from the market, then prices and volume are simulated for your run. Your play-money trades move this practice market, not the real market.';

export function terminalLiveChains(terminal) {
  return terminal === 'clank' ? CLANK_CHAINS : CHAINS;
}

export function terminalLiveChain(terminal, saved) {
  return terminal === 'clank' ? 'robinhood' : chainById(saved)?.id || DEFAULT_CHAIN;
}

export function terminalFeedWords(terminal, feed, chainState, chain, when = 'run') {
  if (terminal !== 'clank') return feedWords(feed, chainState, chain, when);
  if (feed === 'connecting' || feed === 'idle') return { tone: 'wait', text: when === 'run' ? 'Clank listings connecting · simulated prices & volume' : 'Connecting to Clank.trade coins on Robinhood Chain…' };
  if (feed !== 'live' || ['down', 'off'].includes(chainState)) {
    return { tone: 'off', text: when === 'run' ? 'Clank listings reconnecting · practice prices keep moving' : 'Clank.trade listings are reconnecting. Waiting for real coins to load.' };
  }
  if (chainState === 'quiet') return { tone: 'wait', text: 'Clank.trade · Robinhood Chain · waiting for market data' };
  return { tone: 'live', text: 'Live Clank coins · simulated prices & volume' };
}
