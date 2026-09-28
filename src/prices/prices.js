// Live numbers for our coins, straight from DexScreener (free, no key).
// - One request every 30 s for all coins (DexScreener's own cache is 30 s, so faster is pointless).
// - Paused while the tab is hidden, so a forgotten tab doesn't keep asking.
// - If DexScreener fails, the last numbers are kept and we retry more slowly (1, 2, 4… up to 5 minutes).
// - Every attempt is announced as an 'agi:prices' event. The hero ticker (ticker.js) shows it, and other parts listen too
//   (the Model card, the Arena, and AGI-1's market moments: src/chat/market.js). This file draws nothing itself.
// - Phase 6: the Arena's coins change when visitors vote coins in. src/sections/arena.js announces the list ('agi:coins'),
//   and from then on the same single request covers exactly those coins ($AGI always included, for the ticker).
import { TOKENS, pricesUrl, pickStats } from './parse.js';

const REFRESH_MS = 30_000;
const MAX_WAIT_MS = 5 * 60_000;
const TIMEOUT_MS = 8_000;

let latest = {};     // { AGI: { price, mcap, liq, h24 }, CABO: {...}, ... }
let updatedAt = 0;   // when numbers last arrived (ms)
let failures = 0;
let timer = null;
let running = null;  // the request in progress, so two can't overlap
let tracked = TOKENS.map((t) => ({ symbol: t.symbol, ca: t.ca }));   // the coins to ask about

// For other modules: the latest numbers and when they arrived.
export const getPrices = () => ({ tokens: latest, updatedAt });

async function fetchStats() {
  const ctrl = new AbortController();
  const stop = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(pricesUrl(tracked), { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const stats = pickStats(await res.json(), tracked);
    if (!Object.keys(stats).length) throw new Error('no prices in the answer');
    return stats;
  } finally {
    clearTimeout(stop);
  }
}

function announce(previous) {
  dispatchEvent(new CustomEvent('agi:prices', { detail: { tokens: latest, previous, updatedAt, failures } }));
}

function refresh() {
  running ??= (async () => {
    try {
      const stats = await fetchStats();
      const previous = latest;
      latest = { ...latest, ...stats }; // a coin missing this time keeps its last numbers
      updatedAt = Date.now();
      failures = 0;
      announce(previous);
    } catch (err) {
      failures++;
      console.warn('[prices] update failed:', err.message);
      announce(latest);
    } finally {
      running = null;
    }
  })();
  return running;
}

function schedule() {
  clearTimeout(timer);
  if (document.hidden) return; // resumes on 'visibilitychange'
  const wait = failures
    ? Math.min(REFRESH_MS * 2 ** failures, MAX_WAIT_MS)     // 1, 2, 4… minutes, at most 5
    : Math.max(0, REFRESH_MS - (Date.now() - updatedAt));  // 30 s after the last update
  timer = setTimeout(() => refresh().then(schedule), wait);
}

// The Arena's coin list ('agi:coins' { coins: [{ symbol, address }] }). A coin we have no numbers for yet is asked
// about right away; otherwise the next regular update picks up the new list.
function follow(coins) {
  const next = [{ symbol: TOKENS[0].symbol, ca: TOKENS[0].ca }];
  for (const c of coins || []) {
    const ca = String(c?.address || '').toLowerCase();
    if (/^0x[0-9a-f]{40}$/.test(ca) && typeof c.symbol === 'string' && !next.some((t) => t.ca === ca)) next.push({ symbol: c.symbol, ca });
  }
  const key = (list) => list.map((t) => `${t.symbol}:${t.ca}`).sort().join(',');
  if (next.length > 30 || key(next) === key(tracked)) return;          // DexScreener takes at most 30 addresses per request
  tracked = next;
  if (!document.hidden && tracked.some((t) => !latest[t.symbol])) {
    clearTimeout(timer);
    refresh().then(schedule);
  }
}

export function startPrices() {
  addEventListener('agi:coins', (e) => follow(e.detail?.coins));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearTimeout(timer); return; }
    if (Date.now() - updatedAt >= REFRESH_MS) refresh().then(schedule); // back after a while: update now
    else schedule();
  });
  refresh().then(schedule);
}
