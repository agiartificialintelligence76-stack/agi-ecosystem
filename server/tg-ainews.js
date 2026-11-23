// AI News World in AGI-1's Telegram bot (private chat + allowed Telegram groups).
//   • /ainews [weights|tools|alerts|off|<topic>]: live global AI dispatches, open-weight
//     GitHub/HF repos, and @theAIsearch extracted AI tools with interactive inline tabs.
//   • Personal automatic Telegram DM alerts: users tap "Get Alerts" on /ainews, tap the
//     "Get Alerts on Telegram" button on agi1.app/ainews (/start ainews), or type
//     /ainews alerts to get notified automatically whenever a new AI model, breaking AI
//     news drop, or @theAIsearch video lands. /stop or "Pause Alerts" unsubscribes instantly.
//   • Automatic breaking AI drops posted to configured Telegram groups (`TELEGRAM_GROUPS`).
//   • Zero extra SQL migration: subscriber chat IDs & dedupe keys live compactly in
//     `public.agi1_feed_state.state.ainewsTg` (strictly capped under PostgreSQL's 20 KB limit).
//   • Plain text + validated Telegram `text_link` entities only (no Markdown/HTML parsing,
//     no link previews, PG-13, no financial advice, no non-$AGI tickers or wallet addresses).
//   • Switches: `TELEGRAM_AINEWS=off` disables /ainews everywhere; `TELEGRAM_AINEWS_POSTS=off`
//     disables automatic group broadcasts while keeping on-demand /ainews & DM alerts working.
import { tgCall, say, chatCode, siteBase } from './tg-api.js';
import { makeBurstLimit } from './burst.js';
import { getAiNewsSnapshot, classifyItem, safeHttpUrl } from './ainews.js';
import { getGeminiNewsPulse } from './ainews-pulse.js';
import { botName } from '../src/chat/telegram-link.js';

export const ainewsOn = (cfg) => cfg?.tgAiNews === true;
export const aiNewsPostsOn = (cfg) => cfg?.tgAiNews === true && cfg?.tgAiNewsPosts === true && cfg?.tgGroupPosts === true && Boolean(cfg?.tgGroups);

export const HELP_AINEWS = '/ainews: live global AI news, open weights, AI tools & instant alerts';
export const GROUP_AINEWS = '/ainews: live global AI news, open weights & @theAIsearch tools (try /ainews weights or /ainews tools)';

export const AINEWS_GAPS = Object.freeze({
  groupCmd: 30_000,
  groupSearch: 10_000,
  refresh: 15_000,
  privateTap: 1_500,
  broadcastMin: 25 * 60_000,
});

export const AINEWS_TOAST = Object.freeze({
  top: '🌐 Loading breaking global AI news…',
  weights: '🧠 Loading open weights & GitHub repos…',
  tools: '🛠️ Loading @theAIsearch tools…',
  refresh: '🔄 Syncing live AI feeds…',
  subOn: '🔔 AI News alerts ON! I will DM you when new models or breaking AI news drops 💜',
  subOff: '🔕 AI News alerts paused. Tap again anytime to turn back on.',
  subFull: 'AI News alert list is full right now 🙈 try again soon or use /ainews anytime',
  subUnavailable: "couldn't save your alert preference just now 🙈 try again in a moment",
  wait: 'give it a few seconds before refreshing again 💜',
  off: 'AI news is taking a little break right now 🙈',
  failed: "couldn't load live AI news just now 🙈 try again in a minute",
});

export const MAX_DM_SUBS = 400;
const MAX_STATE_BYTES = 18_500;
const OTHER_COIN_RE = /\$(?!agi\b)[a-z]/i;
const WALLET_ADDR_RE = /0x[0-9a-f]{6}/i;
const MAX_SEEN = 32;
const MAX_BROADCAST_ITEMS = 3;
const MAX_BROADCAST_AGE_MS = 24 * 60 * 60 * 1000;
const SUPABASE_TIMEOUT_MS = 3500;
const PER_SECOND = 25;

// ---------- In-memory spam guards & bot username cache ----------

const stamp = new Map();
const tapBurst = makeBurstLimit({ max: 6, windowMs: 60_000 });
let cachedBot = { at: -Infinity, username: null };

export function forgetTgAiNews() {
  stamp.clear();
  tapBurst.reset();
  cachedBot = { at: -Infinity, username: null };
}

function recent(key, now, gapMs) {
  return now - (stamp.get(key) ?? -Infinity) < gapMs;
}

function mark(key, now) {
  stamp.delete(key);
  if (stamp.size >= 5000) stamp.delete(stamp.keys().next().value);
  stamp.set(key, now);
}

const topicOf = (m) => (m?.is_topic_message === true && Number.isSafeInteger(m.message_thread_id)
  ? { message_thread_id: m.message_thread_id }
  : {});

export async function resolveBotUsername(token, env = process.env, now = Date.now()) {
  const fromEnv = botName(env?.VITE_TELEGRAM_BOT);
  if (fromEnv) return fromEnv;
  if (!token) return null;
  if (cachedBot.username || now - cachedBot.at < 10 * 60_000) return cachedBot.username;
  cachedBot.at = now;
  try {
    const me = await tgCall(token, 'getMe', {}, { timeoutMs: 3000 });
    cachedBot.username = botName(me?.username);
  } catch { /* ignore */ }
  return cachedBot.username;
}

// ---------- Helpers ----------

function cleanLine(raw = '', max = 120) {
  const s = String(raw ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).trim()}…`;
}

function relTime(iso, now = Date.now()) {
  const ts = Date.parse(iso || '');
  if (!Number.isFinite(ts)) return 'live';
  const diff = Math.max(0, now - ts);
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function regionTag(item) {
  const r = String(item?.region || '').toLowerCase();
  if (r === 'china') return '🇨🇳 China';
  if (r === 'europe') return '🇪🇺 Europe';
  if (r === 'asia') return '🌏 Asia';
  if (r === 'americas') return item?.hub === 'nyc' ? '🇺🇸 NYC' : '🇺🇸 US';
  return '🌐 Global';
}

function compactNum(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
}

function normTitleKey(title = '') {
  return String(title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 36);
}

function safeForGroupText(str = '') {
  const s = String(str ?? '');
  if (!s.trim()) return false;
  if (OTHER_COIN_RE.test(s) || WALLET_ADDR_RE.test(s)) return false;
  return true;
}

// Build plain text + validated UTF-16 Telegram text_link entities (zero parse_mode bugs).
function buildEntityMessage(parts) {
  let text = '';
  const entities = [];
  for (const part of parts) {
    if (!part) continue;
    if (Array.isArray(part)) {
      const label = String(part[0] ?? '');
      const url = safeHttpUrl(part[1]);
      if (label && url) {
        entities.push({ type: 'text_link', offset: text.length, length: label.length, url });
      }
      text += label;
    } else {
      text += String(part);
    }
  }
  return { text, entities };
}

export function aiNewsButtons(activeTab = 'top', site = 'https://agi1.app', { inGroup = false, subscribed = false, bot = null, isAlert = false } = {}) {
  const tab = ['top', 'weights', 'tools'].includes(activeTab) ? activeTab : 'top';
  const base = String(site || 'https://agi1.app').replace(/\/+$/, '');
  const row1 = [
    { text: `${tab === 'top' ? '• ' : ''}🌐 Breaking`, callback_data: 'ainews:top' },
    { text: `${tab === 'weights' ? '• ' : ''}🧠 Weights`, callback_data: 'ainews:weights' },
    { text: `${tab === 'tools' ? '• ' : ''}🛠️ AI Tools`, callback_data: 'ainews:tools' },
  ];
  if (inGroup) {
    const row2 = [{ text: '🔄 Refresh', callback_data: `ainews:refresh:${tab}` }];
    if (bot) row2.push({ text: '🔔 DM Alerts ↗', url: `https://t.me/${bot}?start=ainews` });
    row2.push({ text: '🌍 agi1.app/ainews ↗', url: `${base}/ainews` });
    return [row1, row2];
  }
  const row2 = [
    subscribed
      ? { text: isAlert ? '🔕 Pause Alerts' : '🔔 Alerts: ON', callback_data: `ainews:unsub:${tab}` }
      : { text: '🔔 Get Alerts', callback_data: `ainews:sub:${tab}` },
    { text: '🔄 Refresh', callback_data: `ainews:refresh:${tab}` },
  ];
  const row3 = [{ text: '🌍 Open agi1.app/ainews ↗', url: `${base}/ainews` }];
  return [row1, row2, row3];
}

export function parseAiNewsArg(raw = '') {
  const clean = cleanLine(raw, 60);
  if (!clean) return { tab: 'top', query: '' };
  const low = clean.toLowerCase();
  if (/^(?:breaking|top|latest|world|news|pulse)$/.test(low)) return { tab: 'top', query: '' };
  if (/^(?:weights?|models?|repos?|github|open|opensource|hf|huggingface)$/.test(low)) return { tab: 'weights', query: '' };
  if (/^(?:tools?|aisearch|@?theaisearch|videos?|youtube|yt)$/.test(low)) return { tab: 'tools', query: '' };
  if (/^(?:alerts?|notify|notifications?|sub|subscribe|alerts?\s+on|on)$/.test(low)) return { tab: 'sub', query: '' };
  if (/^(?:alerts?\s+off|mute|unsub|unsubscribe|off|pause|stop)$/.test(low)) return { tab: 'unsub', query: '' };
  return { tab: 'search', query: clean };
}

// ---------- Supabase shared subscriber & dedupe storage (agi1_feed_state.ainewsTg) ----------

async function supabaseRpc(fetchImpl, cfg, fn, args) {
  if (!cfg?.supabaseUrl || !cfg?.supabaseKey) return { ok: false, data: null };
  try {
    const res = await fetchImpl(`${cfg.supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: cfg.supabaseKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(args || {}),
      signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, data: null };
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false, data: null };
  }
}

function normalizeTgState(raw) {
  const s = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const seen = Array.isArray(s.seen) ? [...new Set(s.seen.map(String).filter(Boolean))].slice(0, MAX_SEEN) : [];
  const subs = Array.isArray(s.subs)
    ? [...new Set(s.subs.map((x) => Number(x)).filter((n) => Number.isSafeInteger(n) && n > 0))].slice(0, MAX_DM_SUBS)
    : [];
  return {
    seeded: s.seeded === true,
    lastAt: Number(s.lastAt) || 0,
    seen,
    subs,
  };
}

export async function isAiNewsDmSubscribed(cfg, chatId, { fetchImpl = globalThis.fetch } = {}) {
  if (!Number.isSafeInteger(chatId) || chatId <= 0 || !cfg?.supabaseUrl || !cfg?.supabaseKey) return false;
  const r = await supabaseRpc(fetchImpl, cfg, 'feed_state_get', {});
  if (!r.ok) return false;
  const tgState = normalizeTgState(r.data?.ainewsTg);
  return tgState.subs.includes(chatId);
}

export async function subscribeAiNewsDm(cfg, chatId, { fetchImpl = globalThis.fetch } = {}) {
  if (!Number.isSafeInteger(chatId) || chatId <= 0) return { ok: false, why: 'bad_chat' };
  if (!cfg?.supabaseUrl || !cfg?.supabaseKey) return { ok: false, why: 'no_db' };
  const r = await supabaseRpc(fetchImpl, cfg, 'feed_state_get', {});
  if (!r.ok) return { ok: false, why: 'db' };
  const state = r.data && typeof r.data === 'object' && !Array.isArray(r.data) ? r.data : {};
  const tgState = normalizeTgState(state.ainewsTg);
  if (tgState.subs.includes(chatId)) return { ok: true, already: true, count: tgState.subs.length };
  if (tgState.subs.length >= MAX_DM_SUBS) return { ok: false, why: 'full', count: tgState.subs.length };

  const nextState = { ...state, ainewsTg: { ...tgState, subs: [...tgState.subs, chatId] } };
  if (Buffer.byteLength(JSON.stringify(nextState), 'utf8') > MAX_STATE_BYTES) {
    return { ok: false, why: 'full', count: tgState.subs.length };
  }
  const saved = await supabaseRpc(fetchImpl, cfg, 'feed_state_put', { p_state: nextState });
  if (!saved.ok || saved.data === false) return { ok: false, why: 'db' };
  return { ok: true, already: false, count: tgState.subs.length + 1 };
}

export async function unsubscribeAiNewsDm(cfg, chatId, { fetchImpl = globalThis.fetch } = {}) {
  if (!Number.isSafeInteger(chatId) || chatId <= 0 || !cfg?.supabaseUrl || !cfg?.supabaseKey) return false;
  const r = await supabaseRpc(fetchImpl, cfg, 'feed_state_get', {});
  if (!r.ok) return false;
  const state = r.data && typeof r.data === 'object' && !Array.isArray(r.data) ? r.data : {};
  const tgState = normalizeTgState(state.ainewsTg);
  if (!tgState.subs.includes(chatId)) return false;
  const nextSubs = tgState.subs.filter((id) => id !== chatId);
  const saved = await supabaseRpc(fetchImpl, cfg, 'feed_state_put', {
    p_state: { ...state, ainewsTg: { ...tgState, subs: nextSubs } },
  });
  return Boolean(saved.ok && saved.data !== false);
}

async function pruneGoneSubs(cfg, goneIds, { fetchImpl = globalThis.fetch } = {}) {
  if (!goneIds.length || !cfg?.supabaseUrl || !cfg?.supabaseKey) return;
  const goneSet = new Set(goneIds);
  const r = await supabaseRpc(fetchImpl, cfg, 'feed_state_get', {});
  if (!r.ok) return;
  const state = r.data && typeof r.data === 'object' && !Array.isArray(r.data) ? r.data : {};
  const tgState = normalizeTgState(state.ainewsTg);
  const nextSubs = tgState.subs.filter((id) => !goneSet.has(id));
  if (nextSubs.length === tgState.subs.length) return;
  await supabaseRpc(fetchImpl, cfg, 'feed_state_put', {
    p_state: { ...state, ainewsTg: { ...tgState, subs: nextSubs } },
  });
}

// ---------- Formatting live Telegram views ----------

export function formatAiNewsView(data, {
  tab = 'top',
  query = '',
  now = Date.now(),
  site = 'https://agi1.app',
  inGroup = false,
  subscribed = false,
  bot = null,
  banner = '',
} = {}) {
  const base = String(site || 'https://agi1.app').replace(/\/+$/, '');
  const stats = data?.stats || {};
  const pulseOn = data?.pulse?.enabled && (data.pulse.status === 'live' || data.pulse.status === 'cached') && data.pulse.count > 0;
  const feedLine = `${stats.sourcesLive || 0}/${stats.sourcesTotal || 20} live feeds${pulseOn ? ' · 30m web pulse active' : ''}`;
  const parts = [];

  if (banner) parts.push(`${banner}\n\n`);

  if (tab === 'search' && query) {
    const q = query.toLowerCase();
    const matchStory = (s) => `${s.title || ''} ${s.summary || ''} ${s.lab || ''} ${s.source || ''} ${(s.tags || []).join(' ')}`.toLowerCase().includes(q);
    const matchWeight = (m) => `${m.name || ''} ${m.title || ''} ${m.summary || ''} ${m.lab || ''} ${m.regionLabel || ''}`.toLowerCase().includes(q);
    const matchTool = (t) => `${t.name || ''} ${t.repo || ''} ${t.videoTitle || ''} ${(t.tags || []).join(' ')}`.toLowerCase().includes(q);

    const hits = [];
    for (const s of (data?.stories || []).filter(matchStory).slice(0, 4)) {
      hits.push({ tag: regionTag(s), title: s.title, url: s.url, meta: `${s.lab || s.source || 'AI News'} · ${relTime(s.publishedAt, now)}`, gh: s.githubUrl });
    }
    for (const m of (data?.openWeights || []).filter(matchWeight).slice(0, 2)) {
      if (hits.length >= 5) break;
      hits.push({ tag: '🧠 Open Weights', title: m.title || m.name, url: m.githubUrl || m.huggingfaceUrl || m.url, meta: `${m.lab || m.source}${m.stars ? ` · ★ ${compactNum(m.stars)}` : ''}`, gh: null });
    }
    for (const t of (data?.aiSearchTools || []).filter(matchTool).slice(0, 2)) {
      if (hits.length >= 5) break;
      hits.push({ tag: '🛠️ @theAIsearch', title: t.name, url: t.url, meta: `${t.clock ? `${t.clock} · ` : ''}${cleanLine(t.videoTitle || 'AI Tool', 48)}`, gh: null });
    }

    parts.push(`🔎 AI News Search: "${cleanLine(query, 40)}" 💜\n${feedLine}\n\n`);
    if (!hits.length) {
      parts.push(`nothing matched "${cleanLine(query, 40)}" right now 🙈 try a model or lab name like /ainews qwen, /ainews glm, /ainews kimi, or tap a tab below.\n\n`);
    } else {
      hits.forEach((h, i) => {
        parts.push(`${i + 1}. [${h.tag}] `, [cleanLine(h.title, 96), h.url], '\n');
        parts.push(`   ${cleanLine(h.meta, 78)}`);
        if (h.gh && h.gh !== h.url) parts.push(' · ', ['GitHub ↗', h.gh]);
        parts.push('\n\n');
      });
    }
  } else if (tab === 'weights') {
    const list = (data?.openWeights || []).slice(0, 5);
    parts.push(`🧠 AI News World · Open Weights & Repos 💜\n${feedLine}\n\n`);
    list.forEach((m, i) => {
      const link = m.githubUrl || m.huggingfaceUrl || m.url;
      const badge = m.stars ? `★ ${compactNum(m.stars)}` : m.likes ? `♥ ${compactNum(m.likes)}` : 'open weights';
      parts.push(`${i + 1}. [${regionTag(m)}] `, [cleanLine(m.name || m.title, 80), link], '\n');
      parts.push(`   ${cleanLine(m.lab || m.source || 'Open Source', 32)} · ${badge} · ${relTime(m.publishedAt, now)}`);
      if (m.githubUrl && m.huggingfaceUrl && m.githubUrl !== m.huggingfaceUrl) {
        parts.push(' · ', ['HF ↗', m.huggingfaceUrl]);
      }
      parts.push('\n\n');
    });
  } else if (tab === 'tools') {
    const latestVideo = (data?.videos || [])[0];
    const tools = (data?.aiSearchTools || []).slice(0, 5);
    parts.push(`🛠️ @theAIsearch · Latest AI Tools & Repos 💜\n${stats.aiSearchToolsCount || tools.length} tools extracted from ${stats.videosCount || 0} videos\n\n`);
    if (latestVideo) {
      parts.push('🎬 Latest video: ', [cleanLine(latestVideo.title, 86), latestVideo.url], ` (${relTime(latestVideo.publishedAt, now)})\n\n`);
    }
    tools.forEach((t, i) => {
      const kindLabel = t.kind === 'github' ? 'GitHub' : t.kind === 'huggingface' ? 'Hugging Face' : 'Tool';
      parts.push(`${i + 1}. `, [cleanLine(t.name, 72), t.url], ` (${kindLabel})`);
      if (t.videoUrl && t.clock) parts.push(' · ', [`▶ ${t.clock}`, t.videoUrl]);
      parts.push('\n');
    });
    parts.push('\n');
  } else {
    // Top Breaking: prioritize fresh live 30-min pulse items + newest stories
    const all = data?.stories || [];
    const pulses = all.filter((s) => s.sourceKind === 'pulse');
    const rest = all.filter((s) => s.sourceKind !== 'pulse');
    const picks = [];
    const seen = new Set();
    for (const s of [...pulses.slice(0, 3), ...rest]) {
      const k = normTitleKey(s.title);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      picks.push(s);
      if (picks.length >= 5) break;
    }

    parts.push(`🌐 AI News World · Live Global Pulse 💜\n${feedLine}\n\n`);
    picks.forEach((s, i) => {
      const prefix = s.sourceKind === 'pulse' ? '⚡ ' : '';
      parts.push(`${i + 1}. ${prefix}[${regionTag(s)}] `, [cleanLine(s.title, 96), s.url], '\n');
      parts.push(`   ${cleanLine(s.lab || s.source || 'AI World', 36)} · ${relTime(s.publishedAt, now)}`);
      if (s.githubUrl && s.githubUrl !== s.url) parts.push(' · ', ['GitHub ↗', s.githubUrl]);
      else if (s.huggingfaceUrl && s.huggingfaceUrl !== s.url) parts.push(' · ', ['HF ↗', s.huggingfaceUrl]);
      parts.push('\n\n');
    });
  }

  parts.push('explore the live 3D globe & alerts: ', ['agi1.app/ainews', `${base}/ainews`]);

  const { text, entities } = buildEntityMessage(parts);
  const markupTab = tab === 'search' ? 'top' : tab;
  return {
    text: text.slice(0, 3900),
    entities: entities.filter((e) => e.offset + e.length <= 3900),
    markup: { inline_keyboard: aiNewsButtons(markupTab, base, { inGroup, subscribed, bot }) },
  };
}

// ---------- Formatting automatic breaking alert pushes (DM & Group) ----------

export function formatBreakingBroadcast(items = [], {
  now = Date.now(),
  site = 'https://agi1.app',
  inGroup = true,
  bot = null,
} = {}) {
  const base = String(site || 'https://agi1.app').replace(/\/+$/, '');
  const clean = items
    .filter((s) => s && s.title && safeHttpUrl(s.url) && safeForGroupText(`${s.title} ${s.summary || ''} ${s.lab || ''}`))
    .slice(0, MAX_BROADCAST_ITEMS);
  if (!clean.length) return null;

  const hasModel = clean.some((s) => s.sourceKind === 'openrouter' || s.openWeights || s.category === 'models');
  const header = hasModel
    ? '🚨 New AI Model & Breaking News Alert 💜\n\n'
    : '⚡ Breaking AI News Alert 💜\n\n';
  const parts = [header];
  clean.forEach((s, i) => {
    const kindIcon = s.sourceKind === 'openrouter' ? '🧠 ' : s.sourceKind === 'video' ? '🎬 ' : '⚡ ';
    parts.push(`${i + 1}. ${kindIcon}[${regionTag(s)}] `, [cleanLine(s.title, 96), s.url], '\n');
    if (s.summary) parts.push(`   ${cleanLine(s.summary, 130)}\n`);
    parts.push(`   ${cleanLine(s.lab || s.source || 'Global AI', 36)} · ${relTime(s.publishedAt, now)}`);
    if (s.githubUrl && s.githubUrl !== s.url) parts.push(' · ', ['GitHub ↗', s.githubUrl]);
    else if (s.huggingfaceUrl && s.huggingfaceUrl !== s.url) parts.push(' · ', ['HF ↗', s.huggingfaceUrl]);
    parts.push('\n\n');
  });
  parts.push(
    inGroup ? 'type /ainews anytime or explore live on ' : 'tap below to browse more or pause alerts · ',
    ['agi1.app/ainews', `${base}/ainews`],
  );

  const { text, entities } = buildEntityMessage(parts);
  return {
    text: text.slice(0, 3900),
    entities: entities.filter((e) => e.offset + e.length <= 3900),
    markup: { inline_keyboard: aiNewsButtons('top', base, { inGroup, subscribed: !inGroup, bot, isAlert: !inGroup }) },
  };
}

// ---------- High-signal alert candidate collector ----------

export function collectAlertCandidates(snapshot, now = Date.now()) {
  if (!snapshot) return [];
  const stories = Array.isArray(snapshot.stories) ? snapshot.stories : [];
  const out = [];
  const seen = new Set();
  for (const s of stories) {
    if (!s || !s.title || !safeHttpUrl(s.url)) continue;
    // Only auto-alert on live high-signal drops (30m Gemini Web Pulse, OpenRouter model launches, @theAIsearch videos)
    if (!['pulse', 'openrouter', 'video'].includes(s.sourceKind)) continue;
    const ts = Date.parse(s.publishedAt || '');
    if (Number.isFinite(ts) && now - ts > MAX_BROADCAST_AGE_MS) continue;
    const key = normTitleKey(s.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

// ---------- Interactive /ainews, /start ainews & inline button handlers ----------

export async function onAiNewsStart(cfg, token, chatId, {
  now = Date.now(),
  fetchImpl = globalThis.fetch,
  env = process.env,
} = {}) {
  if (!ainewsOn(cfg)) {
    await say(token, chatId, AINEWS_TOAST.off, {}, { timeoutMs: 4000 }).catch(() => {});
    return 'ainews_off';
  }
  const sub = await subscribeAiNewsDm(cfg, chatId, { fetchImpl });
  const banner = sub.ok
    ? "🔔 AI News Alerts are ON for this chat 💜 I'll DM you automatically whenever a new AI model, open-weight drop, @theAIsearch video, or breaking AI news hits. Tap Pause Alerts or /stop anytime."
    : sub.why === 'full' ? AINEWS_TOAST.subFull : AINEWS_TOAST.subUnavailable;
  tgCall(token, 'sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});
  try {
    const data = await getAiNewsSnapshot({ cfg, now, fetchImpl, skipTelegramBroadcast: true });
    const site = siteBase(env) || 'https://agi1.app';
    const view = formatAiNewsView(data, { tab: 'top', now, site, inGroup: false, subscribed: sub.ok, banner });
    await say(token, chatId, view.text, { entities: view.entities, reply_markup: view.markup }, { timeoutMs: 5000 });
    return sub.ok ? 'ainews_sub_start' : 'ainews_sub_failed';
  } catch (err) {
    console.warn(`[ainews-tg] /start ainews failed: ${err?.message || err}`);
    await say(token, chatId, banner, {}, { timeoutMs: 4000 }).catch(() => {});
    return sub.ok ? 'ainews_sub_start' : 'ainews_failed';
  }
}

export async function onAiNewsCommand(cfg, token, {
  chatId,
  messageId = null,
  threadId = null,
  arg = '',
  inGroup = false,
  now = Date.now(),
  fetchImpl = globalThis.fetch,
  env = process.env,
} = {}) {
  if (!ainewsOn(cfg)) return 'ainews_off';
  const { tab, query } = parseAiNewsArg(arg);

  // Private DM alert subscription shortcuts: "/ainews alerts" or "/ainews off"
  if (!inGroup && (tab === 'sub' || tab === 'unsub')) {
    if (tab === 'sub') return onAiNewsStart(cfg, token, chatId, { now, fetchImpl, env });
    const had = await unsubscribeAiNewsDm(cfg, chatId, { fetchImpl });
    const site = siteBase(env) || 'https://agi1.app';
    await say(
      token,
      chatId,
      had
        ? '🔕 AI News alerts are paused for this chat 💜 type /ainews alerts anytime to turn them back on.'
        : 'AI News alerts were already off for this chat 💜 type /ainews alerts anytime to turn them on.',
      { reply_markup: { inline_keyboard: aiNewsButtons('top', site, { inGroup: false, subscribed: false }) } },
      { timeoutMs: 4000 },
    );
    return 'ainews_unsub';
  }

  const effectiveTab = inGroup && (tab === 'sub' || tab === 'unsub') ? 'top' : tab;
  if (inGroup) {
    const gap = query ? AINEWS_GAPS.groupSearch : AINEWS_GAPS.groupCmd;
    const key = query ? `gsearch:${chatId}` : `gcmd:${chatId}:${effectiveTab}`;
    if (recent(key, now, gap)) return 'group_recent';
    mark(key, now);
  }
  const extraBase = {
    ...(inGroup && Number.isSafeInteger(messageId) ? { reply_parameters: { message_id: messageId, allow_sending_without_reply: true } } : {}),
    ...(Number.isSafeInteger(threadId) ? { message_thread_id: threadId } : {}),
  };
  tgCall(token, 'sendChatAction', { chat_id: chatId, action: 'typing', ...(Number.isSafeInteger(threadId) ? { message_thread_id: threadId } : {}) }).catch(() => {});

  try {
    const [data, subscribed, bot] = await Promise.all([
      getAiNewsSnapshot({ cfg, now, fetchImpl }),
      inGroup ? Promise.resolve(false) : isAiNewsDmSubscribed(cfg, chatId, { fetchImpl }),
      inGroup ? resolveBotUsername(token, env, now) : Promise.resolve(null),
    ]);
    const site = siteBase(env) || 'https://agi1.app';
    const view = formatAiNewsView(data, { tab: effectiveTab, query, now, site, inGroup, subscribed, bot });
    await say(token, chatId, view.text, {
      ...extraBase,
      entities: view.entities,
      reply_markup: view.markup,
    }, { timeoutMs: 5000 });
    return inGroup ? `group_ainews_${effectiveTab}` : `ainews_${effectiveTab}`;
  } catch (err) {
    console.warn(`[ainews-tg] couldn't answer /ainews: ${err?.message || err}`);
    await say(token, chatId, AINEWS_TOAST.failed, extraBase, { timeoutMs: 4000 }).catch(() => {});
    return 'ainews_failed';
  }
}

export async function onAiNewsTap(cfg, token, cb, now = Date.now(), {
  group = false,
  fetchImpl = globalThis.fetch,
  env = process.env,
} = {}) {
  const answer = (text) => tgCall(token, 'answerCallbackQuery', {
    callback_query_id: String(cb?.id ?? ''),
    ...(text ? { text } : {}),
  }, { timeoutMs: 4000 }).catch(() => {});

  const m = cb?.message;
  const chat = m?.chat;
  const inGroup = chat?.type === 'group' || chat?.type === 'supergroup';
  const person = cb?.from;
  const data = String(cb?.data ?? '');
  const parsed = /^ainews:(top|weights|tools|(?:refresh|sub|unsub)(?::(top|weights|tools))?)$/.exec(data);

  if (!parsed || !Number.isSafeInteger(chat?.id) || !Number.isSafeInteger(m?.message_id) || !person || person.is_bot
    || !Number.isSafeInteger(person.id)
    || (inGroup ? !group || chat.id >= 0 : chat?.type !== 'private' || chat.id <= 0 || person.id !== chat.id)) {
    await answer();
    return 'ignored';
  }
  if (!ainewsOn(cfg)) {
    await answer(AINEWS_TOAST.off);
    return 'ainews_off';
  }
  if (inGroup && !tapBurst(chatCode(cfg.passSecret, person.id, 'anburst'), now)) return 'too_many';

  const action = parsed[1];
  const tab = parsed[2] || (['top', 'weights', 'tools'].includes(action) ? action : 'top');
  const site = siteBase(env) || 'https://agi1.app';

  // Private DM 1-tap alert subscription toggle ("🔔 Get Alerts" <-> "🔔 Alerts: ON")
  if (action.startsWith('sub') || action.startsWith('unsub')) {
    if (inGroup) {
      await answer();
      return 'ignored';
    }
    const wantOn = action.startsWith('sub');
    if (wantOn) {
      const r = await subscribeAiNewsDm(cfg, chat.id, { fetchImpl });
      if (!r.ok) {
        await answer(r.why === 'full' ? AINEWS_TOAST.subFull : AINEWS_TOAST.subUnavailable);
        return 'ainews_sub_failed';
      }
      await answer(AINEWS_TOAST.subOn);
      await tgCall(token, 'editMessageReplyMarkup', {
        chat_id: chat.id,
        message_id: m.message_id,
        reply_markup: { inline_keyboard: aiNewsButtons(tab, site, { inGroup: false, subscribed: true }) },
      }, { timeoutMs: 4000 }).catch(() => {});
      return 'ainews_sub';
    }
    await unsubscribeAiNewsDm(cfg, chat.id, { fetchImpl });
    await answer(AINEWS_TOAST.subOff);
    await tgCall(token, 'editMessageReplyMarkup', {
      chat_id: chat.id,
      message_id: m.message_id,
      reply_markup: { inline_keyboard: aiNewsButtons(tab, site, { inGroup: false, subscribed: false }) },
    }, { timeoutMs: 4000 }).catch(() => {});
    return 'ainews_unsub';
  }

  const isRefresh = action.startsWith('refresh');
  const where = String(chat.id);
  if (isRefresh && recent(`refresh:${where}`, now, AINEWS_GAPS.refresh)) {
    await answer(AINEWS_TOAST.wait);
    return 'ainews_recent';
  }
  if (!inGroup && recent(`tap:${where}`, now, AINEWS_GAPS.privateTap)) {
    await answer();
    return 'ainews_recent';
  }
  mark(`tap:${where}`, now);
  if (isRefresh) mark(`refresh:${where}`, now);

  await answer(isRefresh ? AINEWS_TOAST.refresh : (AINEWS_TOAST[tab] || AINEWS_TOAST.top));

  try {
    const [snap, subscribed, bot] = await Promise.all([
      getAiNewsSnapshot({ cfg, now, fetchImpl, bypassCache: isRefresh }),
      inGroup ? Promise.resolve(false) : isAiNewsDmSubscribed(cfg, chat.id, { fetchImpl }),
      inGroup ? resolveBotUsername(token, env, now) : Promise.resolve(null),
    ]);
    const view = formatAiNewsView(snap, { tab, now, site, inGroup, subscribed, bot });
    try {
      await tgCall(token, 'editMessageText', {
        chat_id: chat.id,
        message_id: m.message_id,
        text: view.text,
        entities: view.entities,
        link_preview_options: { is_disabled: true },
        reply_markup: view.markup,
      }, { timeoutMs: 5000 });
    } catch (editErr) {
      if (!/message is not modified/i.test(String(editErr?.description || editErr?.message || ''))) {
        await say(token, chat.id, view.text, {
          ...(inGroup ? topicOf(m) : {}),
          entities: view.entities,
          reply_markup: view.markup,
        }, { timeoutMs: 5000 });
      }
    }
    return isRefresh ? `ainews_refresh_${tab}` : `ainews_${tab}`;
  } catch (err) {
    console.warn(`[ainews-tg] tap update failed: ${err?.message || err}`);
    return 'ainews_failed';
  }
}

// ---------- Automatic breaking AI news & new-model alerts (DM subscribers + Telegram groups) ----------

const groupTargets = (g) => (g ? [...[...g.names].map((n) => `@${n}`), ...[...g.ids].map(Number)] : []);
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

export async function broadcastBreakingAiNews({
  cfg,
  token,
  items = [],
  now = Date.now(),
  fetchImpl = globalThis.fetch,
  env = process.env,
  deadline = Infinity,
} = {}) {
  const out = { posted: 0, dmPosted: 0, groupPosted: 0, failed: 0, gone: 0, seeded: false };
  if (!ainewsOn(cfg) || !token || !Array.isArray(items) || !items.length) return out;

  const sendGroups = aiNewsPostsOn(cfg) ? groupTargets(cfg.tgGroups) : [];

  // Read shared state from agi1_feed_state (zero extra SQL tables, preserves all existing keys).
  const stateRes = await supabaseRpc(fetchImpl, cfg, 'feed_state_get', {});
  if (!stateRes.ok) return out;
  const state = stateRes.data && typeof stateRes.data === 'object' && !Array.isArray(stateRes.data) ? stateRes.data : {};
  const prev = normalizeTgState(state.ainewsTg);

  if (!sendGroups.length && !prev.subs.length) return out;

  const eligible = items.filter((s) => {
    if (!s?.title || !safeHttpUrl(s.url)) return false;
    if (!safeForGroupText(`${s.title} ${s.summary || ''} ${s.lab || ''}`)) return false;
    const ts = Date.parse(s.publishedAt || '');
    if (Number.isFinite(ts) && now - ts > MAX_BROADCAST_AGE_MS) return false;
    return true;
  });
  if (!eligible.length) return out;

  // First run ever: seed `seen` (preserving `subs`) so we never dump old backlog news on enable.
  if (!prev.seeded) {
    const initialSeen = [...new Set(eligible.map((s) => normTitleKey(s.title)).filter(Boolean))].slice(0, MAX_SEEN);
    const saved = await supabaseRpc(fetchImpl, cfg, 'feed_state_put', {
      p_state: { ...state, ainewsTg: { ...prev, seeded: true, lastAt: now, seen: initialSeen } },
    });
    if (saved.ok && saved.data !== false) out.seeded = true;
    return out;
  }

  // Respect minimum 25-minute gap between alert pushes.
  if (prev.lastAt && now - prev.lastAt < AINEWS_GAPS.broadcastMin) return out;

  const seenSet = new Set(prev.seen);
  const fresh = [];
  for (const s of eligible) {
    const k = normTitleKey(s.title);
    if (!k || seenSet.has(k)) continue;
    seenSet.add(k);
    fresh.push(s);
    if (fresh.length >= MAX_BROADCAST_ITEMS) break;
  }
  if (!fresh.length) return out;

  const site = siteBase(env) || 'https://agi1.app';
  const bot = sendGroups.length ? await resolveBotUsername(token, env, now) : null;
  const groupMsg = sendGroups.length ? formatBreakingBroadcast(fresh, { now, site, inGroup: true, bot }) : null;
  const dmMsg = prev.subs.length ? formatBreakingBroadcast(fresh, { now, site, inGroup: false }) : null;
  if (!groupMsg && !dmMsg) return out;

  // Claim in Supabase BEFORE sending so concurrent serverless containers never double-notify anyone.
  const nextSeen = [...fresh.map((s) => normTitleKey(s.title)), ...prev.seen]
    .filter(Boolean)
    .filter((k, idx, arr) => arr.indexOf(k) === idx)
    .slice(0, MAX_SEEN);
  const latestRes = await supabaseRpc(fetchImpl, cfg, 'feed_state_get', {});
  const latestState = latestRes.ok && latestRes.data && typeof latestRes.data === 'object' ? latestRes.data : state;
  const latestTg = normalizeTgState(latestState.ainewsTg);
  const claimed = await supabaseRpc(fetchImpl, cfg, 'feed_state_put', {
    p_state: { ...latestState, ainewsTg: { ...latestTg, seeded: true, lastAt: now, seen: nextSeen } },
  });
  if (!claimed.ok || claimed.data === false) return out;

  // 1. Broadcast to configured Telegram group(s)
  if (groupMsg) {
    for (const to of sendGroups) {
      if (Date.now() > deadline) break;
      try {
        await say(token, to, groupMsg.text, { entities: groupMsg.entities, reply_markup: groupMsg.markup }, { timeoutMs: 4000 });
        out.posted += 1;
        out.groupPosted += 1;
      } catch (err) {
        out.failed += 1;
        console.warn(`[ainews-tg] couldn't post breaking AI news in ${to}: ${err?.message || err}`);
      }
    }
  }

  // 2. Push to subscribed private DM chats (paced <= 25/s; automatically prunes blocked chats)
  if (dmMsg && latestTg.subs.length) {
    const goneIds = [];
    let rateLimited = false;
    for (let i = 0; i < latestTg.subs.length && !rateLimited; i += PER_SECOND) {
      if (Date.now() > deadline) break;
      if (i > 0) await sleep(1000);
      const batch = latestTg.subs.slice(i, i + PER_SECOND);
      const results = await Promise.allSettled(
        batch.map((chatId) => say(token, chatId, dmMsg.text, { entities: dmMsg.entities, reply_markup: dmMsg.markup }, { timeoutMs: 4000 })),
      );
      results.forEach((res, idx) => {
        const chatId = batch[idx];
        if (res.status === 'fulfilled') {
          out.posted += 1;
          out.dmPosted += 1;
        } else if (res.reason?.gone) {
          goneIds.push(chatId);
          out.gone += 1;
        } else if (res.reason?.status === 429) {
          rateLimited = true;
          out.failed += 1;
        } else {
          out.failed += 1;
          console.warn(`[ainews-tg] DM alert failed: ${res.reason?.message || 'error'}`);
        }
      });
    }
    if (goneIds.length) await pruneGoneSubs(cfg, goneIds, { fetchImpl });
  }

  return out;
}

// Scheduled wake-up from /api/feed: checks the shared 30-min Gemini Web Pulse (plus OpenRouter &
// @theAIsearch drops when active) and pushes brand-new models/breaking news to subscribed DM users
// and configured Telegram groups. Does 0 work if neither groups nor DM subscribers exist.
export async function tickTelegramAiNews(cfg, token, {
  now = Date.now(),
  fetchImpl = globalThis.fetch,
  env = process.env,
  deadline = Infinity,
} = {}) {
  if (!ainewsOn(cfg) || !token || !cfg?.geminiKey || cfg?.ainewsPulse === false) {
    return { status: 'off', posted: 0, dmPosted: 0, groupPosted: 0, failed: 0, gone: 0, seeded: false };
  }
  const hasGroups = aiNewsPostsOn(cfg) && groupTargets(cfg.tgGroups).length > 0;
  let hasSubs = false;
  if (!hasGroups) {
    const stateRes = await supabaseRpc(fetchImpl, cfg, 'feed_state_get', {});
    hasSubs = stateRes.ok && normalizeTgState(stateRes.data?.ainewsTg).subs.length > 0;
  }
  if (!hasGroups && !hasSubs) {
    return { status: 'idle', posted: 0, dmPosted: 0, groupPosted: 0, failed: 0, gone: 0, seeded: false };
  }
  const pulse = await getGeminiNewsPulse({ fetchImpl, cfg, now, classifyItem });
  if (pulse.status !== 'live' || !pulse.items.length) {
    return { status: pulse.status, posted: 0, dmPosted: 0, groupPosted: 0, failed: 0, gone: 0, seeded: false };
  }
  const res = await broadcastBreakingAiNews({ cfg, token, items: pulse.items, now, fetchImpl, env, deadline });
  return { status: pulse.status, ...res };
}
