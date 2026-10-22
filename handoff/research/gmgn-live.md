# GMGN.ai, reverse-engineered for TRENCHING SIMULATOR's parody terminal (research, 2026-10-21)

Research only: nothing in `/home/user/agi-ecosystem` was changed. No screenshots of GMGN exist (see §1), so
`research/gmgn-shots/` is empty.

Legend used below: **[DOC]** = GMGN's own published docs/code (gmgn-cli, its official npm package);
**[TYPES]** = a third-party typed client of GMGN's web endpoints (field names = what the site's pages are built from);
**[WEB]** = web-search summaries of guides / docs.gmgn.ai (not opened directly); **[CLONE]** = a third-party GMGN UI clone's
source (colors measured by its author, ~2025); **[RECALL]** = Claude's own memory of GMGN's UI, NOT verified this session.
Treat [RECALL] and [CLONE] as approximate.

---

## 1. What could and couldn't be seen

| Tried | Result |
|---|---|
| Headless Chromium (/opt/pw-browsers/chromium-1194) → https://gmgn.ai/?chain=sol, /trend, /trenches, /sol/token/… | Proxy: `CONNECT 403` (policy `connect_rejected`). Not retried, not routed around. |
| curl to gmgn.ai, docs.gmgn.ai | same 403 |
| web.archive.org, archive.ph, urlscan.io | same 403 |
| WebFetch gmgn.ai / docs.gmgn.ai | `getaddrinfo ENOTFOUND` |
| WebFetch web.archive.org | "unable to fetch" |
| jsdelivr/unpkg (GMGN bundles), dexscreener, pump.fun, x.com, youtube, reddit, medium | 403 |
| WebSearch | works (summaries only) |
| npm registry tarballs (via Bash) | works → official `gmgn-cli` 1.6.8 (repo GMGNAI/gmgn-skills, published 2026-10-21) and `@tapline/client` downloaded to `research/gmgn-npm/` (read as text, never executed) |
| GitHub MCP code search | works → GMGN clones (colors) |

**So: no computed styles, no pixel measurements, no screenshots, no live chart inspection.** Everything visual below is
[CLONE] or [RECALL]; everything about data, chains, settings and tags is [DOC]/[TYPES] and reliable.

---

## 2. Chains (answers the owner's "other chains on GMGN … do I need an API key?")

**GMGN's chain list today — 13 chains [TYPES]** `_tapline_client/package/dist/services/gmgn/types.d.ts:172`:
`sol, eth, bsc, base, tron, monad, megaeth, hyperevm, robinhood, arbitrum, arc, stable, xlayer`.

[DOC] `gmgn-cli/package/dist/validate.js:1`:
`VALID_CHAINS = sol, bsc, base, eth, arbitrum, hyperevm, robinhood, arc, stable` (`monad` commented out);
`validate.js:53-56` CALLOUT_CHAINS adds `megaeth, tron, monad, xlayer`; `validate.js:29` arbitrum/hyperevm/arc/stable have no
"smart trade" (TP/SL) orders.

UI names (what the chain switcher would show, [RECALL]+[DOC]): Solana · BSC (BNB Chain) · Base · Ethereum · Tron · Monad ·
MegaETH · HyperEVM · Robinhood Chain · Arbitrum · Arc · Stable · X Layer. Native coins: SOL, BNB, ETH (Base, Ethereum,
Arbitrum, Robinhood, MegaETH), TRX, MON, HYPE, OKB (X Layer), USDC/stable gas (Arc, Stable: [RECALL], unverified).

Game today (CLAUDE.md "Live mode"): solana, robinhood, bnb, base.

**API keys — inference, not tested:**
- **Solana:** Helius key already set (bonding curves). Nothing new.
- **Every EVM chain added the "listed on DexScreener" way** (as BNB Chain/Base already are): **no new key** —
  DexScreener's token-profiles + pairs API is keyless; the relay's 240 req/min budget is shared, so each extra chain eats
  into it (bump poll intervals or rotate chains).
- Following each launchpad's own curves live (like clank.trade/pump.fun) on another chain would need that chain's RPC:
  public RPCs work without keys at low volume; a free Alchemy/QuickNode key only if they rate-limit. **Tron:** TronGrid
  asks for a (free) API key for anything but light use.
- DexScreener chain ids to verify before shipping (unverified): `ethereum, arbitrum, hyperevm, monad, megaeth, xlayer,
  tron`. Arc/Stable may not be on DexScreener at all → leave them out or "Soon".

Launchpads per chain [DOC] `gmgn-cli/package/skills/gmgn-market/SKILL.md:144` and `:571-580`:
- sol: Pump.fun, pump_mayhem, letsbonk, bonkers, bags, memoo, liquid, bankr, zora, surge, anoncoin, moonshot_app,
  wendotdev, heaven, sugar, token_mill, believe, trends_fun, jup_studio, Moonshot, boop, ray_launchpad,
  meteora_virtual_curve, xstocks
- bsc: fourmeme (+agent/bn/xmode), cubepeg, likwid, goplus_creator/skills, openfour, flap (+stocks/aioracle), clanker, lunafun
- base: clanker, bankr, flaunch, zora (+creator), baseapp, basememe, virtuals_v2, klik
- eth: trench, clanker, klik, livo, stroid, printr (+uniswap pools)
- arc: dyorfun_v3, dyorswap, trench, onmifun, sharcfun, klik · stable: dyorfun_v3, dyorswap, trench
- robinhood: "server default allow-list" (not enumerated; clank.trade is GMGN-listed via its Trenches on robinhood).

---

## 3. Information architecture (pages and nav)

[RECALL]+[WEB] Top header (≈56 px, dark, 1px bottom hairline): logo (frog mascot + wordmark) · nav: **Trenches** (memes /
new pairs), **Trending**, **Copy Trade**, **Monitor**, **Track**, **Holding/Portfolio** · chain switcher (round chain icon +
name + caret, dropdown list of chains) · search ("Search token/wallet", `/` hotkey) · Deposit · wallet/avatar.
Mobile: logo + chain pill + search icon in the top bar; nav as a bottom tab bar.

**Trenches** [WEB]: three live columns — **New** · **Almost bonded** · **Migrated** (older UI: "New Creations /
Completing / Completed"). API names [DOC] `SKILL.md:42`: `new_creation`, `near_completion` (returned as `data.pump`),
`completed`; up to 80 per column (`SKILL.md` trenches limit). Each column has its own filter funnel, launchpad picker,
"Quick Buy" amount box with a ⚡ icon, and pauses its live feed when hovered ("Pause live feed on hover" setting).
Hotkeys [WEB]: Mode A = `Z` + row number; Mode B = `Space` + column + row.

**Trending** [DOC]: intervals `1m / 5m / 1h / 6h / 24h` (`types.d.ts:2815`); table sortable by rank/hot_level, MC,
liquidity, volume, swaps, holders, % change 1m/5m/1h; filter presets [DOC] `SKILL.md` "Filter Presets":
`safe` (rug ≤0.3, bundler ≤0.3, insider ≤0.3), `smart-money` (≥1 smart wallet), `strict` (both + vol ≥ $1K).

**Token page** `/{chain}/token/{address}` [RECALL]: three regions on desktop:
1. header strip: logo, ticker, name, copy-CA, socials, age, then stat chips (Price, MC, Liq, Holders, 24h Vol, Top10 %);
2. left/center: chart (≈ 55–60% of viewport height) and under it tabs: **Activity** (trades), **Traders / Top traders**,
   **Holders**, **Positions**, **Orders**, **Dev tokens**;
3. right column (≈ 320–360 px): trade panel, then token stats, security audit, pool info, P&L of your wallet.
Mobile: chart full width, tabs below, sticky bottom Buy/Sell buttons opening a sheet.

---

## 4. Chart

- Resolutions [TYPES] `types.d.ts:1889`: `1s 15s 30s 1m 3m 5m 15m 30m 1h 4h 12h 1d 1w 1mo` (UI shows a subset,
  [DOC] kline: `1s(Pro) 30s 1m 5m 15m 1h 4h 1d`).
- Engine [RECALL, unverified]: TradingView **Advanced Charts / charting_library** (left drawing toolbar, top toolbar
  intervals + indicators, "Price / MCap" and "USD / SOL" toggles, buy/sell markers of your own trades and of
  dev/smart-money wallets). That library is licensed per-company and cannot be redistributed → **do not use it**.
- For the game: keep `src/games/trenchingsimulator/chart.js` (own canvas, 280 lines) and add GMGN-like behaviour:
  Price/MCap toggle, USD/native toggle, interval row, crosshair + OHLC legend, volume sub-pane, trade markers (B/S
  bubbles, KOL/smart-money avatars), smooth right-edge auto-scroll, requestAnimationFrame-throttled redraws.
  (Alternative: `lightweight-charts`, Apache-2.0, requires its TradingView attribution logo — another real brand
  on screen; own canvas avoids it.)
- Colors [RECALL]: dark plot `#0D0D0F`-ish, grid ~`rgba(255,255,255,0.04)`, up candles green (`#09B884`-like, [CLONE]),
  down candles red (exact hex **not found**), volume bars at ~40% alpha.

---

## 5. Colors and type (best available)

[CLONE] `liyincode/gmgn_clone lib/theme/app_colors.dart` (via GitHub code search):

| token | hex | use |
|---|---|---|
| background | `#0D0D0F` | page |
| cardBackground | `#17181A` | cards / panels |
| table/drawer bg | `#121314` | lists, sheets |
| footer | `#101213` | bottom bar |
| headerBorder | `#1F2024` | header hairline |
| textPrimary | `#EAECEF` | main text |
| textSecondary | `#7F8288` | labels |
| muted | `#5D6466` | dimmest text |
| primary | `#6655F2` | purple accent (tabs, links) |
| buttonGreen | `#38C97C` | Buy |
| upward | `#09B884` | +% / up candle |
| header gradient | `#3A408E → #1E63B4` | promo banner |
| radius | 8 px | cards/buttons |
| font | Inter, 14 px list subtitles, 600 weight titles | |

Down/red: not found in any accessible source. Suggest our own `#F2495C` (check AA on `#17181A`: ≈ 4.9:1 for text).
Note: two contrast risks — `#7F8288` on `#17181A` ≈ 4.4:1 (just under AA) → use `#8A8D93`; `#5D6466` fails AA → icons only.

Suggested GNGM tokens (own values, GMGN-*like*, for `terminals.js` `scan` entry which today is
`src/games/trenchingsimulator/terminals.js:20-25`):
```js
colors: { bg: '#0d0d0f', panel: '#17181a', panel2: '#1f2024', panel3: '#26282c', line: '#1f2024', line2: '#2b2d31',
  text: '#eaecef', soft: '#c9ccd1', muted: '#8a8d93', dim: '#6b7076', accent: '#7a6bff' /* our purple, not #6655F2 */,
  onAccent: '#0d0d0f', up: '#16c47f', down: '#f2495c', onDown: '#2a0a10', warn: '#f5b83d', info: '#4da3ff' }
```

---

## 6. Trade panel (right column) — controls and labels

[DOC] `gmgn-cli/package/skills/gmgn-swap/SKILL.md:45-51,188-212` + [WEB] + [RECALL]:
- Tabs: **Buy | Sell**; order type: **Market | Limit | Auto** (Auto = TP/SL/trailing). [DOC] order types: market, limit
  (`buy_low`/`buy_high`), `profit_stop`, `loss_stop`, `profit_stop_trace`, `loss_stop_trace` (trailing, `drawdown_rate`),
  "mix" (TP+SL), multi-wallet (up to 100). Max 10 TP/SL sub-orders.
- Amount input (native coin) + quick chips (SOL: `0.01 0.1 0.5 1`; editable) [RECALL]; Sell: `25% 50% 75% 100%`.
- Preset tabs **P1 P2 P3** [WEB, unconfirmed] each storing: Slippage (`Auto` or 0–100%, guides cite 20–30% default for
  memes), Priority fee (SOL ≥ 0.00001; guides 0.002–0.006), Tip fee (SOL/BSC), Anti-MEV (`Off | Red | Sec` [WEB]; needs
  priority ≥ 0.002 SOL; not on Base), EVM: gas level `low/average/high` or gwei, EIP-1559 max fee/priority.
- Under the button: "Balance", est. receive, fee line (GMGN ~1% per trade [WEB]).
- Settings gear: hotkeys, quick-buy amounts, confirm-trade toggle, pause-on-hover, sound.

Game mapping (play money): reuse Trench Board's quote → land → fee pipeline; map P1/P2/P3 to the existing slippage +
priority tiers (fast/turbo/ultra); "Anti-MEV" toggle can reuse the engine's sandwich-bot flag (CLAUDE.md: sandwich bots
exist in the engine, off in the game).

---

## 7. Tables

Trenches card fields [DOC] `SKILL.md:376-440`: logo, symbol/name, age (`creation_timestamp`), MC, liquidity, volume,
swaps (buys/sells), holders, bonding progress %, top10 %, dev hold %, snipers, insiders %, bundler %, rug_ratio, smart
money count, KOL count, `creator_token_status` (dev holding/sold), socials, launchpad icon.

Token **Activity** (trades) columns [TYPES] `TradeHistory` `types.d.ts:2738-2773`: time, type (buy/sell/add/remove),
USD, amount, price, maker (avatar/name/X handle + tags), realized/unrealized profit, tx link, priority/tip fee.

**Holders** columns [TYPES] `TokenHolder` `types.d.ts:2260-2329`: rank, address/name + tags, % held, amount, USD value,
avg cost, avg sold, bought/sold (txs, USD), realized & unrealized PnL, total profit + %, first/last active, native
balance, funding source (transfer in), on-curve flag, "suspicious". Filter chips by tag.

**Top traders** order-by [TYPES] `TraderOrderBy`: profit, realized_profit, unrealized_profit, amount_percentage,
last_active, netflow_usd, buy_volume, sell_volume.

Holder trend lines [TYPES] `types.d.ts:2656`: avg holding balance, holder count, top10 %, top100 %, bundler %, insider %,
bot degen %, entrapment %.

---

## 8. Wallet tags / badges (KOLs, smart money…)

[TYPES] `HolderTag` (`types.d.ts:1400`): `smart_degen` (Smart Money), `renowned` (KOL), `fresh_wallet`, `bundler`,
`bluechip_owner`, `sniper`, `rat_trader` (insider/"rat"), `dev`, `transfer_in`, `dex_bot`.
`AggedTradeTag` (`:60`) adds `dev_team`, `insider`. Counts per token `TagCounts` (`:2103`). Rank tags `WalletTagRank`
(`:3034`): kol, top_followed, top_renamed, wash_trader, arbitrager, terminal tags (photon/axiom/trojan — real brand
names, do not show).
Badge styling [RECALL]: small pill or icon next to the address, colored per tag (smart money green/gold, KOL purple with
X avatar, sniper red crosshair, bundler orange, rat/insider brown, fresh wallet leaf/green, dev "DEV" chip). Use our own
icons and colors. Our callers/smart wallets already exist in the engine (made-up names): map them to these tags.

---

## 9. PnL card (wallet / position share card)

Data [TYPES] `WalletPnlStat` (`types.d.ts:2997`): winrate, token_num, avg_holding_period, and the **PnL distribution
buckets**: `>5x`, `2x–5x`, `0–2x`, `-50%–0`, `< -50%` (`pnl_gt_5x_num`, `pnl_2x_5x_num`, `pnl_0x_2x_num`,
`pnl_nd5_0x_num`, `pnl_lt_nd5_num`). `RankedWallet` (`:1822-1884`): pnl 1d/7d/30d, realized profit, winrate, buys/sells,
volume, avg cost, avg holding period, `daily_profit_7d` (bar strip), net inflow, follow_count, twitter name.
Periods: `1d / 7d / 30d / all` (`:3020-3026`).

Share card layout [RECALL, unverified]: dark card with art background, token logo + $TICKER, big PnL % (green/red),
rows "Invested / Sold / Holding / Profit", user name/avatar, referral code + QR, brand logo bottom. For the game: a
1200×630 canvas (the existing `share.js` card) with GNGM parody mark, player's optional name, run PnL %, invested, sold,
profit, best trade, "Play money · made-up coins" line; never a QR to anything but agi1.app.

---

## 10. What to build for "GNGM" (recommendation)

1. `boards/gngm.js` beside `boards/board.js` (`mountBoard()` shape), `ready: true` in `terminals.js`, money = chain coin.
2. Desktop grid: header 56 px; body `grid-template-columns: 1fr 340px`; Trenches page `repeat(3, minmax(0,1fr))` with
   independent scroll; token page chart ~58vh + tabs; phone: one column, bottom tab bar, sticky Buy/Sell sheet.
3. Smoothness: virtualize Trenches lists (render ~20 visible rows), batch market ticks per animation frame, CSS
   `contain: content` on cards, no layout reads in tick loops, transform-only flash animations.
4. Never GMGN's name, frog logo, art or exact copy; our own mark/colors; safety note as today.
5. Unknowns to settle with the owner's own screenshots (Claude can't load gmgn.ai here): exact down-red, header nav labels
   order, PnL card art, P1/P2/P3 behaviour.

Files: `research/gmgn-npm/gmgn-cli/package/` (official docs) and `research/gmgn-npm/_tapline_client/package/dist/services/gmgn/types.d.ts`
(field shapes), all under `/tmp/claude-0/-home-user-agi-ecosystem/3a68cf55-88eb-5b1b-9a13-4a2b793da4f7/scratchpad/`.
