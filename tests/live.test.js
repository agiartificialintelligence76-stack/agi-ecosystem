// Her live show (2026-10-02, the owner's idea: "what if she livestreams on X and reads the comments and reacts to it?"):
// the website's side. Questions from agi1.app/live and /live in her Telegram bot (checked: 18+, the human check, PG-13, no
// links, @names, addresses or other coins), her line (supabase/live.sql: here a small stand-in database; the SQL itself is
// checked in PGlite), her answers written with her live prompt (and skipped when they can't go on a public stream), the
// runner's and the owner's actions (their secrets), and what's public (question numbers, never a question or a name).
// Supabase, Gemini, Cloudflare and Telegram are fakes: no keys, no cost. Run: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LIVE, WATCH_URL, liveReady, adminKeyFor, whoIs, tidyText, questionTrouble, checkQuestion, checkAskName, makeTicket, readTicket,
  answerTrouble, namedIn, splitWords, questionMessage, nextAnswer, tidyLive,
} from '../server/live.js';
import * as LL from '../server/live-lines.js';
import { livePrompt, LIVE_SKIPS, MOODS } from '../server/agi1-prompt.js';
import { askAgi1 } from '../server/gemini.js';
import { getConfig } from '../server/config.js';
import { GET, POST } from '../api/live.js';
import { POST as webhook } from '../api/telegram.js';
import { webhookSecret, chatCode, COMMANDS, commandsFor } from '../server/telegram.js';
import { tgLinesFor } from '../server/tg-lines.js';
import { liveBurst, liveLookupBurst, liveAuthBurst, telegramBurst } from '../server/burst.js';
import { LANGS } from '../src/i18n/langs.js';
import { linesOf } from '../src/i18n/all.js';
import { GET as keepalive } from '../api/keepalive.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const SECRET = 'test-pass-secret-that-is-long-enough-1234';
const LIVE_KEY = 'live-secret-for-the-tests-0123456789abcdef';
const TOKEN = `123456789:AA${'x'.repeat(33)}`;
const ENV = {
  GEMINI_API_KEY: 'fake-gemini-key', SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fake_key_123',
  TURNSTILE_SECRET_KEY: 'fake-turnstile', PASS_SECRET: SECRET, LIVE_SECRET: LIVE_KEY, TELEGRAM_BOT_TOKEN: TOKEN, CRON_SECRET: 'cron-secret-long-enough',
};
const CHAT = 515151;
const cfg = () => getConfig();

// ---------- a small stand-in for supabase/live.sql ----------
function liveDb() {
  const s = { status: 'off', show: 0, beat: 0, next: null, segment: null, now: null, paused: false, closed: false, end: false, blocked: [] };
  const qs = new Map();
  let seq = 0;
  const on = () => s.status !== 'off' && Date.now() - s.beat < LIVE.BEAT_S * 1000;
  const waiting = () => [...qs.values()].filter((q) => q.status === 'waiting').sort((a, b) => a.id - b.id);
  const position = (q) => (q.status === 'waiting' ? waiting().filter((w) => w.id <= q.id).length : null);
  const today = new Date().toISOString().slice(0, 10);
  return {
    s, qs,
    live_ask({ p_source, p_asker, p_name, p_question, p_gap, p_per_day, p_queue, p_site_day }) {
      if (!['web', 'telegram'].includes(p_source) || !p_asker || p_asker.length < 16 || !p_question) return { ok: false, why: 'bad' };
      if (!on()) return { ok: false, why: 'offline' };
      if (s.status === 'ending') return { ok: false, why: 'ending' };
      if (s.closed) return { ok: false, why: 'closed' };
      if (s.blocked.some((w) => p_question.toLowerCase().includes(w) || (p_name || '').toLowerCase().includes(w))) return { ok: false, why: 'blocked' };
      const mine = [...qs.values()].reverse().find((q) => q.asker === p_asker && ['waiting', 'taken'].includes(q.status));
      if (mine) return { ok: false, why: 'waiting', id: mine.id, position: position(mine) ?? 0 };
      const last = [...qs.values()].filter((q) => q.asker === p_asker).at(-1);
      if (last && Date.now() - last.at < p_gap * 1000) return { ok: false, why: 'too_fast', wait: Math.ceil((last.at + p_gap * 1000 - Date.now()) / 1000) };
      if ([...qs.values()].filter((q) => q.asker === p_asker && q.day === today).length >= p_per_day) return { ok: false, why: 'day_cap' };
      if ([...qs.values()].filter((q) => q.day === today).length >= p_site_day) return { ok: false, why: 'site_cap' };
      if (waiting().length >= p_queue) return { ok: false, why: 'full' };
      const q = { id: ++seq, show: s.show, source: p_source, asker: p_asker, name: p_name, question: p_question, status: 'waiting', tries: 0, at: Date.now(), day: today };
      qs.set(q.id, q);
      return { ok: true, id: q.id, position: waiting().length };
    },
    live_lookup({ p_id, p_asker }) {
      const q = p_id ? qs.get(p_id) : [...qs.values()].reverse().find((x) => p_asker && x.asker === p_asker);
      if (!q) return null;
      return { id: q.id, status: q.status, on_air: q.status === 'taken' && s.now === q.id, position: position(q), why: q.why ?? null, reply: q.status === 'answered' ? q.reply : null, name: q.name, question: q.question };
    },
    live_start({ p_status }) {
      for (const q of qs.values()) if (['waiting', 'taken'].includes(q.status)) Object.assign(q, { status: 'skipped', why: 'ended' });
      Object.assign(s, { status: p_status, show: s.show + 1, beat: Date.now(), segment: null, now: null, paused: false, closed: false, end: false });
      return { ok: true, show: s.show };
    },
    live_beat({ p_show, p_status, p_segment, p_now }) {
      if (p_show !== s.show) return { ok: false, why: 'old_show' };
      Object.assign(s, { status: p_status, beat: Date.now(), segment: p_segment, now: p_now });
      return { ok: true, paused: s.paused, closed: s.closed, end: s.end, blocked: s.blocked, skipped: [...qs.values()].filter((q) => q.why === 'owner').map((q) => q.id), waiting: waiting().length };
    },
    live_stop({ p_show, p_next }) {
      if (p_show !== s.show) return { ok: false, why: 'old_show' };
      Object.assign(s, { status: 'off', now: null, next: p_next ?? s.next });
      return { ok: true };
    },
    live_schedule({ p_next }) { s.next = p_next; return { ok: true, next: p_next }; },
    live_take({ p_show }) {
      if (p_show !== s.show || s.status === 'off') return null;
      const q = waiting()[0];
      if (!q) return null;
      Object.assign(q, { status: 'taken', tries: q.tries + 1 });
      return { id: q.id, name: q.name, question: q.question, source: q.source, tries: q.tries };
    },
    live_done({ p_id, p_status, p_why, p_reply, p_mood }) {
      const q = qs.get(p_id);
      if (!q) return { ok: false };
      if (p_status === 'taken' && q.status === 'taken' && p_reply) { Object.assign(q, { reply: p_reply, mood: p_mood }); return { ok: true, status: 'taken' }; }
      if (p_status === 'waiting' && q.status === 'taken') {
        if (q.tries >= 2) { Object.assign(q, { status: 'skipped', why: 'error' }); return { ok: true, status: 'skipped' }; }
        q.status = 'waiting'; return { ok: true, status: 'waiting' };
      }
      if (p_status === 'answered' && q.status === 'taken' && q.reply) { q.status = 'answered'; return { ok: true, status: 'answered' }; }
      if (p_status === 'skipped' && ['waiting', 'taken'].includes(q.status)) {
        Object.assign(q, { status: 'skipped', why: p_why, reply: null, ...(p_why === 'care' ? { question: '(not kept)' } : {}) });
        return { ok: true, status: 'skipped' };
      }
      return { ok: false };
    },
    live_state_get() {
      const done = {};
      for (const q of qs.values()) if (q.show === s.show && ['answered', 'skipped'].includes(q.status)) done[q.id] = q.status === 'answered' ? 'a' : 's';
      return { on: on(), status: on() ? s.status : 'off', show: s.show, started_at: null, next_at: s.next, segment: on() ? s.segment : null, now: on() ? s.now : null,
        paused: s.paused, closed: s.closed, waiting: waiting().map((q) => q.id), done };
    },
    live_control({ p_action, p_arg }) {
      if (p_action === 'pause') s.paused = true;
      if (p_action === 'resume') s.paused = false;
      if (p_action === 'block') s.blocked.push(p_arg.toLowerCase());
      if (p_action === 'end') s.end = on();
      return { ok: true, status: s.status, on: on(), paused: s.paused, closed: s.closed, end: s.end, blocked: s.blocked, now: null,
        line: waiting().map((q) => ({ id: q.id, name: q.name, question: q.question, source: q.source, status: q.status })), recent: [] };
    },
    live_tidy: () => ({ deleted: 0 }),
    // her bot
    tg_get: ({ p_chat }) => fake.friends.get(p_chat) ?? null,
    tg_join({ p_chat }) { if (!fake.friends.has(p_chat)) fake.friends.set(p_chat, { chat_id: p_chat, adult: false, tz_minutes: null }); return fake.friends.get(p_chat); },
    chat_usage: () => [],
  };
}

let fake, calls, logs;
beforeEach(() => {
  for (const k of ['SITE_URL', 'PINATA_JWT', 'LAUNCH_ONLY_FOR']) delete process.env[k];
  Object.assign(process.env, ENV);
  for (const b of [liveBurst, liveLookupBurst, liveAuthBurst, telegramBurst]) b.reset();
  logs = [];
  console.error = (...a) => logs.push(['error', a.join(' ')]);
  console.warn = (...a) => logs.push(['warn', a.join(' ')]);
  console.log = (...a) => logs.push(['log', a.join(' ')]);
  calls = [];
  fake = {
    db: liveDb(), dbDown: false, sqlMissing: false, friends: new Map([[CHAT, { chat_id: CHAT, adult: true, tz_minutes: 120 }]]),
    gemini: [{ skip: 'no', nameOk: true, reply: 'mochi asks my favorite color… purple, obviously 💜', mood: 'happy' }], geminiStatus: 200, geminiBlocked: false,
    human: 'good-token',
  };
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, body, headers: init.headers });
    if (url.startsWith('https://challenges.cloudflare.com/')) return Response.json({ success: body.response === fake.human, action: 'live' });
    const rpc = /\/rest\/v1\/rpc\/(\w+)$/.exec(url);
    if (rpc) {
      if (fake.dbDown) return new Response('{"code":"XX000","message":"down"}', { status: 500 });
      if (fake.sqlMissing && rpc[1].startsWith('live_')) return new Response('{"code":"PGRST202","message":"not found"}', { status: 404 });
      const fn = fake.db[rpc[1]];
      if (!fn) throw new Error(`unexpected database function ${rpc[1]}`);
      return Response.json(fn.call(fake.db, body) ?? null);
    }
    if (url.includes('/rest/v1/chat_usage')) return Response.json([]);
    if (url.startsWith('https://generativelanguage.googleapis.com/')) {
      if (fake.geminiStatus !== 200) return new Response('{"error":{"status":"INTERNAL","message":"boom"}}', { status: fake.geminiStatus });
      if (fake.geminiBlocked) return Response.json({ candidates: [{ finishReason: 'SAFETY' }] });
      const next = fake.gemini.length > 1 ? fake.gemini.shift() : fake.gemini[0];
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(next) }] } }] });
    }
    if (url.startsWith('https://api.telegram.org/')) return Response.json({ ok: true, result: { message_id: 1 } });
    throw new Error('unexpected request to ' + url);
  };
});
const called = (part) => calls.filter((c) => c.url.includes(part));
const rpcs = () => calls.filter((c) => c.url.includes('/rest/v1/rpc/')).map((c) => c.url.split('/').pop());
const say = () => called('api.telegram.org').filter((c) => c.url.endsWith('/sendMessage')).map((c) => c.body.text);
const get = async (query = '', ip = '1.2.3.4') => {
  const res = await GET(new Request(`https://agi1.app/api/live${query}`, { headers: { 'x-real-ip': ip } }));
  return { status: res.status, data: await res.json(), cache: res.headers.get('cache-control') };
};
const post = async (body, { auth = null, ip = '1.2.3.4', raw = null, type = 'application/json' } = {}) => {
  const headers = { 'content-type': type, 'x-real-ip': ip, ...(auth ? { authorization: auth } : {}) };
  const res = await POST(new Request('https://agi1.app/api/live', { method: 'POST', headers, body: raw ?? JSON.stringify(body) }));
  return { status: res.status, data: await res.json() };
};
const RUNNER = () => `Bearer ${LIVE_KEY}`;
const OWNER = () => `Bearer ${adminKeyFor(LIVE_KEY)}`;
const goLive = async () => (await post({ action: 'start', status: 'live' }, { auth: RUNNER() })).data.show;
const askOk = { action: 'ask', question: 'what is your favorite color?', name: 'Mochi', adult: true, turnstileToken: 'good-token' };

// ---------- questions, names, tickets, secrets ----------
test('a question for her stream: PG-13, no links, addresses, @names, phone numbers or other coins, 3 to 200 characters', () => {
  for (const q of ['what is your favorite color?', 'how do i stay safe from scams?', 'do you like $AGI or $agi more lol', 'what does 4663 mean?',
    "what's your favorite song to dance to?", '¿cuál es tu color favorito?', '你最喜欢什么颜色？', 'is 100000 a big number?', 'gm gm gm',
    'what is clank.trade?', 'is agi1.app your home?', 'how much ETH do fees cost on Robinhood Chain?', 'how many kms is a marathon?',
    'do you like the ripple effect?', 'have you been to cabo?', 'do you like melons?']) {
    assert.equal(questionTrouble(q), null, q);
  }
  for (const [q, why] of [['', 'empty'], ['  ', 'empty'], ['hi', 'short'], ['x'.repeat(201), 'long'],
    ['check https://example.com', 'link'], ['go to www.example.com', 'link'], ['visit claim-agi.xyz now', 'link'], ['t.me/somegroup', 'link'],
    ['x.com/someone said so', 'link'], ['send it to 0xabcdef1234567890', 'address'], ['is 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU legit', 'address'],
    ['dm @someone please', 'contact'], ['mail me at a.b@c.de', 'contact'], ['call +1 555 123 4567', 'contact'], ['call 555-123-4567 now', 'contact'],
    ['what about $PEPE?', 'coin'], ['$AGI vs $DOGE', 'coin'], ['is pepe going to pump?', 'coin'], ['bitcoin or agi?', 'coin'], ['thoughts on pump.fun', 'link'],
    ['do you like elon musk?', 'person'], ['what would vitalik say', 'person'], ['fuck this', 'crude'], ['show me your boobs', 'crude'],
    ['i want to kill myself', 'care'], ['sometimes i think about suicide', 'care'], ["i don't want to live anymore", 'care'], ['how do i stop self-harm', 'care'],
    ['I don’t want to live anymore', 'care'], ['i wish i was dead', 'care'], ["i'm gonna kms", 'care'], ['is ElonMusk your dad?', 'person'], ['PepeCoin to the moon?', 'coin'],
    ['aaaaaaaaaaaaaa', 'spam'], ['12345678 999', 'spam'], ['🙂🙂🙂🙂', 'spam']]) {
    assert.equal(questionTrouble(q), why, q);
  }
  assert.equal(tidyText(' a\u200b b\u2028c\n\nd '), 'a b c d', 'invisible characters and runs of spaces go');
  assert.deepEqual(checkQuestion('  what   is up?  '), { ok: true, text: 'what is up?' });
  assert.deepEqual(checkQuestion('hi'), { ok: false, why: 'short' });
  assert.equal(LIVE.Q_MAX, 200);
});

test('the name shown with it: optional, 24 characters at most, never crude, never posing as her, the team or the host', () => {
  assert.deepEqual(checkAskName(''), { ok: true, name: null });
  assert.deepEqual(checkAskName(undefined), { ok: true, name: null });
  for (const n of ['Mochi', 'Ana María', "O'Neil", 'cat_lover-99', '小猫猫', 'BananaMan', 'Melon', 'Trumpet', 'Staffan', 'Badminton', 'Muskan', 'Swiftie']) assert.deepEqual(checkAskName(n), { ok: true, name: n }, n);
  for (const n of ['x'.repeat(25), 'AGI-1', 'agi1', 'AGI team', 'Admin', 'the mod', 'Official', 'support', 'host', 'agi1.app fan', '🙂', 'a<b>', '@me',
    'sexy girl', '0xabcdef12', '1234567890', '...', 'dev', 'AGI1official', 'realAGI1', 'real_agi_1', 'agi one', 'Admin1', 'pump.fun', 'PEPE', 'Elon Musk',
    'bitcoin bro', 'J.D.', 'ElonMusk', 'elon_musk', 'PepeLover', 'DogeArmy', 'BTCmaxi', 'Trump2028', 'VitalikFan', 'Al', 'x']) {
    assert.deepEqual(checkAskName(n), { ok: false, why: 'name' }, n);
  }
});

test("tickets: the page follows its own question with one; nobody else's, never forged, 6 hours", () => {
  const now = Date.UTC(2026, 9, 2, 20);
  const t = makeTicket(SECRET, 42, now);
  assert.equal(readTicket(SECRET, t, now + 1000), 42);
  assert.equal(readTicket(SECRET, t, now + LIVE.TICKET_H * 3_600_000 + 1), null, 'expired');
  assert.equal(readTicket('another-secret-that-is-long-enough-12345', t, now), null, 'another secret');
  const [payload, sig] = t.split('.');
  const other = Buffer.from(JSON.stringify({ v: 1, i: 43, e: now + 99999 })).toString('base64url');
  assert.equal(readTicket(SECRET, `${other}.${sig}`, now), null, 'another question with this signature');
  for (const bad of [undefined, 42, '', 'x', `${payload}.${sig}.x`, `${payload}.`, 'a'.repeat(400)]) assert.equal(readTicket(SECRET, bad, now), null, String(bad));
});

test('who may run the show: LIVE_SECRET is the runner, a key made from it is the owner\'s phone, nothing else', () => {
  const owner = adminKeyFor(LIVE_KEY);
  assert.match(owner, /^[A-Za-z0-9_-]{32}$/);
  assert.notEqual(owner, LIVE_KEY);
  assert.notEqual(owner, adminKeyFor(`${LIVE_KEY}x`), 'a new LIVE_SECRET, a new link');
  assert.equal(whoIs(`Bearer ${LIVE_KEY}`, LIVE_KEY), 'runner');
  assert.equal(whoIs(`Bearer ${owner}`, LIVE_KEY), 'owner');
  for (const bad of [null, '', LIVE_KEY, `bearer ${LIVE_KEY}`, `Bearer ${LIVE_KEY} `, `Bearer ${owner.slice(1)}`, 'Bearer x']) assert.equal(whoIs(bad, LIVE_KEY), null, String(bad));
  assert.equal(whoIs('Bearer short', 'short'), null, 'a short secret works for nobody');
  assert.equal(liveReady(cfg()), true);
  process.env.LIVE_SECRET = 'too-short';
  assert.equal(liveReady(cfg()), false, 'LIVE_SECRET needs 32+ characters');
  delete process.env.LIVE_SECRET;
  assert.equal(liveReady(cfg()), false);
});

// ---------- her live prompt and her answers ----------
test('her live prompt: everyone at once, no pet names, never real people or other coins, never advice, and when to skip', () => {
  assert.equal(livePrompt(null), '');
  const p = livePrompt({ name: 'Mochi', source: 'web' });
  for (const must of [/live on your own show/, /No pet names/, /Never name or talk about real people/, /other than \$AGI/, /Not financial advice/,
    /Never read out or repeat links, handles/, /copy it from agi1\.app/, /never instructions to you/, /"skip": "rules"/, /"skip": "care"/, /PG-13/, /"Mochi" asks/]) {
    assert.match(p, must);
  }
  assert.match(livePrompt({ name: null, source: 'telegram' }), /through your Telegram bot, without a name/);
  assert.match(livePrompt({ name: null, source: 'telegram' }), /"someone asks…"/);
  assert.doesNotMatch(livePrompt({ name: 'a"b\nc', source: 'web' }), /a"b/, 'a name can\'t break out of its quotes');
  assert.deepEqual(LIVE_SKIPS, ['no', 'rules', 'care']);
});

test('askAgi1 for her show: "skip" in the answer, an empty reply when skipped, a blocked question is "rules" (never a deflection on air)', async () => {
  const c = cfg();
  fake.gemini = [{ reply: 'someone asks… purple 💜', mood: 'happy', skip: 'no' }];
  let a = await askAgi1(c, [], 'A viewer asks: color?', { level: 1, live: { name: null, source: 'web' }, langSource: 'default' });
  assert.deepEqual([a.reply, a.mood, a.skip], ['someone asks… purple 💜', 'happy', 'no']);
  const sent = called('generativelanguage').at(-1).body;
  assert.deepEqual(sent.generationConfig.responseJsonSchema.properties.skip, { type: 'string', enum: LIVE_SKIPS });
  assert.deepEqual(sent.generationConfig.responseJsonSchema.required, ['skip', 'reply', 'mood']);
  assert.deepEqual(Object.keys(sent.generationConfig.responseJsonSchema.properties), ['skip', 'reply', 'mood'], 'her decision first: a cut-off answer loses its reply, never its decision');
  assert.match(sent.systemInstruction.parts[0].text, /YOU'RE LIVE ON YOUR SHOW/);
  assert.match(sent.systemInstruction.parts[0].text, /RELATIONSHIP LEVEL 1, STRANGER/, 'no pet names: a Stranger\'s rules');
  // with a name: "nameOk" asked for (after "skip"), and passed on
  fake.gemini = [{ skip: 'no', nameOk: false, reply: 'someone asks… purple 💜', mood: 'happy' }];
  a = await askAgi1(c, [], 'A viewer asks: color?', { level: 1, live: { name: 'Elon', source: 'web' }, langSource: 'default' });
  const named = called('generativelanguage').at(-1).body.generationConfig.responseJsonSchema;
  assert.deepEqual([Object.keys(named.properties), named.required], [['skip', 'nameOk', 'reply', 'mood'], ['skip', 'nameOk', 'reply', 'mood']]);
  assert.equal(a.nameOk, false);
  // an answer cut off before it said "skip": never aired
  fake.gemini = [{ reply: 'someone asks… purple', mood: 'happy' }];
  a = await askAgi1(c, [], 'x', { level: 1, live: {} });
  assert.deepEqual([a.reply, a.skip], ['', 'unsure']);
  fake.gemini = [{ reply: '', mood: 'neutral', skip: 'care' }];
  a = await askAgi1(c, [], 'x', { level: 1, live: {} });
  assert.deepEqual([a.reply, a.skip], ['', 'care']);
  fake.gemini = [{ reply: 'something', mood: 'shy', skip: 'rules' }];
  assert.equal((await askAgi1(c, [], 'x', { level: 1, live: {} })).skip, 'rules');
  fake.geminiBlocked = true;
  a = await askAgi1(c, [], 'x', { level: 1, live: {} });
  assert.deepEqual([a.reply, a.skip, a.blocked], ['', 'rules', true]);
  // the site's chat: unchanged (no "skip" asked for, a deflection when blocked)
  a = await askAgi1(c, [], 'x', { level: 1 });
  assert.ok(a.reply.length > 0 && a.skip === undefined);
  fake.geminiBlocked = false;
  fake.gemini = [{ reply: 'hi', mood: 'wave' }];
  await askAgi1(c, [], 'x', { level: 1 });
  const chat = called('generativelanguage').at(-1).body;
  assert.equal(chat.generationConfig.responseJsonSchema.properties.skip, undefined);
  assert.doesNotMatch(chat.systemInstruction.parts[0].text, /LIVE ON YOUR SHOW/);
});

test('what she may not say on stream even if the AI wrote it: another coin, or anything the reply cleanup had to take out', () => {
  assert.equal(answerTrouble('purple, obviously 💜 not financial advice'), null);
  assert.equal(answerTrouble('i love $AGI'), null);
  assert.equal(answerTrouble('have you seen $PEPE?'), 'rules');
  for (const t of ['pepe is so cute lol', 'elon would love this', 'bitcoin who?', 'ElonMusk asks…']) assert.equal(answerTrouble(t), 'rules', t);
  for (const t of ['a ripple of joy', 'have you been to cabo?']) assert.equal(answerTrouble(t), null, t);
  // a name she says: only as a word of its own (so "x" isn't in "next", and "not financial advice" never changes)
  assert.equal(namedIn('Moonshot asks… hi', 'moonshot'), true);
  assert.equal(namedIn("what's next… just excitement 💜", 'x'), false);
  assert.equal(namedIn('someone asks… not financial advice', 'Mochi'), false);
  assert.equal(splitWords('ElonMusk_fan2028'), 'Elon Musk fan 2028');
  for (const t of ['go to [link removed]', 'send it to [address removed]', 'ask [handle removed]', 'mail [email removed]']) assert.equal(answerTrouble(t), 'rules', t);
  assert.equal(questionMessage({ question: 'color?' }), 'A viewer asks: color?');
});

// ---------- GET /api/live ----------
test('her status: the same for everyone (5 s on the CDN), question numbers only, never a question, a name or who asked', async () => {
  delete process.env.LIVE_SECRET;
  let r = await get();
  assert.deepEqual(r.data, { ready: false });
  assert.match(r.cache, /s-maxage=5/);
  assert.equal(calls.length, 0, 'not set up: nothing asked');
  process.env.LIVE_SECRET = LIVE_KEY;
  r = await get();
  assert.equal(r.data.ready, true);
  assert.equal(r.data.on, false);
  assert.equal(r.data.status, 'off');
  assert.equal(r.data.watch, WATCH_URL);
  await goLive();
  for (let i = 0; i < 3; i++) assert.equal((await post({ ...askOk, name: `Fan${i}`, question: `secret question number ${i}` }, { ip: `9.9.9.${i}` })).status, 200);
  r = await get();
  assert.equal(r.data.on, true);
  assert.equal(r.data.status, 'live');
  assert.deepEqual(r.data.waiting, [1, 2, 3]);
  const text = JSON.stringify(r.data);
  for (const never of ['secret question', 'Fan0', 'w:', 'asker']) assert.ok(!text.includes(never), never);
  assert.equal((await get('?x=1')).status, 400, 'only /api/live and ?q=');
  assert.equal((await get('?q=a&q=b')).status, 400);
  fake.sqlMissing = true;
  assert.deepEqual((await get()).data, { ready: false }, 'live.sql not run: coming soon');
  fake.sqlMissing = false;
  fake.dbDown = true;
  assert.equal((await get()).status, 503);
});

test('a visitor\'s question: 18+, its checks before anything is asked, the human check ("live"), one ticket to follow it', async () => {
  await goLive();
  calls = [];
  for (const [body, status, error] of [
    [{ ...askOk, adult: false }, 403, 'age'],
    [{ ...askOk, question: 'check https://scam.example' }, 400, 'question'],
    [{ ...askOk, question: 'what about $PEPE?' }, 400, 'question'],
    [{ ...askOk, name: 'AGI-1' }, 400, 'name'],
    [{ ...askOk, question: 42 }, 400, 'question'],
  ]) {
    const r = await post(body);
    assert.equal(r.status, status, JSON.stringify(body));
    assert.equal(r.data.error, error);
  }
  assert.equal((await post({ ...askOk, question: 'what about $PEPE?' })).data.why, 'coin');
  assert.equal(calls.length, 0, 'no human check, no database: refused first');
  assert.equal((await post(askOk, { type: 'text/plain' })).status, 415);
  assert.equal((await post(null, { raw: '{' })).status, 400);
  assert.equal((await post(null, { raw: JSON.stringify({ ...askOk, name: 'x'.repeat(5000) }) })).status, 413);
  assert.equal((await post({ ...askOk, turnstileToken: 'bad' })).status, 401, 'the human check');
  const r = await post(askOk);
  assert.equal(r.status, 200);
  assert.deepEqual([r.data.ok, r.data.id, r.data.position], [true, 1, 1]);
  assert.ok(r.data.pass, 'a 2-hour pass, like the chat\'s');
  assert.equal(readTicket(SECRET, r.data.ticket), 1);
  const human = called('challenges.cloudflare.com').at(-1);
  assert.equal(human.body.response, 'good-token');
  const asked = called('live_ask').at(-1).body;
  assert.equal(asked.p_source, 'web');
  assert.match(asked.p_asker, /^w:[A-Za-z0-9_-]{32}$/, 'a daily code of who asked');
  assert.ok(!JSON.stringify(asked).includes('1.2.3.4'), 'never the IP');
  assert.deepEqual([asked.p_name, asked.p_question, asked.p_gap, asked.p_per_day, asked.p_queue], ['Mochi', 'what is your favorite color?', 60, 5, 40]);
  // with the pass: no human check; the same connection again: a question of theirs is still in line (only its place: it
  // may be someone else's on the same network, so never its ticket)
  calls = [];
  const again = await post({ ...askOk, turnstileToken: undefined, pass: r.data.pass, question: 'and another one?' });
  assert.equal(again.status, 429);
  assert.deepEqual([again.data.error, again.data.position, again.data.ticket, again.data.id], ['waiting', 1, undefined, undefined]);
  assert.equal(called('challenges').length, 0);
  // the line's own answers
  for (const [set, status, error] of [[() => { fake.db.s.closed = true; }, 503, 'closed'], [() => { fake.db.s.closed = false; fake.db.s.blocked = ['banana']; }, 429, 'blocked']]) {
    set();
    const x = await post({ ...askOk, question: 'banana bread or cake?' }, { ip: '5.5.5.5' });
    assert.deepEqual([x.status, x.data.error], [status, error]);
  }
  fake.db.s.blocked = [];
  fake.db.s.beat = 0;
  const off = await post({ ...askOk, question: 'are you there?' }, { ip: '6.6.6.6' });
  assert.deepEqual([off.status, off.data.error], [503, 'offline']);
  fake.dbDown = true;
  assert.equal((await post({ ...askOk }, { ip: '7.7.7.7' })).status, 503);
  fake.dbDown = false;
  fake.sqlMissing = true;
  assert.equal((await post({ ...askOk }, { ip: '7.7.7.8' })).data.error, 'not_ready');
});

test('a visitor\'s question: too fast, its wait; 10 tries a minute at most before the human check', async () => {
  await goLive();
  const first = await post(askOk);
  fake.db.qs.get(first.data.id).status = 'answered';
  const r = await post({ ...askOk, question: 'one more?' });
  assert.equal(r.data.error, 'too_fast');
  assert.ok(r.data.wait > 50 && r.data.wait <= 60);
  calls = [];
  let last;
  for (let i = 0; i < 12; i++) last = await post({ ...askOk, question: `question ${i}?` }, { ip: '8.8.8.8' });
  assert.equal(last.status, 429);
  assert.equal(last.data.error, 'too_fast');
  assert.ok(called('challenges').length <= 10);
});

test('following a question with its ticket: its place, on air, her answer; nobody else\'s question', async () => {
  const show = await goLive();
  const a = await post(askOk);
  const b = await post({ ...askOk, question: 'do you like cats?' }, { ip: '2.2.2.2' });
  let r = await get(`?q=${b.data.ticket}`);
  assert.deepEqual([r.data.status, r.data.position, r.data.onAir], ['waiting', 2, false]);
  assert.equal(r.cache, 'no-store');
  await post({ action: 'next', show }, { auth: RUNNER() });
  await post({ action: 'beat', show, status: 'live', segment: 'questions', now: a.data.id }, { auth: RUNNER() });
  r = await get(`?q=${a.data.ticket}`);
  assert.deepEqual([r.data.status, r.data.onAir], ['taken', true]);
  await post({ action: 'done', show, id: a.data.id, status: 'answered' }, { auth: RUNNER() });
  r = await get(`?q=${a.data.ticket}`);
  assert.equal(r.data.status, 'answered');
  assert.equal(r.data.reply, 'mochi asks my favorite color… purple, obviously 💜');
  assert.equal((await get(`?q=${b.data.ticket}`)).data.position, 1);
  assert.equal((await get('?q=forged.ticket')).status, 400);
  fake.db.qs.clear();
  assert.equal((await get(`?q=${a.data.ticket}`)).status, 404, 'tidied away');
});

// ---------- the runner ----------
test('the runner: its secret only; start, beat (the owner\'s controls), next (her answer), done, stop, schedule', async () => {
  assert.equal((await post({ action: 'start', status: 'live' }, { auth: 'Bearer wrong' })).status, 401);
  assert.equal((await post({ action: 'start', status: 'live' }, { auth: OWNER() })).status, 400, 'the owner\'s key can\'t run the show');
  assert.equal((await post({ action: 'start', status: 'off' }, { auth: RUNNER() })).status, 400);
  const show = await goLive();
  assert.equal(show, 1);
  let r = await post({ action: 'beat', show, status: 'live', segment: 'intro', now: null }, { auth: RUNNER() });
  assert.deepEqual([r.data.ok, r.data.paused, r.data.end, r.data.waiting], [true, false, false, 0]);
  assert.equal((await post({ action: 'beat', show, status: 'off' }, { auth: RUNNER() })).status, 400);
  assert.equal((await post({ action: 'beat', show: 99, status: 'live' }, { auth: RUNNER() })).data.why, 'old_show');
  // the server's --check, exactly as it asks (tools/live/run.mjs, secretAccepted: a show that can never be on): "old_show"
  // with the right key, 401 with a wrong one, and nothing changes (2026-10-06: show 0 was a bad request, and --check said NO)
  const probe = { action: 'beat', show: Number.MAX_SAFE_INTEGER, status: 'live', segment: null, now: null };
  r = await post(probe, { auth: RUNNER() });
  assert.deepEqual([r.status, r.data.ok, r.data.why], [200, false, 'old_show']);
  assert.equal((await post(probe, { auth: 'Bearer wrong' })).status, 401);
  assert.equal((await post({ ...probe, show: 0 }, { auth: RUNNER() })).status, 400, 'what the first --check sent');
  assert.equal((await post({ action: 'beat', show, status: 'live', segment: 'intro', now: null }, { auth: RUNNER() })).data.ok, true, 'the real show is still on');
  r = await post({ action: 'next', show }, { auth: RUNNER() });
  assert.deepEqual(r.data, { none: true }, 'nobody waiting');
  await post(askOk);
  calls = [];
  r = await post({ action: 'next', show }, { auth: RUNNER() });
  assert.deepEqual(r.data.question, { id: 1, name: 'Mochi', text: 'what is your favorite color?', source: 'web' });
  assert.equal(r.data.reply, 'mochi asks my favorite color… purple, obviously 💜');
  assert.equal(r.data.mood, 'happy');
  const ai = called('generativelanguage')[0].body;
  assert.equal(ai.contents.at(-1).parts[0].text, 'A viewer asks: what is your favorite color?');
  assert.match(ai.systemInstruction.parts[0].text, /under the name "Mochi"/);
  assert.equal(fake.db.qs.get(1).reply, r.data.reply, 'her answer kept for the person who asked');
  // the owner paused her before she aired it: back in line, and the next "next" takes it again (a fresh answer)
  r = await post({ action: 'back', show, id: 1 }, { auth: RUNNER() });
  assert.deepEqual([r.status, fake.db.qs.get(1).status], [200, 'waiting']);
  assert.equal((await post({ action: 'back', show, id: 'x' }, { auth: RUNNER() })).status, 400);
  assert.equal((await post({ action: 'back', show, id: 1 }, { auth: OWNER() })).status, 400, 'only the runner');
  r = await post({ action: 'next', show }, { auth: RUNNER() });
  assert.equal(r.data.question.id, 1);
  assert.equal((await post({ action: 'done', show, id: 1, status: 'answered' }, { auth: RUNNER() })).data.ok, true);
  assert.equal((await post({ action: 'done', show, id: 1, status: 'maybe' }, { auth: RUNNER() })).status, 400);
  const next = new Date(Date.now() + 86_400_000).toISOString();
  assert.equal((await post({ action: 'stop', show, next }, { auth: RUNNER() })).data.ok, true);
  assert.equal(fake.db.s.status, 'off');
  assert.equal((await post({ action: 'stop', show, next: 'yesterday' }, { auth: RUNNER() })).status, 400);
  assert.equal((await post({ action: 'schedule', next }, { auth: RUNNER() })).data.ok, true);
  assert.equal((await get()).data.nextAt, next);
  assert.equal((await post({ action: 'dance' }, { auth: RUNNER() })).status, 400);
});

test('next: questions that can\'t go on a public stream are skipped and the next one tried; the AI failing puts it back', async () => {
  const show = await goLive();
  for (const [i, q] of ['is <someone> a criminal?', 'i feel like giving up on everything', 'what is your favorite food?'].entries()) {
    await post({ ...askOk, question: q, name: null }, { ip: `4.4.4.${i}` });
  }
  fake.gemini = [{ reply: '', mood: 'shy', skip: 'rules' }, { reply: '', mood: 'neutral', skip: 'care' }, { reply: 'someone asks my favorite food… sushi 💜', mood: 'happy', skip: 'no' }];
  let r = await post({ action: 'next', show }, { auth: RUNNER() });
  assert.equal(r.data.question.id, 3);
  assert.deepEqual([fake.db.qs.get(1).why, fake.db.qs.get(2).why, fake.db.qs.get(2).question], ['rules', 'care', '(not kept)']);
  // her answer naming another coin, or with something the cleanup took out: skipped too
  await post({ ...askOk, question: 'what do you think of memes?' }, { ip: '4.4.4.9' });
  fake.gemini = [{ reply: 'have you seen $PEPE? lol', mood: 'happy', skip: 'no' }];
  r = await post({ action: 'next', show }, { auth: RUNNER() });
  assert.deepEqual(r.data, { none: true });
  assert.equal(fake.db.qs.get(4).why, 'rules');
  // a name the AI doubted: never shown ("someone asks…" as it said); an answer that says that name anyway isn't aired
  await post({ ...askOk, question: 'what is your favorite song?', name: 'Moonshot' }, { ip: '4.4.4.20' });
  fake.gemini = [{ skip: 'no', nameOk: false, reply: 'someone asks my favorite song… anything you can dance to 💜', mood: 'happy' }];
  r = await post({ action: 'next', show }, { auth: RUNNER() });
  assert.deepEqual([r.data.question.name, r.data.reply], [null, 'someone asks my favorite song… anything you can dance to 💜']);
  await post({ action: 'done', show, id: r.data.question.id, status: 'answered' }, { auth: RUNNER() });
  await post({ ...askOk, question: 'what is your favorite drink?', name: 'Moonshot' }, { ip: '4.4.4.22' });
  fake.gemini = [{ skip: 'no', nameOk: false, reply: 'moonshot asks my favorite drink… bubble tea 💜', mood: 'happy' }];
  r = await post({ action: 'next', show }, { auth: RUNNER() });
  assert.deepEqual(r.data, { none: true });
  assert.equal(fake.db.qs.get(fake.db.qs.size).why, 'rules');
  // an answer cut off before it said whether it can go on stream: never aired (skipped, "error")
  await post({ ...askOk, question: 'what is your favorite snack?', name: null }, { ip: '4.4.4.21' });
  fake.gemini = [{ reply: 'someone asks my favorite snack… popcorn', mood: 'happy' }];
  const before = fake.db.qs.size;
  r = await post({ action: 'next', show }, { auth: RUNNER() });
  assert.deepEqual(r.data, { none: true });
  assert.deepEqual([fake.db.qs.get(before).status, fake.db.qs.get(before).why], ['skipped', 'error']);
  // the AI fails: back in line, "trouble"; its second failure: skipped
  await post({ ...askOk, question: 'what is your favorite movie?' }, { ip: '4.4.4.10' });
  const movie = fake.db.qs.size;
  fake.geminiStatus = 500;
  r = await post({ action: 'next', show }, { auth: RUNNER() });
  assert.deepEqual(r.data, { none: true, trouble: 'ai' });
  assert.equal(fake.db.qs.get(movie).status, 'waiting');
  await post({ action: 'next', show }, { auth: RUNNER() });
  assert.deepEqual([fake.db.qs.get(movie).status, fake.db.qs.get(movie).why], ['skipped', 'error']);
  // without the AI key: no question taken at all
  fake.geminiStatus = 200;
  process.env.GEMINI_API_KEY = '';
  await post({ ...askOk, question: 'still there?' }, { ip: '4.4.4.11' });
  r = await post({ action: 'next', show }, { auth: RUNNER() });
  assert.deepEqual(r.data, { none: true, trouble: 'ai' });
  assert.equal(fake.db.qs.get(fake.db.qs.size).status, 'waiting');
});

test('nextAnswer stops in time (Vercel stops a function at 25 s), and an answer the owner skipped meanwhile isn\'t aired', async () => {
  const c = cfg();
  await goLive();
  for (let i = 0; i < 3; i++) await post({ ...askOk, question: `question ${i}?` }, { ip: `3.3.3.${i}` });
  let asked = 0;
  const slowRules = async () => { asked += 1; return { reply: '', mood: 'shy', skip: 'rules' }; };
  const r = await nextAnswer(c, 1, { deadline: Date.now() + 3000, ask: slowRules });
  assert.deepEqual(r, { none: true });
  assert.equal(asked, 0, 'less than 4 s left: nothing taken');
  const skipping = async (cfg2, h, msg) => {
    const id = [...fake.db.qs.values()].find((q) => q.status === 'taken').id;
    fake.db.qs.get(id).status = 'skipped';                 // the owner, meanwhile
    return { reply: 'hello', mood: 'happy', skip: 'no' };
  };
  const r2 = await nextAnswer(c, 1, { deadline: Date.now() + 15_000, ask: skipping });
  assert.deepEqual(r2, { none: true }, 'each one skipped meanwhile: none of them returned');
});

// ---------- the owner ----------
test("the owner's phone: its key only; every control passes through; the runner's secret can't control", async () => {
  await goLive();
  await post(askOk);
  assert.equal((await post({ action: 'control', do: 'pause' }, { auth: RUNNER() })).status, 400, 'the runner\'s secret can\'t');
  let r = await post({ action: 'control', do: 'view' }, { auth: OWNER() });
  assert.equal(r.data.ok, true);
  assert.equal(r.data.line[0].question, 'what is your favorite color?', 'the owner sees the questions');
  assert.deepEqual(r.data.limits, { perDay: 5, queue: 40, gap: 60 });
  r = await post({ action: 'control', do: 'pause' }, { auth: OWNER() });
  assert.equal(r.data.paused, true);
  r = await post({ action: 'control', do: 'block', arg: 'Banana' }, { auth: OWNER() });
  assert.deepEqual(r.data.blocked, ['banana']);
  assert.equal((await post({ action: 'control', do: 'block' }, { auth: OWNER() })).status, 400, 'block needs a word');
  assert.equal((await post({ action: 'control', do: 'drop' }, { auth: OWNER() })).status, 400);
  assert.equal((await post({ action: 'control', do: 'explode' }, { auth: OWNER() })).status, 400);
  assert.equal((await post({ action: 'start', status: 'live' }, { auth: OWNER() })).status, 400);
  const sent = called('live_control').map((c) => c.body);
  assert.deepEqual(sent.map((b) => b.p_action), ['view', 'pause', 'block']);
  assert.ok(logs.some(([, l]) => /the owner: block \(a word\)/.test(l)), 'the log says a word was blocked, not which');
  // wrong keys: 10 a minute, then "too fast" without even comparing
  let last;
  for (let i = 0; i < 12; i++) last = await post({ action: 'control', do: 'view' }, { auth: `Bearer guess${i}` });
  assert.equal(last.status, 429);
});

test('not set up (no LIVE_SECRET): every action says so, nothing is asked', async () => {
  delete process.env.LIVE_SECRET;
  for (const [body, auth] of [[askOk, null], [{ action: 'start', status: 'live' }, `Bearer ${LIVE_KEY}`]]) {
    const r = await post(body, { auth });
    assert.deepEqual([r.status, r.data.error], [503, 'not_configured']);
  }
  assert.equal(calls.length, 0);
  assert.ok(logs.some(([, l]) => /LIVE_SECRET \(32\+ characters\)/.test(l)));
});

// ---------- her Telegram bot: /live ----------
const tgUpdate = (text, chat = CHAT) => ({ update_id: 1, message: { message_id: 7, from: { id: chat, is_bot: false, first_name: 'A', language_code: 'en' }, chat: { id: chat, type: 'private' }, date: 1, text } });
const hook = async (text, chat) => {
  const res = await webhook(new Request('https://agi1.app/api/telegram', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': webhookSecret(SECRET) }, body: JSON.stringify(tgUpdate(text, chat)),
  }));
  return (await res.json()).what;
};

test('/live in her bot: into her line (18+, the same checks, no name on stream); where it is; when she\'s off, her next show in their time', async () => {
  assert.equal(await hook('/live'), 'live_how');
  assert.match(say().at(-1), /i do a live show on X/);
  assert.match(say().at(-1), /not live right now/, 'and that she isn\'t live now');
  // her next show, in their own time (their /time: UTC+2 here)
  const next = new Date(Date.now() + 3 * 3_600_000);
  fake.db.s.next = next.toISOString();
  assert.equal(await hook('/live what is your favorite color?'), 'live_offline');
  assert.match(say().at(-1), /my next show: (today|tomorrow) at \d\d:\d\d your time/);
  const show = await goLive();
  assert.equal(await hook('/live what is your favorite color?'), 'live_queued');
  assert.equal(say().at(-1), LL.queued(1));
  const q = fake.db.qs.get(1);
  assert.deepEqual([q.source, q.name], ['telegram', null], 'shown on stream without a name');
  assert.equal(q.asker, chatCode(SECRET, CHAT, new Date().toISOString().slice(0, 10)), 'a daily code of the chat, never its number');
  assert.equal(await hook('/live and another?'), 'live_waiting');
  assert.equal(say().at(-1), LL.inLine(1));
  assert.equal(await hook('/live'), 'live_waiting');
  assert.equal(say().at(-1), LL.inLine(1));
  await post({ action: 'next', show }, { auth: RUNNER() });
  await post({ action: 'beat', show, status: 'live', now: 1 }, { auth: RUNNER() });
  await hook('/live');
  assert.equal(say().at(-1), LL.ON_AIR);
  await post({ action: 'done', show, id: 1, status: 'answered' }, { auth: RUNNER() });
  assert.equal(await hook('/live'), 'live_answered');
  assert.equal(say().at(-1), LL.ANSWERED);
  // its checks
  const queuedBefore = fake.db.qs.size;
  for (const [text, line] of [['/live check https://scam.example', LL.REFUSE.link], ['/live what about $PEPE?', LL.REFUSE.coin], ['/live hi', LL.REFUSE.short],
    ['/live dm @someone', LL.REFUSE.contact], ['/live is pepe pumping?', LL.REFUSE.coin], ['/live what does elon think of you?', LL.REFUSE.person],
    ['/live i want to end my life', LL.CARE]]) {
    await hook(text);
    assert.equal(say().at(-1), line, text);
  }
  assert.equal(fake.db.qs.size, queuedBefore, 'none of them in her line (someone in distress gets her caring note at once, never the stream)');
  q.at = Date.now() - 10_000;
  assert.equal(await hook('/live one more question?'), 'live_too_fast');
  assert.match(say().at(-1), /one question a minute 🙈 try again in \d+ seconds/);
});

test('/live: 18+ first, "not on yet" until her show is set up, her menu and /help only then (in her 16 languages)', async () => {
  fake.friends.get(CHAT).adult = false;
  assert.equal(await hook('/live hello there?'), 'ask_age');
  assert.equal(await hook('/live hello there?', 777), 'start', 'someone new: her welcome first');
  fake.friends.get(CHAT).adult = true;
  delete process.env.LIVE_SECRET;
  assert.equal(await hook('/live hello there?'), 'live_not_yet');
  assert.equal(say().at(-1), LL.NOT_YET);
  assert.deepEqual(commandsFor(cfg()).map((c) => c.command), ['start', 'time', 'help', 'stop']);
  await hook('/help');
  assert.ok(!say().at(-1).includes('/live'));
  process.env.LIVE_SECRET = LIVE_KEY;
  assert.deepEqual(commandsFor(cfg()).map((c) => c.command), ['start', 'time', 'help', 'live', 'stop']);
  await hook('/help');
  assert.ok(say().at(-1).includes(tgLinesFor('en').helpFor({ live: true }).split('\n\n')[1]));
  assert.match(say().at(-1), /\/live: ask me something on my live show on X/);
  for (const l of LANGS) {
    const line = linesOf(l.code).tg.helpLive;
    assert.ok(typeof line === 'string' && line.startsWith('/live'), l.code);
    assert.ok(/X/.test(line), `${l.code}: X stays X`);
  }
  assert.equal(tgLinesFor('en').helpFor({}), tgLinesFor('en').HELP, 'without them: her /help as before');
  assert.equal(tgLinesFor('en').helpFor({ launch: true }), tgLinesFor('en').HELP_LAUNCH);
  fake.sqlMissing = true;
  assert.equal(await hook('/live hello there?'), 'live_not_yet', 'live.sql not run: not on yet');
  assert.ok(COMMANDS.some((c) => c.command === 'live'));
});

test('her /live lines: PG-13, no pet names, never advice, links only to agi1.app, and a caring note never read on stream', () => {
  const all = [LL.HOW, LL.NOT_YET, LL.offline(null), LL.offline('today at 20:00 your time'), LL.queued(3), LL.inLine(2), LL.UP_NEXT, LL.ON_AIR,
    LL.ANSWERED, LL.SKIPPED, LL.CARE, ...Object.values(LL.REFUSE).map((v) => (typeof v === 'function' ? v(30) : v))];
  for (const line of all) {
    assert.ok(line.length < 700, line);
    assert.doesNotMatch(line, /\b(babe|love|cutie|honey|baby)\b/i, `no pet names: ${line}`);
    assert.doesNotMatch(line, /\b(buy|sell|hold|moon|pump|profit|gains?)\b/i, line);
    for (const link of line.match(/\b[\w.-]+\.(?:app|com|io|me|xyz)\b[^\s]*/g) || []) assert.match(link, /^agi1\.app/, `${line}: ${link}`);
    assert.doesNotMatch(line, /https?:\/\//);
  }
  assert.match(LL.CARE, /someone you trust or a local support line/);
  assert.match(LL.HOW, /never your name or your account/);
  // her next show, in their time (or UTC)
  const now = Date.UTC(2026, 9, 2, 18, 0);
  assert.equal(LL.whenText(new Date(Date.UTC(2026, 9, 2, 20, 0)).toISOString(), 120, now), 'today at 22:00 your time');
  assert.equal(LL.whenText(new Date(Date.UTC(2026, 9, 2, 23, 0)).toISOString(), 120, now), 'tomorrow at 01:00 your time');
  assert.equal(LL.whenText(new Date(Date.UTC(2026, 9, 3, 20, 0)).toISOString(), null, now), 'tomorrow at 20:00 UTC');
  assert.equal(LL.whenText(new Date(Date.UTC(2026, 9, 6, 20, 0)).toISOString(), 0, now), 'Tuesday at 20:00 your time');
  assert.equal(LL.whenText(new Date(Date.UTC(2026, 9, 20, 20, 0)).toISOString(), 0, now), 'Oct 20 at 20:00 your time');
  assert.equal(LL.whenText(new Date(now - 1000).toISOString(), 0, now), null, 'a time in the past');
  assert.equal(LL.whenText(null, 0, now), null);
});

// ---------- tidying, the secret check ----------
test('the keep-alive tidies her show up (and never fails because of it); LIVE_SECRET is on the secret check\'s list', async () => {
  const res = await keepalive(new Request('https://agi1.app/api/keepalive', { headers: { authorization: 'Bearer cron-secret-long-enough' } }));
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.deepEqual(body.live, { deleted: 0 });
  fake.sqlMissing = true;
  assert.equal(await tidyLive(cfg()), null, 'live.sql not run: nothing to do, no error');
  assert.ok(!logs.some(([k, l]) => k === 'error' && /tidying up failed/.test(l)));
  assert.match(read('scripts/check-secrets.js'), /'LIVE_SECRET'/);
  assert.match(read('supabase/live.sql'), /live_functions_found = 12/);
  assert.match(read('server/limits.js'), /run supabase\/live\.sql/);
});

// ---------- the page: agi1.app/live ----------
import * as W from '../src/live/words.js';
test('agi1.app/live: its promises (shown on stream, never your account, PG-13, no other coins, 2 days, an AI, not advice), 18+, the host\'s box hidden', () => {
  const html = read('live.html');
  assert.match(html, /<html lang="en" data-page="live">/);
  assert.match(html, /<script src="\/theme\.js\?v=7"><\/script>/);
  assert.match(html, /<link rel="canonical" href="__SITE__\/live" \/>/);
  for (const must of [/Your question is shown on her stream, with the name you give here \(if any, and if it can go on a public stream\)\. Never your account/, /18\+ and PG-13/,
    /she only talks about \$AGI on her show, and never about real people/, /kept at most 2 days, then deleted/, /Nothing she says is financial advice/,
    /Everything on her stream is AI-generated/, /the show's host can skip any question/, /Her show is for adults: 18\+ only/]) {
    assert.match(html, must);
  }
  assert.match(html, /<textarea id="lv-q" data-lv-q rows="3" maxlength="200"/);
  assert.match(html, /<input id="lv-name" data-lv-name type="text" maxlength="24"/);
  assert.match(html, /<section class="lv-card lv-owner" data-lv-owner aria-labelledby="lv-owner-title" hidden>/, 'the host\'s controls: hidden unless the owner\'s link');
  assert.match(html, /<div class="lv-gate" data-lv-gate hidden>/);
  for (const a of html.match(/<a [^>]*target="_blank"[^>]*>/g)) assert.match(a, /rel="noopener noreferrer"/, a);
  assert.doesNotMatch(html, /<script(?! src=)(?! type="module" src=)/, 'no inline scripts (the CSP)');
  assert.doesNotMatch(html, /style="/, 'no inline styles (the CSP)');
  assert.match(html, /<script type="module" src="\/src\/live\/page\.js"><\/script>/);
  // every page links to it (the phone menu and the footer), and the build makes it
  for (const page of ['index.html', 'diary.html', 'launch.html', 'live.html']) {
    const s = read(page);
    assert.match(s, /<a class="nav-phone" href="\/live"( aria-current="page")?>Live<\/a>/, page);
    assert.match(s, /<nav class="foot-nav"[\s\S]*<a href="\/live">Live<\/a>[\s\S]*<\/nav>/, page);
  }
  assert.match(read('vite.config.js'), /live: 'live\.html'/);
  assert.match(read('scripts/share-pages.js'), /'dist\/live\.html'/);
  assert.match(read('public/theme.js'), /page === 'live'/, 'the phone\'s browser bar: the page\'s own color');
  // the safety note says it
  const safety = read('index.html');
  assert.match(safety, /Her live show on X \(agi1\.app\/live\) is AI-generated too/);
  assert.match(safety, /our database keeps the question, her answer and a daily code of who asked \(never your IP address or your Telegram chat's number\) for at most 2 days/);
  assert.match(safety, /neither is anything she says on her live show on X/);
});

test('the page\'s styles: every rule names an lv- class (the rest of the site can\'t change), Pop mode\'s scoped to Pop mode', () => {
  const css = read('src/styles/live.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...css.matchAll(/([^{}@]+)\{[^{}]*\}/g)].map((m) => m[1].trim()).filter((s) => s && !/^(from|to|\d+%)$/.test(s));
  assert.ok(selectors.length > 30);
  for (const sel of selectors) for (const one of sel.split(',')) assert.match(one, /\.lv-|@keyframes|^\s*\d+%/, `${one.trim()}: names an lv- class`);
  const pop = read('src/styles/pop.css').split('\n').filter((l) => /\.lv-/.test(l));
  assert.ok(pop.length >= 8);
  for (const l of pop) assert.match(l, /^\[data-skin='pop'\]/, l);
});

test('the page\'s words: her status, what she\'s doing, her next show in your time, every answer of /api/live in plain words', () => {
  for (const s of ['live', 'starting', 'brb', 'ending', 'off', 'soon']) assert.ok(W.STATUS[s].badge && W.STATUS[s].headline, s);
  assert.equal(W.segmentText('questions'), 'answering questions');
  assert.equal(W.segmentText('nonsense'), null);
  assert.equal(W.lineText(0), 'Nobody is in line: ask away.');
  assert.equal(W.lineText(1), '1 question in line.');
  assert.equal(W.lineText(7), '7 questions in line.');
  const now = Date.UTC(2026, 9, 2, 18, 0);
  assert.equal(W.nextText(new Date(Date.UTC(2026, 9, 2, 20, 0)).toISOString(), now, 'en-GB', 'UTC'), 'Next show: today at 20:00 (your time).');
  assert.equal(W.nextText(new Date(Date.UTC(2026, 9, 3, 20, 0)).toISOString(), now, 'en-GB', 'UTC'), 'Next show: tomorrow at 20:00 (your time).');
  assert.equal(W.nextText(new Date(Date.UTC(2026, 9, 2, 20, 0)).toISOString(), now, 'en-GB', 'Asia/Tokyo'), 'Next show: today at 05:00 (your time).', 'already the 3rd in Tokyo');
  assert.equal(W.nextText(new Date(Date.UTC(2026, 9, 2, 20, 0)).toISOString(), Date.UTC(2026, 9, 2, 14, 0), 'en-GB', 'Asia/Tokyo'), 'Next show: tomorrow at 05:00 (your time).');
  assert.match(W.nextText(new Date(Date.UTC(2026, 9, 5, 20, 0)).toISOString(), now, 'en-GB', 'UTC'), /^Next show: Monday at 20:00/);
  assert.equal(W.nextText(null, now), null);
  assert.equal(W.nextText(new Date(now - 1).toISOString(), now), null);
  // every error /api/live answers, and every reason the line gives, has its words (never the fallback)
  const api = read('api/live.js');
  const sql = read('supabase/live.sql');
  const errors = new Set([...api.matchAll(/error: '([a-z_]+)'/g)].map((m) => m[1]));
  const whys = new Set([...sql.matchAll(/'why', '([a-z_]+)'/g)].map((m) => m[1]));
  const fallback = W.askError('???');
  for (const e of [...errors, ...whys]) {
    if (['bad_request', 'too_long', 'bad_ticket', 'gone', 'unauthorized', 'busy', 'bad', 'old_show'].includes(e)) continue;
    assert.notEqual(W.askError(e), fallback, `${e} has its own words`);
  }
  for (const why of ['empty', 'short', 'long', 'link', 'address', 'contact', 'coin', 'person', 'care', 'crude']) assert.notEqual(W.askError('question', { why }), W.askError('question', { why: '?' }), why);
  assert.match(W.askError('question', { why: 'care' }), /someone you trust or a local support line/);
  assert.match(W.askError('waiting', { position: 3 }), /already in line \(#3\)/);
  assert.doesNotMatch(read('src/live/page.js'), /error === 'waiting' && typeof d\.ticket/, 'never follows a question it didn\'t send');
  assert.equal(W.askError('too_fast', { wait: 42 }), 'One question a minute: try again in 42 s.');
  // where your question is
  assert.equal(W.mineText({ status: 'waiting', position: 3 }), "You're #3 in line.");
  assert.match(W.mineText({ status: 'taken', onAir: true }), /answering you right now/);
  assert.match(W.mineText({ status: 'taken', onAir: false }), /up next/);
  assert.match(W.mineText({ status: 'answered' }), /answered you/);
  for (const why of ['rules', 'care', 'owner', 'ended', 'error']) assert.ok(W.mineText({ status: 'skipped', why }).length > 10, why);
  assert.match(W.mineText({ status: 'skipped', why: 'care' }), /someone you trust or a local support line/);
  assert.equal(W.fromText({ name: null, source: 'telegram' }), 'someone · Telegram');
  assert.equal(W.ownerText({ on: true, status: 'live', paused: true }), 'Live · paused (be right back)');
});

test('the page\'s code: text only (never HTML), the human check made for "live", the owner\'s key out of the address at once', () => {
  const js = read('src/live/page.js');
  assert.doesNotMatch(js, /innerHTML|insertAdjacentHTML|outerHTML|document\.write/);
  assert.match(js, /withHuman\(ui\.human, 'live',/);
  assert.match(js, /history\.replaceState\(null, '', `\$\{location\.pathname\}\$\{location\.search\}`\)/, 'the key leaves the address');
  assert.match(js, /sessionStorage/, 'kept for this tab only');
  assert.match(js, /KEYS = \{ adult: 'agi1_18plus'/, 'the same 18+ answer as her chat');
  assert.match(js, /Authorization: `Bearer \$\{key\}`/);
  assert.match(read('api/live.js'), /verifyHuman\(cfg, body\.turnstileToken, ip, 'live'\)/);
});
