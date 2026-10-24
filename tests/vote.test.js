// Community votes (agi1.app/vote, 2026-10-24: the roadmap's "Gamified governance"): the polls' rules and the owner's
// changes (src/vote/polls.js checkPoll), the page's words, the sealed address, /api/wallet's vote addresses, the owner's
// page (agi1.app/vote/owner) and the final count, and supabase/votes.sql's promises. Supabase (votes.sql's rules in a small stand-in) and Robinhood Chain are fakes: no keys,
// no cost. Run: npm test
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { VOTE, ID, CHOICE_ID, PICTURE, livePolls, pollById, isChoice, pollState, opensAt, closesAt, tallyRows, leader, publicPoll, checkPoll, cleanPoll, newPollId, isPicture } from '../src/vote/polls.js';
import { agiText, whenText, stateText, voteError, shortWallet } from '../src/vote/words.js';
import { voterCode, seal, unseal } from '../server/vote.js';
import { GET, POST, _resetVoteNotes } from '../api/wallet.js';
import { makeSession, walletCode } from '../server/session.js';
import { voteBurst } from '../server/burst.js';
import { _resetChainCache, AGI_CONTRACT } from '../server/chain.js';
import { LEVELS } from '../src/lib/levels.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const SECRET = 'test-pass-secret-that-is-long-enough-1234';
const ENV = { SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fake_key_123', PASS_SECRET: SECRET };
const W = '0x1111111111111111111111111111111111111111';
const W2 = '0x2222222222222222222222222222222222222222';
const AGI = (n) => BigInt(n) * 10n ** 18n;
const HOUR = 3600_000;

// ---------- a small stand-in for supabase/votes.sql ----------
function votesDb() {
  const rows = new Map();                       // `${poll}|${who}` -> { poll, who, choice, weight, sealed, final, at }
  const polls = new Map();                      // id -> body (agi_polls)
  let clock = 0;
  return {
    rows, polls,
    poll_list() {
      return [...polls.entries()].reverse().map(([id, body]) => ({ ...structuredClone(body), id }));
    },
    poll_put({ p_id, p_body }) {
      if (!ID.test(p_id ?? '') || !p_body || typeof p_body !== 'object') return false;
      const { id, ...body } = p_body;
      polls.set(p_id, structuredClone(body));
      return true;
    },
    poll_drop({ p_id }) {
      if ([...rows.values()].some((r) => r.poll === p_id)) return { ok: false, why: 'has_votes' };
      return polls.delete(p_id) ? { ok: true } : { ok: false, why: 'gone' };
    },
    vote_put({ p_poll, p_who, p_choice, p_weight, p_sealed }) {
      if (!ID.test(p_poll ?? '') || typeof p_who !== 'string' || p_who.length < 16 || p_who.length > 64 || !CHOICE_ID.test(p_choice ?? '')
        || !Number.isSafeInteger(p_weight) || p_weight < 0 || typeof p_sealed !== 'string' || !p_sealed || p_sealed.length > 200) return { ok: false, why: 'bad' };
      const key = `${p_poll}|${p_who}`;
      const old = rows.get(key);
      if (old && old.final !== null) return { ok: false, why: 'counted' };
      rows.set(key, { poll: p_poll, who: p_who, choice: p_choice, weight: p_weight, sealed: p_sealed, final: null, at: ++clock });
      return { ok: true };
    },
    vote_mine({ p_who }) {
      return [...rows.values()].filter((r) => r.who === p_who).map((r) => ({ poll: r.poll, choice: r.choice, agi: r.weight, final: r.final }));
    },
    vote_tally({ p_poll }) {
      const by = new Map();
      for (const r of rows.values()) {
        if (r.poll !== p_poll) continue;
        const n = r.final ?? r.weight;
        const t = by.get(r.choice) || { choice: r.choice, agi: 0, wallets: 0 };
        t.agi += n; t.wallets += n > 0 ? 1 : 0;
        by.set(r.choice, t);
      }
      const mine = [...rows.values()].filter((r) => r.poll === p_poll);
      return { rows: [...by.values()], left: mine.filter((r) => r.final === null).length, all: mine.length };
    },
    vote_uncounted({ p_poll, p_limit }) {
      return [...rows.values()].filter((r) => r.poll === p_poll && r.final === null).sort((a, b) => a.at - b.at)
        .slice(0, Math.max(1, Math.min(p_limit ?? 15, 50))).map((r) => ({ who: r.who, agi: r.weight, sealed: r.sealed }));
    },
    vote_count({ p_poll, p_who, p_held }) {
      const r = rows.get(`${p_poll}|${p_who}`);
      if (!r || r.final !== null) return false;
      r.final = Math.min(r.weight, Math.max(p_held ?? 0, 0));
      r.sealed = null;
      return true;
    },
  };
}

// ---------- the fakes ----------
const realFetch = globalThis.fetch;
const realError = console.error;
after(() => { globalThis.fetch = realFetch; console.error = realError; delete process.env.STUDIO_OWNER; });
// a poll on the page for these tests, kept in the fake database (and a hidden one, like votes.sql's first two ideas)
const TEST_POLL = { id: 'test-poll', question: 'Which one?', opens: '', closes: '', choices: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', picture: '/vote/new-logo/keep.svg' }, { id: 'c', label: 'C' }] };
const DRAFT_POLL = { id: 'new-logo', question: 'Pick the new AGI logo', opens: '2026-10-27T14:00:00.000Z', closes: '2026-10-30T14:00:00.000Z', draft: true, choices: [{ id: 'keep', label: 'Keep' }, { id: 'logo-a', label: 'Logo A' }] };
const setTest = (changes) => { const { id, ...body } = { ...fake.db.polls.get('test-poll'), ...changes }; fake.db.polls.set('test-poll', body); };
const openNow = () => setTest({ opens: new Date(Date.now() - HOUR).toISOString(), closes: new Date(Date.now() - HOUR + VOTE.days * 864e5).toISOString() });
const closeNow = (agoMs = VOTE.settleAfterMs + 60_000) => setTest({
  opens: new Date(Date.now() - 4 * 864e5).toISOString(), closes: new Date(Date.now() - agoMs).toISOString(),
});
const OWNER = '0x0000000000000000000000000000000000000abc';

let fake, calls, logs;
beforeEach(() => {
  delete process.env.ROBINHOOD_RPC_URL;
  delete process.env.STUDIO_ONLY_FOR;
  Object.assign(process.env, ENV, { STUDIO_OWNER: OWNER });
  voteBurst.reset(); _resetChainCache(); _resetVoteNotes();
  logs = [];
  console.error = (...a) => logs.push(a.join(' '));
  calls = [];
  fake = { db: votesDb(), sqlMissing: false, dbDown: false, balances: new Map(), chainDown: false };
  fake.db.poll_put({ p_id: DRAFT_POLL.id, p_body: structuredClone(DRAFT_POLL) });
  fake.db.poll_put({ p_id: TEST_POLL.id, p_body: structuredClone(TEST_POLL) });
  openNow();
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, body });
    const rpc = /\/rest\/v1\/rpc\/(\w+)$/.exec(url);
    if (rpc) {
      if (fake.dbDown) return new Response('{"code":"XX000","message":"down"}', { status: 500 });
      if (fake.sqlMissing) return new Response('{"code":"PGRST202","message":"not found"}', { status: 404 });
      const fn = fake.db[rpc[1]];
      if (!fn) throw new Error(`unexpected database function ${rpc[1]}`);
      return Response.json(fn.call(fake.db, body) ?? null);
    }
    if (url === 'https://rpc.mainnet.chain.robinhood.com') {
      if (fake.chainDown) return new Response('down', { status: 503 });
      assert.equal(body.method, 'eth_call', 'only ever reads');
      const data = body.params[0].data;
      if (data === '0x313ce567') return Response.json({ jsonrpc: '2.0', id: 1, result: `0x${(18).toString(16).padStart(64, '0')}` });
      assert.equal(body.params[0].to, AGI_CONTRACT, 'only the official $AGI is read');
      const who = `0x${data.slice(-40)}`;
      return Response.json({ jsonrpc: '2.0', id: 1, result: `0x${(fake.balances.get(who) ?? 0n).toString(16).padStart(64, '0')}` });
    }
    throw new Error('unexpected request to ' + url);
  };
});
const rpcs = () => calls.filter((c) => c.url.includes('/rest/v1/rpc/')).map((c) => c.url.split('/').pop());
const session = (wallet = W) => makeSession(SECRET, { wallet, level: 2, checkedAt: Date.now() });
const get = async (query = '?votes') => {
  const res = await GET(new Request(`https://agi1.app/api/wallet${query}`, { headers: { 'x-real-ip': '1.2.3.4' } }));
  return { status: res.status, data: await res.json(), cache: res.headers.get('cache-control') };
};
const post = async (body, ip = '1.2.3.4') => {
  const res = await POST(new Request('https://agi1.app/api/wallet', { method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': ip }, body: JSON.stringify(body) }));
  return { status: res.status, data: await res.json() };
};
const vote = (choice, wallet = W, poll = 'test-poll') => post({ action: 'vote', session: session(wallet), poll, choice });

// ---------- the polls' rules, and the owner's changes ----------
test('the seeded polls in supabase/votes.sql are well made: ids, 2 to 8 choices, pictures that exist, dates, hidden', () => {
  const sql = read('supabase/votes.sql');
  const ids = [...sql.matchAll(/\('([a-z0-9-]+)', jsonb_build_object\(/g)].map((m) => m[1]);
  assert.deepEqual(ids, ['roadmap-next', 'new-logo']);
  for (const id of ids) assert.match(id, ID);
  for (const m of sql.matchAll(/'picture', '([^']+)'/g)) {
    assert.match(m[1], PICTURE);
    const file = new URL(`../public${m[1]}`, import.meta.url);
    assert.ok(existsSync(file), `public${m[1]} is there`);
    assert.ok(statSync(file).size <= VOTE.pictureMax);
  }
  assert.equal((sql.match(/'draft', true/g) || []).length, 2, 'both hidden until the owner shows them');
  assert.match(sql, /on conflict \(id\) do nothing;/, 'never over the owner\'s own changes');
  for (const m of sql.matchAll(/jsonb_build_object\('id', '([^']+)'/g)) assert.match(m[1], CHOICE_ID);
});

test('the rules: 10,000 $AGI (the Crush level) to vote, 3 days, hidden polls stay off the page', () => {
  assert.equal(VOTE.minAgi, 10_000);
  assert.equal(VOTE.minAgi, LEVELS.find((l) => l.name === 'Crush').min);
  assert.equal(VOTE.days, 3);
  const draft = { id: 'draft-one', draft: true, question: 'Q?', opens: '2026-01-01T00:00:00Z', choices: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] };
  assert.deepEqual(livePolls([draft]), []);
  assert.deepEqual(livePolls(null), []);
  assert.equal(pollById('draft-one', [draft]), null);
  assert.equal(pollById('test-poll', [TEST_POLL, draft]), TEST_POLL);
  assert.ok(isChoice(TEST_POLL, 'a') && !isChoice(TEST_POLL, 'z') && !isChoice(null, 'a'));
});

test('checkPoll: a new vote, its words, its choices and its dates', () => {
  const now = Date.parse('2026-10-24T06:00:00Z');
  const base = { question: '  Pick the   new AGI logo ', about: 'From the group.', opens: 'now', closes: new Date(now + 3 * 864e5).toISOString(),
    choices: [{ label: 'Keep', picture: '/vote/new-logo/keep.svg' }, { label: 'Logo A', note: 'by someone' }, { label: 'Logo B' }] };
  const r = checkPoll(base, { now, random: () => 0 });
  assert.ok(r.ok, r.why);
  assert.equal(r.poll.id, 'pick-the-new-agi-logo-0000');
  assert.equal(r.poll.question, 'Pick the new AGI logo');
  assert.equal(r.poll.opens, new Date(now).toISOString(), 'now');
  assert.deepEqual(r.poll.choices.map((c) => c.id), ['c1', 'c2', 'c3']);
  assert.equal(r.poll.choices[1].note, 'by someone');
  assert.equal(r.poll.draft, false);
  assert.equal(checkPoll({ ...base, draft: true }, { now }).poll.draft, true);
  const no = (changes, why) => {
    const x = checkPoll({ ...base, ...changes }, { now });
    assert.equal(x.ok, false, JSON.stringify(changes));
    assert.match(x.why, why);
  };
  no({ question: 'Hi' }, /question/);
  no({ question: 'x'.repeat(121) }, /too long/);
  no({ about: 'x'.repeat(301) }, /too long/);
  no({ choices: [{ label: 'Only one' }] }, /2 choices/);
  no({ choices: Array.from({ length: 9 }, (_, i) => ({ label: `C${i}` })) }, /8 choices at most/);
  no({ choices: [{ label: 'A' }, { label: ' ' }] }, /choice 2's name/);
  no({ choices: [{ label: 'Same' }, { label: 'same' }] }, /Two choices/);
  no({ choices: [{ label: 'A', picture: 'https://evil.example/x.png' }, { label: 'B' }] }, /picture/);
  no({ choices: [{ label: 'A', picture: 'data:image/svg+xml;base64,PHN2Zz4=' }, { label: 'B' }] }, /picture/);
  no({ choices: [{ id: 'made-up', label: 'A' }, { label: 'B' }] }, /Reload/);
  no({ opens: new Date(now - HOUR).toISOString() }, /start time has passed/);
  no({ opens: new Date(now + 91 * 864e5).toISOString(), closes: new Date(now + 92 * 864e5).toISOString() }, /90 days ahead/);
  no({ closes: new Date(now + 30 * 60_000).toISOString() }, /1 hour at least/);
  no({ closes: new Date(now + 31 * 864e5).toISOString() }, /30 days at most/);
  no({ closes: 'whenever' }, /ends/);
  assert.ok(checkPoll({ ...base, choices: [{ label: 'A', picture: 'data:image/webp;base64,UklGRg==' }, { label: 'B' }] }, { now }).ok, 'a small uploaded picture');
  assert.ok(!isPicture(`data:image/webp;base64,${'A'.repeat(VOTE.pictureChars)}`), 'not a big one');
  assert.match(newPollId('!!', () => 0.5), /^vote-[a-z0-9]{4}$/);
  assert.match(newPollId('What should AGI build next? A very very long question indeed'), ID);
});

test('checkPoll: an open vote keeps its start and its voted choices; a closed one keeps its choices and dates', () => {
  const now = Date.parse('2026-10-24T06:00:00Z');
  const old = { id: 'logo', question: 'Pick the logo', opens: new Date(now - 864e5).toISOString(), closes: new Date(now + 2 * 864e5).toISOString(), draft: false,
    choices: [{ id: 'keep', label: 'Keep' }, { id: 'c1', label: 'Logo A' }, { id: 'c2', label: 'Logo B' }] };
  const input = (changes = {}) => ({ id: 'logo', question: old.question, opens: 'now', closes: old.closes, choices: old.choices.map((c) => ({ ...c })), ...changes });
  const votes = { keep: 3, c1: 1 };
  // more choices while it's open: new ids that don't clash
  let r = checkPoll(input({ choices: [...old.choices, { label: 'Logo C' }, { label: 'Logo D' }] }), { old, votes, voters: 4, now });
  assert.ok(r.ok, r.why);
  assert.deepEqual(r.poll.choices.map((c) => c.id), ['keep', 'c1', 'c2', 'c3', 'c4']);
  assert.equal(r.poll.opens, old.opens, 'its start stays');
  // a renamed choice keeps its id (so its votes)
  r = checkPoll(input({ choices: [{ id: 'keep', label: 'Keep the current logo' }, ...old.choices.slice(1)] }), { old, votes, voters: 4, now });
  assert.equal(r.poll.choices[0].id, 'keep');
  // a choice nobody picked can go, one with votes can't
  assert.ok(checkPoll(input({ choices: old.choices.slice(0, 2) }), { old, votes, voters: 4, now }).ok);
  assert.match(checkPoll(input({ choices: [old.choices[0], old.choices[2]] }), { old, votes, voters: 4, now }).why, /has votes/);
  // later, or "End now" (a time gone by is now), never past 30 days from its start
  assert.equal(checkPoll(input({ closes: new Date(now - 5000).toISOString() }), { old, votes, voters: 4, now }).poll.closes, new Date(now).toISOString());
  assert.match(checkPoll(input({ closes: new Date(now + 30 * 864e5).toISOString() }), { old, votes, voters: 4, now }).why, /30 days/);
  // closed: words yes; choices and dates no
  const closed = { ...old, closes: new Date(now - HOUR).toISOString() };
  r = checkPoll(input({ question: 'Pick the logo (done)', closes: new Date(now + 864e5).toISOString() }), { old: closed, votes, voters: 4, now });
  assert.ok(r.ok, r.why);
  assert.equal(r.poll.closes, closed.closes, 'its dates stay');
  assert.match(checkPoll(input({ choices: [...old.choices, { label: 'Late' }] }), { old: closed, votes, voters: 4, now }).why, /closed/);
  assert.match(checkPoll(input({ choices: old.choices.slice(0, 2) }), { old: closed, votes, voters: 4, now }).why, /closed/);
  // hidden and never voted on: like a new one (its start may move, even after its old start went by)
  const hidden = { ...old, draft: true };
  r = checkPoll(input({ draft: false, closes: new Date(now + 864e5).toISOString() }), { old: hidden, votes: {}, voters: 0, now });
  assert.ok(r.ok, r.why);
  assert.equal(r.poll.opens, new Date(now).toISOString());
  assert.equal(r.poll.id, 'logo', 'its id stays');
  // hidden with votes: still an open vote's rules
  assert.equal(checkPoll(input({ closes: new Date(now + 864e5).toISOString() }), { old: hidden, votes, voters: 4, now }).poll.opens, old.opens);
});

test('cleanPoll: only well-made polls from the database are used', () => {
  assert.equal(cleanPoll(null), null);
  assert.equal(cleanPoll({ ...TEST_POLL, id: 'BAD ID' }), null);
  assert.equal(cleanPoll({ ...TEST_POLL, opens: 'x', closes: 'y' }), null);
  assert.equal(cleanPoll({ ...TEST_POLL, opens: '2026-01-01T00:00:00Z', closes: '2026-01-02T00:00:00Z', choices: [{ id: 'a', label: 'A' }, { id: 'a', label: 'B' }] }), null);
  const p = cleanPoll({ ...TEST_POLL, opens: '2026-01-01T00:00:00Z', closes: '2026-01-02T00:00:00Z', choices: [{ id: 'a', label: 'A', picture: 'javascript:alert(1)' }, { id: 'b', label: 'B' }], extra: 1 });
  assert.equal(p.choices[0].picture, undefined, 'a picture that isn\'t one is dropped');
  assert.equal(p.extra, undefined);
});

test('a poll\'s state: soon, open, then counting until every wallet is counted again, then final', () => {
  const p = { id: 'x1', opens: '2026-11-01T00:00:00Z', choices: [] };
  const o = Date.parse(p.opens);
  assert.equal(closesAt(p), o + 3 * 864e5, '3 days unless it says');
  assert.equal(closesAt({ ...p, days: 5 }), o + 5 * 864e5);
  assert.equal(closesAt({ ...p, closes: '2026-11-02T00:00:00Z' }), Date.parse('2026-11-02T00:00:00Z'));
  assert.equal(pollState(p, o - 1), 'soon');
  assert.equal(pollState(p, o), 'open');
  assert.equal(pollState(p, o + 3 * 864e5 - 1), 'open');
  assert.equal(pollState(p, o + 3 * 864e5), 'counting');
  assert.equal(pollState(p, o + 3 * 864e5, 4), 'counting');
  assert.equal(pollState(p, o + 3 * 864e5, 0), 'final');
});

test('the numbers: every choice in order, shares of the $AGI, the leader (a tie has none)', () => {
  const rows = tallyRows(TEST_POLL, [{ choice: 'b', agi: 30_000, wallets: 2 }, { choice: 'a', agi: 10_000, wallets: 1 }, { choice: 'zzz', agi: 5, wallets: 1 }]);
  assert.deepEqual(rows, [
    { choice: 'a', agi: 10_000, wallets: 1, share: 25 },
    { choice: 'b', agi: 30_000, wallets: 2, share: 75 },
    { choice: 'c', agi: 0, wallets: 0, share: 0 },
  ]);
  assert.equal(leader(rows), 'b');
  assert.equal(leader(tallyRows(TEST_POLL, [{ choice: 'a', agi: 5, wallets: 1 }, { choice: 'b', agi: 5, wallets: 1 }])), null);
  assert.equal(leader(tallyRows(TEST_POLL, [])), null);
  assert.deepEqual(tallyRows(TEST_POLL, 'nonsense').map((r) => r.agi), [0, 0, 0]);
  assert.deepEqual(tallyRows(TEST_POLL, [{ choice: 'a', agi: -4, wallets: 1.5 }])[0], { choice: 'a', agi: 0, wallets: 0, share: 0 });
  const pub = publicPoll({ ...TEST_POLL, opens: '2026-10-27T14:00:00.000Z', closes: '2026-10-30T14:00:00.000Z' });
  assert.deepEqual(Object.keys(pub), ['id', 'question', 'about', 'opens', 'closes', 'choices']);
  assert.equal(pub.choices[1].picture, '/vote/new-logo/keep.svg');
});

test('the page\'s words', () => {
  assert.equal(agiText(0), '0');
  assert.equal(agiText(12_500), '12,500');
  assert.equal(agiText(1_259_000), '1.25M');
  assert.equal(agiText(3_400_000_000), '3.4B');
  assert.equal(whenText(2 * 864e5 + 4 * HOUR + 5 * 60_000), '2 days 4 hours');
  assert.equal(whenText(HOUR + 60_000), '1 hour 1 minute');
  assert.equal(whenText(30_000), 'less than a minute');
  assert.equal(shortWallet(W), '0x1111…1111');
  assert.match(stateText({ state: 'open', closes: new Date(Date.now() + 864e5 + 60_000).toISOString() }, Date.now()), /^Open · closes in 1 day/);
  assert.match(stateText({ state: 'counting', closes: new Date().toISOString(), left: 1 }, Date.now()), /1 wallet to check again/);
  assert.equal(voteError({ error: 'too_few', agi: 2000, min: 10_000 }), 'This wallet holds 2,000 $AGI. Voting needs 10,000 or more.');
  assert.equal(voteError({ error: 'whatever' }), 'Something went wrong. Try again.');
});

// ---------- the sealed address and the codes ----------
test('a voter\'s code isn\'t her chat memory\'s, and the sealed address only opens with PASS_SECRET', () => {
  assert.notEqual(voterCode(SECRET, W), walletCode(SECRET, W));
  assert.equal(voterCode(SECRET, W), voterCode(SECRET, W.toUpperCase().replace('0X', '0x')));
  assert.equal(voterCode(SECRET, W).length, 32);
  const s = seal(SECRET, W);
  assert.equal(s.length, 64);
  assert.ok(!s.includes('1111'), 'not the address in plain sight');
  assert.notEqual(seal(SECRET, W), s, 'a new nonce each time');
  assert.equal(unseal(SECRET, s), W);
  assert.equal(unseal('another-secret-that-is-long-enough-12345', s), null);
  const bad = s.slice(0, 40) + (s[40] === 'A' ? 'B' : 'A') + s.slice(41);
  assert.equal(unseal(SECRET, bad), null, 'changed: refused');
  assert.equal(unseal(SECRET, 'short'), null);
});

// ---------- /api/wallet ----------
test('GET ?votes: { ready: false } until the database is set up or votes.sql is run; shared by the CDN', async () => {
  process.env.SUPABASE_URL = '';
  let r = await get();
  assert.deepEqual(r.data, { ready: false });
  assert.match(r.cache, /s-maxage=15/, 'the owner\'s changes show within 15 seconds');
  process.env.SUPABASE_URL = ENV.SUPABASE_URL;
  fake.sqlMissing = true;
  r = await get();
  assert.deepEqual(r.data, { ready: false });
  assert.equal(logs.filter((l) => /votes\.sql/.test(l)).length, 1, 'says once which file to run');
  await get();
  assert.equal(logs.filter((l) => /votes\.sql/.test(l)).length, 1, 'once');
  fake.sqlMissing = false; fake.dbDown = true;
  r = await get();
  assert.equal(r.status, 503);
  assert.equal((await get('?votes&x=1')).status, 405, 'exactly ?votes');
});

test('voting: a signed-in wallet with 10,000 $AGI or more; its $AGI is its weight; it can change its vote; never who', async () => {
  fake.balances.set(W, AGI(9_999));
  let r = await vote('a');
  assert.equal(r.status, 403);
  assert.deepEqual(r.data, { error: 'too_few', agi: 9_999, min: 10_000 });
  assert.equal(fake.db.rows.size, 0);

  fake.balances.set(W, AGI(25_000) + 5n);
  r = await vote('a');
  assert.equal(r.status, 200);
  assert.equal(r.data.choice, 'a');
  assert.equal(r.data.agi, 25_000, 'whole $AGI');
  assert.equal(r.data.poll.state, 'open');
  assert.deepEqual(r.data.poll.rows[0], { choice: 'a', agi: 25_000, wallets: 1, share: 100 });
  const [row] = fake.db.rows.values();
  assert.equal(row.who, voterCode(SECRET, W));
  assert.equal(unseal(SECRET, row.sealed), W);
  assert.ok(!JSON.stringify(calls.filter((c) => c.url.includes('/rest/')).map((c) => c.body)).toLowerCase().includes(W.slice(2)), 'the address never goes to the database in plain sight');

  r = await vote('b');
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.poll.rows.map((x) => x.agi), [0, 25_000, 0], 'changed, not added');
  assert.equal(fake.db.rows.size, 1);

  r = await post({ action: 'vote-mine', session: session() });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { ok: true, votes: { 'test-poll': { choice: 'b', agi: 25_000, final: null } }, agi: 25_000, min: 10_000 });

  const g = await get();
  assert.equal(g.status, 200);
  assert.equal(g.data.ready, true);
  const p = g.data.polls.find((x) => x.id === 'test-poll');
  assert.equal(p.total, 25_000);
  assert.equal(p.wallets, 1);
  assert.ok(!JSON.stringify(g.data).toLowerCase().includes(W.slice(2)), 'results never show a wallet');
  assert.ok(!JSON.stringify(g.data).includes(voterCode(SECRET, W)), '...or its code');
});

test('voting: refused when signed out, for a choice or poll that isn\'t there, a draft, before it opens, after it closes, or when the chain is down', async () => {
  fake.balances.set(W, AGI(50_000));
  assert.equal((await post({ action: 'vote', session: 'nope', poll: 'test-poll', choice: 'a' })).status, 401);
  assert.equal((await post({ action: 'vote-mine', session: 'nope' })).status, 401);
  assert.equal((await post({ action: 'vote', session: session(), poll: 'test-poll' })).status, 400);
  assert.equal((await vote('zzz')).status, 400);
  assert.equal((await vote('a', W, 'no-such-poll')).status, 400);
  assert.equal((await vote('keep', W, 'new-logo')).status, 400, 'a draft can\'t be voted on');
  setTest({ opens: new Date(Date.now() + HOUR).toISOString(), closes: new Date(Date.now() + 2 * HOUR).toISOString() });
  let r = await vote('a');
  assert.deepEqual([r.status, r.data.error], [409, 'soon']);
  closeNow(1000);
  r = await vote('a');
  assert.deepEqual([r.status, r.data.error], [409, 'closed']);
  openNow();
  fake.chainDown = true;
  r = await vote('a');
  assert.deepEqual([r.status, r.data.error], [503, 'chain']);
  assert.equal(fake.db.rows.size, 0);
  fake.chainDown = false;
  fake.sqlMissing = true;
  r = await vote('a');
  assert.deepEqual([r.status, r.data.error], [503, 'not_ready']);
});

test('the final count: each wallet read again after the close and the lower amount counts, so moving $AGI to vote twice doesn\'t work', async () => {
  fake.balances.set(W, AGI(1_000_000));
  assert.equal((await vote('a', W)).status, 200);
  // the same $AGI sent to a second wallet, which votes too
  fake.balances.set(W, 0n);
  fake.balances.set(W2, AGI(1_000_000));
  assert.equal((await vote('b', W2)).status, 200);
  let p = (await get()).data.polls.find((x) => x.id === 'test-poll');
  assert.equal(p.total, 2_000_000, 'while it\'s open, each vote shows what it had when it voted');

  // closed a moment ago: no count yet (a last-second vote lands first)
  closeNow(30_000);
  p = (await get()).data.polls.find((x) => x.id === 'test-poll');
  assert.equal(p.state, 'counting');
  assert.ok(!rpcs().includes('vote_uncounted'));

  closeNow();
  fake.balances.set(W2, AGI(400_000));                          // sold some since: the lower amount counts
  p = (await get()).data.polls.find((x) => x.id === 'test-poll');
  assert.equal(p.state, 'final');
  assert.deepEqual(p.rows.map((r) => [r.choice, r.agi, r.wallets]), [['a', 0, 0], ['b', 400_000, 1], ['c', 0, 0]]);
  assert.equal(p.total, 400_000);
  for (const r of fake.db.rows.values()) assert.equal(r.sealed, null, 'the sealed addresses are wiped');

  // bought more after voting: still the lower amount; and nothing can change it now
  fake.balances.set(W2, AGI(9_000_000));
  p = (await get()).data.polls.find((x) => x.id === 'test-poll');
  assert.equal(p.total, 400_000);
  assert.equal((await vote('a', W2)).data.error, 'closed');
});

test('the final count waits for the chain, and goes a few wallets at a time', async () => {
  for (let i = 0; i < VOTE.settleBatch + 3; i++) {
    const w = `0x${String(i + 10).padStart(40, '0')}`;
    fake.balances.set(w, AGI(20_000));
    assert.equal((await vote('a', w, 'test-poll')).status, 200);
  }
  closeNow();
  fake.chainDown = true;
  let p = (await get()).data.polls.find((x) => x.id === 'test-poll');
  assert.equal(p.state, 'counting');
  assert.equal(p.left, VOTE.settleBatch + 3, 'nobody counted while the chain is down');
  fake.chainDown = false;
  p = (await get()).data.polls.find((x) => x.id === 'test-poll');
  assert.equal(p.left, 3, `${VOTE.settleBatch} at a time`);
  p = (await get()).data.polls.find((x) => x.id === 'test-poll');
  assert.equal(p.state, 'final');
  assert.equal(p.total, (VOTE.settleBatch + 3) * 20_000);
});

test('a sealed address that can\'t be opened keeps the $AGI it voted with (said in the logs)', async () => {
  fake.balances.set(W, AGI(30_000));
  await vote('c');
  for (const r of fake.db.rows.values()) r.sealed = 'x'.repeat(64);
  closeNow();
  const p = (await get()).data.polls.find((x) => x.id === 'test-poll');
  assert.equal(p.state, 'final');
  assert.equal(p.rows[2].agi, 30_000);
  assert.ok(logs.some((l) => /sealed address couldn't be opened/.test(l)));
});

test('votes have their own speed bump: 20 a minute per visitor', async () => {
  fake.balances.set(W, AGI(30_000));
  for (let i = 0; i < 20; i++) assert.notEqual((await post({ action: 'vote-mine', session: session() }, '9.9.9.9')).status, 429);
  assert.equal((await post({ action: 'vote-mine', session: session() }, '9.9.9.9')).status, 429);
});

// ---------- the database, the page and the build ----------
test('supabase/votes.sql: locked to the server, the address only sealed and wiped at the count, the lower amount', () => {
  const sql = read('supabase/votes.sql');
  assert.match(sql, /alter table public\.agi_votes enable row level security;/);
  assert.match(sql, /revoke all on table public\.agi_votes from anon, authenticated;/);
  assert.match(sql, /alter table public\.agi_polls enable row level security;/);
  assert.match(sql, /revoke all on table public\.agi_polls from anon, authenticated;/);
  assert.match(sql, /if exists \(select 1 from agi_votes where poll = p_id\) then\s+return json_build_object\('ok', false, 'why', 'has_votes'\);/, 'a poll with votes is never deleted');
  for (const fn of ['vote_put', 'vote_mine', 'vote_tally', 'vote_uncounted', 'vote_count', 'poll_list', 'poll_put', 'poll_drop']) {
    assert.match(sql, new RegExp(`create or replace function public\\.${fn}\\(`), fn);
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated;`), `${fn}: not for the browser`);
    assert.match(sql, new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to service_role;`), `${fn}: the server's`);
  }
  assert.match(sql, /final = least\(weight, greatest\(coalesce\(p_held, 0\), 0\)\), sealed = null/);
  assert.match(sql, /where agi_votes\.final is null;/, 'a counted vote never changes');
  assert.match(sql, /vote_functions_found = 8/);
  assert.doesNotMatch(sql, /drop table/i);
});

test('vote.html: the site\'s top bar and footer, its words, and a page Vite builds', () => {
  const page = read('vote.html'), stake = read('stake.html');
  const between = (s, a, b) => s.slice(s.indexOf(a), s.indexOf(b, s.indexOf(a)) + b.length);
  assert.equal(between(page, '<header class="topbar">', '</header>'), between(stake, '<header class="topbar">', '</header>'));
  assert.equal(between(page, '<footer class="foot">', '</footer>'), between(stake, '<footer class="foot">', '</footer>'));
  assert.match(page, /<title>Vote · AGI<\/title>/);
  assert.match(page, /<link rel="canonical" href="__SITE__\/vote" \/>/);
  assert.match(page, /<script type="module" src="\/src\/vote\/page\.js"><\/script>/);
  assert.match(page, /never a transaction/);
  assert.match(page, /10,000 \$AGI/);
  assert.match(page, /unless it's unsafe, illegal or not possible/);
  assert.doesNotMatch(page, /style="/, 'the CSP allows no style attributes');
  assert.match(read('vite.config.js'), /vote: 'vote\.html'/);
  // agi1.app/vote/owner is the same page (Vercel and Vite), the owner's box loaded only there
  const vercel = JSON.parse(read('vercel.json'));
  for (const source of ['/vote/owner', '/vote/owner/']) assert.ok(vercel.rewrites.some((r) => r.source === source && r.destination === '/vote' && !r.has), source);
  assert.ok(read('vite.config.js').includes('/^\\/vote\\/owner\\/?$/.test(path)) req.url = `/vote.html${q}`'), 'npm run dev too');
  assert.match(page, /<section class="vt-owner" data-vt-owner aria-label="Manage the votes" hidden><\/section>/);
  assert.match(read('src/vote/page.js'), /import\('\.\/owner\.js'\)/);
  const owner = read('src/vote/owner.js');
  assert.doesNotMatch(owner, /eth_sendTransaction|eth_signTypedData|personal_sign|wallet_switchEthereumChain/, 'the owner\'s page signs nothing new');
  assert.doesNotMatch(owner, /innerHTML|insertAdjacentHTML|\.style\.|setAttribute\('style'/, 'plain text, no style attributes');
  assert.match(read('scripts/share-pages.js'), /'dist\/vote\.html'/);
  const js = read('src/vote/page.js');
  assert.doesNotMatch(js, /eth_sendTransaction|eth_signTypedData|wallet_switchEthereumChain|approve\(/, 'never asks for a transaction');
  assert.doesNotMatch(js, /innerHTML/, 'plain text only');
  const css = read('src/styles/vote.css');
  for (const rule of css.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+(?=\{)/g).map((s) => s.trim()).filter((s) => s && !s.startsWith('@'))) {
    assert.match(rule, /\.vt-/, `every rule names a vt- class: ${rule}`);
  }
});

// ---------- the owner's page (agi1.app/vote/owner): vote-owner, vote-save, vote-drop ----------
const NEW_POLL = (changes = {}) => ({
  question: '  Pick   the new AGI logo ', about: 'Three ideas from the group.', opens: 'now', closes: new Date(Date.now() + 2 * 864e5).toISOString(),
  choices: [{ label: 'Keep it' }, { label: 'Logo A', picture: '/vote/new-logo/keep.svg' }, { label: 'Logo B', note: 'the green one' }], ...changes,
});
const owner = (action, extra = {}, wallet = OWNER) => post({ action, session: session(wallet), ...extra });

test('the owner\'s addresses: only the AGI Studio owner\'s signed-in wallet, nothing read or changed otherwise', async () => {
  for (const action of ['vote-owner', 'vote-save', 'vote-drop']) {
    calls = [];
    assert.equal((await post({ action, session: 'nope', id: 'test-poll', poll: NEW_POLL() })).status, 401, `${action}: signed out`);
    const r = await owner(action, { id: 'test-poll', poll: NEW_POLL() }, W);
    assert.equal(r.status, 403, `${action}: another wallet`);
    assert.deepEqual(r.data, { error: 'not_owner' });
    assert.deepEqual(rpcs(), [], `${action}: the database isn't asked`);
  }
  assert.ok(fake.db.polls.has('test-poll'), 'nothing deleted');
  // the owner's wallet in another case is still the owner's
  assert.equal((await owner('vote-owner', {}, OWNER.toUpperCase().replace('0X', '0x'))).status, 200);
  // no owner set: nobody, and the page can say why
  delete process.env.STUDIO_OWNER;
  const r = await owner('vote-owner');
  assert.equal(r.status, 403);
  assert.deepEqual(r.data, { error: 'not_owner', unset: true });
  // else the first wallet of STUDIO_ONLY_FOR, like AGI Studio
  process.env.STUDIO_ONLY_FOR = `${W2}, ${W}`;
  assert.equal((await owner('vote-owner', {}, W2)).status, 200);
  assert.equal((await owner('vote-owner', {}, W)).status, 403);
});

test('vote-owner: every poll, hidden ones too, with draft and voters; the public list never shows a hidden one', async () => {
  fake.balances.set(W, AGI(20_000));
  assert.equal((await vote('a')).status, 200);
  const r = await owner('vote-owner');
  assert.equal(r.status, 200);
  assert.equal(r.data.max, 100);
  const byId = Object.fromEntries(r.data.polls.map((p) => [p.id, p]));
  assert.deepEqual(Object.keys(byId).sort(), ['new-logo', 'test-poll']);
  assert.equal(byId['new-logo'].draft, true);
  assert.equal(byId['new-logo'].state, 'soon');
  assert.equal(byId['test-poll'].draft, false);
  assert.equal(byId['test-poll'].voters, 1);
  assert.equal(byId['test-poll'].total, 20_000);
  const pub = await get();
  assert.deepEqual(pub.data.polls.map((p) => p.id), ['test-poll']);
  assert.equal('draft' in pub.data.polls[0] || 'voters' in pub.data.polls[0], false, 'the owner\'s fields stay on the owner\'s page');
  // the database not set up yet
  fake.sqlMissing = true;
  assert.equal((await owner('vote-owner')).status, 503);
  delete process.env.SUPABASE_URL;
  assert.deepEqual((await owner('vote-owner')).data, { error: 'not_ready' });
});

test('vote-save: a new poll, checked on the server whatever the page sent; hidden until shown', async () => {
  const r = await owner('vote-save', { poll: NEW_POLL({ draft: true, id: undefined, extra: 'ignored' }) });
  assert.equal(r.status, 200);
  const p = r.data.poll;
  assert.match(p.id, /^pick-the-new-agi-logo-[a-z0-9]{4}$/);
  assert.equal(p.question, 'Pick the new AGI logo', 'spaces tidied');
  assert.equal(p.draft, true);
  assert.equal(p.state, 'open');
  assert.deepEqual(p.choices.map((c) => c.id), ['c1', 'c2', 'c3']);
  assert.equal(p.choices[1].picture, '/vote/new-logo/keep.svg');
  assert.equal(p.choices[2].note, 'the green one');
  assert.equal('extra' in fake.db.polls.get(p.id), false, 'only the poll\'s own fields are kept');
  assert.ok(!(await get()).data.polls.some((x) => x.id === p.id), 'hidden: not on the page');
  assert.equal((await vote('c1', W, p.id)).status, 400, 'and a hidden poll can\'t be voted on');
  // shown
  const shown = await owner('vote-save', { poll: { ...NEW_POLL(), id: p.id, draft: false, opens: p.opens, choices: p.choices } });
  assert.equal(shown.status, 200);
  assert.ok((await get()).data.polls.some((x) => x.id === p.id), 'shown: on the page');
  // refused in plain words
  for (const [bad, why] of [
    [NEW_POLL({ question: 'Hi' }), /question/],
    [NEW_POLL({ choices: [{ label: 'Only one' }] }), /2 choices/],
    [NEW_POLL({ choices: [{ label: 'Same' }, { label: 'same' }] }), /Two choices/],
    [NEW_POLL({ choices: [{ label: 'A', picture: 'https://evil.example/x.png' }, { label: 'B' }] }), /picture/],
    [NEW_POLL({ closes: new Date(Date.now() + 10 * 60_000).toISOString() }), /1 hour/],
    [NEW_POLL({ closes: new Date(Date.now() + 40 * 864e5).toISOString() }), /30 days/],
    [NEW_POLL({ opens: new Date(Date.now() - 864e5).toISOString() }), /passed/],
    [{ ...NEW_POLL(), id: 'not-there' }, /isn't there/],
    ['a string', /missing/],
  ]) {
    const x = await owner('vote-save', { poll: bad });
    assert.equal(x.status, 400, String(why));
    assert.equal(x.data.error, 'refused');
    assert.match(x.data.why, why);
  }
});

test('vote-save on a poll with votes: more choices and a later end, never removing a voted choice; a closed one keeps its choices', async () => {
  fake.balances.set(W, AGI(15_000));
  assert.equal((await vote('b')).status, 200);
  const now = fake.db.polls.get('test-poll');
  const base = { id: 'test-poll', question: 'Which one now?', opens: now.opens, closes: now.closes, choices: TEST_POLL.choices.map(({ id, label }) => ({ id, label })) };
  // another choice, and renaming one keeps its votes
  let r = await owner('vote-save', { poll: { ...base, choices: [...base.choices.map((c) => (c.id === 'b' ? { ...c, label: 'B (renamed)' } : c)), { label: 'D' }] } });
  assert.equal(r.status, 200, r.data.why);
  assert.deepEqual(r.data.poll.choices.map((c) => c.id), ['a', 'b', 'c', 'c1']);
  assert.equal(r.data.poll.rows.find((x) => x.choice === 'b').agi, 15_000, 'its votes stay with it');
  assert.equal(r.data.poll.question, 'Which one now?');
  // a choice nobody picked can go; a voted one can't
  r = await owner('vote-save', { poll: { ...base, choices: base.choices.filter((c) => c.id !== 'c') } });
  assert.equal(r.status, 200, r.data.why);
  r = await owner('vote-save', { poll: { ...base, choices: [{ id: 'a', label: 'A' }, { label: 'E' }] } });
  assert.equal(r.status, 400);
  assert.match(r.data.why, /has votes/);
  // its start can't move once open
  r = await owner('vote-save', { poll: { ...base, choices: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], opens: new Date(Date.now() + 864e5).toISOString() } });
  assert.equal(r.status, 200);
  assert.equal(r.data.poll.opens, now.opens);
  // "End now"
  r = await owner('vote-save', { poll: { ...base, choices: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], closes: new Date(Date.now() - HOUR).toISOString() } });
  assert.equal(r.status, 200);
  assert.ok(Date.parse(r.data.poll.closes) <= Date.now() && Date.parse(r.data.poll.closes) > Date.now() - 60_000, 'closed about now');
  assert.notEqual(r.data.poll.state, 'open');
  // closed: words yes, choices no
  const closed = fake.db.polls.get('test-poll');
  const after = { ...base, opens: closed.opens, closes: closed.closes, choices: closed.choices.map(({ id, label }) => ({ id, label })) };
  r = await owner('vote-save', { poll: { ...after, question: 'Which one won?' } });
  assert.equal(r.status, 200);
  r = await owner('vote-save', { poll: { ...after, choices: [...after.choices, { label: 'Late' }] } });
  assert.equal(r.status, 400);
  assert.match(r.data.why, /closed/);
});

test('vote-drop: only a poll nobody voted on; one with votes can be hidden instead', async () => {
  fake.balances.set(W, AGI(10_000));
  assert.equal((await vote('a')).status, 200);
  let r = await owner('vote-drop', { id: 'test-poll' });
  assert.equal(r.status, 400);
  assert.match(r.data.why, /Hide it instead/);
  assert.ok(fake.db.polls.has('test-poll'));
  r = await owner('vote-drop', { id: 'new-logo' });
  assert.deepEqual(r, { status: 200, data: { ok: true } });
  assert.equal(fake.db.polls.has('new-logo'), false);
  for (const id of ['new-logo', 'BAD ID', 42]) {
    r = await owner('vote-drop', { id });
    assert.equal(r.status, 400);
    assert.match(r.data.why, /isn't there/);
  }
});

test('the owner\'s save may carry pictures (up to 1.1 MB); every other action keeps the small limit; 100 polls at most', async () => {
  const picture = `data:image/webp;base64,${'A'.repeat(100_000)}`;
  const r = await owner('vote-save', { poll: NEW_POLL({ choices: [{ label: 'Up' , picture }, { label: 'Down' }] }) });
  assert.equal(r.status, 200, r.data.why);
  assert.equal(r.data.poll.choices[0].picture, picture);
  assert.equal((await owner('vote-owner', { pad: 'x'.repeat(7000) })).status, 413);
  assert.equal((await owner('vote-save', { poll: NEW_POLL({ choices: [{ label: 'Too big', picture: `data:image/webp;base64,${'A'.repeat(130_000)}` }, { label: 'B' }] }) })).data.why.includes('picture'), true);
  for (let i = fake.db.polls.size; i < 100; i++) fake.db.poll_put({ p_id: `filler-${i}`, p_body: structuredClone({ ...DRAFT_POLL, id: undefined }) });
  const full = await owner('vote-save', { poll: NEW_POLL() });
  assert.equal(full.status, 400);
  assert.match(full.data.why, /100 votes already/);
});
