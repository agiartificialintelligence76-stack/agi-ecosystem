// TRENCHING SIMULATOR's Live mode (2026-10-21, #404, the owner's): real new coins, with their real names and pictures,
// traded with play money only. Its chains, the money each terminal shows in it, its words, the relay's address, and what
// the relay sends (checked, never trusted) made into the game's market: SOL, a billion tokens a coin (./engine.js).
// Pure: read in Node too (tests/trench-live.test.js).
//
// Never a link or a button to buy a real coin; AGI-1's own lines never name one (./lines.js: LIVE_LINES); the safety note
// stays. Live mode is never the daily market (the same coins for everyone that day) and never a challenge that ends on a
// rug (a real coin is never called one here).

export const RELAY_URL = 'wss://live.agi1.app/ws';

const C = (o) => Object.freeze(o);
// `src`: the launchpad its coins come from (named only as a real coin's source); `allFrom`: every coin on it comes from
// there (a run's line names it then); `coin`: the chain's own money. Robinhood Chain (since 2026-10-21, the owner's "Add
// DexScreener coins"): clank.trade's coins, and coins from other launchpads once their makers list them on DexScreener
// (those name no launchpad: "on Robinhood Chain")
// (2026-10-22, the owner: "i just checked there are other chains on gmgn right add that also"): GMGN's Ethereum, Monad,
// HyperEVM, Arbitrum and Tron, their listed coins like BNB Chain's and Base's (the relay's DexScreener, no new key), each
// in its own money (ETH, MON, HYPE, TRX)
export const CHAINS = Object.freeze([
  C({ id: 'solana', name: 'Solana', coin: 'sol', src: 'pump.fun', allFrom: true, what: 'every new pump.fun coin as it launches' }),
  C({ id: 'robinhood', name: 'Robinhood Chain', coin: 'eth', src: 'clank.trade', allFrom: false,
    what: 'every new clank.trade coin as it launches, and others as they get listed' }),
  C({ id: 'bnb', name: 'BNB Chain', coin: 'bnb', src: null, allFrom: false, what: 'new coins as they get listed' }),
  C({ id: 'base', name: 'Base', coin: 'eth', src: null, allFrom: false, what: 'new coins as they get listed' }),
  C({ id: 'ethereum', name: 'Ethereum', coin: 'eth', src: null, allFrom: false, what: 'new coins as they get listed' }),
  C({ id: 'monad', name: 'Monad', coin: 'mon', src: null, allFrom: false, what: 'new coins as they get listed' }),
  C({ id: 'hyperevm', name: 'HyperEVM', coin: 'hype', src: null, allFrom: false, what: 'new coins as they get listed' }),
  C({ id: 'arbitrum', name: 'Arbitrum', coin: 'eth', src: null, allFrom: false, what: 'new coins as they get listed' }),
  C({ id: 'tron', name: 'Tron', coin: 'trx', src: null, allFrom: false, what: 'new coins as they get listed' }),
]);
export const CHAIN_IDS = Object.freeze(CHAINS.map((c) => c.id));
export const DEFAULT_CHAIN = 'solana';
const BY_ID = new Map(CHAINS.map((c) => [c.id, c]));
export const chainById = (id) => BY_ID.get(id) || null;

// The money each terminal shows its play money in, in Live mode (the owner's, 2026-10-21): Pomp.fun and GNGM the
// chain's own coin (SOL on Solana, ETH on Robinhood Chain, Base, Ethereum and Arbitrum, BNB on BNB Chain, MON on Monad,
// HYPE on HyperEVM, TRX on Tron: Pomp.fun's since the owner's "Each chain's money", the same day; SOL on every chain
// before), BasedBott ETH, Phomo dollars, Axium SOL (the money its real counterpart trades in). The game counts in SOL
// underneath (./engine.js); a terminal shows it in its own, at the run's prices.
export const UNIT_NAMES = Object.freeze({ sol: 'SOL', eth: 'ETH', bnb: 'BNB', mon: 'MON', hype: 'HYPE', trx: 'TRX', usd: 'dollars' });
export function liveCurrency(terminalId, chainId) {
  const ch = chainById(chainId) || chainById(DEFAULT_CHAIN);
  switch (terminalId) {
    case 'board':
    case 'scan':
      return ch.coin;
    case 'chat':
      return 'eth';
    case 'social':
    case 'clank':
      return 'usd';
    case 'pro':
    default:
      return 'sol';
  }
}
// The money a live run shows, for ./format.js (`px`: the relay's dollar prices, { sol, eth, bnb, mon, hype, trx }): 'sol', 'usd', or a
// chain's coin with its price frozen for the run ({ coin: 'eth', usd: 2612.5 }: to the cent; a coin under a dollar, MON's
// two cents say, to 4 significant figures); null while that price isn't known yet, so a live run never silently
// starts in another chain's money
export function liveMoney(terminalId, chainId, px) {
  const unit = liveCurrency(terminalId, chainId);
  if (unit === 'sol' || unit === 'usd') return unit;
  const p = px && typeof px === 'object' ? Number(px[unit]) : NaN;
  if (!Number.isFinite(p) || !(p > 0)) return null;
  return { coin: unit, usd: p >= 1 ? Math.round(p * 100) / 100 : Number(p.toPrecision(4)) };
}
// an amount of SOL in another unit at the run's own prices ({ sol, eth, bnb }: dollars), or NaN
export function toUnit(solAmount, unit, px) {
  const p = px || {};
  if (!Number.isFinite(solAmount) || !(p.sol > 0)) return NaN;
  if (unit === 'sol') return solAmount;
  if (unit === 'usd') return solAmount * p.sol;
  return p[unit] > 0 ? (solAmount * p.sol) / p[unit] : NaN;
}

// A quiet chain (the relay's word: no new coin for a while, 45 minutes on Robinhood Chain) with at least REAL_ENOUGH real
// coins followed live plays them alone, like a live one (the owner, 2026-10-21: "on the live mode on robinhood chain use
// real coins not fake ones"); with fewer (BNB Chain's or Base's few listed coins, say), made-up stand-ins still fill in.
export const REAL_ENOUGH = 8;
// the chain's state as the game plays it (`liveCoins`: its real coins followed live right now)
export function playState(chainState, liveCoins) {
  return chainState === 'quiet' && Number.isFinite(liveCoins) && liveCoins >= REAL_ENOUGH ? 'live' : chainState;
}

// Live mode and the challenges: the daily market is always made-up (the same coins for everyone that day), and so is a
// challenge that ends on a rug (rug dodger): a real coin is never called a rug here
export const liveOk = (ch) => Boolean(ch) && !ch.daily && Boolean(ch.goal) && ch.goal.kind !== 'survive';

// ---------- the relay's address ----------

const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

// The relay: wss://live.agi1.app/ws. Only when the page itself is on this computer (localhost: Vite's preview or dev
// server) may `?relay=` point it at a relay that's on this computer too (a test's): never on the site, never anywhere else.
export function relayUrl(loc) {
  try {
    const host = loc && typeof loc.hostname === 'string' ? loc.hostname : '';
    if (!LOCAL.has(host)) return RELAY_URL;
    const want = new URLSearchParams(String((loc && loc.search) || '')).get('relay');
    if (!want) return RELAY_URL;
    const u = new URL(want);
    if (!['ws:', 'wss:'].includes(u.protocol) || !LOCAL.has(u.hostname) || u.username || u.password) return RELAY_URL;
    return u.href;
  } catch {
    return RELAY_URL;
  }
}

// Live mode on the site: open since 2026-10-21, when its relay first ran on the owner's server (`relay.sh check` all ok).
// Until then it said "Coming soon" (the owner's choice, like the four terminals not built yet). LIVE_OPEN = false closes
// it again in one small push: the Live coins choice says Soon and can't be picked, and no WebSocket is opened. On this
// computer, with a relay of its own (`?relay=` above), it's always open, so the tests can use it.
export const LIVE_OPEN = true;
export function liveOpen(loc) {
  return LIVE_OPEN || relayUrl(loc) !== RELAY_URL;
}
// a picture's address at the relay (its path from the relay: /p/<hash>.webp), or null
const PIC_PATH = /^\/p\/[A-Za-z0-9_-]{22}\.webp$/;
export function picUrl(relay, path) {
  if (typeof path !== 'string' || !PIC_PATH.test(path)) return null;
  try {
    const u = new URL(relay);
    const scheme = u.protocol === 'wss:' ? 'https:' : u.protocol === 'ws:' ? 'http:' : null;
    return scheme ? `${scheme}//${u.host}${path}` : null;
  } catch {
    return null;
  }
}

// ---------- its words ----------

export const LIVE_NOTE = 'Live mode shows real new coins, with the names and pictures their makers gave them. You trade them with play money: nothing is bought or sold for real, and nothing leaves this page. Not financial advice.';
export const LIVE_SHORT = 'Real coins · play money only';
// while Live mode is closed (LIVE_OPEN false, as it was until 2026-10-21): its Market switch's line, and How to play's
export const LIVE_SOON = 'Live coins are coming soon: real new coins as they launch, with the names and pictures their makers gave them, traded with play money only. Until then, every coin here is made up.';
export const LIVE_SOON_HOW = 'Live mode is coming soon: real new coins on Solana, Robinhood Chain, BNB Chain, Base, Ethereum, Monad, HyperEVM, Arbitrum or Tron, with their makers\' names and pictures, traded with play money only.';

// What the feed's state means, in plain words: { tone: 'live' | 'wait' | 'off', text }. `feed`: the connection
// ('connecting' | 'live' | 'down' | 'full'); `chain`: the relay's word for the chain ('live' | 'quiet' | 'down' | 'off');
// `when`: 'before' a run (the modes screen) or in 'run'.
export function feedWords(feed, chainState, chainId, when = 'run') {
  const ch = chainById(chainId) || chainById(DEFAULT_CHAIN);
  const run = when === 'run';
  if (feed === 'connecting' || feed === 'idle') return { tone: 'wait', text: 'Connecting to the live feed…' };
  if (feed === 'full') {
    return { tone: 'off', text: run ? 'The live feed is full right now. You\'re trading simulated coins until there\'s room.'
      : 'The live feed is full right now: a run would use simulated coins until there\'s room.' };
  }
  if (feed !== 'live') {
    return { tone: 'off', text: run ? 'The live feed isn\'t reachable right now. You\'re trading simulated coins until it\'s back.'
      : 'The live feed isn\'t reachable right now: a run would use simulated coins until it\'s back.' };
  }
  if (chainState === 'live') {
    return { tone: 'live', text: `Live: ${ch.what} on ${ch.name}, traded with play money.` };
  }
  if (chainState === 'quiet') {
    return { tone: 'wait', text: `${ch.name} is quiet: no new coins for a while. Simulated coins fill in until real ones arrive.` };
  }
  return { tone: 'off', text: run ? `${ch.name} isn't on the live feed right now. You're trading simulated coins.`
    : `${ch.name} isn't on the live feed right now: a run would use simulated coins.` };
}

// ---------- what the relay sends, checked ----------

// (the relay's own letters for each chain: its hub.mjs ID, since 2026-10-22 with Ethereum's e, Monad's m, HyperEVM's h,
// Arbitrum's f and Tron's t)
const ID = /^[srbaemhft][0-9]{1,9}$/;
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM = /^0x[0-9a-f]{40}$/;
const TRON = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
// control characters, direction changers and invisible fillers out (joiners and variation selectors stay: emoji)
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f\u061c\u115f\u1160\u180e\u200b\u200e\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\u3164\ufeff\uffa0\ufff9-\ufffb]/g;

// a name as its maker wrote it, safe to show as text (never a word filter: the owner's call), at most `max` characters
export function cleanText(raw, max) {
  if (typeof raw !== 'string' || raw.length > 2000) return null;
  let s = raw.normalize('NFC').replace(/[\t\n\r\v\f\u2028\u2029]/g, ' ').replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  const chars = [...s];
  if (chars.length > max) s = `${chars.slice(0, max - 1).join('').trimEnd()}…`;
  return s;
}

// a market from the wire: ['c', vs, vt, rt, rs, done] · ['p', ls, lb] · ['u', mu, lu, pg, gr, cl] → { k, … } or null
export function parseState(a) {
  if (!Array.isArray(a) || a.length > 12) return null;
  const n = (i) => (fin(a[i]) ? a[i] : NaN);
  if (a[0] === 'c') {
    const st = { k: 'c', vs: n(1), vt: n(2), rt: n(3), rs: n(4), done: a[5] === 1 };
    return st.vs > 0 && st.vt > 0 && st.rt >= 0 && st.rt <= st.vt && st.rs >= 0 && st.vs < 1e6 && st.vt < 1e13 ? st : null;
  }
  if (a[0] === 'p') {
    const st = { k: 'p', ls: n(1), lb: n(2) };
    return st.ls > 0 && st.lb > 0 && st.ls < 1e8 && st.lb < 1e14 ? st : null;
  }
  if (a[0] === 'u') {
    const mu = n(1);
    if (!(mu > 0) || mu > 1e13) return null;
    const lu = n(2);
    const pg = n(3);
    return { k: 'u', mu, lu: lu > 0 ? lu : null, pg: pg >= 0 && pg <= 1 ? pg : null, gr: a[4] === 1, cl: a[5] === 1 };
  }
  return null;
}

// a source's own numbers from the wire: [vol5m $, buys5m, sells5m, vol1h $, txns1h, vol24h $, txns24h, change5m %,
// change1h %] (unknown: -1) → in SOL (÷ SOL's price) and fractions, or null
export function parseDx(a, solUsd) {
  if (!Array.isArray(a) || a.length !== 9 || !(solUsd > 0)) return null;
  const v = (i) => (fin(a[i]) && a[i] >= 0 ? a[i] : null);
  const usd = (i) => (v(i) === null ? null : v(i) / solUsd);
  const pc = (i) => (fin(a[i]) && a[i] >= -100 && a[i] < 1e7 ? a[i] / 100 : null);
  return { v5: usd(0), b5: v(1), s5: v(2), v1h: usd(3), t1h: v(4), v24: usd(5), t24: v(6), c5: pc(7), c1h: pc(8) };
}

// a coin from the wire for `chainId` → { id, key, name, ticker, pic, born (ms), by, src, soc, sup, st, st0, tracked }
// or null (anything odd)
export function parseCoin(o, chainId) {
  if (!o || typeof o !== 'object' || typeof o.id !== 'string' || !ID.test(o.id)) return null;
  // (Solana's and Tron's addresses as they are: case-sensitive; the EVM chains' lower-cased)
  const key = typeof o.m !== 'string' ? null : chainId === 'solana' ? (B58.test(o.m) ? o.m : null)
    : chainId === 'tron' ? (TRON.test(o.m) ? o.m : null) : (EVM.test(o.m.toLowerCase()) ? o.m.toLowerCase() : null);
  const name = cleanText(o.n, 48);
  const ticker = cleanText(typeof o.s === 'string' ? o.s.replace(/^\$+/, '') : o.s, 16);
  const st = parseState(o.st);
  if (!key || !name || !ticker || !st) return null;
  const born = fin(o.b) && o.b > 1e12 && o.b < 1e13 ? o.b : null;
  const ch = chainById(chainId);
  return {
    id: o.id, key, name, ticker, pic: typeof o.p === 'string' && PIC_PATH.test(o.p) ? o.p : null, born,
    by: typeof o.by === 'string' && o.by.length <= 64 && /^[0-9A-Za-z]+$/.test(o.by) ? o.by : null,
    // its source: only the chain's own launchpad (or four.meme on BNB Chain), never whatever the wire says
    src: o.src === (ch && ch.src) || (chainId === 'bnb' && o.src === 'four.meme') ? o.src : null,
    soc: fin(o.soc) ? o.soc & 7 : 0, sup: fin(o.sup) && o.sup > 0 && o.sup < 1e15 ? o.sup : 1e9, st,
    st0: o.st0 ? parseState(o.st0) : null, tracked: o.tr === 1,
    ...(Array.isArray(o.dx) && o.dx.length === 9 ? { dx: o.dx } : {}),
  };
}
export const socialsOf = (soc) => ({ x: Boolean(soc & 1), tg: Boolean(soc & 2), web: Boolean(soc & 4) });

// one message from the relay (its text) → { t, … } with only what's understood, or null (a source's own numbers stay as
// they came, checked by parseDx when they're used: they need the run's SOL price)
export function parseMessage(text, chainId) {
  if (typeof text !== 'string' || text.length > 2_000_000) return null;
  let m;
  try {
    m = JSON.parse(text);
  } catch {
    return null;
  }
  if (!m || typeof m !== 'object' || typeof m.t !== 'string') return null;
  const states = (x) => {
    const out = {};
    if (!x || typeof x !== 'object') return out;
    for (const id of CHAIN_IDS) {
      const s = x[id];
      if (s && typeof s === 'object' && ['live', 'quiet', 'down', 'off'].includes(s.s)) out[id] = { s: s.s, n: fin(s.n) ? s.n : 0 };
    }
    return out;
  };
  const px = (x) => {
    const out = {};
    for (const k of ['sol', 'eth', 'bnb', 'mon', 'hype', 'trx']) if (x && fin(x[k]) && x[k] > 0 && x[k] < 1e7) out[k] = x[k];
    return out;
  };
  switch (m.t) {
    case 'hi':
      return { t: 'hi', ch: states(m.ch), px: px(m.px) };
    case 'st':
      return { t: 'st', ch: states(m.ch) };
    case 'px':
      return { t: 'px', px: px(m) };
    case 'snap':
      if (m.chain !== chainId || !Array.isArray(m.coins)) return null;
      return { t: 'snap', coins: m.coins.slice(0, 200).map((c) => parseCoin(c, chainId)).filter(Boolean) };
    case 'c': {
      const c = parseCoin(m.c, chainId);
      return c ? { t: 'c', coin: c } : null;
    }
    case 'u':
      if (!Array.isArray(m.u)) return null;
      return { t: 'u', u: m.u.slice(0, 2000).map((x) => (Array.isArray(x) && typeof x[0] === 'string' && ID.test(x[0])
        ? { id: x[0], st: parseState(x[1]), dx: Array.isArray(x[2]) && x[2].length === 9 ? x[2] : null } : null))
        .filter((x) => x && x.st) };
    case 'off':
      return Array.isArray(m.ids) ? { t: 'off', ids: m.ids.filter((x) => typeof x === 'string' && ID.test(x)).slice(0, 2000) } : null;
    case 'pic':
      return typeof m.id === 'string' && ID.test(m.id) && typeof m.p === 'string' && PIC_PATH.test(m.p)
        ? { t: 'pic', id: m.id, p: m.p, soc: fin(m.soc) ? m.soc & 7 : null } : null;
    case 'h':
      if (typeof m.id !== 'string' || !ID.test(m.id) || !Array.isArray(m.h)) return null;
      return { t: 'h', id: m.id, h: m.h.slice(-400).map((x) => (Array.isArray(x) && fin(x[0]) ? { at: x[0], st: parseState(x[1]) } : null))
        .filter((x) => x && x.st) };
    case 'lookup': {
      if (m.chain !== chainId || !chainById(chainId) || !['found', 'missing', 'busy', 'unavailable'].includes(m.status)) return null;
      const key = typeof m.key !== 'string' ? null : chainId === 'solana' ? (B58.test(m.key) ? m.key : null)
        : chainId === 'tron' ? (TRON.test(m.key) ? m.key : null) : (EVM.test(m.key.toLowerCase()) ? m.key.toLowerCase() : null);
      return key ? { t: 'lookup', key, status: m.status } : null;
    }
    default:
      return null;
  }
}

// ---------- the relay's markets in the game's units ----------

// pump.fun's standard curve: 793,100,000 of a billion tokens for sale on it
const CURVE_FOR_SALE = 793_100_000;
const FEE_CURVE = 0.01;
const FEE_POOL = 0.003;

// A market from the relay → the engine's (SOL, a billion tokens a coin; a coin with another supply is counted as if it
// had a billion: its market cap and shares the same, its token counts scaled): { phase ('curve' | 'migrating' |
// 'pool'), sol, tok (its reserves: a live curve's virtual ones), cap (tokens a live curve still sells), progress,
// realSol, liq (SOL, both sides), fee, exact (trades can be told from one state to the next), exactPool, estimated
// (its depth is a guess: no liquidity known) } or null. A dollar-priced coin needs SOL's price (`solUsd`).
export function toReal(st, { sup = 1e9, solUsd = NaN } = {}) {
  if (!st) return null;
  const scale = 1e9 / (sup > 0 ? sup : 1e9);
  if (st.k === 'c') {
    const forSale = CURVE_FOR_SALE / scale;
    return { phase: st.done ? 'migrating' : 'curve', sol: st.vs, tok: st.vt * scale, cap: st.rt * scale,
      progress: Math.min(1, Math.max(0, 1 - st.rt / forSale)), realSol: st.rs, liq: st.rs, fee: FEE_CURVE, exact: true,
      exactPool: false, estimated: false };
  }
  if (st.k === 'p') {
    return { phase: 'pool', sol: st.ls, tok: st.lb * scale, cap: null, progress: 1, realSol: null, liq: 2 * st.ls, fee: FEE_POOL,
      exact: false, exactPool: true, estimated: false };
  }
  if (st.k === 'u') {
    if (!(solUsd > 0)) return null;
    const mcSol = st.mu / solUsd;
    const price = mcSol / 1e9;
    // its depth: half its liquidity on the SOL side; when unknown, a guess from its market cap (a curve's is deep for its
    // size, a pool's less so)
    const side = st.lu ? st.lu / 2 / solUsd : mcSol * (st.gr ? 0.25 : 0.4);
    if (!(price > 0) || !(side > 0)) return null;
    return { phase: st.cl ? 'migrating' : st.gr ? 'pool' : 'curve', sol: side, tok: side / price, cap: null,
      progress: st.gr ? 1 : st.pg, realSol: null, liq: st.lu ? st.lu / solUsd : null, fee: st.gr ? FEE_POOL : FEE_CURVE,
      exact: false, exactPool: false, estimated: !st.lu };
  }
  return null;
}
