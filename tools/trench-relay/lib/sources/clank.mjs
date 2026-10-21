// Robinhood Chain's new coins (2026-10-21, #404): clank.trade's own coin list (the API its website uses, the same one
// the site's risk check reads: server/checker.js), its first page (the 12 newest) every 12 s with the prices of ETH and
// SPCX (a coin's market cap is in its pair), its next two pages every 36 s, its trending list every 30 s, and the
// graduated coins' pool liquidity from DexScreener every minute. Every coin there, live (clank.trade coins in every
// terminal: the owner's). It's the chain's own source (its state is clank.trade's); since 2026-10-21 Robinhood coins from
// other launchpads join them when their makers list them on DexScreener (./dex.mjs: the owner's "Add DexScreener coins").
import { trustedJson } from '../net.mjs';
import { clankCoin, CLANK_ETH, CLANK_SPCX, bestPair, isEvm } from '../parse.mjs';
import { CID } from '../pictures.mjs';
import { errText } from '../log.mjs';

const CHAIN = 'robinhood';
const PAGES = 3; // 36 coins followed (and the watched ones)
const num = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && v.length < 40 ? Number(v) : NaN);
// a Robinhood Chain coin from DexScreener's listings (./dex.mjs, since 2026-10-21) that clank.trade's list doesn't have
const listed = (c) => Boolean(c && c.extra && c.extra.dex);

export function createClank({ cfg, hub, pictures, dex, log, fetchJson = trustedJson, now = Date.now, every = {} }) {
  const E = { newest: 12_000, older: 36_000, trending: 30_000, liquidity: 60_000, ...every };
  const rates = new Map();
  const fresh = new Map(); // address → when its list last said something
  const lu = new Map(); // address → its pool's liquidity ($)
  let cursor = null;
  let okAt = 0;
  let fails = 0;
  const timers = [];

  async function api(calls) {
    const names = calls.map(([n]) => n).join(',');
    const input = Object.fromEntries(calls.map(([, v], i) => [i, v ?? {}]));
    const url = `${cfg.clank}${names}?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`;
    const body = await fetchJson(url, { timeoutMs: 8000, maxBytes: 3_000_000 });
    if (!Array.isArray(body) || body.length !== calls.length) throw new Error('clank.trade\'s answer has an unexpected shape');
    okAt = now();
    return body.map((x) => (x && typeof x === 'object' && x.result ? x.result.data ?? null : null));
  }

  function upsert(raw) {
    const c = clankCoin(raw, rates);
    if (!c) return;
    fresh.set(c.address, now());
    if (fresh.size > 5000) fresh.delete(fresh.keys().next().value);
    const known = hub.byKey(CHAIN, c.address);
    // a coin DexScreener's listings brought first (./dex.mjs) that clank.trade lists too: clank.trade's from now on
    if (known && known.extra && known.extra.dex) known.extra.dex = false;
    if (c.st && lu.has(c.address) && c.st.gr) c.st.lu = lu.get(c.address);
    if (!known) {
      if (!c.st) return; // no price for its pair yet: next time
      const id = hub.addCoin(CHAIN, { key: c.address, name: c.name, symbol: c.symbol, born: c.born || now(), by: null,
        src: 'clank.trade', sup: 0, st: c.st, tracked: true, extra: {} });
      const image = c.image && CID.test(c.image) ? `ipfs://${c.image}` : c.image;
      if (id && image) {
        pictures.request(`${CHAIN}:${id}`, { image }, (path) => {
          if (path) hub.setPic(CHAIN, id, path);
        });
      }
      return;
    }
    if (!c.st) return;
    hub.setState(CHAIN, known.id, c.st);
    if (!known.tracked) hub.setTracked(CHAIN, known.id, true);
  }

  async function newest() {
    const [list, eth, spcx] = await api([['coins.list', {}], ['exchangeRates.tokenUsdg', { token: CLANK_ETH }],
      ['exchangeRates.tokenUsdg', { token: CLANK_SPCX }]]);
    for (const [k, d] of [[CLANK_ETH, eth], [CLANK_SPCX, spcx]]) {
      const p = num(d && d.price);
      if (p > 0) rates.set(k, p);
    }
    if (!list || !Array.isArray(list.coins)) throw new Error('clank.trade sent no coin list');
    cursor = typeof list.nextCursor === 'string' && list.nextCursor.length < 1000 ? list.nextCursor : null;
    // oldest first, so the newest is the last added
    for (const raw of list.coins.slice().reverse()) upsert(raw);
  }

  async function older() {
    let cur = cursor;
    for (let i = 1; i < PAGES && cur; i++) {
      const [page] = await api([['coins.list', { cursor: cur }]]);
      if (!page || !Array.isArray(page.coins)) return;
      for (const raw of page.coins) upsert(raw);
      cur = typeof page.nextCursor === 'string' && page.nextCursor.length < 1000 ? page.nextCursor : null;
    }
    // coins the list no longer reaches: no longer followed (unless watched); never DexScreener's listed ones (./dex.mjs
    // follows those)
    const followed = hub.coins(CHAIN).filter((c) => c.tracked && !listed(c)).sort((a, b) => b.born - a.born);
    followed.forEach((c, i) => {
      if (i >= PAGES * 12 && c.watchers === 0 && now() - (fresh.get(c.key) || 0) > E.older * 2) hub.setTracked(CHAIN, c.id, false);
    });
  }

  async function trending() {
    const [list] = await api([['coins.trending', {}]]);
    for (const t of Array.isArray(list) ? list : []) {
      if (!t || !isEvm(t.address)) continue;
      const c = hub.byKey(CHAIN, String(t.address).toLowerCase());
      const mu = num(t.marketCapUsdg);
      if (!c || !c.st || c.st.k !== 'u' || !(mu > 0)) continue;
      hub.setState(CHAIN, c.id, { ...c.st, mu, gr: c.st.gr || t.isLive === true });
    }
  }

  async function liquidity() {
    const grads = hub.coins(CHAIN).filter((c) => c.tracked && c.st && c.st.gr && !listed(c)).map((c) => c.key);
    if (!grads.length || !dex) return;
    const pairs = await dex.pairs('robinhood', grads.slice(0, 60));
    for (const address of grads) {
      const p = bestPair(pairs, 'robinhood', address);
      const v = num(p && p.liquidity && p.liquidity.usd);
      if (!(v > 0)) continue;
      lu.set(address, v);
      const c = hub.byKey(CHAIN, address);
      if (c && c.st && c.st.k === 'u') hub.setState(CHAIN, c.id, { ...c.st, lu: v });
    }
  }

  const loop = (fn, ms, what) => {
    let busy = false;
    const run = async () => {
      if (busy) return;
      busy = true;
      try {
        await fn();
      } catch (err) {
        fails += 1;
        if (fails <= 3 || fails % 20 === 0) log.warn(`clank.trade (${what}): ${errText(err)}`);
      } finally {
        busy = false;
        hub.judge(CHAIN, { connected: now() - okAt < Math.max(60_000, E.newest * 4), src: 'clank.trade',
          why: now() - okAt < Math.max(60_000, E.newest * 4) ? null : 'clank.trade not answering' });
      }
    };
    run();
    timers.push(setInterval(run, ms));
  };

  return {
    start() {
      loop(newest, E.newest, 'newest');
      loop(older, E.older, 'older');
      loop(trending, E.trending, 'trending');
      loop(liquidity, E.liquidity, 'liquidity');
    },
    stop() {
      for (const t of timers) clearInterval(t);
      timers.length = 0;
    },
    stats() {
      return { lastOkS: okAt ? Math.round((now() - okAt) / 1000) : -1, rates: Object.fromEntries(rates) };
    },
  };
}
