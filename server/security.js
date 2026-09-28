// Small security helpers for the chat. They all use HMAC: a "keyed hash" made with PASS_SECRET,
// which only the server knows. Anyone can read the result, but nobody can forge it without the secret.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const b64url = (data) => Buffer.from(data).toString('base64url');
const hmac = (secret, text) => createHmac('sha256', secret).update(text).digest();
const sameText = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);    // comparison that doesn't leak timing hints
};

// The visitor's IP. On Vercel these headers are set by Vercel itself, so visitors can't fake them.
export function clientIp(request) {
  const h = request.headers;
  return (h.get('x-real-ip') || (h.get('x-forwarded-for') || '').split(',')[0] || 'unknown').trim();
}

// The part of an IP address that means "one household or one server". An IPv4 address stays as it is. IPv6 users usually
// get a whole block of addresses (a "/64", 18 billion billion of them), so the full address would let one person look like
// millions of visitors (extra votes, fresh chat limits). Everyone in one /64 counts as one visitor, like one Wi-Fi.
export function ipGroup(ip) {
  const raw = String(ip || '').trim().toLowerCase().replace(/%.*$/, '');        // drop an interface name ("fe80::1%eth0")
  if (!raw.includes(':')) return raw || 'unknown';
  // an IPv4 address at the end ("::ffff:1.2.3.4") counts as the last two groups
  const v4 = raw.match(/:(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1] || null;
  const text = v4 ? `${raw.slice(0, -v4.length)}0:0` : raw;
  const halves = text.split('::');
  if (halves.length > 2) return raw;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const groups = halves.length === 2 ? [...head, ...Array(Math.max(0, 8 - head.length - tail.length)).fill('0'), ...tail] : head;
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return raw;   // unusual: use it as it is
  const n = groups.map((g) => parseInt(g, 16));
  if (v4 && n.slice(0, 5).every((x) => x === 0) && n[5] === 0xffff) return v4;          // really an IPv4 visitor
  return `${n.slice(0, 4).map((x) => x.toString(16)).join(':')}::/64`;
}

// IPs are never stored. Instead, a code that means "this visitor, today" (changes daily) is used for limits...
export const visitorCodeForDay = (secret, ip, day) => b64url(hmac(secret, `day:${day}:${ipGroup(ip)}`)).slice(0, 32);
// ...and a stable code ties a chat pass to the visitor who earned it.
export const visitorCode = (secret, ip) => b64url(hmac(secret, `ip:${ipGroup(ip)}`)).slice(0, 32);
// Votes to add a coin to the Arena (Phase 6) count "different humans within 7 days", so a daily code won't do. This code is
// different for every coin: it can't be linked to the visitor's other coins or to their Arena votes. Deleted after 8 days.
export const coinVoterCode = (secret, ip, address) => b64url(hmac(secret, `coin:${String(address).toLowerCase()}:${ipGroup(ip)}`)).slice(0, 32);

// Chat pass: proof that this visitor passed the human check recently. Valid for 2 hours.
export function makePass(secret, code, now = Date.now(), ttlMs = 2 * 60 * 60 * 1000) {
  const payload = b64url(JSON.stringify({ v: 1, code, exp: now + ttlMs }));
  return `${payload}.${b64url(hmac(secret, `pass:${payload}`))}`;
}
export function checkPass(secret, pass, code, now = Date.now()) {
  if (typeof pass !== 'string' || pass.length > 400) return false;
  const [payload, sig, extra] = pass.split('.');
  if (!payload || !sig || extra !== undefined || !sameText(sig, b64url(hmac(secret, `pass:${payload}`)))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.v === 1 && data.code === code && typeof data.exp === 'number' && data.exp > now;
  } catch {
    return false;
  }
}

// AGI-1's replies are signed, so the browser can't invent "things AGI-1 said" in the chat history.
export const signReply = (secret, text) => b64url(hmac(secret, `reply:${text}`));
export const checkReply = (secret, text, sig) => typeof sig === 'string' && sameText(sig, signReply(secret, text));

// Voice tickets (2026-09-25): /api/chat hands one out with each reply, so /api/voice only reads aloud a reply AGI-1 really
// just wrote (this exact text), within 15 minutes. Nobody can use it to voice their own text. Version 2 (the same evening)
// also carries the visitor's level (her voice allowance follows their messages a day) and the reply's mood (her voice
// matches it), and is no longer tied to the visitor's internet address: a phone or a home network can switch addresses
// between two requests, and her voice then failed at random. (Sharing a ticket gains nothing: it only voices her own reply,
// at most twice, and still counts against the limits.)
const textHash = (text) => createHash('sha256').update(String(text)).digest('base64url').slice(0, 22);
export function makeVoiceTicket(secret, text, { level = 1, mood = 'neutral' } = {}, now = Date.now(), ttlMs = 15 * 60 * 1000) {
  const payload = b64url(JSON.stringify({ v: 2, h: textHash(text), l: level, m: String(mood).slice(0, 16), exp: now + ttlMs }));
  return `${payload}.${b64url(hmac(secret, `voice:${payload}`))}`;
}
// → { id, level, mood } (id: what the database counts per ticket), or null when it isn't a valid ticket for this text
export function checkVoiceTicket(secret, ticket, text, now = Date.now()) {
  if (typeof ticket !== 'string' || ticket.length > 400) return null;
  const [payload, sig, extra] = ticket.split('.');
  if (!payload || !sig || extra !== undefined || !sameText(sig, b64url(hmac(secret, `voice:${payload}`)))) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const ok = d.v === 2 && d.h === textHash(text) && typeof d.exp === 'number' && d.exp > now;
    if (!ok) return null;
    return { id: sig.slice(0, 24), level: [1, 2, 3].includes(d.l) ? d.l : 1, mood: typeof d.m === 'string' ? d.m : 'neutral' };
  } catch {
    return null;
  }
}
