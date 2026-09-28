// POST /api/wallet: connect a wallet and see your relationship level with AGI-1 (Phase 3).
// The wallet only ever signs a free plain-text message. This server never asks for a transaction or a token approval,
// and it only READS the $AGI balance (server/chain.js). Actions (JSON body { action, ... }):
//   start   { address, chainId }            → { message, ticket }      the exact text for the wallet to sign
//   finish  { message, ticket, signature }  → profile + session        proves the wallet is yours
//   profile { session }                     → profile (+ new session)  level re-checked at most every 30 minutes
//   name    { session, name }               → profile                  Crush and Soulmate: what AGI-1 calls you
//   forget  { session }                     → { ok }                   deletes everything stored for this wallet
import { getConfig } from '../server/config.js';
import { clientIp, visitorCode } from '../server/security.js';
import { startSignIn, finishSignIn } from '../server/signin.js';
import { makeSession, readSession, needsRecheck, walletCode, RECHECK_MS } from '../server/session.js';
import { checkLevel } from '../server/chain.js';
import { getFriend, setFriendName, forgetFriend, cleanName } from '../server/friends.js';
import { levelInfo } from '../src/lib/levels.js';

const MAX_BODY = 4000;
const RETRY_MS = 5 * 60 * 1000;          // if the balance couldn't be read, try again in about 5 minutes
const json = (status, body) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export function GET() {
  return json(405, { error: 'method_not_allowed' });
}

async function profile(cfg, { wallet, level, checkedAt, expiresAt }, checked = true) {
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
      const { level, checked } = await checkLevel(wallet);
      const checkedAt = checked ? now : now - RECHECK_MS + RETRY_MS;
      return json(200, await profile(cfg, { wallet, level, checkedAt }, checked));
    }

    case 'profile':
    case 'name':
    case 'forget': {
      const s = readSession(cfg.passSecret, body.session, now);
      if (!s) return json(401, { error: 'signed_out' });

      if (body.action === 'forget') {
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

      let { level, checkedAt } = s;
      let checked = true;
      if (needsRecheck(s, now)) {
        const r = await checkLevel(s.wallet, s.level);
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
      return json(200, await profile(cfg, { wallet: s.wallet, level, checkedAt, expiresAt: s.expiresAt }, checked));
    }

    default:
      return json(400, { error: 'bad_request' });
  }
}
