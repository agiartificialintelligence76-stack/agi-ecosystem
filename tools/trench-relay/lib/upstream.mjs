// One connection to an outside WebSocket (2026-10-21, #404): PumpPortal, PumpDev or Helius. It reconnects by itself,
// waiting longer after each failure (1 s, 2 s, 4 s … at most a minute, a little random so a restart never hammers
// anyone), counted afresh after a minute that worked; pings now and then and starts again when a ping goes unanswered
// (or, with `silenceMs`, when nothing has come for that long). Its address may carry a key: it's never logged.
import { WebSocket } from 'ws';
import { errText } from './log.mjs';

export function backoffMs(failures, { base = 1000, max = 60000, rand = Math.random } = {}) {
  const n = Math.max(1, Math.floor(failures) || 1);
  const exp = Math.min(max, base * 2 ** Math.min(20, n - 1));
  return Math.max(1, Math.round(exp * (0.8 + 0.4 * rand())));
}

export function createUpstream({ name, url, log, onOpen = null, onMessage = () => {}, onDown = null, WS = WebSocket,
  pingMs = 30000, silenceMs = 0, stableMs = 60000, backoff = {}, now = Date.now, headers = {} }) {
  let ws = null;
  let stopped = true;
  let failures = 0;
  let retryT = null;
  let pingT = null;
  let stableT = null;
  let alive = true;
  let connected = false;
  let lastMsg = 0;
  let opened = 0;
  let downs = 0;

  function clearTimers() {
    clearTimeout(retryT);
    clearInterval(pingT);
    clearTimeout(stableT);
    retryT = null;
    pingT = null;
    stableT = null;
  }

  function connect() {
    if (stopped) return;
    let sock;
    try {
      sock = new WS(typeof url === 'function' ? url() : url, { handshakeTimeout: 10000, perMessageDeflate: false,
        maxPayload: 8 * 1024 * 1024, headers: { 'User-Agent': 'AGI1TrenchRelay/1.0', ...headers } });
    } catch (err) {
      log.warn(`${name}: can't connect (${errText(err)})`);
      retry();
      return;
    }
    ws = sock;
    sock.on('open', () => {
      if (ws !== sock) return;
      connected = true;
      opened += 1;
      alive = true;
      lastMsg = now();
      log.info(`${name}: connected`);
      stableT = setTimeout(() => {
        failures = 0;
      }, stableMs);
      pingT = setInterval(tick, pingMs);
      if (onOpen) {
        try {
          onOpen(api);
        } catch (err) {
          log.warn(`${name}: ${errText(err)}`);
        }
      }
    });
    sock.on('message', (data, binary) => {
      if (ws !== sock) return;
      lastMsg = now();
      if (binary) return;
      try {
        onMessage(String(data));
      } catch (err) {
        log.warn(`${name}: a message it sent couldn't be read (${errText(err)})`);
      }
    });
    sock.on('pong', () => {
      alive = true;
    });
    sock.on('error', (err) => {
      if (ws === sock) log.warn(`${name}: ${errText(err)}`);
    });
    sock.on('close', (code) => {
      if (ws !== sock) return;
      ws = null;
      const was = connected;
      connected = false;
      clearTimers();
      if (was) {
        downs += 1;
        log.warn(`${name}: disconnected (${code})`);
        if (onDown) {
          try {
            onDown();
          } catch {
            // its owner's trouble, never this connection's
          }
        }
      }
      retry();
    });
  }

  function tick() {
    if (!ws || !connected) return;
    if (!alive) {
      log.warn(`${name}: no answer to a ping: connecting again`);
      ws.terminate();
      return;
    }
    if (silenceMs && now() - lastMsg > silenceMs) {
      log.warn(`${name}: nothing for ${Math.round((now() - lastMsg) / 1000)} s: connecting again`);
      ws.terminate();
      return;
    }
    alive = false;
    try {
      ws.ping();
    } catch {
      // the close event follows
    }
  }

  function retry() {
    if (stopped) return;
    failures += 1;
    const ms = backoffMs(failures, backoff);
    if (failures <= 3 || failures % 10 === 0) log.info(`${name}: trying again in ${Math.max(1, Math.round(ms / 1000))} s`);
    retryT = setTimeout(connect, ms);
  }

  const api = {
    name,
    start() {
      if (!stopped) return;
      stopped = false;
      connect();
    },
    stop() {
      stopped = true;
      clearTimers();
      const s = ws;
      ws = null;
      connected = false;
      if (s) {
        try {
          s.terminate();
        } catch {
          // gone already
        }
      }
    },
    send(obj) {
      if (!ws || !connected || ws.readyState !== 1) return false;
      try {
        ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj));
        return true;
      } catch {
        return false;
      }
    },
    // for its tests: the connection itself
    get socket() {
      return ws;
    },
    get connected() {
      return connected;
    },
    get running() {
      return !stopped;
    },
    get failures() {
      return failures;
    },
    get lastMessageAt() {
      return lastMsg;
    },
    get opens() {
      return opened;
    },
    get downs() {
      return downs;
    },
  };
  return api;
}
