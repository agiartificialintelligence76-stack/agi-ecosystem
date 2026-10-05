// ClankChecker (2026-09-26): the risk scan of clank.trade coins (server/checker.js), its API (api/checker.js), AGI-1's lines
// about a scan (src/checker/lines.js) and the page's list helpers (src/sections/checker.js). clank.trade, its picture host,
// DexScreener and the block explorer are faked with the shapes they really answer with (read on 2026-09-26). Run: npm test
// Round 2 (the owner, the same day): live updates (?latest), coin pictures (?logo=…), and every coin listed (crude names too).
// 2026-10-05 (the owner: "not accurate and theres no pictures"): coins paired with SPCX priced at SPCX's price, not ETH's,
// and pictures from public IPFS gateways (clank.trade's own gateway only answers its own pages), made small with sharp.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import zlib from 'node:zlib';
import { GET, POST, resetForTests } from '../api/checker.js';
import { analyze, checkCoin, scanClank, latestClank, markCopycats, showTicker, tickerKey, usd, percent, timeText, maskSlurs, cidOf,
  coinPictureId, forgetPictures, POOL_MANAGER, OFFICIAL, MAX_PAGES, pictureOf } from '../server/checker.js';
import { fetchCoinPicture, PICTURE_SIZES, GATEWAYS, ORIGINAL_MAX_BYTES, pictureType, setSharpForTests } from '../server/coin-pictures.js';
import { CHECK_LINES, LEVELS, checkLine, spokenOf } from '../src/checker/lines.js';
import { LINES, LINE_MOODS, MOOD_STYLES } from '../server/voice.js';
import { pick, usdShort, ageShort, agoText, stageText, mergeLatest, tidyCoin } from '../src/sections/checker.js';
import { analyzeChain, LOCKED_TEXT } from '../server/checker.js';
import { readCoinOnChain, shareOf, FACTORY, FACTORY_ABI, CURVE_ABI, TOKEN_ABI, STAGE, SPCX } from '../server/clank-chain.js';
import { SPCX as LAUNCH_SPCX } from '../server/launch.js';
import { decodeFunctionData, encodeFunctionResult } from 'viem';

const NOW = Date.UTC(2026, 8, 26, 12, 0, 0);
const S = NOW / 1000;
const H = 3600, D = 86_400, DAY_MS = 86_400_000;
const ETH_USD = '2689.164696758498861512';
// SPCX, Robinhood's SpaceX stock token: clank.trade's second pair (2026-10-02), its price as clank.trade gave it on 2026-10-05
const SPCX_USD = '160.479619942851745065';
const CURVE = '0x3e73c6bc1dd85e5037080be44403fff0f160a3fa';
const HOOKS = '0x18bff70216af1b93f3552016dec742c5d78ee000';
const CREATOR = '0x001ac0ffeec0ffeec0ffeec0ffeec0ffeec0ffee';
const CABO = '0xcf5b720f33febdc1c9d4880b8317203b63fdf368';   // on clank.trade, but never shown on this site (2026-09-28)
const MEOW = '0x4444444444444444444444444444444444444444';
const ABC = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const COIN = '0x8d45402124cc47687075b911af28bd2f246eb212';
const DEAD = '0x7ee4501111111111111111111111111111111111';
// real content ids from clank.trade's list (2026-09-26)
const CID1 = 'bafkreiborp2klxbx4jemgyyuu4dmcjtd2kztj7psvrhjzesu76wjy2qgce';
const CID2 = 'bafybeifs73il537t3zuag2zf2ekdm2iso6q4twlfvooq4isk4uejdn4yjq';
// clank.trade's own Pinata gateway: since October 2026 it only answers clank.trade's own pages, so it's never asked
const PINATA = 'https://yellow-total-guanaco-389.mypinata.cloud/ipfs/';
// the public IPFS gateways the pictures come from instead, in order, and ClankBot's picture host
const FILEBASE = 'https://ipfs.filebase.io/ipfs/', PINATA_PUBLIC = 'https://gateway.pinata.cloud/ipfs/', IPFS_IO = 'https://ipfs.io/ipfs/';
const CLANKBOT_PIC = 'https://clankbot.trade/images/launches/2104949577573146779.jpg';
// the first bytes of a real WebP / PNG, and an SVG (never served)
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(40, 7)]);
const PNG = Buffer.concat([Buffer.from([0x89]), Buffer.from('PNG\r\n\x1a\n'), Buffer.alloc(40, 1)]);
// real pictures, as coin creators upload them (made here with sharp): a photo, a square PNG, a small one, a big one
const PHOTO = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#ff3f9a' } }).jpeg({ quality: 90 }).toBuffer();
const SQUARE = await sharp({ create: { width: 400, height: 400, channels: 4, background: { r: 107, g: 59, b: 255, alpha: 1 } } }).png().toBuffer();
const SMALL = await sharp({ create: { width: 64, height: 40, channels: 3, background: '#ffc933' } }).png().toBuffer();
const BIG = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#3ff0c3' } }).jpeg().toBuffer();
const metaOf = (bytes) => sharp(bytes).metadata();
const wallet = (n) => `0x${n.toString(16).padStart(4, '0')}${'c0ffee'.repeat(6)}`;
// a balance that is `pct` percent of the 1B supply (18 decimals)
const bal = (pct) => ((10n ** 27n * BigInt(Math.round(pct * 10_000))) / 1_000_000n).toString();
// a list of holders: [address, pct] pairs (the biggest first, like clank.trade)
const holdersOf = (pairs) => pairs.map(([address, pct]) => ({ address, balance: bal(pct) })).sort((a, b) => (BigInt(b.balance) > BigInt(a.balance) ? 1 : -1));
const spread = (n, pct, from = 100) => Array.from({ length: n }, (_, i) => [wallet(from + i), pct]);
// trades, newest first: [trader, side, secondsAgo]
const tradesOf = (list) => list.map(([trader, side, ago], i) => ({ id: `t${i}`, trader, side, baseAmount: '1000', quoteAmount: '1000', timestamp: String(S - ago), transactionHash: `0x${String(i).padStart(64, '0')}`, cursor: `c${i}` }));
const lively = (n = 60, every = 300) => tradesOf(Array.from({ length: n }, (_, i) => [wallet(500 + (i % 30)), i % 2 ? 'sell' : 'buy', i * every]));

function detail(o = {}) {
  const address = o.address || COIN;
  return {
    id: `market:4663:${address}`, address: address.toUpperCase().replace('0X', '0x'), curve: CURVE, name: 'Egirl Acceleration', symbol: 'E/ACC',
    image: 'ipfs://bafybeiactrc6p6sdhypbyh3cq3zblsgbhjedsm6mkaxyttzh3ovuzrz6jm', creator: CREATOR, website: '', twitter: '',
    createdAt: String(S - 5 * D), quoteCurrency: '0x0000000000000000000000000000000000000000', quoteDecimals: 18, quoteSymbol: 'ETH',
    state: 0, poolKey: { currency0: '0x0000000000000000000000000000000000000000', currency1: address, fee: 3000, tickSpacing: 200, hooks: HOOKS },
    progress: 30, price: 3.8e-9, marketCap: 3.79, totalSupply: '1000000000000000000000000000', reserve: '950957059954408513',
    threshold: '4276363636363636363', ...o,
  };
}
// a healthy graduated coin (its numbers are a real one's, 2026-09-26)
const grad = (o = {}) => detail({ address: MEOW, name: 'Meow', symbol: 'MEOW', state: 3, progress: 100, marketCap: 49.29, reserve: '0', createdAt: String(S - 10 * D), ...o });
const scanOf = (o) => analyze({ detail: detail(), holders: holdersOf([[CURVE, 60], ...spread(60, 0.5)]), trades: lively(), ethUsd: Number(ETH_USD), sameTicker: [], now: NOW, ...o });
const has = (scan, id, sev) => scan.flags.some((f) => f.id === id && (!sev || f.sev === sev));

// ---------- fakes ----------
let fake, calls, inits, rpcCalls;
// Robinhood Chain (2026-09-29, the Clank protocol's contracts): answers eth_calls the way the contracts would, from
// fake.chain = { coins: { [coin]: { launch, name, symbol, supply, logo, balances } }, curves: { [curve]: { state, reserve } } }
const ZERO = '0x0000000000000000000000000000000000000000';
// fake.chainFail: names of calls that fail on their own inside a batch (a node's per-call limit), the rest still answer
function chainAnswer({ to, data }) {
  const coins = fake.chain.coins || {}, curves = fake.chain.curves || {};
  const out = (abi, functionName, result) => (fake.chainFail.has(functionName)
    ? { error: { code: -32005, message: 'limit exceeded' } }
    : { result: encodeFunctionResult({ abi, functionName, result }) });
  const reverted = { error: { code: 3, message: 'execution reverted' } };
  try {
    if (to === FACTORY) {
      const { args } = decodeFunctionData({ abi: FACTORY_ABI, data });
      const c = coins[String(args[0]).toLowerCase()];
      const none = { launchToken: ZERO, curve: ZERO, deployer: ZERO, creatorFeeRecipient: ZERO, pairToken: ZERO, graduationThreshold: 0n, poolFee: 0,
        tickSpacing: 0, creatorTaxBps: 0, buybackEnabled: false, phase: 0, sweptPairToken: 0n, sweptLaunchTokens: 0n, sweptAt: 0n, exists: false };
      return out(FACTORY_ABI, 'getLaunchedToken', c ? c.launch : none);
    }
    if (curves[to]) {
      const { functionName } = decodeFunctionData({ abi: CURVE_ABI, data });
      return out(CURVE_ABI, functionName, functionName === 'state' ? curves[to].state : curves[to].reserve);
    }
    const c = coins[to];
    if (!c) return reverted;
    const { functionName, args } = decodeFunctionData({ abi: TOKEN_ABI, data });
    const value = { name: c.name, symbol: c.symbol, totalSupply: c.supply, logo: c.logo, balanceOf: c.balances?.[String(args?.[0]).toLowerCase()] ?? 0n }[functionName];
    return value === undefined ? reverted : out(TOKEN_ABI, functionName, value);
  } catch { return reverted; }
}
const launchOf = (coin, o = {}) => ({ launchToken: coin, curve: CURVE, deployer: CREATOR, creatorFeeRecipient: CREATOR, pairToken: ZERO,
  graduationThreshold: 4276363636363636363n, poolFee: 3000, tickSpacing: 200, creatorTaxBps: 0, buybackEnabled: false, phase: 0,
  sweptPairToken: 0n, sweptLaunchTokens: 0n, sweptAt: 0n, exists: true, ...o });
const onChain = (coin, { state = 0, reserve = 950957059954408513n, creator = 0n, launch = {}, symbol = 'E/ACC', name = 'Egirl Acceleration', logo = `ipfs://${'bafkreiborp2klxbx4jemgyyuu4dmcjtd2kztj7psvrhjzesu76wjy2qgce'}` } = {}) => {
  fake.chain = {
    coins: { [coin]: { launch: launchOf(coin, launch), name, symbol, supply: 10n ** 27n, logo, balances: { [CREATOR]: creator, [CURVE]: 6n * 10n ** 26n } } },
    curves: { [CURVE]: { state, reserve } },
  };
};
function listRow(c) {
  return { id: `market:4663:${c.address}`, address: c.address, name: c.name, symbol: c.symbol, image: c.image ?? 'ipfs://x', creator: CREATOR, website: null, twitter: null,
    createdAt: String(c.createdAt ?? S - D), marketCap: c.marketCap ?? 1.55, quoteSymbol: 'ETH', quoteCurrency: '0x0000000000000000000000000000000000000000', state: c.state ?? 0, progress: c.progress ?? 0 };
}
beforeEach(() => {
  resetForTests();
  forgetPictures();
  process.env.PASS_SECRET = 'test-pass-secret-that-is-long-enough-1234';
  delete process.env.CHECKER_HIDE_PICTURES;
  console.error = () => {}; console.warn = () => {}; console.log = () => {};
  calls = [];
  inits = [];
  rpcCalls = [];
  fake = {
    chain: null,                            // Robinhood Chain: null = the node doesn't answer (as before 2026-09-29)
    chainFail: new Set(), chainDelay: 0, chainStringIds: false,
    down: false, wall: false,
    coins: {},                              // address → { detail, holders, trades }
    pages: [[]],                            // coins.list pages (rows)
    trending: [],
    search: {},                             // query → rows
    dex: {},                                // address → pairs | 'down'
    explorer: {},                           // address → holders_count | 'down'
    pictures: {},                           // content id (or ClankBot address) → { type, bytes } | 'down'
    gateways: {},                           // filebase | pinata | ipfsio | clankbot → 'down' | 'timeout' | 'html' | 'missing'
    prices: { [ZERO]: ETH_USD, [SPCX]: SPCX_USD },   // clank.trade's dollar price for each pair
  };
  setSharpForTests(undefined);              // the real sharp (a test can take it away)
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    if (url === 'https://rpc.mainnet.chain.robinhood.com') {
      const batch = JSON.parse(init.body);
      rpcCalls.push(batch);
      if (fake.chainDelay) await new Promise((resolve) => setTimeout(resolve, fake.chainDelay));
      if (init.signal?.aborted) throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      if (!fake.chain) return new Response('busy', { status: 503 });
      if (fake.chain === 'no-batch') return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'batch requests are not allowed' } });
      return Response.json(batch.map((q) => ({ jsonrpc: '2.0', id: fake.chainStringIds ? String(q.id) : q.id, ...chainAnswer(q.params[0]) })));
    }
    calls.push(url);
    inits.push(init);
    if (url.startsWith(PINATA)) return new Response('This content cannot be requested through the gateway you are using - ERR_ID:00024', { status: 401 });
    const gateway = [[FILEBASE, 'filebase'], [PINATA_PUBLIC, 'pinata'], [IPFS_IO, 'ipfsio'], ['https://clankbot.trade/', 'clankbot']].find(([base]) => url.startsWith(base));
    if (gateway) {
      const how = fake.gateways[gateway[1]];
      if (how === 'down') return new Response('bad gateway', { status: 502 });
      if (how === 'timeout') throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      if (how === 'html') return new Response('<html>a gateway error page</html>', { headers: { 'content-type': 'text/html' } });
      const pic = how === 'missing' ? null : fake.pictures[gateway[1] === 'clankbot' ? url : url.slice(gateway[0].length)];
      if (pic === 'down') return new Response('gateway timeout', { status: 504 });
      if (!pic) return new Response('not found', { status: 404 });
      return new Response(pic.bytes, { headers: { 'content-type': pic.type } });
    }
    const u = new URL(url);
    if (u.origin === 'https://clank.trade' && u.pathname.startsWith('/v1/trpc/')) {
      if (fake.down) throw new Error('connect ECONNREFUSED');
      if (fake.wall) return new Response('<html>Just a moment...</html>', { status: 403, headers: { 'content-type': 'text/html' } });
      const names = u.pathname.slice('/v1/trpc/'.length).split(',');
      const input = JSON.parse(u.searchParams.get('input'));
      const out = names.map((name, i) => {
        const arg = input[i] || {};
        const coin = fake.coins[arg.address];
        const notFound = { error: { message: 'Coin is not indexed yet', code: -32004, data: { code: 'NOT_FOUND', httpStatus: 404, path: name } } };
        if (name === 'coins.detail') return coin ? { result: { data: coin.detail } } : notFound;
        if (name === 'coins.holders') return coin ? (coin.holdersError ? { error: { message: 'boom', data: { httpStatus: 500 } } } : { result: { data: { holders: coin.holders } } }) : notFound;
        if (name === 'coins.trades') return coin ? { result: { data: { trades: coin.trades.slice(0, arg.limit), nextCursor: null, headCursor: 'h' } } } : notFound;
        if (name === 'exchangeRates.tokenUsdg') {
          const price = fake.prices[String(arg.token).toLowerCase()];
          return price ? { result: { data: { price, token: arg.token, tokenDecimals: 18 } } } : { error: { message: 'no price for that token', data: { httpStatus: 404 } } };
        }
        if (name === 'coins.trending') return { result: { data: fake.trending.map((t) => (typeof t === 'string' ? { address: t } : t)) } };
        if (name === 'coins.list') {
          if ('query' in arg) return fake.search === 'down' ? { error: { message: 'boom', data: { httpStatus: 500 } } } : { result: { data: { coins: fake.search[arg.query] || [], nextCursor: null } } };
          const n = arg.cursor ? Number(arg.cursor.slice(1)) : 0;
          return { result: { data: { coins: fake.pages[n] || [], nextCursor: n + 1 < fake.pages.length ? `p${n + 1}` : null } } };
        }
        return { error: { message: 'no such procedure', data: { httpStatus: 404 } } };
      });
      const bad = out.filter((x) => x.error).length;
      return Response.json(out, { status: !bad ? 200 : bad === out.length ? 404 : 207 });
    }
    if (url.startsWith('https://api.dexscreener.com/tokens/v1/robinhood/')) {
      const a = url.split('/').pop();
      if (fake.dex[a] === 'down') return new Response('busy', { status: 503 });
      return Response.json(fake.dex[a] || []);
    }
    if (url.startsWith('https://robinhoodchain.blockscout.com/api/v2/tokens/')) {
      const a = url.split('/').pop();
      if (fake.explorer[a] === 'down') return new Response('busy', { status: 502 });
      return Response.json({ holders_count: String(fake.explorer[a] ?? 0), name: 'x', symbol: 'X', type: 'ERC-20' });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
});
const pair = (address, liquidity, h24 = -16.56) => ({ chainId: 'robinhood', dexId: 'uniswap', labels: ['v4'], baseToken: { address, symbol: 'X' }, quoteToken: { symbol: 'WETH' },
  priceUsd: '0.0001318', liquidity: { usd: liquidity }, priceChange: { h24 }, volume: { h24: 28307.29 }, marketCap: 131991, fdv: 131991 });
const get = (search = '', ip = '203.0.113.7') => GET(new Request(`https://x.test/api/checker${search}`, { headers: { 'x-real-ip': ip } }));

// ---------- AGI-1's lines ----------
const ADVICE = /\b(buy|buying|sell|selling|sold|hold|holding|hodl|ape|aping|invest|investing|investment|profit|profits|gains?|returns?|moon|mooning|pump|pumping|dip|next stop|going up|will go|gonna go|soon|target|100x|1000x|lambo|rich|guaranteed|don't miss|last chance|hurry|panic|dca|entry|safe|safer|safest)\b/i;
const PET_NAMES = /\b(babe|baby|cutie|love|darling|sweetie|honey)\b/i;

test('her lines: every one PG-13, lowercase, "not financial advice", never advice or "safe", no pet names; two per level', () => {
  assert.deepEqual(Object.keys(LEVELS), ['low', 'some', 'high', 'none']);
  assert.deepEqual(Object.values(LEVELS).map((l) => l.label), ['Lower risk', 'Some risk', 'High risk', 'Not enough data']);
  const keys = Object.keys(CHECK_LINES).sort();
  assert.deepEqual(keys, ['check-agi', 'check-copy', 'check-high-1', 'check-high-2', 'check-low-1', 'check-low-2', 'check-none-1', 'check-none-2', 'check-some-1', 'check-some-2']);
  for (const line of Object.values(CHECK_LINES)) {
    assert.match(line.text, /not financial advice\.$/, `${line.key}: ends with "not financial advice"`);
    assert.doesNotMatch(line.text, ADVICE, `${line.key}: never advice`);
    assert.doesNotMatch(line.text, PET_NAMES, `${line.key}: no pet names (anyone may ask, Strangers too)`);
    assert.equal(line.text.replace(/\$AGI/g, 'x'), line.text.replace(/\$AGI/g, 'x').toLowerCase(), `${line.key}: lowercase texting`);
    assert.ok(line.text.length <= 160, `${line.key}: short`);
    assert.doesNotMatch(line.spoken, /\p{Extended_Pictographic}|\$/u, `${line.key}: her voice says no emojis and no "$"`);
    assert.ok(/[.!?…]$/.test(line.spoken) && line.spoken.length <= 300, line.key);
    assert.ok(['okay', 'hmm', 'worried', 'shy', 'love', 'jealous'].includes(line.react), line.key);
  }
  // her emojis end a sentence, so out loud they're a full stop (not "…than most nothing big jumped out")
  assert.equal(spokenOf('okay, this one looks calmer than most 💜 nothing big jumped out at me. not financial advice.'),
    'okay, this one looks calmer than most. nothing big jumped out at me. not financial advice.');
  assert.equal(spokenOf('wait, that\'s me! 💜 i\'m biased 🙈'), 'wait, that\'s me! i\'m biased');
  assert.match(CHECK_LINES['check-copy'].spoken, /the real AGI has one official contract/);
});

test('her line for a scan: the same coin always gets the same one, the official $AGI and its copies get their own', () => {
  assert.equal(checkLine({ level: 'low', official: true, address: OFFICIAL }).key, 'check-agi');
  assert.equal(checkLine({ level: 'high', copyOfficial: true, address: DEAD }).key, 'check-copy');
  assert.equal(checkLine({ level: 'none', official: true }).key.startsWith('check-none'), true, 'no scan: no "that\'s me"');
  for (const level of ['low', 'some', 'high', 'none']) {
    const seen = new Set();
    for (let i = 0; i < 16; i++) {
      const address = `0x${'1'.repeat(36)}${i.toString(16).padStart(4, '0')}`;
      const a = checkLine({ level, address }), b = checkLine({ level, address });
      assert.equal(a.key, b.key, 'the same coin, the same line');
      assert.match(a.key, new RegExp(`^check-${level}-[12]$`));
      seen.add(a.key);
    }
    assert.equal(seen.size, 2, `${level}: both lines get used`);
  }
  assert.match(checkLine({ level: 'weird' }).key, /^check-none-/);
});

test('her voice for them: fixed lines (made once and kept), each with its own style', () => {
  for (const line of Object.values(CHECK_LINES)) {
    assert.equal(LINES[line.key], line.spoken, `${line.key}: the server says exactly these words`);
    assert.ok(Object.hasOwn(MOOD_STYLES, LINE_MOODS[line.key]), `${line.key}: a real style`);
  }
  assert.equal(LINE_MOODS['check-high-1'], 'worried');
  assert.equal(LINE_MOODS['check-some-2'], 'careful');
  assert.equal(LINE_MOODS['check-low-1'], 'neutral');
  assert.equal(LINE_MOODS['check-agi'], 'happy');
  assert.equal(LINE_MOODS['check-copy'], 'pout');
  for (const style of ['careful', 'worried', 'pout']) assert.doesNotMatch(MOOD_STYLES[style], /excited|bubbly(?! )|shout/i);
});

// ---------- the scan ----------
test('words and numbers: tickers as shown, the same ticker, dollars, percents, times', () => {
  assert.equal(showTicker('E/ACC'), 'E/ACC');
  assert.equal(showTicker('$CBANK'), 'CBANK');
  assert.equal(showTicker('‎'), null, 'an invisible ticker is no ticker');
  assert.equal(showTicker('ABCDEFGHIJKLMNOPQRST'), 'ABCDEFGHIJKLMNO…');
  assert.equal(tickerKey('E/ACC'), tickerKey('eacc'));
  assert.equal(tickerKey('$agi'), 'AGI');
  assert.deepEqual([usd(36547.73), usd(1460165), usd(840.4), usd(0.4)], ['$36.5K', '$1.46M', '$840', '<$1']);
  assert.deepEqual([percent(4.4687), percent(24.27), percent(0.2554)], ['4.5%', '24%', '0.26%']);
  assert.deepEqual([timeText(5 * 60_000), timeText(3 * 3_600_000), timeText(10 * 86_400_000), timeText(20_000)], ['5 minutes', '3 hours', '10 days', '1 minute']);
});

test('a healthy graduated coin (like a real one): Lower risk, with its pool, its holders and the facts', () => {
  const s = analyze({
    detail: grad(), holders: holdersOf([[POOL_MANAGER, 14.84], [wallet(1), 4.47], [wallet(2), 3.52], [CREATOR, 3.39], ...spread(96, 0.9)]),
    trades: lively(100, 290), ethUsd: Number(ETH_USD), sameTicker: [listRow({ address: MEOW, symbol: 'MEOW', name: 'Meow', state: 3, progress: 100, marketCap: 49.29 })],
    dex: { liquidity: 36547.73, change: -16.56, volume: 28307.29 }, holderCount: 465, now: NOW,
  });
  assert.equal(s.level, 'low');
  assert.equal(s.address, MEOW);
  assert.equal(s.symbol, 'MEOW');
  assert.equal(s.graduated, true);
  assert.ok(has(s, 'stage', 'ok') && has(s, 'pool', 'ok') && has(s, 'spread', 'ok') && has(s, 'creator', 'ok'));
  assert.ok(s.flags.some((f) => f.text === '464 wallets hold it.'), 'the block explorer\'s count, minus its pool');
  assert.ok(s.flags.some((f) => f.text === 'Its pool holds $36.5K.'));
  assert.ok(s.flags.some((f) => f.text === '100+ trades in the last 24 hours.'));
  const facts = Object.fromEntries(s.facts.map((f) => [f.label, f.value]));
  assert.equal(facts['Market cap'], '$132.5K', '49.29 ETH at the ETH price');
  assert.equal(facts['In its pool'], '$36.5K');
  assert.equal(facts['Change (24 h)'], '-16.6%');
  assert.equal(facts.Holders, '464');
  assert.equal(facts['Biggest wallet'], '4.5%');
  assert.equal(facts['Creator holds'], '3.4%');
  assert.equal(facts.Contract, '0x4444…4444');
  assert.equal(s.links.clank, `https://clank.trade/coin/${MEOW}`);
  assert.equal(s.links.explorer, `https://robinhoodchain.blockscout.com/token/${MEOW}`);
  // nothing in it tells anyone to buy or sell, or calls it safe
  for (const f of [...s.flags.map((x) => x.text), ...s.facts.map((x) => `${x.label} ${x.value}`)]) assert.doesNotMatch(f, /\b(buy|sell|safe|safer|moon|pump)\b/i, f);
});

test('a new coin on its curve (like E/ACC, 2 hours old): Some risk, and the reasons', () => {
  const s = analyze({
    detail: detail({ createdAt: String(S - 2 * H), progress: 22.23 }),
    holders: holdersOf([[CURVE, 60.7], [wallet(1), 3.67], [wallet(2), 3.61], [wallet(3), 3.6], [wallet(4), 2.96], [wallet(5), 2.92], [POOL_MANAGER, 2.84],
      [wallet(6), 2.44], [CREATOR, 2.16], [wallet(7), 2.04], [wallet(8), 1.78], [wallet(9), 1.27], ...spread(24, 0.4)]),
    trades: lively(100, 60), ethUsd: Number(ETH_USD), sameTicker: [], now: NOW,
  });
  assert.equal(s.level, 'some');
  assert.ok(has(s, 'age', 'some') && s.flags.some((f) => f.text === 'New: launched 2 hours ago.'));
  assert.ok(s.flags.some((f) => f.id === 'stage' && f.sev === 'some' && /^Early: 22.23% of its bonding curve is filled \(about \$2\.6K in it\)\.$/.test(f.text)), 'its curve holds 0.95 ETH');
  assert.ok(s.flags.some((f) => f.text === '34 wallets hold it.' && f.sev === 'some'), 'its curve and the pool don\'t count as wallets');
  assert.ok(has(s, 'top10', 'some'));
  assert.equal(s.flags[0].sev, 'some', 'worst first');
  assert.equal(Object.fromEntries(s.facts.map((f) => [f.label, f.value]))['In its curve'], '$2.6K');
});

test('nobody bought it (most clank.trade coins): High risk, and just that', () => {
  const s = analyze({ detail: detail({ address: DEAD, progress: 0, reserve: '0', createdAt: String(S - 4 * D), marketCap: 1.55 }), holders: holdersOf([[CURVE, 100]]), trades: [], ethUsd: Number(ETH_USD), sameTicker: [], now: NOW });
  assert.equal(s.level, 'high');
  assert.deepEqual(s.flags.map((f) => f.id), ['stage', 'age'], 'no holder or trading flags on top');
  assert.equal(s.flags[0].text, 'Nobody has bought it yet: its bonding curve is at 0%.');
  assert.equal(Object.fromEntries(s.facts.map((f) => [f.label, f.value])).Holders, '0');
});

test('each red flag on its own', () => {
  const lv = (o) => scanOf(o).level;
  assert.equal(lv({}), 'low', 'the baseline coin has none');
  // brand new
  const young = scanOf({ detail: detail({ createdAt: String(S - 20 * 60) }) });
  assert.ok(young.flags.some((f) => f.sev === 'high' && f.text === 'Brand new: launched 20 minutes ago.'));
  // barely started / early
  assert.equal(lv({ detail: detail({ progress: 1.5 }) }), 'high');
  assert.equal(lv({ detail: detail({ progress: 12 }) }), 'some');
  // few holders
  assert.equal(lv({ holders: holdersOf([[CURVE, 90], ...spread(8, 1.2)]) }), 'high');
  assert.equal(lv({ holders: holdersOf([[CURVE, 80], ...spread(40, 0.5)]) }), 'some');
  // one big wallet, the 10 biggest
  assert.equal(lv({ holders: holdersOf([[CURVE, 40], [wallet(1), 12], ...spread(60, 0.5)]) }), 'high');
  assert.equal(lv({ holders: holdersOf([[CURVE, 40], [wallet(1), 6], ...spread(60, 0.5)]) }), 'some');
  assert.equal(lv({ holders: holdersOf([[CURVE, 10], ...spread(10, 4.5), ...spread(60, 0.2, 300)]) }), 'high', 'the 10 biggest: 45%');
  // its creator
  assert.equal(lv({ holders: holdersOf([[CURVE, 40], [CREATOR, 15], ...spread(60, 0.5)]) }), 'high');
  assert.equal(lv({ holders: holdersOf([[CURVE, 40], [CREATOR, 7], ...spread(60, 0.5)]) }), 'some');
  const dumped = scanOf({ trades: tradesOf([[CREATOR, 'sell', 60], ...Array.from({ length: 30 }, (_, i) => [wallet(600 + i), i % 2 ? 'buy' : 'sell', 120 + i * 60])]) });
  assert.ok(dumped.flags.some((f) => f.sev === 'high' && f.text === 'Its creator sold lately and now holds none.'));
  const trimmed = scanOf({ holders: holdersOf([[CURVE, 40], [CREATOR, 2], ...spread(60, 0.5)]), trades: tradesOf([[CREATOR, 'sell', 60], ...Array.from({ length: 30 }, (_, i) => [wallet(600 + i), i % 2 ? 'buy' : 'sell', 120 + i * 60])]) });
  assert.ok(trimmed.flags.some((f) => f.sev === 'some' && f.text === 'Its creator sold some lately (still holds 2%).'));
  // trading
  assert.equal(lv({ trades: tradesOf([[wallet(1), 'buy', 4 * D], [wallet(2), 'sell', 5 * D]]) }), 'high', 'no trade in 3 days');
  assert.equal(lv({ trades: tradesOf([[wallet(1), 'buy', 2 * D], [wallet(2), 'sell', 2 * D + 60]]) }), 'some');
  assert.equal(lv({ trades: tradesOf(Array.from({ length: 20 }, (_, i) => [wallet(700 + i), i < 17 ? 'sell' : 'buy', i * 60])) }), 'some', 'mostly selling');
  const wash = scanOf({ trades: tradesOf(Array.from({ length: 40 }, (_, i) => [wallet(800 + (i % 2)), i % 2 ? 'sell' : 'buy', i * 60])) });
  assert.ok(wash.flags.some((f) => f.id === 'traders' && f.text === 'Only 2 wallets made its last 40 trades.'));
  assert.equal(lv({ trades: [] }), 'high', 'bought once, never traded since: no trades yet');
});

test('graduated coins: a thin pool, a big drop, or a pool that can\'t be read', () => {
  const g = (dex) => analyze({ detail: grad(), holders: holdersOf([[POOL_MANAGER, 15], ...spread(90, 0.9)]), trades: lively(), ethUsd: Number(ETH_USD), sameTicker: [], dex, holderCount: 300, now: NOW });
  assert.equal(g({ liquidity: 3000, change: 1, volume: 10 }).level, 'high');
  assert.ok(g({ liquidity: 3000, change: 1, volume: 10 }).flags.some((f) => f.text === 'Its pool holds only $3K: small trades move the price a lot.'));
  assert.equal(g({ liquidity: 12000, change: 1, volume: 10 }).level, 'some');
  assert.equal(g({ liquidity: 50000, change: -65, volume: 10 }).level, 'high');
  assert.ok(g({ liquidity: 50000, change: -35, volume: 10 }).flags.some((f) => f.sev === 'some' && f.text === 'Down 35% in 24 hours.'));
  for (const dex of [{ failed: true }, { missing: true }, null]) {
    const s = g(dex);
    assert.equal(s.level, 'some', 'not read: never "Lower risk" without its pool');
    assert.ok(s.flags.some((f) => f.text === "Couldn't read its DEX pool right now."));
  }
  const full = analyze({ detail: grad(), holders: holdersOf([[POOL_MANAGER, 15], ...spread(99, 0.8)]), trades: lively(), ethUsd: Number(ETH_USD), sameTicker: [], dex: { liquidity: 50000, change: 1, volume: 1 }, holderCount: null, now: NOW });
  assert.ok(full.flags.some((f) => f.text === 'More than 100 wallets hold it.'), 'the explorer didn\'t answer: 100+ (clank.trade lists 100)');
  assert.equal(Object.fromEntries(full.facts.map((f) => [f.label, f.value])).Holders, '100+');
});

test('copycat tickers: $AGI\'s copies, a smaller coin with a graduated one\'s ticker, look-alikes, the real one', () => {
  const agiRow = listRow({ address: OFFICIAL, symbol: 'AGI', name: 'Artificial Girlfriend Intelligence', state: 3, progress: 100, marketCap: 543 });
  const copyRow = listRow({ address: DEAD, symbol: 'AGI', name: 'Artificial Girlfriend Intelligence', progress: 6.97, marketCap: 2.1 });
  // a copy of the site's own coin (even one older than it): always a big red flag, and her "that's not me"
  const copy = scanOf({ detail: detail({ address: DEAD, symbol: 'AGI', name: 'Artificial Girlfriend Intelligence' }), sameTicker: [agiRow, copyRow] });
  assert.equal(copy.level, 'high');
  assert.equal(copy.copyOfficial, true);
  assert.equal(copy.flags[0].text, 'Not the official $AGI: it only uses the same ticker. The official contract ends in 06ec (see the Model card).');
  assert.equal(checkLine(copy).key, 'check-copy');
  // the real one: its own flag, and a note that others copy it
  const real = analyze({ detail: grad({ address: OFFICIAL, symbol: 'AGI', name: 'Artificial Girlfriend Intelligence', marketCap: 543 }), holders: holdersOf([[POOL_MANAGER, 8], ...spread(99, 0.8)]),
    trades: lively(), ethUsd: Number(ETH_USD), sameTicker: [agiRow, copyRow], dex: { liquidity: 150000, change: 12, volume: 29000 }, holderCount: 900, now: NOW });
  assert.equal(real.official, true);
  assert.equal(real.level, 'low');
  assert.ok(has(real, 'official', 'ok'));
  assert.ok(real.flags.some((f) => f.id === 'ticker' && f.sev === 'info' && f.text === '1 other clank.trade coin uses the same ticker: make sure you have this contract.'));
  assert.equal(checkLine(real).key, 'check-agi');
  // a smaller coin with a graduated coin's ticker
  const meow = listRow({ address: MEOW, symbol: 'MEOW', name: 'Meow', state: 3, progress: 100, marketCap: 49 });
  const small = scanOf({ detail: detail({ symbol: 'MEOW', name: 'Meow Mascot' }), sameTicker: [meow] });
  assert.equal(small.level, 'high');
  assert.ok(small.flags.some((f) => f.text === 'Copycat ticker: the biggest $MEOW on clank.trade is another coin (0x4444…4444), which has graduated.'));
  // look-alikes of about the same size: a smaller flag
  const twin = scanOf({ detail: detail({ symbol: 'E/ACC' }), sameTicker: [listRow({ address: DEAD, symbol: 'EACC', name: 'x', progress: 25, marketCap: 3.5 })] });
  assert.ok(twin.flags.some((f) => f.id === 'ticker' && f.sev === 'some' && f.text === '1 other clank.trade coin uses the ticker $E/ACC too: check the contract address.'));
  // clank.trade's search didn't answer: no "Lower risk" without that check
  const blind = scanOf({ sameTicker: null });
  assert.equal(blind.level, 'some');
  assert.ok(blind.flags.some((f) => f.text === "Couldn't check for coins with the same ticker right now."));
});

test('every coin is shown (the owner, round 2): crude names as they are, marked adult (their picture waits for 18+), slurs masked', () => {
  const s = scanOf({ detail: detail({ symbol: 'CUM', name: 'Clank Uwu Model' }), sameTicker: [listRow({ address: DEAD, symbol: 'CUM', name: 'x', progress: 90, marketCap: 9 })] });
  assert.equal(s.symbol, 'CUM');
  assert.equal(s.name, 'Clank Uwu Model');
  assert.equal(s.adult, true);
  assert.equal('hidden' in s, false);
  assert.ok(s.flags.some((f) => /\$CUM/.test(f.text)), 'its ticker in the flags too');
  assert.equal(scanOf({}).adult, false);
  assert.equal(scanOf({}).image, true, 'it has a picture (a real content id)');
  assert.equal(scanOf({ detail: detail({ image: 'ipfs://x' }) }).image, false);
  assert.equal(scanOf({}).createdAt, (S - 5 * D) * 1000);
  // hate slurs never show, whatever a coin is called
  const slur = scanOf({ detail: detail({ symbol: 'NIGGA', name: 'retarded nazi coin' }) });
  assert.equal(slur.symbol, 'N****');
  assert.equal(slur.name, 'r******* n*** coin');
  assert.equal(slur.adult, true);
  assert.doesNotMatch(JSON.stringify(slur), /nigg|retard|nazi/i);
  assert.equal(maskSlurs('Nazi Frog'), 'N*** Frog');
  assert.equal(maskSlurs('RAPE'), 'R***');
  assert.equal(maskSlurs('Grape Juice'), 'Grape Juice', 'words that only contain one are left alone');
  assert.equal(maskSlurs('FAGGOT'), 'F*****');
  assert.equal(maskSlurs(null), null);
  // content ids: "ipfs://<id>" or a gateway address, only real ones
  assert.equal(cidOf(`ipfs://${CID1}`), CID1);
  assert.equal(cidOf(`https://yellow-total-guanaco-389.mypinata.cloud/ipfs/${CID2}?img-width=128`), CID2);
  assert.equal(cidOf('ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'), 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG');
  for (const bad of ['ipfs://x', 'ipfs://../../etc', `http://evil.test/ipfs/${CID1}`, `ipfs://${CID1}/../x`.replace(CID1, 'b..'), '', null, 42]) assert.equal(cidOf(bad), null, String(bad));
});

test('checkCoin: one request to clank.trade for the coin, then its ticker, its pool and its holders, at the same time', async () => {
  fake.coins[MEOW] = { detail: grad(), holders: holdersOf([[POOL_MANAGER, 14.84], ...spread(99, 0.8)]), trades: lively(120, 290) };
  fake.search.MEOW = [listRow({ address: MEOW, symbol: 'MEOW', name: 'Meow', state: 3, progress: 100, marketCap: 49 })];
  fake.dex[MEOW] = [pair(MEOW, 36547.73)];
  fake.explorer[MEOW] = 465;
  const s = await checkCoin(MEOW, { now: NOW });
  assert.equal(s.level, 'low');
  const first = new URL(calls[0]);
  assert.equal(first.pathname, '/v1/trpc/coins.detail,coins.holders,coins.trades,exchangeRates.tokenUsdg,exchangeRates.tokenUsdg');
  assert.deepEqual(JSON.parse(first.searchParams.get('input')), { 0: { address: MEOW }, 1: { address: MEOW }, 2: { address: MEOW, limit: 100 },
    3: { token: '0x0000000000000000000000000000000000000000' }, 4: { token: SPCX } }, 'the prices of both pairs (ETH, SPCX) come with it');
  assert.equal(first.searchParams.get('batch'), '1');
  assert.equal(calls.length, 4, 'then its ticker (clank.trade\'s search), DexScreener and the block explorer');
  assert.ok(calls.some((u) => u.startsWith('https://clank.trade/v1/trpc/coins.list?') && JSON.parse(new URL(u).searchParams.get('input'))[0].query === 'MEOW'));
  assert.ok(calls.includes(`https://api.dexscreener.com/tokens/v1/robinhood/${MEOW}`));
  assert.ok(calls.includes(`https://robinhoodchain.blockscout.com/api/v2/tokens/${MEOW}`));
  for (const u of calls) assert.match(u, /^https:\/\/(clank\.trade\/v1\/trpc\/|api\.dexscreener\.com\/tokens\/v1\/robinhood\/|robinhoodchain\.blockscout\.com\/api\/v2\/tokens\/)/, 'only these three');
  // our server names itself (the site's address), so clank.trade can see who's asking (since 2026-09-28 "ClankChecker": the
  // Arena, whose name it had, left the site)
  const clankAsks = calls.map((u, i) => [u, inits[i]]).filter(([u]) => u.startsWith('https://clank.trade/'));
  assert.ok(clankAsks.length && clankAsks.every(([, init]) => /\(compatible; ClankChecker\/1\.0; \+https:\/\/agi1\.app\)$/.test(init.headers?.['User-Agent'])), 'the bot name names agi1.app');
  // a coin on its curve with fewer than 100 holders: no DexScreener, no block explorer
  calls = [];
  fake.coins[COIN] = { detail: detail(), holders: holdersOf([[CURVE, 60], ...spread(40, 0.9)]), trades: lively() };
  await checkCoin(COIN, { now: NOW });
  assert.equal(calls.length, 2);
});

test('checkCoin fails closed: not a clank.trade coin, clank.trade down or walled, half an answer', async () => {
  assert.deepEqual(await checkCoin(DEAD), { error: 'not_clank' });
  fake.coins[COIN] = { detail: detail(), holders: holdersOf([[CURVE, 60], ...spread(40, 0.9)]), trades: lively(), holdersError: true };
  assert.deepEqual(await checkCoin(COIN), { error: 'unverified' }, 'no holders: no scan');
  fake.coins[COIN].holdersError = false;
  fake.wall = true;
  assert.deepEqual(await checkCoin(COIN), { error: 'unverified' }, 'a "checking your browser" page');
  fake.wall = false; fake.down = true;
  assert.deepEqual(await checkCoin(COIN), { error: 'unverified' });
  fake.down = false; fake.search = 'down';
  const s = await checkCoin(COIN, { now: NOW });
  assert.ok(s.flags.some((f) => f.text === "Couldn't check for coins with the same ticker right now."), 'the search failing is a flag, not a crash');
});

// ---------- the Clank protocol (2026-09-29, developer.clank.trade) ----------
test('a coin\'s stage, as the protocol has it: graduating (1, 2), graduated (3), rescued (4), and anything odd', () => {
  const holders = holdersOf([[CURVE, 60], ...spread(60, 0.5)]);
  for (const state of [1, 2]) {
    const s = scanOf({ detail: detail({ state, progress: 100, reserve: '0' }), holders });
    assert.equal(s.graduated, false);
    assert.ok(has(s, 'stage', 'some'));
    assert.equal(s.flags.find((f) => f.id === 'stage').text, "Graduating: its bonding curve sold out and its DEX pool isn't open yet. Graduations can fail: check clank.trade.");
    assert.equal(s.facts.find((f) => f.label === 'Stage').value, 'Graduating');
    assert.ok(!has(s, 'pool'), 'no pool to read yet');
    assert.notEqual(s.level, 'low');
  }
  const rescued = scanOf({ detail: detail({ state: 4, progress: 100, reserve: '0' }), holders });
  assert.ok(has(rescued, 'stage', 'high'));
  assert.equal(rescued.level, 'high');
  assert.equal(rescued.facts.find((f) => f.label === 'Stage').value, 'Rescued');
  const odd = scanOf({ detail: detail({ state: 9 }), holders });
  assert.ok(has(odd, 'stage', 'some'));
  assert.match(odd.flags.find((f) => f.id === 'stage').text, /unusual stage/);
  // graduated: as before, and never "graduating"
  const g = scanOf({ detail: grad(), holders: holdersOf([[POOL_MANAGER, 14.84], ...spread(99, 0.8)]), trades: lively(120, 290), dex: { liquidity: 36547, change: -3, volume: 9000 }, holderCount: 465 });
  assert.equal(g.graduated, true);
  assert.ok(has(g, 'stage', 'ok'));
  assert.ok(!has(g, 'locked'), 'no "locked" note without the protocol\'s own word');
});

test('the protocol confirms a graduated coin: its liquidity locked for good (a fair note, never "safe"); a curve clank.trade and the protocol disagree on', () => {
  const holders = holdersOf([[POOL_MANAGER, 14.84], ...spread(99, 0.8)]);
  const base = { detail: grad({ curve: CURVE }), holders, trades: lively(120, 290), dex: { liquidity: 36547, change: -3, volume: 9000 }, holderCount: 465 };
  const s = scanOf({ ...base, chain: { exists: true, state: 3, curve: CURVE } });
  assert.ok(has(s, 'locked', 'ok'));
  assert.equal(s.flags.find((f) => f.id === 'locked').text, LOCKED_TEXT);
  assert.doesNotMatch(LOCKED_TEXT, /\bsafe\b|\bbuy\b|\bsell\b/i);
  assert.equal(s.level, 'low', 'a good-to-know, not a flag');
  assert.deepEqual(s.onchain, { exists: true, state: 3, curve: CURVE });
  assert.ok(!has(scanOf({ ...base, chain: { exists: true, state: 0, curve: CURVE } }), 'locked'), 'only when the protocol says it graduated');
  assert.ok(!has(scanOf({ ...base, chain: { exists: false } }), 'locked'));
  assert.deepEqual(scanOf({ ...base, chain: { exists: false } }).onchain, { exists: false });
  assert.equal(scanOf(base).onchain, null, 'the chain didn\'t answer');
  const other = scanOf({ ...base, chain: { exists: true, state: 3, curve: DEAD } });
  assert.ok(has(other, 'record', 'some'));
  assert.notEqual(other.level, 'low');
  // only the liquidity the protocol put in at graduation is locked (anyone else's in the same pool isn't), and a price can fall
  assert.match(LOCKED_TEXT, /^The liquidity the Clank protocol put in its pool at graduation is locked for good: .* Its price can still fall\.$/);
  // the protocol says its graduation was rescued, clank.trade doesn't show it yet: the worse of the two counts
  const sold = { ...base, detail: detail({ state: 1, progress: 100, reserve: '0' }), holders: holdersOf([[CURVE, 60], ...spread(60, 0.5)]) };
  const rescued = scanOf({ ...sold, chain: { exists: true, state: 4, curve: CURVE } });
  assert.ok(has(rescued, 'stage', 'high'));
  assert.equal(rescued.facts.find((f) => f.label === 'Stage').value, 'Rescued');
  assert.equal(rescued.flags.find((f) => f.id === 'record').text, "clank.trade doesn't show it yet, but the Clank protocol says its graduation was rescued.");
  assert.equal(rescued.level, 'high');
  // other stage differences are left alone (clank.trade can be a few seconds behind the chain)
  const behind = scanOf({ ...sold, chain: { exists: true, state: 3, curve: CURVE } });
  assert.ok(!has(behind, 'record'));
  assert.equal(behind.facts.find((f) => f.label === 'Stage').value, 'Graduating');
});

test('readCoinOnChain: the documented calls in two batches, decoded; the node down or odd answers → null', async () => {
  onChain(COIN, { state: 0, creator: 3n * 10n ** 25n });
  const c = await readCoinOnChain(COIN);
  assert.equal(rpcCalls.length, 2, 'two requests');
  assert.equal(rpcCalls[0].length, 5, 'its record, name, ticker, supply and logo');
  assert.equal(rpcCalls[1].length, 4, 'its curve\'s stage and ETH, what its creator and its curve hold');
  assert.ok(rpcCalls.flat().every((q) => q.method === 'eth_call' && q.params[1] === 'latest'), 'eth_call only: nothing is ever sent or signed');
  assert.equal(rpcCalls[0][0].params[0].to, FACTORY);
  assert.deepEqual({ ...c, logo: undefined }, {
    exists: true, curve: CURVE, deployer: CREATOR, pairToken: ZERO, state: 0, threshold: '4276363636363636363', reserve: '950957059954408513',
    supply: '1000000000000000000000000000', creatorBalance: '30000000000000000000000000', curveBalance: '600000000000000000000000000',
    name: 'Egirl Acceleration', symbol: 'E/ACC', logo: undefined, poolFee: 3000, sweptAt: 0,
  });
  assert.equal(shareOf(c.creatorBalance, c.supply), 3);
  assert.deepEqual(await readCoinOnChain(DEAD), { exists: false }, 'not a coin the factory made');
  fake.chain = null;
  assert.equal(await readCoinOnChain(COIN), null, 'the node doesn\'t answer');
  fake.chain = 'no-batch';
  assert.equal(await readCoinOnChain(COIN), null, 'a node that refuses batches');
  assert.equal(await readCoinOnChain('0x12'), null);
  const before = rpcCalls.length;
  assert.equal(await readCoinOnChain('not an address'), null);
  assert.equal(rpcCalls.length, before, 'nothing asked for a bad address');
  // a node that sends the ids back as strings is read all the same
  onChain(COIN, { state: 0, creator: 3n * 10n ** 25n });
  fake.chainStringIds = true;
  assert.equal((await readCoinOnChain(COIN)).creatorBalance, '30000000000000000000000000');
  // one call failing on its own inside a batch: that one value is unknown (null), never 0
  fake.chainStringIds = false;
  fake.chainFail = new Set(['balanceOf', 'realQuoteReserve']);
  const part = await readCoinOnChain(COIN);
  assert.equal(part.exists, true);
  assert.equal(part.creatorBalance, null);
  assert.equal(part.curveBalance, null);
  assert.equal(part.reserve, null);
  assert.equal(part.state, 0, 'the rest still answered');
});

test('the chain\'s smaller scan never reads what it couldn\'t read as 0: its creator, its curve, a forwarder, the explorer\'s contracts', () => {
  const chain = { exists: true, curve: CURVE, deployer: CREATOR, state: 0, threshold: '4276363636363636363', reserve: '950957059954408513',
    supply: String(10n ** 27n), creatorBalance: String(3n * 10n ** 26n), curveBalance: String(6n * 10n ** 26n), name: 'x', symbol: 'X', logo: null };
  const full = analyzeChain(chain, { address: COIN, now: NOW });
  assert.equal(full.flags.find((f) => f.id === 'creator').text, 'Its creator still holds 30%.');
  assert.equal(full.level, 'high');
  // its creator's balance (or the supply) didn't come back: unknown, a "some" flag, never "holds none" (was: 0%, and Some risk)
  for (const gap of [{ creatorBalance: null }, { supply: null }, { supply: '0' }]) {
    const s = analyzeChain({ ...chain, ...gap }, { address: COIN, now: NOW });
    assert.equal(s.flags.find((f) => f.id === 'creator').text, "Couldn't read what its creator holds right now.");
    assert.ok(has(s, 'creator', 'some'));
    assert.equal(s.facts.find((f) => f.label === 'Creator holds').value, '—');
  }
  // launched through the protocol's forwarder (or no creator at all): who made it isn't known from the chain
  for (const deployer of ['0xac20d0d5cc0f89ee4f6d5f8e6870a36eaf2e0dd7', FACTORY, ZERO, 'nope']) {
    const s = analyzeChain({ ...chain, deployer, creatorBalance: '0' }, { address: COIN, now: NOW });
    assert.equal(s.flags.find((f) => f.id === 'creator').text, "Couldn't tell from the chain who created it, so what its creator holds is unknown.");
    assert.equal(s.facts.find((f) => f.label === 'Creator holds').value, '—');
  }
  // how full its curve is didn't come back: said so (never "barely started: 0%")
  const noReserve = analyzeChain({ ...chain, reserve: null }, { address: COIN, now: NOW });
  assert.equal(noReserve.flags.find((f) => f.id === 'stage').text, "Couldn't read how full its bonding curve is right now.");
  assert.equal(noReserve.facts.find((f) => f.label === 'Stage').value, 'On its curve');
  assert.equal(noReserve.facts.find((f) => f.label === 'In its curve').value, '—');
  // an empty curve: "nobody bought it" only when every coin is still in it; otherwise 0% filled (true either way)
  const empty = { ...chain, reserve: '0', creatorBalance: '0' };
  assert.match(analyzeChain({ ...empty, curveBalance: String(10n ** 27n) }, { address: COIN }).flags.find((f) => f.id === 'stage').text, /^Nobody has bought it yet/);
  assert.match(analyzeChain(empty, { address: COIN }).flags.find((f) => f.id === 'stage').text, /^Barely started: only 0% of its bonding curve is filled/);
  assert.match(analyzeChain({ ...empty, curveBalance: null }, { address: COIN }).flags.find((f) => f.id === 'stage').text, /^Barely started/);
  // the explorer counts contracts too: its curve comes off (and a graduated coin's PoolManager and hook)
  const ten = analyzeChain(chain, { address: COIN, holderCount: 10, now: NOW });
  assert.equal(ten.flags.find((f) => f.id === 'holders').text, "About 9 wallets hold it (the block explorer's count, without its curve).");
  assert.ok(has(ten, 'holders', 'high'), '9 wallets and its curve: under 10 wallets');
  assert.equal(ten.facts.find((f) => f.label === 'Holders').value, 'about 9');
  const pool = analyzeChain({ ...chain, state: 3, curveBalance: '0' }, { address: COIN, holderCount: 52, now: NOW });
  assert.equal(pool.flags.find((f) => f.id === 'holders').text, "About 50 wallets hold it (the block explorer's count, without its curve and pool).");
  assert.ok(has(pool, 'holders', 'ok'));
  assert.equal(analyzeChain({ ...chain, curveBalance: '0' }, { address: COIN, holderCount: 1 }).flags.find((f) => f.id === 'holders').text,
    "About 1 wallet holds it (the block explorer's count, without its curve).");
  // what it was read from
  assert.equal(ten.facts.find((f) => f.label === 'Read from').value, 'Robinhood Chain, the block explorer');
  assert.equal(pool.facts.find((f) => f.label === 'Read from').value, 'Robinhood Chain, the block explorer', 'no pool read: no DexScreener');
  assert.equal(analyzeChain({ ...chain, state: 3 }, { address: COIN, dex: { liquidity: 30_000, change: 1 } }).facts.find((f) => f.label === 'Read from').value,
    'Robinhood Chain, DexScreener');
  // a coin clank.trade hasn't listed: brand new (or one it doesn't show), so High risk, like the age rule
  const fresh = analyzeChain({ ...chain, creatorBalance: '0' }, { address: COIN, why: 'unlisted', now: NOW });
  assert.equal(fresh.flags.find((f) => f.id === 'listed').text, "Not listed on clank.trade (yet): it's brand new, or a coin clank.trade doesn't show.");
  assert.equal(fresh.level, 'high');
  assert.ok(!has(analyzeChain(chain, { address: COIN, why: 'down' }), 'listed'));
});

test('a slow chain: a full scan waits for it at most 4 s, but when clank.trade fails its whole answer is used', { timeout: 20_000 }, async () => {
  onChain(COIN, { state: 0, creator: 12n * 10n ** 25n });
  fake.chainDelay = 2200;                                   // two batches: about 4.4 s, over the full scan's 4 s
  fake.coins[COIN] = { detail: detail(), holders: holdersOf([[CURVE, 60], ...spread(60, 0.5)]), trades: lively() };
  fake.search['E/ACC'] = [];
  let t = Date.now();
  const s = await checkCoin(COIN, { now: NOW });
  assert.equal(s.source, undefined, 'clank.trade answered: the full scan');
  assert.equal(s.onchain, null, 'without the chain\'s word');
  assert.ok(Date.now() - t < 4_300, `not held up past 4 s (${Date.now() - t} ms)`);
  await new Promise((resolve) => setTimeout(resolve, 1_000));  // (the slow read finishing in the background)
  fake.down = true;
  t = Date.now();
  const c = await checkCoin(COIN, { now: NOW });
  assert.equal(c.source, 'chain', 'the chain answered in 4.4 s: used');
  assert.ok(has(c, 'creator', 'high'));
  assert.ok(Date.now() - t >= 4_000);
});

test('checkCoin asks the chain alongside clank.trade: a graduated coin gets the protocol\'s word', async () => {
  fake.coins[MEOW] = { detail: grad({ curve: CURVE }), holders: holdersOf([[POOL_MANAGER, 14.84], ...spread(99, 0.8)]), trades: lively(120, 290) };
  fake.search.MEOW = [];
  fake.dex[MEOW] = [pair(MEOW, 36547.73)];
  fake.explorer[MEOW] = 465;
  onChain(MEOW, { state: 3, reserve: 0n, symbol: 'MEOW', name: 'Meow' });
  const s = await checkCoin(MEOW, { now: NOW });
  assert.equal(s.source, undefined, 'clank.trade answered: the full scan');
  assert.deepEqual(s.onchain, { exists: true, state: 3, curve: CURVE });
  assert.ok(has(s, 'locked', 'ok'));
  assert.equal(new URL(calls[0]).pathname, '/v1/trpc/coins.detail,coins.holders,coins.trades,exchangeRates.tokenUsdg,exchangeRates.tokenUsdg', 'clank.trade still first');
});

test('clank.trade doesn\'t answer, or hasn\'t listed a coin yet: a smaller scan straight from the chain, never "Lower risk"', async () => {
  onChain(COIN, { state: 0, reserve: 950957059954408513n, creator: 12n * 10n ** 25n });
  fake.down = true;
  fake.explorer[COIN] = 37;
  const s = await checkCoin(COIN, { now: NOW });
  assert.equal(s.source, 'chain');
  assert.equal(s.flags[0].sev, 'high', 'worst first');
  const source = s.flags.find((f) => f.id === 'source');
  assert.equal(source.sev, 'some');
  assert.match(source.text, /^clank\.trade couldn't be read just now, so this comes straight from Robinhood Chain: how spread out its holders are, its trades, its age and look-alike tickers couldn't be checked\.$/);
  assert.ok(has(s, 'creator', 'high'), 'its creator holds 12%');
  assert.ok(has(s, 'holders', 'some'), 'the block explorer\'s count');
  assert.equal(s.progress, 22.23);
  assert.match(s.flags.find((f) => f.id === 'stage').text, /22\.23% of its bonding curve is filled \(about 0\.951 ETH in it\)|Early: 22\.23%/);
  assert.equal(s.facts.find((f) => f.label === 'Read from').value, 'Robinhood Chain, the block explorer');
  assert.equal(s.facts.find((f) => f.label === 'In its curve').value, '0.951 ETH');
  assert.equal(s.symbol, 'E/ACC');
  assert.equal(s.image, true);
  assert.equal(s.level, 'high');
  assert.equal(await coinPictureId(COIN), 'bafkreiborp2klxbx4jemgyyuu4dmcjtd2kztj7psvrhjzesu76wjy2qgce', 'its picture, from its own contract, while clank.trade is down');
  // never lower risk, even with nothing else to say
  onChain(COIN, { state: 3, reserve: 0n, creator: 0n });
  fake.dex[COIN] = [pair(COIN, 90_000, 2)];
  fake.explorer[COIN] = 900;
  const calm = await checkCoin(COIN, { now: NOW });
  assert.equal(calm.level, 'some');
  assert.ok(has(calm, 'locked', 'ok'));
  assert.ok(has(calm, 'pool', 'ok'));
  // clank.trade answers "not found": the chain may still know it (a coin too new to be listed)
  fake.down = false;
  onChain(DEAD, { state: 0, reserve: 0n, symbol: 'NEW', name: 'Brand new' });
  const fresh = await checkCoin(DEAD, { now: NOW });
  assert.equal(fresh.source, 'chain');
  assert.match(fresh.flags.find((f) => f.id === 'source').text, /^clank\.trade hasn't listed it yet/);
  assert.ok(has(fresh, 'listed', 'high'), 'brand new (or one clank.trade doesn\'t show)');
  assert.ok(has(fresh, 'stage', 'high'), 'its curve is empty: 0% filled');
  // neither knows it, or the chain is down too: as before
  fake.chain = null;
  assert.deepEqual(await checkCoin(DEAD), { error: 'not_clank' });
  fake.down = true;
  assert.deepEqual(await checkCoin(COIN), { error: 'unverified' });
  // a copy of $AGI found on the chain alone is still called out
  fake.down = true;
  onChain(COIN, { symbol: 'AGI', name: 'Artificial Girlfriend Intelligence' });
  const copy = await checkCoin(COIN, { now: NOW });
  assert.ok(has(copy, 'copycat', 'high'));
  assert.equal(copy.copyOfficial, true);
});

test('?a=: a scan from the chain alone is shared a minute (so the full scan is back soon), and the page never needs to change', async () => {
  onChain(COIN, { state: 0, creator: 0n });
  fake.down = true;
  const r = await get(`?a=${COIN}`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'public, max-age=30, s-maxage=60, stale-while-revalidate=60');
  const body = await r.json();
  assert.equal(body.source, 'chain');
  assert.ok(Array.isArray(body.flags) && Array.isArray(body.facts) && LEVELS[body.level], 'the same shape the page shows');
  assert.ok(checkLine(body).text, 'she has a line for it');
});

test('analyzeChain: what the chain alone can say', () => {
  const chain = { exists: true, curve: CURVE, deployer: CREATOR, state: 0, threshold: '4276363636363636363', reserve: '0', supply: String(10n ** 27n),
    creatorBalance: '0', curveBalance: String(10n ** 27n), name: 'x', symbol: 'X', logo: null };
  const s = analyzeChain(chain, { address: COIN, now: NOW });
  assert.equal(s.progress, 0);
  assert.ok(has(s, 'stage', 'high'), 'nobody bought it yet');
  assert.ok(has(s, 'creator', 'info'));
  assert.equal(s.image, false);
  assert.equal(s.createdAt, 0);
  assert.equal(analyzeChain({ ...chain, state: STAGE.RESCUED }, { address: COIN }).level, 'high');
  assert.equal(analyzeChain({ ...chain, state: STAGE.READY, reserve: '0' }, { address: COIN }).facts.find((f) => f.label === 'Stage').value, 'Graduating');
  // its curve didn't answer: the stage is unknown, said as such (never "an unusual stage on clank.trade")
  const unknown = analyzeChain({ ...chain, state: null, reserve: null }, { address: COIN, now: NOW });
  assert.equal(unknown.flags.find((f) => f.id === 'stage').text, "Couldn't read its stage from the chain right now.");
  assert.ok(has(unknown, 'stage', 'some'));
  assert.equal(unknown.facts.find((f) => f.label === 'Stage').value, '—');
  assert.equal(unknown.facts.find((f) => f.label === 'In its curve').value, '—');
  assert.notEqual(unknown.level, 'low');
});

// ---------- the list ----------
test('the list: every page, trending ranks, dollars, copycats marked, every coin (crude names too, marked adult)', async () => {
  fake.pages = [
    [listRow({ address: COIN, symbol: 'E/ACC', name: 'Egirl Acceleration', progress: 22.23, marketCap: 3.79, createdAt: S - 2 * H }),
      listRow({ address: DEAD, symbol: 'AGI', name: 'Artificial Girlfriend Intelligence', progress: 0, createdAt: S - 3 * D })],
    [listRow({ address: OFFICIAL, symbol: 'AGI', name: 'Artificial Girlfriend Intelligence', state: 3, progress: 100, marketCap: 543, createdAt: S - 10 * D, image: `ipfs://${CID1}` }),
      listRow({ address: wallet(9), symbol: 'CUM', name: 'Clank Uwu Model', state: 3, progress: 100, marketCap: 31 })],
    [listRow({ address: MEOW, symbol: 'MEOW', name: 'Meow', state: 3, progress: 100, marketCap: 49.29 }),
      listRow({ address: wallet(10), symbol: 'MEOW', name: 'Meow Mascot', progress: 0.02, marketCap: 1.55 }),
      // $CABO is still on clank.trade, but this site never shows it (2026-09-28): it leaves the list and the counts
      listRow({ address: CABO, symbol: 'CABO', name: 'Cabo', state: 3, progress: 100, marketCap: 60 })],
  ];
  fake.trending = [OFFICIAL, COIN];
  const r = await get();
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  const list = await r.json();
  assert.equal(calls.length, 3, 'three pages (the first one with the trending list and the ETH price)');
  assert.match(calls[0], /\/v1\/trpc\/coins\.list,coins\.trending,exchangeRates\.tokenUsdg,exchangeRates\.tokenUsdg\?batch=1/);
  assert.deepEqual(JSON.parse(new URL(calls[1]).searchParams.get('input')), { 0: { cursor: 'p1' } });
  assert.equal(list.total, 6, '7 on clank.trade, without $CABO');
  assert.equal('hidden' in list, false);
  assert.equal(list.graduated, 3);
  assert.equal(list.complete, true);
  assert.equal(list.coins.length, 6);
  assert.ok(!JSON.stringify(list).includes('CABO') && !JSON.stringify(list).includes(CABO), 'nothing about $CABO in the list');
  const by = Object.fromEntries(list.coins.map((c) => [c.address, c]));
  assert.equal(by[wallet(9)].symbol, 'CUM', 'every coin clank.trade has (the owner: "they are part of clank trade")');
  assert.equal(by[wallet(9)].adult, true, '…its picture waits for the 18+ check');
  assert.equal(by[OFFICIAL].adult, false);
  assert.equal(by[OFFICIAL].image, true);
  assert.equal(by[COIN].image, false, 'no real picture id');
  assert.equal(by[OFFICIAL].official, true);
  assert.equal(by[OFFICIAL].trending, 1);
  assert.equal(by[COIN].trending, 2);
  assert.equal(by[OFFICIAL].marketCap, Math.round(543 * Number(ETH_USD)));
  assert.equal(by[DEAD].copyOfficial, true);
  assert.equal(by[DEAD].copyOf, OFFICIAL);
  assert.equal(by[wallet(10)].copyOf, MEOW);
  assert.equal(by[MEOW].copyOf, null);
  assert.equal(by[MEOW].sameTicker, 1);
  assert.equal(by[COIN].createdAt, (S - 2 * H) * 1000);
  assert.deepEqual(Object.keys(by[COIN]).sort(), ['address', 'adult', 'copyOf', 'copyOfficial', 'createdAt', 'graduated', 'image', 'marketCap', 'name', 'official', 'progress', 'sameTicker', 'symbol', 'trending']);
  // the next visitor (within 2 minutes) gets this server copy's list without asking clank.trade again
  calls = [];
  assert.equal((await get()).status, 200);
  assert.equal(calls.length, 0);
});

test('$CABO (2026-09-28): no scan, no picture and no place in the newest coins on this site', async () => {
  fake.coins[CABO] = { detail: detail({ address: CABO, symbol: 'CABO', name: 'Cabo', image: `ipfs://${CID1}` }), holders: [], trades: [] };
  fake.pictures[CID1] = { type: 'image/png', bytes: PNG };
  const scan = await get(`?a=${CABO}`);
  assert.equal(scan.status, 200);
  assert.deepEqual(await scan.json(), { address: CABO, error: 'removed' });
  assert.equal((await get(`?logo=${CABO}&s=96`)).status, 404);
  assert.equal(calls.length, 0, 'clank.trade is never asked about it');
  // a copycat with the same ticker at another address: its scan is refused too
  fake.coins[MEOW] = { detail: detail({ address: MEOW, symbol: 'CABO', name: 'Cabo Again' }), holders: [], trades: [] };
  assert.deepEqual(await (await get(`?a=${MEOW}`)).json(), { address: MEOW, error: 'removed' });
  fake.pages = [[listRow({ address: CABO, symbol: 'CABO', name: 'Cabo' }), listRow({ address: COIN, symbol: 'E/ACC', name: 'x' })]];
  fake.trending = [CABO, COIN];
  const latest = await (await get('?latest')).json();
  assert.deepEqual(latest.coins.map((c) => c.symbol), ['E/ACC']);
  assert.deepEqual(latest.trending.map((c) => c.address), [COIN], "clank.trade's trending list without it");
});

test('the list: at most MAX_PAGES pages, and clank.trade down → 503 (nothing guessed, nothing cached)', async () => {
  fake.pages = Array.from({ length: MAX_PAGES + 5 }, (_, i) => [listRow({ address: wallet(1000 + i), symbol: `C${i}`, name: `Coin ${i}` })]);
  const list = await scanClank({ now: NOW });
  assert.equal(calls.length, MAX_PAGES);
  assert.equal(list.complete, false);
  assert.equal(list.coins.length, MAX_PAGES);
  resetForTests();
  fake.down = true;
  const r = await get();
  assert.equal(r.status, 503);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await r.json(), { error: 'unverified' });
});

test('markCopycats: the site\'s own coin, then a graduated one, then the biggest is the real one', () => {
  // (sizes: market caps in dollars, mcUsd on the server since 2026-10-05)
  const c = (address, symbol, graduated, mcUsd, official = false) => ({ address, symbol, graduated, mcUsd, official });
  const [a, b, d] = markCopycats([c('0xa', 'PEPE', false, 3), c('0xb', 'pepe', true, 40), c('0xd', 'PEPE', false, 2.9)]);
  assert.equal(a.copyOf, '0xb'); assert.equal(d.copyOf, '0xb'); assert.equal(b.copyOf, null);
  const [x, y] = markCopycats([c('0xx', 'DOG', false, 3), c('0xy', 'DOG', false, 2.5)]);
  assert.equal(x.copyOf, null); assert.equal(y.copyOf, null, 'about the same size: nobody is "the copy"');
  assert.equal(x.sameTicker, 1);
  const [z] = markCopycats([c('0xz', 'DOG', false, 3)]);
  assert.equal(z.sameTicker, 0);
  const [p, q] = markCopycats([c('0xp', 'CAT', false, 10_000), c('0xq', 'CAT', false, 4_000)]);
  assert.equal(p.copyOf, null); assert.equal(q.copyOf, '0xp', 'less than half its size: a copy');
});

// ---------- the API ----------
test('only these addresses exist: the list, ?latest, ?a=<address>, ?logo=<address>&s=96|512; everything else stops before any lookup', async () => {
  for (const search of [`?a=${ABC.toUpperCase().replace('0X', '0x')}`, `?a=${ABC}&x=1`, `?x=1&a=${ABC}`, '?a=0x123', '?a=', '?q=agi', `?a=${ABC}%20`,
    '?latest=1', '?latest&x', '?LATEST', `?logo=${ABC}`, `?logo=${ABC}&s=64`, `?logo=${ABC}&s=256`, `?logo=${ABC}&s=96&v=2`, `?s=96&logo=${ABC}`,
    `?logo=${ABC.toUpperCase().replace('0X', '0x')}&s=96`, '?logo=0x123&s=96']) {
    const r = await get(search);
    assert.equal(r.status, 400, search);
    assert.equal(r.headers.get('cache-control'), 'no-store');
  }
  assert.equal(calls.length, 0);
  assert.equal(POST().status, 405);
});

test('?a=: a scan (shared by the CDN for 5 minutes, 1 minute for a coin under a day old), not a clank.trade coin (a minute), clank.trade down (not cached)', async () => {
  fake.coins[COIN] = { detail: detail(), holders: holdersOf([[CURVE, 60], ...spread(40, 0.9)]), trades: lively() };
  fake.coins[DEAD] = { detail: detail({ address: DEAD, createdAt: String(Math.floor(Date.now() / 1000) - 3 * H) }), holders: holdersOf([[CURVE, 60], ...spread(40, 0.9)]), trades: lively() };
  const young = await get(`?a=${DEAD}`);
  assert.equal(young.headers.get('cache-control'), 'public, max-age=30, s-maxage=60, stale-while-revalidate=60', 'a new coin changes fast');
  delete fake.coins[DEAD];
  const r = await get(`?a=${COIN}`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'public, max-age=60, s-maxage=300, stale-while-revalidate=300');
  const scan = await r.json();
  assert.ok(['low', 'some', 'high'].includes(scan.level));
  assert.equal(scan.address, COIN);
  const missing = await get(`?a=${DEAD}`);
  assert.equal(missing.status, 200, 'an answer, not a failure (browsers log 404s as errors)');
  assert.equal(missing.headers.get('cache-control'), 'public, max-age=30, s-maxage=60');
  assert.deepEqual(await missing.json(), { address: DEAD, error: 'not_clank' });
  fake.down = true;
  const down = await get(`?a=${COIN}`);
  assert.equal(down.status, 503);
  assert.equal(down.headers.get('cache-control'), 'no-store');
});

test('?a=: a speed bump of 30 scans a minute per visitor', async () => {
  fake.coins[COIN] = { detail: detail(), holders: holdersOf([[CURVE, 60], ...spread(40, 0.9)]), trades: lively() };
  for (let i = 0; i < 30; i++) assert.equal((await get(`?a=${COIN}`)).status, 200);
  const r = await get(`?a=${COIN}`);
  assert.equal(r.status, 429);
  assert.deepEqual(await r.json(), { error: 'slow_down' });
  assert.equal((await get(`?a=${COIN}`, '198.51.100.9')).status, 200, 'another visitor is fine');
  assert.equal((await get('')).status, 200, 'the list isn\'t counted');
});

// ---------- the page's list ----------
test('the page: filters, search, order, and how numbers read', () => {
  const now = NOW;
  const c = (address, symbol, name, o = {}) => ({ address, symbol, name, graduated: false, progress: 1, createdAt: now - 5 * DAY_MS, marketCap: 4000, trending: 0, ...o });
  const list = [
    c('0x01', 'AGI', 'Artificial Girlfriend Intelligence', { graduated: true, progress: 100, marketCap: 1_460_000, trending: 1 }),
    c('0x02', 'E/ACC', 'Egirl Acceleration', { progress: 22, marketCap: 10_900, createdAt: now - 2 * 3_600_000, trending: 2 }),
    c('0x03', 'MEOW', 'Meow', { graduated: true, progress: 100, marketCap: 132_000 }),
    c('0x04', 'AGIX', 'Agi Copy', { progress: 0, marketCap: 4170, createdAt: now - 30 * 60_000 }),
  ];
  assert.deepEqual(pick(list).map((x) => x.symbol), ['AGIX', 'E/ACC', 'AGI', 'MEOW'], 'newest first, like clank.trade (the default)');
  assert.deepEqual(pick(list, { filter: 'biggest' }).map((x) => x.symbol), ['AGI', 'MEOW', 'E/ACC', 'AGIX'], 'biggest: by market cap');
  assert.deepEqual(pick(list, { filter: 'trending', now }).map((x) => x.symbol), ['AGI', 'E/ACC']);
  assert.deepEqual(pick(list, { filter: 'graduated', now }).map((x) => x.symbol), ['AGI', 'MEOW']);
  assert.notEqual(pick(list), list, 'never sorts the page\'s own list in place');
  assert.deepEqual(pick(list, { query: 'agi', now }).map((x) => x.symbol), ['AGI', 'AGIX'], 'the exact ticker first');
  assert.deepEqual(pick(list, { query: '$meow', now }).map((x) => x.symbol), ['MEOW']);
  assert.deepEqual(pick(list, { query: 'egirl', now }).map((x) => x.symbol), ['E/ACC'], 'by name');
  assert.deepEqual(pick(list, { query: '0x03', now }).map((x) => x.symbol), ['MEOW'], 'by address');
  assert.deepEqual([usdShort(1_460_000), usdShort(10_900), usdShort(840), usdShort(null)], ['$1.46M', '$10.9K', '$840', '—']);
  assert.deepEqual([ageShort(30 * 60_000), ageShort(5 * 3_600_000), ageShort(10 * DAY_MS)], ['30 min', '5 h', '10 d']);
  assert.deepEqual([stageText({ graduated: true, progress: 100 }), stageText({ graduated: false, progress: 22.23 }), stageText({ graduated: false, progress: 0.22 })], ['Graduated', 'Curve 22%', 'Curve 0.2%']);
  assert.deepEqual([agoText(1200), agoText(8000), agoText(59_000), agoText(150_000), agoText(-500)], ['just now', '8 s ago', '59 s ago', '3 min ago', 'just now']);
});

// ---------- round 2: live updates ----------
test('?latest: the 12 newest coins and clank.trade\'s trending list in one request, shared by the CDN for 10 seconds', async () => {
  fake.pages = [[
    listRow({ address: wallet(20), symbol: 'THUC', name: 'thuc', createdAt: S - 60, marketCap: 1.546351084, image: `ipfs://${CID1}` }),
    listRow({ address: COIN, symbol: 'E/ACC', name: 'Egirl Acceleration', progress: 22.23, marketCap: 3.79, createdAt: S - 2 * H }),
  ], [listRow({ address: wallet(21), symbol: 'OLD', name: 'Old coin' })]];
  // the real shape of clank.trade's trending list (2026-09-26): dollars, isLive, no state
  fake.trending = [
    { address: OFFICIAL, name: 'Artificial Girlfriend Intelligence', symbol: 'AGI', image: `ipfs://${CID2}`, marketCapUsdg: 1203153.5335925785, volumeUsdg: 21989.02, priceChangePercent: -9.1, progress: 100, isLive: true },
    { address: COIN.toUpperCase().replace('0X', '0x'), symbol: 'E/ACC', marketCapUsdg: 10191.4, progress: 22.23, isLive: false },
    // sold out, its pool not open yet: graduating, not graduated (2026-09-29: only "live" means in its pool)
    { address: MEOW, symbol: 'MEOW', marketCapUsdg: 12000, progress: 100, isLive: false },
    { address: 'not an address' },
  ];
  const r = await get('?latest');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'public, max-age=5, s-maxage=10');
  const data = await r.json();
  assert.equal(calls.length, 1, 'one request, never the other pages');
  assert.match(calls[0], /\/v1\/trpc\/coins\.list,coins\.trending,exchangeRates\.tokenUsdg,exchangeRates\.tokenUsdg\?batch=1/);
  assert.deepEqual(data.coins.map((c) => c.symbol), ['THUC', 'E/ACC']);
  assert.equal(data.coins[0].image, true);
  assert.equal(data.coins[0].createdAt, (S - 60) * 1000);
  assert.equal(data.coins[0].marketCap, Math.round(1.546351084 * Number(ETH_USD)));
  assert.equal(data.coins[1].trending, 2);
  assert.equal(data.coins.some((c) => 'cid' in c || 'mcEth' in c), false, 'only what the page shows');
  assert.deepEqual(data.trending, [
    { address: OFFICIAL, rank: 1, marketCap: 1203154, progress: 100, graduated: true },
    { address: COIN, rank: 2, marketCap: 10191, progress: 22.23, graduated: false },
    { address: MEOW, rank: 3, marketCap: 12000, progress: 100, graduated: false },
  ]);
  assert.equal(data.ethUsd, Number(ETH_USD));
  // a few CDN regions at once: this server copy asks clank.trade once every 4 seconds at most
  calls = [];
  assert.equal((await get('?latest')).status, 200);
  assert.equal(calls.length, 0);
  // clank.trade down: 503, not cached, nothing guessed
  resetForTests();
  fake.down = true;
  const down = await get('?latest');
  assert.equal(down.status, 503);
  assert.equal(down.headers.get('cache-control'), 'no-store');
});

test('the page merges the newest coins: new launches added, known ones updated, trending ranks replaced, copycats marked again', () => {
  const coin = (address, symbol, o = {}) => tidyCoin({ address, symbol, name: symbol, graduated: false, progress: 5, createdAt: 1000, marketCap: 4000, trending: 0, ...o });
  const coins = [
    coin(`0x${'a'.repeat(40)}`, 'AGI', { graduated: true, progress: 100, marketCap: 1_000_000, trending: 1, official: true }),
    coin(`0x${'b'.repeat(40)}`, 'MEOW', { graduated: true, progress: 100, marketCap: 120_000, trending: 2 }),
    coin(`0x${'c'.repeat(40)}`, 'MOON', { progress: 3, marketCap: 4000 }),
  ];
  const added = mergeLatest(coins, {
    coins: [
      { address: `0x${'d'.repeat(40)}`, symbol: 'MEOW', name: 'Meow 2', graduated: false, progress: 0, createdAt: 5000, marketCap: 4100, trending: 0, image: true, adult: false },
      { address: `0x${'c'.repeat(40)}`, symbol: 'MOON', name: 'Moon', graduated: true, progress: 100, createdAt: 1000, marketCap: 90_000, trending: 7, copyOf: 'x' },
      { address: 'not a coin' },
    ],
    trending: [
      { address: `0x${'b'.repeat(40)}`, rank: 1, marketCap: 130_000, progress: 100, graduated: true },
      { address: `0x${'e'.repeat(40)}`, rank: 2, marketCap: 5, progress: 1, graduated: false },
    ],
  });
  assert.deepEqual(added.map((c) => c.symbol), ['MEOW'], 'the new launch');
  assert.equal(coins.length, 4);
  const by = Object.fromEntries(coins.map((c) => [c.address, c]));
  assert.equal(by[`0x${'c'.repeat(40)}`].graduated, true, 'a coin that graduated since');
  assert.equal(by[`0x${'c'.repeat(40)}`].marketCap, 90_000);
  assert.equal(by[`0x${'c'.repeat(40)}`].trending, 0, 'trending ranks only from the trending list');
  assert.equal(by[`0x${'a'.repeat(40)}`].trending, 0, 'no longer trending');
  assert.equal(by[`0x${'b'.repeat(40)}`].trending, 1);
  assert.equal(by[`0x${'b'.repeat(40)}`].marketCap, 130_000, 'trending coins get their market cap in dollars');
  assert.equal(by[`0x${'d'.repeat(40)}`].copyOf, `0x${'b'.repeat(40)}`, 'a new coin with a graduated coin\'s ticker: a copycat');
  assert.equal(by[`0x${'c'.repeat(40)}`].copyOf, null, 'marks are made here, not taken from the answer');
  // nothing new: nothing added; bad answers change nothing
  assert.deepEqual(mergeLatest(coins, { coins: [], trending: [] }), []);
  assert.deepEqual(mergeLatest(coins, null), []);
  assert.equal(tidyCoin({ address: '0x12' }), null);
  assert.deepEqual(tidyCoin({ address: `0x${'f'.repeat(40)}`, marketCap: 'lots', createdAt: null, image: 'yes' }),
    { address: `0x${'f'.repeat(40)}`, symbol: null, name: '', graduated: false, stage: null, progress: 0, createdAt: 0, marketCap: null, trending: 0, image: false, adult: false });
  // (2026-09-29) a graduating or rescued coin keeps that word until it graduates; nothing else is a stage word
  assert.equal(tidyCoin({ address: `0x${'f'.repeat(40)}`, stage: 'graduating' }).stage, 'graduating');
  assert.equal(tidyCoin({ address: `0x${'f'.repeat(40)}`, stage: '<b>x</b>' }).stage, null);
  const g = coin(`0x${'9'.repeat(40)}`, 'GRAD', { stage: 'graduating', progress: 100 });
  const list = [g];
  mergeLatest(list, { coins: [{ address: g.address, symbol: 'GRAD', name: 'GRAD', graduated: true, progress: 100, createdAt: 1000, marketCap: 9000 }] });
  assert.equal(list[0].stage, null, 'it graduated: the word goes');
  assert.equal(stageText(list[0]), 'Graduated');
  // trending says it's sold out but not live yet: still graduating (never "Graduated" too early)
  const h = coin(`0x${'8'.repeat(40)}`, 'SOLD', { stage: 'graduating', progress: 100 });
  const soldOut = [h];
  mergeLatest(soldOut, { coins: [], trending: [{ address: h.address, rank: 3, marketCap: 12000, progress: 100, graduated: false }] });
  assert.equal(stageText(soldOut[0]), 'Graduating');
  assert.equal(soldOut[0].graduated, false);
  assert.equal(stageText({ stage: 'graduating', graduated: false, progress: 100 }), 'Graduating');
  assert.equal(stageText({ stage: 'rescued', graduated: false, progress: 100 }), 'Rescued');
});

// ---------- round 2: pictures ----------
test('?logo=: a coin\'s picture from a public IPFS gateway (never clank.trade\'s own), made small, served from our address and kept a week', async () => {
  fake.pages = [[listRow({ address: COIN, symbol: 'E/ACC', name: 'Egirl Acceleration', image: `ipfs://${CID2}` })]];
  fake.pictures[CID2] = { type: 'image/jpeg', bytes: PHOTO };
  assert.equal((await get()).status, 200, 'the list (it remembers every coin\'s picture)');
  calls = []; inits = [];
  const r = await get(`?logo=${COIN}&s=96`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'image/webp');
  assert.equal(r.headers.get('cache-control'), 'public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400');
  assert.equal(r.headers.get('content-security-policy'), "default-src 'none'; sandbox");
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  const small = Buffer.from(await r.arrayBuffer());
  const m = await metaOf(small);
  assert.deepEqual([m.format, m.width, m.height], ['webp', 96, 96], 'a 96 px square (cut to fit), always WebP');
  assert.ok(small.length < 3000, `small (${small.length} bytes)`);
  assert.deepEqual(calls, [`${FILEBASE}${CID2}`], 'Filebase\'s public gateway first; known from the list: no lookup at clank.trade');
  assert.equal(inits[0].redirect, 'error', 'never followed somewhere else');
  assert.match(inits[0].headers['User-Agent'], /ClankChecker\/1\.0; \+https:\/\/agi1\.app/);
  assert.ok(!calls.some((u) => u.startsWith(PINATA)), 'clank.trade\'s own gateway is never asked (it only answers its own pages)');
  // the big one: the whole picture, at most 512 px, never enlarged
  calls = [];
  const big = await get(`?logo=${COIN}&s=512`);
  const bm = await metaOf(Buffer.from(await big.arrayBuffer()));
  assert.deepEqual([bm.format, bm.width, bm.height], ['webp', 512, 384], 'the whole 800 × 600 photo, at most 512 px wide or tall');
  assert.deepEqual(PICTURE_SIZES, [96, 512]);
  fake.pictures[CID2] = { type: 'image/png', bytes: SMALL };
  resetForTests();
  const tiny = await metaOf(Buffer.from(await (await get(`?logo=${COIN}&s=512`)).arrayBuffer()));
  assert.deepEqual([tiny.width, tiny.height], [64, 40], 'a small picture stays its size');
  // a coin this server copy hasn't listed: its details from clank.trade, once
  forgetPictures();
  fake.coins[MEOW] = { detail: grad({ image: `ipfs://${CID1}` }), holders: [], trades: [] };
  fake.pictures[CID1] = { type: 'image/png', bytes: SQUARE };
  calls = [];
  assert.equal((await get(`?logo=${MEOW}&s=96`)).status, 200);
  assert.equal(calls.length, 2);
  assert.match(calls[0], /\/v1\/trpc\/coins\.detail\?batch=1/);
  calls = [];
  assert.equal((await get(`?logo=${MEOW}&s=512`)).status, 200);
  assert.equal(calls.length, 1, 'remembered');
});

test('pictures: the next public gateway when one is down, slow or missing it; ClankBot\'s host; the type read from the file itself', async () => {
  fake.pictures[CID1] = { type: 'application/octet-stream', bytes: SQUARE };
  assert.deepEqual(GATEWAYS.map(([base]) => base), [FILEBASE, PINATA_PUBLIC, IPFS_IO], 'Filebase, then Pinata\'s public gateway, then ipfs.io');
  for (const [how, expect] of [['down', 2], ['timeout', 2], ['missing', 2], ['html', 2]]) {
    calls = [];
    fake.gateways = { filebase: how };
    const got = await fetchCoinPicture(CID1, 96);
    assert.equal(got?.type, 'image/webp', how);
    assert.deepEqual(calls, [`${FILEBASE}${CID1}`, `${PINATA_PUBLIC}${CID1}`], `Filebase ${how}: Pinata's public gateway has it`);
  }
  calls = [];
  fake.gateways = { filebase: 'down', pinata: 'timeout' };
  assert.equal((await fetchCoinPicture(CID1, 512))?.type, 'image/webp');
  assert.deepEqual(calls, [`${FILEBASE}${CID1}`, `${PINATA_PUBLIC}${CID1}`, `${IPFS_IO}${CID1}`]);
  // a gateway that claims some other type: what counts is the file's own first bytes
  assert.equal(pictureType(PHOTO), 'image/jpeg');
  assert.equal(pictureType(SQUARE), 'image/png');
  assert.equal(pictureType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
  assert.equal(pictureType(Buffer.from('<html>')), null);
  // nobody has it: "no picture" (kept an hour); somebody failed: asked again later (an error)
  fake.gateways = { filebase: 'missing', pinata: 'missing', ipfsio: 'missing' };
  assert.equal(await fetchCoinPicture(CID1, 96), null);
  fake.gateways = { filebase: 'missing', pinata: 'down', ipfsio: 'missing' };
  await assert.rejects(fetchCoinPicture(CID1, 96), /picture hosts: HTTP 502/);
  fake.gateways = {};
  // out of time: never past the deadline (Vercel stops a function at 25 s)
  calls = [];
  await assert.rejects(fetchCoinPicture(CID1, 96, { deadline: Date.now() + 500 }), /no time left/);
  assert.equal(calls.length, 0);
  // ClankBot's host: 13 coins name a picture there (2026-10-05). Only its pictures; any other site keeps the letter
  assert.equal(pictureOf(CLANKBOT_PIC), CLANKBOT_PIC);
  assert.equal(pictureOf('https://clankbot.trade/images/default-logo.png'), 'https://clankbot.trade/images/default-logo.png');
  for (const bad of ['https://emojiisland.com/cdn/shop/products/Rocket_Emoji_large.png?v=1571606064', 'https://violet-mauve.vercel.app/images/favicon.png',
    'http://clankbot.trade/images/launches/1.jpg', 'https://clankbot.trade.evil.test/images/launches/1.jpg', 'https://clankbot.trade/images/../secret.jpg',
    'https://clankbot.trade/images/launches/1.jpg?x=1', 'https://clankbot.trade:8443/images/launches/1.jpg', 'https://user@clankbot.trade/images/launches/1.jpg',
    'https://clankbot.trade/images/launches/1.svg', 'https://clankbot.trade/api/launches/1.jpg', ' ', '', null]) {
    assert.equal(pictureOf(bad), null, String(bad));
  }
  assert.equal(pictureOf(`ipfs://${CID1}`), CID1);
  assert.equal(pictureOf(`https://yellow-total-guanaco-389.mypinata.cloud/ipfs/${CID2}?img-width=128&img-height=128`), CID2, 'clank.trade\'s own gateway address: its content id, read elsewhere');
  fake.pictures[CLANKBOT_PIC] = { type: 'image/jpeg', bytes: PHOTO };
  calls = [];
  const cb = await fetchCoinPicture(CLANKBOT_PIC, 96);
  assert.equal(cb.type, 'image/webp');
  assert.deepEqual(calls, [CLANKBOT_PIC]);
  fake.pages = [[listRow({ address: COIN, symbol: 'CLANKMEW', name: 'clankmew', image: CLANKBOT_PIC }), listRow({ address: MEOW, symbol: 'ROCKET', name: 'rocket', image: 'https://emojiisland.com/x.png' })]];
  const list = await (await get()).json();
  assert.deepEqual(list.coins.map((c) => [c.symbol, c.image]), [['CLANKMEW', true], ['ROCKET', false]]);
  assert.equal((await get(`?logo=${COIN}&s=96`)).status, 200);
  assert.equal((await get(`?logo=${MEOW}&s=96`)).status, 404);
});

test('pictures we never show: not a picture, a fake one, SVG, over 8 MB, broken, giant; sharp missing (as they are, up to 1 MB)', async () => {
  for (const [pic, why] of [
    [{ type: 'image/svg+xml', bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') }, 'SVG can carry code'],
    [{ type: 'text/html', bytes: Buffer.from('<html>hi</html>') }, 'not a picture'],
    [{ type: 'image/png', bytes: Buffer.from('<html>not really a png</html>') }, 'says PNG, isn\'t one'],
    [{ type: 'image/png', bytes: PNG }, 'a PNG\'s first bytes and nothing behind them (broken)'],
    [{ type: 'image/jpeg', bytes: Buffer.concat([PHOTO, Buffer.alloc(ORIGINAL_MAX_BYTES)]) }, 'over 8 MB'],
  ]) {
    fake.pictures[CID1] = pic;
    assert.equal(await fetchCoinPicture(CID1, 96), null, why);
  }
  // a picture of more than 50 million pixels (a "decompression bomb" is tiny as a file): not shown. A 1 × 1 PNG whose
  // header claims 10,000 × 6,000 (its checksum made right, so only the size gives it away)
  const bomb = Buffer.from(await sharp({ create: { width: 1, height: 1, channels: 3, background: '#000' } }).png().toBuffer());
  bomb.writeUInt32BE(10_000, 16); bomb.writeUInt32BE(6_000, 20);
  bomb.writeUInt32BE(zlib.crc32(bomb.subarray(12, 29)), 29);
  assert.equal((await metaOf(bomb)).width, 10_000);
  fake.pictures[CID1] = { type: 'image/png', bytes: bomb };
  assert.equal(await fetchCoinPicture(CID1, 512), null, 'giant');
  // big but fine: made small
  fake.pictures[CID1] = { type: 'image/jpeg', bytes: BIG };
  const big = await fetchCoinPicture(CID1, 512);
  assert.deepEqual([(await metaOf(big.bytes)).width, (await metaOf(big.bytes)).height], [512, 341]);
  assert.ok(big.bytes.length < 40_000, `${big.bytes.length} bytes, from ${BIG.length}`);
  // if sharp ever went missing, a real picture as it is, up to 1 MB (never a broken one: its first bytes are still checked)
  setSharpForTests(null);
  fake.pictures[CID1] = { type: 'image/png', bytes: SQUARE };
  assert.deepEqual(await fetchCoinPicture(CID1, 96), { bytes: SQUARE, type: 'image/png' });
  fake.pictures[CID1] = { type: 'image/jpeg', bytes: BIG.length > 1_000_000 ? BIG : Buffer.concat([BIG, Buffer.alloc(1_000_001 - BIG.length)]) };
  assert.equal(await fetchCoinPicture(CID1, 96), null, 'over 1 MB without sharp');
  setSharpForTests(undefined);
});

test('?logo=: no picture, not a clank.trade coin, not a real picture, the hosts down; the speed bump; the owner\'s hidden pictures', async () => {
  fake.coins[COIN] = { detail: detail({ image: 'ipfs://x' }), holders: [], trades: [] };
  const none = await get(`?logo=${COIN}&s=96`);
  assert.equal(none.status, 404, 'no picture');
  assert.equal(none.headers.get('cache-control'), 'public, max-age=3600, s-maxage=3600');
  assert.equal((await get(`?logo=${DEAD}&s=96`)).status, 404, 'not a clank.trade coin');
  fake.coins[COIN].detail = detail({ image: `ipfs://${CID1}` });
  forgetPictures();
  fake.pictures[CID1] = { type: 'text/html', bytes: Buffer.from('<html>hi</html>') };
  const notPic = await get(`?logo=${COIN}&s=96`);
  assert.equal(notPic.status, 404, 'not a picture');
  assert.match(notPic.headers.get('content-type'), /json/);
  fake.gateways = { filebase: 'down', pinata: 'down', ipfsio: 'timeout' };
  const down = await get(`?logo=${COIN}&s=96`);
  assert.equal(down.status, 502);
  assert.equal(down.headers.get('cache-control'), 'public, max-age=300, s-maxage=300', 'tried again in a few minutes');
  fake.gateways = {};
  fake.down = true;
  forgetPictures();
  assert.equal((await get(`?logo=${COIN}&s=96`)).status, 502, 'clank.trade down');
  fake.down = false;
  // a script asking for thousands: 240 a minute per visitor
  fake.pictures[CID1] = { type: 'image/png', bytes: SMALL };
  resetForTests();
  let last;
  for (let i = 0; i < 241; i++) last = await get(`?logo=${COIN}&s=96`);
  assert.equal(last.status, 429);
  assert.equal((await get(`?logo=${COIN}&s=96`, '198.51.100.9')).status, 200, 'another visitor is fine');
  // pictures the owner doesn't want on the site (CHECKER_HIDE_PICTURES): the letter instead, everywhere
  resetForTests();
  process.env.CHECKER_HIDE_PICTURES = `${COIN}, 0xnot-an-address`;
  calls = [];
  const hidden = await get(`?logo=${COIN}&s=512`);
  assert.equal(hidden.status, 404);
  assert.equal(calls.length, 0, 'not even fetched');
  fake.pages = [[listRow({ address: COIN, symbol: 'E/ACC', name: 'x', image: `ipfs://${CID1}` }), listRow({ address: MEOW, symbol: 'MEOW', name: 'Meow', image: `ipfs://${CID2}` })]];
  const list = await (await get()).json();
  assert.deepEqual(list.coins.map((c) => [c.symbol, c.image]), [['E/ACC', false], ['MEOW', true]]);
  const latest = await (await get('?latest')).json();
  assert.equal(latest.coins.find((c) => c.address === COIN).image, false);
  fake.coins[COIN] = { detail: detail({ image: `ipfs://${CID1}` }), holders: holdersOf([[CURVE, 60], ...spread(40, 0.9)]), trades: lively() };
  assert.equal((await (await get(`?a=${COIN}`)).json()).image, false);
});

test('fetchCoinPicture / coinPictureId: only real content ids, ClankBot\'s pictures and our two sizes; nothing else is ever fetched', async () => {
  assert.equal(await fetchCoinPicture('../../etc/passwd', 96), null);
  assert.equal(await fetchCoinPicture('https://evil.test/x.png', 96), null);
  assert.equal(await fetchCoinPicture(CID1, 64), null);
  assert.equal(await fetchCoinPicture(CID1, 2048), null);
  assert.equal(await coinPictureId('0xnope'), null);
  assert.equal(calls.length, 0);
  fake.pictures[CID1] = { type: 'image/png', bytes: SQUARE };
  const got = await fetchCoinPicture(CID1, 512);
  assert.equal(got.type, 'image/webp');
  assert.equal(calls.length, 1);
});

// ---------- coins paired with SPCX (2026-10-05) ----------
// Since 2026-10-02 clank.trade also pairs coins with SPCX, Robinhood's SpaceX stock token: their market cap, curve and
// threshold are in SPCX. Everything was priced as ETH before, so $SI (247.76 SPCX, $39.8K on clank.trade) showed $677K.
const SI = '0x0fe97b2d477014d78a61829a3c41866912d469ea';
const spcxRow = (c) => ({ ...listRow(c), quoteSymbol: 'SPCX', quoteCurrency: SPCX });
const spcxDetail = (o = {}) => detail({ quoteCurrency: '0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa', quoteSymbol: 'SPCX', quoteDecimals: 18, threshold: '74389625610464579013', ...o });

test('coins paired with SPCX: the list counts their market cap at SPCX\'s price (the same number clank.trade shows), never ETH\'s', async () => {
  assert.equal(SPCX, '0x4a0e65a3eccec6dbe60ae065f2e7bb85fae35eea');
  assert.equal(LAUNCH_SPCX, SPCX, 'one address for SPCX: the risk check and the launch page agree');
  fake.pages = [[
    spcxRow({ address: SI, symbol: 'SI', name: 'Space Inu', state: 3, progress: 100, marketCap: 247.76325924079578 }),
    listRow({ address: OFFICIAL, symbol: 'AGI', name: 'Artificial Girlfriend Intelligence', state: 3, progress: 100, marketCap: 143.91 }),
    spcxRow({ address: wallet(30), symbol: 'CBOT', name: 'ClankBot', progress: 15.97, marketCap: 54.73 }),
    // the same ticker on both pairs, about the same size in dollars ($4.7K and $4.3K): neither is a copy of the other
    listRow({ address: wallet(31), symbol: 'SUPER', name: 'Super Intelligence', progress: 3, marketCap: 1.75 }),
    spcxRow({ address: wallet(32), symbol: 'SUPER', name: 'Space Super', progress: 0.5, marketCap: 26.91 }),
  ]];
  const list = await (await get()).json();
  const by = Object.fromEntries(list.coins.map((c) => [c.symbol === 'SUPER' ? c.name : c.symbol, c]));
  assert.equal(by.SI.marketCap, Math.round(247.76325924079578 * Number(SPCX_USD)), 'about $39.8K, as clank.trade shows it');
  assert.equal(by.SI.marketCap, 39761);
  assert.notEqual(by.SI.marketCap, Math.round(247.76325924079578 * Number(ETH_USD)), 'not $666K (the old mistake)');
  assert.equal(by.CBOT.marketCap, Math.round(54.73 * Number(SPCX_USD)));
  assert.equal(by.AGI.marketCap, Math.round(143.91 * Number(ETH_USD)));
  assert.ok(by.AGI.marketCap > by.SI.marketCap, 'so "Biggest" puts $AGI above $SI again');
  assert.equal(by['Super Intelligence'].copyOf, null);
  assert.equal(by['Space Super'].copyOf, null, 'sizes compared in dollars (26.91 SPCX is not "15 times" 1.75 ETH)');
  assert.equal(list.spcxUsd, Number(SPCX_USD));
  assert.match(calls[0], /coins\.list,coins\.trending,exchangeRates\.tokenUsdg,exchangeRates\.tokenUsdg\?batch=1/, 'both prices in the first request');
  assert.equal(calls.filter((u) => u.includes('exchangeRates')).length, 1, 'no extra request for ETH or SPCX');
  // the newest coins every 10 seconds: the same
  resetForTests();
  const latest = await (await get('?latest')).json();
  assert.equal(latest.coins.find((c) => c.address === SI).marketCap, 39761);
});

test('a pair we don\'t know yet: its price asked once, in one more request; no price → no dollars (never ETH\'s)', async () => {
  const FOO = '0x1111111111111111111111111111111111111111';
  fake.pages = [[{ ...listRow({ address: wallet(40), symbol: 'FOOD', name: 'Food', marketCap: 10 }), quoteCurrency: FOO, quoteSymbol: 'FOO' }]];
  fake.prices[FOO] = '2.5';
  const list = await scanClank({ now: NOW });
  assert.equal(list.coins[0].marketCap, 25);
  const asked = calls.filter((u) => u.includes('exchangeRates'));
  assert.equal(asked.length, 2);
  assert.deepEqual(JSON.parse(new URL(asked[1]).searchParams.get('input')), { 0: { token: FOO } });
  delete fake.prices[FOO];
  calls = [];
  const unknown = await scanClank({ now: NOW });
  assert.equal(unknown.coins[0].marketCap, null, 'shown as "—" on the page');
  // clank.trade down for prices altogether: no dollars, the list still comes
  fake.prices = {};
  const noPrices = await scanClank({ now: NOW });
  assert.equal(noPrices.coins[0].marketCap, null);
  assert.equal(noPrices.ethUsd, null);
});

test('a scan of a coin paired with SPCX: its market cap and what\'s in its curve at SPCX\'s price, and its pair named', async () => {
  const s = scanOf({ detail: spcxDetail({ marketCap: 26.91, progress: 8, reserve: '5951170048837166321' }), prices: new Map([[ZERO, Number(ETH_USD)], [SPCX, Number(SPCX_USD)]]) });
  const facts = Object.fromEntries(s.facts.map((f) => [f.label, f.value]));
  assert.equal(facts['Market cap'], usd(26.91 * Number(SPCX_USD)));
  assert.equal(facts['Market cap'], '$4.3K');
  assert.equal(facts['In its curve'], usd(5.951170048837166 * Number(SPCX_USD)));
  assert.equal(facts['In its curve'], '$955');
  assert.equal(facts['Paired with'], 'SPCX');
  assert.ok(s.flags.some((f) => f.id === 'stage' && f.text === 'Early: 8% of its bonding curve is filled (about $955 in it).'));
  // an ETH coin says so too
  assert.equal(Object.fromEntries(scanOf({}).facts.map((f) => [f.label, f.value]))['Paired with'], 'ETH');
  // without SPCX's price: no dollars (never priced as ETH)
  const blind = scanOf({ detail: spcxDetail({ marketCap: 26.91, progress: 8, reserve: '5951170048837166321' }) });
  const bf = Object.fromEntries(blind.facts.map((f) => [f.label, f.value]));
  assert.equal(bf['Market cap'], '—');
  assert.equal(bf['In its curve'], '—');
  // the same ticker: compared in dollars, whatever the pairs
  const other = listRow({ address: DEAD, symbol: 'E/ACC', name: 'x', progress: 3, marketCap: 1.75 });
  const twin = scanOf({ detail: spcxDetail({ marketCap: 26.91 }), sameTicker: [other], prices: new Map([[ZERO, Number(ETH_USD)], [SPCX, Number(SPCX_USD)]]) });
  assert.ok(!twin.flags.some((f) => f.id === 'copycat'), '$4.3K vs $4.7K: neither is a copy');
  assert.ok(twin.flags.some((f) => f.id === 'ticker' && f.sev === 'some'));
});

test('checkCoin of a coin paired with SPCX: both prices come with the first request; the chain\'s scan names SPCX', async () => {
  fake.coins[SI] = { detail: spcxDetail({ address: SI, symbol: 'SI', name: 'Space Inu', state: 3, progress: 100, marketCap: 247.76325924079578, reserve: '0' }),
    holders: holdersOf([[POOL_MANAGER, 24.5], ...spread(99, 0.6)]), trades: lively(100, 300) };
  fake.dex[SI] = [pair(SI, 21885.65, -12.91)];
  fake.explorer[SI] = 300;
  const s = await checkCoin(SI, { now: NOW });
  const facts = Object.fromEntries(s.facts.map((f) => [f.label, f.value]));
  assert.equal(facts['Market cap'], '$39.8K', 'as clank.trade shows it (it was $677K)');
  assert.equal(facts['Paired with'], 'SPCX');
  assert.equal(calls.filter((u) => u.includes('exchangeRates')).length, 1, 'no extra request');
  // from the chain alone (clank.trade away): its curve in SPCX
  fake.down = true;
  onChain(COIN, { reserve: 12_300_000_000_000_000_000n, launch: { pairToken: SPCX, graduationThreshold: 74389625610464579013n } });
  const c = await checkCoin(COIN, { now: NOW });
  assert.equal(c.source, 'chain');
  const cf = Object.fromEntries(c.facts.map((f) => [f.label, f.value]));
  assert.equal(cf['In its curve'], '12.3 SPCX');
  assert.equal(cf['Paired with'], 'SPCX');
  assert.ok(c.flags.some((f) => f.id === 'stage' && /about 12\.3 SPCX in it/.test(f.text)));
  assert.equal(c.progress, 16.53, '12.3 of its 74.39 SPCX threshold');
  // an ETH coin from the chain: ETH, as before
  onChain(COIN, {});
  const e = Object.fromEntries((await checkCoin(COIN, { now: NOW })).facts.map((f) => [f.label, f.value]));
  assert.equal(e['In its curve'], '0.951 ETH');
  assert.equal(e['Paired with'], 'ETH');
});
