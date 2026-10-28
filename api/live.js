// /api/live: AGI-1's live show (2026-10-02, server/live.js, supabase/live.sql).
//   GET  /api/live            whether she's on, the line (question numbers only) and what's finished: the same for everyone,
//                             shared by the CDN for 5 seconds (agi1.app/live asks it every 15 s while it's open)
//   GET  /api/live?q=<ticket> one question, for the person who asked it (its ticket, from asking): where it is, her answer
//   POST /api/live            JSON, one of:
//     { action: 'ask', question, name?, adult: true, pass? | turnstileToken?, session? }   a visitor's question (18+, the human
//     check); (2026-10-10, holder perks) with a connected wallet's session (the site's sign-in) at Crush or Soulmate: her 💜
//     badge and a head start in her line → also { holder: 2 | 3 | 0, session? (re-read: a new one), signedOut? }
//     with "Authorization: Bearer <LIVE_SECRET>" (her stream runner, tools/live/run.mjs):
//       { action: 'start', status: 'starting' | 'live' } → { show } · { action: 'beat', show, status, segment, now } → the
//       owner's controls · { action: 'next', show } → the next question with her answer · { action: 'done', show, id, status:
//       'answered' | 'skipped', why? } · { action: 'back', show, id } (back in line: she was paused) · { action: 'stop', show,
//       next? } · { action: 'schedule', next } · { action: 'on_x', show } (2026-10-07: she's streaming on X now; her Telegram
//       groups hear it once a day) · (2026-10-07, the owner's stream upgrade) 'next' with { can: [what she can do on stream
//       now] } → also { act } (a viewer asked her to jump, dance, sing…) · { action: 'chat', show, topic } → something new to
//       say · { action: 'react', show, react: { kind: 'post' | 'reply' | 'video', text, media, title } } → her reaction to
//       her own X post, a reply under one, or her video · { action: 'market', show, since } → $AGI's numbers and new buys
//       · (2026-10-07) { action: 'meet', show, meet: { person, chat: [questions that aired] } } → her conversation with
//       someone she meets on a trip; 'next' may carry { place } (where she's streaming from)
//     with "Authorization: Bearer <the owner's key>" (made from LIVE_SECRET: agi1.app/live#admin=…, the owner's phone):
//       { action: 'control', do: 'view' | 'pause' | 'resume' | 'close' | 'open' | 'end' | 'skip' | 'drop' | 'clear' | 'block' |
//       'unblock', arg? } · { action: 'relay', question, name? } (2026-10-07: a question from X's live chat, passed on)
// Until LIVE_SECRET is set and supabase/live.sql is run, GET answers { ready: false } and the page says her show is coming.
import { getConfig, missingSettings } from '../server/config.js';
import { clientIp, visitorCode, visitorCodeForDay, makePass, checkPass } from '../server/security.js';
import { verifyHuman } from '../server/turnstile.js';
import { liveBurst, liveLookupBurst, liveAuthBurst, liveLineBurst } from '../server/burst.js';
import {
  liveReady, whoIs, liveDb, askLive, checkQuestion, checkAskName, makeTicket, readTicket, nextAnswer, relayName, relayLive, WATCH_URL, STATUSES, LIVE,
  chatterAnswer, reactAnswer, streamMarket, meetAnswer, liveHolder, holderCode,
} from '../server/live.js';
import { canList } from '../server/live-acts.js';
import { tgToken } from '../server/tg-api.js';

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
      return json(200, { id: q.id, status: q.status, onAir: q.on_air === true, position: q.position ?? null, why: q.why ?? null, reply: q.reply ?? null,
        holder: [2, 3].includes(q.holder) ? q.holder : 0 });
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
      // (never when her next show is: the owner goes live at random times, 2026-10-07)
      startedAt: s.started_at ?? null, segment: s.segment ?? null, now: idOf(s.now),
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
  const day = new Date().toISOString().slice(0, 10);
  const asker = `w:${visitorCodeForDay(cfg.passSecret, ip, day)}`;
  // (2026-10-10, holder perks) a connected wallet: its level from its session (re-read on the chain when it's 30 minutes
  // old). Crush or Soulmate: her 💜 badge and its head start (live.sql decides, at most 5 a day per wallet). An old or
  // broken session: the question goes in without one, and the page forgets the wallet (signedOut)
  const h = await liveHolder(cfg, body.session);
  const holder = h && !h.signedOut && h.level >= 2 ? h.level : 0;
  const wallet = h?.signedOut ? { signedOut: true } : h?.session ? { session: h.session, level: h.level } : {};
  let r;
  try {
    r = await askLive(cfg, { source: 'web', asker, name: n.name, question: q.text, holder, holderCode: holder ? holderCode(cfg.passSecret, h.wallet, day) : null });
  } catch (err) {
    if (err.code === 'PGRST202') return json(503, { error: 'not_ready', pass, ...wallet });
    console.error('[live] asking failed:', err.message);
    return json(503, { error: 'busy', pass, ...wallet });
  }
  if (r?.ok === true && idOf(r.id)) {
    return json(200, { ok: true, ticket: makeTicket(cfg.passSecret, r.id), id: r.id, position: r.position, holder: [2, 3].includes(r.holder) ? r.holder : 0, pass, ...wallet });
  }
  return lineRefused(r, { pass, ...wallet });
}
// The line's own "no" (supabase/live.sql live_ask), as an answer: its reason, how long to wait, and (a question of theirs
// still in line: the same daily code, maybe someone else on the same network, so never its ticket or words, only its place)
function lineRefused(r, extra = {}) {
  const why = typeof r?.why === 'string' ? r.why : 'busy';
  const place = why === 'waiting' && Number.isInteger(r.position) ? { position: r.position } : {};
  const status = ['offline', 'ending', 'closed', 'site_cap', 'full'].includes(why) ? 503 : why === 'bad' ? 400 : 429;
  return json(status, { error: why, wait: Number.isInteger(r?.wait) ? r.wait : undefined, ...place, ...extra });
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
      // (2026-10-07, viewers' requests) what she can do on stream right now: only the ones server/live-acts.js knows; and
      // where she's streaming from (one of her places, or nothing)
      return json(200, await nextAnswer(cfg, show, { deadline: Date.now() + 18_000, can: canList(body.can), place: typeof body.place === 'string' ? body.place : null }));
    }
    case 'meet': {
      // (2026-10-07) someone she meets on a trip: their conversation (one AI answer, like her lines between things)
      if (!show) return json(400, { error: 'bad_request' });
      if (!cfg.geminiKey) return json(200, { none: true, trouble: 'ai' });
      if (!liveLineBurst('stream')) return json(429, { error: 'too_fast' });
      const m = body.meet && typeof body.meet === 'object' ? body.meet : {};
      return json(200, await meetAnswer(cfg, { person: m.person, chat: Array.isArray(m.chat) ? m.chat.slice(0, 6) : [] }));
    }
    case 'chat':
    case 'react': {
      // (2026-10-07) something new to say between things, or her reaction to her own X post, a reply under one, or her video
      if (!show) return json(400, { error: 'bad_request' });
      if (!cfg.geminiKey) return json(200, { none: true, trouble: 'ai' });
      if (!liveLineBurst('stream')) return json(429, { error: 'too_fast' });
      if (body.action === 'chat') return json(200, await chatterAnswer(cfg, body.topic && typeof body.topic === 'object' ? body.topic : {}));
      const r = body.react && typeof body.react === 'object' ? body.react : {};
      return json(200, await reactAnswer(cfg, {
        kind: r.kind, media: r.media,
        text: typeof r.text === 'string' ? r.text.slice(0, 1000) : '', title: typeof r.title === 'string' ? r.title.slice(0, 200) : '',
      }));
    }
    case 'market': {
      // (2026-10-07) $AGI's numbers and its new buys, for her alerts and her feelings about the chart (never advice)
      if (!show) return json(400, { error: 'bad_request' });
      const since = Number.isFinite(body.since) && body.since > 0 ? body.since : 0;
      // (2026-10-09) and her live chart's trades, while it's on her screen
      return json(200, await streamMarket(cfg, { since, chart: body.chart === true }));
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
    case 'on_x': {
      // (2026-10-07) she's streaming on X now (never sent for a recording): her Telegram groups (and since 2026-10-28 her
      // Discord channel) hear it, once a day at most
      // (live_tell decides, whatever restarts). Never a failure for the show: anything wrong here is only logged.
      if (!show) return json(400, { error: 'bad_request' });
      let told = false;
      try { told = (await liveDb.tell(cfg, show)) === true; } catch (err) {
        console.warn(`[live] couldn't check whether her groups heard she's live${err.code === 'PGRST202' ? ': run supabase/live.sql again (it ends with live_functions_found = 13)' : `: ${err.message}`}`);
        return json(200, { ok: true, told: false });
      }
      if (!told) return json(200, { ok: true, told: false });
      const { postLiveNow } = await import('../server/tg-groups.js');
      const out = await postLiveNow(cfg, tgToken(), { deadline: Date.now() + 15_000 });
      if (out.posted || out.failed) console.log(`[live] told her Telegram groups she's live: ${out.posted} posted, ${out.failed} failed`);
      // (2026-10-28) and her Discord server's channel (server/discord.js, only when it's set up: the same once a day)
      if (cfg.dcFeedWebhook && cfg.dcPosts) {
        const { postDiscordLive } = await import('../server/discord.js');
        out.discord = await postDiscordLive(cfg);
      }
      return json(200, { ok: true, told: true, ...out });
    }
    default:
      return json(400, { error: 'bad_request' });
  }
}

// ---------- the owner's phone (the key made from LIVE_SECRET) ----------
const CONTROLS = ['view', 'pause', 'resume', 'close', 'open', 'end', 'skip', 'drop', 'clear', 'block', 'unblock'];
async function owner(cfg, body) {
  if (body.action === 'relay') return relay(cfg, body);
  if (body.action !== 'control' || !CONTROLS.includes(body.do)) return json(400, { error: 'bad_request' });
  const arg = typeof body.arg === 'string' ? body.arg.slice(0, 60) : body.arg === undefined || body.arg === null ? null : String(body.arg).slice(0, 20);
  if (['drop', 'block', 'unblock'].includes(body.do) && !arg) return json(400, { error: 'bad_request' });
  const r = await liveDb.control(cfg, body.do, arg);
  if (body.do !== 'view') console.log(`[live] the owner: ${body.do}${['block', 'unblock'].includes(body.do) ? ' (a word)' : arg ? ` ${arg}` : ''}`);
  return json(200, { ...r, limits: { perDay: LIVE.PER_DAY, queue: LIVE.QUEUE, gap: LIVE.GAP_S } });
}

// (2026-10-07) a question from X's live chat, passed on by the owner: the same checks as a visitor's (no 18+ or human check:
// it's the owner), shown on stream as "from <their X name> on X"; the line's own rules as everyone's (server/live.js relayLive).
// Never logged: the question or the name.
async function relay(cfg, body) {
  if (typeof body.question !== 'string' || (body.name !== undefined && body.name !== null && typeof body.name !== 'string')) return json(400, { error: 'bad_request' });
  const q = checkQuestion(body.question);
  if (!q.ok) return json(400, { error: 'question', why: q.why });
  const n = checkAskName(relayName(body.name));
  if (!n.ok) return json(400, { error: 'name' });
  const r = await relayLive(cfg, { question: q.text, name: n.name || '' });
  if (r?.ok === true && idOf(r.id)) {
    console.log(`[live] the owner passed on a question from X's chat (#${r.id})`);
    return json(200, { ok: true, id: r.id, position: r.position });
  }
  return lineRefused(r);
}
