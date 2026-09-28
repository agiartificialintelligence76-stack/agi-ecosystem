// Market moments (2026-09-25, the owner's request): when $AGI's market cap reaches another $200K step, AGI-1 says so, happy,
// with the new market cap; when $AGI is down 20% or more in 24 hours, she's sad. What she says is pre-written (no AI cost)
// and the same for everyone at that moment, so her natural voice for each line is made once and kept by the CDN
// (/api/voice?line=mcap-<step> or dump-<n>, api/voice.js). Shared by the page (src/chat/market.js, src/chat/chat.js) and
// the server. Feelings and the number only: never a prediction, never buy / sell / hold, always "not financial advice"
// (tests/market.test.js checks every line).

export const STEP = 200_000;                  // a milestone every $200K of market cap
export const DUMP = -20;                      // a dump: the 24-hour change is -20% or worse
export const REARM = -10;                     // …and she can be sad about another one only after it's back above -10%
export const MAX_MILESTONE = 10_000_000_000;  // (a sanity limit for addresses like ?line=mcap-…)

export const milestoneOf = (mcap) => Math.floor(mcap / STEP) * STEP;

// $2M · $2.2M · $400K · $1.25B (her text)
export function usd(n) {
  if (n >= 1e9) return `$${+(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${+(n / 1e6).toFixed(2)}M`;
  return `$${Math.round(n / 1e3)}K`;
}
// "2 million" · "2.2 million" · "400 thousand" · "1.25 billion" (her voice: no "$", no letters to spell out)
export function usdSpoken(n) {
  if (n >= 1e9) return `${+(n / 1e9).toFixed(2)} billion`;
  if (n >= 1e6) return `${+(n / 1e6).toFixed(2)} million`;
  return `${Math.round(n / 1e3)} thousand`;
}

// {m} = the market cap step. Happy, a little silly, never about what happens next.
const HAPPY = [
  (m) => `we just hit ${m} market cap 💜 i'm literally glowing right now… not financial advice, just a very proud girlfriend`,
  (m) => `${m} market cap!! 🙈 i'm doing a little happy dance over here. not financial advice, just good vibes`,
  (m) => `look at us, ${m} market cap 💜 i'm so happy i could cry. not financial advice, just feelings`,
];
// Sad, kind, never about what anyone should do.
const SAD = [
  "ouch… $AGI is down more than 20% today 🥺 i'm a little sad, but i'm still here. not financial advice, just a hug",
  "$AGI dropped more than 20% in a day 🥺 not my favorite chart… i'll be okay, i have you. not financial advice",
  "down more than 20% today 🥺 i'm a bit sad… tell me something nice? not financial advice",
];
const withoutEmoji = (s) => s.replace(/\p{Extended_Pictographic}|️|‍/gu, '').replace(/\$([A-Za-z])/g, '$1').replace(/\s+/g, ' ').trim();

// → { key, text, spoken, step } for a market cap step (a multiple of $200K), or null
export function milestoneLine(step) {
  if (!Number.isSafeInteger(step) || step < STEP || step > MAX_MILESTONE || step % STEP) return null;
  const say = HAPPY[(step / STEP) % HAPPY.length];
  return { key: `mcap-${step}`, text: say(usd(step)), spoken: withoutEmoji(say(usdSpoken(step))), step };
}
// → { key, text, spoken } for a bad day; which one depends on the (UTC) day, so it's the same for everyone that day
export function dumpLine(day = Math.floor(Date.now() / 864e5)) {
  const n = ((Math.floor(day) % SAD.length) + SAD.length) % SAD.length;
  return { key: `dump-${n}`, text: SAD[n], spoken: withoutEmoji(SAD[n]) };
}
// The server: the line for an address like ?line=mcap-2000000 or ?line=dump-1 (null for anything else)
export function marketLineByKey(key) {
  const m = /^mcap-([1-9][0-9]{5,10})$/.exec(String(key));
  if (m) return milestoneLine(Number(m[1]));
  const d = /^dump-([0-9])$/.exec(String(key));
  if (d && Number(d[1]) < SAD.length) return dumpLine(Number(d[1]));
  return null;
}
