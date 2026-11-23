// Live AI News World recall for AGI-1's conversational chat (website api/chat.js + Telegram DM & group chat).
// Only fires when the visitor actually asks about AI news, agi1.app/ainews, new AI models, open weights,
// frontier labs, or @theAIsearch tools — adding ZERO extra latency or prompt tokens on normal chats.
// Uses the warm in-memory snapshot (0ms) or a fast, bounded cache-only read (<= 2.2s, never triggers a
// blocking Gemini web search) so chat replies always stay snappy and never fail if an upstream is slow.
import { peekAiNewsCache, getAiNewsSnapshot, classifyItem } from './ainews.js';
import { getGeminiNewsPulse } from './ainews-pulse.js';
import { SPOTLIGHT_STORIES, FALLBACK_OPEN_WEIGHTS, FALLBACK_AISEARCH_VIDEOS } from './ainews-seed.js';

const AINEWS_FEATURE_RE = /\b(ai\s*news|ainews|agi1\.app\/ainews|news\s+page|ai\s+world|new\s+ai\s+models?|latest\s+ai|breaking\s+ai|ai\s+drops?|ai\s+updates?|ai\s+headlines?|ai\s+tools?|open[- ]weights?|theaisearch|the\s+ai\s+search|what(?:'s|\s+is)?\s+new\s+in\s+ai|what\s+dropped\s+in\s+ai)\b/i;

const AINEWS_ENTITY_RE = /\b(qwen\w*|kimi\b|moonshot\s*ai|glm[-\s]?\d*(?:\.\d+)?|zhipu|z\.ai|deepseek\w*|minimax|hunyuan|minicpm|modelbest|sarvam|openai|chatgpt|gpt[-\s]?\d|sam\s+altman|anthropic|claude\b|opus\s?\d|sonnet\s?\d|meta\s+muse|muse\s+(?:ember|wonder|spark)|llama\s?\d|deepmind|genie\s?\d|alphagenome|google\s+gemini|gemini\s?\d|xai\b|grok\w*|tesla\s+(?:ai|optimus|fsd|robotaxi|dojo|cybercab)|optimus\s+(?:robot|gen|v\d)|mistral|hugging\s*face|openrouter|nvidia\s+(?:ai|gpu|blackwell|rubin|export)|riemann\s+hypothesis)\b/i;

const FOLLOW_UP_RE = /\b(more|else|other\s+models?|any\s+other|what\s+about|details?|link|alerts?|notify|subscribe|telegram|github|weights|tools?)\b/i;

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'what', 'whats', 'about', 'tell', 'have', 'has',
  'any', 'new', 'news', 'latest', 'today', 'did', 'does', 'you', 'know', 'hear', 'heard', 'drop', 'dropped',
  'update', 'updates', 'model', 'models', 'there', 'they', 'just', 'can', 'how', 'why', 'who', 'where',
]);

export function asksAboutAiNews(message = '', previous = '') {
  const msg = String(message || '').trim();
  if (!msg) return false;
  if (AINEWS_FEATURE_RE.test(msg) || AINEWS_ENTITY_RE.test(msg)) return true;
  const prev = String(previous || '').trim();
  if (prev && FOLLOW_UP_RE.test(msg) && (AINEWS_FEATURE_RE.test(prev) || AINEWS_ENTITY_RE.test(prev))) {
    return true;
  }
  return false;
}

function queryTokens(text = '') {
  return [...new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9.+-]+/g, ' ')
      .split(' ')
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w)),
  )];
}

function scoreItem(item, tokens) {
  if (!tokens.length) return 0;
  const hay = `${item?.title || ''} ${item?.name || ''} ${item?.summary || ''} ${item?.lab || ''} ${item?.source || ''} ${item?.regionLabel || ''} ${(item?.tags || []).join(' ')}`.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (hay.includes(t)) score += t.length >= 5 ? 3 : 2;
  }
  return score;
}

function relAge(iso, now) {
  const ts = Date.parse(iso || '');
  if (!Number.isFinite(ts)) return '';
  const mins = Math.max(0, Math.floor((now - ts) / 60_000));
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function cleanSnippet(raw = '', max = 140) {
  const s = String(raw || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : `${s.slice(0, max - 1).trim()}…`;
}

export function buildAiNewsBrief(snapshot, message = '', { now = Date.now() } = {}) {
  const tokens = queryTokens(message);
  const stories = Array.isArray(snapshot?.stories) ? snapshot.stories : [];
  const weights = Array.isArray(snapshot?.openWeights) ? snapshot.openWeights : [];
  const tools = Array.isArray(snapshot?.aiSearchTools) ? snapshot.aiSearchTools : [];

  const rankedStories = [...stories]
    .map((s, idx) => ({ s, score: scoreItem(s, tokens), idx }))
    .sort((a, b) => b.score - a.score || a.idx - b.idx)
    .slice(0, 5)
    .map(({ s }) => {
      const age = relAge(s.publishedAt, now);
      const who = [s.lab || s.source, s.regionLabel, age].filter(Boolean).join(' · ');
      return `${cleanSnippet(s.title, 100)} (${who})`;
    });

  const rankedWeights = [...weights]
    .map((m, idx) => ({ m, score: scoreItem(m, tokens), idx }))
    .sort((a, b) => b.score - a.score || a.idx - b.idx)
    .slice(0, 3)
    .map(({ m }) => `${cleanSnippet(m.name || m.title, 56)} (${cleanSnippet(m.lab || m.regionLabel || 'open weights', 28)})`);

  const wantsTools = /\b(tool|tools|aisearch|youtube|video|github|repo)\b/i.test(message);
  const rankedTools = wantsTools
    ? [...tools]
      .map((t, idx) => ({ t, score: scoreItem(t, tokens), idx }))
      .sort((a, b) => b.score - a.score || a.idx - b.idx)
      .slice(0, 4)
      .map(({ t }) => cleanSnippet(t.name, 48))
    : [];

  return {
    headlines: rankedStories,
    openWeights: rankedWeights,
    tools: rankedTools,
    sourcesLive: Number(snapshot?.stats?.sourcesLive) || 20,
    pulseActive: Boolean(snapshot?.pulse?.enabled),
  };
}

async function fallbackSnapshot(cfg, now, fetchImpl) {
  let pulseItems = [];
  try {
    const p = await getGeminiNewsPulse({ cfg, now, fetchImpl, classifyItem, cacheOnly: true });
    if (Array.isArray(p?.items)) pulseItems = p.items;
  } catch { /* ignore */ }
  const fallbackTools = FALLBACK_AISEARCH_VIDEOS.flatMap((v) => v.tools || []);
  return {
    stories: [...pulseItems, ...SPOTLIGHT_STORIES],
    openWeights: FALLBACK_OPEN_WEIGHTS,
    aiSearchTools: fallbackTools,
    stats: { sourcesLive: 21 },
    pulse: { enabled: Boolean(cfg?.geminiKey && cfg?.ainewsPulse !== false) },
  };
}

// Fast, fail-safe live AI news recall for AGI-1 chat. Returns `null` if the message isn't about AI news.
export async function recallAiNews(cfg, message, previous = '', {
  now = Date.now(),
  fetchImpl = globalThis.fetch,
  timeoutMs = 2200,
} = {}) {
  if (!asksAboutAiNews(message, previous)) return null;

  // 1. Instant 0ms warm cache path
  const warm = peekAiNewsCache(now);
  if (warm) return buildAiNewsBrief(warm, `${message} ${previous}`, { now });

  // 2. Bounded fast snapshot (cacheOnlyPulse: true so chat never waits on a live Gemini search)
  let timer = null;
  try {
    const timed = new Promise((resolve) => {
      timer = setTimeout(() => resolve(null), Math.max(200, timeoutMs));
    });
    const snap = await Promise.race([
      getAiNewsSnapshot({ cfg, now, fetchImpl, skipTelegramBroadcast: true, cacheOnlyPulse: true }).catch(() => null),
      timed,
    ]);
    if (snap && Array.isArray(snap.stories) && snap.stories.length) {
      return buildAiNewsBrief(snap, `${message} ${previous}`, { now });
    }
  } finally {
    if (timer) clearTimeout(timer);
  }

  // 3. Guaranteed snappy fallback (Supabase cached 30m pulse + spotlights)
  const fb = await fallbackSnapshot(cfg, now, fetchImpl);
  return buildAiNewsBrief(fb, `${message} ${previous}`, { now });
}
