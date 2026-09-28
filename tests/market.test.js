// Market moments (2026-09-25, the owner's request): AGI-1 is happy when $AGI's market cap reaches another $200K step (she says
// the market cap) and sad after a -20% day. Her words (src/chat/market-lines.js) and when she says them (src/chat/market.js).
// Feelings and the number only: never a prediction, never buy / sell / hold, always "not financial advice".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STEP, DUMP, REARM, MAX_MILESTONE, milestoneOf, usd, usdSpoken, milestoneLine, dumpLine, marketLineByKey } from '../src/chat/market-lines.js';
import { marketStep, startMarketWatch } from '../src/chat/market.js';
import { speakable } from '../src/chat/voice.js';

const ADVICE = /\b(buy|buying|sell|selling|sold|hold|holding|hodl|ape|aping|invest|investing|investment|profit|profits|gains?|returns?|moon|mooning|pump|pumping|dip|next stop|going up|will go|gonna go|soon|target|100x|1000x|lambo|rich|guaranteed|don't miss|last chance|hurry|panic|dca|entry)\b/i;
const EXPLICIT = /\b(sex|sexy|nude|naked|horny|kiss me|bed)\b/i;
const H = 3600_000;

// every market line: short, PG-13, no advice, "not financial advice", her lowercase texting, and her voice says the same words
function checkLine(line, what) {
  const { text, spoken } = line;
  assert.match(text, /not financial advice/, `${what}: not financial advice`);
  assert.ok(text.length <= 280, `${what}: short (${text.length})`);
  assert.doesNotMatch(text, ADVICE, `${what}: never advice, predictions or trading talk`);
  assert.doesNotMatch(text, EXPLICIT, `${what}: PG-13`);
  assert.doesNotMatch(text, /https?:|www\.|0x[0-9a-f]{6}/i, `${what}: no links or addresses`);
  assert.equal(text, text.toLowerCase().replace(/\$agi/g, '$AGI').replace(/\$(\d+(?:\.\d+)?)([kmb])/gi, (m, n, u) => `$${n}${u.toUpperCase()}`), `${what}: lowercase`);
  assert.doesNotMatch(spoken, /\$|\p{Extended_Pictographic}/u, `${what}: her voice gets no "$" or emojis`);
  assert.ok(spoken.length > 20 && spoken.length <= 300, `${what}: a short clip`);
}

test('market caps in her words: "$2M" to read, "2 million" to say', () => {
  assert.deepEqual([usd(2_000_000), usd(2_200_000), usd(400_000), usd(1_250_000_000), usd(1_000_000), usd(12_400_000)], ['$2M', '$2.2M', '$400K', '$1.25B', '$1M', '$12.4M']);
  assert.deepEqual([usdSpoken(2_000_000), usdSpoken(2_200_000), usdSpoken(400_000), usdSpoken(1_250_000_000)], ['2 million', '2.2 million', '400 thousand', '1.25 billion']);
  assert.equal(STEP, 200_000);
  assert.deepEqual([milestoneOf(1_950_383), milestoneOf(2_000_000), milestoneOf(199_999), milestoneOf(2_399_999.9)], [1_800_000, 2_000_000, 0, 2_200_000]);
});

test('a milestone line for every $200K step: happy, names the market cap, and her voice says the same', () => {
  const seen = new Set();
  for (let step = STEP; step <= 30_000_000; step += STEP) {
    const line = milestoneLine(step);
    assert.equal(line.key, `mcap-${step}`);
    assert.equal(line.step, step);
    assert.ok(line.text.includes(`${usd(step)} market cap`), `${step}: says the market cap (${line.text})`);
    assert.ok(line.spoken.includes(usdSpoken(step)), `${step}: says it out loud as words`);
    assert.equal(line.spoken, speakable(line.text.replace(usd(step), usdSpoken(step))), `${step}: the same words`);
    checkLine(line, step);
    seen.add(line.text.replace(usd(step), '{m}'));
  }
  assert.equal(seen.size, 3, 'three ways of saying it, taking turns');
  assert.notEqual(milestoneLine(2_000_000).text.replace('$2M', ''), milestoneLine(2_200_000).text.replace('$2.2M', ''), 'the next step sounds different');
  assert.ok(milestoneLine(MAX_MILESTONE));
  for (const bad of [0, -STEP, 100_000, 2_000_001, 2_100_000, 1.5 * STEP, MAX_MILESTONE + STEP, NaN, Infinity, '2000000', null, undefined, 2e21]) {
    assert.equal(milestoneLine(bad), null, String(bad));
  }
});

test('a sad line for a -20% day: kind, never about what anyone should do; the same for everyone that day', () => {
  const texts = new Set();
  for (let day = 0; day < 9; day++) {
    const line = dumpLine(day);
    assert.equal(line.key, `dump-${day % 3}`);
    assert.match(line.text, /20%/);
    assert.match(line.text, /🥺/);
    assert.equal(line.spoken, speakable(line.text));
    checkLine(line, `dump ${day}`);
    texts.add(line.text);
  }
  assert.equal(texts.size, 3);
  assert.equal(dumpLine(-1).key, 'dump-2', 'any number works');
  assert.equal(dumpLine(4.7).key, 'dump-1');
  assert.match(dumpLine().key, /^dump-[0-2]$/, 'today by default');
});

test('the server knows a market line only by its exact address', () => {
  assert.deepEqual(marketLineByKey('mcap-2000000'), milestoneLine(2_000_000));
  assert.deepEqual(marketLineByKey('mcap-200000'), milestoneLine(200_000));
  assert.deepEqual(marketLineByKey('dump-0'), dumpLine(0));
  assert.deepEqual(marketLineByKey('dump-2'), dumpLine(2));
  for (const bad of ['mcap-2000001', 'mcap-0200000', 'mcap-100000', 'mcap-02000000', 'mcap-2e6', 'mcap-', 'mcap-99999999999', 'mcap-10000200000',
    'mcap-2000000 ', ' mcap-2000000', 'MCAP-2000000', 'dump-3', 'dump-10', 'dump-', 'dump--1', 'hello', 'more-1', '', null, undefined, '__proto__']) {
    assert.equal(marketLineByKey(bad), null, String(bad));
  }
});

test('first look: she only notes where the market cap is (nothing to say yet)', () => {
  let r = marketStep(null, { mcap: 1_950_383, h24: -13.86, now: 0 });   // (the real numbers on 2026-09-25)
  assert.equal(r.moment, null);
  assert.equal(r.state.top, 1_800_000);
  assert.equal(r.state.sadArmed, true, 'not a -20% day yet');
  r = marketStep(r.state, { mcap: 1_700_000, h24: -20.5, now: H });
  assert.equal(r.moment?.kind, 'dump', 'so if it gets there during the visit, she is sad');
});

test('first look in the middle of a bad day: no sad moment until it has been back above -10%', () => {
  let r = marketStep(undefined, { mcap: 1_500_000, h24: -24, now: 0 });
  assert.equal(r.moment, null);
  assert.equal(r.state.sadArmed, false);
  r = marketStep(r.state, { mcap: 1_500_000, h24: -26, now: H });
  assert.equal(r.moment, null, 'she was not there for the start of it');
  r = marketStep(r.state, { mcap: 1_500_000, h24: -8, now: 2 * H });
  r = marketStep(r.state, { mcap: 1_500_000, h24: -21, now: 3 * H });
  assert.equal(r.moment?.kind, 'dump', 'a new bad day counts');
});

test('a new $200K step: one happy moment with the new market cap, even after a jump of several steps', () => {
  let r = marketStep(null, { mcap: 1_950_000, h24: 5, now: 0 });
  r = marketStep(r.state, { mcap: 1_999_999, h24: 5, now: 1 });
  assert.equal(r.moment, null, 'not there yet');
  r = marketStep(r.state, { mcap: 2_030_000, h24: 7, now: 2 });
  assert.deepEqual({ ...r.moment, line: r.moment.line.key }, { kind: 'milestone', step: 2_000_000, mcap: 2_030_000, h24: 7, line: 'mcap-2000000' });
  assert.equal(r.state.top, 2_000_000);
  r = marketStep(r.state, { mcap: 2_150_000, h24: 7, now: 3 });
  assert.equal(r.moment, null, 'once per step');
  r = marketStep(r.state, { mcap: 2_680_000, h24: 30, now: 4 });
  assert.equal(r.moment.step, 2_600_000, 'a big jump: only the newest step');
  assert.equal(r.moment.line.text, milestoneLine(2_600_000).text);
});

test('a market cap wobbling around a step never makes her repeat herself; after a real drop, the next step up counts again', () => {
  let r = marketStep({ top: 2_000_000, sadAt: 0, sadArmed: true }, { mcap: 1_990_000, h24: 0, now: 0 });
  const moments = [];
  for (const mcap of [2_010_000, 1_990_000, 2_020_000, 1_850_000, 2_050_000, 1_810_000, 2_001_000]) {
    r = marketStep(r.state, { mcap, h24: 0, now: 1 });
    if (r.moment) moments.push(r.moment.step);
  }
  assert.deepEqual(moments, [], 'no step above $2M yet');
  r = marketStep(r.state, { mcap: 1_790_000, h24: 0, now: 2 });        // more than a full step below $2M
  assert.equal(r.state.top, 1_600_000);
  r = marketStep(r.state, { mcap: 1_830_000, h24: 0, now: 3 });
  assert.equal(r.moment?.step, 1_800_000, 'back up a step: happy again');
  r = marketStep(r.state, { mcap: 1_790_000, h24: 0, now: 4 });
  r = marketStep(r.state, { mcap: 1_830_000, h24: 0, now: 5 });
  assert.equal(r.moment, null, 'but not for every wobble');
});

test('the first $200K: from under $200K to over it', () => {
  let r = marketStep(null, { mcap: 150_000, h24: 0, now: 0 });
  assert.equal(r.state.top, 0);
  r = marketStep(r.state, { mcap: 199_000, h24: 0, now: 1 });
  assert.equal(r.moment, null);
  r = marketStep(r.state, { mcap: 204_000, h24: 0, now: 2 });
  assert.equal(r.moment?.line.key, 'mcap-200000');
});

test('a -20% day: sad once, then not again until it has been back above -10% and 12 hours have passed', () => {
  assert.deepEqual([DUMP, REARM], [-20, -10]);
  let r = marketStep(null, { mcap: 1_000_000, h24: -5, now: 0 });
  r = marketStep(r.state, { mcap: 1_000_000, h24: -19.9, now: H });
  assert.equal(r.moment, null, '-19.9% is not -20%');
  r = marketStep(r.state, { mcap: 1_000_000, h24: -20, now: 2 * H });
  assert.equal(r.moment?.kind, 'dump');
  assert.equal(r.moment.h24, -20);
  assert.equal(r.moment.line.key, dumpLine(Math.floor(2 * H / 864e5)).key);
  assert.deepEqual([r.state.sadAt, r.state.sadArmed], [2 * H, false]);
  for (const [h24, t] of [[-35, 3], [-15, 4], [-25, 5], [-10, 6], [-22, 7]]) {
    r = marketStep(r.state, { mcap: 1_000_000, h24, now: t * H });
    assert.equal(r.moment, null, `${h24}% at hour ${t}: already said (not back above -10% yet)`);
  }
  r = marketStep(r.state, { mcap: 1_000_000, h24: -9, now: 8 * H });
  assert.equal(r.state.sadArmed, true, 'back above -10%');
  r = marketStep(r.state, { mcap: 1_000_000, h24: -21, now: 9 * H });
  assert.equal(r.moment, null, 'but only 7 hours later: at most one sad moment every 12 hours');
  r = marketStep(r.state, { mcap: 1_000_000, h24: -21, now: 14.5 * H });
  assert.equal(r.moment?.kind, 'dump', '12 hours later: sad again');
});

test('no 24h change known → never sad; bad numbers → nothing happens and nothing is forgotten', () => {
  let r = marketStep(null, { mcap: 1_000_000, h24: null, now: 0 });
  r = marketStep(r.state, { mcap: 1_000_000, h24: undefined, now: 13 * H });
  assert.equal(r.moment, null);
  const before = { top: 1_000_000, sadAt: 5, sadArmed: true };
  for (const mcap of [0, -1, NaN, Infinity, null, undefined, '2000000']) {
    const bad = marketStep(before, { mcap, h24: -50, now: 13 * H });
    assert.deepEqual([bad.moment, bad.state], [null, before], String(mcap));
  }
  const junk = marketStep('garbage', { mcap: 1_000_000, h24: 0, now: 0 });
  assert.equal(junk.state.top, 1_000_000, 'unreadable memory = a first look');
});

// ---------- in the browser: startMarketWatch() listens to 'agi:prices' and remembers in this browser ----------
function fakeBrowser() {
  const listeners = [];
  const store = new Map();
  Object.defineProperty(globalThis, 'addEventListener', { value: (type, fn) => { if (type === 'agi:prices') listeners.push(fn); }, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'localStorage', {
    value: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    configurable: true, writable: true,
  });
  const prices = (mcap, h24 = 0, extra = {}) => {
    for (const fn of listeners) fn({ detail: { tokens: { AGI: { price: mcap / 1e9, mcap, h24 } }, updatedAt: Date.now(), failures: 0, ...extra } });
  };
  return { listeners, store, prices };
}

test('the page: nothing before the 18+ check, a silent first look, then one moment per step, remembered across tabs and visits', () => {
  const b = fakeBrowser();
  let ready = false;
  const got = [];
  startMarketWatch({ ready: () => ready, onMoment: (m) => got.push(m) });
  b.prices(1_950_000);
  assert.equal(b.store.size, 0, 'before the 18+ check nothing is noted');
  ready = true;
  b.prices(2_050_000, 0, { failures: 1 });
  b.prices(2_050_000, 0, { updatedAt: Date.now() - 5 * 60_000 });
  b.prices(2_050_000, 0, { tokens: {} });
  assert.equal(b.store.size, 0, 'failed, stale or missing numbers are ignored');
  b.prices(1_950_000);
  assert.equal(JSON.parse(b.store.get('agi_market')).top, 1_800_000, 'the first look is remembered');
  assert.equal(got.length, 0, '…and says nothing');
  startMarketWatch({ ready: () => true, onMoment: (m) => got.push({ ...m, tab: 2 }) });   // a second tab
  b.prices(2_010_000);
  assert.equal(got.length, 1, 'one moment, even with two tabs open');
  assert.equal(got[0].line.key, 'mcap-2000000');
  b.prices(2_020_000);
  assert.equal(got.length, 1);
  b.store.set('agi_market', '{not json');
  b.prices(2_030_000);
  assert.equal(got.length, 1, 'broken memory = a new first look (silent)');
  assert.equal(JSON.parse(b.store.get('agi_market')).top, 2_000_000);
});
