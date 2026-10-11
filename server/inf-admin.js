// AGI Studio's owner's tab (round 4, phase 2, 2026-10-11; the owner's list: "API balances, stats, top-up links, low-balance
// Telegram alerts, roles"). Only for the owner (STUDIO_OWNER, else the first of STUDIO_ONLY_FOR); this file's words (the AI
// services' names, their addresses) only ever reach the owner's page and the owner's own Telegram chats.
//   • the balances our server can read: fal.ai's (its billing API: FAL_BILLING_KEY, a key with billing access, else FAL_KEY),
//     Meshy's credits (MESHY_API_KEY), the prize wallet ($AGI and ETH), the gas wallet (ETH), and the USDG in the studio's
//     wallet (STUDIO_PAY_TO: what credits brought in). Each with its top-up link and, for the ones that run out, the level
//     under which the owner hears about it (editable, kept in the database); and links for what has no balance to read
//     (Gemini's prepaid credits, Google Cloud, Supabase, Vercel, Pinata).
//   • the numbers: influencers, what was made (today, this week; its AI cost, an estimate), credits bought and given, likes,
//     3D models this month, support, reports, bans.
//   • alerts on Telegram, from her bot (the owner's link: /start with a signed, day-long code): a balance under its level (to
//     the owner's chats only, at most every 6 hours each), and new support tickets and reports for the team (counts and the
//     mod page's address, never anything anyone wrote), at most every 5 minutes. The studio's clock checks them (api/feed.js).
import { createHmac, timingSafeEqual } from 'node:crypto';
import { privateKeyToAccount } from 'viem/accounts';
import { rpc } from './limits.js';
import { chain } from './hot-wallet.js';
import { prizeWallet } from './game-prizes.js';
import { agiBalance } from './chain.js';
import { USDG, usdgDecimals } from './studio-chain.js';
import { tgToken, say } from './tg-api.js';
import { botUsername } from './games.js';
import { studioWallet } from './studio.js';
import { teamList } from './inf-team.js';

export const ADMIN = {
  BALANCES_EVERY_S: 1800,        // the clock reads the balances at most every 30 minutes
  LOW_EVERY_S: 6 * 3600,         // each low balance alerted at most every 6 hours
  NEWS_EVERY_S: 300,             // the team hears about new tickets and reports at most every 5 minutes
  TIMEOUT_MS: 4000,
  LINK_MS: 24 * 3600_000,        // an alerts link works for a day
  CACHE_MS: 60_000,              // the owner's page reads the balances at most once a minute per server copy
};
// when a balance is low (the owner's own levels replace these): fal.ai in dollars (a few videos), Meshy's credits (two 3D
// models), the prize wallet's $AGI (a spotlight prize and a day of quiz prizes) and ETH (its network fees), the gas wallet's ETH
export const THRESHOLDS = { fal: 10, meshy: 120, prize_agi: 12_500, prize_eth: 0.0005, gas_eth: 0.002 };
const LIMITS = { fal: 100_000, meshy: 10_000_000, prize_agi: 1_000_000_000, prize_eth: 100, gas_eth: 100 };
// …as the owner's page names them (its levels' boxes: their unit, a step for the arrows, the most). Here, not in the page:
// the page's own words never name an AI service, and the owner's tab gets them from our server.
export const LEVELS = [
  { key: 'fal', name: "fal.ai's balance", unit: 'USD', step: 1, max: LIMITS.fal },
  { key: 'meshy', name: "Meshy's credits", unit: 'credits', step: 10, max: LIMITS.meshy },
  { key: 'prize_agi', name: "The prize wallet's $AGI", unit: '$AGI', step: 500, max: LIMITS.prize_agi },
  { key: 'prize_eth', name: "The prize wallet's ETH", unit: 'ETH', step: 0.0001, max: LIMITS.prize_eth },
  { key: 'gas_eth', name: "The gas wallet's ETH", unit: 'ETH', step: 0.0001, max: LIMITS.gas_eth },
];
// what to do about a balance that can't be read (its state), for the owner: which setting, and where
const NOTES = {
  fal: {
    off: 'Not set up: FAL_KEY in Vercel (fal.ai → API Keys), then Redeploy. Nothing is made without it.',
    no_access: "Its key can't read the balance: make a second key at fal.ai → API Keys with billing access, put it in Vercel as FAL_BILLING_KEY, then Redeploy. (Making things works without it.)",
  },
  meshy: {
    off: 'Not set up: MESHY_API_KEY in Vercel (3D models), then Redeploy.',
    no_access: 'Meshy refused its key: make a new one in Meshy, put it in Vercel as MESHY_API_KEY, then Redeploy.',
  },
  prize: { off: 'Not set up: PRIZE_WALLET_KEY in Vercel (quiz and spotlight prizes). Without it, prizes are off.' },
  gas: { off: 'Not set up: LAUNCH_GAS_KEY in Vercel (launch fees paid back). Without it, nothing is paid back.' },
  payto: { off: 'Not set up: STUDIO_PAY_TO in Vercel (your wallet address, where USDG for credits goes). Without it, nobody can buy credits.' },
};
export const balanceNote = (b) => NOTES[b?.id]?.[b?.state] || null;
const SITE = 'https://www.agi1.app';
const EXPLORER = (a) => `https://robinhoodchain.blockscout.com/address/${a}`;
// what has no balance our server can read: where the owner looks
export const LINKS = [
  { id: 'gemini', name: 'Gemini (the chat, her voice, the AI checks, captions, the helper)', link: 'https://aistudio.google.com/', text: 'Google AI Studio → Billing ↗' },
  { id: 'gcloud', name: 'Google Cloud (her live show\'s voice)', link: 'https://console.cloud.google.com/billing', text: 'Google Cloud → Billing ↗' },
  { id: 'supabase', name: 'Supabase (the database and the files)', link: 'https://supabase.com/dashboard', text: 'Supabase → the project → Usage ↗' },
  { id: 'vercel', name: 'Vercel (the site)', link: 'https://vercel.com/dashboard', text: 'Vercel → Usage ↗' },
  { id: 'pinata', name: 'Pinata (launched coins\' pictures)', link: 'https://app.pinata.cloud/', text: 'Pinata ↗' },
];
// the AI's own cost of each kind of thing made, in dollars (an estimate: fal's and Meshy's prices, 2026-10-10): its looks (4
// pictures), its full body, a photo, an X banner (2K), a trend video (up to 10 s), a video (with or without sound, or from its
// full body), the owner's trend clips and example pictures
export const AI_COST = { looks: 0.32, body: 0.08, photo: 0.08, banner: 0.12, trend: 1.0, video: 0.9, preset: 1.26, example: 0.08, model: 1.18 };

const ms = (t) => { const n = Date.parse(t ?? ''); return Number.isFinite(n) ? n : null; };
const n0 = (x) => Math.max(0, Number(x) || 0);
// (balances: a few decimals is all the page shows; a whole number stays whole: 50,000 $AGI is 50000, never 49999.99999999999)
const units = (raw, decimals) => {
  if (typeof raw !== 'bigint') return Number(raw) / 10 ** decimals;
  const d = 10n ** BigInt(decimals);
  return Number(raw / d) + Number(raw % d) / 10 ** decimals;
};

// ---------- the owner's levels ----------
export async function thresholdsOf(cfg) {
  const kept = await rpc(cfg, 'inf_admin_get', { p_key: 'thresholds' }, 'studio').catch((err) => {
    if (err?.code !== 'PGRST202') console.warn(`[studio] the owner's alert levels: ${err?.message}`);
    return null;
  });
  const out = { ...THRESHOLDS };
  for (const k of Object.keys(THRESHOLDS)) {
    const v = Number(kept?.[k]);
    if (kept && Object.hasOwn(kept, k) && Number.isFinite(v) && v >= 0 && v <= LIMITS[k]) out[k] = v;
  }
  return out;
}
// The owner's own levels (any of them; 0 = never alerted). → { ok: true, thresholds } or { ok: false, why: 'bad' | 'busy' }
export async function setThresholds(cfg, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, why: 'bad' };
  const now = await thresholdsOf(cfg);
  for (const [k, v] of Object.entries(input)) {
    const n = Number(v);
    if (!Object.hasOwn(THRESHOLDS, k) || v === null || v === '' || !Number.isFinite(n) || n < 0 || n > LIMITS[k]) return { ok: false, why: 'bad' };
    now[k] = n;
  }
  const r = await rpc(cfg, 'inf_admin_set', { p_key: 'thresholds', p_value: now }, 'studio');
  return r === true ? { ok: true, thresholds: now } : { ok: false, why: 'busy' };
}

// ---------- the balances ----------
async function getJson(url, headers) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(ADMIN.TIMEOUT_MS) });
  if (!res.ok) {
    res.body?.cancel().catch(() => {});
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}
const failed = (err) => (err?.status === 401 || err?.status === 403 ? 'no_access'
  : err?.name === 'TimeoutError' || err?.name === 'AbortError' ? 'timeout' : 'error');

async function falBalance(cfg) {
  const key = cfg.falBillingKey || cfg.falKey;
  const base = { id: 'fal', name: 'fal.ai (pictures and videos)', unit: 'USD', link: 'https://fal.ai/dashboard/billing', text: 'Top up at fal.ai ↗' };
  if (!key) return { ...base, state: 'off' };
  try {
    const d = await getJson('https://api.fal.ai/v1/account/billing?expand=credits', { Authorization: `Key ${key}` });
    const v = Number(d?.credits?.current_balance);
    if (!Number.isFinite(v)) return { ...base, state: 'error' };
    return { ...base, state: 'ok', value: v, unit: typeof d?.credits?.currency === 'string' ? d.credits.currency.slice(0, 6) : 'USD' };
  } catch (err) {
    // (a key without billing access: FAL_BILLING_KEY, a key whose permissions include billing, reads it)
    return { ...base, state: failed(err), ...(failed(err) === 'no_access' ? { hint: 'billing' } : {}) };
  }
}
async function meshyBalance(cfg) {
  const base = { id: 'meshy', name: 'Meshy (3D models)', unit: 'credits', link: 'https://www.meshy.ai/', text: 'Open Meshy ↗' };
  if (!cfg.meshyKey) return { ...base, state: 'off' };
  try {
    const d = await getJson('https://api.meshy.ai/openapi/v1/balance', { Authorization: `Bearer ${cfg.meshyKey}` });
    const v = Number(d?.balance);
    return Number.isFinite(v) ? { ...base, state: 'ok', value: v } : { ...base, state: 'error' };
  } catch (err) {
    return { ...base, state: failed(err) };
  }
}
async function ethOf(address, env) {
  const hex = await chain('eth_getBalance', [address, 'latest'], env, ADMIN.TIMEOUT_MS);
  return units(BigInt(hex), 18);
}
async function prizeBalance(cfg, env) {
  const address = prizeWallet(cfg);
  const base = { id: 'prize', name: 'The prize wallet (quiz and spotlight prizes)', unit: '$AGI' };
  if (!address) return { ...base, state: 'off' };
  try {
    const [agi, eth] = await Promise.all([agiBalance(address, env), ethOf(address, env)]);
    return { ...base, state: 'ok', value: units(agi.raw, agi.decimals), eth, address, link: EXPLORER(address), text: 'See it, and its address ↗' };
  } catch {
    return { ...base, state: 'error', address, link: EXPLORER(address), text: 'See it, and its address ↗' };
  }
}
async function gasBalance(cfg, env) {
  const base = { id: 'gas', name: 'The gas wallet (launch fees paid back)', unit: 'ETH' };
  if (!cfg.launchGasKey) return { ...base, state: 'off' };
  const address = privateKeyToAccount(cfg.launchGasKey).address.toLowerCase();
  try {
    return { ...base, state: 'ok', value: await ethOf(address, env), address, link: EXPLORER(address), text: 'See it, and its address ↗' };
  } catch {
    return { ...base, state: 'error', address, link: EXPLORER(address), text: 'See it, and its address ↗' };
  }
}
async function payToBalance(cfg, env) {
  const base = { id: 'payto', name: "The studio's wallet (USDG for credits)", unit: 'USDG', info: true };
  const address = cfg.studioPayTo;
  if (!address) return { ...base, state: 'off' };
  try {
    const [hex, decimals] = await Promise.all([
      chain('eth_call', [{ to: USDG, data: `0x70a08231${address.slice(2).padStart(64, '0')}` }, 'latest'], env, ADMIN.TIMEOUT_MS), usdgDecimals(env),
    ]);
    return { ...base, state: 'ok', value: units(BigInt(hex === '0x' ? 0 : hex), decimals), address, link: EXPLORER(address), text: 'See it ↗' };
  } catch {
    return { ...base, state: 'error', address, link: EXPLORER(address), text: 'See it ↗' };
  }
}
// The levels on a list of readings (a copy): each balance's level ('low': the prize wallet's { agi, eth }), and 'low' for a
// reading under it. (Kept apart from reading them, so a new level shows at once on the owner's page.)
export function withLevels(list, thresholds = THRESHOLDS) {
  const lowOf = (v, level) => level > 0 && Number.isFinite(v) && v < level;
  return list.map((raw) => {
    const b = { ...raw };
    if (b.state === 'low') b.state = 'ok';
    const note = balanceNote(b);
    if (note) b.note = note; else delete b.note;
    if (b.id === 'fal') b.low = thresholds.fal;
    if (b.id === 'meshy') b.low = thresholds.meshy;
    if (b.id === 'gas') b.low = thresholds.gas_eth;
    if (b.id === 'prize') b.low = { agi: thresholds.prize_agi, eth: thresholds.prize_eth };
    if (b.state !== 'ok' || b.info) return b;
    const low = b.id === 'prize' ? lowOf(b.value, b.low.agi) || lowOf(b.eth, b.low.eth) : lowOf(b.value, b.low);
    if (low) b.state = 'low';
    return b;
  });
}
// Every balance, each with its state: 'ok' | 'low' (under the owner's level) | 'off' (not set up) | 'no_access' | 'timeout' |
// 'error' (couldn't be read just now), and its level (low; the prize wallet: { agi, eth })
export async function balances(cfg, { thresholds = THRESHOLDS, env = process.env } = {}) {
  const list = await Promise.all([falBalance(cfg), meshyBalance(cfg), prizeBalance(cfg, env), gasBalance(cfg, env), payToBalance(cfg, env)]);
  return withLevels(list, thresholds);
}

// ---------- the numbers ----------
const kinds = (x) => Object.fromEntries(Object.keys(AI_COST).filter((k) => k !== 'model').map((k) => [k, n0(x?.[k])]));
const costOf = (jobs, models = 0) => Math.round((Object.entries(jobs).reduce((s, [k, n]) => s + (AI_COST[k] || 0) * n, 0) + AI_COST.model * models) * 100) / 100;
export async function adminStats(cfg) {
  const s = await rpc(cfg, 'inf_admin_stats', {}, 'studio');
  const today = kinds(s?.jobs_today), week = kinds(s?.jobs_week);
  return {
    infs: { ready: n0(s?.infs?.ready), today: n0(s?.infs?.today), week: n0(s?.infs?.week), making: n0(s?.infs?.making) },
    today, week, failedToday: n0(s?.failed_today), making: n0(s?.making),
    // the AI's own cost of what was made (an estimate), and what credits brought in (1 credit = 1 cent)
    aiCost: { today: costOf(today), week: costOf(week) },
    credits: {
      boughtToday: n0(s?.credits?.bought_today), boughtWeek: n0(s?.credits?.bought_week), boughtMonth: n0(s?.credits?.bought_month),
      spentWeek: n0(s?.credits?.spent_week), freeMonth: n0(s?.credits?.free_month), giftsMonth: n0(s?.credits?.gifts_month),
      // (round 4, phase 3) bought credits passed on as gifts this week, gift links waiting, invites' rewards and the wallets
      // that joined through an invite this month
      giftedWeek: n0(s?.credits?.gifted_week), linksOpen: n0(s?.credits?.links_open), rewardsMonth: n0(s?.credits?.rewards_month),
      invitedMonth: n0(s?.credits?.invited_month),
    },
    walletsWeek: n0(s?.wallets_week), likesWeek: n0(s?.likes_week), modelsMonth: n0(s?.models_month),
    tickets: { open: n0(s?.tickets?.open), answered: n0(s?.tickets?.answered) }, reports: n0(s?.reports), bans: n0(s?.bans),
    helpsToday: n0(s?.helps_today),
  };
}

// ---------- alerts on Telegram ----------
// The owner's link (and a team member's, from the mod page): her bot's /start with a code that says who and until when,
// signed with PASS_SECRET (64 characters at most, Telegram's rule). "a" + 'o' (the owner) or 's' (a team member: the first 16
// characters of their wallet's code) + until when (base 36, seconds) + its signature.
const b64 = (buf) => Buffer.from(buf).toString('base64url');
const sign = (secret, body) => b64(createHmac('sha256', String(secret)).update(`agi-studio-alerts:${body}`).digest()).slice(0, 16);
export function alertsCode(cfg, { who, now = Date.now() }) {
  const until = Math.floor((now + ADMIN.LINK_MS) / 1000).toString(36).padStart(7, '0');
  const body = who === 'owner' ? `o${until}` : `s${until}${String(who).slice(0, 16)}`;
  return `a${body}${sign(cfg.passSecret, body)}`;
}
const CODE = /^a([os])([0-9a-z]{7})([A-Za-z0-9_-]{16})?([A-Za-z0-9_-]{16})$/;
// → { who: 'owner' } · { who: 'staff', prefix } · null (not one, or expired, or not ours)
export function readAlertsCode(cfg, text, now = Date.now()) {
  const m = CODE.exec(String(text ?? '').trim());
  if (!m || (m[1] === 'o') !== !m[3]) return null;
  const body = `${m[1]}${m[2]}${m[3] || ''}`;
  const want = Buffer.from(sign(cfg.passSecret, body)), got = Buffer.from(m[4]);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  if (parseInt(m[2], 36) * 1000 < now) return null;
  return m[1] === 'o' ? { who: 'owner' } : { who: 'staff', prefix: m[3] };
}
export async function alertsLink(cfg, { who, now = Date.now(), token = tgToken() } = {}) {
  if (!token) return null;
  const bot = await botUsername(token);
  return bot ? `https://t.me/${bot}?start=${alertsCode(cfg, { who, now })}` : null;
}
export const ALERT_WORDS = {
  on: (who) => `AGI Studio alerts are on for this chat 💜 ${who === 'owner'
    ? 'You\'ll hear when a balance runs low, and about new support tickets and reports.'
    : who === 'mod' ? 'You\'ll hear about new support tickets and reports.' : 'You\'ll hear about new support tickets.'} /stop turns them off.`,
  expired: 'That alerts link expired (they last a day): get a new one on the page you got it from.',
  not_staff: "That alerts link is for someone who isn't on AGI Studio's team any more.",
  too_many: 'That account has 5 chats with alerts already: /stop in one of them first.',
};
// /start with an alerts code, in her bot's private chat. → what to say
export async function alertsStart(cfg, chat, text, now = Date.now()) {
  const c = readAlertsCode(cfg, text, now);
  if (!c) return ALERT_WORDS.expired;
  let who = 'owner', role = 'owner';
  if (c.who === 'staff') {
    const member = (await teamList(cfg)).find((t) => String(t.code).startsWith(c.prefix));
    if (!member) return ALERT_WORDS.not_staff;
    who = member.code;
    role = member.role;
  }
  const r = await rpc(cfg, 'inf_alert_add', { p_chat: chat, p_who: who }, 'studio');
  if (r?.ok === true) return ALERT_WORDS.on(role);
  return r?.why === 'too_many' ? ALERT_WORDS.too_many : ALERT_WORDS.not_staff;
}
// /stop: a chat's alerts off too (and a chat that blocked her bot). → true when it had them
export async function alertsOff(cfg, chat) {
  try { return (await rpc(cfg, 'inf_alert_off', { p_chat: chat }, 'studio')) === true; } catch (err) {
    if (err?.code !== 'PGRST202') console.warn(`[studio] turning a chat's alerts off: ${err?.message}`);
    return false;
  }
}
async function tell(cfg, token, chats, text, deadline) {
  let sent = 0;
  for (const chat of chats) {
    if (Date.now() > deadline) break;
    try { await say(token, chat, text, {}, { timeoutMs: Math.max(1000, Math.min(4000, deadline - Date.now())) }); sent += 1; } catch (err) {
      if (err.gone) await alertsOff(cfg, chat);
      else console.warn(`[studio] an alert couldn't be sent: ${err.message}`);
    }
  }
  return sent;
}
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const newsText = ({ tickets, reports, waiting, open }, role) => {
  const lines = [];
  if (tickets) lines.push(`🎫 ${plural(tickets, 'support ticket')} waiting for the team (${waiting} in all)`);
  if (reports && role !== 'support') lines.push(`🚩 ${plural(reports, 'new report')} (${open} to look at)`);
  return lines.length ? `AGI Studio 💜\n${lines.join('\n')}\n${SITE}/studio/mod` : null;
};
const money = (v, unit) => (unit === 'USD' ? `$${v.toFixed(2)}` : unit === 'ETH' ? `${v.toFixed(4)} ETH` : `${Math.floor(v).toLocaleString('en-US')} ${unit}`);
export function lowText(b) {
  const what = b.id === 'prize'
    ? `${money(b.value, '$AGI')} and ${money(b.eth, 'ETH')} (your alert: under ${money(b.low.agi, '$AGI')} or ${money(b.low.eth, 'ETH')})`
    : `${money(b.value, b.unit)} (your alert: under ${money(b.low, b.unit)})`;
  return `AGI Studio ⚠️ ${b.name} is low: ${what}.\nTop it up: ${b.link}\nYour balances: ${SITE}/studio/owner`;
}
// The studio's clock (api/feed.js, every minute): the team's news, at most every 5 minutes; the balances, at most every 30
// minutes (each low one to the owner's chats, at most every 6 hours). → what it did
export async function adminClock(cfg, { now = Date.now(), deadline = Date.now() + 6000, env = process.env } = {}) {
  const token = tgToken(env);
  if (!token) return { off: 'no_bot' };
  const out = { news: 0, low: 0 };
  let chats = null;
  const chatsNow = async () => {
    if (!chats) {
      const list = await rpc(cfg, 'inf_alert_chats', {}, 'studio');
      chats = (Array.isArray(list) ? list : []).map((c) => ({ chat: Number(c.chat), who: c.who })).filter((c) => Number.isSafeInteger(c.chat) && c.chat > 0);
    }
    return chats;
  };
  const claim = (key, secs) => rpc(cfg, 'inf_admin_claim', { p_key: key, p_secs: secs }, 'studio');
  const c = await claim('alert:news', ADMIN.NEWS_EVERY_S);
  if (c?.ok === true) {
    const since = ms(c.prev) ?? now - ADMIN.NEWS_EVERY_S * 1000;
    const news = await rpc(cfg, 'inf_mod_news', { p_since: new Date(since).toISOString() }, 'studio');
    const counts = { tickets: n0(news?.tickets), reports: n0(news?.reports), waiting: n0(news?.waiting), open: n0(news?.open_reports) };
    if (counts.tickets || counts.reports) {
      const list = (await chatsNow()).filter((x) => ['owner', 'mod', 'support'].includes(x.who));
      for (const role of ['owner', 'mod', 'support']) {
        const text = newsText(counts, role);
        if (text) out.news += await tell(cfg, token, list.filter((x) => x.who === role).map((x) => x.chat), text, deadline - 1000);
      }
    }
  }
  if (Date.now() < deadline - 4500) {
    const b = await claim('alert:balances', ADMIN.BALANCES_EVERY_S);
    if (b?.ok === true) {
      const owners = (await chatsNow()).filter((x) => x.who === 'owner').map((x) => x.chat);
      if (owners.length) {
        for (const x of (await balances(cfg, { thresholds: await thresholdsOf(cfg), env })).filter((y) => y.state === 'low')) {
          if (Date.now() > deadline - 1500) break;
          const l = await claim(`alert:low:${x.id}`, ADMIN.LOW_EVERY_S);
          if (l?.ok === true) out.low += await tell(cfg, token, owners, lowText(x), deadline - 500);
        }
      }
    }
  }
  return out;
}

// ---------- the owner's page ----------
let kept = { at: -Infinity, list: null };
export const _resetAdmin = () => { kept = { at: -Infinity, list: null }; };
// → { stats, balances, thresholds, levels, links, team, read, alerts: { link, chats } }
export async function adminPage(cfg, { now = Date.now(), fresh = false, env = process.env } = {}) {
  const thresholds = await thresholdsOf(cfg);
  const [stats, team, chats, link] = await Promise.all([
    adminStats(cfg), teamList(cfg), rpc(cfg, 'inf_alert_chats', {}, 'studio'), alertsLink(cfg, { who: 'owner', now }),
  ]);
  if (fresh || !kept.list || now - kept.at > ADMIN.CACHE_MS) kept = { at: now, list: await balances(cfg, { thresholds, env }) };
  // (the levels as they are now: a change shows at once, without reading the balances again)
  const list = withLevels(kept.list, thresholds);
  return {
    stats, balances: list, thresholds, levels: LEVELS, links: LINKS, team, read: kept.at,
    alerts: { link, chats: (Array.isArray(chats) ? chats : []).filter((c) => c.who === 'owner').length },
  };
}
export const ownerCode = (cfg) => (cfg.studioOwner ? studioWallet(cfg.passSecret, cfg.studioOwner) : null);
