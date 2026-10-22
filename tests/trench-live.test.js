// TRENCHING SIMULATOR's Live mode (2026-10-21, #404): real new coins with their real names and pictures, play money only.
// Its relay (tools/trench-relay/: what PumpPortal, Helius, DexScreener and clank.trade send, read and checked; a pump.fun
// curve's price and market cap; the fan-out to every viewer, its caps, its pings, a slow viewer; reconnects and PumpDev
// taking over; pictures checked to the byte, never SVG, never a redirect, never a private address; the Helius key never
// in a log or /health) against stand-ins of every service on this computer (tools/trench-relay/fakes.mjs); and the game's
// side (src/games/trenchingsimulator/live*.js): its chains and the money each terminal shows, the relay's address
// (another one only on localhost), what it gets checked, a live market (play money against the live curve, the stand-ins
// when the feed is down or quiet, in plain words), a live run's real clock, its results' words and its bests kept apart,
// AGI-1 never naming a real coin, and the CSP gaining only the relay's origin. No real network, no settings, any day.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import { WebSocket } from 'ws';
import * as P from '../tools/trench-relay/lib/parse.mjs';
import { readConfig, heliusFrom, DEFAULTS } from '../tools/trench-relay/lib/config.mjs';
import { createLog, errText } from '../tools/trench-relay/lib/log.mjs';
import { isPublicIp, safeGet, trustedGet, trustedJson, NetError } from '../tools/trench-relay/lib/net.mjs';
import { backoffMs } from '../tools/trench-relay/lib/upstream.mjs';
import { createHub, LIMITS } from '../tools/trench-relay/lib/hub.mjs';
import { createClank } from '../tools/trench-relay/lib/sources/clank.mjs';
import { locate, sniff, createPictures, PIC } from '../tools/trench-relay/lib/pictures.mjs';
import { startRelay } from '../tools/trench-relay/server.mjs';
import { startFakes, curveAccount } from '../tools/trench-relay/fakes.mjs';
import { createRooms, roomName, ROOMS, CODE as ROOM_CODE } from '../tools/trench-relay/lib/rooms.mjs';
import * as RACE from '../src/games/trenchingsimulator/race.js';
import * as L from '../src/games/trenchingsimulator/live-chains.js';
import { createLiveFeed } from '../src/games/trenchingsimulator/live-feed.js';
import { createLiveMarket } from '../src/games/trenchingsimulator/live-market.js';
import { createMarket } from '../src/games/trenchingsimulator/engine.js';
import { buyQuote, curvePrice, curveProgress, START_MC, FLOOR_TOK, CURVE_TOK, K } from '../src/games/trenchingsimulator/curve.js';
import { createRun, MAX_DT } from '../src/games/trenchingsimulator/run.js';
import { LINES, LIVE_LINES, liveLineFor, createVoice, lineFor } from '../src/games/trenchingsimulator/lines.js';
import { cardText, modeLabel } from '../src/games/trenchingsimulator/results.js';
import { shareText } from '../src/games/trenchingsimulator/share.js';
import * as SAVE from '../src/games/trenchingsimulator/save.js';
import { challengeById, CHALLENGES, freeStartSol } from '../src/games/trenchingsimulator/challenges.js';
import { money, isCoinCurrency } from '../src/games/trenchingsimulator/format.js';
import { ORDER_ERRORS } from '../src/games/trenchingsimulator/boards/board.js';

const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} is not ${b}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 8000, what = 'a condition') {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > ms) assert.fail(`waited ${ms} ms for ${what}`);
    await sleep(15);
  }
}
const MINT = '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr';
const MINT2 = 'Hn8X3dJt6pVnE2QwP5R7sT9uVwXyZaBcDeFgHiJkLmNo';
const CURVE = '4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf';
const DEV = 'CRhtqXk98ATqo1R8gs7WQcjoFeLbrkhNKUAbSQwbsE4c';
const AGI_CA = '0xFa31d04462746aAA24bC7E5626403E09E4B106ec';
const ORIGIN = 'http://localhost:4173';

// a PumpPortal new-coin message (pump.fun's standard curve after a dev buy of `dev` SOL)
function create(over = {}, dev = 0.5) {
  const vs = 30 + dev * 0.99;
  const vt = (30 * 1_073_000_000) / vs;
  return { signature: 'x', mint: MINT, traderPublicKey: DEV, txType: 'create', initialBuy: 1_073_000_000 - vt, solAmount: dev,
    bondingCurveKey: CURVE, vTokensInBondingCurve: vt, vSolInBondingCurve: vs, marketCapSol: (vs / vt) * 1e9, name: 'Moon Frog',
    symbol: 'MFROG', uri: 'https://ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG', pool: 'pump', ...over };
}
// a standard curve with `left` tokens still for sale (the engine's own numbers)
function curveAt(left, done = false) {
  const vt = FLOOR_TOK + left;
  const vs = K / vt;
  return { k: 'c', vs, vt, rt: left, rs: vs - 30, sup: 1e9, done };
}

// ---------- the relay: what the sources send ----------

test("PumpPortal's (and PumpDev's) new coins and migrations: read, checked, and anything odd dropped", () => {
  const c = P.parseCreate(create());
  assert.equal(c.mint, MINT);
  assert.equal(c.curve, CURVE);
  assert.equal(c.creator, DEV);
  assert.equal(c.name, 'Moon Frog');
  assert.equal(c.symbol, 'MFROG');
  assert.equal(c.uri, create().uri);
  assert.equal(c.st.k, 'c');
  near(c.st.vs, 30.495, 1e-9, 'virtual SOL');
  near(c.st.rt, c.st.vt - 279_900_000, 1e-6, 'its real tokens follow from its virtual ones');
  near(c.st.rs, 0.495, 1e-9, 'the real SOL in it');
  assert.equal(c.st.sup, 1e9);
  assert.equal(c.st.done, false);
  // a ticker's "$" goes; names as they are (no word filter), only made safe to show
  assert.equal(P.parseCreate(create({ symbol: '$$WOW' })).symbol, 'WOW');
  assert.equal(P.parseCreate(create({ name: 'damn \u202egnihtemos\u202c frog' })).name, 'damn gnihtemos frog');
  // dropped: not a create, another launchpad, another quote asset, bad addresses, no name, a curve that isn't pump.fun's
  for (const bad of [{ txType: 'buy' }, { pool: 'bonk' }, { quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
    { mint: 'not-a-mint' }, { bondingCurveKey: '0OIl' }, { name: '   ' }, { symbol: '\u200b\u200e' }, { vSolInBondingCurve: 'NaN' },
    { vTokensInBondingCurve: 500_000_000, vSolInBondingCurve: 30 }, { vSolInBondingCurve: -1 }]) {
    assert.equal(P.parseCreate(create(bad)), null, JSON.stringify(bad));
  }
  for (const bad of [null, undefined, 'x', 7, [], {}]) assert.equal(P.parseCreate(bad), null);
  assert.equal(P.parseCreate(create({ quoteMint: P.WSOL })).mint, MINT, 'priced in SOL itself: fine');
  assert.equal(P.parseCreate(create({ pool: undefined })).mint, MINT, 'no pool said: pump.fun\'s');
  assert.equal(P.parseCreate(create({ uri: 'x'.repeat(700) })).uri, null, 'a very long address is no address');
  assert.deepEqual(P.parseMigrate({ txType: 'migrate', mint: MINT, pool: 'pump-amm' }), { mint: MINT });
  for (const bad of [{ txType: 'create', mint: MINT }, { txType: 'migrate', mint: 'nope' }, null]) assert.equal(P.parseMigrate(bad), null);
});

test("a pump.fun curve's account, its price (virtual quote ÷ virtual tokens) and market cap (× a billion), as the engine has them", () => {
  // the account's bytes: its 8-byte kind, then virtual tokens, virtual SOL, real tokens, real SOL, supply, complete
  const st = curveAt(500_000_000);
  const b64 = curveAccount(st);
  const back = P.parseCurveAccount(b64);
  near(back.vt, st.vt, 1e-6, 'virtual tokens');
  near(back.vs, st.vs, 1e-9, 'virtual SOL');
  near(back.rt, st.rt, 1e-6, 'real tokens');
  near(back.rs, st.rs, 1e-9, 'real SOL');
  assert.equal(back.sup, 1e9);
  assert.equal(back.done, false);
  assert.equal(P.parseCurveAccount(curveAccount({ ...curveAt(0), done: true })).done, true);
  assert.deepEqual(P.CURVE_DISC, [23, 183, 248, 55, 96, 216, 172, 96], 'sha256("account:BondingCurve")');
  // not a curve: another kind of account, another program's, too short, not base64
  const bytes = Buffer.from(b64, 'base64');
  bytes[0] ^= 1;
  assert.equal(P.parseCurveAccount(bytes.toString('base64')), null);
  assert.equal(P.parseCurveAccount(b64, '11111111111111111111111111111111'), null);
  assert.equal(P.parseCurveAccount(Buffer.alloc(40).toString('base64')), null);
  assert.equal(P.parseCurveAccount('%%%'), null);
  // the math: pump.fun's numbers, the same as the game's own curve at every point
  for (const left of [793_100_000, 600_000_000, 300_000_000, 50_000_000, 0]) {
    const s = curveAt(left);
    near(P.curvePrice(s), curvePrice({ left }), 1e-18, `price at ${left}`);
    near(P.curveMarketCap(s), curvePrice({ left }) * 1e9, 1e-6, `market cap at ${left}`);
    near(P.curveProgress(s), curveProgress({ left }), 1e-12, `progress at ${left}`);
  }
  near(P.curveMarketCap(curveAt(793_100_000)), START_MC, 1e-6, 'a new coin: about 28 SOL');
  // the browser's side reads the same market, in the engine's units
  const real = L.toReal(L.parseState(P.encodeState(curveAt(400_000_000))), { sup: 1e9 });
  near((real.sol / real.tok) * 1e9, P.curveMarketCap(curveAt(400_000_000)), 1e-3, 'the same market cap on both sides');
  assert.equal(real.phase, 'curve');
  near(real.cap, 400_000_000, 0.5, 'tokens still for sale');
  near(real.progress, curveProgress({ left: 400_000_000 }), 1e-9, 'its progress');
  assert.equal(L.toReal(L.parseState(P.encodeState(curveAt(0, true)))).phase, 'migrating', 'sold out: closed for a moment');
});

test('wrapped native prices can come from either side of a pair and choose the most liquid valid quote', () => {
  const quote = (coin, value, liquidity = 1000) => ({ chainId: P.WRAPPED[coin].chain,
    baseToken: { address: MINT }, quoteToken: { address: P.WRAPPED[coin].address },
    priceUsd: String(value * 0.002), priceNative: '0.002', liquidity: { usd: liquidity } });
  for (const [coin, value] of [['sol', 150], ['eth', 3000], ['bnb', 600], ['mon', 0.02], ['hype', 25], ['trx', 0.3]]) {
    near(P.wrappedUsd([quote(coin, value)], coin), value, 1e-10, `${coin} as quote token`);
    near(P.wrappedUsd({ pairs: [quote(coin, value)] }, coin), value, 1e-10, `${coin} in the older API shape`);
  }
  const hype = quote('hype', 25);
  for (const priceNative of [undefined, null, '', '0', 0, '-1', 'NaN', 'Infinity']) {
    assert.equal(P.wrappedUsd([{ ...hype, priceNative }], 'hype'), null, `bad native denominator: ${priceNative}`);
  }
  assert.equal(P.wrappedUsd([{ ...hype, priceUsd: '0' }], 'hype'), null);
  assert.equal(P.wrappedUsd([quote('hype', 100001)], 'hype'), null, 'derived value outside its sane range');
  assert.equal(P.wrappedUsd([{ ...hype, chainId: 'base' }], 'hype'), null, 'same address on another chain');
  assert.equal(P.wrappedUsd([{ ...hype, quoteToken: { address: P.WRAPPED.mon.address } }], 'hype'), null, 'another quote token');
  const mon = quote('mon', 0.02);
  mon.quoteToken.address = mon.quoteToken.address.toUpperCase().replace('0X', '0x');
  near(P.wrappedUsd([mon], 'mon'), 0.02, 1e-12, 'EVM quote addresses ignore letter case');
  const trx = quote('trx', 0.3);
  trx.quoteToken.address = trx.quoteToken.address.toLowerCase();
  assert.equal(P.wrappedUsd([trx], 'trx'), null, 'Tron quote addresses retain their case');
  const base = { ...hype, baseToken: { address: P.WRAPPED.hype.address }, quoteToken: { address: 'usd' },
    priceUsd: '24', priceNative: '0', liquidity: { usd: 500 } };
  assert.equal(P.wrappedUsd([base], 'hype'), 24, 'wrapped base token uses its USD price without a denominator');
  const invalid = { ...quote('hype', 100001, 1000000) };
  const broken = { ...quote('hype', 25, 2000000), priceNative: '0' };
  assert.equal(P.wrappedUsd([invalid, base, hype, broken], 'hype'), 25, 'highest liquidity among valid prices');
  assert.equal(P.wrappedUsd([hype, { ...base, priceUsd: '26', liquidity: { usd: 2000 } }], 'hype'), 26,
    'a more liquid base-token price still wins');
});

test('DexScreener and clank.trade: dollar prices, pools, pairs, profiles and new coins, never nonsense', () => {
  const pair = (o) => ({ chainId: 'solana', dexId: 'raydium', baseToken: { address: P.WSOL }, quoteToken: { address: 'usdc' },
    priceUsd: '150', liquidity: { usd: 1000 }, ...o });
  assert.equal(P.wrappedUsd([pair({ priceUsd: '149', liquidity: { usd: 10 } }), pair({ priceUsd: '151.5', liquidity: { usd: 9e6 } })], 'sol'), 151.5);
  assert.equal(P.wrappedUsd([pair({ priceUsd: '0.5' })], 'sol'), null, 'not a sane SOL price');
  assert.equal(P.wrappedUsd([pair({ chainId: 'bsc' })], 'sol'), null, 'another chain');
  assert.equal(P.wrappedUsd({ pairs: [pair({})] }, 'sol'), 150, 'the older shape too');
  assert.equal(P.wrappedUsd([], 'eth'), null);
  // a pump.fun coin's pool after its curve: the SOL and tokens in it
  const pool = { chainId: 'solana', dexId: 'pumpswap', baseToken: { address: MINT }, quoteToken: { address: P.WSOL },
    liquidity: { usd: 25000, base: 206_900_000, quote: 84.9 }, volume: { m5: 1200, h1: 9000, h24: 40000 },
    txns: { m5: { buys: 12, sells: 7 }, h1: { buys: 80, sells: 60 }, h24: { buys: 400, sells: 300 } }, priceChange: { m5: 4.2, h1: -3.5 } };
  assert.equal(P.bestPair([pool, { ...pool, baseToken: { address: MINT2 } }], 'solana', MINT), pool);
  assert.deepEqual(P.solPoolState(pool), { k: 'p', ls: 84.9, lb: 206_900_000 });
  assert.equal(P.solPoolState({ ...pool, quoteToken: { address: 'usdc' } }), null, 'priced in SOL only');
  assert.deepEqual(P.pairDx(pool), [1200, 12, 7, 9000, 140, 40000, 700, 4.2, -3.5]);
  assert.deepEqual(P.pairDx({}), [-1, -1, -1, -1, -1, -1, -1, -1, -1]);
  // BNB Chain and Base: a pair's dollars; on a launchpad's own curve (four.meme) it hasn't graduated
  const evm = '0xAbCdEf0123456789abcdef0123456789ABCDEF01';
  const bsc = { chainId: 'bsc', dexId: 'fourmeme', baseToken: { address: evm.toLowerCase() }, marketCap: 50000, liquidity: { usd: 12000 } };
  assert.equal(P.bestPair([bsc], 'bsc', evm), bsc, 'EVM addresses in any case');
  assert.deepEqual(P.usdPairState(bsc), { k: 'u', mu: 50000, lu: 12000, pg: null, gr: false, cl: false });
  assert.equal(P.usdPairState({ ...bsc, dexId: 'pancakeswap' }).gr, true);
  assert.equal(P.usdPairState({ ...bsc, marketCap: undefined, fdv: 70000 }).mu, 70000);
  assert.equal(P.usdPairState({ ...bsc, marketCap: -5, fdv: undefined }), null);
  assert.deepEqual(P.parseProfiles([{ chainId: 'bsc', tokenAddress: evm, icon: 'https://cdn.dexscreener.com/i.png' },
    { chainId: 'solana', tokenAddress: MINT }, { chainId: 'base', tokenAddress: 'nope' }, null], ['bsc', 'base']),
  [{ chain: 'bsc', address: evm.toLowerCase(), icon: 'https://cdn.dexscreener.com/i.png' }]);
  // clank.trade (Robinhood Chain): its market cap is in its pair (ETH or SPCX): × that pair's price, dollars
  const rates = new Map([[P.CLANK_ETH, 3000], [P.CLANK_SPCX, 160]]);
  const raw = { address: evm, name: 'Clank Cat', symbol: 'CCAT', image: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG', state: 0,
    progress: 42.5, createdAt: 1_792_000_000, marketCap: 2.5, quoteCurrency: P.CLANK_ETH };
  const cc = P.clankCoin(raw, rates);
  assert.equal(cc.address, evm.toLowerCase());
  assert.equal(cc.born, 1_792_000_000_000);
  assert.deepEqual(cc.st, { k: 'u', mu: 7500, lu: null, pg: 0.425, gr: false, cl: false });
  assert.equal(P.clankCoin({ ...raw, quoteCurrency: P.CLANK_SPCX }, rates).st.mu, 400, 'an SPCX coin at SPCX\'s price');
  assert.equal(P.clankCoin({ ...raw, quoteCurrency: '0x1111111111111111111111111111111111111111' }, rates).st, null, 'no price: no state, never a guess');
  assert.equal(P.clankCoin({ ...raw, state: 3 }, rates).st.gr, true);
  assert.equal(P.clankCoin({ ...raw, state: 1 }, rates).st.cl, true, 'graduating: closed for a moment');
  assert.equal(P.clankCoin({ ...raw, address: 'nope' }, rates), null);
});

test("names and tickers as their makers wrote them (no word filter), made safe to show: on the relay and in the browser alike", () => {
  const cases = [
    ['Moon Frog', 'Moon Frog'], ['  spaced   out  ', 'spaced out'], ['rtl\u202etxet\u202c', 'rtltxet'], ['zero\u200bwidth', 'zerowidth'],
    ['family 👨\u200d👩\u200d👧 coin', 'family 👨\u200d👩\u200d👧 coin'], ['heart ❤\ufe0f', 'heart ❤\ufe0f'], ['tab\tand\nline', 'tab and line'],
    ['\u3164\u3164', null], ['', null], ['fuck it we ball', 'fuck it we ball'],
  ];
  for (const [raw, want] of cases) {
    assert.equal(P.cleanText(raw, 48), want, JSON.stringify(raw));
    assert.equal(L.cleanText(raw, 48), want, `browser: ${JSON.stringify(raw)}`);
  }
  assert.equal(P.cleanText('a'.repeat(60), 48), `${'a'.repeat(47)}…`);
  const zalgo = P.cleanText(`Z${'\u0301'.repeat(40)}algo`, 48);
  assert.equal([...zalgo].filter((ch) => /[\u0300-\u036f]/.test(ch)).length, 3, 'at most 3 accents on a letter (relay)');
  assert.ok(zalgo.endsWith('algo'));
  for (const bad of [null, undefined, 7, {}, 'x'.repeat(3000)]) assert.equal(P.cleanText(bad, 48), null);
});

// ---------- the relay: its settings, its log, its requests ----------

test('the settings: the Helius key bare or inside its address, kept to the Helius connection and the scrubber', () => {
  const key = 'a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6';
  assert.deepEqual(heliusFrom(key), { key, ws: `wss://mainnet.helius-rpc.com/?api-key=${key}`, http: `https://mainnet.helius-rpc.com/?api-key=${key}` });
  assert.deepEqual(heliusFrom(`https://mainnet.helius-rpc.com/?api-key=${key}`).ws, `wss://mainnet.helius-rpc.com/?api-key=${key}`);
  assert.deepEqual(heliusFrom(`wss://mainnet.helius-rpc.com/?api-key=${key}`).http, `https://mainnet.helius-rpc.com/?api-key=${key}`);
  assert.equal(heliusFrom(`"${key}"`).key, key, 'quotes around it are fine');
  assert.equal(heliusFrom(`http://127.0.0.1:9/?api-key=${key}`).ws, `ws://127.0.0.1:9/?api-key=${key}`, 'plain http only on this computer (tests)');
  assert.match(heliusFrom(`http://example.com/?api-key=${key}`).error, /https/);
  assert.match(heliusFrom('https://mainnet.helius-rpc.com/').error, /api-key/);
  assert.match(heliusFrom('not a key!').error, /neither/);
  assert.equal(heliusFrom(''), null);
  const { cfg, problems, secrets } = readConfig({ HELIUS_API_KEY: key, TRENCH_PORT: '9000', TRENCH_MAX_CLIENTS: '999999',
    TRENCH_ORIGINS: 'https://agi1.app, javascript:alert(1), https://www.agi1.app', TRENCH_CHAINS: 'solana,mars', PUMPDEV_WS_URL: 'off' });
  assert.deepEqual(problems, []);
  assert.deepEqual(secrets, [key]);
  assert.equal(cfg.port, 9000);
  assert.equal(cfg.maxClients, 100000, 'kept inside its limit');
  assert.deepEqual(cfg.origins, ['https://agi1.app', 'https://www.agi1.app']);
  assert.deepEqual(cfg.chains, ['solana']);
  assert.equal(cfg.pumpdev, null);
  assert.ok(cfg.pumpportal, 'PumpPortal on by default');
  // PumpPortal off (if PumpPortal ever says no to a public relay): PumpDev alone; both off says so
  const ppOff = readConfig({ HELIUS_API_KEY: key, PUMPPORTAL_WS_URL: 'off' });
  assert.equal(ppOff.cfg.pumpportal, null);
  assert.ok(ppOff.cfg.pumpdev);
  assert.deepEqual(ppOff.problems, []);
  assert.match(readConfig({ HELIUS_API_KEY: key, PUMPPORTAL_WS_URL: 'off', PUMPDEV_WS_URL: 'off' }).problems.join(' '), /both off/);
  assert.deepEqual(readConfig({ PUMPPORTAL_WS_URL: 'off', PUMPDEV_WS_URL: 'off', TRENCH_CHAINS: 'robinhood' }).problems, [],
    'no Solana: nothing to say');
  assert.ok(!JSON.stringify({ ...cfg, helius: null }).includes(key), 'the key is only in the Helius addresses');
  const none = readConfig({});
  assert.equal(none.cfg.helius, null);
  assert.match(none.problems.join(' '), /HELIUS_API_KEY is not set/);
  assert.deepEqual(none.cfg.origins, DEFAULTS.origins);
  assert.equal(none.cfg.trustProxy, false);
  assert.ok(none.cfg.solanaTrack + none.cfg.watchMax <= 950, 'within Helius\'s 1,000 a connection');
});

test("the log never shows the Helius key, whatever carries it; an error in a few words", () => {
  const key = 'a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6';
  const lines = [];
  const log = createLog({ secrets: [key], write: (l) => lines.push(l), now: () => new Date(0) });
  log.info(`connecting to wss://mainnet.helius-rpc.com/?api-key=${key}`);
  log.warn(`Helius said: bad key ${key}`);
  log.error('https://x.example/?api-key=SOMETHINGELSE&a=1 failed');
  log.debug('not shown at info');
  assert.equal(lines.length, 3);
  assert.ok(lines.every((l) => !l.includes(key) && !l.includes('SOMETHINGELSE')), lines.join('\n'));
  assert.match(lines[0], /^1970-01-01T00:00:00\.000Z connecting to wss:\/\/mainnet\.helius-rpc\.com\/\?api-key=\*\*\*$/);
  assert.match(lines[1], /^1970-01-01T00:00:00\.000Z WARN /);
  assert.equal(errText(Object.assign(new Error('getaddrinfo ENOTFOUND host?api-key=zzz'), { code: 'ENOTFOUND' })), 'ENOTFOUND getaddrinfo ENOTFOUND host?…');
  assert.equal(errText(null), 'unknown error');
});

test('requests a coin gives: https on 443 only, every address public (looked up first), never a redirect, never too big', async () => {
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8']) assert.equal(isPublicIp(ip), true, ip);
  for (const ip of ['10.0.0.1', '127.0.0.1', '169.254.169.254', '172.16.5.4', '192.168.1.1', '100.64.0.1', '0.0.0.0', '224.0.0.1',
    '198.18.0.1', '::1', '::', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:a9fe:a9fe', '64:ff9b::a9fe:a9fe', '2001:db8::1',
    'ff02::1', 'localhost', '', 'x']) assert.equal(isPublicIp(ip), false, ip);
  const refused = async (url, code, resolve = async () => [{ address: '93.184.216.34', family: 4 }]) => {
    await assert.rejects(safeGet(url, { resolve, timeoutMs: 500 }), (e) => e instanceof NetError && e.code === code, url);
  };
  await refused('http://example.com/a.png', 'not_allowed');
  await refused('https://example.com:8443/a.png', 'not_allowed');
  await refused('https://user:pw@example.com/a.png', 'not_allowed');
  await refused('ftp://example.com/a.png', 'not_allowed');
  await refused('nope', 'bad_url');
  await refused('https://127.0.0.1/a.png', 'private_address');
  await refused('https://[::1]/a.png', 'private_address');
  await refused('https://169.254.169.254/latest/meta-data', 'private_address');
  await refused('https://rebind.example/a.png', 'private_address', async () => [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.7', family: 4 }]);
  await refused('https://metadata.example/a.png', 'private_address', async () => [{ address: '169.254.169.254', family: 4 }]);
  // the addresses in its settings (trusted): a redirect is refused, so is an answer over its size (said or streamed)
  const server = http.createServer((req, res) => {
    if (req.url === '/redirect') {
      res.writeHead(302, { Location: 'http://169.254.169.254/' });
      res.end();
    } else if (req.url === '/big') {
      res.writeHead(200, { 'Content-Length': 5000 });
      res.end(Buffer.alloc(5000));
    } else if (req.url === '/stream') {
      res.writeHead(200);
      res.write(Buffer.alloc(3000));
      res.end(Buffer.alloc(3000));
    } else if (req.url === '/slow') {
      setTimeout(() => res.end('late'), 400);
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await assert.rejects(trustedGet(`${base}/redirect`), (e) => e.code === 'redirect' && e.status === 302);
    await assert.rejects(trustedGet(`${base}/big`, { maxBytes: 4000 }), (e) => e.code === 'too_big');
    await assert.rejects(trustedGet(`${base}/stream`, { maxBytes: 4000 }), (e) => e.code === 'too_big');
    await assert.rejects(trustedGet(`${base}/slow`, { timeoutMs: 100 }), (e) => e.code === 'timeout');
    assert.deepEqual(await trustedJson(`${base}/ok`), { ok: true });
  } finally {
    server.close();
  }
});

// ---------- the relay: pictures ----------

// a made-up IPFS id (Qm and 44 base58 characters)
const fakeCid = (word) => `Qm${word.repeat(44)}`.slice(0, 46);

test('pictures: where they are, real image bytes only (never SVG, never a page dressed as one), made small, served by their hash', async () => {
  const cid = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
  assert.deepEqual(locate(`ipfs://${cid}`), { ipfs: cid, path: '' });
  assert.deepEqual(locate(`ipfs://ipfs/${cid}/a.png`), { ipfs: cid, path: '/a.png' });
  assert.deepEqual(locate(`https://ipfs.io/ipfs/${cid}`), { ipfs: cid, path: '' });
  assert.deepEqual(locate(`https://pump.mypinata.cloud/ipfs/${cid}/meta.json`), { ipfs: cid, path: '/meta.json' });
  assert.deepEqual(locate(cid), { ipfs: cid, path: '' });
  assert.deepEqual(locate('https://cdn.example.com/a.png'), { url: 'https://cdn.example.com/a.png' });
  for (const bad of ['http://example.com/a.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA', `ipfs://${cid}/a b`,
    `ipfs://${cid}/../x`, '', null, 'x'.repeat(1200)]) {
    assert.equal(locate(bad), null, String(bad).slice(0, 60));
  }
  // an address's ".." are resolved first (the URL's own rules): then it's only an ordinary address on that host
  assert.deepEqual(locate(`https://ipfs.io/ipfs/${cid}/../../etc`), { url: 'https://ipfs.io/etc' });
  const sharp = (await import('sharp')).default;
  const png = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#3a7' } }).png().toBuffer();
  const jpg = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#a37' } }).jpeg().toBuffer();
  const gif = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#37a' } }).gif().toBuffer();
  assert.equal(sniff(png), 'png');
  assert.equal(sniff(jpg), 'jpeg');
  assert.equal(sniff(gif), 'gif');
  assert.equal(sniff(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null, 'never SVG');
  assert.equal(sniff(Buffer.from('<!doctype html><html></html>')), null);
  assert.equal(sniff(Buffer.alloc(4)), null);
  // the pipeline, with the services as stand-ins: metadata → picture → a 128 px WebP, by its hash
  const files = new Map([
    [`meta-ok`, { type: 'application/json', body: Buffer.from(JSON.stringify({ image: `ipfs://${cid}`, twitter: 'https://x.com/a', website: 'https://a.b' })) }],
    [cid, { body: png }],
    ['svgcid', { body: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') }],
  ]);
  let gatewayCalls = 0;
  const fetchTrusted = async (url) => {
    gatewayCalls += 1;
    const id = url.split('/ipfs/')[1].split('/')[0];
    const f = files.get(id);
    return f ? { status: 200, type: f.type || 'image/png', bytes: f.body } : { status: 404, type: 'text/plain', bytes: Buffer.alloc(0) };
  };
  const safe = new Map([['https://pics.example/page.png', { status: 200, bytes: Buffer.from('<!doctype html>hello') }],
    ['https://pics.example/redirect.png', new NetError('redirect', 302)], ['https://pics.example/private.png', new NetError('private_address')],
    ['https://pics.example/ok.jpg', { status: 200, bytes: jpg }]]);
  const fetchSafe = async (url) => {
    const v = safe.get(url);
    if (v instanceof Error) throw v;
    return v || { status: 404, bytes: Buffer.alloc(0) };
  };
  const pics = createPictures({ gateways: ['https://gw.example/ipfs/'], log: createLog({ write: () => {} }), sharp, fetchTrusted, fetchSafe,
    retryMs: [30], maxBytes: 64 * 1024 * 1024 });
  const ask = (key, spec) => new Promise((resolve) => pics.request(key, spec, (path, soc) => resolve({ path, soc })));
  const meta = await ask('solana:s1', { meta: 'ipfs://meta-ok' });
  assert.equal(meta.path, null, '"meta-ok" isn\'t an IPFS id: nothing fetched');
  const good = await ask('solana:s2', { image: `https://ipfs.io/ipfs/${cid}` });
  assert.match(good.path, /^\/p\/[A-Za-z0-9_-]{22}\.webp$/);
  const out = pics.get(good.path.slice(3, 25));
  assert.equal(sniff(out), 'webp');
  const m = await sharp(out).metadata();
  assert.deepEqual([m.width, m.height, m.format], [PIC.size, PIC.size, 'webp'], '128 × 128 WebP');
  assert.ok(out.length <= PIC.maxOut);
  // its metadata says its socials (as yes or no: never the links)
  const metaCid = fakeCid('Meta');
  files.set(metaCid, files.get('meta-ok'));
  const withMeta = await ask('solana:s3', { meta: `ipfs://${metaCid}` });
  assert.equal(withMeta.path, good.path, 'the same picture: the same hash');
  assert.equal(withMeta.soc, 1 | 4, 'X and a website, no Telegram');
  // refused: an SVG on IPFS, a page dressed as a PNG, a redirect, a private address
  const svgCid = fakeCid('Svg');
  for (const [key, spec] of [['s4', { image: `ipfs://${svgCid}` }], ['s5', { image: 'https://pics.example/page.png' }],
    ['s6', { image: 'https://pics.example/redirect.png' }], ['s7', { image: 'https://pics.example/private.png' }]]) {
    if (key === 's4') files.set(svgCid, files.get('svgcid'));
    assert.equal((await ask(`solana:${key}`, spec)).path, null, key);
  }
  assert.match((await ask('solana:s8', { image: 'https://pics.example/ok.jpg' })).path, /^\/p\//, 'a JPEG from its own https address');
  // not on the gateways yet (a brand new coin's): tried again a moment later, then there
  const later = fakeCid('Later');
  const before = gatewayCalls;
  const p = ask('solana:s9', { image: `ipfs://${later}` });
  await until(() => gatewayCalls > before, 2000, 'its first try');
  files.set(later, { body: gif });
  assert.match((await p).path, /^\/p\//, 'there on its second try');
  assert.ok(pics.stats().retried >= 1);
  assert.equal(pics.get('nope'), null);
  assert.equal(pics.request('solana:s9', { image: 'x' }, () => {}), true, 'a key done with can ask again');
  // the newest kept, up to its size: the oldest go first
  const tiny = createPictures({ gateways: ['https://gw.example/ipfs/'], log: createLog({ write: () => {} }), sharp, fetchTrusted, fetchSafe, maxBytes: 1 });
  const a = await new Promise((r) => tiny.request('a', { image: `ipfs://${cid}` }, (path) => r(path)));
  const b = await new Promise((r) => tiny.request('b', { image: 'https://pics.example/ok.jpg' }, (path) => r(path)));
  assert.equal(tiny.get(a.slice(3, 25)), null, 'the oldest went');
  assert.ok(tiny.get(b.slice(3, 25)));
  pics.close();
  tiny.close();
});

// ---------- the relay: the fan-out ----------

class FakeWs extends EventEmitter {
  constructor() {
    super();
    this.readyState = 1;
    this.sent = [];
    this.bufferedAmount = 0;
    this.closed = null;
    this.terminated = false;
    this.pings = 0;
  }
  send(text) {
    this.sent.push(JSON.parse(text));
  }
  ping() {
    this.pings += 1;
  }
  close(code, why) {
    this.closed = { code, why };
    this.readyState = 3;
    this.emit('close');
  }
  terminate() {
    this.terminated = true;
    this.readyState = 3;
    this.emit('close');
  }
  say(obj) {
    this.emit('message', Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj)), false);
  }
  of(t) {
    return this.sent.filter((m) => m.t === t);
  }
}
const coinIn = (key, over = {}) => ({ key, name: `Coin ${key.slice(0, 4)}`, symbol: 'CN', born: 1_792_000_000_000, by: DEV, src: 'pump.fun',
  sup: 1e9, st: curveAt(780_000_000), st0: curveAt(793_100_000), tracked: true, ...over });

test('contract lookups normalize the requested chain address, cache results and throttle repeated upstream work', async () => {
  let t = 1_792_000_100_000;
  const calls = [];
  const hub = createHub({ chains: ['robinhood', 'bnb'], now: () => t, batchMs: 60_000, pingMs: 60_000,
    onLookup: async (chain, key) => {
      calls.push([chain, key]);
      if (key !== AGI_CA.toLowerCase()) return null;
      hub.addCoin(chain, coinIn(key, { src: 'clank.trade', born: t - 100000 }));
      return hub.byKey(chain, key);
    } });
  const v = new FakeWs();
  try {
    hub.attach(v);
    v.say({ op: 'lookup', address: AGI_CA });
    assert.equal(calls.length, 0, 'a chain subscription is required');
    v.say({ op: 'sub', chain: 'robinhood' });
    for (const address of ['https://example.com/coin', MINT, '0x1234', 7, null]) v.say({ op: 'lookup', address });
    assert.equal(calls.length, 0, 'only a complete address for the selected chain reaches an upstream');
    v.say({ op: 'lookup', address: AGI_CA });
    await until(() => v.of('lookup').some((m) => m.status === 'found'), 1000, 'the mixed-case address result');
    assert.deepEqual(calls, [['robinhood', AGI_CA.toLowerCase()]]);
    assert.equal(v.of('c').at(-1).c.m, AGI_CA.toLowerCase());
    assert.equal(v.of('lookup').at(-1).key, AGI_CA.toLowerCase());
    v.say({ op: 'lookup', address: AGI_CA.toLowerCase() });
    assert.equal(calls.length, 1, 'equivalent address casing shares the cache');
    v.say({ op: 'lookup', address: '0x' + '2'.repeat(40) });
    assert.equal(v.of('lookup').at(-1).status, 'busy');
    assert.equal(calls.length, 1, 'the cooldown bounds upstream work');
    t += 2000;
    v.say({ op: 'lookup', address: '0x' + '2'.repeat(40) });
    await until(() => v.of('lookup').at(-1).status === 'missing', 1000, 'an unknown address result');
    assert.equal(calls.length, 2);
    t += 30_001;
    v.say({ op: 'lookup', address: AGI_CA });
    await until(() => calls.length === 3, 1000, 'a fresh lookup after cache expiry');
  } finally {
    hub.close();
  }
});

test('contract lookups cap shared concurrency and discard a result after the viewer changes chain', async () => {
  const pending = [];
  const hub = createHub({ chains: ['robinhood', 'bnb'], batchMs: 60_000, pingMs: 60_000,
    onLookup: (chain, key) => new Promise((resolve) => pending.push({ chain, key, resolve })) });
  const clients = [];
  try {
    for (let i = 0; i < 9; i++) {
      const v = new FakeWs();
      clients.push(v);
      hub.attach(v);
      v.say({ op: 'sub', chain: 'robinhood' });
      v.say({ op: 'lookup', address: `0x${String(i + 1).padStart(40, '0')}` });
    }
    assert.equal(pending.length, 8, 'at most eight external lookups may run at once');
    assert.equal(clients[8].of('lookup').at(-1).status, 'busy');
    clients[0].say({ op: 'sub', chain: 'bnb' });
    for (const p of pending) p.resolve(null);
    await until(() => clients[1].of('lookup').length, 1000, 'pending lookups finish');
    assert.equal(clients[0].of('lookup').length, 0, 'a previous chain cannot send a late result into the current one');
  } finally {
    for (const p of pending) p.resolve(null);
    hub.close();
  }
});

test('the fan-out: every viewer of a chain gets each new coin and one batch of changes (each coin\'s newest), the others nothing', () => {
  let t = 1_792_000_100_000;
  const watched = [];
  const hub = createHub({ log: createLog({ write: () => {} }), batchMs: 1e9, pingMs: 1e9, now: () => t,
    onWatch: (chain, c, on) => watched.push([chain, c.id, on]) });
  try {
    const a = new FakeWs();
    const b = new FakeWs();
    const c = new FakeWs();
    for (const ws of [a, b, c]) hub.attach(ws);
    assert.equal(a.of('hi').length, 1, 'hello first');
    // (GMGN's other chains since 2026-10-22: Ethereum, Monad, HyperEVM, Arbitrum, Tron)
    assert.deepEqual(Object.keys(a.of('hi')[0].ch), ['solana', 'robinhood', 'bnb', 'base', 'ethereum', 'monad', 'hyperevm', 'arbitrum', 'tron']);
    a.say({ op: 'sub', chain: 'solana' });
    b.say({ op: 'sub', chain: 'solana' });
    c.say({ op: 'sub', chain: 'robinhood' });
    assert.deepEqual(a.of('snap')[0], { t: 'snap', chain: 'solana', coins: [] });
    const id = hub.addCoin('solana', coinIn(MINT));
    assert.equal(id, 's1');
    assert.equal(hub.addCoin('solana', coinIn(MINT)), 's1', 'the same coin twice: one');
    for (const ws of [a, b]) {
      const msg = ws.of('c')[0];
      assert.equal(msg.c.id, 's1');
      assert.equal(msg.c.m, MINT);
      assert.equal(msg.c.src, 'pump.fun');
      assert.equal(msg.c.tr, 1);
      assert.deepEqual(L.parseState(msg.c.st), L.parseState(P.encodeState(curveAt(780_000_000))));
    }
    assert.equal(c.of('c').length, 0, 'Robinhood Chain\'s viewer gets no Solana coin');
    // changes: in one batch, each coin's newest only
    hub.setState('solana', 's1', curveAt(770_000_000));
    hub.setState('solana', 's1', curveAt(760_000_000));
    hub.setState('solana', 's1', curveAt(760_000_000));
    hub.flush();
    const u = a.of('u');
    assert.equal(u.length, 1);
    assert.deepEqual(u[0].u, [['s1', P.encodeState(curveAt(760_000_000))]]);
    assert.deepEqual(b.of('u'), u, 'the same batch for every viewer');
    hub.flush();
    assert.equal(a.of('u').length, 1, 'nothing changed: nothing sent');
    // a picture, a coin let go, a chain's state, prices
    hub.setPic('solana', 's1', '/p/abcdefghijklmnopqrstuv.webp', 5);
    assert.deepEqual(a.of('pic')[0], { t: 'pic', id: 's1', p: '/p/abcdefghijklmnopqrstuv.webp', soc: 5 });
    hub.setTracked('solana', 's1', false);
    hub.flush();
    assert.deepEqual(a.of('off')[0], { t: 'off', ids: ['s1'] });
    hub.setStatus('solana', 'live', { src: 'PumpPortal' });
    assert.deepEqual(c.of('st').at(-1).ch.solana, { s: 'live', n: 1, last: 100 }, 'every viewer hears a chain\'s state, never its source');
    hub.setPx({ sol: 150 });
    assert.equal(c.of('px')[0].sol, 150);
    // watching: kept live for that viewer (the source hears when the first one comes and the last one goes), its history sent
    t += 2000;
    hub.setState('solana', 's1', curveAt(750_000_000));
    a.say({ op: 'watch', ids: ['s1', 'zz', 's999'] });
    b.say({ op: 'watch', ids: ['s1'] });
    assert.deepEqual(watched, [['solana', 's1', true]]);
    assert.equal(a.of('h')[0].id, 's1');
    assert.ok(a.of('h')[0].h.length >= 2, 'its history');
    a.say({ op: 'watch', ids: [] });
    assert.equal(watched.length, 1, 'still watched by another');
    b.close();
    assert.deepEqual(watched.at(-1), ['solana', 's1', false], 'the last one gone');
    // a new snapshot when the chain changes; nothing after unsub
    a.say({ op: 'sub', chain: 'bnb' });
    assert.deepEqual(a.of('snap').at(-1), { t: 'snap', chain: 'bnb', coins: [] });
    hub.addCoin('solana', coinIn(MINT2));
    assert.equal(a.of('c').length, 1, 'no longer a Solana viewer');
    assert.equal(hub.stats().clients, 2);
  } finally {
    hub.close();
  }
});

test('caps: a slow viewer misses batches, then gets everything again; far behind, it\'s dropped; too many or bad messages close it', () => {
  const hub = createHub({ log: createLog({ write: () => {} }), batchMs: 1e9, pingMs: 1e9, limits: { msgBurst: 5, msgPerSec: 0.0001 } });
  try {
    const slow = new FakeWs();
    hub.attach(slow);
    slow.say({ op: 'sub', chain: 'solana' });
    hub.addCoin('solana', coinIn(MINT));
    slow.bufferedAmount = LIMITS.high + 1;
    hub.setState('solana', 's1', curveAt(700_000_000));
    hub.flush();
    assert.equal(slow.of('u').length, 0, 'a batch skipped');
    slow.bufferedAmount = 0;
    hub.flush();
    const snaps = slow.of('snap');
    assert.equal(snaps.length, 2, 'caught up: a fresh snapshot');
    assert.deepEqual(snaps[1].coins[0].st, P.encodeState(curveAt(700_000_000)), 'with the newest state');
    slow.bufferedAmount = LIMITS.hard + 1;
    hub.setState('solana', 's1', curveAt(690_000_000));
    hub.flush();
    assert.ok(slow.terminated, 'far behind: dropped');
    // too many messages: closed (1008)
    const spam = new FakeWs();
    hub.attach(spam);
    for (let i = 0; i < 6; i++) spam.say({ op: 'unsub' });
    assert.equal(spam.closed && spam.closed.code, 1008);
    // a message too big, or binary: closed
    const big = new FakeWs();
    hub.attach(big);
    big.say('x'.repeat(LIMITS.maxMsgBytes + 1));
    assert.equal(big.closed && big.closed.code, 1008);
    const bin = new FakeWs();
    hub.attach(bin);
    bin.emit('message', Buffer.from([1, 2, 3]), true);
    assert.equal(bin.closed && bin.closed.code, 1008);
    // not JSON, or not ours: ignored
    const odd = new FakeWs();
    hub.attach(odd);
    odd.say('{nope');
    odd.say({ op: 'sub', chain: 'mars' });
    odd.say({ op: 'watch', ids: 'all' });
    assert.equal(odd.closed, null);
    assert.equal(odd.of('snap').length, 0);
    // at most 8 watched
    const w = new FakeWs();
    hub.attach(w);
    w.say({ op: 'sub', chain: 'solana' });
    for (let i = 0; i < 10; i++) hub.addCoin('solana', coinIn(`${MINT.slice(0, 40)}${String(i).padStart(4, '0')}`));
    w.say({ op: 'watch', ids: hub.coins('solana').map((c) => c.id) });
    assert.equal(hub.watched, 8);
    // the newest LIMITS.keep a chain (never one somebody watches)
    for (let i = 0; i < LIMITS.keep + 20; i++) hub.addCoin('solana', coinIn(`k${i}`.padEnd(44, 'x')));
    assert.equal(hub.coins('solana').length, LIMITS.keep);
    assert.equal(hub.coins('solana').filter((c) => c.watchers > 0).length, 8);
  } finally {
    hub.close();
  }
});

test('pings: a viewer that never answers is dropped; one that does stays', async () => {
  const hub = createHub({ log: createLog({ write: () => {} }), batchMs: 1e9, pingMs: 40 });
  try {
    const quiet = new FakeWs();
    const lively = new FakeWs();
    hub.attach(quiet);
    hub.attach(lively);
    lively.ping = function ping() {
      this.pings += 1;
      setImmediate(() => this.emit('pong'));
    };
    await until(() => quiet.terminated, 2000, 'the quiet one dropped');
    assert.ok(lively.pings >= 1);
    assert.equal(lively.terminated, false);
    assert.equal(hub.clients, 1);
  } finally {
    hub.close();
  }
});

test('backoff: 1 s, 2 s, 4 s… at most a minute, a little random', () => {
  const fixed = { rand: () => 0.5 };
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 30].map((n) => backoffMs(n, fixed)), [1000, 2000, 4000, 8000, 16000, 32000, 60000, 60000, 60000]);
  assert.equal(backoffMs(1, { rand: () => 0 }), 800);
  assert.equal(backoffMs(1, { rand: () => 1 }), 1200);
  assert.equal(backoffMs(0, fixed), 1000);
  assert.equal(backoffMs(3, { base: 10, max: 25, rand: () => 0.5 }), 25);
});

// ---------- the relay, whole: against the stand-in services ----------

const QUICK = { batchMs: 30, pingMs: 60_000, upstreamPingMs: 60_000, backoff: { base: 25, max: 150 }, picRetryMs: [50, 100], resyncMs: 20,
  checkMs: 40, takeoverMs: 600, dex: { prices: 60_000, pools: 80, discover: 120, markets: 120 },
  clank: { newest: 120, older: 60_000, trending: 60_000, liquidity: 60_000 } };
async function relayWith(fakes, env = {}, timing = {}) {
  const { cfg, problems, secrets } = readConfig(fakes.env({ TRENCH_PORT: '0', TRENCH_HOST: '127.0.0.1', TRENCH_ORIGINS: ORIGIN, ...env }));
  const lines = [];
  const log = createLog({ secrets, write: (l) => lines.push(l) });
  const relay = await startRelay(cfg, { log, problems, timing: { ...QUICK, ...timing } });
  return { relay, lines, url: `ws://127.0.0.1:${relay.port}/ws`, http: `http://127.0.0.1:${relay.port}` };
}
// a viewer: its messages as they come
function viewer(url, { origin = ORIGIN } = {}) {
  const ws = new WebSocket(url, { origin });
  const got = [];
  ws.on('message', (d) => got.push(JSON.parse(String(d))));
  const opened = new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });
  return { ws, got, opened, of: (t) => got.filter((m) => m.t === t), send: (o) => ws.send(JSON.stringify(o)) };
}

test('the relay whole: new coins and their trades live, pictures over https, every viewer the same, /health without a key', async () => {
  const fakes = await startFakes();
  const { relay, lines, url, http: base } = await relayWith(fakes, { TRENCH_CHAINS: 'solana,robinhood' });
  const v1 = viewer(url);
  const v2 = viewer(url);
  try {
    await Promise.all([v1.opened, v2.opened]);
    v1.send({ op: 'sub', chain: 'solana' });
    v2.send({ op: 'sub', chain: 'solana' });
    await until(() => v1.of('snap').length && v2.of('snap').length, 5000, 'snapshots');
    await until(async () => relay.helius && relay.helius.connected && relay.pump.primary.connected, 5000, 'its upstreams');
    const a = await fakes.launch({ name: 'Moon Frog', symbol: 'MFROG' });
    await until(() => v1.of('c').some((m) => m.c.m === a.mint) && v2.of('c').some((m) => m.c.m === a.mint), 5000, 'the new coin');
    const coin = L.parseCoin(v1.of('c').find((m) => m.c.m === a.mint).c, 'solana');
    assert.equal(coin.name, 'Moon Frog');
    assert.equal(coin.src, 'pump.fun');
    assert.equal(coin.tracked, true);
    // somebody buys: its new state, from Helius, to every viewer
    await until(() => fakes.seen.helius.some((m) => m.method === 'accountSubscribe' && m.params[0] === a.curveKey), 5000, 'its curve followed');
    const after = fakes.trade(a.mint, 2);
    const changed = (v) => v.of('u').some((m) => m.u.some(([id, st]) => id === coin.id && Math.abs(st[1] - after.vs) < 1e-5));
    await until(() => changed(v1) && changed(v2), 5000, 'the trade');
    // its picture, made small, from the relay's own address
    await until(() => v1.of('pic').some((m) => m.id === coin.id), 8000, 'its picture');
    const pic = v1.of('pic').find((m) => m.id === coin.id);
    assert.equal(pic.soc, 5, 'X and a website');
    const res = await fetch(`${base}${pic.p}`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/webp');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.match(res.headers.get('cache-control'), /immutable/);
    assert.equal(sniff(Buffer.from(await res.arrayBuffer())), 'webp');
    assert.equal((await fetch(`${base}/p/AAAAAAAAAAAAAAAAAAAAAA.webp`)).status, 404);
    assert.equal((await fetch(`${base}/p/../../etc/passwd`)).status, 404);
    assert.equal((await fetch(`${base}/`)).status, 404);
    assert.equal((await fetch(`${base}/health`, { method: 'POST' })).status, 405);
    // an SVG for a picture: never served
    const s = await fakes.launch({ name: 'Bad Pic', symbol: 'BAD', picture: 'svg' });
    const badId = await until(() => v1.of('c').find((m) => m.c.m === s.mint)?.c.id, 5000, 'the SVG coin');
    await until(() => relay.pictures.stats().failed >= 1, 8000, 'its picture refused');
    assert.equal(v1.of('pic').some((m) => m.id === badId), false);
    // migration: closed, then its pool from DexScreener
    fakes.migrate(a.mint);
    await until(() => v1.of('u').some((m) => m.u.some(([id, st]) => id === coin.id && st[0] === 'p')), 8000, 'its pool');
    // clank.trade's coins to Robinhood Chain's viewers only
    const cl = await fakes.clank({ name: 'Clank Cat', symbol: 'CCAT', marketCap: 2.5 });
    const v3 = viewer(url);
    await v3.opened;
    v3.send({ op: 'sub', chain: 'robinhood' });
    await until(() => v3.of('snap').some((m) => m.coins.some((c) => c.m === cl.address)) || v3.of('c').some((m) => m.c.m === cl.address), 8000, 'the clank.trade coin');
    assert.equal(v1.got.some((m) => m.t === 'c' && m.c.m === cl.address), false);
    const clCoin = L.parseCoin((v3.of('snap').flatMap((m) => m.coins).find((c) => c.m === cl.address)) || v3.of('c').find((m) => m.c.m === cl.address).c, 'robinhood');
    assert.equal(clCoin.src, 'clank.trade');
    assert.deepEqual(clCoin.st, { k: 'u', mu: 7500, lu: null, pg: 0.12, gr: false, cl: false });
    v3.ws.close();
    // /health: its chains, its sources, its pictures; never the key, never a viewer
    const h = await (await fetch(`${base}/health`)).json();
    assert.equal(h.ok, true);
    assert.equal(h.chains.solana.s, 'live');
    assert.ok(h.chains.solana.coins >= 2 && h.clients >= 2);
    assert.equal(h.solana.helius.connected, true);
    assert.equal(h.solana.pumpportal.connected, true);
    assert.ok(h.pictures.made >= 1);
    assert.deepEqual(h.prices && h.prices.sol, 150);
    const text = JSON.stringify(h);
    assert.ok(!text.includes(fakes.key) && !text.includes('127.0.0.1'), 'no key and no address in /health');
  } finally {
    v1.ws.close();
    v2.ws.close();
    await relay.close();
    await fakes.close();
  }
  assert.ok(!lines.join('\n').includes(fakes.key), 'the key never in its log');
});

test("Robinhood Chain: clank.trade's coins and other launchpads' listed on DexScreener; a coin both have is clank.trade's", async () => {
  // the owner's "Add DexScreener coins" (2026-10-21): coins from any launchpad on Robinhood Chain once their makers list
  // them on DexScreener, beside clank.trade's, which stays the chain's own source. clank.trade's list read often here, so
  // its rule for coins it no longer reaches runs during the test.
  const fakes = await startFakes();
  const { relay, url } = await relayWith(fakes, { TRENCH_CHAINS: 'robinhood,bnb' },
    { clank: { newest: 100, older: 150, trending: 60_000, liquidity: 60_000 } });
  const v = viewer(url);
  try {
    await v.opened;
    v.send({ op: 'sub', chain: 'robinhood' });
    await until(() => v.of('snap').length, 5000, 'its snapshot');
    const sent = (address) => v.of('snap').flatMap((m) => m.coins).find((c) => c.m === address) || v.of('c').find((m) => m.c.m === address)?.c;
    const cl = await fakes.clank({ name: 'Clank Cat', symbol: 'CCAT' });
    const other = await fakes.listed('robinhood', { name: 'Pool Pup', symbol: 'PUP', dexId: 'uniswap', mu: 80_000 });
    await until(() => sent(cl.address) && sent(other), 8000, 'both coins');
    const o = L.parseCoin(sent(other), 'robinhood');
    assert.equal(o.name, 'Pool Pup');
    assert.equal(o.ticker, 'PUP');
    assert.equal(o.src, null, 'no launchpad named: the board says "on Robinhood Chain"');
    assert.equal(o.tracked, true);
    assert.deepEqual([o.st.k, o.st.mu, o.st.gr], ['u', 80_000, true]);
    assert.equal(L.parseCoin(sent(cl.address), 'robinhood').src, 'clank.trade');
    await until(() => v.of('pic').some((m) => m.id === o.id), 8000, 'its picture, from its DexScreener profile');
    // a coin both have: one coin, clank.trade's
    await fakes.listed('robinhood', { address: cl.address, name: 'Clank Cat', symbol: 'CCAT', dexId: 'uniswap' });
    await new Promise((r) => setTimeout(r, 600));
    assert.equal(relay.hub.coins('robinhood').filter((c) => c.key === cl.address).length, 1);
    assert.equal(relay.hub.byKey('robinhood', cl.address).src, 'clank.trade');
    assert.notEqual(relay.hub.byKey('robinhood', cl.address).extra.dex, true);
    // a listed coin that clank.trade's list has too, later: clank.trade's from then on
    const late = await fakes.listed('robinhood', { name: 'Late Lister', symbol: 'LATE', dexId: 'uniswap' });
    await until(() => relay.hub.byKey('robinhood', late), 8000, 'the listed coin');
    assert.equal(relay.hub.byKey('robinhood', late).extra.dex, true);
    await fakes.clank({ name: 'Late Lister', symbol: 'LATE', address: late });
    await until(() => relay.hub.byKey('robinhood', late).extra.dex === false, 8000, 'clank.trade takes it over');
    assert.equal(relay.hub.coins('robinhood').filter((c) => c.key === late).length, 1);
    // more than clank.trade's three pages: its oldest coins let go, never a listed one (DexScreener's side follows those).
    // (The stand-in's list counts in whole seconds: 37 more a second later are its newest.)
    await new Promise((r) => setTimeout(r, 1100));
    for (let i = 0; i < 37; i++) await fakes.clank({ name: `Filler ${i}`, symbol: `FIL${i}` });
    await until(() => relay.hub.coins('robinhood').some((c) => !c.tracked && c.extra.dex !== true), 10_000, 'clank.trade lets its oldest go');
    assert.equal(relay.hub.byKey('robinhood', other).tracked, true, 'the listed coin still followed');
    // the chain's state is still clank.trade's; BNB Chain's listed coins as before
    assert.equal(relay.hub.state('robinhood').src, 'clank.trade');
    assert.ok(['live', 'quiet'].includes(relay.hub.state('robinhood').s), JSON.stringify(relay.hub.state('robinhood')));
    const bird = await fakes.listed('bsc', { name: 'Bnb Bird', symbol: 'BIRD' }); // (DexScreener's name for BNB Chain)
    await until(() => relay.hub.byKey('bnb', bird), 8000, 'the BNB Chain coin');
    assert.equal(relay.hub.byKey('bnb', bird).src, 'four.meme');
    assert.equal(relay.hub.state('bnb').src, 'DexScreener');
  } finally {
    v.ws.close();
    await relay.close();
    await fakes.close();
  }
});

test('older Clank and other-launchpad contracts can be found on demand and keep streaming while watched', async () => {
  const fakes = await startFakes();
  let relay, v, otherViewer;
  try {
    const old = Math.floor(Date.now() / 1000) - 7 * 86400;
    const hot = [];
    for (let i = 0; i < 3; i++) {
      const c = await fakes.clank({ name: `Old trending ${i}`, symbol: `HOT${i}` });
      fakes.clankSet(c.address, { createdAt: old });
      hot.push(c.address);
    }
    await fakes.clank({ name: 'AGI lookup fixture', symbol: 'AGI', address: AGI_CA.toLowerCase() });
    fakes.clankSet(AGI_CA.toLowerCase(), { createdAt: old });
    for (let i = 0; i < 36; i++) await fakes.clank({ name: `New launch ${i}`, symbol: `NEW${i}` });
    const listed = await fakes.listed('robinhood', { name: 'Older external coin', symbol: 'OLDER', dexId: 'uniswap', ageMs: 7 * 86400_000 });
    const started = await relayWith(fakes, { TRENCH_CHAINS: 'robinhood' },
      { clank: { newest: 100, older: 120, trending: 100, detail: 100, liquidity: 100 } });
    relay = started.relay;
    v = viewer(started.url);
    otherViewer = viewer(started.url);
    await Promise.all([v.opened, otherViewer.opened]);
    v.send({ op: 'sub', chain: 'robinhood' });
    otherViewer.send({ op: 'sub', chain: 'robinhood' });
    await until(() => hot.every((address) => relay.hub.byKey('robinhood', address)) && relay.hub.coins('robinhood').length >= 39,
      8000, 'older trending coins join the newest 36');
    assert.ok(hot.every((address) => relay.hub.byKey('robinhood', address).tracked), 'unknown trending contracts are discovered and followed');
    assert.equal(relay.hub.byKey('robinhood', AGI_CA.toLowerCase()), null, 'the searched coin is outside the newest and trending sets');
    assert.equal(relay.hub.byKey('robinhood', listed), null, 'an old external pair is absent from recent discovery');
    v.send({ op: 'lookup', address: AGI_CA });
    await until(() => v.of('lookup').some((m) => m.key === AGI_CA.toLowerCase() && m.status === 'found'), 8000, 'the exact mixed-case AGI contract');
    const agi = relay.hub.byKey('robinhood', AGI_CA.toLowerCase());
    assert.equal(agi.src, 'clank.trade');
    assert.equal(agi.tracked, true);
    v.send({ op: 'watch', ids: [agi.id] });
    await until(() => agi.watchers === 1, 1000, 'the opened coin is watched');
    fakes.clankSet(AGI_CA.toLowerCase(), { marketCap: 5, progress: 40 });
    await until(() => v.of('u').some((m) => m.u.some(([id, st]) => id === agi.id && st[1] === 15000 && st[3] === 0.4)),
      8000, 'an old watched Clank coin keeps receiving market updates');
    otherViewer.send({ op: 'lookup', address: listed.toUpperCase().replace('0X', '0x') });
    await until(() => otherViewer.of('lookup').some((m) => m.key === listed && m.status === 'found'), 8000, 'an older external contract');
    const external = relay.hub.byKey('robinhood', listed);
    assert.equal(external.src, null);
    assert.equal(external.extra.dex, true);
    assert.equal(external.tracked, true);
    otherViewer.send({ op: 'watch', ids: [external.id] });
    await fakes.listed('robinhood', { address: listed, name: 'Older external coin', symbol: 'OLDER', dexId: 'uniswap',
      ageMs: 7 * 86400_000, mu: 90000 });
    await until(() => otherViewer.of('u').some((m) => m.u.some(([id, st]) => id === external.id && st[1] === 90000)),
      8000, 'the external pair keeps receiving price updates');
  } finally {
    v?.ws.close();
    otherViewer?.ws.close();
    await relay?.close();
    await fakes.close();
  }
});

test('graduated Clank coins keep a fresh pool quote across list, detail and trending updates, with a stale-price fallback', async () => {
  let now = 1_792_000_100_000;
  let clankCap = 10000;
  let dexCap = 20000;
  let dexAvailable = true;
  const key = AGI_CA.toLowerCase();
  const calls = new Map();
  const writes = [];
  const raw = () => ({ address: key, name: 'Artificial Girlfriend Intelligence', symbol: 'AGI', state: 3, progress: 100,
    createdAt: (now - 86400_000) / 1000, marketCap: clankCap / 2000, quoteCurrency: P.CLANK_ETH });
  const hub = createHub({ chains: ['robinhood'], now: () => now, batchMs: 60000, pingMs: 60000 });
  const setState = hub.setState;
  hub.setState = (chain, id, state, dx) => {
    writes.push(state.mu);
    return setState(chain, id, state, dx);
  };
  const source = createClank({ cfg: { clank: 'https://clank.example/' }, hub, now: () => now,
    pictures: { request() {} }, log: createLog({ write: () => {} }),
    every: { newest: 20, older: 30, trending: 25, liquidity: 20, detail: 25 },
    fetchJson: async (url) => new URL(url).pathname.slice(1).split(',').map((name) => {
      calls.set(name, (calls.get(name) || 0) + 1);
      const data = name === 'coins.list' ? { coins: [raw()], nextCursor: null }
        : name === 'coins.detail' ? raw()
          : name === 'coins.trending' ? [{ address: key, marketCapUsdg: clankCap, isLive: true }]
            : { price: 2000 };
      return { result: { data } };
    }),
    dex: { pairs: async () => dexAvailable ? [{ chainId: 'robinhood', dexId: 'uniswap', baseToken: { address: key },
      marketCap: dexCap, liquidity: { usd: 5000 } }] : [] } });
  const count = (name) => calls.get(name) || 0;
  const allRefreshes = async () => {
    const names = ['coins.list', 'coins.detail', 'coins.trending'];
    const before = names.map(count);
    await until(() => names.every((name, i) => count(name) >= before[i] + 3), 1000, 'all competing Clank refreshes');
  };
  try {
    source.start();
    await until(() => hub.byKey('robinhood', key)?.st.mu === dexCap, 1000, 'the first pool quote');
    writes.length = 0;
    clankCap = 12000;
    await allRefreshes();
    assert.ok(writes.length > 3);
    assert.ok(writes.every((mu) => mu === 20000), `fresh Dex quote must not oscillate with Clank: ${writes}`);
    dexCap = 25000;
    await until(() => hub.byKey('robinhood', key).st.mu === dexCap, 1000, 'the newer pool quote');
    writes.length = 0;
    await allRefreshes();
    assert.ok(writes.every((mu) => mu === 25000), `the updated pool quote stays canonical: ${writes}`);

    dexAvailable = false;
    now += 59999;
    writes.length = 0;
    await allRefreshes();
    assert.ok(writes.every((mu) => mu === 25000), 'a brief Dex gap keeps its still-fresh price');
    now += 2;
    await until(() => hub.byKey('robinhood', key).st.mu === clankCap, 1000, 'Clank takes over when the pool quote is stale');
    writes.length = 0;
    await allRefreshes();
    assert.ok(writes.every((mu) => mu === 12000), 'stale pool data no longer overrides fresh Clank data');
    dexAvailable = true;
    dexCap = 30000;
    await until(() => hub.byKey('robinhood', key).st.mu === dexCap, 1000, 'fresh Dex data recovers');
    writes.length = 0;
    await allRefreshes();
    assert.ok(writes.every((mu) => mu === 30000));
  } finally {
    source.stop();
    hub.close();
  }
});

test('Solana lookup finds an older pool with its exact case and retains a known pump curve source', async () => {
  const fakes = await startFakes();
  let relay, v, curveViewer;
  try {
    const old = await fakes.launch({ name: 'Old Solana pool', symbol: 'OLDPOOL' });
    fakes.migrate(old.mint);
    fakes.pump.get(old.mint).poolAt = Date.now() - 7 * 86400_000;
    const started = await relayWith(fakes, { TRENCH_CHAINS: 'solana' });
    relay = started.relay;
    v = viewer(started.url);
    curveViewer = viewer(started.url);
    await Promise.all([v.opened, curveViewer.opened]);
    v.send({ op: 'sub', chain: 'solana' });
    curveViewer.send({ op: 'sub', chain: 'solana' });
    assert.equal(relay.hub.byKey('solana', old.mint), null, 'the launch occurred before the relay connected');
    v.send({ op: 'lookup', address: old.mint });
    await until(() => v.of('lookup').some((m) => m.key === old.mint && m.status === 'found'), 8000, 'the old Solana pair');
    const pool = relay.hub.byKey('solana', old.mint);
    assert.equal(pool.key, old.mint);
    assert.equal(pool.extra.dex, true);
    assert.equal(pool.tracked, true);
    v.send({ op: 'watch', ids: [pool.id] });
    const before = pool.st.mu;
    fakes.poolTrade(old.mint, 1.5);
    await until(() => pool.st.mu > before * 2, 8000, 'the searched Solana pool keeps updating');
    assert.equal(pool.tracked, true, 'the pump source does not stop following a DEX-owned coin');
    assert.ok(v.of('c').some((m) => m.c.m === old.mint), 'the full coin keeps the original base58 spelling');

    await until(() => fakes.seen.pumpportal.some((m) => m.method === 'subscribeNewToken'), 3000, 'pump discovery connected');
    const current = await fakes.launch({ name: 'Known curve', symbol: 'CURVE' });
    await until(() => relay.hub.byKey('solana', current.mint), 3000, 'the current pump curve');
    const curve = relay.hub.byKey('solana', current.mint);
    curveViewer.send({ op: 'lookup', address: current.mint });
    await until(() => curveViewer.of('lookup').some((m) => m.key === current.mint && m.status === 'found'), 3000, 'the retained pump curve');
    assert.equal(curve.st.k, 'c');
    assert.equal(curve.src, 'pump.fun');
    assert.notEqual(curve.extra.dex, true, 'search does not replace an exact pump curve with a DEX estimate');
  } finally {
    v?.ws.close();
    curveViewer?.ws.close();
    await relay?.close();
    await fakes.close();
  }
});

// (2026-10-22, the owner: "i just checked there are other chains on gmgn right add that also if i have to add api key again
// on each chain like the helius api so it tells live coins tell me that also"): no new key, DexScreener's listed coins
test("GMGN's other chains: Ethereum, Monad, HyperEVM, Arbitrum and Tron's listed coins (Tron's addresses as they are), each in its own money, no new key; a day's count of every chain listed", async () => {
  const TRON_ADDR = 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';
  const EVM_ADDR = '0xABCDEF0123456789ABCDEF0123456789ABCDEF01';
  // the relay's checks: a Tron address as it is (case-sensitive), an EVM one lower-cased, nothing else
  assert.equal(P.addressOn('tron', TRON_ADDR), TRON_ADDR);
  assert.equal(P.addressOn('tron', TRON_ADDR.toLowerCase()), null);
  assert.equal(P.addressOn('solana', MINT), MINT, 'Solana lookup addresses retain their case');
  assert.equal(P.addressOn('solana', MINT.toLowerCase()), MINT.toLowerCase(), 'another base58 spelling is a different address');
  assert.equal(P.addressOn('solana', EVM_ADDR), null);
  assert.equal(P.addressOn('solana', '0' + MINT.slice(1)), null);
  assert.equal(P.addressOn('ethereum', EVM_ADDR), EVM_ADDR.toLowerCase());
  assert.equal(P.addressOn('monad', TRON_ADDR), null);
  assert.equal(P.addressOn('tron', EVM_ADDR), null);
  assert.deepEqual(P.parseProfiles([{ chainId: 'tron', tokenAddress: TRON_ADDR, icon: 'https://cdn.example/t.png' },
    { chainId: 'tron', tokenAddress: TRON_ADDR.toLowerCase() }, { chainId: 'ethereum', tokenAddress: EVM_ADDR }, { chainId: 'tron', tokenAddress: EVM_ADDR },
    { chainId: 'xlayer', tokenAddress: EVM_ADDR }], ['tron', 'ethereum']),
  [{ chain: 'tron', address: TRON_ADDR, icon: 'https://cdn.example/t.png' }, { chain: 'ethereum', address: EVM_ADDR.toLowerCase(), icon: null }]);
  // their own coins' prices: WHYPE, WMON and WTRX (Tron's address exactly), each inside what it can be
  assert.deepEqual(Object.fromEntries(['hype', 'mon', 'trx'].map((w) => [w, P.WRAPPED[w].chain])), { hype: 'hyperevm', mon: 'monad', trx: 'tron' });
  const pairOf = (chainId, address, priceUsd) => [{ chainId, baseToken: { address }, priceUsd, liquidity: { usd: 1e6 } }];
  assert.equal(P.wrappedUsd(pairOf('tron', P.WRAPPED.trx.address, '0.31'), 'trx'), 0.31);
  assert.equal(P.wrappedUsd(pairOf('tron', P.WRAPPED.trx.address.toLowerCase(), '0.31'), 'trx'), null, 'Tron\'s address is case-sensitive');
  assert.equal(P.wrappedUsd(pairOf('monad', P.WRAPPED.mon.address.toUpperCase().replace('0X', '0x'), '0.0213'), 'mon'), 0.0213);
  assert.equal(P.wrappedUsd(pairOf('hyperevm', P.WRAPPED.hype.address, '999999'), 'hype'), null, 'never nonsense');
  // the game's side: their coins read (Tron's address kept as it is), their money (MON's two cents too)
  const wire = (m, id) => ({ id, m, n: 'Tron Toad', s: 'TOAD', b: 1_792_000_000_000, st: ['u', 50000, 12000, -1, 1, 0], tr: 1 });
  assert.equal(L.parseCoin(wire(TRON_ADDR, 't1'), 'tron').key, TRON_ADDR);
  assert.equal(L.parseCoin(wire(TRON_ADDR.toLowerCase(), 't1'), 'tron'), null);
  assert.equal(L.parseCoin(wire(EVM_ADDR, 'e1'), 'ethereum').key, EVM_ADDR.toLowerCase());
  assert.equal(L.parseCoin(wire(TRON_ADDR, 'x1'), 'tron'), null, 'a letter no chain has');
  assert.deepEqual(L.parseMessage(JSON.stringify({ t: 'off', ids: ['e7', 'm7', 'h7', 'f7', 't7', 'x7'] }), 'tron').ids, ['e7', 'm7', 'h7', 'f7', 't7']);
  assert.deepEqual(L.parseMessage(JSON.stringify({ t: 'px', sol: 150, mon: 0.0213, hype: 24.5, trx: 0.31, doge: 1 }), 'monad').px,
    { sol: 150, mon: 0.0213, hype: 24.5, trx: 0.31 });
  for (const [coin, usdPx, words] of [['mon', 0.02, '7,500 MON'], ['hype', 25, '6 HYPE'], ['trx', 0.3, '500 TRX']]) {
    const cur = { coin, usd: usdPx };
    assert.ok(isCoinCurrency(cur), coin);
    assert.equal(money(1, cur, 150), words, `1 SOL in ${coin}`);
    assert.ok(Math.abs(freeStartSol(1, cur, 150) - 1) < 1e-9, `${coin}: free play's start a round amount of it`);
  }
  // the relay, whole, with three of them on: listed coins come in, each chain's own letter, its money priced only while it's on
  const fakes = await startFakes();
  const { relay, url, http: base } = await relayWith(fakes, { TRENCH_CHAINS: 'ethereum,monad,tron' });
  const v = viewer(url);
  try {
    await v.opened;
    v.send({ op: 'sub', chain: 'tron' });
    await until(() => v.of('snap').length, 5000, 'its snapshot');
    assert.deepEqual(Object.keys(v.of('hi')[0].ch), ['ethereum', 'monad', 'tron']);
    const toad = await fakes.listed('tron', { name: 'Tron Toad', symbol: 'TOAD', dexId: 'sunpump' });
    assert.match(toad, /^T[1-9A-HJ-NP-Za-km-z]{33}$/);
    await until(() => relay.hub.byKey('tron', toad), 8000, 'the Tron coin');
    assert.match(relay.hub.byKey('tron', toad).id, /^t\d+$/);
    const got = await until(() => v.of('c').find((m) => m.c.m === toad)?.c, 5000, 'its coin, to the Tron viewer');
    const coin = L.parseCoin(got, 'tron');
    assert.deepEqual([coin.key, coin.name, coin.ticker, coin.src, coin.st.k], [toad, 'Tron Toad', 'TOAD', null, 'u']);
    const elk = await fakes.listed('ethereum', { name: 'Eth Elk', symbol: 'ELK', dexId: 'uniswap' });
    await until(() => relay.hub.byKey('ethereum', elk), 8000, 'the Ethereum coin');
    assert.match(relay.hub.byKey('ethereum', elk).id, /^e\d+$/);
    assert.equal(v.of('c').some((m) => m.c.m === elk), false, 'an Ethereum coin never goes to a Tron viewer');
    await until(() => relay.hub.px && relay.hub.px.trx === 0.3 && relay.hub.px.mon === 0.02, 5000, 'TRX\'s and MON\'s prices');
    assert.equal(relay.hub.px.hype, undefined, 'HyperEVM is off here: HYPE is never asked for');
    assert.equal(relay.hub.state('tron').src, 'DexScreener');
    // a day's count of the chains DexScreener lists coins on (the owner adds X Layer or MegaETH once they show up there)
    const health = await (await fetch(`${base}/health`)).json();
    assert.ok(health.dexscreener.profiles.byChain.tron >= 1 && health.dexscreener.profiles.byChain.ethereum >= 1, JSON.stringify(health.dexscreener.profiles));
    assert.ok(health.dexscreener.profiles.sinceS >= 0);
  } finally {
    v.ws.close();
    await relay.close();
    await fakes.close();
  }
  // the owner's settings file names them, and the relay's only key is still Helius's
  const example = readFileSync('tools/trench-relay/trench.env.example', 'utf8');
  assert.match(example, /^TRENCH_CHAINS=solana,robinhood,bnb,base,ethereum,monad,hyperevm,arbitrum,tron$/m);
  assert.deepEqual(example.match(/^[A-Z_]*KEY[A-Z_]*=/gm), ['HELIUS_API_KEY=']);
});

test("the relay's door: only the site's own pages, at most so many viewers (a full relay says so), at most so many from one address", async () => {
  const fakes = await startFakes();
  const { relay, url } = await relayWith(fakes, { TRENCH_CHAINS: 'bnb', TRENCH_MAX_CLIENTS: '2', TRENCH_MAX_PER_IP: '3' });
  const open = [];
  try {
    // another site's page: refused before it's a WebSocket
    const other = viewer(url, { origin: 'https://evil.example' });
    await assert.rejects(other.opened, /403/);
    const noOrigin = new WebSocket(url);
    await assert.rejects(new Promise((res, rej) => {
      noOrigin.on('open', res);
      noOrigin.on('error', rej);
    }), /403/);
    // two viewers fit; a third hears "try again later" (1013) and is closed
    for (let i = 0; i < 2; i++) {
      const v = viewer(url);
      await v.opened;
      open.push(v);
    }
    const third = new WebSocket(url, { origin: ORIGIN });
    const code = await new Promise((r) => third.on('close', (c) => r(c)));
    assert.equal(code, 1013);
    await until(() => relay.hub.clients === 2, 2000, 'still two');
    // one address: at most TRENCH_MAX_PER_IP
    open.forEach((v) => v.ws.close());
    await until(() => relay.hub.clients === 0, 2000, 'none');
    const mine = [];
    for (let i = 0; i < 2; i++) {
      const v = viewer(url);
      await v.opened;
      mine.push(v);
    }
    open.push(...mine);
    assert.equal(relay.hub.clients, 2);
  } finally {
    open.forEach((v) => v.ws.close());
    await relay.close();
    await fakes.close();
  }
  // per address, with a smaller cap
  const f2 = await startFakes();
  const { relay: r2, url: u2 } = await relayWith(f2, { TRENCH_CHAINS: 'bnb', TRENCH_MAX_PER_IP: '1' });
  const first = viewer(u2);
  try {
    await first.opened;
    const second = viewer(u2);
    await assert.rejects(second.opened, /429/);
  } finally {
    first.ws.close();
    await r2.close();
    await f2.close();
  }
});

test('reconnects: PumpPortal drops and PumpDev takes over, then hands back; Helius drops and every curve is followed again', async () => {
  const fakes = await startFakes();
  const { relay, lines, url } = await relayWith(fakes, { TRENCH_CHAINS: 'solana' });
  const v = viewer(url);
  try {
    await v.opened;
    v.send({ op: 'sub', chain: 'solana' });
    const subscribed = () => fakes.seen.pumpportal.filter((m) => m.method === 'subscribeNewToken').length;
    await until(() => relay.pump.primary.connected && relay.helius.connected && subscribed() === 1, 5000, 'connected');
    await until(() => fakes.seen.pumpportal.some((m) => m.method === 'subscribeMigration'), 3000, 'migrations too');
    assert.equal(subscribed(), 1, 'one connection, both subscriptions on it');
    assert.equal(fakes.seen.pumpportal.filter((m) => m.method === 'subscribeMigration').length, 1);
    const a = await fakes.launch({ name: 'First', symbol: 'ONE' });
    await until(() => v.of('c').some((m) => m.c.m === a.mint), 5000, 'the first coin');
    // PumpPortal goes away: nothing new from it; after a while PumpDev takes over
    fakes.setDown('pumpportal');
    // (connected comes as its socket opens; its subscription reaches the stand-in a moment later: waited for, never assumed)
    const devSubscribed = () => fakes.seen.pumpdev.filter((m) => m.method === 'subscribeNewToken').length;
    await until(() => relay.pump.backup.running && relay.pump.backup.connected && devSubscribed() >= 1, 6000, 'PumpDev taking over');
    assert.equal(devSubscribed(), 1);
    const b = await fakes.launch({ name: 'Second', symbol: 'TWO', via: 'pumpdev' });
    await until(() => v.of('c').some((m) => m.c.m === b.mint), 5000, 'a coin through PumpDev');
    // PumpPortal is back: it reconnects by itself (and subscribes again); its first new coin hands back
    fakes.setDown('pumpportal', false);
    await until(() => relay.pump.primary.connected && subscribed() >= 2, 5000, 'PumpPortal again, subscribed again');
    assert.equal(subscribed(), 2);
    const c = await fakes.launch({ name: 'Third', symbol: 'THREE' });
    await until(() => v.of('c').some((m) => m.c.m === c.mint), 5000, 'a coin through PumpPortal again');
    await until(() => !relay.pump.backup.running, 5000, 'PumpDev stopped');
    // Helius goes away and comes back: every followed curve subscribed again, and read again at once
    const subs = () => fakes.seen.helius.filter((m) => m.method === 'accountSubscribe' && m.params[0] === a.curveKey).length;
    await until(() => subs() === 1, 3000, 'one subscription');
    fakes.setDown('helius');
    await until(() => !relay.helius.connected, 3000, 'Helius down');
    await until(() => relay.hub.state('solana').s === 'down', 3000, 'Solana down');
    fakes.setDown('helius', false);
    await until(() => relay.helius.connected && subs() === 2, 6000, 'subscribed again');
    const after = fakes.trade(a.mint, 1.5);
    await until(() => v.of('u').some((m) => m.u.some(([, st]) => Math.abs(st[1] - after.vs) < 1e-5)), 5000, 'a trade after the reconnect');
    await until(() => relay.hub.state('solana').s === 'live', 3000, 'Solana live again');
  } finally {
    v.ws.close();
    await relay.close();
    await fakes.close();
  }
  assert.ok(lines.some((l) => /PumpDev takes over/.test(l)) && lines.some((l) => /PumpDev stops/.test(l)), 'its log says so');
});

test('PumpPortal off in the settings: PumpDev sends the new coins from the start, and PumpPortal is never asked', async () => {
  const fakes = await startFakes();
  const { relay, lines, url } = await relayWith(fakes, { TRENCH_CHAINS: 'solana', PUMPPORTAL_WS_URL: 'off' });
  const v = viewer(url);
  try {
    await v.opened;
    v.send({ op: 'sub', chain: 'solana' });
    assert.equal(relay.pump.primary, null);
    await until(() => relay.pump.backup.running && relay.pump.backup.connected && relay.helius.connected, 5000, 'PumpDev at once');
    await until(() => fakes.seen.pumpdev.some((m) => m.method === 'subscribeNewToken'), 3000, 'subscribed to new coins');
    const a = await fakes.launch({ name: 'Only Dev', symbol: 'ODEV', via: 'pumpdev' });
    await until(() => v.of('c').some((m) => m.c.m === a.mint), 5000, 'a coin through PumpDev');
    await until(() => relay.hub.state('solana').s === 'live', 3000, 'Solana live');
    const h = relay.health();
    assert.equal(h.solana.pumpportal, null, '/health says it\'s off');
    assert.equal(h.solana.pumpdev.running, true);
  } finally {
    v.ws.close();
    await relay.close();
    await fakes.close();
  }
  assert.equal(fakes.seen.pumpportal.length, 0, 'nothing ever sent to PumpPortal');
  assert.ok(lines.some((l) => /PumpPortal is off in the settings: PumpDev sends the new coins/.test(l)), 'its log says so');
  assert.ok(!lines.some((l) => /PumpDev takes over|PumpDev stops/.test(l)), 'never the takeover dance');
});

test('a Helius key Helius refuses: Solana is down, and the key is in no log line and no answer', async () => {
  const fakes = await startFakes({ key: 'the-right-key-0000000000' });
  const wrong = 'wrong-key-9f8e7d6c5b4a3210fedcba';
  const { relay, lines, http: base } = await relayWith(fakes, { TRENCH_CHAINS: 'solana', HELIUS_API_KEY: `http://127.0.0.1:${fakes.port}/?api-key=${wrong}` });
  try {
    await until(() => lines.some((l) => /Helius: .*401/.test(l)), 5000, 'Helius refusing');
    await fakes.launch({});
    await until(() => relay.hub.coins('solana').length === 1, 5000, 'a coin anyway');
    await until(() => relay.hub.state('solana').s === 'down', 3000, 'Solana down without Helius');
    const h = await (await fetch(`${base}/health`)).text();
    assert.ok(!h.includes(wrong));
  } finally {
    await relay.close();
    await fakes.close();
  }
  const all = lines.join('\n');
  assert.ok(!all.includes(wrong), 'never in the log');
  assert.ok(lines.length > 2, 'it did log');
  // no key at all: Solana says it's off, why, and nothing tries Helius
  const f2 = await startFakes();
  const { cfg } = readConfig({ ...f2.env({ TRENCH_PORT: '0', TRENCH_HOST: '127.0.0.1', TRENCH_CHAINS: 'solana' }), HELIUS_API_KEY: '' });
  const r2 = await startRelay(cfg, { log: createLog({ write: () => {} }), timing: QUICK });
  try {
    assert.equal(r2.helius, null);
    await until(() => r2.hub.state('solana').s === 'off', 3000, 'Solana off');
    assert.equal(r2.hub.state('solana').why, 'no Helius key');
  } finally {
    await r2.close();
    await f2.close();
  }
});

// ---------- the game's side: Live mode's own rules ----------

test("Live mode's chains, the money each terminal shows in it, and which challenges it plays", () => {
  // (GMGN's other chains since 2026-10-22, the owner's "i just checked there are other chains on gmgn right add that also")
  assert.deepEqual(L.CHAINS.map((c) => c.id), ['solana', 'robinhood', 'bnb', 'base', 'ethereum', 'monad', 'hyperevm', 'arbitrum', 'tron']);
  assert.deepEqual(L.CHAINS.map((c) => c.name), ['Solana', 'Robinhood Chain', 'BNB Chain', 'Base', 'Ethereum', 'Monad', 'HyperEVM', 'Arbitrum', 'Tron']);
  assert.equal(L.DEFAULT_CHAIN, 'solana');
  assert.equal(L.chainById('robinhood').src, 'clank.trade');
  assert.equal(L.chainById('solana').src, 'pump.fun');
  assert.equal(L.chainById('mars'), null);
  // a run's line names a launchpad only where every coin comes from it: Solana's pump.fun; Robinhood Chain's coins come
  // from clank.trade and, since 2026-10-21 (the owner's "Add DexScreener coins"), other launchpads' listed ones
  assert.deepEqual(L.CHAINS.map((c) => c.allFrom), [true, false, false, false, false, false, false, false, false]);
  assert.equal(L.feedWords('live', 'live', 'robinhood', 'before').text,
    'Live: every new clank.trade coin as it launches, and others as they get listed on Robinhood Chain, traded with play money.');
  assert.match(readFileSync('src/games/trenchingsimulator/shell.js', 'utf8'),
    /`Live · \$\{c\.name\} · real coins\$\{c\.src && c\.allFrom \? ` from \$\{c\.src\}` : ''\} · play money only`/);
  // the owner's: Pomp.fun and GNGM the chain's own coin (Pomp.fun's since the owner's "Each chain's money", 2026-10-21:
  // SOL on every chain before), BasedBott ETH, Phomo dollars, Axium its counterpart's (SOL)
  for (const ch of L.CHAIN_IDS) {
    assert.equal(L.liveCurrency('chat', ch), 'eth');
    assert.equal(L.liveCurrency('social', ch), 'usd');
    assert.equal(L.liveCurrency('pro', ch), 'sol');
  }
  assert.deepEqual(L.CHAIN_IDS.map((ch) => L.liveCurrency('board', ch)), ['sol', 'eth', 'bnb', 'eth', 'eth', 'mon', 'hype', 'eth', 'trx']);
  assert.deepEqual(L.CHAIN_IDS.map((ch) => L.liveCurrency('scan', ch)), ['sol', 'eth', 'bnb', 'eth', 'eth', 'mon', 'hype', 'eth', 'trx']);
  assert.equal(L.liveCurrency('nope', 'nope'), 'sol');
  const px = { sol: 150, eth: 3000, bnb: 600, mon: 0.0213, hype: 24.5, trx: 0.31 };
  // a live run's money for ./format.js: the chain's coin with its price frozen for the run; wait until its quote is known
  assert.deepEqual(L.CHAIN_IDS.slice(0, 4).map((ch) => L.liveMoney('board', ch, px)),
    ['sol', { coin: 'eth', usd: 3000 }, { coin: 'bnb', usd: 600 }, { coin: 'eth', usd: 3000 }]);
  assert.deepEqual(['ethereum', 'monad', 'hyperevm', 'arbitrum', 'tron'].map((ch) => L.liveMoney('board', ch, px)),
    [{ coin: 'eth', usd: 3000 }, { coin: 'mon', usd: 0.0213 }, { coin: 'hype', usd: 24.5 }, { coin: 'eth', usd: 3000 }, { coin: 'trx', usd: 0.31 }]);
  assert.deepEqual(L.liveMoney('board', 'monad', { sol: 150, mon: 0.0041237 }), { coin: 'mon', usd: 0.004124 }, 'under a dollar: never rounded to nothing');
  assert.deepEqual(L.UNIT_NAMES, { sol: 'SOL', eth: 'ETH', bnb: 'BNB', mon: 'MON', hype: 'HYPE', trx: 'TRX', usd: 'dollars' });
  assert.deepEqual(L.liveMoney('board', 'robinhood', { sol: 150, eth: 2612.4567 }), { coin: 'eth', usd: 2612.46 });
  for (const bad of [{ sol: 150 }, { eth: 0 }, { eth: -1 }, { eth: 'x' }, null, undefined]) {
    assert.equal(L.liveMoney('board', 'robinhood', bad), null, JSON.stringify(bad));
  }
  assert.equal(L.liveMoney('social', 'robinhood', px), 'usd');
  assert.equal(L.liveMoney('pro', 'robinhood', px), 'sol');
  assert.equal(L.toUnit(2, 'sol', px), 2);
  assert.equal(L.toUnit(2, 'usd', px), 300);
  assert.equal(L.toUnit(2, 'eth', px), 0.1);
  assert.equal(L.toUnit(2, 'bnb', px), 0.5);
  assert.ok(Number.isNaN(L.toUnit(2, 'eth', { sol: 150 })));
  // the daily market is never live; nor is the challenge that ends on a rug (a real coin is never called one)
  assert.deepEqual(CHALLENGES.filter((c) => !L.liveOk(c)).map((c) => c.id), ['rug-dodger']);
  assert.equal(L.liveOk({ ...challengeById('double-up'), daily: '2026-10-21' }), false);
  assert.equal(L.liveOk(null), false);
});

test('lookup replies validate the chain, full contract address and result status before reaching the page', () => {
  for (const chain of L.CHAIN_IDS) {
    const key = chain === 'solana' ? MINT : chain === 'tron' ? P.WRAPPED.trx.address : AGI_CA;
    const normalized = ['solana', 'tron'].includes(chain) ? key : key.toLowerCase();
    for (const status of ['found', 'missing', 'busy', 'unavailable']) {
      const raw = { t: 'lookup', chain, key, status, extra: 'ignored' };
      assert.deepEqual(L.parseMessage(JSON.stringify(raw), chain), { t: 'lookup', key: normalized, status });
      assert.equal(L.parseMessage(JSON.stringify({ ...raw, chain: 'wrong' }), chain), null);
      for (const bad of ['', '0x1234', 'https://example.com', 42, null]) {
        assert.equal(L.parseMessage(JSON.stringify({ ...raw, key: bad }), chain), null);
      }
      for (const bad of ['ready', '', 1, null]) assert.equal(L.parseMessage(JSON.stringify({ ...raw, status: bad }), chain), null);
    }
  }
  assert.equal(L.parseMessage(JSON.stringify({ t: 'lookup', chain: 'tron', key: P.WRAPPED.trx.address.toLowerCase(), status: 'found' }), 'tron'), null);
});

test('native live money waits for its own quote instead of silently showing SOL, then freezes the received price', () => {
  const expected = { solana: 'sol', robinhood: 'eth', bnb: 'bnb', base: 'eth', ethereum: 'eth', monad: 'mon',
    hyperevm: 'hype', arbitrum: 'eth', tron: 'trx' };
  const prices = { sol: 150, eth: 3000, bnb: 600, mon: 0.02, hype: 25, trx: 0.3 };
  for (const terminal of ['board', 'scan']) {
    for (const [chain, coin] of Object.entries(expected)) {
      if (coin === 'sol') {
        assert.equal(L.liveMoney(terminal, chain, {}), 'sol');
        continue;
      }
      for (const bad of [undefined, null, 0, -1, NaN, Infinity]) {
        assert.equal(L.liveMoney(terminal, chain, { sol: 150, [coin]: bad }), null,
          `${terminal}/${chain}: no ${coin} quote must not fall back to SOL`);
      }
      const px = { ...prices };
      const currency = L.liveMoney(terminal, chain, px);
      assert.deepEqual(currency, { coin, usd: prices[coin] }, `${terminal}/${chain}: quote received`);
      px[coin] *= 2;
      assert.equal(currency.usd, prices[coin], `${terminal}/${chain}: an active run keeps its original conversion`);
    }
  }
});

test("the relay's address: the site's own; another only on this computer, and only one on this computer too", () => {
  const at = (hostname, search = '') => L.relayUrl({ hostname, search });
  assert.equal(L.RELAY_URL, 'wss://live.agi1.app/ws');
  assert.equal(at('agi1.app'), L.RELAY_URL);
  assert.equal(at('www.agi1.app', '?relay=wss%3A%2F%2Fevil.example%2Fws'), L.RELAY_URL, 'never from a link on the site');
  assert.equal(at('agi1.app', '?relay=ws%3A%2F%2F127.0.0.1%3A8787%2Fws'), L.RELAY_URL, 'not even a local one from the site');
  assert.equal(at('preview.vercel.app', '?relay=ws%3A%2F%2F127.0.0.1%3A8787%2Fws'), L.RELAY_URL);
  assert.equal(at('localhost', '?relay=ws%3A%2F%2F127.0.0.1%3A8787%2Fws'), 'ws://127.0.0.1:8787/ws');
  assert.equal(at('127.0.0.1', '?relay=ws://localhost:9999/ws'), 'ws://localhost:9999/ws');
  assert.equal(at('localhost', '?relay=wss%3A%2F%2Fevil.example%2Fws'), L.RELAY_URL, 'this computer only');
  assert.equal(at('localhost', '?relay=https%3A%2F%2F127.0.0.1%2F'), L.RELAY_URL, 'a WebSocket only');
  assert.equal(at('localhost', '?relay=ws%3A%2F%2Fa%3Ab%40127.0.0.1%2Fws'), L.RELAY_URL);
  assert.equal(at('localhost', '?relay=%%%'), L.RELAY_URL);
  assert.equal(L.relayUrl(null), L.RELAY_URL);
  assert.equal(L.picUrl(L.RELAY_URL, '/p/abcdefghijklmnopqrstuv.webp'), 'https://live.agi1.app/p/abcdefghijklmnopqrstuv.webp');
  assert.equal(L.picUrl('ws://127.0.0.1:8787/ws', '/p/abcdefghijklmnopqrstuv.webp'), 'http://127.0.0.1:8787/p/abcdefghijklmnopqrstuv.webp');
  for (const bad of ['/p/../x.webp', 'https://evil.example/p/abcdefghijklmnopqrstuv.webp', '/p/short.webp', null]) {
    assert.equal(L.picUrl(L.RELAY_URL, bad), null, String(bad));
  }
});

test('Live mode is open on the site since its relay runs (LIVE_OPEN), always with our relay; closed again, it says "coming soon"', () => {
  // the owner's choice (2026-10-21): "Coming soon" until the relay ran on the owner's server, then one small push,
  // LIVE_OPEN = true (and this line with it: CLAUDE.md, Live mode's steps). LIVE_OPEN = false closes it again.
  assert.equal(L.LIVE_OPEN, true, 'open on the site: its relay runs (relay.sh check all ok, 2026-10-21)');
  const at = (hostname, search = '') => ({ hostname, search });
  for (const [loc, why] of [[at('agi1.app'), 'the site'], [at('www.agi1.app'), 'the site'],
    [at('www.agi1.app', '?relay=ws%3A%2F%2F127.0.0.1%3A8787%2Fws'), 'a link on the site'],
    [at('preview.vercel.app', '?relay=ws://127.0.0.1:8787/ws'), 'a preview'],
    [at('localhost'), 'this computer without a relay of its own'],
    [at('localhost', '?relay=wss%3A%2F%2Fevil.example%2Fws'), 'a relay that isn\'t on this computer'],
    [at('localhost', '?relay=%%%'), 'a broken address'], [null, 'no address at all']]) {
    assert.equal(L.liveOpen(loc), L.LIVE_OPEN, why);
    assert.equal(L.relayUrl(loc), L.RELAY_URL, `${why}: only ever our relay`);
  }
  // the tests: this computer, with a relay of its own on it (open whatever LIVE_OPEN says)
  assert.equal(L.liveOpen(at('localhost', '?relay=ws%3A%2F%2F127.0.0.1%3A8787%2Fws')), true);
  assert.equal(L.liveOpen(at('127.0.0.1', '?relay=ws://localhost:9999/ws')), true);
  // its words while closed: coming soon, play money only, never a tip, a price or a promise
  for (const w of [L.LIVE_SOON, L.LIVE_SOON_HOW]) {
    assert.match(w, /coming soon/, w);
    assert.match(w, /play money only/, w);
    assert.doesNotMatch(w, /\bbuy\b|\bsell\b|guarantee|advice|invest|\$\d|%/i, w);
    assert.ok(w.length > 80 && w.length < 220, w);
  }
  assert.match(L.LIVE_SOON, /Until then, every coin here is made up\.$/, 'true of what plays meanwhile');
  for (const c of L.CHAINS) assert.ok(L.LIVE_SOON_HOW.includes(c.name), `How to play names ${c.name}`);
  // the screens: nothing of Live mode can be picked, or kept from a try, while it's closed; its choice says Soon and can't
  // be pressed (like the terminals not built yet), and How to play and the Market switch say it's coming
  const shell = readFileSync('src/games/trenchingsimulator/shell.js', 'utf8');
  assert.match(shell, /const LIVE = liveOpen\(location\);\s*if \(!LIVE\) S\.save\.live = false;/);
  assert.match(shell, /\['live', 'Live coins', !LIVE\]/);
  assert.match(shell, /if \(on === S\.save\.live \|\| \(on && !LIVE\)\) return;/);
  assert.match(shell, /'aria-label': soon \? `\$\{words\}, coming soon` : null, disabled: Boolean\(soon\)/);
  assert.match(shell, /el\('span', \{ class: 'ts-chip-soon', text: 'Soon', 'aria-hidden': 'true' \}\)/);
  assert.match(shell, /\] : LIVE \? null : el\('p', \{ class: 'ts-live-about', text: LIVE_SOON \}\)/);
  assert.match(shell, /text: LIVE \? 'Live mode \(on the modes screen\)[^']*'\s*: LIVE_SOON_HOW \}/);
  assert.equal((shell.match(/S\.save\.live = /g) || []).length, 2, 'only the closed switch and the Market switch set it');
  const css = readFileSync('src/games/trenchingsimulator/trench.css', 'utf8');
  assert.match(css, /\.ts-chip:disabled \{[^}]*border-style: dashed;[^}]*color: var\(--t-muted\);[^}]*cursor: not-allowed;/);
  assert.match(css, /\.ts-chip:disabled:hover \{\s*border-color: var\(--t-line\);/, 'no hover on a choice that can\'t be picked');
  assert.match(css, /\.ts-chip-soon \{[^}]*text-transform: uppercase;/);
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /(^|[\s,}])\.is-soon\b/m, 'is-soon is never styled on its own');
});

test('what the relay sends, checked before anything sees it', () => {
  const wire = P.encodeCoin({ id: 's7', key: MINT, name: 'Moon Frog', symbol: 'MFROG', pic: '/p/abcdefghijklmnopqrstuv.webp', born: 1_792_000_000_000,
    by: DEV, src: 'pump.fun', soc: 3, sup: 1e9, st: curveAt(700_000_000), st0: curveAt(793_100_000), tracked: true });
  const c = L.parseCoin(wire, 'solana');
  assert.equal(c.id, 's7');
  assert.equal(c.key, MINT);
  assert.equal(c.pic, '/p/abcdefghijklmnopqrstuv.webp');
  assert.equal(c.src, 'pump.fun');
  assert.equal(c.soc, 3);
  assert.equal(c.tracked, true);
  assert.equal(c.st0.k, 'c');
  assert.deepEqual(L.socialsOf(3), { x: true, tg: true, web: false });
  // never what the wire says beyond its rules
  assert.equal(L.parseCoin({ ...wire, src: 'evil.example' }, 'solana').src, null, 'a source: only the chain\'s own');
  assert.equal(L.parseCoin({ ...wire, p: 'https://evil.example/x.png' }, 'solana').pic, null);
  assert.equal(L.parseCoin({ ...wire, by: '<b>x</b>' }, 'solana').by, null);
  assert.equal(L.parseCoin({ ...wire, m: '0xAbCdEf0123456789abcdef0123456789ABCDEF01' }, 'solana'), null, 'a Solana coin has a Solana address');
  assert.equal(L.parseCoin({ ...wire, m: '0xAbCdEf0123456789abcdef0123456789ABCDEF01' }, 'base').key, '0xabcdef0123456789abcdef0123456789abcdef01');
  for (const bad of [{ id: 'x1' }, { id: '<s1>' }, { n: '' }, { st: ['c', -1, 1, 1, 1, 0] }, { st: ['z'] }, { s: null }]) {
    assert.equal(L.parseCoin({ ...wire, ...bad }, 'solana'), null, JSON.stringify(bad));
  }
  assert.deepEqual(L.parseState(['u', 7500, -1, -1, 1, 0]), { k: 'u', mu: 7500, lu: null, pg: null, gr: true, cl: false });
  assert.deepEqual(L.parseState(['p', 84.9, 206_900_000]), { k: 'p', ls: 84.9, lb: 206_900_000 });
  assert.equal(L.parseState(['p', 0, 1]), null);
  assert.equal(L.parseState(['c', 30, 100, 200, 0, 0]), null, 'more real tokens than virtual: nonsense');
  const dx = L.parseDx([1500, 12, 7, 9000, 140, 30000, 700, 4.2, -3.5], 150);
  assert.deepEqual(dx, { v5: 10, b5: 12, s5: 7, v1h: 60, t1h: 140, v24: 200, t24: 700, c5: 0.042, c1h: -0.035 });
  assert.equal(L.parseDx([1, 2], 150), null);
  assert.equal(L.parseDx([-1, -1, -1, -1, -1, -1, -1, -1, -1], 150).v5, null);
  // messages
  const msg = (o) => L.parseMessage(JSON.stringify(o), 'solana');
  assert.deepEqual(msg({ t: 'hi', ch: { solana: { s: 'live', n: 30 }, mars: { s: 'live' }, bnb: { s: 'weird' } }, px: { sol: 150, eth: -1 } }),
    { t: 'hi', ch: { solana: { s: 'live', n: 30 } }, px: { sol: 150 } });
  assert.equal(msg({ t: 'snap', chain: 'bnb', coins: [] }), null, 'another chain\'s snapshot');
  assert.equal(msg({ t: 'snap', chain: 'solana', coins: [wire, { id: 'bad' }] }).coins.length, 1);
  assert.deepEqual(msg({ t: 'u', u: [['s7', ['c', 31, 1_000_000_000, 720_100_000, 1, 0], [1, 2, 3, 4, 5, 6, 7, 8, 9]], ['nope', []], ['s8', ['?']]] }).u,
    [{ id: 's7', st: { k: 'c', vs: 31, vt: 1_000_000_000, rt: 720_100_000, rs: 1, done: false }, dx: [1, 2, 3, 4, 5, 6, 7, 8, 9] }]);
  assert.deepEqual(msg({ t: 'off', ids: ['s1', 'x', 7] }), { t: 'off', ids: ['s1'] });
  assert.deepEqual(msg({ t: 'pic', id: 's1', p: '/p/abcdefghijklmnopqrstuv.webp', soc: 9 }), { t: 'pic', id: 's1', p: '/p/abcdefghijklmnopqrstuv.webp', soc: 1 });
  assert.equal(msg({ t: 'pic', id: 's1', p: 'javascript:alert(1)' }), null);
  assert.equal(msg({ t: 'h', id: 's1', h: [[1, ['c', 31, 1_000_000_000, 720_100_000, 1, 0]], ['x']] }).h.length, 1);
  for (const bad of ['', '{', '[]', 'null', '{"t":"nope"}', 'x'.repeat(2_000_001)]) assert.equal(L.parseMessage(bad, 'solana'), null);
});

// a stand-in live feed for a market: its state, its chain's, its coins, what it's asked to watch
function fakeFeed({ status = 'live', state = 'live', chain = 'solana', coins = [] } = {}) {
  const listeners = new Set();
  const f = {
    status, ch: { [chain]: state }, list: coins.slice(), watched: [],
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    emit(ev) {
      for (const fn of [...listeners]) fn(ev);
    },
    chainState(id = chain) {
      return f.ch[id] ?? null;
    },
    coins: () => f.list.slice(),
    picUrl: (p) => L.picUrl(L.RELAY_URL, p),
    watch(ids) {
      f.watched = ids;
    },
    setStatus(s) {
      f.status = s;
      f.emit({ type: 'status', status: s });
    },
    setChain(s) {
      f.ch[chain] = s;
      f.emit({ type: 'chains' });
    },
    get listeners() {
      return listeners.size;
    },
  };
  return f;
}
// a made-up Solana address for coin i (base58: never a 0)
const mintOf = (i) => `${MINT.slice(0, 40)}${'ABCDEFGHJKLMNPQRSTUVWXYZ'[i % 24]}${'abcdefghijk'[Math.floor(i / 24) % 11]}pp`;
const wireCoin = (i, over = {}) => L.parseCoin(P.encodeCoin({ id: `s${i}`, key: mintOf(i),
  name: `Live Coin ${i}`, symbol: `LIVE${i}`, pic: '/p/abcdefghijklmnopqrstuv.webp', born: Date.now() - 30_000, by: DEV, src: 'pump.fun',
  soc: 1, sup: 1e9, st: curveAt(700_000_000), st0: curveAt(793_100_000), tracked: true, ...over }), 'solana');

test('a quiet chain with enough real coins live plays them alone (no stand-ins); with too few, the stand-ins fill in', () => {
  // the owner (2026-10-21): "on the live mode on robinhood chain use real coins not fake ones": Robinhood Chain is often
  // quiet (no new clank.trade coin for 45 minutes) while its newest coins still trade
  assert.equal(L.REAL_ENOUGH, 8);
  assert.equal(L.playState('quiet', 8), 'live');
  assert.equal(L.playState('quiet', 7), 'quiet');
  assert.equal(L.playState('quiet', NaN), 'quiet');
  for (const s of ['live', 'down', 'off', null]) assert.equal(L.playState(s, 50), s, String(s));
  const coins = Array.from({ length: 9 }, (_, i) => wireCoin(i + 1));
  const feed = fakeFeed({ state: 'quiet', coins });
  const m = createLiveMarket({ feed, chain: 'solana', seed: 'quiet-test', solUsd: 150, startSol: 1, config: { warmup: 120 } });
  try {
    feed.emit({ type: 'snap', coins });
    assert.deepEqual(m.ext.shown, { sim: false, ext: true, simPaused: true }, 'nine real coins live: the real ones alone');
    assert.equal(m.liveState().chainState, 'live', 'and its words say live');
    assert.ok(Object.values(m.lists({ limit: 30 })).flat().filter(Boolean).every((r) => !r.standIn), 'no stand-in in the lists');
    // the relay lets two go: seven live, too few; the stand-ins fill in (and run)
    feed.emit({ type: 'off', ids: ['s1', 's2'] });
    assert.deepEqual(m.ext.shown, { sim: true, ext: true, simPaused: false });
    assert.equal(m.liveState().chainState, 'quiet');
    // a new coin: eight again, the real ones alone
    feed.emit({ type: 'coin', coin: wireCoin(10) });
    assert.deepEqual(m.ext.shown, { sim: false, ext: true, simPaused: true });
  } finally {
    m.destroy();
  }
  // the modes screen counts the feed's coins followed live for the same rule
  const shell = readFileSync('src/games/trenchingsimulator/shell.js', 'utf8');
  assert.match(shell, /const liveCoins = f\.chain === S\.save\.chain \? f\.coins\(\)\.filter\(\(c\) => c\.tracked\)\.length : 0;\s*const w = feedWords\(f\.status, playState\(f\.chainState\(S\.save\.chain\), liveCoins\), S\.save\.chain, when\);/);
});

test('newest-first live snapshots stay newest-first before the display limit and update without animation frames', () => {
  let now = 1_792_000_100_000;
  const coin = (id, key, born, mu) => L.parseCoin(P.encodeCoin({ id, key, name: id, symbol: id.toUpperCase(), born,
    src: 'clank.trade', sup: 1e9, st: { k: 'u', mu, lu: 12000, pg: 0.12, gr: false, cl: false }, tracked: true }), 'robinhood');
  const newest = coin('r1', AGI_CA.toLowerCase(), now - 1000, 15000);
  const middle = coin('r2', '0x' + '2'.repeat(40), now - 2000, 12000);
  const oldest = coin('r3', '0x' + '3'.repeat(40), now - 3000, 9000);
  const feed = fakeFeed({ chain: 'robinhood', coins: [newest, middle, oldest] });
  const m = createLiveMarket({ feed, chain: 'robinhood', seed: 'newest-snapshot', solUsd: 150, startSol: 1,
    config: { warmup: 0 }, wallNow: () => now });
  try {
    assert.deepEqual(m.lists({ limit: 2 }).new.map((row) => row.ticker), ['R1', 'R2'], 'order by launch time, not insertion ID');
    const id = m.ext.byKey(AGI_CA.toLowerCase());
    assert.deepEqual(m.find(AGI_CA), [id], 'the exact mixed-case contract finds its normalized coin');
    m.focus(id);
    assert.deepEqual(feed.watched, ['r1']);
    const before = m.t;
    now += 10_000;
    feed.emit({ type: 'u', u: [{ id: 'r1', st: { ...newest.st, mu: 30000 }, dx: null }] });
    near(m.row(id).mc, 200, 1e-9, 'market cap updates from $15K to $30K without a game frame');
    assert.ok(m.t > before, 'the live clock catches up with feed events');
    assert.equal(m.row(id).tracked, true);
    assert.deepEqual(m.lists({ limit: 2 }).new.map((row) => row.ticker), ['R1', 'R2']);
    feed.emit({ type: 'coin', coin: coin('r4', '0x' + '4'.repeat(40), now - 60_000, 6000) });
    assert.deepEqual(m.lists({ limit: 2 }).new.map((row) => row.ticker), ['R1', 'R2'], 'an older search result cannot displace new launches');
  } finally {
    m.destroy();
  }
});

test('a live market: real coins in its lists with their pictures; the stand-ins paused while live, there while quiet or down', () => {
  const feed = fakeFeed({ coins: [wireCoin(1), wireCoin(2)] });
  const m = createLiveMarket({ feed, chain: 'solana', seed: 'live-test', solUsd: 150, startSol: 1, config: { warmup: 120 } });
  try {
    let L1 = m.lists({ limit: 30 });
    const fresh = L1.new;
    assert.deepEqual(fresh.map((r) => r.ticker), ['LIVE2', 'LIVE1'], 'its real coins, newest first');
    assert.ok(fresh.every((r) => r.live && r.tracked && r.src === 'pump.fun' && r.pic === 'https://live.agi1.app/p/abcdefghijklmnopqrstuv.webp'));
    assert.ok(Object.values(L1).flat().filter(Boolean).every((r) => !r.standIn), 'no stand-ins while live');
    assert.deepEqual(m.ext.shown, { sim: false, ext: true, simPaused: true });
    near(fresh[0].mc, P.curveMarketCap(curveAt(700_000_000)), 1e-6, 'its market cap, the real one');
    // a new coin comes in; a change moves it (somebody's trade)
    feed.emit({ type: 'coin', coin: wireCoin(3) });
    assert.equal(m.lists().new[0].ticker, 'LIVE3');
    const id = m.ext.byKey(wireCoin(1).key);
    feed.emit({ type: 'u', u: [{ id: 's1', st: L.parseState(P.encodeState(curveAt(650_000_000))), dx: null }] });
    const tr = m.trades(id, 5);
    assert.equal(tr[0].side, 'buy');
    assert.equal(tr[0].label, 'trader');
    assert.equal(tr[0].addr, null, 'never an address for somebody out there');
    near(tr[0].tok, 50_000_000, 1, 'the tokens it took');
    near(tr[0].sol, curveAt(650_000_000).vs - curveAt(700_000_000).vs, 1e-5, 'the SOL it put in (six decimals on the wire)');
    // quiet: the stand-ins fill in (and run), the real coins stay
    feed.setChain('quiet');
    assert.deepEqual(m.ext.shown, { sim: true, ext: true, simPaused: false });
    L1 = m.lists({ limit: 30 });
    assert.ok(L1.new.some((r) => r.standIn) && L1.new.some((r) => r.live));
    // down: the stand-ins only; the real coins aren't live (an order on one waits)
    feed.setStatus('down');
    assert.deepEqual(m.ext.shown, { sim: true, ext: false, simPaused: false });
    L1 = m.lists({ limit: 30 });
    assert.ok(Object.values(L1).flat().filter(Boolean).every((r) => !r.live));
    assert.equal(m.row(id).tracked, false);
    assert.deepEqual(m.order({ coin: id, side: 'buy', sol: 0.1 }), { ok: false, error: 'stale' });
    assert.ok(ORDER_ERRORS.stale.includes('live feed'), 'the board says why');
    // back: its next snapshot makes them live again; a stand-in held meanwhile stays tradeable
    feed.setStatus('live');
    feed.ch.solana = 'live';
    feed.emit({ type: 'snap', coins: [wireCoin(1), wireCoin(2), wireCoin(3)] });
    assert.equal(m.row(id).tracked, true);
    assert.equal(m.order({ coin: id, side: 'buy', sol: 0.1 }).ok, true);
    // the coin open and the ones held are watched (by the relay's ids)
    m.advanceTo(m.t + 2);
    m.focus(m.ext.byKey(wireCoin(2).key));
    assert.deepEqual(feed.watched.slice().sort(), ['s1', 's2']);
    m.focus(null);
    assert.deepEqual(feed.watched, ['s1']);
    // let go of the feed
    m.destroy();
    assert.equal(feed.listeners, 0);
    assert.deepEqual(feed.watched, []);
  } finally {
    m.destroy();
  }
});

test("play money against the live curve: the curve's own tokens for a buy, the player's tokens move it in their view, a sell comes back along it", () => {
  const m = createMarket({ seed: 'ext-math', startSol: 100, config: { warmup: 0 }, live: true });
  m.ext.view({ sim: false, ext: true, simPaused: true });
  const real = L.toReal(L.parseState(P.encodeState(curveAt(700_000_000))));
  const id = m.ext.add({ key: MINT, chain: 'solana', src: 'pump.fun', name: 'Moon Frog', ticker: 'MFROG', born: m.t - 10, real, live: true });
  // a quote on a live pump.fun curve is the game's own curve's at the same point
  for (const sol of [0.1, 1, 10]) {
    const q = m.quote({ coin: id, side: 'buy', sol });
    const net = sol * 0.99;
    const own = buyQuote({ phase: 'curve', curve: { left: 700_000_000 } }, net);
    assert.ok(Math.abs(q.tokens - own.out) <= 1, `${sol} SOL: ${q.tokens} vs ${own.out}`);
  }
  // a buy lands (play money): its tokens out of the curve in the player's view
  assert.equal(m.order({ coin: id, side: 'buy', sol: 5, priority: 'ultra', slippage: 1 }).ok, true);
  m.advance(1);
  const pos = m.positions().find((p) => p.id === id);
  assert.ok(pos && pos.tokens > 0, 'bought');
  const mcAfterBuy = m.row(id).mc;
  assert.ok(mcAfterBuy > P.curveMarketCap(curveAt(700_000_000)), 'their buy moved it in their view');
  near(m.row(id).progress, curveProgress({ left: 700_000_000 }), 1e-9, 'its progress is still the real one');
  // somebody else buys out there: the real curve moves, the player's tokens still out of it
  m.ext.state(id, L.toReal(L.parseState(P.encodeState(curveAt(650_000_000)))));
  const k = curveAt(650_000_000).vs * curveAt(650_000_000).vt;
  const tok = curveAt(650_000_000).vt - pos.tokens;
  near(m.row(id).mc, (k / tok / tok) * 1e9, 1e-3, 'the real curve with the player\'s tokens taken out along it');
  // a sell comes back along it: with the real curve moved up, a profit
  assert.equal(m.order({ coin: id, side: 'sell', frac: 1, priority: 'ultra', slippage: 1 }).ok, true);
  m.advance(1);
  const sold = m.positions().find((p) => p.id === id);
  assert.equal(sold.tokens, 0);
  assert.ok(sold.total > 0, 'a profit from the real buyers');
  near(m.row(id).mc, P.curveMarketCap(curveAt(650_000_000)), 1e-3, 'all sold: the real market again');
  // a live curve never sells more than it has left: the rest comes back
  m.ext.state(id, L.toReal(L.parseState(P.encodeState(curveAt(1_000_000)))));
  const before = m.player.sol;
  assert.equal(m.order({ coin: id, side: 'buy', sol: 50, priority: 'ultra', slippage: 1 }).ok, true);
  m.advance(1);
  const all = m.positions().find((p) => p.id === id);
  assert.ok(Math.abs(all.tokens - 1_000_000) <= 1, `at most what it had left: ${all.tokens}`);
  assert.ok(before - m.player.sol < 50 * 0.5, 'and only that paid for');
  assert.equal(m.row(id).phase, 'curve', 'the real coin hasn\'t migrated because of a play-money buy');
  // sold out for real: closed for a moment (nothing trades), then its pool
  m.ext.state(id, L.toReal(L.parseState(P.encodeState(curveAt(0, true)))));
  assert.equal(m.row(id).phase, 'migrating');
  assert.deepEqual(m.order({ coin: id, side: 'sell', frac: 1 }), { ok: false, error: 'migrating' });
  assert.ok(m.positions().find((p) => p.id === id).value > 0, 'still worth its last price meanwhile');
  m.ext.state(id, L.toReal(L.parseState(['p', 84.9, 206_900_000])));
  assert.equal(m.row(id).phase, 'pool');
  assert.ok(m.feed(0).some((e) => e.kind === 'migrate' && e.c === id) && m.feed(0).some((e) => e.kind === 'migrated' && e.c === id));
  assert.equal(m.order({ coin: id, side: 'sell', frac: 1, slippage: 1 }).ok, true, 'trading in its pool');
});

test('an older live coin keeps its true age but its chart never backdates an unknown launch price', () => {
  const m = createMarket({ seed: 'old-coin-first-quote', config: { warmup: 30 }, live: true });
  const firstSeen = m.t;
  const born = firstSeen - 7 * 86400;
  const real = L.toReal({ k: 'u', mu: 30000, lu: 12000, pg: 1, gr: true, cl: false }, { solUsd: 150 });
  const add = (key, extra = {}) => m.ext.add({ key, chain: 'robinhood', src: 'clank.trade', name: 'Older coin', ticker: 'OLDER',
    born, real, live: true, ...extra });
  const id = add(AGI_CA.toLowerCase());
  const invalid = add('0x' + '2'.repeat(40), { real0: { sol: 0, tok: 1 } });
  for (const coinId of [id, invalid]) {
    assert.equal(m.row(coinId).age, 7 * 86400, 'launch age remains independent of the observed price history');
    const candles = m.candles(coinId);
    assert.equal(candles.length, 1);
    assert.equal(candles[0].t, Math.floor(firstSeen), 'the first known quote belongs to the time it was received');
    near(candles[0].c, 200, 1e-9, 'the observed market cap is $30K in SOL units');
  }
  const real0 = L.toReal({ k: 'u', mu: 7500, lu: 3000, pg: 0.1, gr: false, cl: false }, { solUsd: 150 });
  const known = add('0x' + '3'.repeat(40), { real0 });
  const history = m.candles(known);
  assert.deepEqual(history.map((c) => c.t), [Math.floor(born), Math.floor(firstSeen)], 'a known launch quote retains its real timestamp');
  near(history[0].c, 50, 1e-9, 'known launch cap');
  near(history[1].c, 200, 1e-9, 'current cap');
  m.advanceTo(firstSeen + 10);
  m.ext.state(id, L.toReal({ k: 'u', mu: 45000, lu: 12000, pg: 1, gr: true, cl: false }, { solUsd: 150 }));
  assert.equal(m.candles(id)[0].t, Math.floor(firstSeen));
  assert.equal(m.candles(id).at(-1).t, Math.floor(m.t));
  assert.equal(m.row(id).age, 7 * 86400 + 10);
});

test('live percentage changes need a real earlier quote or source statistic for the requested window', () => {
  const m = createMarket({ seed: 'real-change-baseline', config: { warmup: 0 }, live: true });
  m.ext.view({ sim: false, ext: true, simPaused: true });
  const firstSeen = m.t;
  const real = (mu) => L.toReal({ k: 'u', mu, lu: 12000, pg: 1, gr: true, cl: false }, { solUsd: 150 });
  const add = (key) => m.ext.add({ key, chain: 'robinhood', src: 'clank.trade', name: 'Older coin', ticker: 'OLDER',
    born: firstSeen - 7 * 86400, real: real(33000), live: true });
  const id = add(AGI_CA.toLowerCase());
  const changes = (coinId) => {
    const s = m.stats(coinId);
    return [s.change1m, s.change5m, s.change1h, m.row(coinId).ch5m];
  };
  assert.deepEqual(changes(id), [null, null, null, null], 'an older launch date cannot supply an unobserved price baseline');

  const sourced = add('0x' + '2'.repeat(40));
  m.ext.state(sourced, { ...real(33000), dx: { c5: 0.04, c1h: -0.02 } });
  assert.deepEqual(changes(sourced), [null, 0.04, -0.02, 0.04], 'reported changes do not require local candle history');
  m.ext.state(sourced, real(34000));
  assert.deepEqual(changes(sourced), [null, 0.04, -0.02, 0.04], 'a state-only update retains the source statistics');

  const historical = add('0x' + '3'.repeat(40));
  assert.equal(m.ext.history(historical, [
    { t: firstSeen - 3600, real: real(16500) },
    { t: firstSeen - 300, real: real(26400) },
    { t: firstSeen - 60, real: real(30000) },
  ]), true);
  for (const [actual, expected] of changes(historical).map((value, i) => [value, [0.1, 0.25, 1, 0.25][i]])) {
    near(actual, expected, 1e-9, 'captured history supplies the real percentage baseline');
  }
  m.advanceTo(firstSeen + 59);
  m.ext.state(id, real(49500));
  assert.deepEqual(changes(id), [null, null, null, null], 'less than one minute is still insufficient for one-minute change');
  m.advanceTo(firstSeen + 60);
  near(m.stats(id).change1m, 0.5, 1e-9, 'one minute of observed prices gives the actual fifty-percent change');
  assert.deepEqual(changes(id).slice(1), [null, null, null], 'longer windows wait for their own comparison history');
});

test('real coins never get made-up things: no holders, thread, dev, rug or caller; their history comes in older than what they have', () => {
  const m = createMarket({ seed: 'ext-reads', config: { warmup: 30 }, live: true });
  const real = L.toReal(L.parseState(P.encodeState(curveAt(700_000_000))));
  const id = m.ext.add({ key: MINT, chain: 'solana', src: 'pump.fun', name: 'Moon Frog', ticker: 'mFrog', by: DEV, born: m.t - 60,
    socials: { x: true }, real, real0: L.toReal(L.parseState(P.encodeState(curveAt(793_100_000)))), live: true, pic: 'https://live.agi1.app/p/a.webp' });
  const s = m.stats(id);
  for (const k of ['holders', 'top10', 'dev', 'devSold', 'snipers', 'bundlers', 'insiders', 'replies', 'devCoins', 'smart', 'whales']) {
    assert.equal(s[k], null, k);
  }
  assert.deepEqual([s.rugged, s.dexPaid, s.cto, s.kols.length], [false, false, false, 0]);
  assert.equal(s.live, true);
  assert.equal(s.src, 'pump.fun');
  assert.equal(s.pair, 'SOL');
  const f = m.info(id);
  assert.equal(f.line, null);
  assert.equal(f.dev, `${DEV.slice(0, 4)}…${DEV.slice(-4)}`, 'its creator: the address, shortened');
  assert.equal(f.devCoins, null);
  assert.deepEqual(m.comments(id), []);
  const h = m.holders(id);
  assert.deepEqual(h.list, [], 'nobody known holds it');
  assert.equal(m.firstBuyers(id), null, "its first buyers (GNGM's grid, 2026-10-22): nobody we know, never made up");
  assert.equal(h.pool.kind, 'curve');
  near(h.pool.tok, 700_000_000 + 206_900_000, 1, 'its curve: for sale and kept for its pool');
  assert.deepEqual(m.find('MFROG'), [id], 'its ticker in any case');
  assert.deepEqual(m.find(MINT), [id], 'its address');
  assert.equal(m.isExt(id), true);
  const made = [...Array(m.size.coins).keys()].find((i) => i !== id);
  if (made !== undefined) assert.equal(m.isExt(made), false, 'a made-up coin');
  assert.equal(m.isExt(99999), false);
  // its history: older than anything it has, candles first and trades in it, never an address
  const before = m.candles(id).length;
  const t0 = m.t - 50;
  m.ext.history(id, [0, 1, 2, 3].map((i) => ({ t: t0 + i * 3, real: L.toReal(L.parseState(P.encodeState(curveAt(790_000_000 - i * 20_000_000)))) })));
  const cd = m.candles(id);
  assert.equal(cd.length, before + 4);
  assert.ok(cd.every((c, i) => i === 0 || c.t >= cd[i - 1].t), 'in order');
  const tr = m.trades(id, 10);
  assert.equal(tr.length, 3);
  assert.ok(tr.every((x) => x.addr === null && x.label === 'trader' && x.side === 'buy'));
  assert.equal(m.stats(id).cdv, 1, 'the board knows to draw it again');
  // a made-up market has no such doors
  assert.equal(createMarket({ seed: 'plain', config: { warmup: 0 } }).ext, null);
});

test("a live run: the real clock (never paused, one speed), its results say Live, its bests kept apart from the simulated ones", () => {
  const feed = fakeFeed({ coins: [wireCoin(1)] });
  const run = createRun({ seed: 'live-run', mode: 'challenge', challenge: challengeById('double-up'), solUsd: 150, live: 'solana', realTime: true,
    makeMarket: (o) => createLiveMarket({ ...o, feed, chain: 'solana', config: { ...o.config, warmup: 60 } }) });
  assert.equal(run.realTime, true);
  assert.equal(run.live, 'solana');
  run.pause();
  assert.equal(run.paused, false, 'the menu never stops a live run');
  assert.equal(run.setSpeed(4), 1, 'one speed');
  run.tick(5);
  near(run.clock, 5, 1e-9, 'the real time that passed, more than a tick\'s usual most');
  assert.ok(5 > MAX_DT);
  const id = run.market.ext.byKey(wireCoin(1).key);
  assert.equal(run.order({ coin: id, side: 'buy', sol: 0.2, priority: 'ultra' }).ok, true);
  run.tick(1);
  assert.equal(run.market.liveTraded(), 1);
  run.end('quit');
  const res = run.result();
  assert.equal(res.live, 'solana');
  assert.equal(res.liveTraded, 1);
  assert.equal(modeLabel(res), 'Double up · Live · Solana');
  assert.equal(cardText(res).foot, 'Play money on live coins · agi1.app/games/trenchingsimulator');
  const post = shareText(res);
  assert.match(post, /play money on live coins/);
  assert.ok(post.length + 24 <= 280 && !/\bbuy\b|pump\.?fun|MFROG|LIVE1/i.test(post), post);
  // a live run with no real coin traded keeps the old words
  assert.equal(cardText({ ...res, liveTraded: 0 }).foot, 'Play money, made-up coins · agi1.app/games/trenchingsimulator');
  // its best: Live mode's own book, never the simulated stars
  let s = SAVE.blank();
  assert.deepEqual([s.live, s.chain, s.liveBest], [false, 'solana', {}]);
  s = SAVE.recordResult(s, { ...res, outcome: 'won', stars: 3, timeUsed: 100, multiple: 2.1, placed: 1 });
  assert.equal(s.liveBest['double-up'].stars, 3);
  assert.equal(s.best['double-up'], undefined);
  assert.equal(SAVE.starsTotal(s), 0);
  assert.equal(SAVE.starsTotal(s, { live: true }), 3);
  const clean = SAVE.cleanSave({ ...s, live: true, chain: 'bnb', liveBest: { 'double-up': { stars: 9 }, '<x>': { stars: 1 } } });
  assert.deepEqual([clean.live, clean.chain, clean.liveBest['double-up'].stars, Object.keys(clean.liveBest)], [true, 'bnb', 3, ['double-up']]);
  assert.equal(SAVE.cleanSave({ ...s, chain: 'mars' }).chain, 'solana');
  run.market.destroy();
  // a made-up run as before: paused by the menu, at most MAX_DT a tick
  const sim = createRun({ seed: 'sim-run', mode: 'free', speed: 2 });
  assert.equal(sim.realTime, false);
  sim.pause();
  assert.equal(sim.paused, true);
  sim.resume();
  sim.tick(5);
  near(sim.clock, MAX_DT * 2, 1e-9);
});

test("AGI-1 never names a real coin: her Live lines have no ticker; a real coin's rug or dev sell is never something she says", () => {
  for (const [key, lines] of Object.entries(LIVE_LINES)) {
    assert.ok(Object.hasOwn(LINES, key) || key === 'start', key);
    for (const l of lines) {
      assert.ok(l.length >= 5 && l.length <= 80, `${key}: "${l}"`);
      assert.doesNotMatch(l.replace(/\{pnl\}/g, ''), /\{|\$|@|https?:|[A-Z]/, `no ticker, caller, link or capital: "${l}"`);
      assert.doesNotMatch(l, /\b(you should|go buy|buy (it|this|now|more|the dip)|sell (it|now|this)|ape|send it|to the moon|guarantee|100x|financial advice|wagmi|lfg)\b/i, l);
      assert.doesNotMatch(l, /pump\.?fun|clank|robinhood|solana|four\.?meme/i, `never a real name: "${l}"`);
    }
  }
  assert.ok(LIVE_LINES.start.some((l) => l.includes('play money')));
  const order = (coin, side = 'buy') => ({ id: 1, coin, ticker: 'REALCOIN', side, status: 'filled' });
  const isReal = (id) => id === 7;
  // about a real coin: the Live line, never the ticker; a stand-in's: as before
  assert.deepEqual(liveLineFor(lineFor({ type: 'fill', order: order(7), first: true }), { type: 'fill', order: order(7) }, { isReal }),
    { key: 'firstBuy', vars: {}, live: true });
  assert.equal(liveLineFor(lineFor({ type: 'fill', order: order(3), first: true }), { type: 'fill', order: order(3) }, { isReal }).vars.ticker, '$REALCOIN');
  assert.equal(liveLineFor(lineFor({ type: 'rug', coin: 7, ticker: 'REALCOIN' }), { type: 'rug', coin: 7 }, { isReal }), null);
  assert.equal(liveLineFor(lineFor({ type: 'dev_sell', coin: 7, ticker: 'REALCOIN' }), { type: 'dev_sell', coin: 7 }, { isReal }), null);
  assert.equal(liveLineFor(lineFor({ type: 'kol_buy', coin: 7, ticker: 'R', kol: 'x' }), { type: 'kol_buy', coin: 7 }, { isReal }), null);
  assert.equal(liveLineFor(lineFor({ type: 'fail', order: order(7), reason: 'slippage' }), { type: 'fail', order: order(7) }, { isReal }).key, 'failSlip');
  assert.deepEqual(liveLineFor(lineFor({ type: 'start', mode: 'free' }), { type: 'start' }, { live: true }), { key: 'start', vars: {}, live: true });
  // her voice in a live run: every line about a real coin without its name
  const v = createVoice({ rng: () => 0.3, gap: 0, breath: 0, live: true, isReal });
  const said = [];
  for (let i = 0; i < 60; i++) {
    const e = [{ type: 'fill', order: order(7, i % 2 ? 'buy' : 'sell'), first: i === 0, pnl: i % 3 ? 0.2 : -0.1 },
      { type: 'migrating', coin: 7, ticker: 'REALCOIN' }, { type: 'migrated', coin: 7, ticker: 'REALCOIN' },
      { type: 'fail', order: order(7), reason: 'migrating' }][i % 4];
    const out = v.hear([e], i);
    if (out) said.push(out.text);
  }
  assert.ok(said.length >= 40);
  assert.ok(said.every((t) => !/REALCOIN|\{|\$R/.test(t)), said.find((t) => /REALCOIN/.test(t)));
  assert.equal(v.hear([{ type: 'start', mode: 'free' }], 100).live, true);
});

function browserFeedHarness(chain = 'robinhood') {
  const made = [];
  const scheduled = new Set();
  class Socket {
    constructor() { this.readyState = 0; this.sent = []; made.push(this); }
    send(text) { this.sent.push(JSON.parse(text)); }
    close() { this.readyState = 3; }
    open() { this.readyState = 1; this.onopen(); }
    msg(obj) { this.onmessage({ data: JSON.stringify(obj) }); }
    drop() { this.readyState = 3; this.onclose({ code: 1006 }); }
  }
  const feed = createLiveFeed({ url: 'ws://127.0.0.1:1/ws', WebSocket: Socket,
    timers: { set: (fn, ms) => { const timer = { fn, ms }; scheduled.add(timer); return timer; },
      clear: (timer) => scheduled.delete(timer) } });
  feed.start(chain);
  const socket = made[0];
  socket.open();
  socket.msg({ t: 'hi', ch: { [chain]: { s: 'live', n: 40 } }, px: { sol: 150 } });
  return { feed, socket, scheduled };
}

test('browser contract lookup resolves into the live market, deduplicates and cancels every unfinished request', async () => {
  const { feed, socket, scheduled } = browserFeedHarness();
  const m = createLiveMarket({ feed, chain: 'robinhood', seed: 'lookup-client', solUsd: 150, startSol: 1, config: { warmup: 0 } });
  const key = AGI_CA.toLowerCase();
  const reply = (status, chain = 'robinhood', address = key) => socket.msg({ t: 'lookup', chain, key: address, status });
  try {
    assert.equal(await feed.lookup('0x1234'), null);
    assert.equal(socket.sent.filter((x) => x.op === 'lookup').length, 0, 'an incomplete address never leaves the browser');
    const pending = feed.lookup(AGI_CA);
    assert.equal(feed.lookup(key), pending, 'equivalent EVM casing shares one pending request');
    assert.deepEqual(socket.sent.at(-1), { op: 'lookup', address: key });
    await assert.rejects(feed.lookup('0x' + '2'.repeat(40)), /busy/);
    const marketPending = m.lookup(AGI_CA);
    assert.equal(socket.sent.filter((x) => x.op === 'lookup').length, 1);
    let resolved = false;
    pending.then(() => { resolved = true; });
    reply('found', 'bnb');
    await Promise.resolve();
    assert.equal(resolved, false, 'a response from the previous or another chain cannot resolve the lookup');
    socket.msg({ t: 'c', c: P.encodeCoin(coinIn(key, { id: 'r1', src: 'clank.trade',
      st: { k: 'u', mu: 15000, lu: 12000, pg: 0.2, gr: false, cl: false } })) });
    reply('found');
    assert.equal((await pending).key, key);
    const id = await marketPending;
    assert.ok(Number.isInteger(id));
    assert.deepEqual(m.find(AGI_CA), [id]);
    assert.equal(m.row(id).tracked, true);
    assert.equal(scheduled.size, 0, 'successful lookup clears its deadline');

    const missing = feed.lookup(key);
    reply('missing');
    assert.equal(await missing, null);
    for (const status of ['busy', 'unavailable']) {
      const rejected = assert.rejects(feed.lookup(key), new RegExp(status));
      reply(status);
      await rejected;
    }
    const timeout = assert.rejects(feed.lookup(key), /unavailable/);
    const deadline = [...scheduled].find((t) => t.ms === 20000);
    assert.ok(deadline, 'lookup has a bounded deadline');
    deadline.fn();
    await timeout;
    assert.equal(scheduled.size, 0);
    const changed = assert.rejects(feed.lookup(key), /unavailable/);
    feed.setChain('solana');
    await changed;
    const solPending = feed.lookup(MINT);
    assert.deepEqual(socket.sent.at(-1), { op: 'lookup', address: MINT }, 'Solana is sent with its original case');
    const stopped = assert.rejects(solPending, /unavailable/);
    feed.stop();
    await stopped;
    await assert.rejects(feed.lookup(MINT), /unavailable/);
  } finally {
    m.destroy();
    feed.stop();
  }
  const dropped = browserFeedHarness();
  const disconnected = assert.rejects(dropped.feed.lookup(key), /unavailable/);
  dropped.socket.drop();
  await disconnected;
  dropped.feed.stop();
});

test('snapshots and state-only updates preserve real volume and transaction metrics through feed and market', () => {
  const { feed, socket } = browserFeedHarness();
  const metrics = [1500, 12, 7, 9000, 140, 30000, 700, 4.2, -3.5];
  const state = { k: 'u', mu: 15000, lu: 12000, pg: 0.2, gr: false, cl: false };
  const wire = P.encodeCoin(coinIn(AGI_CA.toLowerCase(), { id: 'r1', src: 'clank.trade', st: state, dx: metrics }));
  assert.deepEqual(wire.dx, metrics, 'the relay includes its latest metrics in a full coin');
  assert.deepEqual(L.parseCoin(wire, 'robinhood').dx, metrics);
  assert.equal(Object.hasOwn(L.parseCoin({ ...wire, dx: [1, 2] }, 'robinhood'), 'dx'), false);
  socket.msg({ t: 'snap', chain: 'robinhood', coins: [wire] });
  const m = createLiveMarket({ feed, chain: 'robinhood', seed: 'retained-metrics', solUsd: 150, startSol: 1, config: { warmup: 0 } });
  const id = m.ext.byKey(AGI_CA.toLowerCase());
  try {
    const check = (vol5m, vol, txns) => {
      const row = m.row(id);
      near(row.vol5m, vol5m, 1e-9, 'five-minute volume retains its real quote');
      near(row.vol, vol, 1e-9, 'daily volume retains its real quote');
      assert.equal(row.txns, txns);
    };
    check(10, 200, 700);
    socket.msg({ t: 'u', u: [['r1', P.encodeState({ ...state, mu: 30000 })]] });
    assert.deepEqual(feed.coins()[0].dx, metrics, 'the browser retains metrics while the launchpad changes only price or progress');
    near(m.row(id).mc, 200, 1e-9, 'the price still updates');
    check(10, 200, 700);
    const newer = [3000, 18, 9, 12000, 150, 45000, 900, 5, 2];
    socket.msg({ t: 'u', u: [['r1', P.encodeState({ ...state, mu: 45000 }), newer]] });
    check(20, 300, 900);
    socket.msg({ t: 'u', u: [['r1', P.encodeState({ ...state, mu: 60000 })]] });
    check(20, 300, 900);
    socket.msg({ t: 'snap', chain: 'robinhood', coins: [P.encodeCoin({ ...coinIn(AGI_CA.toLowerCase()), id: 'r1', src: 'clank.trade', st: state, dx: newer })] });
    check(20, 300, 900);
  } finally {
    m.destroy();
    feed.stop();
  }
});

test('the feed in the browser: connecting, live, down and back by itself, full; its words plain, never a tip', async () => {
  const made = [];
  class FakeSocket {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.sent = [];
      made.push(this);
    }
    send(t) {
      this.sent.push(JSON.parse(t));
    }
    close() {
      this.readyState = 3;
    }
    open() {
      this.readyState = 1;
      this.onopen();
    }
    msg(o) {
      this.onmessage({ data: JSON.stringify(o) });
    }
    drop(code = 1006) {
      this.readyState = 3;
      this.onclose({ code });
    }
  }
  const timers = [];
  const feed = createLiveFeed({ url: 'ws://127.0.0.1:1/ws', WebSocket: FakeSocket, random: () => 0.5,
    timers: { set: (fn, ms) => timers.push({ fn, ms }) && timers.length, clear: () => {} } });
  const statuses = [];
  feed.on((ev) => ev.type === 'status' && statuses.push(ev.status));
  assert.equal(feed.status, 'idle');
  feed.start('solana');
  assert.equal(feed.status, 'connecting');
  made[0].open();
  assert.deepEqual(made[0].sent, [{ op: 'sub', chain: 'solana' }]);
  made[0].msg({ t: 'hi', ch: { solana: { s: 'live', n: 40 } }, px: { sol: 150 } });
  assert.equal(feed.status, 'live');
  assert.equal(feed.chainState(), 'live');
  assert.equal(feed.px.sol, 150);
  made[0].msg({ t: 'snap', chain: 'solana', coins: [P.encodeCoin({ id: 's1', key: MINT, name: 'A', symbol: 'A', born: 1_792_000_000_000,
    st: curveAt(700_000_000), tracked: true })] });
  assert.equal(feed.coins().length, 1);
  feed.watch(['s1', 9, 's2']);
  assert.deepEqual(made[0].sent.at(-1), { op: 'watch', ids: ['s1', 's2'] });
  // dropped: down, and again after a wait (2 s, a little random), by itself
  made[0].drop();
  assert.equal(feed.status, 'down');
  assert.equal(timers.at(-1).ms, 2000);
  timers.at(-1).fn();
  assert.equal(made.length, 2);
  made[1].open();
  made[1].msg({ t: 'hi', ch: { solana: { s: 'down', n: 0 } }, px: {} });
  assert.equal(feed.status, 'live');
  assert.equal(feed.chainState(), 'down');
  // the chain is back: everything asked again (quiet → live needs nothing: its coins were live all along)
  made[1].msg({ t: 'st', ch: { solana: { s: 'quiet', n: 0 } } });
  assert.equal(made[1].sent.filter((m) => m.op === 'sub').length, 2);
  made[1].msg({ t: 'st', ch: { solana: { s: 'live', n: 3 } } });
  assert.equal(made[1].sent.filter((m) => m.op === 'sub').length, 2);
  assert.equal(feed.chainState(), 'live');
  // full: said so, and the next try a while later
  made[1].drop(1013);
  assert.equal(feed.status, 'full');
  assert.equal(timers.at(-1).ms, 30000);
  feed.stop();
  assert.equal(feed.status, 'idle');
  assert.deepEqual(statuses, ['connecting', 'live', 'down', 'live', 'full', 'idle']);
  // no WebSocket at all: down, never a crash
  const none = createLiveFeed({ url: 'ws://x/ws', WebSocket: null, timers: { set: () => 0, clear: () => {} } });
  none.start('solana');
  assert.equal(none.status, 'down');
  none.stop();
  // its words, before a run and in one
  const words = [];
  for (const when of ['before', 'run']) {
    for (const [feedState, chainState] of [['connecting', null], ['live', 'live'], ['live', 'quiet'], ['live', 'down'], ['live', 'off'],
      ['down', null], ['full', null]]) {
      for (const ch of L.CHAIN_IDS) words.push([feedState, chainState, ch, when, L.feedWords(feedState, chainState, ch, when)]);
    }
  }
  for (const [fs, cs, ch, when, w] of words) {
    assert.ok(['live', 'wait', 'off'].includes(w.tone));
    assert.ok(w.text.length > 10 && w.text.length < 140, w.text);
    assert.doesNotMatch(w.text, /\bbuy\b|\bsell\b|guarantee|advice/i, w.text);
    if (fs === 'live' && cs === 'live') assert.match(w.text, /play money/, w.text);
    if (fs === 'down' || fs === 'full' || (fs === 'live' && ['down', 'off'].includes(cs))) {
      assert.equal(w.tone, 'off');
      assert.match(w.text, /simulated coins/, `${ch} ${when}: ${w.text}`);
    }
  }
  assert.equal(L.feedWords('down', null, 'solana', 'run').text, 'The live feed isn\'t reachable right now. You\'re trading simulated coins until it\'s back.');
  assert.equal(L.feedWords('live', 'quiet', 'robinhood').text, 'Robinhood Chain is quiet: no new coins for a while. Simulated coins fill in until real ones arrive.');
  assert.match(L.LIVE_NOTE, /play money/);
  assert.match(L.LIVE_NOTE, /Not financial advice/);
});

// ---------- the site: its CSP, its files ----------

test("the site's CSP gains only the relay's origin: its feed and its pictures", () => {
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const csp = vercel.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;
  const dir = (name) => csp.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${name} `)).split(/\s+/).slice(1);
  assert.deepEqual(dir('connect-src'), ["'self'", 'blob:', 'https://api.dexscreener.com', 'wss://live.agi1.app']);
  assert.deepEqual(dir('img-src'), ["'self'", 'data:', 'blob:', 'https://live.agi1.app']);
  assert.deepEqual(dir('script-src'), ["'self'", 'https://challenges.cloudflare.com'], 'no script from the relay, ever');
  assert.deepEqual(dir('style-src'), ["'self'"]);
  assert.ok(!csp.includes('pump.fun') && !csp.includes('ipfs') && !csp.includes('helius'), 'never a coin\'s own host');
  assert.equal(new URL(L.RELAY_URL).host, 'live.agi1.app');
});

test("the game's Live files: no HTML from strings, no link anywhere (never a way to buy a real coin), styles scoped like their neighbours", () => {
  const dir = 'src/games/trenchingsimulator/';
  // (GNGM's files since 2026-10-22: its board, its coin page, its chart, its PnL card, its numbers)
  const GNGM = ['boards/gngm.js', 'boards/gngm-coin.js', 'boards/gchart.js', 'boards/gngm-card.js', 'boards/gngm-data.js'];
  const PHOMO = ['boards/phomo.js', 'boards/phomo-coin.js', 'boards/phomo-data.js', 'boards/phomo-state.js', 'boards/phomo-perps.js'];
  // (race rooms' client since 2026-10-22: race.js)
  const files = ['live-chains.js', 'live-feed.js', 'live-market.js', 'shell.js', 'race.js', 'boards/board.js', 'boards/common.js', ...GNGM, ...PHOMO]
    .map((f) => [f, readFileSync(dir + f, 'utf8')]);
  for (const [f, src] of files) {
    assert.doesNotMatch(src, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/, f);
    assert.doesNotMatch(src, /window\.open|location\.(href|assign|replace)\s*=|\.click\(\)\s*;?\s*\/\/\s*buy/, f);
    assert.doesNotMatch(src, /https?:\/\/(www\.)?(pump\.fun|clank\.trade|dexscreener\.com|four\.meme|axiom|photon|gmgn)/i, `${f}: no link to a real coin's page`);
  }
  const board = files.find(([f]) => f === 'boards/board.js')[1];
  assert.doesNotMatch(board, /el\('a'/, 'the terminal has no links at all');
  assert.match(board, /play money/);
  // a real coin's address only ever its first 6 characters
  assert.match(board, /`CA \$\{f\.mint\.slice\(0, 6\)\}…`/);
  // GNGM the same: no link at all (its PnL card is saved by the shell), "play money" on a real coin, its address's first 6.
  // One exception since 2026-10-22: its chart library's credit (TradingView Lightweight Charts™: its license asks for a
  // link to tradingview.com on the page with the chart), once, in gchart.js, to exactly that address
  const CREDIT_LINK = "el('a', { class: 'tsg-credit-a', href: CREDIT.url, target: '_blank', rel: 'noopener noreferrer' }, CREDIT.name)";
  const gngm = files.filter(([f]) => GNGM.includes(f));
  for (const [f, src] of gngm) {
    const credits = src.split(CREDIT_LINK).length - 1;
    assert.equal(credits, f === 'boards/gchart.js' ? 1 : 0, `${f}: the chart's credit link, once, in gchart.js only`);
    assert.doesNotMatch(src.replace(CREDIT_LINK, ''), /el\('a'|createElement\('a'\)|href/, `${f}: GNGM has no other link`);
    assert.doesNotMatch(src, /mint\.slice\(-/, `${f}: never a coin's address's end`);
  }
  const chartSrc = files.find(([f]) => f === 'boards/gchart.js')[1];
  assert.match(chartSrc, /url: 'https:\/\/www\.tradingview\.com\/'/, 'that one link: tradingview.com, nothing else');
  assert.match(chartSrc, /attributionLogo: false/, 'the library\'s own logo off (its inline style is refused by the CSP): the credit is ours');
  assert.match(chartSrc, /name: 'TradingView Lightweight Charts™'/);
  assert.match(chartSrc, /tail: ' · Copyright \(c\) 2025 TradingView, Inc\.'/, 'its notice');
  assert.match(files.find(([f]) => f === 'boards/gngm-coin.js')[1], /el\('div', \{ class: 'tsg-chart-host' \}, plot\), chartCredit\(\)\)/, 'the credit under the chart');
  assert.match(files.find(([f]) => f === 'shell.js')[1], /GNGM\\'s charts: TradingView Lightweight Charts™ · Copyright \(c\) 2025 TradingView, Inc\. \(tradingview\.com\)\./, 'and in How to play');
  const coinPage = files.find(([f]) => f === 'boards/gngm-coin.js')[1];
  assert.match(coinPage, /`CA \$\{f\.mint\.slice\(0, 6\)\}…`/);
  assert.match(coinPage, /'Real coin · play money'/);
  assert.match(coinPage, /' · play money'/);
  assert.match(files.find(([f]) => f === 'boards/gngm.js')[1], /play money/);
  const css = readFileSync(dir + 'trench.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const live = [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1].trim()).filter((sel) => /live|market|is-real|is-sim|is-stale|is-img|tsb-img/.test(sel));
  assert.ok(live.length >= 15, `its rules were read: ${live.length}`);
  for (const sel of live) {
    if (sel.startsWith('@') || /^\d+%$|^(from|to)$/.test(sel)) continue;
    for (const one of sel.split(',')) assert.match(one.trim(), /^\.ts[bg]?-|^html\[data-page='trenchingsimulator'\]/, `"${one.trim()}" scoped like its neighbours`);
  }
  // the run's live line: a status line (read out when it changes), always on the page; on a phone or a tablet it goes over
  // the HUD, since AGI-1's words sit under her face there and would cover it (a computer has them in the HUD's goal cell)
  const shell = files.find(([f]) => f === 'shell.js')[1];
  assert.match(shell, /el\('p', \{ class: 'ts-live-strip', role: 'status', 'aria-live': 'polite'/);
  assert.match(shell, /matchMedia\('\(min-width: 1024px\)'\)/, 'her words move into the goal cell from 1024 px');
  const narrow = css.match(/@media \(max-width: 1023px\) \{\s*\.ts-play\.is-live \{[^}]*\}\s*\.ts-play\.is-live > \.ts-live-strip \{([^}]*)\}/);
  assert.ok(narrow && /order: -1;/.test(narrow[1]), 'under 1024 px the live line comes before the HUD');
  assert.match(css, /\.ts-play\.is-live \{\s*display: flex;\s*flex-direction: column;/);
});

test("the relay's own files: its image runs as a user (never root) without any key in it, its settings file has no values for secrets, Caddy in front", () => {
  const d = 'tools/trench-relay/';
  const docker = readFileSync(`${d}Dockerfile`, 'utf8');
  assert.match(docker, /^FROM node:22/m);
  assert.match(docker, /^USER node$/m);
  assert.match(docker, /npm ci --omit=dev/);
  assert.doesNotMatch(docker, /HELIUS_API_KEY|api-key=|^ENV .*KEY/m);
  const env = readFileSync(`${d}trench.env.example`, 'utf8');
  assert.match(env, /^HELIUS_API_KEY=$/m, 'empty in the example');
  assert.match(env, /^TRENCH_TRUST_PROXY=1$/m);
  assert.doesNotMatch(env, /api-key=[A-Za-z0-9]/);
  const caddy = readFileSync(`${d}Caddyfile`, 'utf8');
  assert.match(caddy, /^live\.agi1\.app \{/m);
  assert.match(caddy, /reverse_proxy agi1-trench:8787/);
  const sh = readFileSync(`${d}relay.sh`, 'utf8');
  for (const cmd of ['update', 'start', 'stop', 'check', 'logs', 'status']) assert.match(sh, new RegExp(`\\b${cmd}\\)`), cmd);
  assert.match(sh, /\/opt\/agi1-trench/);
  assert.match(sh, /--env-file "\$DIR\/trench\.env"/);
  assert.doesNotMatch(sh, /set -x/, 'never echoes its commands (and so a key)');
  const pkg = JSON.parse(readFileSync(`${d}package.json`, 'utf8'));
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['sharp', 'ws']);
  assert.ok(Object.values(pkg.dependencies).every((v) => /^\d+\.\d+\.\d+$/.test(v)), 'exact versions');
  const lock = JSON.parse(readFileSync(`${d}package-lock.json`, 'utf8'));
  assert.equal(lock.packages[''].dependencies.ws, pkg.dependencies.ws);
});

// ---------- race rooms (2026-10-22: the relay's /room, tools/trench-relay/lib/rooms.mjs; the game's race.js) ----------
// The owner: "add the mutiplayer too only on trenching simulator, they can invite players via link idk whats better (no
// wallet needed when they invite)"; their pick: "Same-market race"

// a racer on a stand-in socket: what it says, and what it got last of each kind
const racer = (rooms, ip) => {
  const ws = new FakeWs();
  rooms.attach(ws, ip);
  return {
    ws,
    say: (o) => ws.emit('message', Buffer.from(JSON.stringify({ v: 1, ...o })), false),
    last: (t) => ws.sent.filter((m) => m.t === t).at(-1),
  };
};

test('race rooms on the relay: a code, a room of friends, the same race for everyone, its standings, its end, a rematch', () => {
  let t = 1_800_000_000_000;
  let k = 0;
  const rooms = createRooms({ now: () => t, tickMs: 1e9, pingMs: 1e9, random: (n) => (k++ * 7) % n, token: () => `tok-${String(++k).padStart(10, '0')}`,
    price: () => 151.234 });
  try {
    const host = racer(rooms, '1.1.1.1');
    host.say({ op: 'create', name: 'Ape Lord', set: { challenge: 'speedrun', seconds: 180 } });
    const r1 = host.last('room');
    assert.match(r1.code, ROOM_CODE);
    assert.deepEqual([r1.v, r1.state, r1.race, r1.max, r1.you.host, r1.players.map((p) => p.name)], [1, 'lobby', 0, 8, true, ['Ape Lord']]);
    assert.deepEqual(r1.set, { challenge: 'speedrun', seconds: 180 });
    // a friend joins with the code (as typed: lower case is fine); a name that passes for a moderator says "Trader 2"
    const friend = racer(rooms, '2.2.2.2');
    friend.say({ op: 'join', code: r1.code.toLowerCase(), name: 'admin' });
    assert.deepEqual(friend.last('room').players.map((p) => [p.name, p.host]), [['Ape Lord', true], ['Trader 2', false]]);
    assert.equal(host.last('room').players.length, 2, 'the host sees them come in');
    assert.notEqual(friend.last('room').you.token, host.last('room').you.token, 'each its own seat');
    // what's refused: a wrong code, settings that aren't a challenge's, a start by someone who isn't the host, nonsense
    const stranger = racer(rooms, '3.3.3.3');
    stranger.say({ op: 'join', code: 'ZZZZZZ' });
    assert.equal(stranger.last('err').code, 'no_room');
    stranger.say({ op: 'create', set: { challenge: 'speedrun', seconds: 5 } });
    assert.equal(stranger.last('err').code, 'bad');
    stranger.say({ op: 'toString' });
    assert.equal(stranger.ws.sent.filter((m) => m.t === 'err').length, 3);
    friend.say({ op: 'start' });
    assert.equal(friend.last('err').code, 'not_host');
    // ready, then the host starts it: the same race for everyone (its seed, SOL's price, when it starts)
    friend.say({ op: 'ready', on: true });
    assert.equal(host.last('room').players[1].ready, true);
    host.say({ op: 'start' });
    const go = host.last('go');
    assert.deepEqual(friend.last('go'), go);
    assert.deepEqual([go.race, go.seed, go.solUsd, go.seconds, go.startAt - t, go.now], [1, `race-${r1.code}-1`, 151.23, 180, ROOMS.countdownMs, t]);
    stranger.say({ op: 'join', code: r1.code });
    assert.equal(stranger.last('err').code, 'started', 'a latecomer waits for the next one');
    // the race: each says how it's going; the standings every 2 s (the bigger multiple first)
    t += ROOMS.countdownMs;
    rooms.tick();
    assert.equal(host.last('room').state, 'racing');
    t += 1000;
    host.say({ op: 'p', w: 1.2, x: 1.2, c: 1 });
    friend.say({ op: 'p', w: 0.5, x: 0.5, c: 1 });
    t += ROOMS.boardMs;
    rooms.tick();
    assert.deepEqual(host.last('board').rows.map((r) => [r.name, r.x, r.done]), [['Ape Lord', 1.2, false], ['Trader 2', 0.5, false]]);
    friend.say({ op: 'p', w: 'lots', x: 2, c: 1 });
    assert.equal(friend.last('err').code, 'bad');
    friend.say({ op: 'p', w: 5e9, x: 2, c: 999999 });
    assert.deepEqual(rooms.room(r1.code).seats[1].rep, { w: 1e7, x: 2, c: 185 }, 'kept inside what a run can be');
    // the end: a win first (fewer seconds), then the others by their multiple; once everyone's done, it's over
    t += 500;
    friend.say({ op: 'done', w: 0.75, x: 1.5, c: 60, outcome: 'won', timeUsed: 60.04 });
    friend.say({ op: 'done', w: 9, x: 9, c: 61, outcome: 'won', timeUsed: 61 });
    assert.equal(rooms.room(r1.code).seats[1].done.x, 1.5, 'its result once');
    host.say({ op: 'done', w: 1.4, x: 1.4, c: 180, outcome: 'lost' });
    const end = host.last('end');
    assert.equal(end.why, 'all_done');
    assert.deepEqual(end.rows.map((r) => [r.name, r.o, r.t, r.x]), [['Trader 2', 'won', 60, 1.5], ['Ape Lord', 'lost', null, 1.4]]);
    assert.equal(friend.last('room').state, 'ended');
    // between races someone new may come in, and the host can start a rematch: a new market
    stranger.say({ op: 'join', code: r1.code });
    assert.equal(stranger.last('room').players.length, 3);
    t += 2000;
    host.say({ op: 'start' });
    assert.equal(friend.last('go').seed, `race-${r1.code}-2`);
    assert.equal(stranger.last('go').race, 2);
    assert.deepEqual(rooms.stats(), { rooms: 1, players: 3, racing: 1, created: 1, races: 2, droppedSpam: 0 });
  } finally {
    rooms.close();
  }
});

test('race rooms: names made safe, back within a minute of a drop, rooms that end on their own, the caps', () => {
  // names: as typed, nothing invisible, single spaces, at most 16; never a moderator, a link, an address or crude
  assert.equal(roomName('  Neo​  the   One '), 'Neo the One');
  assert.equal(roomName('A'.repeat(30)), `${'A'.repeat(15)}…`);
  assert.equal(roomName('Ape 🐸'), 'Ape 🐸');
  for (const bad of ['AGI-1', 'agi team', 'TheAdmin', 'support', 'fuck off', 'visit x.com', 'me@mail', '0x1234abcd', 42, '', '   ']) {
    assert.equal(roomName(bad), null, String(bad));
  }
  let t = 1_800_000_000_000;
  let k = 0;
  const rooms = createRooms({ now: () => t, tickMs: 1e9, pingMs: 1e9, random: (n) => (k++ * 5) % n, token: () => `tok-${String(++k).padStart(10, '0')}` });
  try {
    // a dropped connection: its seat (and host) kept a minute; back with its token, it's the same seat
    const host = racer(rooms, '1.1.1.1');
    host.say({ op: 'create', set: { challenge: 'double-up', seconds: 600 } });
    const { code, you } = host.last('room');
    assert.equal(host.last('room').players[0].name, 'Trader 1', 'no name: "Trader 1"');
    const friend = racer(rooms, '2.2.2.2');
    friend.say({ op: 'join', code });
    host.ws.close();
    assert.equal(friend.last('room').players[0].gone, true);
    t += 30_000;
    const back = racer(rooms, '1.1.1.1');
    back.say({ op: 'resume', code, token: you.token });
    assert.deepEqual([back.last('room').you.id, back.last('room').you.host, back.last('room').players[0].gone], [you.id, true, false]);
    // too late: the seat is gone (and the host passes on)
    back.ws.close();
    t += ROOMS.resumeMs + 1;
    rooms.tick();
    assert.deepEqual(friend.last('room').players.map((p) => [p.id, p.host]), [[2, true]]);
    const late = racer(rooms, '1.1.1.1');
    late.say({ op: 'resume', code, token: you.token });
    assert.equal(late.last('err').code, 'no_room');
    // a room is 8 seats
    const more = [];
    for (let i = 0; i < 8; i++) {
      const p = racer(rooms, `9.9.9.${i}`);
      p.say({ op: 'join', code });
      more.push(p);
    }
    assert.equal(more[6].last('room').players.length, 8);
    assert.equal(more[7].last('err').code, 'room_full');
    assert.equal(friend.last('room').players.length, 8);
    // the host takes someone out between races
    friend.say({ op: 'kick', id: more[0].last('room').you.id });
    assert.equal(more[0].last('bye').why, 'kicked');
    assert.equal(friend.last('room').players.length, 7);
    // a lobby that never races closes after 15 minutes
    t += ROOMS.lobbyMs;
    rooms.tick();
    assert.equal(friend.last('bye').why, 'expired');
    assert.equal(rooms.room(code), null);
    // one address makes at most 3 rooms in 10 minutes
    const maker = racer(rooms, '4.4.4.4');
    for (let i = 0; i < 3; i++) {
      maker.say({ op: 'create', set: { challenge: 'speedrun', seconds: 180 } });
      maker.say({ op: 'leave' });
      t += 1000;
    }
    maker.say({ op: 'create', set: { challenge: 'speedrun', seconds: 180 } });
    assert.equal(maker.last('err').code, 'too_many');
    // an empty room is gone a minute later
    t += ROOMS.emptyMs;
    rooms.tick();
    assert.equal(rooms.stats().rooms, 0);
    // wrong codes: 10 a minute from one address, then it's closed
    const guesser = racer(rooms, '5.5.5.5');
    for (let i = 0; i < 11; i++) {
      t += 600; // (inside its message allowance: about two a second)
      guesser.say({ op: 'join', code: 'ZZZZZZ' });
    }
    assert.deepEqual(guesser.ws.closed, { code: 1008, why: 'too many tries' });
    // too much at once, or a message over 1 KB: closed
    const spam = racer(rooms, '6.6.6.6');
    for (let i = 0; i < ROOMS.msgBurst + 1; i++) spam.say({ op: 'ready', on: true });
    assert.deepEqual(spam.ws.closed, { code: 1008, why: 'too many messages' });
    const big = racer(rooms, '7.7.7.7');
    big.ws.emit('message', Buffer.alloc(ROOMS.maxMsgBytes + 1, 32), false);
    assert.deepEqual(big.ws.closed, { code: 1008, why: 'bad message' });
    // a race nobody finishes ends at its time (plus a little grace), and an ended room closes 5 minutes later
    const h2 = racer(rooms, '8.8.8.8');
    h2.say({ op: 'create', set: { challenge: 'speedrun', seconds: 180 } });
    t += 1000;
    h2.say({ op: 'start' });
    t += ROOMS.countdownMs + 180_000 + ROOMS.graceMs;
    rooms.tick();
    assert.equal(h2.last('end').why, 'time');
    t += ROOMS.endedMs;
    rooms.tick();
    assert.equal(h2.last('bye').why, 'expired');
  } finally {
    rooms.close();
  }
});

test('race rooms on the real relay: /room only from the site\'s pages, its own caps, a race over real sockets, /health, off when switched off', async () => {
  const fakes = await startFakes();
  const timing = { roomTickMs: 20, rooms: { countdownMs: 60, boardMs: 30 } };
  const { relay, http: base } = await relayWith(fakes, { TRENCH_CHAINS: 'bnb', TRENCH_ROOMS_PER_IP: '2' }, timing);
  const url = base.replace('http://', 'ws://') + '/room';
  const open = [];
  try {
    await assert.rejects(viewer(url, { origin: 'https://evil.example' }).opened, /403/);
    const a = viewer(url);
    const b = viewer(url);
    open.push(a, b);
    await Promise.all([a.opened, b.opened]);
    await assert.rejects(viewer(url).opened, /429/, 'two from one address (TRENCH_ROOMS_PER_IP)');
    a.send({ op: 'create', v: 1, name: 'Ape', set: { challenge: 'speedrun', seconds: 180 } });
    const code = (await until(() => a.of('room')[0], 3000, 'its room')).code;
    b.send({ op: 'join', v: 1, code, name: 'Frog' });
    await until(() => a.of('room').some((m) => m.players.length === 2), 3000, 'the friend in');
    a.send({ op: 'start', v: 1 });
    const [ga, gb] = await until(() => (a.of('go')[0] && b.of('go')[0] ? [a.of('go')[0], b.of('go')[0]] : null), 3000, 'the race');
    assert.equal(ga.seed, gb.seed);
    assert.equal(ga.solUsd, 150, 'no price from DexScreener yet: 150, the same for everyone');
    await until(() => a.of('room').some((m) => m.state === 'racing'), 3000, 'racing');
    a.send({ op: 'p', v: 1, w: 1.1, x: 1.1, c: 1 });
    await until(() => b.of('board').some((m) => m.rows.length === 2), 3000, 'the standings');
    const health = await (await fetch(`${base}/health`)).json();
    assert.deepEqual([health.rooms.rooms, health.rooms.players, health.rooms.racing], [1, 2, 1]);
    // a message over 1 KB: the socket's closed
    const closed = new Promise((r) => b.ws.on('close', (c) => r(c)));
    b.ws.send('x'.repeat(2000));
    assert.equal(await closed, 1009);
  } finally {
    open.forEach((v) => v.ws.close());
    await relay.close();
    await fakes.close();
  }
  // switched off (TRENCH_ROOMS=off): /room isn't there, the Live feed is
  const f2 = await startFakes();
  const { relay: r2, http: b2 } = await relayWith(f2, { TRENCH_CHAINS: 'bnb', TRENCH_ROOMS: 'off' });
  try {
    await assert.rejects(viewer(b2.replace('http://', 'ws://') + '/room').opened, /404/);
    assert.equal((await (await fetch(`${b2}/health`)).json()).rooms, null);
  } finally {
    await r2.close();
    await f2.close();
  }
});

test('race rooms in the browser: an invite link, what the relay sends checked, a room from making it to its end, dropped and back, closed', () => {
  // the address: the Live feed's relay, its /room door; an invite link's code; a code as typed
  assert.equal(RACE.raceUrl({ hostname: 'agi1.app', search: '' }), 'wss://live.agi1.app/room');
  assert.equal(RACE.raceUrl({ hostname: 'localhost', search: '?relay=ws://localhost:8787/ws' }), 'ws://localhost:8787/room');
  assert.equal(RACE.roomOfHash('#room=k7qx2m'), 'K7QX2M');
  for (const h of ['', '#room=', '#room=K7QX2', '#room=K7QX2MM', '#room=K7QX0M', '#rate', null, 42]) assert.equal(RACE.roomOfHash(h), null, String(h));
  assert.equal(RACE.inviteLink('K7QX2M'), 'https://agi1.app/games/trenchingsimulator#room=K7QX2M');
  assert.equal(RACE.cleanCode(' k7qx-2m '), 'K7QX2M');
  assert.equal(RACE.cleanCode('IL1O00'), null, 'never the letters that look alike');
  // what the relay sends: checked, anything odd dropped
  const room = { t: 'room', v: 1, code: 'K7QX2M', you: { id: 1, token: 'tok-0000000001', host: true }, set: { challenge: 'speedrun', seconds: 180 },
    players: [{ id: 1, name: 'Ape Lord', ready: false, host: true, gone: false }], state: 'lobby', race: 0, max: 8 };
  const { v: _v, ...roomRead } = room;
  assert.deepEqual(RACE.parseRaceMessage(JSON.stringify(room)), roomRead);
  for (const bad of [{ ...room, v: 2 }, { ...room, code: 'nope' }, { ...room, state: 'flying' }, { ...room, set: { challenge: 'X', seconds: 180 } },
    { ...room, you: { id: 1, token: '<b>', host: true } }, { ...room, players: 'all' }, { t: 'go', v: 1 }, { t: 'board', v: 1, rows: [{ id: 'x' }] },
    { t: 'err', v: 1, code: 'whatever' }, { t: 'hello', v: 1 }]) assert.equal(RACE.parseRaceMessage(JSON.stringify(bad)), null, JSON.stringify(bad));
  assert.equal(RACE.parseRaceMessage('{not json'), null);
  assert.equal(RACE.parseRaceMessage(JSON.stringify({ t: 'bye', v: 1, why: 'weird' })).why, 'expired');
  const named = RACE.parseRaceMessage(JSON.stringify({ ...room, players: [{ id: 3, name: '‮evil​', ready: true }] }));
  assert.deepEqual(named.players, [{ id: 3, name: 'evil', ready: true, host: false, gone: false }]);
  // a room, start to end, on a stand-in socket
  const made = [];
  class FakeSocket {
    constructor(u) {
      this.url = u;
      this.readyState = 0;
      this.sent = [];
      made.push(this);
    }
    send(x) {
      this.sent.push(JSON.parse(x));
    }
    close() {
      this.readyState = 3;
      if (this.onclose) this.onclose({ code: 1000 });
    }
    open() {
      this.readyState = 1;
      this.onopen();
    }
    msg(o) {
      this.onmessage({ data: JSON.stringify({ v: 1, ...o }) });
    }
    drop() {
      this.readyState = 3;
      this.onclose({ code: 1006 });
    }
  }
  let t = 1_000_000;
  const timers = [];
  const race = RACE.createRace({ url: 'ws://127.0.0.1:1/room', WebSocket: FakeSocket, now: () => t, random: () => 0.5,
    timers: { set: (fn, ms) => timers.push({ fn, ms }) && timers.length, clear: () => {} } });
  const seen = [];
  race.on((ev) => seen.push(ev.type === 'status' ? ev.status : ev.type));
  race.create({ name: 'Ape Lord', set: { challenge: 'speedrun', seconds: 180 } });
  assert.equal(race.status, 'connecting');
  made[0].open();
  assert.deepEqual(made[0].sent, [{ op: 'create', v: 1, name: 'Ape Lord', set: { challenge: 'speedrun', seconds: 180 } }]);
  made[0].msg(room);
  assert.deepEqual([race.status, race.isHost, race.room.code], ['lobby', true, 'K7QX2M']);
  race.ready(true);
  race.start();
  assert.deepEqual(made[0].sent.slice(1).map((m) => m.op), ['ready', 'start']);
  // the race: its clock is the relay's (this one is 2 s behind it)
  made[0].msg({ t: 'go', race: 1, seed: 'race-K7QX2M-1', solUsd: 151.23, set: room.set, startAt: t + 2000 + 5000, now: t + 2000, seconds: 180 });
  assert.deepEqual([race.status, race.offset, race.startsIn()], ['countdown', 2000, 5000]);
  t += 5000;
  made[0].msg({ ...room, state: 'racing' });
  // how it's going: at most once a second
  assert.equal(race.report({ worth: 1.1, multiple: 1.1, clock: 0.1 }), true);
  assert.equal(race.report({ worth: 1.2, multiple: 1.2, clock: 0.5 }), false);
  t += 1000;
  assert.equal(race.report({ worth: 1.3, multiple: 1.3, clock: 1.1 }), true);
  assert.deepEqual(made[0].sent.filter((m) => m.op === 'p').map((m) => m.x), [1.1, 1.3]);
  made[0].msg({ t: 'board', rows: [{ id: 1, name: 'Ape Lord', w: 1.3, x: 1.3, c: 1.1, o: null, t: null, done: false, gone: false }] });
  assert.equal(race.board[0].x, 1.3);
  // dropped: down, and back on the same seat (its token) by itself
  made[0].drop();
  assert.equal(race.status, 'down');
  timers.at(-1).fn();
  made[1].open();
  assert.deepEqual(made[1].sent, [{ op: 'resume', v: 1, code: 'K7QX2M', token: 'tok-0000000001' }]);
  made[1].msg({ ...room, state: 'racing' });
  assert.equal(race.status, 'racing');
  // its end: once
  assert.equal(race.finish({ worth: 1.6, multiple: 1.6, clock: 70, outcome: 'won', timeUsed: 70 }), true);
  assert.equal(race.finish({ worth: 9, multiple: 9, clock: 71, outcome: 'won', timeUsed: 71 }), false);
  assert.equal(race.report({ worth: 2, multiple: 2, clock: 72 }), false, 'nothing after its end');
  made[1].msg({ t: 'end', why: 'all_done', rows: [{ id: 1, name: 'Ape Lord', w: 1.6, x: 1.6, c: 70, o: 'won', t: 70, done: true, gone: false }] });
  assert.equal(race.status, 'ended');
  assert.equal(RACE.standingText(race.board[0], 0), '1. Ape Lord · 1.60x · won in 1:10');
  assert.equal(RACE.standingText(race.board[0], 0, { you: true }), '1. You · 1.60x · won in 1:10');
  race.leave();
  assert.equal(race.status, 'idle');
  assert.equal(made[1].sent.at(-1).op, 'leave');
  assert.deepEqual(seen.filter((s) => typeof s === 'string' && ['connecting', 'lobby', 'countdown', 'racing', 'down', 'ended', 'idle'].includes(s)),
    ['connecting', 'lobby', 'countdown', 'racing', 'down', 'racing', 'ended', 'idle']);
  // a code that doesn't exist: closed, with words to say so
  const r2 = RACE.createRace({ url: 'ws://x/room', WebSocket: FakeSocket, timers: { set: () => 0, clear: () => {} } });
  r2.join('ZZZZZZ');
  made.at(-1).open();
  made.at(-1).msg({ t: 'err', code: 'no_room' });
  assert.deepEqual([r2.status, r2.error], ['closed', 'no_room']);
  assert.match(RACE.raceWords(r2.status, r2.error), /no room with that code/);
  // the relay without race rooms yet (before relay.sh update): "aren't open right now", never a crash
  const r3 = RACE.createRace({ url: 'ws://x/room', WebSocket: FakeSocket, timers: { set: () => 0, clear: () => {} } });
  r3.join('K7QX2M');
  made.at(-1).drop();
  assert.deepEqual([r3.status, r3.error], ['down', 'unreachable']);
  assert.equal(RACE.raceWords(r3.status, r3.error), 'Race rooms aren\'t open right now. You can still play on your own.');
  const none = RACE.createRace({ url: 'ws://x/room', WebSocket: null });
  none.create({ set: { challenge: 'speedrun', seconds: 180 } });
  assert.equal(none.status, 'down');
  // its words: never "buy", a price or advice
  for (const s of ['connecting', 'down', 'closed', 'lobby', 'countdown', 'racing', 'ended']) {
    for (const e of [null, 'unreachable', 'no_room', 'room_full', 'started', 'too_many', 'rooms_full', 'kicked', 'expired', 'restart', 'lost']) {
      assert.doesNotMatch(RACE.raceWords(s, e), /\bbuy\b|\$\d|advice|guarantee/i);
    }
  }
});

test('race rooms in the game: Race a friend on the home screen, an invite link opens its room, a race is simulated, never ranked, counted once', () => {
  const shell = readFileSync('src/games/trenchingsimulator/shell.js', 'utf8');
  assert.match(shell, /btn\('Race a friend', \{ ic: 'users', on: \(\) => go\('race'\) \}\)/);
  assert.doesNotMatch(shell, /Multiplayer · coming soon/, 'not "coming soon" any more');
  // an invite link: its room's screen, the code out of the address (never a reload), the room left with its screens
  assert.match(shell, /const code = roomOfHash\(location\.hash\);/);
  assert.match(shell, /history\.replaceState\(history\.state, '', `\$\{location\.pathname\}\$\{location\.search\}`\)/);
  assert.match(shell, /addEventListener\('hashchange', invite\)/);
  assert.match(shell, /if \(S\.race && S\.race\.status !== 'idle' && node\.dataset\.race !== '1'\) leaveRoom\(\);/);
  // a race: the room's seed and SOL price, simulated (never Live mode), on a clock that never stops, never ranked
  assert.match(shell, /const live = !race && liveRun\(setup\) \? S\.save\.chain : null;/);
  assert.match(shell, /const rankable = !race && !live &&/);
  assert.match(shell, /run = createRun\(\{ seed: race\.seed, challenge: challengeById\(setup\.id\), mode: 'challenge', solUsd: race\.solUsd, currency: t\.currency,\s*terminal: t\.id, realTime: true \}\);/);
  assert.match(shell, /let ranked = race \? \{ why: 'race' \}/);
  assert.equal((shell.match(/Site\.play\(\)/g) || []).length, 1, 'a race is counted like any run, in the same one place');
  // how it's going, to the room (at most once a second: race.js), its end once
  assert.match(shell, /if \(setup\.race && S\.race && !run\.over\) S\.race\.report\(\{ worth: h\.worth, multiple: h\.multiple, clock: h\.clock \}\);/);
  assert.match(shell, /S\.race\.finish\(\{ worth: res\.worth, multiple: res\.multiple, clock: res\.timeUsed, outcome: res\.outcome, timeUsed: res\.timeUsed \}\);/);
  // the results' line: never ranked, and why
  assert.match(readFileSync('src/games/boards.js', 'utf8'), /race: 'Races aren\\'t ranked: the room\\'s standings are just for fun\.'/);
});
