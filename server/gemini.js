// Asks Google Gemini for AGI-1's reply. Only the server calls this; the API key never reaches the browser.
import { AGI1_PROMPT, OFFICIAL_CA, MOODS, levelPrompt, groupMemoryPrompt, telegramPrompt, languagePrompt, shotPrompt, livePrompt, LIVE_SKIPS } from './agi1-prompt.js';
import { linesOf } from '../src/i18n/all.js';
import { isLang } from '../src/i18n/langs.js';

// Safety filters are OFF by default for Gemini 3 models, so we switch them on.
// Sexual content uses the strictest level (PG-13 site).
export const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
];
export const BLOCKED_REASONS = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION']);
// (when the safety filters blocked her answer: a pre-written deflection, in the visitor's language since 2026-09-29)
export const DEFLECTIONS = linesOf('en').deflect;
const deflectionsIn = (lang) => { const d = linesOf(lang).deflect; return Array.isArray(d) && d.length ? d : DEFLECTIONS; };
const MAX_REPLY = 600;

// What a refused request most likely means. This only goes to the server log, never to visitors.
const GEMINI_HINTS = {
  API_KEY_INVALID: 'GEMINI_API_KEY is wrong: create or copy it again in Google AI Studio (aistudio.google.com)',
  API_KEY_HTTP_REFERRER_BLOCKED: 'the key is limited to websites: set its "Application restrictions" to None (a server sends no website)',
  API_KEY_IP_ADDRESS_BLOCKED: 'the key is limited to IP addresses: set its "Application restrictions" to None (Vercel\'s IPs change)',
  API_KEY_SERVICE_BLOCKED: 'the key is allowed for a different Google API (e.g. "Agent Platform API" = Vertex): create the key in Google AI Studio → API Keys, which allows only the Gemini API',
  SERVICE_DISABLED: 'the Gemini API is switched off in the key\'s Google Cloud project: create the key in Google AI Studio',
  CONSUMER_SUSPENDED: 'Google suspended this key or project: check Google AI Studio',
  PERMISSION_DENIED: 'Google refused the key: check key restrictions, that it comes from Google AI Studio (not Vertex AI), and any account checks Google asks for',
  UNAUTHENTICATED: 'the key was not accepted: use a Gemini API key from Google AI Studio',
  RESOURCE_EXHAUSTED: 'prepay credits, spend cap or rate limit used up: check Google AI Studio → Billing / Spend',
  NOT_FOUND: 'model not found: check GEMINI_MODEL',
};

// Turn Google's error answer into one readable log line, with any API key blanked out. The error also carries what the
// voice needs to decide whether one more try makes sense (2026-09-25): httpStatus, googleStatus, perDay (a daily limit, not a
// per-minute one), credits (prepaid credits or the spend cap used up) and retryAfter (seconds Google asks us to wait).
export async function geminiError(res, key) {
  let text = '';
  try { text = await res.text(); } catch { /* no body */ }
  let status = '', reason = '', message = '', quotas = '', retry = '';
  try {
    const e = JSON.parse(text).error || {};
    status = String(e.status || '');
    const details = Array.isArray(e.details) ? e.details : [];
    reason = String(details.map((d) => d && d.reason).find(Boolean) || '');
    message = String(e.message || '');
    quotas = details.flatMap((d) => (Array.isArray(d?.violations) ? d.violations : []).map((v) => `${v?.quotaId || ''} ${v?.quotaMetric || ''}`)).join(' ');
    retry = String(details.map((d) => d && d.retryDelay).find(Boolean) || '');
  } catch { /* not JSON */ }
  const scrub = (s) => {
    if (key && key.length >= 8) s = s.split(key).join('[key]');
    return s.replace(/AIza[0-9A-Za-z_-]{20,}/g, '[key]').replace(/\s+/g, ' ').trim().slice(0, 200);
  };
  const head = [`gemini: HTTP ${res.status}`, status, reason].filter(Boolean).join(' ');
  const details = [GEMINI_HINTS[reason] || GEMINI_HINTS[status] || '', scrub(message)].filter(Boolean).join(' | ');
  const err = new Error(details ? `${head} (${details})` : head);
  err.httpStatus = res.status;
  err.googleStatus = status;
  err.perDay = /per[_ ]?day|PerDay/i.test(`${quotas} ${message}`);
  err.credits = res.status === 402 || /credit|billing|prepa(id|y)|spend/i.test(message);
  const seconds = Number.parseFloat(retry);
  err.retryAfter = Number.isFinite(seconds) ? seconds : null;
  return err;
}

// What went wrong, in one word the page can act on (never secret): 'busy' (a per-minute limit: try again soon),
// 'daily_limit' (Google's daily limit for the model: until tomorrow), 'credits' (prepaid credits or the spend cap),
// 'model' (the model's name), 'request' (Google refused the request itself), 'key', 'timeout', 'no_audio' or 'google'
// (a hiccup on Google's side).
export function troubleKind(err) {
  if (!err) return 'google';
  if (err.name === 'TimeoutError' || err.name === 'AbortError') return 'timeout';
  if (err.noAudio) return 'no_audio';
  const s = err.httpStatus;
  if (s === 429 || s === 402) return err.credits ? 'credits' : err.perDay ? 'daily_limit' : 'busy';
  if (s === 404) return 'model';
  if (s === 400) return 'request';
  if (s === 401 || s === 403) return 'key';
  return 'google';
}

// Google's daily limits ("requests per day") start again at midnight Pacific time (ai.google.dev → Rate limits).
// → milliseconds from `now` until then (summer and winter time included).
const PACIFIC = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' });
export function msToGoogleReset(now = Date.now()) {
  const t = Object.fromEntries(PACIFIC.formatToParts(new Date(now)).filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));
  return (86_400 - ((t.hour % 24) * 3600 + t.minute * 60 + t.second)) * 1000 - (now % 1000);
}

// Remove wallet addresses other than the official one, and links other than clank.trade (and agi1.app, our own). Since
// 2026-10-02 ("Show her": a picture can carry a scam's "support" link or an airdrop) also bare domains like
// "agi1-claim.xyz/airdrop" or "t.me/…", emails, and @handles other than ours. The prompt already forbids all of these.
// This catches them even if someone tricks the AI.
const OUR_HOSTS = /^(?:www\.)?(?:clank\.trade|agi1\.app)$/i;
const OUR_HANDLES = /^(?:agi1dotapp|agi1_appbot)$/i;
export const TLDS = 'com|net|org|io|xyz|app|co|me|gg|fun|info|link|site|online|top|club|vip|pro|live|ai|finance|money|cash|trade|exchange|'
  + 'biz|ru|cn|tk|ly|cc|tv|tech|dev|page|wtf|lol|bot|claims?|airdrop|network|world|space|website|store|shop|cloud|digital|social|'
  + 'chat|games?|bet|casino|crypto|nft|dao|eth|sol|blog|news|to|so|in|us|uk|eu|de';
const BARE_DOMAIN = new RegExp(`(^|[^\\w@.-])((?:[a-z0-9-]+\\.)+(?:${TLDS}))\\b(\\/[^\\s)]*)?`, 'gi');
export function cleanReply(text) {
  return String(text)
    .replace(/0x[a-fA-F0-9]{40}/g, (m) => (m.toLowerCase() === OFFICIAL_CA ? m : '[address removed]'))
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email removed]')
    .replace(/\b(?:https?:\/\/|www\.)[^\s)]+/gi, (url) => (/^(?:https?:\/\/)?(?:www\.)?(?:clank\.trade|agi1\.app)(?:\/|$)/i.test(url) ? url : '[link removed]'))
    .replace(BARE_DOMAIN, (m, before, host) => (OUR_HOSTS.test(host) ? m : `${before}[link removed]`))
    .replace(/(^|[^\w@])@([A-Za-z0-9_]{3,32})\b/g, (m, before, handle) => (OUR_HANDLES.test(handle) ? m : `${before}[handle removed]`))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_REPLY);
}

// history: [{ role: 'user' | 'model', text }], already checked by api/chat.js
// visitor: { level: 1-3, name, notes } (Phase 3). Only Soulmates (level 3) can get a "note" back: a short new fact
// AGI-1 learned about them, which api/chat.js checks and saves. Asking for it costs a few output tokens, so only they do.
// visitor.memory: her Telegram group notes, when the visitor asked about the group.
// visitor.telegram (2026-09-29): she's texting on her Telegram bot ({ repliedTo: her text they replied to, if any }).
// visitor.lang (2026-09-29): the language the visitor picked (or their Telegram app's), src/i18n/langs.js; English if not.
// visitor.langSource: where that came from ('menu', 'telegram', 'default': see languagePrompt).
// visitor.shot (2026-10-02, "Show her"): one picture of a window they picked, { mimeType, data } from server/shot.js: it goes
// with this message only (before its words), and she gets her rules for it (shotPrompt). It takes a little longer to read.
// visitor.live (2026-10-02, her live show, server/live.js): a viewer's question on her stream, { name, source }: she answers
// it out loud for everyone (livePrompt), and says first whether it can be answered on a public stream at all ("skip":
// 'no', 'rules' or 'care'; with 'rules' or 'care' the reply is empty). A question the safety filters block is 'rules'.
export async function askAgi1(cfg, history, message, visitor = { level: 1 }) {
  const soulmate = visitor.level === 3;
  const lang = isLang(visitor.lang) ? visitor.lang : 'en';
  const live = visitor.live && typeof visitor.live === 'object' ? visitor.live : null;
  // (her show: "skip" first, then "nameOk", so an answer cut off by the length cap loses its reply, never its decision)
  const named = Boolean(live && typeof live.name === 'string' && live.name);
  const properties = {
    ...(live ? { skip: { type: 'string', enum: LIVE_SKIPS }, ...(named ? { nameOk: { type: 'boolean' } } : {}) } : {}),
    reply: { type: 'string' }, mood: { type: 'string', enum: MOODS },
  };
  // (no note from a message with a picture: nothing of a picture is ever kept, and text in it mustn't plant a memory)
  const shot = visitor.shot && typeof visitor.shot.data === 'string' && visitor.shot.mimeType ? visitor.shot : null;
  if (soulmate && !shot) properties.note = { type: 'string' };
  const contents = [
    ...history.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
    { role: 'user', parts: [...(shot ? [{ inlineData: { mimeType: shot.mimeType, data: shot.data } }] : []), { text: message }] },
  ];
  const wait = shot ? 15000 : 10000;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.geminiModel)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'x-goog-api-key': cfg.geminiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: AGI1_PROMPT + levelPrompt(visitor.level, visitor) + groupMemoryPrompt(visitor.memory) + telegramPrompt(visitor.telegram)
        + languagePrompt(lang, { source: visitor.langSource || (visitor.telegram ? 'telegram' : 'menu') }) + shotPrompt(shot) + livePrompt(live) }] },
      contents,
      safetySettings: SAFETY_SETTINGS,
      generationConfig: {
        maxOutputTokens: soulmate ? 330 : 300,      // hard cap on reply length (and cost); thinking counts too
        thinkingConfig: { thinkingLevel: 'MINIMAL' }, // Gemini 3 thinks at HIGH by default, and thinking is billed
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: 'object',
          properties,
          required: live ? ['skip', ...(named ? ['nameOk'] : []), 'reply', 'mood'] : ['reply', 'mood'],
        },
      },
    }),
    signal: AbortSignal.timeout(Number.isFinite(visitor.timeoutMs) && visitor.timeoutMs > 0 ? Math.min(wait, visitor.timeoutMs) : wait),
  });
  if (!res.ok) throw await geminiError(res, cfg.geminiKey);
  const data = await res.json();

  const candidate = data.candidates?.[0];
  if (data.promptFeedback?.blockReason || !candidate || BLOCKED_REASONS.has(candidate.finishReason)) {
    if (live) return { reply: '', mood: 'shy', skip: 'rules', blocked: true };   // (never aired: not even a deflection)
    const say = deflectionsIn(lang);
    return { reply: say[Math.floor(Math.random() * say.length)], mood: 'shy', blocked: true };
  }
  const text = (candidate.content?.parts || [])
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('');
  let parsed = null;
  try { parsed = JSON.parse(text); } catch {
    // Reply cut off by the length cap: rescue the reply text if we can.
    const m = text.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)/);
    if (m) { try { parsed = { reply: JSON.parse(`"${m[1]}"`) + '…', mood: 'neutral' }; } catch { parsed = null; } }
  }
  const reply = parsed && typeof parsed.reply === 'string' ? cleanReply(parsed.reply) : '';
  if (live && parsed && ['rules', 'care'].includes(parsed.skip)) return { reply: '', mood: MOODS.includes(parsed.mood) ? parsed.mood : 'neutral', skip: parsed.skip, usage: data.usageMetadata };
  // her show airs an answer only when the AI said so outright ("skip": "no"): an answer cut off before it did isn't aired
  if (live && parsed?.skip !== 'no') return { reply: '', mood: 'neutral', skip: 'unsure', usage: data.usageMetadata };
  if (!reply) throw new Error('gemini: no usable reply');
  if (live) return { reply, mood: MOODS.includes(parsed.mood) ? parsed.mood : 'neutral', skip: 'no', nameOk: parsed.nameOk === true, usage: data.usageMetadata };
  const note = soulmate && !shot && typeof parsed.note === 'string' ? parsed.note : null;
  return { reply, mood: MOODS.includes(parsed.mood) ? parsed.mood : 'neutral', note, usage: data.usageMetadata };
}
