// The risk check's coin pictures (2026-10-05, the owner: "theres no pictures of the token there"). clank.trade keeps every
// coin's picture on IPFS and showed them through its own Pinata gateway, which also made them small for us; since October
// 2026 that gateway only answers clank.trade's own pages ("This content cannot be requested through the gateway you are
// using - ERR_ID:00024", HTTP 401), so every picture was a letter. IPFS is public, so the same files now come from public
// IPFS gateways (in order: Filebase's, Pinata's public one, ipfs.io), a few from ClankBot's own picture host, and our
// server makes them small itself (sharp). Only api/checker.js loads this file (sharp is big: the other functions never
// carry it). Read-only, never a redirect, never SVG.
import { UA, readLimited, looksLike, PICTURE_TYPES, PICTURE_MAX_BYTES } from './coins.js';
import { CID, PICTURE_URL } from './checker.js';

// the public IPFS gateways, in this order, each for at most so long (ms). Measured in a browser on 2026-10-05: Filebase's
// 0.4–2 s, Pinata's public one 6–8 s (it has every clank.trade picture: they're pinned on Pinata), ipfs.io the last try
export const GATEWAYS = [
  ['https://ipfs.filebase.io/ipfs/', 7000],
  ['https://gateway.pinata.cloud/ipfs/', 9000],
  ['https://ipfs.io/ipfs/', 6000],
];
// a row's circle (cut to a square) and the big view (the whole picture, never enlarged: 400 px stays 400 px)
export const PICTURE_SIZES = [96, 512];
// a picture as its creator uploaded it can be big (several MB): read up to this much, then make it small
export const ORIGINAL_MAX_BYTES = 8_000_000;

// The first bytes of a file → its picture type, or null (only PNG, JPEG, WebP, GIF or AVIF: never SVG, which can carry code)
export const pictureType = (bytes) => [...PICTURE_TYPES].find((type) => looksLike(type, bytes)) ?? null;

// The picture itself (size: 96 or 512): the file its creator uploaded, from the first public IPFS gateway that has it (or
// ClankBot's host), checked to really be a picture by its first bytes (whatever type the host claims), at most 8 MB, then
// made small by our server (sharp): a 96 px square for the rows, at most 512 px for the big view, always WebP. A broken
// picture, or a giant one (over 50 million pixels), isn't shown. → { bytes, type } | null (no such picture, or not one
// we'd show) · throws when no host answered (the page keeps the coin's letter, and asks again after 5 minutes)
export async function fetchCoinPicture(source, size, { deadline = Date.now() + 20_000 } = {}) {
  if (!PICTURE_SIZES.includes(size)) return null;
  const tries = CID.test(String(source)) ? GATEWAYS.map(([base, ms]) => [`${base}${source}`, ms])
    : PICTURE_URL.test(String(source)) ? [[String(source), 8000]] : null;
  if (!tries) return null;
  // failed: a host didn't answer properly (then it's asked again later); a host that has no such picture, or sends something
  // that isn't one, just passes it on to the next host (when none has it: no picture)
  let original = null, failed = 'no time left';
  for (const [url, ms] of tries) {
    const left = deadline - Date.now();
    if (left < 1000) break;
    if (failed === 'no time left') failed = null;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'image/webp,image/avif,image/png,image/jpeg,image/gif' },
        redirect: 'error', signal: AbortSignal.timeout(Math.min(ms, left)),
      });
      if (!res.ok) {
        res.body?.cancel().catch(() => {});
        if (![400, 404, 410].includes(res.status)) failed = `HTTP ${res.status}`;
        continue;                                                          // another host may have it
      }
      const bytes = await readLimited(res, ORIGINAL_MAX_BYTES);
      if (!bytes) return null;                                             // over 8 MB (the same file everywhere): not shown
      const type = bytes.length ? pictureType(bytes) : null;
      if (!type) continue;                                                 // not a picture (or a host's error page: the next may do better)
      original = { bytes, type };
      break;
    } catch (err) {
      failed = err?.name === 'TimeoutError' ? 'no answer in time' : String(err?.message || err).slice(0, 80);
    }
  }
  if (original) return shrink(original, size);
  if (failed) throw new Error(`picture hosts: ${failed}`);
  return null;
}

// sharp, loaded the first time a picture is made (it's big, and most requests never need it)
let sharpModule;
export function setSharpForTests(value) { sharpModule = value; }
async function loadSharp() {
  if (sharpModule === undefined) {
    try { sharpModule = (await import('sharp')).default; } catch (err) {
      console.warn(`[checker] sharp isn't available (${err.message}): pictures are served as they are, up to 1 MB`);
      sharpModule = null;
    }
  }
  return sharpModule;
}
const SHRUNK_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'heif']);
async function shrink({ bytes, type }, size) {
  const sharp = await loadSharp();
  // (only if sharp ever went missing: a real picture as it is, when it's small enough; never happens on Vercel)
  if (!sharp) return bytes.length <= PICTURE_MAX_BYTES ? { bytes, type } : null;
  try {
    const img = sharp(bytes, { limitInputPixels: 50_000_000, animated: false, failOn: 'error' });
    const meta = await img.metadata();
    if (!SHRUNK_FORMATS.has(meta.format)) return null;
    const out = await (size === 96
      ? img.rotate().resize(96, 96, { fit: 'cover' })
      : img.rotate().resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    ).webp({ quality: size === 96 ? 80 : 85 }).toBuffer();
    return out.length ? { bytes: out, type: 'image/webp' } : null;
  } catch {
    return null;
  }
}
