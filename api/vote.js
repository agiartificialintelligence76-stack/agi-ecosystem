// POST /api/vote: one vote per visitor per 5-minute round in the Arena. In order:
//   1. speed bump: at most 12 requests a minute per visitor on this server copy (a script gets "slow_down")
//   2. check the request (JSON, small, something that looks like a ticker)
//   3. human check: a valid pass (the same 2-hour pass the chat hands out) or a fresh Turnstile token
//   4. the coin must be in the Arena right now (Phase 6: visitors vote coins in, supabase/coins.sql; the list is kept 30 s)
//   5. the database records the vote: the round comes from the server's clock, and the visitor is only
//      a daily-changing code made from their IP (IPv6: the whole /64 block), so one vote per round is enforced there.
//      DB down → no vote. A visitor this copy already saw vote this round is told so without asking the database again.
import { getConfig } from '../server/config.js';
import { clientIp, visitorCode, visitorCodeForDay, makePass, checkPass } from '../server/security.js';
import { verifyHuman } from '../server/turnstile.js';
import { roundAt, roundNumber, arenaRpc } from '../server/arena.js';
import { activeSymbols } from '../server/coins.js';
import { voteBurst as burst, votedThisRound as alreadyVoted } from '../server/burst.js';

const MAX_BODY = 4_000;
const json = (status, body) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export function GET() {
  return json(405, { error: 'method_not_allowed' });
}

export async function POST(request) {
  const cfg = getConfig();
  const missing = ['supabaseUrl', 'supabaseKey', 'turnstileSecret'].filter((k) => !cfg[k]);
  if (missing.length || cfg.passSecret.length < 32) {
    console.error('[vote] missing settings:', [...missing, ...(cfg.passSecret.length < 32 ? ['passSecret'] : [])].join(', '));
    return json(503, { error: 'not_configured' });
  }

  // 1. Speed bump (before anything that costs something).
  const ip = clientIp(request);
  if (!burst(visitorCode(cfg.passSecret, ip))) return json(429, { error: 'slow_down' });

  // 2. The request.
  if (!(request.headers.get('content-type') || '').includes('application/json')) return json(415, { error: 'bad_request' });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json(413, { error: 'bad_request' });
  let body;
  try { body = JSON.parse(raw); } catch { return json(400, { error: 'bad_request' }); }
  const coin = typeof body?.coin === 'string' ? body.coin : '';
  if (!/^[A-Z0-9]{1,12}$/.test(coin)) return json(400, { error: 'bad_coin' });

  // 3. Human check.
  let pass = null;
  if (!checkPass(cfg.passSecret, body.pass, visitorCode(cfg.passSecret, ip))) {
    if (!(await verifyHuman(cfg, body.turnstileToken, ip, 'vote'))) return json(401, { error: 'human_check' });
    pass = makePass(cfg.passSecret, visitorCode(cfg.passSecret, ip));
  }

  // 4. The coin must be in the Arena right now (asked again when it isn't: it may have been voted in a moment ago).
  const round = roundAt();
  const who = visitorCodeForDay(cfg.passSecret, ip, new Date().toISOString().slice(0, 10));
  if (alreadyVoted.has(round, who)) return json(409, { error: 'already_voted', round, number: roundNumber(round), pass });
  let coins, answer;
  try {
    coins = await activeSymbols(cfg);
    if (!coins.includes(coin)) coins = await activeSymbols(cfg, { fresh: true });
  } catch (err) {
    console.error('[vote] could not read the coin list:', err.message);
    return json(503, { error: err.code === 'not_ready' ? 'not_ready' : 'busy', pass });
  }
  if (!coins.includes(coin)) return json(400, { error: 'bad_coin', pass });

  // 5. Record it.
  try {
    answer = await arenaRpc(cfg, 'arena_vote', { p_round: round, p_who: who, p_coin: coin, p_coins: coins });
  } catch (err) {
    console.error('[vote] could not record:', err.message);
    return json(503, { error: err.code === 'not_ready' ? 'not_ready' : 'busy', pass });
  }
  if (answer === 'ok' || answer === 'already') alreadyVoted.add(round, who);
  if (answer === 'ok') return json(200, { ok: true, round, number: roundNumber(round), coin, pass });
  if (answer === 'already') return json(409, { error: 'already_voted', round, number: roundNumber(round), pass });
  return json(400, { error: 'bad_coin', pass });
}
