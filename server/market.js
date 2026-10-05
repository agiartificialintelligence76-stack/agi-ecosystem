// $AGI's live market numbers on the server (2026-09-25), from DexScreener like the page's own prices (free, no key).
// Used by /api/voice before it makes her voice for a market-cap line (?line=mcap-<step>): only a step near the real market cap
// is made, so nobody can have her voice made for thousands of made-up numbers. Kept 60 s per server copy. Also her feed's
// market moments, and (2026-10-05) /mc in her Telegram groups: the same numbers, the same minute.
import { TOKENS, pickStats } from '../src/prices/parse.js';

const KEEP_MS = 60_000;
let known = { at: 0, value: null };
export const forgetMarket = () => { known = { at: 0, value: null }; };   // for tests

// The biggest Robinhood Chain pool's numbers, as the page's ticker reads them (src/prices/parse.js) → { mcap, h24, liq }
// (h24 and liq null when DexScreener leaves them out) or null (DexScreener didn't answer, or no market cap). `who` names
// the log line's part of the site.
async function read(now, who) {
  if (known.value && now - known.at < KEEP_MS) return known.value;
  try {
    const { ca, symbol } = TOKENS[0];
    const res = await fetch(`https://api.dexscreener.com/tokens/v1/robinhood/${ca}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const s = pickStats(await res.json(), [TOKENS[0]])[symbol];
    if (!(s?.mcap > 0)) throw new Error('no market cap in the answer');
    known = { at: now, value: { mcap: s.mcap, h24: s.h24, liq: s.liq !== null && s.liq >= 0 ? s.liq : null } };
    return known.value;
  } catch (err) {
    console.error(`[${who}] market numbers unavailable (DexScreener):`, err.message);
    return null;
  }
}

// → { mcap, h24 } or null (her voice's market lines and her feed, as before)
export async function agiMarket(now = Date.now()) {
  const v = await read(now, 'voice');
  return v && { mcap: v.mcap, h24: v.h24 };
}
// → { mcap, h24, liq } or null (/mc in her Telegram groups, 2026-10-05)
export const agiNumbers = (now = Date.now()) => read(now, 'telegram');
