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
  // Full-screen talk (2026-10-02): agi1.app/talk is the home page showing only her chat and AGI-1, filling the screen
  // (src/chat/fullscreen.js, src/styles/fullscreen.css). Decided here, before the page paints, so nothing else flashes first
  var page = root.getAttribute('data-page'), talk = false;
  try { talk = page === 'home' && /^\/talk\/?$/.test(location.pathname); } catch (e) { /* no address to read: the page as usual */ }
  if (talk) {
    root.classList.add('is-talk');
    document.title = 'Talk to AGI-1 · AGI';
  }
  // the phone's browser bar matches the top of the page from the first paint (Pop mode: its violet hero, or on the diary
  // and launch pages, which have no hero, the page's own color; full-screen talk: the color around her). src/theme.js keeps
  // it up to date (barColor there must say the same)
  var dark = theme === 'dark', diary = page === 'diary' || page === 'launch';
  var bar = document.querySelector('meta[name="theme-color"]');
  if (bar) {
    bar.setAttribute('content', talk ? (pop ? (dark ? '#1a0d3d' : '#e4d9ff') : (dark ? '#0b0b0c' : '#fafaf8'))
      : pop ? (diary ? (dark ? '#120828' : '#f8f5ff') : (dark ? '#2a0f7a' : '#6b3bff')) : (dark ? '#0b0b0c' : '#fafaf8'));
  }

  // The front (2026-09-28, the home page only): a visit that starts at the top gets its entrance (lp-intro), and the first
  // visit of a browser session its loader too (lp-loading). src/landing/landing.js plays both and ends them; with "reduce
  // motion" src/styles/landing.css shows neither. A link to a section (a #hash) skips both, and so does full-screen talk
  // (the front isn't shown there). The safety net: if that script hasn't started 7 s from now, the page shows itself anyway.
  try {
    if (root.getAttribute('data-page') === 'home' && !location.hash && !talk) {
      root.classList.add('lp-intro');
      var seen = '1';
      try { seen = sessionStorage.getItem('agi-seen'); } catch (e) { /* no storage: no loader (it would play on every visit) */ }
      if (!seen) root.classList.add('lp-loading');
      setTimeout(function () {
        if (root.classList.contains('lp-live')) return;
        root.classList.add('lp-go');
        root.classList.remove('lp-loading');
      }, 7000);
    }
  } catch (e) { /* the page just shows without its entrance */ }
})();
