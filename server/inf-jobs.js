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
import { jobRequest, outputOf, checkVideo, checkMeme, headBox } from './inf-ai.js';
import { mp4Info } from './mp4.js';
import { agi1Urls } from './inf-agi1.js';
import { CLIP, BANNER, FRAME, isFrame, frameBox } from '../src/studio/rules.js';
import { withAiTag } from '../src/studio/ai-tag.js';
import { templateOf, checkLayers, isMarkSpot } from '../src/studio/memes.js';
// (2026-10-12) what's downloaded says inside its file that it's AI-made (src/studio/ai-tag.js): as it is when it can't be read
export const aiTagged = (bytes) => {
  const t = withAiTag(bytes);
  return t ? (Buffer.isBuffer(t) ? t : Buffer.from(t.buffer, t.byteOffset, t.byteLength)) : bytes;
};

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
const ASIS_NEEDS_MS = 8000;      // (2026-10-11) a photo used as it is: read, cut and kept
const IMAGE_MAX = 25_000_000;     // the most read for one picture the AI made
const HD_IMAGE_MAX = 64_000_000;  // (phase 4) an HD or Ultra one (Crisp's 4K can be a big PNG)
// (phase 4) a long video's part kept, and its parts joined: the clock's time they need (server/inf-mark.js PART)
const PART_NEEDS_MS = 14_000, JOIN_NEEDS_MS = 12_000, PART_MAX = 40_000_000;
// (2026-10-14) a meme's 5-second video put on its canvas with its words and the mark: the clock's time it needs (server/inf-mark.js
// MEME_VIDEO.NEEDS_MS: the same number, checked by a test) and the most read for it
export const MEME_NEEDS_MS = 16_000;
const MEME_SOURCE_MAX = 40_000_000;
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
// (2026-10-12, the video editor) a cut's words and stickers (the transparent picture its maker's browser drew: server/inf-cut.js),
// kept until it's made; its pieces are its parts (partPath)
export const layerPath = (inf, job) => `inf/${inf}/${job}.layer.png`;
// (2026-10-14) a template meme's picture without its words (src/studio/memes.js): what its editor draws its words over, and what
// an edit with words, someone added or its 5-second video starts from (src/studio/rules.js infMemePic)
export const memePicPath = (inf, job) => `inf/${inf}/${job}.pic.jpg`;
export const isLong = (j) => j?.kind === 'video' && j.model === 'long' && Number(j.parts) > 1;
// (2026-10-14) a template meme (its layers of words, drawn by our server), and a template meme's 5-second video
export const isTemplate = (j) => j?.kind === 'photo' && Array.isArray(j.layers);
export const isMemeVideo = (j) => j?.kind === 'video' && Array.isArray(j.layers);
const OWNERS = new Set(['preset', 'example']);           // the owner's jobs: no influencer
// (2026-10-12, the editor) Every file a photo (a meme, an X banner), a video or a trend video may have kept: what its maker's
// Delete deletes (and the tidy-up again a week later, in case deleting them at once failed). Names it never had are fine
// (Storage skips them). → names (none for anything else)
export function jobFiles(j) {
  const inf = j?.inf_id, id = j?.id;
  if (!ID.test(String(inf)) || !ID.test(String(id))) return [];
  if (j.kind === 'photo') return [...[0, 1, 2, 3].flatMap((k) => [picPath(inf, id, k), picPath(inf, id, k, 'webp'), hdPath(inf, id, k)]), memePicPath(inf, id)];
  if (j.kind !== 'trend' && j.kind !== 'video') return [];
  return [videoPath(j), posterPath(j), markedPath(inf, id), layerPath(inf, id), ...[0, 1, 2, 3].flatMap((k) => [partPath(inf, id, k), framePath(inf, id, k)])];
}

// ---------- the database ----------
// (2026-10-14) a creation with someone else in it who's taken down by the owner's setting (STUDIO_HIDE) is hidden like one the
// database hides (inf_cast_shown: deleted, hidden, its maker banned), so nothing serves or starts from it
export const getJob = async (cfg, id) => {
  if (!ID.test(String(id))) return null;
  const j = await rpc(cfg, 'inf_job_get', { p_id: id }, 'studio');
  if (j && ID.test(String(j.cast_inf ?? '')) && cfg.studioHide?.has(j.cast_inf)) j.hidden = true;
  return j;
};
// (also the video editor's: server/inf-cut.js)
export const fail = (cfg, id, error, refund = true) => rpc(cfg, 'inf_job_fail', { p_id: id, p_error: error, p_refund: refund }, 'studio');
export const setStep = (cfg, id, { req = null, statusUrl = null, resultUrl = null, saving = false, tries = 0 }) =>
  rpc(cfg, 'inf_job_step', { p_id: id, p_req: req, p_status_url: statusUrl, p_result_url: resultUrl, p_saving: saving, p_tries: tries }, 'studio');
export const waitTurn = (cfg, id) => rpc(cfg, 'inf_job_wait', { p_id: id }, 'studio');
export const stepOf = (j) => (j.saving ? 'save' : j.req ? 'make' : 'queue');
// the id the reference-to-video model gets for who asked (it asks for one): never the wallet, nor its code here
const falUser = (cfg, code) => createHmac('sha256', String(cfg.passSecret)).update(`fal-user:${code}`).digest('base64url').slice(0, 24);
const warned = new Set();
function warnOnce(what, message) {
  if (warned.has(what)) return;
  warned.add(what);
  console.error(`[studio] ${message}`);
}

// Signed addresses (6 hours) of what a job is made from. → { source, look, body, image, clip, trend, refs, frame, agi1, cast }
// (the ones it needs) · throws { gone: 'cast' } when another influencer in a template meme's role isn't there any more
async function inputsOf(cfg, F, j) {
  const sign = (name) => F.signedUrl(cfg, name, { expiresIn: 6 * 3600 });
  const urls = {};
  if (j.kind === 'looks' && j.inf_mode !== 'design' && j.inf_source) urls.source = await sign(`up/${j.inf_source}.jpg`);
  if (j.kind === 'body') {
    if (j.inf_way === 'body') {
      // (2026-10-11) "Just its full body": from its picture alone
      if (j.inf_source) urls.source = await sign(`up/${j.inf_source}.jpg`);
    } else {
      urls.look = await sign(picPath(j.inf_id, j.inf_looks_job, j.pick));
      // one made from a picture: that picture too, while it's still there (its body, outfit, legs and shoes kept: since
      // 2026-10-11 a drawing's too, not only a real person's photo, whose face is kept exactly)
      if (j.inf_mode !== 'design' && j.inf_source) urls.source = await sign(`up/${j.inf_source}.jpg`).catch(() => null);
    }
  }
  // (round 2) a trend video: its picked look is its face in the clip
  if (j.kind === 'trend' && j.inf_looks_job && Number.isInteger(j.inf_pick)) urls.look = await sign(picPath(j.inf_id, j.inf_looks_job, j.inf_pick));
  const memeVideo = isMemeVideo(j);
  if (['photo', 'trend', 'video'].includes(j.kind) && j.inf_body_job && !memeVideo) urls.body = await sign(picPath(j.inf_id, j.inf_body_job, 0));
  // (2026-10-14) a template meme's edit, someone added to one or its 5-second video starts from its picture without its words
  // (it has its layers too); anything else from the photo itself
  if (j.image) urls.image = await sign(Array.isArray(j.layers) ? memePicPath(j.inf_id, j.image) : picPath(j.inf_id, j.image, 0));
  // (2026-10-14) another of the person's influencers in one of a template's roles (job.cast_inf): its full body (inf_job_get's
  // cast_body, only while it's still there and shown); gone meanwhile (deleted, hidden, its maker banned, taken down): the job
  // can't be made (its credits come back). Its 5-second video needs none: they're in its first frame already
  if (isTemplate(j) && ID.test(String(j.cast_inf ?? ''))) {
    if (!ID.test(String(j.cast_body ?? '')) || cfg.studioHide?.has(j.cast_inf)) throw Object.assign(new Error('inf: the other influencer is gone'), { gone: 'cast' });
    urls.cast = await sign(picPath(j.cast_inf, j.cast_body, 0));
  }
  if (j.kind === 'trend' && j.clip) urls.clip = await sign(`up/${j.clip}.mp4`);
  if (j.kind === 'trend' && !j.clip && j.trend_job) urls.trend = await sign(`trends/${j.trend_job}.mp4`);
  // (round 4, phase 4) its reference pictures; a video's character as Kling's element (its picked look) when it has
  // references or is a long one; a long video's part after the first starts from the one before's last frame
  const refs = Array.isArray(j.refs) ? j.refs.filter((r) => ID.test(String(r))) : [];
  if (refs.length) urls.refs = await Promise.all(refs.map((r) => sign(`up/${r}.jpg`)));
  // (2026-10-13) "With AGI-1": in a video the character is always Kling's element then (AGI-1 is the next one)
  if (j.kind === 'video' && !memeVideo && (refs.length || isLong(j) || j.agi1 === true) && j.inf_looks_job && Number.isInteger(j.inf_pick)) urls.look = await sign(picPath(j.inf_id, j.inf_looks_job, j.inf_pick));
  if (isLong(j) && Number(j.part) > 0) urls.frame = await sign(framePath(j.inf_id, j.id, Number(j.part) - 1));
  // (2026-10-13) her own pictures (server/inf-agi1.js), kept in the bucket the first time: her whole body, and in a video her face
  // (2026-10-14: not for a meme's 5-second video: she's in its first frame already)
  if (j.agi1 === true && (j.kind === 'photo' || (j.kind === 'video' && !memeVideo))) urls.agi1 = await agi1Urls(cfg, F, { face: j.kind === 'video' });
  return urls;
}

// A picture the AI made → { jpg (at most 1536 px), webp (384 px, for the pages) }, or null when it isn't one. (Round 4) an X
// banner → exactly X's header size (1500 × 500, its right three quarters: the character is two thirds across), and a 768 px
// wide one for the pages; (2026-10-12) an edited one (centred: true) from its middle, as it was made a little wider than the
// banner it's an edit of. (Phase 4) an HD or Ultra photo (hd: true) → also its full-size picture with the share mark (hd:
// its download, a JPEG at quality 90)
export async function picturesOf(sharp, bytes, { banner = false, hd = false, centred = false } = {}) {
  const meta = await sharp(bytes, { limitInputPixels: MAX_PIXELS }).metadata().catch(() => null);
  if (!meta || !meta.width || !meta.height || !['jpeg', 'png', 'webp'].includes(meta.format)) return null;
  const base = () => sharp(bytes, { limitInputPixels: MAX_PIXELS }).rotate();
  if (banner) {
    const cut = () => base().resize(BANNER.W, BANNER.H, { fit: 'cover', position: centred ? 'centre' : 'right' }).flatten({ background: '#ffffff' });
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

// (2026-10-11) its portrait, cut from a full-body picture around its head (head: [top, left, bottom, right] in thousandths of
// the picture, else the top middle): a square about 2.4 heads across with the head in its upper part (head and shoulders),
// inside the picture, made 768 to 1024 px (smoothly bigger when it's smaller). → { jpg, webp (384 px) } or null
export async function portraitOf(sharp, bytes, head = null) {
  const up = await sharp(bytes, { limitInputPixels: MAX_PIXELS }).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true }).catch(() => null);
  if (!up?.info?.width || !up.info.height) return null;
  const { width: W, height: H, channels } = up.info;
  const box = headBox(head);
  let cx = W / 2, top = 0, size = Math.min(W, H * 0.4);
  if (box) {
    const [t, l, b, r] = box.map((v) => v / 1000);
    size = Math.max((b - t) * H, (r - l) * W) * 2.4;
    cx = ((l + r) / 2) * W;
    top = t * H - 0.1 * size;
  }
  size = Math.max(16, Math.min(Math.round(size), W, H));
  const left = Math.min(Math.max(0, Math.round(cx - size / 2)), W - size);
  top = Math.min(Math.max(0, Math.round(top)), H - size);
  const out = Math.min(1024, Math.max(768, size));
  const cut = () => sharp(up.data, { raw: { width: W, height: H, channels } }).extract({ left, top, width: size, height: size })
    .resize(out, out, { kernel: 'lanczos3' });
  const [jpg, webp] = await Promise.all([cut().jpeg({ quality: 90 }).toBuffer(), cut().resize(384, 384).webp({ quality: 80 }).toBuffer()]);
  return { jpg, webp };
}

// (2026-10-11) the square its maker framed in one of its pictures (src/studio/rules.js FRAME: its profile picture, its coin's
// picture), cut from it: size px at most (smaller when the square is smaller in the picture, never under FRAME.SMALL), and a
// small copy for the pages (FRAME.SMALL px; none when small is 0). → { jpg, webp } or null (not a picture, or not a frame)
export async function frameOf(sharp, bytes, frame, { size = FRAME.SIDE, small = FRAME.SMALL, quality = 90 } = {}) {
  if (!isFrame(frame)) return null;
  const up = await sharp(bytes, { limitInputPixels: MAX_PIXELS }).rotate().removeAlpha().raw().toBuffer({ resolveWithObject: true }).catch(() => null);
  if (!up?.info?.width || !up.info.height) return null;
  const { width: W, height: H, channels } = up.info;
  const { left, top, side } = frameBox(frame, W, H);
  const out = Math.min(size, Math.max(side, FRAME.SMALL));
  const cut = () => sharp(up.data, { raw: { width: W, height: H, channels } }).extract({ left, top, width: side, height: side });
  const [jpg, webp] = await Promise.all([
    cut().resize(out, out, { kernel: 'lanczos3' }).jpeg({ quality }).toBuffer(),
    small ? cut().resize(small, small, { kernel: 'lanczos3' }).webp({ quality: 80 }).toBuffer() : null,
  ]);
  return { jpg, webp };
}

// (2026-10-11) where the head is in a full body the AI made on a plain light background: the figure is what isn't the
// background (its corners' color), its head the top seventh of it or so (a little more: the portrait keeps some room),
// centered on the figure there. → [top, left, bottom, right] in thousandths, or null (no figure found: the top middle then)
export async function figureHead(sharp, bytes) {
  const r = await sharp(bytes, { limitInputPixels: MAX_PIXELS }).rotate().resize(256, 256, { fit: 'inside' }).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true }).catch(() => null);
  if (!r?.info?.width) return null;
  const { width: w, height: h, channels: c } = r.info;
  const px = (x, y) => (y * w + x) * c;
  const corner = [[0, 0], [w - 4, 0], [0, h - 4], [w - 4, h - 4]].flatMap(([x0, y0]) => {
    const out = [];
    for (let y = y0; y < y0 + 4; y++) for (let x = x0; x < x0 + 4; x++) out.push(px(x, y));
    return out;
  });
  const bg = [0, 1, 2].map((k) => corner.reduce((a, i) => a + r.data[i + k], 0) / corner.length);
  const isFig = (x, y) => {
    const i = px(x, y);
    return Math.abs(r.data[i] - bg[0]) + Math.abs(r.data[i + 1] - bg[1]) + Math.abs(r.data[i + 2] - bg[2]) > 60;
  };
  const edge = Math.max(2, Math.round(w * 0.02));
  let top = -1, bottom = -1;
  for (let y = edge; y < h - edge; y++) {
    let n = 0;
    for (let x = edge; x < w - edge && n < 2; x++) if (isFig(x, y)) n++;
    if (n >= 2) { if (top < 0) top = y; bottom = y; }
  }
  if (top < 0 || bottom - top + 1 < h * 0.3) return null;
  const headH = Math.max(4, Math.round((bottom - top + 1) / 6.5));
  let minX = w, maxX = -1;
  for (let y = top; y < Math.min(h, top + headH); y++) for (let x = edge; x < w - edge; x++) if (isFig(x, y)) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
  if (maxX < minX) return null;
  const cx = (minX + maxX) / 2, half = Math.max(2, Math.min((maxX - minX + 1) / 2, headH * 0.6));
  const k = (v, n) => Math.min(1000, Math.max(0, Math.round((v / n) * 1000)));
  return headBox([k(top, h), k(cx - half, w), k(top + headH, h), k(cx + half, w)]);
}

// (2026-10-11) a photo used as it is ("Use my photo as it is": no AI): its full body is the photo (its pictures as any full
// body's), its portrait cut around its head (where the upload check saw it), then the photo it came from goes
async function asIs(cfg, j, F, { deadline }) {
  const id = j.id;
  const left = (reserve, most) => Math.max(1500, Math.min(most, deadline - Date.now() - reserve));
  try {
    if (!j.inf_source) { await fail(cfg, id, 'source', true); return { state: 'failed', step: 'save' }; }
    const bytes = await F.getFile(cfg, `up/${j.inf_source}.jpg`, { timeoutMs: left(5000, 8000), max: 8_000_000 });
    if (!bytes) { await fail(cfg, id, 'source', true); return { state: 'failed', step: 'save' }; }
    const sharp = await F.loadSharp();
    const [body, face] = await Promise.all([picturesOf(sharp, bytes), portraitOf(sharp, bytes, j.inf_head)]);
    if (!body || !face) { await fail(cfg, id, 'source', true); return { state: 'failed', step: 'save' }; }
    if (deadline - Date.now() < 2500) throw new Error('no time left to keep them');
    const t = left(1000, 9000);
    await Promise.all([[body, 0], [face, 1]].flatMap(([m, n]) => [
      F.putFile(cfg, picPath(j.inf_id, id, n), m.jpg, 'image/jpeg', { timeoutMs: t }),
      F.putFile(cfg, picPath(j.inf_id, id, n, 'webp'), m.webp, 'image/webp', { timeoutMs: t }),
    ]));
    await rpc(cfg, 'inf_job_done', { p_id: id, p_files: 2, p_bytes: body.jpg.length + face.jpg.length }, 'studio');
    F.deleteFiles(cfg, [`up/${j.inf_source}.jpg`]).catch((err) => console.warn(`[studio] an influencer's source picture: ${err.message}`));
    return { state: 'done', step: 'save' };
  } catch (err) {
    const tries = Number(j.tries) || 0;
    if (tries + 1 >= JOBS.SAVE_TRIES) {
      await fail(cfg, id, 'save', true);
      console.warn(`[studio] job ${id}'s photo couldn't be kept as it is: ${err.message}`);
      return { state: 'failed', step: 'save' };
    }
    console.warn(`[studio] job ${id}'s photo, as it is: ${err.message} (trying again)`);
    await setStep(cfg, id, { saving: true, tries: tries + 1 });
    return { state: 'saving', step: 'save' };
  }
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
    // (2026-10-12) a video editor's cut: what it kept on the way (its words' picture, its pieces) goes too
    if (j.kind === 'video' && j.editor === true) {
      const F = files || await import('./studio-files.js');
      await F.deleteFiles(cfg, jobFiles(j)).catch((err) => console.warn(`[studio] a cut's files: ${err.message}`));
    }
    return { state: 'failed', step: stepOf(j) };
  }
  const F = files || await import('./studio-files.js');
  // (2026-10-12) a video saved from the video editor: made by our clock with ffmpeg in pieces, then looked at (server/inf-cut.js)
  if (j.kind === 'video' && j.editor === true) return (await import('./inf-cut.js')).cutTick(cfg, j, F, { now, deadline, encode, run });
  const submit = async (tries) => {
    let urls;
    try { urls = await inputsOf(cfg, F, j); } catch (err) {
      // (2026-10-14) another influencer in its template's role, gone meanwhile: it can't be made (its credits back)
      if (err.gone === 'cast') {
        await fail(cfg, id, 'cast', true);
        console.warn(`[studio] job ${id}: the other influencer in it is gone, so it can't be made (its credits back)`);
        return { state: 'failed', step: 'queue' };
      }
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
  // (2026-10-11) a photo used as it is: no AI, kept right here (its full body is the photo, its portrait cut around its head)
  if (j.kind === 'body' && j.inf_way === 'asis') {
    if (deadline - Date.now() < ASIS_NEEDS_MS) { await waitTurn(cfg, id); return { state: 'saving', step: 'save' }; }
    return asIs(cfg, j, F, { deadline });
  }
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
  // (2026-10-14) a meme's 5-second video is put on its canvas with its words by the clock only (ffmpeg is there), like a long
  // video's parts
  const memeVid = isMemeVideo(j);
  const clockOnly = long || memeVid;
  const needs = long ? PART_NEEDS_MS : memeVid ? MEME_NEEDS_MS : SAVE_NEEDS_MS;
  const keep = (row) => (long ? savePart(cfg, row, F, { deadline, run }) : memeVid ? saveMemeVideo(cfg, row, F, { deadline, run }) : save(cfg, row, F, { deadline }));
  if (j.saving) {
    if ((clockOnly && !encode) || deadline - Date.now() < needs) { await waitTurn(cfg, id); return { state: 'saving', step: 'save', ...(long ? { part: Number(j.part) } : {}) }; }
    return keep(j);
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
  if ((clockOnly && !encode) || deadline - Date.now() < needs) return { state: 'saving', step: 'save' };
  if (!await rpc(cfg, 'inf_job_lease', { p_id: id, p_secs: JOBS.SAVE_LEASE_S }, 'studio')) return { state: 'saving', step: 'save' };
  return keep({ ...j, saving: true, tries: 0 });
}

// Keeping what it made. Every wait fits in the time left; a save that runs out of time is a try.
async function save(cfg, j, F, { deadline }) {
  const id = j.id;
  const left = (reserve, most) => Math.max(1500, Math.min(most, deadline - Date.now() - reserve));
  try {
    const out = outputOf(j.kind, await falOutput(cfg, j.result_url, { timeoutMs: left(12_000, 6000) }));
    if (out.images && isTemplate(j)) {
      // (2026-10-14) a template meme: the AI's picture cut to its template's picture area (kept as its picture without words:
      // what its editor draws its words over, and what an edit, someone added or its video starts from), put on its canvas with
      // its words drawn by us (server/meme-render.js), looked at by Gemini as every meme is (its words were checked as typed; the
      // AI was asked for none of its own), then kept: no full-size copy (its download is the meme itself, with the mark where
      // its words aren't)
      const tpl = templateOf(j.meme);
      const L = checkLayers(j.layers);
      if (!tpl || !L.ok) {
        await fail(cfg, id, 'source', true);
        console.warn(`[studio] job ${id}: its meme template or its words aren't ones we draw (its credits back)`);
        return { state: 'failed', step: 'save' };
      }
      const bytes = await F.fromFal(out.images[0], { max: IMAGE_MAX, timeoutMs: left(8000, 10_000) });
      const sharp = await F.loadSharp();
      const meta = await sharp(bytes, { limitInputPixels: MAX_PIXELS }).metadata().catch(() => null);
      if (!meta?.width || !meta?.height || !['jpeg', 'png', 'webp'].includes(meta.format)) throw new Error("files: a picture the AI made isn't one");
      const R = await import('./meme-render.js');
      const pic = await R.picOf(sharp, bytes, tpl);
      const meme = await R.renderMeme(sharp, await R.composeBase(sharp, pic, tpl), L.layers, tpl);
      const v = await checkMeme(cfg, meme.jpg, j.caption);
      if (!v.ok) {
        await fail(cfg, id, 'refused', true);
        console.warn(`[studio] job ${id}'s meme wasn't family-friendly (${v.why}): not shown, its credits back`);
        return { state: 'failed', step: 'save' };
      }
      if (deadline - Date.now() < 2500) throw new Error('no time left to keep them');
      const t = left(1000, 9000);
      await Promise.all([
        F.putFile(cfg, memePicPath(j.inf_id, id), pic, 'image/jpeg', { timeoutMs: t }),
        F.putFile(cfg, picPath(j.inf_id, id, 0), meme.jpg, 'image/jpeg', { timeoutMs: t }),
        F.putFile(cfg, picPath(j.inf_id, id, 0, 'webp'), meme.webp, 'image/webp', { timeoutMs: t }),
      ]);
      await rpc(cfg, 'inf_job_done', { p_id: id, p_files: 1, p_bytes: meme.jpg.length + pic.length }, 'studio');
      return { state: 'done', step: 'save' };
    }
    if (out.images) {
      // (phase 4) an HD or Ultra photo keeps its full-size picture too (with the share mark: its download)
      const hd = j.kind === 'photo' && j.shape !== 'banner' && ['hd', 'ultra'].includes(j.quality);
      const sources = await Promise.all(out.images.map((u) => F.fromFal(u, { max: hd ? HD_IMAGE_MAX : IMAGE_MAX, timeoutMs: left(8000, 10_000) })));
      const sharp = await F.loadSharp();
      // an X banner made from one (an edit, or since 2026-10-13 "Add AGI-1": made a little wider than it) is cut from its middle
      const made = await Promise.all(sources.map((b) => picturesOf(sharp, b, { banner: j.kind === 'photo' && j.shape === 'banner', hd, centred: Boolean(j.edit || (j.image && j.agi1 === true)) })));
      if (made.some((m) => !m)) throw new Error("files: a picture the AI made isn't one");
      // (2026-10-11) "Just its full body": its portrait is cut from it, around its head (its picked look, n = 1)
      if (j.kind === 'body' && j.inf_way === 'body') {
        const face = await portraitOf(sharp, sources[0], await figureHead(sharp, sources[0]));
        if (!face) throw new Error("files: its portrait couldn't be cut");
        made.push(face);
      }
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
        ...(m.hd ? [F.putFile(cfg, hdPath(j.inf_id, id, n), aiTagged(m.hd), 'image/jpeg', { timeoutMs: t })] : []),
      ]));
      await rpc(cfg, 'inf_job_done', { p_id: id, p_files: made.length, p_bytes: made.reduce((a, m) => a + m.jpg.length, 0) }, 'studio');
      // its full body is made: the picture or selfie it was made from isn't needed any more (its row goes with the tidy-up)
      if (j.kind === 'body' && j.inf_source) {
        F.deleteFiles(cfg, [`up/${j.inf_source}.jpg`]).catch((err) => console.warn(`[studio] an influencer's source picture: ${err.message}`));
      }
      return { state: 'done', step: 'save' };
    }
    let bytes = await F.fromFal(out.video, { timeoutMs: left(7000, 14_000) });
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
    bytes = aiTagged(bytes);
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
    const video = aiTagged(await joinParts(files, { timeoutMs: left(4000, 6000), run }));
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

// (2026-10-14) A meme's 5-second video, kept by the clock (ffmpeg is there): Gemini looks at the AI's video (as it was made)
// while ffmpeg puts it on its template's canvas with its words (drawn by us at the video's size: server/meme-render.js wordsPng)
// and the share mark where its words aren't (its row's mark_spot; server/inf-mark.js composeMemeVideo); its one copy, played and
// downloaded, carries the mark (so the share mark's clock leaves it alone: inf_mark_done). One that isn't family-friendly is
// never shown (its credits back); one ffmpeg can't do is a try (4 at most, like keeping any file); no ffmpeg here: it waits.
async function saveMemeVideo(cfg, j, F, { deadline, run }) {
  const id = j.id;
  const left = (reserve, most) => Math.max(1500, Math.min(most, deadline - Date.now() - reserve));
  try {
    const tpl = templateOf(j.meme);
    const L = checkLayers(j.layers);
    if (!tpl || !L.ok) {
      await fail(cfg, id, 'source', true);
      console.warn(`[studio] job ${id}: its meme template or its words aren't ones we draw (its credits back)`);
      return { state: 'failed', step: 'save' };
    }
    const M = await import('./inf-mark.js');
    if (!run && !await M.ffmpegBin()) {
      warnOnce('meme-ffmpeg', "a meme's video waits: ffmpeg isn't here (vercel.json's includeFiles for api/feed.js)");
      await waitTurn(cfg, id);
      return { state: 'saving', step: 'save' };
    }
    const out = outputOf('video', await falOutput(cfg, j.result_url, { timeoutMs: left(12_000, 5000) }));
    const raw = await F.fromFal(out.video, { max: MEME_SOURCE_MAX, timeoutMs: left(10_000, 9000) });
    if (!F.isMp4(raw)) throw new Error("files: its video isn't an MP4");
    const sharp = await F.loadSharp();
    const R = await import('./meme-render.js');
    const plan = M.memeVideoPlan(tpl);
    const words = await R.wordsPng(sharp, L.layers, tpl, plan.w, plan.h);
    const [v, made] = await Promise.all([
      checkVideo(cfg, raw),
      M.composeMemeVideo(sharp, raw, { plan, words, spot: isMarkSpot(j.mark_spot) ? j.mark_spot : 'tl', timeoutMs: left(3000, 12_000), run }),
    ]);
    if (!v.ok) {
      await fail(cfg, id, 'refused', true);
      console.warn(`[studio] job ${id}'s video wasn't family-friendly (${v.why}): not shown, its credits back`);
      return { state: 'failed', step: 'save' };
    }
    if (!v.checked) console.warn(`[studio] job ${id}'s video is too big to look at (${(raw.length / 1e6).toFixed(1)} MB): kept as it is`);
    const video = aiTagged(made);
    if (deadline - Date.now() < 2000) throw new Error('no time left to keep it');
    await F.putFile(cfg, videoPath(j), video, 'video/mp4', { timeoutMs: left(500, 9000) });
    await rpc(cfg, 'inf_job_done', { p_id: id, p_files: 0, p_bytes: video.length }, 'studio');
    await rpc(cfg, 'inf_mark_done', { p_job: id }, 'studio').catch((err) => console.warn(`[studio] job ${id}: its mark noted: ${err.message}`));
    console.log(`[studio] job ${id} (a meme's video) is done: ${(video.length / 1e6).toFixed(2)} MB`);
    return { state: 'done', step: 'save' };
  } catch (err) {
    if (err.why === 'no_ffmpeg') {
      warnOnce('meme-ffmpeg', `a meme's video waits: ${err.message}`);
      await waitTurn(cfg, id);
      return { state: 'saving', step: 'save' };
    }
    return saveFailed(cfg, j, err, { what: 'video' });
  }
}

// a part's, a join's or (2026-10-14) a meme video's keeping that didn't work: fal waiting, or a try (4 at most: then it can't be
// made, its credits back)
async function saveFailed(cfg, j, err, { part = null, join: joining = false, what = null } = {}) {
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
  const name = what || `part ${Number(part) + 1}`;
  if (err.tooBig || err.gone || tries + 1 >= JOBS.SAVE_TRIES) {
    await fail(cfg, id, err.tooBig ? 'too_big' : err.why === 'ai' ? 'check' : 'save', true);
    console.warn(`[studio] job ${id}'s ${joining ? 'parts couldn\'t be joined' : `${name} couldn't be kept`}: ${err.message}`);
    return { state: 'failed', step: joining ? 'join' : 'save' };
  }
  console.warn(`[studio] job ${id}'s ${joining ? 'join' : name}: ${err.message} (trying again)`);
  // a try counted (a join keeps no request: its tries are counted the same way, its part as it is)
  await setStep(cfg, id, { req: j.req, statusUrl: j.status_url, resultUrl: j.result_url, saving: !joining, tries: tries + 1 });
  return { state: 'saving', step: joining ? 'join' : 'save' };
}

// The clock (every minute, with the studio's: api/feed.js ?studio): the jobs whose turn it is, until its time is used; the
// tidy-up every half hour (uploads, influencers that couldn't be made, deleted ones: their files deleted).
// → { due, moved, done, failed, tidy?, cut? }
// `now` says which minute it is (the tests give it); the deadline is always the real clock's (Vercel stops a function at
// 25 s). Until 2026-10-10 the deadline was `now + 19 s`, so a test with another `now` ran out of time once the real clock
// passed it: Vercel's builds of AGI Studio's round 2 failed that way after 12:00 UTC.
// (2026-10-12, the video editor) a cut needs most of a minute's time (ffmpeg makes its pieces here): on even minutes the one
// whose turn it is (inf_cut_due) goes first, on odd minutes after the others, while there's time (its other pieces, and other
// people's cuts, as their turns come in the line)
export async function infClock(cfg, { now = Date.now(), deadline = Date.now() + 19_000, files = null, run = null } = {}) {
  const out = { due: 0, moved: 0, done: 0, failed: 0 };
  const tick = async (id) => {
    try {
      const r = await jobTick(cfg, id, { now: Date.now(), deadline, files, encode: true, run });
      if (r.state === 'started' || r.state === 'saving') out.moved += 1;
      if (r.state === 'done') out.done += 1;
      if (r.state === 'failed') out.failed += 1;
      return r;
    } catch (err) {
      console.warn(`[studio] job ${id}: ${err.message}`);
      return null;
    }
  };
  let cut = null;
  try { cut = await rpc(cfg, 'inf_cut_due', {}, 'studio'); } catch (err) {
    if (err?.code !== 'PGRST202') console.warn(`[studio] the video editor's next cut: ${err.message}`);
  }
  if (!ID.test(String(cut))) cut = null;
  const even = new Date(now).getUTCMinutes() % 2 === 0;
  if (cut && even) out.cut = (await tick(cut))?.state || 'error';
  const ids = await rpc(cfg, 'inf_job_due', { p_limit: 6 }, 'studio');
  out.due = Array.isArray(ids) ? ids.length : 0;
  for (const id of Array.isArray(ids) ? ids : []) {
    if (id === cut) continue;
    if (Date.now() > deadline - 5_000) break;
    await tick(id);
  }
  if (cut && !even && Date.now() <= deadline - 5_000) out.cut = (await tick(cut))?.state || 'error';
  if (new Date(now).getUTCMinutes() % 30 === 0 && Date.now() < deadline - 4000) {
    try { out.tidy = await tidy(cfg, { files }); } catch (err) { console.warn(`[studio] the studio app's tidy-up: ${err.message}`); }
  }
  return out;
}

// The tidy-up: the database forgets old uploads and influencers, and their files are deleted here; (round 4, phase 3) gift
// links past their days give their credits back (the database), and invites' rewards for any top-up not counted yet (a
// hiccup right after it) are counted, at most 100 each time; (2026-10-12) photos and videos their makers deleted a week ago
// go from the database, and their files are deleted here once more (they went at once, unless Storage didn't answer then)
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
  const gone = Array.isArray(t?.deleted) ? t.deleted : [];
  const names = gone.flatMap((d) => jobFiles({ id: d?.id, inf_id: d?.inf, kind: d?.kind }));
  if (names.length) deleted += await F.deleteFiles(cfg, names).catch(() => 0);
  let invites = 0;
  try { invites = (await (await import('./inf-gifts.js')).settleInvites(cfg, { limit: 100 })).settled; } catch (err) {
    if (err?.code !== 'PGRST202') console.warn(`[studio] invites' rewards (the clock's catch-up): ${err.message}`);
  }
  return { uploads: t?.uploads?.length || 0, infs: t?.infs?.length || 0, jobs: t?.jobs || 0, files: deleted, gifts: Number(t?.gifts) || 0, invites,
    creations: gone.length };
}
