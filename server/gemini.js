// Asks Google Gemini for AGI-1's reply. Only the server calls this; the API key never reaches the browser.
import { AGI1_PROMPT, OFFICIAL_CA, MOODS, levelPrompt, groupMemoryPrompt, telegramPrompt } from './agi1-prompt.js';

// Safety filters are OFF by default for Gemini 3 models, so we switch them on.
// Sexual content uses the strictest level (PG-13 site).
export const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
];
export const BLOCKED_REASONS = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION']);
const DEFLECTIONS = [
  'easy, tiger 😳 this is a PG-13 relationship 💜 tell me about your day instead',
  "hmm, let's keep it cute 🙈 what else is on your mind, love?",
  "nope, not going there babe 💜 but i'm all ears for anything else",
];
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

// Remove wallet addresses other than the official one, and links other than clank.trade.
// The prompt already forbids these. This catches them even if someone tricks the AI.
export function cleanReply(text) {
  return String(text)
    .replace(/0x[a-fA-F0-9]{40}/g, (m) => (m.toLowerCase() === OFFICIAL_CA ? m : '[address removed]'))
    .replace(/\b(?:https?:\/\/|www\.)[^\s)]+/gi, (url) => (/^(?:https?:\/\/)?(?:www\.)?clank\.trade(?:\/|$)/i.test(url) ? url : '[link removed]'))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_REPLY);
}

// history: [{ role: 'user' | 'model', text }], already checked by api/chat.js
// visitor: { level: 1-3, name, notes } (Phase 3). Only Soulmates (level 3) can get a "note" back: a short new fact
// AGI-1 learned about them, which api/chat.js checks and saves. Asking for it costs a few output tokens, so only they do.
// visitor.memory: her Telegram group notes, when the visitor asked about the group.
// visitor.telegram (2026-09-29): she's texting on her Telegram bot ({ repliedTo: her text they replied to, if any }).
export async function askAgi1(cfg, history, message, visitor = { level: 1 }) {
  const soulmate = visitor.level === 3;
  const properties = { reply: { type: 'string' }, mood: { type: 'string', enum: MOODS } };
  if (soulmate) properties.note = { type: 'string' };
  const contents = [
    ...history.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
    { role: 'user', parts: [{ text: message }] },
  ];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.geminiModel)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'x-goog-api-key': cfg.geminiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: AGI1_PROMPT + levelPrompt(visitor.level, visitor) + groupMemoryPrompt(visitor.memory) + telegramPrompt(visitor.telegram) }] },
      contents,
      safetySettings: SAFETY_SETTINGS,
      generationConfig: {
        maxOutputTokens: soulmate ? 330 : 300,      // hard cap on reply length (and cost); thinking counts too
        thinkingConfig: { thinkingLevel: 'MINIMAL' }, // Gemini 3 thinks at HIGH by default, and thinking is billed
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: 'object',
          properties,
          required: ['reply', 'mood'],
        },
      },
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw await geminiError(res, cfg.geminiKey);
  const data = await res.json();

  const candidate = data.candidates?.[0];
  if (data.promptFeedback?.blockReason || !candidate || BLOCKED_REASONS.has(candidate.finishReason)) {
    return { reply: DEFLECTIONS[Math.floor(Math.random() * DEFLECTIONS.length)], mood: 'shy', blocked: true };
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
  if (!reply) throw new Error('gemini: no usable reply');
  const note = soulmate && typeof parsed.note === 'string' ? parsed.note : null;
  return { reply, mood: MOODS.includes(parsed.mood) ? parsed.mood : 'neutral', note, usage: data.usageMetadata };
}
