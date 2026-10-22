// Solana's new coins (2026-10-21, #404): pump.fun launches from PumpPortal's free WebSocket (one connection, as
// PumpPortal asks: new coins and migrations), PumpDev's when PumpPortal stops sending (it takes over after 90 s without
// a new coin, and stops again once PumpPortal is back; from the start with PumpPortal off in the settings,
// PUMPPORTAL_WS_URL=off), their curves live from Helius (the newest `track` coins, plus the
// ones viewers have open or hold), and after a coin's curve sells out, its pool's numbers from DexScreener (dex.mjs).
// Each new coin's picture from its metadata (pictures.mjs).
import { createUpstream } from '../upstream.mjs';
import { parseCreate, parseMigrate } from '../parse.mjs';

const CHAIN = 'solana';

export function createPumpSource({ cfg, hub, helius, dex, pictures, log, WS, now = Date.now, upstream = {}, checkMs = 5000,
  takeoverMs = 90_000 }) {
  let lastPrimary = 0;
  let lastBackup = 0;
  let startedAt = 0;
  let creates = 0;
  let skipped = 0;
  let migrations = 0;
  let checkT = null;

  const handle = (from) => (text) => {
    let m;
    try {
      m = JSON.parse(text);
    } catch {
      return;
    }
    if (!m || typeof m !== 'object') return;
    if (m.txType === 'create') {
      const c = parseCreate(m);
      if (!c) {
        skipped += 1;
        return;
      }
      if (from === 'primary') lastPrimary = now();
      else lastBackup = now();
      add(c);
      return;
    }
    if (m.txType === 'migrate') {
      const x = parseMigrate(m);
      if (x) migrating(x.mint);
    }
  };

  // PumpPortal off in the settings (PUMPPORTAL_WS_URL=off): PumpDev alone, from the start
  const primary = cfg.pumpportal ? createUpstream({ name: 'PumpPortal', url: cfg.pumpportal, log, WS, silenceMs: 180_000,
    ...upstream,
    onOpen: (u) => {
      u.send({ method: 'subscribeNewToken' });
      u.send({ method: 'subscribeMigration' });
    },
    onMessage: handle('primary') }) : null;
  const backup = cfg.pumpdev ? createUpstream({ name: 'PumpDev', url: cfg.pumpdev, log, WS, silenceMs: 180_000, ...upstream,
    onOpen: (u) => u.send({ method: 'subscribeNewToken' }),
    onMessage: handle('backup') }) : null;

  function add(c) {
    if (hub.byKey(CHAIN, c.mint)) return;
    creates += 1;
    // its state is its launch's, just now: live at once while Helius follows it (by its address)
    const followed = Boolean(helius && helius.track(c.mint, c.curve));
    const id = hub.addCoin(CHAIN, { key: c.mint, name: c.name, symbol: c.symbol, born: now(), by: c.creator, src: 'pump.fun',
      sup: c.st.sup, st: c.st, st0: c.st, tracked: followed, extra: { curve: c.curve } });
    if (!id) {
      if (followed) helius.untrack(c.curve);
      return;
    }
    trim();
    // the chain's word at once when it wasn't live (its first coin, or after a quiet spell)
    const st = hub.state(CHAIN);
    if (st && st.s !== 'live') check();
    if (c.uri) {
      pictures.request(`${CHAIN}:${id}`, { meta: c.uri }, (path, soc) => {
        if (path) hub.setPic(CHAIN, id, path, soc);
      });
    }
  }

  // the newest `solanaTrack` coins (and the watched ones) followed; older ones let go
  function trim() {
    if (!helius) return;
    const list = hub.coins(CHAIN).sort((a, b) => b.born - a.born);
    let kept = 0;
    for (const c of list) {
      if (!c.tracked || c.extra.migrating || c.extra.dex) continue;
      kept += 1;
      if (kept > cfg.solanaTrack && c.watchers === 0) {
        helius.untrack(c.extra.curve);
        hub.setTracked(CHAIN, c.id, false);
      }
    }
  }

  // Helius: a curve's new state (the coin by its address)
  function onCurve(mint, st) {
    const c = hub.byKey(CHAIN, mint);
    if (!c || c.extra.migrating) return;
    hub.setState(CHAIN, c.id, st);
    if (!c.tracked) hub.setTracked(CHAIN, c.id, true);
    if (st.done) migrating(mint);
  }

  // its curve sold out: closed (its last state, done) while its pool opens, then followed on DexScreener
  function migrating(mint) {
    const c = hub.byKey(CHAIN, mint);
    if (!c || c.extra.migrating || c.extra.dex) return;
    c.extra.migrating = true;
    migrations += 1;
    if (c.st && c.st.k === 'c' && !c.st.done) hub.setState(CHAIN, c.id, { ...c.st, done: true });
    if (helius) helius.untrack(c.extra.curve);
    if (dex) dex.followSolPool(c.id, mint);
  }

  // a viewer opened (or let go of) a coin: followed while anyone watches it
  function onWatch(c, on) {
    if (c.extra.migrating || c.extra.dex) return;
    if (on) {
      if (!c.tracked && helius) helius.track(c.key, c.extra.curve); // live again with its next state (read at once)
      return;
    }
    trim();
  }

  function check() {
    const t = now();
    const primaryOk = lastPrimary > 0 && t - lastPrimary < takeoverMs;
    if (backup) {
      if (!primary && !backup.running) {
        log.info('PumpPortal is off in the settings: PumpDev sends the new coins');
        backup.start();
      } else if (primary && !primaryOk && !backup.running && t - startedAt > takeoverMs) {
        log.warn('PumpPortal isn\'t sending new coins: PumpDev takes over');
        backup.start();
      } else if (primaryOk && backup.running && t - lastPrimary < checkMs * 2) {
        log.info('PumpPortal is sending again: PumpDev stops');
        backup.stop();
      }
    }
    const backupOk = Boolean(backup && backup.running && lastBackup > 0 && t - lastBackup < takeoverMs);
    if (!helius) {
      hub.setStatus(CHAIN, 'off', { src: null, why: 'no Helius key' });
      return;
    }
    const feeding = primaryOk || backupOk || Boolean(primary && primary.connected) || Boolean(backup && backup.connected);
    hub.judge(CHAIN, { connected: feeding && helius.connected, src: primaryOk ? 'PumpPortal' : backupOk ? 'PumpDev' : null,
      why: !helius.connected ? 'Helius not connected' : !feeding ? 'no new-coin feed' : null });
  }

  return {
    start() {
      startedAt = now();
      if (primary) primary.start();
      if (helius) helius.start();
      checkT = setInterval(check, checkMs);
      check();
    },
    stop() {
      clearInterval(checkT);
      if (primary) primary.stop();
      if (backup) backup.stop();
      if (helius) helius.stop();
    },
    onCurve,
    onWatch,
    stats() {
      const t = now();
      return {
        pumpportal: primary ? { connected: primary.connected, lastCoinS: lastPrimary ? Math.round((t - lastPrimary) / 1000) : -1 }
          : null,
        pumpdev: backup ? { running: backup.running, connected: backup.connected,
          lastCoinS: lastBackup ? Math.round((t - lastBackup) / 1000) : -1 } : null,
        helius: helius ? { connected: helius.connected, following: helius.following, live: helius.active } : null,
        creates, skipped, migrations,
      };
    },
    primary,
    backup,
  };
}
