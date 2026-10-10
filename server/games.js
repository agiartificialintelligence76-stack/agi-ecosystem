// AGI-1's games in her Telegram groups (2026-10-09, the owner: "can i add games on the tg bot like riddles, questions, if
// the person in that telegram group answered correctly they will get a small amount of $AGI, they will reply with their
// address and get it", then "make this better then continue"). The better version, with the owner's choices:
//   • about GAMES_A_DAY times a day in each of her groups (TELEGRAM_GROUPS; 10, the owner's: "About 10 a day"), at random
//     times, she posts a quiz: a Telegram quiz poll, open 10 minutes, its question pre-written (server/game-questions.js:
//     riddles, $AGI and her, staying safe, trivia from her trips) and its answers shuffled;
//   • when it closes, ONE person who got it right is drawn at random (so the fastest finger, or a bot, doesn't win every
//     time): GAME_PRIZE $AGI (250, the owner's), one win a day each, GAME_WINS_A_DAY wins a day for the whole site (10, the
//     owner's); she says who won, under the quiz;
//   • the winner claims it in her private chat (server/game-prizes.js; 18+, the owner's): only their wallet address,
//     never a seed phrase, a signature or a link, and her prize wallet (PRIZE_WALLET_KEY, the owner's) sends it.
// The clock is Supabase Cron (supabase/games.sql): every 2 minutes it calls GET /api/feed?games with the database's own key
// (like her buy bot's). Telegram tells us each answer (a "poll_answer" update) and when a quiz closes (a "poll" update),
// at /api/telegram (server/telegram.js handleUpdate).
// Kept (supabase/games.sql): per quiz, the group's id and the poll's; per answer (3 days), the person's Telegram id, the
// first name Telegram shows (to name a winner) and whether they were right; per prize (60 days), the winner's id and, once
// they claim it, the address they gave and its public transaction. Nothing else about anyone.
// (light to load, since the clock calls it every 2 minutes: the prize wallet's code, server/game-prizes.js, which needs
// the chain's, is only loaded when a quiz with a prize is about to go out)
import { randomInt } from 'node:crypto';
import { tgCall, say } from './tg-api.js';
import { rpc } from './limits.js';
import { isCrude } from './coins.js';
import { QUESTIONS } from './game-questions.js';
import { pollQuestion, pollExplanation, resultLine, CLAIM_BUTTON, POLL_SECONDS } from './game-lines.js';
import { botName } from '../src/chat/telegram-link.js';

const MINUTE = 60_000, HOUR = 60 * MINUTE;

// Her games happen while group mode is on (TELEGRAM_GROUPS has a group in it), the database is set, and TELEGRAM_GAMES
// isn't "off". Their prizes, while the prize wallet's key is set (and isn't the launch gas wallet's: that one never holds
// $AGI, hard rule 4): otherwise her quizzes are just for fun.
export const gamesOn = (cfg) => Boolean(cfg?.tgGames && cfg.tgGroups && (cfg.tgGroups.ids.size || cfg.tgGroups.names.size)
  && cfg.supabaseUrl && cfg.supabaseKey);
export const prizesOn = (cfg) => Boolean(cfg?.prizeKey && cfg.prizeKey !== cfg.launchGasKey);
// about how often, in minutes, a quiz comes in each group (game_due makes it 0.6 to 1.4 times this, at random)
export const gapMinutes = (cfg) => Math.max(10, Math.round(1440 / Math.max(1, cfg?.gamesADay || 10)));

// ---------- the database (supabase/games.sql) ----------
export const gameDb = {
  key: (cfg) => rpc(cfg, 'game_key', {}, 'games'),
  due: (cfg, target, minutes) => rpc(cfg, 'game_due', { p_target: target, p_minutes: minutes }, 'games'),
  left: (cfg, cap) => rpc(cfg, 'game_left', { p_cap: cap }, 'games'),
  recent: (cfg) => rpc(cfg, 'game_recent', {}, 'games'),
  open: (cfg, g) => rpc(cfg, 'game_open', {
    p_chat: g.chat, p_message: g.message, p_poll: g.poll, p_question: g.question, p_correct: g.correct, p_answer: g.answer,
    p_prize: g.prize, p_seconds: g.seconds,
  }, 'games'),
  answer: (cfg, poll, person, name, option) => rpc(cfg, 'game_answer', { p_poll: poll, p_person: person, p_name: name, p_option: option }, 'games'),
  settle: (cfg, poll, cap, amount) => rpc(cfg, 'game_settle', { p_poll: poll, p_cap: cap, p_amount: amount }, 'games'),
  unsettled: (cfg) => rpc(cfg, 'game_unsettled', {}, 'games'),
  tidy: (cfg) => rpc(cfg, 'game_tidy', {}, 'games'),
  pending: (cfg, person) => rpc(cfg, 'game_pending', { p_person: person }, 'games'),
  address: (cfg, prize, person, address) => rpc(cfg, 'game_address', { p_prize: prize, p_person: person, p_address: address }, 'games'),
  claim: (cfg, prize, person) => rpc(cfg, 'game_claim', { p_prize: prize, p_person: person }, 'games'),
  sending: (cfg, prize, tx) => rpc(cfg, 'game_sending', { p_prize: prize, p_tx: tx }, 'games'),
  sent: (cfg, prize, tx, ok) => rpc(cfg, 'game_sent', { p_prize: prize, p_tx: tx, p_ok: ok }, 'games'),
};

// ---------- what this server copy remembers ----------
let key = { at: -Infinity, value: null };          // the clock's key, from the database (10 minutes)
let me = { at: -Infinity, username: null };          // her username, when VITE_TELEGRAM_BOT isn't set (getMe)
let updatesAt = -Infinity;                           // when her bot's update types were last checked (an hour)
let tidiedAt = -Infinity;                            // the tidy-up (at most every 30 minutes)
let funded = { at: -Infinity, value: null };         // whether the prize wallet can pay a prize (5 minutes)
export function forgetGames() {                      // (for the tests: a fresh server copy)
  key = { at: -Infinity, value: null }; me = { at: -Infinity, username: null };
  updatesAt = -Infinity; tidiedAt = -Infinity; funded = { at: -Infinity, value: null };
}

// The key Supabase Cron sends with each call (supabase/games.sql made it), kept 10 minutes. Throws when the database can't
// say (games.sql not run: err.code PGRST202)
export async function gameKey(cfg, now = Date.now()) {
  if (key.value && now - key.at < 10 * MINUTE) return key.value;
  const value = await gameDb.key(cfg);
  key = { at: now, value: typeof value === 'string' && value.length >= 32 ? value : null };
  return key.value;
}

// Her username, for the winner's button (t.me/<her>?start=claim): VITE_TELEGRAM_BOT, the site's own link to her, or what
// Telegram's getMe says (asked once, and again at most every 10 minutes after a failure)
export async function botUsername(token, env = process.env, now = Date.now()) {
  const named = botName(env.VITE_TELEGRAM_BOT);
  if (named) return named;
  if (me.username || now - me.at < 10 * MINUTE) return me.username;
  me.at = now;
  try { me.username = botName((await tgCall(token, 'getMe', {}, { timeoutMs: 3000 }))?.username); } catch (err) {
    console.warn(`[games] couldn't ask Telegram for her username: ${err.message}`);
  }
  return me.username;
}

// her groups, as the database and Telegram name them: [target (an @username in lowercase, or an id), chat_id for Telegram]
export const targetsOf = (cfg) => [
  ...[...cfg.tgGroups.names].map((n) => [`@${n}`, `@${n}`]),
  ...[...cfg.tgGroups.ids].map((id) => [id, Number(id)]),
];

// ---------- the questions ----------
// One question that wasn't asked lately (the database keeps the newest 60 asked), at random
export function pickQuestion(recent = [], rand = randomInt) {
  const skip = new Set(Array.isArray(recent) ? recent : []);
  const fresh = QUESTIONS.filter((x) => !skip.has(x.id));
  const pool = fresh.length ? fresh : QUESTIONS;
  return pool[rand(pool.length)];
}
// Its four answers, shuffled (each written right answer first) → { options, correct (the right one's place) }
export function shuffled(q, rand = randomInt) {
  const order = q.a.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { options: order.map((i) => q.a[i]), correct: order.indexOf(0) };
}

// The name a winner is called by in the group: their first name (and last) as Telegram shows it, tidied; null when it
// can't go in her words (a link, an @name, an address, a crude word, or posing as her, an admin or support), and then
// she says "our winner" (stored as "~")
const LINKY = /[a-z][a-z0-9+.-]*:\/\/|www\.|\bt\.me\b|[\p{L}\p{N}-]\.(?:com|net|org|io|xyz|app|me|gg|co|ai|link|site|top|info|trade|fun)\b/iu;
const POSING = /\b(?:admin|support|official|moderator|mod|team|dev|agi[\s-]?1|helpdesk)\b/i;
export function safeName(user) {
  const raw = [user?.first_name, user?.last_name].filter((s) => typeof s === 'string').join(' ');
  let s = raw.normalize('NFKC').replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '').replace(/\s+/g, ' ').trim();
  if ([...s].length > 32) s = [...String(user?.first_name ?? '').normalize('NFKC').replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '').replace(/\s+/g, ' ').trim()].slice(0, 32).join('').trim();
  if (!s || !/[\p{L}\p{N}]/u.test(s) || s === '~') return null;
  if (LINKY.test(s) || s.includes('@') || /0x[0-9a-f]{6}/i.test(s) || /\$[a-z]/i.test(s) || isCrude(s) || POSING.test(s)) return null;
  return s;
}

// ---------- posting a quiz ----------
// → { round, question, prize } · throws (Telegram refused it, or it couldn't be kept: then it's taken back)
async function postGame(cfg, token, chatId, { prize, recent }) {
  const q = pickQuestion(recent);
  const { options, correct } = shuffled(q);
  const msg = await tgCall(token, 'sendPoll', {
    chat_id: chatId, question: pollQuestion({ q: q.q, prize, amount: cfg.gamePrize }), options: options.map((text) => ({ text })),
    type: 'quiz', is_anonymous: false, correct_option_id: correct, open_period: POLL_SECONDS, explanation: pollExplanation({ why: q.why, prize }),
  }, { timeoutMs: 5000 });
  const poll = msg?.poll;
  if (!poll?.id || !Number.isSafeInteger(msg?.chat?.id) || !Number.isSafeInteger(msg?.message_id)) throw new Error('telegram sendPoll: an odd answer');
  let round = null, why = '';
  try {
    round = await gameDb.open(cfg, {
      chat: msg.chat.id, message: msg.message_id, poll: String(poll.id), question: q.id, correct, answer: q.a[0], prize, seconds: POLL_SECONDS,
    });
  } catch (err) { why = err.message; }
  if (!round) {
    // nobody could win a quiz we didn't keep: it's taken back
    await tgCall(token, 'stopPoll', { chat_id: msg.chat.id, message_id: msg.message_id }, { timeoutMs: 3000 }).catch(() => {});
    await tgCall(token, 'deleteMessage', { chat_id: msg.chat.id, message_id: msg.message_id }, { timeoutMs: 3000 }).catch(() => {});
    throw new Error(`the quiz couldn't be kept, so it was taken back${why ? `: ${why}` : ''}`);
  }
  return { round, question: q.id, prize };
}

// Can the prize wallet pay a prize right now? (server/game-prizes.js, loaded only here) → true, false (it's known to be
// short of $AGI or ETH: said in the log), or true when the chain can't say (a prize won meanwhile waits for its claim)
async function prizeFunded(cfg, env, now) {
  if (funded.value !== null && now - funded.at < 5 * MINUTE) return funded.value;
  let ready = null;
  try { ready = await (await import('./game-prizes.js')).prizeReady(cfg, cfg.gamePrize, env); } catch (err) {
    console.warn(`[games] couldn't check the prize wallet: ${err.message}`);
  }
  funded = { at: now, value: ready?.ok !== false };
  return funded.value;
}

// Her bot must hear quiz answers: its webhook's update types include "poll" and "poll_answer" (since 2026-10-09, server/
// telegram.js connectBot). Checked once an hour per server copy; when they're missing (her bot was connected before
// games came), it's connected again right away instead of waiting for /api/feed's next run.
async function ensureUpdates(cfg, token, now) {
  if (now - updatesAt < HOUR) return;
  updatesAt = now;
  try {
    const info = await tgCall(token, 'getWebhookInfo', {}, { timeoutMs: 3000 });
    const types = Array.isArray(info?.allowed_updates) ? info.allowed_updates : null;
    if (!info?.url || !types || (types.includes('poll') && types.includes('poll_answer'))) return;
    await (await import('./telegram.js')).connectBot(cfg);
    console.log('[games] connected her bot again, so it hears quiz answers');
  } catch (err) {
    updatesAt = now - HOUR + 10 * MINUTE;            // tried again in 10 minutes
    console.warn(`[games] couldn't check that her bot hears quiz answers: ${err.message}`);
  }
}

const postHint = (err) => (err.status === 403 ? ' (is she still in that group? add her again)'
  : err.status === 400 && /not found/i.test(err.message) ? " (check TELEGRAM_GROUPS: a public group's @username, or its id)"
    : err.status === 400 && /rights|permission|not allowed|polls/i.test(err.message) ? " (the group doesn't let members send polls: allow polls in the group's permissions, or make her an admin)"
      : err.status === 429 ? ' (Telegram said "too many": next time)' : '');

// The clock's call (api/feed.js ?games, every 2 minutes): quizzes that closed without Telegram telling us, a quiz in each
// group whose turn it is, and now and then the tidy-up. → { posted, settled, failed, stopped? } · throws when the database
// can't be used
export async function gamesTick(cfg, token, { now = Date.now(), deadline = Date.now() + 19_000, env = process.env } = {}) {
  const out = { posted: 0, settled: 0, failed: 0 };
  await ensureUpdates(cfg, token, now);
  // 1. quizzes that closed over 20 s ago and nobody settled yet (a "closed" Telegram didn't send us)
  const open = await gameDb.unsettled(cfg);
  for (const poll of Array.isArray(open) ? open : []) {
    if (Date.now() > deadline - 4000) { out.stopped = 'time'; return out; }
    if ((await settleGame(cfg, token, poll, { env })) === 'settled') out.settled += 1;
  }
  // 2. a quiz in each group whose turn it is (the database decides, so two calls at once never both post)
  let recent = null, left = null;
  for (const [target, chatId] of targetsOf(cfg)) {
    if (Date.now() > deadline - 6000) { out.stopped = 'time'; break; }
    if ((await gameDb.due(cfg, target, gapMinutes(cfg))) !== true) continue;
    if (recent === null) recent = await gameDb.recent(cfg).then((r) => (Array.isArray(r) ? r : []), () => []);
    let prize = false;
    if (prizesOn(cfg)) {
      if (left === null) left = Number(await gameDb.left(cfg, cfg.gameWinsADay).catch(() => 0)) || 0;
      prize = left > 0 && await prizeFunded(cfg, env, now);
    }
    try {
      const g = await postGame(cfg, token, chatId, { prize, recent });
      recent = [...recent, g.question];
      out.posted += 1;
      console.log(`[games] a quiz in ${target}: ${g.question}${g.prize ? ` (for ${cfg.gamePrize} $AGI)` : ' (just for fun)'}`);
    } catch (err) {
      out.failed += 1;
      console.warn(`[games] couldn't post a quiz in ${target}: ${err.message}${postHint(err)}`);
    }
  }
  // 3. the tidy-up: prizes nobody claimed, old answers, quizzes, prizes and days
  if (now - tidiedAt >= 30 * MINUTE && Date.now() < deadline - 2000) {
    tidiedAt = now;
    try { await gameDb.tidy(cfg); } catch (err) { console.warn(`[games] the tidy-up didn't run: ${err.message}`); }
  }
  return out;
}

// ---------- what Telegram tells us (server/telegram.js handleUpdate) ----------
// Someone answered a quiz (Telegram allows one answer each). Kept with their first name (to name a winner) and whether
// they were right; bots and chats answering as themselves don't play. → a short word for the log and the tests
export async function onPollAnswer(cfg, pa) {
  const user = pa?.user;
  if (!cfg?.supabaseUrl || pa?.voter_chat || !user || user.is_bot || !Number.isSafeInteger(user.id) || user.id <= 0) return 'ignored';
  const poll = String(pa.poll_id ?? '');
  const option = Array.isArray(pa.option_ids) && pa.option_ids.length === 1 ? pa.option_ids[0] : null;
  if (!/^[0-9A-Za-z_-]{1,64}$/.test(poll) || !Number.isInteger(option) || option < 0 || option > 9) return 'ignored';
  try {
    const r = await gameDb.answer(cfg, poll, user.id, safeName(user) || '~', option);
    return ['ok', 'again', 'closed', 'unknown', 'bad'].includes(r) ? `game_${r}` : 'game_bad';
  } catch (err) {
    if (err.code !== 'PGRST202') console.warn(`[games] couldn't keep an answer: ${err.message}`);
    return 'busy';
  }
}

// A quiz's state changed (Telegram sends one for each answer, and when it closes). Closed: it's settled, a moment later
// (answers sent in its last second may still be on their way to us). → a short word
export async function onPollState(cfg, token, poll, { wait = 2000, env } = {}) {
  if (!poll?.is_closed || poll.type !== 'quiz' || !cfg?.supabaseUrl) return 'ignored';
  const id = String(poll.id ?? '');
  if (!/^[0-9A-Za-z_-]{1,64}$/.test(id)) return 'ignored';
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  return settleGame(cfg, token, id, { env });
}

// A quiz closed: settled once (the database draws the winner), then her result under the quiz. → 'settled' (posted, or
// tried) · 'open' (not closed yet) · 'done' (settled already, or not ours) · 'busy'
export async function settleGame(cfg, token, poll, { env = process.env } = {}) {
  let r;
  try { r = await gameDb.settle(cfg, poll, cfg.gameWinsADay, cfg.gamePrize); } catch (err) {
    console.warn(`[games] couldn't settle a quiz: ${err.message}`);
    return 'busy';
  }
  if (r?.ok !== true) return r?.why === 'open' ? 'open' : 'done';
  const winnerId = Number.isSafeInteger(Number(r.winner?.person)) ? Number(r.winner.person) : null;
  const username = winnerId ? await botUsername(token, env) : null;
  const line = resultLine(r, { winnerId, button: Boolean(username) });
  const extra = {
    reply_parameters: { message_id: Number(r.message_id), allow_sending_without_reply: true },
    ...(line.entities.length ? { entities: line.entities } : {}),
    ...(line.claim && username ? { reply_markup: { inline_keyboard: [[{ text: CLAIM_BUTTON, url: `https://t.me/${username}?start=claim` }]] } } : {}),
  };
  try {
    await say(token, Number(r.chat), line.text, extra, { timeoutMs: 4000 });
  } catch (err) {
    // a mention Telegram won't make: the same words without it
    if (extra.entities && err.status === 400) {
      delete extra.entities;
      await say(token, Number(r.chat), line.text, extra, { timeoutMs: 4000 })
        .catch((e) => console.warn(`[games] couldn't post a quiz's result: ${e.message}`));
    } else console.warn(`[games] couldn't post a quiz's result: ${err.message}`);
  }
  if (r.winner) console.log(`[games] a quiz was won (${r.right} right): prize ${r.winner.prize}`);
  return 'settled';
}
