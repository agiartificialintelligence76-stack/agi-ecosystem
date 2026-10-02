// Checks the page keeps its must-have warnings (CLAUDE.md → Design → Must-haves), so a future edit
// can't quietly drop the disclaimer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const part = (start, end) => {
  const from = html.indexOf(start);
  assert.ok(from >= 0, `index.html has ${start}`);
  const to = html.indexOf(end, from);
  assert.ok(to > from, `index.html closes ${start}`);
  return html.slice(from, to);
};

test('"Not financial advice" is in the hero and in the footer', () => {
  assert.match(part('<section class="hero"', '</section>'), /not financial advice/i, 'hero');
  assert.match(part('<footer class="foot"', '</footer>'), /not financial advice/i, 'footer');
});

test('the safety note covers every serious topic', () => {
  const foot = part('<footer class="foot"', '</footer>');
  assert.equal(foot.match(/<li class="safety-item">/g)?.length, 4, 'four notes (the fifth, "The Arena is a game", left with the Arena on 2026-09-28)');
  for (const must of ['Not financial advice', 'seed phrase', 'private keys', '18+', 'PG-13', 'an AI service that writes her replies',
    'never your IP address', 'free signature', 'token approval', 'Forget me deletes']) {
    assert.ok(foot.includes(must), `safety note mentions "${must}"`);
  }
});

test('the footer names the contract by its real start and end', () => {
  // the full address appears once in the Model card; the safety note points there
  const ca = part('data-ca>', '</code>').slice('data-ca>'.length);
  const foot = part('<footer class="foot"', '</footer>');
  assert.ok(foot.includes(`<span class="mono">${ca.slice(0, 6)}</span>`), 'starts with');
  assert.ok(foot.includes(`<span class="mono">${ca.slice(-4)}</span>`), 'ends with');
  assert.ok(foot.includes('href="#contract"'), 'links to the full address');
  assert.ok(html.includes('id="contract"'), 'the link target exists');
});

test('the connect screen promises signatures only, never transactions', () => {
  const dialog = part('<dialog class="wdlg"', '</dialog>');
  assert.match(dialog, /Free signature\. Never a transaction\./);
  assert.match(dialog, /never ask your wallet to send, approve or swap tokens/);
  assert.match(part('<section class="rel"', '</section>'), /Never a transaction/);
});

test('the diary page keeps its warnings and links back to the safety note', () => {
  const diary = readFileSync(new URL('../diary.html', import.meta.url), 'utf8');
  assert.match(diary, /not financial advice/i);
  assert.match(diary, /AGI-1 is a fictional character voiced by an AI/);
  assert.ok(diary.includes('href="/#safety"'), 'links to the full safety note');
  assert.ok(html.includes('<a href="/diary">Diary</a>'), 'the launch page links to the diary');
  assert.ok(!/<script>|style="/.test(diary), 'no inline scripts or styles (the security rules block them)');
});

test('the Arena left the site (2026-09-28, the owner: "remove the arena"): no section, link, champion or Buy link', () => {
  const diary = readFileSync(new URL('../diary.html', import.meta.url), 'utf8');
  for (const [name, page] of [['index.html', html], ['diary.html', diary]]) {
    assert.doesNotMatch(page.replace(/<!--[\s\S]*?-->/g, ''), /arena|champion|crown|nominat|leaderboard|hall of fame/i, `${name}: nothing about the Arena`);
  }
  assert.doesNotMatch(html, /data-stage-buy|data-champ|data-model="champion"|stage-buy/, 'no champion on the stage, no Buy link under it');
  const stage = readFileSync(new URL('../src/stage/stage.js', import.meta.url), 'utf8');
  assert.doesNotMatch(stage, /champion\.js|agi:arena-champion|createChampionCard/);
  for (const gone of ['../api/arena.js', '../api/vote.js', '../api/coins.js', '../api/logo.js', '../src/sections/arena.js', '../src/stage/champion.js', '../server/arena-memory.js']) {
    assert.ok(!existsSync(new URL(gone, import.meta.url)), `${gone} is gone`);
  }
});

test('the safety note says what voice and sharing do', () => {
  const foot = part('<footer class="foot"', '</footer>');
  assert.ok(foot.includes('Voice replies, if you switch them on, send her replies to the same AI service to be read aloud in a synthetic voice'));
  assert.ok(foot.includes("(if that's unavailable, you just get the text)"), '2026-09-25: her natural voice or nothing');
  assert.ok(!foot.includes("your browser's own speech takes over"), 'the robotic fallback is gone');
  assert.ok(foot.includes('nothing is posted unless you post it'));
});

// Launch-ready pass (2026-09-24)
test('phones get a menu on both pages, with every section, the diary and the safety note', () => {
  const diary = readFileSync(new URL('../diary.html', import.meta.url), 'utf8');
  for (const [name, page, prefix] of [['index.html', html, ''], ['diary.html', diary, '/']]) {
    assert.match(page, /<button class="icon-btn menu-btn" type="button" data-menu aria-expanded="false" aria-controls="site-nav" aria-label="Menu">/, `${name}: menu button`);
    const nav = page.slice(page.indexOf('<nav class="nav" id="site-nav"'), page.indexOf('</nav>', page.indexOf('id="site-nav"')));
    for (const href of [`${prefix}#evaluations`, `${prefix}#model-card`, `${prefix}#playground`, `${prefix}#checker`, '/diary', `${prefix}#safety`]) {
      assert.ok(nav.includes(`href="${href}"`), `${name}: the menu links to ${href}`);
    }
  }
});

// 2026-09-28: the project's official X account, @agi1dotapp
test('AGI on X: a round button in the top bar (a menu row on small phones) and a footer link, on both pages', () => {
  const diary = readFileSync(new URL('../diary.html', import.meta.url), 'utf8');
  for (const [name, page] of [['index.html', html], ['diary.html', diary]]) {
    const links = page.match(/<a [^>]*href="https:\/\/x\.com\/agi1dotapp"[^>]*>/g) || [];
    // the home page's front (2026-09-28) has two more: its planet and its "Her world" list
    const front = name === 'index.html' ? (page.slice(page.indexOf('data-lp-hero'), page.indexOf('data-lp-ribbons')).match(/href="https:\/\/x\.com\/agi1dotapp"/g) || []).length : 0;
    assert.equal(front, name === 'index.html' ? 2 : 0, `${name}: the front's planet and its "Her world" list`);
    assert.equal(links.length, 3 + front, `${name}: the top bar, the menu and the footer`);
    for (const a of links) assert.match(a, /target="_blank" rel="noopener noreferrer"/, `${name}: a new tab, without passing our page along`);
    const actions = page.slice(page.indexOf('<div class="topbar-actions">'), page.indexOf('</header>'));
    assert.match(actions, /<a class="icon-btn x-btn" href="https:\/\/x\.com\/agi1dotapp" [^>]*aria-label="AGI on X \(@agi1dotapp\)"/, `${name}: named for screen readers`);
    const nav = page.slice(page.indexOf('<nav class="nav" id="site-nav"'), page.indexOf('</nav>', page.indexOf('id="site-nav"')));
    assert.ok(nav.includes('<a class="nav-x" href="https://x.com/agi1dotapp"'), `${name}: the menu row for screens under 380 px`);
  }
});

test('link previews: the home page and the diary have full preview tags (the address is filled in at build time)', () => {
  const diary = readFileSync(new URL('../diary.html', import.meta.url), 'utf8');
  assert.ok(html.includes('<meta property="og:image" content="__SITE__/cards/home.jpg" />'));
  assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image" />'));
  assert.ok(html.includes('<link rel="canonical" href="__SITE__/" />'));
  assert.ok(diary.includes('<link rel="canonical" href="__SITE__/diary" />'));
  assert.match(html.match(/<meta property="og:description" content="([^"]+)"/)[1], /not financial advice/i);
});

test('browser caching: built files and fonts a year, pages never', () => {
  const cfg = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const cache = Object.fromEntries(cfg.headers.flatMap((r) => r.headers.filter((h) => h.key === 'Cache-Control').map((h) => [r.source, h.value])));
  assert.equal(cache['/assets/(.*)'], 'public, max-age=31536000, immutable');
  assert.equal(cache['/fonts/(.*)'], 'public, max-age=31536000, immutable');
  for (const s of ['/models/(.*)', '/images/(.*)', '/cards/(.*)', '/theme.js']) assert.equal(cache[s], 'public, max-age=86400', s);
  assert.ok(!Object.keys(cache).some((s) => ['/(.*)', '/', '/index.html', '/diary', '/api/(.*)'].includes(s)), 'pages and /api keep the default (always rechecked)');
});

test('the owner\'s wording (2026-09-24): the AI provider isn\'t named, and there\'s no "Not a real lab" note', () => {
  const diary = readFileSync(new URL('../diary.html', import.meta.url), 'utf8');
  for (const [name, page] of [['index.html', html], ['diary.html', diary]]) {
    assert.doesNotMatch(page, /Gemini|Google/, `${name} doesn't name the AI provider`);
    assert.doesNotMatch(page, /Not a real lab/i, name);
  }
  assert.match(part('<div class="pg-gate"', '</div>'), /sent to an AI service that writes her replies/, 'the 18+ screen still says where messages go');
});

test('her live view in the chat (2026-09-25): a slot for the 3D stage, with a still picture until she arrives', () => {
  const pg = part('<section class="section" id="playground"', '<section class="section" id="checker"');
  assert.match(pg, /<div class="pg-cam" data-cam hidden>/, 'hidden until the 18+ check is done (src/chat/chat.js)');
  // (her 2D picture: she's 2D first since 2026-10-01; src/main.js shows the 3D one to visitors who picked 3D)
  assert.match(pg, /<img class="pg-cam-still" src="\/images\/agi1-live-2d\.webp" alt="" width="280" height="412" loading="lazy"/);
  assert.match(pg, /<div class="pg-cam-view" data-cam-view><\/div>/, 'src/stage/stage.js moves the canvas in here');
  assert.match(pg, /<span class="pg-cam-tag mono" aria-hidden="true"><i class="dot"><\/i><span data-cam-state>live<\/span><\/span>/);
  assert.ok(pg.indexOf('data-cam ') < pg.indexOf('data-log'), 'the live view comes first (on phones it sits above the conversation)');
  for (const f of ['agi1-live-2d.webp', 'agi1-live.webp']) assert.ok(existsSync(new URL(`../public/images/${f}`, import.meta.url)), `${f}: the still pictures exist`);
  assert.match(html, /<canvas id="stage" aria-label="AGI-1, in 2D\. Tap to say hi\."><\/canvas>/, 'one canvas, on the stage');
  assert.equal(html.match(/<canvas/g).length, 1, 'no second 3D view (the one canvas moves)');
});

test('voice chat (2026-09-25): mic and Call buttons wait for the browser, the mic is allowed only for our own pages', () => {
  const pg = part('<section class="section" id="playground"', '<section class="section" id="checker"');
  assert.match(pg, /<button class="icon-btn pg-mic" type="button" data-mic aria-pressed="false" aria-label="Talk: say your message out loud" title="Talk" hidden>/,
    'hidden until src/chat/listen.js knows the browser can listen');
  assert.match(pg, /<button class="pg-call" type="button" data-call aria-pressed="false" aria-label="Call her: talk out loud, hands-free" hidden>/);
  assert.ok(pg.indexOf('data-mic') < pg.indexOf('data-send'), 'the mic sits before Send');
  const foot = part('<footer class="foot"', '</footer>');
  assert.ok(foot.includes("your browser's own speech service turns your voice into text"), 'the safety note says who listens');
  assert.ok(foot.includes('we never record or receive your voice, only the text'));
  const cfg = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const policy = cfg.headers.flatMap((r) => r.headers).find((h) => h.key === 'Permissions-Policy').value;
  assert.equal(policy, 'camera=(), microphone=(self), geolocation=()', 'the mic for our own pages only (not Turnstile\'s frame); no camera, no location');
});

test('out of messages (2026-09-25): the levels panel and the safety note say what more $AGI does, with the risk', () => {
  const how = part('<details class="rel-how"', '</details>');
  assert.match(how, /More \$AGI means more messages a day, but it's a meme token that can lose all of its value: not financial advice, so only spend what you can afford to lose\./);
  assert.doesNotMatch(how, /not a reason to buy anything/, 'the old wording would contradict her out-of-messages line');
  const foot = part('<footer class="foot"', '</footer>');
  assert.ok(foot.includes('Holding $AGI unlocks closer levels with AGI-1 (more messages a day), and she mentions that when you run out of messages.'));
  assert.ok(foot.includes('Only spend what you can afford to lose.'));
});

test('market moments (2026-09-25): the safety note says her market feelings are a mood, not a signal', () => {
  const foot = part('<footer class="foot"', '</footer>');
  assert.ok(foot.includes('She also has feelings about the live chart (happy at each new $200K of market cap, sad after a -20% day): a mood, not a signal to buy or sell.'));
});

test('ClankChecker (2026-09-26; "Risk check your coins on clank" since 2026-09-28): its warnings, its link in both menus, her live view slot, and the safety note', () => {
  const chk = part('<section class="section" id="checker"', '</section>\n    </main>');
  assert.match(chk, /<p class="kicker chk-kicker"><span>Risk check your coins on clank<\/span><\/p>/, 'its name, the owner\'s words (2026-09-28; the $CLANKCAP credit line is gone)');
  assert.ok(html.indexOf('id="playground"') < html.indexOf('id="checker"') && html.indexOf('id="checker"') < html.indexOf('id="safety"'), 'right after the Playground: the Arena\'s old place');
  assert.doesNotMatch(html, />ClankChecker</, 'the old name is gone from what visitors read');
  assert.doesNotMatch(html, /clankcap/i, 'nothing about $CLANKCAP anywhere on the page (the owner, 2026-09-28)');
  assert.match(chk, /Rough automated checks of public data, not an audit, and never financial advice\./, 'the lede says what it is');
  assert.match(chk, /A scan is not an endorsement or financial advice: check any coin yourself\./);
  assert.match(chk, /Not an audit and not financial advice: lower risk isn't no risk, and any meme coin can go to zero\./, 'under every answer');
  assert.match(chk, /Lower risk isn't no risk: the scan can't read a coin's code/, 'how it works says what it can\'t see');
  assert.doesNotMatch(chk, /\bsafe\b|Buy on clank\.trade/i, 'never "safe", no Buy link (only "View on clank.trade")');
  assert.match(chk, /<a class="chip-btn" data-chk-clank href="https:\/\/clank\.trade\/" target="_blank" rel="noopener noreferrer">View on clank\.trade/);
  // her live view: the same one canvas moves in (src/stage/stage.js), a still picture until then, after the 18+ check
  assert.match(chk, /<div class="chk-cam" data-live-cam="checker" data-cam-quiet data-cam-label="[^"]+" hidden>/);
  assert.match(chk, /<img class="chk-cam-still" src="\/images\/agi1-live-2d\.webp" alt="" width="280" height="412" loading="lazy"/, 'her 2D picture first (2026-10-01)');
  assert.match(chk, /<div class="chk-cam-view" data-cam-view><\/div>/);
  assert.match(chk, /confirm you're <b>18 or older<\/b>/, 'her answer after the 18+ check');
  // round 2 (the owner, 2026-09-26): live, pictures (big in a native dialog), every coin
  assert.match(chk, /<button class="chk-filter is-on" type="button" data-chk-filter="newest" aria-pressed="true">Newest<\/button>/, 'newest first by default');
  for (const f of ['trending', 'graduated', 'biggest']) assert.match(chk, new RegExp(`data-chk-filter="${f}" aria-pressed="false"`));
  assert.match(chk, /<button class="chk-refresh" type="button" data-chk-refresh hidden>/);
  assert.match(chk, /<p class="sr-only" data-chk-announce role="status" aria-live="polite"><\/p>/, 'new launches are announced once, politely');
  assert.match(chk, /a coin launched a moment ago shows up here within seconds/);
  assert.match(chk, /<dialog class="chk-zoom" data-chk-zoom aria-labelledby="chk-zoom-title">/);
  assert.match(chk, /<button class="chk-zoom-x" type="button" data-chk-zoom-close aria-label="Close" autofocus>/);
  assert.match(chk, /its picture stays blurred until you confirm you're <b>18 or older<\/b>/);
  assert.match(chk, /Every coin, name and picture comes from clank\.trade, as its creator made it, not from us \(slurs are masked, and pictures of coins with crude names stay blurred until you confirm you're 18 or older\)\./);
  assert.doesNotMatch(chk, /left out of the list|not PG-13/, 'every coin is listed now');
  assert.ok(!/<script>|style="/.test(chk), 'no inline scripts or styles');
  assert.equal((html.match(/<a href="#checker">Risk check your coins on clank<\/a>/g) || []).length, 2, 'the menu and the footer');
  const diary = readFileSync(new URL('../diary.html', import.meta.url), 'utf8');
  assert.equal((diary.match(/<a href="\/#checker">Risk check your coins on clank<\/a>/g) || []).length, 2, 'the diary page\'s menu and footer');
  const foot = part('<footer class="foot"', '</footer>');
  assert.ok(foot.includes("The risk levels in “Risk check your coins on clank” are rough automated checks of public data, not an audit: lower risk isn't no risk, and no level is a reason to buy or sell."));
  assert.ok(foot.includes("The coin scans and pictures in “Risk check your coins on clank” are read by our server from public sources (clank.trade and its picture host, Robinhood Chain, DexScreener, a block explorer); nothing about you is sent to them."));
  // how the scan works (2026-09-29, the Clank protocol): its own record, the stages, the locked pool, the chain's smaller scan
  assert.match(chk, /the Clank protocol's own record of the coin on Robinhood Chain/);
  assert.match(chk, /Its curve sold out but its pool isn't open yet \(graduations can fail\): a smaller flag\. Its graduation failed and the protocol had to rescue it: a big one\./);
  assert.match(chk, /<b>The record:<\/b> clank\.trade and the Clank protocol don't agree about the coin's curve, or the protocol says a graduation was rescued before clank\.trade shows it \(a smaller flag\)\./);
  assert.match(chk, /Good to know, not a flag: when the protocol confirms a coin graduated with it, the liquidity it put in the pool at graduation is locked for good \(nobody can pull it out, its creator included\)\. Its price can still fall\./);
  assert.match(chk, /a smaller scan comes straight from Robinhood Chain: .*never <b>Lower risk<\/b>/);
  assert.match(chk, /A coin clank\.trade hasn't listed is <b>High risk<\/b>: it's brand new, or one clank\.trade doesn't show\./);
  assert.match(chk, /If neither answers, the scan says <b>Not enough data<\/b> instead of guessing\./);
  assert.match(foot, /Last updated October 2, 2026/);   // (2026-10-02: the AGI-1 app, never a download from anyone else)
  assert.equal(html.match(/<canvas/g).length, 1, 'still one canvas for the whole page');
});
