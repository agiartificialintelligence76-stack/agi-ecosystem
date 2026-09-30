// /api/voice: AGI-1's voice (2026-09-25). Her chat replies read aloud by Gemini's speech model, in the voice the owner
// picked (Despina), in her smooth style with the feeling of each reply's mood (server/voice.js). The page plays the answer:
// streamed raw PCM, or a WAV file. The page never switches to the browser's robotic voice (src/chat/voice.js): her natural
// voice or nothing.
//
// POST { text, ticket }: one of her replies. In this order (any failure stops before Gemini is called):
//   1. settings; a speed bump (20 requests a minute per visitor); JSON ≤ 4 KB; text 1–600 characters
//   2. the voice ticket /api/chat handed out with that reply: this exact text, the last 15 minutes; it also says the
//      visitor's level and the reply's mood
//   3. limits in the database (voice_take, supabase/voice.sql), counted in requests like Google counts them (2026-09-26):
//      each ticket at most twice; a visitor's daily share follows their messages a day (server/limits.js);
//      VOICE_DAILY_REQUESTS (default 4,000, about $12 at most) a day for the whole site. DB down → no voice
//   4. Gemini speech, STREAMED (the owner: "should be instant"): raw PCM (audio/l16) passed on piece by piece as Gemini makes
//      it, so the page starts playing about a second after the reply. If Google's streamed answer ever has no audio, this
//      server copy switches to one whole WAV file (and logs it); VOICE_STREAM=off does the same for good.
//   Her speech models, in order (2026-09-26, the owner's choice): Gemini 3.8 Flash-Lite TTS, then 3.8 Flash TTS as the
//   backup (cfg.voiceModels; same Despina voice). Google gives each model its own limits, so when one says "wait" or "used
//   up" (or doesn't know the model), the next one speaks that reply at once, still counted once. A short hiccup on the last
//   model left (a per-minute limit that frees up within 5 s, a 5xx) gets one more try. Credits or the key: no model is tried.
//   Any other "no" is answered with a one-word reason (`why`, never secret), so the page knows whether to try again later.
//   Backing off (2026-09-26): when Google says "wait" (its per-minute limit), "that's all for today" (its daily limit, until
//   midnight Pacific time) or "unknown model" for a model, this server copy stops asking that model for a while ("no
//   credits": every model); when no model is left, the page gets the same reason at once, and nothing is counted.
//
// GET ?line=<key>&v=<LINE_VERSION> (and, in her other languages since 2026-09-29, ?line=<key>&lang=<code>&v=…: each
// language's words, recorded once each): her fixed lines, the same for everyone: "hi, it's me" (hello), out of messages (more-1,
// more-2, sleep, talked-out) and her market moments (mcap-<step>, dump-<n>). Vercel's CDN keeps one copy of each (a new
// deployment starts fresh) and this server copy keeps them in memory: after the first time they cost nothing. Exactly one
// address per line (anything else is 404), and a market-cap line is only made for a step near $AGI's real market cap right
// now (server/market.js), so nobody can have thousands made. Since 2026-09-26 her fixed lines (not the market-cap ones) are
// also kept in the database once made (server/voice-store.js, supabase/voice-lines.sql): after the first time they never
// need Google again, not even after a new deployment or when Google's daily limit is used up.
import { getConfig, missingVoiceSettings } from '../server/config.js';
import { clientIp, visitorCode, visitorCodeForDay, checkVoiceTicket } from '../server/security.js';
import { takeVoiceSlot, voicePerDay, VOICE_TICKET_USES } from '../server/limits.js';
import { speakAsAgi1, streamAsAgi1, NoAudioError, spokenText, styleFor, LINE_MOODS, linesFor } from '../server/voice.js';
import { linesOf } from '../src/i18n/all.js';
import { isLang } from '../src/i18n/langs.js';
import { loadLine, saveLine, lineId, resetStoreForTests } from '../server/voice-store.js';
import { troubleKind, msToGoogleReset } from '../server/gemini.js';
import { voiceBurst } from '../server/burst.js';
import { marketLineByKey, STEP } from '../src/chat/market-lines.js';
import { LINE_VERSION } from '../src/chat/voice-lines.js';
import { agiMarket } from '../server/market.js';

const MAX_BODY = 4_000;      // bytes
const MAX_TEXT = 600;        // characters: the longest reply /api/chat sends
const REPLY_MOODS = ['happy', 'love', 'shy', 'wave', 'neutral'];

const json = (status, body) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
// (a fixed line's answer also says where it came from: 'memory' (this server copy had it), 'kept' (the database) or 'google';
// and every voice says which of her models made it)
const wav = (bytes, cache, from, model) => new Response(bytes, { status: 200, headers: {
  'Content-Type': 'audio/wav', 'Cache-Control': cache, ...(from ? { 'X-AGI1-Line': from } : {}),
  ...(model ? { 'X-AGI1-Model': model } : {}),
} });
const nap = (ms) => new Promise((ok) => setTimeout(ok, ms));

const made = new Map();      // this server copy's fixed lines (each made once): key → { audio, model }
let streamBroken = false;    // Google's streamed answer had no audio: this server copy asks for whole clips instead
const quiet = new Map();     // Google said "not now": model (or ALL) → { why, until } (see backOff)
const ALL = '*';
let clock = () => Date.now();
export function resetForTests({ now } = {}) {                 // tests/voice.test.js only
  made.clear(); streamBroken = false; quiet.clear(); clock = now || (() => Date.now()); resetStoreForTests();
}

// How long this server copy stops asking a model after Google said no: its per-minute limit → as long as Google asks (at
// most a minute); its daily limit → until midnight Pacific time, when it starts again, but at most 30 minutes at a time (so
// a higher limit from Google is noticed soon); an unknown model → 30 minutes; used-up credits → every model, 10 minutes.
// Anything else: no pause.
function backOff(model, why, retryAfter, now) {
  const ms = why === 'busy' ? Math.min(60, retryAfter > 0 ? retryAfter : 10) * 1000
    : why === 'daily_limit' ? Math.min(30 * 60_000, msToGoogleReset(now) + 30_000)
      : why === 'model' ? 30 * 60_000
        : why === 'credits' ? 10 * 60_000 : 0;
  if (ms > 0) quiet.set(why === 'credits' ? ALL : model, { why, until: now + ms });
  return ms;
}
function restingWhy(model) {
  const now = clock();
  for (const key of [ALL, model]) {
    const q = quiet.get(key);
    if (q && now < q.until) return q.why;
  }
  return null;
}
const ready = (cfg) => cfg.voiceModels.filter((model) => !restingWhy(model));
// The one word for the page when no model could speak: a passing problem first (the page tries again with the next reply),
// then Google's daily limit (it rests for the visit), then the rest.
const ORDER = ['busy', 'google', 'timeout', 'no_audio', 'daily_limit', 'credits', 'model', 'request', 'key'];
const pickWhy = (whys) => whys.filter(Boolean).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b))[0] || 'google';
const STOP = ['credits', 'key'];            // a problem with the whole project: no other model is tried
const minutes = (ms) => (ms >= 90_000 ? `${Math.round(ms / 60_000)} min` : `${Math.round(ms / 1000)} s`);

// Ask Google, and once more after a short wait if it was only a moment's hiccup: a per-minute limit that frees up within
// 5 s (Google says how long), a 5xx, or no audio in the answer, and only while there's time left (a function may run 25 s).
// While another model is still waiting its turn (last: false), a hiccup goes to that model instead (no audio in a streamed
// answer is still tried twice: that tells us Google's answer format changed). A daily limit, used-up credits, a wrong
// request or key aren't tried again.
async function withRetry(make, { budgetMs = 8000, last = true } = {}) {
  const t0 = Date.now();
  try {
    return await make();
  } catch (err) {
    const kind = troubleKind(err);
    const wait = kind === 'no_audio' ? 600
      : !last ? null
        : kind === 'busy' ? (err.retryAfter === null || err.retryAfter <= 5 ? Math.round((err.retryAfter ?? 1) * 1000) + 150 : null)
          : kind === 'google' ? 600 : null;
    if (wait === null || Date.now() - t0 + wait > budgetMs) throw err;
    await nap(wait);
    return make();
  }
}

// Ask her models in order (only those not resting) until one speaks: make(cfg with that model, last) → the answer.
// → { answer, model } or { why } when none could. Every refusal is logged (never the key) and backs that model off.
async function askModels(cfg, what, make) {
  const models = ready(cfg);
  const whys = [];
  for (const [i, model] of models.entries()) {
    try {
      return { answer: await make({ ...cfg, voiceModel: model }, i === models.length - 1), model };
    } catch (err) {
      const why = troubleKind(err);
      whys.push(why);
      const pause = backOff(model, why, err?.retryAfter, clock());
      const next = STOP.includes(why) ? null : models[i + 1];
      console.error(`[voice] gemini failed (${model}, ${cfg.voiceName}${what ? `, ${what}` : ''}): ${err.message} → ${why}`
        + `${pause ? ` (this server copy won't ask ${why === 'credits' ? 'Google' : 'this model'} again for ${minutes(pause)})` : ''}`
        + `${next ? `; ${next} takes it` : ''}`);
      if (!next) break;
    }
  }
  return { why: pickWhy([...whys, ...cfg.voiceModels.map(restingWhy)]) };
}
const aiError = (why) => json(502, { error: 'ai_error', why });
// Her voice for one reply from one model: streamed (she starts at once), or one whole WAV file if streaming broke.
async function speak(cfg, words, style, last) {
  if (cfg.voiceStream && !streamBroken) {
    try {
      const voice = await withRetry(() => streamAsAgi1(cfg, words, style), { last });
      return new Response(voice.stream, { status: 200, headers: {
        'Content-Type': `audio/l16;rate=${voice.rate}`, 'Cache-Control': 'no-store', 'X-AGI1-Model': cfg.voiceModel,
      } });
    } catch (err) {
      if (!(err instanceof NoAudioError)) throw err;
      streamBroken = true;
      console.error("[voice] streaming gave no audio (Google's answer format may have changed); asking for whole clips from now on:", err.message);
    }
  }
  return wav(await withRetry(() => speakAsAgi1(cfg, words, style), { last }), 'no-store', null, cfg.voiceModel);
}

export async function GET(request) {
  // exactly one address per line (and language), so nobody can make the CDN miss (and us pay) by adding things to it:
  // ?line=<key>&v=4 in English, ?line=<key>&lang=<code>&v=4 in her other languages (2026-09-29; never &lang=en; the number is
  // LINE_VERSION, 4 since 2026-09-30)
  const m = /^\?line=([a-z0-9-]{1,20})(?:&lang=([a-z]{2,3}))?&v=(\d{1,3})$/.exec(new URL(request.url).search);
  const lang = m?.[2] ?? 'en';
  const line = m && m[3] === String(LINE_VERSION) && (m[2] === undefined || (lang !== 'en' && isLang(lang))) ? m[1] : null;   // (exactly "4", not "04")
  const fixed = linesFor(lang);
  const market = line && !Object.hasOwn(fixed, line) ? marketLineByKey(line, linesOf(lang), lang) : null;
  if (!line || (!Object.hasOwn(fixed, line) && !market)) return json(404, { error: 'not_found' });
  const cfg = getConfig();
  if (!cfg.geminiKey) {
    console.error('[voice] missing settings: GEMINI_API_KEY');
    return json(503, { error: 'not_configured' });
  }
  const words = market ? market.spoken : fixed[line];
  const style = styleFor(market ? (market.step ? 'celebrate' : 'sad') : LINE_MOODS[line]);
  const id = lang === 'en' ? line : `${line}@${lang}`;           // (this server copy's memory: one entry per line and language)
  if (!made.has(id) && market?.step) {
    // only a step the market cap really reached (or is right at): up to 3 steps below it, at most 1 above
    const now = await agiMarket();
    if (!now) return json(503, { error: 'unverified' });
    if (market.step > now.mcap + STEP || market.step < now.mcap - 3 * STEP) return json(404, { error: 'not_found' });
  }
  let from = 'memory';
  if (!made.has(id)) {
    // kept in the database since the first time, made by any of her models (her market-cap lines aren't kept: they come
    // and go)? Else the first model that isn't resting makes it. (Each language's words make their own recording.)
    const keep = !market?.step;
    const idFor = (model) => lineId({ ...cfg, voiceModel: model }, line, words, style);
    let audio = null, model = null;
    for (const mdl of keep ? cfg.voiceModels : []) {
      audio = await loadLine(cfg, idFor(mdl));
      if (audio) { model = mdl; break; }
    }
    from = 'kept';
    if (!audio) {
      if (!ready(cfg).length) return aiError(pickWhy(cfg.voiceModels.map(restingWhy)));
      const got = await askModels(cfg, `line ${id}`, (c, last) => withRetry(() => speakAsAgi1(c, words, style), { budgetMs: 6000, last }));
      if (!got.answer) return aiError(got.why);
      ({ answer: audio, model } = got);
      from = 'google';
      if (keep) await saveLine(cfg, idFor(model), audio);
    }
    made.set(id, { audio, model, market: Boolean(market?.step) });
    // at most 40 lines here (16 languages can't all sit in one copy's memory): the oldest market line goes first, else the
    // oldest line (it's still kept in the database and by the CDN)
    if (made.size > 40) {
      const old = [...made.entries()].find(([, v]) => v.market)?.[0] ?? made.keys().next().value;
      made.delete(old);
    }
  }
  const { audio, model } = made.get(id);
  return wav(audio, 'public, max-age=86400, s-maxage=2592000', from, model);   // browsers keep it a day, the CDN 30 days
}

export async function POST(request) {
  const cfg = getConfig();
  const missing = missingVoiceSettings(cfg);
  if (missing.length) {
    console.error('[voice] missing settings:', missing.join(', '));
    return json(503, { error: 'not_configured' });
  }
  const ip = clientIp(request);
  const code = visitorCode(cfg.passSecret, ip);
  if (!voiceBurst(code)) return json(429, { error: 'slow_down' });

  // 1. The request itself.
  if (!(request.headers.get('content-type') || '').includes('application/json')) return json(415, { error: 'bad_request' });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json(413, { error: 'too_long' });
  let body;
  try { body = JSON.parse(raw); } catch { return json(400, { error: 'bad_request' }); }
  const text = typeof body?.text === 'string' ? body.text : '';
  if (!text.trim() || text.length > MAX_TEXT) return json(400, { error: 'bad_request' });

  // 2. Only a reply AGI-1 just wrote. Her mood for it and the visitor's level come with the ticket.
  const ticket = checkVoiceTicket(cfg.passSecret, body.ticket, text);
  if (!ticket) return json(401, { error: 'bad_ticket' });
  const words = spokenText(text);
  if (!words) return json(400, { error: 'nothing_to_say' });          // e.g. a reply that was only emojis
  const style = styleFor(REPLY_MOODS.includes(ticket.mood) ? ticket.mood : 'neutral');
  // Google said "not now" to every model a moment ago: the same answer at once, not counted (see backOff)
  if (!ready(cfg).length) return aiError(pickWhy(cfg.voiceModels.map(restingWhy)));

  // 3. Limits (counted before Gemini is asked, so the daily cap is a hard cap, on Google's requests and on money). A visitor's
  // share follows their messages a day, and (2026-09-30) grows with the burned messages they used today (server/burn.js).
  let slot;
  try {
    const who = visitorCodeForDay(cfg.passSecret, ip, new Date().toISOString().slice(0, 10));
    slot = await takeVoiceSlot(cfg, who, ticket.id, voicePerDay(ticket.level) + VOICE_TICKET_USES * ticket.burned);
  } catch (err) {
    console.error('[voice] limits unavailable:', err.message);
    return json(503, { error: err.code === 'PGRST202' ? 'not_ready' : 'busy' });   // fail closed: no counting, no voice
  }
  if (slot === 'used') return json(409, { error: 'used' });
  if (slot === 'person_cap') return json(429, { error: 'person_cap' });
  if (slot === 'global_cap') return json(503, { error: 'global_cap' });

  // 4. Her voice: streamed, so she starts talking as soon as the first piece arrives; from the first of her models that can.
  const got = await askModels(cfg, null, (c, last) => speak(c, words, style, last));
  return got.answer ?? aiError(got.why);
}
