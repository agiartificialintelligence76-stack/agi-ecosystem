// AGI Studio (round 4, 2026-10-11, the owner: "i just saw theres a username system on clank.trade is it possible their
// username in there would be in the studio as well when they connected there and their username will appear also on the
// studio?"): someone shows their clank.trade username in AGI Studio, as "by @name" (with a link to their clank.trade profile)
// on their public influencers and in Explore.
// clank.trade has no lookup by wallet, so they type their username once, and our server reads that profile with clank.trade's
// own API (profiles.byUsername: public, read-only, the one its website uses) and keeps the name only when the profile's wallet
// is the one they signed in with here (the site's sign-in: an address and a free signature). Read again once a week while it's
// shown: a profile that moved to another wallet, or a name that's gone, takes it off. Kept under a scrambled code of the
// wallet (supabase/influencers.sql agi1_inf_names: never the address); the name itself is public on clank.trade.
import { rpc } from './limits.js';
import { clankApi } from './coins.js';
import { studioWallet } from './studio.js';
import { CLANK_NAME } from '../src/studio/rules.js';

export const NAMES = { RECHECK_MS: 7 * 86400e3, TIMEOUT_MS: 6000, RECHECK_TIMEOUT_MS: 3000 };
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

// What they typed: "@name", "name", or their profile's link ("clank.trade/@name", with or without https:// and www.).
// → the name, lowercase, or null
export function clankNameFrom(input) {
  let s = String(input ?? '').trim();
  if (!s || s.length > 120) return null;
  const link = /^(?:https?:\/\/)?(?:www\.)?clank\.trade\/@([^/?#\s]+)\/?(?:[?#][^\s]*)?$/i.exec(s);
  if (link) {
    try { s = decodeURIComponent(link[1]); } catch { return null; }
  } else {
    s = s.replace(/^@/, '');
  }
  return CLANK_NAME.test(s) ? s.toLowerCase() : null;
}

// A clank.trade profile by its username. → { name (lowercase), address (lowercase, or null) } | null (no such profile) ·
// throws when clank.trade doesn't answer properly (down, a bot wall, a change)
export async function clankProfile(name, { timeoutMs = NAMES.TIMEOUT_MS } = {}) {
  const [r] = await clankApi([['profiles.byUsername', { username: name }]], { timeoutMs });
  if (r?.error === 'not_found' || (r && !r.error && (r.data === null || r.data === undefined))) return null;
  if (!r || r.error || typeof r.data !== 'object') throw new Error("clank.trade: its answer about a profile wasn't one");
  const p = r.data;
  return {
    name: typeof p.username === 'string' && CLANK_NAME.test(p.username) ? p.username.toLowerCase() : name,
    address: typeof p.address === 'string' && ADDRESS.test(p.address) ? p.address.toLowerCase() : null,
  };
}

// "Show my clank.trade name": its profile read, and kept when its wallet is this one. → { ok: true, name } or { ok: false,
// why: 'bad' (not a clank.trade username) | 'none' (no such profile) | 'not_yours' (its wallet is another one) | 'clank'
// (clank.trade didn't answer: try again) | 'busy' }
export async function claimClankName(cfg, { wallet, input }) {
  const name = clankNameFrom(input);
  if (!name) return { ok: false, why: 'bad' };
  let p;
  try { p = await clankProfile(name); } catch (err) {
    console.warn(`[studio] a clank.trade name couldn't be checked: ${err.message}`);
    return { ok: false, why: 'clank' };
  }
  if (!p) return { ok: false, why: 'none' };
  if (!p.address || p.address !== String(wallet || '').toLowerCase()) return { ok: false, why: 'not_yours' };
  const r = await rpc(cfg, 'inf_name_set', { p_wallet: studioWallet(cfg.passSecret, wallet), p_name: p.name }, 'studio');
  return r?.ok === true ? { ok: true, name: p.name } : { ok: false, why: 'busy' };
}

// "Remove it" → { ok: true }
export async function clearClankName(cfg, { wallet }) {
  const r = await rpc(cfg, 'inf_name_set', { p_wallet: studioWallet(cfg.passSecret, wallet), p_name: null }, 'studio');
  return r?.ok === true ? { ok: true } : { ok: false, why: 'busy' };
}

// The name this wallet shows (My studio), read again on clank.trade when its last check is a week old: its profile gone, renamed
// or moved to another wallet takes it off; clank.trade not answering keeps it (and it's read again next time).
// → the name, or null
export async function nameOf(cfg, wallet) {
  const code = studioWallet(cfg.passSecret, wallet);
  const r = await rpc(cfg, 'inf_name_get', { p_wallet: code }, 'studio');
  const name = typeof r?.name === 'string' && /^[a-z0-9_]{3,32}$/.test(r.name) ? r.name : null;
  if (!name) return null;
  // (the real clock: checked_at is the database's)
  if (Date.now() - (Date.parse(r.checked_at || '') || 0) < NAMES.RECHECK_MS) return name;
  let p;
  try { p = await clankProfile(name, { timeoutMs: NAMES.RECHECK_TIMEOUT_MS }); } catch { return name; }
  const still = Boolean(p && p.name === name && p.address && p.address === String(wallet || '').toLowerCase());
  await rpc(cfg, 'inf_name_set', { p_wallet: code, p_name: still ? name : null }, 'studio').catch(() => {});
  return still ? name : null;
}
