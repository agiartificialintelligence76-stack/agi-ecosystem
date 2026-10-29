// AGI-1 on Discord (2026-10-28, the owner: "can you also add agi1 bot to my discord server? like in the telegram bot"): her
// Telegram group mode (server/tg-groups.js) in the owner's Discord server, through Discord's HTTP interactions: no gateway,
// no new server, no new function, no new SQL. (So her bot shows as offline in the member list: she's never "connected",
// Discord sends us each command instead.)
//   • agi1.app/discord/interactions (her app's Interactions Endpoint URL: vercel.json sends it to api/telegram.js as
//     ?discord, Vercel's 12 functions being all used; /api/telegram?discord works too): every slash command and button tap
//     people use in her server, signed by Discord (Ed25519, checked with DISCORD_PUBLIC_KEY; anything else gets a 401). Discord wants the first answer within 3 s, so this file loads light and answers at once, and anything
//     slower (the AI, a song) goes on after the answer (Vercel's waitUntil) and edits it.
//   • /ask: the same AI as her Telegram groups (Gemini, her prompt, the reply cleanup), as a Stranger, never flirty, at most
//     2 sentences (discordPrompt), under a quote of the question, with the same daily limits: the person's Stranger's day
//     (under a daily code of their Discord account, never its id), the server's (DISCORD_GUILD_DAILY_CAP, else
//     TELEGRAM_GROUP_DAILY_CAP's number), her chat apps' share (TELEGRAM_DAILY_CAP) and the site's daily cap. /ca, /website,
//     /mc, /music and /help: her Telegram groups' own lines (pre-written, no AI, nothing counted), each public at most once
//     every 30 s in a server (asked again sooner: only to whoever asked, the answer is right above).
//   • Only in the servers in DISCORD_GUILDS: anywhere else (another server, her DMs) one line, only to whoever asked.
//   • api/feed.js (Vercel's cron, 8 times a day): connectDiscord() points her app at that address and sets her commands in
//     each server (only when they changed), then postToDiscord() posts her diary and $AGI's market moments found that run in
//     the channel of DISCORD_FEED_WEBHOOK; api/live.js: her "i'm live on X" line there too (postDiscordLive, once a day).
// Kept (supabase/telegram.sql and chat-limits.sql: nothing new): per server and day, how many replies she gave there (its id
// as a negative number, in agi1_tg_group_usage with Telegram's groups: Discord's ids are far bigger than Telegram's, so never
// the same), and a person's messages a day under a daily code. Never a message, a name or an account's id.
import { createHmac, createPublicKey, verify } from 'node:crypto';
import { getConfig } from './config.js';
import { siteBase } from './tg-api.js';
import { rpc, takeChatSlot } from './limits.js';
import { askAgi1, TLDS } from './gemini.js';
import { agiNumbers } from './market.js';
import { levelInfo } from '../src/lib/levels.js';
import { secretIn, SECRET_WARNING } from './secrets.js';
import { dcPersonBurst, dcGuildBurst, dcMusicBurst } from './burst.js';
import { SONGS, songOf, musicOn, MUSIC_PATH, MUSIC_V, MUSIC_MENU, TOAST, SEND_FAILED, GAPS, PERFORMER, isMp3, songCaption } from './tg-music.js';
import { tgLinesFor, GROUP_CA, GROUP_WEBSITE, GROUP_FULL, GROUP_OUT, groupMarket, GROUP_MARKET_DOWN, GROUP_LIVE } from './tg-lines.js';
import { OFFICIAL_CA } from './agi1-prompt.js';
import * as D from './dc-lines.js';

export const API = 'https://discord.com/api/v10';
const UA = 'DiscordBot (https://agi1.app, 1.0)';         // the User-Agent Discord asks every app for
export const KIND = { PING: 1, COMMAND: 2, BUTTON: 3, AUTOCOMPLETE: 4, MODAL: 5 };   // what Discord sends (interaction types)
export const ANSWER = { PONG: 1, MESSAGE: 4, LATER: 5, UPDATE: 7, CHOICES: 8 };         // how we answer (response types)
export const FLAG = { NO_EMBEDS: 4, ONLY_YOU: 64 };                                     // a message's flags
export const NO_PINGS = Object.freeze({ parse: [] });    // nothing she writes ever pings anyone (@everyone, a role, a person)
export const MAX_BODY = 65_536;                          // an interaction is a few KB
export const MAX_SKEW_S = 300;                           // a signed request older (or newer) than 5 minutes is refused
export const MAX_TEXT = 500;                             // characters she reads (the same as the site's chat and Telegram's)
export const FIXED_GAP_MS = 30_000;                      // /ca, /website, /mc, /music, /help: public at most every 30 s
export const QUICK_MS = 1200;                            // limits (or $AGI's numbers) known by then: the answer itself at once
export const MAX_UPLOAD = 10 * 1024 * 1024;              // a song bigger than a server's upload limit goes as its link
export const ENDPOINT_PATH = '/discord/interactions';     // her Interactions Endpoint URL, on the site's address (vercel.json)
const DAY = 86_400_000;

// ---------- her settings ----------
// Her bot's token (Developer Portal → Bot → Reset Token; secret: Vercel only), or '' when it isn't set or isn't one. Only
// api/feed.js uses it (connectDiscord): answering commands needs no token.
const BOT_TOKEN = /^[A-Za-z0-9_-]{20,40}\.[A-Za-z0-9_-]{4,10}\.[A-Za-z0-9_-]{25,60}$/;
export const dcToken = (env = process.env) => {
  const t = String(env.DISCORD_BOT_TOKEN || '').trim();
  return BOT_TOKEN.test(t) ? t : '';
};
// A daily code of a person's Discord account (like the site's daily visitor code and Telegram's chatCode): never the id itself
export const dcCode = (secret, id, day) => `d:${createHmac('sha256', String(secret)).update(`dc:${day}:${id}`).digest('base64url').slice(0, 32)}`;
const ours = (cfg, guild) => Boolean(cfg.dcGuilds?.has(guild));

// ---------- what this server copy remembers (never anything about a person beyond a daily code, a day at most) ----------
const notes = new Map();                                 // key → until when (ms)
const sentAt = new Map();                                // "<server>:<song>" or "<server>" → when a song went out (ms)
const warned = new Set();
const warnOnce = (key, line) => { if (!warned.has(key)) { warned.add(key); console.warn(line); } };
const noted = (key, now) => (notes.get(key) ?? 0) > now;
function note(key, now, ttl) {
  notes.delete(key);
  if (notes.size >= 5000) notes.delete(notes.keys().next().value);
  notes.set(key, now + ttl);
}
const firstTime = (key, now, ttl) => {
  if (noted(key, now)) return false;
  note(key, now, ttl);
  return true;
};
const recent = (key, now, gap) => now - (sentAt.get(key) ?? -Infinity) < gap;
function mark(key, now) {
  sentAt.delete(key);
  if (sentAt.size >= 5000) sentAt.delete(sentAt.keys().next().value);
  sentAt.set(key, now);
}
// (for the tests: a fresh server copy)
export function forgetDiscord() {
  notes.clear(); sentAt.clear(); warned.clear(); keys.clear();
  dcPersonBurst.reset(); dcGuildBurst.reset(); dcMusicBurst.reset();
}

// ---------- Discord's signature ----------
// Every request Discord sends is signed with her app's private key: Ed25519 over the timestamp and the body, exactly as sent.
// Discord also sends a badly signed request when the endpoint is saved, and wants a 401 for it.
const SPKI = Buffer.from('302a300506032b6570032100', 'hex');     // an Ed25519 public key's DER header
const keys = new Map();
function keyOf(hex) {
  let k = keys.get(hex);
  if (!k) {
    k = createPublicKey({ key: Buffer.concat([SPKI, Buffer.from(hex, 'hex')]), format: 'der', type: 'spki' });
    keys.set(hex, k);
  }
  return k;
}
// publicKey: 64 hex characters · signature: X-Signature-Ed25519 · timestamp: X-Signature-Timestamp (Unix seconds) · body: bytes
export function fromDiscord(publicKey, signature, timestamp, body, nowMs = Date.now()) {
  const ts = String(timestamp ?? ''), sig = String(signature ?? '');
  if (!/^[0-9a-f]{64}$/.test(String(publicKey)) || !/^[0-9a-f]{128}$/i.test(sig) || !/^\d{9,12}$/.test(ts)) return false;
  if (Math.abs(nowMs / 1000 - Number(ts)) > MAX_SKEW_S) return false;
  try {
    return verify(null, Buffer.concat([Buffer.from(ts), Buffer.from(body)]), keyOf(publicKey), Buffer.from(sig, 'hex'));
  } catch { return false; }
}

// ---------- the request (api/telegram.js?discord) ----------
const json = (status, body) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
// Work that goes on after the answer: Vercel keeps the function running for it (waitUntil, what @vercel/functions does);
// anywhere else (tests, a local server) it simply runs on
const REQUEST_CONTEXT = Symbol.for('@vercel/request-context');
function keepGoing(work) {
  const done = Promise.resolve(work).catch((err) => console.error(`[discord] after her first answer: ${err.message}`));
  try { globalThis[REQUEST_CONTEXT]?.get?.()?.waitUntil?.(done); } catch { /* not on Vercel */ }
  return done;
}
export async function discordPost(request, env = process.env) {
  const started = Date.now();
  const cfg = getConfig(env);
  if (!cfg.dcPublicKey) {
    warnOnce('key', '[discord] not set up: DISCORD_PUBLIC_KEY is needed (Developer Portal → General Information → Public Key), then Redeploy');
    return json(503, { error: 'not_configured' });
  }
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY) return json(413, { error: 'too_big' });
  const body = new Uint8Array(await request.arrayBuffer());
  if (body.length > MAX_BODY) return json(413, { error: 'too_big' });
  if (!fromDiscord(cfg.dcPublicKey, request.headers.get('x-signature-ed25519'), request.headers.get('x-signature-timestamp'), body, started)) {
    return json(401, { error: 'unauthorized' });
  }
  let it;
  try { it = JSON.parse(new TextDecoder().decode(body)); } catch { return json(400, { error: 'not_json' }); }
  if (!it || typeof it !== 'object' || Array.isArray(it)) return json(400, { error: 'not_json' });
  let out;
  try {
    out = await onInteraction(cfg, it, { env, now: started, started });
  } catch (err) {
    console.error(`[discord] couldn't answer: ${err.message}`);
    out = { response: onlyYou(tgLinesFor('en').BUSY) };
  }
  if (out.after) keepGoing(out.after);
  return json(200, out.response);
}

// ---------- one interaction ----------
// → { response: what Discord gets at once, after: a promise of what happens after (or none), resolving to a short word for
// the tests }. Never throws for what someone sent.
export async function onInteraction(cfg, it, { env = process.env, now = Date.now(), started = Date.now(), quickMs = QUICK_MS } = {}) {
  if (it?.type === KIND.PING) return { response: { type: ANSWER.PONG } };
  if (it?.type === KIND.AUTOCOMPLETE) return { response: { type: ANSWER.CHOICES, data: { choices: [] } } };
  const guild = typeof it?.guild_id === 'string' ? it.guild_id : null;
  const who = it?.member?.user?.id;
  // a server that isn't hers, her DMs (no member there), or something we couldn't answer later: one line, only to them
  if (!guild || !ours(cfg, guild) || typeof who !== 'string' || !/^\d{17,20}$/.test(who) || !hookable(it)) return { response: onlyYou(D.NOT_HERE) };
  const ctx = { env, now, started, quickMs };
  if (it.type === KIND.COMMAND) return onCommand(cfg, it, ctx);
  if (it.type === KIND.BUTTON) return onButton(cfg, it, ctx);
  return { response: onlyYou(D.NOT_HERE) };
}
// an interaction's own webhook (our app's id and its token, as Discord sent them): what edits her answer afterwards
const hookable = (it) => /^\d{17,20}$/.test(String(it?.application_id ?? '')) && /^[\w.-]{20,1000}$/.test(String(it?.token ?? ''));

// a message (public, or only for whoever asked), never a ping, no link previews unless asked for
export const message = (content, { onlyYou: mine = false, embeds = false, components } = {}) => ({
  type: ANSWER.MESSAGE,
  data: { content, allowed_mentions: NO_PINGS, flags: (mine ? FLAG.ONLY_YOU : 0) | (embeds ? 0 : FLAG.NO_EMBEDS), ...(components ? { components } : {}) },
});
export const onlyYou = (content) => message(content, { onlyYou: true });
// "AGI-1 is thinking…": the answer comes in an edit
export const later = (mine = false) => ({ type: ANSWER.LATER, data: { flags: mine ? FLAG.ONLY_YOU : 0 } });
// (2026-10-29) the message a button was on, changed (its buttons gone)
export const update = (content) => ({ type: ANSWER.UPDATE, data: { content, components: [], allowed_mentions: NO_PINGS } });
// a promise's value if it settles within ms, else undefined (the promise goes on)
function within(promise, ms) {
  if (!(ms > 0)) return Promise.resolve(undefined);
  let timer;
  return Promise.race([promise, new Promise((resolve) => { timer = setTimeout(resolve, ms, undefined); })]).finally(() => clearTimeout(timer));
}

async function onCommand(cfg, it, ctx) {
  const name = String(it.data?.name ?? '');
  const guild = it.guild_id, now = ctx.now;
  // speed bumps (per server copy): 4 commands a minute per person, 15 a minute in the server
  if (!dcPersonBurst(dcCode(cfg.passSecret, it.member.user.id, 'burst'), now) || !dcGuildBurst(`g:${guild}`, now)) return { response: onlyYou(D.SLOW_DOWN) };
  switch (name) {
    case 'ask': return ask(cfg, it, ctx);
    // (2026-10-29) the owner's: an image she posts herself, and her ticket button (loaded only when used)
    case 'post': return (await import('./dc-tickets.js')).postCommand(cfg, it, ctx);
    case 'tickets': return (await import('./dc-tickets.js')).ticketsCommand(cfg, it, ctx);
    case 'ca': return fixed(guild, 'ca', now, { content: caLine() });
    case 'website': return fixed(guild, 'website', now, { content: GROUP_WEBSITE, embeds: true });
    case 'help': return fixed(guild, 'help', now, { content: D.helpFor({ music: musicOn(cfg) }) });
    case 'music': return musicOn(cfg) ? fixed(guild, 'music', now, { content: MUSIC_MENU, components: musicRows() }) : { response: onlyYou(D.MUSIC_OFF) };
    case 'mc': return mc(it, ctx);
    default: return { response: onlyYou(D.helpFor({ music: musicOn(cfg) })) };
  }
}
// /ca, /website, /help, /music: public at most once every 30 s in a server; sooner, only to whoever asked
function fixed(guild, name, now, { content, embeds = false, components }) {
  return { response: message(content, { onlyYou: !firstTime(`${name}:${guild}`, now, FIXED_GAP_MS), embeds, components }) };
}
// the official contract as code (Discord shows it apart, easy to copy)
export const caLine = () => GROUP_CA.replace(OFFICIAL_CA, `\`${OFFICIAL_CA}\``);

// /mc: $AGI's numbers (DexScreener, kept a minute: server/market.js), at once when they're known in time, else in an edit
async function mc(it, ctx) {
  const mine = !firstTime(`mc:${it.guild_id}`, ctx.now, FIXED_GAP_MS);
  const line = agiNumbers(ctx.now).then((n) => (n ? groupMarket(n) : GROUP_MARKET_DOWN), () => GROUP_MARKET_DOWN);
  const quick = await within(line, ctx.started + ctx.quickMs - Date.now());
  if (quick !== undefined) return { response: message(quick, { onlyYou: mine }) };
  return { response: later(mine), after: line.then((text) => edit(it, { content: text })).then(() => 'mc_later') };
}

// ---------- /ask ----------
async function ask(cfg, it, ctx) {
  const E = tgLinesFor('en');
  const opt = (Array.isArray(it.data?.options) ? it.data.options : []).find((o) => o?.name === 'question');
  const question = typeof opt?.value === 'string' ? opt.value.replace(/\s+/g, ' ').trim() : '';
  if (!question) return { response: onlyYou(D.ASK_EMPTY) };
  if (question.length > MAX_TEXT) return { response: onlyYou(E.TOO_LONG) };
  // (like her Telegram groups) a seed phrase or a private key, by mistake: a warning, and nothing of it goes anywhere
  const secret = secretIn(question);
  if (secret) return { response: onlyYou(SECRET_WARNING[secret]) };
  if (!cfg.geminiKey || !cfg.supabaseUrl || !cfg.supabaseKey || cfg.passSecret.length < 32) {
    warnOnce('ask', "[discord] /ask needs the site's own settings: GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY and PASS_SECRET");
    return { response: onlyYou(E.NOT_READY) };
  }
  const guild = it.guild_id;
  const day = new Date(ctx.now).toISOString().slice(0, 10);
  if (noted(`full:${guild}:${day}`, ctx.now)) return { response: onlyYou(GROUP_FULL) };   // the server's day is used
  const limits = takeLimits(cfg, guild, dcCode(cfg.passSecret, it.member.user.id, day), day, ctx.now);
  const quick = await within(limits, ctx.started + ctx.quickMs - Date.now());
  if (quick !== undefined && quick !== 'ok') return { response: onlyYou(limitLine(quick)) };
  const after = (async () => {
    const outcome = quick ?? await limits;
    if (outcome !== 'ok') {
      // the database was slow, so everyone already sees "thinking…": it goes, and the line is for them only
      await remove(it).catch(() => {});
      await followUp(it, limitLine(outcome));
      return `ask_${outcome}`;
    }
    let answer;
    try {
      answer = await askAgi1(cfg, [], question, {
        level: 1, memory: [], discord: {}, lang: 'en', langSource: 'default',
        timeoutMs: Math.max(3_000, 19_000 - (Date.now() - ctx.started)),     // (all of it inside Vercel's 25 s)
      });
    } catch (err) {
      console.error('[discord] gemini failed:', err.message);
      await edit(it, { content: E.BLANK });
      return 'ai_error';
    }
    await edit(it, { content: `${quoteOf(question)}\n${escapeMd(answer.reply)}` });
    return 'asked';
  })();
  return { response: later(), after };
}
// The person's day first (so someone over their own never uses the server's), then the server's, then her chat apps' share.
// → 'ok' (counted) · 'too_fast' · 'person_cap' · 'global_cap' · 'guild_full' · 'apps_cap' · 'not_ready' · 'busy'
async function takeLimits(cfg, guild, person, day, now) {
  try {
    const slot = await takeChatSlot(cfg, person, levelInfo(1).daily);
    if (slot !== 'ok') return slot === 'too_fast' || slot === 'person_cap' ? slot : 'global_cap';
    let take;
    try {
      // (the server's id as a negative number: that's where telegram.sql counts a group's day)
      take = await rpc(cfg, 'tg_group_take', { p_chat: `-${guild}`, p_max: cfg.dcGuildDailyCap }, 'discord');
    } catch (err) {
      if (err.code !== 'PGRST202') throw err;
      warnOnce('sql', '[discord] tg_group_take not found: run supabase/telegram.sql again in this Supabase project (it ends with telegram_functions_found = 14)');
      return 'not_ready';
    }
    if (take !== 'ok') { note(`full:${guild}:${day}`, now, DAY); return 'guild_full'; }
    if (await rpc(cfg, 'tg_take', { p_max: cfg.telegramDailyCap }, 'discord') !== true) return 'apps_cap';
    return 'ok';
  } catch (err) {
    console.error('[discord] limits unavailable:', err.message);
    return 'busy';
  }
}
function limitLine(why) {
  const E = tgLinesFor('en');
  return { too_fast: E.TOO_FAST, person_cap: GROUP_OUT, guild_full: GROUP_FULL, not_ready: E.NOT_READY, busy: E.BUSY }[why] || E.TALKED_OUT;
}

// ---------- what she writes, as Discord shows it ----------
// Discord's markdown in what she or someone else wrote shows as written (links stay links), and nothing is a mention
export function escapeMd(text) {
  return String(text ?? '').split(/(https?:\/\/[^\s<>]+)/gi).map((part, i) => (i % 2 ? part : part
    .replace(/[\\*_~`|<>[\]]/g, '\\$&')
    .replace(/^([#-])/gm, '\\$1')
    .replace(/@(everyone|here)\b/gi, '@​$1'))).join('');
}
// Their question, quoted above her answer: one line, at most 200 characters, never a link, an address, an email or a mention
// (a link's or an address's last character is never a comma, a full stop or a bracket: those stay in the sentence)
const BARE = new RegExp(`(^|[^\\w@.-])((?:[a-z0-9-]+\\.)+(?:${TLDS}))\\b(\\/\\S*[^\\s,.!?;:)'"])?\\/?`, 'gi');
export function quoteOf(text, max = 200) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim()
    .replace(/\b(?:https?:\/\/|www\.)\S*[^\s,.!?;:)'"]/gi, '[link]')
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]')
    .replace(BARE, (m, before) => `${before}[link]`)
    .replace(/0x[0-9a-fA-F]{6,}/g, '[address]')
    .replace(/<(?:@[!&]?|#)\d{17,20}>/g, '@someone');
  const chars = [...s];
  return `> ${escapeMd(chars.length > max ? `${chars.slice(0, max - 1).join('').trimEnd()}…` : s)}`;
}

// ---------- calling Discord ----------
// One call. → its answer (null for "204 No Content") · throws an error with .status, .code (Discord's own) and .retryAfter.
// Its message never has the address in it (an interaction's token and a webhook's are in theirs): `what` says what it was.
// reason: what the server's audit log says about it (2026-10-29: her tickets)
export async function discordCall(path, { method = 'GET', body, form, token, what = 'a call', timeoutMs = 5000, reason } = {}) {
  const headers = { 'User-Agent': UA };
  if (token) headers.Authorization = `Bot ${token}`;
  if (reason) headers['X-Audit-Log-Reason'] = encodeURIComponent(reason);
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(path.startsWith('https://') ? path : `${API}${path}`, { method, headers, body: payload, signal: AbortSignal.timeout(timeoutMs) });
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch { /* not JSON */ }
  if (res.ok) return data;
  const said = typeof data?.message === 'string' ? data.message.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
  const field = Object.entries(data?.errors ?? {}).map(([k, v]) => `${k}: ${v?._errors?.[0]?.message ?? ''}`)[0];
  const err = new Error(`discord ${what}: HTTP ${res.status}${data?.code !== undefined ? ` (${data.code}${said ? `: ${said}` : ''}${field ? `; ${String(field).slice(0, 160)}` : ''})` : ''}`);
  err.status = res.status;
  err.code = Number.isInteger(data?.code) ? data.code : null;
  err.retryAfter = Number(data?.retry_after) > 0 ? Number(data.retry_after) : null;
  throw err;
}
export const hookPath = (it, rest = '') => `/webhooks/${it.application_id}/${encodeURIComponent(it.token)}${rest}`;
// her first answer, edited (a link preview only when asked for; components: [] takes its buttons away)
export const edit = (it, { content, embeds = false, components }) => discordCall(hookPath(it, '/messages/@original'), {
  method: 'PATCH', body: { content, allowed_mentions: NO_PINGS, flags: embeds ? 0 : FLAG.NO_EMBEDS, ...(components ? { components } : {}) }, what: 'her answer',
});
const remove = (it) => discordCall(hookPath(it, '/messages/@original'), { method: 'DELETE', what: 'her "thinking…"' });
const followUp = (it, content) => discordCall(hookPath(it), {
  method: 'POST', body: { content, allowed_mentions: NO_PINGS, flags: FLAG.ONLY_YOU | FLAG.NO_EMBEDS }, what: 'a line only for them',
});

// ---------- her songs: /music, and a tap sends one ----------
// Her songs (server/tg-music.js: the same files, the same switch, TELEGRAM_MUSIC) as buttons, 5 to a row
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
export function musicRows() {
  const buttons = SONGS.map((s) => ({ type: 2, style: 2, custom_id: `music:${s.id}`, label: `${s.title} · ${clock(s.seconds)}`, emoji: { name: s.emoji } }));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) rows.push({ type: 1, components: buttons.slice(i, i + 5) });
  return rows;
}
// A tap: the same guards as her Telegram groups' (the same song at most once every 5 minutes in a server and any song once
// every 30 s, 6 taps a minute per person), then the song as an audio file, uploaded by our server
async function onButton(cfg, it, ctx) {
  const id = String(it.data?.custom_id ?? '');
  // (2026-10-29) her tickets' buttons: Open a ticket, Close ticket (server/dc-tickets.js, loaded only when used)
  if (/^tk:[a-z:]{1,20}$/.test(id)) return (await import('./dc-tickets.js')).ticketButton(cfg, it, ctx);
  const song = /^music:[a-z]{1,12}$/.test(id) ? songOf(id.slice(6)) : null;
  if (!song) return { response: onlyYou(D.OLD_BUTTON) };
  if (!musicOn(cfg)) return { response: onlyYou(D.MUSIC_OFF) };
  const now = ctx.now, guild = it.guild_id;
  if (!dcMusicBurst(dcCode(cfg.passSecret, it.member.user.id, 'mburst'), now)) return { response: onlyYou(D.SLOW_DOWN) };
  if (recent(`${guild}:${song.id}`, now, GAPS.groupSong)) return { response: onlyYou(TOAST.again(song)) };
  if (recent(guild, now, GAPS.groupAny)) return { response: onlyYou(TOAST.wait) };
  mark(`${guild}:${song.id}`, now);
  mark(guild, now);
  const after = sendSong(it, song, { deadline: ctx.started + 22_000, env: ctx.env }).then((r) => {
    if (r === 'failed') { sentAt.delete(`${guild}:${song.id}`); sentAt.delete(guild); }   // nothing went out: a tap again works
    return `music_${r}`;
  });
  return { response: later(), after };
}
const isTimeout = (err) => err?.name === 'TimeoutError' || err?.name === 'AbortError';
// → 'sent' (as a file) · 'link' (too big for the server's uploads: its address, which Discord can play) · 'failed' · 'unsure'
async function sendSong(it, song, { deadline, env }) {
  const left = () => deadline - Date.now();
  const base = siteBase(env);
  if (!base) {
    warnOnce('base', "[discord] the site's address isn't a plain https address (SITE_URL in Vercel), so her songs can't be sent: fix it, then Redeploy");
    await edit(it, { content: SEND_FAILED }).catch(() => {});
    return 'failed';
  }
  const url = `${base}${MUSIC_PATH}${song.file}?v=${MUSIC_V}`;
  const caption = escapeMd(songCaption(song));
  let bytes;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(Math.max(1000, Math.min(8000, left() - 8000))) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length < 10_000 || !isMp3(bytes)) throw new Error(`not her song (${bytes.length} bytes)`);
  } catch (err) {
    console.warn(`[discord] couldn't read ${song.file} from ${base} (${err.message}): is public/music/ in the deployment?`);
    await edit(it, { content: SEND_FAILED }).catch(() => {});
    return 'failed';
  }
  if (bytes.length <= MAX_UPLOAD) {
    try {
      const form = new FormData();
      form.append('payload_json', JSON.stringify({
        content: caption, allowed_mentions: NO_PINGS, flags: FLAG.NO_EMBEDS,
        attachments: [{ id: 0, filename: song.file, description: `${song.title} by ${PERFORMER}` }],
      }));
      form.append('files[0]', new Blob([bytes], { type: 'audio/mpeg' }), song.file);
      await discordCall(hookPath(it, '/messages/@original'), { method: 'PATCH', form, what: 'her song', timeoutMs: Math.max(1000, left() - 500) });
      return 'sent';
    } catch (err) {
      if (isTimeout(err)) return 'unsure';
      if (!(err.status === 413 || err.code === 40005)) {
        console.warn(`[discord] a song didn't go out: ${err.message}`);
        await edit(it, { content: SEND_FAILED }).catch(() => {});
        return 'failed';
      }
    }
  }
  await edit(it, { content: `${caption}\n${url}`, embeds: true });
  return 'link';
}

// ---------- connecting her app (api/feed.js, each run) ----------
// Her commands as Discord takes them (a server's own: COMMANDS in server/dc-lines.js; /music while her songs are on)
export const commandsFor = (cfg) => D.COMMANDS.filter((c) => c.name !== 'music' || musicOn(cfg)).map((c) => ({ type: 1, ...c }));
// what makes two lists of commands the same for us (Discord's answer has more in it: ids, versions…); since 2026-10-29 who
// sees a command (default_member_permissions: the owner's are '8') and which channels an option takes count too
const optionKey = (o) => ({
  type: Number(o?.type), name: String(o?.name ?? ''), description: String(o?.description ?? ''), required: o?.required === true,
  min_length: o?.min_length ?? null, max_length: o?.max_length ?? null,
  channel_types: Array.isArray(o?.channel_types) ? [...o.channel_types].map(Number).sort((a, b) => a - b) : null,
});
export const commandsKey = (list) => JSON.stringify((Array.isArray(list) ? list : [])
  .map((c) => ({
    type: Number(c?.type ?? 1), name: String(c?.name ?? ''), description: String(c?.description ?? ''),
    default_member_permissions: c?.default_member_permissions == null ? null : String(c.default_member_permissions),
    options: (Array.isArray(c?.options) ? c.options : []).map(optionKey),
  }))
  .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)));
// Her app: its description (D.DESCRIPTION) and its endpoint (<the site>/discord/interactions) when they aren't those, and her
// commands in each server of DISCORD_GUILDS when they aren't hers. Every run, so a change fixes itself (like her Telegram
// bot's connectBot). → { app, description, endpoint, commands, … } · throws when Discord refuses the token
export async function connectDiscord(cfg, env = process.env, { deadline = Date.now() + 12_000 } = {}) {
  const raw = String(env.DISCORD_BOT_TOKEN || '').trim();
  const token = dcToken(env);
  if (!token) {
    if (raw) warnOnce('token', "[discord] DISCORD_BOT_TOKEN doesn't look like a bot token: Developer Portal → Bot → Reset Token, copy it into Vercel, then Redeploy");
    return { skipped: raw ? 'bad_token' : 'no_token' };
  }
  const app = await discordCall('/applications/@me', { token, what: 'her app', timeoutMs: 4000 });
  const appId = String(app?.id ?? '');
  if (!/^\d{17,20}$/.test(appId)) throw new Error("discord her app: no id in Discord's answer");
  const out = { app: appId, description: false, endpoint: false, commands: 0 };
  // the public key in Vercel must be this app's, or nothing Discord sends could be checked
  const keyOk = !cfg.dcPublicKey || String(app.verify_key ?? '').toLowerCase() === cfg.dcPublicKey;
  if (!keyOk) {
    out.keyMismatch = true;
    console.warn("[discord] DISCORD_PUBLIC_KEY isn't this app's public key: copy it again from Developer Portal → General Information → Public Key into Vercel, then Redeploy");
  }
  if (app.description !== D.DESCRIPTION && Date.now() < deadline) {
    try {
      await discordCall('/applications/@me', { method: 'PATCH', body: { description: D.DESCRIPTION }, token, what: 'her description', timeoutMs: 4000 });
      out.description = true;
    } catch (err) { console.warn(`[discord] ${err.message} (tried again next run)`); }
  }
  // her endpoint (Discord checks it as it's saved: a signed PING, and a badly signed request that must get a 401)
  const base = siteBase(env);
  const url = base ? `${base}${ENDPOINT_PATH}` : null;
  if (url && cfg.dcPublicKey && keyOk && app.interactions_endpoint_url !== url && Date.now() < deadline) {
    try {
      await discordCall('/applications/@me', { method: 'PATCH', body: { interactions_endpoint_url: url }, token, what: 'her endpoint', timeoutMs: 8000 });
      out.endpoint = true;
      console.log(`[discord] her app now sends her commands to ${url}`);
    } catch (err) {
      out.endpointError = true;
      console.warn(`[discord] ${err.message} (Discord checks ${url} before it saves it: is DISCORD_PUBLIC_KEY right in this deployment? tried again next run)`);
    }
  }
  const want = commandsFor(cfg);
  for (const guild of cfg.dcGuilds ?? []) {
    if (Date.now() > deadline) { out.stopped = 'time'; break; }
    const path = `/applications/${appId}/guilds/${guild}/commands`;
    try {
      const have = await discordCall(path, { token, what: 'her commands', timeoutMs: 4000 });
      if (commandsKey(have) === commandsKey(want)) continue;
      await discordCall(path, { method: 'PUT', body: want, token, what: 'her commands', timeoutMs: 4000 });
      out.commands += 1;
      console.log(`[discord] set her commands in the server ${guild}`);
    } catch (err) {
      out.failed = (out.failed || 0) + 1;
      console.warn(`[discord] her commands in the server ${guild}: ${err.message}${err.status === 403 || err.code === 50001
        ? " (she isn't in that server yet, or was added without the applications.commands scope: add her with her invite link, then the next run sets them)" : ''}`);
    }
  }
  return out;
}

// ---------- her posts in her channel (api/feed.js and api/live.js) ----------
// The channel's webhook (DISCORD_FEED_WEBHOOK): her name and picture on each post, never a ping, no link previews
async function hookPost(cfg, text, env) {
  const base = siteBase(env);
  return discordCall(`${cfg.dcFeedWebhook}?wait=true`, {
    method: 'POST', what: 'her channel', timeoutMs: 4000,
    body: { content: escapeMd(text), username: 'AGI-1', ...(base ? { avatar_url: `${base}/icons/agi1-512.png` } : {}), allowed_mentions: NO_PINGS, flags: FLAG.NO_EMBEDS },
  });
}
const hookHint = (err) => (err.status === 404 || err.code === 10015
  ? " (the webhook is gone: make a new one in the channel's settings → Integrations → Webhooks, put its URL in DISCORD_FEED_WEBHOOK, then Redeploy)"
  : err.status === 429 ? ' (Discord said "too many": skipped this time)' : '');
// Her diary and $AGI's market moments, the ones found this very run (so never twice), never one that names another coin, a
// link other than agi1.app, an address or an @username: the same as her Telegram groups' (GROUP_POSTS, groupSafe).
// moments: [{ id, kind, key, text }] → { posted, failed, skipped, stopped? }
export async function postToDiscord(cfg, moments = [], { deadline = Infinity, env = process.env } = {}) {
  const out = { posted: 0, failed: 0, skipped: 0 };
  if (!cfg.dcFeedWebhook || !cfg.dcPosts) return out;
  const { GROUP_POSTS, groupSafe } = await import('./tg-groups.js');
  const ours = moments.filter((x) => GROUP_POSTS.includes(x?.kind) && typeof x.text === 'string');
  const posts = ours.filter((x) => groupSafe(x.text)).sort((a, b) => Number(a.id) - Number(b.id));
  out.skipped = ours.length - posts.length;
  for (const p of posts) {
    if (Date.now() > deadline) { out.stopped = 'time'; break; }
    try {
      await hookPost(cfg, p.text, env);
      out.posted += 1;
    } catch (err) {
      out.failed += 1;
      console.warn(`[discord] couldn't post ${p.key} in her channel: ${err.message}${hookHint(err)}`);
    }
  }
  return out;
}
// Her show just went live on X (api/live.js 'on_x', once a day: live_tell): her "i'm live" line there too. → { posted, failed }
export async function postDiscordLive(cfg, { env = process.env } = {}) {
  const out = { posted: 0, failed: 0 };
  if (!cfg.dcFeedWebhook || !cfg.dcPosts) return out;
  try {
    await hookPost(cfg, GROUP_LIVE, env);
    out.posted = 1;
  } catch (err) {
    out.failed = 1;
    console.warn(`[live] couldn't tell her Discord channel she's live: ${err.message}${hookHint(err)}`);
  }
  return out;
}
