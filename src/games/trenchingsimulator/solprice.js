// SOL's real price for TRENCHING SIMULATOR (2026-10-20): read once from DexScreener when a run is set up (the same
// public API the site's $AGI prices come from, already in the CSP's connect-src), then frozen for that run, so a run's
// dollars never move under the player. The game's coins and money are simulated: SOL's price only turns SOL into
// dollars on the screen (and a dollar challenge's start into SOL). If DexScreener doesn't answer: the price this
// browser saw last (30 days at most), else $150. Its parse is pure (read in Node too: tests/trench-game.test.js).

export const WSOL = 'So11111111111111111111111111111111111111112';
export const SOL_URL = `https://api.dexscreener.com/tokens/v1/solana/${WSOL}`;
export const FALLBACK_USD = 150;
export const SANE = Object.freeze({ min: 1, max: 100000 });
export const SAVE_KEY = 'trench_sol';
export const SAVED_FOR_MS = 30 * 24 * 3600 * 1000;
const TIMEOUT_MS = 4000;

const num = (x) => {
  const v = typeof x === 'string' ? Number(x) : x;
  return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
};
export const saneUsd = (x) => Number.isFinite(x) && x >= SANE.min && x <= SANE.max;
const liq = (p) => {
  const v = num(p && p.liquidity && p.liquidity.usd);
  return Number.isFinite(v) && v > 0 ? v : 0;
};

// DexScreener's answer (a list of pairs with wSOL in them) → SOL in dollars, or null. The pair where wSOL is the base
// token with the most liquidity says it directly (its priceUsd); else a pair priced in wSOL (its token's priceUsd ÷ its
// priceNative, in SOL), the most liquid. Only Solana's pairs, only a sane number.
export function parseSolPrice(data) {
  const pairs = Array.isArray(data) ? data : data && Array.isArray(data.pairs) ? data.pairs : [];
  let best = null;
  let bestLiq = -1;
  for (const p of pairs) {
    if (!p || p.chainId !== 'solana' || !p.baseToken || p.baseToken.address !== WSOL) continue;
    const usd = num(p.priceUsd);
    if (!saneUsd(usd)) continue;
    const l = liq(p);
    if (l > bestLiq) {
      best = usd;
      bestLiq = l;
    }
  }
  if (best !== null) return best;
  for (const p of pairs) {
    if (!p || p.chainId !== 'solana' || !p.quoteToken || p.quoteToken.address !== WSOL) continue;
    const usd = num(p.priceUsd);
    const native = num(p.priceNative);
    if (!(usd > 0) || !(native > 0)) continue;
    const sol = usd / native;
    if (!saneUsd(sol)) continue;
    const l = liq(p);
    if (l > bestLiq) {
      best = sol;
      bestLiq = l;
    }
  }
  return best;
}

// a price this browser kept: { usd, at } (any storage that has getItem: localStorage, or a stand-in)
export function readSaved(storage, now = Date.now()) {
  try {
    const raw = storage && storage.getItem(SAVE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    const usd = num(v && v.usd);
    const at = num(v && v.at);
    if (!saneUsd(usd) || !Number.isFinite(at) || at > now + 60000 || now - at > SAVED_FOR_MS) return null;
    return { usd, at };
  } catch {
    return null;
  }
}

function save(storage, usd, at) {
  try {
    if (storage) storage.setItem(SAVE_KEY, JSON.stringify({ usd, at }));
  } catch {
    // a private window or blocked storage: the price just isn't kept
  }
}

// SOL's price for a run: { usd, source: 'live' | 'saved' | 'default', at }. Never throws, never waits more than ~4 s.
export async function getSolPrice({ fetch: f = globalThis.fetch, storage = null, now = Date.now,
  timeoutMs = TIMEOUT_MS } = {}) {
  const t = now();
  if (typeof f === 'function') {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    let timer = null;
    try {
      const res = await Promise.race([
        f(SOL_URL, { signal: ctl ? ctl.signal : undefined, headers: { Accept: 'application/json' } }),
        new Promise((_, no) => {
          timer = setTimeout(() => {
            if (ctl) ctl.abort();
            no(new Error('timeout'));
          }, timeoutMs);
        }),
      ]);
      if (res && res.ok) {
        const usd = parseSolPrice(await res.json());
        if (usd !== null) {
          const rounded = Math.round(usd * 100) / 100;
          save(storage, rounded, t);
          return { usd: rounded, source: 'live', at: t };
        }
      }
    } catch {
      // DexScreener away, slow or changed: the saved price or the default
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  const saved = readSaved(storage, t);
  if (saved) return { usd: saved.usd, source: 'saved', at: saved.at };
  return { usd: FALLBACK_USD, source: 'default', at: t };
}
