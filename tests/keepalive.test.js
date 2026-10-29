// Tests for /api/keepalive (the daily Supabase "keep-alive"). Supabase is faked. Run: npm test
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { GET } from '../api/keepalive.js';

const CRON_SECRET = 'test-cron-secret-0123456789abcdef';
const { error: realError, log: realLog } = console;
let calls, supabaseStatus, logs;
afterEach(() => { console.error = realError; console.log = realLog; });

beforeEach(() => {
  Object.assign(process.env, { CRON_SECRET, SUPABASE_URL: 'https://fake.supabase.co/', SUPABASE_SECRET_KEY: 'sb_secret_fake_key_123' });
  calls = [];
  supabaseStatus = 200;
  logs = [];
  console.error = (...a) => logs.push(a.join(' '));
  console.log = () => {};
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), headers: init.headers });
    return supabaseStatus === 200 ? Response.json([]) : new Response('Project paused', { status: supabaseStatus });
  };
});

const run = (auth) => GET(new Request('https://site.test/api/keepalive', { headers: auth ? { authorization: auth } : {} }));

test('reads the database when Vercel calls with the right secret', async () => {
  const res = await run(`Bearer ${CRON_SECRET}`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).ok, true);          // (it also checks AGI-1's diary: tests/diary.test.js)
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(calls[0].url, 'https://fake.supabase.co/rest/v1/chat_usage?select=day&limit=1');
  assert.equal(calls[0].headers.apikey, 'sb_secret_fake_key_123');
  assert.equal(calls[0].headers.Authorization, undefined, 'the secret key is not a JWT: apikey header only');
});

test('anyone else is turned away before the database is touched', async () => {
  for (const auth of [null, 'Bearer wrong', CRON_SECRET, `Bearer ${CRON_SECRET}x`, `bearer ${CRON_SECRET}`]) {
    assert.equal((await run(auth)).status, 401, `auth: ${auth}`);
  }
  assert.equal(calls.length, 0);
});

test('does nothing until CRON_SECRET is set (at least 16 characters)', async () => {
  delete process.env.CRON_SECRET;
  assert.equal((await run('Bearer ')).status, 503);
  process.env.CRON_SECRET = 'short';
  assert.equal((await run('Bearer short')).status, 503);
  assert.equal(calls.length, 0);
  assert.match(logs.join('\n'), /CRON_SECRET is missing/);
});

test('a database problem is logged with the fix', async () => {
  supabaseStatus = 540;
  const res = await run(`Bearer ${CRON_SECRET}`);
  assert.equal(res.status, 502);
  assert.match(logs.join('\n'), /HTTP 540 \(the project is already paused.*Resume project\)/);
  assert.ok(!logs.join('\n').includes('sb_secret_fake_key_123'), 'the key never appears in logs');
});

test('the Vercel schedule: each job once a day but her Discord roles clock, and real functions', async () => {
  const { crons } = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.ok(crons.filter((c) => c.path === '/api/keepalive').length >= 2, 'a few reads a day, in case one run is skipped');
  assert.ok(crons.length <= 100, 'Vercel allows 100 cron jobs a project');
  // (2026-10-29, round 4) the one job more often than daily: /api/feed every 5 minutes for her Discord server's 👤 Stranger
  // role (api/feed.js tells it apart by its schedule). It needs Vercel Pro (the owner's plan since 2026-10-25): on Hobby a
  // deploy with it fails, so it must be the only one
  const { ROLES_SCHEDULE } = await import('../api/feed.js');
  assert.equal(ROLES_SCHEDULE, '*/5 * * * *');
  assert.deepEqual(crons.filter((c) => c.schedule === ROLES_SCHEDULE).map((c) => c.path), ['/api/feed']);
  for (const { path, schedule } of crons.filter((c) => c.schedule !== ROLES_SCHEDULE)) {
    assert.ok(['/api/keepalive', '/api/feed'].includes(path), path);        // (her Telegram feed since 2026-09-29)
    assert.ok(existsSync(new URL(`..${path}.js`, import.meta.url)));
    const [minute, hour, ...rest] = schedule.split(' ');
    assert.match(minute, /^\d+$/, `${schedule}: a fixed minute`);
    assert.match(hour, /^\d+$/, `${schedule}: a fixed hour (Hobby allows one run per day per job)`);
    assert.deepEqual(rest, ['*', '*', '*']);
  }
});
