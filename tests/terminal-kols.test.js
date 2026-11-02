import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerminalKolsService, parseKolscanPage, kolscanAddress, terminalKolsResponse, KOLSCAN_PAGE, KOLSCAN_LIMITS } from '../server/terminal-kols.js';

const A = '5YRgrP3mjGzrzirYYN5HAQH19cTYREYwGxW6XRJQUzij';
const B = 'CxgPWvH2GoEDENELne2XKAR2z2Fr4shG2uaeyqZceGve';
const C = 'DYmsQudNqJyyDvq86XmzAvrU9T7xwfQEwh6gPQw9TPNF';
const row = (wallet_address = A, fields = {}) => ({ wallet_address, name: 'Example trader', twitter: 'https://x.com/example_trader', pfp: null, ...fields });
const ranked = (wallet_address = A, fields = {}) => row(wallet_address, { profit: 12.5, wins: 4, losses: 2, timeframe: 1, ...fields });
function html(data = {}, split = true) {
  const stream = `4:${JSON.stringify(['$', '$L2', null, { initLeaderboard: [ranked()], initialData: [row(), row(B)], priceData: { SOL: 95.83 }, ...data }])}\n`;
  const parts = split ? [stream.slice(0, 67), stream.slice(67, 153), stream.slice(153)] : [stream];
  return `<html><img src="https://cdn.kolscan.io/profiles/${A}.png">${parts.map((p) => `<script>self.__next_f.push(${JSON.stringify([1, p])})</script>`).join('')}</html>`;
}
const response = (text = html(), extra = {}) => new Response(text, { headers: { 'Content-Type': 'text/html; charset=utf-8' }, ...extra });

test('public Kolscan HTML fragments yield verified Solana identities and source daily metrics only', () => {
  const data = parseKolscanPage(html({ initialData: [row(), row(B), row(B)], initLeaderboard: [ranked(), ranked(C, { timeframe: 7 })] }));
  assert.equal(data.traders.length, 3);
  assert.equal(data.solUsd, 95.83); assert.equal(data.period, '1d');
  assert.deepEqual(data.traders[0], { id: `kolscan:${A}`, address: A, chain: 'solana', name: 'Example trader',
    handle: 'example_trader', twitterUrl: 'https://x.com/example_trader', avatar: `https://cdn.kolscan.io/profiles/${A}.png`,
    url: `https://kolscan.io/account/${A}`, rank: 1, pnlSol: 12.5, wins: 4, losses: 2, volumeSol: null, positions: null,
    rankings: { '1d': { rank: 1, pnlSol: 12.5, wins: 4, losses: 2 }, '7d': null, '30d': null } });
  assert.equal(data.traders[1].rank, null); assert.equal(data.traders[1].pnlSol, null); assert.equal(data.traders[1].avatar, null);
  assert.equal(data.traders[1].rankings['7d'].rank, 1, 'weekly positions count independently of daily rows');
  assert.equal(data.traders[1].rankings['1d'], null, 'weekly PnL never becomes daily PnL');
  assert.ok(Object.isFrozen(data.traders));
});

test('Kolscan retains distinct daily weekly and monthly source results for the same real account', () => {
  const data = parseKolscanPage(html({ initLeaderboard: [ranked(A, { profit: 1 }), ranked(B, { profit: 2 }),
    ranked(B, { timeframe: 7, profit: 30 }), ranked(A, { timeframe: 7, profit: -4 }), ranked(A, { timeframe: 30, profit: 90 })] }));
  const a = data.traders.find((p) => p.address === A), b = data.traders.find((p) => p.address === B);
  assert.equal(a.pnlSol, 1); assert.equal(a.rankings['1d'].rank, 1);
  assert.equal(a.rankings['7d'].rank, 2); assert.equal(a.rankings['7d'].pnlSol, -4);
  assert.equal(a.rankings['30d'].rank, 1); assert.equal(a.rankings['30d'].pnlSol, 90);
  assert.equal(b.rankings['30d'], null); assert.equal(b.rankings['7d'].rank, 1);
  assert.ok(Object.isFrozen(a.rankings)); assert.ok(Object.isFrozen(a.rankings['7d']));
});

test('Kolscan parser rejects malformed payloads, invalid addresses and empty or oversized snapshots without evaluating scripts', () => {
  for (const source of ['', '<html>blocked</html>', '<script>self.__next_f.push([1,"broken)</script>', html({ initialData: null }),
    html({ initLeaderboard: null }), html({ initialData: [], initLeaderboard: [] }), 'x'.repeat(KOLSCAN_LIMITS.bytes + 1)]) assert.equal(parseKolscanPage(source), null);
  assert.equal(kolscanAddress('https://elsewhere.example/'), null); assert.equal(kolscanAddress(`0x${'1'.repeat(40)}`), null);
  assert.equal(kolscanAddress('z'.repeat(44)), null, 'base58 syntax alone does not prove a 32-byte Solana address');
  assert.equal(kolscanAddress(A), A); assert.equal(kolscanAddress('1'.repeat(32)), '1'.repeat(32));
  const inert = parseKolscanPage(`<script>globalThis.__kolscanExecuted=true</script>${html()}`);
  assert.equal(inert.traders.length, 2); assert.equal(globalThis.__kolscanExecuted, undefined);
  const invalid = parseKolscanPage(html({ initialData: [row('bad')], initLeaderboard: [ranked('bad')] }));
  assert.equal(invalid, null);
});

test('Kolscan public names and social URLs are sanitized; arbitrary avatar hosts and non-Solana rows are excluded', () => {
  const data = parseKolscanPage(html({ initialData: [row(A, { name: '\u202E  Real\u0000   name ', twitter: 'https://twitter.com/actual_name?tracking=1' }),
    row(B, { chain: 'base' }), row(C, { twitter: 'https://x.com.evil.test/not_real', pfp: 'https://evil.test/image.png' })], initLeaderboard: [] }));
  assert.deepEqual(data.traders.map((p) => p.address), [A, C]);
  assert.equal(data.traders[0].name, 'Real name'); assert.equal(data.traders[0].handle, 'actual_name');
  assert.equal(data.traders[0].twitterUrl, 'https://x.com/actual_name');
  assert.equal(data.traders[1].handle, null); assert.equal(data.traders[1].twitterUrl, null); assert.equal(data.traders[1].avatar, null);
  for (const unsafe of ['javascript:alert(1)', 'http://x.com/a', 'https://user:pass@x.com/a', 'https://x.com/intent/tweet', 'https://x.com/a/status/123', 'https://x.com:444/a']) {
    assert.equal(parseKolscanPage(html({ initLeaderboard: [], initialData: [row(C, { twitter: unsafe })] })).traders[0].handle, null);
  }
});

test('Kolscan invalid metrics stay unknown and source rank is not renumbered around bad data', () => {
  const data = parseKolscanPage(html({ initLeaderboard: [ranked('bad'), ranked(A, { profit: -20 }), ranked(B, { wins: -1 })] }));
  assert.equal(data.traders[0].rank, 2); assert.equal(data.traders[0].pnlSol, -20);
  assert.equal(data.traders[1].rank, null); assert.equal(data.traders[1].wins, null);
  assert.equal(parseKolscanPage(html({ priceData: { SOL: -9 } })).solUsd, null);
});

test('Kolscan service shares one fixed anonymous request, caches it, marks stale results and expires old snapshots', async () => {
  let now = 100_000, calls = 0, fail = false, release;
  const gate = new Promise((resolve) => { release = resolve; });
  const service = createTerminalKolsService({ now: () => now, fetcher: async (url, options) => {
    calls++; assert.equal(url, KOLSCAN_PAGE); assert.equal(options.method, 'GET'); assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error');
    assert.equal(Object.keys(options.headers).some((key) => /cookie|authorization|origin|referer/i.test(key)), false);
    assert.ok(options.signal instanceof AbortSignal); await gate;
    if (fail) throw new Error('upstream blocked'); return response();
  } });
  const first = service.get('solana'), same = service.get('solana'); release();
  const [a, b] = await Promise.all([first, same]); assert.equal(calls, 1); assert.deepEqual(a, b);
  assert.equal(a.status, 'live'); assert.equal(a.activityStatus, 'unavailable'); assert.deepEqual(a.activity, []); assert.equal(a.asOf, now);
  now += 1000; await service.get(); assert.equal(calls, 1);
  now += KOLSCAN_LIMITS.freshMs; fail = true;
  const stale = await service.get(); assert.equal(stale.status, 'stale'); assert.equal(stale.asOf, a.asOf); assert.equal(stale.checkedAt, now); assert.equal(calls, 2);
  await service.get(); assert.equal(calls, 2, 'failures have a retry backoff');
  now = a.asOf + KOLSCAN_LIMITS.staleMs + 1;
  const expired = await service.get(); assert.equal(expired.status, 'unavailable'); assert.deepEqual(expired.traders, []); assert.equal(expired.asOf, null);
  fail = false; now += KOLSCAN_LIMITS.retryMs; const recovered = await service.get(); assert.equal(recovered.status, 'live'); assert.equal(recovered.asOf, now);
});

test('unsupported chains including Clank never request or reuse Solana identities', async () => {
  let calls = 0;
  const service = createTerminalKolsService({ fetcher: async () => { calls++; return response(); } });
  await service.get('solana'); assert.equal(calls, 1);
  for (const chain of ['base', 'bnb', 'ethereum', 'monad', 'hyperevm', 'arbitrum', 'tron', 'robinhood', 'clank', 'unknown']) {
    const result = await service.get(chain); assert.equal(result.status, 'unsupported'); assert.equal(result.chain, chain);
    assert.deepEqual(result.traders, []); assert.equal(result.solUsd, null); assert.equal(result.asOf, null);
  }
  assert.equal(calls, 1);
});

test('Kolscan route permits only the canonical bounded query and rejects mutations or arbitrary targets before fetching', async () => {
  let calls = 0;
  const service = createTerminalKolsService({ fetcher: async () => { calls++; return response(); } });
  for (const query of ['', '?terminal=kols', '?terminal=kols&chain=solana&url=https://evil.test', '?chain=solana&terminal=kols',
    '?terminal=kols&chain=solana&chain=base', '?terminal=kols&chain=Solana', '?terminal=kols&chain=solana%26url=x']) {
    const result = await terminalKolsResponse(new Request(`https://agi1.app/api/checker${query}`), service); assert.equal(result.status, 400);
  }
  assert.equal((await terminalKolsResponse(new Request('https://agi1.app/api/checker?terminal=kols&chain=solana', { method: 'POST' }), service)).status, 405);
  assert.equal(calls, 0);
  const good = await terminalKolsResponse(new Request('https://agi1.app/api/checker?terminal=kols&chain=solana'), service);
  assert.equal(good.status, 200); assert.match(good.headers.get('cache-control'), /s-maxage=30/); assert.equal((await good.json()).source.name, 'Kolscan');
  const unsupported = await terminalKolsResponse(new Request('https://agi1.app/api/checker?terminal=kols&chain=clank'), service);
  assert.equal(unsupported.status, 200); assert.equal((await unsupported.json()).status, 'unsupported'); assert.equal(calls, 1);
});

test('Kolscan service rejects unexpected response types, redirects and oversized bodies, retaining no fabricated fallback', async () => {
  for (const source of [() => new Response('redirect', { status: 302, headers: { Location: 'https://evil.test' } }),
    () => new Response(html(), { headers: { 'Content-Type': 'application/json' } }), () => response('x'.repeat(KOLSCAN_LIMITS.bytes + 1)), () => response('<html>challenge</html>')]) {
    const service = createTerminalKolsService({ fetcher: async () => source() });
    const result = await terminalKolsResponse(new Request('https://agi1.app/api/checker?terminal=kols&chain=solana'), service);
    assert.equal(result.status, 503); assert.equal(result.headers.get('cache-control'), 'no-store');
    const body = await result.json(); assert.equal(body.status, 'unavailable'); assert.deepEqual(body.traders, []);
  }
});

test('existing checker entry routes KOL requests without falling into coin scans', async () => {
  const { GET } = await import('../api/checker.js');
  const oldFetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('no network expected'); };
  try {
    const unsupported = await GET(new Request('https://agi1.app/api/checker?terminal=kols&chain=robinhood'));
    assert.equal(unsupported.status, 200); assert.equal((await unsupported.json()).status, 'unsupported');
    assert.equal((await GET(new Request('https://agi1.app/api/checker?terminal=kols&chain=solana&url=x'))).status, 400);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = oldFetch; }
});
