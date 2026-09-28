// ClankChecker (2026-09-26, the owner's idea): a risk scan of the coins on clank.trade, from public data only.
//   • the list: every coin clank.trade has (new, old and graduated), read from clank.trade's own API, the one its website
//     uses (`coins.list`, 12 coins a page), with its trending list and the price of ETH;
//   • one coin, when someone asks AGI-1 about it: its details, its 100 biggest holders and its last 100 trades (clank.trade,
//     one request), other coins with the same ticker (clank.trade's search), and for a graduated coin its DEX pool
//     (DexScreener) and how many wallets hold it (the Blockscout block explorer).
// The scan turns what it read into flags (high / some = a red flag, ok / info = good to know) and a level: any high flag →
// High risk, else any "some" → Some risk, else Lower risk. If clank.trade doesn't answer, there's no guess: "Not enough
// data" (fail closed). Rough automated checks, never an audit and never advice: nothing here says buy, sell or safe.
// Since 2026-09-26 (the owner's second round): the newest coins every few seconds (latestClank: new launches show up at
// once), every coin's picture (coinPicture, from clank.trade's own picture host), and every coin, crude names included (the
// owner: "they are part of clank trade"; hate slurs are still masked, and a crude coin's picture waits for the 18+ check).
// api/checker.js serves all of it (Vercel's CDN shares each answer); src/sections/checker.js shows it.
import { TOKENS, bestPair } from '../src/prices/parse.js';
import { tickerKey, markCopycats } from '../src/checker/copycat.js';
import { UA, cleanName, isCrude, readLimited, looksLike, PICTURE_TYPES, PICTURE_MAX_BYTES } from './coins.js';

export { tickerKey, markCopycats };

const CLANK_API = 'https://clank.trade/v1/trpc/';
const DEX_API = 'https://api.dexscreener.com/tokens/v1/robinhood/';
const EXPLORER_API = 'https://robinhoodchain.blockscout.com/api/v2/tokens/';
const ETH = '0x0000000000000000000000000000000000000000';            // clank.trade coins trade against ETH
// Uniswap v4's PoolManager on Robinhood Chain: every clank.trade pool keeps its coins there, so it's not a wallet
export const POOL_MANAGER = '0x8366a39cc670b4001a1121b8f6a443a643e40951';
const NOBODY = [ETH, '0x000000000000000000000000000000000000dead'];   // burned coins
export const OFFICIAL = TOKENS[0].ca;                                 // $AGI, the site's own coin
export const MAX_PAGES = 80;                                          // 12 coins a page: 960 coins (202 on 2026-09-26)
const ADDRESS = /^0x[0-9a-f]{40}$/;
// clank.trade keeps coin pictures on IPFS and shows them through its own Pinata gateway (which also shrinks them)
const PICTURE_HOST = 'https://yellow-total-guanaco-389.mypinata.cloud/ipfs/';
const CID = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{50,100})$/;         // (the same check clank.trade's page makes)
// a row's circle (cut to a square) and the big view (the whole picture, never enlarged: 400 px stays 400 px)
export const PICTURE_SIZES = [96, 512];
const PICTURE_FIT = { 96: 'cover', 512: 'scale-down' };

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
// One request to clank.trade's API with several questions at once ("batch"): [[name, input], …] → for each question
// { data } or { error: 'not_found' | 'bad' }. Throws when clank.trade doesn't answer properly (down, a bot wall, a change).
export async function clankApi(calls, { timeoutMs = 8000 } = {}) {
  const names = calls.map(([name]) => name).join(',');
  const input = Object.fromEntries(calls.map(([, value], i) => [i, value ?? {}]));
  const res = await fetch(`${CLANK_API}${names}?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs),
  });
  // 200 = all answered, 207 = some did, 404 = all "not found"; anything else is an outage or a wall
  if (![200, 207, 404].includes(res.status)) throw new Error(`clank.trade HTTP ${res.status}`);
  const bytes = await readLimited(res, 3_000_000);
  if (!bytes) throw new Error('clank.trade answer too big');
  let body;
  try { body = JSON.parse(bytes.toString('utf8')); } catch { throw new Error('clank.trade answer is not JSON'); }
  if (!Array.isArray(body) || body.length !== calls.length) throw new Error('clank.trade answer has an unexpected shape');
  return body.map((item) => (item && typeof item === 'object' && 'result' in item
    ? { data: item.result?.data ?? null }
    : { error: item?.error?.data?.httpStatus === 404 ? 'not_found' : 'bad' }));
}

// ---------- the list of every coin ----------
// Which picture each coin has, remembered from the lists this server copy read (so a picture rarely costs a lookup)
const pictures = new Map();
export const forgetPictures = () => pictures.clear();            // (for the tests)
function remember(coins) {
  for (const c of coins) {
    if (!c.cid) continue;
    pictures.delete(c.address);
    pictures.set(c.address, c.cid);
    if (pictures.size > 5000) pictures.delete(pictures.keys().next().value);
  }
}
// A coin as the page lists it: every coin clank.trade has (hate slurs in a name are masked). `adult`: its name is crude
// or sexual (its picture waits for the 18+ check); `image`: it has a picture (served by /api/checker?logo=…).
function listCoin(c, ethUsd, trendingRank) {
  const address = lc(c?.address);
  if (!isAddress(address)) return null;
  const symbol = showTicker(c.symbol), name = cleanName(c.name);
  const mcEth = Math.max(0, num(c.marketCap) ?? 0);
  const cid = cidOf(c.image);
  return {
    address, symbol: maskSlurs(symbol), name: maskSlurs(name),
    graduated: Number(c.state) !== 0,
    progress: Math.min(100, Math.max(0, +(num(c.progress) ?? 0).toFixed(2))),
    createdAt: (num(c.createdAt) ?? 0) * 1000,
    marketCap: ethUsd ? Math.round(mcEth * ethUsd) : null,
    trending: trendingRank ?? 0,
    official: address === OFFICIAL,
    adult: isCrude(`${name || ''} ${symbol || ''}`),
    image: Boolean(cid),
    mcEth, cid,
  };
}
const publicCoin = ({ mcEth, cid, ...c }) => c;
// clank.trade's trending list (its own order), only real addresses → [coin]
const trendingList = (data) => (Array.isArray(data) ? data : []).filter((c) => isAddress(c?.address)).slice(0, 50);
const ethPrice = (rate) => (num(rate.data?.price) > 0 ? num(rate.data.price) : null);
// the first page of coins.list, trending and the ETH price: the one request both lists start with
const FIRST = [['coins.list', {}], ['coins.trending', {}], ['exchangeRates.tokenUsdg', { token: ETH }]];
function listed(raw, ethUsd, trending) {
  const ranks = new Map(trending.map((c, i) => [lc(c.address), i + 1]));
  const seen = new Set();
  return raw.map((c) => listCoin(c, ethUsd, ranks.get(lc(c?.address)))).filter((c) => c && !seen.has(c.address) && seen.add(c.address));
}

// Every coin, page by page (clank.trade only gives 12 at a time), newest first. Stops after MAX_PAGES or `budgetMs`
// (a function may run 25 s): then `complete` is false and the oldest coins are missing (still checkable by address).
export async function scanClank({ budgetMs = 18_000, now = Date.now() } = {}) {
  const t0 = Date.now();
  const [first, trending, rate] = await clankApi(FIRST);
  if (!Array.isArray(first.data?.coins)) throw new Error('clank.trade sent no coin list');
  const raw = [...first.data.coins];
  let cursor = first.data.nextCursor, pages = 1;
  while (typeof cursor === 'string' && cursor && cursor.length < 1000 && pages < MAX_PAGES && Date.now() - t0 < budgetMs) {
    const [page] = await clankApi([['coins.list', { cursor }]]);
    if (!Array.isArray(page.data?.coins)) throw new Error('clank.trade sent no coin list');
    raw.push(...page.data.coins);
    cursor = page.data.nextCursor;
    pages += 1;
  }
  const ethUsd = ethPrice(rate);
  const all = listed(raw, ethUsd, trendingList(trending.data));
  markCopycats(all, { size: (c) => c.mcEth });
  remember(all);
  return {
    coins: all.map(publicCoin),
    total: all.length,
    graduated: all.filter((c) => c.graduated).length,
    complete: !cursor,
    ethUsd,
    updatedAt: now,
  };
}

// ---------- the newest coins, every few seconds (2026-09-26, the owner: new launches should show up fast) ----------
// One small request: the 12 newest coins (clank.trade's first page), its trending list (with each coin's market cap in
// dollars) and the price of ETH. The page asks for it every 10 s while ClankChecker is on screen and merges it into the
// whole list, so a coin launched a moment ago appears without a reload, and trending coins' numbers stay current.
export async function latestClank({ now = Date.now() } = {}) {
  const [first, trending, rate] = await clankApi(FIRST, { timeoutMs: 6000 });
  if (!Array.isArray(first.data?.coins)) throw new Error('clank.trade sent no coin list');
  const ethUsd = ethPrice(rate);
  const top = trendingList(trending.data);
  const coins = listed(first.data.coins, ethUsd, top);
  remember(coins);
  remember(top.map((c) => ({ address: lc(c.address), cid: cidOf(c.image) })));
  return {
    coins: coins.map(publicCoin),
    trending: top.map((c, i) => ({
      address: lc(c.address), rank: i + 1,
      marketCap: num(c.marketCapUsdg) !== null && num(c.marketCapUsdg) >= 0 ? Math.round(num(c.marketCapUsdg)) : null,
      progress: Math.min(100, Math.max(0, +(num(c.progress) ?? 0).toFixed(2))),
      graduated: c.isLive === true || (num(c.progress) ?? 0) >= 100,
    })),
    ethUsd,
    updatedAt: now,
  };
}

// ---------- a coin's picture ----------
// Its IPFS id: remembered from the lists this server copy read, else asked from clank.trade (the coin's details).
// → the id | null (not a clank.trade coin, or no picture) · throws when clank.trade doesn't answer
export async function coinPictureId(address) {
  if (!isAddress(address)) return null;
  if (pictures.has(address)) return pictures.get(address);
  const [d] = await clankApi([['coins.detail', { address }]], { timeoutMs: 6000 });
  if (d.error === 'not_found') return null;
  if (!d.data || lc(d.data.address) !== address) throw new Error('clank.trade sent no details');
  const cid = cidOf(d.data.image);
  if (cid) remember([{ address, cid }]);
  return cid;
}
// The picture itself, from clank.trade's own picture host, which shrinks it for us (size: 96 or 512). Only real pictures:
// PNG, JPEG, WebP, GIF or AVIF, checked by their first bytes (never SVG, which can carry code), at most 1 MB.
// → { bytes, type } | null (no such picture, or not a picture) · throws when the host doesn't answer
export async function fetchCoinPicture(cid, size) {
  if (!CID.test(String(cid)) || !PICTURE_SIZES.includes(size)) return null;
  const url = `${PICTURE_HOST}${cid}?img-width=${size}&img-height=${size}&img-fit=${PICTURE_FIT[size]}&img-quality=85&img-format=webp`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'image/webp,image/avif,image/png,image/jpeg,image/gif' },
    redirect: 'error', signal: AbortSignal.timeout(8000),
  });
  if (res.status === 404 || res.status === 400) { res.body?.cancel().catch(() => {}); return null; }
  if (!res.ok) { res.body?.cancel().catch(() => {}); throw new Error(`picture host HTTP ${res.status}`); }
  const type = String(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!PICTURE_TYPES.has(type)) { res.body?.cancel().catch(() => {}); return null; }
  const bytes = await readLimited(res, PICTURE_MAX_BYTES);
  return bytes && bytes.length && looksLike(type, bytes) ? { bytes, type } : null;
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

// Everything about one coin. → a scan (see analyze) or { error: 'not_clank' | 'unverified' }
export async function checkCoin(address, { now = Date.now() } = {}) {
  let first;
  try {
    first = await clankApi([
      ['coins.detail', { address }], ['coins.holders', { address }], ['coins.trades', { address, limit: 100 }],
      ['exchangeRates.tokenUsdg', { token: ETH }],
    ]);
  } catch (err) {
    console.warn(`[checker] couldn't read ${address} from clank.trade: ${err.message}`);
    return { error: 'unverified' };
  }
  const [d, h, t, r] = first;
  if (d.error === 'not_found') return { error: 'not_clank' };
  const detail = d.data;
  const holders = h.data?.holders, trades = t.data?.trades;
  // no half scans: without its details, holders and trades, there's nothing honest to say
  if (!detail || lc(detail.address) !== address || !Array.isArray(holders) || !Array.isArray(trades)) {
    console.warn(`[checker] clank.trade's answer for ${address} was incomplete`);
    return { error: 'unverified' };
  }
  remember([{ address, cid: cidOf(detail.image) }]);
  const graduated = Number(detail.state) !== 0;
  const query = String(detail.symbol ?? '').normalize('NFKC').replace(/^\$+/, '').trim().slice(0, 40);
  const [sameTicker, dex, holderCount] = await Promise.all([
    tickerKey(query)
      ? clankApi([['coins.list', { query }]]).then(([s]) => (Array.isArray(s.data?.coins) ? s.data.coins : null)).catch(() => null)
      : [],
    graduated ? readDex(address) : null,
    holders.length >= 100 ? readHolderCount(address) : null,
  ]);
  return analyze({ detail, holders, trades, ethUsd: num(r.data?.price), sameTicker, dex, holderCount, now });
}

// The scan itself, from what was read (no network here, so the tests can feed it anything).
//   detail: clank.trade's coins.detail · holders: [{ address, balance }] (its biggest, at most 100) · trades: its latest
//   (newest first) · ethUsd · sameTicker: clank.trade's search for its ticker (null = couldn't ask) · dex: readDex() (or null
//   for a coin on its bonding curve) · holderCount: from the block explorer (or null)
// → { address, symbol, name, adult, image, createdAt, graduated, progress, official, copyOfficial, level, flags, facts,
//     links, checkedAt } (symbol and name with hate slurs masked; adult: a crude or sexual name, so its picture waits for the
//     18+ check; image: it has a picture)
export function analyze({ detail, holders = [], trades = [], ethUsd = null, sameTicker = [], dex = null, holderCount = null, now = Date.now() }) {
  const address = lc(detail.address);
  const rawSymbol = showTicker(detail.symbol), rawName = cleanName(detail.name);
  const symbol = maskSlurs(rawSymbol), name = maskSlurs(rawName);
  const ticker = symbol ? `$${symbol}` : 'this ticker';
  const graduated = Number(detail.state) !== 0;
  const progress = Math.min(100, Math.max(0, +(num(detail.progress) ?? 0).toFixed(2)));
  const rate = num(ethUsd) > 0 ? num(ethUsd) : null;
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
  const nobodyBought = !graduated && progress === 0 && !trades100.length;
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
      const me = { address, official, graduated, mcEth: num(detail.marketCap) ?? 0, symbol: detail.symbol };
      const others = sameTicker.filter((c) => isAddress(c?.address) && lc(c.address) !== address && tickerKey(c.symbol) === key)
        .map((c) => ({ address: lc(c.address), official: lc(c.address) === OFFICIAL, graduated: Number(c.state) !== 0, mcEth: num(c.marketCap) ?? 0, symbol: c.symbol }));
      if (others.length) {
        markCopycats([me, ...others]);
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

  // 2. how far along it is: graduated (a DEX pool) or still on its bonding curve (how much ETH is in it)
  const reserve = /^\d{1,40}$/.test(String(detail.reserve)) ? Number(BigInt(detail.reserve) / 10n ** 12n) / 1e6 : null;   // ETH
  const inCurve = !graduated && reserve !== null && rate ? reserve * rate : null;
  const about = inCurve !== null ? ` (about ${usd(inCurve)} in it)` : '';
  if (graduated) flag('stage', 'ok', 'Graduated: it filled its bonding curve and now trades in a DEX pool.');
  else if (nobodyBought) flag('stage', 'high', 'Nobody has bought it yet: its bonding curve is at 0%.');
  else if (progress < 2) flag('stage', 'high', `Barely started: only ${progress}% of its bonding curve is filled${about}.`);
  else if (progress < 25) flag('stage', 'some', `Early: ${progress}% of its bonding curve is filled${about}.`);
  else flag('stage', 'info', `${progress}% of its bonding curve is filled${about}. It graduates at 100%.`);

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

  // 8. a graduated coin's DEX pool: how much is in it, and today's move
  if (graduated) {
    if (!dex || dex.failed || dex.missing || dex.liquidity === null) flag('pool', 'some', "Couldn't read its DEX pool right now.");
    else {
      if (dex.liquidity < 5_000) flag('pool', 'high', `Its pool holds only ${usd(dex.liquidity)}: small trades move the price a lot.`);
      else if (dex.liquidity < 20_000) flag('pool', 'some', `Its pool holds ${usd(dex.liquidity)}: bigger trades move the price a lot.`);
      else flag('pool', 'ok', `Its pool holds ${usd(dex.liquidity)}.`);
      if (dex.change !== null && dex.change <= -60) flag('drop', 'high', `Down ${Math.round(-dex.change)}% in 24 hours.`);
      else if (dex.change !== null && dex.change <= -30) flag('drop', 'some', `Down ${Math.round(-dex.change)}% in 24 hours.`);
    }
  }

  // the facts under the flags (the page shows them as a small table)
  const mcEth = num(detail.marketCap);
  const head = [
    ['Stage', graduated ? 'Graduated' : `Curve ${progress}%`],
    ['Launched', age !== null ? `${timeText(age)} ago` : '—'],
    ['Market cap', mcEth !== null && rate ? usd(mcEth * rate) : '—'],
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
    adult: isCrude(`${rawName || ''} ${rawSymbol || ''}`), image: Boolean(cidOf(detail.image)), createdAt: created,
    graduated, progress, official, copyOfficial, level, flags, facts,
    links: { clank: `https://clank.trade/coin/${address}`, explorer: `https://robinhoodchain.blockscout.com/token/${address}` },
    checkedAt: now,
  };
}
