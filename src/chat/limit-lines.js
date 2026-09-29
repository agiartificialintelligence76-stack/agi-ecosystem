// Out of messages for today (2026-09-25, the owner's request): when a Stranger or a Crush has used their messages, AGI-1
// says, in her own natural voice, that $AGI in a connected wallet unlocks more messages a day, says "not financial advice",
// and offers the free option too (tomorrow). The page shows a short safety note under it (src/chat/chat.js).
// This is the only place the site suggests getting $AGI: the owner's exception to "no buy advice" (CLAUDE.md, hard rule 8).
// Her AI replies still never suggest buying anything. Soulmates are already at the top level, and "the whole site is out
// for today" can't be fixed by buying, so neither gets this line.
// Pre-written, so it costs nothing (no AI call), and the same for everyone, so her voice for each line is made once and
// kept by the CDN (/api/voice?line=more-1, api/voice.js). Never guilt-tripping, never about prices or gains:
// tests/limit.test.js checks it.
// In her languages (2026-09-29): the words come from src/i18n/lines/<code>.js (English: src/i18n/lines/en.js), the numbers
// written the way that language writes them; each line carries its language (`lang`), so her voice says that one.
import { LEVELS } from '../lib/levels.js';
import { EN, say, levelVars } from '../i18n/text.js';

const KEYS = { 1: ['more-1', 'limit.more1'], 2: ['more-2', 'limit.more2'] };
const REST = { person: ['sleep', 'limit.sleep'], site: ['talked-out', 'limit.talkedOut'] };

// → { key, text, lang } for this level in these lines (a language's), or null (Soulmate, or an unknown level)
export function limitLineIn(level, lines = EN, lang = 'en') {
  if (!Number.isInteger(level) || !KEYS[level]) return null;
  const [key, path] = KEYS[level];
  return { key, text: say(lines, path, levelVars(LEVELS, lang)), lang };
}
// her short "come back tomorrow" lines: 'person' (this visitor's messages are used up and she made her offer today, or a
// Soulmate) or 'site' (the whole site is out for today)
export function restLineIn(kind, lines = EN, lang = 'en') {
  const [key, path] = REST[kind] || REST.person;
  return { key, text: say(lines, path), lang };
}
export const finePrintIn = (lines = EN) => say(lines, 'limit.finePrint');

// ---------- in English, as before ----------
export const LIMIT_LINES = { 1: limitLineIn(1), 2: limitLineIn(2) };
// Her short lines when she can't write any more today, spoken too (the owner, 2026-09-25: "i just want her to speak the same
// words with her natural voice"): `person` when this visitor's messages are used up and she already made her offer today (and
// always for Soulmates, already at the top), `site` when the whole site is out for today. Fixed lines like the ones above.
export const REST_LINES = { person: restLineIn('person'), site: restLineIn('site') };
// The safety note under her line.
export const LIMIT_FINE_PRINT = finePrintIn();
// → { key, text, lang } for this level, or null (Soulmate, or an unknown level)
export const limitLine = (level) => (Number.isInteger(level) && LIMIT_LINES[level]) || null;
