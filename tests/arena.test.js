// Tests for the Arena API (/api/arena and /api/vote). Supabase and Turnstile are faked. Run: npm test
// The SQL itself (supabase/arena.sql) was tested separately against a real Postgres (PGlite): see CLAUDE.md.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GET as getArena } from '../api/arena.js';
import { POST as vote, GET as voteGet } from '../api/vote.js';
import { makePass, visitorCode, ipGroup } from '../server/security.js';
import { COINS, ROUND_MS, OPENED, roundAt, weekStartRound } from '../server/arena.js';
import { voteBurst, votedThisRound } from '../server/burst.js';
import { forgetActiveSymbols } from '../server/coins.js';

const SECRET = 'test-pass-secret-that-is-long-enough-1234';
const ENV = { SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fake_key_123', TURNSTILE_SECRET_KEY: 'ts-secret', PASS_SECRET: SECRET };
let calls, db;

beforeEach(() => {
  Object.assign(process.env, ENV);
  calls = [];
  // coinsSql: false = supabase/coins.sql not run yet (the Arena keeps its first three coins), see tests/coins.test.js
  db = { votes: new Map(), status: 200, code: '', oldSql: false, champions: [], coinsSql: false, active: ['AGI', 'CABO', 'CLANKCAT'] };
  voteBurst.reset();
  votedThisRound.reset();
  forgetActiveSymbols();
  console.error = () => {};
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, headers: init.headers, body });
    if (url.startsWith('https://challenges.cloudflare.com/')) return Response.json({ success: body.response === 'good-token', action: body.response === 'good-token' ? 'vote' : 'chat' });
    if (db.status !== 200) return Response.json({ code: db.code, message: 'nope' }, { status: db.status });
    if (url.includes('/rpc/coin_')) {
      if (!db.coinsSql) return Response.json({ code: 'PGRST202', message: 'not found' }, { status: 404 });
      if (url.endsWith('/rpc/coin_active')) return Response.json(db.active);
    }
    if (url.endsWith('/rpc/arena_vote')) {
      if (!body.p_coins.includes(body.p_coin)) return Response.json('bad_coin');
      const key = `${body.p_round}|${body.p_who}`;
      if (db.votes.has(key)) return Response.json('already');
      db.votes.set(key, body.p_coin);
      return Response.json('ok');
    }
    if (url.endsWith('/rpc/arena_state')) {
      // a database that still has the arena.sql from before Phase 4 doesn't know p_week_start
      if (db.oldSql && 'p_week_start' in body) return Response.json({ code: 'PGRST202', message: 'not found' }, { status: 404 });
      return Response.json({ tally: { AGI: 3 }, recent: [{ round: body.p_round - 1, coin: 'CABO', votes: 2 }], crowns: { CABO: 1 },
        ...('p_week_start' in body ? { week: { CABO: 1 } } : {}) });
    }
    if (url.endsWith('/rpc/arena_history')) {
      if (db.oldSql) return Response.json({ code: 'PGRST202', message: 'not found' }, { status: 404 });
      return Response.json(db.champions.filter((c) => c.round < body.p_before).slice(0, body.p_limit));
    }
    throw new Error('unexpected request to ' + url);
  };
});

const send = async (payload, { ip = '1.2.3.4', type = 'application/json', raw } = {}) => {
  const res = await vote(new Request('https://site.test/api/vote', {
    method: 'POST', headers: { 'content-type': type, 'x-real-ip': ip }, body: raw ?? JSON.stringify(payload),
  }));
  return { status: res.status, data: await res.json() };
};

const arena = (query = '') => getArena(new Request(`https://site.test/api/arena${query}`));

test('scoreboard: shared answer the CDN may cache for a few seconds', async () => {
  const res = await getArena();
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.match(res.headers.get('cache-control'), /s-maxage=10/);
  assert.equal(data.round, roundAt(data.now));
  assert.equal(data.endsAt, (data.round + 1) * ROUND_MS);
  assert.deepEqual(data.coins.map((c) => c.symbol), COINS, 'before coins.sql: the first three coins');
  assert.equal(data.candidates, null, 'before coins.sql: nominations "open soon"');
  assert.deepEqual(data.tally, { AGI: 3 });
  assert.equal(data.recent[0].coin, 'CABO');
  assert.ok(Number.isInteger(data.recent[0].number) && data.number > 0);
  assert.equal(calls[0].headers.apikey, ENV.SUPABASE_SECRET_KEY);
  assert.equal(calls[0].headers.Authorization, undefined);
});

test('scoreboard before arena.sql was run: "not_ready", never cached', async () => {
  db.status = 404; db.code = 'PGRST202';
  const res = await getArena();
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, 'not_ready');
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('a vote needs JSON, a known coin and a human check', async () => {
  assert.equal((await send({ coin: 'AGI' }, { type: 'text/plain' })).status, 415);
  assert.equal((await send(null, { raw: '{nope' })).status, 400);
  assert.equal((await send({ coin: '<script>' })).data.error, 'bad_coin');
  assert.equal((await send({ coin: 'AGI' })).data.error, 'human_check');
  assert.equal((await send({ coin: 'AGI', turnstileToken: 'bad-token' })).data.error, 'human_check');
  assert.equal(calls.filter((c) => c.url.includes('/rpc/')).length, 0, 'the database is never touched before the human check');
  assert.equal((await send({ coin: 'SCAM', turnstileToken: 'good-token' })).data.error, 'bad_coin', 'not a coin in the Arena');
  assert.equal(calls.filter((c) => c.url.endsWith('/rpc/arena_vote')).length, 0);
  assert.equal((await voteGet()).status, 405);
});

test('one vote per visitor per round; the pass skips the next human check', async () => {
  const first = await send({ coin: 'CABO', turnstileToken: 'good-token' });
  assert.equal(first.status, 200);
  assert.equal(first.data.coin, 'CABO');
  assert.ok(first.data.pass, 'a 2-hour pass comes back');
  const again = await send({ coin: 'AGI', pass: first.data.pass });
  assert.equal(again.status, 409);
  assert.equal(again.data.error, 'already_voted');
  assert.equal(calls.filter((c) => c.url.startsWith('https://challenges.cloudflare.com/')).length, 1, 'the pass was used the second time');
  const other = await send({ coin: 'AGI', turnstileToken: 'good-token' }, { ip: '5.6.7.8' });
  assert.equal(other.status, 200, 'another visitor can vote');
  const rpc = calls.find((c) => c.url.endsWith('/rpc/arena_vote'));
  assert.equal(rpc.body.p_round, roundAt(), 'the round comes from the server clock');
  assert.ok(!JSON.stringify(rpc.body).includes('1.2.3.4'), 'no raw IP is sent to the database');
});

test('a chat pass works for voting too (same human, same 2 hours)', async () => {
  const pass = makePass(SECRET, visitorCode(SECRET, '9.9.9.9'));
  const r = await send({ coin: 'CLANKCAT', pass }, { ip: '9.9.9.9' });
  assert.equal(r.status, 200);
  assert.equal(r.data.pass, null, 'no new pass needed');
});

test('database down or not set up: no vote (fail closed)', async () => {
  db.status = 500;
  assert.equal((await send({ coin: 'AGI', turnstileToken: 'good-token' })).data.error, 'busy');
  db.status = 404; db.code = 'PGRST202';
  assert.equal((await send({ coin: 'AGI', turnstileToken: 'good-token' })).data.error, 'not_ready');
  delete process.env.TURNSTILE_SECRET_KEY;
  assert.equal((await send({ coin: 'AGI', turnstileToken: 'good-token' })).data.error, 'not_configured');
});

// ---------- Phase 4: Hall of Fame, round history, anti-bot ----------
test('scoreboard: crowns this week (since Monday 00:00 UTC) next to all-time crowns', async () => {
  const res = await arena();
  const data = await res.json();
  assert.deepEqual(data.week, { CABO: 1 });
  assert.deepEqual(data.crowns, { CABO: 1 });
  const state = calls.find((c) => c.url.endsWith('/rpc/arena_state'));
  assert.equal(state.body.p_week_start, weekStartRound(data.now));
  const monday = new Date(data.weekStart);
  assert.equal(monday.getUTCDay(), 1, 'a Monday');
  assert.equal(monday.getUTCHours() + monday.getUTCMinutes(), 0, 'at 00:00 UTC');
  assert.ok(data.now - data.weekStart < 7 * 24 * 3600e3 && data.now >= data.weekStart);
  // the week starts on Monday even on a Sunday night, and on Monday itself
  assert.equal(weekStartRound(Date.UTC(2026, 8, 27, 23, 59)), roundAt(Date.UTC(2026, 8, 21)));   // Sun 27 Sep → Mon 21 Sep
  assert.equal(weekStartRound(Date.UTC(2026, 8, 28, 0, 0)), roundAt(Date.UTC(2026, 8, 28)));     // Mon 28 Sep
});

test('before arena.sql is run again for Phase 4, the Arena keeps working without "This week"', async () => {
  db.oldSql = true;
  const res = await arena();
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.week, null);
  assert.deepEqual(data.tally, { AGI: 3 });
  const older = await arena(`?before=${roundAt()}`);
  assert.equal(older.status, 503);
  assert.equal((await older.json()).error, 'not_ready');
});

test('round history: older champions page by page, checked input, cached a minute', async () => {
  const now = roundAt();
  db.champions = Array.from({ length: 30 }, (_, i) => ({ round: now - 1 - i, coin: COINS[i % 3], votes: i + 1 }));
  const res = await arena(`?before=${now - 12}&limit=24`);
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.match(res.headers.get('cache-control'), /s-maxage=60/);
  assert.equal(data.history.length, 18);
  assert.ok(data.history.every((c) => c.round < now - 12 && Number.isInteger(c.number)));
  const call = calls.find((c) => c.url.endsWith('/rpc/arena_history'));
  assert.deepEqual(call.body, { p_before: now - 12, p_limit: 24 });
  for (const q of ['?before=abc', `?before=${now + 5}`, `?before=${OPENED}`, `?before=${now}&limit=0`, `?before=${now}&limit=500`, `?before=${now}&limit=2.5`]) {
    const r = await arena(q);
    assert.equal(r.status, 400, q);
    assert.equal(r.headers.get('cache-control'), 'no-store');
  }
});

test('IPv6: a whole /64 block is one visitor (one vote per round), IPv4 stays as it is', async () => {
  assert.equal(ipGroup('2001:db8:abcd:12:1:2:3:4'), '2001:db8:abcd:12::/64');
  assert.equal(ipGroup('2001:DB8:ABCD:0012::99'), '2001:db8:abcd:12::/64');
  assert.equal(ipGroup('::ffff:1.2.3.4'), '1.2.3.4');
  assert.equal(ipGroup('1.2.3.4'), '1.2.3.4');
  assert.equal(ipGroup('fe80::1%eth0'), 'fe80:0:0:0::/64');
  const a = await send({ coin: 'AGI', turnstileToken: 'good-token' }, { ip: '2001:db8:abcd:12::1' });
  assert.equal(a.status, 200);
  const b = await send({ coin: 'CABO', turnstileToken: 'good-token' }, { ip: '2001:db8:abcd:12:ffff:ffff:ffff:ffff' });
  assert.equal(b.status, 409, 'another address in the same /64 already voted');
  const c = await send({ coin: 'CABO', turnstileToken: 'good-token' }, { ip: '2001:db8:abcd:13::1' });
  assert.equal(c.status, 200, 'the next /64 is someone else');
  // a pass earned in the block works anywhere in the block
  const pass = makePass(SECRET, visitorCode(SECRET, '2001:db8:abcd:14::1'));
  assert.equal((await send({ coin: 'AGI', pass }, { ip: '2001:db8:abcd:14::2' })).status, 200);
});

test('speed bump: a visitor hammering the vote endpoint gets "slow_down" before Cloudflare or the database is asked', async () => {
  for (let i = 0; i < 12; i++) await send({ coin: 'AGI' }, { ip: '7.7.7.7' });      // no token: 401 each time, no outside calls
  assert.equal(calls.length, 0);
  const r = await send({ coin: 'AGI', turnstileToken: 'good-token' }, { ip: '7.7.7.7' });
  assert.equal(r.status, 429);
  assert.equal(r.data.error, 'slow_down');
  assert.equal(calls.length, 0, 'nothing outside was called');
  assert.equal((await send({ coin: 'AGI', turnstileToken: 'good-token' }, { ip: '7.7.7.8' })).status, 200, 'other visitors are not affected');
});

test('a repeat vote in the same round is answered from memory, without the database', async () => {
  const first = await send({ coin: 'AGI', turnstileToken: 'good-token' }, { ip: '8.8.8.8' });
  assert.equal(first.status, 200);
  const before = calls.filter((c) => c.url.endsWith('/rpc/arena_vote')).length;
  const again = await send({ coin: 'CABO', pass: first.data.pass }, { ip: '8.8.8.8' });
  assert.equal(again.status, 409);
  assert.equal(again.data.error, 'already_voted');
  assert.equal(calls.filter((c) => c.url.endsWith('/rpc/arena_vote')).length, before, 'no second database call');
});
