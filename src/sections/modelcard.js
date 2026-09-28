// The Model card: the Copy button for the contract address, and the live token numbers.
import { TOKENS, fmtCompact, fmtCount, supplyFrom } from '../prices/parse.js';
import { getPrices } from '../prices/prices.js';

export function startModelCard(root) {
  if (!root) return;
  const ca = TOKENS[0].ca;                       // the official address, from one place in the code
  const addr = root.querySelector('[data-ca]');
  const button = root.querySelector('[data-copy]');
  let reset = null;

  const show = (text, done) => {
    button.textContent = text;
    button.classList.toggle('is-done', done);
    clearTimeout(reset);
    reset = setTimeout(() => { button.textContent = 'Copy'; button.classList.remove('is-done'); }, 1800);
  };

  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(ca);
      show('Copied', true);
    } catch {
      // Some browsers block the clipboard: select the address so Ctrl+C (or a long-press) copies it.
      const range = document.createRange();
      range.selectNodeContents(addr);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      show('Selected', false);
    }
  });

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
