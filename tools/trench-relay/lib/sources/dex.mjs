// DexScreener (2026-10-21, #404; free, commercial use allowed, about 300 requests a minute for pairs and 60 for
// profiles): the dollar prices of SOL, ETH and BNB (a minute apart), the pools of pump.fun coins after their curve sells
// out (15 s apart), and the BNB Chain, Base and Robinhood Chain coins: the newest token profiles (coins whose makers
// listed them there: not every launch), each kept while its pair is at most 3 days old, its market followed 20 s apart.
// Every request is counted: never more than `perMinute` in a minute (a minute's worth waits for the next).
// Robinhood Chain (since 2026-10-21, the owner's "Add DexScreener coins"): its listed coins from any launchpad join
// clank.trade's (./clank.mjs), which stays the chain's own source: its state (live, quiet, down) is clank.trade's, and a
// coin both list is clank.trade's (it takes it over: `extra.dex` false). This file only ever follows the coins it added.
// GMGN's other chains (2026-10-22, the owner's "i just checked there are other chains on gmgn right add that also"):
// Ethereum, Monad, HyperEVM, Arbitrum and Tron the same way as BNB Chain and Base (listed coins, no key); HYPE, MON and
// TRX priced only while their chain is on. /health counts the profiles' chains (a day at a time), so the owner can see
// which other chains (X Layer, MegaETH) DexScreener lists coins on before they're added.
import { trustedJson } from '../net.mjs';
import { bestPair, wrappedUsd, pairDx, solPoolState, usdPairState, parseProfiles, cleanName, cleanTicker, CURVE_DEXES, WRAPPED,
  isEvm, addressOn } from '../parse.mjs';
import { errText } from '../log.mjs';

// our chain → DexScreener's, and back
const DEX_CHAINS = Object.freeze({ solana: 'solana', bnb: 'bsc', base: 'base', robinhood: 'robinhood', ethereum: 'ethereum', monad: 'monad',
  hyperevm: 'hyperevm', arbitrum: 'arbitrum', tron: 'tron' });
const FROM_DEX = Object.freeze(Object.fromEntries(Object.entries(DEX_CHAINS).map(([ours, theirs]) => [theirs, ours])));
// the chains whose state DexScreener decides (Robinhood Chain's is clank.trade's)
const JUDGED = Object.freeze(['bnb', 'base', 'ethereum', 'monad', 'hyperevm', 'arbitrum', 'tron']);
// the coins priced always (SOL, and ETH and BNB: Base's, Robinhood Chain's and BNB Chain's money), and the others only
// while their chain is on
const ALWAYS_PRICED = Object.freeze(['sol', 'eth', 'bnb']);
const DAY_MS = 24 * 3600 * 1000;
const NEW_FOR_MS = 3 * 24 * 3600 * 1000;
const PER_CHAIN = 60; // listed coins followed at once (each chain)
// a coin this file added and still looks after (not one clank.trade's list took over)
const mine = (c) => Boolean(c && c.extra && c.extra.dex);

export function createDex({ cfg, hub, pictures, log, fetchJson = trustedJson, now = Date.now, every = {}, perMinute = 240 }) {
  const E = { prices: 60_000, pools: 15_000, discover: 30_000, markets: 20_000, ...every };
  const base = cfg.dexscreener;
  const calls = [];
  const solPools = new Map(); // id → mint
  const pending = new Map(); // `${chain}:${address}` → { chain, address, icon, at }
  const seen = new Set(); // addresses already looked at (kept or not)
  const lastOk = Object.fromEntries(Object.keys(DEX_CHAINS).map((c) => [c, 0]));
  // the profiles' chains, counted a day at a time (DexScreener's ids, whatever they are)
  let tally = { since: now(), byChain: {} };
  let okAt = 0;
  let fails = 0;
  const timers = [];

  async function get(path) {
    const t = now();
    while (calls.length && calls[0] < t - 60_000) calls.shift();
    if (calls.length >= perMinute) return null;
    calls.push(t);
    try {
      const r = await fetchJson(`${base}${path}`, { timeoutMs: 8000, maxBytes: 3_000_000 });
      okAt = now();
      return r;
    } catch (err) {
      fails += 1;
      if (fails <= 3 || fails % 20 === 0) log.warn(`DexScreener: ${errText(err)}`);
      return null;
    }
  }
  const batches = (list, n = 30) => {
    const out = [];
    for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
    return out;
  };

  async function prices() {
    const want = Object.keys(WRAPPED).filter((w) => ALWAYS_PRICED.includes(w) || cfg.chains.includes(FROM_DEX[WRAPPED[w].chain]));
    const got = await Promise.all(want.map((w) => get(`/tokens/v1/${WRAPPED[w].chain}/${WRAPPED[w].address}`)));
    const px = {};
    want.forEach((w, i) => {
      const v = got[i] ? wrappedUsd(got[i], w) : null;
      // (to the cent; a coin under a dollar, MON's two cents say, to 4 significant figures)
      if (v) px[w] = v >= 1 ? Math.round(v * 100) / 100 : Number(v.toPrecision(4));
    });
    if (Object.keys(px).length) hub.setPx(px);
  }

  // pump.fun coins after their curve: their pool on DexScreener (pump.fun's own, or wherever it is)
  async function pools() {
    for (const [id] of solPools) if (!hub.coin('solana', id)) solPools.delete(id);
    for (const batch of batches([...solPools])) {
      const pairs = await get(`/tokens/v1/solana/${batch.map(([, m]) => m).join(',')}`);
      if (!pairs) continue;
      for (const [id, mint] of batch) {
        const p = bestPair(pairs, 'solana', mint);
        const st = solPoolState(p);
        if (!st) continue;
        hub.setState('solana', id, st, pairDx(p));
        const c = hub.coin('solana', id);
        if (c && !c.tracked) hub.setTracked('solana', id, true);
      }
    }
  }

  function count(data) {
    if (now() - tally.since > DAY_MS) tally = { since: now(), byChain: {} };
    for (const x of Array.isArray(data) ? data : []) {
      const id = x && typeof x.chainId === 'string' && /^[a-z0-9-]{2,24}$/.test(x.chainId) ? x.chainId : null;
      if (id && (Object.hasOwn(tally.byChain, id) || Object.keys(tally.byChain).length < 60)) tally.byChain[id] = (tally.byChain[id] || 0) + 1;
    }
  }
  async function discover() {
    const want = Object.entries(DEX_CHAINS).filter(([c]) => c !== 'solana' && cfg.chains.includes(c)).map(([, d]) => d);
    if (!want.length) return;
    const data = await get('/token-profiles/latest/v1');
    if (!data) return;
    count(data);
    for (const x of parseProfiles(data, want)) {
      const chain = FROM_DEX[x.chain];
      if (!chain) continue;
      const k = `${chain}:${x.address}`;
      if (seen.has(k) || pending.has(k) || hub.byKey(chain, x.address)) continue;
      pending.set(k, { chain, address: x.address, icon: x.icon, at: now() });
    }
    while (pending.size > 200) pending.delete(pending.keys().next().value);
  }

  async function markets() {
    for (const [chain, dexChain] of Object.entries(DEX_CHAINS)) {
      if (!cfg.chains.includes(chain)) continue;
      const followed = hub.coins(chain).filter((c) => c.tracked && mine(c)).sort((a, b) => b.born - a.born);
      const waiting = [...pending.values()].filter((p) => p.chain === chain).slice(0, 30);
      const addresses = [...new Set([...waiting.map((p) => p.address), ...followed.map((c) => c.key)])];
      let any = false;
      for (const batch of batches(addresses)) {
        const pairs = await get(`/tokens/v1/${dexChain}/${batch.join(',')}`);
        if (!pairs) continue;
        any = true;
        for (const address of batch) {
          const p = bestPair(pairs, dexChain, address);
          const k = `${chain}:${address}`;
          const wait = pending.get(k);
          if (wait) {
            pending.delete(k);
            seen.add(k);
            if (seen.size > 20000) seen.clear();
            addNew(chain, address, p, wait.icon);
            continue;
          }
          const c = hub.byKey(chain, address);
          const st = usdPairState(p);
          if (mine(c) && st) hub.setState(chain, c.id, st, pairDx(p));
        }
      }
      if (any || !addresses.length) lastOk[chain] = now();
      // the newest PER_CHAIN followed (and the watched ones); older ones let go
      followed.forEach((c, i) => {
        if (i >= PER_CHAIN && c.watchers === 0 && !(c.extra.lookupUntil > now())) hub.setTracked(chain, c.id, false);
      });
    }
  }

  function addNew(chain, address, p, icon, requested = false) {
    if (!p || addressOn(chain, address) !== address) return;
    const created = Number(p.pairCreatedAt);
    if (!Number.isFinite(created) || (!requested && now() - created > NEW_FOR_MS)) return; // older coins need an explicit search
    const st = usdPairState(p);
    const name = cleanName(p.baseToken && p.baseToken.name);
    const symbol = cleanTicker(p.baseToken && p.baseToken.symbol);
    if (!st || !name || !symbol) return;
    const known = hub.byKey(chain, address);
    if (known) {
      if (mine(known)) hub.setState(chain, known.id, st, pairDx(p));
      if (requested) {
        known.extra.lookupUntil = now() + 5 * 60_000;
        hub.setTracked(chain, known.id, true);
      }
      return known;
    }
    const id = hub.addCoin(chain, { key: address, name, symbol, born: Math.min(created, now()), by: null,
      src: CURVE_DEXES[p.dexId] || null, sup: 0, st, tracked: true, extra: { dex: true, lookupUntil: requested ? now() + 5 * 60_000 : 0 } });
    if (!id) return;
    hub.setState(chain, id, st, pairDx(p));
    const image = icon || (p.info && typeof p.info.imageUrl === 'string' ? p.info.imageUrl : null);
    if (image) {
      pictures.request(`${chain}:${id}`, { image }, (path) => {
        if (path) hub.setPic(chain, id, path);
      });
    }
    return hub.coin(chain, id);
  }

  async function lookup(chain, raw) {
    const address = addressOn(chain, raw);
    const dexChain = DEX_CHAINS[chain];
    if (!address || !dexChain || !cfg.chains.includes(chain)) return null;
    const data = await get(`/tokens/v1/${dexChain}/${address}`);
    if (!Array.isArray(data)) throw new Error('Coin lookup is unavailable');
    const p = bestPair(data, dexChain, address);
    return addNew(chain, address, p, null, true) || null;
  }

  // another source's coins' pairs (clank.trade's graduated coins, say): DexScreener's answer, or null
  async function pairs(dexChain, addresses) {
    const out = [];
    for (const batch of batches(addresses.filter(isEvm))) {
      const r = await get(`/tokens/v1/${dexChain}/${batch.join(',')}`);
      if (Array.isArray(r)) out.push(...r);
    }
    return out;
  }

  function judge() {
    for (const chain of JUDGED) {
      if (!cfg.chains.includes(chain)) continue;
      hub.judge(chain, { connected: now() - lastOk[chain] < Math.max(90_000, E.markets * 4), src: 'DexScreener',
        why: now() - lastOk[chain] < Math.max(90_000, E.markets * 4) ? null : 'DexScreener not answering' });
    }
  }

  const loop = (fn, ms) => {
    let busy = false;
    const run = async () => {
      if (busy) return;
      busy = true;
      try {
        await fn();
      } catch (err) {
        log.warn(`DexScreener: ${errText(err)}`);
      } finally {
        busy = false;
      }
    };
    run();
    timers.push(setInterval(run, ms));
  };

  return {
    start() {
      loop(prices, E.prices);
      loop(pools, E.pools);
      if (Object.keys(DEX_CHAINS).some((c) => cfg.chains.includes(c))) {
        loop(async () => {
          await discover();
          await markets();
          judge();
        }, Math.min(E.discover, E.markets));
      }
    },
    stop() {
      for (const t of timers) clearInterval(t);
      timers.length = 0;
    },
    followSolPool(id, mint) {
      solPools.set(id, mint);
    },
    unfollowSolPool(id) {
      solPools.delete(id);
    },
    pairs,
    lookup,
    stats() {
      return { lastOkS: okAt ? Math.round((now() - okAt) / 1000) : -1, callsLastMinute: calls.length, solPools: solPools.size,
        waiting: pending.size, profiles: { sinceS: Math.round((now() - tally.since) / 1000), byChain: { ...tally.byChain } } };
    },
  };
}
