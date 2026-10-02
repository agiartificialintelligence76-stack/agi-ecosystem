// "Show her" (2026-10-02, the owner: "does she see my screen? and help me?", then "all of that"). She can't see the
// visitor's screen by herself, ever: browsers don't let a site see it. With this button, the visitor picks one window (or
// screen) in the browser's own screen-sharing window; the page takes ONE picture of it and the sharing stops at once (never
// a recording, never a live view). The picture is shown to the visitor first, with a reminder to check it (no wallet,
// password or seed phrase), and goes to her with their next message only (src/chat/chat.js → /api/chat → the AI service).
// Nothing keeps it: not this page (the chat's history is text only), not our server (server/shot.js).
// Computers only: phones and tablets can't share a window. Works on the page, in full-screen talk and in her pop-out window
// (its frame is allowed to ask: src/chat/popout.js, and vercel.json's Permissions-Policy: display-capture=(self)).

export const SHOT_MAX_BYTES = 600_000;       // the server's limit too (server/shot.js)
const FRAME_WAIT = 6000;                     // ms: a window that sends no picture by then (minimized, closed) is given up on
const SIZES = [[1600, 0.82], [1600, 0.7], [1280, 0.7], [1024, 0.62], [800, 0.55]];   // (longest side in px, JPEG quality)
const nap = (ms) => new Promise((ok) => setTimeout(ok, ms));

// whether this browser can share a window: a computer with the browser's screen sharing (not a phone or a tablet)
export function canShow(win = globalThis) {
  try {
    if (typeof win.navigator?.mediaDevices?.getDisplayMedia !== 'function') return false;
    const media = (q) => { try { return Boolean(win.matchMedia?.(q).matches); } catch { return false; } };
    return !(media('(pointer: coarse)') && !media('(any-pointer: fine)'));
  } catch {
    return false;
  }
}

// the picture's longest side and quality, smaller and smaller until it fits (screen text stays readable at 1600 px)
export function sizeFor(width, height, step = 0) {
  const [side, quality] = SIZES[Math.min(step, SIZES.length - 1)];
  const k = Math.min(1, side / Math.max(width, height, 1));
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)), quality };
}
export const SIZE_STEPS = SIZES.length;

// bytes → base64 (in pieces: a picture is a few hundred KB)
export function base64Of(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// One picture of the window the visitor picks. → { data (base64 JPEG), url (for the preview: revoke it when done), width,
// height, bytes } · null when they cancelled; throws when the picture couldn't be made (err.code 'system': the computer
// itself doesn't let the browser share its screen, e.g. a Mac's Screen Recording setting).
export async function takeShot(doc = document) {
  const win = doc.defaultView || globalThis;
  let stream;
  try {
    stream = await win.navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'window', frameRate: { ideal: 5, max: 10 } },
      audio: false,
      selfBrowserSurface: 'exclude',        // (not this page itself)
      surfaceSwitching: 'exclude',
      monitorTypeSurfaces: 'include',
    });
  } catch (err) {
    if (err?.name === 'NotAllowedError' && /system/i.test(err.message || '')) throw Object.assign(new Error('screen sharing is off on this computer'), { code: 'system' });
    if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') return null;
    throw err;
  }
  const video = doc.createElement('video');
  try {
    const track = stream.getVideoTracks()[0];
    if (!track) throw new Error('no picture came from that window');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    video.play().catch(() => { /* (a window that sends nothing: the wait below gives up) */ });
    // the window's first real frame (it can take a moment to arrive; a minimized or closed window sends none)
    const until = Date.now() + FRAME_WAIT;
    while (!(video.videoWidth >= 16 && video.videoHeight >= 16 && video.readyState >= 2)) {
      if (track.readyState === 'ended') throw new Error('the sharing ended before a picture came');
      if (Date.now() > until) throw new Error('no picture came from that window');
      await nap(50);
    }
    if (typeof video.requestVideoFrameCallback === 'function') {
      await Promise.race([new Promise((ok) => video.requestVideoFrameCallback(() => ok())), nap(600)]);
    }
    if (track.readyState === 'ended') throw new Error('the sharing ended before a picture came');
    const canvas = doc.createElement('canvas');
    let blob = null, size = null;
    for (let step = 0; step < SIZE_STEPS; step += 1) {
      size = sizeFor(video.videoWidth, video.videoHeight, step);
      canvas.width = size.width;
      canvas.height = size.height;
      canvas.getContext('2d').drawImage(video, 0, 0, size.width, size.height);
      blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', size.quality));
      if (blob && blob.size <= SHOT_MAX_BYTES) break;
    }
    if (!blob || blob.size > SHOT_MAX_BYTES) throw new Error('the picture is too big');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return { data: base64Of(bytes), url: URL.createObjectURL(blob), width: size.width, height: size.height, bytes: bytes.length };
  } finally {
    // the sharing stops at once: one picture, never a recording
    for (const track of stream.getTracks()) track.stop();
    video.srcObject = null;
  }
}
