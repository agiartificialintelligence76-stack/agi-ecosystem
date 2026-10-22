// TRENCHING SIMULATOR's live relay (2026-10-21, #404): what the outside sources send, read and checked, and what the
// relay sends browsers. Pure: read in Node's tests too (tests/trench-live.test.js). Nothing here trusts what it's given:
// every name is made safe to show as text, every number checked, every address matched against its shape; anything odd
// is dropped (null), never guessed.
//
// A coin's market ("state") is one of three kinds:
//   c  a pump.fun bonding curve, exact: { vs, vt, rt, rs, sup, done } (virtual SOL and tokens, real tokens left and real
//      SOL in it, its supply, whether it's sold out), from PumpPortal's new-coin message and then Helius
//   p  a pool priced in SOL, from DexScreener: { ls, lb } (the SOL and the coin's tokens in it)
//   u  priced in dollars (other chains): { mu, lu, pg, gr, cl } (market cap, liquidity, its curve's progress 0…1,
//      graduated, closed for a moment while it graduates); lu and pg may be null (not known)
// On the wire each is a short array (encodeState), so a batch of updates stays small for every viewer.

export const PUMP_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
// the first 8 bytes of every pump.fun bonding-curve account: sha256("account:BondingCurve")
export const CURVE_DISC = Object.freeze([23, 183, 248, 55, 96, 216, 172, 96]);
// pump.fun's standard curve: 30 virtual SOL and 1,073,000,000 virtual tokens to start, 793,100,000 of them for sale
export const PUMP = Object.freeze({ vSol0: 30, vTok0: 1_073_000_000, realTok0: 793_100_000, floor: 279_900_000,
  supply: 1_000_000_000, decimals: 6 });
export const WSOL = 'So11111111111111111111111111111111111111112';
// each chain's wrapped coin, for its dollar price (DexScreener's chain ids). Ethereum and Arbitrum are priced in ETH too
// (Base's WETH: one price); since 2026-10-22 HyperEVM's HYPE (WHYPE), Monad's MON (WMON) and Tron's TRX (WTRX, its
// base58 address as it is: Tron's addresses are case-sensitive)
export const WRAPPED = Object.freeze({
  sol: Object.freeze({ chain: 'solana', address: WSOL }),
  eth: Object.freeze({ chain: 'base', address: '0x4200000000000000000000000000000000000006' }),
  bnb: Object.freeze({ chain: 'bsc', address: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c' }),
  hype: Object.freeze({ chain: 'hyperevm', address: '0x5555555555555555555555555555555555555555' }),
  mon: Object.freeze({ chain: 'monad', address: '0x3bd359c1119da7da1d913d1c4d2b7c461115433a' }),
  trx: Object.freeze({ chain: 'tron', address: 'TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR' }),
});
export const PRICE_RANGE = Object.freeze({ sol: [1, 100000], eth: [10, 1000000], bnb: [1, 100000], hype: [0.1, 100000], mon: [0.0001, 1000],
  trx: [0.001, 100] });
// DexScreener's dex ids of launchpads' own curves (the coin hasn't graduated yet), and the launchpad they mean
export const CURVE_DEXES = Object.freeze({ fourmeme: 'four.meme', 'four-meme': 'four.meme', pumpfun: 'pump.fun' });

const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM = /^0x[0-9a-fA-F]{40}$/;
const TRON = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
export const isB58 = (s) => typeof s === 'string' && B58.test(s);
export const isEvm = (s) => typeof s === 'string' && EVM.test(s);
export const isTron = (s) => typeof s === 'string' && TRON.test(s);
// EVM addresses are lower-cased; Solana and Tron addresses retain their case.
export const addressOn = (chain, s) => (chain === 'solana' ? (isB58(s) ? s : null)
  : chain === 'tron' ? (isTron(s) ? s : null) : isEvm(s) ? s.toLowerCase() : null);
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const num = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && v.length < 40 ? Number(v) : NaN);
const r6 = (x) => Math.round(x * 1e6) / 1e6;
const r2 = (x) => Math.round(x * 100) / 100;

// ---------- words ----------

// Control characters, direction changers and invisible fillers (a name can't hide, reverse or look empty); joiners and
// variation selectors stay (emoji need them)
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f\u061c\u115f\u1160\u180e\u200b\u200e\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\u3164\ufeff\uffa0\ufff9-\ufffb]/g;
const MARKS = /([\u0300-\u036f\u1ab0-᫿\u1dc0-\u1dff\u20d0-⃿\ufe20-\ufe2f]{3})[\u0300-\u036f\u1ab0-᫿\u1dc0-\u1dff\u20d0-⃿\ufe20-\ufe2f]+/g;

// A coin's name or ticker as its maker wrote it, made safe to show as text (the owner's call, 2026-10-20: names as they
// are, never a word filter): nothing invisible or direction-changing, at most 3 accents on a letter, single spaces, at
// most `max` characters
export function cleanText(raw, max) {
  if (typeof raw !== 'string' || raw.length > 2000) return null;
  let s = raw.normalize('NFC').replace(/[\t\n\r\v\f\u2028\u2029]/g, ' ').replace(INVISIBLE, '').replace(MARKS, '$1')
    .replace(/\s+/g, ' ').trim();
  if (!s) return null;
  const chars = [...s];
  if (chars.length > max) s = `${chars.slice(0, max - 1).join('').trimEnd()}…`;
  return s;
}
export const cleanName = (raw) => cleanText(raw, 48);
export const cleanTicker = (raw) => {
  const s = cleanText(typeof raw === 'string' ? raw.replace(/^\$+/, '') : raw, 16);
  return s;
};

// ---------- pump.fun (Solana) ----------

// A standard pump.fun curve from its virtual reserves (SOL, whole tokens): its real reserves follow from them (30 SOL and
// 279.9M tokens of it are virtual). A curve that isn't near the standard one (another launch type's numbers) → null.
export function curveFromVirtual(vs, vt, done = false) {
  if (!fin(vs) || !fin(vt) || !(vs > 0) || !(vt > 0) || vs > 1e5 || vt > 1e12) return null;
  const k = vs * vt;
  const k0 = PUMP.vSol0 * PUMP.vTok0;
  if (Math.abs(k / k0 - 1) > 0.25) return null;
  return { k: 'c', vs, vt, rt: Math.max(0, vt - PUMP.floor), rs: Math.max(0, vs - PUMP.vSol0), sup: PUMP.supply, done: Boolean(done) };
}

// PumpPortal's (and PumpDev's) message about a new coin → { mint, curve, creator, name, symbol, uri, st } or null
export function parseCreate(m) {
  if (!m || typeof m !== 'object' || m.txType !== 'create') return null;
  if (m.pool != null && m.pool !== 'pump') return null; // another launchpad's coin (PumpPortal streams some)
  const quote = m.quoteMint ?? m.quote_mint ?? m.quoteToken ?? null;
  if (quote != null && quote !== WSOL) return null; // priced in another asset (pump.fun's custom pairs): not yet
  if (!isB58(m.mint) || !isB58(m.bondingCurveKey)) return null;
  const st = curveFromVirtual(num(m.vSolInBondingCurve), num(m.vTokensInBondingCurve));
  if (!st) return null;
  const name = cleanName(m.name);
  const symbol = cleanTicker(m.symbol);
  if (!name || !symbol) return null;
  const uri = typeof m.uri === 'string' && m.uri.trim().length <= 600 ? m.uri.trim() : null;
  return { mint: m.mint, curve: m.bondingCurveKey, creator: isB58(m.traderPublicKey) ? m.traderPublicKey : null, name,
    symbol, uri, st };
}

// PumpPortal's message about a coin that migrated (its curve sold out, its pool made) → { mint } or null
export function parseMigrate(m) {
  if (!m || typeof m !== 'object' || m.txType !== 'migrate' || !isB58(m.mint)) return null;
  return { mint: m.mint };
}

// A pump.fun bonding-curve account (base64, as Helius sends it) → its state, or null. Its layout: 8 bytes that say what
// it is, then virtual tokens, virtual SOL (lamports), real tokens, real SOL, supply (u64, little-endian; tokens with 6
// decimals), then "complete" (a byte); newer fields after that are left alone.
export function parseCurveAccount(b64, owner = PUMP_PROGRAM) {
  if (owner !== PUMP_PROGRAM || typeof b64 !== 'string' || b64.length < 60 || b64.length > 4000) return null;
  let b;
  try {
    b = Buffer.from(b64, 'base64');
  } catch {
    return null;
  }
  if (b.length < 49 || CURVE_DISC.some((x, i) => b[i] !== x)) return null;
  const u = (o) => Number(b.readBigUInt64LE(o));
  const vt = u(8) / 10 ** PUMP.decimals;
  const vs = u(16) / 1e9;
  const rt = u(24) / 10 ** PUMP.decimals;
  const rs = u(32) / 1e9;
  const sup = u(40) / 10 ** PUMP.decimals;
  const done = b[48] === 1;
  if (!(vt > 0) || !(vs > 0) || !(sup > 0) || rt > vt || rs > vs || vt > 1e12 || vs > 1e6) return null;
  return { k: 'c', vs, vt, rt, rs, sup, done };
}

// ---------- prices and market caps ----------

// price (in the curve's quote coin) = virtual quote reserves ÷ virtual token reserves; market cap = price × supply
export function curvePrice(st) {
  return st && st.vt > 0 ? st.vs / st.vt : NaN;
}
export function curveMarketCap(st) {
  return curvePrice(st) * (st && st.sup > 0 ? st.sup : PUMP.supply);
}
// how much of a standard curve is sold, 0…1
export function curveProgress(st) {
  if (!st || !fin(st.rt)) return NaN;
  const total = PUMP.realTok0 * ((st.sup > 0 ? st.sup : PUMP.supply) / PUMP.supply);
  return Math.min(1, Math.max(0, 1 - st.rt / total));
}
// a state's market cap: in SOL (c, p) or dollars (u)
export function marketCapOf(st) {
  if (!st) return NaN;
  if (st.k === 'c') return curveMarketCap(st);
  if (st.k === 'p') return st.lb > 0 ? (st.ls / st.lb) * PUMP.supply : NaN;
  if (st.k === 'u') return st.mu;
  return NaN;
}

// ---------- DexScreener ----------

const lower = (s) => String(s || '').toLowerCase();
const liqUsd = (p) => {
  const v = num(p && p.liquidity && p.liquidity.usd);
  return fin(v) && v > 0 ? v : 0;
};

// Of DexScreener's pairs, the one for `token` on `chain` (the token as the pair's base) with the most liquidity; `dexes`:
// only those dex ids (pump.fun's own pool after migration, say)
export function bestPair(pairs, chain, token, { dexes = null } = {}) {
  const list = Array.isArray(pairs) ? pairs : pairs && Array.isArray(pairs.pairs) ? pairs.pairs : [];
  const evm = isEvm(token);
  const want = evm ? lower(token) : token;
  let best = null;
  let bestLiq = -1;
  for (const p of list) {
    if (!p || typeof p !== 'object' || p.chainId !== chain || !p.baseToken) continue;
    const a = String(p.baseToken.address || '');
    if ((evm ? lower(a) : a) !== want) continue;
    if (dexes && !dexes.includes(p.dexId)) continue;
    const l = liqUsd(p);
    if (l > bestLiq) {
      best = p;
      bestLiq = l;
    }
  }
  return best;
}

// A chain's own coin in dollars from its most liquid valid pair. The wrapped coin may be the base or the quote:
// priceNative is base tokens priced in quote tokens, so quote USD = base USD / priceNative.
export function wrappedUsd(pairs, which) {
  const w = WRAPPED[which];
  if (!w) return null;
  const list = Array.isArray(pairs) ? pairs : pairs && Array.isArray(pairs.pairs) ? pairs.pairs : [];
  const matches = (token) => isEvm(w.address) ? lower(token?.address) === lower(w.address) : token?.address === w.address;
  const [lo, hi] = PRICE_RANGE[which];
  let value = null;
  let liquidity = -1;
  for (const p of list) {
    if (!p || p.chainId !== w.chain) continue;
    const baseUsd = num(p.priceUsd);
    const native = num(p.priceNative);
    const v = matches(p.baseToken) ? baseUsd
      : matches(p.quoteToken) && fin(native) && native > 0 ? baseUsd / native : NaN;
    if (!fin(v) || v < lo || v > hi) continue;
    const depth = liqUsd(p);
    if (depth > liquidity) {
      value = v;
      liquidity = depth;
    }
  }
  return value;
}

// a pair's own numbers over 5 minutes, an hour and a day: [vol5m $, buys5m, sells5m, vol1h $, txns1h, vol24h $, txns24h,
// change5m %, change1h %] (each -1 when not known)
export function pairDx(p) {
  const n = (v) => {
    const x = num(v);
    return fin(x) ? x : -1;
  };
  const tx = (w) => (p && p.txns && p.txns[w]) || {};
  const t = (w) => {
    const b = num(tx(w).buys);
    const s = num(tx(w).sells);
    return fin(b) && fin(s) ? b + s : -1;
  };
  const v = (p && p.volume) || {};
  const c = (p && p.priceChange) || {};
  return [n(v.m5), n(tx('m5').buys), n(tx('m5').sells), n(v.h1), t('h1'), n(v.h24), t('h24'), n(c.m5), n(c.h1)];
}

// A pump.fun coin's pool after migration, from its DexScreener pair: SOL-priced (its SOL and its tokens), or null
export function solPoolState(p) {
  if (!p || !p.quoteToken || p.quoteToken.address !== WSOL || !p.liquidity) return null;
  const ls = num(p.liquidity.quote);
  const lb = num(p.liquidity.base);
  if (!(ls > 0) || !(lb > 0) || ls > 1e7 || lb > 1e13) return null;
  return { k: 'p', ls, lb };
}

// Any other chain's coin from its DexScreener pair: dollar-priced. `gr`: trading in a pool (not on a launchpad's curve)
export function usdPairState(p) {
  if (!p || typeof p !== 'object') return null;
  const mu = num(p.marketCap ?? p.fdv);
  if (!(mu > 0) || mu > 1e13) return null;
  const lu = liqUsd(p);
  const onCurve = Object.hasOwn(CURVE_DEXES, String(p.dexId));
  return { k: 'u', mu, lu: lu > 0 ? lu : null, pg: null, gr: !onCurve, cl: false };
}

// DexScreener's newest token profiles → [{ chain, address, icon }] for the chains asked (`chains`: DexScreener's ids; an
// EVM address lower-cased, a Tron one as it is)
export function parseProfiles(data, chains) {
  const out = [];
  for (const x of Array.isArray(data) ? data : []) {
    if (!x || typeof x !== 'object' || !chains.includes(x.chainId)) continue;
    const address = x.chainId === 'tron' ? (isTron(x.tokenAddress) ? x.tokenAddress : null) : isEvm(x.tokenAddress) ? lower(x.tokenAddress) : null;
    if (!address) continue;
    out.push({ chain: x.chainId, address, icon: typeof x.icon === 'string' ? x.icon : null });
  }
  return out;
}

// ---------- clank.trade (Robinhood Chain) ----------

export const CLANK_ETH = '0x0000000000000000000000000000000000000000';
export const CLANK_SPCX = '0x4a0e65a3eccec6dbe60ae065f2e7bb85fae35eea';
// its curve's stage: 0 on its curve · 1, 2 graduating (closed for a moment) · 3 in its pool · 4 rescued
const CLANK_POOL = 3;

// A clank.trade coin from its list (`rates`: its pair tokens' dollar prices, by address) → { address, name, symbol, image,
// born (ms), st } or null. Its market cap is in its pair (ETH, or SPCX): × that pair's price, dollars (unknown price:
// no state, never a guess).
export function clankCoin(c, rates) {
  if (!c || typeof c !== 'object' || !isEvm(c.address)) return null;
  const name = cleanName(c.name);
  const symbol = cleanTicker(c.symbol);
  if (!name || !symbol) return null;
  const pair = isEvm(c.quoteCurrency) ? lower(c.quoteCurrency) : CLANK_ETH;
  const rate = rates && rates.get ? rates.get(pair) : null;
  const mc = num(c.marketCap);
  const mu = fin(rate) && rate > 0 && fin(mc) && mc >= 0 ? mc * rate : NaN;
  const progress = num(c.progress);
  const state = num(c.state);
  const born = num(c.createdAt) * 1000;
  const st = mu > 0 && mu < 1e13 ? { k: 'u', mu, lu: null, pg: fin(progress) ? Math.min(1, Math.max(0, progress / 100)) : null,
    gr: state === CLANK_POOL || c.isLive === true, cl: state === 1 || state === 2 } : null;
  return { address: lower(c.address), name, symbol, image: typeof c.image === 'string' ? c.image : null,
    born: fin(born) && born > 0 ? born : null, st };
}

// ---------- the wire (what browsers get) ----------

// a state as a short array: ['c', vs, vt, rt, rs, done] · ['p', ls, lb] · ['u', mu, lu, pg, gr, cl] (unknown: -1)
export function encodeState(st) {
  if (!st) return null;
  if (st.k === 'c') return ['c', r6(st.vs), Math.round(st.vt), Math.round(st.rt), r6(st.rs), st.done ? 1 : 0];
  if (st.k === 'p') return ['p', r6(st.ls), Math.round(st.lb)];
  if (st.k === 'u') {
    return ['u', r2(st.mu), st.lu == null ? -1 : r2(st.lu), st.pg == null ? -1 : Math.round(st.pg * 1e4) / 1e4, st.gr ? 1 : 0,
      st.cl ? 1 : 0];
  }
  return null;
}

// a coin as browsers get it: { id, m (its address), n, s, p (its picture's path), b (born, ms), by (its creator), src,
// soc (1 X, 2 Telegram, 4 website), sup, st, st0 (its state at launch, when known), tr (its market is live: 1) }
export function encodeCoin(c) {
  const out = { id: c.id, m: c.key, n: c.name, s: c.symbol, p: c.pic || null, b: c.born, by: c.by || null, src: c.src || null,
    soc: c.soc || 0, sup: c.sup || PUMP.supply, st: encodeState(c.st), tr: c.tracked ? 1 : 0 };
  if (c.st0) out.st0 = encodeState(c.st0);
  if (c.dx) out.dx = c.dx;
  return out;
}

// what a coin's metadata says about its socials (pump.fun's JSON: twitter, telegram, website) → a bitmask
export function socialsOf(meta) {
  if (!meta || typeof meta !== 'object') return 0;
  const has = (k) => typeof meta[k] === 'string' && meta[k].trim().length > 3;
  return (has('twitter') ? 1 : 0) | (has('telegram') ? 2 : 0) | (has('website') ? 4 : 0);
}
