// AGI-1's feed (2026-09-29, the owner: "make her the one who texts first"): the moments she texts people about on
// Telegram, and the texting itself. api/feed.js runs it a few times a day (Vercel's cron).
//   1. gatherMoments(): what happened since the last run, as pre-written lines (server/tg-lines.js, no AI cost):
//      • new coins on clank.trade (its own list, like the risk check): an egirl / AI-girlfriend coin ("clone"; nobody
//        bought it in its first half hour → the roast the owner asked for, about the coin, never a person), or a coin using
//        $AGI's ticker (a Cyrillic "А" too) that
//        isn't the official one ("copy": jealous, with the one real contract). Never a crude-named or hidden coin, never the
//        official $AGI, never a link to another coin;
//      • $AGI's market moments, the same as on the site (a new $200K step of market cap: happy; a -20% day: sad), decided
//        the same way (marketStep, src/chat/market.js), from DexScreener;
//      • her diary: the day's new entry, as this site shows it.
//      The very first run only notes where everything is (nobody gets old news). Each moment happens once (its key).
//   2. textFirst(): each person who asked for her texts (18+, their time told) gets the best moment they haven't heard
//      about, at most one a run and 2 a day, only between 10:00 and 21:59 on their clock, while it's news (12 hours).
//      Each text is claimed in the database before it's sent (tg_claim), so two runs at once, or a run cut short, never
//      text anyone twice (at worst someone misses one). Someone who blocked the bot is forgotten. Telegram allows about
//      30 texts a second: she sends 25, paced across the whole run.
import { coinsSince } from './checker.js';
import { tickerKey } from '../src/checker/copycat.js';
import { isHiddenCoin } from './arena.js';
import { agiMarket } from './market.js';
import { marketStep } from '../src/chat/market.js';
import { diaryRpc, dayOf, entryForThisSite } from './diary.js';
import { rpc } from './limits.js';
import { say, db } from './telegram.js';
import * as L from './tg-lines.js';
import { createHash } from 'node:crypto';

const HOUR = 3_600_000, DAY = 86_400_000;
export const FRESH_HOURS = 12;                     // a moment older than this isn't news any more
export const ZERO_AFTER = 30 * 60_000;             // "nobody bought it yet" only half an hour after its launch, at the earliest
export const PER_SECOND = 25;                      // texts a second (Telegram allows about 30 for a bot)
// which moment someone gets when several are new to them: a copy of $AGI first (it's also a safety note), then the chart,
// then the egirl coins, then her diary; the newest of the same kind
export const PRIORITY = { copy: 0, mcap: 1, sad: 2, clone: 3, diary: 4 };

// An egirl or AI-girlfriend coin, by its name or ticker (a few words, not every coin with "AI" in it)
const EGIRL = /e-?girl|girl-?friend|waifu|wifey|kawaii|\buwu\b|\bgfs?\b|\bgirls?\b|\bai[\s-]?(?:gf|wife|wifu|babe)s?\b|anime[\s-]?girl|\bagi[\s-]?\d\b|artificial\s+girl/i;
// Letters from other alphabets that look like A, G and I (a copy of $AGI can hide behind a Cyrillic "А")
const LOOKALIKE = { А: 'A', а: 'A', Α: 'A', α: 'A', Ԍ: 'G', ɢ: 'G', І: 'I', і: 'I', Ι: 'I', ι: 'I', Ӏ: 'I', ӏ: 'I' };
const asLatin = (s) => String(s ?? '').replace(/[АаΑαԌɢІіΙιӀӏ]/g, (ch) => LOOKALIKE[ch]);
// → 'copy' | 'clone' | null, for a coin as the list shows it (server/checker.js)
export function coinKind(c) {
  if (!c || c.official || c.adult || isHiddenCoin(c.symbol, c.address)) return null;
  if (tickerKey(asLatin(c.symbol)) === 'AGI') return 'copy';
  return EGIRL.test(`${c.name || ''} ${c.symbol || ''}`) ? 'clone' : null;
}
// one coin → its own key; several (one run) → a short fingerprint of their addresses
const keyFor = (kind, coins) => (coins.length === 1 ? `${kind}:${coins[0].address}`
  : `${kind}s:${createHash('sha256').update(coins.map((c) => c.address).sort().join()).digest('hex').slice(0, 16)}`);

// → the moments added this run: [{ id, kind, key, text }]. Throws only when the feed's own database isn't there.
// deadline: when to stop starting slow work (api/feed.js: well inside Vercel's 25 s)
export async function gatherMoments(cfg, now = Date.now(), { deadline = Infinity } = {}) {
  const state = (await rpc(cfg, 'feed_state_get', {}, 'feed')) || {};
  const next = { ...state };
  const added = [];
  const add = async (kind, key, text) => {
    if (!text) return;
    const id = await rpc(cfg, 'feed_add', { p_kind: kind, p_key: key, p_text: text }, 'feed');
    if (id) added.push({ id: Number(id), kind, key, text });
  };

  // 1. new coins on clank.trade (the saved position moves on only once its moments are saved: a hiccup is retried)
  try {
    const since = Number(state.since) || 0;
    const { coins, newest, complete } = await coinsSince(since || now, { maxPages: since ? 5 : 1, deadline, now });
    if (since) {
      if (!complete) console.warn('[feed] more new coins than one run reads: the oldest of them are skipped');
      const fresh = coins.filter((c) => now - c.createdAt < FRESH_HOURS * HOUR);
      const copies = fresh.filter((c) => coinKind(c) === 'copy');
      const clones = fresh.filter((c) => coinKind(c) === 'clone')
        .map((c) => ({ ...c, symbol: L.tgTicker(c.symbol), zero: c.progress === 0 && now - c.createdAt >= ZERO_AFTER }))
        .filter((c) => c.symbol);
      if (copies.length) await add('copy', keyFor('copy', copies), L.copyLine(copies));
      if (clones.length) { const key = keyFor('clone', clones); await add('clone', key, L.cloneLine(clones, key)); }
    }
    next.since = Math.max(since, newest) || now;
  } catch (err) {
    if (err.code === 'PGRST202') throw err;
    console.warn(`[feed] couldn't read clank.trade's newest coins: ${err.message}`);
  }

  // 2. $AGI's market moments (the same rules as the site's)
  try {
    const market = Date.now() < deadline ? await agiMarket(now) : null;
    if (market) {
      const { state: m, moment } = marketStep(state.market, { mcap: market.mcap, h24: market.h24, now });
      if (moment?.kind === 'milestone') await add('mcap', `mcap:${moment.step}`, L.mcapLine(moment.step));
      if (moment?.kind === 'dump') await add('sad', `sad:${dayOf(now)}`, L.sadLine(Math.floor(now / DAY)));
      next.market = m;
    }
  } catch (err) {
    if (err.code === 'PGRST202') throw err;
    console.warn(`[feed] market moment skipped: ${err.message}`);
  }

  // 3. her diary's new entry (written each night by /api/keepalive)
  try {
    const [latest] = (Date.now() < deadline ? await diaryRpc(cfg, 'diary_list', { p_before: dayOf(now + DAY), p_limit: 1 }) : null) || [];
    if (latest?.day) {
      if (state.diary && latest.day > state.diary && latest.day >= dayOf(now - DAY)) {
        await add('diary', `diary:${latest.day}`, L.diaryLine(entryForThisSite(latest).entry));
      }
      if (!state.diary || latest.day > state.diary) next.diary = latest.day;
    }
  } catch (err) {
    if (err.code === 'PGRST202') throw err;
    console.warn(`[feed] diary skipped: ${err.message}`);
  }

  await rpc(cfg, 'feed_state_put', { p_state: next }, 'feed');
  return added;
}

// The moment someone gets from the ones new to them
export const bestOf = (moments) => [...moments].sort((a, b) =>
  (PRIORITY[a.kind] ?? 9) - (PRIORITY[b.kind] ?? 9) || Number(b.id) - Number(a.id))[0];

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// She texts first. → { moments, sent, gone, stopped: null | 'telegram_busy' | 'time' }
// deadline: when to stop starting new batches (api/feed.js: well inside Vercel's 25 s)
export async function textFirst(cfg, token, now = Date.now(), { deadline = Date.now() + 14_000, perSecond = PER_SECOND } = {}) {
  const moments = ((await rpc(cfg, 'feed_recent', { p_hours: FRESH_HOURS }, 'feed')) || [])
    .filter((m) => m && Number(m.id) > 0 && typeof m.text === 'string' && m.text);
  const out = { moments: moments.length, sent: 0, gone: 0, stopped: null };
  if (!moments.length) return out;
  const newest = Math.max(...moments.map((m) => Number(m.id)));
  let after = 0, lastBatch = 0;
  const pace = async () => {                                    // at most `perSecond` texts a second, across the whole run
    const wait = lastBatch + 1000 - Date.now();
    if (lastBatch && wait > 0) await sleep(wait);
    lastBatch = Date.now();
  };
  while (!out.stopped) {
    if (Date.now() > deadline) { out.stopped = 'time'; break; }
    const rows = await db.due(cfg, newest, after, 200);
    if (!Array.isArray(rows) || !rows.length) break;
    after = rows.at(-1).chat_id;
    const jobs = [];
    for (const r of rows) {
      const them = L.theirTime(now, Number(r.tz_minutes) || 0);
      const today = r.day === them.day ? Number(r.sent) || 0 : 0;
      const fresh = moments.filter((m) => Number(m.id) > Number(r.seen_id));
      // not now (their night, or 2 texts already today): they stay due, and get it later if it's still news
      if (!fresh.length || !L.inWindow(them.hour) || today >= L.TEXTS_A_DAY) continue;
      jobs.push({ chat: r.chat_id, moment: bestOf(fresh), from: Number(r.seen_id), day: them.day, sent: today + 1, was: { day: r.day ?? null, sent: Number(r.sent) || 0 } });
    }
    for (let i = 0; i < jobs.length && !out.stopped; i += perSecond) {
      if (Date.now() > deadline) { out.stopped = 'time'; break; }
      await pace();
      const batch = jobs.slice(i, i + perSecond);
      // claimed first: another run that got here first keeps its claim, and this one skips those people
      const won = new Set((await db.claim(cfg, batch.map((j) => ({ chat: j.chat, from: j.from, seen: newest, day: j.day, sent: j.sent })))) || []);
      const mine = batch.filter((j) => won.has(j.chat));
      const results = await Promise.allSettled(mine.map((j) => say(token, j.chat, j.moment.text, {}, { timeoutMs: 4000 })));
      const gone = [], giveBack = [];
      results.forEach((res, k) => {
        const j = mine[k];
        if (res.status === 'fulfilled') out.sent += 1;
        else if (res.reason?.gone) { gone.push({ chat: j.chat, gone: true }); out.gone += 1; }
        else if (res.reason?.status === 429) {                // not sent: given back, it goes out next run
          giveBack.push({ chat: j.chat, from: newest, seen: j.from, day: j.was.day, sent: j.was.sent });
          out.stopped = 'telegram_busy';
        } else console.warn(`[feed] a text may not have gone out (not tried again, so never twice): ${res.reason?.message}`);
      });
      if (gone.length) await db.mark(cfg, gone);
      if (giveBack.length) await db.claim(cfg, giveBack);
    }
    if (rows.length < 200) break;
  }
  if (out.stopped === 'telegram_busy') console.warn('[feed] Telegram said "too many" for now: the rest of the texts wait for the next run');
  return out;
}
