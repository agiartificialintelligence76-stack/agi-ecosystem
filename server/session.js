// Wallet sessions (Phase 3). After a wallet proves it's yours (a free signature, see server/signin.js), the server
// hands the browser a session: a small note saying "this browser is wallet 0x…, at level N, balance checked at T",
// signed with PASS_SECRET (HMAC) so nobody can change it. No database needed to read it.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_DAYS = 7;                   // then the wallet signs in again
export const RECHECK_MS = 30 * 60 * 1000;         // re-read the $AGI balance at most every 30 minutes

const b64url = (data) => Buffer.from(data).toString('base64url');
const hmac = (secret, text) => createHmac('sha256', secret).update(text).digest();
const sameText = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

// A wallet's address is never stored. The database and the message counters use this scrambled code instead.
export const walletCode = (secret, address) => b64url(hmac(secret, `wallet:${String(address).toLowerCase()}`)).slice(0, 32);

// A refreshed session (new level after a balance re-check) keeps its original end date.
export function makeSession(secret, { wallet, level, checkedAt, expiresAt }, now = Date.now()) {
  const e = expiresAt ?? now + SESSION_DAYS * 864e5;
  const payload = b64url(JSON.stringify({ v: 1, w: wallet.toLowerCase(), l: level, c: checkedAt, e }));
  return `${payload}.${b64url(hmac(secret, `session:${payload}`))}`;
}

// → { wallet, level, checkedAt, expiresAt } or null
export function readSession(secret, token, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 600) return null;
  const [payload, sig, extra] = token.split('.');
  if (!payload || !sig || extra !== undefined || !sameText(sig, b64url(hmac(secret, `session:${payload}`)))) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (d.v !== 1 || typeof d.e !== 'number' || d.e <= now) return null;
    if (!/^0x[0-9a-f]{40}$/.test(d.w) || ![1, 2, 3].includes(d.l) || typeof d.c !== 'number') return null;
    return { wallet: d.w, level: d.l, checkedAt: d.c, expiresAt: d.e };
  } catch {
    return null;
  }
}

export const needsRecheck = (session, now = Date.now()) => now - session.checkedAt >= RECHECK_MS;
