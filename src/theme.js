// Light / dark theme, and Pop mode. /theme.js (in public/) already picked both before the page painted.
// This adds the toggle buttons and remembers the visitor's choices. Other code (the 3D stage) listens for the 'agi:theme'
// and 'agi:skin' events.
// Pop mode (2026-09-27, the owner's idea): the whole page in the bold $AGI look: same content, other design
// (src/styles/pop.css, everything under [data-skin="pop"]). Since 2026-09-28 it's the default, in the dark theme (the owner:
// "make the pop mode open on default, in dark mode"). The ✦ button next to the theme button (on very small phones, "Pop mode"
// in the menu) switches it off and on; both choices are remembered in this browser (dr-skin = pop | lab, dr-theme).
const KEY = 'dr-theme';
const SKIN_KEY = 'dr-skin';
export const DEFAULT_THEME = 'dark';
export const DEFAULT_SKIN = 'pop';
const root = document.documentElement;

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
    const skin = localStorage.getItem(SKIN_KEY);
    return skin === 'pop' || skin === 'lab' ? skin : null;
  } catch {
    return null;
  }
};

export const currentTheme = () => (root.dataset.theme === 'dark' ? 'dark' : 'light');
export const currentSkin = () => (root.dataset.skin === 'pop' ? 'pop' : 'lab');

// the phone's browser bar: the color at the top of the page (Pop mode: its violet hero, or on the diary, launch and live pages,
// which have no hero, the page's own color; full-screen talk, 2026-10-02: the color around her, which is also the title bar
// of the installed app). The same colors as /theme.js, which sets it before the page paints.
export function barColor(skin, theme, diary, talk = false) {
  const dark = theme === 'dark';
  if (skin !== 'pop') return dark ? '#0b0b0c' : '#fafaf8';
  if (talk) return dark ? '#1a0d3d' : '#e4d9ff';
  if (diary) return dark ? '#120828' : '#f8f5ff';
  return dark ? '#2a0f7a' : '#6b3bff';
}
export function paintBar() {
  const talk = Boolean(root.classList?.contains('is-talk'));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', barColor(currentSkin(), currentTheme(), ['diary', 'launch', 'live'].includes(root.dataset.page), talk));
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
    // "off" is saved too ('lab'): with nothing saved, the page opens in Pop mode
    try { localStorage.setItem(SKIN_KEY, skin === 'pop' ? 'pop' : 'lab'); } catch { /* private mode: works for this visit only */ }
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
  // the saved choices, else the defaults: the same as /theme.js (read here too, in case a browser still has an older copy)
  apply(saved() || DEFAULT_THEME, false);
  applySkin(savedSkin() || DEFAULT_SKIN, false);
  for (const button of document.querySelectorAll('[data-theme-toggle]')) {
    // (in Pop mode the night look has thinner outlines, so a few things move a little: keep the place there too)
    button.addEventListener('click', () => keepPlace(() => apply(currentTheme() === 'dark' ? 'light' : 'dark', true)));
  }
  for (const button of document.querySelectorAll('[data-skin-toggle]')) {
    button.addEventListener('click', () => keepPlace(() => applySkin(currentSkin() === 'pop' ? 'lab' : 'pop', true)));
  }
  // switched in another tab of this browser (2026-10-02: or behind her pop-out window, src/chat/popout.js): this one follows
  addEventListener('storage', (e) => {
    if (e.key === KEY) apply(saved() || DEFAULT_THEME, false);
    else if (e.key === SKIN_KEY) applySkin(savedSkin() || DEFAULT_SKIN, false);
  });
}
