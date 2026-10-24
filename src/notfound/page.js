// 404 NOT_FOUND (2026-10-24): 404.html, which Vercel serves for every address with no page. Starts the theme and the
// phone menu like the other pages, and shows the address the visitor tried (textContent only, never HTML).
// No inline code or styles anywhere (the site's CSP). The look: src/styles/notfound.css.
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/layout.css';
import '../styles/sections.css';
import '../styles/footer.css';
import '../styles/diary.css';      // (the short safety paragraph above the bottom bar)
import '../styles/pop.css';        // Pop mode: the bold look, only while it's switched on
import '../styles/notfound.css';
import { startTheme } from '../theme.js';
import { startMenu } from '../menu.js';

startTheme();
startMenu();

const MAX = 80;
export function shownPath(pathname) {
  let p = String(pathname || '');
  try { p = decodeURIComponent(p); } catch { /* a broken escape: show it as it came */ }
  if (!p || p === '/' || p === '/404' || p === '/404.html') return '';
  return p.length > MAX ? `${p.slice(0, MAX - 1)}…` : p;
}

const box = document.querySelector('[data-nf-path]');
const value = document.querySelector('[data-nf-path-v]');
const path = shownPath(location.pathname);
if (box && value && path) {
  value.textContent = path;
  box.hidden = false;
}
