// Telegram's Bot API for AGI-1's bot (2026-09-29; moved here from server/telegram.js on 2026-10-03, so her group mode,
// server/tg-groups.js, can use it without the two files importing each other): her token, one API call, sending a text,
// and a daily code of a chat or a person. Every call to Telegram comes from our server; the token never reaches a browser.
import { createHmac } from 'node:crypto';

const API = 'https://api.telegram.org/bot';
const TOKEN = /^\d{5,15}:[A-Za-z0-9_-]{30,60}$/;

// The bot's token (BotFather gives it), or '' when it isn't set or doesn't look like one
export const tgToken = (env = process.env) => (TOKEN.test(String(env.TELEGRAM_BOT_TOKEN || '').trim()) ? String(env.TELEGRAM_BOT_TOKEN).trim() : '');
// The bot's own Telegram id: the number before the token's colon (Telegram's own rule), or null
export const botIdOf = (token) => {
  const id = Number(String(token ?? '').split(':')[0]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

// A daily code for one Telegram chat's (or one person's) message limits, like the site's daily visitor code: never the
// number itself. A private chat's number is its person's account number, so a person's code is the same in her private
// chat and in a group (one Stranger's day for both).
const b64url = (buf) => Buffer.from(buf).toString('base64url');
export const chatCode = (secret, chat, day) => `t:${b64url(createHmac('sha256', secret).update(`tg:${day}:${chat}`).digest()).slice(0, 32)}`;

// Telegram's answers can quote the token back (in an address): never in a log line
export const scrub = (text, token) => {
  let s = String(text ?? '');
  if (token) s = s.split(token).join('[token]');
  return s.replace(/\d{5,15}:[A-Za-z0-9_-]{30,60}/g, '[token]').replace(/\s+/g, ' ').trim().slice(0, 200);
};

// One Bot API call. → its result · throws an error with .status, .retryAfter (seconds, when Telegram says "too many") and
// .gone (the person blocked the bot or deleted their account, or the chat doesn't exist: forget them)
export async function tgCall(token, method, params = {}, { timeoutMs = 5000, files = null } = {}) {
  // (files: { name: { bytes, filename, type } } → sent as a form, for a file Telegram doesn't have yet: her buy GIF)
  let body = JSON.stringify(params), headers = { 'Content-Type': 'application/json' };
  if (files) {
    body = new FormData();
    for (const [k, v] of Object.entries(params)) if (v !== undefined) body.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    for (const [k, f] of Object.entries(files)) body.append(k, new Blob([f.bytes], { type: f.type }), f.filename);
    headers = {};
  }
  const res = await fetch(`${API}${token}/${method}`, { method: 'POST', headers, body, signal: AbortSignal.timeout(timeoutMs) });
  return answerOf(res, method, token);
}
async function answerOf(res, method, token) {
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
// What people can send her besides text (she says she only reads text); anything else without text (service messages,
// like a pinned message) gets no answer
export const MEDIA = ['sticker', 'photo', 'voice', 'video', 'video_note', 'animation', 'audio', 'document', 'location', 'venue', 'contact', 'poll', 'dice'];

// Plain text only (no Telegram formatting, so nothing in it becomes a link or a mention by accident), no link previews
export const say = (token, chat, text, extra = {}, options = {}) =>
  tgCall(token, 'sendMessage', { chat_id: chat, text, link_preview_options: { is_disabled: true }, ...extra }, options);
