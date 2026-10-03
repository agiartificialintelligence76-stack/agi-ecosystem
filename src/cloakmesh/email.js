// CloakMesh's waitlist (inference.agi1.app, 2026-10-03): what counts as an email address. One rule for the page (it says
// what's wrong before sending) and our server (it decides: server/cloakmesh.js), so both always agree.
// An address as people type it → { ok: true, email } (trimmed and lowercase, so one person is one row) or { ok: false }.
// Plain addresses only: letters, numbers and the usual symbols before the @; a real domain name after it (internationalized
// domains in their xn-- form); never an IP address, quotes, spaces, or the reserved example and test names.
const LOCAL = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const TLD = /^(?:[a-z]{2,24}|xn--[a-z0-9-]{1,59})$/;
const RESERVED = /(?:^|\.)(?:example\.(?:com|net|org)|example|test|invalid|localhost|local)$/;

export function checkEmail(raw) {
  if (typeof raw !== 'string' || raw.length > 320) return { ok: false };
  const email = raw.normalize('NFKC').trim().toLowerCase();
  if (email.length < 6 || email.length > 254) return { ok: false };
  const at = email.indexOf('@');
  if (at < 1 || at !== email.lastIndexOf('@')) return { ok: false };
  const local = email.slice(0, at), domain = email.slice(at + 1);
  if (local.length > 64 || !LOCAL.test(local)) return { ok: false };
  const labels = domain.split('.');
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l)) || !TLD.test(labels.at(-1)) || RESERVED.test(domain)) return { ok: false };
  return { ok: true, email };
}
