# GMGN.ai web terminal: screen-by-screen research (for TRENCHING SIMULATOR's GMGN-style parody terminal)

Researched 2026-10-21 by a research subagent. **Research only: no repo file was changed.**

## 0. How this was researched, and how sure each fact is

- **Network limits in this workspace:** gmgn.ai, docs.gmgn.ai, x.com, web.archive.org, reddit, youtube and medium are
  blocked by the egress proxy (403), and WebFetch can't resolve any host. So **no live screenshot, no page HTML, no CSS
  of GMGN was seen.** What exists:
  1. **GMGN's own open-source agent repo, `GMGNAI/gmgn-skills`** (cloned; https://github.com/GMGNAI/gmgn-skills): the
     API's field names, chains, launchpads, filters, wallet tags, order types and their limits. Authoritative for *what
     data* the web shows (the web is built on the same backend), not for *how it looks*.
  2. **Search summaries of docs.gmgn.ai, gmgn.ai/blog and third-party reviews** (WebSearch only returns model-written
     summaries of pages; many GMGN docs pages are 1–2 years old).
  3. One image from the repo (`static/gmgnagentskills.png`, the mascot banner), sampled for brand colors.
- **Confidence tags used below:**
  - **[C]** confirmed by GMGN's own docs/repo (may still be dated: docs pages are often 300–700 days old).
  - **[L]** likely: third-party reviews or older docs, consistent across sources.
  - **[U]** unconfirmed / inferred from general knowledge of the GMGN web app and its category (Axiom/Photon-style
    terminals). Treat as a design guess; **ask the owner for screenshots** (see §17) before claiming "exact".
- **Rule reminder for the build (CLAUDE.md):** describe, never copy: no GMGN logo, mascot art, screenshots, icon files,
  CSS or text blocks lifted from them. Parody name, own mascot, own icons, own words; layout and workflow are fair game.

---

## 1. Brand and visual identity (DESCRIBE ONLY: do not copy)

- **Name/wordmark:** "GMGN" (often "GMGN.AI"), bold uppercase sans; the name reads "GM, GN" (good morning / good night)
  [L]. The wordmark is green on dark [C: sampled].
- **Mascot:** a pixel-art green creature (frog/dino-like, big head, black outlines, light belly) [C: seen in the repo's
  banner `static/gmgnagentskills.png`]. **Do not draw anything resembling it.** A parody needs its own mascot (e.g. an
  8-bit AGI-1 face already exists in `src/games/trenchingsimulator/agi.js`, or a different pixel animal in a different
  color).
- **Colors sampled from GMGN's banner (for reference of the "feel" only):**

  | Role (in their art) | Hex |
  |---|---|
  | wordmark / brand green | `#64AD03` |
  | mascot body light green | `#9ED455` |
  | mascot outline green | `#54923A` |
  | highlight lime | `#E5FF95` |
  | belly tan | `#F3BE71` |
  | off-white | `#F0F5F5` |
  | near-black | `#0D0D0F` |

- **UI theme [U, consistent with every terminal in the category]:** near-black background (~`#0b0b0c`–`#111214`), panels a
  step lighter (~`#17181b`–`#1c1d21`), 1 px hairlines (~`#26272b`), white/grey text in 3 levels, **green = buy / up**,
  **red = sell / down** (GMGN docs: "in the trader list, green is the number of buys and red is the number of sells; on
  the wallet page bought is green and sale is red" [C]), a lime/green accent for primary actions, yellow/orange warning
  tags, blue/purple info tags. Very dense: 11–13 px text, tabular numbers, small rounded chips (4–6 px radius), lots of
  hover tooltips, tiny icon badges.
- **Light theme:** the embeddable GMGN chart has `theme=light|dark` [C]; whether the main web app has a light theme is
  unconfirmed [U]. Dark-only is safe for the parody.
- **Suggested parody palette (ours, not theirs):** keep "dark + green buy/red sell" (genre convention, not a GMGN asset),
  but pick our own accent hue (e.g. a mint-teal like the existing `scan` slot's `#2dd4bf` in `terminals.js`, or a
  yellow-lime distinct from `#64AD03`), our own mascot, our own wordmark lettering.

## 2. Global layout and navigation

### 2.1 Top bar (desktop) [L]
Left → right:
1. Logo (mascot + wordmark), click = home (Trenches).
2. **Main nav** (sources disagree on labels; both seen in 2026):
   - review (2026): **Trenches · Trending · CopyTrade · Monitor · Track · Portfolio · Rewards** [L]
   - GMGN's own /ai page header: **Trenches · Trending · WalletCopy · Monitor · Follow · Portfolio · Rewards** [L]
   - older docs pages: New Pair, Trending, Pump/Meme (became Trenches), Copy Trade, Monitor/Follow/Watchlist, Holding [C, dated].
3. **Search box** ("Search token / wallet / CA"; searches name, symbol, address, ENS across all chains [C: `market search`
   accepts `--chain all`]); keyboard shortcut to focus it [U: commonly "/" or Ctrl+K].
4. **Chain switcher** (dropdown with each chain's logo + name; current chain shown as an icon pill) [L]. The chain is also
   in the URL: `gmgn.ai/?chain=sol&tab=trending`, `?chain=bsc` [C/L].
5. Right side: deposit / wallet balance pill (native coin amount), settings/gear, notifications bell, language, account
   avatar / "Log in" (Telegram or wallet login; Telegram login required for automation/copy trade) [L/U].

### 2.2 Dockable bottom bar (2026) [L]
A toggleable dock with: **Wallet Tracker · Social Tracker (X/Twitter feed) · Holding · Watchlist · Rank · PnL · Signal ·
Callout** (Callout Reward launched 2026-10-19 [L]). Each opens a floating/drag-able panel over the page. Plus
"Draggable Pop-up" and streamer PnL overlay (announced April 2025) [L].

### 2.3 Chains (exact list)
- **API/agent chains** [C, `skills/gmgn-market/SKILL.md:59`]: `sol` · `bsc` · `base` · `eth` · `arbitrum` · `hyperevm`
  · `robinhood` · `arc` · `stable`; search also covers dynamically-enabled `tron` · `monad` · `megaeth` · `xlayer`.
- **Web marketing lists:** GMGN blog: 10 chains — **Solana, BSC, Base, Ethereum, X Layer, HyperEVM, MegaETH, Monad,
  Robinhood, Tron** [L]; GMGN FAQ: 11, adding **Arbitrum** [L]. **Stable** launched on web (mobile pending) [L]. Arc is in
  the API (testnet-ish newcomer) [C].
- **Native "money" per chain** (what amounts are shown in): SOL (Solana), BNB (BSC), ETH (Base, Ethereum, Arbitrum,
  Robinhood, MegaETH), HYPE (HyperEVM), MON (Monad), OKB (X Layer), TRX (Tron), USDC-like stable (Stable/Arc) [C for
  sol/bsc/base/eth in `skills/gmgn-swap/SKILL.md:84-96`; others U].
- **Fee share (DefiLlama, 30 days to 2026-09-13):** Robinhood 54.8%, BSC 29.7% of GMGN fees [L]. So Robinhood Chain is
  GMGN's biggest chain now: good fit for this site.
- **Launchpads per chain** (shown as small platform icons on cards and as filters) [C, `gmgn-market/SKILL.md:144`]:
  - **sol:** Pump.fun, pump_mayhem(_agent), pump_agent, letsbonk (Bonk.fun), bonkers, bags, memoo, liquid, bankr, zora,
    surge, anoncoin, moonshot_app, wendotdev, heaven, sugar, token_mill, believe, trends_fun, jup_studio, Moonshot, boop,
    xstocks, ray_launchpad, meteora_virtual_curve, pools: pool_ray, pool_meteora, pool_pump_amm, pool_orca.
  - **bsc:** fourmeme (four.meme), fourmeme_agent, bn_fourmeme, four_xmode_agent, cubepeg, likwid, goplus_creator,
    goplus_skills, openfour, flap, flap_stocks, flap_aioracle, clanker, lunafun, pool_uniswap, pool_pancake.
  - **base:** clanker, bankr, flaunch, zora, zora_creator, baseapp, basememe, virtuals_v2, klik.
  - **eth:** trench, clanker, klik, livo, stroid, printr, pool_uniswap_v2, pool_uniswap_v3.
  - **arc:** dyorfun_v3, dyorswap, trench, onmifun, sharcfun, klik; **stable:** dyorfun_v3, dyorswap, trench.
  - **robinhood:** not enumerated in the skill file; on-chain reality includes clank.trade, pools.trade, Pons, Long,
    Hookr (CLAUDE.md, 2026-10-21) [L].
- **Parody tip:** use our own made-up launchpad names per chain (e.g. "pomp.fun-ish" names are fine as jokes only if
  clearly different); keep platform as a tiny colored glyph in the card corner.

---

## 3. Trenches page (the home page; "SOL Trenches - GMGN.AI" is the site's page title [C])

### 3.1 Layout [C/L]
- **Three live columns side by side** (desktop):
  1. **New** (docs: "New Creations"; API `new_creation`) — just created, still on the bonding curve.
  2. **Almost bonded** (docs: "Completing"; API `near_completion`, returned under key `pump`) — curve nearly full.
  3. **Migrated** (docs: "Completed"; API `completed`) — graduated to a DEX pool.
  The 2026 hotkey docs call them **New / Almost bonded / Migrated** [C], so use those labels.
- Each column: header with its name, a **quick-buy amount input** (e.g. "0.1" with the chain coin icon) [U, category
  standard], a **filter/settings icon at the top right** ("each column has a parameter filter at the top right corner"
  [C]), and a **pause indicator**. Up to **80 tokens** per column [C, API limit].
- **Pause live feed on hover** [C]: while the pointer is over a column, it stops reordering/inserting so the card under
  the cursor doesn't jump; a small "Paused" chip appears [U for the chip]. Turned on automatically by hotkey mode A.
- New cards slide in at the top with a brief highlight flash [U].
- **Mobile:** the three columns become tabs (New · Almost bonded · Migrated) [U].

### 3.2 A token card (row) [C fields / U arrangement]
Each card is a compact horizontal row ~70–90 px tall:
- **Left:** token avatar (square, rounded, ~48–56 px) with a thin progress ring/bar = **bonding curve progress** (0–100%)
  [U look; `progress` field C]; a small **launchpad icon** in a corner [L]; hovering the avatar enlarges it [U].
- **Line 1:** **ticker** (bold) + name (grey, truncated), **age** ("3s", "12m", "2h" — `created_timestamp`), copy-CA
  icon, social icons: **X / Twitter**, website, Telegram, search-on-X magnifier [C fields: `twitter_username`, `website`,
  `telegram`]. Twitter **rename count** badge [C: `twitter_rename_count`].
- **Line 2 (metrics, tiny icons + numbers):** **holders** (`holder_count`), **TXs** (`swaps_1m/1h/24h`, buy/sell split),
  **Vol** (`volume_1h/24h`), **MC** (`usd_market_cap`, right side, colored), **Liq**, smart-money count
  (`smart_degen_count`), KOL count (`renowned_count`), **dev hold %** (`creator_balance_rate`), **top-10 %**
  (`top_10_holder_rate`), snipers (`sniper_count`), bundler %, insider/rat %, fresh-wallet %, bot % — each shown as
  icon+percent, turning **green when safe / red when risky** [U thresholds].
- **Dev badges:** creator status `creator_hold` / `creator_close` ("dev sold"), dev's created-count and how many
  graduated (`creator_created_count`, `creator_created_open_count`, `..._ratio`) [C].
- **DexScreener marketing flags:** paid ad (`dexscr_ad`), updated socials (`dexscr_update_link`), trending bar, boost
  amount [C].
- **Right edge:** **quick-buy button** showing the column's preset amount (e.g. "⚡ 0.1") [L]; one click buys.
- **Migrated column extra:** `open_timestamp` (when the pool opened), `complete_cost_time` (how long the curve took) [C].

### 3.3 Column filters [C: `gmgn-market/SKILL.md:598-634`]
Min/Max for: 24h volume, 24h net buy, 24h swaps/buys/sells, visitor count, **progress**, **market cap**, **liquidity**,
**age** (created, e.g. `30s`, `5m`), **holders**, **top-10 rate**, **rug ratio**, **bundler rate**, **insider ratio**,
entrapment ratio, private-vault hold rate, top-70 sniper hold rate, bot count, bot-degen rate, **fresh wallet rate**,
total fee, **smart money count**, **KOL count**, **creator balance rate**, creator created count / graduated count /
graduation ratio, **X followers**, twitter rename count, **Telegram call count**. Plus launchpad platform checkboxes,
"with socials", "no duplicate image/social", keyword include/exclude [L]. **Presets:** `safe` (rug ≤ 0.3, bundler ≤ 0.3,
insider ≤ 0.3), `smart-money` (≥ 1 smart wallet), `strict` (safe + smart ≥ 1 + 24h vol ≥ $1,000) [C]. Docs mention
"60+ metrics" [L].

### 3.4 Trenches hotkeys [C: docs.gmgn.ai/index/trenches-hotkeys]
- Opened from a **keyboard icon** in the Trenches header; it **turns green when active**.
- **Mode A (mouse + keyboard):** hover a column, **hold Z** (auxiliary key, default), press a **row key** → buys that row.
  While Z is held, big **number watermarks** (1, 2, 3…) appear on that column's cards. Turns on "Pause live feed on Hover".
- **Mode B (keyboard only):** **hold Space** (pause key) + press a **column key** (New / Almost bonded / Migrated) + a
  **row key**. Same watermarks.
- Other hotkeys exist for opening a token's Twitter info / website video previews [C, keys not given].

---

## 4. Trending page [C/L]
- **Interval tabs:** **1m · 5m · 1h · 6h · 24h** (API, current [C]); older docs: 1m/5m/30m/1h.
- **Table columns** (docs): **Token** (avatar, ticker, age, socials, tags) · **Age** · **Liq/MC** · **Holders** · **1h TXs**
  (buys/sells in green/red) · **1h Vol** · **Price** · **1m% · 5m% · 1h%** (green/red) · security mini-icons · **quick
  buy** button [C list, U order].
- Sort by any column; filter row: platform, "renounced", "frozen" (SOL), honeypot/verified (EVM), burn, has social,
  no duplicate image/social, DexScreener updated, wash-trading excluded, internal (curve) vs. out (DEX) market [C].
  **Default filters:** SOL = renounced + frozen; EVM = not_honeypot + verified + renounced [C].
- Each row's data fields [C, `gmgn-market/SKILL.md:368-470`]: rank, hot_level, price, market_cap, liquidity, volume,
  ATH market cap, initial liquidity, price change 1m/5m/1h, swaps/buys/sells, holder_count, gas fee, security fields
  (mint/freeze renounced, honeypot, open source, renounced ownership, buy/sell tax, burn status, top-10 rate, rug ratio,
  wash trading, insider rate, bundler rate, entrapment, sniper count, bot degen, dev team hold, top-70 sniper hold,
  lock %), dev status, smart_degen_count, renowned_count, bluechip %, socials, CTO flag, DexScreener ad/boost.
- **Hot searches** list (most-searched tokens, `visiting_count`) [C].

---

## 5. Token page (the core screen)

### 5.1 Overall layout (desktop, 3 zones) [C: docs "Token page: Chart - multicharts, Activity, Trading system"]
```
┌───────────────────────────────────────────────────────────────┬────────────────────┐
│ Token header: avatar · TICKER · name · CA(copy) · age · socials│                    │
│ Price  MC  Liq  Holders  Vol  1m/5m/1h/24h %  (tiny stats row) │  RIGHT COLUMN       │
├───────────────────────────────────────────────────────────────┤  Buy | Sell tabs    │
│ Chart toolbar: intervals 1s 30s 1m 5m 15m 1h 4h 1d · Price/MC │  amount + presets   │
│ · USD/SOL · fx indicators · markers on/off · Multicharts       │  slippage/fee row   │
│                                                               │  Buy button          │
│        candlestick chart (+ volume pane)                      │  TP/SL / Limit/Auto │
│                                                               │  ─────────────────  │
├───────────────────────────────────────────────────────────────┤  Security box       │
│ Tabs: Activity | Traders | Holders(N) | BC Owners | Dev Token │  (audit checks)     │
│       | Position / Limit / Auto (my orders)                     │  Pool info          │
│ dense table, live rows, wallet-type filter chips                │  Insiders/Snipers/  │
│                                                               │  First 70 buyers     │
└───────────────────────────────────────────────────────────────┴────────────────────┘
```
Optional far-left column: the user's **watchlist / holdings mini-list** [U]. **Instant trade**: a small draggable floating
buy/sell window that can sit over the chart [C].

### 5.2 Header [C fields]
Avatar, **ticker**, name, **contract address** (short `AbC1…xYz9` + copy), age, launchpad icon, socials (X, website,
Telegram, "search CA on X"), **community takeover (CTO) badge**, DexScreener paid badges, watch (star) toggle, share.
Stats row: **Price**, **MC**, **Liq** (+ locked/burnt icon), **Holders**, **24h Vol**, **TXs**, **ATH MC**, price change
1m/5m/1h/6h/24h tabs (green/red) [L]. Bonding-curve tokens: **progress %** bar and "x SOL in curve" [L].

### 5.3 Chart [C/L]
- GMGN uses a **TradingView-style chart** (the About page names a TradingView component with RSI and MACD [L]; the docs
  describe an **fx indicators** button "enter volume to add a volume indicator" [C]). For a parody, **do not use
  TradingView's library** (licence); our own canvas chart (`chart.js`) styled TV-like is right.
- **Resolutions** [C, kline API]: **1s** (1s is a Pro/paid feature in the API) · 30s · 1m · 5m · 15m · 1h · 4h · 1d.
  Embed widget intervals: 1S, 1, 5, 15, 60, 240, 720, 1D [C].
- **Toggles** [C]: **Price ↔ MCap** (default shows MCap for memecoins), **USD ↔ SOL** (native coin), **show/hide trade
  markers** (B/S bubbles for the user's own trades, and for filtered wallet types: dev, snipers, smart money, KOLs…:
  "selecting a wallet type in Activity shows its trades as markers on the K-line" [C]). **FOMO call markers** on the
  chart (GMGN blog, Sept 2026) [L].
- **Tools** [C]: crosshair with OHLC readout at top-left, horizontal line drawing, drawing toolbar on the left (TV-style)
  [L], log/auto/% scale, fullscreen, screenshot [U].
- **Multicharts** [C]: up to **8 charts** at once (grid), each its own token/timeframe, cross-chain allowed.
- **Live behaviour:** the last candle updates on every trade (sub-second), no full redraw; new candles append; price
  label on the right axis pulses green/red [U, category standard].
- **Colors [U]:** green up candles, red down, volume bars semi-transparent same color, dark grid lines barely visible.

### 5.4 Bottom tabs [C unless noted]
- **Activity** (live trades): columns **Time (age, e.g. "3s")** · **Type (Buy/Sell, green/red)** · **USD** · **Amount
  (tokens)** · **Price / MC at trade** · **Maker** (wallet short addr + **tag icons** + PnL on hover) · tx link. Filter
  chips by **wallet type: Smart Money, KOL/VC, Whales, New (fresh) wallets, Snipers, Large holders, Developer, Followed,
  "Rat" (insider)** and min amount; the user's own trades highlighted [C list, U column order]. Status labels for
  repeat makers: **New Holder, Buy More, Sell Part, Sell All** [C].
- **Traders / Top Traders:** every wallet that traded: balance, **bought (USD/amount/tx count)**, **sold**, **realized
  PnL**, **unrealized PnL**, total PnL %, avg buy/sell price, first/last trade, transfer-in flag ("bought vs received by
  transfer") [C fields: `token traders` response]. SOL/USD unit toggle for these figures [C].
- **Holders (N):** rank **TOP1, TOP2…** (`wallet_tag_v2`), address/name/avatar/Twitter, **% of supply**
  (`amount_percentage`, with a small bar), value USD, avg cost, PnL, tags, "is suspicious", "on curve", funding source
  (wallets sharing the same funder flagged as a cluster) [C]. Holder-distribution header: top-10 %, dev %, insiders %,
  snipers %, bundlers % [L]. Pool/exchange addresses marked (`addr_type` 2) [C].
- **BC Owners:** holders who also hold blue-chip tokens; "blue-chip index" [C].
- **Dev Token(s):** other tokens the same creator launched, with outcome (ATH MC, migrated or not) [C].
- **Position / Limit / Auto:** the user's own position on this token, open limit orders, auto (TP/SL/trailing) orders
  [C].
- **Wallet tags** (icons next to makers) [C]: `smart_degen` (Smart Money), `renowned` (KOL), `fresh_wallet`, `dev`,
  `sniper`, `rat_trader` (insider), `bundler`, `transfer_in`, `dex_bot` (with sub-icons for Axiom, Photon, BullX, Trojan,
  GMGN, Drops, PepeBoost, Padre bots), `bluechip_owner`, whale; per-token behaviour tags `paper_hands`, `top_holder`,
  `bundler` [C]. Icon legend page ("Featured Icon Definition") adds: Pump Smart Money, Diamond hands, bundled-tx icon,
  **large tx > $10k** icon, phishing-wallet icon, CTO, "launched on Pump/Moonshot", high/low initial liquidity [C].
  **Parody: draw our own icons for each category; keep categories.**

### 5.5 Right column: trade module [C/L]
- **Buy / Sell** tabs (Buy green, Sell red).
- **Order type** sub-tabs: **Market · Limit · Auto** (Auto = TP/SL/trailing, Dev Sell, migrated snipe/sell) [C].
- **Amount:** input in the chain coin (SOL/BNB/ETH), and **quick-amount buttons** (four or so preset amounts, e.g.
  0.01 / 0.1 / 0.5 / 1, each editable via a pencil) [L]. Sell: **25% · 50% · 75% · 100%** quick buttons and "**Sell
  init**" (sell enough to recover your initial cost; only while cost > proceeds) [C for Sell init; percentages L].
- **Settings presets P1 / P2 / P3** (three switchable presets of slippage + priority fee + tip + anti-MEV) — **NOT
  confirmed in any source** [U]; this pattern exists on several 2025–26 terminals. Safe to include as a parody feature
  but don't claim it's GMGN's.
- **Fee row under the amount** [C values]: **Slippage** (0–100%, or **Auto**; docs recommend 30–35% for automated
  orders, 50%+ for hot new tokens), **Priority fee** (SOL; min 0.0001, ~0.002 typical, 0.006+ for fast/auto), **Tip**
  (SOL; min 0.0001), **Anti-MEV** toggle/level **Off · Reduced · Secure** (needs priority ≥ 0.002 SOL; not on Base; not
  shown on Robinhood Chain, whose panel has slippage, priority fee and **max auto fee** instead). EVM chains show **gas
  (gwei)**: BSC ≥ 0.05, Base/ETH ≥ 0.01, and low/average/high levels [C].
- **TP/SL attached to a buy** (toggle under the buy button): up to **10 sub-orders**: take-profit at +X% sell Y%,
  stop-loss at −X%, trailing TP/SL with drawdown %; sell basis "of buy amount" vs "of current holding" [C].
- **Limit orders:** buy-low, buy-high (breakout), stop-loss, take-profit; trigger by price or MC; expiry **1h · 24h ·
  3d** [C].
- **Buy button** shows the amount ("Buy 0.1 SOL"); after a fill, a toast with tx link; position box updates.
- **Position box** (when holding): balance, value, **avg cost**, **PnL USD and %** (green/red), **share PnL** button.
- **Fee:** 1% per trade, shown in the quote [C].

### 5.6 Right column: audit / security box [C fields]
A checklist with green ✓ / red ✗ / yellow ! for: **Mint authority renounced** (SOL), **Freeze authority renounced**
(SOL), **LP burnt/locked %**, **Top 10 holders %**, **Honeypot** (EVM), **Open source / verified** (EVM), **Owner
renounced**, **Buy/Sell tax**, **Dev holding %**, **Insiders %**, **Snipers %** (top-70 snipers still holding),
**Bundlers %**, **Rug ratio**, **Wash trading**, **Fresh wallets %**, **Bot/degen %**, **Phishing/entrapment ratio**.
Thresholds example in docs: 10% for "dev/insiders hold a lot" [C].

### 5.7 Right column: pool info [C]
Creator address, pool created date, total supply, initial liquidity, current liquidity (base + quote), pair address,
DEX (pump_amm, raydium, meteora…), LP burnt %.

### 5.8 "Insider traders, Snipers, First 70 buyers" panel [C]
- A **grid of 70 small cells/dots**, one per first buyer, colored by status: **Hold**, **Buy More**, **Sell Part**,
  **Sell All**, **Transferred** (on Solana, sold vs transferred can't always be told apart). Dot colors not documented
  [U: e.g. green hold, bright green buy more, yellow sell part, red sell all, grey transferred].
- Summary: **Total Bought %** (of supply, by the first 70) and **Current Total Holdings %**; counts of snipers, insiders,
  scammer wallets. "Not real-time; reference only" disclaimer.

---

## 6. Settings (trade settings panel) [C/U]
GMGN's docs only describe the trade-related settings; a web "Settings" page with language/currency/colors is
**unconfirmed**.
- **Per chain:** slippage (manual % or Auto), priority fee, tip, anti-MEV level, gas level (EVM), max auto fee
  (Robinhood), **custom RPC** (backup submission path) [C].
- **Buy presets** (quick-buy amounts per column / per page) and **sell presets** (percentages) [L].
- **Quick-buy settings** in Trenches (amount per column) and **hotkey settings** (auxiliary key Z, pause key Space,
  column keys, row keys) [C].
- **Display [U]:** language (EN/中文/한국어 at least, as the TG bot supports [C for bot]), price vs MC default, USD vs
  native, compact numbers, "pause on hover", sound on/off for new tokens and fills, red/green convention.
- **Parody recommendation:** a settings sheet with: Preset P1/P2/P3 tabs (slippage, priority, tip, anti-MEV
  Off/Reduced/Secure), quick-buy amounts ×4, sell % ×4, hotkeys (Z/Space), "pause feed on hover", sound, price/MC
  default, USD/native default, player name (the owner's optional custom name).

## 7. KOL / Smart money / Track / Monitor / Copy trade / Sniper / Alerts (brief)
- **Track** (Wallet Tracker / Follow) [C]: live feed of trades by **KOL wallets** (`track kol`), **smart money**
  (`track smartmoney`), and **wallets you follow** (`follow-wallet`, filters side and min/max USD). Row: time, wallet
  avatar+name (+ Twitter handle), **Buy/Sell**, token (avatar, ticker), amount USD, MC at trade, the wallet's PnL on that
  token, quick-buy/copy button [C fields, U layout]. Follow groups for tokens, remarks (nicknames) for wallets [C].
- **Social Tracker / X Tracker** [C page exists: docs `x-tracker`]: tweets from followed accounts with token CAs
  detected.
- **Monitor (Monitor Square)** [C]: a square/grid of followed tokens and wallets with **Quick Buy button lower right**;
  alerts when followed wallets trade.
- **Copy Trade** [C]: Solana-only, max **10 concurrent tasks**, requires Telegram login; per task: target wallet, buy
  mode (fixed amount / ratio), max per trade, sell mode (follow sells / own TP/SL), anti-MEV off + auto slippage
  recommended, low priority fee.
- **Sniper / SnipeX / Auto** [C]: auto-buy new pools by filters, migrated snipe (buy at migration), migrated sell, Dev
  Sell (sell when dev sells), quick-buy + TP/SL.
- **Alerts:** Telegram bot **@Alert_GMGNBOT**; trading bot **@GMGNAI_BOT** [C]. **Signals** (`market signal`) types:
  price spike, ATH, MC key level, DexScreener ad/boost/trending bar/updated links, live stream, **bundler sell**, CTO,
  **smart money buy**, **KOL buy**, platform call, **large buy**, multi-buy, Pump/Bags/Banker claims [C,
  `gmgn-market/SKILL.md:1033-1057`]. These are excellent made-up "event" sources for the game's chatter.
- **Callout Reward** (2026-10-19): users "make the call, hold the bag, get paid when others trade through it" [L].
- **Rank / leaderboards** (dock item "Rank") [L]: top wallets by PnL — direct inspiration for the game's leaderboard.

## 8. Wallet profile page [C]
- **Header:** avatar, name/nickname, address (copy), tags (KOL, smart money…), Twitter handle + followers + blue check,
  **GMGN follow count**, remark count, wallet age (`created_at`), **funded by** (`fund_from`, amount) [C fields],
  Follow / Copy trade buttons, share.
- **Summary:** **7D / 30D** toggle: **PnL USD and %**, **win rate**, **balance** (native); stats: **TXs (buys/sells)**,
  **total PnL**, **unrealized profit**, **avg hold duration**, **total cost**, **avg cost per token**, **avg realized
  profit** [C].
- **Distribution** histogram: how many tokens bought returned **> 500%, 200–500%, 0–200%, 0 to −50%, < −50%** [U for
  bucket edges; C that the buckets exist (7D/30D)]. **Phishing check**: blacklist/honeypot purchases flagged [C].
- **Tabs:** **Recent PnL** (per token: token, last trade, unrealized, realized, total PnL, bought/sold amounts, avg
  prices, hold time) · **Holdings** (token, balance, value, avg cost, PnL, duration) · **Activity** (time, type, token,
  amount, price, value) — each with a **share** button on the right [C].

## 9. Portfolio / Holding [C fields]
Holdings table: token, balance, USD value, cost of position (`accu_cost`), realized / unrealized / total profit and %,
buy/sell counts, first/last activity; PnL calendar/summary [U]; withdraw (web only) [L].

## 10. PnL share card [L/U]
- Shared from a held token's page (position box "Share") or from the wallet page tabs (Recent PnL / Holdings / Activity
  share buttons) [C].
- **Custom backgrounds:** MP4 video (≤ 10 s) and GIF backgrounds since mid-2025 (GMGN posts on X, ChainCatcher) [L].
  Default backgrounds are GMGN-branded art [U].
- **Layout (typical for the category, details unconfirmed [U]):** landscape card ~1200×675; top-left logo + wordmark;
  big **token ticker**; huge **PnL %** (green "+523.4%" / red); below: **Invested / Sold (or Position) / Profit** in the
  native coin and USD; hold time; the user's **name/avatar** and **referral code** text; often a **QR code** to the
  referral link (QR unconfirmed for GMGN) and "Join via [link]" footer. Referral program: 10–30% commission, `?ref=` code
  shared by web and Telegram [C].
- **Parody card (ours):** 1200×630 (the game already has a share card in `results.js`/`share.js`): our parody logo,
  ticker (made-up), big multiple and %, "Bought / Sold / PnL" in play-money coin + USD, hold time, player's optional
  name, "Play money · not financial advice · agi1.app/games/trenchingsimulator", and **no real referral**; optional
  animated background is overkill — a few selectable static backgrounds (our art) are enough.

## 11. Mobile web and app [L/U]
- **Apps:** Android `com.gmgn.app` (update 2026-09-30; wallet tracker limits 100 activities / 365 days), iOS "GMGN -
  Meme Track" (id 6745328711); App v3.0 added signal calling and multi-chain wallet tracking; Chrome extension [L].
- **Mobile layout [U]:** bottom tab bar (Trenches/Home · Trending · Track · Assets/Portfolio · Me), Trenches columns as
  tabs, token page stacked: header → chart (shorter, swipe intervals) → big fixed **Buy / Sell** buttons at the bottom
  opening a **bottom sheet** with amount presets, slippage/fee summary line, and the confirm button; tabs (Activity /
  Holders / Traders) under the chart.
- For the game: the existing Trench Board phone patterns (bottom bar, trade sheet) fit; mirror them.

## 12. Smoothness, live updates, sounds
- **Live data:** WebSocket push; trenches cards appear in real time; numbers update in place; activity rows prepend
  [U, category standard]. "Pause live feed on hover" exists precisely because the list moves constantly [C].
- **What makes it feel "no lag" (implementation advice):**
  - batch DOM updates into one `requestAnimationFrame` per frame; update text nodes in place (never rebuild rows);
  - keyed rows with stable heights, `contain: layout paint` on cards, `content-visibility: auto` for off-screen rows;
  - insert new trenches cards at the top with a 150–250 ms slide/flash (CSS transform/opacity only), cap 80 per column,
    recycle nodes;
  - chart: draw on canvas, redraw only the last candle per trade, full redraw on resize/interval change; throttle to
    ≤ 60 fps; use `devicePixelRatio` capped (the game already caps canvas pixels elsewhere);
  - number tweening for PnL (short, ≤ 200 ms) and color flash on change (green up / red down, 300–600 ms fade);
  - respect `prefers-reduced-motion` (no flashes/slides).
- **Sounds:** GMGN has notification/alert sounds for Monitor/alerts [U]; no source confirms Trenches sounds. The game's
  `sound.js` blips (new coin, fill, migration) are a fine parody, off by default or quiet, with a toggle.

## 13. Hotkeys (summary)
Trenches: hold **Z** + row key (mouse mode), **Space** + column key + row key (keyboard mode) [C]. Token page [U]: B/S to
focus buy/sell, number keys for presets, Esc to close sheets. Search focus [U].

## 14. Names GMGN uses (for parody mapping)
| GMGN term | Parody suggestion (ours) |
|---|---|
| Trenches | "Trenches" is generic slang: keep, or "The Pits" |
| New / Almost bonded / Migrated | keep (generic launchpad terms) |
| Smart Money | "Big Brains" / keep "Smart money" (generic) |
| KOL | "Callers" (the game already has made-up callers) |
| Rat trader | "Insider" |
| Copy Trade | "Shadow" |
| Monitor / Track | "Stalk" / "Watch" |
| P1/P2/P3 presets | "Preset 1/2/3" |
| Sell init | "Take my initial" |
| Anti-MEV Off/Reduced/Secure | "Sandwich shield: Off / Some / Max" |

## 15. Chains and live coins: do new chains need API keys? (for the owner's question)
The live relay (`tools/trench-relay/lib/sources/dex.mjs`) already maps chains to DexScreener (`EVM_CHAINS = { bnb:
'bsc', base: 'base', robinhood: 'robinhood' }`, line 15) and reads **one** `/token-profiles/latest/v1` list for all
chains (line 88): adding chains costs **no extra profile requests**, only more `/tokens/v1/<chain>/<addr,…>` market
lookups (≤ 30 addresses each, inside the existing 240/min budget).
| GMGN chain | Live source that would work | New key needed? |
|---|---|---|
| Solana | already: PumpPortal/PumpDev + Helius | Helius key (already set) |
| Robinhood | already: clank.trade + DexScreener | no |
| BSC, Base | already: DexScreener profiles | no |
| Ethereum, Arbitrum, HyperEVM, Monad, MegaETH, X Layer | DexScreener profiles (listed coins only), same code path | **no** (DexScreener is keyless); chainId strings to verify live (likely `ethereum`, `arbitrum`, `hyperevm`, `monad`, `megaeth`, `xlayer`) [U] |
| Tron | DexScreener `tron` [U] | no key, but **addresses are base58 (`T…`)**, not `0x`: the relay's parse/address checks (`isEvm`, address regexes in `parse.mjs` and `live-chains.js`) need a Tron rule |
| Arc, Stable | probably not on DexScreener (testnet-like) [U] | skip |
- Each new chain also needs its native coin's USD price (wrapped token address on DexScreener: WETH on Arbitrum/MegaETH,
  WHYPE, WMON, WOKB, WTRX) [U addresses: look them up live, never from memory].
- **Every-launch feeds** (like PumpPortal for Solana) don't exist keyless for four.meme (BSC), SunPump (Tron), etc.; they
  would need an RPC node (Alchemy/QuickNode/Ankr free tiers = **a key**) and per-launchpad event decoding. Not needed if
  "coins as they get listed" is acceptable (the BNB/Base behaviour today).
- Busy-chain caveat: DexScreener profiles are paid listings, so the newer chains may often be "quiet" (fewer than
  `REAL_ENOUGH` = 8 real coins): stand-ins fill in, as on BNB/Base today.

## 16. Implementation notes for the parody GMGN-style terminal (fits the existing game)
- **Slot:** `terminals.js` already has `scan` ("Trench Scan … Scan new coins, smart money and every wallet", features
  "New, almost bonded, migrated · Smart money and callers · Holders, devs and snipers · Wallet records") — that *is*
  the GMGN-style terminal. Give it the parody name, `ready: true`, its own `boards/scan.js` (sibling of
  `boards/board.js`, 1,357 lines), its own palette, and pick it in `shell.js`.
- **Data the engine already has** (`engine.js`): curves/progress, holders, devs, snipers, insiders, bundles, smart
  wallets (28), callers (16, = KOLs), fates, trades → enough for every GMGN column above. Map: smart wallets →
  "Smart Money" icon, callers → "KOL", dev/sniper/insider/bundler → tags, fresh wallets → new-wallet icon, first 70 buyers
  grid from the engine's first trades per coin.
- **Screens to build:** (1) Trenches 3 columns with filters/presets, pause-on-hover, quick-buy amount per column, Z/Space
  hotkeys; (2) Trending table with 1m/5m/1h/6h/24h; (3) token page: header, chart (own canvas, TV-like toolbar:
  1s/30s/1m/5m/15m/1h/4h/1d, Price/MC, USD/coin, markers by wallet type, fx → volume/MA/EMA/RSI/MACD drawn by us),
  Activity/Traders/Holders/Dev Token/Position-Limit-Auto tabs, right trade module (Market/Limit/Auto, 4 quick amounts,
  25/50/75/100 %, Sell init, P1–P3 presets, slippage/priority/tip/anti-MEV, TP/SL ≤ 10), security box, pool info, first-70
  grid; (4) Track feed (smart money/KOL trades); (5) wallet profile for any made-up wallet (7D/30D PnL, win rate,
  distribution, Recent PnL/Holdings/Activity); (6) PnL share card; (7) settings sheet; (8) mobile: tabs + bottom sheet.
- **Indicators math (code sketch):**
  ```js
  // EMA over closes; RSI(14) Wilder; MACD(12,26,9) — all pure, testable in Node
  export const ema = (xs, n) => { const k = 2 / (n + 1); let e; return xs.map((x, i) => (e = i ? x * k + e * (1 - k) : x)); };
  export function rsi(closes, n = 14) {
    let g = 0, l = 0; const out = Array(closes.length).fill(null);
    for (let i = 1; i < closes.length; i++) {
      const d = closes[i] - closes[i - 1], up = Math.max(d, 0), dn = Math.max(-d, 0);
      if (i <= n) { g += up / n; l += dn / n; if (i === n) out[i] = 100 - 100 / (1 + g / (l || 1e-12)); }
      else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n; out[i] = 100 - 100 / (1 + g / (l || 1e-12)); }
    }
    return out;
  }
  export const macd = (c, f = 12, s = 26, sig = 9) => {
    const m = ema(c, f).map((v, i) => v - ema(c, s)[i]); const sg = ema(m, sig); return { m, sg, h: m.map((v, i) => v - sg[i]) };
  };
  ```
  (Compute `ema(c, s)` once outside the map in real code.)
- **Name/brand caution:** CLAUDE.md's standing rule is "never the real terminals' names, logos or art" (Claude's answer
  to "exact copies", 2026-10-20). The owner now asks for **parody** names. A near-identical name (one letter swapped)
  plus near-identical layout is exactly what phishing clones look like; keep the parody **obvious** (a joke name, our
  own mascot and colors, the safety note "Play money only. Not affiliated with any real trading terminal…" on every
  screen, no links, no wallet). Trademark/parody limits are a legal question (not legal advice) — flag to the owner and
  update CLAUDE.md's rule text with the owner's new decision.

## 17. Gaps — what to ask the owner for (screenshots would settle these)
1. Exact dark colors, font (looks like a geometric sans; unconfirmed), and card heights on the Trenches page.
2. Whether P1/P2/P3 presets exist on GMGN web and what each holds.
3. The PnL share card's layout (QR code? which numbers? default backgrounds).
4. The settings panel's display options (language, currency, color convention, sounds).
5. First-70 grid dot colors and the security box's exact rows/order.
6. Current top-nav labels (CopyTrade vs WalletCopy, Track vs Follow) and the dock items.
7. Mobile app tab bar labels.
Owner screenshots (from their own GMGN account) are the fastest way: one each of Trenches, Trending, a token page, the
buy panel with settings open, a wallet page, a PnL card, the mobile token page.

## 18. Sources
Official:
- GMGNAI/gmgn-skills (cloned): https://github.com/GMGNAI/gmgn-skills — `skills/gmgn-market/SKILL.md` (chains :59,
  trending fields :368-470, trenches presets/filters/fields :582-700, signal types :1033-1057), `skills/gmgn-token/SKILL.md`
  (tags :99-123, holders/traders fields :374-480), `skills/gmgn-swap/SKILL.md` (currencies :84-96, swap params and
  condition orders :178-257), `skills/gmgn-portfolio/SKILL.md` (holdings/activity/stats :224-330), `skills/gmgn-track/SKILL.md`.
- https://docs.gmgn.ai/index/trenches-hotkeys · https://docs.gmgn.ai/index/token-page-chart-multicharts-activity-trading-system
  · https://docs.gmgn.ai/index/trading-system · https://docs.gmgn.ai/index/trending · https://docs.gmgn.ai/index/new-pair
  · https://docs.gmgn.ai/index/gmgn-fees-settings · https://docs.gmgn.ai/index/featured-icon-definition
  · https://docs.gmgn.ai/index/insider-traders-snipers-first-70-buyers · https://docs.gmgn.ai/index/wallet-detail-page
  · https://docs.gmgn.ai/index/cooperation-referral-share-transaction-profits · https://docs.gmgn.ai/index/copy-trade
  · https://docs.gmgn.ai/index/follow-monitor-square-follow-watchlist · https://docs.gmgn.ai/index/x-tracker
  · https://docs.gmgn.ai/index/cooperation-api-integrate-gmgn-price-chart · https://docs.gmgn.ai/index/auto-trading-quick-buy-take-profit-stop-loss
  · https://docs.gmgn.ai/index/snipex · https://docs.gmgn.ai/index/gmgn-app-tutorial · https://docs.gmgn.ai/index/q-a
- https://gmgn.ai/ · https://gmgn.ai/?chain=sol&tab=trending · https://gmgn.ai/about · https://gmgn.ai/ai
  · https://gmgn.ai/blog/how-to-read-fomo-calls-on-gmgn-chart/ · https://gmgn.ai/blog/how-to-set-take-profit-stop-loss-on-gmgn/
  · https://gmgn.ai/blog/how-to-buy-new-robinhood-chain-launches/ · https://gmgn.ai/blog/best-meme-coin-trading-platforms-2026/
- X: https://x.com/gmgnai/status/1940689731416949112 · https://x.com/gmgnai/status/1941663400741962054
- Apps: https://play.google.com/store/apps/details?id=com.gmgn.app · https://apps.apple.com/app/id6745328711
Third-party (lower confidence): https://www.rootdata.com/news/304254 · https://www.chaincatcher.com/en/article/2189486
· https://coincodecap.com/gmgn-review · https://coincodecap.com/best-settings-for-gmgn-bot · https://www.axltoken.com/trading-bots/gmgn-vs-axiom/
· https://openchainbench.com/compare/axiom-vs-gmgn · https://stox.news/article/gmgn-review-2026-features-fees-trading-tools-and-safety/
· https://memecoin.gmgn.ai/guide/gmgn-the-all-in-one-trading-terminal-for-memecoins · https://apify.com/muhammetakkurtt/gmgn-trenches-scraper
· https://www.panewslab.com/en/articles/4eqt3xx6 · https://github.com/ColtFourtyFive/Gmgn (a GMGN-category React/Vite/Tailwind/
lightweight-charts terminal, "Trenchscope"; licence unchecked — layout reference only, don't copy code without checking).
