// HALLUCINATION (2026-11-08): stills of the `?demo` preview at chosen moments, with the same fake clock as
// tools/games/capture-previews.mjs (the recorder films 5.7 … 11.7 s after the page opens), to check what it shows.
//   node tools/games/hallucination/demo-frames.cjs <url> <out-prefix> [480x480] [6000,9000,11700]
const { chromium } = require('playwright');
const [url, outPrefix, vp = '480x480', times = '6000,9000,11700'] = process.argv.slice(2);
(async () => {
  const [w, h] = vp.split('x').map(Number);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1.25, reducedMotion: 'no-preference' });
  await ctx.addInitScript("try { sessionStorage.setItem('agi_intro', '1'); localStorage.setItem('agi_arcade:settings', JSON.stringify({ sound: false, music: false, haptics: false })); } catch {}");
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: new Date('2026-11-08T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-08T12:00:01Z'));
  await page.goto(url, { waitUntil: 'load' });
  let t = 0;
  for (const target of times.split(',').map(Number)) {
    while (t < target) { await page.clock.runFor(1000 / 30); t += 1000 / 30; }
    await page.screenshot({ path: `${outPrefix}-${target}.png` });
  }
  console.log(errors.length ? `page errors: ${errors.join(' | ')}` : 'ok');
  await browser.close();
})();
