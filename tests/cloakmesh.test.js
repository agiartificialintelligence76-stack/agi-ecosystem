// CloakMesh (2026-10-03, the owner's private-AI project): its page at inference.agi1.app (/cloakmesh), the waitlist
// (/api/cloakmesh, supabase/cloakmesh.sql: here a small stand-in database; the SQL itself is checked in PGlite) and the
// page's demo filter, which runs only in the visitor's browser. Supabase and Cloudflare are fakes: no keys, no cost.
// Run: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { checkEmail } from '../src/cloakmesh/email.js';
import {
  findValues, scrub, tokenMaker, plainTokenMaker, restore, exampleAnswer, base32, normalized, foundInWords, ORDER, KINDS, KINDS_MANY,
} from '../src/cloakmesh/demo.js';
import { JOIN_WORDS, joinWords, WORDS, demoLine } from '../src/cloakmesh/words.js';
import { ROLES, WAITLIST, LEAVE_TOKEN, cloakmeshReady } from '../server/cloakmesh.js';
import { getConfig } from '../server/config.js';
import { waitlistBurst } from '../server/burst.js';
import { GET, POST } from '../api/cloakmesh.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const SECRET = 'test-pass-secret-that-is-long-enough-1234';
const ENV = {
  SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fake_key_123', TURNSTILE_SECRET_KEY: 'fake-turnstile',
  PASS_SECRET: SECRET,
};

// ---------- a small stand-in for supabase/cloakmesh.sql ----------
function waitlistDb() {
  const rows = new Map();           // email → { role, token }
  const days = new Map();           // who → tries today
  let n = 0;
  const token = () => (++n).toString(16).padStart(64, 'a');
  return {
    rows, days,
    cloakmesh_ready: () => true,
    cloakmesh_join({ p_email, p_role, p_who, p_person_daily, p_site_daily }) {
      if (!p_email || p_email !== p_email.toLowerCase() || !ROLES.includes(p_role) || !p_who || p_who.length < 16) return { ok: false, why: 'bad' };
      days.set('site', (days.get('site') || 0) + 1);
      if (days.get('site') > p_site_daily) return { ok: false, why: 'site_cap' };
      days.set(p_who, (days.get(p_who) || 0) + 1);
      if (days.get(p_who) > p_person_daily) return { ok: false, why: 'person_cap' };
      const row = rows.get(p_email) || { token: token() };
      row.role = p_role;
      rows.set(p_email, row);
      return { ok: true, token: row.token };
    },
    cloakmesh_leave({ p_token }) {
      if (!/^[0-9a-f]{64}$/.test(p_token || '')) return { ok: false, why: 'bad' };
      for (const [email, row] of rows) if (row.token === p_token) { rows.delete(email); return { ok: true, removed: true }; }
      return { ok: true, removed: false };
    },
  };
}

let fake, calls, logs;
beforeEach(() => {
  for (const k of ['GEMINI_API_KEY', 'SITE_URL']) delete process.env[k];
  Object.assign(process.env, ENV);
  waitlistBurst.reset();
  logs = [];
  console.error = (...a) => logs.push(['error', a.join(' ')]);
  console.warn = (...a) => logs.push(['warn', a.join(' ')]);
  console.log = (...a) => logs.push(['log', a.join(' ')]);
  calls = [];
  fake = { db: waitlistDb(), dbDown: false, sqlMissing: false, human: 'good-token', action: 'waitlist' };
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, body, headers: init.headers });
    if (url.startsWith('https://challenges.cloudflare.com/')) return Response.json({ success: body.response === fake.human, action: fake.action });
    const rpc = /\/rest\/v1\/rpc\/(\w+)$/.exec(url);
    if (rpc) {
      if (fake.dbDown) return new Response('{"code":"XX000","message":"down"}', { status: 500 });
      if (fake.sqlMissing) return new Response('{"code":"PGRST202","message":"not found"}', { status: 404 });
      const fn = fake.db[rpc[1]];
      if (!fn) throw new Error(`unexpected database function ${rpc[1]}`);
      return Response.json(fn.call(fake.db, body) ?? null);
    }
    throw new Error('unexpected request to ' + url);
  };
});
const called = (part) => calls.filter((c) => c.url.includes(part));
const get = async (query = '') => {
  const res = await GET(new Request(`https://inference.agi1.app/api/cloakmesh${query}`, { headers: { 'x-real-ip': '1.2.3.4' } }));
  return { status: res.status, data: await res.json(), cache: res.headers.get('cache-control') };
};
const post = async (body, { ip = '1.2.3.4', raw = null, type = 'application/json' } = {}) => {
  const res = await POST(new Request('https://inference.agi1.app/api/cloakmesh', { method: 'POST', headers: { 'content-type': type, 'x-real-ip': ip }, body: raw ?? JSON.stringify(body) }));
  return { status: res.status, data: await res.json(), cache: res.headers.get('cache-control') };
};
const join = (extra = {}, opts) => post({ action: 'join', email: 'Anna.K@Company.io', role: 'build', turnstileToken: 'good-token', ...extra }, opts);

// ---------- email addresses ----------
test('an email address: plain addresses, lowercase; never spaces, quotes, IP addresses, missing parts or the example names', () => {
  for (const [raw, email] of [
    ['anna@company.io', 'anna@company.io'], ['  Anna.K@Company.IO ', 'anna.k@company.io'], ['a.b-c+tag@mail.co.uk', 'a.b-c+tag@mail.co.uk'],
    ["o'neil@firm.ie", "o'neil@firm.ie"], ['x_y@sub.domain.dev', 'x_y@sub.domain.dev'], ['ｆｕｌｌ@ｗｉｄｔｈ.com', 'full@width.com'],
    ['me@xn--bcher-kva.ch', 'me@xn--bcher-kva.ch'], [`${'a'.repeat(64)}@b.co`, `${'a'.repeat(64)}@b.co`],
  ]) {
    assert.deepEqual(checkEmail(raw), { ok: true, email }, raw);
  }
  for (const raw of [
    '', 'anna', 'anna@', '@company.io', 'anna@company', 'anna@@company.io', 'an na@company.io', 'anna@comp any.io', '"anna"@company.io',
    'anna@[1.2.3.4]', 'anna@1.2.3.4', 'anna@company.i', 'anna@company.123', '.anna@company.io', 'anna.@company.io', 'an..na@company.io',
    'anna@-company.io', 'anna@company-.io', 'anna@company..io', `${'a'.repeat(65)}@b.co`, `a@${'b'.repeat(250)}.co`, 'ånna@company.io',
    'anna@example.com', 'anna@example.org', 'anna@mail.example.net', 'anna@site.test', 'anna@x.invalid', 'anna@localhost', 'anna@box.local',
    null, 42, {}, 'a'.repeat(400),
  ]) {
    assert.equal(checkEmail(raw).ok, false, String(raw));
  }
  assert.equal(read('server/cloakmesh.js').includes("from '../src/cloakmesh/email.js'"), true, 'one rule for the page and our server');
});

// ---------- the waitlist's API ----------
test('GET /api/cloakmesh: whether the waitlist is open, the same for everyone (a minute on the CDN), nothing else', async () => {
  let r = await get();
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { ready: true });
  assert.match(r.cache, /s-maxage=60/);
  assert.deepEqual((await get('?x=1')).data, { error: 'bad_request' });
  fake.sqlMissing = true;
  r = await get();
  assert.deepEqual(r.data, { ready: false }, 'supabase/cloakmesh.sql not run: not open');
  fake.sqlMissing = false;
  fake.dbDown = true;
  r = await get();
  assert.equal(r.status, 503);
  fake.dbDown = false;
  delete process.env.TURNSTILE_SECRET_KEY;
  const asked = calls.length;
  r = await get();
  assert.deepEqual(r.data, { ready: false }, 'not set up: not open');
  assert.equal(calls.length, asked, 'not set up: the database isn\'t even asked');
});

test('joining: its checks before anything is asked; the human check made for "waitlist"; a leave link; the same answer for an address already there', async () => {
  // checked before the human check or the database
  for (const [body, error, status] of [
    [{ email: 'not an email' }, 'email', 400], [{ email: 'anna@example.com' }, 'email', 400], [{ role: 'admin' }, 'bad_request', 400],
    [{ role: undefined }, 'bad_request', 400],
  ]) {
    const r = await join(body);
    assert.equal(r.status, status, JSON.stringify(body));
    assert.equal(r.data.error, error);
  }
  assert.equal(calls.length, 0, 'nothing asked for a bad request');
  assert.equal((await post(null, { raw: '{bad json' })).status, 400);
  assert.equal((await post({ action: 'join' }, { type: 'text/plain' })).status, 415);
  assert.equal((await post(null, { raw: JSON.stringify({ action: 'join', email: 'x'.repeat(3000) }) })).status, 413);
  assert.equal((await post({ action: 'nope' })).data.error, 'bad_request');
  assert.equal((await post([1, 2])).data.error, 'bad_request');

  // the human check
  let r = await join({ turnstileToken: 'wrong' });
  assert.deepEqual([r.status, r.data.error], [401, 'human_check']);
  assert.equal(called('/rpc/').length, 0, 'no human, no database');
  fake.action = 'chat';
  r = await join();
  assert.equal(r.status, 401, 'a token made for another widget (the chat) doesn\'t count');
  fake.action = 'waitlist';

  r = await join();
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
  assert.match(r.data.leave, LEAVE_TOKEN);
  assert.equal(typeof r.data.pass, 'string', 'a 2-hour pass, like the chat\'s');
  assert.equal(r.cache, 'no-store');
  const joinCall = called('/rpc/cloakmesh_join').at(-1).body;
  assert.equal(joinCall.p_email, 'anna.k@company.io', 'lowercase');
  assert.equal(joinCall.p_role, 'build');
  assert.match(joinCall.p_who, /^w:[A-Za-z0-9_-]{32}$/, 'a daily code of the visitor, never their address');
  assert.equal(JSON.stringify(calls).includes('1.2.3.4'), true, 'Cloudflare gets the address for its check…');
  assert.equal(JSON.stringify(called('/rpc/')).includes('1.2.3.4'), false, '…the database never does');
  assert.deepEqual([joinCall.p_person_daily, joinCall.p_site_daily], [WAITLIST.PERSON_DAILY, WAITLIST.SITE_DAILY]);
  const turnstile = called('challenges.cloudflare.com').at(-1);
  assert.equal(turnstile.body.secret, 'fake-turnstile');

  // the same address again, from someone else, written differently: the same answer, the same link, one row
  const again = await join({ email: 'anna.k@company.io', role: 'node' }, { ip: '5.6.7.8' });
  assert.equal(again.data.leave, r.data.leave);
  assert.equal(fake.db.rows.size, 1);
  assert.equal(fake.db.rows.get('anna.k@company.io').role, 'node', 'the newest choice');
  assert.deepEqual(Object.keys(again.data).sort(), Object.keys(r.data).sort(), 'nothing in the answer says it was already there');

  // with the pass: no human check this time
  const before = called('challenges.cloudflare.com').length;
  const withPass = await post({ action: 'join', email: 'ben@company.io', role: 'use', pass: r.data.pass });
  assert.equal(withPass.status, 200);
  assert.equal(called('challenges.cloudflare.com').length, before);
  assert.equal(withPass.data.pass, null);

  // nothing logged about anyone
  const log = JSON.stringify(logs);
  for (const secret of ['anna', 'ben@', r.data.leave, '1.2.3.4']) assert.equal(log.includes(secret), false, `${secret} isn't logged`);
});

test('joining: the daily limits, too fast, and the database missing or down', async () => {
  for (let i = 0; i < WAITLIST.PERSON_DAILY; i += 1) assert.equal((await join({ email: `p${i}@company.io` })).status, 200);
  let r = await join({ email: 'p9@company.io' });
  assert.deepEqual([r.status, r.data.error], [429, 'person_cap']);
  assert.equal(fake.db.rows.has('p9@company.io'), false);
  r = await join({ email: 'q1@company.io' }, { ip: '9.9.9.9' });
  assert.equal(r.status, 200, 'another visitor still can');
  fake.db.days.set('site', WAITLIST.SITE_DAILY);
  r = await join({ email: 'q2@company.io' }, { ip: '8.8.8.8' });
  assert.deepEqual([r.status, r.data.error], [503, 'site_cap']);
  assert.match(JSON.stringify(logs), /sign-ups for today are used up/);

  waitlistBurst.reset();
  fake.db = waitlistDb();
  fake.sqlMissing = true;
  r = await join();
  assert.deepEqual([r.status, r.data.error], [503, 'not_ready']);
  assert.match(JSON.stringify(logs), /run supabase\/cloakmesh\.sql/);
  fake.sqlMissing = false;
  fake.dbDown = true;
  r = await join();
  assert.deepEqual([r.status, r.data.error], [503, 'busy']);
  fake.dbDown = false;

  waitlistBurst.reset();
  for (let i = 0; i < 10; i += 1) await join({ turnstileToken: 'wrong' }, { ip: '7.7.7.7' });
  const humanChecks = called('challenges.cloudflare.com').length;
  r = await join({}, { ip: '7.7.7.7' });
  assert.deepEqual([r.status, r.data.error], [429, 'too_fast'], 'the 11th try in a minute');
  assert.equal(called('challenges.cloudflare.com').length, humanChecks, '…stopped before the human check');

  delete process.env.PASS_SECRET;
  r = await join();
  assert.deepEqual([r.status, r.data.error], [503, 'not_configured']);
  assert.equal(cloakmeshReady(getConfig()), false);
});

test('leaving: with the link\'s code only (no human check); the row gone for good; the same link again changes nothing', async () => {
  const { data } = await join();
  const human = called('challenges.cloudflare.com').length;
  for (const token of [undefined, '', 'x'.repeat(64), data.leave.toUpperCase(), data.leave.slice(1), `${data.leave}0`]) {
    const r = await post({ action: 'leave', token });
    assert.deepEqual([r.status, r.data.error], [400, 'bad_token'], String(token));
  }
  assert.equal(called('/rpc/cloakmesh_leave').length, 0, 'a bad code asks nothing');
  let r = await post({ action: 'leave', token: data.leave });
  assert.deepEqual(r.data, { ok: true, removed: true });
  assert.equal(fake.db.rows.size, 0);
  r = await post({ action: 'leave', token: data.leave });
  assert.deepEqual(r.data, { ok: true, removed: false });
  assert.equal(called('challenges.cloudflare.com').length, human, 'no human check for leaving');
  fake.sqlMissing = true;
  assert.equal((await post({ action: 'leave', token: data.leave })).data.error, 'not_ready');
  fake.sqlMissing = false;
  fake.dbDown = true;
  assert.equal((await post({ action: 'leave', token: data.leave })).data.error, 'busy');
  assert.equal(JSON.stringify(logs).includes(data.leave), false, 'the code is never logged');
});

test('supabase/cloakmesh.sql: only adds its own tables, row level security on, only the server key, and what the server calls', () => {
  const sql = read('supabase/cloakmesh.sql');
  const tables = [...sql.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1]);
  assert.deepEqual(tables, ['agi1_cloakmesh_waitlist', 'agi1_cloakmesh_days']);
  for (const t of tables) {
    assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security`));
    assert.match(sql, new RegExp(`revoke all on table public\\.${t} from anon, authenticated`));
  }
  assert.doesNotMatch(sql, /\b(drop|truncate|alter table public\.(?!agi1_cloakmesh_))/i, 'never changes anything else');
  const fns = [...sql.matchAll(/create or replace function public\.(\w+)/g)].map((m) => m[1]);
  assert.deepEqual(fns, ['cloakmesh_ready', 'cloakmesh_join', 'cloakmesh_leave']);
  for (const f of fns) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${f}\\([^)]*\\) from public, anon, authenticated`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${f}\\([^)]*\\) to service_role`));
    assert.match(read('server/limits.js'), /cloakmesh_ready', 'cloakmesh_join', 'cloakmesh_leave'/, 'its "run the SQL" hint');
  }
  assert.match(sql, /cloakmesh_functions_found = 3/);
  assert.match(sql, /select count\(\*\) as cloakmesh_functions_found/);
  // the server calls exactly these, with these arguments
  const server = read('server/cloakmesh.js');
  for (const a of ['p_email', 'p_role', 'p_who', 'p_person_daily', 'p_site_daily', 'p_token']) {
    assert.match(server, new RegExp(a));
    assert.match(sql, new RegExp(a));
  }
});

// ---------- the demo (in the visitor's browser only) ----------
const sample = "Hi, I'm Anna Kowalski. My card 4111 1111 1111 1111 was charged twice last week. Please email me at anna.k@example.org or call +44 20 7946 0958. My online banking password is Tulip-Rain-42.";
const kinds = (text) => findValues(text).map((f) => `${f.category}=${f.value}`);

test('the demo finds what the real filter would: names after a cue, cards, emails, phones, IBANs, IDs, secrets, keys, seed phrases, wallets', () => {
  assert.deepEqual(kinds(sample), ['PERSON=Anna Kowalski', 'CARD=4111 1111 1111 1111', 'EMAIL=anna.k@example.org', 'PHONE=+44 20 7946 0958', 'SECRET=Tulip-Rain-42']);
  assert.deepEqual(kinds('Dear Dr. Lee, thanks. Regards, Jane O\'Neil'), ['PERSON=Lee', "PERSON=Jane O'Neil"]);
  assert.deepEqual(kinds('Thanks, Anna. Anna will call later. Mr. Smith agreed.'), ['PERSON=Anna', 'PERSON=Anna', 'PERSON=Smith']);
  assert.deepEqual(kinds("I'm Łukasz Żółć and this is McDonald"), ['PERSON=Łukasz Żółć']);
  assert.deepEqual(kinds('card 4111 1111 1111 1111 2 times, ref 12 5555 5555 5555 4444, 378282246310005 0'),
    ['CARD=4111 1111 1111 1111', 'CARD=5555 5555 5555 4444', 'CARD=378282246310005'], 'the card inside a longer run of numbers');
  assert.deepEqual(kinds('IBAN: DE89 3704 0044 0532 0130 00, SSN 123-45-6789, NINO AB 12 34 56 C, IP 192.168.1.20'),
    ['IBAN=DE89 3704 0044 0532 0130 00', 'GOV_ID=123-45-6789', 'GOV_ID=AB 12 34 56 C', 'IP_ADDRESS=192.168.1.20']);
  assert.deepEqual(kinds('Call 555-867-5309 or (212) 555-0198 or 020 7946 0958.'), ['PHONE=555-867-5309', 'PHONE=(212) 555-0198', 'PHONE=020 7946 0958']);
  assert.deepEqual(kinds('pin this tab please; pin: 4321; password=sunshine99; my pwd is hunter2x'), ['SECRET=4321', 'SECRET=sunshine99', 'SECRET=hunter2x']);
  const seed = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
  assert.deepEqual(kinds(`my seed phrase is: ${seed}`), [`SEED_PHRASE=${seed}`]);
  const wallet = '0x52908400098527886E0F7030069857D2E4169EE7', key = `0x${'4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318'}`;
  assert.deepEqual(kinds(`Wallet ${wallet} and private key: ${key}`), [`CRYPTO_ADDRESS=${wallet}`, `CRYPTO_PRIVATE_KEY=${key}`]);
  // (keys built here from pieces, so no file in the repo looks like a real one)
  const apiKey = ['gh', 'p_', 'R'.repeat(36)].join('');
  assert.deepEqual(kinds(`token for the bot: ${apiKey}`), [`API_KEY=${apiKey}`]);
  const pem = ['-----BEGIN ', 'PRIVATE KEY-----\nMIIBVQIBADANBgkq\n-----END ', 'PRIVATE KEY-----'].join('');
  assert.deepEqual(kinds(`here: ${pem} ok`), [`PRIVATE_KEY=${pem}`]);
});

test('the demo leaves ordinary writing alone: greetings, capitalized words, numbers that fail their checks, version numbers, dates', () => {
  for (const text of [
    'Hello World! I\'m Happy to help. This is Important. Thanks for the info.', 'Hi team, it\'s Monday.', 'Dear Sir, hi all, hey guys',
    'Card 4111 1111 1111 1112 (fails the Luhn check)', 'ref 3782822463100050 (an Amex number is 15 digits)', 'id 41111111111111112', 'IBAN DE89 3704 0044 0532 0130 01 (wrong check digits)', 'version 1.2.3.4, build v2.0.0.1',
    'Date 2026-10-03 at 14:30', 'the password is correct and the token is valid', 'I paid 1200 dollars in 2026', 'call me maybe',
  ]) {
    assert.deepEqual(kinds(text), [], text);
  }
});

test('the demo\'s tokens: [CATEGORY_CODE], HMAC-SHA256 under a key made for the visit, base32; the same value the same token; the map back restores every text', async () => {
  assert.equal(base32(Buffer.from('foobar')), 'MZXW6YTBOI', 'RFC 4648');
  assert.equal(base32(Buffer.from('f')), 'MY');
  const key = new Uint8Array(32).fill(7);
  const make = await tokenMaker(key);
  const expected = `[EMAIL_${base32(createHmac('sha256', Buffer.from(key)).update('EMAIL\u001fanna.k@example.org').digest()).slice(0, 8)}]`;
  assert.equal(await make('EMAIL', 'anna.k@example.org'), expected);
  assert.equal(await make('EMAIL', 'Anna.K@Example.org'), expected, 'written differently, the same value');
  assert.equal(await make('CARD', '4111 1111 1111 1111'), await make('CARD', '4111111111111111'));
  assert.notEqual(await (await tokenMaker(new Uint8Array(32).fill(8)))('EMAIL', 'anna.k@example.org'), expected, 'another visit, other tokens');
  assert.equal(normalized('IBAN', 'de89 3704'), 'DE893704');

  const texts = [sample, 'Thanks, Anna. Anna will call Kowalski later.', 'nothing here', '', 'Dear Dr. Lee, pin: 4321; Lee again',
    `${sample}\n${sample}`, 'IBAN: DE89 3704 0044 0532 0130 00 and 4111111111111111'];
  for (const maker of [make, plainTokenMaker('salt')]) {
    for (const text of texts) {
      const r = await scrub(text, maker);
      assert.equal(restore(r.text, r.map), text, `round trip: ${text.slice(0, 30)}`);
      for (const f of r.found) assert.equal(r.text.includes(f.value), false, `${f.value} never leaves`);
      for (const t of r.text.match(/\[[A-Z_]+_[A-Z2-7]{8}\]/g) || []) assert.ok(r.map.has(t));
      assert.equal(r.parts.map((p) => p.text).join(''), r.text);
    }
  }
  const twice = await scrub("I'm Anna Kowalski. Anna Kowalski wrote again, and so did anna kowalski's friend", make);
  assert.equal((twice.text.match(/\[PERSON_/g) || []).length, 2, 'the name as written, twice (not the lowercase one)');
  assert.equal(new Set(twice.text.match(/\[PERSON_[A-Z2-7]{8}\]/g)).size, 1, 'the same name, one token');
  assert.equal(restore('[EMAIL_AAAAAAAA] stays', new Map()), '[EMAIL_AAAAAAAA] stays', 'an unknown token stays as it is');
});

test('the demo\'s answer: written with tokens only, readable once restored; its line says what was replaced', async () => {
  const r = await scrub(sample, await tokenMaker(new Uint8Array(32)));
  const answer = exampleAnswer(r);
  for (const f of r.found) assert.equal(answer.includes(f.value), false, `the model never sees ${f.value}`);
  const readBack = restore(answer, r.map);
  for (const v of ['Anna Kowalski', '4111 1111 1111 1111', 'anna.k@example.org', '+44 20 7946 0958', 'Tulip-Rain-42']) assert.ok(readBack.includes(v), v);
  assert.match(answer, /looks like a password or secret/);
  assert.match(exampleAnswer(await scrub('nothing to see', plainTokenMaker())), /^Here's a reply you can send:/);
  assert.equal(demoLine(foundInWords(r.found)), 'Replaced: a name, a card number, an email address, a phone number and a password or secret. Nothing was sent.');
  assert.equal(demoLine(foundInWords(findValues('a@b.io and c@d.io'))), 'Replaced: 2 email addresses. Nothing was sent.');
  assert.match(demoLine([]), /^Nothing to hide/);
  for (const c of ORDER) assert.ok(KINDS[c] && KINDS_MANY[c], c);
});

test('the demo is fast and safe on anything typed (2,000 characters of the worst cases)', async () => {
  const nasty = ['a'.repeat(2000), '1 '.repeat(1000), "I'm ".repeat(500), 'Anna '.repeat(400), '@'.repeat(2000), 'password '.repeat(220),
    '+1 '.repeat(660), `seed phrase ${'abc '.repeat(480)}`, `${'-----BEGIN '}${'PRIVATE KEY-----'}${'x'.repeat(1900)}`, 'Ab'.repeat(1000),
    '0x'.repeat(1000), '4111 '.repeat(400)];
  for (const text of nasty) {
    const t0 = performance.now();
    const r = await scrub(text, plainTokenMaker());
    const ms = performance.now() - t0;
    assert.ok(ms < 400, `${text.slice(0, 12)}…: ${ms.toFixed(0)} ms`);
    assert.equal(restore(r.text, r.map), text);
  }
});

test('the demo never sends or keeps anything: no network, no storage, nothing but text on the page', () => {
  const demo = read('src/cloakmesh/demo.js');
  assert.doesNotMatch(demo, /\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|import\(|new Image|localStorage|sessionStorage|indexedDB|document\.cookie/);
  const page = read('src/cloakmesh/page.js');
  assert.doesNotMatch(page, /innerHTML|insertAdjacentHTML|outerHTML|document\.write/);
  // the only network calls on the page: /api/cloakmesh (and Cloudflare's human check, through src/lib/human.js)
  const urls = [...page.matchAll(/(?:fetch|postJson)\(\s*'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(urls)], ['/api/cloakmesh']);
  assert.match(page, /withHuman\(human, 'waitlist',/);
  assert.match(read('api/cloakmesh.js'), /verifyHuman\(cfg, body\.turnstileToken, ip, 'waitlist'\)/);
  assert.match(page, /history\.replaceState\(null, '', location\.pathname \+ location\.search\)/, 'a leave code leaves the address at once');
  const html = read('cloakmesh.html');
  assert.match(html, /<textarea[^>]*spellcheck="false"[^>]*data-cm-demo-in/, 'the browser\'s spellcheck service never gets the demo\'s text');
});

// ---------- the page ----------
test('the page: one h1, its own theme script before it paints, no inline code or styles, every #link has a place', () => {
  const html = read('cloakmesh.html');
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /<html lang="en" data-page="cloakmesh">/);
  assert.ok(html.indexOf('<script src="/cloakmesh-theme.js"></script>') < html.indexOf('</head>'));
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, 'no inline scripts (the CSP blocks them)');
  assert.doesNotMatch(html, /\sstyle=|\son[a-z]+=/i, 'no inline styles or handlers');
  for (const [, id] of html.matchAll(/href="#([\w-]+)"/g)) assert.match(html, new RegExp(`id="${id}"`), `#${id}`);
  for (const sel of ['data-cm-form', 'data-cm-human', 'data-cm-submit', 'data-cm-msg', 'data-cm-done', 'data-cm-leave', 'data-cm-demo', 'data-cm-proof', 'data-cm-theme']) assert.ok(html.includes(sel), sel);
  assert.match(html, /id="cm-email"[^>]*autocomplete="email"/);
  for (const role of ROLES) assert.match(html, new RegExp(`name="role" value="${role}"`));
  assert.match(html, /<link rel="canonical" href="https:\/\/inference\.agi1\.app\/cloakmesh" \/>/);
  assert.match(html, /og:image" content="https:\/\/inference\.agi1\.app\/cards\/cloakmesh\.png"/);
  const card = new URL('../public/cards/cloakmesh.png', import.meta.url);
  assert.ok(existsSync(card) && statSync(card).size < 200_000, 'its link-preview picture');
  const png = readFileSync(card);
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  const theme = read('public/cloakmesh-theme.js');
  assert.match(theme, /cm-theme/);
  assert.match(theme, /prefers-color-scheme: light/);
});

test('the page keeps its promises: honest about what exists, no other company named, no coin, what the waitlist keeps', () => {
  const html = read('cloakmesh.html');
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const all = [html, read('src/cloakmesh/page.js'), read('src/cloakmesh/words.js'), read('src/cloakmesh/demo.js'), read('src/styles/cloakmesh.css')].join('\n');
  assert.doesNotMatch(all, /orbio/i, 'no competitor is named (the owner\'s rule)');
  assert.doesNotMatch(text, /\$AGI|clank\.trade|buy |token price|airdrop|staking|yield/i, 'no coin on this page (for now: the owner\'s choice)');
  for (const promise of [/not live yet/i, /Phase 2/, /simulated AMD hardware/, /Not yet\./, /trademarks of their owners/, /isn't affiliated/,
    /Your internet address isn't stored/, /human check by Cloudflare/, /Never sold or shared/, /nothing on this page is sent anywhere/,
    /a fixed example, not a real model/, /A simplified version of CloakMesh's filter/, /Leave anytime/]) {
    assert.match(text, promise, String(promise));
  }
  // claims it doesn't make
  assert.doesNotMatch(text, /open[- ]source|audited|guarantee|unhackable|100% (private|secure)|military[- ]grade/i);
});

test('the page\'s styles: every rule names a cm- class or the page itself (the rest of the site can\'t change); nothing from elsewhere', () => {
  const css = read('src/styles/cloakmesh.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...css.matchAll(/([^{}@]+)\{[^{}]*\}/g)].map((m) => m[1].trim()).filter((s) => s && !/^(from|to|\d+%(,\s*\d+%)*)$/.test(s));
  assert.ok(selectors.length > 60);
  for (const sel of selectors) for (const one of sel.split(',')) assert.match(one, /\.cm-|html\[data-page='cloakmesh'\]|html\.cm-anim/, `${one.trim()}`);
  assert.doesNotMatch(css, /url\(\s*['"]?(?:https?:)?\/\//, 'no outside files');
  assert.doesNotMatch(css, /!important/);
});

test('the page\'s words: every answer /api/cloakmesh gives has its own words', () => {
  const api = read('api/cloakmesh.js');
  const errors = new Set([...api.matchAll(/error: '([a-z_]+)'/g)].map((m) => m[1]));
  for (const e of errors) {
    if (['bad_request', 'too_long', 'bad_token'].includes(e)) continue;      // the page never sends those
    assert.ok(JOIN_WORDS[e], `${e} has its own words`);
  }
  assert.equal(joinWords('???'), JOIN_WORDS.busy);
  assert.match(WORDS.leaveFailed('not_ready'), /isn't open yet/);
  assert.equal(WORDS.themeTo('dark'), 'Switch to light theme');
});

// ---------- inference.agi1.app ----------
test('inference.agi1.app opens the page (a redirect: Vercel serves the home page\'s file at "/" before any rewrite), and the build has it', () => {
  const v = JSON.parse(read('vercel.json'));
  const r = v.redirects.find((x) => x.has?.some((h) => h.type === 'host' && h.value === 'inference.agi1.app'));
  assert.deepEqual(r, { source: '/', has: [{ type: 'host', value: 'inference.agi1.app' }], destination: '/cloakmesh', permanent: false });
  assert.doesNotMatch(r.destination, /\.html$/, 'cleanUrls: never .html');
  assert.match(read('vite.config.js'), /cloakmesh: 'cloakmesh\.html'/);
  // This page adds no CSP sources: it talks to our /api. Shared sources also cover the live relay
  // and the owner's exact media upload bucket (tests/trench-live.test.js and owner-media-security.test.js).
  const csp = v.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;
  assert.match(csp, /connect-src 'self' blob: https:\/\/api\.dexscreener\.com wss:\/\/live\.agi1\.app https:\/\/vujaxukucukjxzhcxlea\.supabase\.co\/storage\/v1\/object\/upload\/sign\/agi1-owner-media\/;/);
  // the 12-function limit of Vercel's Hobby plan: every api/*.js file is one Vercel Function
  const fns = readdirSync(new URL('../api/', import.meta.url)).filter((f) => f.endsWith('.js'));
  assert.ok(fns.includes('cloakmesh.js'));
  assert.ok(fns.length <= 12, `${fns.length} functions in api/ (Vercel's Hobby plan allows 12 per deployment)`);
});
