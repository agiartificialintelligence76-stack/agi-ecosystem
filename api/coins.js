// POST /api/coins { coin: "<clank.trade link or contract address>" }: vote to add a coin to the Arena, or nominate it
// (Phase 6). The board itself (the coins, the nominations and their votes) comes with GET /api/arena. In order:
//   1. speed bump: at most 10 requests a minute per visitor on this server copy
//   2. check the request (JSON, small, a clank.trade coin link or a contract address)
//   3. human check: the same 2-hour pass as the chat and the Arena, or a fresh Turnstile token (action "vote")
//   4. a vote for a coin that's already nominated goes straight to the database: one vote per visitor per coin per 7 days,
//      counted with a code made for that coin only (never the IP)
//   5. a new coin is checked first (server/coins.js: its clank.trade page, $5,000+ DEX liquidity, a ticker and name we can
//      show), then nominated with the nominator's vote as the first one. At most 2 nominations a day per visitor.
// A coin joins the Arena at 20 votes from different humans within 7 days: supabase/coins.sql decides that in one step.
import { getConfig } from '../server/config.js';
import { clientIp, visitorCode, visitorCodeForDay, coinVoterCode, makePass, checkPass } from '../server/security.js';
import { verifyHuman } from '../server/turnstile.js';
import { arenaRpc } from '../server/arena.js';
import { coinBurst as burst } from '../server/burst.js';
import { NEED, MAX_OTHERS, DAILY_NOMINATIONS, SITE_NOMINATIONS, MIN_LIQUIDITY, checkCoin } from '../server/coins.js';
import { parseCoinInput } from '../src/prices/parse.js';

const MAX_BODY = 2_000;
const json = (status, body) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

// what the database answered → HTTP status (normal outcomes are 200: the page shows each one in words)
const OUTCOMES = { ok: 200, already: 200, added: 200, waiting: 200, listed: 200 };
const REFUSALS = { hidden: [403, 'removed'], too_many: [429, 'too_many'], busy: [429, 'site_limit'], symbol_taken: [409, 'symbol_taken'] };
const CHECKS = { not_clank: 404, not_trading: 422, low_liquidity: 422, bad_symbol: 422, not_allowed: 422, unverified: 503 };

export function GET() {
  return json(405, { error: 'method_not_allowed' });
}

export async function POST(request) {
  const cfg = getConfig();
  const missing = ['supabaseUrl', 'supabaseKey', 'turnstileSecret'].filter((k) => !cfg[k]);
  if (missing.length || cfg.passSecret.length < 32) {
    console.error('[coins] missing settings:', [...missing, ...(cfg.passSecret.length < 32 ? ['passSecret'] : [])].join(', '));
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
  const address = parseCoinInput(body?.coin);
  if (!address) return json(400, { error: 'bad_link' });

  // 3. Human check.
  let pass = null;
  if (!checkPass(cfg.passSecret, body.pass, visitorCode(cfg.passSecret, ip))) {
    if (!(await verifyHuman(cfg, body.turnstileToken, ip, 'vote'))) return json(401, { error: 'human_check' });
    pass = makePass(cfg.passSecret, visitorCode(cfg.passSecret, ip));
  }

  const who = coinVoterCode(cfg.passSecret, ip, address);
  const answer = (r) => {
    if (OUTCOMES[r?.result]) {
      return json(200, { result: r.result, symbol: r.symbol, votes: r.votes ?? null, need: NEED, nominated: r.nominated === true, pass });
    }
    const [status, error] = REFUSALS[r?.result] || [503, 'busy'];
    return json(status, { error, symbol: r?.symbol ?? null, pass });
  };
  const failed = (err) => {
    console.error('[coins] database:', err.message);
    return json(503, { error: err.code === 'not_ready' ? 'not_ready' : 'busy', pass });
  };

  // 4. A coin the Arena already knows: this is a vote.
  let r;
  try {
    r = await arenaRpc(cfg, 'coin_vote', { p_address: address, p_who: who, p_need: NEED, p_max: MAX_OTHERS });
  } catch (err) {
    return failed(err);
  }
  if (r?.result !== 'unknown' && r?.result !== 'retired') return answer(r);

  // 5. A new coin (or one that left the Arena): check it, then nominate it.
  const check = await checkCoin(address);
  if (check.error) {
    if (check.error === 'unverified') console.warn(`[coins] couldn't check ${address} with ${check.source}`);
    return json(CHECKS[check.error] || 503, { error: check.error, liquidity: check.liquidity ?? null, min: MIN_LIQUIDITY, source: check.source ?? null, pass });
  }
  const { coin } = check;
  try {
    r = await arenaRpc(cfg, 'coin_nominate', {
      p_address: coin.address, p_symbol: coin.symbol, p_name: coin.name, p_logo: coin.logo,
      p_day: new Date().toISOString().slice(0, 10), p_day_who: visitorCodeForDay(cfg.passSecret, ip, new Date().toISOString().slice(0, 10)),
      p_who: who, p_need: NEED, p_max: MAX_OTHERS, p_daily: DAILY_NOMINATIONS, p_site: SITE_NOMINATIONS,
    });
  } catch (err) {
    return failed(err);
  }
  if (r?.result === 'ok' && r.nominated) console.log(`[coins] nominated $${coin.symbol} (${coin.address})`);
  return answer(r);
}
