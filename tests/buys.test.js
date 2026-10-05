// The $AGI buy bot (2026-10-06, the owner: "a very simple buybot to the tgbot with a minimum buy of $100 just for $AGI with
// robot emojis and with a gif of her … with mc, price amount of agi, etc."): reading clank.trade's trades, her caption,
// the check (each buy once, the first look silent, only fresh buys of $100 or more, at most 6 a check), her GIF (uploaded
// once, then sent by Telegram's id), GET /api/feed?buys (only with the database's own key), the settings, the GIF file
// itself, the tool that makes it, and supabase/buys.sql's promises. clank.trade, Supabase and Telegram are fakes: no keys,
// no cost. Run: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buyOf, readBuys, checkBuys, buyKey, forgetBuys, TRADE_ID, SUPPLY, FRESH_MS, MAX_POSTS, ETH } from '../server/buys.js';
import { ETH_PAIR } from '../server/clank-chain.js';
import { buyLine, ROBOT_USD, EXPLORER } from '../server/tg-lines.js';
import { GET as feed, POST as feedPost } from '../api/feed.js';
import { getConfig } from '../server/config.js';
import { withoutSecrets, FPS } from '../tools/buybot/make.mjs';

const TOKEN = `123456789:AA${'x'.repeat(33)}`;
const KEY = 'a1b2c3d4'.repeat(8);                         // the database's key (64 hex characters, as buys.sql makes it)
const CRON = 'cron-secret-long-enough';
const OFFICIAL = '0xfa31d04462746aaa24bc7e5626403e09e4b106ec';
const ENV = {
  SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fake_key_123', PASS_SECRET: 'test-pass-secret-that-is-long-enough-1234',
  TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_GROUPS: '@agi2dotapp, -1001234567890', CRON_SECRET: CRON,
};
const ETH_USD = 2685.18;
const GIF_BYTES = readFileSync(new URL('../server/media/agi1-buy.mp4', import.meta.url));
const hex = (n, len = 64) => n.toString(16).padStart(len, '0');
const addr = (n) => `0x${hex(n, 40)}`;

// A clank.trade trade (its API's own shape, checked live on 2026-10-06): `usd` worth of ETH at ETH_USD, at `price` dollars
// an $AGI, `ago` seconds before now
function trade(n, { usd = 250, price = 0.0004, side = 'buy', ago = 30, now = Date.now(), trader = addr(0xada5 * 1000 + n) } = {}) {
  const eth = usd / ETH_USD, agi = usd / price;
  const wei = (x) => (BigInt(Math.ceil(x * 1e9)) * 10n ** 9n).toString();     // (rounded up: never a hair under the amount)
  return {
    id: `4663:0x${hex(1000 + n)}:0x${hex(5000 + n)}:${n % 50}`, trader, side, baseAmount: wei(agi), quoteAmount: wei(eth),
    timestamp: String(Math.floor(now / 1000) - ago), transactionHash: `0x${hex(5000 + n)}`, cursor: `c${n}`,
  };
}

// ---------- fakes ----------
let fake, calls;
function database() {
  return {
    started: false, seen: new Set(), key: KEY,
    buy_key() { return this.key; },
    // like buys.sql's buy_take: the first call notes them all and returns none; then only ids not seen yet, each once
    buy_take({ p_ids }) {
      if (!Array.isArray(p_ids) || p_ids.length > 200) return [];
      const first = !this.started;
      this.started = true;
      const fresh = [...new Set(p_ids)].filter((id) => TRADE_ID.test(id) && !this.seen.has(id));
      for (const id of fresh) this.seen.add(id);
      return first ? [] : fresh.sort();
    },
  };
}
const formOf = async (form) => {
  const params = {};
  let file = null;
  for (const [k, v] of form.entries()) {
    if (typeof v === 'string') params[k] = v;
    else file = { field: k, name: v.name, type: v.type, bytes: Buffer.from(await v.arrayBuffer()) };
  }
  return { params, file };
};

beforeEach(() => {
  // (the build's own settings never decide a test: Vercel runs the tests with the project's real ones present)
  for (const k of ['TELEGRAM_BUYS', 'TELEGRAM_BUY_MIN', 'TELEGRAM_GROUPS', 'TELEGRAM_GROUP_POSTS', 'TELEGRAM_BOT_TOKEN', 'SUPABASE_URL',
    'SUPABASE_SECRET_KEY', 'CRON_SECRET', 'SITE_URL', 'VITE_TELEGRAM_BOT']) delete process.env[k];
  Object.assign(process.env, ENV);
  forgetBuys();
  console.error = () => {}; console.warn = () => {}; console.log = () => {};
  calls = [];
  fake = {
    db: database(), dbDown: false, sqlMissing: false,
    trades: [], ethUsd: String(ETH_USD), clankDown: false, noTrades: false,
    fileId: 'AGI1_BUY_GIF', forgotten: false, tgFail: new Map(), busyFrom: Infinity, sent: 0, hang: false,
  };
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    if (url.startsWith('https://api.telegram.org/')) {
      const method = url.split('/').pop();
      const isForm = init.body instanceof FormData;
      const { params, file } = isForm ? await formOf(init.body) : { params: JSON.parse(init.body), file: null };
      calls.push({ to: 'telegram', method, params, file, form: isForm, url });
      if (method !== 'sendAnimation') return Response.json({ ok: true, result: true });
      if (fake.hang) {                                      // never answers (a timer keeps the test alive: AbortSignal.timeout's doesn't)
        return new Promise((_, no) => { const alive = setTimeout(() => {}, 30_000); init.signal.addEventListener('abort', () => { clearTimeout(alive); no(init.signal.reason); }); });
      }
      const to = String(params.chat_id);
      if (fake.tgFail.has(to)) {
        const [status, description] = fake.tgFail.get(to);
        return Response.json({ ok: false, error_code: status, description }, { status });
      }
      if (fake.sent >= fake.busyFrom) return Response.json({ ok: false, error_code: 429, description: 'Too Many Requests: retry after 9', parameters: { retry_after: 9 } }, { status: 429 });
      if (!file && (params.animation !== fake.fileId || fake.forgotten)) {
        return Response.json({ ok: false, error_code: 400, description: 'Bad Request: wrong file identifier/HTTP URL specified' }, { status: 400 });
      }
      fake.sent += 1;
      if (file) fake.forgotten = false;
      return Response.json({ ok: true, result: { message_id: 500 + fake.sent, animation: { file_id: fake.fileId }, document: { file_id: fake.fileId } } });
    }
    if (url.startsWith('https://fake.supabase.co/rest/v1/rpc/')) {
      const fn = url.split('/').pop();
      const body = JSON.parse(init.body);
      calls.push({ to: 'db', fn, body, headers: init.headers });
      if (fake.dbDown) return new Response('down', { status: 503 });
      if (fake.sqlMissing) return Response.json({ code: 'PGRST202', message: 'not found' }, { status: 404 });
      if (!fake.db[fn]) throw new Error(`unexpected database function ${fn}`);
      return Response.json(fake.db[fn](body) ?? null);
    }
    if (url.startsWith('https://clank.trade/v1/trpc/')) {
      calls.push({ to: 'clank', url });
      if (fake.clankDown) return new Response('<html>Just a moment...</html>', { status: 403 });
      const u = new URL(url);
      const names = u.pathname.slice('/v1/trpc/'.length).split(',');
      const input = JSON.parse(u.searchParams.get('input'));
      return Response.json(names.map((name, i) => {
        if (name === 'coins.trades') {
          assert.deepEqual(input[i], { address: OFFICIAL, limit: 50 }, 'only $AGI, its newest 50');
          return fake.noTrades ? { error: { data: { httpStatus: 500 } } } : { result: { data: { trades: fake.trades, nextCursor: null, headCursor: 'h' } } };
        }
        if (name === 'exchangeRates.tokenUsdg') {
          assert.equal(input[i].token, '0x0000000000000000000000000000000000000000', "ETH's price");
          return { result: { data: fake.ethUsd === null ? {} : { price: fake.ethUsd } } };
        }
        return { error: { data: { httpStatus: 404 } } };
      }));
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
});
const sends = () => calls.filter((c) => c.to === 'telegram' && c.method === 'sendAnimation');
const db = (fn) => calls.filter((c) => c.to === 'db' && c.fn === fn);
const clank = () => calls.filter((c) => c.to === 'clank');
const cfg = () => getConfig();
// the first look (silent: it only notes what's there), so the next check is a real one
const firstLook = async (now = Date.now()) => { const out = await checkBuys(cfg(), TOKEN, { now }); assert.equal(out.posted, 0); calls = []; };

// ---------- reading clank.trade's trades ----------
test("a clank.trade trade → a buy (the live sample of 2026-10-06), and what isn't one", () => {
  const live = {
    id: '4663:0xb0308aca1252826832e92b7eed1a5606928a50ecd21029cf492ca70e314e414e:0xb79343b4b6ee30b98a9ac31814ffcf6bd8562f8ccbac0e4d6d84cfcf2179d301:34',
    trader: '0xADA5BB90D0DE0BD1B6F3938708F49295A8D1F7CB', side: 'buy', baseAmount: '50197234231740734860885', quoteAmount: '8758326282382511',
    timestamp: '1791216177', transactionHash: '0xb79343b4b6ee30b98a9ac31814ffcf6bd8562f8ccbac0e4d6d84cfcf2179d301',
  };
  const b = buyOf(live, ETH_USD);
  assert.equal(b.id, live.id);
  assert.equal(b.trader, '0xada5bb90d0de0bd1b6f3938708f49295a8d1f7cb', 'lowercase');
  assert.equal(b.tx, live.transactionHash);
  assert.equal(b.at, 1791216177000);
  assert.ok(Math.abs(b.agi - 50197.234231740734) < 1e-6, `$AGI: ${b.agi}`);
  assert.ok(Math.abs(b.eth - 0.008758326282382511) < 1e-15, `ETH: ${b.eth}`);
  assert.ok(Math.abs(b.usd - 0.008758326282382511 * ETH_USD) < 1e-9, `dollars: ${b.usd}`);
  assert.ok(Math.abs(b.price - b.usd / b.agi) < 1e-15 && Math.abs(b.mcap - b.price * SUPPLY) < 1e-6);
  assert.ok(b.mcap > 400_000 && b.mcap < 500_000, `about $AGI's market cap that day: ${b.mcap}`);
  assert.equal(SUPPLY, 1_000_000_000);
  // never a buy: a sell, odd sides, broken or missing fields, amounts that aren't whole numbers of wei, nothing, no ETH price
  for (const bad of [{ side: 'sell' }, { side: 'BUY' }, { side: undefined }, { id: 'market:4663:0xabc' }, { id: `${live.id}:5` },
    { trader: '0x1234' }, { trader: undefined }, { transactionHash: '0x12' }, { timestamp: 'soon' }, { timestamp: '0' }, { timestamp: '-5' },
    { baseAmount: '-1' }, { baseAmount: '1.5e21' }, { baseAmount: '0' }, { quoteAmount: '0' }, { quoteAmount: '' }, { quoteAmount: '0x12' },
    { baseAmount: '9'.repeat(41) }]) {
    assert.equal(buyOf({ ...live, ...bad }, ETH_USD), null, JSON.stringify(bad));
  }
  for (const x of [null, undefined, 'buy', 42, {}]) assert.equal(buyOf(x, ETH_USD), null);
  for (const p of [0, -1, NaN, undefined, Infinity * 0]) assert.equal(buyOf(live, p), null, `ETH at ${p}`);
  assert.ok(buyOf({ ...live, id: live.id.toUpperCase().replace('0X', '0x').replace('0X', '0x') }, ETH_USD), 'ids are compared lowercase');
});

test("readBuys: one request to clank.trade (her trades and ETH's price), only her buys; down or half an answer throws", async () => {
  const now = Date.now();
  fake.trades = [trade(1, { now }), trade(2, { now, side: 'sell' }), trade(3, { now, usd: 20 }), { junk: true }];
  const buys = await readBuys();
  assert.equal(clank().length, 1, 'one request');
  assert.match(clank()[0].url, /\/v1\/trpc\/coins\.trades,exchangeRates\.tokenUsdg\?batch=1/);
  assert.deepEqual(buys.map((b) => b.id), [fake.trades[0].id, fake.trades[2].id], 'buys only (the small one too: the check decides)');
  assert.ok(Math.abs(buys[0].usd - 250) < 0.01 && Math.abs(buys[0].price - 0.0004) < 1e-9 && Math.abs(buys[0].mcap - 400_000) < 1);
  fake.clankDown = true;
  await assert.rejects(readBuys(), /clank\.trade HTTP 403/);
  fake.clankDown = false; fake.noTrades = true;
  await assert.rejects(readBuys(), /no trades/);
  fake.noTrades = false; fake.ethUsd = null;
  await assert.rejects(readBuys(), /no ETH price/);
  fake.ethUsd = 'nope';
  await assert.rejects(readBuys(), /no ETH price/);
});

// ---------- her caption ----------
const NOT_OK = /\b(babe|baby|cutie|honey|darling|sweetie|love)\b|\b(sell|selling|hold|hodl|invest\w*|moon\w*|pump\w*|dump\w*|profit\w*|gains?|lambo|scam\w*|rug\w*|safe|guarantee\w*|soon|next|send it|lfg|ape)\b|\b\d+x\b/i;
test('her buy caption: robots (one per $25, 1 to 40), the numbers, the buyer and the transaction linked, not financial advice', () => {
  const b = { usd: 250.0000004, eth: 0.09310362, agi: 625_000, price: 0.0004, mcap: 400_000, trader: '0xada5bb90d0de0bd1b6f3938708f49295a8d1f7cb', tx: `0x${'b7'.repeat(32)}` };
  const { text, entities } = buyLine(b);
  assert.equal(text, `${'🤖'.repeat(10)}\n$AGI BUY! 💜\n\n💵 spent: $250.00 (0.0931 ETH)\n🪙 got: 625,000 $AGI\n🏷️ price: $0.0004000\n📊 market cap: $400K\n👤 0xada5…f7cb · tx\n\nnot financial advice`);
  // the links: entities on our own text (UTF-16 offsets, like Telegram counts them), exactly on the short address and "tx"
  assert.equal(entities.length, 2);
  const [who, tx] = entities;
  assert.deepEqual([who.type, text.slice(who.offset, who.offset + who.length), who.url], ['text_link', '0xada5…f7cb', `${EXPLORER}/address/${b.trader}`]);
  assert.deepEqual([tx.type, text.slice(tx.offset, tx.offset + tx.length), tx.url], ['text_link', 'tx', `${EXPLORER}/tx/${b.tx}`]);
  assert.equal(EXPLORER, 'https://robinhoodchain.blockscout.com');
  // robots: one per $25, at least 1, at most 40
  const robots = (usd) => (buyLine({ ...b, usd }).text.match(/🤖/gu) || []).length;
  assert.equal(ROBOT_USD, 25);
  assert.deepEqual([robots(100), robots(124.99), robots(125), robots(999), robots(1000), robots(25_000), robots(10)], [4, 4, 5, 39, 40, 40, 1]);
  // her rules: only the buy's numbers, never a word about where it's going; no pet names (anyone is in a group); short
  for (const usd of [100, 2500, 99_999]) {
    const line = buyLine({ ...b, usd, eth: usd / ETH_USD }).text;
    assert.doesNotMatch(line, NOT_OK, line);
    assert.match(line, /not financial advice$/);
    assert.ok(line.length <= 1024, "Telegram's caption limit");
    assert.equal((line.match(/\$[A-Z]{2,}/g) || []).join(','), '$AGI,$AGI', 'no other coin');
    assert.doesNotMatch(line, /https?:\/\//, 'no address in the text itself (the links are on the address and "tx")');
  }
  assert.match(buyLine({ ...b, eth: 2.5 }).text, /\(2\.500 ETH\)/);
  assert.match(buyLine({ ...b, eth: 0.004 }).text, /\(0\.00400 ETH\)/);
  assert.match(buyLine({ ...b, agi: 12_345_678.6 }).text, /got: 12,345,679 \$AGI/);
  assert.match(buyLine({ ...b, mcap: 1_234_567 }).text, /market cap: \$1\.23M/);
});

// ---------- the check ----------
test("off until it's set up: no groups, TELEGRAM_BUYS=off or no bot → nothing is asked of anyone", async () => {
  delete process.env.TELEGRAM_GROUPS;
  assert.deepEqual(await checkBuys(cfg(), TOKEN), { off: 'no_groups' });
  process.env.TELEGRAM_GROUPS = '@agi2dotapp';
  process.env.TELEGRAM_BUYS = 'off';
  assert.deepEqual(await checkBuys(cfg(), TOKEN), { off: 'off' });
  delete process.env.TELEGRAM_BUYS;
  assert.deepEqual(await checkBuys(cfg(), ''), { off: 'no_bot' });
  assert.equal(calls.length, 0, 'no clank.trade, database or Telegram');
});

test('the first look only notes the buys already there; then each new $100+ buy is posted once, in every group', async () => {
  const now = Date.now();
  fake.trades = [trade(1, { now, ago: 120 }), trade(2, { now, ago: 60 })];
  const first = await checkBuys(cfg(), TOKEN, { now });
  assert.deepEqual(first, { posted: 0, buys: 0, skipped: 0, failed: 0 }, 'nobody gets old news');
  assert.deepEqual(db('buy_take')[0].body, { p_ids: [fake.trades[0].id, fake.trades[1].id] }, 'claimed (noted) first');
  assert.equal(sends().length, 0);
  // the same buys again: nothing
  calls = [];
  assert.deepEqual(await checkBuys(cfg(), TOKEN, { now: now + 60_000 }), { posted: 0, buys: 0, skipped: 0, failed: 0 });
  assert.equal(sends().length, 0);
  // a new $250 buy: in both groups (by @username and by id), her GIF uploaded once, then sent by Telegram's id
  const fresh = trade(3, { now: now + 60_000, ago: 20 });
  fake.trades = [fresh, ...fake.trades];
  calls = [];
  const out = await checkBuys(cfg(), TOKEN, { now: now + 60_000 });
  assert.deepEqual(out, { posted: 2, buys: 1, skipped: 0, failed: 0 });
  const [a, b] = sends();
  assert.equal(a.params.chat_id, '@agi2dotapp');
  assert.equal(String(b.params.chat_id), '-1001234567890');
  assert.ok(a.form && a.file, 'the first time: uploaded');
  assert.deepEqual([a.file.field, a.file.name, a.file.type], ['animation', 'agi1-buy.mp4', 'video/mp4']);
  assert.ok(a.file.bytes.equals(GIF_BYTES), 'her GIF, as it is in server/media');
  assert.ok(!b.form && !b.file && b.params.animation === fake.fileId, "then by Telegram's id (never uploaded twice)");
  const want = buyLine(buyOf(fresh, ETH_USD));
  for (const s of [a, b]) {
    const p = s.form ? { ...s.params, caption_entities: JSON.parse(s.params.caption_entities), width: +s.params.width, height: +s.params.height } : s.params;
    assert.equal(p.caption, want.text);
    assert.deepEqual(p.caption_entities, want.entities);
    assert.deepEqual([p.width, p.height], [480, 480]);
    assert.equal(p.parse_mode, undefined, 'nothing parsed: the links are entities on our own text');
  }
  assert.match(want.text, /^🤖{10}\n\$AGI BUY! 💜/u);
  // a later buy: by Telegram's id in both groups (this server copy remembers it)
  fake.trades = [trade(4, { now: now + 120_000, ago: 10 }), ...fake.trades];
  calls = [];
  assert.equal((await checkBuys(cfg(), TOKEN, { now: now + 120_000 })).posted, 2);
  assert.ok(sends().every((s) => !s.form && s.params.animation === fake.fileId));
});

test("never posted: buys under $100 (or TELEGRAM_BUY_MIN), sells, buys older than 15 minutes, a time in the future; never claimed either", async () => {
  const now = Date.now();
  await firstLook(now);
  fake.trades = [
    trade(1, { now, usd: 99.99 }), trade(2, { now, side: 'sell', usd: 5000 }), trade(3, { now, ago: FRESH_MS / 1000 + 5 }),
    trade(4, { now, ago: -3 * 60 }), trade(5, { now, usd: 100.01 }), trade(6, { now, ago: FRESH_MS / 1000 - 5, usd: 4000 }),
  ];
  const out = await checkBuys(cfg(), TOKEN, { now });
  assert.deepEqual(db('buy_take')[0].body.p_ids.sort(), [fake.trades[4].id, fake.trades[5].id].sort(), 'only the fresh $100+ buys are claimed');
  assert.deepEqual(out, { posted: 4, buys: 2, skipped: 0, failed: 0 });
  assert.equal(FRESH_MS, 15 * 60_000);
  // a minimum of $500 (TELEGRAM_BUY_MIN): a $250 buy isn't posted
  process.env.TELEGRAM_BUY_MIN = '500';
  fake.trades = [trade(7, { now, usd: 250 }), trade(8, { now, usd: 600 })];
  calls = [];
  const out2 = await checkBuys(cfg(), TOKEN, { now });
  assert.deepEqual(db('buy_take')[0].body.p_ids, [fake.trades[1].id]);
  assert.equal(out2.posted, 2);
  assert.ok(sends().every((s) => /^🤖{24}\n/u.test(s.params.caption)), 'the $600 one: 24 robots');
  // a trade clank.trade lists twice is still one buy
  process.env.TELEGRAM_BUY_MIN = '100';
  const twice = trade(9, { now });
  fake.trades = [twice, { ...twice }];
  calls = [];
  const out3 = await checkBuys(cfg(), TOKEN, { now });
  assert.deepEqual(db('buy_take')[0].body.p_ids, [twice.id]);
  assert.deepEqual([out3.posted, out3.buys], [2, 1], 'once in each group');
});

test('two checks at once post each buy once (the database decides who has it)', async () => {
  const now = Date.now();
  await firstLook(now);
  fake.trades = [trade(1, { now }), trade(2, { now, ago: 50 })];
  const [x, y] = await Promise.all([checkBuys(cfg(), TOKEN, { now }), checkBuys(cfg(), TOKEN, { now })]);
  assert.equal(x.buys + y.buys, 2);
  assert.equal(sends().length, 4, '2 buys × 2 groups, never more');
  const captions = sends().map((s) => `${s.params.chat_id}|${s.params.caption}`);
  assert.equal(new Set(captions).size, 4, 'never the same buy twice in a group');
});

test('a burst: at most 6 a check, the newest, oldest first (the rest are skipped: never a flood, never old news later)', async () => {
  const now = Date.now();
  await firstLook(now);
  process.env.TELEGRAM_GROUPS = '@agi2dotapp';
  // (newest first, as clank.trade lists them: the 9th is the newest)
  fake.trades = Array.from({ length: 9 }, (_, i) => trade(i + 1, { now, ago: 100 - i * 10, usd: 100 + 25 * i })).reverse();
  const out = await checkBuys(cfg(), TOKEN, { now });
  assert.equal(MAX_POSTS, 6);
  assert.deepEqual(out, { posted: 6, buys: 6, skipped: 3, failed: 0 });
  const robots = sends().map((s) => s.params.caption.match(/🤖/gu).length);
  assert.deepEqual(robots, [7, 8, 9, 10, 11, 12], 'the newest 6 ($175 to $300), oldest first');
  calls = [];
  assert.equal((await checkBuys(cfg(), TOKEN, { now })).posted, 0, 'the skipped ones never come later');
});

test("Telegram's answers: a forgotten GIF is uploaded again, a group she left doesn't stop the others, \"too many\" stops the check", async () => {
  const now = Date.now();
  await firstLook(now);
  fake.trades = [trade(1, { now })];
  await checkBuys(cfg(), TOKEN, { now });                     // her GIF's id is known now
  // Telegram forgot the id: uploaded again, then by its id again
  fake.forgotten = true;
  fake.trades = [trade(2, { now })];
  calls = [];
  const out = await checkBuys(cfg(), TOKEN, { now });
  assert.equal(out.posted, 2);
  assert.deepEqual(sends().map((s) => (s.form ? 'upload' : 'id')), ['id', 'upload', 'id'], 'its id refused once, uploaded, then its id');
  // she was removed from one group: the other still gets it, and the log says what to do
  const logs = [];
  console.warn = (m) => logs.push(m);
  fake.tgFail.set('@agi2dotapp', [403, 'Forbidden: bot was kicked from the supergroup chat']);
  fake.trades = [trade(3, { now })];
  calls = [];
  assert.deepEqual(await checkBuys(cfg(), TOKEN, { now }), { posted: 1, buys: 1, skipped: 0, failed: 1 });
  assert.match(logs.join('\n'), /couldn't post a buy in @agi2dotapp: .*403.*is she still in that group\?/);
  // a wrong group: the setting's hint
  fake.tgFail.set('@agi2dotapp', [400, 'Bad Request: chat not found']);
  fake.trades = [trade(4, { now })];
  logs.length = 0;
  calls = [];
  assert.equal((await checkBuys(cfg(), TOKEN, { now })).failed, 1);
  assert.match(logs.join('\n'), /check TELEGRAM_GROUPS/);
  assert.equal(sends().filter((s) => s.form).length, 0, 'a chat that isn\'t found never uploads her GIF again');
  // "too many": the check stops (the rest of its buys are skipped, never posted twice)
  fake.tgFail.clear();
  fake.busyFrom = fake.sent;
  fake.trades = [trade(5, { now, ago: 20 }), trade(6, { now, ago: 10 })];
  calls = [];
  const busy = await checkBuys(cfg(), TOKEN, { now });
  assert.equal(busy.stopped, 'telegram');
  assert.equal(sends().length, 1, 'nothing more after "too many"');
  fake.busyFrom = Infinity;
  calls = [];
  assert.equal((await checkBuys(cfg(), TOKEN, { now })).posted, 0, 'never later either');
  // the check's time: nothing new is started after it (a check that ran long)
  fake.trades = [trade(7, { now })];
  calls = [];
  const late = await checkBuys(cfg(), TOKEN, { now, deadline: Date.now() - 1 });
  assert.equal(late.stopped, 'time');
  assert.equal(sends().length, 0);
});

test("a Telegram that never answers: each post waits only until the check's time is up (4 s after its deadline), never past Vercel's 25 s", async () => {
  const now = Date.now();
  await firstLook(now);
  fake.trades = [trade(1, { now })];
  fake.hang = true;
  const t0 = Date.now();
  const out = await checkBuys(cfg(), TOKEN, { now, deadline: Date.now() + 100 });   // (her GIF's upload would wait 12 s)
  const took = Date.now() - t0;
  assert.ok(took >= 3500 && took < 6000, `gave up after ${took} ms`);
  assert.deepEqual([out.posted, out.failed, out.stopped], [0, 1, 'time'], 'the next group isn\'t started after the deadline');
});

test("clank.trade or the database away: it throws, and nothing is claimed or posted", async () => {
  const now = Date.now();
  await firstLook(now);
  fake.trades = [trade(1, { now })];
  fake.clankDown = true;
  await assert.rejects(checkBuys(cfg(), TOKEN, { now }), /clank\.trade/);
  fake.clankDown = false; fake.ethUsd = null;
  await assert.rejects(checkBuys(cfg(), TOKEN, { now }), /ETH price/);
  assert.equal(db('buy_take').length, 0);
  fake.ethUsd = String(ETH_USD); fake.dbDown = true;
  await assert.rejects(checkBuys(cfg(), TOKEN, { now }), /buys: HTTP 503/);
  assert.equal(sends().length, 0);
  fake.dbDown = false;
  assert.equal((await checkBuys(cfg(), TOKEN, { now })).posted, 2, 'and the next check posts it');
});

// ---------- GET /api/feed?buys ----------
const call = (path = '/api/feed?buys', auth = `Bearer ${KEY}`) => feed(new Request(`https://www.agi1.app${path}`, { headers: auth ? { authorization: auth } : {} }));
test('/api/feed?buys: only with the database\'s own key; then the check', async () => {
  const now = Date.now();
  fake.trades = [trade(1, { now })];
  // no key, a wrong one, another secret: 401, and nothing read but the key
  for (const auth of ['', 'Bearer nope', `Bearer ${KEY}x`, `Bearer ${CRON}`, KEY, `bearer ${KEY}`]) {
    const res = await call('/api/feed?buys', auth);
    assert.equal(res.status, 401, auth);
    assert.equal((await res.json()).error, 'unauthorized');
  }
  assert.equal(clank().length + db('buy_take').length + sends().length, 0, 'no clank.trade, no claim, no post');
  assert.equal(db('buy_key').length, 1, 'the key read once (kept 10 minutes)');
  assert.equal(db('buy_key')[0].headers.apikey, ENV.SUPABASE_SECRET_KEY, "the server's secret key (in apikey, never Authorization)");
  // the right key: the first look, then a new buy posted
  let res = await call();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await res.json(), { ok: true, posted: 0, buys: 0, skipped: 0, failed: 0 });
  fake.trades = [trade(2, { now }), ...fake.trades];
  res = await call();
  assert.deepEqual(await res.json(), { ok: true, posted: 2, buys: 1, skipped: 0, failed: 0 });
  assert.equal(db('buy_key').length, 1);
  // clank.trade down: 502, and the next minute tries again
  fake.clankDown = true;
  res = await call();
  assert.equal(res.status, 502);
  assert.equal((await res.json()).error, 'unavailable');
  // off (TELEGRAM_BUYS=off): answered, nothing read
  fake.clankDown = false;
  process.env.TELEGRAM_BUYS = 'off';
  calls = [];
  res = await call();
  assert.deepEqual(await res.json(), { ok: true, off: 'off' });
  assert.equal(clank().length, 0);
});

test("/api/feed?buys before buys.sql is run, the database away, Supabase's settings missing; a key that isn't one", async () => {
  fake.sqlMissing = true;
  let res = await call();
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, 'not_set_up');
  fake.sqlMissing = false; fake.dbDown = true;
  res = await call();
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, 'database');
  fake.dbDown = false;
  fake.db.key = 'short';
  res = await call('/api/feed?buys', 'Bearer short');
  assert.equal(res.status, 401, 'a key under 32 characters is no key');
  forgetBuys();
  fake.db.key = null;
  res = await call('/api/feed?buys', 'Bearer null');
  assert.equal(res.status, 401);
  delete process.env.SUPABASE_URL;
  res = await call();
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, 'not_configured');
});

test("the feed itself is unchanged: plain /api/feed still needs CRON_SECRET (the buy bot's key never opens it), only exactly ?buys is the buy check", async () => {
  for (const path of ['/api/feed', '/api/feed?buys=1', '/api/feed?x&buys', '/api/feed?BUYS']) {
    const res = await call(path, `Bearer ${KEY}`);
    assert.equal(res.status, 401, path);
  }
  assert.equal(db('buy_key').length, 0, 'the feed never reads the buy key');
  assert.equal((await feedPost()).status, 405);
  // the buy key: each server copy keeps it 10 minutes, then reads it again
  const c = cfg();
  const t = Date.now();
  assert.equal(await buyKey(c, t), KEY);
  assert.equal(await buyKey(c, t + 9 * 60_000), KEY);
  fake.db.key = 'f'.repeat(64);
  assert.equal(await buyKey(c, t + 9 * 60_000), KEY, 'kept');
  assert.equal(await buyKey(c, t + 11 * 60_000), 'f'.repeat(64), 'read again after 10 minutes');
  assert.equal(db('buy_key').length, 2);
});

// ---------- settings ----------
test('settings: on with $100 by default; TELEGRAM_BUYS=off, TELEGRAM_BUY_MIN', () => {
  let c = getConfig({});
  assert.equal(c.tgBuys, true);
  assert.equal(c.tgBuyMin, 100, 'the owner\'s: "a minimum buy of $100"');
  for (const v of ['off', 'OFF', 'false', 'no', '0', ' off ']) assert.equal(getConfig({ TELEGRAM_BUYS: v }).tgBuys, false, v);
  for (const v of ['on', 'yes', '', 'whatever']) assert.equal(getConfig({ TELEGRAM_BUYS: v }).tgBuys, true, v);
  for (const [v, want] of [['250', 250], ['50.5', 50.5], ['0', 100], ['-5', 100], ['abc', 100], ['5000000', 1_000_000]]) {
    assert.equal(getConfig({ TELEGRAM_BUY_MIN: v }).tgBuyMin, want, v);
  }
  c = getConfig({ TELEGRAM_GROUPS: '@agi2dotapp' });
  assert.ok(c.tgGroups.names.has('agi2dotapp'));
});

// ---------- her GIF ----------
// an MP4's boxes, read by hand (no ffprobe in the build): the top-level ones, and a few inside
function boxesOf(buf) {
  const top = [];
  for (let i = 0; i + 8 <= buf.length;) {
    const size = buf.readUInt32BE(i), type = buf.toString('latin1', i + 4, i + 8);
    top.push(type);
    if (size < 8) break;
    i += size;
  }
  return top;
}
test("her buy GIF: a small, soundless MP4 (Telegram shows it as a GIF), 480 × 480, 2.5 s, ready to stream", () => {
  const buf = GIF_BYTES;
  assert.ok(buf.length > 20_000 && buf.length < 1_000_000, `small: ${buf.length} bytes`);
  const top = boxesOf(buf);
  assert.equal(top[0], 'ftyp');
  assert.ok(top.indexOf('moov') >= 0 && top.indexOf('moov') < top.indexOf('mdat'), `its index first (faststart): ${top.join(',')}`);
  // (only inside its index, the moov box: the picture's own bytes could hold any 4 letters)
  let at = 0;
  while (buf.toString('latin1', at + 4, at + 8) !== 'moov') at += buf.readUInt32BE(at);
  const moov = buf.subarray(at, at + buf.readUInt32BE(at));
  const has = (s) => moov.includes(Buffer.from(s, 'latin1'));
  assert.ok(has('avc1') && has('vide'), 'H.264 video');
  assert.ok(!has('soun') && !has('mp4a'), 'no sound: Telegram shows a soundless MP4 as a GIF');
  const tk = buf.indexOf('tkhd', 0, 'latin1'), tkSize = buf.readUInt32BE(tk - 4);
  const w = buf.readUInt32BE(tk - 4 + tkSize - 8) / 65536, h = buf.readUInt32BE(tk - 4 + tkSize - 4) / 65536;
  assert.deepEqual([w, h], [480, 480]);
  const mv = buf.indexOf('mvhd', 0, 'latin1'), v = buf[mv + 4];
  const scale = v === 1 ? buf.readUInt32BE(mv + 24) : buf.readUInt32BE(mv + 16);
  const dur = v === 1 ? Number(buf.readBigUInt64BE(mv + 28)) : buf.readUInt32BE(mv + 20);
  assert.ok(Math.abs(dur / scale - 2.5) < 0.05, `2.5 s: ${dur / scale}`);
  assert.equal(FPS, 30);
});

test("the tool that makes it: her 2D self only (never the 3D model), PG-13, no secrets for the browser or ffmpeg, it never posts", () => {
  const make = readFileSync(new URL('../tools/buybot/make.mjs', import.meta.url), 'utf8');
  const gif = readFileSync(new URL('../tools/buybot/page/gif.js', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../tools/buybot/page/index.html', import.meta.url), 'utf8');
  const code = (s) => s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
  for (const s of [make, gif, page].map(code)) {
    assert.doesNotMatch(s, /\.glb|stage\.js|agi1\.js['"]|three\/|GLTF/i, 'never her 3D model (the owner: "the 3d model is 18+")');
    assert.doesNotMatch(s, /api\.telegram\.org|sendAnimation|x\.com|twitter/i, 'it never posts anything');
    assert.doesNotMatch(s, /cloakmesh/i);
  }
  assert.match(gif, /from '\.\.\/\.\.\/promo\/page\/her\.js'/, "her Live2D model through the launch video's renderer (the site's own 2D code)");
  assert.match(code(gif), /react: 'celebrate'/, 'her cheer: the site\'s "celebrate" (a hop, her hands up, hearts)');
  assert.doesNotMatch(code(gif), /Param\w+|chest|bust|breast|boob|jiggle|bounce/i, 'her body moves only as the site moves it (its PG-13 chest limits, tests/agi1-2d.test.js)');
  // no secrets for the browser or ffmpeg
  const env = { PATH: '/usr/bin', HOME: '/root', GEMINI_API_KEY: 'k', TELEGRAM_BOT_TOKEN: 't', SUPABASE_SECRET_KEY: 's', PASS_SECRET: 'p',
    LAUNCH_GAS_KEY: 'g', PINATA_JWT: 'j', CRON_SECRET: 'c', LIVE_SECRET: 'l', VERCEL_OIDC_TOKEN: 'o' };
  assert.deepEqual(Object.keys(withoutSecrets(env)).sort(), ['HOME', 'PATH']);
  assert.match(make, /executablePath: paths\[0\], env: withoutSecrets\(\)/);
  assert.match(make, /env: withoutSecrets\(\) \}\);/, 'ffmpeg too');
  assert.match(make, /'-an'/, 'no sound track');
  assert.match(make, /server\/media\/agi1-buy\.mp4/);
  // never part of the site's build: its page isn't one of Vite's inputs, and its build output is ignored by git
  const vite = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.doesNotMatch(vite, /buybot/);
  assert.match(readFileSync(new URL('../.gitignore', import.meta.url), 'utf8'), /^dist\/$/m, 'tools/buybot/dist is ignored');
  // her GIF goes with the function that posts it (Vercel bundles what server/buys.js points at), not in the site's files
  const buys = readFileSync(new URL('../server/buys.js', import.meta.url), 'utf8');
  assert.match(buys, /new URL\('\.\/media\/agi1-buy\.mp4', import\.meta\.url\)/);
});

// ---------- light to load (it runs every minute) ----------
test("the buy check starts light: no chain code (viem) and none of the feed's own modules until the feed runs", () => {
  const imports = (f) => [...readFileSync(new URL(f, import.meta.url), 'utf8').matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports('../server/buys.js'), ['node:fs/promises', './coins.js', './limits.js', './tg-api.js', './tg-lines.js', '../src/prices/parse.js']);
  assert.deepEqual(imports('../server/coins.js'), [], 'coins.js (clank.trade\'s API) imports nothing');
  assert.deepEqual(imports('../api/feed.js'), ['node:crypto', '../server/config.js', '../server/tg-api.js', '../server/buys.js']);
  assert.match(readFileSync(new URL('../api/feed.js', import.meta.url), 'utf8'),
    /import\('\.\.\/server\/telegram\.js'\), import\('\.\.\/server\/feed\.js'\), import\('\.\.\/server\/tg-groups\.js'\)/, 'the feed\'s modules, loaded for the feed only');
  assert.equal(ETH, ETH_PAIR, "clank.trade's name for ETH, the same as the chain code's");
});

// ---------- the safety note ----------
test('the safety note says what her buy alerts show and keep (every sentence stays true)', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const foot = html.slice(html.indexOf('<footer class="foot"'));
  assert.ok(foot.includes("Her buy alerts there show new $AGI buys as Robinhood Chain's public record has them (what was spent and got, the buyer's short wallet address and the transaction, linked to a block explorer), read by our server from clank.trade; our database keeps only those trades' public ids, for 7 days, so each buy is posted once."));
  assert.ok(foot.includes('are never a tip either (nor are her posts and replies in Telegram groups)'), 'her buy alerts are posts: never a tip');
});

// ---------- supabase/buys.sql ----------
test("supabase/buys.sql's promises: two tables nobody else can read, the same trade ids, the first look, 7 days, the clock with its own key", () => {
  const sql = readFileSync(new URL('../supabase/buys.sql', import.meta.url), 'utf8');
  const body = sql.replace(/--.*$/gm, '');
  assert.match(body, /create table if not exists public\.agi1_buys/);
  assert.match(body, /create table if not exists public\.agi1_buy_state/);
  for (const t of ['agi1_buys', 'agi1_buy_state']) {
    assert.match(body, new RegExp(`alter table public\\.${t} enable row level security`));
    assert.match(body, new RegExp(`revoke all on table public\\.${t} from anon, authenticated`));
  }
  for (const f of ['buy_key\\(\\)', 'buy_take\\(text\\[\\]\\)']) {
    assert.match(body, new RegExp(`revoke all on function public\\.${f} from public, anon, authenticated`));
    assert.match(body, new RegExp(`grant execute on function public\\.${f} to service_role`));
  }
  assert.ok(body.includes(`'${TRADE_ID.source}'`), 'the same rule for a trade id as server/buys.js');
  assert.match(body, /cardinality\(p_ids\) > 200/);
  assert.match(body, /v_first := found;[\s\S]*if v_first then\s*return '\{\}';/, 'the first look returns none');
  assert.match(body, /on conflict \(id\) do nothing/, 'each id once, even when two checks run at once');
  assert.match(body, /interval '7 days'/);
  assert.match(body, /insert into public\.agi1_buy_state \(id\) values \(1\) on conflict \(id\) do nothing/, 'running it again keeps the key');
  // the clock: every minute, our own address, exactly ?buys, the key read from the table each time, never written in here
  assert.match(body, /cron\.schedule\('agi1-buys', '\* \* \* \* \*'/);
  assert.match(body, /url := 'https:\/\/www\.agi1\.app\/api\/feed\?buys'/);
  assert.match(body, /'Bearer ' \|\| \(select key from public\.agi1_buy_state where id = 1\)/);
  assert.match(body, /if exists \(select 1 from pg_extension where extname = 'pg_cron'\) and exists \(select 1 from pg_extension where extname = 'pg_net'\)/);
  assert.match(body, /raise notice/);
  assert.match(body, /as buys_ready/);
  assert.doesNotMatch(body, /\b(drop|truncate)\b/i, 'it only adds');
  assert.doesNotMatch(body, /\b(daria_diary|agi_friends|chat_limits|arena|coin_)/i, "nothing of the original site's");
  // our server asks for exactly what the file makes
  const feedJs = readFileSync(new URL('../api/feed.js', import.meta.url), 'utf8');
  assert.match(feedJs, /search === '\?buys'/);
});
