// ClankChecker: copycat tickers. The server marks the whole coin list with this (server/checker.js), and the page marks the
// list again whenever new launches arrive (src/sections/checker.js), so both always agree.

// Two tickers are "the same" when they read the same without spaces and symbols: "E/ACC" = "EACC", "$agi" = "AGI".
export const tickerKey = (raw) => String(raw ?? '').normalize('NFKC').toUpperCase().replace(/[^\p{L}\p{N}]/gu, '');

// Among coins with the same ticker, the "real" one is the site's own $AGI, else a graduated one, else the biggest. Another
// coin is a copy when that one has graduated or is at least twice its size (and it hasn't graduated itself).
// size(c): how big a coin is: its market cap in dollars (on the server and the page; since 2026-10-05 also on the server,
// where it was in ETH, which made a coin paired with SPCX look about 17 times bigger than one paired with ETH).
// → the same coins, each with copyOf (the real one's address, or null), copyOfficial (uses $AGI's ticker without being it)
// and sameTicker (how many other coins share it)
export function markCopycats(coins, { size = (c) => c.mcUsd ?? c.marketCap ?? 0 } = {}) {
  const groups = new Map();
  for (const c of coins) {
    const key = tickerKey(c.symbol);
    if (key) (groups.get(key) ?? groups.set(key, []).get(key)).push(c);
  }
  const rank = (c) => (c.official ? 1e18 : 0) + (c.graduated ? 1e15 : 0) + (Number(size(c)) || 0);
  for (const c of coins) Object.assign(c, { copyOf: null, copyOfficial: false, sameTicker: 0 });
  for (const [key, list] of groups) {
    for (const c of list) c.copyOfficial = key === 'AGI' && !c.official;
    if (list.length < 2) continue;
    const top = list.reduce((a, b) => (rank(b) > rank(a) ? b : a));
    for (const c of list) {
      c.sameTicker = list.length - 1;
      const big = Number(size(top)) || 0, small = Number(size(c)) || 0;
      if (c !== top && !c.graduated && (top.graduated || top.official || (big > 0 && big >= 2 * small))) c.copyOf = top.address;
    }
  }
  return coins;
}
