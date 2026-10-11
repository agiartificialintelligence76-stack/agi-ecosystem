// AGI Studio (round 4, phase 3, 2026-10-11; the owner's choices: "gifting bought credits only" (to a wallet by its address,
// its clank.trade name or a gift link; at most 50,000 credits a day) and invites for credits only (a friend's 100 credits with
// its first top-up; its inviter 10% of what it buys, at most 500 credits from one friend and 5,000 a month)).
//   • Gifts: some of a wallet's BOUGHT credits (the ones it bought, and gifts it got; never this month's free ones or bonus
//     ones) to another wallet: by its address, or by the clank.trade name it shows here ("@name"); or a gift link: held until
//     someone claims it once (its secret is the link's part after "#gift=": a page's address never carries it to a server),
//     taken back by its sender while nobody has, and back by itself after its days. A note (80 characters) may go with one.
//     Credits have no cash value: a gift is a gift, never a sale (the page says never to buy credits from anyone).
//   • Invites: each wallet's own invite link (agi1.app/studio/explore?ref=<code>); a wallet that never bought credits joins
//     through one once. With its first top-up of $5 or more it gets 100 bonus credits, and its inviter 10% of each of its
//     top-ups as bonus credits (at most 500 from one friend, 5,000 a month). Settled right after a top-up (server/credits.js),
//     and by the studio's clock for anything missed (server/inf-jobs.js).
// What's kept: supabase/influencers.sql (gifts, invites), under scrambled wallet codes; the other side of a gift is kept as the
// page shows it (a clank.trade name, or a short address "0x12ab…cdef").
import { randomBytes } from 'node:crypto';
import { isAddress } from 'viem';
import { rpc } from './limits.js';
import { studioWallet, newOrderId } from './studio.js';
import { tidy, trouble } from './studio-words.js';
import { secretIn } from './secrets.js';
import { clankNameFrom } from './clank-names.js';
import { GIFTS, REFERRALS, REF_CODE, GIFT_TOKEN } from '../src/studio/rules.js';

const ID = /^[A-Za-z0-9_-]{22}$/;
const NOBODY = new Set(['0x0000000000000000000000000000000000000000', '0x000000000000000000000000000000000000dead']);
const n0 = (x) => Math.max(0, Math.floor(Number(x) || 0));
const ms = (t) => { const n = Date.parse(t ?? ''); return Number.isFinite(n) ? n : null; };
export const shortOf = (address) => `${address.slice(0, 6)}…${address.slice(-4)}`;
// an invite code's letters: never 0, 1, i, l or o (easy to read out); 8 of them, from 31: about 852 billion codes
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export const giftsOn = (cfg) => cfg.infGifts !== false;
export const refsOn = (cfg) => cfg.infRefs !== false;

// Who a gift is for, as typed: a wallet's address (0x and 40 letters and numbers; mixed case must be its checksum, so a typo
// is caught), or a clank.trade name ("@name", "name" or its profile's link). → { kind: 'address', address } | { kind: 'name',
// name } | null
export function recipientFrom(input) {
  const s = String(input ?? '').trim();
  if (!s || s.length > 120) return null;
  if (/^0x[0-9a-fA-F]{40}$/.test(s)) {
    const hex = s.slice(2);
    if (/[a-f]/.test(hex) && /[A-F]/.test(hex) && !isAddress(s, { strict: true })) return null;
    const address = s.toLowerCase();
    return NOBODY.has(address) ? null : { kind: 'address', address };
  }
  if (/^0x/i.test(s)) return null;
  const name = clankNameFrom(s);
  return name ? { kind: 'name', name } : null;
}

// A gift's note: none, or up to GIFTS.NOTE_MAX characters, PG-13, never a link, a contact, a secret or a deal (a gift is never
// a sale: never "cheap", a price, a payment or a place to talk elsewhere). → { ok: true, note (or null) } or { ok: false,
// why: 'note_long' | 'secret' | 'note_link' | 'note_contact' | 'note_deal' | 'note_words' }
const DEAL = /\b(?:sell(?:s|ing)?|resell\w*|cheap(?:er|est)?|discounts?|prices?|pay(?:s|ing|ment)?|paid|cash|usd[gtc]?|eth|btc|sol|dm|dms|telegram|whatsapp|discord|signal|airdrops?|giveaways?|presales?|invest\w*|profit\w*|refunds?)\b|\$\s*\d/i;
export function giftNote(input) {
  if (input === undefined || input === null) return { ok: true, note: null };
  const note = tidy(input);
  if (!note) return { ok: true, note: null };
  // a seed phrase or a private key first, whatever its length (its own warning: never kept, never sent anywhere)
  if (secretIn(note)) return { ok: false, why: 'secret' };
  if ([...note].length > GIFTS.NOTE_MAX) return { ok: false, why: 'note_long' };
  const t = trouble(note);
  if (t === 'link') return { ok: false, why: 'note_link' };
  if (t === 'contact') return { ok: false, why: 'note_contact' };
  if (DEAL.test(note)) return { ok: false, why: 'note_deal' };
  if (t) return { ok: false, why: 'note_words' };
  return { ok: true, note };
}

// How a wallet is shown on the other side of a gift: its clank.trade name ("@name") when it shows one here, else its short
// address ("0x12ab…cdef")
export async function labelOf(cfg, wallet) {
  const address = String(wallet || '').toLowerCase();
  const r = await rpc(cfg, 'inf_name_get', { p_wallet: studioWallet(cfg.passSecret, address) }, 'studio').catch(() => null);
  return typeof r?.name === 'string' && /^[a-z0-9_]{3,32}$/.test(r.name) ? `@${r.name}` : shortOf(address);
}

// The credits of a gift, as typed: a whole number from GIFTS.MIN to the most a day. → the number, or null
function creditsFrom(cfg, x) {
  const v = typeof x === 'string' && /^\d{1,7}$/.test(x.trim()) ? Number(x.trim()) : x;
  return Number.isInteger(v) && v >= GIFTS.MIN && v <= cfg.infGiftDayMax ? v : null;
}
// the database's "no" for a gift, as the page names it (with what's left today, or what it has to give)
const GIFT_WHY = {
  no_name: 'gift_no_name', self: 'gift_self', banned: 'banned', to_banned: 'gift_to_banned', too_many: 'gift_too_many',
  too_many_links: 'gift_links', day_cap: 'gift_day_cap', short: 'gift_short', gone: 'gift_gone', claimed: 'gift_claimed',
  canceled: 'gift_canceled', expired: 'gift_expired', own: 'gift_own', held: 'gift_held', state: 'gift_state', bad: 'bad_request',
};
function giftNo(r) {
  const why = GIFT_WHY[r?.why] || 'busy';
  return { ok: false, why, ...(r?.left !== undefined ? { left: n0(r.left) } : {}), ...(r?.paid !== undefined ? { paid: n0(r.paid) } : {}),
    ...(r?.why === 'claimed' ? { mine: r.mine === true } : {}), ...(r?.status ? { status: String(r.status) } : {}) };
}

// A gift to a wallet: `to` as typed (an address, or a clank.trade name), `credits`, an optional `note`.
// → { ok: true, id, to (as the page shows it), paid (its bought credits now), credits } or { ok: false, why, left?, paid? }
export async function sendGift(cfg, { wallet, to, credits, note }) {
  if (!giftsOn(cfg)) return { ok: false, why: 'gifts_off' };
  const c = creditsFrom(cfg, credits);
  if (!c) return { ok: false, why: 'give_credits' };
  const who = recipientFrom(to);
  if (!who) return { ok: false, why: 'give_to' };
  const from = String(wallet || '').toLowerCase();
  if (who.kind === 'address' && who.address === from) return { ok: false, why: 'gift_self' };
  const n = giftNote(note);
  if (!n.ok) return { ok: false, why: n.why };
  const fromLabel = await labelOf(cfg, from);
  for (let t = 0; t < 2; t++) {
    const id = newOrderId();
    const r = await rpc(cfg, 'inf_send', {
      p_id: id, p_from: studioWallet(cfg.passSecret, from), p_from_label: fromLabel,
      p_to: who.kind === 'address' ? studioWallet(cfg.passSecret, who.address) : null, p_to_name: who.kind === 'name' ? who.name : null,
      p_to_label: who.kind === 'address' ? shortOf(who.address) : null, p_credits: c, p_note: n.note, p_min: GIFTS.MIN,
      p_day_max: cfg.infGiftDayMax, p_day_count: GIFTS.PER_DAY,
    }, 'studio');
    if (r?.ok === true) return { ok: true, id, to: String(r.to_label || ''), paid: n0(r.paid), credits: c };
    if (r?.why !== 'taken') return giftNo(r);
  }
  return { ok: false, why: 'busy' };
}

// A gift link: `credits` of its bought credits held until someone claims it once. → { ok: true, id, token (its secret: the
// page puts it after "#gift="), expires, paid } or { ok: false, why, left?, paid? }
export async function makeGiftLink(cfg, { wallet, credits, note }) {
  if (!giftsOn(cfg)) return { ok: false, why: 'gifts_off' };
  const c = creditsFrom(cfg, credits);
  if (!c) return { ok: false, why: 'give_credits' };
  const n = giftNote(note);
  if (!n.ok) return { ok: false, why: n.why };
  const from = String(wallet || '').toLowerCase();
  const fromLabel = await labelOf(cfg, from);
  for (let t = 0; t < 2; t++) {
    const id = newOrderId();
    let token = newOrderId();
    if (token === id) token = newOrderId();
    const r = await rpc(cfg, 'inf_gift_link', {
      p_id: id, p_token: token, p_from: studioWallet(cfg.passSecret, from), p_from_label: fromLabel, p_credits: c, p_note: n.note,
      p_min: GIFTS.MIN, p_day_max: cfg.infGiftDayMax, p_day_count: GIFTS.PER_DAY, p_open_max: GIFTS.OPEN_LINKS, p_days: GIFTS.LINK_DAYS,
    }, 'studio');
    if (r?.ok === true) return { ok: true, id, token, expires: ms(r.expires), paid: n0(r.paid), credits: c };
    if (r?.why !== 'taken') return giftNo(r);
  }
  return { ok: false, why: 'busy' };
}

// A gift link as anyone with it sees it. → { credits, from, note, status ('open' | 'claimed' | 'canceled' | 'expired'),
// expires } | null (no such link)
export async function peekGift(cfg, token) {
  if (!GIFT_TOKEN.test(String(token || ''))) return null;
  const g = await rpc(cfg, 'inf_gift_peek', { p_token: token }, 'studio');
  if (!g || typeof g !== 'object') return null;
  return {
    credits: n0(g.credits), from: String(g.from || ''), note: typeof g.note === 'string' ? g.note : null,
    status: ['open', 'claimed', 'canceled', 'expired'].includes(g.status) ? g.status : 'expired', expires: ms(g.expires),
  };
}

// A gift link claimed by this wallet. → { ok: true, credits, from, paid } or { ok: false, why ('gift_gone' | 'gift_claimed'
// (with mine) | 'gift_canceled' | 'gift_expired' | 'gift_own' | 'gift_held' | 'banned' | …) }
export async function claimGift(cfg, { wallet, token }) {
  if (!giftsOn(cfg)) return { ok: false, why: 'gifts_off' };
  if (!GIFT_TOKEN.test(String(token || ''))) return { ok: false, why: 'gift_gone' };
  const r = await rpc(cfg, 'inf_gift_claim', {
    p_token: token, p_wallet: studioWallet(cfg.passSecret, wallet), p_label: await labelOf(cfg, wallet),
  }, 'studio');
  if (r?.ok === true) return { ok: true, credits: n0(r.credits), from: String(r.from || ''), paid: n0(r.paid) };
  return giftNo(r);
}

// Its sender takes a gift link back. → { ok: true, paid, status ('canceled' | 'expired') } or { ok: false, why }
export async function cancelGift(cfg, { wallet, id }) {
  if (!ID.test(String(id || ''))) return { ok: false, why: 'bad_request' };
  const r = await rpc(cfg, 'inf_gift_cancel', { p_id: id, p_from: studioWallet(cfg.passSecret, wallet) }, 'studio');
  if (r?.ok === true) return { ok: true, paid: n0(r.paid), status: r.status === 'expired' ? 'expired' : 'canceled' };
  return giftNo(r);
}

// A wallet's gifts (the newest 40 it gave or got: the ones it got are seen from then on) and its invite rewards (the newest
// 20). → { gifts: [{ id, dir ('in' | 'out'), credits, other, note, status, link, token (its own open links' secret), seen,
// created, expires, done }], rewards: [{ kind ('ref' | 'welcome'), amount, at }] }
export async function myGifts(cfg, wallet) {
  const r = await rpc(cfg, 'inf_gifts_mine', { p_wallet: studioWallet(cfg.passSecret, wallet) }, 'studio');
  const gifts = (Array.isArray(r?.gifts) ? r.gifts : []).filter((g) => ID.test(String(g?.id))).map((g) => ({
    id: g.id, dir: g.dir === 'in' ? 'in' : 'out', credits: n0(g.credits), other: typeof g.other === 'string' ? g.other : null,
    note: typeof g.note === 'string' ? g.note : null,
    status: ['sent', 'open', 'claimed', 'canceled', 'expired'].includes(g.status) ? g.status : 'expired', link: g.link === true,
    token: g.dir === 'out' && g.status === 'open' && GIFT_TOKEN.test(String(g.token || '')) ? g.token : null, seen: g.seen !== false,
    created: ms(g.created_at), expires: ms(g.expires_at), done: ms(g.done_at),
  }));
  const rewards = (Array.isArray(r?.rewards) ? r.rewards : []).filter((x) => ['ref', 'welcome'].includes(x?.kind))
    .map((x) => ({ kind: x.kind, amount: n0(x.amount), at: ms(x.at) }));
  return { gifts, rewards };
}

// ---------- invites ----------
// a new invite code: 8 of ALPHABET's letters, picked evenly (bytes over 247 are thrown away: 248 = 8 × 31)
export function newInviteCode() {
  let out = '';
  while (out.length < 8) {
    for (const b of randomBytes(16)) {
      if (b < 248 && out.length < 8) out += ALPHABET[b % 31];
    }
  }
  return out;
}

// A wallet's invite code (made the first time) and how its invites went. → { code, friends, buyers, earnedMonth, earned } |
// null (no code could be made just now)
export async function inviteOf(cfg, wallet) {
  const code = studioWallet(cfg.passSecret, wallet);
  for (let t = 0; t < 4; t++) {
    const r = await rpc(cfg, 'inf_ref_code', { p_wallet: code, p_new: newInviteCode() }, 'studio');
    if (typeof r?.code === 'string' && REF_CODE.test(r.code)) {
      return { code: r.code, friends: n0(r.friends), buyers: n0(r.buyers), earnedMonth: n0(r.earned_month), earned: n0(r.earned) };
    }
  }
  return null;
}

// A wallet joins through an invite code (the page keeps it from an invite link until a wallet signs in). → { ok: true } or
// { ok: false, why: 'refs_off' | 'ref_bad' | 'ref_none' | 'ref_self' | 'ref_already' | 'ref_bought' | 'ref_loop' | 'banned' }
export async function bindInvite(cfg, { wallet, code }) {
  if (!refsOn(cfg)) return { ok: false, why: 'refs_off' };
  const c = String(code ?? '').trim().toLowerCase();
  if (!REF_CODE.test(c)) return { ok: false, why: 'ref_bad' };
  const r = await rpc(cfg, 'inf_ref_bind', { p_wallet: studioWallet(cfg.passSecret, wallet), p_code: c }, 'studio');
  if (r?.ok === true) return { ok: true };
  const why = { none: 'ref_none', self: 'ref_self', already: 'ref_already', bought: 'ref_bought', loop: 'ref_loop', banned: 'banned', bad: 'ref_bad' }[r?.why];
  return { ok: false, why: why || 'busy' };
}

// Invites' rewards for top-ups not counted yet: one wallet's (right after its top-up), or everyone's (the clock's catch-up,
// at most `limit`). → { settled, reward, welcome } (all zero while invites are off)
export async function settleInvites(cfg, { wallet = null, limit = 100 } = {}) {
  if (!refsOn(cfg)) return { settled: 0, reward: 0, welcome: 0 };
  const r = await rpc(cfg, 'inf_ref_settle', {
    p_wallet: wallet ? studioWallet(cfg.passSecret, wallet) : null, p_percent: cfg.infRefPercent, p_per_friend: cfg.infRefPerFriend,
    p_month_cap: cfg.infRefMonth, p_welcome: cfg.infRefWelcome, p_welcome_min: REFERRALS.WELCOME_MIN, p_limit: limit,
  }, 'studio');
  return { settled: n0(r?.settled), reward: n0(r?.reward), welcome: n0(r?.welcome) };
}

// What the page needs to know about gifts and invites (?inf-info: the same for everyone)
export function giftsInfo(cfg) {
  return {
    gifts: giftsOn(cfg) ? { min: GIFTS.MIN, dayMax: cfg.infGiftDayMax, perDay: GIFTS.PER_DAY, openLinks: GIFTS.OPEN_LINKS, linkDays: GIFTS.LINK_DAYS, noteMax: GIFTS.NOTE_MAX } : null,
    refs: refsOn(cfg) ? {
      welcome: cfg.infRefWelcome, welcomeMin: REFERRALS.WELCOME_MIN, percent: cfg.infRefPercent, perFriend: cfg.infRefPerFriend,
      month: cfg.infRefMonth,
    } : null,
  };
}
