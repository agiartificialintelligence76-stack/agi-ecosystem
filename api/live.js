// /api/live: AGI-1's live show (2026-10-02, server/live.js, supabase/live.sql).
//   GET  /api/live            whether she's on, the line (question numbers only) and what's finished: the same for everyone,
//                             shared by the CDN for 5 seconds (agi1.app/live asks it every 15 s while it's open)
//   GET  /api/live?q=<ticket> one question, for the person who asked it (its ticket, from asking): where it is, her answer
//   POST /api/live            JSON, one of:
//     { action: 'ask', question, name?, adult: true, pass? | turnstileToken? }   a visitor's question (18+, the human check)
//     with "Authorization: Bearer <LIVE_SECRET>" (her stream runner, tools/live/run.mjs):
//       { action: 'start', status: 'starting' | 'live' } → { show } · { action: 'beat', show, status, segment, now } → the
//       owner's controls · { action: 'next', show } → the next question with her answer · { action: 'done', show, id, status:
//       'answered' | 'skipped', why? } · { action: 'back', show, id } (back in line: she was paused) · { action: 'stop', show,
//       next? } · { action: 'schedule', next }
//     with "Authorization: Bearer <the owner's key>" (made from LIVE_SECRET: agi1.app/live#admin=…, the owner's phone):
//       { action: 'control', do: 'view' | 'pause' | 'resume' | 'close' | 'open' | 'end' | 'skip' | 'drop' | 'clear' | 'block' |
//       'unblock', arg? }
// Until LIVE_SECRET is set and supabase/live.sql is run, GET answers { ready: false } and the page says her show is coming.
import { getConfig, missingSettings } from '../server/config.js';
import { clientIp, visitorCode, visitorCodeForDay, makePass, checkPass } from '../server/security.js';
import { verifyHuman } from '../server/turnstile.js';
import { liveBurst, liveLookupBurst, liveAuthBurst } from '../server/burst.js';
import {
  liveReady, whoIs, liveDb, askLive, checkQuestion, checkAskName, makeTicket, readTicket, nextAnswer, WATCH_URL, STATUSES, LIVE,
} from '../server/live.js';

const MAX_BODY = 4096;
const noStore = { 'Cache-Control': 'no-store' };
const json = (status, body, headers = noStore) => Response.json(body, { status, headers });
// (her status: the same for everyone, so the CDN shares one answer for 5 seconds)
const shared = { 'Cache-Control': 'public, max-age=5, s-maxage=5, stale-while-revalidate=10' };
const idOf = (v) => (Number.isSafeInteger(v) && v > 0 ? v : null);
const timeOf = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const t = Date.parse(String(v));
  return Number.isFinite(t) && t > Date.now() - 60_000 && t < Date.now() + 400 * 86_400_000 ? t : NaN;
};

export async function GET(request) {
  const cfg = getConfig();
  const url = new URL(request.url);
  const keys = [...url.searchParams.keys()];
  if (keys.some((k) => k !== 'q') || keys.length > 1) return json(400, { error: 'bad_request' });
  if (!liveReady(cfg)) return json(200, { ready: false }, shared);

  if (url.searchParams.has('q')) {
    const id = readTicket(cfg.passSecret, url.searchParams.get('q'));
    if (!id) return json(400, { error: 'bad_ticket' });
    if (!liveLookupBurst(visitorCode(cfg.passSecret, clientIp(request)))) return json(429, { error: 'too_fast' });
    try {
      const q = await liveDb.lookup(cfg, id);
      if (!q) return json(404, { error: 'gone' });
      return json(200, { id: q.id, status: q.status, onAir: q.on_air === true, position: q.position ?? null, why: q.why ?? null, reply: q.reply ?? null });
    } catch (err) {
      if (err.code === 'PGRST202') return json(200, { ready: false });
      console.error('[live] lookup failed:', err.message);
      return json(503, { error: 'busy' });
    }
  }

  try {
    const s = await liveDb.state(cfg);
    return json(200, {
      ready: true, on: s.on === true, status: STATUSES.includes(s.status) ? s.status : 'off', show: s.show,
      startedAt: s.started_at ?? null, nextAt: s.next_at ?? null, segment: s.segment ?? null, now: idOf(s.now),
      paused: s.paused === true, closed: s.closed === true,
      waiting: Array.isArray(s.waiting) ? s.waiting.filter(idOf) : [], done: s.done && typeof s.done === 'object' ? s.done : {},
      watch: WATCH_URL,
    }, shared);
  } catch (err) {
    if (err.code === 'PGRST202') return json(200, { ready: false }, shared);
    console.error('[live] status unavailable:', err.message);
    return json(503, { error: 'busy' });
  }
}

export async function POST(request) {
  const cfg = getConfig();
  if (!liveReady(cfg)) {
    console.error('[live] not set up: LIVE_SECRET (32+ characters), SUPABASE_URL, SUPABASE_SECRET_KEY and PASS_SECRET are needed');
    return json(503, { error: 'not_configured' });
  }
  if (!(request.headers.get('content-type') || '').includes('application/json')) return json(415, { error: 'bad_request' });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json(413, { error: 'too_long' });
  let body;
  try { body = JSON.parse(raw); } catch { return json(400, { error: 'bad_request' }); }
  if (!body || typeof body !== 'object' || typeof body.action !== 'string') return json(400, { error: 'bad_request' });

  const auth = request.headers.get('authorization');
  if (auth) {
    const who = whoIs(auth, cfg.liveSecret);
    if (!who) {
      if (!liveAuthBurst(visitorCode(cfg.passSecret, clientIp(request)))) return json(429, { error: 'too_fast' });
      return json(401, { error: 'unauthorized' });
    }
    try {
      return who === 'runner' ? await runner(cfg, body) : await owner(cfg, body);
    } catch (err) {
      if (err.code === 'PGRST202') {
        console.error('[live]', err.message);
        return json(503, { error: 'not_ready' });
      }
      console.error(`[live] ${who} ${body.action} failed:`, err.message);
      return json(503, { error: 'busy' });
    }
  }
  if (body.action === 'ask') return ask(cfg, request, body);
  return json(400, { error: 'bad_request' });
}

// ---------- a visitor's question (agi1.app/live) ----------
async function ask(cfg, request, body) {
  const missing = missingSettings(cfg).filter((m) => m !== 'GEMINI_API_KEY');
  if (missing.length) {
    console.error('[live] missing settings:', missing.join(', '));
    return json(503, { error: 'not_configured' });
  }
  if (body.adult !== true) return json(403, { error: 'age' });
  const q = checkQuestion(typeof body.question === 'string' ? body.question : '');
  if (!q.ok) return json(400, { error: 'question', why: q.why });
  const n = checkAskName(typeof body.name === 'string' ? body.name : '');
  if (!n.ok) return json(400, { error: 'name' });
  const ip = clientIp(request);
  const code = visitorCode(cfg.passSecret, ip);
  if (!liveBurst(code)) return json(429, { error: 'too_fast' });
  let pass = null;
  if (!checkPass(cfg.passSecret, body.pass, code)) {
    if (!(await verifyHuman(cfg, body.turnstileToken, ip, 'live'))) return json(401, { error: 'human_check' });
    pass = makePass(cfg.passSecret, code);
  }
  const asker = `w:${visitorCodeForDay(cfg.passSecret, ip, new Date().toISOString().slice(0, 10))}`;
  let r;
  try {
    r = await askLive(cfg, { source: 'web', asker, name: n.name, question: q.text });
  } catch (err) {
    if (err.code === 'PGRST202') return json(503, { error: 'not_ready', pass });
    console.error('[live] asking failed:', err.message);
    return json(503, { error: 'busy', pass });
  }
  if (r?.ok === true && idOf(r.id)) {
    return json(200, { ok: true, ticket: makeTicket(cfg.passSecret, r.id), id: r.id, position: r.position, pass });
  }
  const why = typeof r?.why === 'string' ? r.why : 'busy';
  // a question of theirs is still in line (the same daily code: maybe someone else on the same network, so never its
  // ticket or words here, only its place)
  const extra = why === 'waiting' && Number.isInteger(r.position) ? { position: r.position } : {};
  const status = ['offline', 'ending', 'closed', 'site_cap', 'full'].includes(why) ? 503 : why === 'bad' ? 400 : 429;
  return json(status, { error: why, wait: Number.isInteger(r?.wait) ? r.wait : undefined, ...extra, pass });
}

// ---------- her stream runner (LIVE_SECRET) ----------
async function runner(cfg, body) {
  const show = idOf(body.show);
  switch (body.action) {
    case 'start': {
      if (!['starting', 'live'].includes(body.status)) return json(400, { error: 'bad_request' });
      const r = await liveDb.start(cfg, body.status);
      console.log(`[live] show ${r?.show} started (${body.status})`);
      return json(200, r);
    }
    case 'beat': {
      if (!show || !['starting', 'live', 'brb', 'ending'].includes(body.status)) return json(400, { error: 'bad_request' });
      const segment = typeof body.segment === 'string' ? body.segment.slice(0, 60) : null;
      return json(200, await liveDb.beat(cfg, show, body.status, segment, idOf(body.now)));
    }
    case 'next': {
      if (!show) return json(400, { error: 'bad_request' });
      if (!cfg.geminiKey) {
        console.error('[live] GEMINI_API_KEY is missing: she can\'t answer questions');
        return json(200, { none: true, trouble: 'ai' });
      }
      return json(200, await nextAnswer(cfg, show, { deadline: Date.now() + 18_000 }));
    }
    case 'back': {
      // a question she had ready when the owner paused her: back in line, so it's answered fresh after the break
      const id = idOf(body.id);
      if (!show || !id) return json(400, { error: 'bad_request' });
      return json(200, await liveDb.done(cfg, id, 'waiting'));
    }
    case 'done': {
      const id = idOf(body.id);
      if (!show || !id || !['answered', 'skipped'].includes(body.status)) return json(400, { error: 'bad_request' });
      const why = body.status === 'skipped' ? (['owner', 'ended', 'error', 'rules'].includes(body.why) ? body.why : 'error') : null;
      return json(200, await liveDb.done(cfg, id, body.status, { why }));
    }
    case 'stop': {
      const next = timeOf(body.next);
      if (!show || Number.isNaN(next)) return json(400, { error: 'bad_request' });
      const r = await liveDb.stop(cfg, show, next);
      console.log(`[live] show ${show} ended`);
      return json(200, r);
    }
    case 'schedule': {
      const next = timeOf(body.next);
      if (Number.isNaN(next)) return json(400, { error: 'bad_request' });
      return json(200, await liveDb.schedule(cfg, next));
    }
    default:
      return json(400, { error: 'bad_request' });
  }
}

// ---------- the owner's phone (the key made from LIVE_SECRET) ----------
const CONTROLS = ['view', 'pause', 'resume', 'close', 'open', 'end', 'skip', 'drop', 'clear', 'block', 'unblock'];
async function owner(cfg, body) {
  if (body.action !== 'control' || !CONTROLS.includes(body.do)) return json(400, { error: 'bad_request' });
  const arg = typeof body.arg === 'string' ? body.arg.slice(0, 60) : body.arg === undefined || body.arg === null ? null : String(body.arg).slice(0, 20);
  if (['drop', 'block', 'unblock'].includes(body.do) && !arg) return json(400, { error: 'bad_request' });
  const r = await liveDb.control(cfg, body.do, arg);
  if (body.do !== 'view') console.log(`[live] the owner: ${body.do}${['block', 'unblock'].includes(body.do) ? ' (a word)' : arg ? ` ${arg}` : ''}`);
  return json(200, { ...r, limits: { perDay: LIVE.PER_DAY, queue: LIVE.QUEUE, gap: LIVE.GAP_S } });
}
