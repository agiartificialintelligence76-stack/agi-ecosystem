// Light / dark theme, and Pop mode. /theme.js (in public/) already picked both before the page painted.
// This adds the toggle buttons, remembers the visitor's choices, and follows the system setting until the visitor picks a
// theme. Other code (the 3D stage) listens for the 'agi:theme' and 'agi:skin' events.
// Pop mode (2026-09-27, the owner's idea): the whole page in the $AGI ecosystem site's look (agi1.app): same content, other
// design (src/styles/pop.css, everything under [data-skin="pop"]). Off until the visitor presses the ✦ button next to the
// theme button (on very small phones, "Pop mode" in the menu); remembered in this browser (dr-skin).
const KEY = 'dr-theme';
const SKIN_KEY = 'dr-skin';
const root = document.documentElement;
const systemDark = matchMedia('(prefers-color-scheme: dark)');

const saved = () => {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null; // private mode: nothing saved
  }
};

const savedSkin = () => {
  try {
    return localStorage.getItem(SKIN_KEY) === 'pop' ? 'pop' : null;
  } catch {
    return null;
  }
};

export const currentTheme = () => (root.dataset.theme === 'dark' ? 'dark' : 'light');
export const currentSkin = () => (root.dataset.skin === 'pop' ? 'pop' : 'lab');

// the phone's browser bar: the color at the top of the page (Pop mode: its violet hero, or on the diary page, which has no
// hero, the page's own color). The same colors as /theme.js, which sets it before the page paints.
export function barColor(skin, theme, diary) {
  const dark = theme === 'dark';
  if (skin !== 'pop') return dark ? '#0b0b0c' : '#fafaf8';
  if (diary) return dark ? '#120828' : '#f8f5ff';
  return dark ? '#2a0f7a' : '#6b3bff';
}
function paintBar() {
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', barColor(currentSkin(), currentTheme(), root.dataset.page === 'diary'));
}

function apply(theme, remember) {
  root.dataset.theme = theme;
  if (remember) {
    try { localStorage.setItem(KEY, theme); } catch { /* private mode: works for this visit only */ }
  }
  paintBar();
  for (const button of document.querySelectorAll('[data-theme-toggle]')) {
    button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }
  dispatchEvent(new CustomEvent('agi:theme', { detail: theme }));
}

function applySkin(skin, remember) {
  if (skin === 'pop') root.dataset.skin = 'pop';
  else delete root.dataset.skin;
  if (remember) {
    try {
      if (skin === 'pop') localStorage.setItem(SKIN_KEY, 'pop');
      else localStorage.removeItem(SKIN_KEY);
    } catch { /* private mode: works for this visit only */ }
  }
  paintBar();
  for (const button of document.querySelectorAll('[data-skin-toggle]')) {
    button.setAttribute('aria-pressed', String(skin === 'pop'));
    const state = button.querySelector('.nav-pop-state');
    if (state) state.textContent = skin === 'pop' ? 'On' : 'Off';
  }
  dispatchEvent(new CustomEvent('agi:skin', { detail: skin }));
}

// ---------- keeping your place (2026-09-27, the owner: "when i click pop mode it goes to a different section") ----------
// Switching the look changes the size of almost everything (Pop mode's sections are taller, its headlines bigger), and the
// browser keeps the number of pixels scrolled, not what you were reading, so the screen showed another part of the page.
// (Browsers' own "scroll anchoring" steps aside when the spacing of sections changes, and older Safaris don't have it.)
// So: before a switch, note what's on screen a little under the top bar; after it, scroll so that the same thing is in the
// same spot; and once more when Pop mode's fonts have arrived (they make its headlines bigger), unless the visitor has
// scrolled or pressed anything in between.
const POP_FONTS = ['900 1em Anybody', 'italic 400 1em "Instrument Serif"'];
const barBottom = () => document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0;

// what to hold on to under a point: the innermost block (not text, a drawing or an icon); never something that stays put
// on the screen (the top bar and its menu, her live view strip on phones, a dialog); a box that scrolls by itself (her
// chat's messages) as a whole
function anchorOf(hit) {
  let found = null;
  for (let el = hit; el && el !== document.body && el !== root; el = el.parentElement) {
    const cs = getComputedStyle(el);
    if (cs.position === 'sticky' || cs.position === 'fixed' || el.tagName === 'DIALOG') return null;
    if (!found && !(el instanceof SVGElement) && el.tagName !== 'CANVAS' && cs.display !== 'inline' && cs.display !== 'contents') found = el;
    if (found && /auto|scroll/.test(cs.overflowY) && el.scrollHeight > el.clientHeight) found = el;
  }
  return found;
}

// the middle of the screen first (where people read), then above and below it; something the size of a paragraph, a card
// or a row is best: a whole section (the point fell in its spacing) only if nothing smaller is found
function findSpot() {
  if (scrollY < 1) return null;                        // at the very top: it stays at the top
  const top = barBottom(), room = innerHeight - top, x = innerWidth / 2;
  let fallback = null;
  for (const f of [0.5, 0.3, 0.7, 0.15, 0.85]) {
    const y = top + room * f;
    for (const hit of document.elementsFromPoint(x, y)) {
      const el = anchorOf(hit);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.height < 1) continue;
      const spot = { el, off: y - top, at: Math.min(1, Math.max(0, (y - r.top) / r.height)) };
      if (r.height <= room * 0.6) return spot;
      fallback ??= spot;
      break;
    }
  }
  return fallback;
}

function jump(dy) {
  try {
    scrollBy({ top: dy, behavior: 'instant' });       // (the page scrolls smoothly otherwise)
  } catch {
    const was = root.style.scrollBehavior;             // older browsers that don't know "instant"
    root.style.scrollBehavior = 'auto';
    scrollBy(0, dy);
    root.style.scrollBehavior = was;
  }
}

function restore(spot) {
  if (!spot.el.isConnected) return;
  const r = spot.el.getBoundingClientRect();
  const dy = r.top + spot.at * r.height - (barBottom() + spot.off);
  if (Math.abs(dy) >= 1) jump(dy);
}

function keepPlace(change) {
  const spot = findSpot();
  change();
  if (!spot) return;
  restore(spot);
  if (currentSkin() !== 'pop' || !document.fonts || POP_FONTS.every((f) => document.fonts.check(f))) return;
  let touched = false;
  const touch = () => { touched = true; };
  const inputs = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
  for (const type of inputs) addEventListener(type, touch, { capture: true, passive: true });
  const fonts = Promise.all(POP_FONTS.map((f) => document.fonts.load(f).catch(() => null)));
  Promise.race([fonts, new Promise((done) => setTimeout(done, 4000))]).then(() => requestAnimationFrame(() => {
    for (const type of inputs) removeEventListener(type, touch, { capture: true });
    if (!touched) restore(spot);
  }));
}

export function startTheme() {
  apply(saved() || currentTheme(), false);
  applySkin(savedSkin() || currentSkin(), false);   // (the saved choice too: browsers keep /theme.js a day, so an older copy may not know Pop mode yet)
  systemDark.addEventListener('change', (e) => { if (!saved()) apply(e.matches ? 'dark' : 'light', false); });
  for (const button of document.querySelectorAll('[data-theme-toggle]')) {
    // (in Pop mode the night look has thinner outlines, so a few things move a little: keep the place there too)
    button.addEventListener('click', () => keepPlace(() => apply(currentTheme() === 'dark' ? 'light' : 'dark', true)));
  }
  for (const button of document.querySelectorAll('[data-skin-toggle]')) {
    button.addEventListener('click', () => keepPlace(() => applySkin(currentSkin() === 'pop' ? 'lab' : 'pop', true)));
  }
}
