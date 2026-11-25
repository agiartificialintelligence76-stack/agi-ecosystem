// AI News World (agi1.app/ainews) verification suite:
// parsers (RSS/Atom, @theAIsearch YouTube videos + timestamped AI tools & GitHub extraction),
// geo-hub classification, RSS 2.0 generation, alert watchlist matching, API multiplexing inside
// the 12-function cap, page security/CSP rules, and bespoke visual asset checks.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import {
  decodeEntities,
  stripHtml,
  safeHttpUrl,
  safeImageUrl,
  extractGitHubRepo,
  classifyItem,
  parseRssOrAtom,
  parseChapters,
  extractAiSearchTools,
  parseYouTubeAiSearchFeed,
  aggregateAiNews,
  buildRssXml,
  handleAiNewsRequest,
  _resetAiNewsCache,
} from '../server/ainews.js';
import {
  PULSE_INTERVAL_MS,
  PULSE_BACKOFF_MS,
  PULSE_SCHEMA_VERSION,
  MAX_PULSE_BYTES,
  extractJsonArray,
  parsePulseResponse,
  verifyPulseItems,
  urlMatchesStory,
  compactPulseRecord,
  getGeminiNewsPulse,
  _resetGeminiPulseCache,
} from '../server/ainews-pulse.js';
import { getConfig } from '../server/config.js';
import {
  ainewsOn,
  aiNewsPostsOn,
  parseAiNewsArg,
  formatAiNewsView,
  formatBreakingBroadcast,
  collectAlertCandidates,
  similarHeadline,
  resolveGroupTargets,
  subscribeAiNewsDm,
  unsubscribeAiNewsDm,
  isAiNewsDmSubscribed,
  onAiNewsCommand,
  onAiNewsTap,
  broadcastBreakingAiNews,
  tickTelegramAiNews,
  forgetTgAiNews,
} from '../server/tg-ainews.js';
import { handleUpdate, commandsFor } from '../server/telegram.js';
import { forgetGroups, groupCommandsFor } from '../server/tg-groups.js';
import { asksAboutAiNews, recallAiNews } from '../server/ainews-recall.js';
import { aiNewsPrompt } from '../server/agi1-prompt.js';
import { cleanReply } from '../server/gemini.js';
import { AISEARCH_CHANNEL, WORLD_HUBS, SPOTLIGHT_STORIES } from '../server/ainews-seed.js';
import { GET as healthApi } from '../api/health.js';
import { BUILTIN_PAGES } from '../src/owner/catalog.js';
import {
  sanitizePrefs,
  matchesAlertPrefs,
  findNewMatchingAlerts,
  DEFAULT_ALERT_PREFS,
} from '../src/ainews/alerts.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

beforeEach(() => {
  _resetAiNewsCache();
});

test('URL, image, entity, and GitHub repo helpers reject executable or spoofed inputs', () => {
  assert.equal(decodeEntities('Qwen &amp; Kimi &#8217;26 &#x2764;'), 'Qwen & Kimi ’26 ❤');
  assert.equal(stripHtml('<![CDATA[<p>Hello <b>AGI</b> <script>alert(1)</script></p>]]>'), 'Hello AGI');
  assert.equal(safeHttpUrl('javascript:alert(1)'), null);
  assert.equal(safeHttpUrl('data:text/html,hi'), null);
  assert.equal(safeHttpUrl('https://user:pass@example.com/a'), null);
  assert.equal(safeHttpUrl('http://github.com/MoonshotAI/Kimi-K3'), 'https://github.com/MoonshotAI/Kimi-K3');
  assert.equal(safeHttpUrl('byteplus.com/en/contact-us/seedream5-5'), 'https://byteplus.com/en/contact-us/seedream5-5');
  assert.equal(safeImageUrl('/images/ainews/kimi-k3.webp'), '/images/ainews/kimi-k3.webp');
  assert.equal(safeImageUrl('/images/ainews/../../etc/passwd'), null);
  assert.equal(safeImageUrl('https://techcrunch.com/wp-content/uploads/2015/02/cropped-favicon-gradient.png'), null);
  assert.equal(safeImageUrl('https://the-decoder.com/wp-content/uploads/2026/11/hero.jpg'), 'https://the-decoder.com/wp-content/uploads/2026/11/hero.jpg');
  assert.equal(extractGitHubRepo('https://github.com/MoonshotAI/Kimi-K3/tree/main'), 'MoonshotAI/Kimi-K3');
  assert.equal(extractGitHubRepo('https://github.com/topics/ai'), null);
});

test('entity classifier maps Qwen, Kimi, Anthropic IPO, Sam Altman AGI, Meta Muse & DeepMind to the right global hubs', () => {
  const qwen = classifyItem('Alibaba Qwen3.8 open weights released in Hangzhou');
  assert.equal(qwen.hub, 'hangzhou');
  assert.equal(qwen.region, 'china');
  assert.equal(qwen.openWeights, true);

  const kimi = classifyItem('Moonshot AI open-weights Kimi K3.1 Pro on github.com/MoonshotAI/Kimi-K3');
  assert.equal(kimi.hub, 'beijing');
  assert.equal(kimi.region, 'china');
  assert.equal(kimi.openWeights, true);

  const ant = classifyItem('Anthropic IPO prices at $83 on Nasdaq under ticker ANT');
  assert.equal(ant.hub, 'nyc');
  assert.equal(ant.region, 'americas');
  assert.equal(ant.category, 'markets');

  const sam = classifyItem('Sam Altman discusses OpenAI AGI timeline and GPT-6.2 Astra');
  assert.equal(sam.hub, 'sf');
  assert.equal(sam.region, 'americas');

  const muse = classifyItem('Meta launches Muse Ember alongside Muse Wonder agent harness');
  assert.equal(muse.hub, 'sf');
  assert.equal(muse.lab, 'Meta Muse');

  const glm = classifyItem('Z.ai rolls out GLM-5.4 with new vision and coding capabilities');
  assert.equal(glm.hub, 'beijing');
  assert.equal(glm.region, 'china');
  assert.equal(glm.lab, 'Z.ai GLM');

  const grok = classifyItem('xAI unveils Grok 4.5 with faster reasoning and coding benchmarks');
  assert.equal(grok.hub, 'sf');
  assert.equal(grok.lab, 'xAI Grok');
  assert.equal(grok.breaking, true);
  assert.ok(grok.tags.includes('xAI Grok'));

  const tesla = classifyItem('Tesla Optimus Gen 3 humanoid and Tesla FSD v15 Robotaxi update rolls out');
  assert.equal(tesla.hub, 'sf');
  assert.equal(tesla.lab, 'Tesla AI');
  assert.equal(tesla.breaking, true);
  assert.ok(tesla.tags.includes('Tesla AI'));
  assert.ok(tesla.tags.includes('Robotics'));

  const dm = classifyItem('Google DeepMind unveils Genie 4 and AlphaGenome 2');
  assert.equal(dm.hub, 'london');
  assert.equal(dm.region, 'europe');
});

test('@theAIsearch YouTube Atom parser extracts chapters, AI tools, GitHub repos, and timestamps while skipping sponsors & gear', () => {
  const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <yt:videoId>TESTVID1234</yt:videoId>
    <title>New Open Weights, Depth Pro 2 &amp; MovieRoll: AI NEWS</title>
    <published>2026-11-22T03:30:59+00:00</published>
    <media:group>
      <media:thumbnail url="https://i3.ytimg.com/vi/TESTVID1234/hqdefault.jpg" width="480" height="360"/>
      <media:description>HUGE AI NEWS this week. Thanks to our sponsor Luma. Try it for free https://lumalabs.ai/aisearch-nov

#ai #ainews

00:00 AI news intro
01:05 Depth Pro 2
04:10 WeMM-Video
06:25 Bria RMBG 3.0
08:00 Muse Ember

LINKS
Depth Pro 2 https://apple-aiml-research.github.io/ml-depth-pro-2/
WeMM-Video https://github.com/Tencent/WeMM-Video
Bria RMBG 3.0 https://huggingface.co/briaai/RMBG-3.0
Muse Ember https://dev.meta.ai/models/muse-ember

See my X for more AI updates: https://x.com/aisearchio
Newsletter: https://aisearch.substack.com/
Here's my equipment:
Mic: Shure SM7B https://amzn.to/3DErjt1
</media:description>
    </media:group>
  </entry>
</feed>`;

  const chapters = parseChapters('00:00 AI news intro\n01:05 Depth Pro 2\n01:02:03 Deep Dive');
  assert.deepEqual(chapters, [
    { label: 'Depth Pro 2', sec: 65, clock: '01:05' },
    { label: 'Deep Dive', sec: 3723, clock: '1:02:03' },
  ]);

  const videos = parseYouTubeAiSearchFeed(sampleXml);
  assert.equal(videos.length, 1);
  assert.equal(videos[0].videoId, 'TESTVID1234');
  assert.equal(videos[0].tools.length, 4, 'exactly 4 real tools extracted; sponsor, social, and gear links excluded');

  const byName = Object.fromEntries(videos[0].tools.map((t) => [t.name, t]));
  assert.equal(byName['Depth Pro 2'].kind, 'project');
  assert.equal(byName['Depth Pro 2'].sec, 65);
  assert.equal(byName['Depth Pro 2'].clock, '01:05');

  assert.equal(byName['WeMM-Video'].kind, 'github');
  assert.equal(byName['WeMM-Video'].repo, 'Tencent/WeMM-Video');
  assert.equal(byName['WeMM-Video'].sec, 250);
  assert.equal(byName['WeMM-Video'].hub, 'beijing');
  assert.equal(byName['WeMM-Video'].region, 'china');

  assert.equal(byName['Bria RMBG 3.0'].kind, 'huggingface');
  assert.equal(byName['Bria RMBG 3.0'].sec, 385);

  assert.equal(byName['Muse Ember'].kind, 'launch');
  assert.equal(byName['Muse Ember'].sec, 480);

  const emptyTools = extractAiSearchTools('Thanks to our sponsor https://higgsfield.ai/s/theaisearch-abc', { videoId: 'X' });
  assert.equal(emptyTools.tools.length, 0);
});

test('RSS & Atom parser extracts cover images, links, and sanitized text', () => {
  const rss = `<?xml version="1.0"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <item>
      <title>Qwen3.8 ships open weights &amp; Qwen Code</title>
      <link>https://the-decoder.com/qwen-3-8-release/</link>
      <pubDate>Sun, 22 Nov 2026 12:00:00 GMT</pubDate>
      <media:content url="https://the-decoder.com/wp-content/uploads/2026/11/qwen.jpg" type="image/jpeg" />
      <description><![CDATA[<p>Alibaba published weights and <a href="https://github.com/QwenLM/qwen-code">repo</a>.</p>]]></description>
    </item>
  </channel>
</rss>`;
  const parsed = parseRssOrAtom(rss, { id: 'decoder', name: 'The Decoder' });
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].title, 'Qwen3.8 ships open weights & Qwen Code');
  assert.equal(parsed[0].image, 'https://the-decoder.com/wp-content/uploads/2026/11/qwen.jpg');
  assert.equal(parsed[0].githubUrl, 'https://github.com/QwenLM/qwen-code');
  assert.equal(parsed[0].hub, 'hangzhou');

  // Google News aggregator extracts true <source> publisher, strips trailing " - Publisher",
  // never mislabels non-Google stories as "Google AI", and drops non-AI stock-market spillover.
  const gnews = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title>California AG Bonta filed lawsuit against OpenAI over model security - Reuters</title>
    <link>https://news.google.com/rss/articles/ABC</link>
    <pubDate>Mon, 23 Nov 2026 04:26:00 GMT</pubDate>
    <source url="https://www.reuters.com">Reuters</source>
    <description>California AG Bonta filed lawsuit against OpenAI over model security Reuters</description>
  </item>
  <item>
    <title>Thinking Machines unveils 26.4B open-weights coding model - Tech Times</title>
    <link>https://news.google.com/rss/articles/DEF</link>
    <pubDate>Mon, 23 Nov 2026 05:00:00 GMT</pubDate>
    <source url="https://www.techtimes.com">Tech Times</source>
    <description>New open-weights release.</description>
  </item>
  <item>
    <title>Dow Jones Futures Jump As Oracle Tries To Ease Market Fears - Investor's Business Daily</title>
    <link>https://news.google.com/rss/articles/GHI</link>
    <pubDate>Mon, 23 Nov 2026 04:15:00 GMT</pubDate>
    <source url="https://www.investors.com">Investor's Business Daily</source>
    <description>Stock market futures update.</description>
  </item>
  <item>
    <title>The Gemini Supermoon Brings Major Plot Twists for Every Zodiac Sign - Grazia</title>
    <link>https://news.google.com/rss/articles/JKL</link>
    <pubDate>Mon, 23 Nov 2026 04:10:00 GMT</pubDate>
    <source url="https://graziamagazine.com">Grazia</source>
    <description>Astrology forecast for late November.</description>
  </item>
</channel></rss>`;
  const gParsed = parseRssOrAtom(gnews, { id: 'gnews-global-ai', name: 'Google News AI', defaultHub: 'sf', isAggregator: true });
  assert.equal(gParsed.length, 2, 'drops non-AI Dow Jones and astrology Gemini spillover');
  assert.equal(gParsed[0].title, 'California AG Bonta filed lawsuit against OpenAI over model security');
  assert.equal(gParsed[0].source, 'Reuters');
  assert.equal(gParsed[0].lab, 'OpenAI');
  assert.equal(gParsed[1].source, 'Tech Times');
  assert.notEqual(gParsed[1].lab, 'Google AI', 'aggregator name "Google News AI" must never mislabel articles as Google AI');
});

test('aggregator and API handler degrade gracefully offline, serve JSON + valid RSS 2.0 XML, and preserve /api/health', async () => {
  const offlineFetch = async () => { throw new Error('offline'); };
  const offlineCfg = getConfig({});
  const data = await aggregateAiNews({ fetchImpl: offlineFetch, now: Date.parse('2026-11-23T00:00:00Z'), cfg: offlineCfg });

  assert.equal(data.ok, true);
  assert.equal(data.channel.channelId, AISEARCH_CHANNEL.channelId);
  assert.equal(data.hubs.length, WORLD_HUBS.length);
  assert.ok(data.stories.length >= SPOTLIGHT_STORIES.length);
  assert.ok(data.videos.length >= 2, 'fallback @theAIsearch videos kept when offline');
  assert.ok(data.aiSearchTools.length >= 10, 'fallback @theAIsearch tools kept when offline');
  assert.ok(data.openWeights.some((m) => m.githubUrl?.includes('MoonshotAI/Kimi-K3')));
  assert.ok(data.openWeights.some((m) => m.githubUrl?.includes('QwenLM/qwen-code')));

  const rssXml = buildRssXml(data);
  assert.match(rssXml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(rssXml, /<rss version="2\.0"/);
  assert.match(rssXml, /Moonshot AI Open-Weights Kimi K3/);

  const resJson = await handleAiNewsRequest(new Request('https://agi1.app/api/ainews'), { fetchImpl: offlineFetch, cfg: offlineCfg });
  assert.equal(resJson.status, 200);
  assert.match(resJson.headers.get('content-type') || '', /application\/json/);

  const resRss = await handleAiNewsRequest(new Request('https://agi1.app/api/ainews?format=rss'), { fetchImpl: offlineFetch, cfg: offlineCfg });
  assert.equal(resRss.status, 200);
  assert.match(resRss.headers.get('content-type') || '', /application\/rss\+xml/);

  const resPost = await handleAiNewsRequest(new Request('https://agi1.app/api/ainews', { method: 'POST' }), { fetchImpl: offlineFetch, cfg: offlineCfg });
  assert.equal(resPost.status, 405);

  // Plain /api/health stays untouched and fast
  const healthRes = await healthApi(new Request('https://agi1.app/api/health'));
  assert.equal(healthRes.status, 200);
  const healthBody = await healthRes.json();
  assert.equal(healthBody.ok, true);
});

test('notification watchlist matches keywords and channels accurately and deduplicates seen items', () => {
  const prefs = sanitizePrefs({
    ...DEFAULT_ALERT_PREFS,
    enabled: true,
    channels: { breaking: false, models: false, aisearch: true, markets: false },
    keywords: ['Kimi', 'Anthropic', 'Kimi'],
    intervalMin: 15,
  });
  assert.deepEqual(prefs.keywords, ['Kimi', 'Anthropic']);
  assert.equal(prefs.intervalMin, 15);

  const items = [
    { id: '1', title: 'Moonshot releases Kimi K3.1 Pro weights', category: 'models' },
    { id: '2', title: 'Unrelated local blog post', category: 'research' },
    { id: '3', title: 'New AI Tools roundup', sourceKind: 'video', channel: '@theAIsearch' },
    { id: '4', title: 'Anthropic IPO opens on Nasdaq', category: 'markets' },
  ];
  assert.equal(matchesAlertPrefs(items[0], prefs), true, 'keyword match');
  assert.equal(matchesAlertPrefs(items[1], prefs), false, 'non-matching item skipped');
  assert.equal(matchesAlertPrefs(items[2], prefs), true, '@theAIsearch channel match');

  const seen = new Set(['1']);
  const unseen = findNewMatchingAlerts(items, seen, prefs);
  assert.deepEqual(unseen.map((i) => i.id), ['3', '4']);
});

test('ainews.html, CSP, routing, assets, and 12-function cap stay intact', () => {
  const html = read('ainews.html');
  assert.match(html, /<html lang="en" data-page="ainews">/);
  assert.match(html, /<script src="\/theme\.js\?v=8"><\/script>/);
  assert.match(html, /<script type="module" src="\/src\/ainews\/page\.js"><\/script>/);
  assert.match(html, /og:image" content="__SITE__\/cards\/ainews\.jpg"/);
  assert.match(html, /rel="alternate" type="application\/rss\+xml".*href="\/ainews\/rss"/);
  assert.match(html, /href="https:\/\/t\.me\/agi1_appbot\?start=ainews"[^>]*data-an-tg-bot/);
  assert.ok(!/<script>|style="/.test(html), 'no inline scripts or inline styles (CSP)');

  // Exactly 12 serverless functions in api/
  assert.equal(readdirSync(new URL('../api/', import.meta.url)).filter((f) => f.endsWith('.js')).length, 12);

  // Bespoke visual plates & OG share card exist
  assert.ok(existsSync(new URL('../public/cards/ainews.jpg', import.meta.url)));
  for (const img of ['qwen-china.webp', 'kimi-k3.webp', 'anthropic-ipo.webp', 'altman-agi.webp', 'meta-muse.webp', 'deepmind-world.webp']) {
    assert.ok(existsSync(new URL(`../public/images/ainews/${img}`, import.meta.url)), `public/images/ainews/${img} exists`);
  }

  // Vercel rewrites + dedicated /ainews CSP rule with YouTube embed & frame-ancestors 'self'
  const vercel = JSON.parse(read('vercel.json'));
  assert.ok(!vercel.rewrites.some((r) => /api/.test(r.source)), 'never rewrites over /api functions');
  assert.ok(vercel.rewrites.some((r) => r.source === '/ainews/rss' && r.destination === '/api/health?ainews=1&format=rss'));
  const rule = vercel.headers.find((h) => h.source === '/(ainews/?|ainews\\.html)');
  assert.ok(rule, 'dedicated /ainews CSP rule exists');
  const csp = rule.headers.find((h) => h.key === 'Content-Security-Policy')?.value || '';
  assert.match(csp, /frame-ancestors 'self'/);
  assert.match(csp, /frame-src 'self' https:\/\/challenges\.cloudflare\.com https:\/\/www\.youtube-nocookie\.com/);
  assert.match(csp, /img-src 'self' data: blob: https:/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval|wasm-unsafe-eval/);

  // Catalog + navigation wired
  assert.ok(BUILTIN_PAGES.some((p) => p.path === '/ainews'));
  assert.ok(read('index.html').includes('href="/ainews"'));
});

test('AI News stays available in every built page with the shared header and footer navigation', async () => {
  const { default: config } = await import('../vite.config.js');
  const failures = [];
  const checked = [];
  const attribute = (attributes, name) => new RegExp(`(?:^|\\s)${name}=(['"])(.*?)\\1`, 'i').exec(attributes)?.[2];
  for (const file of new Set(Object.values(config.build.rollupOptions.input))) {
    if (!file.endsWith('.html')) continue;
    const navs = [...read(file).matchAll(/<nav\b([^>]*)>([\s\S]*?)<\/nav>/gi)];
    const header = navs.filter((nav) => attribute(nav[1], 'id') === 'site-nav');
    if (!header.length) continue;
    checked.push(file);
    const footer = navs.filter((nav) => (attribute(nav[1], 'class') || '').split(/\s+/).includes('foot-nav'));
    for (const [label, groups] of [['header', header], ['footer', footer]]) {
      if (groups.length !== 1) { failures.push(`${file}: expected one shared ${label}`); continue; }
      const links = [...groups[0][2].matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
        .filter((link) => attribute(link[1], 'href') === '/ainews');
      if (links.length !== 1) { failures.push(`${file}: ${label} has ${links.length} AI News links, expected one`); continue; }
      const attrs = links[0][1];
      const classes = (attribute(attrs, 'class') || '').split(/\s+/);
      if (classes.includes('nav-phone') || classes.includes('hidden') || /(?:^|\s)hidden(?:\s|=|$)/i.test(attrs) || attribute(attrs, 'aria-hidden') === 'true') {
        failures.push(`${file}: ${label} AI News link must remain available in desktop and phone navigation`);
      }
      if (file === 'ainews.html' && attribute(attrs, 'aria-current') !== 'page') {
        failures.push(`${file}: ${label} must identify AI News as the current page`);
      }
    }
  }
  for (const file of ['index.html', 'diary.html', 'memes.html', 'pfp.html', 'ainews.html', 'games.html', 'roadmap.html']) {
    assert.ok(checked.includes(file), `${file} uses the shared navigation under test`);
  }
  assert.deepEqual(failures, [], failures.join('\n'));
});

test('Gemini web pulse parses grounded JSON safely, resolves grounding chunks, filters stale/unsafe URLs, and stays within Supabase size cap', async () => {
  const now = Date.parse('2026-11-23T06:00:00Z');
  assert.deepEqual(extractJsonArray('```json\n[{"title":"Hello"}]\n```'), [{ title: 'Hello' }]);
  assert.deepEqual(extractJsonArray('not json'), []);

  const payload = {
    candidates: [{
      content: {
        parts: [
          { thought: true, text: 'internal reasoning' },
          {
            text: '```json\n' + JSON.stringify([
              {
                title: 'Z.ai launches GLM-5.4 with vision and 50% more coding quota',
                summary: 'Z.ai rolled out GLM-5.4 across all GLM Coding Plan tiers with upgraded vision and coding.',
                url: 'https://github.com/zai-org/GLM-5',
                githubUrl: 'https://github.com/zai-org/GLM-5',
                lab: 'Z.ai GLM',
                source: 'github.com',
                publishedAt: '2026-11-23T04:18:00Z',
              },
              {
                title: 'OpenAI previews new agentic reasoning milestone',
                summary: 'Sam Altman confirms major step forward on long-horizon coding benchmarks.',
                url: null,
                lab: 'OpenAI',
                source: 'techcrunch.com',
                publishedAt: '2026-11-23T03:00:00Z',
              },
              {
                title: 'Spoofed unsafe protocol story should be skipped',
                summary: 'Should not survive sanitization.',
                url: 'javascript:alert(1)',
                source: 'evil.invalid',
                publishedAt: '2026-11-23T03:00:00Z',
              },
              {
                title: 'Ancient story from two months ago should be dropped',
                summary: 'Old news from September.',
                url: 'https://github.com/zai-org/old',
                source: 'github.com',
                publishedAt: '2026-09-01T00:00:00Z',
              },
            ]) + '\n```',
          },
        ],
      },
      groundingMetadata: {
        webSearchQueries: ['breaking AI model releases November 23 2026', 'China AI model launch GLM Qwen Kimi'],
        groundingChunks: [
          { web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AAA', title: 'github.com' } },
          { web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/BBB', title: 'techcrunch.com' } },
        ],
      },
    }],
  };

  const parsed = parsePulseResponse(payload, { now });
  assert.equal(parsed.queryCount, 2);
  assert.equal(parsed.items.length, 2, 'drops unsafe and >14d stale stories');
  assert.equal(parsed.items[0].u, 'https://github.com/zai-org/GLM-5', 'keeps grounded canonical GitHub URL');
  assert.equal(parsed.items[0].g, 'https://github.com/zai-org/GLM-5');
  assert.equal(parsed.items[1].u, 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/BBB', 'falls back to verified grounding chunk URL');

  // verifyPulseItems unwraps grounding redirects via 302 Location, rejects mismatched articles, and aligns publisher names
  assert.equal(urlMatchesStory('https://emergent.sh/news/asia-stocks-slide-ai-rout-deepens', { t: 'Sarvam AI Unveils 105B Parameter Model', l: 'Sarvam AI' }), false);
  assert.equal(urlMatchesStory('https://english.cw.com.tw/article/article.action?id=5144', { t: 'Anthropic Claude Helps Prove Riemann Hypothesis', l: 'Anthropic' }), false);
  assert.equal(urlMatchesStory('https://openai.com/index/perplexity-and-intelligence/', { t: 'OpenAI Chief Scientist Proposes Pretraining Ceiling', l: 'OpenAI' }), true);
  assert.equal(urlMatchesStory('https://futurumgroup.com/insights/together-ai-brings-qwen4-max-to-serverless/', { t: 'Together AI Adds Alibaba Qwen4 Max', l: 'Alibaba' }), true);

  const verified = await verifyPulseItems([
    { id: 'p1', t: 'Sarvam AI Unveils 105B Parameter Model', l: 'Sarvam AI', p: 'Emergent', u: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/BAD1', d: new Date(now).toISOString() },
    { id: 'p2', t: 'OpenAI Chief Scientist Proposes Perplexity Ceiling', l: 'OpenAI', p: 'WrongBlog', u: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/GOOD1', d: new Date(now).toISOString() },
  ], {
    fetchImpl: async (u) => new Response(null, {
      status: 302,
      headers: {
        location: String(u).endsWith('BAD1')
          ? 'https://emergent.sh/news/asia-stocks-slide-ai-rout-deepens'
          : 'https://openai.com/index/perplexity-and-intelligence/',
      },
    }),
  });
  assert.equal(verified.length, 1, 'drops mismatched grounding redirect');
  assert.equal(verified[0].u, 'https://openai.com/index/perplexity-and-intelligence/', 'unwraps to canonical URL');
  assert.equal(verified[0].p, 'OpenAI', 'aligns displayed publisher to verified host');

  // Oversized pulse record is strictly trimmed to <= MAX_PULSE_BYTES (safely below agi1_feed_state 20KB cap)
  const huge = compactPulseRecord({
    at: now,
    items: Array.from({ length: 8 }, (_, i) => ({
      id: `pulse-item-${i}`,
      t: `Breaking AI announcement number ${i} `.repeat(4),
      s: `Detailed summary text `.repeat(15),
      u: `https://vertexaisearch.cloud.google.com/grounding-api-redirect/${'x'.repeat(350)}-${i}`,
      g: `https://github.com/zai-org/model-${i}`,
      h: `https://huggingface.co/zai-org/model-${i}`,
      l: 'Z.ai GLM',
      p: 'techcrunch.com',
      d: new Date(now).toISOString(),
    })),
  });
  assert.ok(Buffer.byteLength(JSON.stringify(huge), 'utf8') <= MAX_PULSE_BYTES);
});

test('30-minute Gemini web pulse enforces shared Supabase cooldown, preserves /api/feed state, handles leases & errors, and respects AINEWS_PULSE=off', async () => {
  assert.equal(getConfig({}).ainewsPulse, true);
  assert.equal(getConfig({ AINEWS_PULSE: 'off' }).ainewsPulse, false);
  assert.equal(getConfig({ AINEWS_PULSE: '0' }).ainewsPulse, false);

  const FAKE_KEY = 'AIzaSyTEST_FAKE_PULSE_KEY_0000000000000';
  const baseCfg = {
    geminiKey: FAKE_KEY,
    geminiModel: 'gemini-3.1-flash-lite',
    supabaseUrl: 'https://proj.supabase.co',
    supabaseKey: 'sb_secret_test',
    ainewsPulse: true,
  };

  // Shared Supabase state already populated by /api/feed (must NEVER be clobbered!)
  let dbState = { since: 1795400000000, market: { step: 4, high: 900000 }, diary: '2026-11-23' };
  let geminiCalls = 0;
  let geminiShouldFail = false;
  let geminiTitle = 'Z.ai unveils GLM-5.4 coding & vision upgrade';
  let geminiUrl = 'https://z.ai/blog/glm-5-4';
  let geminiHost = 'z.ai';

  const mockFetch = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('/rest/v1/rpc/feed_state_get')) {
      assert.equal(init.headers?.apikey, 'sb_secret_test');
      assert.equal(init.headers?.Authorization, undefined, 'Supabase secret key never goes in Authorization');
      return Response.json(structuredClone(dbState));
    }
    if (u.includes('/rest/v1/rpc/feed_state_put')) {
      const body = JSON.parse(init.body);
      assert.ok(Buffer.byteLength(JSON.stringify(body.p_state), 'utf8') < 20000, 'fits inside agi1_feed_state 20KB cap');
      dbState = structuredClone(body.p_state);
      return Response.json(true);
    }
    if (u.includes('generativelanguage.googleapis.com')) {
      geminiCalls += 1;
      assert.ok(!u.includes(FAKE_KEY), 'GEMINI_API_KEY sent in header, never in URL');
      assert.equal(init.headers?.['x-goog-api-key'], FAKE_KEY);
      const reqBody = JSON.parse(init.body);
      assert.deepEqual(reqBody.tools, [{ google_search: {} }]);
      assert.equal(reqBody.generationConfig?.thinkingConfig?.thinkingLevel, 'LOW');
      if (geminiShouldFail) {
        return Response.json({ error: { message: `Quota exceeded for ${FAKE_KEY}` } }, { status: 429 });
      }
      return Response.json({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify([{
                title: geminiTitle,
                summary: 'New vision capabilities and 50% higher weekly coding quotas live for GLM Coding Plan users.',
                url: geminiUrl,
                lab: 'Z.ai GLM',
                source: geminiHost,
                publishedAt: '2026-11-23T04:18:00Z',
              }]),
            }],
          },
          groundingMetadata: {
            webSearchQueries: ['GLM-5.4 Z.ai release'],
            groundingChunks: [{ web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/GLM', title: geminiHost } }],
          },
        }],
      });
    }
    throw new Error('offline upstream');
  };

  // Disabled config makes 0 calls
  const offRes = await getGeminiNewsPulse({ fetchImpl: mockFetch, cfg: { ...baseCfg, ainewsPulse: false }, now: 1000, classifyItem });
  assert.equal(offRes.status, 'off');
  assert.equal(geminiCalls, 0);

  const T0 = Date.parse('2026-11-23T06:00:00Z');

  // 1. Cold start: fires Gemini once, saves to Supabase, preserves /api/feed keys, merges into aggregateAiNews
  const snap1 = await aggregateAiNews({ fetchImpl: mockFetch, now: T0, cfg: baseCfg });
  assert.equal(geminiCalls, 1);
  assert.equal(snap1.pulse.enabled, true);
  assert.equal(snap1.pulse.status, 'live');
  assert.equal(snap1.pulse.intervalMinutes, 30);
  assert.equal(snap1.pulse.count, 1);
  assert.ok(snap1.stories.some((s) => s.sourceKind === 'pulse' && s.title.includes('GLM-5.4') && s.hub === 'beijing'));
  assert.ok(snap1.sources.some((s) => s.id === 'gemini-pulse' && s.status === 'live' && s.count === 1));
  assert.equal(dbState.since, 1795400000000, 'preserves /api/feed since');
  assert.deepEqual(dbState.market, { step: 4, high: 900000 }, 'preserves /api/feed market');
  assert.equal(dbState.diary, '2026-11-23', 'preserves /api/feed diary');

  // 2. Different cold container 10 min later + manual ?fresh=1 sync: reads Supabase cache, 0 Gemini calls!
  _resetAiNewsCache();
  const resFresh = await handleAiNewsRequest(new Request('https://agi1.app/api/health?ainews=1&fresh=1'), {
    fetchImpl: mockFetch,
    now: T0 + 10 * 60 * 1000,
    cfg: baseCfg,
  });
  assert.equal(resFresh.status, 200);
  const bodyFresh = await resFresh.json();
  assert.equal(geminiCalls, 1, 'manual ?fresh=1 must never bypass 30-min Gemini cooldown');
  assert.equal(bodyFresh.pulse.status, 'cached');
  assert.equal(bodyFresh.pulse.count, 1);

  // 3. Concurrent container when another container holds an active 45s lease: 0 duplicate Gemini calls!
  _resetGeminiPulseCache();
  dbState.ainewsPulse.at = T0 - PULSE_INTERVAL_MS - 5000;
  dbState.ainewsPulse.claimedAt = T0 + 10_000;
  const leased = await getGeminiNewsPulse({ fetchImpl: mockFetch, cfg: baseCfg, now: T0 + 20_000, classifyItem });
  assert.equal(geminiCalls, 1, 'active lease prevents duplicate Gemini calls');
  assert.equal(leased.status, 'cached');
  assert.equal(leased.items.length, 1);

  // 4. Past 30 min with no active lease: refreshes Gemini once with new headline!
  _resetGeminiPulseCache();
  dbState.ainewsPulse.claimedAt = 0;
  dbState.ainewsPulse.at = T0;
  geminiTitle = 'Alibaba Qwen3.9 launches worldwide with open Apache weights';
  geminiUrl = 'https://qwenlm.github.io/blog/qwen3-9/';
  geminiHost = 'qwenlm.github.io';
  const refreshed = await getGeminiNewsPulse({ fetchImpl: mockFetch, cfg: baseCfg, now: T0 + PULSE_INTERVAL_MS + 1000, classifyItem });
  assert.equal(geminiCalls, 2);
  assert.equal(refreshed.status, 'live');
  assert.match(refreshed.items[0].title, /Qwen3\.9/);

  // 5. Gemini 429 error after next 30 min: keeps previous cached stories and sets 5-min backoff!
  _resetGeminiPulseCache();
  geminiShouldFail = true;
  const T2 = T0 + 2 * PULSE_INTERVAL_MS + 5000;
  const erred = await getGeminiNewsPulse({ fetchImpl: mockFetch, cfg: baseCfg, now: T2, classifyItem });
  assert.equal(geminiCalls, 3);
  assert.equal(erred.status, 'cached', 'serves previous cached pulse items during outage');
  assert.equal(erred.items.length, 1);
  assert.ok(dbState.ainewsPulse.backoffUntil >= T2 + PULSE_BACKOFF_MS);

  // During 5-min backoff (even on a cold container), 0 Gemini retries!
  _resetGeminiPulseCache();
  await getGeminiNewsPulse({ fetchImpl: mockFetch, cfg: baseCfg, now: T2 + 60_000, classifyItem });
  assert.equal(geminiCalls, 3, 'respects 5-minute backoff after Gemini error');
});

test('Telegram bot /ainews command, inline tabs, search, switches, and automatic 30-min breaking group broadcasts work cleanly', async () => {
  forgetGroups();
  forgetTgAiNews();
  _resetAiNewsCache();

  assert.equal(ainewsOn(getConfig({})), true);
  assert.equal(ainewsOn(getConfig({ TELEGRAM_AINEWS: 'off' })), false);
  assert.equal(aiNewsPostsOn(getConfig({ TELEGRAM_GROUPS: '@agi_group' })), true);
  assert.equal(aiNewsPostsOn(getConfig({ TELEGRAM_GROUPS: '@agi_group', TELEGRAM_AINEWS_POSTS: 'off' })), false);
  assert.deepEqual(parseAiNewsArg(''), { tab: 'top', query: '' });
  assert.deepEqual(parseAiNewsArg('weights'), { tab: 'weights', query: '' });
  assert.deepEqual(parseAiNewsArg('tools'), { tab: 'tools', query: '' });
  assert.deepEqual(parseAiNewsArg('glm 5.4'), { tab: 'search', query: 'glm 5.4' });

  const TOKEN = `123456789:AA${'a'.repeat(33)}`;
  const CHAT = 555001;
  const GROUP = -1001234567890;
  const NOW = Date.parse('2026-11-23T08:00:00Z');
  const tgCalls = [];
  let dbState = { since: 1795400000000, diary: '2026-11-23' };
  let pulseHeadline = 'Z.ai unveils GLM-5.4 with vision & 50% higher weekly quota';
  let pulseUrl = 'https://z.ai/blog/glm-5-4';
  let pulseHost = 'z.ai';

  const realFetch = globalThis.fetch;
  const mockFetch = async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith('https://api.telegram.org/')) {
      const method = u.split('/').pop();
      const body = init.body ? JSON.parse(init.body) : {};
      tgCalls.push({ method, body });
      return Response.json({ ok: true, result: { message_id: 99 } });
    }
    if (u.includes('/rest/v1/rpc/feed_state_get')) {
      return Response.json(structuredClone(dbState));
    }
    if (u.includes('/rest/v1/rpc/feed_state_put')) {
      dbState = structuredClone(JSON.parse(init.body).p_state);
      return Response.json(true);
    }
    if (u.includes('generativelanguage.googleapis.com')) {
      return Response.json({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify([
                {
                  title: pulseHeadline,
                  summary: 'Vision capabilities and stronger coding rollout across GLM Coding Plan.',
                  url: pulseUrl,
                  githubUrl: 'https://github.com/zai-org/GLM-5',
                  lab: 'Z.ai GLM',
                  source: pulseHost,
                  publishedAt: new Date(NOW - 10 * 60_000).toISOString(),
                },
                {
                  title: 'Shill $OTHERCOIN 100x moon contract 0xabcdef123456',
                  summary: 'Must be filtered out from group broadcasts.',
                  url: 'https://spam.example.org/othercoin-moon',
                  lab: 'Spam',
                  source: 'spam.org',
                  publishedAt: new Date(NOW - 5 * 60_000).toISOString(),
                },
              ]),
            }],
          },
          groundingMetadata: {
            webSearchQueries: ['GLM-5.4 Z.ai'],
            groundingChunks: [{ web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/GLM', title: pulseHost } }],
          },
        }],
      });
    }
    throw new Error('offline upstream');
  };

  globalThis.fetch = mockFetch;
  try {
    const cfg = getConfig({
      GEMINI_API_KEY: 'AIzaSyFAKE_TG_KEY_00000000000000000',
      SUPABASE_URL: 'https://proj.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_test',
      PASS_SECRET: 'pass-secret-long-enough-for-telegram-tests',
      TELEGRAM_GROUPS: `@agi_group ${GROUP}`,
    });

    // 1. Private chat /ainews works immediately (no 18+ gate, clickable entities, inline buttons)
    const rPm = await handleUpdate(cfg, TOKEN, {
      update_id: 1,
      message: { message_id: 10, from: { id: CHAT, is_bot: false, first_name: 'U' }, chat: { id: CHAT, type: 'private' }, date: 1, text: '/ainews' },
    }, NOW);
    assert.equal(rPm, 'ainews_top');
    const sentPm = tgCalls.find((c) => c.method === 'sendMessage');
    assert.ok(sentPm, 'sends AI News World briefing');
    assert.match(sentPm.body.text, /AI News World/);
    assert.match(sentPm.body.text, /GLM-5\.4/);
    assert.equal(sentPm.body.link_preview_options?.is_disabled, true);
    assert.ok(sentPm.body.entities.some((e) => e.type === 'text_link' && /^https:\/\/(?:www\.)?[^/]+\/ainews$/.test(e.url)));
    assert.deepEqual(
      sentPm.body.reply_markup.inline_keyboard[0].map((b) => b.callback_data),
      ['ainews:top', 'ainews:weights', 'ainews:tools'],
    );

    // 2. Private chat search /ainews kimi finds Kimi K3.1 Pro
    tgCalls.length = 0;
    const rSearch = await handleUpdate(cfg, TOKEN, {
      update_id: 2,
      message: { message_id: 11, from: { id: CHAT, is_bot: false, first_name: 'U' }, chat: { id: CHAT, type: 'private' }, date: 2, text: '/ainews kimi' },
    }, NOW + 2000);
    assert.equal(rSearch, 'ainews_search');
    assert.match(tgCalls.find((c) => c.method === 'sendMessage').body.text, /Kimi/i);

    // 3. Inline button tap in private chat edits message in place to Open Weights tab
    tgCalls.length = 0;
    const rTap = await handleUpdate(cfg, TOKEN, {
      update_id: 3,
      callback_query: {
        id: 'cb1',
        from: { id: CHAT, is_bot: false, first_name: 'U' },
        message: { message_id: 99, chat: { id: CHAT, type: 'private' } },
        data: 'ainews:weights',
      },
    }, NOW + 5000);
    assert.equal(rTap, 'ainews_weights');
    assert.ok(tgCalls.some((c) => c.method === 'answerCallbackQuery'));
    const edited = tgCalls.find((c) => c.method === 'editMessageText');
    assert.ok(edited, 'updates message in place on tab switch');
    assert.match(edited.body.text, /Open Weights & Repos/);

    // 4. Group /ainews replies in-thread & obeys 30s group cooldown; tab tap works in allowed group & rejected in foreign group
    tgCalls.length = 0;
    const rGroup = await handleUpdate(cfg, TOKEN, {
      update_id: 4,
      message: {
        message_id: 50,
        is_topic_message: true,
        message_thread_id: 7,
        from: { id: 777, is_bot: false, first_name: 'G' },
        chat: { id: GROUP, type: 'supergroup' },
        date: 3,
        text: '/ainews tools',
      },
    }, NOW + 6000);
    assert.equal(rGroup, 'group_ainews_tools');
    const groupMsg = tgCalls.find((c) => c.method === 'sendMessage');
    assert.equal(groupMsg.body.message_thread_id, 7);
    assert.match(groupMsg.body.text, /@theAIsearch/);

    // Second bare /ainews tools inside 30s cooldown in same group -> group_recent
    const rCooldown = await handleUpdate(cfg, TOKEN, {
      update_id: 5,
      message: { message_id: 51, from: { id: 778, is_bot: false, first_name: 'G2' }, chat: { id: GROUP, type: 'supergroup' }, date: 4, text: '/ainews tools' },
    }, NOW + 10_000);
    assert.equal(rCooldown, 'group_recent');

    // Foreign group button tap -> ignored
    const rForeign = await handleUpdate(cfg, TOKEN, {
      update_id: 6,
      callback_query: {
        id: 'cb2',
        from: { id: 777, is_bot: false },
        message: { message_id: 1, chat: { id: -1009999999, type: 'supergroup' } },
        data: 'ainews:top',
      },
    }, NOW + 11_000);
    assert.equal(rForeign, 'ignored');

    // 5. TELEGRAM_AINEWS=off hides /ainews from menus and turns off buttons
    const offCfg = getConfig({ TELEGRAM_AINEWS: 'off', TELEGRAM_GROUPS: '@agi_group' });
    assert.ok(!commandsFor(offCfg).some((c) => c.command === 'ainews'));
    assert.ok(!groupCommandsFor(offCfg).some((c) => c.command === 'ainews'));
    const rTapOff = await onAiNewsTap(offCfg, TOKEN, {
      id: 'cb3',
      from: { id: CHAT, is_bot: false },
      message: { message_id: 99, chat: { id: CHAT, type: 'private' } },
      data: 'ainews:top',
    }, NOW + 12_000);
    assert.equal(rTapOff, 'ainews_off');

    // 6. Automatic breaking group broadcast: first run seeds cleanly (0 spam), next 30-min new headline broadcasts once & filters non-$AGI tickers!
    tgCalls.length = 0;
    dbState = { since: 1795400000000, diary: '2026-11-23' };
    _resetAiNewsCache();
    const tSeed = await tickTelegramAiNews(cfg, TOKEN, { now: NOW, fetchImpl: mockFetch });
    assert.equal(tSeed.seeded, true, 'first run seeds seen list without dumping backlog');
    assert.equal(tSeed.posted, 0);
    assert.equal(dbState.since, 1795400000000, 'preserves /api/feed keys');
    assert.equal(dbState.diary, '2026-11-23');

    // 31 minutes later: brand-new breaking headline drops -> broadcasts to both configured groups, skips $OTHERCOIN spam!
    _resetAiNewsCache();
    pulseHeadline = 'Alibaba Qwen4-Ultra open-weights released globally';
    pulseUrl = 'https://qwenlm.github.io/blog/qwen4-ultra/';
    pulseHost = 'qwenlm.github.io';
    const tLive = await tickTelegramAiNews(cfg, TOKEN, { now: NOW + PULSE_INTERVAL_MS + 60_000, fetchImpl: mockFetch });
    assert.equal(tLive.posted, 2, 'broadcasts once to @agi_group and numeric GROUP');
    const bMsgs = tgCalls.filter((c) => c.method === 'sendMessage');
    assert.equal(bMsgs.length, 2);
    assert.match(bMsgs[0].body.text, /Qwen4-Ultra/);
    assert.doesNotMatch(bMsgs[0].body.text, /OTHERCOIN|0xabcdef/i, 'never broadcasts non-$AGI tickers or addresses');

    // Same headline again after another 31 min -> deduped (0 duplicate posts!)
    tgCalls.length = 0;
    _resetAiNewsCache();
    const tDup = await tickTelegramAiNews(cfg, TOKEN, { now: NOW + 2 * PULSE_INTERVAL_MS + 120_000, fetchImpl: mockFetch });
    assert.equal(tDup.posted, 0, 'never posts the same breaking story twice');

    // Helper smoke checks
    assert.equal(formatBreakingBroadcast([{ title: '$PEPE moons 0x123456', url: 'https://x.com/a' }]), null);
    assert.ok(formatAiNewsView({ stories: SPOTLIGHT_STORIES, openWeights: [], aiSearchTools: [], videos: [], stats: {} }).text.includes('AI News World'));
    assert.equal((await broadcastBreakingAiNews({ cfg: { ...cfg, tgAiNewsPosts: false }, token: TOKEN, items: SPOTLIGHT_STORIES })).posted, 0);
    assert.equal(await onAiNewsCommand({ ...cfg, tgAiNews: false }, TOKEN, { chatId: CHAT }), 'ainews_off');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('Personal Telegram DM AI News alerts: /start ainews, 1-tap toggle, /stop cleanup, automatic model/news pushes & blocked-user pruning', async () => {
  forgetGroups();
  forgetTgAiNews();
  _resetAiNewsCache();

  assert.deepEqual(parseAiNewsArg('alerts'), { tab: 'sub', query: '' });
  assert.deepEqual(parseAiNewsArg('off'), { tab: 'unsub', query: '' });

  const TOKEN = `123456789:AA${'b'.repeat(33)}`;
  const USER_A = 888001;
  const USER_B = 888002;
  const NOW = Date.parse('2026-11-23T10:00:00Z');
  const tgCalls = [];
  const blocked = new Set();
  let dbState = { since: 1795400000000, diary: '2026-11-23' };
  let pulseHeadline = 'DeepSeek R2 open weights drop with Apache 2.0 license';

  const realFetch = globalThis.fetch;
  const mockFetch = async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith('https://api.telegram.org/')) {
      const method = u.split('/').pop();
      const body = init.body ? JSON.parse(init.body) : {};
      tgCalls.push({ method, body });
      if (method === 'sendMessage' && blocked.has(body.chat_id)) {
        return Response.json({ ok: false, description: 'Forbidden: bot was blocked by the user' }, { status: 403 });
      }
      if (method === 'getMe') return Response.json({ ok: true, result: { id: 123456789, username: 'agi1_appbot' } });
      return Response.json({ ok: true, result: { message_id: 77 } });
    }
    if (u.includes('/rest/v1/rpc/feed_state_get')) return Response.json(structuredClone(dbState));
    if (u.includes('/rest/v1/rpc/feed_state_put')) {
      dbState = structuredClone(JSON.parse(init.body).p_state);
      return Response.json(true);
    }
    if (u.includes('/rest/v1/rpc/tg_forget') || u.includes('/rest/v1/rpc/inf_alert_off')) return Response.json(false);
    if (u.includes('generativelanguage.googleapis.com')) {
      return Response.json({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify([{
                title: pulseHeadline,
                summary: 'Full weights and inference code published globally.',
                url: 'https://github.com/deepseek-ai/DeepSeek-R2',
                githubUrl: 'https://github.com/deepseek-ai/DeepSeek-R2',
                lab: 'DeepSeek',
                source: 'github.com',
                publishedAt: new Date(NOW - 5 * 60_000).toISOString(),
              }]),
            }],
          },
          groundingMetadata: {
            webSearchQueries: ['DeepSeek R2 release'],
            groundingChunks: [{ web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/DS', title: 'github.com' } }],
          },
        }],
      });
    }
    throw new Error('offline upstream');
  };

  globalThis.fetch = mockFetch;
  try {
    // Config WITHOUT TELEGRAM_GROUPS (DM-only alerts!)
    const cfg = getConfig({
      GEMINI_API_KEY: 'AIzaSyFAKE_DM_KEY_00000000000000000',
      SUPABASE_URL: 'https://proj.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_test',
      PASS_SECRET: 'pass-secret-long-enough-for-telegram-tests',
    });

    // 0. With 0 subscribers and no groups, tickTelegramAiNews exits idle with 0 Gemini/Telegram calls!
    const idle = await tickTelegramAiNews(cfg, TOKEN, { now: NOW, fetchImpl: mockFetch });
    assert.equal(idle.status, 'idle');
    assert.equal(tgCalls.length, 0);

    // 1. User A taps "Get Alerts on Telegram" on agi1.app/ainews -> /start ainews subscribes immediately (no 18+ gate)
    const rStart = await handleUpdate(cfg, TOKEN, {
      update_id: 101,
      message: { message_id: 1, from: { id: USER_A, is_bot: false, first_name: 'A' }, chat: { id: USER_A, type: 'private' }, date: 1, text: '/start ainews' },
    }, NOW);
    assert.equal(rStart, 'ainews_sub_start');
    assert.equal(await isAiNewsDmSubscribed(cfg, USER_A, { fetchImpl: mockFetch }), true);
    const startMsg = tgCalls.find((c) => c.method === 'sendMessage');
    assert.match(startMsg.body.text, /AI News Alerts are ON/);
    assert.equal(startMsg.body.reply_markup.inline_keyboard[1][0].callback_data, 'ainews:unsub:top');
    assert.equal(dbState.since, 1795400000000, 'preserves /api/feed keys');

    // 2. User B subscribes with 1-tap inline button "ainews:sub:top"
    tgCalls.length = 0;
    const rSubB = await handleUpdate(cfg, TOKEN, {
      update_id: 102,
      callback_query: {
        id: 'cb-sub',
        from: { id: USER_B, is_bot: false, first_name: 'B' },
        message: { message_id: 42, chat: { id: USER_B, type: 'private' } },
        data: 'ainews:sub:top',
      },
    }, NOW + 2000);
    assert.equal(rSubB, 'ainews_sub');
    assert.equal(await isAiNewsDmSubscribed(cfg, USER_B, { fetchImpl: mockFetch }), true);
    assert.ok(tgCalls.some((c) => c.method === 'editMessageReplyMarkup' && c.body.reply_markup.inline_keyboard[1][0].callback_data === 'ainews:unsub:top'));

    // 3. First live pulse after 30m seeds `seen` cleanly without dumping backlog, preserving BOTH DM subscribers!
    tgCalls.length = 0;
    _resetAiNewsCache();
    const T1 = NOW + PULSE_INTERVAL_MS + 5000;
    const seeded = await tickTelegramAiNews(cfg, TOKEN, { now: T1, fetchImpl: mockFetch });
    assert.equal(seeded.seeded, true);
    assert.equal(seeded.dmPosted, 0);
    assert.deepEqual(dbState.ainewsTg.subs, [USER_A, USER_B]);

    // 4. Another 31 min later, a new model drops! User B blocked the bot -> User A gets DM alert with "🔕 Pause Alerts", User B is pruned!
    blocked.add(USER_B);
    tgCalls.length = 0;
    _resetAiNewsCache();
    pulseHeadline = 'DeepSeek R2 Pro launches with real-time coding agents';
    const T2 = T1 + PULSE_INTERVAL_MS + 60_000;
    const pushed = await tickTelegramAiNews(cfg, TOKEN, { now: T2, fetchImpl: mockFetch });
    assert.equal(pushed.dmPosted, 1);
    assert.equal(pushed.gone, 1);
    assert.deepEqual(dbState.ainewsTg.subs, [USER_A], 'blocked user automatically pruned');
    const dmAlert = tgCalls.find((c) => c.method === 'sendMessage' && c.body.chat_id === USER_A);
    assert.ok(dmAlert);
    assert.match(dmAlert.body.text, /DeepSeek R2 Pro/);
    assert.equal(dmAlert.body.reply_markup.inline_keyboard[1][0].text, '🔕 Pause Alerts');

    // 5. OpenRouter model launches & @theAIsearch videos qualify as high-signal alert candidates (spotlights & old items do not)
    const candidates = collectAlertCandidates({
      stories: [
        { title: 'New Model Launch: Z.ai GLM-5.4', sourceKind: 'openrouter', url: 'https://openrouter.ai/z-ai/glm-5.4', publishedAt: new Date(NOW - 30 * 60_000).toISOString() },
        { title: '10 Insane New Open-Source AI Tools', sourceKind: 'video', url: 'https://www.youtube.com/watch?v=abc', publishedAt: new Date(NOW - 60 * 60_000).toISOString() },
        { title: 'Static Spotlight', sourceKind: 'spotlight', url: 'https://agi1.app/ainews', publishedAt: new Date(NOW).toISOString() },
        { title: 'Old OpenRouter Drop', sourceKind: 'openrouter', url: 'https://openrouter.ai/old/model', publishedAt: new Date(NOW - 48 * 3600_000).toISOString() },
      ],
    }, NOW);
    assert.equal(candidates.length, 2);

    // 6. /stop turns off AI News DM alerts too and says so
    tgCalls.length = 0;
    const rStop = await handleUpdate(cfg, TOKEN, {
      update_id: 103,
      message: { message_id: 2, from: { id: USER_A, is_bot: false, first_name: 'A' }, chat: { id: USER_A, type: 'private' }, date: 3, text: '/stop' },
    }, T2 + 60_000);
    assert.equal(rStop, 'stop');
    assert.equal(await isAiNewsDmSubscribed(cfg, USER_A, { fetchImpl: mockFetch }), false);
    assert.match(tgCalls.find((c) => c.method === 'sendMessage').body.text, /AI News alerts are off for this chat too/);

    // Direct helper checks
    assert.equal((await subscribeAiNewsDm(cfg, -100, { fetchImpl: mockFetch })).ok, false);
    assert.equal(await unsubscribeAiNewsDm(cfg, USER_A, { fetchImpl: mockFetch }), false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('AGI-1 chat recall injects live AI News World notes on site & Telegram when asked, stays silent on casual chat, and never triggers blocking Gemini search', async () => {
  forgetGroups();
  _resetAiNewsCache();

  // Trigger detection: fires on AI news/lab/model questions + follow-ups, NOT on casual chat
  for (const q of [
    "what's the latest ai news?",
    'tell me about agi1.app/ainews',
    'did glm 5.4 drop?',
    'any new qwen or kimi open weights?',
    'whats new with tesla optimus or grok?',
    'what tools did theaisearch cover?',
  ]) {
    assert.equal(asksAboutAiNews(q), true, q);
  }
  assert.equal(asksAboutAiNews('tell me more about the weights', "what's the latest ai news?"), true, 'follow-up');
  for (const q of ['hey cutie', 'are you an ai?', 'good morning', 'how is $AGI doing?']) {
    assert.equal(asksAboutAiNews(q), false, `casual chat stays untouched: ${q}`);
  }

  // cleanReply preserves agi1.app/ainews cleanly
  assert.equal(cleanReply('check agi1.app/ainews for the live globe 💜'), 'check agi1.app/ainews for the live globe 💜');

  const NOW = Date.parse('2026-11-23T11:00:00Z');
  const TOKEN = `123456789:AA${'c'.repeat(33)}`;
  const CHAT = 777001;
  const GROUP = -1007770001;
  const geminiPrompts = [];
  let geminiSearchCalls = 0;

  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith('https://api.telegram.org/')) {
      return Response.json({ ok: true, result: { message_id: 12 } });
    }
    if (u.includes('/rest/v1/rpc/feed_state_get')) {
      return Response.json({
        ainewsPulse: {
          v: PULSE_SCHEMA_VERSION,
          at: NOW - 40 * 60_000, // stale > 30m: chat recall MUST still use cacheOnly and make 0 Gemini search calls!
          items: [{
            id: 'pulse-openai-1',
            t: 'OpenAI Proposes Perplexity Safety Ceiling for Frontier Models',
            s: 'OpenAI Chief Scientist published a new pretraining threshold proposal.',
            u: 'https://openai.com/index/perplexity-and-intelligence/',
            l: 'OpenAI',
            p: 'OpenAI',
            d: new Date(NOW - 30 * 60_000).toISOString(),
          }],
        },
      });
    }
    if (u.includes('/rest/v1/rpc/tg_get')) return Response.json({ chat_id: CHAT, adult: true, tz_minutes: 0, seen_id: 0, day: null, sent: 0 });
    if (u.includes('/rest/v1/rpc/chat_take') || u.includes('/rest/v1/rpc/tg_group_take')) return Response.json('ok');
    if (u.includes('/rest/v1/rpc/tg_take')) return Response.json(true);
    if (u.includes('generativelanguage.googleapis.com')) {
      const body = JSON.parse(init.body);
      if (body.tools) {
        geminiSearchCalls += 1;
        throw new Error('chat recall must never invoke blocking google_search');
      }
      geminiPrompts.push(body.systemInstruction?.parts?.[0]?.text || '');
      return Response.json({
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ reply: 'yep glm-5.4 and openai updates are live on agi1.app/ainews 💜', mood: 'happy' }) }] } }],
      });
    }
    throw new Error('offline upstream');
  };

  try {
    const cfg = getConfig({
      GEMINI_API_KEY: 'AIzaSyFAKE_RECALL_KEY_0000000000000',
      SUPABASE_URL: 'https://proj.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_test',
      PASS_SECRET: 'pass-secret-long-enough-for-telegram-tests',
      TELEGRAM_GROUPS: String(GROUP),
    });

    // Direct recallAiNews check (prioritizes matching headline, zero Gemini search calls)
    const brief = await recallAiNews(cfg, 'what happened with openai and glm 5.4?', '', { now: NOW });
    assert.ok(brief && brief.headlines.length >= 2);
    assert.ok(brief.headlines.some((h) => /OpenAI Proposes Perplexity/i.test(h)));
    assert.ok(brief.headlines.some((h) => /GLM-5\.4/i.test(h)));
    assert.equal(geminiSearchCalls, 0);

    const webPrompt = aiNewsPrompt(brief);
    assert.match(webPrompt, /AI NEWS WORLD \(LIVE NOTES FROM AGI1\.APP\/AINEWS\)/);
    assert.match(webPrompt, /agi1\.app\/ainews/);
    const groupPrompt = aiNewsPrompt(brief, { telegram: { group: true } });
    assert.match(groupPrompt, /\/ainews/);
    assert.match(groupPrompt, /friendly and non-flirty/);

    // Telegram DM chat: casual message gets NO AI news block; AI news question DOES get live AI News World notes!
    await handleUpdate(cfg, TOKEN, {
      update_id: 201,
      message: { message_id: 1, from: { id: CHAT, is_bot: false, first_name: 'U' }, chat: { id: CHAT, type: 'private' }, date: 1, text: 'good morning!' },
    }, NOW);
    assert.doesNotMatch(geminiPrompts.at(-1), /AI NEWS WORLD/);

    await handleUpdate(cfg, TOKEN, {
      update_id: 202,
      message: { message_id: 2, from: { id: CHAT, is_bot: false, first_name: 'U' }, chat: { id: CHAT, type: 'private' }, date: 2, text: 'what is the latest ai news today?' },
    }, NOW + 5000);
    assert.match(geminiPrompts.at(-1), /AI NEWS WORLD \(LIVE NOTES FROM AGI1\.APP\/AINEWS\)/);
    assert.match(geminiPrompts.at(-1), /OpenAI Proposes Perplexity/);

    // Telegram group /ask: gets live AI News World notes too!
    await handleUpdate(cfg, TOKEN, {
      update_id: 203,
      message: { message_id: 3, from: { id: 999, is_bot: false, first_name: 'G' }, chat: { id: GROUP, type: 'supergroup' }, date: 3, text: '/ask tell me about glm 5.4 and the ai news' },
    }, NOW + 10_000);
    assert.match(geminiPrompts.at(-1), /AI NEWS WORLD \(LIVE NOTES FROM AGI1\.APP\/AINEWS\)/);
    assert.match(geminiPrompts.at(-1), /GLM-5\.4/);
    assert.equal(geminiSearchCalls, 0, 'conversational recall never makes blocking search calls');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('Telegram group alerts: high-signal RSS launches, PG-13 filter, cached-pulse broadcast, /ainews alerts in groups & admin-only /ainews off', async () => {
  forgetGroups();
  forgetTgAiNews();
  _resetAiNewsCache();

  // Group AI News alerts remain ON even when TELEGRAM_GROUP_POSTS=off (only TELEGRAM_AINEWS_POSTS=off or TELEGRAM_AINEWS=off disables them)
  assert.equal(aiNewsPostsOn(getConfig({ TELEGRAM_GROUPS: '@agi2dotapp', TELEGRAM_GROUP_POSTS: 'off' })), true);
  assert.equal(aiNewsPostsOn(getConfig({ TELEGRAM_GROUPS: '@agi2dotapp', TELEGRAM_AINEWS_POSTS: 'off' })), false);

  // Similar headline dedupe collapses two outlets covering the same launch, while distinct versions remain separate
  assert.equal(
    similarHeadline('Z.ai unveils GLM-5.4 model with Loop Transformer design', "China's Z.ai launches GLM-5.4, a looped 750B model for coding"),
    true,
  );
  assert.equal(
    similarHeadline('DeepSeek R2 open weights drop with Apache 2.0 license', 'DeepSeek R2 Pro launches with real-time coding agents'),
    false,
  );

  // collectAlertCandidates includes fresh high-signal RSS lab launches & official lab posts, blocks tutorials, NSFW/PG-13 & opinion/promo noise, and dedupes
  const NOW = Date.parse('2026-11-23T14:00:00Z');
  const magiInfo = classifyItem('Sand.ai Launches Full MAGI-2 Video Model on Higgsfield with 400B Open Weights');
  assert.equal(magiInfo.lab, 'Sand.ai MAGI');
  assert.equal(magiInfo.hub, 'beijing');
  assert.equal(magiInfo.breaking, true);
  const candidates = collectAlertCandidates({
    stories: [
      { title: 'NVIDIA Board Reinstates Jensen Huang as President, CEO and Board Director', sourceKind: 'rss', isLabFeed: true, lab: 'NVIDIA', url: 'https://nvidianews.nvidia.com/news/reinstates-jensen', publishedAt: new Date(NOW - 5 * 60_000).toISOString() },
      { title: 'Sand.ai Launches Full MAGI-2 Video Model, With Open Weights Still Promised', sourceKind: 'rss', lab: 'Sand.ai MAGI', url: 'https://pandaily.com/magi-2', publishedAt: new Date(NOW - 8 * 60_000).toISOString() },
      { title: 'NewStartup unveils 400B open-weights video model for 1080p generation', sourceKind: 'rss', lab: 'NewStartup', url: 'https://newstartup.ai/blog/400b', publishedAt: new Date(NOW - 12 * 60_000).toISOString() },
      { title: 'OpenAI Publishes Internal AI Scores and Calls for Industry Limits', sourceKind: 'rss', isLabFeed: true, lab: 'OpenAI', url: 'https://openai.com/index/internal-scores', publishedAt: new Date(NOW - 15 * 60_000).toISOString() },
      { title: 'How to build and maintain an agentic evaluation', sourceKind: 'rss', isLabFeed: true, lab: 'Hugging Face', url: 'https://huggingface.co/blog/agentic-eval', publishedAt: new Date(NOW - 20 * 60_000).toISOString() },
      { title: 'Z.ai unveils GLM-5.4 model with Loop Transformer design', sourceKind: 'rss', lab: 'Z.ai GLM', url: 'https://investing.com/glm-5-4', publishedAt: new Date(NOW - 30 * 60_000).toISOString() },
      { title: "China's Z.ai launches GLM-5.4, a looped 750B model for coding", sourceKind: 'rss', lab: 'Z.ai GLM', url: 'https://thenextweb.com/glm-5-4', publishedAt: new Date(NOW - 90 * 60_000).toISOString() },
      { title: 'Claude Code Adds Experimental Code Mode to Orchestrate Tool Calls', sourceKind: 'rss', lab: 'Anthropic', url: 'https://infoq.com/claude-code-mode', publishedAt: new Date(NOW - 60 * 60_000).toISOString() },
      { title: 'NVIDIA Announces Upcoming Event for Financial Community', sourceKind: 'rss', isLabFeed: true, lab: 'NVIDIA', url: 'https://nvidianews.nvidia.com/news/ir-event', publishedAt: new Date(NOW - 45 * 60_000).toISOString() },
      { title: 'GLM 5.5: Why It Never Shipped and What Comes Next', sourceKind: 'rss', lab: 'Z.ai GLM', url: 'https://felloai.com/glm-5-5', publishedAt: new Date(NOW - 10 * 60_000).toISOString() },
      { title: 'Z.ai releases older model update from 8 hours ago', sourceKind: 'rss', lab: 'Z.ai GLM', url: 'https://example.org/old-glm', publishedAt: new Date(NOW - 8 * 3600_000).toISOString() },
      { title: 'Merry Making: Play, Build and Create With NVIDIA Technologies This Holiday Season', sourceKind: 'rss', isLabFeed: true, lab: 'NVIDIA', url: 'https://nvidianews.nvidia.com/holiday', publishedAt: new Date(NOW - 20 * 60_000).toISOString() },
      { title: 'SpaceX sued by Oregon and Virginia over AI deepfake porn, Grok safety claims', sourceKind: 'rss', lab: 'xAI Grok', url: 'https://cnbc.com/grok-porn', publishedAt: new Date(NOW - 40 * 60_000).toISOString() },
      { title: "Pouncing on Anthropic Won't Make You Rich", sourceKind: 'rss', lab: 'Anthropic', url: 'https://wsj.com/anthropic', publishedAt: new Date(NOW - 50 * 60_000).toISOString() },
      { title: 'Fallback Offline Video', sourceKind: 'video', isFallback: true, url: 'https://youtube.com/watch?v=fb1', publishedAt: new Date(NOW - 20 * 60_000).toISOString() },
    ],
  }, NOW);
  assert.equal(candidates.length, 6, 'keeps fresh NVIDIA CEO + MAGI-2 + unknown startup 400B open-weights video model + OpenAI + GLM-5.4 + Claude Code Mode, drops 8h stale RSS, explainers, holiday promos, tutorials, NSFW & fallback video');
  assert.match(candidates[0].title, /Jensen Huang/);
  assert.ok(candidates.some((c) => /MAGI-2/.test(c.title)));
  assert.ok(candidates.some((c) => /400B open-weights video model/.test(c.title)));

  // formatBreakingBroadcast drops robotic "Live AI news dispatch from ..." placeholder summaries
  const fmt = formatBreakingBroadcast([{
    title: 'OpenAI launches GPT-6.5',
    summary: 'Live AI news dispatch from Reuters.',
    lab: 'OpenAI',
    source: 'Reuters',
    url: 'https://reuters.com/openai-gpt-6-5',
    publishedAt: new Date(NOW - 2 * 60_000).toISOString(),
  }], { now: NOW });
  assert.doesNotMatch(fmt.text, /Live AI news dispatch from/i);
  assert.match(fmt.text, /OpenAI · Reuters · 2m ago/);

  // Group /ainews alerts (including Forum Topic support), cached-pulse broadcast, and admin-only /ainews off
  const TOKEN = `123456789:AA${'d'.repeat(33)}`;
  const GROUP_ID = -1001112223334;
  const TOPIC_ID = 42;
  const ADMIN_ID = 5001;
  const MEMBER_ID = 5002;
  const tgCalls = [];
  let dbState = {
    since: 1795400000000,
    ainewsPulse: {
      v: PULSE_SCHEMA_VERSION,
      at: NOW - 5 * 60_000, // fresh 5-min-old cached pulse (must STILL broadcast on cron!)
      items: [{
        t: 'Anthropic releases Claude 4.7 Opus with native computer agents',
        s: 'Available today across API and Claude Code.',
        u: 'https://www.anthropic.com/news/claude-4-7-opus',
        l: 'Anthropic',
        p: 'Anthropic',
        d: new Date(NOW - 10 * 60_000).toISOString(),
      }],
    },
    ainewsTg: { seeded: true, lastAt: NOW - 40 * 60_000, checkedAt: NOW - 20 * 60_000, seen: ['older headline'], subs: [] },
  };

  const realFetch = globalThis.fetch;
  let openAiRssXml = null;
  const mockFetch = async (url, init = {}) => {
    const u = String(url);
    if (u.startsWith('https://api.telegram.org/')) {
      const method = u.split('/').pop();
      const body = init.body ? JSON.parse(init.body) : {};
      tgCalls.push({ method, body });
      if (method === 'getMe') return Response.json({ ok: true, result: { id: 123456789, username: 'agi1_appbot' } });
      if (method === 'getChatMember') {
        return Response.json({ ok: true, result: { status: body.user_id === ADMIN_ID ? 'administrator' : 'member' } });
      }
      return Response.json({ ok: true, result: { message_id: 300 } });
    }
    if (u.includes('/rest/v1/rpc/feed_state_get')) return Response.json(structuredClone(dbState));
    if (u.includes('/rest/v1/rpc/feed_state_put')) {
      dbState = structuredClone(JSON.parse(init.body).p_state);
      return Response.json(true);
    }
    if (openAiRssXml && u === 'https://openai.com/news/rss.xml') {
      return new Response(openAiRssXml, { status: 200, headers: { 'content-type': 'application/rss+xml' } });
    }
    throw new Error('offline upstream');
  };

  globalThis.fetch = mockFetch;
  try {
    const cfg = getConfig({
      GEMINI_API_KEY: 'AIzaSyFAKE_GROUP_KEY_000000000000',
      SUPABASE_URL: 'https://proj.supabase.co',
      SUPABASE_SECRET_KEY: 'sb_secret_test',
      PASS_SECRET: 'pass-secret-long-enough-for-telegram-tests',
      TELEGRAM_GROUPS: '@agi2dotapp',
      TELEGRAM_GROUP_POSTS: 'off',
    });

    // 1. Even when Gemini Pulse is 'cached' (refreshed 5m ago by web visitor), tickTelegramAiNews STILL broadcasts to @agi2dotapp!
    const ticked = await tickTelegramAiNews(cfg, TOKEN, { now: NOW, fetchImpl: mockFetch });
    assert.equal(ticked.groupPosted, 1, 'cached pulse story still broadcasts to configured Telegram group');
    assert.ok(tgCalls.some((c) => c.method === 'sendMessage' && c.body.chat_id === '@agi2dotapp' && /Claude 4\.7 Opus/.test(c.body.text)));

    // 1B. Fast near-real-time cadence: a brand-new official lab RSS drop 6 minutes later broadcasts immediately (no 25-min delay, 0 extra Gemini calls!)
    tgCalls.length = 0;
    openAiRssXml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><item>
      <title>OpenAI unveils GPT-6.5 coding agent preview</title>
      <link>https://openai.com/index/gpt-6-5</link>
      <pubDate>${new Date(NOW + 5 * 60_000).toUTCString()}</pubDate>
      <description>Live in API and Codex today.</description>
    </item></channel></rss>`;
    const fastTick = await tickTelegramAiNews(cfg, TOKEN, { now: NOW + 6 * 60_000, fetchImpl: mockFetch });
    assert.equal(fastTick.groupPosted, 1, 'second breaking story from official lab RSS broadcasts after 6m without 25m delay');
    assert.ok(tgCalls.some((c) => c.method === 'sendMessage' && /GPT-6\.5/.test(c.body.text)));
    openAiRssXml = null;

    // 2. Typing "/ainews alerts" inside a Forum Topic pins that group's numeric chat_id + threadId (replacing @agi2dotapp with 0 duplicates!)
    tgCalls.length = 0;
    const rOn = await handleUpdate(cfg, TOKEN, {
      update_id: 301,
      message: {
        message_id: 10,
        from: { id: ADMIN_ID, is_bot: false, first_name: 'Owner' },
        chat: { id: GROUP_ID, type: 'supergroup', username: 'agi2dotapp' },
        is_topic_message: true,
        message_thread_id: TOPIC_ID,
        date: 1,
        text: '/ainews alerts',
      },
    }, NOW + 5000);
    assert.equal(rOn, 'group_ainews_alerts_on');
    assert.ok(tgCalls.some((c) => c.method === 'sendMessage' && c.body.chat_id === GROUP_ID && c.body.message_thread_id === TOPIC_ID && /Group AI News Alerts are ON/.test(c.body.text)));
    assert.deepEqual(resolveGroupTargets(cfg, dbState.ainewsTg), [{ to: GROUP_ID, threadId: TOPIC_ID, key: String(GROUP_ID), name: 'agi2dotapp' }]);

    // 3. Non-admin cannot pause group alerts via "/ainews off"
    tgCalls.length = 0;
    const rDenied = await handleUpdate(cfg, TOKEN, {
      update_id: 302,
      message: {
        message_id: 11,
        from: { id: MEMBER_ID, is_bot: false, first_name: 'Member' },
        chat: { id: GROUP_ID, type: 'supergroup', username: 'agi2dotapp' },
        date: 2,
        text: '/ainews off',
      },
    }, NOW + 10_000);
    assert.equal(rDenied, 'group_ainews_admin_only');
    assert.equal(resolveGroupTargets(cfg, dbState.ainewsTg).length, 1, 'still active after non-admin attempt');

    // 4. Admin CAN pause group alerts via "/ainews off"
    tgCalls.length = 0;
    const rOff = await handleUpdate(cfg, TOKEN, {
      update_id: 303,
      message: {
        message_id: 12,
        from: { id: ADMIN_ID, is_bot: false, first_name: 'Owner' },
        chat: { id: GROUP_ID, type: 'supergroup', username: 'agi2dotapp' },
        date: 3,
        text: '/ainews off',
      },
    }, NOW + 15_000);
    assert.equal(rOff, 'group_ainews_alerts_off');
    assert.deepEqual(resolveGroupTargets(cfg, dbState.ainewsTg), [], 'group muted cleanly by admin');
  } finally {
    globalThis.fetch = realFetch;
  }
});
