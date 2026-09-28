// GET /api/logo?a=<coin address>&s=64|256: a coin's logo for the Arena and the stage's champion card (Phase 6).
// Why not show the picture straight from clank.trade? The page's security rules (CSP) only allow pictures from our own
// site, and the 3D stage can only paint pictures from our own site onto the champion card. So this fetches the logo from
// where clank.trade keeps it (its Pinata IPFS gateway, which also shrinks it to the size we ask for), checks that it's a
// real PNG, JPEG, WebP, GIF or AVIF of at most 1 MB, and serves it. Vercel's CDN keeps it for a week, so a logo costs
// about one function run per region per week.
// Only coins that are (or were) in the Arena have a logo here: never nominations, and never coins the owner removed.
import { getConfig } from '../server/config.js';
import { arenaRpc } from '../server/arena.js';
import { logoFetchUrl, safeLogoUrl, readLimited, looksLike, PICTURE_TYPES as TYPES, PICTURE_MAX_BYTES as MAX_BYTES } from '../server/coins.js';

const SIZES = new Set([64, 256]);
const fail = (status, error, cacheSeconds) => Response.json({ error }, {
  status, headers: { 'Cache-Control': cacheSeconds ? `public, max-age=0, s-maxage=${cacheSeconds}` : 'no-store' },
});

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const address = String(params.get('a') || '').toLowerCase();
  const size = Number(params.get('s') || 64);
  if (!/^0x[0-9a-f]{40}$/.test(address) || !SIZES.has(size)) return fail(400, 'bad_request', 86400);
  const cfg = getConfig();
  if (!cfg.supabaseUrl || !cfg.supabaseKey) return fail(503, 'not_configured', 0);

  let source;
  try {
    source = await arenaRpc(cfg, 'coin_logo', { p_address: address });
  } catch (err) {
    if (err.code === 'not_ready') return fail(404, 'no_logo', 600);
    console.error('[logo] database:', err.message);
    return fail(503, 'busy', 0);
  }
  const url = logoFetchUrl(source, size);
  if (!url) return fail(404, 'no_logo', 3600);          // not in the Arena, removed, or a logo from somewhere we don't fetch

  let res;
  try {
    res = await fetch(url, { headers: { Accept: 'image/webp,image/avif,image/png,image/*;q=0.8' }, signal: AbortSignal.timeout(6000) });
  } catch {
    return fail(502, 'unavailable', 300);
  }
  const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!res.ok || (res.url && !safeLogoUrl(res.url)) || !TYPES.has(type)) {
    console.warn(`[logo] ${address}: HTTP ${res.status} ${type || '(no type)'}`);
    return fail(502, 'unavailable', 300);
  }
  const body = await readLimited(res, MAX_BYTES).catch(() => null);
  if (!body || !looksLike(type, body)) return fail(502, 'unavailable', 300);
  return new Response(body, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
