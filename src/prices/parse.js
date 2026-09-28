// Turns DexScreener's answer into the numbers the site shows.
// No browser code in here, so the tests can run these functions in Node (tests/prices.test.js).

// The coins the site tracks: $AGI (since 2026-09-28 only $AGI: the Arena's other coins left with it). Addresses are lowercase.
// ⚠️ $AGI's address also appears in index.html and server/agi1-prompt.js. A test checks they all match.
export const TOKENS = [
  { symbol: 'AGI', name: 'Artificial Girlfriend Intelligence', ca: '0xfa31d04462746aaa24bc7e5626403e09e4b106ec' },
];
export const CHAIN = 'robinhood'; // DexScreener's name for Robinhood Chain

// A coin's page on clank.trade (where it's bought and sold).
export const buyLink = (ca) => `https://clank.trade/coin/${String(ca).toLowerCase()}`;

// What a visitor pastes into ClankChecker's search: a clank.trade coin link ("clank.trade/coin/0x…", with or without
// https://) or just the contract address. → the lowercase address, or null.
export function parseCoinInput(text) {
  const s = String(text ?? '').trim();
  if (!s || s.length > 200) return null;
  if (/^0x[0-9a-fA-F]{40}$/.test(s)) return s.toLowerCase();
  const link = s.match(/^(?:https?:\/\/)?(?:www\.)?clank\.trade\/coin\/(0x[0-9a-fA-F]{40})(?:[/?#]\S*)?$/i);
  return link ? link[1].toLowerCase() : null;
}

// One request for all coins. DexScreener answers with each coin's biggest pool (free, no key). Up to 30 addresses per request.
export const pricesUrl = (tokens = TOKENS) =>
  `https://api.dexscreener.com/tokens/v1/${CHAIN}/${tokens.map((t) => t.ca).join(',')}`;

// A finite number, or null. DexScreener sends prices as text ("0.002181") and the rest as numbers.
const num = (v) => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

// A coin's Robinhood Chain pool with the most liquidity (the most reliable price), or null.
// Only pools where the coin is the one being priced (the "base" token) count: in a pool like XYZ/AGI,
// the price would be XYZ's price, not $AGI's.
export function bestPair(data, ca) {
  const pairs = Array.isArray(data) ? data : Array.isArray(data?.pairs) ? data.pairs : [];
  const want = String(ca || '').toLowerCase();
  let best = null;
  let bestLiq = -1;
  for (const p of pairs) {
    if (!p || p.chainId !== CHAIN) continue;
    if (String(p.baseToken?.address || '').toLowerCase() !== want) continue;
    const price = num(p.priceUsd);
    if (price === null || price <= 0) continue;
    const liq = num(p.liquidity?.usd) ?? 0;
    if (liq > bestLiq) { best = p; bestLiq = liq; }
  }
  return best;
}

// For each coin, the numbers of its best pool.
export function pickStats(data, tokens = TOKENS) {
  const out = {};
  for (const t of tokens) {
    const best = bestPair(data, t.ca);
    if (!best) continue; // not listed right now: the page keeps the last numbers it had
    out[t.symbol] = {
      price: num(best.priceUsd),
      mcap: num(best.marketCap) ?? num(best.fdv),
      fdv: num(best.fdv),
      liq: num(best.liquidity?.usd),
      h24: num(best.priceChange?.h24),
      vol24: num(best.volume?.h24),
    };
  }
  return out;
}

// ---------- number formatting ----------
const DASH = '—';

// $1,234 · $2.50 · $0.0421 · $0.002181 (tiny prices keep 4 significant digits, never "1e-7")
export function fmtPrice(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  if (v >= 1000) return '$' + Math.round(v).toLocaleString('en-US');
  if (v >= 1) return '$' + v.toFixed(2);
  if (v >= 0.01) return '$' + v.toFixed(4);
  if (v <= 0) return '$0';
  const decimals = Math.min(20, 3 - Math.floor(Math.log10(v)));
  return '$' + v.toFixed(decimals);
}

// $2.18M · $148K · $44K · $950
const compact = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', notation: 'compact', maximumSignificantDigits: 3,
});
export function fmtCompact(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  return compact.format(v);
}

// 1.00B · 950M · 12.3K (plain counts, no $)
const count = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2, minimumFractionDigits: 2 });
export function fmtCount(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  return count.format(v);
}

// Total supply, worked out from DexScreener: fully diluted value = price × total supply.
export function supplyFrom(stats) {
  if (!stats || !(stats.fdv > 0) || !(stats.price > 0)) return null;
  return stats.fdv / stats.price;
}

// +14.96% · -40.42%
export function fmtPct(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return DASH;
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}
