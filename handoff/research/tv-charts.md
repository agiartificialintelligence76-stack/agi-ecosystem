# TradingView Lightweight Charts for TRENCHING SIMULATOR's GMGN-style chart

Research only (2026-10-22). **Nothing in `/home/user/agi-ecosystem` was changed.** Everything below was measured in
Claude's scratchpad: `/tmp/claude-0/-home-user-agi-ecosystem/3a68cf55-88eb-5b1b-9a13-4a2b793da4f7/scratchpad/`
(abbreviated `SP/` below).

## 0. Verdict

**Use `lightweight-charts@5.2.1` (exact pin), behind a small wrapper module with the same `set()` API as today's
`chart.js`, loaded only on Trench Board's / GNGM's coin page (a lazy chunk).** It works under the site's exact CSP
with `layout.attributionLogo: false` (0 violations, tested in Chromium with the real header), holds 60 fps with 1,000
one-second candles and a `set()` every 100 ms, and gives what the hand-drawn chart can't: drag / wheel / pinch zoom and
scroll, kinetic touch scroll, a real seconds time axis, crosshair labels on both axes, a price/mcap toggle with
subscript-zero prices, a last-price line, markers and custom primitives. Cost: ~55 KB gzipped (vs ~3 KB for chart.js),
~1 ms of main thread per update (vs 0.03 ms), and a **required attribution notice + link to tradingview.com on the
page** (a text credit; the built-in logo needs a CSP hash, see §3).

It is not TradingView's *Advanced Charts* (no drawing toolbar, no indicator menu, no "fx" UI): GMGN's look comes from
our own DOM toolbar over it (timeframes, Price/MCap, USD/SOL, markers on/off).

## 1. Version

| | |
|---|---|
| Pick | **5.2.1**, published 2026-08-12 (>2 weeks before 2026-10-21: OK), the latest stable on npm on 2026-10-22 |
| Previous | 5.2.0 (hit testing, `tickMarkDensity`, `hoveredSeriesOnTop`), 5.1.0 (`enableConflation`, data conflation for very many bars), 5.0.x (the v5 API: `addSeries(Type)`, panes, `createSeriesMarkers`) |
| Pin as | `"lightweight-charts": "5.2.1"` (exact, like the relay's packages), `npm install --save-exact lightweight-charts@5.2.1` |
| Dependency | one: `fancy-canvas` 2.1.0 (same authors, MIT-compatible, tiny) |
| Format | ESM (`"type": "module"`, `module`/`main` → `dist/lightweight-charts.production.mjs`), no CSS file, no fonts, no workers, no WASM |
| Release notes read | `SP/dl/lwcnotes/rn.md`; the library's own agent skill (foot-guns) `SP/dl/lwcnotes/skill.md` |

## 2. Size (measured)

Vite 8.3.0 (the repo's), production build, each entry lazy-loaded so it lands in its own chunk; gzip -9.
Builds in `SP/lwcscripts/sizes/outa-*`.

| Chunk | Raw min | gzip |
|---|---|---|
| `createChart` + `CandlestickSeries` only | 161.6 KB | **51.5 KB** |
| what the sketch imports (candles, histogram, markers, enums) | 172.3 KB | **54.8 KB** |
| the whole sketch module (`gchart.js` + `format.js` + LWC) | 178.6 KB | **57.3 KB** |
| `export *` (everything) | 194.1 KB | 61.3 KB |
| today: `chart.js` + `format.js` | 6.3 KB | 2.9 KB |
| npm file as shipped: `lightweight-charts.production.mjs` | 197.9 KB (standalone) | 60.4 KB |

Tree shaking helps only a little (v5 moved series types to their own exports; the core is most of it). Load it with
`import('./gchart.js')` when a coin page opens, so the board and the rest of the site don't pay for it.

Heap in the test: ~10.8 MB with 1,000 bars (chart.js: ~4.1 MB).

## 3. License and attribution (exact)

- **License:** Apache-2.0 (`LICENSE` in the package). Code header: `TradingView Lightweight Charts™ v5.2.1 /
  Copyright (c) 2026 TradingView, Inc. / Licensed under Apache License 2.0`.
- **NOTICE file** (repo root, tag v5.2.1, fetched to `SP/dl/lwcnotice/NOTICE`), exactly two lines:

  ```
  TradingView Lightweight Charts™
  Copyright (с) 2025 TradingView, Inc. https://www.tradingview.com/
  ```

  Careful: the "с" in "(с)" is **Cyrillic U+0441**, not a Latin c (and ™ is U+2122). Either copy it byte for byte or
  write "(c)" / "©"; a test that greps for the notice should match the words, not the bytes.
- **The README's requirement** (README.md line 129, in the npm package): *"You shall add the "attribution notice" from
  the NOTICE file and a link to <https://www.tradingview.com/> to the page of your website or mobile application that
  is available to your users."* (Plus: "we'd be grateful if you add it in a prominent place.") Line 131: the
  `attributionLogo` chart option "will satisfy the link requirement".
- So what must be shown: **(1) the NOTICE text and (2) a link to https://www.tradingview.com/, on a page users can
  reach.** The on-chart logo is optional; a text credit satisfies both. Suggested (tested in the harness,
  `SP/lwcscripts/app/index.html`):

  ```html
  <p class="tsb-credit">Charts: <a href="https://www.tradingview.com/" target="_blank" rel="noopener">TradingView
  Lightweight Charts™</a> · Copyright (c) 2025 TradingView, Inc.</p>
  ```

  Where: under the chart (small, muted) on every page that shows it, and in the game's How to play / about. It names
  TradingView as the chart library, never as a terminal, so it doesn't break the "parody names only" rule.
- **Apache §4 (redistribution):** ship a copy of the license. Vite 8 strips the `/*! @license */` header from the
  minified chunk (checked: 0 hits in the built JS). Fix with one build option, tested:
  `build: { license: true }` in `vite.config.js` writes `dist/.vite/license.md` with `## lightweight-charts - 5.2.1
  (Apache-2.0)` and its full license text (`SP/lwcscripts/sizes/outl-used/.vite/license.md`). Or link the license from
  the credit line. (Not legal advice.)
- **The built-in logo vs the site's CSP:** `layout.attributionLogo: true` (v5's default!) adds `<a id="tv-attr-logo">`
  plus an inline `<style>` element; `style-src 'self'` refuses it (`style-src-elem` violation, logged), so the link is
  there but unstyled (35×15 px, invisible). Two ways, both tested in Chromium:
  1. **`attributionLogo: false` + the text credit above** (recommended: no CSP change). 0 violations.
  2. Allow exactly that style by hash: `style-src 'self' 'sha256-3pRED1tOXas1FXFoPb9TGCjmYe9XQsmO9OV23khV2nY='`.
     0 violations, the logo renders bottom-left (35×19). The hash is the 5.2.1 stylesheet's: **any version bump can
     change it** (a test should pin it). Its link carries `utm_source=<hostname><path>` (e.g.
     `utm_source=127.0.0.1/index.html`), sent only if clicked.
  **Remember to pass `attributionLogo: false` explicitly**: the default is `true`.

## 4. CSP compatibility (grep + real browser)

The site's CSP (`vercel.json` lines 48–49):
`default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self'; font-src 'self'; img-src
'self' data: blob: https://live.agi1.app; media-src 'self' blob:; connect-src 'self' blob: https://api.dexscreener.com
wss://live.agi1.app; frame-src 'self' https://challenges.cloudflare.com; object-src 'none'; base-uri 'self';
form-action 'self'; frame-ancestors 'self'; upgrade-insecure-requests`

- **Grep of `lightweight-charts.production.mjs` + `fancy-canvas`:** no `eval`, no `new Function`, no `importScripts`,
  no WebAssembly, no `fetch`/`XMLHttpRequest`/`WebSocket`, no external URL except the tradingview.com logo link; no
  `innerHTML` of user data; one `createElement('style')` (the logo only); every other style is CSSOM
  (`el.style.x = …`, `setProperty`), which `style-src 'self'` allows (it blocks style *attributes in markup* and
  `<style>` elements, not CSSOM).
- **Chromium test** (`SP/lwcscripts/probe.mjs`, served by `SP/lwcscripts/serve.mjs`, which copies `vercel.json`'s
  `/(.*)` headers verbatim; headless Chromium 141 at `/opt/pw-browsers/chromium-1194/`, playwright-core 1.56.1):
  logo off → **0 `securitypolicyviolation` events**, 7 canvases drawn (candles counted by pixel color), 19 elements with
  CSSOM styles, 0 `<style>` elements; logo on → exactly one violation (`style-src-elem`, `inline`); with the hash added
  (`SP/lwcscripts/serve-hash.mjs`) → 0. Results: `SP/lwcscripts/probe.json`, screenshots in `SP/lwcscripts/shots/`.
- No `img-src` / `font-src` / `connect-src` changes needed. Fonts: it uses whatever `fontFamily` we pass (the site's
  self-hosted Geist Mono).

## 5. API for what the GMGN chart needs (v5.2.1)

Imports: `createChart, CandlestickSeries, HistogramSeries, createSeriesMarkers, ColorType, CrosshairMode, LineStyle,
TickMarkType, LastPriceAnimationMode` (optionally `PriceScaleMode`, `createTextWatermark`).

**Time.** `time` is a `UTCTimestamp`: integer **seconds** since 1970, strictly ascending and unique per series. The
engine's candles have `t` = seconds on the market's clock; map with `time = Math.round(base / 1000) + t` (`base` = page
ms when the market clock read 0, which board.js already passes as `clockBase`). LWC formats times **in UTC** and has no
time-zone option: give it `timeScale.tickMarkFormatter(time, tickMarkType)` and `localization.timeFormatter(time)` that
use `new Date(time * 1000)` local getters (done in the sketch). `timeScale: { timeVisible: true, secondsVisible: true }`
gives `TickMarkType.TimeWithSeconds` ticks (HH:MM:SS) for 1 s / 15 s bars.

**Candles.** `const s = chart.addSeries(CandlestickSeries, { upColor, downColor, borderVisible: false, wickUpColor,
wickDownColor, priceLineVisible: true, priceLineStyle: LineStyle.Dashed, lastValueVisible: true,
lastPriceAnimation: LastPriceAnimationMode.Disabled, priceFormat })`; data `{ time, open, high, low, close }`.

**Volume.** `chart.addSeries(HistogramSeries, { priceScaleId: '', priceFormat: { type: 'volume' },
lastValueVisible: false, priceLineVisible: false })` then
`vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })`, candles' scale
`scaleMargins: { top: 0.08, bottom: 0.26 }`; per-bar `color` (`rgba(…,0.35)` up/down). Or a real second pane
(`chart.addSeries(HistogramSeries, opts, 1)` / `addPane()`, `pane.setStretchFactor()`) with its own separator line
(`layout.panes.separatorColor`) — closer to TradingView, costs a little height on phones.

**Markers (v5).** `const mk = createSeriesMarkers(series, [])`, `mk.setMarkers([{ time, position: 'aboveBar' |
'belowBar' | 'inBar', shape: 'arrowUp' | 'arrowDown' | 'circle' | 'square', color, text, size }])`. Times must be bar
times of the series' timeframe (bucket them first). In 5.2.1's source a marker between bars snaps to the bar at or before
it; the docs say misaligned markers may be dropped — always bucket. Used for the migration ("Migrated", honey arrow).

**Custom drawing: series primitives.** `series.attachPrimitive(obj)` with `attached({ chart, series, requestUpdate })`,
`updateAllViews()` (compute x via `chart.timeScale().timeToCoordinate(time)`, y via `series.priceToCoordinate(v)`),
`paneViews() → [{ zOrder: () => 'top', renderer: () => ({ draw(target) { target.useBitmapCoordinateSpace(({ context,
horizontalPixelRatio, verticalPixelRatio }) => …) } }) }]`. The sketch draws GMGN-style **B / S bubbles** (r = 7 px,
10 px mono letter, 13 px under the low / over the high) this way: crisp at any DPR, zoom and scroll for free. Same tool
for KOL / dev / sniper avatars later (dots with initials; never real avatars on real coins: the Live mode rules).

**Tiny prices: `0.0₅1234`.** `priceFormat: { type: 'custom', formatter: (v) => '$' + price(v, 4), minMove: 1e-13 }`
where `price` is the game's own `format.js` `price(p, sig = 4)` (line 126). Measured on the axis and the crosshair
label: `0.000001234 → $0.0₅1234`, `0.0000056789 → $0.0₅5679`, `0.00012 → $0.00012`, `0.0000000987 → $0.0₇987`.
`minMove` must be small (1e-13) or the scale rounds tiny prices to 0. Polish: also pass
`tickmarksFormatter: (vals) => vals.map(…)` (5.x) so all tick labels use the same number of significant digits (with
the plain formatter some ticks showed 3 digits, some 4).

**Market-cap mode.** The engine's candles are market caps in SOL (`engine.js` ~395–425, `curve.js` line 9 `SUPPLY =
1_000_000_000`). One value function covers GMGN's two toggles:
`value = mcSol × (unit === 'usd' ? solUsd : 1) ÷ (mode === 'price' ? SUPPLY : 1)`; mcap formatter `usd()` / `compact()`
(format.js lines 38 / 11): `1234 → $1.23K`, `12345.6 → $12.3K`, `456789 → $457K` (measured). Switching mode or unit:
`applyOptions({ priceFormat })` + one `setData()`. `PriceScaleMode.Logarithmic` is a one-line option for a "log"
toggle (pump.fun curves are exponential: worth offering).

**Realtime.** `series.update(bar)`: same `time` as the last bar → replaces it; later → appends; earlier → throws (catch
it: never send an older bar). Use `setData()` only on a coin / timeframe / mode / unit change or when history is
prepended. Multiple `update()`s in one task coalesce into **one** `requestAnimationFrame` paint (LWC's invalidation
queue). `chart.timeScale().scrollToRealTime()` for a "back to now" button; `shiftVisibleRangeOnNewBar: true` keeps the
view glued to the right edge only while the user is at the right edge (TradingView behaviour).

**Crosshair.** `crosshair: { mode: CrosshairMode.Normal, vertLine / horzLine: { color, width: 1, style:
LineStyle.Dashed, labelBackgroundColor } }` gives the time label on the axis and the price label on the scale (screenshot
`shots/lwc-crosshair.png`). For GMGN's O/H/L/C/Vol legend top-left: `chart.subscribeCrosshairMove((p) => …)`; `p.time`
and `p.seriesData.get(series)` can be undefined (outside data): null-check, fall back to the last bar. Render it as DOM
text (accessible, selectable), set with `textContent`.

**Sizing.** `autoSize: true` → LWC observes the host with its own ResizeObserver. Measured: host 1204 → 540 px, the
canvas followed within one frame (`chart.autoSizeActive() === true`; `options().width` reads 0 when autosized, by
design). The host needs a real CSS height (e.g. `height: clamp(260px, 52vh, 560px)` on computers, a fixed height in
the phone layout). DPR handled (tested at 3×).

**Scroll / zoom.** `handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag:
false }` (vertical swipe still scrolls the page on phones), `handleScale: { mouseWheel: true, pinch: true,
axisPressedMouseMove: { time: true, price: true }, axisDoubleClickReset: true }`, `kineticScroll: { touch: true,
mouse: false }`, `timeScale: { barSpacing: 7, minBarSpacing: 0.8, rightOffset: 6 }`. Note the wheel then zooms the chart
instead of scrolling the page (the site's 3D stage keeps the wheel for the page); TradingView/GMGN do zoom on wheel, so
it fits a terminal.

**Other v5 extras worth using:** `createTextWatermark(chart.panes()[0], { lines: [{ text: '$TICKER · 1s', color:
'rgba(255,255,255,0.05)', fontSize: 48 }] })` (GMGN-like ticker watermark), `hoveredSeriesOnTop` and hit testing
(5.2.0), `enableConflation` (5.1, only matters for tens of thousands of bars; 4,000 max here: leave off).

## 6. Performance (measured)

Harness `SP/lwcscripts/app/main.js`: 1,000 one-second candles; every 100 ms the last candle changes, every second a new
one; `chart.set()` with the whole array each time (exactly what board.js does); 10 s per run; Chrome DevTools
Performance metrics over the run; frames counted with rAF. **Headless Chromium with software rendering (no GPU)** —
real devices with a GPU are faster for both.

| Run | fps | main thread busy | `set()` per call | heap |
|---|---|---|---|---|
| LWC, 1280×800 @1× | 60.1 | 15.5 % | 1.03 ms | 10.8 MB |
| LWC, same + mouse moving over it | 59.8 | 26.1 % | 3.05 ms* | 9.8 MB |
| LWC, phone 390×844 @3× (touch) | 59.9 | 12.3 % | 1.12 ms | 10.4 MB |
| chart.js, 1280×800 @1× | 60.1 | 5.3 % | 0.034 ms** | 4.1 MB |
| chart.js + mouse | 59.9 | 13.2 % | 0.056 ms | 4.6 MB |
| chart.js, phone @3× | 60.0 | 8.4 % | 0.031 ms | 4.2 MB |

\* includes crosshair work triggered in the same tasks. \** chart.js only marks dirty; its draw happens in rAF (not in
this number). Each `update()` alone ≈ 0.47 ms; a full paint fits well inside a 16.7 ms frame. No dropped frames, no
console errors, 0 CSP violations in any run.

Cheap wins in the wrapper (not yet in the sketch): aggregate only the tail (the engine already gives `candles(id,
since)`), skip `setMarkers` / `bubbles.set` when unchanged, and keep board.js's 250 ms `FAST_MS` (board.js line 40)
rather than updating per trade; LWC repaints at most once per frame anyway.

## 7. A GMGN-like dark theme

GMGN itself couldn't be inspected (gmgn.ai answers 403 through the proxy: not retried). The sibling research
`SP/research/gmgn-live.md` (lines 110–144, from a GMGN clone's theme: [RECALL]) gives: background `#0D0D0F`, card
`#17181A`, hairline `#1F2024`, text `#EAECEF`, secondary `#7F8288` (use `#8A8D93` for AA), up `#09B884`; red not found
(suggested `#F2495C`). Proposed chart palette, contrast checked (WCAG):

| Token | Value | Note |
|---|---|---|
| `bg` | `#0d0d0f` | chart background (`layout.background`) |
| `grid` | `rgba(255,255,255,0.04)` | both grid directions, barely visible |
| `border` | `#1f2024` | scale borders, pane separator |
| `text` | `#8a8d93` | axis labels: 5.84:1 on bg (AA) |
| `strong` | `#eaecef` | legend values: 16.4:1 |
| `up` | `#16c47f` (or `#09b884`) | candles/wicks; 8.54:1 on bg |
| `down` | `#f2495c` | candles/wicks; 5.44:1 on bg |
| `upVol` / `downVol` | the same at 0.35 alpha | volume bars |
| `cross` | `#5d616b` | dashed crosshair lines |
| `label` | `#2a2d35` | crosshair label background (`#eaecef` on it 11.6:1) |
| `mig` | `#f5b83d` | migration marker |

LWC picks black or white text for its colored last-value label by luminance (dark text on both up and down here).
The sketch's current numbers (`#101114`, `#2ebd85`, `#f6465d`, `#8b8f98`) are close; swap to the table above for one
palette with the GNGM terminal. Calibrate against real GMGN screenshots when someone can look (not done: the site was
unreachable).

## 8. The chart module (tested sketch)

File: `SP/lwcscripts/app/gchart.js` (254 lines; tested in the harness with the real CSP). It keeps **chart.js's API**
— `createGChart(host, opts).set({ candles, solUsd, marks, tf, migratedAt, base })` — so board.js swaps one call. It adds
`view({ mode, unit })`, `fit()`, `toNow()`, and exposes `chart`. Core:

```js
import { createChart, CandlestickSeries, HistogramSeries, createSeriesMarkers, ColorType, CrosshairMode,
  LineStyle, TickMarkType, LastPriceAnimationMode } from 'lightweight-charts';
import { price as tinyPrice, usd, compact } from './format.js';

export const SUPPLY = 1_000_000_000;
export const TIMEFRAMES = Object.freeze([1, 15, 30, 60, 300, 900, 3600]); // 1s 15s 30s 1m 5m 15m 1h
export const valueOf = (mcSol, { mode, unit, solUsd }) =>
  mcSol * (unit === 'usd' ? solUsd : 1) / (mode === 'price' ? SUPPLY : 1);
export function formatterFor(mode, unit) {
  if (mode === 'price') return (v) => (unit === 'usd' ? `$${tinyPrice(v, 4)}` : tinyPrice(v, 4));
  return (v) => (unit === 'usd' ? usd(v) : compact(v, 2));
}

export function createGChart(host, { mode = 'mcap', unit = 'usd', tf = 1, colors = {}, attribution = false } = {}) {
  const C = { ...PALETTE, ...colors };
  let data = { candles: [], solUsd: 150, marks: [], tf, migratedAt: null, base: null };
  let view = { mode, unit };
  let sent = null;                                   // what the series already has
  const sec0 = () => (Number.isFinite(data.base) ? Math.round(data.base / 1000) : 0);
  const two = (n) => String(n).padStart(2, '0');
  const tick = (t, type) => { const d = new Date(t * 1000);   // local time, not UTC
    if (type === TickMarkType.TimeWithSeconds) return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
    if (type === TickMarkType.Time) return `${two(d.getHours())}:${two(d.getMinutes())}`;
    return `${d.getMonth() + 1}/${d.getDate()}`; };
  const chart = createChart(host, {
    autoSize: true,
    layout: { background: { type: ColorType.Solid, color: C.bg }, textColor: C.text, fontSize: 11,
      fontFamily: '"Geist Mono", ui-monospace, monospace', attributionLogo: attribution /* false: CSP */ },
    grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
    crosshair: { mode: CrosshairMode.Normal,
      vertLine: { color: C.cross, width: 1, style: LineStyle.Dashed, labelBackgroundColor: C.label },
      horzLine: { color: C.cross, width: 1, style: LineStyle.Dashed, labelBackgroundColor: C.label } },
    rightPriceScale: { borderColor: C.border, scaleMargins: { top: 0.08, bottom: 0.26 }, entireTextOnly: true },
    timeScale: { borderColor: C.border, timeVisible: true, secondsVisible: true, rightOffset: 6, barSpacing: 7,
      minBarSpacing: 0.8, shiftVisibleRangeOnNewBar: true, tickMarkFormatter: tick },
    localization: { timeFormatter: (t) => tick(t, TickMarkType.TimeWithSeconds) },
    handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: { time: true, price: true }, axisDoubleClickReset: true },
    kineticScroll: { touch: true, mouse: false },
  });
  const candles = chart.addSeries(CandlestickSeries, { upColor: C.up, downColor: C.down, borderVisible: false,
    wickUpColor: C.up, wickDownColor: C.down, priceLineVisible: true, priceLineStyle: LineStyle.Dashed,
    lastValueVisible: true, lastPriceAnimation: LastPriceAnimationMode.Disabled,
    priceFormat: { type: 'custom', formatter: formatterFor(mode, unit), minMove: mode === 'price' ? 1e-13 : 0.01 } });
  const volume = chart.addSeries(HistogramSeries, { priceScaleId: '', priceFormat: { type: 'volume' },
    lastValueVisible: false, priceLineVisible: false });
  volume.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
  const bubbles = new TradeBubbles(C);               // series primitive: B / S bubbles (see the file)
  candles.attachPrimitive(bubbles);
  const markers = createSeriesMarkers(candles, []);   // the migration arrow

  function sync() {
    const bars = aggregate(data.candles, data.tf);
    const key = `${view.mode}|${view.unit}|${data.tf}|${data.solUsd}|${sec0()}`;
    const first = bars.length ? bars[0].t : null;
    if (!sent || sent.key !== key || sent.first !== first || bars.length < sent.n - 1) {
      candles.setData(bars.map((b) => toBar(b).c)); volume.setData(bars.map((b) => toBar(b).v));
      sent = { key, first, t: bars.at(-1)?.t ?? -Infinity, n: bars.length };
    } else {                                          // only the last bar again, and the new ones
      let i = bars.length - 1; while (i > 0 && bars[i - 1].t >= sent.t) i--;
      for (; i < bars.length; i++) if (bars[i].t >= sent.t) { const x = toBar(bars[i]); candles.update(x.c); volume.update(x.v); }
      sent.t = bars.at(-1)?.t ?? sent.t; sent.n = bars.length;
    }
    // marks bucketed to their bar → bubbles.set([...]); migratedAt → markers.setMarkers([{ time, position: 'aboveBar',
    // shape: 'arrowDown', color: C.mig, text: 'Migrated' }]) or []
  }
  return { chart, set(d) { data = { ...data, ...d }; sync(); },
    view(v) { view = { ...view, ...v }; candles.applyOptions({ priceFormat: { type: 'custom',
      formatter: formatterFor(view.mode, view.unit), minMove: view.mode === 'price' ? 1e-13 : 0.01 } }); sent = null; sync(); },
    fit: () => chart.timeScale().fitContent(), toNow: () => chart.timeScale().scrollToRealTime(),
    redraw() {}, destroy() { candles.detachPrimitive(bubbles); chart.remove(); } };
}
```

(`toBar`, `aggregate`, `PALETTE` and the `TradeBubbles` class are in the file; `aggregate` is chart.js's own, line 14.)

Verified in Chromium: 1,000 bars set, mcap axis `$1.23K / $12.3K / $457K`, price mode with subscript zeros, SOL unit,
15 s timeframe (1,000 s → 40 bars), B / S bubbles and the Migrated marker drawn, crosshair labels on both axes,
autoSize, `destroy()`. Screenshots: `SP/lwcscripts/shots/lwc-mcap.png`, `lwc-crosshair.png`, `lwc-price.png`,
`lwc-price-sol.png`, `lwc-tf15.png`, `lwc-logo.png` (logo blocked), `lwc-logo-hash.png` (logo with the hash).

## 9. Integrating it in the game (notes for the builder)

- **Host, not canvas.** board.js lines 487–493 make `<canvas class="tsb-canvas" role="img" aria-label="Market cap
  chart">` and call `createChart(canvas, …)`. LWC builds its own DOM (a table of canvases) inside a host: make it a
  `div` (`el('div', { class: 'tsb-chart', role: 'img', 'aria-label': … })`), give it a CSS height, and update the
  aria-label from the legend's text (LWC's canvases say nothing to screen readers).
- **Same `set()`.** board.js line 862 `chart.set({ candles: C.arr, solUsd: px, marks, tf: B.tf, migratedAt:
  s.migratedAt, base: clockBase })` works unchanged; `destroy()` at line 1350 too. `TIMEFRAMES` gains 30 s / 15 m / 1 h
  (chart.js's are 1 s, 15 s, 1 m, 5 m: line 8): check the engine keeps enough history (KEEP.candles 4000 one-second
  candles ≈ 66 minutes: line 46; a 1 h timeframe would show ~1 bar → offer up to 15 m, or keep longer history).
- **Toolbar in DOM** (GMGN's top row): timeframe chips, `Price | MCap`, `USD | SOL`, a "markers" toggle, a ↻ "now"
  button (`toNow()`), maybe `Log`. Above or inside `.tsb-chart-tools`; the existing "Market cap · USD" label (line 491)
  becomes the toggles' state.
- **Legend in DOM** via `subscribeCrosshairMove`: `O H L C` and `Vol` in the palette's colors, plus the change %.
- **Lazy load:** `const { createGChart } = await import('./gchart.js')` when a coin page first opens; draw the old
  placeholder meanwhile.
- **Attribution:** the text credit (§3) under the chart, and in How to play; `build.license: true` in vite.config.js.
  `tests/clips.test.js` limits the site's package.json dependencies, `tests/trench*.test.js` read the game's pure files
  in Node: LWC needs a DOM, so keep it out of the Node-tested pure modules (the sketch's `aggregate`, `valueOf`,
  `formatterFor` are pure and can be tested; `createGChart` only in the browser test).
- **Live mode:** real coins' candles come the same way (the relay's curve prices → 1 s candles); the B / S bubbles stay
  the player's own trades only (no dev/KOL marks on real coins: the Live mode rules).
- **Accessibility / motion:** no animation to switch off (`lastPriceAnimation: Disabled`); keyboard users get the DOM
  toolbar and legend; the chart itself isn't keyboard-operable (TradingView's neither).

## 10. Compared with today's `chart.js` (280 lines)

| | `chart.js` (today) | LWC wrapper |
|---|---|---|
| Size | 2.9 KB gz | ~57 KB gz (lazy) |
| Update cost | 0.03 ms + one rAF draw of everything | ~1 ms (diffed `update()`), one coalesced paint |
| Zoom / scroll | none (shows the last `floor((W−64)/7)` bars, line 135) | wheel, drag, pinch, kinetic touch, axis drag, double-click reset |
| Time axis | own labels, no seconds grid logic beyond `timeTicks` | real time scale, seconds, local time via formatter |
| Crosshair | vertical line + O/H/L/C text (pointermove, line 119) | both lines, axis labels, legend hook |
| Price / MCap / units | MCap USD only | MCap or price (0.0₅1234), USD or SOL |
| Volume | bottom 18 % at 0.45 alpha (lines 144, 192) | histogram overlay or own pane |
| Markers | B/S circles, migration dashed line (lines 218–258) | B/S bubbles (primitive), markers plugin, price line |
| Look | hand-tuned, ours | TradingView's familiar feel (what GMGN players expect) |
| Licence | ours | Apache-2.0 + notice + tradingview.com link on the page |
| CSP | fine | fine with `attributionLogo: false` (or a hash) |

## 11. Risks and polish list

1. `attributionLogo` defaults to **true**: forgetting `false` gives a CSP violation in the console and an invisible link.
2. Notice text: the NOTICE's "(с)" is Cyrillic; write "(c)". Keep the link to https://www.tradingview.com/.
3. Times are UTC unless formatted: always pass both formatters. Never `update()` an older time (throws).
4. Wheel zooms the chart (page scroll stops over it on computers): intended for a terminal; mention in How to play.
5. The leftmost time label can be clipped at the edge; the last-value label can overlap a tick label; price ticks
   continue into the volume band (normal in TradingView). Cosmetic.
6. Price-mode tick labels: add `tickmarksFormatter` for consistent significant digits.
7. A version bump can change the logo's CSS hash, the bundle size and defaults: pin exactly, re-run the CSP probe.
8. GMGN look is from a clone's theme and memory, not measured (gmgn.ai unreachable here).
9. Not tried: real phones (Safari iOS pinch / kinetic scroll inside the game's sheets), a GPU device's CPU numbers,
   screen readers.

## 12. How to re-run

```sh
SP=/tmp/claude-0/-home-user-agi-ecosystem/3a68cf55-88eb-5b1b-9a13-4a2b793da4f7/scratchpad
cd $SP/lwcscripts && node /home/user/agi-ecosystem/node_modules/vite/bin/vite.js build -c vite.config.mjs
node serve.mjs 5199 &            # dist/ with vercel.json's real headers
HASH=… node serve-hash.mjs 5200 & # the same + the logo's style hash
node probe.mjs 5199 shots > probe.json   # CSP, logo, price mode, resize, perf (lwc vs old)
```

Package: `$SP/lwc/node_modules/lightweight-charts` (5.2.1). Size builds: `$SP/lwcscripts/sizes/`. NOTICE:
`$SP/dl/lwcnotice/NOTICE`. Release notes / skill: `$SP/dl/lwcnotes/`.
