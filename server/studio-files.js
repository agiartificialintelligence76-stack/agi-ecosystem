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
// And (2026-10-13, the 3D tool's choices) a 3D model's moves described in words: each one's own file from Meshy (its bones
// with that one move), its move merged into the model as a clip of its own (mergeClip: own_<name>, by its bones' names); a
// third way to make it small (512 px textures and its shape quantized, KHR_mesh_quantization, which three.js and Blender
// read); and its extra downloads, made by the clock afterwards (server/studio-dl.js) and kept 30 days (dl/<id>.<ext>): the
// full-quality GLB (fullGlb: every move, its textures as made), Meshy's own FBX, USDZ and STL, and its OBJ zipped with its
// material and textures (objZip, zipStore: a plain ZIP, stored).
import { readLimited } from './coins.js';

export const BUCKET = 'agi1-characters';
export const GLB_MAX = 4_000_000;            // a character's model, at most (Vercel answers at most 4.5 MB)
export const VIDEO_MAX = 40_000_000;         // a video, at most (the bucket's limit: 40 MB a file)
const VIDEO_MIN = 10_000;
const SOURCE_MAX = 80_000_000;               // the most read from Meshy for one file
export const DL_MAX = 40_000_000;            // an extra download, at most (the bucket's limit: 40 MB a file)
const PICTURE_MAX = 20_000_000;
const MAX_PIXELS = 40_000_000;               // a picture bigger than this isn't one we read

// sharp (an npm package: pictures), loaded only here
let sharpLoaded = null;
export const loadSharp = async () => (sharpLoaded ??= (await import('sharp')).default);

// a size in words (a limit in a log line: "40 MB", or bytes for a small one)
const sizeText = (n) => (n >= 1e6 ? `${Math.round(n / 1e6)} MB` : `${n} bytes`);
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
  if (!bytes) throw Object.assign(new Error(`files: Meshy's file is too big (over ${sizeText(max)})`), { tooBig: true });
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

// gltf-transform (an npm package: 3D files) and its parts, loaded only here
async function gltf() {
  const [core, { ALL_EXTENSIONS }, fns] = await Promise.all([
    import('@gltf-transform/core'), import('@gltf-transform/extensions'), import('@gltf-transform/functions'),
  ]);
  const quiet = new core.Logger(core.Logger.Verbosity.WARN);
  const io = new core.NodeIO().registerExtensions(ALL_EXTENSIONS).setLogger(quiet);
  // every document it reads logs only warnings (gltf-transform's info lines, like what prune removed, never in our logs)
  const read = async (bytes) => (await io.readBinary(new Uint8Array(bytes))).setLogger(quiet);
  return { core, fns, io, read };
}
const trianglesOf = (root) => {
  let n = 0;
  for (const mesh of root.listMeshes()) {
    for (const p of mesh.listPrimitives()) {
      const idx = p.getIndices(), pos = p.getAttribute('POSITION');
      n += Math.floor((idx ? idx.getCount() : pos ? pos.getCount() : 0) / 3);
    }
  }
  return n;
};
// A move described in words (2026-10-13): the one clip in its own file (Meshy's: the same bones, with that move) copied into
// the model as a clip of its own, each channel onto the model's bone of the same name (its keys copied as they are). Its
// biggest clip is the one taken; channels whose bone the model hasn't got are left out (a rotation, translation or scale only).
// → how many channels it got · throws when none fit (it isn't the same model's bones)
const TRS = new Set(['translation', 'rotation', 'scale']);
export function mergeClip(doc, from, name) {
  const root = doc.getRoot();
  const anims = from.getRoot().listAnimations();
  if (!anims.length) throw new Error(`files: its own move "${name}" has no move in its file`);
  const clip = anims.reduce((a, b) => (b.listChannels().length > a.listChannels().length ? b : a));
  const bones = new Map();
  for (const node of root.listNodes()) if (node.getName() && !bones.has(node.getName())) bones.set(node.getName(), node);
  const buffer = root.listBuffers()[0] || doc.createBuffer();
  const copy = (a) => doc.createAccessor().setType(a.getType()).setArray(a.getArray().slice()).setNormalized(a.getNormalized()).setBuffer(buffer);
  const out = doc.createAnimation(name);
  const samplers = new Map();
  for (const ch of clip.listChannels()) {
    const bone = bones.get(ch.getTargetNode()?.getName());
    const path = ch.getTargetPath();
    const s = ch.getSampler();
    if (!bone || !TRS.has(path) || !s?.getInput() || !s.getOutput()) continue;
    let sampler = samplers.get(s);
    if (!sampler) {
      sampler = doc.createAnimationSampler().setInput(copy(s.getInput())).setOutput(copy(s.getOutput())).setInterpolation(s.getInterpolation());
      out.addSampler(sampler);
      samplers.set(s, sampler);
    }
    out.addChannel(doc.createAnimationChannel().setTargetNode(bone).setTargetPath(path).setSampler(sampler));
  }
  const n = out.listChannels().length;
  if (!n) {
    for (const sampler of out.listSamplers()) { sampler.getInput()?.dispose(); sampler.getOutput()?.dispose(); sampler.dispose(); }
    out.dispose();
    throw new Error(`files: its own move "${name}" doesn't fit its bones`);
  }
  return n;
}

// A character's model, made small. → { bytes, clips (its moves' names in the file), skins, triangles, size (texture px),
// quantized } · Throws when it isn't a GLB with bones and moves, or can't be made small enough.
// extras (2026-10-13): its moves described in words, [{ name: 'own_<name>', bytes: that move's own GLB }], merged in first.
// Its ways to be small, in turn: 1024 px textures; 512; 512 with its shape quantized (since 2026-10-13: a model with more
// moves, or High detail). Once one is too big, the next one that could fit is tried (its textures guessed a quarter as big at
// half the size), so a big model isn't made three times.
export async function smallGlb(source, { sharp = null, max = GLB_MAX, extras = [] } = {}) {
  if (!isGlb(source)) throw new Error("files: Meshy's model isn't a GLB");
  for (const e of extras) if (!isGlb(e?.bytes)) throw new Error(`files: its own move "${e?.name}" isn't a GLB`);
  const { fns: { dedup, prune, resample, compressTexture, quantize }, io, read } = await gltf();
  const encoder = sharp || await loadSharp();
  const extraDocs = [];
  for (const e of extras) extraDocs.push({ name: e.name, doc: await read(e.bytes) });
  const WAYS = [{ size: 1024, quantized: false }, { size: 512, quantized: false }, { size: 512, quantized: true }];
  let last = null;
  for (let w = 0; w < WAYS.length; w++) {
    const { size, quantized } = WAYS[w];
    const doc = await read(source);
    const root = doc.getRoot();
    const skins = root.listSkins().length;
    if (!skins) throw new Error('files: the model has no bones');
    if (!root.listAnimations().length) throw new Error('files: the model has no moves');
    for (const e of extraDocs) mergeClip(doc, e.doc, e.name);
    const clips = root.listAnimations().map((a) => a.getName());
    await doc.transform(dedup(), resample(), prune({ keepAttributes: true }), ...(quantized ? [quantize()] : []));
    let textures = 0;
    for (const texture of root.listTextures()) {
      const image = texture.getImage();
      if (!image) continue;
      const opaque = await encoder(Buffer.from(image), { limitInputPixels: MAX_PIXELS }).stats().then((st) => st.isOpaque, () => false);
      await compressTexture(texture, { encoder, targetFormat: opaque ? 'jpeg' : 'png', resize: [size, size], quality: opaque ? 88 : null,
        chromaSubsampling: '4:4:4' });
      textures += texture.getImage()?.byteLength || 0;
    }
    const bytes = Buffer.from(await io.writeBinary(doc));
    last = { bytes, clips, skins, triangles: trianglesOf(root), size, quantized };
    if (bytes.length <= max) return last;
    // too big: if half-size textures (about a quarter of the bytes) can't bring it under, straight to the quantized way
    if (w === 0 && bytes.length - textures + textures / 4 > max * 0.97) w = 1;
  }
  throw Object.assign(new Error(`files: the model is still ${(last.bytes.length / 1e6).toFixed(1)} MB made small (at most ${(max / 1e6).toFixed(1)})`), { tooBig: true });
}

// ---------- its extra downloads (2026-10-13: server/studio-dl.js) ----------
// The full-quality GLB: Meshy's model with every move (its described ones merged in), its textures as made; when that's
// over the bucket's 40 MB, its textures as JPEG (PNG where they're see-through) of 2048 px at most, then 1024. → { bytes,
// clips } · throws (tooBig when it can't fit)
export async function fullGlb(source, { sharp = null, max = DL_MAX, extras = [] } = {}) {
  if (!isGlb(source)) throw new Error("files: Meshy's model isn't a GLB");
  for (const e of extras) if (!isGlb(e?.bytes)) throw new Error(`files: its own move "${e?.name}" isn't a GLB`);
  const { fns: { compressTexture }, io, read } = await gltf();
  const extraDocs = [];
  for (const e of extras) extraDocs.push({ name: e.name, doc: await read(e.bytes) });
  let last = null;
  for (const size of [null, 2048, 1024]) {
    const doc = await read(source);
    const root = doc.getRoot();
    if (!root.listAnimations().length) throw new Error('files: the model has no moves');
    for (const e of extraDocs) mergeClip(doc, e.doc, e.name);
    if (size) {
      const encoder = sharp || await loadSharp();
      for (const texture of root.listTextures()) {
        const image = texture.getImage();
        if (!image) continue;
        const opaque = await encoder(Buffer.from(image), { limitInputPixels: MAX_PIXELS }).stats().then((st) => st.isOpaque, () => false);
        await compressTexture(texture, { encoder, targetFormat: opaque ? 'jpeg' : 'png', resize: [size, size], quality: opaque ? 90 : null,
          chromaSubsampling: '4:4:4' });
      }
    }
    const bytes = Buffer.from(await io.writeBinary(doc));
    last = { bytes, clips: root.listAnimations().map((a) => a.getName()) };
    if (bytes.length <= max) return last;
  }
  throw Object.assign(new Error(`files: the full model is ${(last.bytes.length / 1e6).toFixed(1)} MB (at most ${(max / 1e6).toFixed(1)})`), { tooBig: true });
}

// A ZIP of some files, stored as they are (no compression: an OBJ's textures are compressed already, and a ZIP every app
// opens). entries: [{ name, bytes }] (names of plain letters, numbers, dots, dashes and underscores). → a Buffer
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export function zipStore(entries) {
  const parts = [], central = [];
  let offset = 0;
  const DOS_TIME = 0, DOS_DATE = (1 << 5) | 1;                    // 1980-01-01 00:00 (the same bytes every time)
  for (const { name, bytes } of entries) {
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(name)) throw new Error('zip: a bad file name');
    const data = Buffer.from(bytes);
    const fileName = Buffer.from(name, 'latin1');
    const crc = crc32(data);
    if (data.length > 0xfffffffe || offset > 0xfffffffe) throw new Error('zip: too big');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(0, 8);
    local.writeUInt16LE(DOS_TIME, 10); local.writeUInt16LE(DOS_DATE, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(fileName.length, 26); local.writeUInt16LE(0, 28);
    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(20, 6); head.writeUInt16LE(0, 8); head.writeUInt16LE(0, 10);
    head.writeUInt16LE(DOS_TIME, 12); head.writeUInt16LE(DOS_DATE, 14); head.writeUInt32LE(crc, 16); head.writeUInt32LE(data.length, 20);
    head.writeUInt32LE(data.length, 24); head.writeUInt16LE(fileName.length, 28); head.writeUInt16LE(0, 30); head.writeUInt16LE(0, 32);
    head.writeUInt16LE(0, 34); head.writeUInt16LE(0, 36); head.writeUInt32LE(0, 38); head.writeUInt32LE(offset, 42);
    parts.push(local, fileName, data);
    central.push(head, fileName);
    offset += local.length + fileName.length + data.length;
  }
  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(centralBytes.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, centralBytes, end]);
}

// Its OBJ, zipped with its material and textures: model.obj (its "mtllib" line naming model.mtl), model.mtl (each texture
// line naming the file beside it: its color, metal, roughness and bumps, the ones it has), and the textures (PNG or JPEG,
// by their own first bytes). obj, mtl: Buffers; textures: { base_color, metallic, roughness, normal } (Buffers). → a Buffer
const MAP_OF = { map_kd: 'base_color', map_pm: 'metallic', map_pr: 'roughness', norm: 'normal', map_bump: 'normal', bump: 'normal' };
const pictureExt = (b) => (b?.length > 8 && b.readUInt32BE(0) === 0x89504e47 ? 'png' : b?.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff ? 'jpg' : null);
export function objZip({ obj, mtl, textures = {} }) {
  if (!obj?.length) throw new Error('files: no OBJ');
  const files = [];
  const names = {};
  for (const [kind, bytes] of Object.entries(textures)) {
    const ext = pictureExt(bytes);
    if (!ext || !['base_color', 'metallic', 'roughness', 'normal'].includes(kind)) continue;
    names[kind] = `texture_${kind}.${ext}`;
    files.push({ name: names[kind], bytes });
  }
  const objText = Buffer.from(obj).toString('utf8').split(/\r?\n/);
  let hasLib = false;
  // its "mtllib" line names model.mtl (beside it in the zip); without a material, no such line (apps warn about a material
  // file that isn't there)
  const objOut = objText.flatMap((line) => {
    if (!/^\s*mtllib\s/i.test(line)) return [line];
    const first = !hasLib;
    hasLib = true;
    return mtl?.length && first ? ['mtllib model.mtl'] : [];
  });
  const out = [];
  if (mtl?.length) {
    const lines = Buffer.from(mtl).toString('utf8').split(/\r?\n/).flatMap((line) => {
      const m = /^(\s*)(map_Kd|map_Pm|map_Pr|map_Bump|bump|norm|map_Ka|map_Ks|map_Ns|map_d|map_Ke|disp|refl)(\s.*)?$/i.exec(line);
      if (!m) return [line];
      const kind = MAP_OF[m[2].toLowerCase()];
      if (!kind || !names[kind]) return [];
      // its options (like "-bm 1") kept, its file named as it is in the zip
      const opts = String(m[3] || '').trim().split(/\s+/).filter(Boolean).slice(0, -1).join(' ');
      return [`${m[1]}${m[2]}${opts ? ` ${opts}` : ''} ${names[kind]}`];
    });
    out.push({ name: 'model.mtl', bytes: Buffer.from(lines.join('\n'), 'utf8') });
    if (!hasLib) objOut.unshift('mtllib model.mtl');
  }
  return zipStore([{ name: 'model.obj', bytes: Buffer.from(objOut.join('\n'), 'utf8') }, ...out, ...files]);
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
// stickers, inf/<influencer>/<job>.layer.png (its pieces are its .p<n>.mp4); and (2026-10-13) a 3D model's extra downloads,
// dl/<id>.glb|fbx|usdz|stl|zip (src/studio/rules.js dlPath); and (2026-10-13, "With AGI-1") AGI-1's two pictures for the AI
// services, agi1/with-<16 hex>.jpg and agi1/face-<16 hex>.jpg (server/inf-agi1.js: named by their own bytes)
const ID = '[A-Za-z0-9_-]{22}';
export const NAME = new RegExp(`^(?:${ID}\\.(?:glb|webp|png)|dl/${ID}\\.(?:glb|fbx|usdz|stl|zip)|videos/${ID}\\.mp4|inf/${ID}/${ID}(?:-[0-3]\\.(?:jpg|webp|hd\\.jpg)|\\.mp4|\\.dl\\.mp4|\\.poster\\.webp|\\.layer\\.png|\\.[pf][0-3]\\.(?:mp4|jpg))`
  + `|trends/${ID}(?:\\.mp4|\\.poster\\.webp)|examples/${ID}\\.webp|up/${ID}(?:\\.(?:jpg|mp4)|/(?:[0-9]{1,2}\\.part|f[0-9]\\.jpg))`
  + '|agi1/(?:with|face)-[0-9a-f]{16}\\.jpg)$');

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
