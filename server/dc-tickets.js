// AGI-1 on Discord, round 2 (2026-10-29, the owner: "can members submit a ticket there? like a real one and theres gonna be
// a dedicated channel like support ticket no. 1", and "is it possible i send an image to agi-1 and she send it herself to
// channel i said"; the owner's choices: "Build it into AGI-1 (Recommended)" and "Yes, add /post (Recommended)"): her support
// tickets and the owner's /post. server/discord.js loads this file only when one of them is used.
//   • /tickets (the owner only): her "Open a ticket" button, posted by her in the channel it's typed in (🎫┃support).
//   • A tap on it: a private channel for that person and the team, 🎫┃ticket-0001, 0002… in the server's tickets category
//     (a category with "ticket" in its name: the ticket gets its permissions, plus that person and her bot), her first
//     message in it with Close ticket under it, and its link only for whoever tapped. One open ticket a person.
//   • Close ticket (whoever opened it, or the team: Administrator, Manage Channels or Manage Messages): asked once more, then
//     the channel is deleted, its messages too (Discord keeps no copy, and neither do we).
//   • /post (the owner only): an image, and words under it if any, that she posts herself in the channel picked, as AGI-1. A
//     channel whose name says it's 18+ (nsfw, 18+, 🔞) only once it's marked age-restricted in Discord (Discord's rule for
//     anything sexually explicit).
// Her bot posts with its own token here (DISCORD_BOT_TOKEN). Discord lets a bot post only once it has connected to its
// gateway one time in its life, so a post refused for that (40001) connects once (identifyOnce: hello, identify, READY,
// closed) and goes again. Still nothing kept running (her bot shows as offline), no new function, no new SQL, nothing kept
// by us: who opened a ticket is in its channel's topic, in Discord.
import { discordCall, dcToken, edit, message, onlyYou, later, update, NO_PINGS, FLAG, MAX_UPLOAD } from './discord.js';
import * as D from './dc-lines.js';

// ---------- who may ----------
// Discord's permission bits (as BigInt: an interaction's member.permissions is their total in that channel, as text)
export const P = Object.freeze({
  ADMINISTRATOR: 1n << 3n, MANAGE_CHANNELS: 1n << 4n, ADD_REACTIONS: 1n << 6n, VIEW_CHANNEL: 1n << 10n, SEND_MESSAGES: 1n << 11n,
  MANAGE_MESSAGES: 1n << 13n, EMBED_LINKS: 1n << 14n, ATTACH_FILES: 1n << 15n, READ_MESSAGE_HISTORY: 1n << 16n,
});
// what the person who opened a ticket may do in it, and her bot (only what her bot has itself: Discord refuses more)
export const MEMBER_ALLOW = P.VIEW_CHANNEL | P.SEND_MESSAGES | P.EMBED_LINKS | P.ATTACH_FILES | P.READ_MESSAGE_HISTORY | P.ADD_REACTIONS;
export const BOT_ALLOW = P.VIEW_CHANNEL | P.SEND_MESSAGES | P.EMBED_LINKS | P.ATTACH_FILES | P.READ_MESSAGE_HISTORY;
const permsOf = (member) => { try { return BigInt(member?.permissions ?? 0); } catch { return 0n; } };
// the owner (the server's owner has every permission; nobody else here is an Administrator)
export const isOwner = (member) => (permsOf(member) & P.ADMINISTRATOR) !== 0n;
// the team: Team (Manage Channels) and Mod (Manage Messages)
export const isTeam = (member) => (permsOf(member) & (P.ADMINISTRATOR | P.MANAGE_CHANNELS | P.MANAGE_MESSAGES)) !== 0n;

// ---------- tickets: their names, numbers and topics ----------
export const MAX_OPEN = 45;                              // a category holds 50 channels: a few kept for the team
export const ticketNumberText = (n) => String(n).padStart(4, '0');
export const ticketName = (n) => `🎫┃ticket-${ticketNumberText(n)}`;
const NUMBER = /ticket-(\d{1,6})(?!\d)/;
export const ticketNumber = (name) => { const m = NUMBER.exec(String(name ?? '')); return m ? Number(m[1]) : 0; };
// the next number: one more than any ticket in the server (a closed one is gone, so a number may come back after it)
export const nextTicket = (channels) => (Array.isArray(channels) ? channels : []).reduce((n, c) => Math.max(n, ticketNumber(c?.name)), 0) + 1;
// who opened it, in its topic: their account's id in brackets (Discord's own data, never ours)
export const ticketTag = (uid) => `[${uid}]`;
export const ticketTopic = (n, uid) => `🎫 ticket ${ticketNumberText(n)} · only whoever opened it and the team can see it · ${ticketTag(uid)}`;
const TAGGED = /\[(\d{17,20})\]/;
export const ownerOf = (channel) => TAGGED.exec(String(channel?.topic ?? ''))?.[1] ?? null;
export const isTicket = (channel) => channel?.type === 0 && ticketNumber(channel?.name) > 0 && ownerOf(channel) !== null;
export const isTicketsCategory = (c) => c?.type === 4 && /ticket/i.test(String(c?.name ?? ''));
export const ticketsCategory = (channels) => (Array.isArray(channels) ? channels : []).filter(isTicketsCategory)
  .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0] ?? null;
// a ticket's permissions: its category's (the team's, @everyone kept out), then that person's and her bot's
const overwrite = (o) => ({ id: String(o.id), type: Number(o.type), allow: String(o.allow ?? '0'), deny: String(o.deny ?? '0') });
export function ticketOverwrites(category, uid, botId) {
  const list = (Array.isArray(category?.permission_overwrites) ? category.permission_overwrites : [])
    .filter((o) => /^\d{17,20}$/.test(String(o?.id)) && (Number(o.type) === 0 || Number(o.type) === 1) && String(o.id) !== uid && String(o.id) !== botId)
    .map(overwrite);
  list.push({ id: uid, type: 1, allow: String(MEMBER_ALLOW), deny: '0' }, { id: botId, type: 1, allow: String(BOT_ALLOW), deny: '0' });
  return list;
}

// ---------- her buttons and messages ----------
const row = (...components) => ({ type: 1, components });
const button = (custom_id, label, { style = 2, emoji } = {}) => ({ type: 2, style, custom_id, label, ...(emoji ? { emoji: { name: emoji } } : {}) });
export const panel = () => ({
  content: D.TICKET_PANEL, allowed_mentions: NO_PINGS, flags: FLAG.NO_EMBEDS,
  components: [row(button('tk:open', D.TICKET_BUTTON, { style: 1, emoji: '🎫' }))],
});
export const welcome = (n) => ({
  content: D.ticketWelcome(ticketNumberText(n)), allowed_mentions: NO_PINGS, flags: FLAG.NO_EMBEDS,
  components: [row(button('tk:close', D.TICKET_CLOSE, { emoji: '🔒' }))],
});
const closeRow = () => [row(button('tk:close:yes', D.TICKET_CLOSE_YES, { style: 4 }), button('tk:close:no', D.TICKET_CLOSE_NO))];

// ---------- what this server copy remembers (a few seconds: a double tap) ----------
const opening = new Map();                               // "<server>:<person>" → until when (ms)
const warned = new Set();
const warnOnce = (key, line) => { if (!warned.has(key)) { warned.add(key); console.warn(line); } };
function busyOpening(key, now, ttl = 20_000) {
  if ((opening.get(key) ?? 0) > now) return true;
  if (opening.size >= 2000) opening.delete(opening.keys().next().value);
  opening.set(key, now + ttl);
  return false;
}
// (for the tests: a fresh server copy)
export function forgetTickets() { opening.clear(); warned.clear(); identifying = null; }

// ---------- her bot, posting ----------
// Discord asks a bot to connect to its gateway once in its life before it may post: hello → identify (no events asked for)
// → READY → closed. Never kept open, never her token in a log line.
export const GATEWAY = 'wss://gateway.discord.gg/?v=10&encoding=json';
let identifying = null;
export function identifyOnce(token, { timeoutMs = 8000 } = {}) {
  if (!identifying) identifying = connectOnce(token, timeoutMs).finally(() => { identifying = null; });
  return identifying;
}
async function connectOnce(token, timeoutMs) {
  const Socket = globalThis.WebSocket ?? (await import('ws')).default;
  return new Promise((resolve, reject) => {
    let ws = null, done = false;
    const finish = (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws?.close(1000); } catch { /* closed already */ }
      if (err) reject(err); else resolve(true);
    };
    const timer = setTimeout(() => finish(new Error('discord gateway: no READY in time')), timeoutMs);
    try { ws = new Socket(GATEWAY); } catch (err) { finish(new Error(`discord gateway: ${err.message}`)); return; }
    ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(typeof ev?.data === 'string' ? ev.data : Buffer.from(ev?.data ?? '').toString('utf8')); } catch { return; }
      if (m?.op === 10) ws.send(JSON.stringify({ op: 2, d: { token, intents: 0, properties: { os: 'linux', browser: 'agi1', device: 'agi1' } } }));
      else if (m?.op === 0 && m.t === 'READY') finish();
      else if (m?.op === 9) finish(new Error('discord gateway: invalid session'));
    };
    ws.onerror = () => finish(new Error('discord gateway: the connection failed'));
    ws.onclose = (ev) => finish(new Error(`discord gateway: closed (${ev?.code ?? '?'})`));
  });
}
// A call with her bot's token; refused because her bot never connected (40001): connect once, then once more
export async function botCall(token, path, opts = {}) {
  try {
    return await discordCall(path, { ...opts, token });
  } catch (err) {
    if (err.code !== 40001) throw err;
    await identifyOnce(token);
    console.log('[discord] her bot connected to the gateway once (Discord asks for it before a bot can post)');
    return discordCall(path, { ...opts, token });
  }
}
const noAccess = (err) => err?.status === 403 || err?.code === 50001 || err?.code === 50013;
const optionsOf = (it) => Object.fromEntries((Array.isArray(it.data?.options) ? it.data.options : []).map((o) => [String(o?.name ?? ''), o?.value]));
const channelOf = (it) => String(it.channel_id ?? it.channel?.id ?? '');
const ID = /^\d{17,20}$/;

// ---------- /tickets: her button ----------
export async function ticketsCommand(cfg, it, ctx) {
  if (!isOwner(it.member)) return { response: onlyYou(D.OWNER_ONLY) };
  const token = dcToken(ctx.env);
  if (!token) return { response: onlyYou(D.NO_TOKEN) };
  const channel = channelOf(it);
  if (!ID.test(channel)) return { response: onlyYou(D.TICKET_FAILED) };
  const after = (async () => {
    try {
      await botCall(token, `/channels/${channel}/messages`, { method: 'POST', body: panel(), what: 'her ticket button' });
    } catch (err) {
      console.warn(`[discord] her ticket button didn't go out: ${err.message}`);
      await edit(it, { content: noAccess(err) ? D.ticketsNoAccess(channel) : D.TICKET_FAILED });
      return 'tickets_failed';
    }
    await edit(it, { content: D.TICKETS_POSTED });
    return 'tickets_posted';
  })();
  return { response: later(true), after };
}

// ---------- her tickets' buttons ----------
export async function ticketButton(cfg, it, ctx) {
  const id = String(it.data?.custom_id ?? '');
  if (id === 'tk:open') return openTicket(cfg, it, ctx);
  if (id === 'tk:close') return { response: message(D.TICKET_CLOSE_ASK, { onlyYou: true, components: closeRow() }) };
  if (id === 'tk:close:no') return { response: update(D.TICKET_KEPT) };
  if (id === 'tk:close:yes') return closeTicket(cfg, it, ctx);
  return { response: onlyYou(D.TICKET_OLD) };
}

async function openTicket(cfg, it, ctx) {
  const token = dcToken(ctx.env);
  if (!token) {
    warnOnce('token', "[discord] her tickets need DISCORD_BOT_TOKEN (Developer Portal → Bot → Reset Token, into Vercel, then Redeploy)");
    return { response: onlyYou(D.TICKET_FAILED) };
  }
  const guild = it.guild_id, uid = it.member.user.id, botId = String(it.application_id);
  if (busyOpening(`${guild}:${uid}`, ctx.now)) return { response: onlyYou(D.TICKET_WAIT) };
  const after = (async () => {
    let channels;
    try {
      channels = await discordCall(`/guilds/${guild}/channels`, { token, what: "the server's channels" });
    } catch (err) {
      console.warn(`[discord] couldn't read the server's channels for a ticket: ${err.message}`);
      await edit(it, { content: D.TICKET_FAILED });
      return 'ticket_failed';
    }
    const category = ticketsCategory(channels);
    if (!category) {
      warnOnce('category', '[discord] no tickets category: make a private category with "ticket" in its name (🎫 Tickets), the team and AGI-1 let in');
      await edit(it, { content: D.TICKET_NOT_SET });
      return 'ticket_not_set';
    }
    const open = channels.filter((c) => c?.parent_id === category.id && c?.type === 0);
    const mine = open.find((c) => ownerOf(c) === uid);
    if (mine) {
      await edit(it, { content: D.ticketAlready(mine.id) });
      return 'ticket_already';
    }
    if (open.length >= MAX_OPEN) {
      await edit(it, { content: D.TICKET_FULL });
      return 'ticket_full';
    }
    const n = nextTicket(channels);
    let ticket;
    try {
      ticket = await discordCall(`/guilds/${guild}/channels`, {
        method: 'POST', token, what: 'a ticket', reason: `AGI-1: ticket ${ticketNumberText(n)}, opened with her button`,
        body: { name: ticketName(n), type: 0, parent_id: category.id, topic: ticketTopic(n, uid), permission_overwrites: ticketOverwrites(category, uid, botId) },
      });
    } catch (err) {
      console.warn(`[discord] couldn't open a ticket: ${err.message}${noAccess(err)
        ? " (AGI-1's role needs Manage Channels, and the tickets category's permissions may only allow what she has: View Channel, Send Messages, Embed Links, Attach Files, Read Message History, Add Reactions)" : ''}`);
      await edit(it, { content: D.TICKET_FAILED });
      return 'ticket_failed';
    }
    try {
      await botCall(token, `/channels/${ticket.id}/messages`, { method: 'POST', body: welcome(n), what: "a ticket's first message" });
    } catch (err) {
      console.warn(`[discord] a ticket's first message didn't go out: ${err.message}`);
    }
    await edit(it, { content: D.ticketOpened(ticket.id) });
    return 'ticket_opened';
  })();
  return { response: later(true), after };
}

async function closeTicket(cfg, it, ctx) {
  const token = dcToken(ctx.env);
  if (!token) return { response: update(D.TICKET_FAILED) };
  const channel = channelOf(it);
  const after = (async () => {
    let ticket;
    try {
      ticket = ID.test(channel) ? await discordCall(`/channels/${channel}`, { token, what: 'a ticket' }) : null;
    } catch (err) {
      console.warn(`[discord] couldn't read a ticket to close it: ${err.message}`);
      await edit(it, { content: D.TICKET_FAILED, components: [] });
      return 'close_failed';
    }
    if (!isTicket(ticket)) {
      await edit(it, { content: D.NOT_A_TICKET, components: [] });
      return 'close_not_ticket';
    }
    if (!isTeam(it.member) && ownerOf(ticket) !== it.member.user.id) {
      await edit(it, { content: D.TICKET_NOT_YOURS, components: [] });
      return 'close_not_yours';
    }
    try {
      await discordCall(`/channels/${channel}`, { method: 'DELETE', token, what: 'a ticket', reason: `AGI-1: ticket ${ticketNumberText(ticketNumber(ticket.name))} closed` });
    } catch (err) {
      console.warn(`[discord] couldn't close a ticket: ${err.message}${noAccess(err) ? " (AGI-1's role needs Manage Channels)" : ''}`);
      await edit(it, { content: D.TICKET_FAILED, components: [] }).catch(() => {});
      return 'close_failed';
    }
    return 'closed';
  })();
  return { response: update(D.TICKET_CLOSING), after };
}

// ---------- /post: an image she posts herself ----------
// What an image is, from its first bytes (never just its name or Discord's word for it)
export function imageKind(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(0);
  const at = (i, ...v) => v.every((x, k) => b[i + k] === x);
  if (b.length > 8 && at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { ext: 'png', type: 'image/png' };
  if (b.length > 3 && at(0, 0xff, 0xd8, 0xff)) return { ext: 'jpg', type: 'image/jpeg' };
  if (b.length > 6 && at(0, 0x47, 0x49, 0x46, 0x38)) return { ext: 'gif', type: 'image/gif' };
  if (b.length > 12 && at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return { ext: 'webp', type: 'image/webp' };
  return null;
}
const IMAGE_TYPE = /^image\/(png|jpe?g|gif|webp)\b/i;
const IMAGE_NAME = /\.(png|jpe?g|gif|webp)$/i;
// only Discord's own file addresses (what an attachment's url is: a command's are "ephemeral-attachments")
const DISCORD_CDN = /^https:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net)\/(?:ephemeral-)?attachments\//;
// a channel whose name says it's for adults (nsfw, 18+, 🔞)
export const adultName = (name) => /nsfw|18\+|🔞/iu.test(String(name ?? ''));
export const MAX_CAPTION = 1500;

export async function postCommand(cfg, it, ctx) {
  if (!isOwner(it.member)) return { response: onlyYou(D.OWNER_ONLY) };
  const token = dcToken(ctx.env);
  if (!token) return { response: onlyYou(D.NO_TOKEN) };
  const opt = optionsOf(it);
  const attachment = it.data?.resolved?.attachments?.[String(opt.image ?? '')];
  const channel = String(opt.channel ?? '');
  const caption = typeof opt.caption === 'string' ? opt.caption.trim().slice(0, MAX_CAPTION) : '';
  if (!attachment || !ID.test(channel)) return { response: onlyYou(D.POST_FAILED) };
  if (!(IMAGE_TYPE.test(String(attachment.content_type ?? '')) || IMAGE_NAME.test(String(attachment.filename ?? '')))) return { response: onlyYou(D.POST_NOT_IMAGE) };
  if (Number(attachment.size) > MAX_UPLOAD) return { response: onlyYou(D.POST_TOO_BIG) };
  if (!DISCORD_CDN.test(String(attachment.url ?? ''))) return { response: onlyYou(D.POST_FAILED) };
  const after = (async () => {
    // the channel: one she can see, in this server, and (for an 18+ one) marked age-restricted
    let where;
    try {
      where = await discordCall(`/channels/${channel}`, { token, what: 'the channel to post in' });
    } catch (err) {
      if (!noAccess(err) && err.status !== 404) console.warn(`[discord] couldn't read the channel to post in: ${err.message}`);
      await edit(it, { content: noAccess(err) || err.status === 404 ? D.postNoAccess(channel) : D.POST_FAILED });
      return noAccess(err) || err.status === 404 ? 'post_no_access' : 'post_failed';
    }
    if (String(where?.guild_id ?? '') !== it.guild_id) {
      await edit(it, { content: D.postNoAccess(channel) });
      return 'post_no_access';
    }
    if (adultName(where.name) && where.nsfw !== true) {
      await edit(it, { content: D.postNotAgeRestricted(channel) });
      return 'post_not_age_restricted';
    }
    // the image, from Discord's own address (the owner just sent it), checked by its first bytes
    let bytes, kind;
    try {
      const res = await fetch(attachment.url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      bytes = new Uint8Array(await res.arrayBuffer());
      kind = imageKind(bytes);
    } catch (err) {
      console.warn(`[discord] couldn't read the owner's image: ${err.message}`);
      await edit(it, { content: D.POST_FAILED });
      return 'post_failed';
    }
    if (!kind) { await edit(it, { content: D.POST_NOT_IMAGE }); return 'post_not_image'; }
    if (bytes.length > MAX_UPLOAD) { await edit(it, { content: D.POST_TOO_BIG }); return 'post_too_big'; }
    const filename = `agi1.${kind.ext}`;
    const form = new FormData();
    form.append('payload_json', JSON.stringify({ content: caption, allowed_mentions: NO_PINGS, flags: FLAG.NO_EMBEDS, attachments: [{ id: 0, filename }] }));
    form.append('files[0]', new Blob([bytes], { type: kind.type }), filename);
    try {
      await botCall(token, `/channels/${channel}/messages`, { method: 'POST', form, what: 'her post', timeoutMs: 15_000 });
    } catch (err) {
      console.warn(`[discord] her post didn't go out: ${err.message}`);
      await edit(it, { content: noAccess(err) ? D.postNoAccess(channel) : err.status === 413 || err.code === 40005 ? D.POST_TOO_BIG : D.POST_FAILED });
      return noAccess(err) ? 'post_no_access' : 'post_failed';
    }
    await edit(it, { content: D.postDone(channel) });
    return 'posted';
  })();
  return { response: later(true), after };
}
