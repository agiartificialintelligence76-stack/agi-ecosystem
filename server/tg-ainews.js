// AI News World in AGI-1's Telegram bot (private chat + allowed Telegram groups).
//   • /ainews [weights|tools|<topic>]: live global AI dispatches, open-weight GitHub/HF repos,
//     and @theAIsearch extracted AI tools with interactive inline category tabs.
//   • Automatic breaking AI drops posted to configured Telegram groups (`TELEGRAM_GROUPS`)
//     whenever the shared 30-minute Gemini Web Pulse discovers brand-new breaking AI news.
//   • Plain text + validated Telegram `text_link` entities only (no Markdown/HTML parsing,
//     no link previews, PG-13, no financial advice, no non-$AGI tickers or wallet addresses).
//   • Switches: `TELEGRAM_AINEWS=off` disables /ainews everywhere; `TELEGRAM_AINEWS_POSTS=off`
//     disables automatic group broadcasts while keeping on-demand /ainews working.
import { tgCall, say, chatCode, siteBase } from './tg-api.js';
import { makeBurstLimit } from './burst.js';
import { getAiNewsSnapshot, classifyItem, safeHttpUrl } from './ainews.js';
import { getGeminiNewsPulse } from './ainews-pulse.js';

export const ainewsOn = (cfg) => cfg?.tgAiNews === true;
export const aiNewsPostsOn = (cfg) => cfg?.tgAiNews === true && cfg?.tgAiNewsPosts === true && cfg?.tgGroupPosts === true && Boolean(cfg?.tgGroups);

export const HELP_AINEWS = '/ainews: live global AI news, open weights & @theAIsearch tools';
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
  wait: 'give it a few seconds before refreshing again 💜',
  off: 'AI news is taking a little break right now 🙈',
  failed: "couldn't load live AI news just now 🙈 try again in a minute",
});

const OTHER_COIN_RE = /\$(?!agi\b)[a-z]/i;
const WALLET_ADDR_RE = /0x[0-9a-f]{6}/i;
const MAX_SEEN = 24;
const MAX_BROADCAST_ITEMS = 3;
const MAX_BROADCAST_AGE_MS = 24 * 60 * 60 * 1000;
const SUPABASE_TIMEOUT_MS = 3500;

// ---------- In-memory spam guards (per server copy) ----------

const stamp = new Map();
const tapBurst = makeBurstLimit({ max: 6, windowMs: 60_000 });

export function forgetTgAiNews() {
  stamp.clear();
  tapBurst.reset();
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

export function aiNewsButtons(activeTab = 'top', site = 'https://agi1.app') {
  const tab = ['top', 'weights', 'tools'].includes(activeTab) ? activeTab : 'top';
  const base = String(site || 'https://agi1.app').replace(/\/+$/, '');
  return [
    [
      { text: `${tab === 'top' ? '• ' : ''}🌐 Breaking`, callback_data: 'ainews:top' },
      { text: `${tab === 'weights' ? '• ' : ''}🧠 Weights`, callback_data: 'ainews:weights' },
      { text: `${tab === 'tools' ? '• ' : ''}🛠️ AI Tools`, callback_data: 'ainews:tools' },
    ],
    [
      { text: '🔄 Refresh', callback_data: `ainews:refresh:${tab}` },
      { text: '🌍 Open agi1.app/ainews ↗', url: `${base}/ainews` },
    ],
  ];
}

export function parseAiNewsArg(raw = '') {
  const clean = cleanLine(raw, 60);
  if (!clean) return { tab: 'top', query: '' };
  const low = clean.toLowerCase();
  if (/^(?:breaking|top|latest|world|news|pulse)$/.test(low)) return { tab: 'top', query: '' };
  if (/^(?:weights?|models?|repos?|github|open|opensource|hf|huggingface)$/.test(low)) return { tab: 'weights', query: '' };
  if (/^(?:tools?|aisearch|@?theaisearch|videos?|youtube|yt)$/.test(low)) return { tab: 'tools', query: '' };
  return { tab: 'search', query: clean };
}

// ---------- Formatting live Telegram views ----------

export function formatAiNewsView(data, { tab = 'top', query = '', now = Date.now(), site = 'https://agi1.app' } = {}) {
  const base = String(site || 'https://agi1.app').replace(/\/+$/, '');
  const stats = data?.stats || {};
  const pulseOn = data?.pulse?.enabled && (data.pulse.status === 'live' || data.pulse.status === 'cached') && data.pulse.count > 0;
  const feedLine = `${stats.sourcesLive || 0}/${stats.sourcesTotal || 20} live feeds${pulseOn ? ' · 30m web pulse active' : ''}`;
  const parts = [];

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
    markup: { inline_keyboard: aiNewsButtons(markupTab, base) },
  };
}

// ---------- Formatting automatic breaking group broadcasts ----------

export function formatBreakingBroadcast(items = [], { now = Date.now(), site = 'https://agi1.app' } = {}) {
  const base = String(site || 'https://agi1.app').replace(/\/+$/, '');
  const clean = items
    .filter((s) => s && s.title && safeHttpUrl(s.url) && safeForGroupText(`${s.title} ${s.summary || ''} ${s.lab || ''}`))
    .slice(0, MAX_BROADCAST_ITEMS);
  if (!clean.length) return null;

  const parts = ['⚡ Breaking AI News · Live Global Pulse 💜\n\n'];
  clean.forEach((s, i) => {
    parts.push(`${i + 1}. [${regionTag(s)}] `, [cleanLine(s.title, 96), s.url], '\n');
    if (s.summary) parts.push(`   ${cleanLine(s.summary, 130)}\n`);
    parts.push(`   ${cleanLine(s.lab || s.source || 'Global AI', 36)} · ${relTime(s.publishedAt, now)}`);
    if (s.githubUrl && s.githubUrl !== s.url) parts.push(' · ', ['GitHub ↗', s.githubUrl]);
    else if (s.huggingfaceUrl && s.huggingfaceUrl !== s.url) parts.push(' · ', ['HF ↗', s.huggingfaceUrl]);
    parts.push('\n\n');
  });
  parts.push('type /ainews anytime or explore live on ', ['agi1.app/ainews', `${base}/ainews`]);

  const { text, entities } = buildEntityMessage(parts);
  return {
    text: text.slice(0, 3900),
    entities: entities.filter((e) => e.offset + e.length <= 3900),
    markup: { inline_keyboard: aiNewsButtons('top', base) },
  };
}

// ---------- Interactive /ainews command & inline button handlers ----------

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
  if (inGroup) {
    const gap = query ? AINEWS_GAPS.groupSearch : AINEWS_GAPS.groupCmd;
    const key = query ? `gsearch:${chatId}` : `gcmd:${chatId}:${tab}`;
    if (recent(key, now, gap)) return 'group_recent';
    mark(key, now);
  }
  const extraBase = {
    ...(inGroup && Number.isSafeInteger(messageId) ? { reply_parameters: { message_id: messageId, allow_sending_without_reply: true } } : {}),
    ...(Number.isSafeInteger(threadId) ? { message_thread_id: threadId } : {}),
  };
  tgCall(token, 'sendChatAction', { chat_id: chatId, action: 'typing', ...(Number.isSafeInteger(threadId) ? { message_thread_id: threadId } : {}) }).catch(() => {});

  try {
    const data = await getAiNewsSnapshot({ cfg, now, fetchImpl });
    const site = siteBase(env) || 'https://agi1.app';
    const view = formatAiNewsView(data, { tab, query, now, site });
    await say(token, chatId, view.text, {
      ...extraBase,
      entities: view.entities,
      reply_markup: view.markup,
    }, { timeoutMs: 5000 });
    return inGroup ? `group_ainews_${tab}` : `ainews_${tab}`;
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
  const parsed = /^ainews:(top|weights|tools|refresh(?::(top|weights|tools))?)$/.exec(data);

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

  const isRefresh = parsed[1].startsWith('refresh');
  const tab = isRefresh ? (parsed[2] || 'top') : parsed[1];
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
    const snap = await getAiNewsSnapshot({ cfg, now, fetchImpl, bypassCache: isRefresh });
    const site = siteBase(env) || 'https://agi1.app';
    const view = formatAiNewsView(snap, { tab, now, site });
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
      // Ignore Telegram's harmless "message is not modified" when tapping the already-open tab;
      // fall back to a fresh reply if the original message is too old to edit.
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

// ---------- Automatic breaking AI news broadcasts to configured Telegram groups ----------

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

const groupTargets = (g) => [...[...g.names].map((n) => `@${n}`), ...[...g.ids].map(Number)];

export async function broadcastBreakingAiNews({
  cfg,
  token,
  items = [],
  now = Date.now(),
  fetchImpl = globalThis.fetch,
  env = process.env,
  deadline = Infinity,
} = {}) {
  const out = { posted: 0, failed: 0, seeded: false, skipped: 0 };
  if (!aiNewsPostsOn(cfg) || !token || !Array.isArray(items) || !items.length) return out;
  const targets = groupTargets(cfg.tgGroups);
  if (!targets.length) return out;

  // Read shared state from agi1_feed_state (zero extra SQL tables, preserves all existing keys).
  const stateRes = await supabaseRpc(fetchImpl, cfg, 'feed_state_get', {});
  if (!stateRes.ok) return out;
  const state = stateRes.data && typeof stateRes.data === 'object' && !Array.isArray(stateRes.data) ? stateRes.data : {};
  const prev = state.ainewsTg && typeof state.ainewsTg === 'object' ? state.ainewsTg : null;

  const eligible = items.filter((s) => {
    if (!s?.title || !safeHttpUrl(s.url)) return false;
    if (!safeForGroupText(`${s.title} ${s.summary || ''} ${s.lab || ''}`)) return false;
    const ts = Date.parse(s.publishedAt || '');
    if (Number.isFinite(ts) && now - ts > MAX_BROADCAST_AGE_MS) return false;
    return true;
  });
  if (!eligible.length) return out;

  // First run ever: seed `seen` so we never dump old news on enable (same rule as server/feed.js).
  if (!prev || prev.seeded !== true) {
    const initialSeen = [...new Set(eligible.map((s) => normTitleKey(s.title)).filter(Boolean))].slice(0, MAX_SEEN);
    const saved = await supabaseRpc(fetchImpl, cfg, 'feed_state_put', {
      p_state: { ...state, ainewsTg: { seeded: true, lastAt: now, seen: initialSeen } },
    });
    if (saved.ok && saved.data !== false) out.seeded = true;
    return out;
  }

  // Respect minimum 25-minute gap between group broadcasts.
  if (Number(prev.lastAt) && now - Number(prev.lastAt) < AINEWS_GAPS.broadcastMin) return out;

  const seenSet = new Set(Array.isArray(prev.seen) ? prev.seen.map(String) : []);
  const fresh = [];
  for (const s of eligible) {
    const k = normTitleKey(s.title);
    if (!k || seenSet.has(k)) continue;
    seenSet.add(k);
    fresh.push(s);
    if (fresh.length >= MAX_BROADCAST_ITEMS) break;
  }
  if (!fresh.length) return out;

  const msg = formatBreakingBroadcast(fresh, { now, site: siteBase(env) || 'https://agi1.app' });
  if (!msg) return out;

  // Claim in Supabase BEFORE sending so concurrent instances never double-post to Telegram groups.
  const nextSeen = [...fresh.map((s) => normTitleKey(s.title)), ...(Array.isArray(prev.seen) ? prev.seen : [])]
    .filter(Boolean)
    .filter((k, idx, arr) => arr.indexOf(k) === idx)
    .slice(0, MAX_SEEN);
  const latestRes = await supabaseRpc(fetchImpl, cfg, 'feed_state_get', {});
  const latestState = latestRes.ok && latestRes.data && typeof latestRes.data === 'object' ? latestRes.data : state;
  const claimed = await supabaseRpc(fetchImpl, cfg, 'feed_state_put', {
    p_state: { ...latestState, ainewsTg: { seeded: true, lastAt: now, seen: nextSeen } },
  });
  if (!claimed.ok || claimed.data === false) return out;

  for (const to of targets) {
    if (Date.now() > deadline) break;
    try {
      await say(token, to, msg.text, { entities: msg.entities, reply_markup: msg.markup }, { timeoutMs: 4000 });
      out.posted += 1;
    } catch (err) {
      out.failed += 1;
      console.warn(`[ainews-tg] couldn't post breaking AI news in ${to}: ${err?.message || err}`);
    }
  }
  return out;
}

// Scheduled wake-up from /api/feed: checks the shared 30-min Gemini Web Pulse (0 extra Gemini calls
// if already refreshed within 30 min) and broadcasts brand-new breaking AI stories to Telegram groups.
export async function tickTelegramAiNews(cfg, token, {
  now = Date.now(),
  fetchImpl = globalThis.fetch,
  env = process.env,
  deadline = Infinity,
} = {}) {
  if (!aiNewsPostsOn(cfg) || !token || !cfg?.geminiKey || cfg?.ainewsPulse === false) {
    return { status: 'off', posted: 0, failed: 0, seeded: false };
  }
  const pulse = await getGeminiNewsPulse({ fetchImpl, cfg, now, classifyItem });
  if (pulse.status !== 'live' || !pulse.items.length) {
    return { status: pulse.status, posted: 0, failed: 0, seeded: false };
  }
  const res = await broadcastBreakingAiNews({ cfg, token, items: pulse.items, now, fetchImpl, env, deadline });
  return { status: pulse.status, ...res };
}
