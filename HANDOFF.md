# HANDOFF: AGI games and TRENCHING SIMULATOR (2026-10-22)

The owner paused the work here so another agent can continue the same project. Read this file first, then `CLAUDE.md`
(the project's own notes, about 13,000 lines: its hard rules, every feature, setup steps, the decisions log). Where this
file and `CLAUDE.md` disagree about the work below, this file is newer. Where a research note in `handoff/research/`
disagrees with either, the research note is older (it was written before some decisions were made).

**Don't start again.** Milestone 1 is done, tested and pushed. Build the rest on top of it.

---

## 0. Where things are

| | |
|---|---|
| Repository | https://github.com/agiartificialintelligence76-stack/agi-ecosystem (private) |
| Working branch | `claude/blissful-davinci-bnr01m` |
| Commit before this handoff | `959259ecf1a207e50c91d475c2789281b56f8506` ("TRENCHING SIMULATOR: parody terminal names and marks; Her world (08)") |
| What `main` holds | The same commit `959259e`, pushed to `main` (the owner had chosen "Straight to main"). **Every push to `main` deploys to Vercel, live at https://agi1.app.** Whether Vercel's deployment of `959259e` went to "Ready" wasn't checked |
| This handoff's commit | On the working branch only: `HANDOFF.md` and `handoff/` (research notes and a chart sketch). **Not on `main`, not deployed** (the owner: "Do not force-push, merge, or deploy") |
| Live site | https://agi1.app (Vercel project `agi-ecosystem`). The game: https://agi1.app/games/trenchingsimulator |

---

## 1. The owner and how to work with them

- The owner works alone, is learning, and writes quickly with typos. Explain what you're doing and why, in simple words.
- **Ask before** any big design decision, any new service, and anything that costs money (AskUserQuestion with a
  "(Recommended)" first option works well with this owner).
- Hard rules are in `CLAUDE.md` ("Hard rules"). The ones that matter most for this work:
  - Play money only, no prizes, **not financial advice**. Never a link or button to buy a real coin; a real coin's address
    only as its first 6 characters.
  - The exact safety note `Play money only. Not affiliated with any real trading terminal. This game never asks for a
    wallet.` (`SAFETY_NOTE` in `src/games/trenchingsimulator/terminals.js`) stays on every screen around a run.
  - **Never copy a real terminal's logo, mascot, art, CSS or text.** Layout and workflow may look like them; names are
    parody sound-alikes; marks are drawn in code (`brands.js`). Names are text only, never links (".fun" auto-links on X
    and Telegram: never in a share post).
  - No secrets in front-end code or git; the browser never writes to the database (writes go through `/api`); no
    automatic posting; PG-13; costs near $0.
  - The CSP allows no inline scripts or styles: styles only through classes and the CSS object model.
  - Vercel's 12 functions are all used: new server work for games goes in `/api/wallet` (`server/arcade.js`).
  - The owner runs any SQL in Supabase and `relay.sh update` on their server themselves. New server code must **fail soft**
    (say "opens soon", never crash) until they do.
  - Tests must pass on Node 20, 22 and 24, with and without Vercel's settings, with the clock moved forward, and in a
    clean Vercel-like build (see section 7).
  - Visitor-facing words never name AI services. No model names in commits, comments or pushed files.
- Git: develop on `claude/blissful-davinci-bnr01m`. Push with `git push -u origin claude/blissful-davinci-bnr01m`. Don't
  open a pull request unless the owner asks. Pushing to `main` deploys: only when the owner says so. End commit messages
  with the attribution lines the session gives you.
- `CLAUDE.md` says "Claude never runs git in this folder": that rule is about the owner's own PC folder (the Claude
  desktop app's link to it). In a cloud session, git in the session's own clone is fine.

---

## 2. The owner's goal (the request this work comes from)

Verbatim, from the chat (2026-10-21):

> xontinue ahat youre doing
>
> then the next terminal you doing is gmgn, i want it the literally exact same interface, the settings, the pnl card, the
> kols the chart design, the smoothness of it no lag,trading view etc. add what everything i missed, i just want
> everything so when they use it and play it looks like gmgn. but these time use a parody names, parody logo, parody
> branding of that terminal gmgn make it really as close as possible and for each terminal so i can use it for my game
> trenching simulator instead of their current names like trench board etc(i really dont want that). and take your time
> (make this a better prompt then continue doing this ), i just checked there are other chains on gmgn right add that
> also if i have to add api key again on each chain like the helius api so it tells live coins tell me that also if not
> needed you can ignore i just want it closely as the terminal as possible and when they play. that's it just two
> terminals for now. and also i forgot to say they can enter their custom name before playing just like in the real
> terminal (just optional). and also add a leaderboard (also add leaderboards with names , optional to the game ride em
> agi also)
> and also add the mutiplayer too only on trenching simulator, they can invite players via link idk whats better (no
> wallet needed when they invite)
>
> and add AGI Games and Roadmap to her world in the front page
>
> that github repository is connected to my vercel wesbite( if you could do it git push it yourself)
> (make this a better prompt then continue.)

### 2.1 The better version of that request (what was agreed)

1. **Parody names, marks and branding for all five terminals** (replacing "Trench Board", "Trench Scan" and the rest).
   **Done.**
2. **A second playable terminal, GNGM**, laid out and working like GMGN's web terminal as closely as the rules allow:
   - its three-column "Trenches" board;
   - a token page with a TradingView-style chart;
   - its trade module and settings;
   - KOL and smart-money trades;
   - wallet profiles;
   - a PnL share card;
   - smooth updates with no lag;
   - its phone layout.

   **Only two playable terminals for now:** Pomp.fun (built before) and GNGM. **Not built yet.**
3. **GMGN's other chains in Live mode.** Tell the owner whether a chain needs an API key like Helius. The research
   answer: **no new key is needed** (section 5.5). **Not built yet.** The owner hasn't been told this answer yet: tell them.
4. **An optional player name**, entered before playing, like a real terminal's username. **Not built yet.**
5. **Leaderboards with names**, for TRENCHING SIMULATOR and for Ride 'Em, AGI!. **Not built yet.**
6. **Multiplayer for TRENCHING SIMULATOR only:** invite players by a link, no wallet needed. **Not built yet.**
7. **AGI Games and Roadmap in the front page's "Her world" list.** **Done.**
8. **Push it yourself.** Milestone 1 was pushed to `main`. This handoff is on the working branch only.

### 2.2 The owner's choices in the chat (AskUserQuestion answers, 2026-10-21)

| Question | The owner's answer | What it means |
|---|---|---|
| Parody names | **"Sound-alikes"** | GNGM (GMGN), Pomp.fun (pump.fun), Axium (Axiom), BasedBott (basedbot), Phomo (fomo). Claude picked Phomo over "Fomoo": `fomoo.family` is a known wallet-drainer phishing site and $FOMOO is a live coin. The owner was told |
| Multiplayer | **"Same-market race (Recommended)"** | Everyone in a room plays the same seeded made-up market from the same start, each with their own play money; a live ranking of the room through the relay; invite by a link with a room code; no wallet, no sign-in |
| Leaderboard | **"Checked runs only (Recommended)"** | TRENCHING SIMULATOR: only the daily market and challenge runs, each **replayed on our server** from its order log before it counts. Ride 'Em, AGI!: sanity checks on a ticketed run. **Live mode and free play are never ranked** |
| Going live | **"Straight to main"** | The owner wanted pushes to go to `main` (live). **This handoff's own instruction overrides it for the handoff push: don't deploy.** Ask before the next push to `main` |

### 2.3 Other decisions made in chat (not all in `CLAUDE.md` yet)

- **Terminal ids never change.** Only the names did: `chat` = BasedBott, `scan` = GNGM, `board` = Pomp.fun, `pro` = Axium,
  `social` = Phomo. The ids are in saves, URLs, CSS and tests. (A research note suggests new ids: ignore that.)
- **GNGM's chart uses TradingView Lightweight Charts™** (`lightweight-charts`, exact version `5.2.1`, Apache-2.0),
  loaded as a lazy chunk only on GNGM's coin page:
  - `layout.attributionLogo: false`. Its default (`true`) puts an image link to tradingview.com in the chart, which
    the CSP and the game's "no link" tests refuse.
  - The license's attribution as our own text instead, under the chart and in How to play:
    `Charts: TradingView Lightweight Charts™ · Copyright (c) 2025 TradingView, Inc.`, with a link to
    https://www.tradingview.com/. That needs one narrow exception in `tests/trench-live.test.js`'s "no link" check,
    for that URL only.
  - `build: { license: true }` in `vite.config.js`, so the license ships with the build.
  - Pomp.fun keeps its own canvas chart (`chart.js`).
- **GNGM is not a pixel-perfect copy.** It has GMGN's layout and workflow with our own colors (`terminals.js` 'scan'
  colors), our own mark (a sleepy pixel toad in a nightcap) and our own words.
  - No "Sandwich shield" or MEV toggle: the game's sandwich bots are off, and a toggle that does nothing would be a lie.
  - The PnL card never has a QR code or a referral link.
- **The Ethereum question:** `CLAUDE.md` says Live mode is "never Ethereum" (twice), with no reason recorded. The owner
  asked to add GMGN's chains, and GMGN has Ethereum. So add Ethereum and change both of those lines in the same push.
  Mention it to the owner.
- **Ride 'Em, AGI!'s code is written by a tool.** Its leaderboard hook goes into `tools/games/import-rideemagi.mjs`'s
  PATCHES, and is applied to `src/games/rideemagi/game.js` too. Never hand-edit `game.js` alone.

---

## 3. Status

### 3.1 Finished, tested and pushed: Milestone 1 (commit `959259e`, on the branch and on `main`)

- **Parody names and marks.** `src/games/trenchingsimulator/brands.js` (new) draws each mark as plain SVG shapes in code,
  each with its own joke, and two-color wordmarks:
  - GNGM: a pixel toad in a nightcap ("GN, GM").
  - Pomp.fun: a pill with a gold crown.
  - Axium: three bars a little off balance.
  - BasedBott: a chat-bubble robot with two antennae.
  - Phomo: a noodle bowl whose chopsticks make an up-arrow.

  Its helpers: `brandOf`, `markEl(id, cls)`, `wordEl(id, cls)` and `MARK_TAGS`.
- **Where the names show.** `terminals.js` has the names and taglines, and GNGM's full color set ('scan' is still
  `ready: false`). Pomp.fun's header (`boards/board.js`) and the terminal cards (`shell.js`) show the mark and wordmark.
- **Pictures made again** with the new names:
  - the key art, `src/games/trenchingsimulator/keyart.webp`;
  - the link preview, `public/cards/trenchingsimulator.jpg` (147,169 bytes, under the 154,000 limit);
  - the screenshots `tools/games/trench-art/board.webp` and `coin.webp`.
- **"Her world (08)"** on the front page (`index.html`, `src/styles/landing.css`): AGI Games (/games, mint) after AGI
  Studio, and Roadmap (/roadmap, honey) before AGI on X. Rows are a little tighter on short computer screens. There's a
  padding fix for the lab look at 1280×720.
- **Tests updated:**
  - `tests/trench-game.test.js`: the names, the marks (plain shapes only), and the old "Trench …" names kept out;
  - `tests/landing.test.js`: 8 rows;
  - `tests/trench-live.test.js`: comments only.
- **`CLAUDE.md`:** the names everywhere, a "Parody names and marks" part under "TRENCHING SIMULATOR", "Her world (08)",
  and two rows in the decisions log dated 2026-10-22.

### 3.2 Partly done: GNGM (task 3)

The design is complete; **no GNGM code exists yet**. Where the design lives:

| What | Where |
|---|---|
| How it should look | section 5 of this file, and `handoff/research/gmgn-web.md` and `gmgn-live.md` |
| How it plugs into the game | `handoff/research/code-game.md`: the board contract, module APIs, file plan, gotchas |
| The chart | `handoff/research/tv-charts.md`, and `handoff/gchart.sketch.js`: a tested sketch of the chart wrapper, written for a scratch test app (its `import ... from './format.js'` must point at the game's `format.js` once it moves into `src/games/trenchingsimulator/boards/`) |

### 3.3 Missing (not started)

- the optional player name;
- leaderboards (both games: server, SQL and UI);
- multiplayer race rooms;
- GMGN's other chains in Live mode;
- `CLAUDE.md` notes for all of these;
- telling the owner the API-key answer.

### 3.4 Known open items (not this handoff's work, but true now)

- **First blood's words don't match its goal.** It says "any profit counts", but it's won at 1.05 SOL. The owner's call
  (it's in `CLAUDE.md`'s Open questions).
- **`public/cards/games.jpg`** (agi1.app/games's link preview) still shows only Ride 'Em, AGI!. Its words say so, so
  it's true; a new one wasn't asked for.
- **Vercel's deployment of `959259e`** wasn't checked (Vercel → agi-ecosystem → Deployments → should say Ready).

---

## 4. The exact next small milestone

**Milestone 2a: extract `src/games/trenchingsimulator/boards/common.js` from `boards/board.js`, with no change in
behaviour.** Move the helpers both terminals need into it, and have `board.js` re-export them:

- `SORTS`, `ORDER_ERRORS`, `whoText`, `holderTag`, `buyPresets`, `parseAmount`;
- the quick-buy and amount parsing, the order-error words, the age and number helpers it uses.

Tests import these from `board.js`, so they must stay exported there. Then:

1. Add `boards/common.js` to the Live files list in `tests/trench-live.test.js` (around lines 1492–1520). That list
   forbids `innerHTML`, `window.open` and real links in those files.
2. Run `npm test`: expect 1008 pass, 0 fail, 4 skipped, as before.
3. Commit on the working branch.

### 4.1 Prioritized checklist after that

1. **`boards/gngm-data.js`**: pure and tested in Node (a new `tests/trench-gngm.test.js`, added to `package.json`'s test
   list). It holds:
   - card metrics and the filter presets (safe, smart-money, strict);
   - activity labels (New Holder, Buy More, Sell Part, Sell All);
   - traders' PnL from holders' in and out;
   - the security checklist from `info(id)`;
   - the first 70 buyers from holders' `at`;
   - a wallet profile from `smartWallets()` and the KOLs (7D/30D PnL, win rate, distribution buckets >5x, 2–5x, 0–2x,
     −50–0%, <−50%);
   - P1–P3 settings presets;
   - indicators (MA, EMA, RSI, MACD);
   - `aggregate`, `valueOf`, `formatterFor` (from the sketch).

   **Live coins have no holders, dev or KOL data** (null, `[]`): show "—", never made-up numbers (hard rule 8).
2. **Add `lightweight-charts`:**
   - `npm install --save-exact lightweight-charts@5.2.1`;
   - allow it in `tests/clips.test.js`'s package check;
   - `boards/gchart.js` from `handoff/gchart.sketch.js`, loaded with `import('./gchart.js')` only on GNGM's coin page,
     with `attributionLogo: false`;
   - the text credit and the narrow test exception;
   - `build: { license: true }`.
3. **`boards/gngm.js`**, with `mountGngm(host, ctx)` returning `{ update, sub, closeSub, destroy, el }`, the same
   contract as `mountBoard` (section 5.1). Views:
   - Trenches: three columns, New / Almost bonded / Migrated, each with its quick-buy amount, filters and pause-on-hover;
   - Trending; Track (the KOL and smart feed); Holding;
   - the token page: header stats; the chart with its toolbar (1s 15s 30s 1m 5m 15m, Price/MCap, USD/SOL, B/S
     bubbles, the migration marker); bottom tabs Activity · Traders · Holders · Dev Token · Position / Orders; the right
     column with the trade module (Buy/Sell; Market / Limit / Auto; 4 preset amounts; 25/50/75/100%; "Take my initial";
     P1–P3), the security checklist, pool info and the first-70-buyers grid;
   - the wallet profile;
   - settings, the player name among them;
   - hotkeys: "/" for search, hold Z + a row number, Space + column + row;
   - the phone layout: tabs and a bottom sheet.

   Rules for it:
   - Updates through `keyed()`, `setText` and `flag` from `ui.js`, never rebuilding rows in `update()`.
   - CSS in `trench.css` with a `.tsg-` prefix. `tests/intro.test.js` pins `page.js`'s imports to `['../intro.js',
     './trench.css', './shell.js']`, so there's no new CSS file.
   - `tests/trench-live.test.js`'s selector rule `/^\.tsb?-|^html\[data-page='trenchingsimulator'\]/` must allow
     `tsg-`.
   - It must contain `` `CA ${f.mint.slice(0, 6)}…` ``, must match /play money/, and must have no `el('a'`.
   - Add `boards/gngm.js` and `boards/common.js` to the Live files list.
   - `paintTerminal` sets only the color keys it's given: GNGM defines the full set already in `terminals.js`.
4. **Wire it in `shell.js`** (around line 578, `mountPlay`):
   - `const BOARDS = Object.freeze({ board: mountBoard, scan: mountGngm })`;
   - mount `BOARDS[t.id] || mountBoard` with the same ctx plus `terminal: t`;
   - `ready: true` for 'scan' in `terminals.js`;
   - a per-terminal PnL card drawer in `saveCard`: 1200×630, the parody mark, ticker, big PnL %, invested / sold /
     profit, the player's name, the safety foot, never a QR code.
5. **The optional player name:** localStorage `agi_player_name`, shared by both games, checked like a review name
   (`reviewName()` in `server/arcade.js`; the same rules in the page). Asked on the run's brief and in settings, never
   required.
6. **Leaderboards** (design in `handoff/research/code-leaderboard.md`, section 5.3 below).
7. **Multiplayer race rooms** (design in `handoff/research/code-relay-chains.md` B, section 5.4 below).
8. **Live chains** (`handoff/research/code-relay-chains.md` C, section 5.5 below).
9. **Finish up:**
   - update `CLAUDE.md` (TRENCHING SIMULATOR, AGI games, Project structure, Security & cost rules, the Free-tier budgets
     table, Open questions, the decisions log);
   - run the full test matrix and a clean Vercel-like build (section 7);
   - make the key art and link preview again if GNGM should show in them;
   - ask the owner before pushing to `main`;
   - give the owner the steps they must run themselves: `supabase/arcade.sql` again, and `relay.sh update` on their
     server.

---

## 5. Architecture and design

### 5.1 TRENCHING SIMULATOR today (`src/games/trenchingsimulator/`)

- **The engine (`engine.js`)** is deterministic: a seed plus the player's orders make the whole made-up market (no
  `Date`, no `Math.random`).
  - `STEPS_PER_S = 10`.
  - `createMarket({ seed, solUsd, startSol, config, live })` and
    `replay({ seed, solUsd, startSol, config, log, until })`.
  - `KEEP`: candles 4000, trades 120, tape 400, feed 300, equity 7200.
  - Orders are logged as `{ n, coin, side, sol, frac, slippage, priority }`.
- **What a board can read:**
  - `lists({ limit ≤ 100 })` returns new / stretch / migrated / trending / bump / koth;
  - `stats(id)`, `info(id)`, `holders(id, n)`, `smartWallets()`, `trades(id, n)`;
  - `candles(id, since)`: one-second candles `{ t, o, h, l, c, v, b, s }` of market cap in SOL;
  - `comments`, `tape`, `readFeed`, `find`, `positions`, `orders`, `quote`, `log()`.

  Feed kinds include kol_buy, kol_sell, smart_buy, smart_sell and whale_buy.
- **A run (`run.js`)** owns the clock, orders, events and how it ends. **The shell (`shell.js`)** owns every screen and
  mounts the terminal's board.
- **The board contract** (`boards/board.js`): `mountBoard(host, ctx)` returns
  `{ update(ts), sub(), closeSub(), openCoin(id), destroy(), el }`.
  - Its refresh rates are `FAST_MS` 250 and `SLOW_MS` 650.
  - The ctx `shell.js` passes, verbatim:

    ```js
    P.board = mountBoard(boardHost, {
      run, market: run.market, currency: cur, solUsd: px, start: run.start, colors: t.colors, reduceMotion: reduceMotion(),
      settings: () => ({ slippage: S.save.slippage, priority: S.save.priority }),
      order: (p) => run.order({ slippage: S.save.slippage, priority: S.save.priority, ...defined(p) }),
      openSettings: () => openSettings({ pause: false }),
      sort: run.live && run.live !== 'solana' ? 'new' : 'bump',
      onCoin: (id) => { if (typeof run.market.focus === 'function') run.market.focus(id); },
      pushSub: () => history.pushState({ ts: 'play', sub: true }, ''),
      popSub: () => { S.expectPop++; history.back(); },
    });
    ```
- **`ui.js`** gives `el(tag, attrs, ...kids)`, `setText`, `flag`, `keyed(host, items, keyOf, make, update)`, `icon` and
  `toast`.
- **Live mode** lives in `live-chains.js`, `live-feed.js` and `live-market.js`. `LIVE_OPEN` is `true` (opened
  2026-10-21). Its relay runs on the owner's Hetzner server at wss://live.agi1.app.
- **Tests that guard all this:**
  - `tests/trench.test.js` (the market);
  - `tests/trench-game.test.js` (the game; 33 tests);
  - `tests/trench-live.test.js` (Live mode; it also pins the CSP and forbids links, `innerHTML`, `window.open`);
  - `tests/intro.test.js` (`page.js`'s imports);
  - `tests/launch.test.js:1873` (the exact CSP string).

### 5.2 GNGM's look (from the research; details in `gmgn-web.md`)

- **Top nav:** Trenches · Trending · Track · Holding. Then the search ("/"), a chain pill, the balance and the settings.
- **Trenches** has three columns:
  - New: on the bonding curve, newest first;
  - Almost bonded: high curve %;
  - Migrated.

  Each card shows its picture, ticker and name, age, MC, volume, holders, top-10 %, dev %, snipers, a curve-progress
  ring, social icons (shown, never links) and a quick-buy button with the column's amount.
- **The token page:**
  - its header: ticker, name, age, `CA` and the first 6 characters, MC, liquidity, 24h volume, holders, top-10 %;
  - the chart (Lightweight Charts) with its toolbar;
  - the bottom tabs;
  - the right column, as in the checklist (4.1, step 3).
- **Chart palette:**

  | Part | Color |
  |---|---|
  | Background | #0d0d0f |
  | Grid | rgba(255,255,255,0.04) |
  | Border | #1f2024 |
  | Text | #8a8d93 |
  | Strong text | #eaecef |
  | Up | #16c47f |
  | Down | #f2495c |
  | Volume | up and down at 0.35 alpha |
  | Crosshair | #5d616b |
  | Labels | #2a2d35 |
  | Migration | #f5b83d |
- **How the chart works:**
  - Time is whole seconds: `time = Math.round(base / 1000) + t`, with local-time formatters.
  - Price mode uses `minMove` 1e-13 and the subscript-zero formatter (`price(v, 4)` in `format.js`).
  - Timeframes are `[1, 15, 30, 60, 300, 900]`, up to 15 minutes because `KEEP.candles` is 4000.
  - The value shown is `valueOf(mcSol, { mode, unit, solUsd }) = mcSol * (unit === 'usd' ? solUsd : 1) / (mode ===
    'price' ? 1e9 : 1)`.
  - B/S bubbles are a series primitive; the migration marker uses `createSeriesMarkers`.
  - The toolbar and the legend are DOM elements, the legend following `subscribeCrosshairMove`.
  - Measured: about 55 KB gzipped, about 1 ms an update, 60 fps.
- **GNGM's own colors** (in `terminals.js`, 'scan'):

  | Key | Color | Key | Color | Key | Color |
  |---|---|---|---|---|---|
  | bg | #0d0d0f | panel | #17181a | panel2 | #1e1f22 |
  | panel3 | #26282c | line | #222326 | line2 | #2e3034 |
  | text | #eaecef | soft | #c9ccd1 | muted | #9a9ea5 |
  | dim | #8d9198 | hero | #ffffff | accent | #9fdc55 |
  | onAccent | #10200a | up | #2ad48a | down | #f65d71 |
  | onDown | #2a0a10 | warn | #f5b83d | info | #5fb0ff |
  | violet | #a99bff | | | | |

  Every text pair must pass WCAG AA 4.5:1; check it like Pomp.fun's (`CLAUDE.md`, decisions log 2026-10-21).

### 5.3 Leaderboards (design: `handoff/research/code-leaderboard.md`)

- Everything goes in `/api/wallet` (`server/arcade.js`, `api/wallet.js`).
- **TRENCHING SIMULATOR: an exact replay with a server ticket.**
  - `POST game-ticket` returns `{ ticket, seed, solUsd, startSol }`, an HMAC'd ticket using `PASS_SECRET`. A challenge's
    seed is 128 random bits; the daily seed is `dailySeed(UTC date)`.
  - `POST game-score` sends the order log packed as `n36,coin36,side,amount,slip,prio`, at most 1000 orders. That
    request's body may be up to 48 KB; every other `/api/wallet` request stays at 6000.
  - The server replays it with `engine.js`'s `replay()` (measured at 0.15–1.4 s), then ranks it.
  - **One divergence must be fixed first.** `run.js`'s tick must step exactly like the replay. The fix:

    ```js
    const target = R.us / 1e6;
    if (!real && typeof market.step === 'function') {
      const goalN = market.n0 + Math.floor(target * STEPS_PER_S + 1e-9);
      let steps = 0;
      while (!R.over && market.n < goalN) {
        market.step(); steps++;
        R.clock = (market.n - market.n0) / STEPS_PER_S;
        checkOrders(); checkFeed(); checkWorth(); checkGoal();
        if (!R.over) checkTime();
        if (!R.over) checkBust();
      }
      if (!R.over) { R.clock = target; checkTime(); if (!R.over) checkIdle(); }
      return steps;
    }
    ```
  - Boards: `daily:<date>`, `c:<id>:all`, `c:<id>:w<Monday>`. A win ranks by time used (fewer seconds first), then by
    its multiple. Rug dodger ranks by its multiple.
  - Live mode and free play are never ranked.
- **Ride 'Em, AGI!: a ticket plus sanity checks.**
  - The checks: age ≤ 2 h, distance ≤ 60000, revives ≤ 2, score ≤ 40·distance + 5000, score ≥ distance,
    bestMult ≤ 5, ms ≥ 1000·distance/52, the daily date ±1 day and its mod key.
  - The hook: in `tools/games/import-rideemagi.mjs`'s PATCHES, after `    const out = Prog.apply(r);\n` add
    `    Site.result(r, st);\n`. Make the same change in `src/games/rideemagi/game.js`, and add a test that every PATCHES
    new text is in `game.js`.
  - Boards: `e:all`, `e:w<Monday>`, `e:d<date>`, `m:<date>`.
- **SQL, added to `supabase/arcade.sql`.** Keep it generic: no game names, nothing dropped.
  - New tables: `agi1_arcade_scores`, `agi1_arcade_tickets_used`, `agi1_arcade_score_days`.
  - Functions go from 8 to 13: `arcade_ticket_take`, `arcade_board_cut`, `arcade_score_put`, `arcade_board`,
    `arcade_score_mine`, `arcade_score_hide`.
  - It ends with `arcade_functions_found = 13`. `tests/arcade.test.js` checks the file names no game.
  - The owner runs it in Supabase; until then the boards say "opens soon".
- **Reading a board:** `GET /api/wallet?board=<game>:<board>`, cached 60 s by the CDN.
- **Limits:**
  - a burst limit, `scoreBurst`: 12 a minute;
  - per visitor a day: 60 tickets and 30 submits;
  - for the whole site a day: 2,000 replays.
- **Names:** `agi_player_name` (optional), checked with `reviewName()`. "A player" when there's none.

### 5.4 Multiplayer race rooms (design: `handoff/research/code-relay-chains.md` B)

- On the existing relay (`tools/trench-relay/`), a new WebSocket path `/room`, in `lib/rooms.mjs` with
  `server.mjs` routing to it.
- A room has a 6-character code. Its creator gets an invite link: `agi1.app/games/trenchingsimulator#room=<code>` (a
  fragment, so it never reaches a server's logs).
- Everyone plays the same seed and start. Each player's client sends its worth every few seconds; the relay keeps the
  room's standings and sends them to everyone. Names come from `agi_player_name`.
- No wallet, nothing kept after the room expires. There are caps per room and per address. JSON messages are ≤ 1 KB with
  `v:1`.
- The game side: a new `src/games/trenchingsimulator/race.js`, mirroring `createLiveFeed`, and a new
  `tests/trench-race.test.js`.
- **The owner must run `sh tools/trench-relay/relay.sh update` on their server** after it's pushed. Until then the game
  says rooms aren't available, and the single-player game works as before.
- Its CPU and memory budget against the CX23 (the relay is capped at `--cpus 0.75 --memory 512m`) is in B.6 of the note.

### 5.5 GMGN's other chains in Live mode (design: `handoff/research/code-relay-chains.md` C)

- **No new API key is needed.** Add the chains the way BNB Chain and Base already work: DexScreener's keyless token
  profiles and its `/tokens/v1` markets. The only key in the relay stays Helius, for Solana. Tell the owner this.
- **Order:**
  1. Add ethereum, monad and hyperevm first (their DexScreener ids are verified on the web), and arbitrum (its
     long-standing id).
  2. Then tron. Its addresses are base58 `T…` and case-sensitive: never lower-case them.
  3. Add xlayer and megaeth only after a `/health` tally on the owner's server shows DexScreener lists coins under those
     ids.
  4. Skip arc and stable.
- **Native coins and their prices:**
  - Ethereum, Arbitrum and MegaETH reuse ETH's price;
  - HyperEVM: HYPE, via WHYPE `0x5555555555555555555555555555555555555555`;
  - Monad: MON, via WMON `0x3bd359c1119da7da1d913d1c4d2b7c461115433a` (about $0.02, so it needs more digits);
  - X Layer: OKB, via WOKB `0xe538905cf8410324e03a5a23c1c177a474d59b2b`;
  - Tron: TRX, via WTRX `TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR`.
- **The files to change, line by line,** are in C.4 of the note:
  - the relay: `config.mjs` `CHAIN_IDS`; `hub.mjs` `PREFIX`, `ID` and `QUIET_MS`; `sources/dex.mjs`; `parse.mjs`
    `WRAPPED`, `PRICE_RANGE` and `parseProfiles`; `fakes.mjs`;
  - the game: `live-chains.js` (`CHAINS`, `ID`, address checks, `parseCoin`, the `px` keys, `liveCurrency`), and the
    units and symbols in `format.js`;
  - tests: fixtures in `tests/trench-live.test.js`.

  The note's step 6 says to rename terminal ids in `liveCurrency()`: **don't** (section 2.3).
- **Ethereum:** change `CLAUDE.md`'s two "never Ethereum" lines in the same push.

---

## 6. Important files, dependencies and versions

| Path | What |
|---|---|
| `CLAUDE.md` | The project's notes: hard rules, every feature, setup steps, the decisions log. Its "TRENCHING SIMULATOR", "AGI games" and "Working in this repo" parts matter most here |
| `src/games/trenchingsimulator/` | The game. The engine and market: `engine.js`, `curve.js`, `fates.js`, `names.js`, `rng.js`. The run and shell: `run.js`, `shell.js`. The terminals: `terminals.js`, `brands.js`, `boards/board.js` (Pomp.fun). Also `chart.js`, `results.js`, `share.js`, `save.js`, `format.js`, `ui.js`, `trench.css`, and Live mode's `live-*.js` |
| `src/games/rideemagi/` | Ride 'Em, AGI!. `game.js`, `game.css` and the markup in `rideemagi.html` are written by `tools/games/import-rideemagi.mjs`: don't hand-edit them |
| `src/games/page.js`, `games.html`, `src/games/list.js`, `src/games/words.js` | agi1.app/games: its cards, ratings, reviews |
| `server/arcade.js`, `api/wallet.js`, `supabase/arcade.sql` | Games' plays and reviews; where the leaderboards go |
| `tools/trench-relay/` | Live mode's relay (its own `package.json`: ws 8.21.0, sharp 0.35.5, exact), Caddy, `relay.sh`; runs only on the owner's server |
| `tests/trench*.test.js`, `tests/intro.test.js`, `tests/arcade.test.js`, `tests/page.test.js`, `tests/landing.test.js` | The tests most of this work touches |
| `handoff/research/*.md` | The research behind this file (section 9) |
| `handoff/gchart.sketch.js` | A tested sketch of GNGM's chart wrapper on Lightweight Charts 5.2.1 (`createGChart(host, { mode, unit, tf, colors, attribution })` → `{ chart, set, view, fit, toNow, redraw, destroy }`) |

**Versions:**

- Node: the site supports 20.19+ or 22.12+ (Vite 8). The tests must pass on 20, 22 and 24. This cloud container had
  Node 22.22.0 and Node 20 at `/opt/node20/bin`. Node 24.22.1 was downloaded to the session's scratchpad (gone after
  the session): use nodejs.org's `node-v24.x-linux-x64` tarball.
- `package.json`:
  - dependencies: `@ffmpeg-installer/ffmpeg` ^1.1.0, `@gltf-transform/*` ^4.5.1, `@scure/bip39` ^1.6.0, `opentype.js`
    ^2.0.0, `sharp` ^0.35.5, `three` ^0.186.0, `viem` ^2.56.8;
  - devDependencies: `vite` ^8.3.0 and `ws` 8.21.0 (only these two are allowed: `tests/clips.test.js`);
  - to add for GNGM: `lightweight-charts` 5.2.1 (exact).
- The relay: `tools/trench-relay/package.json` (Node ≥ 22, `ws` 8.21.0, `sharp` 0.35.5). Its Docker image is
  `node:22-bookworm-slim`, with Caddy `caddy:2.10`.

---

## 7. Commands

```sh
npm install                 # once
npm test                    # every test (about 55 s); the list is in package.json "test"
npm run build               # npm test, then vite build, share pages, secret check (what Vercel runs)
npx vite build              # just the build
npm run dev                 # local preview at http://localhost:5173 (no /api functions)
```

**Other Node versions:**

```sh
PATH=/opt/node20/bin:$PATH npm test
PATH=<node24>/bin:$PATH npm test
```

**With Vercel's settings:** export every name from section 8 with made-up values, then run `npm test`. Tests must
never depend on a setting being missing.

**With the clock moved forward:** a preload that shifts `Date`:

```js
// shim.mjs
const shift = Number(process.env.CLOCK_SHIFT_MS || 0);
if (shift) {
  const Real = Date; const realNow = Real.now.bind(Real);
  class Shifted extends Real {
    constructor(...a) { if (a.length === 0) super(realNow() + shift); else super(...a); }
    static now() { return realNow() + shift; }
  }
  globalThis.Date = Shifted;
}
```

Run it with:

```sh
CLOCK_SHIFT_MS=<ms> TZ=UTC NODE_OPTIONS="--import=/abs/path/shim.mjs" npm test
```

Try a few minutes before midnight UTC, a Monday, and a month's end. `npm test`'s output is TAP when piped (`# pass`
and `# fail` lines), not the "ℹ pass" a terminal shows.

**A clean Vercel-like build** (a copy with only the files git would push, a fresh install, Node 24):

```sh
TMP=$(mktemp -d); export GIT_INDEX_FILE=$TMP/index
git read-tree HEAD && git add -A && git checkout-index -a --prefix=$TMP/src/
unset GIT_INDEX_FILE
cd $TMP/src && npm install && npm run build   # with Node 24 and Vercel's settings exported
```

**TRENCHING SIMULATOR's key art and link preview:**

```sh
npm install --no-save playwright-core
npx vite build && node tools/games/trench-art.mjs   # --keep: only the two pictures again
```

It needs Chromium (`/opt/pw-browsers` here). Look at both pictures before keeping them; the JPEG must stay under 154,000
bytes.

**The relay, on the owner's server only:**

```sh
sh tools/trench-relay/relay.sh update|start|stop|check|logs|status
```

Locally, `node tools/trench-relay/fakes.mjs` runs stand-ins for its outside services.

---

## 8. Tests run, results, known failures

At commit `959259e`, before this handoff:

| Run | Result |
|---|---|
| Node 22.22.0 | 1012 tests: 1008 pass, 0 fail, 4 skipped |
| Node 20 | the same |
| Node 22 with Vercel-like settings (every name below with made-up values) | the same |
| Node 24.22.1 | the same |
| Clock moved, `TZ=UTC`: 2026-10-22T23:59:20Z (midnight), 2026-10-26T00:00:30Z (a Monday), 2026-10-31T23:59:40Z (a month's end) | 1008 pass, 0 fail each |
| Clean Vercel-like build (Node 24, Vercel-like settings) | exit 0, "share pages written for https://www.agi1.app", "secret check passed (92 files scanned, 13 secret values compared)" |

At this handoff's commit (only `HANDOFF.md` and `handoff/` added): see the commit message; `npm test` was run once again.

**The 4 skipped tests are expected:**

- the daily clips' workflow check (`.github/workflows/clips.yml` isn't in the repo);
- the launch video's music render (only with `PROMO_RENDER=1`);
- AGI Studio's launch video's music render and voice mix (only with `STUDIO_PROMO_RENDER=1`).

**Known failures:** none.

**One known harmless flake** (`CLAUDE.md`, "Tests pass on any day"): a test counting "today" that runs at the exact moment
00:00 UTC passes can fail once. Redeploy if a build at 00:00 UTC (8:00 the owner's time) fails on a "for today" count.

---

## 9. Environment variables (names only; never put values in git or chat)

Set in Vercel → agi-ecosystem → Settings → Environment Variables (Production), then **Redeploy**. Full descriptions are
in `CLAUDE.md` → "Environment variables". **This work added none.** The leaderboards use the existing `SUPABASE_URL`,
`SUPABASE_SECRET_KEY` and `PASS_SECRET`; the race rooms run on the relay.

- **Core:** `GEMINI_API_KEY`, `GEMINI_MODEL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `TURNSTILE_SECRET_KEY`,
  `VITE_TURNSTILE_SITE_KEY`, `PASS_SECRET`, `CRON_SECRET`, `CHAT_DAILY_CAP`, `CHAT_MIN_GAP_MS`, `ROBINHOOD_RPC_URL`,
  `SITE_URL`
- **Her voice:** `AGI1_VOICE`, `GEMINI_TTS_MODELS`, `GEMINI_TTS_MODEL`, `VOICE_DAILY_REQUESTS`, `VOICE_STREAM`
- **Telegram:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_DAILY_CAP`, `VITE_TELEGRAM_BOT`, `TELEGRAM_GROUPS`,
  `TELEGRAM_GROUP_DAILY_CAP`, `TELEGRAM_GROUP_POSTS`, `TELEGRAM_GROUP_WELCOME`, `TELEGRAM_BUYS`, `TELEGRAM_BUY_MIN`,
  `TELEGRAM_GAMES`, `GAMES_A_DAY`, `GAME_PRIZE`, `GAME_WINS_A_DAY`, `TELEGRAM_MUSIC`
- **Wallet keys (secrets):** `PRIZE_WALLET_KEY`, `LAUNCH_GAS_KEY`
- **Burns, the risk check and launches:** `BURN_PER_MESSAGE`, `BURN_DAILY_CAP`, `CHECKER_HIDE_PICTURES`, `PINATA_JWT`,
  `LAUNCH_GAS_MAX`, `LAUNCH_GAS_DAILY`, `LAUNCH_DAILY_CAP`, `LAUNCH_ONLY_FOR`
- **Her live show:** `LIVE_SECRET`
- **The studio:** `MESHY_API_KEY`, `FAL_KEY`, `FAL_BILLING_KEY`, `STUDIO_PAY_TO`, `STUDIO_ONLY_FOR`, `STUDIO_OPEN`,
  `STUDIO_OWNER`, `STUDIO_PRICE_USD`, `STUDIO_PRICE_AGI`, `STUDIO_A_MONTH`, `STUDIO_BURNS_A_MONTH`, `STUDIO_HIDE`,
  `STUDIO_VIDEO_PRICE_USD`, `STUDIO_VIDEOS_A_MONTH`, `STUDIO_VIDEO_MODEL`, `STUDIO_FACES`,
  `STUDIO_FREE_CREDITS_A_MONTH`, `STUDIO_JOBS_A_DAY`, `STUDIO_WEEKLY_PRIZE`, `STUDIO_SLOTS`, `STUDIO_SLOT_AGI`,
  `STUDIO_BOOST_AGI`, `STUDIO_MODEL_BURN_AGI`, `STUDIO_GIFTS`, `STUDIO_GIFTS_A_DAY`, `STUDIO_REFERRALS`,
  `STUDIO_REF_WELCOME`, `STUDIO_REF_PERCENT`, `STUDIO_REF_PER_FRIEND`, `STUDIO_REF_A_MONTH`, `STUDIO_CLEAN_AGI`

**Not in Vercel:**

- **The live show's settings** (`LIVE_*`, the X stream key, the Google Cloud key file) are on the owner's server in
  `/opt/agi1-live/live.env`.
- **The relay's settings** are on the owner's server in `/opt/agi1-trench/trench.env` (mode 600). Its only secret is
  `HELIUS_API_KEY`. Its other names are in `tools/trench-relay/trench.env.example`.
- **GitHub Actions:** one secret, `GEMINI_API_KEY`, for the daily clips.

---

## 10. Assets, services and permissions

**Already in the repo:**

- the parody marks (drawn in code, `brands.js`);
- the key art, link preview and screenshots (section 3.1);
- the games' fonts and pictures.

**External services this work uses** (all free, no new account):

- DexScreener's public API (keyless): Live mode's prices and new chains;
- Supabase (the site's own project): the leaderboards' tables, once the owner runs `supabase/arcade.sql` again;
- the relay on the owner's Hetzner server (wss://live.agi1.app): race rooms, once the owner runs `relay.sh update`.

**What only the owner can do:**

- push to `main` (live): ask first;
- run SQL in Supabase;
- run commands on the Hetzner server;
- every click in Vercel and at the domain.

The owner's local folder is `C:\Users\User\Desktop\AGI 3 ECOSYSTEM`. The repo is the same project.

**Only in the cloud environment this was written in** (not in git; gone when the session ends):

- The research notes' working copies and their raw downloads (GMGN's open-source `gmgn-skills` repo clone, DexScreener
  and npm downloads, a Lightweight Charts test app, benchmarks). **The notes themselves are copied into
  `handoff/research/`; the raw downloads aren't** (big, and not needed).
- The Node 24 binary used for testing.
- The clock-shift preload (its code is in section 7).
- A file of made-up Vercel settings for tests (no real values; rebuild it from section 9's names).

**Not reachable from this cloud environment:** gmgn.ai, x.com, web.archive.org and most of the web (the egress proxy).
So GMGN's look was researched from GMGN's open-source agent repo, search summaries and general knowledge, never from a
live screenshot. `handoff/research/gmgn-web.md` §17 suggests asking the owner for screenshots of the real terminal
before claiming "exact".

---

## 11. Research notes in `handoff/research/`

All written 2026-10-21/22, before some decisions.

| File | What it covers |
|---|---|
| `gmgn-web.md` | GMGN's web terminal screen by screen (with confidence tags), its brand (describe, never copy) |
| `gmgn-live.md` | GMGN reverse-engineered from its open-source client: chains, launchpads, filters, wallet tags, order types |
| `names.md` | The parody names (why Phomo, not Fomoo), the marks' jokes, risks of each name |
| `code-game.md` | The game's code map: module APIs, the board contract, `boards/gngm.js` architecture, rename gotchas, CSS facts, order of work |
| `code-leaderboard.md` | Leaderboards: determinism, replay measured, the one divergence and its fix, protocol, boards, SQL, names, anti-abuse, tests |
| `code-relay-chains.md` | The relay today, race rooms (protocol, standings, caps, client module, tests), GMGN's chains vs. Live mode (ids, prices, keys, file-by-file changes) |
| `tv-charts.md` | Lightweight Charts 5.2.1: size, license and attribution, CSP, the API for GMGN's chart, performance, theme, the tested module, integration notes |

Where a note says otherwise, these win:

- terminal ids never change;
- the names are final (GNGM, Pomp.fun, Axium, BasedBott, Phomo);
- the chart's attribution is our own text, with `attributionLogo: false`.
