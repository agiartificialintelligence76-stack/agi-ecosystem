// Voice chat (2026-09-25): the visitor talks and the browser turns it into text, for free (the Web Speech API's
// SpeechRecognition). The words then go into the chat like a typed message, with the same limits. We never record or
// upload any sound: the browser's own speech service does the listening (in some browsers that service runs on the
// browser maker's servers) and only the text reaches the page. Browsers without it (Firefox) don't show the mic.
// src/chat/chat.js uses this for the mic button (one message) and for calls (hands-free, back and forth).

const recognizer = (w) => w.SpeechRecognition || w.webkitSpeechRecognition || null;
export const canListen = (w = globalThis) => Boolean(recognizer(w)) && w.isSecureContext !== false;

// What the recognizer heard, tidied: one line, at most `max` characters. '' when it's only noise (no letters or digits).
export function cleanHeard(text, max = 500) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (t.length < 2 || !/[\p{L}\p{N}]/u.test(t)) return '';
  return t.slice(0, max).trim();
}

// Why listening ended without words (for her notes in the chat)
const REASONS = {
  'no-speech': 'silence', aborted: 'stopped', 'audio-capture': 'no-mic', network: 'offline',
  'not-allowed': 'denied', 'service-not-allowed': 'denied', 'language-not-supported': 'unavailable',
};
const LONGEST = 30_000;     // nobody talks to her for more than 30 s in one go: then it's sent as it is

// Listens for one message. onWords(textSoFar) runs while you speak; `done` resolves with { text, reason } once you stop:
// reason 'heard' (text is set) or why nothing came: 'silence' | 'stopped' | 'denied' | 'no-mic' | 'offline' |
// 'unavailable' | 'error'. stop() = finish now with what was heard; cancel() = throw it away.
export function listenOnce({ lang = 'en-US', onWords = () => {} } = {}, w = globalThis) {
  const SR = recognizer(w);
  let finished = false, cancelled = false, heard = '', failure = '', rec = null, timer = null;
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  const finish = (why) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    const text = cancelled ? '' : cleanHeard(heard);
    resolve({ text, reason: text ? 'heard' : cancelled ? 'stopped' : why });
  };
  try {
    rec = new SR();
    rec.lang = lang;
    rec.continuous = false;               // one message: it ends by itself when you stop talking
    rec.interimResults = true;            // words appear as you say them
    rec.maxAlternatives = 1;
  } catch {
    finish('unavailable');
    return { done, stop() {}, cancel() {} };
  }
  rec.onresult = (e) => {
    let text = '';
    for (let i = 0; i < e.results.length; i++) text += e.results[i][0]?.transcript || '';
    if (finished) return;                   // words arriving after the end (it happens) change nothing
    heard = text;
    onWords(cleanHeard(text));
  };
  rec.onerror = (e) => { failure = REASONS[e?.error] || 'error'; };
  rec.onend = () => finish(failure || 'silence');
  try { rec.start(); } catch { finish('unavailable'); }
  // a recognizer that never ends by itself (it happens) is stopped, and given up on a little later
  if (!finished) {
    timer = setTimeout(() => {
      try { rec.stop(); } catch { /* already over */ }
      timer = setTimeout(() => finish(failure || 'silence'), 3000);
    }, LONGEST);
  }
  return {
    done,
    stop() { try { rec.stop(); } catch { finish('stopped'); } },
    cancel() { cancelled = true; try { rec.abort(); } catch { /* already over */ } finish('stopped'); },
  };
}
