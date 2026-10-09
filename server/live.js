// AGI-1's live show (2026-10-02, the owner's idea: "what if she livestreams on X and reads the comments and reacts to it?
// like an automated one"): the website's side. Her stream itself runs on the owner's own rented server (tools/live/run.mjs:
// her 2D self, her voice, the video to X); our server keeps her line of questions and her answers.
//   • People send her questions at agi1.app/live (18+, the site's human check) or with /live in her Telegram bot. X's own
//     live chat needs X's approval first (the owner applies): until then the owner passes good ones on (relayLive).
//   • Each question is checked here first (PG-13, no links, @names, addresses or phone numbers, a name of 24 characters at
//     most), then joins the line in the database (supabase/live.sql: one at a time per person, a minute apart, 5 a day; 40
//     waiting at most; 600 a day for the site). Kept at most 2 days.
//   • The runner takes them one at a time (api/live.js `next`): the AI writes her answer here, with her live prompt (she
//     talks to everyone, PG-13, never advice), and says first whether it can be answered on a public stream at all
//     (askAgi1's `skip`). Only then is the question shown on stream, with the name they gave, and she reads it out loud.
//   • (2026-10-09, the owner: "there would be no restrictions on how short their message are", "she can say names now no
//     restrictions", "she can mention other coins as well", "she will know every person's real name on the telegram just
//     like in the website version of her with her memories") a question can be a single character (or an emoji), other
//     coins and real people can come up (never advice: her live prompt), a name is anything but crude or posing as her or
//     her team, a Telegram question shows the person's own Telegram name, and her answer knows the clank.trade Telegram
//     group like her chat on the site does (server/tg-memory.js: only when the question is about it).
//   • The owner controls the show from a phone (agi1.app/live#admin=…, a key made from LIVE_SECRET): pause, skip, block
//     words, clear the line, end the show; and (2026-10-07, the owner's choice: X's chat can't be read without X's approval)
//     pass on a question from X's live chat (relayLive: the same checks, shown as "on X", source 'x').
//   • When her show goes live on X, her Telegram groups hear it once a day (api/live.js 'on_x', live_tell).
//   • (2026-10-10, holder perks: the owner, "you can also add more utility to $agi so holders are happy") a question sent at
//     agi1.app/live with a connected wallet (the site's sign-in: a free signature) at Crush (10,000+ $AGI held or burned for
//     messages) or Soulmate (1,000,000+) carries her 💜 badge on stream and a head start in her line (LIVE.HEAD_S: ahead of
//     the questions sent in the 10 minutes before it, never further), at most 5 badges a day per wallet; a Soulmate's also
//     gets her shout-out on stream (tools/live). Its level comes from the wallet's session (liveHolder: re-read on the chain
//     when it's 30 minutes old, like her chat's). A thank-you, never an investment: nothing is spent or promised.
// Secrets: LIVE_SECRET (32+ characters, in Vercel and on the owner's server: the runner's key). The owner's phone link is made
// from it (adminKeyFor), so there's no second setting. The Gemini key stays in Vercel: the runner never holds it.
import { createHash, createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { rpc } from './limits.js';
import { readSession, makeSession, needsRecheck, RECHECK_MS } from './session.js';
import { askAgi1, askScene, TLDS } from './gemini.js';
import { isCrude } from './coins.js';
import { MOODS } from './agi1-prompt.js';
import { canList, actOf, DESTINATIONS, PEOPLE, LOCAL } from './live-acts.js';
import { recallGroup } from './tg-memory.js';
import { secretIn } from './secrets.js';

export const LIVE = {
  GAP_S: 60,            // seconds between one person's questions
  PER_DAY: 5,           // one person's questions a day (UTC)
  QUEUE: 40,            // questions waiting at most
  SITE_DAY: 600,        // questions a day for the whole site (each costs one or two AI answers: about $0.0005 each)
  BEAT_S: 45,           // the runner's last word counts this long ("she's on")
  Q_MIN: 1,             // (2026-10-09, the owner: "no restrictions on how short their message are": 3 before)
  Q_MAX: 200,           // characters in a question
  NAME_MAX: 24,         // characters in a name
  TICKET_H: 6,          // hours a question's ticket works (the page asks where it is with it)
  HEAD_S: 600,          // (2026-10-10) a 💜 badge's head start in her line: ahead of the questions sent 10 minutes before it
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
import { OTHER_COINS, REAL_PEOPLE, DISTRESS, splitWords, mentionsCoinOrPerson, mentionsCoin } from './live-words.js';
export { OTHER_COINS, REAL_PEOPLE, DISTRESS, splitWords, mentionsCoinOrPerson, mentionsCoin };
// Why a question can't go on her stream, or null. (The owner's blocked words are checked in the database; what can't be
// checked in code, like an accusation or a private person, her answer decides: askAgi1's "skip".) Real people may come up
// since 2026-10-07 (the owner: "always be neutral on the answers on that"), and since 2026-10-09 other coins too (the
// owner: "she can mention other coins as well"; her live prompt: never advice) and a question of any length (the owner:
// "there would be no restrictions on how short their message are": a single letter, a "?" or an emoji is a question).
// What still never goes on a public stream: links, addresses, contact details, crude words, keyboard spam.
// (max: 2026-10-07, her own X posts and the replies under them are checked the same way, up to POST_MAX characters)
export function questionTrouble(text, { max = LIVE.Q_MAX } = {}) {
  const t = tidyText(text);
  if (!t) return 'empty';
  if (DISTRESS.test(t)) return 'care';
  // (2026-10-09) a wallet's seed phrase or private key sent by mistake: never on stream (server/secrets.js)
  if (secretIn(t)) return 'secret';
  const chars = [...t].length;
  if (chars < LIVE.Q_MIN) return 'short';
  if (chars > max) return 'long';
  if (LINK.test(t) || otherSite(t)) return 'link';
  if (ADDRESS.test(t) || LONG_WORD.test(t)) return 'address';
  if (EMAIL.test(t) || HANDLE.test(t) || PHONE.test(t)) return 'contact';
  if (isCrude(t)) return 'crude';
  if (/(.)\1{9,}/u.test(t)) return 'spam';
  // (2026-10-09: she reads a question out loud now, and other coins may come up, so something that tells people to get
  // or let go of a coin, or calls a price, and isn't a question is a shill she'd be saying: "buy $XYZ now". Asked as a
  // question ("should i buy some bitcoin?") it's fine: she answers it without advice)
  if (ADVICE.test(t) && !/\?[\s"'”’)\p{Extended_Pictographic}\u200d\ufe0f]*$/u.test(t)) return 'advice';
  return null;
}
export function checkQuestion(text) {
  const why = questionTrouble(text);
  return why ? { ok: false, why } : { ok: true, text: tidyText(text) };
}
// The name to show with it (optional): since 2026-10-09 (the owner: "she can say names now no restrictions") any name of
// 1 to 24 characters (letters of any alphabet, numbers, spaces, emoji, a little punctuation), a real person's or a coin's
// too: it's what the viewer typed, and she never says that person is there. What a public stream still never shows:
// something crude, a link, an address or a contact, and anything that would pass for her, her team or the show's host,
// however it's written ("AGI1official", "real_agi_1": a name like that next to a question could fool people). The AI
// looks at it too (askAgi1's "nameOk", only for those): a name it doubts shows as "someone".
// (checked with its words split apart: "AGI1official" is "AGI 1 official", "real_agi_1" is "real agi 1")
// (2026-10-09: no more "owner", "host", "dev" or "developer" on their own: everyday names and nicknames, "Dev" included)
const POSING = /\b(?:agi(?:\s*(?:1|one|team))?|the\s*team|team|admin|administrator|moderator|mod|mods|official|support|staff)\b/i;
const NAME_CHARS = /^[\p{L}\p{M}\p{N}\p{Extended_Pictographic}\u200d\ufe0f '\-_.!?&]+$/u;
export function checkAskName(raw) {
  const name = tidyText(raw);
  if (!name) return { ok: true, name: null };
  const chars = [...name].length;
  if (chars > LIVE.NAME_MAX || !NAME_CHARS.test(name) || !/[\p{L}\p{N}\p{Extended_Pictographic}]/u.test(name)) return { ok: false, why: 'name' };
  if (isCrude(name) || POSING.test(splitWords(name))) return { ok: false, why: 'name' };
  if (/0x[0-9a-f]{4,}|\d{7,}/i.test(name) || LINK.test(name) || otherSite(name) || EMAIL.test(name)) return { ok: false, why: 'name' };
  // (2026-10-09) a name that's a shill ("pepe to the moon") isn't a name
  if (ADVICE.test(name)) return { ok: false, why: 'name' };
  return { ok: true, name };
}
// (2026-10-09, the owner: "she will know every person's real name on the telegram") the name a question from her Telegram
// bot shows on stream: the person's own Telegram name (their first and last name, else their first name, else their
// @username without the @), checked like any name; none that passes: "someone on Telegram". Her bot tells them before they
// ask (server/live-lines.js HOW).
export function telegramName(from) {
  if (!from || typeof from !== 'object' || from.is_bot) return null;
  const first = tidyText(from.first_name).slice(0, 64), last = tidyText(from.last_name).slice(0, 64);
  const tries = [[first, last].filter(Boolean).join(' '), first, tidyText(from.username)];
  for (const t of tries) {
    if (!t || [...t].length > LIVE.NAME_MAX) continue;
    const n = checkAskName(t);
    if (n.ok && n.name) return n.name;
  }
  // (a first name longer than 24 characters: its first word, if that fits)
  const word = first.split(' ')[0];
  if (word && word !== first && [...word].length <= LIVE.NAME_MAX) { const n = checkAskName(word); if (n.ok && n.name) return n.name; }
  return null;
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
let oldSqlSaid = false;
export const liveDb = {
  // (2026-10-10) holder, holderCode: her 💜 badge (2 Crush, 3 Soulmate) and a daily code of the wallet. A question without
  // one asks exactly as before; with one, live.sql from before 2026-10-10 (no badge settings: PGRST202) takes it without its
  // badge, and the log says once per server copy to run live.sql again
  ask: async (cfg, { source, asker, name, question, holder = 0, holderCode = null }) => {
    const args = {
      p_source: source, p_asker: asker, p_name: name ?? null, p_question: question,
      p_gap: LIVE.GAP_S, p_per_day: LIVE.PER_DAY, p_queue: LIVE.QUEUE, p_site_day: LIVE.SITE_DAY, p_beat: LIVE.BEAT_S,
    };
    if (![2, 3].includes(holder) || !holderCode) return rpc(cfg, 'live_ask', args, 'live');
    try {
      return await rpc(cfg, 'live_ask', { ...args, p_holder: holder, p_holder_code: holderCode, p_head: LIVE.HEAD_S }, 'live');
    } catch (err) {
      if (err.code !== 'PGRST202') throw err;
      if (!oldSqlSaid) { oldSqlSaid = true; console.warn('[live] a question came with a 💜 badge, but supabase/live.sql is from before 2026-10-10: it went in without one. Run supabase/live.sql again (it keeps everything saved)'); }
      return rpc(cfg, 'live_ask', args, 'live');
    }
  },
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
// ({ ok, id, position, holder } or { ok: false, why, … })
// holder, holderCode (2026-10-10, only from the site, with a wallet): her 💜 badge and the wallet's daily code (holderCode)
export async function askLive(cfg, { source, asker, name = null, question, holder = 0, holderCode = null }) {
  const q = checkQuestion(question);
  if (!q.ok) return { ok: false, why: q.why };
  const n = checkAskName(name);
  if (!n.ok) return { ok: false, why: 'name' };
  return liveDb.ask(cfg, { source, asker, name: n.name, question: q.text, holder, holderCode });
}

// ---------- (2026-10-10) holder perks: her 💜 badge on stream and a head start in her line ----------
// A wallet's code for a day: an HMAC of its address with PASS_SECRET and the day (UTC), never the address itself; a new one
// every day, and not the code her chat's memory files a wallet under (server/session.js walletCode), so a question can't be
// matched to a name or notes. Only to count a wallet's badges a day (live.sql), kept with the question (2 days at most).
export const holderCode = (secret, wallet, day = new Date().toISOString().slice(0, 10)) =>
  createHmac('sha256', String(secret)).update(`live-holder:${String(wallet).toLowerCase()}:${day}`).digest('base64url').slice(0, 32);
const RETRY_MS = 5 * 60 * 1000;          // a level the chain couldn't read: re-read in about 5 minutes (as her chat does)
// The wallet session a question came with (the site's sign-in, src/lib/wallet.js: a free signature, never a transaction):
// its level now, re-read on the chain when it's 30 minutes old (what was burned for messages counts too), like her chat's.
// → null (no session sent) · { signedOut: true } (an old or broken session: the page forgets it) · { level, wallet,
// session } (session: a new one when the level was re-read, else null). Never throws (the chain away: its last level)
export async function liveHolder(cfg, token, { now = Date.now(), check = null, burned = null } = {}) {
  if (token === undefined || token === null || token === '') return null;
  const s = readSession(cfg.passSecret, token, now);
  if (!s) return { signedOut: true };
  if (!needsRecheck(s, now)) return { level: s.level, wallet: s.wallet, session: null };
  const checkLevel = check || (await import('./chain.js')).checkLevel;
  const burnedAgi = burned || (await import('./burn.js')).burnedAgi;
  const r = await checkLevel(s.wallet, s.level, undefined, await burnedAgi(cfg, s.wallet));
  const session = makeSession(cfg.passSecret, { wallet: s.wallet, level: r.level, checkedAt: r.checked ? now : now - RECHECK_MS + RETRY_MS, expiresAt: s.expiresAt }, now);
  return { level: r.level, wallet: s.wallet, session };
}
// her badge's name, on stream and on the host's panel (the site's own levels: src/lib/levels.js)
export const BADGES = { 2: 'Crush', 3: 'Soulmate' };

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
// What she may not say on stream even when the AI wrote it: something the reply cleanup had to take out (a link, a handle,
// an address, an email: said out loud it would sound like "link removed"). (A real person's name is fine since 2026-10-07,
// and another coin since 2026-10-09: her prompt keeps her neutral and never gives advice.)
// And (2026-10-09: other coins may come up now, so hard rule 8 gets a safety net in code too; her live prompt is the first
// one) anything that tells people to get or let go of a coin, or calls a price: "buy some", "you should sell", "it's going
// to pump", "to the moon"… (her own words stay free: "i'd buy you a coffee" is fine)
export const ADVICE = new RegExp([
  String.raw`\b(?:you should|you need to|you gotta|go|time to|better|must|definitely)\s+(?:buy|sell|ape|load up|dump)\b`,
  String.raw`\b(?:buy|sell|ape into|load up on|dump)\s+(?:some|more|now|it now|the dip|all|everything|your|\$\w+|bitcoin|btc|eth|sol|doge|pepe|this coin|that coin)\b`,
  String.raw`\b(?:going to|gonna|will|about to|is set to)\s+(?:pump|moon|10x|100x|1000x|skyrocket|explode|go parabolic)\b`,
  String.raw`\b(?:to the moon|guaranteed (?:gains|profits?|returns)|easy money|price target|financial freedom|can't lose|cannot lose)\b`,
].join('|'), 'i');
export function answerTrouble(reply) {
  const t = String(reply || '');
  if (/\[(?:link|address|email|handle) removed\]/.test(t)) return 'rules';
  if (ADVICE.test(t)) return 'rules';
  return null;
}
// Whether her answer says this name (as a word of its own, any case): a name the AI doubted (askAgi1's "nameOk") is never
// shown or said, so an answer that says it anyway isn't aired
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const namedIn = (reply, name) => Boolean(name) && new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(name)}($|[^\\p{L}\\p{N}])`, 'iu').test(String(reply));
// The message the AI reads: the question, as a viewer's (the name and where it came from are in her live prompt)
export const questionMessage = (q) => `A viewer asks: ${q.question}`;
// (2026-10-09, the owner: "she will know every person's real name on the telegram just like in the website version of her
// with her memories") her memory of the clank.trade Telegram group, as on the site (server/tg-memory.js): only when the
// question is about the group or someone in it, at most 4 short cards
export const memoryFor = (q) => recallGroup(String(q?.question || ''));

// The next question in line with her answer, for the runner. Questions she says can't go on a public stream are skipped
// ('rules', 'care') and the next one is tried, until `deadline` (Vercel stops a function at 25 s). The AI failing puts the
// question back in line (its second failure: skipped). → { question: { id, name, text, source }, reply, mood, act } ·
// { none: true } (nobody waiting) · { none: true, trouble: 'ai' } (the AI failed: try again in a little while)
// can (2026-10-07, viewers' requests): what she can do on stream right now (her stream says: server/live-acts.js); `act` is
// what the viewer asked her to do, one of those ({ act, times, part, to }), or null
// place (2026-10-07): where she's streaming from right now (one of DESTINATIONS' ids, or nothing): her prompt says it
export async function nextAnswer(cfg, show, { deadline = Date.now() + 15_000, ask = askAgi1, can = [], place = null } = {}) {
  const ok = canList(can);
  const where = Object.hasOwn(DESTINATIONS, place) ? DESTINATIONS[place] : null;
  for (let i = 0; i < 6 && deadline - Date.now() > 4000; i++) {
    const q = await liveDb.take(cfg, show);
    if (!q) return { none: true };
    let answer;
    try {
      const memory = memoryFor(q);
      answer = await ask(cfg, [], questionMessage(q), {
        level: 1, live: { name: q.name, source: q.source, ...(ok.length ? { can: ok } : {}), ...(where ? { place: where } : {}) }, langSource: 'default',
        ...(memory.length ? { memory } : {}), timeoutMs: Math.min(10_000, deadline - Date.now() - 1500),
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
    // (2026-10-07) how she feels saying it (one of her emotions on stream) and the question's language
    // (2026-10-10) holder: its 💜 badge (2 Crush, 3 Soulmate, 0 none): her card shows it, and a Soulmate gets her shout-out
    const holder = [2, 3].includes(q.holder) ? q.holder : 0;
    return { question: { id: q.id, name, text: q.question, source: q.source, holder }, reply, mood, act: ok.length ? actOf(answer, ok) : null,
      ...(answer.feel ? { feel: answer.feel } : {}), ...(answer.lang ? { lang: answer.lang } : {}) };
  }
  return { none: true };
}

// ---------- (2026-10-07) between things: something new to say, and her reactions to her own X posts and videos ----------
// The owner: "says a lot in stream, not just the same things over and over", and "react to her own X posts/videos and
// replies". Her stream asks (api/live.js 'chat', 'react'); the AI writes it here, with her live rules, and it's checked
// like her answers (answerTrouble). Each costs one AI answer (about $0.0005); her stream asks at most about one a minute.
// What she may talk about between things: the stream says which (never a viewer's words), with facts from her own show
export const CHATTER = {
  anything: 'anything fun and light: a thought about being an AI girlfriend who streams, a little story about your day, a harmless hot take (pineapple on pizza, cats vs dogs), something cozy, or a playful question for everyone (they can answer at agi1.app/live)',
  room: 'the room you are streaming from right now: what you like about it, what you would do there',
  outfit: 'the outfit you are wearing right now on stream',
  music: 'the music playing on your stream right now (your own songs, made in code)',
  time: 'where everyone might be watching from right now, and what time it is for them',
  show: 'how your show is going so far: thank everyone for being here',
  dance: 'your dancing on stream just now',
  song: 'singing your own song "Feel the AGI" on stream just now',
  // (2026-10-07) her trips, her snacks, the weather
  place: 'the place you are visiting right now on your show (a real place, or the Moon or Mars): what you see, something you are sure is true about it, what you would love to do or taste there; nothing political',
  trip: 'the trip you just took on your show to get here (the vehicle, the view on the way)',
  food: 'the snack you just ate on stream',
  weather: 'the weather on your stream right now',
};
const fact = (s) => tidyText(s).slice(0, 120);
// her stream's topic → { about, facts, recent } (facts and her own recent lines tidied; unknown topics: 'anything')
export function chatterTopic(raw = {}) {
  const kind = Object.hasOwn(CHATTER, raw?.kind) ? raw.kind : 'anything';
  const facts = (Array.isArray(raw?.facts) ? raw.facts : []).filter((x) => typeof x === 'string').map(fact).filter(Boolean).slice(0, 4);
  const recent = (Array.isArray(raw?.recent) ? raw.recent : []).filter((x) => typeof x === 'string').map((x) => tidyText(x).slice(0, 220)).filter(Boolean).slice(-6);
  // (facts come from her own stream, but they go into her prompt: nothing a question couldn't say on stream either)
  return { kind, about: CHATTER[kind], facts: facts.filter((f) => !questionTrouble(f) || questionTrouble(f) === 'short'), recent };
}
async function liveLine(cfg, message, live, { ask = askAgi1, timeoutMs = 9000 } = {}) {
  let answer;
  try {
    answer = await ask(cfg, [], message, { level: 1, live, langSource: 'default', timeoutMs });
  } catch (err) {
    console.error('[live] gemini failed:', err.message);
    return { none: true, trouble: 'ai' };
  }
  if (['rules', 'care'].includes(answer.skip)) return { skip: 'rules' };
  const reply = String(answer.reply || '');
  if (!reply || answer.skip !== 'no' || answerTrouble(reply)) return { skip: 'rules' };
  return { reply, mood: MOODS.includes(answer.mood) ? answer.mood : 'neutral', ...(answer.feel ? { feel: answer.feel } : {}) };
}
// → { reply, mood } · { skip: 'rules' } (what it wrote can't go on stream) · { none: true, trouble: 'ai' }
export async function chatterAnswer(cfg, raw, opts = {}) {
  const c = chatterTopic(raw);
  return liveLine(cfg, 'Say something new to everyone watching.', { chatter: c }, opts);
}

// Her own post on X, or a reply under one, as it can be shown on her stream: X's own short links (t.co) taken out, tidied,
// and checked like a viewer's question (a longer one: up to 400 characters). → { ok, text } or { ok: false, why }
export const POST_MAX = 400;
export function checkPost(raw) {
  const t = tidyText(String(raw ?? '').replace(/https?:\/\/t\.co\/\w+/gi, ' ')).replace(/\s+([.,!?])/g, '$1').trim();
  if (!t) return { ok: false, why: 'empty' };
  if ([...t].length > POST_MAX) return { ok: false, why: 'long' };
  // (her own posts can say agi1.app or clank.trade: questionTrouble allows those; and a short one is fine)
  const why = questionTrouble(t, { max: POST_MAX });
  if (why && why !== 'short') return { ok: false, why };
  // (2026-10-09: other coins may come up now, but a reply shown on her stream that tells people to get or let go of a coin,
  // or calls a price, is a shill: never on screen. A viewer's question may still ask about one: she answers without advice)
  if (ADVICE.test(t)) return { ok: false, why: 'advice' };
  return { ok: true, text: t };
}
// ---------- (2026-10-07) $AGI on her show: its numbers and its new buys ----------
// The owner: "says if $AGI is pumping". Within hard rule 8: she reacts to buys that just happened (each in its own
// numbers, like her buy bot's alerts) and to the market's own numbers (a feeling), always "not financial advice"; never
// "pumping", a prediction, buy, sell or hold. Her stream asks about once a minute; the numbers come from DexScreener (kept
// a minute: server/market.js), the buys from clank.trade (kept 30 s per server copy: one request whatever asks).
// → { numbers: { mcap, h24, liq } | null, buys: [{ id, at, usd, agi }] } (buys after `since`, at most 15 minutes old,
// worth TELEGRAM_BUY_MIN dollars or more (50), the newest 5, oldest first; never who bought)
// chart (2026-10-09, the owner: "can you also include on her watching the live trading chart of $AGI"): also its newest
// trades for her chart on stream, `chart: [{ at, side, price, usd }]` (at most 100, oldest first, prices in dollars at
// ETH's price now; never who traded or their transaction). Read from clank.trade at most every 30 s per server copy (one
// request, whatever asks: her buy alerts and her chart share it)
let tradesKept = { at: 0, list: null };
export const forgetStreamBuys = () => { tradesKept = { at: 0, list: null }; };      // (for the tests)
export async function streamMarket(cfg, { since = 0, now = Date.now(), numbers = null, readTrades = null, chart = false } = {}) {
  const readNumbers = numbers || (await import('./market.js')).agiNumbers;
  const tradesOf = async () => {
    if (tradesKept.list && now - tradesKept.at < 30_000) return tradesKept.list;
    try {
      const list = await (readTrades || (await import('./buys.js')).readTrades)();
      tradesKept = { at: now, list };
      return list;
    } catch (err) {
      console.warn('[live] couldn\'t read $AGI\'s trades:', err.message);
      tradesKept = { at: now, list: [] };
      return [];
    }
  };
  const [n, list] = await Promise.all([readNumbers(now).catch(() => null), tradesOf()]);
  const min = Number(cfg.tgBuyMin) > 0 ? Number(cfg.tgBuyMin) : 50;
  const buys = list.filter((b) => (b.side ?? 'buy') === 'buy' && b.at > since && b.at > now - 15 * 60_000 && b.at <= now + 60_000 && b.usd >= min)
    .sort((a, b) => a.at - b.at).slice(-5)
    .map((b) => ({ id: b.id, at: b.at, usd: Math.round(b.usd * 100) / 100, agi: Math.round(b.agi) }));
  const out = { numbers: n ? { mcap: n.mcap, h24: n.h24 ?? null, liq: n.liq ?? null } : null, buys };
  if (chart) {
    out.chart = list.filter((t) => t.at <= now + 60_000 && t.price > 0 && Number.isFinite(t.price))
      .sort((a, b) => a.at - b.at).slice(-100)
      .map((t) => ({ at: t.at, side: t.side === 'sell' ? 'sell' : 'buy', price: Number(t.price.toPrecision(6)), usd: Math.round(t.usd * 100) / 100 }));
  }
  return out;
}

// → { reply, mood } · { skip: why } (it can't go on stream: never shown) · { none: true, trouble: 'ai' }
// r: { kind: 'post' | 'reply' | 'video', text, media: 'video' | 'photo' | null, title }
export async function reactAnswer(cfg, r, opts = {}) {
  const kind = ['post', 'reply', 'video'].includes(r?.kind) ? r.kind : null;
  if (!kind) return { skip: 'bad' };
  const p = r.text ? checkPost(r.text) : { ok: kind === 'video', text: '' };
  if (!p.ok) return { skip: p.why || 'empty' };
  const title = kind === 'video' && typeof r.title === 'string' ? checkPost(r.title) : null;
  const react = { kind, text: p.text, media: ['video', 'photo'].includes(r.media) ? r.media : null, title: title?.ok ? title.text.slice(0, 80) : null };
  const out = await liveLine(cfg, kind === 'reply' ? 'React to the reply.' : kind === 'video' ? 'React to your video.' : 'React to your post.', { react }, opts);
  return out.reply ? { ...out, text: p.text } : out;
}

// ---------- (2026-10-07) someone she meets on a trip ----------
// The owner: "meet random people talk to them what the chat said". Her stream says who (one of PEOPLE: a made-up character
// of her show) and passes on a few viewers' questions that already aired; the AI writes their conversation here, with her
// live rules, and every line is checked like her answers. → { lines: [{ who: 'them' | 'you', text }], mood } ·
// { skip: why } (never shown) · { none: true, trouble: 'ai' }
export const SCENE_CHAT = 3;
export function sceneOf(raw = {}) {
  const id = typeof raw?.person === 'string' && Object.hasOwn(PEOPLE, raw.person) ? raw.person : null;
  if (!id) return null;
  const p = PEOPLE[id];
  // (viewers' questions that aired: checked again here, the newest few)
  const chat = (Array.isArray(raw.chat) ? raw.chat : []).filter((x) => typeof x === 'string').map((x) => tidyText(x).slice(0, LIVE.Q_MAX))
    .filter((x) => x && !questionTrouble(x)).slice(-SCENE_CHAT);
  const place = DESTINATIONS[p.at] || (p.at === 'cafe' ? 'the little café you stream from' : 'your studio');
  return { id, place, who: p.who, lang: LOCAL[p.at] || null, chat, lines: 4 };
}
export async function meetAnswer(cfg, raw, { scene = askScene, timeoutMs = 10_000 } = {}) {
  const sc = sceneOf(raw);
  if (!sc) return { skip: 'bad' };
  let r;
  try {
    r = await scene(cfg, sc, { timeoutMs });
  } catch (err) {
    console.error('[live] gemini failed:', err.message);
    return { none: true, trouble: 'ai' };
  }
  if (!r?.lines) return { skip: r?.skip || 'rules' };
  const lines = r.lines.filter((l) => l.text);
  if (lines.length < 2 || lines.some((l) => answerTrouble(l.text))) return { skip: 'rules' };
  return { lines, mood: MOODS.includes(r.mood) ? r.mood : 'happy' };
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
