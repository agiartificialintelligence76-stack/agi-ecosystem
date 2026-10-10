// AGI Studio's burn unlocks (2026-10-10, round 2: the owner's flywheel, "Burn unlocks"; and "large burns can make free 3d
// model"): $AGI burned from the person's OWN wallet app (sent to the burn address 0x…dEaD: the page never asks a wallet for a
// transaction, hard rule 9), read on Robinhood Chain by our server (server/studio-chain.js), unlocks
//   • one more influencer (STUDIO_SLOT_AGI, 5,000 $AGI): a wallet may have STUDIO_SLOTS (5) at all, and one more for each;
//   • a boost in Explore (STUDIO_BOOST_AGI, 10,000 $AGI): one of its own public influencers in Explore's "Boosted" row for
//     24 hours (added to a boost already on);
//   • (a free 3D model for STUDIO_MODEL_BURN_AGI, 25,000 $AGI: through the 3D studio's own orders, server/influencer.js
//     order3dBurn, checked by server/studio.js checkPayment).
// A quote first (what, for how much, a day to burn toward it); then "Check my burn": the pasted transaction, or the wallet's
// burns since the quote (the block explorer only says which to read), each read from the chain and counted once
// (supabase/influencers.sql inf_burn_pay: in studio.sql's payment ledger and burns.sql's own, so it never counts for messages
// or a character too). Burns add up; what's burned counts toward the wallet's level, like a burn for messages.
// A burn pays nobody and is gone for good: "permanent, not an investment, no refunds, not financial advice".
import { rpc } from './limits.js';
import { burnKey, burnWallet } from './burn.js';
import { studioWallet, newOrderId, payCode } from './studio.js';
import { readPayment, amountOf, recentPayments } from './studio-chain.js';

export const BURNS = {
  BOOST_HOURS: 24,
  CHECKS: 3,                     // burns read from the chain per "Check my burn"
};
const ID = /^[A-Za-z0-9_-]{22}$/;
const n0 = (x) => Math.max(0, Math.floor(Number(x) || 0));
const ms = (t) => { const n = Date.parse(t ?? ''); return Number.isFinite(n) ? n : null; };

// What each costs, in whole $AGI (0: switched off by the owner)
export const burnPrice = (cfg, what) => (what === 'boost' ? n0(cfg.infBoostAgi) : what === 'slot' ? n0(cfg.infSlotAgi) : 0);

// A burn unlock as the pages show it
export function burnView(b) {
  if (!b || !ID.test(String(b.id))) return null;
  return {
    id: b.id, what: b.what, inf: ID.test(String(b.inf_id)) ? b.inf_id : null, agi: n0(b.agi), paid: n0(b.paid), hours: n0(b.hours),
    status: b.status === 'paid' ? 'paid' : 'quote', created: ms(b.created_at), done: ms(b.paid_at),
  };
}

// ---------- a quote ----------
// what: 'boost' (inf: one of its own ready, public influencers) or 'slot'. Asked again while one is open: the same one.
// → { ok: true, id, what, inf, agi, paid, created, again } or { ok: false, why: 'off' | 'gone' | 'not_yours' | 'not_ready' |
// 'private' | 'too_many' | 'bad' | 'busy' }
export async function burnQuote(cfg, { wallet, what, inf = null }) {
  if (!['boost', 'slot'].includes(what)) return { ok: false, why: 'bad' };
  if (what === 'boost' ? !ID.test(String(inf)) : inf !== null) return { ok: false, why: 'bad' };
  const agi = burnPrice(cfg, what);
  if (agi < 1) return { ok: false, why: 'off' };
  const key = await burnKey(cfg);
  for (let t = 0; t < 2; t++) {
    const r = await rpc(cfg, 'inf_burn_quote', {
      p_id: newOrderId(), p_wallet: studioWallet(cfg.passSecret, wallet), p_burn: burnWallet(key, wallet), p_what: what, p_inf: inf,
      p_agi: agi, p_hours: what === 'boost' ? BURNS.BOOST_HOURS : 0,
    }, 'studio');
    if (r?.ok === true) {
      return { ok: true, id: r.id, what, inf, agi: n0(r.agi), paid: n0(r.paid), created: ms(r.created), again: r.again === true };
    }
    if (r?.why !== 'taken') return { ok: false, why: String(r?.why || 'busy') };
  }
  return { ok: false, why: 'busy' };
}

// ---------- "Check my burn" ----------
// → { ok: true, paid, have, need, results: [{ ok, why?, amount? }], source, what, inf, until (a boost's end, once it's on) }
// or { ok: false, why: 'gone' | 'not_yours' } · throws with err.why 'chain' | 'explorer' when they can't say
export async function burnCheck(cfg, { wallet, id, tx = null, env, now = Date.now() }) {
  if (!ID.test(String(id))) return { ok: false, why: 'gone' };
  const b = await rpc(cfg, 'inf_burn_get', { p_id: id }, 'studio');
  if (!b || b.expired === true) return { ok: false, why: 'gone' };
  const mine = studioWallet(cfg.passSecret, wallet);
  if (b.wallet_code !== mine) return { ok: false, why: 'not_yours' };
  const base = { what: b.what, inf: ID.test(String(b.inf_id)) ? b.inf_id : null, need: n0(b.agi) };
  if (b.status !== 'quote') return { ok: true, paid: true, have: n0(b.paid), results: [], source: 'done', until: null, ...base };
  const look = { kind: 'burn', wallet, payTo: null, after: Date.parse(b.created_at), env, now };
  let list;
  if (tx) list = [tx];
  else {
    try { list = (await recentPayments(wallet, look)).map((p) => p.tx); } catch (err) { throw Object.assign(new Error(err.message), { why: 'explorer' }); }
  }
  const key = await burnKey(cfg);
  const codes = list.map((t) => payCode(key, 'burn', t, wallet));
  const seen = new Set(list.length ? await rpc(cfg, 'studio_seen', { p_txs: codes }, 'studio') || [] : []);
  let have = n0(b.paid), paid = false, until = null;
  const results = [];
  for (const [i, t] of list.entries()) {
    if (seen.has(codes[i])) { if (tx) results.push({ ok: false, why: 'used' }); continue; }
    if (results.length >= BURNS.CHECKS || paid) break;
    let r;
    try { r = await readPayment(t, look); } catch (err) {
      if (tx) throw Object.assign(new Error(err.message), { why: 'chain' });
      results.push({ ok: false, why: 'chain' });
      continue;
    }
    if (!r.ok) { results.push({ ok: false, why: r.why }); continue; }
    let amount;
    try { amount = await amountOf('burn', r.raw, env); } catch (err) {
      if (tx) throw Object.assign(new Error(err.message), { why: 'chain' });
      results.push({ ok: false, why: 'chain' });
      continue;
    }
    if (amount < 1) { results.push({ ok: false, why: 'too_small' }); continue; }
    const s = await rpc(cfg, 'inf_burn_pay', { p_id: id, p_wallet: mine, p_tx: codes[i], p_amount: amount }, 'studio');
    if (s?.ok !== true) {
      results.push({ ok: false, why: String(s?.why || 'busy') });
      if (s?.why === 'done') { paid = true; break; }
      continue;
    }
    results.push({ ok: true, amount });
    have = n0(s.have);
    paid = s.paid === true;
    until = ms(s.until);
  }
  return { ok: true, paid, have, results, source: tx ? 'pasted' : 'explorer', until, ...base };
}

// A wallet's open burn unlocks (and the ones it finished this week) → [burnView]
export async function burnsOpen(cfg, wallet) {
  const list = await rpc(cfg, 'inf_burns_open', { p_wallet: studioWallet(cfg.passSecret, wallet) }, 'studio');
  return (Array.isArray(list) ? list : []).map(burnView).filter(Boolean);
}
