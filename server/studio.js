// AGI-1's 3D character studio (2026-10-10; the owner: "what if i launched a where they can create a 3d model with meshy ai
// api that can move on chat just like vladcat. they can get it by burning $AGI tokens and can launch token with it", then
// "Burn $AGI or USDG", holder discounts, a free one a month for Soulmates, Vercel Pro).
//   1. agi1.app/studio: someone 18+ with a connected wallet (the site's sign-in: an address and a free signature) describes
//      a character: its name, a few words, a style. Checked first (server/studio-words.js): PG-13, never a real person,
//      someone else's character or something passing for her.
//   2. Its quote: its prices for that wallet (src/studio/rules.js: Crush 20% off, Soulmate 40% off and one free a month),
//      holding one of the month's places for a day (STUDIO_A_MONTH; STUDIO_BURNS_A_MONTH of them by burning: a burn pays
//      nobody, while each character costs the owner Meshy's credits).
//   3. Paid from their OWN wallet app: USDG to the owner's wallet (STUDIO_PAY_TO) or $AGI burned, read on Robinhood Chain
//      (server/studio-chain.js); or a Soulmate's free one. The page never asks a wallet for a transaction (hard rule 9).
//   4. Made by Meshy (server/meshy.js), one step at a time: a model from the words, painted, given bones, taught its moves
//      (src/studio/rules.js MOVES); each step moved along by the page while it's open and by the clock every minute
//      (supabase/studio.sql's Supabase Cron → /api/feed?studio), never two at once (a lease).
//   5. Its files made small and kept (server/studio-files.js); its page, agi1.app/studio/<id>, plays its moves when someone
//      types their name. A paid one that can't be made can be tried again with new words, free.
// Off until MESHY_API_KEY is set (and studio.sql run). Private until STUDIO_OPEN=yes: until then only the wallets in
// STUDIO_ONLY_FOR may make one (Meshy's terms say its service is for the customer's own use: the owner asks Meshy before
// opening it to everyone; see CLAUDE.md). Character pages are public.
import { createHmac, randomBytes } from 'node:crypto';
import { rpc } from './limits.js';
import { readSession, makeSession, needsRecheck, RECHECK_MS } from './session.js';
import { burnKey, burnWallet, txCode } from './burn.js';
import { checkCharacter, meshyPrompt, meshyTexture } from './studio-words.js';
import { meshyStart, meshyTask, animationUrl, thumbnailUrl } from './meshy.js';
import { readPayment, amountOf, recentPayments } from './studio-chain.js';
import { priceFor, MOVES, MOVE_NAMES, ORDER_ID } from '../src/studio/rules.js';

export const STUDIO = {
  PER_WALLET: 2,              // quotes one wallet may hold at once
  LEASE_S: 45,                // a step's turn (the save step: SAVE_LEASE_S)
  SAVE_LEASE_S: 120,
  TRIES: 2,                   // a Meshy step that fails is tried again this many times
  SAVE_TRIES: 4,              // keeping its files
  MAX_MAKING_MS: 3 * 864e5,   // Meshy keeps what it made 3 days: a character not done by then can't be finished
  CHECKS: 3,                  // payments read from the chain per "Check my payment"
};
// (2026-10-10, AGI Studio) a 3D model of an influencer starts from its full-body picture ('image': Meshy's image to 3D),
// then the same bones and moves
const NEXT = { preview: 'refine', refine: 'rig', image: 'rig', rig: 'moves', moves: 'save' };
const SAVE_NEEDS_MS = 15_000;  // keeping a character's files starts only with this much time left

// ---------- settings ----------
export const studioOn = (cfg) => Boolean(cfg.meshyKey && cfg.supabaseUrl && cfg.supabaseKey && cfg.passSecret.length >= 32);
// Who may make a character: everyone once STUDIO_OPEN=yes, else only the wallets in STUDIO_ONLY_FOR (none: nobody)
export const mayMake = (cfg, wallet) => cfg.studioOpen || Boolean(cfg.studioOnlyFor?.has(String(wallet).toLowerCase()));
// A wallet's code here: an HMAC of its address (never the address), not the code her chat's memory or burns use
export const studioWallet = (secret, wallet) => createHmac('sha256', String(secret)).update(`studio-wallet:${String(wallet).toLowerCase()}`).digest('base64url').slice(0, 32);
export const newOrderId = () => randomBytes(16).toString('base64url');
// A payment's code in the database: a burn's is burns.sql's own (this transaction for this wallet: so it counts once, for
// messages or for a character), a USDG payment's its own kind of code (never mistaken for a burn's)
export const payCode = (key, kind, tx, wallet) => (kind === 'burn' ? txCode(key, tx, wallet)
  : createHmac('sha256', key).update(`studio-usdg:${String(tx).toLowerCase()}:${String(wallet).toLowerCase()}`).digest('base64url').slice(0, 32));
const isHidden = (cfg, o) => o.hidden === true || Boolean(cfg.studioHide?.has(o.id));

// ---------- the wallet a request came with ----------
// Its session (the site's sign-in), its level now: read again on the chain when it's 30 minutes old (what was burned
// counts too), like her chat's. → null (none, or it ended) · { wallet, level, session (a new one when read again) }
export async function walletNow(cfg, token, { now = Date.now(), check = null, burned = null } = {}) {
  const s = readSession(cfg.passSecret, token, now);
  if (!s) return null;
  if (!needsRecheck(s, now)) return { wallet: s.wallet, level: s.level, session: null };
  const checkLevel = check || (await import('./chain.js')).checkLevel;
  const burnedAgi = burned || (await import('./burn.js')).burnedAgi;
  const r = await checkLevel(s.wallet, s.level, undefined, await burnedAgi(cfg, s.wallet));
  const session = makeSession(cfg.passSecret, { wallet: s.wallet, level: r.level, checkedAt: r.checked ? now : now - RECHECK_MS + 5 * 60_000, expiresAt: s.expiresAt }, now);
  return { wallet: s.wallet, level: r.level, session };
}

// ---------- the database ----------
export const getOrder = async (cfg, id) => (ORDER_ID.test(String(id)) ? rpc(cfg, 'studio_get', { p_id: id }, 'studio') : null);

// What anyone with its link sees (no wallet, no payment's details beyond its price)
export function pageView(cfg, o) {
  if (!o || isHidden(cfg, o)) return null;
  const view = {
    id: o.id, name: o.name, about: o.about, style: o.style, status: o.expired ? 'expired' : o.status,
    created: Date.parse(o.created_at) || null,
  };
  if (o.status === 'quote') {
    Object.assign(view, { price: { usdCents: o.usd_cents, agi: Number(o.agi) }, free: o.free === true, kind: o.kind || null,
      paid: Number(o.paid) || 0, level: o.level });
  }
  if (o.status === 'making' || o.status === 'paid') view.step = o.step || 'preview';
  if (o.status === 'done') Object.assign(view, { moves: Array.isArray(o.moves) ? o.moves : MOVE_NAMES, done: Date.parse(o.done_at) || null, glbBytes: o.glb_bytes });
  if (o.status === 'failed') Object.assign(view, { error: o.error || 'failed', credit: o.credit === true });
  // (2026-10-10) a 3D model of an influencer (AGI Studio): its influencer's page
  if (o.inf_id) view.inf = o.inf_id;
  return view;
}

// ---------- 1 and 2: a quote ----------
// → { ok: true, id, price: { usdCents, agi }, usdg (USDG is open), burn (a burn place is left), free, left } or
//   { ok: false, field?, why }: checkCharacter's, or 'sold_out' | 'too_many' | 'closed'
export async function makeQuote(cfg, { wallet, level, name, about, style }) {
  if (!mayMake(cfg, wallet)) return { ok: false, why: 'closed' };
  const c = checkCharacter({ name, about, style });
  if (!c.ok) return c;
  const price = priceFor(level, { usdCents: cfg.studioUsdCents, agi: cfg.studioAgi });
  const key = await burnKey(cfg);
  for (let i = 0; i < 2; i++) {
    const id = newOrderId();
    const r = await rpc(cfg, 'studio_quote', {
      p_id: id, p_wallet: studioWallet(cfg.passSecret, wallet), p_burn: burnWallet(key, wallet), p_name: c.name, p_about: c.about,
      p_style: c.style, p_level: level, p_usd_cents: price.usdCents, p_agi: price.agi, p_free: level === 3,
      p_cap: cfg.studioMonthCap, p_burn_cap: cfg.studioBurnCap, p_per_wallet: STUDIO.PER_WALLET,
    }, 'studio');
    if (r?.ok === true) {
      return { ok: true, id, price, usdg: Boolean(cfg.studioPayTo), burn: r.burn_ok === true && cfg.studioBurnCap > 0, free: r.free_ok === true, left: Math.max(0, Number(r.left) || 0) };
    }
    if (r?.why !== 'taken') return { ok: false, why: ['sold_out', 'too_many'].includes(r?.why) ? r.why : 'busy' };
  }
  return { ok: false, why: 'busy' };
}

// ---------- 3: how it's paid, and the payment ----------
// → { ok: true, kind, paid } or { ok: false, why: 'no_usdg' | studio_choose's }
export async function choosePay(cfg, { id, wallet, kind }) {
  if (kind === 'usdg' && !cfg.studioPayTo) return { ok: false, why: 'no_usdg' };
  if (kind === 'burn' && cfg.studioBurnCap < 1) return { ok: false, why: 'burns_sold_out' };
  const r = await rpc(cfg, 'studio_choose', { p_id: id, p_wallet: studioWallet(cfg.passSecret, wallet), p_kind: kind, p_burn_cap: cfg.studioBurnCap }, 'studio');
  if (r?.ok === true) return { ok: true, kind: r.kind, paid: r.paid === true };
  return { ok: false, why: r?.why || 'busy' };
}

// "Check my payment": the one transaction pasted, or else the wallet's payments since the quote (the block explorer),
// each read from the chain and counted once. → { ok: true, paid, have, need, results: [{ ok, why?, amount? }], source } or
// { ok: false, why: 'gone' | 'not_yours' | 'no_kind' | 'done' } · throws with err.why 'chain' | 'explorer' when they can't say
export async function checkPayment(cfg, { id, wallet, tx = null, env, now = Date.now() }) {
  const o = await getOrder(cfg, id);
  if (!o || o.expired) return { ok: false, why: 'gone' };
  const mine = studioWallet(cfg.passSecret, wallet);
  if (o.wallet_code !== mine) return { ok: false, why: 'not_yours' };
  if (o.status !== 'quote') return { ok: true, paid: true, have: Number(o.paid) || 0, need: Number(o.paid) || 0, results: [], source: 'done' };
  if (o.kind !== 'usdg' && o.kind !== 'burn') return { ok: false, why: 'no_kind' };
  if (o.kind === 'usdg' && !cfg.studioPayTo) return { ok: false, why: 'no_usdg' };
  const after = Date.parse(o.created_at);
  const look = { kind: o.kind, wallet, payTo: cfg.studioPayTo, after, env, now };
  let list;
  if (tx) list = [tx];
  else {
    try { list = (await recentPayments(wallet, look)).map((p) => p.tx); } catch (err) { throw Object.assign(new Error(err.message), { why: 'explorer' }); }
  }
  const key = await burnKey(cfg);
  const codes = list.map((t) => payCode(key, o.kind, t, wallet));
  const seen = new Set(list.length ? await rpc(cfg, 'studio_seen', { p_txs: codes }, 'studio') || [] : []);
  const need = o.kind === 'usdg' ? o.usd_cents : Number(o.agi);
  let have = Number(o.paid) || 0, paid = false;
  const results = [];
  for (const [i, t] of list.entries()) {
    if (seen.has(codes[i])) { if (tx) results.push({ ok: false, why: 'used' }); continue; }
    if (results.length >= STUDIO.CHECKS || paid) break;
    let r;
    try { r = await readPayment(t, look); } catch (err) {
      if (tx) throw Object.assign(new Error(err.message), { why: 'chain' });
      results.push({ ok: false, why: 'chain' });
      continue;
    }
    if (!r.ok) { results.push({ ok: false, why: r.why }); continue; }
    let amount;
    try { amount = await amountOf(o.kind, r.raw, env); } catch (err) {
      if (tx) throw Object.assign(new Error(err.message), { why: 'chain' });
      results.push({ ok: false, why: 'chain' });
      continue;
    }
    if (amount < 1) { results.push({ ok: false, why: 'too_small' }); continue; }
    const s = await rpc(cfg, 'studio_pay', { p_id: id, p_wallet: mine, p_tx: codes[i], p_amount: amount }, 'studio');
    if (s?.ok !== true) { results.push({ ok: false, why: s?.why || 'busy' }); if (s?.why === 'done') { paid = true; break; } continue; }
    results.push({ ok: true, amount });
    have = Number(s.have); paid = s.paid === true;
  }
  return { ok: true, paid, have, need, results, source: tx ? 'pasted' : 'explorer' };
}

// A paid character that couldn't be made, again with new words (free). → { ok: true } or { ok: false, field?, why }
export async function redo(cfg, { id, wallet, name, about, style }) {
  const c = checkCharacter({ name, about, style });
  if (!c.ok) return c;
  const r = await rpc(cfg, 'studio_redo', { p_id: id, p_wallet: studioWallet(cfg.passSecret, wallet), p_name: c.name, p_about: c.about, p_style: c.style }, 'studio');
  return r?.ok === true ? { ok: true } : { ok: false, why: r?.why || 'busy' };
}

export async function myCharacters(cfg, wallet) {
  const list = await rpc(cfg, 'studio_mine', { p_wallet: studioWallet(cfg.passSecret, wallet), p_limit: 20 }, 'studio');
  return (Array.isArray(list) ? list : []).filter((c) => !cfg.studioHide?.has(c.id))
    .map((c) => ({ id: c.id, name: c.name, status: c.status, credit: c.credit === true, created: Date.parse(c.created_at) || null }));
}
export async function gallery(cfg) {
  const list = await rpc(cfg, 'studio_list', { p_limit: 24 }, 'studio');
  return (Array.isArray(list) ? list : []).filter((c) => !cfg.studioHide?.has(c.id)).map((c) => ({ id: c.id, name: c.name, done: Date.parse(c.done_at) || null }));
}
// This month's places, for the page (and since 2026-10-10 its videos': server/studio-video.js)
export async function monthLeft(cfg) {
  const m = await rpc(cfg, 'studio_month', {}, 'studio');
  const n = (x) => Math.max(0, Number(x) || 0);
  return {
    left: Math.max(0, cfg.studioMonthCap - n(m?.made) - n(m?.live)), burnsLeft: Math.max(0, cfg.studioBurnCap - n(m?.burns) - n(m?.burn_live)),
    videosLeft: Math.max(0, cfg.videoMonthCap - n(m?.videos) - n(m?.video_live)),
  };
}

// ---------- 4: the making, one step at a time ----------
const inputsFor = (step, o, tasks) => ({
  prompt: meshyPrompt(o), texture: meshyTexture(o), previewId: tasks.preview, refineId: tasks.refine || tasks.image, rigId: tasks.rig,
});
// It couldn't be made: a character paid for can be made again with new words (its credit); a 3D model of an influencer
// (AGI Studio, paid in credits) gets its credits back instead (or a Soulmate's free one back for this month); one it got for
// a big burn (round 2: a burn can't be given back) can be made again, free (its credit, like a character's)
async function failOrder(cfg, o, error) {
  if (!o.inf_id || o.kind === 'burn') return rpc(cfg, 'studio_fail', { p_id: o.id, p_error: error, p_credit: true }, 'studio');
  const done = await rpc(cfg, 'studio_fail', { p_id: o.id, p_error: error, p_credit: false }, 'studio');
  if (done) await rpc(cfg, 'inf_3d_back', { p_order: o.id }, 'studio');
  return done;
}
const setStep = (cfg, id, step, task, tasks, tries) => rpc(cfg, 'studio_step', { p_id: id, p_step: step, p_task: task, p_tasks: tasks, p_tries: tries }, 'studio');
const waitTurn = (cfg, id) => rpc(cfg, 'studio_wait', { p_id: id }, 'studio');

// Meshy saying no at a step's start: what it means for this character
function meshyTrouble(err) {
  if (err.why === 'key' || err.why === 'credits' || err.why === 'busy' || err.why === 'meshy') return 'wait';       // the owner's to fix, or a moment
  if (err.why === 'pose') return 'pose';
  return /moderat|harm|inappropriate|policy|violat|nsfw|sensitive/i.test(err.message) ? 'refused' : 'request';
}
const warned = new Set();
function warnOnce(what, message) {
  if (warned.has(what)) return;
  warned.add(what);
  console.error(`[studio] ${message}`);
}

// One character moved along one step, if it's its turn. → { state: 'busy' | 'waiting' | 'started' | 'done' | 'failed' |
// 'saving', step?, progress? }
export async function tick(cfg, id, { now = Date.now(), deadline = Date.now() + 20_000, files = null } = {}) {
  if (!await rpc(cfg, 'studio_lease', { p_id: id, p_secs: STUDIO.LEASE_S }, 'studio')) return { state: 'busy' };
  let o;
  try { o = await getOrder(cfg, id); } catch (err) { await waitTurn(cfg, id).catch(() => {}); throw err; }
  if (!o || !['paid', 'making'].includes(o.status)) return { state: 'busy' };
  const tasks = o.tasks && typeof o.tasks === 'object' ? { ...o.tasks } : {};
  const fail = (cfg2, id2, error) => failOrder(cfg2, o, error);
  const start = async (step, tries) => {
    const inputs = inputsFor(step, o, tasks);
    if (step === 'image') {
      // its influencer's full-body picture, by a signed address (6 hours) in the private bucket
      try {
        const F = files || await import('./studio-files.js');
        inputs.imageUrl = o.image_path ? await F.signedUrl(cfg, o.image_path, { expiresIn: 6 * 3600 }) : null;
      } catch (err) {
        console.warn(`[studio] ${id}: its picture couldn't be signed (${err.message})`);
        await waitTurn(cfg, id);
        return { state: 'waiting', step };
      }
      if (!inputs.imageUrl) {
        await fail(cfg, id, 'no_picture', true);
        return { state: 'failed', step };
      }
    }
    try {
      const task = await meshyStart(cfg, step, inputs);
      await setStep(cfg, id, step, task, tasks, tries);
      return { state: 'started', step };
    } catch (err) {
      const t = meshyTrouble(err);
      if (t === 'wait') {
        if (err.why === 'key' || err.why === 'credits') warnOnce(err.why, `a character waits: ${err.message}`);
        await waitTurn(cfg, id);
        return { state: 'waiting', step };
      }
      await fail(cfg, id, t === 'refused' ? 'refused' : t === 'pose' ? 'pose' : `ai:${step}`, true);
      console.warn(`[studio] ${id} couldn't start its ${step}: ${err.message}`);
      return { state: 'failed', step };
    }
  };
  if (o.status === 'paid' || !o.step) return start(o.inf_id ? 'image' : 'preview', 0);
  if (Date.parse(o.started_at || o.paid_at || o.created_at) < now - STUDIO.MAX_MAKING_MS) {
    await fail(cfg, id, 'expired', true);
    return { state: 'failed', step: o.step };
  }
  if (o.step === 'save') {
    if (deadline - Date.now() < SAVE_NEEDS_MS) { await waitTurn(cfg, id); return { state: 'saving' }; }
    return save(cfg, o, tasks, { now, deadline, files });
  }
  let t;
  try { t = await meshyTask(cfg, o.step, o.task); } catch (err) {
    if (err.why === 'key') warnOnce('key', `a character waits: ${err.message}`);
    await waitTurn(cfg, id);
    return { state: 'waiting', step: o.step };
  }
  if (t.status === 'PENDING' || t.status === 'IN_PROGRESS') {
    await waitTurn(cfg, id);
    return { state: 'waiting', step: o.step, progress: t.progress };
  }
  if (t.status === 'SUCCEEDED') {
    tasks[o.step] = o.task;
    const next = NEXT[o.step];
    if (next === 'save') {
      await setStep(cfg, id, 'save', null, tasks, 0);
      if (deadline - Date.now() < SAVE_NEEDS_MS) return { state: 'saving' };
      if (!await rpc(cfg, 'studio_lease', { p_id: id, p_secs: STUDIO.SAVE_LEASE_S }, 'studio')) return { state: 'saving' };
      return save(cfg, { ...o, step: 'save', task: null, tries: 0 }, tasks, { now, deadline, files });
    }
    return start(next, 0);
  }
  // FAILED or CANCELED: Meshy's screening stopped it (new words, free), or tried again, then given up (new words, free)
  if (t.refused) {
    await fail(cfg, id, 'refused', true);
    return { state: 'failed', step: o.step };
  }
  if (o.tries < STUDIO.TRIES) {
    console.warn(`[studio] ${id}'s ${o.step} failed at Meshy (${t.message || t.status}): trying again`);
    return start(o.step, o.tries + 1);
  }
  await fail(cfg, id, `ai:${o.step}`, true);
  console.warn(`[studio] ${id}'s ${o.step} failed at Meshy ${o.tries + 1} times (${t.message || t.status}): given up`);
  return { state: 'failed', step: o.step };
}

// Keeping its files: its model and picture from Meshy (fresh addresses: they expire), made small, into Storage. Every wait
// fits in the time left (a save cut off by Vercel would never count as a try), and a save that runs out of time is a try.
async function save(cfg, o, tasks, { deadline, files = null }) {
  const F = files || await import('./studio-files.js');
  const id = o.id;
  const left = (reserve, most) => Math.max(1500, Math.min(most, deadline - Date.now() - reserve));
  try {
    const painted = tasks.refine ? 'refine' : 'image';
    const [moves, refine] = await Promise.all([meshyTask(cfg, 'moves', tasks.moves, { timeoutMs: left(12_000, 6000) }),
      meshyTask(cfg, painted, tasks[painted], { timeoutMs: left(12_000, 6000) })]);
    const glbUrl = animationUrl(moves.task), picUrl = thumbnailUrl(refine.task);
    if (!glbUrl || !picUrl) throw Object.assign(new Error("Meshy's answer has no file address"), { gone: moves.status !== 'SUCCEEDED' });
    const [glbSource, picSource] = await Promise.all([F.fromMeshy(glbUrl, { timeoutMs: left(7000, 12_000) }),
      F.fromMeshy(picUrl, { max: F.PICTURE_SOURCE_MAX, timeoutMs: left(7000, 12_000) })]);
    const glb = await F.smallGlb(glbSource);
    const pic = await F.pictures(picSource);
    if (deadline - Date.now() < 2500) throw new Error('no time left to keep them');
    if (glb.clips.length !== MOVES.length) console.warn(`[studio] ${id}'s file has ${glb.clips.length} moves (${MOVES.length} asked for)`);
    const t = left(1000, 10_000);
    await Promise.all([F.putFile(cfg, `${id}.glb`, glb.bytes, 'model/gltf-binary', { timeoutMs: t }),
      F.putFile(cfg, `${id}.webp`, pic.webp, 'image/webp', { timeoutMs: t }), F.putFile(cfg, `${id}.png`, pic.png, 'image/png', { timeoutMs: t })]);
    const moveNames = MOVE_NAMES.slice(0, Math.min(MOVES.length, glb.clips.length));
    await rpc(cfg, 'studio_done', { p_id: id, p_glb: glb.bytes.length, p_pic: pic.webp.length, p_moves: moveNames }, 'studio');
    console.log(`[studio] ${id} is done: ${(glb.bytes.length / 1e6).toFixed(2)} MB, ${glb.triangles} triangles, ${moveNames.length} moves`);
    return { state: 'done' };
  } catch (err) {
    if (['key', 'credits', 'busy', 'meshy'].includes(err.why)) {    // Meshy itself, for a moment (or the owner's key): not a try
      if (err.why === 'key') warnOnce('key', `a character waits: ${err.message}`);
      await waitTurn(cfg, id);
      return { state: 'saving' };
    }
    if (err.tooBig || err.gone || o.tries + 1 >= STUDIO.SAVE_TRIES) {
      await failOrder(cfg, o, err.tooBig ? 'too_big' : 'save');
      console.warn(`[studio] ${id}'s files couldn't be kept: ${err.message}`);
      return { state: 'failed', step: 'save' };
    }
    console.warn(`[studio] ${id}'s files: ${err.message} (trying again)`);
    await setStep(cfg, id, 'save', null, tasks, o.tries + 1);
    return { state: 'saving' };
  }
}

// The clock (every minute, /api/feed?studio): the characters whose turn it is, until 19 s are used; the tidy-up every
// half hour. → { due, moved, done, failed, tidy? }
export async function studioClock(cfg, { now = Date.now(), deadline = Date.now() + 19_000, files = null } = {}) {
  const ids = await rpc(cfg, 'studio_due', { p_limit: 6 }, 'studio');
  const out = { due: Array.isArray(ids) ? ids.length : 0, moved: 0, done: 0, failed: 0 };
  for (const id of Array.isArray(ids) ? ids : []) {
    if (Date.now() > deadline - 5_000) break;
    try {
      const r = await tick(cfg, id, { now: Date.now(), deadline, files });
      if (r.state === 'started' || r.state === 'saving') out.moved += 1;
      if (r.state === 'done') out.done += 1;
      if (r.state === 'failed') out.failed += 1;
    } catch (err) {
      console.warn(`[studio] ${id}: ${err.message}`);
    }
  }
  if (new Date(now).getUTCMinutes() % 30 === 0) {
    try { out.tidy = await rpc(cfg, 'studio_tidy', {}, 'studio'); } catch (err) { console.warn(`[studio] tidy-up: ${err.message}`); }
  }
  return out;
}

// The clock's key (made by studio.sql), read once per server copy
let keyCache = null;
export const _resetStudioKey = () => { keyCache = null; };
export async function studioKey(cfg) {
  if (keyCache?.url === cfg.supabaseUrl) return keyCache.key;
  const key = await rpc(cfg, 'studio_key', {}, 'studio');
  if (typeof key !== 'string' || !/^[0-9a-f]{64}$/.test(key)) throw new Error('studio: no key (run supabase/studio.sql)');
  keyCache = { url: cfg.supabaseUrl, key };
  return key;
}
