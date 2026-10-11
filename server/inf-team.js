// AGI Studio's team (round 4, phase 2, 2026-10-11; the owner's list: roles on the owner's tab, "Mod tools and customer
// support", support with tickets): the owner adds people by their wallet's address, with a nickname and a role:
//   • 'mod': reports (take things down, clear them), bans (the maker of an influencer: makes nothing any more, shown to nobody
//     but itself, until a mod lifts it) and support tickets;
//   • 'support': support tickets.
// The owner (STUDIO_OWNER, else the first of STUDIO_ONLY_FOR) can do all of it, and manages the team. Addresses are never kept:
// a member is a scrambled code of their wallet (studioWallet), their short address ("0x12ab…cdef", to tell them apart) and
// their nickname. Support tickets keep the person's own words (and the team's answers: the person sees "AGI Studio support",
// the team sees who wrote it), never a seed phrase or a private key (refused before anything is kept).
import { rpc } from './limits.js';
import { studioWallet, newOrderId } from './studio.js';
import { secretIn } from './secrets.js';
import { isOwner } from './influencer.js';
import { BAN_REASONS, TICKET_TOPICS, TICKETS } from '../src/studio/rules.js';

export const TEAM = {
  MAX: 20,                     // members at most
  OPEN_TICKETS: TICKETS.OPEN,  // a wallet's tickets not closed, at once (3)
  MSGS_A_DAY: TICKETS.MSGS_A_DAY,   // a wallet's own messages a day in its tickets (20; opening one is one)
  TICKETS_SITE_DAY: 500,       // tickets opened a day for the whole site
  BODY_MAX: TICKETS.BODY_MAX,
  NOTE_MAX: 200,
  CACHE_MS: 20_000,            // a wallet's role and ban, kept this long per server copy
};
// what each role may do
export const CAN = {
  owner: new Set(['tickets', 'reports', 'bans', 'team', 'admin']),
  mod: new Set(['tickets', 'reports', 'bans']),
  support: new Set(['tickets']),
};
export const ROLES = ['mod', 'support'];
const ID = /^[A-Za-z0-9_-]{22}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
// a nickname: 2 to 24 letters, numbers, spaces, dots, dashes or underscores (a letter or number at each end); never one that
// would pass for the owner or the studio itself
export const NICK = /^[A-Za-z0-9](?:[A-Za-z0-9 ._-]{0,22}[A-Za-z0-9])$/;
const NICK_TAKEN = /^(?:owner|admin|administrator|agi|agi ?studio|agi-?1|support|mod|moderator|team|staff|system)$/i;
export const OWNER_NICK = 'Owner';
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`.toLowerCase();
const ms = (t) => { const n = Date.parse(t ?? ''); return Number.isFinite(n) ? n : null; };

// ---------- who a wallet is ----------
const cache = new Map();                // code → { at, who }
export const _resetTeam = () => cache.clear();
// → { role: 'owner' | 'mod' | 'support' | null, nick, banned } (the owner is never banned; cached a short while per server copy)
export async function whoIs(cfg, wallet, { now = Date.now(), fresh = false } = {}) {
  if (isOwner(cfg, wallet)) return { role: 'owner', nick: OWNER_NICK, banned: false };
  const code = studioWallet(cfg.passSecret, wallet);
  const kept = cache.get(code);
  if (!fresh && kept && now - kept.at < TEAM.CACHE_MS) return kept.who;
  const r = await rpc(cfg, 'inf_who', { p_wallet: code }, 'studio');
  const who = { role: ROLES.includes(r?.role) ? r.role : null, nick: typeof r?.nick === 'string' ? r.nick : null, banned: r?.banned === true };
  cache.set(code, { at: now, who });
  if (cache.size > 5000) cache.delete(cache.keys().next().value);
  return who;
}
export const may = (who, what) => Boolean(who?.role && CAN[who.role]?.has(what));
const forget = (code) => cache.delete(code);

// ---------- the team (the owner's) ----------
export async function teamList(cfg) {
  const list = await rpc(cfg, 'inf_staff_list', {}, 'studio');
  return (Array.isArray(list) ? list : []).map((t) => ({
    code: t.code, role: t.role, nick: t.nick, short: t.short, added: ms(t.added_at), alerts: Number(t.alerts) || 0,
  }));
}
// A member added (or their role or nickname changed) by their wallet's address. → { ok: true, member } or { ok: false, why:
// 'address' | 'self' (the owner's own wallet: already everything) | 'role' | 'nick' | 'nick_taken' | 'too_many' | 'busy' }
export async function teamSet(cfg, { address, role, nick }) {
  const a = String(address ?? '').trim();
  if (!ADDRESS.test(a)) return { ok: false, why: 'address' };
  if (isOwner(cfg, a)) return { ok: false, why: 'self' };
  if (!ROLES.includes(role)) return { ok: false, why: 'role' };
  const n = String(nick ?? '').trim().replace(/\s+/g, ' ');
  if (!NICK.test(n)) return { ok: false, why: 'nick' };
  if (NICK_TAKEN.test(n)) return { ok: false, why: 'nick_taken' };
  const code = studioWallet(cfg.passSecret, a);
  const r = await rpc(cfg, 'inf_staff_set', { p_wallet: code, p_role: role, p_nick: n, p_short: short(a), p_max: TEAM.MAX }, 'studio');
  forget(code);
  if (r?.ok === true) return { ok: true, member: { code, role, nick: n, short: short(a) } };
  return { ok: false, why: ['too_many', 'nick_taken'].includes(r?.why) ? r.why : 'busy' };
}
// A member removed (their alert chats with them). → { ok: true } or { ok: false, why: 'gone' | 'bad' | 'busy' }
export async function teamRemove(cfg, { code }) {
  if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(code)) return { ok: false, why: 'bad' };
  const r = await rpc(cfg, 'inf_staff_set', { p_wallet: code, p_role: null, p_nick: null, p_short: null, p_max: TEAM.MAX }, 'studio');
  forget(code);
  return r?.ok === true ? { ok: true } : { ok: false, why: r?.why === 'gone' ? 'gone' : 'busy' };
}

// ---------- bans (mods and the owner) ----------
// The maker of an influencer banned: it makes nothing in AGI Studio any more, and its influencers are shown to nobody but
// itself. Never the owner's wallet or a team member's. → { ok: true, id, infs } or { ok: false, why: 'bad' | 'gone' |
// 'already' | 'protected' | 'busy' }
export async function banMaker(cfg, { inf, reason, note = '', by }) {
  const text = String(note ?? '').replace(/\s+/g, ' ').trim();
  if (!ID.test(String(inf)) || !Object.hasOwn(BAN_REASONS, reason) || [...text].length > TEAM.NOTE_MAX) return { ok: false, why: 'bad' };
  const protect = cfg.studioOwner ? studioWallet(cfg.passSecret, cfg.studioOwner) : '';
  for (let t = 0; t < 2; t++) {
    const r = await rpc(cfg, 'inf_ban', { p_id: newOrderId(), p_inf: inf, p_reason: reason, p_note: text, p_by: by, p_protect: protect }, 'studio');
    if (r?.ok === true) { cache.clear(); return { ok: true, id: r.id, infs: Number(r.infs) || 0 }; }
    if (r?.why !== 'bad' || t) return { ok: false, why: ['gone', 'already', 'protected', 'bad'].includes(r?.why) ? r.why : 'busy' };
  }
  return { ok: false, why: 'busy' };
}
export async function unban(cfg, { id, by }) {
  if (!ID.test(String(id))) return { ok: false, why: 'bad' };
  const r = await rpc(cfg, 'inf_unban', { p_id: id, p_by: by }, 'studio');
  cache.clear();
  return r?.ok === true ? { ok: true } : { ok: false, why: ['gone', 'done', 'bad'].includes(r?.why) ? r.why : 'busy' };
}
export async function bansList(cfg) {
  const list = await rpc(cfg, 'inf_bans', { p_limit: 100 }, 'studio');
  return (Array.isArray(list) ? list : []).map((b) => ({
    id: b.id, inf: ID.test(String(b.inf_id)) ? b.inf_id : null, name: b.name || null, reason: b.reason, note: b.note || '', by: b.by,
    at: ms(b.at), lifted: ms(b.lifted_at), liftedBy: b.lifted_by || null, infs: Number(b.infs) || 0, tickets: Number(b.tickets) || 0,
  }));
}

// ---------- support tickets ----------
// What someone typed, tidied: control characters out (new lines kept, at most two in a row), at most BODY_MAX characters.
// → { ok: true, body } or { ok: false, why: 'empty' | 'long' | 'secret' (a seed phrase, or what looks like a private key: never
// kept; a transaction's id, "0x" and 64 letters and numbers, is fine) }
// (control and invisible characters: never kept)
const CONTROL = /[\u0000-\u0009\u000b-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2060-\u2064\ufeff]/g;
export function ticketBody(text) {
  const body = String(text ?? '').normalize('NFC').replace(/\r\n?/g, '\n').replace(CONTROL, '')
    .replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!body) return { ok: false, why: 'empty' };
  if ([...body].length > TEAM.BODY_MAX) return { ok: false, why: 'long' };
  const s = secretIn(body);
  if (s === 'seed' || (s === 'key' && /(?:^|[^0-9a-fA-Fx])[0-9a-fA-F]{64}(?![0-9a-fA-F])/.test(body.replace(/0x[0-9a-fA-F]{64}/g, '')))) return { ok: false, why: 'secret' };
  return { ok: true, body };
}
const ticketOf = (t) => ({
  id: t.id, topic: t.topic, status: t.status, unread: t.unread === true, created: ms(t.created_at), updated: ms(t.updated_at), first: t.first || '',
});
// A wallet opens one. → { ok: true, id } or { ok: false, why: 'topic' | 'empty' | 'long' | 'secret' | 'too_many_open' |
// 'too_many' | 'busy_day' | 'busy' }
export async function ticketOpen(cfg, { wallet, topic, body }) {
  if (!Object.hasOwn(TICKET_TOPICS, topic)) return { ok: false, why: 'topic' };
  const b = ticketBody(body);
  if (!b.ok) return b;
  const code = studioWallet(cfg.passSecret, wallet);
  for (let t = 0; t < 2; t++) {
    const id = newOrderId();
    const r = await rpc(cfg, 'inf_ticket_open', {
      p_id: id, p_wallet: code, p_topic: topic, p_body: b.body, p_open_cap: TEAM.OPEN_TICKETS, p_per_day: TEAM.MSGS_A_DAY, p_site_cap: TEAM.TICKETS_SITE_DAY,
    }, 'studio');
    if (r?.ok === true) return { ok: true, id };
    if (r?.why !== 'taken') return { ok: false, why: ['too_many_open', 'too_many', 'busy_day'].includes(r?.why) ? r.why : 'busy' };
  }
  return { ok: false, why: 'busy' };
}
export async function ticketsMine(cfg, wallet) {
  const list = await rpc(cfg, 'inf_tickets_mine', { p_wallet: studioWallet(cfg.passSecret, wallet) }, 'studio');
  return (Array.isArray(list) ? list : []).map(ticketOf);
}
// One ticket's messages, as its own wallet sees them (the team's as "AGI Studio support"), read now; or as the team sees
// them (staff: who of the team wrote each, and the person's influencers, credits and whether they're banned).
// → { ok: true, ticket } or { ok: false, why: 'bad' | 'gone' }
export async function ticketThread(cfg, { id, wallet = null, staff = false }) {
  if (!ID.test(String(id))) return { ok: false, why: 'bad' };
  const code = wallet ? studioWallet(cfg.passSecret, wallet) : null;
  const t = await rpc(cfg, 'inf_ticket_get', { p_ticket: id, p_seen: staff ? null : code }, 'studio');
  if (!t || (!staff && t.wallet_code !== code)) return { ok: false, why: 'gone' };
  const ticket = {
    id: t.id, topic: t.topic, status: t.status, unread: t.user_seen === false, created: ms(t.created_at), updated: ms(t.updated_at),
    closed: ms(t.closed_at),
    msgs: (Array.isArray(t.msgs) ? t.msgs : []).map((m) => ({
      team: m.from_staff === true, ...(staff && m.from_staff ? { by: m.by || null } : {}), body: String(m.body ?? ''), at: ms(m.at),
    })),
  };
  if (staff) {
    const [infs, credits, who] = await Promise.all([
      rpc(cfg, 'inf_mine', { p_wallet: t.wallet_code, p_limit: 12 }, 'studio'), rpc(cfg, 'inf_credits', { p_wallet: t.wallet_code }, 'studio'),
      rpc(cfg, 'inf_who', { p_wallet: t.wallet_code }, 'studio'),
    ]);
    ticket.person = {
      banned: who?.banned === true,
      credits: { paid: Math.max(0, Number(credits?.paid) || 0), free: Math.max(0, Number(credits?.free) || 0), bonus: Math.max(0, Number(credits?.bonus) || 0) },
      influencers: (Array.isArray(infs) ? infs : []).map((i) => ({ id: i.id, name: i.name, status: i.status, hidden: i.hidden === true })),
    };
  }
  return { ok: true, ticket };
}
// A message in a ticket: from its own wallet, or from the team (by: a nickname). → { ok: true } or { ok: false, why: 'bad' |
// 'empty' | 'long' | 'secret' | 'gone' | 'not_yours' | 'closed' | 'too_many' | 'busy' }
export async function ticketSay(cfg, { id, wallet = null, by = null, body }) {
  if (!ID.test(String(id)) || (wallet === null) === (by === null)) return { ok: false, why: 'bad' };
  const b = by ? (() => {
    const t = String(body ?? '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return !t ? { ok: false, why: 'empty' } : [...t].length > TEAM.BODY_MAX ? { ok: false, why: 'long' } : { ok: true, body: t };
  })() : ticketBody(body);
  if (!b.ok) return b;
  const r = await rpc(cfg, 'inf_ticket_say', {
    p_ticket: id, p_wallet: wallet ? studioWallet(cfg.passSecret, wallet) : null, p_by: by, p_body: b.body, p_per_day: TEAM.MSGS_A_DAY,
  }, 'studio');
  return r?.ok === true ? { ok: true } : { ok: false, why: ['gone', 'not_yours', 'closed', 'too_many', 'bad'].includes(r?.why) ? r.why : 'busy' };
}
export async function ticketClose(cfg, { id, wallet = null }) {
  if (!ID.test(String(id))) return { ok: false, why: 'bad' };
  const r = await rpc(cfg, 'inf_ticket_close', { p_ticket: id, p_wallet: wallet ? studioWallet(cfg.passSecret, wallet) : null }, 'studio');
  return r?.ok === true ? { ok: true } : { ok: false, why: ['gone', 'not_yours', 'closed', 'bad'].includes(r?.why) ? r.why : 'busy' };
}
// The team's list: 'open' (waiting for the team), 'answered', 'closed', or all but closed
export async function ticketsStaff(cfg, { status = null } = {}) {
  const s = ['open', 'answered', 'closed'].includes(status) ? status : null;
  const list = await rpc(cfg, 'inf_tickets_staff', { p_status: s, p_limit: 100 }, 'studio');
  return (Array.isArray(list) ? list : []).map((t) => ({ ...ticketOf(t), msgs: Number(t.msgs) || 0, banned: t.banned === true }));
}
