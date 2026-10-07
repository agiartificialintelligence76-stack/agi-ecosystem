// AGI-1's live show (2026-10-02, the owner's idea: "what if she livestreams on X and reads the comments and reacts to it?
// like an automated one"): the website's side. Her stream itself runs on the owner's own rented server (tools/live/run.mjs:
// her 2D self, her voice, the video to X); our server keeps her line of questions and her answers.
//   • People send her questions at agi1.app/live (18+, the site's human check) or with /live in her Telegram bot. X's own
//     live chat needs X's approval first (the owner applies): until then, the stream says "Ask me at agi1.app/live".
//   • Each question is checked here first (PG-13, no links, @names, addresses, phone numbers or other coins, a name of 24
//     characters at most), then joins the line in the database (supabase/live.sql: one at a time per person, a minute apart,
//     5 a day; 40 waiting at most; 600 a day for the site). Kept at most 2 days.
//   • The runner takes them one at a time (api/live.js `next`): the AI writes her answer here, with her live prompt (she
//     talks to everyone, PG-13, never real people or other coins, never advice), and says first whether it can be answered
//     on a public stream at all (askAgi1's `skip`). Only then is the question shown on stream, with the name they gave.
//   • The owner controls the show from a phone (agi1.app/live#admin=…, a key made from LIVE_SECRET): pause, skip, block
//     words, clear the line, end the show; and (2026-10-07, the owner's choice: X's chat can't be read without X's approval)
//     pass on a question from X's live chat (relayLive: the same checks, shown as "on X", source 'x').
//   • When her show goes live on X, her Telegram groups hear it once a day (api/live.js 'on_x', live_tell).
// Secrets: LIVE_SECRET (32+ characters, in Vercel and on the owner's server: the runner's key). The owner's phone link is made
// from it (adminKeyFor), so there's no second setting. The Gemini key stays in Vercel: the runner never holds it.
import { createHash, createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { rpc } from './limits.js';
import { askAgi1, TLDS } from './gemini.js';
import { isCrude } from './coins.js';
import { MOODS } from './agi1-prompt.js';

export const LIVE = {
  GAP_S: 60,            // seconds between one person's questions
  PER_DAY: 5,           // one person's questions a day (UTC)
  QUEUE: 40,            // questions waiting at most
  SITE_DAY: 600,        // questions a day for the whole site (each costs one or two AI answers: about $0.0005 each)
  BEAT_S: 45,           // the runner's last word counts this long ("she's on")
  Q_MIN: 3,
  Q_MAX: 200,           // characters in a question
  NAME_MAX: 24,         // characters in a name
  TICKET_H: 6,          // hours a question's ticket works (the page asks where it is with it)
};
export const WATCH_URL = 'https://x.com/agi1dotapp';
export const STATUSES = ['off', 'starting', 'live', 'brb', 'ending'];

// ---------- settings ----------
// Her show is set up when LIVE_SECRET is (32+ characters) and the database is there. (The runner's own settings live on the
// owner's server: tools/live/run.mjs.)
export const liveReady = (cfg) => cfg.liveSecret.length >= 32 && Boolean(cfg.supabaseUrl && cfg.supabaseKey) && cfg.passSecret.length >= 32;
// The owner's phone key: made from LIVE_SECRET, so the owner's link changes when it does (the runner prints the link:
// node tools/live/run.mjs --owner-link)
export const adminKeyFor = (secret) => createHmac('sha256', String(secret)).update('agi1-live-owner').digest('base64url').slice(0, 32);
const fingerprint = (text) => createHash('sha256').update(String(text)).digest();
const same = (a, b) => timingSafeEqual(fingerprint(a), fingerprint(b));       // the same time whatever was sent
// Who's calling with this Authorization header: 'runner' (LIVE_SECRET), 'owner' (the phone key) or null
export function whoIs(header, secret) {
  if (typeof header !== 'string' || !header || String(secret).length < 32) return null;
  const runner = same(header, `Bearer ${secret}`);
  const owner = same(header, `Bearer ${adminKeyFor(secret)}`);
  return runner ? 'runner' : owner ? 'owner' : null;
}

// ---------- a question and a name ----------
const INVISIBLE = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u206f\\ufeff]', 'g');
export const tidyText = (raw) => String(raw ?? '').normalize('NFKC').replace(/[\u2018\u2019\u02bc]/g, "'").replace(/\s+/g, ' ').replace(INVISIBLE, '').replace(/ {2,}/g, ' ').trim();
const LINK = /\b(?:https?:\/\/|www\.)\S+|\b(?:t\.me|telegram\.me|x\.com|twitter\.com|discord\.gg|discord\.com|bit\.ly|tinyurl\.com)\/\S*/i;
const DOMAIN = new RegExp(`(^|[^\\w@.-])((?:[a-z0-9-]+\\.)+(?:${TLDS}))\\b`, 'gi');
// (her own two sites are fine in a question: clank.trade is one of her topics)
const OUR_SITES = /^(?:www\.)?(?:clank\.trade|agi1\.app)$/i;
const otherSite = (t) => [...t.matchAll(DOMAIN)].some((m) => !OUR_SITES.test(m[2]));
const ADDRESS = /0x[0-9a-f]{6,}/i;
const LONG_WORD = /[A-Za-z0-9]{26,}/;                       // a Solana-style address, a transaction, a key… or keyboard spam
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const HANDLE = /(^|[^\w])@[A-Za-z0-9_]{2,}/;
const PHONE = /\+\d[\d\s().-]{7,}\d|\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b/;
const TICKER = /\$([A-Za-z][A-Za-z0-9]{0,15})\b/g;
import { OTHER_COINS, REAL_PEOPLE, DISTRESS, splitWords, mentionsCoinOrPerson } from './live-words.js';
export { OTHER_COINS, REAL_PEOPLE, DISTRESS, splitWords, mentionsCoinOrPerson };
// Why a question can't go on her stream, or null. (The owner's blocked words are checked in the database; what can't be
// checked in code, like a real person or an accusation, her answer decides: askAgi1's "skip".)
export function questionTrouble(text) {
  const t = tidyText(text);
  if (!t) return 'empty';
  if (DISTRESS.test(t)) return 'care';
  const chars = [...t].length;
  if (chars < LIVE.Q_MIN) return 'short';
  if (chars > LIVE.Q_MAX) return 'long';
  if (LINK.test(t) || otherSite(t)) return 'link';
  if (ADDRESS.test(t) || LONG_WORD.test(t)) return 'address';
  if (EMAIL.test(t) || HANDLE.test(t) || PHONE.test(t)) return 'contact';
  for (const m of t.matchAll(TICKER)) if (m[1].toUpperCase() !== 'AGI') return 'coin';
  const named = mentionsCoinOrPerson(t);
  if (named) return named;
  if (isCrude(t)) return 'crude';
  if (/(.)\1{9,}/u.test(t) || !/\p{L}/u.test(t)) return 'spam';
  return null;
}
export function checkQuestion(text) {
  const why = questionTrouble(text);
  return why ? { ok: false, why } : { ok: true, text: tidyText(text) };
}
// The name to show with it (optional): letters, numbers, spaces and a little punctuation (no dots: a name is never an
// address); nothing crude, no coins or real people, and nothing that would pass for her, the team or the show's host,
// however it's written ("AGI1official", "real_agi_1"). The AI looks at it too (askAgi1's "nameOk"): a name it doubts
// shows as "someone".
// (checked with its words split apart: "AGI1official" is "AGI 1 official", "real_agi_1" is "real agi 1")
const POSING = /\b(?:agi(?:\s*(?:1|one|team))?|the\s*team|team|admin|administrator|moderator|mod|official|support|owner|host|staff|dev|developer)\b/i;
export function checkAskName(raw) {
  const name = tidyText(raw);
  if (!name) return { ok: true, name: null };
  const chars = [...name].length;
  if (chars < 3 || chars > LIVE.NAME_MAX || !/^[\p{L}\p{N} '\-_]+$/u.test(name) || !/[\p{L}\p{N}]/u.test(name)) return { ok: false, why: 'name' };
  if (isCrude(name) || POSING.test(splitWords(name)) || mentionsCoinOrPerson(name)) return { ok: false, why: 'name' };
  if (/0x[0-9a-f]{4,}|\d{7,}/i.test(name)) return { ok: false, why: 'name' };
  return { ok: true, name };
}

// ---------- tickets: the page asks where its question is ----------
const b64url = (data) => Buffer.from(data).toString('base64url');
const sign = (secret, text) => b64url(createHmac('sha256', secret).update(`live:${text}`).digest());
export function makeTicket(secret, id, now = Date.now()) {
  const payload = b64url(JSON.stringify({ v: 1, i: id, e: now + LIVE.TICKET_H * 3_600_000 }));
  return `${payload}.${sign(secret, payload)}`;
}
// → the question's number, or null (not one of our tickets, or too old)
export function readTicket(secret, ticket, now = Date.now()) {
  if (typeof ticket !== 'string' || ticket.length > 300) return null;
  const [payload, sig, extra] = ticket.split('.');
  if (!payload || !sig || extra !== undefined || !same(sig, sign(secret, payload))) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return d.v === 1 && Number.isSafeInteger(d.i) && d.i > 0 && typeof d.e === 'number' && d.e > now ? d.i : null;
  } catch {
    return null;
  }
}

// ---------- the database (supabase/live.sql) ----------
const ISO = (t) => (t ? new Date(t).toISOString() : null);
export const liveDb = {
  ask: (cfg, { source, asker, name, question }) => rpc(cfg, 'live_ask', {
    p_source: source, p_asker: asker, p_name: name ?? null, p_question: question,
    p_gap: LIVE.GAP_S, p_per_day: LIVE.PER_DAY, p_queue: LIVE.QUEUE, p_site_day: LIVE.SITE_DAY, p_beat: LIVE.BEAT_S,
  }, 'live'),
  lookup: (cfg, id, asker = null) => rpc(cfg, 'live_lookup', { p_id: id ?? null, p_asker: asker }, 'live'),
  start: (cfg, status) => rpc(cfg, 'live_start', { p_status: status }, 'live'),
  beat: (cfg, show, status, segment, now) => rpc(cfg, 'live_beat', { p_show: show, p_status: status, p_segment: segment ?? null, p_now: now ?? null }, 'live'),
  stop: (cfg, show, next) => rpc(cfg, 'live_stop', { p_show: show, p_next: ISO(next) }, 'live'),
  schedule: (cfg, next) => rpc(cfg, 'live_schedule', { p_next: ISO(next) }, 'live'),
  // (2026-10-07) true only the first time today, for the show that's on: her Telegram groups hear "i'm live" once a day
  tell: (cfg, show) => rpc(cfg, 'live_tell', { p_show: show }, 'live'),
  take: (cfg, show) => rpc(cfg, 'live_take', { p_show: show }, 'live'),
  done: (cfg, id, status, { why = null, reply = null, mood = null } = {}) =>
    rpc(cfg, 'live_done', { p_id: id, p_status: status, p_why: why, p_reply: reply, p_mood: mood }, 'live'),
  state: (cfg) => rpc(cfg, 'live_state_get', { p_beat: LIVE.BEAT_S }, 'live'),
  control: (cfg, action, arg = null) => rpc(cfg, 'live_control', { p_action: action, p_arg: arg, p_beat: LIVE.BEAT_S }, 'live'),
  tidy: (cfg) => rpc(cfg, 'live_tidy', {}, 'live'),
};

// A question for her show, from the site or her bot (already checked: checkQuestion, checkAskName). → the database's answer
// ({ ok, id, position } or { ok: false, why, … })
export async function askLive(cfg, { source, asker, name = null, question }) {
  const q = checkQuestion(question);
  if (!q.ok) return { ok: false, why: q.why };
  const n = checkAskName(name);
  if (!n.ok) return { ok: false, why: 'name' };
  return liveDb.ask(cfg, { source, asker, name: n.name, question: q.text });
}

// ---------- a question from X's live chat, passed on by the owner (2026-10-07) ----------
// X only lets approved apps read a livestream's chat (its Livestream API: the owner applies). Until then the owner copies a
// good question from X's chat into the host's box on agi1.app/live: the same checks as everyone's (and the AI's "skip" and
// "nameOk"), shown on stream as "from <name> on X". The name is the viewer's X name as the owner types it (an "@" in front
// is dropped). Each X name gets a daily code of its own (one question in line at a time, a minute apart, 5 a day, like
// everyone); a question without a name gets a code of its own, so the owner can pass on several.
export const relayName = (raw) => String(raw ?? '').trim().replace(/^@+/, '');
export function relayAsker(secret, name, day = new Date().toISOString().slice(0, 10)) {
  if (!name) return `x:${randomBytes(16).toString('hex')}`;
  return `x:${createHmac('sha256', String(secret)).update(`live-x:${name.toLowerCase()}:${day}`).digest('base64url').slice(0, 32)}`;
}
export async function relayLive(cfg, { question, name = '' }) {
  const n = checkAskName(relayName(name));
  if (!n.ok) return { ok: false, why: 'name' };
  return askLive(cfg, { source: 'x', asker: relayAsker(cfg.passSecret, n.name), name: n.name, question });
}

// ---------- her answer (the runner's "next") ----------
// What she may not say on stream even when the AI wrote it: another coin's ticker, or something the reply cleanup had to take
// out (a link, a handle, an address, an email: said out loud it would sound like "link removed")
export function answerTrouble(reply) {
  const t = String(reply || '');
  if (/\[(?:link|address|email|handle) removed\]/.test(t)) return 'rules';
  for (const m of t.matchAll(TICKER)) if (m[1].toUpperCase() !== 'AGI') return 'rules';
  if (mentionsCoinOrPerson(t)) return 'rules';
  return null;
}
// Whether her answer says this name (as a word of its own, any case): a name the AI doubted (askAgi1's "nameOk") is never
// shown or said, so an answer that says it anyway isn't aired
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const namedIn = (reply, name) => Boolean(name) && new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(name)}($|[^\\p{L}\\p{N}])`, 'iu').test(String(reply));
// The message the AI reads: the question, as a viewer's (the name and where it came from are in her live prompt)
export const questionMessage = (q) => `A viewer asks: ${q.question}`;

// The next question in line with her answer, for the runner. Questions she says can't go on a public stream are skipped
// ('rules', 'care') and the next one is tried, until `deadline` (Vercel stops a function at 25 s). The AI failing puts the
// question back in line (its second failure: skipped). → { question: { id, name, text, source }, reply, mood } ·
// { none: true } (nobody waiting) · { none: true, trouble: 'ai' } (the AI failed: try again in a little while)
export async function nextAnswer(cfg, show, { deadline = Date.now() + 15_000, ask = askAgi1 } = {}) {
  for (let i = 0; i < 6 && deadline - Date.now() > 4000; i++) {
    const q = await liveDb.take(cfg, show);
    if (!q) return { none: true };
    let answer;
    try {
      answer = await ask(cfg, [], questionMessage(q), {
        level: 1, live: { name: q.name, source: q.source }, langSource: 'default',
        timeoutMs: Math.min(10_000, deadline - Date.now() - 1500),
      });
    } catch (err) {
      console.error('[live] gemini failed:', err.message);
      await liveDb.done(cfg, q.id, 'waiting').catch((e) => console.error('[live] putting a question back failed:', e.message));
      return { none: true, trouble: 'ai' };
    }
    // (a name the AI doubted is never shown or said: "someone"; an answer that says it anyway isn't aired)
    const name = q.name && answer.nameOk === true ? q.name : null;
    const reply = answer.reply;
    const skip = ['rules', 'care'].includes(answer.skip) ? answer.skip
      : (q.name && !name && namedIn(reply, q.name)) ? 'rules' : answerTrouble(reply);
    if (skip || !reply) {
      await liveDb.done(cfg, q.id, 'skipped', { why: skip || 'error' });
      continue;
    }
    const mood = MOODS.includes(answer.mood) ? answer.mood : 'neutral';
    const kept = await liveDb.done(cfg, q.id, 'taken', { reply, mood });
    if (kept?.ok !== true) continue;                  // (the owner skipped it meanwhile)
    return { question: { id: q.id, name, text: q.question, source: q.source }, reply, mood };
  }
  return { none: true };
}

// The keep-alive tidies up (3 times a day): questions older than 2 days go, and a show whose runner went quiet is switched
// off. Never throws; nothing to do until supabase/live.sql is run.
export async function tidyLive(cfg) {
  if (!cfg.supabaseUrl || !cfg.supabaseKey) return null;
  try {
    return await liveDb.tidy(cfg);
  } catch (err) {
    if (err.code !== 'PGRST202') console.error('[live] tidying up failed:', err.message);
    return null;
  }
}
