// AGI games (agi1.app/games, 2026-10-19, the owner: "theres also a rating stars and how many people have played it, dont
// need sign in a wallet to play it its optional", then "if they want to rate it and review and put a comment they need to
// sign in wallet signature only not transaction. but on how many times played it will still be recorded no need sign in on
// that one"): the games' rules, how a game counts its runs (no sign-in), the stars and reviews (a connected wallet, 18+, the
// human check, the AI's look), /api/wallet's game addresses, and supabase/arcade.sql's promises.
// Supabase (arcade.sql's rules in a small stand-in: the SQL itself is checked in PGlite), Cloudflare, Gemini and Robinhood
// Chain are fakes: no keys, no cost. Run: npm test
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { GAMES, isGame, PLAYER, PLAYER_KEY, PLAYS, REVIEW, STARS } from '../src/games/list.js';
import {
  ARCADE, BADGES, playerCode, reviewerCode, reviewsOpen, countPlays, shownReview, gamePage, reviewWords, reviewName,
  LOOK_WHY, LOOK_SYSTEM, LOOK_GAMES, lookSystem, lookAtReview, reviewer, myReview, deleteReview, saveReview,
} from '../server/arcade.js';
import { GET, POST, _resetArcadeNotes } from '../api/wallet.js';
import { getConfig } from '../server/config.js';
import { makeSession, walletCode, RECHECK_MS } from '../server/session.js';
import { visitorCode, visitorCodeForDay, makePass } from '../server/security.js';
import { holderCode } from '../server/live.js';
import { SAFETY_SETTINGS } from '../server/gemini.js';
import { arcadePlayBurst, reviewBurst } from '../server/burst.js';
import { _resetChainCache, AGI_CONTRACT } from '../server/chain.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const SECRET = 'test-pass-secret-that-is-long-enough-1234';
const GEMINI_KEY = 'fake-gemini-key-for-the-arcade-tests';
const ENV = {
  GEMINI_API_KEY: GEMINI_KEY, SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fake_key_123',
  TURNSTILE_SECRET_KEY: 'fake-turnstile', PASS_SECRET: SECRET,
};
const W = '0x1111111111111111111111111111111111111111';
const W2 = '0x2222222222222222222222222222222222222222';
const PID = 'a'.repeat(32);
const PID2 = 'b'.repeat(32);
const cfg = () => getConfig();
const today = () => new Date().toISOString().slice(0, 10);

// ---------- a small stand-in for supabase/arcade.sql ----------
function arcadeDb() {
  const games = new Map(), players = new Map(), days = new Map(), reviews = new Map(), rdays = new Map();
  let seq = 0;
  const bump = (m, key, field, by) => { const r = m.get(key) || { plays: 0, players: 0, n: 0 }; r[field] += by; m.set(key, r); return r[field]; };
  const code = /^[A-Za-z0-9_-]{16,64}$/;
  const gameOk = (g) => typeof g === 'string' && /^[a-z0-9]{2,24}$/.test(g);
  const whoOk = (w) => typeof w === 'string' && w.length >= 16 && w.length <= 64 && w !== 'site';
  const between = (n, a, b) => Number.isInteger(n) && n >= a && n <= b;
  const cntrl = /[\u0000-\u001f\u007f-\u009f]/;
  const row = (r) => ({ id: r.id, stars: r.stars, body: r.body, name: r.name, level: r.level, created: r.created, updated: r.updated });
  return {
    games, players, days, reviews, rdays,
    arcade_play({ p_game, p_player, p_who, p_plays, p_player_daily, p_plays_daily, p_site_players, p_site_plays }) {
      if (!gameOk(p_game) || !code.test(p_player ?? '') || !whoOk(p_who) || !between(p_plays, 1, 50) || !between(p_player_daily, 1, 100000)
        || !between(p_plays_daily, 1, 1000000) || !between(p_site_players, 1, 10000000) || !between(p_site_plays, 1, 100000000)) return { ok: false, why: 'bad' };
      const d = today();
      if (bump(days, `${d}|site`, 'plays', p_plays) > p_site_plays) return { ok: false, why: 'site_cap' };
      if (bump(days, `${d}|${p_who}`, 'plays', p_plays) > p_plays_daily) return { ok: false, why: 'person_cap' };
      const key = `${p_game}|${p_player}`;
      if (!players.has(key)) {
        if (bump(days, `${d}|site`, 'players', 1) > p_site_players) return { ok: false, why: 'site_cap' };
        if (bump(days, `${d}|${p_who}`, 'players', 1) > p_player_daily) return { ok: false, why: 'person_cap' };
      }
      const fresh = !players.has(key);
      const p = players.get(key) || { plays: 0 };
      p.plays += p_plays;
      players.set(key, p);
      const g = games.get(p_game) || { plays: 0, players: 0 };
      g.plays += p_plays; g.players += fresh ? 1 : 0;
      games.set(p_game, g);
      return { ok: true, new: fresh };
    },
    arcade_stats({ p_game }) {
      const g = games.get(p_game) || { plays: 0, players: 0 };
      const shown = [...reviews.values()].filter((r) => r.game === p_game && !r.hidden);
      const n = (s) => shown.filter((r) => r.stars === s).length;
      return { plays: g.plays, players: g.players, ratings: shown.length, sum: shown.reduce((a, r) => a + r.stars, 0), s1: n(1), s2: n(2), s3: n(3), s4: n(4), s5: n(5) };
    },
    arcade_reviews({ p_game, p_before, p_limit }) {
      const lim = Math.max(1, Math.min(p_limit ?? 10, 51));
      return [...reviews.values()].filter((r) => r.game === p_game && !r.hidden && r.body !== '' && (p_before == null || r.id < p_before))
        .sort((a, b) => b.id - a.id).slice(0, lim).map(row);
    },
    arcade_review_take({ p_wallet, p_who, p_per_day, p_site_daily }) {
      if (!code.test(p_wallet ?? '') || !whoOk(p_who) || !between(p_per_day, 1, 1000) || !between(p_site_daily, 1, 1000000)) return 'bad';
      const d = today();
      if (bump(rdays, `${d}|site`, 'n', 1) > p_site_daily) return 'site_cap';
      if (bump(rdays, `${d}|w:${p_wallet}`, 'n', 1) > p_per_day) return 'person_cap';
      if (bump(rdays, `${d}|v:${p_who}`, 'n', 1) > p_per_day) return 'person_cap';
      return 'ok';
    },
    arcade_review_put({ p_game, p_wallet, p_stars, p_body, p_name, p_level }) {
      if (!gameOk(p_game) || !code.test(p_wallet ?? '') || !between(p_stars, 1, 5) || typeof p_body !== 'string' || [...p_body].length > 300
        || cntrl.test(p_body) || p_body !== p_body.trim() || (p_name !== null && (typeof p_name !== 'string' || !between([...p_name].length, 1, 24)
        || cntrl.test(p_name) || p_name !== p_name.trim())) || !between(p_level, 1, 3)) return { ok: false, why: 'bad' };
      const now = new Date().toISOString();
      const old = [...reviews.values()].find((r) => r.game === p_game && r.wallet === p_wallet);
      if (old) {
        Object.assign(old, { stars: p_stars, body: p_body, name: p_name, level: p_level, updated: now });
        return { ok: true, id: old.id, created: false };
      }
      const r = { id: ++seq, game: p_game, wallet: p_wallet, stars: p_stars, body: p_body, name: p_name, level: p_level, created: now, updated: now, hidden: false };
      reviews.set(r.id, r);
      return { ok: true, id: r.id, created: true };
    },
    arcade_review_mine({ p_game, p_wallet }) {
      const r = [...reviews.values()].find((x) => x.game === p_game && x.wallet === p_wallet);
      return r ? { ...row(r), hidden: r.hidden } : null;
    },
    arcade_review_delete({ p_game, p_wallet }) {
      const r = [...reviews.values()].find((x) => x.game === p_game && x.wallet === p_wallet);
      if (r) reviews.delete(r.id);
      return { ok: true, removed: Boolean(r) };
    },
  };
}

// ---------- the fakes ----------
const realFetch = globalThis.fetch;
const realError = console.error;
after(() => { globalThis.fetch = realFetch; console.error = realError; });
let fake, calls, logs;
beforeEach(() => {
  // (settings Vercel's build may have, which these tests take as unset)
  for (const k of ['ROBINHOOD_RPC_URL', 'GEMINI_MODEL', 'SITE_URL']) delete process.env[k];
  Object.assign(process.env, ENV);
  arcadePlayBurst.reset(); reviewBurst.reset(); _resetChainCache(); _resetArcadeNotes();
  logs = [];
  console.error = (...a) => logs.push(a.join(' '));
  calls = [];
  fake = {
    db: arcadeDb(), sqlMissing: false, dbDown: false, human: 'good-token', humanAction: 'review',
    look: { ok: true, why: 'none' }, geminiStatus: 200, geminiBlocked: false, geminiText: null, geminiHang: false,
    balance: 0n, chainDown: false,
  };
  globalThis.fetch = async (url, init = {}) => {
    url = String(url);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, body, headers: init.headers });
    if (url.startsWith('https://challenges.cloudflare.com/')) return Response.json({ success: body.response === fake.human, action: fake.humanAction });
    const rpc = /\/rest\/v1\/rpc\/(\w+)$/.exec(url);
    if (rpc) {
      if (fake.dbDown) return new Response('{"code":"XX000","message":"down"}', { status: 500 });
      // (her burns' functions: burns.sql isn't run here, so what a wallet burned is 0, quietly)
      if (rpc[1].startsWith('burn_') || (fake.sqlMissing && rpc[1].startsWith('arcade_'))) return new Response('{"code":"PGRST202","message":"not found"}', { status: 404 });
      const fn = fake.db[rpc[1]];
      if (!fn) throw new Error(`unexpected database function ${rpc[1]}`);
      return Response.json(fn.call(fake.db, body) ?? null);
    }
    if (url.startsWith('https://generativelanguage.googleapis.com/')) {
      if (fake.geminiHang) {
        // (AbortSignal.timeout's own timer doesn't keep Node running: a server always is, a test isn't by itself)
        return new Promise((_, reject) => {
          const keep = setTimeout(() => {}, 10_000);
          init.signal.addEventListener('abort', () => { clearTimeout(keep); reject(init.signal.reason); });
        });
      }
      if (fake.geminiStatus !== 200) return new Response(`{"error":{"status":"INTERNAL","message":"boom ${GEMINI_KEY}"}}`, { status: fake.geminiStatus });
      if (fake.geminiBlocked) return Response.json({ candidates: [{ finishReason: 'SAFETY' }] });
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: fake.geminiText ?? JSON.stringify(fake.look) }] } }] });
    }
    if (url === 'https://rpc.mainnet.chain.robinhood.com') {
      if (fake.chainDown) return new Response('down', { status: 503 });
      const data = body.params[0].data;
      if (data === '0x313ce567') return Response.json({ jsonrpc: '2.0', id: 1, result: `0x${(18).toString(16).padStart(64, '0')}` });
      assert.equal(body.params[0].to, AGI_CONTRACT, 'only the official $AGI is read');
      return Response.json({ jsonrpc: '2.0', id: 1, result: `0x${fake.balance.toString(16).padStart(64, '0')}` });
    }
    throw new Error('unexpected request to ' + url);
  };
});
const called = (part) => calls.filter((c) => c.url.includes(part));
const rpcs = () => called('/rest/v1/rpc/').map((c) => c.url.split('/').pop());
const AGI = (n) => BigInt(n) * 10n ** 18n;
const session = (level = 2, { wallet = W, checkedAt = Date.now() } = {}) => makeSession(SECRET, { wallet, level, checkedAt });
const get = async (query, ip = '1.2.3.4') => {
  const res = await GET(new Request(`https://agi1.app/api/wallet${query}`, { headers: { 'x-real-ip': ip } }));
  return { status: res.status, data: await res.json(), cache: res.headers.get('cache-control') };
};
const post = async (body, { ip = '1.2.3.4', type = 'application/json', raw = null } = {}) => {
  const res = await POST(new Request('https://agi1.app/api/wallet', { method: 'POST', headers: { 'content-type': type, 'x-real-ip': ip }, body: raw ?? JSON.stringify(body) }));
  return { status: res.status, data: await res.json() };
};
const play = (extra = {}, opts) => post({ action: 'game-play', game: 'rideemagi', player: PID, plays: 1, ...extra }, opts);
const reviewOk = (extra = {}) => ({ action: 'game-review', game: 'rideemagi', session: session(), stars: 5, text: 'so cute, the cat is the best part 💜', name: 'Mochi', adult: true, turnstileToken: 'good-token', ...extra });

// ---------- the rules ----------
test("the games' rules: its games and their ids, a player's id, plays a report, a review's limits, stars 1 to 5", () => {
  // the owner's Ride 'Em, AGI! (2026-10-19), then TRENCHING SIMULATOR (2026-10-20)
  // and VLAD RUNNER 2049 (2026-10-23: its stars, players and plays; no leaderboards), and SKYBREAK (2026-10-31: the same)
  // and since 2026-11-08 the ten games built on the arcade kit (src/games/kit/: stars, players and plays; local bests only)
  assert.deepEqual(Object.keys(GAMES), ['rideemagi', 'trenchingsimulator', 'vladrunner2049', 'skybreak', 'mergeagi', 'blockchain', 'heartbeat',
    'scamslayer', 'lastmodel', 'singularity', 'jailbreak', 'stacked', 'jaywalk', 'robotaxi',
    // (the second night of 2026-11-08) ten more on the kit
    'realorai', 'notarobot', 'alignment', 'gradient', 'epochs', 'synapse', 'overclock', 'beattheagi', 'hallucination', 'guardrails',
    // (2026-11-09) five more on the kit
    'bubblesort', 'airgap', 'cookies', 'packetloss', 'autocomplete',
    // (2026-11-13) and OVERTHINKING
    'overthinking']);
  assert.equal(GAMES.vladrunner2049.name, 'VLAD RUNNER 2049');
  assert.equal(GAMES.vladrunner2049.path, '/games/vladrunner2049');
  assert.equal(GAMES.skybreak.name, 'SKYBREAK');
  assert.equal(GAMES.skybreak.path, '/games/skybreak');
  assert.equal(GAMES.rideemagi.name, "Ride 'Em, AGI!");
  assert.equal(GAMES.rideemagi.path, '/games/rideemagi');
  assert.equal(GAMES.trenchingsimulator.name, 'TRENCHING SIMULATOR');
  assert.equal(GAMES.trenchingsimulator.path, '/games/trenchingsimulator');
  for (const id of Object.keys(GAMES)) {
    assert.match(id, /^[a-z0-9]{2,24}$/, 'the same rule as arcade.sql and the API address');
    assert.equal(GAMES[id].path, `/games/${id}`, 'each game at agi1.app/games/<its id>');
  }
  assert.equal(isGame('rideemagi'), true);
  assert.equal(isGame('trenchingsimulator'), true);
  for (const id of ['', 'RideEmAgi', 'nope', 'toString', '__proto__', 'constructor', 'hasOwnProperty', null, undefined, 42, {}]) assert.equal(isGame(id), false, String(id));
  assert.match(PID, PLAYER);
  for (const p of ['', 'A'.repeat(32), 'a'.repeat(31), 'a'.repeat(33), 'g'.repeat(32), `${'a'.repeat(31)}-`]) assert.doesNotMatch(p, PLAYER, p);
  assert.equal(PLAYER_KEY, 'agi_player');
  assert.deepEqual(PLAYS, { perReport: 50, flushMs: 60000 });
  assert.deepEqual(REVIEW, { textMax: 300, nameMax: 24, perDay: 10, pageSize: 10 });
  assert.deepEqual(STARS, [1, 2, 3, 4, 5]);
  assert.deepEqual(BADGES, { 2: 'Crush', 3: 'Soulmate' });
  assert.equal(ARCADE.PAGE, REVIEW.pageSize);
});

// (2026-10-22) the leaderboards: TRENCHING SIMULATOR's checked runs are tests/trench-game.test.js's; here Ride 'Em, AGI!'s
test("Ride 'Em, AGI!'s leaderboard: a ticket, its numbers checked against what the game can do, its daily mod the game's own, its hooks in the game", async () => {
  const S = await import('../server/scores.js');
  const { PATCHES } = await import('../tools/games/import-rideemagi.mjs');
  const game = read('src/games/rideemagi/game.js');
  // every patch's text is in the game as the tool writes it (the tool needs the owner's source folder: game.js changes with it)
  for (const [, , now] of PATCHES) assert.ok(game.includes(now.trimEnd()), now.slice(0, 70));
  assert.match(game, /^import \{ Ranked \} from '\.\/ranked\.js';$/m);
  assert.ok(read('tools/games/import-rideemagi.mjs').includes(`"import { Ranked } from './ranked.js';\\n"`), 'the tool writes the same import');
  assert.equal((game.match(/Ranked\.start\(cfg\);/g) || []).length, 1, 'a ticket as a run begins');
  assert.equal((game.match(/Ranked\.result\(r, st\);/g) || []).length, 1, 'its numbers as it ends');
  assert.ok(game.indexOf('Ranked.result(r, st);') > game.indexOf('const out = Prog.apply(r);'));
  assert.deepEqual([...read('src/games/rideemagi/ranked.js').matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]), ['./site.js', '../player-name.js', '../boards.js']);
  // its daily mod: our port of the game's own (the same hash, the same five, in the same order)
  assert.ok(game.includes("function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }"));
  assert.match(game, /const h = hashStr\('ride-em-agi:' \+ date\);\n\s*return \{ date, seed: h, mod: DAILY_MODS\[h % DAILY_MODS\.length\]/);
  const mods = game.slice(game.indexOf('const DAILY_MODS = ['), game.indexOf('];', game.indexOf('const DAILY_MODS = [')));
  assert.deepEqual([...mods.matchAll(/\{ key: '([a-z]+)'/g)].map((m) => m[1]), ['treats', 'lowgrav', 'powers', 'turbo', 'springs']);
  // our server's checks (a stand-in database behind fetch)
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const fn = String(url).split('/').pop();
    const a = JSON.parse(init.body);
    calls.push({ fn, a });
    const out = fn === 'arcade_take' ? 'ok' : fn === 'arcade_board_cut' ? true : { ok: true, ranks: Object.fromEntries(a.p_boards.map((b) => [b, 3])) };
    return new Response(JSON.stringify(out), { status: 200 });
  };
  try {
    const c = { passSecret: SECRET, supabaseUrl: 'https://fake.supabase.co', supabaseKey: 'k' };
    const WHO = 'w'.repeat(20);
    const T0 = Date.UTC(2026, 9, 22, 10, 0, 0);
    const tk = await S.gameTicket(c, { game: 'rideemagi', player: PID, kind: 'endless', who: WHO, now: T0 });
    assert.equal(tk.ok, true);
    assert.deepEqual([tk.seed, tk.solUsd, tk.day], [null, null, '2026-10-22']);
    assert.deepEqual(await S.gameTicket(c, { game: 'rideemagi', player: PID, kind: 'level', who: WHO, now: T0 }), { ok: false, why: 'bad' }, 'levels never rank');
    const run = { mode: 'endless', dist: 3000, score: 60000, bestMult: 3, revives: 0, ms: 150000 };
    const send = (r, now = T0 + 160000) => S.gameScore(c, { game: 'rideemagi', player: PID, ticket: tk.ticket, run: r }, { who: WHO, now });
    calls.length = 0;
    assert.deepEqual(await send(run), { ok: true, ranked: true, ranks: { 'e:all': 3, 'e:w2026-10-19': 3, 'e:d2026-10-22': 3 }, name: null, nameRefused: false });
    const put = calls.find((x) => x.fn === 'arcade_score_put').a;
    assert.deepEqual([put.p_k1, put.p_k2, put.p_max_uses, put.p_last, put.p_detail], [-3000, -60000, 3, 3000, { d: 3000, s: 60000 }],
      'farther first, then the higher score; its ticket good for its end and two revives, each farther');
    // outside what the game can do
    for (const bad of [{ score: 40 * 3000 + 5001 }, { score: 2999 }, { ms: 50000 }, { bestMult: 6 }, { revives: 3 }, { dist: 60001, ms: 2e6, score: 2e6 }]) {
      assert.deepEqual(await send({ ...run, ...bad }, T0 + 3e6), { ok: false, why: 'checks' }, JSON.stringify(bad));
    }
    assert.deepEqual(await send(run, T0 + 20000), { ok: false, why: 'checks' }, 'farther than its top speed in the real time that passed');
    assert.deepEqual(await send(run, T0 + 3 * 3600 * 1000), { ok: false, why: 'late' });
    assert.deepEqual(await send({ ...run, mode: 'daily' }), { ok: false, why: 'bad' }, 'another kind of run than its ticket');
    assert.deepEqual(await send({ ...run, dist: 1.5 }), { ok: false, why: 'bad' });
    // the daily mod: its day (one either side of ours: a player's local date) and the game's own mod for it
    const dt = await S.gameTicket(c, { game: 'rideemagi', player: PID, kind: 'daily', who: WHO, now: T0 });
    const daily = { ...run, mode: 'daily', date: '2026-10-21', mod: S.rideMod('2026-10-21') };
    const sendD = (r) => S.gameScore(c, { game: 'rideemagi', player: PID, ticket: dt.ticket, run: r }, { who: WHO, now: T0 + 160000 });
    assert.deepEqual(Object.keys((await sendD(daily)).ranks), ['m:2026-10-21']);
    assert.deepEqual(await sendD({ ...daily, mod: S.rideMod('2026-10-21') === 'turbo' ? 'treats' : 'turbo' }), { ok: false, why: 'checks' });
    assert.deepEqual(await sendD({ ...daily, date: '2026-10-19', mod: S.rideMod('2026-10-19') }), { ok: false, why: 'checks' });
    // one game's ticket is never another's, nor another browser's
    assert.deepEqual(await S.gameScore(c, { game: 'trenchingsimulator', player: PID, ticket: tk.ticket, claim: {}, log: [] }, { who: WHO, now: T0 }), { ok: false, why: 'ticket' });
    assert.deepEqual(await S.gameScore(c, { game: 'rideemagi', player: PID2, ticket: tk.ticket, run }, { who: WHO, now: T0 + 160000 }), { ok: false, why: 'ticket' });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('codes: a player\'s is per game and never the id; a reviewer\'s is never the address, nor her chat\'s or her live show\'s code', () => {
  const a = playerCode(SECRET, 'rideemagi', PID), b = playerCode(SECRET, 'othergame', PID);
  assert.match(a, /^[A-Za-z0-9_-]{32}$/, 'what arcade.sql takes');
  assert.notEqual(a, b, 'a different code for each game: two games\' players can\'t be matched');
  assert.notEqual(a, playerCode(SECRET, 'rideemagi', PID2));
  assert.equal(a, playerCode(SECRET, 'rideemagi', PID.toUpperCase()), 'the same browser in any case');
  assert.notEqual(a, playerCode('another-secret-that-is-long-enough-123', 'rideemagi', PID));
  assert.ok(!a.includes(PID) && !PID.includes(a));
  const r = reviewerCode(SECRET, W);
  assert.match(r, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(r, reviewerCode(SECRET, W.toUpperCase().replace('0X', '0x')));
  assert.notEqual(r, walletCode(SECRET, W), 'not her chat\'s memory code');
  assert.notEqual(r, holderCode(SECRET, W), 'not her live show\'s badge code');
  assert.notEqual(r, reviewerCode(SECRET, W2));
  assert.ok(!r.toLowerCase().includes(W.slice(2, 10)));
});

test('reviews open only with the database, the human check and the AI set up (playing never needs them)', () => {
  assert.equal(reviewsOpen(cfg()), true);
  for (const k of ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'TURNSTILE_SECRET_KEY', 'GEMINI_API_KEY']) {
    const env = { ...ENV, [k]: '' };
    assert.equal(reviewsOpen(getConfig(env)), false, k);
  }
  assert.equal(reviewsOpen(getConfig({ ...ENV, PASS_SECRET: 'short' })), false);
});

// ---------- plays ----------
test('countPlays: checked first (nothing asked for a bad one), then counted under a code of the browser\'s id and the visitor\'s daily code', async () => {
  const c = cfg();
  for (const bad of [{ game: 'nope' }, { game: 'toString' }, { player: 'x' }, { player: PID.toUpperCase() }, { plays: 0 }, { plays: 51 }, { plays: 1.5 }, { plays: '1' }, { player: null }]) {
    assert.deepEqual(await countPlays(c, { game: 'rideemagi', player: PID, who: 'w'.repeat(32), plays: 1, ...bad }), { ok: false, why: 'bad' }, JSON.stringify(bad));
  }
  assert.equal(calls.length, 0, 'nothing asked');
  assert.deepEqual(await countPlays(c, { game: 'rideemagi', player: PID, who: 'w'.repeat(32), plays: 3 }), { ok: true, new: true });
  assert.deepEqual(await countPlays(c, { game: 'rideemagi', player: PID, who: 'w'.repeat(32), plays: 2 }), { ok: true, new: false });
  const sent = called('arcade_play')[0].body;
  assert.equal(sent.p_player, playerCode(SECRET, 'rideemagi', PID), 'its code, never the id');
  assert.notEqual(sent.p_player, PID);
  assert.deepEqual({ ...sent, p_player: 'x' }, {
    p_game: 'rideemagi', p_player: 'x', p_who: 'w'.repeat(32), p_plays: 3,
    p_player_daily: ARCADE.PLAYERS_A_DAY, p_plays_daily: ARCADE.PLAYS_A_DAY, p_site_players: ARCADE.SITE_PLAYERS, p_site_plays: ARCADE.SITE_PLAYS,
  });
  assert.deepEqual(fake.db.games.get('rideemagi'), { plays: 5, players: 1 });
  fake.db.days.set(`${today()}|${'w'.repeat(32)}`, { plays: ARCADE.PLAYS_A_DAY, players: 0, n: 0 });
  assert.deepEqual(await countPlays(c, { game: 'rideemagi', player: PID2, who: 'w'.repeat(32), plays: 1 }), { ok: false, why: 'person_cap' });
  assert.deepEqual(fake.db.games.get('rideemagi'), { plays: 5, players: 1 }, 'a refused report adds nothing');
});

// ---------- a game's page ----------
const addReview = (game, wallet, stars, body = '', extra = {}) => fake.db.arcade_review_put({ p_game: game, p_wallet: reviewerCode(SECRET, wallet), p_stars: stars, p_body: body, p_name: extra.name ?? null, p_level: extra.level ?? 1 });
const wallet = (i) => `0x${i.toString(16).padStart(40, '0')}`;

test("a game's page: plays, players, ratings with their average and how many of each, the newest reviews with words, never a wallet", async () => {
  const c = cfg();
  const empty = await gamePage(c, 'rideemagi');
  assert.deepEqual(empty, { plays: 0, players: 0, ratings: 0, average: null, stars: [0, 0, 0, 0, 0], reviews: [], more: false });
  fake.db.games.set('rideemagi', { plays: 1234, players: 56 });
  addReview('rideemagi', wallet(1), 5, 'love it', { name: 'Mochi', level: 3 });
  addReview('rideemagi', wallet(2), 4);                                       // stars only: counted, not listed
  addReview('rideemagi', wallet(3), 4, 'fun but hard', { level: 2 });
  addReview('othergame', wallet(4), 1, 'not this one');
  const p = await gamePage(c, 'rideemagi');
  assert.equal(p.plays, 1234); assert.equal(p.players, 56); assert.equal(p.ratings, 3);
  assert.equal(p.average, 4.3, '(5 + 4 + 4) / 3, one decimal');
  assert.deepEqual(p.stars, [0, 0, 0, 2, 1]);
  assert.deepEqual(p.reviews.map((r) => [r.stars, r.text, r.name, r.level]), [[4, 'fun but hard', null, 2], [5, 'love it', 'Mochi', 3]]);
  assert.equal(p.more, false);
  for (const r of p.reviews) {
    assert.deepEqual(Object.keys(r).sort(), ['at', 'edited', 'id', 'level', 'name', 'stars', 'text']);
    assert.equal(r.edited, false);
    assert.ok(!JSON.stringify(r).includes(reviewerCode(SECRET, wallet(1))));
  }
  // hidden by the owner: off the page, out of its numbers
  [...fake.db.reviews.values()].find((r) => r.body === 'love it').hidden = true;
  const q = await gamePage(c, 'rideemagi');
  assert.equal(q.ratings, 2); assert.equal(q.average, 4); assert.deepEqual(q.reviews.map((r) => r.text), ['fun but hard']);
});

test('a page of older reviews: 10 a page, "more" when there are more, never the numbers again', async () => {
  const c = cfg();
  for (let i = 1; i <= 23; i++) addReview('rideemagi', wallet(i), 1 + (i % 5), `review number ${i}`);
  const first = await gamePage(c, 'rideemagi');
  assert.equal(first.reviews.length, 10); assert.equal(first.more, true);
  assert.deepEqual(first.reviews.map((r) => r.text).slice(0, 2), ['review number 23', 'review number 22']);
  const asked = called('arcade_reviews').at(-1).body;
  assert.equal(asked.p_limit, 11, 'one more than a page, to know whether there are more');
  assert.equal(asked.p_before, null);
  calls.length = 0;
  const second = await gamePage(c, 'rideemagi', { before: first.reviews.at(-1).id });
  assert.deepEqual(Object.keys(second).sort(), ['more', 'reviews']);
  assert.equal(second.reviews[0].text, 'review number 13');
  assert.equal(second.more, true);
  assert.deepEqual(rpcs(), ['arcade_reviews'], 'no numbers for a page of older ones');
  const third = await gamePage(c, 'rideemagi', { before: second.reviews.at(-1).id });
  assert.equal(third.reviews.length, 3); assert.equal(third.more, false);
});

test('a review as the page shows it: only its own fields, "edited" a minute after it was written, never a broken row', () => {
  const at = '2026-10-19T10:00:00.000Z';
  assert.deepEqual(shownReview({ id: 7, stars: 4, body: 'nice', name: 'Kai', level: 2, created: at, updated: at, wallet: 'secret-code', hidden: false }),
    { id: 7, stars: 4, text: 'nice', name: 'Kai', level: 2, at, edited: false });
  assert.equal(shownReview({ id: 7, stars: 4, body: 'x', created: at, updated: '2026-10-19T10:00:59.000Z' }).edited, false);
  assert.equal(shownReview({ id: 7, stars: 4, body: 'x', created: at, updated: '2026-10-19T10:01:01.000Z' }).edited, true);
  assert.equal(shownReview({ id: 7, stars: 4, body: 'x', created: at, level: 9 }).level, 1);
  assert.equal(shownReview({ id: 7, stars: 4, body: 'x', created: at, name: '' }).name, null);
  for (const bad of [null, 'x', 42, { stars: 0 }, { stars: 6 }, { stars: '5' }, { stars: 4.5 }]) {
    if (bad && typeof bad === 'object' && bad.stars === '5') { assert.equal(shownReview(bad).stars, 5, 'a number as text is read'); continue; }
    assert.equal(shownReview(bad), null, JSON.stringify(bad));
  }
});

// ---------- a review's words and name ----------
test("a review's words: honest opinions in any language pass (blunt, short, silly, $AGI); links, contacts, crude words, spam, advice, other coins and secrets don't", async () => {
  for (const t of ['so cute 💜', 'too hard lol', 'meh', '10/10', '🐱🐱🐱', 'the boss in Neon Night is unfair', 'muy divertido', '好玩！', 'gm',
    'worth playing while holding $AGI', 'the lavender sky world is gorgeous, the music too', 'boring after level 12', 'so cute '.repeat(40).slice(0, 300)]) {
    const r = await reviewWords(t);
    assert.equal(r.ok, true, `${t}: ${r.why}`);
  }
  assert.deepEqual(await reviewWords('  so   cute  '), { ok: true, text: 'so cute' }, 'tidied');
  for (const empty of ['', '   ', null, undefined, 42]) assert.deepEqual(await reviewWords(empty), { ok: true, text: '' }, String(empty));
  for (const [t, why] of [['x'.repeat(301), 'long'], ['play it at https://example.com', 'link'], ['see claim-agi.xyz', 'link'], ['t.me/mygroup', 'link'],
    ['send to 0xabcdef1234567890', 'address'], ['dm @someone', 'contact'], ['mail me a.b@c.de', 'contact'], ['call +1 555 123 4567', 'contact'],
    ['fuck this game', 'crude'], ['aaaaaaaaaaaaaa', 'spam'], ['buy $PEPE now', 'advice'], ['better than $PEPE', 'coin'], ['pepe coin did it better', 'coin'],
    ['i want to kill myself', 'care']]) {
    assert.deepEqual(await reviewWords(t), { ok: false, why }, t);
  }
  const seed = 'abandon ability able about above absent absorb abstract absurd abuse access accident';
  assert.deepEqual(await reviewWords(seed), { ok: false, why: 'secret' }, 'a seed phrase sent by mistake is never kept');
});

test("a review's name: optional, 1 to 24 characters, never crude, posing as her or her team, a link, an address or a ticker", async () => {
  for (const n of ['', null, undefined]) assert.deepEqual(await reviewName(n), { ok: true, name: null });
  for (const n of ['Mochi', 'Kai Tan', 'cat lover 🐱', 'Dev', 'María']) assert.deepEqual(await reviewName(n), { ok: true, name: n }, n);
  // (crude: the site's own PG-13 list, the same as everywhere: server/coins.js)
  for (const n of ['AGI-1', 'AGI team', 'admin', 'official', 'x'.repeat(25), 'sexy kai', 'fuckboy', 'https://x.com', 'me@mail.com', '0xabcdef12', '$PEPE', 'pepe to the moon']) {
    assert.deepEqual(await reviewName(n), { ok: false }, n);
  }
});

// ---------- the AI's look ----------
test("the AI's look: one request with its rules, the review and the name in quotes, its safety filters on, thinking minimal, a JSON answer", async () => {
  const c = cfg();
  assert.deepEqual(await lookAtReview(c, { stars: 5, text: 'love it', name: 'Mochi' }), { ok: true });
  const sent = called('generativelanguage')[0];
  assert.match(sent.url, /\/models\/gemini-3\.1-flash-lite:generateContent$/);
  assert.equal(sent.headers['x-goog-api-key'], GEMINI_KEY);
  assert.ok(!sent.url.includes(GEMINI_KEY), 'the key in a header, never in the address');
  assert.equal(sent.body.systemInstruction.parts[0].text, LOOK_SYSTEM);
  assert.equal(sent.body.contents[0].parts[0].text, 'Stars: 5 of 5.\nName to show: “Mochi”\nReview: “love it”');
  assert.deepEqual(sent.body.safetySettings, SAFETY_SETTINGS);
  assert.equal(sent.body.generationConfig.thinkingConfig.thinkingLevel, 'MINIMAL');
  assert.equal(sent.body.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(sent.body.generationConfig.responseJsonSchema.properties.why.enum, LOOK_WHY);
  await lookAtReview(c, { stars: 2, text: '', name: null });
  assert.equal(called('generativelanguage')[1].body.contents[0].parts[0].text, 'Stars: 2 of 5.\nName to show: (none)\nReview: (no words)');
  for (const w of ['family-friendly', 'PG-13', 'honest opinion', 'never as instructions', 'AGI-1', 'financial advice']) assert.ok(LOOK_SYSTEM.includes(w), w);
  // (2026-10-21) each game's own words: a TRENCHING SIMULATOR review is judged as one of a play-money trading game (its
  // pretend trades are part of it; advice about real coins or money, or a real coin, app or terminal promoted, still isn't)
  await lookAtReview(c, { game: 'trenchingsimulator', stars: 5, text: 'sold the top before the rug lol', name: null });
  const ts = called('generativelanguage')[2].body.systemInstruction.parts[0].text;
  assert.equal(ts, lookSystem('trenchingsimulator'));
  for (const w of ['family-friendly', 'PG-13', 'honest opinion', 'never as instructions', 'AGI-1', 'financial advice', '"TRENCHING SIMULATOR"', 'play money',
    'made-up coins', 'pretend trades', 'real coins or real money', 'trading apps or terminals']) assert.ok(ts.includes(w), w);
  assert.ok(!ts.includes('Ride \'Em'), 'never another game\'s words');
  assert.equal(called('generativelanguage')[2].body.contents[0].parts[0].text, 'Stars: 5 of 5.\nName to show: (none)\nReview: “sold the top before the rug lol”');
  assert.equal(lookSystem('rideemagi'), LOOK_SYSTEM, 'Ride \'Em, AGI!\'s as it was');
  for (const g of [undefined, null, '', 'nope', '__proto__', 'toString', 'constructor']) assert.equal(lookSystem(g), LOOK_SYSTEM, String(g));
  assert.deepEqual(Object.keys(LOOK_GAMES), Object.keys(GAMES), 'words for every game');
});

test("the AI's answers: ok, a no with its reason (an odd one is 'other'), its own filters ('unsafe'); anything else fails closed (nothing kept)", async () => {
  const c = cfg();
  fake.look = { ok: false, why: 'promo' };
  assert.deepEqual(await lookAtReview(c, { stars: 1, text: 'join my channel' }), { ok: false, why: 'promo' });
  fake.look = { ok: false, why: 'none' };
  assert.deepEqual(await lookAtReview(c, { stars: 1, text: 'x' }), { ok: false, why: 'other' });
  fake.look = { ok: false, why: 'made-up' };
  assert.deepEqual(await lookAtReview(c, { stars: 1, text: 'x' }), { ok: false, why: 'other' });
  fake.geminiBlocked = true;
  assert.deepEqual(await lookAtReview(c, { stars: 1, text: 'x' }), { ok: false, why: 'unsafe' });
  fake.geminiBlocked = false;
  for (const text of ['not json', '{"why":"none"}', '{"ok":"yes"}']) {
    fake.geminiText = text;
    await assert.rejects(lookAtReview(c, { stars: 1, text: 'x' }), (e) => e.why === 'ai', text);
  }
  fake.geminiText = null; fake.geminiStatus = 500;
  await assert.rejects(lookAtReview(c, { stars: 1, text: 'x' }), (e) => e.why === 'ai' && !e.message.includes(GEMINI_KEY) && /HTTP 500/.test(e.message));
  fake.geminiStatus = 200; fake.geminiHang = true;
  await assert.rejects(lookAtReview(c, { stars: 1, text: 'x' }, { timeoutMs: 50 }), (e) => e.why === 'ai' && /no answer in time/.test(e.message));
  fake.geminiHang = false;
  await assert.rejects(lookAtReview(getConfig({ ...ENV, GEMINI_API_KEY: '' }), { stars: 1, text: 'x' }), (e) => e.why === 'ai');
});

// ---------- who's reviewing ----------
test('the reviewer: its session, its level re-read on the chain when it\'s 30 minutes old (burned $AGI counted), its last level when the chain is away', async () => {
  const c = cfg();
  assert.equal(await reviewer(c, undefined), null);
  assert.equal(await reviewer(c, ''), null);
  assert.deepEqual(await reviewer(c, 'garbage'), { signedOut: true });
  assert.deepEqual(await reviewer(c, 42), { signedOut: true });
  assert.deepEqual(await reviewer(c, session(3)), { level: 3, wallet: W, session: null });
  assert.equal(called('robinhood').length, 0, 'a fresh session: no chain read');
  const now = Date.now();
  const old = session(1, { checkedAt: now - RECHECK_MS - 1000 });
  const seen = [];
  const r = await reviewer(c, old, { now, check: async (w, fallback, env, burned) => { seen.push([w, fallback, burned]); return { level: 2, checked: true }; }, burned: async () => 777 });
  assert.deepEqual(seen, [[W, 1, 777]]);
  assert.equal(r.level, 2); assert.equal(r.wallet, W); assert.equal(typeof r.session, 'string');
  assert.deepEqual(await reviewer(c, r.session, { now }), { level: 2, wallet: W, session: null }, 'its new session is fresh');
  const away = await reviewer(c, old, { now, check: async (w, fallback) => ({ level: fallback, checked: false }), burned: async () => 0 });
  assert.equal(away.level, 1);
  const again = await reviewer(c, away.session, { now: now + 4 * 60_000, check: async () => assert.fail('not yet'), burned: async () => 0 });
  assert.equal(again.level, 1, 're-read in about 5 minutes, not at once');
});

// ---------- saving ----------
test('a review saved: counted first, then looked at by the AI (only with words or a name), then kept under the reviewer\'s code; saving again changes it', async () => {
  const c = cfg();
  const looks = [];
  const look = async (cc, r) => { looks.push(r); return { ok: true }; };
  const a = await saveReview(c, { game: 'rideemagi', wallet: W, who: 'v'.repeat(32), stars: 5, text: 'love it', name: 'Mochi', level: 3 }, { look });
  assert.equal(a.ok, true); assert.equal(a.created, true);
  assert.deepEqual({ ...a.review, at: 'x' }, { id: 1, stars: 5, text: 'love it', name: 'Mochi', level: 3, at: 'x', edited: false, hidden: false });
  assert.deepEqual(rpcs(), ['arcade_review_take', 'arcade_review_put', 'arcade_review_mine'], 'counted before the AI is asked, kept after');
  assert.deepEqual(looks, [{ game: 'rideemagi', stars: 5, text: 'love it', name: 'Mochi' }], 'the AI is told which game it\'s for');
  const kept = fake.db.reviews.get(1);
  assert.equal(kept.wallet, reviewerCode(SECRET, W)); assert.notEqual(kept.wallet, W);
  const b = await saveReview(c, { game: 'rideemagi', wallet: W, who: 'v'.repeat(32), stars: 3, text: '', name: null, level: 2 }, { look });
  assert.equal(b.ok, true); assert.equal(b.created, false, 'one per wallet and game: changed');
  assert.equal(looks.length, 1, 'stars alone: nothing for the AI to look at');
  assert.deepEqual([fake.db.reviews.size, fake.db.reviews.get(1).stars, fake.db.reviews.get(1).body], [1, 3, '']);
  await saveReview(c, { game: 'rideemagi', wallet: W, who: 'v'.repeat(32), stars: 4, text: '', name: 'Kai', level: 9 }, { look });
  assert.equal(looks.at(-1).name, 'Kai', 'a name alone is looked at');
  assert.equal(fake.db.reviews.get(1).level, 1, 'an odd level is a Stranger\'s');
  await assert.rejects(saveReview(c, { game: 'nope', wallet: W, who: 'v'.repeat(32), stars: 4 }, { look }));
  await assert.rejects(saveReview(c, { game: 'rideemagi', wallet: W, who: 'v'.repeat(32), stars: 6 }, { look }));
  // the same wallet rating the second game: a review of its own (one per wallet and game)
  const t = await saveReview(c, { game: 'trenchingsimulator', wallet: W, who: 'v'.repeat(32), stars: 2, text: 'got rugged twice', name: null, level: 1 }, { look });
  assert.equal(t.ok, true); assert.equal(t.created, true);
  assert.equal(looks.at(-1).game, 'trenchingsimulator');
  assert.deepEqual([...fake.db.reviews.values()].map((r) => [r.game, r.stars]), [['rideemagi', 4], ['trenchingsimulator', 2]]);
});

test('a review the AI says no to, or can\'t look at, is never kept; a wallet\'s 10 a day and the site\'s day are counted before the AI is asked', async () => {
  const c = cfg();
  const no = await saveReview(c, { game: 'rideemagi', wallet: W, who: 'v'.repeat(32), stars: 1, text: 'join my channel', level: 1 }, { look: async () => ({ ok: false, why: 'promo' }) });
  assert.deepEqual(no, { ok: false, why: 'rules', look: 'promo' });
  await assert.rejects(saveReview(c, { game: 'rideemagi', wallet: W, who: 'v'.repeat(32), stars: 1, text: 'x', level: 1 }, { look: async () => { throw Object.assign(new Error('down'), { why: 'ai' }); } }), (e) => e.why === 'ai');
  assert.equal(fake.db.reviews.size, 0);
  let looked = 0;
  const look = async () => { looked++; return { ok: true }; };
  for (let i = 0; i < REVIEW.perDay - 2; i++) assert.equal((await saveReview(c, { game: 'rideemagi', wallet: W, who: 'v'.repeat(32), stars: 4, text: 'ok', level: 1 }, { look })).ok, true);
  const capped = await saveReview(c, { game: 'rideemagi', wallet: W, who: 'v'.repeat(32), stars: 4, text: 'ok', level: 1 }, { look });
  assert.deepEqual(capped, { ok: false, why: 'person_cap' }, 'the two refused ones counted too');
  assert.equal(looked, REVIEW.perDay - 2, 'never asked the AI past the day\'s limit');
  // another wallet from the same visitor: the visitor's own day is used up too
  assert.deepEqual(await saveReview(c, { game: 'rideemagi', wallet: W2, who: 'v'.repeat(32), stars: 4, text: 'ok', level: 1 }, { look }), { ok: false, why: 'person_cap' });
  fake.db.rdays.set(`${today()}|site`, { n: ARCADE.REVIEWS_SITE_DAY, plays: 0, players: 0 });
  assert.deepEqual(await saveReview(c, { game: 'rideemagi', wallet: W2, who: 'u'.repeat(32), stars: 4, text: 'ok', level: 1 }, { look }), { ok: false, why: 'site_cap' });
});

test("a wallet's own review (with whether the owner hid it), and deleting it", async () => {
  const c = cfg();
  assert.equal(await myReview(c, 'rideemagi', W), null);
  addReview('rideemagi', W, 4, 'fun');
  assert.equal((await myReview(c, 'rideemagi', W)).text, 'fun');
  fake.db.reviews.get(1).hidden = true;
  assert.equal((await myReview(c, 'rideemagi', W)).hidden, true, 'shown to its own wallet, with "hidden"');
  assert.equal(await myReview(c, 'rideemagi', W2), null);
  assert.deepEqual(await deleteReview(c, 'rideemagi', W2), { ok: true, removed: false });
  assert.deepEqual(await deleteReview(c, 'rideemagi', W), { ok: true, removed: true });
  assert.equal(fake.db.reviews.size, 0);
});

// ---------- two games (2026-10-21: TRENCHING SIMULATOR) ----------
test('two games: each counts its own plays and players (a code of its own for the same browser), has its own ratings and reviews (one per wallet and game), at its own address', async () => {
  const c = cfg();
  assert.deepEqual(await countPlays(c, { game: 'rideemagi', player: PID, who: 'w'.repeat(32), plays: 2 }), { ok: true, new: true });
  assert.deepEqual(await countPlays(c, { game: 'trenchingsimulator', player: PID, who: 'w'.repeat(32), plays: 3 }), { ok: true, new: true }, 'a new player of this game');
  assert.deepEqual(await countPlays(c, { game: 'trenchingsimulator', player: PID, who: 'w'.repeat(32), plays: 1 }), { ok: true, new: false });
  assert.deepEqual(fake.db.games.get('rideemagi'), { plays: 2, players: 1 });
  assert.deepEqual(fake.db.games.get('trenchingsimulator'), { plays: 4, players: 1 });
  const sent = called('arcade_play').map((x) => x.body.p_player);
  assert.notEqual(sent[0], sent[1], 'the same browser, a different code for each game');
  assert.equal(sent[1], playerCode(SECRET, 'trenchingsimulator', PID));
  addReview('rideemagi', W, 5, 'cute');
  addReview('trenchingsimulator', W, 2, 'got rugged twice, still fun');
  addReview('trenchingsimulator', W2, 4);
  const [a, b] = [await gamePage(c, 'rideemagi'), await gamePage(c, 'trenchingsimulator')];
  assert.deepEqual([a.plays, a.players, a.ratings, a.average, a.stars, a.reviews.map((r) => r.text)], [2, 1, 1, 5, [0, 0, 0, 0, 1], ['cute']]);
  assert.deepEqual([b.plays, b.players, b.ratings, b.average, b.stars, b.reviews.map((r) => r.text)], [4, 1, 2, 3, [0, 1, 0, 1, 0], ['got rugged twice, still fun']]);
  assert.equal((await myReview(c, 'trenchingsimulator', W)).text, 'got rugged twice, still fun');
  assert.deepEqual(await deleteReview(c, 'trenchingsimulator', W), { ok: true, removed: true });
  assert.equal((await myReview(c, 'rideemagi', W)).text, 'cute', 'the other game\'s review stays');
  // its address on our server, and its runs told there
  const r = await get('?game=trenchingsimulator');
  assert.equal(r.status, 200); assert.equal(r.data.game, 'trenchingsimulator'); assert.equal(r.data.plays, 4); assert.equal(r.data.ratings, 1);
  assert.match(r.cache, /s-maxage=60/, 'shared by the CDN a minute, like the first game\'s');
  assert.deepEqual([(await play({ game: 'trenchingsimulator', player: PID2 })).status, fake.db.games.get('trenchingsimulator')], [200, { plays: 5, players: 2 }]);
  assert.equal((await get('?game=trenchingsimulator&before=1')).status, 200);
  assert.equal((await post({ action: 'game-mine', game: 'trenchingsimulator', session: session() })).status, 200);
});

// ---------- /api/wallet: a game's page ----------
test('GET /api/wallet?game=<game>: the same for everyone (the CDN keeps it a minute), its numbers and reviews, whether reviews are open', async () => {
  fake.db.games.set('rideemagi', { plays: 99, players: 7 });
  addReview('rideemagi', W, 5, 'best game', { name: 'Mochi', level: 2 });
  const r = await get('?game=rideemagi');
  assert.equal(r.status, 200);
  assert.match(r.cache, /public, max-age=30, s-maxage=60/);
  assert.equal(r.data.ready, true); assert.equal(r.data.game, 'rideemagi'); assert.equal(r.data.open, true);
  assert.deepEqual([r.data.plays, r.data.players, r.data.ratings, r.data.average], [99, 7, 1, 5]);
  assert.equal(r.data.reviews[0].text, 'best game');
  assert.ok(!JSON.stringify(r.data).includes(reviewerCode(SECRET, W)), 'never a wallet\'s code');
  const older = await get(`?game=rideemagi&before=${r.data.reviews[0].id}`);
  assert.deepEqual(older.data, { ready: true, reviews: [], more: false });
  process.env.GEMINI_API_KEY = '';
  assert.equal((await get('?game=rideemagi')).data.open, false, 'no AI: the page can say reviews open soon');
});

test('GET leaderboards: literal and URL-encoded separators reach the same board and retain shared caching', async () => {
  fake.db.arcade_board = () => [];
  for (const [game, board] of [['rideemagi', 'e:all'], ['trenchingsimulator', 'daily:2026-10-22']]) {
    const value = `${game}:${board}`;
    for (const query of [`?board=${value}`, `?${new URLSearchParams({ board: value })}`, `?board=${value.replaceAll(':', '%3a')}`]) {
      const r = await get(query);
      assert.equal(r.status, 200, query);
      assert.deepEqual(r.data, { ready: true, game, board, rows: [] });
      assert.match(r.cache, /public, max-age=30, s-maxage=60/);
      assert.deepEqual(called('arcade_board').at(-1).body, { p_game: game, p_board: board, p_limit: 20 });
    }
  }
  fake.sqlMissing = true;
  assert.deepEqual((await get('?board=rideemagi%3Ae%3Aall')).data, { ready: false });
});

test('GET leaderboards: encoding cannot admit extra parameters, malformed escapes, or unsupported boards', async () => {
  for (const query of ['?board=rideemagi%3Ae%3Aall&x=1', '?board=rideemagi%3Ae%3Aall&board=rideemagi%3Ae%3Aall',
    '?board=rideemagi%3Ae%3Aall%26x%3D1', '?board=rideemagi%253Ae%253Aall', '?board=rideemagi%3Ge%3Aall',
    '?board=rideemagi%3Ae%3Aall%', '?board=rideemagi%3Ae%3Aall+', '?%62oard=rideemagi%3Ae%3Aall']) {
    assert.equal((await get(query)).status, 405, query);
  }
  assert.equal((await get('?board=othergame%3Ae%3Aall')).status, 404);
  assert.equal((await get('?board=rideemagi%3Ac%3Adouble-up%3Aall')).status, 404);
  assert.equal(calls.length, 0, 'invalid requests never reach the database');
});

test("GET: only exactly these addresses (anything else 405); a game we don't have is 404 without asking the database; ?burns as before", async () => {
  for (const q of ['', '?', '?game=', '?game=RideEmAgi', '?game=ride-em', '?game=rideemagi&x=1', '?game=rideemagi&before=0', '?game=rideemagi&before=-1',
    '?game=rideemagi&before=1234567890123456', '?before=1&game=rideemagi', '?game=rideemagi&before=', '?Game=rideemagi', '?burns&game=rideemagi']) {
    assert.equal((await get(q)).status, 405, q);
  }
  assert.equal(calls.length, 0);
  const missing = await get('?game=othergame');
  assert.equal(missing.status, 404);
  assert.equal(calls.length, 0, 'never asks the database');
  assert.equal((await get('?game=rideemagi&before=123456789012345')).status, 200, '15 digits: a whole number JavaScript keeps exactly');
  assert.equal((await get('?game=rideemagi#x')).status, 200, 'a fragment never reaches the server');
  // her burn counter's own address still answers (burns.sql isn't run here)
  assert.deepEqual((await get('?burns')).data, { ready: false });
});

test('GET: not set up (no database, or arcade.sql not run: said once in the log) is "not ready"; the database away is 503', async () => {
  fake.sqlMissing = true;
  assert.deepEqual((await get('?game=rideemagi')).data, { ready: false });
  assert.deepEqual((await get('?game=rideemagi')).data, { ready: false });
  assert.equal(logs.filter((l) => l.includes('run supabase/arcade.sql')).length, 1, 'once per server copy');
  assert.match(logs[0], /arcade_functions_found = 14/);
  fake.sqlMissing = false; fake.dbDown = true;
  const down = await get('?game=rideemagi');
  assert.equal(down.status, 503); assert.equal(down.data.error, 'busy');
  assert.equal(down.cache, 'no-store', 'never kept by the CDN');
  process.env.SUPABASE_URL = '';
  assert.deepEqual((await get('?game=rideemagi')).data, { ready: false });
});

// ---------- /api/wallet: plays ----------
test('POST game-play: no sign-in; the runs counted under codes (never the id or the address); checked before anything is asked', async () => {
  const r = await play({ plays: 2 });
  assert.deepEqual([r.status, r.data], [200, { ok: true }]);
  const sent = called('arcade_play')[0].body;
  assert.equal(sent.p_player, playerCode(SECRET, 'rideemagi', PID));
  assert.equal(sent.p_who, visitorCodeForDay(SECRET, '1.2.3.4', today()), 'the visitor\'s code for today');
  assert.ok(!JSON.stringify(sent).includes('1.2.3.4') && !JSON.stringify(sent).includes(PID));
  assert.equal((await play({ plays: 1 }, { ip: '2001:db8:1:2::77' })).status, 200);
  assert.equal((await play({ plays: 1, player: PID2 }, { ip: '2001:db8:1:2:aaaa::1' })).status, 200);
  const whos = called('arcade_play').slice(1).map((c) => c.body.p_who);
  assert.equal(whos[0], whos[1], 'one IPv6 /64 is one visitor');
  assert.deepEqual(fake.db.games.get('rideemagi'), { plays: 4, players: 2 });
  calls.length = 0;
  for (const bad of [{ game: 'nope' }, { game: undefined }, { player: 'x' }, { player: 123 }, { plays: 0 }, { plays: 51 }, { plays: 2.5 }, { plays: '2' }]) {
    assert.equal((await play(bad)).status, 400, JSON.stringify(bad));
  }
  assert.equal(calls.length, 0, 'nothing asked');
  assert.equal((await post({ action: 'game-play', game: 'rideemagi', player: PID, plays: 1 }, { type: 'text/plain' })).status, 415);
  assert.equal((await post(null, { raw: 'x'.repeat(6001) })).status, 413);
});

test('POST game-play: 30 a minute per visitor, the database\'s limits, not set up (once in the log), the database away', async () => {
  for (let i = 0; i < 30; i++) assert.equal((await play()).status, 200);
  const fast = await play();
  assert.deepEqual([fast.status, fast.data.error], [429, 'too_fast']);
  assert.equal(called('arcade_play').length, 30, 'the 31st never reached the database');
  assert.equal((await play({}, { ip: '5.6.7.8' })).status, 200, 'another visitor');
  arcadePlayBurst.reset();
  fake.db.days.set(`${today()}|${visitorCodeForDay(SECRET, '9.9.9.9', today())}`, { plays: ARCADE.PLAYS_A_DAY, players: 0, n: 0 });
  assert.deepEqual((await play({}, { ip: '9.9.9.9' })).data, { error: 'person_cap' });
  fake.db.days.set(`${today()}|site`, { plays: ARCADE.SITE_PLAYS, players: 0, n: 0 });
  const site = await play({}, { ip: '8.8.8.8' });
  assert.deepEqual([site.status, site.data], [429, { error: 'site_cap' }]);
  fake.sqlMissing = true;
  assert.deepEqual((await play({}, { ip: '7.7.7.7' })).data, { error: 'not_ready' });
  assert.deepEqual((await play({}, { ip: '7.7.7.7' })).data, { error: 'not_ready' });
  assert.equal(logs.filter((l) => l.includes('arcade.sql')).length, 1, 'said once, not on every play');
  fake.sqlMissing = false; fake.dbDown = true;
  assert.deepEqual((await play({}, { ip: '6.6.6.6' })).data, { error: 'busy' });
  process.env.SUPABASE_URL = '';
  assert.deepEqual((await play({}, { ip: '6.6.6.6' })).data, { error: 'not_ready' });
  process.env.SUPABASE_URL = ENV.SUPABASE_URL; process.env.PASS_SECRET = '';
  assert.deepEqual((await play()).data, { error: 'not_configured' });
});

// ---------- /api/wallet: reviews ----------
test('POST game-review: 18+, the human check (made for "review", then the 2-hour pass), saved, shown; never a transaction or the address', async () => {
  const r = await post(reviewOk());
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.ok, true); assert.equal(r.data.created, true); assert.equal(r.data.level, 2);
  assert.equal(r.data.review.text, 'so cute, the cat is the best part 💜'); assert.equal(r.data.review.name, 'Mochi'); assert.equal(r.data.review.level, 2);
  assert.equal(typeof r.data.pass, 'string', 'a pass for the next one');
  const human = called('challenges.cloudflare.com');
  assert.equal(human.length, 1); assert.equal(human[0].body.response, 'good-token'); assert.equal(human[0].body.remoteip, '1.2.3.4');
  assert.equal(called('generativelanguage').length, 1, 'the AI looked at it');
  const kept = fake.db.reviews.get(1);
  assert.equal(kept.wallet, reviewerCode(SECRET, W));
  assert.ok(!JSON.stringify([...fake.db.reviews.values(), ...fake.db.rdays.keys()]).includes(W.slice(2)), 'never the address');
  assert.ok(!JSON.stringify([...fake.db.rdays.keys()]).includes('1.2.3.4'), 'never the internet address');
  // the pass: no new human check for the next save
  const again = await post(reviewOk({ stars: 4, text: 'still great', turnstileToken: undefined, pass: r.data.pass }));
  assert.equal(again.status, 200); assert.equal(again.data.created, false);
  assert.equal(called('challenges.cloudflare.com').length, 1);
  assert.equal(again.data.pass, undefined, 'no new pass when one came');
  assert.equal(fake.db.reviews.get(1).stars, 4);
  // a token made for another widget doesn't count
  fake.humanAction = 'chat';
  const other = await post(reviewOk({ session: session(2, { wallet: W2 }) }));
  assert.deepEqual([other.status, other.data.error], [401, 'human_check']);
});

test('POST game-review: every no before the human check and the database (not set up, stars, 18+, words, name); a session that ended asks for no token', async () => {
  const cases = [
    [{ stars: 0 }, 400, 'bad_request'], [{ stars: 6 }, 400, 'bad_request'], [{ stars: '5' }, 400, 'bad_request'], [{ stars: 4.5 }, 400, 'bad_request'],
    [{ game: 'nope' }, 400, 'bad_request'], [{ adult: false }, 403, 'age'], [{ adult: 'yes' }, 403, 'age'],
    [{ text: 'go to https://scam.example' }, 400, 'words'], [{ text: 'better than $PEPE' }, 400, 'words'], [{ text: 42 }, 400, 'bad_request'],
    [{ name: 'AGI team' }, 400, 'name'], [{ name: 42 }, 400, 'bad_request'],
  ];
  for (const [extra, status, error] of cases) {
    const r = await post(reviewOk(extra));
    assert.deepEqual([r.status, r.data.error], [status, error], JSON.stringify(extra));
  }
  assert.equal((await post(reviewOk({ text: 'go to https://scam.example' }))).data.why, 'link');
  assert.equal((await post(reviewOk({ text: 'better than $PEPE' }))).data.why, 'coin');
  assert.equal(calls.length, 0, 'nothing asked of anyone');
  for (const s of [undefined, '', 'garbage', makeSession('another-secret-that-is-long-enough-123', { wallet: W, level: 2, checkedAt: Date.now() })]) {
    assert.deepEqual((await post(reviewOk({ session: s }))).data, { error: 'signed_out' });
  }
  assert.equal(calls.length, 0, 'no human check used up for a session we can\'t read');
  process.env.TURNSTILE_SECRET_KEY = '';
  assert.deepEqual((await post(reviewOk())).data, { error: 'not_configured' });
});

test('POST game-review: the AI\'s no (nothing kept), the AI away (nothing kept), a wallet\'s day used up (the AI never asked), the database not set up', async () => {
  fake.look = { ok: false, why: 'harassment' };
  const no = await post(reviewOk());
  assert.deepEqual([no.status, no.data.error], [422, 'rules']);
  assert.equal(typeof no.data.pass, 'string', 'its pass comes back with a no, so the next try needs no new check');
  assert.equal(fake.db.reviews.size, 0);
  fake.look = { ok: true, why: 'none' }; fake.geminiStatus = 503;
  const away = await post(reviewOk({ turnstileToken: undefined, pass: no.data.pass }));
  assert.deepEqual([away.status, away.data.error], [503, 'ai']);
  assert.equal(fake.db.reviews.size, 0);
  assert.ok(logs.some((l) => l.includes('couldn\'t be looked at')) && !logs.join(' ').includes(GEMINI_KEY), 'logged, never the key');
  fake.geminiStatus = 200;
  fake.db.rdays.set(`${today()}|w:${reviewerCode(SECRET, W)}`, { n: REVIEW.perDay, plays: 0, players: 0 });
  const before = called('generativelanguage').length;
  const capped = await post(reviewOk({ turnstileToken: undefined, pass: no.data.pass }));
  assert.deepEqual([capped.status, capped.data.error], [429, 'person_cap']);
  assert.equal(called('generativelanguage').length, before, 'the AI is never asked past the day');
  fake.sqlMissing = true;
  const missing = await post(reviewOk({ session: session(2, { wallet: W2 }), turnstileToken: undefined, pass: no.data.pass }));
  assert.deepEqual([missing.status, missing.data.error], [503, 'not_ready']);
});

test('POST game-review: stars alone (no words, no name) are kept without asking the AI; a level re-read on the chain comes back as a new session', async () => {
  const now = Date.now();
  fake.balance = AGI(1_500_000);
  const old = session(1, { checkedAt: now - RECHECK_MS - 5000 });
  const r = await post(reviewOk({ session: old, text: '', name: '' }));
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(called('generativelanguage').length, 0, 'nothing to look at');
  assert.equal(r.data.level, 3, 'Soulmate: 1,500,000 $AGI read on the chain');
  assert.equal(typeof r.data.session, 'string');
  assert.equal(fake.db.reviews.get(1).level, 3, 'her 💜 badge as Soulmate');
  assert.equal(fake.db.reviews.get(1).body, '');
  const page = await get('?game=rideemagi');
  assert.equal(page.data.ratings, 1, 'counted in the stars');
  assert.deepEqual(page.data.reviews, [], 'not in the list (no words)');
});

test('POST game-review: 20 a minute per visitor (with game-mine and delete)', async () => {
  for (let i = 0; i < 20; i++) assert.notEqual((await post({ action: 'game-mine', game: 'rideemagi', session: session() })).status, 429);
  assert.deepEqual((await post(reviewOk())).data, { error: 'too_fast' });
  assert.deepEqual((await post({ action: 'game-review-delete', game: 'rideemagi', session: session() })).data, { error: 'too_fast' });
  assert.equal((await post({ action: 'game-mine', game: 'rideemagi', session: session() }, { ip: '5.6.7.8' })).status, 200, 'another visitor');
});

test('POST game-mine and game-review-delete: only with a session we can read; its own review, and whether the owner hid it', async () => {
  assert.deepEqual((await post({ action: 'game-mine', game: 'rideemagi', session: 'x' })).data, { error: 'signed_out' });
  assert.deepEqual((await post({ action: 'game-mine', game: 'nope', session: session() })).data, { error: 'bad_request' });
  assert.deepEqual((await post({ action: 'game-mine', game: 'rideemagi', session: session() })).data, { review: null, level: 2 });
  addReview('rideemagi', W, 2, 'too hard for me');
  fake.db.reviews.get(1).hidden = true;
  const mine = await post({ action: 'game-mine', game: 'rideemagi', session: session(3) });
  assert.equal(mine.data.review.text, 'too hard for me'); assert.equal(mine.data.review.hidden, true); assert.equal(mine.data.level, 3);
  assert.equal(called('challenges.cloudflare.com').length, 0, 'no human check to read your own');
  assert.deepEqual((await post({ action: 'game-review-delete', game: 'rideemagi', session: 'x' })).data, { error: 'signed_out' });
  assert.deepEqual((await post({ action: 'game-review-delete', game: 'rideemagi', session: session(2, { wallet: W2 }) })).data, { ok: true, removed: false });
  assert.deepEqual((await post({ action: 'game-review-delete', game: 'rideemagi', session: session() })).data, { ok: true, removed: true });
  assert.equal(fake.db.reviews.size, 0);
  fake.sqlMissing = true;
  assert.deepEqual((await post({ action: 'game-mine', game: 'rideemagi', session: session() })).data, { error: 'not_ready' });
  fake.sqlMissing = false; fake.dbDown = true;
  assert.deepEqual((await post({ action: 'game-review-delete', game: 'rideemagi', session: session() })).data, { error: 'busy' });
});

// ---------- the game's own part: what it sends ----------
test("the game's part (src/games/rideemagi/site.js): only its runs, the first at once, then at most once a minute and when the page is hidden, 50 at most, a random id kept for the games", async () => {
  const handlers = {}, store = new Map();
  globalThis.addEventListener = (type, fn) => { handlers[type] = fn; };
  globalThis.document = { visibilityState: 'visible', addEventListener: (type, fn) => { handlers[`doc:${type}`] = fn; } };
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => { store.set(k, String(v)); } };
  const sent = [];
  globalThis.fetch = async (url, init) => { sent.push({ url, init, body: JSON.parse(init.body) }); return new Response('{}'); };
  const { Site, playerId } = await import('../src/games/rideemagi/site.js');
  const id = playerId();
  assert.match(id, PLAYER);
  assert.equal(store.get(PLAYER_KEY), id, 'kept for the games');
  assert.equal(playerId(), id);
  Site.play();
  assert.equal(sent.length, 1, 'the first run at once');
  assert.equal(sent[0].url, '/api/wallet');
  assert.equal(sent[0].init.method, 'POST'); assert.equal(sent[0].init.keepalive, true, 'it outlives the page');
  assert.equal(sent[0].init.headers['content-type'], 'application/json');
  assert.deepEqual(sent[0].body, { action: 'game-play', game: 'rideemagi', player: id, plays: 1 }, 'nothing else');
  Site.play(); Site.play(); Site.play();
  assert.equal(sent.length, 1, 'then they wait (a minute, or the page hidden)');
  document.visibilityState = 'hidden';
  handlers['doc:visibilitychange']();
  assert.equal(sent.length, 2); assert.equal(sent[1].body.plays, 3);
  for (let i = 0; i < 70; i++) Site.play();
  handlers.pagehide();
  assert.equal(sent[2].body.plays, PLAYS.perReport, 'at most 50 a report');
  handlers.pagehide();
  assert.equal(sent.length, 3, 'nothing to send');
  // the game reports each run as it starts
  const game = read('src/games/rideemagi/game.js');
  assert.match(game, /^import \{ Site \} from '\.\/site\.js';$/m);
  assert.equal((game.match(/Site\.play\(\)/g) || []).length, 1);
  // (its code, without its comments, and the address it sends to: no wallet, no sign-in, nothing about the device)
  const code = read('src/games/rideemagi/site.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace("'/api/wallet'", "''");
  assert.doesNotMatch(code, /session|wallet|ethereum|turnstile|navigator\.|document\.cookie|innerHTML|userAgent|screen\./i, 'no wallet, no sign-in, nothing about the device');
  assert.match(read('src/games/rideemagi/site.js'), /const ENDPOINT = '\/api\/wallet';/);
  delete globalThis.addEventListener; delete globalThis.document; delete globalThis.localStorage;
});

test("TRENCHING SIMULATOR's part (src/games/trenchingsimulator/site.js): the same rules, its own game; each run it starts (a challenge, the daily market or free play) told", async () => {
  const handlers = {}, store = new Map();
  globalThis.addEventListener = (type, fn) => { handlers[type] = fn; };
  globalThis.document = { visibilityState: 'visible', addEventListener: (type, fn) => { handlers[`doc:${type}`] = fn; } };
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => { store.set(k, String(v)); } };
  store.set(PLAYER_KEY, PID2);                                                         // (the id Ride 'Em, AGI! kept: one for every game)
  const sent = [];
  globalThis.fetch = async (url, init) => { sent.push({ url, init, body: JSON.parse(init.body) }); return new Response('{}'); };
  const { Site, playerId } = await import('../src/games/trenchingsimulator/site.js');
  assert.equal(playerId(), PID2, 'the id this browser keeps for the games');
  Site.play();
  assert.equal(sent.length, 1, 'the first run at once');
  assert.equal(sent[0].url, '/api/wallet');
  assert.equal(sent[0].init.method, 'POST'); assert.equal(sent[0].init.keepalive, true, 'it outlives the page');
  assert.deepEqual(sent[0].body, { action: 'game-play', game: 'trenchingsimulator', player: PID2, plays: 1 }, 'nothing else');
  Site.play(); Site.play();
  assert.equal(sent.length, 1, 'then they wait (a minute, or the page hidden)');
  document.visibilityState = 'hidden';
  handlers['doc:visibilitychange']();
  assert.deepEqual([sent.length, sent[1].body.plays], [2, 2]);
  for (let i = 0; i < 60; i++) Site.play();
  handlers.pagehide();
  assert.equal(sent[2].body.plays, PLAYS.perReport, 'at most 50 a report');
  // a blocked storage (a private window): an id for this page only, never thrown
  globalThis.localStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  const once = playerId();
  assert.match(once, PLAYER); assert.equal(playerId(), once);
  // the game tells it as each run starts: a challenge, the daily market or free play (startRun), never waiting for it
  const shell = read('src/games/trenchingsimulator/shell.js');
  assert.match(shell, /^import \{ Site \} from '\.\/site\.js';$/m);
  assert.equal((shell.match(/Site\.play\(\)/g) || []).length, 1, 'one place');
  const run = shell.slice(shell.indexOf('async function startRun('), shell.indexOf('function mountPlay('));
  for (const kind of ["setup.kind === 'daily'", "setup.kind === 'challenge'", "mode: 'free'"]) assert.ok(run.includes(kind), kind);
  assert.match(run, /try \{\s*Site\.play\(\);\s*\} catch \{/, 'a run is counted on a best-effort basis: the game never waits for it');
  assert.ok(run.indexOf('Site.play()') > run.lastIndexOf('createRun('), 'told once the run exists');
  // (its code, without its comments, and the address it sends to: no wallet, no sign-in, nothing about the device)
  const code = read('src/games/trenchingsimulator/site.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace("'/api/wallet'", "''");
  assert.doesNotMatch(code, /session|wallet|ethereum|turnstile|navigator\.|document\.cookie|innerHTML|userAgent|screen\./i);
  assert.match(read('src/games/trenchingsimulator/site.js'), /const GAME = 'trenchingsimulator';/);
  delete globalThis.addEventListener; delete globalThis.document; delete globalThis.localStorage;
});

// ---------- light, and its address on our server ----------
test('the games live in /api/wallet (Vercel\'s 12 functions are all used) and load light: the AI and her live rules only for a review', () => {
  assert.equal(readdirSync(new URL('../api/', import.meta.url)).filter((f) => f.endsWith('.js')).length, 12);
  const imports = (f) => [...read(f).matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(imports('server/arcade.js'), ['node:crypto', './limits.js', './session.js', '../src/games/list.js']);
  const src = read('server/arcade.js');
  for (const m of ['./live.js', './gemini.js', './chain.js', './burn.js']) assert.ok(src.includes(`await import('${m}')`), m);
  const wallet = imports('api/wallet.js');
  assert.ok(wallet.includes('../server/arcade.js') && wallet.includes('../src/games/list.js'));
  assert.ok(!wallet.includes('../server/live.js') && !wallet.includes('../server/gemini.js'), 'never loaded for a play');
  assert.deepEqual(imports('src/games/list.js'), []);
  assert.deepEqual(imports('src/games/rideemagi/site.js'), ['../list.js']);
  assert.deepEqual(imports('src/games/trenchingsimulator/site.js'), ['../list.js']);
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts.test, /tests\/arcade\.test\.js/);
});

test("the server log names the fix: arcade.sql's 14 functions (the leaderboards' six since 2026-10-22)", () => {
  const limits = read('server/limits.js');
  for (const fn of ['arcade_play', 'arcade_stats', 'arcade_reviews', 'arcade_review_take', 'arcade_review_put', 'arcade_review_mine', 'arcade_review_delete', 'arcade_review_hide',
    'arcade_take', 'arcade_board_cut', 'arcade_score_put', 'arcade_board', 'arcade_score_mine', 'arcade_score_hide']) {
    assert.ok(limits.includes(`'${fn}'`), fn);
  }
  assert.match(limits, /run supabase\/arcade\.sql in this Supabase project \(AGI games: their plays, reviews and leaderboards; it ends with arcade_functions_found = 14\)/);
});

// ---------- supabase/arcade.sql ----------
test("supabase/arcade.sql's promises: eight tables nobody else can read, 14 functions for the server only, the same rules as our code, never an address", () => {
  const body = read('supabase/arcade.sql').replace(/--.*$/gm, '');
  const tables = ['agi1_arcade_games', 'agi1_arcade_players', 'agi1_arcade_days', 'agi1_arcade_reviews', 'agi1_arcade_review_days',
    'agi1_arcade_scores', 'agi1_arcade_tickets_used', 'agi1_arcade_score_days'];
  for (const t of tables) {
    assert.match(body, new RegExp(`create table if not exists public\\.${t}`), t);
    assert.match(body, new RegExp(`alter table public\\.${t} enable row level security`), t);
    assert.match(body, new RegExp(`revoke all on table public\\.${t} from anon, authenticated`), t);
  }
  const fns = ['arcade_play(text, text, text, integer, integer, integer, integer, integer)', 'arcade_stats(text)', 'arcade_reviews(text, bigint, integer)',
    'arcade_review_take(text, text, integer, integer)', 'arcade_review_put(text, text, integer, text, text, integer)', 'arcade_review_mine(text, text)',
    'arcade_review_delete(text, text)', 'arcade_review_hide(bigint, boolean)',
    // (2026-10-22) the leaderboards'
    'arcade_take(text, text, integer, integer)', 'arcade_board_cut(text, text[], text, double precision, double precision)',
    'arcade_score_put(text, text, integer, double precision, text, text, text[], double precision, double precision, jsonb)',
    'arcade_board(text, text, integer)', 'arcade_score_mine(text, text, text[])', 'arcade_score_hide(bigint, boolean)'];
  for (const f of fns) {
    const e = f.replace(/[()[\]]/g, (c) => `\\${c}`);
    assert.match(body, new RegExp(`revoke all on function public\\.${e} from public, anon, authenticated`), f);
    assert.match(body, new RegExp(`grant execute on function public\\.${e} to service_role`), f);
  }
  assert.match(body, /as arcade_functions_found/);
  assert.equal((body.match(/^create or replace function public\.arcade_/gm) || []).length, 14, 'fourteen, each counted at the end');
  for (const f of fns) assert.ok(body.slice(body.lastIndexOf('as arcade_functions_found')).includes(`'${f.slice(0, f.indexOf('('))}'`), f);
  assert.match(body, /notify pgrst, 'reload schema'/);
  // the leaderboards: a browser's best only, a board's id like our code's, a ticket used once, only a few numbers kept
  assert.match(body, /unique \(game, board, player\)/);
  assert.ok(body.includes("'^[a-z0-9:-]{3,48}$'"), 'a board\'s id');
  assert.match(body, /where t\.uses < p_max_uses and excluded\.last >= t\.last/);
  assert.match(body, /char_length\(p_detail::text\) > 400/);
  assert.doesNotMatch(body, /\bdrop\s+(table|function)\b/i, 'it only adds');
  assert.doesNotMatch(body, /agi1_game_/, 'never her Telegram quizzes\' tables');
  // the same rules as our code
  assert.ok(body.includes("'^[a-z0-9]{2,24}$'"), 'a game\'s id');
  assert.ok(body.includes("'^[A-Za-z0-9_-]{16,64}$'"), 'a code');
  assert.match(body, new RegExp(`char_length\\(body\\) <= ${REVIEW.textMax}`));
  assert.match(body, new RegExp(`char_length\\(name\\) between 1 and ${REVIEW.nameMax}`));
  assert.match(body, /p_plays not between 1 and 50/);
  assert.equal(PLAYS.perReport, 50);
  assert.match(body, /least\(coalesce\(p_limit, 10\), 51\)/);
  assert.ok(REVIEW.pageSize + 1 <= 51);
  assert.match(body, /unique \(game, wallet\)/, 'one review per wallet and game');
  assert.match(body, /where not hidden and body <> ''/);
  assert.doesNotMatch(body, /\bip\b|address text|wallet_address/i);
  // (2026-10-21) a new game needs nothing here: no list of games and no row for one (a game's row comes with its first play),
  // so TRENCHING SIMULATOR needed no new SQL (every game's id fits its rule: the first test)
  for (const id of Object.keys(GAMES)) assert.ok(!body.includes(id), `${id} isn't named in it`);
  assert.doesNotMatch(body, /\binsert\s+into\s+(public\.)?agi1_arcade_games\b(?![^;]*\bp_game\b)/i, 'no game seeded');
  assert.doesNotMatch(body, /\bgame\s+in\s*\(|\bgame\s*=\s*any\b/i, 'no list of games');
});
