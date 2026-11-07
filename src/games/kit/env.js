// AGI arcade kit (2026-11-08): what the page knows about where it runs, read once.
//
// `?demo` plays the game by itself (its own AI), muted, with nothing saved and no play counted: it's how the gameplay
// previews on agi1.app/games are recorded (tools/games/capture-previews.mjs), and it never reaches a player by a link
// from the site. `?seed=<n>` makes a demo (or a run) repeat exactly.
const q = (() => { try { return new URLSearchParams(location.search); } catch { return new URLSearchParams(); } })();
const mq = (query) => { try { return matchMedia(query).matches; } catch { return false; } };

export const DEMO = q.has('demo');
export const SEED = (() => { const n = Number(q.get('seed')); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0; })();
export const QUERY = q;

// "reduce motion": no screen shake, no flashes, softer particles (games read it through `motion()`)
export const REDUCED = mq('(prefers-reduced-motion: reduce)');
// a touchscreen is the main way in (phones and tablets); a laptop with a touchscreen still gets its keyboard hints
export const TOUCH = mq('(pointer: coarse)') || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && !mq('(pointer: fine)'));
export const IOS = typeof navigator !== 'undefined' && (/iP(hone|ad|od)/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
// the Fullscreen API (iPhone Safari has none: the button hides there)
export const CAN_FULLSCREEN = typeof document !== 'undefined' && Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);
export const CAN_VIBRATE = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export const motion = () => !REDUCED;
