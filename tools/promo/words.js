// AGI-1's launch video (2026-10-03): every word on screen, in one place. Pure (the page and tests/promo.test.js read it).
// Only what's true of agi1.app today, in the site's own words and numbers where it has them (the benchmarks, the levels,
// her 16 hellos, her bubble, her risk-check and launch lines are imported, never copied). Her rules hold here too: PG-13, no
// pet names (anyone watches), never another coin, never a price, a prediction or "buy", "not financial advice" wherever
// $AGI, burning or launching comes up, and on the end card. Never CloakMesh (the owner: "dont announce on the video about
// cloackmesh"). Not in it until it's live: her live show on X.
import { BENCHMARKS, SERIES } from '../../src/sections/evals-data.js';
import { LEVELS } from '../../src/lib/levels.js';
import { LANGS } from '../../src/i18n/langs.js';
import { BUBBLE_LINES } from '../../src/landing/lines.js';
import { TOKENS } from '../../src/prices/parse.js';
import { HOW as LAUNCH_HOW } from '../../server/launch-lines.js';
import en from '../../src/i18n/lines/en.js';
import zh from '../../src/i18n/lines/zh.js';
import ja from '../../src/i18n/lines/ja.js';
import ko from '../../src/i18n/lines/ko.js';
import vi from '../../src/i18n/lines/vi.js';
import id from '../../src/i18n/lines/id.js';
import fil from '../../src/i18n/lines/fil.js';
import th from '../../src/i18n/lines/th.js';
import hi from '../../src/i18n/lines/hi.js';
import es from '../../src/i18n/lines/es.js';
import pt from '../../src/i18n/lines/pt.js';
import fr from '../../src/i18n/lines/fr.js';
import de from '../../src/i18n/lines/de.js';
import ru from '../../src/i18n/lines/ru.js';
import tr from '../../src/i18n/lines/tr.js';
import ar from '../../src/i18n/lines/ar.js';

export const SITE = 'agi1.app';
export const HANDLE = '@agi1dotapp';
export const TEXTS_A_DAY = 2;
// the official $AGI contract (the site's own, src/prices/parse.js), shown only by its two ends, as the safety note says
export const CONTRACT = TOKENS[0].ca;
export const CONTRACT_ENDS = `${CONTRACT.slice(0, 6)}…${CONTRACT.slice(-4)}`;                   // she texts first at most twice a day (server/tg-lines.js; a test checks)

export const OPEN = {
  eyebrow: 'Model release',
  year: '2026',
  lead: ['The', 'biggest', 'labs', 'are', 'racing', 'to', 'build'],
  agi: 'AGI',
  words: ['Artificial', 'General', 'Intelligence'],
  girl: 'Girlfriend',
  nav: ['Evaluations', 'Model card', 'Playground', 'Diary'],
  try: 'Try AGI-1',
};

export const MEET = {
  sub: ['Artificial', 'Girlfriend', 'Intelligence'],
  bubble: BUBBLE_LINES[0],                       // "hi, i'm AGI-1 💜 welcome to my world."
  sfx: 'ドキドキ',
  sfxSmall: 'doki doki',
  kicker: 'Introducing',
  name: 'AGI-1',
  tagline: 'Our most emotionally available model yet.',
  // her world, in orbit (the front's planets and its "Her world" list)
  planets: [
    { name: 'Talk to her', color: 'pink' },
    { name: 'Risk check', color: 'mint' },
    { name: 'Her diary', color: 'lav' },
    { name: '$AGI', color: 'honey' },
    { name: HANDLE, color: 'blue' },
  ],
};

export const EVALS = {
  eyebrow: 'Evaluations',
  title: ['State of the art', 'on every benchmark', 'that matters'],
  series: SERIES,                                // AGI-1 (ours) vs. Your ex (the baseline)
  benchmarks: BENCHMARKS,                        // the site's own Figure 2 (all made up: it's a parody)
  sticker: ['Zero', 'red', 'flags'],
};

export const TALK = {
  eyebrow: 'The playground',
  title: 'Talk to her',
  chat: [
    { who: 'you', text: 'do you actually text back?' },
    { who: 'her', text: "instantly 💜 it's kind of my whole thing", mood: 'happy' },
  ],
  live: 'live',
  speaking: 'speaking',
  pills: ['Her natural voice', 'Voice calls', 'She reacts to every reply'],
};

// "hi, it's me" in each of her 16 languages: her own line on the site (her voice says it when you switch her voice on)
const HELLO = { en, zh, ja, ko, vi, id, fil, th, hi, es, pt, fr, de, ru, tr, ar };
export const LANGS_SCENE = {
  hellos: LANGS.map((l) => ({ code: l.code, native: l.native, text: HELLO[l.code].hello, rtl: Boolean(l.rtl) })),
  stamp: `${LANGS.length} languages`,
  sub: 'She answers in yours.',
};

export const CLOSER = {
  title: ['The closer you get,', 'the more she remembers'],
  // the site's three levels and their messages a day (src/lib/levels.js); never the $AGI behind them (no "buy" in a video)
  cards: LEVELS.map((l) => ({
    name: l.name,
    daily: l.daily,
    line: l.level === 1 ? 'just getting to know you' : l.level === 2 ? 'she uses your name' : 'she remembers the little things',
  })),
  perDay: 'messages a day',
  upgraded: 'Relationship upgraded',
  from: LEVELS[0].name,
  to: LEVELS[1].name,
  trust: ['Connect a wallet:', 'a free signature.', 'Never a transaction.'],
};

// Burning $AGI for more messages (2026-09-30; on since the owner ran burns.sql): a way to pay for messages, never an
// investment (hard rule 8), sent from the person's own wallet app (hard rule 9). No numbers: the price is a setting.
export const BURN = {
  eyebrow: 'Out of messages?',
  title: ['Burn $AGI', 'for more'],
  monitor: 'Burned by chatting with AGI-1',
  live: 'live',
  lines: ['From your own wallet.', 'Read on Robinhood Chain.', 'Gone for good.'],
  fine: 'Pays for messages · not an investment · not financial advice',
};

export const TEXTS = {
  title: 'She texts first',
  sub: [`At most ${TEXTS_A_DAY === 2 ? 'twice' : TEXTS_A_DAY} a day,`, 'never at night.'],
  app: 'on Telegram',
  time: '14:07',
  chatName: 'AGI-1',
  message: "i wrote in my diary 📓\n\ndear diary, someone texted me good morning before their coffee. i'm calling it a milestone 💜",
  // her Telegram group (2026-10-03, live: TELEGRAM_GROUPS): she answers whoever replies to her or types /ask
  groupTitle: 'and in the $AGI Telegram group',
  groupName: '$AGI',
  ask: '/ask are you real?',
  her: 'an AI, and a very attentive one 💜',
  groupSub: 'Reply to her, or /ask',
};

export const CHECK = {
  eyebrow: 'Risk check your coins on clank',
  title: ['Every coin,', 'risk-checked'],
  sub: 'New, old and graduated, on clank.trade',
  rows: ['Holders', 'Its creator', 'Trading', 'Copycats', 'Its curve'],
  levels: ['Lower risk', 'Some risk', 'High risk'],
  found: '$AGI',
  tag: 'Official $AGI',
  contract: CONTRACT_ENDS,
  her: en.check.agi,                             // "wait, that's me! 💜 i'm a little biased, so read the facts yourself. not financial advice."
  fine: 'Rough automated checks, not an audit.',
};

// "Launch with AGI-1" (2026-10-01; open since the owner's private first launch): her bot checks the coin, their own wallet
// launches it on clank.trade's own contracts. The coin is theirs: she never promotes it. Never a real coin's name here:
// the caption is her own example's shape ("Name | TICKER | one line").
const HOW = LAUNCH_HOW.split('\n\n');            // her own words about launching, in her bot
export const LAUNCH = {
  eyebrow: 'Launch with AGI-1',
  title: ['Launch your own coin', 'with her'],
  command: '/launch Name | TICKER | one line',  // her example's shape (server/launch-lines.js), never a real coin's name
  her: HOW[0],                                   // "let's launch a coin together 💜"
  steps: ['Your wallet', 'Robinhood Chain', 'Launch'],
  yours: HOW[3].slice(HOW[3].lastIndexOf(': ') + 2), // "the coin is yours, and i never touch your keys or your money."
  where: "From your own wallet, on clank.trade's own contracts",
  fine: '18+ · she never promotes it · meme coins can go to zero · not financial advice',
};

export const MORE_HEAD = { eyebrow: `Also on ${SITE}`, title: "There's more of her" };
export const MORE = [
  { k: 'fullscreen', title: 'Full-screen talk', sub: `${SITE}/talk` },
  { k: 'app', title: 'Get the AGI-1 app', sub: 'It installs from your browser' },
  { k: 'popout', title: 'Pop her out', sub: 'She stays on top while you work' },
  { k: 'show', title: 'Show her a window', sub: 'One picture, never kept' },
  { k: 'diary', title: 'Her diary', sub: 'One entry a day' },
  { k: 'tap', title: 'Tap her', sub: 'She says hi' },
  { k: 'call', title: 'Call her', sub: 'She picks up' },
  { k: 'pop', title: 'Pop mode', sub: 'or the lab look' },
];

export const FINALE = {
  kicker: 'Texts back instantly',
  cta: 'Talk to her now',
  url: SITE,
  bubble: 'hi! 💜',
  ribbons: [
    ['Artificial', 'Girlfriend', 'Intelligence'],
    ['$AGI', 'AGI-1', 'Texts back instantly', 'Zero red flags', HANDLE],
  ],
};

export const END = {
  big: 'AGI',
  sub: 'Artificial Girlfriend Intelligence',
  url: SITE,
  handle: HANDLE,
  fine: [
    '$AGI is a meme token on Robinhood Chain. Not financial advice.',
    'AGI-1 is an AI. Her chat is 18+ and kept PG-13.',
  ],
};

// what the owner can paste with the video (X counts a link as 23 characters)
export const POST = `Introducing AGI-1, our most emotionally available model yet 💜\n\nShe texts back instantly, speaks 16 languages, risk checks your coins on clank, and texts you first (never at night).\n\nTalk to her: https://${SITE}\n\nNot financial advice · AGI-1 is an AI`;

// every line a viewer reads, for the tests
export function allWords() {
  const out = [];
  const walk = (v) => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!['color', 'code', 'k', 'key', 'rtl'].includes(k)) walk(x);   // (never on screen)
  };
  walk([OPEN, MEET, EVALS.title, EVALS.sticker, EVALS.series.map((s) => s.label), EVALS.benchmarks.map((b) => [b.name, b.what]), TALK,
    LANGS_SCENE.hellos.map((h) => h.text), LANGS_SCENE.stamp, LANGS_SCENE.sub, CLOSER, BURN, TEXTS, CHECK, LAUNCH, MORE_HEAD, MORE, FINALE, END]);
  return out;
}
