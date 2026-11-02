// Public Kolscan page snapshots only. No authenticated API, cookies, wallet calls,
// protected trade stream, or browser impersonation. This is a directory/ranking,
// never a claim that a real trader made a simulated trade in this game.
import { readLimited } from './coins.js';

export const KOLSCAN_PAGE = 'https://kolscan.io/leaderboard';
export const KOLSCAN_LIMITS = Object.freeze({ bytes: 2_000_000, chunks: 2048, nodes: 100_000, traders: 1000,
  freshMs: 60_000, staleMs: 600_000, retryMs: 15_000, timeoutMs: 8000 });
const SOURCE = Object.freeze({ name: 'Kolscan', url: KOLSCAN_PAGE });
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const cleanText = (raw, max = 80) => typeof raw === 'string' ? [...raw.normalize('NFKC')
  .replace(/[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '').replace(/\s+/g, ' ').trim()].slice(0, max).join('') : '';
const number = (raw, max = 1e12) => typeof raw === 'number' && Number.isFinite(raw) && Math.abs(raw) <= max ? raw : null;
const count = (raw) => Number.isSafeInteger(raw) && raw >= 0 && raw <= 1e9 ? raw : null;

export function kolscanAddress(raw) {
  if (typeof raw !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(raw)) return null;
  let n = 0n;
  for (const ch of raw) n = n * 58n + BigInt(BASE58.indexOf(ch));
  const zeroes = /^1*/.exec(raw)[0].length;
  const bytes = n ? Math.ceil(n.toString(2).length / 8) : 0;
  return zeroes + bytes === 32 ? raw : null;
}

function twitter(raw) {
  if (typeof raw !== 'string' || raw.length > 200) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.port || u.username || u.password || !['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(u.hostname)) return null;
    const match = /^\/([a-zA-Z0-9_]{1,15})\/?$/.exec(u.pathname);
    if (!match || ['home', 'explore', 'search', 'i', 'intent', 'settings', 'messages', 'notifications'].includes(match[1].toLowerCase())) return null;
    return { handle: match[1], twitterUrl: `https://x.com/${match[1]}` };
  } catch { return null; }
}

function avatar(raw, address) {
  if (typeof raw !== 'string' || raw.length > 200) return null;
  // An address path on the one observed public CDN; never proxy/follow arbitrary image URLs.
  return raw === `https://cdn.kolscan.io/profiles/${address}.png` ? raw : null;
}

// React's streamed page puts JSON data inside escaped JSON string literals, sometimes
// split midway through a row. Decode strings as data and join before parsing rows;
// never execute script tags, evaluate JS, or fetch application bundles.
function pageData(html) {
  const chunks = [], pattern = /self\.__next_f\.push\((\[1,"(?:[^"\\]|\\.)*"\])\)/g;
  for (const match of html.matchAll(pattern)) {
    if (chunks.length >= KOLSCAN_LIMITS.chunks) return null;
    try { chunks.push(JSON.parse(match[1])[1]); } catch { return null; }
  }
  if (!chunks.length) return null;
  const queue = [], fields = {};
  for (const line of chunks.join('').split('\n')) {
    const colon = line.indexOf(':'), content = line.slice(colon + 1);
    if (colon < 1 || !/^[a-z0-9]+$/i.test(line.slice(0, colon)) || !['[', '{'].includes(content[0])) continue;
    try { queue.push(JSON.parse(content)); } catch { /* Framework control rows are not application JSON. */ }
  }
  let visited = 0;
  while (queue.length) {
    if (++visited > KOLSCAN_LIMITS.nodes) return null;
    const item = queue.pop();
    if (!item || typeof item !== 'object') continue;
    for (const [key, value] of Object.entries(item)) {
      if (['initialData', 'initLeaderboard', 'priceData'].includes(key)) {
        if (fields[key] !== undefined) return null;
        fields[key] = value;
      } else if (value && typeof value === 'object') queue.push(value);
    }
  }
  return fields;
}

export function parseKolscanPage(html) {
  if (typeof html !== 'string' || Buffer.byteLength(html, 'utf8') > KOLSCAN_LIMITS.bytes) return null;
  const data = pageData(html);
  if (!data || !Array.isArray(data.initialData) || !Array.isArray(data.initLeaderboard)) return null;
  if (data.initialData.length > 5000 || data.initLeaderboard.length > 5000) return null;
  const avatars = new Map();
  for (const match of html.matchAll(/<img\b[^>]*\bsrc="(https:\/\/cdn\.kolscan\.io\/profiles\/([1-9A-HJ-NP-Za-km-z]{32,44})\.png)"[^>]*>/gi)) {
    const address = kolscanAddress(match[2]); if (address) avatars.set(address, match[1]);
  }
  const people = new Map();
  const person = (row) => {
    const address = kolscanAddress(row?.wallet_address), name = cleanText(row?.name);
    if (!address || !name || row.chain && row.chain !== 'solana') return null;
    const social = twitter(row.twitter);
    return { id: `kolscan:${address}`, address, chain: 'solana', name, handle: social?.handle || null,
      twitterUrl: social?.twitterUrl || null, avatar: avatar(row.pfp, address) || avatars.get(address) || null,
      url: `https://kolscan.io/account/${address}`, rank: null, pnlSol: null, wins: null, losses: null,
      volumeSol: null, positions: null, rankings: { '1d': null, '7d': null, '30d': null } };
  };
  // Keep the source's displayed rank, including gaps caused by a malformed source row.
  const ranks = { '1d': 0, '7d': 0, '30d': 0 };
  for (let i = 0; i < data.initLeaderboard.length && people.size < KOLSCAN_LIMITS.traders; i++) {
    const row = data.initLeaderboard[i], period = { 1: '1d', 7: '7d', 30: '30d' }[row?.timeframe];
    if (!period || !Number.isInteger(row.timeframe)) continue;
    const rank = ++ranks[period], p = person(row);
    if (!p) continue;
    const known = people.get(p.address) || p;
    if (known.rankings[period]) continue;
    const pnl = number(row.profit), wins = count(row.wins), losses = count(row.losses);
    if (pnl !== null && wins !== null && losses !== null) {
      known.rankings[period] = Object.freeze({ rank, pnlSol: pnl, wins, losses });
      if (period === '1d') Object.assign(known, known.rankings[period]);
    }
    people.set(p.address, known);
  }
  for (const row of data.initialData) {
    if (people.size >= KOLSCAN_LIMITS.traders) break;
    const p = person(row); if (!p) continue;
    if (!people.has(p.address)) people.set(p.address, p);
    else {
      const known = people.get(p.address);
      if (!known.avatar && p.avatar) known.avatar = p.avatar;
      if (!known.twitterUrl && p.twitterUrl) { known.twitterUrl = p.twitterUrl; known.handle = p.handle; }
    }
  }
  if (!people.size) return null;
  const sol = number(data.priceData?.SOL, 1e7);
  return { solUsd: sol !== null && sol > 0 ? sol : null, period: '1d',
    traders: Object.freeze([...people.values()].map((p) => Object.freeze({ ...p, rankings: Object.freeze(p.rankings) }))) };
}

function envelope(chain, status, checkedAt, snapshot = null) {
  const unsupported = status === 'unsupported';
  return { v: 1, source: SOURCE, chain, status, asOf: snapshot?.asOf ?? null, checkedAt,
    solUsd: snapshot?.solUsd ?? null, period: '1d', traders: snapshot?.traders || [], activity: [], activityStatus: 'unavailable',
    note: unsupported ? 'Kolscan public rankings cover Solana. No verified trader directory is available here for this chain.'
      : status === 'unavailable' ? 'The public trader directory could not be refreshed. Real trade activity is unavailable.'
        : status === 'stale' ? 'Showing the last available Kolscan daily ranking. Real trade activity is unavailable.'
          : 'Public Solana identities and daily rankings from Kolscan. Rankings are separate from this practice run; real trade activity is unavailable.' };
}

export function createTerminalKolsService({ fetcher = (...args) => fetch(...args), now = Date.now } = {}) {
  let snapshot = null, checkedAt = null, running = null, failed = false;
  async function refresh() {
    checkedAt = now();
    try {
      const response = await fetcher(KOLSCAN_PAGE, { method: 'GET', redirect: 'error', credentials: 'omit',
        headers: { Accept: 'text/html', 'User-Agent': 'AGI1-Practice-Terminals/1.0 (+https://agi1.app)' }, signal: AbortSignal.timeout(KOLSCAN_LIMITS.timeoutMs) });
      if (!response.ok || response.status !== 200 || !/^text\/html(?:;|$)/i.test(response.headers.get('content-type') || '')) throw new Error('source_unavailable');
      const bytes = await readLimited(response, KOLSCAN_LIMITS.bytes);
      const parsed = bytes && parseKolscanPage(bytes.toString('utf8'));
      if (!parsed) throw new Error('invalid_snapshot');
      snapshot = { ...parsed, asOf: now() }; failed = false;
    } catch { failed = true; }
  }
  return {
    async get(chain = 'solana') {
      if (chain !== 'solana') return envelope(chain, 'unsupported', now());
      const at = now();
      const fresh = snapshot && at >= snapshot.asOf && at - snapshot.asOf < KOLSCAN_LIMITS.freshMs;
      const retryLater = failed && checkedAt !== null && at >= checkedAt && at - checkedAt < KOLSCAN_LIMITS.retryMs;
      if (!fresh && !retryLater) {
        running ??= refresh().finally(() => { running = null; });
        await running;
      }
      const age = snapshot ? now() - snapshot.asOf : Infinity;
      if (snapshot && age >= 0 && age <= KOLSCAN_LIMITS.staleMs) return envelope('solana', failed ? 'stale' : 'live', checkedAt, snapshot);
      return envelope('solana', 'unavailable', checkedAt);
    },
  };
}

const service = createTerminalKolsService();
export async function terminalKolsResponse(request, source = service) {
  const noStore = { 'Cache-Control': 'no-store' };
  if (request.method !== 'GET') return Response.json({ error: 'method_not_allowed' }, { status: 405, headers: noStore });
  const match = /^\?terminal=kols&chain=([a-z]{1,16})$/.exec(new URL(request.url).search);
  if (!match) return Response.json({ error: 'bad_request' }, { status: 400, headers: noStore });
  const result = await source.get(match[1]);
  return Response.json(result, { status: result.status === 'unavailable' ? 503 : 200,
    headers: { 'Cache-Control': result.status === 'live' ? 'public, max-age=15, s-maxage=30'
      : result.status === 'unsupported' ? 'public, max-age=300, s-maxage=300' : 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
