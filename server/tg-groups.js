// AGI-1 in Telegram groups (2026-10-03, the owner: "can i add agi-1 bot to our public tg group", then "ok that seems
// good"; her own posts there: "Yes: diary + market moments"; and "can she also welcome new members?").
// Only in the groups the owner lists (TELEGRAM_GROUPS, server/config.js). Added to any other group, she leaves at once, so
// her name never sits in a group that isn't the owner's (a look-alike "official" group, say). In a listed group:
//   • she answers anyone who replies to one of her messages, mentions her (@her_username) or types /ask: the site's chat
//     (Gemini, her prompt, the reply cleanup), as a Stranger, and never flirty (anyone can be in a group, and nobody's
//     age is checked there: the group part of telegramPrompt), at most 2 sentences, as a reply to their message.
//     Telegram only sends a bot the replies to it, commands and service messages, unless the owner switches its privacy
//     mode off (BotFather → /setprivacy → Disable, then add her again): plain @mentions only reach her then.
//     Her limits there: each person's Stranger's messages a day (5, shared with her private chat: the same daily code of
//     their account), the group's TELEGRAM_GROUP_DAILY_CAP (100), Telegram's share of the site's day (TELEGRAM_DAILY_CAP),
//     the site's daily cap; speed bumps per person (4 a minute) and per group (15). Nothing of what they write is kept.
//   • /ca, /website and /mc (2026-10-05, the owner's): the official $AGI contract (marked as code, so a tap copies it), the
//     site's link, and $AGI's market cap, 24h change and liquidity (DexScreener, the site's own numbers: server/market.js),
//     pre-written (no AI, nobody's messages a day), each at most once every 30 seconds in a group (the answer is right
//     above), within the same speed bumps;
//   • when she's added: her intro; when people join: a short pre-written welcome (no names, a safety reminder), at most one
//     every 10 minutes in a group (TELEGRAM_GROUP_WELCOME=off: none);
//   • api/feed.js posts her diary and $AGI's market moments there as they happen (postToGroups; TELEGRAM_GROUP_POSTS=off:
//     none): never a moment about another coin (no egirl coins, no copies of $AGI), never twice.
// Kept (supabase/telegram.sql, agi1_tg_group_usage): per group and day, how many replies she gave there and when she last
// welcomed someone. Only the group's own number: never a message, a name or anyone's account.
import { tgCall, say, chatCode, botIdOf, scrub, MEDIA } from './tg-api.js';
import { rpc, takeChatSlot } from './limits.js';
import { askAgi1, TLDS } from './gemini.js';
import { levelInfo } from '../src/lib/levels.js';
import { groupPersonBurst, groupBurst } from './burst.js';
import {
  tgLinesFor, groupIntro, GROUP_WELCOMES, GROUP_HELP, GROUP_FULL, GROUP_OUT, GROUP_CA, GROUP_WEBSITE, groupMarket, GROUP_MARKET_DOWN, pickFor,
} from './tg-lines.js';
import { OFFICIAL_CA } from './agi1-prompt.js';
import { agiNumbers } from './market.js';
import { botName } from '../src/chat/telegram-link.js';

const MAX_TEXT = 500;                        // characters she reads (the same as the site's chat and her private chat)
const MINUTE = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
export const WELCOME_GAP_S = 600;            // at most one welcome every 10 minutes in a group
// her commands in groups (server/telegram.js connectBot sets them for all group chats while group mode is on)
export const GROUP_COMMANDS = [
  { command: 'ask', description: 'Ask AGI-1 something (a few a day each)' },
  { command: 'ca', description: 'The official $AGI contract' },
  { command: 'mc', description: '$AGI market cap, 24h change and liquidity' },
  { command: 'website', description: 'The official website, agi1.app' },
  { command: 'help', description: 'How to talk to her in here' },
];
// /ca, /website and /mc: what she answers (the contract marked as code: Telegram copies it with a tap; $AGI's numbers read
// when asked, kept a minute), at most once every 30 s in a group
export const FIXED_GAP_MS = 30_000;
const CA_CODE = [{ type: 'code', offset: GROUP_CA.indexOf(OFFICIAL_CA), length: OFFICIAL_CA.length }];
const FIXED = {
  ca: async () => ({ text: GROUP_CA, entities: CA_CODE }),
  website: async () => ({ text: GROUP_WEBSITE }),
  mc: async (now) => {
    const n = await agiNumbers(now);
    return { text: n ? groupMarket(n) : GROUP_MARKET_DOWN };
  },
};
// /ask, /ask@her_bot, "/help@her_bot something" → [, name, @name, the rest]
const COMMAND = /^\/([A-Za-z0-9_]{1,32})(?:@([A-Za-z0-9_]{3,64}))?(?:\s+([\s\S]*))?$/;

// ---------- which groups ----------
// a group she may be in: its id, or its public @username, in TELEGRAM_GROUPS
export function groupAllowed(cfg, chat) {
  const g = cfg?.tgGroups;
  if (!g || !chat) return false;
  if (g.ids.has(String(chat.id))) return true;
  return typeof chat.username === 'string' && g.names.has(chat.username.toLowerCase());
}

// ---------- what this server copy remembers (never anything about a person beyond a daily code, a day at most) ----------
const notes = new Map();                     // key → until when (ms)
const noted = (key, now) => (notes.get(key) ?? 0) > now;
function note(key, now, ttl) {
  notes.delete(key);
  if (notes.size >= 5000) notes.delete(notes.keys().next().value);
  notes.set(key, now + ttl);
}
// true the first time in `ttl` (per server copy): her "that's all for today" kind of lines, said once instead of every time
const firstTime = (key, now, ttl) => {
  if (noted(key, now)) return false;
  note(key, now, ttl);
  return true;
};
const left = new Set();                      // groups this copy has already left
let known = null;                            // her username, from Telegram's getMe, when VITE_TELEGRAM_BOT isn't set
let askedAt = -Infinity;
const warned = new Set();
const warnOnce = (key, line) => { if (!warned.has(key)) { warned.add(key); console.warn(line); } };
// (for the tests: a fresh server copy)
export function forgetGroups() {
  notes.clear(); left.clear(); warned.clear();
  known = null; askedAt = -Infinity;
  groupPersonBurst.reset(); groupBurst.reset();
}

// ---------- who she is ----------
// Her id is the number in her token; her username is VITE_TELEGRAM_BOT (the site's public link to her), or else what
// Telegram's getMe says (asked once, and again at most every 10 minutes after a failure). → { id, username (lowercase) | null }
export async function botIdentity(token, env = process.env, now = Date.now()) {
  const quick = identity(token, env);
  if (quick.username || now - askedAt < 10 * MINUTE) return quick;
  askedAt = now;
  try {
    const me = await tgCall(token, 'getMe', {}, { timeoutMs: 3000 });
    const name = botName(me?.username);
    if (name && Number(me.id) === quick.id) known = { id: quick.id, username: name.toLowerCase() };
  } catch (err) { console.warn(`[telegram] couldn't ask Telegram for her username: ${err.message}`); }
  return identity(token, env);
}
function identity(token, env = process.env) {
  const id = botIdOf(token);
  const named = botName(env.VITE_TELEGRAM_BOT);
  return { id, username: named ? named.toLowerCase() : known?.id === id ? known.username : null };
}

// Is she mentioned (an @mention of her username, or a mention of her by name: Telegram's "text_mention" with her id)?
const herHandle = (username) => new RegExp(`(^|[^\\w@])@${username}\\b`, 'i');
function herMentions(s, ents, me) {
  return ents.filter((e) => e && Number.isInteger(e.offset) && Number.isInteger(e.length) && e.offset >= 0 && e.length > 0
    && ((e.type === 'text_mention' && e.user?.id === me.id)
      || (e.type === 'mention' && me.username && s.slice(e.offset, e.offset + e.length).toLowerCase() === `@${me.username}`)));
}
const mentionsHer = (s, ents, me) => herMentions(s, ents, me).length > 0 || Boolean(me.username && herHandle(me.username).test(s));
// what they wrote, without her mentions (Telegram counts offsets in UTF-16 units, like JavaScript strings), in one line
function withoutHer(s, ents, me) {
  let out = s;
  for (const e of herMentions(s, ents, me).sort((a, b) => b.offset - a.offset)) out = `${out.slice(0, e.offset)} ${out.slice(e.offset + e.length)}`;
  if (me.username) out = out.replace(new RegExp(herHandle(me.username).source, 'gi'), '$1 ');
  return out.replace(/\s+/g, ' ').trim();
}

// Her answer goes under their message (never on its own: if their message was deleted meanwhile, she says nothing), in
// its topic when the group has topics
const topicOf = (m) => (m.is_topic_message === true && Number.isSafeInteger(m.message_thread_id) ? { message_thread_id: m.message_thread_id } : {});
const replyTo = (m) => ({ reply_parameters: { message_id: m.message_id, allow_sending_without_reply: false }, ...topicOf(m) });

// ---------- one message in a group (server/telegram.js handleUpdate sends every group update here) ----------
// → a short word for the log and the tests. Never throws for what someone wrote; database hiccups are logged, and she says
// she's busy at most once every 10 minutes in a group.
export async function onGroup(cfg, token, m, now = Date.now()) {
  const started = Date.now();                                  // (her answer must be out well inside Vercel's 25 s)
  if (!cfg.tgGroups) return 'ignored';                         // group mode is off (TELEGRAM_GROUPS not set): as before
  const chat = m?.chat;
  if (!Number.isSafeInteger(chat?.id) || chat.id >= 0) return 'ignored';
  const herId = botIdOf(token);
  if (!groupAllowed(cfg, chat)) {
    // a listed group that just became a supergroup (Telegram gives it a new id): said in the log, and not left for this
    if (m.migrate_from_chat_id && cfg.tgGroups.ids.has(String(m.migrate_from_chat_id))) return migrated(m.migrate_from_chat_id, chat.id);
    return leaveGroup(cfg, token, chat);
  }
  if (m.migrate_to_chat_id) return cfg.tgGroups.ids.has(String(chat.id)) ? migrated(chat.id, m.migrate_to_chat_id) : 'ignored';

  // she was added (or the group was made with her in it): her intro. People joined: a welcome, now and then.
  const joined = Array.isArray(m.new_chat_members) ? m.new_chat_members : [];
  if (m.group_chat_created || m.supergroup_chat_created || joined.some((u) => u?.id === herId)) {
    await say(token, chat.id, groupIntro({ posts: cfg.tgGroupPosts }), topicOf(m), { timeoutMs: 4000 })
      .catch((err) => console.warn(`[telegram] her intro in a group didn't go out: ${err.message}`));
    return 'group_intro';
  }
  if (joined.length) return cfg.tgGroupWelcome && joined.some((u) => u && !u.is_bot) ? welcome(cfg, token, chat, m, now) : 'ignored';

  // only people talk to her: not other bots, not the group or a channel posting as itself (anonymous admins included:
  // there's no person to count their messages for)
  if (m.sender_chat || !m.from || m.from.is_bot || !Number.isSafeInteger(m.from.id) || m.from.id <= 0) return 'ignored';
  const text = typeof m.text === 'string' ? m.text : '';
  const body = text || (typeof m.caption === 'string' ? m.caption : '');
  const raw = text ? m.entities : m.caption_entities;
  const ents = Array.isArray(raw) ? raw : [];
  const toHer = m.reply_to_message?.from?.id === herId && m.reply_to_message.from.is_bot === true;
  const cmd = COMMAND.exec(body.trim());
  let me = identity(token);
  if (!me.username && (cmd?.[2] || ents.some((e) => e?.type === 'mention') || body.includes('@'))) me = await botIdentity(token, process.env, now);

  // is it for her? /ask (or her own commands, with her name), /ca, /website, /mc, a reply to her, or a mention of her
  let ask = '', help = false, fixed = null;
  if (cmd) {
    if (cmd[2] && me.username && cmd[2].toLowerCase() !== me.username) return 'ignored';   // another bot's command
    const name = cmd[1].toLowerCase();
    if (name === 'ask') ask = withoutHer(cmd[3] || '', [], me);
    else if (Object.hasOwn(FIXED, name)) fixed = name;          // /ca, /website, /mc (plain, or with her name)
    else if (name === 'help' || cmd[2]) help = true;            // /help, or another of her commands sent to her by name
    else return 'ignored';                                       // someone else's plain command (/start, /warn…)
  } else if (toHer || mentionsHer(body, ents, me)) {
    ask = withoutHer(body, ents, me);
  } else return 'ignored';

  // speed bumps, only for messages meant for her: 4 a minute per person, 15 a minute per group (per server copy)
  if (!groupPersonBurst(chatCode(cfg.passSecret, m.from.id, 'gburst'), now) || !groupBurst(chatCode(cfg.passSecret, chat.id, 'gburst'), now)) return 'too_many';

  // /ca, /website and /mc: her answer under their message (on its own if a bot already cleaned their command away), at
  // most once every 30 seconds in a group (asked again sooner: the answer is right above); no AI, nothing counted
  if (fixed) {
    if (!firstTime(`${fixed}:${chat.id}`, now, FIXED_GAP_MS)) return 'group_recent';
    const { text: line, entities } = await FIXED[fixed](now);
    await say(token, chat.id, line, { reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true }, ...topicOf(m), ...(entities ? { entities } : {}) },
      { timeoutMs: 4000 }).catch((err) => console.warn(`[telegram] couldn't answer /${fixed} in a group: ${err.message}`));
    return `group_${fixed}`;
  }

  const E = tgLinesFor('en');
  const day = new Date(now).toISOString().slice(0, 10);
  const person = chatCode(cfg.passSecret, m.from.id, day);      // the same code as their private chat's: one day for both
  const send = (line) => say(token, chat.id, line, replyTo(m), { timeoutMs: 4000 })
    .then(() => true, (err) => { console.warn(`[telegram] couldn't answer in a group: ${err.message}`); return false; });
  if (!text) {                                                   // a picture or a sticker for her: she only reads text
    if (!MEDIA.some((k) => m[k]) || !firstTime(`media:${person}`, now, DAY)) return 'ignored';
    await send(E.ONLY_TEXT);
    return 'not_text';
  }
  // how to talk to her: once every 10 minutes per person (so /help can't fill the group)
  if (help || !ask) { if (firstTime(`help:${person}`, now, 10 * MINUTE)) await send(GROUP_HELP); return 'group_help'; }
  if (ask.length > MAX_TEXT) { await send(E.TOO_LONG); return 'too_long'; }
  if (!cfg.geminiKey) { if (firstTime(`ready:${chat.id}`, now, HOUR)) await send(E.NOT_READY); return 'not_configured'; }
  if (noted(`full:${chat.id}:${day}`, now)) return 'group_quiet';  // the group's day is used: quiet, without counting anything

  try {
    // their messages first (so someone over their own day never uses the group's), then the group's, then Telegram's share
    const slot = await takeChatSlot(cfg, person, levelInfo(1).daily);
    if (slot === 'too_fast') return 'too_fast';                  // (3 seconds between their messages: no answer, no noise)
    if (slot === 'person_cap') { if (firstTime(`out:${person}`, now, DAY)) await send(GROUP_OUT); return 'person_cap'; }
    if (slot !== 'ok') { if (firstTime(`talked:${chat.id}:${day}`, now, DAY)) await send(E.TALKED_OUT); return 'global_cap'; }
    const take = await groupTake(cfg, chat.id);
    if (take === 'missing') {
      warnOnce('sql', '[telegram] tg_group_take not found: run supabase/telegram.sql again in this Supabase project (it ends with telegram_functions_found = 14)');
      if (firstTime(`ready:${chat.id}`, now, HOUR)) await send(E.NOT_READY);
      return 'not_ready';
    }
    if (take !== 'ok') {
      note(`full:${chat.id}:${day}`, now, DAY);
      if (take === 'full') await send(GROUP_FULL);
      return take === 'full' ? 'group_full' : 'group_quiet';
    }
    if (await rpc(cfg, 'tg_take', { p_max: cfg.telegramDailyCap }, 'telegram') !== true) {
      if (firstTime(`talked:${chat.id}:${day}`, now, DAY)) await send(E.TALKED_OUT);
      return 'telegram_cap';
    }
  } catch (err) {
    console.error('[telegram] limits unavailable (group):', err.message);
    if (firstTime(`busy:${chat.id}`, now, 10 * MINUTE)) await send(E.BUSY);
    return 'busy';
  }
  tgCall(token, 'sendChatAction', { chat_id: chat.id, action: 'typing', ...topicOf(m) }).catch(() => {});
  // they replied to one of her messages in the group: it comes along, as context (only a message from her counts)
  const repliedTo = toHer && typeof m.reply_to_message.text === 'string' ? m.reply_to_message.text : null;
  let answer;
  try {
    // no memory of the clank.trade group here (it's about real people), English unless they write in another language
    answer = await askAgi1(cfg, [], ask, {
      level: 1, memory: [], telegram: { repliedTo, group: true }, lang: 'en', langSource: 'default',
      timeoutMs: Math.max(3_000, 19_000 - (Date.now() - started)),      // (a slow database leaves the AI less time, never Vercel's limit)
    });
  } catch (err) {
    console.error('[telegram] gemini failed (group):', err.message);
    await send(E.BLANK);
    return 'ai_error';
  }
  return (await send(answer.reply)) ? 'group_replied' : 'not_sent';
}

// the group's replies for today (supabase/telegram.sql): 'ok' (one more, counted) · 'full' (used up: say so, once) ·
// 'quiet' (used up, and already said) · 'missing' (telegram.sql wasn't run again since group mode came)
async function groupTake(cfg, chat) {
  try {
    const r = await rpc(cfg, 'tg_group_take', { p_chat: chat, p_max: cfg.tgGroupDailyCap }, 'telegram');
    return ['ok', 'full', 'quiet'].includes(r) ? r : 'quiet';
  } catch (err) {
    if (err.code === 'PGRST202') return 'missing';
    throw err;
  }
}

// People joined: a welcome, if she hasn't welcomed anyone there in the last 10 minutes (the database decides, so two
// server copies never both welcome). A raid of joins asks the database at most once a minute per group (per copy).
async function welcome(cfg, token, chat, m, now) {
  if (!firstTime(`welcome:${chat.id}`, now, MINUTE)) return 'welcome_later';
  let due = false;
  try {
    due = (await rpc(cfg, 'tg_group_welcome', { p_chat: chat.id, p_gap_seconds: WELCOME_GAP_S }, 'telegram')) === true;
  } catch (err) {
    if (err.code === 'PGRST202') warnOnce('sql-welcome', '[telegram] tg_group_welcome not found, so she welcomes nobody yet: run supabase/telegram.sql again in this Supabase project');
    else console.warn(`[telegram] a welcome was skipped: ${err.message}`);
    return 'welcome_later';
  }
  if (!due) return 'welcome_later';
  const line = GROUP_WELCOMES[pickFor(`${chat.id}:${Math.floor(now / (WELCOME_GAP_S * 1000))}`, GROUP_WELCOMES.length)];
  await say(token, chat.id, line, topicOf(m), { timeoutMs: 4000 }).catch((err) => console.warn(`[telegram] a welcome didn't go out: ${err.message}`));
  return 'group_welcome';
}

// A group that isn't in TELEGRAM_GROUPS: she leaves (once per server copy), and the log says which, so the owner can add
// it if it's theirs. A setting with no group in it (a typo) means she leaves every group: said once.
async function leaveGroup(cfg, token, chat) {
  const key = String(chat.id);
  if (left.has(key)) return 'left_group';
  if (left.size >= 1000) left.clear();
  left.add(key);
  const g = cfg.tgGroups;
  if (!g.ids.size && !g.names.size) {
    warnOnce('empty', "[telegram] TELEGRAM_GROUPS has no group in it, so she leaves every group she's added to: write your group's @username (or its id, a negative number), then Redeploy");
  }
  const handle = typeof chat.username === 'string' && /^\w{1,32}$/.test(chat.username) ? `@${chat.username}` : null;
  // (its title as anyone named it: control and invisible characters never reach the log)
  const title = scrub(String(chat.title ?? '').replace(/[\p{Cc}\p{Cf}]/gu, ' ')).slice(0, 64);
  console.warn(`[telegram] she left a group that isn't in TELEGRAM_GROUPS: "${title}" (${handle ? `${handle}, ` : ''}id ${chat.id}). `
    + `If it's yours: add ${handle || chat.id} to TELEGRAM_GROUPS in Vercel, Redeploy, then add her to it again`);
  try { await tgCall(token, 'leaveChat', { chat_id: chat.id }, { timeoutMs: 4000 }); } catch (err) { console.warn(`[telegram] couldn't leave that group: ${err.message}`); }
  return 'left_group';
}

// A listed group became a supergroup, and Telegram gave it a new id: the log says what to write (its @username never
// changes, so a public group listed by its @username is never affected)
function migrated(from, to) {
  warnOnce(`migrated:${from}`, `[telegram] a group in TELEGRAM_GROUPS (id ${from}) became a supergroup with the new id ${to}: `
    + `write ${to} (or the group's @username) in TELEGRAM_GROUPS instead, Redeploy, then add her to it again if she left`);
  return 'ignored';
}

// ---------- her posts in the groups (api/feed.js, each run, right after the moments are found) ----------
// Only her diary and $AGI's market moments (the owner's choice), only the ones found this very run (so never twice), and
// never one that names another coin, a link other than agi1.app, an address or an @username.
export const GROUP_POSTS = ['mcap', 'sad', 'diary'];
const OTHER_COIN = /\$(?!agi\b)[a-z]/i;
const BARE_HOST = new RegExp(`(?:^|[^\\w@.-])((?:[a-z0-9-]+\\.)+(?:${TLDS}))\\b`, 'gi');
export function groupSafe(text) {
  const s = String(text ?? '');
  if (!s.trim() || OTHER_COIN.test(s) || /0x[0-9a-f]{6}/i.test(s) || /(^|[^\w@])@\w{3,}/.test(s)) return false;
  if ((s.match(/\b(?:https?:\/\/|www\.)[^\s)]+/gi) || []).some((u) => !/^https:\/\/agi1\.app(?:\/|$)/i.test(u))) return false;
  for (const [, host] of s.matchAll(BARE_HOST)) if (!/^(?:www\.)?(?:agi1\.app|clank\.trade)$/i.test(host)) return false;
  return true;
}
// moments: what gatherMoments() added this run ([{ id, kind, key, text }]) → { posted, failed, skipped, stopped? }
export async function postToGroups(cfg, token, moments = [], { deadline = Infinity } = {}) {
  const out = { posted: 0, failed: 0, skipped: 0 };
  const g = cfg.tgGroups;
  if (!g || !cfg.tgGroupPosts || !token) return out;
  const targets = [...[...g.names].map((n) => `@${n}`), ...[...g.ids].map(Number)];
  const ours = moments.filter((x) => GROUP_POSTS.includes(x?.kind) && typeof x.text === 'string');
  const posts = ours.filter((x) => groupSafe(x.text)).sort((a, b) => Number(a.id) - Number(b.id));
  out.skipped = ours.length - posts.length;
  for (const p of posts) {
    for (const to of targets) {
      if (Date.now() > deadline) { out.stopped = 'time'; return out; }
      try {
        await say(token, to, p.text, {}, { timeoutMs: 4000 });
        out.posted += 1;
      } catch (err) {
        out.failed += 1;
        const hint = err.status === 403 ? ' (is she still in that group? add her again)'
          : err.status === 400 && /not found/i.test(err.message) ? " (check TELEGRAM_GROUPS: a public group's @username, or its id)"
            : err.status === 429 ? ' (Telegram said "too many": skipped this time)' : '';
        console.warn(`[feed] couldn't post ${p.key} in the group ${to}: ${err.message}${hint}`);
      }
    }
  }
  return out;
}
