// AGI-1's voice. Off until the visitor presses the speaker button in the chat bar; the choice is remembered.
// She speaks in her own natural AI voice (Gemini's "Despina": smooth, a little teasing, and since 2026-09-25 with the
// feeling of each reply's mood), made by our own server for each reply (/api/voice, with the ticket /api/chat sent along
// with the reply). It arrives STREAMED: the first piece plays as soon as it's here, and the chat shows her reply at the same
// moment (src/chat/chat.js), so she talks as it appears.
// Her natural voice or nothing (2026-09-25, the owner: her voice "randomly changes to the generic voice then back"): the
// browser's robotic voice is never used any more. A reply whose voice fails is tried once more; if it still can't be made,
// the reply just shows (her mouth "says" it silently) and onFail tells the chat. When her voice can't be made for the rest
// of the visit (the day's allowance, Google's daily limit, not set up), the page stops asking and onResting tells the chat,
// which says so once.
// Her fixed lines, the same for everyone and kept by the CDN (src/chat/voice-lines.js): "hi, it's me" when switched on or
// picking up a call, her out-of-messages lines, her market moments.
// Her live view: a sound meter on her voice tells src/lib/talk.js how loud she is, so her 3D mouth moves with her words.
// One voice for the whole page (2026-09-26): the chat starts it, and ClankChecker (src/sections/checker.js) plays her lines
// through the same one (sharedVoice()), so she never talks over herself; 'agi1:speaking' tells every live view when she
// starts and stops talking out loud.
import { setMeter, stopTalk } from '../lib/talk.js';
import { lineUrl } from './voice-lines.js';
import { currentLang } from '../i18n/lang.js';

const KEY = 'agi1_voice';
const nap = (ms) => new Promise((ok) => setTimeout(ok, ms));
let shared = null;                      // the page's voice (the last one started), for other parts of the page
export const sharedVoice = () => shared;

// What she says out loud: no emojis, no "[link removed]" notes, and tickers without the "$" ("$AGI" → "AGI").
export function speakable(text) {
  return String(text)
    .replace(/\p{Extended_Pictographic}|️|‍/gu, '')
    .replace(/\[(?:link|address) removed\]/g, '')
    .replace(/\$([A-Za-z][A-Za-z0-9]{1,11})\b/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// At most `max` characters, cut after a sentence (or at least a word) so she never stops mid-word.
export function clipSpeech(words, max = 300) {
  const text = String(words);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  // the end of its last whole sentence: ". " "! " "? ", or (2026-09-29, her languages) 。！？ । ؟ which need no space
  let sentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  for (const m of cut.matchAll(/[。！？।؟]/g)) sentence = Math.max(sentence, m.index);
  if (sentence > max * 0.5) return cut.slice(0, sentence + 1);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.5 ? cut.slice(0, space) : cut).replace(/[\s,;:]+$/, '');
}

// The server's answers that mean "not today / not here": her voice rests for the rest of this visit (and the reasons).
// `error` codes from /api/voice, and `why` for Google's own refusals (api/voice.js, server/gemini.js).
const REST_ERRORS = ['not_configured', 'not_ready', 'global_cap', 'person_cap'];
const REST_WHY = ['daily_limit', 'credits', 'key', 'model', 'request'];
// …and the ones worth one more try a moment later: a hiccup (ours or Google's), or the network
const retryable = (status, error, why) => error === 'busy' || (error === 'ai_error' && (!why || ['google', 'timeout', 'no_audio'].includes(why)))
  || (status >= 500 && !REST_ERRORS.includes(error) && error !== 'ai_error' && error !== 'unverified');

// → { speak(text, ticket, { onFail }) → Promise, line(key), hello(), isOn(), prime(), stop(), … }. speak() resolves when she
// starts talking ('voice'), or with 'none' / 'stopped'. Without Web Audio (no current browser), the button stays hidden.
// onSpeaking(true/false): she starts / stops talking out loud (her live view shows "speaking").
// onResting(why): her voice can't be made for the rest of this visit (why: one of REST_ERRORS / REST_WHY).
export function startVoice(button, { onSpeaking = () => {}, onResting = () => {} } = {}) {
  const w = typeof window !== 'undefined' ? window : {};
  const Ctx = w.AudioContext || w.webkitAudioContext || null;
  const quiet = {
    speak: async () => 'none', isOn: () => false, prime() {}, unlock: async () => false, stop() {}, setOn() {}, chosen: () => null,
    hello: async () => 'none', line: async () => 'none', warm() {}, speaking: () => false, busy: () => false, unlocked: () => false,
    resting: () => null, available: false,
  };
  if (!button || !Ctx) { shared = quiet; return quiet; }
  button.hidden = false;
  let on = false;
  try { on = localStorage.getItem(KEY) === 'on'; } catch { /* private mode: off */ }

  // her voice: played with Web Audio, which phones allow once it was started from a tap (the speaker button, Send, Listen)
  let ctx = null, serial = 0, reader = null;
  const lines = new Map();              // her fixed lines, once downloaded: "lang|key" → sound
  let resting = null;                   // why her voice rests for the rest of this visit, or null
  const sources = new Set();            // the pieces of her voice scheduled on the Web Audio clock
  let nextAt = 0, flowing = false;      // where the next piece goes; more pieces still on their way
  let started = null;                   // resolve() of the promise speak()/line() handed out, until she starts talking
  const announce = (how) => { const r = started; started = null; r?.(how); };

  let speaking = false;
  const setState = (s) => {
    if (s) button.dataset.state = s; else delete button.dataset.state;
    if (s === 'loading') button.setAttribute('aria-busy', 'true'); else button.removeAttribute('aria-busy');
    if ((s === 'speaking') !== speaking) {
      speaking = s === 'speaking';
      try { onSpeaking(speaking); } catch { /* the live view is optional */ }
      try { dispatchEvent(new CustomEvent('agi1:speaking', { detail: speaking })); } catch { /* (tests without a window) */ }
    }
  };
  const draw = () => {
    button.setAttribute('aria-pressed', String(on));
    button.title = resting ? 'Voice: resting for today' : on ? 'Voice: on' : 'Voice: off';
    button.classList.toggle('is-on', on);
  };
  const rest = (why) => {
    if (resting) return;
    resting = why;
    button.dataset.rest = why;
    draw();
    try { onResting(why); } catch { /* the chat's note is optional */ }
  };
  const audio = () => {
    // iPhones mute web sound with the silent switch unless the page asks for "playback" sound (Safari's Audio Session API)
    try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch { /* older browsers */ }
    try { ctx ??= new Ctx(); } catch { return null; }
    if (ctx.state === 'suspended') ctx.resume().catch(() => { /* needs a tap first */ });
    return ctx;
  };

  // The sound meter: her voice goes through it on its way to the speakers. talk.js asks it how loud she is, once a frame.
  let meterNode = null, samples = null, loudest = 0.06;
  const output = () => {
    if (!meterNode) {
      try {
        meterNode = ctx.createAnalyser();
        meterNode.fftSize = 1024;                        // about 1/40 s of sound per reading
        meterNode.connect(ctx.destination);
        samples = new Float32Array(meterNode.fftSize);
      } catch { meterNode = null; return ctx.destination; }
    }
    return meterNode;
  };
  setMeter(() => {
    if (!meterNode || !sources.size || typeof meterNode.getFloatTimeDomainData !== 'function') return 0;
    meterNode.getFloatTimeDomainData(samples);
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / samples.length);
    loudest = Math.max(rms, loudest * 0.995);            // follows how loud this reply is, so quiet and loud voices both work
    const floor = Math.max(0.006, loudest * 0.12);
    return (rms - floor) / Math.max(0.02, loudest * 0.75 - floor);
  });

  const stop = () => {
    serial += 1;                        // anything still loading is dropped when it arrives
    for (const s of sources) { try { s.stop(); } catch { /* already over */ } }
    sources.clear();
    reader?.cancel().catch(() => { /* already closed */ });
    reader = null;
    flowing = false;
    stopTalk();
    setState('');
    announce('stopped');
  };

  // one piece of her voice, right after the previous one (the very first a moment from now, so later pieces keep up)
  const schedule = (buffer, my, lead) => {
    if (my !== serial || !ctx) return;
    const s = ctx.createBufferSource();
    s.buffer = buffer;
    s.connect(output());
    const at = Math.max(ctx.currentTime + lead, nextAt);
    s.start(at);
    nextAt = at + buffer.duration;
    sources.add(s);
    s.onended = () => { sources.delete(s); if (my === serial && !sources.size && !flowing) setState(''); };
    setState('speaking');
    announce('voice');
  };
  // streamed raw 16-bit PCM → pieces of about 0.1 s, each played as soon as it's complete
  const playStream = async (res, rate, my) => {
    const r = res.body.getReader();
    reader = r;
    flowing = true;
    nextAt = 0;
    const PIECE = Math.round(rate * 0.1);
    let parts = [], count = 0, odd = null, played = 0;
    const flush = () => {
      if (!count || my !== serial) return;
      const buffer = ctx.createBuffer(1, count, rate);
      const channel = buffer.getChannelData(0);
      let at = 0;
      for (const p of parts) { channel.set(p, at); at += p.length; }
      parts = []; count = 0;
      schedule(buffer, my, played ? 0.02 : 0.12);
      played += 1;
    };
    try {
      for (;;) {
        let chunk;
        try { chunk = await r.read(); } catch (err) { if (played) break; throw err; }   // cut off: play what we have
        if (my !== serial) return;
        if (chunk.done) break;
        let bytes = chunk.value;
        if (odd) { const m = new Uint8Array(odd.length + bytes.length); m.set(odd); m.set(bytes, odd.length); bytes = m; odd = null; }
        const even = bytes.length - (bytes.length % 2);
        if (even < bytes.length) odd = bytes.slice(even);
        const view = new DataView(bytes.buffer, bytes.byteOffset, even);
        const pcm = new Float32Array(even / 2);
        for (let i = 0; i < pcm.length; i++) pcm[i] = view.getInt16(i * 2, true) / 32768;
        parts.push(pcm);
        count += pcm.length;
        if (count >= PIECE) flush();
      }
      flush();
      if (!played && my === serial) throw new Error('empty');
    } finally {
      if (reader === r) reader = null;
      if (my === serial) { flowing = false; if (!sources.size) setState(''); }
    }
  };
  // a whole WAV file → a sound Web Audio can play (the callback form also works in older Safari)
  const decode = (bytes) => new Promise((resolve, reject) => ctx.decodeAudioData(bytes, resolve, reject));
  const playAnswer = async (res, my) => {
    const type = res.headers.get('content-type') || '';
    if (/^audio\/(l16|pcm)/i.test(type)) return playStream(res, Number((type.match(/rate=(\d+)/) || [])[1]) || 24000, my);
    const buffer = await decode(await res.arrayBuffer());
    if (my !== serial) return undefined;
    flowing = false;
    nextAt = 0;
    return schedule(buffer, my, 0.02);
  };

  // One reply in her voice. A failure is tried once more a moment later (a ticket may be used twice) when it's worth it;
  // after that, or when the server says her voice rests for today, she stays silent for it (never the robotic voice).
  function say(text, ticket, { onFail } = {}) {
    stop();                             // (this also settles an older speak())
    loudest = 0.06;                     // the meter learns this reply's loudness afresh
    const my = serial;
    const ready = new Promise((resolve) => { started = resolve; });
    if (!speakable(text) || !ticket || resting || !audio()) { announce('none'); return ready; }
    setState('loading');
    (async () => {
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        let again = true;
        try {
          const res = await fetch('/api/voice', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, ticket }),
            signal: AbortSignal.timeout?.(25000),
          });
          if (my !== serial) { res.body?.cancel().catch(() => { /* already closed */ }); return; }   // stopped meanwhile
          if (res.ok && /^audio\//.test(res.headers.get('content-type') || '')) { await playAnswer(res, my); return; }
          let error = '', why = '';
          try { ({ error = '', why = '' } = await res.json()); } catch { /* not JSON */ }
          if (REST_ERRORS.includes(error)) rest(error);
          else if (error === 'ai_error' && REST_WHY.includes(why)) rest(why);
          again = retryable(res.status, error, why);
        } catch {
          if (my !== serial) return;    // stopped meanwhile (that's all)
          again = true;                 // the network, or a stream that ended before any sound: once more
        }
        if (!again || resting || attempt === 2) break;
        await nap(700);
        if (my !== serial) return;
      }
      if (my !== serial) return;
      setState('');
      announce('none');
      try { onFail?.(); } catch { /* the chat's mark is optional */ }
    })();
    return ready;
  }

  // Her fixed lines (/api/voice?line=<key>&v=…, the same for everyone, made once and kept by the CDN). They use nobody's
  // voice allowance, so they're asked for even when replies can't be voiced. Each line is downloaded once per visit (warm()
  // starts that early), and a failed download is tried once more. Her natural voice or nothing.
  // In her languages (2026-09-29): each line in the language it was shown in (`lang`; her current one if not given).
  const fetching = new Map();           // "lang|key" → the download in progress (bytes), shared by warm() and sayLine()
  let linesOn = true;                   // false after "not set up" (no Gemini key): no more line requests this visit
  const idOf = (key, lang) => `${lang}|${key}`;
  function download(key, lang) {
    const id = idOf(key, lang);
    if (!fetching.has(id)) {
      const attempt = async () => {
        const res = await fetch(lineUrl(key, lang), { signal: AbortSignal.timeout?.(20000) });
        if (res.ok && /^audio\//.test(res.headers.get('content-type') || '')) return res.arrayBuffer();
        let error = '';
        try { error = (await res.json()).error || ''; } catch { /* not JSON */ }
        if (error === 'not_configured') linesOn = false;
        throw Object.assign(new Error(error || `voice ${res.status}`), { final: error === 'not_configured' || res.status === 404 });
      };
      const job = attempt()
        .catch((err) => (err.final ? Promise.reject(err) : nap(700).then(attempt)))
        .catch((err) => { fetching.delete(id); throw err; });       // (a later try may work)
      fetching.set(id, job);
    }
    return fetching.get(id);
  }
  // start downloading a line before it's needed (the pointer is on Call, Listen or the speaker button): no sound, no decoding
  const warm = (key, lang = currentLang()) => {
    if (linesOn && !lines.has(idOf(key, lang))) download(key, lang).catch(() => { /* it's tried again when needed */ });
  };
  function sayLine(key, lang = currentLang()) {
    stop();
    const my = serial;
    const id = idOf(key, lang);
    const ready = new Promise((resolve) => { started = resolve; });
    if (!linesOn || !audio()) { announce('none'); return ready; }
    setState('loading');
    (async () => {
      try {
        if (!lines.has(id)) lines.set(id, await decode((await download(key, lang)).slice(0)));
        if (my !== serial) return;
        flowing = false;
        nextAt = 0;
        schedule(lines.get(id), my, 0.02);
      } catch {
        if (my !== serial) return;
        setState('');
        announce('none');
      }
    })();
    return ready;
  }
  const greet = () => sayLine('hello');

  // switched on or off by the page itself (voice chat): `remember` = keep that choice for the next visits too
  function setOn(next, { remember = true } = {}) {
    next = Boolean(next);
    if (next === on) return;
    on = next;
    if (remember) { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* this visit only */ } }
    draw();
    if (on) audio(); else stop();
  }
  // Sound allowed right now? After asking (from a tap, or later on browsers that remember the page was tapped), give the
  // browser a moment to say yes. → true / false
  async function unlock() {
    const c = audio();
    if (!c) return false;
    for (let i = 0; i < 8 && c.state !== 'running'; i += 1) await nap(50);
    return c.state === 'running';
  }

  // a visitor about to switch her voice on: her "hi, it's me" starts downloading, so it plays at once
  for (const type of ['pointerenter', 'focus', 'touchstart']) button.addEventListener(type, () => { if (!on) warm('hello'); }, { passive: true });
  button.addEventListener('click', () => {
    on = !on;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* this visit only */ }
    draw();
    if (on) {
      audio();                                       // started right in the tap: phones only allow sound that starts from one
      greet();
    } else stop();
  });
  draw();
  shared = {
    speak: (text, ticket, options) => (on ? say(text, ticket, options) : Promise.resolve('none')),
    isOn: () => on,
    setOn,
    // what the visitor picked with the speaker button: 'on', 'off', or null (never pressed it)
    chosen: () => { try { return localStorage.getItem(KEY); } catch { return null; } },
    hello: () => (on ? greet() : Promise.resolve('none')),
    // a fixed line (see sayLine). Plays even with voice off: only for a line the visitor asked to hear (a tap), when her
    // voice is on, or when she runs out of messages (the owner's choice). warm(key): download it early, silently.
    line: (key, lang) => sayLine(key, lang || currentLang()),
    warm: (key, lang) => warm(key, lang || currentLang()),
    available: true,                    // this browser can play her voice (else the quiet stub above: false)
    speaking: () => speaking,
    // talking, or her voice for something is still on its way (so another line would cut it off)
    busy: () => speaking || button.dataset.state === 'loading',
    // whether her voice can play right now without a tap: browsers keep a page's sound locked until the visitor taps it
    unlocked: () => Boolean(ctx && ctx.state === 'running'),
    unlock,
    // why her voice rests for the rest of this visit ('global_cap', 'daily_limit', …), or null
    resting: () => resting,
    // call while the visitor is tapping Send: unlocks sound on phones (when her voice is on, or `force`: she's about to say
    // her out-of-messages line)
    prime: ({ force = false } = {}) => { if (on || force) audio(); },
    stop,
  };
  return shared;
}
