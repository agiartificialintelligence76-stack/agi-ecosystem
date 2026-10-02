// POST /api/chat: AGI-1's chat. Every message goes through these steps, in order:
//   1. check the request (size, 18+ confirmation)
//   2. human check: a valid chat pass, or a fresh Cloudflare Turnstile token (then we hand out a pass)
//   3. relationship level (Phase 3): from the wallet session, if the visitor connected a wallet (else Stranger)
//   4. limits in the database: per visitor (gap + daily, by level) and for the whole site (daily cap). DB down → no chat.
//      Out of free messages (2026-09-30): a message paid for by burning $AGI, if their wallet has any (server/burn.js,
//      supabase/burns.sql), given back if her reply fails
//   5. ask Gemini, sending only history AGI-1 really said (signed) plus the visitor's own messages (her memory of the Arena's
//      champion, 2026-09-25, left with the Arena on 2026-09-28)
//   6. Soulmates: save the short new note AGI-1 wrote about them, if any
// Her language (2026-09-29): `lang` (the chat's language menu, src/i18n/langs.js; English if missing or unknown), and she
// follows whatever language they write in (server/agi1-prompt.js, languagePrompt).
// "Show her" (2026-10-02): `shot`, one picture of a window the visitor picked (server/shot.js), goes with this message to the
// AI service and nowhere else (never logged or stored); the message counts as one, like any other.
// The reply comes back signed (for the history) with a voice ticket (for api/voice.js, her voice).
import { getConfig, missingSettings } from '../server/config.js';
import { clientIp, visitorCode, visitorCodeForDay, makePass, checkPass, signReply, checkReply, makeVoiceTicket } from '../server/security.js';
import { verifyHuman } from '../server/turnstile.js';
import { takeChatSlot } from '../server/limits.js';
import { askAgi1 } from '../server/gemini.js';
import { readSession, makeSession, needsRecheck, walletCode, RECHECK_MS } from '../server/session.js';
import { checkLevel } from '../server/chain.js';
import { getFriend, addFriendNote, cleanNote } from '../server/friends.js';
import { levelInfo } from '../src/lib/levels.js';
import { recallGroup } from '../server/tg-memory.js';
import { takeBurned, refundBurned, burnedAgi } from '../server/burn.js';
import { randomUUID } from 'node:crypto';
import { isLang } from '../src/i18n/langs.js';
import { readShot } from '../server/shot.js';

const MAX_BODY = 16_000;     // bytes (besides a picture: "Show her")
const MAX_SHOT_BODY = 16_000 + 820_000;   // a message with one picture (600 KB at most, base64 in the JSON)
const MAX_MESSAGE = 500;     // characters per visitor message
const MAX_REPLY = 600;       // characters per AGI-1 reply kept in history
const MAX_TURNS = 6;         // recent messages sent to Gemini as context
const RETRY_MS = 5 * 60 * 1000;   // if the $AGI balance couldn't be read, try again in about 5 minutes
// Vercel stops a function at 25 s: her reply must be asked for early enough that a burned message can still be given back
// if it fails (2026-09-30). The AI gets at most 10 s, less when the steps before it were slow.
const REPLY_BY_MS = 21_000;

const json = (status, body) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export function GET() {
  return json(405, { error: 'method_not_allowed' });
}

export async function POST(request) {
  const started = Date.now();
  const cfg = getConfig();
  const missing = missingSettings(cfg);
  if (missing.length) {
    console.error('[chat] missing settings:', missing.join(', '));
    return json(503, { error: 'not_configured' });
  }

  // 1. The request itself.
  if (!(request.headers.get('content-type') || '').includes('application/json')) return json(415, { error: 'bad_request' });
  const raw = await request.text();
  if (raw.length > MAX_SHOT_BODY) return json(413, { error: 'too_long' });
  let body;
  try { body = JSON.parse(raw); } catch { return json(400, { error: 'bad_request' }); }
  if (!body || typeof body !== 'object') return json(400, { error: 'bad_request' });
  if (raw.length - (typeof body.shot === 'string' ? body.shot.length : 0) > MAX_BODY) return json(413, { error: 'too_long' });
  const shot = readShot(body.shot);                                  // ("Show her": a real picture, and small, or nothing)
  if (shot === false) return json(400, { error: 'bad_picture' });
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return json(400, { error: 'bad_request' });
  if (message.length > MAX_MESSAGE) return json(400, { error: 'too_long' });
  if (body.adult !== true) return json(403, { error: 'age' });
  const lang = isLang(body.lang) ? body.lang : 'en';                 // the language she speaks with them (2026-09-29)

  // 2. Human check.
  const ip = clientIp(request);
  const code = visitorCode(cfg.passSecret, ip);
  let pass = null;                                                   // a new pass, if we hand one out
  if (!checkPass(cfg.passSecret, body.pass, code)) {
    if (!(await verifyHuman(cfg, body.turnstileToken, ip))) return json(401, { error: 'human_check' });
    pass = makePass(cfg.passSecret, code);
  }

  // 3. Relationship level. No wallet (or a signed-out one) = Stranger. The balance is re-read at most every 30 minutes.
  const now = Date.now();
  let level = 1, wallet = null, session = null;
  const s = readSession(cfg.passSecret, body.session, now);
  if (s) {
    wallet = s.wallet;
    level = s.level;
    if (needsRecheck(s, now)) {
      // (what they burned for messages counts too, 2026-09-30)
      const r = await checkLevel(s.wallet, s.level, undefined, await burnedAgi(cfg, s.wallet));
      level = r.level;
      session = makeSession(cfg.passSecret, { wallet, level, checkedAt: r.checked ? now : now - RECHECK_MS + RETRY_MS, expiresAt: s.expiresAt });
    }
  }
  const friendCode = wallet && level >= 2 ? walletCode(cfg.passSecret, wallet) : null;
  const signedOut = body.session !== undefined && !s ? true : undefined;   // expired or broken session: the page signs out

  // 4. Limits: Crush and Soulmate count per wallet, everyone else per visitor (daily IP code), as before.
  let slot;
  try {
    const who = friendCode ? `w:${friendCode}` : visitorCodeForDay(cfg.passSecret, ip, new Date(now).toISOString().slice(0, 10));
    slot = await takeChatSlot(cfg, who, levelInfo(level).daily);
  } catch (err) {
    console.error('[chat] limits unavailable:', err.message);
    return json(503, { error: 'busy', pass });                        // fail closed: no counting, no chat
  }
  // Out of free messages (their own, or the whole site's): a burned one, if this wallet has any (2026-09-30). burns.sql not
  // run, or the database can't say: out of messages, as before. `burn` tells the page why burned ones wait (their 300 a
  // day, or the site's) and how many are left.
  let burned = null, burn;
  const take = randomUUID();                                         // (this burned message's id, to give it back if need be)
  const giveBack = async () => {
    try { await refundBurned(cfg, wallet, take); } catch (e) { console.error('[chat] giving a burned message back failed:', e.message); }
  };
  if ((slot === 'person_cap' || slot === 'global_cap') && wallet) {
    try {
      const b = await takeBurned(cfg, wallet, take);
      if (b.ok) { burned = { left: b.left, today: b.today }; slot = 'ok'; }
      else if (b.why === 'too_fast') slot = 'too_fast';
      else if (b.why === 'day_cap' || b.why === 'site_cap') burn = { why: b.why, left: b.left };
    } catch (err) {
      if (err.code !== 'PGRST202') {
        console.error('[chat] burned messages unavailable:', err.message);
        await giveBack();                                            // (in case it was taken but the answer got lost)
      }
    }
  }
  if (slot === 'too_fast') return json(429, { error: 'too_fast', pass, level, session, signedOut });
  if (slot === 'person_cap') return json(429, { error: 'person_cap', pass, level, session, signedOut, burn });
  if (slot === 'global_cap') return json(503, { error: 'global_cap', pass, level, session, signedOut, burn });

  // What AGI-1 remembers (Crush: the name; Soulmate: the name and her notes). If the database can't say, she just forgets.
  let friend = { name: null, notes: [] };
  if (friendCode) {
    try { friend = await getFriend(cfg, friendCode); } catch (err) { console.error('[chat] memory unavailable:', err.message); }
  }

  // 5. Gemini. If the visitor asked about the clank.trade Telegram group (or someone/something in it), her notes on
  // it come along; otherwise nothing is added.
  const history = cleanHistory(body.history, cfg.passSecret);
  const memory = recallGroup(message, history.filter((t) => t.role === 'user').at(-1)?.text);
  const timeLeft = REPLY_BY_MS - (Date.now() - started);
  if (timeLeft < 3000) {                                               // too slow today: no reply rather than one cut off
    console.error('[chat] no time left for her reply:', Date.now() - started, 'ms before asking');
    if (burned) await giveBack();
    return json(503, { error: 'busy', pass, level, session, signedOut });
  }
  let answer;
  try {
    answer = await askAgi1(cfg, history, message,
      { level, name: friend.name, notes: level === 3 ? friend.notes : [], memory, lang, shot, timeoutMs: Math.min(shot ? 15_000 : 10_000, timeLeft) });
  } catch (err) {
    console.error('[chat] gemini failed:', err.message);
    if (burned) await giveBack();                                      // a burned message never pays for no reply
    return json(502, { error: 'ai_error', pass, level, session, signedOut });
  }

  // 6. A Soulmate's new note (checked: a short fact, nothing private, nothing that looks like an instruction).
  let remembered = null;
  const note = level === 3 && friendCode && !shot ? cleanNote(answer.note) : null;   // (never from a picture)
  if (note) {
    try { await addFriendNote(cfg, friendCode, note); remembered = note; } catch (err) { console.error('[chat] saving a note failed:', err.message); }
  }
  const { reply, mood } = answer;
  // voice: a 15-minute ticket to have this reply read aloud in her real voice (api/voice.js), with this reply's mood (her voice
  // follows it) and the visitor's level (her voice allowance follows their messages a day, and the burned ones they used)
  const voice = makeVoiceTicket(cfg.passSecret, reply, { level, mood, burned: burned?.today || 0 }, now);
  return json(200, { reply, mood, sig: signReply(cfg.passSecret, reply), voice, pass, level, session, remembered, signedOut, burned });
}

// Keep only trustworthy history: the visitor's own short messages, and AGI-1's replies with a valid signature.
// Gemini wants turns to alternate (visitor, AGI-1, visitor…), starting with the visitor and ending with AGI-1.
export function cleanHistory(input, secret) {
  if (!Array.isArray(input)) return [];
  const turns = [];
  for (const t of input.slice(-20)) {
    if (!t || typeof t.text !== 'string') continue;
    const text = t.text.trim();
    if (!text) continue;
    if (t.role === 'user' && text.length <= MAX_MESSAGE) turns.push({ role: 'user', text });
    else if (t.role === 'model' && text.length <= MAX_REPLY && checkReply(secret, text, t.sig)) turns.push({ role: 'model', text });
  }
  const alternating = [];
  for (const t of turns) {
    if (alternating.length && alternating[alternating.length - 1].role === t.role) alternating[alternating.length - 1] = t;
    else alternating.push(t);
  }
  while (alternating.length && alternating[0].role !== 'user') alternating.shift();
  while (alternating.length && alternating[alternating.length - 1].role !== 'model') alternating.pop();
  return alternating.slice(-MAX_TURNS);
}
