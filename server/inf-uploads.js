// AGI Studio (2026-10-10): what people upload, and a video's poster. Vercel takes at most 4.5 MB a request, so files come
// to our server as their own requests (POST /api/launch?inf-up=<ticket>&part=<n>, the file's bytes as the body), each with
// the ticket our server gave when the upload was opened (signed with PASS_SECRET: this upload, this wallet, 30 minutes).
//   • A character's picture ("From a picture") or a selfie ("Use my face": a live camera picture, 18+, and their consent):
//     one request (the page makes it at most 1536 px first). Made a plain JPEG here (no EXIF, no location), then looked at by
//     Gemini (server/inf-ai.js) BEFORE it's kept: a picture that doesn't pass is never stored. Kept privately until its
//     influencer is made (then deleted: supabase/influencers.sql inf_tidy).
//   • A clip to copy the moves of (2 to 10 s, an MP4 or MOV, 30 MB at most): in parts of 3.5 MB, then 3 small frames of it
//     the page took, then "done": the parts are put together into one MP4 (its length read from its own header), the frames
//     looked at by Gemini, and the parts and frames deleted. The trend video made from it is looked at again before it's shown.
//   • A video's poster (a frame its page took, for Explore's tiles): looked at next to the influencer's own look first.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { rpc } from './limits.js';
import { loadSharp, putFile, getFile, deleteFiles, listFiles } from './studio-files.js';
import { checkSelfie, checkArt, checkFrames, checkPoster } from './inf-ai.js';
import { CLIP, PICTURE } from '../src/studio/rules.js';

export const UPLOAD = {
  PER_DAY: 30,                     // uploads one wallet may start a day
  TICKET_MS: 30 * 60_000,
  POSTER_MS: 60 * 60_000,
  MAX_PARTS: Math.ceil(CLIP.MAX_BYTES / CLIP.PART),
  FRAME_PX: 512,
  POSTER_PX: 480,
};
const MAX_PIXELS = 40_000_000;
export const UPLOAD_ID = /^[A-Za-z0-9_-]{22}$/;

// ---------- tickets ----------
const b64url = (data) => Buffer.from(data).toString('base64url');
const sig = (secret, what, payload) => createHmac('sha256', String(secret)).update(`inf-${what}:${payload}`).digest('base64url');
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
export function makeTicket(secret, what, data, now = Date.now(), ttlMs = UPLOAD.TICKET_MS) {
  const payload = b64url(JSON.stringify({ ...data, exp: now + ttlMs }));
  return `${payload}.${sig(secret, what, payload)}`;
}
export function readTicket(secret, what, ticket, now = Date.now()) {
  if (typeof ticket !== 'string' || ticket.length > 600) return null;
  const [payload, s, extra] = ticket.split('.');
  if (!payload || !s || extra !== undefined || !same(s, sig(secret, what, payload))) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return d && typeof d.exp === 'number' && d.exp > now ? d : null;
  } catch {
    return null;
  }
}

// ---------- an MP4's own header ----------
// Its length in seconds, from its movie header ("moov" → "mvhd"), wherever it is in the file. → seconds, or null
export function mp4Seconds(b) {
  if (!Buffer.isBuffer(b) || b.length < 16) return null;
  const find = (start, end, type) => {
    let i = start;
    while (i + 8 <= end) {
      let size = b.readUInt32BE(i);
      const t = b.toString('latin1', i + 4, i + 8);
      let head = 8;
      if (size === 1) {
        if (i + 16 > end) return null;
        size = Number(b.readBigUInt64BE(i + 8));
        head = 16;
      } else if (size === 0) size = end - i;
      if (!Number.isSafeInteger(size) || size < head || i + size > end) return null;
      if (t === type) return { start: i + head, end: i + size };
      i += size;
    }
    return null;
  };
  if (b.toString('latin1', 4, 8) !== 'ftyp') return null;
  const moov = find(0, b.length, 'moov');
  const mvhd = moov && find(moov.start, moov.end, 'mvhd');
  if (!mvhd) return null;
  const v1 = b[mvhd.start] === 1;
  if (mvhd.start + (v1 ? 32 : 20) > mvhd.end) return null;
  const scale = b.readUInt32BE(mvhd.start + (v1 ? 20 : 12));
  const length = v1 ? Number(b.readBigUInt64BE(mvhd.start + 24)) : b.readUInt32BE(mvhd.start + 16);
  if (!scale || !Number.isFinite(length)) return null;
  return length / scale;
}

// ---------- a picture, made plain ----------
// Any JPEG, PNG or WebP → a JPEG at most `px` on its longest side, turned upright, without its metadata (sharp drops EXIF and
// location). → a Buffer, or null when it isn't a picture we read
export async function plainJpeg(bytes, { px = PICTURE.MAX_PX, quality = 88, sharp = null } = {}) {
  const s = sharp || await loadSharp();
  const meta = await s(bytes, { limitInputPixels: MAX_PIXELS }).metadata().catch(() => null);
  if (!meta || !meta.width || !meta.height || !['jpeg', 'png', 'webp'].includes(meta.format)) return null;
  return s(bytes, { limitInputPixels: MAX_PIXELS }).rotate().resize(px, px, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' }).jpeg({ quality }).toBuffer().catch(() => null);
}

// ---------- 1: opening an upload ----------
// → { ok: true, id, ticket, part, parts } or { ok: false, why: 'kind' | 'size' | 'consent' | 'faces_off' | 'too_many' | 'busy' }
export async function openUpload(cfg, { code, kind, bytes, consent, id }) {
  if (!['picture', 'face', 'clip'].includes(kind)) return { ok: false, why: 'kind' };
  if (kind === 'face' && !cfg.infFaces) return { ok: false, why: 'faces_off' };
  if (kind === 'face' && consent !== true) return { ok: false, why: 'consent' };
  const size = Number(bytes);
  const most = kind === 'clip' ? CLIP.MAX_BYTES : PICTURE.MAX_BYTES;
  if (!Number.isSafeInteger(size) || size < 1000 || size > most) return { ok: false, why: 'size' };
  const parts = kind === 'clip' ? Math.ceil(size / CLIP.PART) : 1;
  const r = await rpc(cfg, 'inf_upload_open', { p_id: id, p_wallet: code, p_kind: kind, p_per_day: UPLOAD.PER_DAY }, 'studio');
  if (r?.ok !== true) return { ok: false, why: r?.why === 'too_many' ? 'too_many' : 'busy' };
  const ticket = makeTicket(cfg.passSecret, 'up', { u: id, w: code, k: kind, b: size, p: parts });
  return { ok: true, id, ticket, part: CLIP.PART, parts };
}

// ---------- 2: its file (or a part of it, or one of a clip's frames) ----------
// t: the ticket read · part / frame: which one · body: its bytes. → { status, body } for the answer
export async function receive(cfg, t, { part = null, frame = null, body }) {
  const up = await rpc(cfg, 'inf_upload_get', { p_id: t.u }, 'studio');
  if (!up || up.wallet_code !== t.w || up.kind !== t.k) return { status: 404, body: { error: 'gone' } };
  if (up.status !== 'open') return { status: 409, body: { error: 'done', status: up.status } };
  if (t.k === 'picture' || t.k === 'face') {
    if (part !== 0 || frame !== null) return { status: 400, body: { error: 'bad_request' } };
    if (body.length > PICTURE.MAX_BYTES) return { status: 413, body: { error: 'size' } };
    const jpeg = await plainJpeg(body);
    if (!jpeg) {
      await rpc(cfg, 'inf_upload_set', { p_id: t.u, p_status: 'refused', p_why: 'picture', p_seconds: null }, 'studio');
      return { status: 422, body: { error: 'picture' } };
    }
    let verdict;
    try { verdict = t.k === 'face' ? await checkSelfie(cfg, jpeg) : await checkArt(cfg, jpeg); } catch (err) {
      console.warn(`[studio] an upload couldn't be looked at: ${err.message}`);
      return { status: 503, body: { error: 'ai' } };                    // nothing kept: the page sends it again
    }
    if (!verdict.ok) {
      await rpc(cfg, 'inf_upload_set', { p_id: t.u, p_status: 'refused', p_why: verdict.why, p_seconds: null }, 'studio');
      return { status: 422, body: { error: 'refused', why: verdict.why } };
    }
    await putFile(cfg, `up/${t.u}.jpg`, jpeg, 'image/jpeg', { timeoutMs: 9000 });
    await rpc(cfg, 'inf_upload_set', { p_id: t.u, p_status: 'ok', p_why: null, p_seconds: null }, 'studio');
    return { status: 200, body: { ok: true, id: t.u, status: 'ok' } };
  }
  // a clip: its parts, then its frames
  if (frame !== null) {
    if (!(Number.isInteger(frame) && frame >= 0 && frame < CLIP.FRAMES) || part !== null) return { status: 400, body: { error: 'bad_request' } };
    if (body.length > CLIP.FRAME_BYTES) return { status: 413, body: { error: 'size' } };
    const jpeg = await plainJpeg(body, { px: UPLOAD.FRAME_PX, quality: 82 });
    if (!jpeg) return { status: 422, body: { error: 'picture' } };
    await putFile(cfg, `up/${t.u}/f${frame}.jpg`, jpeg, 'image/jpeg', { timeoutMs: 8000 });
    return { status: 200, body: { ok: true } };
  }
  if (!(Number.isInteger(part) && part >= 0 && part < t.p)) return { status: 400, body: { error: 'bad_request' } };
  const want = part < t.p - 1 ? CLIP.PART : t.b - CLIP.PART * (t.p - 1);
  if (body.length !== want) return { status: 400, body: { error: 'size' } };
  await putFile(cfg, `up/${t.u}/${part}.part`, body, 'application/octet-stream', { timeoutMs: 12_000 });
  return { status: 200, body: { ok: true } };
}

// ---------- 3: a clip, put together and looked at ----------
// → { ok: true, seconds } or { ok: false, why: 'gone' | 'done' | 'parts' | 'video' | 'length' | 'frames' | the frames' check
// ('none', 'minor', 'sexual', …) } · throws (why 'ai') when Gemini can't say (nothing is decided: the page asks again)
export async function finishClip(cfg, t) {
  const up = await rpc(cfg, 'inf_upload_get', { p_id: t.u }, 'studio');
  if (!up || up.wallet_code !== t.w || up.kind !== 'clip') return { ok: false, why: 'gone' };
  if (up.status !== 'open') return up.status === 'ok' ? { ok: true, seconds: Number(up.seconds) || null } : { ok: false, why: 'done' };
  const refuse = async (why) => {
    await rpc(cfg, 'inf_upload_set', { p_id: t.u, p_status: 'refused', p_why: why, p_seconds: null }, 'studio');
    await removeUpload(cfg, t.u, 'clip').catch((err) => console.warn(`[studio] a refused clip's files: ${err.message}`));
    return { ok: false, why };
  };
  const frames = (await Promise.all(Array.from({ length: CLIP.FRAMES }, (_, i) => getFile(cfg, `up/${t.u}/f${i}.jpg`, { max: CLIP.FRAME_BYTES * 2 }))))
    .filter(Boolean);
  if (!frames.length) return { ok: false, why: 'frames' };
  const parts = await Promise.all(Array.from({ length: t.p }, (_, i) => getFile(cfg, `up/${t.u}/${i}.part`, { max: CLIP.PART + 1000, timeoutMs: 9000 })));
  if (parts.some((p) => !p)) return { ok: false, why: 'parts' };
  const video = Buffer.concat(parts);
  if (video.length !== t.b) return refuse('parts');
  const seconds = mp4Seconds(video);
  if (seconds === null) return refuse('video');
  if (seconds < CLIP.MIN_S - 0.05 || seconds > CLIP.MAX_S + 0.5) return refuse('length');
  const verdict = await checkFrames(cfg, frames);
  if (!verdict.ok) return refuse(verdict.why);
  await putFile(cfg, `up/${t.u}.mp4`, video, 'video/mp4', { timeoutMs: 14_000 });
  await rpc(cfg, 'inf_upload_set', { p_id: t.u, p_status: 'ok', p_why: null, p_seconds: Math.round(seconds * 100) / 100 }, 'studio');
  // its parts and frames aren't needed any more (the clip itself is kept: a day for its trend videos, then the tidy-up)
  await deleteFiles(cfg, [...Array.from({ length: t.p }, (_, i) => `up/${t.u}/${i}.part`), ...Array.from({ length: CLIP.FRAMES }, (_, i) => `up/${t.u}/f${i}.jpg`)])
    .catch((err) => console.warn(`[studio] a clip's parts and frames: ${err.message}`));
  return { ok: true, seconds: Math.round(seconds * 10) / 10 };
}

// An upload's files deleted (its picture, its video, its parts and frames)
export async function removeUpload(cfg, id, kind) {
  if (!UPLOAD_ID.test(String(id))) return 0;
  const names = kind === 'clip' ? [`up/${id}.mp4`, ...await listFiles(cfg, `up/${id}`).catch(() => [])] : [`up/${id}.jpg`];
  return deleteFiles(cfg, names);
}

// ---------- a video's poster ----------
// t: its ticket ({ j: the job, o: its folder (its influencer's id, or "trends"), l: the look to compare it with, when it's an
// influencer's }). → { status, body }
export async function receivePoster(cfg, t, body) {
  if (body.length > PICTURE.POSTER_BYTES) return { status: 413, body: { error: 'size' } };
  const s = await loadSharp();
  const jpeg = await plainJpeg(body, { px: UPLOAD.POSTER_PX, quality: 84, sharp: s });
  if (!jpeg) return { status: 422, body: { error: 'picture' } };
  if (t.l) {
    const lookJpeg = await getFile(cfg, t.l, { max: PICTURE.MAX_BYTES });
    if (!lookJpeg) return { status: 404, body: { error: 'gone' } };
    let verdict;
    try { verdict = await checkPoster(cfg, jpeg, lookJpeg); } catch (err) {
      console.warn(`[studio] a poster couldn't be looked at: ${err.message}`);
      return { status: 503, body: { error: 'ai' } };
    }
    if (!verdict.ok) return { status: 422, body: { error: 'refused', why: verdict.why } };
  }
  const webp = await s(jpeg).webp({ quality: 80 }).toBuffer();
  await putFile(cfg, `${t.o === 'trends' ? 'trends' : `inf/${t.o}`}/${t.j}.poster.webp`, webp, 'image/webp', { timeoutMs: 8000 });
  const ok = await rpc(cfg, 'inf_poster', { p_job: t.j }, 'studio');
  return ok ? { status: 200, body: { ok: true } } : { status: 404, body: { error: 'gone' } };
}
