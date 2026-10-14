// Checks the page keeps its must-have warnings (CLAUDE.md → Design → Must-haves), so a future edit
// can't quietly drop the disclaimer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

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

// 2026-10-05 (the owner: "can you add a telegram here", with its link): the $AGI community group on Telegram, next to X
test('AGI on Telegram: a round button next to X (a menu row on small phones) and a footer link, on every page with the top bar', () => {
  const TG = 'https://t.me/agi2dotapp';
  const css = readFileSync(new URL('../src/styles/layout.css', import.meta.url), 'utf8');
  for (const name of ['index.html', 'diary.html', 'launch.html', 'live.html']) {
    const page = readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
    const links = page.match(/<a [^>]*href="https:\/\/t\.me\/agi2dotapp"[^>]*>/g) || [];
    assert.equal(links.length, 3, `${name}: the top bar, the menu and the footer`);
    for (const a of links) assert.match(a, /target="_blank" rel="noopener noreferrer"/, `${name}: a new tab, without passing our page along`);
    // the top bar: right after the X button, named for screen readers, its paper plane only decoration
    const actions = page.slice(page.indexOf('<div class="topbar-actions">'), page.indexOf('</header>'));
    const button = actions.match(/<a class="icon-btn tg-btn" [^>]*>[\s\S]*?<\/a>/)?.[0] ?? '';
    assert.match(button, new RegExp(`^<a class="icon-btn tg-btn" href="${TG}" [^>]*aria-label="AGI on Telegram \\(@agi2dotapp\\)"`), `${name}: the button, named`);
    assert.match(button, /<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">/, `${name}: its icon is decoration (the label names it)`);
    const x = actions.indexOf('class="icon-btn x-btn"'), tg = actions.indexOf('class="icon-btn tg-btn"'), theme = actions.indexOf('data-theme-toggle');
    assert.ok(x > 0 && tg > x && theme > tg, `${name}: X, then Telegram, then the theme button`);
    // the small-phone menu: its row right after X's
    const nav = page.slice(page.indexOf('<nav class="nav" id="site-nav"'), page.indexOf('</nav>', page.indexOf('id="site-nav"')));
    assert.match(nav, new RegExp(`<a class="nav-x" [^>]*>AGI on X ↗</a>\\s*<a class="nav-tg" href="${TG}" [^>]*>AGI on Telegram ↗</a>`), `${name}: the menu row, after X's`);
    // the footer: after X, with its handle (so people can tell the real group from a copy)
    const foot = page.slice(page.indexOf('<nav class="foot-nav"'), page.indexOf('</nav>', page.indexOf('<nav class="foot-nav"')));
    assert.match(foot, new RegExp(`X @agi1dotapp ↗</a>\\s*<a href="${TG}" [^>]*>Telegram @agi2dotapp ↗</a>`), `${name}: the footer link, after X`);
  }
  // like X: hidden in the top bar under 380 px, where its menu row shows instead
  assert.match(css, /\.topbar \.nav a\.nav-x, \.topbar \.nav a\.nav-tg { display: none; }/, 'the menu rows hidden until the small-phone menu');
  assert.match(css, /@media \(max-width: 379px\) {\n  \.topbar-actions \.x-btn, \.topbar-actions \.tg-btn { display: none; }\n  \.topbar\.menu-open \.nav a\.nav-x, \.topbar\.menu-open \.nav a\.nav-tg { display: block; }/,
    'under 380 px: the buttons go, the menu rows come');
});

// 2026-10-13 (the owner: "make it live for everyone now not only on my wallet"): AGI Studio linked from every page with the
// top bar: a row in the phone menu (the top bar's links are full) and in the footer, after Live; on this site's own address
test('AGI Studio: a menu row and a footer link on every page with the top bar, and the phone menu scrolls on a short screen', () => {
  const css = readFileSync(new URL('../src/styles/layout.css', import.meta.url), 'utf8');
  for (const name of ['index.html', 'diary.html', 'launch.html', 'live.html']) {
    const page = readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
    const nav = page.slice(page.indexOf('<nav class="nav" id="site-nav"'), page.indexOf('</nav>', page.indexOf('id="site-nav"')));
    assert.match(nav, /<a class="nav-phone" href="\/live"( aria-current="page")?>Live<\/a>\s*<a class="nav-phone" href="\/studio">AGI Studio<\/a>/, `${name}: the menu row, after Live (only in the phone menu: the top bar is full)`);
    const foot = page.slice(page.indexOf('<nav class="foot-nav"'), page.indexOf('</nav>', page.indexOf('<nav class="foot-nav"')));
    assert.match(foot, /<a href="\/live">Live<\/a>\s*<a href="\/studio">AGI Studio<\/a>/, `${name}: the footer link, after Live`);
  }
  const menu = css.slice(css.indexOf('@media (max-width: 960px)'));
  assert.match(menu, /max-height: calc\(100dvh - 64px\); overflow-y: auto;/, 'a short phone scrolls the menu instead of losing its last rows past the screen');
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
  assert.equal(policy, 'camera=(), microphone=(self), geolocation=(), display-capture=(self)', 'the mic and (2026-10-02, "Show her") sharing a window, for our own pages only (not Turnstile\'s frame); no camera (AGI Studio\'s live selfie came and went on 2026-10-10), no location');
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
  // (2026-10-05: the coins' pictures come from public IPFS gateways, clank.trade's own gateway only answers its own pages)
  assert.ok(foot.includes("The coin scans and pictures in “Risk check your coins on clank” are read by our server from public sources (clank.trade, public IPFS gateways for the coins' pictures, Robinhood Chain, DexScreener, a block explorer); nothing about you is sent to them."));
  // how the scan works (2026-09-29, the Clank protocol): its own record, the stages, the locked pool, the chain's smaller scan
  assert.match(chk, /the Clank protocol's own record of the coin on Robinhood Chain/);
  assert.match(chk, /Its curve sold out but its pool isn't open yet \(graduations can fail\): a smaller flag\. Its graduation failed and the protocol had to rescue it: a big one\./);
  assert.match(chk, /<b>The record:<\/b> clank\.trade and the Clank protocol don't agree about the coin's curve, or the protocol says a graduation was rescued before clank\.trade shows it \(a smaller flag\)\./);
  assert.match(chk, /Good to know, not a flag: when the protocol confirms a coin graduated with it, the liquidity it put in the pool at graduation is locked for good \(nobody can pull it out, its creator included\)\. Its price can still fall\./);
  assert.match(chk, /a smaller scan comes straight from Robinhood Chain: .*never <b>Lower risk<\/b>/);
  assert.match(chk, /A coin clank\.trade hasn't listed is <b>High risk<\/b>: it's brand new, or one clank\.trade doesn't show\./);
  assert.match(chk, /If neither answers, the scan says <b>Not enough data<\/b> instead of guessing\./);
  assert.match(foot, /Last updated October 12, 2026/);   // (2026-10-12: AGI Studio's own gift links of free credits; 2026-10-11: AGI Studio's clank.trade names and AI captions, then its gifts of credits and invites; 2026-10-10: her 💜 badge for Crush and Soulmate questions on her show, and AGI-1's 3D character studio; 2026-10-09: her quizzes, and her Telegram name with a /live question; 2026-10-07: questions from X's chat on her show; 2026-10-06: her buy alerts; 2026-10-05: the risk check's pictures)
  assert.equal(html.match(/<canvas/g).length, 1, 'still one canvas for the whole page');
});

// ---------- The roadmap (2026-10-14) ----------
// The owner: "when they go to agi1.app/roadmap they will see a roadmap. Talk to daria, agi studio is already checked and done,
// all below they will see, make the roadmap page cool and beautiful … and also they can visit this now but everything is
// coming soon for now", then /stake, /games, /giveaway and "/18+ ?". The owner's choices: a mystery card for 18+ (locked, no
// details, no page) and the owner's words with the safety lines (coming soon, not financial advice, 18+ only where it's
// legal, no rates or amounts). "Talk to daria" is "Talk to AGI-1" (the site's name for her since 2026-09-28)
const ROADMAP = ['roadmap', 'stake', 'games', 'giveaway'];
const SOON = { stake: 'Stake $AGI', games: 'AGI games', giveaway: 'Giveaways' };
const readPage = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const between = (s, start, end) => { const from = s.indexOf(start); assert.ok(from >= 0, `has ${start}`); return s.slice(from, s.indexOf(end, from) + end.length); };
const mainOf = (page) => between(page, '<main id="main">', '</main>');
const textOf = (h) => h.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

// a stylesheet's rules, with the at-rule each is in (a @keyframes' own steps left out)
function cssRules(source) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const walk = (from, to, at) => {
    let i = from;
    while (i < to) {
      const open = css.indexOf('{', i);
      if (open < 0 || open >= to) break;
      let depth = 1, close = open + 1;
      for (; close < to && depth; close++) { if (css[close] === '{') depth++; else if (css[close] === '}') depth--; }
      const head = css.slice(i, open).trim();
      if (/^@(media|supports|container|layer)\b/.test(head)) walk(open + 1, close - 1, head);
      else if (!head.startsWith('@')) out.push({ at, head, body: css.slice(open + 1, close - 1) });
      i = close;
    }
  };
  walk(0, css.length, '');
  return out;
}
const selectorsOf = (head) => {
  const out = []; let depth = 0, cur = '';
  for (const ch of head) {
    if (ch === '(') depth++; else if (ch === ')') depth--;
    if (ch === ',' && !depth) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
};

test('the roadmap: four pages at their own addresses, built and previewed, with no inline code', () => {
  for (const f of ['src/roadmap/page.js', 'src/styles/roadmap.css', ...ROADMAP.map((p) => `${p}.html`)]) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `${f} exists`);
  assert.match(readPage('vite.config.js'), /roadmap: 'roadmap\.html', stake: 'stake\.html', games: 'games\.html', giveaway: 'giveaway\.html'/, 'the build makes all four');
  assert.match(readPage('scripts/share-pages.js'), /'dist\/roadmap\.html', 'dist\/stake\.html',\s+'dist\/games\.html', 'dist\/giveaway\.html'/, 'their link previews get the site\'s address');
  assert.equal(JSON.parse(readPage('vercel.json')).cleanUrls, true, '/roadmap serves roadmap.html (and /stake, /games, /giveaway theirs)');
  for (const p of ROADMAP) {
    const page = readPage(`${p}.html`);
    assert.match(page, new RegExp(`<html lang="en" data-page="${p}">`), `${p}: its own page key (/theme.js: its browser bar)`);
    assert.match(page, /<script src="\/theme\.js\?v=7"><\/script>/, `${p}: the page's look before it paints`);
    assert.match(page, new RegExp(`<link rel="canonical" href="__SITE__/${p}" />`), p);
    assert.match(page, new RegExp(`<meta property="og:url" content="__SITE__/${p}" />`), p);
    assert.ok(page.includes('<meta property="og:image" content="__SITE__/cards/roadmap.jpg" />'), `${p}: the roadmap's own link preview (tools/roadmap-promo, --cards)`);
    assert.match(page, /<meta property="og:image:alt" content="AGI-1 next to the words The AGI roadmap[^"]*" \/>/, `${p}: its preview's words for screen readers`);
    for (const re of [/<meta name="description" content="([^"]+)"/, /<meta property="og:description" content="([^"]+)"/]) assert.match(page.match(re)[1], /not financial advice/i, `${p}: its preview says so`);
    assert.match(page, /<script type="module" src="\/src\/roadmap\/page\.js"><\/script>/, `${p}: one script for all four`);
    assert.equal((page.match(/<script\b/g) || []).length, 2, `${p}: /theme.js and its module, nothing inline (the CSP)`);
    assert.doesNotMatch(page, /style="/, `${p}: no inline styles (the CSP)`);
    for (const a of page.match(/<a [^>]*target="_blank"[^>]*>/g)) assert.match(a, /rel="noopener noreferrer"/, `${p}: ${a}`);
    assert.doesNotMatch(page, /daria/i, `${p}: AGI-1, never her old name`);
    assert.match(page, /<p><b>The only serious part of this page\.<\/b>[^<]*Nothing here is financial advice or a promise of profit\./, `${p}: the short safety paragraph`);
  }
});

test('the roadmap: AGI-1 and AGI Studio live, staking, games and giveaways coming soon, and the 18+ card locked', () => {
  const main = mainOf(readPage('roadmap.html'));
  assert.match(main, /<h1 class="rm-title" id="rm-title">The AGI roadmap<\/h1>/);
  assert.match(main, /<div class="rm-meter" role="img" aria-label="2 of 6 live now, 4 coming soon">/, 'the meter, said in words');
  const segs = between(main, '<div class="rm-segs"', '</div>');
  assert.deepEqual(segs.match(/class="rm-seg(?: [^"]*)?"/g), ['class="rm-seg is-done"', 'class="rm-seg is-done"', 'class="rm-seg"', 'class="rm-seg"', 'class="rm-seg"', 'class="rm-seg is-lock"']);
  // the steps in order: the owner's two done ones, the three to come, the mystery card last
  assert.deepEqual([...main.matchAll(/<li class="rm-item (is-done|is-soon|is-locked)"/g)].map((m) => m[1]), ['is-done', 'is-done', 'is-soon', 'is-soon', 'is-soon', 'is-locked']);
  assert.deepEqual([...main.matchAll(/<span class="rm-step mono">([^<]+)<\/span>/g)].map((m) => m[1]), [1, 2, 3, 4, 5, 6].map((n) => `Step ${n} of 6`));
  assert.deepEqual([...main.matchAll(/<h3 class="rm-name">([^<]+)<\/h3>/g)].map((m) => m[1]), ['Talk to AGI-1', 'AGI Studio', 'Stake $AGI', 'AGI games', 'Giveaways'], '"Talk to daria" is AGI-1 here');
  assert.deepEqual([...main.matchAll(/<a class="rm-go" href="([^"]+)"/g)].map((m) => m[1]), ['/#playground', '/studio', '/stake', '/games', '/giveaway'], 'each live one opens, each coming one its page');
  assert.match(main, /<ol class="rm-list rm-list-soon" start="3">/, 'screen readers count on from 3');
  assert.deepEqual([...main.matchAll(/<p class="rm-status"><span class="rm-status-dot" aria-hidden="true"><\/span>([^<]+)<\/p>/g)].map((m) => m[1]), ['Live', 'Live', 'Coming soon', 'Coming soon', 'Coming soon', 'Locked']);
  // the owner's words, and the safety lines under each coming one
  const text = textOf(main);
  for (const words of ['Stake your $AGI and get rewards. Choose how: in USDG only, in $AGI only, or free AI with sAGI.',
    'Earn $AGI while you play. A lot of types of games, casino-style ones included.', 'Win giveaways by creating viral content for AGI.']) assert.ok(text.includes(words), words);
  assert.deepEqual([...main.matchAll(/<p class="rm-meta">([^<]+)<\/p>/g)].map((m) => m[1]).slice(2), ['coming soon · not financial advice · 18+, only where it\'s legal',
    'coming soon · not financial advice · 18+, only where it\'s legal', 'coming soon · not financial advice · 18+', 'coming soon']);
  // the mystery card (the owner's choice): 18+, nothing else said, no link and no page
  const locked = between(main, '<li class="rm-item is-locked"', '</li>');
  assert.doesNotMatch(locked, /<a\b/, 'nothing to open');
  assert.match(locked, /<h3 class="rm-name rm-name-locked"><span class="rm-adult">18\+<\/span><span class="rm-q" aria-hidden="true">\?\?\?<\/span><span class="sr-only">: a secret for now<\/span><\/h3>/);
  assert.match(textOf(locked), /Locked\. No details yet\./);
  assert.doesNotMatch(readPage('vite.config.js'), /adult|18\.html|secret/i, 'no page behind it');
  // what the fine print promises
  const fine = textOf(between(main, '<section class="rm-fine"', '</section>'));
  for (const words of ['no dates are promised', 'this page never asks your wallet for anything', 'Anyone asking you to stake, send $AGI or claim a prize now isn\'t us.',
    'never guaranteed and never an investment', 'Not financial advice: $AGI is a meme token and can lose all of its value.', 'are 18+, and only where they\'re legal where you live']) assert.ok(fine.includes(words), words);
});

test('the coming-soon pages: the owner\'s words with the safety lines, no rates or amounts, nothing to stake, play or win yet', () => {
  const words = {
    stake: ['Stake your $AGI, get rewards.', 'in USDG only, in $AGI only, or free AI with sAGI', 'In USDG only', 'In $AGI only', 'Free AI with sAGI', '18+, and only where staking is legal where you live.'],
    games: ['Earn $AGI while you play.', 'A lot of types of games, casino-style ones included.', 'Casino-style games', 'Casino-style games are 18+ and only where they\'re legal where you live.', 'never with more than you can afford to lose'],
    giveaway: ['Create viral content for AGI. Win giveaways.', 'Create', 'Post', 'Win', '18+, and only where it\'s legal where you live.', 'Say what\'s AI-made when you post it'],
  };
  for (const [p, title] of Object.entries(SOON)) {
    const main = mainOf(readPage(`${p}.html`)), text = textOf(main);
    assert.match(main, new RegExp(`<h1 class="rm-title" id="rm-title">${title.replace('$', '\\$')}</h1>`), p);
    assert.ok(main.indexOf('<a href="/roadmap"><span aria-hidden="true">← </span>The roadmap</a>') < main.indexOf('<h1'), `${p}: the way back first`);
    assert.match(main, /<a class="btn btn-ghost btn-sm" href="\/roadmap">The roadmap<\/a>/, `${p}: and under what's coming`);
    assert.equal((main.match(/<p class="rm-status is-soon">/g) || []).length, 2, `${p}: "Coming soon" at the top and over "Not open yet"`);
    assert.equal((main.match(/<li class="rm-feat rm-rv" data-rm-reveal>/g) || []).length, 3, `${p}: three cards`);
    assert.match(main, /<h2 class="rm-soon-title">Not open yet<\/h2>/);
    assert.match(main, /<textPath href="#rm-ring"[^>]*>COMING SOON · /, `${p}: its stamp says it`);
    for (const w of words[p]) assert.ok(text.includes(w), `${p}: ${w}`);
    assert.match(text, /not financial advice/i, p);
    assert.match(text, /(is not us|isn't us)/, `${p}: what a scam would ask, said as one`);
  }
  // all four: no rates, amounts or yields; "guaranteed" and "investment" only ever as nevers; never "buy"; and nothing to press
  for (const p of ROADMAP) {
    const main = mainOf(readPage(`${p}.html`)), text = textOf(main);
    assert.doesNotMatch(text, /%|\bAPY\b|\bAPR\b|\byield/i, `${p}: no rates`);
    assert.doesNotMatch(text, /\$\s?\d|\d[\d,.]*\s*(USDG|\$AGI)\b/, `${p}: no amounts`);
    for (const m of text.matchAll(/guarantee\w*/gi)) assert.match(text.slice(Math.max(0, m.index - 10), m.index), /never $/, `${p}: "${m[0]}" only as never`);
    for (const m of text.matchAll(/invest\w*/gi)) assert.match(text.slice(Math.max(0, m.index - 10), m.index), /(never|not) an $/, `${p}: "${m[0]}" only as never or not one`);
    assert.doesNotMatch(text, /\bbuy\b/i, `${p}: never "buy" (hard rule 8)`);
    assert.doesNotMatch(main, /<button|<form|<input|data-wallet|data-connect/, `${p}: no wallet button and no form (hard rule 9)`);
    assert.match(text, /18\+/, p);
    assert.match(text, /never asks your wallet for anything/, `${p}: it says so`);
  }
});

test('the roadmap: linked from every page with the top bar, after AGI Studio; the same top bar and footer as the others', () => {
  for (const name of ['index.html', 'diary.html', 'launch.html', 'live.html']) {
    const page = readPage(name);
    assert.match(page, /<a class="nav-phone" href="\/studio">AGI Studio<\/a>\s*<a class="nav-phone" href="\/roadmap">Roadmap<\/a>/, `${name}: its menu row, after AGI Studio`);
    assert.match(between(page, '<nav class="foot-nav"', '</nav>'), /<a href="\/studio">AGI Studio<\/a>\s*<a href="\/roadmap">Roadmap<\/a>/, `${name}: its footer link`);
  }
  const strip = (s) => s.replace(/ aria-current="page"/g, '');
  const live = readPage('live.html');
  for (const p of ROADMAP) {
    const page = readPage(`${p}.html`);
    assert.equal(strip(between(page, '<header class="topbar">', '</header>')), strip(between(live, '<header class="topbar">', '</header>')), `${p}: the site's own top bar`);
    assert.equal(strip(between(page, '<footer class="foot">', '</footer>')), strip(between(live, '<footer class="foot">', '</footer>')), `${p}: and footer`);
    const current = (page.match(/<a [^>]*aria-current="page"[^>]*>[^<]*<\/a>/g) || []);
    assert.deepEqual(current, p === 'roadmap' ? ['<a class="nav-phone" href="/roadmap" aria-current="page">Roadmap</a>', '<a href="/roadmap" aria-current="page">Roadmap</a>'] : [], `${p}: the current page marked only on the roadmap`);
  }
});

test('the roadmap\'s look: every rule names an rm- class; Pop mode\'s are scoped, its heroes violet like the browser bar; "reduce motion"', () => {
  const css = readPage('src/styles/roadmap.css');
  const all = cssRules(css);
  assert.ok(all.length > 150, `${all.length} rules`);
  const loose = all.flatMap(({ at, head }) => selectorsOf(head).filter((s) => !s.includes('.rm-')).map((s) => `${at} ${s}`.trim()));
  assert.deepEqual(loose, [], 'every rule names an rm- class, so no other page changes');
  // hidden only while waiting to come in (is-pending, set by src/roadmap/page.js): never 0 (browsers time the main content),
  // so without the script everything is simply there
  for (const { head, body } of all) {
    if (/opacity:\s*0?\.01/.test(body)) assert.match(head, /is-pending/, `${head}: hidden only while it waits`);
    assert.doesNotMatch(body, /opacity:\s*0\s*[;}]|opacity:\s*0$/, `${head}: never fully see-through`);
  }
  const still = all.filter(({ at }) => at === '@media (prefers-reduced-motion: reduce)').map(({ head }) => head).join(', ');
  for (const s of ['.rm-hero-text > *', '.rm-meter', '.rm-art', '.rm-seg', '.rm-stamp', '.rm-here-dot::after', '.rm-redact span', '.rm-here::before',
    '.rm-list-soon .rm-item::before', '.rm-item.is-soon .rm-status-dot']) assert.ok(still.includes(s), `"reduce motion" stops ${s}`);
  // Pop mode: every rm- rule under [data-skin='pop'] (tests/pop.test.js checks the whole file), its heroes violet like the
  // phone's browser bar there (/theme.js: these pages aren't the diary's kind, so the violet one)
  const pop = cssRules(readPage('src/styles/pop.css')).filter(({ head }) => head.includes('.rm-'));
  assert.ok(pop.length > 60, `${pop.length} Pop mode rules`);
  for (const { at, head } of pop) for (const s of selectorsOf(head)) assert.match(s, /^\[data-skin='pop'\]/, `${at} ${s}`);
  assert.match(pop.find(({ head }) => head === "[data-skin='pop'] .rm-hero").body, /background: var\(--pop-violet\)/);
  assert.match(pop.find(({ head }) => head === "[data-skin='pop'][data-theme='dark'] .rm-hero").body, /background: #2a0f7a/);
  // under Pop mode's floating top bar, and its band once the hero is gone (src/menu.js)
  assert.match(pop.find(({ head }) => head === "[data-skin='pop'] .rm-hero").body, /margin-top: -72px; padding-top: calc\(72px \+/);
  assert.match(readPage('src/menu.js'), /document\.querySelector\('\.lp-hero, \.hero, \.rm-hero'\)/);
  // found by the browser check (2026-10-14): one long word ("Giveaways") fits a 320 px phone in Pop mode; "Step n of 6" stays
  // on one line (under its status when there's no room beside it); Pop light's live numbers stand out from the lavender
  // (violet, 4.2:1; honey was 1.1:1), honey on Pop dark
  const rule = (h) => all.find(({ head }) => head === h)?.body || '';
  const popRule = (h) => pop.find(({ head }) => head === h)?.body || '';
  assert.match(popRule("[data-skin='pop'] .rm-hero-sub .rm-title"), /font-size: clamp\(min\(44px, 12\.4vw\), 8\.4vw, 112px\)/);
  assert.match(rule('.rm-card-top'), /flex-wrap: wrap;.*min-height: 28px/);
  assert.match(rule('.rm-step'), /line-height: 28px;.*white-space: nowrap/);
  assert.match(popRule("[data-skin='pop'] .rm-item.is-done .rm-num"), /color: var\(--pop-violet\)/);
  assert.match(popRule("[data-skin='pop'][data-theme='dark'] .rm-item.is-done .rm-num"), /color: var\(--pop-honey\)/);
  // the stamps' words, in Geist Mono (every letter 0.6em wide, plus its letter-spacing), never longer than their textLength,
  // so it only ever spreads them a little (never squeezes them together); and that never past their ring (2π × 78 px)
  assert.match(rule('.rm-stamp-text'), /font-family: var\(--mono\); font-size: 13px; letter-spacing: \.1em/);
  for (const p of ['stake', 'games', 'giveaway']) {
    const [, d, len, words] = readPage(`${p}.html`).match(/<path id="rm-ring" d="([^"]+)"\/>[\s\S]*?<textPath href="#rm-ring" textLength="(\d+)" lengthAdjust="spacing">([^<]+)<\/textPath>/);
    assert.equal(d, 'M100 100m-78 0a78 78 0 1 1 156 0a78 78 0 1 1-156 0', `${p}: its ring`);
    const natural = [...words.trim()].length * 13 * (0.6 + 0.1);
    assert.ok(natural <= Number(len) && Number(len) <= 2 * Math.PI * 78, `${p}: its stamp's words ${natural.toFixed(1)} px, spread to ${len} on a ${(2 * Math.PI * 78).toFixed(1)} px ring`);
  }
});

test('the roadmap\'s script: the theme, the menu and the cards coming in, nothing else; never with "reduce motion"', () => {
  const src = readPage('src/roadmap/page.js');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.deepEqual([...code.matchAll(/^import ([^;]+);/gm)].map((m) => m[1]), ["'../styles/tokens.css'", "'../styles/base.css'", "'../styles/layout.css'",
    "'../styles/sections.css'", "'../styles/footer.css'", "'../styles/diary.css'", "'../styles/roadmap.css'", "'../styles/pop.css'",
    "{ startTheme } from '../theme.js'", "{ startMenu } from '../menu.js'"]);
  assert.doesNotMatch(code, /wallet|ethereum|eth_|personal_sign|fetch\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|import\(|innerHTML/, 'nothing sent, kept or asked of a wallet');
  assert.match(code, /if \(matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches\) return;/, 'still with "reduce motion"');
  assert.match(code, /typeof IntersectionObserver !== 'function'\) return;/, 'everything simply there without IntersectionObserver');
  assert.match(code, /getBoundingClientRect\(\)\.top > fold/, 'only what\'s below the first screen waits (what\'s on screen would flash)');
  assert.match(code, /node\.style\.setProperty\('--rm-delay'/, 'its delay through the CSS object model (the CSP allows no style attributes)');
  assert.doesNotMatch(code, /\.style\.(?!setProperty)|setAttribute\('style'/, 'no other style');
});

// /theme.js in a sandbox (as in tests/pop.test.js): the phone's browser bar on the roadmap's pages
function barOf(page, skin, theme) {
  const attrs = { 'data-page': page };
  const meta = { content: '#fafaf8', setAttribute(k, v) { this[k] = v; } };
  const root = { setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: (k) => attrs[k] ?? null, classList: { add() {}, remove() {}, contains: () => false } };
  vm.runInNewContext(readPage('public/theme.js'), {
    localStorage: { getItem: (k) => ({ 'dr-skin': skin, 'dr-theme': theme })[k] ?? null },
    location: { pathname: `/${page}`, search: '', hash: '' }, window: {}, setTimeout() {}, sessionStorage: { getItem: () => '1' },
    document: { documentElement: root, querySelector: (s) => (s === 'meta[name="theme-color"]' ? meta : null) },
  });
  return meta.content;
}

test('the roadmap\'s pages: the phone\'s browser bar is Pop mode\'s violet hero (the lab look: the page), from the first paint', () => {
  for (const p of ROADMAP) {
    assert.equal(barOf(p, 'pop', 'light'), '#6b3bff', `${p}: Pop mode, light`);
    assert.equal(barOf(p, 'pop', 'dark'), '#2a0f7a', `${p}: Pop mode, dark`);
    assert.equal(barOf(p, null, null), '#2a0f7a', `${p}: the defaults (Pop mode, dark)`);
    assert.equal(barOf(p, 'lab', 'light'), '#fafaf8', `${p}: the lab look, light`);
    assert.equal(barOf(p, 'lab', 'dark'), '#0b0b0c', `${p}: the lab look, dark`);
  }
  // src/theme.js says the same once the page runs (only the diary's kind of page gets the page's own color in Pop mode)
  assert.match(readPage('src/theme.js'), /\['diary', 'launch', 'live', 'studio'\]\.includes\(root\.dataset\.page\)/);
});
