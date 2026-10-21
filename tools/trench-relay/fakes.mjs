// Stand-ins for the relay's outside services (2026-10-21, #404), on this computer only: PumpPortal and PumpDev (their
// WebSocket, new coins and migrations), Helius (its WebSocket's accountSubscribe and its JSON-RPC getMultipleAccounts,
// behind a key), DexScreener (prices, pairs, profiles), clank.trade's API and an IPFS gateway (metadata and pictures).
// For tests/trench-live.test.js and the local end-to-end run: `node tools/trench-relay/fakes.mjs` starts them and prints
// the settings that point the relay at them. Every coin here is made up.
import http from 'node:http';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import { PUMP_PROGRAM, CURVE_DISC, PUMP, WSOL, WRAPPED } from './lib/parse.mjs';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
// a made-up base58 string of `len` characters from a text (the same text, the same string)
export function b58From(text, len) {
  let out = '';
  let i = 0;
  while (out.length < len) {
    const h = createHash('sha256').update(`${text}␟${i++}`).digest();
    for (const byte of h) {
      if (out.length >= len) break;
      out += B58[byte % 58];
    }
  }
  return out;
}
export const cidFrom = (text) => `Qm${b58From(`cid:${text}`, 44)}`;
export const mintFrom = (text) => `${b58From(`mint:${text}`, 40)}pump`;
const evmFrom = (text) => `0x${createHash('sha256').update(`evm:${text}`).digest('hex').slice(0, 40)}`;

// a pump.fun bonding-curve account's bytes (base64) for a state
export function curveAccount({ vt, vs, rt, rs, sup = PUMP.supply, done = false }) {
  const b = Buffer.alloc(8 + 40 + 1 + 32);
  Buffer.from(CURVE_DISC).copy(b, 0);
  b.writeBigUInt64LE(BigInt(Math.round(vt * 1e6)), 8);
  b.writeBigUInt64LE(BigInt(Math.round(vs * 1e9)), 16);
  b.writeBigUInt64LE(BigInt(Math.round(rt * 1e6)), 24);
  b.writeBigUInt64LE(BigInt(Math.round(rs * 1e9)), 32);
  b.writeBigUInt64LE(BigInt(Math.round(sup * 1e6)), 40);
  b[48] = done ? 1 : 0;
  return b.toString('base64');
}

// a coin's picture: a colored square with its first letter (PNG, made by sharp from a little drawing of ours)
async function picture(sharp, letter, hue) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="hsl(${hue},70%,45%)"/>`
    + `<circle cx="128" cy="128" r="84" fill="hsl(${(hue + 180) % 360},80%,70%)"/>`
    + `<text x="128" y="160" font-size="96" font-family="sans-serif" font-weight="700" text-anchor="middle" fill="#111">${letter}</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function startFakes({ key = 'fake-helius-key-1234567890', host = '127.0.0.1', port = 0, prices = { sol: 150, eth: 3000, bnb: 600 } } = {}) {
  const sharp = (await import('sharp')).default;
  const files = new Map(); // ipfs id → { type, body, status }
  const pump = new Map(); // mint → { curveKey, st, name, symbol, migrated, pool }
  const accounts = new Map(); // curve key → mint
  const evm = { bsc: new Map(), base: new Map(), robinhood: new Map() };
  const profiles = [];
  const clankCoins = [];
  const seen = { http: [], pumpportal: [], pumpdev: [], helius: [] };
  const down = { pumpportal: false, pumpdev: false, helius: false, dexscreener: false, clank: false, ipfs: false };
  const conns = { pumpportal: new Set(), pumpdev: new Set(), helius: new Set() };
  const heliusSubs = new Map(); // ws → Map(subId → account)
  let subSeq = 100;
  let slot = 1000;
  let n = 0;

  // ---------- HTTP ----------
  const json = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const pairFor = (chain, address) => {
    if (chain === 'solana') {
      for (const [w, v] of Object.entries(WRAPPED)) {
        if (v.chain === 'solana' && v.address === address) {
          return { chainId: 'solana', dexId: 'raydium', baseToken: { address, symbol: 'SOL', name: 'Wrapped SOL' },
            quoteToken: { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC' }, priceUsd: String(prices[w]),
            liquidity: { usd: 5e7, base: 1e5, quote: 1.5e7 } };
        }
      }
      const c = pump.get(address);
      if (!c || !c.pool) return null;
      const price = c.pool.ls / c.pool.lb;
      return { chainId: 'solana', dexId: 'pumpswap', pairAddress: b58From(`pair:${address}`, 44),
        baseToken: { address, name: c.name, symbol: c.symbol }, quoteToken: { address: WSOL, symbol: 'SOL' },
        priceNative: String(price), priceUsd: String(price * prices.sol), liquidity: { usd: c.pool.ls * prices.sol * 2,
          base: c.pool.lb, quote: c.pool.ls }, marketCap: price * prices.sol * 1e9, fdv: price * prices.sol * 1e9,
        volume: { m5: 1200, h1: 9000, h24: 40000 }, txns: { m5: { buys: 12, sells: 7 }, h1: { buys: 80, sells: 60 },
          h24: { buys: 400, sells: 300 } }, priceChange: { m5: 4.2, h1: -3.5 }, pairCreatedAt: c.poolAt };
    }
    const lowerAddr = address.toLowerCase();
    for (const [w, v] of Object.entries(WRAPPED)) {
      if (v.chain === chain && v.address === lowerAddr) {
        return { chainId: chain, dexId: 'uniswap', baseToken: { address: v.address, symbol: w.toUpperCase() },
          quoteToken: { address: '0xusdc', symbol: 'USDC' }, priceUsd: String(prices[w]), liquidity: { usd: 9e7 } };
      }
    }
    const c = evm[chain] && evm[chain].get(lowerAddr);
    if (!c) return null;
    return { chainId: chain, dexId: c.dexId, baseToken: { address: lowerAddr, name: c.name, symbol: c.symbol },
      quoteToken: { address: '0xquote', symbol: chain === 'bsc' ? 'WBNB' : 'WETH' }, priceUsd: String(c.mu / 1e9),
      marketCap: c.mu, fdv: c.mu, liquidity: { usd: c.lu }, pairCreatedAt: c.created, info: c.icon ? { imageUrl: c.icon } : {},
      volume: { m5: 500, h1: 4000, h24: 20000 }, txns: { m5: { buys: 5, sells: 3 } }, priceChange: { m5: 1.5, h1: 10 } };
  };

  function clankAnswer(names, input) {
    const out = [];
    names.forEach((name, i) => {
      const arg = (input && input[i]) || {};
      if (name === 'coins.list') {
        const all = clankCoins.slice().sort((a, b) => b.createdAt - a.createdAt);
        const start = arg.cursor ? Number(String(arg.cursor).replace('c', '')) : 0;
        const page = all.slice(start, start + 12);
        out.push({ result: { data: { coins: page, nextCursor: start + 12 < all.length ? `c${start + 12}` : null } } });
      } else if (name === 'exchangeRates.tokenUsdg') {
        out.push({ result: { data: { price: arg.token === '0x0000000000000000000000000000000000000000' ? prices.eth : 160 } } });
      } else if (name === 'coins.trending') {
        out.push({ result: { data: clankCoins.slice(0, 3).map((c) => ({ address: c.address, marketCapUsdg: c.marketCap * prices.eth,
          isLive: c.state === 3 })) } });
      } else out.push({ error: { data: { httpStatus: 404 } } });
    });
    return out;
  }

  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://fake');
    seen.http.push(`${req.method} ${u.pathname}`);
    if (seen.http.length > 5000) seen.http.splice(0, 2500);
    // Helius JSON-RPC
    if (req.method === 'POST' && u.pathname === '/') {
      if (u.searchParams.get('api-key') !== key || down.helius) return json(res, 401, { jsonrpc: '2.0', error: { code: 401, message: 'invalid api key' } });
      let body = '';
      req.on('data', (c) => {
        body += c;
      });
      req.on('end', () => {
        let m;
        try {
          m = JSON.parse(body);
        } catch {
          return json(res, 400, {});
        }
        if (m.method !== 'getMultipleAccounts') return json(res, 200, { jsonrpc: '2.0', id: m.id, error: { message: 'unknown' } });
        const value = (m.params[0] || []).map((acc) => {
          const mint = accounts.get(acc);
          const c = mint && pump.get(mint);
          return c ? { data: [curveAccount(c.st), 'base64'], owner: PUMP_PROGRAM, lamports: 1, executable: false, rentEpoch: 0, space: 81 } : null;
        });
        return json(res, 200, { jsonrpc: '2.0', id: m.id, result: { context: { slot }, value } });
      });
      return undefined;
    }
    if (u.pathname.startsWith('/ipfs/')) {
      if (down.ipfs) return json(res, 503, {});
      const id = u.pathname.slice(6).split('/')[0];
      const f = files.get(id);
      if (!f) return json(res, 404, { error: 'not found' });
      if (f.redirect) {
        res.writeHead(302, { Location: f.redirect });
        return res.end();
      }
      res.writeHead(f.status || 200, { 'Content-Type': f.type });
      return res.end(f.body);
    }
    if (u.pathname.startsWith('/dex/')) {
      if (down.dexscreener) return json(res, 503, {});
      const m = /^\/dex\/tokens\/v1\/([a-z]+)\/(.+)$/.exec(u.pathname);
      if (m) {
        const list = m[2].split(',').map((a) => pairFor(m[1], a)).filter(Boolean);
        return json(res, 200, list);
      }
      if (u.pathname === '/dex/token-profiles/latest/v1') return json(res, 200, profiles);
      return json(res, 404, {});
    }
    if (u.pathname.startsWith('/clank/v1/trpc/')) {
      if (down.clank) return json(res, 503, {});
      const names = decodeURIComponent(u.pathname.slice('/clank/v1/trpc/'.length)).split(',');
      let input = {};
      try {
        input = JSON.parse(u.searchParams.get('input') || '{}');
      } catch {
        input = {};
      }
      return json(res, 200, clankAnswer(names, input));
    }
    return json(res, 404, {});
  });

  // ---------- WebSockets ----------
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    const u = new URL(req.url, 'http://fake');
    const which = u.pathname === '/api/data' ? 'pumpportal' : u.pathname === '/pumpdev' ? 'pumpdev' : u.pathname === '/' ? 'helius' : null;
    if (!which || down[which] || (which === 'helius' && u.searchParams.get('api-key') !== key)) {
      socket.write(`HTTP/1.1 ${which === 'helius' && !down.helius ? '401 Unauthorized' : '503 Service Unavailable'}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      conns[which].add(ws);
      ws.on('close', () => {
        conns[which].delete(ws);
        heliusSubs.delete(ws);
      });
      ws.on('message', (data) => {
        let m;
        try {
          m = JSON.parse(String(data));
        } catch {
          return;
        }
        seen[which].push(m);
        if (which === 'pumpportal' || which === 'pumpdev') {
          if (m.method === 'subscribeNewToken') ws.send(JSON.stringify({ message: 'Successfully subscribed to token creation events.' }));
          return;
        }
        if (m.method === 'accountSubscribe') {
          const id = ++subSeq;
          if (!heliusSubs.has(ws)) heliusSubs.set(ws, new Map());
          heliusSubs.get(ws).set(id, m.params[0]);
          ws.send(JSON.stringify({ jsonrpc: '2.0', result: id, id: m.id }));
        } else if (m.method === 'accountUnsubscribe') {
          const subs = heliusSubs.get(ws);
          if (subs) subs.delete(m.params[0]);
          ws.send(JSON.stringify({ jsonrpc: '2.0', result: true, id: m.id }));
        }
      });
    });
  });

  await new Promise((r) => server.listen(port, host, r));
  const p = server.address().port;
  const base = `http://${host}:${p}`;

  const send = (which, msg) => {
    const text = JSON.stringify(msg);
    let k = 0;
    for (const ws of conns[which]) {
      if (ws.readyState === 1) {
        ws.send(text);
        k += 1;
      }
    }
    return k;
  };
  function notify(mint) {
    const c = pump.get(mint);
    slot += 1;
    for (const [ws, subs] of heliusSubs) {
      for (const [id, acc] of subs) {
        if (acc !== c.curveKey || ws.readyState !== 1) continue;
        ws.send(JSON.stringify({ jsonrpc: '2.0', method: 'accountNotification', params: { result: { context: { slot },
          value: { data: [curveAccount(c.st), 'base64'], executable: false, lamports: 1, owner: PUMP_PROGRAM, rentEpoch: 0, space: 81 } },
        subscription: id } }));
      }
    }
  }

  const api = {
    key,
    port: p,
    urls: {
      pumpportal: `ws://${host}:${p}/api/data`,
      pumpdev: `ws://${host}:${p}/pumpdev`,
      helius: `${base}/?api-key=${key}`,
      dexscreener: `${base}/dex`,
      clank: `${base}/clank/v1/trpc/`,
      gateway: `${base}/ipfs/`,
    },
    // the relay's settings that point it at these
    env(extra = {}) {
      return { HELIUS_API_KEY: api.urls.helius, PUMPPORTAL_WS_URL: api.urls.pumpportal, PUMPDEV_WS_URL: api.urls.pumpdev,
        DEXSCREENER_URL: api.urls.dexscreener, CLANK_API_URL: api.urls.clank, TRENCH_IPFS_GATEWAYS: api.urls.gateway, ...extra };
    },
    seen,
    down,
    conns,
    files,
    pump,
    // a new pump.fun coin: its metadata and picture on the gateway, its create message to PumpPortal (or PumpDev)
    async launch({ name = `Fake Coin ${n + 1}`, symbol = `FAKE${n + 1}`, devBuy = 0.5, picture: pic = 'png', hue = (n * 47) % 360,
      via = 'pumpportal', socials = true } = {}) {
      n += 1;
      const mint = mintFrom(`${name}:${n}`);
      const curveKey = b58From(`curve:${mint}`, 44);
      const metaCid = cidFrom(`meta:${mint}`);
      const imgCid = cidFrom(`img:${mint}`);
      const vs0 = PUMP.vSol0;
      const vt0 = PUMP.vTok0;
      const vs = vs0 + devBuy * 0.99;
      const vt = (vs0 * vt0) / vs;
      const st = { vt, vs, rt: vt - PUMP.floor, rs: vs - vs0, sup: PUMP.supply, done: false };
      pump.set(mint, { curveKey, st, name, symbol, migrated: false, pool: null, poolAt: null });
      accounts.set(curveKey, mint);
      if (pic === 'png') files.set(imgCid, { type: 'image/png', body: await picture(sharp, [...symbol][0] || '?', hue) });
      else if (pic === 'svg') files.set(imgCid, { type: 'image/svg+xml', body: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') });
      else if (pic === 'html') files.set(imgCid, { type: 'image/png', body: Buffer.from('<!doctype html><title>not a picture</title>') });
      else if (pic === 'redirect') files.set(imgCid, { redirect: 'http://169.254.169.254/latest/meta-data' });
      else if (pic === 'huge') files.set(imgCid, { type: 'image/png', body: Buffer.alloc(9_000_000, 1) });
      const meta = { name, symbol, description: 'made up for a test', image: `https://ipfs.io/ipfs/${imgCid}`, showName: true,
        createdOn: 'https://pump.fun', ...(socials ? { twitter: 'https://x.com/example', website: 'https://example.com' } : {}) };
      if (pic !== 'nometa') files.set(metaCid, { type: 'application/json', body: Buffer.from(JSON.stringify(meta)) });
      const msg = { signature: b58From(`sig:${mint}`, 88), mint, traderPublicKey: b58From(`dev:${mint}`, 44), txType: 'create',
        initialBuy: PUMP.vTok0 - vt, solAmount: devBuy, bondingCurveKey: curveKey, vTokensInBondingCurve: vt, vSolInBondingCurve: vs,
        marketCapSol: (vs / vt) * PUMP.supply, name, symbol, uri: `https://ipfs.io/ipfs/${metaCid}`, pool: 'pump' };
      const sent = send(via, msg);
      return { mint, curveKey, metaCid, imgCid, sent, msg };
    },
    // someone trades it: `sol` in (a buy) or out (a sell, negative), on its curve
    trade(mint, sol) {
      const c = pump.get(mint);
      const k = c.st.vs * c.st.vt;
      const vs = Math.max(PUMP.vSol0, c.st.vs + sol);
      let vt = k / vs;
      if (vt <= PUMP.floor) vt = PUMP.floor;
      c.st = { ...c.st, vs: k / vt, vt, rt: Math.max(0, vt - PUMP.floor), rs: Math.max(0, k / vt - PUMP.vSol0), done: vt <= PUMP.floor };
      notify(mint);
      return c.st;
    },
    // its curve sells out and its pool opens (the migrate message; DexScreener then has its pool)
    migrate(mint) {
      const c = pump.get(mint);
      c.st = { ...c.st, done: true };
      notify(mint);
      c.migrated = true;
      c.pool = { ls: 84.9, lb: 206_900_000 };
      c.poolAt = Date.now();
      send('pumpportal', { signature: b58From(`migsig:${mint}`, 88), mint, txType: 'migrate', pool: 'pump-amm' });
    },
    poolTrade(mint, factor) {
      const c = pump.get(mint);
      c.pool = { ls: c.pool.ls * factor, lb: c.pool.lb / factor };
    },
    // a clank.trade coin (Robinhood Chain)
    async clank({ name = `Clank Coin ${n + 1}`, symbol = `CLK${n + 1}`, marketCap = 2.5, progress = 12, state = 0 } = {}) {
      n += 1;
      const address = evmFrom(`clank:${name}:${n}`);
      const imgCid = cidFrom(`clankimg:${address}`);
      files.set(imgCid, { type: 'image/png', body: await picture(sharp, [...symbol][0] || '?', (n * 71) % 360) });
      const c = { address, name, symbol, image: imgCid, state, progress, createdAt: Math.floor(Date.now() / 1000), marketCap,
        quoteCurrency: '0x0000000000000000000000000000000000000000' };
      clankCoins.push(c);
      return c;
    },
    clankSet(address, patch) {
      const c = clankCoins.find((x) => x.address === address);
      if (c) Object.assign(c, patch);
    },
    // a BNB Chain or Base coin with a DexScreener profile
    async listed(chain, { name = `Listed ${n + 1}`, symbol = `LST${n + 1}`, mu = 50_000, lu = 12_000, dexId = 'fourmeme', ageMs = 60_000 } = {}) {
      n += 1;
      const address = evmFrom(`${chain}:${name}:${n}`);
      const imgCid = cidFrom(`listimg:${address}`);
      files.set(imgCid, { type: 'image/png', body: await picture(sharp, [...symbol][0] || '?', (n * 31) % 360) });
      evm[chain].set(address, { name, symbol, mu, lu, dexId, created: Date.now() - ageMs, icon: `ipfs://${imgCid}` });
      profiles.unshift({ url: 'https://dexscreener.com/x', chainId: chain, tokenAddress: address, icon: `ipfs://${imgCid}` });
      return address;
    },
    // a service goes away (its connections closed, new ones refused) or comes back
    setDown(which, on = true) {
      down[which] = on;
      if (on && conns[which]) for (const ws of conns[which]) ws.terminate();
    },
    send,
    async close() {
      for (const set of Object.values(conns)) for (const ws of set) ws.terminate();
      await new Promise((r) => server.close(() => r()));
      server.closeAllConnections?.();
    },
  };
  return api;
}

// `node tools/trench-relay/fakes.mjs`: the stand-ins on a port, a new made-up coin every few seconds with trades
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const f = await startFakes({ port: Number(process.env.FAKES_PORT) || 0 });
  console.log('Point the relay at these (environment variables):');
  for (const [k, v] of Object.entries(f.env())) console.log(`${k}=${v}`);
  const live = [];
  setInterval(async () => {
    const c = await f.launch();
    live.push(c.mint);
    if (live.length > 30) live.shift();
  }, 4000);
  setInterval(() => {
    for (const m of live) if (Math.random() < 0.5) f.trade(m, (Math.random() - 0.35) * 2);
  }, 1000);
}
