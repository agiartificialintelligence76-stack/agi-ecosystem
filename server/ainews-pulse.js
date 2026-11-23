// 30-minute Scheduled Gemini Google-Search Web Pulse for AI News World (agi1.app/ainews).
//
// Catches breaking global AI launches (including X-first China/US model drops such as GLM, Qwen,
// Kimi, DeepSeek, OpenAI, Anthropic, Meta Muse, DeepMind, Mistral, xAI) that have not hit RSS yet.
//
// Cost & concurrency guarantees:
// - Uses existing GEMINI_API_KEY (sent in x-goog-api-key header, never in URLs or logs) and
//   existing Supabase `public.agi1_feed_state` (`feed_state_get` / `feed_state_put` from
//   supabase/telegram.sql — zero extra SQL migration required).
// - Hard 30-minute shared cooldown across all Vercel serverless instances (<= 48 pulses/day,
//   <= 1,440/month; comfortably inside Gemini 3 Grounding's 5,000 free monthly search queries).
// - 45-second lease prevents concurrent cold starts from double-firing Gemini.
// - 5-minute error backoff prevents retry storms if Gemini is busy or rate-limited.
// - Compact storage strictly capped at <= 7,500 bytes (well below agi1_feed_state's 20,000-byte limit)
//   and always merges with fresh `feed_state_get()` so `/api/feed` keys (`since`, `market`, `diary`)
//   are never overwritten.
// - Instant kill switch: set `AINEWS_PULSE=off` in Vercel env vars.

export const PULSE_INTERVAL_MS = 30 * 60 * 1000;
export const PULSE_LEASE_MS = 45 * 1000;
export const PULSE_BACKOFF_MS = 5 * 60 * 1000;
export const PULSE_TIMEOUT_MS = 12000;
export const MAX_PULSE_ITEMS = 8;
export const MAX_PULSE_BYTES = 7500;

const SUPABASE_TIMEOUT_MS = 3500;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 12 * 60 * 60 * 1000;
const BLOCKED_HOSTS_RE = /^(?:localhost|127(?:\.\d+){3}|0\.0\.0\.0|\[::1\]|example\.com|www\.example\.com)$/i;

// ---------- Self-contained sanitizers (no circular imports with server/ainews.js) ----------

function cleanText(raw = '', maxLen = 220) {
  const s = String(raw ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > maxLen * 0.6 ? cut.slice(0, sp) : cut).trim()}…`;
}

function safePulseUrl(raw) {
  let s = String(raw ?? '').trim().replace(/[),.;]+$/, '');
  if (!s) return null;
  if (/^[a-z0-9.-]+\.[a-z]{2,}\/\S*$/i.test(s) && !/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (u.username || u.password) return null;
    if (BLOCKED_HOSTS_RE.test(u.hostname)) return null;
    if (u.protocol === 'http:') u.protocol = 'https:';
    return u.href;
  } catch {
    return null;
  }
}

function isGitHubRepoUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.hostname.toLowerCase() !== 'github.com' && u.hostname.toLowerCase() !== 'www.github.com') return false;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return false;
    return !['topics', 'orgs', 'search', 'features', 'explore', 'marketplace', 'settings', 'about'].includes(parts[0].toLowerCase());
  } catch {
    return false;
  }
}

function isHuggingFaceUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return (u.hostname.toLowerCase() === 'huggingface.co' || u.hostname.toLowerCase() === 'www.huggingface.co')
      && u.pathname.split('/').filter(Boolean).length >= 1;
  } catch {
    return false;
  }
}

function normKey(s = '') {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function pulseSlug(seed) {
  const clean = String(seed ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 56);
  return `pulse-${clean || 'item'}`;
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./i, '').toLowerCase(); } catch { return ''; }
}

// ---------- Prompt & Gemini response parsing ----------

export function buildPulsePrompt(now = Date.now()) {
  const todayIso = new Date(now).toISOString();
  return [
    `Current UTC time: ${todayIso}.`,
    'You are the breaking-news scout for a live global AI tracker.',
    'Run 1 or 2 concise Google searches for the biggest breaking AI model releases, open-weight drops, lab announcements, funding/IPO moves, and viral X/official AI launches from the LAST 24 HOURS worldwide.',
    'Prioritize direct model launches, coding/vision/agent releases, and open-weight drops from both China labs (Z.ai / Zhipu GLM, Alibaba Qwen, Moonshot Kimi, DeepSeek, MiniMax, Tencent Hunyuan, ByteDance Seed) and US/EU labs (OpenAI, Anthropic, Meta Muse, Google DeepMind, xAI, Mistral, NVIDIA).',
    `Return ONLY a raw JSON array of up to ${MAX_PULSE_ITEMS} items (newest first, no prose, no markdown).`,
    'Each object must have keys:',
    '{"title":"concise factual headline <= 110 chars","summary":"1-2 sentence concrete summary <= 190 chars","url":"exact https URL from search results or null","githubUrl":"https://github.com/owner/repo if directly relevant else null","huggingfaceUrl":"https://huggingface.co/... if directly relevant else null","lab":"lab or company name","source":"publisher or domain name","publishedAt":"ISO-8601 UTC timestamp"}',
    'Rules: only real verified announcements from your search results, never invent URLs or rumors, skip generic evergreen listicles or unrelated stock-market chatter.',
  ].join('\n');
}

export function extractJsonArray(text = '') {
  const raw = String(text ?? '').trim();
  if (!raw) return [];
  const candidates = [raw];
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  if (fence?.[1]) candidates.unshift(fence[1].trim());
  const firstBracket = raw.indexOf('[');
  const lastBracket = raw.lastIndexOf(']');
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    candidates.push(raw.slice(firstBracket, lastBracket + 1));
  }
  for (const cand of candidates) {
    try {
      const parsed = JSON.parse(cand);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.items)) return parsed.items;
    } catch { /* try next candidate */ }
  }
  return [];
}

function matchGroundingChunk(item, chunks) {
  if (!chunks.length) return null;
  const hay = normKey(`${item.title || ''} ${item.lab || ''} ${item.source || ''}`);
  const words = new Set(hay.split(' ').filter((w) => w.length > 2));
  const itemHost = hostOf(item.url || '');
  const srcNorm = normKey(item.source || '');

  let best = null;
  let bestScore = 0;
  for (const ch of chunks) {
    const chTitle = normKey(ch.title || '');
    const chHost = ch.host || '';
    let score = 0;
    if (itemHost && chHost && (itemHost === chHost || itemHost.endsWith(`.${chHost}`) || chHost.endsWith(`.${itemHost}`))) {
      score += 5;
    }
    if (srcNorm && chTitle && (chTitle.includes(srcNorm) || srcNorm.includes(chTitle))) {
      score += 3;
    }
    for (const w of chTitle.split(' ')) {
      if (w.length > 2 && words.has(w)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = ch;
    }
  }
  return bestScore >= 1 ? best : null;
}

export function parsePulseResponse(payload, { now = Date.now() } = {}) {
  const candidate = payload?.candidates?.[0];
  const text = (candidate?.content?.parts || [])
    .filter((p) => !p?.thought && typeof p?.text === 'string')
    .map((p) => p.text)
    .join('\n');

  const meta = candidate?.groundingMetadata || {};
  const webSearchQueries = Array.isArray(meta.webSearchQueries) ? meta.webSearchQueries.filter(Boolean) : [];
  const chunks = (Array.isArray(meta.groundingChunks) ? meta.groundingChunks : [])
    .map((c) => {
      const uri = safePulseUrl(c?.web?.uri);
      const title = cleanText(c?.web?.title || '', 80);
      if (!uri) return null;
      const host = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(title) ? title.toLowerCase().replace(/^www\./, '') : hostOf(uri);
      return { uri, title, host };
    })
    .filter(Boolean);

  const rawItems = extractJsonArray(text);
  const items = [];
  const seenTitles = new Set();
  const seenUrls = new Set();

  for (const entry of rawItems) {
    if (!entry || typeof entry !== 'object') continue;
    const title = cleanText(entry.title, 118);
    if (title.length < 8) continue;

    const titleKey = normKey(title).slice(0, 48);
    if (!titleKey || seenTitles.has(titleKey)) continue;

    // Validate publishedAt: drop stale stories (> 14 days old), clamp small future skew to `now`
    let pubTs = Date.parse(String(entry.publishedAt || ''));
    if (Number.isFinite(pubTs)) {
      if (now - pubTs > MAX_AGE_MS) continue;
      if (pubTs - now > MAX_FUTURE_SKEW_MS) pubTs = now;
    } else {
      pubTs = now;
    }
    const publishedAt = new Date(pubTs).toISOString();

    const directUrl = safePulseUrl(entry.url);
    const matchedChunk = matchGroundingChunk(entry, chunks);
    let url = directUrl;
    if (!url && matchedChunk) url = matchedChunk.uri;
    // If Gemini emitted a direct URL whose domain never appeared in grounding chunks while a matching
    // verified grounding chunk exists, prefer the verified grounding link so we never serve 404s.
    if (url && chunks.length && !url.includes('vertexaisearch.cloud.google.com')) {
      const uHost = hostOf(url);
      const hostGrounded = chunks.some((c) => c.host && (uHost === c.host || uHost.endsWith(`.${c.host}`) || c.host.endsWith(`.${uHost}`)));
      if (!hostGrounded && matchedChunk) url = matchedChunk.uri;
    }
    if (!url || seenUrls.has(url)) continue;

    const ghRaw = safePulseUrl(entry.githubUrl);
    const githubUrl = isGitHubRepoUrl(ghRaw) ? ghRaw : (isGitHubRepoUrl(url) ? url : null);
    const hfRaw = safePulseUrl(entry.huggingfaceUrl);
    const huggingfaceUrl = isHuggingFaceUrl(hfRaw) ? hfRaw : (isHuggingFaceUrl(url) ? url : null);

    const summary = cleanText(entry.summary || '', 200) || `${title} — verified via Gemini live web search.`;
    const lab = cleanText(entry.lab || '', 42);
    const publisher = cleanText(entry.source || matchedChunk?.title || hostOf(url) || '', 42);

    seenTitles.add(titleKey);
    seenUrls.add(url);

    const compact = {
      id: pulseSlug(`${title}-${publishedAt.slice(0, 10)}`),
      t: title,
      s: summary,
      u: url.slice(0, 420),
      d: publishedAt,
    };
    if (githubUrl) compact.g = githubUrl.slice(0, 220);
    if (huggingfaceUrl) compact.h = huggingfaceUrl.slice(0, 220);
    if (lab) compact.l = lab;
    if (publisher) compact.p = publisher;

    items.push(compact);
    if (items.length >= MAX_PULSE_ITEMS) break;
  }

  return {
    items,
    queryCount: webSearchQueries.length || (chunks.length ? 1 : (items.length ? 1 : 0)),
  };
}

// ---------- Compact storage & hydration ----------

export function compactPulseRecord(record) {
  const out = {
    v: 1,
    at: Number(record?.at) || 0,
    claimedAt: Number(record?.claimedAt) || 0,
    backoffUntil: Number(record?.backoffUntil) || 0,
    model: cleanText(record?.model || 'gemini-3.1-flash-lite', 50),
    queryCount: Math.max(0, Math.min(20, Math.floor(Number(record?.queryCount) || 0))),
    items: Array.isArray(record?.items)
      ? record.items
        .filter((it) => it && typeof it.t === 'string' && typeof it.u === 'string' && safePulseUrl(it.u))
        .slice(0, MAX_PULSE_ITEMS)
        .map((it) => {
          const c = {
            id: cleanText(it.id || pulseSlug(it.t), 64),
            t: cleanText(it.t, 118),
            s: cleanText(it.s || '', 200),
            u: safePulseUrl(it.u).slice(0, 420),
            d: Number.isFinite(Date.parse(it.d)) ? new Date(Date.parse(it.d)).toISOString() : new Date().toISOString(),
          };
          if (it.g && isGitHubRepoUrl(safePulseUrl(it.g))) c.g = safePulseUrl(it.g).slice(0, 220);
          if (it.h && isHuggingFaceUrl(safePulseUrl(it.h))) c.h = safePulseUrl(it.h).slice(0, 220);
          if (it.l) c.l = cleanText(it.l, 42);
          if (it.p) c.p = cleanText(it.p, 42);
          return c;
        })
      : [],
  };

  while (out.items.length > 0 && Buffer.byteLength(JSON.stringify(out), 'utf8') > MAX_PULSE_BYTES) {
    out.items.pop();
  }
  return out;
}

export function hydratePulseItems(compactItems = [], classifyFn = null) {
  if (!Array.isArray(compactItems)) return [];
  const stories = [];
  for (const it of compactItems) {
    if (!it || typeof it.t !== 'string') continue;
    const url = safePulseUrl(it.u);
    if (!url) continue;
    const title = cleanText(it.t, 120);
    const summary = cleanText(it.s || '', 220) || 'Breaking global AI dispatch discovered by Gemini Live Web Pulse.';
    const labHint = cleanText(it.l || '', 48);
    const publisher = cleanText(it.p || '', 48);
    const githubUrl = it.g && isGitHubRepoUrl(safePulseUrl(it.g)) ? safePulseUrl(it.g) : null;
    const huggingfaceUrl = it.h && isHuggingFaceUrl(safePulseUrl(it.h)) ? safePulseUrl(it.h) : null;
    const publishedAt = Number.isFinite(Date.parse(it.d)) ? new Date(Date.parse(it.d)).toISOString() : new Date().toISOString();

    const info = typeof classifyFn === 'function'
      ? classifyFn(`${title} ${summary} ${labHint} ${publisher} ${githubUrl || ''} ${huggingfaceUrl || ''}`, {
        hub: 'sf',
        lab: labHint || undefined,
        source: publisher ? `Web Pulse · ${publisher}` : 'Gemini Live Web Pulse',
        openWeights: Boolean(githubUrl || huggingfaceUrl),
        breaking: true,
      })
      : {
        hub: 'sf',
        region: 'global',
        regionLabel: 'Global',
        lab: labHint || publisher || 'Global AI',
        category: 'models',
        openWeights: Boolean(githubUrl || huggingfaceUrl),
        breaking: true,
        tags: ['Live Pulse'],
      };

    const tags = Array.isArray(info.tags) ? [...info.tags] : [];
    if (!tags.includes('Live Pulse')) tags.push('Live Pulse');

    stories.push({
      id: cleanText(it.id || pulseSlug(title), 68),
      title,
      summary,
      source: publisher ? `Web Pulse · ${publisher}` : 'Gemini Live Web Pulse',
      sourceKind: 'pulse',
      url,
      githubUrl,
      huggingfaceUrl,
      image: null,
      publishedAt,
      ...info,
      breaking: true,
      tags: tags.slice(0, 4),
    });
  }
  return stories;
}

// ---------- Gemini API call & Supabase shared state ----------

export async function runGeminiSearchPulse({ fetchImpl = globalThis.fetch, cfg, now = Date.now(), timeoutMs = PULSE_TIMEOUT_MS } = {}) {
  if (!cfg?.geminiKey) throw new Error('pulse: missing GEMINI_API_KEY');
  const model = cfg.geminiModel || 'gemini-3.1-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'x-goog-api-key': cfg.geminiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildPulsePrompt(now) }] }],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1600,
        thinkingConfig: { thinkingLevel: 'LOW' },
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    let detail = '';
    try {
      const errBody = await res.json();
      detail = cleanText(errBody?.error?.message || '', 120);
    } catch { /* ignore */ }
    // Never include cfg.geminiKey in error messages
    const safeDetail = detail && cfg.geminiKey ? detail.split(cfg.geminiKey).join('[redacted]') : detail;
    const err = new Error(`pulse: Gemini HTTP ${res.status}${safeDetail ? ` (${safeDetail})` : ''}`);
    err.status = res.status;
    throw err;
  }
  const payload = await res.json();
  return parsePulseResponse(payload, { now });
}

async function supabaseRpc(fetchImpl, cfg, fn, args) {
  if (!cfg?.supabaseUrl || !cfg?.supabaseKey) return { ok: false, unconfigured: true, data: null };
  try {
    const res = await fetchImpl(`${cfg.supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: cfg.supabaseKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args || {}),
      signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, status: res.status, data: null };
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false, data: null };
  }
}

async function readSharedState(fetchImpl, cfg) {
  const r = await supabaseRpc(fetchImpl, cfg, 'feed_state_get', {});
  if (!r.ok) return null;
  return r.data && typeof r.data === 'object' && !Array.isArray(r.data) ? r.data : {};
}

async function writeSharedPulse(fetchImpl, cfg, pulseRecord, fallbackState = {}) {
  if (!cfg?.supabaseUrl || !cfg?.supabaseKey) return false;
  // Always re-read latest feed state so `/api/feed` keys (`since`, `market`, `diary`) are never lost.
  const latest = (await readSharedState(fetchImpl, cfg)) || fallbackState || {};
  const nextState = { ...latest, ainewsPulse: compactPulseRecord(pulseRecord) };
  const r = await supabaseRpc(fetchImpl, cfg, 'feed_state_put', { p_state: nextState });
  return Boolean(r.ok && r.data !== false);
}

// ---------- In-memory warm cache & single-flight lock ----------

const memCache = new Map();
const inflightByKey = new Map();

export function _resetGeminiPulseCache() {
  memCache.clear();
  inflightByKey.clear();
}

function cacheKeyFor(cfg) {
  return `${cfg?.supabaseUrl || 'local'}::${cfg?.geminiModel || 'gemini-3.1-flash-lite'}`;
}

function formatResult(status, record, classifyItem) {
  const at = Number(record?.at) || 0;
  const backoffUntil = Number(record?.backoffUntil) || 0;
  const nextAt = Math.max(at ? at + PULSE_INTERVAL_MS : 0, backoffUntil);
  return {
    status,
    items: hydratePulseItems(record?.items || [], classifyItem),
    at,
    nextAt,
    model: record?.model || 'gemini-3.1-flash-lite',
    queryCount: Number(record?.queryCount) || 0,
  };
}

export async function getGeminiNewsPulse({
  fetchImpl = globalThis.fetch,
  cfg,
  now = Date.now(),
  classifyItem = null,
} = {}) {
  if (!cfg?.geminiKey || cfg?.ainewsPulse === false) {
    return { status: 'off', items: [], at: 0, nextAt: 0, model: cfg?.geminiModel || 'gemini-3.1-flash-lite', queryCount: 0 };
  }

  const key = cacheKeyFor(cfg);
  const mem = memCache.get(key);

  // 1. Warm-container fast path: 0 Supabase calls, 0 Gemini calls while inside 30-min window or error backoff.
  if (mem) {
    if (mem.at && now - mem.at < PULSE_INTERVAL_MS) {
      return formatResult('cached', mem, classifyItem);
    }
    if (mem.backoffUntil && now < mem.backoffUntil) {
      return formatResult(mem.items?.length ? 'cached' : 'offline', mem, classifyItem);
    }
  }

  // 2. Deduplicate concurrent refreshes inside the same container.
  if (inflightByKey.has(key)) {
    const shared = await inflightByKey.get(key);
    return formatResult(shared.status, shared.record, classifyItem);
  }

  const task = (async () => {
    const hasDb = Boolean(cfg.supabaseUrl && cfg.supabaseKey);
    const sharedState = hasDb ? await readSharedState(fetchImpl, cfg) : null;
    const remote = sharedState?.ainewsPulse && typeof sharedState.ainewsPulse === 'object'
      ? compactPulseRecord(sharedState.ainewsPulse)
      : null;

    const baseline = remote || mem || compactPulseRecord({ model: cfg.geminiModel });

    // 3. Shared Supabase cooldown / backoff / active-lease check across all serverless containers.
    if (remote) {
      if (remote.at && now - remote.at < PULSE_INTERVAL_MS) {
        memCache.set(key, remote);
        return { status: 'cached', record: remote };
      }
      if (remote.backoffUntil && now < remote.backoffUntil) {
        memCache.set(key, remote);
        return { status: remote.items.length ? 'cached' : 'offline', record: remote };
      }
      if (remote.claimedAt && now - remote.claimedAt < PULSE_LEASE_MS) {
        return { status: remote.items.length ? 'cached' : 'offline', record: remote };
      }
    }

    // 4. Claim a short lease in Supabase before hitting Gemini so concurrent cold starts back off.
    if (hasDb && sharedState !== null) {
      await writeSharedPulse(fetchImpl, cfg, { ...baseline, claimedAt: now }, sharedState);
    }

    // 5. Run the single 30-minute Gemini Google-Search web pulse.
    try {
      const { items, queryCount } = await runGeminiSearchPulse({ fetchImpl, cfg, now });
      if (items.length > 0) {
        const fresh = compactPulseRecord({
          at: now,
          claimedAt: 0,
          backoffUntil: 0,
          model: cfg.geminiModel || 'gemini-3.1-flash-lite',
          queryCount,
          items,
        });
        memCache.set(key, fresh);
        if (hasDb && sharedState !== null) {
          await writeSharedPulse(fetchImpl, cfg, fresh, sharedState);
        }
        return { status: 'live', record: fresh };
      }
      // Empty response: keep previous cached items and back off for 5 min.
      const backedOff = compactPulseRecord({
        ...baseline,
        claimedAt: 0,
        backoffUntil: now + PULSE_BACKOFF_MS,
      });
      memCache.set(key, backedOff);
      if (hasDb && sharedState !== null) {
        await writeSharedPulse(fetchImpl, cfg, backedOff, sharedState);
      }
      return { status: backedOff.items.length ? 'cached' : 'offline', record: backedOff };
    } catch (err) {
      console.warn(`[ainews-pulse] skipped: ${err?.message || 'error'}`);
      const backedOff = compactPulseRecord({
        ...baseline,
        claimedAt: 0,
        backoffUntil: now + PULSE_BACKOFF_MS,
      });
      memCache.set(key, backedOff);
      if (hasDb && sharedState !== null) {
        await writeSharedPulse(fetchImpl, cfg, backedOff, sharedState);
      }
      return { status: backedOff.items.length ? 'cached' : 'offline', record: backedOff };
    }
  })().finally(() => {
    inflightByKey.delete(key);
  });

  inflightByKey.set(key, task);
  const done = await task;
  return formatResult(done.status, done.record, classifyItem);
}
