// Pure launchpad filtering and form validation, shared by the view and its tests.
import { parseAmount } from './common.js';

export const CLANK_PAIRS = Object.freeze(['ETH', 'AMC', 'RDDT', 'SPCX', 'TTWO', 'PLTR', 'AAPL', 'META', 'HIMS', 'NVDA']);

export function clankPair(row) {
  // The relay's generic `pair` is its native settlement unit, not a verified stock quote asset.
  // Live filters may use only explicit quoteAsset metadata; none is invented from the chain.
  const pair = String((row?.live ? row.quoteAsset : row?.pair) || '').toUpperCase();
  return CLANK_PAIRS.includes(pair) ? pair : row?.live ? 'Unknown' : 'ETH';
}

export function clankFeed(market, { sort = 'trending', query = '', pair = 'all', limit = 42 } = {}) {
  const lists = market.lists({ limit: typeof market.clankData === 'function' ? 500 : 100 });
  let rows;
  if (query.trim()) rows = market.find(query.trim()).map((id) => market.row(id)).filter(Boolean);
  else if (sort === 'new') {
    const unique = new Map([...lists.new, ...lists.stretch, ...lists.migrated].map((r) => [r.id, r]));
    // A trending response can omit launch time. Do not place an older live token at the top just because
    // its first local observation was now; only the source's actual createdAt orders real listings.
    rows = [...unique.values()].sort((a, b) => (a.live || b.live
      ? (b.createdAt || 0) - (a.createdAt || 0) : b.born - a.born) || b.id - a.id);
  } else rows = lists.trending;
  return rows.filter((r) => pair === 'all' || clankPair(r) === pair).slice(0, limit);
}

export function validateClankLaunch({ name, ticker, initialBuy = '', pair = 'ETH' }) {
  const cleanName = String(name || '').trim();
  const cleanTicker = String(ticker || '').trim().replace(/^\$/, '').toUpperCase();
  const amount = String(initialBuy).trim() ? parseAmount(initialBuy) : 0;
  if (cleanName.length < 2 || cleanName.length > 40) return { ok: false, error: 'Use a coin name between 2 and 40 characters.' };
  if (!/^[A-Z0-9]{1,10}$/.test(cleanTicker)) return { ok: false, error: 'Use 1–10 letters or numbers for the ticker.' };
  if (!CLANK_PAIRS.includes(pair)) return { ok: false, error: 'Choose a paired asset.' };
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: 'Enter a valid initial buy in dollars, or leave it empty.' };
  return { ok: true, name: cleanName, ticker: cleanTicker, pair, amount };
}
