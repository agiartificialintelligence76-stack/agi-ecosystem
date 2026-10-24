// POST /api/wallet: connect a wallet and see your relationship level with AGI-1 (Phase 3).
// The wallet only ever signs a free plain-text message. This server never asks for a transaction or a token approval,
// and it only READS the $AGI balance (server/chain.js) and, since 2026-09-30, the burns a visitor made themselves from
// their own wallet app (server/burn.js). Actions (JSON body { action, ... }):
//   start   { address, chainId }            → { message, ticket }      the exact text for the wallet to sign
//   finish  { message, ticket, signature }  → profile + session        proves the wallet is yours
//   profile { session }                     → profile (+ new session)  level re-checked at most every 30 minutes
//   name    { session, name }               → profile                  Crush and Soulmate: what AGI-1 calls you
//   forget  { session }                     → { ok }                   deletes her name for you and her notes
//   burn    { session, tx? }                → profile + { found, … }   "Check my burn" (2026-09-30): the burn pasted (its
//                                                                       hash or explorer link), else the wallet's recent
//                                                                       burns from the block explorer; each read from the
//                                                                       chain and counted once. With the burn monitor's
//                                                                       fresh numbers (`total`), so it moves at once
// A profile's `burn`: { ready: true, left, bought, agi, today, price, perDay } (burned messages: left, bought in all, the
// $AGI that bought them, used today; the price in $AGI a message; a wallet's burned messages a day), or { ready: false }
// until supabase/burns.sql is run: the page only shows its burn buttons when ready, so nobody burns $AGI before our server
// can count it. What a wallet burned for messages counts toward its level, like the $AGI it holds.
// GET /api/wallet?burns (2026-09-30): the price and the public counter, the same for everyone (the CDN keeps it a minute):
//   { ready: true, price, perDay, total: { agi, messages, burns } }, or { ready: false }.
// AGI games (2026-10-19, agi1.app/games: server/arcade.js; Vercel's 12 functions are all used, so they live here):
//   GET ?game=<game>[&before=<id>]           → { ready: true, game, open, plays, players, ratings, average, stars, reviews,
//                                               more } (a `before` page: { ready: true, reviews, more }), or { ready: false }
//                                               until supabase/arcade.sql is run. The same for everyone (the CDN, a minute)
//   game-play          { game, player, plays }   → { ok }   runs a game started: no sign-in, no wallet (src/games/<game>/site.js)
//   game-mine          { game, session }         → { review, level }   this wallet's own review of it (null: none yet)
//   game-review        { game, session, stars, text?, name?, adult, turnstileToken | pass }
//                                                → { ok, created, review }   rated and reviewed by a connected wallet (a free
//                                               signature, never a transaction), 18+, after the human check ('review')
//   game-review-delete { game, session }         → { ok, removed }
// Their leaderboards (2026-10-22: server/scores.js; bragging rights only, no prizes):
//   GET ?board=<game>:<board>                   → { ready: true, game, board, rows: [{ rank, name, detail, at }] }, or
//                                               { ready: false } until arcade.sql's scores are there. The CDN, a minute
//   game-ticket     { game, player, kind, challenge? }  → { ok, ticket, kind, challenge, day, seed, solUsd }  a ranked run
//   game-score      { game, player, ticket, name?, claim + log (TRENCHING SIMULATOR) | run (Ride 'Em, AGI!) }
//                                               → { ok, ranked, ranks?, why? }   checked here first (up to 48 KB)
//   game-score-mine { game, player, boards }    → { ok, rows: [{ board, rank, detail, hidden }] }   this browser's places
// Community votes (2026-10-24, agi1.app/vote: server/vote.js, src/vote/polls.js; here for the same reason):
//   GET ?votes                     → { ready: true, polls: [{ id, question, about, opens, closes, choices, state, rows: [{ choice,
//                                    agi, wallets, share }], total, wallets, left }] }, or { ready: false } until
//                                    supabase/votes.sql is run. The same for everyone (the CDN, 15 seconds); a closed poll's
//                                    final count moves along here
//   vote-mine { session }          → { ok, votes: { [poll]: { choice, agi, final } }, agi, min }   this wallet's votes, its $AGI now
//   vote      { session, poll, choice } → { ok, choice, agi, poll }   at least `min` $AGI held (403 too_few); voting again
//                                    changes it until the close (409 closed)
//   vote-owner / vote-save / vote-drop   the owner's page (agi1.app/vote/owner): see voteOwner() below
import { getConfig } from '../server/config.js';
import { clientIp, visitorCode, visitorCodeForDay, makePass, checkPass } from '../server/security.js';
import { verifyHuman } from '../server/turnstile.js';
import { startSignIn, finishSignIn } from '../server/signin.js';
import { makeSession, readSession, needsRecheck, walletCode, RECHECK_MS } from '../server/session.js';
import { checkLevel } from '../server/chain.js';
import { getFriend, setFriendName, forgetFriend, cleanName } from '../server/friends.js';
import { txFrom, checkBurns, burnStatus, burnTotal, BURN_PER_DAY } from '../server/burn.js';
import { burnBurst, arcadePlayBurst, reviewBurst, scoreBurst, voteBurst } from '../server/burst.js';
import { countPlays, gamePage, reviewsOpen, reviewWords, reviewName, reviewer, myReview, deleteReview, saveReview } from '../server/arcade.js';
import { gameTicket, gameScore, gameBoard, myScores } from '../server/scores.js';
import { isGame, PLAYER, PLAYS, STARS } from '../src/games/list.js';
import { BOARD, BOARD_ASK, isBoard } from '../src/games/boards.js';
import { levelInfo } from '../src/lib/levels.js';
import { pollsNow, castVote, myVotes, isVoteOwner, savePoll, dropPoll, MAX_POLLS } from '../server/vote.js';
import { VOTE } from '../src/vote/polls.js';

// (2026-10-19: 6,000, was 4,000: a review comes with its words, a name, a wallet session and a human check's token)
const MAX_BODY = 6000;
const RETRY_MS = 5 * 60 * 1000;          // if the balance couldn't be read, try again in about 5 minutes
const json = (status, body, headers = { 'Cache-Control': 'no-store' }) => Response.json(body, { status, headers });

// The price and the public counter, and (2026-10-19) a game's stars, plays and reviews: exactly these addresses (anything
// else is 405, so nobody can make the CDN miss on purpose). A game's `before` is the id of the last review shown (a page of
// older ones), at most 15 digits (a whole number JavaScript keeps exactly)
const GAME_ASK = /^\?game=([a-z0-9]{2,24})(?:&before=([1-9]\d{0,14}))?$/;
const SHARED = { 'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120' };
export async function GET(request) {
  const search = request ? new URL(request.url).search : '';
  if (search === '?votes') return votesGet(getConfig());
  const asked = search === '?burns' ? null : GAME_ASK.exec(search);
  // A host may encode the leaderboard's ':' separators as %3A. Normalize only those separators so the strict
  // address check still rejects extra parameters, other escapes and double encoding.
  const board = search === '?burns' || asked ? null : BOARD_ASK.exec(search.replace(/%3a/gi, ':'));
  if (search !== '?burns' && !asked && !board) return json(405, { error: 'method_not_allowed' });
  const cfg = getConfig();
  if (asked) return gameGet(cfg, asked[1], asked[2] ? Number(asked[2]) : null);
  if (board) return boardGet(cfg, board[1], board[2]);
  if (!cfg.supabaseUrl || !cfg.supabaseKey) return json(200, { ready: false }, SHARED);
  try {
    return json(200, { ready: true, price: cfg.burnPrice, perDay: BURN_PER_DAY, total: await burnTotal(cfg) }, SHARED);
  } catch (err) {
    if (err.code === 'PGRST202') return json(200, { ready: false }, SHARED);   // burns.sql isn't run yet
    console.error('[wallet] the burn counter is unavailable:', err.message);
    return json(503, { error: 'busy' });
  }
}

// ---------- community votes (2026-10-24, server/vote.js) ----------
let toldVotesMissing = false;
const votesMissing = (err) => {
  if (!toldVotesMissing) { toldVotesMissing = true; console.error('[wallet] community votes aren\'t kept yet:', err.message); }
};
export const _resetVoteNotes = () => { toldVotesMissing = false; };       // (for the tests)

// (the CDN shares the votes 15 seconds, so the owner's changes show soon)
const VOTES_SHARED = { 'Cache-Control': 'public, max-age=10, s-maxage=15, stale-while-revalidate=30' };
async function votesGet(cfg) {
  if (!cfg.supabaseUrl || !cfg.supabaseKey || cfg.passSecret.length < 32) return json(200, { ready: false }, VOTES_SHARED);
  try {
    return json(200, { ready: true, polls: await pollsNow(cfg) }, VOTES_SHARED);
  } catch (err) {
    if (err.code === 'PGRST202') { votesMissing(err); return json(200, { ready: false }, VOTES_SHARED); }
    console.error('[wallet] the votes are unavailable:', err.message);
    return json(503, { error: 'busy' });
  }
}

// a wallet's votes, and voting (its wallet session: the site's sign-in; its $AGI read on the chain each time)
const VOTE_STATUS = { bad: 400, too_few: 403, soon: 409, closed: 409, counted: 409, chain: 503 };
async function votes(cfg, body, { visitor, now }) {
  if (body.action === 'vote' && (typeof body.poll !== 'string' || typeof body.choice !== 'string')) return json(400, { error: 'bad_request' });
  if (!voteBurst(visitor, now)) return json(429, { error: 'too_fast' });
  const s = readSession(cfg.passSecret, body.session, now);
  if (!s) return json(401, { error: 'signed_out' });
  if (!cfg.supabaseUrl || !cfg.supabaseKey) return json(503, { error: 'not_ready' });
  try {
    if (body.action === 'vote-mine') return json(200, { ok: true, ...(await myVotes(cfg, s.wallet)), min: VOTE.minAgi });
    const r = await castVote(cfg, { wallet: s.wallet, poll: body.poll, choice: body.choice, now });
    if (r.ok) return json(200, r);
    return json(VOTE_STATUS[r.why] || 400, { error: r.why === 'bad' ? 'bad_request' : r.why, ...(r.why === 'too_few' ? { agi: r.agi, min: VOTE.minAgi } : {}) });
  } catch (err) {
    if (err.code === 'PGRST202') { votesMissing(err); return json(503, { error: 'not_ready' }); }
    console.error('[wallet] a vote failed:', err.message);
    return json(503, { error: 'busy' });
  }
}

// The owner's page (agi1.app/vote/owner): only the AGI Studio owner's wallet (STUDIO_OWNER, else the first of
// STUDIO_ONLY_FOR), signed in with the site's own sign-in. Its words for anything refused come from server/vote.js.
//   vote-owner { session }            → { ok, polls: [every poll, hidden ones too, with draft and voters] }
//   vote-save  { session, poll }      → { ok, poll } · 400 { error: 'refused', why }   a new poll (no id) or a changed one
//   vote-drop  { session, id }        → { ok } · 400 { error: 'refused', why }          only a poll nobody voted on
async function voteOwner(cfg, body, { visitor, now }) {
  if (!voteBurst(visitor, now)) return json(429, { error: 'too_fast' });
  const s = readSession(cfg.passSecret, body.session, now);
  if (!s) return json(401, { error: 'signed_out' });
  if (!isVoteOwner(cfg, s.wallet)) return json(403, { error: 'not_owner', ...(cfg.studioOwner ? {} : { unset: true }) });
  if (!cfg.supabaseUrl || !cfg.supabaseKey) return json(503, { error: 'not_ready' });
  try {
    if (body.action === 'vote-owner') return json(200, { ok: true, polls: await pollsNow(cfg, now, { owner: true }), max: MAX_POLLS });
    const r = body.action === 'vote-save' ? await savePoll(cfg, body.poll, now) : await dropPoll(cfg, body.id);
    if (r.ok) return json(200, r);
    return json(400, { error: 'refused', why: r.why });
  } catch (err) {
    if (err.code === 'PGRST202') { votesMissing(err); return json(503, { error: 'not_ready' }); }
    console.error('[wallet] the owner\'s vote change failed:', err.message);
    return json(503, { error: 'busy' });
  }
}

// ---------- AGI games (2026-10-19, server/arcade.js) ----------
// (a server copy says once that arcade.sql isn't run, instead of every play)
let toldArcadeMissing = false;
const arcadeMissing = (err) => {
  if (!toldArcadeMissing) { toldArcadeMissing = true; console.error('[wallet] the games\' plays and reviews aren\'t kept yet:', err.message); }
};
export const _resetArcadeNotes = () => { toldArcadeMissing = false; };      // (for the tests)

async function gameGet(cfg, game, before) {
  if (!isGame(game)) return json(404, { error: 'not_found' }, SHARED);      // never asks the database
  if (!cfg.supabaseUrl || !cfg.supabaseKey) return json(200, { ready: false }, SHARED);
  try {
    const page = await gamePage(cfg, game, { before });
    return json(200, before ? { ready: true, ...page } : { ready: true, game, open: reviewsOpen(cfg), ...page }, SHARED);
  } catch (err) {
    if (err.code === 'PGRST202') { arcadeMissing(err); return json(200, { ready: false }, SHARED); }
    console.error('[wallet] a game\'s page is unavailable:', err.message);
    return json(503, { error: 'busy' });
  }
}

// a game's leaderboard (2026-10-22: server/scores.js): the same for everyone, never who
async function boardGet(cfg, game, board) {
  if (!isGame(game) || !isBoard(game, board)) return json(404, { error: 'not_found' }, SHARED);   // never asks the database
  if (!cfg.supabaseUrl || !cfg.supabaseKey) return json(200, { ready: false }, SHARED);
  try {
    return json(200, { ready: true, game, board, rows: await gameBoard(cfg, game, board) }, SHARED);
  } catch (err) {
    if (err.code === 'PGRST202') { arcadeMissing(err); return json(200, { ready: false }, SHARED); }
    console.error('[wallet] a leaderboard is unavailable:', err.message);
    return json(503, { error: 'busy' });
  }
}

// a ranked run's ticket, its score, and a browser's own places (no sign-in: its random id for the games, never who)
async function gameScores(cfg, body, { visitor, who, now }) {
  if (!isGame(body.game) || typeof body.player !== 'string' || !PLAYER.test(body.player)) return json(400, { error: 'bad_request' });
  if (!cfg.supabaseUrl || !cfg.supabaseKey) return json(503, { error: 'not_ready' });
  if (!scoreBurst(visitor, now)) return json(429, { error: 'too_fast' });
  try {
    if (body.action === 'game-ticket') {
      const r = await gameTicket(cfg, { game: body.game, player: body.player, kind: body.kind, challenge: body.challenge ?? null, who: who(), now });
      if (r.ok) return json(200, r);
      return r.why === 'bad' ? json(400, { error: 'bad_request' }) : json(429, { error: r.why });
    }
    if (body.action === 'game-score-mine') {
      const rows = await myScores(cfg, { game: body.game, player: body.player, boards: body.boards });
      return rows ? json(200, { ok: true, rows }) : json(400, { error: 'bad_request' });
    }
    const r = await gameScore(cfg, body, { who: who(), now });
    if (r.ok) return json(200, r);
    if (r.why === 'person_cap' || r.why === 'site_cap') return json(429, { error: r.why });
    return json(r.why === 'bad' ? 400 : 422, { error: r.why });
  } catch (err) {
    if (err.code === 'PGRST202') { arcadeMissing(err); return json(503, { error: 'not_ready' }); }
    console.error('[wallet] a leaderboard request failed:', err.message);
    return json(503, { error: 'busy' });
  }
}

// runs a game started (no sign-in): counted under a scrambled code of the browser's random id, and a daily code of the
// visitor (never their internet address)
async function gamePlay(cfg, body, { visitor, who, now }) {
  const plays = body.plays;
  if (!isGame(body.game) || typeof body.player !== 'string' || !PLAYER.test(body.player)
    || !Number.isInteger(plays) || plays < 1 || plays > PLAYS.perReport) return json(400, { error: 'bad_request' });
  if (!cfg.supabaseUrl || !cfg.supabaseKey) return json(503, { error: 'not_ready' });
  if (!arcadePlayBurst(visitor, now)) return json(429, { error: 'too_fast' });
  try {
    const r = await countPlays(cfg, { game: body.game, player: body.player, who: who(), plays });
    if (r.ok) return json(200, { ok: true });
    return r.why === 'bad' ? json(400, { error: 'bad_request' }) : json(429, { error: r.why });
  } catch (err) {
    if (err.code === 'PGRST202') { arcadeMissing(err); return json(503, { error: 'not_ready' }); }
    console.error('[wallet] counting a game\'s plays failed:', err.message);
    return json(503, { error: 'busy' });
  }
}

// a review, and a wallet's own one: its wallet session (the site's sign-in) and its level now
async function gameReviews(cfg, request, body, { visitor, who, now }) {
  if (!isGame(body.game)) return json(400, { error: 'bad_request' });
  const game = body.game;

  // a review's words and name, checked before anything else is asked (the live show's rules, and only $AGI)
  let words = null, name = null;
  if (body.action === 'game-review') {
    if (!reviewsOpen(cfg)) {
      console.error('[wallet] reviews need SUPABASE_URL, SUPABASE_SECRET_KEY, TURNSTILE_SECRET_KEY and GEMINI_API_KEY');
      return json(503, { error: 'not_configured' });
    }
    if (!STARS.includes(body.stars)) return json(400, { error: 'bad_request' });
    if (body.adult !== true) return json(403, { error: 'age' });
    if ((body.text ?? '') !== '' && typeof body.text !== 'string') return json(400, { error: 'bad_request' });
    if ((body.name ?? '') !== '' && typeof body.name !== 'string') return json(400, { error: 'bad_request' });
    words = await reviewWords(body.text ?? '');
    if (!words.ok) return json(400, { error: 'words', why: words.why });
    name = await reviewName(body.name ?? '');
    if (!name.ok) return json(400, { error: 'name' });
  }

  if (!reviewBurst(visitor, now)) return json(429, { error: 'too_fast' });
  // (a session we can't read: the page forgets it, before the human check, so no token is used up for nothing)
  if (!readSession(cfg.passSecret, body.session, now)) return json(401, { error: 'signed_out' });

  if (body.action === 'game-review-delete') {
    if (!cfg.supabaseUrl || !cfg.supabaseKey) return json(503, { error: 'not_ready' });
    try {
      return json(200, await deleteReview(cfg, game, readSession(cfg.passSecret, body.session, now).wallet));
    } catch (err) {
      if (err.code === 'PGRST202') { arcadeMissing(err); return json(503, { error: 'not_ready' }); }
      console.error('[wallet] deleting a review failed:', err.message);
      return json(503, { error: 'busy' });
    }
  }

  let pass = null;
  if (body.action === 'game-review' && !checkPass(cfg.passSecret, body.pass, visitor, now)) {
    if (!(await verifyHuman(cfg, body.turnstileToken, clientIp(request), 'review'))) return json(401, { error: 'human_check' });
    pass = makePass(cfg.passSecret, visitor, now);
  }
  // its level now (re-read on the chain when it's 30 minutes old: a new session comes back with it)
  const r = await reviewer(cfg, body.session, { now });
  const extra = { ...(pass ? { pass } : {}), ...(r.session ? { session: r.session } : {}) };

  if (body.action === 'game-mine') {
    if (!cfg.supabaseUrl || !cfg.supabaseKey) return json(503, { error: 'not_ready', ...extra });
    try {
      return json(200, { review: await myReview(cfg, game, r.wallet), level: r.level, ...extra });
    } catch (err) {
      if (err.code === 'PGRST202') { arcadeMissing(err); return json(503, { error: 'not_ready', ...extra }); }
      console.error('[wallet] reading a review failed:', err.message);
      return json(503, { error: 'busy', ...extra });
    }
  }

  try {
    const s = await saveReview(cfg, { game, wallet: r.wallet, who: who(), stars: body.stars, text: words.text, name: name.name, level: r.level });
    if (s.ok) return json(200, { ok: true, created: s.created, review: s.review, level: r.level, ...extra });
    if (s.why === 'rules') return json(422, { error: 'rules', ...extra });
    return json(429, { error: s.why, ...extra });
  } catch (err) {
    if (err.why === 'ai') {
      console.error('[wallet] a review couldn\'t be looked at (nothing kept):', err.message);
      return json(503, { error: 'ai', ...extra });
    }
    if (err.code === 'PGRST202') { arcadeMissing(err); return json(503, { error: 'not_ready', ...extra }); }
    console.error('[wallet] saving a review failed:', err.message);
    return json(503, { error: 'busy', ...extra });
  }
}

// A wallet's burned messages, for its profile (never throws)
async function burnInfo(cfg, wallet) {
  if (!cfg.supabaseUrl || !cfg.supabaseKey) return { ready: false };
  try {
    return { ready: true, ...(await burnStatus(cfg, wallet)), price: cfg.burnPrice, perDay: BURN_PER_DAY };
  } catch (err) {
    if (err.code !== 'PGRST202') console.error('[wallet] burned messages unavailable:', err.message);
    return { ready: false };
  }
}

async function profile(cfg, { wallet, level, checkedAt, expiresAt }, checked = true, burn = null) {
  const session = makeSession(cfg.passSecret, { wallet, level, checkedAt, expiresAt });
  const info = levelInfo(level);
  let friend = { name: null, notes: [] };
  if (level >= 2 && cfg.supabaseUrl && cfg.supabaseKey) {
    try { friend = await getFriend(cfg, walletCode(cfg.passSecret, wallet)); } catch (err) { console.error('[wallet] memory unavailable:', err.message); }
  }
  return {
    session, wallet, level, levelName: info.name, daily: info.daily, checked,
    name: level >= 2 ? friend.name : null,
    notes: level >= 3 ? friend.notes : [],
    burn: burn ?? await burnInfo(cfg, wallet),
  };
}

export async function POST(request) {
  const cfg = getConfig();
  if (cfg.passSecret.length < 32) {
    console.error('[wallet] missing settings: PASS_SECRET (32+ characters)');
    return json(503, { error: 'not_configured' });
  }
  if (!(request.headers.get('content-type') || '').includes('application/json')) return json(415, { error: 'bad_request' });
  const raw = await request.text();
  // (2026-10-22) a leaderboard's score may carry a run's orders: up to 48 KB, only when it says so first; (2026-10-24) the
  // owner's vote with its choices' pictures: up to 1.1 MB, the same way (its wallet session checked right after)
  const bodyMax = raw.startsWith('{"action":"game-score"') ? BOARD.bodyMax : raw.startsWith('{"action":"vote-save"') ? VOTE.bodyMax : MAX_BODY;
  if (raw.length > bodyMax) return json(413, { error: 'bad_request' });
  let body;
  try { body = JSON.parse(raw); } catch { return json(400, { error: 'bad_request' }); }
  if (!body || typeof body !== 'object') return json(400, { error: 'bad_request' });

  const origin = new URL(request.url).origin;
  const visitor = visitorCode(cfg.passSecret, clientIp(request));
  const now = Date.now();
  // (2026-10-19, the games) the visitor's code for today (UTC), for the database's daily counts: never their address
  const who = () => visitorCodeForDay(cfg.passSecret, clientIp(request), new Date(now).toISOString().slice(0, 10));

  switch (body.action) {
    case 'game-play':
      return gamePlay(cfg, body, { visitor, who, now });

    case 'game-mine':
    case 'game-review':
    case 'game-review-delete':
      return gameReviews(cfg, request, body, { visitor, who, now });

    case 'game-ticket':
    case 'game-score':
    case 'game-score-mine':
      return gameScores(cfg, body, { visitor, who, now });

    case 'vote':
    case 'vote-mine':
      return votes(cfg, body, { visitor, now });

    case 'vote-owner':
    case 'vote-save':
    case 'vote-drop':
      return voteOwner(cfg, body, { visitor, now });

    case 'start': {
      try {
        return json(200, startSignIn(cfg.passSecret, { address: body.address, origin, visitor, chainId: body.chainId }, now));
      } catch {
        return json(400, { error: 'bad_address' });
      }
    }

    case 'finish': {
      let wallet;
      try {
        wallet = await finishSignIn(cfg.passSecret, { ...body, origin, visitor }, now);
      } catch (err) {
        return json(401, { error: ['expired', 'wrong_signer'].includes(err.message) ? err.message : 'bad_signature' });
      }
      const burn = await burnInfo(cfg, wallet);
      const { level, checked } = await checkLevel(wallet, 1, undefined, burn.ready ? burn.agi : 0);
      const checkedAt = checked ? now : now - RECHECK_MS + RETRY_MS;
      return json(200, await profile(cfg, { wallet, level, checkedAt }, checked, burn));
    }

    case 'profile':
    case 'name':
    case 'forget':
    case 'burn': {
      const s = readSession(cfg.passSecret, body.session, now);
      if (!s) return json(401, { error: 'signed_out' });

      if (body.action === 'forget') {
        // (her name for them and her notes: burned messages they haven't used stay with the wallet, since they paid for them)
        if (!cfg.supabaseUrl || !cfg.supabaseKey) return json(200, { ok: true });   // nothing can be stored
        try {
          await forgetFriend(cfg, walletCode(cfg.passSecret, s.wallet));
          return json(200, { ok: true });
        } catch (err) {
          if (err.code === 'not_ready') return json(200, { ok: true });           // the table doesn't exist yet
          console.error('[wallet] forget failed:', err.message);
          return json(503, { error: 'busy' });
        }
      }

      // "Check my burn" (2026-09-30): counted before the level is re-read, since what they burned counts toward it
      let check = null;
      if (body.action === 'burn') {
        if (!cfg.supabaseUrl || !cfg.supabaseKey) return json(503, { error: 'not_ready' });
        if (!burnBurst(visitor, now)) return json(429, { error: 'too_fast' });
        let tx = null;
        if (body.tx !== undefined && body.tx !== null && body.tx !== '') {
          tx = txFrom(body.tx);
          if (!tx) return json(400, { error: 'bad_tx' });
        }
        try {
          check = await checkBurns(cfg, { wallet: s.wallet, tx, now });
        } catch (err) {
          if (err.code === 'PGRST202') return json(503, { error: 'not_ready' });
          console.error(`[wallet] checking burns failed${err.why ? ` (${err.why})` : ''}:`, err.message);
          return json(503, { error: err.why === 'chain' || err.why === 'explorer' ? err.why : 'busy' });
        }
      }

      const burn = await burnInfo(cfg, s.wallet);
      let { level, checkedAt } = s;
      let checked = true;
      if (needsRecheck(s, now) || check?.results.some((r) => r.ok)) {
        const r = await checkLevel(s.wallet, s.level, undefined, burn.ready ? burn.agi : 0);
        level = r.level;
        checked = r.checked;
        checkedAt = r.checked ? now : now - RECHECK_MS + RETRY_MS;
      }

      if (body.action === 'name') {
        if (level < 2) return json(403, { error: 'level' });
        const name = body.name === '' || body.name === null ? null : cleanName(body.name);
        if (body.name && !name) return json(400, { error: 'bad_name' });
        if (!cfg.supabaseUrl || !cfg.supabaseKey) return json(503, { error: 'not_configured' });
        try {
          await setFriendName(cfg, walletCode(cfg.passSecret, s.wallet), name);
        } catch (err) {
          console.error('[wallet] saving the name failed:', err.message);
          return json(503, { error: err.code === 'not_ready' ? 'not_ready' : 'busy' });
        }
      }
      const answer = await profile(cfg, { wallet: s.wallet, level, checkedAt, expiresAt: s.expiresAt }, checked, burn);
      if (!check) return json(200, answer);
      // each burn found: { ok: true, messages, agi } or { ok: false, why } (server/burn.js); counted: burns the explorer
      // listed that were already counted; more: new ones left for the next check; total: the burn monitor's numbers now
      const found = check.results.map((r) => (r.ok ? { ok: true, messages: r.messages, agi: r.agi } : { ok: false, why: r.why }));
      let total = null;
      if (found.some((f) => f.ok)) {
        try { total = await burnTotal(cfg); } catch (err) { console.error('[wallet] the burn counter is unavailable:', err.message); }
      }
      return json(200, { ...answer, found, source: check.source, counted: check.counted, more: check.more, ...(total ? { total } : {}) });
    }

    default:
      return json(400, { error: 'bad_request' });
  }
}
