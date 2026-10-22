# Parody terminal names, logos and brand: research report (2026-10-21)

For TRENCHING SIMULATOR (`src/games/trenchingsimulator/`). Research only: nothing in the repo was changed.

Confidence marks: **[C]** confirmed from a file or image I opened myself; **[S]** from search-engine summaries (several
agreeing sources); **[U]** unconfirmed or inferred. Every real brand below is **described, never copied**: the parody
logos are our own SVG/CSS art, with their own marks.

Network note: every terminal's own site (gmgn.ai, pump.fun, axiom.trade, basedbot.io, fomo.family), Wikipedia, Brandfetch
and X refused direct fetches here (proxy policy 403 or DNS failures, not retried). What I could open: GitHub pages, files
on raw.githubusercontent.com and avatars.githubusercontent.com (GMGN's own org avatar and repo images, Trust Wallet's
PUMP token entry, a public Axiom-look clone's CSS and screenshot). Everything else is from WebSearch summaries.

---

## 1. Recommended names (TL;DR)

| Slot (`id`) | Real terminal | Proposed parody | Verdict | Use |
|---|---|---|---|---|
| `scan` | GMGN.ai | **GNGM** | OK with care: a dead micro-token used the ticker, and "GNGM.AI" is a common typo of GMGN | Keep; style it "GNGM" (no ".ai") |
| `board` | pump.fun | **Pomp.fun** | OK with care: no product found, but "Pomp" is Anthony Pompliano's well-known nickname, and ".fun" auto-links | Keep (fallback **Plump.fun**, no hits) |
| `pro` | Axiom Trade | **Axium** | Clear: no crypto product; only unrelated non-crypto "Axium" companies | Keep |
| `chat` | BasedBot | **BasedBott** | Clear: nothing found | Keep (needs a test regex tweak, §6) |
| `social` | fomo (fomo.family) | ~~Fomoo~~ → **Phomo** | **Fomoo is taken**: `fomoo.family` is a known wallet-drainer phishing copy of fomo, and **$FOMOO** is a live Solana memecoin ("Fomo App (FOMOO)") | Replace with **Phomo** (no crypto hits; a pho-bowl joke). Alt: **Fomu** (no crypto hits; non-crypto: an open-source FPGA board) |

Rejected while checking: **Pomo** (POMO is a crypto price-alert iOS app and a POMO gaming token: too close), **Fomoh**
(no hits, but it reads like a scam typo of fomo), **Fumo** (the Touhou plush meme: someone else's IP).

---

## 2. The real terminals (describe only)

### 2.1 GMGN.ai → parody GNGM (slot `scan`)
- **Mascot [C]:** an 8-bit, pixel-art green frog head (a Pepe-like meme frog), seen side-on facing **left**, a sideways
  "side-eye" look, yellow/tan belly, thick dark outlines. Seen in GMGN's official GitHub org avatar
  (github.com/GMGNAI) and the banner of its `gmgn-skills` repo.
- **Colors [C]**, sampled from those images:
  - org avatar: background `#111111`, frog lime `#A3E050`, outline `#457F2C`, mid green `#5DA040`, belly `#DFC855`,
    highlight `#D5F86B`, white eyes, black pupils and mouth;
  - an older header image: `#AEDC65` / `#507C38` / `#6A9D4D` / `#DCF57F` / `#DEC767`;
  - banner wordmark green `#64AD03`; body `#9ED455`, outline `#54923A`, highlight `#E5FF95`, belly `#F3BE71`, near-black
    `#0D0D0F` (a sibling research file, `research/gmgn-web.md`, sampled the same banner).
- **Wordmark [C/U]:** "GMGN" in chunky pixel/blocky capitals (black on light in the old header; green in the banner),
  usually next to the frog. Domain shown as GMGN.AI.
- **UI [S/U]:** near-black, green = up/buy, red = down/sell, dense tables (Trenches: New / Almost bonded / Migrated),
  TradingView-style chart.
- **Taglines [S]:** "Fast Trade, Copy Trade & AFK Automation" (its X bio, @gmgnai); "Discover Memes Faster, Trade in
  Seconds!" (its app listing).
- **Other [S]:** founded June 2023, Singapore. Many fake GMGN sites/apps exist (another reason our parody must never
  link or ask for anything).
- **Chains [C]** (from `gmgn-skills`, GMGN's own agent skill repo): `sol`, `bsc`, `base`, `eth`, `robinhood`, `arc`,
  `stable`.

### 2.2 pump.fun → parody Pomp.fun (slot `board`, today "Trench Board")
- **Logo [C]** (Trust Wallet's PUMP token icon, `trustwallet/assets`, and logo galleries [S]): a **capsule pill tilted
  about 45°**, lower-left half green with small white highlight dashes, upper-right half white/pale grey with a soft shade,
  a dark green outline. Sampled: green `#5FCB88`, white half shade `#C0D4D4`, outline `#1D3934`, mint shade `#60B58D`,
  icon background `#1B1D28`.
- **Brand colors [S]:** Brandfetch lists `#5FCB87` (emerald), `#84EFAB` (magic mint), `#15161B` (woodsmoke); Loftlyy
  lists `#5FCB88`, `#1D3934`, `#629393`, font **Inter**.
- **Wordmark [S/U]:** lowercase "pump.fun", plain geometric sans; the token is "Pump" / $PUMP. X: @pumpdotfun.
- **2026 look [S]:** a dark, near-black board of coin cards under the king of the hill, a chart-first coin page with the
  trade panel on the right, a redesigned coin page and profiles, a "Live" tab, web sign-in by email / Google / Apple /
  GitHub since 2026-09-25. (An April 1, 2026 "rebrand" post was an April Fools' joke.)
- **How Trench Board already matches [C]** (`terminals.js` `board` colors, `trench.css` `.tsb-*`): page `#0b0b0e`,
  panels `#131316` → `#242429`, accent `#86efac` (≈ Brandfetch's magic mint `#84EFAB`), dark green words on it
  (`#052e16`), up `#4ade80`, down `#f87171`, king-of-the-hill yellow `#eab308`. So renaming it **Pomp.fun keeps the
  board's colors as they are**; only its mark and words change (§5).

### 2.3 Axiom Trade → parody Axium (slot `pro`)
- **Logo [C/S]:** a white **stepped pyramid / triangle made of stacked horizontal bands** (wider toward the bottom), on
  black; wordmark "AXIOM" in a clean sans. Seen in a public clone's screenshot (its logo cut out and zoomed).
- **Colors [C, from the clone's CSS: likely but not official]:** background `#06070B`, panels `#101114` / `#18181A`,
  strokes `#22242D` / `#323542`, text `#FCFCFC` / `#C8C9D1` / `#777A8C`, primary blue `#526FFF`, increase `#2FE3AC`,
  decrease `#EC397A`, also `#12AF80`, `#DCC13C`, `#F25461`.
- **UI [S]:** nav Discover · Pulse · Trackers · Perpetuals · Yield · Vision · Portfolio · Rewards; Pulse = three live
  columns: New Pairs / Final Stretch / Migrated.
- **Tagline [S]:** "Trade memecoins, perpetuals, and earn yield." (Y Combinator W25 listing). No official token (an
  unrelated "AXIOM" AI-agent token exists on Base).

### 2.4 BasedBot → parody BasedBott (slot `chat`)
- **What it is [S]:** "the most complete Telegram trading bot for Base, BSC, ETH and Solana networks" (basedbot.io /
  docs.basedbot.app): buy/sell buttons in chat, take-profit/stop-loss, migration sniper, DCA, copy trading.
- **Logo/colors [U]:** not found in any reachable source. A third-party blog claims a $BBOT token (unconfirmed).
- **So the parody leans on the genre** (a Telegram-style chat in deep navy with a blue accent: today's `chat` palette)
  and on the name's own joke.

### 2.5 fomo (fomo.family) → parody Phomo (slot `social`)
- **What it is [S]:** FOMO Labs Inc.'s social trading app ("A trading app for the rest of us"; App Store: "fomo - never
  miss out"): follow friends and top wallets, copy a trade, everything in dollars, email/Apple sign-in, Apple Pay
  funding; chains Base, Solana, BNB Chain, Monad, Ethereum and **Robinhood Chain** [S]. Funding: a Benchmark-led $17M
  Series A (2025) [S]; a $75M Series B led by Index Ventures is reported by affiliate-style sites [U].
- **Visual [S/U]:** lowercase "fomo" wordmark; purple verified check marks on profiles. App icon and brand hex **not
  confirmed** (searches only found other "Fomo" companies). Our `social` palette (coral `#ff7a59`) is our own choice.
- **Scams [S]:** `fomoo.family` (double "o") is a documented drainer copy of fomo (malwaretips.com, pcrisk.com).

---

## 3. Name checks (sources)

| Name | Real crypto product/company/token? | Notes |
|---|---|---|
| **GNGM** | Only a dead Solana micro-token "Nebula Nomes" (GNGM, ~$2 liquidity, mintable: dexscreener.com/solana/g3kydb6fxgrrbky1x6ireaneuvob5ywrooddh5qnbgcp); reviews also misspell GMGN as "GNGM.AI" | Not an active product. Never write "GNGM.ai" or "gngm.ai" (a typosquat shape); the name alone is fine as a parody label |
| **Pomp.fun** | No product or site found (WebSearch: no results for "pomp.fun") | "Pomp" is Anthony Pompliano's nickname (a real person; general knowledge). Low risk as a pun on "pump", but: no person's face, no "Pomp" persona, never in a sentence about a person. **".fun" is a real TLD**: X and Telegram auto-link "Pomp.fun" → never put it in share posts or chat lines as plain text (write "Pomp dot fun", or leave the terminal's name out of posts, as `share.js` does today). Fallback with no hits: **Plump.fun** |
| **Axium** | No crypto product found; unrelated non-crypto companies use "Axium" | Fine |
| **BasedBott** | Nothing found | Fine. It contains "basedbot" → trips today's test regex (§6) |
| **Fomoo** | **Yes**: phishing drainer `fomoo.family` (malwaretips.com/blogs/fake-fomo-trading-platform-scam-how-fomoo-family-drains-connected-crypto-wallets/, pcrisk.com) and a live memecoin **$FOMOO** ("Fomo App (FOMOO)", phantom.com/tokens/solana/D41nWeZtykR1aiVskMWT4kRkzaFDxdcstb48o72RRLv9; x.com/FOMOOcoinn) | **Do not use**: it would look like the scam and name a real coin |
| **Phomo** | No exact hits in crypto (WebSearch, 2026-10-21) | Recommended for `social`. Doesn't contain "fomo" (passes the test regex as is) |
| Fomu | No crypto hits; an open-source FPGA board (Tomu family) shares the name | Second choice |
| Pomo | **Yes**: "POMO - Crypto Alert App" (iOS) and a POMO gaming token (coincodex) | Avoid |

Not legal advice: parody names this close to real brands can still draw a complaint. What keeps it a parody: our own
marks and art, never their logos, the safety note on every screen, a "parody" line, and **never a link** to them.

---

## 4. Parody logos, taglines and color tokens

All marks are simple SVG shapes (a `viewBox="0 0 32 32"` icon, drawn in code; no files, no fonts outside the site's
Geist / Anybody). Each keeps the **feel** of the original palette but a **different mark** with a joke. Every palette
below was checked with the test's own WCAG formula (`tests/trench-game.test.js` line 1002): text ≥ 7:1 and muted /
accent / up / down ≥ 4.5:1 on both `bg` and `panel` (script: `research/tools/contrast.mjs`, all pass).

### 4.1 GNGM (`scan`): "Good night, good morning, good luck."
- **Joke:** GNGM reads as "GN, GM": the mascot is a **sleepy pixel toad in a striped nightcap**, facing **right** (GMGN's
  frog faces left), one eye shut, "z" pixels; on a win it wakes up (eyes open, cap tips back). A toad (warty bumps,
  wider mouth, no Pepe lips) so it's never their frog.
- **Mark (pixel art, 12×12 grid scaled to 32):** body `#9fdc55`, outline `#3f7a2a`, belly `#e4cf6a`, cap stripes
  `#f3f5ef` / `#7c5cff`, closed eye a 2-px dark line, three "z" pixels in `#e5ff95`.
  ```svg
  <svg viewBox="0 0 12 12" shape-rendering="crispEdges"><!-- 1 unit = 1 pixel -->
    <path fill="#3f7a2a" d="M2 5h8v1h1v4h-1v1H2v-1H1V6h1z"/>          <!-- outline -->
    <path fill="#9fdc55" d="M2 6h8v4H2z"/>                              <!-- head -->
    <path fill="#e4cf6a" d="M3 9h6v1H3z"/>                              <!-- belly/chin -->
    <path fill="#1a1a1a" d="M7 7h2v1H7zM3 8h3v1H3z"/>                   <!-- shut eye, wide mouth -->
    <path fill="#f3f5ef" d="M3 3h5v1h1v1H2V4h1z"/><path fill="#7c5cff" d="M4 3h1v2H4zM6 3h1v2H6zM8 2h1v2H8z"/> <!-- nightcap -->
    <path fill="#e5ff95" d="M10 1h1v1h-1zM9 2h1v1H9z"/>                <!-- z -->
  </svg>
  ```
- **Wordmark:** "GNGM" in blocky caps (Anybody 850, or pixel blocks), lime on near-black. No ".ai".
- **Tagline (≤ 80 chars for the test):** "Good night, good morning, good luck. Scan every coin and wallet."
- **Colors (terminals.js shape):**
  ```js
  colors: { bg: '#0d0e0c', panel: '#161813', line: '#262a22', text: '#eef1ea', muted: '#939b8d', accent: '#9fdc55',
    up: '#4fd88f', down: '#ff6b6b' },
  ```
  (lime accent ≈ GMGN's frog; up kept a different green so "buy" and "brand" never blur: 11.8 / 10.9:1 accent, 10.6 / 9.8
  up). On the lime accent use near-black words (`#0d0e0c`, ~11.8:1).

### 4.2 Pomp.fun (`board`, replaces "Trench Board"): "Launch with pomp. Exit with circumstance."
- **Joke:** "pomp and circumstance": the **pill wears a tiny gold crown** and is tilted the **other way** (−45°, upper-left
  to lower-right; pump.fun's leans +45°), green half on the upper-left, white half on the lower-right, a confetti fleck or
  two. (Optionally a kazoo/party-horn tip instead of the crown.)
- **Mark:**
  ```svg
  <svg viewBox="0 0 32 32">
    <g transform="rotate(-45 16 17)">
      <rect x="6" y="12" width="20" height="10" rx="5" fill="#f4f6f5" stroke="#173a2c" stroke-width="1.6"/>
      <path d="M11 12h5v10h-5a5 5 0 0 1 0-10z" fill="#86efac" stroke="#173a2c" stroke-width="1.6"/>
      <path d="M10 15h3" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>
    </g>
    <path d="M17 6l2 3 2-3 2 3 2-3v5h-8z" fill="#eab308" stroke="#173a2c" stroke-width="1"/>   <!-- crown -->
  </svg>
  ```
- **Wordmark:** lowercase "pomp.fun" in the board's sans (Inter-like; the site's Geist), `#fafafa` (`--t-hero`), the
  ".fun" in `#86efac`. Shown as text only, **never a link**.
- **Tagline:** "Launch with pomp, exit with circumstance: the launchpad board." (≤ 80)
- **Colors:** **keep the current `board` palette exactly** (it's already the pump.fun 2026 feel and passes contrast):
  `bg #0b0b0e, panel #131316, panel2 #1b1b1f, panel3 #242429, line #232327, line2 #303036, text #e4e4e7, soft #d4d4d8,
  muted #a1a1aa, dim #8a8a93, hero #fafafa, accent #86efac, onAccent #052e16, up #4ade80, down #f87171, onDown #450a0a,
  warn #eab308, info #60a5fa, violet #c084fc`. Crown = `warn`.

### 4.3 Axium (`pro`): "Every coin, every column, zero chill."
- **Joke:** an "axiom" is a truth that needs no proof; Axium is **a stack of three bars that's slightly off balance**
  (tilted ~8°, the top bar sliding off): "almost bonded, almost balanced". Their mark is a calm, centered stepped
  pyramid; ours wobbles, and its bars are rounded pills.
- **Mark:**
  ```svg
  <svg viewBox="0 0 32 32"><g transform="rotate(-8 16 18)" fill="#f4f4f7">
    <rect x="12" y="7" width="9" height="4" rx="2" transform="translate(2 0)"/>   <!-- top bar, sliding off -->
    <rect x="9" y="13" width="14" height="4" rx="2"/>
    <rect x="6" y="19" width="20" height="4" rx="2"/>
  </g><circle cx="26" cy="7" r="2" fill="#7088ff"/></svg>
  ```
- **Wordmark:** "AXIUM" in wide caps (Anybody, letter-spaced), white, the "U" in the accent blue.
- **Tagline:** "Three live columns, one-click buys, zero chill." (≤ 80)
- **Colors:**
  ```js
  colors: { bg: '#07080c', panel: '#101116', line: '#22242d', text: '#f4f4f7', muted: '#8b8ea1', accent: '#7088ff',
    up: '#2fe3ac', down: '#f2587f' },
  ```
  (accent lighter than Axiom's `#526FFF` for margin: 6.3 / 6.0:1; down a pinker red like theirs, 6.2 / 5.8:1). White
  words on the accent button (`#07080c` also works).

### 4.4 BasedBott (`chat`): "Paste a coin. Tap a button. Touch grass never."
- **Joke:** the extra "t": a round **chat-bubble robot with two antennae** (two "t"s), one antenna bent, a little blue cap
  worn backwards ("based"). Lives as the avatar of a fake chat in the terminal.
- **Mark:**
  ```svg
  <svg viewBox="0 0 32 32">
    <path d="M6 8h20a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H13l-5 4v-4H6a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3z" fill="#5b9dff"/>
    <circle cx="12" cy="16" r="2.2" fill="#0f1823"/><circle cx="20" cy="16" r="2.2" fill="#0f1823"/>
    <path d="M12 8V4M20 8l2-4" stroke="#5b9dff" stroke-width="2" stroke-linecap="round"/>   <!-- two antennae (two t's), one bent -->
    <circle cx="12" cy="3.5" r="1.5" fill="#5fd38d"/><circle cx="22.4" cy="3.5" r="1.5" fill="#f2726f"/>
  </svg>
  ```
- **Wordmark:** "BasedBott" in a rounded bold sans, the double "tt" in the accent.
- **Tagline:** "Paste a coin, tap a button, touch grass never." (≤ 80)
- **Colors:** today's `chat` palette, a touch deeper and bluer:
  ```js
  colors: { bg: '#0f1823', panel: '#172331', line: '#24334a', text: '#f2f5f8', muted: '#8a9db2', accent: '#5b9dff',
    up: '#5fd38d', down: '#f2726f' },
  ```
  (all ≥ 5.6:1). Base's own blue `#0052FF` is too dark on navy for words; use it only as a fill if wanted.

### 4.5 Phomo (`social`, replaces Fomoo): "Fear of missing out, served hot."
- **Joke:** pho + fomo: a **steaming noodle bowl** whose chopsticks form an **up-arrow**, and the steam is a little
  candle wick. Everything in dollars, "copy a trade like you copy a recipe".
- **Mark:**
  ```svg
  <svg viewBox="0 0 32 32">
    <path d="M5 16h22a11 9 0 0 1-22 0z" fill="#ff7a59"/>                          <!-- bowl -->
    <path d="M7 16q4 -3 9 0t9 0" fill="none" stroke="#fde7dd" stroke-width="1.6"/> <!-- noodles -->
    <path d="M18 14L26 4M21 15L27 7" stroke="#f3f3f6" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M24 3l4 1-1 4" fill="none" stroke="#f3f3f6" stroke-width="1.6" stroke-linejoin="round"/> <!-- chopsticks as an up-arrow -->
    <path d="M11 11v-4M14 12V6" stroke="#b69cff" stroke-width="1.4" stroke-linecap="round"/>         <!-- steam / wick -->
  </svg>
  ```
- **Wordmark:** lowercase "phomo", rounded, coral; a purple check badge `#b69cff` next to traders' names (like the genre's
  verified marks, our own shape: a rounded star, not their check).
- **Tagline:** "Fear of missing out, served hot. Follow traders, all in dollars." (≤ 80)
- **Colors:** today's `social` palette plus a violet for the badge:
  ```js
  colors: { bg: '#0d0d10', panel: '#17171c', line: '#25252d', text: '#f3f3f6', muted: '#8e8e9c', accent: '#ff7a59',
    up: '#3ad68a', down: '#ff5c6c', violet: '#b69cff' },
  ```
  (accent 7.6 / 7.0:1, violet 8.5 / 7.8:1).

---

## 5. Keeping Pomp.fun consistent with the board (what changes where)

Today (`boards/board.js` line 266-267): `tsb-brand` = `.tsb-logo` (a 28×28 green rounded square with a "T" from
`::after`) + `.tsb-brand-t` "Trench Board"; nav `aria-label: 'Trench Board'` (line 1252); header comments.
- Replace `.tsb-logo`'s "T" (`trench.css` `.tsb-logo::after { content: 'T' }`) with the pill-and-crown SVG (an inline
  `<svg>` made by `createElementNS`, or a CSS `mask` from a data-URI SVG in `trench.css`: both fine under the CSP, no
  inline styles). Keep the 28 px box; drop the green square background (the pill brings its own green).
- `.tsb-brand-t` → "pomp.fun" (two spans: "pomp" `--t-hero`, ".fun" `--t-accent`), nav label "Pomp.fun".
- Keep "from pump.fun" on real coins in Live mode (`board.js` ~144/1048): it says where a real coin came from, which is
  true, and the parody name must never be confused with it. Consider "launched on pump.fun" vs our "Pomp.fun" chrome: the
  similarity there is the joke, but a tooltip/footnote "Pomp.fun is this game's parody board" helps.
- Colors, layout, cards, king of the hill, trade panel, phone bar: unchanged (they already match pump.fun's 2026 look).
- The terminal picker (`shell.js` `.ts-term-name`, Anybody 850) shows "Pomp.fun": add the mark there too (a 24 px icon
  left of the name) so each card reads like a brand.
- Loading text: `Opening ${t.name}…` → "Opening Pomp.fun…" reads fine.

## 6. Rename checklist (for whoever builds it)

1. `terminals.js`: `name` per slot (GNGM, Pomp.fun, Axium, BasedBott, Phomo), `short` (the test's `Trench ${short}` rule
   must go), new taglines (10–80 chars), colors above; add a `brand` field (mark id, wordmark parts) if useful. Add a
   one-line note near `SAFETY_NOTE`: "Parody names: not affiliated with any real trading terminal." (keep `SAFETY_NOTE`
   word for word: the test asserts it).
2. `tests/trench-game.test.js` (line 1016-1047):
   - names array → the new names; drop `t.name === \`Trench ${t.short}\``.
   - the forbidden-name regex: "BasedBott" contains `basedbot` → change `based\s*bot` to `based\s*bot(?!t)` (or
     `\bbased\s*bot\b`). Phomo, GNGM, Axium and Pomp.fun don't match it as is (checked: `gmgn`≠`gngm`, `axiom`≠`axium`,
     `pump\.?fun`≠`pomp.fun`, `fomo`⊄`phomo`). If Fomoo were kept, `fomo` → `\bfomo\b` would be needed, which also lets
     "fomoo" through: another reason to use Phomo.
   - add: no parody name ever appears inside an `href`, and none in `share.js` posts (`.fun` auto-links).
   - same regex at line 1095 (share posts).
3. `boards/board.js`, `trench.css` (§5); `shell.js` picker card; comments in `live-chains.js` (29-31), `shell.js` (334,
   476), `names.js` (196), `tests/trench-live.test.js` (931-932).
4. `tools/games/trench-art.mjs` (line 102 presses "Play on Trench Board"), `tools/games/trench-art/keyart.html`,
   `tools/cards/trenchingsimulator-card.html`: then re-make the key art and link preview.
5. `games.html` / `tests/page.test.js` / `tests/arcade.test.js`: check any "Trench Board" wording (none found in a grep
   of `*.html` besides the tools above; re-grep after).
6. CLAUDE.md: the standing rule "never the real terminals' names, logos or art" becomes "parody names and our own marks
   (the owner's, 2026-10-21); never their logos or art, never a link". Log the Fomoo → Phomo change and why.
7. Never: their logo files, their mascot art, screenshots, `gmgn.ai`/`pump.fun` style domains for our names, or a fake
   "official" badge.

## 7. Sources (as reached)

- GMGN: github.com/GMGNAI (org avatar), github.com/GMGNAI/gmgn-skills (banner, static images, chain list), x.com/gmgnai,
  play.google.com/store/apps/details?id=com.gmgn.app, brandfetch.com/gmgn.ai [S], coincodecap.com/gmgn-review [S].
- pump.fun: raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn/
  (logo.png, info.json), brandfetch.com/pump.fun [S], loftlyy.com/en/pump-fun [S], 1000logos.net/pump-fun-logo [S],
  blocknavi.net pump.fun logo history [S], x.com/pumpdotfun.
- Axiom: ycombinator.com/companies/axiom [S], docs.axiom.trade/axiom/finding-tokens/pulse [S], coinbureau.com axiom
  review [S], a public Axiom-look clone's `globals.css` / `tailwind.config.ts` / screenshot (downloaded to
  `research/dl/axclone/`) [C, unofficial].
- BasedBot: basedbot.io, docs.basedbot.app [S], coinboom.net/coin/based-bot-2 [S].
- fomo: fomo.family, apps.apple.com/us/app/fomo-never-miss-out/id6450858186, privy.io blog, quicknode builders guide,
  airdropalert.com fomo pages, f4.fund/startups/fomo-family [S].
- Name checks: dexscreener.com/solana/g3kydb6fxgrrbky1x6ireaneuvob5ywrooddh5qnbgcp (GNGM); malwaretips.com fomoo.family
  scam, pcrisk.com fake fomo scam, phantom.com FOMOO token, x.com/FOMOOcoinn (Fomoo); apps.apple.com/app/id6745925741
  and coincodex.com/crypto/pomo (Pomo); WebSearch with no hits for "pomp.fun", "plump.fun", "Phomo", "Fomu" (crypto),
  "FOMOH" (2026-10-21).
- Downloaded reference images (never to ship): `/tmp/claude-0/-home-user-agi-ecosystem/3a68cf55-88eb-5b1b-9a13-4a2b793da4f7/scratchpad/research/dl/`.
