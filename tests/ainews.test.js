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
  MAX_PULSE_BYTES,
  extractJsonArray,
  parsePulseResponse,
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
  onAiNewsCommand,
  onAiNewsTap,
  broadcastBreakingAiNews,
  tickTelegramAiNews,
  forgetTgAiNews,
} from '../server/tg-ainews.js';
import { handleUpdate, commandsFor } from '../server/telegram.js';
import { forgetGroups, groupCommandsFor } from '../server/tg-groups.js';
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
});

test('aggregator and API handler degrade gracefully offline, serve JSON + valid RSS 2.0 XML, and preserve /api/health', async () => {
  const offlineFetch = async () => { throw new Error('offline'); };
  const data = await aggregateAiNews({ fetchImpl: offlineFetch, now: Date.parse('2026-11-23T00:00:00Z') });

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

  const resJson = await handleAiNewsRequest(new Request('https://agi1.app/api/ainews'), { fetchImpl: offlineFetch });
  assert.equal(resJson.status, 200);
  assert.match(resJson.headers.get('content-type') || '', /application\/json/);

  const resRss = await handleAiNewsRequest(new Request('https://agi1.app/api/ainews?format=rss'), { fetchImpl: offlineFetch });
  assert.equal(resRss.status, 200);
  assert.match(resRss.headers.get('content-type') || '', /application\/rss\+xml/);

  const resPost = await handleAiNewsRequest(new Request('https://agi1.app/api/ainews', { method: 'POST' }), { fetchImpl: offlineFetch });
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

test('Gemini web pulse parses grounded JSON safely, resolves grounding chunks, filters stale/unsafe URLs, and stays within Supabase size cap', () => {
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
                url: 'https://z.ai/blog/glm-5-4',
                lab: 'Z.ai GLM',
                source: 'z.ai',
                publishedAt: '2026-11-23T04:18:00Z',
              }]),
            }],
          },
          groundingMetadata: {
            webSearchQueries: ['GLM-5.4 Z.ai release'],
            groundingChunks: [{ web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/GLM', title: 'z.ai' } }],
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
                  url: 'https://z.ai/blog/glm-5-4',
                  githubUrl: 'https://github.com/zai-org/GLM-5',
                  lab: 'Z.ai GLM',
                  source: 'z.ai',
                  publishedAt: new Date(NOW - 10 * 60_000).toISOString(),
                },
                {
                  title: 'Shill $OTHERCOIN 100x moon contract 0xabcdef123456',
                  summary: 'Must be filtered out from group broadcasts.',
                  url: 'https://spam.example.org/coin',
                  lab: 'Spam',
                  source: 'spam.org',
                  publishedAt: new Date(NOW - 5 * 60_000).toISOString(),
                },
              ]),
            }],
          },
          groundingMetadata: {
            webSearchQueries: ['GLM-5.4 Z.ai'],
            groundingChunks: [{ web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/GLM', title: 'z.ai' } }],
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
    assert.ok(sentPm.body.entities.some((e) => e.type === 'text_link' && e.url === 'https://agi1.app/ainews'));
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
