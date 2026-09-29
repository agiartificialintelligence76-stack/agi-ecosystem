// ClankChecker (2026-09-26, the owner's idea): what AGI-1 says about a coin once its scan is in. Pre-written, the same for
// every coin with the same result, so her natural voice for each line is made once by our server and then kept (the
// database and the CDN, like her other fixed lines: /api/voice?line=check-…): clicking coin after coin never makes a new
// recording and costs nothing (the owner: "just use a couple of voices … so it doesn't generate new ones").
// The page shows the words (src/sections/checker.js) and plays her voice; the server makes the voice (server/voice.js).
// Rules, like every line of hers: PG-13, lowercase texting, no pet names (anyone may ask, Strangers too), never buy / sell /
// hold or a prediction, never "safe", and always "not financial advice" (tests/checker.test.js checks every line).

import { EN, lineAt } from '../i18n/text.js';

// The risk levels a scan can end in (server/checker.js decides which), worst last. `label`: what the page shows.
export const LEVELS = {
  low: { label: 'Lower risk', react: 'okay', mood: 'neutral' },
  some: { label: 'Some risk', react: 'hmm', mood: 'careful' },
  high: { label: 'High risk', react: 'worried', mood: 'worried' },
  none: { label: 'Not enough data', react: 'shy', mood: 'careful' },
};

// Two lines per level: a coin always gets the same one (it follows its address), different coins take turns. The site's own
// coin and a coin that only borrowed its ticker have their own. In her languages since 2026-09-29: `check` in
// src/i18n/lines/<code>.js (English: en.js).
const SAYS = { low: EN.check.low, some: EN.check.some, high: EN.check.high, none: EN.check.none };

// The words her voice says: her emojis end a sentence in her texts ("…than most 💜 nothing big…"), so out loud they become a
// full stop (or nothing at the very end), and "$AGI" is said "AGI".
const EMOJI = /\s*(?:\p{Extended_Pictographic}|\uFE0F|\u200D)+\s*/gu;
export const spokenOf = (text) => String(text)
  .replace(EMOJI, (m, at, all) => (!all.slice(at + m.length).trim() ? '' : /[.,!?…:;]$/.test(all.slice(0, at)) ? ' ' : '. '))
  .replace(/\$([A-Za-z][A-Za-z0-9]{1,11})\b/g, '$1')
  .replace(/\s+/g, ' ')
  .trim();

// Every line she can say here, in these lines' language: key → { key, text, spoken (what her voice says), mood (how her
// voice sounds, server/voice.js), react (her 3D reaction), lang }
export function checkLinesIn(lines = EN, lang = 'en') {
  const line = (key, path, mood, react) => { const text = lineAt(lines, path); return [key, { key, text, spoken: spokenOf(text), mood, react, lang }]; };
  return Object.fromEntries([
    ...Object.entries(SAYS).flatMap(([level, list]) => list.map((_, i) => line(`check-${level}-${i + 1}`, `check.${level}.${i}`, LEVELS[level].mood, LEVELS[level].react))),
    line('check-agi', 'check.agi', 'happy', 'love'),
    line('check-copy', 'check.copy', 'pout', 'jealous'),
  ]);
}
export const CHECK_LINES = checkLinesIn();
const byLang = new Map([['en', CHECK_LINES]]);
const linesFor = (lines, lang) => {
  if (!byLang.has(lang) || byLang.get(lang).lines !== lines) byLang.set(lang, Object.assign(checkLinesIn(lines, lang), { lines }));
  return byLang.get(lang);
};

// Her line for one scan: { level, official, copyOfficial, address } (what /api/checker answers) → a CHECK_LINES entry (in
// the language of `lines`, English if not given)
export function checkLine({ level, official = false, copyOfficial = false, address = '' } = {}, lines = EN, lang = 'en') {
  const all = lang === 'en' && lines === EN ? CHECK_LINES : linesFor(lines, lang);
  if (official && level !== 'none') return all['check-agi'];
  if (copyOfficial && level !== 'none') return all['check-copy'];
  const lv = Object.hasOwn(SAYS, level) ? level : 'none';
  const n = (parseInt(String(address).slice(-4), 16) || 0) % SAYS[lv].length;
  return all[`check-${lv}-${n + 1}`];
}
