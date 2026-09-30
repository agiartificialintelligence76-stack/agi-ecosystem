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
import { getConfig } from '../server/config.js';
import { clientIp, visitorCode } from '../server/security.js';
import { startSignIn, finishSignIn } from '../server/signin.js';
import { makeSession, readSession, needsRecheck, walletCode, RECHECK_MS } from '../server/session.js';
import { checkLevel } from '../server/chain.js';
import { getFriend, setFriendName, forgetFriend, cleanName } from '../server/friends.js';
import { txFrom, checkBurns, burnStatus, burnTotal, BURN_PER_DAY } from '../server/burn.js';
import { burnBurst } from '../server/burst.js';
import { levelInfo } from '../src/lib/levels.js';

const MAX_BODY = 4000;
const RETRY_MS = 5 * 60 * 1000;          // if the balance couldn't be read, try again in about 5 minutes
const json = (status, body, headers = { 'Cache-Control': 'no-store' }) => Response.json(body, { status, headers });

// The price and the public counter: exactly one address (anything else is 405, so nobody can make the CDN miss on purpose)
export async function GET(request) {
  if (!request || new URL(request.url).search !== '?burns') return json(405, { error: 'method_not_allowed' });
  const cfg = getConfig();
  const shared = { 'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=120' };
  if (!cfg.supabaseUrl || !cfg.supabaseKey) return json(200, { ready: false }, shared);
  try {
    return json(200, { ready: true, price: cfg.burnPrice, perDay: BURN_PER_DAY, total: await burnTotal(cfg) }, shared);
  } catch (err) {
    if (err.code === 'PGRST202') return json(200, { ready: false }, shared);   // burns.sql isn't run yet
    console.error('[wallet] the burn counter is unavailable:', err.message);
    return json(503, { error: 'busy' });
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
  if (raw.length > MAX_BODY) return json(413, { error: 'bad_request' });
  let body;
  try { body = JSON.parse(raw); } catch { return json(400, { error: 'bad_request' }); }
  if (!body || typeof body !== 'object') return json(400, { error: 'bad_request' });

  const origin = new URL(request.url).origin;
  const visitor = visitorCode(cfg.passSecret, clientIp(request));
  const now = Date.now();

  switch (body.action) {
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
