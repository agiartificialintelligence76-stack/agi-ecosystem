// AGI-1's voice (2026-09-25): /api/voice, the voice tickets from /api/chat, streaming, and what she says out loud.
// Gemini and Supabase are replaced by fakes: no keys, no cost, about a second. Run: npm test
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { POST, GET, resetForTests } from '../api/voice.js';
import { POST as CHAT } from '../api/chat.js';
import { makeVoiceTicket, checkVoiceTicket, visitorCode, visitorCodeForDay } from '../server/security.js';
import { toWav, spokenText, VOICE_STYLE, MOOD_STYLES, styleFor, LINES, LINE_MOODS, MAX_SPOKEN } from '../server/voice.js';
import { LINE_VERSION } from '../src/chat/voice-lines.js';
import { voicePerDay } from '../server/limits.js';
import { lineId } from '../server/voice-store.js';
import { getConfig } from '../server/config.js';
import { msToGoogleReset } from '../server/gemini.js';
import { speakable, clipSpeech } from '../src/chat/voice.js';
import { voiceBurst } from '../server/burst.js';
import { forgetMarket, agiMarket } from '../server/market.js';
import { milestoneLine, dumpLine } from '../src/chat/market-lines.js';
import { TOKENS } from '../src/prices/parse.js';

const SECRET = 'test-pass-secret-that-is-long-enough-1234';
const ENV = {
  GEMINI_API_KEY: 'fake-gemini-key', SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fake_key_123',
  TURNSTILE_SECRET_KEY: 'fake-turnstile-secret', PASS_SECRET: SECRET,
};
const IP = '1.2.3.4';
const AGI_CA = TOKENS[0].ca;
const TEXT = 'hi cutie 💜 $AGI says hello';
const pcm = Buffer.alloc(4800, 1);                                  // a tenth of a second of "sound"
const piece = (k) => Buffer.alloc(2400, k + 1);                     // streamed pieces, each recognisable
const wavFile = toWav(pcm, { mime_type: 'audio/l16', sample_rate: 24000 });
const bigWav = toWav(Buffer.alloc(700_000, 7), { mime_type: 'audio/l16', sample_rate: 24000 });   // about 15 seconds
const TTS = 'https://generativelanguage.googleapis.com/v1beta/interactions';

// A streamed answer like Gemini's: Server-Sent Events, cut into network chunks at awkward places.
const sseBody = (events, { keepOpen = false, onCancel } = {}) => {
  const text = events.map((e) => `event: ${e.event_type}\r\ndata: ${JSON.stringify(e)}\r\n\r\n`).join('');
  const bytes = new TextEncoder().encode(text);
  let at = 0;
  return new ReadableStream({
    pull(c) {
      if (at >= bytes.length) { if (!keepOpen) c.close(); return new Promise(() => {}); }
      const n = 7 + (at % 23);                                      // odd sizes: events and base64 split anywhere
      c.enqueue(bytes.slice(at, at + n));
      at += n;
      return undefined;
    },
    cancel() { onCancel?.(); },
  });
};
const delta = (bytes, extra = {}) => ({ event_type: 'step.delta', index: 0, delta: { type: 'audio', data: bytes.toString('base64'), mime_type: 'audio/l16', sample_rate: 24000, channels: 1, ...extra } });
const START = [{ event_type: 'interaction.created', interaction: { id: 'i1' } }, { event_type: 'step.start', index: 0 }];
const END = [{ event_type: 'step.stop', index: 0 }, { event_type: 'interaction.completed', interaction: { id: 'i1', status: 'completed' } }];

let calls, fake, kept;
beforeEach(() => {
  Object.assign(process.env, ENV);
  for (const k of ['VOICE_DAILY_CAP', 'VOICE_DAILY_REQUESTS', 'AGI1_VOICE', 'GEMINI_TTS_MODEL', 'GEMINI_TTS_MODELS', 'VOICE_STREAM']) delete process.env[k];
  voiceBurst.reset();
  resetForTests();
  calls = [];
  fake = { take: 'ok', takeStatus: 200, takeBody: null, tts: 'wav', ttsStatus: 200, stream: 'sse', cancelled: 0, mcap: 2_030_000, dex: 200, fail: [], byModel: {}, store: 'ok' };
  kept = new Map();                                                   // her recorded lines "in the database": id → take → parts
  forgetMarket();
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, headers: init.headers, body });
    if (url.includes('/rest/v1/rpc/voice_take')) {
      return fake.takeStatus === 200 ? Response.json(fake.take) : Response.json(fake.takeBody ?? { message: 'boom' }, { status: fake.takeStatus });
    }
    if (url.includes('/rest/v1/rpc/voice_line_')) {                  // (like supabase/voice-lines.sql: the newest whole take)
      if (fake.store === 'missing') return Response.json({ code: 'PGRST202', message: 'Could not find the function' }, { status: 404 });
      if (fake.store === 'down') return Response.json({ message: 'boom' }, { status: 500 });
      if (url.endsWith('voice_line_put')) {
        const takes = kept.get(body.p_id) ?? new Map();
        const t = takes.get(body.p_take) ?? { parts: [], n: body.p_parts, at: calls.length };
        t.parts[body.p_part] = body.p_data;
        takes.set(body.p_take, t);
        kept.set(body.p_id, takes);
        return Response.json('ok');
      }
      const whole = [...(kept.get(body.p_id) ?? new Map()).values()].filter((t) => t.parts.filter(Boolean).length === t.n).sort((a, b) => b.at - a.at)[0];
      return Response.json(whole ? whole.parts.join('') : null);
    }
    if (url.includes('/rest/v1/rpc/chat_take')) return Response.json('ok');
    if (url.startsWith('https://challenges.cloudflare.com/')) return Response.json({ success: true, action: 'chat' });
    if (url === TTS) {
      const mine = fake.byModel[body.model];                        // (one model's own refusals first)
      if (mine?.length || fake.fail.length) {                       // Google says no (as described), once per entry
        const f = mine?.length ? mine.shift() : fake.fail.shift();
        const details = f.status === 429 && !f.credits ? [
          { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaMetric: `generativelanguage.googleapis.com/generate_requests_per_model${f.perDay ? '_per_day' : ''}`, quotaId: f.perDay ? 'GenerateRequestsPerDayPerProjectPerModel' : 'GenerateRequestsPerMinutePerProjectPerModel' }] },
          ...(f.retry ? [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: f.retry }] : []),
        ] : [];
        const message = f.credits ? 'Your prepayment credits are depleted. Please go to AI Studio to manage your project and billing.' : f.status === 429 ? 'You exceeded your current quota.' : 'The model is overloaded.';
        return Response.json({ error: { code: f.status, status: f.status === 429 ? 'RESOURCE_EXHAUSTED' : f.status === 404 ? 'NOT_FOUND' : 'UNAVAILABLE', message, details } }, { status: f.status });
      }
      if (fake.ttsStatus !== 200) {
        return Response.json({ error: { status: 'PERMISSION_DENIED', message: 'key AIzaSyFAKEFAKEFAKEFAKEFAKEFAKE1234 refused' } }, { status: fake.ttsStatus });
      }
      const whole = (data, mime) => Response.json({ id: 'i1', status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'audio', data: data.toString('base64'), mime_type: mime, sample_rate: 24000, channels: 1 }] }] });
      if (body.stream) {
        const sse = (events, opts) => new Response(sseBody(events, opts), { headers: { 'content-type': 'text/event-stream' } });
        if (fake.stream === 'sse') return sse([...START, delta(piece(0)), delta(piece(1)), delta(piece(2)), ...END]);
        if (fake.stream === 'json') return whole(pcm, 'audio/l16');                       // not SSE after all: one JSON answer
        if (fake.stream === 'wavpieces') return sse([...START, delta(toWav(piece(0)), { mime_type: 'audio/wav' }), delta(piece(1)), ...END]);
        if (fake.stream === 'error') return sse([...START, { event_type: 'error', error: { code: 429, message: 'RESOURCE_EXHAUSTED quota' } }]);
        if (fake.stream === 'mid') return sse([...START, delta(piece(0)), { event_type: 'error', error: { code: 500, message: 'broke off' } }]);
        if (fake.stream === 'none') return sse([...START, ...END]);
        if (fake.stream === 'hang') return sse([...START, delta(piece(0))], { keepOpen: true, onCancel: () => { fake.cancelled += 1; } });
      }
      if (fake.tts === 'none') return Response.json({ id: 'i0', status: 'failed', steps: [] });
      if (fake.tts === 'big') return whole(bigWav, 'audio/wav');
      return fake.tts === 'pcm' ? whole(pcm, 'audio/l16') : whole(wavFile, 'audio/wav');
    }
    if (url.startsWith('https://api.dexscreener.com/tokens/v1/robinhood/')) {      // $AGI's market numbers (market lines)
      if (fake.dex !== 200) return new Response('busy', { status: fake.dex });
      return Response.json([
        { chainId: 'robinhood', baseToken: { address: AGI_CA }, priceUsd: '0.00203', liquidity: { usd: 150_000 }, marketCap: fake.mcap, fdv: fake.mcap, priceChange: { h24: -3.2 } },
        { chainId: 'robinhood', baseToken: { address: AGI_CA }, priceUsd: '0.00150', liquidity: { usd: 900 }, marketCap: 99, priceChange: { h24: 50 } },
      ]);
    }
    if (url.includes(':generateContent')) {
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ reply: TEXT, mood: 'wave' }) }] } }] });
    }
    throw new Error('unexpected request to ' + url);
  };
});

const ticketFor = (text = TEXT, { level = 1, mood = 'neutral' } = {}, now = Date.now()) => makeVoiceTicket(SECRET, text, { level, mood }, now);
const read = async (res) => {
  const type = res.headers.get('content-type') || '';
  const audio = type.startsWith('audio/');
  return { status: res.status, type, headers: res.headers, audio: audio ? Buffer.from(await res.arrayBuffer()) : null, data: audio ? null : await res.json() };
};
const voice = async (body, { ip = IP, type = 'application/json', raw } = {}) => read(await POST(new Request('https://site.test/api/voice', {
  method: 'POST', headers: { 'content-type': type, 'x-real-ip': ip }, body: raw ?? JSON.stringify(body),
})));
const get = async (search) => read(await GET(new Request(`https://site.test/api/voice${search}`, { headers: { 'x-real-ip': IP } })));
const line = (key) => get(`?line=${key}&v=${LINE_VERSION}`);           // a fixed line's one and only address
const hello = () => line('hello');
const styleOf = (call) => call.body.input[0].content[0].annotations[0].style;
const called = (part) => calls.filter((c) => c.url.includes(part));

test('voice tickets: only this exact reply, only for 15 minutes; they carry the level and the mood, not the IP', () => {
  const now = Date.now();
  const t = makeVoiceTicket(SECRET, TEXT, { level: 2, mood: 'love' }, now);
  const ok = checkVoiceTicket(SECRET, t, TEXT, now);
  assert.match(ok?.id || '', /^[\w-]{24}$/);
  assert.deepEqual([ok.level, ok.mood], [2, 'love']);
  assert.equal(checkVoiceTicket(SECRET, t, TEXT + '!', now), null, 'another text');
  assert.equal(checkVoiceTicket(SECRET, t, TEXT, now + 16 * 60 * 1000), null, 'too old');
  assert.equal(checkVoiceTicket('another-secret-that-is-long-enough-00000', t, TEXT, now), null, 'not ours');
  const [payload, sig] = t.split('.');
  const forged = Buffer.from(JSON.stringify({ v: 2, h: 'x', l: 3, m: 'love', exp: now + 1e9 })).toString('base64url');
  assert.equal(checkVoiceTicket(SECRET, `${forged}.${sig}`, TEXT, now), null, 'edited payload');
  assert.equal(checkVoiceTicket(SECRET, `${payload}.${sig}.x`, TEXT, now), null);
  for (const bad of [undefined, null, 42, '', 'x', 'a.b', 'y'.repeat(500)]) assert.equal(checkVoiceTicket(SECRET, bad, TEXT, now), null);
  const odd = checkVoiceTicket(SECRET, makeVoiceTicket(SECRET, TEXT, { level: 9, mood: 'love' }, now), TEXT, now);
  assert.equal(odd.level, 1, 'an unknown level counts as a Stranger');
});

test('every chat reply comes with a voice ticket for that reply, with its mood and the visitor\'s level', async () => {
  const res = await CHAT(new Request('https://site.test/api/chat', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': IP },
    body: JSON.stringify({ message: 'hi agi1', adult: true, turnstileToken: 'ok-token' }),
  }));
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.reply, TEXT);
  const t = checkVoiceTicket(SECRET, data.voice, data.reply);
  assert.deepEqual([t.level, t.mood], [1, 'wave'], 'a Stranger; the mood Gemini gave the reply');
  // the same visitor on another address a moment later (a phone switching networks): her voice still comes
  const r = await voice({ text: data.reply, ticket: data.voice }, { ip: '9.9.9.9' });
  assert.equal(r.status, 200);
  assert.equal(styleOf(called(TTS).at(-1)), styleFor('wave'), 'in the reply\'s mood');
});

test('refuses to run until the settings are there (Turnstile isn\'t needed)', async () => {
  delete process.env.GEMINI_API_KEY;
  const r = await voice({ text: TEXT, ticket: ticketFor() });
  assert.equal(r.status, 503);
  assert.equal(r.data.error, 'not_configured');
  process.env.GEMINI_API_KEY = 'fake-gemini-key';
  process.env.PASS_SECRET = 'short';
  assert.equal((await voice({ text: TEXT, ticket: ticketFor() })).data.error, 'not_configured');
  assert.equal(calls.length, 0);
  process.env.PASS_SECRET = SECRET;
  delete process.env.TURNSTILE_SECRET_KEY;
  assert.equal((await voice({ text: TEXT, ticket: ticketFor() })).status, 200);
});

test('bad requests stop before the database or Gemini', async () => {
  const ok = { text: TEXT, ticket: ticketFor() };
  assert.equal((await voice(ok, { type: 'text/plain' })).status, 415);
  assert.equal((await voice(null, { raw: '{nope' })).status, 400);
  assert.equal((await voice({ ...ok, text: '   ' })).status, 400);
  assert.equal((await voice({ ...ok, text: 'x'.repeat(601) })).status, 400);
  assert.equal((await voice(null, { raw: JSON.stringify({ ...ok, pad: 'y'.repeat(5000) }) })).status, 413);
  assert.equal((await voice({ ...ok, text: 'something agi1 never said' })).data.error, 'bad_ticket');
  assert.equal((await voice({ text: TEXT })).data.error, 'bad_ticket');
  assert.equal((await voice({ ...ok, ticket: ticketFor(TEXT, {}, Date.now() - 20 * 60 * 1000) })).data.error, 'bad_ticket', 'an old one');
  const emojis = '💜🙈';
  assert.equal((await voice({ text: emojis, ticket: ticketFor(emojis) })).data.error, 'nothing_to_say');
  assert.equal(calls.length, 0);
});

test('a good request is counted first, then streamed: Despina in her calm style (a neutral reply), raw PCM piece by piece', async () => {
  const ticket = ticketFor();
  const r = await voice({ text: TEXT, ticket });
  assert.equal(r.status, 200);
  assert.equal(r.type, 'audio/l16;rate=24000');
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.deepEqual(r.audio, Buffer.concat([piece(0), piece(1), piece(2)]), 'every piece, in order, even when events arrive cut up');
  assert.deepEqual(calls.map((c) => (c.url === TTS ? 'gemini' : c.url.split('/').pop())), ['voice_take', 'gemini'], 'limits first');
  const take = called('voice_take')[0];
  assert.equal(take.headers.apikey, 'sb_secret_fake_key_123');
  assert.equal(take.body.p_who, visitorCodeForDay(SECRET, IP, new Date().toISOString().slice(0, 10)));
  assert.ok(!JSON.stringify(take.body).includes(IP), 'never the IP');
  assert.equal(take.body.p_ticket, checkVoiceTicket(SECRET, ticket, TEXT).id);
  assert.deepEqual([take.body.p_units, take.body.p_person_daily, take.body.p_global_daily, take.body.p_ticket_max], [1, 10, 5000, 2],
    'one request; a Stranger may ask 10 times a day (5 messages, each voice ticket twice); the site 5,000 (the owner\'s choice, 2026-09-30)');
  const g = called(TTS)[0];
  assert.equal(g.headers['x-goog-api-key'], 'fake-gemini-key');
  assert.equal(g.body.model, 'gemini-3.8-flash-lite-tts');
  assert.equal(g.body.stream, true);
  assert.deepEqual(g.body.generation_config.speech_config, [{ voice: 'Despina' }]);
  assert.deepEqual(g.body.response_format, { type: 'audio' });
  assert.equal(g.body.store, false);
  const part = g.body.input[0].content[0];
  assert.equal(part.text, 'hi cutie AGI says hello', 'no emojis, no $');
  assert.deepEqual(part.annotations, [{ type: 'speech_metadata', style: VOICE_STYLE }]);
  assert.match(VOICE_STYLE, /calm, smooth/i);
});

test('her voice follows each reply\'s mood, and her daily voice follows the visitor\'s messages a day', async () => {
  for (const [mood, level, share] of [['love', 3, 300], ['shy', 2, 30], ['happy', 1, 10], ['wave', 2, 30], ['neutral', 3, 300], ['celebrate', 1, 10], ['bogus', 1, 10]]) {
    const r = await voice({ text: TEXT, ticket: ticketFor(TEXT, { mood, level }) });
    assert.equal(r.status, 200, mood);
    const expected = ['happy', 'love', 'shy', 'wave', 'neutral'].includes(mood) ? styleFor(mood) : VOICE_STYLE;
    assert.equal(styleOf(called(TTS).at(-1)), expected, `${mood}: a reply's own moods only`);
    assert.equal(called('voice_take').at(-1).body.p_person_daily, share, `level ${level}`);
  }
  // every reply she may write (5 / 15 / 150 a day) can also be said, even with a retry (each ticket twice)
  assert.deepEqual([1, 2, 3].map(voicePerDay), [10, 30, 300]);
  assert.equal(MOOD_STYLES.neutral, VOICE_STYLE, 'a neutral reply sounds exactly like the style the owner approved');
  for (const [mood, style] of Object.entries(MOOD_STYLES)) {
    assert.match(style, /smooth|warm|soft|gentle/i, `${mood}: still her`);
    assert.ok(style.length <= 200, `${mood}: short`);
  }
  assert.equal(new Set(Object.values(MOOD_STYLES)).size, Object.keys(MOOD_STYLES).length, 'each mood sounds different');
});

test('a moment\'s hiccup at Google gets one more try; a daily limit, used-up credits or a wrong model don\'t', async () => {
  process.env.GEMINI_TTS_MODELS = 'gemini-3.8-flash-lite-tts';          // (one model: her backup model is tested below)
  const ask = () => voice({ text: TEXT, ticket: ticketFor() });
  let n = 0;
  const tts = () => { const k = called(TTS).length - n; n = called(TTS).length; return k; };
  fake.fail = [{ status: 429, retry: '0.2s' }];                           // a per-minute limit that frees up in 0.2 s
  assert.deepEqual([(await ask()).status, tts()], [200, 2], 'tried again after the wait, and she speaks');
  fake.fail = [{ status: 503 }];                                          // Google overloaded for a moment
  assert.deepEqual([(await ask()).status, tts()], [200, 2]);
  fake.fail = [{ status: 429, retry: '37s' }];                            // busy for longer than a reply can wait
  assert.deepEqual([(await ask()).data, tts()], [{ error: 'ai_error', why: 'busy' }, 1]);
  resetForTests();                                                        // (a fresh server copy: it would back off now, see below)
  fake.fail = [{ status: 429, perDay: true, retry: '0.1s' }];             // the model's daily limit: until tomorrow
  assert.deepEqual([(await ask()).data, tts()], [{ error: 'ai_error', why: 'daily_limit' }, 1]);
  resetForTests();
  fake.fail = [{ status: 429, credits: true }];                           // prepaid credits used up
  assert.deepEqual([(await ask()).data, tts()], [{ error: 'ai_error', why: 'credits' }, 1]);
  resetForTests();
  fake.fail = [{ status: 404 }];
  assert.deepEqual([(await ask()).data, tts()], [{ error: 'ai_error', why: 'model' }, 1]);
  resetForTests();                                                        // (an unknown model rests 30 minutes)
  fake.fail = [{ status: 503 }, { status: 503 }];                         // still down after the second try
  assert.deepEqual([(await ask()).data, tts()], [{ error: 'ai_error', why: 'google' }, 2]);
});

test('streaming details: WAV pieces lose their header; a plain JSON answer still works; VOICE_STREAM=off asks for one WAV', async () => {
  fake.stream = 'wavpieces';
  assert.deepEqual((await voice({ text: TEXT, ticket: ticketFor() })).audio, Buffer.concat([piece(0), piece(1)]));
  fake.stream = 'json';
  const j = await voice({ text: TEXT, ticket: ticketFor() });
  assert.deepEqual([j.type, j.audio.length], ['audio/l16;rate=24000', pcm.length]);
  process.env.VOICE_STREAM = 'off';
  const whole = await voice({ text: TEXT, ticket: ticketFor() });
  assert.equal(whole.type, 'audio/wav');
  assert.equal(whole.audio.toString('ascii', 0, 4), 'RIFF');
  assert.equal(called(TTS).at(-1).body.stream, undefined);
});

test('an error before any audio → "ai_error"; an error halfway → she stops early with what came', async () => {
  process.env.GEMINI_TTS_MODELS = 'gemini-3.8-flash-lite-tts';
  fake.stream = 'error';                                                  // (an error event that says 429, no wait given)
  assert.deepEqual((await voice({ text: TEXT, ticket: ticketFor() })).data, { error: 'ai_error', why: 'busy' });
  assert.equal(called(TTS).length, 2, 'one more try a second later');
  resetForTests();                                                        // (a fresh server copy: this one backs off for 10 s)
  fake.stream = 'mid';
  const r = await voice({ text: TEXT, ticket: ticketFor() });
  assert.equal(r.status, 200);
  assert.deepEqual(r.audio, piece(0));
});

test('when the visitor stops her, reading from Google stops too', async () => {
  fake.stream = 'hang';
  const res = await POST(new Request('https://site.test/api/voice', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-real-ip': IP }, body: JSON.stringify({ text: TEXT, ticket: ticketFor() }),
  }));
  const reader = res.body.getReader();
  const first = await reader.read();
  assert.deepEqual(Buffer.from(first.value), piece(0));
  await reader.cancel();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(fake.cancelled, 1);
});

test('a streamed answer without audio → one whole WAV instead, and whole clips from then on (logged)', async () => {
  const logged = [];
  const original = console.error;
  console.error = (...a) => logged.push(a.join(' '));
  try {
    fake.stream = 'none';
    const r = await voice({ text: TEXT, ticket: ticketFor() });
    assert.equal(r.type, 'audio/wav');
    assert.deepEqual(called(TTS).map((c) => Boolean(c.body.stream)), [true, true, false], 'streaming tried twice, then a whole clip');
    const again = await voice({ text: TEXT, ticket: ticketFor() });
    assert.equal(again.type, 'audio/wav');
    assert.deepEqual(called(TTS).map((c) => Boolean(c.body.stream)), [true, true, false, false], 'no more streaming tries on this server copy');
  } finally {
    console.error = original;
  }
  assert.match(logged.join('\n'), /streaming gave no audio/);
});

test('settings: another voice, speech model or daily requests (the old VOICE_DAILY_CAP, in characters, is ignored)', async () => {
  Object.assign(process.env, { AGI1_VOICE: 'Sulafat', GEMINI_TTS_MODEL: 'gemini-3.8-flash-tts', VOICE_DAILY_REQUESTS: '400', VOICE_DAILY_CAP: '2000' });
  assert.equal((await voice({ text: TEXT, ticket: ticketFor() })).status, 200);
  assert.equal(called('voice_take')[0].body.p_global_daily, 400);
  for (const bad of ['0', '-5', 'lots', '']) assert.equal(getConfig({ VOICE_DAILY_REQUESTS: bad }).voiceDailyRequests, 5000, `"${bad}" → the default`);
  assert.equal(called(TTS)[0].body.model, 'gemini-3.8-flash-tts');
  assert.deepEqual(called(TTS)[0].body.generation_config.speech_config, [{ voice: 'Sulafat' }]);
});

test('a long reply still counts once (one request to Google) and is read up to 300 characters, ending at a sentence', async () => {
  const long = `${'this is a sentence she says. '.repeat(14)}and the end`;          // about 420 characters
  assert.equal((await voice({ text: long, ticket: ticketFor(long) })).status, 200);
  assert.equal(called('voice_take')[0].body.p_units, 1);
  const said = called(TTS)[0].body.input[0].content[0].text;
  assert.ok(said.length <= MAX_SPOKEN && said.endsWith('.'), said);
});

test('used tickets and daily limits stop before Gemini is asked', async () => {
  for (const [answer, status] of [['used', 409], ['person_cap', 429], ['global_cap', 503]]) {
    fake.take = answer;
    const r = await voice({ text: TEXT, ticket: ticketFor() });
    assert.deepEqual([r.status, r.data.error], [status, answer]);
  }
  fake.take = 'surprise';
  assert.deepEqual((await voice({ text: TEXT, ticket: ticketFor() })).data, { error: 'busy' });
  assert.equal(called(TTS).length, 0);
});

test('voice.sql not run yet → "not ready"; database down → no voice (fails closed)', async () => {
  fake.takeStatus = 404;
  fake.takeBody = { code: 'PGRST202', message: 'Could not find the function public.voice_take' };
  assert.deepEqual((await voice({ text: TEXT, ticket: ticketFor() })).data, { error: 'not_ready' });
  fake.takeStatus = 500;
  fake.takeBody = null;
  assert.deepEqual((await voice({ text: TEXT, ticket: ticketFor() })).data, { error: 'busy' });
  globalThis.fetch = async () => { throw new Error('network down'); };
  assert.deepEqual((await voice({ text: TEXT, ticket: ticketFor() })).data, { error: 'busy' });
  assert.equal(calls.filter((c) => c.url === TTS).length, 0);
});

test('Gemini trouble → "ai_error" with a one-word reason (the page stays silent, never robotic), and the key never reaches the log', async () => {
  const logged = [];
  const original = console.error;
  console.error = (...a) => logged.push(a.join(' '));
  try {
    fake.ttsStatus = 403;
    assert.deepEqual((await voice({ text: TEXT, ticket: ticketFor() })).data, { error: 'ai_error', why: 'key' });
    process.env.VOICE_STREAM = 'off';
    assert.deepEqual((await voice({ text: TEXT, ticket: ticketFor() })).data, { error: 'ai_error', why: 'key' });
    fake.ttsStatus = 200;
    fake.tts = 'none';
    assert.deepEqual((await voice({ text: TEXT, ticket: ticketFor() })).data, { error: 'ai_error', why: 'google' });
  } finally {
    console.error = original;
  }
  const log = logged.join('\n');
  assert.match(log, /\[voice\] gemini failed \(gemini-3\.8-flash-lite-tts, Despina\): gemini: HTTP 403 .* → key/);
  assert.ok(!log.includes('AIzaSyFAKE') && !log.includes('fake-gemini-key'), log);
});

test('whole clips: raw PCM from Gemini gets a proper WAV header', async () => {
  process.env.VOICE_STREAM = 'off';
  fake.tts = 'pcm';
  const r = await voice({ text: TEXT, ticket: ticketFor() });
  assert.equal(r.status, 200);
  assert.equal(r.audio.length, pcm.length + 44);
  assert.equal(r.audio.toString('ascii', 8, 12), 'WAVE');
  assert.equal(r.audio.readUInt32LE(24), 24000, 'sample rate');
  assert.equal(r.audio.readUInt16LE(22), 1, 'mono');
  assert.throws(() => toWav(Buffer.alloc(200), { mime_type: 'audio/mp3' }), /unexpected audio type/);
});

test('speed bump: more than 20 requests a minute from one visitor get "slow down" before anything else', async () => {
  const ip = '198.51.100.23';
  let last;
  for (let i = 0; i < 21; i++) last = await voice({ text: TEXT, ticket: ticketFor() }, { ip });
  assert.deepEqual(last.data, { error: 'slow_down' });
  assert.equal(called('voice_take').length, 20);
});

test('GET ?line=hello&v=…: her "hi, it\'s me" (a bright hello), made once and kept by the CDN; nothing else is accepted', async () => {
  for (const search of ['', '?line=bye&v=3', '?line=hello', '?line=hello&v=1', '?line=hello&v=2', `?line=hello&v=${LINE_VERSION}&x=1`, `?v=${LINE_VERSION}&line=hello`, '?line=hello&v=03']) {
    assert.deepEqual([(await get(search)).status, calls.length], [404, 0], search);
  }
  delete process.env.GEMINI_API_KEY;
  assert.equal((await hello()).status, 503);
  process.env.GEMINI_API_KEY = 'fake-gemini-key';
  fake.ttsStatus = 500;
  process.env.GEMINI_TTS_MODELS = 'gemini-3.8-flash-lite-tts';
  assert.deepEqual((await hello()).data, { error: 'ai_error', why: 'google' });
  assert.equal(called(TTS).length, 2, 'one more try');
  delete process.env.GEMINI_TTS_MODELS;
  assert.deepEqual((await hello()).data, { error: 'ai_error', why: 'google' });
  assert.deepEqual(called(TTS).slice(2).map((c) => c.body.model), ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts', 'gemini-3.8-flash-tts'],
    'with her backup model: a hiccup goes to it at once, and the last model left gets one more try');
  fake.ttsStatus = 200;
  const first = await hello();
  assert.equal(first.status, 200);
  assert.equal(first.type, 'audio/wav');
  assert.match(first.headers.get('cache-control'), /s-maxage=2592000/);
  assert.equal(called(TTS).at(-1).body.input[0].content[0].text, "hi, it's me");
  assert.equal(styleOf(called(TTS).at(-1)), styleFor('wave'));
  assert.equal(called(TTS).at(-1).body.stream, undefined, 'a whole clip (it is cached)');
  const before = called(TTS).length;
  const again = await hello();
  assert.equal(again.status, 200);
  assert.equal(called(TTS).length, before, 'made once per server copy');
  assert.equal(called('voice_take').length, 0, 'the greeting needs no ticket or count');
});

test('GET her out-of-messages lines (the offer: sweet; "come back tomorrow": sleepy), made once each and kept by the CDN', async () => {
  const { LIMIT_LINES, REST_LINES } = await import('../src/chat/limit-lines.js');
  for (const key of ['more-3', 'more', 'MORE-1', '__proto__', 'toString', 'sleep2']) assert.equal((await line(key)).status, 404, key);
  assert.equal((await get(`?line=more-1&v=${LINE_VERSION}&x=1`)).status, 404);
  assert.equal(calls.length, 0, 'unknown lines never reach Gemini');
  const all = [...Object.values(LIMIT_LINES).map((l) => [l, 'sweet']), ...Object.values(REST_LINES).map((l) => [l, 'sleepy'])];
  assert.deepEqual(all.map(([l]) => l.key), ['more-1', 'more-2', 'sleep', 'talked-out']);
  for (const [{ key, text }, mood] of all) {
    const first = await line(key);
    assert.equal(first.status, 200, key);
    assert.equal(first.type, 'audio/wav');
    assert.match(first.headers.get('cache-control'), /s-maxage=2592000/);
    assert.equal(called(TTS).at(-1).body.input[0].content[0].text, speakable(text), 'exactly the chat line, spoken');
    assert.equal(styleOf(called(TTS).at(-1)), styleFor(mood), `${key}: ${mood}`);
    assert.equal(LINE_MOODS[key], mood);
    const before = called(TTS).length;
    assert.equal((await line(key)).status, 200);
    assert.equal(called(TTS).length, before, 'made once per server copy');
  }
  assert.deepEqual(Object.keys(LINES).filter((k) => !k.startsWith('check-') && !k.startsWith('tap-')).sort(), ['hello', 'more-1', 'more-2', 'sleep', 'talked-out']);
  assert.equal(called('voice_take').length, 0, 'fixed lines need no ticket or count');
});

test('GET her ClankChecker lines (2026-09-26): one address each, in each line\'s own style, made once and kept', async () => {
  const { CHECK_LINES } = await import('../src/checker/lines.js');
  assert.deepEqual(Object.keys(LINES).filter((k) => k.startsWith('check-')).sort(), Object.keys(CHECK_LINES).sort());
  for (const key of ['check-high-3', 'check-high', 'check-low-0', 'CHECK-AGI', 'check-']) assert.equal((await line(key)).status, 404, key);
  assert.equal((await get(`?line=check-high-1&v=${LINE_VERSION}&x=1`)).status, 404);
  assert.equal(calls.length, 0, 'unknown lines never reach Gemini');
  for (const { key, spoken, mood } of Object.values(CHECK_LINES)) {
    const first = await line(key);
    assert.equal(first.status, 200, key);
    assert.equal(first.type, 'audio/wav');
    assert.match(first.headers.get('cache-control'), /s-maxage=2592000/);
    assert.equal(called(TTS).at(-1).body.input[0].content[0].text, spoken, `${key}: exactly her words, emojis as full stops`);
    assert.equal(styleOf(called(TTS).at(-1)), styleFor(mood), `${key}: ${mood}`);
    const before = called(TTS).length;
    assert.equal((await line(key)).status, 200);
    assert.equal(called(TTS).length, before, 'made once per server copy');
  }
  assert.equal(called('voice_take').length, 0, 'no ticket, no count: nobody\'s voice allowance');
});

test('GET her lines when she\'s tapped (2026-10-01): one address each, in each line\'s own style, made once and kept', async () => {
  const { TAP_LINES } = await import('../src/stage/tap-lines.js');
  assert.deepEqual(Object.keys(LINES).filter((k) => k.startsWith('tap-')).sort(), Object.keys(TAP_LINES).sort());
  assert.equal(Object.keys(TAP_LINES).length, 9, 'five hellos, four for a lot of taps');
  for (const key of ['tap-0', 'tap-6', 'tap-many-5', 'tap-many', 'TAP-1', 'tap-']) assert.equal((await line(key)).status, 404, key);
  assert.equal(calls.length, 0, 'unknown lines never reach Gemini');
  for (const { key, spoken, mood } of Object.values(TAP_LINES)) {
    const first = await line(key);
    assert.equal(first.status, 200, key);
    assert.equal(first.type, 'audio/wav');
    assert.match(first.headers.get('cache-control'), /s-maxage=2592000/);
    assert.equal(called(TTS).at(-1).body.input[0].content[0].text, spoken, `${key}: exactly her words, no emojis`);
    assert.equal(styleOf(called(TTS).at(-1)), styleFor(mood), `${key}: ${mood}`);
    const before = called(TTS).length;
    assert.equal((await line(key)).status, 200);
    assert.equal(called(TTS).length, before, 'made once per server copy');
  }
  assert.equal(called('voice_take').length, 0, 'no ticket, no count: nobody\'s voice allowance');
});

test('GET her market-cap lines (joyful): only for a step near $AGI\'s real market cap right now', async () => {
  const say = (step) => line(`mcap-${step}`);
  for (const bad of ['mcap-2000001', 'mcap-100000', 'mcap-02000000', 'mcap-2e6', 'MCAP-2000000', 'mcap-99999999999']) {
    assert.equal((await line(bad)).status, 404, bad);
  }
  assert.equal((await get(`?line=mcap-2000000&v=${LINE_VERSION}&x=1`)).status, 404);
  assert.equal((await get('?line=mcap-2000000')).status, 404, 'no version: not her address');
  assert.equal(calls.length, 0, 'addresses that aren\'t a line never reach DexScreener or Gemini');
  // the market cap is $2.03M: $2M is fine (and the step above, just in case the page's numbers are a little ahead), and
  // up to 3 steps below (the page's numbers can be a little behind)
  const first = await say(2_000_000);
  assert.equal(first.status, 200);
  assert.equal(first.type, 'audio/wav');
  assert.match(first.headers.get('cache-control'), /s-maxage=2592000/, 'kept by the CDN like her other fixed lines');
  assert.equal(called(TTS).at(-1).body.input[0].content[0].text, milestoneLine(2_000_000).spoken, 'exactly her chat line, spoken ("2 million")');
  assert.match(called(TTS).at(-1).body.input[0].content[0].text, /2 million market cap/);
  assert.equal(styleOf(called(TTS).at(-1)), styleFor('celebrate'), 'joyful');
  assert.equal(called('dexscreener').length, 1, 'checked once');
  const before = called(TTS).length;
  assert.equal((await say(2_000_000)).status, 200);
  assert.equal(called(TTS).length, before, 'made once per server copy');
  assert.equal(called('dexscreener').length, 1, 'a line already made needs no check');
  for (const step of [2_200_000, 1_800_000, 1_600_000]) assert.equal((await say(step)).status, 200, `${step}`);
  assert.equal(called('dexscreener').length, 1, 'the market numbers are kept a minute');
  for (const step of [2_400_000, 2_600_000, 1_400_000, 1_200_000, 400_000, 10_000_000_000]) {
    assert.deepEqual([(await say(step)).status, called(TTS).length], [404, before + 3], `${step}: too far from the real market cap, nothing made`);
  }
  assert.equal(called('voice_take').length, 0, 'fixed lines need no ticket or count');
});

test('market-cap lines: DexScreener down → "unverified" (nothing made); the numbers are fresh again after a minute', async () => {
  fake.dex = 503;
  const down = await line('mcap-2000000');
  assert.deepEqual([down.status, down.data.error, called(TTS).length], [503, 'unverified', 0]);
  fake.dex = 200;
  forgetMarket();
  const t0 = Date.now();
  assert.deepEqual(await agiMarket(t0), { mcap: 2_030_000, h24: -3.2 }, 'the biggest pool\'s numbers');
  fake.mcap = 3_050_000;
  assert.equal((await agiMarket(t0 + 30_000)).mcap, 2_030_000, 'kept a minute');
  assert.equal((await agiMarket(t0 + 61_000)).mcap, 3_050_000, 'then asked again');
});

test('GET her sad lines for a -20% day (soft and sad; no numbers in them, so no check needed)', async () => {
  for (const bad of ['dump-3', 'dump-9', 'dump-', 'dump-01', 'dump--1']) assert.equal((await line(bad)).status, 404, bad);
  for (const n of [0, 1, 2]) {
    const res = await line(`dump-${n}`);
    assert.equal(res.status, 200);
    assert.equal(called(TTS).at(-1).body.input[0].content[0].text, dumpLine(n).spoken);
    assert.equal(styleOf(called(TTS).at(-1)), styleFor('sad'));
  }
  assert.equal(called('dexscreener').length, 0);
  assert.equal(called(TTS).length, 3);
});

test('a server copy keeps at most 40 lines in memory (market lines go first; the fixed ones stay while there are any)', async () => {
  fake.mcap = 1_000_000_000;
  assert.equal((await hello()).status, 200);
  for (let i = 0; i < 41; i++) {
    fake.mcap = 1_000_000_000 + i * 200_000;
    forgetMarket();
    assert.equal((await line(`mcap-${fake.mcap}`)).status, 200);
  }
  const made = called(TTS).length;
  assert.equal((await hello()).status, 200);
  assert.equal(called(TTS).length, made, 'her hello is still kept');
  fake.mcap = 1_000_000_000;
  forgetMarket();
  assert.equal((await line('mcap-1000000000')).status, 200);
  assert.equal(called(TTS).length, made + 1, 'the oldest market line was let go, so it is made again');
});

test('her fixed lines are kept once made: a new server copy (or a new deployment) plays them without asking Google', async () => {
  const first = await line('more-1');
  assert.deepEqual([first.status, first.headers.get('x-agi1-line')], [200, 'google']);
  const id = lineId(getConfig(), 'more-1', LINES['more-1'], styleFor('sweet'));
  assert.match(id, /^more-1-[0-9a-f]{16}$/, 'the line\'s name + a fingerprint');
  assert.ok(kept.has(id), 'kept in the database');
  assert.equal((await line('more-1')).headers.get('x-agi1-line'), 'memory');
  resetForTests();                                                        // a new server copy, or a new deployment
  const n = called(TTS).length;
  const again = await line('more-1');
  assert.deepEqual([again.status, again.headers.get('x-agi1-line'), called(TTS).length], [200, 'kept', n], 'Google not asked');
  assert.deepEqual(again.audio, first.audio, 'the very same recording');
  assert.match(again.headers.get('cache-control'), /s-maxage=2592000/);
  // a long recording (about 15 seconds) is saved in parts at once, and read back whole
  fake.tts = 'big';
  assert.equal((await line('talked-out')).status, 200);
  const puts = called('voice_line_put').filter((c) => c.body.p_id.startsWith('talked-out-'));
  assert.equal(puts.length, Math.ceil(bigWav.toString('base64').length / 200_000));
  assert.ok(puts.length >= 4 && puts.every((c) => c.body.p_take === puts[0].body.p_take && c.body.p_parts === puts.length && c.body.p_data.length <= 200_000));
  assert.deepEqual(puts.map((c) => c.body.p_part).sort(), [...puts.keys()]);
  assert.equal(puts[0].headers.apikey, 'sb_secret_fake_key_123');
  resetForTests();
  fake.tts = 'wav';
  const whole = await line('talked-out');
  assert.deepEqual([whole.headers.get('x-agi1-line'), whole.audio.equals(bigWav)], ['kept', true]);
  // the sad market lines are kept too; the market-cap lines aren't (they come and go with the market)
  assert.equal((await line('dump-1')).status, 200);
  assert.ok([...kept.keys()].some((k) => k.startsWith('dump-1-')));
  assert.equal((await line('mcap-2000000')).headers.get('x-agi1-line'), 'google');
  assert.ok(![...kept.keys()].some((k) => k.startsWith('mcap-')));
  assert.equal(called('voice_take').length, 0, 'none of this is counted');
});

test('new words, style, voice or model → a new recording (an old one is never played by mistake)', async () => {
  const cfg = getConfig();
  const ids = [lineId(cfg, 'hello', 'hi', 's'), lineId(cfg, 'hello', 'hi!', 's'), lineId(cfg, 'hello', 'hi', 's2'),
    lineId({ ...cfg, voiceName: 'Sulafat' }, 'hello', 'hi', 's'), lineId({ ...cfg, voiceModel: 'gemini-3.8-flash-tts' }, 'hello', 'hi', 's')];
  assert.equal(new Set(ids).size, 5);
  assert.equal(lineId(cfg, 'hello', 'hi', 's'), ids[0], 'the same line → the same recording');
  assert.equal((await hello()).headers.get('x-agi1-line'), 'google');
  process.env.AGI1_VOICE = 'Sulafat';
  resetForTests();
  assert.equal((await hello()).headers.get('x-agi1-line'), 'google', 'another voice: made again, not the kept one');
  assert.deepEqual(called(TTS).at(-1).body.generation_config.speech_config, [{ voice: 'Sulafat' }]);
  assert.equal([...kept.keys()].filter((k) => k.startsWith('hello-')).length, 2);
});

test('voice-lines.sql not run yet, or the database down: her lines still come from Google, and the log says what to do', async () => {
  const logged = [];
  const original = console.error;
  console.error = (...a) => logged.push(a.join(' '));
  try {
    fake.store = 'missing';
    assert.deepEqual([(await hello()).status, called(TTS).length], [200, 1]);
    assert.equal((await line('sleep')).headers.get('x-agi1-line'), 'google');
    assert.equal(called('voice_line_').length, 1, 'asked once, then not again for 10 minutes');
    fake.store = 'down';
    resetForTests();
    const r = await line('more-2');
    assert.deepEqual([r.status, r.headers.get('x-agi1-line')], [200, 'google']);
  } finally {
    console.error = original;
  }
  const log = logged.join('\n');
  assert.match(log, /\[voice\] her lines aren't kept yet \(reading\): run supabase\/voice-lines\.sql/);
  assert.match(log, /\[voice\] her kept lines are unavailable right now \(reading\)/);
  assert.ok(!log.includes('sb_secret_fake_key_123'), 'never the key');
});

test('Google says "not now": this server copy stops asking for a while and answers at once, without counting it', async () => {
  process.env.GEMINI_TTS_MODELS = 'gemini-3.8-flash-lite-tts';          // (one model here; both below)
  let t = Date.parse('2026-09-25T16:00:00Z');                             // 9 AM Pacific
  resetForTests({ now: () => t });
  const ask = () => voice({ text: TEXT, ticket: ticketFor() });
  const counted = () => [called('voice_take').length, called(TTS).length];
  const logged = [];
  const original = console.error;
  console.error = (...a) => logged.push(a.join(' '));
  try {
    // its per-minute limit, "retry in 37 s"
    fake.fail = [{ status: 429, retry: '37s' }];
    assert.deepEqual((await ask()).data, { error: 'ai_error', why: 'busy' });
    const before = counted();
    t += 30_000;
    assert.deepEqual((await ask()).data, { error: 'ai_error', why: 'busy' }, 'still within the 37 s');
    assert.deepEqual(counted(), before, 'not counted, and Google not asked');
    t += 8_000;
    assert.equal((await ask()).status, 200, 'after 37 s it asks again, and she speaks');
    // its daily limit: at most 30 minutes at a time
    fake.fail = [{ status: 429, perDay: true, retry: '0.1s' }];
    assert.equal((await ask()).data.why, 'daily_limit');
    t += 29 * 60_000;
    assert.equal((await ask()).data.why, 'daily_limit');
    t += 2 * 60_000;
    assert.equal((await ask()).status, 200, 'after 30 minutes it asks again (Google may have given more)');
    // …and never past midnight Pacific, when Google's day starts again
    t = Date.parse('2026-09-26T06:50:00Z');                               // 11:50 PM Pacific
    fake.fail = [{ status: 429, perDay: true }];
    assert.equal((await ask()).data.why, 'daily_limit');
    t = Date.parse('2026-09-26T07:00:20Z');
    assert.equal((await ask()).data.why, 'daily_limit');
    t = Date.parse('2026-09-26T07:00:31Z');
    assert.equal((await ask()).status, 200, 'a new day at Google');
    // used-up credits: 10 minutes
    fake.fail = [{ status: 429, credits: true }];
    assert.equal((await ask()).data.why, 'credits');
    t += 9 * 60_000;
    assert.equal((await ask()).data.why, 'credits');
    t += 2 * 60_000;
    assert.equal((await ask()).status, 200);
    // a hiccup or a refused request: no pause at all
    fake.fail = [{ status: 503 }, { status: 503 }];
    assert.equal((await ask()).data.why, 'google');
    assert.equal((await ask()).status, 200, 'the next reply tries Google again');
  } finally {
    console.error = original;
  }
  const failed = logged.filter((l) => l.includes('gemini failed'));
  assert.equal(failed.length, 5, 'one log line per refusal from Google, none while resting');
  assert.match(failed[0], /→ busy \(this server copy won't ask this model again for 37 s\)$/);
  assert.match(failed[1], /→ daily_limit \(this server copy won't ask this model again for 30 min\)$/);
  assert.match(failed[2], /→ daily_limit \(this server copy won't ask this model again for 11 min\)$/);
  assert.match(failed[3], /→ credits \(this server copy won't ask Google again for 10 min\)$/);
  assert.match(failed[4], /→ google$/);
  assert.deepEqual([msToGoogleReset(Date.parse('2026-09-25T16:23:15Z')), msToGoogleReset(Date.parse('2026-12-01T07:30:00Z'))],
    [(14 * 3600 + 36 * 60 + 45) * 1000, 30 * 60_000], 'midnight Pacific: 07:00 UTC in summer, 08:00 in winter');
});

test('while Google\'s daily limit is used up, her lines already made still play; only a line never made has to wait', async () => {
  process.env.GEMINI_TTS_MODELS = 'gemini-3.8-flash-lite-tts';
  assert.equal((await hello()).status, 200);                              // made and kept
  fake.fail = [{ status: 429, perDay: true }];
  assert.equal((await voice({ text: TEXT, ticket: ticketFor() })).data.why, 'daily_limit');
  const n = called(TTS).length;
  assert.deepEqual((await line('more-1')).data, { error: 'ai_error', why: 'daily_limit' }, 'a new line: not now');
  assert.deepEqual([(await hello()).headers.get('x-agi1-line'), called(TTS).length], ['memory', n]);
  resetForTests();                                                        // a new deployment on a day Google says no
  fake.fail = [{ status: 429, perDay: true }];
  const h = await hello();
  assert.deepEqual([h.status, h.headers.get('x-agi1-line'), called(TTS).length, fake.fail.length], [200, 'kept', n, 1], 'kept: Google not needed');
});

test('her backup model: when Flash-Lite says "wait" or "used up", 3.8 Flash speaks that reply at once (counted once)', async () => {
  const LITE = 'gemini-3.8-flash-lite-tts', FLASH = 'gemini-3.8-flash-tts';
  let t = Date.parse('2026-09-25T16:00:00Z');                             // 9 AM Pacific
  resetForTests({ now: () => t });
  assert.deepEqual(getConfig().voiceModels, [LITE, FLASH], 'Flash-Lite first, 3.8 Flash as the backup');
  const ask = () => voice({ text: TEXT, ticket: ticketFor(TEXT, { mood: 'love' }) });
  let n = 0;
  const asked = () => { const m = called(TTS).slice(n).map((c) => c.body.model); n = called(TTS).length; return m; };
  const logged = [];
  const original = console.error;
  console.error = (...a) => logged.push(a.join(' '));
  try {
    // Flash-Lite's per-minute limit ("retry in 37 s"): the backup speaks at once, and Flash-Lite rests
    fake.byModel[LITE] = [{ status: 429, retry: '37s' }];
    const r = await ask();
    assert.deepEqual([r.status, r.headers.get('x-agi1-model'), asked()], [200, FLASH, [LITE, FLASH]], 'no waiting');
    assert.deepEqual(r.audio, Buffer.concat([piece(0), piece(1), piece(2)]), 'streamed like always');
    assert.equal(called('voice_take').length, 1, 'still one spoken reply: counted once');
    assert.deepEqual(called(TTS).slice(-2).map(styleOf), [styleFor('love'), styleFor('love')], 'her mood on both');
    t += 30_000;
    assert.deepEqual([(await ask()).headers.get('x-agi1-model'), asked()], [FLASH, [FLASH]], 'Flash-Lite rests its 37 s');
    t += 8_000;
    assert.deepEqual([(await ask()).headers.get('x-agi1-model'), asked()], [LITE, [LITE]], 'then Flash-Lite again');
    // a hiccup (5xx): straight to the backup, no waiting on Flash-Lite
    fake.byModel[LITE] = [{ status: 503 }];
    assert.deepEqual([(await ask()).status, asked()], [200, [LITE, FLASH]]);
    // Flash-Lite's daily limit, then the backup's too: both rest, and the next reply is answered at once, not counted
    fake.byModel[LITE] = [{ status: 429, perDay: true }];
    assert.deepEqual([(await ask()).headers.get('x-agi1-model'), asked()], [FLASH, [LITE, FLASH]]);
    fake.byModel[FLASH] = [{ status: 429, perDay: true }];
    assert.deepEqual([(await ask()).data, asked()], [{ error: 'ai_error', why: 'daily_limit' }, [FLASH]]);
    const takes = called('voice_take').length;
    assert.deepEqual([(await ask()).data, asked(), called('voice_take').length], [{ error: 'ai_error', why: 'daily_limit' }, [], takes]);
    // a passing problem wins over a daily limit (the page tries again with the next reply)
    resetForTests({ now: () => t });
    fake.byModel[LITE] = [{ status: 429, perDay: true }];
    fake.byModel[FLASH] = [{ status: 429, retry: '20s' }];
    assert.deepEqual([(await ask()).data, asked()], [{ error: 'ai_error', why: 'busy' }, [LITE, FLASH]]);
    // used-up credits or a refused key: the whole project, so the backup isn't asked
    resetForTests({ now: () => t });
    fake.byModel[LITE] = [{ status: 429, credits: true }];
    assert.deepEqual([(await ask()).data, asked()], [{ error: 'ai_error', why: 'credits' }, [LITE]]);
    assert.deepEqual([(await ask()).data, asked()], [{ error: 'ai_error', why: 'credits' }, []], 'every model rests 10 minutes');
    resetForTests({ now: () => t });
    fake.byModel[LITE] = [{ status: 403 }];
    assert.deepEqual([(await ask()).data, asked()], [{ error: 'ai_error', why: 'key' }, [LITE]]);
    // an unknown model (a wrong name in GEMINI_TTS_MODELS): the backup speaks, and that model rests 30 minutes
    resetForTests({ now: () => t });
    fake.byModel[LITE] = [{ status: 404 }];
    assert.deepEqual([(await ask()).status, asked()], [200, [LITE, FLASH]]);
    t += 29 * 60_000;
    assert.deepEqual([(await ask()).status, asked()], [200, [FLASH]], 'still resting after 29 minutes');
    t += 2 * 60_000;
    assert.deepEqual([(await ask()).status, asked()], [200, [LITE]], 'tried again after 30');
  } finally {
    console.error = original;
  }
  const log = logged.filter((l) => l.includes('gemini failed'));
  assert.match(log[0], /\(gemini-3\.8-flash-lite-tts, Despina\): .* → busy \(this server copy won't ask this model again for 37 s\); gemini-3\.8-flash-tts takes it$/);
  assert.ok(log.some((l) => /→ model \(this server copy won't ask this model again for 30 min\); gemini-3\.8-flash-tts takes it$/.test(l)));
  assert.ok(log.some((l) => /\(gemini-3\.8-flash-lite-tts, Despina\): .* → key$/.test(l)), 'no "takes it" for a key problem');
});

test('her fixed lines with the backup model: made by 3.8 Flash when Flash-Lite can\'t, kept, and played by a new server copy', async () => {
  const LITE = 'gemini-3.8-flash-lite-tts', FLASH = 'gemini-3.8-flash-tts';
  const cfg = getConfig();
  fake.byModel[LITE] = [{ status: 429, perDay: true }];
  const first = await line('sleep');
  assert.deepEqual([first.status, first.headers.get('x-agi1-line'), first.headers.get('x-agi1-model')], [200, 'google', FLASH]);
  const flashId = lineId({ ...cfg, voiceModel: FLASH }, 'sleep', LINES.sleep, styleFor('sleepy'));
  assert.ok(kept.has(flashId), 'kept under the model that made it');
  resetForTests();                                                        // a new deployment, Google still refusing Flash-Lite
  fake.byModel[LITE] = [{ status: 429, perDay: true }];
  const n = called(TTS).length;
  const again = await line('sleep');
  assert.deepEqual([again.headers.get('x-agi1-line'), again.headers.get('x-agi1-model'), called(TTS).length], ['kept', FLASH, n]);
  // a recording by Flash-Lite, when there is one, comes first
  resetForTests();
  fake.byModel[LITE] = [];
  assert.equal((await line('hello')).headers.get('x-agi1-model'), LITE);
  resetForTests();
  const looked = called('voice_line_get').length;
  const h = await line('hello');
  assert.deepEqual([h.headers.get('x-agi1-line'), h.headers.get('x-agi1-model')], ['kept', LITE]);
  assert.equal(called('voice_line_get').length - looked, 1, 'found at the first place it looked');
  // every model resting and the line never made: the same one word, nothing asked
  resetForTests();
  fake.byModel[LITE] = [{ status: 429, perDay: true }];
  fake.byModel[FLASH] = [{ status: 429, perDay: true }];
  assert.deepEqual((await line('talked-out')).data, { error: 'ai_error', why: 'daily_limit' });
  const m = called(TTS).length;
  assert.deepEqual([(await line('more-2')).data, called(TTS).length], [{ error: 'ai_error', why: 'daily_limit' }, m]);
});

test('her speech models are a setting: GEMINI_TTS_MODELS (in order), else GEMINI_TTS_MODEL first, then 3.8 Flash', () => {
  const LITE = 'gemini-3.8-flash-lite-tts', FLASH = 'gemini-3.8-flash-tts';
  assert.deepEqual(getConfig({}).voiceModels, [LITE, FLASH]);
  assert.deepEqual(getConfig({ GEMINI_TTS_MODELS: LITE }).voiceModels, [LITE], 'only one: no backup');
  assert.deepEqual(getConfig({ GEMINI_TTS_MODELS: ` ${FLASH}, ${LITE} ` }).voiceModels, [FLASH, LITE], 'any order');
  assert.deepEqual(getConfig({ GEMINI_TTS_MODELS: `${LITE},bad name!,${LITE}` }).voiceModels, [LITE], 'odd names and twins dropped');
  assert.deepEqual(getConfig({ GEMINI_TTS_MODEL: FLASH }).voiceModels, [FLASH], 'the backup alone');
  assert.deepEqual(getConfig({ GEMINI_TTS_MODELS: ' , ' }).voiceModels, [LITE, FLASH]);
  assert.equal(getConfig({}).voiceModel, LITE);
});

test('what she says out loud', () => {
  assert.equal(speakable('$AGI to the moon 💜 (not financial advice)'), 'AGI to the moon (not financial advice)');
  assert.equal(speakable('a $5 coffee and $CLANKCAT'), 'a $5 coffee and CLANKCAT');
  assert.equal(clipSpeech('short one.', 300), 'short one.');
  assert.equal(clipSpeech('One. Two three four five six seven eight nine ten.', 30), 'One. Two three four five six', 'no sentence end late enough: at a word');
  assert.equal(clipSpeech('Hello there my love. And then more words go here', 30), 'Hello there my love.', 'at a sentence end');
  assert.equal(clipSpeech('word '.repeat(20).trim(), 23), 'word word word word');
  assert.equal(spokenText(`hey 💜 ${'la '.repeat(200)}`).length <= MAX_SPOKEN, true);
});

// ---------- her languages (2026-09-29, the owner's request) ----------
test('her fixed lines in her languages: one address each (&lang=, never for English), in that language\'s words, made once and kept', async () => {
  const { linesFor } = await import('../server/voice.js');
  const ja = await get(`?line=more-1&lang=ja&v=${LINE_VERSION}`);
  assert.deepEqual([ja.status, ja.type], [200, 'audio/wav']);
  assert.equal(called(TTS).at(-1).body.input[0].content[0].text, linesFor('ja')['more-1'], 'her Japanese words');
  assert.equal(styleOf(called(TTS).at(-1)), styleFor('sweet'), 'the same mood as in English');
  assert.match(ja.headers.get('cache-control'), /s-maxage=2592000/);
  const n = called(TTS).length;
  assert.equal((await get(`?line=more-1&lang=ja&v=${LINE_VERSION}`)).headers.get('x-agi1-line'), 'memory');
  assert.equal((await line('more-1')).status, 200, 'English: its own recording');
  assert.equal(called(TTS).at(-1).body.input[0].content[0].text, LINES['more-1']);
  assert.equal(called(TTS).length, n + 1);
  // the Japanese one is kept in the database under its own name (its words make its fingerprint)
  resetForTests();
  const again = await get(`?line=more-1&lang=ja&v=${LINE_VERSION}`);
  assert.deepEqual([again.status, again.headers.get('x-agi1-line')], [200, 'kept']);
  assert.deepEqual(again.audio, ja.audio);
  // only her languages, only after the line, never "en", never twice
  for (const bad of [`?line=more-1&lang=en&v=${LINE_VERSION}`, `?line=more-1&lang=xx&v=${LINE_VERSION}`, `?lang=ja&line=more-1&v=${LINE_VERSION}`,
    `?line=more-1&lang=JA&v=${LINE_VERSION}`, `?line=more-1&lang=ja&lang=ko&v=${LINE_VERSION}`, `?line=more-1&v=${LINE_VERSION}&lang=ja`, '?line=more-1&lang=ja']) {
    assert.equal((await get(bad)).status, 404, bad);
  }
  for (const key of ['hello', 'check-high-1', 'sleep', 'talked-out']) assert.equal((await get(`?line=${key}&lang=es&v=${LINE_VERSION}`)).status, 200, key);
});

test('her market lines in her languages: the whole number said in that language, only near the real market cap', async () => {
  const { ALL } = await import('../src/i18n/all.js');
  const es = await get(`?line=mcap-2000000&lang=es&v=${LINE_VERSION}`);
  assert.equal(es.status, 200);
  const said = called(TTS).at(-1).body.input[0].content[0].text;
  assert.equal(said, milestoneLine(2_000_000, ALL.es, 'es').spoken);
  assert.match(said, /2\.000\.000/);
  assert.equal(styleOf(called(TTS).at(-1)), styleFor('celebrate'));
  assert.equal((await get(`?line=mcap-9000000&lang=es&v=${LINE_VERSION}`)).status, 404, 'far from the real market cap: never made');
  assert.equal((await get(`?line=dump-1&lang=ko&v=${LINE_VERSION}`)).status, 200);
  assert.equal(called(TTS).at(-1).body.input[0].content[0].text, dumpLine(1, ALL.ko, 'ko').spoken);
});

test('a reply in Japanese is read aloud up to about 120 characters (a syllable a character), cut at a sentence', async () => {
  const text = 'ねえ、今日はどんな一日だった？'.repeat(14);
  const r = await voice({ text, ticket: ticketFor(text) });
  assert.equal(r.status, 200);
  const said = called(TTS).at(-1).body.input[0].content[0].text;
  assert.ok(said.length <= 120 && said.endsWith('？'), `${said.length}`);
});
