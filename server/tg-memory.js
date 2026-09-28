// AGI-1's memory of the clank.trade (ex daos.fun) Telegram group (Phase 6). The cards are built by
// tools/memory/build-memory.mjs from the owner's Telegram export: hand-written lore (eras, running jokes, big moments)
// plus one short card per active member. AGI-1 only gets them when the visitor asks about the group, or mentions
// something or someone from it; for every other message nothing is added (and nothing extra is paid to Gemini).
import MEMORY from './tg-memory-data.js';

const MAX_CARDS = 4;
const MAX_CHARS = 1800;               // about 450 tokens of notes, only on messages that use the memory

// "clank.trade" and "clank trade" should match the same key, "/buy_djai" should match "/buy": dots and underscores
// become spaces, and $ / @ stay (they're part of tickers, commands and handles)
const normText = (s) => String(s || '').toLowerCase().normalize('NFKC').replace(/[._]+/g, ' ').replace(/[^\p{L}\p{N}$@/ ]+/gu, ' ').replace(/\s+/g, ' ').trim();
const normName = (s) => String(s || '').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
const pad = (s) => ` ${s} `;
// "what else do you remember about him?": a follow-up can lean on the visitor's previous message
const FOLLOW_UP = /\b(him|her|them|they|he|she|that|those|more|else|also|again|remember)\b/i;

const LORE = MEMORY.cards.filter((c) => c.kind === 'lore').map((c) => ({ ...c, norm: c.keys.map(normText).filter(Boolean) }));
const MEMBERS = MEMORY.cards.filter((c) => c.kind === 'member');
const byId = Object.fromEntries(MEMORY.cards.map((c) => [c.id, c]));

function score(text, weight, into) {
  const t = pad(normText(text)), n = pad(normName(text));
  for (const c of LORE) {
    for (const k of c.norm) if (t.includes(pad(k))) into.set(c, (into.get(c) || 0) + weight * (2 + k.split(' ').length));
  }
  for (const c of MEMBERS) {
    for (const a of c.aliases) if (n.includes(pad(a))) into.set(c, (into.get(c) || 0) + weight * 6);
  }
}

// → the few cards that fit what the visitor wrote (best first), or [] when the message isn't about the group
export function recallGroup(message, previous = '') {
  const found = new Map();
  score(message, 1, found);
  if (previous && FOLLOW_UP.test(message)) score(previous, 0.5, found);
  if (!found.size) return [];
  const picked = [...found.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  // just "tell me about the telegram group": give her a bit of material to be funny with
  if (picked.length === 1 && picked[0].id === 'overview') picked.push(byId['era-frenzy'], byId['era-clank'], byId['joke-commands']);
  const out = [];
  let chars = 0;
  for (const c of picked) {
    if (!c || out.length >= MAX_CARDS || chars + c.text.length > MAX_CHARS) continue;
    out.push(c);
    chars += c.text.length;
  }
  return out;
}

export const memorySource = MEMORY.source;
