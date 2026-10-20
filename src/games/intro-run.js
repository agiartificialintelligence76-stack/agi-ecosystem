// AGI GAMES intro, on the screen (2026-10-20, the owner: "can you add a short loading screen for every game like an
// intro "AGI GAMES" its gonna an 8bit version of AGI and the loading is like her smashing up the word AGI GAMES and its
// gonna go bigger"): draws ./intro-plan.js's scene on a canvas over the game while the game starts, about 2.5 s (1.2 s
// for a later load in the same tab), then a pixel wipe shows the game. A tap or a key skips it (the wipe at once, and
// that tap or key never reaches the game); "reduce motion" gets one still card; a page that came very late gets none.
// Everything it needs from the browser comes in env (browserEnv() below), so tests/intro.test.js runs it in Node with
// stand-ins. ./intro.js starts it on a game's page; its overlay is the page's own <div class="gi" id="agi-intro">, which
// ./intro.css shows from the first paint (and fades by itself after 4 s if this never runs).
import { SIZE, PALETTE, FRAMES } from './intro-sprite.js';
import { COLORS, BANDS, FULL, SHORT, makePlan, scene, stillScene, herBox } from './intro-plan.js';

export const KEY = 'agi_intro';      // sessionStorage: this tab has seen the full one (then the short one)
export const LATE_MS = 3500;         // the page took longer than this to get here: no intro (its overlay just fades)
export const SAFETY_MS = 6000;       // gone by then, whatever happens (a tab in the background, a very slow device)
export const STILL_MS = 900;         // "reduce motion": its still card this long
export const FADE_MS = 300;          // the overlay's fade (./intro.css's .is-fade)
export const MAX_STEP = 1 / 15;      // a slow frame moves it on at most this far (s): a stalled tab never jumps ahead
export const MAX_DPR = 3;            // at most 3 canvas pixels a CSS pixel
export const DONE = 'agi:intro-done';

// keys that never skip it and always reach the page: modifiers alone (a shortcut on its way, ⌘-Tab…)
const PASS_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'Fn', 'FnLock', 'OS', 'Hyper',
  'Super', 'NumLock', 'ScrollLock']);
// keys whose own action is stopped too (they'd scroll the page or press a button under it)
const STOP_KEYS = new Set(['Space', 'Enter', 'NumpadEnter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const CLICK_MS = 1200;               // a tap that skipped it: its click is swallowed for this long after
const KEYUP_MS = 5000;               // a key that skipped it: its keyup is swallowed for this long after

// Her frames as small canvases, one canvas pixel a sprite pixel (drawn bigger, never smoothed)
export function spriteFrames(makeCanvas) {
  const out = {};
  for (const [name, rows] of Object.entries(FRAMES)) {
    const c = makeCanvas();
    c.width = SIZE.w;
    c.height = SIZE.h;
    const g = c.getContext('2d');
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length;) {
        const ch = row[x];
        if (!PALETTE[ch]) { x++; continue; }
        let e = x + 1;
        while (e < row.length && row[e] === ch) e++;
        g.fillStyle = PALETTE[ch];
        g.fillRect(x, y, e - x, 1);
        x = e;
      }
    }
    out[name] = c;
  }
  return out;
}

// One frame of scene() on a canvas of P's size: the night and its stars, then (shaken) the letters' shadows, their
// faces (white for a moment, else banded light to deep honey row by row), the bits that fly off and AGI-1, then the
// flash, then the wipe's holes cleared (the game shows through them)
export function drawScene(ctx, P, S, sprites) {
  const sx = S.shake[0], sy = S.shake[1];
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(0, 0, P.W, P.H);
  ctx.fillStyle = COLORS.star;
  for (const [x, y, z, a] of S.stars) {
    ctx.globalAlpha = a;
    ctx.fillRect(x, y, z, z);
  }
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, sx, sy);
  ctx.fillStyle = COLORS.pink;
  for (const l of S.letters) for (const r of l.shadow) ctx.fillRect(r[0], r[1], r[2], r[3]);
  for (const l of S.letters) {
    for (const r of l.face) {
      ctx.fillStyle = l.color || BANDS[r[4]];
      ctx.fillRect(r[0], r[1], r[2], r[3]);
    }
  }
  for (const [x, y, z, c, a] of S.bits) {
    ctx.globalAlpha = a;
    ctx.fillStyle = c;
    ctx.fillRect(x, y, z, z);
  }
  ctx.globalAlpha = 1;
  if (S.her && sprites[S.her.frame]) {
    const b = herBox(S.her), w = b.right - b.left, h = b.bottom - b.top;
    if (S.her.flip < 0) {
      // mirrored mid-spin: x → (its box's right edge) − x
      ctx.setTransform(-1, 0, 0, 1, b.left + w + sx, sy);
      ctx.drawImage(sprites[S.her.frame], 0, b.top, w, h);
    } else ctx.drawImage(sprites[S.her.frame], b.left, b.top, w, h);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (S.flash > 0) {
    ctx.globalAlpha = S.flash;
    ctx.fillStyle = COLORS.white;
    ctx.fillRect(0, 0, P.W, P.H);
    ctx.globalAlpha = 1;
  }
  for (const h of S.holes) ctx.clearRect(h[0], h[1], h[2], h[3]);
}

// The intro over a game's page. root: its overlay (class "gi"). Returns a small handle (for the tests): skip(),
// stop(), state().
export function startIntro(root, env) {
  const win = env.win;
  let ended = false, still = false, raf = 0, t = 0, last = 0, skipAt = null, P = null, ctx = null, canvas = null;
  const timers = [];
  const held = new Set();     // keys this swallowed: their keyup is swallowed too
  let clickUntil = 0;         // a tap this swallowed: its click too, until then
  const later = (fn, ms) => { const id = env.setTimeout(fn, ms); timers.push(id); return id; };

  const swallow = (e) => {
    e.stopImmediatePropagation();
    if (STOP_KEYS.has(e.code)) e.preventDefault();
  };
  const onKeyDown = (e) => {
    // after it ended, only a key that skipped it and is still held down: its repeats, until it's let go
    if (ended) { if (held.has(e.code)) swallow(e); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || PASS_KEYS.has(e.key)) return;
    swallow(e);
    held.add(e.code);
    skip();
  };
  const dropKeys = () => {
    win.removeEventListener('keydown', onKeyDown, true);
    win.removeEventListener('keyup', onKeyUp, true);
  };
  const onKeyUp = (e) => {
    if (!held.has(e.code)) return;
    held.delete(e.code);
    swallow(e);
    if (ended && !held.size) dropKeys();
  };
  const onPointer = (e) => {
    e.stopImmediatePropagation();
    if (e.cancelable) e.preventDefault();
    clickUntil = env.now() + CLICK_MS;
    skip();
  };
  const onClick = (e) => {
    if (env.now() > clickUntil) return;
    clickUntil = 0;
    e.stopImmediatePropagation();
    if (e.cancelable) e.preventDefault();
  };
  const listen = () => {
    win.addEventListener('keydown', onKeyDown, true);
    win.addEventListener('keyup', onKeyUp, true);
    win.addEventListener('pointerdown', onPointer, true);
    win.addEventListener('click', onClick, true);
  };
  // when it ends: other keys and taps reach the game at once; a key or a tap that skipped it is still swallowed until
  // it's let go (its repeats and its keyup; a tap's click), or a moment later, so the game never sees only half of it
  const unlisten = () => {
    win.removeEventListener('pointerdown', onPointer, true);
    if (!held.size) dropKeys();
    else env.setTimeout(() => { held.clear(); dropKeys(); }, KEYUP_MS);
    if (env.now() >= clickUntil) win.removeEventListener('click', onClick, true);
    else env.setTimeout(() => win.removeEventListener('click', onClick, true), Math.ceil(clickUntil - env.now()) + 1);
  };

  function done() {
    try { root.remove(); } catch { /* gone already */ }
    try { env.emit(DONE); } catch { /* nobody listening */ }
  }
  // fadeOut: the overlay fades first (a still card, a late page); else it goes at once (the wipe already showed the
  // game)
  function end(fadeOut) {
    if (ended) return;
    ended = true;
    if (raf) env.caf(raf);
    raf = 0;
    for (const id of timers) env.clearTimeout(id);
    unlisten();
    if (fadeOut) {
      root.classList.add('is-fade');
      env.setTimeout(done, FADE_MS);
    } else done();
  }
  function skip() {
    if (ended) return;
    if (still) { end(true); return; }
    if (skipAt == null && P && t < P.tl.wipe.from) skipAt = t;
  }
  // the canvas at the window's size in device pixels (at most MAX_DPR), and its plan again when that changed
  function fit(tl) {
    const s = env.size() || {};
    const r = Math.min(MAX_DPR, s.dpr > 0 ? s.dpr : 1);
    const W = Math.max(1, Math.round((s.w || 1) * r)), H = Math.max(1, Math.round((s.h || 1) * r));
    if (P && P.W === W && P.H === H) return;
    canvas.width = W;
    canvas.height = H;
    ctx.imageSmoothingEnabled = false;
    P = makePlan(W, H, tl);
  }
  function frame(now) {
    raf = 0;
    if (ended) return;
    try {
      const dt = Math.max(0, Math.min(MAX_STEP, (now - last) / 1000));
      last = now;
      t += dt;
      fit(P.tl);
      const S = scene(P, t, { skipAt });
      drawScene(ctx, P, S, sprites);
      if (S.done) { end(false); return; }
      raf = env.raf(frame);
    } catch (err) {
      try { env.warn?.('[intro] stopped:', err); } catch { /* nowhere to say it */ }
      end(false);
    }
  }

  const state = () => ({ t, ended, still, skipAt, tl: P ? P.tl.name : null, W: P ? P.W : 0, H: P ? P.H : 0 });
  const handle = { skip, stop: () => end(false), state };

  // a page that took too long to get here: its overlay just fades (nobody waits for an intro after that)
  if (!(env.now() <= LATE_MS)) { end(true); return handle; }

  let seen = false;
  try {
    seen = env.storage?.getItem(KEY) === '1';
    env.storage?.setItem(KEY, '1');
  } catch { /* blocked: the full one every time */ }
  const tl = seen ? SHORT : FULL;
  let sprites;
  try {
    canvas = env.makeCanvas();
    canvas.className = 'gi-canvas';
    ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2D canvas');
    sprites = spriteFrames(env.makeCanvas);
    fit(tl);
    root.appendChild(canvas);
  } catch (err) {
    try { env.warn?.('[intro] not shown:', err); } catch { /* nowhere to say it */ }
    end(true);
    return handle;
  }
  listen();
  later(() => end(false), SAFETY_MS);
  let reduced = false;
  try { reduced = !!env.reduced(); } catch { /* assume motion is fine */ }
  if (reduced) {
    still = true;
    drawScene(ctx, P, stillScene(P), sprites);
    root.classList.add('is-live');
    later(() => end(true), STILL_MS);
  } else {
    // its first frame is on the canvas before the overlay's own night goes (no flash between the two)
    drawScene(ctx, P, scene(P, 0), sprites);
    root.classList.add('is-live');
    last = env.now();
    raf = env.raf(frame);
  }
  return handle;
}

// The browser's own things, for startIntro()
export function browserEnv() {
  let storage = null;
  try { storage = window.sessionStorage; } catch { /* blocked */ }
  return {
    win: window,
    storage,
    makeCanvas: () => document.createElement('canvas'),
    now: () => performance.now(),
    raf: (fn) => requestAnimationFrame(fn),
    caf: (id) => cancelAnimationFrame(id),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
    reduced: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    size: () => ({ w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 }),
    emit: (name) => window.dispatchEvent(new CustomEvent(name)),
    warn: (...args) => console.warn(...args),
  };
}
