// AGI Studio (2026-10-10): the AI jobs behind an influencer (its looks, its full body, its photos, its trend and scene videos;
// and the owner's trend clips and, since round 2, example pictures for the design choices), moved along one step at a time
// like the studio's characters (server/studio.js) and videos
// (server/studio-video.js): by its page while it's open, and by the studio's clock every minute (supabase/studio.sql's
// Supabase Cron → /api/feed?studio), never two at once (a lease). Each job:
//   1. sent to the AI service (server/inf-ai.js jobRequest: fal.ai's queue), with short-lived signed addresses of what it's
//      made from (its upload, its picked look, its full body, one of its photos, a clip, a trend clip), never public ones;
//   2. asked about while it's made (its place in the queue, then made or not);
//   3. its pictures (a JPEG at most 1536 px and a small WebP for the pages) or its video (looked at by Gemini first: a video
//      that isn't family-friendly is never shown, and its credits come back) kept in the studio's private bucket.
// A job the service can't make is sent again twice, then given up: its credits come back (supabase/influencers.sql
// inf_job_fail). fal's key, its balance or its queue for a moment never fails a job: it waits (the log tells the owner once).
// (Round 4, phase 4: the model menu) a photo with its model and quality (an HD or Ultra one also keeps its full-size picture
// with the share mark, for its download), its reference pictures (the person's own uploads, signed like the rest), a meme
// (a photo the AI wrote its words into, looked at by Gemini first), and a long video, made in parts: each part sent to the
// AI service from the last frame of the one before (the first from one of its photos), kept by the clock only (it's encoded
// again with the share mark: ffmpeg ships only with /api/feed), then all of them joined into one video (its one copy, played
// and downloaded, carries the mark).
import { createHmac } from 'node:crypto';
import { rpc } from './limits.js';
import { falSubmit, falStatus, falOutput, refusedText } from './fal.js';
import { jobRequest, outputOf, checkVideo, checkMeme } from './inf-ai.js';
import { mp4Info } from './mp4.js';
import { CLIP, BANNER } from '../src/studio/rules.js';

// On once fal's key is set (its looks, photos and videos), with the site's database, secrets and Gemini key (its checks)
export const infOn = (cfg) => Boolean(cfg.falKey && cfg.supabaseUrl && cfg.supabaseKey && cfg.passSecret.length >= 32 && cfg.geminiKey);

export const JOBS = {
  LEASE_S: 45,
  SAVE_LEASE_S: 120,
  TRIES: 2,                       // a request the AI service gave up on is sent again this many times
  SAVE_TRIES: 4,                  // keeping its files
  MAX_MAKING_MS: 12 * 3600e3,     // a job not made in 12 hours is given up (its credits come back)
};
const SAVE_NEEDS_MS = 15_000;
const IMAGE_MAX = 25_000_000;     // the most read for one picture the AI made
const HD_IMAGE_MAX = 64_000_000;  // (phase 4) an HD or Ultra one (Crisp's 4K can be a big PNG)
// (phase 4) a long video's part kept, and its parts joined: the clock's time they need (server/inf-mark.js PART)
const PART_NEEDS_MS = 14_000, JOIN_NEEDS_MS = 12_000, PART_MAX = 40_000_000;
const MAX_PIXELS = 40_000_000;
const FAL_WAIT = new Set(['key', 'credits', 'busy', 'fal']);
const ID = /^[A-Za-z0-9_-]{22}$/;

// ---------- its files' names in the bucket (server/studio-files.js NAME) ----------
export const picPath = (inf, job, n = 0, ext = 'jpg') => `inf/${inf}/${job}-${n}.${ext}`;
export const videoPath = (j) => (j.kind === 'preset' ? `trends/${j.id}.mp4` : `inf/${j.inf_id}/${j.id}.mp4`);
export const posterPath = (j) => (j.kind === 'preset' ? `trends/${j.id}.poster.webp` : `inf/${j.inf_id}/${j.id}.poster.webp`);
// (round 2) an example picture (384 px, for the design choices' chips), and a video's copy with the share mark (its download)
export const examplePath = (job) => `examples/${job}.webp`;
export const markedPath = (inf, job) => `inf/${inf}/${job}.dl.mp4`;
// (round 4, phase 4) an HD or Ultra photo's full-size picture with the share mark (its download), a long video's part (encoded
// with the mark) and the last frame of a part (the next one starts from it): the parts and frames go once they're joined
export const hdPath = (inf, job, n = 0) => `inf/${inf}/${job}-${n}.hd.jpg`;
export const partPath = (inf, job, n) => `inf/${inf}/${job}.p${n}.mp4`;
export const framePath = (inf, job, n) => `inf/${inf}/${job}.f${n}.jpg`;
export const isLong = (j) => j?.kind === 'video' && j.model === 'long' && Number(j.parts) > 1;
const OWNERS = new Set(['preset', 'example']);           // the owner's jobs: no influencer

// ---------- the database ----------
export const getJob = async (cfg, id) => (ID.test(String(id)) ? rpc(cfg, 'inf_job_get', { p_id: id }, 'studio') : null);
const fail = (cfg, id, error, refund = true) => rpc(cfg, 'inf_job_fail', { p_id: id, p_error: error, p_refund: refund }, 'studio');
const setStep = (cfg, id, { req = null, statusUrl = null, resultUrl = null, saving = false, tries = 0 }) =>
  rpc(cfg, 'inf_job_step', { p_id: id, p_req: req, p_status_url: statusUrl, p_result_url: resultUrl, p_saving: saving, p_tries: tries }, 'studio');
const waitTurn = (cfg, id) => rpc(cfg, 'inf_job_wait', { p_id: id }, 'studio');
export const stepOf = (j) => (j.saving ? 'save' : j.req ? 'make' : 'queue');
// the id the reference-to-video model gets for who asked (it asks for one): never the wallet, nor its code here
const falUser = (cfg, code) => createHmac('sha256', String(cfg.passSecret)).update(`fal-user:${code}`).digest('base64url').slice(0, 24);
const warned = new Set();
function warnOnce(what, message) {
  if (warned.has(what)) return;
  warned.add(what);
  console.error(`[studio] ${message}`);
}

// Signed addresses (6 hours) of what a job is made from. → { source, look, body, image, clip, trend } (the ones it needs)
async function inputsOf(cfg, F, j) {
  const sign = (name) => F.signedUrl(cfg, name, { expiresIn: 6 * 3600 });
  const urls = {};
  if (j.kind === 'looks' && j.inf_mode !== 'design' && j.inf_source) urls.source = await sign(`up/${j.inf_source}.jpg`);
  if (j.kind === 'body') {
    urls.look = await sign(picPath(j.inf_id, j.inf_looks_job, j.pick));
    // a photo of a real person (round 2; a selfie before it): its face, kept exactly
    if ((j.inf_mode === 'face' || j.inf_real === true) && j.inf_source) urls.source = await sign(`up/${j.inf_source}.jpg`);
  }
  // (round 2) a trend video: its picked look is its face in the clip
  if (j.kind === 'trend' && j.inf_looks_job && Number.isInteger(j.inf_pick)) urls.look = await sign(picPath(j.inf_id, j.inf_looks_job, j.inf_pick));
  if (['photo', 'trend', 'video'].includes(j.kind) && j.inf_body_job) urls.body = await sign(picPath(j.inf_id, j.inf_body_job, 0));
  if (j.image) urls.image = await sign(picPath(j.inf_id, j.image, 0));
  if (j.kind === 'trend' && j.clip) urls.clip = await sign(`up/${j.clip}.mp4`);
  if (j.kind === 'trend' && !j.clip && j.trend_job) urls.trend = await sign(`trends/${j.trend_job}.mp4`);
  // (round 4, phase 4) its reference pictures; a video's character as Kling's element (its picked look) when it has
  // references or is a long one; a long video's part after the first starts from the one before's last frame
  const refs = Array.isArray(j.refs) ? j.refs.filter((r) => ID.test(String(r))) : [];
  if (refs.length) urls.refs = await Promise.all(refs.map((r) => sign(`up/${r}.jpg`)));
  if (j.kind === 'video' && (refs.length || isLong(j)) && j.inf_looks_job && Number.isInteger(j.inf_pick)) urls.look = await sign(picPath(j.inf_id, j.inf_looks_job, j.inf_pick));
  if (isLong(j) && Number(j.part) > 0) urls.frame = await sign(framePath(j.inf_id, j.id, Number(j.part) - 1));
  return urls;
}

// A picture the AI made → { jpg (at most 1536 px), webp (384 px, for the pages) }, or null when it isn't one. (Round 4) an X
// banner → exactly X's header size (1500 × 500, its right three quarters: the character is two thirds across), and a 768 px
// wide one for the pages. (Phase 4) an HD or Ultra photo (hd: true) → also its full-size picture with the share mark (hd:
// its download, a JPEG at quality 90)
export async function picturesOf(sharp, bytes, { banner = false, hd = false } = {}) {
  const meta = await sharp(bytes, { limitInputPixels: MAX_PIXELS }).metadata().catch(() => null);
  if (!meta || !meta.width || !meta.height || !['jpeg', 'png', 'webp'].includes(meta.format)) return null;
  const base = () => sharp(bytes, { limitInputPixels: MAX_PIXELS }).rotate();
  if (banner) {
    const cut = () => base().resize(BANNER.W, BANNER.H, { fit: 'cover', position: 'right' }).flatten({ background: '#ffffff' });
    const [jpg, webp] = await Promise.all([
      cut().jpeg({ quality: 90 }).toBuffer(),
      cut().resize(768, 256).webp({ quality: 80 }).toBuffer(),
    ]);
    return { jpg, webp };
  }
  const [jpg, webp, full] = await Promise.all([
    base().resize(1536, 1536, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 88 }).toBuffer(),
    base().resize(384, 384, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
    hd ? base().flatten({ background: '#ffffff' }).jpeg({ quality: 92 }).toBuffer() : null,
  ]);
  if (!hd) return { jpg, webp };
  const { markPhoto } = await import('./inf-mark.js');
  const marked = await markPhoto(sharp, full);
  return marked ? { jpg, webp, hd: marked } : null;
}

// One job moved along, if it's its turn. → { state: 'busy' | 'waiting' | 'started' | 'saving' | 'done' | 'failed', step?,
// position? (its place in the AI service's queue), part? (a long video's) }. encode: this is the clock (/api/feed: ffmpeg is
// here), which keeps a long video's parts and joins them; anywhere else (its page) they wait for it. run: a stand-in ffmpeg
// (the tests).
export async function jobTick(cfg, id, { now = Date.now(), deadline = Date.now() + 20_000, files = null, encode = false, run = null } = {}) {
  if (!await rpc(cfg, 'inf_job_lease', { p_id: id, p_secs: JOBS.LEASE_S }, 'studio')) return { state: 'busy' };
  let j;
  try { j = await getJob(cfg, id); } catch (err) { await waitTurn(cfg, id).catch(() => {}); throw err; }
  if (!j || !['paid', 'making'].includes(j.status)) return { state: 'busy' };
  // its influencer is still there (not deleted, not taken down, its maker not banned: round 4, phase 2): else it isn't made
  // (its credits come back)
  if (!OWNERS.has(j.kind) && (!j.inf_id || j.inf_status === 'deleted' || j.inf_hidden === true || j.inf_banned === true || cfg.studioHide?.has(j.inf_id))) {
    await fail(cfg, id, 'gone', true);
    return { state: 'failed', step: stepOf(j) };
  }
  const F = files || await import('./studio-files.js');
  const submit = async (tries) => {
    let urls;
    try { urls = await inputsOf(cfg, F, j); } catch (err) {
      console.warn(`[studio] job ${id}: what it's made from couldn't be signed (${err.message})`);
      await waitTurn(cfg, id);
      return { state: 'waiting', step: 'queue' };
    }
    let req;
    try { req = jobRequest(cfg, j, urls, { user: falUser(cfg, j.wallet_code || 'owner') }); } catch (err) {
      await fail(cfg, id, 'source', true);
      console.warn(`[studio] job ${id} (${j.kind}) can't be made: ${err.message}`);
      return { state: 'failed', step: 'queue' };
    }
    try {
      const r = await falSubmit(cfg, req.model, req.input);
      await setStep(cfg, id, { req: r.req, statusUrl: r.statusUrl, resultUrl: r.resultUrl, saving: false, tries });
      return { state: 'started', step: 'make' };
    } catch (err) {
      if (FAL_WAIT.has(err.why)) {
        if (err.why === 'key' || err.why === 'credits') warnOnce(err.why, `an influencer's job waits: ${err.message}`);
        await waitTurn(cfg, id);
        return { state: 'waiting', step: 'queue' };
      }
      await fail(cfg, id, err.why === 'refused' ? 'refused' : `ai:${j.kind}`, true);
      console.warn(`[studio] job ${id} (${j.kind}) couldn't be sent to the AI service: ${err.message}`);
      return { state: 'failed', step: 'queue' };
    }
  };
  const long = isLong(j);
  const expired = () => Date.parse(j.started_at || j.created_at) < now - JOBS.MAX_MAKING_MS;
  // (phase 4) a long video whose parts are all made: joined, by the clock only
  if (long && Number(j.part) >= Number(j.parts)) {
    if (expired()) { await fail(cfg, id, 'expired', true); return { state: 'failed', step: 'join' }; }
    if (!encode || deadline - Date.now() < JOIN_NEEDS_MS) { await waitTurn(cfg, id); return { state: 'saving', step: 'join' }; }
    return join(cfg, j, F, { deadline, run });
  }
  if (j.status === 'paid' || !j.req) return submit(Number(j.tries) || 0);
  if (expired()) {
    await fail(cfg, id, 'expired', true);
    return { state: 'failed', step: stepOf(j) };
  }
  const needs = long ? PART_NEEDS_MS : SAVE_NEEDS_MS;
  if (j.saving) {
    if ((long && !encode) || deadline - Date.now() < needs) { await waitTurn(cfg, id); return { state: 'saving', step: 'save', ...(long ? { part: Number(j.part) } : {}) }; }
    return long ? savePart(cfg, j, F, { deadline, run }) : save(cfg, j, F, { deadline });
  }
  let s;
  try { s = await falStatus(cfg, j.status_url); } catch (err) {
    if (err.why === 'key' || err.why === 'credits') warnOnce(err.why, `an influencer's job waits: ${err.message}`);
    await waitTurn(cfg, id);
    return { state: 'waiting', step: 'make' };
  }
  if (s.status === 'IN_QUEUE' || s.status === 'IN_PROGRESS') {
    await waitTurn(cfg, id);
    return { state: 'waiting', step: s.status === 'IN_QUEUE' ? 'queue' : 'make', ...(s.status === 'IN_QUEUE' && s.position !== null ? { position: s.position } : {}) };
  }
  if (s.error || s.errorType) {
    if (refusedText(s.error) || refusedText(s.errorType)) {
      await fail(cfg, id, 'refused', true);
      return { state: 'failed', step: 'make' };
    }
    const tries = Number(j.tries) || 0;
    if (tries < JOBS.TRIES) {
      console.warn(`[studio] job ${id} (${j.kind}) failed at the AI service (${s.errorType || s.error}): sending it again`);
      return submit(tries + 1);
    }
    await fail(cfg, id, `ai:${j.kind}`, true);
    console.warn(`[studio] job ${id} (${j.kind}) failed at the AI service ${tries + 1} times (${s.errorType || s.error}): given up`);
    return { state: 'failed', step: 'make' };
  }
  await setStep(cfg, id, { req: j.req, statusUrl: j.status_url, resultUrl: j.result_url, saving: true, tries: 0 });
  if ((long && !encode) || deadline - Date.now() < needs) return { state: 'saving', step: 'save' };
  if (!await rpc(cfg, 'inf_job_lease', { p_id: id, p_secs: JOBS.SAVE_LEASE_S }, 'studio')) return { state: 'saving', step: 'save' };
  return long ? savePart(cfg, { ...j, saving: true, tries: 0 }, F, { deadline, run }) : save(cfg, { ...j, saving: true, tries: 0 }, F, { deadline });
}

// Keeping what it made. Every wait fits in the time left; a save that runs out of time is a try.
async function save(cfg, j, F, { deadline }) {
  const id = j.id;
  const left = (reserve, most) => Math.max(1500, Math.min(most, deadline - Date.now() - reserve));
  try {
    const out = outputOf(j.kind, await falOutput(cfg, j.result_url, { timeoutMs: left(12_000, 6000) }));
    if (out.images) {
      // (phase 4) an HD or Ultra photo keeps its full-size picture too (with the share mark: its download)
      const hd = j.kind === 'photo' && j.shape !== 'banner' && ['hd', 'ultra'].includes(j.quality);
      const sources = await Promise.all(out.images.map((u) => F.fromFal(u, { max: hd ? HD_IMAGE_MAX : IMAGE_MAX, timeoutMs: left(8000, 10_000) })));
      const sharp = await F.loadSharp();
      const made = await Promise.all(sources.map((b) => picturesOf(sharp, b, { banner: j.kind === 'photo' && j.shape === 'banner', hd })));
      if (made.some((m) => !m)) throw new Error("files: a picture the AI made isn't one");
      // (phase 4) a meme: looked at by Gemini before anyone sees it (its words were checked already; the AI may write others)
      if (j.kind === 'photo' && j.meme) {
        const v = await checkMeme(cfg, made[0].jpg, j.caption);
        if (!v.ok) {
          await fail(cfg, id, 'refused', true);
          console.warn(`[studio] job ${id}'s meme wasn't family-friendly (${v.why}): not shown, its credits back`);
          return { state: 'failed', step: 'save' };
        }
      }
      if (deadline - Date.now() < 2500) throw new Error('no time left to keep them');
      const t = left(1000, 9000);
      if (j.kind === 'example') {
        await F.putFile(cfg, examplePath(id), made[0].webp, 'image/webp', { timeoutMs: t });
        await rpc(cfg, 'inf_job_done', { p_id: id, p_files: 1, p_bytes: made[0].webp.length }, 'studio');
        return { state: 'done', step: 'save' };
      }
      await Promise.all(made.flatMap((m, n) => [
        F.putFile(cfg, picPath(j.inf_id, id, n), m.jpg, 'image/jpeg', { timeoutMs: t }),
        F.putFile(cfg, picPath(j.inf_id, id, n, 'webp'), m.webp, 'image/webp', { timeoutMs: t }),
        ...(m.hd ? [F.putFile(cfg, hdPath(j.inf_id, id, n), m.hd, 'image/jpeg', { timeoutMs: t })] : []),
      ]));
      await rpc(cfg, 'inf_job_done', { p_id: id, p_files: made.length, p_bytes: made.reduce((a, m) => a + m.jpg.length, 0) }, 'studio');
      // its full body is made: the picture or selfie it was made from isn't needed any more (its row goes with the tidy-up)
      if (j.kind === 'body' && j.inf_source) {
        F.deleteFiles(cfg, [`up/${j.inf_source}.jpg`]).catch((err) => console.warn(`[studio] an influencer's source picture: ${err.message}`));
      }
      return { state: 'done', step: 'save' };
    }
    const bytes = await F.fromFal(out.video, { timeoutMs: left(7000, 14_000) });
    if (!F.isMp4(bytes)) throw new Error("files: its video isn't an MP4");
    if (j.kind === 'preset') {
      // (round 2) a trend clip people's influencers are put into: the video model that does it takes 720 to 2160 px a side
      const v = mp4Info(bytes);
      if (v?.width && v?.height && (Math.min(v.width, v.height) < CLIP.MIN_PX || Math.max(v.width, v.height) > CLIP.MAX_PX)) {
        await fail(cfg, id, 'small', false);
        console.warn(`[studio] trend clip ${id} came out ${v.width}×${v.height}: trend videos need 720 to 2160 px a side (make it again)`);
        return { state: 'failed', step: 'save' };
      }
    } else {
      const v = await checkVideo(cfg, bytes);
      if (!v.ok) {
        await fail(cfg, id, 'refused', true);
        console.warn(`[studio] job ${id}'s video wasn't family-friendly (${v.why}): not shown, its credits back`);
        return { state: 'failed', step: 'save' };
      }
      if (!v.checked) console.warn(`[studio] job ${id}'s video is too big to look at (${(bytes.length / 1e6).toFixed(1)} MB): kept as it is`);
    }
    if (deadline - Date.now() < 2500) throw new Error('no time left to keep it');
    await F.putFile(cfg, videoPath(j), bytes, 'video/mp4', { timeoutMs: left(1000, 12_000) });
    await rpc(cfg, 'inf_job_done', { p_id: id, p_files: 0, p_bytes: bytes.length }, 'studio');
    console.log(`[studio] job ${id} (${j.kind}) is done: ${(bytes.length / 1e6).toFixed(2)} MB`);
    return { state: 'done', step: 'save' };
  } catch (err) {
    if (err.why === 'refused' || err.why === 'nothing') {
      await fail(cfg, id, err.why === 'refused' ? 'refused' : `ai:${j.kind}`, true);
      console.warn(`[studio] job ${id}: ${err.message}`);
      return { state: 'failed', step: 'save' };
    }
    if (FAL_WAIT.has(err.why)) {
      if (err.why === 'key' || err.why === 'credits') warnOnce(err.why, `an influencer's job waits: ${err.message}`);
      await waitTurn(cfg, id);
      return { state: 'saving', step: 'save' };
    }
    const tries = Number(j.tries) || 0;
    if (err.tooBig || err.gone || tries + 1 >= JOBS.SAVE_TRIES) {
      await fail(cfg, id, err.tooBig ? 'too_big' : err.why === 'ai' ? 'check' : 'save', true);
      console.warn(`[studio] job ${id}'s files couldn't be kept: ${err.message}`);
      return { state: 'failed', step: 'save' };
    }
    console.warn(`[studio] job ${id}'s files: ${err.message} (trying again)`);
    await setStep(cfg, id, { req: j.req, statusUrl: j.status_url, resultUrl: j.result_url, saving: true, tries: tries + 1 });
    return { state: 'saving', step: 'save' };
  }
}

// (Phase 4) a long video's part, kept by the clock: Gemini looks at it (as it was made) while ffmpeg encodes it again with the
// share mark and takes its last frame; then on to the next part (inf_job_part), or, after its last part, to the join. A part
// that isn't family-friendly ends it (its credits back); one ffmpeg can't do is a try (4 at most, like keeping any file).
async function savePart(cfg, j, F, { deadline, run }) {
  const id = j.id, part = Number(j.part) || 0, parts = Number(j.parts);
  const left = (reserve, most) => Math.max(1500, Math.min(most, deadline - Date.now() - reserve));
  try {
    const out = outputOf('video', await falOutput(cfg, j.result_url, { timeoutMs: left(12_000, 5000) }));
    const raw = await F.fromFal(out.video, { max: PART_MAX, timeoutMs: left(10_000, 9000) });
    if (!F.isMp4(raw)) throw new Error("files: its part isn't an MP4");
    const sharp = await F.loadSharp();
    const { encodePart } = await import('./inf-mark.js');
    const last = part >= parts - 1;
    const [v, enc] = await Promise.all([
      checkVideo(cfg, raw),
      encodePart(sharp, raw, { shape: j.shape, last, timeoutMs: left(3000, 12_000), run }),
    ]);
    let verdict = v;
    if (verdict.ok && !verdict.checked) verdict = await checkVideo(cfg, enc.video);   // too big as made: its smaller copy
    if (!verdict.ok) {
      await fail(cfg, id, 'refused', true);
      console.warn(`[studio] job ${id}'s part ${part + 1} wasn't family-friendly (${verdict.why}): not shown, its credits back`);
      return { state: 'failed', step: 'save', part };
    }
    if (deadline - Date.now() < 2000) throw new Error('no time left to keep it');
    const t = left(500, 8000);
    await Promise.all([
      F.putFile(cfg, partPath(j.inf_id, id, part), enc.video, 'video/mp4', { timeoutMs: t }),
      ...(enc.frame ? [F.putFile(cfg, framePath(j.inf_id, id, part), enc.frame, 'image/jpeg', { timeoutMs: t })] : []),
    ]);
    await rpc(cfg, 'inf_job_part', { p_id: id, p_part: part + 1 }, 'studio');
    console.log(`[studio] job ${id}: part ${part + 1} of ${parts} kept (${(enc.video.length / 1e6).toFixed(2)} MB, encoded in ${enc.ms} ms)`);
    return { state: 'started', step: last ? 'join' : 'queue', part: part + 1 };
  } catch (err) {
    return saveFailed(cfg, j, err, { part });
  }
}

// (Phase 4) a long video's parts joined (the clock): each part as it was kept (all encoded alike), one after the other, into
// its one video (it carries the share mark: its download too); the parts and their last frames deleted after
async function join(cfg, j, F, { deadline, run }) {
  const id = j.id, parts = Number(j.parts);
  const left = (reserve, most) => Math.max(1500, Math.min(most, deadline - Date.now() - reserve));
  try {
    const t = left(7000, 6000);
    const files = await Promise.all(Array.from({ length: parts }, (_, n) => F.getFile(cfg, partPath(j.inf_id, id, n), { max: PART_MAX, timeoutMs: t })));
    if (files.some((f) => !f)) {
      await fail(cfg, id, 'save', true);
      console.warn(`[studio] job ${id}: a part of it is missing, so it can't be joined (its credits back)`);
      return { state: 'failed', step: 'join' };
    }
    const { joinParts } = await import('./inf-mark.js');
    const video = await joinParts(files, { timeoutMs: left(4000, 6000), run });
    if (deadline - Date.now() < 2000) throw new Error('no time left to keep it');
    await F.putFile(cfg, videoPath(j), video, 'video/mp4', { timeoutMs: left(500, 9000) });
    await rpc(cfg, 'inf_job_done', { p_id: id, p_files: 0, p_bytes: video.length }, 'studio');
    await rpc(cfg, 'inf_mark_done', { p_job: id }, 'studio').catch((err) => console.warn(`[studio] job ${id}: its mark noted: ${err.message}`));
    const gone = [...Array.from({ length: parts }, (_, n) => partPath(j.inf_id, id, n)), ...Array.from({ length: parts - 1 }, (_, n) => framePath(j.inf_id, id, n))];
    F.deleteFiles(cfg, gone).catch((err) => console.warn(`[studio] job ${id}'s parts: ${err.message}`));
    console.log(`[studio] job ${id} (a long video, ${parts} parts) is done: ${(video.length / 1e6).toFixed(2)} MB`);
    return { state: 'done', step: 'join' };
  } catch (err) {
    return saveFailed(cfg, j, err, { join: true });
  }
}

// a part's or a join's keeping that didn't work: fal waiting, or a try (4 at most: then it can't be made, its credits back)
async function saveFailed(cfg, j, err, { part = null, join: joining = false } = {}) {
  const id = j.id;
  if (err.why === 'refused' || err.why === 'nothing') {
    await fail(cfg, id, err.why === 'refused' ? 'refused' : 'ai:video', true);
    console.warn(`[studio] job ${id}: ${err.message}`);
    return { state: 'failed', step: joining ? 'join' : 'save' };
  }
  if (FAL_WAIT.has(err.why)) {
    if (err.why === 'key' || err.why === 'credits') warnOnce(err.why, `an influencer's job waits: ${err.message}`);
    await waitTurn(cfg, id);
    return { state: 'saving', step: joining ? 'join' : 'save' };
  }
  const tries = Number(j.tries) || 0;
  if (err.tooBig || err.gone || tries + 1 >= JOBS.SAVE_TRIES) {
    await fail(cfg, id, err.tooBig ? 'too_big' : err.why === 'ai' ? 'check' : 'save', true);
    console.warn(`[studio] job ${id}'s ${joining ? 'parts couldn\'t be joined' : `part ${Number(part) + 1} couldn't be kept`}: ${err.message}`);
    return { state: 'failed', step: joining ? 'join' : 'save' };
  }
  console.warn(`[studio] job ${id}'s ${joining ? 'join' : `part ${Number(part) + 1}`}: ${err.message} (trying again)`);
  // a try counted (a join keeps no request: its tries are counted the same way, its part as it is)
  await setStep(cfg, id, { req: j.req, statusUrl: j.status_url, resultUrl: j.result_url, saving: !joining, tries: tries + 1 });
  return { state: 'saving', step: joining ? 'join' : 'save' };
}

// The clock (every minute, with the studio's: api/feed.js ?studio): the jobs whose turn it is, until its time is used; the
// tidy-up every half hour (uploads, influencers that couldn't be made, deleted ones: their files deleted).
// → { due, moved, done, failed, tidy? }
// `now` says which minute it is (the tests give it); the deadline is always the real clock's (Vercel stops a function at
// 25 s). Until 2026-10-10 the deadline was `now + 19 s`, so a test with another `now` ran out of time once the real clock
// passed it: Vercel's builds of AGI Studio's round 2 failed that way after 12:00 UTC.
export async function infClock(cfg, { now = Date.now(), deadline = Date.now() + 19_000, files = null, run = null } = {}) {
  const ids = await rpc(cfg, 'inf_job_due', { p_limit: 6 }, 'studio');
  const out = { due: Array.isArray(ids) ? ids.length : 0, moved: 0, done: 0, failed: 0 };
  for (const id of Array.isArray(ids) ? ids : []) {
    if (Date.now() > deadline - 5_000) break;
    try {
      const r = await jobTick(cfg, id, { now: Date.now(), deadline, files, encode: true, run });
      if (r.state === 'started' || r.state === 'saving') out.moved += 1;
      if (r.state === 'done') out.done += 1;
      if (r.state === 'failed') out.failed += 1;
    } catch (err) {
      console.warn(`[studio] job ${id}: ${err.message}`);
    }
  }
  if (new Date(now).getUTCMinutes() % 30 === 0 && Date.now() < deadline - 4000) {
    try { out.tidy = await tidy(cfg, { files }); } catch (err) { console.warn(`[studio] the studio app's tidy-up: ${err.message}`); }
  }
  return out;
}

// The tidy-up: the database forgets old uploads and influencers, and their files are deleted here; (round 4, phase 3) gift
// links past their days give their credits back (the database), and invites' rewards for any top-up not counted yet (a
// hiccup right after it) are counted, at most 100 each time
export async function tidy(cfg, { files = null } = {}) {
  const t = await rpc(cfg, 'inf_tidy', {}, 'studio');
  const F = files || await import('./studio-files.js');
  const { removeUpload } = await import('./inf-uploads.js');
  let deleted = 0;
  for (const u of Array.isArray(t?.uploads) ? t.uploads : []) {
    deleted += await removeUpload(cfg, u.id, u.kind).catch(() => 0);
  }
  for (const inf of Array.isArray(t?.infs) ? t.infs : []) {
    if (!ID.test(String(inf))) continue;
    deleted += await F.deleteFiles(cfg, await F.listFiles(cfg, `inf/${inf}`)).catch(() => 0);
  }
  let invites = 0;
  try { invites = (await (await import('./inf-gifts.js')).settleInvites(cfg, { limit: 100 })).settled; } catch (err) {
    if (err?.code !== 'PGRST202') console.warn(`[studio] invites' rewards (the clock's catch-up): ${err.message}`);
  }
  return { uploads: t?.uploads?.length || 0, infs: t?.infs?.length || 0, jobs: t?.jobs || 0, files: deleted, gifts: Number(t?.gifts) || 0, invites };
}
