// "Launch with AGI-1" (2026-10-01): the links people may add to their coin, all optional (the owner's pick: "X, website and
// Telegram", "just make adding that optional"). One file for the launch page and our server (server/launch.js checkLinks),
// so both tidy and check a link the same way. Pure: no page, no network.
// clank.trade's launch carries five links (twitter, telegram, discord, website, farcaster: up to 256 bytes each, its docs);
// its site shows X and the website, saved as full addresses ("https://x.com/<handle>", like its own coins'). So ours are
// saved the same way, and Discord and Farcaster stay empty.
export const LINK_FIELDS = ['twitter', 'telegram', 'website'];
export const LINK_MAX = 200;                 // characters, as typed and once tidied (plain ASCII: within clank.trade's 256 bytes)

// X: "@handle", "handle", "x.com/handle" or "twitter.com/handle" (with or without https:// and www.) → "https://x.com/handle"
// · '' (left empty) · null (not an X account: a post, another site, a handle X wouldn't allow)
export function cleanX(text) {
  const t = String(text ?? '').trim();
  if (!t) return '';
  const m = /^(?:(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/)?@?([A-Za-z0-9_]{1,15})\/?$/i.exec(t);
  return m ? `https://x.com/${m[1]}` : null;
}

// Telegram: a public group or channel ("@name", "name", "t.me/name": 5 to 32 letters, numbers or _, starting with a letter)
// or an invite link ("t.me/+code", "t.me/joinchat/code") → "https://t.me/name" · "https://t.me/+code" · '' · null
const TG_HOST = String.raw`(?:(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me|telegram\.dog)\/)`;
const TG_INVITE = new RegExp(String.raw`^${TG_HOST}(?:\+|joinchat\/)([A-Za-z0-9_-]{10,64})\/?$`, 'i');
const TG_NAME = new RegExp(String.raw`^${TG_HOST}?@?([A-Za-z][A-Za-z0-9_]{4,31})\/?$`, 'i');
export function cleanTelegram(text) {
  const t = String(text ?? '').trim();
  if (!t) return '';
  const invite = TG_INVITE.exec(t);
  if (invite) return `https://t.me/+${invite[1]}`;
  const name = TG_NAME.exec(t);
  return name ? `https://t.me/${name[1]}` : null;
}

// A website: an https address on a real domain name ("yourcoin.com" gets its https:// added) → the address, tidied (as
// browsers write it) · '' · null: never http, an IP address, a one-word host, a login in the address (user:pass@), a port,
// or a look-alike domain written in punycode ("xn--…": letters from other alphabets that imitate a real site)
export function cleanWebsite(text) {
  let t = String(text ?? '').trim();
  if (!t) return '';
  if (t.length > LINK_MAX || /\s/.test(t)) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(t)) t = `https://${t}`;
  let u;
  try { u = new URL(t); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
  const labels = u.hostname.toLowerCase().split('.');
  if (labels.length < 2 || labels.some((l) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(l) || l.startsWith('xn--'))) return null;
  if (!/^[a-z]{2,24}$/.test(labels.at(-1))) return null;      // a real top-level domain (so never an IP address)
  return u.href.length <= LINK_MAX ? u.href : null;
}

const CLEAN = { twitter: cleanX, telegram: cleanTelegram, website: cleanWebsite };
// The three, as the page or our server got them → { ok: true, links: { twitter, telegram, website } } (each '' when left
// empty) · { ok: false, field } (the first one that isn't right). Tidying a tidied link gives it back unchanged.
export function cleanLinks(input) {
  const src = input && typeof input === 'object' ? input : {};
  const links = {};
  for (const field of LINK_FIELDS) {
    const raw = src[field];
    if (raw !== undefined && raw !== null && (typeof raw !== 'string' || raw.length > LINK_MAX)) return { ok: false, field };
    const v = CLEAN[field](raw);
    if (v === null) return { ok: false, field };
    links[field] = v;
  }
  return { ok: true, links };
}
