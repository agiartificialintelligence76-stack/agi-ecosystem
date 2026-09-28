// POST /api/chat: AGI-1's chat. Every message goes through these steps, in order:
//   1. check the request (size, 18+ confirmation)
//   2. human check: a valid chat pass, or a fresh Cloudflare Turnstile token (then we hand out a pass)
//   3. relationship level (Phase 3): from the wallet session, if the visitor connected a wallet (else Stranger)
//   4. limits in the database: per visitor (gap + daily, by level) and for the whole site (daily cap). DB down → no chat
//   5. ask Gemini, sending only history AGI-1 really said (signed) plus the visitor's own messages, and what she knows
//      right now: the Arena's current champion (server/arena-memory.js, 2026-09-25; the latest crown only)
//   6. Soulmates: save the short new note AGI-1 wrote about them, if any
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
import { currentChampion } from '../server/arena-memory.js';

const MAX_BODY = 16_000;     // bytes
const MAX_MESSAGE = 500;     // characters per visitor message
const MAX_REPLY = 600;       // characters per AGI-1 reply kept in history
const MAX_TURNS = 6;         // recent messages sent to Gemini as context
const RETRY_MS = 5 * 60 * 1000;   // if the $AGI balance couldn't be read, try again in about 5 minutes

const json = (status, body) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export function GET() {
  return json(405, { error: 'method_not_allowed' });
}

export async function POST(request) {
  const cfg = getConfig();
  const missing = missingSettings(cfg);
  if (missing.length) {
    console.error('[chat] missing settings:', missing.join(', '));
    return json(503, { error: 'not_configured' });
  }

  // 1. The request itself.
  if (!(request.headers.get('content-type') || '').includes('application/json')) return json(415, { error: 'bad_request' });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json(413, { error: 'too_long' });
  let body;
  try { body = JSON.parse(raw); } catch { return json(400, { error: 'bad_request' }); }
  if (!body || typeof body !== 'object') return json(400, { error: 'bad_request' });
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return json(400, { error: 'bad_request' });
  if (message.length > MAX_MESSAGE) return json(400, { error: 'too_long' });
  if (body.adult !== true) return json(403, { error: 'age' });

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
      const r = await checkLevel(s.wallet, s.level);
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
  if (slot === 'too_fast') return json(429, { error: 'too_fast', pass, level, session, signedOut });
  if (slot === 'person_cap') return json(429, { error: 'person_cap', pass, level, session, signedOut });
  if (slot === 'global_cap') return json(503, { error: 'global_cap', pass, level, session, signedOut });

  // What AGI-1 remembers (Crush: the name; Soulmate: the name and her notes). If the database can't say, she just forgets.
  // At the same time: the Arena's current champion (kept a minute per server copy; never throws, never waits long).
  const arena = currentChampion(cfg, now);
  let friend = { name: null, notes: [] };
  if (friendCode) {
    try { friend = await getFriend(cfg, friendCode); } catch (err) { console.error('[chat] memory unavailable:', err.message); }
  }
  const champion = await arena;

  // 5. Gemini. If the visitor asked about the clank.trade Telegram group (or someone/something in it), her notes on
  // it come along; otherwise nothing is added.
  const history = cleanHistory(body.history, cfg.passSecret);
  const memory = recallGroup(message, history.filter((t) => t.role === 'user').at(-1)?.text);
  let answer;
  try {
    answer = await askAgi1(cfg, history, message,
      { level, name: friend.name, notes: level === 3 ? friend.notes : [], memory, arena: champion });
  } catch (err) {
    console.error('[chat] gemini failed:', err.message);
    return json(502, { error: 'ai_error', pass, level, session, signedOut });
  }

  // 6. A Soulmate's new note (checked: a short fact, nothing private, nothing that looks like an instruction).
  let remembered = null;
  const note = level === 3 && friendCode ? cleanNote(answer.note) : null;
  if (note) {
    try { await addFriendNote(cfg, friendCode, note); remembered = note; } catch (err) { console.error('[chat] saving a note failed:', err.message); }
  }
  const { reply, mood } = answer;
  // voice: a 15-minute ticket to have this reply read aloud in her real voice (api/voice.js), with this reply's mood (her voice
  // follows it) and the visitor's level (her voice allowance follows their messages a day)
  const voice = makeVoiceTicket(cfg.passSecret, reply, { level, mood }, now);
  return json(200, { reply, mood, sig: signReply(cfg.passSecret, reply), voice, pass, level, session, remembered, signedOut });
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
