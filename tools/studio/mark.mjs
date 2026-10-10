// AGI Studio's share mark (2026-10-10, round 2: the owner's flywheel, "Share mark"): the little "Made with AGI Studio" pill
// put on photos and videos people download (server/inf-mark.js), so every post that travels says where it was made, and that
// it's AI-generated. Drawn once here in Chromium with the site's own font (Geist), into server/media/studio-mark.png (a PNG
// with a transparent background, twice its size): our server only scales and places it (sharp, ffmpeg), so it needs no fonts.
// Not part of the website. Run again after changing its words or look:
//   node tools/studio/mark.mjs   (Chromium, and `npm install --no-save playwright-core`, like the other tools)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const pw = await import(process.env.PLAYWRIGHT_CORE || 'playwright-core').catch(() => null);
if (!pw) { console.error('playwright-core is missing: npm install --no-save playwright-core'); process.exit(1); }
const font = readFileSync(`${root}public/fonts/Geist-Variable.woff2`).toString('base64');
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: Geist; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 100 900; }
html, body { margin: 0; background: transparent; }
.mark { display: inline-flex; align-items: center; gap: 11px; padding: 9px 20px 9px 9px; border-radius: 999px;
  background: rgba(7, 7, 10, 0.68); border: 1.5px solid rgba(255, 255, 255, 0.16); font-family: Geist, sans-serif; }
.spark { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center;
  background: radial-gradient(circle at 30% 25%, #ff7ab8, #ff3d9a 55%, #a24bff); box-shadow: 0 0 14px rgba(255, 61, 154, 0.55); }
.t { display: flex; flex-direction: column; line-height: 1.12; }
b { color: #fff; font-size: 17px; font-weight: 750; letter-spacing: -0.01em; }
span { color: rgba(245, 245, 247, 0.82); font-size: 12px; font-weight: 520; letter-spacing: 0.01em; }
</style><div class="mark"><div class="spark"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
<path fill="#fff" d="M12 1.5c.6 4.6 2.9 6.9 7.5 7.5v.9c-4.6.6-6.9 2.9-7.5 7.5h-.9c-.6-4.6-2.9-6.9-7.5-7.5V9c4.6-.6 6.9-2.9 7.5-7.5z" transform="translate(.5 2.5)"/>
</svg></div><div class="t"><b>Made with AGI Studio</b><span>AI-generated · studio.agi1.app</span></div></div>`;
const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 600, height: 200 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
const png = await page.locator('.mark').screenshot({ omitBackground: true });
await browser.close();
writeFileSync(`${root}server/media/studio-mark.png`, png);
console.log(`server/media/studio-mark.png: ${png.length} bytes`);
