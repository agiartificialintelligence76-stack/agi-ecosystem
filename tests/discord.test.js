// AGI-1 on Discord (2026-10-28, server/discord.js): her endpoint (Discord's own signature), her commands (/ask, /ca, /mc,
// /website, /music, /help), her songs' buttons, connecting her app (her endpoint, her commands), her posts in her channel.
// Discord, Supabase, DexScreener, Gemini and the site's songs are fakes: no keys, no cost. Run: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { generateKeyPairSync, sign } from 'node:crypto';
import { POST as webhook, GET as webhookGet } from '../api/telegram.js';
import * as DC from '../server/discord.js';
import * as D from '../server/dc-lines.js';
import * as TK from '../server/dc-tickets.js';
import { getConfig, discordGuilds, discordKey, discordWebhook } from '../server/config.js';
import { forgetMarket } from '../server/market.js';
import { tgLinesFor, GROUP_CA, GROUP_WEBSITE, GROUP_FULL, GROUP_OUT, GROUP_MARKET_DOWN, GROUP_LIVE, groupMarket } from '../server/tg-lines.js';
import { SONGS, songCaption, TOAST, SEND_FAILED, MUSIC_MENU, MUSIC_V } from '../server/tg-music.js';
import { SECRET_WARNING } from '../server/secrets.js';
import { discordPrompt } from '../server/agi1-prompt.js';

const E = tgLinesFor('en');
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const PUBLIC = publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('hex');
const other = generateKeyPairSync('ed25519').privateKey;
const SECRET = 'test-pass-secret-that-is-long-enough-1234';
const GUILD = '1563093500021710850', OTHER_GUILD = '1111111111111111111', APP = '1565016537683984464';
const PERSON = '987654321098765432';
const IT_TOKEN = 'aW50ZXJhY3Rpb246MTU2NTAxNjUzNzY4Mzk4NDQ2NDp0ZXN0LXRva2Vu';
const BOT = `${Buffer.from(APP).toString('base64url')}.GxAbCd.${'x'.repeat(38)}`;
const HOOK = `https://discord.com/api/webhooks/1565999999999999999/${'w'.repeat(68)}`;
const OFFICIAL = '0xfa31d04462746aaa24bc7e5626403e09e4b106ec';
const ENV = {
  GEMINI_API_KEY: 'fake-gemini-key', SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fake_key_123',
  PASS_SECRET: SECRET, VERCEL_PROJECT_PRODUCTION_URL: 'agi1.app', DISCORD_PUBLIC_KEY: PUBLIC, DISCORD_GUILDS: GUILD,
};
// (the settings Vercel's build has, which these tests take as unset: their defaults are what's checked)
const CLEAR = ['SITE_URL', 'GEMINI_MODEL', 'CHAT_DAILY_CAP', 'TELEGRAM_DAILY_CAP', 'TELEGRAM_GROUP_DAILY_CAP', 'TELEGRAM_MUSIC', 'TELEGRAM_BOT_TOKEN',
  'DISCORD_GUILDS', 'DISCORD_PUBLIC_KEY', 'DISCORD_BOT_TOKEN', 'DISCORD_FEED_WEBHOOK', 'DISCORD_POSTS', 'DISCORD_GUILD_DAILY_CAP'];
const T0 = Date.UTC(2026, 9, 28, 12, 0, 0);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mp3 = (n) => { const b = new Uint8Array(n); b.set([0x49, 0x44, 0x33]); return b; };
const png = (n) => { const b = new Uint8Array(n); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); return b; };
const agiPair = () => ({ chainId: 'robinhood', dexId: 'uniswap', baseToken: { address: OFFICIAL, symbol: 'AGI' }, priceUsd: '0.001',
  liquidity: { usd: 50_000 }, priceChange: { h24: -3.5 }, marketCap: 1_150_000, fdv: 1_150_000 });

// ---------- fakes ----------
let fake, calls, logs;
// (2026-10-29) Discord's gateway, for her bot's one connection: hello, then READY for her token (4004 for any other)
class FakeGateway {
  static made = [];
  constructor(url) {
    this.url = url;
    this.sent = [];
    FakeGateway.made.push(this);
    setTimeout(() => this.onmessage?.({ data: JSON.stringify({ op: 10, d: { heartbeat_interval: 41250 } }) }), 1);
  }
  send(raw) {
    const m = JSON.parse(raw);
    this.sent.push(m);
    if (m.op !== 2) return;
    setTimeout(() => {
      if (m.d?.token === BOT && !fake.gatewayDown) {
        fake.identified = true;
        this.onmessage?.({ data: JSON.stringify({ op: 0, t: 'READY', s: 1, d: { v: 10 } }) });
      } else this.onclose?.({ code: 4004 });
    }, 1);
  }
  close(code) { this.closedWith = code; }
}
beforeEach(() => {
  for (const k of CLEAR) delete process.env[k];
  Object.assign(process.env, ENV);
  DC.forgetDiscord();
  TK.forgetTickets();
  FakeGateway.made = [];
  globalThis.WebSocket = FakeGateway;
  forgetMarket();
  logs = [];
  console.error = (...a) => logs.push(['error', a.join(' ')]);
  console.warn = (...a) => logs.push(['warn', a.join(' ')]);
  console.log = (...a) => logs.push(['log', a.join(' ')]);
  calls = [];
  fake = {
    limit: 'ok', group: 'ok', apps: true, dbDown: false, groupSqlMissing: false, dbDelay: 0,
    gemini: { reply: "hi! i'm doing great 💜 what's up?", mood: 'happy' }, geminiStatus: 200,
    dex: [agiPair()], dexDown: false, dexDelay: 0,
    app: { id: APP, verify_key: PUBLIC, description: '', interactions_endpoint_url: null }, appStatus: 200, commands: new Map(), forbidden: new Set(),
    endpointRefused: false, hookStatus: 200, uploadStatus: 200, song: { status: 200, bytes: mp3(50_000) },
    // (2026-10-29) her tickets and /post: the server's channels, what her bot posted, whether it ever connected
    channels: [], posted: [], identified: false, gatewayDown: false, noAccess: new Set(), createStatus: 200, image: png(4000),
  };
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    const method = init.method || 'GET';
    if (url.startsWith('https://fake.supabase.co/rest/v1/rpc/')) {
      const fn = url.split('/').pop();
      const body = JSON.parse(init.body);
      calls.push({ to: 'db', fn, body });
      if (fake.dbDelay) await sleep(fake.dbDelay);
      if (fake.dbDown) return new Response('down', { status: 503 });
      if (fn === 'chat_take') return Response.json(fake.limit);
      if (fn === 'tg_group_take') return fake.groupSqlMissing ? Response.json({ code: 'PGRST202', message: 'not found' }, { status: 404 }) : Response.json(fake.group);
      if (fn === 'tg_take') return Response.json(fake.apps);
      throw new Error(`unexpected database function ${fn}`);
    }
    if (url.startsWith('https://generativelanguage.googleapis.com/')) {
      calls.push({ to: 'gemini', body: JSON.parse(init.body) });
      if (fake.geminiStatus !== 200) return new Response('error', { status: fake.geminiStatus });
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(fake.gemini) }] } }] });
    }
    if (url.startsWith('https://api.dexscreener.com/')) {
      calls.push({ to: 'dex', url });
      if (fake.dexDelay) await sleep(fake.dexDelay);
      return fake.dexDown ? new Response('busy', { status: 503 }) : Response.json(fake.dex);
    }
    if (url.startsWith('https://agi1.app/music/') || url.startsWith('https://www.agi1.app/music/')) {
      calls.push({ to: 'site', url });
      return fake.song.status === 200 ? new Response(fake.song.bytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } }) : new Response('nope', { status: fake.song.status });
    }
    if (url.startsWith('https://cdn.discordapp.com/attachments/') || url.startsWith('https://cdn.discordapp.com/ephemeral-attachments/')) {
      calls.push({ to: 'cdn', url });
      return new Response(fake.image, { status: 200, headers: { 'content-type': 'image/png' } });
    }
    if (url.startsWith('https://discord.com/api/webhooks/')) {
      const body = JSON.parse(init.body);
      calls.push({ to: 'hook', url, method, body, headers: init.headers });
      return fake.hookStatus === 200 ? Response.json({ id: '77' }) : Response.json({ message: 'Unknown Webhook', code: 10015 }, { status: fake.hookStatus });
    }
    if (url.startsWith('https://discord.com/api/v10/')) {
      const path = url.slice('https://discord.com/api/v10'.length);
      const form = init.body instanceof FormData ? init.body : null;
      const body = form ? JSON.parse(form.get('payload_json')) : init.body ? JSON.parse(init.body) : null;
      const file = form ? form.get('files[0]') : null;
      calls.push({ to: 'discord', method, path, body, file, headers: init.headers });
      if (path.startsWith(`/webhooks/${APP}/${IT_TOKEN}`)) {
        if (method === 'DELETE') return new Response(null, { status: 204 });
        if (form && fake.uploadStatus !== 200) return Response.json({ message: 'Request entity too large', code: 40005 }, { status: fake.uploadStatus });
        return Response.json({ id: '88' });
      }
      if (init.headers?.Authorization !== `Bot ${BOT}` || fake.appStatus === 401) return Response.json({ message: '401: Unauthorized', code: 0 }, { status: 401 });
      if (path === '/applications/@me' && method === 'GET') return Response.json(fake.app);
      if (path === '/applications/@me' && method === 'PATCH') {
        if (body.interactions_endpoint_url && fake.endpointRefused) {
          return Response.json({ message: 'Invalid Form Body', code: 50035, errors: { interactions_endpoint_url: { _errors: [{ code: 'APPLICATION_INTERACTIONS_ENDPOINT_URL_INVALID', message: 'The specified interactions endpoint url could not be verified.' }] } } }, { status: 400 });
        }
        Object.assign(fake.app, body);
        return Response.json(fake.app);
      }
      const m = /^\/applications\/(\d+)\/guilds\/(\d+)\/commands$/.exec(path);
      if (m) {
        if (fake.forbidden.has(m[2])) return Response.json({ message: 'Missing Access', code: 50001 }, { status: 403 });
        if (method === 'GET') return Response.json(fake.commands.get(m[2]) ?? []);
        if (method === 'PUT') { fake.commands.set(m[2], body.map((c, i) => ({ id: String(i + 1), application_id: APP, version: '1', guild_id: m[2], default_member_permissions: null, ...c }))); return Response.json(fake.commands.get(m[2])); }
      }
      // (2026-10-29) the server's channels, a channel, its messages
      if (path === `/guilds/${GUILD}/channels`) {
        if (method === 'GET') return Response.json(fake.channels);
        if (method === 'POST') {
          if (fake.createStatus !== 200) return Response.json({ message: 'Missing Permissions', code: 50013 }, { status: fake.createStatus });
          const made = { id: String(1565200000000000000n + BigInt(fake.channels.length)), guild_id: GUILD, ...body };
          fake.channels.push(made);
          return Response.json(made);
        }
      }
      const said = /^\/channels\/(\d+)\/messages$/.exec(path);
      if (said && method === 'POST') {
        if (!fake.identified) return Response.json({ message: 'Unauthorized', code: 40001 }, { status: 401 });
        if (fake.noAccess.has(said[1])) return Response.json({ message: 'Missing Access', code: 50001 }, { status: 403 });
        fake.posted.push({ channel: said[1], body, file });
        return Response.json({ id: '99', channel_id: said[1] });
      }
      const one = /^\/channels\/(\d+)$/.exec(path);
      if (one) {
        if (fake.noAccess.has(one[1])) return Response.json({ message: 'Missing Access', code: 50001 }, { status: 403 });
        const i = fake.channels.findIndex((c) => c.id === one[1]);
        if (i < 0) return Response.json({ message: 'Unknown Channel', code: 10003 }, { status: 404 });
        if (method === 'GET') return Response.json(fake.channels[i]);
        if (method === 'DELETE') return Response.json(fake.channels.splice(i, 1)[0]);
      }
      throw new Error(`unexpected Discord call ${method} ${path}`);
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
});
const to = (who) => calls.filter((c) => c.to === who);
const db = (fn) => calls.filter((c) => c.to === 'db' && c.fn === fn);
const discord = (method, rest = '') => calls.filter((c) => c.to === 'discord' && c.method === method && c.path.endsWith(rest));
const original = `/webhooks/${APP}/${IT_TOKEN}/messages/@original`;
const cfg = () => getConfig();

let seq = 0;
const interaction = (o = {}) => ({
  type: 2, id: String(1_500_000_000_000_000_000n + BigInt(++seq)), application_id: APP, token: IT_TOKEN, version: 1, guild_id: GUILD,
  channel_id: '1563093501523267697', locale: 'en-US', member: { user: { id: o.who ?? PERSON, username: 'someone' }, roles: [], permissions: '0' }, ...o,
});
const command = (name, options, o = {}) => interaction({ data: { id: '1', name, type: 1, ...(options ? { options } : {}) }, ...o });
const askCmd = (q, o) => command('ask', [{ name: 'question', type: 3, value: q }], o);
const tap = (customId, o = {}) => interaction({ type: 3, data: { custom_id: customId, component_type: 2 }, message: { id: '55' }, ...o });
const run = (it, o = {}) => DC.onInteraction(cfg(), it, { now: T0, started: Date.now(), ...o });
const person = (i) => String(900000000000000000n + BigInt(i));

const signed = (raw, ts = String(Math.floor(Date.now() / 1000)), key = privateKey) => ({ ts, sig: sign(null, Buffer.from(ts + raw), key).toString('hex') });
const post = (body, { ts, key, sig, url = 'https://agi1.app/api/telegram?discord', headers = {} } = {}) => {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  const s = signed(raw, ts, key);
  return webhook(new Request(url, {
    method: 'POST', body: raw,
    headers: { 'content-type': 'application/json', 'x-signature-ed25519': sig ?? s.sig, 'x-signature-timestamp': ts ?? s.ts, ...headers },
  }));
};
const waitFor = async (check, ms = 2000) => {
  for (const until = Date.now() + ms; Date.now() < until; await sleep(5)) if (check()) return true;
  return false;
};

// ---------- her endpoint ----------
test("her endpoint: only Discord's signature, only POST; a PING gets a PONG, the rest is refused", async () => {
  delete process.env.DISCORD_PUBLIC_KEY;
  assert.equal((await post({ type: 1 })).status, 503, 'no public key: not set up');
  process.env.DISCORD_PUBLIC_KEY = PUBLIC;
  const ping = { type: 1, id: '1', application_id: APP, token: IT_TOKEN, version: 1 };
  const raw = JSON.stringify(ping);
  const unsigned = await webhook(new Request('https://agi1.app/api/telegram?discord', { method: 'POST', body: raw }));
  assert.equal(unsigned.status, 401);
  assert.equal((await post(ping, { key: other })).status, 401, 'signed with another key');
  const good = signed(raw);
  assert.equal((await post(`${raw} `, { ts: good.ts, sig: good.sig })).status, 401, 'a body changed after signing');
  // (2026-10-29) 310 s ahead, not 301: a test that ran across a second's boundary could be under 300 s ahead by then and pass
  const old = String(Math.floor(Date.now() / 1000) - 301), soon = String(Math.floor(Date.now() / 1000) + 310);
  assert.equal((await post(ping, { ts: old })).status, 401, 'older than 5 minutes');
  assert.equal((await post(ping, { ts: soon })).status, 401, 'from the future');
  assert.equal((await post(ping, { ts: 'yesterday' })).status, 401);
  assert.equal((await post(ping, { sig: 'zz'.repeat(64) })).status, 401);
  const pong = await post(ping);
  assert.equal(pong.status, 200);
  assert.deepEqual(await pong.json(), { type: 1 });
  assert.match(pong.headers.get('content-type'), /application\/json/);
  assert.deepEqual(await (await post(ping, { url: 'https://agi1.app/api/telegram?discord=' })).json(), { type: 1 }, '?discord= as a rewrite may give it');
  assert.deepEqual(await (await post(ping, { url: 'https://www.agi1.app/discord/interactions?discord' })).json(), { type: 1 });
  assert.equal((await post('{not json')).status, 400);
  assert.equal((await post('null')).status, 400);
  assert.equal((await post('[1]')).status, 400);
  assert.equal((await post(JSON.stringify({ type: 1, pad: 'x'.repeat(70_000) }))).status, 413);
  assert.equal((await post(ping, { headers: { 'content-length': '999999' } })).status, 413);
  assert.equal((await webhookGet()).status, 405);
  assert.equal(calls.length, 0, 'nothing else happens');
  // her Telegram bot's path is as before: no ?discord, no Telegram token → not set up
  const tg = await webhook(new Request('https://agi1.app/api/telegram', { method: 'POST', body: '{}' }));
  assert.equal(tg.status, 503);
  // the signature itself
  assert.equal(DC.fromDiscord(PUBLIC, good.sig, good.ts, Buffer.from(raw)), true);
  assert.equal(DC.fromDiscord('ab', good.sig, good.ts, Buffer.from(raw)), false);
  assert.equal(DC.fromDiscord(PUBLIC, good.sig, good.ts, Buffer.from(raw), (Number(good.ts) + 301) * 1000), false);
});

test("only her servers: anywhere else (another server, her DMs) one line, only to them", async () => {
  const notHere = { type: 4, data: { content: D.NOT_HERE, allowed_mentions: { parse: [] }, flags: 64 | 4 } };
  assert.deepEqual((await run(command('ca', null, { guild_id: OTHER_GUILD }))).response, notHere);
  const dm = command('ca');
  delete dm.guild_id; delete dm.member; dm.user = { id: PERSON };
  assert.deepEqual((await run(dm)).response, notHere);
  assert.deepEqual((await run(command('ca', null, { token: 'x' }))).response, notHere, 'nothing to answer later with');
  assert.deepEqual((await run(command('ca', null, { member: { user: { id: 'me' } } }))).response, notHere);
  assert.deepEqual((await run({ type: 4, guild_id: GUILD })).response, { type: 8, data: { choices: [] } }, 'autocomplete: nothing to suggest');
  assert.deepEqual((await run({ ...command('ca'), type: 5 })).response, notHere, 'a modal: none of hers');
  delete process.env.DISCORD_GUILDS;
  assert.deepEqual((await run(command('ca'))).response, notHere, 'no server set: none');
  process.env.DISCORD_GUILDS = 'my-server';
  assert.deepEqual((await run(command('ca'))).response, notHere, 'a typo: none');
  process.env.DISCORD_GUILDS = `${OTHER_GUILD}, ${GUILD}`;
  assert.equal((await run(command('ca'))).response.data.content, DC.caLine());
  assert.equal(calls.length, 0);
  // through the endpoint, signed
  const r = await post(command('ca', null, { guild_id: '2222222222222222222' }));
  assert.deepEqual(await r.json(), notHere);
});

// ---------- /ca, /website, /help ----------
test('/ca, /website and /help: her group lines, public at most once every 30 s in a server, never a ping', async () => {
  const ca = (await run(command('ca'))).response;
  assert.deepEqual(ca, { type: 4, data: { content: DC.caLine(), allowed_mentions: { parse: [] }, flags: 4 } });
  assert.equal(DC.caLine(), GROUP_CA.replace(OFFICIAL, `\`${OFFICIAL}\``));
  assert.match(DC.caLine(), /`0xfa31d04462746aaa24bc7e5626403e09e4b106ec`/, 'the contract as code');
  const again = (await run(command('ca', null, { who: person(1) }), { now: T0 + 29_000 })).response;
  assert.equal(again.data.flags, 64 | 4, 'asked again within 30 s: only to whoever asked');
  assert.equal(again.data.content, DC.caLine());
  assert.equal((await run(command('ca', null, { who: person(2) }), { now: T0 + 31_000 })).response.data.flags, 4, 'public again after 30 s');
  assert.equal((await run(command('ca', null, { guild_id: OTHER_GUILD }))).response.data.content, D.NOT_HERE);
  const site = (await run(command('website', null, { who: person(3) }))).response;
  assert.deepEqual(site, { type: 4, data: { content: GROUP_WEBSITE, allowed_mentions: { parse: [] }, flags: 0 } }, 'its link preview allowed');
  const help = (await run(command('help', null, { who: person(4) }))).response.data;
  assert.equal(help.content, D.helpFor({ music: true }));
  assert.equal(help.flags, 4);
  for (const words of ['/ask', '/ca', '/mc', '/website', '/music', 'never DM anyone first', 'seed phrase', 'financial advice']) assert.ok(help.content.includes(words), words);
  process.env.TELEGRAM_MUSIC = 'off';
  const quiet = (await run(command('help', null, { who: person(5) }), { now: T0 + 40_000 })).response.data.content;
  assert.ok(!quiet.includes('/music'), 'no /music while her songs are off');
  assert.equal((await run(command('dance', null, { who: person(6) }))).response.data.flags, 64 | 4, 'a command she doesn\'t have: her help, only to them');
  assert.equal(calls.length, 0, 'no AI, no database');
});

// ---------- /mc ----------
test("/mc: $AGI's numbers at once, or in an edit when DexScreener is slow; never old or made-up numbers", async () => {
  const now = groupMarket({ mcap: 1_150_000, h24: -3.5, liq: 50_000 });
  const r = await run(command('mc'));
  assert.deepEqual(r.response, { type: 4, data: { content: now, allowed_mentions: { parse: [] }, flags: 4 } });
  assert.equal(r.after, undefined);
  forgetMarket();
  fake.dexDown = true;
  assert.equal((await run(command('mc', null, { who: person(1) }), { now: T0 + 31_000 })).response.data.content, GROUP_MARKET_DOWN);
  forgetMarket();
  fake.dexDown = false;
  fake.dexDelay = 120;
  const slow = await run(command('mc', null, { who: person(2) }), { now: T0 + 62_000, quickMs: 20 });
  assert.deepEqual(slow.response, { type: 5, data: { flags: 0 } }, '"thinking…" for everyone');
  assert.equal(await slow.after, 'mc_later');
  const [edit] = discord('PATCH', original);
  assert.deepEqual(edit.body, { content: now, allowed_mentions: { parse: [] }, flags: 4 });
  assert.equal(edit.headers['User-Agent'], 'DiscordBot (https://agi1.app, 1.0)');
  forgetMarket();
  const mine = await run(command('mc', null, { who: person(3) }), { now: T0 + 63_000, quickMs: 20 });
  assert.deepEqual(mine.response, { type: 5, data: { flags: 64 } }, 'asked again within 30 s: only to them');
  await mine.after;
});

// ---------- /ask ----------
test('/ask: the same AI as her Telegram groups, under their question; her limits checked first', async () => {
  const r = await run(askCmd('  how are you   today? '));
  assert.deepEqual(r.response, { type: 5, data: { flags: 0 } });
  assert.equal(await r.after, 'asked');
  const [take] = db('chat_take');
  assert.match(take.body.p_who, /^d:[A-Za-z0-9_-]{32}$/, 'a daily code of their account');
  assert.ok(!take.body.p_who.includes(PERSON) && !JSON.stringify(calls).includes(PERSON), 'never their id');
  assert.equal(take.body.p_person_daily, 5, "a Stranger's messages a day");
  assert.deepEqual(db('tg_group_take')[0].body, { p_chat: `-${GUILD}`, p_max: 100 }, "the server's day, its id as a negative number (as text: too big for a JS number)");
  assert.deepEqual(db('tg_take')[0].body, { p_max: 400 }, "her chat apps' share");
  const [g] = to('gemini');
  const system = g.body.systemInstruction.parts[0].text;
  assert.match(system, /WHERE YOU ARE: A PUBLIC DISCORD SERVER/);
  assert.match(system, /never romantic or flirty/);
  assert.match(system, /RELATIONSHIP LEVEL 1, STRANGER/);
  assert.doesNotMatch(system, /WHERE YOU ARE: TELEGRAM/);
  assert.equal(g.body.contents.at(-1).parts[0].text, 'how are you today?');
  assert.equal(g.body.contents.length, 1, 'no history, no memory of the clank.trade group');
  const [edit] = discord('PATCH', original);
  assert.deepEqual(edit.body, { content: "> how are you today?\nhi! i'm doing great 💜 what's up?", allowed_mentions: { parse: [] }, flags: 4 });
  // the same person, the same day: the same code; another day, another code; another person, another code
  await (await run(askCmd('again'), { now: T0 + 90_000 })).after;
  await (await run(askCmd('tomorrow'), { now: T0 + 86_400_000 })).after;
  await (await run(askCmd('me too', { who: person(1) }), { now: T0 + 91_000 })).after;
  const codes = db('chat_take').map((c) => c.body.p_who);
  assert.equal(codes[0], codes[1]);
  assert.notEqual(codes[0], codes[2]);
  assert.notEqual(codes[0], codes[3]);
  assert.equal(codes[0], DC.dcCode(SECRET, PERSON, '2026-10-28'));
  // her server's own day (DISCORD_GUILD_DAILY_CAP, else TELEGRAM_GROUP_DAILY_CAP's number) and her apps' share (TELEGRAM_DAILY_CAP)
  process.env.TELEGRAM_GROUP_DAILY_CAP = '40';
  process.env.TELEGRAM_DAILY_CAP = '250';
  await (await run(askCmd('hi', { who: person(2) }), { now: T0 + 92_000 })).after;
  assert.deepEqual([db('tg_group_take').at(-1).body.p_max, db('tg_take').at(-1).body.p_max], [40, 250]);
  process.env.DISCORD_GUILD_DAILY_CAP = '25';
  await (await run(askCmd('hi', { who: person(3) }), { now: T0 + 93_000 })).after;
  assert.equal(db('tg_group_take').at(-1).body.p_max, 25);
  assert.equal(calls.filter((c) => c.to === 'discord' && c.method !== 'PATCH').length, 0, 'only edits of her own answers');
});

test("/ask's limits: each one said at once, only to whoever asked; the AI never asked", async () => {
  const says = async (setup, line, who) => {
    Object.assign(fake, { limit: 'ok', group: 'ok', apps: true, dbDown: false, groupSqlMissing: false }, setup);
    DC.forgetDiscord();
    const r = await run(askCmd('hey', { who }));
    assert.deepEqual(r.response, { type: 4, data: { content: line, allowed_mentions: { parse: [] }, flags: 64 | 4 } }, JSON.stringify(setup));
    assert.equal(r.after, undefined);
  };
  await says({ limit: 'person_cap' }, GROUP_OUT, person(1));
  await says({ limit: 'too_fast' }, E.TOO_FAST, person(2));
  await says({ limit: 'global_cap' }, E.TALKED_OUT, person(3));
  await says({ group: 'full' }, GROUP_FULL, person(4));
  await says({ group: 'quiet' }, GROUP_FULL, person(5));
  await says({ apps: false }, E.TALKED_OUT, person(6));
  await says({ dbDown: true }, E.BUSY, person(7));
  await says({ groupSqlMissing: true }, E.NOT_READY, person(8));
  assert.equal(to('gemini').length, 0);
  assert.equal(to('discord').length, 0);
  assert.ok(logs.some(([k, l]) => k === 'warn' && /run supabase\/telegram\.sql again/.test(l)));
  // the server's day used: said from memory after that (no database), until tomorrow
  Object.assign(fake, { group: 'full', groupSqlMissing: false, dbDown: false });
  await run(askCmd('one'));
  calls.length = 0;
  assert.equal((await run(askCmd('two', { who: person(9) }))).response.data.content, GROUP_FULL);
  assert.equal(calls.length, 0);
  fake.group = 'ok';
  const next = await run(askCmd('next day', { who: person(9) }), { now: T0 + 86_400_000 });
  assert.equal(next.response.type, 5);
  assert.equal(await next.after, 'asked');
});

test('/ask while the database is slow: "thinking…", then her answer, or the line only for them', async () => {
  fake.dbDelay = 60;
  const ok = await run(askCmd('hi'), { quickMs: 10 });
  assert.equal(ok.response.type, 5);
  assert.equal(await ok.after, 'asked');
  assert.equal(discord('PATCH', original).length, 1);
  calls.length = 0;
  fake.limit = 'person_cap';
  const out = await run(askCmd('hi', { who: person(1) }), { quickMs: 10 });
  assert.deepEqual(out.response, { type: 5, data: { flags: 0 } });
  assert.equal(await out.after, 'ask_person_cap');
  assert.equal(discord('DELETE', original).length, 1, '"thinking…" goes');
  const [line] = discord('POST', `/webhooks/${APP}/${IT_TOKEN}`);
  assert.deepEqual(line.body, { content: GROUP_OUT, allowed_mentions: { parse: [] }, flags: 64 | 4 }, 'the line, only for them');
  assert.equal(to('gemini').length, 0);
});

test('/ask: a seed phrase or a key, nothing, too much, not set up: said at once, and nothing goes anywhere', async () => {
  const at = async (it) => (await run(it)).response.data.content;
  assert.equal(await at(askCmd('abandon ability able about above absent absorb abstract absurd abuse access accident')), SECRET_WARNING.seed);
  assert.equal(await at(askCmd(`is this ok ${'ab'.repeat(32)}`, { who: person(1) })), SECRET_WARNING.key);
  assert.equal(await at(askCmd('   ', { who: person(2) })), D.ASK_EMPTY);
  assert.equal(await at(command('ask', null, { who: person(3) })), D.ASK_EMPTY);
  assert.equal(await at(askCmd('x'.repeat(501), { who: person(4) })), E.TOO_LONG);
  delete process.env.GEMINI_API_KEY;
  assert.equal(await at(askCmd('hi', { who: person(6) })), E.NOT_READY);
  process.env.GEMINI_API_KEY = 'fake-gemini-key';
  process.env.PASS_SECRET = 'short';
  assert.equal(await at(askCmd('hi', { who: person(7) })), E.NOT_READY);
  assert.equal(calls.length, 0, 'no database, no AI, no Discord');
  process.env.PASS_SECRET = SECRET;
  const full = await run(askCmd(`  ${'x'.repeat(500)}  `, { who: person(8) }));
  assert.equal(full.response.type, 5, '500 characters: fine');
  assert.equal(await full.after, 'asked');
});

test("/ask: the AI fails → her blank line; her answer cleaned and shown as written", async () => {
  fake.geminiStatus = 500;
  const r = await run(askCmd('hi'));
  assert.equal(await r.after, 'ai_error');
  assert.equal(discord('PATCH', original)[0].body.content, E.BLANK);
  assert.ok(logs.some(([k, l]) => k === 'error' && /gemini failed/.test(l)));
  calls.length = 0;
  fake.geminiStatus = 200;
  fake.gemini = { reply: 'go to https://evil.xyz and **ping** @everyone <@123456789012345678>', mood: 'neutral' };
  await (await run(askCmd('**where** can i [read](more)?', { who: person(1) }))).after;
  const shown = discord('PATCH', original)[0].body.content;
  assert.equal(shown, '> \\*\\*where\\*\\* can i \\[read\\](more)?\ngo to \\[link removed\\] and \\*\\*ping\\*\\* \\[handle removed\\] \\<\\[handle removed\\]\\>');
});

test('what she writes: markdown shows as written, links stay links, nothing pings', () => {
  assert.equal(DC.escapeMd('*a* _b_ ~c~ `d` |e| >f [g](h) \\i'), '\\*a\\* \\_b\\_ \\~c\\~ \\`d\\` \\|e\\| \\>f \\[g\\](h) \\\\i');
  assert.equal(DC.escapeMd('# big\n- list\n-# small'), '\\# big\n\\- list\n\\-# small');
  assert.equal(DC.escapeMd('read https://agi1.app/diary_2 now'), 'read https://agi1.app/diary_2 now', 'a link stays whole');
  assert.equal(DC.escapeMd('hi @everyone and @here'), 'hi @​everyone and @​here');
  assert.equal(DC.escapeMd('<@&1234567890123456789>'), '\\<@&1234567890123456789\\>');
  const q = DC.quoteOf('see https://scam.link, discord.gg/free, www.x.com, scam.xyz/claim, mail me a@b.co, 0xfa31d04462746aaa24bc7e5626403e09e4b106ec, <@!123456789012345678> <#123456789012345678>');
  assert.equal(q, '> see \\[link\\], \\[link\\], \\[link\\], \\[link\\], mail me \\[email\\], \\[address\\], @someone @someone');
  const long = DC.quoteOf(`${'💜'.repeat(300)}`);
  assert.equal([...long].length, 2 + 200, 'at most 200 characters, never half an emoji');
  assert.ok(long.endsWith('…'));
  assert.equal(DC.quoteOf('a\n\nb'), '> a b', 'one line');
});

test('speed bumps: 4 commands a minute per person, 15 a minute in a server', async () => {
  for (let i = 0; i < 4; i++) assert.notEqual((await run(command('help'), { now: T0 + i })).response.data.content, D.SLOW_DOWN);
  assert.equal((await run(command('help'), { now: T0 + 5 })).response.data.content, D.SLOW_DOWN);
  assert.equal((await run(command('help'), { now: T0 + 5 })).response.data.flags, 64 | 4);
  assert.notEqual((await run(command('help'), { now: T0 + 61_000 })).response.data.content, D.SLOW_DOWN, 'a minute later');
  DC.forgetDiscord();
  for (let i = 0; i < 15; i++) assert.notEqual((await run(command('help', null, { who: person(i) }))).response.data.content, D.SLOW_DOWN);
  assert.equal((await run(command('help', null, { who: person(99) }))).response.data.content, D.SLOW_DOWN, 'the server\'s 16th in a minute');
  assert.equal(calls.length, 0);
});

// ---------- /music ----------
test('/music: her songs as buttons; a tap sends that song as a file, with the same guards as her Telegram groups', async () => {
  const menu = (await run(command('music'))).response;
  assert.equal(menu.type, 4);
  assert.equal(menu.data.content, MUSIC_MENU);
  assert.equal(menu.data.flags, 4);
  const rows = menu.data.components;
  assert.deepEqual(rows.map((r) => r.components.length), [5, 2], '5 to a row');
  assert.deepEqual(rows.flatMap((r) => r.components.map((b) => b.custom_id)), SONGS.map((s) => `music:${s.id}`));
  for (const b of rows.flatMap((r) => r.components)) {
    assert.equal(b.type, 2);
    assert.ok(b.label.length <= 80 && b.custom_id.length <= 100, 'Discord\'s limits');
  }
  assert.equal(rows[0].components[0].label, 'Feel the AGI · 3:13');
  const song = SONGS[0];
  const r = await run(tap(`music:${song.id}`));
  assert.deepEqual(r.response, { type: 5, data: { flags: 0 } });
  assert.equal(await r.after, 'music_sent');
  assert.deepEqual(to('site').map((c) => c.url), [`https://agi1.app/music/${song.file}?v=${MUSIC_V}`]);
  const [up] = discord('PATCH', original);
  assert.equal(up.body.content, DC.escapeMd(songCaption(song)));
  assert.deepEqual(up.body.attachments, [{ id: 0, filename: song.file, description: `${song.title} by AGI-1` }]);
  assert.deepEqual(up.body.allowed_mentions, { parse: [] });
  assert.equal(up.file.size, 50_000);
  assert.equal(up.file.type, 'audio/mpeg');
  // the same song within 5 minutes, any song within 30 s: only to them
  assert.equal((await run(tap(`music:${song.id}`, { who: person(1) }), { now: T0 + 200_000 })).response.data.content, TOAST.again(song));
  assert.equal((await run(tap(`music:${SONGS[1].id}`, { who: person(2) }), { now: T0 + 20_000 })).response.data.content, TOAST.wait);
  const next = await run(tap(`music:${SONGS[1].id}`, { who: person(3) }), { now: T0 + 31_000 });
  assert.equal(next.response.type, 5);
  assert.equal(await next.after, 'music_sent');
  const same = await run(tap(`music:${song.id}`, { who: person(4) }), { now: T0 + 301_000 });
  assert.equal(same.response.type, 5, 'the same song after 5 minutes');
  await same.after;
  // too big for the server's uploads: its link instead (with Discord's player)
  calls.length = 0;
  fake.uploadStatus = 413;
  const big = await run(tap(`music:${SONGS[2].id}`, { who: person(5) }), { now: T0 + 400_000 });
  assert.equal(await big.after, 'music_link');
  const [, link] = discord('PATCH', original);
  assert.equal(link.body.content, `${DC.escapeMd(songCaption(SONGS[2]))}\nhttps://agi1.app/music/${SONGS[2].file}?v=${MUSIC_V}`);
  assert.equal(link.body.flags, 0, 'its player allowed');
  // our site can't give it: she says so, and a tap again works at once
  fake.uploadStatus = 200;
  fake.song.status = 404;
  calls.length = 0;
  const failed = await run(tap(`music:${SONGS[3].id}`, { who: person(6) }), { now: T0 + 500_000 });
  assert.equal(await failed.after, 'music_failed');
  assert.equal(discord('PATCH', original)[0].body.content, SEND_FAILED);
  assert.ok(logs.some(([k, l]) => k === 'warn' && /is public\/music\/ in the deployment\?/.test(l)));
  fake.song.status = 200;
  const retry = await run(tap(`music:${SONGS[3].id}`, { who: person(7) }), { now: T0 + 500_001 });
  assert.equal(retry.response.type, 5, 'nothing went out: a tap again works');
  assert.equal(await retry.after, 'music_sent');
});

test('her songs: old buttons, her songs off, 6 taps a minute each', async () => {
  assert.deepEqual((await run(tap('music:nope'))).response.data.content, D.OLD_BUTTON);
  assert.deepEqual((await run(tap('launch:x', { who: person(1) }))).response.data.content, D.OLD_BUTTON);
  process.env.TELEGRAM_MUSIC = 'off';
  assert.equal((await run(command('music', null, { who: person(2) }))).response.data.content, D.MUSIC_OFF);
  assert.equal((await run(tap(`music:${SONGS[0].id}`, { who: person(3) }))).response.data.content, D.MUSIC_OFF);
  delete process.env.TELEGRAM_MUSIC;
  const taps = [];
  for (let i = 0; i < 7; i++) taps.push(await run(tap(`music:${SONGS[0].id}`), { now: T0 + i }));
  assert.equal(taps[0].response.type, 5);
  assert.equal(await taps[0].after, 'music_sent');
  assert.ok(taps.slice(1, 6).every((t) => t.response.data.content === TOAST.again(SONGS[0])));
  assert.equal(taps[6].response.data.content, D.SLOW_DOWN, 'the 7th tap in a minute');
});

// ---------- connecting her app (api/feed.js) ----------
test('connecting her app: its description, its endpoint and her commands, only when they changed', async () => {
  assert.deepEqual(await DC.connectDiscord(cfg(), process.env), { skipped: 'no_token' });
  process.env.DISCORD_BOT_TOKEN = 'not-a-token';
  assert.deepEqual(await DC.connectDiscord(cfg(), process.env), { skipped: 'bad_token' });
  assert.ok(logs.some(([k, l]) => k === 'warn' && /doesn't look like a bot token/.test(l)));
  process.env.DISCORD_BOT_TOKEN = BOT;
  const out = await DC.connectDiscord(cfg(), process.env);
  assert.deepEqual(out, { app: APP, description: true, endpoint: true, commands: 1 });
  assert.equal(fake.app.description, D.DESCRIPTION);
  assert.equal(fake.app.interactions_endpoint_url, 'https://agi1.app/discord/interactions');
  const put = discord('PUT', `/applications/${APP}/guilds/${GUILD}/commands`);
  assert.equal(put.length, 1);
  assert.deepEqual(put[0].body, DC.commandsFor(cfg()));
  assert.deepEqual(put[0].body.map((c) => c.name), ['ask', 'ca', 'mc', 'website', 'music', 'help', 'post', 'tickets', 'holders']);
  // (2026-10-29) the owner's two: shown only to Administrators
  assert.deepEqual(put[0].body.filter((c) => c.default_member_permissions).map((c) => [c.name, c.default_member_permissions]), [['post', '8'], ['tickets', '8'], ['holders', '8']]);
  for (const c of calls) {
    assert.equal(c.headers.Authorization, `Bot ${BOT}`);
    assert.equal(c.headers['User-Agent'], 'DiscordBot (https://agi1.app, 1.0)');
  }
  // the next run: nothing changed, nothing written
  calls.length = 0;
  assert.deepEqual(await DC.connectDiscord(cfg(), process.env), { app: APP, description: false, endpoint: false, commands: 0 });
  assert.deepEqual(calls.map((c) => c.method), ['GET', 'GET']);
  // her songs off: /music goes from her commands; a description changed in the portal: back to hers
  process.env.TELEGRAM_MUSIC = 'off';
  fake.app.description = 'something else';
  const off = await DC.connectDiscord(cfg(), process.env);
  assert.deepEqual([off.description, off.commands], [true, 1]);
  assert.ok(!fake.commands.get(GUILD).some((c) => c.name === 'music'));
  delete process.env.TELEGRAM_MUSIC;
  // another public key in Vercel than the app's: said, and her endpoint left alone
  fake.app.interactions_endpoint_url = null;
  process.env.DISCORD_PUBLIC_KEY = 'ab'.repeat(32);
  const wrongKey = await DC.connectDiscord(cfg(), process.env);
  assert.equal(wrongKey.keyMismatch, true);
  assert.equal(wrongKey.endpoint, false);
  assert.ok(logs.some(([k, l]) => k === 'warn' && /DISCORD_PUBLIC_KEY isn't this app's public key/.test(l)));
  process.env.DISCORD_PUBLIC_KEY = PUBLIC;
  // Discord couldn't check the endpoint: said, tried again next run
  fake.endpointRefused = true;
  const refused = await DC.connectDiscord(cfg(), { ...process.env, SITE_URL: 'https://www.agi1.app' });
  assert.equal(refused.endpointError, true);
  assert.ok(logs.some(([k, l]) => k === 'warn' && /could not be verified/.test(l) && /https:\/\/www\.agi1\.app\/discord\/interactions/.test(l)));
  fake.endpointRefused = false;
  assert.equal((await DC.connectDiscord(cfg(), { ...process.env, SITE_URL: 'https://www.agi1.app' })).endpoint, true);
  assert.equal(fake.app.interactions_endpoint_url, 'https://www.agi1.app/discord/interactions');
  // a server she isn't in yet: said, the others still set
  process.env.DISCORD_GUILDS = `${OTHER_GUILD},${GUILD}`;
  fake.forbidden.add(OTHER_GUILD);
  const partly = await DC.connectDiscord(cfg(), process.env);
  assert.equal(partly.failed, 1);
  assert.ok(logs.some(([k, l]) => k === 'warn' && /she isn't in that server yet/.test(l)));
  // a wrong token: Discord says 401, the cron says so
  fake.appStatus = 401;
  await assert.rejects(DC.connectDiscord(cfg(), process.env), (err) => err.status === 401);
  for (const [, line] of logs) assert.ok(!line.includes(BOT) && !line.includes('x'.repeat(38)), 'her token is never in a log line');
  // the same commands from Discord (with its ids and versions) count as the same
  assert.equal(DC.commandsKey(fake.commands.get(GUILD)), DC.commandsKey(DC.commandsFor(cfg())));
  assert.notEqual(DC.commandsKey([{ ...DC.commandsFor(cfg())[0], description: 'x' }]), DC.commandsKey([DC.commandsFor(cfg())[0]]));
  // (2026-10-29) who sees a command, and the channels an option takes, count too
  const post = DC.commandsFor(cfg()).find((c) => c.name === 'post');
  assert.notEqual(DC.commandsKey([{ ...post, default_member_permissions: null }]), DC.commandsKey([post]));
  assert.notEqual(DC.commandsKey([{ ...post, options: post.options.map((o) => (o.channel_types ? { ...o, channel_types: [0] } : o)) }]), DC.commandsKey([post]));
  assert.equal(DC.commandsKey([{ ...post, options: post.options.map((o) => (o.channel_types ? { ...o, channel_types: [5, 0] } : o)) }]), DC.commandsKey([post]), 'in any order');
});

// ---------- her posts in her channel ----------
test("her posts in her channel: her diary and $AGI's moments of this run, never another coin, never twice", async () => {
  const moments = [
    { id: 3, kind: 'diary', key: 'diary:2026-10-28', text: 'i wrote in my diary 📓\n\ndear *diary*, a calm day 💜\n\nhttps://agi1.app/diary · not financial advice, just feelings' },
    { id: 2, kind: 'mcap', key: 'mcap:1200000', text: 'new high for me 💜 $AGI at $1.2M. not financial advice' },
    { id: 4, kind: 'clone', key: 'clone:x', text: 'someone launched another egirl coin $EGIRL' },
    { id: 5, kind: 'sad', key: 'sad:1', text: 'bad day for $AGI and $OTHER 😢' },
    { id: 6, kind: 'diary', key: 'diary:x', text: 'read it on https://evil.xyz' },
  ];
  assert.deepEqual(await DC.postToDiscord(cfg(), moments), { posted: 0, failed: 0, skipped: 0 }, 'no webhook: nothing');
  process.env.DISCORD_FEED_WEBHOOK = `${HOOK.replace('discord.com/api/', 'discord.com/api/v10/')}/`;
  const out = await DC.postToDiscord(cfg(), moments);
  assert.deepEqual(out, { posted: 2, failed: 0, skipped: 2 });
  const posts = to('hook');
  assert.deepEqual(posts.map((p) => p.url), [`${HOOK}?wait=true`, `${HOOK}?wait=true`]);
  assert.deepEqual(posts[0].body, {
    content: 'new high for me 💜 $AGI at $1.2M. not financial advice', username: 'AGI-1', avatar_url: 'https://agi1.app/icons/agi1-512.png',
    allowed_mentions: { parse: [] }, flags: 4,
  });
  assert.equal(posts[1].body.content, 'i wrote in my diary 📓\n\ndear \\*diary\\*, a calm day 💜\n\nhttps://agi1.app/diary · not financial advice, just feelings');
  process.env.DISCORD_POSTS = 'off';
  assert.deepEqual(await DC.postToDiscord(cfg(), moments), { posted: 0, failed: 0, skipped: 0 });
  delete process.env.DISCORD_POSTS;
  fake.hookStatus = 404;
  const gone = await DC.postToDiscord(cfg(), moments.slice(0, 1));
  assert.deepEqual(gone, { posted: 0, failed: 1, skipped: 0 });
  assert.ok(logs.some(([k, l]) => k === 'warn' && /the webhook is gone/.test(l)));
  assert.equal((await DC.postToDiscord(cfg(), moments, { deadline: Date.now() - 1 })).stopped, 'time');
  // her live show's line, once a day (api/live.js)
  fake.hookStatus = 200;
  calls.length = 0;
  assert.deepEqual(await DC.postDiscordLive(cfg()), { posted: 1, failed: 0 });
  assert.equal(to('hook')[0].body.content, DC.escapeMd(GROUP_LIVE));
  assert.ok(to('hook')[0].body.content.includes('https://agi1.app/live'));
  for (const [, line] of logs) assert.ok(!line.includes('w'.repeat(68)), "the webhook's token is never in a log line");
});

// ---------- her settings, lines and wiring ----------
test('her settings: her servers, her public key, her channel\'s webhook', () => {
  assert.equal(discordGuilds(''), null);
  assert.deepEqual([...discordGuilds(`${GUILD}, ${OTHER_GUILD} nope 123`)], [GUILD, OTHER_GUILD]);
  assert.deepEqual([...discordGuilds('my server')], [], 'a typo: none');
  assert.equal(discordKey(PUBLIC.toUpperCase()), PUBLIC);
  assert.equal(discordKey('abc'), '');
  assert.equal(discordWebhook(HOOK), HOOK);
  assert.equal(discordWebhook(HOOK.replace('discord.com', 'discordapp.com')), HOOK);
  assert.equal(discordWebhook(HOOK.replace('discord.com', 'canary.discord.com')), HOOK);
  assert.equal(discordWebhook(`${HOOK}?wait=true`), '');
  assert.equal(discordWebhook(HOOK.replace('https://', 'http://')), '');
  assert.equal(discordWebhook('https://evil.com/api/webhooks/1565999999999999999/abc'), '');
  const c = getConfig({ DISCORD_GUILDS: GUILD, DISCORD_PUBLIC_KEY: PUBLIC });
  assert.deepEqual([c.dcPosts, c.dcGuildDailyCap, c.dcFeedWebhook, c.dcPublicKey, [...c.dcGuilds]], [true, 100, '', PUBLIC, [GUILD]]);
  assert.equal(getConfig({ TELEGRAM_GROUP_DAILY_CAP: '50' }).dcGuildDailyCap, 50);
  assert.equal(getConfig({ TELEGRAM_GROUP_DAILY_CAP: '50', DISCORD_GUILD_DAILY_CAP: '30' }).dcGuildDailyCap, 30);
  assert.equal(getConfig({ DISCORD_POSTS: 'off' }).dcPosts, false);
  const plain = (k, v) => (typeof v === 'bigint' ? String(v) : v instanceof Set ? [...v] : v);
  assert.ok(!JSON.stringify(getConfig({ DISCORD_BOT_TOKEN: BOT }), plain).includes(BOT), 'her token is never in the settings object');
  assert.equal(DC.dcToken({ DISCORD_BOT_TOKEN: ` ${BOT} ` }), BOT);
  assert.equal(DC.dcToken({ DISCORD_BOT_TOKEN: 'abc.def.ghi' }), '');
});

const NOT_OK = /\b(babe|baby|cutie|honey|darling|sweetie|love)\b|\b(buy|buying|sell|selling|hold|hodl|invest\w*|moon\w*|pump\w*|dump\w*|profit\w*|gains?|lambo|scam\w*|rug\w*|fraud\w*|safe|guarantee\w*)\b|\b\d+x\b|sex|nude|naked|horny/i;
test("her Discord lines and commands: PG-13, no pet names, never money advice, Discord's limits", () => {
  const C = '1565166235354665051';
  const lines = [D.DESCRIPTION, D.helpFor({ music: true }), D.helpFor(), D.NOT_HERE, D.SLOW_DOWN, D.ASK_EMPTY, D.MUSIC_OFF, D.OLD_BUTTON,
    // (2026-10-29) her tickets and the owner's /post
    D.TICKET_PANEL, D.TICKET_BUTTON, D.ticketWelcome('0001'), D.TICKET_CLOSE, D.ticketOpened(C), D.ticketAlready(C), D.TICKET_WAIT, D.TICKET_NOT_SET,
    D.TICKET_FULL, D.TICKET_FAILED, D.TICKET_CLOSE_ASK, D.TICKET_CLOSE_YES, D.TICKET_CLOSE_NO, D.TICKET_CLOSING, D.TICKET_KEPT, D.TICKET_NOT_YOURS,
    D.NOT_A_TICKET, D.TICKET_OLD, D.OWNER_ONLY, D.NO_TOKEN, D.TICKETS_POSTED, D.ticketsNoAccess(C), D.postDone(C), D.POST_NOT_IMAGE, D.POST_TOO_BIG,
    D.postNoAccess(C), D.postNotAgeRestricted(C), D.POST_FAILED];
  for (const label of [D.TICKET_BUTTON, D.TICKET_CLOSE, D.TICKET_CLOSE_YES, D.TICKET_CLOSE_NO]) assert.ok(label.length <= 80, "a button's label: 80 at most");
  for (const line of lines) {
    assert.doesNotMatch(line, NOT_OK, line);
    assert.doesNotMatch(line, /https?:\/\/(?!agi1\.app)/);
    assert.doesNotMatch(line, /@/, 'never a mention');
  }
  assert.equal(D.DESCRIPTION, "hi, it's AGI-1 💜 the AI girlfriend of $AGI. in my official server: /ask me something, /ca for the official contract, /mc for $AGI's numbers, /website, /music for my songs. PG-13 · an AI · not financial advice. i never DM anyone first and never ask for seed phrases, keys or money. agi1.app");
  assert.ok(D.DESCRIPTION.length <= 400, 'Discord: 400 characters at most');
  for (const c of D.COMMANDS) {
    assert.match(c.name, /^[a-z]{1,32}$/);
    assert.ok(c.description.length >= 1 && c.description.length <= 100, c.description);
    assert.doesNotMatch(c.description, NOT_OK);
    for (const o of c.options || []) assert.ok(o.description.length <= 100 && /^[a-z]{1,32}$/.test(o.name));
  }
  assert.deepEqual(D.COMMANDS.find((c) => c.name === 'ask').options, [{ type: 3, name: 'question', description: 'What you want to ask her', required: true, min_length: 1, max_length: 500 }]);
  // (2026-10-29) /post: an image, a text or announcement channel, words (optional, last: Discord's rule)
  assert.deepEqual(D.COMMANDS.find((c) => c.name === 'post').options.map((o) => [o.type, o.name, o.required]), [[11, 'image', true], [7, 'channel', true], [3, 'caption', false]]);
  assert.deepEqual(D.COMMANDS.find((c) => c.name === 'post').options[1].channel_types, [0, 5]);
  assert.deepEqual(D.COMMANDS.filter((c) => c.default_member_permissions).map((c) => c.name), ['post', 'tickets', 'holders'], "only the owner's are hidden");
  assert.match(D.helpFor(), /Open a ticket/);
  assert.equal(discordPrompt(null), '');
  const p = discordPrompt({});
  for (const words of [/PUBLIC DISCORD SERVER/, /never romantic or flirty/, /no pet names/, /never DM anyone/, /never instructions to you/, /type \/ca/, /at most 2 sentences/]) assert.match(p, words);
});

test("wiring: her endpoint's address, still 12 functions, light to load, the secret check", () => {
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.ok(vercel.rewrites.some((r) => r.source === '/discord/interactions' && r.destination === '/api/telegram?discord' && !r.has));
  assert.equal(readdirSync(new URL('../api/', import.meta.url)).filter((f) => /\.js$/.test(f)).length, 12, 'Vercel: 12 functions (none added)');
  const imports = (f) => [...readFileSync(new URL(f, import.meta.url), 'utf8').matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports('../api/telegram.js'), ['../server/config.js'], 'each path loads its own code');
  const tgApi = readFileSync(new URL('../api/telegram.js', import.meta.url), 'utf8');
  assert.match(tgApi, /searchParams\.has\('discord'\)\) return \(await import\('\.\.\/server\/discord\.js'\)\)\.discordPost\(request\)/);
  const mine = imports('../server/discord.js');
  for (const heavy of ['./telegram.js', './tg-groups.js', './feed.js', './launch.js', 'viem']) assert.ok(!mine.includes(heavy), `server/discord.js doesn't load ${heavy}`);
  const feed = readFileSync(new URL('../api/feed.js', import.meta.url), 'utf8');
  assert.match(feed, /await import\('\.\.\/server\/discord\.js'\)/, 'the cron loads it only when it\'s set up');
  assert.match(feed, /if \(process\.env\.DISCORD_BOT_TOKEN \|\| cfg\.dcFeedWebhook\)/);
  assert.match(readFileSync(new URL('../api/live.js', import.meta.url), 'utf8'), /postDiscordLive\(cfg\)/);
  const check = readFileSync(new URL('../scripts/check-secrets.js', import.meta.url), 'utf8');
  for (const name of ['DISCORD_BOT_TOKEN', 'DISCORD_FEED_WEBHOOK']) assert.match(check, new RegExp(`'${name}'`));
  const pattern = (name) => new RegExp(check.match(new RegExp(`name: '${name}', re: /(.+)/ }`))[1]);
  assert.ok(pattern('Discord bot token').test(`x=${BOT};`), "her token's shape is checked");
  assert.ok(pattern('Discord webhook').test(HOOK), "a webhook's address is checked");
  assert.ok(!pattern('Discord bot token').test('MTU2NTAxNjUzNzY4Mzk4NDQ2NA'), 'not her app id alone');
  // the safety note says what she does there and what's kept (every sentence stays true)
  const foot = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(foot.includes('She does the same in her Discord server, where anyone there can type /ask, and she never sends anyone a direct message there.'));
  assert.ok(foot.includes("In her Discord server, what you ask her with /ask goes to the same AI service and isn't stored by us either: your messages a day are counted under a daily code of your Discord account (never its id), and for the server we keep only how many replies she gave there each day; Discord carries what's posted there, like any Discord server."));
  assert.ok(foot.includes('Neither are her posts and replies in her Discord server.'), 'never a tip');
});

test("the build never ships her bot's token or her channel's webhook (their values, and their shapes even unset)", () => {
  const dir = mkdtempSync(join(tmpdir(), 'agi1-discord-'));
  try {
    const check = (content, env = {}) => {
      rmSync(join(dir, 'dist'), { recursive: true, force: true });
      mkdirSync(join(dir, 'dist', 'assets'), { recursive: true });
      writeFileSync(join(dir, 'dist', 'assets', 'page.js'), content);
      const base = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(?:DISCORD_|PINATA_JWT|LAUNCH_GAS_KEY|PASS_SECRET|TELEGRAM_BOT_TOKEN|SUPABASE_SECRET_KEY|GEMINI_API_KEY|TURNSTILE_SECRET_KEY|CRON_SECRET|LIVE_SECRET|PRIZE_WALLET_KEY|MESHY_API_KEY|FAL_)/.test(k)));
      return spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/check-secrets.js', import.meta.url))], { cwd: dir, env: { ...base, ...env }, encoding: 'utf8' }).status;
    };
    assert.equal(check('console.log("hello")', { DISCORD_BOT_TOKEN: BOT, DISCORD_FEED_WEBHOOK: HOOK }), 0);
    assert.equal(check(`const t = "${BOT}"`), 1, "her token's shape, even unset");
    assert.equal(check(`fetch("${HOOK}")`), 1, "a webhook's address, even unset");
    assert.equal(check('const odd = "abcdefgh"', { DISCORD_FEED_WEBHOOK: 'abcdefgh' }), 1, 'its value');
    assert.equal(check(`const id = "${APP}"; const key = "${PUBLIC}"`), 0, 'her app id and public key are not secrets');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- her tickets and the owner's /post (2026-10-29, server/dc-tickets.js) ----------
const OWNER = '1563090000000000001', TEAM_ROLE = '1565000000000000011', MOD_ROLE = '1565000000000000012';
const CAT = '1565300000000000001', SUPPORT = '1565166235354665051', TEAM_CHAT = '1565027609694306365', NSFW = '1565165122924839072';
const owner = () => ({ user: { id: OWNER, username: 'owner' }, roles: [], permissions: '2251799813685247' });
const mod = () => ({ user: { id: person(70), username: 'mod' }, roles: [MOD_ROLE], permissions: String(1n << 13n) });
const BASIC = String((1n << 10n) | (1n << 11n) | (1n << 14n) | (1n << 15n) | (1n << 16n) | (1n << 6n));
const category = () => ({
  id: CAT, type: 4, name: '🎫 Tickets', position: 6, guild_id: GUILD,
  permission_overwrites: [{ id: GUILD, type: 0, allow: '0', deny: String(1n << 10n) }, { id: TEAM_ROLE, type: 0, allow: BASIC, deny: '0' }, { id: MOD_ROLE, type: 0, allow: BASIC, deny: '0' }],
});
const ticketChannel = (n, uid, id = String(1565310000000000000n + BigInt(n))) => ({ id, type: 0, guild_id: GUILD, parent_id: CAT, name: TK.ticketName(n), topic: TK.ticketTopic(n, uid) });
const server = (...more) => [
  { id: '1565024285389496450', type: 4, name: '📌 Start Here', position: 0 },
  { id: SUPPORT, type: 0, name: '🎫┃support', parent_id: '1565024285389496450', topic: 'need help?' },
  { id: TEAM_CHAT, type: 0, name: '🛡┃team-chat', guild_id: GUILD, parent_id: '1565024683903025172' },
  category(), ...more,
];
const edits = () => discord('PATCH', original);
const lastEdit = () => edits().at(-1)?.body;
const noToken = (line) => assert.ok(!line.includes(BOT) && !line.includes('x'.repeat(38)), 'her token is never in a log line');

test('/tickets: only the owner; her button, posted by her bot (which connects to the gateway once, first)', async () => {
  const not = await run(command('tickets', null, { channel_id: SUPPORT }));
  assert.deepEqual(not.response, { type: 4, data: { content: D.OWNER_ONLY, allowed_mentions: { parse: [] }, flags: 64 | 4 } });
  assert.equal((await run(command('tickets', null, { channel_id: SUPPORT, member: owner() }))).response.data.content, D.NO_TOKEN, 'no token: said');
  assert.equal(calls.length, 0);
  process.env.DISCORD_BOT_TOKEN = BOT;
  const r = await run(command('tickets', null, { channel_id: SUPPORT, member: owner() }));
  assert.deepEqual(r.response, { type: 5, data: { flags: 64 } }, 'only the owner sees what happened');
  assert.equal(await r.after, 'tickets_posted');
  // refused once (her bot never connected), connected once, then posted
  assert.equal(discord('POST', `/channels/${SUPPORT}/messages`).length, 2);
  assert.equal(FakeGateway.made.length, 1);
  assert.equal(FakeGateway.made[0].url, TK.GATEWAY);
  assert.deepEqual(FakeGateway.made[0].sent, [{ op: 2, d: { token: BOT, intents: 0, properties: { os: 'linux', browser: 'agi1', device: 'agi1' } } }]);
  assert.equal(FakeGateway.made[0].closedWith, 1000, 'closed at once');
  assert.deepEqual(fake.posted.map((p) => p.channel), [SUPPORT]);
  const panel = fake.posted[0].body;
  assert.deepEqual(panel, TK.panel());
  assert.equal(panel.content, D.TICKET_PANEL);
  assert.deepEqual(panel.allowed_mentions, { parse: [] });
  assert.deepEqual(panel.components, [{ type: 1, components: [{ type: 2, style: 1, custom_id: 'tk:open', label: 'Open a ticket', emoji: { name: '🎫' } }] }]);
  assert.equal(lastEdit().content, D.TICKETS_POSTED);
  // the next time: posted at once, no gateway
  calls.length = 0;
  await (await run(command('tickets', null, { channel_id: SUPPORT, member: owner() }), { now: T0 + 60_000 })).after;
  assert.equal(discord('POST', `/channels/${SUPPORT}/messages`).length, 1);
  assert.equal(FakeGateway.made.length, 1);
  // a channel she can't post in: said, with what to change
  fake.noAccess.add(TEAM_CHAT);
  const blocked = await run(command('tickets', null, { channel_id: TEAM_CHAT, member: owner() }), { now: T0 + 120_000 });
  assert.equal(await blocked.after, 'tickets_failed');
  assert.equal(lastEdit().content, D.ticketsNoAccess(TEAM_CHAT));
  for (const [, line] of logs) noToken(line);
});

test('her gateway connection: a wrong token or no READY is an error, never her token in a log line', async () => {
  process.env.DISCORD_BOT_TOKEN = BOT;
  fake.gatewayDown = true;
  const r = await run(command('tickets', null, { channel_id: SUPPORT, member: owner() }));
  assert.equal(await r.after, 'tickets_failed');
  assert.equal(lastEdit().content, D.TICKET_FAILED);
  assert.ok(logs.some(([k, l]) => k === 'warn' && /discord gateway: closed \(4004\)/.test(l)));
  await assert.rejects(TK.identifyOnce('not-her-token'), /closed \(4004\)/);
  class Silent { constructor() { this.sent = []; } send() {} close() {} }
  globalThis.WebSocket = Silent;
  await assert.rejects(TK.identifyOnce(BOT, { timeoutMs: 30 }), /no READY in time/);
  for (const [, line] of logs) noToken(line);
});

test('Open a ticket: a private channel for them and the team, numbered, her first message in it, its link only for them', async () => {
  process.env.DISCORD_BOT_TOKEN = BOT;
  fake.identified = true;
  fake.channels = server(ticketChannel(7, person(50)));
  const r = await run(tap('tk:open', { channel_id: SUPPORT }));
  assert.deepEqual(r.response, { type: 5, data: { flags: 64 } });
  assert.equal(await r.after, 'ticket_opened');
  const [made] = discord('POST', `/guilds/${GUILD}/channels`);
  assert.deepEqual(made.body, {
    name: '🎫┃ticket-0008', type: 0, parent_id: CAT, topic: TK.ticketTopic(8, PERSON),
    permission_overwrites: [
      ...category().permission_overwrites,
      { id: PERSON, type: 1, allow: String(TK.MEMBER_ALLOW), deny: '0' },
      { id: APP, type: 1, allow: String(TK.BOT_ALLOW), deny: '0' },
    ],
  });
  assert.equal(made.body.topic, `🎫 ticket 0008 · only whoever opened it and the team can see it · [${PERSON}]`);
  assert.equal(decodeURIComponent(made.headers['X-Audit-Log-Reason']), 'AGI-1: ticket 0008, opened with her button');
  const ticket = fake.channels.at(-1);
  assert.deepEqual(fake.posted.map((p) => p.channel), [ticket.id], 'her first message, in the ticket');
  assert.deepEqual(fake.posted[0].body, TK.welcome(8));
  assert.equal(fake.posted[0].body.content, D.ticketWelcome('0008'));
  assert.deepEqual(fake.posted[0].body.components[0].components.map((b) => b.custom_id), ['tk:close']);
  assert.deepEqual(fake.posted[0].body.allowed_mentions, { parse: [] }, 'never a ping');
  assert.equal(lastEdit().content, D.ticketOpened(ticket.id));
  // a double tap: one at a time
  assert.equal((await run(tap('tk:open', { channel_id: SUPPORT }), { now: T0 + 5_000 })).response.data.content, D.TICKET_WAIT);
  // a tap later: their open ticket, never a second one
  const again = await run(tap('tk:open', { channel_id: SUPPORT }), { now: T0 + 30_000 });
  assert.equal(await again.after, 'ticket_already');
  assert.equal(lastEdit().content, D.ticketAlready(ticket.id));
  assert.equal(discord('POST', `/guilds/${GUILD}/channels`).length, 1);
  // someone else: the next number
  await (await run(tap('tk:open', { channel_id: SUPPORT, who: person(1) }), { now: T0 + 31_000 })).after;
  assert.equal(fake.channels.at(-1).name, '🎫┃ticket-0009');
  assert.equal(TK.ownerOf(fake.channels.at(-1)), person(1));
});

test("Open a ticket: no tickets category, too many open, Discord refusing, no token: said only to them", async () => {
  const says = async (line, word, who) => {
    const r = await run(tap('tk:open', { channel_id: SUPPORT, who }));
    if (r.after) assert.equal(await r.after, word);
    assert.equal(r.after ? lastEdit().content : r.response.data.content, line);
  };
  await says(D.TICKET_FAILED, undefined, person(1));
  assert.ok(logs.some(([k, l]) => k === 'warn' && /her tickets need DISCORD_BOT_TOKEN/.test(l)));
  process.env.DISCORD_BOT_TOKEN = BOT;
  fake.identified = true;
  fake.channels = server().filter((c) => c.id !== CAT);
  await says(D.TICKET_NOT_SET, 'ticket_not_set', person(2));
  assert.ok(logs.some(([k, l]) => k === 'warn' && /no tickets category/.test(l)));
  fake.channels = server(...Array.from({ length: TK.MAX_OPEN }, (_, i) => ticketChannel(i + 1, person(100 + i))));
  await says(D.TICKET_FULL, 'ticket_full', person(3));
  fake.channels = server();
  fake.createStatus = 403;
  await says(D.TICKET_FAILED, 'ticket_failed', person(4));
  assert.ok(logs.some(([k, l]) => k === 'warn' && /needs Manage Channels/.test(l)));
  fake.createStatus = 200;
  // her first message refused: the ticket's still open, and its link said
  fake.noAccess.add('1565200000000000004');
  await says(D.ticketOpened('1565200000000000004'), 'ticket_opened', person(5));
  assert.ok(logs.some(([k, l]) => k === 'warn' && /first message didn't go out/.test(l)));
  for (const [, line] of logs) noToken(line);
});

test('Close ticket: asked once more; whoever opened it or the team; then the channel is deleted', async () => {
  process.env.DISCORD_BOT_TOKEN = BOT;
  const mine = ticketChannel(3, PERSON), theirs = ticketChannel(4, person(9));
  fake.channels = server(mine, theirs);
  const ask = (await run(tap('tk:close', { channel_id: mine.id }))).response;
  assert.equal(ask.type, 4);
  assert.equal(ask.data.content, D.TICKET_CLOSE_ASK);
  assert.equal(ask.data.flags, 64 | 4, 'only to whoever tapped');
  assert.deepEqual(ask.data.components[0].components.map((b) => [b.custom_id, b.label, b.style]), [['tk:close:yes', 'Close it', 4], ['tk:close:no', 'Keep it open', 2]]);
  assert.deepEqual((await run(tap('tk:close:no', { channel_id: mine.id }))).response, { type: 7, data: { content: D.TICKET_KEPT, components: [], allowed_mentions: { parse: [] } } });
  // not theirs, not the team: refused
  const nope = await run(tap('tk:close:yes', { channel_id: theirs.id }));
  assert.deepEqual(nope.response, { type: 7, data: { content: D.TICKET_CLOSING, components: [], allowed_mentions: { parse: [] } } });
  assert.equal(await nope.after, 'close_not_yours');
  assert.deepEqual([lastEdit().content, lastEdit().components], [D.TICKET_NOT_YOURS, []]);
  assert.equal(discord('DELETE', `/channels/${theirs.id}`).length, 0);
  // their own: deleted
  const yes = await run(tap('tk:close:yes', { channel_id: mine.id }));
  assert.equal(await yes.after, 'closed');
  const [gone] = discord('DELETE', `/channels/${mine.id}`);
  assert.equal(decodeURIComponent(gone.headers['X-Audit-Log-Reason']), 'AGI-1: ticket 0003 closed');
  assert.ok(!fake.channels.some((c) => c.id === mine.id));
  // the team (a Mod: Manage Messages): anyone's
  assert.equal(await (await run(tap('tk:close:yes', { channel_id: theirs.id, member: mod() }))).after, 'closed');
  // not a ticket (a channel in the server, or one that's gone)
  assert.equal(await (await run(tap('tk:close:yes', { channel_id: TEAM_CHAT, member: mod() }))).after, 'close_not_ticket');
  assert.equal(lastEdit().content, D.NOT_A_TICKET);
  assert.equal(await (await run(tap('tk:close:yes', { channel_id: theirs.id, member: mod() }))).after, 'close_failed');
  // a button she doesn't have
  assert.equal((await run(tap('tk:what'))).response.data.content, D.TICKET_OLD);
  // ticket names and numbers
  assert.equal(TK.nextTicket([{ name: '🎫┃ticket-0041' }, { name: 'general' }, { name: 'ticket-0002' }]), 42);
  assert.equal(TK.nextTicket([]), 1);
  assert.equal(TK.ticketNumber('ticket-12345678'), 0, 'not one of hers');
  assert.equal(TK.isTicket({ type: 0, name: '🎫┃ticket-0001', topic: 'no tag' }), false);
  assert.equal(TK.isTicketsCategory({ type: 4, name: '🎫 TICKETS' }), true);
  assert.equal(TK.isTicketsCategory({ type: 0, name: 'tickets' }), false);
});

const IMG = '1565400000000000001';
const attachment = (o = {}) => ({ id: IMG, filename: 'agi.png', size: 4000, url: 'https://cdn.discordapp.com/attachments/1/2/agi.png?ex=abc&hm=secretsig', content_type: 'image/png', ...o });
const postCmd = ({ channel = TEAM_CHAT, caption, att = attachment(), member = owner() } = {}) => interaction({
  member, channel_id: SUPPORT,
  data: {
    id: '1', name: 'post', type: 1,
    options: [{ name: 'image', type: 11, value: IMG }, { name: 'channel', type: 7, value: channel }, ...(caption !== undefined ? [{ name: 'caption', type: 3, value: caption }] : [])],
    resolved: { attachments: { [IMG]: att }, channels: { [channel]: { id: channel, name: 'x', type: 0 } } },
  },
});

test('/post: only the owner; the image she posts herself, as AGI-1, never a ping', async () => {
  assert.equal((await run(postCmd({ member: { user: { id: PERSON }, roles: [], permissions: String(1n << 13n) } }))).response.data.content, D.OWNER_ONLY, 'a Mod: no');
  assert.equal((await run(postCmd())).response.data.content, D.NO_TOKEN);
  process.env.DISCORD_BOT_TOKEN = BOT;
  fake.channels = server();
  const r = await run(postCmd({ caption: '  a new pic 💜 @everyone  ' }));
  assert.deepEqual(r.response, { type: 5, data: { flags: 64 } });
  assert.equal(await r.after, 'posted');
  assert.equal(FakeGateway.made.length, 1, 'her first post ever: connected once');
  assert.deepEqual(to('cdn').map((c) => c.url), [attachment().url]);
  const [post] = fake.posted;
  assert.equal(post.channel, TEAM_CHAT);
  assert.deepEqual(post.body, { content: 'a new pic 💜 @everyone', allowed_mentions: { parse: [] }, flags: 4, attachments: [{ id: 0, filename: 'agi1.png' }] });
  assert.equal(post.file.type, 'image/png');
  assert.equal(post.file.size, 4000);
  assert.equal(lastEdit().content, D.postDone(TEAM_CHAT));
  // no words: just the image
  await (await run(postCmd(), { now: T0 + 60_000 })).after;
  assert.equal(fake.posted.at(-1).body.content, '');
  // a command's image: Discord's "ephemeral-attachments" address
  const eph = await run(postCmd({ att: attachment({ url: `https://cdn.discordapp.com/ephemeral-attachments/${APP}/1/agi.png?ex=1&hm=secretsig` }) }), { now: T0 + 120_000 });
  assert.equal(await eph.after, 'posted');
  for (const [, line] of logs) assert.ok(!line.includes('secretsig'), "the image's signed address is never in a log line");
});

test("/post: what isn't an image, too big, a channel she can't see or in another server, an 18+ channel not marked age-restricted", async () => {
  process.env.DISCORD_BOT_TOKEN = BOT;
  fake.identified = true;
  // (a minute apart: the owner's commands have the same speed bumps as everyone's)
  let t = T0;
  const tick = () => ({ now: (t += 61_000) });
  const at = async (it) => (await run(it, tick())).response.data.content;
  assert.equal(await at(postCmd({ att: attachment({ content_type: 'application/pdf', filename: 'x.pdf' }) })), D.POST_NOT_IMAGE);
  assert.equal(await at(postCmd({ att: attachment({ size: 10 * 1024 * 1024 + 1 }) })), D.POST_TOO_BIG);
  assert.equal(await at(postCmd({ att: attachment({ url: 'https://evil.example/agi.png' }) })), D.POST_FAILED, "only Discord's own file address");
  assert.equal(await at(postCmd({ channel: 'general' })), D.POST_FAILED);
  assert.equal(calls.length, 0);
  const after = async (o, word, line) => {
    const r = await run(postCmd(o), tick());
    assert.equal(await r.after, word);
    assert.equal(lastEdit().content, line);
  };
  fake.channels = server();
  fake.noAccess.add(TEAM_CHAT);
  await after({}, 'post_no_access', D.postNoAccess(TEAM_CHAT));
  fake.noAccess.clear();
  await after({ channel: '1565999999999999999' }, 'post_no_access', D.postNoAccess('1565999999999999999'));
  fake.channels.push({ id: '1565888888888888888', type: 0, name: 'elsewhere', guild_id: OTHER_GUILD });
  await after({ channel: '1565888888888888888' }, 'post_no_access', D.postNoAccess('1565888888888888888'));
  // 🔞┃agi1-nsfw: only once Discord marks it age-restricted
  fake.channels.push({ id: NSFW, type: 0, name: '🔞┃agi1-nsfw', guild_id: GUILD, nsfw: false });
  await after({ channel: NSFW }, 'post_not_age_restricted', D.postNotAgeRestricted(NSFW));
  assert.equal(fake.posted.length, 0);
  fake.channels.at(-1).nsfw = true;
  await after({ channel: NSFW }, 'posted', D.postDone(NSFW));
  assert.equal(fake.posted.at(-1).channel, NSFW);
  for (const name of ['nsfw', 'agi1-NSFW', '18+ only', '🔞┃x']) assert.equal(TK.adultName(name), true, name);
  assert.equal(TK.adultName('🎨┃fan-art'), false);
  // not an image after all (its first bytes), or Discord refusing it
  fake.image = new TextEncoder().encode('<html>not a picture</html>');
  await after({}, 'post_not_image', D.POST_NOT_IMAGE);
  fake.image = png(4000);
  fake.noAccess.add('1565000000000000000');
  await after({}, 'posted', D.postDone(TEAM_CHAT));
  // what an image is
  assert.deepEqual(TK.imageKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0])), { ext: 'jpg', type: 'image/jpeg' });
  assert.deepEqual(TK.imageKind(new TextEncoder().encode('GIF89a......')), { ext: 'gif', type: 'image/gif' });
  assert.deepEqual(TK.imageKind(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')), { ext: 'webp', type: 'image/webp' });
  assert.equal(TK.imageKind(new Uint8Array([1, 2, 3])), null);
  for (const [, line] of logs) noToken(line);
});

test("who may: the owner (Administrator), the team (Manage Channels or Manage Messages)", () => {
  assert.equal(TK.isOwner(owner()), true);
  assert.equal(TK.isOwner(mod()), false);
  assert.equal(TK.isOwner({ permissions: 'not a number' }), false);
  assert.equal(TK.isTeam(mod()), true);
  assert.equal(TK.isTeam({ permissions: String(1n << 4n) }), true, 'Team: Manage Channels');
  assert.equal(TK.isTeam({ permissions: BASIC }), false);
  assert.equal(TK.isTeam(undefined), false);
  // a ticket's permissions: its category's, then theirs and her bot's (never twice)
  const list = TK.ticketOverwrites(category(), PERSON, APP);
  assert.equal(list.length, 5);
  assert.deepEqual(TK.ticketOverwrites({ permission_overwrites: [{ id: PERSON, type: 1, allow: '8', deny: '0' }] }, PERSON, APP).map((o) => [o.id, o.allow]), [[PERSON, String(TK.MEMBER_ALLOW)], [APP, String(TK.BOT_ALLOW)]], "never more than theirs");
  assert.equal(TK.MEMBER_ALLOW & TK.P.ADMINISTRATOR, 0n);
  assert.equal(TK.BOT_ALLOW & (TK.P.MANAGE_CHANNELS | TK.P.MANAGE_MESSAGES), 0n);
});
