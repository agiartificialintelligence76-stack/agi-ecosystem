// GET /api/feed: AGI-1 texts first (2026-09-29, the owner's idea). Vercel's cron calls it 8 times a day (vercel.json):
//   1. connects her Telegram bot to the site (server/telegram.js, connectBot: every run, so it fixes itself);
//   2. looks for new moments (server/feed.js, gatherMoments: new egirl coins and copies of $AGI on clank.trade, $AGI's
//      market moments, her diary's new entry);
//   3. (2026-10-03) posts her diary and $AGI's market moments in her Telegram groups, the ones found this run (server/
//      tg-groups.js, postToGroups: only the groups in TELEGRAM_GROUPS; TELEGRAM_GROUP_POSTS=off: none);
//   4. texts them to the people who asked for it on Telegram (textFirst: at most 2 a day each, never at night their time).
// Only Vercel may call it: when CRON_SECRET is set, Vercel sends "Authorization: Bearer <CRON_SECRET>" (like /api/keepalive).
// To run it by hand (e.g. right after setting the bot up): Vercel → the project → Settings → Cron Jobs → /api/feed → Run.
import { createHash, timingSafeEqual } from 'node:crypto';
import { getConfig } from '../server/config.js';
import { tgToken, connectBot } from '../server/telegram.js';
import { gatherMoments, textFirst } from '../server/feed.js';
import { postToGroups } from '../server/tg-groups.js';

const fingerprint = (text) => createHash('sha256').update(String(text)).digest();
const sameSecret = (a, b) => timingSafeEqual(fingerprint(a), fingerprint(b));
const answer = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request) {
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
