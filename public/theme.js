// Runs before the page paints (a plain script in <head>), so the page never flashes the wrong theme or look.
// Uses the visitor's saved choices, or else the site's defaults: Pop mode, in the dark theme (since 2026-09-28, the owner:
// "make the pop mode open on default, in dark mode"). Saved as dr-theme = light | dark and dr-skin = pop | lab (lab = the
// visitor switched Pop mode off). src/theme.js adds the toggle buttons and saves the choices.
(function () {
  var theme = null, skin = null;
  try { theme = localStorage.getItem('dr-theme'); skin = localStorage.getItem('dr-skin'); } catch (e) { /* private mode: the defaults */ }
  if (theme !== 'light' && theme !== 'dark') theme = 'dark';
  var pop = skin !== 'lab';
  var root = document.documentElement;
  root.setAttribute('data-theme', theme);
  if (pop) root.setAttribute('data-skin', 'pop');
  // the phone's browser bar matches the top of the page from the first paint (Pop mode: its violet hero, or on the diary
  // page, which has no hero, the page's own color). src/theme.js keeps it up to date (barColor there must say the same)
  var dark = theme === 'dark', diary = root.getAttribute('data-page') === 'diary';
  var bar = document.querySelector('meta[name="theme-color"]');
  if (bar) bar.setAttribute('content', pop ? (diary ? (dark ? '#120828' : '#f8f5ff') : (dark ? '#2a0f7a' : '#6b3bff')) : (dark ? '#0b0b0c' : '#fafaf8'));
})();
