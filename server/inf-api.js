// AGI Studio (2026-10-10, studio.agi1.app): its web side, inside api/launch.js like the 3D studio's (Vercel's 12 functions
// are all used; an influencer can be a coin's face). server/influencer.js does the work.
//   GET  ?inf-info                → { on, photos, open, base prices and discounts, free credits a month, top-ups, payTo, token,
//                                   threeD, coins (Launch with AGI-1 set up), launch (and open to everyone), and since round 2
//                                   examples ({ choice: its picture's job }), burns (what each unlock costs in $AGI), slots,
//                                   weeklyPrize, likesADay } (the same for everyone)
//   GET  ?inf-explore             → Explore: { influencers, fresh (photos and videos), trends, boosted, spotlight } (the same
//                                   for everyone)
//   GET  ?inf=<id>                → a ready influencer's page: { influencer, jobs, models } (anyone with its link)
//   GET  ?inf-file=<…>            → one of its pictures (a JPEG, or a small WebP) or a video's poster, from the private bucket
//   GET  ?inf-video=<job>.mp4     → one of its videos (or a trend clip), played in parts (Range), like the 3D studio's
//   GET  ?inf-video-dl=<job>.mp4  → a redirect to a short-lived signed address, to download it with its own name (round 2:
//                                   its copy with the share mark, once the clock has made it: server/inf-mark.js)
//   GET  ?inf-dl=<inf>/<job>-<n>.jpg → (round 2) one of its photos (or its full body) to download, with the share mark
//   GET  ?inf-ex=<job>.webp       → (round 2) an example picture for a design choice
//   GET  ?inf-stats               → (round 2) the live stats board: public totals only, kept a minute
//   POST { action: 'inf-me', session }                         → its credits (a holder's free ones given first), its
//        influencers, its prices, whether it may make one, whether it's the owner, its slots, burn unlocks and weekly prizes
//   POST { action: 'inf-look', session, id }                   → its own influencer's page (and one thing being made, one step;
//        and which of its photos and videos this wallet liked)
//   POST { action: 'inf-up-open', session, kind, bytes, consent? (a picture), adult: true, pass? | turnstileToken? } → an upload's ticket
//   POST ?inf-up=<ticket>&part=<n> | &frame=<n>  (the file's bytes, application/octet-stream) → its file, a part or a frame
//   POST { action: 'inf-up-done', session, ticket }            → a clip put together and looked at
//   POST { action: 'inf-start', session, name, mode, style, settings, words, source?, adult: true, pass? | turnstileToken? }
//   POST { action: 'inf-pick', session, id, look } · { action: 'inf-reroll', session, id }
//   POST { action: 'inf-make', session, id, kind, scene?, shape?, sound?, trend? | clip?, image? }
//   POST { action: 'inf-3d', session, id } · { action: 'inf-public', session, id, show } · { action: 'inf-delete', session, id }
//   POST { action: 'inf-coin', session, id, name, symbol, description } → a launch link (Launch with AGI-1's page)
//   POST { action: 'inf-topup', session, tx? }                 → "Check my payment" (USDG → credits)
//   POST { action: 'inf-report', id, job?, why, pass? | turnstileToken? } (anyone)
//   POST ?inf-poster=<ticket> (a frame as a picture)           → a video's poster, looked at first
//   (round 2) POST { action: 'inf-like', session, job, like } · { action: 'inf-liked', session, jobs }
//             POST { action: 'inf-3d-burn', session, id } · { action: 'inf-3d-check', session, id, order, tx? } ·
//                  { action: 'inf-3d-redo', session, id, order }      (a free 3D model for a big burn)
//             POST { action: 'inf-burn-quote', session, what: 'slot' | 'boost', id? } · { action: 'inf-burn-check', session,
//                  burn, tx? }                                          (burn unlocks)
//             POST { action: 'inf-week-claim', session, week }      (a weekly spotlight's prize, to its maker's wallet)
//   the owner's: { action: 'inf-owner' | 'trend-make' | 'trend-set' | 'inf-hide' | 'inf-report-clear' | 'inf-example-make' |
//   'inf-week-set', session, … }
// Every answer is "no-store" but the ones the same for everyone. POST answers carry `session` when the wallet's level was read
// again (the page keeps it), or `signedOut: true`.
import { clientIp, visitorCode, visitorCodeForDay, makePass, checkPass } from './security.js';
import { verifyHuman } from './turnstile.js';
import { makeBurstLimit } from './burst.js';
import { studioOn, walletNow, studioWallet, mayMake } from './studio.js';
import {
  infOn, isOwner, infPage, moveAlong, me, startInf, pickLook, rerollLooks, makeJob, order3d, setPublic, deleteInf, report, coinDraft,
  explore, ownerPage, trendMake, trendSet, hide, clearReports, ID, order3dBurn, check3dBurn, redo3d, examplesMap, stats, exampleMake,
} from './influencer.js';
import { getJob, picPath, videoPath, posterPath, examplePath, markedPath } from './inf-jobs.js';
import { USDG } from './studio-chain.js';
import { WEEK, prizesOn } from './inf-week.js';
import { BURNS } from './inf-burns.js';
import { PRICES, DISCOUNT, FREE_CREDITS, TOPUPS, TOPUP_MIN, INF_FILE_RE, INF_DL_RE, REPORT_WHYS } from '../src/studio/rules.js';

// speed bumps (per server copy): looking (each look may ask the AI service), what asks others (Cloudflare, the chain, Gemini,
// the AI service), an upload's parts, and its files
export const infLookBurst = makeBurstLimit({ max: 60, windowMs: 60_000 });
export const infActBurst = makeBurstLimit({ max: 20, windowMs: 60_000 });
export const infUpBurst = makeBurstLimit({ max: 90, windowMs: 60_000 });
export const infFileBurst = makeBurstLimit({ max: 300, windowMs: 60_000 });

const json = (status, body, cache = 'no-store') => Response.json(body, { status, headers: { 'Cache-Control': cache } });
const ready = (cfg) => Boolean(cfg.supabaseUrl && cfg.supabaseKey && cfg.passSecret.length >= 32);
const MEDIA = { 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" };
let warned = false;
function dbTrouble(err, what) {
  if (err?.code === 'PGRST202') {
    if (!warned) { warned = true; console.error(`[studio] the studio app: ${err.message}`); }
    return json(503, { error: 'not_ready' });
  }
  console.error(`[studio] the studio app, ${what}: ${err?.message}`);
  return json(503, { error: 'busy' });
}
const safeName = (s, fallback) => String(s || '').normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || fallback;

// ---------- GET ----------
let statsCache = null;                 // (the stats board: one database question a minute per server copy at most)
export const _resetInfApi = () => { statsCache = null; };
export async function infGet(cfg, request, key, value) {
  if (!ready(cfg)) return json(503, { error: 'not_ready' });
  const who = visitorCode(cfg.passSecret, clientIp(request));
  if (key === 'inf-info') {
    let examples = {};
    if (infOn(cfg)) {
      try { examples = await examplesMap(cfg); } catch (err) {
        if (err?.code !== 'PGRST202') console.warn(`[studio] the example pictures: ${err?.message}`);
      }
    }
    return json(200, {
      on: infOn(cfg), photos: cfg.infPhotos, open: cfg.studioOpen, prices: PRICES, discounts: DISCOUNT, freeCredits: FREE_CREDITS,
      topups: TOPUPS, topupMin: TOPUP_MIN, usdg: Boolean(cfg.studioPayTo), payTo: cfg.studioPayTo || null, token: USDG,
      threeD: studioOn(cfg), coins: Boolean(cfg.pinataJwt), launch: Boolean(cfg.pinataJwt) && !cfg.launchTesters,
      // (round 2) the example pictures, what each burn unlock costs in whole $AGI (0: off), the influencers a wallet may have
      // before an unlock, the weekly spotlight's prize (0: for glory only) and the likes a wallet may give a day
      examples,
      burns: {
        model: studioOn(cfg) && cfg.studioBurnCap > 0 ? cfg.infModelBurnAgi : 0, slot: cfg.infSlotAgi, boost: cfg.infBoostAgi,
        boostHours: BURNS.BOOST_HOURS,
      },
      slots: cfg.infSlots, weeklyPrize: prizesOn(cfg) ? cfg.infWeeklyPrize : 0, likesADay: WEEK.LIKES_A_DAY,
    }, 'public, max-age=15, s-maxage=30');
  }
  if (key === 'inf-explore') {
    try { return json(200, await explore(cfg), 'public, max-age=15, s-maxage=30'); } catch (err) { return dbTrouble(err, 'Explore'); }
  }
  if (key === 'inf-stats') {
    if (value !== '') return json(400, { error: 'bad_request' });
    const now = Date.now();
    if (!statsCache || now - statsCache.at > 60_000) {
      try { statsCache = { at: now, body: await stats(cfg) }; } catch (err) { return dbTrouble(err, 'the stats'); }
    }
    return json(200, statsCache.body, 'public, max-age=30, s-maxage=60');
  }
  if (key === 'inf') {
    if (!ID.test(value || '')) return json(400, { error: 'bad_request' });
    if (!infLookBurst(who)) return json(429, { error: 'too_fast' });
    let page;
    try { page = await infPage(cfg, value); } catch (err) { return dbTrouble(err, 'an influencer'); }
    if (!page) return json(404, { error: 'gone' });
    const { raw, mine, ...rest } = page;
    return json(200, rest, page.influencer.private ? 'private, max-age=10' : 'public, max-age=10, s-maxage=20');
  }
  if (key === 'inf-video' || key === 'inf-video-dl') return videoAnswer(cfg, request, key, value, who);
  if (key === 'inf-file') return fileAnswer(cfg, value, who);
  if (key === 'inf-dl') return photoDownload(cfg, value, who);
  if (key === 'inf-ex') return exampleAnswer(cfg, value, who);
  return json(400, { error: 'bad_request' });
}

// (round 2) An example picture for a design choice: the newest done one of its choice (the owner's)
async function exampleAnswer(cfg, value, who) {
  const m = /^([A-Za-z0-9_-]{22})\.webp$/.exec(value || '');
  if (!m) return json(400, { error: 'bad_request' });
  if (!infFileBurst(who)) return json(429, { error: 'too_fast' });
  let j;
  try { j = await getJob(cfg, m[1]); } catch (err) { return dbTrouble(err, 'an example picture'); }
  if (!j || j.kind !== 'example' || j.status !== 'done' || j.hidden === true) return json(404, { error: 'gone' });
  let bytes;
  try { bytes = await (await import('./studio-files.js')).getFile(cfg, examplePath(j.id), { max: 1_000_000 }); } catch (err) {
    console.warn(`[studio] an example picture: ${err.message}`);
    return json(502, { error: 'storage' });
  }
  if (!bytes) return json(404, { error: 'gone' });
  return new Response(bytes, { status: 200, headers: { ...MEDIA, 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=86400, s-maxage=86400' } });
}

// (round 2) One of its photos (or its full body), downloaded: with the share mark ("Made with AGI Studio · AI-generated ·
// studio.agi1.app")
async function photoDownload(cfg, value, who) {
  const m = INF_DL_RE.exec(value || '');
  if (!m) return json(400, { error: 'bad_request' });
  if (!infFileBurst(who)) return json(429, { error: 'too_fast' });
  let j;
  try { j = await getJob(cfg, m[2]); } catch (err) { return dbTrouble(err, 'a photo'); }
  const nth = Number(m[3]);
  // (a photo, or its full body: the picture its photos, videos and 3D model start from)
  const shown = j && j.status === 'done' && j.hidden !== true && ['photo', 'body'].includes(j.kind) && j.inf_id === m[1] && nth < Math.max(1, Number(j.files) || 0)
    && !cfg.studioHide?.has(j.id) && j.inf_status !== 'deleted' && j.inf_hidden !== true && !cfg.studioHide?.has(j.inf_id);
  if (!shown) return json(404, { error: 'gone' });
  const F = await import('./studio-files.js');
  let bytes;
  try { bytes = await F.getFile(cfg, picPath(m[1], m[2], nth), { max: 4_000_000 }); } catch (err) {
    console.warn(`[studio] a photo to download: ${err.message}`);
    return json(502, { error: 'storage' });
  }
  if (!bytes) return json(404, { error: 'gone' });
  const { markPhoto } = await import('./inf-mark.js');
  const marked = await markPhoto(await F.loadSharp(), bytes).catch(() => null);
  const name = `${safeName(j.inf_name, 'AGI-Studio')}-${j.kind === 'body' ? 'full-body' : 'photo'}${nth ? `-${nth + 1}` : ''}.jpg`;
  const priv = j.inf_mode === 'face' || j.inf_real === true;
  return new Response(marked || bytes, {
    status: 200,
    headers: {
      ...MEDIA, 'Content-Type': 'image/jpeg', 'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': priv ? 'private, max-age=600' : 'public, max-age=3600, s-maxage=600',
    },
  });
}

// One of its pictures, or a video's poster
async function fileAnswer(cfg, value, who) {
  const m = INF_FILE_RE.exec(value || '');
  if (!m) return json(400, { error: 'bad_request' });
  if (!infFileBurst(who)) return json(429, { error: 'too_fast' });
  const jobId = m[2] || m[6];
  let j;
  try { j = await getJob(cfg, jobId); } catch (err) { return dbTrouble(err, 'a picture'); }
  const shown = j && j.status === 'done' && j.hidden !== true && !cfg.studioHide?.has(j.id)
    && (j.kind === 'preset' || (j.inf_status !== 'deleted' && j.inf_hidden !== true && !cfg.studioHide?.has(j.inf_id)));
  if (!shown) return json(404, { error: 'gone' });
  let path, type;
  if (m[1]) {
    const nth = Number(m[3]);
    if (j.inf_id !== m[1] || !['looks', 'body', 'photo'].includes(j.kind) || nth >= Math.max(1, Number(j.files) || 0)) return json(404, { error: 'gone' });
    path = picPath(m[1], jobId, nth, m[4]);
    type = m[4] === 'jpg' ? 'image/jpeg' : 'image/webp';
  } else {
    const fits = m[5] === 'trends' ? j.kind === 'preset' : j.inf_id === m[5] && ['trend', 'video'].includes(j.kind);
    if (!fits || j.poster !== true) return json(404, { error: 'gone' });
    path = posterPath(j);
    type = 'image/webp';
  }
  let bytes;
  try { bytes = await (await import('./studio-files.js')).getFile(cfg, path, { max: 4_000_000 }); } catch (err) {
    console.warn(`[studio] an influencer's picture: ${err.message}`);
    return json(502, { error: 'storage' });
  }
  if (!bytes) return json(404, { error: 'gone' });
  // (one made from a face or a photo of a real person: never kept by the CDN, so deleting it takes it off at once)
  const cache = j.inf_mode === 'face' || j.inf_real === true ? 'private, max-age=600' : 'public, max-age=3600, s-maxage=600';
  return new Response(bytes, { status: 200, headers: { ...MEDIA, 'Content-Type': type, 'Cache-Control': cache } });
}

// One of its videos: played in parts (its player's "Range"), whole when it's small, or downloaded by a signed address
async function videoAnswer(cfg, request, key, value, who) {
  const m = /^([A-Za-z0-9_-]{22})\.mp4$/.exec(value || '');
  if (!m) return json(400, { error: 'bad_request' });
  if (!infFileBurst(who)) return json(429, { error: 'too_fast' });
  let j;
  try { j = await getJob(cfg, m[1]); } catch (err) { return dbTrouble(err, 'a video'); }
  const shown = j && j.status === 'done' && j.hidden !== true && ['trend', 'video', 'preset'].includes(j.kind) && !cfg.studioHide?.has(j.id)
    && (j.kind === 'preset' || (j.inf_status !== 'deleted' && j.inf_hidden !== true && !cfg.studioHide?.has(j.inf_id)));
  if (!shown) return json(404, { error: 'gone' });
  const F = await import('./studio-files.js');
  const path = videoPath(j);
  const total = Number(j.bytes);
  const face = j.inf_mode === 'face' || j.inf_real === true;
  const media = { ...MEDIA, 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes' };
  try {
    if (key === 'inf-video') {
      const r = F.byteRange(request.headers.get('range'), total);
      if (r === 'bad') return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}`, 'Cache-Control': 'no-store' } });
      if (r) {
        const bytes = await F.getRange(cfg, path, r);
        if (!bytes) return json(404, { error: 'gone' });
        return new Response(bytes, { status: 206, headers: { ...media, 'Content-Range': `bytes ${r.start}-${r.end}/${total}`, 'Content-Length': String(bytes.length), 'Cache-Control': 'private, max-age=86400' } });
      }
      if (total > 0 && total <= F.PART) {
        const bytes = await F.getFile(cfg, path, { max: F.PART });
        if (!bytes) return json(404, { error: 'gone' });
        return new Response(bytes, { status: 200, headers: { ...media, 'Content-Length': String(bytes.length), 'Cache-Control': face ? 'private, max-age=600' : 'public, max-age=3600, s-maxage=600' } });
      }
    }
    const name = key === 'inf-video-dl'
      ? `${safeName(j.kind === 'preset' ? `AGI-Studio-${j.trend}` : j.inf_name, 'AGI-Studio')}-${j.kind === 'video' ? 'video' : 'trend'}.mp4` : null;
    // (round 2) its download: the copy with the share mark, once the clock has made it (until then, as it was made)
    const from = key === 'inf-video-dl' && j.marked === true && j.kind !== 'preset' ? markedPath(j.inf_id, j.id) : path;
    const url = await F.signedUrl(cfg, from, { expiresIn: 2 * 3600, download: name });
    if (!url) return json(404, { error: 'gone' });
    return new Response(null, { status: 302, headers: { Location: url, 'Referrer-Policy': 'no-referrer', 'Cache-Control': face ? 'private, max-age=300' : 'public, max-age=300, s-maxage=1800' } });
  } catch (err) {
    console.warn(`[studio] an influencer's video: ${err.message}`);
    return json(502, { error: 'storage' });
  }
}

// ---------- POST: an upload's bytes, or a poster ----------
const UP_MAX = 4_200_000;
export async function infBinary(cfg, request, url) {
  if (!ready(cfg) || !infOn(cfg)) return json(503, { error: 'not_ready' });
  const who = visitorCode(cfg.passSecret, clientIp(request));
  if (!infUpBurst(who)) return json(429, { error: 'too_fast' });
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > UP_MAX) return json(413, { error: 'size' });
  const body = Buffer.from(await request.arrayBuffer());
  if (!body.length) return json(400, { error: 'bad_request' });
  if (body.length > UP_MAX) return json(413, { error: 'size' });
  const { readTicket, receive, receivePoster } = await import('./inf-uploads.js');
  try {
    if (url.searchParams.has('inf-poster')) {
      const t = readTicket(cfg.passSecret, 'poster', url.searchParams.get('inf-poster'));
      if (!t || !ID.test(String(t.j))) return json(401, { error: 'ticket' });
      const r = await receivePoster(cfg, t, body);
      return json(r.status, r.body);
    }
    const t = readTicket(cfg.passSecret, 'up', url.searchParams.get('inf-up'));
    if (!t || !ID.test(String(t.u))) return json(401, { error: 'ticket' });
    const num = (k) => (url.searchParams.has(k) && /^\d{1,2}$/.test(url.searchParams.get(k)) ? Number(url.searchParams.get(k)) : null);
    const part = num('part'), frame = num('frame');
    if ((part === null) === (frame === null)) return json(400, { error: 'bad_request' });
    const r = await receive(cfg, t, { part, frame, body });
    return json(r.status, r.body);
  } catch (err) {
    if (err?.code) return dbTrouble(err, 'an upload');
    console.warn(`[studio] an upload: ${err.message}`);
    return json(502, { error: 'storage' });
  }
}

// ---------- POST: the app's actions ----------
const WHY_STATUS = {
  closed: 403, not_yours: 403, faces_off: 403, launch_private: 403, gone: 404, not_ready: 409, state: 409, short: 402, too_many: 429,
  busy_day: 429, busy3d: 409, sold_out: 409, coin_cap: 429, no_3d: 409, launch_off: 409, no_usdg: 409, face: 409, making: 409,
  trend: 409, clip: 409, image: 409, source: 409, needs_photo: 409, consent: 400, kind: 400, size: 413, busy: 503,
  // round 2
  no_slot: 409, private: 409, own: 409, burns_off: 409, burns_sold_out: 409, off: 409, used: 409, done: 409, no_credit: 409,
  no_kind: 409, prizes_off: 409, none: 404, no_prize: 409, claimed: 409, sending: 409, empty: 503, failed: 409, bad: 400,
};
const OWNER_ACTIONS = ['inf-owner', 'trend-make', 'trend-set', 'inf-hide', 'inf-report-clear', 'inf-example-make', 'inf-week-set'];
export const INF_POSTS = ['inf-me', 'inf-look', 'inf-up-open', 'inf-up-done', 'inf-start', 'inf-pick', 'inf-reroll', 'inf-make', 'inf-3d',
  'inf-public', 'inf-delete', 'inf-coin', 'inf-topup', 'inf-report', 'inf-like', 'inf-liked', 'inf-3d-burn', 'inf-3d-check', 'inf-3d-redo',
  'inf-burn-quote', 'inf-burn-check', 'inf-week-claim', ...OWNER_ACTIONS];

async function human(cfg, body, ip, who) {
  if (checkPass(cfg.passSecret, body.pass, who)) return { ok: true, pass: null };
  if (!(await verifyHuman(cfg, body.turnstileToken, ip, 'studio'))) return { ok: false };
  return { ok: true, pass: makePass(cfg.passSecret, who) };
}

export async function infPost(cfg, request, body) {
  if (!ready(cfg)) return json(503, { error: 'not_ready' });
  if (!infOn(cfg)) {
    if (!cfg.falKey) console.error('[studio] FAL_KEY is missing: the studio app is off');
    return json(503, { error: 'not_ready' });
  }
  const ip = clientIp(request), who = visitorCode(cfg.passSecret, ip);
  const now = Date.now();
  const id = typeof body.id === 'string' ? body.id : '';
  // a report: anyone (the human check, a daily code of who reported: never an address or an IP)
  if (body.action === 'inf-report') {
    if (!infActBurst(who)) return json(429, { error: 'too_fast' });
    if (!Object.hasOwn(REPORT_WHYS, body.why) || !ID.test(id)) return json(400, { error: 'bad_request' });
    const h = await human(cfg, body, ip, who);
    if (!h.ok) return json(401, { error: 'human_check' });
    try {
      const r = await report(cfg, { inf: id, job: ID.test(String(body.job)) ? body.job : null, why: body.why, who: visitorCodeForDay(cfg.passSecret, ip, new Date(now).toISOString().slice(0, 10)) });
      return r.ok ? json(200, { ok: true, pass: h.pass }) : json(r.why === 'too_many' ? 429 : r.why === 'gone' ? 404 : 400, { error: r.why, pass: h.pass });
    } catch (err) { return dbTrouble(err, 'a report'); }
  }
  let w;
  try { w = await walletNow(cfg, body.session, { now }); } catch (err) { return dbTrouble(err, 'reading the wallet'); }
  if (!w) return json(401, { error: 'signed_out', signedOut: true });
  const extra = w.session ? { session: w.session, level: w.level } : { level: w.level };
  const refuse = (r) => json(WHY_STATUS[r.why] || 422, { error: r.why, ...(r.have !== undefined ? { have: r.have } : {}), ...(r.reason ? { reason: r.reason } : {}), ...extra });
  const words = (r, more = {}) => json(422, { error: 'words', field: r.field, why: r.why, ...more, ...extra });
  const asks = ['inf-up-open', 'inf-up-done', 'inf-start', 'inf-make', 'inf-3d', 'inf-coin', 'inf-topup', 'inf-reroll', 'inf-delete', 'trend-make',
    'inf-3d-burn', 'inf-3d-check', 'inf-3d-redo', 'inf-burn-quote', 'inf-burn-check', 'inf-week-claim', 'inf-example-make'];
  if (asks.includes(body.action) && !infActBurst(who)) return json(429, { error: 'too_fast', ...extra });
  if (['inf-look', 'inf-like', 'inf-liked'].includes(body.action) && !infLookBurst(who)) return json(429, { error: 'too_fast', ...extra });
  try {
    if (body.action === 'inf-me') return json(200, { ...await me(cfg, w), ...extra });
    if (body.action === 'inf-look') return await look(cfg, w, id, extra, now);
    if (body.action === 'inf-up-open' || body.action === 'inf-start') {
      if (body.adult !== true) return json(400, { error: 'adult', ...extra });
      const h = await human(cfg, body, ip, who);
      if (!h.ok) return json(401, { error: 'human_check', ...extra });
      const pass = h.pass ? { pass: h.pass } : {};
      if (body.action === 'inf-up-open') {
        const { openUpload } = await import('./inf-uploads.js');
        const { newOrderId } = await import('./studio.js');
        if (!mayMake(cfg, w.wallet)) return refuse({ why: 'closed' });
        const r = await openUpload(cfg, { code: studioWallet(cfg.passSecret, w.wallet), kind: body.kind, bytes: body.bytes, consent: body.consent, id: newOrderId() });
        if (!r.ok) return json(WHY_STATUS[r.why] || 422, { error: r.why, ...pass, ...extra });
        const { ok, ...rest } = r;
        return json(200, { ok, ...rest, ...pass, ...extra });
      }
      const r = await startInf(cfg, { wallet: w.wallet, level: w.level, input: body });
      if (!r.ok) return r.field ? words(r, pass) : json(WHY_STATUS[r.why] || 422, { error: r.why, ...(r.have !== undefined ? { have: r.have } : {}), ...pass, ...extra });
      return json(200, { ...r, ...pass, ...extra });
    }
    if (body.action === 'inf-up-done') {
      const { readTicket, finishClip } = await import('./inf-uploads.js');
      const t = readTicket(cfg.passSecret, 'up', body.ticket);
      if (!t || t.k !== 'clip' || t.w !== studioWallet(cfg.passSecret, w.wallet)) return json(401, { error: 'ticket', ...extra });
      let r;
      try { r = await finishClip(cfg, t); } catch (err) {
        if (err.why === 'ai') { console.warn(`[studio] a clip couldn't be looked at: ${err.message}`); return json(503, { error: 'ai', ...extra }); }
        throw err;
      }
      return r.ok ? json(200, { ok: true, id: t.u, seconds: r.seconds, ...extra }) : json(422, { error: 'refused', why: r.why, ...extra });
    }
    if (body.action === 'inf-topup') {
      if (!mayMake(cfg, w.wallet)) return refuse({ why: 'closed' });             // (private: nothing to spend credits on yet)
      const { checkTopup, creditsOf } = await import('./credits.js');
      const { txFrom } = await import('./burn.js');
      const tx = body.tx === undefined || body.tx === null || body.tx === '' ? null : txFrom(body.tx);
      if (body.tx && !tx) return json(400, { error: 'bad_tx', ...extra });
      let r;
      try { r = await checkTopup(cfg, { wallet: w.wallet, tx, now }); } catch (err) {
        if (err.why === 'chain' || err.why === 'explorer') {
          console.warn(`[studio] checking a top-up (${err.why}): ${err.message}`);
          return json(503, { error: err.why, ...extra });
        }
        throw err;
      }
      if (!r.ok) return refuse(r);
      return json(200, { ...r, credits: await creditsOf(cfg, studioWallet(cfg.passSecret, w.wallet)), ...extra });
    }
    if (OWNER_ACTIONS.includes(body.action)) {
      if (!isOwner(cfg, w.wallet)) return json(403, { error: 'not_owner', ...extra });
      return await owner(cfg, body, extra, now);
    }
    // (round 2) likes: any signed-in wallet (only holders' count toward the weekly spotlight)
    if (body.action === 'inf-like') {
      const { like } = await import('./inf-week.js');
      const r = await like(cfg, { wallet: w.wallet, level: w.level, job: body.job, like: body.like });
      return r.ok ? json(200, { ...r, ...extra }) : refuse(r);
    }
    if (body.action === 'inf-liked') {
      if (!Array.isArray(body.jobs) || body.jobs.length > 120) return json(400, { error: 'bad_request', ...extra });
      const { likedOf } = await import('./inf-week.js');
      return json(200, { liked: await likedOf(cfg, w.wallet, body.jobs), ...extra });
    }
    // (round 2) a weekly spotlight's prize, sent to its maker's own wallet by the prize wallet
    if (body.action === 'inf-week-claim') {
      const { claimWeek } = await import('./inf-week.js');
      let r;
      try { r = await claimWeek(cfg, { wallet: w.wallet, week: body.week, deadline: now + 18_000 }); } catch (err) {
        if (/^chain:/.test(err?.message || '')) { console.warn(`[studio] a weekly prize: ${err.message}`); return json(503, { error: 'chain', ...extra }); }
        throw err;
      }
      return r.ok ? json(200, { ...r, ...extra }) : json(WHY_STATUS[r.why] || 422, { error: r.why, ...(r.tx ? { tx: r.tx } : {}), ...extra });
    }
    // (round 2) burn unlocks: one more influencer, or a boost in Explore (while it's private, only its wallets: nothing to unlock)
    if (body.action === 'inf-burn-quote') {
      if (!mayMake(cfg, w.wallet)) return refuse({ why: 'closed' });
      const { burnQuote } = await import('./inf-burns.js');
      const r = await burnQuote(cfg, { wallet: w.wallet, what: body.what, inf: body.what === 'boost' ? (ID.test(id) ? id : '') : null });
      return r.ok ? json(200, { ...r, ...extra }) : refuse(r);
    }
    if (body.action === 'inf-burn-check') {
      const { burnCheck } = await import('./inf-burns.js');
      const { txFrom } = await import('./burn.js');
      const tx = body.tx === undefined || body.tx === null || body.tx === '' ? null : txFrom(body.tx);
      if (body.tx && !tx) return json(400, { error: 'bad_tx', ...extra });
      let r;
      try { r = await burnCheck(cfg, { wallet: w.wallet, id: String(body.burn || ''), tx, now }); } catch (err) {
        if (err.why === 'chain' || err.why === 'explorer') {
          console.warn(`[studio] checking a burn unlock (${err.why}): ${err.message}`);
          return json(503, { error: err.why, ...extra });
        }
        throw err;
      }
      return r.ok ? json(200, { ...r, ...extra }) : refuse(r);
    }
    if (!ID.test(id)) return json(400, { error: 'bad_request', ...extra });
    if (body.action === 'inf-pick') {
      const r = await pickLook(cfg, { wallet: w.wallet, id, look: body.look });
      return r.ok ? json(200, { ok: true, ...extra }) : refuse(r);
    }
    if (body.action === 'inf-reroll') {
      const r = await rerollLooks(cfg, { wallet: w.wallet, level: w.level, id });
      return r.ok ? json(200, { ...r, ...extra }) : refuse(r);
    }
    if (body.action === 'inf-make') {
      const r = await makeJob(cfg, { wallet: w.wallet, level: w.level, id, input: body });
      if (!r.ok) return r.field ? words(r) : refuse(r);
      return json(200, { ...r, ...extra });
    }
    if (body.action === 'inf-3d') {
      const r = await order3d(cfg, { wallet: w.wallet, level: w.level, id });
      return r.ok ? json(200, { ...r, ...extra }) : refuse(r);
    }
    // (round 2) a free 3D model for a big burn: its quote, "Check my burn", and making it again (free) if it couldn't be made
    if (body.action === 'inf-3d-burn') {
      const r = await order3dBurn(cfg, { wallet: w.wallet, level: w.level, id });
      return r.ok ? json(200, { ...r, ...extra }) : refuse(r);
    }
    if (body.action === 'inf-3d-check') {
      const { txFrom } = await import('./burn.js');
      const tx = body.tx === undefined || body.tx === null || body.tx === '' ? null : txFrom(body.tx);
      if (body.tx && !tx) return json(400, { error: 'bad_tx', ...extra });
      let r;
      try { r = await check3dBurn(cfg, { wallet: w.wallet, id, order: String(body.order || ''), tx, now }); } catch (err) {
        if (err.why === 'chain' || err.why === 'explorer') {
          console.warn(`[studio] checking a 3D model's burn (${err.why}): ${err.message}`);
          return json(503, { error: err.why, ...extra });
        }
        throw err;
      }
      return r.ok ? json(200, { ...r, ...extra }) : refuse(r);
    }
    if (body.action === 'inf-3d-redo') {
      const r = await redo3d(cfg, { wallet: w.wallet, id, order: String(body.order || '') });
      return r.ok ? json(200, { ok: true, ...extra }) : refuse(r);
    }
    if (body.action === 'inf-public') {
      const r = await setPublic(cfg, { wallet: w.wallet, id, show: body.show });
      return r.ok ? json(200, { ok: true, ...extra }) : refuse(r);
    }
    if (body.action === 'inf-delete') {
      const r = await deleteInf(cfg, { wallet: w.wallet, id });
      return r.ok ? json(200, { ok: true, ...extra }) : refuse(r);
    }
    if (body.action === 'inf-coin') {
      const r = await coinDraft(cfg, { wallet: w.wallet, id, name: body.name, symbol: body.symbol, description: body.description });
      return r.ok ? json(200, { ...r, ...extra }) : refuse(r);
    }
  } catch (err) {
    return dbTrouble(err, body.action);
  }
  return json(400, { error: 'bad_request', ...extra });
}

// Its own influencer's page (another's: what anyone sees), one thing being made moved one step, and the tickets for posters
// its page may take of its done videos
async function look(cfg, w, id, extra, now) {
  if (!ID.test(id)) return json(400, { error: 'bad_request', ...extra });
  let page = await infPage(cfg, id, { wallet: w.wallet });
  if (!page) return json(404, { error: 'gone', ...extra });
  let moved = null;
  if (page.mine) {
    try {
      moved = await moveAlong(cfg, page, { now, deadline: now + 17_000 });
      if (moved && moved.state !== 'busy' && moved.state !== 'waiting') page = (await infPage(cfg, id, { wallet: w.wallet })) || page;
    } catch (err) {
      console.warn(`[studio] influencer ${id}: ${err.message}`);
    }
  }
  const { raw, mine, ...rest } = page;
  const out = { ...rest };
  if (moved?.position !== undefined) out.position = { job: moved.what, at: moved.position };
  // (round 2) which of its photos and videos this wallet liked (its hearts, filled in)
  if (!page.influencer.private) {
    const done = page.jobs.filter((j) => j.status === 'done').map((j) => j.id);
    out.liked = done.length ? await (await import('./inf-week.js')).likedOf(cfg, w.wallet, done).catch(() => []) : [];
  }
  if (mine && raw.looks_job && Number.isInteger(raw.pick)) {
    const { makeTicket } = await import('./inf-uploads.js');
    const lookPath = picPath(id, raw.looks_job, raw.pick);
    out.posters = Object.fromEntries(page.jobs.filter((j) => j.status === 'done' && !j.poster && ['trend', 'video'].includes(j.kind))
      .slice(0, 6).map((j) => [j.id, makeTicket(cfg.passSecret, 'poster', { j: j.id, o: id, l: lookPath }, now, 60 * 60_000)]));
  }
  return json(200, { ...out, ...extra });
}

// The owner's tools
async function owner(cfg, body, extra, now) {
  if (body.action === 'inf-owner') {
    let page = await ownerPage(cfg);
    // the owner's trend clips (and, round 2, example pictures) being made: one moved along per look (the clock does the rest),
    // with the time an influencer's own look has (enough to keep its video: server/inf-jobs.js SAVE_NEEDS_MS), and the page
    // read again when it moved
    const making = page.trends.find((t) => t.job && ['paid', 'making'].includes(t.jobStatus));
    const example = making ? null : page.examples.find((x) => x.latest && ['paid', 'making'].includes(x.status));
    const job = making?.job || example?.latest;
    if (job) {
      try {
        const r = await (await import('./inf-jobs.js')).jobTick(cfg, job, { now, deadline: now + 17_000 });
        if (r.state !== 'busy' && r.state !== 'waiting') page = await ownerPage(cfg);
      } catch (err) { console.warn(`[studio] ${making ? `trend ${making.id}` : `example ${example.key}`}: ${err.message}`); }
    }
    const { makeTicket } = await import('./inf-uploads.js');
    const posters = Object.fromEntries(page.trends.filter((t) => t.job && t.jobStatus === 'done' && !t.poster)
      .map((t) => [t.job, makeTicket(cfg.passSecret, 'poster', { j: t.job, o: 'trends' }, now, 60 * 60_000)]));
    return json(200, { ...page, posters, ...extra });
  }
  if (body.action === 'inf-example-make') {
    const r = await exampleMake(cfg, body.keys);
    return r.ok ? json(200, { ...r, ...extra }) : json(400, { error: r.why, ...extra });
  }
  if (body.action === 'inf-week-set') {
    const { weekSet } = await import('./inf-week.js');
    const r = await weekSet(cfg, { week: body.week, action: body.week_action, prize: body.prize ?? null });
    return r.ok ? json(200, { ...r, ...extra }) : json(WHY_STATUS[r.why] || 409, { error: r.why, ...extra });
  }
  if (body.action === 'trend-make') {
    const r = await trendMake(cfg, body.trend);
    return r.ok ? json(200, { ...r, ...extra }) : json(WHY_STATUS[r.why] || 422, { error: r.why, ...extra });
  }
  if (body.action === 'trend-set') {
    const r = await trendSet(cfg, body.trend, body.status);
    return r.ok ? json(200, { ok: true, ...extra }) : json(409, { error: r.why, ...extra });
  }
  if (body.action === 'inf-hide') {
    const r = await hide(cfg, { inf: body.inf ?? null, job: body.job ?? null, hidden: body.hidden !== false });
    return r.ok ? json(200, { ok: true, ...extra }) : json(r.why === 'bad' ? 400 : 404, { error: r.why, ...extra });
  }
  const r = await clearReports(cfg, { inf: body.inf, job: body.job ?? null });
  return r.ok ? json(200, { ok: true, ...extra }) : json(400, { error: r.why, ...extra });
}
