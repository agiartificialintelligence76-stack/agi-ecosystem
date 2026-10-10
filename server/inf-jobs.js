// AGI Studio (2026-10-10): the AI jobs behind an influencer (its looks, its full body, its photos, its trend and scene videos,
// and the owner's trend moves), moved along one step at a time like the studio's characters (server/studio.js) and videos
// (server/studio-video.js): by its page while it's open, and by the studio's clock every minute (supabase/studio.sql's
// Supabase Cron → /api/feed?studio), never two at once (a lease). Each job:
//   1. sent to the AI service (server/inf-ai.js jobRequest: fal.ai's queue), with short-lived signed addresses of what it's
//      made from (its upload, its picked look, its full body, one of its photos, a clip, a trend move), never public ones;
//   2. asked about while it's made (its place in the queue, then made or not);
//   3. its pictures (a JPEG at most 1536 px and a small WebP for the pages) or its video (looked at by Gemini first: a video
//      that isn't family-friendly is never shown, and its credits come back) kept in the studio's private bucket.
// A job the service can't make is sent again twice, then given up: its credits come back (supabase/influencers.sql
// inf_job_fail). fal's key, its balance or its queue for a moment never fails a job: it waits (the log tells the owner once).
import { createHmac } from 'node:crypto';
import { rpc } from './limits.js';
import { falSubmit, falStatus, falOutput, refusedText } from './fal.js';
import { jobRequest, outputOf, checkVideo } from './inf-ai.js';

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
const MAX_PIXELS = 40_000_000;
const FAL_WAIT = new Set(['key', 'credits', 'busy', 'fal']);
const ID = /^[A-Za-z0-9_-]{22}$/;

// ---------- its files' names in the bucket (server/studio-files.js NAME) ----------
export const picPath = (inf, job, n = 0, ext = 'jpg') => `inf/${inf}/${job}-${n}.${ext}`;
export const videoPath = (j) => (j.kind === 'preset' ? `trends/${j.id}.mp4` : `inf/${j.inf_id}/${j.id}.mp4`);
export const posterPath = (j) => (j.kind === 'preset' ? `trends/${j.id}.poster.webp` : `inf/${j.inf_id}/${j.id}.poster.webp`);

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
    if (j.inf_mode === 'face' && j.inf_source) urls.source = await sign(`up/${j.inf_source}.jpg`);
  }
  if (['photo', 'trend', 'video'].includes(j.kind) && j.inf_body_job) urls.body = await sign(picPath(j.inf_id, j.inf_body_job, 0));
  if (j.image) urls.image = await sign(picPath(j.inf_id, j.image, 0));
  if (j.kind === 'trend' && j.clip) urls.clip = await sign(`up/${j.clip}.mp4`);
  if (j.kind === 'trend' && !j.clip && j.trend_job) urls.trend = await sign(`trends/${j.trend_job}.mp4`);
  return urls;
}

// A picture the AI made → { jpg (at most 1536 px), webp (384 px, for the pages) }, or null when it isn't one
export async function picturesOf(sharp, bytes) {
  const meta = await sharp(bytes, { limitInputPixels: MAX_PIXELS }).metadata().catch(() => null);
  if (!meta || !meta.width || !meta.height || !['jpeg', 'png', 'webp'].includes(meta.format)) return null;
  const base = () => sharp(bytes, { limitInputPixels: MAX_PIXELS }).rotate();
  const [jpg, webp] = await Promise.all([
    base().resize(1536, 1536, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 88 }).toBuffer(),
    base().resize(384, 384, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
  ]);
  return { jpg, webp };
}

// One job moved along, if it's its turn. → { state: 'busy' | 'waiting' | 'started' | 'saving' | 'done' | 'failed', step?,
// position? (its place in the AI service's queue) }
export async function jobTick(cfg, id, { now = Date.now(), deadline = now + 20_000, files = null } = {}) {
  if (!await rpc(cfg, 'inf_job_lease', { p_id: id, p_secs: JOBS.LEASE_S }, 'studio')) return { state: 'busy' };
  let j;
  try { j = await getJob(cfg, id); } catch (err) { await waitTurn(cfg, id).catch(() => {}); throw err; }
  if (!j || !['paid', 'making'].includes(j.status)) return { state: 'busy' };
  // its influencer is still there (not deleted, not taken down): else it isn't made (its credits come back)
  if (j.kind !== 'preset' && (!j.inf_id || j.inf_status === 'deleted' || j.inf_hidden === true || cfg.studioHide?.has(j.inf_id))) {
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
  if (j.status === 'paid' || !j.req) return submit(Number(j.tries) || 0);
  if (Date.parse(j.started_at || j.created_at) < now - JOBS.MAX_MAKING_MS) {
    await fail(cfg, id, 'expired', true);
    return { state: 'failed', step: stepOf(j) };
  }
  if (j.saving) {
    if (deadline - Date.now() < SAVE_NEEDS_MS) { await waitTurn(cfg, id); return { state: 'saving', step: 'save' }; }
    return save(cfg, j, F, { deadline });
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
  if (deadline - Date.now() < SAVE_NEEDS_MS) return { state: 'saving', step: 'save' };
  if (!await rpc(cfg, 'inf_job_lease', { p_id: id, p_secs: JOBS.SAVE_LEASE_S }, 'studio')) return { state: 'saving', step: 'save' };
  return save(cfg, { ...j, saving: true, tries: 0 }, F, { deadline });
}

// Keeping what it made. Every wait fits in the time left; a save that runs out of time is a try.
async function save(cfg, j, F, { deadline }) {
  const id = j.id;
  const left = (reserve, most) => Math.max(1500, Math.min(most, deadline - Date.now() - reserve));
  try {
    const out = outputOf(j.kind, await falOutput(cfg, j.result_url, { timeoutMs: left(12_000, 6000) }));
    if (out.images) {
      const sources = await Promise.all(out.images.map((u) => F.fromFal(u, { max: IMAGE_MAX, timeoutMs: left(8000, 10_000) })));
      const sharp = await F.loadSharp();
      const made = await Promise.all(sources.map((b) => picturesOf(sharp, b)));
      if (made.some((m) => !m)) throw new Error("files: a picture the AI made isn't one");
      if (deadline - Date.now() < 2500) throw new Error('no time left to keep them');
      const t = left(1000, 9000);
      await Promise.all(made.flatMap((m, n) => [
        F.putFile(cfg, picPath(j.inf_id, id, n), m.jpg, 'image/jpeg', { timeoutMs: t }),
        F.putFile(cfg, picPath(j.inf_id, id, n, 'webp'), m.webp, 'image/webp', { timeoutMs: t }),
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
    if (j.kind !== 'preset') {
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

// The clock (every minute, with the studio's: api/feed.js ?studio): the jobs whose turn it is, until its time is used; the
// tidy-up every half hour (uploads, influencers that couldn't be made, deleted ones: their files deleted).
// → { due, moved, done, failed, tidy? }
export async function infClock(cfg, { now = Date.now(), deadline = now + 19_000, files = null } = {}) {
  const ids = await rpc(cfg, 'inf_job_due', { p_limit: 6 }, 'studio');
  const out = { due: Array.isArray(ids) ? ids.length : 0, moved: 0, done: 0, failed: 0 };
  for (const id of Array.isArray(ids) ? ids : []) {
    if (Date.now() > deadline - 5_000) break;
    try {
      const r = await jobTick(cfg, id, { now: Date.now(), deadline, files });
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

// The tidy-up: the database forgets old uploads and influencers, and their files are deleted here
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
  return { uploads: t?.uploads?.length || 0, infs: t?.infs?.length || 0, jobs: t?.jobs || 0, files: deleted };
}
