// AGI games' player name (2026-10-22, the owner: "they can enter their custom name before playing just like in the real
// terminal (just optional)"): one name for every game, kept in this browser only (localStorage `agi_player_name`), never
// required. It shows on the player's own screens and cards, and (with the leaderboards) next to their checked runs, where
// our server checks it again first (server/arcade.js reviewName(): the site's rules for a name). The page's check is those
// rules in short: 1 to 24 characters of letters (any alphabet), numbers, spaces, emoji and a little punctuation; never a
// link, an address, an email, a long number, or a name that passes for AGI-1, her team or a moderator. Pure apart from the
// storage it's handed: read in Node by tests/trench-game.test.js.
export const NAME_KEY = 'agi_player_name';
export const NAME_MAX = 24;

const NAME_CHARS = /^[\p{L}\p{M}\p{N}\p{Extended_Pictographic}‍️ '\-_.!?&]+$/u;
const HAS_WORD = /[\p{L}\p{N}\p{Extended_Pictographic}]/u;
// (the live show's: a name that passes for her, her team or the show's host, checked with its words split apart)
const POSING = /\b(?:agi(?:\s*(?:1|one|team))?|the\s*team|team|admin|administrator|moderator|mod|mods|official|support|staff)\b/i;
const LINKISH = /https?:|www\.|\.(?:com|net|org|io|app|fun|xyz|gg|co|me|ai|dev|so|to|tv|ly|sh|link|site|online|club|top|finance|money|exchange|trade|bet|win|vip|pro|info|biz|us|uk)\b/i;
const NUMBERISH = /0x[0-9a-f]{4,}|\d{7,}/i;
const EMAILISH = /\S@\S/;

// what it says, tidied: no control or invisible characters (an emoji's joiner stays), one space between words
export const tidyName = (raw) => String(raw ?? '').normalize('NFC')
  .replace(/[\u0000-\u001f\u007f-\u009f​‌‎‏‪-‮⁠-⁤﻿]/g, '')
  .replace(/\s+/g, ' ').trim();
// its words split apart ("AGI1official" is "AGI 1 official", "real_agi_1" is "real agi 1")
const split = (s) => s.replace(/[_.\-]+/g, ' ').replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2')
  .replace(/(\p{L})(\p{N})/gu, '$1 $2').replace(/(\p{N})(\p{L})/gu, '$1 $2');

// → { ok: true, name } (null: no name, which is fine) or { ok: false }
export function cleanName(raw) {
  const name = tidyName(raw);
  if (!name) return { ok: true, name: null };
  if ([...name].length > NAME_MAX || !NAME_CHARS.test(name) || !HAS_WORD.test(name)) return { ok: false };
  if (POSING.test(split(name)) || LINKISH.test(name) || NUMBERISH.test(name) || EMAILISH.test(name)) return { ok: false };
  return { ok: true, name };
}

// the name this browser kept (null: none, or one that no longer passes)
export function loadName(storage) {
  try {
    const n = cleanName(storage ? storage.getItem(NAME_KEY) : '');
    return n.ok ? n.name : null;
  } catch {
    return null;
  }
}

// kept (or forgotten, for an empty one) → { ok: true, name } or { ok: false } (nothing changed); `saved` false when
// storage is blocked (the name still works for this visit)
export function saveName(storage, raw) {
  const n = cleanName(raw);
  if (!n.ok) return { ok: false };
  let saved = false;
  try {
    if (storage) {
      if (n.name) storage.setItem(NAME_KEY, n.name);
      else storage.removeItem(NAME_KEY);
      saved = true;
    }
  } catch {
    saved = false;
  }
  return { ok: true, name: n.name, saved };
}
