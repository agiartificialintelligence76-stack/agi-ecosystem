// ClankChecker (2026-09-26): the risk scan of clank.trade coins (server/checker.js), its API (api/checker.js), AGI-1's lines
// about a scan (src/checker/lines.js) and the page's list helpers (src/sections/checker.js). clank.trade, its picture host,
// DexScreener and the block explorer are faked with the shapes they really answer with (read on 2026-09-26). Run: npm test
// Round 2 (the owner, the same day): live updates (?latest), coin pictures (?logo=…), and every coin listed (crude names too).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GET, POST, resetForTests } from '../api/checker.js';
import { analyze, checkCoin, scanClank, latestClank, markCopycats, showTicker, tickerKey, usd, percent, timeText, maskSlurs, cidOf,
  coinPictureId, fetchCoinPicture, forgetPictures, POOL_MANAGER, OFFICIAL, MAX_PAGES, PICTURE_SIZES } from '../server/checker.js';
import { CHECK_LINES, LEVELS, checkLine, spokenOf } from '../src/checker/lines.js';
import { LINES, LINE_MOODS, MOOD_STYLES } from '../server/voice.js';
import { pick, usdShort, ageShort, agoText, stageText, mergeLatest, tidyCoin } from '../src/sections/checker.js';

const NOW = Date.UTC(2026, 8, 26, 12, 0, 0);
const S = NOW / 1000;
const H = 3600, D = 86_400, DAY_MS = 86_400_000;
const ETH_USD = '2689.164696758498861512';
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
const PINATA = 'https://yellow-total-guanaco-389.mypinata.cloud/ipfs/';
// the first bytes of a real WebP / PNG, and an SVG (never served)
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(40, 7)]);
const PNG = Buffer.concat([Buffer.from([0x89]), Buffer.from('PNG\r\n\x1a\n'), Buffer.alloc(40, 1)]);
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
let fake, calls, inits;
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
  fake = {
    down: false, wall: false,
    coins: {},                              // address → { detail, holders, trades }
    pages: [[]],                            // coins.list pages (rows)
    trending: [],
    search: {},                             // query → rows
    dex: {},                                // address → pairs | 'down'
    explorer: {},                           // address → holders_count | 'down'
    pictures: {},                           // content id → { type, bytes } | 'down'
  };
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    calls.push(url);
    inits.push(init);
    if (url.startsWith(PINATA)) {
      const pic = fake.pictures[new URL(url).pathname.split('/').pop()];
      if (pic === 'down') return new Response('bad gateway', { status: 502 });
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
        if (name === 'exchangeRates.tokenUsdg') return { result: { data: { price: ETH_USD, token: arg.token, tokenDecimals: 18 } } };
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
  assert.equal(first.pathname, '/v1/trpc/coins.detail,coins.holders,coins.trades,exchangeRates.tokenUsdg');
  assert.deepEqual(JSON.parse(first.searchParams.get('input')), { 0: { address: MEOW }, 1: { address: MEOW }, 2: { address: MEOW, limit: 100 }, 3: { token: '0x0000000000000000000000000000000000000000' } });
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
  assert.match(calls[0], /\/v1\/trpc\/coins\.list,coins\.trending,exchangeRates\.tokenUsdg\?batch=1/);
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
  const c = (address, symbol, graduated, mcEth, official = false) => ({ address, symbol, graduated, mcEth, official });
  const [a, b, d] = markCopycats([c('0xa', 'PEPE', false, 3), c('0xb', 'pepe', true, 40), c('0xd', 'PEPE', false, 2.9)]);
  assert.equal(a.copyOf, '0xb'); assert.equal(d.copyOf, '0xb'); assert.equal(b.copyOf, null);
  const [x, y] = markCopycats([c('0xx', 'DOG', false, 3), c('0xy', 'DOG', false, 2.5)]);
  assert.equal(x.copyOf, null); assert.equal(y.copyOf, null, 'about the same size: nobody is "the copy"');
  assert.equal(x.sameTicker, 1);
  const [z] = markCopycats([c('0xz', 'DOG', false, 3)]);
  assert.equal(z.sameTicker, 0);
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
    { address: 'not an address' },
  ];
  const r = await get('?latest');
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'public, max-age=5, s-maxage=10');
  const data = await r.json();
  assert.equal(calls.length, 1, 'one request, never the other pages');
  assert.match(calls[0], /\/v1\/trpc\/coins\.list,coins\.trending,exchangeRates\.tokenUsdg\?batch=1/);
  assert.deepEqual(data.coins.map((c) => c.symbol), ['THUC', 'E/ACC']);
  assert.equal(data.coins[0].image, true);
  assert.equal(data.coins[0].createdAt, (S - 60) * 1000);
  assert.equal(data.coins[0].marketCap, Math.round(1.546351084 * Number(ETH_USD)));
  assert.equal(data.coins[1].trending, 2);
  assert.equal(data.coins.some((c) => 'cid' in c || 'mcEth' in c), false, 'only what the page shows');
  assert.deepEqual(data.trending, [
    { address: OFFICIAL, rank: 1, marketCap: 1203154, progress: 100, graduated: true },
    { address: COIN, rank: 2, marketCap: 10191, progress: 22.23, graduated: false },
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
    { address: `0x${'f'.repeat(40)}`, symbol: null, name: '', graduated: false, progress: 0, createdAt: 0, marketCap: null, trending: 0, image: false, adult: false });
});

// ---------- round 2: pictures ----------
test('?logo=: a coin\'s picture from clank.trade\'s own picture host, checked, served from our address and kept a week', async () => {
  fake.pages = [[listRow({ address: COIN, symbol: 'E/ACC', name: 'Egirl Acceleration', image: `ipfs://${CID2}` })]];
  fake.pictures[CID2] = { type: 'image/webp', bytes: WEBP };
  assert.equal((await get()).status, 200, 'the list (it remembers every coin\'s picture)');
  calls = []; inits = [];
  const r = await get(`?logo=${COIN}&s=96`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'image/webp');
  assert.equal(r.headers.get('cache-control'), 'public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400');
  assert.equal(r.headers.get('content-security-policy'), "default-src 'none'; sandbox");
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(Buffer.from(await r.arrayBuffer()), WEBP);
  assert.deepEqual(calls, [`${PINATA}${CID2}?img-width=96&img-height=96&img-fit=cover&img-quality=85&img-format=webp`], 'known from the list: no lookup at clank.trade');
  assert.equal(inits[0].redirect, 'error', 'never followed somewhere else');
  // the big one: the whole picture, never enlarged
  calls = [];
  assert.equal((await get(`?logo=${COIN}&s=512`)).status, 200);
  assert.deepEqual(calls, [`${PINATA}${CID2}?img-width=512&img-height=512&img-fit=scale-down&img-quality=85&img-format=webp`]);
  assert.deepEqual(PICTURE_SIZES, [96, 512]);
  // a coin this server copy hasn't listed: its details from clank.trade, once
  forgetPictures();
  fake.coins[MEOW] = { detail: grad({ image: `ipfs://${CID1}` }), holders: [], trades: [] };
  fake.pictures[CID1] = { type: 'image/png', bytes: PNG };
  calls = [];
  assert.equal((await get(`?logo=${MEOW}&s=96`)).status, 200);
  assert.equal(calls.length, 2);
  assert.match(calls[0], /\/v1\/trpc\/coins\.detail\?batch=1/);
  calls = [];
  assert.equal((await get(`?logo=${MEOW}&s=512`)).status, 200);
  assert.equal(calls.length, 1, 'remembered');
});

test('?logo=: no picture, not a clank.trade coin, not a real picture, too big, the host down; the speed bump; the owner\'s hidden pictures', async () => {
  fake.coins[COIN] = { detail: detail({ image: 'ipfs://x' }), holders: [], trades: [] };
  const none = await get(`?logo=${COIN}&s=96`);
  assert.equal(none.status, 404, 'no picture');
  assert.equal(none.headers.get('cache-control'), 'public, max-age=3600, s-maxage=3600');
  assert.equal((await get(`?logo=${DEAD}&s=96`)).status, 404, 'not a clank.trade coin');
  fake.coins[COIN].detail = detail({ image: `ipfs://${CID1}` });
  forgetPictures();
  for (const [pic, why] of [
    [{ type: 'image/svg+xml', bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') }, 'SVG can carry code'],
    [{ type: 'text/html', bytes: Buffer.from('<html>hi</html>') }, 'not a picture'],
    [{ type: 'image/png', bytes: Buffer.from('<html>not really a png</html>') }, 'says PNG, isn\'t one'],
    [{ type: 'image/webp', bytes: Buffer.concat([WEBP, Buffer.alloc(1_000_001)]) }, 'over 1 MB'],
  ]) {
    fake.pictures[CID1] = pic;
    const r = await get(`?logo=${COIN}&s=96`);
    assert.equal(r.status, 404, why);
    assert.match(r.headers.get('content-type'), /json/);
  }
  fake.pictures[CID1] = 'down';
  const down = await get(`?logo=${COIN}&s=96`);
  assert.equal(down.status, 502);
  assert.equal(down.headers.get('cache-control'), 'public, max-age=300, s-maxage=300', 'tried again in a few minutes');
  fake.down = true;
  forgetPictures();
  assert.equal((await get(`?logo=${COIN}&s=96`)).status, 502, 'clank.trade down');
  fake.down = false;
  // a script asking for thousands: 240 a minute per visitor
  fake.pictures[CID1] = { type: 'image/png', bytes: PNG };
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

test('fetchCoinPicture / coinPictureId: only real content ids and our two sizes; nothing else is ever fetched', async () => {
  assert.equal(await fetchCoinPicture('../../etc/passwd', 96), null);
  assert.equal(await fetchCoinPicture(CID1, 64), null);
  assert.equal(await fetchCoinPicture(CID1, 2048), null);
  assert.equal(await coinPictureId('0xnope'), null);
  assert.equal(calls.length, 0);
  fake.pictures[CID1] = { type: 'image/png', bytes: PNG };
  const got = await fetchCoinPicture(CID1, 512);
  assert.equal(got.type, 'image/png');
  assert.equal(calls.length, 1);
});
