// REAL OR AI? (2026-11-08): the photos, loaded only when they're about to be needed (the current one and the next two),
// decoded before they're shown (never a half-drawn photo), kept once loaded, tried again once if a load fails.
const cache = new Map();   // file → { img, state: 'loading' | 'ready' | 'error', tries, promise, w, h }

function start(entry, file) {
  entry.state = 'loading';
  entry.tries += 1;
  const img = new Image();
  img.decoding = 'async';
  entry.img = img;
  entry.promise = new Promise((resolve) => {
    let settled = false;
    const ok = () => {
      if (settled) return;
      settled = true;
      entry.state = 'ready';
      entry.w = img.naturalWidth || 900;
      entry.h = img.naturalHeight || 900;
      resolve(entry);
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      if (entry.tries < 2) { setTimeout(() => start(entry, file).then(resolve), 600); return; }
      entry.state = 'error';
      resolve(entry);
    };
    img.onload = () => {
      // decode() first where there is one, so the first frame that shows it doesn't stall
      if (typeof img.decode === 'function') img.decode().then(ok, ok); else ok();
    };
    img.onerror = fail;
    img.src = entry.tries > 1 ? `${file}?r=${entry.tries}` : file;
  });
  return entry.promise;
}

export function load(pic) {
  if (!pic) return Promise.resolve(null);
  let e = cache.get(pic.file);
  if (!e) {
    e = { img: null, state: 'idle', tries: 0, promise: null, w: 0, h: 0 };
    cache.set(pic.file, e);
    start(e, pic.file);
  }
  return e.promise;
}
export const entry = (pic) => (pic ? cache.get(pic.file) || null : null);
export const isReady = (pic) => entry(pic)?.state === 'ready';
export const failed = (pic) => entry(pic)?.state === 'error';
export const imageOf = (pic) => (isReady(pic) ? entry(pic).img : null);
export function prefetch(pics) { for (const p of pics) if (p) load(p); }
