# TRENCHING SIMULATOR: integration map for a second terminal (GNGM) and parody renames

Research only: no repo file was changed. Paths are relative to `/home/user/agi-ecosystem`. Game code lives in
`src/games/trenchingsimulator/`.

## 0. Baseline

`node --test --test-timeout=30000 tests/trench*.test.js` (2026-10-21, this workspace): **82 tests, 82 pass, 0 fail,
0 skipped**, ~10 s (trench.test.js 20, trench-game.test.js 30, trench-live.test.js 32).

## 1. The single most important finding

The GMGN-like terminal **already exists as a stub: id `'scan'`** ("Trench Scan", `ready: false`, terminals.js:19-25,
tagline "Scan new coins, smart money and every wallet.", features "New, almost bonded, migrated / Smart money and callers /
Holders, devs and snipers / Wallet records"). CLAUDE.md's table also says "Trench Scan like GMGN".
`liveCurrency('scan', chain)` already returns the chain's own coin (live-chains.js:37-40, same branch as `'board'`).

**Recommendation: keep the ids, change only the names.** Ids are persisted (save `terminal`, run.result `terminal`),
asserted in tests, and drive liveCurrency. Mapping:

| id (keep) | old name | new parody name | real terminal |
|---|---|---|---|
| `chat` | Trench Chat | BasedBott | BasedBot |
| `scan` | Trench Scan | **GNGM** (build it, `ready: true`) | GMGN.ai |
| `board` | Trench Board | Pomp.fun | pump.fun |
| `pro` | Trench Pro | Axium | Axiom |
| `social` | Trench Social | Fomoo | fomo |

Do not rename ids to `gngm`/`pomp` etc.: it would break saved games (`cleanSave` drops a terminal not in
`TERMINAL_IDS`, harmless but resets the pick), run results, tests and liveCurrency for no gain.

## 2. Module APIs (what a board can use)

### ui.js
- `el(tag, attrs, ...kids)` (attrs: `class` string|array with falsy skipped, `text`, `data`, `vars` (CSS custom props),
  `on` {event: fn}, aria/role/type etc.). The only way DOM is made (no innerHTML: tests forbid it).
- `setText(n, text)` (writes only on change), `flag(n, cls, on)`, `keyed(host, items, keyOf, make, update)` (keyed list
  reuse: nodes kept, focus/pictures never jump), `icon(name)`, `toast(text, tone, ms)`, `clearToasts()`.
- `paintTerminal(node, terminal)` (ui.js:113): for each `colors` key sets `--t-<kebab>` on node. **Sets only keys present,
  never clears others**: shell paints `document.documentElement` and the root with the picked terminal (shell.js:137-138),
  the terminals cards (226) and the play screen (561). A terminal lacking Board's extra keys (panel2, panel3, line2,
  soft, dim, hero, onAccent, onDown, warn, info, violet) would inherit stale values after Board was painted. **GNGM must
  define the full key set it uses.**

### engine.js (createMarket; the market a board reads; STEPS_PER_S=10, money in SOL)
Getters: `seed, solUsd, startSol, feedSeq, player {sol, held, startSol, worth, fees, pending, address}, meta, heat, koth,
counts {launched, migrated, rugged}, size, config, live, ext (live API or null), n`.
Reads (all null for an unknown id):
- `lists({limit≤100, default 30})` → `{ new, stretch, migrated, trending, bump, koth }` arrays of rows (memoised per step).
  GMGN's three columns = `new` / `stretch` ("almost bonded", progress ≥ 0.5 or migrating) / `migrated`.
- `row(id)` → the card row (rowOf: ticker, name, emoji, mc, progress, age, tags…).
- `info(id)` → `{id, name, ticker, emoji, theme, line, mint, dev, devAddr, born, copyOf, socials, devCoins, devMigrated}`
  (+ `live, src, chain, pic, pair` for a real coin).
- `stats(id)` → mc, mcUsd, price, priceUsd, liq, liqUsd, progress, curveSol, ath/athUsd/athAt, change1m/5m/1h, vol1m/5m/1h,
  buys5m, sells5m, txns5m/1h, txns, vol, **holders, top10, dev, devSold, snipers, snipersN, bundlers, bundlersN, insiders,
  insidersN, kols [..], smart, smartIds, whales**, devCoins, devMigrated, socials, dexPaid(+At), cto(+At), rugged(+At),
  replies, lastTrade, koth, kothAt, gradAt, migratedAt, `me {tokens, cost, value, realized}`, `pending [orderView]`.
  For live coins (`extStats`) holder/insider/dev fields are **null** and `kols: []`: GNGM must show "—" (rule 8: never
  made-up holders/dev/rug/caller on a real coin).
- `candles(id, since)` → `[{t,o,h,l,c,v,b,s}]` 1-second candles in mc SOL (chart.js aggregates).
- `trades(id, n≤KEEP)` → `[{t, side, sol, tok, mc, label, kol, me, addr}]`.
- `holders(id, n≤100)` → `{ pool {tok,pct,kind}, list [{rank, addr, label, tok, pct, in, out, kol, me, at}], count }`.
- `smartWallets()` → 28 rows `{n, addr, d7 {...7-day record}, buys, sells, in, out, won, lost, pnl, upnl, value, open [], last}`
  (a ready-made "Smart Money" tab).
- `comments(id, n)`, `tape(n)` → `[{t, coin, ticker, side, sol, mc, …}]` (global trade tape), `feed(since)` →
  events with `kind` ∈ launch, koth, meta, migrate, migrated, rug, dev_sell, cto, dex_paid, **kol_buy, kol_sell,
  smart_buy, smart_sell, whale_buy** (GNGM's "KOL/Smart activity" stream comes straight from here).
- `find(q)` (address, ticker or name, ≤20 ids), `positions()` → `[{id, ticker, name, emoji, phase, tokens, cost, value,
  pnl, total, pnlPct, realized, invested, sold, fees, buys, sells, first, last, mc, open}]`, `orders(n)` → orderView,
  `quote(p)` → `{ok, side, sol, spent, refund, tokens, minTokens, avgPrice, impact, fees{terminal, market, network},
  mcAfter, full, spot, slippage, priority, enough}` (sell side similar), `netWorth()`, `maxBuy(priority)`,
  `equity(since)`, `log()` (player orders `{n, coin, side, sol, frac, slippage, priority}`), `order(p)`.
- Live-only: `ext` API (add/state/history/track/pic/view/byKey/ids/liveCount/keyOf), `isExt(id)`.
- `replay({seed, solUsd, startSol, config, log, until})` (engine.js:1782) rebuilds a simulated run from its log: usable
  for **server-side verification of leaderboard scores** (simulated runs only; live runs cannot be replayed).
- Constants: `PRIORITY {fast, turbo, ultra: {fee, lo, hi}}`, `MIN_BUY 0.001`, `BASE_FEE`, `DEFAULTS` (terminalFee etc.).

### run.js — `createRun({ seed, solUsd = 150, mode = 'free', challenge = null, startSol = 1, speed = 1, currency = 'sol',
config = {}, terminal = 'board', live = null, makeMarket = null, realTime = false })`
API: `tick(dtSeconds)` (clamped by `MAX_DT 0.25`), `order(p)`, `quote(p)`, `drain()` → events, `pause/resume`,
`setSpeed`, `end()`, `progress()`, `hud()` → {worth, pnl, multiple, clock}, `result()`, flags `over`, `left`, `mode`,
`speed`, `live`, `realTime`, `challenge`, `start`, `market`, `currency`, `solUsd`.
Events: start, fill, fail, rug, migrating, migrated, dev_sell, kol_buy, cto, dex_paid, milestone, down, close,
last_minute, countdown, idle, end. Constants `BUST_SOL`, `MILESTONES [1.5,2,3,5,10]`, `DOWN_AT 0.5`.
`result()` → mode, challenge, daily, outcome, reason, stars, start, worth, peak, low, multiple, pnl, pnlUsd, timeUsed,
seconds, placed, filled, failed, coins, wins, losses, best, worst, fees, mev, feeParts, **seed, solUsd, currency,
terminal**, equity, live, liveTraded. `terminal` is just echoed (only tests use it: trench-game.test.js:713, 727).

### results.js / share.js (the PnL card's words)
- results.js: `TITLES`, `resultTitle`, `resultTone`, `modeLabel`, `tradedLive`, `resultLine`, `statLines`, `starsRow`,
  `downsample(≤200)`, `sparkPath(points, {w,h,pad,base,minSpan})` → `{d, area, baseY, up}`, `cardText(res)` →
  `{kicker: \`${GAME_NAME} · ${modeLabel}\`, title, big, line, sub, stars, foot, tone}`; foot is
  'Play money, made-up coins · agi1.app/games/trenchingsimulator' (or the live variant).
- share.js: `GAME_URL`, `GAME_NAME 'TRENCHING SIMULATOR'`, `shareText(result)`, `shareLink(text, url)` (x.com intent).
  Neither includes the terminal's name. Test trench-game.test.js:1093-1095 forbids real-terminal names and "buy" in posts.

### shell.js `saveCard(res, t, button)` (shell.js:855): the current PnL card
1200×630 canvas: `t.colors.bg` fill, `panel` box with `line` stroke at 40px inset, kicker (muted, Geist Mono 26),
title (up/down tone, Geist 54 bold), big multiple (text, Anybody 800 150px), line, sub, stars (accent), spark of
`res.equity` at (600,300) 520×150 with dashed base, AGI-1 8-bit face (`facePixels('celebrate'|'neutral')`, 8 px cells,
top right), foot. Then `navigator.share` on touch devices, else download `trenching-simulator-<ts>.png`.
**For a GMGN-style PnL card:** make the card per terminal. Cleanest: shell keeps the share/download plumbing and asks
the terminal module for a drawer: `const draw = BOARDS[t.id].drawCard || drawDefaultCard; await draw(g, {W, H, res, t,
words: cardText(res), sp, face: facePixels(...)})`. Keep `cardText(res)` words (they carry the safety foot
"Play money…"); a GMGN look needs its big green/red PnL %, entry/exit mc, held time, a mascot area (use AGI-1, never
GMGN's art) and the parody wordmark. Also `resultsScreen()` (shell.js:808+) draws the on-page summary with `.ts-spark`.

### save.js
`SAVE_KEY 'trench_v1'` (localStorage), `blank()`, `cleanSave(raw)` (keeps `terminal` only if in `TERMINAL_IDS`; slippage
in `SLIPPAGES [0.01,0.05,0.1,0.2,0.5]`; priority in `PRIORITIES ['fast','turbo','ultra']`; muted, speed, chain, market,
best/liveBest, daily (≤ `DAILY_KEEP 30`), totals), `loadSave`, `writeSave`, `recordResult(save, result, {dailyKey})`,
`starsTotal`. **No player-name field**: add `name` (cleaned, ≤24, crude/impersonation rules like
`server/arcade.js reviewName()` / live show names) to `blank()` and `cleanSave()`; tests at trench-game.test.js ~1080-1090
round-trip `cleanSave` so extend them.
Shell's settings sheet (`openSettings`, shell.js:774) has Slippage / Priority (fee in run money · lo–hi s) / Sound chips.
A GMGN-like settings panel (presets P1/P2/P3, auto-fee, MEV toggle, anti-MEV) can live inside the board and still write
`S.save.slippage/priority` through ctx (see §3), or extend `S.save` with board-specific keys (add them to cleanSave).

### chart.js — `createChart(canvas, { colors, tf = 15 })` → `{ set(candles, opts), redraw(), destroy() }`
`TIMEFRAMES` 1s/15s/1m/5m, `aggregate(candles, tf)`, `niceTicks`, `timeLabel`, `timeTicks`. Default colors
`{bg #15161f, line #2d3045, text #f4f4f6, muted #9a9db1, up #4ade80, down #f87171, accent #ffd23f}`. Draws candles in $ mc,
volume (18% of height), 64px right axis, B/S marks for the player's fills, a migration line, last-price tag, crosshair
OHLC readout. **Missing for "TradingView-like"**: price⇄mcap toggle, MAs/indicators, wheel/pinch zoom and drag pan,
more timeframes (30s, 15m, 1h), drawing tools, log scale. Extend chart.js (options-gated, so Pomp.fun's look is
unchanged) rather than bundling TradingView's library (its Charting Library needs a licence and a script host the CSP
doesn't allow; lightweight-charts is Apache-2.0 on npm but adds ~45 KB gz and its own look; the owner asked for "no lag":
the canvas chart already redraws only on change).

### format.js
compact, grouped, usd, usdFull, sol, signed, pct, share, times, age, clock, tokens, price (subscript zeros), mcUsd,
isCoinCurrency, currencyOf, unitOf, nice, `money(solAmount, currency, solUsd, {unit})`, moneySigned. `COIN_NAMES` only
`{eth, bnb}` (+ sol/usd implicit). A new chain coin for Live mode needs a COIN_NAMES entry.

### Live: live-chains.js / live-feed.js / live-market.js
- `CHAINS` solana/robinhood/bnb/base, `chainById`, `DEFAULT_CHAIN 'solana'`, `UNIT_NAMES`, `liveCurrency(terminalId,
  chainId)` (switch on ids, :34-49), `liveMoney`, `toUnit`, `REAL_ENOUGH 8`, `playState`, `liveOk`, `relayUrl`,
  `LIVE_OPEN = true`, `picUrl`, `feedWords`, `cleanText`, `parseState`, `parseDx`, `parseCoin` (coin id regex
  `/^[srba][0-9]{1,9}$/`: one letter per chain; base58 for Solana, `0x` EVM otherwise), `parseMessage` (px keys only
  sol/eth/bnb), `toReal`.
- **Adding GMGN's other chains** (Ethereum, Tron, Sui, Monad, X Layer…): new CHAINS entries, a new id letter in the
  parseCoin regex, address regexes for non-EVM/non-base58 chains (Tron base58 `T…`, Sui `0x` 64 hex), px keys and
  COIN_NAMES for each coin (ETH, TRX, SUI, MON…), liveCurrency, the relay's sources (`tools/trench-relay/lib/sources/`),
  and tests/trench-live.test.js's chain lists. Keys: DexScreener's profiles/pairs are keyless for any chain it lists;
  per-chain live curves (like Helius for pump.fun) would each need their own RPC provider (and key) — DexScreener-only
  chains don't.
- `createLiveFeed({url, WebSocket})` → stop, setChain, watch(≤8), on, status, chain, chainState, newCoins, px, coins,
  picUrl (sends only `sub`/`watch`). `createLiveMarket({feed, chain, seed, solUsd, startSol, config, wallNow})` wraps
  createMarket({live:true}) and adds `focus(id)`, `liveState()`, `liveTraded()`, `destroy()`.

### names.js, lines.js, agi.js
- names.js: `THEMES`, `METAS`, `BLOCKED_TICKERS`, `BANNED_WORDS` (includes 'pump', 'agi', 'phantom'…: coin names only),
  `tickerOk`, `nameOk`, `makeName`, `makeCopy`, `makeAddress`, `makeMint` (ends "pump"), `shortAddr`, `makeUser`,
  **`KOLS`** (16 made-up callers `{id, followers, honest, skill}`), `kolById`, `SMART_COUNT 28`, `smartAddress(n)`,
  `COMMENTS`. names.js:196 comment mentions Trench Board.
- lines.js: `LINES`, `LIVE_LINES`, `MOODS`, `moodOf`, `lineFor(e, {currency, solUsd})`, `liveLineFor`, `createVoice`
  (AGI-1's bar voice; terminal-agnostic). agi.js: `facePixels(mood)`, `createAgi(host)`, `FACE`, `talkMs`.

## 3. How the shell mounts a board (the contract GNGM must satisfy)

shell.js imports `mountBoard` statically from `./boards/board.js` and calls it in `mountPlay` (shell.js:577):

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

Returned API used by shell: `update(now)` (from the rAF loop, :672), `sub()` (is a sub-view open: :958, :993),
`closeSub()` (popstate), `openCoin(id)`, `destroy()` (:689), `el`. Board's own cadence: `FAST_MS 250` (prices,
quote, trades), `SLOW_MS 650` (lists, boxes), CARDS 24. The HUD (pause, AGI-1, goal, clock, worth/PnL, speed, sound,
End/Cash out) sits above every terminal and is shell's, not the board's.

**Proposed registry** (smallest change to shell.js):

```js
import { mountBoard } from './boards/board.js';
import { mountGngm } from './boards/gngm.js';
const BOARDS = Object.freeze({ board: mountBoard, scan: mountGngm });
// mountPlay:
const mount = BOARDS[t.id] || mountBoard;
P.board = mount(boardHost, { ...same ctx, terminal: t });
```

Optionally `import()` gngm.js lazily during the existing 'loading' screen (startRun) to keep the first load light; the
CSP allows own chunks. Shell strings to adjust: comments at shell.js:334, 476; `Play on ${t.name}` (button text, built
from the name: fine); "Coming soon" cards for `ready:false`.

## 4. boards/gngm.js architecture

1. **Extract shared helpers** into `boards/common.js` (pure + DOM helpers already in board.js): `HUES, pic, samePic,
   glyph, hueOf, setP, tone, initial, num, ago, short, TAGS, tagEl, tagsOf, CHAIN_NAMES, fromWords, SOCIALS, WINS/WIN_S,
   windowStats (inner fn, :953 — lift it), dlRows (:193), splitEl/setSplit (:206/:219), whoText, holderTag, buyPresets,
   parseAmount, ORDER_ERRORS, orderError, SORTS`. **board.js must keep exporting `SORTS, ORDER_ERRORS, whoText,
   holderTag, buyPresets, parseAmount`** (tests import them from `boards/board.js`): `export { … } from './common.js'`.
2. **gngm.js** = `export function mountGngm(host, ctx)` with the same returned API. Views (GMGN's layout):
   - Trenches: three columns (New / Almost bonded / Migrated) from `market.lists()`, card per coin with mc, vol, holders,
     top10, dev%, snipers, bundlers, insiders (`stats`), quick-buy button with preset amount; filters per column
     (local state only).
   - Coin page: header (ticker, name, `CA ${mint.slice(0,6)}…` — required pattern if this file joins the no-link test),
     chart (chart.js with GMGN options), right trade panel (Buy/Sell, presets, quote via `ctx.order/ market.quote`,
     slippage/priority from `ctx.settings()`), tabs: Activity (`trades`), Holders (`holders`, with KOL/smart/dev/sniper
     tags), Top traders, KOL/Smart (`smartWallets`, `stats.kols`, feed `kol_*`/`smart_*`), My positions (`positions`).
   - Phone (<720px): bottom nav + trade sheet, like board.js (`openTradeSheet`, `tradeSheet` dialog, phone matchMedia).
   - Use `keyed()` for lists and only `setText`/`flag` in fast updates (that's what makes Board smooth); never rebuild
     rows in `update()`.
3. **Live mode**: honour `run.market.isExt(id)`, null fields → "—", `ctx.onCoin(id)` on open (keeps it live), `fromWords`.
4. **CSS**: new section in trench.css after Board's (or a separate `boards/gngm.css` imported by gngm.js). Prefix:
   - If GNGM classes contain live|market|is-real|is-sim|is-stale|is-img, the test at trench-live.test.js:1510-1514 requires
     `^\.tsb?-`. Either use a `tsg-` prefix **and widen the test to `/^\.ts[bg]?-|^html\[data-page=…\]/`**, or reuse
     `tsb-` (confusing). Recommend `tsg-` + widen.
   - Scope everything under `.ts-play[data-terminal='scan']` or `tsg-` root; screens read `--t-*` vars.
5. **Tests to add/extend**: add `'boards/gngm.js'` (and `common.js`) to trench-live.test.js:1495's file list (no
   innerHTML/eval/links, no `el('a'`, contains "play money", CA pattern); a trench-game test for gngm helpers; the
   contrast test covers its colors automatically.

## 5. Every place terminal names / ids appear

### Names
| File:line | What | Kind |
|---|---|---|
| src/games/trenchingsimulator/terminals.js:1-5 | header comment ("our own names… never a real terminal's name") | comment, rewrite |
| terminals.js:13, 20, 27, 39, 46 | `name: 'Trench …', short: '…'` | **data (UI)** |
| terminals.js:7 | SAFETY_NOTE "Not affiliated with any real trading terminal…" | keep (parody still unaffiliated); test asserts exact text |
| boards/board.js:1 | header comment | comment |
| boards/board.js:267 | `el('span', { class: 'tsb-brand-t' }, 'Trench Board')` brand wordmark | **UI** → "Pomp.fun" (+ parody logo instead of the plain "T" mark, `tsb-brand` at ~:265) |
| boards/board.js:1252 | `aria-label: 'Trench Board'` (phone nav) | **UI** |
| names.js:196 | comment | comment |
| shell.js:334, 476 | comments | comment |
| trench.css:1, 1194 | section comments | comment |
| live-chains.js:29-31 | comments | comment |
| tests/trench-game.test.js:1020 | `assert.deepEqual(names, ['Trench Chat','Trench Scan','Trench Board','Trench Pro','Trench Social'])` | **assert** |
| tests/trench-game.test.js:1023 | message 'Trench Board first' | msg |
| tests/trench-game.test.js:1029 | `assert.equal(t.name, \`Trench ${t.short}\`)` | **assert (formula)** — drop or replace with a parody map |
| tests/trench-game.test.js:1045-1046 | forbidden regex over TERMINALS+SAFETY_NOTE+CHALLENGES+LINES | **assert** — see §6 |
| tests/trench-game.test.js:1095 | same regex over share posts | assert (posts don't contain terminal names: unaffected unless names are added) |
| tests/trench-game.test.js:1330, 1332, 1371, 1393 | Trench Board in test titles/comments | cosmetic |
| tests/trench-live.test.js:931-932 | Trench Board in comments/messages | cosmetic |
| tools/games/trench-art.mjs:6, 38 | comments | comment |
| **tools/games/trench-art.mjs:102** | `await press(button('Play on Trench Board'))` | **functional**: key-art tool clicks by name → `'Play on Pomp.fun'` |
| tools/cards/trenchingsimulator-card.html:6 | comment | comment |
| tools/games/trench-art/keyart.html:4 | comment | comment |
| CLAUDE.md | Trench Board ×35, Trench Chat ×9, Trench Scan ×9, Trench Pro ×10, Trench Social ×10 | docs (update at the end) |
| games.html 125-149, 422; trenchingsimulator.html 7, 15, 30 | only generic "terminals you know", "real trading terminal" | no change needed; page.test.js:649-680 and 746-795 pin exact sentences, so any wording change must move with the tests |
| public/, scripts/ | no terminal names | — |

Real-terminal-name guards elsewhere: trench-live.test.js:1497 forbids links to `pump.fun|clank.trade|dexscreener|four.meme|axiom|photon|gmgn` (URLs only); names.js `BANNED_WORDS`/`tickerOk` (coin names only: 'pump', 'agi').

### Ids
`run.js:28` default `terminal = 'board'`; `save.js` cleanSave via TERMINAL_IDS; `live-chains.js:34-49` liveCurrency switch;
shell `DEFAULT_TERMINAL`; `data-terminal` attribute on `.ts-play` (shell.js:559; CSS may hook it);
tests: trench-game.test.js:713 (`'board'` in result), :727 (`'pro'`), :1018-1027 (ids, currencies, DEFAULT 'board'),
:1058-1070 (save terminal); trench-live.test.js:934-951 (liveCurrency per id); tools/games/trench-art.mjs:194 `'board'` is a
screenshot file name (`board.webp`), pinned by page.test.js (`../games/trench-art/board.webp`).

## 6. Rename gotchas (decision points for the owner)

1. **CLAUDE.md decision (2026-10-20)**: "under our own names… never the real terminals' names, logos or art". The
   owner now explicitly asks for parody names/logos/branding: this supersedes it; update terminals.js header comment,
   CLAUDE.md decisions log and hard rule 8's "never a real terminal's name" wording for TRENCHING SIMULATOR.
2. **Forbidden regex** (trench-game.test.js:1046): `/based\s*bot|gmgn|pump\.?fun|axiom|fomo|…|robinhood/i`.
   - GNGM: passes (not "gmgn"). Pomp.fun: passes. Axium: passes.
   - **BasedBott: FAILS** (`based\s*bot` matches the substring). **Fomoo: FAILS** (`fomo` matches).
   - Options: (a) loosen the regex to whole words with exact spellings, e.g. `\bbased\s*bot\b(?!t)` / `\bfomo\b` — but
     "Fomoo" still contains "fomo" + "o"; use `\bfomo\b` (word boundary) which "Fomoo" doesn't match, and
     `\bbased\s*bot\b` which "BasedBott" doesn't match; or (b) pick spellings that pass (e.g. "BaseddBot", "Fommo"). Same
     regex at :1095 for posts (fine either way unless posts mention terminals).
   - Also `\bbuy\b` etc. only in the posts regex.
3. **Name formula** `t.name === \`Trench ${t.short}\`` (:1029) must go; keep `short` (used by UI? grep shows only
   terminals.js/tests; shell uses `t.name`) or set short = name.
4. **Contrast** (:1036-1041): text ≥ 7:1 and muted/accent/up/down ≥ 4.5:1 on bg AND panel; hex lowercase 6-digit for
   bg/panel/line/text/muted/accent/up/down; features exactly 4; tagline 10-80 chars; objects frozen (use `T()`).
5. **trench-art.mjs:102** clicks "Play on Trench Board" — rename or the key-art tool breaks (it's a tool, not in npm
   test, but CLAUDE.md documents it).
6. **page.test.js** pins games.html sentences ("terminals you know", "real trading terminal", card words) and the key art
   / card images; renaming terminals doesn't require touching them, but the link preview `cards/trenchingsimulator.jpg`
   and `keyart.webp` show the "Trench Board" UI and "T" mark in screenshots → regenerate with
   `npx vite build && node tools/games/trench-art.mjs` after the rename (sizes pinned: jpg ≤160000 bytes, 1200×630;
   build checks ≤154,000 target in the tool).
7. **Logos**: a parody logo must not copy GMGN's/pump.fun's artwork (trademark; also the phishing-lookalike risk CLAUDE.md
   cites). Draw simple original SVG marks in code (glyph-style, `document.createElementNS`), not their logo files.
8. **SAFETY_NOTE**: keep "Not affiliated with any real trading terminal" (more important with parody names); exact text is
   asserted at :1017 and appears on every screen around a run.

## 7. CSS facts

trench.css (3570 lines): page defaults `html[data-page='trenchingsimulator']` (~:30, = Trench Board colors), screens
(:120), HUD (:708), results (:947), toasts (:1070), sheets (:1117), **Trench Board `tsb-` (:1194, ~187 classes)**, media
queries (:3133-3556; Board breakpoints 720 / 1024 / 1180 px). Shell screens use only `--t-muted, line, accent, text,
panel, down, up, bg, warn`. Tests on CSS: trench-live.test.js:1508-1519 (live selectors' scope, `.ts-play.is-live` flex
column, the live strip order under 1024px). Lightning CSS caveats from CLAUDE.md: prefixed pair order
(`-webkit-backdrop-filter` first), `dvh` fallbacks dropped.

## 8. Other features the parent asked about (code hooks)

- **Optional player name**: store in save (`trench_v1`), show in the HUD/PnL card; reuse server name rules
  (`reviewName()` in server/arcade.js) when it's sent anywhere.
- **Leaderboards**: run.result has `seed, solUsd, start, mode, challenge, daily, terminal, currency, live`; the daily
  market is one seed for everyone (`dailySeed(key)`), perfect for a daily board. Verify simulated scores on the server
  with `engine.replay({seed, solUsd, startSol, config, log: market.log(), until})` (a 30-min run = 18,000 steps).
  Live runs can't be replayed → separate unverified board or excluded. Server must live in `/api/wallet` (12-function
  limit; arcade.js/arcade.sql pattern: player id `agi_player`, HMAC codes, daily caps). Ride 'Em, AGI! scores come only
  from the client (no replay) → caps/plausibility checks only.
- **Multiplayer via invite link**: the engine is deterministic from `seed` + each player's own orders, so a "race" (same
  seed, same start, own wallets, compare worth at the end) needs only a shared room code → seed and a scores endpoint;
  true shared markets (players' trades moving each other's prices) would need the relay (WebSocket) and server-side
  engine. Recommend race rooms first (no wallet, link `…/trenchingsimulator#room=<code>`, fragment never sent in URLs).
- **Her world on the front**: index.html "Her world" list (`lp-` classes, src/landing/landing.js; tests/landing.test.js
  pins its six rows in order and their colors/entrance) — adding AGI Games and Roadmap means updating that test's row
  list; the front already got a 6th row for AGI Studio (2026-10-13), and short computer screens tightened rows to fit.

## 9. Suggested order of work (safe)

1. Rename names in terminals.js (+ board.js:267/1252, trench-art.mjs:102), update tests :1020/:1029/:1046 deliberately,
   run `node --test tests/trench*.test.js`.
2. Extract `boards/common.js` (board.js re-exports), run tests (no behaviour change).
3. Add registry in shell.js, `scan` → `mountGngm`, set `ready: true`, full color set.
4. Build gngm.js + CSS (`tsg-`), widen CSS scope test, add files to the no-link test.
5. Per-terminal PnL card drawer; chart.js options for GNGM.
6. Regenerate key art/card; update CLAUDE.md.
