// Runs before the page paints (a plain script in <head>), so the page never flashes the wrong theme or look.
// Uses the visitor's saved choice, or else their system setting. src/theme.js adds the toggle buttons.
// Pop mode (2026-09-27): the $AGI ecosystem site's look, only when the visitor switched it on (saved as dr-skin = pop).
(function () {
  var theme = null, skin = null;
  try { theme = localStorage.getItem('dr-theme'); skin = localStorage.getItem('dr-skin'); } catch (e) { /* private mode: follow the system */ }
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  var root = document.documentElement;
  root.setAttribute('data-theme', theme);
  if (skin === 'pop') root.setAttribute('data-skin', 'pop');
  // the phone's browser bar matches the top of the page from the first paint (Pop mode: its violet hero, or on the diary
  // page, which has no hero, the page's own color). src/theme.js keeps it up to date (barColor there must say the same)
  var pop = skin === 'pop', dark = theme === 'dark', diary = root.getAttribute('data-page') === 'diary';
  var bar = document.querySelector('meta[name="theme-color"]');
  if (bar) bar.setAttribute('content', pop ? (diary ? (dark ? '#120828' : '#f8f5ff') : (dark ? '#2a0f7a' : '#6b3bff')) : (dark ? '#0b0b0c' : '#fafaf8'));
})();
