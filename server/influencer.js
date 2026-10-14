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
// Round 4 (2026-10-11, the owner's next list): an X banner is a kind of photo (1500 × 500, never what a video starts from),
// a maker's clank.trade username shows with their public influencers ("by @name": server/clank-names.js), and what's being
// made says when it started (its progress bar on the page). Its phase 4: the model menu (a photo's model and quality, a
// video's model, seconds, quality and sound: each priced at about 1.8× its AI cost, src/studio/rules.js), reference
// pictures (the person's own: things, places, pets, food, a style), long videos (in parts, up to a minute) and memes (a
// photo with its format and words).
// The editor (2026-10-12, the owner's choices): "Make another" (the same words and settings, next to it, at the price of making
// it now), "Delete" (its maker's, off every page for good) and "Edit with words" (a new photo from one of its own, with one
// change typed in words: the same shape and quality, at that photo's price); and the photo editor (in its maker's own browser,
// free: a photo saved from it is server/inf-editor.js's), and the video editor (free, 10 a day: a video saved from it is made by
// our clock, server/inf-cut.js; its page moves it along only for its look, and "Make another" never makes one again).
// The 3D tool's choices (2026-10-13, the owner: "i wish theres more tools to customize the 3d like in meshy"; the owner's
// choices: its moves, its shape and look, more downloads, "Per extra, ~1.8×", "30 days"): a 3D model's order carries its
// choices (src/studio/rules.js modelSpec), its words checked first, its price its standard price and its extras; its extra
// downloads are its maker's alone (dl3d: made by the studio's clock, server/studio-dl.js, kept DL_DAYS days).
import { rpc } from './limits.js';
import { burnKey, burnWallet } from './burn.js';
import { studioOn, studioWallet, newOrderId, tick as studioTick, getOrder, checkPayment } from './studio.js';
import { checkStart, checkInfScene, sceneWay, checkMemeText, checkEdit } from './inf-words.js';
import { checkModelWords } from './studio-words.js';
import { creditsOf, grantFree } from './credits.js';
import { jobTick, getJob, stepOf, infOn, picPath, frameOf, jobFiles } from './inf-jobs.js';
import { burnsOpen } from './inf-burns.js';
import { weeksFor } from './inf-week.js';
import { nameOf } from './clank-names.js';
import {
  PRICES, creditPrice, trendOf, TRENDS, REPORT_WHYS, TREND_ID, EXAMPLES, CLANK_NAME, clankProfileUrl, REFS, refsFor, WITH_AGI1,
  photoSpec, photoCredits, videoSpec, videoCredits, WAYS, drawnStyle, FRAME, isFrame, portraitRow, STUDIO_PHOTO, editSpec,
  modelSpec, modelSpecField, modelCost, isDefaultSpec, burnable, DL_FORMATS, dlPath, MODEL_DEFAULT,
} from '../src/studio/rules.js';

export const INF = {
  PER_WALLET: 3,               // influencers one wallet may have being made at once
  JOBS_PER_WALLET: 4,          // photos and videos one wallet may have being made at once
  REPORTS_A_DAY: 10,
};
export const ID = /^[A-Za-z0-9_-]{22}$/;
const ms = (t) => { const n = Date.parse(t ?? ''); return Number.isFinite(n) ? n : null; };
const n0 = (x) => Math.max(0, Math.floor(Number(x) || 0));
// (round 4) a maker's clank.trade username, as the pages show it ("by @name", a link to their profile), or null
const makerOf = (name) => (typeof name === 'string' && CLANK_NAME.test(name) ? { name: name.toLowerCase(), url: clankProfileUrl(name.toLowerCase()) } : null);

// ---------- settings ----------
// On once fal's key is set (its looks, photos and videos), with the site's database, secrets and Gemini key (its checks)
export { infOn };
// The owner (STUDIO_OWNER, else the first wallet in STUDIO_ONLY_FOR): the owner's page (trend moves, reports, taking down)
export const isOwner = (cfg, wallet) => Boolean(cfg.studioOwner && String(wallet || '').toLowerCase() === cfg.studioOwner);
// (taken down by the owner's setting, STUDIO_HIDE; since 2026-10-12 the photo editor's save asks too: server/inf-editor.js)
export const takenDown = (cfg, id) => Boolean(cfg.studioHide?.has(id));
export const priceTable = (level) => Object.fromEntries(Object.keys(PRICES).map((k) => [k, creditPrice(k, level)]));
// (2026-10-11) its profile picture as the pages show it: the square its maker framed (while the picture it was framed from is
// shown, and neither is taken down), else its picked look → { job, n } or null; and its picked look itself
const portraitFor = (cfg, x) => portraitRow(x, (id) => takenDown(cfg, id));
const lookOf = (x) => (x?.looks_job && Number.isInteger(x.pick) ? { job: x.looks_job, n: x.pick } : null);
// one of its own pictures, done and shown: one of its looks, its full body or one of its photos (n: which of its pictures)
const sourceOk = (cfg, j, inf, n) => Boolean(j && j.inf_id === inf && ['looks', 'body', 'photo'].includes(j.kind) && j.status === 'done'
  && j.hidden !== true && !takenDown(cfg, j.id) && Number.isInteger(n) && n >= 0 && n < Math.max(1, n0(j.files)));
// a picture and its frame as the page sends them ({ job, n, x, y, s }) → the same, checked, or null
const framedOf = (x) => {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const f = { job: x.job, n: x.n, x: x.x, y: x.y, s: x.s };
  return ID.test(String(f.job)) && Number.isInteger(f.n) && f.n >= 0 && f.n <= 3 && isFrame(f) ? f : null;
};

// ---------- what the pages show ----------
// One made from a face (before round 2) or from a photo of a real person (round 2) is private: never in Explore, never liked
// or spotlit, its files never kept by the CDN
export const isPrivate = (i) => Boolean(i && (i.mode === 'face' || i.real === true || i.inf_mode === 'face' || i.inf_real === true));
// An influencer: anyone sees a ready one (by its link: Explore lists only public ones, never a private one); its own wallet
// sees it while it's made too, with its choices, its looks to pick from and what's being made
export function infView(cfg, i, { mine = false, looksFiles = null } = {}) {
  if (!i || i.status === 'deleted' || i.hidden === true || takenDown(cfg, i.id)) return null;
  if (!mine && i.status !== 'ready') return null;
  // (round 4, phase 2) a banned maker's influencers: shown to nobody but itself (a mod lifts the ban)
  if (!mine && i.banned === true) return null;
  const priv = isPrivate(i);
  const boost = ms(i.boost_until);
  // (2026-10-11) how one made from a picture started (src/studio/rules.js WAYS): 4 looks to pick from, just its full body, or
  // the photo as it is (no looks to pick from: its portrait is cut from its full body)
  const way = Object.hasOwn(WAYS, i.way) ? i.way : 'looks';
  const v = {
    id: i.id, name: i.name, mode: i.mode, style: i.style, way, status: i.status, face: i.mode === 'face', real: i.real === true, private: priv,
    public: i.public === true && !priv, created: ms(i.created_at), ready: ms(i.ready_at),
    // (2026-10-11) its profile picture: the square its maker framed, else its picked look (look: always its picked look)
    portrait: portraitFor(cfg, i), look: lookOf(i),
    body: i.body_job || null, boosted: boost && boost > Date.now() && !priv && i.public === true ? boost : null,
    // (round 4) its maker's clank.trade username: only on a public one (shown in Explore), never a private one
    maker: !priv && i.public === true ? makerOf(i.maker) : null,
  };
  if (mine) {
    Object.assign(v, { mine: true, settings: i.settings || {}, words: i.words || '', error: i.error || null, banned: i.banned === true });
    // (2026-10-11) the picture its profile picture was framed from, and the frame (its picker starts there)
    const p = i.pfp;
    v.pfp = p && v.portrait && v.portrait.job === p.id ? { job: p.job, n: n0(p.n), x: n0(p.x), y: n0(p.y), s: n0(p.s) } : null;
    if (way === 'looks' && i.looks_job && ['pick', 'body', 'ready'].includes(i.status)) v.looks = { job: i.looks_job, files: looksFiles ?? 4 };
    if (i.job) {
      v.job = { id: i.job.id, kind: i.job.kind, status: i.job.status, step: i.job.saving ? 'save' : i.job.req ? 'make' : 'queue', created: ms(i.job.created) };
    }
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
    // (round 4, phase 4) its model, quality and seconds (none: made before the menu), a long video's parts, a meme's format
    // and words, and how many reference pictures it has (never which)
    model: j.model || null, quality: j.quality || null, seconds: Number.isFinite(Number(j.seconds)) && j.seconds !== null ? Number(j.seconds) : null,
    parts: Math.max(1, n0(j.parts)), part: n0(j.part), meme: j.meme || null, caption: j.caption || null, refs: n0(j.refs),
    // (2026-10-12, the editor) the change "Edit with words" made to the photo it's made from (image); and a photo saved from
    // the photo editor (made in its maker's browser from that one: free, no AI)
    edit: j.edit || null, editor: j.editor === true,
    // (2026-10-13) AGI-1 is in it ("With AGI-1", "Add AGI-1", or made from one with her)
    agi1: j.agi1 === true,
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
  if (mine && (i.way || 'looks') === 'looks' && i.looks_job && ['pick', 'body', 'ready'].includes(i.status)) {
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
        done: ms(m.done_at), started: ms(m.started_at),
        // (round 2) how it's paid: a big burn's quote waits for its burn (its $AGI, and what's burned so far); one that couldn't
        // be made may be made again, free (a burn can't be given back)
        ...(mine ? { kind: m.kind || null, agi: n0(m.agi), paid: n0(m.paid), credit: m.credit === true } : {}),
        // (2026-10-13, the 3D tool) its choices as its page shows them (its moves, its detail, pose and height: anyone), and its
        // maker's own: its look in words and its moves' words, and its extra downloads (asked for, ready, being made, couldn't be
        // made, and until when they're kept)
        ...modelInfo(m, mine),
      })),
    mine, raw: i,
  };
}

// Its own wallet's page moved along: one thing being made, one step (its looks or full body first, then its oldest photo or
// video, then a 3D model). → the state of what moved, or null
export async function moveAlong(cfg, page, { now = Date.now(), deadline = Date.now() + 17_000 } = {}) {
  const i = page.raw;
  if (i.job && ['paid', 'making'].includes(i.job.status)) return { what: i.job.id, ...await jobTick(cfg, i.job.id, { now, deadline }) };
  // (2026-10-12) a video editor's cut is made by our clock only (ffmpeg): its page moves it along only for its look
  const pending = page.jobs.filter((j) => j.mine && ['paid', 'making'].includes(j.status) && !(j.kind === 'video' && j.editor && j.step !== 'save'))
    .sort((a, b) => (a.created ?? 0) - (b.created ?? 0));
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
// make one (while AGI Studio is private: whether it's on its list, server/inf-team.js canUse), and (round 2) its slots
// (influencers it may have at all, and the ones it unlocked by burning), its burn unlocks open, and its weekly prizes (to
// claim, or claimed); (round 4) the clank.trade username it shows, if any; (2026-10-13) a Soulmate's free 3D model this month:
// true (still to use), false (used, or not a Soulmate) or null (unknown: 3D models are off, or the database didn't say), so
// the page never says "free" to a Soulmate whose free model is used (our server charged its price then, the page said Free).
// → { credits, free, influencers, prices, allowed, owner, slots, burns, weeks, clank, freeModel }
export async function me(cfg, { wallet, level }) {
  const code = studioWallet(cfg.passSecret, wallet);
  const { canUse } = await import('./inf-team.js');
  let free = null;
  if (level >= 2) free = await grantFree(cfg, code, level);
  const [credits, list, slots, burns, weeks, clank, allowed, freeUsed] = await Promise.all([
    creditsOf(cfg, code), rpc(cfg, 'inf_mine', { p_wallet: code, p_limit: 30 }, 'studio'), rpc(cfg, 'inf_slots', { p_wallet: code }, 'studio'),
    burnsOpen(cfg, wallet), weeksFor(cfg, { wallet }),
    nameOf(cfg, wallet).catch((err) => {
      if (err?.code !== 'PGRST202') console.warn(`[studio] a clank.trade name: ${err?.message}`);
      return null;
    }),
    canUse(cfg, wallet),
    level === 3 && studioOn(cfg) ? rpc(cfg, 'studio_free_used', { p_wallet: code }, 'studio').catch(() => null) : null,
  ]);
  const extra = n0(slots?.extra);
  return {
    credits, free, prices: priceTable(level), allowed, owner: isOwner(cfg, wallet),
    freeModel: level === 3 ? (typeof freeUsed === 'boolean' ? !freeUsed : null) : false,
    slots: { used: n0(slots?.used), extra, max: cfg.infSlots + extra },
    burns, weeks, clank: makerOf(clank),
    influencers: (Array.isArray(list) ? list : []).filter((i) => !takenDown(cfg, i.id)).map((i) => {
      const boost = ms(i.boost_until);
      return {
        id: i.id, name: i.name, mode: i.mode, style: i.style, status: i.status, private: isPrivate(i), public: i.public === true && !isPrivate(i),
        hidden: i.hidden === true, portrait: portraitFor(cfg, i),
        created: ms(i.created_at), ready: ms(i.ready_at), boosted: boost && boost > Date.now() ? boost : null,
      };
    }),
  };
}

// ---------- 1: a new influencer ----------
// input: { name, mode ('design' | 'picture'), style (since 2026-10-11 optional: none is 'auto'), settings, words, source (its
// upload, for a picture: its consent was given when it was uploaded), way (2026-10-11, from a picture: 'looks', 'body' or
// 'asis', src/studio/rules.js WAYS, each its price) }. → { ok: true, id, credits } or { ok: false, field?, why, have? }:
// checkStart's, or 'closed' | 'source' | 'not_full' (the photo as it is: only a photo of the whole person, head to feet) |
// 'short' | 'too_many' | 'no_slot' (its influencers at all: STUDIO_SLOTS, and more unlocked by burning) | 'busy_day' | 'busy'
export async function startInf(cfg, { wallet, level, input }) {
  const { canUse } = await import('./inf-team.js');
  if (!(await canUse(cfg, wallet))) return { ok: false, why: 'closed' };
  const c = checkStart(input);
  if (!c.ok) return c;
  const source = c.mode === 'design' ? null : ID.test(String(input?.source)) ? input.source : null;
  if (c.mode !== 'design' && !source) return { ok: false, why: 'source' };
  const code = studioWallet(cfg.passSecret, wallet);
  for (let t = 0; t < 2; t++) {
    const id = newOrderId(), job = newOrderId();
    const r = await rpc(cfg, 'inf_start', {
      p_id: id, p_job: job, p_wallet: code, p_name: c.name, p_mode: c.mode, p_style: c.style, p_settings: c.settings, p_words: c.words,
      p_source: source, p_level: level, p_cost: creditPrice(WAYS[c.way].price, level), p_per_wallet: INF.PER_WALLET, p_day_cap: cfg.infDayCap,
      p_slots: cfg.infSlots, p_way: c.way,
    }, 'studio');
    if (r?.ok === true) return { ok: true, id, job, credits: { paid: n0(r.paid), free: n0(r.free), bonus: n0(r.bonus) } };
    if (r?.why === 'taken') continue;
    return shortOr(r);
  }
  return { ok: false, why: 'busy' };
}
// the database's "no", for the page (with what the wallet has when it's short of credits: since round 4's phase 3 its bonus
// ones too)
function shortOr(r) {
  const why = String(r?.why || 'busy');
  return why === 'short' ? { ok: false, why, have: n0(r.paid) + n0(r.free) + n0(r.bonus) } : { ok: false, why };
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
    if (r?.ok === true) return { ok: true, credits: { paid: n0(r.paid), free: n0(r.free), bonus: n0(r.bonus) } };
    if (r?.why !== 'taken') return shortOr(r);
  }
  return { ok: false, why: 'busy' };
}

// ---------- 3: its photos and videos ----------
// input: { kind: 'photo' | 'trend' | 'video', scene, shape, sound, trend (a trend move's id) | clip (their clip's upload),
// image (one of its done photos, to start from) }. (Round 4) a photo's shape may be 'banner' (an X banner, at its own price);
// a video or a trend video never starts from one ('banner'). (2026-10-12, the editor) a photo with image and edit (a change in
// words): "Edit with words", a new photo from that one (a meme or an X banner too), its scene, shape, quality and a meme's words
// the photo's own (src/studio/rules.js editSpec), at that photo's price. (2026-10-13, "With AGI-1": src/studio/rules.js
// WITH_AGI1) agi1: true puts AGI-1 in a photo, a meme, an X banner or a video, at the same price: a photo by Classic only
// ('agi1_model'); a Standard, Pro or Long video from a photo she's in ('agi1_photo'), Anime from her own pictures; never a
// trend video ('agi1_trend'). A photo with image and agi1 and no edit is "Add AGI-1": she's put into that photo (its scene,
// shape, quality and a meme's words its own, at its price, like an edit; 'agi1_has' when she's in it already). An edit of a
// photo with her, and a video from one, have her too. → { ok: true, job, credits } or { ok: false, field?, why, have? }
export async function makeJob(cfg, { wallet, level, id, input }) {
  const kind = input?.kind;
  if (!['photo', 'trend', 'video'].includes(kind) || !ID.test(String(id))) return { ok: false, why: 'bad' };
  // (2026-10-13) "With AGI-1": a yes or a no, nothing else; never in a trend video (it puts the influencer in place of one person)
  if (input.agi1 !== undefined && input.agi1 !== null && typeof input.agi1 !== 'boolean') return { ok: false, why: 'bad' };
  const askedHer = input.agi1 === true;
  if (askedHer && !WITH_AGI1.KINDS.includes(kind)) return { ok: false, why: 'agi1_trend' };
  // (round 4, phase 4) its reference pictures: 1 to 4 of the person's own uploads (the database checks they're theirs, passed
  // and fresh); never on a trend video
  let refs = null;
  if (input.refs !== undefined && input.refs !== null && !(Array.isArray(input.refs) && input.refs.length === 0)) {
    if (kind === 'trend' || !Array.isArray(input.refs) || input.refs.length > REFS.MAX || !input.refs.every((r) => ID.test(String(r)))
      || new Set(input.refs.map(String)).size !== input.refs.length) return { ok: false, why: 'refs' };
    refs = input.refs.map(String);
  }
  const i = await rpc(cfg, 'inf_get', { p_id: id }, 'studio');
  if (!i || i.status === 'deleted' || i.hidden === true || takenDown(cfg, id)) return { ok: false, why: 'gone' };
  if (i.wallet_code !== studioWallet(cfg.passSecret, wallet)) return { ok: false, why: 'not_yours' };
  if (i.status !== 'ready') return { ok: false, why: 'not_ready' };
  const image = input.image === undefined || input.image === null || input.image === '' ? null : String(input.image);
  // (2026-10-12, the editor) "Edit with words": a photo made from one of its own (image) with a change typed in words (edit);
  // a photo starts from another one only that way
  const editing = input.edit !== undefined && input.edit !== null && input.edit !== '';
  // (2026-10-13) "Add AGI-1": she's put into one of its own photos (a meme, an X banner), without words
  const adding = kind === 'photo' && !editing && askedHer && image !== null;
  if (editing && (kind !== 'photo' || image === null)) return { ok: false, why: 'bad' };
  if (image !== null && (!ID.test(image) || (kind === 'photo' && !editing && !adding))) return { ok: false, why: 'bad' };
  let photo = null;
  if (image) {
    photo = await getJob(cfg, image);
    if (!photo || photo.inf_id !== id || photo.kind !== 'photo' || photo.status !== 'done' || photo.hidden === true || photo.deleted_at) return { ok: false, why: 'image' };
    // (an X banner never starts a video or a trend video; edited, or with AGI-1 added, it's an X banner again)
    if (photo.shape === 'banner' && !editing && !adding) return { ok: false, why: 'banner' };
    // (she's in it already: nothing to add; an edit never adds her: "Add AGI-1" does; a trend video never starts from a photo
    // with her: it puts the influencer in place of one person, and the photo is only more views of it)
    if (adding && photo.agi1 === true) return { ok: false, why: 'agi1_has' };
    if (editing && askedHer && photo.agi1 !== true) return { ok: false, why: 'bad' };
    if (kind === 'trend' && photo.agi1 === true) return { ok: false, why: 'agi1_trend' };
  }
  // (2026-10-13) whether she's in it: asked for; or an edit of a photo with her, or a video from one (she's in its first frame)
  const her = askedHer || (photo?.agi1 === true && (editing || kind === 'video'));
  let scene = null, shape = null, sound = false, trend = null, clip = null, edit = null;
  let model = null, quality = null, seconds = null, parts = 1, meme = null, caption = null, cost;
  if ((kind === 'photo' && !editing && !adding) || kind === 'video') {
    // (2026-10-13: with AGI-1 in it, its words may name her)
    const c = checkInfScene({ scene: input.scene, shape: photo ? photo.shape : input.shape, sound: input.sound, kind, agi1: her });
    if (!c.ok) return c;
    ({ scene, shape } = c);
    sound = kind === 'video' && c.sound === true;
  }
  if (kind === 'photo' && (editing || adding)) {
    // an edit: its change, checked like a scene (PG-13, nobody real by name, no links; her name only when she's in it); "Add
    // AGI-1": no words. No reference pictures either way; the rest is the photo's own: its scene (as it says where it is),
    // shape, a meme's format and words, its quality (Classic: editSpec)
    let e = null;
    if (editing) {
      e = checkEdit(input.edit, { agi1: her });
      if (!e.ok) return e;
    }
    if (refs) return { ok: false, why: 'refs' };
    const spec = editSpec(photo);
    cost = photoCredits(spec, level);
    if (!spec || !Number.isFinite(cost) || !photo.scene || (spec.meme && !photo.caption)) return { ok: false, why: 'image' };
    ({ model, quality, shape, meme } = spec);
    if (e) ({ edit } = e);
    scene = String(photo.scene);
    caption = meme ? String(photo.caption) : null;
  } else if (kind === 'photo') {
    // (phase 4) a meme: its format and words (checked like a caption's: PG-13, never about money)
    if (input.meme !== undefined && input.meme !== null && input.meme !== '') {
      if (shape === 'banner') return { ok: false, why: 'bad' };
      const m = checkMemeText({ meme: input.meme, lines: input.lines, agi1: her });
      if (!m.ok) return m;
      ({ meme, caption } = m);
    }
    const spec = photoSpec({ model: input.model ?? null, quality: input.quality ?? null, shape, meme });
    if (!spec) return { ok: false, why: 'model' };
    // (2026-10-13) with AGI-1, by Classic only: it keeps her exactly as drawn
    if (her && spec.model !== WITH_AGI1.PHOTO_MODEL) return { ok: false, why: 'agi1_model' };
    if (refs && refs.length > refsFor('photo', spec.model, her)) return { ok: false, why: 'refs' };
    ({ model, quality } = spec);
    cost = photoCredits({ ...spec, shape, meme }, level);
  } else if (kind === 'video') {
    // (phase 4) the model menu: one asked for, or (an older page) Standard from a photo, else Anime from its full body
    let asked = input.model ?? null;
    if (!asked) {
      if (image) asked = 'standard';
      else if (!drawnStyle(i)) return { ok: false, why: 'needs_photo' };
      else asked = 'anime';
    }
    // a long video is always silent: sound not asked for (a scene's sound is on unless it says so) is no sound; asked for, a "no"
    if (asked === 'long' && input.sound !== true) sound = false;
    const spec = videoSpec({ model: asked, seconds: input.seconds ?? null, sound, quality: input.quality ?? null });
    if (!spec) return { ok: false, why: 'model' };
    const way = sceneWay({ mode: i.mode, style: i.style, real: i.real === true }, { image, model: spec.model });
    if (way === 'needs_photo') return { ok: false, why: 'needs_photo' };
    if (way === 'no_anime') return { ok: false, why: 'no_anime' };
    // (2026-10-13) with AGI-1, a video from a photo starts from one she's in (Anime puts her in from her own pictures); with
    // her, Kling's videos take one reference less (refsFor)
    if (askedHer && way === 'photo' && photo?.agi1 !== true) return { ok: false, why: 'agi1_photo' };
    if (refs && refs.length > refsFor('video', spec.model, her)) return { ok: false, why: 'refs' };
    ({ model, seconds, quality, parts } = spec);
    sound = spec.sound;
    cost = videoCredits(spec, level);
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
    cost = creditPrice('trend', level);
  }
  for (let t = 0; t < 2; t++) {
    const job = newOrderId();
    const r = await rpc(cfg, 'inf_make', {
      p_job: job, p_inf: id, p_wallet: i.wallet_code, p_kind: kind, p_scene: scene, p_shape: shape, p_sound: sound, p_trend: trend, p_clip: clip,
      p_image: image, p_cost: cost, p_per_wallet: INF.JOBS_PER_WALLET, p_day_cap: cfg.infDayCap,
      // (round 4, phase 4) the model menu's parts (an older influencers.sql has none of them: run it again)
      p_model: model, p_quality: quality, p_seconds: seconds, p_refs: refs, p_parts: parts, p_meme: meme, p_caption: caption,
      // (2026-10-12, the editor) only when it's an edit: an older influencers.sql makes everything else as before
      ...(edit ? { p_edit: edit } : {}),
      // (2026-10-13) only when AGI-1 is in it: likewise
      ...(her ? { p_agi1: true } : {}),
    }, 'studio');
    if (r?.ok === true) return { ok: true, job, cost, credits: { paid: n0(r.paid), free: n0(r.free), bonus: n0(r.bonus) } };
    if (r?.why !== 'taken') return shortOr(r);
  }
  return { ok: false, why: 'busy' };
}

// ---------- the editor (2026-10-12) ----------
// "Make another" (the owner's choice): one of its own photos (a meme, an X banner), videos or trend videos, done or one that
// couldn't be made, made again with the same words and settings: a new one next to it (it never replaces it), at the price of
// making it now (makeJob's own checks: a photo it started from that's gone, a clip or reference pictures past their day, a
// trend clip the owner took down, a model no longer on the menu, all say so). → its input for makeJob
export function againInput(j) {
  const input = { kind: j.kind };
  if (j.kind === 'photo' || j.kind === 'video') Object.assign(input, { scene: j.scene, shape: j.shape });
  if (j.kind === 'photo') {
    Object.assign(input, { model: j.model ?? null, quality: j.quality ?? null });
    if (j.meme) Object.assign(input, { meme: j.meme, lines: String(j.caption || '') });
  }
  if (j.kind === 'video') Object.assign(input, { sound: j.sound === true, model: j.model ?? null, seconds: j.seconds ?? null, quality: j.quality ?? null });
  if (j.kind === 'trend') {
    if (j.trend) input.trend = j.trend;
    else if (j.clip) input.clip = j.clip;
    input.shape = j.shape;
  }
  if (j.image && j.kind !== 'photo') input.image = j.image;
  // (an edit: the same change to the same photo, which is still there)
  if (j.kind === 'photo' && j.edit && j.image) Object.assign(input, { image: j.image, edit: j.edit });
  // (2026-10-13) with AGI-1: asked for again; "Add AGI-1" (a photo with her from a photo, without words): put into the same
  // photo again (an edit's or a video's photo has her already, or the video is Anime: her own pictures)
  if (j.agi1 === true) {
    input.agi1 = true;
    if (j.kind === 'photo' && j.image && !j.edit) input.image = j.image;
  }
  if (Array.isArray(j.refs) && j.refs.length) input.refs = j.refs;
  return input;
}
// → makeJob's answer (with kind), or { ok: false, why: 'bad' | 'job_gone' | 'not_yours' | 'making' | makeJob's }
export async function againJob(cfg, { wallet, level, job }) {
  if (!ID.test(String(job))) return { ok: false, why: 'bad' };
  const j = await getJob(cfg, job);
  if (!j || !['photo', 'trend', 'video'].includes(j.kind) || j.hidden === true || j.deleted_at || takenDown(cfg, j.id) || !ID.test(String(j.inf_id))) {
    return { ok: false, why: 'job_gone' };
  }
  if (j.wallet_code !== studioWallet(cfg.passSecret, wallet)) return { ok: false, why: 'not_yours' };
  if (j.status !== 'done' && j.status !== 'failed') return { ok: false, why: 'making' };
  // (a photo saved from the photo editor, or a video saved from the video editor, has no words and settings to make again: the
  // one it's from is edited again instead)
  if (j.editor === true) return { ok: false, why: 'editor' };
  const r = await makeJob(cfg, { wallet, level, id: j.inf_id, input: againInput(j) });
  return r.ok ? { ...r, kind: j.kind } : r;
}

// "Delete" (the owner's choice): one of its own photos (a meme, an X banner), videos or trend videos, done or one that
// couldn't be made, off every page at once and for good: the database first (supabase/influencers.sql inf_job_delete: never
// while it's being made, or while something is being made from it; a banned wallet may still delete its own), then its files,
// and a profile picture framed from it (its picked look shows again). Its credits don't come back (it was made; one that
// couldn't be made got them back already). Files that can't be deleted now go with the tidy-up a week later (a profile
// picture's with its influencer's folder). → { ok: true, files, pfp } or { ok: false, why: 'bad' | 'gone' | 'not_yours' |
// 'making' | 'in_use' | 'busy' }
export async function deleteJob(cfg, { wallet, job }) {
  if (!ID.test(String(job))) return { ok: false, why: 'bad' };
  const r = await rpc(cfg, 'inf_job_delete', { p_id: job, p_wallet: studioWallet(cfg.passSecret, wallet) }, 'studio');
  if (r?.ok !== true) return { ok: false, why: String(r?.why || 'busy') };
  const names = jobFiles({ id: job, inf_id: r.inf, kind: r.kind });
  const pfp = ID.test(String(r.inf)) && ID.test(String(r.pfp));
  if (pfp) names.push(picPath(r.inf, r.pfp, 0), picPath(r.inf, r.pfp, 0, 'webp'));
  let files = 0;
  try {
    files = await (await import('./studio-files.js')).deleteFiles(cfg, names);
  } catch (err) {
    console.warn(`[studio] a deleted creation's files (they go with the tidy-up a week later): ${err.message}`);
  }
  return { ok: true, files, pfp };
}

// ---------- a 3D model of it (the studio's characters, from its full body) ----------
// (2026-10-13, the 3D tool) its choices as the page sent them (none: the model as before) → { spec } (tidied) or a "no":
// { why: 'spec', part } (which choice isn't one: moves, own, detail, shine, pose, height, look, formats or spec) · { field:
// 'look' | 'own', n?, part?, why } (its words: server/studio-words.js checkModelWords)
function readChoices(input) {
  const spec = modelSpec(input ?? null);
  if (!spec) return { no: { ok: false, why: 'spec', part: modelSpecField(input) || 'spec' } };
  const words = checkModelWords(spec);
  if (words) return { no: { ok: false, ...words } };
  return { spec };
}
// spec: its choices (src/studio/rules.js modelSpec: its library moves, up to 2 moves described in words, its detail, shine,
// pose, height, its look in words, and more downloads). Its price: its standard price and its extras (each library move past
// MODEL.PICKS_FREE, each move described in words, High detail), a holder's discount on all of it; a Soulmate's free model a
// month covers its standard price only (its extras still paid: p_free_cost). An older influencers.sql makes only the model as
// before: its choices go to the database only when they're other ones (p_spec), so the model as before works with either.
// → { ok: true, order, free, cost, credits } or { ok: false, why: 'no_3d' | 'bad' | 'spec' (part) | inf_3d's } or its words'
// "no" ({ ok: false, field, n?, part?, why })
export async function order3d(cfg, { wallet, level, id, spec: input = null }) {
  if (!studioOn(cfg)) return { ok: false, why: 'no_3d' };
  if (!ID.test(String(id))) return { ok: false, why: 'bad' };
  const c = readChoices(input);
  if (c.no) return c.no;
  const plain = isDefaultSpec(c.spec);
  const cost = modelCost(c.spec, level);
  const key = await burnKey(cfg);
  for (let t = 0; t < 2; t++) {
    const order = newOrderId();
    const r = await rpc(cfg, 'inf_3d', {
      p_order: order, p_inf: id, p_wallet: studioWallet(cfg.passSecret, wallet), p_burn: burnWallet(key, wallet), p_level: level,
      p_cost: cost, p_cap: cfg.studioMonthCap, p_free: level === 3,
      ...(plain ? {} : { p_spec: c.spec, p_free_cost: modelCost(c.spec, level, { free: true }) }),
    }, 'studio');
    if (r?.ok === true) {
      const free = r.free === true;
      return {
        ok: true, order, free, cost: free ? (plain ? 0 : modelCost(c.spec, level, { free: true })) : cost,
        credits: { paid: n0(r.paid), free: n0(r.free_credits), bonus: n0(r.bonus) },
      };
    }
    if (r?.why !== 'taken') return shortOr(r);
  }
  return { ok: false, why: 'busy' };
}

// (round 2, the owner: "large burns can make free 3d model") A 3D model for a big burn: its order waits for STUDIO_MODEL_BURN_AGI
// (25,000) $AGI burned from the wallet's own app (inside the studio's burns a month, STUDIO_BURNS_A_MONTH); asked again while
// one is open, the same one. → { ok: true, order, agi, paid, created, again } or { ok: false, why: 'no_3d' | 'burns_off' |
// inf_3d_burn's }
// (2026-10-13, the 3D tool) spec: its choices, as for order3d, only ones with nothing extra (a burn pays nobody, and its
// extras cost the owner: 'not_burnable'); its look in words, its pose, height, shine, Low-poly and more downloads are free.
// An open quote asked again: while nothing is burned toward it, its choices are the ones asked for now; once something is,
// they stay as they were (its answer's spec says which).
export async function order3dBurn(cfg, { wallet, level, id, spec: input = null }) {
  if (!studioOn(cfg)) return { ok: false, why: 'no_3d' };
  if (!(cfg.infModelBurnAgi > 0) || cfg.studioBurnCap < 1) return { ok: false, why: 'burns_off' };
  if (!ID.test(String(id))) return { ok: false, why: 'bad' };
  const c = readChoices(input);
  if (c.no) return c.no;
  if (!burnable(c.spec)) return { ok: false, why: 'not_burnable' };
  const plain = isDefaultSpec(c.spec);
  const key = await burnKey(cfg);
  for (let t = 0; t < 2; t++) {
    const r = await rpc(cfg, 'inf_3d_burn', {
      p_order: newOrderId(), p_inf: id, p_wallet: studioWallet(cfg.passSecret, wallet), p_burn: burnWallet(key, wallet), p_level: level,
      p_agi: cfg.infModelBurnAgi, p_cap: cfg.studioMonthCap, p_burn_cap: cfg.studioBurnCap, ...(plain ? {} : { p_spec: c.spec }),
    }, 'studio');
    if (r?.ok === true) {
      return {
        ok: true, order: r.order, agi: n0(r.agi), paid: n0(r.paid), created: ms(r.created), again: r.again === true,
        spec: r.spec === undefined ? c.spec : modelSpec(r.spec) || MODEL_DEFAULT,
      };
    }
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

// (2026-10-13, the 3D tool's "More downloads") A 3D model's extra downloads, its maker's alone. format null: what was asked
// for, what's ready, what's still being made and what couldn't be made, and until when they're kept (DL_DAYS days after it
// was done) → { ok: true, formats, done, todo, failed, until }. A format: one of them, from a short-lived signed address (2
// hours) with its file's name (<Name>-3D.<ext>; the full-quality GLB <Name>-3D-full.glb) → { ok: true, url, name }. Or
// { ok: false, why: 'bad' | 'gone' (not there, not done, taken down, or not an influencer's) | 'not_yours' | 'dl_none' (not
// asked for) | 'dl_wait' (still being made) | 'dl_failed' (couldn't be made) | 'dl_expired' (past its days) | 'dl_missing'
// (its file isn't there) | 'storage' }
const dlList = (o, k) => (Array.isArray(o?.[k]) ? o[k].filter((f) => typeof f === 'string' && Object.hasOwn(DL_FORMATS, f)) : []);
// a 3D model's choices as its influencer's page shows them (inf_3d_list's row): its detail, pose, height and shine for anyone
// (none: the model as before); for its maker all of its choices (its look in words, its moves described in words: spec) and
// its extra downloads (dl)
function modelInfo(m, mine) {
  const s = m?.spec ? modelSpec(m.spec) : null;
  const out = s ? { detail: s.detail, pose: s.pose, height: s.height, shine: s.shine } : {};
  if (!mine) return out;
  return {
    ...out, spec: s,
    dl: { formats: dlList(m, 'formats'), done: dlList(m, 'formats_done'), todo: dlList(m, 'formats_todo'), failed: dlList(m, 'formats_failed'), until: ms(m.dl_until) },
  };
}
export async function dl3d(cfg, { wallet, order, format = null, now = Date.now() }) {
  if (!ID.test(String(order)) || (format !== null && !Object.hasOwn(DL_FORMATS, format))) return { ok: false, why: 'bad' };
  const o = await getOrder(cfg, order);
  if (!o || !ID.test(String(o.inf_id)) || o.hidden === true || takenDown(cfg, order) || takenDown(cfg, o.inf_id) || o.status !== 'done') {
    return { ok: false, why: 'gone' };
  }
  if (o.wallet_code !== studioWallet(cfg.passSecret, wallet)) return { ok: false, why: 'not_yours' };
  const state = { formats: dlList(o, 'formats'), done: dlList(o, 'formats_done'), todo: dlList(o, 'formats_todo'), failed: dlList(o, 'formats_failed'), until: ms(o.dl_until) };
  if (format === null) return { ok: true, ...state };
  if (!state.formats.includes(format)) return { ok: false, why: 'dl_none' };
  if (state.until !== null && state.until <= now) return { ok: false, why: 'dl_expired' };
  if (state.failed.includes(format)) return { ok: false, why: 'dl_failed' };
  if (!state.done.includes(format)) return { ok: false, why: 'dl_wait' };
  const ext = DL_FORMATS[format].ext;
  const name = `${String(o.name || 'AGI-Studio').normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'AGI-Studio'}-3D${format === 'full' ? '-full' : format === 'obj' ? '-obj' : ''}.${ext}`;
  let url;
  try {
    url = await (await import('./studio-files.js')).signedUrl(cfg, dlPath(order, format), { expiresIn: 2 * 3600, download: name });
  } catch (err) {
    console.warn(`[studio] a 3D model's download: ${err.message}`);
    return { ok: false, why: 'storage' };
  }
  // (its file isn't in the bucket: deleted by hand, or by a tidy-up that ran a moment ago)
  return url ? { ok: true, url, name } : { ok: false, why: 'dl_missing' };
}

// ---------- shown in Explore or not, and deleting it ----------
export async function setPublic(cfg, { wallet, id, show }) {
  const r = await rpc(cfg, 'inf_public', { p_id: id, p_wallet: studioWallet(cfg.passSecret, wallet), p_public: show === true }, 'studio');
  return r?.ok === true ? { ok: true } : { ok: false, why: r?.why || 'busy' };
}

// ---------- (2026-10-11) its profile picture, changed after it's made ----------
// (The owner: "they should have an option to change the profile even after generation"; the owner's choices: "Its looks and
// photos", "Only how it's shown".) A square its maker framed in one of its own pictures (from: { job, n, x, y, s }: one of its
// looks, its full body or one of its photos, and the frame, src/studio/rules.js FRAME), kept as a picture of its own (a JPEG
// of FRAME.SIDE px at most and a FRAME.SMALL px WebP, under a new id each time: a copy kept anywhere is never an old picture
// under its address); or (from: null) its picked look again. Only how it's shown (its page, Explore, My studio, its coin's
// picture at first): its photos, videos and 3D models are still made from its full body. No credits: nothing is asked of an
// AI service. → { ok: true, portrait, pfp } or { ok: false, why: 'bad' | 'gone' | 'not_yours' | 'banned' | 'not_ready' |
// 'picture' (not one of its own pictures, done and shown) | 'storage' | 'busy' }
// (the database's "source": the picture isn't one of its own any more, said as the page's "picture")
const whyOf = (r) => (r?.why === 'source' ? 'picture' : String(r?.why || 'busy'));
export async function setProfile(cfg, { wallet, id, from }) {
  if (!ID.test(String(id))) return { ok: false, why: 'bad' };
  const f = from === null ? null : framedOf(from);
  if (from !== null && !f) return { ok: false, why: 'bad' };
  const i = await rpc(cfg, 'inf_get', { p_id: id }, 'studio');
  if (!i || i.status === 'deleted' || i.hidden === true || takenDown(cfg, id)) return { ok: false, why: 'gone' };
  if (i.wallet_code !== studioWallet(cfg.passSecret, wallet)) return { ok: false, why: 'not_yours' };
  if (i.banned === true) return { ok: false, why: 'banned' };
  if (i.status !== 'ready') return { ok: false, why: 'not_ready' };
  const F = await import('./studio-files.js');
  const dropOld = async (old, keep) => {
    if (!ID.test(String(old)) || old === keep) return;
    await F.deleteFiles(cfg, [picPath(id, old, 0), picPath(id, old, 0, 'webp')])
      .catch((err) => console.warn(`[studio] an influencer's old profile picture (it goes with the influencer): ${err.message}`));
  };
  if (!f) {
    const r = await rpc(cfg, 'inf_pfp_set', { p_id: id, p_wallet: i.wallet_code, p_pfp: null }, 'studio');
    if (r?.ok !== true) return { ok: false, why: whyOf(r) };
    await dropOld(r.old, null);
    return { ok: true, portrait: lookOf(i), pfp: null };
  }
  const j = await getJob(cfg, f.job);
  if (!sourceOk(cfg, j, id, f.n)) return { ok: false, why: 'picture' };
  let bytes;
  try { bytes = await F.getFile(cfg, picPath(id, f.job, f.n), { max: 8_000_000 }); } catch (err) {
    console.warn(`[studio] a picture for a profile picture: ${err.message}`);
    return { ok: false, why: 'storage' };
  }
  if (!bytes) return { ok: false, why: 'picture' };
  const made = await frameOf(await F.loadSharp(), bytes, f).catch(() => null);
  if (!made?.webp) return { ok: false, why: 'picture' };
  const pid = newOrderId();
  const names = [picPath(id, pid, 0), picPath(id, pid, 0, 'webp')];
  const dropNew = () => F.deleteFiles(cfg, names).catch(() => 0);
  try {
    await Promise.all([F.putFile(cfg, names[0], made.jpg, 'image/jpeg'), F.putFile(cfg, names[1], made.webp, 'image/webp')]);
  } catch (err) {
    console.warn(`[studio] a profile picture couldn't be kept: ${err.message}`);
    await dropNew();
    return { ok: false, why: 'storage' };
  }
  let r;
  try { r = await rpc(cfg, 'inf_pfp_set', { p_id: id, p_wallet: i.wallet_code, p_pfp: { id: pid, ...f } }, 'studio'); } catch (err) {
    await dropNew();
    throw err;
  }
  if (r?.ok !== true) { await dropNew(); return { ok: false, why: whyOf(r) }; }
  await dropOld(r.old, pid);
  return { ok: true, portrait: { job: pid, n: 0 }, pfp: { job: f.job, n: f.n, x: f.x, y: f.y, s: f.s } };
}
// Its profile picture's files, for our address (?inf-file=<influencer>/<its id>-0.jpg | .webp): while it's its profile picture
// and the influencer is shown (ready, not hidden or taken down, its maker not banned). → { private } or null
export async function pfpShown(cfg, inf, pid) {
  if (!ID.test(String(inf)) || !ID.test(String(pid)) || takenDown(cfg, inf)) return null;
  const i = await rpc(cfg, 'inf_get', { p_id: inf }, 'studio');
  if (!i || i.status !== 'ready' || i.hidden === true || i.banned === true) return null;
  const p = portraitFor(cfg, i);
  return p && p.job === pid && i.pfp?.id === pid ? { private: isPrivate(i) } : null;
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
    // (2026-10-13) and its extra downloads (any the clock made: the tidy-up deletes what's left of a hidden one's too)
    files += await F.deleteFiles(cfg, [`${m.id}.glb`, `${m.id}.webp`, `${m.id}.png`, ...Object.keys(DL_FORMATS).map((f) => dlPath(m.id, f))]).catch(() => 0);
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
// its picture: its profile picture as it is now (picture: 'profile', the default: its picked look, or since 2026-10-11 the
// square its maker framed), or (since 2026-10-11, the owner's choice: "Profile or its photos") a square its maker framed in
// one of its own pictures (picture: { job, n, x, y, s }). A framed picture goes in the draft as its source and its frame
// ("studio:<influencer>/<job>-<n>@<x>,<y>,<s>"), cut when the launch reads it: a draft stays whole whatever its profile
// picture becomes meanwhile. → { ok: true, link, draft, expires } or { ok: false, why: 'launch_off' | 'launch_private' |
// 'bad' | 'gone' | 'not_yours' | 'not_ready' | 'picture' (not one of its own pictures, done and shown) | 'coin' (reason: her
// check's) | 'coin_cap' | 'busy' }
const framedPhoto = (inf, f) => `studio:${inf}/${f.job}-${f.n}@${f.x},${f.y},${f.s}`;
export async function coinDraft(cfg, { wallet, id, name, symbol, description, picture }) {
  const own = picture === undefined || picture === null || picture === 'profile';
  const asked = own ? null : framedOf(picture);
  if (!own && !asked) return { ok: false, why: 'bad' };
  const L = await import('./launch.js');
  if (!L.launchReady(cfg)) return { ok: false, why: 'launch_off' };
  // while launching is private (LAUNCH_ONLY_FOR), only AGI Studio's own list gets a link (the owner, STUDIO_ONLY_FOR's, the
  // team, and since 2026-10-11 the wallets the owner let in): never everyone just because AGI Studio is open
  if (!L.launchOpen(cfg) && !(await (await import('./inf-team.js')).onList(cfg, wallet))) return { ok: false, why: 'launch_private' };
  const i = await rpc(cfg, 'inf_get', { p_id: id }, 'studio');
  if (!i || i.status === 'deleted' || i.hidden === true || takenDown(cfg, id)) return { ok: false, why: 'gone' };
  if (i.wallet_code !== studioWallet(cfg.passSecret, wallet)) return { ok: false, why: 'not_yours' };
  if (i.status !== 'ready' || !i.looks_job || !Number.isInteger(i.pick)) return { ok: false, why: 'not_ready' };
  const idea = L.checkIdea({ name, symbol, description });
  if (!idea.ok) return { ok: false, why: 'coin', reason: idea.why };
  let photo = `studio:${id}/${i.looks_job}-${i.pick}`;
  if (asked) {
    if (!sourceOk(cfg, await getJob(cfg, asked.job), id, asked.n)) return { ok: false, why: 'picture' };
    photo = framedPhoto(id, asked);
  } else {
    // its profile picture as it's shown now: the square its maker framed (its source and frame), else its picked look
    const p = i.pfp;
    const shown = portraitFor(cfg, i);
    const f = p && shown && shown.job === p.id ? framedOf({ job: p.job, n: p.n, x: p.x, y: p.y, s: p.s }) : null;
    if (f) photo = framedPhoto(id, f);
  }
  for (let t = 0; t < 2; t++) {
    const draft = L.newDraftId();
    const r = await L.drafts.put(cfg, {
      id: draft, chat: L.launchWallet(cfg.passSecret, wallet), name: idea.name, symbol: idea.symbol, description: idea.description, photo,
    });
    if (r?.ok === true) return { ok: true, link: L.draftUrl(draft), draft, expires: ms(r.expires) };
    if (r?.why === 'chat_cap' || r?.why === 'site_cap') return { ok: false, why: 'coin_cap' };
    if (r?.why !== 'bad') return { ok: false, why: 'busy' };
  }
  return { ok: false, why: 'busy' };
}

// A launch draft's picture when it's an influencer's (photo "studio:<influencer>/<job>-<n>", and since 2026-10-11 with the
// square its maker framed in it, "…@<x>,<y>,<s>"): from our bucket, while the influencer is still there and shown (not hidden,
// taken down or its maker banned) and, for a framed one, while that picture is one of its own, done and shown; a JPEG of
// 1 MB at most (Launch with AGI-1's limit), a framed one cut at FRAME.COIN px. → { bytes, type } or null
export async function studioPicture(cfg, photo) {
  const m = STUDIO_PHOTO.exec(String(photo || ''));
  if (!m || takenDown(cfg, m[1])) return null;
  const i = await rpc(cfg, 'inf_get', { p_id: m[1] }, 'studio');
  if (!i || i.status === 'deleted' || i.hidden === true || i.banned === true) return null;
  const F = await import('./studio-files.js');
  if (m[4] !== undefined) {
    const f = { job: m[2], n: Number(m[3]), x: Number(m[4]), y: Number(m[5]), s: Number(m[6]) };
    if (!isFrame(f) || !sourceOk(cfg, await getJob(cfg, f.job), m[1], f.n)) return null;
    const bytes = await F.getFile(cfg, picPath(m[1], f.job, f.n), { max: 8_000_000 });
    if (!bytes) return null;
    const sharp = await F.loadSharp();
    // its square at FRAME.COIN px (never bigger than the picture has), then a little smaller or plainer until it fits
    for (const [size, quality] of [[FRAME.COIN, 88], [FRAME.COIN, 78], [768, 80], [640, 74]]) {
      const made = await frameOf(sharp, bytes, f, { size, small: 0, quality }).catch(() => null);
      if (!made?.jpg) return null;
      if (made.jpg.length <= 1_000_000) return { bytes: made.jpg, type: 'image/jpeg' };
    }
    return null;
  }
  if (i.looks_job !== m[2]) return null;
  const bytes = await F.getFile(cfg, `inf/${m[1]}/${m[2]}-${m[3]}.jpg`, { max: 4_000_000 });
  if (!bytes) return null;
  if (bytes.length <= 1_000_000) return { bytes, type: 'image/jpeg' };
  const sharp = await F.loadSharp();
  const small = await sharp(bytes).resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 84 }).toBuffer().catch(() => null);
  return small && small.length <= 1_000_000 ? { bytes: small, type: 'image/jpeg' } : null;
}

// ---------- Explore ----------
// The newest public influencers (never a private one), their newest photos and videos (with their likes), the owner's kept
// trend clips, and (round 2) the boosted influencers (a burn unlocked it) and the spotlight of the week, and (2026-10-13) the
// newest photos and videos with AGI-1 in them. Each one's portrait is its profile picture (since 2026-10-11 the square its
// maker framed, else its picked look: portraitFor).
export async function explore(cfg) {
  const e = await rpc(cfg, 'inf_explore', { p_limit: 24 }, 'studio');
  const ok = (id) => ID.test(String(id)) && !takenDown(cfg, id);
  const face = (x) => portraitFor(cfg, x);
  const sp = e?.spotlight;
  // one of the newest photos and videos (never an X banner: an X header, not a post)
  const tile = (j) => ({
    id: j.id, kind: j.kind, shape: j.shape || (j.kind === 'photo' ? 'square' : 'tall'), trend: j.trend || null, poster: j.poster === true,
    files: n0(j.files), likes: n0(j.likes), done: ms(j.done_at),
    // (round 4, phase 4) its model, quality and length, sound, a meme's format and words (what its sheet says of it)
    model: j.model || null, quality: j.quality || null, seconds: Number.isFinite(Number(j.seconds)) && j.seconds !== null && j.seconds !== undefined ? Number(j.seconds) : null,
    sound: j.sound === true, meme: j.meme || null, caption: j.caption || null,
    // (2026-10-13) AGI-1 is in it ("With AGI-1")
    agi1: j.agi1 === true,
    inf: { id: j.inf_id, name: j.inf_name, portrait: face(j), maker: makerOf(j.maker) },
  });
  const tiles = (list) => (Array.isArray(list) ? list : []).filter((j) => ok(j.id) && ok(j.inf_id) && j.shape !== 'banner').map(tile);
  return {
    influencers: (Array.isArray(e?.influencers) ? e.influencers : []).filter((i) => ok(i.id)).map((i) => ({
      id: i.id, name: i.name, style: i.style, portrait: face(i), ready: ms(i.ready_at), maker: makerOf(i.maker),
    })),
    fresh: tiles(e?.fresh),
    // (2026-10-13) the newest photos and videos with AGI-1 in them (public influencers only, like fresh: an older
    // influencers.sql has none)
    agi1: tiles(e?.agi1).filter((j) => j.agi1),
    trends: TRENDS.map((t) => {
      const kept = (Array.isArray(e?.trends) ? e.trends : []).find((k) => k.id === t.id);
      return kept && ok(kept.job) ? { id: t.id, name: t.name, emoji: t.emoji, job: kept.job, poster: kept.poster === true } : null;
    }).filter(Boolean),
    boosted: (Array.isArray(e?.boosted) ? e.boosted : []).filter((i) => ok(i.id)).map((i) => ({
      id: i.id, name: i.name, style: i.style, portrait: face(i), until: ms(i.until), maker: makerOf(i.maker),
    })),
    spotlight: sp && ok(sp.id) && ok(sp.inf_id) ? {
      week: sp.week, job: sp.id, kind: sp.kind, shape: sp.shape || (sp.kind === 'photo' ? 'square' : 'tall'), poster: sp.poster === true,
      files: n0(sp.files), holderLikes: n0(sp.holder_likes), likes: n0(sp.likes), prize: n0(sp.prize),
      inf: { id: sp.inf_id, name: sp.inf_name, portrait: face(sp), maker: makerOf(sp.maker) },
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
// The reports (the owner's page, and since round 4's phase 2 a mod's): each influencer or creation reported, how many times
// and why, and whether its maker is banned
const reportOf = (r) => ({
  inf: r.inf_id, job: r.job_id || null, count: n0(r.count), whys: Array.isArray(r.whys) ? r.whys : [], at: ms(r.at), name: r.name, mode: r.mode,
  hidden: r.hidden === true, banned: r.banned === true,
});
export async function reportsList(cfg) {
  const list = await rpc(cfg, 'inf_reports', { p_limit: 60 }, 'studio');
  return (Array.isArray(list) ? list : []).map(reportOf);
}
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
    reports: (Array.isArray(reports) ? reports : []).map(reportOf),
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
