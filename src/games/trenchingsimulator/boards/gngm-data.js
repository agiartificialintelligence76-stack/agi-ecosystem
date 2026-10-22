// GNGM's numbers (2026-10-22): what its scanner shows, worked out from the market (../engine.js) and nothing else: its
// chart's sums (candles of any size with their buys and sells, a price or a market cap in dollars or the run's own coin,
// its axis labels, moving averages, RSI and MACD), a coin card's metrics and the columns' filters (safe, smart money,
// strict), what each trade was to its maker (New Holder, Buy More, Sell Part, Sell All), the top traders from their money
// in and out, the security checklist, the first buyers' grid, the KOL and smart money feed, a wallet's page (its week
// before the run, this run, how its trades ended) and the trade module's sums ("take my initial", limit and auto
// orders). A real coin's unknowns stay unknown (null, shown as "—"): never a made-up number about a real coin. Pure: read
// in Node by tests/trench-game.test.js.
import { SUPPLY } from '../curve.js';
import { price as tinyPrice, usd, compact, share } from '../format.js';
import { KOLS, kolById, smartAddress } from '../names.js';

const fin = (x) => typeof x === 'number' && Number.isFinite(x);
const orNull = (x) => (fin(x) ? x : null);

// ---------- the chart ----------
// its candle sizes: 1 s to 15 min (the market keeps 4,000 one-second candles a coin, so longer ones would be a few bars)
export const GTF = Object.freeze([
  Object.freeze({ id: '1s', s: 1 }), Object.freeze({ id: '15s', s: 15 }), Object.freeze({ id: '30s', s: 30 }),
  Object.freeze({ id: '1m', s: 60 }), Object.freeze({ id: '5m', s: 300 }), Object.freeze({ id: '15m', s: 900 }),
]);

// 1-second candles ({ t, o, h, l, c, v, b, s }) made into candles of `tf` seconds, their buys and sells kept; a bucket
// with no trade is left out
export function aggregate(candles, tf) {
  const out = [];
  const s = tf > 1 ? tf : 1;
  for (const x of candles || []) {
    const t = Math.floor(x.t / s) * s;
    const last = out[out.length - 1];
    if (last && last.t === t) {
      if (x.h > last.h) last.h = x.h;
      if (x.l < last.l) last.l = x.l;
      last.c = x.c;
      last.v += x.v || 0;
      last.b += x.b || 0;
      last.s += x.s || 0;
    } else out.push({ t, o: x.o, h: x.h, l: x.l, c: x.c, v: x.v || 0, b: x.b || 0, s: x.s || 0 });
  }
  return out;
}

// what a market cap in SOL shows as: `mode` 'mcap' or 'price' (a token's), `unit` 'usd' or 'coin' (the run's own money:
// SOL, or a chain's coin at `per` of it a SOL)
export const valueOf = (mcSol, { mode = 'mcap', unit = 'usd', solUsd = 150, per = 1 } = {}) =>
  (mcSol * (unit === 'usd' ? solUsd : per)) / (mode === 'price' ? SUPPLY : 1);

// the axis and crosshair labels: market caps short ("$12.3K", "84.2"), prices with their zeros small ("$0.0₅1234")
export function formatterFor(mode, unit) {
  if (mode === 'price') return (v) => (unit === 'usd' ? `$${tinyPrice(v, 4)}` : tinyPrice(v, 4));
  return (v) => (unit === 'usd' ? usd(v) : compact(v, 2));
}

// moving averages over `xs` (null until there are `n`): simple, and exponential (started from the simple one)
export function sma(xs, n) {
  const out = new Array(xs.length).fill(null);
  if (!(n >= 1)) return out;
  let sum = 0;
  for (let i = 0; i < xs.length; i++) {
    sum += xs[i];
    if (i >= n) sum -= xs[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}
export function ema(xs, n) {
  const out = new Array(xs.length).fill(null);
  if (!(n >= 1) || xs.length < n) return out;
  const k = 2 / (n + 1);
  let e = 0;
  for (let i = 0; i < n; i++) e += xs[i];
  e /= n;
  out[n - 1] = e;
  for (let i = n; i < xs.length; i++) {
    e = xs[i] * k + e * (1 - k);
    out[i] = e;
  }
  return out;
}
// RSI (Wilder's, 0 to 100; null for the first `n`)
export function rsi(closes, n = 14) {
  const out = new Array(closes.length).fill(null);
  let up = 0;
  let dn = 0;
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const u = Math.max(d, 0);
    const w = Math.max(-d, 0);
    if (i <= n) {
      up += u / n;
      dn += w / n;
    } else {
      up = (up * (n - 1) + u) / n;
      dn = (dn * (n - 1) + w) / n;
    }
    if (i >= n) out[i] = dn === 0 ? (up === 0 ? 50 : 100) : 100 - 100 / (1 + up / dn);
  }
  return out;
}
// MACD (12, 26, 9): its line, its signal and their difference (null until each is there)
export function macd(closes, fast = 12, slow = 26, sig = 9) {
  const f = ema(closes, fast);
  const s = ema(closes, slow);
  const line = closes.map((_, i) => (f[i] !== null && s[i] !== null ? f[i] - s[i] : null));
  const start = line.findIndex((x) => x !== null);
  const signal = new Array(closes.length).fill(null);
  if (start >= 0) {
    const sg = ema(line.slice(start), sig);
    for (let i = 0; i < sg.length; i++) signal[start + i] = sg[i];
  }
  const hist = line.map((x, i) => (x !== null && signal[i] !== null ? x - signal[i] : null));
  return { line, signal, hist };
}
// the indicators the chart's "fx" menu offers
export const INDICATORS = Object.freeze([['ma', 'MA 20'], ['ema', 'EMA 9'], ['rsi', 'RSI 14'], ['macd', 'MACD']]);
// the chart's legend for the indicators shown (`fx`: their values at its candle, null until there are enough candles;
// `ind`: which, in the order picked; `fmt`: the chart's own number format): "RSI 14 50.0  MACD 12 26 9 $0 $0"
export function fxText(fx, ind, fmt) {
  const f = typeof fmt === 'function' ? fmt : String;
  const x = fx && typeof fx === 'object' ? fx : {};
  const v = (n, g = f) => (typeof n === 'number' && Number.isFinite(n) ? g(n) : '—');
  const words = { ma: () => `MA 20 ${v(x.ma)}`, ema: () => `EMA 9 ${v(x.ema)}`, rsi: () => `RSI 14 ${v(x.rsi, (n) => n.toFixed(1))}`,
    macd: () => `MACD 12 26 9 ${v(x.macd)} ${v(x.signal)}` };
  return (Array.isArray(ind) ? ind : []).filter((k) => Object.hasOwn(words, k)).map((k) => words[k]()).join('  ');
}

// ---------- the Trenches' cards and filters ----------
// a card's numbers: its row (lists()) and, when it's there, its stats() for the smart wallets and KOLs holding it; what
// isn't known about a real coin is null
export function cardMetrics(r, s = null) {
  if (!r) return null;
  const live = Boolean(r.live);
  const known = (x) => (live ? null : orNull(x));
  return {
    mc: orNull(r.mc), vol: orNull(r.vol), vol5m: orNull(r.vol5m), txns: orNull(r.txns), txns5m: orNull(r.txns5m),
    holders: known(r.holders), top10: known(r.top10), dev: known(r.dev), devSold: known(r.devSold),
    snipers: known(r.snipers), insiders: known(r.insiders), bundlers: known(r.bundlers),
    smart: live || !s ? null : orNull(s.smart), kols: live || !s || !Array.isArray(s.kols) ? null : s.kols.length,
    progress: orNull(r.progress), age: orNull(r.age), live, rugged: r.rugged === true,
  };
}

// how worrying a share of the supply is: 'ok', 'warn', 'bad', or 'na' (not known)
const LIMITS = Object.freeze({ top10: [0.2, 0.3], dev: [0.05, 0.1], snipers: [0.05, 0.1], insiders: [0.05, 0.1],
  bundlers: [0.05, 0.1] });
export function riskOf(kind, x) {
  const L = Object.hasOwn(LIMITS, kind) ? LIMITS[kind] : null;
  if (!L || !fin(x)) return 'na';
  return x > L[1] ? 'bad' : x > L[0] ? 'warn' : 'ok';
}

// a column's filter presets (the scanners' kind, our own numbers): safe = not rugged, and bundlers, insiders and the dev
// each 30% of the supply or less; smart money = a smart wallet holds it; strict = both, and $1,000 traded or more. A
// number that isn't known (a real coin's) never passes a filter that needs it.
export const FILTERS = Object.freeze([['all', 'All'], ['safe', 'Safe'], ['smart', 'Smart money'], ['strict', 'Strict']]);
export function passes(m, filter, solUsd = 150) {
  if (!m) return false;
  if (!filter || filter === 'all') return true;
  const le = (x, max) => fin(x) && x <= max;
  const safe = !m.rugged && le(m.bundlers, 0.3) && le(m.insiders, 0.3) && le(m.dev, 0.3);
  const smart = fin(m.smart) && m.smart >= 1;
  if (filter === 'safe') return safe;
  if (filter === 'smart') return smart;
  if (filter === 'strict') return safe && smart && fin(m.vol) && m.vol * solUsd >= 1000;
  return true;
}

// ---------- a coin's trades, makers and traders ----------
// a maker's tag after its address (the engine's labels: never "regular")
export const MAKER_TAGS = Object.freeze({ dev: 'DEV', sniper: 'Sniper', insider: 'Insider', bundler: 'Bundler',
  smart: 'Smart', kol: 'KOL', whale: 'Whale', me: 'You', mev: 'Bot' });
export const makerTag = (label) => (typeof label === 'string' && Object.hasOwn(MAKER_TAGS, label) ? MAKER_TAGS[label] : '');
// the Activity tab's chips: whose trades it shows
export const MAKER_FILTERS = Object.freeze([['all', 'All'], ['smart', 'Smart'], ['kol', 'KOL'], ['whale', 'Whale'],
  ['dev', 'Dev'], ['sniper', 'Sniper'], ['insider', 'Insider'], ['me', 'You']]);
export function makerOk(t, f) {
  if (!t) return false;
  if (!f || f === 'all') return true;
  if (f === 'me') return Boolean(t.me);
  if (f === 'kol') return Boolean(t.kol) || t.label === 'kol';
  return t.label === f;
}

// What each trade was to its maker: a buy by a wallet that held none of it ("New Holder") or some ("Buy More"), a sell of
// part of it ("Sell Part") or the rest ("Sell All"). `trades`: newest first (the engine's trades()); `holders`: the
// holders listed now (holders(id, n).list); `complete`: whether that's every holder (else a wallet not listed holds an
// unknown little). Worked out backwards from what each wallet holds now. One label a trade; '' when its maker isn't known
// (a real coin's trades are nobody we know).
export function activityLabels(trades, holders, complete) {
  const now = new Map();
  for (const h of holders || []) if (h && h.addr) now.set(h.addr, h.tok);
  const bal = new Map(); // a wallet's tokens just after the trade being read (going back in time)
  const out = new Array((trades || []).length).fill('');
  (trades || []).forEach((t, i) => {
    if (!t || !t.addr || !fin(t.tok)) return;
    const after = bal.has(t.addr) ? bal.get(t.addr) : now.has(t.addr) ? now.get(t.addr) : complete ? 0 : null;
    const dust = Math.max(1, t.tok * 1e-9);
    let before = null;
    if (after !== null) before = t.side === 'buy' ? Math.max(0, after - t.tok) : after + t.tok;
    if (t.side === 'buy') out[i] = before !== null && before > dust ? 'Buy More' : 'New Holder';
    else out[i] = after !== null && after <= dust ? 'Sell All' : 'Sell Part';
    bal.set(t.addr, before);
  });
  // a buy we couldn't place (its wallet isn't listed): "Buy More" when it bought before in what's kept
  const seen = new Set();
  for (let i = out.length - 1; i >= 0; i--) {
    const t = trades[i];
    if (!t || !t.addr) continue;
    if (t.side === 'buy' && out[i] === 'New Holder' && seen.has(t.addr) && !now.has(t.addr) && !complete) out[i] = 'Buy More';
    seen.add(t.addr);
  }
  return out;
}

// its top traders: every holder listed (holders(id, n).list): what it put in and took out (SOL), what it holds is worth
// at the coin's price, and its profit: the biggest first
export function topTraders(list, price) {
  if (!Array.isArray(list) || !fin(price)) return [];
  return list.map((h) => {
    const value = h.tok * price;
    const inn = fin(h.in) ? h.in : 0;
    const out = fin(h.out) ? h.out : 0;
    const pnl = out + value - inn;
    return { addr: h.addr, label: h.label, kol: h.kol || null, me: Boolean(h.me), in: inn, out, tok: h.tok, value, pnl,
      pct: inn > 0 ? pnl / inn : null };
  }).sort((a, b) => b.pnl - a.pnl || (a.addr < b.addr ? -1 : a.addr > b.addr ? 1 : 0));
}

// ---------- the right column: security and first buyers ----------
export const CHECKS = Object.freeze([['mint', 'Mint authority'], ['freeze', 'Freeze authority'], ['lp', 'Liquidity'],
  ['top10', 'Top 10 holders'], ['dev', 'Dev holds'], ['devsold', 'Dev sold'], ['insiders', 'Insiders'],
  ['snipers', 'Snipers'], ['bundlers', 'Bundlers'], ['rug', 'Rugged']]);
// its checklist: each row's words and 'ok', 'warn', 'bad' or 'na'. A made-up coin's launchpad renounces its mint and
// freeze and burns its pool's liquidity; a real coin's checks aren't known here: every one "—" (never a guess)
export function securityChecks(s) {
  if (!s) return [];
  if (s.live) return CHECKS.map(([k, label]) => ({ k, label, value: '—', state: 'na' }));
  const part = (k, x) => ({ value: share(x), state: riskOf(k, x) });
  const v = {
    mint: { value: 'Renounced', state: 'ok' },
    freeze: { value: 'Renounced', state: 'ok' },
    lp: s.phase === 'pool' ? { value: 'Burnt 100%', state: 'ok' }
      : { value: s.phase === 'migrating' ? 'Moving to its pool' : 'On the curve', state: 'na' },
    top10: part('top10', s.top10),
    dev: part('dev', s.dev),
    devsold: { value: share(s.devSold, 0), state: fin(s.devSold) ? (s.devSold >= 0.5 ? 'warn' : 'ok') : 'na' },
    insiders: part('insiders', s.insiders),
    snipers: part('snipers', s.snipers),
    bundlers: part('bundlers', s.bundlers),
    rug: { value: s.rugged ? 'Yes' : 'No', state: s.rugged ? 'bad' : 'ok' },
  };
  return CHECKS.map(([k, label]) => ({ k, label, ...v[k] }));
}

// the first buyers' states, in the grid's order, and its summary (the engine's firstBuyers(id); null for a real coin)
export const FIRST_STATES = Object.freeze([['hold', 'Hold'], ['more', 'Bought more'], ['part', 'Sold part'], ['all', 'Sold all']]);
export function firstSummary(fb) {
  if (!fb || !Array.isArray(fb.list)) return null;
  const states = { hold: 0, more: 0, part: 0, all: 0 };
  let snipers = 0;
  let insiders = 0;
  for (const x of fb.list) {
    if (Object.hasOwn(states, x.status)) states[x.status]++;
    if (x.label === 'sniper') snipers++;
    if (x.label === 'insider') insiders++;
  }
  return { count: fb.list.length, states, snipers, insiders, got: orNull(fb.got), holdNow: orNull(fb.hold) };
}

// ---------- Track: the KOL and smart money feed ----------
export const TRACK_KINDS = Object.freeze(['kol_buy', 'kol_sell', 'smart_buy', 'smart_sell', 'whale_buy']);
export const TRACK_FILTERS = Object.freeze([['all', 'All'], ['kol', 'KOLs'], ['smart', 'Smart money'], ['whale', 'Whales']]);
// its rows from the market's feed (feed(since), oldest first): newest first, at most `max`
export function trackItems(events, { filter = 'all', max = 60 } = {}) {
  const out = [];
  const ev = Array.isArray(events) ? events : [];
  for (let i = ev.length - 1; i >= 0 && out.length < max; i--) {
    const e = ev[i];
    if (!e || !TRACK_KINDS.includes(e.kind) || !Number.isInteger(e.c)) continue;
    const who = e.kind.startsWith('kol') ? 'kol' : e.kind.startsWith('smart') ? 'smart' : 'whale';
    if (filter !== 'all' && filter !== who) continue;
    out.push({ q: e.q, t: e.t, coin: e.c, ticker: e.ticker || null, who, side: e.kind.endsWith('sell') ? 'sell' : 'buy',
      kol: typeof e.kol === 'string' ? e.kol : null, smart: Number.isInteger(e.smart) ? e.smart : null,
      sol: orNull(e.sol), frac: orNull(e.frac) });
  }
  return out;
}

// ---------- a wallet's page ----------
// how its trades ended: returns over 500%, 200–500%, 0–200%, 0 to −50% and under −50%
export const DIST_LABELS = Object.freeze(['>500%', '200–500%', '0–200%', '0 to −50%', '<−50%']);
export const distOf = (ret) => (ret > 5 ? 0 : ret > 2 ? 1 : ret > 0 ? 2 : ret >= -0.5 ? 3 : 4);
// a smart wallet's (smartWallets()[n]): its week before the run and this run (its open positions' returns as its
// distribution, since a closed one keeps only won or lost)
export function smartProfile(w) {
  if (!w || !Number.isInteger(w.n)) return null;
  const d = w.d7 || {};
  const closed = (w.won || 0) + (w.lost || 0);
  const dist = [0, 0, 0, 0, 0];
  for (const o of w.open || []) if (o.in > 0) dist[distOf((o.value + o.out - o.in) / o.in)]++;
  return {
    kind: 'smart', n: w.n, name: `Smart wallet ${w.n + 1}`, addr: w.addr,
    week: { pnl: orNull(d.pnl), winRate: d.trades > 0 ? d.won / d.trades : null, trades: orNull(d.trades), won: orNull(d.won),
      lost: orNull(d.lost), vol: orNull(d.vol), dist: Array.isArray(d.dist) ? d.dist.slice() : null },
    run: { pnl: orNull(w.pnl), upnl: orNull(w.upnl), winRate: closed > 0 ? w.won / closed : null, buys: w.buys, sells: w.sells,
      in: w.in, out: w.out, value: w.value, open: (w.open || []).length, dist },
  };
}
// a caller's address (the same everywhere: the engine's) and page from the feed: its calls and sells this run, the coins
// it called (never how honest or how good it really is: that's for players to learn)
export const kolAddress = (id) => {
  const i = KOLS.findIndex((k) => k.id === id);
  return i < 0 ? null : smartAddress(1000 + i);
};
export function kolProfile(id, events) {
  const k = kolById(id);
  if (!k) return null;
  const mine = (Array.isArray(events) ? events : []).filter((e) => e && e.kol === id && (e.kind === 'kol_buy' || e.kind === 'kol_sell'));
  const calls = mine.filter((e) => e.kind === 'kol_buy');
  return { kind: 'kol', id, name: `@${id}`, addr: kolAddress(id), followers: k.followers, calls: calls.length,
    sells: mine.length - calls.length, coins: [...new Set(calls.map((e) => e.c))] };
}

// ---------- the trade module ----------
// "Take my initial": the share of a position to sell to get back what's still in it (what went in less what came out
// already), found with the market's own quote (`gotFor(frac)` → SOL back); null when there's nothing to get back, or
// selling all of it wouldn't
export function initialFrac(pos, gotFor) {
  if (!pos || !(pos.tokens > 0) || typeof gotFor !== 'function') return null;
  const need = (fin(pos.invested) ? pos.invested : 0) - (fin(pos.sold) ? pos.sold : 0);
  if (!(need > 0)) return null;
  if (!(gotFor(1) > need)) return null;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (gotFor(mid) >= need) hi = mid;
    else lo = mid;
  }
  return Math.min(1, Math.ceil(hi * 1000) / 1000);
}

// A limit order: buy when the market cap falls to its trigger ("buy the dip") or rises to it ("buy the breakout"); sell
// when it rises to it ("take profit") or falls to it ("stop loss"). `mc`: the trigger, in SOL; its direction from where
// the market cap was when it was made. → the order, or null when it's no good
export function makeLimit({ coin, side, mc, sol = null, frac = null, mcNow }) {
  if (!Number.isInteger(coin) || (side !== 'buy' && side !== 'sell') || !(mc > 0) || !(mcNow > 0)) return null;
  if (side === 'buy' && !(sol > 0)) return null;
  if (side === 'sell' && !(frac > 0 && frac <= 1)) return null;
  return { coin, side, mc, dir: mc < mcNow ? 'down' : 'up', sol: side === 'buy' ? sol : null, frac: side === 'sell' ? frac : null };
}
export const limitHit = (o, mcNow) => Boolean(o) && fin(mcNow) && (o.dir === 'down' ? mcNow <= o.mc : mcNow >= o.mc);
// what a limit order is called: its side and direction
export const limitName = (o) => (o.side === 'buy' ? (o.dir === 'down' ? 'Buy the dip' : 'Buy the breakout')
  : o.dir === 'up' ? 'Take profit' : 'Stop loss');

// Auto (take profit and stop loss on a position): `tp` and `sl` as returns on its average entry (+1 = up 100%, −0.5 =
// down half), each selling `frac` of it once. → 'tp', 'sl' or null
export function autoHit(a, mcNow, entryMc) {
  if (!a || !fin(mcNow) || !(entryMc > 0)) return null;
  const r = mcNow / entryMc - 1;
  if (a.tp && !a.tp.done && fin(a.tp.at) && r >= a.tp.at) return 'tp';
  if (a.sl && !a.sl.done && fin(a.sl.at) && r <= a.sl.at) return 'sl';
  return null;
}
// a position's average entry as a market cap (SOL): what its tokens cost, a token, times the supply
export const entryMcOf = (pos) => (pos && pos.tokens > 0 && pos.cost > 0 ? (pos.cost / pos.tokens) * SUPPLY : null);

// ---------- the PnL card's numbers ----------
// a position's (positions()[i]) or a run's: invested, sold or got back, profit, and its return
export function pnlOf(pos) {
  if (!pos) return null;
  const invested = fin(pos.invested) ? pos.invested : 0;
  const sold = (fin(pos.sold) ? pos.sold : 0) + (fin(pos.value) ? pos.value : 0);
  const profit = fin(pos.total) ? pos.total : sold - invested;
  return { invested, sold, profit, pct: invested > 0 ? profit / invested : 0 };
}
