// How much AGI-1 is talking right now, from 0 (quiet) to 1 (loud), so her 3D mouth and head can follow her words
// (src/stage/stage.js reads it every frame and hands it to src/stage/agi1.js). Added 2026-09-25 with her live view in
// the chat. What feeds it:
//  • her AI voice (src/chat/voice.js): a sound meter on the audio that is actually playing,
//  • voice off, or a reply her voice couldn't be made for: src/chat/chat.js makes her "say" it silently for a moment (a
//    made-up rhythm of syllables), like a character in a video game. (The browser's robotic voice isn't used any more.)
// Nothing here makes a sound or costs anything.
let meter = null;                     // () → 0..1 while her AI voice plays (set by voice.js), or null
let fakeFrom = 0, fakeUntil = 0, fakeStrength = 0;

export function setMeter(fn) { meter = typeof fn === 'function' ? fn : null; }

// A made-up rhythm of syllables for `seconds` (strength 0..1: how wide her mouth opens).
export function pretendTalk(seconds, strength = 1, now = performance.now()) {
  const s = Number(seconds);
  if (!(s > 0)) return;
  fakeFrom = now;
  fakeUntil = now + Math.min(s, 60) * 1000;
  fakeStrength = Math.min(1, Math.max(0, Number(strength) || 0));
}
export function stopTalk() { fakeUntil = 0; }

// A repeatable "random" number between 0 and 1 for each syllable (the same syllable always gets the same one).
const noise = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// About 5 syllables a second, each a little louder or softer, with a short pause now and then (between words).
export function rhythm(t) {
  if (!(t >= 0)) return 0;
  const syllable = t * 5.2;
  const i = Math.floor(syllable), f = syllable - i;
  if (noise(i) < 0.16) return 0;                                  // a pause
  return (0.4 + 0.6 * noise(i + 17.3)) * Math.pow(Math.sin(Math.PI * f), 1.4);
}

export function talkLevel(now = performance.now()) {
  let level = 0;
  if (meter) {
    try { level = Number(meter()) || 0; } catch { level = 0; }
  }
  if (now < fakeUntil && now >= fakeFrom) {
    const t = (now - fakeFrom) / 1000;
    const fade = Math.min(1, t / 0.08, (fakeUntil - now) / 150);   // a soft start and end
    level = Math.max(level, rhythm(t) * fakeStrength * fade);
  }
  return Math.min(1, Math.max(0, level));
}
