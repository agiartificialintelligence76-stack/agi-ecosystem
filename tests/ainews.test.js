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
