// $AGI's live market numbers on the server (2026-09-25), from DexScreener like the page's own prices (free, no key).
// Used by /api/voice before it makes her voice for a market-cap line (?line=mcap-<step>): only a step near the real market cap
// is made, so nobody can have her voice made for thousands of made-up numbers. Kept 60 s per server copy.
import { TOKENS, bestPair } from '../src/prices/parse.js';

const KEEP_MS = 60_000;
let known = { at: 0, value: null };
export const forgetMarket = () => { known = { at: 0, value: null }; };   // for tests

// → { mcap, h24 } or null (DexScreener didn't answer)
export async function agiMarket(now = Date.now()) {
  if (known.value && now - known.at < KEEP_MS) return known.value;
  try {
    const ca = TOKENS[0].ca;
    const res = await fetch(`https://api.dexscreener.com/tokens/v1/robinhood/${ca}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const best = bestPair(await res.json(), ca);
    const mcap = Number(best?.marketCap ?? best?.fdv);
    if (!(mcap > 0)) throw new Error('no market cap in the answer');
    const h24 = Number(best?.priceChange?.h24);
    known = { at: now, value: { mcap, h24: Number.isFinite(h24) ? h24 : null } };
    return known.value;
  } catch (err) {
    console.error('[voice] market numbers unavailable (DexScreener):', err.message);
    return null;
  }
}
