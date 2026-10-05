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
import { createHash, timingSafeEqual } from 'node:crypto';
import { getConfig } from '../server/config.js';
import { tgToken } from '../server/tg-api.js';
import { buyKey, checkBuys } from '../server/buys.js';

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

export async function GET(request) {
  if (new URL(request.url).search === '?buys') return buysCheck(request);
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
