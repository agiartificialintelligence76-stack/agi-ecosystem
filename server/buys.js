// AGI-1's $AGI buy bot (2026-10-06, the owner: "can you add a very simple buybot to the tgbot with a minimum buy of $100
// just for $AGI with robot emojis and with a gif of her … with mc, price amount of agi, etc."). Every minute Supabase Cron
// calls GET /api/feed?buys with the database's own key (supabase/buys.sql). Our server then reads $AGI's newest trades
// from clank.trade (the trades its coin page lists: since $AGI graduated, its Uniswap pool's) with ETH's price, and posts
// each new buy worth TELEGRAM_BUY_MIN dollars or more ($50, the owner's since 2026-10-06: "can you make the minimum to 50$";
// $100 at first) in her Telegram groups (TELEGRAM_GROUPS): her buy GIF (her 2D self cheering: server/media/agi1-buy.mp4,
// made by tools/buybot/make.mjs) with the buy's numbers and a robot for every $25 (server/tg-lines.js, buyLine). Read-only
// everywhere but Telegram; nothing about anyone is kept (only the trades' public ids, so each buy is posted once).
// TELEGRAM_BUYS=off: none.
//   • only $AGI, only buys, only fresh ones (a quarter of an hour at most: after a pause it never posts old buys), and each
//     once, even when two checks run at once (claimed in the database first: buy_take). A check cut short (Telegram's "too
//     many", or its time) skips the rest of its buys: never twice, at worst one missed;
//   • the first look ever only notes the buys already there (nobody gets old news);
//   • at most 6 a check (the newest, oldest first): a burst of buys never floods the group.
// (light to load, since this runs every minute: clank.trade's API from server/coins.js, never server/checker.js or
// server/clank-chain.js, which load the chain's code)
import { readFile } from 'node:fs/promises';
import { clankApi } from './coins.js';
import { rpc } from './limits.js';
import { tgCall } from './tg-api.js';
import { buyLine } from './tg-lines.js';
import { TOKENS } from '../src/prices/parse.js';

const AGI = TOKENS[0].ca;
export const ETH = '0x0000000000000000000000000000000000000000';   // clank.trade's name for ETH as a pair (ETH_PAIR in clank-chain.js)
export const SUPPLY = 1_000_000_000;          // whole $AGI: its total supply (read on Robinhood Chain, 2026-09-24)
export const FRESH_MS = 15 * 60_000;          // a buy older than this is never posted (a check that was off for a while)
export const MAX_POSTS = 6;                   // at most this many buys a check
const GIF = new URL('./media/agi1-buy.mp4', import.meta.url);
// a clank.trade trade's id ("4663:0x…:0x…:34": the chain, two hashes and the log's number), the same rule as buy_take's
export const TRADE_ID = /^[0-9]{1,10}:0x[0-9a-f]{64}:0x[0-9a-f]{64}:[0-9]{1,6}$/;
const ID = TRADE_ID;
const ADDR = /^0x[0-9a-f]{40}$/;
const TX = /^0x[0-9a-f]{64}$/;
const WEI = /^[0-9]{1,40}$/;

// this server copy's memory: the database's key (10 minutes), and Telegram's id for her GIF once it has it (so it's
// uploaded once per server copy, then sent by its id)
let key = { at: -Infinity, value: null };
let gif = { id: null, bytes: null };
export function forgetBuys() { key = { at: -Infinity, value: null }; gif = { id: null, bytes: null }; }   // (for the tests)

// The key Supabase Cron sends with each call (supabase/buys.sql made it), kept 10 minutes. Throws when the database
// can't say (buys.sql not run: err.code PGRST202)
export async function buyKey(cfg, now = Date.now()) {
  if (key.value && now - key.at < 10 * 60_000) return key.value;
  const value = await rpc(cfg, 'buy_key', {}, 'buys');
  key = { at: now, value: typeof value === 'string' && value.length >= 32 ? value : null };
  return key.value;
}

// whole units from a token amount in its smallest units (18 decimals for $AGI and ETH)
const whole = (raw) => Number(BigInt(raw)) / 1e18;

// One clank.trade trade → { id, trader, tx, side ('buy' | 'sell'), at (ms), agi, eth, usd, price, mcap }, or null (anything
// that doesn't look like a trade). (2026-10-09: sells too, for her live chart on stream: server/live.js streamMarket)
export function tradeOf(x, ethUsd) {
  if (!x || (x.side !== 'buy' && x.side !== 'sell')) return null;
  const id = String(x.id ?? '').toLowerCase(), trader = String(x.trader ?? '').toLowerCase(), tx = String(x.transactionHash ?? '').toLowerCase();
  const at = Number(x.timestamp) * 1000;
  if (!ID.test(id) || !ADDR.test(trader) || !TX.test(tx) || !(at > 0) || !WEI.test(String(x.baseAmount)) || !WEI.test(String(x.quoteAmount))) return null;
  const agi = whole(x.baseAmount), eth = whole(x.quoteAmount);
  if (!(agi > 0) || !(eth > 0) || !(ethUsd > 0)) return null;
  const usd = eth * ethUsd, price = usd / agi;
  return { id, trader, tx, side: x.side, at, agi, eth, usd, price, mcap: price * SUPPLY };
}
// One clank.trade trade → a buy { id, trader, tx, at (ms), agi, eth, usd, price, mcap }, or null (a sell, or anything
// that doesn't look like a trade)
export function buyOf(x, ethUsd) {
  const t = x?.side === 'buy' ? tradeOf(x, ethUsd) : null;
  if (!t) return null;
  const { side, ...buy } = t;
  return buy;
}

// $AGI's newest trades (50: an hour or more of trading) and ETH's price, in one request to clank.trade → its buys
export async function readBuys() {
  const [t, rate] = await clankApi([['coins.trades', { address: AGI, limit: 50 }], ['exchangeRates.tokenUsdg', { token: ETH }]], { timeoutMs: 6000 });
  const trades = t?.data?.trades;
  const ethUsd = Number(rate?.data?.price);
  if (!Array.isArray(trades)) throw new Error("clank.trade's answer had no trades");
  if (!(ethUsd > 0)) throw new Error("clank.trade's answer had no ETH price");
  return trades.map((x) => buyOf(x, ethUsd)).filter(Boolean);
}

// (2026-10-09, her live show: "her watching the live trading chart of $AGI") $AGI's newest trades, buys and sells (100: a few
// hours of trading or more), in one request to clank.trade → [trade…] (tradeOf), newest first as clank.trade lists them
export async function readTrades({ limit = 100 } = {}) {
  const [t, rate] = await clankApi([['coins.trades', { address: AGI, limit }], ['exchangeRates.tokenUsdg', { token: ETH }]], { timeoutMs: 6000 });
  const trades = t?.data?.trades;
  const ethUsd = Number(rate?.data?.price);
  if (!Array.isArray(trades)) throw new Error("clank.trade's answer had no trades");
  if (!(ethUsd > 0)) throw new Error("clank.trade's answer had no ETH price");
  return trades.map((x) => tradeOf(x, ethUsd)).filter(Boolean);
}

// where her groups are (as postToGroups sends to them): their @usernames and ids
const targetsOf = (g) => [...[...g.names].map((n) => `@${n}`), ...[...g.ids].map(Number)];

// one buy in one group: her GIF (by Telegram's id once it has it, else uploaded) and the caption. `until`: when the check
// must be done (each call waits at most until then, so the whole check ends inside Vercel's 25 s)
async function post(token, to, buy, until) {
  const { text, entities } = buyLine(buy);
  const params = { chat_id: to, caption: text, caption_entities: entities, width: 480, height: 480 };
  const wait = (ms) => Math.max(1000, Math.min(ms, until - Date.now()));
  if (gif.id) {
    try { return await tgCall(token, 'sendAnimation', { ...params, animation: gif.id }, { timeoutMs: wait(6000) }); } catch (err) {
      if (err.status !== 400 || !/file|identifier/i.test(err.message)) throw err;
      gif.id = null;                                             // Telegram forgot it: upload it again
    }
  }
  gif.bytes ??= await readFile(GIF);
  const sent = await tgCall(token, 'sendAnimation', params, { timeoutMs: wait(12_000), files: { animation: { bytes: gif.bytes, filename: 'agi1-buy.mp4', type: 'video/mp4' } } });
  gif.id = sent?.animation?.file_id || sent?.document?.file_id || null;
  return sent;
}

// The check (Supabase Cron, every minute, through api/feed.js) → { posted, buys, skipped, failed } or { off: why }.
// Throws when clank.trade or the database can't be read (nothing is posted then: the next check tries again).
export async function checkBuys(cfg, token, { now = Date.now(), deadline = now + 19_000 } = {}) {
  if (!cfg.tgGroups) return { off: 'no_groups' };
  if (!cfg.tgBuys) return { off: 'off' };
  if (!token) return { off: 'no_bot' };
  const buys = await readBuys();
  const wanted = buys.filter((b) => b.usd >= cfg.tgBuyMin && now - b.at <= FRESH_MS && b.at - now <= 2 * 60_000);
  const fresh = [...new Map(wanted.map((b) => [b.id, b])).values()];          // (a trade listed twice is still one buy)
  // claimed before anything is posted: each buy once, whatever runs at the same time (an empty list still marks the
  // bot's first look)
  const taken = await rpc(cfg, 'buy_take', { p_ids: fresh.map((b) => b.id) }, 'buys');
  const ids = new Set(Array.isArray(taken) ? taken : []);
  const ours = fresh.filter((b) => ids.has(b.id)).sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  const posts = ours.slice(-MAX_POSTS);
  const out = { posted: 0, buys: posts.length, skipped: ours.length - posts.length, failed: 0 };
  for (const buy of posts) {
    for (const to of targetsOf(cfg.tgGroups)) {
      if (Date.now() > deadline) { out.stopped = 'time'; return out; }
      try {
        await post(token, to, buy, deadline + 4_000);
        out.posted += 1;
      } catch (err) {
        out.failed += 1;
        const hint = err.status === 403 ? ' (is she still in that group? add her again)'
          : err.status === 400 && /not found/i.test(err.message) ? " (check TELEGRAM_GROUPS: a public group's @username, or its id)"
            : err.status === 429 ? ' (Telegram said "too many": the rest of this check\'s buys are skipped)' : '';
        console.warn(`[buys] couldn't post a buy in ${to}: ${err.message}${hint}`);
        if (err.status === 429) { out.stopped = 'telegram'; return out; }
      }
    }
  }
  return out;
}
