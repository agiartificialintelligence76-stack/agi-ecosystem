// Her recorded lines (2026-09-26): her fixed lines ("hi, it's me", the out-of-messages lines, "come back tomorrow", the sad
// market lines) are kept in the database once Google has made them (supabase/voice-lines.sql), so they never need Google
// again: not after a new deployment (which empties Vercel's CDN), not when Google's daily limit for the speech model is
// used up. api/voice.js asks here first. Nothing here ever throws: if the database can't help, Google makes the line as
// before. Her market-cap lines aren't kept (they come and go with the market).
import { createHash, randomBytes } from 'node:crypto';
import { rpc } from './limits.js';
import { isWav } from './voice.js';

const PART = 200_000;                    // base64 characters per database call (about 150 KB of sound, 3 seconds)
const NOT_SET_UP_WAIT = 10 * 60_000;     // voice-lines.sql not run yet: don't ask again for 10 minutes
const DOWN_WAIT = 30_000;                // the database didn't answer: let it be for half a minute
let notSetUpUntil = 0;
export function resetStoreForTests() { notSetUpUntil = 0; }

// Which recording: the line's name + a fingerprint of everything that changes how it sounds (the words, the style, the
// voice, the model). If any of them changes, it's a new recording: an old one is never played by mistake.
export const lineId = (cfg, key, words, style) =>
  `${key}-${createHash('sha256').update([cfg.voiceModel, cfg.voiceName, style, words].join('\n')).digest('hex').slice(0, 16)}`;

const usable = (cfg) => Boolean(cfg.supabaseUrl && cfg.supabaseKey) && Date.now() >= notSetUpUntil;
function trouble(err, what) {
  if (err?.code === 'PGRST202') {
    notSetUpUntil = Date.now() + NOT_SET_UP_WAIT;
    console.error(`[voice] her lines aren't kept yet (${what}): run supabase/voice-lines.sql in Supabase. Until then Google makes them after each deployment`);
  } else {
    notSetUpUntil = Math.max(notSetUpUntil, Date.now() + DOWN_WAIT);
    console.error(`[voice] her kept lines are unavailable right now (${what}): ${err?.message}`);
  }
}

// → the WAV file, or null (not kept yet, only half saved, or the database can't answer)
export async function loadLine(cfg, id) {
  if (!usable(cfg)) return null;
  try {
    const b64 = await rpc(cfg, 'voice_line_get', { p_id: id }, 'voice lines');
    if (typeof b64 !== 'string' || !b64) return null;
    const wav = Buffer.from(b64, 'base64');
    return isWav(wav) && wav.length > 44 ? wav : null;
  } catch (err) {
    trouble(err, 'reading');
    return null;
  }
}

// Keep a WAV file Google just made (in parts, all at once). → true when it was all saved.
export async function saveLine(cfg, id, wav) {
  if (!usable(cfg)) return false;
  const b64 = Buffer.from(wav).toString('base64');
  const parts = Math.ceil(b64.length / PART);
  const take = randomBytes(6).toString('hex');
  try {
    const answers = await Promise.all(Array.from({ length: parts }, (_, part) => rpc(cfg, 'voice_line_put', {
      p_id: id, p_take: take, p_part: part, p_parts: parts, p_data: b64.slice(part * PART, (part + 1) * PART),
    }, 'voice lines')));
    const odd = answers.find((a) => a !== 'ok');
    if (odd !== undefined) throw new Error(`voice lines: unexpected answer ${String(odd).slice(0, 20)}`);
    return true;
  } catch (err) {
    trouble(err, 'saving');
    return false;
  }
}
