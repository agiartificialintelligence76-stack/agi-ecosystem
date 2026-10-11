// AGI-1's 3D character studio (2026-10-10): its web side, inside api/launch.js (Vercel's Hobby plan allows 12 functions
// and they're all used; a launch and a character go together: a character can be a coin's face). server/studio.js does
// the work. Everything here is "no-store" except a character's files and the gallery (the same for everyone).
//   GET  ?studio=<id>            → a character: { character: pageView } (and, while it's being made, one step moved along)
//   GET  ?studio-file=<id>.glb|webp|png → its 3D model (GLB: its bones and moves, 4 MB at most), its picture (WebP), its
//                                  bigger picture to download (PNG); from the private bucket, kept a day by the CDN
//   GET  ?studio-list            → the gallery: [{ id, name, done }], the newest 24
//   GET  ?studio-info            → { on, open, price, discounts, usdg, payTo, token, burnAddress, left, burnsLeft, moves }
//   POST { action: 'studio-quote', session, name, about, style, adult: true, pass? | turnstileToken? } → a quote
//   POST { action: 'studio-choose', session, id, kind: 'usdg' | 'burn' | 'free' } → how it's paid
//   POST { action: 'studio-check', session, id, tx? } → "Check my payment"
//   POST { action: 'studio-redo', session, id, name, about, style } → a paid one that couldn't be made, again (free)
//   POST { action: 'studio-mine', session } → this wallet's characters, and whether it may make one (allowed)
// Its characters' videos (2026-10-10, server/studio-video.js):
//   GET  ?studio-videos=<character id> → its done videos: { videos: [videoView] }, the same for everyone
//   GET  ?studio-video=<id>.mp4      → a done video, from our own address: the part its player asks for ("Range"), at most
//                                      4 MB a time, or all of it when it's small (a big one asked for whole: a redirect)
//   GET  ?studio-video-dl=<id>.mp4   → a redirect to a short-lived signed address in the private bucket, to download it
//                                      with its own name
//   POST { action: 'studio-video-mine', session, char } → { on, owner, allowed, price, left, videos } (its own wallet's too)
//   POST { action: 'studio-video-quote', session, char, scene, shape, sound, adult: true, pass? | turnstileToken? } → a quote
//   POST { action: 'studio-video-check', session, id, tx? } → "Check my payment" (USDG)
//   POST { action: 'studio-video-redo', session, id, scene, shape, sound } → a paid one that couldn't be made, again (free)
//   POST { action: 'studio-video-look', session, id } → one of its own videos (and, while it's made, one step along)
// Every POST answer carries `session` when the wallet's level was read again (the page keeps it), or `signedOut: true`.
// Since AGI Studio (2026-10-10) api/launch.js answers studio-quote and studio-video-quote itself, with 410 { error: 'moved' }:
// new 3D models come from AGI Studio's influencers, paid in credits (server/influencer.js). The rest still finishes an order
// made before, and every character's page, files and videos still answer.
import { clientIp, visitorCode, makePass, checkPass } from './security.js';
import { verifyHuman } from './turnstile.js';
import { makeBurstLimit } from './burst.js';
import {
  studioOn, mayMake, walletNow, getOrder, pageView, makeQuote, choosePay, checkPayment, redo, myCharacters, gallery, monthLeft, tick,
  studioWallet,
} from './studio.js';
import {
  videosOn, getVideo, videoView, charVideos, videoQuote, checkVideoPayment, videoRedo, videoTick, videoFile,
} from './studio-video.js';
import { ORDER_ID, FILE_RE, FILES, MOVE_NAMES, DISCOUNT, VIDEO_RE, VIDEO_SECONDS, priceFor } from '../src/studio/rules.js';
import { USDG } from './studio-chain.js';
import { BURN_ADDRESS } from '../src/lib/burns.js';
import { txFrom } from './burn.js';

// speed bumps (per server copy): looking at a character (each look may ask Meshy), its files, and the actions that ask
// Cloudflare or read the chain (a quote, "Check my payment")
export const studioLookBurst = makeBurstLimit({ max: 40, windowMs: 60_000 });
export const studioFileBurst = makeBurstLimit({ max: 240, windowMs: 60_000 });
export const studioActBurst = makeBurstLimit({ max: 12, windowMs: 60_000 });

const json = (status, body, cache = 'no-store') => Response.json(body, { status, headers: { 'Cache-Control': cache } });
const ready = (cfg) => Boolean(cfg.supabaseUrl && cfg.supabaseKey && cfg.passSecret.length >= 32);
function dbTrouble(err, what) {
  if (err?.code === 'PGRST202') return json(503, { error: 'not_ready' });
  console.error(`[studio] ${what}: ${err?.message}`);
  return json(503, { error: 'busy' });
}

// GET: the four studio questions (the caller already knows the query has exactly one of them)
export async function studioGet(cfg, request, key, value) {
  if (!ready(cfg)) return json(503, { error: 'not_ready' });
  const who = visitorCode(cfg.passSecret, clientIp(request));
  if (key === 'studio-info') {
    let left = null;
    try { left = studioOn(cfg) ? await monthLeft(cfg) : null; } catch (err) { if (err.code !== 'PGRST202') console.warn(`[studio] this month's places: ${err.message}`); }
    return json(200, {
      on: studioOn(cfg) && left !== null, open: cfg.studioOpen,
      price: { usdCents: cfg.studioUsdCents, agi: cfg.studioAgi }, discounts: DISCOUNT,
      usdg: Boolean(cfg.studioPayTo), payTo: cfg.studioPayTo || null, token: USDG, burnAddress: BURN_ADDRESS,
      left: left?.left ?? 0, burnsLeft: left?.burnsLeft ?? 0, moves: MOVE_NAMES,
      video: { on: videosOn(cfg) && left !== null, usdCents: cfg.videoUsdCents, seconds: VIDEO_SECONDS, left: left?.videosLeft ?? 0 },
    }, 'public, max-age=15, s-maxage=30');
  }
  if (key === 'studio-list') {
    try { return json(200, { characters: await gallery(cfg) }, 'public, max-age=30, s-maxage=60'); } catch (err) { return dbTrouble(err, 'the gallery'); }
  }
  // a character's done videos (the same for everyone)
  if (key === 'studio-videos') {
    if (!ORDER_ID.test(value || '')) return json(400, { error: 'bad_request' });
    try { return json(200, { videos: await charVideos(cfg, value) }, 'public, max-age=20, s-maxage=30'); } catch (err) { return dbTrouble(err, "a character's videos"); }
  }
  // a done video, from our own address: played in parts (its player's "Range"), or whole when it's small; downloaded (or a
  // big one opened in a tab) through a short-lived signed address in the private bucket
  if (key === 'studio-video' || key === 'studio-video-dl') {
    if (!VIDEO_RE.test(value || '')) return json(400, { error: 'bad_request' });
    if (!studioFileBurst(who)) return json(429, { error: 'too_fast' });
    let r;
    try { r = await videoFile(cfg, value, { download: key === 'studio-video-dl', range: request.headers.get('range') }); } catch (err) {
      if (err.db) return dbTrouble(err, 'reading a video');
      console.warn(`[studio] a video's file: ${err.message}`);
      return json(502, { error: 'storage' });
    }
    const media = { 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" };
    if (r.status === 206) {
      return new Response(r.bytes, {
        status: 206,
        headers: { ...media, 'Content-Range': `bytes ${r.start}-${r.end}/${r.total}`, 'Content-Length': String(r.bytes.length), 'Cache-Control': 'private, max-age=86400' },
      });
    }
    if (r.status === 200) {
      return new Response(r.bytes, { status: 200, headers: { ...media, 'Content-Length': String(r.bytes.length), 'Cache-Control': 'public, max-age=86400, s-maxage=86400' } });
    }
    if (r.status === 416) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${r.total}`, 'Cache-Control': 'no-store' } });
    if (r.status !== 302) return json(r.status, { error: r.status === 400 ? 'bad_request' : 'gone' });
    return new Response(null, {
      status: 302,
      headers: { Location: r.url, 'Cache-Control': 'public, max-age=300, s-maxage=1800', 'Referrer-Policy': 'no-referrer' },
    });
  }
  if (key === 'studio-file') {
    const m = FILE_RE.exec(value || '');
    if (!m) return json(400, { error: 'bad_request' });
    if (!studioFileBurst(who)) return json(429, { error: 'too_fast' });
    let o;
    try { o = await getOrder(cfg, m[1]); } catch (err) { return dbTrouble(err, 'reading a character'); }
    if (!o || o.status !== 'done' || !pageView(cfg, o)) return json(404, { error: 'gone' });
    let bytes;
    try { bytes = await (await import('./studio-files.js')).getFile(cfg, `${m[1]}.${m[2]}`); } catch (err) {
      console.warn(`[studio] a character's file: ${err.message}`);
      return json(502, { error: 'storage' });
    }
    if (!bytes) return json(404, { error: 'gone' });
    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': FILES[m[2]], 'Cache-Control': 'public, max-age=86400, s-maxage=86400', 'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  }
  // a character, and (while it's being made) one step along: its page keeps asking while it's open
  if (!ORDER_ID.test(value || '')) return json(400, { error: 'bad_request' });
  if (!studioLookBurst(who)) return json(429, { error: 'too_fast' });
  let o;
  try { o = await getOrder(cfg, value); } catch (err) { return dbTrouble(err, 'reading a character'); }
  if (!o || !pageView(cfg, o)) return json(404, { error: 'gone' });
  if (studioOn(cfg) && ['paid', 'making'].includes(o.status)) {
    try {
      const now = Date.now();
      const r = await tick(cfg, o.id, { now, deadline: now + 17_000 });
      if (r.state !== 'busy') o = (await getOrder(cfg, o.id)) || o;
      const view = pageView(cfg, o);
      if (view && r.progress !== undefined && view.step === r.step) view.progress = r.progress;
      // (round 4) our server's clock: its progress bar counts from it (a device's clock can be off)
      return json(200, { character: view, now: Date.now() });
    } catch (err) {
      console.warn(`[studio] ${o.id}: ${err.message}`);
    }
  }
  return json(200, { character: pageView(cfg, o), now: Date.now() });
}

const WHY_STATUS = { closed: 403, not_yours: 403, gone: 404, sold_out: 409, too_many: 429, burns_sold_out: 409, free_used: 409, no_free: 409,
  no_usdg: 409, no_kind: 409, done: 409, no_credit: 409, used: 409, busy: 503, no_char: 404 };

// POST: the studio's actions (body already parsed; action starts with "studio-")
export async function studioPost(cfg, request, body) {
  if (!ready(cfg) || !studioOn(cfg)) {
    if (!cfg.meshyKey) console.error('[studio] MESHY_API_KEY is missing: the studio is off');
    return json(503, { error: 'not_ready' });
  }
  const ip = clientIp(request), who = visitorCode(cfg.passSecret, ip);
  const now = Date.now();
  let w;
  try { w = await walletNow(cfg, body.session, { now }); } catch (err) { return dbTrouble(err, 'reading the wallet'); }
  if (!w) return json(401, { error: 'signed_out', signedOut: true });
  const extra = w.session ? { session: w.session, level: w.level } : { level: w.level };
  // a speed bump for the ones that ask others (Cloudflare and the database; the chain and the explorer), and for looking at a
  // video being made (each look may ask the video service)
  if (['studio-quote', 'studio-check', 'studio-video-quote', 'studio-video-check'].includes(body.action) && !studioActBurst(who)) {
    return json(429, { error: 'too_fast', ...extra });
  }
  if (body.action === 'studio-video-look' && !studioLookBurst(who)) return json(429, { error: 'too_fast', ...extra });
  const id = typeof body.id === 'string' ? body.id : '';
  const refuse = (why, more = {}) => json(WHY_STATUS[why] || 422, { error: why, ...more, ...extra });
  try {
    if (body.action.startsWith('studio-video-')) return await videoPost(cfg, body, { w, extra, who, ip, now, id, refuse });
    // its characters, and whether it may make one (STUDIO_OPEN, else STUDIO_ONLY_FOR: the page asks before showing the form)
    if (body.action === 'studio-mine') return json(200, { characters: await myCharacters(cfg, w.wallet), allowed: mayMake(cfg, w.wallet), ...extra });
    if (body.action === 'studio-quote') {
      if (body.adult !== true) return json(400, { error: 'adult', ...extra });
      let pass = null;
      if (!checkPass(cfg.passSecret, body.pass, who)) {
        if (!(await verifyHuman(cfg, body.turnstileToken, ip, 'studio'))) return json(401, { error: 'human_check', ...extra });
        pass = makePass(cfg.passSecret, who);
      }
      const q = await makeQuote(cfg, { wallet: w.wallet, level: w.level, name: body.name, about: body.about, style: body.style });
      if (!q.ok) return q.field ? json(422, { error: 'words', field: q.field, why: q.why, pass, ...extra }) : refuse(q.why, { pass });
      const { ok, ...rest } = q;
      return json(200, { ok, ...rest, pass, ...extra });
    }
    if (!ORDER_ID.test(id)) return json(400, { error: 'bad_request', ...extra });
    if (body.action === 'studio-choose') {
      if (!['usdg', 'burn', 'free'].includes(body.kind)) return json(400, { error: 'bad_request', ...extra });
      const r = await choosePay(cfg, { id, wallet: w.wallet, kind: body.kind });
      return r.ok ? json(200, { ok: true, kind: r.kind, paid: r.paid, ...extra }) : refuse(r.why);
    }
    if (body.action === 'studio-check') {
      const tx = body.tx === undefined || body.tx === null || body.tx === '' ? null : txFrom(body.tx);
      if (body.tx && !tx) return json(400, { error: 'bad_tx', ...extra });
      let r;
      try { r = await checkPayment(cfg, { id, wallet: w.wallet, tx, now }); } catch (err) {
        if (err.why === 'chain' || err.why === 'explorer') {
          console.warn(`[studio] checking a payment (${err.why}): ${err.message}`);
          return json(503, { error: err.why, ...extra });
        }
        throw err;
      }
      return r.ok ? json(200, { ...r, ...extra }) : refuse(r.why);
    }
    if (body.action === 'studio-redo') {
      const r = await redo(cfg, { id, wallet: w.wallet, name: body.name, about: body.about, style: body.style });
      if (r.ok) return json(200, { ok: true, ...extra });
      return r.field ? json(422, { error: 'words', field: r.field, why: r.why, ...extra }) : refuse(r.why);
    }
  } catch (err) {
    return dbTrouble(err, body.action);
  }
  return json(400, { error: 'bad_request', ...extra });
}

// A character's videos (2026-10-10): its owner's actions (server/studio-video.js). The page asks studio-video-mine first:
// whether videos are on, whether this wallet made the character (only it makes its videos), its price, and its videos.
async function videoPost(cfg, body, { w, extra, who, ip, now, id, refuse }) {
  const char = typeof body.char === 'string' ? body.char : '';
  if (body.action === 'studio-video-mine') {
    if (!ORDER_ID.test(char)) return json(400, { error: 'bad_request', ...extra });
    const o = await getOrder(cfg, char);
    const view = pageView(cfg, o);
    if (!view || view.status !== 'done') return refuse('gone');
    const on = videosOn(cfg);
    const owner = o.wallet_code === studioWallet(cfg.passSecret, w.wallet);
    const videos = await charVideos(cfg, char, owner ? w.wallet : null);
    const left = on ? (await monthLeft(cfg)).videosLeft : 0;
    return json(200, {
      on, owner, allowed: mayMake(cfg, w.wallet), price: { usdCents: priceFor(w.level, { usdCents: cfg.videoUsdCents, agi: 0 }).usdCents },
      left, videos, ...extra,
    });
  }
  if (!videosOn(cfg)) {
    if (!cfg.falKey) console.error('[studio] FAL_KEY is missing: its videos are off');
    return json(503, { error: 'no_videos', ...extra });
  }
  if (body.action === 'studio-video-quote') {
    if (body.adult !== true) return json(400, { error: 'adult', ...extra });
    let pass = null;
    if (!checkPass(cfg.passSecret, body.pass, who)) {
      if (!(await verifyHuman(cfg, body.turnstileToken, ip, 'studio'))) return json(401, { error: 'human_check', ...extra });
      pass = makePass(cfg.passSecret, who);
    }
    const q = await videoQuote(cfg, { wallet: w.wallet, level: w.level, char, scene: body.scene, shape: body.shape, sound: body.sound });
    if (!q.ok) return q.field ? json(422, { error: 'words', field: q.field, why: q.why, pass, ...extra }) : refuse(q.why, { pass });
    const { ok, ...rest } = q;
    return json(200, { ok, ...rest, pass, ...extra });
  }
  if (!ORDER_ID.test(id)) return json(400, { error: 'bad_request', ...extra });
  if (body.action === 'studio-video-check') {
    const tx = body.tx === undefined || body.tx === null || body.tx === '' ? null : txFrom(body.tx);
    if (body.tx && !tx) return json(400, { error: 'bad_tx', ...extra });
    let r;
    try { r = await checkVideoPayment(cfg, { id, wallet: w.wallet, tx, now }); } catch (err) {
      if (err.why === 'chain' || err.why === 'explorer') {
        console.warn(`[studio] checking a video's payment (${err.why}): ${err.message}`);
        return json(503, { error: err.why, ...extra });
      }
      throw err;
    }
    return r.ok ? json(200, { ...r, ...extra }) : refuse(r.why);
  }
  if (body.action === 'studio-video-redo') {
    const r = await videoRedo(cfg, { id, wallet: w.wallet, scene: body.scene, shape: body.shape, sound: body.sound });
    if (r.ok) return json(200, { ok: true, ...extra });
    return r.field ? json(422, { error: 'words', field: r.field, why: r.why, ...extra }) : refuse(r.why);
  }
  if (body.action === 'studio-video-look') {
    let v = await getVideo(cfg, id);
    if (!v || v.wallet_code !== studioWallet(cfg.passSecret, w.wallet)) return refuse('gone');     // never someone else's
    let r = null;
    if (['paid', 'making'].includes(v.status)) {
      try {
        r = await videoTick(cfg, id, { now, deadline: now + 17_000 });
        if (r.state !== 'busy') v = (await getVideo(cfg, id)) || v;
      } catch (err) {
        console.warn(`[studio] video ${id}: ${err.message}`);
      }
    }
    const view = videoView(cfg, v, { mine: true });
    if (!view) return refuse('gone');
    if (r?.step && (view.status === 'paid' || view.status === 'making')) view.step = r.step;
    if (Number.isInteger(r?.position) && view.step === 'queue') view.position = r.position;
    return json(200, { video: view, ...extra });
  }
  return json(400, { error: 'bad_request', ...extra });
}
