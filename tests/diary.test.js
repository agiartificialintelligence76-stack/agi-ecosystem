// Phase 5: AGI-1's diary. Supabase, DexScreener and Gemini are faked, so this costs nothing. Run: npm test
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeDiary, fallbackEntry, acceptableEntry, FIRST_DAY } from '../server/diary.js';
import { GET as diaryApi } from '../api/diary.js';
import { GET as keepalive } from '../api/keepalive.js';
import { getConfig } from '../server/config.js';
import { roundAt } from '../server/arena.js';

const ENV = { GEMINI_API_KEY: 'fake-gemini-key', SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fake_key_123', CRON_SECRET: 'test-cron-secret-0123456789abcdef' };
const NOW = Date.parse('2026-09-26T03:07:00Z');          // the 03:00 run on Sep 26 writes the entry for Sep 25
const { error: realError, log: realLog } = console;
let calls, fake, logs;
afterEach(() => { console.error = realError; console.log = realLog; });
beforeEach(() => {
  Object.assign(process.env, ENV);
  calls = [];
  logs = [];
  console.error = (...a) => logs.push(a.join(' '));
  console.log = (...a) => logs.push(a.join(' '));
  fake = {
    needed: true, dbStatus: 200, dbCode: '', saved: [],
    stats: { crowns: { AGI: 20, CABO: 9, CLANKCAT: 4 }, rounds: 33, votes: 180, best: { round: roundAt(Date.parse('2026-09-25T18:00:00Z')), coin: 'AGI', votes: 14 } },
    dex: [{ chainId: 'robinhood', baseToken: { address: '0xfa31d04462746aaa24bc7e5626403e09e4b106ec' }, priceUsd: '0.0021', priceChange: { h24: 12.345 }, liquidity: { usd: 150000 }, volume: { h24: 43210 } }],
    dexStatus: 200,
    gemini: { entry: 'dear diary, i won twenty rounds today 💜 the chart felt giddy and so did i. $CABO tried, bless him 🙈', mood: 'love' },
    geminiStatus: 200,
    entries: [{ day: '2026-09-25', entry: 'hi diary', mood: 'love', stats: {} }],
  };
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, body, headers: init.headers });
    if (url.includes('/rest/v1/')) {
      if (fake.dbStatus !== 200) return Response.json({ code: fake.dbCode }, { status: fake.dbStatus });
      if (url.endsWith('/rpc/diary_needed')) return Response.json(fake.needed);
      if (url.endsWith('/rpc/arena_state')) return Response.json({ tally: {}, recent: [], crowns: {} });
      if (url.endsWith('/rpc/diary_day_stats')) return Response.json(fake.stats);
      if (url.endsWith('/rpc/diary_save')) { fake.saved.push(body); return Response.json(true); }
      if (url.endsWith('/rpc/diary_list')) return Response.json(fake.entries);
      if (url.includes('/chat_usage')) return Response.json([]);
    }
    if (url.startsWith('https://api.dexscreener.com/')) return fake.dexStatus === 200 ? Response.json(fake.dex) : new Response('busy', { status: fake.dexStatus });
    if (url.startsWith('https://generativelanguage.googleapis.com/')) {
      if (fake.geminiStatus !== 200) return Response.json({ error: { status: 'UNAVAILABLE', message: 'overloaded' } }, { status: fake.geminiStatus });
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(fake.gemini) }] } }] });
    }
    throw new Error('unexpected request to ' + url);
  };
});
const called = (part) => calls.filter((c) => c.url.includes(part));

test('writes yesterday\'s entry once: the Arena\'s day + the $AGI chart, by Gemini, saved with its numbers', async () => {
  const r = await writeDiary(getConfig(), NOW);
  assert.deepEqual(r, { day: '2026-09-25', saved: true, source: 'gemini' });
  const from = roundAt(Date.parse('2026-09-25T00:00:00Z'));
  assert.deepEqual(called('/rpc/diary_day_stats')[0].body, { p_from: from, p_to: from + 288 }, 'the whole UTC day, 288 rounds');
  assert.ok(calls.findIndex((c) => c.url.endsWith('/rpc/arena_state')) < calls.findIndex((c) => c.url.endsWith('/rpc/diary_day_stats')), 'crowns the last rounds first');
  const ask = called('generativelanguage')[0].body;
  const facts = ask.contents[0].parts[0].text;
  assert.match(facts, /"crowns":\{"AGI":20,"CABO":9,"CLANKCAT":4\}/);
  assert.match(facts, /"h24":12.35/);
  assert.match(ask.systemInstruction.parts[0].text, /never tell anyone to buy, sell or hold/);
  assert.equal(ask.generationConfig.maxOutputTokens, 250, 'short, cheap');
  assert.equal(ask.generationConfig.thinkingConfig.thinkingLevel, 'MINIMAL');
  assert.ok(ask.safetySettings.length >= 4, 'safety filters on');
  const saved = fake.saved[0];
  assert.equal(saved.p_day, '2026-09-25');
  assert.equal(saved.p_source, 'gemini');
  assert.equal(saved.p_mood, 'love');
  assert.deepEqual(saved.p_stats.crowns, { AGI: 20, CABO: 9, CLANKCAT: 4 });
  assert.deepEqual(saved.p_stats.chart, { h24: 12.35, vol24: 43210 });
  assert.equal(saved.p_stats.best.coin, 'AGI');
  assert.ok(Number.isInteger(saved.p_stats.best.number));
});

test('already written: no Gemini call (at most one a day)', async () => {
  fake.needed = false;
  assert.deepEqual(await writeDiary(getConfig(), NOW), { day: '2026-09-25', skipped: 'already_written' });
  assert.equal(called('generativelanguage').length, 0);
  assert.equal(fake.saved.length, 0);
});

test('nothing to write about before the Arena opened', async () => {
  const r = await writeDiary(getConfig(), Date.parse(`${FIRST_DAY}T03:00:00Z`));
  assert.equal(r.skipped, 'before_the_arena');
  assert.equal(calls.length, 0);
});

test('Gemini down, no key, or an entry that talks money or links: a pre-written entry instead', async () => {
  for (const setup of [
    () => { fake.geminiStatus = 503; },
    () => { delete process.env.GEMINI_API_KEY; },
    () => { fake.gemini = { entry: 'the chart is pumping, buy the dip babe 💜 i love this for us', mood: 'happy' }; },
    () => { fake.gemini = { entry: 'what a day 💜 read all about it at https://example.com and tell your friends', mood: 'happy' }; },
    () => { fake.gemini = { entry: 'we are going to the moon, trust me 💜', mood: 'happy' }; },
  ]) {
    Object.assign(process.env, ENV);
    fake.saved = [];
    fake.geminiStatus = 200;
    setup();
    const r = await writeDiary(getConfig(), NOW);
    assert.equal(r.source, 'fallback');
    assert.equal(fake.saved[0].p_source, 'fallback');
    assert.ok(acceptableEntry(fake.saved[0].p_entry), fake.saved[0].p_entry);
  }
});

test('DexScreener down: she writes about the Arena only', async () => {
  fake.dexStatus = 500;
  const r = await writeDiary(getConfig(), NOW);
  assert.equal(r.saved, true);
  assert.equal(fake.saved[0].p_stats.chart, null);
  assert.match(called('generativelanguage')[0].body.contents[0].parts[0].text, /"chart":null/);
});

test('diary.sql not run yet: nothing written, a clear log line, no Gemini call', async () => {
  fake.dbStatus = 404; fake.dbCode = 'PGRST202';
  const r = await writeDiary(getConfig(), NOW);
  assert.equal(r.error, 'not_ready');
  assert.equal(called('generativelanguage').length, 0);
  assert.match(logs.join('\n'), /run supabase\/diary.sql/);
});

test('pre-written entries: proud, jealous or shy, and never money talk', () => {
  const agi = fallbackEntry({ arena: { crowns: { AGI: 7, CABO: 2 }, rounds: 9, votes: 40 }, chart: { h24: 8 } });
  assert.equal(agi.mood, 'love');
  assert.match(agi.entry, /i won 7 rounds/);
  assert.match(agi.entry, /giddy/);
  const cabo = fallbackEntry({ arena: { crowns: { AGI: 2, CABO: 5 }, rounds: 7, votes: 30 }, chart: { h24: -9 } });
  assert.equal(cabo.mood, 'jealous');
  assert.match(cabo.entry, /\$CABO took 5 crowns today and i got 2/);
  assert.match(cabo.entry, /very dramatic/);
  const quiet = fallbackEntry({ arena: { crowns: {}, rounds: 0, votes: 0 }, chart: null });
  assert.equal(quiet.mood, 'shy');
  assert.doesNotMatch(quiet.entry, /chart/);
  const tie = fallbackEntry({ arena: { crowns: { CABO: 3, AGI: 3 }, rounds: 6, votes: 12 }, chart: null });
  assert.equal(tie.mood, 'love', 'a tie counts for $AGI');
  for (const e of [agi, cabo, quiet, tie]) assert.ok(acceptableEntry(e.entry), e.entry);
});

test('the money-talk filter', () => {
  for (const bad of ['buy now', 'we are pumping', 'wen moon', 'take profits', 'hodl forever', 'a 10x day', 'see http://x.io', 'www.site.com']) {
    assert.ok(!acceptableEntry(`dear diary, ${bad} 💜 what a day it was`), bad);
  }
  assert.ok(acceptableEntry('dear diary, the chart was calm today 💜 not financial advice, just feelings'));
});

test('GET /api/diary: newest entries, cached 10 minutes; older pages cached an hour; checked input', async () => {
  const realNow = Date.now;
  Date.now = () => NOW;
  try {
  const res = await diaryApi(new Request('https://site.test/api/diary'));
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.entries[0].entry, 'hi diary');
  assert.match(res.headers.get('cache-control'), /s-maxage=600/);
  const listCall = called('/rpc/diary_list')[0].body;
  assert.equal(listCall.p_limit, 14);
  const older = await diaryApi(new Request('https://site.test/api/diary?before=2026-09-26&limit=5'));
  assert.equal(older.status, 200);
  assert.match(older.headers.get('cache-control'), /s-maxage=3600/);
  assert.deepEqual(called('/rpc/diary_list')[1].body, { p_before: '2026-09-26', p_limit: 5 });
  for (const q of ['?before=yesterday', '?before=2026-02-31', '?before=2025-12-31', '?before=2099-01-01', '?limit=0', '?limit=100', '?limit=2.5']) {
    const r = await diaryApi(new Request(`https://site.test/api/diary${q}`));
    assert.equal(r.status, 400, q);
    assert.equal(r.headers.get('cache-control'), 'no-store');
  }
  } finally { Date.now = realNow; }
});

test('GET /api/diary before diary.sql is run: "not_ready", never cached', async () => {
  fake.dbStatus = 404; fake.dbCode = 'PGRST202';
  const res = await diaryApi(new Request('https://site.test/api/diary'));
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, 'not_ready');
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('the nightly keep-alive writes the diary, and a diary problem never fails the keep-alive', async () => {
  const realNow = Date.now;
  Date.now = () => NOW;
  try {
    const run = () => keepalive(new Request('https://site.test/api/keepalive', { headers: { authorization: `Bearer ${ENV.CRON_SECRET}` } }));
    let res = await run();
    assert.equal(res.status, 200);
    let body = await res.json();
    assert.equal(body.ok, true);
    assert.deepEqual(body.diary, { day: '2026-09-25', saved: true, source: 'gemini' });
    fake.needed = false;
    body = await (await run()).json();
    assert.equal(body.diary.skipped, 'already_written', 'the next runs only check');
    assert.equal(called('generativelanguage').length, 1, 'one Gemini call in total');
    // the diary's functions missing: the keep-alive still succeeds
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => (String(url).includes('/rpc/diary_') ? Response.json({ code: 'PGRST202' }, { status: 404 }) : originalFetch(url, init));
    res = await run();
    assert.equal(res.status, 200);
    assert.equal((await res.json()).diary.error, 'not_ready');
  } finally { Date.now = realNow; }
});
