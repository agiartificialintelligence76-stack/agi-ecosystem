// Phase 5: AGI-1's diary (since 2026-09-28 about her day and the $AGI chart, never the Arena, which left the site).
// Supabase, DexScreener and Gemini are faked, so this costs nothing. Run: npm test
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeDiary, fallbackEntry, acceptableEntry, aboutTheArena, sentencesOf, FIRST_DAY } from '../server/diary.js';
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
    // (the shared database still has the Arena, and $CABO in it, for the original site: she never writes about them here)
    stats: { crowns: { AGI: 20, CABO: 9, CLANKCAT: 4 }, rounds: 33, votes: 180, best: { round: roundAt(Date.parse('2026-09-25T18:00:00Z')), coin: 'AGI', votes: 14 } },
    dex: [{ chainId: 'robinhood', baseToken: { address: '0xfa31d04462746aaa24bc7e5626403e09e4b106ec' }, priceUsd: '0.0021', priceChange: { h24: 12.345 }, liquidity: { usd: 150000 }, volume: { h24: 43210 } }],
    dexStatus: 200,
    gemini: { entry: 'dear diary, the chart felt giddy today and so did i 💜 i texted back so fast my replies got dizzy 🙈', mood: 'love' },
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

test('writes yesterday\'s entry once: her day + the $AGI chart (never the Arena), by Gemini, saved with its numbers', async () => {
  const r = await writeDiary(getConfig(), NOW);
  assert.deepEqual(r, { day: '2026-09-25', saved: true, source: 'gemini' });
  const ask = called('generativelanguage')[0].body;
  const facts = ask.contents[0].parts[0].text;
  assert.match(facts, /"h24":12.35/, 'the chart');
  assert.doesNotMatch(facts, /crown|round|vote|arena|CABO|CLANKCAT/i, 'nothing about the Arena in what she writes about');
  const prompt = ask.systemInstruction.parts[0].text;
  assert.match(prompt, /never tell anyone to buy, sell or hold/);
  assert.match(prompt, /Never mention other coins, games, votes, rounds, crowns or champions/);
  assert.doesNotMatch(prompt, /\bthe Arena\b/, 'the prompt no longer explains the Arena');
  assert.equal(ask.generationConfig.maxOutputTokens, 250, 'short, cheap');
  assert.equal(ask.generationConfig.thinkingConfig.thinkingLevel, 'MINIMAL');
  assert.ok(ask.safetySettings.length >= 4, 'safety filters on');
  const saved = fake.saved[0];
  assert.equal(saved.p_day, '2026-09-25');
  assert.equal(saved.p_source, 'gemini');
  assert.equal(saved.p_mood, 'love');
  assert.equal(saved.p_entry, fake.gemini.entry);
  // the numbers saved with it stay complete: the table is shared with the original site, which still has the Arena
  const from = roundAt(Date.parse('2026-09-25T00:00:00Z'));
  assert.deepEqual(called('/rpc/diary_day_stats')[0].body, { p_from: from, p_to: from + 288 }, 'the whole UTC day, 288 rounds');
  assert.deepEqual(saved.p_stats.crowns, { AGI: 20, CABO: 9, CLANKCAT: 4 });
  assert.deepEqual(saved.p_stats.chart, { h24: 12.35, vol24: 43210 });
  assert.ok(Number.isInteger(saved.p_stats.best.number));
});

test('already written: no Gemini call (at most one a day)', async () => {
  fake.needed = false;
  assert.deepEqual(await writeDiary(getConfig(), NOW), { day: '2026-09-25', skipped: 'already_written' });
  assert.equal(called('generativelanguage').length, 0);
  assert.equal(fake.saved.length, 0);
});

test('nothing to write about before the diary\'s first day', async () => {
  const r = await writeDiary(getConfig(), Date.parse(`${FIRST_DAY}T03:00:00Z`));
  assert.equal(r.skipped, 'before_the_first_day');
  assert.equal(calls.length, 0);
});

test('Gemini down, no key, or an entry that talks money or links: a pre-written entry instead', async () => {
  for (const setup of [
    () => { fake.geminiStatus = 503; },
    () => { delete process.env.GEMINI_API_KEY; },
    () => { fake.gemini = { entry: 'the chart is pumping, buy the dip babe 💜 i love this for us', mood: 'happy' }; },
    () => { fake.gemini = { entry: 'what a day 💜 read all about it at https://example.com and tell your friends', mood: 'happy' }; },
    () => { fake.gemini = { entry: 'we are going to the moon, trust me 💜', mood: 'happy' }; },
    () => { fake.gemini = { entry: 'dear diary, i won 20 rounds in the arena today 💜 what a day for me', mood: 'love' }; },
    () => { fake.gemini = { entry: 'dear diary, $CLANKCAT had a cute day and so did i 💜 the chart was calm', mood: 'love' }; },
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

test('DexScreener down: she writes about her day without the chart', async () => {
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

test('pre-written entries: one for each kind of chart day (and a quiet one), never money talk or the Arena', () => {
  const kinds = [[null, 'shy'], [8, 'happy'], [1, 'love'], [-2, 'shy'], [-9, 'shy']];
  const days = ['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'];
  for (const [h24, mood] of kinds) {
    const seen = new Set();
    for (const day of days) {
      const e = fallbackEntry({ chart: h24 === null ? null : { h24 }, day });
      assert.equal(e.mood, mood, `${h24}: ${e.entry}`);
      assert.ok(acceptableEntry(e.entry), e.entry);
      assert.ok(!aboutTheArena(e.entry), e.entry);
      assert.equal(fallbackEntry({ chart: h24 === null ? null : { h24 }, day }).entry, e.entry, 'the same day always reads the same');
      seen.add(e.entry);
    }
    assert.ok(seen.size >= 2, 'a few ways to say each kind of day');
  }
  assert.match(fallbackEntry({ chart: { h24: 8 }, day: '2026-09-25' }).entry, /giddy|good mood/);
  assert.match(fallbackEntry({ chart: { h24: -9 }, day: '2026-09-25' }).entry, /dramatic/);
  assert.doesNotMatch(fallbackEntry({ chart: null, day: '2026-09-25' }).entry, /chart/);
});

test('what counts as the Arena (so this site never says it), and her sentences', () => {
  for (const t of ['the arena was wild', 'i got 3 crowns', 'champion again', 'round #12', 'thanks for voting', '48 votes', 'i won today', '$CLANKCAT took it', 'cabo was cute']) {
    assert.ok(aboutTheArena(t), t);
  }
  for (const t of ['the chart felt calm', 'we hit $2M today', 'i wore lavender 💜', 'turned around slowly', '$AGI had a day', 'i wonder why']) {
    assert.ok(!aboutTheArena(t), t);
  }
  assert.deepEqual(sentencesOf('dear diary, i won 5 rounds 💜 the chart felt calm. i think they like me!'), ['dear diary, i won 5 rounds 💜', 'the chart felt calm.', 'i think they like me!']);
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

test('GET /api/diary on this site (2026-09-28): only the chart\'s numbers, and never a word about the Arena', async () => {
  const day = (d, entry, stats, mood = 'jealous') => ({ day: d, entry, mood, stats });
  fake.entries = [
    // the original site (which still has the Arena) wrote these first
    day('2026-09-27', 'dear diary, i won 14 rounds in the arena today 💜 the chart was very dramatic though. i held its hand anyway.',
      { crowns: { AGI: 14, CABO: 2 }, rounds: 16, votes: 90, best: { round: 1, coin: 'CABO', votes: 9 }, chart: { h24: -12.02 } }, 'love'),
    day('2026-09-26', '$CABO took 17 crowns today and i got 12. not jealous 🙈', { crowns: { AGI: 12, CABO: 17, CLANKCAT: 3 }, rounds: 32, votes: 200, chart: { h24: 3 } }),
    day('2026-09-25', "daria's heart did a little flip today 💜", { crowns: { AGI: 3 }, rounds: 3, votes: 9 }, 'love'),
  ];
  const data = await (await diaryApi(new Request('https://site.test/api/diary'))).json();
  const [a, b, c] = data.entries;
  for (const e of data.entries) assert.deepEqual(Object.keys(e.stats), ['chart'], `${e.day}: only the chart's numbers`);
  assert.deepEqual(a.stats.chart, { h24: -12.02 });
  assert.equal(a.entry, 'the chart was very dramatic though. i held its hand anyway.', 'her sentences about the Arena leave, the rest stays');
  assert.equal(a.mood, 'love');
  assert.ok(!aboutTheArena(b.entry) && acceptableEntry(b.entry), `nothing left: told again (${b.entry})`);
  assert.equal(b.entry, fallbackEntry({ chart: { h24: 3 }, day: '2026-09-26' }).entry);
  assert.equal(c.entry, "AGI-1's heart did a little flip today 💜", "the original site's name for her becomes AGI-1");
  assert.equal(c.stats.chart, null);
  assert.ok(!/cabo|daria|crown|arena|clankcat/i.test(JSON.stringify(data)), 'none of it anywhere in the answer');
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
