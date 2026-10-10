// AGI Studio's credits (2026-10-10; the owner's choices: "Credits (Recommended)" and "Discounts + free credits
// (Recommended)"): everything in the studio app is paid in credits, 1 credit = 1 cent (src/studio/rules.js PRICES).
//   • Bought with USDG from the person's OWN wallet app (hard rule 9: the page never asks a wallet for a transaction): they
//     send any amount to the studio's wallet (STUDIO_PAY_TO), then press "Check my payment"; our server reads it on Robinhood
//     Chain (server/studio-chain.js) and counts it once (the studio's ledger of payments, supabase/studio.sql, so one payment
//     never pays for two things), as many credits as cents.
//   • A holder's free credits each month (src/studio/rules.js FREE_CREDITS: Crush 100, Soulmate 400), given when their
//     wallet first comes this month, while the whole site's free credits this month last (STUDIO_FREE_CREDITS_A_MONTH, 5,000:
//     $50 of the owner's AI costs at most). A thank-you for holding, never an investment. They run out at the month's end.
//   • Spent free ones first; given back when what they paid for couldn't be made (supabase/influencers.sql inf_refund).
// No cash value: credits can't be withdrawn or sold, and a top-up isn't refunded (the page says so).
import { rpc } from './limits.js';
import { burnKey } from './burn.js';
import { payCode, studioWallet } from './studio.js';
import { readPayment, amountOf, recentPayments, PAY_WINDOW_MS } from './studio-chain.js';
import { FREE_CREDITS } from '../src/studio/rules.js';

export const TOPUP = { CHECKS: 3 };
const n = (x) => Math.max(0, Math.floor(Number(x) || 0));

// A wallet's credits now. → { paid, free, total }
export async function creditsOf(cfg, code) {
  const c = await rpc(cfg, 'inf_credits', { p_wallet: code }, 'studio');
  const paid = n(c?.paid), free = n(c?.free);
  return { paid, free, total: paid + free };
}

// This month's free credits for a holder, once a month (Crush and Soulmate). → { granted, why?, free }
export async function grantFree(cfg, code, level) {
  const amount = FREE_CREDITS[level] || 0;
  if (!amount) return { granted: false, why: 'level', free: 0 };
  const r = await rpc(cfg, 'inf_free', { p_wallet: code, p_amount: amount, p_cap: cfg.infFreeCap }, 'studio');
  return { granted: r?.granted === true, why: r?.why || null, free: n(r?.free) };
}

// "Check my payment" for a top-up: the one transaction pasted, or else the wallet's USDG payments to the studio's wallet in
// the last 7 days (the block explorer: only which ones to read), each read from the chain and counted once.
// → { ok: true, added (credits), results: [{ ok, why?, amount? }], source } or { ok: false, why: 'no_usdg' } · throws with
// err.why 'chain' | 'explorer' when they can't say
export async function checkTopup(cfg, { wallet, tx = null, env, now = Date.now() }) {
  if (!cfg.studioPayTo) return { ok: false, why: 'no_usdg' };
  const look = { kind: 'usdg', wallet, payTo: cfg.studioPayTo, after: now - PAY_WINDOW_MS + 120_000, env, now };
  let list;
  if (tx) list = [tx];
  else {
    try { list = (await recentPayments(wallet, look)).map((p) => p.tx); } catch (err) { throw Object.assign(new Error(err.message), { why: 'explorer' }); }
  }
  const key = await burnKey(cfg);
  const code = studioWallet(cfg.passSecret, wallet);
  const codes = list.map((t) => payCode(key, 'usdg', t, wallet));
  const seen = new Set(list.length ? await rpc(cfg, 'studio_seen', { p_txs: codes }, 'studio') || [] : []);
  let added = 0;
  const results = [];
  for (const [i, t] of list.entries()) {
    if (seen.has(codes[i])) { if (tx) results.push({ ok: false, why: 'used' }); continue; }
    if (results.length >= TOPUP.CHECKS) break;
    let r;
    try { r = await readPayment(t, look); } catch (err) {
      if (tx) throw Object.assign(new Error(err.message), { why: 'chain' });
      results.push({ ok: false, why: 'chain' });
      continue;
    }
    if (!r.ok) { results.push({ ok: false, why: r.why }); continue; }
    let cents;
    try { cents = await amountOf('usdg', r.raw, env); } catch (err) {
      if (tx) throw Object.assign(new Error(err.message), { why: 'chain' });
      results.push({ ok: false, why: 'chain' });
      continue;
    }
    if (cents < 1) { results.push({ ok: false, why: 'too_small' }); continue; }
    const s = await rpc(cfg, 'inf_topup', { p_wallet: code, p_tx: codes[i], p_cents: Math.min(cents, 10_000_000) }, 'studio');
    if (s?.ok !== true) { results.push({ ok: false, why: s?.why === 'used' ? 'used' : 'busy' }); continue; }
    added += Math.min(cents, 10_000_000);
    results.push({ ok: true, amount: Math.min(cents, 10_000_000) });
  }
  return { ok: true, added, results, source: tx ? 'pasted' : 'explorer' };
}
