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

test('(2026-10-24) the safety note\'s "Load more": folded only by the script, every word still in the page, printed in full', () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
  const js = read('../src/sections/safety.js');
  const css = read('../src/styles/footer.css');
  assert.match(read('../src/main.js'), /startSafety\(document\.getElementById\('safety'\)\)/, 'started on the home page');
  assert.ok(js.includes('Load more') && js.includes('Show less'), 'its two labels');
  assert.match(js, /aria-expanded/, 'tells screen readers whether it is open');
  assert.match(js, /aria-controls/, 'and which note it opens');
  assert.match(js, /scrollHeight - text\.clientHeight/, 'a note that is already short gets no button');
  assert.match(css, /\.safety-item\.is-folded p \{[^}]*max-height/, 'the fold is a class the script adds');
  assert.match(css, /@media print \{[^}]*\.safety-item\.is-folded p \{[^}]*max-height: none/, 'printing shows every note in full');
  assert.ok(!html.includes('is-folded'), 'nothing is folded in the HTML itself');
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
  for (const f of ['agi1-live-2d.webp', 'agi1-live-splat.webp']) assert.ok(existsSync(new URL(`../public/images/${f}`, import.meta.url)), `${f}: the still pictures exist`);
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
  assert.match(html, /<a href="#checker">ClankChecker<\/a>/, 'navigation starts with the owner-saved compact label, without shifting after content loads');
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
  assert.equal((html.match(/<a href="#checker">ClankChecker<\/a>/g) || []).length, 2, 'the menu and the footer');
  const diary = readFileSync(new URL('../diary.html', import.meta.url), 'utf8');
  assert.equal((diary.match(/<a href="\/#checker">ClankChecker<\/a>/g) || []).length, 2, 'the diary page\'s menu and footer');
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
  assert.match(foot, /Last updated October 19, 2026/);   // (2026-10-19: AGI games' plays and reviews; 2026-10-12: AGI Studio's own gift links of free credits; 2026-10-11: AGI Studio's clank.trade names and AI captions, then its gifts of credits and invites; 2026-10-10: her 💜 badge for Crush and Soulmate questions on her show, and AGI-1's 3D character studio; 2026-10-09: her quizzes, and her Telegram name with a /live question; 2026-10-07: questions from X's chat on her show; 2026-10-06: her buy alerts; 2026-10-05: the risk check's pictures)
  assert.equal(html.match(/<canvas/g).length, 1, 'still one canvas for the whole page');
});

// ---------- The roadmap (2026-10-14) ----------
// The owner: "when they go to agi1.app/roadmap they will see a roadmap. Talk to daria, agi studio is already checked and done,
// all below they will see, make the roadmap page cool and beautiful … and also they can visit this now but everything is
// coming soon for now", then /stake, /games, /giveaway and "/18+ ?". The owner's choices: a mystery card for 18+ (locked, no
// details, no page) and the owner's words with the safety lines (coming soon, not financial advice, 18+ only where it's
// legal, no rates or amounts). "Talk to daria" is "Talk to AGI-1" (the site's name for her since 2026-09-28). Since
// 2026-10-19 /games is AGI games' own page (its tests below), so the roadmap's own pages are three
const ROADMAP = ['roadmap', 'stake', 'giveaway'];
const SOON = { stake: 'Stake $AGI', giveaway: 'Giveaways' };
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

test('the roadmap: its pages at their own addresses (the roadmap, /stake, /giveaway), built and previewed, with no inline code', () => {
  for (const f of ['src/roadmap/page.js', 'src/styles/roadmap.css', ...ROADMAP.map((p) => `${p}.html`)]) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `${f} exists`);
  assert.match(readPage('vite.config.js'), /roadmap: 'roadmap\.html', stake: 'stake\.html', games: 'games\.html', giveaway: 'giveaway\.html'/, 'the build makes them (and AGI games\' page)');
  assert.match(readPage('scripts/share-pages.js'), /'dist\/roadmap\.html', 'dist\/stake\.html',\s+'dist\/games\.html', 'dist\/giveaway\.html'/, 'their link previews get the site\'s address');
  assert.equal(JSON.parse(readPage('vercel.json')).cleanUrls, true, '/roadmap serves roadmap.html (and /stake, /games, /giveaway theirs)');
  for (const p of ROADMAP) {
    const page = readPage(`${p}.html`);
    assert.match(page, new RegExp(`<html lang="en" data-page="${p}">`), `${p}: its own page key (/theme.js: its browser bar)`);
    assert.match(page, /<script src="\/theme\.js\?v=8"><\/script>/, `${p}: the page's look before it paints`);
    assert.match(page, new RegExp(`<link rel="canonical" href="__SITE__/${p}" />`), p);
    assert.match(page, new RegExp(`<meta property="og:url" content="__SITE__/${p}" />`), p);
    assert.ok(page.includes('<meta property="og:image" content="__SITE__/cards/roadmap.jpg" />'), `${p}: the roadmap's own link preview (tools/roadmap-promo, --cards)`);
    assert.match(page, /<meta property="og:image:alt" content="AGI-1 next to the words The AGI roadmap[^"]*" \/>/, `${p}: its preview's words for screen readers`);
    for (const re of [/<meta name="description" content="([^"]+)"/, /<meta property="og:description" content="([^"]+)"/]) assert.match(page.match(re)[1], /not financial advice/i, `${p}: its preview says so`);
    assert.match(page, /<script type="module" src="\/src\/roadmap\/page\.js"><\/script>/, `${p}: one script for all of them`);
    assert.equal((page.match(/<script\b/g) || []).length, 2, `${p}: /theme.js and its module, nothing inline (the CSP)`);
    assert.doesNotMatch(page, /style="/, `${p}: no inline styles (the CSP)`);
    for (const a of page.match(/<a [^>]*target="_blank"[^>]*>/g)) assert.match(a, /rel="noopener noreferrer"/, `${p}: ${a}`);
    assert.doesNotMatch(page, /daria/i, `${p}: AGI-1, never her old name`);
    assert.match(page, /<p><b>The only serious part of this page\.<\/b>[^<]*Nothing here is financial advice or a promise of profit\./, `${p}: the short safety paragraph`);
  }
});

test('the roadmap: ten steps, not in order: AGI-1 and AGI Studio live, three under way, four coming soon, the 18+ card locked', () => {
  // since 2026-10-19 (the owner: "add on the roadmap 5.(buyback, burns, marketing, listing) and 6. attention flywheel you the
  // one explain it to the page 7. Gamified Governance 8. AUM / and say the roadmap is not in order, we could do other things
  // first"): AGI games (its beta is out), burns and the flywheel under way, governance and AUM coming soon
  const main = mainOf(readPage('roadmap.html'));
  assert.match(main, /<h1 class="rm-title" id="rm-title">The AGI roadmap<\/h1>/);
  assert.match(main, /<div class="rm-meter" role="img" aria-label="2 of 10 live now, 3 under way, 5 coming soon">/, 'the meter, said in words');
  assert.match(main, /<span class="rm-meter-of">of 10<\/span>/);
  assert.match(main, /<p class="rm-meter-text" aria-hidden="true">live now · 3 under way · 5 coming soon<\/p>/);
  const segs = between(main, '<div class="rm-segs"', '</div>');
  assert.deepEqual(segs.match(/class="rm-seg(?: [^"]*)?"/g), ['class="rm-seg is-done"', 'class="rm-seg is-done"', 'class="rm-seg is-going"', 'class="rm-seg is-going"',
    'class="rm-seg is-going"', 'class="rm-seg"', 'class="rm-seg"', 'class="rm-seg"', 'class="rm-seg"', 'class="rm-seg is-lock"']);
  // the steps: the owner's two done ones, then the rest, the mystery card last; and as many of each as the meter says
  const states = [...main.matchAll(/<li class="rm-item (is-done|is-going|is-soon|is-locked)"/g)].map((m) => m[1]);
  assert.deepEqual(states, ['is-done', 'is-done', 'is-soon', 'is-going', 'is-going', 'is-going', 'is-soon', 'is-soon', 'is-soon', 'is-locked']);
  assert.deepEqual(['is-done', 'is-going'].map((k) => states.filter((x) => x === k).length), [2, 3], 'the meter: 2 live, 3 under way');
  assert.equal(states.filter((x) => x === 'is-soon' || x === 'is-locked').length, 5, 'and 5 coming soon (the locked one too)');
  assert.deepEqual([...main.matchAll(/<span class="rm-num" aria-hidden="true">(\d+)<\/span>/g)].map((m) => m[1]), ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']);
  assert.deepEqual([...main.matchAll(/<span class="rm-step mono">([^<]+)<\/span>/g)].map((m) => m[1]), Array.from({ length: 10 }, (_, i) => `Step ${i + 1} of 10`));
  assert.deepEqual([...main.matchAll(/<h3 class="rm-name">([^<]+)<\/h3>/g)].map((m) => m[1]), ['Talk to AGI-1', 'AGI Studio', 'Stake $AGI', 'AGI games',
    'Buybacks, burns, marketing &amp; listings', 'Attention flywheel', 'Gamified governance', 'AUM', 'Giveaways'], '"Talk to daria" is AGI-1 here');
  assert.deepEqual([...main.matchAll(/<a class="rm-go" href="([^"]+)"/g)].map((m) => m[1]), ['/#playground', '/studio', '/stake', '/games', '/#playground', '#flywheel', '/giveaway'],
    'each live one opens, AGI games its beta, the burns their live monitor, the flywheel its explanation below, each coming one with a page its page');
  assert.match(main, /<a class="rm-go" href="#flywheel">How it works<span class="sr-only">: the attention flywheel<\/span> <span class="rm-arrow" aria-hidden="true">↓<\/span><\/a>/);
  assert.match(main, /<ol class="rm-list rm-list-soon" start="3">/, 'screen readers count on from 3');
  assert.deepEqual([...main.matchAll(/<p class="rm-status"><span class="rm-status-dot" aria-hidden="true"><\/span>([^<]+)<\/p>/g)].map((m) => m[1]),
    ['Live', 'Live', 'Coming soon', 'Under way', 'Under way', 'Under way', 'Coming soon', 'Coming soon', 'Coming soon', 'Locked']);
  // not in order (the owner's): said in the hero, under "We're here" and in the fine print
  assert.match(main, /<p class="rm-lede">[^<]*The roadmap isn't in order: we might do any of these first\.<\/p>/);
  assert.match(between(main, '<div class="rm-here"', '</div>'), /<p class="rm-here-note">In no particular order: any of these could come first\.<\/p>/);
  // the owner's words, and the safety lines under each one that isn't live
  const text = textOf(main);
  for (const words of ['Stake your $AGI and get rewards. Choose how: in USDG only, in $AGI only, or free AI with sAGI.',
    'Next: earn $AGI while you play. A lot of types of games, casino-style ones included.', 'Win giveaways by creating viral content for AGI.',
    'Next: buybacks that are burned too, more marketing, and more listings', 'Help decide what AGI does next, starting with this roadmap.',
    'Vote with a free wallet signature, never a transaction', 'Assets under management: AGI-1 learns to manage a wallet, out in the open.']) assert.ok(text.includes(words), words);
  assert.deepEqual([...main.matchAll(/<p class="rm-meta">([^<]+)<\/p>/g)].map((m) => m[1]).slice(2), ['coming soon · not financial advice · 18+, only where it\'s legal',
    'beta: free, no prizes yet · earning: coming soon · not financial advice · 18+, only where it\'s legal',
    'burns: live now · buybacks and listings: coming soon · never a promise about price · not financial advice',
    'about people, not price · not financial advice', 'coming soon · a free signature, never a transaction · badges are for fun, never money',
    'coming soon · never anyone else\'s money · not advice to copy · not financial advice', 'coming soon · not financial advice · 18+', 'coming soon']);
  // buybacks (the owner's): "price" only ever as what it isn't about (hard rule 8: never "number go up")
  for (const m of text.matchAll(/price/gi)) assert.match(text.slice(Math.max(0, m.index - 32), m.index), /(never a promise about (\$AGI's )?|not (about )?)$/, `"${text.slice(Math.max(0, m.index - 32), m.index + 5)}": price only as a never`);
  assert.doesNotMatch(text, /number go up|to the moon|pump|\bmoon\b/i, 'never hype');
  // the mystery card (the owner's choice): 18+, nothing else said, no link and no page
  const locked = between(main, '<li class="rm-item is-locked"', '</li>');
  assert.doesNotMatch(locked, /<a\b/, 'nothing to open');
  assert.match(locked, /<h3 class="rm-name rm-name-locked"><span class="rm-adult">18\+<\/span><span class="rm-q" aria-hidden="true">\?\?\?<\/span><span class="sr-only">: a secret for now<\/span><\/h3>/);
  assert.match(textOf(locked), /Locked\. No details yet\./);
  assert.doesNotMatch(readPage('vite.config.js'), /adult|18\.html|secret/i, 'no page behind it');
  // what the fine print promises
  const fine = textOf(between(main, '<section class="rm-fine"', '</section>'));
  for (const words of ['The roadmap isn\'t in order: the numbers only count the steps.', 'no dates are promised', 'This page never asks your wallet for anything',
    'Anyone asking you to stake, send $AGI, pay for a “listing” or claim a prize now isn\'t us.', 'never guaranteed and never an investment',
    'burns and buybacks are never a promise about $AGI\'s price', 'Not financial advice: $AGI is a meme token and can lose all of its value.',
    'AUM would only ever be AGI\'s own wallet: it never takes anyone\'s money, pays nothing out, and is never advice to copy.',
    'are 18+, and only where they\'re legal where you live']) assert.ok(fine.includes(words), words);
});

test('the roadmap: step 06, the attention flywheel, explained under the timeline (its wheel decoration, its four turns, $AGI never about price)', () => {
  // the owner: "attention flywheel you the one explain it to the page"
  const main = mainOf(readPage('roadmap.html'));
  const fly = between(main, '<section class="rm-fly rm-rv" id="flywheel" data-rm-reveal aria-labelledby="rm-fly-title">', '</section>');
  assert.ok(main.indexOf(fly) > main.indexOf('<li class="rm-item is-locked"') && main.indexOf(fly) < main.indexOf('<div class="rm-loop'), 'after the timeline, before "Be the first to know"');
  assert.match(fly, /<h2 class="rm-fly-title" id="rm-fly-title">The attention flywheel<\/h2>/);
  assert.match(fly, /<p class="kicker rm-fly-kicker">Step 06, explained<\/p>/);
  assert.match(fly, /<div class="rm-wheel" aria-hidden="true">/, 'the wheel is decoration: the list says it all');
  assert.match(fly, /<img class="rm-wheel-hub" src="\/images\/roadmap\/agi1-hub\.webp" alt="" width="240" height="240" loading="lazy" \/>/);
  assert.deepEqual([...fly.matchAll(/<g class="rm-wheel-node is-(\d)" transform="translate\(([\d.]+) ([\d.]+)\)"><circle r="27"\/><text>(\d)<\/text><\/g>/g)].map((m) => m.slice(1).join(' ')),
    ['1 200 50 1', '2 350 200 2', '3 200 350 3', '4 50 200 4'], 'its four turns round the ring, clockwise from the top');
  assert.deepEqual([...fly.matchAll(/<li class="rm-fly-item is-(\d)"><span class="rm-fly-n" aria-hidden="true">(\d)<\/span><div><h3 class="rm-fly-name">([^<]+)<\/h3>/g)].map((m) => `${m[1]}${m[2]} ${m[3]}`),
    ['11 People find AGI-1', '22 They make and play', '33 They share it', '44 More people find AGI-1'], 'and its list, in the same order');
  const words = textOf(fly);
  for (const w of ['A flywheel is a heavy wheel: hard to start, then every push keeps it spinning', 'download with its “Made with AGI Studio” mark',
    'It\'s about people using AGI, not about price: nothing here is a promise about what $AGI will do. Not financial advice.']) assert.ok(words.includes(w), w);
  assert.doesNotMatch(words, /\bbuy\b|%|\bAPY\b|\bprofits?\b|\bgains?\b/i, 'never a reason to buy');
  // its hub: AGI-1's 2D art (the front's cutout), never the 3D model; a real 240 × 240 WebP, small
  const hub = readFileSync(new URL('../public/images/roadmap/agi1-hub.webp', import.meta.url));
  assert.equal(hub.subarray(0, 4).toString('latin1') + hub.subarray(8, 12).toString('latin1'), 'RIFFWEBP');
  assert.ok(hub.length < 30_000, `${hub.length} bytes`);
  // its look: the wheel's ring flows, its turns light up in turn (a 12 s loop), still with "reduce motion"; #flywheel lands below the top bar
  const css = readPage('src/styles/roadmap.css');
  const rules = cssRules(css);
  const body = (h) => rules.find(({ head }) => head === h)?.body || '';
  assert.match(body('.rm-fly'), /scroll-margin-top: 96px/);
  assert.match(body('.rm-wheel-flow'), /stroke-dasharray: 9\.42 14\.14; animation: rm-flow 1\.6s linear infinite/);
  assert.match(css, /@keyframes rm-flow \{ to \{ stroke-dashoffset: -23\.56; \} \}/, 'one dash and its gap a step: no jump as it loops');
  for (const [n, d] of [[2, 3], [3, 6], [4, 9]]) assert.match(body(`.rm-wheel-node.is-${n} circle, .rm-wheel-node.is-${n} text, .rm-fly-item.is-${n}, .rm-fly-item.is-${n} .rm-fly-n`), new RegExp(`animation-delay: ${d}s`));
  assert.match(body('.rm-fly-body'), /grid-template-columns: minmax\(0, 400px\) minmax\(0, 1fr\)/);
  assert.match(rules.find(({ at, head }) => at === '@media (max-width: 860px)' && head === '.rm-fly-body')?.body || '', /grid-template-columns: minmax\(0, 1fr\)/, 'one column on phones');
});

test('the coming-soon pages: the owner\'s words with the safety lines, no rates or amounts, nothing to stake, play or win yet', () => {
  const words = {
    stake: ['Stake your $AGI, get rewards.', 'in USDG only, in $AGI only, or free AI with sAGI', 'In USDG only', 'In $AGI only', 'Free AI with sAGI', '18+, and only where staking is legal where you live.'],
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
  // all of them: no rates, amounts or yields; "guaranteed" and "investment" only ever as nevers; never "buy"; and nothing to press
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

test('the roadmap: linked from every page with the top bar, after AGI Studio and AGI games; the same top bar and footer as the others', () => {
  // (Games, AGI games' page, between them since 2026-10-19)
  for (const name of ['index.html', 'diary.html', 'launch.html', 'live.html']) {
    const page = readPage(name);
    assert.match(page, /<a class="nav-phone" href="\/studio">AGI Studio<\/a>\s*<a class="nav-phone" href="\/games">Games<\/a>\s*<a class="nav-phone" href="\/roadmap">Roadmap<\/a>/, `${name}: its menu rows, after AGI Studio`);
    assert.match(between(page, '<nav class="foot-nav"', '</nav>'), /<a href="\/studio">AGI Studio<\/a>\s*<a href="\/games">Games<\/a>\s*<a href="\/roadmap">Roadmap<\/a>/, `${name}: its footer links`);
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
    '.rm-list-soon .rm-item::before', '.rm-item.is-soon .rm-status-dot', '.rm-item.is-going .rm-status-dot', '.rm-item.is-going .rm-node::after',
    '.rm-wheel-flow', '.rm-wheel-node circle', '.rm-wheel-node text', '.rm-fly-item', '.rm-fly-n']) assert.ok(still.includes(s), `"reduce motion" stops ${s}`);
  // Pop mode: every rm- rule under [data-skin='pop'] (tests/pop.test.js checks the whole file), its heroes violet like the
  // phone's browser bar there (/theme.js: these pages aren't the diary's kind, so the violet one)
  const pop = cssRules(readPage('src/styles/pop.css')).filter(({ head }) => head.includes('.rm-'));
  assert.ok(pop.length > 60, `${pop.length} Pop mode rules`);
  for (const { at, head } of pop) for (const s of selectorsOf(head)) assert.match(s, /^\[data-skin='pop'\]/, `${at} ${s}`);
  assert.match(pop.find(({ head }) => head === "[data-skin='pop'] .rm-hero").body, /background: var\(--pop-violet\)/);
  assert.match(pop.find(({ head }) => head === "[data-skin='pop'][data-theme='dark'] .rm-hero").body, /background: #2a0f7a/);
  // under Pop mode's floating top bar, and its band once the hero is gone (src/menu.js)
  assert.match(pop.find(({ head }) => head === "[data-skin='pop'] .rm-hero").body, /margin-top: -72px; padding-top: calc\(72px \+/);
  assert.match(readPage('src/menu.js'), /document\.querySelector\('\.lp-hero, \.hero, \.rm-hero, \.gm-hero'\)/);
  // found by the browser check (2026-10-14): one long word ("Giveaways") fits a 320 px phone in Pop mode; "Step n of 10" stays
  // on one line (under its status when there's no room beside it); Pop light's live numbers stand out from the lavender
  // (violet, 4.2:1; honey was 1.1:1), honey on Pop dark
  const rule = (h) => all.find(({ head }) => head === h)?.body || '';
  const popRule = (h) => pop.find(({ head }) => head === h)?.body || '';
  assert.match(popRule("[data-skin='pop'] .rm-hero-sub .rm-title"), /font-size: clamp\(min\(44px, 12\.4vw\), 8\.4vw, 112px\)/);
  assert.match(rule('.rm-card-top'), /flex-wrap: wrap;.*min-height: 28px/);
  assert.match(rule('.rm-step'), /line-height: 28px;.*white-space: nowrap/);
  assert.match(popRule("[data-skin='pop'] .rm-item.is-done .rm-num"), /color: var\(--pop-violet\)/);
  assert.match(popRule("[data-skin='pop'][data-theme='dark'] .rm-item.is-done .rm-num"), /color: var\(--pop-honey\)/);
  // under way (2026-10-19): its segment half filled, its status a honey sticker; Pop mode's night keeps the live and under-way
  // segments pink (its night .rm-seg came after Pop's .rm-seg.is-done, at the same weight, and took their pink)
  assert.match(rule('.rm-seg.is-going'), /linear-gradient\(90deg, var\(--accent\) 0 50%/);
  assert.match(popRule("[data-skin='pop'] .rm-seg.is-going"), /linear-gradient\(90deg, var\(--pop-pink\) 0 50%, #fff 50%\)/);
  assert.match(popRule("[data-skin='pop'][data-theme='dark'] .rm-seg.is-done"), /background: var\(--pop-pink\)/);
  assert.match(popRule("[data-skin='pop'][data-theme='dark'] .rm-seg.is-going"), /linear-gradient\(90deg, var\(--pop-pink\) 0 50%, #28155a 50%\)/);
  const at = (h) => pop.findIndex(({ head }) => head === h);
  assert.ok(at("[data-skin='pop'][data-theme='dark'] .rm-seg.is-done") > at("[data-skin='pop'][data-theme='dark'] .rm-seg"), 'after the night .rm-seg');
  assert.match(popRule("[data-skin='pop'] .rm-item.is-going .rm-status"), /background: var\(--pop-honey\)/);
  assert.match(popRule("[data-skin='pop'] .rm-fly"), /--rm-lit: var\(--pop-pink\);.*--rm-fly-flow: var\(--pop-violet\);.*--rm-fly-dot: var\(--pop-honey\)/s);
  assert.match(popRule("[data-skin='pop'][data-theme='dark'] .rm-fly"), /--rm-fly-flow: var\(--pop-pink\)/);
  // the stamps' words, in Geist Mono (every letter 0.6em wide, plus its letter-spacing), never longer than their textLength,
  // so it only ever spreads them a little (never squeezes them together); and that never past their ring (2π × 78 px)
  assert.match(rule('.rm-stamp-text'), /font-family: var\(--mono\); font-size: 13px; letter-spacing: \.1em/);
  for (const p of ['stake', 'giveaway']) {
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
    assert.equal(barOf(p, null, null), '#6b3bff', `${p}: the defaults (Pop mode, light, since 2026-11-02)`);
    assert.equal(barOf(p, 'lab', 'light'), '#fafaf8', `${p}: the lab look, light`);
    assert.equal(barOf(p, 'lab', 'dark'), '#0b0b0c', `${p}: the lab look, dark`);
  }
  // src/theme.js says the same once the page runs (only the diary's kind of page gets the page's own color in Pop mode)
  assert.match(readPage('src/theme.js'), /\['diary', 'launch', 'live', 'studio'\]\.includes\(root\.dataset\.page\)/);
});

// ---------- AGI games (2026-10-19) ----------
// The owner: "the word GAMES on TOP will be written as GAME beta, the word beta is overlapping on the word GAME (it still on
// beta cause theres no prizes yet) / theres also a rating stars and how many people have played it, dont need sign in a wallet
// to play it its optional", then "if they want to rate it and review and put a comment they need to sign in wallet signature
// only not transaction. but on how many times played it will still be recorded no need sign in". agi1.app/games
// (games.html, src/games/page.js, src/styles/games.css; its server: api/wallet.js and server/arcade.js, tests/arcade.test.js)
const GAMES_PAGE = () => readPage('games.html');

test('AGI games: its page at /games, its head and link preview (its own picture), no inline code, the same top bar and footer', () => {
  const page = GAMES_PAGE();
  assert.match(page, /<html lang="en" data-page="games">/, 'its own page key (/theme.js: its browser bar)');
  assert.match(page, /<title>GAME beta · AGI games<\/title>/);
  assert.match(page, /<script src="\/theme\.js\?v=8"><\/script>/, 'the page\'s look before it paints');
  assert.match(page, /<link rel="canonical" href="__SITE__\/games" \/>/);
  assert.match(page, /<meta property="og:url" content="__SITE__\/games" \/>/);
  // (2026-11-08) its own link preview since the arcade's ten games: a wall of its games (tools/cards/games-all.mjs); Ride 'Em,
  // AGI! keeps games.jpg (below)
  assert.ok(page.includes('<meta property="og:image" content="__SITE__/cards/games-all.jpg" />'), 'its own link preview (tools/cards/games-all-card.html)');
  assert.match(page, /<meta property="og:image:width" content="1200" \/>\s*<meta property="og:image:height" content="630" \/>/);
  assert.match(page, /<meta property="og:image:alt" content="A wall of AGI games being played, next to the words GAMES, 24 and Twenty-four games, one girlfriend\." \/>/, 'its preview\'s words for screen readers');
  for (const re of [/<meta name="description" content="([^"]+)"/, /<meta property="og:description" content="([^"]+)"/]) {
    const words = page.match(re)[1];
    assert.match(words, /not financial advice/i, 'its preview says so');
    assert.match(words, /no wallet needed|no wallet needed to play/i, 'playing needs no wallet');
    assert.match(words, /no prizes yet/i, 'a beta: no prizes yet');
  }
  assert.match(page.match(/<meta name="description" content="([^"]+)"/)[1], /a free signature, never a transaction/, 'rating it: a signature only');
  assert.match(page, /<script type="module" src="\/src\/games\/page\.js"><\/script>/, 'its own script');
  assert.equal((page.match(/<script\b/g) || []).length, 2, '/theme.js and its module, nothing inline (the CSP)');
  assert.doesNotMatch(page, /style="/, 'no inline styles (the CSP)');
  for (const a of page.match(/<a [^>]*target="_blank"[^>]*>/g)) assert.match(a, /rel="noopener noreferrer"/, a);
  assert.doesNotMatch(page, /daria/i, 'AGI-1, never her old name');
  assert.match(page, /<p><b>The only serious part of this page\.<\/b>[^<]*Nothing here is financial advice or a promise of profit\./, 'the short safety paragraph');
  // built, served at /games (Vercel's cleanUrls) and previewed; its game at /games/rideemagi, which shares its picture
  assert.match(readPage('vite.config.js'), /games: 'games\.html'/);
  assert.match(readPage('scripts/share-pages.js'), /'dist\/games\.html'/, 'its link preview gets the site\'s address');
  const vercel = JSON.parse(readPage('vercel.json'));
  assert.equal(vercel.cleanUrls, true, '/games serves games.html');
  assert.ok(vercel.rewrites.some((r) => r.source === '/games/rideemagi' && r.destination === '/rideemagi'), 'its game at /games/rideemagi');
  assert.ok(readPage('rideemagi.html').includes('<meta property="og:image" content="__SITE__/cards/games.jpg" />'), 'its game shares its picture');
  // (2026-10-21) its second game at /games/trenchingsimulator, with its own picture (its test below)
  assert.ok(vercel.rewrites.some((r) => r.source === '/games/trenchingsimulator' && r.destination === '/trenchingsimulator'), 'its second game at /games/trenchingsimulator');
  assert.match(page.match(/<meta property="og:description" content="([^"]+)"/)[1], /^Twenty-four free browser games with AGI-1: REAL OR AI\?, OVERCLOCK, BEAT THE AGI, MERGE TO AGI, HEARTBEAT and more\./, 'its preview names the games (since the second night of 2026-11-08: twenty-four)');
  // the site's own top bar and footer, Games marked as the page you're on (and nothing else)
  const strip = (s) => s.replace(/ aria-current="page"/g, '');
  const live = readPage('live.html');
  assert.equal(strip(between(page, '<header class="topbar">', '</header>')), strip(between(live, '<header class="topbar">', '</header>')), 'the site\'s own top bar');
  assert.equal(strip(between(page, '<footer class="foot">', '</footer>')), strip(between(live, '<footer class="foot">', '</footer>')), 'and footer');
  assert.deepEqual(page.match(/<a [^>]*aria-current="page"[^>]*>[^<]*<\/a>/g), ['<a class="nav-phone" href="/games" aria-current="page">Games</a>', '<a href="/games" aria-current="page">Games</a>']);
  // linked from every page with the top bar (a menu row and a footer link, after AGI Studio)
  for (const name of ['index.html', 'diary.html', 'launch.html', 'live.html', 'roadmap.html', 'stake.html', 'giveaway.html']) {
    const other = readPage(name);
    assert.match(other, /<a class="nav-phone" href="\/studio">AGI Studio<\/a>\s*<a class="nav-phone" href="\/games">Games<\/a>/, `${name}: its menu row`);
    assert.match(between(other, '<nav class="foot-nav"', '</nav>'), /<a href="\/studio">AGI Studio<\/a>\s*<a href="\/games">Games<\/a>/, `${name}: its footer link`);
  }
});

test('AGI games\' wall of games (its link preview since 2026-11-08): a real 1200 × 630 JPEG under 200 KB, its games\' own stills', async () => {
  const jpg = readFileSync(new URL('../public/cards/games-all.jpg', import.meta.url));
  assert.ok(jpg.length <= 200_000, `${jpg.length} bytes`);
  assert.deepEqual([...jpg.subarray(0, 3)], [0xff, 0xd8, 0xff], 'a JPEG');
  let size = null;
  for (let i = 2; i < jpg.length - 9;) {
    if (jpg[i] !== 0xff) break;
    const m = jpg[i + 1], len = jpg.readUInt16BE(i + 2);
    if (m === 0xc0 || m === 0xc2) { size = [jpg.readUInt16BE(i + 7), jpg.readUInt16BE(i + 5)]; break; }
    i += 2 + len;
  }
  assert.deepEqual(size, [1200, 630]);
  const card = readPage('tools/cards/games-all-card.html');
  const words = textOf(card.slice(card.indexOf('<body>'), card.indexOf('<script>')));
  for (const w of ['AGI games · free to play', 'GAMES', 'Twenty-four games,', 'one girlfriend.', 'No wallet needed.', 'agi1.app/games', 'Free to play · not financial advice']) assert.ok(words.includes(w), w);
  assert.match(card, /\.\.\/\.\.\/public\/images\/games\/\$\{id\}\.webp/, 'the games\' own stills (their previews)');
  assert.doesNotMatch(card, /\.glb\b|https?:\/\//, 'never the 3D model, nothing from another site');
  assert.doesNotMatch(words, /\bbuy\b|%|\$\s?\d/i, 'no price talk');
  // its count is the shelf's, and every game on its wall has its still
  const { SHELF } = await import('../src/games/shelf.js');
  assert.equal(SHELF.length, 24);
  for (const g of SHELF.slice(0, 12)) assert.ok(existsSync(new URL(`../public/images/games/${g.id}.webp`, import.meta.url)), g.id);
});

test('Ride \'Em, AGI!\'s link preview (AGI games\' own until 2026-11-08): a real 1200 × 630 JPEG under 160 KB, made from tools/cards/games-card.html (its words, its 2D key art)', () => {
  const jpg = readFileSync(new URL('../public/cards/games.jpg', import.meta.url));
  assert.ok(jpg.length <= 160_000, `${jpg.length} bytes`);
  assert.deepEqual([...jpg.subarray(0, 3)], [0xff, 0xd8, 0xff], 'a JPEG');
  let size = null;
  for (let i = 2; i < jpg.length - 9;) {
    if (jpg[i] !== 0xff) break;
    const m = jpg[i + 1], len = jpg.readUInt16BE(i + 2);
    if (m === 0xc0 || m === 0xc2) { size = [jpg.readUInt16BE(i + 7), jpg.readUInt16BE(i + 5)]; break; }
    i += 2 + len;
  }
  assert.deepEqual(size, [1200, 630]);
  const card = readPage('tools/cards/games-card.html');
  const words = textOf(card.slice(card.indexOf('<body>')));
  for (const w of ['GAME', 'beta', 'Ride ’Em, AGI!', 'Play free in your browser. No wallet needed.', 'agi1.app/games', 'Free to play · beta · not financial advice']) assert.ok(words.includes(w), w);
  assert.match(card, /src="\.\.\/\.\.\/src\/games\/rideemagi\/keyart\.webp"/, 'AGI-1 as the game\'s own 2D key art');
  assert.doesNotMatch(card, /\.glb\b|https?:\/\//, 'never the 3D model, nothing from another site');
  assert.doesNotMatch(words, /\bbuy\b|%|\$\s?\d/i, 'no price talk');
});

// The current cover follows the black/lime menu. Its sources are native HTML/SVG, rendered through CUA;
// the deployed shelf and social images stay small, complete, and explicit about play money.
const TS_COVER_WORDS = ['AGI GAMES', 'PLAY MONEY', 'SIX TERMINALS. ONE PLAYGROUND.', 'TRENCHING', 'SIMULATOR',
  'Find your edge.', 'Pomp.fun', 'Clank.trade', 'Phomo', 'Axium', 'GNGM', 'BasedBott', 'REAL PRACTICE. ZERO REAL MONEY.'];
const jpegSize = (jpg) => {
  for (let i = 2; i < jpg.length - 9;) {
    if (jpg[i] !== 0xff) break;
    const m = jpg[i + 1], len = jpg.readUInt16BE(i + 2);
    if (m === 0xc0 || m === 0xc2) return [jpg.readUInt16BE(i + 7), jpg.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  return null;
};
test('TRENCHING SIMULATOR\'s link preview: a 1200 × 630 JPEG with the current mark, chart and six terminals under its reserved size limit', () => {
  const jpg = readFileSync(new URL('../public/cards/trenchingsimulator.jpg', import.meta.url));
  assert.ok(jpg.length < 154_000, `${jpg.length} bytes (reserve 6 KB for the owner's content-credentials label)`);
  assert.deepEqual([...jpg.subarray(0, 3)], [0xff, 0xd8, 0xff], 'a JPEG');
  assert.deepEqual(jpegSize(jpg), [1200, 630]);
  const card = readPage('tools/cards/trenchingsimulator-card.html');
  const words = textOf(card.slice(card.indexOf('<body'))).trim();
  for (const word of TS_COVER_WORDS) assert.ok(words.includes(word), word);
  assert.ok(words.includes('AGI1.APP/GAMES/TRENCHINGSIMULATOR'));
  assert.ok(card.includes('src="/games/trenchingsimulator/mark.svg"'), 'the new menu mark');
  assert.ok(card.includes('src="../games/trench-art/market.svg"'), 'the native candle chart');
  assert.ok(card.includes('href="../games/trench-art/cover.css"'), 'the shared art typography and palette');
  assert.doesNotMatch(card, /board\.webp|coin\.webp|agi1-cutout/, 'the old cover composition is retired');
  assert.doesNotMatch(card, /\.glb\b|https?:\/\//, 'never the 3D model, nothing from another site');
  assert.doesNotMatch(words, /\bbuy\b|%|\$\s?\d/i, 'no price talk');
  // the game's page: its own picture, with the site's address filled in at build time
  const page = readPage('trenchingsimulator.html');
  assert.ok(page.includes('<meta property="og:image" content="__SITE__/cards/trenchingsimulator.jpg" />'), 'its own link preview');
  assert.match(page, /<meta property="og:image:width" content="1200" \/>\s*<meta property="og:image:height" content="630" \/>/);
  assert.match(page, /<meta property="og:image:alt" content="TRENCHING SIMULATOR[^\"]*trading-arrow logo[^\"]*candle chart[^\"]*six terminal[^\"]*" \/>/);
  assert.match(page, /<meta name="twitter:card" content="summary_large_image" \/>/);
  assert.match(page, /<meta property="og:url" content="__SITE__\/games\/trenchingsimulator" \/>/);
  assert.match(readPage('scripts/share-pages.js'), /'dist\/trenchingsimulator\.html'/, 'its preview gets the site\'s address');
  assert.ok(readPage('scripts/share-pages.js').includes("'trenchingsimulator.jpg'"), 'the build checks its picture is there');
});

test('TRENCHING SIMULATOR\'s key art: a compact 760 × 511 black/lime cover with readable title and no retired screenshots', async () => {
  const { default: sharp } = await import('sharp');
  const art = readFileSync(new URL('../src/games/trenchingsimulator/keyart.webp', import.meta.url));
  const ride = readFileSync(new URL('../src/games/rideemagi/keyart.webp', import.meta.url));
  const [a, r] = await Promise.all([sharp(art).metadata(), sharp(ride).metadata()]);
  assert.equal(a.format, 'webp');
  assert.deepEqual([a.width, a.height], [r.width, r.height], 'the shelf images share their aspect ratio');
  assert.deepEqual([a.width, a.height], [760, 511]);
  assert.ok(art.length < 200_000, `${art.length} bytes`);
  // A capture made while the variable font is repainting can silently omit the title.
  const { data, info } = await sharp(art).extract({ left: 38, top: 140, width: 400, height: 145 }).raw().toBuffer({ resolveWithObject: true });
  let white = 0, lime = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const [red, green, blue] = data.subarray(i, i + 3);
    if (red > 200 && green > 200 && blue > 180) white++;
    if (red > 160 && green > 210 && blue < 150) lime++;
  }
  assert.ok(white > 2000 && lime > 2000, `both title lines must be painted: ${white} white, ${lime} lime pixels`);
  const page = readPage('tools/games/trench-art/keyart.html');
  const words = textOf(page.slice(page.indexOf('<body'))).trim();
  for (const word of TS_COVER_WORDS) assert.ok(words.includes(word), word);
  assert.ok(page.includes('src="/games/trenchingsimulator/mark.svg"'));
  assert.ok(page.includes('src="./market.svg"'));
  assert.ok(page.includes('href="./cover.css"'));
  assert.doesNotMatch(page, /board\.webp|coin\.webp|agi1-cutout/, 'no old terminal images or character cutout');
  assert.doesNotMatch(page, /\.glb\b|https?:\/\//, 'never the 3D model, nothing from another site');
  const css = readPage('tools/games/trench-art/cover.css');
  for (const font of ['Anybody-Variable.woff2', 'Geist-Variable.woff2']) assert.ok(css.includes(font), font);
  assert.match(css, /font-size:76px/); assert.match(css, /#d6ff62/); assert.match(css, /#0d0f0c/);
  const chart = readPage('tools/games/trench-art/market.svg');
  assert.match(chart, /viewBox="0 0 440 250"/);
  assert.ok((chart.match(/<rect /g) || []).length >= 16, 'a complete candle chart');
  assert.doesNotMatch(chart, /<script|<foreignObject|<image|href=/i, 'the graphic is self-contained vector art');
});

test('VLAD RUNNER 2049: its card, stars, players and plays, its direct page; never leaderboards or score requests', async () => {
  const page = GAMES_PAGE();
  const card = between(page, '<li class="gm-tile" data-gm-game="vladrunner2049"', '\n            </li>');
  assert.match(card, /src="\/images\/games\/vladrunner2049\.webp"/, 'its tile (2026-11-08): a still and a loop of it playing');
  // (2026-10-23, the owner: "the rating, review, players and played are missing in that game"): its stars and plays on its tile,
  // its ratings in its tab
  assert.deepEqual([...card.matchAll(/href="([^"]+)"/g)].map((m) => m[1]), ['/games/vladrunner2049']);
  assert.match(page, /<button class="gm-tab" [^>]*id="gm-tab-vladrunner2049" aria-controls="rate-vladrunner2049"/);
  assert.doesNotMatch(card, /data-gm-lb|api\/wallet/, 'no leaderboard on its card');
  const { isGame } = await import('../src/games/list.js');
  assert.equal(isGame('vladrunner2049'), true, 'counted and rated by our server');
  const { isBoard, BOARD_IDS } = await import('../src/games/boards.js');
  assert.equal(Object.hasOwn(BOARD_IDS, 'vladrunner2049'), false, 'no leaderboards: its scores stay on the device');
  assert.equal(isBoard('vladrunner2049', 'e:all'), false);
  assert.doesNotMatch(page, /data-gm-lb="vladrunner2049"/);
  const { LOOK_GAMES, lookSystem } = await import('../server/arcade.js');
  assert.ok(Object.hasOwn(LOOK_GAMES, 'vladrunner2049'), 'its reviews judged as reviews of this game');
  assert.match(lookSystem('vladrunner2049'), /VLAD RUNNER 2049/);
  // the game tells our server only how many runs were started (its own site.js), as each run begins; nothing about scores
  const site = readPage('src/games/vladrunner2049/site.js');
  assert.match(site, /const GAME = 'vladrunner2049';/);
  assert.match(site, /action: 'game-play', game: GAME, player: playerId\(\), plays/);
  const vlad = readPage('src/games/vladrunner2049/page.js');
  assert.match(vlad, /import \{ Site \} from '\.\/site\.js';/);
  assert.equal((vlad.match(/Site\.play\(\)/g) || []).length, 1, 'one count a run');
  assert.doesNotMatch(vlad, /\/api\/|fetch\(|game-score|game-ticket/, 'no score requests');
  const game = readPage('vladrunner2049.html');
  assert.match(game, /<main id="vr-root">/);
  assert.match(game, /src="\/src\/games\/vladrunner2049\/page\.js"/);
  assert.match(game, /rel="canonical" href="__SITE__\/games\/vladrunner2049"/);
  assert.match(game, /property="og:image" content="__SITE__\/images\/vladrunner2049\/keyart\.webp"/);
  assert.doesNotMatch(game, /<script>|<style|\sstyle=|\son\w+=/, 'works with the existing strict CSP');
  assert.match(readPage('scripts/share-pages.js'), /'dist\/vladrunner2049\.html'/);
  const { neededGameArt } = await import('../scripts/share-pages.js');
  assert.ok(neededGameArt().includes('images/vladrunner2049/keyart.webp'), 'build requires the public preview image');
  const vercel = JSON.parse(readPage('vercel.json'));
  for (const path of ['/games/vladrunner2049', '/games/vladrunner2049/']) {
    assert.ok(vercel.rewrites.some((r) => r.source === path && r.destination === '/vladrunner2049'));
  }
  const { default: config } = await import('../vite.config.js');
  assert.equal(config.build.rollupOptions.input.vladrunner2049, 'vladrunner2049.html');
  for (const hook of ['configureServer', 'configurePreviewServer']) {
    let rewrite;
    config.plugins[0][hook]({ middlewares: { use(fn) { rewrite = fn; } } });
    for (const [url, expected] of [
      ['/games/vladrunner2049', '/vladrunner2049.html'],
      ['/games/vladrunner2049/?hero=agi&sound=off', '/vladrunner2049.html?hero=agi&sound=off'],
      ['/games/vladrunner2049-extra', '/games/vladrunner2049-extra'],
    ]) {
      const req = { url, headers: {} }; let called = 0;
      rewrite(req, {}, () => { called++; });
      assert.equal(req.url, expected, `${hook}: ${url}`);
      assert.equal(called, 1);
    }
  }
});

test('SKYBREAK: its card, stars, players and plays, its direct page under its own CSP; never leaderboards or score requests', async () => {
  const page = GAMES_PAGE();
  const card = between(page, '<li class="gm-tile" data-gm-game="skybreak"', '\n            </li>');
  assert.match(card, /src="\/images\/games\/skybreak\.webp"/);
  assert.deepEqual([...card.matchAll(/href="([^"]+)"/g)].map((m) => m[1]), ['/games/skybreak']);
  assert.doesNotMatch(card, /data-gm-lb|api\/wallet/, 'no leaderboard on its card');
  assert.match(textOf(between(page, '<p class="gm-note gm-grid-note">', '</p>')), /In SKYBREAK, the coins you collect are just for fun\./, 'its coins are only the game\'s');
  const { isGame } = await import('../src/games/list.js');
  assert.equal(isGame('skybreak'), true, 'counted and rated by our server');
  const { isBoard, BOARD_IDS } = await import('../src/games/boards.js');
  assert.equal(Object.hasOwn(BOARD_IDS, 'skybreak'), false, 'no leaderboards: its best times stay on the device');
  assert.equal(isBoard('skybreak', 'e:all'), false);
  assert.doesNotMatch(page, /data-gm-lb="skybreak"/);
  const { LOOK_GAMES, lookSystem } = await import('../server/arcade.js');
  assert.ok(Object.hasOwn(LOOK_GAMES, 'skybreak'), 'its reviews judged as reviews of this game');
  assert.match(lookSystem('skybreak'), /SKYBREAK/);
  assert.match(lookSystem('skybreak'), /financial advice about real coins or real money/, 'pumps, dumps and the Moon are the game\'s own words');
  // the game tells our server only how many runs were started (its own site.js), as each run begins; nothing about scores
  const site = readPage('src/games/skybreak/site.js');
  assert.match(site, /const GAME = 'skybreak';/);
  assert.match(site, /action: 'game-play', game: GAME, player: playerId\(\), plays/);
  const entry = readPage('src/games/skybreak/page.js');
  assert.match(entry, /import \{ Site \} from '\.\/site\.js';/);
  assert.equal((entry.match(/Site\.play\(\)/g) || []).length, 1, 'one count a run');
  assert.match(entry, /document\.addEventListener\('skybreak:run', \(\) => Site\.play\(\)\);/, 'the game\'s run event');
  assert.equal((readPage('src/games/skybreak/main.js').match(/new CustomEvent\('skybreak:run'/g) || []).length, 1, 'the game says when a run begins');
  for (const f of [entry, readPage('src/games/skybreak/main.js')]) assert.doesNotMatch(f, /\/api\/|fetch\(|game-score|game-ticket/, 'no score requests');
  const game = readPage('skybreak.html');
  assert.match(game, /<main id="sb-root">/);
  assert.match(game, /src="\/src\/games\/skybreak\/page\.js"/);
  assert.match(game, /rel="canonical" href="__SITE__\/games\/skybreak"/);
  assert.match(game, /property="og:image" content="__SITE__\/images\/skybreak\/keyart\.webp"/);
  assert.doesNotMatch(game, /<script>|<style|\sstyle=|\son\w+=/, 'works with the strict CSP');
  assert.match(readPage('scripts/share-pages.js'), /'dist\/skybreak\.html'/);
  const { neededGameArt } = await import('../scripts/share-pages.js');
  assert.ok(neededGameArt().includes('images/skybreak/keyart.webp'), 'build requires the public preview image');
  const vercel = JSON.parse(readPage('vercel.json'));
  for (const path of ['/games/skybreak', '/games/skybreak/']) {
    assert.ok(vercel.rewrites.some((r) => r.source === path && r.destination === '/skybreak'));
  }
  const { default: config } = await import('../vite.config.js');
  assert.equal(config.build.rollupOptions.input.skybreak, 'skybreak.html');
  for (const hook of ['configureServer', 'configurePreviewServer']) {
    let rewrite;
    config.plugins[0][hook]({ middlewares: { use(fn) { rewrite = fn; } } });
    for (const [url, expected] of [
      ['/games/skybreak', '/skybreak.html'],
      ['/games/skybreak/?qa', '/skybreak.html?qa'],
      ['/games/skybreak/characters/agi1-high.vsplat', '/games/skybreak/characters/agi1-high.vsplat'],
      ['/games/skybreak-extra', '/games/skybreak-extra'],
    ]) {
      const req = { url, headers: {} }; let called = 0;
      rewrite(req, {}, () => { called++; });
      assert.equal(req.url, expected, `${hook}: ${url}`);
      assert.equal(called, 1);
    }
  }
});

test('AGI games: "GAME beta" on top (beta stuck over GAME), a compact picker of every game with its gameplay preview, filters and sorts, a ratings tab for each, what\'s coming and the fine print', async () => {
  const { GAMES } = await import('../src/games/list.js');
  const { SHELF, FILTERS, SORTS, countIn, sortShelf, inFilter, previewOf } = await import('../src/games/shelf.js');
  const IDS = Object.keys(GAMES);
  assert.equal(IDS.length, 24, 'twenty-four games since the second night of 2026-11-08');
  // the picker's order ("Featured") covers every game once
  assert.deepEqual([...SHELF.map((g) => g.id)].sort(), [...IDS].sort(), 'every game on the shelf, once');
  for (const g of SHELF) {
    assert.equal(g.name, GAMES[g.id].name);
    assert.equal(g.path, GAMES[g.id].path);
    assert.ok(g.line.length >= 18 && g.line.length <= 44, `${g.id}: its line in a few words (${g.line.length})`);
    assert.ok(g.genre.length <= 14, `${g.id}: its kind in a word or two`);
    for (const t of g.tags) assert.ok(FILTERS.some((f) => f.id === t), `${g.id}: ${t} is a filter`);
    assert.match(g.added, /^2026-\d\d-\d\d(T\d\d:\d\d)?$/, `${g.id}: its day (and hour, for two the same day)`);
    assert.deepEqual(previewOf(g.id), { video: `/images/games/${g.id}.mp4`, poster: `/images/games/${g.id}.webp` });
  }
  assert.deepEqual(SHELF.filter((g) => g.tags.includes('new')).map((g) => g.id).sort(), IDS.slice(14).sort(), 'the second night\'s ten are New');
  assert.deepEqual(sortShelf('new').slice(0, 10).map((g) => g.id).sort(), IDS.slice(14).sort(), 'Newest: the second night\'s ten first');
  // the sorts: Newest by its day (then Featured); Most played and Top rated by our server's numbers, the rest after them
  assert.deepEqual(sortShelf('new').slice(-4).map((g) => g.id), ['skybreak', 'vladrunner2049', 'trenchingsimulator', 'rideemagi']);
  assert.deepEqual(sortShelf('played', { skybreak: { plays: 9 }, rideemagi: { plays: 50 } }).slice(0, 3).map((g) => g.id), ['rideemagi', 'skybreak', SHELF[0].id]);
  assert.deepEqual(sortShelf('rated', { jaywalk: { ratings: 3, average: 4.7 }, stacked: { ratings: 1, average: 5 } }).slice(0, 2).map((g) => g.id), ['stacked', 'jaywalk']);
  assert.deepEqual(sortShelf('featured').map((g) => g.id), SHELF.map((g) => g.id));
  assert.equal(countIn('all'), 24);
  assert.equal(SHELF.filter((g) => inFilter(g, 'puzzle')).length, countIn('puzzle'));
  const page = GAMES_PAGE();
  const main = mainOf(page);
  assert.equal((page.match(/<h1\b/g) || []).length, 1, 'one h1');
  assert.match(main, /<h1 class="gm-title" id="gm-title"><span class="gm-word">GAME<\/span> <span class="gm-beta">beta<\/span><\/h1>/, 'screen readers hear "GAME beta"');
  assert.match(textOf(between(main, '<p class="gm-say">', '</p>')), /AGI-1: twenty-four games now 💜 .* no prizes yet, just bragging rights\./, 'her line, for all of them');
  // the picker: a filter for each kind (with how many), the sort, then a tile for each game in the Featured order
  const shelf = between(main, '<section class="section gm-shelf"', '</section>');
  assert.match(shelf, /^<section class="section gm-shelf" id="play" aria-labelledby="gm-shelf-title">/);
  assert.match(textOf(shelf), /Pick a game 24/);
  assert.match(textOf(shelf), /No sign-in or wallet needed to play: runs are counted, never who\./);
  assert.deepEqual([...shelf.matchAll(/<button class="gm-filter" type="button" aria-pressed="(true|false)" data-gm-filter="([\w]+)">([^<]+) <span class="gm-filter-n" aria-hidden="true">(\d+)<\/span><\/button>/g)]
    .map((m) => [m[2], m[3].replaceAll('&amp;', '&'), Number(m[4]), m[1]]), FILTERS.map((f, i) => [f.id, f.label, countIn(f.id), String(i === 0)]), 'its filters, All picked');
  assert.deepEqual([...shelf.matchAll(/<option value="(\w+)">([^<]+)<\/option>/g)].map((m) => [m[1], m[2]]), SORTS.map((o) => [o.id, o.label]));
  assert.deepEqual([...shelf.matchAll(/<li class="gm-tile" data-gm-game="(\w+)" data-gm-tags="([^"]*)">/g)].map((m) => [m[1], m[2]]),
    SHELF.map((g) => [g.id, g.tags.join(' ')]), 'a tile for each game, in its order');
  const tileOf = (id) => between(shelf, `<li class="gm-tile" data-gm-game="${id}"`, '\n            </li>');
  for (const g of SHELF) {
    const tile = tileOf(g.id);
    // the whole tile opens the game (one link, nothing else to press inside it)
    assert.deepEqual([...tile.matchAll(/href="([^"]+)"/g)].map((m) => m[1]), [g.path], `${g.id}: one link, to the game`);
    assert.doesNotMatch(tile, /<button|<a [^>]*>[\s\S]*<a /, `${g.id}: nothing to press inside the link`);
    assert.ok(tile.includes(`<img class="gm-tile-img" src="/images/games/${g.id}.webp" alt="" width="480" height="480" loading="lazy" decoding="async" />`), `${g.id}: its still`);
    assert.ok(tile.includes(`<video class="gm-tile-video" data-gm-video="/images/games/${g.id}.mp4" muted loop playsinline preload="none" disablepictureinpicture disableremoteplayback aria-hidden="true" tabindex="-1"></video>`), `${g.id}: its loop, asked for only when it plays`);
    const said = textOf(tile);
    for (const w of [g.name, g.line, g.genre]) assert.ok(said.includes(w), `${g.id}: ${w}`);
    assert.deepEqual([...tile.matchAll(/data-gm-stat="(\w+)">…</g)].map((m) => m[1]), ['rating', 'plays'], `${g.id}: "…" until our server answers`);
    if (g.tags.includes('new')) assert.ok(tile.includes('<span class="gm-tile-badge is-new">New</span>'), `${g.id}: New`);
    else if (g.badge) assert.ok(tile.includes(`<span class="gm-tile-badge is-play">${g.badge}</span>`), `${g.id}: ${g.badge}`);
    else assert.doesNotMatch(tile, /gm-tile-badge/);
  }
  // each still and loop is there, small enough for a phone (tools/games/capture-previews.mjs makes them)
  for (const g of SHELF) {
    const still = readFileSync(new URL(`../public/images/games/${g.id}.webp`, import.meta.url));
    assert.ok(still.length > 2000 && still.length < 140_000, `${g.id}: its still, ${still.length} bytes`);
    assert.equal(still.subarray(8, 12).toString(), 'WEBP');
    const loop = readFileSync(new URL(`../public/images/games/${g.id}.mp4`, import.meta.url));
    assert.ok(loop.length > 20_000 && loop.length < 1_400_000, `${g.id}: its loop, ${loop.length} bytes`);
    assert.equal(loop.subarray(4, 8).toString(), 'ftyp', `${g.id}: an MP4`);
    assert.ok(loop.indexOf('moov') < loop.indexOf('mdat'), `${g.id}: fast start (its index first)`);
  }
  // TRENCHING SIMULATOR: play money; SKYBREAK's coins: just for fun (the picker's note)
  const note = textOf(between(shelf, '<p class="gm-note gm-grid-note">', '</p>'));
  for (const w of ['TRENCHING SIMULATOR is played with play money only', 'no real trades are sent', 'Not financial advice or affiliated with any real trading terminal.',
    'The previews are the games playing themselves.']) assert.ok(note.includes(w), w);
  // ratings and reviews: a tab for each game (the WAI-ARIA tabs pattern) in the Featured order, an empty panel each, filled by
  // src/games/page.js from the one template (its ids made for its game). #rate stays the section's (Ride 'Em, AGI!'s tab)
  const rate = between(main, '<section class="section gm-rate"', '</section>\n\n      <!-- what');
  assert.match(rate, /<section class="section gm-rate" id="rate" aria-labelledby="gm-rate-title">/);
  assert.match(rate, /<div class="gm-tabs" role="tablist" aria-label="Pick a game to rate" data-gm-tabs>/);
  const tabs = [...rate.matchAll(/<button class="gm-tab" type="button" role="tab" id="gm-tab-(\w+)" aria-controls="rate-(\w+)" aria-selected="(true|false)"( tabindex="-1")? data-gm-tab="(\w+)">(.*?)<\/button>/g)];
  assert.deepEqual(tabs.map((m) => m[1]), SHELF.map((g) => g.id), 'a tab for each game, in the picker\'s order');
  for (const [i, m] of tabs.entries()) {
    assert.equal(m[2], m[1], 'its panel');
    assert.equal(m[5], m[1]);
    assert.equal(m[3], String(i === 0), 'the first one picked');
    assert.equal(Boolean(m[4]), i > 0, 'the others left out of the Tab order (the arrow keys move between them)');
    assert.equal(textOf(m[6]).trim(), GAMES[m[1]].name, 'its name, its picture hidden from screen readers');
    assert.match(m[6], new RegExp(`<span class="gm-tab-art" aria-hidden="true"><img class="gm-tab-img" src="/images/games/${m[1]}\\.webp" alt="" `));
  }
  const panels = [...rate.matchAll(/<div class="gm-panel" role="tabpanel" id="rate-(\w+)" aria-labelledby="gm-tab-(\w+)" data-gm-rate="(\w+)"( hidden)?><\/div>/g)];
  assert.deepEqual(panels.map((m) => [m[1], m[2], m[3], Boolean(m[4])]), SHELF.map((g, i) => [g.id, g.id, g.id, i > 0]), 'an empty panel for each, the first showing');
  const tpl = between(rate, '<template id="gm-panel-tpl">', '</template>');
  assert.deepEqual([...tpl.matchAll(/<div class="gm-state" data-gm-state="(\w+)"( hidden)?>/g)].map((m) => `${m[1]}${m[2] ? ' hidden' : ''}`),
    ['loading', 'soon hidden', 'closed hidden', 'gate hidden', 'connect hidden', 'form hidden'], 'one state at a time');
  assert.deepEqual([...tpl.matchAll(/<input class="sr-only" type="radio" name="gm-stars" id="gm-GAMEID-s(\d)" value="(\d)" \/><label class="gm-pick-star" for="gm-GAMEID-s(\d)">/g)]
    .map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]), [[1, 1, 1], [2, 2, 2], [3, 3, 3], [4, 4, 4], [5, 5, 5]], 'its five stars, each with its label');
  assert.ok(tpl.includes('<textarea id="gm-GAMEID-text" data-gm-text rows="3" maxlength="300" autocomplete="off" aria-describedby="gm-GAMEID-text-note">'), 'REVIEW.textMax');
  assert.ok(tpl.includes('<input id="gm-GAMEID-name" data-gm-name type="text" maxlength="24"'), 'REVIEW.nameMax');
  assert.ok(tpl.includes('<section class="gm-reviews" aria-labelledby="gm-GAMEID-reviews">'), 'what players say');
  assert.ok(tpl.includes('<h3 class="sr-only">GAMENAME: its rating</h3>'), 'its rating, named');
  assert.deepEqual([...tpl.matchAll(/data-gm-(connect|out)\b/g)].map((m) => m[1]), ['connect', 'out'], 'a wallet only to rate it: its two buttons');
  const saidTpl = textOf(tpl);
  assert.match(saidTpl, /It takes a free signature, never a transaction, and it's only for reviews: playing never needs it\./);
  assert.match(saidTpl, /Reviews are for adults: 18\+ only\./);
  assert.match(saidTpl, /never your address/);
  assert.doesNotMatch(tpl, /rideemagi|Ride 'Em/, 'nothing of one game in it');
  assert.match(textOf(rate), /Rating a game takes a connected wallet: a free signature, never a transaction\. Playing never does\./);
  // the page as it is once its panels are filled: every id once, every name for a field or a part points at one that's there
  const tplInner = tpl.slice('<template id="gm-panel-tpl">'.length, -'</template>'.length);   // what a panel is filled with
  const filled = page.replace(/<div class="gm-panel" role="tabpanel" id="rate-(\w+)"([^>]*)><\/div>/g,
    (_, id, rest) => `<div class="gm-panel" role="tabpanel" id="rate-${id}"${rest}>${tplInner.replaceAll('GAMEID', id).replaceAll('GAMENAME', GAMES[id].name)}</div>`)
    .replace(/<template id="gm-panel-tpl">[\s\S]*?<\/template>/, '');
  const ids = [...filled.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids.filter((x, i) => ids.indexOf(x) !== i), [], 'no id twice');
  for (const m of filled.matchAll(/\s(?:for|aria-describedby|aria-labelledby|aria-controls)="([^"]+)"/g)) assert.ok(ids.includes(m[1]), `${m[1]} is on the page`);
  // page.js fills them the same way: the template's GAMEID in those names, GAMENAME in its words
  const js = readPage('src/games/page.js');
  assert.match(js, /const NAMED = \['id', 'for', 'aria-labelledby', 'aria-describedby', 'aria-controls'\];/);
  assert.match(js, /v\.replaceAll\('GAMEID', game\)/);
  assert.match(js, /t\.data\.replaceAll\('GAMENAME', GAMES\[game\]\.name\)/);
  // what's coming and the fine print: a beta, no prizes yet, never a promise
  const next = textOf(between(main, '<section class="section gm-next"', '</section>\n    </main>'));
  for (const w of ['AGI games is a beta: free to play, and there are no prizes yet.', 'never guaranteed and never an investment', 'Not financial advice: $AGI is a meme token and can lose all of its value.',
    'TRENCHING SIMULATOR is played with play money, on made-up coins or, in Live mode, real new coins: nothing in it is real money or advice, nothing is ever traded for real, and it isn\'t affiliated with any real trading terminal.',
    'The ten newest games keep your scores, bests and settings in this browser only: they\'re never sent anywhere, and there are no leaderboards for them.',
    'Anyone asking you to deposit or send $AGI to “play” is not us.', 'This page never asks your wallet for a transaction or a token approval.', 'No sign-in, no wallet.', 'Reviews are 18+.']) assert.ok(next.includes(w), w);
  // no rates, amounts or yields; "guaranteed" and "investment" only ever as nevers; never "buy"
  const text = textOf(main);
  assert.doesNotMatch(text, /%|\bAPY\b|\bAPR\b|\byield/i, 'no rates');
  assert.doesNotMatch(text, /\$\s?\d|\d[\d,.]*\s*(USDG|\$AGI)\b/, 'no amounts');
  for (const m of text.matchAll(/guarantee\w*/gi)) assert.match(text.slice(Math.max(0, m.index - 10), m.index), /never $/, `"${m[0]}" only as never`);
  for (const m of text.matchAll(/invest\w*/gi)) assert.match(text.slice(Math.max(0, m.index - 10), m.index), /(never|not) an $/, `"${m[0]}" only as never or not one`);
  assert.doesNotMatch(text, /\bbuy\b/i, 'never "buy" (hard rule 8)');
  // its stamp's words (Geist Mono: 0.6em a letter plus its letter-spacing) never squeezed, never past their ring
  const [, d, len, words] = main.match(/<path id="gm-ring" d="([^"]+)"\/>[\s\S]*?<textPath href="#gm-ring" textLength="(\d+)" lengthAdjust="spacing">([^<]+)<\/textPath>/);
  assert.equal(d, 'M100 100m-78 0a78 78 0 1 1 156 0a78 78 0 1 1-156 0');
  const natural = [...words.trim()].length * 13 * (0.6 + 0.1);
  assert.ok(natural <= Number(len) && Number(len) <= 2 * Math.PI * 78, `its words ${natural.toFixed(1)} px, spread to ${len} on a ${(2 * Math.PI * 78).toFixed(1)} px ring`);
  // the home page's safety note says what's counted and kept
  assert.ok(html.includes('If you play AGI games (agi1.app/games), no sign-in is needed: your browser keeps a random player id for the games, and our server counts the runs you start under a scrambled code of it (never who you are), with a daily visitor code.'));
  assert.ok(html.includes('If you rate or review a game, you connect a wallet (a free signature, never a transaction)'));
});

test('AGI games\' look: every rule names a gm- class; "beta" stuck over GAME; Pop mode\'s scoped, its hero violet like the browser bar; "reduce motion"', () => {
  const css = readPage('src/styles/games.css');
  const all = cssRules(css);
  assert.ok(all.length > 80, `${all.length} rules`);
  const loose = all.flatMap(({ at, head }) => selectorsOf(head).filter((s) => !s.includes('.gm-')).map((s) => `${at} ${s}`.trim()));
  assert.deepEqual(loose, [], 'every rule names a gm- class, so no other page changes');
  // the owner's "beta is overlapping on the word GAME": pulled back over its E and tilted, a sticker
  const beta = all.find(({ at, head }) => !at && head === '.gm-beta').body;
  assert.match(beta, /margin-left: -1\.27em/);
  assert.match(beta, /rotate: -8deg/);
  // its entrance starts from .01 (browsers time the main content), never 0; nothing is ever fully see-through
  assert.match(css, /@keyframes gm-rise \{ from \{ opacity: \.01;/);
  assert.match(css, /@keyframes gm-stick \{ from \{ opacity: \.01;/);
  for (const { head, body } of all) {
    assert.doesNotMatch(body, /opacity:\s*0?\.01/, `${head}: hidden only inside its keyframes`);
    assert.doesNotMatch(body, /opacity:\s*0\s*[;}]|opacity:\s*0$/, `${head}: never fully see-through`);
  }
  const still = all.filter(({ at }) => at === '@media (prefers-reduced-motion: reduce)').map(({ head }) => head).join(', ');
  for (const s of ['.gm-hero-text > *', '.gm-art', '.gm-beta', '.gm-stamp', '.gm-bar-fill', '.gm-tile-link', '.gm-tile-go', '.gm-pick-star', '.gm-tab', '.gm-filter']) assert.ok(still.includes(s), `"reduce motion" stops ${s}`);
  // (2026-10-21) a tab for each game's ratings: the picked one stands out; a game's panel lands with the tabs still in view
  const rule = (h, at = undefined) => all.find((r) => r.head === h && (at === undefined ? !r.at : r.at === at))?.body || '';
  assert.match(rule(".gm-tab[aria-selected='true']"), /border-color: var\(--fg\)/);
  assert.match(rule('.gm-panel'), /scroll-margin-top: 150px/);
  assert.match(rule('.gm-tile-badge.is-play'), /background: #d6ff62/, 'TRENCHING SIMULATOR\'s "Play money" sticker, its own lime');
  // (2026-11-08) the picker: four tiles a row on a computer, three on a tablet, two on a phone; a loop shows over its still
  // only once it plays (hidden, never see-through)
  assert.match(rule('.gm-grid'), /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(rule('.gm-grid', '@media (max-width: 1100px)'), /repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(rule('.gm-grid', '@media (max-width: 760px)'), /repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(rule('.gm-tile-video'), /visibility: hidden/);
  assert.match(rule('.gm-tile.is-live .gm-tile-video'), /visibility: visible/);
  assert.match(rule('.gm-tile-media'), /aspect-ratio: 1/);
  // Lightning CSS keeps only the last of a prefixed pair: the -webkit- one first, so the build keeps both
  const pop = cssRules(readPage('src/styles/pop.css')).filter(({ head }) => head.includes('.gm-'));
  for (const { head, body } of [...all, ...pop]) {
    if (/(^|[^-])mask-image/.test(body)) assert.ok(body.indexOf('-webkit-mask-image') >= 0 && body.indexOf('-webkit-mask-image') < body.search(/(^|[^-])mask-image/), `${head}: -webkit-mask-image first`);
  }
  // Pop mode: every gm- rule under [data-skin='pop'], its hero violet under the floating top bar, deep violet at night
  assert.ok(pop.length > 50, `${pop.length} Pop mode rules`);
  for (const { at, head } of pop) for (const s of selectorsOf(head)) assert.match(s, /^\[data-skin='pop'\]/, `${at} ${s}`);
  const popRule = (h) => pop.find(({ at, head }) => !at && head === h)?.body || '';
  assert.match(popRule("[data-skin='pop'] .gm-hero"), /margin-top: -72px; padding-top: calc\(72px \+/);
  assert.match(popRule("[data-skin='pop'] .gm-hero"), /background: var\(--pop-violet\)/);
  assert.match(popRule("[data-skin='pop'][data-theme='dark'] .gm-hero"), /background: #2a0f7a/);
  assert.match(popRule("[data-skin='pop'] .gm-beta"), /background: var\(--pop-honey\)/, 'a honey sticker');
  assert.match(popRule("[data-skin='pop'] .gm-tab[aria-selected='true']"), /background: var\(--pop-honey\)/, 'the picked game\'s tab honey');
  assert.match(popRule("[data-skin='pop'] .gm-tile-badge.is-play"), /background: var\(--pop-mint\)/, '"Play money" mint');
  assert.match(popRule("[data-skin='pop'] .gm-tile-badge.is-new"), /background: var\(--pop-pink\)/, '"New" pink');
  assert.match(popRule("[data-skin='pop'] .gm-tile-link"), /border: 3px solid var\(--edge\)/, 'its tiles stickers');
  assert.doesNotMatch(readPage('src/styles/pop.css'), /rm-page-games/, 'the roadmap\'s old games page rules are gone');
  // Pop mode's band once its hero has scrolled away (src/menu.js)
  assert.match(readPage('src/menu.js'), /document\.querySelector\('\.lp-hero, \.hero, \.rm-hero, \.gm-hero'\)/);
  // the phone's browser bar: Pop mode's violet hero, from the first paint (/theme.js), the page's color in the lab look
  assert.equal(barOf('games', 'pop', 'light'), '#6b3bff');
  assert.equal(barOf('games', 'pop', 'dark'), '#2a0f7a');
  assert.equal(barOf('games', null, null), '#6b3bff', 'the defaults (Pop mode, light, since 2026-11-02)');
  assert.equal(barOf('games', 'lab', 'light'), '#fafaf8');
  assert.equal(barOf('games', 'lab', 'dark'), '#0b0b0c');
});

test('AGI games\' script: its numbers, its reviews and rating it; text only, styles through the CSS object model; a wallet asked only for its address', () => {
  const src = readPage('src/games/page.js');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  assert.deepEqual([...code.matchAll(/^import ([^;]+);/gm)].map((m) => m[1].replace(/\s+/g, ' ')), ["'../styles/tokens.css'", "'../styles/base.css'", "'../styles/layout.css'",
    "'../styles/sections.css'", "'../styles/footer.css'", "'../styles/diary.css'", "'../styles/games.css'", "'../styles/pop.css'",
    "{ startTheme } from '../theme.js'", "{ startMenu } from '../menu.js'", "{ withHuman, postJson } from '../lib/human.js'",
    "{ findWallets, signInWithWallet, explainWalletError } from '../lib/wallet.js'", "{ isGame, STARS } from './list.js'",
    "{ WALLET_STEPS, NO_WALLET, BADGE, STAR_PATH, starsPath, starsLabel, pickText, fillWidth, avgText, ratingsText, countText, barWidth, playedText, cardStats, dateText, adjustStats, placeReview, mergeMine, appendPage, BOX, moreText, meText, savedText, deletedText, reviewError, gameOfHash, tileStats, shownText, } from './words.js'",
    "{ startBoards } from './leaderboard.js'",     // (2026-10-22: the leaderboards' section, its test below)
    "{ GAMES } from './list.js'", "{ SHELF, FILTERS, SORTS, sortShelf, inFilter } from './shelf.js'"]);   // (2026-11-08: the picker)
  assert.doesNotMatch(code, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|innerText|\beval\(|new Function/, 'text only (textContent), never HTML from strings');
  assert.doesNotMatch(code, /\.style\.(?!setProperty)|setAttribute\('style'/, 'its CSS variables through the CSS object model (the CSP allows no style attributes)');
  // its wallet: only its address here (the sign-in's one signature is src/lib/wallet.js's); tests/wallet.test.js guards the rest
  assert.deepEqual([...code.matchAll(/method: '([^']+)'/g)].map((m) => m[1]), ['eth_requestAccounts']);
  // what it asks our server: the game's numbers and reviews, and four actions; the human check only to save a review
  assert.deepEqual([...code.matchAll(/fetch\(`([^`]+)`\)/g)].map((m) => m[1]), ['${API}?game=${GAME}', '${API}?game=${GAME}&before=${last}']);
  assert.deepEqual([...new Set([...code.matchAll(/action: '([^']+)'/g)].map((m) => m[1]))], ['profile', 'game-mine', 'game-review', 'game-review-delete']);
  assert.match(code, /withHuman\(ui\.human, 'review',/);
  // what it keeps in this browser: the site's own 18+ answer and wallet session (shared with the home page and her live page)
  assert.match(code, /const KEYS = \{ adult: 'agi1_18plus', wallet: 'agi_wallet' \};/);
  assert.deepEqual([...new Set([...code.matchAll(/localStorage\.(\w+)/g)].map((m) => m[1]))].sort(), ['getItem', 'removeItem', 'setItem']);
  assert.doesNotMatch(code, /sessionStorage|indexedDB|document\.cookie/);
  // our server not answering (or not set up): "—" and "open soon", asked once more after a while (never for a game it doesn't know)
  assert.match(code, /if \(!retried && \(!res \|\| res\.status >= 500\)\) \{ retried = true; setTimeout\(loadStats, RETRY_MS\); \}/);
  // (2026-10-21) a box for each game on the page, each its own (its panel: everything it reads and writes), one wallet session
  // and 18+ answer for all of them, and another tab followed once
  assert.match(code, /function mountGame\(rate, session\) \{\n  const GAME = rate\.dataset\.gmRate;/);
  assert.match(code, /document\.querySelectorAll\('\[data-gm-rate\]'\)\]\s*\.filter\(\(rate\) => isGame\(rate\.dataset\.gmRate\)\)\s*\.map\(\(rate\) => mountGame\(rate, session\)\)/);
  assert.equal((code.match(/addEventListener\('storage'/g) || []).length, 1, 'another tab: followed once, for every box');
  assert.equal((code.match(/store\.set\(KEYS\.wallet/g) || []).length, 1, 'the session kept in one place');
  const box = code.slice(code.indexOf('function mountGame'), code.indexOf('function startTabs'));
  const lookups = [...box.matchAll(/\$\((['`])\[data-gm-[^'`]*\1(, \w+)?\)/g)];
  assert.ok(lookups.length > 30, `${lookups.length} lookups`);
  for (const m of lookups) assert.ok([', rate', ', card'].includes(m[2]) || m[0] === '$(`[data-gm-game="${GAME}"]`)', `a box reads only its own panel and card: ${m[0]}`);
  assert.doesNotMatch(box, /document\.querySelector/, 'never the whole page');
  // the tabs (the WAI-ARIA pattern): picked by a click or the arrow keys, Home and End; a link to a game's ratings opens its tab
  const tabs = code.slice(code.indexOf('function startTabs'), code.indexOf('function start()'));
  for (const k of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) assert.ok(tabs.includes(k), k);
  for (const w of ["t.setAttribute('aria-selected', String(on))", 't.tabIndex = on ? 0 : -1', 'panel.hidden = !on', "addEventListener('hashchange'", 'gameOfHash(location.hash)', 'a[href^="#rate"]']) {
    assert.ok(tabs.includes(w), w);
  }
});

// (2026-10-22) the leaderboards (the owner: "add a leaderboard (also add leaderboards with names , optional to the game ride
// em agi also)"): a section of their own between the shelf and the ratings, a box for each game (its board picked, its top
// 20, this browser's own place), the optional name both games use, the fine print. src/games/leaderboard.js reads them;
// their rules and words are src/games/boards.js's (tests/trench-game.test.js), our server's server/scores.js's
test('AGI games\' leaderboards: a box for each game, its boards from our server, your own place, the optional name; never who', async () => {
  const { GAMES } = await import('../src/games/list.js');
  const { BOARD_IDS } = await import('../src/games/boards.js');
  const IDS = Object.keys(GAMES).filter((id) => Object.hasOwn(BOARD_IDS, id));     // (VLAD RUNNER 2049 has none)
  assert.deepEqual(IDS, ['rideemagi', 'trenchingsimulator']);
  const page = GAMES_PAGE();
  const main = mainOf(page);
  const at = (s) => main.indexOf(s);
  assert.ok(at('<section class="section gm-shelf"') < at('<section class="section gm-lead"') && at('<section class="section gm-lead"') < at('<section class="section gm-rate"'),
    'between the shelf and the ratings');
  const lead = between(main, '<section class="section gm-lead"', '\n      </section>\n');
  assert.ok(lead.startsWith('<section class="section gm-lead" id="leaderboards" aria-labelledby="gm-lead-title" data-gm-lead>'));
  assert.deepEqual([...lead.matchAll(/<section class="gm-lb" data-gm-lb="(\w+)" aria-labelledby="gm-lb-\1">/g)].map((m) => m[1]), IDS, 'a box for each game, in their order');
  for (const id of IDS) {
    const box = between(lead, `<section class="gm-lb" data-gm-lb="${id}"`, '</section>');
    assert.ok(box.includes(`<h3 class="gm-lb-title" id="gm-lb-${id}">${GAMES[id].name}</h3>`), `${id}: its name`);
    assert.ok(box.includes(`<label class="gm-label" for="gm-lb-${id}-pick">Board</label>`) && box.includes(`id="gm-lb-${id}-pick" data-gm-lb-pick>`), `${id}: its boards to pick from`);
    for (const part of ['data-gm-lb-state role="status" aria-live="polite"', '<ol class="gm-lb-list" data-gm-lb-list', '<p class="gm-lb-me" data-gm-lb-me hidden>']) {
      assert.ok(box.includes(part), `${id}: ${part}`);
    }
  }
  const said = textOf(lead);
  for (const w of ['Checked runs only, under the names their players chose. Bragging rights only: there are no prizes.', 'Levels aren\'t ranked.',
    'Free play and Live mode aren\'t ranked.', 'Checked, but not cheat-proof', 'Names are shown publicly, and a row never shows who you are.',
    'Leave it empty and your rows say “A player”.']) assert.ok(said.includes(w), w);
  // the optional name, both games' (src/games/player-name.js: 24 characters, the field a little longer for emoji)
  assert.ok(lead.includes('<input id="gm-lb-name" data-gm-lb-name type="text" maxlength="40" autocomplete="nickname" spellcheck="false" aria-describedby="gm-lb-name-note" />'));
  assert.ok(lead.includes('<p class="gm-done" data-gm-lb-name-say role="status" aria-live="polite"></p>'));
  // the fine print: what a leaderboard keeps
  const next = textOf(between(main, '<section class="section gm-next"', '</section>\n    </main>'));
  assert.ok(next.includes('What a leaderboard keeps: a ranked run\'s numbers and the name you chose (or “A player”), shown publicly, under a scrambled code of that same random id (never who you are). A day\'s and a week\'s rows are deleted after 35 days.'));
  // its script: text only and no styles; it reads the boards (shared by the CDN) and asks only for this browser's own place,
  // with the games' random id when it has one (never made here: looking isn't playing)
  const code = readPage('src/games/leaderboard.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  assert.deepEqual([...code.matchAll(/^import ([^;]+);/gm)].map((m) => m[1].replace(/\s+/g, ' ')), ["{ isGame, PLAYER, PLAYER_KEY } from './list.js'",
    "{ pickerBoards, rowText, rowName, mineText } from './boards.js'", "{ NAME_KEY, loadName, saveName } from './player-name.js'",
    "{ CHALLENGES } from './trenchingsimulator/challenges.js'"]);
  assert.doesNotMatch(code, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|innerText|\beval\(|new Function/, 'text only');
  assert.doesNotMatch(code, /\.style\b|setAttribute\('style'/, 'styled by its classes only');
  assert.deepEqual([...code.matchAll(/fetch\(([^,)]+)/g)].map((m) => m[1]), ['`${API}?board=${game}:${board}`', 'API']);
  assert.deepEqual([...new Set([...code.matchAll(/action: '([^']+)'/g)].map((m) => m[1]))], ['game-score-mine']);
  assert.doesNotMatch(code, /setItem\(PLAYER_KEY|randomUUID|getRandomValues|site\.js/, 'the games\' id only read here');
  assert.doesNotMatch(code, /sessionStorage|indexedDB|document\.cookie/);
  assert.match(readPage('src/games/page.js'), /\n {2}startBoards\(\);/, 'the page starts it');
  // its look: in games.css with the page's other gm- rules (checked above), one column on a phone; Pop mode's mint
  const all = cssRules(readPage('src/styles/games.css'));
  const rule = (h, at2 = undefined) => all.find((r) => r.head === h && (at2 === undefined ? !r.at : r.at === at2))?.body || '';
  assert.match(rule('.gm-lead-grid'), /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(rule('.gm-lead-grid', '@media (max-width: 960px)'), /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(rule('.gm-lb-who'), /overflow-wrap: anywhere/, 'a long name never pushes the box wider');
  const pop = cssRules(readPage('src/styles/pop.css'));
  assert.match(pop.find((r) => !r.at && r.head === "[data-skin='pop'] .gm-lead")?.body || '', /--sec: var\(--pop-mint\)/);
  assert.match(pop.find((r) => !r.at && r.head === "[data-skin='pop'][data-theme='dark'] .gm-lead")?.body || '', /--sec: #0b2126/);
});

test('AGI games\' words (src/games/words.js): a row of stars, its numbers in words, a review\'s place, the box\'s words; never "buy" or a price', async () => {
  const w = await import('../src/games/words.js');
  // a row of five stars, filled to its value (each star's shape is 2.2 to 21.8 of its 24)
  assert.equal(w.fillWidth(5), '100%');
  assert.equal(w.fillWidth(4.5), '90%');
  assert.equal(w.fillWidth(1), '20%');
  assert.equal(w.fillWidth(3.7), '73.27%');
  for (const v of [0, -3, 'x', null, undefined]) assert.equal(w.fillWidth(v), '0%', String(v));
  assert.equal(w.fillWidth(9), '100%');
  assert.equal(w.starsPath().split('M').length - 1, 5, 'five stars');
  assert.equal(w.pickText(4), '4 stars: Really good');
  assert.equal(w.pickText(1), '1 star: Not for me');
  assert.equal(w.pickText(0), 'Tap a star');
  assert.equal(w.starsLabel(3), '3 out of 5 stars');
  // (2026-10-21) a game's ratings on the page: #rate-<game>; #rate, from before there were two games, stays Ride 'Em, AGI!'s
  assert.deepEqual(w.OLD_RATE, { hash: '#rate', game: 'rideemagi' });
  assert.equal(w.rateHash('trenchingsimulator'), '#rate-trenchingsimulator');
  assert.deepEqual(['#rate', '#rate-rideemagi', '#rate-trenchingsimulator'].map(w.gameOfHash), ['rideemagi', 'rideemagi', 'trenchingsimulator']);
  for (const h of ['', '#', '#rate-', '#rate-nope', '#rate-toString', '#rate-__proto__', '#Rate', '#rate-trenchingsimulator?x', 'rate', '#main', null, undefined, 42]) {
    assert.equal(w.gameOfHash(h), null, String(h));
  }
  // every link to a game's ratings: the games' own "Rate it" (since 2026-11-08 the games page's tiles only open the games;
  // the arcade kit's end-of-run card links to its game's tab: src/games/kit/shell.js)
  const gamesPage = readPage('games.html');
  assert.deepEqual([...gamesPage.matchAll(/href="(#rate[^"]*)"/g)].map((m) => w.gameOfHash(m[1])), []);
  assert.match(readPage('src/games/kit/shell.js'), /href: `\/games#rate-\$\{game\}`/, 'the kit\'s games: their own tab');
  assert.equal((readPage('src/games/trenchingsimulator/shell.js').match(/href: '\/games#rate-trenchingsimulator'/g) || []).length, 2, 'TRENCHING SIMULATOR\'s two "Rate it"');
  assert.doesNotMatch(readPage('src/games/trenchingsimulator/shell.js'), /'\/games#rate'/, 'never Ride \'Em, AGI!\'s');
  assert.match(readPage('src/games/rideemagi/game.js'), /\/games#rate"/, 'Ride \'Em, AGI!\'s own, as it was');
  // its numbers in words: "…" while they load, "—" when our server has none
  assert.equal(w.countText(1234), '1,234');
  for (const n of [-1, 1.5, null, '3']) assert.equal(w.countText(n), '—');
  assert.equal(w.avgText(4.2), '4.2');
  assert.equal(w.avgText(null), '—');
  assert.deepEqual([0, 1, 2500].map(w.ratingsText), ['No ratings yet', '1 rating', '2,500 ratings']);
  assert.deepEqual([0, 1, 12, -1].map(w.timesText), ['Not yet', 'Once', '12 times', '—']);
  assert.equal(w.playedText(null), 'Plays and players show up here soon.');
  assert.equal(w.playedText(0, 0), 'Nobody has played it yet: be the first.');
  assert.equal(w.playedText(1, 1), 'Played once by 1 person.');
  assert.equal(w.playedText(1234, 56), 'Played 1,234 times by 56 people.');
  assert.equal(w.playedText(5, null), 'Played 5 times.');
  assert.deepEqual([[3, 4], [1, 3], [0, 0], [2, 0]].map(([n, t]) => w.barWidth(n, t)), ['75%', '33.3%', '0%', '0%']);
  assert.deepEqual(w.cardStats(undefined, { loading: true }), { rating: { value: '…', star: false }, players: '…', plays: '…' });
  assert.deepEqual(w.cardStats(null), { rating: { value: '—', star: false }, players: '—', plays: '—' });
  assert.deepEqual(w.cardStats({ ratings: 0, average: null, players: 3, plays: 7 }), { rating: { value: 'None yet', star: false }, players: '3', plays: '7 times' });
  assert.deepEqual(w.cardStats({ ratings: 4, average: 4.5, players: 1200, plays: 1 }).rating, { value: '4.5', star: true });
  assert.equal(w.dateText('2026-10-19T23:30:00Z', 'UTC'), 'Oct 19, 2026');
  assert.equal(w.dateText('nope'), '');
  // its numbers after your own review changed here (a review the owner hid counts for nobody)
  const s = { ratings: 2, average: 4.5, stars: [0, 0, 0, 1, 1], plays: 9, players: 3 };
  assert.equal(w.adjustStats(null, { after: { stars: 3 } }), null);
  assert.deepEqual(w.adjustStats(s, { after: { stars: 3 } }), { ...s, stars: [0, 0, 1, 1, 1], ratings: 3, average: 4 });
  assert.deepEqual(w.adjustStats(s, { before: { stars: 5 }, after: { stars: 1 } }), { ...s, stars: [1, 0, 0, 1, 0], ratings: 2, average: 2.5 });
  assert.deepEqual(w.adjustStats(s, { before: { stars: 5, hidden: true }, after: { stars: 2 } }).average, 3.7);
  assert.deepEqual(w.adjustStats({ ratings: 1, average: 5, stars: [0, 0, 0, 0, 1] }, { before: { stars: 5 } }), { ratings: 0, average: null, stars: [0, 0, 0, 0, 0] });
  // a review's place in the list: newest first by id, only with words and not hidden; one older than the list while there's more stays out
  const r = (id, extra = {}) => ({ id, stars: 4, text: `review ${id}`, at: '2026-10-19T10:00:00Z', ...extra });
  const list = [r(9), r(5)];
  assert.deepEqual(w.placeReview(list, r(7)).map((x) => x.id), [9, 7, 5]);
  assert.deepEqual(w.placeReview(list, r(7, { hidden: true })).map((x) => x.id), [9, 5], 'one the owner hid: not on the page');
  assert.deepEqual(w.placeReview(list, r(7, { text: '' })).map((x) => x.id), [9, 5], 'stars alone: counted, not listed');
  assert.deepEqual(w.placeReview(list, r(3), { more: true }).map((x) => x.id), [9, 5], '"Show more reviews" brings it');
  assert.deepEqual(w.placeReview(list, null, { remove: r(9) }).map((x) => x.id), [5], 'deleted');
  assert.equal('hidden' in w.placeReview([], r(4, { hidden: false }))[0], false, 'its "hidden" never in the list');
  assert.deepEqual(w.mergeMine(list, r(5, { text: 'changed' })).map((x) => x.text), ['review 9', 'changed']);
  assert.deepEqual(w.appendPage(list, [r(5), r(2), r(1, { hidden: true }), r(3)]).map((x) => x.id), [9, 5, 3, 2], 'each once, newest first');
  // the box's words, and our server's answers in plain words
  assert.equal(w.moreText(1), '1 more review.');
  assert.equal(w.moreText(1200), '1,200 more reviews.');
  assert.equal(w.moreText(0), 'No more reviews.');
  assert.equal(w.meText({ wallet: '0x1234567890abcdef1234567890abcdef12345678', level: 2 }), `${w.short('0x1234567890abcdef1234567890abcdef12345678')} · Crush 💜`);
  assert.equal(w.meText({ wallet: '0x1234567890abcdef1234567890abcdef12345678', level: 1 }), w.short('0x1234567890abcdef1234567890abcdef12345678'));
  assert.equal(w.savedText({ created: true }), 'Posted. Thanks for rating it 💜');
  assert.equal(w.savedText({}), 'Saved your changes 💜');
  assert.equal(w.savedText({ hidden: true }), 'Saved. It stays off the page, so only you see it.');
  assert.deepEqual([true, false].map(w.deletedText), ['Your review is deleted.', 'There was no review to delete.']);
  assert.equal(w.reviewError('words', { why: 'link' }), 'No links in reviews, please.');
  assert.equal(w.reviewError('words', { why: 'nope' }), w.whyText('spam'), 'an odd reason: the plainest');
  assert.match(w.reviewError('name'), /^That name can't be shown: 24 characters at most/);
  assert.equal(w.reviewError('person_cap'), "That's 10 saves today. You can save it again tomorrow (00:00 UTC).");
  assert.equal(w.reviewError('mystery'), 'Something went wrong. Try again in a moment.');
  assert.match(w.whyText('secret'), /seed phrase or a private key/);
  // never "buy", a price or a rate in anything it says
  const said = [];
  const collect = (v) => { if (typeof v === 'string') said.push(v); else if (v && typeof v === 'object') Object.values(v).forEach(collect); };
  collect(w.BOX); collect(w.STAR_WORDS); collect(w.BADGE);
  for (const why of ['care', 'secret', 'long', 'link', 'address', 'contact', 'crude', 'spam', 'advice', 'coin']) said.push(w.whyText(why));
  for (const e of ['words', 'name', 'rules', 'person_cap', 'site_cap', 'too_fast', 'ai', 'age', 'human_check', 'signed_out', 'not_configured', 'busy', 'offline_net', 'bad_request', 'x']) said.push(w.reviewError(e));
  for (const t of said) {
    assert.doesNotMatch(t, /\bbuy\b|%|\$\s?\d|\bAPY\b|guarantee/i, t);
    assert.doesNotMatch(t, /<[a-z]/i, `${t}: shown as text`);
  }
});
