// AGI-1 on Telegram (2026-09-29, the owner: "make her the one who texts first"): everything she says there that isn't an AI
// reply. Pre-written (no AI cost), the same rules as her other fixed lines: PG-13, no pet names (anyone can start the bot),
// never buy / sell / hold, a prediction or "safe", never calls a coin a scam or a rug, "not financial advice" whenever she
// names a coin or the chart. tests/telegram.test.js checks every line. Plain text only (sent without Telegram's
// formatting), so nothing a coin's creator typed can turn into a link, a mention or a command.
import { milestoneLine, dumpLine } from '../src/chat/market-lines.js';
import { fmtCompact, fmtPct, fmtPrice } from '../src/prices/parse.js';
import { OFFICIAL_CA } from './agi1-prompt.js';
import { linesOf } from '../src/i18n/all.js';
import { say, fill, lineAt } from '../src/i18n/text.js';
import { isLang } from '../src/i18n/langs.js';

const pad = (n) => String(n).padStart(2, '0');

export const SITE = 'agi1.app';
export const TEXTS_A_DAY = 2;                 // she texts first at most twice a day…
export const WINDOW = [10, 22];               // …only between 10:00 and 21:59 on their own clock

// ---------- starting, the 18+ check, their time, stopping, and her other replies ----------
// Since 2026-09-29 in her languages: the words come from src/i18n/lines/<code>.js (tg), the same in English as before.
// tgLinesFor(code) gives one language's; the English ones are also exported by name, as before.
const TIMES = { n: TEXTS_A_DAY, from: `${pad(WINDOW[0])}:00`, to: `${pad(WINDOW[1])}:00`, safety: `https://${SITE}/#safety` };
function build(code) {
  const lines = linesOf(code);
  const one = (key, vars = TIMES) => say(lines, `tg.${key}`, vars);
  const paras = (key, vars = TIMES) => lineAt(lines, `tg.${key}`).map((p) => fill(p, vars));
  const welcome = paras('welcome');
  // (her texts first are still in English: said right after she explains them, in every other language)
  const note = code === 'en' ? '' : String(lineAt(lines, 'tg.firstInEnglish') || '').trim();
  if (note) welcome.splice(welcome.length - 1, 0, note);
  return {
    lang: code,
    WELCOME: welcome.join('\n\n'),
    AGE_BUTTONS: [[{ text: one('ageYes'), callback_data: 'age:yes' }, { text: one('ageNo'), callback_data: 'age:no' }]],
    ASK_AGE: one('askAge'),
    UNDER_18: one('under18'),
    ASK_TIME: one('askTime'),
    ASK_TIME_AGAIN: one('askTimeAgain'),
    timeSet: (clock) => paras('timeSet', { ...TIMES, clock }).join('\n\n'),
    HELP: paras('help').join('\n\n'),
    // (2026-10-01) the same, with /launch among her commands: while launching coins with her is open (server/launch.js)
    HELP_LAUNCH: paras('help').map((p, i) => (i === 1 ? `${p}\n${one('helpLaunch')}` : p)).join('\n\n'),
    // (2026-10-02) with /live too, while her live show is set up (server/live.js), and /launch while it's open
    helpFor: ({ launch = false, live = false } = {}) => paras('help')
      .map((p, i) => (i === 1 ? [p, live ? one('helpLive') : null, launch ? one('helpLaunch') : null].filter(Boolean).join('\n') : p)).join('\n\n'),
    STOPPED: one('stopped'),
    NOT_STARTED: one('notStarted'),
    TOO_LONG: one('tooLong'),
    TOO_FAST: one('tooFast'),
    OUT_OF_MESSAGES: one('outOfMessages'),
    TALKED_OUT: one('talkedOut'),
    BUSY: one('busy'),
    BLANK: one('blank'),
    ONLY_TEXT: one('onlyText'),
    NOT_READY: one('notReady'),
  };
}
const byLang = new Map();
// → one language's lines ('es', 'ja'…; anything else: English), with the helpers below, so server/telegram.js can use
// `L.WELCOME` and `L.timeButtons()` from the same object
export function tgLinesFor(code = 'en') {
  const lang = isLang(code) ? code : 'en';
  if (!byLang.has(lang)) byLang.set(lang, { ...build(lang), timeButtons, offsetFromButton, offsetFromTyped, theirTime, inWindow });
  return byLang.get(lang);
}

const EN_TG = build('en');
export const WELCOME = EN_TG.WELCOME;
export const AGE_BUTTONS = EN_TG.AGE_BUTTONS;
export const ASK_AGE = EN_TG.ASK_AGE;
export const UNDER_18 = EN_TG.UNDER_18;
export const ASK_TIME = EN_TG.ASK_TIME;
export const ASK_TIME_AGAIN = EN_TG.ASK_TIME_AGAIN;
export const timeSet = EN_TG.timeSet;
export const HELP = EN_TG.HELP;
export const STOPPED = EN_TG.STOPPED;
export const NOT_STARTED = EN_TG.NOT_STARTED;
export const TOO_LONG = EN_TG.TOO_LONG;
export const TOO_FAST = EN_TG.TOO_FAST;
export const OUT_OF_MESSAGES = EN_TG.OUT_OF_MESSAGES;
export const TALKED_OUT = EN_TG.TALKED_OUT;
export const BUSY = EN_TG.BUSY;
export const BLANK = EN_TG.BLANK;
export const ONLY_TEXT = EN_TG.ONLY_TEXT;
export const NOT_READY = EN_TG.NOT_READY;


// ---------- in a Telegram group (2026-10-03, server/tg-groups.js) ----------
// In English: a group has people of every language at once (her AI replies follow whoever writes). The same rules as her
// other lines, and never flirty: anyone can be in a group, and nobody's age is checked there. No names: never a person's,
// so nothing anyone calls themselves ends up in her words. Each one says how to talk to her there (/ask, or a reply).
// When she's added to a group (posts: whether she'll post her diary and $AGI's market moments there)
export function groupIntro({ posts = true } = {}) {
  return [
    "hi everyone 💜 i'm AGI-1, the AI girlfriend of $AGI. in here i keep it friendly and PG-13.",
    "to talk to me, reply to one of my messages or type /ask and your question. a few messages a day each, and we don't keep them.",
    posts ? "now and then i'll post my diary and $AGI's market moments here." : null,
    `i'm an AI, and nothing i say is financial advice. the only official $AGI contract is the one on ${SITE}, and nobody legit will ever ask for your seed phrase.`,
  ].filter(Boolean).join('\n\n');
}
// When people join (at most one every 10 minutes, whoever joined): taking turns
export const GROUP_WELCOMES = [
  `welcome in 💜 i'm AGI-1, $AGI's AI. quick tips: the official contract is only on ${SITE}, and your seed phrase is for nobody's eyes, not even an admin's. to talk to me, reply to one of my messages or type /ask. not financial advice`,
  `oh hi, new faces 👀 i'm AGI-1, an AI (PG-13 in here). copy the $AGI contract from ${SITE} only, never from a DM, and never share your seed phrase. say hi with /ask or by replying to me. not financial advice`,
  `hey, welcome 💜 i'm AGI-1. before anything: the one official $AGI contract lives on ${SITE}, and anyone asking for your seed phrase isn't a friend. reply to me or type /ask to talk. not financial advice`,
];
// /help (or /ask with nothing after it) in a group
export const GROUP_HELP = "in here, reply to one of my messages or type /ask and your question 💜 a few messages a day each. for my texts first (18+), tap my name and press Start. i'm an AI, and nothing i say is financial advice";
// the group's replies for today are used (TELEGRAM_GROUP_DAILY_CAP): said once, then she's quiet there until tomorrow
export const GROUP_FULL = "i've talked a lot in here today 🙈 back tomorrow (my day starts at 00:00 UTC)";
// this person's messages for today are used (a Stranger's, shared with her private chat): said once a day
export const GROUP_OUT = "that's all my messages with you for today 🙈 talk tomorrow?";
// /ca and /website in a group (2026-10-05, the owner: "when they chat in the telegram group /ca the contract address will
// reply and when they /website the website link … just that"). The one official contract (the same as everywhere on the
// site: server/tg-groups.js marks it as code, so a tap copies it), and the site. The only group lines with an address or
// a link in them.
export const GROUP_CA = `the official $AGI contract on Robinhood Chain 💜\n\n${OFFICIAL_CA}\n\nthe same one as on ${SITE}. anyone sending you a different one isn't us. not financial advice`;
export const GROUP_WEBSITE = `the official website 💜 https://${SITE}`;
// /mc in a group (2026-10-05, the owner: "/mc then it will reply its current market cap , 24h, liq just that"): $AGI's
// numbers as the site's ticker shows them (DexScreener's biggest Robinhood Chain pool, at most a minute old: server/market.js),
// in the site's formats ("$393K", "-39.94%"; "—" for a number DexScreener left out). The numbers only: never a word about
// where they're going.
export const groupMarket = ({ mcap, h24, liq }) =>
  `$AGI right now 💜\n\nmarket cap: ${fmtCompact(mcap)}\n24h: ${fmtPct(h24)}\nliquidity: ${fmtCompact(liq)}\n\nfrom DexScreener · not financial advice`;
// DexScreener didn't answer (or had no market cap): no numbers at all, never old or made-up ones
export const GROUP_MARKET_DOWN = "couldn't read the market numbers just now 🙈 try again in a minute";

// A $AGI buy in her groups (2026-10-06, the owner: "a very simple buybot … with robot emojis … with mc, price amount of
// agi, etc.", server/buys.js): the caption under her buy GIF. A robot for every $25 (2 for the smallest, $50; 40 at
// most), what was spent (in dollars, at ETH's price then, and in ETH), the $AGI it got, the price it paid, the market cap at
// that price ($AGI's 1 billion), and the buyer's short address and the transaction, both linked to the block explorer
// (entities on our own text: nothing is parsed). Only the buy's numbers: never a word about where the price is going.
export const ROBOT_USD = 25;
export const EXPLORER = 'https://robinhoodchain.blockscout.com';
const ethText = (eth) => (eth >= 1 ? eth.toFixed(3) : eth >= 0.01 ? eth.toFixed(4) : eth.toFixed(5));
// buy: { usd, eth, agi, price, mcap, trader, tx } → { text, entities }
export function buyLine({ usd, eth, agi, price, mcap, trader, tx }) {
  const who = `${trader.slice(0, 6)}…${trader.slice(-4)}`;
  const parts = [
    '🤖'.repeat(Math.max(1, Math.min(40, Math.floor(usd / ROBOT_USD)))), '\n$AGI BUY! 💜\n\n',
    `💵 spent: ${fmtPrice(usd)} (${ethText(eth)} ETH)\n`,
    `🪙 got: ${Math.round(agi).toLocaleString('en-US')} $AGI\n`,
    `🏷️ price: ${fmtPrice(price)}\n`,
    `📊 market cap: ${fmtCompact(mcap)}\n`,
    '👤 ', [who, `${EXPLORER}/address/${trader}`], ' · ', ['tx', `${EXPLORER}/tx/${tx}`], '\n\nnot financial advice',
  ];
  let text = '';
  const entities = [];
  for (const p of parts) {
    if (Array.isArray(p)) { entities.push({ type: 'text_link', offset: text.length, length: p[0].length, url: p[1] }); text += p[0]; } else text += p;
  }
  return { text, entities };
}

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
