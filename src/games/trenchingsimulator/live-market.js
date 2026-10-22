// TRENCHING SIMULATOR's live market (2026-10-21, #404): the engine's market (./engine.js, made with `live: true`) with the
// live feed's coins in it (./live-feed.js). Every coin the feed knows comes in (its name, its picture, its market now and
// at its launch), every change moves it (on a live curve: somebody's trade), a coin the relay stops following is marked
// not live (orders on it wait: "stale"), and the feed's state says which coins the lists show: the real ones while the
// chain is live, or quiet with enough real coins live (./live-chains.js: playState, since 2026-10-21); real ones and
// made-up stand-ins while it's quiet with fewer; the stand-ins alone (and running) while the feed is down. The player's
// orders are the engine's own: play money against the live curve, never sent anywhere. The coins a player has open or
// holds are kept live for them (watch). Pure apart from the feed it's handed: read in Node too.
import { createMarket } from './engine.js';
import { toReal, parseDx, socialsOf, chainById, DEFAULT_CHAIN, playState } from './live-chains.js';

export function createLiveMarket({ feed, chain = DEFAULT_CHAIN, seed, solUsd = 150, startSol, config, wallNow = () => Date.now() } = {}) {
  const m = createMarket({ seed, solUsd, startSol, config, live: true });
  const ext = m.ext;
  const px = Number.isFinite(solUsd) && solUsd > 0 ? solUsd : 150;
  const ch = chainById(chain) || chainById(DEFAULT_CHAIN);
  const pair = ch.coin === 'sol' ? 'SOL' : ch.coin.toUpperCase();
  const t0 = wallNow() - m.t * 1000; // the page's clock (ms) when the market's clock read 0
  const at = (ms) => (Number.isFinite(ms) ? (ms - t0) / 1000 : m.t);
  const byRelay = new Map(); // the relay's id (this connection) → the market's
  const relayOf = new Map(); // the market's id → the relay's
  const sups = new Map(); // the market's id → its coin's supply
  const L = { focus: null, watchKey: null, watchAt: -Infinity, dead: false, seen: 0 };

  const feedLive = () => feed.status === 'live' && ['live', 'quiet'].includes(feed.chainState(chain));
  const realOf = (st, sup) => toReal(st, { sup, solUsd: px });

  function upsert(c) {
    if (!c) return null;
    const real = realOf(c.st, c.sup);
    if (!real) return null;
    if (c.dx) real.dx = parseDx(c.dx, px);
    let id = ext.byKey(c.key);
    const live = c.tracked && feedLive();
    if (id === null) {
      id = ext.add({ key: c.key, chain: ch.id, src: c.src, name: c.name, ticker: c.ticker, pic: c.pic ? feed.picUrl(c.pic) : null,
        by: c.by, born: at(c.born), socials: socialsOf(c.soc), pair, live, real, real0: c.st0 ? realOf(c.st0, c.sup) : null });
      if (id === null) return null;
      if (real.dx) ext.state(id, real);
      L.seen += 1;
    } else {
      ext.track(id, live);
      ext.state(id, real);
      if (c.pic) ext.pic(id, feed.picUrl(c.pic), socialsOf(c.soc));
    }
    const old = relayOf.get(id);
    if (old && old !== c.id) byRelay.delete(old);
    byRelay.set(c.id, id);
    relayOf.set(id, c.id);
    sups.set(id, c.sup);
    return id;
  }

  // the chain's state as the game plays it: quiet with enough real coins live plays as live
  const playing = () => playState(feed.chainState(chain), ext.liveCount());
  // which coins the lists show: live → the real ones (the stand-ins paused); quiet → both; down → the stand-ins
  function applyView() {
    const s = feed.status === 'live' ? playing() : null;
    const live = s === 'live';
    const quiet = s === 'quiet';
    ext.view({ ext: live || quiet, sim: !live, simPaused: live });
    if (!live && !quiet) for (const id of ext.ids()) ext.track(id, false);
  }

  // the market's clock kept with the page's while the feed talks (a hidden tab's frames stop; its feed doesn't)
  function catchUp() {
    const want = (wallNow() - t0) / 1000;
    if (want - m.t > 2) m.advanceTo(Math.min(want, m.t + 3600));
  }

  function onFeed(ev) {
    if (L.dead) return;
    if (['snap', 'coin', 'u', 'h'].includes(ev.type)) catchUp();
    switch (ev.type) {
      case 'status':
      case 'chains':
        applyView();
        break;
      case 'chain':
        byRelay.clear();
        relayOf.clear();
        applyView();
        break;
      case 'snap':
        for (const id of ext.ids()) ext.track(id, false);
        byRelay.clear();
        relayOf.clear();
        for (const c of ev.coins) upsert(c);
        applyView();
        watch(true);
        break;
      case 'coin':
        upsert(ev.coin);
        applyView(); // (enough real coins now, maybe)
        break;
      case 'u':
        for (const x of ev.u) {
          const id = byRelay.get(x.id);
          if (id === undefined) continue;
          const real = realOf(x.st, sups.get(id));
          if (!real) continue;
          if (x.dx) real.dx = parseDx(x.dx, px);
          ext.state(id, real);
        }
        break;
      case 'off':
        for (const rid of ev.ids) {
          const id = byRelay.get(rid);
          if (id !== undefined) ext.track(id, false);
        }
        applyView(); // (too few real coins now, maybe)
        break;
      case 'pic': {
        const id = byRelay.get(ev.id);
        if (id !== undefined) ext.pic(id, feed.picUrl(ev.pic), ev.soc !== null && ev.soc !== undefined ? socialsOf(ev.soc) : null);
        break;
      }
      case 'h': {
        const id = byRelay.get(ev.id);
        if (id === undefined) break;
        const sup = sups.get(id);
        ext.history(id, ev.h.map((p) => ({ t: at(p.at), real: realOf(p.st, sup) })).filter((p) => p.real));
        break;
      }
      default:
        break;
    }
  }

  // the coins kept live for this player: the one open, and the ones in its bag (at most 8)
  function watch(force = false) {
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
  applyView();

  const advanceTo = m.advanceTo;
  m.advanceTo = (t) => {
    const k = advanceTo(t);
    watch();
    return k;
  };
  // the coin the board has open (null: none)
  m.focus = (id) => {
    L.focus = Number.isInteger(id) && m.isExt(id) ? id : null;
    watch(true);
  };
  m.lookup = async (address) => {
    if (L.dead || typeof feed.lookup !== 'function') return null;
    const c = await feed.lookup(address);
    if (L.dead || !c) return null;
    const id = upsert(c);
    applyView();
    return id;
  };
  // how Live mode is going, for the screen: the feed's state, the chain's, and how many real coins came in
  m.liveState = () => ({ chain: ch.id, feed: feed.status, chainState: playing(), seen: L.seen, shown: ext.shown });
  // the real coins the player traded (for the results' words)
  m.liveTraded = () => m.positions().filter((p) => m.isExt(p.id) && p.buys > 0).length;
  m.destroy = () => {
    if (L.dead) return;
    L.dead = true;
    off();
    feed.watch([]);
  };
  return m;
}
