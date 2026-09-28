// The Arena's coins (Phase 6): which coins are in the Arena, and the checks a nominated coin must pass before
// visitors can vote it in. Database functions: supabase/coins.sql (they decide, in one step, when a coin joins).
// Before coins.sql is run, the Arena keeps its first three coins (TOKENS) and nominations say "open soon".
//
// A nominated coin must:
//   1. have a page on clank.trade (so it was launched there; the page also gives its name, ticker and logo)
//   2. trade on a DEX with at least $5,000 of liquidity (DexScreener), so the Arena never lists dead or fake coins
//   3. have a ticker we can show (A–Z, 0–9) and a PG-13 name without links
// Logos are only ever shown for coins that 20 humans voted in (never for nominations), through /api/logo.
import { createHash } from 'node:crypto';
import { TOKENS, bestPair } from '../src/prices/parse.js';
import { arenaRpc } from './arena.js';

export const CORE = ['AGI', 'CABO'];            // always in the Arena
export const NEED = 20;                         // votes from different humans within 7 days to join
export const MAX_OTHERS = 6;                    // the Arena holds 8 coins: AGI, CABO and up to 6 others
export const MIN_LIQUIDITY = 5_000;             // USD in the coin's biggest DEX pool, to be nominated
export const LOW_LIQUIDITY = 1_000;             // below this, a coin leaves the Arena (the keep-alive checks 3 times a day)
export const DAILY_NOMINATIONS = 2;             // per visitor per day
export const SITE_NOMINATIONS = 50;             // per day for the whole site

// The Arena's first coins, with the logos in public/images/coins/ (used until coins.sql is run).
export const FALLBACK_COINS = TOKENS.map((t) => ({
  address: t.ca, symbol: t.symbol, name: t.name, logo: `/images/coins/${t.symbol.toLowerCase()}.webp`,
  status: CORE.includes(t.symbol) ? 'core' : 'listed', listed_at: null,
}));

// ---------- names and tickers ----------
// Tickers: A–Z and 0–9, up to 12 ("$pepe" → "PEPE"). Anything else can't be shown safely everywhere (share posts, the stage).
export function cleanSymbol(raw) {
  const s = String(raw ?? '').normalize('NFKC').trim().replace(/^\$+/, '').toUpperCase();
  return /^[A-Z0-9]{1,12}$/.test(s) ? s : null;
}
// Names: no invisible or direction-changing characters, single spaces, at most 40 characters.
const INVISIBLE = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u206f\\ufeff]', 'g');
export function cleanName(raw) {
  const s = String(raw ?? '').normalize('NFKC')
    .replace(INVISIBLE, '')
    .replace(/\s+/g, ' ').trim();
  if (!s) return null;
  const chars = [...s];
  return chars.length > 40 ? `${chars.slice(0, 39).join('').trimEnd()}…` : s;
}
// PG-13 and no links: the site shows these words to everyone. (A coin that slips through: the owner removes it, see coins.sql.)
const BLOCKED = /(fuck|porn|hentai|onlyfans|pawg|cunt|whore|slut|milf|nude|naked|xxx|boob|titties|pussy|penis|vagina|horny|blowjob|dildo|sexy|sexual|nigg|faggot|hitler|nazi|rapist)|\b(sex|anal|cum|tits?|cock|dick|rape|fag|retard|kkk)\b/i;
const LINKY = /https?:|www\.|t\.me\/|\.(com|io|xyz|net|org|app|fun|trade|gg|me|co|ai|lol|site|link|club|vip)\b/i;
export const fitToShow = (text) => !BLOCKED.test(String(text)) && !LINKY.test(String(text));
// ClankChecker (2026-09-26) shows every clank.trade coin, crude names too (the owner's choice), but a coin with a crude or
// sexual name only shows its picture after the 18+ check
export const isCrude = (text) => BLOCKED.test(String(text));

// ---------- pictures (the Arena's logos, and ClankChecker's coin pictures) ----------
export const PICTURE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']);
export const PICTURE_MAX_BYTES = 1_000_000;
// The file really is the picture type it claims (the first bytes of every format are fixed). Never SVG (it can carry code).
export function looksLike(type, b) {
  const at = (i, s) => b.length >= i + s.length && [...s].every((ch, k) => b[i + k] === ch.charCodeAt(0));
  if (type === 'image/png') return b[0] === 0x89 && at(1, 'PNG');
  if (type === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (type === 'image/gif') return at(0, 'GIF8');
  if (type === 'image/webp') return at(0, 'RIFF') && at(8, 'WEBP');
  if (type === 'image/avif') return at(4, 'ftyp');
  return false;
}

// ---------- logos ----------
// Only pictures from where clank.trade keeps them (its Pinata IPFS gateway: /ipfs/<content id>) or from DexScreener's
// picture server. Anything else is ignored, so /api/logo can never be made to fetch other addresses.
export function safeLogoUrl(raw) {
  const text = String(raw || '');
  let u;
  try { u = new URL(text); } catch { return ''; }
  if (u.protocol !== 'https:' || u.port || u.username || u.password || text.includes('..')) return '';
  const pinata = /^[a-z0-9-]+\.mypinata\.cloud$/.test(u.hostname), dex = /^(cdn|dd)\.dexscreener\.com$/.test(u.hostname);
  if (pinata && !/^\/ipfs\/[A-Za-z0-9]{20,100}(\/[A-Za-z0-9._-]{1,80})?$/.test(u.pathname)) return '';
  if (dex && !/^\/[A-Za-z0-9._/-]{1,200}$/.test(u.pathname)) return '';
  return pinata || dex ? `https://${u.hostname}${u.pathname}` : '';
}
// The address /api/logo fetches: Pinata shrinks pictures to the size we ask for (clank.trade's own page does the same).
export function logoFetchUrl(source, size) {
  const base = safeLogoUrl(source);
  if (!base) return null;
  const host = new URL(base).hostname;
  if (host.endsWith('.mypinata.cloud')) return `${base}?img-width=${size}&img-height=${size}&img-fit=cover&img-quality=90&img-format=webp`;
  if (host === 'cdn.dexscreener.com') return `${base}?width=${size}&height=${size}&fit=crop&quality=90&format=auto`;
  return base;
}
// What the page gets: a small logo for the leaderboard (64 px) and a big one for the stage's champion card (256 px), both on
// our own address. `v` changes when the picture's source changes, so browsers and the CDN fetch the new one.
export function logoUrls(c) {
  const local = /^\/images\/coins\/([a-z0-9-]+)\.webp$/.exec(c.logo || '');
  if (local) return { logo: `/images/coins/${local[1]}-64.webp`, logoLarge: c.logo };
  if (!safeLogoUrl(c.logo)) return { logo: '', logoLarge: '' };
  const v = createHash('sha256').update(c.logo).digest('base64url').slice(0, 8);
  return { logo: `/api/logo?a=${c.address}&s=64&v=${v}`, logoLarge: `/api/logo?a=${c.address}&s=256&v=${v}` };
}
export const publicCoin = (c) => ({
  symbol: c.symbol, name: c.name, address: c.address, ...logoUrls(c),
  core: c.status === 'core', listedAt: c.listed_at || null, buy: `https://clank.trade/coin/${c.address}`,
});

// ---------- the checks ----------
// (ClankChecker reads clank.trade with the same name: server/checker.js). Since the domain switch (2026-09-27) it names
// the site's real address, so clank.trade and the picture host can see who's asking.
export const UA = 'Mozilla/5.0 (compatible; AGIArena/1.0; +https://agi1.app)';
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decodeHtml = (s) => String(s).replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,6});/gi, (m, e) => {
  if (e[0] === '#') {
    const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
  }
  return ENTITIES[e.toLowerCase()] ?? m;
});

// Reads at most `max` bytes of an answer. `cut`: keep the start of a bigger answer (a web page), else give up (null).
export async function readLimited(res, max, { cut = false } = {}) {
  const reader = res.body?.getReader?.();
  if (!reader) return Buffer.alloc(0);
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (size + value.length > max) {
      reader.cancel().catch(() => {});
      if (!cut) return null;
      chunks.push(value.subarray(0, max - size));
      break;
    }
    chunks.push(value);
    size += value.length;
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

// The coin's clank.trade page. Its title is "<Name> (<TICKER>) · Clank.trade", or "Coin not found · Clank.trade".
// → { name, symbol, logo } or { error: 'not_clank' | 'unverified' }
export async function checkClank(address) {
  let res;
  try {
    res = await fetch(`https://clank.trade/coin/${address}`, {
      headers: { 'User-Agent': UA, Accept: 'text/html' }, signal: AbortSignal.timeout(6000),
    });
  } catch {
    return { error: 'unverified' };
  }
  if (res.status === 404) return { error: 'not_clank' };
  if (!res.ok) return { error: 'unverified' };
  let html;
  try { html = (await readLimited(res, 600_000, { cut: true })).toString('utf8'); } catch { return { error: 'unverified' }; }
  const title = decodeHtml(html.match(/<title[^>]*>([\s\S]{0,400}?)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim();
  if (/^coin not found\b/i.test(title)) return { error: 'not_clank' };
  const m = title.match(/^(.+)\s\(([^()]{1,40})\)\s*·\s*Clank\.trade$/i);
  if (!m) return { error: 'unverified' };             // not the page we expected (e.g. a "checking your browser" page)
  const pic = html.match(/https:\/\/([a-z0-9-]+\.mypinata\.cloud)\/ipfs\/([A-Za-z0-9]{20,100})/);
  return { name: m[1].trim(), symbol: m[2].trim(), logo: pic ? `https://${pic[1]}/ipfs/${pic[2]}` : '' };
}

// The coin's biggest DEX pool on DexScreener. → { liquidity, image } or { error: 'not_trading' | 'unverified' }
export async function checkDex(address) {
  let data;
  try {
    const res = await fetch(`https://api.dexscreener.com/tokens/v1/robinhood/${address}`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { error: 'unverified' };
    data = await res.json();
  } catch {
    return { error: 'unverified' };
  }
  const best = bestPair(data, address);
  if (!best) return { error: 'not_trading' };
  return { liquidity: Number(best.liquidity?.usd) || 0, image: best.info?.imageUrl || '' };
}

// All the checks for a new nomination, the two lookups at the same time.
// → { coin: { address, symbol, name, logo } } or { error, liquidity?, source? }
export async function checkCoin(address) {
  const [clank, dex] = await Promise.all([checkClank(address), checkDex(address)]);
  if (clank.error === 'not_clank') return { error: 'not_clank' };
  if (clank.error) return { error: 'unverified', source: 'clank.trade' };
  if (dex.error === 'not_trading') return { error: 'not_trading' };
  if (dex.error) return { error: 'unverified', source: 'DexScreener' };
  if (dex.liquidity < MIN_LIQUIDITY) return { error: 'low_liquidity', liquidity: Math.floor(dex.liquidity) };
  const symbol = cleanSymbol(clank.symbol), name = cleanName(clank.name);
  if (!symbol) return { error: 'bad_symbol' };
  if (!name || !fitToShow(`${name} ${symbol}`)) return { error: 'not_allowed' };
  return { coin: { address, symbol, name, logo: safeLogoUrl(clank.logo) || safeLogoUrl(dex.image) || '' } };
}

// ---------- the coin list ----------
// For the scoreboard: the coins in the Arena, the ones that left recently (a recent champion keeps its name and logo),
// and the nominations. Before coins.sql is run: the first three coins, and `candidates: null` ("open soon").
export async function loadCoinBoard(cfg) {
  try {
    const b = await arenaRpc(cfg, 'coin_board', { p_need: NEED, p_max: MAX_OTHERS });
    return {
      coins: (b.coins || []).map(publicCoin),
      retired: (b.retired || []).map(publicCoin),
      candidates: (b.candidates || []).map((c) => ({ symbol: c.symbol, name: c.name, address: c.address, votes: c.votes, buy: `https://clank.trade/coin/${c.address}` })),
    };
  } catch (err) {
    if (err.code !== 'not_ready') throw err;
    return { coins: FALLBACK_COINS.map(publicCoin), retired: [], candidates: null };
  }
}

// The tickers that can get Arena votes right now, for /api/vote. Kept 30 s per server copy; `fresh` asks again
// (a coin voted in a moment ago can get votes right away).
let active = { at: 0, list: null };
export async function activeSymbols(cfg, { fresh = false, now = Date.now() } = {}) {
  if (!fresh && active.list && now - active.at < 30_000) return active.list;
  let list;
  try {
    list = await arenaRpc(cfg, 'coin_active', {});
  } catch (err) {
    if (err.code !== 'not_ready') throw err;
    list = FALLBACK_COINS.map((c) => c.symbol);
  }
  active = { at: now, list: Array.isArray(list) ? list : [] };
  return active.list;
}
export const forgetActiveSymbols = () => { active = { at: 0, list: null }; };   // for tests

// Keep-alive (3 times a day): a coin in the Arena whose DEX liquidity is almost gone leaves it, so the Arena (and the
// champion's Buy button) never points people at a coin nobody can trade. AGI and CABO always stay. Never throws.
export async function sweepCoins(cfg) {
  try {
    const board = await arenaRpc(cfg, 'coin_board', { p_need: NEED, p_max: MAX_OTHERS });
    const listed = (board.coins || []).filter((c) => c.status === 'listed');
    if (!listed.length) return { checked: 0, retired: [] };
    const res = await fetch(`https://api.dexscreener.com/tokens/v1/robinhood/${listed.map((c) => c.address).join(',')}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`DexScreener HTTP ${res.status}`);
    const data = await res.json();
    // only a pool DexScreener actually reports as nearly empty counts (a coin missing from one answer is left alone)
    const low = listed.filter((c) => {
      const liq = Number(bestPair(data, c.address)?.liquidity?.usd);
      return Number.isFinite(liq) && liq < LOW_LIQUIDITY;
    });
    if (low.length) {
      await arenaRpc(cfg, 'coin_retire', { p_addresses: low.map((c) => c.address), p_note: 'low liquidity' });
      console.log(`[coins] left the Arena (liquidity under $${LOW_LIQUIDITY}): ${low.map((c) => `$${c.symbol}`).join(', ')}`);
    }
    return { checked: listed.length, retired: low.map((c) => c.symbol) };
  } catch (err) {
    if (err.code === 'not_ready') return { skipped: 'coins.sql not run yet' };
    console.error('[coins] liquidity check failed:', err.message);
    return { error: 'failed' };
  }
}
