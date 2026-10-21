// The live coins' pictures (2026-10-21, #404), through our own server: a browser never asks a coin's own host (or
// pump.fun's) for anything, so the page's CSP gains only the relay's address. For each new coin the relay reads its
// metadata (pump.fun's JSON) and its picture once, from public IPFS gateways (a coin's IPFS id; the gateways in the
// settings, in order) or, for any other address, with the safe request (https, public addresses only, no redirects);
// checks the file really is a picture by its first bytes (PNG, JPEG, GIF, WebP or AVIF: never SVG, which can carry code;
// whatever type the host claims); refuses anything over 8 MB or 40 million pixels; and makes it a 128 px WebP square
// (sharp), kept in memory (the newest, up to the settings' size) and served at /p/<its hash>.webp. A coin's picture as
// its maker uploaded it (the owner's call: no picture checks), only made small.
import { createHash } from 'node:crypto';
import { safeGet, trustedGet, NetError } from './net.mjs';
import { socialsOf } from './parse.mjs';
import { errText } from './log.mjs';

export const CID = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{50,100})$/;
export const PIC = Object.freeze({ size: 128, quality: 70, maxOriginal: 8_000_000, maxMeta: 256_000, maxOut: 96_000,
  maxPixels: 40_000_000 });
export const HASH = /^[A-Za-z0-9_-]{22}$/;
// a path inside an IPFS folder: a few plain names, never "." or ".."
const SUBPATH = /^(\/(?!\.\.?(?:\/|$))[A-Za-z0-9._-]{1,120}){0,4}$/;

// Where a picture or a metadata file is: { ipfs, path } (an IPFS id, from ipfs://…, a gateway's /ipfs/… address or a
// subdomain gateway) · { url } (any other https address) · null (nothing usable)
export function locate(raw) {
  const s = String(raw ?? '').trim();
  if (!s || s.length > 1000) return null;
  if (CID.test(s)) return { ipfs: s, path: '' };
  if (s.startsWith('ipfs://')) {
    const [id, ...rest] = s.slice(7).replace(/^ipfs\//, '').split(/[?#]/)[0].split('/');
    const path = rest.length ? `/${rest.join('/')}` : '';
    return CID.test(id) && SUBPATH.test(path) ? { ipfs: id, path } : null;
  }
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const m = /^\/ipfs\/([^/]+)((?:\/[^/]+)*)\/?$/.exec(u.pathname);
  if (m && CID.test(m[1])) return SUBPATH.test(m[2]) ? { ipfs: m[1], path: m[2] } : null;
  const sub = /^([a-z2-7]{50,100})\.ipfs\./.exec(u.hostname);
  if (sub && CID.test(sub[1])) {
    const path = u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '');
    return SUBPATH.test(path) ? { ipfs: sub[1], path } : null;
  }
  return u.protocol === 'https:' ? { url: u.href } : null;
}

// a file's kind by its first bytes: 'png' | 'jpeg' | 'gif' | 'webp' | 'avif' | null (never SVG or anything else)
export function sniff(b) {
  if (!b || b.length < 12) return null;
  const at = (i, txt) => [...txt].every((ch, k) => b[i + k] === ch.charCodeAt(0));
  if (b[0] === 0x89 && at(1, 'PNG')) return 'png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (at(0, 'GIF8')) return 'gif';
  if (at(0, 'RIFF') && at(8, 'WEBP')) return 'webp';
  if (at(4, 'ftyp') && (at(8, 'avif') || at(8, 'avis'))) return 'avif';
  return null;
}

class Later extends Error {} // not there (yet), or a host that didn't answer: tried again later

export function createPictures({ gateways, log, sharp, fetchSafe = safeGet, fetchTrusted = trustedGet, maxBytes = 64 * 1024 * 1024,
  concurrency = 2, retryMs = [15_000, 60_000], timeoutMs = 9000, now = Date.now } = {}) {
  const cache = new Map(); // hash → bytes, oldest first
  let bytes = 0;
  const queue = [];
  const jobs = new Map();
  let running = 0;
  let closed = false;
  const timers = new Set();
  const S = { made: 0, failed: 0, retried: 0, dropped: 0, served: 0 };

  function store(hash, buf) {
    if (cache.has(hash)) {
      cache.delete(hash);
      cache.set(hash, buf);
      return;
    }
    cache.set(hash, buf);
    bytes += buf.length;
    while (bytes > maxBytes && cache.size > 1) {
      const [k, v] = cache.entries().next().value;
      cache.delete(k);
      bytes -= v.length;
    }
  }

  // a file from IPFS (each gateway in turn) or from its own address (the safe request)
  async function fetchFile(loc, max, accept) {
    if (loc.ipfs) {
      let later = false;
      for (const g of gateways) {
        try {
          const r = await fetchTrusted(`${g}${loc.ipfs}${loc.path}`, { timeoutMs, maxBytes: max, headers: { Accept: accept } });
          if (r.status === 200) return r.bytes;
          if (r.status !== 404 && r.status !== 410) later = true;
        } catch (err) {
          if (err instanceof NetError && err.code === 'too_big') return null; // the same file everywhere
          later = true;
        }
      }
      // a new coin's file often reaches the gateways a little later: try again
      throw new Later(later ? 'gateways' : 'not found yet');
    }
    try {
      const r = await fetchSafe(loc.url, { timeoutMs, maxBytes: max, accept });
      if (r.status === 200) return r.bytes;
      if (r.status === 429 || r.status >= 500) throw new Later(`HTTP ${r.status}`);
      return null;
    } catch (err) {
      if (err instanceof Later) throw err;
      if (err instanceof NetError && ['timeout', 'cut_off'].includes(err.code)) throw new Later(err.code);
      if (err instanceof NetError) return null; // a redirect, a private address, too big, not https: never
      throw new Later(errText(err));
    }
  }

  async function make(spec) {
    let soc = null;
    let image = spec.image || null;
    if (spec.meta) {
      const loc = locate(spec.meta);
      if (!loc) return { path: null, soc };
      const raw = await fetchFile(loc, PIC.maxMeta, 'application/json');
      if (!raw) return { path: null, soc };
      let meta;
      try {
        meta = JSON.parse(raw.toString('utf8'));
      } catch {
        return { path: null, soc };
      }
      if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return { path: null, soc };
      soc = socialsOf(meta);
      image = typeof meta.image === 'string' ? meta.image : null;
    }
    const loc = locate(image);
    if (!loc) return { path: null, soc };
    const orig = await fetchFile(loc, PIC.maxOriginal, 'image/webp,image/avif,image/png,image/jpeg,image/gif');
    if (!orig || !sniff(orig)) return { path: null, soc };
    let out;
    try {
      out = await sharp(orig, { limitInputPixels: PIC.maxPixels, animated: false, failOn: 'error' })
        .rotate()
        .resize(PIC.size, PIC.size, { fit: 'cover' })
        .webp({ quality: PIC.quality, effort: 3 })
        .toBuffer();
    } catch {
      return { path: null, soc }; // broken, or too many pixels
    }
    if (!out || out.length > PIC.maxOut || sniff(out) !== 'webp') return { path: null, soc };
    const hash = createHash('sha256').update(out).digest('base64url').slice(0, 22);
    store(hash, out);
    return { path: `/p/${hash}.webp`, soc };
  }

  function later(fn, ms) {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  }

  async function work(job) {
    job.tries += 1;
    let r = null;
    try {
      r = await make(job.spec);
    } catch (err) {
      if (!closed && err instanceof Later && job.tries <= retryMs.length) {
        S.retried += 1;
        later(() => {
          queue.push(job);
          pump();
        }, retryMs[job.tries - 1]);
        return;
      }
      r = { path: null, soc: null };
    }
    jobs.delete(job.key);
    if (r.path) S.made += 1;
    else S.failed += 1;
    try {
      job.done(r.path, r.soc);
    } catch (err) {
      log.warn(`pictures: ${errText(err)}`);
    }
  }

  function pump() {
    while (!closed && running < concurrency && queue.length) {
      const job = queue.shift();
      running += 1;
      work(job).finally(() => {
        running -= 1;
        pump();
      });
    }
  }

  return {
    // a coin's picture, once: `spec` { meta } (its metadata's address) or { image } (the picture's); `done(path, soc)`
    request(key, spec, done) {
      if (closed || jobs.has(key) || !spec || (!spec.meta && !spec.image)) return false;
      const job = { key, spec, done, tries: 0, at: now() };
      jobs.set(key, job);
      queue.push(job);
      // too many waiting: the oldest go (old news by now)
      while (queue.length > 300) {
        const old = queue.shift();
        jobs.delete(old.key);
        S.dropped += 1;
      }
      pump();
      return true;
    },
    get(hash) {
      if (!HASH.test(String(hash))) return null;
      const b = cache.get(hash);
      if (!b) return null;
      cache.delete(hash);
      cache.set(hash, b);
      S.served += 1;
      return b;
    },
    stats() {
      return { cached: cache.size, bytes, waiting: queue.length + running, ...S };
    },
    close() {
      closed = true;
      for (const t of timers) clearTimeout(t);
      timers.clear();
      queue.length = 0;
    },
  };
}
