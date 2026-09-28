// Helpers for clank.trade coins, used by ClankChecker (server/checker.js): cleaning a coin's name, telling crude names
// apart, checking a coin picture really is one, reading an answer only up to a size, and the name our server gives itself.
// (Until 2026-09-28 this file was also the Arena's coin list and nominations; they left with the Arena.)

// ---------- names ----------
// Names: no invisible or direction-changing characters, single spaces, at most 40 characters.
const INVISIBLE = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u206f\\ufeff]', 'g');
export function cleanName(raw) {
  const s = String(raw ?? '').normalize('NFKC')
    .replace(INVISIBLE, '')
    .replace(/\s+/g, ' ').trim();
  if (!s) return null;
  const chars = [...s];
  return chars.length > 40 ? `${chars.slice(0, 39).join('').trimEnd()}…` : s;
}
// Crude and sexual words (and slurs): ClankChecker (2026-09-26) shows every clank.trade coin, crude names too (the owner's
// choice), but a coin with a crude or sexual name only shows its picture after the 18+ check.
const BLOCKED = /(fuck|porn|hentai|onlyfans|pawg|cunt|whore|slut|milf|nude|naked|xxx|boob|titties|pussy|penis|vagina|horny|blowjob|dildo|sexy|sexual|nigg|faggot|hitler|nazi|rapist)|\b(sex|anal|cum|tits?|cock|dick|rape|fag|retard|kkk)\b/i;
export const isCrude = (text) => BLOCKED.test(String(text));

// ---------- pictures (ClankChecker's coin pictures) ----------
export const PICTURE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']);
export const PICTURE_MAX_BYTES = 1_000_000;
// The file really is the picture type it claims (the first bytes of every format are fixed). Never SVG (it can carry code).
export function looksLike(type, b) {
  const at = (i, s) => b.length >= i + s.length && [...s].every((ch, k) => b[i + k] === ch.charCodeAt(0));
  if (type === 'image/png') return b[0] === 0x89 && at(1, 'PNG');
  if (type === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (type === 'image/gif') return at(0, 'GIF8');
  if (type === 'image/webp') return at(0, 'RIFF') && at(8, 'WEBP');
  if (type === 'image/avif') return at(4, 'ftyp');
  return false;
}

// ---------- reading clank.trade ----------
// The name our server gives itself when it reads clank.trade and its picture host, so they can see who's asking.
export const UA = 'Mozilla/5.0 (compatible; ClankChecker/1.0; +https://agi1.app)';

// Reads at most `max` bytes of an answer. `cut`: keep the start of a bigger answer (a web page), else give up (null).
export async function readLimited(res, max, { cut = false } = {}) {
  const reader = res.body?.getReader?.();
  if (!reader) return Buffer.alloc(0);
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (size + value.length > max) {
      reader.cancel().catch(() => {});
      if (!cut) return null;
      chunks.push(value.subarray(0, max - size));
      break;
    }
    chunks.push(value);
    size += value.length;
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}
