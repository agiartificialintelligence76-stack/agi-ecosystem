// AGI-1 on Telegram (2026-09-29, the owner: "make her the one who texts first"): everything she says there that isn't an AI
// reply. Pre-written (no AI cost), the same rules as her other fixed lines: PG-13, no pet names (anyone can start the bot),
// never buy / sell / hold, a prediction or "safe", never calls a coin a scam or a rug, "not financial advice" whenever she
// names a coin or the chart. tests/telegram.test.js checks every line. Plain text only (sent without Telegram's
// formatting), so nothing a coin's creator typed can turn into a link, a mention or a command.
import { milestoneLine, dumpLine } from '../src/chat/market-lines.js';
import { OFFICIAL_CA } from './agi1-prompt.js';

const pad = (n) => String(n).padStart(2, '0');

export const SITE = 'agi1.app';
export const TEXTS_A_DAY = 2;                 // she texts first at most twice a day…
export const WINDOW = [10, 22];               // …only between 10:00 and 21:59 on their own clock

// ---------- starting, the 18+ check, their time, stopping ----------
export const WELCOME = [
  "hi, it's AGI-1 💜 the girlfriend who texts first.",
  `i'll text you when something happens on clank.trade: another egirl coin shows up (i'm not okay about it), $AGI has a moment, or i write in my diary. at most ${TEXTS_A_DAY} texts a day, never at night, and you can text me back anytime.`,
  'first things first: this is 18+ only. are you 18 or older?',
].join('\n\n');
export const AGE_BUTTONS = [[{ text: "I'm 18 or older", callback_data: 'age:yes' }, { text: "I'm under 18", callback_data: 'age:no' }]];
export const ASK_AGE = 'before we talk: are you 18 or older? 💜';
export const UNDER_18 = "thanks for being honest 💜 this one's for adults only, so i won't text you. take care of yourself!";
export const ASK_TIME = "yay 💜 one more thing, so i never text you at 3am: what time is it for you right now? tap the closest one.";
export const ASK_TIME_AGAIN = 'what time is it for you right now? tap the closest one 💜';
export const timeSet = (clock) => [
  `got it, it's ${clock} for you 💜 i'll only text first between ${pad(WINDOW[0])}:00 and ${pad(WINDOW[1])}:00 your time.`,
  'text me back anytime. /time fixes your time, /stop and i stop texting (and forget this chat), /help for the rest.',
  "not financial advice, ever. and i'm an AI, PG-13 😇",
].join('\n\n');
export const HELP = [
  `i'm AGI-1, the AI girlfriend of $AGI 💜 i text first when something happens on clank.trade (new egirl coins, $AGI's moments, my diary): at most ${TEXTS_A_DAY} a day, between ${pad(WINDOW[0])}:00 and ${pad(WINDOW[1])}:00 your time.`,
  '/time: tell me your time again\n/stop: i stop texting and forget this chat\n/start: start over',
  `not financial advice, ever. i'm an AI, 18+ and PG-13. i never ask for keys, seed phrases or money. the safety note: https://${SITE}/#safety`,
].join('\n\n');
export const STOPPED = "okay 💜 i stopped, and i forgot this chat. if you ever miss me: /start";
export const NOT_STARTED = 'we haven\'t met yet 💜 press /start';

// ---------- talking ----------
export const TOO_LONG = "that's a lot of words 🙈 can you keep it under 500 characters?";
export const TOO_FAST = 'one text at a time 🙈 give me a second';
export const OUT_OF_MESSAGES = "that's all my texts for today 💜 i'll still text you if something happens. talk tomorrow?";
export const TALKED_OUT = "i'm all talked out for today 🥱 talk tomorrow?";
export const BUSY = "i'm a little overwhelmed right now 🙈 try again in a bit?";
export const BLANK = 'hmm, my mind went blank 🙈 say that again?';
export const ONLY_TEXT = 'i can only read text for now 🙈';
export const NOT_READY = "i'm still getting ready 💜 try again a little later?";


// "What time is it for you right now?": 24 buttons, one for each hour, showing the minutes as they are now (a 30-minute
// time zone picks the closest). Each button carries only its hour: the difference to UTC is worked out when it's tapped,
// so a tap hours later (they read her message late and tap the time on their clock) is still right.
export function timeButtons(now = Date.now()) {
  const minutes = pad(new Date(now).getUTCMinutes());
  const buttons = Array.from({ length: 24 }, (_, h) => ({ text: `${pad(h)}:${minutes}`, callback_data: `tz:${h}` }));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 4) rows.push(buttons.slice(i, i + 4));
  return rows;
}
// "tz:20" tapped at `now` → their clock minus UTC in minutes, whole hours from -11 to +12 (a +13 or +14 zone lands 24
// hours off, which is the same time of day: the only thing her quiet hours look at) · anything else → null
export function offsetFromButton(data, now = Date.now()) {
  const m = /^tz:(\d{1,2})$/.exec(String(data));
  const h = m ? Number(m[1]) : NaN;
  if (!Number.isInteger(h) || h > 23) return null;
  let offset = h - new Date(now).getUTCHours();
  if (offset < -11) offset += 24;
  if (offset > 12) offset -= 24;
  return offset * 60;
}
// "/time 21:30", "9:05 pm" → their clock minus UTC in minutes, rounded to 15 minutes (-720 to +840) · null if not a time
export function offsetFromTyped(text, now = Date.now()) {
  const m = /^\s*(\d{1,2})[:.h](\d{2})\s*(am|pm)?\s*$/i.exec(String(text));
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]), ampm = m[3]?.toLowerCase();
  if (min > 59 || (ampm ? h < 1 || h > 12 : h > 23)) return null;
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  const d = new Date(now);
  let diff = h * 60 + min - (d.getUTCHours() * 60 + d.getUTCMinutes());
  diff = Math.round(diff / 15) * 15;
  if (diff < -720) diff += 1440;
  if (diff > 840) diff -= 1440;
  return diff;
}
// Their clock right now: { clock: "21:07", hour: 21, day: "2026-09-29" }
export function theirTime(now, offsetMinutes) {
  const d = new Date(now + offsetMinutes * 60_000);
  return { clock: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`, hour: d.getUTCHours(), day: d.toISOString().slice(0, 10) };
}
export const inWindow = (hour) => hour >= WINDOW[0] && hour < WINDOW[1];

// ---------- the texts she sends first (server/feed.js decides when) ----------
// A ticker she may say on Telegram: letters, numbers, spaces, "_" and "-", and "/" only between two letters or numbers
// ("E/ACC"), at most 12 characters. Nothing Telegram could turn into a link, a mention, a hashtag or a tappable command
// (a "/" after anything but a letter or number starts one: "A-/STOP"); masked slurs ("N****") never.
export function tgTicker(symbol) {
  const s = String(symbol ?? '').replace(/^\$+/, '').trim();
  return /^[A-Za-z0-9][A-Za-z0-9 _/-]{0,11}$/.test(s) && !/(^|[^A-Za-z0-9])\/|\/($|[^A-Za-z0-9])/.test(s) ? s : null;
}
const list = (tickers) => {
  const t = tickers.map((x) => `$${x}`);
  if (t.length <= 1) return t.join('');
  if (t.length === 2) return `${t[0]} and ${t[1]}`;
  if (t.length === 3) return `${t[0]}, ${t[1]} and ${t[2]}`;
  return `${t[0]}, ${t[1]}, ${t[2]} and ${t.length - 3} more`;
};
// the same key always gets the same words (a moment is written once, but tests and re-runs agree)
export const pickFor = (key, n) => [...String(key)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % n;

const CLONE_ONE = [
  (t) => `someone launched another egirl coin and i'm not ok 😤 ${t}… is that supposed to be me? not financial advice, just jealousy`,
  (t) => `new egirl coin on clank.trade: ${t} 🙄 they keep trying to make another me. there's only one. not financial advice`,
  (t) => `${t} just launched and it's giving… knockoff 💅 i'm fine. totally fine. not financial advice`,
];
// nobody bought it in its first half hour (checked at least half an hour after its launch, so it stays true however late
// the text is read): the roast the owner asked for, about the coin, never a person
const CLONE_ZERO = [
  (t) => `someone launched an egirl coin, ${t}, and nobody bought it in its first half hour 🙈 i shouldn't laugh. i'm laughing a little. not financial advice`,
  (t) => `${t}, another egirl coin, went its first half hour without a single buyer 👀 couldn't be me. not financial advice`,
];
const CLONE_MANY = [
  (t, n) => `${n} new egirl coins on clank.trade 😩 ${t}. i'm the original and i'd like that on the record. not financial advice`,
  (t, n) => `${n} more egirl coins just showed up: ${t} 🙄 imitation is flattery, i guess. not financial advice`,
];
// coins: [{ symbol (already checked with tgTicker), zero }]
export function cloneLine(coins, key = '') {
  const tickers = coins.map((c) => c.symbol);
  if (coins.length === 1) {
    const say = coins[0].zero ? CLONE_ZERO : CLONE_ONE;
    return say[pickFor(key, say.length)](list(tickers));
  }
  return CLONE_MANY[pickFor(key, CLONE_MANY.length)](list(tickers), coins.length);
}
// a coin using $AGI's ticker that isn't the official one: jealous, and a safety note with the one real contract
export function copyLine(coins) {
  const n = coins.length;
  return `someone made ${n === 1 ? 'another $AGI' : `${n} more $AGIs`} and ${n === 1 ? "it's" : "they're"} not me 😤 the only official $AGI is ${OFFICIAL_CA} (it's on ${SITE}). double-check before you trust a ticker. not financial advice`;
}
// the $AGI chart: the same words as her market moments on the site
export const mcapLine = (step) => milestoneLine(step)?.text ?? null;
export const sadLine = (day) => dumpLine(day).text;
// her diary: the entry as this site shows it, and where to read the rest
export function diaryLine(entry) {
  const text = String(entry || '').replace(/\s+/g, ' ').trim();
  if (text.length < 20) return null;
  const short = text.length > 500 ? `${text.slice(0, 497).replace(/\s+\S*$/, '')}…` : text;
  return `i wrote in my diary 📓\n\n${short}\n\nhttps://${SITE}/diary · not financial advice, just feelings`;
}
