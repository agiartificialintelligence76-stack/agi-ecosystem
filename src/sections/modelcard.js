// The Model card: the Copy button for the contract address, and the live token numbers.
import { TOKENS, fmtCompact, fmtCount, supplyFrom } from '../prices/parse.js';
import { getPrices } from '../prices/prices.js';
import { copyButton } from '../lib/copy.js';

export function startModelCard(root) {
  if (!root) return;
  const ca = TOKENS[0].ca;                       // the official address, from one place in the code
  copyButton(root.querySelector('[data-copy]'), { text: ca, select: root.querySelector('[data-ca]') });

  const cell = (key) => root.querySelector(`[data-live="${key}"]`);
  const render = (tokens) => {
    const s = tokens?.[TOKENS[0].symbol];
    if (!s) return;
    cell('supply').textContent = fmtCount(supplyFrom(s));
    cell('mcap').textContent = fmtCompact(s.mcap);
    cell('liq').textContent = fmtCompact(s.liq);
    cell('vol24').textContent = fmtCompact(s.vol24);
  };
  render(getPrices().tokens);
  addEventListener('agi:prices', (e) => render(e.detail.tokens));
}
