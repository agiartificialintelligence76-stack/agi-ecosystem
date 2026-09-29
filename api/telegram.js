// POST /api/telegram: the webhook of AGI-1's Telegram bot (2026-09-29, "she texts first"). Telegram sends every message and
// button tap people send her bot here, with our secret in the X-Telegram-Bot-Api-Secret-Token header (set by /api/feed,
// server/telegram.js connectBot). Anything without it is refused, so nobody else can make her talk.
// She answers right here (server/telegram.js, handleUpdate). The answer to Telegram is always 200 once the secret matched,
// even if something failed (she says so in the chat when she can), so Telegram doesn't send the same update again.
import { getConfig } from '../server/config.js';
import { tgToken, webhookSecret, sameSecret, handleUpdate, say } from '../server/telegram.js';
import { BUSY } from '../server/tg-lines.js';

const MAX_BODY = 65_536;
const json = (status, body = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request) {
  const cfg = getConfig();
  const token = tgToken();
  if (!token || cfg.passSecret.length < 32 || !cfg.supabaseUrl || !cfg.supabaseKey) {
    console.error('[telegram] not configured: TELEGRAM_BOT_TOKEN, PASS_SECRET, SUPABASE_URL and SUPABASE_SECRET_KEY are needed');
    return json(503, { error: 'not_configured' });
  }
  if (!sameSecret(request.headers.get('x-telegram-bot-api-secret-token') || '', webhookSecret(cfg.passSecret))) {
    return json(401, { error: 'unauthorized' });
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json(200, { ok: true, ignored: 'too_big' });
  let update;
  try { update = JSON.parse(raw); } catch { return json(200, { ok: true, ignored: 'not_json' }); }
  if (!update || typeof update !== 'object') return json(200, { ok: true, ignored: 'not_json' });

  try {
    const what = await handleUpdate(cfg, token, update);
    return json(200, { ok: true, what });
  } catch (err) {
    console.error(`[telegram] couldn't answer: ${err.message}`);
    const chat = update.message?.chat?.id ?? update.callback_query?.message?.chat?.id;
    const privateChat = (update.message?.chat?.type ?? update.callback_query?.message?.chat?.type) === 'private';
    if (privateChat && Number.isSafeInteger(chat) && chat > 0) await say(token, chat, BUSY).catch(() => {});
    return json(200, { ok: true, what: 'error' });
  }
}

export function GET() {
  return json(405, { error: 'method_not_allowed' });
}
