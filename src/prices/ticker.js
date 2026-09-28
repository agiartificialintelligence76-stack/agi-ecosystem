// The live ticker under the hero headline. It only draws: prices.js fetches and sends 'agi:prices' events.
import { TOKENS, fmtPrice, fmtCompact, fmtPct } from './parse.js';

const STALE_MS = 2 * 60_000; // numbers older than this are shown dimmed as "Delayed"
const AGI = TOKENS[0].symbol;

export function startTicker(el) {
  if (!el) return;
  const cell = (k) => el.querySelector(`[data-k="${k}"]`);
  const price = cell('price'), change = cell('change'), mcap = cell('mcap'), liq = cell('liq'), status = cell('status');

  addEventListener('agi:prices', ({ detail }) => {
    const now = detail.tokens[AGI] || {};
    const before = detail.previous[AGI];

    price.textContent = fmtPrice(now.price);
    change.textContent = fmtPct(now.h24);
    change.classList.toggle('up', Number.isFinite(now.h24) && now.h24 >= 0);
    change.classList.toggle('down', Number.isFinite(now.h24) && now.h24 < 0);
    mcap.textContent = fmtCompact(now.mcap);
    liq.textContent = fmtCompact(now.liq);

    // a short green/red wash on the price when it moves
    if (before?.price && now.price && before.price !== now.price) {
      price.classList.remove('tick-up', 'tick-down');
      void price.offsetWidth; // restart the animation
      price.classList.add(now.price > before.price ? 'tick-up' : 'tick-down');
    }

    const live = detail.updatedAt && Date.now() - detail.updatedAt < STALE_MS;
    el.dataset.state = live ? 'live' : detail.updatedAt ? 'stale' : 'loading';
    status.textContent = live ? 'Live' : detail.updatedAt ? 'Delayed' : 'Offline';
    el.title = live ? 'Live from DexScreener · updates every 30 s'
      : detail.updatedAt ? "Couldn't reach DexScreener. Showing the last numbers, retrying…" : "Couldn't reach DexScreener. Retrying…";
  });
}
