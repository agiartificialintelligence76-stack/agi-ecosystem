// The relay's settings (2026-10-21, #404), from its settings file on the owner's server (/opt/agi1-trench/trench.env, see
// trench.env.example), each checked and kept inside its limits. HELIUS_API_KEY may be the bare key or a whole Helius
// address with "api-key=" in it; the key itself is only ever handed to the Helius connection and the log's scrubber.

// (2026-10-22, the owner: "i just checked there are other chains on gmgn right add that also": Ethereum, Monad, HyperEVM,
// Arbitrum and Tron, DexScreener's listed coins like BNB Chain's and Base's, no new key)
export const CHAIN_IDS = Object.freeze(['solana', 'robinhood', 'bnb', 'base', 'ethereum', 'monad', 'hyperevm', 'arbitrum', 'tron']);
export const DEFAULTS = Object.freeze({
  port: 8787,
  host: '0.0.0.0',
  origins: ['https://agi1.app', 'https://www.agi1.app'],
  maxClients: 2000,
  maxPerIp: 10,
  chains: CHAIN_IDS.slice(),
  solanaTrack: 150, // the newest pump.fun coins whose curves are followed live
  watchMax: 150, // coins viewers have open or hold, followed on top of those
  picCacheMb: 64,
  trustProxy: false,
  pumpportal: 'wss://pumpportal.fun/api/data',
  pumpdev: 'wss://pumpdev.io/ws',
  dexscreener: 'https://api.dexscreener.com',
  clank: 'https://clank.trade/v1/trpc/',
  gateways: ['https://ipfs.filebase.io/ipfs/', 'https://gateway.pinata.cloud/ipfs/', 'https://ipfs.io/ipfs/'],
  logLevel: 'info',
});

const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const KEY = /^[A-Za-z0-9-]{16,100}$/;

// HELIUS_API_KEY → { key, ws, http } (the WebSocket and JSON-RPC addresses), { error } or null (not set)
export function heliusFrom(raw) {
  const s = String(raw ?? '').trim().replace(/^["']|["']$/g, '');
  if (!s) return null;
  if (KEY.test(s)) {
    return { key: s, ws: `wss://mainnet.helius-rpc.com/?api-key=${s}`, http: `https://mainnet.helius-rpc.com/?api-key=${s}` };
  }
  let u;
  try {
    u = new URL(s);
  } catch {
    return { error: 'HELIUS_API_KEY is neither a Helius key nor a Helius address' };
  }
  const key = u.searchParams.get('api-key');
  if (!key || !/^[A-Za-z0-9-]{8,100}$/.test(key)) return { error: 'the Helius address in HELIUS_API_KEY has no api-key= in it' };
  const local = LOCAL.has(u.hostname);
  if (!(['https:', 'wss:'].includes(u.protocol) || (local && ['http:', 'ws:'].includes(u.protocol)))) {
    return { error: 'the Helius address in HELIUS_API_KEY must start with https:// or wss://' };
  }
  const secure = u.protocol === 'https:' || u.protocol === 'wss:';
  const http = new URL(u.href);
  http.protocol = secure ? 'https:' : 'http:';
  const ws = new URL(u.href);
  ws.protocol = secure ? 'wss:' : 'ws:';
  return { key, ws: ws.href, http: http.href };
}

const int = (v, d, lo, hi) => {
  const x = Math.floor(Number(v));
  return v == null || v === '' || !Number.isFinite(x) ? d : Math.min(hi, Math.max(lo, x));
};
const list = (v, d) => (typeof v === 'string' && v.trim() ? v.split(',').map((x) => x.trim()).filter(Boolean) : d.slice());
const url = (v, d, schemes) => {
  if (typeof v !== 'string' || !v.trim()) return d;
  try {
    const u = new URL(v.trim());
    return schemes.includes(u.protocol) ? u.href : d;
  } catch {
    return d;
  }
};

// env → { cfg, problems (words for the owner), secrets (to scrub from the log) }
export function readConfig(env = process.env) {
  const problems = [];
  const helius = heliusFrom(env.HELIUS_API_KEY);
  if (helius && helius.error) problems.push(helius.error);
  const chains = list(env.TRENCH_CHAINS, DEFAULTS.chains).filter((c) => CHAIN_IDS.includes(c));
  const origins = list(env.TRENCH_ORIGINS, DEFAULTS.origins).filter((o) => /^https?:\/\/[^/\s]+$/.test(o));
  const gateways = list(env.TRENCH_IPFS_GATEWAYS, DEFAULTS.gateways)
    .filter((g) => /^https?:\/\/[^\s]+\/ipfs\/$/.test(g));
  const cfg = {
    port: int(env.TRENCH_PORT, DEFAULTS.port, 0, 65535), // 0: any free port (the tests)
    host: typeof env.TRENCH_HOST === 'string' && env.TRENCH_HOST.trim() ? env.TRENCH_HOST.trim() : DEFAULTS.host,
    origins,
    maxClients: int(env.TRENCH_MAX_CLIENTS, DEFAULTS.maxClients, 1, 100000),
    maxPerIp: int(env.TRENCH_MAX_PER_IP, DEFAULTS.maxPerIp, 1, 1000),
    chains: chains.length ? chains : DEFAULTS.chains.slice(),
    solanaTrack: int(env.TRENCH_SOLANA_TRACK, DEFAULTS.solanaTrack, 10, 800),
    watchMax: int(env.TRENCH_WATCH_MAX, DEFAULTS.watchMax, 0, 800),
    picCacheMb: int(env.TRENCH_PIC_CACHE_MB, DEFAULTS.picCacheMb, 4, 1024),
    trustProxy: env.TRENCH_TRUST_PROXY === '1' || env.TRENCH_TRUST_PROXY === 'true',
    helius: helius && !helius.error ? { ws: helius.ws, http: helius.http } : null,
    // off: no PumpPortal (PumpDev alone sends the new coins), e.g. if PumpPortal ever says no to a public relay
    pumpportal: env.PUMPPORTAL_WS_URL === 'off' ? null : url(env.PUMPPORTAL_WS_URL, DEFAULTS.pumpportal, ['wss:', 'ws:']),
    pumpdev: env.PUMPDEV_WS_URL === 'off' ? null : url(env.PUMPDEV_WS_URL, DEFAULTS.pumpdev, ['wss:', 'ws:']),
    dexscreener: url(env.DEXSCREENER_URL, DEFAULTS.dexscreener, ['https:', 'http:']).replace(/\/$/, ''),
    clank: url(env.CLANK_API_URL, DEFAULTS.clank, ['https:', 'http:']),
    gateways: gateways.length ? gateways : DEFAULTS.gateways.slice(),
    logLevel: ['debug', 'info', 'warn', 'error'].includes(env.TRENCH_LOG) ? env.TRENCH_LOG : DEFAULTS.logLevel,
    // race rooms (2026-10-22, rooms.mjs): on unless TRENCH_ROOMS=off; seats a room, rooms, sockets on /room, per address
    rooms: env.TRENCH_ROOMS === 'off' ? null : {
      perRoom: int(env.TRENCH_ROOM_SEATS, 8, 2, 16),
      max: int(env.TRENCH_ROOMS_MAX, 200, 1, 10000),
      maxPlayers: int(env.TRENCH_ROOM_PLAYERS, 1600, 2, 100000),
      perIp: int(env.TRENCH_ROOMS_PER_IP, 8, 1, 1000),
    },
  };
  if (cfg.chains.includes('solana') && !cfg.helius && !(helius && helius.error)) {
    problems.push('HELIUS_API_KEY is not set: Solana stays off (its coins need Helius for their live prices: set it in trench.env)');
  }
  if (cfg.chains.includes('solana') && !cfg.pumpportal && !cfg.pumpdev) {
    problems.push('PUMPPORTAL_WS_URL and PUMPDEV_WS_URL are both off: Solana gets no new coins (switch one of them back on in trench.env)');
  }
  // the Helius Developer plan's limit is 1,000 per connection; the free plan's too
  if (cfg.solanaTrack + cfg.watchMax > 950) cfg.watchMax = Math.max(0, 950 - cfg.solanaTrack);
  return { cfg, problems, secrets: helius && helius.key ? [helius.key] : [] };
}
