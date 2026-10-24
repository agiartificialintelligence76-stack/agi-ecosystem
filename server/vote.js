// Community votes (agi1.app/vote, 2026-10-24): our server's side. The polls' rules are in src/vote/polls.js; the polls
// themselves and the votes are in the database (supabase/votes.sql); the addresses are api/wallet.js's (Vercel's 12
// functions are all used).
//   • The owner's page (agi1.app/vote/owner, the same day): the AGI Studio owner's wallet (STUDIO_OWNER, else the first
//     of STUDIO_ONLY_FOR: cfg.studioOwner) signed in with the site's own sign-in makes, changes, hides and deletes polls.
//     Every change goes through checkPoll() (src/vote/polls.js) here, whatever the page sent.
//   • Voting: a connected wallet (the site's own sign-in: a free signature, never a transaction). Its $AGI is read on the
//     chain right then (server/chain.js, read-only): at least VOTE.minAgi, and that's its weight. Kept under a scrambled
//     code (voterCode: not the code her chat's memory or the games use), with its address encrypted (seal) only for the
//     final count.
//   • The final count: VOTE.settleAfterMs after the close, each wallet that voted is read again on the chain and counts
//     the lower of the two (so $AGI moved to a second wallet to vote twice counts once), then its sealed address is wiped.
//     It runs a few wallets at a time when anyone looks at the results (GET /api/wallet?votes), no cron needed.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { rpc } from './limits.js';
import { agiBalance } from './chain.js';
import { VOTE, livePolls, pollById, isChoice, pollState, closesAt, tallyRows, publicPoll, checkPoll, cleanPoll } from '../src/vote/polls.js';

export const MAX_POLLS = 100;               // polls kept at once (the public list sends them all, pictures too)

// the AGI Studio owner's wallet, the one that may use agi1.app/vote/owner
export const isVoteOwner = (cfg, wallet) => Boolean(cfg.studioOwner) && String(wallet || '').toLowerCase() === cfg.studioOwner;

// Every poll in the database, the newest first (a badly made row is left out and said in the logs)
export async function loadPolls(cfg) {
  const rows = await rpc(cfg, 'poll_list', {}, 'vote');
  const out = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const p = cleanPoll(r);
    if (p) out.push(p);
    else console.error('[vote] a poll in the database isn\'t well made, so it\'s left out:', String(r?.id).slice(0, 40));
  }
  return out;
}

export const voterCode = (secret, wallet) =>
  createHmac('sha256', String(secret)).update(`vote:${String(wallet).toLowerCase()}`).digest('base64url').slice(0, 32);

// AES-256-GCM with a key made from PASS_SECRET: iv (12) + tag (16) + the address (20 bytes) = 64 base64url characters
const sealKey = (secret) => createHash('sha256').update(`vote-seal:${secret}`).digest();
export function seal(secret, wallet) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', sealKey(secret), iv);
  const body = Buffer.concat([c.update(Buffer.from(String(wallet).slice(2).toLowerCase(), 'hex')), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString('base64url');
}
// -> '0x…' or null (not ours, changed, or PASS_SECRET changed since)
export function unseal(secret, text) {
  try {
    const b = Buffer.from(String(text), 'base64url');
    if (b.length !== 48) return null;
    const d = createDecipheriv('aes-256-gcm', sealKey(secret), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return `0x${Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('hex')}`;
  } catch {
    return null;
  }
}

// whole $AGI (rounded down) a wallet holds now; throws if the chain can't be reached
export async function heldAgi(wallet, env) {
  const { raw, decimals } = await agiBalance(wallet, env);
  return Number(raw / 10n ** BigInt(decimals));
}

// a poll's numbers now: { ...the poll, state, rows: [{ choice, agi, wallets, share }], total, wallets, left }
// (the owner's page also gets draft and voters: every vote it has, counted ones too)
export async function pollNow(cfg, poll, now = Date.now(), { owner = false } = {}) {
  const base = owner ? { ...publicPoll(poll), draft: poll.draft === true } : publicPoll(poll);
  if (pollState(poll, now) === 'soon') {
    // (a hidden poll may have been open before and been moved: the owner's page still sees its votes)
    const t = owner ? await rpc(cfg, 'vote_tally', { p_poll: poll.id }, 'vote') : null;
    const rows = tallyRows(poll, t?.rows);
    return {
      ...base, state: 'soon', rows, total: rows.reduce((s, r) => s + r.agi, 0), wallets: rows.reduce((s, r) => s + r.wallets, 0), left: 0,
      ...(owner ? { voters: Number.isSafeInteger(t?.all) ? t.all : 0 } : {}),
    };
  }
  const t = await rpc(cfg, 'vote_tally', { p_poll: poll.id }, 'vote');
  const left = Number.isSafeInteger(t?.left) && t.left >= 0 ? t.left : null;
  const rows = tallyRows(poll, t?.rows);
  return {
    ...base, state: pollState(poll, now, left), rows, left: left ?? 0,
    total: rows.reduce((s, r) => s + r.agi, 0), wallets: rows.reduce((s, r) => s + r.wallets, 0),
    ...(owner ? { voters: Number.isSafeInteger(t?.all) ? t.all : (left ?? 0) } : {}),
  };
}

// A few wallets of a closed poll counted again (VOTE.settleBatch, 5 at a time). A wallet the chain can't be asked about
// now waits for the next look; one whose sealed address can't be opened keeps its vote's $AGI (said once in the logs).
export async function countSome(cfg, poll, now = Date.now()) {
  if (now < closesAt(poll) + VOTE.settleAfterMs) return 0;
  const rows = await rpc(cfg, 'vote_uncounted', { p_poll: poll.id, p_limit: VOTE.settleBatch }, 'vote');
  if (!Array.isArray(rows) || !rows.length) return 0;
  let counted = 0;
  const one = async (r) => {
    const wallet = unseal(cfg.passSecret, r.sealed);
    let held;
    if (!wallet) {
      console.error('[vote] a sealed address couldn\'t be opened (PASS_SECRET changed?): its vote keeps the $AGI it voted with');
      held = Number.isSafeInteger(r.agi) ? r.agi : 0;
    } else {
      try { held = await heldAgi(wallet); } catch (err) { console.error('[vote] the final count waits for the chain:', err.message); return; }
    }
    if (await rpc(cfg, 'vote_count', { p_poll: poll.id, p_who: r.who, p_held: held }, 'vote')) counted += 1;
  };
  for (let i = 0; i < rows.length; i += 5) await Promise.all(rows.slice(i, i + 5).map(one));
  return counted;
}

// Every poll on the page, with its numbers (and a closed one's final count moved along first). The owner's page gets
// every poll, hidden ones too.
export async function pollsNow(cfg, now = Date.now(), { owner = false } = {}) {
  const all = await loadPolls(cfg);
  const polls = owner ? all : livePolls(all);
  let counting = false;                     // one closed poll counted per request: keeps it well inside the time limit
  for (const poll of polls) {
    if (!counting && pollState(poll, now) === 'counting' && now >= closesAt(poll) + VOTE.settleAfterMs) {
      counting = true;
      await countSome(cfg, poll, now);
    }
  }
  return Promise.all(polls.map((poll) => pollNow(cfg, poll, now, { owner })));
}

// ---------- the owner's page ----------
// A new poll or a changed one, checked by checkPoll(). -> { ok: true, poll (with its numbers) } · { ok: false, why (plain words) }
export async function savePoll(cfg, input, now = Date.now()) {
  if (!input || typeof input !== 'object') return { ok: false, why: 'Something was missing. Reload the page and try again.' };
  const polls = await loadPolls(cfg);
  const old = input.id ? polls.find((p) => p.id === input.id) : null;
  if (input.id && !old) return { ok: false, why: 'This vote isn\'t there any more. Reload the page.' };
  if (!old && polls.length >= MAX_POLLS) return { ok: false, why: `There are ${MAX_POLLS} votes already: delete some old ones first.` };
  const votes = {};
  let voters = 0;
  if (old) {
    const t = await rpc(cfg, 'vote_tally', { p_poll: old.id }, 'vote');
    for (const r of Array.isArray(t?.rows) ? t.rows : []) if (r && typeof r.choice === 'string') votes[r.choice] = Number(r.wallets) || 0;
    voters = Number.isSafeInteger(t?.all) ? t.all : Object.values(votes).reduce((s, n) => s + n, 0);
  }
  let r = checkPoll(input, { old, votes, voters, now });
  for (let i = 0; r.ok && !old && polls.some((p) => p.id === r.poll.id) && i < 5; i++) r = checkPoll(input, { now });  // (a new id)
  if (!r.ok) return r;
  if (!old && polls.some((p) => p.id === r.poll.id)) return { ok: false, why: 'Try again.' };
  const { id, ...body } = r.poll;
  if (!(await rpc(cfg, 'poll_put', { p_id: id, p_body: body }, 'vote'))) return { ok: false, why: 'Couldn\'t save it. Try again.' };
  return { ok: true, poll: await pollNow(cfg, r.poll, now, { owner: true }) };
}

// A poll deleted: only one nobody voted on (the database checks it too). -> { ok: true } · { ok: false, why }
export async function dropPoll(cfg, id) {
  if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]{1,39}$/.test(id)) return { ok: false, why: 'This vote isn\'t there any more. Reload the page.' };
  const r = await rpc(cfg, 'poll_drop', { p_id: id }, 'vote');
  if (r?.ok) return { ok: true };
  if (r?.why === 'has_votes') return { ok: false, why: 'This vote has votes, so it can\'t be deleted. Hide it instead.' };
  return { ok: false, why: 'This vote isn\'t there any more. Reload the page.' };
}

// A vote. -> { ok: true, choice, agi, poll } · { ok: false, why: 'bad' | 'closed' | 'soon' | 'chain' | 'too_few' (agi) | 'counted' }
export async function castVote(cfg, { wallet, poll: id, choice, now = Date.now() }) {
  if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]{1,39}$/.test(id)) return { ok: false, why: 'bad' };
  const poll = pollById(id, await loadPolls(cfg));
  if (!poll || !isChoice(poll, choice)) return { ok: false, why: 'bad' };
  const state = pollState(poll, now);
  if (state !== 'open') return { ok: false, why: state === 'soon' ? 'soon' : 'closed' };
  let agi;
  try { agi = await heldAgi(wallet); } catch (err) { console.error('[vote] the balance couldn\'t be read:', err.message); return { ok: false, why: 'chain' }; }
  if (agi < VOTE.minAgi) return { ok: false, why: 'too_few', agi };
  const r = await rpc(cfg, 'vote_put', {
    p_poll: poll.id, p_who: voterCode(cfg.passSecret, wallet), p_choice: choice, p_weight: agi, p_sealed: seal(cfg.passSecret, wallet),
  }, 'vote');
  if (!r?.ok) return { ok: false, why: r?.why === 'counted' ? 'counted' : 'bad' };
  return { ok: true, choice, agi, poll: await pollNow(cfg, poll, now) };
}

// A wallet's own votes and what it holds now: { votes: { [poll]: { choice, agi, final } }, agi (null: chain unreachable) }
export async function myVotes(cfg, wallet) {
  const [rows, agi, polls] = await Promise.all([
    rpc(cfg, 'vote_mine', { p_who: voterCode(cfg.passSecret, wallet) }, 'vote'),
    heldAgi(wallet).catch((err) => { console.error('[vote] the balance couldn\'t be read:', err.message); return null; }),
    loadPolls(cfg),
  ]);
  const votes = {};
  for (const r of Array.isArray(rows) ? rows : []) {
    const poll = pollById(r?.poll, polls);
    if (poll && isChoice(poll, r.choice)) votes[poll.id] = { choice: r.choice, agi: r.agi, final: r.final ?? null };
  }
  return { votes, agi };
}
