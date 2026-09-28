// GET /api/arena: the Arena's public scoreboard (this round's votes, recent champions, crowns this week and all time).
// Everyone sees the same numbers, so Vercel's CDN may reuse an answer for 10 s: many visitors cost few function runs.
// Phase 6: also the coins in the Arena (with their logos and clank.trade links), coins that left it recently (so a recent
// champion keeps its name and logo), and the nominations with their votes this week (server/coins.js).
// GET /api/arena?before=<round>&limit=<n>: older champions for the round history ("Show older rounds").
import { getConfig } from '../server/config.js';
import { ROUND_MS, OPENED, roundAt, roundNumber, weekStartRound, arenaRpc } from '../server/arena.js';
import { loadCoinBoard, NEED, MAX_OTHERS, CORE } from '../server/coins.js';

const noStore = { 'Cache-Control': 'no-store' };
const withNumbers = (list) => (Array.isArray(list) ? list : []).map((c) => ({ ...c, number: roundNumber(c.round) }));
const failed = (err) => {
  console.error('[arena] state unavailable:', err.message);
  return Response.json({ error: err.code === 'not_ready' ? 'not_ready' : 'busy' }, { status: 503, headers: noStore });
};

export async function GET(request) {
  const cfg = getConfig();
  if (!cfg.supabaseUrl || !cfg.supabaseKey) {
    console.error('[arena] SUPABASE_URL or SUPABASE_SECRET_KEY is missing');
    return Response.json({ error: 'not_configured' }, { status: 503, headers: noStore });
  }
  const now = Date.now();
  const round = roundAt(now);
  const params = new URL(request?.url || 'https://x/').searchParams;
  if (params.has('before')) return history(cfg, params, round);

  const weekStart = weekStartRound(now);
  let state, week = null, board;
  const loadState = async () => {
    try {
      state = await arenaRpc(cfg, 'arena_state', { p_round: round, p_recent: 12, p_week_start: weekStart });
      week = state.week || {};
    } catch (err) {
      if (err.code !== 'not_ready') throw err;
      // arena.sql from before Phase 4 (no Hall of Fame yet): the Arena keeps working, just without "This week"
      state = await arenaRpc(cfg, 'arena_state', { p_round: round, p_recent: 12 });
      console.warn('[arena] Hall of Fame not set up yet: run supabase/arena.sql again in Supabase');
    }
  };
  try {
    [, board] = await Promise.all([loadState(), loadCoinBoard(cfg)]);    // both at once: one round trip, not two
  } catch (err) {
    return failed(err);
  }
  if (board.candidates === null) console.warn('[arena] nominations not set up yet: run supabase/coins.sql in Supabase');
  return Response.json(
    {
      round, number: roundNumber(round), endsAt: (round + 1) * ROUND_MS, now,
      tally: state.tally || {}, recent: withNumbers(state.recent), crowns: state.crowns || {},
      week, weekStart: weekStart * ROUND_MS,
      coins: board.coins, retired: board.retired, candidates: board.candidates,
      rules: { need: NEED, max: CORE.length + MAX_OTHERS, core: CORE },
    },
    { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=10, stale-while-revalidate=20' } },
  );
}

// Older champions. Rounds that are over don't change, so the CDN may keep these answers for a minute.
async function history(cfg, params, round) {
  const before = Number(params.get('before'));
  const limit = Number(params.get('limit') || 24);
  if (!Number.isSafeInteger(before) || before <= OPENED || before > round + 1 || !Number.isInteger(limit) || limit < 1 || limit > 48) {
    return Response.json({ error: 'bad_request' }, { status: 400, headers: noStore });
  }
  try {
    const list = await arenaRpc(cfg, 'arena_history', { p_before: before, p_limit: limit });
    return Response.json({ history: withNumbers(list), before }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60' } });
  } catch (err) {
    return failed(err);
  }
}

export function POST() {
  return Response.json({ error: 'method_not_allowed' }, { status: 405, headers: noStore });
}
