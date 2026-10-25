import { siteContentGet } from './site-content.js';
import { mergeMemes, fileOf, thumbOf } from '../src/memes/list.js';

const SITE = 'https://agi1.app';
const esc = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const error = status => new Response(status === 404 ? 'Meme not found.' : 'Preview unavailable.', { status, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' } });

// Crawlers receive metadata without running JavaScript. People continue to the normal viewer.
export async function memeShare(cfg, id, { getContent = siteContentGet } = {}) {
  if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(id)) return error(400);
  try {
    const response = await getContent(cfg);
    if (!response.ok) return error(503);
    const { document } = await response.json();
    const meme = mergeMemes(document?.memes).find(m => m.id === id);
    if (!meme) return error(404);
    const path = `/share/meme/${id}`, go = `/memes?m=${id}`;
    const title = `${meme.title} · AGI`;
    const description = meme.note || (meme.kind === 'image' ? 'View and download this AGI meme.' : 'Watch and download this AGI video.');
    const source = meme.kind === 'image' ? fileOf(meme) : meme.custom ? thumbOf(meme) : `/memes/share/agi-${id}.jpg`;
    const image = source ? new URL(source, SITE).href : '';
    const html = `<!doctype html>
<html lang="en" data-go="${esc(go)}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="AGI">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE + path}">
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}">
${image ? `<meta property="og:image" content="${esc(image)}"><meta property="og:image:alt" content="${esc(meme.title)}"><meta name="twitter:image" content="${esc(image)}">` : ''}
<link rel="canonical" href="${SITE + path}"><script src="/share/go.js"></script>
</head><body><p><a href="${esc(go)}">${esc(title)}</a></p></body></html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=30' } });
  } catch { return error(503); }
}
