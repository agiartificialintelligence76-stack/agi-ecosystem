// AGI games' leaderboards on our server (2026-10-22, the owner: "add a leaderboard (also add leaderboards with names ,
// optional to the game ride em agi also)"; the owner's pick: "Checked runs only"): tickets, checked scores and the boards,
// inside /api/wallet (Vercel's 12 functions are all used). Bragging rights only: no prizes, and nothing here is money.
//   • A ranked run starts with a ticket, signed with PASS_SECRET so it can't be changed, and tied to its player's browser
//     (a code of its random id, never the id): TRENCHING SIMULATOR's says what it plays (a challenge's seed, picked here;
//     the daily market's day; SOL's price, ours); Ride 'Em, AGI!'s, when the run started. Used once (Ride 'Em: its first
//     end and two revives, each farther).
//   • A score comes back with its ticket. TRENCHING SIMULATOR: its orders, and the run is made again here with the game's
//     own code (src/games/trenchingsimulator/verify.js) before anything counts: the page's own numbers are never taken.
//     Ride 'Em, AGI!: its numbers, checked against what the game can do (its top speed, its score per metre, its revives,
//     the daily mod of its day).
//   • A name, if they gave one: the site's rules for a name (reviewName); a refused one shows as "A player".
//   • Counted per visitor (a daily code, never an address) and for the whole site; a board is the same for everyone (the
//     CDN keeps it a minute) and never shows who: a name, the numbers, when.
// The database: supabase/arcade.sql (its scores' three tables and six functions, since 2026-10-22). Until it's run, the
// games say the leaderboards open soon and play as before.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { rpc } from './limits.js';
import { playerCode, reviewName } from './arcade.js';
import { isGame, PLAYER } from '../src/games/list.js';
import { BOARD, isBoard, dayKeyOf, dayShift, trenchBoards, trenchKeys, rideBoards, rideKeys } from '../src/games/boards.js';

// TRENCHING SIMULATOR's run made again (the engine and the run: loaded only for a ticket or a score)
let verifyP = null;
const verify = () => (verifyP ||= import('../src/games/trenchingsimulator/verify.js').catch((e) => { verifyP = null; throw e; }));

// Ride 'Em, AGI!'s limits (2026-10-22: from its own code and its QA bot's runs; generous, so no real run is refused)
export const RIDE = Object.freeze({
  maxDist: 60000,          // metres
  maxSpeed: 52,            // m/s: its zoomies' ceiling (51.5), a little over
  perMetre: 40, plus: 5000,// the most score a metre (its best seen: 26.8), plus a start
  maxMult: 5, maxRevives: 2,
  maxAge: 2 * 3600 * 1000, // a ticket is good for 2 hours
});
// its daily mod (the game's own: dailyInfo() hashes "ride-em-agi:<date>" and picks one of five)
const RIDE_MODS = Object.freeze(['treats', 'lowgrav', 'powers', 'turbo', 'springs']);
export function rideMod(date) {
  let h = 2166136261;
  const s = `ride-em-agi:${date}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return RIDE_MODS[(h >>> 0) % RIDE_MODS.length];
}

// ---------- tickets ----------
const sig = (secret, text) => createHmac('sha256', String(secret)).update(`arcade-ticket:${text}`).digest('base64url');
export function makeTicket(secret, t) {
  const payload = Buffer.from(JSON.stringify(t)).toString('base64url');
  return `${payload}.${sig(secret, payload)}`;
}
// → the ticket's fields, or null (not ours, changed, or broken)
export function openTicket(secret, ticket) {
  if (typeof ticket !== 'string' || ticket.length > 600) return null;
  const [payload, mac, extra] = ticket.split('.');
  if (!payload || !mac || extra !== undefined) return null;
  const want = Buffer.from(sig(secret, payload));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const t = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return t && typeof t === 'object' && t.v === 1 ? t : null;
  } catch {
    return null;
  }
}
// a ticket's tie to one browser (a code's first 16 characters: enough, and never the id)
const tieOf = (secret, game, player) => playerCode(secret, game, player).slice(0, 16);

// SOL's price for a ticket: DexScreener's (the game's own reading of it), kept 5 minutes by this server copy; $150 when it
// can't be read. Frozen in the ticket, so the page plays at the same price the check does.
let price = { usd: 0, at: 0 };
export const _resetScores = () => { price = { usd: 0, at: 0 }; };      // (for the tests)
async function solPrice(now) {
  if (price.usd > 0 && now - price.at < 300000) return price.usd;
  try {
    const { SOL_URL, parseSolPrice, FALLBACK_USD } = await import('../src/games/trenchingsimulator/solprice.js');
    let usd = FALLBACK_USD;
    try {
      const r = await fetch(SOL_URL, { signal: AbortSignal.timeout(3000) });
      const p = r.ok ? parseSolPrice(await r.json()) : null;
      if (p > 0) usd = Math.round(p * 100) / 100;
    } catch { /* DexScreener away: the stand-in */ }
    price = { usd, at: now };
    return usd;
  } catch {
    return 150;
  }
}

// A ticket for a ranked run. TRENCHING SIMULATOR: kind 'challenge' (with its id) or 'daily'; Ride 'Em, AGI!: 'endless' or
// 'daily'. → { ok: true, ticket, kind, challenge, day, seed, solUsd } or { ok: false, why: 'bad' | 'person_cap' | 'site_cap' }
// (throws when the database can't be asked; err.code PGRST202: arcade.sql's scores aren't there yet)
export async function gameTicket(cfg, { game, player, kind, challenge = null, who, now = Date.now() }) {
  if (!isGame(game) || typeof player !== 'string' || !PLAYER.test(player)) return { ok: false, why: 'bad' };
  const day = dayKeyOf(now);
  let info;
  if (game === 'trenchingsimulator') {
    if (kind !== 'daily' && kind !== 'challenge') return { ok: false, why: 'bad' };
    const V = await verify();
    const ch = V.rankedChallenge({ kind, challenge, day });
    if (!ch) return { ok: false, why: 'bad' };
    const seed = kind === 'challenge' ? `${ch.id}-${randomBytes(16).toString('hex')}` : V.rankedSeed({ kind, day });
    info = { k: kind, c: kind === 'challenge' ? ch.id : null, d: day, s: seed, x: await solPrice(now) };
  } else if (game === 'rideemagi') {
    if (kind !== 'endless' && kind !== 'daily') return { ok: false, why: 'bad' };
    info = { k: kind, c: null, d: day, s: null, x: null };
  } else return { ok: false, why: 'bad' };
  const take = await rpc(cfg, 'arcade_take', { p_kind: 't', p_who: who, p_per_day: BOARD.perDay.tickets, p_site_daily: BOARD.site.tickets }, 'arcade');
  if (take !== 'ok') return { ok: false, why: take === 'person_cap' || take === 'site_cap' ? take : 'bad' };
  const t = { v: 1, g: game, p: tieOf(cfg.passSecret, game, player), ...info, t: now, j: randomBytes(16).toString('base64url') };
  return { ok: true, ticket: makeTicket(cfg.passSecret, t), kind: t.k, challenge: t.c, day: t.d, seed: t.s, solUsd: t.x };
}

const fin = (x) => typeof x === 'number' && Number.isFinite(x);

// A ranked run's score. → { ok: true, ranked: true, ranks: { <board>: <rank> }, name, nameRefused } when it's on the
// boards; { ok: true, ranked: false, why: 'not_ranked' (a run that doesn't rank: a challenge lost, a run ended by its
// player) | 'not_better' (it wouldn't make a board, or the player's best is better) }; or { ok: false, why: 'bad' |
// 'ticket' | 'late' | 'fast' (it took less real time than it says) | 'replay' (it isn't what its orders make) |
// 'checks' (Ride 'Em: outside what the game can do) | 'used' | 'person_cap' | 'site_cap' }
export async function gameScore(cfg, body, { who, now = Date.now() }) {
  const game = body && body.game;
  if (!isGame(game) || typeof body.player !== 'string' || !PLAYER.test(body.player)) return { ok: false, why: 'bad' };
  const t = openTicket(cfg.passSecret, body.ticket);
  if (!t || t.g !== game || t.p !== tieOf(cfg.passSecret, game, body.player)) return { ok: false, why: 'ticket' };
  const raw = body.name ?? '';
  const n = typeof raw === 'string' ? await reviewName(raw) : { ok: false };
  const name = n.ok ? n.name : null;
  const nameRefused = !n.ok && Boolean(raw);
  const code = playerCode(cfg.passSecret, game, body.player);
  const take = (kind, siteCap) => rpc(cfg, 'arcade_take', { p_kind: kind, p_who: who, p_per_day: BOARD.perDay.scores, p_site_daily: siteCap }, 'arcade');
  const cut = (boards, k) => rpc(cfg, 'arcade_board_cut', { p_game: game, p_boards: boards, p_player: code, p_k1: k.k1, p_k2: k.k2 }, 'arcade');
  const put = async (boards, k, maxUses, last) => {
    const r = await rpc(cfg, 'arcade_score_put', { p_game: game, p_j: t.j, p_max_uses: maxUses, p_last: last, p_player: code, p_name: name,
      p_boards: boards, p_k1: k.k1, p_k2: k.k2, p_detail: k.detail }, 'arcade');
    if (!r || r.ok !== true) return { ok: false, why: r && r.why === 'used' ? 'used' : 'bad' };
    const ranks = {};
    for (const b of boards) if (r.ranks && Number.isInteger(r.ranks[b])) ranks[b] = r.ranks[b];
    return { ok: true, ranked: true, ranks, name, nameRefused };
  };

  if (game === 'trenchingsimulator') {
    const V = await verify();
    const ch = V.rankedChallenge({ kind: t.k, challenge: t.c, day: t.d });
    const c = body.claim;
    if (!ch || !c || typeof c !== 'object' || typeof c.outcome !== 'string' || !fin(c.timeUsed) || !fin(c.worth) || !fin(c.multiple)) return { ok: false, why: 'bad' };
    if (now - t.t > (ch.seconds + 900) * 1000) return { ok: false, why: 'late' };
    // (a run takes at least its time: its clock is the page's, never faster than the real one in a challenge)
    if (now - t.t < (c.timeUsed - 5) * 1000) return { ok: false, why: 'fast' };
    const log = V.unpackLog(body.log);
    if (!log) return { ok: false, why: 'bad' };
    const pre = trenchKeys(t.k, c);
    if (!pre) return { ok: true, ranked: false, why: 'not_ranked' };
    const boards = trenchBoards({ kind: t.k, challenge: t.c, day: t.d });
    const tk = await take('s', BOARD.site.scores);
    if (tk !== 'ok') return { ok: false, why: tk === 'person_cap' || tk === 'site_cap' ? tk : 'bad' };
    if ((await cut(boards, pre)) !== true) return { ok: true, ranked: false, why: 'not_better' };
    // (made again: counted on its own, its CPU is what costs)
    const tp = await take('p', BOARD.site.replays);
    if (tp !== 'ok') return { ok: false, why: tp === 'person_cap' || tp === 'site_cap' ? tp : 'bad' };
    const rep = V.replayRun({ kind: t.k, challenge: t.c, day: t.d, seed: t.s, solUsd: t.x, log });
    if (!rep.ok || !V.sameResult(c, rep.result)) return { ok: false, why: 'replay' };
    const keys = trenchKeys(t.k, rep.result);
    if (!keys) return { ok: true, ranked: false, why: 'not_ranked' };
    return put(boards, keys, 1, 0);
  }

  // Ride 'Em, AGI!
  const r = body.run;
  if (!r || typeof r !== 'object' || r.mode !== t.k) return { ok: false, why: 'bad' };
  const ints = [r.dist, r.score, r.revives, r.ms];
  if (!ints.every(Number.isSafeInteger) || !fin(r.bestMult)) return { ok: false, why: 'bad' };
  if (now - t.t > RIDE.maxAge) return { ok: false, why: 'late' };
  const ok = r.dist >= 1 && r.dist <= RIDE.maxDist && r.revives >= 0 && r.revives <= RIDE.maxRevives
    && r.bestMult >= 1 && r.bestMult <= RIDE.maxMult && r.score >= r.dist && r.score <= RIDE.perMetre * r.dist + RIDE.plus
    && r.ms >= (1000 * r.dist) / RIDE.maxSpeed && now - t.t >= ((r.dist / RIDE.maxSpeed) - 10) * 1000;
  if (!ok) return { ok: false, why: 'checks' };
  let boards;
  if (r.mode === 'daily') {
    if (![dayShift(t.d, -1), t.d, dayShift(t.d, 1)].includes(r.date) || r.mod !== rideMod(r.date)) return { ok: false, why: 'checks' };
    boards = rideBoards({ mode: 'daily', date: r.date });
  } else boards = rideBoards({ mode: 'endless', day: t.d });
  const keys = rideKeys(r);
  const tk = await take('r', BOARD.site.scores * 10);
  if (tk !== 'ok') return { ok: false, why: tk === 'person_cap' || tk === 'site_cap' ? tk : 'bad' };
  if ((await cut(boards, keys)) !== true) return { ok: true, ranked: false, why: 'not_better' };
  return put(boards, keys, BOARD.rideUses, r.dist);
}

// a board as the page shows it: its newest best rows, never who (a name, the numbers, when)
export async function gameBoard(cfg, game, board) {
  if (!isGame(game) || !isBoard(game, board)) return null;
  const rows = await rpc(cfg, 'arcade_board', { p_game: game, p_board: board, p_limit: BOARD.top }, 'arcade');
  return (Array.isArray(rows) ? rows : []).slice(0, BOARD.top).map((x, i) => ({
    rank: i + 1, name: typeof x.name === 'string' && x.name ? x.name : null,
    detail: x.detail && typeof x.detail === 'object' ? x.detail : {}, at: typeof x.created === 'string' ? x.created : null,
  }));
}

// a player's own place on some boards (its browser's id: no sign-in) → [{ board, rank, detail, hidden }]
export async function myScores(cfg, { game, player, boards }) {
  if (!isGame(game) || typeof player !== 'string' || !PLAYER.test(player) || !Array.isArray(boards) || !boards.length
    || boards.length > 6 || !boards.every((b) => isBoard(game, b))) return null;
  const rows = await rpc(cfg, 'arcade_score_mine', { p_game: game, p_player: playerCode(cfg.passSecret, game, player), p_boards: boards }, 'arcade');
  return (Array.isArray(rows) ? rows : []).filter((x) => x && boards.includes(x.board)).map((x) => ({
    board: x.board, rank: Number.isInteger(x.rank) ? x.rank : null, detail: x.detail && typeof x.detail === 'object' ? x.detail : {},
    hidden: x.hidden === true,
  }));
}
