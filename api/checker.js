// ClankChecker (2026-09-26, the owner's idea): a risk scan of clank.trade's coins, from public data (server/checker.js).
//   GET /api/checker                     every coin on clank.trade (new, old and graduated, crude names too, with hate slurs
//                                         masked), newest first, with clank.trade's trending ranks and copycat tickers marked
//   GET /api/checker?latest              the 12 newest coins and clank.trade's trending list: the page asks every 10 s while
//                                         ClankChecker is on screen, so a coin launched a moment ago shows up without a reload
//   GET /api/checker?a=0x…               one coin's scan: flags, a level (lower / some / high risk) and the facts behind them
//                                         (since 2026-09-29 also checked with the Clank protocol on Robinhood Chain, and a
//                                         smaller scan from the chain alone when clank.trade doesn't answer or know the coin)
//   GET /api/checker?logo=0x…&s=96|512   a coin's picture (a row's circle / the big view): since 2026-10-05 its IPFS file from
//                                         public IPFS gateways (or ClankBot's host), made small by our server
// Read-only and the same for everyone, so Vercel's CDN shares every answer: the whole list 5 minutes, the newest coins 10
// seconds, a scan 5 minutes (1 minute for a coin less than a day old), a picture a week. However many visitors look,
// clank.trade is asked about that often per CDN region. No database, no human check, no keys.
// Only these addresses exist (anything else is 400, before anything is fetched), so nobody can make the CDN miss on purpose;
// a visitor may start at most 30 coin scans and 240 pictures a minute (per server copy). clank.trade doesn't answer → the
// chain's smaller scan (shared a minute), or when the chain can't say either, no guess (503). CHECKER_HIDE_PICTURES
// (optional): coins whose picture the owner doesn't want shown.
import { getConfig } from '../server/config.js';
import { clientIp, visitorCode, ipGroup } from '../server/security.js';
import { checkerBurst, pictureBurst } from '../server/burst.js';
import { scanClank, latestClank, checkCoin, coinPictureId } from '../server/checker.js';
import { fetchCoinPicture } from '../server/coin-pictures.js';
import { isHiddenCoin } from '../server/arena.js';

const DAY = 86_400_000;
const noStore = { 'Cache-Control': 'no-store' };
const cache = (browser, cdn, stale = 0) => ({
  'Cache-Control': `public, max-age=${browser}, s-maxage=${cdn}${stale ? `, stale-while-revalidate=${stale}` : ''}`,
});
// the whole list: browsers keep it a minute, the CDN 5 minutes (then it serves the old one while it reads a new one)
const LIST = cache(60, 300, 600);
// the newest coins: 10 seconds, no stale copies (the point is to be fresh)
const LATEST = cache(5, 10);
// a scan: a coin under a day old changes fast (1 minute), an older one less (5 minutes)
// (a scan from the chain alone, 2026-09-29, while clank.trade doesn't answer: a minute, so the full scan is back soon after it does)
const scanCache = (scan, now) => (scan.source === 'chain' || (scan.createdAt > 0 && now - scan.createdAt < DAY) ? cache(30, 60, 60) : cache(60, 300, 300));

// this server copy's last answers (a few CDN regions asking at once cost one read), and reads already on their way
let memo = { at: 0, list: null }, running = null;
let fresh = { at: 0, data: null }, freshRunning = null;
export function resetForTests() {
  memo = { at: 0, list: null }; running = null; fresh = { at: 0, data: null }; freshRunning = null;
  checkerBurst.reset(); pictureBurst.reset();
}

async function coinList() {
  if (memo.list && Date.now() - memo.at < 120_000) return memo.list;
  running ??= scanClank().then((list) => { memo = { at: Date.now(), list }; return list; }).finally(() => { running = null; });
  return running;
}
async function newest() {
  if (fresh.data && Date.now() - fresh.at < 4000) return fresh.data;
  freshRunning ??= latestClank().then((data) => { fresh = { at: Date.now(), data }; return data; }).finally(() => { freshRunning = null; });
  return freshRunning;
}

// the owner's hidden pictures: those coins show their letter instead
const withoutHidden = (cfg, coins) => (cfg.checkerHidePictures.size
  ? coins.map((c) => (cfg.checkerHidePictures.has(c.address) ? { ...c, image: false } : c)) : coins);
// the coins this site never shows (2026-09-28: $CABO, server/arena.js) leave the lists, and the counts with them
function forThisSite(cfg, data) {
  const coins = Array.isArray(data?.coins) ? data.coins : [];
  const gone = coins.filter((c) => isHiddenCoin(c.symbol, c.address));
  const out = { ...data, coins: withoutHidden(cfg, coins.filter((c) => !gone.includes(c))) };
  if (Number.isFinite(data?.total)) out.total = Math.max(0, data.total - gone.length);
  if (Number.isFinite(data?.graduated)) out.graduated = Math.max(0, data.graduated - gone.filter((c) => c.graduated).length);
  if (Array.isArray(data?.trending)) out.trending = data.trending.filter((c) => !isHiddenCoin(c?.symbol, c?.address ?? c));
  return out;
}
const visitor = (cfg, request) => { const ip = clientIp(request); return cfg.passSecret ? visitorCode(cfg.passSecret, ip) : ipGroup(ip); };

export async function GET(request) {
  const search = new URL(request.url).search;
  const cfg = getConfig();
  if (search === '' || search === '?') {
    try {
      const list = await coinList();
      return Response.json(forThisSite(cfg, list), { headers: LIST });
    } catch (err) {
      console.error(`[checker] couldn't read clank.trade's coin list: ${err.message}`);
      return Response.json({ error: 'unverified' }, { status: 503, headers: noStore });
    }
  }
  if (search === '?latest') {
    try {
      const data = await newest();
      return Response.json(forThisSite(cfg, data), { headers: LATEST });
    } catch (err) {
      console.warn(`[checker] couldn't read clank.trade's newest coins: ${err.message}`);
      return Response.json({ error: 'unverified' }, { status: 503, headers: noStore });
    }
  }
  const pic = /^\?logo=(0x[0-9a-f]{40})&s=(96|512)$/.exec(search);          // lowercase only: one address per picture
  if (pic) return picture(cfg, request, pic[1], Number(pic[2]));
  const m = /^\?a=(0x[0-9a-f]{40})$/.exec(search);
  if (!m) return Response.json({ error: 'bad_request' }, { status: 400, headers: noStore });
  if (isHiddenCoin('', m[1])) return Response.json({ address: m[1], error: 'removed' }, { headers: cache(300, 3600) });
  if (!checkerBurst(visitor(cfg, request))) return Response.json({ error: 'slow_down' }, { status: 429, headers: noStore });
  const now = Date.now();
  const scan = await checkCoin(m[1], { now });
  // not a clank.trade coin (or one so new it isn't listed yet: asked again after a minute). An answer, not a failure, so
  // it's a 200 (browsers log every 404 as an error)
  if (scan.error === 'not_clank') return Response.json({ address: m[1], error: 'not_clank' }, { headers: cache(30, 60) });
  if (scan.error) return Response.json(scan, { status: 503, headers: noStore });
  if (isHiddenCoin(scan.symbol, scan.address)) return Response.json({ address: m[1], error: 'removed' }, { headers: cache(300, 3600) });
  if (cfg.checkerHidePictures.has(scan.address)) scan.image = false;
  return Response.json(scan, { headers: scanCache(scan, now) });
}

// A coin's picture: clank.trade keeps it on IPFS; we read it from a public IPFS gateway (clank.trade's own gateway only
// answers its own pages since October 2026), check it's a real picture, make it small (WebP) and serve it from our own
// address (the page's security rules only allow our own pictures). Kept by the CDN a week, browsers an hour. Everything
// fits in 22 s (Vercel stops a function at 25 s).
async function picture(cfg, request, address, size) {
  const deadline = Date.now() + 22_000;
  const none = (status, error, seconds) => Response.json({ error }, { status, headers: seconds ? cache(seconds, seconds) : noStore });
  if (cfg.checkerHidePictures.has(address) || isHiddenCoin('', address)) return none(404, 'no_picture', 3600);
  if (!pictureBurst(visitor(cfg, request))) return none(429, 'slow_down', 0);
  let got;
  try {
    const source = await coinPictureId(address);                // its IPFS id, or its picture on ClankBot's host
    if (!source) return none(404, 'no_picture', 3600);          // not a clank.trade coin, or no picture
    got = await fetchCoinPicture(source, size, { deadline });
  } catch (err) {
    console.warn(`[checker] picture of ${address}: ${err.message}`);
    return none(502, 'unavailable', 300);
  }
  if (!got) return none(404, 'no_picture', 3600);               // gone, or not a picture we'd show
  return new Response(got.bytes, {
    headers: {
      'Content-Type': got.type,
      'Cache-Control': 'public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export function POST() {
  return Response.json({ error: 'method_not_allowed' }, { status: 405, headers: noStore });
}
