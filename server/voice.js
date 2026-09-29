// AGI-1's voice (2026-09-25): her chat replies read aloud by Gemini's speech model, always in the same voice (Despina,
// chosen by the owner), instead of the browser's own robotic one. Her calm, smooth style stays; since the same evening the
// feeling of each reply's mood is added to it (MOOD_STYLES). Only the server calls Gemini; the key never reaches the
// browser. api/voice.js decides who may use it and how much.
// Two ways to ask: streamAsAgi1() (replies: Gemini sends small pieces while it's still making the rest, and we pass them
// straight on, so she starts talking about a second after the reply) and speakAsAgi1() (one whole WAV file: the greeting,
// and the fallback if streaming ever breaks).
import { geminiError } from './gemini.js';
import { speakable, clipSpeech } from '../src/chat/voice.js';
import { LIMIT_LINES, REST_LINES, limitLineIn, restLineIn } from '../src/chat/limit-lines.js';
import { CHECK_LINES, checkLinesIn } from '../src/checker/lines.js';
import { linesOf } from '../src/i18n/all.js';
import { lineAt } from '../src/i18n/text.js';
import { isLang } from '../src/i18n/langs.js';

// How she sounds: the style the owner approved with Despina (a "neutral" reply sounds exactly like this).
export const VOICE_STYLE = "Calm, smooth and low, speaking softly and unhurried, a little teasing, like she's smiling. Relaxed, never excited or bubbly.";
// …and with the feeling of the moment on top (2026-09-25, the owner: "is her natural voice matched with its mood in chat?
// if not, match it"). Still Despina, still smooth and unhurried, so she always sounds like herself. The chat's moods
// (happy, love, shy, wave, neutral) come with each reply; the others belong to her fixed lines.
export const MOOD_STYLES = {
  neutral: VOICE_STYLE,
  happy: "Warm and happy, smiling as she speaks, with a playful little laugh in her voice. Still smooth, low and unhurried, never shrill or bubbly.",
  love: "Soft, tender and affectionate, a little breathy, like she's blushing and smiling at someone she adores. Slow, warm and low.",
  shy: "Soft and a little flustered, bashful, with a shy little giggle and small hesitations. Quiet, warm and low.",
  wave: "Bright and friendly, a warm hello with a smile in her voice. Smooth and relaxed, not bubbly.",
  sweet: "Warm and sweet, a little wistful that the chat is ending for today, gentle and smiling. Smooth and unhurried.",
  sleepy: "Soft, cozy and a little sleepy, with a small yawn in her voice. Warm, gentle and slow.",
  celebrate: "Joyful and proud, beaming, with a happy little laugh in her voice and a bit more energy than usual. Still smooth and warm, never shouting.",
  sad: "Soft and a little sad, quieter and slower, with a small sigh, but gentle, kind and reassuring.",
  // ClankChecker (2026-09-26): what she says about a coin's scan (src/checker/lines.js)
  careful: "Thoughtful and gentle, a little careful, like she's looking closely at something before she says what she thinks. Warm, smooth, low and unhurried.",
  worried: "Concerned and caring, softer and a little slower, like she's gently warning a friend. Warm and kind, never dramatic.",
  pout: "Playfully offended and a little pouty, teasing, like someone just borrowed her name. Still smooth, warm and low, never angry.",
};
export const styleFor = (mood) => (Object.hasOwn(MOOD_STYLES, mood) ? MOOD_STYLES[mood] : VOICE_STYLE);
// Fixed lines, the same for everyone (so Vercel's CDN can keep one copy), exactly as the chat shows them: her "hi, it's me"
// (the speaker button, picking up a call), her out-of-messages lines for Strangers and Crushes, (2026-09-25) her short
// "come back tomorrow" lines (src/chat/limit-lines.js) and (2026-09-26) what she says about a ClankChecker scan
// (src/checker/lines.js). Her market lines are made from src/chat/market-lines.js.
export const LINES = {
  hello: "hi, it's me",
  ...Object.fromEntries(Object.values(LIMIT_LINES).map((l) => [l.key, speakable(l.text)])),
  ...Object.fromEntries(Object.values(REST_LINES).map((l) => [l.key, speakable(l.text)])),
  ...Object.fromEntries(Object.values(CHECK_LINES).map((l) => [l.key, l.spoken])),
};
// …and how each one sounds
export const LINE_MOODS = {
  hello: 'wave',
  ...Object.fromEntries(Object.values(LIMIT_LINES).map((l) => [l.key, 'sweet'])),
  ...Object.fromEntries(Object.values(REST_LINES).map((l) => [l.key, 'sleepy'])),
  ...Object.fromEntries(Object.values(CHECK_LINES).map((l) => [l.key, l.mood])),
};
// …in her other languages (2026-09-29): the same keys and moods, the words from src/i18n/lines/<code>.js. → key → words
const inLang = new Map();
export function linesFor(lang = 'en') {
  if (lang === 'en' || !isLang(lang)) return LINES;
  if (!inLang.has(lang)) {
    const L = linesOf(lang);
    inLang.set(lang, {
      hello: speakable(lineAt(L, 'hello')),
      ...Object.fromEntries([1, 2].map((level) => limitLineIn(level, L, lang)).map((l) => [l.key, speakable(l.text)])),
      ...Object.fromEntries(['person', 'site'].map((kind) => restLineIn(kind, L, lang)).map((l) => [l.key, speakable(l.text)])),
      ...Object.fromEntries(Object.values(checkLinesIn(L, lang)).map((l) => [l.key, l.spoken])),
    });
  }
  return inLang.get(lang);
}
export const MAX_SPOKEN = 300;          // characters read aloud per reply (about 20 seconds); her replies are usually shorter
// Chinese, Japanese and Korean say about a syllable per character: 120 of them are about as long (2026-09-29)
export const MAX_SPOKEN_DENSE = 120;
const DENSE_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
export const isDense = (words) => (String(words).match(DENSE_SCRIPT) || []).length > String(words).length * 0.3;

// The exact words she says: no emojis or "[link removed]", tickers without "$", at most MAX_SPOKEN characters.
export const spokenText = (text) => { const words = speakable(text); return clipSpeech(words, isDense(words) ? MAX_SPOKEN_DENSE : MAX_SPOKEN); };

const TTS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const request = (cfg, words, stream, style) => ({
  method: 'POST',
  headers: { 'x-goog-api-key': cfg.geminiKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: cfg.voiceModel,
    input: [{
      type: 'user_input',
      content: [{ type: 'text', text: words, annotations: [{ type: 'speech_metadata', style }] }],
    }],
    response_format: { type: 'audio' },
    generation_config: { speech_config: [{ voice: cfg.voiceName }] },
    store: false,                                // Google doesn't keep this request for later retrieval
    ...(stream ? { stream: true } : {}),
  }),
  signal: AbortSignal.timeout(stream ? 25000 : 20000),
});

// ---------- one whole WAV file ----------
// → a WAV file (Buffer). Gemini answers with base64 audio in steps[].content[] ({ type: 'audio', data, mime_type }).
// style: how she says it (styleFor(mood)); her approved calm style if not given.
export async function speakAsAgi1(cfg, words, style = VOICE_STYLE) {
  const res = await fetch(TTS_URL, request(cfg, words, false, style));
  if (!res.ok) throw await geminiError(res, cfg.geminiKey);
  const data = await res.json();
  const audio = findAudio(data);
  if (!audio) throw new Error(`gemini: no audio in the answer${data?.status ? ` (status ${String(data.status).slice(0, 30)})` : ''}`);
  const bytes = Buffer.from(audio.data, 'base64');
  if (bytes.length < 100) throw new Error('gemini: the audio is empty');
  return toWav(bytes, audio);
}

function findAudio(data) {
  for (const step of Array.isArray(data?.steps) ? data.steps : []) {
    for (const part of Array.isArray(step?.content) ? step.content : []) {
      if (part?.type === 'audio' && typeof part.data === 'string' && part.data) return part;
    }
  }
  const o = data?.output_audio;                   // the SDKs' shortcut name, in case the answer ever carries it
  return o && typeof o.data === 'string' && o.data ? o : null;
}

// Gemini sends a WAV file by default. Raw 16-bit PCM ("audio/l16", little-endian) gets the 44-byte WAV header browsers need.
export function toWav(bytes, { mime_type: type = '', sample_rate: rateField, channels: chField } = {}) {
  if (isWav(bytes)) return bytes;
  if (type && !/l16|pcm/i.test(type)) throw new Error(`gemini: unexpected audio type ${String(type).slice(0, 40)}`);
  const rate = Number(rateField) || Number((String(type).match(/rate=(\d+)/) || [])[1]) || 24000;
  const channels = Number(chField) || 1;
  const h = Buffer.alloc(44);
  h.write('RIFF', 0, 'ascii'); h.writeUInt32LE(36 + bytes.length, 4); h.write('WAVE', 8, 'ascii');
  h.write('fmt ', 12, 'ascii'); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * channels * 2, 28); h.writeUInt16LE(channels * 2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36, 'ascii'); h.writeUInt32LE(bytes.length, 40);
  return Buffer.concat([h, bytes]);
}
export const isWav = (b) => b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WAVE';
// the samples inside a WAV file (its "data" chunk)
function pcmOf(wav) {
  for (let at = 12; at + 8 <= wav.length;) {
    const id = wav.toString('ascii', at, at + 4), size = wav.readUInt32LE(at + 4);
    if (id === 'data') return wav.subarray(at + 8, Math.min(wav.length, at + 8 + size));
    at += 8 + size + (size % 2);
  }
  return wav.subarray(44);
}

// ---------- streamed ----------
// The streamed answer ended without any audio: Google's format may have changed. api/voice.js then asks for a whole clip.
export class NoAudioError extends Error { noAudio = true; }

// → { rate, stream }: a stream of raw 16-bit PCM (little-endian, mono) that starts with the first piece of her voice.
// It resolves only once that first piece is here, so a refusal before any audio is still a normal error.
export async function streamAsAgi1(cfg, words, style = VOICE_STYLE) {
  const res = await fetch(TTS_URL, request(cfg, words, true, style));
  if (!res.ok) throw await geminiError(res, cfg.geminiKey);
  const { events, stop } = readEvents(res.body);
  const nextPiece = async () => {
    for (;;) {
      const { value: ev, done } = await events.next();
      if (done) return null;
      if (ev?.event_type === 'error' || ev?.error) {
        const e = ev.error || {};
        const err = new Error(`gemini: stream error ${String(e.code ?? e.status ?? '').slice(0, 20)} ${String(e.message ?? '').slice(0, 160)}`.trim());
        const code = Number(e.code);
        if (Number.isInteger(code) && code >= 400) err.httpStatus = code;     // (so a 429 in the stream is "busy", like a real 429)
        err.perDay = /per[_ ]?day|PerDay/i.test(String(e.message ?? ''));
        err.credits = /credit|billing|prepa(id|y)|spend/i.test(String(e.message ?? ''));
        err.retryAfter = null;
        throw err;
      }
      const piece = audioPiece(ev);
      if (piece) return piece;
    }
  };
  const first = await nextPiece();
  if (!first) throw new NoAudioError('gemini: the streamed answer had no audio');
  let waiting = first.bytes, stopped = false;
  const stream = new ReadableStream({
    async pull(controller) {
      if (stopped) return;
      if (waiting) { controller.enqueue(new Uint8Array(waiting)); waiting = null; return; }
      try {
        const piece = await nextPiece();
        if (stopped) return;
        if (piece) controller.enqueue(new Uint8Array(piece.bytes));
        else controller.close();
      } catch (err) {
        if (stopped) return;
        console.error('[voice] the stream broke off (she stops early):', err.message);
        controller.close();                         // the page plays what it already has
      }
    },
    // The visitor stopped her: stop reading from Google too. Google's stream is cancelled directly (a read that is still
    // waiting for the next piece then ends at once); only then is the reader wound down. Waiting for the reader first
    // could wait forever, because it can't finish while that read is still waiting (seen on Node 24, 2026-09-25).
    async cancel() {
      stopped = true;
      await stop();
      events.return?.().catch(() => { /* already finished */ });
    },
  });
  return { rate: first.rate, stream };
}

function audioPiece(ev) {
  const d = ev?.delta;
  if (!d || d.type !== 'audio' || typeof d.data !== 'string' || !d.data) return null;
  let bytes = Buffer.from(d.data, 'base64');
  if (isWav(bytes)) bytes = pcmOf(bytes);           // a WAV piece: keep only its samples
  const rate = Number(d.sample_rate) || Number((String(d.mime_type || '').match(/rate=(\d+)/) || [])[1]) || 24000;
  return bytes.length ? { bytes, rate } : null;
}

// Server-Sent Events → JSON objects ("data: {...}" blocks separated by a blank line). If the answer isn't SSE after all
// (a plain JSON interaction or a JSON array), its audio is handed out as if it had been streamed.
// → { events (an async iterator of those objects), stop() (cancels Google's stream, even while a read is waiting) }
function readEvents(body) {
  const reader = body.getReader();
  return { events: eventsFrom(reader), stop: () => reader.cancel().catch(() => { /* already closed */ }) };
}
async function* eventsFrom(reader) {
  const decoder = new TextDecoder();
  let buf = '', raw = '', sse = false;
  const parse = function* (block) {
    const data = block.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).replace(/^ /, '')).join('\n');
    if (!data) return;
    sse = true;
    if (data.trim() === '[DONE]') return;
    try { yield JSON.parse(data); } catch { /* not JSON: skip */ }
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      buf += text;
      if (!sse) raw += text;
      for (let m = /\r?\n\r?\n/.exec(buf); m; m = /\r?\n\r?\n/.exec(buf)) {
        const block = buf.slice(0, m.index);
        buf = buf.slice(m.index + m[0].length);
        yield* parse(block);
      }
    }
    buf += decoder.decode();
    if (buf.trim()) yield* parse(buf);
    if (!sse && raw.trim()) {
      let whole = null;
      try { whole = JSON.parse(raw); } catch { /* not JSON either */ }
      for (const item of Array.isArray(whole) ? whole : whole ? [whole] : []) {
        const audio = findAudio(item);
        if (audio) yield { event_type: 'step.delta', delta: audio };
        else yield item;
      }
    }
  } finally {
    reader.cancel().catch(() => { /* already closed */ });
  }
}
