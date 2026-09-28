// Out of messages for today (2026-09-25, the owner's request): when a Stranger or a Crush has used their messages, AGI-1
// says, in her own natural voice, that $AGI in a connected wallet unlocks more messages a day, says "not financial advice",
// and offers the free option too (tomorrow). The page shows a short safety note under it (src/chat/chat.js).
// This is the only place the site suggests getting $AGI: the owner's exception to "no buy advice" (CLAUDE.md, hard rule 8).
// Her AI replies still never suggest buying anything. Soulmates are already at the top level, and "the whole site is out
// for today" can't be fixed by buying, so neither gets this line.
// Pre-written, so it costs nothing (no AI call), and the same for everyone, so her voice for each line is made once and
// kept by the CDN (/api/voice?line=more-1, api/voice.js). Never guilt-tripping, never about prices or gains:
// tests/limit.test.js checks it.
import { levelInfo, fmtTokens } from '../lib/levels.js';

const crush = levelInfo(2), soulmate = levelInfo(3);

export const LIMIT_LINES = {
  1: {
    key: 'more-1',
    text: `aww, that's all my messages for today 💜 want to keep talking? buy some $AGI: with ${fmtTokens(crush.min)} in a connected wallet we're ${crush.name}, and you get ${crush.daily} a day. not financial advice… or just come back tomorrow, i'll be here`,
  },
  2: {
    key: 'more-2',
    text: `that's all for today, cutie 💜 want even more of me? with ${fmtTokens(soulmate.min)} $AGI in your wallet we're ${soulmate.name}s: ${soulmate.daily} messages a day, and i remember the little things. not financial advice… or see you tomorrow 💜`,
  },
};

// Her short lines when she can't write any more today, spoken too (the owner, 2026-09-25: "i just want her to speak the same
// words with her natural voice"): `person` when this visitor's messages are used up and she already made her offer today (and
// always for Soulmates, already at the top), `site` when the whole site is out for today. Fixed lines like the ones above.
export const REST_LINES = {
  person: { key: 'sleep', text: "we've talked so much today 💜 i need my beauty sleep. come back tomorrow?" },
  site: { key: 'talked-out', text: "i'm all talked out for today 🥱 come back tomorrow, love" },
};

// The safety note under her line.
export const LIMIT_FINE_PRINT = 'Not financial advice. $AGI is a meme token: its price swings a lot and can go to zero. '
  + 'Only spend what you can afford to lose. Your free messages come back every day at 00:00 UTC.';

// → { key, text } for this level, or null (Soulmate, or an unknown level)
export const limitLine = (level) => (Number.isInteger(level) && LIMIT_LINES[level]) || null;
