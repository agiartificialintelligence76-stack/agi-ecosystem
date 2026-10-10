// AGI Studio, the AI influencer app (2026-10-10, studio.agi1.app; the owner: "i want it sopmething likehiggsfield ai
// influencer … and like higgsfield genjuts and then they can launch a token with it on clank … the ui will be different on
// this it will be user friendly and easy to use"; the owner's choices: their own face too, a 2D influencer with 3D as an
// extra, trend moves from our presets and their own clips, Kling V3 Standard for trend videos, credits bought with USDG,
// holder discounts and free credits a month, the trend moves made once with AI).
//   1. Someone 18+ with a connected wallet (the site's sign-in: an address and a free signature) makes an influencer three
//      ways: designed from a few choices, from a picture of a character of theirs, or from their own face (a live selfie and
//      their consent). Its words are checked first (server/inf-words.js), a picture or selfie by Gemini as it's uploaded
//      (server/inf-uploads.js). It costs credits (src/studio/rules.js PRICES, with the holder discounts).
//   2. 4 looks are made to pick from (new ones for a few credits more), then its full-body picture from the one picked.
//   3. Then, in credits: its photos in any scene, trend videos (one of the owner's trend moves, or their own clip, copied onto
//      it), scene videos, a 3D model (supabase/studio.sql's characters, from its full body: server/studio.js), and a coin on
//      clank.trade with its face (Launch with AGI-1's own launch page: their own wallet launches it).
//   Its page is public by its link; Explore shows the newest (never one made from a face, nor one its owner hid). Anyone can
//   report one; the owner's page lists reports and hides what shouldn't be there. "Delete" (for a face: "Delete my face")
//   takes it off every page at once and deletes its files.
// Off until FAL_KEY is set (and influencers.sql run). Private like the studio until STUDIO_OPEN=yes (STUDIO_ONLY_FOR).
// Round 2 (2026-10-10, the owner's list): "Use my face" is gone (a photo of a real person is allowed instead, with its
// uploader's consent: never in Explore), trend videos put the influencer into real-looking clips, example pictures for the
// design choices, a free 3D model for a big burn, burn unlocks (one more influencer, a boost in Explore: server/inf-burns.js),
// likes and the weekly spotlight with a prize (server/inf-week.js), the share mark on downloads (server/inf-mark.js) and the
// live stats board.
import { rpc } from './limits.js';
import { burnKey, burnWallet } from './burn.js';
import { studioOn, mayMake, studioWallet, newOrderId, tick as studioTick, getOrder, checkPayment } from './studio.js';
import { checkStart, checkInfScene, sceneWay } from './inf-words.js';
import { creditsOf, grantFree } from './credits.js';
import { jobTick, getJob, stepOf, infOn } from './inf-jobs.js';
import { burnsOpen } from './inf-burns.js';
import { weeksFor } from './inf-week.js';
import { PRICES, creditPrice, trendOf, TRENDS, REPORT_WHYS, TREND_ID, EXAMPLES } from '../src/studio/rules.js';

export const INF = {
  PER_WALLET: 3,               // influencers one wallet may have being made at once
  JOBS_PER_WALLET: 4,          // photos and videos one wallet may have being made at once
  REPORTS_A_DAY: 10,
};
export const ID = /^[A-Za-z0-9_-]{22}$/;
const ms = (t) => { const n = Date.parse(t ?? ''); return Number.isFinite(n) ? n : null; };
const n0 = (x) => Math.max(0, Math.floor(Number(x) || 0));

// ---------- settings ----------
// On once fal's key is set (its looks, photos and videos), with the site's database, secrets and Gemini key (its checks)
export { infOn };
// The owner (STUDIO_OWNER, else the first wallet in STUDIO_ONLY_FOR): the owner's page (trend moves, reports, taking down)
export const isOwner = (cfg, wallet) => Boolean(cfg.studioOwner && String(wallet || '').toLowerCase() === cfg.studioOwner);
const takenDown = (cfg, id) => Boolean(cfg.studioHide?.has(id));
export const priceTable = (level) => Object.fromEntries(Object.keys(PRICES).map((k) => [k, creditPrice(k, level)]));

// ---------- what the pages show ----------
// One made from a face (before round 2) or from a photo of a real person (round 2) is private: never in Explore, never liked
// or spotlit, its files never kept by the CDN
export const isPrivate = (i) => Boolean(i && (i.mode === 'face' || i.real === true || i.inf_mode === 'face' || i.inf_real === true));
// An influencer: anyone sees a ready one (by its link: Explore lists only public ones, never a private one); its own wallet
// sees it while it's made too, with its choices, its looks to pick from and what's being made
export function infView(cfg, i, { mine = false, looksFiles = null } = {}) {
  if (!i || i.status === 'deleted' || i.hidden === true || takenDown(cfg, i.id)) return null;
  if (!mine && i.status !== 'ready') return null;
  const priv = isPrivate(i);
  const boost = ms(i.boost_until);
  const v = {
    id: i.id, name: i.name, mode: i.mode, style: i.style, status: i.status, face: i.mode === 'face', real: i.real === true, private: priv,
    public: i.public === true && !priv, created: ms(i.created_at), ready: ms(i.ready_at),
    portrait: i.looks_job && Number.isInteger(i.pick) ? { job: i.looks_job, n: i.pick } : null,
    body: i.body_job || null, boosted: boost && boost > Date.now() && !priv && i.public === true ? boost : null,
  };
  if (mine) {
    Object.assign(v, { mine: true, settings: i.settings || {}, words: i.words || '', error: i.error || null });
    if (i.looks_job && ['pick', 'body', 'ready'].includes(i.status)) v.looks = { job: i.looks_job, files: looksFiles ?? 4 };
    if (i.job) v.job = { id: i.job.id, kind: i.job.kind, status: i.job.status, step: i.job.saving ? 'save' : i.job.req ? 'make' : 'queue' };
  }
  return v;
}

// One of its photos or videos: a done one for anyone; its own wallet's others too (being made, or that couldn't be made)
export function jobView(cfg, j, inf) {
  if (!j || takenDown(cfg, j.id)) return null;
  const v = {
    id: j.id, inf, kind: j.kind, scene: j.scene || null, shape: j.shape || (j.kind === 'trend' ? 'tall' : null), sound: j.sound === true,
    trend: j.trend || null, clip: j.clip === true, image: j.image || null, status: j.status, created: ms(j.created_at), done: ms(j.done_at),
    files: n0(j.files), poster: j.poster === true, mine: j.mine === true, likes: n0(j.likes), marked: j.marked === true,
  };
  if (j.mine === true) Object.assign(v, { cost: n0(j.cost), refunded: j.refunded === true, error: j.error || null, step: j.step || null });
  return v;
}

// An influencer's page: { influencer, jobs, models, mine } (wallet: the signed-in one, or null) · null (not there, or not yet
// for anyone but its own wallet)
export async function infPage(cfg, id, { wallet = null } = {}) {
  if (!ID.test(String(id)) || takenDown(cfg, id)) return null;
  const i = await rpc(cfg, 'inf_get', { p_id: id }, 'studio');
  if (!i) return null;
  const code = wallet ? studioWallet(cfg.passSecret, wallet) : null;
  const mine = Boolean(code && i.wallet_code === code);
  let looksFiles = null;
  if (mine && i.looks_job && ['pick', 'body', 'ready'].includes(i.status)) {
    const lj = await getJob(cfg, i.looks_job).catch(() => null);
    looksFiles = lj ? Math.max(1, n0(lj.files)) : 4;
  }
  const view = infView(cfg, i, { mine, looksFiles });
  if (!view) return null;
  const [jobs, models] = await Promise.all([
    rpc(cfg, 'inf_jobs', { p_inf: id, p_wallet: mine ? code : null, p_limit: 60 }, 'studio'),
    i.status === 'ready' ? rpc(cfg, 'inf_3d_list', { p_inf: id }, 'studio') : [],
  ]);
  return {
    influencer: view,
    jobs: (Array.isArray(jobs) ? jobs : []).map((j) => jobView(cfg, j, id)).filter(Boolean),
    models: (Array.isArray(models) ? models : []).filter((m) => !takenDown(cfg, m.id) && (mine || m.status === 'done') && m.expired !== true)
      .map((m) => ({
        id: m.id, status: m.status, step: m.step || null, error: mine ? m.error || null : null, moves: m.moves || null, created: ms(m.created_at),
        done: ms(m.done_at),
        // (round 2) how it's paid: a big burn's quote waits for its burn (its $AGI, and what's burned so far); one that couldn't
        // be made may be made again, free (a burn can't be given back)
        ...(mine ? { kind: m.kind || null, agi: n0(m.agi), paid: n0(m.paid), credit: m.credit === true } : {}),
      })),
    mine, raw: i,
  };
}

// Its own wallet's page moved along: one thing being made, one step (its looks or full body first, then its oldest photo or
// video, then a 3D model). → the state of what moved, or null
export async function moveAlong(cfg, page, { now = Date.now(), deadline = Date.now() + 17_000 } = {}) {
  const i = page.raw;
  if (i.job && ['paid', 'making'].includes(i.job.status)) return { what: i.job.id, ...await jobTick(cfg, i.job.id, { now, deadline }) };
  const pending = page.jobs.filter((j) => j.mine && ['paid', 'making'].includes(j.status)).sort((a, b) => (a.created ?? 0) - (b.created ?? 0));
  for (const j of pending) {
    const r = await jobTick(cfg, j.id, { now, deadline });
    if (r.state !== 'busy') return { what: j.id, ...r };
  }
  if (studioOn(cfg)) {
    const m = page.models.find((x) => ['paid', 'making'].includes(x.status));
    if (m) return { what: m.id, ...await studioTick(cfg, m.id, { now, deadline }) };
  }
  return null;
}

// This wallet: its credits (this month's free ones given first, for a holder), its influencers, its prices, whether it may
// make one, and (round 2) its slots (influencers it may have at all, and the ones it unlocked by burning), its burn unlocks
// open, and its weekly prizes (to claim, or claimed). → { credits, free, influencers, prices, allowed, owner, slots, burns, weeks }
export async function me(cfg, { wallet, level }) {
  const code = studioWallet(cfg.passSecret, wallet);
  let free = null;
  if (level >= 2) free = await grantFree(cfg, code, level);
  const [credits, list, slots, burns, weeks] = await Promise.all([
    creditsOf(cfg, code), rpc(cfg, 'inf_mine', { p_wallet: code, p_limit: 30 }, 'studio'), rpc(cfg, 'inf_slots', { p_wallet: code }, 'studio'),
    burnsOpen(cfg, wallet), weeksFor(cfg, { wallet }),
  ]);
  const extra = n0(slots?.extra);
  return {
    credits, free, prices: priceTable(level), allowed: mayMake(cfg, wallet), owner: isOwner(cfg, wallet),
    slots: { used: n0(slots?.used), extra, max: cfg.infSlots + extra },
    burns, weeks,
    influencers: (Array.isArray(list) ? list : []).filter((i) => !takenDown(cfg, i.id)).map((i) => {
      const boost = ms(i.boost_until);
      return {
        id: i.id, name: i.name, mode: i.mode, style: i.style, status: i.status, private: isPrivate(i), public: i.public === true && !isPrivate(i),
        hidden: i.hidden === true, portrait: i.looks_job && Number.isInteger(i.pick) ? { job: i.looks_job, n: i.pick } : null,
        created: ms(i.created_at), ready: ms(i.ready_at), boosted: boost && boost > Date.now() ? boost : null,
      };
    }),
  };
}

// ---------- 1: a new influencer ----------
// input: { name, mode ('design' | 'picture'), style, settings, words, source (its upload, for a picture: its consent was given
// when it was uploaded) }. → { ok: true, id, credits } or { ok: false, field?, why, have? }: checkStart's, or 'closed' |
// 'source' | 'short' | 'too_many' | 'no_slot' (its influencers at all: STUDIO_SLOTS, and more unlocked by burning) |
// 'busy_day' | 'busy'
export async function startInf(cfg, { wallet, level, input }) {
  if (!mayMake(cfg, wallet)) return { ok: false, why: 'closed' };
  const c = checkStart(input);
  if (!c.ok) return c;
  const source = c.mode === 'design' ? null : ID.test(String(input?.source)) ? input.source : null;
  if (c.mode !== 'design' && !source) return { ok: false, why: 'source' };
  const code = studioWallet(cfg.passSecret, wallet);
  for (let t = 0; t < 2; t++) {
    const id = newOrderId(), job = newOrderId();
    const r = await rpc(cfg, 'inf_start', {
      p_id: id, p_job: job, p_wallet: code, p_name: c.name, p_mode: c.mode, p_style: c.style, p_settings: c.settings, p_words: c.words,
      p_source: source, p_level: level, p_cost: creditPrice('influencer', level), p_per_wallet: INF.PER_WALLET, p_day_cap: cfg.infDayCap,
      p_slots: cfg.infSlots,
    }, 'studio');
    if (r?.ok === true) return { ok: true, id, job, credits: { paid: n0(r.paid), free: n0(r.free) } };
    if (r?.why === 'taken') continue;
    return shortOr(r);
  }
  return { ok: false, why: 'busy' };
}
// the database's "no", for the page (with what the wallet has when it's short of credits)
function shortOr(r) {
  const why = String(r?.why || 'busy');
  return why === 'short' ? { ok: false, why, have: n0(r.paid) + n0(r.free) } : { ok: false, why };
}

// ---------- 2: its looks ----------
export async function pickLook(cfg, { wallet, id, look }) {
  if (!ID.test(String(id)) || !Number.isInteger(look) || look < 0 || look > 3) return { ok: false, why: 'bad' };
  const lj = await rpc(cfg, 'inf_get', { p_id: id }, 'studio').then((i) => (i?.looks_job ? getJob(cfg, i.looks_job) : null));
  if (lj && look >= Math.max(1, n0(lj.files))) return { ok: false, why: 'bad' };
  for (let t = 0; t < 2; t++) {
    const r = await rpc(cfg, 'inf_pick', { p_id: id, p_wallet: studioWallet(cfg.passSecret, wallet), p_look: look, p_job: newOrderId() }, 'studio');
    if (r?.ok === true) return { ok: true };
    if (r?.why !== 'taken') return shortOr(r);
  }
  return { ok: false, why: 'busy' };
}
export async function rerollLooks(cfg, { wallet, level, id }) {
  if (!ID.test(String(id))) return { ok: false, why: 'bad' };
  for (let t = 0; t < 2; t++) {
    const r = await rpc(cfg, 'inf_reroll', {
      p_id: id, p_wallet: studioWallet(cfg.passSecret, wallet), p_job: newOrderId(), p_cost: creditPrice('looks', level), p_day_cap: cfg.infDayCap,
    }, 'studio');
    if (r?.ok === true) return { ok: true, credits: { paid: n0(r.paid), free: n0(r.free) } };
    if (r?.why !== 'taken') return shortOr(r);
  }
  return { ok: false, why: 'busy' };
}

// ---------- 3: its photos and videos ----------
// input: { kind: 'photo' | 'trend' | 'video', scene, shape, sound, trend (a trend move's id) | clip (their clip's upload),
// image (one of its done photos, to start from) }. → { ok: true, job, credits } or { ok: false, field?, why, have? }
export async function makeJob(cfg, { wallet, level, id, input }) {
  const kind = input?.kind;
  if (!['photo', 'trend', 'video'].includes(kind) || !ID.test(String(id))) return { ok: false, why: 'bad' };
  const i = await rpc(cfg, 'inf_get', { p_id: id }, 'studio');
  if (!i || i.status === 'deleted' || i.hidden === true || takenDown(cfg, id)) return { ok: false, why: 'gone' };
  if (i.wallet_code !== studioWallet(cfg.passSecret, wallet)) return { ok: false, why: 'not_yours' };
  if (i.status !== 'ready') return { ok: false, why: 'not_ready' };
  const image = input.image === undefined || input.image === null || input.image === '' ? null : String(input.image);
  if (image !== null && (!ID.test(image) || kind === 'photo')) return { ok: false, why: 'bad' };
  let photo = null;
  if (image) {
    photo = await getJob(cfg, image);
    if (!photo || photo.inf_id !== id || photo.kind !== 'photo' || photo.status !== 'done' || photo.hidden === true) return { ok: false, why: 'image' };
  }
  let scene = null, shape = null, sound = false, trend = null, clip = null;
  if (kind === 'photo' || kind === 'video') {
    const c = checkInfScene({ scene: input.scene, shape: photo ? photo.shape : input.shape, sound: input.sound });
    if (!c.ok) return c;
    ({ scene, shape } = c);
    sound = kind === 'video' && c.sound === true;
    if (kind === 'video' && sceneWay({ mode: i.mode, style: i.style }, { image }) === 'needs_photo') return { ok: false, why: 'needs_photo' };
  } else {
    const hasTrend = input.trend !== undefined && input.trend !== null && input.trend !== '';
    const hasClip = input.clip !== undefined && input.clip !== null && input.clip !== '';
    if (hasTrend === hasClip) return { ok: false, why: 'bad' };
    if (hasTrend) {
      if (!TREND_ID.test(String(input.trend)) || !trendOf(input.trend)) return { ok: false, why: 'trend' };
      trend = input.trend;
    } else {
      if (!ID.test(String(input.clip))) return { ok: false, why: 'clip' };
      clip = input.clip;
    }
    // (round 2) the video is the clip's own shape: a trend clip's is vertical; their own clip's, as the page read it in their
    // browser (it only decides how its tile is drawn)
    shape = clip && ['tall', 'wide', 'square'].includes(input.shape) ? input.shape : 'tall';
  }
  for (let t = 0; t < 2; t++) {
    const job = newOrderId();
    const r = await rpc(cfg, 'inf_make', {
      p_job: job, p_inf: id, p_wallet: i.wallet_code, p_kind: kind, p_scene: scene, p_shape: shape, p_sound: sound, p_trend: trend, p_clip: clip,
      p_image: image, p_cost: creditPrice(kind, level), p_per_wallet: INF.JOBS_PER_WALLET, p_day_cap: cfg.infDayCap,
    }, 'studio');
    if (r?.ok === true) return { ok: true, job, credits: { paid: n0(r.paid), free: n0(r.free) } };
    if (r?.why !== 'taken') return shortOr(r);
  }
  return { ok: false, why: 'busy' };
}

// ---------- a 3D model of it (the studio's characters, from its full body) ----------
// → { ok: true, order, free, credits } or { ok: false, why: 'no_3d' | inf_3d's }
export async function order3d(cfg, { wallet, level, id }) {
  if (!studioOn(cfg)) return { ok: false, why: 'no_3d' };
  if (!ID.test(String(id))) return { ok: false, why: 'bad' };
  const key = await burnKey(cfg);
  for (let t = 0; t < 2; t++) {
    const order = newOrderId();
    const r = await rpc(cfg, 'inf_3d', {
      p_order: order, p_inf: id, p_wallet: studioWallet(cfg.passSecret, wallet), p_burn: burnWallet(key, wallet), p_level: level,
      p_cost: creditPrice('model', level), p_cap: cfg.studioMonthCap, p_free: level === 3,
    }, 'studio');
    if (r?.ok === true) return { ok: true, order, free: r.free === true, credits: { paid: n0(r.paid), free: n0(r.free_credits) } };
    if (r?.why !== 'taken') return shortOr(r);
  }
  return { ok: false, why: 'busy' };
}

// (round 2, the owner: "large burns can make free 3d model") A 3D model for a big burn: its order waits for STUDIO_MODEL_BURN_AGI
// (25,000) $AGI burned from the wallet's own app (inside the studio's burns a month, STUDIO_BURNS_A_MONTH); asked again while
// one is open, the same one. → { ok: true, order, agi, paid, created, again } or { ok: false, why: 'no_3d' | 'burns_off' |
// inf_3d_burn's }
export async function order3dBurn(cfg, { wallet, level, id }) {
  if (!studioOn(cfg)) return { ok: false, why: 'no_3d' };
  if (!(cfg.infModelBurnAgi > 0) || cfg.studioBurnCap < 1) return { ok: false, why: 'burns_off' };
  if (!ID.test(String(id))) return { ok: false, why: 'bad' };
  const key = await burnKey(cfg);
  for (let t = 0; t < 2; t++) {
    const r = await rpc(cfg, 'inf_3d_burn', {
      p_order: newOrderId(), p_inf: id, p_wallet: studioWallet(cfg.passSecret, wallet), p_burn: burnWallet(key, wallet), p_level: level,
      p_agi: cfg.infModelBurnAgi, p_cap: cfg.studioMonthCap, p_burn_cap: cfg.studioBurnCap,
    }, 'studio');
    if (r?.ok === true) return { ok: true, order: r.order, agi: n0(r.agi), paid: n0(r.paid), created: ms(r.created), again: r.again === true };
    if (r?.why !== 'taken') return { ok: false, why: String(r?.why || 'busy') };
  }
  return { ok: false, why: 'busy' };
}
// Its "Check my burn" (the 3D studio's own: server/studio.js checkPayment, counted once, in burns.sql's ledger too) for one
// of this influencer's models. → checkPayment's answer, or { ok: false, why: 'gone' }
export async function check3dBurn(cfg, { wallet, id, order, tx = null, env, now = Date.now() }) {
  if (!ID.test(String(id)) || !ID.test(String(order))) return { ok: false, why: 'gone' };
  const o = await getOrder(cfg, order);
  if (!o || o.inf_id !== id || o.kind !== 'burn') return { ok: false, why: 'gone' };
  return checkPayment(cfg, { id: order, wallet, tx, env, now });
}
// One of them that couldn't be made, made again from the same full-body picture, free (a burn can't be given back)
// → { ok: true } or { ok: false, why: 'gone' | 'not_yours' | 'no_credit' | 'busy' }
export async function redo3d(cfg, { wallet, id, order }) {
  if (!ID.test(String(id)) || !ID.test(String(order))) return { ok: false, why: 'gone' };
  const o = await getOrder(cfg, order);
  if (!o || o.inf_id !== id || o.kind !== 'burn' || takenDown(cfg, order)) return { ok: false, why: 'gone' };
  const r = await rpc(cfg, 'studio_redo', { p_id: order, p_wallet: studioWallet(cfg.passSecret, wallet), p_name: o.name, p_about: o.about, p_style: o.style }, 'studio');
  return r?.ok === true ? { ok: true } : { ok: false, why: String(r?.why || 'busy') };
}

// ---------- shown in Explore or not, and deleting it ----------
export async function setPublic(cfg, { wallet, id, show }) {
  const r = await rpc(cfg, 'inf_public', { p_id: id, p_wallet: studioWallet(cfg.passSecret, wallet), p_public: show === true }, 'studio');
  return r?.ok === true ? { ok: true } : { ok: false, why: r?.why || 'busy' };
}

// Deleted at once from every page (for one made from a face: "Delete my face"), what's being made for it stopped (its credits
// back), its 3D models taken down, and its files deleted. → { ok: true, files } or { ok: false, why }
export async function deleteInf(cfg, { wallet, id }) {
  if (!ID.test(String(id))) return { ok: false, why: 'bad' };
  const models = await rpc(cfg, 'inf_3d_list', { p_inf: id }, 'studio').catch(() => []);
  const r = await rpc(cfg, 'inf_delete', { p_id: id, p_wallet: studioWallet(cfg.passSecret, wallet) }, 'studio');
  if (r?.ok !== true) return { ok: false, why: r?.why || 'busy' };
  const F = await import('./studio-files.js');
  let files = 0;
  for (const m of Array.isArray(models) ? models : []) {
    if (['paid', 'making'].includes(m.status)) {
      await rpc(cfg, 'studio_fail', { p_id: m.id, p_error: 'deleted', p_credit: false }, 'studio').catch(() => {});
      await rpc(cfg, 'inf_3d_back', { p_order: m.id }, 'studio').catch(() => {});
    }
    await rpc(cfg, 'studio_hide', { p_id: m.id, p_hidden: true }, 'studio').catch(() => {});
    files += await F.deleteFiles(cfg, [`${m.id}.glb`, `${m.id}.webp`, `${m.id}.png`]).catch(() => 0);
  }
  try {
    files += await F.deleteFiles(cfg, [...await F.listFiles(cfg, `inf/${id}`), ...(ID.test(String(r.source)) ? [`up/${r.source}.jpg`] : [])]);
  } catch (err) {
    console.warn(`[studio] a deleted influencer's files (they go with the tidy-up): ${err.message}`);
  }
  return { ok: true, files };
}

// ---------- reports (anyone) ----------
export async function report(cfg, { inf, job = null, why, who }) {
  if (!ID.test(String(inf)) || (job !== null && !ID.test(String(job))) || !Object.hasOwn(REPORT_WHYS, why)) return { ok: false, why: 'bad' };
  const r = await rpc(cfg, 'inf_report', { p_inf: inf, p_job: job, p_why: why, p_who: who, p_cap: INF.REPORTS_A_DAY }, 'studio');
  return r?.ok === true ? { ok: true } : { ok: false, why: r?.why || 'busy' };
}

// ---------- a coin with its face (Launch with AGI-1: their own wallet launches it, on clank.trade's own contracts) ----------
// Its launch draft, made here instead of in her Telegram bot: its name, ticker and line (her checks, server/launch.js), and
// its picture its picked look (a square portrait, from our bucket). → { ok: true, link, draft, expires } or { ok: false,
// why: 'launch_off' | 'launch_private' | 'gone' | 'not_yours' | 'not_ready' | 'coin' (reason: her check's) | 'coin_cap' | 'busy' }
export const STUDIO_PHOTO = /^studio:([A-Za-z0-9_-]{22})\/([A-Za-z0-9_-]{22})-([0-3])$/;
export async function coinDraft(cfg, { wallet, id, name, symbol, description }) {
  const L = await import('./launch.js');
  if (!L.launchReady(cfg)) return { ok: false, why: 'launch_off' };
  if (!L.launchOpen(cfg) && !isOwner(cfg, wallet) && !cfg.studioOnlyFor?.has(String(wallet).toLowerCase())) return { ok: false, why: 'launch_private' };
  const i = await rpc(cfg, 'inf_get', { p_id: id }, 'studio');
  if (!i || i.status === 'deleted' || i.hidden === true || takenDown(cfg, id)) return { ok: false, why: 'gone' };
  if (i.wallet_code !== studioWallet(cfg.passSecret, wallet)) return { ok: false, why: 'not_yours' };
  if (i.status !== 'ready' || !i.looks_job || !Number.isInteger(i.pick)) return { ok: false, why: 'not_ready' };
  const idea = L.checkIdea({ name, symbol, description });
  if (!idea.ok) return { ok: false, why: 'coin', reason: idea.why };
  for (let t = 0; t < 2; t++) {
    const draft = L.newDraftId();
    const r = await L.drafts.put(cfg, {
      id: draft, chat: L.launchWallet(cfg.passSecret, wallet), name: idea.name, symbol: idea.symbol, description: idea.description,
      photo: `studio:${id}/${i.looks_job}-${i.pick}`,
    });
    if (r?.ok === true) return { ok: true, link: L.draftUrl(draft), draft, expires: ms(r.expires) };
    if (r?.why === 'chat_cap' || r?.why === 'site_cap') return { ok: false, why: 'coin_cap' };
    if (r?.why !== 'bad') return { ok: false, why: 'busy' };
  }
  return { ok: false, why: 'busy' };
}

// A launch draft's picture when it's an influencer's (photo "studio:<influencer>/<job>-<n>"): its look, from our bucket, while
// the influencer is still there; a JPEG of 1 MB at most (Launch with AGI-1's limit). → { bytes, type } or null
export async function studioPicture(cfg, photo) {
  const m = STUDIO_PHOTO.exec(String(photo || ''));
  if (!m || takenDown(cfg, m[1])) return null;
  const i = await rpc(cfg, 'inf_get', { p_id: m[1] }, 'studio');
  if (!i || i.status === 'deleted' || i.hidden === true || i.looks_job !== m[2]) return null;
  const F = await import('./studio-files.js');
  const bytes = await F.getFile(cfg, `inf/${m[1]}/${m[2]}-${m[3]}.jpg`, { max: 4_000_000 });
  if (!bytes) return null;
  if (bytes.length <= 1_000_000) return { bytes, type: 'image/jpeg' };
  const sharp = await F.loadSharp();
  const small = await sharp(bytes).resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 84 }).toBuffer().catch(() => null);
  return small && small.length <= 1_000_000 ? { bytes: small, type: 'image/jpeg' } : null;
}

// ---------- Explore ----------
// The newest public influencers (never a private one), their newest photos and videos (with their likes), the owner's kept
// trend clips, and (round 2) the boosted influencers (a burn unlocked it) and the spotlight of the week.
const portraitOf = (x) => (x.looks_job && Number.isInteger(x.pick) ? { job: x.looks_job, n: x.pick } : null);
export async function explore(cfg) {
  const e = await rpc(cfg, 'inf_explore', { p_limit: 24 }, 'studio');
  const ok = (id) => ID.test(String(id)) && !takenDown(cfg, id);
  const sp = e?.spotlight;
  return {
    influencers: (Array.isArray(e?.influencers) ? e.influencers : []).filter((i) => ok(i.id)).map((i) => ({
      id: i.id, name: i.name, style: i.style, portrait: portraitOf(i), ready: ms(i.ready_at),
    })),
    fresh: (Array.isArray(e?.fresh) ? e.fresh : []).filter((j) => ok(j.id) && ok(j.inf_id)).map((j) => ({
      id: j.id, kind: j.kind, shape: j.shape || (j.kind === 'photo' ? 'square' : 'tall'), trend: j.trend || null, poster: j.poster === true,
      files: n0(j.files), likes: n0(j.likes), done: ms(j.done_at),
      inf: { id: j.inf_id, name: j.inf_name, portrait: portraitOf(j) },
    })),
    trends: TRENDS.map((t) => {
      const kept = (Array.isArray(e?.trends) ? e.trends : []).find((k) => k.id === t.id);
      return kept && ok(kept.job) ? { id: t.id, name: t.name, emoji: t.emoji, job: kept.job, poster: kept.poster === true } : null;
    }).filter(Boolean),
    boosted: (Array.isArray(e?.boosted) ? e.boosted : []).filter((i) => ok(i.id)).map((i) => ({
      id: i.id, name: i.name, style: i.style, portrait: portraitOf(i), until: ms(i.until),
    })),
    spotlight: sp && ok(sp.id) && ok(sp.inf_id) ? {
      week: sp.week, job: sp.id, kind: sp.kind, shape: sp.shape || (sp.kind === 'photo' ? 'square' : 'tall'), poster: sp.poster === true,
      files: n0(sp.files), holderLikes: n0(sp.holder_likes), likes: n0(sp.likes), prize: n0(sp.prize),
      inf: { id: sp.inf_id, name: sp.inf_name, portrait: portraitOf(sp) },
    } : null,
  };
}

// (round 2) The example pictures for the design choices: { key: its picture's job } (only the done ones)
export async function examplesMap(cfg) {
  const list = await rpc(cfg, 'inf_examples', {}, 'studio');
  const map = {};
  for (const x of Array.isArray(list) ? list : []) if (EXAMPLES.includes(x.key) && ID.test(String(x.done))) map[x.key] = x.done;
  return map;
}
// (round 2) The live stats board's numbers: public totals only → { influencers, photos, videos, models, today, likes, burned, boosted }
export async function stats(cfg) {
  const s = await rpc(cfg, 'inf_stats', {}, 'studio');
  const keys = ['influencers', 'photos', 'videos', 'models', 'today', 'likes', 'burned', 'boosted'];
  return Object.fromEntries(keys.map((k) => [k, n0(s?.[k])]));
}

// ---------- the owner's page ----------
// Its trend clips, the reports, and (round 2) the example pictures (each choice's: done, being made, or why not) and the
// weeks (the spotlight waiting for the owner's look, and the ones before)
export async function ownerPage(cfg) {
  const [trends, reports, examples, weeks] = await Promise.all([
    rpc(cfg, 'trend_list', {}, 'studio'), rpc(cfg, 'inf_reports', { p_limit: 60 }, 'studio'), rpc(cfg, 'inf_examples', {}, 'studio'),
    weeksFor(cfg, { owner: true, limit: 12 }),
  ]);
  const made = new Map((Array.isArray(trends) ? trends : []).map((t) => [t.id, t]));
  const ex = new Map((Array.isArray(examples) ? examples : []).map((x) => [x.key, x]));
  return {
    trends: TRENDS.map((t) => {
      const m = made.get(t.id);
      return {
        id: t.id, name: t.name, emoji: t.emoji, status: m?.status || 'none', job: m?.job || null, jobStatus: m?.job_status || null,
        error: m?.error || null, poster: m?.poster === true, updated: ms(m?.updated_at),
      };
    }),
    reports: (Array.isArray(reports) ? reports : []).map((r) => ({
      inf: r.inf_id, job: r.job_id || null, count: n0(r.count), whys: Array.isArray(r.whys) ? r.whys : [], at: ms(r.at), name: r.name, mode: r.mode,
      hidden: r.hidden === true,
    })),
    examples: EXAMPLES.map((key) => {
      const x = ex.get(key);
      return {
        key, done: ID.test(String(x?.done)) ? x.done : null, latest: ID.test(String(x?.latest)) ? x.latest : null,
        status: x?.status || 'none', error: x?.error || null,
      };
    }),
    weeks,
  };
}
// (round 2) Example pictures made (again) for these choices, by the AI service (from the owner's fal balance: no credits).
// → { ok: true, started: [keys], busy: [keys] } or { ok: false, why: 'bad' }
export async function exampleMake(cfg, keys) {
  const list = [...new Set(Array.isArray(keys) ? keys : [])];
  if (!list.length || list.length > EXAMPLES.length || list.some((k) => !EXAMPLES.includes(k))) return { ok: false, why: 'bad' };
  const started = [], busy = [];
  for (const key of list) {
    const r = await rpc(cfg, 'inf_example_make', { p_key: key, p_job: newOrderId() }, 'studio');
    (r?.ok === true ? started : busy).push(key);
  }
  return { ok: true, started, busy };
}
// One of the owner's trend moves made (again), by the AI service (from the owner's fal balance: no credits)
export async function trendMake(cfg, trend) {
  if (!TREND_ID.test(String(trend)) || !trendOf(trend)) return { ok: false, why: 'bad' };
  const sort = TRENDS.findIndex((t) => t.id === trend);
  for (let t = 0; t < 2; t++) {
    const job = newOrderId();
    const r = await rpc(cfg, 'trend_make', { p_trend: trend, p_job: job, p_sort: sort }, 'studio');
    if (r?.ok === true) return { ok: true, job };
    if (r?.why !== 'taken') return { ok: false, why: r?.why === 'busy' ? 'making' : 'busy' };
  }
  return { ok: false, why: 'busy' };
}
export async function trendSet(cfg, trend, status) {
  if (!TREND_ID.test(String(trend)) || !['kept', 'hidden'].includes(status)) return { ok: false, why: 'bad' };
  return (await rpc(cfg, 'trend_set', { p_trend: trend, p_status: status }, 'studio')) === true ? { ok: true } : { ok: false, why: 'state' };
}
export async function hide(cfg, { inf = null, job = null, hidden }) {
  if (inf !== null && ID.test(String(inf))) return (await rpc(cfg, 'inf_hide', { p_id: inf, p_hidden: hidden !== false }, 'studio')) === true ? { ok: true } : { ok: false, why: 'gone' };
  if (job !== null && ID.test(String(job))) return (await rpc(cfg, 'inf_job_hide', { p_id: job, p_hidden: hidden !== false }, 'studio')) === true ? { ok: true } : { ok: false, why: 'gone' };
  return { ok: false, why: 'bad' };
}
export async function clearReports(cfg, { inf, job = null }) {
  if (!ID.test(String(inf)) || (job !== null && !ID.test(String(job)))) return { ok: false, why: 'bad' };
  await rpc(cfg, 'inf_report_clear', { p_inf: inf, p_job: job }, 'studio');
  return { ok: true };
}

// The step a job being made is at, for the page (its own wallet's)
export const jobStep = (j) => stepOf(j);
