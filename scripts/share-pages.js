// Runs after `vite build` (part of `npm run build`). Phase 5 share links:
// 1. writes dist/share/level-<name>.html: tiny pages that exist so X (and other apps) show the right picture under a
//    shared link. People who open one are sent on to the Playground by /share/go.js (crawlers don't run scripts, so they
//    read the preview tags). (The Arena's champion pages left with the Arena on 2026-09-28.)
// 2. puts the site's address into the preview tags of dist/index.html, dist/diary.html, (2026-10-02) dist/live.html,
//    (2026-10-10) dist/studio.html, (2026-10-14) the roadmap's four pages, (2026-10-19) the game's page,
//    dist/rideemagi.html, and (2026-10-20) the second game's, dist/trenchingsimulator.html (__SITE__).
// Link previews need full addresses. They come from Vercel's VERCEL_PROJECT_PRODUCTION_URL (the production domain), so
// the next build uses agi1.app (the project's domain) by itself. SITE_URL overrides it (tests, previews).
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { LEVELS } from '../src/lib/levels.js';
import { MEMES, thumbOf } from '../src/memes/list.js';
import sharp from 'sharp';

export function siteUrl(env = process.env) {
  const raw = env.SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://agi1.app');
  return raw.replace(/\/+$/, '');
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function sharePage({ site, title, description, image, go }) {
  return `<!doctype html>
<html lang="en" data-go="${esc(go)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AGI">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(site + image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(title)}">
<meta property="og:url" content="${esc(site + go)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${esc(site + go)}">
<script src="/share/go.js"></script>
</head>
<body>
<p><a href="${esc(go)}">${esc(title)} →</a></p>
</body>
</html>
`;
}

export function allSharePages(site) {
  const pages = {};
  const note = 'A parody. Entertainment only, not financial advice.';
  for (const l of LEVELS) {
    const id = l.name.toLowerCase();
    pages[`level-${id}`] = sharePage({
      site, go: '/#playground', image: `/cards/level-${id}.png`,
      title: `${l.name} · relationship level ${l.level} of ${LEVELS.length} with AGI-1`,
      description: `Talk to AGI-1, the Artificial Girlfriend Intelligence. ${note}`,
    });
  }
  return pages;
}

// the card pictures every share page needs (public/cards/, see "Share cards" in CLAUDE.md; games.jpg since 2026-10-19, AGI
// games' own, made from tools/cards/games-card.html; trenchingsimulator.jpg since 2026-10-20, its second game's, made from
// tools/cards/trenchingsimulator-card.html)
export const neededCards = () => [...LEVELS.map((l) => `level-${l.name.toLowerCase()}.png`), 'diary.png', 'home.jpg', 'roadmap.jpg',
  'games.jpg', 'trenchingsimulator.jpg'];
export const neededGameArt = () => ['images/vladrunner2049/keyart.webp'];

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const site = siteUrl();
  const missing = [...neededCards().map((f) => `cards/${f}`), ...neededGameArt()].filter((f) => !existsSync(`dist/${f}`));
  if (missing.length) {
    console.error(`✗ share preview images missing in public/: ${missing.join(', ')}`);
    process.exit(1);
  }
  mkdirSync('dist/share', { recursive: true });
  // JPEG copies of each video's actual poster work across social preview crawlers.
  mkdirSync('dist/memes/share', { recursive: true });
  for (const meme of MEMES.filter(m => m.kind !== 'image')) {
    await sharp(`public${thumbOf(meme)}`).jpeg({ quality: 88 }).toFile(`dist/memes/share/agi-${meme.id}.jpg`);
  }
  for (const [name, html] of Object.entries(allSharePages(site))) writeFileSync(`dist/share/${name}.html`, html);
  for (const page of ['dist/index.html', 'dist/diary.html', 'dist/live.html', 'dist/studio.html', 'dist/roadmap.html', 'dist/stake.html',
    'dist/games.html', 'dist/giveaway.html', 'dist/rideemagi.html', 'dist/trenchingsimulator.html', 'dist/vladrunner2049.html', 'dist/memes.html',
    'dist/vote.html']) {
    if (existsSync(page)) writeFileSync(page, readFileSync(page, 'utf8').replaceAll('__SITE__', site));
  }
  console.log(`✓ share pages written for ${site}`);
}
