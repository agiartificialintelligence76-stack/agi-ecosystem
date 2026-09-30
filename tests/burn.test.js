// Messages paid for by burning $AGI (2026-09-30): reading a burn on the chain, counting it once, "Check my burn", the chat
// using burned messages after the free ones (and giving one back when her reply fails), her voice allowance, the level
// counting what was burned, the public counter, and the page (a burn address, never a transaction). Robinhood Chain, the
// block explorer, Supabase, Gemini and Turnstile are fakes (the SQL itself: supabase/burns.sql, checked in PGlite).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { POST as wallet, GET as walletGet } from '../api/wallet.js';
import { POST as chat } from '../api/chat.js';
import { POST as voicePost, resetForTests as resetVoice } from '../api/voice.js';
import { makeSession, readSession, walletCode } from '../server/session.js';
import { makeVoiceTicket, checkVoiceTicket } from '../server/security.js';
import { txFrom, txCode, burnWallet, burnedIn, readBurn, messagesFor, recentBurns, _resetBurnKey, BURN_ADDRESS, BURN_PER_DAY, BURN_WINDOW_MS } from '../server/burn.js';
import { _resetChainCache, AGI_CONTRACT } from '../server/chain.js';
import { burnBurst, voiceBurst } from '../server/burst.js';
import { getConfig } from '../server/config.js';
import { voicePerDay } from '../server/limits.js';
import { BURN_ADDRESS as PAGE_BURN_ADDRESS, packsFor } from '../src/lib/burns.js';

const SECRET = 'test-pass-secret-that-is-long-enough-1234';
const ENV = {
  GEMINI_API_KEY: 'fake-gemini-key', SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fake_key_123',
  TURNSTILE_SECRET_KEY: 'fake-turnstile-secret', PASS_SECRET: SECRET,
};
const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const EXPLORER = 'https://robinhoodchain.blockscout.com/api/v2/addresses/';
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const TOKEN = 10n ** 18n;
const ZERO = `0x${'0'.repeat(40)}`;
const ALICE = '0x70997970c51812dc3a010c7d01b50e0d17dc79c8';
const BOB = '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc';
const LOOKALIKE = '0x1111111111111111111111111111111111111111';
const tx = (n) => `0x${n.toString(16).padStart(64, '0')}`;
const pad = (a) => `0x${a.slice(2).toLowerCase().padStart(64, '0')}`;
const log = ({ token = AGI_CONTRACT, from, to = BURN_ADDRESS, amount, removed = false }) => ({
  address: token, topics: [TRANSFER, pad(from), pad(to)], data: `0x${amount.toString(16).padStart(64, '0')}`, removed,
});
const today = () => new Date().toISOString().slice(0, 10);
const KEY = 'a'.repeat(32) + 'b'.repeat(32);                        // the database's own key (burns.sql makes a random one)

let calls, fake, chain, db;
function burnDb(fn, a) {
  const w = db.wallets[a.p_wallet];
  switch (fn) {
    case 'burn_key': return KEY;
    case 'burn_seen': return (a.p_txs || []).filter((t) => db.txs.has(t));
    case 'burn_claim': {
      if (db.txs.has(a.p_tx)) return { ok: false, why: 'used' };
      db.txs.add(a.p_tx);
      const x = (db.wallets[a.p_wallet] ??= { left: 0, bought: 0, agi: 0, day: null, used: 0, last: 0 });
      x.left += a.p_messages; x.bought += a.p_messages; x.agi += a.p_agi;
      db.total = { agi: db.total.agi + a.p_agi, messages: db.total.messages + a.p_messages, burns: db.total.burns + 1, last_at: new Date().toISOString() };
      db.burnedToday += a.p_agi;
      return { ok: true, left: x.left, bought: x.bought, agi: x.agi };
    }
    case 'burn_take': {
      if (!w || w.left < 1) return { ok: false, why: 'none', left: 0 };
      const used = w.day === today() ? w.used : 0;
      if (used >= a.p_per_day) return { ok: false, why: 'day_cap', left: w.left };
      if ((db.days[today()] || 0) >= a.p_site_daily) return { ok: false, why: 'site_cap', left: w.left };
      if (Date.now() - w.last < a.p_min_gap_ms) return { ok: false, why: 'too_fast', left: w.left };
      w.left -= 1; w.day = today(); w.used = used + 1; w.last = Date.now(); w.take = a.p_take;
      db.days[today()] = (db.days[today()] || 0) + 1;
      return { ok: true, left: w.left, today: w.used };
    }
    case 'burn_refund': {                                            // (that take, once; the attempt still counts)
      if (!w || !a.p_take || w.take !== a.p_take) return { ok: false };
      w.left += 1; w.take = null;
      return { ok: true, left: w.left };
    }
    case 'burn_status': return { left: w?.left ?? 0, bought: w?.bought ?? 0, agi: w?.agi ?? 0, today: w && w.day === today() ? w.used : 0 };
    case 'burn_total': return { ...db.total, today: db.burnedToday };
    default: throw new Error(`unknown ${fn}`);
  }
}

beforeEach(() => {
  Object.assign(process.env, ENV, { CHAT_MIN_GAP_MS: '1' });
  for (const k of ['ROBINHOOD_RPC_URL', 'BURN_PER_MESSAGE', 'BURN_DAILY_CAP']) delete process.env[k];
  _resetChainCache();
  _resetBurnKey();
  burnBurst.reset();
  voiceBurst.reset();
  resetVoice();
  calls = [];
  fake = { limit: 'ok', burns: 'ready', gemini: 'ok', explorer: 'ok', voiceTake: 'person_cap' };
  chain = { receipts: {}, blocks: {}, balances: {}, down: false, transfers: {} };
  db = { txs: new Set(), wallets: {}, days: {}, burnedToday: 0, total: { agi: 0, messages: 0, burns: 0, last_at: null } };
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, body, method: init.method || 'GET' });
    if (url === RPC) {
      if (chain.down) return new Response('busy', { status: 503 });
      const answer = (q) => {
        assert.ok(['eth_getTransactionReceipt', 'eth_getBlockByNumber', 'eth_call'].includes(q.method), `a read-only method, not ${q.method}`);
        if (q.method === 'eth_getTransactionReceipt') return chain.receipts[q.params[0]] ?? null;
        if (q.method === 'eth_getBlockByNumber') return chain.blocks[q.params[0]] ?? null;
        const { to, data } = q.params[0];
        assert.equal(to, AGI_CONTRACT);
        if (data === '0x313ce567') return `0x${(18).toString(16).padStart(64, '0')}`;
        assert.ok(data.startsWith('0x70a08231'), 'balanceOf');
        return `0x${(chain.balances[`0x${data.slice(-40)}`] ?? 0n).toString(16).padStart(64, '0')}`;
      };
      return Response.json(Array.isArray(body) ? body.map((q) => ({ jsonrpc: '2.0', id: q.id, result: answer(q) })) : { jsonrpc: '2.0', id: body.id, result: answer(body) });
    }
    if (url.startsWith(EXPLORER)) {
      if (fake.explorer === 'down') return new Response('<html>bad gateway</html>', { status: 502 });
      if (fake.explorer === 'odd') return Response.json({ nothing: true });
      const who = url.slice(EXPLORER.length).split('/')[0];
      return Response.json({ items: chain.transfers[who] ?? [], next_page_params: null });
    }
    if (url.includes('/rest/v1/rpc/burn_')) {
      if (fake.burns === 'missing') return Response.json({ code: 'PGRST202', message: 'Could not find the function' }, { status: 404 });
      if (fake.burns === 'down') return Response.json({ message: 'boom' }, { status: 500 });
      return Response.json(burnDb(url.split('/').pop(), body));
    }
    if (url.includes('/rest/v1/rpc/chat_take')) return Response.json(fake.limit);
    if (url.includes('/rest/v1/rpc/friend_')) return Response.json({ name: null, notes: [] });
    if (url.includes('/rest/v1/rpc/voice_take')) return Response.json(fake.voiceTake);
    if (url.startsWith('https://challenges.cloudflare.com/')) return Response.json({ success: body.response === 'good-token', action: 'chat' });
    if (url.startsWith('https://generativelanguage.googleapis.com/')) {
      if (fake.gemini === 'down') return Response.json({ error: { status: 'UNAVAILABLE', message: 'overloaded' } }, { status: 503 });
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ reply: 'hi 💜', mood: 'happy' }) }] } }] });
    }
    throw new Error(`unexpected request to ${url}`);
  };
});

// a burn on the fake chain (and in the explorer's list for its wallet)
function addBurn(hash, { from = ALICE, amount = 1000n * TOKEN, to = BURN_ADDRESS, token = AGI_CONTRACT, status = '0x1', ageMs = 60_000, logs, listed = true } = {}) {
  const block = `0x${(5000 + Object.keys(chain.receipts).length).toString(16)}`;
  chain.receipts[hash] = { transactionHash: hash, status, blockNumber: block, logs: logs ?? [log({ from, to, amount, token })] };
  chain.blocks[block] = { number: block, timestamp: `0x${Math.floor((Date.now() - ageMs) / 1000).toString(16)}` };
  if (listed) {
    (chain.transfers[from] ??= []).unshift({
      transaction_hash: hash, from: { hash: from }, to: { hash: to.toLowerCase() === BURN_ADDRESS.toLowerCase() ? BURN_ADDRESS : to },
      token: { address_hash: token }, total: { decimals: '18', value: String(amount) }, timestamp: new Date(Date.now() - ageMs).toISOString(), type: 'token_transfer',
    });
  }
}
const post = async (handler, body, ip = '1.2.3.4') => {
  const res = await handler(new Request('https://site.test/api/x', { method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': ip }, body: JSON.stringify(body) }));
  return { status: res.status, data: await res.json(), headers: res.headers };
};
const session = (w = ALICE, level = 1) => makeSession(SECRET, { wallet: w, level, checkedAt: Date.now() });
const check = (extra = {}, w = ALICE) => post(wallet, { action: 'burn', session: session(w), ...extra });
const chatBody = (extra = {}) => ({ message: 'hi agi1', adult: true, turnstileToken: 'good-token', ...extra });
const called = (part) => calls.filter((c) => c.url.includes(part));

// ---------- reading a burn ----------
test('the transaction in whatever was pasted: a hash, an explorer link, the 64 characters alone', () => {
  const h = tx(0xabc);
  assert.equal(txFrom(h), h);
  assert.equal(txFrom(h.toUpperCase().replace('0X', '0x')), h, 'lowercase');
  assert.equal(txFrom(`https://robinhoodchain.blockscout.com/tx/${h}?tab=logs`), h);
  assert.equal(txFrom(`  ${h.slice(2)}  `), h, 'without 0x');
  assert.equal(txFrom(`0x${'a'.repeat(66)}`), null, 'too long: not a transaction');
  assert.equal(txFrom(ALICE), null, 'an address is not a transaction');
  assert.equal(txFrom('gm'), null);
  assert.equal(txFrom(null), null);
  assert.equal(txFrom({ toString: () => h }), h);
});

test('what a transaction burned: only the official $AGI, to 0x…dEaD or 0x0, counted per wallet', () => {
  const r = { logs: [
    log({ from: ALICE, amount: 500n }),
    log({ from: ALICE, to: ZERO, amount: 200n }),                                   // the coin's own burn()
    log({ from: ALICE, amount: 999n, token: LOOKALIKE }),                            // a look-alike coin: never
    log({ from: ALICE, to: BOB, amount: 777n }),                                     // a normal transfer: not a burn
    log({ from: BOB, amount: 50n }),                                                 // someone else's burn
    log({ from: ALICE, amount: 1000n, removed: true }),                              // a log the chain took back
    log({ from: ZERO, amount: 5n }),                                                 // a mint to the burn address
    { address: AGI_CONTRACT, topics: [TRANSFER, pad(ALICE)], data: '0x10' },         // odd events
    { address: AGI_CONTRACT, topics: [TRANSFER, pad(ALICE), pad(BURN_ADDRESS)], data: 'nope' },
    { address: AGI_CONTRACT, topics: ['0x1234', pad(ALICE), pad(BURN_ADDRESS)], data: '0x10' },
    null,
  ] };
  assert.deepEqual(burnedIn(r, ALICE), { burned: 700n, others: 50n });
  assert.deepEqual(burnedIn({}, ALICE), { burned: 0n, others: 0n });
  assert.deepEqual(messagesFor(1005n * TOKEN + 5n, 18, 10), { messages: 100, agi: 1000 }, 'rounded down; parts of a token never count');
  assert.deepEqual(messagesFor(9n * TOKEN, 18, 10), { messages: 0, agi: 0 });
  assert.deepEqual(messagesFor(1_000_000_000n * TOKEN, 18, 10), { messages: 100_000_000, agi: 1_000_000_000 }, 'the whole supply fits');
});

test('reading one burn from the chain: every reason it may not count, and read-only calls only', async () => {
  addBurn(tx(1));
  assert.deepEqual(await readBurn(tx(1), ALICE).then((r) => [r.ok, r.raw]), [true, 1000n * TOKEN]);
  assert.deepEqual(await readBurn(tx(2), ALICE), { ok: false, why: 'pending' }, 'not on the chain (yet)');
  addBurn(tx(3), { status: '0x0' });
  assert.deepEqual(await readBurn(tx(3), ALICE), { ok: false, why: 'failed' });
  addBurn(tx(4), { token: LOOKALIKE });
  assert.deepEqual(await readBurn(tx(4), ALICE), { ok: false, why: 'not_agi' });
  addBurn(tx(5), { to: BOB });
  assert.deepEqual(await readBurn(tx(5), ALICE), { ok: false, why: 'not_agi' }, 'a transfer is not a burn');
  addBurn(tx(6), { from: BOB });
  assert.deepEqual(await readBurn(tx(6), ALICE), { ok: false, why: 'other_wallet' });
  addBurn(tx(7), { ageMs: BURN_WINDOW_MS + 60_000 });
  assert.deepEqual(await readBurn(tx(7), ALICE), { ok: false, why: 'too_old' });
  chain.receipts[tx(8)] = { ...chain.receipts[tx(1)], transactionHash: tx(9) };
  await assert.rejects(readBurn(tx(8), ALICE), /another transaction/);
  chain.receipts[tx(10)] = { ...chain.receipts[tx(1)], transactionHash: tx(10), blockNumber: '0xffff' };
  await assert.rejects(readBurn(tx(10), ALICE), /block/, 'no block time: nothing counts');
  chain.down = true;
  await assert.rejects(readBurn(tx(1), ALICE), /chain: HTTP 503/);
  assert.equal(BURN_WINDOW_MS, 7 * 864e5);
});

test("the explorer's list of a wallet's burns: both of Blockscout's field names, only this wallet's $AGI burns, newest first", async () => {
  const now = Date.now();
  chain.transfers[ALICE] = [
    { tx_hash: tx(11), from: { hash: ALICE }, to: { hash: ZERO }, token: { address: AGI_CONTRACT }, timestamp: new Date(now - 5000).toISOString() },
    { transaction_hash: tx(12), from: { hash: ALICE }, to: { hash: BURN_ADDRESS }, token: { address_hash: AGI_CONTRACT }, timestamp: new Date(now - 1000).toISOString() },
    { transaction_hash: tx(12), from: { hash: ALICE }, to: { hash: BURN_ADDRESS }, token: { address_hash: AGI_CONTRACT }, timestamp: new Date(now - 1000).toISOString() },
    { transaction_hash: tx(13), from: { hash: ALICE }, to: { hash: BOB }, token: { address_hash: AGI_CONTRACT }, timestamp: new Date(now).toISOString() },
    { transaction_hash: tx(14), from: { hash: BOB }, to: { hash: BURN_ADDRESS }, token: { address_hash: AGI_CONTRACT }, timestamp: new Date(now).toISOString() },
    { transaction_hash: tx(15), from: { hash: ALICE }, to: { hash: BURN_ADDRESS }, token: { address_hash: LOOKALIKE }, timestamp: new Date(now).toISOString() },
    { transaction_hash: tx(16), from: { hash: ALICE }, to: { hash: BURN_ADDRESS }, token: { address_hash: AGI_CONTRACT }, timestamp: new Date(now - BURN_WINDOW_MS - 1).toISOString() },
    { transaction_hash: 'junk', from: { hash: ALICE }, to: { hash: BURN_ADDRESS } },
    null,
  ];
  assert.deepEqual((await recentBurns(ALICE, { now })).map((b) => b.tx), [tx(12), tx(11)]);
  const asked = called(EXPLORER)[0].url;
  assert.ok(asked.includes(`${ALICE}/token-transfers`) && asked.includes(`token=${AGI_CONTRACT}`) && asked.includes('filter=from'), asked);
  chain.transfers[ALICE] = Array.from({ length: 9 }, (_, i) => ({ transaction_hash: tx(100 + i), from: { hash: ALICE }, to: { hash: BURN_ADDRESS }, timestamp: new Date(now - i * 1000).toISOString() }));
  assert.equal((await recentBurns(ALICE, { now })).length, 5, 'at most 5');
  fake.explorer = 'down';
  await assert.rejects(recentBurns(ALICE), /explorer HTTP 502/);
  fake.explorer = 'odd';
  await assert.rejects(recentBurns(ALICE), /unexpected shape/);
});

// ---------- "Check my burn" ----------
test('check my burn (pasted): counted once, messages added, the level counts it, and the database never sees the hash', async () => {
  addBurn(tx(21), { amount: 1000n * TOKEN + TOKEN / 2n });
  chain.balances[ALICE] = 9_000n * TOKEN;                      // 9,000 held + 1,000 burned = Crush
  const r = await check({ tx: `https://robinhoodchain.blockscout.com/tx/${tx(21)}` });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.found, [{ ok: true, messages: 100, agi: 1000 }]);
  assert.equal(r.data.source, 'pasted');
  assert.deepEqual(r.data.burn, { ready: true, left: 100, bought: 100, agi: 1000, today: 0, price: 10, perDay: BURN_PER_DAY });
  assert.equal(r.data.level, 2, 'what was burned counts toward the level');
  assert.equal(readSession(SECRET, r.data.session).level, 2, 'a new session with the new level');
  const saved = called('burn_claim')[0].body;
  assert.deepEqual(saved, { p_tx: txCode(KEY, tx(21), ALICE), p_wallet: burnWallet(KEY, ALICE), p_messages: 100, p_agi: 1000 });
  assert.notEqual(burnWallet(KEY, ALICE), walletCode(SECRET, ALICE), 'burns can\'t be matched to her name and notes for this wallet');
  assert.notEqual(txCode(KEY, tx(21), ALICE), txCode(KEY, tx(21), BOB), 'a transaction counts per wallet');
  const toDb = JSON.stringify(calls.filter((c) => c.url.includes('supabase')).map((c) => c.body)).toLowerCase();
  assert.ok(!toDb.includes(tx(21).slice(2)) && !toDb.includes(ALICE.slice(2)), 'no hash or address in the database');
  assert.equal(called('burn_key').length, 1, 'the key is read once per server copy');
  assert.deepEqual(r.data.total, { agi: 1000, messages: 100, burns: 1, today: 1000, lastAt: r.data.total.lastAt }, 'the burn monitor\'s numbers, at once');

  const again = await check({ tx: tx(21) });
  assert.deepEqual(again.data.found, [{ ok: false, why: 'used' }], 'the same burn twice: counted once');
  assert.equal(again.data.burn.left, 100);
  const receipts = calls.filter((c) => c.url === RPC && c.body?.method === 'eth_getTransactionReceipt');
  assert.equal(receipts.length, 1, 'a burn counted before is not read from the chain again');
  const bob = await check({ tx: tx(21) }, BOB);
  assert.deepEqual(bob.data.found, [{ ok: false, why: 'other_wallet' }], "nobody can count someone else's burn (or learn whether it was counted)");
});

test("check my burn (pasted): each reason it doesn't count, and nothing is counted", async () => {
  addBurn(tx(31), { from: BOB });
  addBurn(tx(32), { amount: 9n * TOKEN });
  addBurn(tx(33), { ageMs: BURN_WINDOW_MS + 1000 });
  addBurn(tx(34), { status: '0x0' });
  addBurn(tx(35), { token: LOOKALIKE });
  const why = async (h) => (await check({ tx: h })).data.found[0].why;
  assert.equal(await why(tx(31)), 'other_wallet');
  assert.equal(await why(tx(32)), 'too_small');
  assert.equal(await why(tx(33)), 'too_old');
  assert.equal(await why(tx(34)), 'failed');
  assert.equal(await why(tx(35)), 'not_agi');
  assert.equal(await why(tx(36)), 'pending');
  assert.equal(db.total.burns, 0);
  assert.equal(db.burnedToday, 0);
  assert.equal(called('burn_claim').length, 0);
  assert.deepEqual((await check({ tx: 'gm' })).data, { error: 'bad_tx' });
  assert.equal((await check({ tx: 'gm' })).status, 400);
  chain.down = true;
  const down = await check({ tx: tx(40) });
  assert.deepEqual([down.status, down.data.error], [503, 'chain'], 'the chain away: try again later');
  chain.down = false;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (url, init) => (String(url) === RPC ? Promise.reject(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })) : realFetch(url, init));
  const slow = await check({ tx: tx(41) });
  assert.deepEqual([slow.status, slow.data.error], [503, 'chain'], 'a node that never answers is the chain too, not our database');
  globalThis.fetch = realFetch;
});

test('check my burn (the explorer): finds new burns, skips counted ones, and says when the explorer is away', async () => {
  addBurn(tx(51), { amount: 500n * TOKEN, ageMs: 120_000 });
  addBurn(tx(52), { amount: 2000n * TOKEN });
  await check({ tx: tx(51) });                                  // counted before
  const r = await check();
  assert.equal(r.data.source, 'explorer');
  assert.deepEqual(r.data.found, [{ ok: true, messages: 200, agi: 2000 }]);
  assert.equal(r.data.counted, 1);
  assert.equal(r.data.burn.left, 250);
  const none = await check();
  assert.deepEqual([none.data.found, none.data.counted], [[], 2], 'nothing new');
  for (let i = 0; i < 5; i++) addBurn(tx(70 + i), { amount: 10n * TOKEN, ageMs: 1000 + i });
  burnBurst.reset();
  const many = await check();
  assert.deepEqual([many.data.found.length, many.data.counted, many.data.more], [3, 0, 2], 'at most 3 read a time: 2 more wait for the next check (the explorer lists the newest 5)');
  assert.deepEqual([(await check()).data.found.length, (await check()).data.more], [2, 0]);
  fake.explorer = 'down';
  const away = await check();
  assert.deepEqual([away.status, away.data.error], [503, 'explorer'], 'then the visitor pastes the link');
});

test('check my burn: signed out, burns.sql not run, the database down, and a speed bump', async () => {
  assert.equal((await post(wallet, { action: 'burn', session: 'nope' })).status, 401);
  fake.burns = 'missing';
  addBurn(tx(61));
  assert.deepEqual((await check({ tx: tx(61) })).data, { error: 'not_ready' });
  fake.burns = 'down';
  assert.deepEqual((await check({ tx: tx(61) })).data, { error: 'busy' });
  fake.burns = 'ready';
  burnBurst.reset();
  for (let i = 0; i < 10; i++) await check({ tx: tx(61) });
  assert.deepEqual((await check({ tx: tx(61) })).data, { error: 'too_fast' }, '10 checks a minute per visitor');
});

test('a profile says whether burns are ready, and how many burned messages are left', async () => {
  const p = await post(wallet, { action: 'profile', session: session() });
  assert.deepEqual(p.data.burn, { ready: true, left: 0, bought: 0, agi: 0, today: 0, price: 10, perDay: 300 });
  fake.burns = 'missing';
  assert.deepEqual((await post(wallet, { action: 'profile', session: session() })).data.burn, { ready: false }, 'burns.sql not run: no burn buttons');
  fake.burns = 'down';
  assert.deepEqual((await post(wallet, { action: 'profile', session: session() })).data.burn, { ready: false });
});

test('the public counter: GET /api/wallet?burns, the same for everyone, and nothing else', async () => {
  process.env.BURN_PER_MESSAGE = '25';
  db.total = { agi: 12_340, messages: 1234, burns: 7, last_at: '2026-09-30T10:00:00.000+00:00' };
  db.burnedToday = 2300;
  const res = await walletGet(new Request('https://site.test/api/wallet?burns'));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ready: true, price: 25, perDay: 300,
    total: { agi: 12_340, messages: 1234, burns: 7, today: 2300, lastAt: Date.parse('2026-09-30T10:00:00Z') } });
  db.total.last_at = null;
  assert.equal((await (await walletGet(new Request('https://site.test/api/wallet?burns'))).json()).total.lastAt, null, 'no burn yet: no time');
  assert.match(res.headers.get('cache-control'), /s-maxage=60/);
  for (const q of ['', '?burns=1', '?burns&x=1', '?x']) {
    assert.equal((await walletGet(new Request(`https://site.test/api/wallet${q}`))).status, 405, q || '(none)');
  }
  assert.equal((await walletGet()).status, 405);
  fake.burns = 'missing';
  assert.deepEqual(await (await walletGet(new Request('https://site.test/api/wallet?burns'))).json(), { ready: false });
});

test('settings: the price and the daily cap', () => {
  assert.deepEqual([getConfig({}).burnPrice, getConfig({}).burnDailyCap], [10, 1000]);
  assert.equal(getConfig({ BURN_PER_MESSAGE: '100' }).burnPrice, 100);
  assert.equal(getConfig({ BURN_PER_MESSAGE: '0.5' }).burnPrice, 10, 'never less than one whole $AGI');
  assert.equal(getConfig({ BURN_PER_MESSAGE: 'lots' }).burnPrice, 10);
  assert.equal(getConfig({ BURN_DAILY_CAP: '250' }).burnDailyCap, 250);
  assert.deepEqual(packsFor(10), [{ messages: 100, agi: 1000 }, { messages: 500, agi: 5000 }, { messages: 1000, agi: 10000 }]);
  assert.equal(PAGE_BURN_ADDRESS, BURN_ADDRESS);
  assert.equal(BURN_ADDRESS, '0x000000000000000000000000000000000000dEaD');
});

// ---------- the chat ----------
const bw = (w = ALICE) => burnWallet(KEY, w);
async function credit(n, w = ALICE) {
  db.wallets[bw(w)] = { left: n, bought: n, agi: n * 10, day: null, used: 0, last: 0 };
}

test('chat: free messages first, then burned ones, each with how many are left', async () => {
  await credit(3);
  const free = await post(chat, chatBody({ session: session() }));
  assert.equal(free.status, 200);
  assert.equal(free.data.burned, null, 'a free message');
  assert.equal(called('burn_take').length, 0, 'burned messages wait until the free ones are used');

  fake.limit = 'person_cap';
  const paid = await post(chat, chatBody({ session: session() }));
  assert.equal(paid.status, 200);
  assert.equal(paid.data.reply, 'hi 💜');
  assert.deepEqual(paid.data.burned, { left: 2, today: 1 });
  const taken = called('burn_take')[0].body;
  assert.deepEqual({ ...taken, p_take: 'id' }, { p_wallet: bw(), p_per_day: 300, p_site_daily: 1000, p_min_gap_ms: 1, p_take: 'id' });
  assert.match(taken.p_take, /^[0-9a-f-]{36}$/, 'each burned message has its own id');
  assert.equal(checkVoiceTicket(SECRET, paid.data.voice, paid.data.reply).burned, 1, 'her voice allowance grows with it');

  fake.limit = 'global_cap';                                   // the whole site's free messages are used: burned ones still work
  const site = await post(chat, chatBody({ session: session() }));
  assert.deepEqual(site.data.burned, { left: 1, today: 2 });
});

test('chat: out of burned messages, their daily 300, the site cap, too fast, no wallet, burns.sql not run', async () => {
  fake.limit = 'person_cap';
  const none = await post(chat, chatBody({ session: session() }));
  assert.deepEqual([none.status, none.data.error, none.data.burn], [429, 'person_cap', undefined], 'none left: out of messages, as before');

  await credit(5);
  const code = bw();
  Object.assign(db.wallets[code], { day: today(), used: BURN_PER_DAY });
  const day = await post(chat, chatBody({ session: session() }));
  assert.deepEqual([day.status, day.data.error, day.data.burn], [429, 'person_cap', { why: 'day_cap', left: 5 }]);

  Object.assign(db.wallets[code], { used: 0 });
  db.days[today()] = 1000;
  const site = await post(chat, chatBody({ session: session() }));
  assert.deepEqual(site.data.burn, { why: 'site_cap', left: 5 });
  fake.limit = 'global_cap';
  const talkedOut = await post(chat, chatBody({ session: session() }));
  assert.deepEqual([talkedOut.status, talkedOut.data.error, talkedOut.data.burn], [503, 'global_cap', { why: 'site_cap', left: 5 }]);

  fake.limit = 'person_cap';
  db.days[today()] = 0;
  process.env.CHAT_MIN_GAP_MS = '60000';
  db.wallets[code].last = Date.now();
  assert.equal((await post(chat, chatBody({ session: session() }))).data.error, 'too_fast');
  process.env.CHAT_MIN_GAP_MS = '1';

  const stranger = await post(chat, chatBody());
  assert.equal(stranger.data.error, 'person_cap', 'no wallet: no burned messages');
  fake.burns = 'missing';
  const before = called('burn_take').length;
  const missing = await post(chat, chatBody({ session: session() }));
  assert.deepEqual([missing.data.error, missing.data.burn], ['person_cap', undefined], 'burns.sql not run: out of messages, as before');
  assert.equal(called('burn_take').length, before + 1);
});

test('chat: a burned message is given back when her reply fails (that one, once; the attempt still counts)', async () => {
  await credit(2);
  fake.limit = 'person_cap';
  fake.gemini = 'down';
  const r = await post(chat, chatBody({ session: session() }));
  assert.equal(r.data.error, 'ai_error');
  assert.equal(called('burn_refund').length, 1);
  assert.equal(called('burn_refund')[0].body.p_take, called('burn_take')[0].body.p_take, 'exactly the one taken');
  assert.deepEqual(db.wallets[bw()].left, 2, 'still 2 left');
  assert.equal(db.wallets[bw()].used, 1, 'the attempt still counts toward today (failures can\'t run up the AI bill)');
  fake.gemini = 'ok';
  assert.deepEqual((await post(chat, chatBody({ session: session() }))).data.burned, { left: 1, today: 2 }, 'the failed attempt counted today');
  fake.limit = 'ok';
  fake.gemini = 'down';
  await post(chat, chatBody({ session: session() }));
  assert.equal(called('burn_refund').length, 1, 'a free message is never "given back" as a burned one');
});

test('chat: what a wallet burned counts toward its level when the balance is read again', async () => {
  await credit(100);                                          // 1,000 $AGI burned
  chain.balances[ALICE] = 9_500n * TOKEN;
  const stale = makeSession(SECRET, { wallet: ALICE, level: 1, checkedAt: Date.now() - 31 * 60_000 });
  const r = await post(chat, chatBody({ session: stale }));
  assert.equal(r.data.level, 2, '9,500 held + 1,000 burned = Crush');
  fake.burns = 'missing';
  const r2 = await post(chat, chatBody({ session: stale }));
  assert.equal(r2.data.level, 1, 'without burns.sql: the balance alone, as before');
});

test('her voice: burned messages used today grow the visitor’s voice allowance (2 each)', async () => {
  const text = 'hi 💜';
  const plain = makeVoiceTicket(SECRET, text, { level: 1, mood: 'happy' });
  assert.equal(checkVoiceTicket(SECRET, plain, text).burned, 0);
  const paid = makeVoiceTicket(SECRET, text, { level: 1, mood: 'happy', burned: 7 });
  assert.equal(checkVoiceTicket(SECRET, paid, text).burned, 7);
  assert.equal(checkVoiceTicket(SECRET, makeVoiceTicket(SECRET, text, { burned: -3 }), text).burned, 0);
  const ask = (ticket) => post(voicePost, { text, ticket });
  await ask(plain);
  await ask(paid);
  const shares = called('voice_take').map((c) => c.body.p_person_daily);
  assert.deepEqual(shares, [voicePerDay(1), voicePerDay(1) + 14]);
});

// ---------- the page ----------
test('the page: a burn address to send to yourself, never a transaction, and the rules in plain words', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const dialog = html.match(/<dialog class="[^"]*bdlg[^"]*"[\s\S]*?<\/dialog>/)?.[0] || '';
  assert.ok(dialog, 'the burn dialog');
  assert.match(dialog, /data-burn-address/);
  assert.match(dialog, /never asks your wallet for a transaction/i);
  assert.match(dialog, /from your own wallet app/i);
  assert.match(dialog, /gone for good/i);
  assert.match(dialog, /not an investment/i);
  assert.match(dialog, /not financial advice/i);
  assert.match(dialog, /no refunds/i);
  assert.match(dialog, /7 days/);
  const code = readFileSync(new URL('../src/chat/burn.js', import.meta.url), 'utf8');
  assert.match(code, /BURN_ADDRESS/);
  assert.doesNotMatch(code, /eth_|\.request\(|ethereum/, 'the burn screen never talks to a wallet');
  const safety = html.match(/<footer[\s\S]*<\/footer>/)?.[0] || '';
  assert.match(safety, /burn/i, 'the safety note says it');
  assert.equal((html.match(/data-burn-only hidden/g) || []).length, 4, 'every sentence about burning waits until burns are open');
});

test('the burn monitor: a huge live number right above the chat, hidden until burns are open', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const mon = html.match(/<section class="burnmon"[\s\S]*?<\/section>/)?.[0] || '';
  assert.match(mon, /data-burnmon hidden/);
  assert.ok(html.indexOf('data-burnmon') < html.indexOf('<div class="pg" data-playground>'), 'on top of the chat');
  assert.ok(html.indexOf('data-burnmon') > html.indexOf('id="pg-title"'), 'inside the Playground, under its title');
  for (const part of ['data-burnmon-agi', 'data-burnmon-sub', 'data-burnmon-live', 'data-burnmon-proof', 'data-burn-open']) assert.ok(mon.includes(part), part);
  assert.match(mon, /Burned by chatting with AGI-1/);
  assert.match(mon, /Every burn is read on Robinhood Chain before it counts/);
  assert.match(mon, /rel="noopener noreferrer"/);
  assert.doesNotMatch(mon, /0x[0-9a-fA-F]{40}/, "the burn address's link is filled in by the page (one address in the markup: the burn screen's)");
  const code = readFileSync(new URL('../src/chat/burn.js', import.meta.url), 'utf8');
  assert.match(code, /BURN_EXPLORER/);
  assert.match(code, /prefers-reduced-motion/, 'the number counts up, except with "reduce motion"');
  assert.match(code, /IDLE_MS/, 'a forgotten tab stops asking');
});
