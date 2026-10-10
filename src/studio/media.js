// AGI Studio (2026-10-10): pictures and clips, in the visitor's own browser, and sending them to our server.
//   • A picture for "From a photo" (a photo of the visitor, of someone who said OK, or a character of theirs: round 2, with
//     the box ticked first, which our server needs) is made a JPEG of at most 1536 px here, then sent in one request with the
//     ticket our server gave for it (server/inf-uploads.js looks at it before keeping anything). ("Use my face" and its live
//     selfies are gone since round 2: nothing here opens a camera.)
//   • A clip (their own, for a trend video: 3 to 10 s, 720 to 2160 px a side) is read here first (its length and shape), then
//     sent in parts of 3.5 MB (Vercel takes at most 4.5 MB a request), with 3 small frames of it taken here for the AI check.
//   • A video's poster: a frame of one of its own videos, taken here (our own address: the picture isn't tainted), sent with
//     its ticket.
// Nothing here is kept: the browser's copies go when the page does.
import { CLIP, PICTURE } from './rules.js';

const API = '/api/launch';

// ---------- a picture, made small ----------
// any picture the browser can read → a JPEG Blob of at most maxPx on its longest side and maxBytes. → Blob, or null
async function bitmapOf(file) {
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* older browsers, odd files */ }
  // (an <img> from a blob: address; the page's CSP allows blob: pictures)
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function shrinkPicture(file, { maxPx = PICTURE.MAX_PX, maxBytes = PICTURE.MAX_BYTES } = {}) {
  const src = await bitmapOf(file);
  if (!src) return null;
  const w0 = src.width || src.naturalWidth, h0 = src.height || src.naturalHeight;
  if (!w0 || !h0) return null;
  return canvasJpeg(src, w0, h0, { maxPx, maxBytes });
}
function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}
// draws src (an image, a bitmap, a video frame) at most maxPx on its longest side → a JPEG of at most maxBytes, or null
export async function canvasJpeg(src, w0, h0, { maxPx, maxBytes }) {
  let scale = Math.min(1, maxPx / Math.max(w0, h0));
  for (let tries = 0; tries < 4; tries++) {
    const w = Math.max(1, Math.round(w0 * scale)), ht = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = ht;
    const g = canvas.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, ht);
    g.drawImage(src, 0, 0, w, ht);
    for (const q of [0.88, 0.8, 0.7]) {
      const blob = await toBlob(canvas, 'image/jpeg', q);
      if (blob && blob.size <= maxBytes) return blob;
    }
    scale *= 0.75;
  }
  return null;
}

// ---------- a clip: its length, its shape and 3 frames ----------
// Its shape from its size: tall, wide or square (a trend video is as tall or wide as its clip)
export const shapeOfSize = (w, ht) => (ht > w * 1.15 ? 'tall' : w > ht * 1.15 ? 'wide' : 'square');
// → { seconds, width, height, shape, frames: [JPEG Blob ×3] } · throws Error('clip_read' | 'clip_length' | 'clip_size' |
// 'clip_type' | 'clip_pixels') (the video model's own limits: 3 to 10 s, 720 to 2160 px a side; our server reads them again)
export async function readClip(file) {
  if (!/^video\/(mp4|quicktime)$/i.test(file.type || '') && !/\.(mp4|mov|m4v)$/i.test(file.name || '')) throw new Error('clip_type');
  if (file.size > CLIP.MAX_BYTES) throw new Error('clip_size');
  if (file.size < 1000) throw new Error('clip_read');
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  const once = (type, ms = 12_000) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('clip_read')), ms);
    video.addEventListener(type, () => { clearTimeout(t); resolve(); }, { once: true });
    video.addEventListener('error', () => { clearTimeout(t); reject(new Error('clip_read')); }, { once: true });
  });
  try {
    video.src = url;
    await once('loadeddata');
    const seconds = video.duration;
    if (!Number.isFinite(seconds) || seconds < CLIP.MIN_S - 0.02 || seconds > CLIP.MAX_S + 0.05) throw new Error('clip_length');
    const width = video.videoWidth, height = video.videoHeight;
    if (!width || !height) throw new Error('clip_read');
    if (Math.min(width, height) < CLIP.MIN_PX || Math.max(width, height) > CLIP.MAX_PX) throw new Error('clip_pixels');
    const frames = [];
    for (const at of [0.2, 0.5, 0.8]) {
      video.currentTime = Math.min(seconds - 0.05, Math.max(0.05, seconds * at));
      await once('seeked');
      const blob = await canvasJpeg(video, width, height, { maxPx: 512, maxBytes: CLIP.FRAME_BYTES });
      if (!blob) throw new Error('clip_read');
      frames.push(blob);
    }
    return { seconds, width, height, shape: shapeOfSize(width, height), frames };
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}
export function clipText(code) {
  return {
    clip_type: 'An MP4 or MOV video, please.',
    clip_size: 'A clip of 30 MB at most, please (3 to 10 seconds).',
    clip_length: 'A clip of 3 to 10 seconds, please.',
    clip_pixels: 'A clip of 720 to 2160 pixels on each side, please (most phone videos are: try exporting it in 1080p).',
    clip_read: "This browser can't read that video: try an MP4 (most phones save one when you share or export a clip).",
  }[code] || "Couldn't read that clip. Try another.";
}

// ---------- sending ----------
// one binary request (a picture, a clip's part or frame, a poster), tried again once when the network or our server hiccups
async function sendBytes(query, blob) {
  let last = { ok: false, status: 0, data: { error: 'offline' } };
  for (let t = 0; t < 2; t++) {
    try {
      const res = await fetch(`${API}?${query}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: blob });
      let data = {};
      try { data = await res.json(); } catch { /* not JSON */ }
      last = { ok: res.ok, status: res.status, data };
      if (res.ok || (res.status < 500 && res.status !== 429)) return last;
      if (res.status === 503 && data?.error !== 'ai') return last;
    } catch { /* offline: tried again below */ }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return last;
}

// A picture: its ticket (with the human check, and its box ticked: consent), then its bytes, looked at by our server.
// act: the app's request helper (ctx.act). → { ok: true, id, real } (real: a photo of a real person, so its influencer stays
// private) or { ok: false, error, why? }
export async function uploadPicture(act, { blob, consent = false, human }) {
  const open = await act('inf-up-open', { kind: 'picture', bytes: blob.size, adult: true, consent: consent === true }, { human });
  if (!open.ok || !open.data?.ticket) return { ok: false, error: open.data?.error || 'busy', why: open.data?.why };
  // (sendBytes sends it once more when the AI check didn't answer: nothing was kept, the same ticket works)
  const r = await sendBytes(`inf-up=${encodeURIComponent(open.data.ticket)}&part=0`, blob);
  if (r.ok && r.data?.ok) return { ok: true, id: r.data.id || open.data.id, real: r.data.real === true };
  return { ok: false, error: r.data?.error || 'busy', why: r.data?.why };
}

// A clip: its ticket, its parts, its frames, then "done" (put together and looked at). onProgress(sent, of)
// → { ok: true, id, seconds } or { ok: false, error, why? }
export async function uploadClip(act, { file, frames, human, onProgress = () => {} }) {
  const open = await act('inf-up-open', { kind: 'clip', bytes: file.size, adult: true }, { human });
  if (!open.ok || !open.data?.ticket) return { ok: false, error: open.data?.error || 'busy', why: open.data?.why };
  const { ticket, part, parts } = open.data;
  const t = encodeURIComponent(ticket);
  const steps = parts + frames.length;
  let sent = 0;
  for (let i = 0; i < parts; i++) {
    const r = await sendBytes(`inf-up=${t}&part=${i}`, file.slice(i * part, Math.min(file.size, (i + 1) * part)));
    if (!r.ok) return { ok: false, error: r.data?.error || 'busy', why: r.data?.why };
    onProgress(++sent, steps);
  }
  for (const [i, f] of frames.entries()) {
    const r = await sendBytes(`inf-up=${t}&frame=${i}`, f);
    if (!r.ok) return { ok: false, error: r.data?.error || 'busy', why: r.data?.why };
    onProgress(++sent, steps);
  }
  let done = await act('inf-up-done', { ticket });
  if (!done.ok && done.data?.error === 'ai') done = await act('inf-up-done', { ticket });
  if (done.ok && done.data?.ok) return { ok: true, id: done.data.id, seconds: done.data.seconds };
  return { ok: false, error: done.data?.error || 'busy', why: done.data?.why };
}

// ---------- posters ----------
// A frame of one of its done videos (our own address), a little way in. → a JPEG Blob, or null
export async function frameOf(src, { at = 1.2, maxPx = 480 } = {}) {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  const once = (type, ms = 20_000) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('poster')), ms);
    video.addEventListener(type, () => { clearTimeout(t); resolve(); }, { once: true });
    video.addEventListener('error', () => { clearTimeout(t); reject(new Error('poster')); }, { once: true });
  });
  try {
    video.src = src;
    await once('loadeddata');
    const d = Number.isFinite(video.duration) ? video.duration : 5;
    video.currentTime = Math.min(Math.max(0.1, d - 0.1), at);
    await once('seeked');
    return await canvasJpeg(video, video.videoWidth, video.videoHeight, { maxPx, maxBytes: PICTURE.POSTER_BYTES });
  } catch {
    return null;
  } finally {
    video.removeAttribute('src');
    video.load();
  }
}
// its poster sent with its ticket (our server looks at it next to the influencer's look first). → true when kept
export async function sendPoster(ticket, blob) {
  const r = await sendBytes(`inf-poster=${encodeURIComponent(ticket)}`, blob);
  return r.ok && r.data?.ok === true;
}
// Several posters, one at a time, in the background (a page's done videos without one): never more than `most`
export async function makePosters(tickets, srcOf, { most = 6, alive = () => true } = {}) {
  let made = 0;
  for (const [job, ticket] of Object.entries(tickets || {}).slice(0, most)) {
    if (!alive()) return made;
    const blob = await frameOf(srcOf(job));
    if (!blob || !alive()) continue;
    if (await sendPoster(ticket, blob)) made++;
  }
  return made;
}
