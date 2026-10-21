// TRENCHING SIMULATOR's bonding curve and pool (2026-10-20): the numbers of the launchpad the game's coins launch on,
// as pump.fun's bonding curve has them (re-checked on the web for this game): a constant product of virtual reserves,
// 30 virtual SOL and 1,073,000,000 virtual tokens to start, 793,100,000 tokens for sale on the curve and 206,900,000
// kept for its pool, a billion in all. Sold out, the curve holds 85.005 SOL and the coin's market cap is 410.88 SOL
// (about 14.7 times its start); it then moves into a constant-product pool with that SOL and the 206,900,000 tokens kept,
// at the same price. Tokens are whole numbers (so every token is always somewhere: a holder, the curve, the pool), SOL
// is a plain number. Pure: read in Node too (tests/trench.test.js).

export const SUPPLY = 1_000_000_000;
export const V_SOL = 30;
export const V_TOK = 1_073_000_000;
export const CURVE_TOK = 793_100_000; // for sale on the curve
export const RESERVED = SUPPLY - CURVE_TOK; // 206,900,000: kept for the pool
export const FLOOR_TOK = V_TOK - CURVE_TOK; // 279,900,000: the virtual tokens left when the curve is sold out
export const K = V_SOL * V_TOK; // 3.219e10
export const START_PRICE = V_SOL / V_TOK; // SOL a token
export const START_MC = START_PRICE * SUPPLY; // 27.959 SOL
export const GRAD_SOL = K / FLOOR_TOK - V_SOL; // 85.005 SOL raised when it's sold out
export const GRAD_PRICE = K / (FLOOR_TOK * FLOOR_TOK);
export const GRAD_MC = GRAD_PRICE * SUPPLY; // 410.88 SOL
export const GRAD_M = GRAD_MC / START_MC; // 14.696: a market cap this many times its start completes the curve

// The launchpad's own fee on the curve, and the pool's (on every trade, taken from the SOL side)
export const FEES = { curve: 0.01, pool: 0.003 };

export const newCurve = () => ({ left: CURVE_TOK });
export const newPool = () => ({ sol: GRAD_SOL, tok: RESERVED });

const vTokOf = (c) => FLOOR_TOK + c.left;

// ---------- the curve ----------

export const curvePrice = (c) => {
  const v = vTokOf(c);
  return K / (v * v);
};
// the real SOL in the curve (what's been paid in, less what's been taken out)
export const curveSol = (c) => K / vTokOf(c) - V_SOL;
// how much of its tokens are sold, 0 … 1 (pump.fun's "bonding curve progress")
export const curveProgress = (c) => (CURVE_TOK - c.left) / CURVE_TOK;
// the market cap as a multiple of its start (1 … 14.696 on the curve)
export const curveM = (c) => {
  const r = V_TOK / vTokOf(c);
  return r * r;
};
// the curve that a multiple m of its start market cap means (the inverse of curveM), for tests and the harness
export const curveAtM = (m) => ({ left: Math.max(0, Math.min(CURVE_TOK, Math.round(V_TOK / Math.sqrt(m) - FLOOR_TOK))) });

// `sol` (after fees) into the curve → the tokens it buys. The curve sells at most what's left: then `full`, and `used`
// is the SOL that bought them (the rest comes back).
export function curveBuyQuote(c, sol) {
  if (!(sol > 0) || c.left <= 0) return { out: 0, used: 0, full: c.left <= 0 };
  const v = vTokOf(c);
  const vs = K / v;
  const need = K / FLOOR_TOK - vs; // what buys everything that's left
  if (sol >= need * (1 - 1e-12)) return { out: c.left, used: need, full: true };
  const out = Math.min(c.left - 1, Math.max(0, Math.floor(v - K / (vs + sol))));
  return { out, used: sol, full: false };
}
export function curveBuy(c, sol) {
  const q = curveBuyQuote(c, sol);
  c.left -= q.out;
  return q;
}
// `tok` tokens sold into the curve → the SOL it pays (before fees)
export function curveSellQuote(c, tok) {
  const t = Math.max(0, Math.floor(tok));
  if (t <= 0) return 0;
  const v = vTokOf(c);
  // never more than the curve sold (a holder's tokens all came from it)
  const back = Math.min(t, CURVE_TOK - c.left);
  return Math.max(0, K / v - K / (v + back));
}
export function curveSell(c, tok) {
  const back = Math.min(Math.max(0, Math.floor(tok)), CURVE_TOK - c.left);
  const sol = curveSellQuote(c, back);
  c.left += back;
  return { sol, back };
}

// ---------- the pool (after the curve sells out) ----------

export const poolPrice = (p) => p.sol / p.tok;
export const poolM = (p) => (p.sol / p.tok) * SUPPLY / START_MC;
export function poolBuyQuote(p, sol) {
  if (!(sol > 0)) return { out: 0, used: 0 };
  const out = Math.max(0, Math.floor(p.tok - (p.sol * p.tok) / (p.sol + sol)));
  return { out: Math.min(out, p.tok - 1), used: sol };
}
export function poolBuy(p, sol) {
  const q = poolBuyQuote(p, sol);
  p.tok -= q.out;
  p.sol += q.used;
  return q;
}
export function poolSellQuote(p, tok) {
  const t = Math.max(0, Math.floor(tok));
  if (t <= 0) return 0;
  return Math.max(0, p.sol - (p.sol * p.tok) / (p.tok + t));
}
export function poolSell(p, tok) {
  const t = Math.max(0, Math.floor(tok));
  const sol = poolSellQuote(p, t);
  p.tok += t;
  p.sol -= sol;
  return { sol, back: t };
}

// ---------- a coin's market, whichever it's in ----------

// A coin's market: { phase: 'curve' | 'migrating' | 'pool', curve, pool }. A live coin's (Live mode, 2026-10-21) is
// always a pool of its real reserves (a real bonding curve is a constant product too), with its own `fee`, `cap` (the
// tokens its live curve still has for sale: a buy never gets more) and `closed` (its curve sold out, its pool not open
// yet: nothing trades); a made-up coin's market has none of them.
export const priceOf = (mk) => (mk.phase === 'pool' ? poolPrice(mk.pool) : curvePrice(mk.curve));
export const mcOf = (mk) => priceOf(mk) * SUPPLY; // in SOL
export const mOf = (mk) => (mk.phase === 'pool' ? poolM(mk.pool) : curveM(mk.curve));
export const feeOf = (mk) => (Number.isFinite(mk.fee) ? mk.fee : mk.phase === 'pool' ? FEES.pool : FEES.curve);
const closedMk = (mk) => mk.phase === 'migrating' || mk.closed === true;
// the SOL a buyer or a seller meets: the curve's real SOL, or the pool's SOL
export const liquidityOf = (mk) => (mk.phase === 'pool' ? mk.pool.sol : curveSol(mk.curve));

// What `sol` (gross: before the market's fee) buys right now, without buying it
export function buyQuote(mk, sol) {
  if (closedMk(mk)) return { out: 0, used: 0, fee: 0, full: false, closed: true };
  const fee = sol * feeOf(mk);
  if (mk.phase === 'pool') {
    const q = poolBuyQuote(mk.pool, sol - fee);
    // a live curve sells at most what it has left: then `full`, and only what bought that is used (and its fee on it)
    if (Number.isFinite(mk.cap) && q.out > mk.cap) {
      const out = Math.max(0, Math.floor(mk.cap));
      const net = out > 0 && mk.pool.tok > out ? (mk.pool.sol * out) / (mk.pool.tok - out) : 0;
      const used = net / (1 - feeOf(mk));
      return { out, used, fee: used * feeOf(mk), full: true, closed: false };
    }
    return { out: q.out, used: sol, fee, full: false, closed: false };
  }
  const q = curveBuyQuote(mk.curve, sol - fee);
  // a buy that completes the curve only pays for what it gets (and its fee on that)
  const used = q.full ? q.used / (1 - feeOf(mk)) : sol;
  return { out: q.out, used, fee: used * feeOf(mk), full: q.full, closed: false };
}
// Buys: the market moves. → { out, used, fee, full }
export function buy(mk, sol) {
  const q = buyQuote(mk, sol);
  if (q.closed || q.out <= 0) return { ...q, out: 0, used: 0, fee: 0 };
  if (mk.phase === 'pool' && q.full) {
    // a live curve sold out by this buy: exactly what it had left
    mk.pool.tok -= q.out;
    mk.pool.sol += q.used - q.fee;
  } else if (mk.phase === 'pool') poolBuy(mk.pool, q.used - q.fee);
  else curveBuy(mk.curve, q.used - q.fee);
  if (Number.isFinite(mk.cap)) mk.cap = Math.max(0, mk.cap - q.out);
  return q;
}
// What selling `tok` pays right now (net of the market's fee), without selling
export function sellQuote(mk, tok) {
  if (closedMk(mk)) return { sol: 0, gross: 0, fee: 0, closed: true };
  const gross = mk.phase === 'pool' ? poolSellQuote(mk.pool, tok) : curveSellQuote(mk.curve, tok);
  const fee = gross * feeOf(mk);
  return { sol: gross - fee, gross, fee, closed: false };
}
export function sell(mk, tok) {
  if (closedMk(mk)) return { sol: 0, gross: 0, fee: 0, back: 0, closed: true };
  const r = mk.phase === 'pool' ? poolSell(mk.pool, tok) : curveSell(mk.curve, tok);
  if (Number.isFinite(mk.cap)) mk.cap += r.back;
  const fee = r.sol * feeOf(mk);
  return { sol: r.sol - fee, gross: r.sol, fee, back: r.back, closed: false };
}
