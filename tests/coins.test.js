// Phase 6 tests: nominating clank.trade coins for the Arena, voting them in, logos, the dynamic coin list and the
// keep-alive's liquidity check. Supabase, Turnstile, clank.trade, DexScreener and Pinata are faked. Run: npm test
// The SQL itself (supabase/coins.sql) was tested separately in a real Postgres (PGlite): see CLAUDE.md.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { POST as coinsPost, GET as coinsGet } from '../api/coins.js';
import { GET as logoGet } from '../api/logo.js';
import { GET as arenaGet } from '../api/arena.js';
import { POST as votePost } from '../api/vote.js';
import { GET as keepalive } from '../api/keepalive.js';
import { parseCoinInput, buyLink } from '../src/prices/parse.js';
import {
  cleanSymbol, cleanName, fitToShow, safeLogoUrl, logoFetchUrl, logoUrls, checkClank, checkDex, forgetActiveSymbols, NEED,
} from '../server/coins.js';
import { makePass, visitorCode } from '../server/security.js';
import { coinBurst, voteBurst, votedThisRound } from '../server/burst.js';

const SECRET = 'test-pass-secret-that-is-long-enough-1234';
const ENV = { SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fake_key_123', TURNSTILE_SECRET_KEY: 'ts-secret', PASS_SECRET: SECRET, CRON_SECRET: 'cron-secret-0123456789abcdef' };
const AGI = '0xfa31d04462746aaa24bc7e5626403e09e4b106ec';
const CABO = '0xcf5b720f33febdc1c9d4880b8317203b63fdf368';
const CAT = '0x03e6a6881d0813bf6157ac4ee44d3cc73d5465a3';
const PEPE = '0x1111111111111111111111111111111111111111';
const NEWC = '0x2222222222222222222222222222222222222222';
const CID = 'bafkreiafwbd4ubvjr3e4obtmgaf4a6ce2pzmz3zfrta3xqnfxlz7vs57uu';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);

const clankHtml = ({ name, symbol, cid = CID }) => `<!doctype html><html><head><meta charset="utf-8"><title>${name} (${symbol}) · Clank.trade</title></head>
<body><img src="https://clank.trade/assets/images/clank-trade.svg"><img alt="${name}" src="https://yellow-total-guanaco-389.mypinata.cloud/ipfs/${cid}?img-width=128&amp;img-height=128&amp;img-fit=cover&amp;img-quality=100&amp;img-format=webp"></body></html>`;
const pair = (address, liquidity, extra = {}) => ({ chainId: 'robinhood', dexId: 'uniswap', baseToken: { address, symbol: 'X', name: 'X' }, priceUsd: '0.0001', liquidity: { usd: liquidity }, ...extra });

let calls, fake;
beforeEach(() => {
  Object.assign(process.env, ENV);
  calls = [];
  coinBurst.reset(); voteBurst.reset(); votedThisRound.reset(); forgetActiveSymbols();
  console.error = () => {}; console.warn = () => {}; console.log = () => {};
  const coin = (address, symbol, name, logo, status, votes = []) => [address, { address, symbol, name, logo, status, votes: new Set(votes) }];
  fake = {
    coinsSql: true,
    coins: new Map([
      coin(AGI, 'AGI', 'Artificial Girlfriend Intelligence', '/images/coins/agi.webp', 'core'),
      coin(CABO, 'CABO', 'CABO the cat', '/images/coins/cabo.webp', 'core'),
      coin(CAT, 'CLANKCAT', 'Clank Cat', '/images/coins/clankcat.webp', 'listed'),
      coin(PEPE, 'PEPE', 'Pepe', `https://yellow-total-guanaco-389.mypinata.cloud/ipfs/${CID}`, 'candidate', ['a', 'b']),
    ]),
    nominateAnswer: null,                                   // set to force what coin_nominate answers
    clank: { [NEWC]: { html: clankHtml({ name: 'New &amp; Shiny', symbol: 'SHINY' }) } },
    dex: { [NEWC]: [pair(NEWC, 12_000)] },
    images: { [`https://yellow-total-guanaco-389.mypinata.cloud/ipfs/${CID}`]: { type: 'image/webp', body: WEBP } },
  };
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, body, headers: init.headers });
    if (url.startsWith('https://challenges.cloudflare.com/')) return Response.json({ success: body.response === 'good-token', action: 'vote' });
    if (url.includes('/rest/v1/rpc/coin_')) {
      if (!fake.coinsSql) return Response.json({ code: 'PGRST202', message: 'not found' }, { status: 404 });
      const fn = url.split('/').pop(), C = fake.coins;
      const view = (c) => ({ address: c.address, symbol: c.symbol, name: c.name, logo: c.logo, status: c.status, listed_at: null });
      if (fn === 'coin_active') return Response.json([...C.values()].filter((c) => ['core', 'listed'].includes(c.status)).map((c) => c.symbol).sort());
      if (fn === 'coin_logo') { const c = C.get(body.p_address); return Response.json(c && ['core', 'listed', 'retired'].includes(c.status) ? c.logo : null); }
      if (fn === 'coin_board') {
        return Response.json({
          coins: [...C.values()].filter((c) => ['core', 'listed'].includes(c.status)).map(view),
          retired: [...C.values()].filter((c) => c.status === 'retired').map(view),
          candidates: [...C.values()].filter((c) => c.status === 'candidate' && c.votes.size).map((c) => ({ address: c.address, symbol: c.symbol, name: c.name, votes: c.votes.size })),
        });
      }
      if (fn === 'coin_retire') { let n = 0; for (const a of body.p_addresses) { const c = C.get(a); if (c?.status === 'listed') { c.status = 'retired'; n++; } } return Response.json(n); }
      const vote = (address, who) => {
        const c = C.get(address);
        if (!c) return { result: 'unknown' };
        if (['hidden', 'retired'].includes(c.status)) return { result: c.status, symbol: c.symbol };
        if (['core', 'listed'].includes(c.status)) return { result: 'listed', symbol: c.symbol };
        if (c.votes.has(who)) return { result: 'already', symbol: c.symbol, votes: c.votes.size };
        c.votes.add(who);
        if (c.votes.size >= body.p_need) { c.status = 'listed'; return { result: 'added', symbol: c.symbol, votes: c.votes.size }; }
        return { result: 'ok', symbol: c.symbol, votes: c.votes.size };
      };
      if (fn === 'coin_vote') return Response.json(vote(body.p_address, body.p_who));
      if (fn === 'coin_nominate') {
        if (fake.nominateAnswer) return Response.json(fake.nominateAnswer);
        C.set(body.p_address, { address: body.p_address, symbol: body.p_symbol, name: body.p_name, logo: body.p_logo, status: 'candidate', votes: new Set() });
        return Response.json({ ...vote(body.p_address, body.p_who), nominated: true });
      }
    }
    if (url.endsWith('/rest/v1/rpc/arena_state')) return Response.json({ tally: {}, recent: [], crowns: {}, week: {} });
    if (url.endsWith('/rest/v1/rpc/arena_vote')) return Response.json(body.p_coins.includes(body.p_coin) ? 'ok' : 'bad_coin');
    if (url.includes('/rest/v1/chat_usage')) return Response.json([]);
    if (url.includes('/rest/v1/rpc/diary_')) return Response.json(false);
    if (url.startsWith('https://clank.trade/coin/')) {
      const page = fake.clank[url.split('/').pop()];
      if (page?.status) return new Response(page.html || 'nope', { status: page.status });
      return new Response(page?.html ?? '<html><head><title>Coin not found · Clank.trade</title></head></html>', { headers: { 'content-type': 'text/html' } });
    }
    if (url.startsWith('https://api.dexscreener.com/tokens/v1/robinhood/')) {
      if (fake.dexDown) return new Response('busy', { status: 429 });
      return Response.json(url.split('/').pop().split(',').flatMap((a) => fake.dex[a] || []));
    }
    if (url.includes('.mypinata.cloud/') || url.includes('dexscreener.com/cms/')) {
      const img = fake.images[url.split('?')[0]];
      if (!img) return new Response('missing', { status: 404 });
      return new Response(img.body, { headers: { 'content-type': img.type } });
    }
    throw new Error('unexpected request to ' + url);
  };
});

const post = async (payload, { ip = '1.2.3.4', type = 'application/json', raw } = {}) => {
  const res = await coinsPost(new Request('https://site.test/api/coins', { method: 'POST', headers: { 'content-type': type, 'x-real-ip': ip }, body: raw ?? JSON.stringify(payload) }));
  return { status: res.status, data: await res.json() };
};
const outside = () => calls.filter((c) => !c.url.startsWith('https://challenges.cloudflare.com/'));
const rpc = (fn) => calls.filter((c) => c.url.endsWith(`/rpc/${fn}`));

// ---------- pasting a coin ----------
test('a clank.trade link or a contract address is accepted; anything else is not', () => {
  for (const ok of [`https://clank.trade/coin/${NEWC}`, `clank.trade/coin/${NEWC}`, `https://www.clank.trade/coin/${NEWC}?ref=abc`,
    `  http://clank.trade/coin/${NEWC.toUpperCase().replace('0X', '0x')}#chart  `, NEWC, NEWC.replace('0x2', '0x2').toUpperCase().replace('0X', '0x')]) {
    assert.equal(parseCoinInput(ok), NEWC, ok);
  }
  for (const bad of ['', 'pepe', '0x1234', `https://clank.trade.evil.com/coin/${NEWC}`, `https://evil.com/?u=https://clank.trade/coin/${NEWC}`,
    `https://dexscreener.com/robinhood/${NEWC}`, `javascript:alert(1)//${NEWC}`, `${NEWC}${NEWC}`, `https://clank.trade/coin/${NEWC} and more`, 'x'.repeat(300), null, 42]) {
    assert.equal(parseCoinInput(bad), null, String(bad));
  }
  assert.equal(buyLink('0xABC'), 'https://clank.trade/coin/0xabc');
});

test('tickers and names: shown as they are, only when PG-13 and without links', () => {
  assert.equal(cleanSymbol('$pepe'), 'PEPE');
  assert.equal(cleanSymbol('CLANKCAT'), 'CLANKCAT');
  for (const bad of ['', 'PE PE', 'PEPE!', '🐸', 'A'.repeat(13), 'ПЕПЕ']) assert.equal(cleanSymbol(bad), null, bad);
  assert.equal(cleanName('  Pepe\u200b  the   Frog '), 'Pepe the Frog');
  assert.equal([...cleanName('x'.repeat(60))].length, 40);
  assert.equal(cleanName('\u202e\u200b '), null);
  for (const ok of ['Pepe the Frog', 'Artificial Girlfriend Intelligence', 'Analytics Cat', 'Dickens Coin', 'Sussex', 'Mr.Coffee']) assert.ok(fitToShow(ok), ok);
  for (const bad of ['PORN coin', 'Sexy Cat', 'SEX', 'onlyfans', 'buy at pepe.xyz', 'www.scam', 'join t.me/x', 'https://x']) assert.ok(!fitToShow(bad), bad);
});

test('logos: only from clank.trade\'s picture gateway or DexScreener, always served from our own address', () => {
  assert.equal(safeLogoUrl(`https://yellow-total-guanaco-389.mypinata.cloud/ipfs/${CID}?img-width=128`), `https://yellow-total-guanaco-389.mypinata.cloud/ipfs/${CID}`);
  assert.equal(safeLogoUrl('https://cdn.dexscreener.com/cms/images/qEseUp7DzMfNfNFm'), 'https://cdn.dexscreener.com/cms/images/qEseUp7DzMfNfNFm');
  for (const bad of ['http://x.mypinata.cloud/ipfs/abc', 'https://evil.com/x.png', 'https://mypinata.cloud.evil.com/ipfs/a', 'https://x.mypinata.cloud:8443/ipfs/a',
    'https://user@x.mypinata.cloud/ipfs/a', 'https://x.mypinata.cloud/ipfs/../../etc', 'data:image/png;base64,AAAA', 'javascript:alert(1)', '/images/x.png', '']) {
    assert.equal(safeLogoUrl(bad), '', bad);
  }
  assert.match(logoFetchUrl(`https://a.mypinata.cloud/ipfs/${CID}`, 64), /\?img-width=64&img-height=64&img-fit=cover&img-quality=90&img-format=webp$/);
  assert.equal(logoFetchUrl('https://evil.com/x.png', 64), null);
  const local = logoUrls({ address: AGI, logo: '/images/coins/agi.webp' });
  assert.deepEqual(local, { logo: '/images/coins/agi-64.webp', logoLarge: '/images/coins/agi.webp' });
  const remote = logoUrls({ address: PEPE, logo: `https://a.mypinata.cloud/ipfs/${CID}` });
  assert.match(remote.logo, new RegExp(`^/api/logo\\?a=${PEPE}&s=64&v=[\\w-]{8}$`));
  assert.match(remote.logoLarge, /&s=256&v=/);
  assert.notEqual(logoUrls({ address: PEPE, logo: `https://a.mypinata.cloud/ipfs/${CID}x` }).logo, remote.logo, 'a new picture gets a new address');
  assert.deepEqual(logoUrls({ address: PEPE, logo: 'https://evil.com/x.png' }), { logo: '', logoLarge: '' });
});

test('the clank.trade check reads the page title and the logo, and knows a missing coin from an unreachable site', async () => {
  fake.clank[NEWC] = { html: clankHtml({ name: 'Cat (Official) &#39;v2&#39;', symbol: 'CAT2' }) };
  assert.deepEqual(await checkClank(NEWC), { name: "Cat (Official) 'v2'", symbol: 'CAT2', logo: `https://yellow-total-guanaco-389.mypinata.cloud/ipfs/${CID}` });
  fake.clank[NEWC] = { html: '<html><head><title>Coin not found · Clank.trade</title></head></html>' };
  assert.deepEqual(await checkClank(NEWC), { error: 'not_clank' });
  fake.clank[NEWC] = { status: 404 };
  assert.deepEqual(await checkClank(NEWC), { error: 'not_clank' });
  for (const page of [{ status: 503 }, { status: 403, html: '<title>Just a moment...</title>' }, { html: '<title>Just a moment...</title>' }]) {
    fake.clank[NEWC] = page;
    assert.deepEqual(await checkClank(NEWC), { error: 'unverified' }, JSON.stringify(page));
  }
  fake.clank[NEWC] = { html: '<title>No Logo (NOLOGO) · Clank.trade</title>' };
  assert.equal((await checkClank(NEWC)).logo, '');
  // (2026-09-27) since the domain switch, our bot name points at the real site
  const asked = calls.filter((c) => String(c.url).startsWith('https://clank.trade/coin/'));
  assert.ok(asked.length > 0 && asked.every((c) => /\(compatible; AGIArena\/1\.0; \+https:\/\/agi1\.app\)$/.test(c.headers?.['User-Agent'])), 'the bot name names agi1.app');
});

test('the DexScreener check: its biggest Robinhood Chain pool', async () => {
  fake.dex[NEWC] = [pair(NEWC, 900), pair(NEWC, 7_500), { ...pair(NEWC, 99_999), chainId: 'solana' }, pair(PEPE, 50_000)];
  assert.equal((await checkDex(NEWC)).liquidity, 7_500);
  fake.dex[NEWC] = [];
  assert.deepEqual(await checkDex(NEWC), { error: 'not_trading' });
  fake.dexDown = true;
  assert.deepEqual(await checkDex(NEWC), { error: 'unverified' });
});

// ---------- POST /api/coins ----------
test('the request is checked, then the human check, before anything else is asked', async () => {
  assert.equal((await post({ coin: NEWC }, { type: 'text/plain' })).status, 415);
  assert.equal((await post(null, { raw: '{nope' })).status, 400);
  assert.equal((await post({ coin: 'x'.repeat(3000) })).status, 413);
  assert.equal((await post({ coin: 'https://evil.com/coin' })).data.error, 'bad_link');
  assert.equal((await post({ coin: NEWC })).data.error, 'human_check');
  assert.equal((await post({ coin: NEWC, turnstileToken: 'bad-token' })).status, 401);
  assert.equal(outside().length, 0, 'no database, clank.trade or DexScreener call before the human check');
  assert.equal((await coinsGet()).status, 405);
});

test('a vote for a nominated coin goes straight to the database (no lookups), with a code made for that coin only', async () => {
  const r = await post({ coin: `https://clank.trade/coin/${PEPE}`, turnstileToken: 'good-token' });
  assert.equal(r.status, 200);
  assert.deepEqual([r.data.result, r.data.symbol, r.data.votes, r.data.need, r.data.nominated], ['ok', 'PEPE', 3, NEED, false]);
  assert.ok(r.data.pass, 'a 2-hour pass comes back');
  assert.equal(calls.filter((c) => c.url.startsWith('https://clank.trade/') || c.url.startsWith('https://api.dexscreener.com/')).length, 0);
  const again = await post({ coin: PEPE, pass: r.data.pass });
  assert.deepEqual([again.status, again.data.result, again.data.votes], [200, 'already', 3]);
  const codes = rpc('coin_vote').map((c) => c.body.p_who);
  assert.equal(codes[0], codes[1], 'the same visitor has the same code for this coin');
  assert.ok(!JSON.stringify(outside().map((c) => c.body)).includes('1.2.3.4'), 'no raw IP goes to the database (only Cloudflare sees it, for the bot check)');
  // the same visitor's code for another coin is different (votes for different coins can't be linked)
  await post({ coin: NEWC, pass: r.data.pass });
  assert.notEqual(rpc('coin_nominate')[0].body.p_who, codes[0]);
});

test('a new coin is checked with clank.trade and DexScreener, then nominated with the nominator\'s vote', async () => {
  const r = await post({ coin: `clank.trade/coin/${NEWC}`, turnstileToken: 'good-token' });
  assert.equal(r.status, 200);
  assert.deepEqual([r.data.result, r.data.symbol, r.data.votes, r.data.nominated], ['ok', 'SHINY', 1, true]);
  const n = rpc('coin_nominate')[0].body;
  assert.deepEqual([n.p_address, n.p_symbol, n.p_name, n.p_logo], [NEWC, 'SHINY', 'New & Shiny', `https://yellow-total-guanaco-389.mypinata.cloud/ipfs/${CID}`]);
  assert.deepEqual([n.p_need, n.p_max, n.p_daily, n.p_site], [20, 6, 2, 50]);
  assert.match(n.p_day, /^\d{4}-\d{2}-\d{2}$/);
  assert.notEqual(n.p_day_who, n.p_who, 'the daily code (nominations per day) is not the coin code');
  assert.ok(calls.some((c) => c.url === `https://clank.trade/coin/${NEWC}`));
  assert.ok(calls.some((c) => c.url === `https://api.dexscreener.com/tokens/v1/robinhood/${NEWC}`));
});

test('coins that fail a check are refused with the reason, and never saved', async () => {
  const cases = [
    [() => { fake.clank[NEWC] = { html: '<title>Coin not found · Clank.trade</title>' }; }, 404, 'not_clank'],
    [() => { fake.clank[NEWC] = { status: 503 }; }, 503, 'unverified'],
    [() => { fake.dexDown = true; }, 503, 'unverified'],
    [() => { fake.dex[NEWC] = []; }, 422, 'not_trading'],
    [() => { fake.dex[NEWC] = [pair(NEWC, 4_999)]; }, 422, 'low_liquidity'],
    [() => { fake.clank[NEWC] = { html: clankHtml({ name: 'Frog', symbol: 'FR OG' }) }; }, 422, 'bad_symbol'],
    [() => { fake.clank[NEWC] = { html: clankHtml({ name: 'Sexy Frog', symbol: 'FROG' }) }; }, 422, 'not_allowed'],
    [() => { fake.clank[NEWC] = { html: clankHtml({ name: 'frog.xyz', symbol: 'FROG' }) }; }, 422, 'not_allowed'],
  ];
  for (const [setup, status, error] of cases) {
    const saved = { clank: fake.clank[NEWC], dex: fake.dex[NEWC] };
    setup();
    coinBurst.reset();
    const r = await post({ coin: NEWC, turnstileToken: 'good-token' });
    assert.deepEqual([r.status, r.data.error], [status, error], error);
    if (error === 'low_liquidity') assert.deepEqual([r.data.liquidity, r.data.min], [4_999, 5_000]);
    Object.assign(fake, { dexDown: false });
    fake.clank[NEWC] = saved.clank; fake.dex[NEWC] = saved.dex;
  }
  assert.equal(rpc('coin_nominate').length, 0, 'nothing was nominated');
});

test('the database\'s refusals: removed coins, 2 nominations a day, one coin per ticker', async () => {
  fake.coins.get(PEPE).status = 'hidden';
  let r = await post({ coin: PEPE, turnstileToken: 'good-token' });
  assert.deepEqual([r.status, r.data.error], [403, 'removed']);
  assert.equal(calls.filter((c) => c.url.startsWith('https://clank.trade/')).length, 0, 'a removed coin isn\'t even looked up');
  for (const [answer, status, error] of [[{ result: 'too_many' }, 429, 'too_many'], [{ result: 'busy' }, 429, 'site_limit'], [{ result: 'symbol_taken', symbol: 'SHINY' }, 409, 'symbol_taken']]) {
    fake.nominateAnswer = answer;
    r = await post({ coin: NEWC, pass: makePass(SECRET, visitorCode(SECRET, '1.2.3.4')) });
    assert.deepEqual([r.status, r.data.error], [status, error]);
  }
  assert.equal(r.data.symbol, 'SHINY');
});

test('a coin that left the Arena can be nominated again (checked again first)', async () => {
  fake.coins.get(CAT).status = 'retired';
  fake.clank[CAT] = { html: clankHtml({ name: 'Clank Cat', symbol: 'CLANKCAT' }) };
  fake.dex[CAT] = [pair(CAT, 40_000)];
  const r = await post({ coin: CAT, turnstileToken: 'good-token' });
  assert.deepEqual([r.status, r.data.result, r.data.nominated], [200, 'ok', true]);
  assert.deepEqual([rpc('coin_vote').length, rpc('coin_nominate').length], [1, 1], 'asked as a vote first (answer: retired), then checked and nominated');
  assert.ok(calls.some((c) => c.url === `https://clank.trade/coin/${CAT}`), 'checked again');
});

test('the 20th vote adds the coin; a listed coin just says so', async () => {
  const c = fake.coins.get(PEPE);
  for (let i = 0; i < NEED - 3; i++) c.votes.add(`v${i}`);            // 19 votes
  const r = await post({ coin: PEPE, turnstileToken: 'good-token' });
  assert.deepEqual([r.data.result, r.data.votes], ['added', NEED]);
  const again = await post({ coin: PEPE, pass: r.data.pass }, { ip: '5.6.7.8' });
  assert.equal(again.status, 401, 'another visitor needs their own human check');
  assert.equal((await post({ coin: PEPE, turnstileToken: 'good-token' }, { ip: '5.6.7.8' })).data.result, 'listed');
});

test('before coins.sql is run: "not_ready"; a hammering visitor is slowed down first', async () => {
  fake.coinsSql = false;
  const r = await post({ coin: PEPE, turnstileToken: 'good-token' });
  assert.deepEqual([r.status, r.data.error], [503, 'not_ready']);
  for (let i = 0; i < 10; i++) await post({ coin: PEPE }, { ip: '9.9.9.9' });
  const before = calls.length;
  assert.equal((await post({ coin: PEPE, turnstileToken: 'good-token' }, { ip: '9.9.9.9' })).data.error, 'slow_down');
  assert.equal(calls.length, before, 'nothing outside was called');
});

// ---------- GET /api/logo ----------
const logo = (q) => logoGet(new Request(`https://site.test/api/logo${q}`));

test('logos: fetched from clank.trade\'s gateway at the size asked, checked, and kept a week by the CDN', async () => {
  fake.coins.get(PEPE).status = 'listed';
  const res = await logo(`?a=${PEPE}&s=64&v=abc`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/webp');
  assert.match(res.headers.get('cache-control'), /s-maxage=604800/);
  assert.match(res.headers.get('content-security-policy'), /default-src 'none'/);
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), WEBP);
  assert.match(calls.at(-1).url, /\/ipfs\/\w+\?img-width=64&img-height=64&img-fit=cover/);
  assert.match((await logo(`?a=${PEPE}&s=256`)).status === 200 && calls.at(-1).url, /img-width=256/);
});

test('logos: only for coins that are (or were) in the Arena, and only real pictures', async () => {
  for (const q of ['', '?a=nope', `?a=${PEPE}&s=100`, `?a=${PEPE}&s=64x`]) {
    const r = await logo(q);
    assert.equal(r.status, 400, q);
  }
  assert.equal((await logo(`?a=${PEPE}`)).status, 404, 'a nomination has no logo here');
  assert.equal((await logo(`?a=${AGI}`)).status, 404, 'AGI\'s logo is a file on the site, never fetched');
  assert.equal((await logo(`?a=${NEWC}`)).status, 404, 'an unknown coin');
  fake.coins.get(PEPE).status = 'listed';
  fake.coins.get(PEPE).logo = 'https://evil.com/logo.png';
  const before = calls.length;
  assert.equal((await logo(`?a=${PEPE}`)).status, 404);
  assert.ok(!calls.slice(before).some((c) => c.url.includes('evil.com')), 'a picture from anywhere else is never fetched');
  fake.coins.get(PEPE).logo = `https://yellow-total-guanaco-389.mypinata.cloud/ipfs/${CID}`;
  const src = `https://yellow-total-guanaco-389.mypinata.cloud/ipfs/${CID}`;
  for (const img of [{ type: 'image/svg+xml', body: Buffer.from('<svg onload="alert(1)"/>') }, { type: 'text/html', body: Buffer.from('<script>') },
    { type: 'image/png', body: WEBP }, { type: 'image/webp', body: Buffer.alloc(1_000_001, 1) }]) {
    fake.images[src] = img;
    const r = await logo(`?a=${PEPE}`);
    assert.equal(r.status, 502, img.type);
    assert.match(r.headers.get('cache-control'), /s-maxage=300/, 'a failure is retried after a few minutes');
  }
  fake.images[src] = { type: 'image/png', body: PNG };
  assert.equal((await logo(`?a=${PEPE}`)).status, 200);
  fake.coinsSql = false;
  assert.equal((await logo(`?a=${PEPE}`)).status, 404);
});

// ---------- the scoreboard and Arena votes with the coin list ----------
test('the scoreboard lists the coins with logos and clank.trade links, the nominations and the rules', async () => {
  fake.coins.get(PEPE).status = 'listed';
  fake.coins.set(NEWC, { address: NEWC, symbol: 'SHINY', name: 'Shiny', logo: '', status: 'candidate', votes: new Set(['x']) });
  const data = await (await arenaGet(new Request('https://site.test/api/arena'))).json();
  assert.deepEqual(data.coins.map((c) => c.symbol), ['AGI', 'CABO', 'CLANKCAT', 'PEPE']);
  const [agi, , , pepe] = data.coins;
  assert.deepEqual([agi.logo, agi.logoLarge, agi.core, agi.buy], ['/images/coins/agi-64.webp', '/images/coins/agi.webp', true, `https://clank.trade/coin/${AGI}`]);
  assert.match(pepe.logo, new RegExp(`^/api/logo\\?a=${PEPE}&s=64&v=`));
  assert.equal(pepe.core, false);
  assert.ok(!JSON.stringify(data).includes('mypinata'), 'the page never gets the outside picture address');
  assert.deepEqual(data.candidates, [{ symbol: 'SHINY', name: 'Shiny', address: NEWC, votes: 1, buy: `https://clank.trade/coin/${NEWC}` }]);
  assert.deepEqual(data.rules, { need: 20, max: 8, core: ['AGI', 'CABO'] });
  assert.ok(!('logo' in data.candidates[0]), 'nominations have no logo');
});

test('Arena votes follow the coin list: a coin voted in a moment ago counts, a coin that left does not', async () => {
  const vote = async (coin, ip) => {
    const res = await votePost(new Request('https://site.test/api/vote', { method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': ip }, body: JSON.stringify({ coin, turnstileToken: 'good-token' }) }));
    return { status: res.status, data: await res.json() };
  };
  assert.equal((await vote('AGI', '1.1.1.1')).status, 200);
  assert.equal((await vote('PEPE', '1.1.1.2')).data.error, 'bad_coin', 'a nomination can\'t get Arena votes');
  fake.coins.get(PEPE).status = 'listed';                           // voted in just now
  assert.equal((await vote('PEPE', '1.1.1.3')).status, 200, 'asked the list again instead of waiting 30 s');
  const listCalls = rpc('coin_active').length;
  await vote('CABO', '1.1.1.4');
  assert.equal(rpc('coin_active').length, listCalls, 'the list is kept for 30 s');
  fake.coinsSql = false; forgetActiveSymbols();
  assert.equal((await vote('CLANKCAT', '1.1.1.5')).status, 200, 'before coins.sql: the first three coins');
  assert.equal((await vote('PEPE', '1.1.1.6')).data.error, 'bad_coin');
});

// ---------- the keep-alive's liquidity check ----------
test('keep-alive: a voted-in coin whose liquidity is almost gone leaves the Arena; AGI and CABO are never checked', async () => {
  fake.coins.get(PEPE).status = 'listed';
  fake.dex[CAT] = [pair(CAT, 40_000)];
  fake.dex[PEPE] = [pair(PEPE, 420)];
  const res = await keepalive(new Request('https://site.test/api/keepalive', { headers: { authorization: `Bearer ${ENV.CRON_SECRET}` } }));
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.deepEqual(body.coins, { checked: 2, retired: ['PEPE'] });
  assert.equal(fake.coins.get(PEPE).status, 'retired');
  const dexCall = calls.find((c) => c.url.startsWith('https://api.dexscreener.com/'));
  assert.ok(!dexCall.url.includes(AGI) && !dexCall.url.includes(CABO));
  // missing from DexScreener's answer (a hiccup?) is not "almost gone": nothing happens
  fake.dex[CAT] = [];
  const again = await (await keepalive(new Request('https://site.test/api/keepalive', { headers: { authorization: `Bearer ${ENV.CRON_SECRET}` } }))).json();
  assert.deepEqual(again.coins, { checked: 1, retired: [] });
  fake.dexDown = true;
  assert.deepEqual((await (await keepalive(new Request('https://site.test/api/keepalive', { headers: { authorization: `Bearer ${ENV.CRON_SECRET}` } }))).json()).coins, { error: 'failed' });
});
