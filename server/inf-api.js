// AGI Studio (2026-10-10, studio.agi1.app): its web side, inside api/launch.js like the 3D studio's (Vercel's 12 functions
// are all used; an influencer can be a coin's face). server/influencer.js does the work.
//   GET  ?inf-info                → { on, photos, open, base prices and discounts, free credits a month, top-ups, payTo, token,
//                                   threeD, coins (Launch with AGI-1 set up), launch (and open to everyone), and since round 2
//                                   examples ({ choice: its picture's job }), burns (what each unlock costs in $AGI), slots,
//                                   weeklyPrize, likesADay } (the same for everyone)
//   GET  ?inf-explore             → Explore: { influencers, fresh (photos and videos), agi1 (2026-10-13: the newest with AGI-1
//                                   in them), trends, boosted, spotlight } (the same for everyone)
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
//   POST { action: 'inf-up-open', session, kind ('picture' | 'clip' | since phase 4 'ref'), bytes, consent? (a picture), adult: true,
//        pass? | turnstileToken? } → an upload's ticket
//   POST ?inf-up=<ticket>&part=<n> | &frame=<n>  (the file's bytes, application/octet-stream) → its file, a part or a frame
//   POST { action: 'inf-up-done', session, ticket }            → a clip put together and looked at
//   POST { action: 'inf-start', session, name, mode, style?, settings, words, source?, way? (2026-10-11, from a picture: 'looks',
//        'body' or 'asis'), adult: true, pass? | turnstileToken? }
//   POST { action: 'inf-pick', session, id, look } · { action: 'inf-reroll', session, id }
//   POST { action: 'inf-make', session, id, kind, scene?, shape?, sound?, trend? | clip?, image?, and (round 4, phase 4) the model
//        menu's model?, quality?, seconds?, refs? (reference uploads' ids), meme? and lines? (a meme's words), and (2026-10-12, the
//        editor) edit? (a photo with image: "Edit with words", its change; the rest is that photo's own), and (2026-10-13) agi1?
//        (true: "With AGI-1", AGI-1 in it; a photo with image and agi1 and no edit is "Add AGI-1") } → { ok, job, cost }
//   POST { action: 'inf-again', session, job } (2026-10-12, the editor: "Make another") → one of its own photos, videos or trend
//        videos made again with the same words and settings, next to it, at the price of making it now → { ok, job, cost, kind }
//   POST { action: 'inf-job-delete', session, job } (2026-10-12, the editor) → one of its own photos, videos or trend videos
//        off every page for good (its files deleted; a profile picture framed from it goes back to its picked look) → { ok,
//        files, pfp }; never while it's being made ('job_making') or while something is made from it ('job_in_use')
//   POST { action: 'inf-photo-open', session, from, shape, words } (2026-10-12, the editor: the photo editor, in its maker's own
//        browser) → a ticket to save one of its own photos edited as a new photo next to it ({ ok, job, ticket, left }: free,
//        EDITOR.PER_DAY a wallet; server/inf-editor.js); then POST ?inf-photo=<ticket> (its JPEG) → looked at, then kept ({ ok, job })
//   POST { action: 'inf-cut-open', session, from, cut, words, layer } (2026-10-12, the video editor: one of its own videos or trend
//        videos trimmed, its shape changed, words and stickers drawn in its maker's browser) → { ok, job, left } (started: made by
//        our clock, then looked at) or, with its words' picture (layer: true), { ok, job, ticket, size, left }; then POST
//        ?inf-cut=<ticket> (that PNG, exactly its size) → started ({ ok, job, left }). Free, VIDEO_EDITOR.PER_DAY a wallet
//        (server/inf-cut.js)
//   POST { action: 'inf-3d', session, id, spec? } · { action: 'inf-public', session, id, show } · { action: 'inf-delete', session, id }
//        (2026-10-13, the 3D tool) spec: a 3D model's choices (src/studio/rules.js modelSpec: its library moves, moves described in
//        words, its detail, shine, pose, height, its look in words, more downloads); none is the model as before. Its price is its
//        standard price and its extras (→ { ok, order, free, cost }); a choice that isn't one is 400 { error: 'spec', field }, its
//        words' "no" 422 { error: 'words', field: 'look' | 'own', n?, part?, why }
//   POST { action: 'inf-3d-dl', session, order, format? } (2026-10-13) → a 3D model's extra downloads, its maker's alone: without
//        a format { ok, formats, done, todo, failed, until, clean } (clean: its page's pictures and clips come without our
//        watermark for it, a holder's, as its photos do); with one { ok, url, name } (a signed address, 2 hours)
//   POST { action: 'inf-pfp', session, id, from } (2026-10-11) → its profile picture: a square framed in one of its own
//        pictures (from: { job, n, x, y, s }: one of its looks, its full body or one of its photos), or its picked look again
//        (from: null) → { ok, portrait, pfp }; no credits. Its files: ?inf-file=<id>/<its own id>-0.jpg | .webp
//   POST { action: 'inf-coin', session, id, name, symbol, description, picture? } → a launch link (Launch with AGI-1's page);
//        (2026-10-11) its picture: its profile picture ('profile', the default) or { job, n, x, y, s } (one of its own pictures,
//        framed as a square)
//   POST { action: 'inf-topup', session, tx? }                 → "Check my payment" (USDG → credits)
//   POST { action: 'inf-report', id, job?, why, pass? | turnstileToken? } (anyone)
//   POST ?inf-poster=<ticket> (a frame as a picture)           → a video's poster, looked at first
//   (round 2) POST { action: 'inf-like', session, job, like } · { action: 'inf-liked', session, jobs }
//             POST { action: 'inf-3d-burn', session, id } · { action: 'inf-3d-check', session, id, order, tx? } ·
//                  { action: 'inf-3d-redo', session, id, order }      (a free 3D model for a big burn)
//             POST { action: 'inf-burn-quote', session, what: 'slot' | 'boost', id? } · { action: 'inf-burn-check', session,
//                  burn, tx? }                                          (burn unlocks)
//             POST { action: 'inf-week-claim', session, week }      (a weekly spotlight's prize, to its maker's wallet)
//   (round 4) POST { action: 'inf-caption', session, job, tone, platform } → captions written by AI for a post of one of its own
//                  creations ({ ok, captions, left }: CAPTIONS_A_DAY a wallet)
//             POST { action: 'inf-name-set', session, name } · { action: 'inf-name-clear', session } → the clank.trade username it
//                  shows ("by @name"), once our server read that clank.trade profile and its wallet is this one
//   the owner's: { action: 'inf-owner' | 'trend-make' | 'trend-set' | 'inf-hide' | 'inf-report-clear' | 'inf-example-make' |
//   'inf-week-set', session, … }, and (round 3) { action: 'inf-gift', session, to: 'me' | <a wallet's address>, credits }:
//   credits for testing, free, to the owner's own wallet or a tester's (→ { ok, gave, self, to, allowed, credits? }); (round 4,
//   phase 2) { action: 'inf-admin', session, fresh? } (the owner's tab: the numbers, the AI services' balances, the alert
//   levels and link, the team), 'inf-admin-set' (thresholds), 'inf-team-set' (address, role, nick), 'inf-team-remove' (code)
//   (round 4, phase 2) the team's (server/inf-team.js: a mod, support, or the owner): { action: 'inf-mod', session, status? }
//   (its tickets, and for a mod the reports and bans), 'mod-ticket' | 'mod-ticket-say' | 'mod-ticket-close' (ticket, body?),
//   'mod-ban' (inf, reason, note), 'mod-unban' (ban); and a mod may 'inf-hide' and 'inf-report-clear' too
//   (round 4, phase 2) support: { action: 'inf-tickets' | 'inf-ticket' | 'inf-ticket-open' | 'inf-ticket-say' |
//   'inf-ticket-close', session, ticket?, topic?, body? }, and the AI helper { action: 'inf-help', session? | pass? |
//   turnstileToken?, question, before? } (anyone: signed out, after the human check)
//   (round 4, phase 3) gifts of bought credits and invites (server/inf-gifts.js): { action: 'inf-gifts', session } (its gifts,
//   invite rewards, invite link's code and numbers, its credits); 'inf-send' (to, credits, note?); 'inf-gift-link' (credits,
//   note?) → its secret, for the page's "#gift=" link; 'inf-gift-cancel' (gift); 'inf-gift-claim' (token); 'inf-ref-bind'
//   (code: from an invite link); and { action: 'inf-gift-peek', token } (anyone with a gift link: what it is, before
//   signing in). A gift link's secret only ever comes in a POST's body, never a page's address (its "#gift=" part stays in
//   the browser).
//   (2026-10-12) the owner's gift links of free credits (only the owner's wallet): { action: 'inf-owner-links', session } (the
//   owner's list), 'inf-owner-link' (credits, note?) → its secret, for the page's "#gift=" link; 'inf-owner-link-cancel'
//   (gift). Claimed with 'inf-gift-claim' and seen with 'inf-gift-peek' like a person's (as bonus credits, from "AGI Studio").
//   A banned wallet (a mod's ban) makes nothing: every action that makes, picks, publishes, likes or unlocks answers 403
//   'banned' (its tickets, the helper, its own pages, buying credits and deleting still work).
// Every answer is "no-store" but the ones the same for everyone. POST answers carry `session` when the wallet's level was read
// again (the page keeps it), or `signedOut: true`.
import { clientIp, visitorCode, visitorCodeForDay, makePass, checkPass } from './security.js';
import { verifyHuman } from './turnstile.js';
import { makeBurstLimit } from './burst.js';
import { studioOn, walletNow, studioWallet } from './studio.js';
import {
  infOn, isOwner, infPage, moveAlong, me, startInf, pickLook, rerollLooks, makeJob, order3d, setPublic, deleteInf, report, coinDraft,
  explore, ownerPage, trendMake, trendSet, hide, clearReports, ID, order3dBurn, check3dBurn, redo3d, examplesMap, stats, exampleMake,
  setProfile, pfpShown, againJob, deleteJob, dl3d,
} from './influencer.js';
import { getJob, picPath, videoPath, posterPath, examplePath, markedPath, hdPath, aiTagged } from './inf-jobs.js';
import { ownMark } from '../src/studio/video-edit.js';
import { downloadFor, cleanFile, cleanNeed, holdsEnough } from './inf-clean.js';
import { USDG } from './studio-chain.js';
import { WEEK, prizesOn } from './inf-week.js';
import { BURNS } from './inf-burns.js';
import {
  whoIs, may, OWNER_NICK, teamList, teamSet, teamRemove, banMaker, unban, bansList, ticketOpen, ticketsMine, ticketThread, ticketSay,
  ticketClose, ticketsStaff, canUse, accessList, accessSet, accessRemove, ACCESS,
} from './inf-team.js';
import { giftsInfo, giftsOn, refsOn } from './inf-gifts.js';
import { PRICES, DISCOUNT, FREE_CREDITS, TOPUPS, TOPUP_MIN, INF_FILE_RE, INF_DL_RE, REPORT_WHYS, clankProfileUrl, CAPTIONS_A_DAY, HELPER, EDITOR, VIDEO_EDITOR } from '../src/studio/rules.js';

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
export const _resetInfApi = () => { statsCache = null; warned = false; };
export async function infGet(cfg, request, key, value) {
  if (!ready(cfg)) return json(503, { error: 'not_ready' });
  const who = visitorCode(cfg.passSecret, clientIp(request));
  // (2026-10-12) a holder's clean download of its own creation (server/inf-clean.js)
  if (key === 'inf-clean') {
    if (!infFileBurst(who)) return json(429, { error: 'too_fast' });
    let r;
    try { r = await cleanFile(cfg, value); } catch (err) { return dbTrouble(err, 'a clean download'); }
    if (r.location) return new Response(null, { status: 302, headers: { Location: r.location, 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'private, no-store' } });
    if (!r.bytes) return json(r.status, r.body);
    return new Response(r.bytes, { status: 200, headers: { ...MEDIA, 'Content-Type': 'image/jpeg', 'Content-Disposition': `attachment; filename="${r.name}"`, 'Cache-Control': 'private, no-store' } });
  }
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
      examples, cleanAgi: cleanNeed(cfg),
      burns: {
        model: studioOn(cfg) && cfg.studioBurnCap > 0 ? cfg.infModelBurnAgi : 0, slot: cfg.infSlotAgi, boost: cfg.infBoostAgi,
        boostHours: BURNS.BOOST_HOURS,
      },
      slots: cfg.infSlots, weeklyPrize: prizesOn(cfg) ? cfg.infWeeklyPrize : 0, likesADay: WEEK.LIKES_A_DAY,
      // (round 4, phase 3) gifts' and invites' numbers (null: switched off)
      ...giftsInfo(cfg),
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
    && !cfg.studioHide?.has(j.id) && j.inf_status !== 'deleted' && j.inf_hidden !== true && j.inf_banned !== true && !cfg.studioHide?.has(j.inf_id);
  if (!shown) return json(404, { error: 'gone' });
  const F = await import('./studio-files.js');
  const priv = j.inf_mode === 'face' || j.inf_real === true;
  const name = `${safeName(j.inf_name, 'AGI-Studio')}-${j.kind === 'body' ? 'full-body' : j.shape === 'banner' ? 'X-banner' : j.meme ? 'meme' : 'photo'}${nth ? `-${nth + 1}` : ''}.jpg`;
  // (round 4, phase 4) an HD or Ultra photo: its full-size copy (marked when it was kept), from a short-lived signed address
  // (too big for an answer of ours: Vercel's are 4.5 MB at most)
  if (j.kind === 'photo' && j.shape !== 'banner' && ['hd', 'ultra'].includes(j.quality)) {
    try {
      const url = await F.signedUrl(cfg, hdPath(m[1], m[2], nth), { expiresIn: 2 * 3600, download: name });
      if (url) return new Response(null, { status: 302, headers: { Location: url, 'Referrer-Policy': 'no-referrer', 'Cache-Control': priv ? 'private, max-age=300' : 'public, max-age=300, s-maxage=1800' } });
    } catch (err) {
      console.warn(`[studio] an HD photo to download: ${err.message}`);
    }
    // (its copy isn't there: the picture shown, marked as it's downloaded, as for any photo)
  }
  let bytes;
  try { bytes = await F.getFile(cfg, picPath(m[1], m[2], nth), { max: 4_000_000 }); } catch (err) {
    console.warn(`[studio] a photo to download: ${err.message}`);
    return json(502, { error: 'storage' });
  }
  if (!bytes) return json(404, { error: 'gone' });
  const { markPhoto } = await import('./inf-mark.js');
  const marked = await markPhoto(await F.loadSharp(), bytes).catch(() => null);
  // (2026-10-12) with our hidden AI tag too (src/studio/ai-tag.js)
  return new Response(aiTagged(marked || bytes), {
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
  // (2026-10-11) its profile picture: a square its maker framed, kept under an id of its own (not a job's), while it's its
  // profile picture and the influencer is shown
  if (!j && m[1] && m[3] === '0') return pfpAnswer(cfg, m[1], jobId, m[4]);
  // (round 4, phase 2: and never a banned maker's: shown to nobody, until a mod lifts its ban)
  const shown = j && j.status === 'done' && j.hidden !== true && !cfg.studioHide?.has(j.id)
    && (j.kind === 'preset' || (j.inf_status !== 'deleted' && j.inf_hidden !== true && j.inf_banned !== true && !cfg.studioHide?.has(j.inf_id)));
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
// (2026-10-11) Its profile picture's files (?inf-file=<influencer>/<its id>-0.jpg | .webp)
async function pfpAnswer(cfg, inf, pid, ext) {
  let shown;
  try { shown = await pfpShown(cfg, inf, pid); } catch (err) { return dbTrouble(err, 'a profile picture'); }
  if (!shown) return json(404, { error: 'gone' });
  let bytes;
  try { bytes = await (await import('./studio-files.js')).getFile(cfg, picPath(inf, pid, 0, ext), { max: 4_000_000 }); } catch (err) {
    console.warn(`[studio] a profile picture: ${err.message}`);
    return json(502, { error: 'storage' });
  }
  if (!bytes) return json(404, { error: 'gone' });
  const cache = shown.private ? 'private, max-age=600' : 'public, max-age=3600, s-maxage=600';
  return new Response(bytes, { status: 200, headers: { ...MEDIA, 'Content-Type': ext === 'jpg' ? 'image/jpeg' : 'image/webp', 'Cache-Control': cache } });
}

// One of its videos: played in parts (its player's "Range"), whole when it's small, or downloaded by a signed address
async function videoAnswer(cfg, request, key, value, who) {
  const m = /^([A-Za-z0-9_-]{22})\.mp4$/.exec(value || '');
  if (!m) return json(400, { error: 'bad_request' });
  if (!infFileBurst(who)) return json(429, { error: 'too_fast' });
  let j;
  try { j = await getJob(cfg, m[1]); } catch (err) { return dbTrouble(err, 'a video'); }
  const shown = j && j.status === 'done' && j.hidden !== true && ['trend', 'video', 'preset'].includes(j.kind) && !cfg.studioHide?.has(j.id)
    && (j.kind === 'preset' || (j.inf_status !== 'deleted' && j.inf_hidden !== true && j.inf_banned !== true && !cfg.studioHide?.has(j.inf_id)));
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
    // (round 2) its download: the copy with the share mark, once the clock has made it (until then, as it was made); (phase 4)
    // a long video's one copy carries the mark already, and (2026-10-12) so does one saved from the video editor (ownMark)
    const from = key === 'inf-video-dl' && j.marked === true && j.kind !== 'preset' && !ownMark(j) ? markedPath(j.inf_id, j.id) : path;
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
    // (2026-10-12, the editor) the video editor's words and stickers, for a cut to start
    if (url.searchParams.has('inf-cut')) {
      const t = readTicket(cfg.passSecret, 'vc', url.searchParams.get('inf-cut'));
      if (!t) return json(401, { error: 'ticket' });
      const { receiveCut } = await import('./inf-cut.js');
      const r = await receiveCut(cfg, t, body);
      return json(r.status, r.body);
    }
    // (2026-10-12, the editor) a photo saved from the photo editor
    if (url.searchParams.has('inf-photo')) {
      const t = readTicket(cfg.passSecret, 'pe', url.searchParams.get('inf-photo'));
      if (!t) return json(401, { error: 'ticket' });
      const { receiveSave } = await import('./inf-editor.js');
      const r = await receiveSave(cfg, t, body);
      return json(r.status, r.body);
    }
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
  // round 4
  banner: 409,
  // round 4, phase 2 (a ban, the team, support tickets, the helper; with codes of their own, since "empty", "too_many" and
  // "busy_day" mean other things above)
  banned: 403, not_staff: 403, ban_protected: 409, ban_already: 409, ban_lifted: 409, too_many_open: 429, secret: 422,
  ticket_topic: 400, ticket_empty: 400, ticket_long: 400, ticket_too_many: 429, ticket_busy_day: 429, ticket_closed: 409,
  help_empty: 400, help_long: 400, help_used: 429, help_busy: 429, ai: 503,
  team_address: 400, team_self: 409, team_role: 400, team_nick: 400, nick_taken: 409, team_full: 409, levels: 400, bad_request: 400,
  // round 4, phase 3 (gifts and invites, with codes of their own, since "short", "gone", "own" and "claimed" mean other things above)
  gifts_off: 409, give_to: 400, give_credits: 400, gift_no_name: 404, gift_self: 409, gift_to_banned: 409, gift_too_many: 429,
  gift_links: 429, gift_day_cap: 429, gift_short: 402, gift_gone: 404, gift_claimed: 409, gift_canceled: 409, gift_expired: 409,
  gift_own: 409, gift_held: 409, gift_state: 409, note_long: 422, note_link: 422, note_contact: 422, note_deal: 422, note_words: 422,
  refs_off: 409, ref_bad: 400, ref_none: 404, ref_self: 409, ref_already: 409, ref_bought: 409, ref_loop: 409,
  // round 4, phase 4 (the model menu, with a model it doesn't offer; Anime for a realistic influencer; reference pictures
  // that can't be used, as not this wallet's, refused, older than a day or too many for its model)
  model: 400, no_anime: 409, refs: 409,
  // (2026-10-11) giving access while AGI Studio is private (the owner's tab)
  access_address: 400, access_self: 409, access_note: 400, access_full: 409, access_gone: 404,
  // (2026-10-11) "Use my photo as it is": only a photo of the whole person, head to feet (its upload check says so)
  not_full: 409,
  // (2026-10-11) a profile picture or a coin's picture: not one of its own pictures (done and shown) any more, or one that
  // couldn't be kept or read from our bucket just now
  picture: 409, storage: 502,
  // (2026-10-12) the owner's gift links (their credits from 1 to 100,000, and too many waiting at once)
  link_credits: 400, links_full: 409,
  // (2026-10-12, the editor) deleting a creation, with codes of their own ("gone" and "making" mean other things above): gone
  // already (or taken down), still being made, or something being made from it
  job_gone: 404, job_making: 409, job_in_use: 409,
  // …and a photo saved from the photo editor can't be made again ("Make another": open the photo it's from instead)
  editor: 409,
  // …and the video editor: its cut isn't one (or doesn't fit the video it's from), the video it's from isn't one of its own done
  // videos any more, or its maker has the most being made at once already
  cut: 400, from: 409, cuts_open: 409,
  // (2026-10-13) "With AGI-1": she's never in a trend video; a photo with her is made by Classic; a Standard, Pro or Long video
  // with her starts from a photo she's in; "Add AGI-1" to a photo she's in already
  agi1_trend: 409, agi1_model: 409, agi1_photo: 409, agi1_has: 409,
  // (2026-10-13, the 3D tool) a 3D model's choice that isn't one; choices with extras for a burn (a burn pays nobody); and its
  // extra downloads (not asked for, still being made, couldn't be made, past their days, or its file gone)
  spec: 400, not_burnable: 409, dl_none: 404, dl_wait: 409, dl_failed: 409, dl_expired: 410, dl_missing: 404,
};
// (2026-10-12) the editor's "no"s for deleting a creation, as the page names them
const JOB_WHY = { gone: 'job_gone', making: 'job_making', in_use: 'job_in_use', bad: 'bad_request' };
// (round 4, phase 2) the team's and support's own "no"s, as the page names them
const TICKET_WHY = { topic: 'ticket_topic', empty: 'ticket_empty', long: 'ticket_long', too_many: 'ticket_too_many', busy_day: 'ticket_busy_day', closed: 'ticket_closed', bad: 'bad_request' };
const TEAM_WHY = { address: 'team_address', self: 'team_self', role: 'team_role', nick: 'team_nick', too_many: 'team_full', bad: 'bad_request' };
const BAN_WHY = { already: 'ban_already', protected: 'ban_protected', done: 'ban_lifted', bad: 'bad_request' };
// (2026-10-11) giving access: the owner's own "no"s, as the page names them
const ACCESS_WHY = { address: 'access_address', self: 'access_self', note: 'access_note', too_many: 'access_full', gone: 'access_gone', bad: 'bad_request' };
const HELP_WHY = { empty: 'help_empty', long: 'help_long', too_many: 'help_used', busy_day: 'help_busy' };
const OWNER_ACTIONS = ['inf-owner', 'trend-make', 'trend-set', 'inf-hide', 'inf-report-clear', 'inf-example-make', 'inf-week-set', 'inf-gift',
  'inf-admin', 'inf-admin-set', 'inf-team-set', 'inf-team-remove', 'inf-access', 'inf-access-set', 'inf-access-remove',
  // (2026-10-12) the owner's gift links of free credits: the list, one made, one taken back
  'inf-owner-links', 'inf-owner-link', 'inf-owner-link-cancel'];
// (round 4, phase 2) the team's: a mod's and support's (and the owner's); a mod may also hide and clear reports (OWNER_ACTIONS)
const MOD_ACTIONS = ['inf-mod', 'mod-ticket', 'mod-ticket-say', 'mod-ticket-close', 'mod-ban', 'mod-unban'];
const SHARED_WITH_MODS = ['inf-hide', 'inf-report-clear'];
// (round 4, phase 2) support tickets, a wallet's own
const TICKET_ACTIONS = ['inf-tickets', 'inf-ticket', 'inf-ticket-open', 'inf-ticket-say', 'inf-ticket-close'];
// (round 4, phase 3) gifts and invites, a wallet's own
const GIFT_ACTIONS = ['inf-gifts', 'inf-send', 'inf-gift-link', 'inf-gift-cancel', 'inf-gift-claim', 'inf-ref-bind'];
// (round 4, phase 2) what a banned wallet may no longer do: make, pick, publish, like, unlock, claim, launch, show its name; and
// (phase 3) give or claim gifts, or join through an invite (taking a gift link of its own back still works); and (2026-10-11)
// change a profile picture
const BANNED_FROM = ['inf-up-open', 'inf-up-done', 'inf-start', 'inf-pick', 'inf-reroll', 'inf-make', 'inf-3d', 'inf-3d-burn', 'inf-3d-check',
  'inf-3d-redo', 'inf-public', 'inf-coin', 'inf-like', 'inf-caption', 'inf-name-set', 'inf-burn-quote', 'inf-burn-check', 'inf-week-claim',
  'inf-send', 'inf-gift-link', 'inf-gift-claim', 'inf-ref-bind', 'inf-pfp',
  // (2026-10-12) "Make another" makes something (deleting its own still works), and so does the photo editor's save, and the
  // video editor's
  'inf-again', 'inf-photo-open', 'inf-cut-open',
  // (2026-10-13) a 3D model's extra downloads (a banned maker's creations are shown to nobody, itself included)
  'inf-3d-dl'];
export const INF_POSTS = ['inf-me', 'inf-look', 'inf-up-open', 'inf-up-done', 'inf-start', 'inf-pick', 'inf-reroll', 'inf-make', 'inf-3d',
  'inf-public', 'inf-pfp', 'inf-delete', 'inf-coin', 'inf-topup', 'inf-report', 'inf-like', 'inf-liked', 'inf-3d-burn', 'inf-3d-check', 'inf-3d-redo',
  'inf-burn-quote', 'inf-burn-check', 'inf-week-claim', 'inf-caption', 'inf-name-set', 'inf-name-clear', 'inf-help', 'inf-gift-peek',
  'inf-again', 'inf-job-delete', 'inf-photo-open', 'inf-cut-open', 'inf-dl', 'inf-3d-dl',
  ...GIFT_ACTIONS, ...TICKET_ACTIONS, ...MOD_ACTIONS, ...OWNER_ACTIONS];

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
  // (round 4, phase 2) the AI helper: anyone (signed in: its wallet's answers a day; signed out: its visitor's, after the
  // human check)
  if (body.action === 'inf-help') return helpAnswer(cfg, body, ip, who, now);
  // (round 4, phase 3) a gift link, as anyone with it sees it (before signing in: what it is, from whom, and whether it can
  // still be claimed)
  if (body.action === 'inf-gift-peek') {
    if (!infLookBurst(who)) return json(429, { error: 'too_fast' });
    const { peekGift } = await import('./inf-gifts.js');
    try {
      const gift = await peekGift(cfg, body.token);
      // (2026-10-12) people's gifts switched off (STUDIO_GIFTS=off): only the owner's own gift links still open
      if (!giftsOn(cfg) && !gift?.owner) return json(200, { gift: null, off: true });
      return json(200, { gift });
    } catch (err) { return dbTrouble(err, 'a gift link'); }
  }
  let w;
  try { w = await walletNow(cfg, body.session, { now }); } catch (err) { return dbTrouble(err, 'reading the wallet'); }
  if (!w) return json(401, { error: 'signed_out', signedOut: true });
  const extra = w.session ? { session: w.session, level: w.level } : { level: w.level };
  const refuse = (r) => json(WHY_STATUS[r.why] || 422, { error: r.why, ...(r.have !== undefined ? { have: r.have } : {}), ...(r.reason ? { reason: r.reason } : {}), ...extra });
  const words = (r, more = {}) => json(422, { error: 'words', field: r.field, why: r.why, ...more, ...extra });
  // (2026-10-13, the 3D tool) a 3D model's choices: one that isn't one (400, with which: field), or its words' "no" (422: its
  // look, or which move described in words, n from 1, and which part of it: its name or what it does) · null
  const choiceNo = (r) => {
    if (r.why === 'spec') return json(400, { error: 'spec', field: r.part || 'spec', ...extra });
    if (r.field) return words(r, { ...(r.n ? { n: r.n } : {}), ...(r.part ? { part: r.part } : {}) });
    return null;
  };
  const asks = ['inf-up-open', 'inf-up-done', 'inf-start', 'inf-make', 'inf-3d', 'inf-coin', 'inf-pfp', 'inf-topup', 'inf-reroll', 'inf-delete', 'trend-make',
    'inf-3d-burn', 'inf-3d-check', 'inf-3d-redo', 'inf-burn-quote', 'inf-burn-check', 'inf-week-claim', 'inf-example-make', 'inf-gift',
    'inf-caption', 'inf-name-set', 'inf-name-clear', 'inf-send', 'inf-gift-link', 'inf-gift-cancel', 'inf-gift-claim', 'inf-ref-bind',
    'inf-again', 'inf-job-delete', 'inf-photo-open', 'inf-cut-open'];
  if (asks.includes(body.action) && !infActBurst(who)) return json(429, { error: 'too_fast', ...extra });
  if (['inf-look', 'inf-like', 'inf-liked', 'inf-tickets', 'inf-ticket', 'inf-mod', 'mod-ticket', 'inf-gifts', 'inf-access', 'inf-owner-links'].includes(body.action) && !infLookBurst(who)) return json(429, { error: 'too_fast', ...extra });
  if (['inf-ticket-open', 'inf-ticket-say', 'inf-ticket-close', 'mod-ticket-say', 'mod-ticket-close', 'mod-ban', 'mod-unban', 'inf-admin',
    'inf-admin-set', 'inf-team-set', 'inf-team-remove', 'inf-access-set', 'inf-access-remove', 'inf-owner-link', 'inf-owner-link-cancel'].includes(body.action) && !infActBurst(who)) return json(429, { error: 'too_fast', ...extra });
  // (2026-10-12) where its maker downloads one of its own creations from: clean for a holder (server/inf-clean.js)
  if (body.action === 'inf-dl') {
    if (!infLookBurst(who)) return json(429, { error: 'too_fast', ...extra });
    try { const r = await downloadFor(cfg, w, body, { now }); return json(r.status, { ...r.body, ...extra }); } catch (err) { return dbTrouble(err, 'a download'); }
  }
  // (round 4, phase 2) a banned wallet makes nothing (supabase/influencers.sql refuses its making too)
  if (BANNED_FROM.includes(body.action)) {
    let t;
    try { t = await whoIs(cfg, w.wallet, { now }); } catch (err) { return dbTrouble(err, 'reading the wallet'); }
    if (t.banned) return json(403, { error: 'banned', ...extra });
  }
  try {
    if (body.action === 'inf-me') return await meAnswer(cfg, w, extra, now);
    if (TICKET_ACTIONS.includes(body.action)) return await tickets(cfg, body, w, extra);
    if (GIFT_ACTIONS.includes(body.action)) return await gifts(cfg, body, w, extra);
    if (MOD_ACTIONS.includes(body.action)) {
      const t = await whoIs(cfg, w.wallet, { now, fresh: true });
      if (!t.role) return json(403, { error: 'not_staff', ...extra });
      return await mod(cfg, body, extra, now, w, t);
    }
    if (body.action === 'inf-look') return await look(cfg, w, id, extra, now);
    if (body.action === 'inf-up-open' || body.action === 'inf-start') {
      if (body.adult !== true) return json(400, { error: 'adult', ...extra });
      const h = await human(cfg, body, ip, who);
      if (!h.ok) return json(401, { error: 'human_check', ...extra });
      const pass = h.pass ? { pass: h.pass } : {};
      if (body.action === 'inf-up-open') {
        const { openUpload } = await import('./inf-uploads.js');
        const { newOrderId } = await import('./studio.js');
        if (!(await canUse(cfg, w.wallet, { now }))) return refuse({ why: 'closed' });
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
      if (!(await canUse(cfg, w.wallet, { now }))) return refuse({ why: 'closed' });   // (private: nothing to spend credits on yet)
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
      // (round 4, phase 2) a mod may take things down and clear reports too
      if (!isOwner(cfg, w.wallet) && !(SHARED_WITH_MODS.includes(body.action) && may(await whoIs(cfg, w.wallet, { now, fresh: true }), 'reports'))) {
        return json(403, { error: 'not_owner', ...extra });
      }
      return await owner(cfg, body, extra, now, w);
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
      if (!(await canUse(cfg, w.wallet, { now }))) return refuse({ why: 'closed' });
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
    // (round 4) captions for a post of one of its own creations, written by AI (free: CAPTIONS_A_DAY a wallet, counted first)
    if (body.action === 'inf-caption') {
      const { writeCaptions } = await import('./inf-captions.js');
      const r = await writeCaptions(cfg, { wallet: w.wallet, job: String(body.job || ''), tone: body.tone, platform: body.platform });
      if (r.ok) return json(200, { ...r, perDay: CAPTIONS_A_DAY, ...extra });
      const status = { bad: 400, gone: 404, not_yours: 403, too_many: 429, busy_day: 429, ai: 503, none: 422 }[r.why] || 503;
      return json(status, { error: r.why, ...(r.left !== undefined ? { left: r.left } : {}), ...extra });
    }
    // (round 4) the clank.trade username it shows ("by @name" on its public influencers), checked against that clank.trade
    // profile's own wallet; and taking it off
    if (body.action === 'inf-name-set') {
      if (!(await canUse(cfg, w.wallet, { now }))) return refuse({ why: 'closed' });
      const { claimClankName } = await import('./clank-names.js');
      const r = await claimClankName(cfg, { wallet: w.wallet, input: body.name });
      if (r.ok) return json(200, { ok: true, clank: { name: r.name, url: clankProfileUrl(r.name) }, ...extra });
      return json({ bad: 400, none: 404, not_yours: 403, clank: 503 }[r.why] || 503, { error: r.why, ...extra });
    }
    if (body.action === 'inf-name-clear') {
      const { clearClankName } = await import('./clank-names.js');
      const r = await clearClankName(cfg, { wallet: w.wallet });
      return r.ok ? json(200, { ok: true, clank: null, ...extra }) : json(503, { error: 'busy', ...extra });
    }
    // (2026-10-12, the editor) "Make another": one of its own photos (a meme, an X banner), videos or trend videos made again
    // with the same words and settings, next to it, at the price of making it now (makeJob's own checks)
    if (body.action === 'inf-again') {
      const r = await againJob(cfg, { wallet: w.wallet, level: w.level, job: String(body.job || '') });
      if (!r.ok) return r.field ? words(r) : refuse(r);
      return json(200, { ...r, ...extra });
    }
    // …and "Delete": one of them, off every page at once and for good (a banned wallet may still delete its own)
    if (body.action === 'inf-job-delete') {
      const r = await deleteJob(cfg, { wallet: w.wallet, job: String(body.job || '') });
      return r.ok ? json(200, { ...r, ...extra }) : refuse({ why: JOB_WHY[r.why] || r.why });
    }
    // …and the photo editor: a ticket to save one of its own photos, edited in its maker's browser, as a new photo (free)
    if (body.action === 'inf-photo-open') {
      const { openSave } = await import('./inf-editor.js');
      const { newOrderId } = await import('./studio.js');
      const r = await openSave(cfg, { wallet: w.wallet, from: String(body.from || ''), shape: body.shape, words: body.words, id: newOrderId() });
      if (!r.ok) return r.field ? words(r) : refuse(r);
      return json(200, { ...r, perDay: EDITOR.PER_DAY, ...extra });
    }
    // …and the video editor: one of its own videos or trend videos, edited in its maker's browser, saved as a new video (free):
    // started at once, or a ticket for its words' and stickers' picture
    if (body.action === 'inf-cut-open') {
      const { openCut } = await import('./inf-cut.js');
      const { newOrderId } = await import('./studio.js');
      const r = await openCut(cfg, { wallet: w.wallet, from: String(body.from || ''), cut: body.cut, words: body.words, layer: body.layer, id: newOrderId() });
      if (!r.ok) return r.field ? words(r) : refuse(r);
      return json(200, { ...r, perDay: VIDEO_EDITOR.PER_DAY, ...extra });
    }
    // (2026-10-13, the 3D tool's "More downloads") a 3D model's extra downloads, its maker's alone: what's ready, or one of them
    if (body.action === 'inf-3d-dl') {
      if (!infLookBurst(who)) return json(429, { error: 'too_fast', ...extra });
      const format = body.format === undefined || body.format === null || body.format === '' ? null : String(body.format);
      const r = await dl3d(cfg, { wallet: w.wallet, order: String(body.order || ''), format, now });
      if (!r.ok) return refuse(r);
      // (its list) and whether its page's pictures and clips come without our watermark for it: its maker holding
      // STUDIO_CLEAN_AGI $AGI, as for its photos and videos (server/inf-clean.js)
      if (format === null) {
        let clean = false;
        try { clean = cleanNeed(cfg) > 0 && await holdsEnough(cfg, w, { now }); } catch { clean = false; }
        return json(200, { ...r, clean, ...extra });
      }
      return json(200, { ...r, ...extra });
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
    // (2026-10-13, the 3D tool) its choices (spec): a choice that isn't one is 400 with which (field), its words' "no" 422
    if (body.action === 'inf-3d') {
      const r = await order3d(cfg, { wallet: w.wallet, level: w.level, id, spec: body.spec ?? null });
      if (r.ok) return json(200, { ...r, ...extra });
      return choiceNo(r) || refuse(r);
    }
    // (round 2) a free 3D model for a big burn: its quote, "Check my burn", and making it again (free) if it couldn't be made;
    // (2026-10-13) with its choices, only ones with nothing extra ('not_burnable')
    if (body.action === 'inf-3d-burn') {
      const r = await order3dBurn(cfg, { wallet: w.wallet, level: w.level, id, spec: body.spec ?? null });
      if (r.ok) return json(200, { ...r, ...extra });
      return choiceNo(r) || refuse(r);
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
    // (2026-10-11) its profile picture: a square framed in one of its own pictures (from: { job, n, x, y, s }), or its picked
    // look again (from: null)
    if (body.action === 'inf-pfp') {
      const r = await setProfile(cfg, { wallet: w.wallet, id, from: body.from });
      return r.ok ? json(200, { ...r, ...extra }) : refuse(r);
    }
    if (body.action === 'inf-delete') {
      const r = await deleteInf(cfg, { wallet: w.wallet, id });
      return r.ok ? json(200, { ok: true, ...extra }) : refuse(r);
    }
    // (since 2026-10-11 with its picture: its profile picture, the default, or a square framed in one of its own pictures)
    if (body.action === 'inf-coin') {
      const r = await coinDraft(cfg, { wallet: w.wallet, id, name: body.name, symbol: body.symbol, description: body.description, picture: body.picture });
      return r.ok ? json(200, { ...r, ...extra }) : refuse(r);
    }
  } catch (err) {
    return dbTrouble(err, body.action);
  }
  return json(400, { error: 'bad_request', ...extra });
}

// (round 4, phase 2) This wallet: me()'s, and its place on the team (the owner, a mod or support: the mod page's link), whether
// it's banned, and its support tickets (how many are open, and the team's answers it hasn't read)
let teamWarned = false;
function teamTrouble(err) {
  if (err?.code !== 'PGRST202' || !teamWarned) console.warn(`[studio] the team and support: ${err?.message}`);
  if (err?.code === 'PGRST202') teamWarned = true;
  return null;
}
async function meAnswer(cfg, w, extra, now) {
  const [m, t, mine] = await Promise.all([
    me(cfg, w), whoIs(cfg, w.wallet, { now }).catch(teamTrouble), ticketsMine(cfg, w.wallet).catch(teamTrouble),
  ]);
  return json(200, {
    ...m, team: t?.role ? { role: t.role, nick: t.nick || (t.role === 'owner' ? OWNER_NICK : null) } : null, banned: t?.banned === true,
    support: mine ? { open: mine.filter((x) => x.status !== 'closed').length, unread: mine.filter((x) => x.unread).length } : null,
    ...extra,
  });
}

// (round 4, phase 2) The AI helper's answer (server/inf-help.js): HELPER.PER_DAY a day for a wallet, or for a visitor who
// isn't signed in (after the human check)
async function helpAnswer(cfg, body, ip, who, now) {
  if (!infActBurst(who)) return json(429, { error: 'too_fast' });
  if (typeof body.question !== 'string' || body.question.length > 2000
      || (body.before !== undefined && (!Array.isArray(body.before) || body.before.length > 5 || body.before.some((b) => typeof b !== 'string' || b.length > 2000)))) {
    return json(400, { error: 'bad_request' });
  }
  const { askHelper, helpQuestion, HELP } = await import('./inf-help.js');
  const q = helpQuestion(body.question);
  if (!q.ok) return json(WHY_STATUS[HELP_WHY[q.why] || q.why] || 400, { error: HELP_WHY[q.why] || q.why });
  let w = null, extra = {};
  if (body.session) {
    try { w = await walletNow(cfg, body.session, { now }); } catch (err) { return dbTrouble(err, 'reading the wallet'); }
    extra = w ? (w.session ? { session: w.session, level: w.level } : { level: w.level }) : { signedOut: true };
  }
  let pass = {};
  if (!w) {
    const h = await human(cfg, body, ip, who);
    if (!h.ok) return json(401, { error: 'human_check', ...extra });
    if (h.pass) pass = { pass: h.pass };
  }
  const code = w ? `w:${studioWallet(cfg.passSecret, w.wallet)}` : `v:${visitorCodeForDay(cfg.passSecret, ip, new Date(now).toISOString().slice(0, 10))}`;
  try {
    const r = await askHelper(cfg, { question: q.text, before: body.before, who: code });
    if (!r.ok) {
      const error = HELP_WHY[r.why] || r.why;
      return json(WHY_STATUS[error] || 503, { error, ...(r.left !== undefined ? { left: r.left } : {}), ...pass, ...extra });
    }
    return json(200, { ...r, perDay: HELP.PER_DAY, ...pass, ...extra });
  } catch (err) { return dbTrouble(err, 'the helper'); }
}

// (round 4, phase 2) A wallet's own support tickets: its list, one ticket (read now), opening one, a message in one, closing one
async function tickets(cfg, body, w, extra) {
  const no = (r) => {
    const error = TICKET_WHY[r.why] || r.why;
    return json(WHY_STATUS[error] || 503, { error, ...extra });
  };
  if (body.action === 'inf-tickets') return json(200, { tickets: await ticketsMine(cfg, w.wallet), ...extra });
  if (body.action === 'inf-ticket-open') {
    const r = await ticketOpen(cfg, { wallet: w.wallet, topic: body.topic, body: body.body });
    if (!r.ok) return no(r);
    const t = await ticketThread(cfg, { id: r.id, wallet: w.wallet });
    return json(200, { ok: true, id: r.id, ticket: t.ok ? t.ticket : null, ...extra });
  }
  const id = typeof body.ticket === 'string' ? body.ticket : '';
  if (!ID.test(id)) return json(400, { error: 'bad_request', ...extra });
  if (body.action === 'inf-ticket-say') {
    const r = await ticketSay(cfg, { id, wallet: w.wallet, body: body.body });
    if (!r.ok) return no(r);
  }
  if (body.action === 'inf-ticket-close') {
    const r = await ticketClose(cfg, { id, wallet: w.wallet });
    if (!r.ok) return no(r);
  }
  const t = await ticketThread(cfg, { id, wallet: w.wallet });
  return t.ok ? json(200, { ok: true, ticket: t.ticket, ...extra }) : no(t);
}

// (round 4, phase 2) The team's page (/studio/mod): its tickets (everyone on the team), and a mod's reports and bans; a ticket
// as the team sees it (who it is: their influencers, credits, and whether they're banned), answering and closing it; a ban
// and lifting it. Who wrote each answer is kept as their nickname (the person sees "AGI Studio support").
async function mod(cfg, body, extra, now, w, t) {
  const by = t.role === 'owner' ? OWNER_NICK : t.nick || 'Team';
  const notStaff = json(403, { error: 'not_staff', ...extra });
  if (body.action === 'inf-mod') {
    const status = ['open', 'answered', 'closed'].includes(body.status) ? body.status : null;
    const { alertsLink } = await import('./inf-admin.js');
    const [list, reports, bans, link] = await Promise.all([
      ticketsStaff(cfg, { status }),
      may(t, 'reports') ? (await import('./influencer.js')).reportsList(cfg) : null,
      may(t, 'bans') ? bansList(cfg) : null,
      alertsLink(cfg, { who: t.role === 'owner' ? 'owner' : studioWallet(cfg.passSecret, w.wallet), now }).catch(() => null),
    ]);
    return json(200, { me: { role: t.role, nick: by }, tickets: list, reports, bans, alerts: { link }, now, ...extra });
  }
  if (body.action === 'mod-ban' || body.action === 'mod-unban') {
    if (!may(t, 'bans')) return notStaff;
    const r = body.action === 'mod-ban'
      ? await banMaker(cfg, { inf: body.inf, reason: body.reason, note: body.note ?? '', by })
      : await unban(cfg, { id: body.ban, by });
    if (!r.ok) {
      const error = BAN_WHY[r.why] || r.why;
      return json(WHY_STATUS[error] || 503, { error, ...extra });
    }
    return json(200, { ...r, bans: await bansList(cfg), ...extra });
  }
  const id = typeof body.ticket === 'string' ? body.ticket : '';
  if (!ID.test(id)) return json(400, { error: 'bad_request', ...extra });
  const no = (r) => {
    const error = TICKET_WHY[r.why] || r.why;
    return json(WHY_STATUS[error] || 503, { error, ...extra });
  };
  if (body.action === 'mod-ticket-say') {
    const r = await ticketSay(cfg, { id, by, body: body.body });
    if (!r.ok) return no(r);
  }
  if (body.action === 'mod-ticket-close') {
    const r = await ticketClose(cfg, { id });
    if (!r.ok) return no(r);
  }
  const th = await ticketThread(cfg, { id, staff: true });
  return th.ok ? json(200, { ok: true, ticket: th.ticket, ...extra }) : no(th);
}

// (round 4, phase 3) Gifts of bought credits, and invites: a wallet's own (server/inf-gifts.js). Every answer that moved
// credits carries the wallet's credits now (the page's credits pill follows them).
async function gifts(cfg, body, w, extra) {
  const G = await import('./inf-gifts.js');
  const { creditsOf } = await import('./credits.js');
  const code = studioWallet(cfg.passSecret, w.wallet);
  const no = (r) => json(WHY_STATUS[r.why] || 503, {
    error: r.why, ...(r.left !== undefined ? { left: r.left } : {}), ...(r.paid !== undefined ? { paid: r.paid } : {}),
    ...(r.mine !== undefined ? { mine: r.mine } : {}), ...(r.status ? { status: r.status } : {}), ...extra,
  });
  if (body.action === 'inf-gifts') {
    const [mine, invite, credits] = await Promise.all([
      G.myGifts(cfg, w.wallet), refsOn(cfg) ? G.inviteOf(cfg, w.wallet) : null, creditsOf(cfg, code),
    ]);
    return json(200, { ...mine, invite, credits, ...extra });
  }
  if (body.action === 'inf-ref-bind') {
    const r = await G.bindInvite(cfg, { wallet: w.wallet, code: body.code });
    return r.ok ? json(200, { ok: true, ...extra }) : no(r);
  }
  if (body.action === 'inf-gift-claim') {
    const r = await G.claimGift(cfg, { wallet: w.wallet, token: body.token });
    if (!r.ok) return no(r);
    // (2026-10-12) one of the owner's gift links lets its claimer in while AGI Studio is private (on the owner's list, as
    // "claimed your gift link"): its credits are to use here
    let letIn = false;
    if (r.owner && !(await canUse(cfg, w.wallet))) {
      try { letIn = (await accessSet(cfg, { address: w.wallet, via: 'link' })).ok === true; } catch (err) {
        console.warn(`[studio] letting a gift link's claimer in: ${err?.message}`);
      }
    }
    return json(200, { ok: true, got: r.credits, from: r.from, owner: r.owner, letIn, credits: await creditsOf(cfg, code), ...extra });
  }
  if (body.action === 'inf-gift-cancel') {
    const r = await G.cancelGift(cfg, { wallet: w.wallet, id: body.gift });
    return r.ok ? json(200, { ok: true, status: r.status, credits: await creditsOf(cfg, code), ...extra }) : no(r);
  }
  // giving: while AGI Studio is private, only its wallets (nothing to spend credits on yet for anyone else)
  if (!(await canUse(cfg, w.wallet))) return json(WHY_STATUS.closed, { error: 'closed', ...extra });
  if (body.action === 'inf-send') {
    const r = await G.sendGift(cfg, { wallet: w.wallet, to: body.to, credits: body.credits, note: body.note });
    return r.ok ? json(200, { ok: true, id: r.id, to: r.to, gave: r.credits, credits: await creditsOf(cfg, code), ...extra }) : no(r);
  }
  const r = await G.makeGiftLink(cfg, { wallet: w.wallet, credits: body.credits, note: body.note });
  return r.ok ? json(200, { ok: true, id: r.id, token: r.token, expires: r.expires, gave: r.credits, credits: await creditsOf(cfg, code), ...extra }) : no(r);
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
  // (round 4) a 3D model being made: its own step's percentage (the 3D service's), for its progress bar
  if (Number.isFinite(moved?.progress) && moved.step) out.progress = { id: moved.what, step: moved.step, at: Math.max(0, Math.min(100, moved.progress)) };
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
  // (round 4) our server's clock: the page's progress bars count from it (a device's clock can be off)
  return json(200, { ...out, now, ...extra });
}

// (2026-10-11) who may use AGI Studio, for the owner's tab: whether it's open to everyone, the wallets the owner let in, and how
// many more are in without the list (STUDIO_ONLY_FOR's in Vercel, besides the owner's own; the team)
async function accessPage(cfg) {
  const [list, team] = await Promise.all([accessList(cfg), teamList(cfg)]);
  const owner = cfg.studioOwner || '';
  const vercel = [...(cfg.studioOnlyFor || [])].filter((a) => a !== owner).map((a) => `${a.slice(0, 6)}…${a.slice(-4)}`);
  return { open: cfg.studioOpen === true, list, max: ACCESS.MAX, noteMax: ACCESS.NOTE_MAX, vercel, team: team.length };
}

// The owner's tools
async function owner(cfg, body, extra, now, w) {
  // (round 4, phase 2) the owner's tab: the numbers, the AI services' balances and their alert levels, the alerts link, the team
  if (['inf-admin', 'inf-admin-set'].includes(body.action)) {
    const A = await import('./inf-admin.js');
    if (body.action === 'inf-admin') return json(200, { ...await A.adminPage(cfg, { now, fresh: body.fresh === true }), now, ...extra });
    const r = await A.setThresholds(cfg, body.thresholds);
    return r.ok ? json(200, { ...r, ...extra }) : json(r.why === 'bad' ? 400 : 503, { error: r.why === 'bad' ? 'levels' : 'busy', ...extra });
  }
  if (body.action === 'inf-team-set' || body.action === 'inf-team-remove') {
    const r = body.action === 'inf-team-set'
      ? await teamSet(cfg, { address: body.address, role: body.role, nick: body.nick })
      : await teamRemove(cfg, { code: body.code });
    if (!r.ok) {
      const error = TEAM_WHY[r.why] || r.why;
      return json(WHY_STATUS[error] || 503, { error, ...extra });
    }
    return json(200, { ...r, team: await teamList(cfg), ...extra });
  }
  // (round 3) credits for testing: free, to the owner's own wallet ('me') or a tester's (its address). Since 2026-10-11 a
  // tester's wallet is let in too while AGI Studio is private (the owner's access list, as "credits for testing"), and whether
  // it may use them now comes back with it, for the page to say (no: its list was full, or influencers.sql is older).
  if (body.action === 'inf-gift') {
    const self = body.to === 'me';
    const { giftCredits, creditsOf } = await import('./credits.js');
    const { newOrderId } = await import('./studio.js');
    const to = self ? w.wallet : typeof body.to === 'string' ? body.to.trim() : '';
    const r = await giftCredits(cfg, { to, credits: body.credits, ref: newOrderId() });
    if (!r.ok) return ['credits', 'to'].includes(r.why) ? json(400, { error: `gift_${r.why}`, ...extra }) : json(503, { error: 'busy', ...extra });
    const address = to.toLowerCase();
    let allowed = await canUse(cfg, address, { now }), letIn = false;
    if (!allowed) {
      try {
        const a = await accessSet(cfg, { address, via: 'credits' });
        if (a.ok) { allowed = true; letIn = true; }
      } catch (err) { console.warn(`[studio] letting a tester's wallet in: ${err?.message}`); }
    }
    return json(200, {
      ok: true, gave: body.credits, self, to: address, allowed, letIn,
      ...(self ? { credits: await creditsOf(cfg, studioWallet(cfg.passSecret, address)) } : {}), ...extra,
    });
  }
  // (2026-10-12) the owner's gift links of free credits (the owner: "i can put the a custome value of credits there then i can
  // sent a message then theres gonna be a link for it then when i sahre it to someone they can see the meesage and the gifted
  // credits and they can claim it"): the owner's list, one made (any number of credits, the owner's message), one taken back.
  // Each answer brings the list again.
  if (['inf-owner-links', 'inf-owner-link', 'inf-owner-link-cancel'].includes(body.action)) {
    const G = await import('./inf-gifts.js');
    if (body.action === 'inf-owner-link') {
      const r = await G.makeOwnerLink(cfg, { wallet: w.wallet, credits: body.credits, note: body.note });
      if (!r.ok) return json(WHY_STATUS[r.why] || 503, { error: r.why, ...extra });
      return json(200, { ok: true, id: r.id, token: r.token, expires: r.expires, gave: r.credits, note: r.note, ...await G.ownerLinks(cfg, w.wallet), ...extra });
    }
    if (body.action === 'inf-owner-link-cancel') {
      const r = await G.cancelGift(cfg, { wallet: w.wallet, id: body.gift });
      if (!r.ok) return json(WHY_STATUS[r.why] || 503, { error: r.why, ...(r.status ? { status: r.status } : {}), ...extra });
      return json(200, { ok: true, status: r.status, ...await G.ownerLinks(cfg, w.wallet), ...extra });
    }
    return json(200, { ...await G.ownerLinks(cfg, w.wallet), ...extra });
  }
  // (2026-10-11, the owner: "i want to give access to someone but it said to them comins soon fix that please") who may use
  // AGI Studio while it's private: the list the owner manages (a wallet let in by its address, with a note only the owner
  // sees), and who else is in without it (the owner, STUDIO_ONLY_FOR's in Vercel, the team)
  if (['inf-access', 'inf-access-set', 'inf-access-remove'].includes(body.action)) {
    if (body.action === 'inf-access-set' || body.action === 'inf-access-remove') {
      const r = body.action === 'inf-access-set'
        ? await accessSet(cfg, { address: body.address, note: body.note })
        : await accessRemove(cfg, { code: body.code });
      if (!r.ok) {
        const error = ACCESS_WHY[r.why] || r.why;
        return json(WHY_STATUS[error] || 503, { error, ...extra });
      }
      return json(200, { ok: true, ...(r.entry ? { entry: r.entry, added: r.added } : {}), ...await accessPage(cfg), ...extra });
    }
    return json(200, { ...await accessPage(cfg), ...extra });
  }
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
    return json(200, { ...page, posters, now, ...extra });
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
