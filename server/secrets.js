// A secret sent to AGI-1 by mistake (2026-10-09, with her games' prizes, which ask winners for a wallet address): a
// wallet's private key or its seed phrase. Wherever people write to her and it could go further (her private chat, /ask in
// her groups, a question for her live show, which she reads out loud on stream), it's caught first: she warns them, and
// nothing of it goes to the AI, the database or the stream. Never kept, never logged.
// (light: only the wallet word list, so agi1.app/live's own checks can use it too)
import { wordlist } from '@scure/bip39/wordlists/english';

const WORDS = new Set(wordlist);
// → 'key' (64 hex characters: a private key, or a transaction's id, which looks the same) · 'seed' (12 or more words of the
// wallet word list in a row: everyday sentences never have that many) · null
export function secretIn(text) {
  const s = String(text ?? '');
  if (/(?:^|[^0-9a-fA-Fx])(?:0x)?[0-9a-fA-F]{64}(?![0-9a-fA-F])/.test(s)) return 'key';
  let run = 0;
  for (const w of s.toLowerCase().match(/[a-z]+/g) || []) {
    run = WORDS.has(w) ? run + 1 : 0;
    if (run >= 12) return 'seed';
  }
  return null;
}
export const SECRET_WARNING = {
  key: "⚠️ careful: if that's a private key, never send it to anyone, not even me, and move your funds to a new wallet now. (if it was a transaction's id, all good.) i only ever need a wallet's address: 0x and 40 letters and numbers. i didn't keep it",
  seed: "⚠️ careful: that looks like a seed phrase. never send it to anyone, not even me: whoever has it has your wallet. if it's real, move your funds to a new wallet now. i didn't keep it, and i only ever need a wallet's address",
};
