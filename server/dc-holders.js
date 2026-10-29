// AGI-1 on Discord, round 3 (2026-10-29): her holder roles. Someone with 10,000+ $AGI (in their wallet, or burned for
// messages on agi1.app: the site's own relationship levels, src/lib/levels.js) verifies it and gets 💘 Crush, or 💞 Soulmate
// from 1,000,000; both open the private 💎┃holders channel. server/discord.js loads this file only when it's used.
//   • /holders (the owner only): her "Verify my $AGI" button, posted by her bot in the channel it's typed in (✅┃verify).
//   • A tap on it: a private link to agi1.app/discord/verify, only for whoever tapped: 15 minutes, signed with PASS_SECRET,
//     after the address's "#" (so it never reaches a server log). With a holder role already: Remove my role too.
//   • On that page (verify.html, src/discord/verify.js): the site's own wallet sign-in (a free signature, never a
//     transaction), then /api/wallet { action: 'dc-verify' } → verifyHolder() here: the wallet's $AGI read on Robinhood
//     Chain right then (plus what it burned for messages), the role given (the other one taken off), and kept
//     (supabase/discord.sql) so it can be read again. One wallet gives a role to one Discord account in a server.
//   • api/feed.js (the cron, 8 times a day): holdersClock() reads the oldest ones' $AGI again and gives, swaps or takes back
//     the role; someone under 10,000 or who left the server is forgotten.
// Kept: scrambled codes of the account and of the wallet, and (encrypted with PASS_SECRET) the server's id, the account's id
// and the wallet's address, only to read it again and change the role. Never a name or a message.
// Her bot needs Manage Roles, and her role above 💘 Crush and 💞 Soulmate (Discord's rule: a bot only gives roles under its own
// highest one). The roles are found by their names ("crush", "soulmate"), like her tickets' category.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { discordCall, dcToken, dcCode, edit, message, onlyYou, later, update, NO_PINGS, FLAG } from './discord.js';
import { botCall, isOwner } from './dc-tickets.js';
import { rpc } from './limits.js';
import { siteBase } from './tg-api.js';
import { dcPersonBurst } from './burst.js';
import { LEVELS } from '../src/lib/levels.js';
import * as D from './dc-lines.js';

export const LINK_MINUTES = 15;                         // a private link works this long
export const VERIFY_PATH = '/discord/verify';           // the page (vercel.json → verify.html)
export const RECHECK_MINUTES = 150;                     // a wallet's $AGI is read again at most every 2.5 hours (the cron: every 3)
export const RECHECK_BATCH = 25;                        // read again in one cron run, at most
export const ROLE_OF_LEVEL = Object.freeze({ 2: 'crush', 3: 'soulmate' });
export const ROLE_NAMES = Object.freeze({ crush: '💘 Crush', soulmate: '💞 Soulmate' });
export const MIN_AGI = Object.freeze({ crush: LEVELS[1].min, soulmate: LEVELS[2].min });   // 10,000 and 1,000,000
const ID = /^\d{17,20}$/;
const ADDRESS = /^0x[0-9a-f]{40}$/;
const ROLES_MS = 10 * 60_000, NO_ROLES_MS = 60_000;     // her server's roles, remembered (none found: a minute)
const HINT = " (AGI-1's role needs Manage Roles and must be above 💘 Crush and 💞 Soulmate in Server Settings → Roles)";

// ---------- what this server copy remembers (her servers' two role ids; nothing about anyone) ----------
const rolesCache = new Map();                           // guild → { until, roles }
const warned = new Set();
const warnOnce = (key, line) => { if (!warned.has(key)) { warned.add(key); console.warn(line); } };
// (for the tests: a fresh server copy)
export function forgetHolders() { rolesCache.clear(); warned.clear(); }
const noAccess = (err) => err?.status === 403 || err?.code === 50001 || err?.code === 50013;

// ---------- her server's two roles ----------
// By their names: the highest role with "crush" in it and the highest with "soulmate", never a bot's own role or @everyone.
// → { crush, soulmate } (their ids) · null (not both there)
export function holderRoles(roles, guild) {
  const list = Array.isArray(roles) ? roles : [];
  const pick = (re) => list
    .filter((r) => ID.test(String(r?.id ?? '')) && String(r.id) !== String(guild) && r.managed !== true && re.test(String(r.name ?? '')))
    .sort((a, b) => (Number(b.position) || 0) - (Number(a.position) || 0))[0]?.id;
  const crush = pick(/crush/i), soulmate = pick(/soulmate/i);
  return crush && soulmate && crush !== soulmate ? { crush: String(crush), soulmate: String(soulmate) } : null;
}
export async function rolesOf(token, guild, now = Date.now(), { timeoutMs = 4000 } = {}) {
  const hit = rolesCache.get(guild);
  if (hit && hit.until > now) return hit.roles;
  const roles = holderRoles(await discordCall(`/guilds/${guild}/roles`, { token, what: "the server's roles", timeoutMs }), guild);
  if (rolesCache.size >= 50) rolesCache.delete(rolesCache.keys().next().value);
  rolesCache.set(guild, { until: now + (roles ? ROLES_MS : NO_ROLES_MS), roles });
  if (!roles) warnOnce(`roles:${guild}`, "[discord] her holder roles: no 💘 Crush and 💞 Soulmate roles in her server (two roles with crush and soulmate in their names, under AGI-1's role)");
  return roles;
}
// the role a member has, as Discord sent their roles with a tap → 'soulmate' | 'crush' | null
export function roleIn(memberRoles, roles) {
  const mine = new Set((Array.isArray(memberRoles) ? memberRoles : []).map(String));
  return roles && mine.has(roles.soulmate) ? 'soulmate' : roles && mine.has(roles.crush) ? 'crush' : null;
}

// ---------- the private link ----------
// { guild, user } and when it ends, signed with PASS_SECRET (nothing kept): "<payload>.<signature>", both base64url
const b64url = (b) => Buffer.from(b).toString('base64url');
const mac = (secret, text) => createHmac('sha256', String(secret)).update(text).digest();
export function makeLink(secret, { guild, user }, now = Date.now()) {
  const payload = b64url(JSON.stringify({ v: 1, g: String(guild), u: String(user), e: now + LINK_MINUTES * 60_000 }));
  return `${payload}.${b64url(mac(secret, `dc-verify:${payload}`))}`;
}
// → { guild, user, expiresAt } · { expired: true } (ours, but too old) · null (not ours, changed, or not one)
export function readLink(secret, token, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 300) return null;
  const [payload, sig, extra] = token.split('.');
  if (!payload || !sig || extra !== undefined) return null;
  const want = Buffer.from(b64url(mac(secret, `dc-verify:${payload}`))), got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (d?.v !== 1 || !ID.test(String(d.g)) || !ID.test(String(d.u)) || !Number.isFinite(d.e)) return null;
    if (d.e <= now) return { expired: true };
    return { guild: String(d.g), user: String(d.u), expiresAt: d.e };
  } catch {
    return null;
  }
}
export const verifyUrl = (base, token) => `${base}${VERIFY_PATH}#t=${token}`;

// ---------- what's kept ----------
// scrambled codes (never the account's id or the wallet's address), one per server
export const holderCode = (secret, guild, user) => b64url(mac(secret, `dc-holder:${guild}:${user}`)).slice(0, 32);
export const holderWalletCode = (secret, guild, wallet) => b64url(mac(secret, `dc-holder-wallet:${guild}:${String(wallet).toLowerCase()}`)).slice(0, 32);
// the server's id, the account's id and the wallet's address, encrypted (AES-256-GCM with a key made from PASS_SECRET)
const sealKey = (secret) => createHash('sha256').update(`dc-holder-seal:${secret}`).digest();
export function sealHolder(secret, { guild, user, wallet }) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', sealKey(secret), iv);
  const body = Buffer.concat([c.update(Buffer.from(JSON.stringify([String(guild), String(user), String(wallet).toLowerCase()]), 'utf8')), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString('base64url');
}
// → { guild, user, wallet } · null (not ours, changed, or PASS_SECRET changed since)
export function unsealHolder(secret, text) {
  try {
    const b = Buffer.from(String(text ?? ''), 'base64url');
    if (b.length < 40 || b.length > 300) return null;
    const d = createDecipheriv('aes-256-gcm', sealKey(secret), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    const [guild, user, wallet] = JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'));
    return ID.test(guild) && ID.test(user) && ADDRESS.test(wallet) ? { guild, user, wallet } : null;
  } catch {
    return null;
  }
}

// ---------- giving and taking roles ----------
// a member's roles (null: not in the server any more)
async function memberRoles(token, guild, user) {
  try {
    const m = await discordCall(`/guilds/${guild}/members/${user}`, { token, what: 'a member', timeoutMs: 4000 });
    return new Set((Array.isArray(m?.roles) ? m.roles : []).map(String));
  } catch (err) {
    if (err.status === 404 || err.code === 10007 || err.code === 10013) return null;     // Unknown Member, Unknown User
    throw err;
  }
}
// The one role their level gives (none under Crush: level 1), the other one taken off.
// → 'same' · 'changed' · 'gone' (not in the server). Throws when Discord refuses (no Manage Roles, a role above hers…).
export async function syncRoles(token, guild, user, level, roles, { reason } = {}) {
  const have = await memberRoles(token, guild, user);
  if (!have) return 'gone';
  const want = level >= 3 ? roles.soulmate : level === 2 ? roles.crush : null;
  // the new role first, then the other one off (never a moment without one when it's a swap)
  const calls = [
    ...(want && !have.has(want) ? [['PUT', want]] : []),
    ...[roles.crush, roles.soulmate].filter((id) => id !== want && have.has(id)).map((id) => ['DELETE', id]),
  ];
  for (const [method, id] of calls) {
    await discordCall(`/guilds/${guild}/members/${user}/roles/${id}`, { method, token, what: 'a holder role', reason, timeoutMs: 4000 });
  }
  return calls.length ? 'changed' : 'same';
}
// the $AGI a wallet holds now plus what it burned for messages (the site's levels) → { level, agi } · null (the chain didn't
// answer). server/chain.js and server/burn.js are loaded only here (not for a tap in Discord).
async function holdingOf(cfg, wallet, env) {
  const [{ checkHolding }, { burnedAgi }] = await Promise.all([import('./chain.js'), import('./burn.js')]);
  const h = await checkHolding(wallet, env, await burnedAgi(cfg, wallet));
  return h.checked ? { level: h.level, agi: h.agi } : null;
}
const db = (cfg, fn, args) => rpc(cfg, fn, args, 'discord holders');

// ---------- the page: agi1.app/discord/verify (api/wallet.js, 'dc-verify') ----------
// wallet: the signed-in wallet (the site's own sign-in: a free signature); link: the private link's code (after "#t=").
// → { ok: true, level, agi, role: 'crush' | 'soulmate' | null, kept?: an earlier wallet's role that stays }
//   · { ok: false, why: 'bad' | 'expired' | 'off' | 'not_set_up' | 'chain' | 'not_member' | 'discord' | 'busy' }
// Throws only when the database can't be used (err.code PGRST202: supabase/discord.sql isn't run).
export async function verifyHolder(cfg, { wallet, link, env = process.env, now = Date.now() }) {
  if (!cfg.dcHolders) return { ok: false, why: 'off' };
  if (typeof wallet !== 'string' || !ADDRESS.test(wallet)) return { ok: false, why: 'bad' };
  const l = readLink(cfg.passSecret, link, now);
  if (!l) return { ok: false, why: 'bad' };
  if (l.expired) return { ok: false, why: 'expired' };
  if (!cfg.dcGuilds?.has(l.guild)) return { ok: false, why: 'bad' };
  const token = dcToken(env);
  if (!token || !cfg.supabaseUrl || !cfg.supabaseKey) {
    warnOnce('setup', "[discord] her holder roles need DISCORD_BOT_TOKEN, SUPABASE_URL and SUPABASE_SECRET_KEY");
    return { ok: false, why: 'not_set_up' };
  }
  const h = await holdingOf(cfg, wallet, env);
  if (!h) return { ok: false, why: 'chain' };
  let roles;
  try {
    roles = await rolesOf(token, l.guild, now);
  } catch (err) {
    console.warn(`[discord] her holder roles: ${err.message}`);
    return { ok: false, why: 'discord' };
  }
  if (!roles) return { ok: false, why: 'not_set_up' };
  const who = holderCode(cfg.passSecret, l.guild, l.user), wcode = holderWalletCode(cfg.passSecret, l.guild, wallet);

  if (h.level < 2) {
    // under 10,000: nothing kept. A role this very wallet gave goes now; one an earlier wallet gave stays (re-checked as usual)
    const dropped = await db(cfg, 'dc_holder_drop', { p_who: who, p_wallet: wcode });
    if (dropped) {
      try { await syncRoles(token, l.guild, l.user, 1, roles, { reason: 'AGI-1: under 10,000 $AGI' }); } catch (err) { console.warn(`[discord] couldn't take a holder role back: ${err.message}${noAccess(err) ? HINT : ''}`); }
      return { ok: true, level: 1, agi: h.agi, role: null };
    }
    const mine = await db(cfg, 'dc_holder_get', { p_who: who });
    const kept = ROLE_OF_LEVEL[mine?.level] ?? null;
    return { ok: true, level: 1, agi: h.agi, role: null, ...(kept ? { kept } : {}) };
  }

  const r = await db(cfg, 'dc_holder_link', { p_who: who, p_wallet: wcode, p_sealed: sealHolder(cfg.passSecret, { guild: l.guild, user: l.user, wallet }), p_level: h.level });
  if (!r?.ok) return { ok: false, why: 'busy' };
  // first, the account that had this wallet before loses its role (one wallet, one account): its row is gone already, so
  // this is the only time it's taken back, whatever happens next
  const was = r.moved ? unsealHolder(cfg.passSecret, r.moved) : null;
  if (was && was.user !== l.user) {
    try { await syncRoles(token, was.guild, was.user, 1, roles, { reason: 'AGI-1: its wallet was verified by another account' }); } catch (err) { console.warn(`[discord] couldn't take a holder role back: ${err.message}${noAccess(err) ? HINT : ''}`); }
  }
  let sync;
  try {
    sync = await syncRoles(token, l.guild, l.user, h.level, roles, { reason: 'AGI-1: $AGI verified on agi1.app' });
  } catch (err) {
    // kept: the cron gives the role once Discord lets her (it says what to change)
    console.warn(`[discord] couldn't give a holder role: ${err.message}${noAccess(err) ? HINT : ''}`);
    return { ok: false, why: 'discord' };
  }
  if (sync === 'gone') {
    await db(cfg, 'dc_holder_drop', { p_who: who });
    return { ok: false, why: 'not_member' };
  }
  return { ok: true, level: h.level, agi: h.agi, role: ROLE_OF_LEVEL[h.level] };
}

// ---------- her button (/holders) and its taps ----------
const row = (...components) => ({ type: 1, components });
const button = (custom_id, label, { style = 2, emoji } = {}) => ({ type: 2, style, custom_id, label, ...(emoji ? { emoji: { name: emoji } } : {}) });
const linkButton = (label, url) => ({ type: 2, style: 5, label, url });
export const panel = () => ({
  content: D.HOLDERS_PANEL, allowed_mentions: NO_PINGS, flags: FLAG.NO_EMBEDS,
  components: [row(button('hv:go', D.HOLDERS_BUTTON, { style: 1, emoji: '✅' }))],
});

export async function holdersCommand(cfg, it, ctx) {
  if (!isOwner(it.member)) return { response: onlyYou(D.OWNER_ONLY) };
  const token = dcToken(ctx.env);
  if (!token) return { response: onlyYou(D.NO_TOKEN) };
  const channel = String(it.channel_id ?? it.channel?.id ?? '');
  if (!ID.test(channel)) return { response: onlyYou(D.HOLDERS_FAILED) };
  const after = (async () => {
    try {
      await botCall(token, `/channels/${channel}/messages`, { method: 'POST', body: panel(), what: 'her verify button' });
    } catch (err) {
      console.warn(`[discord] her verify button didn't go out: ${err.message}`);
      await edit(it, { content: noAccess(err) ? D.holdersNoAccess(channel) : D.HOLDERS_FAILED });
      return 'holders_failed';
    }
    // and whether her two roles are there (said only to the owner)
    let roles = null;
    try { roles = await rolesOf(token, it.guild_id, Date.now()); } catch (err) { console.warn(`[discord] her holder roles: ${err.message}`); }
    await edit(it, { content: roles ? D.HOLDERS_POSTED : `${D.HOLDERS_POSTED}\n${D.HOLDERS_NO_ROLES}` });
    return 'holders_posted';
  })();
  return { response: later(true), after };
}

export async function holderButton(cfg, it, ctx) {
  const id = String(it.data?.custom_id ?? '');
  if (!cfg.dcHolders) return { response: onlyYou(D.HOLDERS_OFF) };
  if (!dcPersonBurst(dcCode(cfg.passSecret, it.member.user.id, 'hburst'), ctx.now)) return { response: onlyYou(D.SLOW_DOWN) };
  if (id === 'hv:go') return linkFor(cfg, it, ctx);
  if (id === 'hv:off') return removeRole(cfg, it, ctx);
  return { response: onlyYou(D.HOLDERS_OLD) };
}

// Verify my $AGI: their private link, only for them (and Remove my role when they have a role, or when it can't be told)
async function linkFor(cfg, it, ctx) {
  const base = siteBase(ctx.env);
  if (!base || cfg.passSecret.length < 32) {
    warnOnce('base', "[discord] her verify links need PASS_SECRET and the site's address (SITE_URL, a plain https address)");
    return { response: onlyYou(D.HOLDERS_FAILED) };
  }
  const url = verifyUrl(base, makeLink(cfg.passSecret, { guild: it.guild_id, user: it.member.user.id }, ctx.now));
  const token = dcToken(ctx.env);
  let roles;
  if (token) roles = await rolesOf(token, it.guild_id, ctx.now, { timeoutMs: 1500 }).catch(() => undefined);
  const has = roles === undefined ? undefined : roleIn(it.member?.roles, roles);
  const buttons = [linkButton(D.HOLDERS_OPEN, url)];
  if (has !== null) buttons.push(button('hv:off', D.HOLDERS_REMOVE));
  const content = has ? D.holdersYours(ROLE_NAMES[has], LINK_MINUTES) : D.holdersLink(LINK_MINUTES);
  return { response: message(content, { onlyYou: true, components: [row(...buttons)] }) };
}

// Remove my role: forgotten, and both roles taken off
async function removeRole(cfg, it, ctx) {
  const token = dcToken(ctx.env);
  if (!token || !cfg.supabaseUrl || !cfg.supabaseKey || cfg.passSecret.length < 32) return { response: update(D.HOLDERS_FAILED) };
  const guild = it.guild_id, user = it.member.user.id;
  const after = (async () => {
    try {
      const dropped = await db(cfg, 'dc_holder_drop', { p_who: holderCode(cfg.passSecret, guild, user) });
      const roles = await rolesOf(token, guild, Date.now());
      const sync = roles ? await syncRoles(token, guild, user, 1, roles, { reason: 'AGI-1: Remove my role' }) : 'same';
      const had = Boolean(dropped) || sync === 'changed';
      await edit(it, { content: had ? D.HOLDERS_REMOVED : D.HOLDERS_NONE, components: [] });
      return had ? 'holder_removed' : 'holder_none';
    } catch (err) {
      console.warn(`[discord] Remove my role: ${err.message}${noAccess(err) ? HINT : ''}`);
      await edit(it, { content: D.HOLDERS_FAILED, components: [] }).catch(() => {});
      return 'holder_failed';
    }
  })();
  return { response: update(D.HOLDERS_REMOVING), after };
}

// ---------- the cron (api/feed.js): their $AGI read again ----------
// The oldest few (not read in RECHECK_MINUTES), 5 at a time, until the deadline: the role their $AGI gives now (swapped, or
// taken back and forgotten under 10,000), and forgotten once they left the server. A wallet the chain can't read now, or
// Discord refusing, waits for a later run.
// → { checked, changed, removed, gone, failed, stopped? } · { off: true } (not set up)
export async function holdersClock(cfg, { env = process.env, deadline = Date.now() + 6000 } = {}) {
  const out = { checked: 0, changed: 0, removed: 0, gone: 0, failed: 0 };
  const token = dcToken(env);
  if (!cfg.dcHolders || !token || !cfg.supabaseUrl || !cfg.supabaseKey || cfg.passSecret.length < 32) return { ...out, off: true };
  const rows = await db(cfg, 'dc_holder_due', { p_limit: RECHECK_BATCH, p_minutes: RECHECK_MINUTES });
  if (!Array.isArray(rows) || !rows.length) return out;
  const one = async (r) => {
    const s = unsealHolder(cfg.passSecret, r?.sealed);
    if (!s) {
      warnOnce('seal', "[discord] a holder's sealed ids couldn't be opened (PASS_SECRET changed?): that one is forgotten (its role stays until a Mod takes it)");
      await db(cfg, 'dc_holder_drop', { p_who: r?.who });
      out.failed += 1;
      return;
    }
    if (!cfg.dcGuilds?.has(s.guild)) return;                 // a server that isn't in DISCORD_GUILDS now: left as it is
    const h = await holdingOf(cfg, s.wallet, env);
    if (!h) { out.failed += 1; return; }
    const roles = await rolesOf(token, s.guild);
    if (!roles) { out.failed += 1; return; }
    const level = h.level >= 2 ? h.level : 1;
    const sync = await syncRoles(token, s.guild, s.user, level, roles, { reason: 'AGI-1: $AGI checked again' });
    const who = holderCode(cfg.passSecret, s.guild, s.user);
    if (sync === 'gone') { await db(cfg, 'dc_holder_drop', { p_who: who }); out.gone += 1; return; }
    if (level < 2) { await db(cfg, 'dc_holder_drop', { p_who: who }); out.removed += 1; return; }
    if (level !== Number(r.level)) await db(cfg, 'dc_holder_set', { p_who: who, p_level: level });
    if (sync === 'changed' || level !== Number(r.level)) out.changed += 1;
    out.checked += 1;
  };
  for (let i = 0; i < rows.length; i += 5) {
    if (Date.now() > deadline) { out.stopped = 'time'; break; }
    await Promise.all(rows.slice(i, i + 5).map((r) => one(r).catch((err) => {
      out.failed += 1;
      console.warn(`[discord] re-checking a holder: ${err.message}${noAccess(err) ? HINT : ''}`);
    })));
  }
  return out;
}
