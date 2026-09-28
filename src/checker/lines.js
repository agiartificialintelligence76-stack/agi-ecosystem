// ClankChecker (2026-09-26, the owner's idea): what AGI-1 says about a coin once its scan is in. Pre-written, the same for
// every coin with the same result, so her natural voice for each line is made once by our server and then kept (the
// database and the CDN, like her other fixed lines: /api/voice?line=check-…): clicking coin after coin never makes a new
// recording and costs nothing (the owner: "just use a couple of voices … so it doesn't generate new ones").
// The page shows the words (src/sections/checker.js) and plays her voice; the server makes the voice (server/voice.js).
// Rules, like every line of hers: PG-13, lowercase texting, no pet names (anyone may ask, Strangers too), never buy / sell /
// hold or a prediction, never "safe", and always "not financial advice" (tests/checker.test.js checks every line).

// The risk levels a scan can end in (server/checker.js decides which), worst last. `label`: what the page shows.
export const LEVELS = {
  low: { label: 'Lower risk', react: 'okay', mood: 'neutral' },
  some: { label: 'Some risk', react: 'hmm', mood: 'careful' },
  high: { label: 'High risk', react: 'worried', mood: 'worried' },
  none: { label: 'Not enough data', react: 'shy', mood: 'careful' },
};

// Two lines per level: a coin always gets the same one (it follows its address), different coins take turns.
const SAYS = {
  low: [
    "okay, this one looks calmer than most 💜 nothing big jumped out at me. it's still a meme coin, so it can still go to zero. not financial advice.",
    "i read every line of this one 💜 fewer red flags than usual. lower risk isn't no risk though. not financial advice.",
  ],
  some: [
    'hmm, a few things made me pause 🙈 read the flags with me before you decide anything. not financial advice.',
    "mixed feelings about this one. some of it looks fine, some of it doesn't. the flags are right here 💜 not financial advice.",
  ],
  high: [
    "okay, i'm worried about this one 🥺 lots of red flags in the scan. please be careful. not financial advice.",
    'no no no… this one scares me a little 🙈 the red flags are right there, so please be careful with it. not financial advice.',
  ],
  none: [
    "i couldn't read enough about this one to say anything 🙈 try again in a minute? not financial advice.",
    "hmm, the scan came back empty. i'd rather not guess 💜 let's try again in a bit. not financial advice.",
  ],
};
// Two special ones: the site's own coin, and a coin that only borrowed its ticker.
const AGI_LINE = "wait, that's me! 💜 i'm a little biased, so read the facts yourself. not financial advice.";
const COPY_LINE = "hey, that's not me 🙈 someone borrowed my name. the real $AGI has one official contract, and it's on this page. not financial advice.";

// The words her voice says: her emojis end a sentence in her texts ("…than most 💜 nothing big…"), so out loud they become a
// full stop (or nothing at the very end), and "$AGI" is said "AGI".
const EMOJI = /\s*(?:\p{Extended_Pictographic}|\uFE0F|\u200D)+\s*/gu;
export const spokenOf = (text) => String(text)
  .replace(EMOJI, (m, at, all) => (!all.slice(at + m.length).trim() ? '' : /[.,!?…:;]$/.test(all.slice(0, at)) ? ' ' : '. '))
  .replace(/\$([A-Za-z][A-Za-z0-9]{1,11})\b/g, '$1')
  .replace(/\s+/g, ' ')
  .trim();

// Every line she can say here: key → { key, text, spoken (what her voice says), mood (how her voice sounds, server/voice.js),
// react (her 3D reaction) }
const line = (key, text, mood, react) => [key, { key, text, spoken: spokenOf(text), mood, react }];
export const CHECK_LINES = Object.fromEntries([
  ...Object.entries(SAYS).flatMap(([level, list]) => list.map((text, i) => line(`check-${level}-${i + 1}`, text, LEVELS[level].mood, LEVELS[level].react))),
  line('check-agi', AGI_LINE, 'happy', 'love'),
  line('check-copy', COPY_LINE, 'pout', 'jealous'),
]);

// Her line for one scan: { level, official, copyOfficial, address } (what /api/checker answers) → a CHECK_LINES entry.
export function checkLine({ level, official = false, copyOfficial = false, address = '' } = {}) {
  if (official && level !== 'none') return CHECK_LINES['check-agi'];
  if (copyOfficial && level !== 'none') return CHECK_LINES['check-copy'];
  const lv = Object.hasOwn(SAYS, level) ? level : 'none';
  const n = (parseInt(String(address).slice(-4), 16) || 0) % SAYS[lv].length;
  return CHECK_LINES[`check-${lv}-${n + 1}`];
}
