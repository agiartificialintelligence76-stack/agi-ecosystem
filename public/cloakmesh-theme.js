// CloakMesh's page (inference.agi1.app, 2026-10-03): picks light or dark before the page paints, so it never flashes the
// wrong one: the visitor's saved choice (cm-theme), else their device's setting, else dark. Also sets the phone's
// browser-bar color to match. src/cloakmesh/page.js adds the toggle button and saves the choice. (The rest of the site uses
// /theme.js, which also picks Pop mode: CloakMesh has one look.)
(function () {
  var theme = null;
  try { theme = localStorage.getItem('cm-theme'); } catch (e) { /* private mode: the device's setting */ }
  if (theme !== 'light' && theme !== 'dark') {
    var light = false;
    try { light = window.matchMedia('(prefers-color-scheme: light)').matches; } catch (e) { /* dark */ }
    theme = light ? 'light' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', theme);
  var bar = document.querySelector('meta[name="theme-color"]');
  if (bar) bar.setAttribute('content', theme === 'dark' ? '#090b0d' : '#f5f6f3');
})();
