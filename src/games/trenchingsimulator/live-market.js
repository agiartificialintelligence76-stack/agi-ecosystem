// Live identities, local practice markets. A source quote seeds each real coin once; simulated crowd trades and
// player orders then share its local pool. Source metadata can update artwork and launch status, but cannot replace
// practice prices, volume or history. Imported coins keep trading through feed gaps; an empty feed stays empty.
import { createMarket } from './engine.js';
import { toReal, socialsOf, chainById, DEFAULT_CHAIN } from './live-chains.js';

// Source removals retain identity/history, but an indefinitely running discovery feed must not grow per-step work.
export const LIVE_PRACTICE_LIMIT = 300;
export const LIVE_PRACTICE_MAX_ADVANCE = 2;

export function createLiveMarket({ feed, chain = DEFAULT_CHAIN, seed, solUsd = 150, startSol, config, wallNow = () => Date.now() } = {}) {
  const m = createMarket({ seed, solUsd, startSol, config: { ...config, warmup: 0 }, live: true });
  const ext = m.ext;
  const px = Number.isFinite(solUsd) && solUsd > 0 ? solUsd : 150;
  const ch = chainById(chain) || chainById(DEFAULT_CHAIN);
  const pair = ch.coin === 'sol' ? 'SOL' : ch.coin.toUpperCase();
  const t0 = wallNow() - m.t * 1000; // the page's clock (ms) when the market's clock read 0
  const at = (ms) => (Number.isFinite(ms) ? (ms - t0) / 1000 : m.t);
  const byRelay = new Map(); // the relay's id (this connection) → the market's
  const relayOf = new Map(); // the market's id → the relay's
  const sups = new Map(); // the market's id → its coin's supply
  const L = { focus: null, watchKey: null, watchAt: -Infinity, activityAt: -Infinity, dead: false, seen: 0 };
  const recent = [];
  m.baseTime = t0;
  m.livePractice = true;
  ext.view({ ext: true, sim: false, simPaused: true });

  const sameChain = () => !feed.chain || feed.chain === ch.id;
  const feedLive = () => sameChain() && feed.status === 'live' && ['live', 'quiet'].includes(feed.chainState(ch.id));
  const realOf = (st, sup) => toReal(st, { sup, solUsd: px });
  const sourceTracked = new Map();
  function metadata(id, real = {}, identity = {}) {
    ext.metadata(id, { phase: real.phase, progress: real.progress, realSol: real.realSol, ...identity,
      metadataLive: sourceTracked.get(id) === true && feedLive() });
  }
  function activity(force = false) {
    if (!force && m.t - L.activityAt < 2) return;
    L.activityAt = m.t;
    ext.practiceActivity([...recent.map(c => c.id), ...(L.focus === null ? [] : [L.focus])]);
  }

  function upsert(c) {
    if (!c || !sameChain()) return null;
    const real = realOf(c.st, c.sup);
    if (!real) return null;
    let id = ext.byKey(c.key);
    if (id === null) {
      id = ext.add({ key: c.key, chain: ch.id, src: c.src, name: c.name, ticker: c.ticker, pic: c.pic ? feed.picUrl(c.pic) : null,
        by: c.by, born: at(c.born), socials: socialsOf(c.soc), pair, live: true, practice: true, real });
      if (id === null) return null;
      L.seen += 1;
      recent.push({ id, born: m.row(id).born });
      recent.sort((a, b) => b.born - a.born || b.id - a.id);
      if (recent.length > LIVE_PRACTICE_LIMIT) recent.length = LIVE_PRACTICE_LIMIT;
      activity(true);
    } else {
      if (c.pic) ext.pic(id, feed.picUrl(c.pic), socialsOf(c.soc));
    }
    sourceTracked.set(id, c.tracked === true);
    metadata(id, real, { name: c.name, ticker: c.ticker, by: c.by, src: c.src, socials: socialsOf(c.soc) });
    const old = relayOf.get(id);
    if (old && old !== c.id) byRelay.delete(old);
    byRelay.set(c.id, id);
    relayOf.set(id, c.id);
    sups.set(id, c.sup);
    return id;
  }

  const refreshSource = () => { for (const id of ext.ids()) metadata(id); };

  // the market's clock kept with the page's while the feed talks (a hidden tab's frames stop; its feed doesn't)
  function catchUp() {
    const want = (wallNow() - t0) / 1000;
    if (want - m.t > 2) m.advanceTo(want);
  }

  function onFeed(ev) {
    if (L.dead) return;
    if (!sameChain() && !['chain', 'status', 'chains'].includes(ev.type)) return;
    if (['snap', 'coin', 'u', 'h'].includes(ev.type)) catchUp();
    switch (ev.type) {
      case 'status':
      case 'chains':
        refreshSource();
        break;
      case 'chain':
        byRelay.clear();
        relayOf.clear();
        sourceTracked.clear();
        refreshSource();
        break;
      case 'snap':
        byRelay.clear();
        relayOf.clear();
        sourceTracked.clear();
        for (const c of ev.coins) upsert(c);
        refreshSource();
        watch(true);
        break;
      case 'coin':
        upsert(ev.coin);
        break;
      case 'u':
        for (const x of ev.u) {
          const id = byRelay.get(x.id);
          if (id === undefined) continue;
          const real = realOf(x.st, sups.get(id));
          if (!real) continue;
          metadata(id, real);
        }
        break;
      case 'off':
        for (const rid of ev.ids) {
          const id = byRelay.get(rid);
          if (id !== undefined) { sourceTracked.set(id, false); metadata(id); }
        }
        break;
      case 'pic': {
        const id = byRelay.get(ev.id);
        if (id !== undefined) ext.pic(id, feed.picUrl(ev.pic), ev.soc !== null && ev.soc !== undefined ? socialsOf(ev.soc) : null);
        break;
      }
      // Source history remains in the feed; it is not a local practice trade or a correction to the player's chart.
      case 'h': break;
      default:
        break;
    }
  }

  // the coins kept live for this player: the one open, and the ones in its bag (at most 8)
  function watch(force = false) {
    if (L.dead || !sameChain()) return;
    const t = wallNow();
    if (!force && t - L.watchAt < 2000) return;
    L.watchAt = t;
    const want = [];
    const add = (id) => {
      const rid = relayOf.get(id);
      if (rid && !want.includes(rid) && want.length < 8) want.push(rid);
    };
    if (L.focus !== null) add(L.focus);
    for (const p of m.positions()) if (p.open && m.isExt(p.id)) add(p.id);
    const key = want.join(',');
    if (!force && key === L.watchKey) return;
    L.watchKey = key;
    feed.watch(want);
  }

  const off = feed.on(onFeed);
  for (const c of feed.coins()) upsert(c);

  const advanceTo = m.advanceTo;
  m.advanceTo = (t) => {
    const target = Number(t);
    if (!Number.isFinite(target)) return 0;
    const budgetEnd = m.t + LIVE_PRACTICE_MAX_ADVANCE;
    const k = advanceTo(Math.min(target, budgetEnd));
    // Hidden pages may return hours later. Settle pending fills, then leave an honest gap rather than running
    // thousands of unseen crowd steps or backdating newly discovered source coins into the old market clock.
    if (target > budgetEnd) ext.practiceSkipTo(target);
    activity();
    watch();
    return k;
  };
  // the coin the board has open (null: none)
  m.focus = (id) => {
    L.focus = Number.isInteger(id) && m.isExt(id) ? id : null;
    activity(true);
    watch(true);
  };
  m.lookup = async (address) => {
    if (L.dead || !sameChain() || typeof feed.lookup !== 'function') return null;
    const c = await feed.lookup(address);
    if (L.dead || !c) return null;
    const id = upsert(c);
    return id;
  };
  // how Live mode is going, for the screen: the feed's state, the chain's, and how many real coins came in
  m.liveState = () => ({ chain: ch.id, feed: feed.status, chainState: feed.chainState(ch.id), seen: L.seen,
    practice: true, shown: ext.shown });
  // the real coins the player traded (for the results' words)
  m.liveTraded = () => m.positions().filter((p) => m.isExt(p.id) && p.buys > 0).length;
  m.destroy = () => {
    if (L.dead) return;
    L.dead = true;
    off();
    if (sameChain()) feed.watch([]);
  };
  return m;
}
