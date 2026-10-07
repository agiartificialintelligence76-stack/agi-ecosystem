// AGI-1's live show (2026-10-02): her voice on stream, on the owner's own server. The owner's choice: "Her voice via Google
// Cloud": the same Despina voice and moods as the site, with Google Cloud's higher limits (the site's own key allows 100
// spoken lines a day on Tier 1, shared with every visitor). Ways to make it, tried in order (LIVE_VOICES):
//   vertex  Gemini 3.8 Flash-Lite TTS through Google Cloud's Vertex AI (called "Gemini Enterprise Agent Platform" since
//           2026: the same API, aiplatform.googleapis.com; the model is in Preview there), the same model as the site: a
//           service account key file (GOOGLE_APPLICATION_CREDENTIALS) or an API key (LIVE_GCP_API_KEY)
//   cloud   Cloud Text-to-Speech's Gemini voices (gemini-2.5-flash-tts, Despina): an API key or the same key file
//   gemini  the site's own key (GEMINI_API_KEY, Google AI Studio): shares the site's daily limit, so only as a backup
//   fake    a stand-in hum (no Google, no cost): to try the show (--fake-voice)
// Her pre-written lines are made once and kept on the server's disk (tools/live/cache, or LIVE_CACHE_DIR): every show after
// the first one says them without asking Google. Her answers to questions are made each time.
// → { samples: Float32Array (mono, -1..1), rate, by } or null when no way works (she then "says" it silently, captions only).
import { createHash, createSign } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { readWav, fakeVoice } from '../clips/audio.js';
import { styleFor, spokenText } from '../../server/voice.js';

export const RATE = 24000;
export const VOICE_NAME = 'Despina';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

// ---------- settings ----------
// env: the server's settings (tools/live/live.env). fake: --fake-voice
export function voiceSettings(env = process.env, { fake = false } = {}) {
  const keyFile = String(env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
  const apiKey = String(env.LIVE_GCP_API_KEY || '').trim();
  const listed = String(env.LIVE_VOICES || '').split(',').map((s) => s.trim().toLowerCase()).filter((s) => ['vertex', 'cloud', 'gemini', 'fake'].includes(s));
  const order = fake ? ['fake'] : listed.length ? listed
    : [...(keyFile || apiKey ? ['vertex'] : []), ...(env.GEMINI_API_KEY ? ['gemini'] : [])];
  return {
    order: [...new Set(order)],
    voice: String(env.AGI1_VOICE || VOICE_NAME).trim() || VOICE_NAME,
    keyFile, apiKey,
    project: String(env.LIVE_GCP_PROJECT || '').trim(),
    location: String(env.LIVE_VERTEX_LOCATION || 'global').trim() || 'global',
    vertexModel: String(env.LIVE_VOICE_MODEL || 'gemini-3.8-flash-lite-tts').trim(),
    cloudModel: String(env.LIVE_CLOUD_TTS_MODEL || 'gemini-2.5-flash-tts').trim(),
    geminiKey: String(env.GEMINI_API_KEY || '').trim(),
    cacheDir: String(env.LIVE_CACHE_DIR || '').trim() || new URL('./cache/', import.meta.url).pathname,
    // how long one line may take Google (a slower one: she says it silently, and that way rests a minute)
    timeoutMs: Math.min(60, Math.max(5, Number(env.LIVE_VOICE_TIMEOUT_S) || 15)) * 1000,
  };
}

// ---------- a Google Cloud service account (its key file): a signed token request, then an access token ----------
export function serviceAccount(text) {
  let sa;
  try { sa = JSON.parse(text); } catch { throw new Error('the Google Cloud key file is not JSON'); }
  if (sa?.type !== 'service_account' || typeof sa.client_email !== 'string' || typeof sa.private_key !== 'string' || !/BEGIN [A-Z ]*PRIVATE KEY/.test(sa.private_key)) {
    throw new Error('the Google Cloud key file is not a service account key (IAM → Service accounts → Keys → Add key → JSON)');
  }
  return { email: sa.client_email, key: sa.private_key, project: sa.project_id || '', tokenUrl: sa.token_uri || TOKEN_URL, keyId: sa.private_key_id || undefined };
}
const b64url = (data) => Buffer.from(data).toString('base64url');
// The signed request for a token (a JWT, RS256), as Google's OAuth for service accounts asks: valid an hour
export function tokenRequest(sa, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', ...(sa.keyId ? { kid: sa.keyId } : {}) }));
  const claims = b64url(JSON.stringify({ iss: sa.email, scope: SCOPE, aud: sa.tokenUrl, iat, exp: iat + 3600 }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${head}.${claims}`);
  return `${head}.${claims}.${signer.sign(sa.key).toString('base64url')}`;
}
let token = null;                 // { value, until }
export async function accessToken(sa, { fetchFn = fetch, now = Date.now() } = {}) {
  if (token && token.until > now + 120_000 && token.for === sa.email) return token.value;
  const res = await fetchFn(sa.tokenUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: tokenRequest(sa, now) }).toString(),
    signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.access_token !== 'string') {
    throw googleError(res.status, `google sign-in: HTTP ${res.status} ${String(data.error || '')} ${String(data.error_description || '').slice(0, 160)}`.trim(),
      ' (check the key file: a service account of the project, its key not deleted, the "Agent Platform User" role, formerly "Vertex AI User")');
  }
  token = { value: data.access_token, until: now + Math.max(60, Number(data.expires_in) || 3600) * 1000, for: sa.email };
  return token.value;
}
export const forgetToken = () => { token = null; };

function googleError(status, text, hint = '') {
  const err = new Error(`${text.replace(/AIza[0-9A-Za-z_-]{20,}/g, '[key]').replace(/ya29\.[0-9A-Za-z._-]+/g, '[token]')}${hint}`);
  err.status = status;
  err.retry = status === 429 || status >= 500;
  return err;
}
async function failed(res, what, hint) {
  let text = '';
  try { text = (await res.text()).replace(/\s+/g, ' ').slice(0, 300); } catch { /* no body */ }
  return googleError(res.status, `${what}: HTTP ${res.status} ${text}`, res.status === 403 || res.status === 401 ? hint : res.status === 404 ? ' (the model or the project/location: check LIVE_VOICE_MODEL, LIVE_GCP_PROJECT, LIVE_VERTEX_LOCATION)' : '');
}
// raw 16-bit PCM (what Gemini's speech models send) → Float32 samples
export function pcmToSamples(buf) {
  const n = Math.floor(buf.length / 2), out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(i * 2) / 32768;
  return out;
}
export function samplesToPcm(samples) {
  const buf = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), i * 2);
  return buf;
}

// ---------- the requests ----------
// What the speech model reads: her style ("director's notes") and the words, kept apart, so she never reads the notes out
// (2026-10-07) who: whose voice it is (hers: "a young woman"; the people she meets on her trips have their own: people.js)
export const promptFor = (words, style, who = 'a young woman') => `## DIRECTOR'S NOTES\nVoice: ${who}, the same voice every time. Style: ${style}\n\n## TRANSCRIPT\n${words}`;
// Vertex AI (Gemini 3.8 Flash-Lite TTS): https://aiplatform.googleapis.com/v1beta1/projects/{p}/locations/{l}/publishers/google/models/{m}:generateContent
export function vertexRequest(s, words, style, { bearer = null, voiceName = null, who = undefined } = {}) {
  const host = s.location === 'global' ? 'aiplatform.googleapis.com' : `${s.location}-aiplatform.googleapis.com`;
  const path = s.project
    ? `/v1beta1/projects/${encodeURIComponent(s.project)}/locations/${encodeURIComponent(s.location)}/publishers/google/models/${encodeURIComponent(s.vertexModel)}:generateContent`
    : `/v1beta1/publishers/google/models/${encodeURIComponent(s.vertexModel)}:generateContent`;
  return {
    url: `https://${host}${path}`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : { 'x-goog-api-key': s.apiKey }) },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: promptFor(words, style, who) }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName || s.voice } } } },
      }),
      signal: AbortSignal.timeout(s.timeoutMs || 15_000),
    },
  };
}
// Cloud Text-to-Speech (Gemini voices): https://texttospeech.googleapis.com/v1/text:synthesize (the style apart, as "prompt")
export function cloudRequest(s, words, style, { bearer = null, voiceName = null } = {}) {
  return {
    url: 'https://texttospeech.googleapis.com/v1/text:synthesize',
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : { 'x-goog-api-key': s.apiKey }),
        ...(bearer && s.project ? { 'x-goog-user-project': s.project } : {}) },
      body: JSON.stringify({
        input: { prompt: style, text: words },
        voice: { languageCode: 'en-US', name: voiceName || s.voice, modelName: s.cloudModel },
        audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: RATE },
      }),
      signal: AbortSignal.timeout(s.timeoutMs || 15_000),
    },
  };
}
// the audio in a Vertex answer: { samples, rate }
export function vertexAudio(data) {
  for (const c of Array.isArray(data?.candidates) ? data.candidates : []) {
    for (const p of Array.isArray(c?.content?.parts) ? c.content.parts : []) {
      const inline = p?.inlineData || p?.inline_data;
      if (inline && typeof inline.data === 'string' && inline.data) {
        const buf = Buffer.from(inline.data, 'base64');
        const mime = String(inline.mimeType || inline.mime_type || '');
        if (/wav/i.test(mime)) { const w = readWav(buf); return { samples: w.samples, rate: w.rate }; }
        const rate = Number(/rate=(\d+)/i.exec(mime)?.[1]) || RATE;
        return { samples: pcmToSamples(buf), rate };
      }
    }
  }
  return null;
}

// ---------- her voice: each way in order, her pre-written lines kept on disk ----------
export function createVoice(settings, { fetchFn = fetch, log = console } = {}) {
  let sa = null, saError = null;
  if (settings.keyFile) {
    try {
      sa = serviceAccount(readFileSync(settings.keyFile, 'utf8'));
      if (!settings.project) settings = { ...settings, project: sa.project };
    } catch (err) {
      // no key file but an API key: the API key it is (live.env.example names the key file's place either way)
      if (!(err.code === 'ENOENT' && settings.apiKey)) {
        const hint = { EACCES: ': the show can\'t read it (sh tools/live/live.sh gives it to the show\'s user)', ENOENT: ': no file there (put it at /opt/agi1-live/google-key.json, or use LIVE_GCP_API_KEY)' }[err.code] || '';
        saError = err.message.startsWith('the Google') ? err : new Error(`can't read GOOGLE_APPLICATION_CREDENTIALS (${err.code || err.message})${hint}`);
      }
    }
  }
  const resting = new Map();            // a way that said "wait": not asked again until then
  const ways = {
    async vertex(words, style, v = {}) {
      if (saError) throw saError;
      if (!sa && !settings.apiKey) throw new Error('vertex: no GOOGLE_APPLICATION_CREDENTIALS key file or LIVE_GCP_API_KEY');
      const bearer = sa ? await accessToken(sa, { fetchFn }) : null;
      const { url, init } = vertexRequest(settings, words, style, { bearer, voiceName: v.name, who: v.who });
      const res = await fetchFn(url, init);
      if (!res.ok) { if (res.status === 401) forgetToken(); throw await failed(res, 'vertex', ' (enable the "Agent Platform API" for the project (formerly "Vertex AI API"), and give the service account the "Agent Platform User" role (formerly "Vertex AI User"))'); }
      const audio = vertexAudio(await res.json());
      if (!audio || audio.samples.length < 2400) throw new Error('vertex: no audio in the answer');
      return audio;
    },
    async cloud(words, style, v = {}) {
      if (saError) throw saError;
      if (!sa && !settings.apiKey) throw new Error('cloud: no GOOGLE_APPLICATION_CREDENTIALS key file or LIVE_GCP_API_KEY');
      const bearer = sa ? await accessToken(sa, { fetchFn }) : null;
      const { url, init } = cloudRequest(settings, words, style, { bearer, voiceName: v.name });
      const res = await fetchFn(url, init);
      if (!res.ok) { if (res.status === 401) forgetToken(); throw await failed(res, 'cloud tts', ' (enable the "Cloud Text-to-Speech API" for the project)'); }
      const data = await res.json();
      if (typeof data.audioContent !== 'string') throw new Error('cloud tts: no audio in the answer');
      const w = readWav(Buffer.from(data.audioContent, 'base64'));
      return { samples: w.samples, rate: w.rate };
    },
    async gemini(words, style, v = {}) {
      if (!settings.geminiKey) throw new Error('gemini: no GEMINI_API_KEY');
      const { speakAsAgi1 } = await import('../../server/voice.js');
      const wav = await speakAsAgi1({ geminiKey: settings.geminiKey, voiceModel: 'gemini-3.8-flash-lite-tts', voiceName: v.name || settings.voice }, words, style, { timeoutMs: settings.timeoutMs || 15_000 });
      const w = readWav(wav);
      return { samples: w.samples, rate: w.rate };
    },
    async fake(words) {
      const w = readWav(fakeVoice(words));
      return { samples: w.samples, rate: w.rate };
    },
  };
  const modelOf = (way) => ({ vertex: settings.vertexModel, cloud: settings.cloudModel, gemini: 'gemini-3.8-flash-lite-tts', fake: 'stand-in' }[way]);
  // (another voice than hers: its name and who it is are part of its key; hers stay as they were, so her kept lines stay kept)
  const cacheFile = (way, words, style, v = null) => join(settings.cacheDir, `${createHash('sha256').update([way, modelOf(way), v?.name || settings.voice, style, words, ...(v ? [v.who || ''] : [])].join('\n')).digest('hex').slice(0, 32)}.pcm`);

  // text: what she says (her captions); options: say (how to say it, if different), mood, keep (a pre-written line: kept on disk)
  // (2026-10-07) voice: { name, who, style }: someone else's voice (the people she meets on her trips: Google's ready-made
  // voices, never hers), their own style instead of her mood's
  async function speak(text, { say = null, mood = 'neutral', keep = false, now = Date.now, voice = null } = {}) {
    const words = spokenText(say || text);
    if (!words) return null;
    const v = voice && typeof voice.name === 'string' && /^[A-Z][a-z]+$/.test(voice.name) ? { name: voice.name, who: String(voice.who || 'a person').slice(0, 80), style: String(voice.style || '').slice(0, 300) } : null;
    const style = v ? v.style || 'Friendly and natural.' : styleFor(mood);
    for (const way of settings.order) {
      // (a line kept on disk plays even while its way rests: nothing is asked of Google for it)
      const file = keep ? cacheFile(way, words, style, v) : null;
      if (file && existsSync(file)) {
        try { return { samples: pcmToSamples(readFileSync(file)), rate: RATE, by: `${way} (kept)` }; } catch { /* make it again */ }
      }
      if ((resting.get(way) || 0) > now()) continue;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          let audio = await ways[way](words, style, v || {});
          if (audio.rate !== RATE) audio = { samples: resample(audio.samples, audio.rate, RATE), rate: RATE };
          if (file) {
            try { mkdirSync(settings.cacheDir, { recursive: true }); writeFileSync(`${file}.part`, samplesToPcm(audio.samples)); renameSync(`${file}.part`, file); } catch (err) { log.warn?.(`[voice] couldn't keep a line: ${err.message}`); }
          }
          return { ...audio, by: way };
        } catch (err) {
          const slow = err.name === 'TimeoutError' || err.name === 'AbortError';
          log.warn?.(`[voice] ${way}: ${slow ? `no answer within ${Math.round(settings.timeoutMs / 1000)} s (it rests a minute)` : err.message}`);
          if (err.retry && attempt === 0) { await new Promise((r) => { setTimeout(r, 1500); }); continue; }
          if (err.status === 429 || slow) resting.set(way, now() + 60_000);
          break;
        }
      }
    }
    return null;
  }
  // when she can be asked for a new line again: 0 while a way can be asked now; else the earliest a resting way can (the
  // warm-up waits for it instead of skipping lines: 2026-10-06, the owner's first --warm made 11 of 121 that way)
  const restingUntil = (t = Date.now()) => {
    const times = settings.order.map((way) => resting.get(way) || 0);
    return !times.length || times.some((x) => x <= t) ? 0 : Math.min(...times);
  };
  return { speak, order: settings.order, settings, restingUntil };
}

// another sample rate → 24 kHz (straight lines between samples: speech only, so it's plenty)
export function resample(samples, from, to) {
  if (from === to) return samples;
  const n = Math.round((samples.length * to) / from), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * from) / to, a = Math.floor(x), f = x - a;
    out[i] = (samples[a] ?? 0) * (1 - f) + (samples[a + 1] ?? samples[a] ?? 0) * f;
  }
  return out;
}
