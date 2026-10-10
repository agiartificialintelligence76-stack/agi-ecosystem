// AGI Studio's likes and its weekly spotlight (2026-10-10, round 2: the owner's flywheel, "Weekly spotlight"):
//   • Likes: a signed-in wallet can like a done photo or video of a public influencer (never one made from a face or a photo
//     of a real person, never its own), 50 a day (supabase/influencers.sql inf_like). Anyone's like shows; only holders'
//     (Crush and Soulmate wallets, by their level when they liked) count toward the spotlight, so a pile of new wallets can't.
//   • Each Monday (UTC) the studio's clock picks last week's best creation once (inf_week_pick: the most holders' likes, then
//     all likes, then the first made), and it waits for the owner's look on the owner's page: approve it (with its prize in
//     $AGI from the prize wallet, her quizzes' own PRIZE_WALLET_KEY; STUDIO_WEEKLY_PRIZE, 10,000 by default; 0 = for glory),
//     or skip it to the next best. Approved, it's Explore's spotlight for two weeks.
//   • Its maker claims the prize in My studio, to the wallet they're signed in with (the one that made it: its session proves
//     it, and a sign-in is a plain signature, so it's an ordinary wallet, never a contract): claimed in the database first
//     (once), then $AGI's own transfer from the prize wallet, recorded before it goes out (server/hot-wallet.js: never twice).
// A prize is "a thank-you for making, not an investment, not financial advice": never a reason to buy, never paid to holders.
import { rpc } from './limits.js';
import { studioWallet } from './studio.js';

export const WEEK = {
  LIKES_A_DAY: 50,
  PRIZE_MAX: 1_000_000,          // the prize wallet's own cap for one prize (server/game-prizes.js)
};
export const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[A-Za-z0-9_-]{22}$/;
const TXHASH = /^0x[0-9a-f]{64}$/;
const n0 = (x) => Math.max(0, Math.floor(Number(x) || 0));
// the prize wallet is on (server/games.js prizesOn's own rule, here without loading her quizzes): its key set, and never the
// launch gas wallet's
export const prizesOn = (cfg) => Boolean(cfg?.prizeKey && cfg.prizeKey !== cfg.launchGasKey);

// The Monday (UTC) of the week a moment is in, as "YYYY-MM-DD"; and last week's
export function mondayOf(t) {
  const d = new Date(t);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back)).toISOString().slice(0, 10);
}
export const lastWeek = (t) => mondayOf(t - 7 * 864e5);

// ---------- likes ----------
// → { ok: true, liked, likes } or { ok: false, why: 'gone' | 'private' | 'own' | 'too_many' | 'bad' | 'busy' }
export async function like(cfg, { wallet, level, job, like: on }) {
  if (!ID.test(String(job)) || typeof on !== 'boolean' || ![1, 2, 3].includes(level)) return { ok: false, why: 'bad' };
  const r = await rpc(cfg, 'inf_like', {
    p_job: job, p_wallet: studioWallet(cfg.passSecret, wallet), p_level: level, p_like: on, p_per_day: WEEK.LIKES_A_DAY,
  }, 'studio');
  return r?.ok === true ? { ok: true, liked: r.liked === true, likes: n0(r.likes) } : { ok: false, why: String(r?.why || 'busy') };
}
// Which of these photos and videos this wallet liked (its hearts, filled in) → [ids]
export async function likedOf(cfg, wallet, jobs) {
  const list = [...new Set((Array.isArray(jobs) ? jobs : []).filter((j) => ID.test(String(j))))].slice(0, 200);
  if (!list.length) return [];
  const r = await rpc(cfg, 'inf_liked', { p_wallet: studioWallet(cfg.passSecret, wallet), p_jobs: list }, 'studio');
  return Array.isArray(r) ? r.filter((j) => ID.test(String(j))) : [];
}

// ---------- the clock: last week's pick, once ----------
// Every minute with the studio's clock (api/feed.js ?studio); one question a week per server copy once it's settled.
// → the database's answer, or null (settled already in this server copy)
let settled = null;
export const _resetWeekClock = () => { settled = null; };
export async function weekClock(cfg, { now = Date.now() } = {}) {
  const week = lastWeek(now);
  if (settled === week) return null;
  const r = await rpc(cfg, 'inf_week_pick', { p_week: week }, 'studio');
  if (r?.ok === true) {
    settled = week;
    if (r.again !== true && r.status === 'picked') console.log(`[studio] the spotlight of the week of ${week}: ${r.job} (it waits for the owner's look)`);
  }
  return r;
}

// ---------- what the pages show ----------
// A week as the pages need it (the owner's page sees every state; anyone else only approved ones, through Explore)
export function weekView(w) {
  if (!w || !WEEK_RE.test(String(w.week))) return null;
  return {
    week: w.week, status: w.status, job: ID.test(String(w.job)) ? w.job : null, inf: ID.test(String(w.inf_id)) ? w.inf_id : null,
    name: w.inf_name || null, kind: w.kind || null, shape: w.shape || null, poster: w.poster === true, files: n0(w.files),
    portrait: w.looks_job && Number.isInteger(w.pick) ? { job: w.looks_job, n: w.pick } : null, holderLikes: n0(w.holder_likes),
    likes: n0(w.likes), prize: n0(w.prize), tx: TXHASH.test(String(w.tx)) ? w.tx : null, shown: w.job_ok === true, skipped: n0(w.skipped),
    mine: w.mine === true,
  };
}
// The weeks: every one for the owner's page; a signed-in wallet's own prizes (to claim, or claimed) for My studio
export async function weeksFor(cfg, { wallet = null, owner = false, limit = 8 } = {}) {
  const code = wallet ? studioWallet(cfg.passSecret, wallet) : null;
  const list = await rpc(cfg, 'inf_weeks', { p_wallet: code, p_limit: owner ? Math.max(limit, 12) : limit }, 'studio');
  const weeks = (Array.isArray(list) ? list : []).map(weekView).filter(Boolean);
  if (owner) return weeks;
  return weeks.filter((w) => w.mine && w.prize > 0 && ['approved', 'claimed', 'sending', 'sent'].includes(w.status));
}

// ---------- the owner's look ----------
// approve (its prize in whole $AGI: 0 to 1,000,000, 0 = for glory only) or skip (to the next best)
// → { ok: true, status, job } or { ok: false, why: 'gone' | 'state' | 'bad' | 'busy' }
export async function weekSet(cfg, { week, action, prize = null }) {
  if (!WEEK_RE.test(String(week)) || !['approve', 'skip'].includes(action)) return { ok: false, why: 'bad' };
  const amount = action === 'approve' ? Number(prize) : null;
  if (action === 'approve' && !(Number.isInteger(amount) && amount >= 0 && amount <= WEEK.PRIZE_MAX)) return { ok: false, why: 'bad' };
  const r = await rpc(cfg, 'inf_week_set', { p_week: week, p_action: action, p_prize: amount }, 'studio');
  return r?.ok === true ? { ok: true, status: r.status, job: r.job || null } : { ok: false, why: String(r?.why || 'busy') };
}

// ---------- its maker's prize ----------
// Claimed and sent to the wallet they're signed in with. → { ok: true, tx, amount } (sent: its transaction) or { ok: false,
// why: 'prizes_off' | 'none' | 'not_yours' | 'no_prize' | 'claimed' (being sent right now) | 'sending' (on its way: tx when
// known) | 'empty' (the prize wallet needs a top-up: it waits) | 'failed' (nothing moved: try again) | 'busy' | 'bad' }
export async function claimWeek(cfg, { wallet, week, env, deadline = Date.now() + 18_000 }, again = false) {
  if (!WEEK_RE.test(String(week))) return { ok: false, why: 'bad' };
  if (!prizesOn(cfg)) return { ok: false, why: 'prizes_off' };
  const P = await import('./game-prizes.js');
  const address = String(wallet).toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address) || address === P.prizeWallet(cfg)) return { ok: false, why: 'bad' };
  const sent = (tx, ok) => rpc(cfg, 'inf_week_sent', { p_week: week, p_tx: tx, p_ok: ok }, 'studio');
  const c = await rpc(cfg, 'inf_week_claim', { p_week: week, p_wallet: studioWallet(cfg.passSecret, wallet), p_address: address }, 'studio');
  if (c?.ok !== true) {
    const why = String(c?.why || 'busy');
    const tx = TXHASH.test(String(c?.tx)) ? c.tx : null;
    if (why === 'sent') return { ok: true, tx, amount: n0(c.amount) };
    if (why === 'sending') {
      // what the chain says about its transaction: through (kept as sent), failed (nothing moved: claimed again), or not yet
      const state = tx ? await P.txState(tx, env) : null;
      if (state === 'ok') {
        await sent(tx, true).catch((err) => console.error(`[studio] keeping a sent weekly prize failed: ${err.message}`));
        return { ok: true, tx, amount: n0(c.amount) };
      }
      if (state === 'failed' && !again) {
        await sent(tx, false).catch(() => {});
        return claimWeek(cfg, { wallet, week, env, deadline }, true);
      }
      return { ok: false, why: 'sending', tx };
    }
    return { ok: false, why: ['none', 'not_yours', 'no_prize', 'claimed', 'bad'].includes(why) ? why : 'busy' };
  }
  const amount = n0(c.amount);
  const giveBack = (tx = null) => sent(tx, false)
    .catch((err) => console.error(`[studio] giving a weekly prize back failed (it's given back by itself in 2 minutes): ${err.message}`));
  const { sendPlanned, SEND_MS } = await import('./hot-wallet.js');
  const forPlan = Math.min(4000, deadline - Date.now() - SEND_MS);
  let plan;
  try {
    if (forPlan < 1500) throw new Error('no time left');
    plan = await P.prizePlan(cfg, address, amount, env, forPlan);
  } catch (err) {
    console.warn(`[studio] sending a weekly prize: couldn't get it ready (${err.message}); nothing went out`);
    await giveBack();
    return { ok: false, why: 'busy' };
  }
  if (!plan.ok) { await giveBack(); return { ok: false, why: 'empty' }; }
  const out = await sendPlanned(cfg.prizeKey, plan.plan, env, {
    deadline, mark: async (tx) => (await rpc(cfg, 'inf_week_sending', { p_week: week, p_tx: tx }, 'studio')) === true,
  });
  if (out.ok) {
    try { await sent(out.tx, true); } catch (err) { console.error(`[studio] keeping a sent weekly prize failed (sent: ${out.tx}): ${err.message}`); }
    if (await P.failedOnChain(out.tx, env, Math.min(3000, deadline - Date.now()))) {
      await giveBack(out.tx);
      console.warn(`[studio] a weekly prize's transfer failed on the chain (${out.tx}): nothing moved, it can be claimed again`);
      return { ok: false, why: 'failed' };
    }
    console.log(`[studio] the weekly prize of ${week} went out: ${amount} $AGI (${out.tx})`);
    return { ok: true, tx: out.tx, amount };
  }
  if (['empty', 'failed', 'unmarked'].includes(out.why)) await giveBack();
  if (out.why === 'unsure') {
    console.warn('[studio] a weekly prize\'s nonce was taken and the chain couldn\'t say by what: it stays "sending" (never sent again)');
    return { ok: false, why: 'sending', tx: null };
  }
  return { ok: false, why: out.why === 'empty' ? 'empty' : out.why === 'unmarked' ? 'busy' : 'failed' };
}

