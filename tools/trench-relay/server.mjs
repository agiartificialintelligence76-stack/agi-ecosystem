#!/usr/bin/env node
// AGI-1's trench relay (2026-10-21, #404): TRENCHING SIMULATOR's Live mode. Real new coins (their real names and
// pictures) for the game's play-money trades, from one connection per source on the owner's server, fanned out to every
// browser at wss://live.agi1.app/ws (Caddy in front of it: automatic HTTPS). Nothing here ever buys, sells or signs
// anything: it only reads public market data and pictures, and the browsers only read from it.
//
//   GET /health          JSON: each chain's state, viewers, sources, pictures, prices (never a key or a viewer)
//   GET /p/<hash>.webp   a coin's picture, made small by us (pictures.mjs)
//   GET /ws (WebSocket)  the feed (hub.mjs), only from the site's own pages (their Origin), within the caps
//   GET /room (WebSocket) race rooms (2026-10-22, rooms.mjs): the same made-up market for everyone in a room, its
//                        standings; its own caps, so a race never takes a Live viewer's seat
//
// Its settings: /opt/agi1-trench/trench.env on the server (trench.env.example), read by relay.sh. Run here with
// `node tools/trench-relay/server.mjs` (the same variables in the environment).
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { readConfig } from './lib/config.mjs';
import { createLog, errText } from './lib/log.mjs';
import { createHub } from './lib/hub.mjs';
import { createRooms, ROOMS } from './lib/rooms.mjs';
import { createPictures, HASH } from './lib/pictures.mjs';
import { createHelius } from './lib/sources/helius.mjs';
import { createPumpSource } from './lib/sources/pump.mjs';
import { createDex } from './lib/sources/dex.mjs';
import { createClank } from './lib/sources/clank.mjs';
import { trustedJson, trustedGet, safeGet } from './lib/net.mjs';

const SEC = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' };

// `timing` and the fetchers are for the tests (small waits, fake services); the server itself uses the defaults
export async function startRelay(cfg, { log, problems = [], WS = WebSocket, sharp = null, timing = {}, fetchJson = trustedJson,
  fetchTrusted = trustedGet, fetchSafe = safeGet, now = Date.now } = {}) {
  const T = { batchMs: 500, pingMs: 25000, upstreamPingMs: 30000, backoff: {}, picRetryMs: [15_000, 60_000], resyncMs: 2000,
    dex: {}, clank: {}, checkMs: 5000, takeoverMs: 90_000, roomTickMs: 1000, rooms: {}, ...timing };
  const sh = sharp || (await import('sharp')).default;
  try {
    sh.concurrency(1); // the server's two cores are her live show's too
    sh.cache(false);
  } catch {
    // a stand-in sharp
  }
  const started = now();
  let pump = null;
  let clank = null;
  const hub = createHub({ log, chains: cfg.chains, batchMs: T.batchMs, pingMs: T.pingMs, now,
    onWatch: (chain, coin, on) => {
      if (chain === 'solana' && pump) pump.onWatch(coin, on);
      if (chain === 'robinhood' && clank) clank.onWatch(coin, on);
      if (on && coin.extra.dex) hub.setTracked(chain, coin.id, true);
    },
    onLookup: async (chain, address) => {
      // A pump curve may already be retained here but be older than the browser's recent snapshot; it has no DEX
      // pool yet. Opening the returned coin watches its actual curve source again.
      const known = hub.byKey(chain, address);
      if (chain === 'solana' && known && !known.extra.dex) return known;
      if (chain === 'robinhood' && clank) {
        try {
          const c = await clank.lookup(address);
          if (c) return c;
        } catch (err) {
          log.warn(`clank.trade (lookup): ${errText(err)}`);
        }
      }
      return dex.lookup(chain, address);
    } });
  const pictures = createPictures({ gateways: cfg.gateways, log, sharp: sh, fetchSafe, fetchTrusted,
    maxBytes: cfg.picCacheMb * 1024 * 1024, retryMs: T.picRetryMs, now });
  const dex = createDex({ cfg, hub, pictures, log, fetchJson, now, every: T.dex });
  let helius = null;
  if (cfg.chains.includes('solana')) {
    if (cfg.helius) {
      helius = createHelius({ ws: cfg.helius.ws, http: cfg.helius.http, log, WS, fetchJson, now, pingMs: T.upstreamPingMs,
        backoff: T.backoff, resyncMs: T.resyncMs, maxSubs: cfg.solanaTrack + cfg.watchMax,
        onState: (id, st) => pump && pump.onCurve(id, st) });
    }
    pump = createPumpSource({ cfg, hub, helius, dex, pictures, log, WS, now, checkMs: T.checkMs, takeoverMs: T.takeoverMs,
      upstream: { pingMs: T.upstreamPingMs, backoff: T.backoff } });
  }
  if (cfg.chains.includes('robinhood')) clank = createClank({ cfg, hub, pictures, dex, log, fetchJson, now, every: T.clank });
  // race rooms (off: TRENCH_ROOMS=off); SOL's price for a race is the hub's (DexScreener's), the same for everyone in it
  const rooms = cfg.rooms ? createRooms({ log, now, pingMs: T.pingMs, tickMs: T.roomTickMs, limits: { ...cfg.rooms, ...T.rooms },
    price: () => (hub.px && hub.px.sol > 0 ? hub.px.sol : 150) }) : null;

  // ---------- requests ----------
  const perIp = new Map();
  const picHits = new Map();
  const ipOf = (req) => {
    if (cfg.trustProxy) {
      const xff = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
      if (xff.length) return xff[xff.length - 1].slice(0, 64);
    }
    return String(req.socket.remoteAddress || '?');
  };
  const picOk = (ip) => {
    const t = now();
    const h = picHits.get(ip);
    if (!h || t - h.at > 60_000) {
      picHits.set(ip, { at: t, n: 1 });
      if (picHits.size > 50_000) picHits.clear();
      return true;
    }
    h.n += 1;
    return h.n <= 900;
  };

  function health() {
    const st = hub.stats();
    const px = hub.px;
    return {
      ok: true, service: 'agi1-trench-relay', version: 1, up: Math.round((now() - started) / 1000),
      clients: st.clients, maxClients: cfg.maxClients, watched: st.watched,
      chains: Object.fromEntries(Object.entries(st.chains).map(([k, v]) => [k, { ...v, ...(hub.state(k) || {}) }])),
      solana: pump ? pump.stats() : null,
      robinhood: clank ? clank.stats() : null,
      dexscreener: dex.stats(),
      pictures: pictures.stats(),
      prices: px ? { ...px, ageS: Math.round((now() - hub.pxAt) / 1000) } : null,
      sent: { messages: st.sent, lagged: st.lagged, resnapshots: st.resnaps, droppedSlow: st.closedSlow, droppedSpam: st.closedSpam },
      rooms: rooms ? rooms.stats() : null,
      problems,
    };
  }

  const server = http.createServer((req, res) => {
    let path;
    try {
      path = new URL(req.url || '/', 'http://relay').pathname;
    } catch {
      path = '/';
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { ...SEC, Allow: 'GET, HEAD', 'Content-Type': 'text/plain' });
      res.end('method not allowed');
      return;
    }
    if (path === '/health') {
      const body = JSON.stringify(health());
      res.writeHead(200, { ...SEC, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*', 'Content-Security-Policy': "default-src 'none'" });
      res.end(req.method === 'HEAD' ? undefined : body);
      return;
    }
    const m = /^\/p\/([A-Za-z0-9_-]{22})\.webp$/.exec(path);
    if (m && HASH.test(m[1])) {
      if (!picOk(ipOf(req))) {
        res.writeHead(429, { ...SEC, 'Content-Type': 'text/plain', 'Retry-After': '30', 'Cache-Control': 'no-store' });
        res.end('slow down');
        return;
      }
      const b = pictures.get(m[1]);
      if (!b) {
        res.writeHead(404, { ...SEC, 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
        res.end('no such picture');
        return;
      }
      res.writeHead(200, { ...SEC, 'Content-Type': 'image/webp', 'Content-Length': b.length,
        'Cache-Control': 'public, max-age=604800, immutable', ETag: `"${m[1]}"`, 'Cross-Origin-Resource-Policy': 'cross-origin',
        'Content-Security-Policy': "default-src 'none'" });
      res.end(req.method === 'HEAD' ? undefined : b);
      return;
    }
    res.writeHead(404, { ...SEC, 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    res.end('not found');
  });
  server.headersTimeout = 15_000;
  server.requestTimeout = 20_000;
  server.keepAliveTimeout = 30_000;

  const wss = new WebSocketServer({ noServer: true, maxPayload: 2048, perMessageDeflate: false, clientTracking: false });
  // race rooms' own door (1 KB a message) and their own count per address
  const rwss = new WebSocketServer({ noServer: true, maxPayload: ROOMS.maxMsgBytes, perMessageDeflate: false, clientTracking: false });
  const roomIp = new Map();
  let busyNow = 0;
  server.on('upgrade', (req, socket, head) => {
    const no = (code, text) => {
      try {
        socket.write(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\nContent-Type: text/plain\r\nContent-Length: ${text.length}\r\n\r\n${text}`);
      } catch {
        // gone already
      }
      socket.destroy();
    };
    let path;
    try {
      path = new URL(req.url || '/', 'http://relay').pathname;
    } catch {
      path = '/';
    }
    if (path === '/room') return roomDoor(req, socket, head, no);
    if (path !== '/ws') return no(404, 'Not Found');
    if (!cfg.origins.includes(String(req.headers.origin || ''))) return no(403, 'Forbidden');
    // full: let it in only to say so (1013, "try again later": a browser can't read an HTTP status here), then close
    if (hub.clients >= cfg.maxClients) {
      if (busyNow >= 50) return no(503, 'Busy');
      busyNow += 1;
      try {
        wss.handleUpgrade(req, socket, head, (ws) => {
          ws.on('close', () => {
            busyNow -= 1;
          });
          ws.close(1013, 'busy');
        });
      } catch {
        busyNow -= 1;
        socket.destroy();
      }
      return undefined;
    }
    const ip = ipOf(req);
    if ((perIp.get(ip) || 0) >= cfg.maxPerIp) return no(429, 'Too Many');
    perIp.set(ip, (perIp.get(ip) || 0) + 1);
    let counted = true;
    const release = () => {
      if (!counted) return;
      counted = false;
      const n = (perIp.get(ip) || 1) - 1;
      if (n > 0) perIp.set(ip, n);
      else perIp.delete(ip);
    };
    socket.on('close', release);
    try {
      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.on('close', release);
        hub.attach(ws);
      });
    } catch (err) {
      release();
      log.warn(`a viewer couldn't connect (${errText(err)})`);
      socket.destroy();
    }
    return undefined;
  });
  // a race room's connection: the site's own pages only, within the rooms' caps (all players, and per address)
  function roomDoor(req, socket, head, no) {
    if (!rooms) return no(404, 'Not Found');
    if (!cfg.origins.includes(String(req.headers.origin || ''))) return no(403, 'Forbidden');
    if (rooms.players >= cfg.rooms.maxPlayers) return no(503, 'Busy');
    const ip = ipOf(req);
    if ((roomIp.get(ip) || 0) >= cfg.rooms.perIp) return no(429, 'Too Many');
    roomIp.set(ip, (roomIp.get(ip) || 0) + 1);
    let counted = true;
    const release = () => {
      if (!counted) return;
      counted = false;
      const n = (roomIp.get(ip) || 1) - 1;
      if (n > 0) roomIp.set(ip, n);
      else roomIp.delete(ip);
    };
    socket.on('close', release);
    try {
      rwss.handleUpgrade(req, socket, head, (ws) => {
        ws.on('close', release);
        rooms.attach(ws, ip);
      });
    } catch (err) {
      release();
      log.warn(`a racer couldn't connect (${errText(err)})`);
      socket.destroy();
    }
    return undefined;
  }
  server.on('clientError', (_err, socket) => {
    try {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    } catch {
      // gone already
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(cfg.port, cfg.host, resolve);
  });
  const port = server.address().port;
  log.info(`relay listening on ${cfg.host}:${port} · chains: ${cfg.chains.join(', ')} · Helius ${helius ? 'on' : 'off'}`);
  for (const p of problems) log.warn(p);

  dex.start();
  if (pump) pump.start();
  if (clank) clank.start();
  for (const c of cfg.chains) if (c === 'solana' && !helius) hub.setStatus('solana', 'off', { why: 'no Helius key' });

  let closed = false;
  return {
    port,
    hub,
    rooms,
    pictures,
    pump,
    clank,
    dex,
    helius,
    health,
    async close() {
      if (closed) return;
      closed = true;
      if (pump) pump.stop();
      if (clank) clank.stop();
      dex.stop();
      pictures.close();
      hub.close();
      if (rooms) rooms.close();
      await new Promise((r) => server.close(() => r()));
      server.closeAllConnections?.();
    },
  };
}

async function main() {
  const { cfg, problems, secrets } = readConfig(process.env);
  const log = createLog({ secrets, level: cfg.logLevel });
  process.on('uncaughtException', (err) => {
    log.error(`unexpected: ${errText(err)}`);
  });
  process.on('unhandledRejection', (err) => {
    log.error(`unexpected: ${errText(err)}`);
  });
  let relay;
  try {
    relay = await startRelay(cfg, { log, problems });
  } catch (err) {
    log.error(`the relay couldn't start: ${errText(err)}`);
    process.exit(1);
  }
  const stop = async (sig) => {
    log.info(`${sig}: stopping`);
    const force = setTimeout(() => process.exit(0), 8000);
    force.unref();
    await relay.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
