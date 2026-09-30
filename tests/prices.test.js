// Tests for the live prices (src/prices/parse.js) and the contract address. No network needed. Run: npm test
import { test } from 'node:test';
import { BURN_ADDRESS } from '../src/lib/burns.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOKENS, CHAIN, pricesUrl, pickStats, fmtPrice, fmtCompact, fmtPct, fmtCount, supplyFrom } from '../src/prices/parse.js';
import { OFFICIAL_CA } from '../server/agi1-prompt.js';

// Real pools from DexScreener (2026-09-24, /tokens/v1/robinhood/…), trimmed to the fields we use.
const pool = (symbol, address, priceUsd, liq, mcap, h24, extra = {}) => ({
  chainId: 'robinhood', dexId: 'uniswap', labels: ['v4'],
  baseToken: { address, name: symbol, symbol },
  quoteToken: { address: '0x0000000000000000000000000000000000000000', name: 'Ether', symbol: 'ETH' },
  priceUsd, priceChange: { h1: -2.89, h6: 14.81, h24 }, liquidity: { usd: liq }, fdv: mcap, marketCap: mcap,
  ...extra,
});
const AGI_POOL = pool('AGI', '0xFa31d04462746aAA24bC7E5626403E09E4B106ec', '0.002181', 148096.74, 2181107, 14.96);
const CLANKCAT_POOL = pool('CLANKCAT', '0x03E6a6881D0813bF6157ac4ee44D3Cc73d5465A3', '0.0001014', 31956.13, 101407, -2.58);
const REAL = [AGI_POOL, CLANKCAT_POOL];

test('reads the real DexScreener answer', () => {
  const s = pickStats(REAL);
  assert.deepEqual(s.AGI, { price: 0.002181, mcap: 2181107, fdv: 2181107, liq: 148096.74, h24: 14.96, vol24: null });
  assert.deepEqual(Object.keys(s), ['AGI'], 'the site follows $AGI only (2026-09-28: the Arena, with its coins, left the site)');
  assert.deepEqual(TOKENS.map((t) => t.symbol), ['AGI']);
  // any other coin is read the same way when asked for
  const cat = pickStats(REAL, [{ symbol: 'CLANKCAT', ca: '0x03e6a6881d0813bf6157ac4ee44d3cc73d5465a3' }]).CLANKCAT;
  assert.deepEqual([cat.price, cat.h24, cat.mcap], [0.0001014, -2.58, 101407]);
  assert.equal(pricesUrl(), `https://api.dexscreener.com/tokens/v1/robinhood/${TOKENS[0].ca}`);
});

test('uses the biggest Robinhood pool where the coin is the one being priced', () => {
  const small = { ...AGI_POOL, priceUsd: '0.001982', liquidity: { usd: 1021.37 } };
  const otherChain = { ...AGI_POOL, chainId: 'base', priceUsd: '9.99', liquidity: { usd: 9e9 } };
  // A pool where $AGI is the *quote* token: its price is the other coin's price, not $AGI's.
  const agiAsQuote = { ...CLANKCAT_POOL, quoteToken: AGI_POOL.baseToken, priceUsd: '5.55', liquidity: { usd: 8e9 },
    baseToken: { address: '0x1111111111111111111111111111111111111111', symbol: 'XYZ' } };
  const noPrice = { ...AGI_POOL, priceUsd: null, liquidity: { usd: 7e9 } };
  const s = pickStats({ pairs: [small, otherChain, agiAsQuote, noPrice, AGI_POOL] }); // the old {pairs} shape works too
  assert.equal(s.AGI.price, 0.002181);
  assert.equal(s.AGI.liq, 148096.74);
  assert.equal(CHAIN, 'robinhood');
});

test('missing or broken data never throws, and missing numbers stay empty', () => {
  assert.deepEqual(pickStats(null), {});
  assert.deepEqual(pickStats({ pairs: null, schemaVersion: '1.0.0' }), {}); // unknown coin
  assert.deepEqual(pickStats('<html>'), {});
  const bare = pickStats([{ ...AGI_POOL, marketCap: undefined, fdv: 2000000, liquidity: null, priceChange: null }]);
  assert.deepEqual(bare.AGI, { price: 0.002181, mcap: 2000000, fdv: 2000000, liq: null, h24: null, vol24: null });
  assert.equal(pickStats([{ ...AGI_POOL, priceUsd: 'abc' }]).AGI, undefined);
});

test('numbers are formatted for people', () => {
  assert.equal(fmtPrice(0.002181), '$0.002181');
  assert.equal(fmtPrice(0.0001927), '$0.0001927');
  assert.equal(fmtPrice(0.00009300), '$0.00009300');
  assert.equal(fmtPrice(1.234e-7), '$0.0000001234'); // never "1.234e-7"
  assert.equal(fmtPrice(0.0421), '$0.0421');
  assert.equal(fmtPrice(2.5), '$2.50');
  assert.equal(fmtPrice(1234.56), '$1,235');
  assert.equal(fmtPrice(null), '—');
  assert.equal(fmtCompact(2181107), '$2.18M');
  assert.equal(fmtCompact(148096.74), '$148K');
  assert.equal(fmtCompact(44015.88), '$44K');
  assert.equal(fmtCompact(950), '$950');
  assert.equal(fmtCompact(undefined), '—');
  assert.equal(fmtPct(14.96), '+14.96%');
  assert.equal(fmtPct(-40.42), '-40.42%');
  assert.equal(fmtPct(0), '+0.00%');
  assert.equal(fmtPct(NaN), '—');
  assert.equal(fmtCount(1000049000), '1.00B');
  assert.equal(fmtCount(null), '—');
});

test('total supply comes from the DexScreener numbers (fully diluted value ÷ price)', () => {
  const s = pickStats([{ ...AGI_POOL, volume: { h24: 1281961.43 } }]).AGI;
  assert.equal(s.vol24, 1281961.43);
  assert.ok(Math.abs(supplyFrom(s) - 1e9) / 1e9 < 0.001, String(supplyFrom(s)));
  assert.equal(supplyFrom({ price: 0.002, fdv: null }), null);
});

test('the $AGI contract address is the same everywhere', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ca = TOKENS[0].ca;
  assert.equal(TOKENS[0].symbol, 'AGI');
  assert.equal(ca, OFFICIAL_CA);
  assert.ok(html.includes(`href="https://clank.trade/coin/${ca}"`), 'the Buy button points at the official coin');
  assert.ok(html.includes(`data-ca>${ca}</code>`), 'the model card shows the official address');
  // (2026-09-30) the one other address: the burn address, only on the burn screen (burning $AGI for more messages)
  const burnScreen = html.match(/<dialog class="wdlg bdlg"[\s\S]*?<\/dialog>/)[0];
  const addresses = new Set(html.replace(burnScreen, '').match(/0x[0-9a-fA-F]{40}/g).map((a) => a.toLowerCase()));
  assert.deepEqual([...addresses], [ca], 'no other address appears on the page');
  assert.deepEqual([...new Set(burnScreen.match(/0x[0-9a-fA-F]{40}/g))], [BURN_ADDRESS], 'the burn screen: only the burn address');
});

test('the security policy lets the page reach DexScreener (and only its API)', () => {
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const csp = vercel.headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;
  const connect = csp.split(';').map((s) => s.trim()).find((s) => s.startsWith('connect-src')).split(/\s+/);
  assert.ok(connect.includes(new URL(pricesUrl()).origin));
  assert.ok(!connect.some((src) => src.includes('*')), 'no wildcards');
});
