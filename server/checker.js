// ClankChecker (2026-09-26, the owner's idea): a risk scan of the coins on clank.trade, from public data only.
//   • the list: every coin clank.trade has (new, old and graduated), read from clank.trade's own API, the one its website
//     uses (`coins.list`, 12 coins a page), with its trending list and the price of ETH;
//   • one coin, when someone asks AGI-1 about it: its details, its 100 biggest holders and its last 100 trades (clank.trade,
//     one request), other coins with the same ticker (clank.trade's search), and for a graduated coin its DEX pool
//     (DexScreener) and how many wallets hold it (the Blockscout block explorer).
// The scan turns what it read into flags (high / some = a red flag, ok / info = good to know) and a level: any high flag →
// High risk, else any "some" → Some risk, else Lower risk. If clank.trade doesn't answer, there's no guess: "Not enough
// data" (fail closed). Rough automated checks, never an audit and never advice: nothing here says buy, sell or safe.
// Since 2026-09-29 (the Clank protocol's docs, developer.clank.trade): a coin's stage follows the protocol's (clank.trade's
// `state` is its curve's state: 0 on its curve, 1 and 2 graduating, 3 graduated, 4 rescued), every scan also asks the
// protocol itself on Robinhood Chain (server/clank-chain.js: its record, and for a graduated coin that its pool's
// liquidity is locked for good), and when clank.trade doesn't answer, or hasn't listed a coin yet, a smaller scan comes
// straight from the chain instead of "Not enough data".
// Since 2026-09-26 (the owner's second round): the newest coins every few seconds (latestClank: new launches show up at
// once), every coin's picture (coinPicture, from clank.trade's own picture host), and every coin, crude names included (the
// owner: "they are part of clank trade"; hate slurs are still masked, and a crude coin's picture waits for the 18+ check).
// Since 2026-10-05 (the owner: "the risk check on the website is not accurate and theres no pictures of the token there"):
//   • a coin's pair: clank.trade pairs coins with ETH or (since 2026-10-02) SPCX, Robinhood's SpaceX stock token, and gives
//     a coin's market cap, its curve's reserve and its threshold in its pair. Everything was priced as ETH before, so a
//     coin paired with SPCX (about $160) looked about 17 times bigger than it was ($SI showed $677K for $40K). Now every
//     amount becomes dollars at its own pair's price (clank.trade's exchangeRates, the same numbers its page shows);
//   • pictures: clank.trade's own Pinata gateway now only answers clank.trade's own pages ("This content cannot be
//     requested through the gateway you are using", HTTP 401), so the same IPFS files come from public IPFS gateways
//     (anyone may read IPFS), and our server shrinks them itself (sharp): server/coin-pictures.js. A few coins use
//     ClankBot's own picture host.
// Since 2026-10-28 (the owner: "the clankchecker is not working"): one slow answer from clank.trade no longer loses the
// whole list (see scanClank), and the CDN keeps showing the last list while clank.trade is away (api/checker.js).
// api/checker.js serves all of it (Vercel's CDN shares each answer); src/sections/checker.js shows it.
import { TOKENS, bestPair } from '../src/prices/parse.js';
import { tickerKey, markCopycats } from '../src/checker/copycat.js';
import { UA, cleanName, isCrude, readLimited, clankApi } from './coins.js';
import { STAGE, FACTORY, FORWARDER, ETH_PAIR, SPCX, PAIR_NAMES, readCoinOnChain, shareOf } from './clank-chain.js';

export { tickerKey, markCopycats, clankApi };

const DEX_API = 'https://api.dexscreener.com/tokens/v1/robinhood/';
const EXPLORER_API = 'https://robinhoodchain.blockscout.com/api/v2/tokens/';
const ETH = ETH_PAIR;                                                  // a coin paired with ETH names the zero address
// Uniswap v4's PoolManager on Robinhood Chain: every clank.trade pool keeps its coins there, so it's not a wallet
export const POOL_MANAGER = '0x8366a39cc670b4001a1121b8f6a443a643e40951';
const NOBODY = [ETH, '0x000000000000000000000000000000000000dead'];   // burned coins
export const OFFICIAL = TOKENS[0].ca;                                 // $AGI, the site's own coin
export const MAX_PAGES = 80;                                          // 12 coins a page: 960 coins (202 on 2026-09-26)
const ADDRESS = /^0x[0-9a-f]{40}$/;
// clank.trade keeps coin pictures on IPFS: a coin's picture is its content id (the pictures themselves come from public
// IPFS gateways since 2026-10-05: server/coin-pictures.js, which only api/checker.js loads)
export const CID = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{50,100})$/;  // (the same check clank.trade's page makes)
// A few coins (made with ClankBot) name a picture on ClankBot's own host instead: only that host, only its pictures
// (13 coins on 2026-10-05; the 3 coins naming any other site keep their letter)
export const PICTURE_URL = /^https:\/\/clankbot\.trade\/images\/[A-Za-z0-9_-]{1,40}(\/[A-Za-z0-9_-]{1,80}){0,2}\.(?:png|jpe?g|webp|gif)$/;

const lc = (s) => String(s ?? '').toLowerCase();
const isAddress = (s) => ADDRESS.test(lc(s));
const num = (v) => { const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v; return typeof n === 'number' && Number.isFinite(n) ? n : null; };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ---------- words and numbers for the page ----------
// A ticker as clank.trade shows it ("E/ACC", "TEST 2"), cleaned: no invisible characters, no "$", at most 16 characters.
export function showTicker(raw) {
  const s = cleanName(raw)?.replace(/^\$+/, '').trim();
  if (!s) return null;
  const chars = [...s];
  return chars.length > 16 ? `${chars.slice(0, 15).join('')}…` : s;
}
// Hate slurs never show, whatever a coin is called: "N*******" (every coin is listed since 2026-09-26, crude names too)
const SLURS = /n[i1]gg\w*|faggot\w*|\bfags?\b|retard\w*|\bkkk\b|hitler\w*|\bnazis?\b|\brap(?:e|es|ed|ist|ists)\b/gi;
export const maskSlurs = (text) => (text == null ? text : String(text).replace(SLURS, (w) => `${w[0]}${'*'.repeat(Math.max(3, w.length - 1))}`));
// A coin's picture: its IPFS content id (from "ipfs://<id>" or a gateway address), or null
export function cidOf(image) {
  const s = String(image ?? '').trim();
  const id = s.startsWith('ipfs://') ? s.slice(7).split(/[/?#]/)[0] : (/^https:\/\/[a-z0-9.-]+\/ipfs\/([^/?#]+)/.exec(s) || [])[1];
  return id && CID.test(id) ? id : null;
}
// Where a coin's picture is (2026-10-05): its IPFS content id, or a picture on ClankBot's host (its address), or null
export function pictureOf(image) {
  const cid = cidOf(image);
  if (cid) return cid;
  const s = String(image ?? '').trim();
  return PICTURE_URL.test(s) ? s : null;
}

// ---------- a coin's pair (2026-10-05) ----------
// Its pair's address (a coin clank.trade doesn't say about: ETH, as every coin was before SPCX), and its name for people
const pairOf = (c) => (isAddress(c?.quoteCurrency) ? lc(c.quoteCurrency) : ETH);
const pairName = (address, symbol) => PAIR_NAMES[address] ?? (showTicker(symbol) || 'its pair token');
// clank.trade's prices (in dollars) for each pair: ETH and SPCX are asked with every first request; any other pair a coin
// names is asked once more (at most 5 at a time; if that fails, those coins' dollars stay unknown, never guessed)
const KNOWN_PAIRS = [ETH, SPCX];
const priceCalls = (pairs) => pairs.map((token) => ['exchangeRates.tokenUsdg', { token }]);
const priceOf = (answer) => (num(answer?.data?.price) > 0 ? num(answer.data.price) : null);
function pricesFrom(pairs, answers, into = new Map()) {
  pairs.forEach((p, i) => { const v = priceOf(answers[i]); if (v) into.set(p, v); });
  return into;
}
async function pricesFor(pairs, prices, { timeoutMs = 6000 } = {}) {
  const missing = [...new Set(pairs)].filter((p) => isAddress(p) && !prices.has(p) && !KNOWN_PAIRS.includes(p)).slice(0, 5);
  if (!missing.length || timeoutMs < 500) return prices;       // (no time left: their dollars stay unknown)
  try { pricesFrom(missing, await clankApi(priceCalls(missing), { timeoutMs }), prices); } catch { /* their dollars stay unknown */ }
  return prices;
}
// a coin's market cap in dollars (clank.trade's number is in its pair), or null when its pair's price is unknown
const dollarsOf = (c, prices) => { const p = prices.get(pairOf(c)); const n = num(c?.marketCap); return p && n !== null ? Math.max(0, n) * p : null; };
// an amount in a pair's smallest units (a string of digits) → in whole units (18 decimals unless said otherwise)
function wholeUnits(raw, decimals = 18) {
  if (!/^\d{1,40}$/.test(String(raw))) return null;
  const d = Number.isInteger(decimals) && decimals >= 0 && decimals <= 36 ? decimals : 18;
  return Number((BigInt(raw) * 1_000_000n) / 10n ** BigInt(d)) / 1e6;
}
// "12.3", "0.042" (for an amount of ETH or SPCX)
const amountText = (n) => String(+n.toFixed(n < 1 ? 3 : 2));
// $36.5K · $1.46M · $840 · <$1
export function usd(n) {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1e9) return `$${+(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${+(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${+(n / 1e3).toFixed(1)}K`;
  return n >= 1 ? `$${Math.round(n)}` : '<$1';
}
// 4.5% · 24% · 0.26%
export const percent = (x) => `${x >= 10 ? Math.round(x) : x >= 1 ? +x.toFixed(1) : +x.toFixed(2)}%`;
// 5 minutes · 3 hours · 10 days
export function timeText(ms) {
  const m = Math.max(0, ms) / 60_000;
  if (m < 60) return plural(Math.max(1, Math.round(m)), 'minute');
  if (m < 48 * 60) return plural(Math.round(m / 60), 'hour');
  return plural(Math.round(m / 1440), 'day');
}
const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;

// ---------- reading clank.trade ----------
// clankApi (one request to clank.trade's API with several questions at once) lives in server/coins.js since 2026-10-06,
// so the buy bot (server/buys.js, every minute) can use it without loading the chain's code (viem); exported here as before.

// ---------- the list of every coin ----------
// Where each coin's picture is, remembered from the lists this server copy read (so a picture rarely costs a lookup)
const pictures = new Map();
export const forgetPictures = () => pictures.clear();            // (for the tests)
function remember(coins) {
  for (const c of coins) {
    if (!c.pic) continue;
    pictures.delete(c.address);
    pictures.set(c.address, c.pic);
    if (pictures.size > 5000) pictures.delete(pictures.keys().next().value);
  }
}
// A coin as the page lists it: every coin clank.trade has (hate slurs in a name are masked). `adult`: its name is crude
// or sexual (its picture waits for the 18+ check); `image`: it has a picture (served by /api/checker?logo=…);
// `marketCap`: in dollars, at its own pair's price (null when that price is unknown).
function listCoin(c, prices, trendingRank) {
  const address = lc(c?.address);
  if (!isAddress(address)) return null;
  const symbol = showTicker(c.symbol), name = cleanName(c.name);
  const mcUsd = dollarsOf(c, prices);
  const pic = pictureOf(c.image);
  const state = Number(c.state);
  return {
    address, symbol: maskSlurs(symbol), name: maskSlurs(name),
    graduated: state === STAGE.POOL,
    ...(state === STAGE.READY || state === STAGE.SWEPT ? { stage: 'graduating' } : state === STAGE.RESCUED ? { stage: 'rescued' } : {}),
    progress: Math.min(100, Math.max(0, +(num(c.progress) ?? 0).toFixed(2))),
    createdAt: (num(c.createdAt) ?? 0) * 1000,
    marketCap: mcUsd !== null ? Math.round(mcUsd) : null,
    trending: trendingRank ?? 0,
    official: address === OFFICIAL,
    adult: isCrude(`${name || ''} ${symbol || ''}`),
    image: Boolean(pic),
    mcUsd, pic,
  };
}
const publicCoin = ({ mcUsd, pic, ...c }) => c;
// clank.trade's trending list (its own order), only real addresses → [coin]
const trendingList = (data) => (Array.isArray(data) ? data : []).filter((c) => isAddress(c?.address)).slice(0, 50);
// the first page of coins.list, trending and the prices of ETH and SPCX: the one request both lists start with
const FIRST = [['coins.list', {}], ['coins.trending', {}], ...priceCalls(KNOWN_PAIRS)];
function listed(raw, prices, trending) {
  const ranks = new Map(trending.map((c, i) => [lc(c.address), i + 1]));
  const seen = new Set();
  return raw.map((c) => listCoin(c, prices, ranks.get(lc(c?.address)))).filter((c) => c && !seen.has(c.address) && seen.add(c.address));
}
// copycats are told apart by size: their market caps in dollars (an SPCX coin and an ETH coin, compared fairly)
const bySize = { size: (c) => c.mcUsd ?? 0 };

// How long clank.trade gets (2026-10-28): most of its answers take about 0.4 s, but now and then one takes 2 to 12 s, and
// the same request asked again answers at once. So a request still unanswered after HEDGE_MS is asked a second time
// (clankApi's hedgeMs: the first answer wins), and a page gets PAGE_MS at most.
export const HEDGE_MS = 1500;
const PAGE_MS = 8000;

// Every coin, page by page (clank.trade only gives 12 at a time), newest first. Stops after MAX_PAGES or `budgetMs`
// (a function may run 25 s): then `complete` is false. Keep the separately fetched trending coins even when their older
// list pages were not reached, so important older coins do not disappear from Trending or Graduated on a slow fetch.
// Since 2026-10-28 (the owner: "the clankchecker is not working"): 466 coins are 39 pages asked one after another, and a
// single page that didn't answer within 8 s used to lose the whole list ("Couldn't reach clank.trade right now"), or a
// page started near the end of the budget could run past Vercel's 25 s. Now a slow page is asked twice, no request runs
// past `limitMs` (so the budget could grow from 18 s to 20 s: 39 pages take about 16 s, a few more when some are slow),
// and a page that still can't be read ends the list there: what was read is kept (`complete: false`, and `cutShort: true`
// when that was before the budget's end: api/checker.js keeps that one a minute instead of five). Only the first request
// failing means no list.
export async function scanClank({ budgetMs = 20_000, limitMs = 21_000, now = Date.now() } = {}) {
  const t0 = Date.now();
  const left = () => t0 + limitMs - Date.now();
  const [first, trending, ...rates] = await clankApi(FIRST, { timeoutMs: PAGE_MS, hedgeMs: HEDGE_MS });
  if (!Array.isArray(first.data?.coins)) throw new Error('clank.trade sent no coin list');
  const raw = [...first.data.coins];
  let cursor = first.data.nextCursor, pages = 1, cutShort = false;
  while (typeof cursor === 'string' && cursor && cursor.length < 1000 && pages < MAX_PAGES && Date.now() - t0 < budgetMs) {
    const timeoutMs = Math.min(PAGE_MS, left());
    if (timeoutMs < 1000) break;                                 // (no time for another page: the list ends here)
    try {
      const [page] = await clankApi([['coins.list', { cursor }]], { timeoutMs, hedgeMs: HEDGE_MS });
      if (!Array.isArray(page.data?.coins)) throw new Error('clank.trade sent no coin list');
      raw.push(...page.data.coins);
      cursor = page.data.nextCursor;
      pages += 1;
    } catch (err) {
      console.warn(`[checker] clank.trade's coin list stopped after ${pages} pages (${raw.length} coins): ${err.message}`);
      // (a page that only ran out of the time left at the end is the budget's stop, as before; earlier, it's cut short)
      cutShort = Date.now() - t0 < budgetMs;
      break;
    }
  }
  const prices = await pricesFor(raw.map(pairOf), pricesFrom(KNOWN_PAIRS, rates), { timeoutMs: Math.min(6000, left()) });
  const top = trendingList(trending.data);
  const all = listed(raw, prices, top);
  const present = new Set(all.map(c => c.address));
  for (const [index, coin] of top.entries()) {
    if (present.has(lc(coin.address))) continue;
    // Trending has dollar market caps and isLive, unlike coins.list's pair-denominated caps and state.
    const extra = listCoin({ ...coin, state: coin.isLive === true ? STAGE.POOL : undefined }, new Map(), index + 1);
    if (!extra) continue;
    const usd = num(coin.marketCapUsdg);
    extra.mcUsd = usd !== null && usd >= 0 ? usd : null;
    extra.marketCap = extra.mcUsd === null ? null : Math.round(extra.mcUsd);
    all.push(extra); present.add(extra.address);
  }
  markCopycats(all, bySize);
  remember(all);
  return {
    coins: all.map(publicCoin),
    total: all.length,
    graduated: all.filter((c) => c.graduated).length,
    complete: !cursor,
    ...(cutShort ? { cutShort: true } : {}),
    ethUsd: prices.get(ETH) ?? null,
    spcxUsd: prices.get(SPCX) ?? null,
    updatedAt: now,
  };
}

// ---------- the newest coins, every few seconds (2026-09-26, the owner: new launches should show up fast) ----------
// One small request: the 12 newest coins (clank.trade's first page), its trending list (with each coin's market cap in
// dollars) and the price of ETH. The page asks for it every 10 s while ClankChecker is on screen and merges it into the
// whole list, so a coin launched a moment ago appears without a reload, and trending coins' numbers stay current.
export async function latestClank({ now = Date.now() } = {}) {
  const [first, trending, ...rates] = await clankApi(FIRST, { timeoutMs: 6000, hedgeMs: HEDGE_MS });
  if (!Array.isArray(first.data?.coins)) throw new Error('clank.trade sent no coin list');
  const prices = await pricesFor(first.data.coins.map(pairOf), pricesFrom(KNOWN_PAIRS, rates), { timeoutMs: 4000 });
  const top = trendingList(trending.data);
  const coins = listed(first.data.coins, prices, top);
  remember(coins);
  remember(top.map((c) => ({ address: lc(c.address), pic: pictureOf(c.image) })));
  return {
    coins: coins.map(publicCoin),
    trending: top.map((c, i) => ({
      address: lc(c.address), rank: i + 1,
      marketCap: num(c.marketCapUsdg) !== null && num(c.marketCapUsdg) >= 0 ? Math.round(num(c.marketCapUsdg)) : null,
      progress: Math.min(100, Math.max(0, +(num(c.progress) ?? 0).toFixed(2))),
      // (live = trading in its pool; a sold-out curve whose pool isn't open yet is graduating, not graduated)
      graduated: c.isLive === true,
    })),
    ethUsd: prices.get(ETH) ?? null,
    spcxUsd: prices.get(SPCX) ?? null,
    updatedAt: now,
  };
}

// ---------- the coins launched since a moment (2026-09-29, for AGI-1's feed: server/feed.js) ----------
// Newest first, page by page, until a coin at or before `since` (ms) shows up, maxPages, or the deadline. → { coins
// (launched after `since`, as the list shows them, but `progress: null` when clank.trade didn't say), newest (the newest
// coin's launch time, ms, or 0), complete (reached `since`) }. A launch time in the future is a mistake: never trusted.
export async function coinsSince(since, { maxPages = 5, deadline = Infinity, now = Date.now() } = {}) {
  const raw = [];
  let cursor = null, pages = 0, reached = false;
  do {
    const [page] = await clankApi([['coins.list', cursor ? { cursor } : {}]], { timeoutMs: 5000 });
    if (!Array.isArray(page.data?.coins)) throw new Error('clank.trade sent no coin list');
    raw.push(...page.data.coins);
    pages += 1;
    reached = page.data.coins.some((c) => (num(c?.createdAt) ?? 0) * 1000 <= since);
    cursor = page.data.nextCursor;
  } while (!reached && typeof cursor === 'string' && cursor && cursor.length < 1000 && pages < maxPages && Date.now() < deadline);
  const unknown = new Set(raw.filter((c) => num(c?.progress) === null).map((c) => lc(c?.address)));
  const soon = now + 5 * 60_000;
  const all = listed(raw, new Map(), []).filter((c) => c.createdAt <= soon);
  remember(all);
  return {
    coins: all.filter((c) => c.createdAt > since).map((c) => ({ ...publicCoin(c), progress: unknown.has(c.address) ? null : c.progress })),
    newest: all.reduce((n, c) => Math.max(n, c.createdAt), 0),
    complete: reached || !cursor,
  };
}

// ---------- a coin's picture ----------
// Where it is: remembered from the lists this server copy read, else asked from clank.trade (the coin's details).
// → its IPFS id or ClankBot address | null (not a clank.trade coin, or no picture) · throws when clank.trade doesn't answer
export async function coinPictureId(address) {
  if (!isAddress(address)) return null;
  if (pictures.has(address)) return pictures.get(address);
  const [d] = await clankApi([['coins.detail', { address }]], { timeoutMs: 6000 });
  if (d.error === 'not_found') return null;
  if (!d.data || lc(d.data.address) !== address) throw new Error('clank.trade sent no details');
  const pic = pictureOf(d.data.image);
  if (pic) remember([{ address, pic }]);
  return pic;
}
// ---------- one coin ----------
// DexScreener: a graduated coin's biggest pool. → { liquidity, change, volume } | { missing: true } | { failed: true }
async function readDex(address) {
  try {
    const res = await fetch(`${DEX_API}${address}`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { failed: true };
    const pair = bestPair(await res.json(), address);
    if (!pair) return { missing: true };
    return { liquidity: num(pair.liquidity?.usd), change: num(pair.priceChange?.h24), volume: num(pair.volume?.h24) };
  } catch {
    return { failed: true };
  }
}
// The block explorer: how many wallets hold it (clank.trade lists only the 100 biggest). → a number or null
async function readHolderCount(address) {
  try {
    const res = await fetch(`${EXPLORER_API}${address}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const n = num((await res.json())?.holders_count);
    return n !== null && n >= 0 ? Math.round(n) : null;
  } catch {
    return null;
  }
}

// Resolves to what `promise` gives, or to null after `ms` (the chain never holds a scan up for long)
const within = (promise, ms) => Promise.race([promise, new Promise((resolve) => { setTimeout(() => resolve(null), ms).unref?.(); })]);

// Everything about one coin. → a scan (see analyze, or analyzeChain when only the chain answered) or
// { error: 'not_clank' | 'unverified' }
export async function checkCoin(address, { now = Date.now() } = {}) {
  const asked = clankApi([
    ['coins.detail', { address }], ['coins.holders', { address }], ['coins.trades', { address, limit: 100 }],
    ...priceCalls(KNOWN_PAIRS),
  ]);
  // asked at the same time as clank.trade: a full scan waits for it at most 4 s; when clank.trade failed, the chain's answer
  // is all there is, so it's awaited in full (its own timeouts end it within about 5 s of the start)
  const chainRead = readCoinOnChain(address);
  const onchain = within(chainRead, 4000);
  let first;
  try {
    first = await asked;
  } catch (err) {
    console.warn(`[checker] couldn't read ${address} from clank.trade: ${err.message}`);
    return fromChain(address, await chainRead, 'down', now);
  }
  const [d, h, t, ...r] = first;
  if (d.error === 'not_found') return fromChain(address, await chainRead, 'unlisted', now);
  const detail = d.data;
  const holders = h.data?.holders, trades = t.data?.trades;
  // no half scans: without its details, holders and trades, there's nothing honest to say (but the chain may be)
  if (!detail || lc(detail.address) !== address || !Array.isArray(holders) || !Array.isArray(trades)) {
    console.warn(`[checker] clank.trade's answer for ${address} was incomplete`);
    return fromChain(address, await chainRead, 'down', now);
  }
  remember([{ address, pic: pictureOf(detail.image) }]);
  const graduated = Number(detail.state) === STAGE.POOL;
  const query = String(detail.symbol ?? '').normalize('NFKC').replace(/^\$+/, '').trim().slice(0, 40);
  const [sameTicker, dex, holderCount, chain] = await Promise.all([
    tickerKey(query)
      ? clankApi([['coins.list', { query }]]).then(([s]) => (Array.isArray(s.data?.coins) ? s.data.coins : null)).catch(() => null)
      : [],
    graduated ? readDex(address) : null,
    holders.length >= 100 ? readHolderCount(address) : null,
    onchain,
  ]);
  // the dollar prices of its pair (and of the pairs of coins with its ticker): ETH and SPCX came with the first request
  const prices = await pricesFor([pairOf(detail), ...(Array.isArray(sameTicker) ? sameTicker.map(pairOf) : [])], pricesFrom(KNOWN_PAIRS, r), { timeoutMs: 4000 });
  return analyze({ detail, holders, trades, prices, sameTicker, dex, holderCount, chain, now });
}

// clank.trade didn't answer ('down') or doesn't know the coin yet ('unlisted'): a smaller scan from the chain, if the
// Clank protocol knows the coin; else as before ("Not enough data" / "Not a clank.trade coin")
async function fromChain(address, chain, why, now) {
  if (!chain?.exists) return { error: why === 'unlisted' ? 'not_clank' : 'unverified' };
  const [dex, holderCount] = await Promise.all([chain.state === STAGE.POOL ? readDex(address) : null, readHolderCount(address)]);
  if (pictureOf(chain.logo)) remember([{ address, pic: pictureOf(chain.logo) }]);
  return analyzeChain(chain, { address, dex, holderCount, why, now });
}

// ---------- the stage and the pool: the same words whoever answered (clank.trade or the chain) ----------
function stageFlag(flag, { state, progress, nobodyBought, about = '' }) {
  if (state === STAGE.POOL) flag('stage', 'ok', 'Graduated: it filled its bonding curve and now trades in a DEX pool.');
  else if (state === STAGE.READY || state === STAGE.SWEPT) {
    flag('stage', 'some', "Graduating: its bonding curve sold out and its DEX pool isn't open yet. Graduations can fail: check clank.trade.");
  } else if (state === STAGE.RESCUED) {
    flag('stage', 'high', "Its graduation didn't go through, and the Clank protocol stepped in (\"rescued\"). Check clank.trade before anything else.");
  } else if (state !== STAGE.TRADING) flag('stage', 'some', "It's at an unusual stage: check it on clank.trade first.");
  else if (nobodyBought) flag('stage', 'high', 'Nobody has bought it yet: its bonding curve is at 0%.');
  else if (progress < 2) flag('stage', 'high', `Barely started: only ${progress}% of its bonding curve is filled${about}.`);
  else if (progress < 25) flag('stage', 'some', `Early: ${progress}% of its bonding curve is filled${about}.`);
  else flag('stage', 'info', `${progress}% of its bonding curve is filled${about}. It graduates at 100%.`);
}
const stageWord = (state, progress) => (state === STAGE.POOL ? 'Graduated' : state === STAGE.READY || state === STAGE.SWEPT ? 'Graduating'
  : state === STAGE.RESCUED ? 'Rescued' : `Curve ${progress}%`);
function poolFlags(flag, dex) {
  if (!dex || dex.failed || dex.missing || dex.liquidity === null) { flag('pool', 'some', "Couldn't read its DEX pool right now."); return; }
  if (dex.liquidity < 5_000) flag('pool', 'high', `Its pool holds only ${usd(dex.liquidity)}: small trades move the price a lot.`);
  else if (dex.liquidity < 20_000) flag('pool', 'some', `Its pool holds ${usd(dex.liquidity)}: bigger trades move the price a lot.`);
  else flag('pool', 'ok', `Its pool holds ${usd(dex.liquidity)}.`);
  if (dex.change !== null && dex.change <= -60) flag('drop', 'high', `Down ${Math.round(-dex.change)}% in 24 hours.`);
  else if (dex.change !== null && dex.change <= -30) flag('drop', 'some', `Down ${Math.round(-dex.change)}% in 24 hours.`);
}
// The Clank protocol puts the liquidity it adds at graduation in a locker with no way out (its docs), so when the chain
// confirms the coin graduated through the protocol, that's a fair "good to know" (never "safe"). Only that liquidity:
// anyone else's in the same pool is theirs to take out, and DexScreener may show another pool, so the note says exactly that.
export const LOCKED_TEXT = 'The liquidity the Clank protocol put in its pool at graduation is locked for good: nobody can pull it out, its creator included. Its price can still fall.';
const lockedNote = (flag, chain) => { if (chain?.exists && chain.state === STAGE.POOL) flag('locked', 'ok', LOCKED_TEXT); };
// what the scan says about the chain (so the page, the owner and the tests can see what the chain answered)
const onchainOf = (chain) => (chain ? (chain.exists ? { exists: true, state: chain.state, curve: chain.curve } : { exists: false }) : null);

// The scan itself, from what was read (no network here, so the tests can feed it anything).
//   detail: clank.trade's coins.detail · holders: [{ address, balance }] (its biggest, at most 100) · trades: its latest
//   (newest first) · prices: a Map of each pair's address → its price in dollars (or ethUsd: the price of ETH alone, as
//   before 2026-10-05) · sameTicker: clank.trade's search for its ticker (null = couldn't ask) · dex: readDex() (or null
//   for a coin on its bonding curve) · holderCount: from the block explorer (or null)
// → { address, symbol, name, adult, image, createdAt, graduated, progress, official, copyOfficial, level, flags, facts,
//     links, checkedAt } (symbol and name with hate slurs masked; adult: a crude or sexual name, so its picture waits for the
//     18+ check; image: it has a picture)
export function analyze({ detail, holders = [], trades = [], ethUsd = null, prices = null, sameTicker = [], dex = null, holderCount = null, chain = null, now = Date.now() }) {
  const address = lc(detail.address);
  const rawSymbol = showTicker(detail.symbol), rawName = cleanName(detail.name);
  const symbol = maskSlurs(rawSymbol), name = maskSlurs(rawName);
  const ticker = symbol ? `$${symbol}` : 'this ticker';
  const state = Number(detail.state);
  const graduated = state === STAGE.POOL;
  const progress = Math.min(100, Math.max(0, +(num(detail.progress) ?? 0).toFixed(2)));
  // its pair (ETH or SPCX) and that pair's price: its market cap and its curve are counted in its pair
  const priceMap = new Map(prices instanceof Map ? prices : []);
  if (!priceMap.has(ETH) && num(ethUsd) > 0) priceMap.set(ETH, num(ethUsd));
  const pair = pairOf(detail), pairWord = pairName(pair, detail.quoteSymbol);
  const rate = priceMap.get(pair) ?? null;
  const supply = /^\d{1,40}$/.test(String(detail.totalSupply)) ? BigInt(detail.totalSupply) : 0n;
  const share = (balance) => (supply > 0n && /^\d{1,40}$/.test(String(balance)) ? Number((BigInt(balance) * 1_000_000n) / supply) / 10_000 : 0);
  const flags = [], facts = [];
  const flag = (id, sev, text) => flags.push({ id, sev, text });
  const fact = (label, value) => facts.push({ label, value });

  // who holds it: not its bonding curve, its pool (the PoolManager and the pool's hook) or burned coins
  const notWallets = new Set([POOL_MANAGER, lc(detail.curve), lc(detail.poolKey?.hooks), ...NOBODY]);
  const list = holders.filter((x) => isAddress(x?.address));
  const wallets = list.filter((x) => !notWallets.has(lc(x.address))).map((x) => ({ address: lc(x.address), pct: share(x.balance) }))
    .filter((w) => w.pct > 0).sort((a, b) => b.pct - a.pct);
  const walletCount = list.length < 100 ? wallets.length
    : holderCount !== null ? Math.max(wallets.length, holderCount - (list.length - wallets.length)) : null;
  const trades100 = trades.filter((x) => x && ['buy', 'sell'].includes(x.side) && num(x.timestamp) !== null)
    .sort((a, b) => num(b.timestamp) - num(a.timestamp));
  const nobodyBought = state === STAGE.TRADING && progress === 0 && !trades100.length;
  const creator = lc(detail.creator);

  // 1. the ticker: the site's own $AGI, or a coin that only borrowed a ticker
  const official = address === OFFICIAL;
  const key = tickerKey(detail.symbol);
  const copyOfficial = key === 'AGI' && !official;
  if (copyOfficial) flag('copycat', 'high', 'Not the official $AGI: it only uses the same ticker. The official contract ends in 06ec (see the Model card).');
  else if (official) flag('official', 'ok', 'The official $AGI: the same contract as on this site.');
  if (key && !copyOfficial) {
    if (sameTicker === null) flag('ticker', 'some', "Couldn't check for coins with the same ticker right now.");
    else {
      const me = { address, official, graduated, mcUsd: dollarsOf(detail, priceMap) ?? 0, symbol: detail.symbol };
      const others = sameTicker.filter((c) => isAddress(c?.address) && lc(c.address) !== address && tickerKey(c.symbol) === key)
        .map((c) => ({ address: lc(c.address), official: lc(c.address) === OFFICIAL, graduated: Number(c.state) === STAGE.POOL, mcUsd: dollarsOf(c, priceMap) ?? 0, symbol: c.symbol }));
      if (others.length) {
        markCopycats([me, ...others], bySize);
        const n = plural(others.length, 'other clank.trade coin');
        if (me.copyOf) {
          const top = others.find((c) => c.address === me.copyOf);
          flag('copycat', 'high', `Copycat ticker: the biggest ${ticker} on clank.trade is another coin (${short(top.address)})${top.graduated ? ', which has graduated' : ''}.`);
        } else if (official || others.some((c) => c.copyOf === address)) {
          flag('ticker', 'info', `${n} ${others.length === 1 ? 'uses' : 'use'} the same ticker: make sure you have this contract.`);
        } else flag('ticker', 'some', `${n} ${others.length === 1 ? 'uses' : 'use'} the ticker ${ticker} too: check the contract address.`);
      }
    }
  }

  // 2. how far along it is: graduated (a DEX pool) or still on its bonding curve (how much of its pair is in it, in dollars)
  const reserve = wholeUnits(detail.reserve, num(detail.quoteDecimals) ?? 18);        // in its pair (ETH or SPCX)
  const inCurve = !graduated && reserve !== null && rate ? reserve * rate : null;
  const about = inCurve !== null ? ` (about ${usd(inCurve)} in it)` : '';
  // the protocol's own record, when the chain answered. A graduation it had to rescue counts whatever clank.trade shows
  // (the worse of the two); other stage differences are left alone (clank.trade can be a few seconds behind the chain)
  const rescuedOnChain = chain?.exists === true && chain.state === STAGE.RESCUED && state !== STAGE.RESCUED;
  const stageNow = rescuedOnChain ? STAGE.RESCUED : state;
  stageFlag(flag, { state: stageNow, progress, nobodyBought, about });
  if (rescuedOnChain) flag('record', 'some', "clank.trade doesn't show it yet, but the Clank protocol says its graduation was rescued.");
  // …and its curve: clank.trade and the protocol should agree about it
  if (chain?.exists && isAddress(detail.curve) && lc(detail.curve) !== chain.curve) {
    flag('record', 'some', "clank.trade and the Clank protocol don't agree about this coin's curve: check it on clank.trade.");
  }

  // 3. age
  const created = (num(detail.createdAt) ?? 0) * 1000;
  const age = created > 0 ? now - created : null;
  if (age !== null) {
    if (age < 3_600_000) flag('age', 'high', `Brand new: launched ${timeText(age)} ago.`);
    else if (age < 86_400_000) flag('age', 'some', `New: launched ${timeText(age)} ago.`);
    else flag('age', 'info', `Launched ${timeText(age)} ago.`);
  }

  if (!nobodyBought) {
    // 4. holders
    if (walletCount === null) flag('holders', 'ok', 'More than 100 wallets hold it.');
    else if (walletCount === 0) flag('holders', 'high', 'No wallets hold it besides its bonding curve.');
    else if (walletCount < 10) flag('holders', 'high', `Only ${plural(walletCount, 'wallet')} ${walletCount === 1 ? 'holds' : 'hold'} it.`);
    else if (walletCount < 50) flag('holders', 'some', `${walletCount} wallets hold it.`);
    else flag('holders', 'ok', `${walletCount} wallets hold it.`);

    // 5. how spread out: the biggest wallet and the 10 biggest together (share of all its coins)
    if (wallets.length) {
      const big = wallets[0].pct, top10 = wallets.slice(0, 10).reduce((s, w) => s + w.pct, 0);
      const before = flags.length;
      if (big > 10) flag('whale', 'high', `One wallet holds ${percent(big)} of all its coins.`);
      else if (big > 5) flag('whale', 'some', `The biggest wallet holds ${percent(big)} of all its coins.`);
      if (top10 > 40) flag('top10', 'high', `The 10 biggest wallets hold ${percent(top10)} of it together.`);
      else if (top10 > 25) flag('top10', 'some', `The 10 biggest wallets hold ${percent(top10)} of it together.`);
      if (flags.length === before) flag('spread', 'ok', `Spread out: the biggest wallet holds ${percent(big)}, the 10 biggest ${percent(top10)} together.`);
    }

    // 6. its creator: how much they still hold, and whether they sold lately (in its last 100 trades)
    if (isAddress(creator)) {
      const held = wallets.find((w) => w.address === creator)?.pct ?? 0;
      const sold = trades100.filter((x) => lc(x.trader) === creator && x.side === 'sell').length;
      if (held > 10) flag('creator', 'high', `Its creator still holds ${percent(held)}.`);
      else if (held > 5) flag('creator', 'some', `Its creator holds ${percent(held)}.`);
      else if (sold && held < 0.5) flag('creator', 'high', `Its creator sold lately and now holds ${held > 0 ? percent(held) : 'none'}.`);
      else if (sold) flag('creator', 'some', `Its creator sold some lately (still holds ${percent(held)}).`);
      else if (held === 0) flag('creator', 'info', 'Its creator holds none of it.');
      else flag('creator', 'ok', `Its creator holds ${percent(held)}.`);
    }

    // 7. trading: when the last trade was, how many today, mostly sells, the same few wallets
    if (!trades100.length) flag('activity', 'high', 'No trades yet.');
    else {
      const last = now - num(trades100[0].timestamp) * 1000;
      const day = trades100.filter((x) => now - num(x.timestamp) * 1000 < 86_400_000).length;
      const recent = trades100.slice(0, 50), sells = recent.filter((x) => x.side === 'sell').length;
      const traders = new Set(trades100.map((x) => lc(x.trader))).size;
      if (last > 3 * 86_400_000) flag('activity', 'high', `Quiet: the last trade was ${timeText(last)} ago.`);
      else if (last > 86_400_000) flag('activity', 'some', `Quiet: the last trade was ${timeText(last)} ago.`);
      else flag('activity', 'info', `${day >= 100 ? '100+' : day} ${day === 1 ? 'trade' : 'trades'} in the last 24 hours.`);
      if (recent.length >= 10 && sells / recent.length >= 0.8) flag('sells', 'some', `Mostly selling: ${sells} of its last ${recent.length} trades were sells.`);
      if (trades100.length >= 20 && traders <= 3) flag('traders', 'some', `Only ${plural(traders, 'wallet')} made its last ${trades100.length} trades.`);
      fact('Trades (24 h)', day >= 100 ? '100+' : String(day));
      fact('Last trade', `${timeText(last)} ago`);
      fact(`Buys / sells (last ${recent.length})`, `${recent.length - sells} / ${sells}`);
    }
  }

  // 8. a graduated coin's DEX pool: how much is in it, and today's move; and its liquidity locked by the protocol
  if (graduated) {
    poolFlags(flag, dex);
    lockedNote(flag, chain);
  }

  // the facts under the flags (the page shows them as a small table)
  const mcUsd = dollarsOf(detail, priceMap);
  const head = [
    ['Stage', stageWord(stageNow, progress)],
    ['Launched', age !== null ? `${timeText(age)} ago` : '—'],
    ['Market cap', mcUsd !== null ? usd(mcUsd) : '—'],
    ['Paired with', pairWord],
    graduated
      ? ['In its pool', dex && !dex.failed && !dex.missing && dex.liquidity !== null ? usd(dex.liquidity) : '—']
      : ['In its curve', inCurve !== null ? usd(inCurve) : '—'],
    ...(graduated && dex?.change !== null && dex?.change !== undefined ? [['Change (24 h)', `${dex.change > 0 ? '+' : ''}${dex.change.toFixed(1)}%`]] : []),
    ...(graduated && dex?.volume !== null && dex?.volume !== undefined ? [['Volume (24 h)', usd(dex.volume)]] : []),
    ['Holders', nobodyBought ? '0' : walletCount === null ? '100+' : String(walletCount)],
    ...(wallets.length ? [['Biggest wallet', percent(wallets[0].pct)], ['Top 10 wallets', percent(wallets.slice(0, 10).reduce((s, w) => s + w.pct, 0))]] : []),
    ['Creator holds', percent(wallets.find((w) => w.address === creator)?.pct ?? 0)],
  ];
  facts.unshift(...head.map(([label, value]) => ({ label, value })));
  fact('Contract', short(address));

  // worst first (a stable sort keeps the order above within each kind)
  const ORDER = { high: 0, some: 1, ok: 2, info: 3 };
  flags.sort((a, b) => ORDER[a.sev] - ORDER[b.sev]);
  const level = flags.some((f) => f.sev === 'high') ? 'high' : flags.some((f) => f.sev === 'some') ? 'some' : 'low';
  return {
    address, symbol, name,
    adult: isCrude(`${rawName || ''} ${rawSymbol || ''}`), image: Boolean(pictureOf(detail.image)), createdAt: created,
    graduated, progress, official, copyOfficial, level, flags, facts,
    links: { clank: `https://clank.trade/coin/${address}`, explorer: `https://robinhoodchain.blockscout.com/token/${address}` },
    checkedAt: now, onchain: onchainOf(chain),
  };
}

// The smaller scan, straight from the chain (clank.trade couldn't be read, or hasn't listed the coin yet): its stage and
// how far along its curve is, what its creator holds, a graduated coin's pool (DexScreener) and about how many wallets hold
// it (the block explorer). Its holders' spread, its trades, its age and look-alike tickers can't be read this way, so it
// always says so, and it's never "Lower risk". Anything the chain didn't answer is said to be unknown, never read as 0
// (a call inside a batch can fail on its own): an unknown can only make a scan look worse, never better.
const DIGITS = /^\d{1,40}$/;
export function analyzeChain(chain, { address, dex = null, holderCount = null, why = 'down', now = Date.now() }) {
  const rawSymbol = showTicker(chain.symbol), rawName = cleanName(chain.name);
  const symbol = maskSlurs(rawSymbol), name = maskSlurs(rawName);
  const flags = [], facts = [];
  const flag = (id, sev, text) => flags.push({ id, sev, text });
  const fact = (label, value) => facts.push({ label, value });
  flag('source', 'some', `${why === 'unlisted' ? "clank.trade hasn't listed it yet" : "clank.trade couldn't be read just now"}, so this comes straight from Robinhood Chain: how spread out its holders are, its trades, its age and look-alike tickers couldn't be checked.`);
  // clank.trade lists a coin within seconds of its launch: one it doesn't know is brand new, or one it doesn't show
  // (the age rule would call a coin under an hour old High risk anyway)
  if (why === 'unlisted') flag('listed', 'high', "Not listed on clank.trade (yet): it's brand new, or a coin clank.trade doesn't show.");
  const official = address === OFFICIAL;
  const copyOfficial = tickerKey(chain.symbol) === 'AGI' && !official;
  if (copyOfficial) flag('copycat', 'high', 'Not the official $AGI: it only uses the same ticker. The official contract ends in 06ec (see the Model card).');
  else if (official) flag('official', 'ok', 'The official $AGI: the same contract as on this site.');
  const state = chain.state;
  const graduated = state === STAGE.POOL;
  const big = (v) => (DIGITS.test(String(v)) ? BigInt(v) : null);
  const threshold = big(chain.threshold) ?? 0n, reserveWei = big(chain.reserve);
  const supply = big(chain.supply), curveHeld = big(chain.curveBalance), creatorHeld = big(chain.creatorBalance);
  const progress = graduated ? 100 : threshold > 0n && reserveWei !== null ? Math.min(100, Number((reserveWei * 10_000n) / threshold) / 100) : 0;
  // what's in its curve, in its pair (ETH, or SPCX since 2026-10-02: both have 18 decimals)
  const pairWord = PAIR_NAMES[isAddress(chain.pairToken) ? lc(chain.pairToken) : ETH] ?? null;      // (null: a pair we don't know)
  const inPair = reserveWei !== null ? wholeUnits(reserveWei.toString()) : null;
  const amountOf = (n) => (pairWord ? `${amountText(n)} ${pairWord}` : `${amountText(n)} of its pair token`);
  const about = !graduated && inPair !== null && inPair > 0 ? ` (about ${amountOf(inPair)} in it)` : '';
  // its stage (its curve may not have answered) and, on its curve, how full it is (an empty curve with every coin still
  // in it = nobody bought any; an empty curve otherwise is "0% filled", which is true either way)
  const knownStage = Number.isInteger(state);
  if (!knownStage) flag('stage', 'some', "Couldn't read its stage from the chain right now.");
  else if (state === STAGE.TRADING && reserveWei === null) flag('stage', 'some', "Couldn't read how full its bonding curve is right now.");
  else {
    const nobodyBought = state === STAGE.TRADING && reserveWei === 0n && supply !== null && curveHeld !== null && curveHeld === supply;
    stageFlag(flag, { state, progress, nobodyBought, about });
  }
  // its creator: only when the chain named a real creator (not the protocol's own forwarder) and both numbers came back
  const deployer = String(chain.deployer || '').toLowerCase();
  const creatorKnown = isAddress(deployer) && ![FACTORY, FORWARDER, ETH].includes(deployer);
  const creator = creatorKnown && supply !== null && supply > 0n && creatorHeld !== null ? shareOf(creatorHeld, supply) : null;
  if (!creatorKnown) flag('creator', 'some', "Couldn't tell from the chain who created it, so what its creator holds is unknown.");
  else if (creator === null) flag('creator', 'some', "Couldn't read what its creator holds right now.");
  else if (creator > 10) flag('creator', 'high', `Its creator still holds ${percent(creator)}.`);
  else if (creator > 5) flag('creator', 'some', `Its creator holds ${percent(creator)}.`);
  else if (creator === 0) flag('creator', 'info', 'Its creator holds none of it.');
  else flag('creator', 'ok', `Its creator holds ${percent(creator)}.`);
  // about how many wallets: the explorer counts every address, contracts too, so its curve (when it holds coins) and a
  // graduated coin's pool (Uniswap's PoolManager and the pool's hook) come off; if the hook holds none, that's one too few
  // wallets, which only errs on the careful side
  let wallets = null;
  if (holderCount !== null) {
    const contracts = (curveHeld === null || curveHeld > 0n ? 1 : 0) + (graduated ? 2 : 0);
    wallets = Math.max(0, holderCount - contracts);
    const without = graduated ? 'without its curve and pool' : 'without its curve';
    if (wallets < 10) flag('holders', 'high', `About ${plural(wallets, 'wallet')} ${wallets === 1 ? 'holds' : 'hold'} it (the block explorer's count, ${without}).`);
    else if (wallets < 50) flag('holders', 'some', `About ${wallets} wallets hold it (the block explorer's count, ${without}).`);
    else flag('holders', 'ok', `About ${wallets} wallets hold it (the block explorer's count, ${without}).`);
  }
  const dexRead = Boolean(dex && !dex.failed && !dex.missing && dex.liquidity !== null);
  if (graduated) {
    poolFlags(flag, dex);
    lockedNote(flag, chain);
  }
  fact('Stage', !knownStage ? '—' : state === STAGE.TRADING && reserveWei === null ? 'On its curve' : stageWord(state, progress));
  if (graduated) fact('In its pool', dexRead ? usd(dex.liquidity) : '—');
  else fact('In its curve', inPair !== null ? amountOf(inPair) : '—');
  fact('Paired with', pairWord ?? 'its pair token');
  fact('Holders', wallets !== null ? `about ${wallets}` : '—');
  fact('Creator holds', creator !== null ? percent(creator) : '—');
  fact('Read from', ['Robinhood Chain', ...(holderCount !== null ? ['the block explorer'] : []), ...(graduated && dexRead ? ['DexScreener'] : [])].join(', '));
  fact('Contract', short(address));
  const ORDER = { high: 0, some: 1, ok: 2, info: 3 };
  flags.sort((a, b) => ORDER[a.sev] - ORDER[b.sev]);
  const level = flags.some((f) => f.sev === 'high') ? 'high' : 'some';
  return {
    address, symbol, name,
    adult: isCrude(`${rawName || ''} ${rawSymbol || ''}`), image: Boolean(pictureOf(chain.logo)), createdAt: 0,
    graduated, progress, official, copyOfficial, level, flags, facts,
    links: { clank: `https://clank.trade/coin/${address}`, explorer: `https://robinhoodchain.blockscout.com/token/${address}` },
    checkedAt: now, source: 'chain', onchain: onchainOf(chain),
  };
}
