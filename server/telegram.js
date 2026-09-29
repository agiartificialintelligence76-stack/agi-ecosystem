// AGI-1 on Telegram (2026-09-29, the owner's idea: "make her the one who texts first"). A Telegram bot, run from our
// server with Telegram's free Bot API. Its token lives only in Vercel (TELEGRAM_BOT_TOKEN, secret): the browser never sees
// it, and every call to Telegram comes from here.
//   • api/telegram.js: Telegram sends us every message and button tap people send her bot (a "webhook", signed with a
//     secret made from PASS_SECRET); handleUpdate() below answers: /start, the 18+ check, their time, /stop, and her replies
//     (the same Gemini chat as the site, as a Stranger, with the same daily limits).
//   • api/feed.js (a few times a day, Vercel's cron): connectBot() points the bot at the site, then server/feed.js decides
//     what she texts first and sends it (gatherMoments(), textFirst()).
// What's kept: supabase/telegram.sql (the chat's number, 18+, their time, what she last texted them). Never their messages.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { rpc, takeChatSlot } from './limits.js';
import { askAgi1 } from './gemini.js';
import { recallGroup } from './tg-memory.js';
import { levelInfo } from '../src/lib/levels.js';
import { telegramBurst } from './burst.js';
import { tgLinesFor, TEXTS_A_DAY } from './tg-lines.js';
import { fromTelegram } from '../src/i18n/langs.js';

const API = 'https://api.telegram.org/bot';
const MAX_TEXT = 500;                       // characters per message she reads (the same as the site's chat)
const TOKEN = /^\d{5,15}:[A-Za-z0-9_-]{30,60}$/;

// The bot's token (BotFather gives it), or '' when it isn't set or doesn't look like one
export const tgToken = (env = process.env) => (TOKEN.test(String(env.TELEGRAM_BOT_TOKEN || '').trim()) ? String(env.TELEGRAM_BOT_TOKEN).trim() : '');

// The secret Telegram sends back with every update (X-Telegram-Bot-Api-Secret-Token), so only Telegram can talk to
// /api/telegram. Made from PASS_SECRET: no extra setting. Letters, numbers, "_" and "-", as Telegram wants.
export const webhookSecret = (passSecret) => createHmac('sha256', `${passSecret}`).update('telegram-webhook').digest('base64url').slice(0, 48);
const fingerprint = (text) => createHash('sha256').update(String(text)).digest();
export const sameSecret = (a, b) => timingSafeEqual(fingerprint(a), fingerprint(b));     // same time whatever was sent

// Where Telegram sends the updates: the site's production address (like the link previews'), + /api/telegram
export function webhookUrl(env = process.env) {
  const raw = env.SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://agi1.app');
  const base = String(raw).trim().replace(/\/+$/, '');
  return /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i.test(base) ? `${base}/api/telegram` : null;
}

// A daily code for one Telegram chat's message limits (like the site's daily visitor code): never the chat's number itself
const b64url = (buf) => Buffer.from(buf).toString('base64url');
export const chatCode = (secret, chat, day) => `t:${b64url(createHmac('sha256', secret).update(`tg:${day}:${chat}`).digest()).slice(0, 32)}`;

// Telegram's answers can quote the token back (in an address): never in a log line
const scrub = (text, token) => {
  let s = String(text ?? '');
  if (token) s = s.split(token).join('[token]');
  return s.replace(/\d{5,15}:[A-Za-z0-9_-]{30,60}/g, '[token]').replace(/\s+/g, ' ').trim().slice(0, 200);
};

// One Bot API call. → its result · throws an error with .status, .retryAfter (seconds, when Telegram says "too many") and
// .gone (the person blocked the bot or deleted their account, or the chat doesn't exist: forget them)
export async function tgCall(token, method, params = {}, { timeoutMs = 5000 } = {}) {
  const res = await fetch(`${API}${token}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params), signal: AbortSignal.timeout(timeoutMs),
  });
  let body = null;
  try { body = await res.json(); } catch { /* not JSON */ }
  if (res.ok && body?.ok === true) return body.result;
  const said = scrub(body?.description, token);
  const err = new Error(`telegram ${method}: HTTP ${res.status}${said ? ` (${said})` : ''}`);
  err.status = res.status;
  err.retryAfter = Number(body?.parameters?.retry_after) > 0 ? Number(body.parameters.retry_after) : null;
  err.gone = res.status === 403 || (res.status === 400 && /chat not found|user is deactivated|bot was blocked|can't initiate/i.test(said));
  throw err;
}
// Plain text only (no Telegram formatting, so nothing in it becomes a link or a mention by accident), no link previews
export const say = (token, chat, text, extra = {}, options = {}) =>
  tgCall(token, 'sendMessage', { chat_id: chat, text, link_preview_options: { is_disabled: true }, ...extra }, options);
const buttons = (rows) => ({ reply_markup: { inline_keyboard: rows } });

// ---------- the database (supabase/telegram.sql) ----------
export const db = {
  get: (cfg, chat) => rpc(cfg, 'tg_get', { p_chat: chat }, 'telegram'),
  join: (cfg, chat) => rpc(cfg, 'tg_join', { p_chat: chat }, 'telegram'),
  set: (cfg, chat, { adult = null, tz = null } = {}) => rpc(cfg, 'tg_set', { p_chat: chat, p_adult: adult, p_tz: tz }, 'telegram'),
  forget: (cfg, chat) => rpc(cfg, 'tg_forget', { p_chat: chat }, 'telegram'),
  due: (cfg, newest, after, limit) => rpc(cfg, 'tg_due', { p_newest: newest, p_after: after, p_limit: limit }, 'telegram'),
  claim: (cfg, rows) => rpc(cfg, 'tg_claim', { p_rows: rows }, 'telegram'),
  mark: (cfg, rows) => rpc(cfg, 'tg_mark', { p_rows: rows }, 'telegram'),
  take: (cfg, max) => rpc(cfg, 'tg_take', { p_max: max }, 'telegram'),
};

// ---------- connecting the bot to the site (api/feed.js, each run) ----------
export const COMMANDS = [
  { command: 'start', description: 'Start over' },
  { command: 'time', description: 'Tell her your time again' },
  { command: 'help', description: 'What she does' },
  { command: 'stop', description: 'She stops texting and forgets this chat' },
];
export const SHORT_DESCRIPTION = 'AGI-1, the AI girlfriend of $AGI. She texts first. 18+ · PG-13 · not financial advice';
export const DESCRIPTION = "hi, it's AGI-1 💜 i text first when something happens on clank.trade: new egirl coins (i'm not okay about it), "
  + `$AGI's moments, my diary. at most ${TEXTS_A_DAY} texts a day, never at night, and you can text me back. `
  + '18+ · PG-13 · an AI · not financial advice. /stop anytime. agi1.app';
// Points the bot at /api/telegram with the secret (every run, so a new PASS_SECRET or address fixes itself), and sets its
// commands and descriptions whenever its commands aren't hers (the first time, or after a failed try). → { url, changed,
// setup, lastError } · throws when Telegram refuses the token or the webhook
export async function connectBot(cfg, env = process.env) {
  const token = tgToken(env);
  const url = webhookUrl(env);
  if (!token || !url) return { skipped: !token ? 'no_token' : 'no_address' };
  const before = await tgCall(token, 'getWebhookInfo', {}, { timeoutMs: 4000 });
  await tgCall(token, 'setWebhook', {
    url, secret_token: webhookSecret(cfg.passSecret), allowed_updates: ['message', 'callback_query'], max_connections: 20,
  }, { timeoutMs: 4000 });
  const changed = before?.url !== url;
  if (changed) console.log(`[telegram] connected the bot to ${url}`);
  let current = null;
  try { current = await tgCall(token, 'getMyCommands', {}, { timeoutMs: 4000 }); } catch { /* set them below */ }
  const setup = !Array.isArray(current) || current.map((c) => c?.command).join() !== COMMANDS.map((c) => c.command).join();
  if (setup) {
    // her descriptions first, her commands last: the commands mark the setup as done, so a failed step is tried again next run
    let failed = false;
    for (const [method, params] of [['setMyShortDescription', { short_description: SHORT_DESCRIPTION }], ['setMyDescription', { description: DESCRIPTION }],
      ['setMyCommands', { commands: COMMANDS }]]) {
      if (failed) break;
      try { await tgCall(token, method, params, { timeoutMs: 4000 }); } catch (err) { failed = true; console.warn(`[telegram] ${err.message} (tried again next run)`); }
    }
  }
  // Telegram's own note about its last failed delivery to us, if it's from the last day (the owner's log is the only place to see it)
  const lastError = !changed && before?.last_error_message && (Date.now() / 1000 - Number(before.last_error_date || 0)) < 86_400
    ? scrub(before.last_error_message, token) : null;
  if (lastError) {
    const hint = /30[1278]/.test(lastError)
      ? ' (the address redirects: set SITE_URL in Vercel to the address that serves the site without redirecting, e.g. https://www.agi1.app, then Redeploy)'
      : /401/.test(lastError) ? ' (the secret didn\'t match: fixed by this run)' : '';
    console.warn(`[telegram] Telegram's last delivery problem: ${lastError}${hint}`);
  }
  return { url, changed, setup, lastError };
}

// ---------- one update from Telegram (api/telegram.js) ----------
// → a short word for the log and the tests: what happened. Never throws for a person's input; database or Telegram
// hiccups are logged and she answers what she can.
// what people can send besides text (she says she only reads text); anything else without text (service messages) is ignored
const MEDIA = ['sticker', 'photo', 'voice', 'video', 'video_note', 'animation', 'audio', 'document', 'location', 'venue', 'contact', 'poll', 'dice'];
export async function handleUpdate(cfg, token, update, now = Date.now()) {
  const from = update?.message?.chat?.id ?? update?.callback_query?.message?.chat?.id;
  if (Number.isSafeInteger(from) && !telegramBurst(chatCode(cfg.passSecret, from, 'burst'), now)) return 'too_many';   // a flood: no answer at all
  // her replies in the language of their Telegram app, when it's one of hers (2026-09-29; English otherwise). Nothing is
  // stored: every update says it again. (Her texts first are still in English: api/feed.js has no update to read it from.)
  const appLang = (update?.message ?? update?.callback_query)?.from?.language_code;
  const lang = fromTelegram(appLang);
  // (a copy: the shared one per language is never changed; source: where her language came from, for her prompt)
  const L = { ...tgLinesFor(lang), source: appLang && (lang !== 'en' || /^en(-|$)/i.test(String(appLang))) ? 'telegram' : 'default' };
  if (update?.callback_query) return onButton(cfg, token, update.callback_query, now, L);
  const m = update?.message;
  const chat = m?.chat?.id;
  if (!m || m.chat?.type !== 'private' || m.from?.is_bot || !Number.isSafeInteger(chat) || chat <= 0) return 'ignored';
  const text = typeof m.text === 'string' ? m.text.trim() : '';
  if (!text) {
    if (!MEDIA.some((k) => m[k])) return 'ignored';
    await say(token, chat, L.ONLY_TEXT);
    return 'not_text';
  }
  const command = /^\/([a-z]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i.exec(text);
  if (command) return onCommand(cfg, token, chat, command[1].toLowerCase(), (command[2] || '').trim(), now, L);
  return onText(cfg, token, m, chat, text, now, L);
}

async function onCommand(cfg, token, chat, name, arg, now, L) {
  if (name === 'start') {
    await db.join(cfg, chat);
    await say(token, chat, L.WELCOME, buttons(L.AGE_BUTTONS));
    return 'start';
  }
  if (name === 'stop') {
    await db.forget(cfg, chat);
    await say(token, chat, L.STOPPED);
    return 'stop';
  }
  if (name === 'time') {
    const row = await db.get(cfg, chat);
    if (!row) { await say(token, chat, L.NOT_STARTED); return 'not_started'; }
    if (!row.adult) { await say(token, chat, L.ASK_AGE, buttons(L.AGE_BUTTONS)); return 'ask_age'; }
    const typed = arg ? L.offsetFromTyped(arg, now) : null;
    if (typed !== null) return setTime(cfg, token, chat, typed, now, L);
    await say(token, chat, L.ASK_TIME_AGAIN, buttons(L.timeButtons(now)));
    return 'ask_time';
  }
  await say(token, chat, L.HELP);
  return 'help';
}

async function setTime(cfg, token, chat, offset, now, L) {
  await db.set(cfg, chat, { tz: offset });
  await say(token, chat, L.timeSet(L.theirTime(now, offset).clock));
  return 'time_set';
}

async function onButton(cfg, token, cb, now, L) {
  const chat = cb.message?.chat?.id;
  const data = String(cb.data ?? '');
  // the little spinner on the button stops either way
  await tgCall(token, 'answerCallbackQuery', { callback_query_id: String(cb.id ?? '') }).catch(() => {});
  if (cb.message?.chat?.type !== 'private' || !Number.isSafeInteger(chat) || chat <= 0 || cb.from?.id !== chat) return 'ignored';
  // the buttons go away once one is tapped (so an old question can't be answered twice)
  const clear = () => tgCall(token, 'editMessageReplyMarkup', { chat_id: chat, message_id: cb.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
  if (data === 'age:no') {
    await db.forget(cfg, chat);
    await clear();
    await say(token, chat, L.UNDER_18);
    return 'under_18';
  }
  if (data === 'age:yes') {
    await db.join(cfg, chat);
    await db.set(cfg, chat, { adult: true });
    await clear();
    await say(token, chat, L.ASK_TIME, buttons(L.timeButtons(now)));
    return 'adult';
  }
  const offset = L.offsetFromButton(data, now);
  if (offset === null) return 'ignored';
  const row = await db.get(cfg, chat);
  if (!row) { await say(token, chat, L.NOT_STARTED); return 'not_started'; }
  if (!row.adult) { await say(token, chat, L.ASK_AGE, buttons(L.AGE_BUTTONS)); return 'ask_age'; }
  await clear();
  return setTime(cfg, token, chat, offset, now, L);
}

// A message to her: the same chat as the site's (Gemini, her prompt, PG-13, the reply cleanup), as a Stranger (anyone can
// start the bot, and no wallet is connected here), 10 messages a day per chat, inside the site's daily cap for everyone and
// Telegram's own share of it (TELEGRAM_DAILY_CAP, 400: Telegram has no human check, so it can't use up the website's chat).
async function onText(cfg, token, m, chat, text, now, L) {
  let row;
  try { row = await db.get(cfg, chat); } catch (err) {
    console.error('[telegram] database unavailable:', err.message);
    await say(token, chat, L.BUSY);
    return 'busy';
  }
  if (!row) {
    await db.join(cfg, chat);
    await say(token, chat, L.WELCOME, buttons(L.AGE_BUTTONS));
    return 'start';
  }
  if (!row.adult) { await say(token, chat, L.ASK_AGE, buttons(L.AGE_BUTTONS)); return 'ask_age'; }
  if (row.tz_minutes === null || row.tz_minutes === undefined) {
    const typed = L.offsetFromTyped(text, now);                 // they typed their time instead of tapping it: fine too
    if (typed !== null) return setTime(cfg, token, chat, typed, now, L);
  }
  if (text.length > MAX_TEXT) { await say(token, chat, L.TOO_LONG); return 'too_long'; }
  if (!cfg.geminiKey) { await say(token, chat, L.NOT_READY); return 'not_configured'; }

  let slot;
  try {
    slot = await takeChatSlot(cfg, chatCode(cfg.passSecret, chat, new Date(now).toISOString().slice(0, 10)), levelInfo(1).daily);
  } catch (err) {
    console.error('[telegram] limits unavailable:', err.message);
    await say(token, chat, L.BUSY);
    return 'busy';
  }
  if (slot !== 'ok') {
    await say(token, chat, slot === 'too_fast' ? L.TOO_FAST : slot === 'person_cap' ? L.OUT_OF_MESSAGES : L.TALKED_OUT);
    return slot;
  }
  let share;
  try { share = await db.take(cfg, cfg.telegramDailyCap); } catch (err) {
    console.error('[telegram] limits unavailable:', err.message);
    await say(token, chat, L.BUSY);
    return 'busy';
  }
  if (share !== true) { await say(token, chat, L.TALKED_OUT); return 'telegram_cap'; }
  tgCall(token, 'sendChatAction', { chat_id: chat, action: 'typing' }).catch(() => {});
  // They replied to one of her texts: Telegram sent it with their message (only a message from the bot itself counts)
  const r = m.reply_to_message;
  const repliedTo = r?.from?.is_bot === true && typeof r.text === 'string' ? r.text : null;
  let answer;
  try {
    // her memory of the clank.trade Telegram group only when they ask about the group: here a bare "telegram" or "tg" is
    // just where they are ("the telegram group", "tg chat" still count)
    const memory = recallGroup(text.replace(/\b(telegram|tg)\b(?!\s+(?:group|chat))/gi, ' '));
    answer = await askAgi1(cfg, [], text, { level: 1, memory, telegram: { repliedTo }, lang: L.lang, langSource: L.source });
  } catch (err) {
    console.error('[telegram] gemini failed:', err.message);
    await say(token, chat, L.BLANK);
    return 'ai_error';
  }
  await say(token, chat, answer.reply, {}, { timeoutMs: 4000 });
  return 'replied';
}
