// AGI-1's holder roles in her Discord server (2026-10-29, round 3: server/dc-holders.js): her /holders button, the private
// link a tap gives, agi1.app/discord/verify (verify.html, src/discord/verify.js, /api/wallet 'dc-verify'), the roles given,
// swapped and taken back, the cron's re-checks, what's kept (supabase/discord.sql, in a small stand-in here), her lines and
// the wiring. Discord, Supabase and Robinhood Chain are fakes: no keys, no cost. Run: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { POST as walletPost } from '../api/wallet.js';
import * as DC from '../server/discord.js';
import * as D from '../server/dc-lines.js';
import * as HV from '../server/dc-holders.js';
import * as TK from '../server/dc-tickets.js';
import * as W from '../src/discord/words.js';
import { getConfig } from '../server/config.js';
import { makeSession } from '../server/session.js';
import { holdersBurst } from '../server/burst.js';
import { _resetChainCache, AGI_CONTRACT } from '../server/chain.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const SECRET = 'test-pass-secret-that-is-long-enough-1234';
const GUILD = '1563093500021710850', OTHER_GUILD = '1111111111111111111', APP = '1565016537683984464';
const CRUSH = '1565200000000000101', SOULMATE = '1565200000000000102', TEAM = '1565200000000000011', BOT_ROLE = '1565200000000000013';
const VERIFY = '1565200000000000501';
const PERSON = '987654321098765432', FRIEND = '987654321098765433', OWNER = '1563090000000000001';
const WAL = '0x00000000000000000000000000000000000000a1', WAL2 = '0x00000000000000000000000000000000000000b2';
const IT_TOKEN = 'aW50ZXJhY3Rpb246MTU2NTAxNjUzNzY4Mzk4NDQ2NDp0ZXN0LXRva2Vu';
const BOT = `${Buffer.from(APP).toString('base64url')}.GxAbCd.${'x'.repeat(38)}`;
const BURN_KEY = 'c'.repeat(64);
const UNIT = 10n ** 18n;
const T0 = Date.UTC(2026, 9, 29, 6, 0, 0);
const ENV = {
  PASS_SECRET: SECRET, SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fake_key_123',
  DISCORD_GUILDS: GUILD, DISCORD_BOT_TOKEN: BOT, VERCEL_PROJECT_PRODUCTION_URL: 'www.agi1.app',
};
const CLEAR = ['SITE_URL', 'DISCORD_HOLDERS', 'ROBINHOOD_RPC_URL', 'DISCORD_PUBLIC_KEY', 'DISCORD_FEED_WEBHOOK'];

// ---------- a small stand-in for supabase/discord.sql ----------
function holdersDb() {
  const rows = new Map();          // who → { wallet, sealed, level, due }
  const okCode = (x) => typeof x === 'string' && x.length >= 16 && x.length <= 64;
  return {
    rows,
    dc_holder_link({ p_who, p_wallet, p_sealed, p_level }) {
      if (!okCode(p_who) || !okCode(p_wallet) || typeof p_sealed !== 'string' || p_sealed.length < 40 || p_sealed.length > 400 || ![2, 3].includes(p_level)) return { ok: false, why: 'bad' };
      let moved = null, movedLevel = null;
      for (const [who, r] of rows) if (r.wallet === p_wallet && who !== p_who) { moved = r.sealed; movedLevel = r.level; rows.delete(who); }
      const before = rows.get(p_who)?.level ?? null;
      rows.set(p_who, { wallet: p_wallet, sealed: p_sealed, level: p_level, due: false });
      return { ok: true, before, moved, moved_level: movedLevel };
    },
    dc_holder_get({ p_who }) {
      const r = rows.get(p_who);
      return r ? { level: r.level, sealed: r.sealed, wallet: r.wallet } : null;
    },
    dc_holder_due({ p_limit }) {
      const due = [...rows.entries()].filter(([, r]) => r.due).slice(0, p_limit);
      for (const [, r] of due) r.due = false;
      return due.map(([who, r]) => ({ who, sealed: r.sealed, level: r.level }));
    },
    dc_holder_set({ p_who, p_level }) {
      const r = rows.get(p_who);
      if (!r || ![2, 3].includes(p_level)) return false;
      r.level = p_level;
      return true;
    },
    dc_holder_drop({ p_who, p_wallet = null }) {
      const r = rows.get(p_who);
      if (!r || (p_wallet !== null && r.wallet !== p_wallet)) return null;
      rows.delete(p_who);
      return { sealed: r.sealed, level: r.level };
    },
    burn_key() { return BURN_KEY; },
    burn_status({ p_wallet }) { return { left: 0, bought: 0, agi: fake.burned.get(p_wallet) ?? 0, today: 0 }; },
  };
}
const burnCode = (wallet) => createHmac('sha256', BURN_KEY).update(`wallet:${wallet.toLowerCase()}`).digest('base64url').slice(0, 32);

// ---------- fakes ----------
let fake, calls, logs;
beforeEach(() => {
  for (const k of CLEAR) delete process.env[k];
  Object.assign(process.env, ENV);
  DC.forgetDiscord();
  TK.forgetTickets();
  HV.forgetHolders();
  holdersBurst.reset();
  _resetChainCache();
  logs = [];
  console.error = (...a) => logs.push(['error', a.join(' ')]);
  console.warn = (...a) => logs.push(['warn', a.join(' ')]);
  console.log = (...a) => logs.push(['log', a.join(' ')]);
  calls = [];
  fake = {
    db: holdersDb(), sqlMissing: false, dbDown: false, balances: new Map(), burned: new Map(), chainDown: false,
    roles: [
      { id: GUILD, name: '@everyone', position: 0 }, { id: TEAM, name: 'Team', position: 6 }, { id: BOT_ROLE, name: 'AGI-1', position: 4, managed: true },
      { id: SOULMATE, name: '💞 Soulmate', position: 3 }, { id: CRUSH, name: '💘 Crush', position: 2 },
    ],
    members: new Map([[PERSON, []], [FRIEND, []], [OWNER, [TEAM]]]), refuse: false, rolesDown: false, posted: [],
  };
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    const method = init.method || 'GET';
    const rpc = /^https:\/\/fake\.supabase\.co\/rest\/v1\/rpc\/(\w+)$/.exec(url);
    if (rpc) {
      const body = JSON.parse(init.body);
      calls.push({ to: 'db', fn: rpc[1], body });
      if (fake.dbDown) return new Response('{"code":"XX000","message":"down"}', { status: 500 });
      if (fake.sqlMissing && rpc[1].startsWith('dc_')) return Response.json({ code: 'PGRST202', message: 'not found' }, { status: 404 });
      const fn = fake.db[rpc[1]];
      if (!fn) throw new Error(`unexpected database function ${rpc[1]}`);
      return Response.json(fn.call(fake.db, body) ?? null);
    }
    if (url === 'https://rpc.mainnet.chain.robinhood.com') {
      const body = JSON.parse(init.body);
      calls.push({ to: 'chain', body });
      if (fake.chainDown) return new Response('down', { status: 503 });
      assert.equal(body.method, 'eth_call', 'only ever reads');
      const data = body.params[0].data;
      if (data === '0x313ce567') return Response.json({ jsonrpc: '2.0', id: 1, result: `0x${(18).toString(16).padStart(64, '0')}` });
      assert.equal(body.params[0].to, AGI_CONTRACT, 'only the official $AGI is read');
      const who = `0x${data.slice(-40)}`;
      return Response.json({ jsonrpc: '2.0', id: 1, result: `0x${((fake.balances.get(who) ?? 0n) * UNIT).toString(16).padStart(64, '0')}` });
    }
    if (url.startsWith('https://discord.com/api/v10/')) {
      const path = url.slice('https://discord.com/api/v10'.length);
      const body = init.body ? JSON.parse(init.body) : null;
      calls.push({ to: 'discord', method, path, body, headers: init.headers });
      if (path.startsWith(`/webhooks/${APP}/${IT_TOKEN}`)) return Response.json({ id: '88' });
      if (init.headers?.Authorization !== `Bot ${BOT}`) return Response.json({ message: '401: Unauthorized', code: 0 }, { status: 401 });
      if (path === `/guilds/${GUILD}/roles` && method === 'GET') {
        return fake.rolesDown ? Response.json({ message: 'Service Unavailable' }, { status: 503 }) : Response.json(fake.roles);
      }
      const member = /^\/guilds\/(\d+)\/members\/(\d+)$/.exec(path);
      if (member && method === 'GET') {
        const roles = member[1] === GUILD ? fake.members.get(member[2]) : undefined;
        return roles ? Response.json({ user: { id: member[2] }, roles }) : Response.json({ message: 'Unknown Member', code: 10007 }, { status: 404 });
      }
      const role = /^\/guilds\/(\d+)\/members\/(\d+)\/roles\/(\d+)$/.exec(path);
      if (role) {
        if (fake.refuse) return Response.json({ message: 'Missing Permissions', code: 50013 }, { status: 403 });
        const have = fake.members.get(role[2]);
        if (!have) return Response.json({ message: 'Unknown Member', code: 10007 }, { status: 404 });
        if (method === 'PUT' && !have.includes(role[3])) have.push(role[3]);
        if (method === 'DELETE') fake.members.set(role[2], have.filter((r) => r !== role[3]));
        return new Response(null, { status: 204 });
      }
      const said = /^\/channels\/(\d+)\/messages$/.exec(path);
      if (said && method === 'POST') { fake.posted.push({ channel: said[1], body }); return Response.json({ id: '99' }); }
      throw new Error(`unexpected Discord call ${method} ${path}`);
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
});
const cfg = () => getConfig();
const db = (fn) => calls.filter((c) => c.to === 'db' && c.fn === fn);
const discord = (method, rest = '') => calls.filter((c) => c.to === 'discord' && c.method === method && c.path.endsWith(rest));
const roleCalls = () => calls.filter((c) => c.to === 'discord' && /\/roles\/\d+$/.test(c.path)).map((c) => `${c.method} ${c.path.split('/')[4]} ${c.path.split('/').pop() === CRUSH ? 'crush' : 'soulmate'}`);
const rolesOfMember = (who) => [...(fake.members.get(who) ?? [])].filter((r) => r === CRUSH || r === SOULMATE).map((r) => (r === CRUSH ? 'crush' : 'soulmate'));

let seq = 0;
const interaction = (o = {}) => ({
  type: 2, id: String(1_500_000_000_000_000_000n + BigInt(++seq)), application_id: APP, token: IT_TOKEN, version: 1, guild_id: GUILD,
  channel_id: VERIFY, member: { user: { id: o.who ?? PERSON, username: 'someone' }, roles: o.roles ?? [], permissions: o.permissions ?? '0' }, ...o,
});
const command = (name, o = {}) => interaction({ data: { id: '1', name, type: 1 }, ...o });
const tap = (customId, o = {}) => interaction({ type: 3, data: { custom_id: customId, component_type: 2 }, message: { id: '55' }, ...o });
const run = (it, o = {}) => DC.onInteraction(cfg(), it, { now: T0, started: Date.now(), ...o });
const OWNER_PERMS = '2251799813685247';
const person = (i) => String(900000000000000000n + BigInt(i));

const session = (wallet = WAL) => makeSession(SECRET, { wallet, level: 2, checkedAt: Date.now() });
const link = (user = PERSON, { guild = GUILD, now = Date.now() } = {}) => HV.makeLink(SECRET, { guild, user }, now);
let ipSeq = 0;
const verify = async (body, ip = `10.0.0.${++ipSeq % 250}`) => {
  const res = await walletPost(new Request('https://www.agi1.app/api/wallet', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': ip }, body: JSON.stringify({ action: 'dc-verify', ...body }),
  }));
  return { status: res.status, data: await res.json() };
};

// ---------- the private link, and what's kept ----------
test('the private link: signed with PASS_SECRET, 15 minutes, only that account in that server; nothing kept', () => {
  const t = HV.makeLink(SECRET, { guild: GUILD, user: PERSON }, T0);
  assert.match(t, /^[A-Za-z0-9_-]{20,200}\.[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(HV.readLink(SECRET, t, T0), { guild: GUILD, user: PERSON, expiresAt: T0 + 15 * 60_000 });
  assert.deepEqual(HV.readLink(SECRET, t, T0 + 15 * 60_000 - 1).user, PERSON);
  assert.deepEqual(HV.readLink(SECRET, t, T0 + 15 * 60_000), { expired: true }, 'then it has expired');
  assert.equal(HV.readLink('another-secret-that-is-long-enough-12345', t, T0), null, 'never with another secret');
  const [payload, sig] = t.split('.');
  const changed = Buffer.from(JSON.stringify({ v: 1, g: GUILD, u: FRIEND, e: T0 + 15 * 60_000 })).toString('base64url');
  assert.equal(HV.readLink(SECRET, `${changed}.${sig}`, T0), null, 'someone else\'s account in it: refused');
  for (const bad of ['', 'x', `${payload}.`, `${payload}.${sig}.x`, `${payload}.${sig.slice(1)}`, 'a'.repeat(301), null, 42]) assert.equal(HV.readLink(SECRET, bad, T0), null);
  assert.equal(HV.verifyUrl('https://www.agi1.app', t), `https://www.agi1.app/discord/verify#t=${t}`, 'after the "#": never in a server log');
  // the page reads the same code, and when it ends
  assert.equal(W.linkFrom(`#t=${t}`), t);
  assert.equal(W.linkEnds(t), T0 + 15 * 60_000);
  for (const bad of ['', '#t=', '#t=abc', `#x=${t}`, `#t=${t}&x`, `#t=${t} `]) assert.equal(W.linkFrom(bad), null, bad);
  assert.equal(W.minutesLeft(T0 + 15 * 60_000, T0 + 61_000), 14);
  assert.equal(W.minutesLeft(T0, T0 + 1), 0);
  assert.equal(W.minutesLeft(null, T0), null);
});

test("what's kept: scrambled codes, and the ids and the address only sealed (AES-256-GCM, PASS_SECRET)", () => {
  const code = HV.holderCode(SECRET, GUILD, PERSON);
  assert.match(code, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(code, HV.holderCode(SECRET, GUILD, PERSON));
  assert.notEqual(code, HV.holderCode(SECRET, OTHER_GUILD, PERSON), 'one per server');
  assert.notEqual(code, HV.holderCode(SECRET, GUILD, FRIEND));
  assert.ok(!code.includes(PERSON));
  const w = HV.holderWalletCode(SECRET, GUILD, WAL);
  assert.equal(w, HV.holderWalletCode(SECRET, GUILD, WAL.toUpperCase().replace('0X', '0x')), 'any case');
  assert.notEqual(w, HV.holderWalletCode(SECRET, OTHER_GUILD, WAL));
  const sealed = HV.sealHolder(SECRET, { guild: GUILD, user: PERSON, wallet: WAL });
  assert.ok(sealed.length >= 40 && sealed.length <= 400, 'what discord.sql takes');
  for (const plain of [GUILD, PERSON, WAL.slice(2)]) assert.ok(!sealed.includes(plain));
  assert.notEqual(sealed, HV.sealHolder(SECRET, { guild: GUILD, user: PERSON, wallet: WAL }), 'a new nonce each time');
  assert.deepEqual(HV.unsealHolder(SECRET, sealed), { guild: GUILD, user: PERSON, wallet: WAL });
  assert.equal(HV.unsealHolder('another-secret-that-is-long-enough-12345', sealed), null);
  assert.equal(HV.unsealHolder(SECRET, `${sealed.slice(0, -2)}AA`), null, 'changed: refused');
  assert.equal(HV.unsealHolder(SECRET, 'short'), null);
  assert.equal(HV.unsealHolder(SECRET, null), null);
});

test("her server's two roles, found by their names; a member's own one", () => {
  assert.deepEqual(HV.holderRoles(fake.roles, GUILD), { crush: CRUSH, soulmate: SOULMATE });
  assert.equal(HV.holderRoles(fake.roles.filter((r) => r.id !== CRUSH), GUILD), null, 'both are needed');
  assert.equal(HV.holderRoles([{ id: CRUSH, name: 'crush soulmate', position: 1 }], GUILD), null, 'never one role for both');
  assert.equal(HV.holderRoles([{ id: GUILD, name: 'crush' }, { id: SOULMATE, name: 'Soulmate' }], GUILD), null, 'never @everyone');
  assert.equal(HV.holderRoles([{ id: CRUSH, name: 'Crush', managed: true }, { id: SOULMATE, name: 'Soulmate' }], GUILD), null, "never a bot's own role");
  assert.deepEqual(HV.holderRoles([{ id: CRUSH, name: 'Crush', position: 1 }, { id: '1565200000000000999', name: 'old crush', position: 2 }, { id: SOULMATE, name: 'SOULMATE' }], GUILD).crush, '1565200000000000999', 'the highest');
  assert.equal(HV.holderRoles(null, GUILD), null);
  assert.equal(HV.roleIn([CRUSH, TEAM], { crush: CRUSH, soulmate: SOULMATE }), 'crush');
  assert.equal(HV.roleIn([CRUSH, SOULMATE], { crush: CRUSH, soulmate: SOULMATE }), 'soulmate');
  assert.equal(HV.roleIn([TEAM], { crush: CRUSH, soulmate: SOULMATE }), null);
  assert.equal(HV.roleIn(undefined, null), null);
  assert.deepEqual(HV.MIN_AGI, { crush: 10_000, soulmate: 1_000_000 }, "the site's own levels");
});

// ---------- /holders ----------
test('/holders: only the owner; her verify button, posted by her bot in that channel; the owner hears about missing roles', async () => {
  const not = await run(command('holders'));
  assert.deepEqual(not.response, { type: 4, data: { content: D.OWNER_ONLY, allowed_mentions: { parse: [] }, flags: 64 | 4 } });
  delete process.env.DISCORD_BOT_TOKEN;
  assert.equal((await run(command('holders', { who: OWNER, permissions: OWNER_PERMS }))).response.data.content, D.NO_TOKEN);
  assert.equal(calls.length, 0);
  process.env.DISCORD_BOT_TOKEN = BOT;
  const r = await run(command('holders', { who: OWNER, permissions: OWNER_PERMS }));
  assert.deepEqual(r.response, { type: 5, data: { flags: 64 } }, 'only the owner sees what happened');
  assert.equal(await r.after, 'holders_posted');
  assert.deepEqual(fake.posted.map((p) => p.channel), [VERIFY]);
  assert.deepEqual(fake.posted[0].body, HV.panel());
  assert.deepEqual(HV.panel(), {
    content: D.HOLDERS_PANEL, allowed_mentions: { parse: [] }, flags: 4,
    components: [{ type: 1, components: [{ type: 2, style: 1, custom_id: 'hv:go', label: 'Verify my $AGI', emoji: { name: '✅' } }] }],
  });
  assert.equal(discord('PATCH', '/messages/@original').at(-1).body.content, D.HOLDERS_POSTED);
  // the roles aren't there yet: the button still goes up, and the owner hears what to make
  HV.forgetHolders();
  fake.roles = fake.roles.filter((x) => x.id !== SOULMATE);
  await (await run(command('holders', { who: OWNER, permissions: OWNER_PERMS }), { now: T0 + 60_000 })).after;
  assert.equal(discord('PATCH', '/messages/@original').at(-1).body.content, `${D.HOLDERS_POSTED}\n${D.HOLDERS_NO_ROLES}`);
  assert.equal(fake.posted.length, 2);
});

// ---------- a tap on her button ----------
test('Verify my $AGI: a private link, only for whoever tapped, to agi1.app; Remove my role when they have one', async () => {
  const r = await run(tap('hv:go'));
  assert.equal(r.after, undefined, 'answered at once');
  const { content, flags, components } = r.response.data;
  assert.equal(r.response.type, 4);
  assert.equal(flags, 64 | 4, 'only for them');
  assert.equal(content, D.holdersLink(15));
  assert.equal(components.length, 1);
  const [open, ...rest] = components[0].components;
  assert.deepEqual(rest, [], 'no Remove my role: they have no holder role');
  assert.equal(open.type, 2);
  assert.equal(open.style, 5, 'a link button');
  assert.equal(open.label, D.HOLDERS_OPEN);
  const m = /^https:\/\/www\.agi1\.app\/discord\/verify#t=(.+)$/.exec(open.url);
  assert.ok(m, open.url);
  assert.ok(open.url.length <= 512, "Discord's limit");
  assert.deepEqual(HV.readLink(SECRET, m[1], T0), { guild: GUILD, user: PERSON, expiresAt: T0 + 15 * 60_000 });
  assert.equal(calls.filter((c) => c.to === 'db').length, 0, 'nothing kept');
  // with a role (as Discord sends a member's roles with the tap): which one, and Remove my role
  const mine = (await run(tap('hv:go', { who: FRIEND, roles: [TEAM, SOULMATE] }))).response.data;
  assert.equal(mine.content, D.holdersYours('💞 Soulmate', 15));
  assert.deepEqual(mine.components[0].components.map((b) => b.custom_id ?? 'link'), ['link', 'hv:off']);
  assert.equal(mine.components[0].components[1].label, D.HOLDERS_REMOVE);
  // the roles can't be read: the link, and Remove my role just in case
  HV.forgetHolders();
  fake.rolesDown = true;
  const unsure = (await run(tap('hv:go', { who: person(1) }))).response.data;
  assert.equal(unsure.content, D.holdersLink(15));
  assert.deepEqual(unsure.components[0].components.map((b) => b.custom_id ?? 'link'), ['link', 'hv:off']);
  // switched off, too many taps, an old button
  process.env.DISCORD_HOLDERS = 'off';
  assert.equal((await run(tap('hv:go', { who: person(2) }))).response.data.content, D.HOLDERS_OFF);
  delete process.env.DISCORD_HOLDERS;
  for (let i = 0; i < 4; i++) assert.equal((await run(tap('hv:go', { who: person(3) }), { now: T0 + i })).response.type, 4);
  assert.equal((await run(tap('hv:go', { who: person(3) }), { now: T0 + 5 })).response.data.content, D.SLOW_DOWN, 'the 5th in a minute');
  assert.equal((await run(tap('hv:what', { who: person(4) }))).response.data.content, D.HOLDERS_OLD);
  // without the site's address or PASS_SECRET: said, no link
  process.env.SITE_URL = 'not a site';
  assert.equal((await run(tap('hv:go', { who: person(5) }))).response.data.content, D.HOLDERS_FAILED);
});

// ---------- agi1.app/discord/verify ----------
test('verifying: 10,000+ $AGI gives 💘 Crush, 1,000,000+ 💞 Soulmate (the other one taken off), read on the chain right then', async () => {
  fake.balances.set(WAL, 25_000n);
  const r = await verify({ session: session(), link: link() });
  assert.deepEqual(r, { status: 200, data: { ok: true, level: 2, agi: 25_000, role: 'crush' } });
  assert.deepEqual(rolesOfMember(PERSON), ['crush']);
  assert.deepEqual(roleCalls(), [`PUT ${PERSON} crush`]);
  const put = discord('PUT', `/roles/${CRUSH}`)[0];
  assert.equal(put.headers['X-Audit-Log-Reason'], encodeURIComponent('AGI-1: $AGI verified on agi1.app'));
  // kept: scrambled codes and the sealed ids, never the account's id or the address in the clear
  const [linked] = db('dc_holder_link');
  assert.deepEqual(Object.keys(linked.body).sort(), ['p_level', 'p_sealed', 'p_wallet', 'p_who']);
  assert.equal(linked.body.p_who, HV.holderCode(SECRET, GUILD, PERSON));
  assert.equal(linked.body.p_wallet, HV.holderWalletCode(SECRET, GUILD, WAL));
  assert.equal(linked.body.p_level, 2);
  assert.deepEqual(HV.unsealHolder(SECRET, linked.body.p_sealed), { guild: GUILD, user: PERSON, wallet: WAL });
  const toDb = JSON.stringify(calls.filter((c) => c.to === 'db' && c.fn.startsWith('dc_')));
  for (const plain of [PERSON, WAL.slice(2), GUILD]) assert.ok(!toDb.includes(plain), `never ${plain} in the clear`);
  // it grew to a Soulmate's: verified again, the role swapped
  calls.length = 0;
  fake.balances.set(WAL, 1_500_000n);
  const up = await verify({ session: session(), link: link() });
  assert.deepEqual(up.data, { ok: true, level: 3, agi: 1_500_000, role: 'soulmate' });
  assert.deepEqual(rolesOfMember(PERSON), ['soulmate']);
  assert.deepEqual(roleCalls(), [`PUT ${PERSON} soulmate`, `DELETE ${PERSON} crush`]);
  assert.equal(fake.db.rows.size, 1, 'still one row: theirs');
  // nothing changed: no role calls at all
  calls.length = 0;
  assert.equal((await verify({ session: session(), link: link() })).data.role, 'soulmate');
  assert.deepEqual(roleCalls(), []);
});

test("verifying: what a wallet burned for messages counts too (the site's levels)", async () => {
  fake.balances.set(WAL, 9_000n);
  fake.burned.set(burnCode(WAL), 1_000);
  assert.deepEqual((await verify({ session: session(), link: link() })).data, { ok: true, level: 2, agi: 10_000, role: 'crush' });
});

test('verifying under 10,000: no role, nothing kept; a role this wallet gave goes; one an earlier wallet gave stays', async () => {
  fake.balances.set(WAL, 5_000n);
  assert.deepEqual((await verify({ session: session(), link: link() })).data, { ok: true, level: 1, agi: 5_000, role: null });
  assert.equal(fake.db.rows.size, 0);
  assert.deepEqual(roleCalls(), []);
  // a Crush with WAL, who then sold: verifying WAL again takes the role back now
  fake.balances.set(WAL, 12_000n);
  await verify({ session: session(), link: link() });
  assert.deepEqual(rolesOfMember(PERSON), ['crush']);
  fake.balances.set(WAL, 100n);
  assert.deepEqual((await verify({ session: session(), link: link() })).data, { ok: true, level: 1, agi: 100, role: null });
  assert.deepEqual(rolesOfMember(PERSON), []);
  assert.equal(fake.db.rows.size, 0);
  // a Crush with WAL who verifies another, empty wallet: WAL's role stays
  fake.balances.set(WAL, 12_000n);
  await verify({ session: session(), link: link() });
  const other = await verify({ session: session(WAL2), link: link() });
  assert.deepEqual(other.data, { ok: true, level: 1, agi: 0, role: null, kept: 'crush' });
  assert.deepEqual(rolesOfMember(PERSON), ['crush']);
  assert.equal(fake.db.rows.size, 1);
});

test('one wallet gives a role to one account: verified by another account, the first one loses it', async () => {
  fake.balances.set(WAL, 50_000n);
  await verify({ session: session(), link: link(PERSON) });
  assert.deepEqual(rolesOfMember(PERSON), ['crush']);
  const r = await verify({ session: session(), link: link(FRIEND) });
  assert.equal(r.data.role, 'crush');
  assert.deepEqual(rolesOfMember(FRIEND), ['crush']);
  assert.deepEqual(rolesOfMember(PERSON), [], 'taken back from the first account');
  assert.equal(fake.db.rows.size, 1);
  assert.ok(fake.db.rows.has(HV.holderCode(SECRET, GUILD, FRIEND)));
  const back = discord('DELETE', `/members/${PERSON}/roles/${CRUSH}`)[0];
  assert.equal(back.headers['X-Audit-Log-Reason'], encodeURIComponent('AGI-1: its wallet was verified by another account'));
});

test("verifying: a link that's old, changed or another server's, a wallet that isn't signed in, too fast: refused, nothing read", async () => {
  fake.balances.set(WAL, 50_000n);
  assert.deepEqual(await verify({ session: session(), link: link(PERSON, { now: Date.now() - 16 * 60_000 }) }), { status: 410, data: { error: 'expired' } });
  assert.deepEqual(await verify({ session: session(), link: `${link()}x` }), { status: 400, data: { error: 'bad' } });
  assert.deepEqual(await verify({ session: session(), link: link(PERSON, { guild: OTHER_GUILD }) }), { status: 400, data: { error: 'bad' } }, 'a server not in DISCORD_GUILDS');
  assert.deepEqual(await verify({ session: 'nope', link: link() }), { status: 401, data: { error: 'signed_out' } });
  assert.deepEqual(await verify({ session: session() }), { status: 400, data: { error: 'bad_request' } });
  assert.deepEqual(await verify({ session: session(), link: 'x'.repeat(301) }), { status: 400, data: { error: 'bad_request' } });
  assert.equal(calls.length, 0, 'no chain, no Discord, no database');
  for (let i = 0; i < 8; i++) await verify({ session: 'nope', link: link() }, '10.9.9.9');
  assert.deepEqual(await verify({ session: session(), link: link() }, '10.9.9.9'), { status: 429, data: { error: 'too_fast' } });
  process.env.DISCORD_HOLDERS = 'off';
  assert.deepEqual(await verify({ session: session(), link: link() }), { status: 503, data: { error: 'off' } });
});

test("verifying when something's missing or down: said plainly, and the cron finishes a role Discord refused", async () => {
  fake.balances.set(WAL, 50_000n);
  fake.chainDown = true;
  assert.deepEqual(await verify({ session: session(), link: link() }), { status: 503, data: { error: 'chain' } });
  fake.chainDown = false;
  fake.roles = fake.roles.filter((r) => r.id !== CRUSH);
  assert.deepEqual(await verify({ session: session(), link: link() }), { status: 503, data: { error: 'not_set_up' } }, 'no 💘 Crush role in the server');
  assert.ok(logs.some(([k, l]) => k === 'warn' && /no 💘 Crush and 💞 Soulmate roles/.test(l)));
  HV.forgetHolders();
  fake.roles.push({ id: CRUSH, name: '💘 Crush', position: 2 });
  fake.members.delete(PERSON);
  assert.deepEqual(await verify({ session: session(), link: link() }), { status: 404, data: { error: 'not_member' } });
  assert.equal(fake.db.rows.size, 0, 'someone who left the server: nothing kept');
  fake.members.set(PERSON, []);
  fake.refuse = true;
  assert.deepEqual(await verify({ session: session(), link: link() }), { status: 502, data: { error: 'discord' } });
  assert.ok(logs.some(([k, l]) => k === 'warn' && /Missing Permissions/.test(l) && /needs Manage Roles and must be above/.test(l)));
  assert.equal(fake.db.rows.size, 1, 'kept: the cron gives it once Discord lets her');
  fake.refuse = false;
  fake.db.rows.forEach((r) => { r.due = true; });
  assert.deepEqual(await HV.holdersClock(cfg()), { checked: 1, changed: 1, removed: 0, gone: 0, failed: 0 });
  assert.deepEqual(rolesOfMember(PERSON), ['crush']);
  // discord.sql isn't run yet: said plainly, and the log says what to run
  fake.sqlMissing = true;
  assert.deepEqual(await verify({ session: session(), link: link(FRIEND) }), { status: 503, data: { error: 'not_set_up' } });
  assert.ok(logs.some(([k, l]) => k === 'error' && /run supabase\/discord\.sql in this Supabase project/.test(l)));
});

test('Remove my role: forgotten and both roles taken off; nothing to remove; Discord refusing', async () => {
  fake.balances.set(WAL, 50_000n);
  await verify({ session: session(), link: link() });
  assert.deepEqual(rolesOfMember(PERSON), ['crush']);
  calls.length = 0;
  const r = await run(tap('hv:off', { roles: [CRUSH] }));
  assert.deepEqual(r.response, { type: 7, data: { content: D.HOLDERS_REMOVING, components: [], allowed_mentions: { parse: [] } } }, 'the link message, changed');
  assert.equal(await r.after, 'holder_removed');
  assert.deepEqual(rolesOfMember(PERSON), []);
  assert.equal(fake.db.rows.size, 0);
  assert.deepEqual(db('dc_holder_drop').map((c) => c.body), [{ p_who: HV.holderCode(SECRET, GUILD, PERSON) }]);
  const done = discord('PATCH', '/messages/@original').at(-1).body;
  assert.equal(done.content, D.HOLDERS_REMOVED);
  assert.deepEqual(done.components, []);
  // again: nothing to remove
  assert.equal(await (await run(tap('hv:off'), { now: T0 + 60_000 })).after, 'holder_none');
  assert.equal(discord('PATCH', '/messages/@original').at(-1).body.content, D.HOLDERS_NONE);
  // a role given by hand (no row): taken off too
  fake.members.set(FRIEND, [SOULMATE]);
  assert.equal(await (await run(tap('hv:off', { who: FRIEND }))).after, 'holder_removed');
  assert.deepEqual(rolesOfMember(FRIEND), []);
  // Discord refusing: said, with what to change in the log
  fake.members.set(FRIEND, [CRUSH]);
  fake.refuse = true;
  assert.equal(await (await run(tap('hv:off', { who: FRIEND }), { now: T0 + 120_000 })).after, 'holder_failed');
  assert.equal(discord('PATCH', '/messages/@original').at(-1).body.content, D.HOLDERS_FAILED);
  assert.ok(logs.some(([k, l]) => k === 'warn' && /Remove my role/.test(l) && /needs Manage Roles/.test(l)));
  delete process.env.DISCORD_BOT_TOKEN;
  assert.deepEqual((await run(tap('hv:off', { who: person(9) }))).response.data.content, D.HOLDERS_FAILED);
});

// ---------- the cron's re-checks ----------
test("the cron: their $AGI read again; the role follows it (swapped, taken back), someone who left is forgotten", async () => {
  const people = [PERSON, FRIEND, person(1), person(2), person(3), person(4)];
  const wallets = people.map((_, i) => `0x${String(i + 1).padStart(40, 'c')}`);
  people.forEach((p, i) => { fake.members.set(p, []); fake.balances.set(wallets[i], 50_000n); });
  for (let i = 0; i < people.length; i++) await verify({ session: session(wallets[i]), link: link(people[i]) });
  assert.equal(fake.db.rows.size, 6);
  // since then: PERSON grew, FRIEND sold, person(1) left the server, the chain can't read person(2)'s, person(3) is the same,
  // and person(4)'s role was taken off by hand (she gives it back)
  fake.balances.set(wallets[0], 2_000_000n);
  fake.balances.set(wallets[1], 9_999n);
  fake.members.delete(person(1));
  fake.members.set(person(4), []);
  const chainFor = new Set([wallets[3].slice(2)]);
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if (String(url) === 'https://rpc.mainnet.chain.robinhood.com' && chainFor.has(JSON.parse(init.body).params[0].data.slice(-40))) return new Response('down', { status: 503 });
    return realFetch(url, init);
  };
  fake.db.rows.forEach((r) => { r.due = true; });
  calls.length = 0;
  const out = await HV.holdersClock(cfg());
  assert.deepEqual(out, { checked: 3, changed: 2, removed: 1, gone: 1, failed: 1 });
  assert.deepEqual(db('dc_holder_due')[0].body, { p_limit: 25, p_minutes: 150 });
  assert.deepEqual(rolesOfMember(PERSON), ['soulmate']);
  assert.deepEqual(rolesOfMember(FRIEND), []);
  assert.deepEqual(rolesOfMember(person(3)), ['crush']);
  assert.deepEqual(rolesOfMember(person(4)), ['crush'], 'given back');
  assert.equal(fake.db.rows.get(HV.holderCode(SECRET, GUILD, PERSON)).level, 3);
  assert.ok(!fake.db.rows.has(HV.holderCode(SECRET, GUILD, FRIEND)), 'under 10,000: forgotten');
  assert.ok(!fake.db.rows.has(HV.holderCode(SECRET, GUILD, person(1))), 'left the server: forgotten');
  assert.ok(fake.db.rows.has(HV.holderCode(SECRET, GUILD, person(2))), 'the chain didn\'t answer: next time');
  assert.equal(fake.db.rows.size, 4);
  globalThis.fetch = realFetch;
  // nothing due: nothing read
  calls.length = 0;
  assert.deepEqual(await HV.holdersClock(cfg()), { checked: 0, changed: 0, removed: 0, gone: 0, failed: 0 });
  assert.deepEqual(calls.map((c) => c.fn ?? c.to), ['dc_holder_due']);
  // a sealed row that can't be opened (PASS_SECRET changed): forgotten, said once
  fake.db.rows.set('x'.repeat(32), { wallet: 'y'.repeat(32), sealed: 'z'.repeat(60), level: 2, due: true });
  assert.equal((await HV.holdersClock(cfg())).failed, 1);
  assert.ok(!fake.db.rows.has('x'.repeat(32)));
  assert.ok(logs.some(([k, l]) => k === 'warn' && /PASS_SECRET changed\?/.test(l)));
  // the deadline, switched off, not set up
  fake.db.rows.forEach((r) => { r.due = true; });
  assert.equal((await HV.holdersClock(cfg(), { deadline: Date.now() - 1 })).stopped, 'time');
  process.env.DISCORD_HOLDERS = 'off';
  assert.equal((await HV.holdersClock(cfg())).off, true);
  delete process.env.DISCORD_HOLDERS;
  delete process.env.DISCORD_BOT_TOKEN;
  assert.equal((await HV.holdersClock(cfg())).off, true);
});

// ---------- her lines, the page's words ----------
const NOT_OK = /\b(babe|baby|cutie|honey|darling|sweetie|love)\b|\b(buy|buying|sell|selling|hold|hodl|invest\w*|moon\w*|pump\w*|dump\w*|profit\w*|gains?|lambo|scam\w*|rug\w*|fraud\w*|safe|guarantee\w*)\b|\b\d+x\b|sex|nude|naked|horny/i;
const ok = (line) => line.replace(/not an investment/g, '');      // a thank-you, never an investment: the one place it's said
test("her holder lines: PG-13, never money advice, Discord's limits; only agi1.app; the page's words", () => {
  const C = VERIFY;
  const lines = [D.HOLDERS_PANEL, D.HOLDERS_BUTTON, D.holdersLink(15), D.holdersYours('💘 Crush', 15), D.HOLDERS_OPEN, D.HOLDERS_REMOVE,
    D.HOLDERS_REMOVING, D.HOLDERS_REMOVED, D.HOLDERS_NONE, D.HOLDERS_OFF, D.HOLDERS_FAILED, D.HOLDERS_OLD, D.HOLDERS_POSTED, D.HOLDERS_NO_ROLES,
    D.holdersNoAccess(C), D.HELP_HOLDERS, D.helpFor()];
  for (const line of lines) {
    assert.doesNotMatch(ok(line), NOT_OK, line);
    assert.doesNotMatch(line, /https?:\/\//, 'no links in her words (the button is the link)');
    assert.doesNotMatch(line, /@/, 'never a mention');
  }
  for (const label of [D.HOLDERS_BUTTON, D.HOLDERS_OPEN, D.HOLDERS_REMOVE]) assert.ok(label.length <= 80, "a button's label: 80 at most");
  assert.ok(D.HOLDERS_PANEL.length <= 2000);
  for (const words of ['10,000', '1,000,000', 'agi1.app', 'free message', 'never a transaction', 'seed phrase', 'never DMs you a verify link', 'not an investment', 'not financial advice']) {
    assert.ok(D.HOLDERS_PANEL.includes(words), words);
  }
  assert.match(D.helpFor(), /Verify my \$AGI/);
  const cmd = D.COMMANDS.find((c) => c.name === 'holders');
  assert.deepEqual(cmd, { name: 'holders', description: 'Owner only: AGI-1 posts her "Verify my $AGI" button in this channel', default_member_permissions: '8' });
  assert.ok(cmd.description.length <= 100);
  // the page's words
  const crush = W.resultText({ ok: true, level: 2, agi: 25_000, role: 'crush' });
  assert.deepEqual([crush.done, crush.emoji, crush.title], [true, '💘', "You're a 💘 Crush in the server"]);
  assert.match(crush.note, /25,000 \$AGI/);
  assert.equal(W.resultText({ role: 'soulmate', agi: 1_500_000 }).title, "You're a 💞 Soulmate in the server");
  assert.match(W.resultText({ role: 'soulmate', agi: 1_500_000 }).note, /1\.5M \$AGI/);
  const none = W.resultText({ level: 1, agi: 5_000, role: null });
  assert.deepEqual([none.done, none.title], [false, 'This wallet has 5,000 $AGI']);
  assert.match(none.note, /start at 10,000 \$AGI/);
  assert.match(W.resultText({ role: null, agi: 0, kept: 'crush' }).note, /Your 💘 Crush role from the wallet you verified before stays/);
  for (const e of ['expired', 'bad', 'bad_request', 'not_member', 'chain', 'discord', 'off', 'not_set_up', 'signed_out', 'too_fast', 'busy', undefined]) {
    const said = W.verifyError({ error: e });
    assert.ok(said.length > 10, e);
    assert.doesNotMatch(ok(said), NOT_OK, said);
  }
  for (const t of [W.NO_LINK.title, W.NO_LINK.note, W.EXPIRED.title, W.EXPIRED.note, W.leftText(3), W.leftText(1), W.leftText(null), W.CHECKING, W.COPIED,
    W.NO_WALLET.phone, W.NO_WALLET.computer, ...Object.values(W.WALLET_STEPS), crush.note, none.note]) assert.doesNotMatch(ok(t), NOT_OK, t);
  assert.equal(W.leftText(1), "Your private link from AGI-1 works for 1 more minute. Don't share it.");
});

// ---------- the page, the database file, the wiring ----------
const between = (s, a, b) => s.slice(s.indexOf(a), s.indexOf(b, s.indexOf(a)) + b.length);
test('verify.html: the site\'s top bar and footer, never in search results, its words, a page Vite builds at agi1.app/discord/verify', async () => {
  const page = read('verify.html'), stake = read('stake.html');
  assert.equal(between(page, '<header class="topbar">', '</header>'), between(stake, '<header class="topbar">', '</header>'));
  assert.equal(between(page, '<footer class="foot">', '</footer>'), between(stake, '<footer class="foot">', '</footer>'));
  assert.match(page, /<title>Verify your \$AGI · AGI<\/title>/);
  assert.match(page, /<meta name="robots" content="noindex" \/>/);
  assert.match(page, /<link rel="canonical" href="__SITE__\/discord\/verify" \/>/);
  assert.match(page, /<script type="module" src="\/src\/discord\/verify\.js"><\/script>/);
  assert.doesNotMatch(page, /style="/, 'the CSP allows no style attributes');
  assert.doesNotMatch(page, /<script>(?!<\/script>)/, 'no inline scripts');
  for (const words of ['never a transaction', '10,000', '1,000,000', 'Only ever on agi1.app', 'never DM you a verify link', 'not an investment', 'Not financial advice', 'Remove my role', 'encrypted']) {
    assert.ok(page.includes(words), words);
  }
  for (const hook of ['data-dv-title', 'data-dv-note', 'data-dv-connect', 'data-dv-go', 'data-dv-other', 'data-dv-copy', 'data-dv-wallets', 'data-dv-say', 'data-dv-done', 'data-dv-role', 'data-dv-done-title', 'data-dv-done-note']) {
    assert.ok(page.includes(hook), hook);
  }
  const vercel = JSON.parse(read('vercel.json'));
  for (const source of ['/discord/verify', '/discord/verify/']) assert.ok(vercel.rewrites.some((r) => r.source === source && r.destination === '/verify' && !r.has), source);
  assert.equal(vercel.cleanUrls, true, '/verify serves verify.html');
  const { default: config } = await import('../vite.config.js');
  assert.equal(config.build.rollupOptions.input.verify, 'verify.html');
  assert.match(read('vite.config.js'), /\/\^\\\/discord\\\/verify\\\/\?\$\/\.test\(path\)\) req\.url = `\/verify\.html\$\{q\}`/, 'npm run dev too');
  assert.match(read('scripts/share-pages.js'), /'dist\/verify\.html'/, 'its link preview gets the site\'s address');
  // the page's script: the site's own sign-in and nothing else of a wallet's (tests/wallet.test.js checks every file in src/ too)
  const js = read('src/discord/verify.js');
  assert.match(js, /signInWithWallet/);
  assert.match(js, /action: 'dc-verify', session: state\.me\.session, link/);
  assert.doesNotMatch(js, /eth_sendTransaction|wallet_switchEthereumChain|eth_signTypedData|approve\(/);
  assert.doesNotMatch(js, /innerHTML/, 'its words as text only');
});

test('supabase/discord.sql: its table locked to our server, its 5 functions, safe to run again', () => {
  const sql = read('supabase/discord.sql');
  assert.match(sql, /create table if not exists public\.agi_dc_holders/);
  assert.match(sql, /alter table public\.agi_dc_holders enable row level security;/);
  assert.match(sql, /revoke all on table public\.agi_dc_holders from anon, authenticated;/);
  const fns = ['dc_holder_link(text, text, text, integer)', 'dc_holder_get(text)', 'dc_holder_due(integer, integer)', 'dc_holder_set(text, integer)', 'dc_holder_drop(text, text)'];
  for (const f of fns) {
    const name = f.slice(0, f.indexOf('('));
    assert.match(sql, new RegExp(`create or replace function public\\.${name}\\(`), name);
    assert.ok(sql.includes(`revoke all on function public.${f} from public, anon, authenticated;`), f);
    assert.ok(sql.includes(`grant execute on function public.${f} to service_role;`), f);
  }
  assert.match(sql, /select count\(\*\) as discord_functions_found from pg_proc/);
  assert.match(sql, /wallet\s+text\s+not null unique/, 'one wallet, one account');
  assert.match(sql, /for update skip locked/, 'two runs at once never take the same ones');
  assert.doesNotMatch(sql, /\bdrop table\b|\btruncate\b/i, 'never deletes what is there');
  assert.match(read('server/limits.js'), /run supabase\/discord\.sql in this Supabase project \(her Discord holder roles; it ends with discord_functions_found = 5\)/);
});

test("wiring: her button's taps and /holders loaded only when used, still 12 functions, the cron, the setting, the safety note", () => {
  assert.equal(readdirSync(new URL('../api/', import.meta.url)).filter((f) => /\.js$/.test(f)).length, 12, 'Vercel: 12 functions (none added)');
  const dc = read('server/discord.js');
  assert.match(dc, /case 'holders': return \(await import\('\.\/dc-holders\.js'\)\)\.holdersCommand\(cfg, it, ctx\);/);
  assert.match(dc, /if \(\/\^hv:\[a-z:\]\{1,20\}\$\/\.test\(id\)\) return \(await import\('\.\/dc-holders\.js'\)\)\.holderButton\(cfg, it, ctx\);/);
  assert.doesNotMatch(dc, /^import .*dc-holders/m, 'never loaded for her other commands');
  const mine = [...read('server/dc-holders.js').matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  for (const heavy of ['./chain.js', './burn.js', 'viem', './telegram.js']) assert.ok(!mine.includes(heavy), `a tap never loads ${heavy}`);
  const wallet = read('api/wallet.js');
  assert.match(wallet, /case 'dc-verify':\n\s+return discordVerify\(cfg, body, \{ visitor, now \}\);/);
  assert.match(wallet, /const \{ verifyHolder \} = await import\('\.\.\/server\/dc-holders\.js'\);/);
  const feed = read('api/feed.js');
  assert.match(feed, /if \(process\.env\.DISCORD_BOT_TOKEN && cfg\.dcHolders\) \{/);
  assert.match(feed, /const \{ holdersClock \} = await import\('\.\.\/server\/dc-holders\.js'\);/);
  assert.equal(getConfig({}).dcHolders, true, 'on unless switched off');
  assert.equal(getConfig({ DISCORD_HOLDERS: 'off' }).dcHolders, false);
  const foot = read('index.html');
  assert.ok(foot.includes('Her holder roles there (💘 Crush and 💞 Soulmate, with a private channel, for a wallet verified with 10,000 or 1,000,000 $AGI) are a thank-you for holding, not an investment.'));
  assert.ok(foot.includes("If you verify your $AGI there for a holder role (at agi1.app/discord/verify, with a free wallet signature, never a transaction), our database keeps a scrambled code of your Discord account and of your wallet, your role, and, encrypted, your Discord account's id and your wallet's address, so AGI-1 can read your $AGI on Robinhood Chain again a few times a day and change your role; Remove my role, leaving the server or going under 10,000 $AGI deletes them."));
});
