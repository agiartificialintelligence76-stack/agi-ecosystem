// /api/cloakmesh: CloakMesh's waitlist (inference.agi1.app, 2026-10-03; server/cloakmesh.js, supabase/cloakmesh.sql).
//   GET  /api/cloakmesh   { ready }: whether the waitlist is open (its settings, and supabase/cloakmesh.sql run). The same
//                         for everyone, shared by the CDN for a minute (the page asks once, to open its form)
//   POST /api/cloakmesh   JSON, one of:
//     { action: 'join', email, role: 'use' | 'build' | 'node', pass? | turnstileToken? } → { ok: true, leave } (their leave
//       link's code). The same answer whether or not the address was already on the list, so nobody can learn who joined
//     { action: 'leave', token } → { ok: true, removed } (the code from someone's leave link; no human check: the code is
//       the proof)
// Nothing here logs an email address, a leave code or an internet address.
import { getConfig } from '../server/config.js';
import { clientIp, visitorCode, visitorCodeForDay, makePass, checkPass } from '../server/security.js';
import { verifyHuman } from '../server/turnstile.js';
import { waitlistBurst } from '../server/burst.js';
import { ROLES, LEAVE_TOKEN, cloakmeshReady, checkEmail, cloakmeshDb } from '../server/cloakmesh.js';

const MAX_BODY = 2048;
const noStore = { 'Cache-Control': 'no-store' };
const json = (status, body, headers = noStore) => Response.json(body, { status, headers });
// whether it's open: the same for everyone, so the CDN shares one answer for a minute
const shared = { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' };

export async function GET(request) {
  const url = new URL(request.url);
  if ([...url.searchParams.keys()].length) return json(400, { error: 'bad_request' });
  const cfg = getConfig();
  if (!cloakmeshReady(cfg)) return json(200, { ready: false }, shared);
  try {
    return json(200, { ready: (await cloakmeshDb.ready(cfg)) === true }, shared);
  } catch (err) {
    if (err.code === 'PGRST202') return json(200, { ready: false }, shared);
    console.error('[cloakmesh] the database didn\'t answer:', err.message);
    return json(503, { error: 'busy' });
  }
}

export async function POST(request) {
  const cfg = getConfig();
  if (!cloakmeshReady(cfg)) {
    console.error('[cloakmesh] not set up: SUPABASE_URL, SUPABASE_SECRET_KEY, TURNSTILE_SECRET_KEY and PASS_SECRET (32+ characters) are needed');
    return json(503, { error: 'not_configured' });
  }
  if (!(request.headers.get('content-type') || '').includes('application/json')) return json(415, { error: 'bad_request' });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json(413, { error: 'too_long' });
  let body;
  try { body = JSON.parse(raw); } catch { return json(400, { error: 'bad_request' }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, { error: 'bad_request' });
  if (body.action === 'join') return join(cfg, request, body);
  if (body.action === 'leave') return leave(cfg, request, body);
  return json(400, { error: 'bad_request' });
}

async function join(cfg, request, body) {
  const e = checkEmail(body.email);
  if (!e.ok) return json(400, { error: 'email' });
  if (!ROLES.includes(body.role)) return json(400, { error: 'bad_request' });
  const ip = clientIp(request);
  const code = visitorCode(cfg.passSecret, ip);
  if (!waitlistBurst(code)) return json(429, { error: 'too_fast' });
  let pass = null;
  if (!checkPass(cfg.passSecret, body.pass, code)) {
    if (!(await verifyHuman(cfg, body.turnstileToken, ip, 'waitlist'))) return json(401, { error: 'human_check' });
    pass = makePass(cfg.passSecret, code);
  }
  const who = `w:${visitorCodeForDay(cfg.passSecret, ip, new Date().toISOString().slice(0, 10))}`;
  let r;
  try {
    r = await cloakmeshDb.join(cfg, { email: e.email, role: body.role, who });
  } catch (err) {
    if (err.code === 'PGRST202') {
      console.error('[cloakmesh]', err.message);
      return json(503, { error: 'not_ready', pass });
    }
    console.error('[cloakmesh] joining failed:', err.message);
    return json(503, { error: 'busy', pass });
  }
  if (r?.ok === true && LEAVE_TOKEN.test(String(r.token))) return json(200, { ok: true, leave: r.token, pass });
  if (r?.why === 'person_cap') return json(429, { error: 'person_cap', pass });
  if (r?.why === 'site_cap') {
    console.error('[cloakmesh] the waitlist\'s sign-ups for today are used up (WAITLIST.SITE_DAILY in server/cloakmesh.js)');
    return json(503, { error: 'site_cap', pass });
  }
  console.error('[cloakmesh] joining: an unexpected answer from the database');
  return json(503, { error: 'busy', pass });
}

async function leave(cfg, request, body) {
  const token = typeof body.token === 'string' ? body.token : '';
  if (!LEAVE_TOKEN.test(token)) return json(400, { error: 'bad_token' });
  if (!waitlistBurst(visitorCode(cfg.passSecret, clientIp(request)))) return json(429, { error: 'too_fast' });
  try {
    const r = await cloakmeshDb.leave(cfg, token);
    if (r?.ok !== true) return json(400, { error: 'bad_token' });
    return json(200, { ok: true, removed: r.removed === true });
  } catch (err) {
    if (err.code === 'PGRST202') {
      console.error('[cloakmesh]', err.message);
      return json(503, { error: 'not_ready' });
    }
    console.error('[cloakmesh] leaving failed:', err.message);
    return json(503, { error: 'busy' });
  }
}
