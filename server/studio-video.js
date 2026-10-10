// AGI-1's 3D character studio: its characters' videos (2026-10-10, the owner's next big plan, item 4: "they can create a
// viral content with it using seedance 2.5 api but they gonna pay crypto like stables instead of $agi if they hold agi they
// get a discount"; the owner's choice: about $4 in USDG for a 5-second 720p clip, before holder discounts).
//   1. On a done character's page, the wallet that made it (the site's sign-in) describes a scene ("dancing on a neon rooftop
//      in the rain"), picks its shape (vertical for TikTok, Reels and Shorts; wide; square) and whether it has sound.
//      Checked first (server/studio-words.js: the studio's rules, PG-13, never a real person or someone else's character).
//   2. Its quote: STUDIO_VIDEO_PRICE_USD (4) in USDG for a Stranger, Crush 20% off, Soulmate 40% off (the studio's
//      discounts), holding one of the month's places for a day (STUDIO_VIDEOS_A_MONTH, 30). USDG only (the owner's: never
//      $AGI for videos), no free ones.
//   3. Paid from their own wallet app (USDG to STUDIO_PAY_TO), read on Robinhood Chain like a character's payment
//      (server/studio-chain.js), each payment once: the same ledger as characters', so one payment never pays for two things.
//   4. Made by an AI video service (fal.ai's queue, server/fal.js: Seedance 2.5's reference-to-video by default) from the
//      character's own picture and the scene: 5 seconds, 720p, its shape, with sound or not; moved along by its page while
//      it's open and by the studio's clock every minute (api/feed.js ?studio), never two at once (a lease); then its MP4 is
//      kept in the studio's private bucket (videos/<id>.mp4) and played on the character's page from our own address, in
//      parts as its player asks for them (Vercel answers at most 4.5 MB; the page's CSP lets no other site's media in).
//   A paid one that can't be made (the service's safety check, no video, its file not kept) is made again with a new scene,
//   free. Off until FAL_KEY is set (and the studio is on, with STUDIO_PAY_TO: USDG only). Private like the studio.
import { createHmac } from 'node:crypto';
import { rpc } from './limits.js';
import { burnKey } from './burn.js';
import { studioOn, mayMake, studioWallet, payCode, newOrderId } from './studio.js';
import { checkScene, videoPrompt } from './studio-words.js';
import { falSubmit, falStatus, falResult, refusedText } from './fal.js';
import { readPayment, amountOf, recentPayments } from './studio-chain.js';
import { priceFor, ORDER_ID, SHAPES, VIDEO_SECONDS, VIDEO_RE } from '../src/studio/rules.js';

export const VIDEO = {
  PER_WALLET: 2,                 // video quotes one wallet may hold at once
  LEASE_S: 45,
  SAVE_LEASE_S: 120,
  TRIES: 2,                      // a request the video service gave up on is sent again this many times
  SAVE_TRIES: 4,                 // keeping its file
  MAX_MAKING_MS: 12 * 3600e3,    // a video not made in 12 hours is given up (free to try again)
  CHECKS: 3,                     // payments read from the chain per "Check my payment"
  SIGNED_S: 2 * 3600,            // a downloaded video's signed address lasts 2 hours (the CDN keeps the redirect half an hour)
};
const SAVE_NEEDS_MS = 15_000;
const FAL_WAIT = new Set(['key', 'credits', 'busy', 'fal']);

export const videosOn = (cfg) => studioOn(cfg) && Boolean(cfg.falKey) && Boolean(cfg.studioPayTo);
// the id the video service gets for who asked (it asks for one: never the wallet, nor its code here)
const falUser = (cfg, code) => createHmac('sha256', String(cfg.passSecret)).update(`fal-user:${code}`).digest('base64url').slice(0, 24);
const isHidden = (cfg, v) => v.hidden === true || v.char_hidden === true || Boolean(cfg.studioHide?.has(v.id)) || Boolean(cfg.studioHide?.has(v.char_id));
const stepOf = (v) => (v.saving ? 'save' : v.req ? 'make' : 'queue');
const warned = new Set();
function warnOnce(what, message) {
  if (warned.has(what)) return;
  warned.add(what);
  console.error(`[studio] ${message}`);
}

// ---------- the database ----------
export const getVideo = async (cfg, id) => (ORDER_ID.test(String(id)) ? rpc(cfg, 'studio_video_get', { p_id: id }, 'studio') : null);

// What a video's page shows: a done one to anyone; its own wallet's others (waiting for payment, being made, failed) only to it
export function videoView(cfg, v, { mine = false } = {}) {
  if (!v || isHidden(cfg, v)) return null;
  if (v.status !== 'done' && !mine) return null;
  const view = { id: v.id, char: v.char_id, scene: v.scene, shape: v.shape, sound: v.sound === true, status: v.expired ? 'expired' : v.status,
    created: Date.parse(v.created_at) || null };
  if (v.status === 'done') Object.assign(view, { done: Date.parse(v.done_at) || null, bytes: Number(v.bytes) || null });
  if (v.status === 'quote') Object.assign(view, { price: { usdCents: v.usd_cents }, paid: Number(v.paid) || 0, level: v.level });
  if (v.status === 'paid' || v.status === 'making') view.step = v.step || stepOf(v);
  if (v.status === 'failed') Object.assign(view, { error: v.error || 'failed', credit: v.credit === true });
  return view;
}

// A character's videos: its done ones (anyone), and its own wallet's others (wallet: the signed-in one)
export async function charVideos(cfg, char, wallet = null) {
  if (!ORDER_ID.test(String(char)) || cfg.studioHide?.has(char)) return [];
  const code = wallet ? studioWallet(cfg.passSecret, wallet) : null;
  const list = await rpc(cfg, 'studio_video_list', { p_char: char, p_wallet: code, p_limit: 24 }, 'studio');
  return (Array.isArray(list) ? list : []).map((v) => videoView(cfg, { ...v, char_id: char }, { mine: v.mine === true })).filter(Boolean);
}

// ---------- 1 and 2: a quote ----------
// → { ok: true, id, price: { usdCents }, left } or { ok: false, field?, why }: checkScene's, or 'closed' | 'no_char' |
//   'not_yours' | 'sold_out' | 'too_many' | 'busy'
export async function videoQuote(cfg, { wallet, level, char, scene, shape, sound }) {
  if (!mayMake(cfg, wallet)) return { ok: false, why: 'closed' };
  if (!ORDER_ID.test(String(char)) || cfg.studioHide?.has(char)) return { ok: false, why: 'no_char' };
  const c = checkScene({ scene, shape, sound });
  if (!c.ok) return c;
  const usdCents = priceFor(level, { usdCents: cfg.videoUsdCents, agi: 0 }).usdCents;
  for (let i = 0; i < 2; i++) {
    const id = newOrderId();
    const r = await rpc(cfg, 'studio_video_quote', {
      p_id: id, p_char: char, p_wallet: studioWallet(cfg.passSecret, wallet), p_scene: c.scene, p_shape: c.shape, p_sound: c.sound,
      p_level: level, p_usd_cents: usdCents, p_cap: cfg.videoMonthCap, p_per_wallet: VIDEO.PER_WALLET,
    }, 'studio');
    if (r?.ok === true) return { ok: true, id, price: { usdCents }, left: Math.max(0, Number(r.left) || 0) };
    if (r?.why !== 'taken') return { ok: false, why: ['sold_out', 'too_many', 'no_char', 'not_yours'].includes(r?.why) ? r.why : 'busy' };
  }
  return { ok: false, why: 'busy' };
}

// ---------- 3: "Check my payment" (USDG only) ----------
// The one transaction pasted, or else the wallet's USDG payments since the quote (the block explorer), each read from the chain
// and counted once. → { ok: true, paid, have, need, results, source } or { ok: false, why: 'gone' | 'not_yours' | 'no_usdg' } ·
// throws with err.why 'chain' | 'explorer' when they can't say
export async function checkVideoPayment(cfg, { id, wallet, tx = null, env, now = Date.now() }) {
  const v = await getVideo(cfg, id);
  if (!v || v.expired) return { ok: false, why: 'gone' };
  const mine = studioWallet(cfg.passSecret, wallet);
  if (v.wallet_code !== mine) return { ok: false, why: 'not_yours' };
  if (v.status !== 'quote') return { ok: true, paid: true, have: Number(v.paid) || 0, need: Number(v.paid) || 0, results: [], source: 'done' };
  if (!cfg.studioPayTo) return { ok: false, why: 'no_usdg' };
  const look = { kind: 'usdg', wallet, payTo: cfg.studioPayTo, after: Date.parse(v.created_at), env, now };
  let list;
  if (tx) list = [tx];
  else {
    try { list = (await recentPayments(wallet, look)).map((p) => p.tx); } catch (err) { throw Object.assign(new Error(err.message), { why: 'explorer' }); }
  }
  const key = await burnKey(cfg);
  const codes = list.map((t) => payCode(key, 'usdg', t, wallet));
  const seen = new Set(list.length ? await rpc(cfg, 'studio_seen', { p_txs: codes }, 'studio') || [] : []);
  const need = Number(v.usd_cents);
  let have = Number(v.paid) || 0, paid = false;
  const results = [];
  for (const [i, t] of list.entries()) {
    if (seen.has(codes[i])) { if (tx) results.push({ ok: false, why: 'used' }); continue; }
    if (results.length >= VIDEO.CHECKS || paid) break;
    let r;
    try { r = await readPayment(t, look); } catch (err) {
      if (tx) throw Object.assign(new Error(err.message), { why: 'chain' });
      results.push({ ok: false, why: 'chain' });
      continue;
    }
    if (!r.ok) { results.push({ ok: false, why: r.why }); continue; }
    let amount;
    try { amount = await amountOf('usdg', r.raw, env); } catch (err) {
      if (tx) throw Object.assign(new Error(err.message), { why: 'chain' });
      results.push({ ok: false, why: 'chain' });
      continue;
    }
    if (amount < 1) { results.push({ ok: false, why: 'too_small' }); continue; }
    const s = await rpc(cfg, 'studio_video_pay', { p_id: id, p_wallet: mine, p_tx: codes[i], p_amount: Math.min(amount, 10_000_000) }, 'studio');
    if (s?.ok !== true) { results.push({ ok: false, why: s?.why || 'busy' }); if (s?.why === 'done') { paid = true; break; } continue; }
    results.push({ ok: true, amount });
    have = Number(s.have); paid = s.paid === true;
  }
  return { ok: true, paid, have, need, results, source: tx ? 'pasted' : 'explorer' };
}

// A paid video that couldn't be made, again with a new scene (free). → { ok: true } or { ok: false, field?, why }
export async function videoRedo(cfg, { id, wallet, scene, shape, sound }) {
  const c = checkScene({ scene, shape, sound });
  if (!c.ok) return c;
  const r = await rpc(cfg, 'studio_video_redo', { p_id: id, p_wallet: studioWallet(cfg.passSecret, wallet), p_scene: c.scene, p_shape: c.shape, p_sound: c.sound }, 'studio');
  return r?.ok === true ? { ok: true } : { ok: false, why: r?.why || 'busy' };
}

// ---------- 4: the making ----------
const fail = (cfg, id, error, credit = true) => rpc(cfg, 'studio_video_fail', { p_id: id, p_error: error, p_credit: credit }, 'studio');
const setStep = (cfg, id, { req = null, statusUrl = null, resultUrl = null, saving = false, tries = 0 }) =>
  rpc(cfg, 'studio_video_step', { p_id: id, p_req: req, p_status_url: statusUrl, p_result_url: resultUrl, p_saving: saving, p_tries: tries }, 'studio');
const waitTurn = (cfg, id) => rpc(cfg, 'studio_video_wait', { p_id: id }, 'studio');

// What the video service gets: the character's own picture (a signed address to it, good for a few hours) as @Image1, the
// scene in words, 5 seconds of 720p in its shape, with sound or not, H.264 (so it plays in every browser), and an id for
// who asked that's neither the wallet nor its code here
export function falInput(cfg, v, picUrl) {
  return {
    prompt: videoPrompt({ scene: v.scene, style: v.char_style }),
    image_urls: [picUrl],
    resolution: '720p',
    duration: String(VIDEO_SECONDS),
    aspect_ratio: SHAPES[v.shape]?.ratio || SHAPES.tall.ratio,
    generate_audio: v.sound === true,
    bitrate_mode: 'standard',
    codec: 'H264',
    end_user_id: falUser(cfg, v.wallet_code),
  };
}

// One video moved along, if it's its turn. → { state: 'busy' | 'waiting' | 'started' | 'saving' | 'done' | 'failed', step?,
// position? (its place in the video service's queue) }
export async function videoTick(cfg, id, { now = Date.now(), deadline = Date.now() + 20_000, files = null } = {}) {
  if (!await rpc(cfg, 'studio_video_lease', { p_id: id, p_secs: VIDEO.LEASE_S }, 'studio')) return { state: 'busy' };
  let v;
  try { v = await getVideo(cfg, id); } catch (err) { await waitTurn(cfg, id).catch(() => {}); throw err; }
  if (!v || !['paid', 'making'].includes(v.status)) return { state: 'busy' };
  // its character is still there (done, not taken down): else it can't be made (made again, free, if it comes back)
  if (v.char_status !== 'done' || v.char_hidden === true || cfg.studioHide?.has(v.char_id)) {
    await fail(cfg, id, 'no_char', true);
    return { state: 'failed', step: stepOf(v) };
  }
  const F = files || await import('./studio-files.js');
  const submit = async (tries) => {
    let pic;
    try { pic = await F.signedUrl(cfg, `${v.char_id}.png`, { expiresIn: 6 * 3600 }); } catch (err) {
      console.warn(`[studio] video ${id}: its character's picture couldn't be signed (${err.message})`);
      await waitTurn(cfg, id);
      return { state: 'waiting', step: 'queue' };
    }
    if (!pic) {
      await fail(cfg, id, 'save', true);
      console.warn(`[studio] video ${id}: its character's picture isn't in the bucket`);
      return { state: 'failed', step: 'queue' };
    }
    try {
      const r = await falSubmit(cfg, cfg.videoModel, falInput(cfg, v, pic));
      await setStep(cfg, id, { req: r.req, statusUrl: r.statusUrl, resultUrl: r.resultUrl, saving: false, tries });
      return { state: 'started', step: 'make' };
    } catch (err) {
      if (FAL_WAIT.has(err.why)) {
        if (err.why === 'key' || err.why === 'credits') warnOnce(err.why, `a video waits: ${err.message}`);
        await waitTurn(cfg, id);
        return { state: 'waiting', step: 'queue' };
      }
      await fail(cfg, id, err.why === 'refused' ? 'refused' : 'ai:make', true);
      console.warn(`[studio] video ${id} couldn't be sent to the video service: ${err.message}`);
      return { state: 'failed', step: 'queue' };
    }
  };
  if (v.status === 'paid' || !v.req) return submit(Number(v.tries) || 0);
  if (Date.parse(v.started_at || v.paid_at || v.created_at) < now - VIDEO.MAX_MAKING_MS) {
    await fail(cfg, id, 'expired', true);
    return { state: 'failed', step: stepOf(v) };
  }
  if (v.saving) {
    if (deadline - Date.now() < SAVE_NEEDS_MS) { await waitTurn(cfg, id); return { state: 'saving', step: 'save' }; }
    return save(cfg, v, F, { deadline });
  }
  let s;
  try { s = await falStatus(cfg, v.status_url); } catch (err) {
    if (err.why === 'key' || err.why === 'credits') warnOnce(err.why, `a video waits: ${err.message}`);
    await waitTurn(cfg, id);
    return { state: 'waiting', step: 'make' };
  }
  if (s.status === 'IN_QUEUE' || s.status === 'IN_PROGRESS') {
    await waitTurn(cfg, id);
    return { state: 'waiting', step: s.status === 'IN_QUEUE' ? 'queue' : 'make', ...(s.status === 'IN_QUEUE' && s.position !== null ? { position: s.position } : {}) };
  }
  // done at the video service: with an error (its safety check: a new scene, free; else sent again, then given up), or made
  if (s.error || s.errorType) {
    if (refusedText(s.error) || refusedText(s.errorType)) {
      await fail(cfg, id, 'refused', true);
      return { state: 'failed', step: 'make' };
    }
    const tries = Number(v.tries) || 0;
    if (tries < VIDEO.TRIES) {
      console.warn(`[studio] video ${id} failed at the video service (${s.errorType || s.error}): sending it again`);
      return submit(tries + 1);
    }
    await fail(cfg, id, 'ai:make', true);
    console.warn(`[studio] video ${id} failed at the video service ${tries + 1} times (${s.errorType || s.error}): given up`);
    return { state: 'failed', step: 'make' };
  }
  await setStep(cfg, id, { req: v.req, statusUrl: v.status_url, resultUrl: v.result_url, saving: true, tries: 0 });
  if (deadline - Date.now() < SAVE_NEEDS_MS) return { state: 'saving', step: 'save' };
  if (!await rpc(cfg, 'studio_video_lease', { p_id: id, p_secs: VIDEO.SAVE_LEASE_S }, 'studio')) return { state: 'saving', step: 'save' };
  return save(cfg, { ...v, saving: true, tries: 0 }, F, { deadline });
}

// Keeping its file: the video the service made, read from its media address, kept as it is in the private bucket. Every wait
// fits in the time left; a save that runs out of time is a try.
async function save(cfg, v, F, { deadline }) {
  const id = v.id;
  const left = (reserve, most) => Math.max(1500, Math.min(most, deadline - Date.now() - reserve));
  try {
    const r = await falResult(cfg, v.result_url, { timeoutMs: left(12_000, 6000) });
    const bytes = await F.fromFal(r.url, { timeoutMs: left(6000, 14_000) });
    if (!F.isMp4(bytes)) throw new Error("files: its video isn't an MP4");
    if (deadline - Date.now() < 2500) throw new Error('no time left to keep it');
    await F.putFile(cfg, `videos/${id}.mp4`, bytes, 'video/mp4', { timeoutMs: left(1000, 12_000) });
    await rpc(cfg, 'studio_video_done', { p_id: id, p_bytes: bytes.length }, 'studio');
    console.log(`[studio] video ${id} is done: ${(bytes.length / 1e6).toFixed(2)} MB`);
    return { state: 'done', step: 'save' };
  } catch (err) {
    if (err.why === 'refused' || err.why === 'nothing') {
      await fail(cfg, id, err.why === 'refused' ? 'refused' : 'ai:make', true);
      console.warn(`[studio] video ${id}: ${err.message}`);
      return { state: 'failed', step: 'save' };
    }
    if (FAL_WAIT.has(err.why)) {
      if (err.why === 'key' || err.why === 'credits') warnOnce(err.why, `a video waits: ${err.message}`);
      await waitTurn(cfg, id);
      return { state: 'saving', step: 'save' };
    }
    const tries = Number(v.tries) || 0;
    if (err.tooBig || err.gone || tries + 1 >= VIDEO.SAVE_TRIES) {
      await fail(cfg, id, err.tooBig ? 'too_big' : 'save', true);
      console.warn(`[studio] video ${id}'s file couldn't be kept: ${err.message}`);
      return { state: 'failed', step: 'save' };
    }
    console.warn(`[studio] video ${id}'s file: ${err.message} (trying again)`);
    await setStep(cfg, id, { req: v.req, statusUrl: v.status_url, resultUrl: v.result_url, saving: true, tries: tries + 1 });
    return { state: 'saving', step: 'save' };
  }
}

// The clock (every minute, with the characters': api/feed.js ?studio): the videos whose turn it is, until its time is used.
// → { due, moved, done, failed }
export async function videoClock(cfg, { now = Date.now(), deadline = Date.now() + 19_000, files = null } = {}) {
  const ids = await rpc(cfg, 'studio_video_due', { p_limit: 4 }, 'studio');
  const out = { due: Array.isArray(ids) ? ids.length : 0, moved: 0, done: 0, failed: 0 };
  for (const id of Array.isArray(ids) ? ids : []) {
    if (Date.now() > deadline - 5_000) break;
    try {
      const r = await videoTick(cfg, id, { now: Date.now(), deadline, files });
      if (r.state === 'started' || r.state === 'saving') out.moved += 1;
      if (r.state === 'done') out.done += 1;
      if (r.state === 'failed') out.failed += 1;
    } catch (err) {
      console.warn(`[studio] video ${id}: ${err.message}`);
    }
  }
  return out;
}

// ---------- its file ----------
// A done video's file, from our own address (so the page's CSP lets no other site's media in):
//   played (range: the "Range" its player asks with): the part asked for, at most PART bytes (Vercel answers at most 4.5 MB)
//     → { status: 206, bytes, start, end, total } | { status: 416, total } (a part it can't be);
//   asked for whole (no range): itself when it's small enough → { status: 200, bytes }, else a short-lived signed address to
//     it in the bucket (opened in a tab: Storage serves it) → { status: 302, url };
//   downloaded (download: true): a signed address that downloads it with its own name → { status: 302, url }.
// → or { status: 400 | 404 } · throws (err.db: the database; else Storage)
export async function videoFile(cfg, file, { download = false, range = null } = {}) {
  const m = VIDEO_RE.exec(String(file || ''));
  if (!m) return { status: 400 };
  let v;
  try { v = await getVideo(cfg, m[1]); } catch (err) { throw Object.assign(err, { db: true }); }
  if (!v || v.status !== 'done' || isHidden(cfg, v)) return { status: 404 };
  const F = await import('./studio-files.js');
  const path = `videos/${v.id}.mp4`;
  const total = Number(v.bytes);
  if (!download) {
    const r = F.byteRange(range, total);
    if (r === 'bad') return { status: 416, total };
    if (r) {
      const bytes = await F.getRange(cfg, path, r);
      return bytes ? { status: 206, bytes, start: r.start, end: r.end, total } : { status: 404 };
    }
    if (total > 0 && total <= F.PART) {
      const bytes = await F.getFile(cfg, path, { max: F.PART });
      return bytes ? { status: 200, bytes } : { status: 404 };
    }
  }
  const name = download ? `${String(v.char_name || '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'character'}-AI-video.mp4` : null;
  const url = await F.signedUrl(cfg, path, { expiresIn: VIDEO.SIGNED_S, download: name });
  return url ? { status: 302, url } : { status: 404 };
}
