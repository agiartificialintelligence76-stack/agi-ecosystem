// Live global AI news, open-weight repositories, @theAIsearch video + tool aggregator,
// and 30-minute shared Gemini Google-Search web pulse (server/ainews-pulse.js).
// Serves JSON at GET /api/health?ainews=1 and valid RSS 2.0 XML at GET /api/health?ainews=1&format=rss (or /ainews/rss).
import {
  AISEARCH_CHANNEL,
  WORLD_HUBS,
  SPOTLIGHT_STORIES,
  FALLBACK_AISEARCH_VIDEOS,
  FALLBACK_OPEN_WEIGHTS,
} from './ainews-seed.js';
import { getConfig } from './config.js';
import {
  getGeminiNewsPulse,
  _resetGeminiPulseCache,
  PULSE_INTERVAL_MS,
} from './ainews-pulse.js';
import { botName } from '../src/chat/telegram-link.js';

const USER_AGENT = 'AGI1-AINews/1.0 (+https://agi1.app/ainews)';
const SOURCE_TIMEOUT_MS = 4800;
const CACHE_TTL_MS = 90 * 1000;

const NEWS_FEEDS = Object.freeze([
  { id: 'nvidia-newsroom', name: 'NVIDIA Newsroom', url: 'https://nvidianews.nvidia.com/releases.xml', defaultHub: 'sf', limit: 6, isLabFeed: true },
  { id: 'openai', name: 'OpenAI News', url: 'https://openai.com/news/rss.xml', defaultHub: 'sf', limit: 8, isLabFeed: true },
  { id: 'deepmind', name: 'Google DeepMind', url: 'https://deepmind.google/blog/rss.xml', defaultHub: 'london', limit: 8, isLabFeed: true },
  { id: 'google-ai', name: 'Google AI Blog', url: 'https://blog.google/innovation-and-ai/rss/', defaultHub: 'sf', limit: 8, isLabFeed: true },
  { id: 'hf-blog', name: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml', defaultHub: 'sf', limit: 6, isLabFeed: true },
  { id: 'decoder', name: 'The Decoder', url: 'https://the-decoder.com/feed/', defaultHub: 'sf', limit: 12 },
  { id: 'tc-ai', name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', defaultHub: 'sf', limit: 10 },
  { id: 'verge-ai', name: 'The Verge AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', defaultHub: 'nyc', limit: 10 },
  { id: 'smol-ai', name: 'Smol AI Digest', url: 'https://news.smol.ai/rss.xml', defaultHub: 'sf', limit: 4 },
  { id: 'gnews-global-ai', name: 'Google News AI', url: 'https://news.google.com/rss/search?q=(OpenAI+OR+Anthropic+OR+"Google+DeepMind"+OR+"Google+Gemini"+OR+Claude+OR+Grok+OR+xAI+OR+"Meta+Muse"+OR+NVIDIA+OR+"Jensen+Huang"+OR+"Tesla+Optimus"+OR+"Tesla+FSD"+OR+"Tesla+Robotaxi")+when:1d&hl=en-US&gl=US&ceid=US:en', defaultHub: 'sf', limit: 16, isAggregator: true },
  { id: 'gnews-china-ai', name: 'Google News China AI', url: 'https://news.google.com/rss/search?q=(Zhipu+OR+GLM+OR+Qwen+OR+Kimi+OR+DeepSeek+OR+MiniMax+OR+Hunyuan)+AI+when:2d&hl=en-US&gl=US&ceid=US:en', defaultHub: 'beijing', limit: 10, isAggregator: true },
]);

const GITHUB_ORGS = Object.freeze([
  { org: 'zai-org', lab: 'Z.ai GLM', hub: 'beijing', region: 'china', limit: 4 },
  { org: 'MoonshotAI', lab: 'Moonshot AI', hub: 'beijing', region: 'china', limit: 4 },
  { org: 'QwenLM', lab: 'Alibaba Qwen', hub: 'hangzhou', region: 'china', limit: 5 },
  { org: 'deepseek-ai', lab: 'DeepSeek', hub: 'hangzhou', region: 'china', limit: 4 },
  { org: 'mistralai', lab: 'Mistral AI', hub: 'paris', region: 'europe', limit: 3 },
  { org: 'SakanaAI', lab: 'Sakana AI', hub: 'tokyo', region: 'asia', limit: 3 },
]);

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const HF_MODELS_URL = 'https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=18';
const HF_PAPERS_URL = 'https://huggingface.co/api/daily_papers?limit=10';
const HN_AI_URL = 'https://hn.algolia.com/api/v1/search_by_date?query=AI&tags=story&numericFilters=points%3E40&hitsPerPage=12';

const REGION_LABEL = Object.freeze({
  americas: 'Americas',
  china: 'China & Asia',
  europe: 'Europe',
  asia: 'East Asia',
  global: 'Global',
});

const HUB_BY_ID = Object.freeze(Object.fromEntries(WORLD_HUBS.map((h) => [h.id, h])));

// ---------- text, XML, and URL helpers ----------

const NAMED_ENTITIES = Object.freeze({
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…',
});

export function decodeEntities(value = '') {
  return String(value ?? '').replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi, (m, hex, dec, named) => {
    if (hex) {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }
    if (dec) {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }
    return NAMED_ENTITIES[named.toLowerCase()] ?? m;
  });
}

export function stripHtml(raw = '') {
  const unwrapped = String(raw ?? '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  const decoded = decodeEntities(unwrapped);
  const withoutTags = decoded
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(withoutTags).replace(/\s+/g, ' ').trim();
}

export function truncate(text = '', max = 220) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

export function safeHttpUrl(raw) {
  let s = decodeEntities(String(raw ?? '').trim()).replace(/[),.;]+$/, '');
  if (!s) return null;
  if (/^[a-z0-9.-]+\.[a-z]{2,}\/\S*$/i.test(s) && !s.startsWith('http')) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (u.username || u.password) return null;
    if (u.protocol === 'http:') u.protocol = 'https:';
    return u.href;
  } catch {
    return null;
  }
}

const SKIP_IMAGE_RE = /(?:favicon|icon[-_]?\d|sprite|avatar[-_]default|gravatar|verge-rss-large|\/google\.png$|1x1|pixel\.gif|emoji)/i;

export function safeImageUrl(raw) {
  const s = decodeEntities(String(raw ?? '').trim());
  if (!s) return null;
  if (s.startsWith('/images/ainews/') && /^\/images\/ainews\/[a-z0-9_-]+\.(?:webp|jpg|jpeg|png)$/i.test(s)) return s;
  const url = safeHttpUrl(s);
  if (!url) return null;
  if (SKIP_IMAGE_RE.test(url)) return null;
  return url;
}

export function safeIsoDate(raw, fallback = null) {
  const ts = Date.parse(String(raw ?? ''));
  return Number.isFinite(ts) ? new Date(ts).toISOString() : fallback;
}

function slugId(prefix, seed) {
  const clean = String(seed ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
  return `${prefix}-${clean || 'item'}`;
}

export function extractGitHubRepo(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.toLowerCase() !== 'github.com' && u.hostname.toLowerCase() !== 'www.github.com') return null;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    if (['topics', 'orgs', 'search', 'features', 'explore', 'marketplace', 'settings', 'about'].includes(parts[0].toLowerCase())) return null;
    return `${parts[0]}/${parts[1].replace(/\.git$/i, '')}`;
  } catch {
    return null;
  }
}

// ---------- entity, region, hub & category classification ----------

const ENTITY_RULES = [
  { re: /\b(qwen|alibaba|tongyi|wan\s?2|zju3dv|internlm|sage\s?s2)\b/i, hub: 'hangzhou', region: 'china', lab: 'Alibaba Qwen' },
  { re: /\b(deepseek)\b/i, hub: 'hangzhou', region: 'china', lab: 'DeepSeek' },
  { re: /\b(minimax|hailuo|sensenova|sensetime)\b/i, hub: 'hangzhou', region: 'china', lab: 'China AI Lab' },
  { re: /\b(zhipu|z\.ai|zai-org|glm[-\s]?\d)\b/i, hub: 'beijing', region: 'china', lab: 'Z.ai GLM' },
  { re: /\b(kimi|moonshot)\b/i, hub: 'beijing', region: 'china', lab: 'Moonshot AI' },
  { re: /\b(tencent|hunyuan|movieroll|wemm|hy4|baidu|ernie|kling|kuaishou|bytedance|seedream|seedance|longcat|meituan|xiaomi|huawei)\b/i, hub: 'beijing', region: 'china', lab: 'China AI Lab' },
  { re: /\b(anthropic|claude|opus|sonnet|haiku|fable|mythos)\b/i, hub: 'sf', region: 'americas', lab: 'Anthropic' },
  { re: /\b(openai|sam altman|altman|chatgpt|gpt-[4567]|sora|codex|astra)\b/i, hub: 'sf', region: 'americas', lab: 'OpenAI' },
  { re: /\b(meta\b|muse\s+(?:ember|wonder|spark|glimmer|code)|llama|fair\b)\b/i, hub: 'sf', region: 'americas', lab: 'Meta Muse' },
  { re: /\b(deepmind|alphagenome|alphafold|genie\s*[234])\b/i, hub: 'london', region: 'europe', lab: 'Google DeepMind' },
  { re: /\b(google|gemini|veo|imagen|gemma|notebooklm)\b/i, hub: 'sf', region: 'americas', lab: 'Google AI' },
  { re: /\b(mistral|black forest labs|flux\b|eu ai act|european|aleph alpha)\b/i, hub: 'paris', region: 'europe', lab: 'Mistral & EU' },
  { re: /\b(xai|grok(?:[-\s]?\d+(?:\.\d+)?)?|colossus)\b/i, hub: 'sf', region: 'americas', lab: 'xAI Grok' },
  { re: /\b(nvidia|jensen\s+huang|blackwell|rubin\s+gpu|cuda|tensorrt)\b/i, hub: 'sf', region: 'americas', lab: 'NVIDIA' },
  { re: /\b(tesla\s+(?:ai|optimus|fsd|robotaxi|dojo|autopilot|cybercab)|optimus\s+(?:robot|gen|v\d)|full self-driving|cybercab)\b/i, hub: 'sf', region: 'americas', lab: 'Tesla AI' },
  { re: /\b(ipo|nasdaq|nyse|wall street|sec filing|valuation|funding|billion|trillion)\b/i, hub: 'nyc', region: 'americas', lab: '' },
  { re: /\b(apple|tesla|perplexity|cursor|luma|runway|ideogram|midjourney|thinking\s?machines|inworld|bria|stanford|berkeley|microsoft|copilot|figure\s?0\d|unitree|boston dynamics)\b/i, hub: 'sf', region: 'americas', lab: '' },
  { re: /\b(sakana|sony|tokyo|japan|seoul|korea|naver|lg ai|singapore|sea-lion)\b/i, hub: 'tokyo', region: 'asia', lab: 'East Asia AI' },
];

export function classifyItem(text = '', defaults = {}) {
  const hay = String(text ?? '');
  let hub = defaults.hub || 'sf';
  let region = defaults.region || HUB_BY_ID[hub]?.region || 'americas';
  let lab = defaults.lab || '';

  for (const rule of ENTITY_RULES) {
    if (rule.re.test(hay)) {
      hub = rule.hub;
      region = rule.region;
      if (rule.lab && !lab) lab = rule.lab;
      break;
    }
  }
  // Anthropic IPO specifically belongs on NYC markets hub if both match
  if (/\banthropic\b/i.test(hay) && /\b(ipo|nasdaq|public|shares|ticker)\b/i.test(hay)) {
    hub = 'nyc';
    region = 'americas';
    lab = 'Anthropic';
  }

  let category = defaults.category || 'models';
  if (!defaults.category) {
    if (/\b(ipo|funding|raises|valuation|billion|lawsuit|regulation|antitrust|acquisition|deal|sam altman|jensen huang|reinstat\w*|ceo\b|policy|senate|congress|stocks?|nasdaq)\b/i.test(hay)) {
      category = 'markets';
    } else if (/\b(open[- ]weights?|open[- ]source|github\.com|huggingface\.co|apache[- ]2|mit license|weights released|gguf|vllm|comfyui)\b/i.test(hay)) {
      category = 'opensource';
    } else if (/\b(paper|arxiv|benchmark|theorem|riemann|navier|genome|dna|protein|physics|math|researchers?|study)\b/i.test(hay)) {
      category = 'research';
    } else if (/\b(tool|workflow|plugin|cli|sdk|agent harness|voice isolator|avatar|editor|3d|splat|video model|tts|audio)\b/i.test(hay)) {
      category = 'tools';
    } else {
      category = 'models';
    }
  }

  const openWeights = Boolean(
    defaults.openWeights
    || /\b(open[- ]weights?|open[- ]source|apache\s?2\.0|mit license|weights on hugging face|github\.com\/(?:QwenLM|MoonshotAI|deepseek-ai|meta-llama|mistralai))\b/i.test(hay)
  );

  const breaking = Boolean(
    defaults.breaking
    || /\b(launches?|releases?|unveils?|announces?|reinstates?|returns?\s+as\s+ceo|steps?\s+down|ipo|agi\b|gpt-6|gemini 4|claude|fable|kimi k3|qwen|glm[-\s]?5|grok|xai|nvidia|jensen huang|optimus|robotaxi|fsd\s?v?\d|muse ember|muse wonder|genie 4|solved)\b/i.test(hay)
  );

  const tags = [];
  const tagChecks = [
    [/\bglm\b|zhipu|z\.ai/i, 'GLM'],
    [/\bqwen\b/i, 'Qwen'],
    [/\bkimi\b/i, 'Kimi'],
    [/\bxai|grok\b/i, 'xAI Grok'],
    [/\bnvidia|jensen\s+huang|blackwell\b/i, 'NVIDIA'],
    [/\btesla|optimus|robotaxi|fsd|cybercab\b/i, 'Tesla AI'],
    [/\banthropic|claude|fable\b/i, 'Anthropic'],
    [/\bopenai|gpt-|altman\b/i, 'OpenAI'],
    [/\bmuse\b/i, 'Meta Muse'],
    [/\bgemini|genie|deepmind\b/i, 'Google DeepMind'],
    [/\bdeepseek\b/i, 'DeepSeek'],
    [/\bipo|nasdaq\b/i, 'IPO & Markets'],
    [/\bagi\b/i, 'AGI'],
    [/\bvideo|avatar|movieroll|kling|sora|veo\b/i, 'Video AI'],
    [/\btts|voice|audio|music\b/i, 'Audio & Voice'],
    [/\b3d|splat|depth|world model|genie\b/i, '3D & Worlds'],
    [/\brobot|optimus|humanoid|robotaxi|fsd|physical agent|unitree|boston dynamics\b/i, 'Robotics'],
  ];
  for (const [re, label] of tagChecks) if (re.test(hay) && tags.length < 4) tags.push(label);
  if (openWeights && !tags.includes('Open Weights')) tags.unshift('Open Weights');
  if (!tags.length) tags.push(REGION_LABEL[region] || 'AI World');

  return {
    hub,
    region,
    regionLabel: REGION_LABEL[region] || 'Global',
    lab: lab || defaults.source || 'Global AI',
    category,
    openWeights,
    breaking,
    tags: tags.slice(0, 4),
  };
}

// ---------- RSS & Atom parser ----------

function tagContent(block, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = re.exec(block);
  return m ? m[1] : '';
}

function attrValue(tagStr, attr) {
  const re = new RegExp(`${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i');
  const m = re.exec(tagStr);
  return m ? decodeEntities(m[1] ?? m[2] ?? '') : '';
}

function extractImageFromEntry(block) {
  // 1. media:content or media:thumbnail
  for (const re of [
    /<media:content\b[^>]*>/gi,
    /<media:thumbnail\b[^>]*>/gi,
    /<enclosure\b[^>]*>/gi,
  ]) {
    let m;
    while ((m = re.exec(block))) {
      const tag = m[0];
      const url = attrValue(tag, 'url');
      const type = attrValue(tag, 'type');
      if (type && !type.startsWith('image/') && !/\.(?:jpg|jpeg|png|webp|avif)(?:\?|$)/i.test(url)) continue;
      const safe = safeImageUrl(url);
      if (safe) return safe;
    }
  }
  // 2. first <img> inside description or content:encoded / content
  const body = decodeEntities(
    tagContent(block, 'content:encoded') || tagContent(block, 'content') || tagContent(block, 'description') || tagContent(block, 'summary')
  );
  const imgMatch = /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)')/i.exec(body);
  if (imgMatch) {
    const safe = safeImageUrl(imgMatch[1] || imgMatch[2]);
    if (safe) return safe;
  }
  return null;
}

function extractLinksFromEntry(block) {
  const body = decodeEntities(
    tagContent(block, 'content:encoded') || tagContent(block, 'content') || tagContent(block, 'description') || tagContent(block, 'summary')
  );
  const urls = [...body.matchAll(/https?:\/\/[^\s"'<>)]+/gi)].map((m) => safeHttpUrl(m[0])).filter(Boolean);
  const githubUrl = urls.find((u) => extractGitHubRepo(u)) || null;
  const huggingfaceUrl = urls.find((u) => /^https:\/\/(?:www\.)?huggingface\.co\//i.test(u)) || null;
  return { githubUrl, huggingfaceUrl };
}

const AI_RELEVANCE_RE = /\b(ai\b|artificial intelligence|llm|model|open[- ]weights?|openai|anthropic|claude|gemini|deepmind|grok|xai|qwen|kimi|deepseek|glm|zhipu|minimax|hunyuan|muse|llama|mistral|optimus|robotaxi|fsd|nvidia|jensen huang|gpu|neural|transformer|agent|chatbot|agi\b|robotics|humanoid|sam altman|amodei|coding|benchmark|perplexity)\b/i;
const NON_AI_NOISE_RE = /\b(zodiac|horoscope|astrology|supermoon|full moon|retrograde|tarot)\b/i;

function cleanPublisherName(raw = '') {
  return stripHtml(raw)
    .replace(/\.(?:com|org|net|co\.uk)$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48);
}

export function parseRssOrAtom(xml = '', meta = {}) {
  const text = String(xml ?? '');
  const isAtom = /<entry[\s>]/i.test(text) && !/<item[\s>]/i.test(text);
  const re = isAtom ? /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi : /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  const items = [];
  let match;
  const limit = meta.limit || 12;

  while ((match = re.exec(text)) && items.length < limit) {
    const block = match[1];
    let title = stripHtml(tagContent(block, 'title'));
    if (!title || title.length < 4 || /^not much happened today$/i.test(title)) continue;

    // Extract actual publisher from RSS <source> (e.g. Google News RSS carries <source>Reuters</source>)
    // and strip redundant trailing " - Publisher" from Google News titles.
    const rawSourceTag = stripHtml(tagContent(block, 'source'));
    let publisher = rawSourceTag ? cleanPublisherName(rawSourceTag) : '';
    if (meta.isAggregator && !publisher) {
      const mTrail = /\s+-\s+([^|-]{2,48})$/.exec(title);
      if (mTrail) publisher = cleanPublisherName(mTrail[1]);
    }
    if (rawSourceTag) {
      const esc = rawSourceTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      title = title.replace(new RegExp(`\\s+[-–—|]\\s+${esc}$`, 'i'), '').trim() || title;
    } else if (meta.isAggregator && publisher) {
      const esc = publisher.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      title = title.replace(new RegExp(`\\s+[-–—|]\\s+${esc}(?:\\.(?:com|org|net))?$`, 'i'), '').trim() || title;
    }

    let link = '';
    if (isAtom) {
      const alt = /<link\b[^>]*rel=["']alternate["'][^>]*>/i.exec(block) || /<link\b[^>]*>/i.exec(block);
      link = alt ? attrValue(alt[0], 'href') : '';
    } else {
      link = stripHtml(tagContent(block, 'link'));
    }
    const url = safeHttpUrl(link);
    if (!url) continue;

    const rawDesc = tagContent(block, 'description') || tagContent(block, 'summary') || tagContent(block, 'content:encoded') || tagContent(block, 'content');
    let summary = truncate(stripHtml(rawDesc), 230);
    // Google News <description> often just repeats the title + publisher; drop duplicate boilerplate
    if (meta.isAggregator && summary && normalizeMatchKey(summary).startsWith(normalizeMatchKey(title).slice(0, 32))) {
      summary = '';
    }
    // Skip non-AI market-chatter or astrology ("Gemini Supermoon") spillover from broad aggregator queries
    if (meta.isAggregator && (NON_AI_NOISE_RE.test(`${title} ${summary}`) || !AI_RELEVANCE_RE.test(`${title} ${summary}`))) continue;

    const pubRaw = tagContent(block, 'pubDate') || tagContent(block, 'published') || tagContent(block, 'updated') || tagContent(block, 'dc:date');
    const publishedAt = safeIsoDate(stripHtml(pubRaw), new Date().toISOString());
    const image = extractImageFromEntry(block);
    const { githubUrl, huggingfaceUrl } = extractLinksFromEntry(block);
    const sourceLabel = publisher || meta.name || 'Global AI Wire';
    // Only feed `meta.name` into entity classification for official lab blogs (OpenAI, Google AI, DeepMind) —
    // NEVER for aggregators like "Google News AI" (whose name contains "Google" and would mislabel every article!).
    const classifyText = meta.isLabFeed ? `${title} ${summary} ${meta.name || ''}` : `${title} ${summary}`;
    const info = classifyItem(classifyText, { hub: meta.defaultHub, source: sourceLabel });

    items.push({
      id: slugId(meta.id || 'rss', `${title}-${publishedAt.slice(0, 10)}`),
      title,
      summary: summary || `Live AI news dispatch from ${sourceLabel}.`,
      source: sourceLabel,
      sourceKind: 'rss',
      ...(meta.isLabFeed ? { isLabFeed: true } : {}),
      url,
      githubUrl,
      huggingfaceUrl,
      image,
      publishedAt,
      ...info,
    });
  }
  return items;
}

// ---------- @theAIsearch YouTube Atom + Chapters + AI Tools Extractor ----------

const NOISE_LINK_RE = /(?:aisearchio|aisearch\.substack\.com|ai-search\.io|ko-fi\.com|amzn\.to|nvda\.ws|utm_source=AISearchTools|lumalabs\.ai\/aisearch|higgsfield\.ai\/s\/theaisearch|byteplus\.com\/en\/contact-us\/seedream)/i;
const STOP_SECTION_RE = /^(?:see my x|newsletter:|find ai tools|support:|here'?s my equipment|also see:)/i;

export function parseChapters(description = '') {
  const chapters = [];
  for (const line of String(description ?? '').split(/\r?\n/)) {
    const m = /^\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const hrs = m[1] ? Number(m[1]) : 0;
    const min = Number(m[2]);
    const sec = Number(m[3]);
    const total = hrs * 3600 + min * 60 + sec;
    const label = m[4].trim();
    if (!label || /^(?:ai news intro|intro)$/i.test(label)) continue;
    const clock = hrs > 0
      ? `${hrs}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    chapters.push({ label, sec: total, clock });
  }
  return chapters;
}

function normalizeMatchKey(s = '') {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function findMatchingChapter(toolName, chapters) {
  const target = normalizeMatchKey(toolName);
  if (!target || !chapters.length) return null;
  let best = null;
  let bestScore = 0;
  const targetWords = new Set(target.split(' ').filter((w) => w.length > 1));
  for (const ch of chapters) {
    const key = normalizeMatchKey(ch.label);
    if (key === target) return ch;
    if (key.includes(target) || target.includes(key)) return ch;
    const words = key.split(' ').filter((w) => w.length > 1);
    const overlap = words.filter((w) => targetWords.has(w)).length;
    const score = overlap / Math.max(1, Math.min(words.length, targetWords.size));
    if (overlap >= 1 && score > bestScore) {
      bestScore = score;
      best = ch;
    }
  }
  return bestScore >= 0.5 ? best : null;
}

function classifyToolUrl(url) {
  if (/^https:\/\/(?:www\.)?github\.com\//i.test(url)) return 'github';
  if (/^https:\/\/(?:www\.)?huggingface\.co\//i.test(url)) return 'huggingface';
  if (/\.github\.io\b/i.test(url)) return 'project';
  return 'launch';
}

export function extractAiSearchTools(description = '', video = {}) {
  const lines = String(description ?? '').split(/\r?\n/);
  const chapters = parseChapters(description);
  const tools = [];
  const seenUrls = new Set();
  let inAlsoSee = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      inAlsoSee = false;
      continue;
    }
    if (/^also see:?$/i.test(line)) {
      inAlsoSee = true;
      continue;
    }
    if (STOP_SECTION_RE.test(line)) {
      if (!/^also see/i.test(line)) break;
      continue;
    }
    if (inAlsoSee) continue;
    if (/thanks to our sponsor/i.test(line)) continue;
    if (/^#/.test(line)) continue;

    // Match explicit URL or bare domain like "Seedream 5.5 byteplus.com/..."
    const urlMatch = /(https?:\/\/\S+|[a-z0-9-]+(?:\.[a-z0-9-]+)+\/\S+)/i.exec(line);
    if (!urlMatch) continue;

    const rawUrl = urlMatch[1];
    if (NOISE_LINK_RE.test(rawUrl)) continue;
    if (/(?:youtu\.be|youtube\.com\/watch)/i.test(rawUrl)) continue;

    const url = safeHttpUrl(rawUrl);
    if (!url || seenUrls.has(url)) continue;

    let label = line.slice(0, urlMatch.index).replace(/[:–—-]+$/, '').trim();
    if (!label) {
      const gh = extractGitHubRepo(url);
      if (gh) label = gh.split('/')[1];
      else {
        try {
          const u = new URL(url);
          const seg = u.pathname.split('/').filter(Boolean).pop();
          label = seg || u.hostname.replace(/^www\./, '');
        } catch {
          label = 'AI Tool';
        }
      }
    }
    label = label.replace(/^(?:try|models to download|t2i workflow|edit workflow|download|link)\s*/i, (m) => (label.length > m.length + 2 ? `${m.trim()} · ` : m)).trim();
    if (!label || /^(?:sponsor|twitter|x|newsletter|support)$/i.test(label)) continue;

    seenUrls.add(url);
    const kind = classifyToolUrl(url);
    const repo = extractGitHubRepo(url);
    const chapter = findMatchingChapter(label, chapters);
    const info = classifyItem(`${label} ${url}`, { hub: 'sf', source: AISEARCH_CHANNEL.handle, category: 'tools' });

    tools.push({
      id: slugId('tool', `${video.videoId || 'v'}-${label}`),
      name: truncate(label, 68),
      url,
      kind,
      repo,
      githubUrl: kind === 'github' ? url : null,
      huggingfaceUrl: kind === 'huggingface' ? url : null,
      sec: chapter?.sec ?? 0,
      clock: chapter?.clock ?? '',
      videoId: video.videoId || '',
      videoTitle: video.title || '',
      videoUrl: video.videoId
        ? `https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}${chapter?.sec ? `&t=${chapter.sec}s` : ''}`
        : AISEARCH_CHANNEL.url,
      thumbnail: video.thumbnail || null,
      publishedAt: video.publishedAt || new Date().toISOString(),
      hub: info.hub,
      region: info.region,
      regionLabel: info.regionLabel,
      tags: info.tags,
    });
  }
  return { chapters, tools };
}

export function parseYouTubeAiSearchFeed(xml = '') {
  const text = String(xml ?? '');
  const entryRe = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  const videos = [];
  let match;

  while ((match = entryRe.exec(text)) && videos.length < 15) {
    const block = match[1];
    const videoId = stripHtml(tagContent(block, 'yt:videoId'));
    const title = stripHtml(tagContent(block, 'title'));
    if (!videoId || !title) continue;
    const publishedAt = safeIsoDate(stripHtml(tagContent(block, 'published')), new Date().toISOString());
    const description = decodeEntities(tagContent(block, 'media:description'));
    const thumbMatch = /<media:thumbnail\b[^>]*url="([^"]+)"/i.exec(block);
    const thumbnail = safeImageUrl(thumbMatch?.[1]) || `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
    const url = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;

    const firstLines = description
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !/^#/.test(l) && !/^\d{1,2}:\d{2}/.test(l))
      .slice(0, 2)
      .join(' ')
      .replace(/Thanks to our sponsor[\s\S]*$/i, '')
      .trim();

    const baseVideo = {
      id: `yt-${videoId}`,
      videoId,
      title,
      publishedAt,
      url,
      thumbnail,
      channel: AISEARCH_CHANNEL.handle,
      summary: truncate(firstLines || `${AISEARCH_CHANNEL.handle} video breakdown covering the latest AI models, open-source tools, and GitHub drops.`, 220),
    };
    const { chapters, tools } = extractAiSearchTools(description, baseVideo);
    videos.push({ ...baseVideo, chapters, tools });
  }
  return videos;
}

// ---------- GitHub & Hugging Face normalizers ----------

function normalizeGitHubRepos(repos, orgMeta) {
  if (!Array.isArray(repos)) return [];
  return repos
    .filter((r) => r && !r.archived && r.full_name && r.html_url)
    .slice(0, orgMeta.limit || 4)
    .map((r) => {
      const url = safeHttpUrl(r.html_url);
      if (!url) return null;
      const fullName = String(r.full_name);
      const summary = truncate(r.description || `Open-source AI repository from ${orgMeta.lab}.`, 200);
      return {
        id: slugId('gh', fullName),
        name: fullName,
        title: `${r.name} — ${orgMeta.lab}`,
        summary,
        lab: orgMeta.lab,
        hub: orgMeta.hub,
        region: orgMeta.region,
        regionLabel: REGION_LABEL[orgMeta.region] || 'Global',
        stars: Number(r.stargazers_count) || 0,
        language: r.language || '',
        githubUrl: url,
        huggingfaceUrl: orgMeta.org === 'QwenLM' ? 'https://huggingface.co/Qwen'
          : orgMeta.org === 'MoonshotAI' ? 'https://huggingface.co/moonshotai'
            : orgMeta.org === 'zai-org' ? 'https://huggingface.co/zai-org'
              : orgMeta.org === 'deepseek-ai' ? 'https://huggingface.co/deepseek-ai'
                : orgMeta.org === 'mistralai' ? 'https://huggingface.co/mistralai'
                  : orgMeta.org === 'SakanaAI' ? 'https://huggingface.co/SakanaAI' : null,
        url,
        image: orgMeta.org === 'QwenLM' ? '/images/ainews/qwen-china.webp'
          : orgMeta.org === 'MoonshotAI' ? '/images/ainews/kimi-k3.webp' : null,
        publishedAt: safeIsoDate(r.pushed_at || r.updated_at, new Date().toISOString()),
        source: `GitHub · ${orgMeta.org}`,
        kind: 'github',
        tags: ['Open Weights', 'GitHub', orgMeta.lab],
      };
    })
    .filter(Boolean);
}

function normalizeHfModels(models) {
  if (!Array.isArray(models)) return [];
  return models
    .filter((m) => m && typeof m.id === 'string' && m.id.includes('/'))
    .slice(0, 14)
    .map((m) => {
      const id = String(m.id);
      const [author, modelName] = id.split('/');
      const info = classifyItem(`${id} ${(m.tags || []).join(' ')}`, {
        hub: 'sf',
        source: 'Hugging Face',
        category: 'opensource',
        openWeights: true,
      });
      const url = `https://huggingface.co/${encodeURI(id)}`;
      return {
        id: slugId('hf', id),
        name: id,
        title: `${modelName} by ${author}`,
        summary: `${m.pipeline_tag ? `${m.pipeline_tag.replace(/-/g, ' ')} · ` : ''}Trending open-weight release on Hugging Face${m.likes ? ` with ${m.likes.toLocaleString('en-US')} likes` : ''}${m.downloads ? ` and ${m.downloads.toLocaleString('en-US')} recent downloads` : ''}.`,
        lab: info.lab !== 'Hugging Face' ? info.lab : author,
        hub: info.hub,
        region: info.region,
        regionLabel: info.regionLabel,
        likes: Number(m.likes) || 0,
        downloads: Number(m.downloads) || 0,
        pipeline: m.pipeline_tag || 'model',
        githubUrl: null,
        huggingfaceUrl: url,
        url,
        image: null,
        publishedAt: safeIsoDate(m.createdAt, new Date().toISOString()),
        source: 'Hugging Face Trending',
        kind: 'huggingface',
        tags: ['Open Weights', m.pipeline_tag || 'Model', info.regionLabel].filter(Boolean).slice(0, 3),
      };
    });
}

function normalizeHfPapers(papers) {
  if (!Array.isArray(papers)) return [];
  return papers
    .filter((p) => p?.paper?.id && p?.title)
    .slice(0, 8)
    .map((entry) => {
      const p = entry.paper;
      const title = stripHtml(entry.title || p.title);
      const summary = truncate(stripHtml(entry.summary || p.ai_summary || p.summary || ''), 220);
      const githubUrl = safeHttpUrl(p.githubRepo);
      const url = `https://huggingface.co/papers/${encodeURIComponent(p.id)}`;
      const image = safeImageUrl(entry.thumbnail);
      const info = classifyItem(`${title} ${summary}`, { hub: 'sf', source: 'Hugging Face Papers', category: 'research' });
      return {
        id: slugId('paper', p.id),
        title,
        summary: summary || 'Trending AI research paper featured on Hugging Face Daily Papers.',
        source: 'HF Daily Papers',
        sourceKind: 'paper',
        url,
        githubUrl,
        huggingfaceUrl: url,
        paperUrl: `https://arxiv.org/abs/${encodeURIComponent(p.id)}`,
        image,
        upvotes: Number(p.upvotes) || 0,
        publishedAt: safeIsoDate(entry.publishedAt || p.publishedAt, new Date().toISOString()),
        ...info,
        category: 'research',
        openWeights: Boolean(githubUrl) || info.openWeights,
      };
    });
}

function normalizeOpenRouterModels(payload) {
  const list = Array.isArray(payload?.data) ? payload.data : [];
  return list
    .filter((m) => m?.id && m?.name && !/:free$|:beta$|:batch$|:extended$/i.test(m.id) && Number(m.created) > 0)
    .sort((a, b) => Number(b.created) - Number(a.created))
    .slice(0, 10)
    .map((m) => {
      const id = String(m.id);
      const name = String(m.name);
      const publishedAt = new Date(Number(m.created) * 1000).toISOString();
      const ctx = m.context_length ? `${Math.round(Number(m.context_length) / 1000)}K context` : '';
      const rawDesc = stripHtml(m.description || '');
      const summary = truncate(rawDesc || `New frontier model ${name} launched live on OpenRouter${ctx ? ` (${ctx})` : ''}.`, 210);
      const info = classifyItem(`${id} ${name} ${summary}`, { hub: 'sf', source: 'OpenRouter Models', category: 'models', breaking: true });
      const url = `https://openrouter.ai/${encodeURI(id)}`;
      return {
        id: slugId('or', id),
        name: id,
        title: `New Model Launch: ${name}`,
        summary,
        source: 'OpenRouter Live Models',
        sourceKind: 'openrouter',
        url,
        githubUrl: null,
        huggingfaceUrl: m.hugging_face_id ? `https://huggingface.co/${encodeURI(m.hugging_face_id)}` : null,
        image: null,
        publishedAt,
        kind: 'openrouter',
        ...info,
        category: 'models',
        breaking: true,
      };
    });
}

function normalizeHnStories(payload) {
  const hits = Array.isArray(payload?.hits) ? payload.hits : [];
  return hits
    .filter((h) => h?.title && (h.url || h.objectID))
    .slice(0, 8)
    .map((h) => {
      const url = safeHttpUrl(h.url) || `https://news.ycombinator.com/item?id=${encodeURIComponent(h.objectID)}`;
      const title = stripHtml(h.title);
      const githubUrl = extractGitHubRepo(url) ? url : null;
      const huggingfaceUrl = /^https:\/\/(?:www\.)?huggingface\.co\//i.test(url) ? url : null;
      const info = classifyItem(`${title} ${url}`, { hub: 'sf', source: 'Hacker News' });
      return {
        id: slugId('hn', h.objectID || title),
        title,
        summary: `${Number(h.points) || 0} points · ${Number(h.num_comments) || 0} comments on Hacker News — high-signal community AI discussion.`,
        source: 'Hacker News AI',
        sourceKind: 'hn',
        url,
        githubUrl,
        huggingfaceUrl,
        image: githubUrl ? `https://opengraph.githubassets.com/1/${encodeURI(extractGitHubRepo(githubUrl))}` : null,
        publishedAt: safeIsoDate(h.created_at, new Date().toISOString()),
        points: Number(h.points) || 0,
        ...info,
      };
    });
}

// ---------- Live fetcher + aggregation ----------

async function fetchText(fetchImpl, url, timeoutMs = SOURCE_TIMEOUT_MS) {
  const res = await fetchImpl(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml, application/json, */*' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function fetchJson(fetchImpl, url, timeoutMs = SOURCE_TIMEOUT_MS) {
  const res = await fetchImpl(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function dedupeByKey(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export async function aggregateAiNews({ fetchImpl = globalThis.fetch, now = Date.now(), cfg = getConfig(), cacheOnlyPulse = false } = {}) {
  const sources = [];
  const tasks = [];

  // 1. @theAIsearch YouTube RSS
  tasks.push(
    fetchText(fetchImpl, AISEARCH_CHANNEL.feedUrl)
      .then((xml) => {
        const vids = parseYouTubeAiSearchFeed(xml);
        sources.push({ id: 'yt-aisearch', name: `${AISEARCH_CHANNEL.handle} (YouTube)`, status: vids.length ? 'live' : 'fallback', count: vids.length });
        return { kind: 'youtube', videos: vids };
      })
      .catch(() => {
        sources.push({ id: 'yt-aisearch', name: `${AISEARCH_CHANNEL.handle} (YouTube)`, status: 'fallback', count: FALLBACK_AISEARCH_VIDEOS.length });
        return { kind: 'youtube', videos: [] };
      })
  );

  // 2. Global AI RSS feeds
  for (const feed of NEWS_FEEDS) {
    tasks.push(
      fetchText(fetchImpl, feed.url)
        .then((xml) => {
          const items = parseRssOrAtom(xml, feed);
          sources.push({ id: feed.id, name: feed.name, status: items.length ? 'live' : 'empty', count: items.length });
          return { kind: 'rss', items };
        })
        .catch(() => {
          sources.push({ id: feed.id, name: feed.name, status: 'offline', count: 0 });
          return { kind: 'rss', items: [] };
        })
    );
  }

  // 3. Hugging Face Daily Papers
  tasks.push(
    fetchJson(fetchImpl, HF_PAPERS_URL)
      .then((data) => {
        const items = normalizeHfPapers(data);
        sources.push({ id: 'hf-papers', name: 'HF Daily Papers', status: items.length ? 'live' : 'empty', count: items.length });
        return { kind: 'papers', items };
      })
      .catch(() => {
        sources.push({ id: 'hf-papers', name: 'HF Daily Papers', status: 'offline', count: 0 });
        return { kind: 'papers', items: [] };
      })
  );

  // 4. Hugging Face Trending Models
  tasks.push(
    fetchJson(fetchImpl, HF_MODELS_URL)
      .then((data) => {
        const models = normalizeHfModels(data);
        sources.push({ id: 'hf-models', name: 'Hugging Face Models', status: models.length ? 'live' : 'empty', count: models.length });
        return { kind: 'hf-models', items: models };
      })
      .catch(() => {
        sources.push({ id: 'hf-models', name: 'Hugging Face Models', status: 'offline', count: 0 });
        return { kind: 'hf-models', items: [] };
      })
  );

  // 5. GitHub Frontier Open-Weight Orgs
  for (const orgMeta of GITHUB_ORGS) {
    tasks.push(
      fetchJson(fetchImpl, `https://api.github.com/orgs/${orgMeta.org}/repos?sort=pushed&per_page=${orgMeta.limit}`)
        .then((data) => {
          const repos = normalizeGitHubRepos(data, orgMeta);
          sources.push({ id: `gh-${orgMeta.org.toLowerCase()}`, name: `GitHub ${orgMeta.org}`, status: repos.length ? 'live' : 'fallback', count: repos.length });
          return { kind: 'github', items: repos };
        })
        .catch(() => {
          sources.push({ id: `gh-${orgMeta.org.toLowerCase()}`, name: `GitHub ${orgMeta.org}`, status: 'fallback', count: 0 });
          return { kind: 'github', items: [] };
        })
    );
  }

  // 6. OpenRouter Live Frontier Model Launches (zero-key minute-level launch radar)
  tasks.push(
    fetchJson(fetchImpl, OPENROUTER_MODELS_URL)
      .then((data) => {
        const models = normalizeOpenRouterModels(data);
        sources.push({ id: 'openrouter', name: 'OpenRouter Model Drops', status: models.length ? 'live' : 'empty', count: models.length });
        return { kind: 'openrouter', items: models };
      })
      .catch(() => {
        sources.push({ id: 'openrouter', name: 'OpenRouter Model Drops', status: 'offline', count: 0 });
        return { kind: 'openrouter', items: [] };
      })
  );

  // 7. Hacker News AI
  tasks.push(
    fetchJson(fetchImpl, HN_AI_URL)
      .then((data) => {
        const items = normalizeHnStories(data);
        sources.push({ id: 'hn-ai', name: 'Hacker News AI', status: items.length ? 'live' : 'empty', count: items.length });
        return { kind: 'hn', items };
      })
      .catch(() => {
        sources.push({ id: 'hn-ai', name: 'Hacker News AI', status: 'offline', count: 0 });
        return { kind: 'hn', items: [] };
      })
  );

  // 8. 30-Minute Shared Gemini Google-Search Web Pulse (catches X-first & breaking drops worldwide)
  tasks.push(
    getGeminiNewsPulse({ fetchImpl, cfg, now, classifyItem, cacheOnly: cacheOnlyPulse })
      .then((pulse) => {
        if (pulse.status !== 'off') {
          sources.push({
            id: 'gemini-pulse',
            name: 'Gemini Web Pulse (30m)',
            status: (pulse.status === 'live' || pulse.items.length > 0) ? 'live' : 'offline',
            count: pulse.items.length,
            ...(pulse.at ? { updatedAt: new Date(pulse.at).toISOString() } : {}),
          });
        }
        return { kind: 'pulse', pulse };
      })
      .catch(() => {
        if (cfg?.geminiKey && cfg?.ainewsPulse !== false) {
          sources.push({ id: 'gemini-pulse', name: 'Gemini Web Pulse (30m)', status: 'offline', count: 0 });
        }
        return { kind: 'pulse', pulse: { status: 'offline', items: [], at: 0, nextAt: 0, queryCount: 0 } };
      })
  );

  const settled = await Promise.all(tasks);

  let videos = [];
  const rssStories = [];
  const paperStories = [];
  const hnStories = [];
  const openRouterModels = [];
  const githubRepos = [];
  const hfModels = [];
  let pulseMeta = { status: 'off', items: [], at: 0, nextAt: 0, queryCount: 0 };

  for (const r of settled) {
    if (!r) continue;
    if (r.kind === 'youtube') videos.push(...r.videos);
    else if (r.kind === 'rss') rssStories.push(...r.items);
    else if (r.kind === 'papers') paperStories.push(...r.items);
    else if (r.kind === 'hn') hnStories.push(...r.items);
    else if (r.kind === 'openrouter') openRouterModels.push(...r.items);
    else if (r.kind === 'github') githubRepos.push(...r.items);
    else if (r.kind === 'hf-models') hfModels.push(...r.items);
    else if (r.kind === 'pulse' && r.pulse) pulseMeta = r.pulse;
  }
  const pulseStories = Array.isArray(pulseMeta.items) ? pulseMeta.items : [];

  if (!videos.length) {
    videos = FALLBACK_AISEARCH_VIDEOS.map((v) => ({
      ...v,
      isFallback: true,
      chapters: v.tools.map((t) => ({ label: t.name, sec: t.sec, clock: t.clock })),
      tools: v.tools.map((t) => ({
        id: slugId('tool', `${v.videoId}-${t.name}`),
        ...t,
        githubUrl: t.kind === 'github' ? t.url : null,
        huggingfaceUrl: t.kind === 'huggingface' ? t.url : null,
        videoId: v.videoId,
        videoTitle: v.title,
        videoUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(v.videoId)}&t=${t.sec}s`,
        thumbnail: v.thumbnail,
        publishedAt: v.publishedAt,
        regionLabel: REGION_LABEL[t.region] || 'Global',
        tags: [t.kind === 'github' ? 'GitHub' : t.kind === 'huggingface' ? 'Hugging Face' : 'AI Tool', REGION_LABEL[t.region] || 'Global'],
      })),
    }));
  }

  const aiSearchTools = dedupeByKey(
    videos.flatMap((v) => v.tools || []),
    (t) => t.url.toLowerCase()
  ).slice(0, 90);

  const pulseOpenWeights = pulseStories
    .filter((s) => s.githubUrl || s.huggingfaceUrl)
    .map((s) => ({
      ...s,
      name: extractGitHubRepo(s.githubUrl) || s.title,
      kind: s.githubUrl ? 'github' : 'huggingface',
    }));

  const openWeights = dedupeByKey(
    [...githubRepos, ...pulseOpenWeights, ...FALLBACK_OPEN_WEIGHTS, ...hfModels, ...openRouterModels.filter((m) => m.huggingfaceUrl)],
    (m) => (m.name || m.url || '').toLowerCase()
  )
    .sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0))
    .slice(0, 36);

  // Convert latest 4 @theAIsearch videos into playable video dispatch stories too
  const videoStories = videos.slice(0, 4).map((v) => ({
    id: `story-${v.id}`,
    title: v.title,
    summary: v.summary,
    source: `${AISEARCH_CHANNEL.handle} · YouTube`,
    sourceKind: 'video',
    category: 'videos',
    hub: 'sf',
    region: 'global',
    regionLabel: 'Global',
    lab: AISEARCH_CHANNEL.handle,
    url: v.url,
    videoId: v.videoId,
    videoUrl: v.url,
    toolCount: (v.tools || []).length,
    image: v.thumbnail,
    publishedAt: v.publishedAt,
    ...(v.isFallback ? { isFallback: true } : {}),
    openWeights: false,
    breaking: true,
    tags: ['@theAIsearch', `${(v.tools || []).length} AI Tools`, 'Video Briefing'],
  }));

  const rawStories = [
    ...SPOTLIGHT_STORIES,
    ...pulseStories,
    ...openRouterModels.slice(0, 6),
    ...videoStories,
    ...rssStories,
    ...paperStories,
    ...hnStories,
  ];

const DEDUPE_STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'over', 'after', 'about', 'more', 'its', 'new', 'news', 'says', 'amid', 'how', 'why', 'what', 'who', 'will', 'are', 'has', 'have', 'not']);

function storyTokens(title = '') {
  return [...new Set(
    normalizeMatchKey(title).split(' ').filter((w) => ((w.length >= 3) || (w.length >= 2 && /\d/.test(w))) && !DEDUPE_STOP.has(w)),
  )];
}

function dedupeStories(items) {
  const seenKeys = new Set();
  const kept = [];
  for (const item of items) {
    const key = normalizeMatchKey(item.title).slice(0, 48);
    if (!key || seenKeys.has(key)) continue;
    // Collapse multi-outlet duplicate RSS coverage (e.g. 5 Google News links for the same press release),
    // while never letting static spotlights suppress live pulse/RSS dispatches.
    if (item.sourceKind === 'rss') {
      const toks = storyTokens(item.title);
      if (toks.length >= 3) {
        const dup = kept.some((prev) => {
          if (prev.sourceKind === 'spotlight') return false;
          const pSet = new Set(prev._toks || []);
          if (!pSet.size) return false;
          let hit = 0;
          for (const t of toks) if (pSet.has(t)) hit += 1;
          return hit >= 3 && hit / Math.min(toks.length, pSet.size) >= 0.6;
        });
        if (dup) continue;
      }
      seenKeys.add(key);
      kept.push({ ...item, _toks: toks });
      continue;
    }
    seenKeys.add(key);
    kept.push({ ...item, _toks: storyTokens(item.title) });
  }
  return kept.map(({ _toks, ...rest }) => rest);
}

  const stories = dedupeStories(rawStories)
    .sort((a, b) => {
      // Keep fresh live items & curated spotlights nicely interleaved by recency, with spotlights elevated if within 72h
      const ta = Date.parse(a.publishedAt || 0) || 0;
      const tb = Date.parse(b.publishedAt || 0) || 0;
      return tb - ta;
    })
    .slice(0, 80);

  // Per-hub live summary for the interactive World Globe
  const hubs = WORLD_HUBS.map((hub) => {
    const hubStories = stories.filter((s) => s.hub === hub.id);
    const hubModels = openWeights.filter((m) => m.hub === hub.id);
    const hubTools = aiSearchTools.filter((t) => t.hub === hub.id);
    const lead = hubStories[0] || null;
    return {
      ...hub,
      storyCount: hubStories.length,
      modelCount: hubModels.length,
      toolCount: hubTools.length,
      totalSignals: hubStories.length + hubModels.length + hubTools.length,
      leadTitle: lead?.title || hub.tagline,
      leadId: lead?.id || null,
    };
  });

  const ticker = dedupeByKey(
    [
      ...pulseStories.slice(0, 4),
      ...SPOTLIGHT_STORIES.slice(0, 5),
      ...stories.filter((s) => s.sourceKind !== 'spotlight' && s.sourceKind !== 'pulse').slice(0, 8),
    ],
    (s) => normalizeMatchKey(s.title).slice(0, 48)
  ).slice(0, 14).map((s) => ({
    id: s.id,
    title: s.title,
    regionLabel: s.regionLabel,
    lab: s.lab,
    category: s.category,
  }));

  const liveSourceCount = sources.filter((s) => s.status === 'live').length;
  let telegramBot = botName(process.env.VITE_TELEGRAM_BOT);
  if (!telegramBot && cfg?.tgAiNews !== false) {
    try {
      const [{ tgToken }, { resolveBotUsername }] = await Promise.all([import('./tg-api.js'), import('./tg-ainews.js')]);
      const token = tgToken();
      if (token && fetchImpl === globalThis.fetch) telegramBot = await resolveBotUsername(token, process.env, now);
    } catch { /* optional */ }
  }

  return {
    ok: true,
    updatedAt: new Date(now).toISOString(),
    channel: AISEARCH_CHANNEL,
    ...(telegramBot ? { telegramBot } : {}),
    pulse: {
      enabled: Boolean(cfg?.geminiKey && cfg?.ainewsPulse !== false),
      status: pulseMeta.status,
      intervalMinutes: Math.round(PULSE_INTERVAL_MS / 60000),
      count: pulseStories.length,
      lastPulseAt: pulseMeta.at ? new Date(pulseMeta.at).toISOString() : null,
      nextPulseAt: pulseMeta.nextAt ? new Date(pulseMeta.nextAt).toISOString() : null,
      queryCount: pulseMeta.queryCount || 0,
    },
    stats: {
      totalStories: stories.length,
      openWeightsCount: openWeights.length,
      aiSearchToolsCount: aiSearchTools.length,
      videosCount: videos.length,
      activeHubs: hubs.filter((h) => h.totalSignals > 0).length,
      sourcesLive: liveSourceCount,
      sourcesTotal: sources.length,
    },
    hubs,
    ticker,
    stories,
    videos,
    aiSearchTools,
    openWeights,
    sources,
  };
}

// ---------- RSS 2.0 XML serializer (for user notifications in RSS readers, Slack, Discord) ----------

function escXml(s = '') {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildRssXml(data, site = 'https://agi1.app') {
  const base = String(site).replace(/\/+$/, '');
  const items = (data?.stories || []).slice(0, 40).map((s) => {
    const link = s.url || `${base}/ainews?story=${encodeURIComponent(s.id)}`;
    const pubDate = new Date(Date.parse(s.publishedAt || Date.now())).toUTCString();
    const extra = [
      s.summary,
      s.githubUrl ? `GitHub: ${s.githubUrl}` : '',
      s.huggingfaceUrl ? `Hugging Face: ${s.huggingfaceUrl}` : '',
      `Region: ${s.regionLabel || 'Global'} · Source: ${s.source || 'AGI AI News'}`,
    ].filter(Boolean).join(' — ');
    return `    <item>
      <title>${escXml(s.title)}</title>
      <link>${escXml(link)}</link>
      <guid isPermaLink="false">${escXml(`agi1-ainews:${s.id}`)}</guid>
      <pubDate>${escXml(pubDate)}</pubDate>
      <category>${escXml(s.category || 'ai')}</category>
      <description>${escXml(extra)}</description>
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AGI AI News World · Global Live AI Dispatches</title>
    <link>${escXml(`${base}/ainews`)}</link>
    <atom:link href="${escXml(`${base}/ainews/rss`)}" rel="self" type="application/rss+xml" />
    <description>Real-time global AI news, open-weight model drops (Qwen, Kimi, DeepSeek, Muse), frontier lab updates, and @theAIsearch AI tool links.</description>
    <language>en-us</language>
    <lastBuildDate>${escXml(new Date(Date.parse(data?.updatedAt || Date.now())).toUTCString())}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

// ---------- Cached HTTP handler ----------

let cached = null;
let inflight = null;
let lastAutoAlertCheckAt = 0;

export function _resetAiNewsCache() {
  cached = null;
  inflight = null;
  lastAutoAlertCheckAt = 0;
  _resetGeminiPulseCache();
}

// Fast zero-network read of the warm in-memory snapshot (used by AGI-1 chat recall).
export function peekAiNewsCache(now = Date.now(), maxAgeMs = 10 * 60_000) {
  return cached && now - cached.at < maxAgeMs ? cached.data : null;
}

export async function getAiNewsSnapshot(opts = {}) {
  const now = opts.now ?? Date.now();
  if (!opts.bypassCache && cached && now - cached.at < CACHE_TTL_MS) return cached.data;
  if (!opts.bypassCache && inflight) return inflight;
  const run = aggregateAiNews({ fetchImpl: opts.fetchImpl, now, cfg: opts.cfg, cacheOnlyPulse: Boolean(opts.cacheOnlyPulse) })
    .then(async (data) => {
      cached = { at: now, data };
      // When a fresh 30-min Gemini Web Pulse fires (or every 3m for fresh OpenRouter / @theAIsearch / breaking lab drops),
      // push brand-new models/breaking news to subscribed Telegram DM users & configured groups.
      // Awaited with a tight 3.5s budget so Vercel Serverless finishes delivering before freezing the container.
      const pulseLive = data?.pulse?.status === 'live';
      const periodicDue = now - lastAutoAlertCheckAt >= 3 * 60_000;
      if (!opts.skipTelegramBroadcast && (pulseLive || periodicDue)) {
        const cfg = opts.cfg || getConfig();
        if (cfg.tgAiNews !== false) {
          lastAutoAlertCheckAt = now;
          try {
            const [{ tgToken }, { broadcastBreakingAiNews, collectAlertCandidates }] = await Promise.all([
              import('./tg-api.js'),
              import('./tg-ainews.js'),
            ]);
            const token = tgToken();
            if (token) {
              const candidates = collectAlertCandidates(data, now);
              if (candidates.length) {
                let timer;
                await Promise.race([
                  broadcastBreakingAiNews({ cfg, token, items: candidates, now, fetchImpl: opts.fetchImpl, deadline: Date.now() + 3000 }),
                  new Promise((resolve) => { timer = setTimeout(resolve, 3500); }),
                ]).finally(() => clearTimeout(timer));
              }
            }
          } catch (err) {
            console.warn(`[ainews-tg] auto-alert push skipped: ${err?.message || err}`);
          }
        }
      }
      return data;
    })
    .finally(() => {
      if (inflight === run) inflight = null;
    });
  if (!opts.bypassCache) inflight = run;
  return run;
}

export async function handleAiNewsRequest(request, opts = {}) {
  const url = new URL(request?.url || 'https://agi1.app/api/ainews');
  const format = (url.searchParams.get('format') || 'json').toLowerCase();
  const bypassCache = url.searchParams.get('fresh') === '1';

  if (request?.method && request.method !== 'GET' && request.method !== 'HEAD') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405, headers: { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' } });
  }

  try {
    const data = await getAiNewsSnapshot({ ...opts, bypassCache });
    if (format === 'rss' || format === 'xml') {
      const xml = buildRssXml(data);
      return new Response(xml, {
        status: 200,
        headers: {
          'Content-Type': 'application/rss+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=60, s-maxage=120, stale-while-revalidate=300',
        },
      });
    }
    return Response.json(data, {
      status: 200,
      headers: {
        'Cache-Control': bypassCache
          ? 'no-store'
          : 'public, max-age=60, s-maxage=120, stale-while-revalidate=300',
      },
    });
  } catch (err) {
    console.error('[ainews] aggregation failed:', err?.message || err);
    return Response.json(
      { error: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
