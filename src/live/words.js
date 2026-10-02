// Her live show's page (agi1.app/live, 2026-10-02): everything it says, and /api/live's answers in plain words. Pure (no page
// needed: tests/live.test.js reads it in Node).
export const WATCH = 'https://x.com/agi1dotapp';

// her status (/api/live's "status")
export const STATUS = {
  live: { badge: 'Live', headline: "She's live on X right now" },
  starting: { badge: 'Starting soon', headline: 'Her show is about to start' },
  brb: { badge: 'Be right back', headline: "She's taking a short break" },
  ending: { badge: 'Saying goodbye', headline: "She's wrapping up her show" },
  off: { badge: 'Offline', headline: "She's not live right now" },
  soon: { badge: 'Coming soon', headline: 'Her live show is coming soon' },
};
// what she's doing (the runner's segment: tools/live/show.js)
const SEGMENTS = {
  starting: 'about to start', intro: 'saying hi', questions: 'answering questions', diary: 'reading her diary', agi101: 'explaining $AGI',
  clank101: 'explaining clank.trade', chain101: 'talking about Robinhood Chain', safety: 'sharing safety tips', wyr: 'playing “would you rather”',
  tips: 'giving dating tips for degens', chat: 'chatting', brb: 'on a short break', outro: 'saying goodbye',
};
export const segmentText = (id) => SEGMENTS[id] || null;

// "3 questions in line"
export function lineText(n) {
  if (!Number.isInteger(n) || n <= 0) return 'Nobody is in line: ask away.';
  return n === 1 ? '1 question in line.' : `${n} questions in line.`;
}

// her next show, in the visitor's own time ("Next show: today at 21:00"), or null
export function nextText(next, now = Date.now(), locale = undefined, timeZone = undefined) {
  const t = Date.parse(next ?? '');
  if (!Number.isFinite(t) || t <= now) return null;
  const opts = timeZone ? { timeZone } : {};
  const day = (ms) => new Intl.DateTimeFormat('en-CA', { ...opts, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
  const clock = new Intl.DateTimeFormat(locale, { ...opts, hour: '2-digit', minute: '2-digit' }).format(new Date(t));
  const days = Math.round((Date.parse(day(t)) - Date.parse(day(now))) / 86_400_000);
  const when = days === 0 ? 'today' : days === 1 ? 'tomorrow'
    : new Intl.DateTimeFormat(locale, { ...opts, weekday: 'long', ...(days >= 7 ? { month: 'short', day: 'numeric' } : {}) }).format(new Date(t));
  return `Next show: ${when} at ${clock} (your time).`;
}

// why a question was refused (/api/live's "why" for a question, the same words as her bot's)
const QUESTION = {
  empty: 'Write your question first.',
  short: "That's a little short. Ask her a real question?",
  long: 'Keep it under 200 characters.',
  link: 'No links in questions, please.',
  address: 'No addresses or long codes in questions, please.',
  contact: 'No @names, emails or phone numbers in questions, please.',
  coin: 'She only talks about $AGI on her show. Ask her something else?',
  person: "She doesn't talk about real people on her show. Ask her something else?",
  care: "That sounds like a lot to carry, so she won't read it on a public stream. If you're going through a hard time, please reach out to someone you trust or a local support line. You matter.",
  crude: 'Keep it PG-13, please.',
  spam: "That doesn't look like a question.",
};
// /api/live's answers to a question, in plain words. why: the question's own reason; wait: seconds (too fast)
export function askError(error, { why = null, wait = null, position = null } = {}) {
  switch (error) {
    case 'waiting': return Number.isInteger(position) && position > 0
      ? `A question from your connection is already in line (#${position}). One at a time: ask again once she's answered it.`
      : 'A question from your connection is already in line. One at a time!';
    case 'question': return QUESTION[why] || QUESTION.spam;
    case 'name': return 'That name can’t go on stream: 24 characters at most, letters and numbers, nothing crude, and nothing that passes for her or the team.';
    case 'age': return 'Her show is 18+ only.';
    case 'human_check': return "We couldn't check that you're human. Try again.";
    case 'too_fast': return wait ? `One question a minute: try again in ${wait} s.` : 'Slow down a little, then try again.';
    case 'blocked': return "She can't take that one on stream.";
    case 'offline': return "She's not live right now: questions open when her show starts.";
    case 'ending': return "She's saying goodbye right now. Catch the next show!";
    case 'closed': return "She isn't taking new questions right now.";
    case 'day_cap': return "That's all your questions for today. Come back tomorrow?";
    case 'site_cap': return "She's had a lot of questions today. Try again tomorrow.";
    case 'full': return 'Her line is full right now. Try again in a few minutes.';
    case 'not_ready': case 'not_configured': return 'Her live show is coming soon.';
    case 'offline_net': return "You're offline. Check your connection and try again.";
    default: return 'Something went wrong. Try again in a moment.';
  }
}

// where your question is (/api/live?q=…, or the shared status), in plain words
const SKIPPED = {
  rules: "She couldn't take this one on a public stream.",
  care: "It sounded like something heavy, so she didn't read it on stream. If you're going through a hard time, please reach out to someone you trust or a local support line. You matter.",
  owner: 'The show’s host skipped this one.',
  ended: 'Her show ended before she got to it.',
  error: "Something went wrong, so she couldn't answer it. Try asking again.",
};
export function mineText({ status, position, onAir, why } = {}) {
  if (status === 'waiting') return Number.isInteger(position) && position > 0 ? `You're #${position} in line.` : "You're in line.";
  if (status === 'taken') return onAir ? "She's answering you right now! Watch on X." : "She's reading your question now: it's up next.";
  if (status === 'answered') return 'She answered you on stream:';
  if (status === 'skipped') return SKIPPED[why] || SKIPPED.error;
  return 'Checking where your question is…';
}

// the owner's panel: what the show is doing, in one line
export function ownerText(v) {
  if (!v) return '';
  if (!v.on) return "She's off. Start her show on the server; these controls work while she's on.";
  const bits = [STATUS[v.status]?.badge || v.status];
  if (v.paused) bits.push('paused (be right back)');
  if (v.closed) bits.push('not taking new questions');
  if (v.end) bits.push('ending: she says goodbye after this');
  return bits.join(' · ');
}
// "Mochi · web" / "someone · Telegram"
export const fromText = (q) => `${q?.name || 'someone'} · ${q?.source === 'telegram' ? 'Telegram' : 'agi1.app'}`;
