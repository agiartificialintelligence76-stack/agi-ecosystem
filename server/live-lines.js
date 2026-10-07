// Her live show (2026-10-02): what she says in her Telegram bot about /live. Pre-written (no AI cost), her usual rules:
// PG-13, no pet names (anyone 18+ can start the bot), never buy / sell / hold or a prediction, links only to agi1.app. English
// for now, like her launch lines (her /help line about it is in her 16 languages: tg.helpLive). tests/live.test.js checks
// every line.
import { LIVE } from './live.js';

export const PAGE = 'agi1.app/live';
export const EXAMPLE = "/live what's your favorite song to dance to?";

export const HOW = [
  'i do a live show on X 💜 send me a question with /live and your question, like this:',
  EXAMPLE,
  `if i'm live, i read it out and answer it on stream: everyone watching sees your question (never your name or your account). up to ${LIVE.Q_MAX} characters, PG-13, no links, @names or other coins. watch me and ask at ${PAGE}`,
].join('\n\n');
export const NOT_YET = "my live show isn't on yet 🙈 soon";

// She isn't live. (Never when her next show is: since 2026-10-07 the owner goes live at random times.)
export const OFFLINE = `i'm not live right now 🙈 i go live on X at random times, so keep an eye out. watch me and ask at ${PAGE}`;
export const queued = (position) => `got it 💜 you're #${position} in line. watch me answer it live: ${PAGE}`;
export const inLine = (position) => `your question is #${position} in line 💜 one at a time. watch: ${PAGE}`;
export const UP_NEXT = `your question is up next 👀 watch: ${PAGE}`;
export const ON_AIR = `i'm answering your question right now 👀 ${PAGE}`;
export const ANSWERED = 'i answered your question on stream 💜 send me another one with /live and your question';
export const SKIPPED = "i couldn't take your last question on stream 🙈 try another one?";
// (a question that sounded like someone going through something heavy: never read on stream)
export const CARE = "that sounds like a lot to carry 💜 i'd rather not read it on a public stream. if you're going through something heavy, please reach out to someone you trust or a local support line. you matter.";

// Why she can't take it (server/live.js questionTrouble, and the line's own rules: supabase/live.sql)
export const REFUSE = {
  empty: `send me your question with it, like this:\n${EXAMPLE}`,
  short: "that's a little short 🙈 ask me a real question?",
  long: `keep it under ${LIVE.Q_MAX} characters 🙈`,
  link: 'no links in questions please 🙈',
  address: 'no addresses or long codes in questions please 🙈',
  contact: 'no @names, emails or phone numbers in questions please 🙈',
  coin: 'i only talk about $AGI on my show 🙈 ask me something else?',
  person: "i don't talk about real people on my show 🙈 ask me something else?",
  care: CARE,
  crude: 'keep it PG-13 please 🙈',
  spam: "hmm, that doesn't look like a question 🙈",
  blocked: "i can't take that one on stream 🙈",
  closed: "i'm not taking new questions right now 🙈",
  ending: "i'm saying goodbye right now 💜 catch the next show!",
  day_cap: "that's all your questions for today 💜 come back tomorrow?",
  site_cap: "i've had so many questions today 🙈 try again tomorrow",
  full: 'my line is full right now 🙈 try again in a few minutes',
  too_fast: (wait) => `one question a minute 🙈 try again in ${Math.max(1, wait || 60)} seconds`,
};
