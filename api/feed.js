// GET /api/feed: AGI-1 texts first (2026-09-29, the owner's idea). Vercel's cron calls it 8 times a day (vercel.json):
//   1. connects her Telegram bot to the site (server/telegram.js, connectBot: every run, so it fixes itself);
//   2. looks for new moments (server/feed.js, gatherMoments: new egirl coins and copies of $AGI on clank.trade, $AGI's
//      market moments, her diary's new entry);
//   3. (2026-10-03) posts her diary and $AGI's market moments in her Telegram groups, the ones found this run (server/
//      tg-groups.js, postToGroups: only the groups in TELEGRAM_GROUPS; TELEGRAM_GROUP_POSTS=off: none);
//   4. texts them to the people who asked for it on Telegram (textFirst: at most 2 a day each, never at night their time).
// Only Vercel may call it: when CRON_SECRET is set, Vercel sends "Authorization: Bearer <CRON_SECRET>" (like /api/keepalive).
// To run it by hand (e.g. right after setting the bot up): Vercel → the project → Settings → Cron Jobs → /api/feed → Run.
//
// GET /api/feed?buys (2026-10-06): the $AGI buy bot's check (server/buys.js), every minute, from Supabase Cron
// (supabase/buys.sql): only with the key that file made ("Authorization: Bearer <key>", read from the database). Here and
// not in a file of its own: Vercel's Hobby plan allows 12 functions, and they're all used. Since it runs every minute, it
// starts light: the feed's own code (her bot, the moments, the chain's code they load) is loaded only for the feed itself.
// GET /api/feed?games (2026-10-09): her quizzes in her Telegram groups (server/games.js), every 2 minutes, from Supabase
// Cron (supabase/games.sql), the same way with that file's own key: a quiz in each group whose turn it is, quizzes that
// closed without Telegram telling us, the tidy-up.
// GET /api/feed?studio (2026-10-10): AGI-1's 3D character studio's clock (server/studio.js), every minute, from Supabase
// Cron (supabase/studio.sql), with that file's own key: the characters being made, one step along each (Meshy's steps,
// then their files kept). Loaded only for it. (The same day) and AGI Studio's, the AI influencer app (server/inf-jobs.js):
// its looks, photos and videos being made, in the time left, and its tidy-up every half hour; and since its round 2 last
// week's spotlight picked once (server/inf-week.js), and, with 14 s left, one done video given the share mark for its
// downloads (server/inf-mark.js: ffmpeg, which vercel.json ships with this function only); since its round 4 (phase 2,
// 2026-10-11) the owner's and the team's alerts on Telegram (server/inf-admin.js), with 6 s left.
import { createHash, timingSafeEqual } from 'node:crypto';
import { getConfig } from '../server/config.js';
import { tgToken } from '../server/tg-api.js';
import { buyKey, checkBuys } from '../server/buys.js';
import { gameKey, gamesTick, gamesOn } from '../server/games.js';

const feedParts = () => Promise.all([import('../server/telegram.js'), import('../server/feed.js'), import('../server/tg-groups.js')]);

const fingerprint = (text) => createHash('sha256').update(String(text)).digest();
const sameSecret = (a, b) => timingSafeEqual(fingerprint(a), fingerprint(b));
const answer = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

// the buy bot's check: the key first (from the database), then clank.trade, then her groups
async function buysCheck(request) {
  const cfg = getConfig();
  if (!cfg.supabaseUrl || !cfg.supabaseKey) {
    console.error('[buys] SUPABASE_URL or SUPABASE_SECRET_KEY is missing');
    return answer({ error: 'not_configured' }, 503);
  }
  let key;
  try { key = await buyKey(cfg); } catch (err) {
    console.error(`[buys] couldn't read the buy bot's key: ${err.message}`);
    return answer({ error: err.code === 'PGRST202' ? 'not_set_up' : 'database' }, 503);
  }
  if (!key || !sameSecret(request.headers.get('authorization') || '', `Bearer ${key}`)) return answer({ error: 'unauthorized' }, 401);
  const now = Date.now();
  try {
    const out = await checkBuys(cfg, tgToken(), { now, deadline: now + 19_000 });
    if (out.posted || out.failed || out.skipped || out.stopped) {
      console.log(`[buys] ${out.buys} new $AGI buy(s): posted ${out.posted}, failed ${out.failed}, skipped ${out.skipped}${out.stopped ? `, stopped (${out.stopped})` : ''}`);
    }
    return answer({ ok: true, ...out });
  } catch (err) {
    console.warn(`[buys] couldn't check $AGI's buys: ${err.message}`);
    return answer({ error: 'unavailable' }, 502);
  }
}

// her quizzes' clock: the key first (from the database), then her groups
async function gamesCheck(request) {
  const cfg = getConfig();
  if (!cfg.supabaseUrl || !cfg.supabaseKey) {
    console.error('[games] SUPABASE_URL or SUPABASE_SECRET_KEY is missing');
    return answer({ error: 'not_configured' }, 503);
  }
  let key;
  try { key = await gameKey(cfg); } catch (err) {
    console.error(`[games] couldn't read the games' key: ${err.message}`);
    return answer({ error: err.code === 'PGRST202' ? 'not_set_up' : 'database' }, 503);
  }
  if (!key || !sameSecret(request.headers.get('authorization') || '', `Bearer ${key}`)) return answer({ error: 'unauthorized' }, 401);
  const token = tgToken();
  // off: TELEGRAM_GAMES=off, no group in TELEGRAM_GROUPS, or no bot (the clock keeps calling; nothing is read or posted)
  if (!gamesOn(cfg) || !token) return answer({ ok: true, off: !cfg.tgGames ? 'off' : !token ? 'no_bot' : 'no_groups' });
  const now = Date.now();
  try {
    const out = await gamesTick(cfg, token, { now, deadline: now + 19_000 });
    return answer({ ok: true, ...out });
  } catch (err) {
    console.warn(`[games] her quizzes' check stopped: ${err.message}`);
    return answer({ error: err.code === 'PGRST202' ? 'not_set_up' : 'database' }, 502);
  }
}

// the studio's clock: the key first (from the database), then the characters being made
async function studioCheck(request) {
  const cfg = getConfig();
  if (!cfg.supabaseUrl || !cfg.supabaseKey) {
    console.error('[studio] SUPABASE_URL or SUPABASE_SECRET_KEY is missing');
    return answer({ error: 'not_configured' }, 503);
  }
  const { studioKey, studioClock, studioOn } = await import('../server/studio.js');
  let key;
  try { key = await studioKey(cfg); } catch (err) {
    console.error(`[studio] couldn't read the studio's key: ${err.message}`);
    return answer({ error: err.code === 'PGRST202' ? 'not_set_up' : 'database' }, 503);
  }
  if (!key || !sameSecret(request.headers.get('authorization') || '', `Bearer ${key}`)) return answer({ error: 'unauthorized' }, 401);
  const { infOn, infClock } = await import('../server/inf-jobs.js');
  const meshy = studioOn(cfg), apps = infOn(cfg);
  if (!meshy && !apps) return answer({ ok: true, off: 'no_key' });       // MESHY_API_KEY and FAL_KEY not set: nothing to move along
  const now = Date.now();
  const deadline = now + 19_000;
  let out = { ok: true };
  if (meshy) {
    try {
      out = { ok: true, ...await studioClock(cfg, { now, deadline }) };
    } catch (err) {
      console.warn(`[studio] the clock stopped: ${err.message}`);
      return answer({ error: err.code === 'PGRST202' ? 'not_set_up' : 'database' }, 502);
    }
    // (2026-10-10) and its characters' videos, in the time left (only once FAL_KEY is set: server/studio-video.js)
    const { videosOn, videoClock } = await import('../server/studio-video.js');
    if (videosOn(cfg)) {
      try {
        out.videos = Date.now() < deadline - 5000 ? await videoClock(cfg, { now: Date.now(), deadline }) : { due: 0, moved: 0, done: 0, failed: 0, later: true };
      } catch (err) {
        console.warn(`[studio] the videos' clock stopped: ${err.message}`);
        out.videos = { error: err.code === 'PGRST202' ? 'not_set_up' : 'database' };
      }
    }
  }
  // (2026-10-10) and AGI Studio's looks, photos and videos, in the time left (once FAL_KEY is set and influencers.sql run)
  if (apps) {
    try {
      out.inf = Date.now() < deadline - 5000 ? await infClock(cfg, { now: Date.now(), deadline }) : { due: 0, moved: 0, done: 0, failed: 0, later: true };
    } catch (err) {
      if (err.code !== 'PGRST202' || !warnedApps) console.warn(`[studio] the studio app's clock stopped: ${err.message}`);
      if (err.code === 'PGRST202') warnedApps = true;
      if (!meshy) return answer({ error: err.code === 'PGRST202' ? 'not_set_up' : 'database' }, 502);
      out.inf = { error: err.code === 'PGRST202' ? 'not_set_up' : 'database' };
      return answer(out);
    }
    // (round 2) last week's spotlight, picked once (one small question; then nothing more this week in this server copy)
    try {
      const { weekClock } = await import('../server/inf-week.js');
      const w = await weekClock(cfg, { now });
      if (w) out.week = { status: w.status ?? null, again: w.again === true };
    } catch (err) {
      console.warn(`[studio] picking last week's spotlight: ${err.message}`);
    }
    // (round 2) and one done video given the share mark for its downloads, when there's time for it (14 s)
    if (deadline - Date.now() >= 14_000) {
      try {
        const { markClock } = await import('../server/inf-mark.js');
        out.mark = await markClock(cfg, { deadline });
      } catch (err) {
        console.warn(`[studio] the share mark: ${err.message}`);
      }
    }
    // (round 4, phase 2) the owner's and the team's alerts on Telegram, in the time left: new support tickets and reports (at
    // most every 5 minutes), and a balance under the owner's level (read at most every 30 minutes; each at most every 6 hours)
    if (deadline - Date.now() >= 6000) {
      try {
        const { adminClock } = await import('../server/inf-admin.js');
        const a = await adminClock(cfg, { now: Date.now(), deadline });
        if (a?.news || a?.low) out.alerts = { news: a.news, low: a.low };
      } catch (err) {
        if (err.code !== 'PGRST202' || !warnedAlerts) console.warn(`[studio] the alerts: ${err.message}`);
        if (err.code === 'PGRST202') warnedAlerts = true;
      }
    }
  }
  return answer(out);
}
let warnedApps = false, warnedAlerts = false;

export async function GET(request) {
  const search = new URL(request.url).search;
  if (search === '?buys') return buysCheck(request);
  if (search === '?games') return gamesCheck(request);
  if (search === '?studio') return studioCheck(request);
  const secret = process.env.CRON_SECRET || '';
  if (secret.length < 16) {
    console.error('[feed] CRON_SECRET is missing or shorter than 16 characters: add it in Vercel, then redeploy');
    return answer({ error: 'not_configured' }, 503);
  }
  if (!sameSecret(request.headers.get('authorization') || '', `Bearer ${secret}`)) return answer({ error: 'unauthorized' }, 401);

  const cfg = getConfig();
  if (!cfg.supabaseUrl || !cfg.supabaseKey || cfg.passSecret.length < 32) {
    console.error('[feed] SUPABASE_URL, SUPABASE_SECRET_KEY or PASS_SECRET is missing');
    return answer({ error: 'not_configured' }, 503);
  }
  const [{ connectBot }, { gatherMoments, textFirst }, { postToGroups }] = await feedParts();
  const now = Date.now();
  const deadline = now + 19_000;               // no new slow work after this: each call has its own timeout, all inside 25 s
  const token = tgToken();
  const out = { ok: true, telegram: Boolean(token) };

  if (token) {
    try { out.bot = await connectBot(cfg); } catch (err) {
      console.error(`[feed] couldn't connect the Telegram bot: ${err.message}${err.status === 401 || err.status === 404 ? ' (TELEGRAM_BOT_TOKEN is wrong: copy it again from @BotFather, then Redeploy)' : ''}`);
      out.bot = { error: err.status === 401 || err.status === 404 ? 'token' : 'telegram' };
    }
  } else if (process.env.TELEGRAM_BOT_TOKEN) {
    console.error("[feed] TELEGRAM_BOT_TOKEN doesn't look like a bot token (digits, a colon, then about 35 letters): copy it again from @BotFather");
  }

  let added;
  try {
    added = await gatherMoments(cfg, now, { deadline: deadline - 8_000 });
    out.moments = added.map((m) => m.key);
    if (added.length) console.log(`[feed] new: ${out.moments.join(', ')}`);
  } catch (err) {
    console.error(`[feed] couldn't use the feed's database: ${err.message}`);
    return answer({ error: 'database' }, 502);
  }

  // her Telegram groups: the moments found just now (so never twice), before the texts first (a handful of posts)
  if (token && !out.bot?.error && cfg.tgGroups) {
    out.groups = await postToGroups(cfg, token, added, { deadline: deadline - 4_000 });
    if (out.groups.posted) console.log(`[feed] posted ${out.groups.posted} in her Telegram groups`);
  }

  if (token && !out.bot?.error) {
    try {
      out.texts = await textFirst(cfg, token, now, { deadline });
      if (out.texts.sent || out.texts.gone) console.log(`[feed] texted ${out.texts.sent} (forgot ${out.texts.gone} who blocked her)`);
    } catch (err) {
      console.error(`[feed] texting stopped: ${err.message}`);
      out.texts = { error: 'database' };
    }
  }
  return answer(out);
}

export function POST() {
  return answer({ error: 'method_not_allowed' }, 405);
}
