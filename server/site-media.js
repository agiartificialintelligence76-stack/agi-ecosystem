// The owner's browser uploads straight to one isolated Storage bucket. Only this server
// signs destinations and confirms stored file metadata/signatures; no file passes through Vercel.
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { MEDIA_BUCKET, MEDIA_ORIGIN, MEDIA_PUBLIC_ROOT, MEDIA_MIME_TYPES, MEDIA_PATH, mediaPath } from '../src/owner/media-model.js';

const TWO_HOURS = 2 * 60 * 60 * 1000;
// New sb_secret keys belong only in apikey. Legacy service-role JWTs also use Bearer.
const headers = (cfg) => ({ apikey: cfg.supabaseKey, ...(cfg.supabaseKey.startsWith('eyJ') ? { Authorization: `Bearer ${cfg.supabaseKey}` } : {}) });
function refused(why, status = 400, error = 'refused') { const err = new Error(why); Object.assign(err, { media: true, status, error, why }); return err; }
const sign = (secret, use, value) => {
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
  const signature = createHmac('sha256', secret).update(`agi1-owner-media:${use}:${payload}`).digest('base64url');
  return `${payload}.${signature}`;
};
function readSigned(secret, use, token) {
  if (typeof token !== 'string' || token.length > 1400 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return null;
  const [payload, signature] = token.split('.');
  const expected = createHmac('sha256', secret).update(`agi1-owner-media:${use}:${payload}`).digest('base64url');
  const a = Buffer.from(signature), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return null; }
}
function uploadShape(data) {
  const type = typeof data?.m === 'string' && Object.hasOwn(MEDIA_MIME_TYPES, data.m) ? MEDIA_MIME_TYPES[data.m] : null;
  return data?.v === 1 && type && MEDIA_PATH.test(data.p || '') && data.p.endsWith(`.${type.extension}`) && Number.isSafeInteger(data.b) && data.b > 0 && data.b <= type.maxBytes;
}
function configured(cfg) {
  if (cfg.supabaseUrl !== MEDIA_ORIGIN || !cfg.supabaseKey) throw refused('The gallery upload storage is not configured yet.', 503, 'not_ready');
}
async function storage(cfg, suffix, init = {}) {
  let result;
  try {
    result = await fetch(`${MEDIA_ORIGIN}/storage/v1/${suffix}`, { ...init, headers: { ...headers(cfg), ...init.headers }, signal: AbortSignal.timeout(12_000), redirect: 'error' });
  } catch { throw refused('Storage could not be reached. Your gallery has not changed. Try again.', 503, 'busy'); }
  return result;
}
export async function startMediaUpload(cfg, body, wallet, now = Date.now()) {
  configured(cfg);
  const type = typeof body.mime === 'string' && Object.hasOwn(MEDIA_MIME_TYPES, body.mime) ? MEDIA_MIME_TYPES[body.mime] : null;
  if (!type) throw refused('Choose a JPEG, PNG, WebP, GIF, MP4 or WebM file.');
  if (!Number.isSafeInteger(body.bytes) || body.bytes <= 0 || body.bytes > type.maxBytes) throw refused(type.family === 'image' ? 'Images can be up to 20 MB.' : 'Videos can be up to 50 MB.');
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 240) throw refused('Choose a file with a short name.');
  const name = body.name.split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f]/g, '').slice(0, 160);
  const uuid = randomUUID(), path = `${uuid}.${type.extension}`;
  const result = await storage(cfg, `object/upload/sign/${MEDIA_BUCKET}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-upsert': 'false' }, body: '{}' });
  if (!result.ok) throw refused('The upload could not start. Check that the gallery storage bucket is ready, then try again.', 503, 'not_ready');
  let data; try { data = await result.json(); } catch { throw refused('Storage returned an incomplete upload link. Try again.', 503, 'busy'); }
  let uploadUrl;
  try {
    const value = data.url;
    if (typeof value !== 'string') throw new Error('missing');
    uploadUrl = new URL(value.startsWith('/object/') ? `${MEDIA_ORIGIN}/storage/v1${value}` : value, `${MEDIA_ORIGIN}/storage/v1/`);
    if (uploadUrl.origin !== MEDIA_ORIGIN || uploadUrl.pathname !== `/storage/v1/object/upload/sign/${MEDIA_BUCKET}/${path}` || uploadUrl.username || uploadUrl.password || uploadUrl.hash || [...uploadUrl.searchParams.keys()].some((k) => k !== 'token') || !/^[A-Za-z0-9_.-]{8,6000}$/.test(uploadUrl.searchParams.get('token') || '')) throw new Error('wrong destination');
  } catch { throw refused('Storage returned an invalid upload link. Try again.', 503, 'busy'); }
  const ticket = sign(cfg.passSecret, 'upload', { v: 1, p: path, m: body.mime, b: body.bytes, n: name, w: wallet, e: now + TWO_HOURS });
  return { ok: true, id: `upload-${uuid}`, uploadUrl: uploadUrl.href, path, publicUrl: `${MEDIA_PUBLIC_ROOT}${path}`, ticket };
}

export function matchesMediaHeader(mime, bytes) {
  const b = Buffer.from(bytes);
  if (mime === 'image/jpeg') return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (mime === 'image/png') return b.length >= 24 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && b.toString('ascii', 12, 16) === 'IHDR' && b.readUInt32BE(16) > 0 && b.readUInt32BE(20) > 0;
  if (mime === 'image/webp') return b.length >= 16 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' && ['VP8 ', 'VP8L', 'VP8X'].includes(b.toString('ascii', 12, 16));
  if (mime === 'image/gif') return b.length >= 10 && ['GIF87a', 'GIF89a'].includes(b.toString('ascii', 0, 6)) && b.readUInt16LE(6) > 0 && b.readUInt16LE(8) > 0;
  if (mime === 'video/mp4') {
    if (b.length < 16 || b.toString('ascii', 4, 8) !== 'ftyp' || b.readUInt32BE(0) < 16 || b.readUInt32BE(0) > 4096) return false;
    const brands = ['isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'M4V ', 'dash', 'MSNV'];
    for (let at = 8; at + 4 <= Math.min(b.length, b.readUInt32BE(0)); at += 4) if (at !== 12 && brands.includes(b.toString('ascii', at, at + 4))) return true;
    return false;
  }
  if (mime === 'video/webm') return b.length >= 12 && b.subarray(0, 4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])) && b.subarray(0, 4096).includes(Buffer.from('webm'));
  return false;
}
async function readHeader(response, max = 4096) {
  if (!response.body?.getReader) return Buffer.alloc(0);
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  try {
    while (size < max) {
      const { done, value } = await reader.read();
      if (done) break;
      const part = value.subarray(0, max - size); chunks.push(Buffer.from(part)); size += part.length;
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks, size);
}
export async function finishMediaUpload(cfg, body, wallet, now = Date.now()) {
  configured(cfg);
  const data = readSigned(cfg.passSecret, 'upload', body.ticket);
  if (!uploadShape(data) || data.w !== wallet || !Number.isSafeInteger(data.e) || data.e <= now || data.e > now + TWO_HOURS || typeof data.n !== 'string') throw refused('This upload confirmation expired or is invalid. Start the upload again.', 400, 'invalid_upload');
  const metaResponse = await storage(cfg, `object/info/${MEDIA_BUCKET}/${data.p}`, { method: 'GET' });
  if (!metaResponse.ok) throw refused('The file is not fully uploaded yet. Finish the upload and try again.', 409, 'upload_missing');
  let meta; try { meta = await metaResponse.json(); } catch { throw refused('Storage could not confirm the file. Try again.', 503, 'busy'); }
  // object/info's top-level fields come from the stored object; `metadata` is user metadata.
  const size = meta.size;
  const mime = typeof meta.content_type === 'string' ? meta.content_type.split(';')[0].toLowerCase() : '';
  const encoding = meta.content_encoding ?? '';
  if (!Number.isSafeInteger(size) || size !== data.b || mime !== data.m || (encoding && encoding !== 'identity') || meta.name !== data.p || meta.bucket_id !== MEDIA_BUCKET) throw refused('The uploaded file size or type does not match. Upload the file again.', 400, 'upload_mismatch');
  const response = await storage(cfg, `object/${MEDIA_BUCKET}/${data.p}`, { method: 'GET', headers: { Range: 'bytes=0-4095' } });
  if (!response.ok) throw refused('Storage could not check the file. Try again.', 503, 'busy');
  if (response.headers.get('content-encoding') && response.headers.get('content-encoding') !== 'identity') { await response.body?.cancel(); throw refused('The uploaded file uses an unsupported encoding. Upload the original image or video.', 400, 'upload_mismatch'); }
  const bytes = await readHeader(response);
  if (!matchesMediaHeader(data.m, bytes)) throw refused('This file does not match its image or video format. Export a JPEG, PNG, WebP, GIF, MP4 or WebM and upload it again.', 400, 'upload_mismatch');
  const verified = sign(cfg.passSecret, 'verified', { v: 1, p: data.p, m: data.m, b: data.b });
  const image = MEDIA_MIME_TYPES[data.m].family === 'image';
  return { ok: true, media: { id: `upload-${data.p.slice(0, 36)}`, custom: true, kind: image ? 'image' : 'video', title: data.n.replace(/\.[^.]+$/, '') || 'New upload', note: '', src: `${MEDIA_PUBLIC_ROOT}${data.p}`, thumb: '', secs: 0, hidden: false, proof: verified } };
}

// A confirmation persists with private content/history. Public copies never contain it.
// Its signature binds immutable UUID path, family and exact size; direct uploads cannot overwrite.
export function verifyMediaProofs(cfg, memes = [], previous = []) {
  const prior = new Map(previous.filter((m) => m.custom).map((m) => [m.id, m]));
  for (const media of memes) {
    if (!media.custom) continue;
    const existing = prior.get(media.id);
    const data = readSigned(cfg.passSecret, 'verified', media.proof);
    const unchanged = existing?.src === media.src && (existing.kind === 'image') === (media.kind === 'image');
    if (!unchanged && (!uploadShape(data) || data.p !== mediaPath(media.src) || `upload-${data.p.slice(0, 36)}` !== media.id || (MEDIA_MIME_TYPES[data.m].family === 'image') !== (media.kind === 'image'))) return { ok: false, why: 'Finish uploading each new gallery file before publishing.' };
    if (media.thumb) {
      const poster = readSigned(cfg.passSecret, 'verified', media.thumb === media.src ? media.proof : media.thumbProof);
      const sameCover = existing?.thumb === media.thumb || (unchanged && media.kind === 'image' && media.thumb === media.src);
      if (!sameCover && (!uploadShape(poster) || poster.p !== mediaPath(media.thumb) || MEDIA_MIME_TYPES[poster.m].family !== 'image')) return { ok: false, why: 'Finish uploading the cover image before publishing.' };
    }
  }
  return { ok: true };
}
