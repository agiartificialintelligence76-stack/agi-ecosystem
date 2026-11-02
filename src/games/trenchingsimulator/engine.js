// TRENCHING SIMULATOR's market (2026-10-20): the engine that makes the game's made-up trenches. Coins launch on a
// bonding curve (./curve.js), each with a fate decided at launch (./fates.js) and a name from ./names.js; the other
// traders (devs, bundles, snipers, insiders, callers and their followers, smart wallets, whales and the crowd) buy and
// sell so each coin's market cap follows its plan, with noise; a coin that sells out its curve migrates to its pool.
// The player's orders land after a short delay (their priority), pay the terminal's fee, the market's fee and the
// network's, and fail when the price moved past their slippage (and, if switched on, get sandwiched by a bot).
//
// Deterministic and pure: no Date, no Math.random, no DOM. A market is its seed and the list of the player's orders
// (each with the step it was placed at): the same seed and the same orders make the same market, in a browser or in
// Node (replay()). Each kind of randomness has its own stream (launches, the world, the player, and per coin its name,
// its plan, its trades and its chat), so one coin's trades never change another's. Time moves in steps of 0.1 s, and a
// step is the unit: advancing 10 s at once or a step at a time is the same market. Reading (stats, lists, holders…)
// never changes the market or draws a number (it may keep a cache).
//
// Money is SOL; times are seconds from the run's start (the warm-up before it is negative time, so the trenches are
// already busy when the player arrives). Market caps are in SOL (× solUsd for dollars).
//
// Live mode accepts real identities through market.ext. Its explicit `practice` option seeds a separate local pool:
// simulated crowd trades and player orders move it together, while later source prices cannot replace its history.
// Source launch status and artwork remain metadata; unknown holders, security information and wallets stay unknown.
// The lower-level non-practice API can also follow source reserves/history. Live adapters keep fictional launches
// disabled and display only imported real coins, including during feed gaps. Without `live`, nothing here changes.
import { makeRng, seedOf, hash32 } from './rng.js';
import { SUPPLY, RESERVED, FLOOR_TOK, K, START_MC, FEES, newCurve, newPool, buy, sell, buyQuote, sellQuote, mOf, mcOf,
  priceOf, curveProgress, curveSol } from './curve.js';
import { makePlan, fateOdds, smartHistory, PAST_GRAD } from './fates.js';
import { THEME_IDS, METAS, makeName, makeCopy, makeLine, makeMint, makeUser, KOLS, SMART_COUNT, smartAddress, COMMENTS,
  isB58 } from './names.js';

// ---------- its settings ----------

export const STEPS_PER_S = 10;
export const DT = 1 / STEPS_PER_S;
export const BASE_FEE = 0.000005; // the network's own fee for a transaction, in SOL
export const MIN_BUY = 0.001; // the smallest buy, in SOL
export const LAUNCH_PAIRS = Object.freeze(['ETH', 'AMC', 'RDDT', 'SPCX', 'TTWO', 'PLTR', 'AAPL', 'META', 'HIMS', 'NVDA']);
export const MAX_PRACTICE_LAUNCHES = 20;
const launchText = (v, cap) => typeof v === 'string'
  ? v.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, cap) : '';
export function cleanLaunch(input) {
  if (!input || typeof input !== 'object') return null;
  const name = launchText(input.name, 50);
  const ticker = launchText(input.ticker, 12).toUpperCase();
  const pair = input.pair || 'ETH';
  if (!name || !/^[A-Z0-9]{1,12}$/.test(ticker) || !LAUNCH_PAIRS.includes(pair)) return null;
  return { name, ticker, pair, emoji: launchText(input.emoji, 12) || '🪙', line: launchText(input.line, 280) };
}
// How fast an order lands and what it costs (a priority fee): its delay is drawn between lo and hi seconds
export const PRIORITY = Object.freeze({
  fast: Object.freeze({ fee: 0.001, lo: 0.35, hi: 0.9 }),
  turbo: Object.freeze({ fee: 0.005, lo: 0.18, hi: 0.45 }),
  ultra: Object.freeze({ fee: 0.01, lo: 0.06, hi: 0.2 }),
});
export const DEFAULTS = Object.freeze({ launchesPerMin: 7, warmup: 600, terminalFee: 0.01, slippage: 0.2, priority: 'fast',
  mev: false });
// How much of each list is kept (they're trimmed when they grow 64 past it)
export const KEEP = Object.freeze({ trades: 120, tape: 400, feed: 300, candles: 4000, chat: 30, orders: 300, equity: 7200 });
export const MAX_STEPS = 36000; // the most steps one advance() takes (an hour)
export const FIRST_BUYERS = 70; // a coin's first buyers kept (GNGM's grid of them)

// a plan's tags → the label its wallet shows
const LABEL = { dev: 'dev', bundle: 'bundler', sniper: 'sniper', insider: 'insider', kol: 'kol', smart: 'smart',
  whale: 'whale', follower: 'regular' };
// the wallets the crowd's sells come from (the others sell on their plan's schedule)
const SELLERS = new Set(['regular', 'sniper']);
// how much of a plan seller's dump the crowd believes (see execPlan)
export const INFORMED = 0.75;
// the trenches' mood ("heat"): a slow random walk, its spread 0.3, about two minutes to forget
const HEAT_A = Math.exp(-1 / 120);
const HEAT_S = 0.3 * Math.sqrt(1 - Math.exp(-2 / 120));
const KOL_INDEX = new Map(KOLS.map((k, i) => [k.id, i]));
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const smooth = (x) => x * x * (3 - 2 * x);
const trim = (a, keep) => {
  if (a.length > keep + 64) a.splice(0, a.length - keep);
};
const byTime = (a, b) => a.t - b.t || a.k - b.k;
const cloneMk = (mk) => ({ phase: mk.phase, curve: { left: mk.curve.left },
  pool: mk.pool ? { sol: mk.pool.sol, tok: mk.pool.tok } : null });
const intOr = (v, d) => {
  const x = Math.floor(Number(v));
  return Number.isFinite(x) ? x : d;
};

// A wallet address (44 base58 characters) made from a 32-bit number: the same number, the same address
export function addressFrom(h) {
  let x = h >>> 0;
  let s = '';
  for (let i = 0; i < 44; i++) {
    x = (Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) + i) >>> 0;
    s += B58[x % 58];
  }
  return s;
}

// A market's settings, each checked and kept inside its limits (anything else: its default)
export function normalizeConfig(config) {
  const c = { ...DEFAULTS, ...(config && typeof config === 'object' ? config : {}) };
  const num = (v, d, lo, hi) => {
    if (v == null) return d;
    const x = Number(v);
    return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d;
  };
  return {
    launchesPerMin: num(c.launchesPerMin, DEFAULTS.launchesPerMin, 0.5, 30),
    warmup: Math.round(num(c.warmup, DEFAULTS.warmup, 0, 3600)),
    terminalFee: num(c.terminalFee, DEFAULTS.terminalFee, 0, 0.05),
    slippage: num(c.slippage, DEFAULTS.slippage, 0.005, 1),
    priority: typeof c.priority === 'string' && own(PRIORITY, c.priority) ? c.priority : DEFAULTS.priority,
    mev: c.mev === true,
  };
}

// ---------- a market ----------

export function createMarket({ seed = 'trench', solUsd = 150, startSol = 1, config = {}, live = false, allowLivePracticeLaunch = false } = {}) {
  const cfg = normalizeConfig(config);
  const seedStr = String(seed);
  const su = Number(solUsd);
  const usd = Number.isFinite(su) && su > 0 ? su : 150;
  const ss = Number(startSol);
  const start = Number.isFinite(ss) && ss > 0 ? Math.min(ss, 1e6) : 1;
  const tf = cfg.terminalFee;
  const n0 = cfg.warmup * STEPS_PER_S; // the step the player arrives at (t = 0)
  const tOf = (n) => (n - n0) / STEPS_PER_S;

  // its streams of randomness: launches, the world (its mood, its meta), the player (their orders' delays)
  const lr = makeRng(seedOf(seedStr, 'launch'));
  const wr = makeRng(seedOf(seedStr, 'world'));
  const pr = makeRng(seedOf(seedStr, 'player'));

  const heat0 = wr.normal() * 0.3;
  const meta0 = wr.pick(METAS);
  const metaUntil0 = tOf(0) + wr.range(180, 360);
  // each smart wallet's quality on this run (0…1: how often it's on a coin that runs), from its own stream
  const smartQ = Object.freeze(Array.from({ length: SMART_COUNT }, (_, k) => makeRng(seedOf(seedStr, 'smart', k)).f()));
  // and its last 7 days before the run (the board's record from the start), drawn from that quality
  const smartD7 = Object.freeze(smartQ.map((q, k) => Object.freeze(smartHistory(makeRng(seedOf(seedStr, 'smart7', k)), q))));
  const M = {
    n: 0, coins: [], awake: [], byMint: new Map(), famous: [], heat: heat0, meta: meta0, metaUntil: metaUntil0,
    koth: null, kothAt: null, tape: [], feed: [], fseq: 0, oseq: 0, counts: { launched: 0, migrated: 0, rugged: 0 },
    meAddr: addressFrom(hash32(`${seedStr}␟me`)), lc: null, practiceLaunches: 0,
    // Live mode: real coins (ext), which kinds the lists show, and the made-up ones paused
    live: Boolean(live), ext: [], showSim: true, showExt: true, simPaused: false, extSeq: 0,
    // each smart wallet's record: its buys and sells, the SOL in and out, its closed positions won and lost, the
    // coins it holds now
    smart: Array.from({ length: SMART_COUNT }, () => ({ buys: 0, sells: 0, in: 0, out: 0, won: 0, lost: 0, pnl: 0,
      open: new Set(), last: null })),
  };
  const P = {
    sol: start, held: 0, pos: new Map(), open: new Set(), pending: new Map(), orders: [], log: [], equity: [],
    fees: { terminal: 0, market: 0, priority: 0, failed: 0, mev: 0 },
  };
  const canLaunchPractice = !M.live || allowLivePracticeLaunch === true;
  const localPractice = (c) => M.live && canLaunchPractice && c.createdByPlayer === true;

  // ---------- the feed and the chat ----------

  function pushFeed(kind, c, t, extra) {
    M.feed.push({ q: ++M.fseq, t, kind, c: c ? c.id : null, ...extra });
    trim(M.feed, KEEP.feed);
  }

  // what its thread talks about now
  function chatKind(c) {
    const cr = c.cr;
    if (c.rugged !== null && c.cto === null) return 'dead';
    if (c.mk.phase === 'pool') return cr.chance(0.25) ? 'migrated' : cr.chance(0.4) ? 'hot' : 'any';
    if (curveProgress(c.mk.curve) > 0.55 && cr.chance(0.5)) return 'hot';
    if ((c.tags.bundler > 2 || c.tags.sniper > 6) && cr.chance(0.2)) return 'sus';
    return 'any';
  }

  function comment(c, t, kind) {
    const u = makeUser(c.cr);
    const k = kind || chatKind(c);
    const x = c.cr.pick(COMMENTS[k]);
    c.chat.push({ t, u, x });
    trim(c.chat, KEEP.chat);
    c.replies++;
  }

  // ---------- launches ----------

  function launch(born) {
    const id = M.coins.length;
    if (M.famous.length > 50) M.famous = M.famous.filter((f) => f.at >= born - 600);
    // now and then a copy of a coin that ran in the last 10 minutes
    const cands = M.famous.filter((f) => f.at <= born && f.at >= born - 600);
    const of = cands.length && lr.chance(0.12) ? M.coins[lr.pick(cands).id] : null;
    const theme = of ? of.theme : lr.chance(0.35) ? M.meta : lr.pick(THEME_IDS);
    const idr = makeRng(seedOf(seedStr, 'coin', id));
    const ident = of ? makeCopy(idr, of) : makeName(idr, theme);
    const fate = idr.weighted(fateOdds({ hot: !of && ident.theme === M.meta, copy: !!of }));
    const plan = makePlan(makeRng(seedOf(seedStr, 'plan', id)), fate, { smart: smartQ });
    const line = makeLine(idr, ident);
    const mint = makeMint(idr);
    const devUser = makeUser(idr);
    const gp = plan.pts.find((p) => p[1] >= PAST_GRAD);
    if (gp) M.famous.push({ id, at: born + gp[0] });
    const ouA = Math.exp(-DT / plan.tau);
    const c = {
      id, born, fate, plan, theme: ident.theme, name: ident.name, ticker: ident.ticker, emoji: ident.emoji,
      // Fictional pairing metadata for the practice launchpad; no real stock quote is implied.
      pair: LAUNCH_PAIRS[hash32(`${seedStr}␟pair␟${id}`) % LAUNCH_PAIRS.length],
      copyOf: ident.copyOf ?? null, line, mint, devUser,
      mk: { phase: 'curve', curve: newCurve(), pool: null },
      holders: new Map(), hlist: [],
      // its noise (in log space), its plan read with pointers, its events and the player's orders on their way
      x: 0, ouA, ouB: plan.sigma * Math.sqrt(1 - ouA * ouA), lp: plan.pts.map((p) => Math.log(p[1])), pi: 1, ai: 1,
      ev: 0, q: [], defer: [],
      cd: [], cdTrim: false, trades: [], chat: [], calls: [],
      lastMc: START_MC, ath: START_MC, athAt: born, lastTrade: null, vol: 0, nTx: 0, replies: 0,
      socials: { ...plan.intel.socials }, rugged: null, dexPaid: null, cto: null, kothAt: null, devMax: 0,
      gradAt: null, migrateAt: null, poolAt: null,
      tags: { sniper: 0, bundler: 0, insider: 0, kol: 0, smart: 0, whale: 0 }, nNpc: 0, nF: 0, nBot: 0,
      tr: makeRng(seedOf(seedStr, 'trade', id)), cr: makeRng(seedOf(seedStr, 'chat', id)),
      asleep: false, addr: new Map(), hs: null, compacted: false,
      // its first buyers (2026-10-22, GNGM's "first 70 buyers"): who, when and how much they first got (a made-up coin's
      // only: a real coin's buyers are nobody we know)
      first: [], firstKeys: new Set(),
    };
    M.coins.push(c);
    M.awake.push(c);
    M.byMint.set(mint, id);
    M.counts.launched++;
    pushFeed('launch', c, born);
    return c;
  }

  // Practice launches use the same market mechanics as every simulated coin. The log records the complete
  // metadata before subsequent orders, so replay creates the same IDs, random streams and price paths.
  function launchCoin(input) {
    if (!canLaunchPractice) return { ok: false, error: 'free_only' };
    if (M.practiceLaunches >= MAX_PRACTICE_LAUNCHES) return { ok: false, error: 'launch_limit' };
    const data = cleanLaunch(input);
    if (!data) return { ok: false, error: 'bad_launch' };
    const c = launch(tOf(M.n));
    Object.assign(c, data, { createdByPlayer: true, devUser: 'Practice creator' });
    M.practiceLaunches++;
    M.lc = null;
    P.log.push({ kind: 'launch', n: M.n, ...data });
    return { ok: true, id: c.id, coin: info(c.id) };
  }

  // ---------- reading a coin's plan (pointers: a coin's age only grows) ----------

  // the log of its plan's market cap multiple at age a (the same as fates.js targetAt, in log space)
  function lnTarget(c, a) {
    const pts = c.plan.pts;
    const lp = c.lp;
    if (a <= pts[0][0]) return lp[0];
    let i = c.pi;
    while (i < pts.length && a > pts[i][0]) i++;
    c.pi = i;
    if (i >= pts.length) return lp[lp.length - 1];
    const t0 = pts[i - 1][0];
    const t1 = pts[i][0];
    const x = t1 > t0 ? smooth((a - t0) / (t1 - t0)) : 1;
    return lp[i - 1] + (lp[i] - lp[i - 1]) * x;
  }

  // its plan's trades a second at age a (the same as fates.js activityAt)
  function actAt(c, a) {
    const act = c.plan.act;
    if (a <= act[0][0]) return act[0][1];
    let i = c.ai;
    while (i < act.length && a > act[i][0]) i++;
    c.ai = i;
    if (i >= act.length) return act[act.length - 1][1];
    const t0 = act[i - 1][0];
    const a0 = act[i - 1][1];
    const t1 = act[i][0];
    const a1 = act[i][1];
    return t1 > t0 ? a0 + ((a1 - a0) * (a - t0)) / (t1 - t0) : a1;
  }

  // ---------- one coin's step ----------

  function simCoin(c, t0, t1, actScale) {
    const s0 = c.born > t0 ? c.born : t0;
    const span = t1 - s0;
    if (!(span > 0)) return;
    const plan = c.plan;
    const tr = c.tr;
    if (c.born <= t0) c.x = c.x * c.ouA + c.ouB * tr.normal();
    else {
      const a = Math.exp(-span / plan.tau);
      c.x = c.x * a + plan.sigma * Math.sqrt(1 - a * a) * tr.normal();
    }
    const a1 = t1 - c.born;
    const tgt = lnTarget(c, a1) + c.x;
    const lam = actAt(c, a1) * actScale;
    const acts = [];
    // its plan's events, the player's orders landing, its pool opening, and the crowd's trades, in time order
    const evs = plan.events;
    while (c.ev < evs.length && c.born + evs[c.ev].t < t1) {
      const e = evs[c.ev++];
      acts.push({ t: c.born + e.t, k: 0, e });
    }
    let nq = 0;
    while (nq < c.q.length && c.q[nq].landAt < t1) {
      acts.push({ t: c.q[nq].landAt, k: 1, o: c.q[nq] });
      nq++;
    }
    const mk = c.mk;
    if (mk.phase === 'migrating' && c.migrateAt < t1) acts.push({ t: c.migrateAt, k: 2 });
    if (lam > 0 && mk.phase !== 'migrating') {
      // busier the further it is from where its plan wants it
      const g = Math.min(Math.abs(tgt - Math.log(mOf(mk))), 3);
      const cnt = tr.poisson((lam * (1 + 1.5 * g) + 0.08 * g) * span);
      for (let i = 0; i < cnt; i++) acts.push({ t: s0 + span * tr.f(), k: 3 });
    }
    if (acts.length > 1) acts.sort(byTime);
    for (const x of acts) {
      if (x.k === 0) {
        if (c.mk.phase === 'migrating') c.defer.push(x.e);
        else execPlan(c, x.e, x.t);
      } else if (x.k === 1) land(c, x.o, x.t);
      else if (x.k === 2) openPool(c, x.t);
      else npcTrade(c, x.t, tgt);
    }
    if (nq) c.q.splice(0, nq);
  }

  // One trade from the crowd: a buy when the price is under where its plan wants it, a sell when it's over (more
  // likely the further it is), its size from the coin's size, and a little FOMO when it's far under.
  function npcTrade(c, t, tgt) {
    const mk = c.mk;
    if (mk.phase === 'migrating') return;
    const tr = c.tr;
    const m = mOf(mk);
    const gap = tgt - Math.log(m);
    const hl = c.hlist;
    if (tr.f() < 1 / (1 + Math.exp(-4 * gap))) {
      const sol = clamp(tr.logn(0.12 * Math.pow(m, 0.4), 1.1) * Math.exp(clamp(gap, 0, 1.5) * 0.6), 0.005, 40);
      let key = null;
      const L = hl.length;
      if (L > 0 && tr.chance(0.25)) {
        const h = hl[tr.int(L)];
        if (h.label === 'regular') key = h.key;
      }
      if (key === null) key = `n${c.nNpc++}`;
      applyBuy(c, key, 'regular', sol, t, null);
      return;
    }
    if (!hl.length) return;
    // a sell sized like a buy (in SOL, bigger the further it's over its plan), filled from up to four of the crowd's
    // wallets, each its own trade (a wallet holding little more than what's left sells all of it)
    const want = clamp(tr.logn(0.12 * Math.pow(m, 0.4), 1.1) * Math.exp(clamp(-gap, 0, 1.5) * 0.6), 0.005, 40);
    let left = Math.floor(want / priceOf(mk));
    for (let i = 0; i < 4 && left > 0 && hl.length > 0; i++) {
      const h = hl[tr.int(hl.length)];
      if (!SELLERS.has(h.label) || h.tok <= 0) continue;
      const r = applySell(c, h, h.tok <= left * 1.5 ? h.tok : left, t);
      if (!r) break;
      left -= r.back;
    }
  }

  // ---------- wallets, trades and candles ----------

  function holderOf(c, key, label, t) {
    const h = { key, label, tok: 0, in: 0, out: 0, at: t, i: c.hlist.length, kol: null };
    c.holders.set(key, h);
    c.hlist.push(h);
    if (own(c.tags, label)) c.tags[label]++;
    return h;
  }

  function dropHolder(c, h) {
    const L = c.hlist;
    const last = L.pop();
    if (last !== h) {
      L[h.i] = last;
      last.i = h.i;
    }
    c.holders.delete(h.key);
  }

  function applyBuy(c, key, label, sol, t, kol) {
    const r = buy(c.mk, sol);
    if (r.closed || r.out <= 0) return null;
    const isNew = !c.holders.has(key);
    const h = isNew ? holderOf(c, key, label, t) : c.holders.get(key);
    h.tok += r.out;
    h.in += r.used;
    if (kol) h.kol = kol;
    if (isNew && c.first && c.first.length < FIRST_BUYERS && !c.firstKeys.has(key)) {
      c.firstKeys.add(key);
      c.first.push({ key, label, kol: kol || null, at: t, tok0: r.out });
      if (c.first.length >= FIRST_BUYERS) c.firstKeys = null;
    }
    if (key === 'dev' && h.tok > c.devMax) c.devMax = h.tok;
    if (label === 'smart') {
      const S = M.smart[Number(key.slice(1))];
      S.buys++;
      S.in += r.used;
      S.open.add(c.id);
      S.last = t;
    }
    record(c, t, 1, r.used, r.out, h);
    if (isNew && label === 'regular' && c.cr.chance(0.05)) comment(c, t);
    if (r.full && !c.ext) startMigration(c, t);
    return r;
  }

  function applySell(c, h, tok, t) {
    const r = sell(c.mk, tok);
    if (r.closed || r.back <= 0) return null;
    h.tok -= r.back;
    h.out += r.sol;
    record(c, t, -1, r.gross, r.back, h);
    if (h.label === 'smart') {
      const S = M.smart[Number(h.key.slice(1))];
      S.sells++;
      S.out += r.sol;
      S.last = t;
      // a position closed: won or lost, on what it put in and took out of this coin
      if (h.tok <= 0) {
        S.open.delete(c.id);
        const p = h.out - h.in;
        S.pnl += p;
        if (p >= 0) S.won++;
        else S.lost++;
      }
    }
    if (h.tok <= 0) dropHolder(c, h);
    return r;
  }

  function record(c, t, side, sol, tok, h, mcGiven) {
    const mc = Number.isFinite(mcGiven) ? mcGiven : mcOf(c.mk);
    c.trades.push({ t, s: side, sol, tok, mc, k: h.key, l: h.label, kol: h.kol });
    trim(c.trades, KEEP.trades);
    M.tape.push({ t, c: c.id, s: side, sol, mc, l: h.label });
    trim(M.tape, KEEP.tape);
    // its candle (one a second: its market cap in SOL, the SOL traded, its buys and sells)
    const sec = Math.floor(t);
    const cd = c.cd;
    const last = cd.length ? cd[cd.length - 1] : null;
    if (last && last.t === sec) {
      if (mc > last.h) last.h = mc;
      if (mc < last.l) last.l = mc;
      last.c = mc;
      last.v += sol;
      if (side > 0) last.b++;
      else last.s++;
    } else {
      const o = c.lastMc;
      cd.push({ t: sec, o, h: Math.max(o, mc), l: Math.min(o, mc), c: mc, v: sol, b: side > 0 ? 1 : 0, s: side > 0 ? 0 : 1 });
      if (cd.length > KEEP.candles + 64) {
        cd.splice(0, cd.length - KEEP.candles);
        c.cdTrim = true;
      }
    }
    if (c.ext && c.ext.practice || localPractice(c)) {
      const bar = cd[cd.length - 1], key = side > 0 ? 'buyVol' : 'sellVol';
      bar[key] = (bar[key] || 0) + sol;
    }
    c.lastMc = mc;
    c.lastTrade = t;
    c.vol += sol;
    c.nTx++;
    if (mc > c.ath) {
      c.ath = mc;
      c.athAt = t;
    }
    c.compacted = false;
    if (side > 0 && sol >= 10 && h.label !== 'me' && h.label !== 'mev') pushFeed('whale_buy', c, t, { sol, l: h.label });
  }

  // ---------- migration ----------

  function startMigration(c, t) {
    c.mk.phase = 'migrating';
    c.gradAt = t;
    c.migrateAt = t + 4 + 4 * c.tr.f();
    pushFeed('migrate', c, t);
  }

  function openPool(c, t) {
    c.mk.phase = 'pool';
    c.mk.pool = newPool();
    c.poolAt = t;
    c.migrateAt = null;
    M.counts.migrated++;
    pushFeed('migrated', c, t);
    comment(c, t, 'migrated');
    const d = c.defer;
    c.defer = [];
    for (const e of d) execPlan(c, e, t);
  }

  // ---------- a plan's events ----------

  function execPlan(c, e, t) {
    if (e.kind === 'buy') {
      const key = e.who === 'new' ? `f${c.nF++}` : e.who;
      const label = own(LABEL, e.tag) ? LABEL[e.tag] : 'regular';
      const r = applyBuy(c, key, label, e.sol, t, e.kol || null);
      if (r && e.tag === 'smart') pushFeed('smart_buy', c, t, { smart: Number(key.slice(1)), sol: r.used });
      return;
    }
    if (e.kind === 'sell') {
      const h = c.holders.get(e.who);
      if (!h || h.tok <= 0) return;
      const before = h.tok;
      const tok = e.frac >= 1 ? h.tok : Math.floor(h.tok * e.frac);
      if (tok <= 0) return;
      const m0 = Math.log(mOf(c.mk));
      const r = applySell(c, h, tok, t);
      if (!r) return;
      // the crowd reads a dump by someone who knows (a dev, a whale, a caller…): three quarters of the drop stays,
      // fading with the coin's own noise, so a dump isn't bought straight back up (at 0, 2026-10-20's check: 56 of 84
      // big dumps came back 80% within 15 s; at 0.75, 15 of 91)
      c.x += INFORMED * (Math.log(mOf(c.mk)) - m0);
      if (e.who === 'dev' && e.frac >= 0.5) {
        pushFeed('dev_sell', c, t, { frac: r.back / before, sol: r.sol });
        if (c.cr.chance(0.5)) comment(c, t, 'sus');
      }
      if (h.kol) pushFeed('kol_sell', c, t, { kol: h.kol, frac: r.back / before, sol: r.sol });
      if (h.label === 'smart') pushFeed('smart_sell', c, t, { smart: Number(h.key.slice(1)), frac: r.back / before, sol: r.sol });
      return;
    }
    flag(c, e, t);
  }

  function flag(c, e, t) {
    switch (e.what) {
      case 'kol': {
        c.calls.push({ t, kol: e.kol, who: e.who });
        const h = c.holders.get(e.who);
        pushFeed('kol_buy', c, t, { kol: e.kol, sol: h ? h.in : 0 });
        comment(c, t, 'kol');
        break;
      }
      case 'rug':
        c.rugged = t;
        M.counts.rugged++;
        pushFeed('rug', c, t);
        comment(c, t, 'dead');
        break;
      case 'dexPaid':
        c.dexPaid = t;
        pushFeed('dex_paid', c, t);
        break;
      case 'cto':
        c.cto = t;
        c.socials = { x: true, tg: true, web: true };
        pushFeed('cto', c, t);
        break;
      default:
        break;
    }
  }

  // ---------- the player's orders ----------

  // nothing trades: a made-up coin migrating, or a live coin whose curve sold out (its pool not open yet)
  const closedOf = (c) => c.mk.phase === 'migrating' || c.mk.closed === true;

  // only the player's orders land (a live coin; a made-up one while they're paused), and a made-up coin's pool opens
  function landOnly(c, t1) {
    let nq = 0;
    while (nq < c.q.length && c.q[nq].landAt < t1) {
      land(c, c.q[nq], c.q[nq].landAt);
      nq++;
    }
    if (nq) c.q.splice(0, nq);
    if (!c.ext && c.mk.phase === 'migrating' && c.migrateAt < t1) openPool(c, c.migrateAt);
  }

  // Opt-in practice on a real identity. The imported quote seeds one local pool; simulated crowd trades and
  // the player's fills subsequently share those reserves. Source refreshes never reset this practice path.
  function simExtPractice(c, t0, t1) {
    const p = c.ext.practice, tr = p.rng, span = t1 - t0;
    const a = Math.exp(-span / 45);
    p.noise = p.noise * a + .45 * Math.sqrt(1 - a * a) * tr.normal();
    const acts = [];
    let nq = 0;
    while (nq < c.q.length && c.q[nq].landAt < t1) { acts.push({ t: c.q[nq].landAt, k: 1, o: c.q[nq] }); nq++; }
    const count = tr.poisson(1.8 * span);
    for (let i = 0; i < count; i++) acts.push({ t: t0 + span * tr.f(), k: 3 });
    acts.sort(byTime);
    for (const act of acts) {
      if (act.o) { land(c, act.o, act.t); continue; }
      const gap = Math.log(c.mc0 / mcOf(c.mk)) + p.noise;
      const amount = c.mk.pool.sol * clamp(tr.logn(.008, .65), .001, .045);
      if (tr.f() < 1 / (1 + Math.exp(-4 * gap))) {
        const r = buy(c.mk, amount);
        if (r.out > 0) record(c, act.t, 1, r.used, r.out, PRACTICE_TRADER);
      } else {
        const tokens = Math.max(1, Math.floor(amount / priceOf(c.mk)));
        const r = sell(c.mk, tokens);
        if (r.back > 0) record(c, act.t, -1, r.gross, r.back, PRACTICE_TRADER);
      }
    }
    if (nq) c.q.splice(0, nq);
  }

  function coinOf(id) {
    const i = typeof id === 'number' ? id : typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : NaN;
    return Number.isInteger(i) && i >= 0 && i < M.coins.length ? M.coins[i] : null;
  }

  // what an order or a quote asks for, checked (nothing drawn, nothing changed)
  function checkAsk(p) {
    const a = p && typeof p === 'object' ? p : {};
    const c = coinOf(a.coin);
    if (!c) return { error: 'no_coin' };
    const side = a.side;
    if (side !== 'buy' && side !== 'sell') return { error: 'bad' };
    const priority = a.priority == null ? cfg.priority : a.priority;
    if (typeof priority !== 'string' || !own(PRIORITY, priority)) return { error: 'bad' };
    const sl = a.slippage == null ? cfg.slippage : Number(a.slippage);
    if (!Number.isFinite(sl)) return { error: 'bad' };
    if (closedOf(c)) return { error: 'migrating' };
    if (c.ext && !c.ext.live) return { error: 'stale' };
    return { a, c, side, priority, slip: clamp(sl, 0.005, 1), fee: PRIORITY[priority].fee + BASE_FEE };
  }

  function order(p) {
    const k = checkAsk(p);
    if (k.error) return { ok: false, error: k.error };
    const { a, c, side, priority, slip, fee } = k;
    let sol = 0;
    let frac = 0;
    let minRate;
    let hold;
    if (side === 'buy') {
      sol = Number(a.sol);
      if (!Number.isFinite(sol) || sol < MIN_BUY) return { ok: false, error: 'min_buy' };
      if (P.sol + 1e-12 < sol + 2 * fee) return { ok: false, error: 'not_enough_sol' };
      const q = buyQuote(c.mk, sol * (1 - tf));
      if (q.closed) return { ok: false, error: 'migrating' };
      if (!(q.out > 0)) return { ok: false, error: 'no_liquidity' };
      minRate = (q.out / q.used) * (1 - slip);
      hold = sol + fee;
    } else {
      frac = a.frac == null ? 1 : Number(a.frac);
      if (!(frac > 0 && frac <= 1)) return { ok: false, error: 'bad' };
      const pos = P.pos.get(c.id);
      const have = pos ? pos.tokens : 0;
      const tok = frac >= 1 ? have : Math.floor(have * frac);
      if (!(tok > 0)) return { ok: false, error: 'no_tokens' };
      if (P.sol + 1e-12 < fee) return { ok: false, error: 'no_sol_for_fee' };
      const q = sellQuote(c.mk, tok);
      if (q.closed) return { ok: false, error: 'migrating' };
      if (!(q.sol > 0)) return { ok: false, error: 'no_liquidity' };
      minRate = (q.sol / tok) * (1 - slip);
      hold = fee;
    }
    // when it lands (its priority's delay) and its roll for a sandwich bot: both drawn for every order, in this order
    const prio = PRIORITY[priority];
    const latency = prio.lo + (prio.hi - prio.lo) * pr.f();
    const mevRoll = pr.f();
    const t = tOf(M.n);
    const o = {
      id: ++M.oseq, n: M.n, t, coin: c.id, side, sol, frac, slippage: slip, priority, fee, hold, minRate,
      landAt: t + latency, mevRoll, status: 'pending', reason: null, tok: 0, spent: 0, got: 0, price: 0, mc: 0,
      doneAt: null, mev: null,
    };
    // into its coin's line by when it lands (after any landing at the same moment)
    const q = c.q;
    let i = q.length;
    while (i > 0 && q[i - 1].landAt > o.landAt) i--;
    q.splice(i, 0, o);
    P.sol -= hold;
    if (P.sol < 0) P.sol = 0; // a rounding speck
    P.held += hold;
    P.pending.set(o.id, o);
    P.orders.push(o);
    trim(P.orders, KEEP.orders);
    P.log.push({ n: M.n, coin: c.id, side, sol, frac, slippage: slip, priority });
    wake(c);
    return { ok: true, order: orderView(o) };
  }

  function land(c, o, t) {
    P.pending.delete(o.id);
    P.held -= o.hold;
    if (P.pending.size === 0 || P.held < 0) P.held = P.pending.size === 0 ? 0 : Math.max(0, P.held);
    P.fees.priority += o.fee;
    o.doneAt = t;
    if (closedOf(c)) return failOrder(o, 'migrating', o.side === 'buy' ? o.sol : 0);
    if (c.ext && !c.ext.live) return failOrder(o, 'stale', o.side === 'buy' ? o.sol : 0);
    if (o.side === 'buy') landBuy(c, o, t);
    else landSell(c, o, t);
  }

  function landBuy(c, o, t) {
    const net = o.sol * (1 - tf);
    let bot = null;
    const mevP = Math.min(0.5, (o.slippage - 0.15) * 1.5);
    // a bot that finds it takes part of the room the slippage leaves (40% to 90%: from the same roll, no new draw)
    if (cfg.mev && c.mk.phase === 'curve' && o.priority !== 'ultra' && o.slippage > 0.15 && o.mevRoll < mevP) {
      bot = frontRun(c, o, net, t, 0.4 + 0.5 * (o.mevRoll / mevP));
    }
    const q = buyQuote(c.mk, net);
    if (q.closed || !(q.out > 0)) {
      if (bot) backRun(c, bot, t);
      return failOrder(o, q.closed ? 'migrating' : 'no_liquidity', o.sol);
    }
    if (q.out / q.used < o.minRate) {
      if (bot) backRun(c, bot, t);
      return failOrder(o, 'slippage', o.sol);
    }
    const r = applyBuy(c, 'me', 'me', net, t, null);
    if (!r) {
      if (bot) backRun(c, bot, t);
      return failOrder(o, 'no_liquidity', o.sol);
    }
    // a buy that completed the curve only paid for what it got: the rest comes back
    const spent = Math.min(o.sol, r.used / (1 - tf));
    P.sol += o.sol - spent;
    const term = spent - r.used;
    P.fees.terminal += term;
    P.fees.market += r.fee;
    let pos = P.pos.get(c.id);
    if (!pos) {
      pos = { tokens: 0, cost: 0, invested: 0, realized: 0, sold: 0, fees: 0, buys: 0, sells: 0, first: t, last: t };
      P.pos.set(c.id, pos);
    }
    pos.tokens += r.out;
    if (c.ext) c.ext.me += r.out;
    pos.cost += spent + o.fee;
    pos.invested += spent + o.fee;
    pos.fees += term + r.fee + o.fee;
    pos.buys++;
    pos.last = t;
    P.open.add(c.id);
    o.status = 'filled';
    o.tok = r.out;
    o.spent = spent;
    o.price = r.used / r.out;
    o.mc = o.price * SUPPLY;
    if (bot) {
      backRun(c, bot, t);
      const lostTok = Math.max(0, bot.out0 - r.out);
      const lostSol = bot.out0 > 0 ? (lostTok / bot.out0) * spent : 0;
      o.mev = { sol: bot.sol, lostTok, lostSol, got: bot.got };
      P.fees.mev += lostSol;
    }
  }

  function landSell(c, o, t) {
    const pos = P.pos.get(c.id);
    const have = pos ? pos.tokens : 0;
    const tok = o.frac >= 1 ? have : Math.floor(have * o.frac);
    if (!(tok > 0)) return failOrder(o, 'no_tokens', 0);
    const q = sellQuote(c.mk, tok);
    if (q.closed) return failOrder(o, 'migrating', 0);
    if (!(q.sol > 0)) return failOrder(o, 'no_liquidity', 0);
    if (q.sol / tok < o.minRate) return failOrder(o, 'slippage', 0);
    const h = c.holders.get('me');
    const r = h ? applySell(c, h, tok, t) : null;
    if (!r) return failOrder(o, 'no_liquidity', 0);
    const got = r.sol * (1 - tf);
    const term = r.sol - got;
    P.sol += got;
    if (c.ext) c.ext.me = Math.max(0, c.ext.me - r.back);
    const basis = pos.tokens > 0 ? (pos.cost * r.back) / pos.tokens : 0;
    pos.cost -= basis;
    pos.tokens -= r.back;
    pos.realized += got - basis - o.fee;
    pos.sold += got;
    pos.fees += term + r.fee + o.fee;
    pos.sells++;
    pos.last = t;
    if (pos.tokens <= 0) {
      pos.tokens = 0;
      pos.cost = 0;
      P.open.delete(c.id);
    }
    P.fees.terminal += term;
    P.fees.market += r.fee;
    o.status = 'filled';
    o.tok = r.back;
    o.got = got;
    o.price = r.gross / r.back;
    o.mc = o.price * SUPPLY;
  }

  function failOrder(o, reason, refund) {
    o.status = 'failed';
    o.reason = reason;
    P.sol += refund;
    P.fees.failed += o.fee;
  }

  // A sandwich bot: it buys right before the player's buy, as much as still lets the player's buy through at its
  // slippage (`share` of the most it could), then sells right after it. Only on the curve, never as much as completes
  // the curve.
  function frontRun(c, o, net, t, share) {
    const v = FLOOR_TOK + c.mk.curve.left;
    const needGross = (K / FLOOR_TOK - K / v) / (1 - FEES.curve);
    const hiX = 0.9 * (needGross - net);
    if (!(hiX > 0.01)) return null;
    const target = o.minRate * 1.005;
    const rateAfter = (x) => {
      const mk = cloneMk(c.mk);
      if (x > 0) buy(mk, x);
      const q = buyQuote(mk, net);
      return q.out > 0 && !q.full ? q.out / q.used : 0;
    };
    if (rateAfter(0) < target) return null;
    let lo = 0;
    let hi = hiX;
    if (rateAfter(hi) >= target) lo = hi;
    else {
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (rateAfter(mid) >= target) lo = mid;
        else hi = mid;
      }
    }
    const x = lo * share;
    if (x < 0.01) return null;
    const q0 = buyQuote(c.mk, net);
    const key = `x${c.nBot++}`;
    const r = applyBuy(c, key, 'mev', x, t, null);
    if (!r) return null;
    return { key, sol: x, out0: q0.out, got: 0 };
  }

  function backRun(c, bot, t) {
    const h = c.holders.get(bot.key);
    const r = h && h.tok > 0 ? applySell(c, h, h.tok, t) : null;
    bot.got = r ? r.sol : 0;
  }

  // a sleeping coin comes back into the step loop (in its place by id)
  function wake(c) {
    if (!c.asleep) return;
    c.asleep = false;
    const aw = M.awake;
    let lo = 0;
    let hi = aw.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (aw[mid].id < c.id) lo = mid + 1;
      else hi = mid;
    }
    aw.splice(lo, 0, c);
  }

  // ---------- what the player has ----------

  // what selling these tokens now would bring (after the market's and the terminal's fees); a coin migrating is
  // valued at its pool's opening price
  function exitValue(c, tok) {
    return marketValue(c, tok) * (1 - tf);
  }

  // what these tokens would sell for in its market now (after the market's fee, before a terminal's)
  function marketValue(c, tok) {
    if (!(tok > 0)) return 0;
    if (c.ext && c.mk.closed) return sellQuote({ phase: 'pool', pool: c.mk.pool, fee: c.mk.fee }, tok).sol;
    if (c.mk.phase === 'migrating') return sellQuote({ phase: 'pool', curve: c.mk.curve, pool: newPool() }, tok).sol;
    return sellQuote(c.mk, tok).sol;
  }

  function netWorth() {
    let v = P.sol + P.held;
    for (const id of P.open) v += exitValue(M.coins[id], P.pos.get(id).tokens);
    return v;
  }

  function maxBuy(priority) {
    const pr2 = typeof priority === 'string' && own(PRIORITY, priority) ? priority : cfg.priority;
    return Math.max(0, P.sol - 2 * (PRIORITY[pr2].fee + BASE_FEE));
  }

  // What an order would do right now, without placing it (for the trade panel)
  function quote(p) {
    const k = checkAsk(p);
    if (k.error) return { ok: false, error: k.error };
    const { a, c, side, priority, slip, fee } = k;
    const spot = priceOf(c.mk);
    if (side === 'buy') {
      const sol = Number(a.sol);
      if (!Number.isFinite(sol) || sol < MIN_BUY) return { ok: false, error: 'min_buy' };
      const net = sol * (1 - tf);
      const q = buyQuote(c.mk, net);
      if (!(q.out > 0)) return { ok: false, error: 'no_liquidity' };
      const spent = q.full ? q.used / (1 - tf) : sol;
      const after = cloneMk(c.mk);
      buy(after, net);
      return {
        ok: true, side, sol, spent, refund: sol - spent, tokens: q.out, minTokens: Math.floor(q.out * (1 - slip)),
        avgPrice: q.used / q.out, impact: (q.used - q.fee) / q.out / spot - 1,
        fees: { terminal: spent - q.used, market: q.fee, network: fee }, mcAfter: mcOf(after), full: q.full, spot,
        slippage: slip, priority, enough: P.sol + 1e-12 >= sol + 2 * fee,
      };
    }
    let tok;
    if (a.tokens != null) {
      tok = Math.floor(Number(a.tokens));
      if (!(tok > 0)) return { ok: false, error: 'bad' };
    } else {
      const frac = a.frac == null ? 1 : Number(a.frac);
      if (!(frac > 0 && frac <= 1)) return { ok: false, error: 'bad' };
      const pos = P.pos.get(c.id);
      const have = pos ? pos.tokens : 0;
      tok = frac >= 1 ? have : Math.floor(have * frac);
      if (!(tok > 0)) return { ok: false, error: 'no_tokens' };
    }
    const q = sellQuote(c.mk, tok);
    if (!(q.sol > 0)) return { ok: false, error: 'no_liquidity' };
    const got = q.sol * (1 - tf);
    const after = cloneMk(c.mk);
    sell(after, tok);
    return {
      ok: true, side, tokens: tok, got, minGot: got * (1 - slip), avgPrice: q.gross / tok, impact: q.gross / tok / spot - 1,
      fees: { terminal: q.sol - got, market: q.fee, network: fee }, mcAfter: mcOf(after), spot, slippage: slip, priority,
      enough: P.sol + 1e-12 >= fee,
    };
  }

  // ---------- the world, each second ----------

  function step() {
    const n = M.n;
    const t0 = tOf(n);
    const t1 = tOf(n + 1);
    const k = lr.poisson((cfg.launchesPerMin / 60) * Math.exp(M.heat) * DT);
    if (k > 0 && !M.simPaused) {
      const ts = [];
      for (let i = 0; i < k; i++) ts.push(t0 + DT * lr.f());
      ts.sort((a, b) => a - b);
      for (const b of ts) launch(b);
    }
    const actScale = Math.exp(0.4 * M.heat);
    const aw = M.awake;
    let slept = false;
    for (let i = 0; i < aw.length; i++) {
      const c = aw[i];
      if (c.ext && c.ext.practice) { simExtPractice(c, t0, t1); continue; }
      if (c.ext || M.simPaused && !localPractice(c)) {
        // a live coin (and a made-up one while they're paused): only the player's orders land
        landOnly(c, t1);
        if (c.ext && !c.q.length) {
          c.asleep = true;
          slept = true;
        }
        continue;
      }
      simCoin(c, t0, t1, actScale);
      // nothing more to do: it sleeps (until the player trades it)
      if (c.mk.phase !== 'migrating' && !c.q.length && !c.defer.length && c.ev >= c.plan.events.length
        && t1 - c.born >= c.plan.dieAt) {
        c.asleep = true;
        slept = true;
      }
    }
    if (slept) M.awake = aw.filter((c) => !c.asleep);
    M.n = n + 1;
    if ((M.n - n0) % STEPS_PER_S === 0) perSecond(tOf(M.n));
  }

  function perSecond(ts) {
    M.heat = M.heat * HEAT_A + HEAT_S * wr.normal();
    if (ts >= M.metaUntil) {
      M.meta = wr.pick(METAS.filter((x) => x !== M.meta));
      M.metaUntil = ts + wr.range(180, 360);
      pushFeed('meta', null, ts, { theme: M.meta });
    }
    // the king of the hill: the coin furthest along its curve (half or more); it keeps the crown unless another is
    // more than 2 points further
    let best = null;
    let bp = 0.5;
    for (const c of kothField()) {
      if (phaseOf(c) !== 'curve') continue;
      const p = progressOf(c);
      if (p >= bp) {
        best = c;
        bp = p;
      }
    }
    const cur = M.koth !== null ? M.coins[M.koth] : null;
    const keep = cur && kothOk(cur);
    let next = keep ? cur : best;
    if (keep && best && best !== cur && bp > progressOf(cur) + 0.02) next = best;
    const nextId = next ? next.id : null;
    if (nextId !== M.koth) {
      M.koth = nextId;
      M.kothAt = next ? ts : null;
      if (next) {
        if (next.kothAt === null) next.kothAt = ts;
        pushFeed('koth', next, ts);
      }
    }
    if (ts > 0) {
      P.equity.push({ t: ts, v: netWorth() });
      trim(P.equity, KEEP.equity);
    }
    if (ts % 60 === 0) {
      for (const c of M.coins) {
        if (c.asleep && !c.compacted && c.lastTrade !== null && c.lastTrade < ts - 3700) compact(c);
      }
    }
  }

  // a coin asleep for an hour keeps minute candles and its last 20 trades
  function compact(c) {
    const out = [];
    for (const x of c.cd) {
      const practice = c.ext?.practice || localPractice(c);
      const b = practice ? Math.max(c.cd[0].t, Math.floor(x.t / 60) * 60) : Math.floor(x.t / 60) * 60;
      const last = out.length ? out[out.length - 1] : null;
      if (last && last.t === b) {
        if (x.h > last.h) last.h = x.h;
        if (x.l < last.l) last.l = x.l;
        last.c = x.c;
        last.v += x.v;
        last.b += x.b;
        last.s += x.s;
        if (practice) { last.buyVol += x.buyVol || 0; last.sellVol += x.sellVol || 0; }
      } else out.push({ t: b, o: x.o, h: x.h, l: x.l, c: x.c, v: x.v, b: x.b, s: x.s,
        ...(practice ? { buyVol: x.buyVol || 0, sellVol: x.sellVol || 0 } : {}) });
    }
    c.cd = out;
    if (c.trades.length > 20) c.trades.splice(0, c.trades.length - 20);
    c.compacted = true;
    c.hs = null;
    if (c.ext?.practice || localPractice(c)) c.cdv = (c.cdv || 0) + 1;
  }

  // ---------- reading (never changes the market, never draws a number) ----------

  // its market cap (SOL) at time ts: the close of its last candle at or before it
  function mcAt(c, ts) {
    const cd = c.cd;
    if (!cd.length || ts < cd[0].t) {
      // Real coins have no simulated launch floor. A window before the first observed quote is unknown.
      if (c.ext) return c.ext.practice ? c.mc0 : null;
      return c.cdTrim && cd.length ? cd[0].o : START_MC;
    }
    let lo = 0;
    let hi = cd.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (cd[mid].t <= ts) lo = mid;
      else hi = mid - 1;
    }
    return cd[lo].c;
  }

  function changeSince(c, ts, mc) {
    const before = mcAt(c, ts);
    return before > 0 ? mc / before - 1 : null;
  }

  function volSince(c, since) {
    const s = Math.floor(since);
    const cd = c.cd;
    let v = 0;
    let b = 0;
    let x = 0;
    for (let i = cd.length - 1; i >= 0 && cd[i].t >= s; i--) {
      v += cd[i].v;
      b += cd[i].b;
      x += cd[i].s;
    }
    return { v, b, s: x };
  }

  // who holds it: the 10 biggest, its dev, the snipers, bundles and insiders, callers, smart wallets and whales
  // (shares of the supply; kept for the step)
  function holderStats(c) {
    if (c.hs && c.hs.n === M.n) return c.hs.v;
    const top = [];
    let devTok = 0;
    const g = { sniper: { n: 0, tok: 0 }, bundler: { n: 0, tok: 0 }, insider: { n: 0, tok: 0 } };
    let smart = 0;
    const smartIds = [];
    let whales = 0;
    const kols = [];
    for (const h of c.hlist) {
      const tk = h.tok;
      if (top.length < 10 || tk > top[9]) {
        let i = top.length < 10 ? top.length : 9;
        if (top.length < 10) top.push(tk);
        while (i > 0 && top[i - 1] < tk) {
          top[i] = top[i - 1];
          i--;
        }
        top[i] = tk;
      }
      const l = h.label;
      if (l === 'dev') devTok += tk;
      else if (l === 'smart') {
        smart++;
        smartIds.push(Number(h.key.slice(1)));
      }
      else if (l === 'whale') whales++;
      else if (own(g, l)) {
        g[l].n++;
        g[l].tok += tk;
      }
      if (h.kol) kols.push({ id: h.kol, tok: tk, pct: tk / SUPPLY });
    }
    let t10 = 0;
    for (const x of top) t10 += x;
    const grp = (x, ever) => ({ n: x.n, tok: x.tok, pct: x.tok / SUPPLY, ever });
    const v = {
      holders: c.hlist.length,
      top10: t10 / SUPPLY,
      dev: devTok / SUPPLY,
      devSold: c.devMax > 0 ? clamp(1 - devTok / c.devMax, 0, 1) : 0,
      snipers: grp(g.sniper, c.tags.sniper),
      bundlers: grp(g.bundler, c.tags.bundler),
      insiders: grp(g.insider, c.tags.insider),
      kols,
      smart,
      smartIds: smartIds.sort((a, b) => a - b),
      whales,
    };
    c.hs = { n: M.n, v };
    return v;
  }

  // in Live mode, whether the lists show this kind of coin now (real ones, made-up stand-ins); always, else
  const shownKind = (c) => !M.live || localPractice(c) || (c.ext ? M.showExt : M.showSim);
  // a coin's phase and how much of its curve is sold, as people see them (a live coin's from its source)
  const phaseOf = (c) => (c.ext ? c.ext.phase : c.mk.phase);
  const progressOf = (c) => {
    if (c.ext) return c.ext.phase === 'curve' ? (Number.isFinite(c.ext.progress) ? c.ext.progress : 0) : 1;
    return c.mk.phase === 'curve' ? curveProgress(c.mk.curve) : 1;
  };

  // a coin as a list shows it (a row of a terminal's columns)
  function rowOf(c, t) {
    if (c.ext) return extRow(c, t);
    const mk = c.mk;
    const hs = holderStats(c);
    const v5 = volSince(c, t - 300);
    const mc = mcOf(mk);
    const r = {
      id: c.id, ticker: c.ticker, name: c.name, emoji: c.emoji, theme: c.theme, phase: mk.phase, mc,
      progress: progressOf(c), age: t - c.born, born: c.born, holders: hs.holders, top10: hs.top10, dev: hs.dev,
      devSold: hs.devSold, snipers: hs.snipers.pct, snipersN: hs.snipers.n, bundlers: hs.bundlers.pct,
      bundlersN: hs.bundlers.n, insiders: hs.insiders.pct, replies: c.replies, txns: c.nTx, vol: c.vol, vol5m: v5.v,
      txns5m: v5.b + v5.s, ch5m: mc / mcAt(c, t - 300) - 1, rugged: c.rugged !== null, dexPaid: c.dexPaid !== null,
      cto: c.cto !== null, calls: c.calls.length, socials: { ...c.socials }, migratedAt: c.poolAt,
      lastTrade: c.lastTrade, copyOf: c.copyOf, koth: M.koth === c.id, pair: c.pair,
    };
    if (c.createdByPlayer) Object.assign(r, { pair: c.pair, createdByPlayer: true });
    if (localPractice(c)) r.practice = true;
    else if (M.live) r.standIn = true;
    return r;
  }

  // a source's own number when it gave one, else ours
  const pick = (a, b) => (a !== null && a !== undefined && Number.isFinite(a) ? a : b);

  // a live coin as a list shows it: what isn't known about it (holders, its thread…) is null
  function extRow(c, t) {
    const x = c.ext;
    const d = x.dx;
    const v5 = volSince(c, t - 300);
    const mc = mcOf(c.mk);
    return {
      id: c.id, ticker: c.ticker, name: c.name, emoji: c.emoji, theme: c.theme, phase: x.phase, mc,
      progress: progressOf(c), age: t - c.born, born: c.born, holders: null, top10: null, dev: null, devSold: null,
      snipers: null, snipersN: null, bundlers: null, bundlersN: null, insiders: null, replies: null,
      txns: pick(d && d.t24, c.nTx), vol: pick(d && d.v24, c.vol), vol5m: pick(d && d.v5, v5.v),
      txns5m: d && Number.isFinite(d.b5) && Number.isFinite(d.s5) ? d.b5 + d.s5 : v5.b + v5.s,
      ch5m: pick(d && d.c5, changeSince(c, t - 300, mc)), rugged: false, dexPaid: false, cto: false, calls: 0,
      socials: { ...c.socials }, migratedAt: c.poolAt, lastTrade: c.lastTrade, copyOf: null, koth: M.koth === c.id,
      live: true, practice: Boolean(x.practice), metadataLive: x.metadataLive, pic: x.pic, src: x.src, chain: x.chain, tracked: x.live, pair: x.pair,
    };
  }
  const vol5Of = (c, t) => (c.ext && c.ext.dx && Number.isFinite(c.ext.dx.v5) ? c.ext.dx.v5 : volSince(c, t - 300).v);

  function row(id) {
    const c = coinOf(id);
    return c ? rowOf(c, tOf(M.n)) : null;
  }

  // The terminals' columns: new coins, the final stretch (half its curve or more), migrated, trending (its last five
  // minutes' volume), bump order (its last trade, newest first: a launchpad board's default) and the king of the hill.
  // Kept for the step (don't change what it returns).
  function lists(opts) {
    const L = clamp(intOr(opts && typeof opts === 'object' ? opts.limit : undefined, 30) || 30, 1, 100);
    if (M.lc && M.lc.n === M.n && M.lc.L === L) return M.lc.v;
    const t = tOf(M.n);
    const memo = new Map();
    const rowM = (c) => {
      let r = memo.get(c.id);
      if (!r) {
        r = rowOf(c, t);
        memo.set(c.id, r);
      }
      return r;
    };
    const fresh = [];
    const stretch = [];
    const migrated = [];
    const live = [];
    for (let i = M.coins.length - 1; i >= 0; i--) {
      const c = M.coins[i];
      if (!shownKind(c)) continue;
      const ph = phaseOf(c);
      if (ph === 'pool') migrated.push(c);
      else if (ph === 'migrating' || progressOf(c) >= 0.5) stretch.push(c);
      else fresh.push(c);
      if (c.lastTrade !== null && c.lastTrade >= t - 300) live.push(c);
    }
    fresh.sort((a, b) => b.born - a.born || b.id - a.id);
    stretch.sort((a, b) => progressOf(b) - progressOf(a) || b.id - a.id);
    migrated.sort((a, b) => b.poolAt - a.poolAt || b.id - a.id);
    // bump order: the same live coins by their last trade (sorted before `live` is sorted by volume)
    const bumped = live.slice().sort((a, b) => b.lastTrade - a.lastTrade || b.id - a.id);
    const vols = new Map(live.map((c) => [c.id, vol5Of(c, t)]));
    live.sort((a, b) => vols.get(b.id) - vols.get(a.id) || b.id - a.id);
    const v = {
      new: fresh.slice(0, L).map(rowM), stretch: stretch.slice(0, L).map(rowM), migrated: migrated.slice(0, L).map(rowM),
      trending: live.slice(0, L).map(rowM), bump: bumped.slice(0, L).map(rowM),
      koth: M.koth !== null && shownKind(M.coins[M.koth]) ? rowM(M.coins[M.koth]) : null,
    };
    M.lc = { n: M.n, L, v };
    return v;
  }

  // Everything about one coin now
  function stats(id) {
    const c = coinOf(id);
    if (!c) return null;
    if (c.ext) return extStats(c, tOf(M.n));
    const t = tOf(M.n);
    const mk = c.mk;
    const mc = mcOf(mk);
    const price = priceOf(mk);
    const liq = mk.phase === 'pool' ? 2 * mk.pool.sol : curveSol(mk.curve);
    const hs = holderStats(c);
    const v1m = volSince(c, t - 60);
    const v5m = volSince(c, t - 300);
    const v1h = volSince(c, t - 3600);
    const pos = P.pos.get(c.id);
    return {
      id: c.id, ticker: c.ticker, name: c.name, emoji: c.emoji, phase: mk.phase, born: c.born, age: t - c.born,
      mc, mcUsd: mc * usd, price, priceUsd: price * usd, liq, liqUsd: liq * usd, progress: progressOf(c),
      curveSol: mk.phase === 'pool' ? null : curveSol(mk.curve), ath: c.ath, athUsd: c.ath * usd, athAt: c.athAt,
      change1m: mc / mcAt(c, t - 60) - 1, change5m: mc / mcAt(c, t - 300) - 1, change1h: mc / mcAt(c, t - 3600) - 1,
      vol1m: v1m.v, vol5m: v5m.v, vol1h: v1h.v, buys5m: v5m.b, sells5m: v5m.s, txns5m: v5m.b + v5m.s,
      txns1h: v1h.b + v1h.s, txns: c.nTx, vol: c.vol,
      holders: hs.holders, top10: hs.top10, dev: hs.dev, devSold: hs.devSold, snipers: hs.snipers.pct,
      snipersN: hs.snipers.n, bundlers: hs.bundlers.pct, bundlersN: hs.bundlers.n, insiders: hs.insiders.pct,
      insidersN: hs.insiders.n, kols: hs.kols.map((x) => ({ ...x })), smart: hs.smart, smartIds: hs.smartIds.slice(),
      whales: hs.whales,
      devCoins: c.plan.intel.devCoins, devMigrated: c.plan.intel.devMigrated, socials: { ...c.socials },
      dexPaid: c.dexPaid !== null, dexPaidAt: c.dexPaid, cto: c.cto !== null, ctoAt: c.cto, rugged: c.rugged !== null,
      ruggedAt: c.rugged, replies: c.replies, lastTrade: c.lastTrade, koth: M.koth === c.id, kothAt: c.kothAt,
      gradAt: c.gradAt, migratedAt: c.poolAt,
      me: pos && (pos.tokens > 0 || pos.realized !== 0)
        ? { tokens: pos.tokens, cost: pos.cost, value: exitValue(c, pos.tokens), realized: pos.realized } : null,
      pending: c.q.map(orderView),
      ...(c.createdByPlayer ? { pair: c.pair, createdByPlayer: true } : {}),
      ...(localPractice(c) ? { practice: true, cdv: c.cdv || 0 } : {}),
    };
  }

  // everything about a live coin now (its source's own numbers when it gave them; null for what isn't known)
  function extStats(c, t) {
    const x = c.ext;
    const d = x.dx;
    const mk = c.mk;
    const mc = mcOf(mk);
    const price = priceOf(mk);
    const liq = x.practice ? 2 * mk.pool.sol : Number.isFinite(x.liq) ? x.liq : 2 * mk.pool.sol;
    const v1m = volSince(c, t - 60);
    const v5m = volSince(c, t - 300);
    const v1h = volSince(c, t - 3600);
    const pos = P.pos.get(c.id);
    const b5 = pick(d && d.b5, v5m.b);
    const s5 = pick(d && d.s5, v5m.s);
    return {
      id: c.id, ticker: c.ticker, name: c.name, emoji: c.emoji, phase: x.phase, born: c.born, age: t - c.born,
      mc, mcUsd: mc * usd, price, priceUsd: price * usd, liq, liqUsd: liq * usd, progress: progressOf(c),
      curveSol: x.phase === 'curve' && Number.isFinite(x.realSol) ? x.realSol : null, ath: c.ath, athUsd: c.ath * usd,
      athAt: c.athAt, change1m: changeSince(c, t - 60, mc), change5m: pick(d && d.c5, changeSince(c, t - 300, mc)),
      change1h: pick(d && d.c1h, changeSince(c, t - 3600, mc)), changeAll: c.mc0 > 0 ? mc / c.mc0 - 1 : null,
      vol1m: v1m.v, vol5m: pick(d && d.v5, v5m.v), vol1h: pick(d && d.v1h, v1h.v), buys5m: b5, sells5m: s5,
      txns5m: b5 + s5, txns1h: pick(d && d.t1h, v1h.b + v1h.s), txns: pick(d && d.t24, c.nTx), vol: pick(d && d.v24, c.vol),
      holders: null, top10: null, dev: null, devSold: null, snipers: null, snipersN: null, bundlers: null, bundlersN: null,
      insiders: null, insidersN: null, kols: [], smart: null, smartIds: [], whales: null, devCoins: null, devMigrated: null,
      socials: { ...c.socials }, dexPaid: false, dexPaidAt: null, cto: false, ctoAt: null, rugged: false, ruggedAt: null,
      replies: null, lastTrade: c.lastTrade, koth: M.koth === c.id, kothAt: c.kothAt, gradAt: c.gradAt, migratedAt: c.poolAt,
      me: pos && (pos.tokens > 0 || pos.realized !== 0)
        ? { tokens: pos.tokens, cost: pos.cost, value: exitValue(c, pos.tokens), realized: pos.realized } : null,
      pending: c.q.map(orderView),
      live: true, practice: Boolean(x.practice), metadataLive: x.metadataLive, tracked: x.live, src: x.src, chain: x.chain,
      pic: x.pic, pair: x.pair, cdv: c.cdv, estimated: x.estimated,
    };
  }

  // a wallet's address on this coin (the player's, the callers' and the smart wallets' are the same everywhere)
  function addrOf(c, key, kol) {
    const ck = kol ? `k:${kol}` : key;
    let a = c.addr.get(ck);
    if (a) return a;
    if (key === 'me') a = M.meAddr;
    else if (kol && KOL_INDEX.has(kol)) a = smartAddress(1000 + KOL_INDEX.get(kol));
    else if (/^m\d+$/.test(key)) a = smartAddress(Number(key.slice(1)));
    else a = addressFrom(hash32(`${seedStr}␟${c.id}␟${key}`));
    c.addr.set(ck, a);
    return a;
  }

  function info(id) {
    const c = coinOf(id);
    if (!c) return null;
    if (c.ext) {
      return { id: c.id, name: c.name, ticker: c.ticker, emoji: c.emoji, theme: c.theme, line: null, mint: c.mint,
        dev: c.devUser, devAddr: c.ext.by, born: c.born, copyOf: null, socials: { ...c.socials }, devCoins: null,
        devMigrated: null, live: true, practice: Boolean(c.ext.practice), metadataLive: c.ext.metadataLive,
        src: c.ext.src, chain: c.ext.chain, pic: c.ext.pic, pair: c.ext.pair };
    }
    return {
      id: c.id, name: c.name, ticker: c.ticker, emoji: c.emoji, theme: c.theme, line: c.line, mint: localPractice(c) ? null : c.mint,
      dev: c.devUser, devAddr: localPractice(c) ? null : addrOf(c, 'dev', null), born: c.born, copyOf: c.copyOf, socials: { ...c.socials },
      devCoins: c.plan.intel.devCoins, devMigrated: c.plan.intel.devMigrated, pair: c.pair,
      ...(c.createdByPlayer ? { pair: c.pair, createdByPlayer: true } : {}),
      ...(localPractice(c) ? { practice: true } : {}),
    };
  }

  function holders(id, n = 20) {
    const c = coinOf(id);
    if (!c) return null;
    const N = clamp(intOr(n, 20) || 20, 1, 100);
    const sorted = c.hlist.slice().sort((a, b) => b.tok - a.tok || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const mk = c.mk;
    let poolTok = mk.pool ? mk.pool.tok : mk.curve.left + RESERVED;
    let kind = mk.phase;
    if (c.ext) {
      // a live coin: its curve's tokens (for sale, and kept for its pool) or its pool's, when its source says them
      kind = c.ext.phase;
      poolTok = kind === 'curve' && Number.isFinite(mk.cap) ? mk.cap + RESERVED : kind === 'pool' && c.ext.exactPool ? mk.pool.tok : 0;
    }
    return {
      pool: { tok: poolTok, pct: poolTok / SUPPLY, kind },
      list: sorted.slice(0, N).map((h, i) => ({
        rank: i + 1, addr: addrOf(c, h.key, h.kol), label: h.label, tok: h.tok, pct: h.tok / SUPPLY, in: h.in,
        out: h.out, kol: h.kol, me: h.key === 'me', at: h.at,
      })),
      count: c.hlist.length,
    };
  }

  // The smart wallets and their records (a terminal's smart money board): their last 7 days before the run (`d7`), what
  // each closed on this run won or lost, what it holds now and what that's worth, its last trade
  function smartWallets() {
    return M.smart.map((S, k) => {
      let value = 0;
      let upnl = 0;
      const open = [];
      for (const id of S.open) {
        const c = M.coins[id];
        const h = c.holders.get(`m${k}`);
        if (!h) continue;
        const v = marketValue(c, h.tok);
        value += v;
        upnl += v + h.out - h.in;
        open.push({ coin: id, tok: h.tok, in: h.in, out: h.out, value: v });
      }
      open.sort((a, b) => a.coin - b.coin);
      return { n: k, addr: smartAddress(k), d7: { ...smartD7[k], dist: smartD7[k].dist.slice() }, buys: S.buys,
        sells: S.sells, in: S.in, out: S.out, won: S.won, lost: S.lost, pnl: S.pnl, upnl, value, open, last: S.last };
    });
  }

  // A coin's first buyers (up to FIRST_BUYERS, in the order they first bought) and what each holds now: 'hold' (about
  // what it first got), 'more' (bought more), 'part' (sold some) or 'all' (sold out); with the share of the supply they
  // first got and hold now. null for a real coin (its buyers are nobody we know) or an unknown id.
  function firstBuyers(id) {
    const c = coinOf(id);
    if (!c || c.ext || !c.first) return null;
    let got = 0;
    let hold = 0;
    const list = c.first.map((f, i) => {
      const h = c.holders.get(f.key);
      const tok = h ? h.tok : 0;
      got += f.tok0;
      hold += tok;
      const status = tok <= 0 ? 'all' : tok > f.tok0 * 1.02 ? 'more' : tok < f.tok0 * 0.98 ? 'part' : 'hold';
      return { n: i + 1, addr: addrOf(c, f.key, f.kol), label: f.label, kol: f.kol, me: f.key === 'me', at: f.at,
        tok0: f.tok0, tok, status };
    });
    return { list, got: got / SUPPLY, hold: hold / SUPPLY };
  }

  function trades(id, n = 50) {
    const c = coinOf(id);
    if (!c) return null;
    const N = clamp(intOr(n, 50) || 50, 1, KEEP.trades);
    const out = [];
    for (let i = c.trades.length - 1; i >= 0 && out.length < N; i--) {
      const x = c.trades[i];
      out.push({ t: x.t, side: x.s > 0 ? 'buy' : 'sell', sol: x.sol, tok: x.tok, mc: x.mc, label: x.l, kol: x.kol,
        me: x.k === 'me', addr: x.k === null ? null : addrOf(c, x.k, x.kol) });
    }
    return out;
  }

  function candles(id, since) {
    const c = coinOf(id);
    if (!c) return null;
    const cd = c.cd;
    let lo = 0;
    const s = Number(since);
    if (since != null && Number.isFinite(s)) {
      let hi = cd.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cd[mid].t < s) lo = mid + 1;
        else hi = mid;
      }
    }
    const out = new Array(cd.length - lo);
    for (let i = lo; i < cd.length; i++) {
      const x = cd[i];
      out[i - lo] = { t: x.t, o: x.o, h: x.h, l: x.l, c: x.c, v: x.v, b: x.b, s: x.s };
    }
    return out;
  }

  function comments(id, n = 30) {
    const c = coinOf(id);
    if (!c) return null;
    const N = clamp(intOr(n, 30) || 30, 1, KEEP.chat);
    const out = [];
    for (let i = c.chat.length - 1; i >= 0 && out.length < N; i--) out.push({ ...c.chat[i] });
    return out;
  }

  function tape(n = 50) {
    const N = clamp(intOr(n, 50) || 50, 1, KEEP.tape);
    const out = [];
    for (let i = M.tape.length - 1; i >= 0 && out.length < N; i--) {
      const x = M.tape[i];
      if (!shownKind(M.coins[x.c])) continue;
      out.push({ t: x.t, coin: x.c, ticker: M.coins[x.c].ticker, side: x.s > 0 ? 'buy' : 'sell', sol: x.sol, mc: x.mc,
        label: x.l });
    }
    return out;
  }

  function readFeed(since = 0) {
    const s = Number(since) || 0;
    const out = [];
    for (const e of M.feed) if (e.q > s) out.push({ ...e, ticker: e.c !== null ? M.coins[e.c].ticker : null });
    return out;
  }

  // coins by a mint address, a ticker ($ or not, any case) or a part of a name: their ids, newest first
  function find(q) {
    const s = typeof q === 'string' ? q.trim() : '';
    if (!s) return [];
    if (/^0x[0-9a-fA-F]{40}$/.test(s)) {
      const id = M.byMint.get(s.toLowerCase());
      return id === undefined ? [] : [id];
    }
    if (s.length >= 32 && isB58(s)) {
      const id = M.byMint.get(s);
      return id === undefined ? [] : [id];
    }
    const tk = s.replace(/^\$/, '').toUpperCase();
    const out = [];
    for (let i = M.coins.length - 1; i >= 0 && out.length < 20; i--) if ((M.coins[i].tk || M.coins[i].ticker) === tk) out.push(i);
    if (out.length) return out;
    const lower = s.toLowerCase();
    for (let i = M.coins.length - 1; i >= 0 && out.length < 20; i--) {
      if (M.coins[i].name.toLowerCase().includes(lower)) out.push(i);
    }
    return out;
  }

  function positions() {
    const out = [];
    for (const [id, p] of P.pos) {
      const c = M.coins[id];
      const value = p.tokens > 0 ? exitValue(c, p.tokens) : 0;
      const total = p.realized + value - p.cost;
      out.push({
        id, ticker: c.ticker, name: c.name, emoji: c.emoji, phase: c.ext ? c.ext.phase : c.mk.phase, tokens: p.tokens, cost: p.cost, value,
        pnl: value - p.cost, total, pnlPct: p.invested > 0 ? total / p.invested : 0, realized: p.realized,
        invested: p.invested, sold: p.sold, fees: p.fees, buys: p.buys, sells: p.sells, first: p.first, last: p.last,
        mc: mcOf(c.mk), open: p.tokens > 0,
      });
    }
    out.sort((a, b) => b.last - a.last || b.id - a.id);
    return out;
  }

  function orderView(o) {
    return {
      id: o.id, n: o.n, t: o.t, coin: o.coin, ticker: M.coins[o.coin].ticker, side: o.side, sol: o.sol, frac: o.frac,
      slippage: o.slippage, priority: o.priority, fee: o.fee, hold: o.hold, minRate: o.minRate, landAt: o.landAt,
      status: o.status, reason: o.reason, tok: o.tok, spent: o.spent, got: o.got, price: o.price, mc: o.mc,
      doneAt: o.doneAt, mev: o.mev ? { ...o.mev } : null,
    };
  }

  function orders(n = 50) {
    const N = clamp(intOr(n, 50) || 50, 1, KEEP.orders);
    const out = [];
    for (let i = P.orders.length - 1; i >= 0 && out.length < N; i--) out.push(orderView(P.orders[i]));
    return out;
  }

  // ---------- Live mode: real coins from outside ----------

  // the coins racing for the crown: the awake made-up ones, and in Live mode the kinds shown (live coins followed live)
  function kothField() {
    if (!M.live) return M.awake;
    const out = [];
    for (const c of M.awake) if (!c.ext && shownKind(c)) out.push(c);
    if (M.showExt) for (const c of M.ext) if (c.ext.live && c.ext.phase === 'curve') out.push(c);
    return out;
  }
  function kothOk(c) {
    if (c.ext) return M.showExt && c.ext.live && c.ext.phase === 'curve' && progressOf(c) >= 0.5;
    return !c.asleep && c.mk.phase === 'curve' && curveProgress(c.mk.curve) >= 0.5 && shownKind(c);
  }

  // who trades a live coin out there: nobody we know (never an address, never a made-up label)
  const TRADER = Object.freeze({ key: null, label: 'trader', kol: null });
  const PRACTICE_TRADER = Object.freeze({ key: null, label: 'practice', kol: null });
  const realMc = (r) => (r && r.tok > 0 ? (r.sol / r.tok) * SUPPLY : NaN);

  // A live coin's market in the player's view: its real reserves (a constant product), with the player's own tokens
  // taken out of them along that same curve (so their buy moves it and their sell gives back along it); a live curve
  // never sells more than it has left
  function extSet(c, r) {
    const me = c.ext.me;
    const k = r.sol * r.tok;
    let tok;
    let cap = null;
    if (Number.isFinite(r.cap)) {
      const took = Math.min(me, r.cap);
      cap = Math.max(0, r.cap - took);
      tok = r.tok - took;
    } else tok = Math.max(r.tok * 0.02, r.tok - me);
    tok = Math.max(1, tok);
    c.mk.pool = { sol: k / tok, tok };
    c.mk.cap = cap;
    c.mk.fee = Number.isFinite(r.fee) ? r.fee : FEES.curve;
    c.mk.closed = r.phase === 'migrating';
  }

  // a price point for a live coin (its market moved, nobody's trade known): its candle, its ATH, and it counts as
  // activity (bump order)
  function tickExt(c, t, mc) {
    if (!Number.isFinite(mc) || !(mc > 0)) return;
    const sec = Math.floor(t);
    const cd = c.cd;
    const last = cd.length ? cd[cd.length - 1] : null;
    const o = c.lastMc > 0 ? c.lastMc : mc;
    if (last && last.t === sec) {
      if (mc > last.h) last.h = mc;
      if (mc < last.l) last.l = mc;
      last.c = mc;
    } else if (!last || last.t < sec) {
      cd.push({ t: sec, o, h: Math.max(o, mc), l: Math.min(o, mc), c: mc, v: 0, b: 0, s: 0 });
      if (cd.length > KEEP.candles + 64) {
        cd.splice(0, cd.length - KEEP.candles);
        c.cdTrim = true;
      }
    } else return;
    if (c.lastMc > 0 && Math.abs(mc / c.lastMc - 1) > 1e-9) c.lastTrade = t;
    c.lastMc = mc;
    if (mc > c.ath) {
      c.ath = mc;
      c.athAt = t;
    }
    c.compacted = false;
  }

  // a live coin comes in: { key (its address), chain, src, name, ticker, pic, by (its creator), born (s), socials,
  // pair, live, real (its market now, in the market's units), real0 (at its launch, when known) } → its id
  function extAdd(o) {
    if (!M.live || !o || typeof o.key !== 'string' || !o.key || !o.real || !(o.real.tok > 0) || !(o.real.sol > 0)) return null;
    const known = M.byMint.get(o.key);
    if (known !== undefined) return known;
    const id = M.coins.length;
    const t = tOf(M.n);
    const born = Number.isFinite(o.born) ? Math.min(t, o.born) : t;
    const by = typeof o.by === 'string' && o.by ? o.by : null;
    const hasReal0 = Boolean(o.real0 && o.real0.tok > 0 && o.real0.sol > 0);
    const r0 = hasReal0 ? o.real0 : o.real;
    const c = {
      id, born, fate: null, plan: null, theme: 'live', name: String(o.name), ticker: String(o.ticker),
      tk: String(o.ticker).toUpperCase(), emoji: '🪙', copyOf: null, line: null, mint: o.key,
      devUser: by ? `${by.slice(0, 4)}…${by.slice(-4)}` : '—',
      mk: { phase: 'pool', curve: { left: 0 }, pool: { sol: 1, tok: 1 }, fee: FEES.curve, cap: null, closed: false },
      holders: new Map(), hlist: [], x: 0, q: [], defer: [], cd: [], cdTrim: false, trades: [], chat: [], calls: [],
      lastMc: 0, ath: 0, athAt: born, lastTrade: null, vol: 0, nTx: 0, replies: 0,
      socials: { x: false, tg: false, web: false, ...(o.socials || {}) }, rugged: null, dexPaid: null, cto: null,
      kothAt: null, devMax: 0, gradAt: null, migrateAt: null, poolAt: null,
      tags: { sniper: 0, bundler: 0, insider: 0, kol: 0, smart: 0, whale: 0 }, nNpc: 0, nF: 0, nBot: 0, tr: null, cr: null,
      asleep: true, addr: new Map(), hs: null, compacted: false, cdv: 0, mc0: 0,
      ext: { chain: o.chain || null, src: o.src || null, pic: o.pic || null, by, pair: o.pair || 'SOL', live: o.live !== false,
        me: 0, real: r0, gap: false, phase: r0.phase, progress: r0.progress, realSol: r0.realSol, liq: r0.liq, dx: null,
        estimated: Boolean(r0.estimated), exactPool: r0.exactPool === true, since: t, histDone: false,
        practice: o.practice === true ? { rng: makeRng(seedOf(seedStr, 'external-practice', o.key)), noise: 0 } : null },
    };
    M.coins.push(c);
    M.ext.push(c);
    M.byMint.set(o.key, id);
    extSet(c, r0);
    if (c.ext.practice) {
      // Source bonding/migration metadata is informational; this local practice pool remains tradeable.
      c.mk.cap = null; c.mk.closed = false; c.ext.live = true; c.ext.dx = null;
      c.asleep = false; M.awake.push(c);
    }
    const mc0 = mcOf(c.mk);
    c.mc0 = mc0;
    // A current quote is only known now. Keep its actual launch age without backdating that price into history.
    tickExt(c, hasReal0 ? born : t, mc0);
    c.lastTrade = null;
    if (c.ext.phase === 'pool') c.poolAt = born;
    pushFeed('launch', c, born);
    // its market now (a price point: what happened between its launch and now isn't a trade we know)
    if (r0 !== o.real) {
      c.ext.gap = true;
      extState(id, o.real);
    }
    M.lc = null;
    return id;
  }

  // its market now (`r` in the market's units; `r.dx`: its source's own numbers, or null): the change from its last
  // state is somebody's trade when both are exact (a live curve's tokens and SOL), else a price point; its phase may
  // move on (sold out → its pool)
  function extState(id, r) {
    const c = coinOf(id);
    if (!c || !c.ext || c.ext.practice || !r || !(r.tok > 0) || !(r.sol > 0)) return false;
    const x = c.ext;
    const t = tOf(M.n);
    const prev = x.gap ? null : x.real;
    const was = x.phase;
    x.real = r;
    x.gap = false;
    x.phase = r.phase;
    x.progress = r.progress;
    x.realSol = r.realSol;
    x.liq = r.liq;
    x.estimated = Boolean(r.estimated);
    x.exactPool = r.exactPool === true;
    if (r.dx !== undefined) x.dx = r.dx;
    extSet(c, r);
    const mc = mcOf(c.mk);
    const took = prev && prev.exact && r.exact && Number.isFinite(prev.cap) && Number.isFinite(r.cap) ? prev.cap - r.cap : 0;
    const dSol = prev && prev.exact && r.exact ? r.sol - prev.sol : 0;
    if (Math.abs(took) >= 1 && Math.abs(dSol) > 1e-9 && Math.sign(took) === Math.sign(dSol)) {
      record(c, t, took > 0 ? 1 : -1, Math.abs(dSol), Math.abs(took), TRADER, mc);
    } else tickExt(c, t, mc);
    if (was !== x.phase) {
      if (x.phase === 'migrating') {
        c.gradAt = t;
        pushFeed('migrate', c, t);
      } else if (x.phase === 'pool') {
        if (c.gradAt === null) c.gradAt = t;
        c.poolAt = t;
        M.counts.migrated++;
        pushFeed('migrated', c, t);
      }
    }
    M.lc = null;
    return true;
  }

  // its history between its launch and when this run saw it (a watched coin: [{ t, real }], oldest first), once: its
  // candles and the trades in it, put in their places
  function extHistory(id, points) {
    const c = coinOf(id);
    if (!c || !c.ext || c.ext.practice || c.ext.histDone || !Array.isArray(points) || points.length < 2) return false;
    const from = Math.floor(c.born);
    const until = Math.floor(c.ext.since);
    const cds = [];
    const trs = [];
    let prev = null;
    let lastMc = null;
    let vol = 0;
    for (const p of points) {
      if (!p || !Number.isFinite(p.t) || !p.real || !(Math.floor(p.t) > from && Math.floor(p.t) < until)) continue;
      const mc = realMc(p.real);
      if (!Number.isFinite(mc) || !(mc > 0)) continue;
      const sec = Math.floor(p.t);
      let side = 0;
      let sol = 0;
      let tok = 0;
      if (prev && prev.exact && p.real.exact && Number.isFinite(prev.cap) && Number.isFinite(p.real.cap)) {
        const took = prev.cap - p.real.cap;
        const dSol = p.real.sol - prev.sol;
        if (Math.abs(took) >= 1 && Math.abs(dSol) > 1e-9 && Math.sign(took) === Math.sign(dSol)) {
          side = took > 0 ? 1 : -1;
          sol = Math.abs(dSol);
          tok = Math.abs(took);
          trs.push({ t: p.t, s: side, sol, tok, mc, k: null, l: 'trader', kol: null });
          vol += sol;
        }
      }
      const last = cds.length ? cds[cds.length - 1] : null;
      const o = lastMc !== null ? lastMc : mc;
      if (last && last.t === sec) {
        if (mc > last.h) last.h = mc;
        if (mc < last.l) last.l = mc;
        last.c = mc;
        last.v += sol;
        if (side > 0) last.b += 1;
        else if (side < 0) last.s += 1;
      } else cds.push({ t: sec, o, h: Math.max(o, mc), l: Math.min(o, mc), c: mc, v: sol, b: side > 0 ? 1 : 0, s: side < 0 ? 1 : 0 });
      if (mc > c.ath) {
        c.ath = mc;
        c.athAt = p.t;
      }
      lastMc = mc;
      prev = p.real;
    }
    c.ext.histDone = true;
    if (!cds.length) return false;
    // in time order with what it has (its launch's candle before, its live ones after; one candle a second)
    const all = c.cd.concat(cds).sort((a, b) => a.t - b.t);
    const out = [];
    for (const x of all) {
      const last = out.length ? out[out.length - 1] : null;
      if (last && last.t === x.t) {
        if (x.h > last.h) last.h = x.h;
        if (x.l < last.l) last.l = x.l;
        last.c = x.c;
        last.v += x.v;
        last.b += x.b;
        last.s += x.s;
      } else out.push({ ...x });
    }
    c.cd = out;
    if (trs.length) {
      c.trades = c.trades.concat(trs).sort((a, b) => a.t - b.t);
      if (c.trades.length > KEEP.trades) c.trades.splice(0, c.trades.length - KEEP.trades);
      c.vol += vol;
      c.nTx += trs.length;
    }
    c.cdv += 1;
    c.compacted = false;
    M.lc = null;
    return true;
  }

  const extApi = {
    add: extAdd,
    state: extState,
    history: extHistory,
    // Only a source-identity practice adapter may skip an unobserved wall-clock gap. Pending fills must have been
    // settled first; ordinary simulations and source-reserve markets keep their normal deterministic step loop.
    practiceSkipTo(t) {
      if (!M.live || !M.simPaused || M.showSim || P.pending.size || M.coins.some(c => !c.ext?.practice)) return false;
      if (!Number.isFinite(t)) return false;
      const goal = n0 + Math.floor(t * STEPS_PER_S + 1e-9);
      if (!Number.isSafeInteger(goal) || goal <= M.n) return false;
      M.n = goal;
      M.lc = null;
      return true;
    },
    // Bound crowd work to a discovery window. Positions and queued player orders are always protected; ordering a
    // dormant coin also wakes it through the ordinary order path. Resuming uses its saved reserves/RNG, never a
    // source quote or invented catch-up trades. Iterate the active set, not all historical source identities.
    practiceActivity(ids) {
      const wanted = new Set(ids);
      let slept = false;
      for (const c of M.awake) {
        if (!c.ext?.practice || wanted.has(c.id) || c.q.length || (P.pos.get(c.id)?.tokens || 0) > 0) continue;
        c.asleep = true; slept = true;
      }
      if (slept) M.awake = M.awake.filter(c => !c.asleep);
      for (const id of wanted) {
        const c = coinOf(id);
        if (c?.ext?.practice) wake(c);
      }
    },
    // A practice market follows source identity and launch categories without importing a source trade, price,
    // volume statistic, reserve or history revision. Its local pool remains open even during source migration.
    metadata(id, data) {
      const c = coinOf(id);
      if (!c || !c.ext || !c.ext.practice || !data || typeof data !== 'object') return false;
      const x = c.ext, was = x.phase;
      let changed = false;
      const set = (target, key, value) => {
        if (target[key] !== value) { target[key] = value; changed = true; }
      };
      if (['curve', 'migrating', 'pool'].includes(data.phase)) set(x, 'phase', data.phase);
      if (data.progress === null || Number.isFinite(data.progress)) set(x, 'progress', data.progress === null ? null : clamp(data.progress, 0, 1));
      if (data.realSol === null || Number.isFinite(data.realSol) && data.realSol >= 0) set(x, 'realSol', data.realSol);
      if (typeof data.metadataLive === 'boolean') set(x, 'metadataLive', data.metadataLive);
      if (typeof data.name === 'string' && data.name.trim()) set(c, 'name', data.name.slice(0, 48));
      if (typeof data.ticker === 'string' && data.ticker.trim()) {
        set(c, 'ticker', data.ticker.slice(0, 16)); set(c, 'tk', c.ticker.toUpperCase());
      }
      if (typeof data.src === 'string' && data.src) set(x, 'src', data.src);
      if (typeof data.by === 'string' && data.by) {
        set(x, 'by', data.by); set(c, 'devUser', `${data.by.slice(0, 4)}…${data.by.slice(-4)}`);
      }
      if (data.socials && typeof data.socials === 'object') {
        for (const key of ['x', 'tg', 'web']) if (typeof data.socials[key] === 'boolean') set(c.socials, key, data.socials[key]);
      }
      if (was !== x.phase) {
        const t = tOf(M.n);
        if (x.phase === 'migrating' || x.phase === 'pool') c.gradAt ??= t;
        if (x.phase === 'pool') c.poolAt = t;
      }
      if (changed) M.lc = null;
      return changed;
    },
    practiceWindows(id) {
      const c = coinOf(id);
      if (!c || !(c.ext?.practice || localPractice(c))) return null;
      const out = {}, now = tOf(M.n), mc = mcOf(c.mk);
      for (const [key, seconds] of Object.entries({ '5m': 300, '1h': 3600, '4h': 14400, '1d': 86400 })) {
        const since = Math.floor(now - seconds);
        // Once retained history no longer covers a window, report it unknown rather than a partial total.
        if (c.cdTrim && c.cd.length && since < c.cd[0].t) { out[key] = null; continue; }
        let buys = 0, sells = 0, buyVolume = 0, sellVolume = 0;
        for (let i = c.cd.length - 1; i >= 0 && c.cd[i].t >= since; i--) {
          const bar = c.cd[i]; buys += bar.b; sells += bar.s;
          buyVolume += bar.buyVol || 0; sellVolume += bar.sellVol || 0;
        }
        out[key] = { buys, sells, buyers: null, sellers: null, buyVolume, sellVolume,
          volume: buyVolume + sellVolume, change: changeSince(c, since, mc) };
      }
      return out;
    },
    // its market followed live (true), or not right now (false: its trades wait; its next state is a price point)
    track(id, on) {
      const c = coinOf(id);
      if (!c || !c.ext || c.ext.practice) return;
      const v = Boolean(on);
      if (c.ext.live === v) return;
      c.ext.live = v;
      if (!v) c.ext.gap = true;
      M.lc = null;
    },
    pic(id, url, socials) {
      const c = coinOf(id);
      if (!c || !c.ext) return;
      if (typeof url === 'string' && url) c.ext.pic = url;
      if (socials && typeof socials === 'object') c.socials = { ...c.socials, ...socials };
      M.lc = null;
    },
    // which kinds the lists show, and whether the made-up ones are paused
    view({ sim = M.showSim, ext = M.showExt, simPaused = M.simPaused } = {}) {
      if (!M.live) return;
      M.showSim = Boolean(sim);
      M.showExt = Boolean(ext);
      M.simPaused = Boolean(simPaused);
      M.lc = null;
    },
    get shown() {
      return { sim: M.showSim, ext: M.showExt, simPaused: M.simPaused };
    },
    byKey: (key) => {
      const id = M.byMint.get(key);
      return id === undefined || !M.coins[id].ext ? null : id;
    },
    ids: () => M.ext.map((c) => c.id),
    // how many real coins are followed live right now
    liveCount: () => M.ext.filter((c) => c.ext.live).length,
    keyOf: (id) => {
      const c = coinOf(id);
      return c && c.ext ? c.mint : null;
    },
  };

  // ---------- the warm-up: the trenches are busy before the player arrives ----------

  while (M.n < n0) step();
  P.equity.push({ t: 0, v: netWorth() });

  return {
    get canLaunchPractice() { return canLaunchPractice; },
    get t() {
      return tOf(M.n);
    },
    get n() {
      return M.n;
    },
    n0,
    seed: seedStr,
    solUsd: usd,
    startSol: start,
    get feedSeq() {
      return M.fseq;
    },
    get player() {
      return { sol: P.sol, held: P.held, startSol: start, worth: netWorth(), fees: { ...P.fees }, pending: P.pending.size,
        address: M.meAddr };
    },
    get meta() {
      return M.meta;
    },
    get heat() {
      return M.heat;
    },
    get koth() {
      return M.koth;
    },
    get counts() {
      return { ...M.counts };
    },
    get size() {
      return { coins: M.coins.length, awake: M.awake.length };
    },
    get config() {
      return { ...cfg };
    },
    // Live mode: the real coins' doors (null in a made-up market), and whether a coin is a real one
    get live() {
      return M.live;
    },
    ext: M.live ? extApi : null,
    isExt: (id) => Boolean(coinOf(id) && coinOf(id).ext),
    step() {
      step();
    },
    // seconds forward (a whole number of steps; an hour at most at once): how many steps it took
    advance(s) {
      const k = Math.min(MAX_STEPS, Math.max(0, Math.round(Number(s) * STEPS_PER_S) || 0));
      for (let i = 0; i < k; i++) step();
      return k;
    },
    // up to time t (seconds from the run's start; an hour of steps at most at once): how many steps it took
    advanceTo(t) {
      const x = Number(t);
      if (!Number.isFinite(x)) return 0;
      const goal = n0 + Math.floor(x * STEPS_PER_S + 1e-9);
      let k = 0;
      while (M.n < goal && k < MAX_STEPS) {
        step();
        k++;
      }
      return k;
    },
    info,
    lists,
    stats,
    row,
    candles,
    trades,
    holders,
    smartWallets,
    firstBuyers,
    comments,
    tape,
    feed: readFeed,
    find,
    positions,
    orders,
    quote,
    netWorth,
    maxBuy,
    equity(since = -Infinity) {
      const s = Number(since);
      const lo = Number.isFinite(s) ? s : -Infinity;
      return P.equity.filter((e) => e.t >= lo).map((e) => ({ t: e.t, v: e.v }));
    },
    log() {
      return P.log.map((e) => ({ ...e }));
    },
    launchCoin,
    order,
    // for tests and the balance harness only: a coin's fate and plan are its future, never shown in the game
    debug: {
      fate: (id) => coinOf(id)?.fate ?? null,
      plan: (id) => coinOf(id)?.plan ?? null,
      coin: (id) => coinOf(id),
      smartQuality: () => smartQ.slice(),
    },
  };
}

// A market made again from its seed and its log of orders (each at the step it was placed): the same market
export function replay({ seed, solUsd, startSol, config, log = [], until } = {}) {
  const m = createMarket({ seed, solUsd, startSol, config });
  for (const e of log) {
    if (!(Number.isInteger(e.n) && e.n >= m.n)) throw new Error('replay: the log is out of order');
    while (m.n < e.n) m.step();
    const r = e.kind === 'launch' ? m.launchCoin(e) : m.order(e);
    if (!r.ok) throw new Error(`replay: an order failed (${r.error})`);
  }
  if (Number.isInteger(until)) while (m.n < until) m.step();
  return m;
}
