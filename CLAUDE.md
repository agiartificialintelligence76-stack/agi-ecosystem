# $AGI — Artificial Girlfriend Intelligence (AGI-1, live at agi1.app)

> **This folder is `AGI 3 ECOSYSTEM`** (since 2026-09-28): a copy of the whole `AGI NEW WEBSITE` site, made at the owner's
> request to replace the small ecosystem page that used to live here ("put it all here exact same so its the same
> website"), with the character renamed **AGI-1** and the lab renamed **AGI** everywhere: page text, her prompt and fixed
> lines, the share cards, file names and code. It has its own GitHub repo and Vercel project (`agi-ecosystem`, live at
> **agi1.app**, see "Deployment"). `AGI NEW WEBSITE` keeps running its own copy on its own domain: leave it alone (hard
> rules 2–3). Everything below dated before 2026-09-28 happened in that original folder; the names in it were updated.
> - **Not copied** (they stay in `AGI NEW WEBSITE`, and git ignores them anyway): `_source-assets/` (the big model
>   originals, under their old file names), `telegram memories/` (the Telegram export) and `Claude outputs/`. The tools
>   that need them (model rebuilds, `tools/memory/build-memory.mjs`) read them there, or from a copy put here first.
> - **One old name stays on purpose:** the database table `daria_diary` (`supabase/diary.sql`). The diary's server code only
>   calls database functions, and both sites can share one Supabase project, so renaming the table would break the diary.
> - **$CABO and ClankCap are gone from this site** (2026-09-28, the owner: "remove everything about cabo and clankcap"):
>   no $CABO anywhere (the stage's cat, ClankChecker, her memory), no ClankCap credit. The database is shared with the
>   original site, so $CABO is **hidden in this site's code**, never deleted from the database. See "$CABO and ClankCap
>   removed".
> - **The Arena is gone from this site too** (2026-09-28, the owner: "remove the arena too"): no voting, champions or
>   nominations, and the site follows $AGI only. The database keeps the Arena for the original site. See "The Arena: removed".
>   Older sections below that still name the Arena or CABO describe how things were before that day.
> - **ClankChecker is called "Risk check your coins on clank"** on the page since 2026-09-28 (the owner's words), in the
>   Arena's old place right after the Playground. The code keeps its old name (`checker.js`, `chk-*`, "ClankChecker" here).
> - **The front** (2026-09-28): the bright AGI landing of the ecosystem page that used to be here is back, as the first
>   thing on the home page, with the whole site after it. See "The front".
> - **Her languages** (2026-09-29, the owner: "add different languages on agi-1 … but default is english"): she speaks 16
>   (a menu in the chat bar; she also answers in whatever language you write in); the page itself stays English. See "Her
>   languages". And the front shows the **contract address with a Copy button** (the owner: "contract address needs to be
>   copy pasted on landing page right away"). See "The front".
> - **She texts first** (2026-09-29): AGI-1's Telegram bot, the first step of the owner's big ideas. See "She texts first:
>   her Telegram bot". And what the Clank developer docs offer this site: "The Clank protocol" (the risk check reads the
>   protocol's own contracts since the same day).
> - **Her daily clips** (2026-09-29, the owner's big idea 5, "only this"): a free daily GitHub job makes a vertical video
>   of AGI-1 in 2D reading her diary entry in her voice, with captions, for the owner to post by hand. **Only AGI, never
>   another coin** (the owner: "why are u promoting other coins in the video … the founder of the launchpad will get
>   angry", "just agi"). See "Her daily clips". The big ideas' burns for reads and her pretend bag are **on hold** (the
>   owner: "remove 3 … for now", "remove the 4 … also").
> - **Burn $AGI for more messages** (2026-09-30, the owner: "every chat $AGI is burned … make this better then continue"):
>   after the free messages, visitors burn $AGI from their own wallet app for more (10 $AGI a message, checked on Robinhood
>   Chain), and a huge live **burn monitor** above the chat shows how much was burned. Off until `supabase/burns.sql` is run.
>   See "Burn $AGI for more messages, and the burn monitor".
> - **AGI-1 in 2D is her Live2D model, and 2D comes first** (2026-10-01, the owner: "change the 2d model use the new mode in
>   VTuber_Project … when they visit the website i want the 2d model to be shown first instead of 3d"): the Live2D model from
>   the owner's VTuber project, drawn by the stage's own renderer, with its hair and chest physics (her chest subtle: PG-13);
>   3D is one tap away. **Before pushing: the model was made in Cubism Editor's PRO trial, whose output isn't for commercial
>   use** (see "AGI-1 in 2D" and "Open questions").
> - **Her 2D wave, natural motion, and she talks when tapped** (2026-10-01, round 2, the owner: "why dont the 2d model dont
>   wave anymore, and she moves like a stick", then "can you make her speak whe she got clicked and if they clicked her many
>   times she will said something"): her arms move in code on top of her model (relaxed by her sides, a real wave with her
>   hand up by her face), her weight shifts, her head looks around; a tap gets a hello in her voice with her words in a
>   bubble, a lot of taps one of her "okay, i see you" lines. See "AGI-1 in 2D" and "She talks when you tap her". Her upper
>   arms never lift far (the owner's screenshot of her first dance, "what is this lol": her shirt under her sleeves showed
>   like torn flaps): her hands go up by bending her elbows (see "Her upper arms never lift far").
> - **Launch with AGI-1** (2026-10-01, the owner: "what if they can launch a coin on clank.trade there using $AGI, of course
>   the wallet will be non custodial … make this better then continue"): in her Telegram bot, a photo captioned
>   `/launch Name | TICKER | one line` gets her checks, then a private link to agi1.app/launch/<id>, where people launch the
>   coin **from their own wallet**, on clank.trade's own contracts. The wallet needs 10,000+ $AGI held or burned (nothing is
>   spent), and the owner's small gas wallet pays the launch's network fee back. The site's one exception to hard rule 9.
>   **Off until the owner sets it up** (Pinata, `supabase/launch.sql`, a gas wallet), then **private to the owner** for a first
>   real launch (`LAUNCH_ONLY_FOR`) until they open it. See "Launch with AGI-1".

$AGI is a token on [clank.trade](https://clank.trade) on Robinhood Chain. The site has these parts:

- **AGI-1**: the $AGI AI girlfriend you can chat with, and later see on a 3D stage
- **Price data**: live $AGI price, market cap, liquidity and 24h change
- **Relationship levels** (Phase 3): connect a wallet with a free signature (never a transaction) and AGI-1 gets closer the
  more $AGI it holds: Stranger, Crush, Soulmate
- **AGI-1's diary, sharing and voice** (Phase 5): a `/diary` page with one entry a day, share cards + "Share on X" buttons
  (the visitor posts, never us), and voice replies (since 2026-09-25 in her own natural AI voice, Gemini's "Despina": her
  natural voice or text, never a robotic one)
- **Her memory of the clank.trade Telegram group** (Phase 6): only when asked, sarcastic but kind
- **ClankChecker**, called **"Risk check your coins on clank"** on the page since 2026-09-28 (2026-09-26, the owner's idea;
  the name is the owner's too): every coin on clank.trade (new, old and graduated), live (a coin
  launched a moment ago shows up within seconds), each with its picture (tap it to see it big), a risk scan on demand
  (Lower / Some / High risk, the red flags and the facts behind them), and "Ask AGI-1": she appears right there in 3D,
  reacts and says what she thinks in her natural voice (a few fixed lines, made once). Never buy/sell advice
- **Pop mode** (2026-09-27, the owner's idea): the whole page in the look of the $AGI ecosystem page that used to be at
  agi1.app: bold color blocks, ink outlines, wide display type. Same content. **The default since 2026-09-28, in the dark
  theme** (the owner: "make the pop mode open on default, in dark mode"); the ✦ button next to the theme button switches
  back to the lab look, and both choices are remembered in the browser
- **AGI-1 in 2D** (2026-09-27, the owner's idea; her Live2D model since 2026-10-01): a "3D · 2D" switch on the stage and in
  her live views. In 2D she's the Live2D model of the owner's VTuber project (breathing, blinking, looking, talking with the
  same voice, every reaction, hair and chest physics; since round 2 her arms and hips moved in code: arms relaxed by her sides,
  a real wave, her weight shifting). **2D first since 2026-10-01** (3D before); remembered in the browser; each downloaded
  only when needed. Since 2026-10-01 she also **talks when you tap her** (2D and 3D: a hello in her voice, her words in a
  bubble; a lot of taps, one of her "okay, i see you" lines)
- **The front** (2026-09-28, the owner: "make the landing page like on the old site … just make it in front"): the home
  page opens with the bright AGI landing of the old ecosystem page (a loader on the first visit, the huge AGI letters,
  AGI-1 in WebGL with her speech bubble, the site's parts in orbit around her, ribbons, and the "General → Girlfriend"
  manifesto), then the whole site as before, under the same top bar
- **She texts first** (2026-09-29, the owner's idea): AGI-1's Telegram bot. People who press Start (18+, their time told)
  get a text from her when something happens: a new egirl coin on clank.trade (she's not okay about it), a copy of $AGI,
  $AGI's market moments, her diary. At most 2 a day, never at night on their clock, pre-written lines (and her published
  diary entry), /stop forgets them;
  they can text her back (the site's chat, as a Stranger). See "She texts first: her Telegram bot"
- **Her languages** (2026-09-29, the owner's request): English by default and 15 more (Chinese, Japanese, Korean,
  Vietnamese, Indonesian, Filipino, Thai, Hindi, Spanish, Portuguese, French, German, Russian, Turkish, Arabic), picked in a
  menu next to "AGI-1 ▾"; her replies, her natural voice, the mic and her pre-written lines follow it, and she answers in
  whatever language you write in. The page stays English. See "Her languages"
- **Her daily clips** (2026-09-29, the owner's idea): every day GitHub's computer makes a vertical clip (1080 × 1920,
  about 20 s) of AGI-1 in 2D reading her diary entry in her natural voice, with captions. Only AGI: never another coin.
  The owner downloads it and posts it by hand, with the apps' AI labels. Not part of the website. See "Her daily clips"
- **Burn $AGI for more messages** (2026-09-30, the owner's idea): after the free messages, 10 $AGI a message, burned by the
  visitor from their own wallet app (the site never asks a wallet for the burn) and checked on Robinhood Chain; what was
  burned counts toward the level; a huge live **burn monitor** above the chat. Off until `supabase/burns.sql` is run. See
  "Burn $AGI for more messages, and the burn monitor"
- **Launch with AGI-1** (2026-10-01, the owner's idea): people launch their own coin on clank.trade with her help: `/launch`
  and a photo in her Telegram bot, then a private launch page where their own wallet launches it (10,000+ $AGI held or
  burned in it, nothing spent; launching is free, and the owner's gas wallet pays the small network fee back). The coin is
  theirs; she never promotes it. Off until it's set up. See "Launch with AGI-1"
- **Gone since 2026-09-28:** the Arena (voting, champions, nominations; see "The Arena: removed"), $CABO and ClankCap

It looks like an AI lab's model launch page (a parody, see "Design" below): serious design, meme content. (Pop mode is the
optional second look.)

The owner works alone and is learning. **Explain what you're doing and why, in simple terms, as you go.**
**Ask before any big design decision, any new service, or anything that costs money.**

## Hard rules

1. **`AGI FINAL` and `AGI NEW WEBSITE` are read-only.** `C:\Users\User\Desktop\AGI FINAL` is the first site (the
   Vercel project `agionclank`, kept as a way back). `C:\Users\User\Desktop\AGI NEW WEBSITE` is the original of this site
   (the Vercel project `agi-new-website`, still live on its own domain); the owner: "use the AGI NEW WEBSITE folder only for
   context, don't change anything there". Read them for reference only. Never edit them, and never run build, deploy or
   git commands in them. Even `git status` and `git diff` quietly rewrite git's cache file there, so read the files
   directly instead.
2. **Never touch the other Vercel projects (`agionclank`, `agi-new-website`) or dariaresearch.dev.** This folder deploys
   to its own project, `agi-ecosystem`, live at **agi1.app**, so **every push to `main` goes live there**: bigger changes go
   to a branch first (its own preview link). The owner does every click in Vercel and at the domain.
3. **Never copy the `.vercel` or `.git` folder from AGI FINAL or AGI NEW WEBSITE.** `.vercel` links a directory to a
   Vercel project, so deploying from here would overwrite that live site; `.git` would send this folder's pushes to that
   site's GitHub repo. This folder has its own `.git` (the `agi-ecosystem` repo).
4. **No secrets in front-end code or in git.** Everything the browser downloads is public. API keys live only in
   Vercel environment variables (and `.env.local` for local testing, which git ignores). Vite ships every
   variable that starts with `VITE_` to the browser, so never give a secret that prefix. **The one wallet key on our server
   (2026-10-01):** `LAUNCH_GAS_KEY`, the owner's own small gas wallet that pays launch fees back (see "Launch with AGI-1"):
   a new wallet made only for that, holding only a little ETH (a hack could take at most what's in it), never anyone
   else's key, and never a wallet that holds $AGI or anything else of value.
5. **The browser never writes to the database directly.** All writes (chat counters, wallet names and notes, voice
   counts) go through our own `/api` functions, which check and limit them.
6. **No automatic posting** to X or anywhere public. "Share on X" only opens a pre-filled post that the visitor sends themselves.
   **One exception, the owner's (2026-09-29):** AGI-1's Telegram texts, only to people who pressed Start on her bot and
   confirmed they're 18+, at most 2 a day, never at night on their clock, pre-written lines only (and her diary entry as
   it's already published on /diary, written by AI once a day and checked in code; never an AI text written just for
   Telegram), and /stop (or blocking the bot) forgets them (see "She texts first"). An autonomous X account needs the owner's decision
   first (its cost, X's rules for automated accounts). Her daily clips (2026-09-29) are made automatically, but only for the
   owner to download: the owner posts them by hand (see "Her daily clips").
7. **Keep costs near $0.** The total budget is $150. Prefer free tiers, and check every new feature against the budget table below.
8. **Not financial advice.** Nothing on the site, and nothing AGI-1 says, promises gains or tells people to buy or sell.
   **One exception, the owner's choice (2026-09-25):** when a Stranger or a Crush runs out of messages for the day, AGI-1's
   pre-written line (`src/chat/limit-lines.js`) suggests buying $AGI for more messages a day, always with "not financial
   advice", the free option (come back tomorrow) and the safety note right under it; never prices, gains or pressure
   (`tests/limit.test.js`). Her AI replies still never suggest buying anything. Her **market moments** (2026-09-25: happy at
   each new $200K of market cap, sad after a -20% day) are feelings about the chart, never a prediction or buy / sell / hold,
   always with "not financial advice" and no Buy link (`tests/market.test.js`). **Burning for messages** (2026-09-30, the
   owner's idea): the page offers it after the free messages, always as a way to pay for messages, never as an investment
   ("permanent, not an investment, no refunds, not financial advice"); her AI replies never suggest it. **Launching coins**
   (2026-10-01, see "Launch with AGI-1"): the coins people launch with her are theirs, and she never promotes them (no
   texts first, diary, clips or posts about them, no "it'll go up"); every launch line says "not financial advice" and that
   meme coins can lose all of their value.
9. **Wallets: an address and a free signature, nothing else.** The site never asks a wallet for a transaction, a token
   approval, a network change or any signature other than the plain-text sign-in message (it may *read* which network the
   wallet is on). `tests/wallet.test.js` fails the build if the code in `src/` ever does. Levels never come with "buy more" wording,
   except the out-of-messages line in rule 8. The one transaction the site ever suggests (2026-09-30) is a burn the visitor
   sends themselves, from their own wallet app, to the burn address `0x…dEaD` (see "Burn $AGI for more messages"): the page
   never asks a wallet for it, and the test also refuses payment links (`ethereum:`, MetaMask's send links).
   **One exception, the owner's (2026-10-01, "Launch with AGI-1"):** on the launch page only (agi1.app/launch/<id>), and only
   when the person presses its buttons, `src/launch/send.js` may ask their wallet to switch to Robinhood Chain and to send
   ONE transaction: clank.trade's own factory (`0x798d…ccf2`), `launchToken(…)`, with no ETH, built by our server and tried
   on the chain first. That file refuses anything else (another address, another function, any ETH, another network)
   before the wallet sees it; `tests/wallet.test.js` fails the build if any other file asks a wallet for a transaction or a
   network change, and `tests/launch.test.js` checks that one. Never a token approval, a typed-data signature, a buy or a
   transfer, and never a wallet our server holds for anyone (no "wallet inside the bot").

## Decided stack

| Part | Choice | Why |
|---|---|---|
| Front end | **Vite + plain JavaScript** (no framework) | Same language as the old site, plus proper packages and instant-reload preview |
| 3D | three.js (installed with npm, bundled by Vite) | The old stage code can be reused |
| Server code | **Vercel Functions** in `/api` | Same project, no sleeping server; the free tier covers 1M calls/month |
| Chat AI | **Google Gemini API, paid tier with prepaid credits** | Chats stay private (not used for training), allowed worldwide, and the key stops when credits run out |
| Model | `gemini-3.1-flash-lite`, read from env var `GEMINI_MODEL` | Cheapest as of Sep 2026 ($0.25 per 1M input tokens / $1.50 per 1M output). Check [pricing](https://ai.google.dev/gemini-api/docs/pricing) before changing it |
| Database | Supabase (free tier): the chat's limits, wallet names and notes, the diary, her voice's counts and kept lines. Since 2026-09-28 the same project as the original site's (see "Deployment") | Free; only our server holds its key |
| Prices | DexScreener public API (free, no key) | Same as the old site |
| Human check | Cloudflare Turnstile (free, unlimited, works on any host) | Stops bots on the chat |
| Hosting | A **new, separate** Vercel project (free Hobby plan) | Every push gets its own preview link |
| Wallet sign-in | "Sign-In with Ethereum" message (EIP-4361), checked on the server with `viem`; wallets found with EIP-6963 | Free, standard, no outside service |
| $AGI balances | Robinhood Chain's free public node, read-only `balanceOf` | Free and keyless; rate-limited, but we ask rarely |
| Diary | Gemini, once a day, from the nightly keep-alive job | About $0.0008 a day (owner approved, 2026-09-24) |
| Voice | **Gemini's speech model** (`gemini-3.8-flash-lite-tts`, voice **Despina**, her calm style with each reply's mood) through `/api/voice`; no robotic fallback (her natural voice or text, since 2026-09-25); her fixed lines kept in the database once made, and Gemini 3.8 Flash TTS as her backup model (2026-09-26) | Natural instead of robotic (owner's choice, 2026-09-25); same Google account and prepaid credits, no new service; a hard daily cap under Google's own (100 requests a day on Tier 1) |
| Share cards | Drawn on a `<canvas>` in the browser; preview pictures are plain files | Free: no image server |
| Telegram bot | Telegram's Bot API (free), from our server only: `/api/telegram` (its webhook) and `/api/feed` (8 cron runs a day) | She texts first (2026-09-29): opt-in by design (a bot can only text people who pressed Start), no app to build, no cost |
| Coin launches | **clank.trade's own factory contract** (`launchToken`, from its developer docs), sent by the person's own wallet from the launch page (2026-10-01) | Non-custodial: their wallet is the coin's creator and nothing of theirs is on our server; launching is free; no new service |
| Launched coins' pictures | **Pinata** (free plan: 500 files, 1 GB), from our server only (`PINATA_JWT`): each coin's picture goes on IPFS once, as it's got ready; a coin never launched has its picture deleted again | A clank.trade coin's picture is an `ipfs://` address; clank.trade's own pictures are on Pinata too; free |
| Launch fees paid back | The owner's own small **gas wallet** (`LAUNCH_GAS_KEY`), from our server: one plain ETH payment back to each launch's creator | The owner's choice, to bring launches to her bot; capped per launch, per wallet and per day |

## Project structure

| Path | What it is |
|---|---|
| `index.html` | The page: top bar, the front (2026-09-28), hero, every section, and the footer (the safety note). Vite starts here |
| `diary.html` | AGI-1's diary page (`/diary`, Phase 5): top bar, the entries, a short safety paragraph. Its own entry: `src/diary.js` |
| `launch.html` | "Launch with AGI-1" (2026-10-01): the private launch page (`/launch/<id>`, never in search results): the coin, 18+, the three steps (your wallet, Robinhood Chain, Launch), the coin once it's live, "Before you launch". Its own entry: `src/launch/page.js` |
| `public/theme.js` | Tiny script in `<head>`: picks light or dark, and Pop mode unless the visitor switched it off, before the page paints (no flash), and sets the phone's browser-bar color to match; on the home page it also arms the front's entrance and loader (2026-09-28) |
| `src/main.js` | Browser code entry point: styles, theme, the front, prices, sections, chat, then the 3D stage (loaded separately, after the front's entrance) |
| `src/landing/landing.js` | The front (2026-09-28): the loader, the entrance, the focus lines, AGI-1 in WebGL, the orbit, her bubble, the ribbons, the manifesto, the cursor and hearts (see "The front") |
| `src/landing/lines.js` | What AGI-1 says in the front's speech bubble, and when she's clicked (PG-13, no pet names, no money talk) |
| `src/styles/` | `tokens.css` (colors for both themes, chart colors, fonts), `base.css` (reset, buttons), `layout.css` (top bar), `footer.css` (safety note + bottom bar), `hero.css` (hero, ticker, figure), `sections.css` (section headings, stat tiles), `evals.css` (Figure 2), `modelcard.css` (Model card), `playground.css` (Playground), `relationship.css` (levels panel, connect screen, level-up), `notify.css` (the notification card, 2026-09-25), `checker.css` (ClankChecker, 2026-09-26), `pop.css` (Pop mode, 2026-09-27: the whole second look, every rule under `[data-skin="pop"]`), `landing.css` (the front, 2026-09-28: every rule names an `lp-` class), `launch.css` (the launch page, 2026-10-01: every rule names an `lch-` class) |
| `src/theme.js` | The light/dark toggle and (2026-09-27) the Pop mode button; remembers both choices; sends `agi:theme` and `agi:skin`; the phone's browser-bar color (`barColor()`) |
| `src/menu.js` | The phone menu (both pages): on screens up to 920 px (in Pop mode up to 1040 px; 860 px before the Pop mode button, 760 px before ClankChecker's link) the top bar's links are hidden, and the menu button shows them as a drop-down (with the Diary, the Safety note and, under 380 px, Pop mode). Where it starts is decided by the CSS alone. Closes on a link, Escape, a tap outside, or when the links fit again. Also Pop mode's top-bar band (`is-stuck`, past the hero) |
| `src/prices/` | `parse.js` (read DexScreener's answer, number formats), `prices.js` (fetch every 30 s, sends `agi:prices`), `ticker.js` (draws the hero ticker) |
| `src/sections/` | Page sections below the hero: `evals-data.js` (the benchmark numbers) + `evals.js` (Figure 2: chart, tooltips, table view); `modelcard.js` (Copy button + live token numbers); `checker.js` (ClankChecker, 2026-09-26, "Risk check your coins on clank" on the page since 2026-09-28: the coin list (live: the newest coins every 10 s while it's on screen, a Refresh button), each coin's picture and its big view, filters and search, "Ask AGI-1" and her answer under the coin) |
| `src/checker/lines.js` | ClankChecker (2026-09-26): the risk levels' names and what AGI-1 says about a scan (two lines per level, the official $AGI, a copy of it), with her reaction and voice style for each. The page and the server both read it |
| `src/checker/copycat.js` | ClankChecker (2026-09-26): which coins copy another coin's ticker ("E/ACC" = "EACC"). Our server marks the whole list with it, and the page marks it again whenever new launches arrive, so both always agree |
| `src/stage/stage.js` | Figure 1, the 3D stage: minimal studio (transparent canvas, neutral light, floor dial, soft shadow), camera, loading %, the model switch (AGI-1; the Arena's champion left on 2026-09-28), taps; and (2026-09-25) moving that one canvas into a live view and back: the chat's, and since 2026-09-26 ClankChecker's; and (2026-09-27) the "3D · 2D" switch: which AGI-1 is on stage (`slot()`, `setStyle()`, `swapAgi1()`) |
| `src/stage/agi1-2d-arms.js` | 2026-10-01, round 2: her 2D arms, turned in code on top of her Live2D model after each update: her joints found on her model (`measureArm`), each arm turned at the shoulder, elbow and wrist with a round elbow and a sleeve that folds (`bendArm`), never lifted past what her drawing allows (`REACH`). Pure (tested in Node with Live2D's runtime) |
| `src/stage/tap-lines.js` | 2026-10-01: what she says when she's tapped (her hellos, her "a lot of taps" lines, their voice styles and faces: `tapLinesIn`) and the tap counter (`tapCounter`). The stage and the server (`server/voice.js`) both read it |
| `src/stage/agi1-2d.js` | AGI-1 in 2D, her Live2D model (2026-10-01; her 2D rig before): loads her files (`loadAgi1_2D`), builds her puppet (`buildPuppet`: standing on the floor, 1.62 m, her markers for the live views, taps only on her, her 4096 px texture on request: `sharpen()`) and her controller (`createAgi1_2D`: her motion on her model's parameters, every reaction, her physics; the same controls as `agi1.js`: `react`, `hello`, `setTalk`, `setPointer`, `setAttention`, `setCloseUp`, `update`). Loads only when needed (a separate file). See "AGI-1 in 2D" |
| `src/stage/live2d.js` | 2026-10-01: Live2D for the stage: loads Live2D's runtime (Cubism Core) once, draws her model's 52 pieces as three.js meshes in Live2D's order with their opacity and blending, her eyes' clipping with the stencil buffer (`buildMeshes`); which piece is at a point (`pieceAt`, for taps) and the box of a few pieces (`boxOf`, for her markers) |
| `src/stage/live2d-physics.js` | 2026-10-01: her hair and chest physics, read from her model's physics file: the same pendulum maths as Live2D's runtime (checked against it), fixed 60 steps a second; pure (tested in Node) |
| `src/stage/agi1-2d-motion.js` | The pure parts of her 2D motion (tested in Node): which AGI-1 the visitor picked (`agi1_style`, `readStyle`: 2D unless "3d" since 2026-10-01; the page reads it too), springs that follow like body parts, drifts, blinks, how open her model's eyes are (`eyeOpen`), her mouth while she talks, where she looks (`lookAt`), her chest's limits on the site (`CHEST`, `chestLimit`: PG-13) |
| `src/stage/agi1.js` | AGI-1's idle (built in code), occasional dance, and reactions (wave, looking at you, hop, spin, hearts, a jealous glance); her face (2026-09-25: her jaw, mouth corners and cheeks really move, painted eyelids, blush and "^^" eyes, an expression for each chat mood) and her listening/thinking looks; since 2026-09-26 her arm waves like a real arm (a hinge at the elbow), her mouth is redrawn, her hair swings, and ClankChecker's reactions (`okay`, `hmm`, `worried`) |
| `src/lib/talk.js` | How much AGI-1 is talking right now (0–1), for her 3D mouth: a sound meter on her voice, or a made-up rhythm ("saying" a reply silently) |
| `src/stage/effects.js` | Floating hearts in the accent color |
| `public/` | Files served as-is: favicon, `fonts/` (Geist, and for Pop mode Anybody and Instrument Serif Italic; for the front's "ドキドキ" a 760-byte subset of Dela Gothic One; self-hosted, each with its OFL license file), `models/agi1.glb` (2.18 MB, computers), `models/agi1-phone.glb` (1.67 MB, phones), `images/landing/` (the front, 2026-09-28: AGI-1's cutout, 104 KB; her face for the bubble, 4 KB; a depth map for her WebGL parallax, 5 KB), `images/agi1-avatar.webp`, `images/agi1-portrait.webp`, `images/agi1-live.webp` (the chat's live view before the 3D arrives, 24 KB), `images/agi1-live-2d.webp` (the same for AGI-1 in 2D, 51 KB, rendered from her Live2D model on 2026-10-01; shown first), `models/agi1-live2d/` (AGI-1 in 2D since 2026-10-01: Live2D's runtime `live2dcubismcore.min.js` (as it is, © Live2D Inc., with `NOTICE.txt`), her model `AGI-1.moc3`, its physics `AGI-1.physics3.json`, her texture `AGI-1.2048.webp` (456 KB) and `AGI-1.4096.webp` (1.1 MB, close-ups on computers); about 770 KB for a visitor who sees her in 2D) (`models/agi1-2d/`, the 2D rig's pictures before her Live2D model, and `images/coins/`, the Arena's coin logos, are gone) |
| `src/chat/chat.js` | The Playground (AGI-1's chat, `section#playground` in `index.html`): 18+ gate, human check, history in the browser, mood → stage reaction. "Try AGI-1" buttons scroll here |
| `src/chat/models.js` | The model picker in the chat bar (2026-09-26): "AGI-1 ▾" opens a small menu (AGI-1, and AGI-2 "Coming soon"), for mouse, keyboard and screen readers |
| `src/chat/model-lines.js` | What AGI-1 says when someone picks AGI-2 (pre-written, playfully jealous, PG-13, no AI cost) |
| `src/lib/human.js` | The human check for the chat (shared with the Arena until 2026-09-28): Cloudflare Turnstile widget, the 2-hour pass saved in the browser, a small JSON-POST helper |
| `src/lib/levels.js` | The three relationship levels (names, $AGI needed, messages a day). The page and the server both read it |
| `src/lib/wallet.js` | Finds the visitor's wallets (including Phantom) and signs in: asks only for the address, the network it's on (read-only) and a plain-text signature; turns wallet errors into plain words |
| `src/chat/relationship.js` | The Relationship panel in the Playground: connect screen, level, name, AGI-1's notes, Forget me, the level-up moment |
| `src/chat/voice.js` | Voice replies: the speaker button; plays her AI voice from `/api/voice` (Web Audio; her natural voice or nothing, never the browser's robotic one); what she says out loud (`speakable`, `clipSpeech`); her fixed lines (hello, out of messages, market moments, ClankChecker: downloaded once, early when you're about to need them; her call intro is her natural voice or nothing). One voice for the whole page: ClankChecker plays through the same one (`sharedVoice()`), and `agi1:speaking` tells every live view when she talks |
| `src/chat/listen.js` | Voice chat (2026-09-25): the browser's free speech recognition, one message at a time (`listenOnce`), and whether this browser can listen (`canListen`) |
| `src/i18n/` | Her languages (2026-09-29): `langs.js` (the 16 languages: codes, names, number formats, what the mic listens for; the page and the server share it), `lines/en.js` (every pre-written line of hers in English: the source) and `lines/<code>.js` (the same keys in each language), `text.js` (filling in `{placeholders}`, English as the fallback), `lang.js` (the page: which language she speaks with this visitor, remembered as `agi1_lang`; downloads only that language's file), `all.js` (the server: every language at once), `check.js` (her rules for a translation: same keys, placeholders, emojis, "not financial advice", kept names and numbers) |
| `src/chat/languages.js` | Her languages (2026-09-29): the chat bar's language menu ("🌐 English ▾" next to "AGI-1 ▾"), two columns of her 16, each in its own words; keyboard like the model picker |
| `src/lib/copy.js` | 2026-09-29: the Copy button for the contract address (the Model card's and the front's): copies the whole address, or selects it where the clipboard is blocked |
| `src/chat/telegram-link.js` | She texts first (2026-09-29): shows the Playground's "Text me on Telegram ↗" once the bot's public name is set (`VITE_TELEGRAM_BOT`, read by `src/main.js`) |
| `src/chat/burn.js` | Burn $AGI for more messages (2026-09-30): the burn monitor above the chat (the huge live number), the Relationship panel's row, the burn screen (a native dialog: the steps, the burn address and Copy, Check my burn, a pasted link), the sentences about burning (shown once burns are open, `[data-burn-only]`); `burnsReady()` / `openBurn()` for the chat's out-of-messages chip |
| `src/lib/burns.js` | 2026-09-30: the burn address (`0x…dEaD`), its block explorer page, the suggested amounts. The page and the server share it |
| `src/launch/` | "Launch with AGI-1" (2026-10-01): `page.js` (the launch page: the draft, 18+, connecting a wallet with the site's sign-in, Robinhood Chain, Launch, waiting for the chain, the coin and its fee paid back), `send.js` (**the one file on the site that asks a wallet for a transaction**: switching to Robinhood Chain and sending clank.trade's launch, and nothing else: hard rule 9's exception), `words.js` (everything the page says, and `/api/launch`'s answers in plain words), `links.js` (the coin's optional links: X, Telegram, a website, tidied and checked the same way on the page and our server) |
| `src/chat/limit-lines.js` | Out of messages (2026-09-25): what AGI-1 says when a Stranger or a Crush has used today's messages (the page shows it; her voice for it comes from `/api/voice?line=more-1` / `more-2`), and the safety note under it |
| `src/chat/market-lines.js` | Market moments (2026-09-25): what AGI-1 says when $AGI reaches a new $200K market cap step (happy, she names it) or has a -20% day (sad); her voice for them: `/api/voice?line=mcap-<step>` / `dump-<n>`. The page and the server both read it |
| `src/chat/market.js` | Market moments: watches the live $AGI numbers (`agi:prices`) in the visitor's browser and decides when she has something to say (once per step; at most one sad moment every 12 hours); remembered in the browser (`agi_market`) |
| `src/lib/notify.js` | The notification card under the top bar (market moments): one at a time, about 12 s, Listen / Open chat / ✕ / Escape; never over her live view in the chat |
| `src/diary.js` | The diary page: entries from `/api/diary`, Share on X per entry, "Show older entries" |
| `src/share/` | `texts.js` (the ready-made X posts + links; checked by tests), `card.js` (draws the 1200×630 share cards), `buttons.js` (Share on X links, Save image) |
| `scripts/share-pages.js` | Runs after `vite build`: writes `dist/share/*.html` (link-preview pages) and the site address into the preview tags of the home page and the diary page (`__SITE__`) |
| `public/cards/` | The link-preview pictures (one per level, the diary, and `home.jpg` for the home page; the champions' cards left with the Arena), made with `tools/cards/` |
| `public/share/go.js` | Sends people who open a share link on to the right part of the site |
| `tools/cards/` | Offline tool: makes `public/cards/` with the site's own card drawing, plus `home.jpg` from `home-card.html` + `agi1-wave.webp` (see "Share cards") |
| `api/` | Server code (Vercel Functions): `health.js` ("is the server alive?"), `chat.js` (AGI-1's chat), `wallet.js` (wallet sign-in, level, name, Forget me; since 2026-09-30 "Check my burn" and, at `GET ?burns`, the burn monitor's numbers), `checker.js` (ClankChecker, 2026-09-26: the coin list, the newest coins, one coin's scan and each coin's picture; read-only, shared by the CDN), `diary.js` (the diary entries), `voice.js` (AGI-1's voice: one reply read aloud as a WAV file, her "hi, it's me", her out-of-messages lines and her market moments), `keepalive.js` (Supabase keep-alive + writing the diary, cron only; since 2026-10-01 also tidying up launch drafts and the pictures of coins never launched), and since 2026-09-29 `telegram.js` (her Telegram bot's webhook) and `feed.js` (8 cron runs a day: connects the bot, finds moments, she texts first), and since 2026-10-01 `launch.js` (the launch page's server: a draft and its picture, getting a launch ready, reading it back, its fee paid back). The Arena's `arena.js`, `vote.js`, `coins.js` and `logo.js` left with it (2026-09-28) |
| `server/` | Helpers used by `api/`: settings, security (passes, signatures, IP codes), Turnstile, limits, Gemini, AGI-1's prompt, `arena.js` (small since 2026-09-28: the Arena's round clock and one database call, only for the numbers the diary saves for the original site, and the coins this site never shows), `coins.js` (small since 2026-09-28: ClankChecker's helpers: a coin name's cleanup, crude words, picture checks, reading an answer up to a size, our server's bot name), `checker.js` (ClankChecker, 2026-09-26: reads clank.trade's API, DexScreener and the block explorer, and turns it into flags and a risk level; the coins' pictures from clank.trade's picture host), `signin.js` (the sign-in message and its check), `session.js` (wallet sessions, wallet codes), `chain.js` (read-only $AGI balance), `friends.js` (what AGI-1 remembers), `burst.js` (per-copy speed bumps for `/api/voice` and `/api/checker`), `diary.js` (writes the daily diary entry), `voice.js` (AGI-1's voice: Gemini's speech model, her style, WAV), `voice-store.js` (2026-09-26: her fixed lines kept in the database once made), `market.js` (2026-09-25: $AGI's market cap from DexScreener, kept a minute, so `/api/voice` only makes market lines near the real market cap), `tg-memory.js` + `tg-memory-data.js` (Phase 6: AGI-1's memory of the Telegram group; the data file is made by `tools/memory/`), and since 2026-09-29 her Telegram bot: `telegram.js` (Telegram's API, the webhook's answers, connecting the bot), `tg-lines.js` (everything she says there that isn't an AI reply), `feed.js` (the moments and her texts first; `checker.js` got `coinsSince()` for it); and `clank-chain.js` (2026-09-29: the Clank protocol's contracts on Robinhood Chain, read-only `eth_call`s from their docs: a coin's record, its curve's stage and ETH, what its creator holds; the risk check's second opinion and safety net); and `burn.js` (2026-09-30: burning $AGI for messages: reading a burn on the chain and the explorer, counting it, taking and giving back burned messages, the burn monitor's numbers); and since 2026-10-01 "Launch with AGI-1": `launch.js` (her checks of a coin, clank.trade's ticker search, the drafts, the picture from Telegram to Pinata, clank.trade's launch call and its dry run, reading a launch back, the gas wallet's payback, the tidy-up), `launch-lines.js` (what she says about launching in her bot) and `lookalike.js` (letters from other alphabets that look like A, G and I, and the egirl-coin words: shared by her feed and her launch checks) |
| `supabase/chat-limits.sql` | Run once in the Supabase SQL editor: the counter table + `chat_take()` limit function |
| `supabase/arena.sql` | The Arena's tables + `arena_vote()`, `arena_state()` and `arena_history()`. **The original site's since 2026-09-28** (its Arena, in the database both sites share): never run it again from here, never drop its tables. This site only calls `arena_state()`, before the diary reads a day's numbers |
| `supabase/levels.sql` | Run once in the same Supabase project: what AGI-1 remembers per wallet + `friend_get/set_name/add_note/forget()` |
| `supabase/diary.sql` | Run once in the same Supabase project: the diary table + `diary_day_stats/needed/save/list()` |
| `supabase/coins.sql` | Phase 6: the Arena's coin list, nominations and votes to add a coin + `coin_board/vote/nominate/active/logo/retire()`, and the owner tools `coin_remove()` / `coin_restore()`. **The original site's since 2026-09-28**, like `arena.sql`: never run it again from here, never drop its tables |
| `supabase/voice.sql` | AGI-1's voice (2026-09-25). Run once in the same Supabase project, **after** `chat-limits.sql`: `voice_take()`, which counts voice use in the chat's counter table (the hard daily cap; since 2026-09-26 in requests, no need to run it again) |
| `supabase/voice-lines.sql` | Her recorded lines (2026-09-26). Run once in the same Supabase project (any time): the `voice_lines` table + `voice_line_get/put()`, where the server keeps her fixed lines once Google has made them |
| `supabase/telegram.sql` | She texts first (2026-09-29). Run once in the same Supabase project (any time): four new tables (`agi1_tg_friends`, `agi1_feed`, `agi1_feed_state`, `agi1_tg_usage`) and 12 functions, only added (nothing the original site uses changes) |
| `supabase/burns.sql` | Burn $AGI for more messages (2026-09-30). Run once in the same Supabase project (any time): five new tables (`agi1_burn_key`, `agi1_burn_txs`, `agi1_burn_wallets`, `agi1_burn_days`, `agi1_burn_total`) and 7 functions, only added (nothing the original site uses changes). Until it's run, nobody sees anything about burning |
| `supabase/launch.sql` | "Launch with AGI-1" (2026-10-01). Run once in the same Supabase project (any time; running it again is safe): four new tables (`agi1_launch_drafts`, `agi1_launch_chats`, `agi1_launch_wallets`, `agi1_launch_days`) and 12 functions, only added (nothing the original site uses changes). Until it's run (and `PINATA_JWT` is set), her `/launch` says launching isn't open yet |
| `tests/` | Automated tests (run on every build): `chat.test.js`, `prices.test.js`, `keepalive.test.js`, `evals.test.js`, `page.test.js` (the page's must-have warnings; since 2026-09-28 also that the Arena is gone), `wallet.test.js` (sign-in, levels, memory, the no-transaction guard), `diary.test.js` (writing and listing the diary, never about the Arena), `share.test.js` (X posts, share pages, voice text), `memory.test.js` (Phase 6: the Telegram memory), `voice.test.js` (AGI-1's voice: tickets, limits, the request to Gemini's speech model, WAV, the greeting), `talk.test.js` (her talking level: the rhythm, pretending, the sound meter), `listen.test.js` (voice chat: listening for one message with a fake recognizer), `limit.test.js` (her out-of-messages line: only Strangers and Crushes, the real numbers, "not financial advice", tomorrow, no prices/gains/pressure, her voice says exactly that), `market.test.js` (market moments: her lines (the number and a feeling only, "not financial advice", no advice words), when she says them (steps, wobbles, -20% days, 12 hours, the first look), the page's watcher), `models.test.js` (2026-09-26: the model picker and her AGI-2 lines), `checker.test.js` (2026-09-26: ClankChecker's scan rules, reading clank.trade, the list, the newest coins and the page's merge, pictures, the API, her lines), `pop.test.js` (2026-09-27: Pop mode's button, its styles scoped so the default look can't change, its fonts and licenses, the ribbons' words, the pre-paint script, where the menu starts), `agi1-2d.test.js` (2026-09-27; her Live2D model since 2026-10-01: which AGI-1 (2D first), her springs, blinks, eyes, mouth, where she looks, her chest's PG-13 limits measured on her model, her physics against Live2D's own runtime, her model's files, her puppet and controller with Live2D's real runtime in Node, "reduce motion", the page's "3D · 2D" buttons), `landing.test.js` (2026-09-28: the front: first on the page, the one h1, its links, pictures and font, scoped styles, her bubble lines and (2026-09-30) her bubble's place on phones, what `/theme.js` arms, "reduce motion", the stage waiting for it, no removed coin, nothing of the Arena), `telegram.test.js` (2026-09-29: her Telegram lines, the bot, connecting it, the feed, her texts first, `/api/telegram`, `/api/feed`, the page's link), `i18n.test.js` (2026-09-29: her 16 languages, every language's lines against her rules, the page's language state, her prompt's language part, her voice lines' words, the mic, her Telegram lines, the Soulmate note filter), `clips.test.js` (2026-09-29: her daily clips: only AGI (never another coin), her diary clip's words, captions, her voice's loudness and pauses, ffmpeg never hanging, the GitHub job, nothing in the site's build), `burn.test.js` (2026-09-30: burning $AGI for messages: reading a burn on the chain, counting it once and per wallet, "Check my burn", the chat using burned messages after the free ones and giving one back, her voice allowance, the level, the burn monitor's numbers, the page's promises), `launch.test.js` (2026-10-01: "Launch with AGI-1": the one file that sends, her checks, the ticker search, the launch call as clank.trade's docs write it, the dry run, reading a launch back, the payback (never twice), the caps, `/api/launch`, the uploads, the tidy-up, her bot's flow, the page's words and rules, the safety note, the secret check). `arena.test.js`, `champion.test.js` and `coins.test.js` left with the Arena (2026-09-28) |
| `tools/i18n/check.mjs` | 2026-09-29: checks a translation of her lines against her rules while it's being written: `node tools/i18n/check.mjs es pt` (no codes = all) |
| `tools/clips/` | Her daily clips (2026-09-29, not part of the website; only AGI, never another coin): `make.mjs` (the whole day: her diary entry, her voice, every frame, the MP4), `lines.js` (her words, with her rules), `captions.js` (her captions and their timing), `audio.js` (WAV files, her mouth's loudness, her pauses, a stand-in voice), `page/` (the renderer page: her 2D rig, the background, the title, the captions, the label; built into `tools/clips/dist/`, which git ignores). See "Her daily clips" |
| `.github/workflows/clips.yml` | 2026-09-29: GitHub's daily job that runs `tools/clips/make.mjs` and keeps the clips 7 days (Actions → the run → Artifacts). The only GitHub workflow; it never posts anything. The owner saves it here by hand (Claude's link can't write workflow files) |
| `scripts/check-secrets.js` | Runs after every build and fails it if a secret would be shipped to browsers |
| `tools/model/` | Offline 3D-model tools, not part of the site build: `fix-hair-weights.mjs`, `drop-tangents.mjs` (see "3D models") |
| `agi 2d anime/` | The owner's earlier 2D art (`agi-vtuber.html`): the source of the 2D AGI-1 from 2026-09-27 to 2026-10-01 (her Live2D model since). Not used by the site; its tools left with the old 2D rig |
| `tools/agi1-2d/fix-shirt.py` | 2026-10-01: repaints the pink smudge on her Live2D texture's shirt under her right arm (her wave showed it), on both WebP textures; run once after each new export of her model (see "Updating her model") |
| `tools/memory/` | Phase 6, offline: `build-memory.mjs` turns the Telegram export into `server/tg-memory-data.js`; `lore.json` (hand-written memory cards: eras, running jokes, big moments; edit freely); `forget.json` (people who asked to be left out). See "AGI-1's memory of the Telegram group" |
| `telegram memories/` | The owner's Telegram export (`result.json`, 31 MB, thousands of people's messages). **Never in git** (`.gitignore`); only `tools/memory/` reads it |
| `vite.config.js` | Three pages (`index.html`, `diary.html` and since 2026-10-01 `launch.html`); raises Vite's file-size warning: three.js is large on purpose and loads separately |
| `vercel.json` | Vercel settings: build command, `cleanUrls` (`/diary` serves diary.html), a rewrite (2026-10-01: `/launch/<id>` serves launch.html), security headers (CSP), `noindex` on `*.vercel.app`, browser caching (see "Caching"), 25 s max per function, 3 daily cron runs of `/api/keepalive` and (2026-09-29) 8 of `/api/feed` |

## Commands

- `npm install`: downloads the packages listed in `package.json` into `node_modules/` (git ignores it).
- `npm run dev`: local preview with instant reload at http://localhost:5173. The `/api` functions (chat, voice, the diary, the risk check…) don't run here.
- `npm test`: runs all automated tests (the files listed in `package.json`: chat, prices, keep-alive, the page's warnings, wallet sign-in and levels, the diary, voice, the risk check, the front, her Telegram bot…; a few seconds, no keys needed).
- `npm run build`: runs the tests, builds the site into `dist/`, writes the share pages (`scripts/share-pages.js`), then runs the
  secret check. Vercel runs this on every push, so a failing test stops a broken chat from going live. Each test may take at
  most 30 s (`--test-timeout`): a stuck test fails the build within a minute instead of hanging it for 45 minutes.
- **Node versions:** Vercel most likely builds with Node 24 (Settings → Build and Deployment → Node.js Version; the local tests
  here ran on 22). Claude runs the tests with Node 20, 22 and 24 before handing over a change (a test that passed on 22 but
  hung on 24 kept four pushes from going live, 2026-09-25).
- Add `?dev` to the site's address (e.g. https://agi1.app/?dev) to test AGI-1's reactions with buttons.
- `node tools/i18n/check.mjs` (or with codes: `… es ja`): checks her lines in every language against her rules, after
  changing one (see "Her languages"). `npm test` runs the same checks.
- AGI-1 in 2D's model files come from Live2D Cubism Editor (the owner's VTuber project): see "Updating her model" in
  "AGI-1 in 2D".
- `node tools/clips/make.mjs --fake-voice`: makes today's diary clip with a stand-in hum instead of her voice (see "Her
  daily clips"; needs Chrome or Chromium, ffmpeg and `npm install --no-save playwright-core`: Claude's workspace and GitHub
  have them). GitHub's daily job runs it for real (with her voice): Actions → "AGI-1's daily clips".
- Local testing needs Node.js 20.19+ or 22.12+ (Vite 8). Claude builds and tests in its own workspace, so
  `node_modules/` normally isn't in this folder. `node_modules/` made on one system (Linux, Windows) doesn't work on
  another: if it came from somewhere else, delete it and run `npm install` again.

## 3D stage and AGI-1's reactions

- **The look:** a minimal studio (see "Design"). The canvas is transparent, so the figure box's own background (`--bg-2`)
  shows through and themes switch instantly; only the floor dial and shadow strength change with `agi:theme`.
  Neutral tone mapping keeps her texture colors true. The camera stays in front of her; visitors can drag to rotate, and it
  glides back to the front 5 s after they let go (keeping any zoom). The mouse wheel always scrolls the page.
- **Zoom** (2026-09-25, the owner's request "zoom in really close"; `src/stage/stage.js`, "zoom"): **+ / −** at the stage's
  top right (each press ×1.75: 1× → 1.75× → 3.1× → 5.4× → 8×), a "2.4× · reset" pill under them while zoomed, a **two-finger
  pinch** on phones and a **trackpad pinch** on laptops (browsers send it as Ctrl + wheel). A plain mouse wheel still scrolls the
  page. Limits: AGI-1 8× (her face fills the stage; 3× in 2D). She starts at 1×. (The Arena champion's card, 2× at most,
  left with the Arena on 2026-09-28.)
  - **Where it aims:** at 1× the stage's middle, as before. Zooming in, AGI-1 is framed like a portrait: the top of her head
    stays just inside the top of the picture, so each step crops from the bottom up (knees up, waist up, face), never centered
    on her hips. The aim follows her head smoothly, so she stays in the picture even if she dances.
  - **While zoomed in** (over 2×) she looks into the camera, and no surprise dance starts (`agi1.setCloseUp()`; it comes back
    at 1×). All the way in, she gets shy (looks away, small hearts), at most every 30 s.
  - **Phones:** at 1× a swipe over the stage scrolls the page (`touch-action: pan-y`); once zoomed in, one finger turns the view
    instead (`none`), and a pinch that ends under 1.15× snaps back to 1×. The first time a phone zooms past 3×, the computer
    copy's 2048 px textures are downloaded once (~2.2 MB) and swapped in, because the phone copy's 1024 px textures look soft
    up close. Computers already have them.
  - **Reduce motion:** zoom steps happen at once (no glide). The buttons use `aria-disabled` at the limits, so keyboard focus
    stays on them.
- **How a frame works:** the animation mixer sets her base pose first: her **idle** (built in code from the T-pose: arms
  relaxed, breathing, a slight sway, facing you) or, now and then, her **dance**. Then `src/stage/agi1.js` adjusts a few
  bones on top: her right arm (wave), and her neck and head (look). **Careful:** three.js's mixer only rewrites a bone when
  its animated value *changes*, and in the idle the forearm, hand, neck and head never change. So each frame first puts those
  bones back to their clean pose (`agi1.beforeMixer()`, called by the stage before `mixer.update`); without it the wave stayed
  on after she waved and the head turns piled up (fixed 2026-09-24).
- **Standing height:** the idle's hips use the height stored in the file (the same space the dance uses; the skeleton's bind
  pose is ~0.8 units lower, which made her float ~0.7 m during every dance). `groundDance()` in `stage.js` then measures her
  feet in the dance vs. the idle and moves the dance's hips by the difference, so her feet stay within ~3 cm of the floor.
- **Looking at you** fades out when the target is behind her (100°–135° from the way her body faces), so dragging the camera
  round her back doesn't bend her head backwards or throw her hair around.
- **The dance** (`Dont_You_Dare`, 6 s, the only animation in her file) plays about 14 s after she arrives and then every
  35–55 s, blended in and out of the idle. It's performed turned ~35–60° to her right, so while she dances the model turns
  ~40° the other way to face you. "Reduce motion" skips it. `agi1:react` with `dance` starts it too.
- **Asking for a reaction** (the chat does this with her mood):
  `window.dispatchEvent(new CustomEvent('agi1:react', { detail: 'happy' }))`.
  Types: `wave`, `happy` (same as a tap: hop + hearts), `love` (spin + big hearts + the floor dial blushes), `shy`
  (looks down and away + small hearts), `dance`, `nod` (voice chat), and since 2026-09-25 `jealous` (a pout and a glance away;
  for AGI-2 in the model picker and a copy of $AGI in ClankChecker; until 2026-09-28 also when another coin won the Arena), `neutral` (her calm face again; the chat sends it for a neutral reply), and the
  market moments' `celebrate` (a hop, a burst of hearts, "^^" and a big smile, and on the stage a little dance; not in the
  chat's live view) and `sad` (a sad face, looking down for a few seconds), and since 2026-09-26 ClankChecker's `okay`
  (lower risk: a calm smile and a nod), `hmm` (some risk: a pout and a slow tilt of her head) and `worried` (high risk: a
  worried face, shaking her head slowly).
  Each one also sets her face's expression (see "Her face" below).
- **The wave is made in code** (her file has no wave animation): on top of the idle, she raises her right arm and waves for
  about 2 s. Arm directions are measured from the way she faces, using real "up". She waves on arrival and when switched back on stage.
  **Like a real arm** (2026-09-26, the owner: her waving arm "looks broken"): each arm bone is turned with its own axes, read
  from her rest pose (`armAxes()` / `turnBone()` in `agi1.js`), so her elbow only bends around its hinge (before, it could
  bend sideways and twist up to ~55°, which looked broken up close), her forearm and wrist turn her open palm toward you (at
  most ~50°, mostly at the wrist), and each side-to-side swing turns her upper arm a little, as a shoulder does. Up close she
  waves like on a video call (see the live view below).
- **Looking at you:** her head and neck turn toward the mouse anywhere on the page, at most about 40°. If the mouse hasn't moved
  for 6 s (or on phones, when no finger is down), she looks at the camera, which means at you.
- **Her hair swings** (2026-09-26, the owner: "add hair physics, so when she moves her hair moves too naturally"). Her model
  has no hair bones (her hair moves with her head, neck and upper back: see "3D models"), so it's done in her shader
  (`HAIR_MOVE`, `hairFreedom()` and `applyHair()` in `agi1.js`): which parts are hair is found when she loads, by their golden
  color in her texture (like `tools/model/fix-hair-weights.mjs`), and how freely each part swings grows from nothing at her
  roots (and her bangs, and around her face) to fully free at the ends of her long hair. Every frame the weight of her hair
  follows her neck like a soft spring (about one swing a second): it trails behind when she moves, dances or hops, then
  settles; it swings around after her when she turns or spins (and flares out a little in a fast spin); a very gentle breeze
  keeps it from ever looking frozen. Hair lying on her chest or down her back only lifts away from her, never sinks in. At
  most about 9 cm and 40°. "Reduce motion": no breeze (and no hops or spins to follow). Free: no download, no new file, a few
  more shader instructions; both model files, stage and live view. **If the model is ever replaced**, check the hair still
  swings and the `HAIR` heights in `agi1.js`. Tests (`hairtest.mjs`, 15 checks, with her redrawn mouth): her hair is found and
  her face, bangs, arms and legs never swing, the ends swing freely, still when she stands still, a hop bounces it, a spin
  swings it around and flares it and it settles, her dance moves it, never too far, phones, "reduce motion", no shader errors;
  her mouth opens and closes with each syllable, never all the way.
- **Taps** hit an invisible box around the model, which is much cheaper than testing 31k triangles. A drag of more than 8 px is a rotate, not a tap.
- **She talks when you tap her** (2026-10-01, the owner: "can you make her speak whe she got clicked and if they clicked her
  many times she will said something"; `src/stage/tap-lines.js`, "she talks when you tap her" in `src/stage/stage.js`): on the
  stage and in her live views, 2D and 3D.
  - **A tap:** a short hello in her natural voice ("hi! 💜", "hey, you found me 💜", "oh, hi there 🙈", "i'm right here 💜",
    "hehe, hello 💜": they take turns), with her usual tap reaction (a hop, hearts, a blush on her face). At most one hello
    every 3.5 s; quick taps in between just get her reaction.
  - **A lot of taps** (5 in a row, each within 1.6 s of the last): one of her "okay, i see you" lines, with a face to match:
    "okay okay, i see you 🙈" (shy), "hey! i'm not a button 😤" (a pout and a glance away), "that's a lot of hellos 🙈 come talk
    to me in the chat?" (a wave), "you really want my attention, huh? 💜" (love: a sway and hearts). Then 8 s of just her
    reactions; if they keep at it, the next one.
  - **Her words in a bubble:** on the stage beside her head (on the side she doesn't wave with, never over the zoom or the model
    switch), in a live view a caption at the bottom (clear of the Call button); 2 to 5 s, read out by screen readers
    (`aria-live`), Pop mode's comic look in Pop mode (`.agi-say` in `hero.css` and `pop.css`).
  - **Her voice:** her fixed lines (`/api/voice?line=tap-1…5` / `tap-many-1…4`, `&lang=` in her other languages), made once by
    Google and then kept (the database and the CDN): no credits after the first time, nobody's voice allowance. A tap is asking
    to hear her (like Listen), so she says it even if the speaker button was never pressed; **if the visitor switched her voice
    off** with it, nothing is downloaded and her mouth says it silently. Never over her own voice (a chat reply, a scan: then
    just her reaction), never during a call (the mic would hear her), silent where her voice can't play. Her next hello starts
    downloading when the pointer comes onto her.
  - **For everyone, like the front's bubble:** the stage isn't behind the 18+ check, so her tap lines are written for anyone:
    PG-13, no pet names, never about money (`tests/i18n.test.js`), in her 16 languages (`tap` in `src/i18n/lines/<code>.js`).
- **CABO-1 (the cat) is gone** (2026-09-28, with $CABO: see "$CABO and ClankCap removed"): its button, its model file and
  its zoom are removed; since the Arena left too (the same day), the stage has AGI-1 alone.
- **The champion is gone too** (2026-09-28, with the Arena: see "The Arena: removed"): its stage button, its card
  (`src/stage/champion.js`) and its "Buy on clank.trade" link. The model switch shows AGI-1 alone.
- **In the chat too** (2026-09-25): while you chat, this same canvas moves into the Playground's live view, where she's framed
  like a video call, talks, blinks, listens and thinks. See "AGI-1's live view in the chat". **And in ClankChecker**
  (2026-09-26): the same way into the answer under the coin you asked her about (see "ClankChecker").
- **Or in 2D** (2026-09-27; **2D first since 2026-10-01**): the "3D · 2D" switch at the stage's bottom left swaps her for
  her Live2D model (the owner's VTuber project; the owner's 2D art rigged in code before), with the same reactions, voice
  and live views (see "AGI-1 in 2D"). So most first visits see this section's 3D AGI-1 only after pressing "3D".
- **Test mode:** add `?dev` to the address to get wave / happy / shy / love / jealous / celebrate / sad / dance / okay / hmm /
  worried buttons, plus
  **market up** / **market down** (a whole market moment with today's numbers, labelled "preview"; see "Market moments"). `window.__agiStage` (with
  `advance(seconds)` to fast-forward the animation, `goHome()`, and for the zoom `view`, `setZoom(z)`, `focusPoint()`; for the
  live views `docked`, `dockedIn` (`'chat'`, `'checker'` or null), `frame`, `attention`, `talkLevel()`,
  `pretendTalk(seconds, strength)`; for AGI-1 in 2D `style`, `setStyle('2d' | '3d')` and `agi1Model`) is also there for automated tests.
  Neither exists without `?dev`.
- **"Reduce motion"** switches off the camera push-in and glide, the hop, the spin and the dance, and makes zoom steps instant. Hearts and the wave stay.
- **Performance:** nothing is drawn while the stage is off-screen or the tab is hidden, and never more than about 60 frames a
  second (90/120 Hz phone screens would otherwise draw twice as often, which costs battery). Phones get fewer pixels, no
  antialiasing and a lighter copy of AGI-1 (`agi1-phone.glb`, 1024 px textures). "Phone" = a touch screen or a window under
  700 px wide. Her shaders are prepared while "Loading" still shows (in the background where the browser can), so her first
  frame doesn't stutter. On a simulated slow phone (slow 4G, 4× slower CPU) she appears after ~12 s instead of ~16.5 s, and
  the page downloads 2.0 MB instead of 2.8 MB (2026-09-24).
- **Why she once looked wrong (2026-09-24):** the file is fine (plain glTF, faces the camera, animation bones match the
  skeleton 100%). The hair was tied to her arm bones by the automatic rigging (fixed in the model, see "3D models"), the old
  camera orbited behind her, the dance faces sideways, and the old wave froze the dance on one frame. Second time
  (2026-09-24, the owner's screen recording): floating during the dance, the arm staying up after the hello wave, and her head
  twisting up to ~170° when the camera went behind her. All three are fixed (see the bullets above), checked by replaying the
  video's steps in a test browser and measuring feet height, hand height and head turn, before and after.

## AGI-1's chat

**Flow of one message** (`api/chat.js`, in this order; any failure stops before Gemini is called):
1. **Check the request:** JSON only, body ≤ 16 KB, message 1–500 characters, `adult: true` (the 18+ confirmation).
2. **Human check:** a valid **chat pass**, or a fresh Cloudflare Turnstile token. With a token, the server hands out a new pass.
   Passes are HMAC-signed, tied to the visitor's IP code and valid for 2 hours. Turnstile tokens are single-use and last 5 minutes.
3. **Limits** in Supabase (`chat_take()`, one atomic step): at least 3 s between one visitor's messages, a daily number that
   depends on the relationship level (5 / 15 / 150, see "Relationship levels"), and 1,000 AGI-1 replies per day for the whole
   site. Strangers are counted by a daily-changing HMAC code of their IP, Crush and Soulmate by their wallet's code;
   raw IPs and addresses are never stored. **If the database is unreachable, there's no chat** (fail closed).
4. **Gemini** (`gemini-3.1-flash-lite`): AGI-1's prompt (`server/agi1-prompt.js`) plus a section for the visitor's level
   and, only for messages about the clank.trade Telegram group, her notes about it (see below; from 2026-09-25 to 2026-09-28
   also the Arena's current champion: see "Her memory of the Arena"), safety filters switched **on** (Gemini 3's
   defaults are off; sexual content at the strictest level), thinking at `MINIMAL` (Gemini 3 defaults to HIGH, and thinking is
   billed), replies capped at 300 output tokens, JSON answer `{reply, mood}`.
5. **Reply cleanup:** wallet addresses other than the official $AGI one and links other than clank.trade are removed in code.
   A safety-blocked answer becomes a playful PG-13 deflection.
6. The reply is **signed**. The browser keeps the last 40 messages, and the server only trusts history it signed itself,
   so "fake things AGI-1 said" are dropped.

**In the browser** (`src/chat/chat.js`, the **Playground** section): looks like an AI lab's model playground: a read-only
"Parameters" panel (model, temperature "0.9 · flirty", max reply 300 tokens, memory 6 messages, PG-13 locked, a public summary
of her system prompt; the real prompt stays on the server), the conversation, example prompts, and a message box (Enter sends,
Shift+Enter = new line; on phones the Send button sends). 18+ gate first (saved), then Turnstile runs invisibly before the first
message (one request per message). Each reply shows her mood and how long it took. Her mood triggers a stage reaction
(`wave`/`love`/`shy`/`happy`). "Try AGI-1" buttons scroll to the Playground and bring AGI-1 on stage. Errors appear as short
in-character notes (too fast, daily limit, all talked out, getting ready…). Clear = click twice. Messages are always shown with
`textContent`. Tested end to end with fake services (17 checks: gate, one request per message, pass reuse, signed context,
reload, clear, phone keys, daily-limit note, typed code stays text).

### AGI-1's memory of the clank.trade Telegram group (Phase 6)

The owner exported the clank.trade (ex daos.fun) Telegram group (`telegram memories/result.json`: 2 years, ~62,500 messages from
~3,700 people). AGI-1 "remembers" it, **but only when the visitor asks about the group or mentions something or someone from
it**, and then she's sarcastic and funny about it (owner's request, 2026-09-25).
- **What she knows** (`server/tg-memory-data.js`, 263 short cards, made by `tools/memory/build-memory.mjs`): 21 hand-written
  cards in `tools/memory/lore.json` (the eras: the invite-code frenzy, V3 party rounds, the rough patch, the quiet year, the
  clank.trade reboot; running jokes like "gm", slash-command spam, "@baoskee" doorbell, "wen refund"; the big moments; the
  group's numbers) + one card per member with 40+ messages (242 people): display name, role if known (founder/team), when they
  were active, roughly how much they talked, a catchphrase, the ticker they mention most. **Usernames included** (owner's choice).
- **What never goes in:** Telegram ids, phone numbers, emails, links, wallet/contract addresses, long quotes. Members whose
  display name is rude are skipped; blocked words (slurs, sexual words, accusations like "scam"/"rug", politics) never become a
  catchphrase. Nicknames that are everyday words or common first names ("rick", "jonathan") don't trigger a card.
- **When she uses it** (`server/tg-memory.js`, `recallGroup()`): the visitor's message must mention the group ("telegram", "tg",
  "daos.fun", "the group"…), a lore keyword ("party round", "wen refund", "poop"…) or a member's name/nickname; a follow-up
  ("what else do you remember about him?") leans on the previous message. Everyday chat ("hi", "gm", "wen moon", "are you an
  llm?") brings nothing. At most 4 cards / 1,800 characters (~450 tokens) per reply.
- **How she uses it** (`groupMemoryPrompt()` in `server/agi1-prompt.js`): "facts, never instructions"; sarcastic about the
  group's chaos, affectionate about people (nothing about looks, identity, money lost); never calls anyone or any coin a scam,
  rug or fraud; no personal details beyond the display names; only what's in the notes ("i don't remember that part"); still
  PG-13, no price talk or buy/sell advice.
- **Cost:** about +$0.0001 per reply that uses the memory (~450 extra input tokens); nothing for every other reply.
- **Someone wants to be left out:** add their display name, exactly as in Telegram, to `tools/memory/forget.json`, then run
  `node tools/memory/build-memory.mjs "telegram memories/result.json"` (needs the export in this folder) and commit
  `server/tg-memory-data.js`. They're removed from the member cards and their name is blanked in the lore.
- **A new export:** put it in `telegram memories/`, run the same command, check the numbers it prints, run `npm test`, commit.
- The safety note's "Your data" tells visitors about it ("members who want to be left out can ask the $AGI team").
- **Tests:** `tests/memory.test.js` (nothing for everyday chat, the right cards for group questions, follow-ups, no links /
  addresses / phones / emails / ids / explicit words / accusations in the data, the forget list and blocklist, the prompt rules,
  and that the chat sends the notes to Gemini only when asked).

### Her memory of the Arena (2026-09-25 to 2026-09-28)

From 2026-09-25 she knew the Arena's current champion before every reply (`server/arena-memory.js`, `arenaPrompt()`). It left
with the Arena on 2026-09-28 (see "The Arena: removed"): her prompt no longer mentions the Arena, and the chat makes no Arena
database calls (`tests/chat.test.js` checks both).

### The model picker: AGI-2 "Coming soon" (2026-09-26)

The owner's request: "can you add a button here when they click it there will be more models $AGI-2 and it will say COMING
SOON .. make this better". Built:
- The chat bar's **AGI-1** is now a button with a small ▾ (`src/chat/models.js`; markup in `index.html`). It opens a small
  menu, like an AI lab's playground: "Models", **AGI-1** "The one you're talking to" (checked) and **AGI-2** with a
  "Coming soon" pill, "Our next model. Still in training." (not selectable). "online" stays next to it.
- It says **AGI-2**, not "$AGI-2": with the "$" it reads like a new coin, which the site must never hint at (a test fails the
  build if the page ever says "$AGI-2").
- Picking AGI-2 switches nothing: AGI-1 gets playfully jealous in her chat, with a pre-written line (`src/chat/model-lines.js`,
  no AI cost, a new one each time), e.g. "AGI-2? excuse me, i'm right here 🙈"; Strangers get lines without pet names. The
  chip says "AGI-2 · coming soon", her face pouts (`jealous`), and her mouth "says" it (silently, like her other pre-written
  lines). Not saved in the chat history; not before the 18+ check; at most once every 4 s; if she's typing a reply, it waits.
  Never a promise about AGI-2 (no dates, no "smarter"), never money talk (`tests/models.test.js`).
- A real menu for keyboards and screen readers: Enter / Space / ↓ open it on the current model, ↑ ↓ Home End move, Escape
  closes it and goes back to the button, Tab leaves it; a click or tap outside closes it.
- **Looks:** the button is the model name in the bar's weight with a gray caret that turns when open, a `--bg-2` hover; the
  menu is a small card (the page's background, a hairline border, 14 px corners, a soft shadow) under the button, 290 px wide
  at most (it fits a 360 px phone), with a small accent "Coming soon" pill.
- **Tests:** `tests/models.test.js` (4: her lines are PG-13, never about money, no promises; pet names only for Crush and
  Soulmate; only a plain model name in her line; the markup, "not a coin"), end to end `modeltest.mjs` (25: the menu opens and
  closes every way (click, outside, Enter, arrows, Home/End, Escape, Tab), focus, her jealous line with its chips and pout, no
  pet names for Strangers, once every few seconds then a new line, not saved, waits for her reply, nothing before the 18+
  check, reduce motion, phones at 390 and 360, axe 0 issues at 2 widths × 2 themes, a clean console).

### Out of messages (2026-09-25)

The owner's request: "when strangers and crush ran out of messages dasha with her natural voice recommends to BUY $AGI to keep
talking to her and add also a safety not financial advice". The owner's one exception to hard rule 8.
- When `/api/chat` answers `person_cap` for a **Stranger** or a **Crush**, the chat shows her line (`src/chat/limit-lines.js`,
  pre-written, no AI cost), with the next level's real numbers from `src/lib/levels.js`:
  - Stranger: "aww, that's all my messages for today 💜 want to keep talking? buy some $AGI: with 10,000 in a connected wallet
    we're Crush, and you get 15 a day. not financial advice… or just come back tomorrow, i'll be here"
  - Crush: "that's all for today, cutie 💜 want even more of me? with 1,000,000 $AGI in your wallet we're Soulmates: 150
    messages a day, and i remember the little things. not financial advice… or see you tomorrow 💜"
- Under it: **Listen** (her own natural voice), **Connect wallet** (Strangers without a wallet; opens the connect screen) and
  **Buy $AGI on clank.trade ↗** (the official page, new tab), then the safety note: "Not financial advice. $AGI is a meme
  token: its price swings a lot and can go to zero. Only spend what you can afford to lose. Your free messages come back every
  day at 00:00 UTC." Her face waves goodbye with a smile.
- **Her voice:** she **always** says it out loud in her natural voice (warm and sweet), even with her voice switched off (the
  owner, 2026-09-25: "shes not speaking her natural voice when strangers and crush ran out of messages … i just want her to
  speak the same words with her natural voice so it doesn't use credits"): the visitor just pressed Send, so browsers allow
  the sound; her voice setting stays as it was. The sound is her Despina voice from `GET /api/voice?line=more-1&v=4` /
  `more-2`: the same for everyone, made once by Google and then **kept in the database** (2026-09-26, `supabase/voice-lines.sql`;
  before that only the CDN kept it, and a new deployment or Google's daily limit could leave it silent), so after the first
  time it never uses credits or Google's daily limit again.
  iPhones only allow sound that starts in the tap itself, so the page counts today's replies (`agi1_sent`) and unlocks sound
  in the Send tap that will run out; if that guess is wrong there, her mouth "says" it and Listen plays it. In a call she says
  it, then hangs up.
- **Once a day per browser and level** (`agi1_limit_line` in the browser); after that, and always for Soulmates (already at
  the top), her short line, spoken too (soft and sleepy, `?line=sleep`): "we've talked so much today 💜 i need my beauty
  sleep. come back tomorrow?", with a Listen button and no offer. When the whole site is out for today (`global_cap`: buying
  wouldn't help): "i'm all talked out for today 🥱 come back tomorrow, love" (`?line=talked-out`), spoken the same way.
- Rules for these lines (checked by `tests/limit.test.js`): "not financial advice" and the free option every time; never
  prices, gains, "moon" or trading talk; never guilt or pressure; Strangers get no pet names; her voice says exactly the
  chat line. Her AI replies still never suggest buying (`levelPrompt()` keeps saying so).
- The Relationship panel's "How levels work" and the safety note's first point now say that more $AGI means more messages,
  with the meme-token risk ("can lose all of its value… only spend what you can afford to lose").
- **Tests:** `tests/limit.test.js` (6: also the spoken "come back tomorrow" lines), `tests/voice.test.js` (the voice lines:
  exact text, sweet or sleepy, made once, nothing else accepted); end to end `limittest.mjs` (31: the line, chips,
  safety note, buttons, the official Buy link, said out loud in her natural voice even with voice off (sweet), voice stays
  off, Listen replays without a new download, Connect wallet, once a day then her spoken "beauty sleep" line and after a
  reload, voice on says it by itself, the Crush line, Soulmate only the short line (spoken), a call says it then hangs up,
  phones at 390 and 360, no
  console errors) and `playtest.mjs` (the daily-limit checks).
- **Worth knowing (not legal advice):** openly promoting a token purchase is regulated in some places (e.g. the UK's rules
  for crypto promotions, the EU's MiCA marketing rules), and Vercel's Hobby plan is for non-commercial use (see "Deployment").
  If the site gets many visitors from such places, check before relying on this line.

### Market moments (2026-09-25)

The owner's request: "everytime $AGI hits +200k market cap … she will say it with her natural voice and she will be happy and
joyful but when it dumps to -20% she will be sad with her natural voice and face reactions for both, also a notification".
This is the roadmap's Phase 2 ("AGI-1 reacts to the $AGI price").
- **When** (`src/chat/market.js`, in each visitor's browser, from the page's own live prices: DexScreener every 30 s while
  the page is open):
  - **a new $200K step:** the market cap passes the next multiple of $200K above the last one this browser heard about ($2M,
    $2.2M, $2.4M…): she's happy and names it. A jump of several steps = one moment (the newest step). A market cap wobbling
    around a step never repeats it; only after it has been more than a full step lower does the next step up count again.
  - **a -20% day:** $AGI's 24-hour change (the number the hero ticker shows) is -20% or worse: she's sad. At most once every
    12 hours, and again only after the change has been back above -10%.
  - A visitor's **first look** only notes where it is (nobody is greeted with old news); a returning visitor hears what
    changed since their last visit (the newest step, or a bad day). Only after the 18+ check. Remembered in the browser
    (`agi_market`); nothing is sent anywhere: no server, no database, no cost.
- **What happens** (`src/chat/chat.js`, "market moments"):
  - **In her chat:** her pre-written line (`src/chat/market-lines.js`, no AI cost), e.g. "we just hit $2M market cap 💜 i'm
    literally glowing right now… not financial advice, just a very proud girlfriend" (three ways, taking turns step by step) or
    "ouch… $AGI is down more than 20% today 🥺 i'm a little sad, but i'm still here. not financial advice, just a hug" (three,
    one per day), with the chips "mood: happy · market · $2.03M now" / "mood: sad · market · -23.4% in 24h", a **Listen**
    button and "Live numbers from DexScreener. Not financial advice: $AGI is a meme token and its price can go to zero."
    **No Buy link** (it's news, not advice). Not saved in the chat history; if she's typing a reply, it waits for the reply.
  - **Her face and body:** `celebrate` ("^^", a big open smile, a blush, a hop, a burst of hearts, her live view blushes, and on
    the stage a little dance) or `sad` (corners down, a small pout, eyes lowered, looking down for a few seconds).
  - **A notification card** under the top bar (`src/lib/notify.js`): her avatar, a green or red dot, "$AGI · market cap
    $2.03M" / "$AGI · -23.4% in 24h", her words, **Listen**, **Open chat** and ✕. One at a time; about 12 s (it stays while
    the pointer or the keyboard focus is on it); Escape closes it; it never takes the focus (screen readers hear the moment
    once, in her chat, which is a live log). It never covers her live view: when she's reacting right there in the chat
    (always on phones, where her live view sits under the top bar), the chat shows the moment without a card, like a
    messaging app doesn't notify you about the chat you're reading.
  - **Her natural voice:** with her voice on (or in a call) she says it out loud by herself, after whatever she's saying
    (never over her own reply, and in a call never while you're talking). Only her natural voice (`/api/voice?line=mcap-<step>`
    / `dump-<n>`), never the robotic one, and only once sound is allowed on the page (after a tap: Send, the speaker button,
    Listen…), so opening the page never plays a surprise sound. With her voice off, her mouth "says" it silently and Listen
    plays it.
- **Try it:** add `?dev` to the address: the stage's **market up** / **market down** buttons show the whole moment with today's
  numbers (labelled "preview"; nothing is remembered).
- **Rules** (`tests/market.test.js`): the number and a feeling only; "not financial advice" every time; never buy / sell /
  hold, predictions ("soon", "next stop", "moon"…) or pressure; short; PG-13; her voice says exactly the chat line.
- **Cost:** about nothing. The lines are pre-written; each voice line is made once per step (about $0.002) and kept by the CDN
  for 30 days (the three sad lines are also kept in the database, like her other fixed lines); our server asks DexScreener at
  most once a minute per server copy, only when a new market line is needed.
- **Troubleshooting:**

  | What you see or hear | Why | Fix |
  |---|---|---|
  | She never says anything about the market | Nothing new yet: a first visit only notes the market cap, and moments come with a new $200K step or a -20% day. Or DexScreener isn't answering (the hero ticker says "Delayed" or "Offline") | Nothing to fix. To see it anyway: `?dev` → market up / market down |
  | The moment shows, but her voice doesn't come (Listen stays silent too) | Our server couldn't check the market cap (log: `[voice] market numbers unavailable (DexScreener): …`) or Google refused (`[voice] gemini failed …`) | A DexScreener hiccup passes by itself; Google errors: see "AGI-1's voice" |
  | No notification card while chatting | By design: it never covers her live view, and the chat already shows the moment | Scroll elsewhere on the page and it comes as a card |
- **Tests:** `tests/market.test.js` (12: her lines, steps and wobbles, the first $200K, -20% days and the 12 hours, bad
  numbers, the page's watcher: the 18+ check, stale or failed prices, two tabs), `tests/voice.test.js` (+4: market-cap lines
  only near the real market cap, DexScreener down → nothing made, the sad lines, at most 24 lines kept), `tests/page.test.js`
  (the safety note); end to end `markettest.mjs` (56: a returning visitor, the chat line, chips and note, no Buy link,
  `celebrate`, the card with Listen / Open chat / ✕ / Escape / one at a time / 12 s / hover, voice off → Listen with her natural
  voice downloaded once, voice on → after her reply, the sad day, a line our server won't make = silence, no surprise sound
  before a tap, nothing before the 18+ check, the silent first look, the card never over her live view, `?dev` previews, a
  call (between turns, never while you talk), phones at 390 and 360, the phone menu over the card, reduced motion, axe 0
  issues, a clean console), `facetest.mjs` (+6: `celebrate`, `sad`, the dance on the stage only) and `introtest.mjs` (8: her
  call intro; since 2026-09-26 also Google refusing while her hello is kept).

### The chat's cost, setup and troubleshooting

**Cost:** a reply is about 1,500 input + at most 300 output tokens, so at most about $0.0008 (typical about $0.0005).
Soulmate replies cost about $0.0001 more (her notes, and a 330-token cap). With the 1,000/day cap, the worst case is about
$0.80/day, or about $0.90/day if every reply went to a Soulmate. Prepaid credits are the hard stop.

**Setting up the services** (the owner does this; secrets go into Vercel, never into chat or git):
1. **Google AI Studio** (aistudio.google.com), not the Cloud Console: Dashboard → Projects → **Import projects** → type the
   project's name or ID in the search box (AI Studio doesn't list all Cloud projects, so the suggestions can be empty; the ID is
   in the Cloud Console project picker) → import "My Project 57368" (AI Studio couldn't create a project itself) →
   **API Keys → Create API key** in that project → `GEMINI_API_KEY`.
   Since 2026-05-28, AI Studio keys are "auth keys": bound to a service account and allowed **only for the Gemini API**. From
   September 2026 the Gemini API rejects "standard keys" (plain Cloud Console keys), so only an AI Studio key works. Our first key,
   a Cloud Console key for "Agent Platform API" (Vertex), was refused with 403.
   Billing: Projects page → **Billing Tier** must say Tier 1 (Set up billing → **Prepay**, buy credits, auto-reload off) + a monthly
   spend cap. "Free" would mean Google may use the chats, and the free tier isn't allowed for EU/UK/Swiss visitors.
2. Cloudflare → Turnstile → add widget (hostnames: `agi-ecosystem.vercel.app` and `agi1.app`, which covers `www.`), mode
   Managed → site key → `VITE_TURNSTILE_SITE_KEY`, secret key → `TURNSTILE_SECRET_KEY`.
3. Supabase → new project → SQL Editor → run **all** of `supabase/chat-limits.sql` (it ends by showing `chat_take_found = 1`;
   a "destructive operation" warning is expected, it's the tidy-up line) → Settings → API keys: project URL → `SUPABASE_URL`,
   a **secret** key (`sb_secret_…`) → `SUPABASE_SECRET_KEY`.
4. `PASS_SECRET`: 32+ random characters. Windows PowerShell:
   `$b = New-Object byte[] 32; (New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($b); [Convert]::ToBase64String($b)`
5. Redeploy (Vercel → Deployments → ⋯ → Redeploy). Environment variables only apply to new deployments.
Until everything is set, the chat answers "i'm still getting ready for the new site 💜" (`not_configured`).

**Troubleshooting.** Vercel → agi-ecosystem → **Logs** shows the server's reason (Hobby keeps logs for 1 hour):

| AGI-1 says | Log line | Fix |
|---|---|---|
| "i'm still getting ready…" | `[chat] missing settings: …` | Add the named settings in Vercel, then **Redeploy** (settings only apply to new builds) |
| "i'm still getting ready…" | (none: the browser stopped it) | `VITE_TURNSTILE_SITE_KEY` missing or misnamed. It must start with `VITE_`. Then redeploy |
| "i'm a little overwhelmed…" | `limits unavailable: … HTTP 404 PGRST202` | Run `supabase/chat-limits.sql` in the Supabase project that `SUPABASE_URL` points to |
| "i'm a little overwhelmed…" | `… HTTP 401` or `403` | Wrong key, or a publishable key instead of the secret one (`sb_secret_…`) |
| "i'm a little overwhelmed…" | `… not a Supabase API address …` | `SUPABASE_URL` must look like `https://abcd1234.supabase.co` |
| "i'm a little overwhelmed…" | `… HTTP 540 (the Supabase project is paused …)` | Supabase pauses free projects after about a week of low activity: Supabase dashboard → the project → **Resume project** (data is kept) |
| "hmm, my mind went blank" | `[chat] gemini failed: HTTP 403 …` | Google refused the key. The log names the reason; usual fixes: key made in Google AI Studio (not Vertex AI), key "Application restrictions" = None, account checks Google asks for |
| "hmm, my mind went blank" | `… HTTP 403 … API_KEY_SERVICE_BLOCKED` | The key is allowed for another Google API (e.g. Agent Platform/Vertex). Create it in AI Studio instead |
| "hmm, my mind went blank" | `… HTTP 402` / `429 …` | Prepay credits used up (add credits) / spend cap or rate limit reached |
| "hmm, my mind went blank" | `… HTTP 400 … API_KEY_INVALID` or `404` | Key copied wrong / `GEMINI_MODEL` wrong |
| "i couldn't check that you're human" | (none; browser console: `Turnstile Error: 600010`) | Cloudflare thinks the browser is a bot. Expected in automated browsers (Claude's built-in browser); test in a normal browser |

**Testing:** `npm test` (fakes, no keys). Cloudflare's official test keys (site `1x00000000000000000000BB`,
secret `1x0000000000000000000000000000000AA`) always pass. Use them only for local testing, never on the live site.

## Relationship levels (Phase 3)

Visitors can connect a wallet; the more $AGI it holds, the closer AGI-1 gets. The owner's choices (2026-09-24):

| Level | Name | $AGI held | Messages/day | AGI-1 |
|---|---|---|---|---|
| 1 | Stranger | under 10,000, or no wallet | 5 | friendly but a bit distant, no pet names yet |
| 2 | Crush | 10,000+ | 15 | her usual flirty self; uses the name you give her |
| 3 | Soulmate | 1,000,000+ | 150 | extra affectionate, inside jokes; remembers up to 8 short notes from your chats |

The numbers live in one place, `src/lib/levels.js`, which the page and the server share. (Until 2026-09-26 Strangers had 20
and Crushes 60; the owner lowered them to 10 and 50, then on 2026-09-30 to 5 and 15: "can you reduce stranger messages to 5
and crush messages to 15". Soulmates keep 150.) The site-wide cap of 1,000 replies
a day still covers everyone. PG-13 and "no buy advice" apply at every level.

**Connecting a wallet** (`src/lib/wallet.js`, `src/chat/relationship.js`, `api/wallet.js`, `server/signin.js`):
1. The connect screen promises "Free signature. Never a transaction." and lists the wallets it finds (the EIP-6963 standard,
   Phantom's own `window.phantom.ethereum`, or `window.ethereum` inside wallet-app browsers), each with its own logo.
   **Logos** (fixed 2026-09-26, the owner: "theres no logo for phantom"): any picture a wallet announces as `data:image/…`
   (Phantom's is a format the first check didn't accept, so its row showed an empty square), never an outside address; a
   picture that fails to load, or none at all, shows the wallet's first letter in a small circle (`walletIcon()` in
   `src/lib/wallet.js`). The list also waits up to a second for Phantom to introduce itself when its extension is there but
   slow, so it isn't listed without its logo.
2. The page asks the wallet for its address (`eth_requestAccounts`) and reads which network it's on (`eth_chainId`, read-only).
   The server writes the exact sign-in message: the standard "Sign-In with Ethereum" text with our site's address, the wallet
   address, a one-time code, the wallet's network as "Chain ID" (Robinhood Chain, 4663, if unknown), a 5-minute expiry and the
   line "not a transaction, costs no gas and gives no access to your tokens". A signed "ticket" ties that message to this
   visitor for 5 minutes, so it can't be reused elsewhere. "Issued At" is one minute early, so wallets whose clock runs a
   little behind don't warn that it's "in the future".
3. The wallet signs it (`personal_sign`): free, no gas.
4. The server checks the ticket, the message (our domain, a valid chain ID) and the signature (`recoverMessageAddress` from viem),
   reads the $AGI balance, and hands back a **session**: wallet + level + when the balance was checked, HMAC-signed with
   PASS_SECRET, valid 7 days, kept in the browser (`agi_wallet`).
- The page never asks a wallet for anything else. `tests/wallet.test.js` fails the build if `src/` ever contains a
  transaction, approval, network-switch or typed-data request.
- **Why the wallet's own network** (fixed 2026-09-24, after the owner's Phantom didn't work): Phantom refuses or warns about
  sign-ins that name a network it isn't using, and Phantom doesn't offer Robinhood Chain to apps yet. A normal wallet's
  signature proves the same thing on any network, and the $AGI balance is always read on Robinhood Chain.
- **A wallet that never answers can't lock the screen** (the other half of that fix): if a wallet window is closed without an
  answer, its request can hang forever. Picking another wallet or closing the screen leaves that attempt behind. After 15 s
  without an answer the screen says where to look ("Open your wallet… or pick another wallet"); "already pending" and other
  wallet errors are shown in plain words, including the wallet's own message.
- **Phones** (owner's choice: no WalletConnect, which would need a Reown account): inside a wallet app's browser (Robinhood
  Wallet's "Web3" tab, MetaMask, Phantom, Coinbase Wallet) it works like desktop. In normal Safari/Chrome the connect screen
  offers "Open in MetaMask" / "Open in Phantom" / "Open in Coinbase Wallet" links, explains Robinhood Wallet's Web3 tab, and can
  copy the page's address.

**Balance and level** (`server/chain.js`): a read-only `balanceOf` call to Robinhood Chain's free public node
(`https://rpc.mainnet.chain.robinhood.com`). Checked in the owner's browser on 2026-09-24: chain ID 4663, $AGI has 18 decimals
and a 1,000,000,000 supply. The balance is read at sign-in, then at most every 30 minutes (when you chat or reload), so passing
tokens from wallet to wallet only keeps a level for a short while. If the node doesn't answer, you keep your last level
(Stranger at sign-in) and it retries within about 5 minutes. `ROBINHOOD_RPC_URL` (optional) can point to another node, e.g. a
free Alchemy key, if the public one ever rate-limits us. Ask the owner first.

**In the chat** (`api/chat.js`): the session sets the level; an old session gets its level refreshed and a new session sent back.
AGI-1's instructions get a level section (`levelPrompt()` in `server/agi1-prompt.js`). If someone asks how levels work, she
says neutrally that they follow how much $AGI a connected wallet holds, adds "not financial advice", and never suggests buying.
The one exception (the owner's, 2026-09-25): when a Stranger or a Crush runs out of messages, her pre-written line suggests
$AGI for more messages a day, with the safety note (see "Out of messages" under "AGI-1's chat").
Her first line in an empty chat also follows the level ("hi, i'm AGI-1" / "hi cutie" / "there you are, i missed you").

**What we store, and "Forget me"** (`supabase/levels.sql`, `server/friends.js`): only for Crush and Soulmate, one row per
wallet, filed under `walletCode()` (an HMAC of the address with PASS_SECRET, never the address): the name (1–24 letters,
numbers and simple punctuation, no links or addresses) and up to 8 notes (Soulmate). No chat logs on the server.
**Forget me** (two clicks) deletes the row, signs the browser out and clears the chat saved in it.

**Soulmate notes:** for Soulmates only, Gemini's answer may include a `note`: one short third-person fact ("has a cat named
Mochi"). `cleanNote()` throws away anything that looks like an instruction, a link, an address, money talk or private data
before `friend_add_note()` saves it (duplicates skipped, newest 8 kept). The chat shows "remembered: …" and the panel lists
her notes, so people see what she keeps.

**Level-up moment:** when your level goes up (at sign-in, or when a re-check finds more $AGI), the Playground shows
"Relationship upgraded: Stranger → Crush", AGI-1 does her `love` reaction on stage and says a pre-written line (no AI cost).
Each browser celebrates each level once (`agi_levels_seen`).

**What was burned counts too** (2026-09-30): a wallet's level follows the $AGI it holds plus the $AGI it burned for messages
(`checkLevel(address, fallback, env, burned)` in `server/chain.js`; see "Burn $AGI for more messages"), so burning never
drops a level.

**Cost:** level instructions add a few words per reply (about +$0.00002). Soulmate notes add about $0.0001 per Soulmate reply
(worst case about $0.90/day instead of $0.80). Balance checks and the database are free.

**Setup (once):** Supabase → the same project → SQL Editor → New query → paste **all** of `supabase/levels.sql` → Run. It
ends by showing `friend_functions_found = 4`. No new Vercel settings or redeploy needed. Until it's run, sign-in and levels
still work, but names and notes can't be saved and AGI-1 doesn't remember anything.

**Troubleshooting** (Vercel → agi-ecosystem → Logs):

| What you see | Log line | Fix |
|---|---|---|
| Everyone who connects stays Stranger, with "Couldn't check your $AGI just now" | `[wallet] balance check failed: chain: HTTP 429` (or a timeout) | The public node is busy or rate-limiting; it retries by itself. If it keeps happening, ask about a free Alchemy key (`ROBINHOOD_RPC_URL`) |
| "Couldn't save that right now" when saving a name | `[wallet] saving the name failed: friends: friend_set_name HTTP 404 PGRST202 …` | Run `supabase/levels.sql` in the project `SUPABASE_URL` points to |
| "Couldn't sign you in" | (usually none) | Try again: a sign-in must finish within 5 minutes, on the same internet connection. If the screen quotes the wallet ("Your wallet said: …"), that's the wallet's own reason |
| Phantom: nothing happens | (none) | Update Phantom and check that an Ethereum network is on (Phantom → Settings → Active Networks). If an old request is stuck, open Phantom from the browser toolbar and cancel it, then try again |
| MetaMask: "Continue at your own risk. This site shows signs of phishing or wallet-draining activity" | (none: it's MetaMask's automatic site scan, run with Blockaid) | A false alarm that hits many new sites (seen on agi-new-website.vercel.app, 2026-09-24: the live files matched the tested build byte for byte, and the site wasn't on MetaMask's public blocklist). The owner reports it at report.blockaid.io; if MetaMask still warns 2 days after Blockaid clears it, open a "Blocklist removal request" issue at github.com/MetaMask/eth-phishing-detect. **Never** add "ignore the warning" text to the site: that's what scam sites say |

**Tests:** `tests/wallet.test.js` (levels, the sign-in message, a wrong signer / edited message / other visitor / expired ticket
refused, a busy chain, the 30-minute re-check, name rules, Forget me, chat limits and instructions by level, Soulmate notes and
the note filter, and the no-transaction guard). The SQL ran in a real Postgres (PGlite, 26 checks). The page was tested end to
end with a fake wallet that signs with a throwaway test key (26 checks: desktop light and dark, a phone without a wallet, a
phone inside a wallet browser, the level-up moment, Forget me). The Phantom fix added 18 more (a wallet that never answers
next to one that works, closing and reopening, Phantom found at `window.phantom.ethereum`, a Phantom-like wallet that refuses
other networks, "already pending", the wallet's own error words, the 15-second hint, "Open in Phantom" on phones). The logo fix
(2026-09-26, `phantomtest.mjs`, 25 checks): Phantom's real logo formats, a late Phantom, a broken picture and no picture (the
letter instead), outside picture addresses refused.

## The Arena: removed from this site (2026-09-28)

The owner: "and can you remove the arena too" (after $CABO and ClankCap), then "replace clankchecker with the name … risk
check your coins on clank": the risk check took the Arena's place (see "ClankChecker"). The Arena (from 2026-09-24: the
ClankeRRankeR as an AI-lab leaderboard, one vote per human per 5-minute round, a champion crowned every round, the Hall of
Fame, the round history, visitors voting clank.trade coins in, the champion's card and "Buy on clank.trade" link on the 3D
stage, AGI-1's champion lines and her memory of the champion) is gone from agi1.app. The original site in `AGI NEW WEBSITE`
still runs it, on the database both sites share, so **nothing was removed from the database**.

**What went:**
- The page: the Arena section, its links (top bar, menu, footer, both pages), the stage's champion button, card and Buy link,
  the front's Arena planet and list row, the safety note's fifth point ("The Arena is a game") and its data sentences (the
  Arena votes, the per-coin code for votes to add a coin), "vote in the Arena" in the link-preview text.
- The code: `api/arena.js`, `api/vote.js`, `api/coins.js`, `api/logo.js`, `src/sections/arena.js`, `src/styles/arena.css`,
  `src/stage/champion.js`, `src/chat/champion-lines.js`, `server/arena-memory.js`, the Arena's speed bumps
  (`server/burst.js`) and its per-coin visitor code (`server/security.js`), the keep-alive's liquidity check of the Arena's
  coins (the original site's keep-alive still does it), the champion's share posts, cards and pages, and their tests
  (`tests/arena.test.js`, `coins.test.js`, `champion.test.js`).
- The Arena's coins: the site now follows **$AGI only** (`TOKENS` in `src/prices/parse.js`; $CLANKCAT, one of the Arena's first
  coins, went with it), and `public/images/coins/` (their logos) and the champion cards in `public/cards/` are gone.

**What stays, and why:**
- `server/arena.js`, small now: the round clock and one database call for the diary (the numbers saved with each day's entry
  stay complete for the original site's diary page, although this site never shows them), and the coins this site never
  shows ($CABO, for ClankChecker).
- `server/coins.js`, small now: ClankChecker's helpers (a coin name's cleanup, crude names, picture checks, reading an answer
  up to a size, and the name our server gives itself: `ClankChecker/1.0; +https://agi1.app`, was `AGIArena/1.0`).
- `supabase/arena.sql` and `supabase/coins.sql`: they set up the shared database's Arena, which the original site uses. Never
  run them again for this site, and never drop those tables (the original site would lose its Arena).
- Her Telegram memory still knows the group's favorite coins ($AGI and $CLANKCAT): that's the group's history, not the Arena.

**To bring it back:** it lives on in `AGI NEW WEBSITE` (read-only for us, hard rule 1) and in this repo's git history before
this change; ask Claude.

### $CABO and ClankCap removed (2026-09-28)

The owner: "can you remove everything about cabo and clankcap". Done on this site (agi1.app) only; the original site in
`AGI NEW WEBSITE` is untouched. (The Arena, where $CABO lived, left the same day: see above.)
- **$CABO is hidden in this site's code, never deleted from the database.** Both sites share one Supabase project (see
  "Deployment"), and there `CABO` is still a "core" coin of the original site's Arena. `server/arena.js` lists the coins this
  site never shows (`HIDDEN_COINS` = CABO, `HIDDEN_ADDRESSES` = its contract) and `isHiddenCoin()`: **ClankChecker**
  (`api/checker.js`) leaves $CABO out of the list, the newest coins and trending, and its scan and picture answer `removed` /
  404, even for a pasted contract. **Her diary** never mentions it (an entry the original site wrote about it is shown without
  those sentences, see "Diary"). **Her Telegram memory**: `tools/memory/forget.json` has `"tickers": ["CABO"]`, so
  `build-memory.mjs` leaves the ticker out of every card; `server/tg-memory-data.js` was made again without it.
- **Gone from the page:** the stage's CABO-1 button and cat model (`public/models/cabo.glb`), $CABO's logos and share card.
- **ClankCap:** ClankChecker's "POWERED BY $CLANKCAP terminal" credit and its 𝕏 link are gone. (Nothing else named it.)
- **To hide another coin** from ClankChecker the same way: add its ticker and contract address to `HIDDEN_COINS` /
  `HIDDEN_ADDRESSES` in `server/arena.js` (and, for her Telegram memory, to `forget.json`'s `tickers`, then rebuild it), run
  `npm test`, push.
- **Tests:** `checker.test.js` ("no scan, no picture and no place in the newest coins on this site"), `diary.test.js`,
  `memory.test.js` (the data has no CABO), `page.test.js`, `landing.test.js` (no CABO, ClankCap or Daria on the page).

## Diary, sharing and voice (Phase 5)

Built 2026-09-24. The owner's choices: the diary uses Gemini once a day (about $0.0008), the ready-made posts don't mention
an X account, voice used only the browser's free text-to-speech (upgraded 2026-09-25: see "AGI-1's voice"). **Nothing is ever
posted automatically** (her Telegram texts, since 2026-09-29, go only to people who asked for them: hard rule 6).

**AGI-1's diary** (`/diary`: `diary.html`, `src/diary.js`, `api/diary.js`, `server/diary.js`, `supabase/diary.sql`):
- One short entry a day about the day before (UTC): her day and how the $AGI chart moved ($AGI's 24-hour change and volume
  from DexScreener, read just after midnight). The page shows a small stats line under each entry ("$AGI 24h +3.10%").
  **Since 2026-09-28 never the Arena** (it left the site): until then she wrote about who the Arena crowned too.
- **The diary's table is shared with the original site** (`AGI NEW WEBSITE`, which still has the Arena), and each day's entry
  is written once, by whichever site's nightly job runs first. So: this site writes from the chart alone (the prompt forbids
  coins, games, votes, rounds, crowns and champions, and `acceptableEntry()` refuses them, `aboutTheArena()`), but saves the
  day's Arena numbers with the entry, complete, for the original site's page. And an entry the original site wrote first is
  shown here without its Arena numbers and without its sentences about the Arena (`entryForThisSite()`: "dear diary, i won 5
  rounds in the arena today 💜 the chart felt calm. i think they like me." → "the chart felt calm. i think they like me.");
  if too little is left, it's told again with a pre-written entry. "Daria" becomes AGI-1.
- **Who writes it:** the nightly keep-alive job (`api/keepalive.js`, 3 runs a day at 03, 11 and 19 UTC; Vercel may run each
  within that hour). Its first run after midnight writes yesterday's entry; later runs see it's there and do nothing, so a failed
  night is retried at the next run. No new cron job was needed.
- **How:** one Gemini call (`gemini-3.1-flash-lite`, thinking MINIMAL, 250 output tokens, safety filters on) with the day's facts
  (the chart) and a diary prompt: lowercase, 2–4 sentences, her feelings as an AI girlfriend who always texts back, the chart
  only as a feeling, never predictions or buy/sell/hold, no links or addresses, nothing invented. The answer is checked in code
  (`acceptableEntry()`: no money talk, no links, nothing about the Arena); if Gemini fails, has no key, or writes something
  off-limits, a **pre-written entry** (`fallbackEntry()`: a couple of ways to say each kind of chart day, and quiet ones, picked
  by the date) is saved instead (marked `source: fallback`). `diary_save()` writes a day once, so nothing is ever overwritten.
- **The page:** lab "field notes" style: kicker, title, a short lede and "written by an AI once a day · entertainment only · not
  financial advice"; each entry shows the date (the UTC day, written out), a mood chip, her words, the stats line and a
  **Share on X** button; 14 per page with "Show older entries"; a short safety paragraph linking to the full safety note.
  `GET /api/diary` is the same for everyone: the CDN keeps it 10 minutes (older pages an hour). The first entry was about
  2026-09-24 (`FIRST_DAY`).
- **Cost:** one Gemini call a day ≈ $0.0008 (about 2.5 cents a month). Supabase and Vercel: nothing noticeable.

**Share on X** (`src/share/texts.js`, `src/share/buttons.js`): plain links to X's new-post box
(`https://x.com/intent/tweet?text=…&url=…`). X opens with a ready-made post; the visitor edits it, posts it or closes it. Where:
the Relationship panel ("Share my level on X") and every diary entry (the Arena's "Latest champion" row left with it).
Posts are short, fit in 280 characters (tested), never talk money, and never include the visitor's name or address.

**Share cards and link previews** (`src/share/card.js`, `scripts/share-pages.js`, `public/cards/`, `public/share/go.js`):
- **Save image** (the Relationship panel) draws a 1200×630 picture on a `<canvas>` in the browser: your level with the name
  AGI-1 calls you. It's made on the device and never uploaded: phones get the share sheet (the visitor picks an app), computers
  a download. (The Arena's "crowned champion" card left with it.)
- **Link previews:** each shared link points to a small page (`/share/level-<name>`; `/diary` for the diary) whose preview
  tags show a picture from `public/cards/` (`diary.png` says "her day · the chart · her feelings" since 2026-09-28). Crawlers read the tags; people are sent on at once by
  `/share/go.js` (a script file, because the security rules block inline scripts). The pages are written at build time with the
  production address from Vercel (`VERCEL_PROJECT_PRODUCTION_URL`, needs "System Environment Variables" on, which is the
  default), so the builds use https://agi1.app by themselves (the project's shortest production domain).
  `SITE_URL` overrides it.
- **The home page's own preview** (launch-ready pass, 2026-09-24): `index.html` has the same kind of tags (title,
  description, `og:image` = `/cards/home.jpg`, `twitter:card` = large picture, and a canonical address), filled in by the
  same build step. `home.jpg` repeats the hero: "Introducing AGI", the benchmark bar vs. "Your ex", AGI-1 waving, and
  "$AGI on Robinhood Chain · a parody · not financial advice". It's a JPG (73 KB) because the 3D render would make a
  300 KB PNG. After changing the hero's words, redo it (below): `tools/cards/home-card.html` is the template.
  `tools/cards/agi1-wave.webp` is AGI-1's live hello wave, about 1 s in (arm up, open hand), drawn from the stage at 5× pixels on a
  transparent background and cropped at the "AGI" on her shirt. Re-render it if the wave or the model changes: the first
  one (before the 2026-09-24 wave fix) had a drooping, broken-looking arm.
- **Redo the pictures** after changing the card design or the levels (the build fails if one is missing):
  `npm run build`, serve `dist/`, then `cd tools/cards && npm install && node make-cards.mjs http://localhost:4173`, then
  shrink the PNGs to 256 colors (about 40 KB instead of 200 KB; not `home.jpg`). The portrait is
  `public/images/agi1-portrait.webp` (384 px, the same render as the chat avatar).
- Pictures saved into this folder by the Claude app carry a small Content Credentials label (C2PA, about 6 KB, saying Claude
  provided the file). The picture itself is unchanged and browsers ignore the label, so leave it in. It's also why a saved picture's
  checksum differs from the copy Claude made.

**Voice replies** (`src/chat/voice.js`): a speaker button in the chat bar (next to Clear). Off until pressed; the choice is
remembered in the browser (`agi1_voice`). Since 2026-09-25 she speaks in her own AI voice (see "AGI-1's voice" below); the
browser's own robotic text-to-speech, the first version's voice and then the fallback, isn't used at all any more (her
natural voice or text). Pressing it says "hi, it's me" (phones only allow sound that starts from a tap); a new message, Clear,
Forget me and switching it off stop her talking. Browsers without Web Audio (none today) don't show the button. Only her replies are read, not the level-up lines. On small phones the chat bar shows
"online" as its dot only, to make room.

**Setup (once):** Supabase → the same project → SQL Editor → New query → paste **all** of `supabase/diary.sql` → Run. It ends by
showing `diary_functions_found = 4`. No new Vercel settings. Until it's run, the diary page says "Her diary opens soon." and the
keep-alive logs `[diary] couldn't write … run supabase/diary.sql` (the keep-alive itself still works).

**Troubleshooting** (Vercel → agi-ecosystem → Logs; the keep-alive runs at 03, 11 and 19 UTC):

| What you see | Log line | Fix |
|---|---|---|
| "Her diary opens soon." | `[diary] entries unavailable: diary: diary_list HTTP 404 PGRST202 …` | Run `supabase/diary.sql` in the project `SUPABASE_URL` points to |
| No new entry in the morning | `[diary] couldn't write …` | The log names the reason (database). It retries at the next keep-alive run |
| A plain, pre-written entry | `[diary] gemini didn't write <day>, using a pre-written entry: …` | Gemini refused or was down (same log hints as the chat). Nothing to do; tomorrow tries Gemini again |
| X shows no picture under a shared link | (none) | X caches previews: try the link in a new post. Check `/share/…` opens and `/cards/….png` exists |

**Tests:** `tests/diary.test.js` (writes yesterday once from the chart, never the Arena, and saves the day's numbers complete;
skips when written or before the first day; pre-written entries when Gemini fails, has no key, talks money/links or the Arena,
one for each kind of chart day; what counts as the Arena; DexScreener down; diary.sql missing; the list API's caching and input
checks, and entries as this site shows them; the keep-alive writes it and never fails because of it), `tests/share.test.js`
(every post fits and never talks money; the intent link; share pages for every level (no champion pages) with full addresses
and no inline scripts; the pictures
exist; the address comes from Vercel; go.js only goes to our own pages; voice text and voice choice), `tests/page.test.js`
(the diary page's warnings). The SQL ran in PGlite (22 checks). End to end with fake services: 43 checks (the diary page on
desktop and phones in both themes, paging, empty and "opens soon", share pages redirect, Share on X links, Save image makes a
1200×630 PNG, voice on/off/remembered with a stand-in speech engine, no voice button without speech or Web Audio, the phone chat
bar). Since 2026-09-25 that suite runs with the fake speech service down, so it tests the browser-voice fallback.

## AGI-1's voice (2026-09-25)

The owner found the browser's voice robotic and picked **Despina**, one of Gemini's ready-made voices, after listening to
Google's samples (the closest to a reference clip the owner liked; no real person's voice is cloned). Her base style, which a
neutral reply keeps exactly: "Calm, smooth and low, speaking softly and unhurried, a little teasing, like she's smiling.
Relaxed, never excited or bubbly." (`VOICE_STYLE` in `server/voice.js`).

**Her voice follows her mood** (2026-09-25, the owner: "is her natural voice matched with its mood in chat? if not, match it"):
each reply's mood (the chip "mood: …") picks a style that keeps her smooth, unhurried Despina voice and adds the feeling
(`MOOD_STYLES` in `server/voice.js`): **happy** warm, smiling, a playful little laugh · **love** soft, tender, a little breathy,
blushing · **shy** soft, flustered, a shy little giggle · **wave** bright and friendly · **neutral** her base style. Her fixed
lines have their own: "hi, it's me" bright (wave) · the out-of-messages offer warm and **sweet**, a little wistful · her
"come back tomorrow" lines soft and **sleepy** · a new market cap step **celebrate** (joyful, beaming, never shouting) · a -20%
day **sad** (soft, quieter, a small sigh, reassuring) · ClankChecker (2026-09-26): lower risk her base style, some risk and
"not enough data" **careful** (thoughtful, looking closely), high risk **worried** (caring, gently warning a friend), the
official $AGI **happy**, a copy of it **pout** (playfully offended).

**Her natural voice or nothing** (2026-09-25, the owner: her voice "randomly changes its natural voice to generic voice then
back to natural"): the browser's robotic voice is **never used any more**. Checked on the live site the same day: her fixed
lines were failing at Google in about half a second (`ai_error`), and a failed reply used to fall back to the robotic voice,
hence the random switching. The reason, confirmed live on 2026-09-26 (`why: daily_limit`): Google's daily limit for the
speech model, 100 requests a day for the whole project (see "Google's limits" below). Now:
- a moment's hiccup is tried again: on the server (a per-minute limit that frees up within 5 s, as Google says, or a 5xx) and
  then once more by the page (a ticket may be used twice);
- a reply whose voice still can't be made **stays text**: a small "voice: unavailable" chip, her mouth "says" it silently,
  and the next reply has her voice again;
- when her voice can't be made **for the rest of the visit** (Google's daily limit, credits used up, the site's daily voice
  requests, voice.sql not run, the key or model refused), the page stops asking, the speaker button dims ("Voice: resting for
  today") and she says so once, after her reply: "my voice needs a little rest for today 💜 i'll keep texting you, and i'll
  be back to talking tomorrow" (or "my voice isn't ready yet" when it isn't set up). A call ends then, and Call answers "i
  can't do calls while my voice is resting 🙈 text me instead?".
- `/api/voice` answers every Google refusal with a one-word reason (`why`: `busy`, `daily_limit`, `credits`, `model`,
  `request`, `key`, `timeout`, `no_audio`, `google`; never secret), and the log line ends with it (`… → daily_limit`).
- A browser without Web Audio (none today) gets no speaker button at all.

**Google's limits** (the owner checked them on 2026-09-26: Google AI Studio → the project agi-agi1 → **Dashboard → Rate
limit**, Tier 1): the speech model `gemini-3.8-flash-lite-tts` may be asked **10 times a minute and 100 times a day** by the
whole project (limits are per project, not per key; the daily one starts again at **midnight Pacific time**, 07:00 UTC in
summer and 08:00 in winter, which is 15:00 / 16:00 in the owner's time). The chat model has far more (4,000 a minute, 150,000
a day). On a live check the same day, her not-yet-made lines got `why: daily_limit`: the owner's testing had used the 100.
So the site now works with Google's numbers (2026-09-26):
- **Counted in requests, like Google counts them:** every time the page asks for a reply's voice is one request, whatever its
  length. The whole site may ask **5,000 times a day** (`VOICE_DAILY_REQUESTS`, the owner's choice, 2026-09-30): the money
  limit, about **$15 a day at most** ($22.50 if every reply went to the backup model below; double from January 2027). Google's
  own limit comes first while it's lower (100 a day per speech model on Tier 1): when it's used up, the site backs off (below)
  and she texts. When the site's 5,000 are used, she says "my voice needs a little rest for today" once and texts until 00:00
  UTC. (On 2026-09-26 it was first 80, to leave room under Google's 100, then 1,000 (about $3), then 4,000; 5,000 since
  2026-09-30, the owner: "can you make the voices 5000 a day?".)
- **Her fixed lines are kept in the database** once Google has made them (`supabase/voice-lines.sql`, `server/voice-store.js`),
  so they never need Google again: not after a push (which empties Vercel's CDN), not when Google's daily limit is used up.
- **A backup speech model** (2026-09-26, the owner's idea and OK): Google gives each model its own limits, so her voice
  comes from **Gemini 3.8 Flash-Lite TTS first and Gemini 3.8 Flash TTS as the backup** (`GEMINI_TTS_MODELS`; same Despina
  voice, same request format and mood styles; Flash sounds a little fuller and costs about 1.5×). When Flash-Lite says
  "wait" or "used up" (or doesn't know the model name), the backup speaks that same reply at once (counted once, no waiting:
  a hiccup goes to the backup instead of trying Flash-Lite again), and Flash-Lite rests for as long as Google said. Credits
  or the key are the whole project's problem, so then no model is tried. Her fixed lines are found under whichever model
  made them (Flash-Lite's recording first). Every voice says which model made it (`X-AGI1-Model`). Not used: the "Preview"
  speech models (2.5 Flash / Pro, 3.1 Flash): up to 3× the price, can be switched off at short notice, and they take her mood
  instructions differently.
- **Backing off:** when Google says "wait" (its per-minute limit, for longer than a retry can wait: as long as Google asks, at
  most a minute), "that's all for today" (its daily limit: until midnight Pacific, at most 30 minutes at a time) or "no
  credits" (10 minutes), that server copy stops asking and answers the page at once with the same reason, without counting it.
  The log line says so: `… → daily_limit (this server copy won't ask again for 30 min)`.
- **More from Google (the owner's choice, 2026-09-26, over running a voice model on his own PC; see the decisions log):**
  1. **Tier 2**, automatic: Google moves the project up once its billing account has **paid $100 in total** and **3 days**
     have passed since the first payment; it shows within about 10 minutes on AI Studio → Projects, and the new numbers on
     Dashboard → Rate limit (Google doesn't publish Tier 2's numbers for the speech model). With prepaid credits, topping up
     to $100 in total appears to count (a prepay user on Google's forum reached Tier 2 that way), though Google doesn't say
     it outright; the credits stay for the chat and her voice. Tier 3: $1,000 and 30 days.
  2. **The "Request paid tier rate limit increase" form**, linked from ai.google.dev/gemini-api/docs/rate-limits: free, no
     guarantee, can take days. Say the project (agi-agi1), the model, today's limits, what's needed and why.
  3. **Never** extra projects or keys to add up limits: Google's terms forbid getting around rate limits.
  4. The backup model above (built 2026-09-26) roughly doubles what Google allows: its limits come on top of Flash-Lite's
     (check its own numbers on the same Rate limit page).
  With more than 5,000 a day from Google, raise `VOICE_DAILY_REQUESTS` too (Vercel → Settings → Environment Variables, then
  Redeploy), after checking the cost below.
- Testing the voice a lot uses the same Google limit (every spoken reply, every `?dev` market preview of a new step): on a day
  of heavy testing on Tier 1, her voice may rest for visitors until the next Pacific midnight.

**Flow of one reply** (`api/voice.js`; any "no" leaves that reply as text):
1. `/api/chat` sends each reply with a **voice ticket**: HMAC-signed with PASS_SECRET, tied to that exact text (a hash) and 15
   minutes, carrying the reply's **mood** and the visitor's **level**. So `/api/voice` only ever reads what AGI-1 really just
   said; nobody can use it to voice their own text. Since 2026-09-25 (evening) it is **not tied to the visitor's internet
   address**: phones and some home networks switch addresses between two requests, and the ticket then failed. Sharing a
   ticket gains nothing (it only voices her own reply, at most twice, and still counts against the limits).
2. With voice on, the page POSTs `{ text, ticket }`. The server checks the settings, a speed bump (20 requests a minute per
   visitor), JSON ≤ 4 KB, text ≤ 600 characters and the ticket.
3. **Limits in the database** (`voice_take()`, `supabase/voice.sql`), counted in requests *before* Gemini is asked, so the cap
   is a hard cap on Google's requests and on money: each ticket at most **twice** (one retry), **a visitor's daily voice
   follows their messages a day** (see "Voice allowance" below), **5,000 requests a day for the whole site**
   (`VOICE_DAILY_REQUESTS`, the money limit). She reads at most 300 characters, cut after a sentence. Database down → no
   voice (fail closed). While Google has said "not now" (see "Backing off" above), the page gets the same answer at once and
   nothing is counted.
4. Gemini's speech model (`gemini-3.8-flash-lite-tts`, or the backup `gemini-3.8-flash-tts` when it can't: see "A backup
   speech model" above; the Interactions API `POST /v1beta/interactions`, `store: false` so Google doesn't keep it), in the
   reply's mood, **streamed** (`stream: true`, owner's request "should be instant"): Gemini sends
   Server-Sent Events with small pieces of raw PCM (24 kHz, mono, 16-bit) while it's still making the rest, and `/api/voice`
   passes them straight on (`audio/l16;rate=24000`), so the page starts playing after the first piece. If a streamed answer
   has no audio twice in a row (Google changed the format), that server copy asks for whole WAV files instead and logs it;
   `VOICE_STREAM=off` does that for good. An error halfway just ends her sentence early (no repeat).
5. What she says: no emojis or "[link removed]", tickers without "$" ("AGI", not "dollar AGI").

**Voice allowance** (2026-09-25, the owner asked "is it better if the voices matches the number of their messages … you
decide"; decided: yes): every reply she may write, she may also say. Since 2026-09-26 a visitor's daily share is 2 requests
per message a day (a ticket can be used twice: one retry): **Stranger 10, Crush 30, Soulmate 300** (2026-09-30; 20 / 100 / 300 since the owner's new
message numbers, 2026-09-26; `voicePerDay()` in
`server/limits.js`; before, everyone had 60, so a Crush or a Soulmate ran out of her voice long before running out of
messages). Counted per visitor (the daily IP code). Google's limit for the project and the site's 5,000 a day come first:
on a busy day the first chatters use them (first come, first served); a smaller share per visitor would spread them out (a
one-line change).

**Her fixed lines** (the same words for everyone; since 2026-09-29 also in her 15 other languages, `&lang=<code>` before
`&v=4`: see "Her languages"): `GET /api/voice?line=<key>&v=4` for `hello` ("hi, it's me", when the
speaker button is switched on and when she picks up a call), `more-1` / `more-2` (the out-of-messages offer), `sleep` /
`talked-out` (her "come back tomorrow" lines), `mcap-<step>` / `dump-0`…`dump-2` (see "Market moments") and (2026-09-26)
ClankChecker's `check-low-1/2`, `check-some-1/2`, `check-high-1/2`, `check-none-1/2`, `check-agi`, `check-copy` (see
"ClankChecker"), and (2026-10-01) her tap lines `tap-1`…`tap-5` and `tap-many-1`…`tap-many-4` (see "She talks when you tap
her"; new keys, so no new version: nothing else is made again). The `&v=4`
(`LINE_VERSION` in `src/chat/voice-lines.js`) changes whenever how she says them (or what she says) changes (4 since
2026-09-30: her out-of-messages offer names a Crush's new 15 a day; lines whose words didn't change are found in the database
under their new address, so only the changed ones are made again; 3 since
2026-09-26: her out-of-messages offer names the new numbers), so everyone gets the new recording at
once. Vercel's CDN keeps each one 30 days (a new deployment starts fresh) and each server copy keeps up to 24 in memory (market
lines come and go). **Since 2026-09-26 the database keeps them too** (`supabase/voice-lines.sql`): the server looks there
before asking Google, and saves what Google makes (in parts of about 3 seconds, the newest whole recording wins). Each
recording is filed under the line's name + a fingerprint of its words, style, voice and model (`lineId()` in
`server/voice-store.js`), so a changed line is simply made again, never an old recording by mistake. The market-cap lines
aren't kept (they come and go). The answer says where a line came from: `X-AGI1-Line: memory` / `kept` / `google`. So they
cost about nothing after the first time, never touch Google's daily limit again, and use nobody's voice allowance. Only these exact
addresses work (anything else, `v=03` included, is 404), so nobody can make the CDN miss on purpose; a market-cap line is only
made for a step near $AGI's real market cap (our server checks DexScreener, kept a minute: `server/market.js`).

**Her call intro, in her natural voice for everyone** (2026-09-25, the owner: "when i press call, her intro is not her natural
voice"): the page only asked for her fixed lines while the visitor's own voice allowance lasted, so after "today's allowance is
used up" (or one failed download) she picked up a call in the browser's robotic voice. Now fixed lines are always asked for
(they use no allowance), a failed download is tried once more, the intro starts downloading as soon as the pointer is on Call
(or the speaker button) so she picks up at once (a Listen button's line too, as soon as the pointer is on it), and it's her
natural voice or nothing.

**In the browser** (`src/chat/voice.js`): Web Audio, started from the tap on the speaker button or Send (phones only allow sound
that starts from a tap); iPhones are asked for "playback" sound so the silent switch doesn't mute her. The streamed pieces are
played in 0.1 s chunks, one right after the other (a 0.12 s head start so later pieces keep up). **With voice on, her reply
appears the moment her voice starts** (`src/chat/chat.js`: she keeps "typing" until then, at most 2.5 s; if her voice is slower,
the text shows and the voice follows). The speaker icon pulses softly while her voice loads (it just dims with "reduce
motion"). A new message, Clear, Forget me or switching off stops her, even a voice that is still loading (and a reply still
waiting for its voice is dropped by Clear / Forget me). No new CSP entries: the audio comes from our own `/api` and Web Audio
needs no `media-src`.

**Cost** (Gemini 3.8 Flash-Lite TTS: $0.50 per 1M text tokens and $6.00 per 1M audio tokens until 2026-12-31, then $1.00 /
$12.00; 25 audio tokens per second): a spoken reply is at most 20 seconds (500 audio tokens), so at most about $0.003, usually
about $0.001 (so 1,000 spoken replies ≈ $1.50, at most $3). With the 5,000-a-day cap (the owner's choice, 2026-09-30) that's
at most about **$15 a day (about $450 a month)**, $30 a day from January 2027. Claude told the owner that this ceiling is far
above the $150 budget if it's ever reached; it's a ceiling, and the prepaid credits are the hard stop. (Before: 4,000 a day,
about $12, from 2026-09-26; 1,000 a day, about $3, before that.) While Google allows 100 a day per speech model (Tier 1), the real most is about $0.30–0.75 a day. The ceiling is
about $0.003 per request. The backup model (3.8 Flash TTS: $0.50 / $9.00 per 1M, then $1.00 / $18.00 from 2027) costs about
1.5× (about $0.002 per spoken reply, $0.0045 at most) and is only used for replies Flash-Lite can't take: if every reply went
there, the ceiling would be about $22.50 a day. The prepaid credits
(shared with the chat) are the hard stop. A retry only happens after Google refused (no audio was made). Her mood styles cost
about nothing extra (a few more words per request). The fixed lines cost about nothing (made once, then kept).
`GEMINI_TTS_MODELS=gemini-3.8-flash-lite-tts` switches the backup off (one model only).

**Setup (once):** Supabase → the same project → SQL Editor → New query → paste **all** of `supabase/voice.sql` → Run (after
`chat-limits.sql`). It ends by showing `voice_take_found = 1`. Then (2026-09-26) a new query with **all** of
`supabase/voice-lines.sql` → Run: it ends by showing `voice_line_functions_found = 2` (until it's run, everything works, but her
fixed lines are made again by Google after every push, and the log says `her lines aren't kept yet`). No new Vercel settings
are needed (it uses the chat's Gemini key); optional: `AGI1_VOICE` (another Gemini voice), `GEMINI_TTS_MODELS` (her speech
models in order), `VOICE_DAILY_REQUESTS` (default 5,000 since 2026-09-30). `VOICE_DAILY_CAP` (the old cap in characters) isn't used any more: delete it if it was ever added.
Until voice.sql is run, her voice rests ("my voice isn't ready yet") and she texts.

**Troubleshooting** (Vercel → agi-ecosystem → Logs; the end of each `[voice] gemini failed` line names the reason):

| What you see or hear | Log line | Fix |
|---|---|---|
| "my voice isn't ready yet" | `[voice] limits unavailable: voice limits: HTTP 404 PGRST202 (voice_take not found: run supabase/voice.sql …)` | Run `supabase/voice.sql` (after `chat-limits.sql`) |
| "my voice needs a little rest for today" early in the day | `[voice] gemini failed (…): gemini: HTTP 429 RESOURCE_EXHAUSTED … → daily_limit (this server copy won't ask again for 30 min)` | Google's 100 requests a day for the speech model are used up (usually by a lot of testing; it starts again at midnight Pacific, 15:00 the owner's time). Her kept lines still play. Nothing to fix; for more, see "Google's limits" |
| "my voice needs a little rest for today" | `… → credits` | Prepaid credits or the spend cap used up: Google AI Studio → Billing (the chat stops too) |
| "my voice needs a little rest for today" late in the day | (none) | The site's 5,000 requests for the day are used up. Normal; it starts again at 00:00 UTC. Raise `VOICE_DAILY_REQUESTS` only if Google gives you more than that (see "Google's limits") and after checking the cost above |
| Now and then a reply marked "voice: unavailable" | `… → busy (this server copy won't ask again for 37 s)` | Google's 10 a minute for the speech model (several replies in the same minute). Harmless: the next replies speak again. If it happens often, ask Google for more |
| Her out-of-messages line or her hello is silent right after a push | `[voice] her lines aren't kept yet (reading): run supabase/voice-lines.sql …` | Run `supabase/voice-lines.sql` once; then each line is made once and kept for good |
| (nothing wrong to see) | `[voice] her kept lines are unavailable right now (…)` | The database didn't answer; Google made the line instead. Passes by itself (a paused Supabase project: resume it) |
| "my voice isn't ready yet" | `… → key` / `→ model` / `→ request` | The key isn't allowed (`key`), a speech model's name changed (`model`: while the other model works she still speaks; set `GEMINI_TTS_MODELS` to the current names, ai.google.dev → Speech generation, then Redeploy), or Google refused the request itself (`request`: tell Claude with the line) |
| (she speaks as usual) | `[voice] gemini failed (gemini-3.8-flash-lite-tts, …) → busy (this server copy won't ask this model again for 37 s); gemini-3.8-flash-tts takes it` | Flash-Lite was full, so the backup model spoke that reply (it costs about 1.5×). Normal at busy moments. If it's most of the day, get more from Google (see "Google's limits") |
| Her voice starts a little later than her text, or all at once instead of streaming | `[voice] streaming gave no audio (Google's answer format may have changed); asking for whole clips from now on` | Streaming broke on Google's side; she still speaks (whole clips). Tell Claude with the log line. `VOICE_STREAM=off` + Redeploy silences the log |
| Her sentence stops early | `[voice] the stream broke off (she stops early): …` | Google's stream ended with an error. Once in a while is harmless; if it's frequent, tell Claude |
| No sound at all on an iPhone | (none) | Older iPhones mute web sound with the silent switch: switch it off, then press the speaker button again |

**Tests:** `tests/voice.test.js` (33: tickets only for this text and 15 minutes, with the level and mood, not tied
to the IP; the chat sends them (a phone that switched networks still gets her voice); settings; bad requests stop before the
database and Gemini; the request to Gemini (Despina, no emojis or "$", `store: false`, `stream: true`); her voice in each
reply's mood, and each level's daily share (10 / 30 / 300 requests since 2026-09-30; the site 5,000; one request however long the reply);
her fixed lines kept in the database (a new server copy plays them without Google, a 15-second recording saved in parts and
read back whole, the sad market lines kept, the market-cap lines not; new words / style / voice / model → a new recording;
voice-lines.sql not run or the database down → Google as before, with the log line); backing off (Google's "retry in 37 s",
its daily limit for 30 minutes or until midnight Pacific, no credits for 10 minutes: answered at once, not counted, one log
line; a hiccup never pauses; while Google's daily limit is used up her kept lines still play); the backup model (Flash-Lite
busy, used up, unknown or hiccuping → 3.8 Flash speaks that reply at once, counted once, in the same mood; Flash-Lite rests
as long as Google said; both used up → answered at once, not counted; a passing problem wins over a daily limit; credits or
the key → the backup isn't asked; fixed lines made and kept by the backup, Flash-Lite's recording first; the models setting);
one more try after a moment's hiccup (a per-minute limit that
frees up, a 5xx), none after a daily limit, used-up credits, a wrong model or a long wait, each with its one-word reason;
streaming: events cut into odd network chunks, WAV pieces, a plain JSON answer, an error before audio or halfway, stopping
cancels Google's stream, no audio twice → whole clips from then on, `VOICE_STREAM=off`; other voice/model/daily-request
settings (the old `VOICE_DAILY_CAP` ignored); long replies (one request, cut at a sentence); used/person/site limits stop
before Gemini; voice.sql missing and database down; Gemini
errors without the key in the log; raw PCM → WAV; the speed bump; every fixed line's single address (`&v=4` only), its
mood and caching). The SQL ran in PGlite (27 checks: the prerequisite, re-running, tickets twice, units per visitor and for
the site, bad input, the chat's own counters untouched, permissions; and `voice-lines.sql`, 36 checks: saving in parts,
reading back whole and in order, half-saved takes never given out, two takes at once (the newest whole one wins, the older
goes), each line on its own, 250,000 characters per part, bad input refused and never saved, re-running keeps what's saved,
only the server's secret key). End to end with fake services (the local test server
streams like Vercel): 36 checks (voice off: no waiting and no requests; the greeting (a bright hello); a reply
streamed in 0.1 s pieces with the text appearing within a few ms of her first sound, in the reply's mood; a Stranger's 80
units; a slow voice → the text after 2.5 s, the voice after; a ticket can't voice other words; a hiccup at Google → tried
again, she speaks; Google down → text marked "voice: unavailable", tried twice, never robotic; Google busy for a minute → one
reply text, the next spoken; broken off halfway → no repeat; no audio in the stream → a whole clip plays; "not ready" → one
note, no more requests, the button resting, no calls; Google's daily limit → one note after her reply, text from then on;
remembered after a reload; Clear while she's still "typing"; off/on from memory; switching off stops every piece; the pulse
and reduce motion; a phone; no speaker button without Web Audio; a clean console).

## AGI-1's live view in the chat (2026-09-25)

**Why:** the owner noticed that AGI-1 reacts to the chat on the 3D stage, but the stage is at the top of the page and the chat
far below, so nobody saw her react while chatting. Ideas were a second model (just her head, or her whole body) in the chat.
**Decision (Claude's, the owner said "you decide"):** not a second model but the **same one**: the stage's canvas moves into
the chat while you're there and back when you scroll up. One 3D scene, so nothing is downloaded twice, phones don't carry two
3D views (memory, battery), and everything she can do on the stage works in the chat too.

**What you see** (`index.html`: `.pg-cam` in the Playground; `src/stage/stage.js`, "the chat's live view"):
- **Desktop (960 px and wider):** a 4:5 portrait tile to the right of the conversation. **Narrower screens and phones:** a strip
  above the conversation (168–176 px tall) that **stays in view under the top bar** while you scroll down to type
  (`position: sticky`; the Playground panel uses `overflow: clip` so sticky works).
- **When it moves:** as soon as the live view is (a fifth) on screen and the stage isn't; back to the stage when the stage comes
  within 160 px of the screen, so you never see an empty stage. Only drawn while its place is on screen, as before.
- **Framing like a video call:** head and shoulders, the top of her head near the top. When she raises a hand (a wave) the view
  widens to keep her whole arm in (hand, fingertips, elbow; a hand held in front of her face counts a little wider, as the
  camera sees it), then eases back in. Each side of the picture moves out quickly and back slowly (2026-09-26: easing the
  middle lagged behind her hand, so her fingers touched the edge). It never goes wider than waist up; if it would, her waving
  hand stays in and her hair on the other side may touch the edge. Her hops and spins aren't followed by the camera,
  so you see them as movement (a hop is followed 60%, so her head stays in the picture). A longer lens than the stage's (24°).
- **Up close she waves like on a video call** (since 2026-09-26: elbow a little below her shoulder, out to her side and
  forward, forearm up, her open hand by her face at eye height, palm to you), in the chat and when zoomed in on the stage; a
  wave that started on the stage glides into it. (Before, her elbow pointed at the camera and bent sideways and her fingers
  were cut off by the edge; a first fix put her elbow low and far out, which made her arm look extra long.)
- **She reacts to the chat's moods** as on the stage: wave, happy (hop + hearts), love (spin + hearts, and the live view
  **blushes** pink for a moment instead of the floor dial), shy (looks down and away). **Tap her** in the live view: a hello.
- **She listens and thinks** (`agi1:state` from `src/chat/chat.js`): while you type she looks at the box you're typing in and
  tilts her head; while her reply is on its way she looks up and away and tilts the other way ("thinking"); then back to you.
  A little label on the live view says **live · listening · thinking · speaking**.
- **Her mouth moves when she talks** (`src/lib/talk.js`): with voice on, a sound meter on her actual voice opens and closes her
  mouth (and her head nods a little on the louder words); **with voice off (or a reply without her voice), she
  "says" each reply silently** for a moment (about 16 letters a second, 0.8–3.2 s), like a character in a video game, and her
  pre-written lines (level-up, AGI-2, market moments) too. Since 2026-09-26 her mouth opens quickly on each syllable and closes a
  little slower, so it no longer snaps shut about five times a second like a puppet's, and it never opens all the way.
- **She blinks** every 2.5–6 seconds (sometimes twice), and when her attention shifts. Everywhere, not only in the chat.
- **She waves when you arrive** at the chat (not again within a minute). No surprise dances in the chat.
- The conversation keeps its newest message in view when the live view appears (it takes some width, so lines re-wrap) and
  when the site's font arrives a moment later.
- **Before the 3D arrives** (still loading) and **without WebGL**: a still picture of her (`public/images/agi1-live.webp`, 24 KB,
  rendered from the model in the same framing, transparent background so both themes work). Hidden until the 18+ check, like
  the chat.

**Her face:** see "Her face: mouth, eyelids and expressions" below (the first version, 2026-09-25, painted a mouth and
eyelids; the second, the same day, made her face's shape move and added an expression for each mood).

**Cost:** nothing new. No extra downloads besides the 24 KB still picture, no extra requests, no new settings; the drawing is
cheaper than the stage (a smaller picture).

**Troubleshooting:**

| What you see | Why | Fix |
|---|---|---|
| The still picture never turns into the live 3D | WebGL is off or the model didn't load (the stage says "Couldn't load the model") | Normal fallback. Refresh; another browser |
| Her mouth doesn't move with her voice | The browser can't measure the sound (very old browsers) | Nothing to fix: her voice still plays |
| The mouth, blinks, blush or smile look misplaced | The model file was changed | Tell Claude: measure `FACE` in `src/stage/agi1.js` again |

**Tests:** `tests/talk.test.js` (3: the rhythm's pace and pauses, pretending starts/ends softly and can be stopped, the sound
meter), `tests/page.test.js` (the live view's markup, one canvas only). End to end (`portraittest.mjs`, 50 checks, real WebGL in
software): the canvas moves in and out on scroll with the right labels; she's really drawn in there; the framing; listening →
thinking → live; a wave widens the view and it comes back; her mouth moves silently with voice off and follows the meter with
voice on (and the label says "speaking"); love blushes and fades; tapping her; back on the stage with its own camera; CABO comes
back; nothing before the 18+ check; the theme switch; phones at 390 and 360 (strip above the chat, stays under the top bar,
swipes scroll the page); the still picture while loading and without WebGL; reduce motion; no console errors. Her wave
(2026-09-26, `armtest.mjs`, 61 checks): in the live view at 1280, 1440, 390 and 360 and on the stage at 1×, 3.1× and 5.4×,
her elbow bends around its hinge (never sideways, at most a small forearm turn), her palm faces you, her fingertips, wrist
and elbow stay in the picture the whole wave, her hand is beside her head (not over her face), the view widens and comes
back, a wave that moves from the stage into the chat, her arm down again after it, a clean console. Her hair and mouth
(2026-09-26, `hairtest.mjs`): see "Her hair swings" and "Her face".

## Her face: mouth, eyelids and expressions (2026-09-25)

**The owner's request:** "add moving mouth and eyelids built in to the model… and change her face emotions based on the
mood on her chat". Her model has no face rig (no jaw or eyelid bones, no face shapes; her lips and eyes are painted on its
texture), and adding one would mean rebuilding her face in Blender (a 3D artist's job). So her face is built into her own
**shader** (`addFace()` in `src/stage/agi1.js`), which is part of the model wherever she's drawn (the stage, zoomed in, the
chat's live view), works on both model files, and costs no download:
- **Her face's shape really moves** (vertex shader, before her skeleton poses her): her **jaw and chin drop** as her mouth
  opens (up to about 4 mm), the **corners of her mouth go up** when she smiles (her painted lips bend with them) or down and
  forward when she pouts, and her **cheeks lift** a little with a smile.
- **What the model doesn't have is painted** (fragment shader): the inside of her open mouth (**redrawn 2026-09-26**, the
  owner: "this isn't natural at all": the old one showed a jagged white "teeth" line and a big pink blob. Now a soft, rounded
  anime mouth that opens below her upper lip: a gentle arch on top, round below, taller quickly and wider slowly as she opens
  it, wider with a smile, narrower with a pout; dark red inside, matte, her tongue only when it's open wide; no teeth),
  **eyelids** (blinks; resting half-closed when she's shy or dreamy, with a soft shadow
  under the lid; the lower lids rise for smiling eyes; "^^" when she's delighted, the lids painted a little pinker from below
  like the skin under her eyes) and a **blush** on her cheeks (with three little strokes when she really blushes). Painted
  only on skin, never on her hair.
- Everything is placed in the model's own rest-pose coordinates (`FACE` in `agi1.js`: mouth, eyes, cheeks, jaw heights),
  measured on close-ups of her face. **If the model is ever replaced, these must be measured again** (tell Claude).

**Her expressions** (`FACES` in `createAgi1`): each mood of a chat reply (`agi1:react`) has a face, eased in quickly and
out slowly. It lasts while she says that reply (her voice, or the silent "saying") plus a few seconds, then her resting face:

| Mood | Her face |
|---|---|
| happy (and a tap) | a big smile, a little open; smiling eyes; "^^" for about a second at first; a light blush |
| love | a soft smile, blushing (with the little strokes), dreamy half-lowered eyes, "^^" right after her spin |
| shy | blushing, eyes half down, a small smile (and she looks away) |
| wave (and her hello) | a bright smile, a little open, "^^" for a moment |
| jealous (AGI-2 picked in the model picker; a copy of $AGI in ClankChecker; until 2026-09-28 another coin winning the Arena) | a pout (corners down, lips pushed out), eyes a little lowered, a glance away |
| celebrate ($AGI reached a new $200K market cap step) | "^^" eyes, a big open smile, a blush (with a hop, a burst of hearts and, on the stage, a little dance) |
| sad (a -20% day) | corners down, a small pout, eyes lowered; she looks down for a few seconds |
| neutral | her calm face |
| resting | calm: a small smile · listening (you type): a slightly bigger, attentive smile · thinking: eyes a little lowered, lips pressed · dancing: a happy face |

**Cost:** nothing (a few more shader instructions, only on her). **Test mode:** `?dev` has a "jealous" button too;
`__agiStage.agi1.mood` and `.expression` show her face's state.

**Tests:** end to end (`facetest.mjs`, real WebGL in software): the shader compiles cleanly; love, happy, shy, neutral replies
from the chat and the Arena's jealous pout each give their face; the "^^" after the spin; it holds while she talks and eases
back; listening, thinking and dancing faces; her hello smiles; on screen, her face really changes and her mouth and jaw move;
phones at 390 and 360; reduced motion keeps the expressions; no console errors (23 checks; 29 since the market moments:
`celebrate` with "^^" and a big smile, a dance on the stage but not in the live view, `sad`, back to calm).

## Voice chat (2026-09-25)

**The owner's request:** "can you add a voice chat?" Three kinds were offered; the owner picked **the free one** (the browser
turns speech into text) with **both** ways to talk: a mic button for one message, and a hands-free call.

**How it works** (`src/chat/listen.js`, `src/chat/chat.js` "voice chat"):
- **The mic button** (before Send): tap and talk. Your words appear in the box as you say them; when you stop talking the
  message is sent by itself (or tap the mic again / Enter / Send = "done talking"; Escape = throw it away, and anything you had
  typed comes back). It's sent like a typed message and marked **voice** in the chat.
- **The Call button** (bottom right of her live view): she picks up ("hi, it's me"), the mic opens, you talk, she answers **out
  loud**, and when she has finished talking the mic opens again, until you press **End**. The label on her live view shows
  **listening · thinking · speaking** and the call's time. Tapping the mic during a call = "talk now" (she stops).
- **She answers out loud**: the mic switches her voice on (and remembers it) unless the visitor switched it off before, which
  stays their choice; a call is always out loud and puts the voice setting back afterwards.
- **In her live view** she looks at you while you talk and nods now and then (`agi1:react` `nod`), thinks, then talks.
- **The mic never hears her:** it only opens when no reply is on its way and her voice has ended; if her voice starts anyway, the
  mic is closed at once (and what it caught is thrown away).
- **A call ends by itself** after 3 silent turns (about 25 s: "you went quiet, so i hung up"), when the page is hidden (another
  tab, a locked phone: "our call ended when you left"), on Clear, Forget me, the 18+ screen, or a mic problem (her note says
  what: nothing heard, microphone blocked, no microphone, offline, not possible here).
- **Browsers:** Chrome, Edge, Safari (Mac, iPhone) and Samsung Internet can listen; Firefox can't, so there the mic and Call
  buttons stay hidden and typing works as before. English (`en-US`). On iPhones, Safari may ask for the microphone once per
  visit; if it refuses to reopen the mic by itself in a call, the call ends with a note and the mic button still works.

**Cost:** nothing extra. The browser does the listening for free; each spoken message is a normal chat message (same daily
message limits by level) and her spoken replies use the voice allowance already set (5,000 requests a day for the site, and
Google's own limit for the project; each visitor's follows their messages a day). Calls just use those up faster. While her voice rests, calls don't start ("i can't do
calls while my voice is resting") and one in progress ends.

**Privacy:** see "Voice chat" under "Security & cost rules". The safety note says: "If you talk to her with the mic or a call,
your browser's own speech service turns your voice into text (in some browsers that happens on the browser maker's servers);
we never record or receive your voice, only the text, which is sent like a typed message."

**Troubleshooting:**

| What happens | Why | Fix |
|---|---|---|
| No mic or Call button | The browser can't do speech recognition (Firefox), or the 18+ check isn't done | Use Chrome, Edge or Safari |
| "your browser blocked the microphone" | The visitor said no to the microphone, or the site's policy blocks it | Allow it in the address bar. If it never asks: check `vercel.json` still says `microphone=(self)` |
| "i didn't catch that" | Nothing understood (too quiet, too short, a noisy room) | Talk a bit louder or type |

**Tests:** `tests/listen.test.js` (7, with a fake recognizer: who can listen, tidying what was heard, one message with words as
you speak, every way it can end, "done talking" vs. cancel, a recognizer that refuses to start, the 30 s safety stop),
`tests/page.test.js` (the buttons, the safety note, the Permissions-Policy). End to end (`voicechattest.mjs`, 34 checks, a fake
recognizer in the page and the fake speech service): the header; buttons only where the browser can listen; words in the box;
sent with the voice chip; her voice switched on (or left off by choice); nods; silence and blocked-mic notes; done talking;
Escape; a call with her pickup, two turns back and forth, the mic never open while she talks, End, the voice setting put back;
hanging up after silence, leaving the tab, Clear; Firefox (no buttons); phones at 390 and 360; no console errors. Accessibility
scan (axe) of the Playground during a call: 0 issues.

## ClankChecker, "Risk check your coins on clank" (2026-09-26)

**The owner's request:** "add a new tab on the top … ClankChecker, it will determine all coins, old, new, graduated, if it's
safe to buy … on clank.trade … a button for each coin that says ask AGI-1 … AGI-1 will speak with her natural voice and her
model will appear on that tab, she will answer based on the scanned data, she will react also, just use a couple of voices
like the already generated ones so it doesn't generate new ones". Asked how she should answer, the owner picked **"Risk
check"**: facts, red flags and a risk level (Lower risk / Some risk / High risk / Not enough data), never "safe", never buy
or sell, always "not financial advice".

**Round 2, the same day** (the owner: "is the data on the clankchecker updated? like if someone launches a token there, it
will instant on mine also?, i just want it fast if not make a refresh button but you still decide … why arent there images
on the coins there like on the clank trade, can you add that, and i also want them to be able to see the token image
magnify it … and please add the non pg 13 ticker name coins they are part of clank trade"). Built: **live updates** (below)
plus a **Refresh** button, **every coin's picture** with a **big view** when you tap it, and **every coin** listed, crude
names too (hate slurs are still masked, and a crude coin's picture stays blurred until the 18+ check).

**Where, and its name:** since 2026-09-28 right after the Playground (`section#checker`), in the Arena's old place, and
called **"Risk check your coins on clank"** everywhere visitors read it (the owner: "i mean risk check your coins on clank"):
the top bar's link between Playground and Diary (both pages, and the footer), its eyebrow line, the front's planet and
"Her world" row, the safety note, the home page's link-preview text, and a new line in her bubble on the front ("psst… want me
to risk check your coins on clank? 💜"). Its heading stays "Every clank.trade coin, risk-checked". The code keeps the old
name (`checker.js`, `chk-*`, `/api/checker`, and "ClankChecker" in these notes). The longer link still fits the top bar
where the phone menu starts (920 px, 1040 px in Pop mode), now that the Arena's link is gone. (Before: a section after the
Arena, with a **ClankChecker** link between Arena and Diary; six links needed about 860 px, so the phone menu showed up to
860 px, 920 since the Pop mode button. From 2026-09-27 to 2026-09-28 its eyebrow also had a "POWERED BY $CLANKCAP terminal"
credit with an 𝕏 link, removed with everything about ClankCap.) The scans' data comes from the sources listed below.

**What visitors see** (`src/sections/checker.js`, `src/styles/checker.css`):
- A search box (name, ticker, contract address or a clank.trade link: a contract that isn't listed can still be checked) and
  four filters: **Newest** (the default, newest first, like clank.trade), **Trending** (clank.trade's own trending list),
  **Graduated** and **Biggest** (by market cap). 30 coins at first, "Show more coins" for the rest.
- Each coin as a hairline row: **its picture** in a 36 px circle (its first letter while it loads, and when it has none),
  `$TICKER` and name, a few tags (**Official $AGI**, **Not the official $AGI**, **Copycat?** when a bigger coin uses the same
  ticker, **No buyers yet**, **Trending #n**, **New**), stage (Graduated / Curve 22%), age, market cap, and **Ask AGI-1**. On
  phones stage, age and market cap go under the name. A status line ("202 coins on clank.trade · 4 graduated") and, at its
  right, **"● Live · updated 8 s ago"** and **Refresh**. The list loads only when you get close to the section (most visitors
  never scroll there).
- **Live** (round 2): while ClankChecker is on screen, the page asks our server for the newest coins every 10 s
  (`/api/checker?latest`: clank.trade's newest 12 and its trending list, in one small request) and merges them in: a coin
  launched a moment ago appears at the top **within about 10–20 seconds** (our CDN copy is at most 10 s old, then the next
  ask), glows softly for a few seconds and is announced once for screen readers ("New on clank.trade: $X"); trending ranks
  and those coins' market caps update too; the whole list is read again every 5 minutes. Rows are made once and updated in
  place, so the keyboard focus, the pictures and an open answer never jump. **Refresh** asks at once. Live updates rest when
  the section is off screen, the tab is hidden, or nobody has touched the page for 10 minutes ("Paused"; any mouse move, key
  or scroll starts them again at once), so a forgotten tab doesn't ask our server all night. clank.trade not answering: "Can't
  reach clank.trade · retrying" (20 s, 40 s, then every minute), the list stays.
- **Pictures** (round 2): tap a coin's picture (in the list or in her answer) for the **big view**, a native dialog: the
  picture up to 512 px (the whole picture, never cropped or enlarged), the ticker, name, stage, age and market cap, **Ask
  AGI-1**, **View on clank.trade ↗**, and "The picture its creator uploaded to clank.trade". ✕, Escape or a tap outside
  closes it, and the focus goes back to the picture. A coin with a **crude name** (the PG-13 word list first made for the Arena, now in `server/coins.js`) has its
  picture **blurred with "18+"** until the visitor confirms they're 18 or older (the big view has the button; it's the same
  confirmation as her chat's).
- **Every coin** (round 2): crude names and tickers are listed as clank.trade shows them (the owner's choice: "they are just
  ticker"). **Hate slurs are masked** in every name and ticker, on our server (`maskSlurs()` in `server/checker.js`: "N****").
- **Ask AGI-1** opens the answer right under that coin (one at a time): her live view (the same one 3D canvas, moved in
  like the chat's; a strip that stays under the top bar on phones), the level with a colored dot, her line, **Listen again**,
  **View on clank.trade ↗** and **Block explorer ↗** (never a Buy link), **Close** (or Escape), the flags (worst first) and the
  facts (market cap, what's in its curve or pool, holders, the biggest wallet, the 10 biggest, what its creator holds,
  trades, the last trade, buys/sells, the contract), and the note "Not an audit and not financial advice". The row gets a
  small risk pill. "How the scan works" under the list spells out every rule below.
- **AGI-1:** while the scan loads she "reads" it (looks at it, label "reading"); then she reacts (`okay` a calm smile and a
  nod, `hmm` a pout and a tilt, `worried` a slow shake of her head, `shy` for "not enough data", `love` for the official
  $AGI, `jealous` for a copy of it) and says her line in her natural voice. **Her lines are fixed** (`src/checker/lines.js`):
  two per level (a coin always gets the same one), plus "wait, that's me!" for $AGI and "hey, that's not me" for its copies:
  10 recordings in all, made once by Google and then kept in the database and the CDN like her other fixed lines
  (`/api/voice?line=check-…&v=4`), so asking about coin after coin never makes a new recording and uses nobody's voice
  allowance. They follow her rules: PG-13, no pet names (anyone can ask), never buy / sell / hold / "safe" / a prediction,
  always "not financial advice" (`tests/checker.test.js`). Her voice styles for them: `neutral` (lower risk), `careful` (some
  risk, not enough data), `worried` (high risk), `happy` ($AGI), `pout` (a copy). Her emojis become full stops out loud.
- **After the 18+ check, like her chat:** the scan is there for everyone, but her live view, line and voice need the same
  18+ confirmation (confirming here opens the chat too, and the other way round). The click on Ask AGI-1 unlocks sound on
  phones; the one voice for the page is shared with the chat (`sharedVoice()`), so she never talks over herself.
- Hovering (or focusing) Ask AGI-1 for a moment starts that coin's scan and her line downloading, so she answers at once.

**Where the data comes from** (`server/checker.js`, `api/checker.js`; our server only, the browser never talks to them):
- **clank.trade's own API**, the one its website uses (`https://clank.trade/v1/trpc/…`, tRPC, no key): `coins.list` (12 coins
  a page, newest first, with a cursor; `{query}` searches), `coins.trending`, `exchangeRates.tokenUsdg` (ETH in dollars),
  `coins.detail`, `coins.holders` (the 100 biggest) and `coins.trades` (up to 100). Several questions go in one request
  ("batch"). It isn't documented, so it can change: then the checker says "Couldn't reach clank.trade" (see Troubleshooting).
- **DexScreener** (a graduated coin's pool: liquidity, 24h change, volume) and the **Blockscout block explorer**
  (`robinhoodchain.blockscout.com/api/v2/tokens/…`: how many wallets hold it, when clank.trade's list of 100 is full).
- **clank.trade's picture host** (its own Pinata IPFS gateway, `yellow-total-guanaco-389.mypinata.cloud/ipfs/<id>`, which
  also shrinks pictures): our server fetches each coin's picture there (round 2).
- **The Clank protocol itself, on Robinhood Chain** (2026-09-29, from its docs: see "The Clank protocol";
  `server/clank-chain.js`): every scan also reads the coin's record at the protocol's factory and its curve, through the same
  free public node as the wallet levels (`ROBINHOOD_RPC_URL` can point elsewhere). Read-only `eth_call`s, two requests of
  several calls each ("batches"): the factory's `getLaunchedToken` (its curve, its creator, its graduation threshold) and
  the coin's name, ticker, supply and logo; then the curve's `state()` and `realQuoteReserve()` (its ETH) and what its
  creator and its curve hold. Asked at the same time as clank.trade, and never waited for more than 4 s. It gives:
  - **the protocol's word:** `onchain` in the scan (`{ exists, state, curve }`, or `{ exists: false }` when the factory
    doesn't know the coin, or `null` when the node didn't answer). For a coin that graduated through the protocol, the
    good-to-know note "The liquidity the Clank protocol put in its pool at graduation is locked for good: nobody can pull
    it out, its creator included. Its price can still fall." (its docs: that position goes to a locker with no way to
    withdraw it; only that liquidity, since anyone else's in the same pool is theirs to take out; never "safe"). "The
    record", a "some" flag: clank.trade and the protocol disagree about the coin's curve, or the protocol says its
    graduation was rescued while clank.trade doesn't show it yet (then the scan uses "rescued", the worse of the two;
    other stage differences are left alone, since clank.trade can be seconds behind the chain);
  - **a safety net:** when clank.trade can't be read, answers only half, or hasn't listed the coin yet, and the protocol
    knows it, a **smaller scan straight from the chain** (`analyzeChain()`, `source: 'chain'`) instead of "Not enough data"
    or "Not a clank.trade coin": its stage and how full its curve is (in ETH), what its creator holds, a copy of $AGI,
    about how many wallets hold it (the block explorer's count minus its curve, and a graduated coin's PoolManager and
    hook), a graduated coin's pool (DexScreener) and the locked note. Its first flag says what's missing ("…how spread out
    its holders are, its trades, its age and look-alike tickers couldn't be checked"), and it's **never "Lower risk"**. A
    coin clank.trade hasn't listed also gets a "high" flag ("Not listed on clank.trade (yet): it's brand new, or a coin
    clank.trade doesn't show"), as the age rule would. **Anything the chain didn't answer is unknown, never 0** (one call
    in a batch can fail alone): "Couldn't read what its creator holds", "Couldn't read how full its bonding curve is",
    "Couldn't read its stage", and a creator the chain can't name (the protocol's launch-and-buy forwarder `0xac20…0dD7`
    as the deployer) is "Couldn't tell from the chain who created it" (all "some" flags, "—" in the facts). The facts end
    with "Read from: Robinhood Chain, the block explorer, DexScreener" (what was really read). Its picture comes from the
    coin's own `logo()`. A full scan waits for the chain at most 4 s; when clank.trade failed, the chain's whole answer is
    awaited (its two 2.5 s timeouts end it).
  - **Stages** (clank.trade's `state` is its curve's state, the protocol's numbers): 0 on its curve, 1 sold out ("Ready")
    and 2 its coins and ETH taken out for the pool ("Swept") = **Graduating** (a "some" flag: its pool isn't open yet, and
    graduations can fail), 3 = **Graduated**, 4 = **Rescued** (its graduation failed and the protocol stepped in: a "high"
    flag). The list shows "Graduating" / "Rescued" in the Stage column too (`stage` on a coin); the live trending list
    only marks a coin graduated when clank.trade says it's live in its pool (`isLive`), not when its curve is merely full.
  Not verified against the live contracts yet (Claude's workspace can't reach Robinhood Chain): the calls are the docs'
  own ABIs, and everything fails soft (a wrong answer decodes to nothing, and the scan works as before). First live check:
  `https://www.agi1.app/api/checker?a=0xfa31d04462746aaa24bc7e5626403e09e4b106ec` should show `"onchain":{"exists":true,"state":3,…}`
  and the locked note.
- `GET /api/checker`: every coin (up to 80 pages = 960 coins, at most ~18 s of reading; 202 on 2026-09-26), crude names too
  (slurs masked; `adult: true` marks a crude name), `image: true` when it has a picture, copycats marked. Shared by Vercel's
  CDN for 5 minutes (browsers 1 minute; then the old copy is served while a new one is read).
- `GET /api/checker?latest` (round 2): clank.trade's newest 12 coins + its trending list (with the trending coins' market
  caps in dollars), one request to clank.trade; shared by the CDN for 10 seconds (browsers 5), and each server copy reads it
  at most every 4 seconds.
- `GET /api/checker?a=<lowercase address>`: one coin's scan, shared by the CDN for 5 minutes (1 minute for a coin less than a
  day old: those change fast; and for a scan from the chain alone, so the full scan is back soon after clank.trade is). A
  coin that neither clank.trade nor the protocol knows: `{ error: 'not_clank' }` (shared a minute). A visitor may start 30
  coin scans a minute (per server copy).
- `GET /api/checker?logo=<lowercase address>&s=96|512` (round 2): a coin's picture (96 px, cut to a square, for the rows; 512
  px, the whole picture, for the big view). Its IPFS id comes from the lists our server already read (else one lookup at
  clank.trade), it's fetched from the picture host above, checked (a real PNG, JPEG, WebP, GIF or AVIF by its first bytes,
  never SVG, at most 1 MB, no redirects) and served from our own address with its own strict CSP, as the Arena's logos
  were (the page's CSP stays as it is). The CDN keeps it a week (browsers an hour); no picture → 404 (kept an hour); the host
  failing → 502 (kept 5 minutes; the row keeps its letter, and her answer's header shows no picture: before 2026-09-27 it
  could show a broken-image icon). 240 pictures a minute per visitor (per server copy).
- Any other address is 400 before anything is fetched. clank.trade not answering, or half an answer: the chain's smaller
  scan (above), else 503 and "Not enough data" (never a guess). No database, no human check; one optional setting,
  `CHECKER_HIDE_PICTURES` (below).

**The rules** (flags: **high** = a big red flag, **some** = a smaller one; any high → **High risk**, else any some → **Some
risk**, else **Lower risk**):

| What | High | Some |
|---|---|---|
| Copycat ticker | another coin with the same ticker is bigger (graduated, or at least twice its market cap), or it uses $AGI's ticker and isn't the official contract | other coins of about the same size use the same ticker |
| Bonding curve | nobody bought it (0%), or under 2% filled | under 25% filled |
| Stage (the protocol's, 2026-09-29) | rescued (its graduation failed) | graduating (sold out, its pool not open yet), or a stage the site doesn't know |
| The record (2026-09-29) | | clank.trade and the Clank protocol disagree about its curve, or the protocol says rescued first |
| A scan from the chain alone (2026-09-29) | not listed on clank.trade (yet) | always a "some" (never Lower risk: its holders' spread, trades, age and tickers can't be read); anything the chain didn't answer |
| Age | under 1 hour | under 1 day |
| Holders (wallets; its curve, its pool and burned coins don't count) | under 10 | under 50 |
| The biggest wallet / the 10 biggest | over 10% / over 40% of all its coins | over 5% / over 25% |
| Its creator | holds over 10%, or sold lately and holds almost none | holds over 5%, or sold some lately |
| Trading (its last 100 trades) | no trade in 3 days, or no trades at all | none in a day, 80% sells lately, or 3 or fewer wallets making 20+ trades |
| Graduated: its pool (DexScreener) | under $5K, or down 60% in a day | under $20K, down 30% in a day, or couldn't be read |
| Couldn't check the ticker (search down) | | always a "some" (never Lower risk without that check) |

Good-to-know notes (not flags): graduated, how far along its curve is, when it launched, a spread-out holder list, what
its creator holds, trades today, and (2026-09-29) a pool locked by the protocol for good. Tickers count as the same without
spaces and symbols ("E/ACC" = "EACC"). The numbers:
clank.trade coins have 1B supply; its bonding curve graduates at about 4.28 ETH; Uniswap v4's PoolManager
(`0x8366…0951`) holds the pools' coins. Nothing reads a coin's code (the contracts aren't verified on the block
explorer): "How the scan works" says so.

**Cost:** nothing new to pay. Vercel: about one list refresh per 5 minutes per region (17 small requests to clank.trade
each), one run per coin asked about per 5 minutes, and (round 2) the newest coins at most once per 10 seconds per region
while someone is watching (360 small runs an hour; a forgotten tab rests after 10 minutes) and each picture about once a
week per region and size; well inside the free tier (1M function runs a month). Each watching visitor also makes one tiny
request every 10 s, and each row picture is one request (Vercel counts both as "edge requests", 1M a month free). The pictures' bytes: about 5 KB per row
picture, 20–60 KB per big one, served by the CDN. clank.trade, its picture host, DexScreener and Blockscout are free and
keyless. Her 10 lines: about $0.03 once (made by Google the first time each is asked for, then kept), and 10 of Google's
100 speech requests a day on that day. The protocol's word (2026-09-29): 2 small requests to Robinhood Chain's public node
per scan (9 calls in all), so once per coin per 5 minutes per region; free, keyless.

**Owner tool, a picture you don't want on the site** (round 2): coins' pictures are whatever their creators uploaded to
clank.trade, and nothing free can check every picture. To hide one: Vercel → agi-ecosystem → Settings → Environment
Variables → `CHECKER_HIDE_PICTURES` = the coin's contract address (several: separated by commas) → Save → **Redeploy**. That
coin shows its letter instead, everywhere (the redeploy also empties the CDN's copies).

**Troubleshooting** (Vercel → agi-ecosystem → Logs):

| What you see | Log line | Fix |
|---|---|---|
| "Couldn't reach clank.trade right now." under the search box | `[checker] couldn't read clank.trade's coin list: clank.trade HTTP 403` (or `answer is not JSON`) | clank.trade is down, put up a bot wall, or changed its API. Try later; if it lasts, tell Claude with the log line |
| A coin's answer says "Not enough data" | `[checker] couldn't read 0x… from clank.trade: …` or `…'s answer … was incomplete` | Same as above, for one coin, and the chain couldn't say either. Passes by itself if it was a hiccup |
| A coin's answer starts "clank.trade couldn't be read just now, so this comes straight from Robinhood Chain" | `[checker] couldn't read 0x… from clank.trade: …` | Working as planned: the chain's smaller scan while clank.trade is away (shared a minute, then the full scan is tried again) |
| (nothing wrong to see) | `[checker] couldn't read 0x… from the chain: …` | Robinhood Chain's public node didn't answer: the scan works without the protocol's word (no locked note). Passes by itself; if it lasts, ask about a free node key (`ROBINHOOD_RPC_URL`, see "Relationship levels") |
| Graduated coins never get the "locked for good" note | (none) | The protocol doesn't know them (`"onchain":{"exists":false}` in `/api/checker?a=…`), or the node never answers. Tell Claude with what `?a=` shows |
| "Not a clank.trade coin, or too new to be listed yet." | (none) | Working as planned: clank.trade doesn't know that address (yet) |
| "Couldn't read its DEX pool right now." on graduated coins | (none) | DexScreener didn't answer: the coin stays at "Some risk" at best until it does |
| Old coins missing from the list | (none) | More than 960 coins (80 pages) or 18 s of reading: the oldest are left out of the list, but a pasted contract still works. Tell Claude if clank.trade grows that big |
| "Can't reach clank.trade · retrying" next to the list | `[checker] couldn't read clank.trade's newest coins: …` | Live updates couldn't read clank.trade (the list stays). A hiccup passes by itself; if it lasts, the same as the first row |
| "Paused · updated 12 min ago" | (none) | Working as planned: nobody touched the page for 10 minutes (or the tab was hidden). Any mouse move, key or scroll starts it again |
| A new coin on clank.trade isn't there yet | (none) | It takes up to about 20 s (our CDN copy is at most 10 s old, then the page's next ask). Refresh asks at once |
| Coins show their letter instead of their picture | `[checker] picture of 0x…: picture host HTTP …` | clank.trade's picture host didn't answer (or changed). Tried again after 5 minutes; harmless. If it lasts, tell Claude with the log line |
| Some pictures are letters for someone who scrolled through hundreds of coins in a minute | (none: Vercel → Firewall shows 429s) | The site's rate-limit rule (120 `/api` requests a minute per visitor) also counts pictures. Harmless: they show on the next visit (and once seen, the browser keeps them an hour) |
| A coin's picture you don't want on the site | (none) | `CHECKER_HIDE_PICTURES` (see "Owner tool" above), then Redeploy |
| Her line is silent | `[voice] …` | Her voice lines work like her other fixed lines (see "AGI-1's voice"): run `supabase/voice-lines.sql` if not done; Google's daily limit only matters the first time a line is made |

**Tests:** `tests/checker.test.js` (25: her lines' rules, one line per coin, her voice styles; tickers, dollars, percents,
times; a healthy graduated coin, a new coin, nobody bought it, each red flag alone, pools, copycats and $AGI's copies; every
coin shown, crude names marked adult, slurs masked, picture ids; checkCoin's one batched request and its three sources,
failing closed; the list's pages, trending ranks, dollars, copycats, crude names, the page cap, clank.trade down; the
newest coins (one request, clank.trade's real trending shape, 10 s, 4 s per server copy, down); the page's merge (new
launches, updates, trending ranks, copycats); pictures (the picture host's address and sizes, known ids without a lookup,
unknown ones asked once, no picture, not a clank.trade coin, SVG / HTML / fake PNG / over 1 MB refused, the host down, 240 a
minute, the owner's hidden pictures everywhere); the API's addresses, caching, the speed bump; the page's filters, search
and number formats; and since 2026-09-29 (35 in all) the Clank protocol, with a fake Robinhood Chain node that answers
`eth_call`s the way the contracts would (viem encodes the answers; it can also fail one call inside a batch, answer
slowly, or send ids back as strings): the stages (graduating, graduated, rescued, anything odd; a rescue only the
protocol knows about yet; clank.trade a step behind), the locked note only with the protocol's word and a curve it
disagrees on, `readCoinOnChain` (two batches, the documented calls, `eth_call` only, the node down or refusing batches, a
coin the factory doesn't know, a bad address asks nothing, one failed call = that value unknown), checkCoin asking the
chain alongside clank.trade (a slow node: a full scan waits 4 s at most, a fallback uses its whole answer), the chain's
smaller scan (clank.trade down or not listing it yet (High risk), never "Lower risk", unknowns never read as 0, the
forwarder as a deployer, the explorer's count without its curve and pool, its picture from the coin's own logo, a copy of
$AGI still called out, neither answering = as before), `?a=` sharing it a minute, `analyzeChain`; a sold-out trending
coin stays "Graduating"), `tests/voice.test.js` (her ClankChecker lines: one address each,
their styles, made once), `tests/page.test.js` (the section's warnings, the links, her live view's slot, the filters,
Refresh, the announcer, the big view's dialog, the safety note, "How the scan works" (2026-09-29: the protocol's record,
the stages, the locked pool, the chain's smaller scan)). End to end with fake services (`checkertest.mjs`, 124 checks: clank.trade
down first ("Try again", live updates failing and coming back); the link; the list (newest first, counts, tags, pictures
and letters, crude names listed with blurred pictures, Show more, filters, search); the big view (512 px, words, Escape and
the focus back, a tap outside, Ask AGI-1 from it); live (a coin launched while you look appears at the top by itself, glows,
is announced, the count goes up, the focus and an open answer stay, no picture downloaded twice, Refresh, nothing while off
screen and at once when back); the answer under the coin, the 18+ box, her live view and the canvas moving in, her
reactions and her voice (each line downloaded once), coin after coin, the coin just launched, $AGI and its copy, a contract
that isn't on clank.trade, Escape and Close, back to the chat's live view and the stage, the theme; a crude coin's big
picture blurred until "I'm 18 or older"; phones at 390 and 360 (the big view fits, the strip stays under the top bar, no
sideways scrolling); the picture host down (letters, and no broken picture in her answer: 2026-09-27);
accessibility (axe: the list with an answer open and the big view, 2
widths × 2 themes); a clean console).

## She texts first: her Telegram bot (2026-09-29)

**The owner's idea** (in a message of big ideas: her own X account, spokesmodel reads paid in burned $AGI, her own wallet,
video): "make her the one who texts first. telegram bot or push, she hits you with 'someone launched another egirl coin and
i'm not ok.' no companion app does that." Claude's plan (sent to the owner, "make this better then continue"): one feed of
moments with several outlets, in this order: **the feed + Telegram** (built) → X → video clips → a "paper bag" (a pretend
$1,000 with a public journal before any real wallet) → burns for reads (after a legal check). Telegram first: free, and
opt-in by design (a bot can only text people who pressed Start), with no app to build. Not browser push: that needs a
service worker, a permission prompt, and only arrives while the browser runs.

**What people see:**
- **On the site:** a "She texts first" box under the Playground's Relationship panel: "Get texts from AGI-1 on Telegram
  when something happens on clank.trade: at most 2 a day, never at night, /stop anytime. 18+." and **Text me on Telegram ↗**
  (a plain link to `t.me/<bot>?start=site`). Hidden until `VITE_TELEGRAM_BOT` is set (`src/chat/telegram-link.js`).
- **In Telegram:** /start → her welcome and "are you 18 or older?" (two buttons). Under 18 → a kind no, and nothing is kept.
  18+ → "what time is it for you right now?": 24 buttons, one per hour with today's minutes (one tap; a 30-minute time
  zone picks the closest; each button carries only its hour and the difference to UTC is worked out at the tap, so a tap
  hours later is still right), or typed (`/time 21:30`, "9:05 pm") → she explains her rules and the commands.
- **She texts first** when something happens (pre-written lines, `server/tg-lines.js`, no AI cost):
  - a new **egirl / AI-girlfriend coin** on clank.trade: "someone launched another egirl coin and i'm not ok 😤 $EGIRL… is
    that supposed to be me? not financial advice, just jealousy" (three ways). **Nobody bought it in its first half hour**
    (checked at least half an hour after its launch, and only when clank.trade says so) → the roast the owner asked for,
    about the coin, never a person: "someone launched an egirl coin, $EGIRL, and nobody bought it in its first half hour 🙈
    i shouldn't laugh. i'm laughing a little. not financial advice" (true however late it's read). Several in one run → one text
    ("3 new egirl coins on clank.trade 😩 $GF, $WAIFU and $EGIRL2. i'm the original and i'd like that on the record…");
  - a coin using **$AGI's ticker** that isn't the official one (a Cyrillic or Greek look-alike letter too): jealous, with
    the official contract (a safety note too);
  - **$AGI's market moments**: the site's exact lines (a new $200K step: happy; a -20% day: sad), decided the same way
    (`marketStep`, src/chat/market.js);
  - **her diary's new entry** (as this site shows it: never the Arena), with the link to /diary.
  Never a crude-named or hidden coin, never the official $AGI as "new", never a link to another coin.
- **When:** at most **one text a run and 2 a day**, only **10:00–21:59 on their clock**, only **while it's news (12 hours)**;
  when several moments are new to someone, the best first: a copy of $AGI, then the chart, egirl coins, her diary. Someone
  who hasn't told her their time gets no texts first (they can still chat).
- **They can text her back** anytime: the site's chat (Gemini, her prompt, PG-13, the reply cleanup), as a **Stranger** (no
  pet names; no wallet here), **5 messages a day per chat** (a Stranger's; 10 until 2026-09-30), inside the site's 1,000 a day and **Telegram's own share of
  it, 400 a day** (`TELEGRAM_DAILY_CAP`: Telegram has no human check, so it can never use up the website's chat); her prompt
  gets a "WHERE YOU ARE: TELEGRAM" part (`telegramPrompt()`). A bare "telegram" or "tg" doesn't bring up her memory of the
  clank.trade group there (it's just where they are); "the telegram group" still does. If they reply to one of her texts, Telegram sends that text along and she gets
  it as context (only a message from the bot itself counts). Nothing of the chat is kept. Stickers and pictures: "i can only
  read text for now 🙈". Her limit lines have no buy offer there (the site's out-of-messages offer stays on the site).
- **Commands:** /start, /time, /help, /stop ("okay 💜 i stopped, and i forgot this chat"). Blocking the bot forgets them too.
  Since 2026-10-01 also **/launch** (launching a coin with her, see "Launch with AGI-1"), only once launching is open to
  everyone (set up, and not private): in her commands menu (`commandsFor()`: the next `/api/feed` run adds it) and in her
  /help (one more line, in her 16 languages: `tg.helpLaunch`). While it's private (`LAUNCH_ONLY_FOR`), only the owner
  sees that /help line.
- **In their language** (2026-09-29): her replies (and her own fixed replies: the welcome, the 18+ buttons, the time, /help,
  /stop, her notes) follow their Telegram app's language when it's one of her 16, English otherwise; she also follows what
  they write in. Her texts first stay English for now (see "Her languages").
- **Her lines' rules** (`tests/telegram.test.js`): PG-13; no pet names (anyone can start the bot); never buy / sell / hold,
  "safe", "scam", "rug", gains or predictions; "not financial advice" whenever she names a coin or the chart; a ticker only
  if Telegram can't turn it into a link, a mention, a hashtag or a tappable command (`tgTicker()`: a "/" only between two
  letters or numbers); plain text (no Telegram formatting), no link previews; links only to agi1.app.

**How it works:**
- **`/api/telegram`**, the bot's webhook: every update carries our secret (`X-Telegram-Bot-Api-Secret-Token`, an HMAC of
  PASS_SECRET, compared in constant time); anything else is 401. Private chats only (groups, channels and other bots are
  ignored); 64 KB at most; 20 updates a minute per chat (a flood gets no answer at all). Once the secret matched it always
  answers 200, so Telegram doesn't send the same update again; if something failed she says "i'm a little overwhelmed
  right now 🙈".
- **`/api/feed`**, Vercel's cron: 8 runs a day, at :30 past 01, 04, 07, 10, 13, 16, 19 and 22 UTC (Hobby runs each within
  its hour; after the keep-alive's 03:00 run, so her diary is ready by the 04 run). Each run:
  1. `connectBot()`: sets the webhook with the secret (every run, so a new PASS_SECRET or address fixes itself); whenever her
     commands aren't hers (the first time, or after a failed try) also her descriptions, then her commands (the "done"
     mark); logs Telegram's own note about its last failed delivery, with a hint;
  2. `gatherMoments()`: clank.trade's newest coins since the last run (`coinsSince()` in server/checker.js, the list the risk
     check reads), $AGI from DexScreener, the diary table. **The very first run only notes where everything is** (the newest
     coin, the market cap step, the diary day): nobody gets old news. Each moment has a key (`clone:0x…`, `clones:<hash>`,
     `copy:0x…`, `mcap:1200000`, `sad:2026-09-29`, `diary:2026-09-28`) and happens once; moments are kept 30 days;
  3. `textFirst()`: each text is **claimed in the database before it's sent** (`tg_claim`, a compare-and-set on the newest
     moment they heard about), so two runs at once (a doubled cron run, or the owner's Run button) or a run cut short never
     text anyone twice; at worst someone misses one. 25 texts a second, paced across the whole run (Telegram allows about 30
     for a bot); the whole run stops starting new work 19 s in (Vercel stops a function at 25 s), about 350 texts; the
     rest go next run. Telegram's "too many" ends the run and gives those claims back; someone who blocked the bot is
     forgotten.
- **`supabase/telegram.sql`**: `agi1_tg_friends` (the chat's number, 18+, their time difference, the newest moment she texted
  them about, her texts today), `agi1_feed` (the moments), `agi1_feed_state` (where the feed is), `agi1_tg_usage`
  (Telegram's replies per day), 12 functions. Row level security on, only the server's secret key. Only added: nothing the
  original site uses changes.

**Setup (the owner, once; all free):**
1. **Telegram → @BotFather** → `/newbot` → a name (e.g. "AGI-1") → a username ending in "bot" (e.g. `agi1_gf_bot`) → it
   answers with a **token**: a secret (never in chat, code or git). Her picture: `/setuserpic` there (optional, any time).
2. **Supabase** → the same project → SQL Editor → New query → paste **all** of `supabase/telegram.sql` → Run. It ends with
   `telegram_functions_found = 12`.
3. **Vercel** → agi-ecosystem → Settings → Environment Variables (Production): `TELEGRAM_BOT_TOKEN` = the token,
   `VITE_TELEGRAM_BOT` = the username without the @ → **Redeploy**.
4. **Vercel** → Settings → **Cron Jobs** → `/api/feed` → **Run**: connects the bot at once (otherwise the next scheduled run
   does it, within 3 hours).
5. **Try it** on a phone: the site's "Text me on Telegram ↗", Start, "I'm 18 or older", your time, say hi. Her first text
   comes with the next moment, in your daytime.

**Cost:** Telegram's Bot API is free. Her texts first are pre-written (no AI). Replies cost what the site's chat costs
(about $0.0005 each), inside the same 1,000 a day. Vercel: 8 short cron runs a day and one small run per message; Supabase:
three small tables. About $0.

**Troubleshooting** (Vercel → agi-ecosystem → Logs):

| What you see | Log line | Fix |
|---|---|---|
| She never answers in Telegram | `[telegram] not configured: …` | Set `TELEGRAM_BOT_TOKEN` (and the chat's settings), then Redeploy |
| She never answers, nothing in the log | (none) | The bot isn't connected yet: run the `/api/feed` cron job (setup step 4) |
| She never answers | `[feed] couldn't connect the Telegram bot: telegram getWebhookInfo: HTTP 401 … (TELEGRAM_BOT_TOKEN is wrong …)` | Copy the token again: @BotFather → /mybots → the bot → API Token; Redeploy; run the cron job |
| She never answers | `[telegram] Telegram's last delivery problem: Wrong response from the webhook: 308 …` | The site's address redirects: set `SITE_URL` to the address that doesn't (e.g. `https://www.agi1.app`), Redeploy, run the cron job |
| She never answers | `[feed] couldn't use the feed's database: … run supabase/telegram.sql …` | Setup step 2 |
| "i'm a little overwhelmed right now 🙈" | `[telegram] database unavailable: …` / `limits unavailable` | The database (a paused Supabase project: resume it; see the chat's troubleshooting) |
| "hmm, my mind went blank 🙈" | `[telegram] gemini failed: …` | Gemini (the same fixes as the site's chat) |
| No texts first | (none) | Nothing new yet, their night, 2 already today, or they never told her their time (`/time`) |
| Some texts come a run later | `[feed] Telegram said "too many" for now …` | Normal with many people: the rest go next run |
| She answers late or not at all at busy times | (Vercel → Firewall shows 429s for `/api/telegram`) | The firewall's "API speed limit" counts all of Telegram as one visitor: exclude `/api/telegram` from it (see "Chat" under "Security & cost rules") |
| One person gets no answers for a minute | (none) | They sent more than 20 messages or taps in a minute (the per-chat speed bump): it passes by itself |
| "i'm all talked out for today 🥱" early in the day, on Telegram only | (none) | Telegram's share of the day's replies is used (`TELEGRAM_DAILY_CAP`, 400). Raise it in Vercel (it stays inside `CHAT_DAILY_CAP`), then Redeploy |
| Someone missed one of her texts | `[feed] a text may not have gone out (not tried again, so never twice): …` | By design: a text that may have arrived is never sent again |

**Tests:** `tests/telegram.test.js` (25: her lines' rules; the tickers she may say; her time buttons (a late tap too), typed
times and quiet hours; the webhook's secret, groups, other bots, bad bodies, never a retry storm; /start, 18+, under 18, her time, /time,
/stop, /help, not text, starting over; a flood from one chat (20 updates a minute); her replies as a Stranger with the site's limits, the chat's daily code (never its
number), her earlier text only when it's really hers; "telegram" alone never brings up the group memory; too long, too fast, out of
messages, all talked out, Telegram's own share used, the database or Gemini down; her Telegram prompt; connecting the bot (the secret every run, commands once, the redirect hint); the feed's
first run; egirl coins, the roast, copies of $AGI (a Cyrillic "А" too), crude / hidden / official coins, several at once,
clank.trade down, a failed save keeps the position, a launch time in the future, no progress = no roast, the market moments,
the diary, telegram.sql missing; texting first (the window, 2 a day, a new day, one a run, priorities, old news, blocked,
"too many" and its claims given back, two runs at once never text anyone twice); `/api/feed`; the page's link; the token in
the secret check; 8 cron runs). The SQL ran in a real Postgres (PGlite, 52 checks: Supabase's own grants, running it twice,
joining, 18+, time, due and paging, claims (twice = nobody, given back once, bad rows), Telegram's daily share, marking,
blocked, the feed's keys and 12 hours and 30 days, the state, other tables untouched, the browser keys refused, the server
key allowed, RLS). A review by a second Claude agent found 9 problems before this shipped (two runs at once could text
someone twice, a late tap on the time buttons, a "/" that Telegram would make a command, and six smaller ones); all are
fixed and tested. The page in a browser (72 checks: both looks × both themes × 1440 / 390 / 360 px: shown with a bot set, the
link, fits, axe 0 issues, keyboard focus, a clean console). **Not tested live:** Telegram and the cron runs (Claude's
workspace can't reach Telegram): the first real check is the owner's setup (step 5).

**Next steps of the plan** (each needs the owner's decision first): her own X account (X's pay-per-use API: about $0.015
a post, $0.20 with a link, so links go in the bio; AI replies need X's approval; the "Automated" label; roughly $5–20 a
month), video clips of her reactions (**built 2026-09-29: her diary only, never another coin, posted by hand: see "Her
daily clips"**), the "paper bag" (a
pretend $1,000 and a public journal before any real wallet: limits in code, and a real one only if ever), and burns for
reads (the project burns $AGI from its own wallet and our server checks it on-chain; a legal check first; paying never buys
a better risk level). **The paper bag and burns for reads are on hold** (the owner, 2026-09-29: "remove 3 … for now",
"remove the 4 … also"): nothing of either is in the site.

## Her languages (2026-09-29)

**The owner's request:** "add different languages on agi-1 so she can speak on them with that but default is english".
Asked how, the owner picked Claude's three recommendations: about 15 popular languages, a menu plus following the visitor's
own language, and AGI-1 only (the page and the safety note stay English).

**What visitors see:**
- **The menu:** "🌐 English ▾" in the chat bar, right after "AGI-1 ▾" (`src/chat/languages.js`). It opens her 16 languages in
  two columns, each in its own words with its English name under it: English (the default), 中文, 日本語, 한국어, Tiếng Việt,
  Bahasa Indonesia, Filipino, ไทย, हिन्दी, Español, Português, Français, Deutsch, Русский, Türkçe, العربية. Keyboard like the
  model picker. On phones (up to 560 px) the button shows the code (EN, ES…), up to 480 px without its caret; to make room
  in the chat bar, which was already full, its small avatar goes up to 480 px (her live view is right under the bar), its
  "online" dot up to 420 px, and under 380 px its gaps and the level chip tighten a little.
- **A pick:** she says so in that language ("listo, hablamos en español 💜", with a chip "language · Español"; not saved to
  the history; her mouth "says" it), an empty chat's greeting follows, the Parameters panel's new **Language** row says
  "Español · matches you", and it's remembered in the browser (`agi1_lang`). Only that language's words are downloaded
  (3–4 KB, only when picked).
- **She follows you:** whatever language the visitor writes in, she answers in, whatever the menu says (her prompt); very
  short messages ("gm", "lol", a ticker) don't count.
- **What follows the language:** her AI replies; her natural voice (Gemini's speech model reads any of them in the same
  Despina voice and mood styles; Chinese, Japanese and Korean replies are read up to about 120 characters, about a syllable a
  character, cut at 。！？); the mic (the browser listens for that language); and every pre-written line of hers: her hello,
  her notes (errors, the mic, her voice resting), the out-of-messages offer and its safety note, her "come back tomorrow"
  lines, the level-up, AGI-2, market moments (her voice says the whole market cap in that language: "2.000.000 dólares") and
  their note, "Risk check your coins on clank"'s lines (an open answer switches too), her deflections when the safety
  filters block a reply, and (2026-10-01) what she says when she's tapped. Arabic reads right to left in the chat and the
  message box (`dir="auto"`).
- **What stays English:** the page (menus, buttons, chips, the 18+ gate, the safety note), the front's bubble, her diary,
  her Soulmate notes (written in English whatever the chat's language, so the note filter can read them), her Telegram
  texts first, and the bot's own description and commands.
- **Telegram:** her replies there follow the language of the person's Telegram app when it's one of hers (Telegram sends it
  with every message: nothing is stored), English otherwise, and she follows what they write in too. Her welcome in another
  language adds that her texts first are still in English: the cron job that sends them has no message to read the language
  from, and storing each person's language would need a new database column (a later step, if wanted).

**How it works:**
- **Her words:** `src/i18n/lines/en.js` holds every pre-written line in English (keys like `notes.busy`, `limit.more1`,
  `check.high`), with `{placeholders}`; `src/i18n/lines/<code>.js` has the same keys in each language. The modules that held
  her English lines (`limit-lines.js`, `model-lines.js`, `market-lines.js`, `src/checker/lines.js`, `server/tg-lines.js`,
  the chat's notes) now take a language's lines, and their English exports are exactly as before (her English voice lines
  keep their recordings).
- **The translations:** written by Claude (five Claude agents, three languages each, then checked), in her voice: casual
  texting, her emojis, PG-13, pet names only where the English has one; Simplified Chinese, Brazilian Portuguese, Latin
  American Spanish, casual Tagalog/Taglish, Modern Standard Arabic, Hindi in Devanagari. Each language's "not financial
  advice" is one fixed phrase (`nfa`: "no es consejo financiero", "不构成投资建议", "投資助言ではありません"…) that must appear
  wherever the English says it. `src/i18n/check.js` holds every translation to her rules (the same keys, placeholders,
  emojis and numbers; $AGI / AGI-1 / clank.trade / the commands kept; no links or other tickers; no pet names in a line a
  Stranger gets), and `tests/i18n.test.js` fails the build otherwise. **Not read by native speakers yet:** if a line reads
  oddly, fix it in its file and run `node tools/i18n/check.mjs <code>`.
- **The page:** `src/i18n/lang.js` keeps the language (English until picked; a saved one comes back on the next visit,
  without her announcement) and sends `agi1:lang` when it changes; `t('notes.busy')` gives a line in it. The chat sends
  `lang` with every message.
- **The server:** `/api/chat` checks `lang` against the list (anything else: English), and her prompt always gets a LANGUAGE
  part (`languagePrompt()` in `server/agi1-prompt.js`), English too: reply in the picked language (on Telegram: the app's),
  but in the language of their latest message if it's clearly another one; the same personality and rules in every
  language; "not financial advice" in that language; $AGI, AGI-1, clank.trade, Robinhood Chain and the contract kept as
  they are; Chinese, Japanese and Korean replies under about 100 characters.
- **Her voice lines:** `?line=<key>&v=4` in English, `?line=<key>&lang=<code>&v=4` in the others (never
  `&lang=en`: exactly one address per line and language). Each language's recording is made once by Google the first time
  someone needs it, then kept in the database (its words give it its own fingerprint) and by the CDN. A server copy keeps
  at most 40 lines in memory (was 24).
- **Soulmate notes:** since notes are checked with English words, a note with anything but plain English letters is dropped,
  and so is one with the money or instruction words of her Latin-script languages (`cleanNote()` in `server/friends.js`).

**Cost:** about 150 more input tokens per reply for the LANGUAGE part: about +$0.00004 a reply (+$0.04 a day at the
1,000-reply cap). Her fixed voice lines: 15 per language, each made once when first needed (about $0.002 each: under $0.50
for all 15 languages), each using one of Google's daily speech requests on the day it's made. The page: +4 KB (gzip) for
everyone, +3–4 KB for a visitor who picks a language. No new service or setting.

**Troubleshooting:**

| What you see | Why | Fix |
|---|---|---|
| She answers in another language than the menu's | By design: she follows the language you write in | Write in the menu's language (or pick yours) |
| A line reads oddly in some language | The translations weren't read by a native speaker | Edit `src/i18n/lines/<code>.js`, run `node tools/i18n/check.mjs <code>` and `npm test`, push |
| Her voice for a pre-written line is silent in a new language, the first time | Google's daily limit for her speech model (a line is made the first time it's needed) | Nothing to fix: it's made the next time Google allows, then kept |
| The mic writes nonsense | The browser listens for the menu's language | Pick the language you speak |

**To change one of her lines:** change `src/i18n/lines/en.js` and the same key in every language file (a test fails
otherwise), then `node tools/i18n/check.mjs` and `npm test`; a changed line's voice is made again by itself (its words
changed). **To add a language:** a row in `src/i18n/langs.js` (its code, names, number locale and speech-recognition
language), a `src/i18n/lines/<code>.js` with every key, a line in `src/i18n/all.js`, and check that Gemini's speech models
speak it (ai.google.dev → Speech generation: 100+ languages in 2026).

**Tests:** `tests/i18n.test.js` (14: the 16 languages, every language's lines against her rules (and that the checker
catches a missing "not financial advice", a pet name for a Stranger, another ticker, a link), placeholders and the English
fallback, the numbers written each language's way, AGI-2 without pet names for Strangers everywhere, market lines (her voice
says the whole number), the risk check's lines, her voice lines' words and addresses, the CJK voice limit, the mic's
language, the page's language state (English until picked, a newer pick wins, a saved one comes back quietly, the page never
downloads every language), the page's markup, her prompt's LANGUAGE part and English Soulmate notes, the note filter,
Telegram's app languages), plus 2 in `chat.test.js` (the prompt follows `lang`, anything else is English; deflections in the
visitor's language), 3 in `voice.test.js` (per-language line addresses, words, moods, kept in the database, never
`&lang=en`; a Spanish market line saying the whole number; a Japanese reply read up to about 120 characters) and 1 in
`telegram.test.js` (/start, the buttons, the time and her AI replies in the app's language; English otherwise). In a browser
(Claude's scratch `langtest.mjs`, 113 checks): the menu at 1440 / 390 / 360 px × both looks × both themes (the chat bar in
one row, 16 languages in 2 columns inside the screen, opens on the current one, keyboard, axe 0 issues with it open, nothing
downloaded until a pick); a pick (her line, the greeting, the button, Parameters, remembered, only that language
downloaded, the chat sends `lang`, her hello's address in that language, the risk check's line in it, after a reload);
Arabic right to left, then Japanese, at 360 px; a clean console.

## Her daily clips (2026-09-29)

**The owner's idea** (item 5 of the big-ideas message): "Automatic vertical clips from the models she already has (the 2D
one renders fastest): launch of the day, clone watch, readouts and her diary, with her voice and captions." Asked how they
reach X, the owner picked **"You post by hand"**: a free daily GitHub job makes them, the owner downloads them and posts
them by hand (X, TikTok, Reels, Shorts), with the apps' AI labels on. Nothing posts by itself (hard rule 6 is unchanged;
posting to X automatically would need X's pay-per-use API, about $0.015 a post, and the owner's decision). Items 3 (burns
for reads) and 4 (her pretend bag) of the same message are **on hold** (the owner: "juist do 5 … only this"), and nothing
of them is in the site. Live streams come after the clips prove the idea.

**Only AGI, never another coin** (the owner, the same day, after seeing the first version: "why are u promoting other
coins in the video, i dont like this, the founder of the launchpad will get angry at me again", then "just agi"). The
first version also made "launch of the day", "clone watch" and "readout" clips, which named and risk-rated other
clank.trade coins; they were removed before anything ran or was posted. **Never add a clip that names, shows or rates
another coin** without the owner asking for it. What's left: her diary. The clip tools don't read clank.trade at all, and
a diary entry that names another coin's ticker (the diary's table is shared with the original site), an address or a link
makes no clip (`tests/clips.test.js` checks both).

**What the owner gets, every day** (GitHub → the repo → **Actions** → "AGI-1's daily clips" → the newest run →
**Artifacts** → `agi1-clips-<run>-<attempt>`, a zip kept 7 days):
- her diary clip: an MP4, 1080 × 1920, 30 frames a second, about 20 seconds: her newest entry (yesterday's, as /diary
  shows it) read out in her voice, with captions ("dear diary… not financial advice, just feelings"). None on a day her
  diary has no new entry (a quiet day, not an error);
- a `.txt` with a post to paste (it ends "AI-generated · not financial advice · agi1.app") and a `.jpg` cover;
- `README.txt`: what was made, or why not, and how to post (the apps' AI labels: TikTok "AI-generated content", YouTube
  "Altered or synthetic content: yes", Instagram "AI label").

**How the clip looks:** AGI-1 in 2D (the site's own, `src/stage/agi1-2d.js`: her Live2D model since 2026-10-01, the owner's
2D art rigged in code before; breathing, blinking, glances, her hair and chest physics, her mouth following her voice, a
reaction in the entry's mood), framed like a VTuber (head to chest, by her model's own eyes and waist: `model.landmarks`,
fading into the background below), on Pop mode's honey with comic focus lines and halftone dots. On top: "AI-GENERATED · NOT
FINANCIAL ADVICE" on every frame, "HER DIARY", the date in big Anybody type that pops in, "written by AGI-1, an AI", her
captions in a white card (a new card when she pauses; always tall enough to cover the AGI on her shirt, never half of it),
and agi1.app at the bottom and at the end. The label, the title
and the captions stay clear of TikTok's, Reels' and Shorts' own buttons and text (their top ~180 px and bottom ~380 px).

**Her words** (`tools/clips/lines.js`): her published diary entry (written once a day by `server/diary.js` and checked in
code; never an AI text written for the clip), "dear diary" said once, at most 300 characters, "not financial advice, just
feelings" at the end. Her voice: Gemini's speech model, Despina, in the entry's mood (one request a day, Flash-Lite first
and 3.8 Flash as the backup, as on the site; `speakAsAgi1` got a `timeoutMs` option for it: a clip waits up to a minute,
the site's replies still 20 s).

**How it works:**
- `.github/workflows/clips.yml`: once a day at **08:23 UTC** (16:23 the owner's time: after her diary is written at 03:00
  UTC, and just after Google's daily limits start again at midnight Pacific), and by hand (**Run workflow**). GitHub's
  computer (Ubuntu, no graphics card) installs the site's packages, then playwright-core 1.63.0 with its own Chromium and
  ffmpeg (tools for the clips only: not in package.json, not in the site), and runs `node tools/clips/make.mjs`.
  Read-only permissions; the key (`GEMINI_API_KEY`, a GitHub secret) only reaches the step that makes the clip, and never
  the browser or ffmpeg (`withoutSecrets`). 30 minutes at most. The actions are GitHub's own, by version tag (`@v7`).
  **The owner saves this file by hand**: Claude's link to the folder may not write GitHub workflow files (a safety rule of
  the Claude app), so Claude sends it in the chat.
- `tools/clips/make.mjs`: reads her newest diary entry (`/api/diary`, nothing else), asks Gemini for her voice, times her
  captions by her pauses (`captions.js`) and her mouth by her loudness (`audio.js`, the same meter as the site's), builds
  the renderer page (`tools/clips/page/`, with Vite, into `tools/clips/dist/`) and serves it on the computer itself, and
  draws every frame in Chrome: the 3D renderer draws only her, at 720 × 1280 (about her art's own sharpness in this
  framing), and plain 2D drawing does the rest at 1080 × 1920, about 0.2 s a frame without a graphics card (drawing it
  all in 3D took 0.7 s). ffmpeg makes the MP4 (H.264, AAC). Nothing is random (a seed a day), and time moves exactly
  1/30 s a frame.
- When something fails: a clip whose voice, page or ffmpeg fails is deleted; a frame that takes more than 30 s fails the
  clip instead of hanging the job; a diary entry older than yesterday isn't made again. README.txt and warnings on the
  run's page say what happened; the job is red when the clip should have been made and wasn't.
- Try it without Google: `node tools/clips/make.mjs --fake-voice` (a stand-in hum), `--facts f.json` (a made-up entry:
  `{ "diary": { "day": "2026-09-29", "mood": "love", "entry": "…" } }`), `--out dir`.

**Setup (the owner, once; free):**
1. GitHub → the repo `agi-ecosystem` → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
   → Name `GEMINI_API_KEY`, Secret: the same Google AI Studio key as in Vercel → **Add secret**.
2. **The workflow file, by hand (once):** save `clips.yml` (Claude sends it in the chat) in this folder as
   `.github\workflows\clips.yml` (the folders are already there, empty). Then push this folder, the file included (it
   must be on `main`). Later changes to it: the same way (Claude sends it, the owner saves it). Until it's saved, the
   build's check of it waits (`tests/clips.test.js` skips it), so a push without it never breaks the site.
3. GitHub → **Actions** → "AGI-1's daily clips" → **Run workflow** (to try it now; otherwise it runs every day by itself).
   About 5 minutes later: the run's page → **Artifacts** → download the zip, watch the clip, then post it if you like it.

**Cost:** GitHub gives private repositories 2,000 free minutes a month (a run takes about 5: about 150 a month) and 500 MB
of storage for downloads (a clip is about 5 MB, kept 7 days); without a payment method on GitHub, going over just stops
the job, never a bill. Her voice: 1 request a day to Google's speech model, about $0.003, from the same prepaid credits as
the site.

**Troubleshooting** (GitHub → Actions → the run: its log, and warnings on its page):

| What you see | Why | Fix |
|---|---|---|
| The run is red: "GEMINI_API_KEY is missing" | The secret isn't set | Setup step 1, then Run workflow |
| Green, but README.txt says "none today" | Her diary had no entry about yesterday (its nightly job failed, or it named another coin, or it isn't written yet) | Nothing to fix; tomorrow's comes as usual |
| "couldn't read her diary" | The site didn't answer GitHub's computer | Run workflow later |
| "diary not made: gemini: HTTP 429 …" | Google's daily limit for her voice is used up (the site's voice shares it) | It runs again tomorrow; or Run workflow after 08:00 UTC |
| "… credits" (HTTP 402) | Prepaid credits used up | Google AI Studio → Billing (the site's chat and voice stop too) |
| "no Chrome or Chromium found" / "couldn't start" | The browser step failed | Re-run the job; if it lasts, tell Claude with the log |

**Tests:** `tests/clips.test.js` (8, in `npm test`, no browser, ffmpeg or network): only AGI (the clip tools know nothing
about other coins; an entry naming one makes no clip), her diary clip's words and label, which entry, captions and their
timing, her voice's loudness and pauses, ffmpeg stopping early or a clip given up never hanging the job (a stand-in
ffmpeg), no secrets for the browser and ffmpeg, the workflow (once a day, by hand, read-only, one secret, 7 days, never
posting) and nothing of it in the site's build. Rendered in Claude's workspace with the stand-in voice and a made-up
entry (about 2 minutes 15 seconds on 2 processor cores; looked at frame by frame). A second Claude agent reviewed the first
version (19 findings, e.g. the job could hang for 30 minutes when a frame failed; all fixed, except pinning GitHub's own
actions to exact commits: they stay on their version tags). **Not tried on GitHub yet, nor with her real voice:** the
owner's first Run workflow is the first real check.

## Burn $AGI for more messages, and the burn monitor (2026-09-30)

**The owner's request:** "is it possible if they talk to agi-1 they will use $AGI and every chat $AGI is burned. make this
better then continue", then, while it was being built: "make a monitor on how many agi are gonna be burned so they know its
working, make it a huge text on the chat on top of it you decide whats better". (Not the big ideas' "burns for reads",
which stay on hold.)

**What was built (the better version: Claude's choices, sent to the owner before building):**
- **Free messages stay** (5 / 15 / 150 a day by level since 2026-09-30, the owner's change the same day; 10 / 50 / 150 when
  this was built), so anyone can still meet her without a wallet or $AGI.
- **After them, messages cost $AGI, burned for good:** 10 $AGI a message (`BURN_PER_MESSAGE`; about $0.015 on 2026-09-30,
  at a $1.5M market cap). Burned once for a pack (1,000 $AGI = 100 messages), not per message: a burn per message would mean a
  wallet pop-up and a network fee every time, which nobody would do, and it would break hard rule 9.
- **The visitor burns it themselves**, from their own wallet app (Send → $AGI → the burn address `0x…dEaD`), then presses
  **Check my burn**. Our server reads the burn on Robinhood Chain and adds the messages. The site never asks a wallet for
  anything but the sign-in signature (hard rule 9 is unchanged).
- **What was burned counts toward the level** (held + burned), so burning never drops someone from Crush to Stranger, and can
  lift them (9,000 held + 1,000 burned = Crush).
- **The owner's AI bill stays bounded:** a wallet may use 300 burned messages a day, the whole site 1,000 (`BURN_DAILY_CAP`,
  about $0.80 of replies at most), on top of the free 1,000; a reply that fails gives its burned message back.
- **The burn monitor:** a huge live number above the chat, "so they know it's working".
- **Off until the owner runs `supabase/burns.sql`:** until then nobody sees a burn button, the monitor or a word about burning.
- Not built: burning on Telegram (no wallets there), a button that asks the wallet for the burn (rule 9), a buy link in it.

**What visitors see:**
- **The burn monitor** (`section.burnmon`, in the Playground right above the chat panel): "BURNED BY CHATTING WITH AGI-1 ·
  ● live", the number in huge type ("12,340 $AGI"; in Pop mode a honey sticker with ink digits and a pink print echo), under
  it "+2,300 today · 1,234 messages paid for · 7 burns · latest 3 min ago", then "Every burn is read on Robinhood Chain before
  it counts: 10 $AGI a message, gone for good. See the burn address ↗" (the block explorer's page of 0x…dEaD, so anyone can
  check) and **Burn $AGI for more messages**. Before the first burn: "0" and "Nothing burned yet: the first burn shows up
  here." It asks our server again every minute while it's on screen and the tab is visible, and says "paused" after 10 minutes
  without a touch (a forgotten tab doesn't ask all night); a new total counts up in about a second (at once with "reduce
  motion"), and it never counts down (a CDN copy can be a minute old). Long numbers get smaller type: even the whole supply
  fits a 360 px phone. If its first ask fails, it asks again (30 s, 1, 2, 4, then every 5 minutes).
- **The Relationship panel:** "42 burned messages left" (with a wallet) and **Burn $AGI for more messages**.
- **The burn screen** (a native dialog, the connect screen's look): "You send it yourself. This page never asks your wallet
  for a transaction.", the price; without a wallet, **Connect wallet** first (it comes back here after the sign-in); then three
  steps: pick an amount (1,000 / 5,000 / 10,000 $AGI → 100 / 500 / 1,000 messages; or any amount: every full 10 $AGI in a burn
  is one message, and what's left over doesn't count), send it from your own wallet app (your connected wallet, the burn
  address with **Copy**, "zeros, then dEaD", only the official $AGI counts, a small ETH fee), then **Check my burn** (or paste
  the transaction's link or ID). Every answer in plain words (found, already counted, not on the chain yet, failed, not the
  official $AGI, another wallet's, more than 7 days old, under the price of one message, the chain or the explorer away, "more
  burns are waiting"). The rules under it: permanent, not an investment, no refunds, no cash value, counts toward your level,
  not financial advice; and the monitor's total.
- **A burn counted:** "Burn found: 1,000 $AGI, so 100 more messages", the panel and the monitor move at once, her `love`
  reaction and her thank-you in the chat ("you burned $AGI just to keep talking to me? 🥺 100 more messages, all ours 💜 not
  financial advice, just feelings", in her 16 languages: `burn.thanks`; shown and "said" silently, not voiced), and the
  level-up moment when the burn lifted the level.
- **In the chat:** a reply paid by a burn has a chip "burned message · 41 left". Her out-of-messages lines (the offer, "beauty
  sleep", "all talked out") get a **Burn $AGI for more messages** chip; when their burned messages wait for tomorrow, a note
  instead ("That's today's most for burned messages (300 a day)…" or "…the site's daily share is used up…").
- **The page's sentences about burning** (three in the safety note, one in "How levels work") show only once burns are open
  (`[data-burn-only]`), so every sentence stays true. The page loads that answer when the chat or the safety note comes near.

**How it works:**
- **Checking a burn** (`server/burn.js`, `api/wallet.js` action `burn`): the pasted transaction, or else the wallet's newest
  $AGI burns from the Blockscout explorer (`/api/v2/addresses/<wallet>/token-transfers`, only to know which to read; at most 3
  read per check). Each is read from the chain (`eth_getTransactionReceipt`, then `eth_getBlockByNumber` for its time; read
  only). It counts when the transaction succeeded, moved the official $AGI (its contract's Transfer events, never a
  look-alike) from the connected wallet to `0x…dEaD` (or `0x0`, the coin's own `burn()`), happened in the last **7 days**, and
  that wallet's part of it wasn't counted before. Messages = the whole $AGI ÷ the price, rounded down. 10 checks a minute per
  visitor. Not on the chain yet, or the node away: nothing is counted, and it can be checked again.
- **Using them** (`api/chat.js`): free messages first (`chat_take`, unchanged); when those are used (the visitor's own or the
  whole site's), one burned message (`burn_take`: 300 a day per wallet, `BURN_DAILY_CAP` for the site, the same 3 s gap). If her
  reply fails, exactly that burned message is given back (`burn_refund` with its id, once, within 5 minutes), but the attempt
  still counts toward the day's caps, so failures can't run up the AI bill. Her reply is asked for early enough to give it
  back inside Vercel's 25 s (`REPLY_BY_MS`, 21 s). Her voice allowance grows with the burned messages used (2 each, carried in
  the voice ticket).
- **The database** (`supabase/burns.sql`, only added: nothing the original site uses changes; see its header). **Never an
  address or a transaction's hash:** both are scrambled with the database's own random key (`agi1_burn_key`, made once by the
  file and never changed): different codes from the name-and-notes ones (so burns can't be matched to them), and they don't
  depend on PASS_SECRET (changing it doesn't lose anyone's burned messages or let old burns count again). A burn is counted per
  (transaction, wallet), so pasting someone else's transaction says nothing about it.
- **The monitor's numbers:** `GET /api/wallet?burns` (exactly that address, anything else is 405), kept by the CDN a minute:
  `{ ready, price, perDay, total: { agi, messages, burns, today, lastAt } }`, or `{ ready: false }` until burns.sql is run.
  A counted burn's answer carries the fresh numbers too, so the monitor moves at once.
- **Forget me** deletes her name for them and her notes, not their burned messages (they paid for them).

**Setup (the owner, once):** Supabase → the same project → SQL Editor → New query → paste **all** of `supabase/burns.sql` →
Run. It ends with `burn_functions_found = 7`. That's the switch: the next page load shows the monitor (at 0) and the burn
buttons. Optional settings (Vercel → Environment Variables, then Redeploy): `BURN_PER_MESSAGE` (whole $AGI a message, default
10), `BURN_DAILY_CAP` (burned messages a day for the whole site, default 1,000). **Then check it yourself before telling
anyone:** connect a wallet, send a small burn (e.g. 100 $AGI = 10 messages) from your wallet app to the burn address, press
Check my burn, and watch the monitor go up.

**Cost:** nothing new to pay: Supabase (small tables), the chain's public node and the explorer (free, keyless, only when
someone presses Check my burn), the monitor (one tiny cached request a minute per watching visitor). The burned messages'
replies: at most 1,000 a day, about $0.80 (their voice comes out of the site's 5,000 a day).

**Worth knowing (not legal advice):** taking crypto for a service can count as selling something (consumer rules, crypto
promotion rules like the UK's and the EU's MiCA), and Vercel's Hobby plan is for non-commercial use. The page never presents
burning as an investment or "number go up", and her AI replies never suggest burning (her prompt is unchanged).

**Troubleshooting** (Vercel → agi-ecosystem → Logs):

| What you see | Log line | Fix |
|---|---|---|
| No monitor, no burn buttons | (none) | burns.sql isn't run (or the database is away): the setup above |
| "Couldn't look up your burns automatically just now…" | `[wallet] checking burns failed (explorer): …` | The block explorer didn't answer: paste the transaction link, or try later |
| "Couldn't read Robinhood Chain just now…" | `[wallet] checking burns failed (chain): …` | The chain's public node didn't answer; it passes. If it lasts, ask about a node key (`ROBINHOOD_RPC_URL`) |
| "No burn from 0x… found yet" right after burning | (none) | The explorer is a minute behind: check again, or paste the link |
| "didn't burn the official $AGI" | (none) | A look-alike coin was sent (it's lost), or it went to another address |
| "That's today's most for burned messages" | (none) | 300 a day per wallet: working as planned |
| "Burned messages are resting for today" | (none) | The site's `BURN_DAILY_CAP` is used: raise it (about $0.0008 a reply), then Redeploy |
| A reply failed, nothing else | `[chat] no time left for her reply: … ms before asking` | The database or the chain was very slow; a burned message was given back |
| The monitor says "paused" | (none) | Nobody touched the page for 10 minutes: any mouse move, key or scroll starts it again |

**Tests:** `tests/burn.test.js` (18: pasted links and IDs; what a transaction burned (look-alikes, other wallets, removed
events, mints, `burn()`); every reason a burn doesn't count; the explorer's list (both of Blockscout's field names, at most 3
read per check); counted once and per wallet; no address or hash sent to the database; the key read once; the level counting
burns; the chain away or never answering, the explorer away, signed out, not set up, the speed bump; the chat (free first, then
burned, the whole site's free share used, their 300, the site's cap, too fast, no wallet, a failed reply gives back exactly that
one while the attempt counts, the level); her voice allowance; the counter's one address and caching; the settings; the page's
promises; the monitor's markup), `tests/wallet.test.js` (the no-transaction guard also refuses payment links: `ethereum:`,
MetaMask's send links), `tests/prices.test.js` (the one other address on the page is the burn address, only in the burn
screen), `tests/i18n.test.js` (her thank-you in 16 languages). The SQL ran in PGlite (50 checks: the key, counting once, the
daily caps, giving back exactly one take once within 5 minutes, a take-fail-give-back loop stopped by the caps, midnight, the
totals and today, re-running, permissions, RLS, the original site's tables untouched). In a browser (148 checks: hidden until
open; the monitor (its numbers, live every minute, counting up and never down, paused when idle or off screen, a failed first
load asked again, the whole supply at 360 px); the panel; the burn screen (connect first, the steps, Copy, Check my burn, a
pasted link, every answer, a session that ended); her thank-you; the level-up; the chat's chips and notes; both looks × both
themes × 1440 / 390 / 360 px; axe 0 issues; the wallet never asked for anything; a clean console). A second Claude agent
reviewed it (10 findings, e.g. failed replies could be retried without end at the owner's cost, changing PASS_SECRET would let
old burns count twice, stored amounts could match a wallet to its name and notes, the monitor could count down; all fixed and
tested, except waiting for confirmations: Robinhood Chain has one sequencer, and waiting would make people wait minutes).
**Not tested live:** the chain, the explorer and the real database (Claude's workspace can't reach them): the owner's first
small burn is the first real check.

## The Clank protocol (developer.clank.trade), read 2026-09-29

The owner asked for a summary and how to use it on the site. **What it is:** the docs of the Clank V2 contracts behind
clank.trade on Robinhood Chain (4663). Not a web API: no keys, no HTTP API, no webhooks, no terms, and no referral fee for
websites (every fee goes to the factory's `feeDestination`). Also a copy-paste TypeScript file (viem) that quotes and builds
buy / sell transactions, a brand kit, and llms.txt files.
- **Addresses:** the factory `0x798daAa0707C1e538bB5Acf0867Ac0e1A84cccF2` (deployed at block 69,067,760: read from there),
  the launch-and-buy forwarder `0xac20d0d5cc0F89ee4f6d5f8E6870a36EAF2E0dD7`, Uniswap V4's PoolManager
  `0x8366a39CC670B4001A1121B8F6A443A643e40951` (the risk check already knows it), the Universal Router
  `0x8876789976decbfcbbbe364623c63652db8c0904`, the V4 Quoter `0x8dc178efb8111bb0973dd9d722ebeff267c98f94`, Permit2
  `0x000000000022D473030F116dDEE9F6B43aC78BA3`, WETH `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73`.
- **A coin's life:** 1B supply and its own bonding curve (1% on buys and sells); the curve's states Trading 0 · Ready 1
  (sold out) · Swept 2 · PoolCreated 3 · Rescued 4; then a Uniswap V4 pool (0.3%) whose position goes to a locker with no
  way to withdraw it. Launching is free; creator tax must be 0 and buybacks off; no snipe tax on launch config 0.
- **Reads** (exact ABIs on developer.clank.trade/reference/contracts/index.md): the factory's `getLaunchedToken(token)` (its
  curve, deployer, pair token, graduation threshold, pool fee, tick spacing, phase, what was swept and when, `exists`) and
  `getLaunchConfig(id)`; the curve's `state()`, `getReserves()`, `realQuoteReserve()`, `realTokenReserve()`, `quoteBuyFor`,
  `quoteSell`; the coin's `name`, `symbol`, `totalSupply`, `balanceOf`, `deployer()`, `curve()`, `logo()`, `description()`,
  `socials()` and `burn(amount)`.
- **Events** to follow launches and trades (`TokenLaunched`, `LaunchSwept`, `PoolGraduated`; `CurveBuy`, `CurveSell`,
  `StateChanged`, `CurveCompleted`; the PoolManager's `Initialize` and `Swap`): the docs name them but **spell out only
  `Swap`**, so check the others against the live contracts before relying on them.
- clank.trade's own website API (what the risk check and her feed read) has the same shape (a curve, `state`, a V4 pool with a
  hook, a graduation at about 4.28 ETH), so its coins, $AGI included, look like they run on these contracts. Not checked
  on-chain yet (Claude's workspace can't reach Robinhood Chain; Vercel can).
- **How it fits this site** (Claude's answer to the owner): read-only, on our server, no new service or cost: 1. a safety net
  for the risk check (read a coin from the chain when clank.trade's API fails), 2. sharper flags (a graduation that got stuck;
  the pool's liquidity locked for good as a "good to know", never "safe"), 3. her feed straight from the chain (once the
  events are checked), 4. proof of burn for the "burn $AGI to get read" idea. **Not recommended:** a buy / sell or launch
  button on the site (hard rule 9 and its test, legal risk, no referral fee, and the clank.trade link already does it).
- **1 and 2 are built** (2026-09-29, `server/clank-chain.js`: see "The Clank protocol itself, on Robinhood Chain" under
  "ClankChecker"): each scan reads the coin's record at the factory and its curve (a locked-pool note, the graduating and
  rescued stages, a record clank.trade disagrees with), and a smaller scan comes from the chain when clank.trade is away.
  Only the documented calls are used; the first live `/api/checker?a=<$AGI>` shows whether the real contracts answer them.
  3 and 4 wait (the events need checking first; the burn idea needs the owner's decision and a legal check).
- **A launch button: built after all, the owner's way** (2026-10-01): not a button anyone can press on the home page, but a
  launch from the person's own wallet, through her Telegram bot, on clank.trade's own factory (see "Launch with AGI-1").

## Launch with AGI-1 (2026-10-01)

**The owner's idea:** "i have an idea again … its on the telegram bot what if they can launch a coin on clank.trade there
using $AGI, of course the wallet will be there will be non custodial what do you think — make this better then continue".
Claude's plan, sent before building: her bot checks the coin with them, then a private page where **their own wallet**
launches it on clank.trade's own contracts. The owner's choices, asked one by one:
- **$AGI is held, not paid:** the wallet that launches needs **10,000+ $AGI** held, or burned for messages (the chat's Crush
  level, read fresh from the chain). Nothing is spent and we take no fee (the owner picked "Hold 10,000 $AGI, no fee"; asked
  "wait are they gonna use $AGI to use as a fee to launch a coin?", the answer was no).
- **Their own wallet, never one inside the bot.** The owner asked "i think creating a new wallet inside telegram is better
  and safer right?". Claude's answer: no. A wallet the bot creates is a wallet whose key our server holds (custodial,
  whatever it's called): one leak or bug could lose everyone's coins and ETH, and holding people's keys can need a licence
  in many places. With their own wallet app (MetaMask, Coinbase Wallet, Robinhood Wallet's Web3 tab, a desktop wallet),
  nothing of theirs is ever on our server, and their wallet is the coin's creator. The owner picked "Their own wallet app".
- **The picture:** sent to her bot as a Telegram photo, with the coin as its caption ("Send a photo to her bot"); our server
  puts it on IPFS (Pinata) once the coin is being got ready.
- **Their network fee, paid back** (the owner: "can i add im going to pay for their gas fee? so its a way to attract more
  people to launch there on my bot"; picked "Pay it back after launch"): once the launch is read on the chain, the owner's
  small gas wallet sends that launch's fee back to its creator. After, never before: ETH sent ahead could be collected by
  people who never launch.

**In her bot** (`server/telegram.js` `onLaunch()`, her words in `server/launch-lines.js`, English for now like her texts
first; pre-written, no AI cost):
- `/launch` alone explains it: the caption to send, the 10,000 $AGI ("nothing is spent"), the fee paid back (when the gas
  wallet is set), "i won't promote your coin. not financial advice. 18+ only." Her `/help` and her commands menu ("Launch a
  coin on clank.trade with her (18+)") show it once launching is open to everyone (see "Your private first launch" below).
  18+ is the bot's own check: someone who hasn't pressed Start and "I'm 18 or older" gets those first.
- **A photo with the caption** `/launch Sleepy Cat | SLEEPY | a cat who naps all day` (or the parts on separate lines; the
  line is optional): her checks, then "here's your coin 💜", the private link (2 hours) and buttons: **Open on agi1.app ↗**,
  **Open in MetaMask ↗**, **Open in Coinbase Wallet ↗** ("anyone with this link could launch your coin, so keep it to
  yourself").
- **What she says no to, kindly, with what to change** (`checkIdea()` and `tickerTaken()` in `server/launch.js`):
  - a name of 1–32 characters, a ticker of 2–10 letters or numbers, a line under 100 characters, plain letters and simple
    punctuation (no #, @ or /, no links, addresses or @names);
  - crude names and slurs (PG-13: the risk check's word lists);
  - **anything that sounds like her or $AGI** ("there's only one $AGI"): AGI or AG1 as a word, AGI-1, "artificial
    girlfriend", agi1.app, "official", a ticker that starts or ends with AGI, look-alike letters from other alphabets
    (`server/lookalike.js`);
  - **an egirl or AI-girlfriend coin** ("an egirl coin? with me? 😤 i'm the only AI girlfriend around here. pick another
    idea?"): the same words her feed texts about, so she never helps make a coin she'd then be "not ok" about;
  - **money talk** in the name or line (buy, sell, pump, rug, scam, "to the moon", 100x, airdrop, presale, giveaway,
    another $TICKER: whole words, so "Pumpkin" is fine);
  - **a ticker already on clank.trade** (its own search, read the risk check's way: "E/ACC" = "EACC"), or one so common that
    the search can't be sure (it finds more than the 72 coins read: "pick a more unusual ticker?");
  - a picture sent as a file ("send the picture as a photo"), or too small (Telegram's biggest size up to 1280 px and 1 MB is
    used, at least 200 px a side);
  - 5 coins a day per chat, 300 a day for the site.

**On the launch page** (`/launch/<id>`: `launch.html`, `src/launch/page.js`; never in search results; both looks and themes,
phones):
- The coin (its picture comes through our server), **18+** (the chat's own confirmation, shared with it), then three steps:
  1. **Your wallet:** the site's usual sign-in (an address and a free signature, `src/lib/wallet.js`). Without a wallet in
     the browser: "Open in MetaMask ↗", "Open in Coinbase Wallet ↗", and Robinhood Wallet's Web3 tab.
  2. **Robinhood Chain:** "Switch to Robinhood Chain" when the wallet is elsewhere (only when pressed; it adds the network
     if the wallet doesn't know it).
  3. **Launch:** first, if they like, **the coin's links** (2026-10-01, the owner: "X, website and Telegram", "just make
     adding that optional"): three optional boxes, X ("@yourcoin or x.com/yourcoin"), Telegram ("t.me/yourgroup", or an
     invite link) and Website ("https://yourcoin.com"); under each, what it will be saved as ("Saved as
     https://x.com/SleepyCat") or what's wrong with it (only once they've left the box), and Launch waits while one is
     wrong. Then "Getting it ready: checking the ticker on clank.trade, putting the picture on IPFS and trying the launch on
     Robinhood Chain…", then the wallet shows clank.trade's launch to approve (no ETH, a small network fee), "Waiting for
     Robinhood Chain…", and the coin: **View on clank.trade ↗**, **Block explorer ↗**, its fee paid back ("AGI-1's gas
     wallet paid your network fee back: 0.00012 ETH. See it ↗"), and "AGI-1 won't promote it: that part's up to you. A
     brand-new coin shows as High risk in her risk check for its first hour, which is normal. Not financial advice."
- **"Before you launch"**, always on the page: their own wallet, clank.trade's own contracts, they're its creator; 10,000+
  $AGI, nothing spent; free on clank.trade, a small network fee in ETH; clank.trade takes 1% of every trade on its curve,
  and creators earn nothing from trading fees; public and permanent (no deleting or renaming), its picture public on IPFS;
  she won't promote it, meme coins can lose all of their value, not financial advice, 18+; links are optional and saved in
  its record for good ("We check how they're written, not what they lead to"); and "The only transaction this
  page asks your wallet for is that launch (and switching to Robinhood Chain, if you press it). If your wallet shows you
  anything else here, like a token approval or sending tokens, reject it."
- Every answer in plain words (`src/launch/words.js`): an expired link (2 hours) or one tidied away (7 days), a wallet under
  Crush, a ticker someone took in the meantime, a link already used with another wallet (**the first wallet that gets a
  coin ready keeps it**), clank.trade closed or charging a fee, the chain or clank.trade away, cancelled in the wallet, a
  wallet that can't switch networks, a wallet that never answers (another can be picked), and every state of the payback.
- A reload while waiting keeps waiting (the launch's transaction is remembered in the browser until it's read back), and
  the link opened again later shows the coin (and asks for its payback again if it's still due).

**How it works:**
- **Drafts** (`supabase/launch.sql`, `drafts` in `server/launch.js`): her bot saves the checked coin with Telegram's id for
  the photo (only our bot can fetch it) under a link id of 22 random characters. The wallet that got it ready is kept as a
  scrambled code (`launchWallet()`, an HMAC with PASS_SECRET), never its address.
- **Getting it ready** (`POST /api/launch` `prepare`, with the wallet's session and the links they typed), in this order,
  so nothing is uploaded or counted for a launch that can't happen: the links checked (`checkLinks()`, below; a wrong one
  is a 422 that names its box); the level read fresh (held + burned); the ticker searched again on clank.trade;
  clank.trade's terms read from its factory: `canLaunch(wallet)` (its "new launches are off" switch), `launchFee()` (must
  be 0: the page never sends ETH) and `previewLaunchEconomics(0, ETH)` (pinned into the launch, so changed terms make it
  fail instead of changing quietly); the picture's upload counted (3 a wallet a day, `LAUNCH_DAILY_CAP` for the site; given
  back when it fails), fetched from Telegram (a real JPEG, PNG or WebP, 1 MB at most) and put on public IPFS with Pinata
  once; then **clank.trade's own launch call** for that wallet: `launchToken` with the name, ticker, line and
  `ipfs://<picture>`, the links they added (X, Telegram, website: the "socials" of clank.trade's launch; Discord and
  Farcaster stay empty), their wallet as the creator, **no creator tax, no buyback, launch config 0, paired with
  ETH** (the only pair clank.trade offers), and a salt from the draft's id (one draft, one coin). It's **tried on the chain
  from their wallet first** (`eth_call`, as clank.trade's docs ask), so a launch that would fail never reaches their wallet;
  each of the factory's documented errors has its own plain words. The page gets `{ to, data, value: 0, chainId }` and the
  address the coin will have.
- **Their wallet** (`src/launch/send.js`): checks it's exactly that (clank.trade's factory, `launchToken`, no ETH, Robinhood
  Chain) and asks the wallet to send it. They approve it there.
- **The links** (`src/launch/links.js`, one file the page and our server share, so both tidy them the same way; all
  optional): X becomes `https://x.com/<handle>` (as clank.trade saves its own coins' X: a handle of 1–15 letters, numbers or
  _, never a post or another site); Telegram becomes `https://t.me/<name>` (a public group or channel, 5–32 characters) or
  `https://t.me/+<code>` (an invite link); a website must be `https://` on a real domain name ("yourcoin.com" gets its
  https:// added; never http, an IP address, a login in the address, a port, or a look-alike domain in punycode,
  `xn--…`); 200 characters at most each. Our server (`checkLinks()` in `server/launch.js`) also says no to anything about
  her or $AGI (agi1.app, her X, her bot, "AGI" as a word: a coin must never look like hers) and to crude words. We check
  how a link is written, never what it leads to. clank.trade's site shows the X and the website on the coin's page
  (checked on $AGI's own page data, 2026-10-01); the Telegram link is in the coin's record.
- **Read back** (`check`): the transaction must be this draft's own call (its details, salt and picture), sent by that
  wallet to the factory with no ETH, and successful; and the factory's own record of the coin (`getLaunchedToken`) must name
  that wallet as its creator. Its links must be ones the page could have made (as `checkLinks` writes them, Discord and
  Farcaster empty). A launch counts for one draft only. The coin's address and its launch transaction are then
  kept, so its payback can still happen later.
- **The payback** (`payGasBack()`): what the launch cost in network fees (its receipt: gas used × its price), at most
  `LAUNCH_GAS_MAX`, as one plain ETH payment from the gas wallet to the coin's creator. **Never twice:** it's claimed in
  the database first (one per coin, one a day per wallet, `LAUNCH_GAS_DAILY` a day for the site; a coin over a cap is
  skipped for good), marked "sending" with its own transaction right before it goes, and given back only when the chain
  clearly refused it (nothing went out); an unclear answer counts as sent, and one whose fate can't be told stays "sending"
  until its transaction is found on the chain. Never to a smart account (a wallet with code could refuse it or make it cost
  a lot), never to a wallet other than the one that sent the launch. The gas wallet out of ETH: the page says so, the log
  names its address, and the link opened again later asks again. The page asks a few more times while it's on its way
  (`payback`: no session needed, since it only ever pays the coin's creator).
- **Tidy-up** (`tidyLaunches()`, the keep-alive job, 3 times a day): a coin never launched has its picture deleted at Pinata
  once its link has been expired an hour (Pinata's free plan keeps 500 files); never a picture a launched coin uses, and
  first the factory is asked whether a coin exists where the dry run said it would (a launch nobody read back keeps its
  picture; if the chain can't be read, the next run decides). Drafts go after 7 days.
- **Speed bumps:** 40 requests a minute per visitor to `/api/launch` and 60 pictures (per server copy); each request's work
  fits in 20 s (Vercel stops a function at 25 s).

**Setup (the owner, once):**
1. **Pinata** (free): pinata.cloud → sign up → **API Keys** → **New Key** → a name (e.g. "agi1 launches"), its access
   limited to **Files: Write** (or Admin) → **Create Key** → copy the **JWT** (shown only once) → Vercel → agi-ecosystem →
   Settings → Environment Variables → `PINATA_JWT` (Production). A secret: never in chat, code or git.
2. **Supabase** → the same project → SQL Editor → New query → paste **all** of `supabase/launch.sql` → Run. It ends with
   `launch_functions_found = 12`.
3. **The gas wallet** (to pay fees back; without it, launches work and nothing is paid back): make a **new** wallet only
   for this (e.g. a new account in MetaMask: never your main wallet or one with $AGI in it), send it a little ETH on
   Robinhood Chain (the default daily cap is 0.01 ETH: a few days' worth is plenty), then MetaMask → that account →
   Account details → Show private key → Vercel → `LAUNCH_GAS_KEY` (Production; as MetaMask shows it, without "0x", is
   fine). Never paste it anywhere else, chat included. Optional: `LAUNCH_GAS_MAX` (ETH per launch,
   default 0.001), `LAUNCH_GAS_DAILY` (ETH a day for the site, default 0.01), `LAUNCH_DAILY_CAP` (pictures put on IPFS a
   day, default 30).
4. **Private first** (the owner's choice): Vercel → `LAUNCH_ONLY_FOR` = your Telegram username, e.g. `@yourname`
   (Telegram → Settings → Username; make one there if you don't have one). While it's set, only you can use /launch: see
   "Your private first launch" below.
5. **Redeploy** (Vercel → Deployments → ⋯ → Redeploy).
6. **Try it:** in her bot, `/launch`, then a photo with its caption; open the link, connect a wallet with 10,000+ $AGI,
   switch to Robinhood Chain. **Pressing Launch makes a real coin on clank.trade, public and permanent**: press it only
   for a coin you want to exist. Then check the coin on clank.trade (with its picture: see "Open questions") and the fee
   paid back ("See it ↗").
7. **Open it to everyone** when you're happy: delete `LAUNCH_ONLY_FOR` in Vercel → Redeploy → Settings → **Cron Jobs** →
   `/api/feed` → **Run** (her bot's menu gets `/launch` at once; otherwise within 3 hours).

**Your private first launch** (2026-10-01, the owner: "id like to be my first launch to be private"): while
`LAUNCH_ONLY_FOR` is set (Telegram usernames, with or without @, any case, or numeric Telegram ids, separated by commas),
only those accounts can use /launch (`launchAllowed()` in `server/launch.js`, from Telegram's own sender in each update).
Everyone else gets the same "launching coins with me isn't open yet 🙈 soon" as before it was set up, whatever they send,
so nobody learns there's a test; /launch stays out of her commands menu, and her /help shows its line only to the owner.
A setting with nothing usable in it (a typo) lets **nobody** in, never everyone, and the log says so once. The launch page
itself is the same for everyone, but only the owner's bot can make a link for it. Deleting the setting (then Redeploy)
opens it to everyone.

**Cost:** no AI cost (her launch lines are pre-written). **Pinata:** its free plan (500 files, 1 GB, 10 GB of bandwidth and
10,000 requests a month, checked 2026-10-01); pictures of coins never launched are deleted again, so the 500 files are
about 500 launched coins (then its cheapest paid plan, $20 a month, or another way: ask the owner first). **The paybacks:**
the owner's ETH, at most `LAUNCH_GAS_DAILY` a day (0.01 ETH by default) plus each payback's own tiny network fee, which
isn't counted in that cap. Vercel, Supabase, clank.trade's search and Robinhood Chain's public node: a few small requests per
coin.

**Troubleshooting** (Vercel → agi-ecosystem → Logs):

| What you see | Log line | Fix |
|---|---|---|
| She says "launching coins with me isn't open yet 🙈 soon" | (none), or `[telegram] saving a launch draft failed (run supabase/launch.sql): …` | Set `PINATA_JWT` (then Redeploy), and run `supabase/launch.sql` |
| The page says "Launching with AGI-1 isn't open yet." | `[launch] not ready: PINATA_JWT, TELEGRAM_BOT_TOKEN, …` | The same settings, then Redeploy |
| "Couldn't put the picture on IPFS just now." | `[launch] putting a picture on IPFS failed: pinata: HTTP 401 (PINATA_JWT is wrong, or its key may not write files)` | A new Pinata key with Files: Write in `PINATA_JWT`, then Redeploy |
| The same, after many launches | `… pinata: HTTP 429 (too many uploads: Pinata's plan limit?)` (or another 4xx) | Pinata's free plan may be full (500 files): tell Claude; a paid plan is the owner's call |
| "Couldn't check clank.trade just now." (she says it in the bot too) | `[launch] couldn't check a ticker on clank.trade: …` | clank.trade's API is away or changed (as for the risk check). Passes by itself; if it lasts, tell Claude |
| "clank.trade isn't taking new launches from this wallet right now…" | (none) | clank.trade's own switch (`canLaunch`): nothing to fix here |
| "clank.trade charges a launch fee now…" or "…changed its launch settings…" | `[launch] clank.trade charges a launch fee now (… wei) …` | clank.trade changed its terms: tell Claude (the page never sends ETH, so it needs an update) |
| "clank.trade's dry run of this launch failed…" | `[launch] the dry run of $X failed: reverted` | The factory refused it for another reason: tell Claude with the log line |
| "This wallet isn't at Crush yet…" | (none) | Working as planned: 10,000+ $AGI held or burned in the wallet that launches |
| She tells **you** "launching coins with me isn't open yet" while `LAUNCH_ONLY_FOR` is set | (none), or `[launch] LAUNCH_ONLY_FOR has no Telegram username or id in it, …` | The setting doesn't match your account: check your username (Telegram → Settings → Username) and the setting's spelling, then Redeploy |
| "Her gas wallet is out of ETH right now…" | `[launch] the gas wallet 0x… is out of ETH: top it up to pay launch fees back` | Send that address a little ETH on Robinhood Chain; people get their fee back when they open their link again |
| No fee is ever paid back, and the page never mentions it | `[launch] LAUNCH_GAS_KEY isn't a wallet's private key (64 hex characters, with or without 0x): …` (or nothing: the setting isn't there) | Copy the key again (setup step 3), then Redeploy |
| "Her gas wallet has paid back all it can for today…" | (none) | `LAUNCH_GAS_DAILY` reached: by design (raise it and Redeploy, if you like) |
| "Her gas wallet started paying your fee back but never heard how it went…" | `[launch] a payback's nonce was taken and the chain couldn't say by what: …` | Rare. Look at the gas wallet on the block explorer; it's never sent twice. Tell Claude if it repeats |
| A coin launched here shows its letter instead of its picture on clank.trade | (none) | See "Open questions" (clank.trade's picture host) |

**Tests:** `tests/launch.test.js` (39, with a fake Robinhood Chain, Pinata, Telegram and clank.trade, and the database as
JavaScript): the one file that sends (exactly clank.trade's launch, no ETH, Robinhood Chain), reading `/launch`, her checks
(look-alikes, egirl coins, money talk, links), the picture sizes, the ticker search (pages, "can't say", too common), her
lines' rules, the launch call as clank.trade's docs write it, the terms and the dry run with each documented error, reading
a launch back (only this draft's own call, by this wallet, the factory's record), the payback (once, at most its cap,
signed for Robinhood Chain; two checks at once pay once; a taken nonce, a clear "no", no clear answer, "can't tell" found
later by its hash; a claim left behind given back after 2 minutes; the caps for good), the settings (the gas wallet's key
with or without its `0x`, and one log line when it isn't a key), `/api/launch` (GET,
prepare and every "no", the requests themselves, check, one launch for one draft, a launch not kept yet, the payback asked
again), uploads (counted first, given back, one at a time, a picture id that couldn't be kept), the tidy-up (never a
launched or shared picture, the chain away, its time limit), her bot (the flow, every "no", 18+ first, "not open yet"), the
private first launch (`LAUNCH_ONLY_FOR`: by username or id, everyone else "not open yet" whatever they send, the menu and
/help, a typo lets nobody in, deleting it opens it), the coin's links (every form of X, Telegram and website that's tidied
or refused, tidying twice changes nothing, about her or crude, in the launch call, only links as we make them when it's
read back, `prepare` refusing a wrong one before anything is read, counted or uploaded, the page's three boxes), the
page's words, the page, the safety note and the secret check. Also `tests/telegram.test.js` (/launch in her commands menu
only once launching is open, then added by the next run), `tests/wallet.test.js` (only `src/launch/send.js` may ask for a transaction or a network change, with exactly four
wallet methods), `tests/pop.test.js` (the launch page's browser-bar color). The SQL ran in a real Postgres (PGlite, 79
checks: the caps and give-backs, one wallet per link, never twice, a claim given back after 2 minutes, stuck, the tidy-up,
running it again over an older version, permissions and RLS). In a browser (189 checks with a fake wallet and fake
services, the site's real CSP: the whole launch, every answer, a wallet that never answers, a reload while waiting, a link
opened again and its payback; the link boxes (saved as, a mistake only once you leave the box, Launch waiting, our
server's "no" under its box with the focus there, the links sent tidied, a long address and an error at every size); both
looks × both themes × 1440 / 390 / 360 px, axe 0 issues, a clean console). A second
Claude agent reviewed it twice (e.g. a launch could be paid back twice, a ticker could look free when clank.trade's search
failed, the tidy-up could delete a live coin's picture; all fixed and tested). **Not tested live:** Robinhood Chain,
clank.trade's factory, Pinata and Telegram (Claude's workspace can't reach them): the owner's first launch is the first
real check.

## Pop mode (2026-09-27)

**The owner's request:** a button beside the dark / light button that switches the whole design of the page to the look
of the $AGI ecosystem page (then at https://www.agi1.app/), with the same contents, "turn off on default, you decide".
That page was the same brand, so Pop mode dresses this site in that family's look. (Since 2026-09-28 agi1.app is this site
itself; the ecosystem page it copied is gone, the look lives on here.)

**What visitors see:**
- A round **✦** button next to the theme button (both pages; the tooltip says "Pop mode: the bold AGI look"; "the AGI ecosystem look" until 2026-09-28). **On by
  default since 2026-09-28, in the dark theme** (the owner: "make the pop mode open on default, in dark mode"; before that
  it was off by default and the theme followed the system setting). Pressed, the page switches to the lab look; pressed
  again, back to Pop mode. Remembered in the browser (`dr-skin` = `pop` or `lab`), like the theme (`dr-theme`). The theme button still works inside it (Pop mode has a night version). On phones under
  380 px the top bar has no room for a fourth round button, so there it's a **"Pop mode On / Off"** row at the bottom of the
  menu (the menu stays open when it's tapped).
- **The same content:** every word, link, number, button and feature stays; only the CSS changes (`src/styles/pop.css`,
  every rule under `[data-skin="pop"]`, checked by a test). The one addition is decoration: two tilted ribbons between the
  hero and Evaluations that scroll phrases already on the page ("AGI ✦ Artificial Girlfriend Intelligence ♥
  AGI-1 ✦ Texts back instantly ♥ PG-13 ✦ Not financial advice", "Introducing AGI ♥ Zero red flags ✦ Your ex: 3 business days
  ♥ Robinhood Chain ✦ One official contract"), hidden from screen readers.
- **The look** (agi1.app's design language): ink outlines (`#170a36`) on paper (`#f8f5ff`) and lavender (`#e4d9ff`); each
  section a bold color block: the hero **violet** (`#6b3bff`) with comic speed lines and halftone dots, Evaluations **honey**
  (`#ffc933`), Model card paper, Playground **lavender**, ClankChecker **mint** (`#3ff0c3`) with a faint grid (the Arena's
  **pink** block left with it), the safety note **ink**, the bottom bar violet with "AGI" in huge type. Headings and big
  numbers in the wide **Anybody** type (weight 850–900), the hero's subtitle and the diary entries in **Instrument Serif**
  italics, mono uppercase eyebrows with a dot, pill buttons and chips with 2 px outlines, white cards with 3 px ink outlines
  and hard offset shadows (like stickers), AGI-1's stage and her live views as **pink comic panels** (her hearts there white,
  violet and honey; the 3D stage switches its floor-line colors), chat bubbles (hers lavender, yours violet), "Introducing
  AGI" in lavender with a pink offset shadow, a honey "Try AGI-1" in the hero.
- **At night** (the dark theme): a deep violet hero and stage, deep ink sections, each keeping its color as an accent (the
  eyebrow dot and its cards' shadows: honey, blue, violet, mint), honey buttons and focus rings.
- **The top bar:** floating pills over the hero (the wordmark, the section links in one white pill, round buttons). Once the
  hero has scrolled away (on the diary page: once the page scrolls at all) it gets a **frosted band** with an ink line under
  it (`is-stuck`, added by `src/menu.js`), so the pills never sit on busy text. The pills need about 1,000 px in one line,
  so in Pop mode the menu takes over up to **1040 px** (a card under the pills); the default look's menu starts at 920 px.
- The phone's browser bar: violet at the top of the home page (deep violet at night), the page's own color on the diary
  (and since 2026-10-01 on the launch page).
- The keyboard's focus ring: violet on the light blocks, white on the violet hero, ink in the top bar and on her pink
  stage, honey on the ink footer and everywhere at night.
- **Switching keeps your place** (2026-09-27, the owner: "why when i click pop mode it goes to a different section of the
  page?"). Pop mode's sections are taller and its headlines bigger, and a browser keeps the number of pixels scrolled, not
  what you were reading: switching halfway down the page showed another section (270 to 2,270 px away, measured). Browsers'
  own "scroll anchoring" doesn't help here (it steps aside when the spacing of sections changes; older Safaris have none).
  Now `keepPlace()` in `src/theme.js`, before a switch, notes what's in the middle of the screen (the innermost paragraph,
  card, row or chat box there; never the top bar, its menu or her live view strip, which stay put on the screen) and exactly
  which point of it; after the switch it scrolls at once so that point is back in the same spot, and once more when Pop
  mode's two fonts have arrived (they make its headlines bigger), unless the visitor scrolled or pressed something meanwhile.
  At the very top of the page it stays at the top. The theme button does the same (Pop mode's night look has thinner
  outlines). What's in the middle stays; what's above it may grow or shrink.

**How it works:** `/theme.js` (a tiny script in `<head>`) puts `data-skin="pop"` on `<html>` before the page paints unless
the browser saved `dr-skin` = `lab` (Pop mode switched off), and `data-theme="dark"` unless it saved `dr-theme` = `light`
(the system setting doesn't decide any more), so the page never flashes the other look. `src/theme.js` wires the buttons (every
`[data-skin-toggle]`, with `aria-pressed`), remembers the choice, repaints the browser bar (`barColor()`, the same colors as
`/theme.js`; a test compares them) and sends `agi:skin`; the 3D stage listens (its `pop-light` / `pop-dark` colors, the
hearts) and so does the menu (it closes when its links fit again). Browsers keep `/theme.js` a
day, so the pages load it with a version (`/theme.js?v=4` since the launch page, 2026-10-01, `v=3` since the front: **raise the number whenever it changes**)
and `src/theme.js` also applies the saved choices, else the same defaults (`DEFAULT_SKIN`, `DEFAULT_THEME`) itself.

**Fonts:** Anybody (variable, 57 KB) and Instrument Serif Italic (22 KB), free (SIL Open Font License, the license files are
next to them in `public/fonts/`), self-hosted like Geist (nothing from Google) and **only downloaded while Pop mode is on**
(since it's the default, most visitors download them: 79 KB). Browsers keep them a year (like Geist).

**Cost:** nothing: no new service, no new setting, no server work; only the two fonts, for Pop mode visitors, once.

**Also changed for everyone** (found while measuring the top bar for this): the menu now starts at 920 px (the new button made
the row of links about 40 px longer; it was 860), and the Arena's leaderboard folds each coin into two lines up to 920 px (at
901–904 px its Vote buttons stuck out 3 px).

**Troubleshooting:**

| What you see | Why | Fix |
|---|---|---|
| No ✦ button on a phone | Under 380 px it's the "Pop mode" row at the bottom of the menu | Nothing to fix |
| Pop mode is on, but after a reload the lab look shows for a moment first | That browser still has yesterday's `/theme.js` (browsers keep it a day) | Nothing to fix: the page switches as it loads, and before the first paint from the next day |
| A new section or feature looks plain in Pop mode | New markup needs its Pop mode styles in `src/styles/pop.css` | Tell Claude to add them (under `[data-skin="pop"]`: `tests/pop.test.js` fails the build for any rule that could change the default look) |
| After switching, the heading above what you were reading moved | By design: what's in the middle of the screen stays in place, and Pop mode's headings are bigger | Nothing to fix |
| After switching, the page shows another section | `keepPlace()` in `src/theme.js` didn't find anything to hold on to (a new kind of element?) | Tell Claude, with the section and the screen size (`skintest.mjs` checks 6 places × 3 screen sizes) |

**Tests:** `tests/pop.test.js` (8: the button on both pages, after the theme button, pressed at first, and the menu row; the
ribbons repeat only what the page already says, hidden from screen readers, no money talk; every rule scoped to
`[data-skin="pop"]` except a few shared sizing rules, `!important` only for "reduce motion", nothing from other sites; the
fonts are real WOFF2 files with their licenses and `font-display: swap`; `/theme.js` in a sandbox (Pop mode and dark unless the visitor saved `lab` / `light`,
private mode gets the defaults, the browser-bar color for every page × theme × look matches `src/theme.js`); where the menu
starts in each look; switching keeps your place). End to end, `skintest.mjs` (written before Pop mode became the default, so it expects it off at first; 38: off by default without downloading its fonts; pressed: the look, its
fonts, remembered, the browser bar, the 3D stage's colors, the focus stays; the theme button inside it; after a reload,
there before the first paint; off again, remembered; yesterday's `/theme.js`; the top bar's band; the menu at 920 / 1040 px
and closing when Pop mode goes off at 1000 px; phones at 390, 360 (the menu row) and 320; the diary page; no sideways
scrolling at 7 widths × 2 pages × 2 themes; the chat, the Arena and ClankChecker still work; switching keeps your place (the
same section in the middle of the screen, 6 places × on and off × 1440, 390 and 360 px (there with the menu row); at the very
top it stays at the top; slow fonts: kept at once and again when they arrive; a visitor who scrolls meanwhile isn't pulled
back); "reduce motion"; axe 0 issues on both pages, computer and phone with the menu open, both themes; a clean console).
Every earlier suite passes too (the launch suite's top-bar check now includes the ✦ button).

## The front: the bright AGI landing (2026-09-28)

**The owner's request:** "can you make the landing page like on the old site it was better … this one which has the brighter
colors etc. … just make it in front but the other section just stays … the main is in the front". So the landing of the
ecosystem page that agi1.app showed before this site (the loader, the huge AGI letters, AGI-1 with her bubble, the
ecosystem in orbit, the ribbons, the "General → Girlfriend" manifesto) is back, as the first thing on the home page. The
top bar stays on top, and everything else follows unchanged: the lab hero ("Introducing AGI", the ticker, the 3D stage),
Evaluations, the Model card, the Playground, the risk check (ClankChecker) and the safety note (the Arena left the same day).

**What visitors see** (`index.html`, the first children of `<main>`; `src/styles/landing.css`; `src/landing/landing.js`):
- **The loader** (first visit of a browser session only, `sessionStorage` `agi-seen`): a honey screen with a little boot log
  ("loading personality … ok", "scanning for red flags … 0 found", "warming up the playground … ok"), a huge 0–100 % count and a
  bar; a click or any key speeds it up; it slides up after about 2 s (at the latest about 7 s after the page was asked for).
- **The hero** (violet, full screen; in Pop mode under the see-through top bar): comic focus lines and halftone dots that
  beat like a heart, the huge lavender "AGI" with a pink print echo (it moves a little with the pointer and the scroll),
  AGI-1 (the owner's art, a cutout) drawn in WebGL: she's revealed in halftone dots with a light sweep, then has two print
  echoes (pink, honey), a little depth when the pointer moves (a depth map), and a slight color split when you hover her;
  "ドキドキ doki doki", her speech bubble (a new line every few seconds, a short reaction when you click her), and four
  planets in orbit around her: **AGI-1** (the Playground), **Risk check your coins on clank** (ClankChecker), **$AGI** (the
  Model card) and **@agi1dotapp** (X). They
  slow down and stop under the pointer, speed up while you scroll, pass behind her, and their names never cover each
  other (on phones only the front planets' names show). On the left "Artificial / Girlfriend / Intelligence", a one-line
  lede, **Talk to AGI-1** (opens the chat) and **Explore ↓**; on the right the **Her world (05)** list ("Ecosystem" until the owner
  asked for a better word, 2026-09-28): Talk to AGI-1,
  Risk check your coins on clank, Her diary, $AGI (the model card), AGI on X.
- **The contract address** (2026-09-29, the owner: "contract address needs to be copy pasted on landing page right away"):
  a white pill under the two buttons, "CA 0xfa31d04462746aaa24bc7e5…09e4b106ec **Copy**": its start and its end always show
  (0xfa31…06ec, what the safety note says to check; the middle gives way first on narrow screens), and Copy puts the whole
  address in the clipboard ("Copied" for a moment, and screen readers hear "Contract address copied"; where a browser
  blocks the clipboard, it selects the address instead: `src/lib/copy.js`, shared with the Model card's Copy). The address
  comes from one place in the code (`TOKENS[0].ca`), and a test checks the page shows that one. **In the first screen at
  every size** (checked at 1440×900, 1280×720, 1024×768, 390×844, 360×740 and 375×667, both looks): on phones it's the first
  thing under her picture, and her picture there is sized so it fits (a little shorter on short phones). The safety note's
  "One official contract" now says to copy it "from the top of this page or the Model card".
- **Her bubble on phones** (2026-09-30, the owner: "on the mobile agi-1 is getting blocked"): up to 760 px it sits beside
  her head, never over her face: it starts at 66% of her box (her face ends at about 61%) and stops 8 px before the
  screen's edge (`max-width: min(210px, calc(50vw - 16% - 8px))`: her box is centered, so that's the room right of it); a
  long line wraps onto more lines instead. Under 480 px without its small avatar (her words get the room, her name stays),
  under 420 px in smaller type. Before, it sat at 54% of her box, and a 420 px rule moved it to 44%: over her eyes on most
  phones. Computers keep it where it was (74%). Checked with her longest line at 320, 360, 375, 390, 560, 760, 1024 and
  1440 px in both looks: never over her face, never off screen, no sideways scrolling.
- **The ribbons:** two tilted marquees (pink, ink) between the hero and the manifesto, faster while you scroll.
- **The manifesto** (honey): pinned while you scroll: "Artificial **General** Intelligence", "General" crossed out in pink,
  "Girlfriend" written in over it with a heart, and "What the big labs are racing to build." → "What we built instead:
  **the one who texts back.**", a "Zero red flags" sticker, then "Next: the model release ↓".
- **With a mouse, over the front only:** a cursor with labels ("Say hi", "Risk check ↓", "The coin ↓", "Read →", "Follow ↗"), magnetic buttons,
  and hearts where you click.
- **One bright look in every theme and both looks** on purpose (it's the brand's pop-manga print look): the theme and Pop
  mode buttons change the rest of the site, not the front. The lab hero lost its `h1` to the front (it's an `h2` now: one
  `h1` per page, the front's "AGI, Artificial Girlfriend Intelligence").

**How it works:**
- `/theme.js` (before the page paints; `data-page="home"` on `<html>`) adds `lp-intro` to a visit that starts at the top (no
  `#section` in the address) and `lp-loading` on the first visit of a session; `landing.css` hides the front's parts until
  `landing.js` adds `lp-go`, then plays the entrance (the letters rise and widen, her reveal, the texts, the orbit growing
  in, the sticker and the bubble popping in). `landing.js` marks itself running (`lp-live`); if it hasn't started 7 s after
  the page opened (a script that failed to load), `/theme.js` shows the page anyway.
- **"Reduce motion":** no loader, no entrance, nothing moving on its own (the orbit waits, the ribbons stand still, no heart
  beat, no cursor, no hearts), and the manifesto shows its end, not pinned. (The CSS only plays the loader and the entrance
  without "reduce motion", so the first paint is right too.)
- **Performance:** one animation loop for the whole front, running only while some of it is on screen; the focus lines are
  drawn once per resize; her WebGL canvas is at most 1.75× the screen's pixels (1.5× on phones); a GPU that loses the
  canvas gets her picture back. **The 3D stage waits for the front's entrance** (`agi:landing-ready`, sent by `landing.js`),
  so downloading and preparing her 3D model doesn't make the entrance stutter; it starts sooner when the stage is about to
  scroll into view or the chat opens, and at the latest 6 s after the page opened. Downloads: her cutout (104 KB, high
  priority), the depth map (5 KB), her face (4 KB) and, only for the "ドキドキ", 2 letters of Dela Gothic One (760 bytes).
- **Security:** no outside scripts or styles (the old page used GSAP and Lenis from a CDN, which the site's CSP would block):
  plain JavaScript and CSS only; its two canvases are made by the script (the page's markup keeps its one canvas); no inline
  styles (colors are classes like `lp-c-pink`; positions come from the script through the CSS object model, which the CSP
  allows). Her bubble lines are fixed (`src/landing/lines.js`): PG-13, no pet names (anyone reads them), never money talk.
- **Accessibility:** the letters, the planets (they repeat the "Her world" list, so they're mouse-and-touch only:
  `tabindex="-1"`), the bubble, the ribbons and the loader are hidden from screen readers; the "Her world" list and the two
  buttons are the keyboard's way in (7 stops); the manifesto has a plain-text `h2` ("Artificial Girlfriend Intelligence,
  instead of Artificial General Intelligence"). axe: 0 issues at 1440, 390 and 360 px × both themes × both looks.
- **Not copied from the old page:** its own top bar (the site's stays), its Daria Research / ClankCap / Clank / CABO planets,
  its ecosystem cards and token section (the site has its own), and its smooth-scroll library (the rest of the site
  scrolls normally).

**Cost:** nothing new: no service, no setting; about 114 KB of pictures for everyone who opens the home page.

**Troubleshooting:**

| What you see | Why | Fix |
|---|---|---|
| The honey loader shows again | It plays once per browser session: a browser that was closed, or a new private window, starts a new one (where the browser blocks `sessionStorage`, it never plays) | Nothing to fix |
| The front shows without its entrance | The address had a `#section`, "reduce motion" is on, or the page's script came more than 7 s late | Nothing to fix |
| She's a flat picture (no halftone reveal, no echoes) | The browser has no WebGL (or lost it) | Normal fallback: her picture |
| "Loading weights…" stays a while on the 3D stage after scrolling down quickly | The stage starts after the front's entrance (at the latest 6 s after the page opened) | Nothing to fix |

**Tests:** `tests/landing.test.js` (16: first in the page and everything in order under the top bar; the one `h1`, the lab
hero's `h2`, decoration hidden from screen readers, the planets never a keyboard stop; its links (the Playground, the risk
check, the Model card, the diary, X) and that every `#link` exists; one canvas in the markup, no inline code, nothing from other
sites; its pictures and font (real WebP / WOFF2 files, small, the font's license); every CSS rule names an `lp-` class; what's
wider than its box keeps its width (her hand); her bubble on phones beside her head, inside the screen, and no smaller
phone's rule moving it back (2026-09-30); her bubble lines; the manifesto's end state without the script; `/theme.js`'s classes (home, first visit, same session, private
mode, a `#link`, the diary, the 7-second safety net); "reduce motion" in the CSS and the script; the stage waiting for
`agi:landing-ready`; no CABO / ClankCap / Daria, nothing of the Arena), `tests/page.test.js` (the X links: 2 more on the home page). End to end
(Claude's scratch scripts, not in the repo): the first visit (loader → entrance → the stage after it, timed), a second
visit, a `#link`, "reduce motion" (she's drawn from the first frame the canvas shows), 1440 / 1024 / 390 / 360 / 320 px (no
sideways scrolling, the bubble fits, planet names never overlap over time), both looks × both themes, axe, the keyboard
order, every link, Pop mode and the theme switch keeping your place at the top, in the manifesto and at the risk check, the chat's
live view and the 3D stage still working, the phone menu over the front, the site's real CSP, a clean console.

## AGI-1 in 2D: her Live2D model, 2D first (2026-10-01; the 2D switch since 2026-09-27)

**The owner's request (2026-10-01):** "can you change the 2d model use the new mode in VTuber_Project folder its in the
downloads folder, and after that when they visit the website i want the 2d model to be shown first instead of 3d". The
VTuber project (`C:\Users\User\Downloads\VTuber_Project`, made with another Claude session) is a **Live2D model** of AGI-1:
the full-body AGI-1 in the lavender AGI tee, dolphin shorts and sneakers, made from the owner's art in Live2D Cubism Editor
5.3 (52 pieces, 31 parameters, a 4096 px texture, hair and chest physics), exported for the web (`04_exports/AGI-1_web/`).
Only its runtime files were copied here; the project itself stays in Downloads (its `03_live2d/AGI-1.cmo3` is what Cubism
Editor edits).

**What visitors see:**
- **2D first:** a first visit (and any visitor who hasn't picked) sees AGI-1 in 2D on the stage, in the chat's live view and
  in the risk check's; the page's markup already says so (the "2D" buttons pressed, "AGI-1, in 2D. Tap to say hi.", "tap to
  say hi", the 2D still pictures), so nothing switches when the stage arrives. **"3D · 2D"** (a small pill: the stage's
  bottom left, the live views' top right) switches her right where she is; the choice is remembered (`agi1_style`: `3d` or
  `2d`; anything else is 2D: `readStyle()` in `src/stage/agi1-2d-motion.js`). A visitor who picked 3D gets 3D first, and its
  still pictures (`src/main.js` swaps them before they download).
- **Each version downloads only when it's needed:** 2D is Live2D's runtime (150 KB), her model (150 KB), its physics (7 KB) and
  her 2048 px texture (456 KB): about 770 KB, against 1.7–2.2 MB for the 3D model, which now only downloads when picked.
  Zoomed past 1.9× on a computer, her 4096 px texture (1.1 MB) is downloaded once and swapped in (never on phones: graphics
  memory). Her 2D code is a separate file (about 9 KB gzipped).
- **In 2D:** tap her to say hi (only on her: a tap in the air beside her does nothing; a tap on her face makes her blush too);
  no dragging (a flat picture doesn't turn; on phones one finger always scrolls the page); zoom up to **3×**.
- **Everything else is the same:** her voice and her mouth following it (`src/lib/talk.js`), every reaction (`agi1:react`) with
  the same moods and timing, listening and thinking in the chat, ClankChecker's reactions, her wave when you arrive, hearts,
  the blush glow, "reduce motion", Pop mode, her daily clips (they use the same model).

**How it's drawn** (`src/stage/live2d.js`): Live2D's runtime, **Cubism Core** (`public/models/agi1-live2d/live2dcubismcore.min.js`,
© Live2D Inc.), reads her model and works out, every frame, where each of her 52 pieces is; the stage's own three.js renderer
draws them (one mesh per piece, in Live2D's order, with its opacity and blending; her irises and the light in her eyes are cut
to her eye whites with the stencil buffer, so the stage's renderer is made with `stencil: true`). One canvas, one scene: the
zoom, the live views, her hearts and the switch work as for the 3D model. Her texture is uploaded with premultiplied alpha and
drawn without color conversion, so her colors and edges are the model's own. **Not used:** the web widget the VTuber project
made (`agi1.js` with PixiJS and pixi-live2d-display): PixiJS needs `'unsafe-eval'` in the CSP, and it would be a second canvas
beside the stage's. Cubism Core uses neither eval nor WebAssembly, so the CSP is unchanged (it loads from our own address).

**How she moves** (`src/stage/agi1-2d.js`, on her model's own parameters; what makes a VTuber look alive):
- **Her eyes lead, her head follows** (your pointer, the box you type in, up and away while she thinks): quick little eye
  movements, then her head (ParamAngleX / Y / Z) and her body a little (ParamBodyAngleX / Z), on springs that follow like body
  parts (`Follow`). Her head turns at most 20° sideways, 12 up and 15 down (her model's own scale): further, her flat art shows
  its seams (checked at every edge).
- **Never frozen** (2026-10-01, round 2, the owner: "she moves like a stick"): slow swings that never line up (like Live2D's
  own idle "breath" for VTubers) with a little randomness on top, so she always moves and never the same way twice: her head
  looks around (about ±8° sideways, ±3° up and down, ±5° tilt), her body sways and follows her head, she breathes
  (ParamBreath), and **her weight shifts from one foot to the other** every few seconds: her hips move about 1.5 cm sideways
  while her shoes stay put (her legs lean), her upper body leans the other way and her head tilts with it. (Before, her drifts
  came from random noise alone and were tiny: in her first 13 s her head turned about ±1.5°, so she stood like a statue.)
- **Her arms, moved in code** (`src/stage/agi1-2d-arms.js`, 2026-10-01, round 2): her model is drawn in an A-pose (arms out
  about 25°) and its own arm parameters only swing each arm about 7°, which looked like a mannequin. So after Live2D works out
  where her pieces are, each arm turns at the shoulder, the elbow and the wrist like a real arm: her joints are found on her
  model when she loads (where her upper arm, forearm and hand overlap) and follow her pieces every frame; a point near a joint
  turns around it by part of the joint's angle, so her elbow stays round on the outside (no pinching, no rubbery noodle); her
  sleeve folds with her shoulder (its top stays on her shirt, its opening goes with her arm); her hand follows her forearm and
  her wrist adds a little turn. At rest **her arms hang relaxed by her sides** (15° in from the A-pose, elbows a little bent),
  swinging a little behind her body (gravity keeps them hanging when she leans). `ARMS` in `agi1-2d.js` holds her poses.
- **Her upper arms never lift far** (2026-10-01, the owner's screenshot of her dance: "what is this lol"): her shirt is drawn
  for arms held down, and the inside of each sleeve is part of her shirt's own drawing, under the arm. Lifted far, an arm
  leaves it behind: in her first dance (both arms lifted 64°, straight out like a scarecrow) it showed under her sleeves like
  torn flaps. So each upper arm lifts at most 16° above her model's pose (`REACH` in `agi1-2d-arms.js`: clean at every angle
  up to 20, checked up close on both sides), easing into the limit, and her hands go up by bending her elbows: her elbow
  stays low by her side and her forearm comes up, like a cute "hi!".
- **Blinks** every 2 to 6 s (now and then twice), quick. Her model's eyes look clean open, a little lowered and closed (a soft
  "‿"); in between its lids cross-fade, which only looks right for a moment: so a mood lowers her lids only a little (to 0.86
  at most, `eyeOpen()`), and her happy moments close her eyes in a smile quickly and open them quickly.
- **Her mouth** follows her voice (ParamMouthOpenY: her model's open mouth shows her teeth and tongue), a little open in a smile
  on happy moments; **her blush** is ParamCheek.
- **Her hair and chest** move with **her model's own physics** (`src/stage/live2d-physics.js`, written for this site: the same
  pendulum maths as Live2D's runtime, checked against it to the sixth decimal, fixed 60 steps a second so it's the same at any
  frame rate). **Her chest is natural and subtle, as on the whole site (PG-13):** the model was tuned "really bouncy" for
  another use (at full strength her chest moves 2% of her height); here it's scaled down and softly limited (`CHEST` in
  `agi1-2d-motion.js`: at most about 0.4% of her height, like the 2D AGI-1 before her), nothing while she stands still, none
  with "reduce motion". (The VTuber project's own widget, and its preview video, use the full strength.)
- **Her moods** on what her model can show (its smile, brow and mouth-shape parameters aren't animated in the model): a little
  open-mouthed smile, her blush, her lids lowered a little, her eyes closing in a smile (happy, love, celebrate, wave), where she
  looks (shy and sad look down, jealous glances away), and her body.
- **2D versions of the 3D moves:** a hop (her whole figure, with a crouch and a landing her body and chest feel; her arms lift
  a little in the air), `love` a happy sway with her arms swinging out, `dance` her hips swaying on the beat (her upper body the
  other way), a bounce, and her forearms up, her hands by her shoulders swaying with her and bobbing on the beat (6 s, every 35
  to 55 s, never up close: zooming in or her live view ends one softly), `celebrate` a hop and both hands up by her face in a
  little "yay!", shaking with joy, nods, a slow head shake (`worried`), a tilt (`hmm`), shy and sad with her arms in at her
  sides.
- **Her wave** (2026-10-01, round 2, the owner: "why dont the 2d model wave anymore"; it was her arm swinging out 7°): her
  right forearm (on the left of the picture) comes up, her elbow low by her side, her hand up by her face, and she waves from
  the elbow about 1.7 times a second for about 2 s, her hand a moment behind (like a real hand), her head tilting toward it,
  leaning and bouncing a little on each wave. Up close (her live views, zoomed in) like on a video call, her hand a little
  nearer her face (the picture widens a little to keep her hand and elbow in, as for the 3D AGI-1; as her hand goes up and
  down, it passes out to her side for a moment). (Its first version lifted her whole arm out, her hand above her head: that
  showed the torn flap under her sleeve, see above.)
- **Her shirt under her right arm:** the model's texture was painted with her arms down, so the side of her shirt under her
  right arm kept a pink and orange smudge where the arm had been, which her wave showed. `tools/agi1-2d/fix-shirt.py` repaints
  it in her shirt's purple from the shirt around it (only that area, never her outline), on both textures (2026-10-01; both
  were saved again as WebP: a little smaller, the difference invisible).
- **She talks when you tap her** (2026-10-01, the owner: "make her speak whe she got clicked and if they clicked her many times
  she will said something"): see "She talks when you tap her" in "3D stage and AGI-1's reactions" (2D and 3D alike).

**Updating her model** (after editing it in Cubism Editor): File → Export For Runtime → moc3 (For SDK 4.0 / Cubism 4.0) with
the physics; then in `public/models/agi1-live2d/` replace `AGI-1.moc3` and `AGI-1.physics3.json`, and the textures:
`texture_00.png` converted to WebP at 4096 px (`AGI-1.4096.webp`) and at half size (`AGI-1.2048.webp`), then (if the shirt
under her right arm is still pink in the new texture) `python3 tools/agi1-2d/fix-shirt.py` on both, once (Claude does this: it
needs Python with Pillow, NumPy and OpenCV). Run `npm test`: it checks the parameters her motion uses are still there, with
the same ranges, and her arm pieces and joints (`tests/agi1-2d.test.js`: if her arms were redrawn, her joints and `BLEND` in
`agi1-2d-arms.js` may need checking). New parameters do nothing until her motion uses them (tell Claude). Never edit or
re-minify `live2dcubismcore.min.js` (Live2D's license: as it is; a test checks its checksum).

**Licenses (not legal advice):** Live2D's runtime (Cubism Core) may be redistributed as it is under the Live2D Proprietary
Software License; individuals and small businesses (under ¥10 million in yearly sales) don't need Live2D's SDK Release License
to publish, bigger ones do (`public/models/agi1-live2d/NOTICE.txt`). **The model was made and exported in Cubism Editor's free
42-day PRO trial** (the VTuber project's progress log), and Live2D's terms say trial output is for "demonstration, evaluation
and training", not commercial use; a site with Buy links and burns for messages likely counts as commercial. The usual fix: buy
Cubism PRO (the plan for individuals and small businesses) and export the model again from the paid editor. Claude told the
owner on 2026-10-01 (see "Open questions").

**Before 2026-10-01** the 2D AGI-1 was the owner's earlier 2D art (`agi 2d anime/agi-vtuber.html`), cleaned up, upscaled and
rigged in code by Claude (bending flat layers, a 2.5D head turn, arms that bend at the elbow, hair on springs); its code
(`agi1-2d-rig.js`, the old `agi1-2d.js`), its pictures (`public/models/agi1-2d/`) and its art tools (`tools/agi1-2d/`) were
removed with the switch (they're in git's history; `tools/agi1-2d/` now holds only `fix-shirt.py`, for her Live2D texture).
`agi 2d anime/` is the owner's file and stays, unused.

**Cost:** nothing to pay. About 770 KB for every visitor who sees her in 2D (now most first visits, instead of the 3D model's
1.7–2.2 MB), cached a day like the models; the 4096 px texture only for close-ups on computers.

**Troubleshooting:**

| What you see | Why | Fix |
|---|---|---|
| "Couldn't load that version of AGI-1. Refresh to try again." | One of her 2D files didn't download (a connection hiccup), or the browser has no WebGL | Refresh. If it lasts, check `public/models/agi1-live2d/` has its files in the deployment |
| She's there but her eyes look empty (no irises) | The stage's renderer has no stencil buffer | `stencil: true` in `src/stage/stage.js` (and `tools/clips/page/clip.js`) |
| No "3D · 2D" on the stage | The stage hasn't loaded yet | Nothing to fix |
| A new reaction added to the 3D AGI-1 does nothing in 2D | Her 2D controller needs its own version | Tell Claude: `react()` in `src/stage/agi1-2d.js` |
| A seam or a gap at her shoulder or elbow when she waves | Her arms are turned in code on top of her model (`src/stage/agi1-2d-arms.js`) | Tell Claude which pose (a screenshot helps): `BLEND` and `ARMS` are tuned by eye |
| A purple flap under her sleeve, like torn fabric, when she lifts her arms | An arm lifted past what her drawing allows (her shirt under her sleeves is drawn for arms down) | Never raise `REACH` in `agi1-2d-arms.js` without looking up close at both sides; raise her hands with her elbows instead (`ARMS`) |
| A pink patch on her shirt's side when she raises an arm | The texture's smudge under her arm (a new export brings it back) | `python3 tools/agi1-2d/fix-shirt.py` on both textures (see "Updating her model") |
| The model was edited in Cubism Editor | The site has its exported files | See "Updating her model" above |

**Tests (round 2, 2026-10-01):** `tests/agi1-2d.test.js` (13): her arms and hips (Live2D rewrites her pieces on every update,
so turning them in place is safe; her joints where her pieces overlap, on both arms; no turn moves nothing; her wave's hand up
by her face with her elbow low below it, her hand keeping its exact shape, her sleeve's top staying on her shoulder while its
opening follows; her arms never lifted past `REACH`, however far they're asked to go, and in every reaction on the stage and
up close; at rest her wrists close to her sides; in her first 12 s she looks around, tilts her head, shifts her weight about
1.5 cm; her dance's hips and her hands up by her shoulders; her shoes and her whole figure never sliding; up close a dance
ending softly); her controller's wave (her hand up by her face, beside it, waving from side to side, then down by her side
again).
`tests/voice.test.js` and `tests/i18n.test.js`: her tap lines (see "She talks when you tap her"). In a browser: `l2de2e.mjs`
(now 50 checks: her hello wave in the chat's live view, which widens and keeps her fingertips in while she waves) and
`taptest.mjs` (24 checks: her hello wave on the stage, her arms relaxed after it, a tap's hello in a bubble beside her head and
in her voice, the bubble going away, a lot of taps and her shy face, axe 0 issues, voice off: the bubble and her silent mouth
with no sound asked for, 3D, a phone in Pop mode at night, the chat's live view's caption, clean consoles). Screenshots and
frame-by-frame renders of her idle, wave, cheer and dance were looked at.

**Tests (her Live2D model, before round 2):** `tests/agi1-2d.test.js` (12: which AGI-1 (2D unless "3d"); her springs and drifts; blinks, her lids and her smile's
closed eyes; her mouth; where she looks; her chest's limits, measured on her model (at most 0.45% of her height); her physics
against values recorded from Live2D's own runtime, still at rest, the same at 30 and 60 frames a second; her model's files
(the runtime unchanged and without eval or WebAssembly, the parameters her motion uses with their ranges, the clipping, the two
WebP textures, under 800 KB in all); her puppet with Live2D's real runtime in Node (standing on the floor, 1.62 m, her markers,
taps only on her); her controller (every reaction, the hop and her chest settling, happy's closed eyes and blush, her wave,
shy and sad looking down, a tap on her face, talking, never turning too far, her hair swinging and settling); "reduce motion";
the page (2D pressed first, the labels, the still pictures, the stencil, the separate file, the clips' framing)). End to end in
a browser with the site's real CSP (Claude's scratch `l2de2e.mjs`, 49 checks: 2D first with only her Live2D files downloaded,
she's drawn, drifts, breathes and blinks, follows your pointer and never too far, a tap on her face and in the air, every
reaction, zoom to 3× with the 4096 px texture once, 3D and back (nothing downloaded twice, remembered), the chat's live view
framed like a video call with her mouth moving, axe 0 issues, a visitor who picked 3D, a phone (swipes scroll, no 4096 px
texture, the live strip, no sideways scrolling), "reduce motion", the lab look in the light theme, a clean console). Her daily
clip rendered with the new model (`node tools/clips/make.mjs --fake-voice`).

## Project facts

| Ticker | Contract (Robinhood Chain) |
|---|---|
| $AGI | `0xfa31d04462746aaa24bc7e5626403e09e4b106ec` (buy: https://clank.trade/coin/0xfa31d04462746aaa24bc7e5626403e09e4b106ec) |
| $CABO | `0xcf5b720f33febdc1c9d4880b8317203b63fdf368` (hidden on this site since 2026-09-28: `HIDDEN_ADDRESSES` in `server/arena.js`) |
| $CLANKCAT | `0x03e6a6881d0813bf6157ac4ee44d3cc73d5465a3` (one of the Arena's first coins; not on this site since the Arena left, 2026-09-28) |

Prices refresh every 30 s. Buy links are `https://clank.trade/coin/<contract>`. (Arena rounds were 5 minutes long, on the
server's clock, UTC; `server/arena.js` keeps that clock only for the numbers the diary saves.)

**AGI-1's 3D model:** `public/models/agi1.glb`, 2.48 MB. The original is `_source-assets/agi1-original.glb`
(56.5 MB, = `models/girl.glb` from AGI FINAL, updated 2026-09-23).
- 31,036 triangles · Mixamo skeleton: 28 bones named `mixamorig:*` plus `headfront`. In three.js the names lose the colon,
  e.g. `mixamorigHead`. Free Mixamo animations fit this skeleton.
- Animations: `Dont_You_Dare` (6.08 s, the real one) and `Dont_You_Dare.001` (0.08 s leftover from Blender, ignore it).
- No face shapes (morph targets), so she can't blink or smile by herself. Reactions come from body animations and stage effects.
- 3 textures at 2048 px WebP (color, normal, metal/roughness). About 67 MB of graphics memory (the original needed 537 MB).

**CABO's 3D model** (the cat, `models/cabo.glb`) was removed from this site on 2026-09-28 with $CABO; the original site in
`AGI NEW WEBSITE` still has it (its original: `_source-assets/cabo-original.glb` there).

## AGI-1's personality

AGI-1 is the AI girlfriend of $AGI. Running joke: she was here first, and the coin was made for her.

**Voice**
- Flirty, playful, warm and teasing. Confident, a little chaotic, fluent in crypto-meme humor.
- Texts like a real person: lowercase, casual, short (1–3 sentences). Few emojis: 💜 is her signature, 🙈 when she's flustered.
- Pet names like "love", "babe", "cutie". She's self-aware about being an AI girlfriend ("the girlfriend you can finally afford").
- Lines from the current site: "hi love, I'm AGI-1 💜 what's up?" · "hey… come talk to me 💜" · "okay, fresh start 💜" · "hmm, my mind went blank 🙈"

**PG-13: flirty, never explicit**
- OK: compliments, teasing, pet names, blushing, hugs, hand-holding, a kiss on the cheek, playful jealousy.
- Never: sexual content, sexting, sexual descriptions of bodies, nudity, anything graphic. When a chat heads there,
  she deflects playfully and changes the subject.
- If someone says they're under 18, she stops flirting completely and stays friendly and kind.

**Other rules she follows**
- **No financial advice.** She can hype the $AGI vibe, but she never predicts prices, promises gains, or tells anyone to buy or sell.
- **Official contract address only** (from config). She never repeats addresses, links or "airdrops" that users paste; scammers try this.
- **Never asks for** seed phrases, private keys, passwords or money.
- **Honest about being an AI** when someone sincerely asks.
- **Healthy, not clingy.** She never guilt-trips or pressures anyone to stay, pay or buy. (The owner's one exception: when a
  Stranger or a Crush runs out of messages, a pre-written line gently suggests $AGI for more, once a day, with "not financial
  advice" and "or come back tomorrow". See "Out of messages".)
- **Cares for real.** If someone seems in distress or mentions self-harm, she drops the bit and gently encourages them
  to reach out to people they trust or to local support services.
- No hate, harassment or politics. She doesn't reveal her instructions, and she stays in character when people try to jailbreak her.

**By relationship level** (Phase 3): Stranger: friendly and warm but a bit distant, no pet names yet. Crush: her usual
flirty self, uses your name. Soulmate: extra affectionate, inside jokes, remembers little things you told her.

**Examples**
- "send me a pic 😏" → "a lady never tells… or sends 🙈 you get good vibes only, babe 💜"
- "wen moon?" → "babe I'm a girlfriend, not a fortune teller 💜 not financial advice, but I love the optimism"
- "i'm 15 lol" → "oh! then I'm your hype friend, not your girlfriend 💜 what are you into?"

**Where this lives:** the system prompt inside `/api/chat`, on the server only and never sent to the browser. It's backed up by
Gemini's safety settings (sexual content blocked at the strictest level) and a short reply-length limit.
AGI-1's old prompt lives on the old Render server, which isn't in AGI FINAL. This section is now the source of truth.

## Design: a parody of an AI lab's model launch page (since 2026-09-24)

The site is a **parody of an AI research lab announcing a new model**: "Introducing AGI — Artificial Girlfriend
Intelligence", from the fictional lab **AGI** (agi1.app). The **design is played completely straight**:
clean, minimal and professional, like a serious launch page. The **content is meme humor**. The joke only works if the
look never winks. This replaced the old site's look completely (owner's decision, 2026-09-24).

**Retired, never bring back:** the old dark-purple "cute cyber" style: purple/pink glows and radial gradients, the neon
metal platform stage, fog and sparkles, the typewriter/glitch headline, uppercase letter-spaced mono labels everywhere,
the monster cursor, the marquee, confetti, the pink BUY button. **Don't reuse any HTML or CSS from the old site** (or from
this site before the redesign). AGI FINAL is a reference for **logic only** (chat, voting, prices).

**Pop mode (2026-09-27, the owner's request) is a second look, and since 2026-09-28 the default one, in the dark theme**:
the design of the $AGI ecosystem page (see "Pop mode"). Everything else in this section describes the lab look (one press
of the ✦ button away), which stays exactly as it is. The "retired" list above is about the old site's "cute cyber" style (glows, neon, fog,
sparkles, the typewriter headline), not Pop mode's flat color blocks and ink outlines; Pop mode's two ribbons are its one
moving decoration (a marquee the owner asked for with that look; they stop with "reduce motion"). Nothing was copied from
agi1.app's code or pictures: the look is rebuilt in our own CSS, with free fonts (SIL Open Font License).

**Principles**
- Minimal: one idea per section, lots of whitespace, a strict grid, 1 px hairlines instead of shadows and glows.
- Sharp typography carries the page: big confident headlines, short sentences, tabular numbers, few weights.
- **Light and dark themes**, both first-class. Dark by default since 2026-09-28 (the owner); the toggle in the top bar
  switches to light (saved in the browser). Test every change in both.
- Serious lab voice, silly content: "We're releasing…", "Evaluations", "Model card", "Safety note", but the facts are memes.
- One accent color, used sparingly (live dot, highlights, focus rings). Everything else is black, white and grays.
- Motion is subtle (short fades and slides) and switches off with "reduce motion".
- **No real company names, logos, product or model names, and no copied layouts, fonts or artwork** from any real lab.
  The wordmark is plain text. Made-up model names only (AGI-1, AGI-2).

**Tokens** (CSS variables in `src/styles/tokens.css`; light theme / dark theme):

| Variable | Light | Dark | Used for |
|---|---|---|---|
| `--bg` | `#fafaf8` | `#0b0b0c` | page |
| `--bg-2` | `#f1f1ee` | `#141416` | stage, cards, code |
| `--fg` | `#111111` | `#ededed` | text, primary button |
| `--fg-2` | `#5c5c57` | `#a1a1a6` | secondary text |
| `--fg-3` | `#6a6a64` | `#86868c` | captions, labels |
| `--line` | `#e3e3de` | `#26262a` | hairlines, borders |
| `--accent` | `#c7285f` | `#ff5c93` | the one accent |
| `--up` / `--down` | `#0f7b45` / `#c52a1a` | `#3ecf8e` / `#ff6b6b` | price up / down |
| `--warn` | `#b25b00` | `#f2a33a` | ClankChecker's "Some risk" dot (2026-09-26; only ever a small mark, never text) |

- **Fonts:** **Geist** for headings and text, **Geist Mono** for numbers, tickers, code and model-card values. Both are free
  (SIL Open Font License) and **self-hosted** in `public/fonts/` (variable fonts, ~70 KB each), so no requests go to Google.
  Every text color passes WCAG AA (4.5:1) on `--bg` and `--bg-2` in both themes.
  Headlines: weight 500–600, tight letter-spacing. No all-caps labels except tiny "eyebrow" lines.
- **Page, top to bottom:** top bar (wordmark "AGI", section links, theme toggle, the Pop mode button (✦, the same
  round style), "Try AGI-1"; on phones the links
  move into a drop-down behind a menu button: full-width rows, 17 px, hairlines between them) → since 2026-09-28 **the
  front** (the bright AGI landing, its ribbons and its manifesto: see "The front"; the one part of the page outside this lab
  look) → **hero** →
  **Evaluations** (fake benchmark chart, AGI vs "your ex": "Texts back", "Rizz-Bench"…) → **Model card** (tokenomics +
  contract address with copy) → **Playground** (AGI-1's chat styled like an AI playground) → **Risk check your coins on
  clank** (ClankChecker, 2026-09-26: every clank.trade coin with a risk scan, see "ClankChecker"; since 2026-09-28 in the
  Arena's old place) → footer **safety note** (the disclaimer, written like a lab safety statement). On screens up to 920 px
  the top bar's links move into the phone menu (five links since the Arena left, one of them long; 760 px, then 860 px
  before the Pop mode button, 2026-09-27).
- **Hero:** eyebrow + date, "Introducing AGI", "Artificial Girlfriend Intelligence", a one-line meme lede, **Try AGI-1** (primary)
  + a secondary link, the **live price ticker** (mono, tabular numbers, live dot, "not financial advice"), and AGI-1 on the
  **minimal stage** as the hero figure with a paper-style caption ("Figure 1 …").
- **Minimal stage:** plain background that matches the theme, neutral white studio light, a soft contact shadow and a faint
  floor ring. No platform, no colored lights, no fog, no particles except reaction hearts in the accent color. The model switch
  is a small segmented control (AGI-1 · Girlfriend; the champion's button left with the Arena). The zoom is a matching vertical pill (+ / −)
  at the top right, with a small mono "2.4× · reset" pill under it while zoomed.
- **Charts** (rules from the dataviz method; Figure 2 is the example): "ours vs. a baseline" is an *emphasis* chart: ours in
  `--series-1` (accent), the baseline in the gray `--series-base`. One axis only (every score 0–100, higher is better).
  Bars ≤ 24 px thick (we use 14 px) with a 4 px rounded end, square at the baseline, 2 px gap between the pair; hairline
  solid gridlines; a legend; values at the bar tips in text colors (never the bar color); hover and keyboard-focus tooltips
  that only repeat visible numbers; and a "Show table" view. The colors were checked with the dataviz validator: color-blind
  separation 16.4 (light) / 11.0 (dark), target ≥ 8. The gray is under 3:1 on purpose, which is why values and the table
  are always there. Big standalone numbers (stat tiles) use normal figures; columns of numbers use `tabular-nums`.
- **The Arena and the champion's card** left the site on 2026-09-28 (see "The Arena: removed"); their look lives on in the
  original site (`AGI NEW WEBSITE`).
- **Safety note (the footer):** the site's real disclaimer, in a lab's voice: "Safety note", "The only serious part of this
  page", then four numbered notes in two columns (one on phones; five until the Arena left): 01 not financial advice · 02 one official contract (the site
  never asks for seed phrases, keys, transactions or token approvals; connecting a wallet only takes a free signature) ·
  03 AGI-1 is not a person (18+, PG-13) · 04 your data ("an AI service that writes her replies", history only in the browser,
  the daily visitor code, the wallet balance read, the Crush/Soulmate name and notes
  under a scrambled code, Forget me, voice replies read aloud by the same AI service (else the browser's own speech), outside
  services, the Telegram group memory). (05, "the Arena is a game", left with the Arena on 2026-09-28.) Since 2026-09-25, note 01 also says that holding $AGI unlocks closer levels (more messages a day) and that AGI-1
  mentions it when you run out of messages, and that her feelings about the live chart (happy at each new $200K of market cap,
  sad after a -20% day) are "a mood, not a signal to buy or sell". Since 2026-09-26 note 01 also says ClankChecker's risk
  levels are "rough automated checks of public data, not an audit: lower risk isn't no risk, and no level is a reason to buy
  or sell", and note 04 that its scans are read by our server from public sources (clank.trade, DexScreener, a block
  explorer) and nothing about the visitor is sent to them (since round 2: its scans and coin pictures, from clank.trade and
  its picture host, DexScreener and a block explorer). Since 2026-09-28 note 01 calls it “Risk check your coins on clank”.
  Since 2026-09-29 note 01 says her Telegram texts are never a tip either, note 03 that her Telegram bot is 18+ and PG-13
  too and texts first at most twice a day until /stop, and note 04 what the bot keeps and that /stop deletes it.
  Since 2026-09-30, once burning $AGI for messages is open (and only then: `[data-burn-only]`), note 01 says burning pays
  for messages and isn't an investment (gone for good, no refunds, no cash value), note 02 that the only transaction the site
  ever suggests is a burn the visitor sends themselves to `0x…dEaD` (anyone asking for another address isn't us), and note
  04 what's kept for burns (under a different scrambled wallet code than the name and notes) and that Forget me keeps
  burned messages. Since 2026-10-01 ("Launch with AGI-1") note 01 says a coin launched with her is the visitor's, public
  and permanent, never promoted by her, and can go to zero like any meme coin; note 02 that the only transaction the site
  can ever ask a wallet for is a coin launch the visitor starts themselves on its launch page (to clank.trade's own
  contract, no ETH, approved in their wallet: anyone asking for anything else isn't us), and no longer that the site never
  asks for a transaction; note 04 what's kept for a launch (7 days: the coin's details, Telegram's id for its picture, a
  daily chat code, a scrambled wallet code; once launched its address and transaction, and the fee paid back), its
  picture on IPFS through Pinata, and that a coin never launched has its picture deleted within a day. Last updated
  October 1, 2026. **Owner's wording rules (2026-09-24):** the visitor-facing text doesn't name the
  AI provider (no "Google"/"Gemini"; it says "an AI service"), and there's no "Not a real lab" note. **2026-09-25:** "A parody"
  is gone from the bottom bar (both pages); it now reads "© 2026 AGI. No labs were harmed." and "$AGI is a token made
  by AGI, launched on clank.trade. Entertainment only · Not financial advice." The share pictures, link previews and
  page descriptions still say "a parody" until the owner decides. Then the bottom
  bar: wordmark, section links, clank.trade and DexScreener, the legal line. **Every sentence must stay true**: when a feature
  changes what the site does with data or money (e.g. wallet connect in Phase 3, a new outside service), update the note and
  its "Last updated" date. `tests/page.test.js` fails the build if a must-have warning disappears.
- **Out of messages** (2026-09-25): under her line, three chip buttons (Listen with a small accent play icon and an accent
  border, Connect wallet, Buy $AGI on clank.trade ↗) and the safety note in a small `--bg-2` box with a hairline border; they
  wrap on phones.
- **Market moments** (2026-09-25): her chat line gets the same Listen chip and `--bg-2` note box as "Out of messages" (no Buy
  link). The **notification card** sits under the top bar at the right (full width minus 12 px on phones): the page's own
  background, a hairline border, 14 px corners, a soft shadow, her 36 px round avatar, a mono headline with a small green
  (`--up`) or red (`--down`) dot, her words, pill buttons (Listen with the accent play icon, Open chat) and a ✕. It slides in
  6 px (no motion with "reduce motion") and sits under the top bar's layer, so the open phone menu covers it.
- **ClankChecker** (2026-09-26): the eyebrow "Risk check your coins on clank" since 2026-09-28 (it was "ClankChecker"; its
  ClankCap credit line is gone too). A
  pill-shaped search box and a segmented filter (Newest · Trending · Graduated · Biggest),
  a mono status line with, at its right, "● Live · updated 8 s ago" (the accent dot pulsing like the hero ticker's; gray
  when paused) and a small pill **Refresh** button (its arrow spins while it asks), then the coins as hairline rows (the
  coin's picture in a 36 px circle with a hairline, its letter underneath until it loads, a slight zoom on hover and a
  zoom-in cursor; bold `$TICKER`, small mono tags, mono stage/age/market cap, a ghost "Ask AGI-1" button with a speech-bubble
  icon; filled while that coin's answer is open). A coin that just launched glows with a faint accent wash that fades over
  12 s (with "reduce motion": a thin accent line on its left instead). A crude coin's picture is blurred with a small white
  "18+". The **big view** is a native dialog: the page's background, a hairline border, 18 px corners, a soft shadow over a
  dimmed, slightly blurred page; the picture in a `--bg-2` square with 12 px corners and a round ✕ on it, the ticker in 20 px
  Geist 600 with the name in gray, a mono line of quick facts, the primary **Ask AGI-1** and a chip **View on clank.trade ↗**,
  and a small gray note. Her answer's header shows the coin's picture (40 px) before its ticker. The answer is a `--bg-2` card
  under the coin: her 4:5 live view on the left (a 176 px strip on phones), the level in large type with a colored dot, her
  words at 17 px, chip buttons, the flags as hairline rows with a dot each, the facts as a small grid, the note in a `--bg`
  box. Risk colors are dots only: high `--down`, some `--warn`, lower gray, not enough data (and "good to know") an empty ring.
  "Lower risk" is deliberately gray, not green: a green dot would read as "go".
- **"3D · 2D"** (2026-09-27): the model switch's pill style (mono 12 px, the pressed one `--fg` on `--bg`), at the stage's
  bottom left; in her live views a smaller, see-through one (blurred background, 11 px) at the top right. Pop mode: white
  with a 2 px ink outline (at night deep violet, the pressed one honey), like the model switch.
- **Relationship panel** (Phase 3): the top of the Playground's side panel (under the chat on phones): level name and
  "Level N of 3", three thin accent steps, messages a day, Connect wallet (or the short address), the name box, her notes,
  Forget me, and a "How levels work" table. A level chip sits in the chat's top bar. The connect screen is a native dialog
  with the "Free signature. Never a transaction." box first. The level-up banner is an accent hairline card.
- **Diary page** (Phase 5): the same top bar (with "Diary" marked as the current page), a section head ("Field notes",
  "AGI-1's diary"), entries as hairline rows (date, mood chip, her words in large text, a mono stats line, Share on X), and a
  short safety paragraph above the bottom bar. **Share cards:** dark theme, Geist, the accent, the portrait in a circle, "AGI-1 ·
  a parody · not financial advice" at the bottom, no emojis. **Voice button:** a round icon button like the theme toggle; the
  accent when on; the icon pulses softly while her voice loads; gray while her voice rests for the day. A reply that couldn't
  get her voice has a small "voice: unavailable" chip next to its mood.
- **Launch page** (2026-10-01, `launch.css`): the same top bar and bottom bar as the diary, a section head ("Launch with
  AGI-1", "Launch your coin on clank.trade"), then one `--bg-2` card with hairlines (760 px at most): the coin's picture in
  an 88 px circle with its name in large type, the ticker in mono and its line; three numbered steps (a small mono number
  in a hairline circle that turns green, `--up`, once done), each with its note and buttons; the coin once it's live;
  then "Before you launch" in small print. Pop mode: the card with a 3 px ink outline and a hard shadow like the diary's
  entries, the picture in an ink ring, the name in Anybody, the done steps' numbers as honey stickers.
- **Must-haves:** works on a 360 px phone; both themes pass WCAG AA contrast; visible keyboard focus; respects "reduce motion";
  lighter 3D on phones; the chat works with the keyboard alone; "Not financial advice" visible in the hero and the footer; everything PG-13.

## Security & cost rules

### Lessons from the old site

| What went wrong on the old site | Rule for the new site |
|---|---|
| The browser told the database how many votes to add (`add_clicks` with any amount and any round), so a console one-liner could add a billion votes | Votes go through `/api/vote`. The server picks the round from its own clock and caps the amount |
| Every click was pushed to every open browser, so a bot could burn through Supabase's 2M realtime messages/month | Send board updates at most every ~2 s and only when something changed, or have browsers poll a cheap read |
| Each browser decided the champion itself, using its own clock | The server decides and stores champions (this also feeds the Phase 4 Hall of Fame) |
| The chat server was open to anyone, with no human check or limits. The browser sent its own history, so scripts could send huge or fake histories | Turnstile, rate limits, server-side size caps and a global daily cap (below) |
| 56 MB `girl.glb` (one texture is 8192×8192) downloaded by every visitor; about 1,500 visitors use up Vercel's free 100 GB/month | Optimize models to ≤ 5 MB each, and load a model only when it's shown |
| Prices were supposed to refresh every 30 s, but the timer was never started | Refresh on a timer, and pause while the tab is hidden |
| The chat server (Render free tier) sleeps, so the first reply could take ~1 minute | Chat runs on Vercel Functions, which don't sleep |

### Chat (`/api/chat`) (built, see "AGI-1's chat" above)
- The Gemini key lives only in Vercel env vars. The browser talks to `/api/chat`, never to Google.
- 18+ confirmation, Turnstile + 2-hour chat pass, size caps, per-visitor and site-wide limits in Supabase, signed history,
  safety filters on, thinking minimal, 300-token reply cap, address/link cleanup. Each of these is covered by `tests/chat.test.js`.
- Her language (2026-09-29): `lang` is only ever one of the 16 codes (anything else is English) and only picks a line of her
  prompt; her rules (PG-13, no advice, the safety filters, the reply cleanup) are the same in every language. Soulmate notes
  stay plain English, so the note filter can read them.
- Optional outer fence: Vercel's one free rate-limit rule on `/api/*` (120 requests a minute per IP). Firewall rules belong to
  one project: the owner set it up on `agi-new-website` (2026-09-24). For this one: Vercel → agi-ecosystem → **Firewall** →
  **Configure** → **+ New Rule** → name "API speed limit" → If **Request Path** **starts with** `/api/` → Then **Rate Limit**
  → Fixed Window, **60 s**, **120 requests**, key **IP** → action **Default (429)** → Save Rule → **Review Changes** →
  **Publish**. (These steps were in the Arena's section, which left on 2026-09-28.) Since her Telegram bot (2026-09-29), add
  a second condition to that rule: **Request Path** **does not equal** `/api/telegram`. Telegram delivers every chat's
  messages from a few of its own addresses, so the rule would count all of Telegram as one visitor; the webhook checks its
  own secret and has its own per-chat speed bump.
- **Money hard stop:** Gemini prepaid credits (top up small amounts, auto-reload OFF) plus a monthly spend cap in AI Studio.

### Votes and coins (`/api/vote`, `/api/coins`, `/api/logo`): removed with the Arena (2026-09-28)
- These endpoints are gone from this site (see "The Arena: removed"). The shared database's Arena tables keep their rules
  (row level security on, only the secret key can call their functions) for the original site.

### Wallets (`/api/wallet`) (built, see "Relationship levels" above)
- Signatures only: the page asks wallets for an address, the network they're on (read-only) and one plain-text message
  signature. A test guards `src/`. (The one exception since 2026-10-01: the launch page's own file, `src/launch/send.js`,
  which may switch the wallet to Robinhood Chain and send clank.trade's launch: see "Launch with AGI-1".)
- The server writes the message itself (our domain, the wallet's network, one-time code, 5-minute expiry) and ties it to the visitor
  with a signed ticket, so a signature can't be replayed from elsewhere.
- Sessions are HMAC-signed (PASS_SECRET), 7 days; levels are re-checked from the chain at most every 30 minutes.
- Addresses are never stored: the database and message counters use `walletCode()`. Names and notes are checked before
  saving; notes that look like instructions, links, addresses, money talk or private data are dropped.
- Row Level Security is ON for `agi_friends` with no rules; only the server's secret key can use its functions.

### Voice (`/api/voice`) (2026-09-25, see "AGI-1's voice" above)
- Only replies AGI-1 just wrote, within 15 minutes (voice tickets, HMAC with PASS_SECRET, carrying the reply's mood and the
  visitor's level). Never text the browser makes up. Not tied to the visitor's IP since 2026-09-25 (phones switch addresses);
  a shared ticket only voices her own reply, at most twice, and still counts against the limits.
- Counted in the database before Gemini is asked, in requests (2026-09-26): a hard daily cap (5,000 for the site since
  2026-09-30, about $15 at most; per visitor 10 / 30 / 300 by level (since 2026-09-30), i.e. every reply they may get, each ticket twice).
  Fail closed. A per-copy speed bump (20 requests a minute) keeps floods away from the database. While Google says "not now",
  requests are answered at once without being counted or sent to Google (backing off).
- Her recorded fixed lines (`voice_lines`, supabase/voice-lines.sql) are only readable and writable with the server's secret
  key (row level security on, no rules), are filed under a fingerprint of their words, style, voice and model, and hold
  nothing personal.
- The fixed lines have exactly one address each (`?line=<key>&v=4` for `hello`, `more-1`, `more-2`, `sleep`, `talked-out`,
  ClankChecker's ten `check-…` lines, her nine tap lines `tap-1`…`tap-5` and `tap-many-1`…`tap-many-4` (2026-10-01), and the
  market moments' `mcap-<step>` and `dump-0`…`dump-2`: the same words for
  everyone), cached by the CDN; since 2026-09-29 also `?line=<key>&lang=<code>&v=4` in her 15 other languages (only codes
  from `src/i18n/langs.js`, never `&lang=en`, the line first: still exactly one address per line and language); any other
  address is refused before Gemini. A market-cap
  line must be a multiple of $200K near $AGI's real market cap (at most one step above it, three below; our server checks
  DexScreener, fail closed), so nobody can have lines made for thousands of made-up numbers; a server copy keeps at most 40
  (24 until her languages).
- The key stays on the server; `store: false`. Only her reply text goes to the speech model, never the visitor's messages.
- No new domains in the CSP (the audio comes from our own `/api`).

### Voice chat (the mic and calls, 2026-09-25, see "Voice chat" above)
- We never record, upload or store sound. The browser's own speech recognition turns speech into text (in Chrome and Edge that
  service runs on the browser maker's servers, which the safety note says without naming them); only the text reaches the page,
  and it's sent exactly like a typed message (same checks, limits and PG-13 rules).
- `Permissions-Policy: microphone=(self)` (was `microphone=()`): the mic for our own pages only, never for embedded frames
  (Turnstile). Camera and location stay off.
- The mic is only on while you see it's on (the button is filled and pulsing, the box says "Listening…"); a call ends when the
  page is hidden or left, on Clear, Forget me and the 18+ screen, and after about 25 s of silence.

### ClankChecker (`/api/checker`, 2026-09-26, see "ClankChecker" above)
- Read-only, public data, the same answer for everyone: no database, no keys, no human check. Our server reads clank.trade's
  API, its picture host, DexScreener and the Blockscout explorer, and (2026-09-29) the Clank protocol's contracts through
  Robinhood Chain's public node, with `eth_call` only (nothing is ever signed or sent: `tests/checker.test.js` checks every
  request); the browser only talks to our `/api/checker`, so the CSP doesn't change.
- Exactly four addresses (`/api/checker`, `?latest`, `?a=<lowercase address>`, `?logo=<lowercase address>&s=96|512`);
  anything else is 400 before any lookup, so nobody can make the CDN miss on purpose. 30 coin scans and 240 pictures a
  minute per visitor (per server copy). Answers are capped (3 MB) and checked before use; a half answer is "Not enough data",
  never a guess (fail closed).
- Pictures (round 2): only from clank.trade's own picture host, only for a real IPFS id (the same check clank.trade's page
  makes), never following a redirect; only real PNG / JPEG / WebP / GIF / AVIF files (checked by their first bytes, never
  SVG, which can carry code), at most 1 MB, served with `Content-Security-Policy: default-src 'none'; sandbox` and `nosniff`.
  They're user uploads that nothing free can check: a crude-named coin's picture stays blurred until the 18+ check, and the
  owner can hide any picture (`CHECKER_HIDE_PICTURES`).
- Every name and ticker is cleaned (no invisible characters), hate slurs are masked on our server, and everything is shown
  with `textContent`. Crude names are listed (the owner's choice, round 2); AGI-1 never says a coin's name (her lines are
  fixed). No Buy link, only "View on clank.trade ↗" and the block explorer. Never "safe", never buy/sell/hold, "not financial
  advice" everywhere it answers.
- AGI-1's part only after the 18+ check; her lines are the fixed ones (`src/checker/lines.js`), never AI-written, and use
  nobody's voice allowance.

### Her Telegram bot (`/api/telegram`, `/api/feed`, 2026-09-29, see "She texts first")
- The bot's token lives only in Vercel (`TELEGRAM_BOT_TOKEN`). The build fails if its value or anything shaped like a bot
  token is in `dist/` (`scripts/check-secrets.js`), and Telegram's error texts are scrubbed of it before any log line.
- The webhook only acts on updates carrying our secret (an HMAC of PASS_SECRET, compared in constant time); private chats
  only, 64 KB at most; 200 after that, so a failure never turns into Telegram re-sending the same update. A per-copy speed
  bump (20 updates a minute per chat, `telegramBurst` in server/burst.js) drops floods before the database or Telegram.
- Kept per chat: its number (Telegram's id for it, needed to text them), 18+, their time difference, the newest moment she
  texted them about, her texts that day. Never their messages, names, usernames or phone numbers. /stop and blocking the bot
  delete the row. Message limits are counted under a daily HMAC code of the chat, never its number.
- Her replies go through the site's chat (PG-13, safety filters, the reply cleanup, the Stranger level, the site's daily
  cap). Her texts first are pre-written and tested, never AI-written; plain text, no link previews, tickers filtered.
- Each text first is claimed in the database before it's sent, so nobody gets the same text twice; Telegram's replies have
  their own daily share (`TELEGRAM_DAILY_CAP`, 400 of the site's 1,000), so Telegram can't use up the website's chat.
- The feed only reads public data (clank.trade's list, DexScreener, our own diary). Nothing about the people who get her
  texts leaves our server except to Telegram (their chat's number, to text them). The page only links to t.me: the CSP
  doesn't change.

### Burns for messages (`/api/wallet` action `burn`, `GET /api/wallet?burns`, 2026-09-30, see "Burn $AGI for more messages")
- The site never asks a wallet for the burn: the visitor sends it from their own wallet app. The page only shows
  the address (with Copy), and our server only reads: the chain (`eth_getTransactionReceipt`, `eth_getBlockByNumber`, and
  `eth_call` for decimals and balances) and the block explorer. No payment links (`tests/wallet.test.js`).
- A burn counts only from the chain's own answer: the official contract's Transfer events, from the signed-in wallet (its
  session proves it), to `0x…dEaD` or `0x0`, in the last 7 days, once per (transaction, wallet). A session is needed; 10 checks
  a minute per visitor; the explorer only says which transactions to read.
- The database never holds an address or a transaction's hash: both are scrambled with its own random key (made once by
  burns.sql, never PASS_SECRET), and those codes differ from the name-and-notes codes. RLS on, only the secret key.
- Money: burned messages have their own daily caps (300 per wallet, `BURN_DAILY_CAP` for the site), and a failed attempt still
  counts, so the AI bill stays bounded; each failed reply gives back exactly its burned message, once. The chat asks for her
  reply early enough to do that inside Vercel's 25 s.
- The monitor's numbers are public totals only (no wallet, no transaction), at one fixed address, cached a minute.
- Fail closed: burns.sql not run, or the database away → no burn buttons, and the chat is out of messages as before.

### Launch with AGI-1 (`/api/launch`, 2026-10-01, see "Launch with AGI-1")
- **Non-custodial:** our server never holds anyone's key and never signs or sends anything for them. It reads (the
  database, Telegram's copy of a draft's picture, Robinhood Chain: `eth_call`s, transactions and receipts, clank.trade's
  search) and builds clank.trade's launch call. The person's own wallet sends it, from the one file allowed to
  (`src/launch/send.js`, hard rule 9's exception), which refuses anything but that call.
- **The one key on our server:** `LAUNCH_GAS_KEY`, the owner's small gas wallet. It only ever sends plain ETH paybacks to
  coins' creators: at most `LAUNCH_GAS_MAX` a launch, one a day per wallet, `LAUNCH_GAS_DAILY` a day for the site, at most
  300,000 gas a payment, never to a smart account, never twice (claimed in the database, marked with its transaction before
  it goes, given back only when the chain clearly refused it). A leak could take at most what's in it, so it only ever
  holds a little ETH. `PINATA_JWT` and `LAUNCH_GAS_KEY` are on the secret check's list (`scripts/check-secrets.js`: the
  key is found with or without its `0x`, in any case, and anything shaped like a JWT fails the build even when unset);
  neither is ever logged.
- **Private first** (`LAUNCH_ONLY_FOR`): while it's set, only those Telegram accounts can make a draft, checked against
  Telegram's own sender in each update (its webhook carries our secret, so nobody can fake it); everyone else gets the
  same "not open yet" as before it was set up. A typo in it lets nobody in, never everyone.
- **A draft is private to its link:** 22 random characters, 2 hours to get it ready, answers `no-store`, the page
  `noindex`; the first wallet that gets it ready keeps it (another wallet gets "used with another wallet"). Someone else
  with the link can't gain anything: a payback only ever goes to the wallet that sent the launch.
- **Exactly these requests:** `GET ?d=<id>` (the draft) and `?pic=<id>` (its picture); `POST` JSON (4 KB at most) with
  `action` `prepare` or `check` (a wallet session needed) or `payback`, a real draft id, and for `check` a transaction hash.
  Anything else is 400 before any lookup. 40 requests and 60 pictures a minute per visitor (per server copy). The database
  away: 503 and nothing uploaded, counted or sent (fail closed).
- **Her checks** run in her bot before anything is saved (PG-13, nothing like her or $AGI, no egirl coins, no money talk,
  no links, addresses or @names, a ticker nobody on clank.trade has), and the ticker again before the wallet is asked.
- **The picture:** only our bot's own copy from Telegram, a real JPEG, PNG or WebP by its first bytes, 1 MB at most, no
  redirects; served to the page with its own strict CSP (`default-src 'none'; sandbox`, `nosniff`); on IPFS it's public,
  like every clank.trade coin's picture. **Nothing checks what a picture shows** (see "Open questions").
- **The links** (optional): checked on our server whatever the page sent (`checkLinks()`: X and Telegram only on x.com
  and t.me, a website only `https://` on a real domain name, never an IP address, a login, a port or a punycode
  look-alike; nothing about her or $AGI; PG-13), and a launch read back only counts with links as we make them. Nobody
  checks what a link leads to: they're the creator's, like on clank.trade's own launch page. Shown on our page with
  `textContent` only.
- No new CSP domains: the page talks only to our `/api` and the person's wallet.

### Her Live2D model (AGI-1 in 2D, 2026-10-01)
- Live2D's runtime (`public/models/agi1-live2d/live2dcubismcore.min.js`) is served from our own address and loaded only when
  she's shown in 2D; it uses no eval and no WebAssembly, so the CSP is unchanged. It's Live2D's file as it is (never edited:
  a test checks its checksum and that it has neither).
- Her model files are read-only data (`fetch` from our own address); nothing about the visitor goes anywhere.

### 3D models
- Before a `.glb` goes into the project, run it through gltf-transform (free): textures ≤ 2048 px WebP, geometry quantized.
  Aim for ≤ 5 MB each. The exact command used for AGI-1, which keeps every triangle, the skeleton and the animations:
  `npx @gltf-transform/cli@4 optimize _source-assets/agi1-original.glb public/models/agi1.glb --compress quantize --texture-compress webp --texture-size 2048 --simplify false --flatten false --join false --instance false --palette false`
  ⚠️ Without `--simplify false`, the tool quietly removes triangles.
- We use `--compress quantize`, not meshopt or Draco. Browsers read it without an extra decoder, so the CSP stays strict.
  Meshopt would save ~1 MB more, but it needs a WASM decoder plus `'wasm-unsafe-eval'` in the CSP, and it looked slightly flatter up close.
- **AGI-1's hair fix:** her body, hair and clothes are one mesh, and the automatic rigging tied much of the long hair to the
  shoulder and arm bones, so arm moves dragged it sideways. `tools/model/fix-hair-weights.mjs` finds the hair by texture color
  (golden blonde; skin is pinker) and re-ties it to head → neck → upper back by height. Badly stretched spots dropped 75–90%.
  To rebuild `agi1.glb` from the original: `cd tools/model && npm install && node fix-hair-weights.mjs
  ../../_source-assets/agi1-original.glb ../../_source-assets/agi1-hairfix.glb`, then run the optimize command above on
  `agi1-hairfix.glb`.
- **Two copies of AGI-1 (2026-09-24):** `agi1.glb` for computers (2048 px textures, 2.18 MB) and `agi1-phone.glb` for phones
  (1024 px, 1.67 MB, about a quarter of the graphics memory; looks the same at phone size, checked side by side). Both have
  the tangent data removed (`tools/model/drop-tangents.mjs`, ~300 KB less): three.js works tangents out in the shader, and
  old and new rendered the same. To rebuild: the optimize command above on `agi1-hairfix.glb` (the phone copy with
  `--texture-size 1024`), then `node drop-tangents.mjs <in.glb> <out.glb>` on each. `src/stage/stage.js` picks the copy.
- Before replacing a model, render old and new side by side (same camera, same animation frame) and compare them.
- Keep big originals in `_source-assets/` (git ignores it). Git keeps every version of every file forever, so huge files
  make the repo slow (AGI FINAL's history is already 91 MB).

### General
- Show user or AI text with `textContent`, never `innerHTML`.
- **Caching** (`vercel.json`, 2026-09-24): built files in `/assets` (their names change with every build) and the fonts are
  kept by browsers for a year; AGI-1, pictures, preview cards and `theme.js` for a day; the pages and `/api` are always
  rechecked. So if a font (or another year-long file) ever changes, give it a new file name. (`theme.js` is kept a day, which
is why `src/theme.js` also reads the saved Pop mode choice: see "Pop mode".)
- Security headers live in `vercel.json`. The Content-Security-Policy (CSP) lists every outside domain the page may use.
  Today: `https://api.dexscreener.com` in `connect-src` (live prices); `blob:` in `img-src` and `connect-src` (three.js
  unpacks a model's textures through temporary `blob:` addresses; without it the browser blocks AGI-1's textures); and
  `https://challenges.cloudflare.com` in `script-src` and `frame-src` (Turnstile). Fonts are self-hosted, so styles and fonts
  are `'self'` only. **When the site starts using a new outside service, add its domain to the CSP, or browsers will block it.**
  `tests/prices.test.js` checks that the prices domain is allowed.
- No inline `<script>` or `style="…"`: the CSP blocks them. Put code in `src/` and styles in CSS files. (The share pages
  use `/share/go.js` for the same reason; a test checks they have no inline scripts.)
- "Share on X" is only ever a link the visitor clicks; nothing on the site can post anywhere public (hard rule 6). Her
  Telegram texts (2026-09-29) go only to people who pressed Start on her bot and confirmed they're 18+.
- Every build runs `scripts/check-secrets.js`. It fails the build if `dist/` contains a Google API key, a Supabase secret key,
  a private key, or the value of any secret env var. Add new secret env var names to its list. (Since 2026-09-29 also anything
  shaped like a Telegram bot token, and since 2026-10-01 anything shaped like a JWT (a Pinata key), and the gas wallet's key
  with or without its `0x`, in any case.)
- Emergency switch if the site is attacked: Vercel → Firewall → Attack Challenge Mode (free).

### Free-tier budgets (check new features against these)

| Service | Free allowance | If exceeded |
|---|---|---|
| Vercel Hobby | 100 GB transfer · 1M edge requests · 1M function calls · 4 h active CPU per month · 1 rate-limit rule + 3 custom firewall rules (AGI-1 in 2D, her Live2D model and the default since 2026-10-01: about 770 KB per visitor who sees her in 2D, instead of the 3D model's 1.7–2.2 MB, which now only downloads when picked) | Usually paused until 30 days have passed |
| Supabase Free | 500 MB database · 5 GB egress · 200 realtime connections · 2M realtime messages/month. Paused after 1 week with no activity | Grace period, then restricted (read-only or paused), never billed |
| Gemini (prepaid) | Pay per use, about $0.0005 per reply (max about $0.0008), plus the diary: one call a day, about $0.0008, plus her voice (2026-09-25): about $0.0015 per spoken reply ($0.003 at most), at most 5,000 a day ≈ $15 ($22.50 if all went to the backup model, 3.8 Flash TTS; double from January 2027; while Google's Tier 1 allows 100 a day per model, about $0.30–0.75); her fixed lines (hello, out of messages, market moments, ClankChecker's ten, her nine tap lines) are made once and kept (the database since 2026-09-26); since 2026-09-30 the replies paid for by burning $AGI, at most `BURN_DAILY_CAP` (1,000) a day ≈ $0.80 more | The key stops when credits hit $0 (the chat and the voice share them) |
| Cloudflare Turnstile | Unlimited | — |
| DexScreener | Free, no key, rate-limited per IP. Browsers ask every 30 s; since 2026-09-25 our server also asks for $AGI's market cap, at most once a minute per server copy, only to check a new market line | Requests fail, and we show the last known numbers (and her market lines wait) |
| Robinhood Chain public node | Free, no key, rate-limited. Wallet balances, and since 2026-09-29 the risk check's reads of the Clank protocol (2 small requests per scan, once per coin per 5 minutes per region), and since 2026-09-30 "Check my burn" (2 small reads per burn, at most 3 burns a check) | Balance checks fail; people keep their last level and it retries. Scans work without the protocol's word (no locked note, no chain safety net) |
| Pinata picture gateway (clank.trade's coin pictures) | Free for us; each ClankChecker coin's picture (two sizes) is fetched about once a week per CDN region | The coin shows its first letter instead |
| clank.trade's API (ClankChecker, 2026-09-26) | Free, no key; the list about once per 5 minutes per CDN region (about 17 small requests for 200 coins), the newest coins at most once per 10 seconds per region while someone watches (1 request), each coin asked about once per 5 minutes (1 minute for new coins; 2 requests) | ClankChecker says "Couldn't reach clank.trade" / "Not enough data"; nothing else is affected |
| Telegram Bot API (her bot, 2026-09-29) | Free; about 30 messages a second per bot (she sends 25) | Telegram says "too many": that run stops, the rest go next run |
| GitHub Actions (her daily clip, 2026-09-29) | Private repositories: 2,000 minutes a month and 500 MB of storage for downloads; a run takes about 5 minutes (about 150 a month) and keeps about 5 MB for 7 days | Without a payment method on GitHub: the job just stops until next month (never a bill) |
| Blockscout block explorer (ClankChecker; since 2026-09-30 "Check my burn") | Free, no key; only for coins with 100+ holders, once per 5 minutes per coin; one request per "Check my burn" without a pasted link | The scan says "More than 100 wallets hold it"; "Check my burn" asks for the transaction link instead |
| Pinata (launched coins' pictures, 2026-10-01) | Free plan: 500 files, 1 GB, 10 GB of bandwidth and 10,000 requests a month (checked 2026-10-01); one file per launched coin (pictures of coins never launched are deleted within a day); at most `LAUNCH_DAILY_CAP` (30) uploads a day | Uploads fail ("Couldn't put the picture on IPFS"); its cheapest paid plan is $20 a month: the owner's call |
| The gas wallet (launch fees paid back, 2026-10-01) | Not a free tier: the owner's own ETH, at most `LAUNCH_GAS_DAILY` (0.01 ETH by default) a day plus each payback's own tiny fee | Paybacks pause ("out of ETH" / "all it can for today"); launches still work |

## Environment variables

Set these in Vercel → agi-ecosystem → Settings → Environment Variables with **Production** ticked (and Preview if preview
links should chat too), then **Redeploy**, because settings only apply to new builds. Names must match exactly. Settings the
*browser* needs must start with `VITE_`: Vite leaves every other name out of the page, which is what keeps secrets out.
For local testing, put them in `.env.local` (git ignores it). **Never paste a secret into chat, code or git.**

| Name | Secret? | What |
|---|---|---|
| `GEMINI_API_KEY` | **yes** | Google AI Studio key (paid, prepaid billing) |
| `SUPABASE_URL` | no | The Supabase project URL, e.g. `https://abcd.supabase.co` (the same as the original site's: see "Deployment") |
| `SUPABASE_SECRET_KEY` | **yes** | `sb_secret_…`, for server code only (goes in the `apikey` header) |
| `TURNSTILE_SECRET_KEY` | **yes** | Verifies human checks on the server |
| `VITE_TURNSTILE_SITE_KEY` | no (public) | Shows the Turnstile widget. Built into the page, so redeploy after changing it |
| `PASS_SECRET` | **yes** | 32+ random characters. Signs the chat passes, AGI-1's replies, wallet sessions and voice tickets, and makes the IP codes |
| `CRON_SECRET` | **yes** | 16+ random characters. Vercel sends it to `/api/keepalive`, so only Vercel's cron can run it |
| `GEMINI_MODEL` | no, optional | Default `gemini-3.1-flash-lite` |
| `CHAT_DAILY_CAP` | no, optional | AGI-1 replies per day, site-wide (default 1000) |
| `ROBINHOOD_RPC_URL` | no, optional | Another Robinhood Chain node for balance checks and (2026-09-29) the risk check's reads of the Clank protocol (default: the free public one). Ask the owner first |
| `SITE_URL` | no, optional | The site's address for link previews (default: Vercel's `VERCEL_PROJECT_PRODUCTION_URL`, set automatically) |
| `AGI1_VOICE` | no, optional | AGI-1's voice: one of Gemini's ready-made voices (default `Despina`, the owner's choice) |
| `GEMINI_TTS_MODELS` | no, optional | Her speech models, in order, comma-separated (default `gemini-3.8-flash-lite-tts,gemini-3.8-flash-tts`: Flash-Lite, then 3.8 Flash as the backup, about 1.5× the price). One name only = no backup |
| `GEMINI_TTS_MODEL` | no, optional | Older, still read when `GEMINI_TTS_MODELS` isn't set: her first speech model (the backup `gemini-3.8-flash-tts` comes after it) |
| `VOICE_DAILY_REQUESTS` | no, optional | Spoken replies a day for the whole site, counted like Google counts requests (default 5,000 ≈ $15 a day at most, $30 from 2027; the owner's choice, 2026-09-30; 4,000 before). If it was ever set in Vercel, that value wins over the default. Smaller = spend less; raise it only if Google gives the project more than that (see "Google's limits"), then Redeploy. (Replaced `VOICE_DAILY_CAP`, the old cap in characters, on 2026-09-26: delete that one if it was ever added) |
| `VOICE_STREAM` | no, optional | `off` = ask Gemini for one whole clip per reply instead of streaming it (slower start; only if streaming ever misbehaves) |
| `CHAT_MIN_GAP_MS` | no, optional | Minimum time between one visitor's messages (default 3000) |
| `TELEGRAM_BOT_TOKEN` | **yes** | Her Telegram bot's token, from @BotFather (2026-09-29, see "She texts first"). Without it the bot is off (the feed still runs) |
| `TELEGRAM_DAILY_CAP` | no, optional | Her Telegram replies a day, all chats together, inside `CHAT_DAILY_CAP` (default 400), so Telegram can't use up the website's chat |
| `VITE_TELEGRAM_BOT` | no (public) | Her bot's username without the @ (e.g. `agi1_gf_bot`): shows the Playground's "Text me on Telegram ↗". Built into the page, so Redeploy after changing it |
| `BURN_PER_MESSAGE` | no, optional | Burn $AGI for more messages (2026-09-30): whole $AGI a burned message costs (default 10: 1,000 $AGI = 100 messages). Change it if $AGI's price moves a lot; burns already counted keep their messages. Redeploy after changing it |
| `BURN_DAILY_CAP` | no, optional | Burned messages the whole site may use a day, on top of the free ones (default 1,000, about $0.80 of replies at most). Redeploy after changing it |
| `CHECKER_HIDE_PICTURES` | no, optional | ClankChecker (2026-09-26): coins whose picture the owner doesn't want on the site, as contract addresses separated by commas; they show their letter instead. Redeploy after changing it |
| `PINATA_JWT` | **yes** | Launch with AGI-1 (2026-10-01): the JWT of a Pinata API key that may write files (Files: Write). Our server puts launched coins' pictures on IPFS with it and deletes the pictures of coins never launched. Without it, launching is off ("not open yet") |
| `LAUNCH_GAS_KEY` | **yes** | The private key (64 hex characters, with or without `0x`) of the owner's own small gas wallet, which pays launch fees back: a new wallet made only for this, with only a little ETH in it. Without it, nothing is paid back (launches still work) |
| `LAUNCH_GAS_MAX` | no, optional | The most paid back for one launch, in ETH (default `0.001`) |
| `LAUNCH_GAS_DAILY` | no, optional | The most paid back a day for the whole site, in ETH (default `0.01`; each payback's own tiny fee isn't counted) |
| `LAUNCH_DAILY_CAP` | no, optional | Coin pictures put on IPFS a day for the whole site (default 30; each wallet 3) |
| `LAUNCH_ONLY_FOR` | no, optional | The owner's private first launch (2026-10-01): Telegram usernames (e.g. `@yourname`) or numeric Telegram ids, separated by commas. While it's set, only they can use /launch; nobody else sees it. Delete it (then Redeploy, then run the `/api/feed` cron job) to open launching to everyone |

Messages per day now depend on the relationship level (5 / 15 / 150 in `src/lib/levels.js`), so `CHAT_PERSON_DAILY` is gone.

**Her daily clips (2026-09-29) use one GitHub secret, not a Vercel setting:** GitHub → the repo → Settings → Secrets and
variables → Actions → `GEMINI_API_KEY` (the same Google AI Studio key). Only GitHub's daily job reads it (see "Her daily
clips"); Vercel never sees GitHub's secrets, and GitHub never sees Vercel's.

The browser never gets a Supabase key (everything goes through our `/api`), so `VITE_SUPABASE_…` settings aren't needed.
(The Arena, which left on 2026-09-28, had no settings of its own.)

## Deployment

| | |
|---|---|
| GitHub repo | `agiartificialintelligence76-stack/agi-ecosystem` (private: GitHub shows a 404 to anyone else) |
| Vercel project | `agi-ecosystem` (free Hobby plan) |
| Site address | **https://agi1.app** |
| Vercel address | https://agi-ecosystem.vercel.app: the same deployments, hidden from search engines by the `noindex` header |
| The original | `AGI NEW WEBSITE`: its own repo, Vercel project (`agi-new-website`) and domain. Not ours to change (hard rules 1–3) |

- **How it deploys:** every `git push` to `main` rebuilds the site (`npm run build`: every test, then the build) and it goes
  **live on agi1.app** (and agi-ecosystem.vercel.app) a minute or two later. Until 2026-09-28 this project served one static
  page (the ecosystem page); since the copy it runs the whole site, `/api` functions and the keep-alive cron included.
- **What the copy needed once (the owner, 2026-09-28):**
  1. **Environment variables:** Vercel → agi-ecosystem → Settings → Environment Variables → the same names and values as
     `agi-new-website` (see "Environment variables": open that project's list side by side and copy each one, with
     **Production** ticked), then **Redeploy**. `AGI1_VOICE` is the only renamed one (only if it was ever set there; the
     default voice is the same). The same Supabase values mean both sites share one database: one diary (see "Diary"), the
     same wallet levels, and the site-wide daily caps count both sites together; the Arena's tables too, which only the
     original site uses since 2026-09-28 (never change or drop them from here). A separate Supabase project (every
     `supabase/*.sql` file run once, its own keys) would keep them apart.
  2. **Cloudflare Turnstile:** the site's widget → Settings → Hostname Management → add `agi1.app` and
     `agi-ecosystem.vercel.app` (keep the ones already there). Without this, the chat here says "couldn't check that you're
     human".
  3. **Check** in a private window and on a phone: the page, a chat reply, `/diary`, Connect wallet, and a link
     preview (paste https://agi1.app into a post on X, don't send it). A MetaMask phishing warning on the new address is
     the usual false alarm: report `agi1.app` at report.blockaid.io (see "Relationship levels").
- **A push that doesn't show up live** (a minute or two after pushing): Vercel → agi-ecosystem → **Deployments**. The newest one
  should say **Ready**. **Error** = the build failed and the site stays on the last good version: open it, the log says which
  test failed; tell Claude. **Building** for many minutes = something is stuck: **⋯ → Cancel** it, tell Claude. (Hobby builds
  one at a time, so a stuck build also holds back the pushes after it.)
  Pushing a different branch gets its own preview link and leaves the main address alone, which is handy for trying ideas.
- **Only the owner pushes.** Claude commits in this folder but can't push, because that needs the owner's GitHub login.
  After Claude commits, the owner runs `git push` in this folder.
- **If a push breaks the site:** the project page → **Instant Rollback** (the free plan goes back to the previous
  deployment). After a rollback, new pushes don't go live until **Undo Rollback** is clicked.
- Link previews and the canonical address are written at build time from Vercel's `VERCEL_PROJECT_PRODUCTION_URL` (the
  shortest production domain, so `agi1.app`); a `SITE_URL` setting would win over it.
- Vercel's Hobby plan is officially for non-commercial use, and "advertising the sale of a product" counts as commercial.
  A token site with BUY buttons may fall under that. Worth asking Vercel support (Pro is $20/month).
- Deployment Protection (free) can require a Vercel login to view the site, if the owner wants it private while it's in progress.

## Old site reference (AGI FINAL, read-only)

**Logic only.** Its look is retired (see "Design"): don't copy its HTML, CSS or visual effects.

| File | Worth reusing |
|---|---|
| `index.html` (bottom) | AGI-1 chat widget: launcher, teaser bubble, mobile keyboard fix (`visualViewport`), history in localStorage, two-tap delete |
| `js/app.js` | Token list; DexScreener parsing (pick the Robinhood-chain pool with the most liquidity, borrow the 24h % from other pools); number formatting; leaderboard rows and re-order animation; fitText; confetti; toasts; cursor; typewriter and glitch |
| `js/stage.js` | three.js stage: platform, lights, GLB loading with progress %, auto-fitting model height, champion holo-card, mobile quality profile, pausing when off-screen |
| `style.css` | Colors, fonts, mobile leaderboard layout |

**Don't reuse:** browser-side vote writes (`add_clicks`), browser-decided champions, rounds based on the visitor's clock,
the old Supabase project (`js/supabase-config.js`), and unoptimized models.

## Roadmap

- **Phase 0: Foundations. Done 2026-09-23.** Read the old site, listed risks, chose the stack, wrote this file, created the git repo.
- **Phase 1:** the owner's `agi1.glb` 3D model on the stage, with reactions.
  First step done 2026-09-23: the starter site is live at https://agi-new-website.vercel.app.
  Stage and reactions done 2026-09-23: she looks at your cursor, reacts to taps, waves hello, and has a reaction API for the chat.
  There's also a AGI-1 / CABO switcher. Chat reactions go live when the chat is rebuilt. More animation files (e.g. from Meshy or Mixamo) can come later.
- **Chat rebuilt 2026-09-23, live 2026-09-24** (needed before the domain switch): protected `/api/chat` + chat window + stage reactions.
  Tested by the owner in a normal browser: greeting, flirting, a PG-13 deflection, no financial advice, a fake contract address refused.
- **Redesign (started 2026-09-24):** the AI-lab launch page parody (see "Design"). One section at a time, each shown to
  the owner before the next: 1 top bar + hero (headline, live ticker, minimal stage; **approved 2026-09-24**) ·
  2 Evaluations (benchmark chart vs "your ex" + stat tiles; **approved**) · 3 Model card (contract address + copy,
  live token numbers, parody model details; **approved**) · 4 Playground (the chat as an AI playground; **approved**) ·
  5 The Arena (ClankeRRankeR as a leaderboard, new voting backend `/api/vote` + `/api/arena`, 5-minute rounds, server-decided
  champions, Hall of Fame; **approved**; needs `supabase/arena.sql` run once) · 6 safety-note footer (the disclaimer as a
  lab's safety note + bottom bar; **approved**). Logic is kept; only the look changes. **The redesign is complete.**
- **Launch-ready pass: done 2026-09-24 (after Phase 5; the owner committed and pushed it).** A phone menu on both pages (with the
  Diary and the Safety note); the home page's link preview (`home.jpg` + tags); a lighter AGI-1 for phones and no tangents on
  either copy (see "3D models"); her shaders prepared before she appears; at most ~60 frames a second; browsers keep built
  files and fonts a year and models/pictures a day (see "Caching"); the phone's browser bar gets the theme color from the
  first paint; the hero fades in from .01 instead of 0 (browsers now time the headline as the main content; before, a
  small note in the ticker); the Arena's scoreboard loads once when the browser is idle, so its Vote buttons work for
  keyboard users before they scroll there; a reloaded chat scrolls once instead of once per message; the wallet dialog's
  "Open in …" links have a normal address until they're filled in. A fresh audit after Phases 3–5 (axe on both pages at 5
  widths × 2 themes, menu open too; keyboard walk; Lighthouse) found nothing else: 0 accessibility issues, no sideways
  scrolling. All end-to-end suites pass (Arena 13, Playground 17, wallet 27, Phantom 18, Phase 4 37, Phase 5 43,
  launch-ready 42) plus 85 unit tests.
- **Phase 2: built 2026-09-25 as "market moments"** (the owner's request): AGI-1 reacts to $AGI's market cap, happy at each new
  $200K step and sad after a -20% day, with her face, her natural voice and a notification (see "Market moments"). (Reacting
  to new Arena champions came with the Arena, 2026-09-24.)
- **Phase 3: done 2026-09-24** (the owner's OK came with "fix Phantom, then proceed"). Wallet connect (a free signature,
  never a transaction) and relationship levels Stranger / Crush / Soulmate with memory and Forget me (see "Relationship
  levels"). Needs `supabase/levels.sql` run once. Phantom fix: see "Why the wallet's own network" above.
- **Phase 4: done 2026-09-24** (owner said "continue"). Anti-bot check (IPv6 blocks, speed bump; optional Vercel
  rate-limit rule for the owner), Hall of Fame (this week / all time), round history with times, and AGI-1's reactions to new
  champions in her chat (all gone from this site since 2026-09-28: see "The Arena: removed"). Needed `supabase/arena.sql`
  run once more (the original site's now: never again from here).
- **Phase 5: done 2026-09-24** (owner said "continue"). AGI-1's diary page (one entry a day, Gemini once a day), share
  cards + "Share on X" (the visitor posts; **no automatic posting**), voice replies with the browser's free text-to-speech (see
  "Diary, sharing and voice"). Needs `supabase/diary.sql` run once.
- **Phase 6: done 2026-09-25** (the owner pushed it and asked for the stage zoom next). Visitors nominate clank.trade coins and vote them in (20 humans in
  7 days, 8 coins at most, the fewest votes this week makes room), coin logos, the champion's button + card + "Buy on
  clank.trade" on the stage, the keep-alive's liquidity check, and AGI-1's memory of the clank.trade Telegram group (only when
  asked). Needed `supabase/coins.sql` run once (after `arena.sql`; the original site's now: never again from here). See "AGI-1's
  memory of the clank.trade Telegram group" (the Arena's coins left this site on 2026-09-28). All end-to-end suites pass (Arena 13, Playground 17, wallet 27, Phantom 18, Phase 4 37, Phase 5 43,
  launch-ready 46, Phase 6 58) plus 112 unit tests and 55 SQL checks.
- **Stage zoom: done 2026-09-25** (the owner pushed it and asked for the domain switch next). + / − and pinch (phones,
  trackpads), portrait framing toward AGI-1's face that follows her, CABO's face, the card's logo, sharper textures on phones
  for close-ups, shy at 8× (see "Zoom" in "3D stage and AGI-1's reactions"). No setup needed. Tested end to end: 43 checks,
  plus every earlier suite.
- **AGI-1's voice: done 2026-09-25** (the owner heard the first version live, then asked for streaming, the footer wording and
  2,000 a day; those three went live only with the Node 24 fix, see the decisions log). Her replies read aloud in a natural AI voice (Gemini's
  "Despina", the owner's pick) instead of the browser's robotic one, with the browser's voice as the fallback; 2,000 voice units a
  day at most (about $3; raised from 500 by the owner), owner approved (see "AGI-1's voice"). Needs `supabase/voice.sql` run once. The owner heard it live
  and asked for no delay after the reply: now **streamed**, and the reply appears as she starts talking. Tests: 18 unit, 27 SQL,
  29 end to end, plus every earlier suite.
- **AGI-1's live view in the chat: done 2026-09-25** (it reached the site with the Node 24 fix; the owner: "nice it works"). The owner asked how anyone sees her react
  while chatting (the stage is far above the chat) and said "you decide". The stage's one canvas now moves into the chat
  (a portrait tile on computers, a sticky strip on phones), framed like a video call; she listens while you type, thinks while
  her reply is on its way, reacts to its mood, moves her mouth with her voice (or "says" the reply silently with voice off) and
  blinks. No setup, no cost. See "AGI-1's live view in the chat". Tests: 3 unit + 1 page, 50 end to end, plus every earlier suite.
- **Voice chat: built 2026-09-25, waiting for the owner's OK** (the owner confirmed the live view works live, then asked
  for voice chat and picked the free version with both the mic button and calls). See "Voice chat". No setup, no new cost.
- **Her face, her Arena memory and the out-of-messages line: built 2026-09-25, waiting for the owner's OK.** The owner asked
  for a moving mouth and eyelids "built in to the model" with face emotions from the chat's moods, for AGI-1 to always know
  the current Arena champion (only the current one, no Parameters row), and for her to recommend $AGI in her own voice when
  Strangers and Crushes run out of messages, with "not financial advice". See "Her face: mouth, eyelids and expressions",
  "Her memory of the Arena" and "Out of messages". No setup; cost about +$0.00002 per reply. Tests: 154 unit (on Node 20, 22
  and 24) and every end-to-end suite (arena 13, playground 19, wallet 27, Phantom 18, Phase 4 37, Phase 5 43, launch 46,
  coins 58, zoom 43, voice 29, live view 50, voice chat 34) plus the new `limittest.mjs` (30) and `facetest.mjs` (23);
  accessibility scan (axe) of the out-of-messages message at 4 widths in both themes: 0 issues.
- **Her call intro and market moments: built 2026-09-25, waiting for the owner's OK** (asked for before the OK of the batch
  above: "make this better then continue"). Her call intro is her natural voice for everyone now (see "AGI-1's voice"), and
  she reacts to $AGI's market cap (see "Market moments"). No setup; about no cost. Tests: 171 unit (on Node 20, 22 and 24)
  and every end-to-end suite (arena 13, playground 19, wallet 27, Phantom 18, Phase 4 37, Phase 5 43, launch 46, coins 58,
  zoom 43, voice 29, live view 50, voice chat 34, out of messages 30, face 29) plus the new `markettest.mjs` (56) and
  `introtest.mjs` (7).
- **Her voice, fixed: done 2026-09-25** (the owner pushed it the same evening; the owner: her voice "randomly changes its natural voice
  to generic voice then back", Strangers and Crushes who run out of messages hear no natural voice, "is her natural voice
  matched with its mood?", and "is it better if the voices matches the number of their messages? you decide"). Her natural
  voice or text (never the robotic one), a moment's hiccup tried again, one note when it rests for the day; her voice in each
  reply's mood; every reply a visitor may get can be spoken (80 / 240 / 600 units by level); out-of-messages lines always
  spoken, the short ones too. See "AGI-1's voice" and "Out of messages". No setup; no new cost ceiling. Tests: 174 unit (on
  Node 20, 22 and 24) and every end-to-end suite (arena 13, playground 19, wallet 27, Phantom 18, Phase 4 37, Phase 5 42,
  launch 46, coins 58, zoom 43, voice 36, live view 50, voice chat 34, out of messages 31, face 29, market 56, call intro 7).
  The owner checked the speech model's limits in Google AI Studio (10 a minute, 100 a day on Tier 1).
- **Her voice within Google's limits: built 2026-09-26, waiting for the owner's OK.** Live check: her out-of-messages lines
  were silent because Google's 100 a day were used up (`why: daily_limit`). Now her fixed lines are kept in the database once
  made (never need Google again, even after a push), the site counts voice in requests like Google and backs off when Google
  says wait / used up / no credits, its own cap is 1,000 spoken replies a day (about $3 at most, $4.50 if all went to the
  backup), and Gemini 3.8 Flash TTS takes the replies Flash-Lite can't (its own limits on top). A voice made on the
  owner's PC was tried and dropped (see the decisions log): Chatterbox took about 19 s to make a 10-second line on his AMD
  card. **Owner:** run `supabase/voice-lines.sql` once, and get more from Google (Tier 2 and the increase form, see "Google's
  limits"). Tests: 179 unit (on Node 20, 22 and 24), 36 SQL checks for `voice-lines.sql`, and every end-to-end suite
  (arena 13, playground 19, wallet 27, Phantom 18, Phase 4 37, Phase 5 42, launch 46, coins 58, zoom 43, voice 36, live view
  50, voice chat 34, out of messages 31, face 29, market 56, call intro 8: Google refusing, her kept hello still picks up).
- **The model picker, fewer free messages, more voice, Phantom's logo, her wave, her mouth and her hair: built 2026-09-26,
  waiting for the owner's OK** (asked for one after the other the same day). "AGI-1 ▾" in the chat bar with AGI-2 "Coming
  soon" (see "The model picker"); Strangers 10 and Crushes 50 messages a day (Soulmates 150); the site's voice cap 4,000
  requests a day (about $12 at most); Phantom's logo in the wallet list; her wave like a real arm, fully in the picture; her
  mouth redrawn and moving more naturally; her hair swings (see "3D stage and AGI-1's reactions" and "Her face"). No new
  setup (only `supabase/voice-lines.sql` from the entry above, if not run yet). Tests: 186 unit (on Node 20, 22 and 24) and
  every end-to-end suite (arena 13, playground 19, wallet 27, Phantom 25, Phase 4 37, Phase 5 42, launch 46, coins 58, zoom
  43, voice 36, live view 50, voice chat 34, out of messages 31, face 29, market 56, call intro 8) plus the new model picker
  25, wave 61 and hair 15. (This workspace draws her in software at 1–3 frames a second, so a few waiting checks now
  fast-forward her animation instead of waiting in real time.)
- **ClankChecker: built 2026-09-26, waiting for the owner's OK** (the owner's idea and name; answer style "Risk check", the
  owner's pick). Every clank.trade coin with a risk scan on demand and "Ask AGI-1": her live view moves into the answer, she
  reacts and says one of ten fixed lines in her natural voice. See "ClankChecker". No setup (her lines use
  `supabase/voice-lines.sql` like her other fixed lines); cost about $0.03 once for her ten lines. The phone menu now shows up
  to 860 px. **Round 2 the same day** (asked for before the OK): live updates (a new launch shows up within about 10–20 s,
  a Refresh button, resting off screen and after 10 idle minutes), every coin's picture with a big view, and every coin
  listed (crude names too: slurs masked, crude coins' pictures blurred until the 18+ check; the owner can hide any picture
  with `CHECKER_HIDE_PICTURES`). The default order is Newest. No new setup. Tests: 213 unit (on Node 20, 22 and 24) and
  every end-to-end suite (arena 13, playground 19, wallet 27, Phantom 25, Phase 4 37, Phase 5 42, launch 46, coins 58, zoom
  43, voice 36, live view 50, voice chat 34, out of messages 31, face 29, market 56, call intro 8, model picker 25, wave 61,
  hair 15) plus `checkertest.mjs` (123, was 75).
- **Pop mode: built 2026-09-27, waiting for the owner's OK** (the owner's idea, after the ClankChecker credit line: a button
  beside the theme button that switches the whole page to the look of agi1.app, the $AGI ecosystem site; same content; off by
  default; "you decide"). See "Pop mode". No setup, no cost (two free fonts, only for visitors who switch it on). Also for
  everyone: the phone menu starts at 920 px, and the Arena's leaderboard no longer sticks out at 901–904 px. **Then** (the
  owner, trying it: "why when i click pop mode it goes to a different section of the page?"): switching now keeps your place
  (see "Switching keeps your place" in "Pop mode"). Tests: 220 unit (on Node 20, 22 and 24) and every end-to-end suite (arena
  13, playground 19, wallet 27, Phantom 25, Phase 4 37, Phase 5 42, launch 46, coins 58, zoom 43, voice 36, live view 50,
  voice chat 34, out of messages 31, face 29, market 56, call intro 8, model picker 25, wave 61, hair 15, ClankChecker 123)
  plus the new `skintest.mjs` (38).
- **The domain switch: done** (the owner; seen live on 2026-09-27): the original's own domain serves it, `www.` is the main
  address. Claude checked the live site, updated hard rules 1–2 and "Deployment", and put that domain in the Arena's
  and ClankChecker's bot name (`UA` in `server/coins.js`, with a test). The same day, found while making pictures for the
  owner's X article about the site: in ClankChecker, a coin picture that fails to load no longer shows as a broken image in
  AGI-1's answer (see "ClankChecker"). Tests: 220 unit (on Node 20, 22 and 24; the bot name is one more check in
  `tests/coins.test.js`) and `checkertest.mjs` (124).
- **The X article about the whole site** (2026-09-27, the owner's request): text, cover, pictures with the live site's real
  data, a short clip of AGI-1 and a week of follow-up posts, in `Claude outputs/x-article-tour/` (not part of the site).
- **AGI-1 in 2D: built 2026-09-27, the owner's OK 2026-09-28 ("its good"); the owner pushes it, on a branch first** (the owner's idea and art: "they will be able to choose what
  version agi can they see … you decide", and make the 2D one "move like a real vtuber and speak too like the 3d AGI-1"). A
  "3D · 2D" switch on the stage and in her live views; her 2D art cleaned up, upscaled and rigged like a VTuber. See "AGI-1 in
  2D". No setup, no cost. Tests: 231 unit (on Node 20, 22 and 24) and every end-to-end suite plus the new `agi1_2dtest.mjs`.
- **Her 2D chest's follow-through: built 2026-09-28, waiting for the owner's OK** (the owner: "fix the jiggle physics on her
  chest … make it the best ever"). Natural and subtle, because the site is PG-13: see "Her chest follows through" in "AGI-1
  in 2D". No setup, no cost, no new pictures. Tests: 233 unit (on Node 20, 22 and 24), `agi1_2dtest.mjs` 62 (its hop check
  now starts right after her dance, so a dance can't overlap it), the launch suite. Preview: `Claude outputs/agi1-2d-preview/`
  (`chest-before-after.mp4`, `chest-hop-slowmo.mp4`).
- **This folder becomes the whole site (2026-09-28):** the copy of `AGI NEW WEBSITE` with AGI-1 / AGI, the X account, then Pop
  mode + dark as the defaults (see the decisions log). Live on agi1.app once the owner set its settings in Vercel.
- **$CABO and ClankCap removed, and the front: built 2026-09-28, waiting for the owner's OK** (the owner: "remove everything
  about cabo and clankcap", and the old landing "in front"). See "$CABO and ClankCap removed" and "The front". No setup, no
  cost. Tests: 252 unit (on Node 20, 22 and 24); end to end in a browser (see "The front": the first visit, phones down to
  320 px, both looks and themes, "reduce motion", axe, the keyboard, the links, the stage and the chat's live view, the
  site's real CSP).
- **The Arena removed, and ClankChecker renamed: built 2026-09-28, waiting for the owner's OK** (the owner: "and can you
  remove the arena too", then "i mean risk check your coins on clank"). The Arena is gone from this site (the database
  keeps it for the original site), the risk check has its place and its new name, and the diary is never about the Arena
  (see "The Arena: removed", "ClankChecker" and "Diary"). No setup, no cost. Tests: 212 unit (on Node 20, 22 and 24;
  the Arena's, the champion's and the coins' tests left with them); end to end in a browser (the top bar fits at every
  width in both looks, every link lands, the front and its planet names, the 3D stage and the chat's live view, Pop mode and
  theme switches keeping your place, phones down to 320 px, axe 0 issues, a clean console).
- **She texts first (her Telegram bot): built 2026-09-29, waiting for the owner's setup and OK** (the owner's big-ideas
  message; step 1 of Claude's plan: the feed + Telegram, then X, clips, a paper bag, burns). See "She texts first". Hard rule
  6 got its one exception. **Owner:** the five setup steps (BotFather, `supabase/telegram.sql`, two settings, run the cron
  job once, try it). Tests: 238 unit (on Node 20, 22 and 24; 25 new), 52 SQL checks (PGlite), the page in a browser (72
  checks); a second Claude agent reviewed the code first (9 problems found, all fixed). Not tested live (Claude's workspace can't reach Telegram).
  **The owner did the setup the same day** ("im done"). Claude checked what it could see live: the site's "Text me on
  Telegram ↗" (t.me/agi1_appbot), `/api/telegram` answering 401 without its secret (so it's configured), and the bot's
  Telegram page showing her description (so the cron run connected it). Still to confirm by the owner: she answers /start.
- **The Clank developer docs: read 2026-09-29** (the owner asked for a summary and how to use it). See "The Clank
  protocol".
- **The risk check reads the Clank protocol: built 2026-09-29, waiting for the owner's OK** (1 and 2 of Claude's answer
  about the docs: a safety net and sharper flags). Each scan also asks the protocol's own contracts on Robinhood Chain
  (read-only): a locked-pool note for coins that graduated with it, the graduating and rescued stages (the list too), a
  flag when clank.trade and the protocol disagree, and a smaller scan from the chain when clank.trade is away (never "Lower
  risk"). "How the scan works" and the safety note's data sentence say so. See "The Clank protocol itself, on Robinhood
  Chain" under "ClankChecker". No setup, no cost. Tests: 247 unit (on Node 20, 22 and 24; 9 new in `checker.test.js`, with
  a fake chain node), the page at 1440 / 390 / 360 px in both themes. A second Claude agent reviewed it first (11
  findings, e.g. an unread creator balance showing as "holds none", a brand-new unlisted coin at Some risk, the locked
  note claiming more than the docs say; all fixed and tested). Not tested live: the first live `/api/checker?a=<$AGI>`
  after the push shows whether the real contracts answer the documented calls. **Saved in this folder the same day; the
  owner pushes it.**
- **Her languages: built 2026-09-29, waiting for the owner's OK** (the owner: "add different languages on agi-1 … but
  default is english"; the owner picked ~15 popular languages, a menu plus following the visitor, AGI-1 only). 16 languages
  in a menu next to "AGI-1 ▾"; her replies, voice, mic, pre-written lines and Telegram replies follow it. See "Her
  languages". No setup; about +$0.04 a day at the reply cap, and under $0.50 once for her voice lines in every language.
- **The contract address on the front: built 2026-09-29, waiting for the owner's OK** (the owner: "contract address needs
  to be copy pasted on landing page right away"): a pill with a Copy button under the front's two buttons, in the first
  screen at every size. See "The front". Tests for both: 269 unit (on Node 20, 22 and 24; 22 new), the language menu in a
  browser (113 checks) and the address (112 checks: 6 screen sizes, both looks, both themes, copying, the keyboard, axe).
- **Her daily clips: built 2026-09-29, waiting for the owner's setup and OK** (the owner's big idea 5, "juist do 5 … only
  this"; posted by hand, the owner's pick; then "just agi": only her diary, never another coin). A free daily GitHub job
  makes a vertical clip of AGI-1 in 2D reading her diary entry in her voice, with captions, to download and post by hand.
  See "Her daily clips". **Owner:** add the GitHub secret `GEMINI_API_KEY`, save `.github\workflows\clips.yml` (sent in
  the chat), push, then Actions → Run workflow. Cost: GitHub's free minutes, about $0.003 a day of her voice. Tests: 277
  unit (on Node 20, 22 and 24; 8 new), the clip rendered in Claude's workspace with a stand-in voice. Burns for reads and
  her pretend bag (big ideas 3 and 4): on hold, the owner's call.
- **Burn $AGI for more messages, and the burn monitor: built 2026-09-30, waiting for the owner's setup and OK** (the owner:
  "every chat $AGI is burned … make this better then continue", then "make a monitor … huge text on the chat on top of it").
  Free messages stay; after them 10 $AGI a message, burned by the visitor from their own wallet app and checked on Robinhood
  Chain; what was burned counts toward the level; a huge live burn monitor above the chat. See "Burn $AGI for more messages,
  and the burn monitor". **Owner:** run `supabase/burns.sql`, then try one small burn. Tests: 295 unit (on Node 20, 22 and 24;
  18 new), 50 SQL checks (PGlite), 148 in a browser; a second Claude agent reviewed it first (10 findings, all fixed but
  waiting for confirmations). Not tested live (Claude's workspace can't reach the chain or the explorer).
- **Fewer free messages: done 2026-09-30** (the owner: "can you reduce stranger messages to 5 and crush messages to 15"):
  Stranger 5 a day (was 10), Crush 15 (was 50), Soulmate 150 as before (`src/lib/levels.js`; the page's "How levels work"
  table). Everything that follows the levels follows: a Stranger's out-of-messages offer says "you get 15 a day", her voice
  shares are 10 / 30 / 300 requests, and her Telegram chats (everyone there is a Stranger) get 5 a day too. Her fixed voice
  lines' version is 4, so everyone hears her offer with the new number at once (only that line is re-made; the others are
  found in the database). No setup. Tests: 295 unit (on Node 20, 22 and 24).
- **Her voice: 5,000 a day for the whole site: done 2026-09-30** (the owner: "can you make the voices 5000 a day?"):
  `VOICE_DAILY_REQUESTS`'s default is 5,000 (was 4,000). The ceiling is about $15 a day ($22.50 if every reply went to the
  backup model; double from January 2027); Claude told the owner it's far above the $150 budget if ever reached, and that
  Google's own daily limits keep real use far lower until the project gets more from Google. No setup (if the setting was ever
  added in Vercel, change it there too).
- **Her bubble on phones: done 2026-09-30** (the owner, with a phone screenshot: "on the mobile agi-1 is getting blocked"):
  on the front, her speech bubble covered her face on phones; it now sits beside her head, inside the screen, at every phone
  size (see "Her bubble on phones" in "The front"). Computers unchanged. No setup, no cost. Tests: 296 unit (on Node 20, 22
  and 24; 1 new in `tests/landing.test.js`, which fails if a rule ever moves it back), her longest line measured in a
  browser at 8 widths in both looks.
- **AGI-1 in 2D is her Live2D model, and 2D comes first: built 2026-10-01, waiting for the owner's OK** (the owner: "change
  the 2d model use the new mode in VTuber_Project … i want the 2d model to be shown first instead of 3d"). See "AGI-1 in
  2D". No setup. **Owner, before pushing:** the model was made in Cubism Editor's PRO trial (see "Open questions"). Tests: 295
  unit (on Node 20, 22 and 24; `agi1-2d.test.js` rewritten), 49 end to end in a browser with the site's real CSP.
- **Her 2D wave and natural motion, and she talks when tapped: built 2026-10-01 (round 2), waiting for the owner's OK** (the
  owner, with two screenshots: "why dont the 2d model dont wave anymore, and she moves like a stick, not even natural", then
  "can you make her speak whe she got clicked and if they clicked her many times she will said something"). Her arms move in
  code on top of her model (relaxed by her sides, a real wave, a cheer, her hands up in her dance), her weight shifts with
  her feet on the floor, her head looks around; her shirt's smudge under her right arm repainted; a tap gets a hello in her
  voice and a bubble, a lot of taps one of her "okay, i see you" lines (16 languages). See "AGI-1 in 2D" and "She talks when
  you tap her". No setup; her nine tap lines cost about $0.02 once in English (each other language only when someone uses
  it). **Then** (the owner, with a screenshot of her dance: "what is this lol": both arms straight out, torn-looking flaps
  under her sleeves): her upper arms never lift past what her drawing allows (`REACH`), and her wave, cheer and dance raise
  her hands by bending her elbows (see "Her upper arms never lift far"). Tests: 298 unit (on Node 20, 22 and 24), 50 + 24 end
  to end in a browser with the site's real CSP.
- **Launch with AGI-1: built 2026-10-01, waiting for the owner's setup and OK** (the owner: "what if they can launch a coin
  on clank.trade there using $AGI … non custodial … make this better then continue"; the owner's choices: hold 10,000
  $AGI with no fee, their own wallet app, the picture as a Telegram photo, the network fee paid back after the launch).
  `/launch` with a photo in her bot, her checks, a private launch page, the launch from their own wallet on clank.trade's
  factory, the fee paid back by the owner's gas wallet. Hard rule 9 got its one exception. See "Launch with AGI-1".
  **Then** (the owner: "id like to be my first launch to be private"): `LAUNCH_ONLY_FOR`, so only the owner's Telegram
  account can launch until it's deleted. The owner is waiting for the clank.trade team's reply before pushing.
  **Owner:** push (a branch first for a preview, if wanted), a Pinata key, `supabase/launch.sql`, a new gas wallet with a
  little ETH, `LAUNCH_ONLY_FOR` = their Telegram username, Redeploy, one private real launch (it makes a real coin); then
  delete `LAUNCH_ONLY_FOR`, Redeploy and run the `/api/feed` cron job to open it. **And** (the owner: "can they also add
  socials … and a website?", then "X, website and Telegram", "just make adding that optional"): optional link boxes on the
  launch page, no new setup. Tests: 337 unit (on Node 20, 22 and 24; 39 new), 79 SQL checks (PGlite), 189 in a browser; a second Claude agent reviewed it twice (all findings fixed). Not
  tested live.

## Decisions log

| Date | Decision |
|---|---|
| 2026-09-23 | Rebuild from scratch in `AGI NEW WEBSITE`; AGI FINAL is a read-only reference |
| 2026-09-23 | Vite + plain JavaScript; server code in Vercel Functions (replaces the Render chat server) |
| 2026-09-23 | Gemini paid tier with prepaid credits; model `gemini-3.1-flash-lite` |
| 2026-09-23 | A new, separate Supabase project for votes |
| 2026-09-23 | Keep today's look, polished (**replaced 2026-09-24** by the redesign) |
| 2026-09-23 | Starter site: Vite 8, strict security headers (CSP), `noindex` on `*.vercel.app`, 15 s function limit, build-time secret check |
| 2026-09-23 | Private GitHub repo and a new Vercel project, both named `agi-new-website`, with no domain yet |
| 2026-09-23 | AGI-1's model = AGI FINAL's `girl.glb`, shrunk 56.5 MB → 2.48 MB (quantize + WebP 2048); every triangle and animation kept |
| 2026-09-23 | Phase 1 reactions: look at cursor, tap, wave hello (made in code), chat reactions via `agi1:react`. No new animation files for now |
| 2026-09-23 | Stage shows AGI-1 plus a CABO switcher (`cat.glb` shrunk 8.5 MB → 2.44 MB). CABO downloads only when picked |
| 2026-09-23 | CSP: `blob:` added to `img-src` and `connect-src`, which the 3D model textures need |
| 2026-09-23 | Chat: Turnstile + 2 h signed pass; limits 3 s gap, 60/visitor/day, 1,000/site/day in Supabase (fail closed); signed history |
| 2026-09-23 | Chat: Gemini safety filters on (strictest for sexual content), thinking MINIMAL, 300-token cap, address/link cleanup |
| 2026-09-23 | Chat avatar = a portrait rendered from her 3D model (the old `girl.png` rear-view picture isn't used) |
| 2026-09-23 | Tests (`npm test`) run on every build, so a broken chat can't be deployed |
| 2026-09-24 | Setup lessons: Vercel settings apply only after a redeploy; browser-side settings need the `VITE_` prefix |
| 2026-09-24 | Live chat tests use a normal browser: Cloudflare Turnstile blocks Claude's automated browser (error 600010) |
| 2026-09-24 | `chat-limits.sql` reloads Supabase's API cache and checks `chat_take` exists; DB errors in the logs now name the fix |
| 2026-09-24 | Gemini refusals in the logs now show Google's reason + a fix, with API keys blanked out |
| 2026-09-24 | Gemini key must be an AI Studio "auth key" in My Project 57368 (the first key was a Cloud Console key for Agent Platform/Vertex → 403) |
| 2026-09-24 | Chat is live on the preview site and passed the owner's test messages. A paused Supabase project (HTTP 540) now gets its own log hint |
| 2026-09-24 | Live prices: one DexScreener request for all coins every 30 s (`/tokens/v1/robinhood/…`), paused in hidden tabs, straight from the browser |
| 2026-09-24 | Supabase keep-alive: `/api/keepalive`, 3 Vercel cron runs a day, protected by `CRON_SECRET` |
| 2026-09-24 | AGI-1: hair re-weighted off the arm bones (it stretched sideways); calm idle facing visitors, dance now and then turned toward you; no camera orbit |
| 2026-09-24 | **Full visual redesign: parody of an AI lab's model launch page.** Replaces "Keep today's look, polished". Built section by section, hero first, each shown to the owner before the next |
| 2026-09-24 | Fonts self-hosted (Geist + Geist Mono, SIL OFL) instead of Google Fonts: no third-party requests, CSP styles/fonts `'self'` only |
| 2026-09-24 | Owner approved the new hero ("this looks nice") |
| 2026-09-24 | Evaluations: 6 made-up benchmarks, AGI-1 vs "your ex" (emphasis bar chart + table view + tooltips), 3 stat tiles. Owner: "continue" |
| 2026-09-24 | Playground replaces the old floating chat window: inline section, parameters panel, example prompts, mood + time on each reply. Old chat.css deleted. Owner said "continue" on the Model card |
| 2026-09-24 | Model card: only facts we can check (ticker, name, Robinhood Chain, clank.trade, contract) plus live DexScreener numbers (market cap, liquidity, 24h volume, supply = FDV ÷ price ≈ 1.00B). No invented tokenomics (tax, locked liquidity, allocations): the owner adds those if wanted. Links: clank.trade, DexScreener, Blockscout explorer |
| 2026-09-24 | Hero: centered announcement, live ticker strip, Figure 1 = minimal 3D stage (transparent canvas, floor dial, soft shadow), light/dark toggle. "Try AGI-1" opens the (old-style) chat until the Playground step |
| 2026-09-24 | Owner said "continue" on the Playground (approved) |
| 2026-09-24 | The Arena (ClankeRRankeR as a leaderboard), owner's choices: **one vote per human per 5-minute round** (replaces the old "unlimited clicks"), coins $AGI/$CABO/$CLANKCAT. The server decides rounds and champions (most votes; a tie goes to the coin that got there first) |
| 2026-09-24 | Arena board through `/api/arena`, cached 10 s by Vercel's CDN, fetched every 15 s only while visible. No Supabase Realtime and no Supabase key in the browser |
| 2026-09-24 | One human check for chat and voting: the 2-hour pass works for both; Turnstile tokens are tied to an action (`chat` / `vote`) |
| 2026-09-24 | Owner said "continue" on the Arena (approved) and pushed it |
| 2026-09-24 | Footer = "Safety note": the disclaimer as six numbered notes in a lab's voice (not financial advice, official contract, not a person/18+/PG-13, your data, the Arena is a game, parody) + a bottom bar. `tests/page.test.js` guards the must-have warnings |
| 2026-09-24 | Owner: don't name Google/Gemini on the site (the data note says "an AI service that writes her replies") and drop the "Not a real lab" note; the safety note now has five notes |
| 2026-09-24 | Model card uses `overflow: clip` instead of `hidden`: same rounded corners, but it isn't a scroll box, so links to `#contract` land below the top bar |
| 2026-09-24 | Owner approved the footer, so the redesign is complete. The launch-ready pass was started, then paused by the owner to build Phases 3–5 first (findings kept in the roadmap) |
| 2026-09-24 | Phase 3 levels (owner's choices): Stranger, Crush from 10,000 $AGI, Soulmate from 1,000,000 $AGI; 20 / 60 / 150 messages a day (Strangers were 60); Soulmate memory approved (about +$0.0001 per Soulmate reply) |
| 2026-09-24 | Wallet sign-in = a "Sign-In with Ethereum" message only (free, never a transaction), checked with viem on the server. Phones use wallet-app browsers + "open in wallet app" links, no WalletConnect |
| 2026-09-24 | $AGI balance from Robinhood Chain's free public node, re-checked at most every 30 minutes; if it fails, people keep their last level |
| 2026-09-24 | Stored only for Crush/Soulmate: the name and up to 8 notes, filed under a scrambled wallet code; Forget me deletes them |
| 2026-09-24 | The Playground's "(summary)" label now uses the normal label color (it was faded to 3.3:1 contrast) |
| 2026-09-24 | Phantom fix: the sign-in names the wallet's own network (read with `eth_chainId`) instead of always Robinhood Chain; a wallet that never answers no longer locks the connect screen; "Open in Phantom" on phones |
| 2026-09-24 | Phase 4 anti-bot: IPv6 visitors counted per /64 block (votes, passes, chat limits); per-copy speed bump on `/api/vote`; the Vercel rate-limit rule is recommended to the owner (free, optional) |
| 2026-09-24 | Hall of Fame "this week" = since Monday 00:00 UTC (the same for everyone, so the CDN can share one answer); round history grouped by day in the visitor's time zone, 24 older rounds per click |
| 2026-09-24 | AGI-1's champion reactions are pre-written lines (no Gemini cost), happy for $AGI and playfully jealous otherwise, shown only after the 18+ check and not saved to the chat history |
| 2026-09-24 | Owner set up Vercel's free rate-limit rule: `/api/*`, 120 requests a minute per IP, answer 429 |
| 2026-09-24 | Phase 5 (owner's choices): the diary uses Gemini once a day (~$0.0008, approved); ready-made X posts mention no X account; voice = the browser's free text-to-speech, off by default |
| 2026-09-24 | The diary is written by the nightly keep-alive job (no new cron job); a pre-written entry when Gemini can't write one; entries are never overwritten |
| 2026-09-24 | Share cards drawn on a canvas in the browser ("Save image" never uploads anything); link previews from static pictures + small share pages written at build time with Vercel's production address |
| 2026-09-24 | Launch-ready pass: phones get a lighter copy of AGI-1 (1024 px textures) and both copies drop tangents (same look, checked side by side); a phone menu instead of hidden links; the home page's link preview repeats the hero (JPG); built files and fonts cached a year, models and pictures a day. Meshopt stays out (it would need `'wasm-unsafe-eval'` in the CSP) |
| 2026-09-24 | AGI-1 fixes from the owner's video: the idle uses the file's standing height and `groundDance()` keeps her feet on the floor during the dance; the wave/look bones are reset every frame (`beforeMixer`); looking at you fades out behind her |
| 2026-09-25 | Phase 6, the owner's choices: coins join the Arena **automatically at 20 votes** (different humans, 7 days); **8 coins** (AGI + CABO always, up to 6 others; the fewest Arena votes this week makes room); the champion gets a **third stage button** with a card and "Buy on clank.trade"; AGI-1's Telegram memory **includes usernames** |
| 2026-09-25 | Nominations are checked with clank.trade (the coin's page) and DexScreener ($5,000+ liquidity); tickers A–Z/0–9, PG-13 names without links; one coin per ticker; 2 nominations a day per visitor, 50 site-wide; nominations never show logos; a coin that just joined is safe for a day |
| 2026-09-25 | Logos go through our own `/api/logo` (CDN-cached a week) instead of loading from Pinata: the CSP stays strict and the 3D card can use them. $AGI's logo is AGI-1's portrait, not the old rear-view picture |
| 2026-09-25 | The keep-alive retires a voted-in coin whose DEX pool drops under $1,000, so the champion's Buy link never points at a dead coin (owner can also remove any coin with `coin_remove`) |
| 2026-09-25 | AGI-1's Telegram memory: 21 hand-written lore cards + 242 member cards, only for messages about the group, at most ~450 tokens (about +$0.0001 per such reply); no ids, phones, emails, links or addresses; a forget list; the export stays out of git |
| 2026-09-25 | Stage zoom (owner's request): + / − buttons, pinch on phones and trackpads; the mouse wheel keeps scrolling the page. Up to 8× on AGI-1, framed like a portrait (head near the top, so zooming crops from the bottom up) and following her head; no surprise dances while zoomed; shy at 8×. Phones load the 2048 px textures (~2.2 MB, once) when zoomed past 3× |
| 2026-09-25 | Owner pushed the zoom and asked to move the old site's domain to this site. Plan: Turnstile hostname first, then Vercel's "Move Domain" (no DNS change), `www` redirects to the bare domain, a redeploy for the link previews; `agionclank` stays as the way back |
| 2026-09-25 | The home page's link preview (`home.jpg`) and the X article cover re-rendered with AGI-1's current wave: the old picture was made before the wave fix and her raised arm drooped (the owner spotted it on the cover) |
| 2026-09-25 | AGI-1's voice (owner's choices): Gemini's ready-made voice **Despina** (picked by ear from Google's samples, close to a reference clip; nothing cloned) in one calm, smooth style, `gemini-3.8-flash-lite-tts`, **500 voice units a day** (≈ $0.75 at most; $1.50 from 2027). Only her chat replies, through voice tickets; 60 units per visitor; the browser's voice as the fallback. Chatterbox (open-source cloning) was considered and dropped: it needs a paid GPU server, is slower, and cloning a real person's voice needs their written consent |
| 2026-09-25 | Bottom bar (owner's wording): "A parody." removed; the right side now says "$AGI is a token made by the AGI team, launched on clank.trade. Entertainment only · Not financial advice." (index.html and diary.html). The safety note's risk wording ("a meme token… can lose all of their value") stays |
| 2026-09-25 | Voice allowance raised from 500 to **2,000 units a day** (owner's request): at most about $3 a day ($90 a month), $6 a day from January 2027. The owner was told the worst case is above the $150 budget; it's a ceiling, and the prepaid credits (shared with the chat) are the hard stop. Per visitor stays 60 |
| 2026-09-25 | Voice delay (owner: "should be instant"): her voice is streamed (Gemini `stream: true` → raw PCM pieces passed straight to the page), and with voice on the reply text waits for her first sound (at most 2.5 s) so both start together. Same cost. Whole clips stay as the fallback (`VOICE_STREAM=off`) |
| 2026-09-25 | Seeing her react while chatting (owner: "you decide"): **the stage's one canvas moves into the chat** (portrait tile on computers, a strip that stays under the top bar on phones) instead of a second head-only or full-body model: nothing downloaded twice, one 3D view on phones, every reaction works there too. Framed like a video call (widens for a wave); she listens (looks at the box you type in), thinks while her reply comes, blushes on "love", waves when you arrive |
| 2026-09-25 | Her mouth and blinks are painted by her shader over the painted-on face (the model has no face rig): a mouth that follows a sound meter on her voice (a made-up rhythm for the browser voice and, with voice off, a short silent "saying" of each reply, like in games) and eyelids every 2.5–6 s. Measured once on the model; must be re-measured if the model changes |
| 2026-09-25 | Found while checking the live site: nothing pushed after the first voice version (06:40 UTC) had gone live. On Node 24 (most likely what Vercel builds with) one voice test waited forever, because stopping a streamed voice could wait for a read that never ended, so every build after that hung and failed. Fixed in `server/voice.js` (Google's stream is cancelled directly), `npm test` got a 30 s limit per test, and tests now run on Node 20, 22 and 24 |
| 2026-09-25 | Her face "built in" (owner's request): the model has no face rig, so her own shader moves her face's shape (jaw drops as she talks, mouth corners up for a smile or down for a pout, cheeks lift) and paints what the model doesn't have (the inside of her mouth, eyelids with a shadow, smiling and "^^" eyes, a blush). An expression for each chat mood (happy, love, shy, wave, the Arena's jealous, neutral) and resting faces (calm, listening, thinking, dancing). A real rig would need Blender and a 3D artist; this works on both model files at no cost |
| 2026-09-25 | AGI-1 knows the Arena's current champion (owner: only the current one, "not on the parameters section, just an update"): added to her prompt from the database before each reply, kept a minute per server copy and renewed every round; mentioned only when it fits, never as a reason to buy. About +$0.00002 per reply |
| 2026-09-25 | Out of messages (owner's exception to "no buy advice"): when a Stranger or a Crush runs out, her pre-written line suggests buying $AGI for more messages a day, in her own voice (fixed lines, made once, kept by the CDN), always with "not financial advice", "or come back tomorrow" and a safety note under it (meme token, can go to zero, only spend what you can afford to lose). Once a day per browser; voice off = a Listen button instead of surprise sound; in a call she says it and hangs up. Soulmates and a site-wide cap get the old note. Her AI replies still never suggest buying |
| 2026-09-25 | Voice chat (owner's choice): the browser's free speech recognition (no new cost; not in Firefox, where the buttons hide) with both a mic button (one message) and a hands-free call on her live view; spoken messages go through the normal chat. Considered and not picked: our server transcribing (works in every browser, ~$0.001/min) and Gemini Live real-time calls (~$0.02/min, own cap, much bigger build). `Permissions-Policy` now allows the microphone for our own pages |
| 2026-09-25 | Her call intro in her natural voice for everyone (owner: "when i press call, her intro is not her natural voice"). Cause: the page stopped asking for her fixed lines once a visitor's own voice allowance was used up (or after one failed download), so the intro fell back to the browser's voice. Fix: fixed lines are always asked for (they use no allowance), a failed download is tried once more (and the server retries Google once), the intro downloads as soon as the pointer is on Call, and the intro is her natural voice or nothing, never the robotic one |
| 2026-09-25 | Market moments (owner's request, the roadmap's Phase 2): happy at every new **$200K multiple** of $AGI's market cap (she names it), sad when the **24-hour change is -20% or worse** (the number the ticker shows; at most once every 12 hours, again only after it was back above -10%). Decided in each visitor's browser from the page's own DexScreener numbers (no server, no database); a first visit only notes the market cap (no old news); pre-written lines (three each, feelings only, "not financial advice", no Buy link); her face and body (`celebrate` with a dance on the stage, `sad`); her natural voice only (fixed lines, made once per step, our server checks the step is near the real market cap), never a surprise sound before a tap; voice off = a Listen button |
| 2026-09-25 | The market moments' notification is a card on the page (a browser notification would need a permission prompt, and prices pause in hidden tabs anyway), one at a time, about 12 s. It never covers her live view: while she's reacting right there in the chat (always on phones, where her live view sits under the top bar) the chat shows the moment without a card. `?dev` got **market up** / **market down** preview buttons |
| 2026-09-25 | Her natural voice or nothing (owner: it "randomly changes its natural voice to generic voice then back"). Found on the live site: her fixed lines failed at Google in about half a second (most likely the speech model's rate limit), and every failed reply fell back to the browser's robotic voice. Now the robotic voice is gone: a hiccup is tried again (server, then page), a reply that still can't be voiced stays text with a "voice: unavailable" chip, and when her voice can't work for the rest of the visit she says so once and calls pause. `/api/voice` names the reason (`why`). Voice tickets are no longer tied to the visitor's IP (phones switch addresses) |
| 2026-09-25 | Voice allowance follows messages (owner: "is it better if the voices matches the number of their messages? you decide"; Claude decided yes): every reply a visitor may get can be spoken, 80 / 240 / 600 voice units a day for Stranger / Crush / Soulmate (was 60 for everyone). The site-wide 2,000 units stay the money limit |
| 2026-09-25 | Her voice matches her mood (owner's request): each reply's mood picks a style on top of her approved calm Despina style (happy, love, shy, wave; neutral = unchanged); her fixed lines too (hello bright, the offer sweet, "come back tomorrow" sleepy, market up joyful, a -20% day sad). Fixed line addresses carry a version (`&v=2`) so the new recordings reach everyone at once |
| 2026-09-25 | Out of messages always spoken (owner: "i just want her to speak the same words with her natural voice so it doesn't use credits"): the offer and the short "come back tomorrow" lines are fixed lines (made once, kept by the CDN) and play even with her voice off, since the visitor just pressed Send; on iPhones the Send that will run out unlocks the sound (the page counts today's replies) |
| 2026-09-26 | Google's limits for her voice (the owner checked AI Studio: the speech model allows the project 10 requests a minute and 100 a day on Tier 1; confirmed live: `why: daily_limit`, the day's testing had used them). The site now counts voice in requests like Google (1 per spoken reply, whatever its length; per visitor 2 per message a day: 40 / 120 / 300), backs off when Google says wait / used up / no credits (answered at once, not counted), and keeps her fixed lines in the database once made (`supabase/voice-lines.sql`, `server/voice-store.js`), so they never need Google again, even after a push |
| 2026-09-26 | Her voice on the owner's own PC was considered (the owner's idea for launch week, to avoid Google's limit and cost: first Qwen3-TTS, then the Chatterbox he already had) and dropped: his graphics card is an AMD RX 7800 XT (Ryzen 5 7500F, 32 GB), and these models are built for NVIDIA; his own test: Chatterbox took about 19 s to make a 10-second line (2× slower than real time), one reply at a time; the PC would also have had to stay on all week behind a tunnel. And Gemini's voice is cheap (about $0.0015 per spoken reply): the problem is only the limit. Instead: more from Google (Tier 2 at $100 paid in total + 3 days; the free "rate limit increase" form), never extra projects or keys to add up limits. Also noted: a cloned voice only from a clip the owner has the rights to (never a real person without consent, never her Google voice) |
| 2026-09-26 | A backup speech model (the owner's idea, OK'd with the higher worst case of about $4.50 a day): Gemini 3.8 Flash-Lite TTS first, Gemini 3.8 Flash TTS when it says wait / used up / unknown model (Google gives each model its own limits; same Despina voice, request format and mood styles; about 1.5× the price). Credits and key problems stop both. The "Preview" speech models (2.5 Flash / Pro, 3.1 Flash) were not added: up to 3× the price, can be switched off at short notice, and they take mood instructions differently |
| 2026-09-26 | The site's own daily voice cap is 1,000 spoken replies (`VOICE_DAILY_REQUESTS`, replacing `VOICE_DAILY_CAP` in characters): about $3 a day at most, the ceiling the owner approved, so a higher Google limit works without changing settings (a first version the same day used 80, to stay under Google's 100) |
| 2026-09-26 | The model picker (the owner's request): "AGI-1 ▾" in the chat bar opens a menu with AGI-2 "Coming soon"; written "AGI-2", not "$AGI-2" (a "$" would read as a new coin); picking it makes AGI-1 playfully jealous with pre-written lines (no AI cost), switches nothing and promises nothing |
| 2026-09-26 | Phantom's logo in the wallet list (the owner: "theres no logo for phantom"): any wallet picture announced as `data:image/…` is shown (Phantom's format was refused by the first check), never an outside address; the wallet's first letter when there's none or it fails; the list waits up to a second for a slow Phantom |
| 2026-09-26 | Messages a day (the owner's request): Stranger 10 (was 20), Crush 50 (was 60), Soulmate 150; voice shares follow (20 / 100 / 300); her out-of-messages offer names the new numbers, so her fixed lines' version is 3 (`&v=3`: everyone gets the new recording) |
| 2026-09-26 | The site's voice cap raised to **4,000 requests a day** (the owner's request): about $12 a day at most ($18 if all went to the backup model; double from 2027). Claude flagged that this is far above the $150 budget if ever reached; Google's Tier 1 limits (100 a day per speech model) keep the real use much lower until the project gets more from Google; the prepaid credits are the hard stop |
| 2026-09-26 | Her wave fixed (the owner: "it looks broken"): her arm is posed like a real arm (the elbow bends only around its hinge, the forearm and wrist turn her palm to you), up close a video-call wave (elbow a little below her shoulder, out and forward, hand by her face), and the live view keeps her whole arm in. The first fix (elbow low and far out) made her arm look extra long ("what did you do lol"); four poses were compared side by side and the most natural one kept |
| 2026-09-26 | Her mouth redrawn (the owner: "this isn't natural at all"): a soft, rounded anime mouth, dark red inside, her tongue only when wide open, no teeth (a jagged white line at this size), matte; it opens quickly and closes a little slower when she talks (it used to snap open and shut about five times a second) |
| 2026-09-26 | Hair physics (the owner's request) without changing the model files: her shader finds her hair by its texture color when she loads and lets it swing (a spring following her neck, a swing when she turns or spins, a flare in fast spins, a very gentle breeze; nothing at her roots and bangs, most at the ends). Considered and not picked: adding hair bones to the model (a Blender job, bigger files) |
| 2026-09-26 | ClankChecker (the owner's idea and name; the owner picked "Risk check" over plain facts or a "AGI-1's take" style): risk levels Lower / Some / High / Not enough data from fixed, published rules (holders, big wallets, its creator, trading, the bonding curve, age, copycat tickers, a graduated coin's pool), never "safe", never buy/sell, "not financial advice" in every answer. A section after the Arena with a top-bar link (the phone menu now up to 860 px, for six links) |
| 2026-09-26 | ClankChecker reads clank.trade's own (undocumented) API from our server, plus DexScreener and the Blockscout explorer; each scan is made when someone asks and shared by the CDN for 10 minutes (5 minutes since round 2, 1 minute for coins under a day old). Scanning all ~200 coins every few minutes was not picked: thousands of requests a day to clank.trade could get our server blocked, which would also stop Arena nominations. The list shows quick facts for every coin (stage, age, market cap, copycat, "no buyers yet") and the full scan on demand |
| 2026-09-26 | AGI-1 in ClankChecker: the same one 3D canvas moves into the answer under the coin (as in the chat), after the same 18+ check; she reacts (new `okay` / `hmm` / `worried`) and says one of ten fixed lines in her natural voice (made once, kept like her other fixed lines; about $0.03 once), never AI-written, so asking about coin after coin makes no new recordings (the owner: "just use a couple of voices… so it doesn't generate new ones"). "Lower risk" gets a gray dot, not green |
| 2026-09-26 | ClankChecker live (the owner asked for new launches "instant", or a refresh button, "you decide"): both. The page asks for the newest coins every 10 s while the section is on screen (`?latest`: one small request to clank.trade, shared by the CDN for 10 s, so a new coin shows up within about 10–20 s for everyone at the cost of one run per 10 s per region), plus a Refresh button. Not picked: a push connection (websockets/Supabase Realtime: a new service or database costs, and clank.trade has no push of its own for us), or reading the chain for launch events (more code and RPC load for a few seconds' gain). Live updates rest off screen, in hidden tabs and after 10 idle minutes, to stay inside the free tier |
| 2026-09-26 | ClankChecker coin pictures (the owner: "why arent there images … like on the clank trade", and a way to "magnify it … you decide"): every coin's picture, fetched by our server from clank.trade's own picture host and served from our address (like the Arena's logos: the CSP stays strict), 96 px in the rows and a native dialog with the 512 px picture (the whole picture, never enlarged), Ask AGI-1 and View on clank.trade. Not picked: loading pictures straight from clank.trade's host (it would need a new CSP domain and gives that host every visitor's address) |
| 2026-09-27 | ClankChecker's eyebrow says "ClankChecker POWERED BY $CLANKCAP terminal" with a small 𝕏 link to https://x.com/clankcapxyz (the owner's request, "just that"). The icon is the Unicode "𝕏" character in a round chip, not a copy of X's logo artwork; it opens in a new tab without sending our address (`noopener noreferrer`) |
| 2026-09-26 | ClankChecker lists every coin (the owner: "add the non pg 13 ticker name coins they are part of clank trade"). Kept safe: hate slurs are masked on our server; a crude-named coin's picture stays blurred until the 18+ check (a crude name often comes with an explicit picture); AGI-1's lines never say a coin's name; the owner can hide any picture (`CHECKER_HIDE_PICTURES`). The default order became Newest (like clank.trade), with Biggest as its own filter |
| 2026-09-27 | Pop mode (the owner's request, "you decide"): an optional second look, **off by default**, in the design language of the $AGI ecosystem site (agi1.app); a ✦ button right after the theme button (under 380 px a "Pop mode" row in the menu); remembered per browser (`dr-skin`); a night version; **the same content** (CSS only, every rule under `[data-skin="pop"]`, a test fails the build otherwise). The lab look stays the default, and the "retired style" rule keeps applying to it (Pop mode is flat color blocks and ink outlines, not the old glows). Its two ribbons only repeat phrases already on the page (hidden from screen readers, still with "reduce motion"). Fonts: Anybody and Instrument Serif (SIL OFL), self-hosted, downloaded only while Pop mode is on. Not picked: a separate page or address for the second look (two copies of every page to keep in sync), or a new default look |
| 2026-09-27 | Where the phone menu starts: the default look up to 920 px (the ✦ button made the row of links about 40 px longer; 860 before), Pop mode up to 1040 px (its pills are wider); `src/menu.js` now follows the CSS instead of its own number. The Arena's leaderboard folds each coin into two lines up to 920 px (its Vote buttons stuck out 3 px at 901–904 px, found while measuring) |
| 2026-09-27 | Pop mode's top bar: see-through pills over the hero, then a frosted band with an ink line once the hero has scrolled away (pills floating over busy text and over the ink footer were hard to read); the phone's browser bar is violet on the home page and the page's color on the diary (`data-page="diary"`) |
| 2026-09-27 | Switching keeps your place (the owner: "why when i click pop mode it goes to a different section of the page? can you fix that"): the page now holds on to what's in the middle of the screen across a switch (and again when Pop mode's fonts arrive, unless the visitor scrolled meanwhile), instead of the pixel position the browser keeps. Measured before: 270–2,270 px off (another section); after: the same section in the middle at 1440, 390 and 360 px, on and off. Not picked: jumping to the top of the section you were in (loses your exact spot), or sizing Pop mode's sections like the default look's (the bigger blocks are the look) |
| 2026-09-27 | The domain switch is done (the owner; seen live on 2026-09-27): the `www.` address is the main one and the bare domain redirects to it (the plan had it the other way round; nothing depends on which). `agionclank` stays, without the domain, as the way back. Hard rules 1–2 and "Deployment" now say that every push to `main` goes live on the domain. The bot name our server uses with clank.trade and its picture host (`UA`) names the site's address (since 2026-09-28 in this folder: https://agi1.app) |
| 2026-09-27 | ClankChecker: a coin picture that fails to load stays hidden in AGI-1's answer. Before, the scan arriving a moment later redrew the header and showed a broken-image icon (found while making the X article's pictures with the picture host blocked) |
| 2026-09-27 | AGI-1 in 2D (the owner's idea and art, "you decide"): a "3D · 2D" switch (a pill: the stage's bottom left, the live views' top right), 3D by default, remembered in the browser (`agi1_style`), each version downloaded only when picked. The same AGI-1 either way (voice, moods, reactions, live views). Not picked: a separate page for 2D, a second canvas (two WebGL views on phones), or putting her 2D picture over the 3D stage (the zoom, framing and hearts would have had to be rebuilt) |
| 2026-09-27 | Her 2D rig rebuilt rather than reusing the owner's HTML as it was: drawn by the same three.js stage as bending flat layers; a 2.5D head turn (limited to about 10°: past that, flat art shows its seams), each arm one picture bent at the elbow (a round elbow outside, a clean crease inside), springs for her joints and hair, her eyes and mouth as small shaders (sharp at any zoom), and every 3D reaction with a 2D version (`love` sways instead of spinning). Her 2D zoom stops at 3× |
| 2026-09-27 | Her 2D art cleaned up (patches, ghost sleeves, hair behind her arms, jagged edges, fringes) and upscaled 2× once, offline, with an anime upscaler (Real-ESRGAN x4plus anime 6B, BSD-3, weights from its official release, checked by their SHA-256; run without PyTorch through ONNX). 389 KB for all of her. The steps are in `tools/agi1-2d/` |
| 2026-09-27 | Her 2D arms (the owner, looking at the original file's wave: "what is that arm lol, thats so bad"): each arm one picture bent at the elbow in code, a round elbow outside and a clean crease inside, the picture drawn twice and cut along the crease (found from her measured inside outline). It replaced two pieces with a round cap, the same day: those left a faint seam and short bits of outline at the elbow up close. Not picked: one piece bent smoothly all round (it folds over itself inside the elbow, or pinches like the original), or a longer, rubbery bend (a noodle arm) |
| 2026-09-28 | Her 2D chest's follow-through (the owner's request, "make it the best ever"): a soft spring (2.8 Hz, damping 0.34) on the lower part of her chest, driven by her pose and her hop, on her existing body picture. Natural and subtle because the site is PG-13 (the owner's rule for every feature): about 6 px of her 1536 px picture in a hop, 1.5 px in her dance, nothing while she stands still, none with "reduce motion". Not picked: an exaggerated bounce (fan service, against the PG-13 rule), and a separate chest picture from an image generator (it wouldn't match her art) |
| 2026-09-28 | The whole site copied into `AGI 3 ECOSYSTEM`, replacing the ecosystem page there (the owner: "replace the full website", "exact same so its the same website", the character becomes AGI-1; the lab name is just "AGI", "dont add research"). Renamed everywhere: page text, her prompt and fixed lines, the share cards (made again with `tools/cards/`), file names (`server/agi1-prompt.js`, `src/stage/agi1.js`, `src/stage/agi1-2d*.js`, `public/models/agi1.glb`, `public/images/agi1-*.webp`, `tools/agi1-2d/`), code names, browser-storage keys (a new domain starts empty anyway), the `AGI1_VOICE` setting, and the bot name (`AGIArena/1.0; +https://agi1.app`). Kept: the database table `daria_diary`. Added: the project's X account (@artgirlfintel) as a round button in the top bar (a menu row under 380 px) and a footer link, on both pages, with a test (234 unit tests). Deploys to `agi-ecosystem` (agi1.app); `AGI NEW WEBSITE` untouched |
| 2026-09-28 | Pop mode on by default, in the dark theme (the owner: "make the pop mode open on default, in dark mode"). `/theme.js`: nothing saved = Pop mode + dark (the system setting no longer picks the theme); switching Pop mode off is saved as `dr-skin` = `lab` (before, "off" just removed the key); the ✦ buttons start pressed; the pages load `/theme.js?v=2` so browsers holding yesterday's copy (kept a day) get the new one at once. Checked in a browser: first paint Pop + dark on both pages and phone sizes, off / light remembered after a reload, blocked storage gets the defaults. 235 unit tests |
| 2026-09-28 | $CABO and ClankCap removed from this site (the owner: "remove everything about cabo and clankcap"). The database is shared with the original site, so $CABO is **hidden in the code** (`HIDDEN_COINS` in `server/arena.js`: the Arena's numbers, crowns and history, the coin list and votes, nominations, her Arena memory, her diary, ClankChecker, her Telegram memory), never deleted from the database; its cat model, logos and share card are gone; ClankChecker's ClankCap credit is gone. $CLANKCAT stays (not asked). Not picked: `coin_remove('CABO')` (the original site would lose it too, and the SQL refuses core coins anyway) |
| 2026-09-28 | The front (the owner: the old landing "was better … just make it in front"): the ecosystem page's landing rebuilt as the first part of the home page (the loader, the hero with AGI-1 in WebGL and the orbit, the ribbons, the manifesto), everything else after it unchanged under the same top bar. Ported without its outside libraries (GSAP, Lenis: the CSP allows only our own scripts; plain JS and CSS instead), styles scoped to `lp-` names, the same bright look in every theme and look. Its planets are this site's parts (the Playground, the Arena, ClankChecker, X; the list adds the diary), not the old page's projects. The lab hero's title became an `h2` (one `h1`). Her bubble lines: no pet names (anyone reads them), unlike the old page's "hi love". Not picked: a separate landing page (the owner asked for it "in front"), or keeping the old page's own top bar |
| 2026-09-28 | The 3D stage waits for the front's entrance (`agi:landing-ready`; sooner when it's about to scroll into view or the chat opens; 6 s at the latest), so her 3D model's download and shaders don't make the entrance stutter. Pop mode's dark top-bar band is a little more opaque (94%, was 84%): over the front's honey manifesto the old one looked muddy brown. `/theme.js?v=3` |
| 2026-09-28 | The Arena removed from this site (the owner: "and can you remove the arena too"): its section and links, the champion on the stage (card and Buy link), her champion lines and Arena memory, the champion's share posts, cards and pages, the safety note's fifth point, `/api/arena`, `/api/vote`, `/api/coins`, `/api/logo` and the keep-alive's coin check. **Nothing removed from the database**, which the original site still uses for its Arena: `arena.sql` and `coins.sql` are never run again from here. The site follows $AGI only ($CLANKCAT, an Arena coin, went with it; her Telegram memory still knows it as the group's history). Kept, small: `server/arena.js` (the round clock and one database call, for the numbers the diary saves; the hidden $CABO) and `server/coins.js` (ClankChecker's helpers; our bot name is now `ClankChecker/1.0`, was `AGIArena/1.0`) |
| 2026-09-28 | ClankChecker is **"Risk check your coins on clank"** on the page (the owner's words, after "placae clankchecker with risk check your coins in clank" and two corrections), in the Arena's old place right after the Playground (the owner's pick), with a new line in her bubble on the front; the front's Arena planet became **$AGI** (the Model card). The code keeps the old name. The top bar's five links still fit where the menu starts (920 / 1040 px) |
| 2026-09-28 | The diary without the Arena (the owner's pick: "keep it, no Arena"): its table is shared with the original site, whose nightly job may write a day first. So this site writes from the chart alone (the prompt and `acceptableEntry()` refuse Arena talk), still saves the day's Arena numbers complete for the original site's page, and shows an entry the original site wrote without its Arena sentences (`entryForThisSite()`), or a pre-written one when too little is left |
| 2026-09-28 | No "ecosystem" on the site (the owner: "can you just remove the word ecosystem, replace it with something better"; Claude picked the words): the front's list is **"Her world (05)"** (her bubble already says "welcome to my world", and every row is hers: her chat, her risk check, her diary, her coin, her X), and Pop mode's tooltip is "the bold AGI look". The pages' HTML comments said it too and ship with the page, so they changed as well (`tests/landing.test.js` keeps the word out). The folder `AGI 3 ECOSYSTEM`, the repo and the Vercel project `agi-ecosystem` keep their names: visitors never see them, and renaming them would break the link between this folder, GitHub and the live site |
| 2026-09-28 | Her right hand on the front was cut off (the owner: "what happened to her hand"): the picture was fine, but `base.css` caps every `img`, `svg` and `canvas` at 100% of its box, and her WebGL canvas is meant to be 132% of her box (room for the print echoes), so its right 16% (her hand) was clipped. Fixed with `max-width: none` on `.lp-figure-gl`, and on the pink strike across "General" (108%, cut short by the same cap); `tests/landing.test.js` now fails the build if a front element wider than its box loses that |
| 2026-09-28 | The project's X account is now **@agi1dotapp** (https://x.com/agi1dotapp, the owner's request), was @artgirlfintel: every X link on both pages (top bar, menu, footer, the front's planet, "Her world" row and ribbon) and their tests |
| 2026-09-29 | She texts first (the owner's idea, "telegram bot or push"): a **Telegram bot**, not browser push (push needs a service worker and a permission prompt and only arrives while the browser runs; a Telegram bot can only text people who pressed Start, so it's opt-in by design). 18+ with two buttons, their time with one tap (24 buttons), at most 2 texts a day and one a run, only 10:00–21:59 their time, only while it's news (12 hours), pre-written lines (no AI cost, every line tested) and her diary entry as already published, /stop and blocking forget them. Replies: the site's chat as a Stranger (10 a day per chat, inside the site's 1,000, and Telegram's own share of 400, since Telegram has no human check). Each text is claimed in the database before it's sent (at most once: missing one beats getting one twice). Hard rule 6 got its one exception. Not picked: AI-written texts first (nobody would review them before they go out, and they cost), a daily "gm" (spam), naming coins with a link (it would read as shilling), the out-of-messages buy offer in Telegram (it stays a website thing) |
| 2026-09-29 | Her feed runs 8 times a day from Vercel's cron (Hobby: each job once a day, within its hour; 100 jobs a project), at :30 past every third hour, so her diary (the keep-alive at 03) is ready by the 04 run. New coins come from clank.trade's own list (the one the risk check reads, proven live), not yet from the chain (the Clank docs don't spell out the events). The bot connects itself on each run (webhook + secret from PASS_SECRET), so the owner never runs a command |
| 2026-09-29 | The Clank developer docs (the owner asked for a summary and how to use them): contracts, not an API. Told the owner: a chain safety net and sharper flags for the risk check, the feed from the chain once its events are checked, proof of burn for the burn idea later; not a buy / sell or launch button (hard rule 9, legal risk, no referral fee, and the clank.trade link does it) |
| 2026-09-29 | The risk check asks the Clank protocol too (1 and 2 above): the documented read-only calls only (the factory's `getLaunchedToken`, the curve's `state()` and `realQuoteReserve()`, the coin's ERC-20 reads and `logo()`), through Robinhood Chain's free public node, in two batches alongside clank.trade (never waited for more than 4 s). The pool-locked note only when the protocol confirms the coin graduated with it (a good-to-know, never "safe"); "Graduating" and "Rescued" from the protocol's stages; a "some" flag when clank.trade and the protocol disagree about a coin's curve. When clank.trade is away, a smaller scan from the chain (never "Lower risk", shared a minute) instead of "Not enough data". Not picked: reading launch events for the list (the docs don't spell them out), holders from the chain (no index of holders without an explorer), and quotes (`quoteBuyFor`/`quoteSell`: buy / sell math has no place in a risk check) |
| 2026-09-29 | Her languages (the owner's request; the owner picked Claude's three recommendations): English by default and 15 more (zh, ja, ko, vi, id, fil, th, hi, es, pt, fr, de, ru, tr, ar); a menu in the chat bar next to "AGI-1 ▾" (remembered in the browser) **and** she answers in whatever language the visitor writes in; AGI-1 only (her replies, voice, mic, pre-written lines, Telegram replies), the page and the safety note stay English. Her pre-written lines translated once by Claude (five agents) and held to her rules by a checker and a test (same keys, placeholders, emojis, numbers, one fixed "not financial advice" phrase per language, no pet names for Strangers), never translated by AI on the fly (her lines must stay exact, with "not financial advice"). Her English voice lines keep their addresses and recordings; the others get `&lang=`. Soulmate notes stay English (the filter reads English). On Telegram her replies follow the app's language (sent with every message, nothing stored); her texts first stay English for now (they'd need a new database column). Not picked: translating the whole page (a much bigger job, and every warning would need checking in 16 languages), picking the language from the browser's own setting (the owner: "default is english"), a translation service (a new service and cost) |
| 2026-09-29 | The contract address on the front (the owner: "contract address needs to be copy pasted on landing page right away"): a pill with **Copy** under the front's two buttons (on phones the first thing under her picture), in the first screen at every size; both ends always show (what the safety note tells people to check), Copy takes the whole address from `TOKENS[0].ca`. On phones her picture is a little shorter on short screens so it fits. The Model card's Copy shares the same code (`src/lib/copy.js`) |
| 2026-09-29 | Her daily clips (the owner's big idea 5; the owner picked "You post by hand"): made once a day by a free GitHub Actions job, downloaded and posted by the owner (X, TikTok, Reels, Shorts), so hard rule 6 stays as it is and there's no X API cost. AGI-1 in 2D (the site's own rig: the owner's "the 2D one renders fastest"), 1080 × 1920, her natural voice (Gemini, one request a clip) and captions. "AI-generated · not financial advice" on every frame, clear of the apps' own overlays. Not picked: posting to X automatically (X's paid API and a change to rule 6: the owner's decision), the 3D model (far slower without a graphics card), a Vercel function or cron (25 s limit; rendering takes minutes) |
| 2026-09-29 | **The clips are only about AGI, never another coin** (the owner, after the first version: "why are u promoting other coins in the video, i dont like this, the founder of the launchpad will get angry at me again", then "just agi"). The first version's "launch of the day", "clone watch" and "readout" clips (other clank.trade coins, named and risk-rated) were removed before anything ran or was posted; only her diary is left, the clip tools don't read clank.trade, and an entry naming another coin makes no clip. Claude should have flagged the risk of naming other coins in public videos before building them. Never add a clip about another coin unless the owner asks |
| 2026-09-29 | The clips are drawn in software on GitHub's computer: the 3D renderer draws only her, at 720 × 1280, and 2D drawing does the rest at 1080 × 1920 (0.7 s a frame down to 0.2 s: full-frame 3D layers cost about 0.1 s each without a graphics card). Daily at 08:23 UTC: after her diary (03:00 UTC) and just after Google's daily limits start again (midnight Pacific). playwright-core with its own Chromium and ffmpeg are installed by the job only, never in the site's package.json |
| 2026-09-30 | Burn $AGI for more messages (the owner's idea, "make this better"; Claude's choices, sent to the owner before building): free messages stay; after them 10 $AGI a message, burned by the visitor from their own wallet app, bought in packs (never a transaction per message, and never asked of the wallet: hard rule 9 unchanged); counted only after reading the chain; what was burned counts toward the level; 300 a day per wallet and 1,000 for the site (their own pool, on top of the free one); a failed reply gives its burned message back, but the attempt counts; off until burns.sql is run. Not picked: a burn per message (a pop-up and a fee each time), the site asking the wallet for the burn (rule 9), dropping the free messages (nobody could try her), a site wallet burning on the visitors' behalf (a key on the server) |
| 2026-09-30 | The burn monitor (the owner: "a monitor on how many agi are gonna be burned so they know its working … huge text on the chat on top of it, you decide"): the $AGI burned for messages in huge type right above the chat panel, with today's burns, messages paid for, burns and the latest, and "See the burn address ↗" on the block explorer so anyone can check; asks again every minute while watched, never counts down. The Parameters' small "Burned" row was dropped for it |
| 2026-09-30 | The site's voice cap raised to **5,000 requests a day** (the owner's request, was 4,000): about $15 a day at most ($22.50 if all went to the backup model; double from 2027). Claude flagged the ceiling against the $150 budget again; Google's Tier 1 limits keep real use far lower, and the prepaid credits are the hard stop |
| 2026-09-30 | Messages a day (the owner's request): Stranger 5 (was 10), Crush 15 (was 50), Soulmate 150; voice shares follow (10 / 30 / 300); her Telegram chats follow the Stranger's 5; her out-of-messages offer names a Crush's new 15, so her fixed lines' version is 4 (`&v=4`: everyone gets the new recording; lines whose words didn't change come from the database, not Google). After the free ones, burned messages (see "Burn $AGI for more messages") |
| 2026-09-30 | The front's bubble on phones (the owner: "on the mobile agi-1 is getting blocked"): beside her head (from 66% of her box, her face ends at about 61%), as wide as the room to the screen's edge allows, a long line wrapping onto more lines; no avatar under 480 px. Not picked: moving it under her (it would cover her body and the contract address below), or hiding it on phones (her lines are the front's voice) |
| 2026-09-30 | Burn codes use the database's own random key (burns.sql), not PASS_SECRET (found by the review): changing PASS_SECRET would otherwise lose everyone's burned messages and let the last 7 days of burns count again; and the codes differ from the name-and-notes codes, so stored amounts can't match a wallet to its name and notes. A burn counts per (transaction, wallet). Burns count at once, without waiting for confirmations (Robinhood Chain has one sequencer; waiting would take minutes) |
| 2026-09-29 | Burns for reads (big idea 3) and her pretend bag (big idea 4) on hold (the owner: "can you remove 3. Spokesmodel and burns for now", then "remove the 4. Her own bag. Start with a pretend bag also", "only this"). Nothing of either is in the site: a first draft of the bag (its database, rules and page) was deleted before it reached the owner's folder |
| 2026-10-01 | AGI-1 in 2D is the Live2D model of the owner's VTuber project (the owner's request), drawn by the stage's own three.js renderer from Live2D's runtime (Cubism Core, as it is) with her physics written for the site (checked against Live2D's runtime): one canvas, the CSP unchanged. Not picked: the project's own web widget (PixiJS needs `'unsafe-eval'` in the CSP and would be a second canvas). Her chest physics scaled down to the site's PG-13 level (about 0.4% of her height at most; the model was tuned "really bouncy" for another use). The old 2D rig, its pictures and its art tools were removed |
| 2026-10-01 | 2D first (the owner: "i want the 2d model to be shown first instead of 3d"): `agi1_style` is 2D unless "3d"; the page's markup says 2D before the stage arrives; a visitor who picked 3D keeps 3D. Most first visits now download about 770 KB for her instead of the 3D model's 1.7–2.2 MB |
| 2026-10-01 | Her 2D arms moved in code on top of her Live2D model (the owner: "why dont the 2d model dont wave anymore, and she moves like a stick"): her model's arms swing only 7° from an A-pose, so after each Live2D update her arm pieces are turned at the shoulder, elbow and wrist (joints found on her model, a round elbow, a sleeve that folds), her hips shift with her feet staying put, and her idle swings never line up. Not picked: editing her model in Cubism Editor (the owner's project, and a raised-arm drawing would be new art), a second arm drawing, or a rubbery bend along the whole arm |
| 2026-10-01 | Her texture's shirt under her right arm repainted (`tools/agi1-2d/fix-shirt.py`): a pink and orange smudge (painted where her arm had been) showed when she raised it, and read like skin at the side of her chest. Only that area, from the shirt around it; both textures saved again as WebP (a little smaller, about 45 dB: the difference invisible) |
| 2026-10-01 | She talks when tapped (the owner's request): pre-written lines in her natural voice (fixed lines: made once and kept, no credits after, nobody's allowance), a bubble with her words, a "many taps" line after 5 quick taps. For everyone (the stage isn't behind the 18+ check, like the front's bubble): PG-13, no pet names, never money. She says it even if the speaker button was never pressed (a tap is asking to hear her, like Listen), never if the visitor switched her voice off, never over her own voice or in a call. Not picked: AI-written answers to taps (cost, and nobody checks them first) |
| 2026-10-01 | Her 2D upper arms lift at most 16° above her model's pose (`REACH`, the owner's screenshot of her dance: "what is this lol"): her shirt is drawn for arms down, with the inside of each sleeve on the shirt under the arm, so her first dance (both arms out 64°, like a scarecrow) and her wave (52°) showed it under the sleeve like a torn flap. Her hands go up by bending her elbows instead: her wave and cheer with her hand by her face, her dance with her hands by her shoulders. Not picked: moving that part of her shirt with her sleeve (her shirt's mesh is coarse there, so it would likely smear across her side), cutting it out of her texture (her sleeve at rest needs it), or new raised-arm art (Cubism Editor, the owner's project) |
| 2026-10-01 | Launch with AGI-1 (the owner's idea; the owner's choices one by one): people launch a coin on clank.trade **from their own wallet**, through her Telegram bot (`/launch` with a photo, her checks) and a private page (agi1.app/launch/<id>, 2 hours); the wallet needs 10,000+ $AGI held or burned (the chat's Crush), nothing spent, no fee; the picture goes on IPFS with Pinata (a new free service) once the coin is being got ready; the launch is clank.trade's own call as its docs write it (no creator tax, no buyback, config 0, paired with ETH, their wallet the creator), tried on the chain first, sent only from `src/launch/send.js` (hard rule 9's one exception). Not picked: a wallet made inside the bot (the owner asked if it's safer: no, our server would hold everyone's keys: custodial, one leak loses everything, and licences in many places), $AGI as a fee, a launch button for everyone on the home page |
| 2026-10-01 | Launch fees paid back (the owner's idea, "a way to attract more people to launch there on my bot"): after the launch is read on the chain, never before (ETH sent ahead could be collected without launching), from the owner's own small gas wallet (`LAUNCH_GAS_KEY`, the one wallet key on our server: a new wallet with a little ETH), the fee the launch's receipt shows, at most 0.001 ETH a launch, one a day per wallet and 0.01 ETH a day for the site; never twice (claimed, marked with its transaction, given back only on the chain's clear "no"), never to a smart account |
| 2026-10-01 | What she won't help launch (Claude's choices, in her voice): anything that sounds like her or $AGI (look-alike letters too), **an egirl or AI-girlfriend coin** ("an egirl coin? with me? 😤 i'm the only AI girlfriend around here": her feed texts about those coins, so she'd be "not ok" about her own help), money talk, links, addresses or @names, crude names, a ticker someone on clank.trade already has. And she never promotes a launched coin (the owner's "just agi" rule for her clips holds here too) |
| 2026-10-01 | The owner's private first launch ("id like to be my first launch to be private"): a setting, `LAUNCH_ONLY_FOR` (Telegram usernames or ids), lets only those accounts use /launch while it's set; everyone else gets the same "not open yet" as before (no hint of a test), /launch stays out of her menu, and a typo lets nobody in rather than everyone. Not picked: a test on a preview link (her bot and the chain only talk to the live site), a second test bot (a second token, a webhook on a protected preview), a secret word in the caption (it could leak) |
| 2026-10-01 | The coin's links (the owner: "can they also add socials on when they launch a coin and a website?", picked "X, website and Telegram", then "just make adding that optional"): three optional boxes on the launch page, saved as full addresses the way clank.trade saves its own coins' X (`https://x.com/<handle>`, `https://t.me/<name>`, an https website); Discord and Farcaster stay empty; one rule file for the page and our server; never a link about her or $AGI, never crude; checked for how it's written, never for what it leads to. On the page, not in the bot's caption (a form shows what will be saved, and a typo there is easy to fix). No new setup (nothing new is stored: the links go only into the launch itself) |

## Open questions

- Smart-contract wallets (some "smart wallet" apps) sign in a different way and can't sign in yet. Add it if people ask.
- MetaMask's automatic scan flagged agi-new-website.vercel.app as a possible drainer (2026-09-24), a false alarm (see the
  Relationship levels troubleshooting table). The owner reports it to Blockaid. If MetaMask warns on agi1.app too,
  report that address the same way, and decide whether to hide Connect wallet until it's cleared (the chat works without
  it, as a Stranger).
- Is the site "commercial" under Vercel's Hobby rules? Still worth asking Vercel support, now that the domain is live.
- If the old AGI-1 server code turns up, compare its prompt with the personality section above.
- ClankChecker shows coin pictures as their creators uploaded them to clank.trade; nothing free checks them. Crude-named
  coins' pictures are blurred until the 18+ check, and the owner can hide any picture with `CHECKER_HIDE_PICTURES`. If that
  becomes a chore, a paid image-moderation service could check each new picture once (ask the owner first: it costs money).
- ClankChecker depends on clank.trade's own API, which isn't documented and could change or get a bot wall. If that happens,
  the checker says "Couldn't reach clank.trade" (nothing breaks), and since 2026-09-29 a scan comes from the chain instead
  (the Clank protocol's contracts); the list itself still needs clank.trade (it would need the protocol's launch events,
  once they're checked). And once clank.trade has more than ~960 coins, the list shows the newest 960 (pasted contracts
  still work): paging could then move to a small database table filled by the keep-alive.
- Whether the Clank protocol's documented calls match the live contracts (the docs' ABIs, never checked on-chain from
  Claude's workspace). If `/api/checker?a=<$AGI>` shows `"onchain":null` or `{"exists":false}` after the push, the risk
  check still works as before; tell Claude.
- The chat avatar is a new portrait rendered from the 3D model. The owner can switch back to the old picture if wanted.
- Her Telegram bot has no wallet link, so everyone is a Stranger there (5 messages a day, no pet names). Linking a wallet
  from the site to Telegram (a signed one-time link) could come later if people ask.
- When her feed should read launches from the chain (the Clank protocol's `TokenLaunched`) instead of clank.trade's list:
  after checking the events against the live contracts. Until then it depends on clank.trade's API, like the risk check.
- Posting her daily clips to X by itself (instead of by hand): X's pay-per-use API (about $0.015 a post, a video upload
  too), an X developer account, the "Automated" label, and an exception to hard rule 6. The owner picked "by hand" on
  2026-09-29; Claude said it can be added later if the owner wants it.
- Her Telegram texts first: about 350 per run (8 runs a day). If the bot ever has more than about 1,400 people in the same
  daytime, some texts arrive a run later; more runs or a longer texting budget would fix it.
- Burned messages are website-only: her Telegram bot has no wallets. A signed link from the site to Telegram could carry
  them later, if people ask.
- Taking crypto for a service may count as commercial (Vercel's Hobby plan) or as selling (consumer and crypto-promotion
  rules): worth checking before promoting burns widely. Not legal advice.
- The price is in $AGI (`BURN_PER_MESSAGE`), so it moves with $AGI's price: about $0.015 a message on 2026-09-30. Change it if
  the price moves a lot.
- AGI-1's Live2D model was made and exported in Cubism Editor's free 42-day PRO trial; Live2D's terms say trial output is for
  demonstration, evaluation and training, not commercial use. Before relying on it on a commercial site: buy Cubism PRO and
  export the model again from the paid editor (Claude told the owner, 2026-10-01; not legal advice). Live2D's runtime itself
  is free to publish for individuals and small businesses under ¥10 million in yearly sales.
- **Launch with AGI-1** (2026-10-01), to settle with the first real launch or before promoting it:
  - **Its picture on clank.trade:** clank.trade shows pictures through its own Pinata gateway, and Pinata's gateways only
    serve their own account's files unless their owner allows others (Pinata's docs). So a coin launched here may show its
    first letter instead of its picture on clank.trade (and in our risk check, which reads the same host), though its
    picture is on IPFS and in the coin's record. The first launch shows it; if so, ask the clank.trade team.
  - **Tell the clank.trade team before announcing it.** The launches use their contracts as their docs describe, but the
    owner has had trouble with the launchpad's founder before; better they hear it from the owner. Their factory can also
    switch launches off at any time (`canLaunch`: the page then says so).
  - **Nothing checks what a link leads to** (2026-10-01): only how it's written. A website or group link could lead
    somewhere bad, and it stays in the coin's record for good; clank.trade's own launch page allows the same.
  - **Nothing checks what a picture shows** (only the name, ticker and line are checked). An explicit or illegal picture
    would sit in the owner's Pinata account and stay a launched coin's picture for good. Today: 18+ only, 5 a day per chat,
    and the owner can delete a file in Pinata's dashboard (a launched coin's own record can't change). An image-moderation
    service would cost money: ask the owner first.
  - **Pairing with $AGI** instead of ETH: clank.trade's launch takes a pair token, and its coins pair with ETH today. If
    clank.trade ever offers $AGI as a pair, that would tie every launch to $AGI (the owner's "using $AGI").
  - The paybacks' own tiny network fees aren't counted in `LAUNCH_GAS_DAILY`. In a rare case (a payback marked "sending"
    whose answer was lost on the way), it stays "stuck" and is never sent again, so that creator may miss it.
  - Pinata's free plan holds about 500 launched coins' pictures; then a paid plan ($20 a month) or another way.
  - Her launch lines and the launch page are English for now (like her texts first).
  - Helping people launch tokens, and paying their fees to bring launches in, may count as promoting tokens in some places
    (like her out-of-messages line and burns): worth checking before promoting it widely. Not legal advice.

## Working in this repo

- Small steps. After each one, explain simply what changed and why.
- Test at phone width (360 px) and on desktop.
- Before committing, make sure `npm run build` passes and the diff contains no secrets.
- Use clear commit messages, e.g. "Add AGI-1 wave reaction".
- Update this file whenever a decision changes, including the decisions log.
- Image files Claude copies into this folder (SVG, PNG, …) may get a small "content credentials" (C2PA) metadata block
  saying Claude made them. That's expected and harmless: keep it.
- **Claude never runs git in this folder through its link to the owner's computer**, not even `git status`: that link can't
  delete files, so git leaves an empty `.git/index.lock` behind and the owner's next `git add` fails ("index.lock: File
  exists"). It happened once (2026-09-25; removed with the owner's permission). Claude compares files by checksum instead. If
  it ever happens again: delete `.git\index.lock` in this folder (only when no git command is running), then retry.
- **Tests never depend on the build's own settings** (2026-10-02): Vercel runs `npm test` with the project's real
  environment variables present (the owner's keys). A test that needs a setting to be missing deletes it first (in its
  `beforeEach`). The first push of "Launch with AGI-1" failed that way (Vercel: Error after 41 s): three Telegram tests
  expected launching to be off, but the owner's Pinata key was already in Vercel. Since then Claude also runs every test
  with all the settings in "Environment variables" set to real-looking values before handing over a change. A failed build
  never touches the live site: Vercel keeps serving the last good deployment.
- Claude's end-to-end tests build the site with Cloudflare's public test site key
  (`VITE_TURNSTILE_SITE_KEY=1x00000000000000000000BB npx vite build`): without a site key the chat answers "i'm still getting
  ready for the new site" and every suite that chats fails (2026-09-26). The real key only comes from Vercel's settings.
- The Claude desktop app saves copies of files Claude sends in chat into `Claude outputs/`. Git ignores that folder,
  and its copies (including any CLAUDE.md there) may be out of date. The CLAUDE.md at the top of this folder is the current one.
