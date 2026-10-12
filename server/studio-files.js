// AGI-1's 3D character studio (2026-10-10): a character's files. Meshy keeps what it makes for 3 days only, so once a
// character is made our server reads its file from Meshy, makes it small, and keeps it in Supabase Storage (a private
// bucket, supabase/studio.sql); the pages get it from our own address (api/launch.js ?studio-file=…), which Vercel's CDN
// keeps a day. Vercel answers at most 4.5 MB, so a character's model is kept at 4 MB at most:
//   • its textures 1024 px at most (512 if it's still too big), as JPEG (PNG when a texture has see-through parts): glTF's
//     own formats, so the file opens anywhere people take it (a 3D stream, Blender…), never only in a browser; its moves
//     resampled (the same motion, fewer keys); what nothing uses pruned, copies merged (gltf-transform, with sharp). Its
//     geometry, bones and moves stay as made.
//   • its picture (the refine's): a 384 px WebP for the pages, and a 1024 px PNG to download (for a coin, say).
// And (2026-10-10) its videos: the MP4 an AI video service made (server/studio-video.js), read from that service's own media
// address and kept as it is in the same bucket (videos/<id>.mp4). A video can be bigger than Vercel answers, so the pages
// get it from the bucket itself, by a short-lived signed address our server makes (signedUrl()).
import { readLimited } from './coins.js';

export const BUCKET = 'agi1-characters';
export const GLB_MAX = 4_000_000;            // a character's model, at most (Vercel answers at most 4.5 MB)
export const VIDEO_MAX = 40_000_000;         // a video, at most (the bucket's limit: 40 MB a file)
const VIDEO_MIN = 10_000;
const SOURCE_MAX = 80_000_000;               // the most read from Meshy for one file
const PICTURE_MAX = 20_000_000;
const MAX_PIXELS = 40_000_000;               // a picture bigger than this isn't one we read

// sharp (an npm package: pictures), loaded only here
let sharpLoaded = null;
export const loadSharp = async () => (sharpLoaded ??= (await import('sharp')).default);

// A file Meshy made, read from its address (only Meshy's own: https, *.meshy.ai). → a Buffer, or throws
export async function fromMeshy(url, { max = SOURCE_MAX, timeoutMs = 12_000 } = {}) {
  let u;
  try { u = new URL(url); } catch { throw new Error('files: not an address'); }
  if (u.protocol !== 'https:' || !(u.hostname === 'meshy.ai' || u.hostname.endsWith('.meshy.ai')) || u.username || u.password || u.port) {
    throw new Error(`files: not Meshy's address (${u.hostname})`);
  }
  let res;
  try {
    res = await fetch(u, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    throw new Error(`files: Meshy's file ${err.name === 'TimeoutError' || err.name === 'AbortError' ? 'took too long' : 'is out of reach'}`);
  }
  if (!res.ok) throw Object.assign(new Error(`files: Meshy's file HTTP ${res.status}`), { gone: res.status === 403 || res.status === 404 || res.status === 410 });
  const bytes = await readLimited(res, max);
  if (!bytes) throw new Error('files: Meshy\'s file is too big');
  return bytes;
}

// A GLB's first bytes ("glTF", version 2)
export const isGlb = (b) => b?.length > 20 && b.readUInt32LE(0) === 0x46546c67 && b.readUInt32LE(4) === 2;
// An MP4's first box ("ftyp", within its first bytes)
export const isMp4 = (b) => b?.length >= VIDEO_MIN && b.toString('latin1', 4, 8) === 'ftyp';

// A video the video service made, read from its own media address (only fal's: https, fal.media or *.fal.media, or its
// files on Google's storage, storage.googleapis.com/falserverless/…). → a Buffer, or throws (tooBig when it is)
export async function fromFal(url, { max = VIDEO_MAX, timeoutMs = 12_000 } = {}) {
  let u;
  try { u = new URL(url); } catch { throw new Error('files: not an address'); }
  const falMedia = u.hostname === 'fal.media' || u.hostname.endsWith('.fal.media');
  const falStorage = u.hostname === 'storage.googleapis.com' && u.pathname.startsWith('/falserverless/');
  if (u.protocol !== 'https:' || !(falMedia || falStorage) || u.username || u.password || u.port) {
    throw new Error(`files: not the video service's address (${u.hostname})`);
  }
  let res;
  try {
    res = await fetch(u, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    throw new Error(`files: its video ${err.name === 'TimeoutError' || err.name === 'AbortError' ? 'took too long' : 'is out of reach'}`);
  }
  if (!res.ok) throw Object.assign(new Error(`files: its video HTTP ${res.status}`), { gone: res.status === 403 || res.status === 404 || res.status === 410 });
  const bytes = await readLimited(res, max);
  if (!bytes) throw Object.assign(new Error(`files: its video is over ${(max / 1e6).toFixed(0)} MB`), { tooBig: true });
  return bytes;
}

// A character's model, made small. → { bytes, clips (its moves' names in the file), skins, triangles, size (texture px) }
// Throws when it isn't a GLB with bones and moves, or can't be made small enough.
export async function smallGlb(source, { sharp = null, max = GLB_MAX } = {}) {
  if (!isGlb(source)) throw new Error("files: Meshy's model isn't a GLB");
  const [{ NodeIO }, { ALL_EXTENSIONS }, { dedup, prune, resample, compressTexture }] = await Promise.all([
    import('@gltf-transform/core'), import('@gltf-transform/extensions'), import('@gltf-transform/functions'),
  ]);
  const encoder = sharp || await loadSharp();
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  let last = null;
  for (const size of [1024, 512]) {
    const doc = await io.readBinary(new Uint8Array(source));
    const root = doc.getRoot();
    const clips = root.listAnimations().map((a) => a.getName());
    const skins = root.listSkins().length;
    if (!skins) throw new Error('files: the model has no bones');
    if (!clips.length) throw new Error('files: the model has no moves');
    await doc.transform(dedup(), resample(), prune({ keepAttributes: true }));
    for (const texture of root.listTextures()) {
      const image = texture.getImage();
      if (!image) continue;
      const opaque = await encoder(Buffer.from(image), { limitInputPixels: MAX_PIXELS }).stats().then((st) => st.isOpaque, () => false);
      await compressTexture(texture, { encoder, targetFormat: opaque ? 'jpeg' : 'png', resize: [size, size], quality: opaque ? 88 : null,
        chromaSubsampling: '4:4:4' });
    }
    const bytes = Buffer.from(await io.writeBinary(doc));
    let triangles = 0;
    for (const mesh of root.listMeshes()) {
      for (const p of mesh.listPrimitives()) {
        const idx = p.getIndices(), pos = p.getAttribute('POSITION');
        triangles += Math.floor((idx ? idx.getCount() : pos ? pos.getCount() : 0) / 3);
      }
    }
    last = { bytes, clips, skins, triangles, size };
    if (bytes.length <= max) return last;
  }
  throw Object.assign(new Error(`files: the model is still ${(last.bytes.length / 1e6).toFixed(1)} MB made small (at most ${(max / 1e6).toFixed(1)})`), { tooBig: true });
}

// Its picture: a 384 px WebP for the pages, and a 1024 px PNG to download. → { webp, png } (Buffers)
export async function pictures(source, { sharp = null } = {}) {
  const s = sharp || await loadSharp();
  const meta = await s(source, { limitInputPixels: MAX_PIXELS }).metadata().catch(() => null);
  if (!meta || !meta.width || !meta.height || !['png', 'jpeg', 'webp'].includes(meta.format)) throw new Error("files: the character's picture isn't one");
  const fit = (px) => s(source, { limitInputPixels: MAX_PIXELS }).rotate().resize(px, px, { fit: 'inside', withoutEnlargement: true });
  const [webp, png] = await Promise.all([fit(384).webp({ quality: 82, alphaQuality: 90 }).toBuffer(), fit(1024).png({ compressionLevel: 9, palette: false }).toBuffer()]);
  return { webp, png };
}
export const PICTURE_SOURCE_MAX = PICTURE_MAX;

// ---------- Supabase Storage (the private bucket) ----------
const storageUrl = (cfg, path) => `${cfg.supabaseUrl}/storage/v1/object/${path}`;
const headers = (cfg) => ({ Authorization: `Bearer ${cfg.supabaseKey}`, apikey: cfg.supabaseKey });
// Its files' names: a character's (<id>.glb|webp|png), a video's (videos/<id>.mp4), and since 2026-10-10 AGI Studio's
// (server/influencer.js): an influencer's pictures, videos and posters (inf/<influencer>/<job>-<n>.jpg|webp,
// inf/<influencer>/<job>.mp4, inf/<influencer>/<job>.poster.webp; round 2: a video's copy with the share mark,
// inf/<influencer>/<job>.dl.mp4), the owner's trend clips (trends/<job>.mp4 and .poster.webp) and example pictures (round 2:
// examples/<job>.webp), and what people upload (up/<upload>.jpg, up/<upload>.mp4, and a clip's parts and frames on the way:
// up/<upload>/<n>.part, up/<upload>/f<n>.jpg). (Round 4, phase 4: an HD or Ultra photo's full-size download,
// inf/<influencer>/<job>-<n>.hd.jpg, and a long video's parts and their last frames, inf/<influencer>/<job>.p<n>.mp4 and
// .f<n>.jpg: missing here until 2026-10-11, so Storage refused them and those jobs couldn't be kept; server/inf-jobs.js's
// names are all checked against this one by tests/influencer.test.js since); and (2026-10-12) a video editor's cut's words and
// stickers, inf/<influencer>/<job>.layer.png (its pieces are its .p<n>.mp4)
const ID = '[A-Za-z0-9_-]{22}';
export const NAME = new RegExp(`^(?:${ID}\\.(?:glb|webp|png)|videos/${ID}\\.mp4|inf/${ID}/${ID}(?:-[0-3]\\.(?:jpg|webp|hd\\.jpg)|\\.mp4|\\.dl\\.mp4|\\.poster\\.webp|\\.layer\\.png|\\.[pf][0-3]\\.(?:mp4|jpg))`
  + `|trends/${ID}(?:\\.mp4|\\.poster\\.webp)|examples/${ID}\\.webp|up/${ID}(?:\\.(?:jpg|mp4)|/(?:[0-9]{1,2}\\.part|f[0-9]\\.jpg)))$`);

// One of a character's files, kept (or replaced). Throws when Storage says no.
export async function putFile(cfg, name, bytes, type, { timeoutMs = 10_000 } = {}) {
  if (!NAME.test(name)) throw new Error('storage: a bad file name');
  let res;
  try {
    res = await fetch(storageUrl(cfg, `${BUCKET}/${name}`), {
      method: 'POST',
      headers: { ...headers(cfg), 'Content-Type': type, 'x-upsert': 'true', 'cache-control': 'max-age=31536000' },
      body: bytes,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new Error(`storage: ${err.name === 'TimeoutError' || err.name === 'AbortError' ? 'no answer in time' : 'out of reach'}`);
  }
  if (!res.ok) {
    const text = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 160);
    throw new Error(`storage HTTP ${res.status}${text ? `: ${text}` : ''}${/bucket not found|Bucket not found/i.test(text) ? ' (run supabase/studio.sql: it makes the bucket)' : ''}`);
  }
}

// A short-lived signed address for one of its files (a video: the pages play it from the bucket itself, and download it
// with its own name). → an https address on the Supabase project's own host · throws when Storage says no
export async function signedUrl(cfg, name, { expiresIn = 6 * 3600, download = null, timeoutMs = 6000 } = {}) {
  if (!NAME.test(name)) throw new Error('storage: a bad file name');
  let res;
  try {
    res = await fetch(`${cfg.supabaseUrl}/storage/v1/object/sign/${BUCKET}/${name}`, {
      method: 'POST',
      headers: { ...headers(cfg), 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new Error(`storage: ${err.name === 'TimeoutError' || err.name === 'AbortError' ? 'no answer in time' : 'out of reach'}`);
  }
  const text = await res.text().catch(() => '');
  if (res.status === 400 || res.status === 404) {
    if (/not.?found/i.test(text) || res.status === 404) return null;
  }
  if (!res.ok) throw new Error(`storage HTTP ${res.status}`);
  let path;
  try { path = JSON.parse(text)?.signedURL; } catch { /* below */ }
  if (typeof path !== 'string' || !/^\/object\/sign\/[A-Za-z0-9_./-]+\?token=[A-Za-z0-9._-]+$/.test(path)) throw new Error('storage: no signed address in its answer');
  const tail = download ? `&download=${encodeURIComponent(download)}` : '';
  return `${cfg.supabaseUrl}/storage/v1${path}${tail}`;
}

// A video, played from our own address (2026-10-10; the page's CSP stays as it is: no other site's media): Vercel answers at
// most 4.5 MB, so the player gets it in parts of at most PART bytes, as it asks for them (a "Range" request: every browser's
// player asks that way, and Safari's only plays what's served so). → the part asked for, at most PART bytes from its start:
// { start, end } · 'bad' (a range it can't be) · null (no range asked)
export const PART = 4_000_000;
export function byteRange(header, total) {
  if (header === null || header === undefined || header === '') return null;
  const m = /^bytes=(\d{0,15})-(\d{0,15})(?:\s*,.*)?$/.exec(String(header).trim());
  if (!m || (m[1] === '' && m[2] === '') || !(Number.isSafeInteger(total) && total > 0)) return 'bad';
  let start, end;
  if (m[1] === '') {
    const suffix = Number(m[2]);
    if (!(suffix > 0)) return 'bad';
    start = Math.max(0, total - suffix);
    end = total - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? total - 1 : Math.min(Number(m[2]), total - 1);
  }
  if (start >= total || end < start) return 'bad';
  return { start, end: Math.min(end, start + PART - 1) };
}

// The first n bytes of an answer, the rest never read
async function firstBytes(res, n) {
  const reader = res.body.getReader();
  const parts = [];
  let got = 0;
  try {
    while (got < n) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(Buffer.from(value));
      got += value.length;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return Buffer.concat(parts).subarray(0, n);
}

// One part of a file in the bucket (Storage serves ranges; if it ever sends the whole file instead, only what's needed is
// read). → a Buffer of exactly end - start + 1 bytes, or null when it isn't there · throws when Storage says no
export async function getRange(cfg, name, { start, end, timeoutMs = 9000 }) {
  if (!NAME.test(name) || !(Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && end >= start && end - start < PART)) {
    throw new Error('storage: a bad file name or range');
  }
  let res;
  try {
    res = await fetch(storageUrl(cfg, `authenticated/${BUCKET}/${name}`), {
      headers: { ...headers(cfg), Range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new Error(`storage: ${err.name === 'TimeoutError' || err.name === 'AbortError' ? 'no answer in time' : 'out of reach'}`);
  }
  if (res.status === 404 || res.status === 400) {
    const text = await res.text().catch(() => '');
    if (res.status === 404 || /not.?found/i.test(text)) return null;
    throw new Error(`storage HTTP ${res.status}`);
  }
  const want = end - start + 1;
  let bytes;
  if (res.status === 206) {
    const m = /^bytes (\d+)-(\d+)\/(?:\d+|\*)$/.exec(res.headers.get('content-range') || '');
    if (!m || Number(m[1]) !== start) { res.body?.cancel().catch(() => {}); throw new Error('storage: another part than asked for'); }
    bytes = await firstBytes(res, want);
  } else if (res.status === 200) {
    bytes = (await firstBytes(res, end + 1)).subarray(start);
  } else {
    res.body?.cancel().catch(() => {});
    throw new Error(`storage HTTP ${res.status}`);
  }
  if (bytes.length !== want) throw new Error('storage: a part shorter than asked for');
  return bytes;
}

// One of a character's files, read back. → a Buffer, or null when it isn't there
export async function getFile(cfg, name, { timeoutMs = 8000, max = GLB_MAX + 500_000 } = {}) {
  if (!NAME.test(name)) return null;
  let res;
  try {
    res = await fetch(storageUrl(cfg, `authenticated/${BUCKET}/${name}`), { headers: headers(cfg), signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    throw new Error(`storage: ${err.name === 'TimeoutError' || err.name === 'AbortError' ? 'no answer in time' : 'out of reach'}`);
  }
  if (res.status === 404 || res.status === 400) {
    const text = await res.text().catch(() => '');
    if (res.status === 404 || /not.?found/i.test(text)) return null;
    throw new Error(`storage HTTP ${res.status}`);
  }
  if (!res.ok) throw new Error(`storage HTTP ${res.status}`);
  const bytes = await readLimited(res, max);
  if (!bytes) throw new Error('storage: a file too big to serve');
  return bytes;
}

// AGI Studio (2026-10-10): the files in one of its folders (an influencer's, or an upload's parts), for deleting them.
// → their names (whole paths) · throws when Storage says no
const FOLDER = new RegExp(`^(?:inf/${ID}|up/${ID})$`);
export async function listFiles(cfg, folder, { timeoutMs = 6000 } = {}) {
  if (!FOLDER.test(folder)) throw new Error('storage: a bad folder');
  let res;
  try {
    res = await fetch(`${cfg.supabaseUrl}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: { ...headers(cfg), 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: folder, limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw new Error(`storage: ${err.name === 'TimeoutError' || err.name === 'AbortError' ? 'no answer in time' : 'out of reach'}`);
  }
  if (!res.ok) throw new Error(`storage HTTP ${res.status}`);
  const list = await res.json().catch(() => null);
  if (!Array.isArray(list)) throw new Error('storage: an odd list');
  return list.filter((f) => f && f.id && typeof f.name === 'string').map((f) => `${folder}/${f.name}`).filter((name) => NAME.test(name));
}

// Some of its files deleted (Storage's own bulk delete; ones that aren't there are fine). → how many it said it deleted ·
// throws when Storage says no
export async function deleteFiles(cfg, names, { timeoutMs = 8000 } = {}) {
  const good = [...new Set((Array.isArray(names) ? names : []).filter((name) => typeof name === 'string' && NAME.test(name)))];
  let gone = 0;
  for (let i = 0; i < good.length; i += 100) {
    let res;
    try {
      res = await fetch(`${cfg.supabaseUrl}/storage/v1/object/${BUCKET}`, {
        method: 'DELETE',
        headers: { ...headers(cfg), 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefixes: good.slice(i, i + 100) }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new Error(`storage: ${err.name === 'TimeoutError' || err.name === 'AbortError' ? 'no answer in time' : 'out of reach'}`);
    }
    if (!res.ok) throw new Error(`storage HTTP ${res.status}`);
    const out = await res.json().catch(() => []);
    gone += Array.isArray(out) ? out.length : 0;
  }
  return gone;
}
