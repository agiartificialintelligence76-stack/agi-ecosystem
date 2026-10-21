// TRENCHING SIMULATOR's numbers as players read them (2026-10-20): dollars and SOL, short (12.3K) or whole
// ($1,234.56), signed percents with a real minus (−4.5%), ages (4m), clocks (05:00), token amounts, prices with their
// zeros written small (0.0₅1234, as trading terminals do), market caps in dollars. Pure: read in Node too
// (tests/trench-game.test.js). Every function takes a number and gives a string, and never throws.

const MINUS = '−';
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const fin = (x) => typeof x === 'number' && Number.isFinite(x);

// 1234 → "1.23K", 12345678 → "12.3M" (3 significant digits from a thousand up); under a thousand, `dp` decimals
export function compact(n, dp = 2) {
  if (!fin(n)) return '—';
  const a = Math.abs(n);
  const sign = n < 0 ? MINUS : '';
  const units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  // from 0.9995 of a unit up (999,600 is "1M", never "1000K")
  for (const [v, u] of units) {
    if (a >= v * 0.9995) {
      const x = a / v;
      const s = x.toFixed(x >= 99.95 ? 0 : x >= 9.995 ? 1 : 2);
      return `${sign}${trimZeros(s)}${u}`;
    }
  }
  return `${sign}${trimZeros(a.toFixed(dp))}`;
}

const trimZeros = (s) => (s.includes('.') ? s.replace(/\.?0+$/, '') : s);

// with commas: 1234567.891 → "1,234,567.89"
export function grouped(n, dp = 2) {
  if (!fin(n)) return '—';
  const sign = n < 0 ? MINUS : '';
  const [i, f] = Math.abs(n).toFixed(dp).split('.');
  return `${sign}${i.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${f ? `.${f}` : ''}`;
}

// dollars, short: "$1.23K", "$234", "$0.52", "$0.0034"
export function usd(n) {
  if (!fin(n)) return '—';
  const a = Math.abs(n);
  const sign = n < 0 ? MINUS : '';
  if (a >= 1000) return `${sign}$${compact(a)}`;
  if (a >= 1) return `${sign}$${trimZeros(a.toFixed(2))}`;
  if (a === 0) return '$0';
  if (a >= 0.01) return `${sign}$${a.toFixed(2)}`;
  return `${sign}$${price(a, 2)}`;
}

// dollars, whole: "$1,234.56"
export const usdFull = (n) => (fin(n) ? `${n < 0 ? MINUS : ''}$${grouped(Math.abs(n), 2)}` : '—');

// SOL amounts, as many decimals as it needs: ≥100 one, ≥10 two, ≥1 three, ≥0.001 four, else six
export function sol(n) {
  if (!fin(n)) return '—';
  const a = Math.abs(n);
  const sign = n < 0 ? MINUS : '';
  if (a === 0) return '0';
  if (a >= 100000) return `${sign}${compact(a)}`;
  const dp = a >= 100 ? 1 : a >= 10 ? 2 : a >= 1 ? 3 : a >= 0.001 ? 4 : 6;
  return `${sign}${grouped(a, dp).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')}`;
}

// a signed amount (P&L): "+0.123", "−0.045"; `unit` "sol" or "usd"
export function signed(n, unit = 'sol') {
  if (!fin(n)) return '—';
  const s = unit === 'usd' ? usd(Math.abs(n)) : sol(Math.abs(n));
  if (n > 0 && s !== '0' && s !== '$0') return `+${s}`;
  if (n < 0 && s !== '0' && s !== '$0') return `${MINUS}${s}`;
  return s;
}

// a fraction as a signed percent: 0.123 → "+12.3%", −0.045 → "−4.5%", 0 → "0%"; big ones short ("+1.2K%")
export function pct(x, dp = 1) {
  if (!fin(x)) return '—';
  const p = x * 100;
  const a = Math.abs(p);
  const body = a >= 10000 ? compact(a) : trimZeros(a.toFixed(a >= 1000 ? 0 : dp));
  if (body === '0') return '0%';
  return `${p > 0 ? '+' : MINUS}${body}%`;
}

// a fraction as a plain percent: 0.123 → "12.3%"
export function share(x, dp = 1) {
  if (!fin(x)) return '—';
  return `${trimZeros((x * 100).toFixed(dp))}%`;
}

// a multiple: 2.345 → "2.35x", 12.3 → "12.3x"; next to 1x, as many decimals (up to 4) as it takes to say which side of
// it it is: 0.9978 → "0.998x", 1.004 → "1.004x" (a small loss never reads "1x")
export function times(x) {
  if (!fin(x)) return '—';
  const a = Math.abs(x);
  let dp = a >= 100 ? 0 : a >= 10 ? 1 : 2;
  if (x !== 1 && dp === 2) while (dp < 4 && Number(x.toFixed(dp)) === 1) dp++;
  return `${trimZeros(x.toFixed(dp))}x`;
}

// how old: "12s", "4m", "3h", "2d" (under a second: "now")
export function age(s) {
  if (!fin(s)) return '—';
  const a = Math.max(0, s);
  if (a < 1) return 'now';
  if (a < 60) return `${Math.floor(a)}s`;
  if (a < 3600) return `${Math.floor(a / 60)}m`;
  if (a < 86400) return `${Math.floor(a / 3600)}h`;
  return `${Math.floor(a / 86400)}d`;
}

// a clock: 305 → "05:05", 3725 → "1:02:05" (never below 0)
export function clock(s) {
  if (!fin(s)) return '—';
  const a = Math.max(0, Math.floor(s));
  const h = Math.floor(a / 3600);
  const m = Math.floor((a % 3600) / 60);
  const sec = a % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// token amounts: short ("12.3M")
export const tokens = (n) => (fin(n) ? compact(Math.max(0, n), 2) : '—');

// a price, its zeros written small when there are four or more (the subscript says how many zeros come after the
// point): 0.0000012345 → "0.0₅1235", 0.000123 → "0.000123"
export function price(p, sig = 4) {
  if (!fin(p)) return '—';
  if (p === 0) return '0';
  const a = Math.abs(p);
  const sign = p < 0 ? MINUS : '';
  if (a >= 1) return `${sign}${grouped(a, a >= 1000 ? 2 : 4).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')}`;
  let zeros = Math.floor(-Math.log10(a)); // the zeros after the point: 0.00012 → 3
  if (a * 10 ** zeros >= 1) zeros -= 1; // 0.001 exactly: log10 gives 3, but it has 2 zeros
  let digits = Math.round(a * 10 ** (zeros + sig)); // its first `sig` significant digits
  // 0.000099999 rounds up to a digit more: one zero fewer
  if (digits >= 10 ** sig) {
    digits = Math.round(digits / 10);
    zeros -= 1;
  }
  if (zeros < 0) return `${sign}1`; // 0.99999 rounds up to a whole 1
  const body = String(digits).replace(/0+$/, '') || '0';
  if (zeros >= 4) return `${sign}0.0${[...String(zeros)].map((x) => SUB[x]).join('')}${body}`;
  return `${sign}0.${'0'.repeat(Math.max(0, zeros))}${body}`;
}

// a market cap in SOL as dollars: "$12.3K"
export const mcUsd = (mcSol, solUsd) => (fin(mcSol) && fin(solUsd) ? usd(mcSol * solUsd) : '—');

// ---------- a terminal's money ----------
// `currency`: 'sol', 'usd', or (Live mode, since 2026-10-21: the owner's "Each chain's money") a chain's own coin with its
// dollar price frozen for the run, { coin: 'eth' | 'bnb', usd }. The game counts in SOL underneath; amounts are shown in
// the terminal's money at the run's prices.
const COIN_NAMES = Object.freeze({ eth: 'ETH', bnb: 'BNB' });
export const isCoinCurrency = (c) => Boolean(c) && typeof c === 'object' && Object.hasOwn(COIN_NAMES, c.coin) && fin(c.usd) && c.usd > 0;
// a currency as given (a result's, say), checked: 'usd', a chain's coin, or else 'sol'
export const currencyOf = (c) => (c === 'usd' || isCoinCurrency(c) ? c : 'sol');
// → { id: 'sol' | 'usd' | 'eth' | 'bnb', name: 'SOL' | 'USD' | 'ETH' | 'BNB', per: how many of it one SOL is }
export function unitOf(currency, solUsd) {
  const px = fin(solUsd) && solUsd > 0 ? solUsd : 150;
  if (currency === 'usd') return { id: 'usd', name: 'USD', per: px };
  if (isCoinCurrency(currency)) return { id: currency.coin, name: COIN_NAMES[currency.coin], per: px / currency.usd };
  return { id: 'sol', name: 'SOL', per: 1 };
}
// an amount rounded to one people pick: two significant figures (0.0404 → 0.04, 0.202 → 0.2, 4.04 → 4)
export function nice(x) {
  if (!fin(x) || x <= 0) return x;
  return Number(x.toPrecision(2));
}

// an amount in the terminal's own money: SOL ("1.234 SOL" or "1.234"), dollars ("$185.10") or a chain's coin ("0.04 ETH")
export function money(solAmount, currency, solUsd, { unit = true } = {}) {
  if (!fin(solAmount)) return '—';
  if (currency === 'usd') return fin(solUsd) ? usd(solAmount * solUsd) : '—';
  const u = unitOf(currency, solUsd);
  const v = sol(solAmount * u.per);
  return unit ? `${v} ${u.name}` : v;
}

// a signed amount in the terminal's own money
export function moneySigned(solAmount, currency, solUsd) {
  if (!fin(solAmount)) return '—';
  if (currency === 'usd') return fin(solUsd) ? signed(solAmount * solUsd, 'usd') : '—';
  const u = unitOf(currency, solUsd);
  return `${signed(solAmount * u.per, 'sol')} ${u.name}`;
}
