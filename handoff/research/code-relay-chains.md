# TRENCHING SIMULATOR: the relay, race rooms, and GMGN's chains

Researched 2026-10-21 by a research subagent. **Research only: no repo file was changed.**

Confidence marks: **[CODE]** read in this repo (file:line) · **[RUN]** measured here · **[WEB]** a web result seen this
session · **[PRIOR]** from the sibling notes `gmgn-web.md` / `gmgn-live.md` (GMGN's own npm packages) · **[U]** unverified.

**Network limits hit this session (not retried, not routed around):** `api.dexscreener.com` → proxy `CONNECT 403` (curl)
and `ENOTFOUND` (WebFetch); `docs.dexscreener.com` → `ENOTFOUND`. So the live chainId tally of `token-profiles` /
`token-boosts` **could not be taken here**. Chain ids below were checked instead through search results that show real
`dexscreener.com/<chainId>/<address>` URLs. §B.6 gives a zero-cost way to measure the real tally on the owner's server.

---

## A. The relay today (map)

### A.1 Files

| File | Role | Key facts |
|---|---|---|
| `tools/trench-relay/server.mjs` (278 lines) | HTTP + WebSocket entry | `startRelay(cfg, {log, problems, WS, sharp, timing, fetchJson, fetchTrusted, fetchSafe, now})` :29. Routes: `GET /health` :113 (JSON, no-store), `GET /p/<22-char>.webp` :122 (pictures, `picOk` 900/min/IP :72), else 404; non-GET/HEAD 405. Upgrade: `new WebSocketServer({ noServer:true, maxPayload:2048, perMessageDeflate:false, clientTracking:false })` :146; `server.on('upgrade')` :148; **path must be `/ws`** :163; **Origin must be in `cfg.origins`** :164 (403); full (`hub.clients >= maxClients`) → accepted only to close `1013 'busy'` :166-177 (at most 50 at once, else 503); per-IP count `perIp` :63/:183 (429), released on close :189; then `hub.attach(ws)` :197. `ipOf` uses the last `X-Forwarded-For` hop when `trustProxy` :66. |
| `lib/hub.mjs` (434) | Fan-out | `PREFIX = { solana:'s', robinhood:'r', bnb:'b', base:'a' }` :16; `ID = /^[srba][0-9]{1,9}$/` :17; `LIMITS = { keep:400, snap:60, hist:300, watchPer:8, msgBurst:20, msgPerSec:2, maxMsgBytes:2048, high:512 KB, low:128 KB, hard:4 MB, histPer10s:6 }` :18; `QUIET_MS` :21 (sol 3 min, robinhood 45 min, bnb/base 30 min). `createHub({log, chains, batchMs=500, pingMs=25000, now, onWatch, limits})` :23. `send(cl, text, {essential})` :50 (backpressure), batching `flush()` every 500 ms :202/:224, pings :225-238, `attach(ws)` :257 (sends `hi`), `drop(cl, why)` :282 (terminate when slow / no pong, else close 1008), `take(cl)` :292 (token bucket), `onMessage` :301: `{op:'sub',chain}` :318, `{op:'unsub'}` :319, `{op:'watch',ids≤8}` :320. Server messages: `hi snap c u off pic h st px`. |
| `lib/config.mjs` | Settings | `CHAIN_IDS = ['solana','robinhood','bnb','base']` :5; `DEFAULTS` :6 (port 8787, `origins: ['https://agi1.app','https://www.agi1.app']` :9, `maxClients 2000` :10, `maxPerIp 10` :11, solanaTrack 150, watchMax 150, picCacheMb 64); `readConfig(env)` :71 (env `TRENCH_*`, `PUMPPORTAL_WS_URL`, `PUMPDEV_WS_URL`, `DEXSCREENER_URL`, `CLANK_API_URL`, `TRENCH_IPFS_GATEWAYS`, `HELIUS_API_KEY`; solanaTrack + watchMax ≤ 950). |
| `lib/log.mjs` | Log | scrubs secrets and any `api-key=`; `errText` strips queries. |
| `lib/net.mjs` | Fetch | `trustedGet/trustedJson` (settings' own addresses), `safeGet` (https:443, public IPs only, no redirect, size caps); UA `AGI1TrenchRelay/1.0`. |
| `lib/upstream.mjs` | One upstream WS | `backoffMs(failures,{base 1000, max 60000})`; `createUpstream({name,url,log,onOpen,onMessage,onDown,WS,pingMs,silenceMs,stableMs,backoff,now,headers})`. |
| `lib/parse.mjs` | Every source checked | `WSOL`; `WRAPPED = { sol:{solana,WSOL}, eth:{base,0x4200…0006}, bnb:{bsc,0xbb4c…c095c} }` :22; `PRICE_RANGE = { sol:[1,1e5], eth:[10,1e6], bnb:[1,1e5] }` :27; `CURVE_DEXES = { fourmeme, 'four-meme' → four.meme, pumpfun → pump.fun }` :29; `isB58` :33 (`/^[1-9A-HJ-NP-Za-km-z]{32,44}$/`), `isEvm` :34; `cleanText` :50; `parseProfiles(data, chains)` :226 **drops anything not `isEvm(tokenAddress)`** :230; clank coins :247. |
| `lib/sources/dex.mjs` | DexScreener | `EVM_CHAINS = { bnb:'bsc', base:'base', robinhood:'robinhood' }` :15; `FROM_DEX` :16; `JUDGED = ['bnb','base']` :18; `PER_CHAIN = 60` :20; `createDex({…, perMinute = 240})` :24; cadence `E = { prices:60 s, pools:15 s, discover:30 s, markets:20 s }` :25; `prices()` :57 → one `/tokens/v1/<chain>/<wrapped>` per coin; `discover()` :85 → **one** `/token-profiles/latest/v1` for all chains :88; `markets()` :100 → `/tokens/v1/<dexChain>/<≤30 addrs>` :108. |
| `lib/sources/pump.mjs`, `helius.mjs`, `clank.mjs` | Solana / Robinhood | PumpPortal (+PumpDev takeover after 90 s), Helius `accountSubscribe` ≤ 950, clank.trade polls (newest 12 s, older 36 s, trending 30 s). |
| `fakes.mjs` | Stand-ins | every outside service, used by `tests/trench-live.test.js`. |
| `Caddyfile` | TLS | `live.agi1.app { encode zstd gzip; header {…}; reverse_proxy agi1-trench:8787 }` → **any path** reaches the relay (so `/room` needs no Caddy change). |
| `Dockerfile` | Image | node:22-bookworm-slim, `npm ci --omit=dev`, `COPY server.mjs` + `COPY lib` (so a new `lib/rooms.mjs` ships with no Dockerfile change), `USER node`, HEALTHCHECK `/health`. Build context = `tools/trench-relay` only (relay.sh:37) → the relay **cannot import the site's `server/*.js`** (e.g. crude-word lists); copy what it needs into `lib/`. |
| `relay.sh` | Ops | `docker run … --cpus 0.75 --memory 512m` (:54-56) for the relay; Caddy (:60) has **no** CPU cap and shares the CX23's 2 cores with her live show. |

### A.2 Client side

- `src/games/trenchingsimulator/live-chains.js`: `RELAY_URL = 'wss://live.agi1.app/ws'` :10; `CHAINS` :17-22 (solana sol pump.fun; robinhood eth clank.trade; bnb bnb; base eth); `liveCurrency(terminalId, chainId)` :35 switches on terminal ids `'board' 'scan' 'chat' 'social' 'pro'` :38-45 (**these ids change when terminals get parody names**); `REAL_ENOUGH = 8` :70; `relayUrl(loc)` :86 (`?relay=` only from localhost); `LIVE_OPEN = true` :104; `ID = /^[srba][0-9]{1,9}$/` :156 (must match hub.mjs:17); `EVM = /^0x[0-9a-f]{40}$/` :158 (lower-cased); `parseCoin` :207; `parseMessage` :230, its `px` filter keeps **only `sol`, `eth`, `bnb`** :248-252.
- `live-feed.js`: `createLiveFeed({url, WebSocket, random, connectMs, timers})`, `FEED { connectMs 8000, maxBackoffMs 30000, keepCoins 300 }`; API `start(chain) stop() setChain() watch(ids) on(fn)` + getters `status chain chainState newCoins px coins() picUrl`; close code 1013 → `'full'`. **The pattern to mirror for a race client.**
- `live-market.js`: wraps `createMarket({live:true})` with the feed's coins.

### A.3 The engine is deterministic (the key fact for races and leaderboards)

- `engine.js`: `STEPS_PER_S = 10` :33; `createMarket({seed='trench', solUsd=150, startSol=1, config={}, live=false})` :106
  (runs a 600 s warm-up = 6,000 steps at creation); the order log `{ n, coin, side, sol, frac, slippage, priority }`;
  `replay({seed, solUsd, startSol, config, log, until})` :1782 rebuilds the same market (throws if out of order or an
  order fails).
- `run.js`: `createRun({seed, solUsd, mode, challenge, startSol, speed, currency, config, terminal, live, makeMarket,
  realTime})` :27; `realTime` = one speed, never paused (:9, :301-302) → **what a race needs**.
- **[RUN] cost on this workspace (4 cores, Node 22):** `createMarket` incl. warm-up ≈ 214–260 ms; 10 more market minutes
  (6,000 steps) ≈ 201–207 ms; `replay` of warm-up + 10 min ≈ 284–308 ms; identical `player.worth` both ways; RSS ≈ 110 MB.
  ⇒ A 10-minute run is ~0.3 s of one core to verify; a 30-minute one ~0.8 s. **Fine on Vercel (leaderboards); never on
  the relay** (0.75 core shared with her live show).
- Note: a player's own orders move *their* copy of the market (the log is part of the market). So "everyone plays the
  same market" means the same seed, start, prices and other traders; it diverges per player as each trades (like today's
  daily market). That's fair and expected.

---

## B. Race rooms on the relay (design)

### B.1 Shape

- **Same host, new path: `wss://live.agi1.app/room`.** No CSP change: `tests/trench-live.test.js:1484` asserts
  `connect-src` is exactly `'self' blob: https://api.dexscreener.com wss://live.agi1.app`, and a CSP host source with no
  path matches every path. No Caddy change (A.1). Its own `WebSocketServer` (noServer, `maxPayload 1024`,
  `perMessageDeflate:false`, `clientTracking:false`) and its own per-IP map, so a race never eats the Live feed's
  2,000 seats.
- **Simulated markets only** (a live market isn't the same for everyone; and Live runs already run on the real clock).
- **In memory only, no persistence, no wallet, no sign-in.** A relay restart (`relay.sh update`) ends every room: the
  client says "The race room closed: your run goes on" (each player's market runs locally anyway).
- **Invite link:** `https://agi1.app/games/trenchingsimulator#race=K7QX2M` (a fragment: never in a server log or a
  link preview; the page reads it, takes it out of the address like gift links do, and opens the lobby). Also "Copy
  link" and X's share box (the visitor posts).

### B.2 server.mjs change (sketch)

```js
// server.mjs, beside `wss` (:146)
const rwss = new WebSocketServer({ noServer: true, maxPayload: 1024, perMessageDeflate: false, clientTracking: false });
const rooms = createRooms({ log, now, random: crypto.randomInt, limits: cfg.rooms });   // lib/rooms.mjs
const roomIp = new Map();
// in server.on('upgrade') (:148), before `if (path !== '/ws')` (:163):
if (path === '/room') {
  if (!cfg.origins.includes(String(req.headers.origin || ''))) return no(403, 'Forbidden');
  if (rooms.players >= cfg.rooms.maxPlayers) return no(503, 'Busy');            // or accept-then-1013 like /ws
  const ip = ipOf(req);
  if ((roomIp.get(ip) || 0) >= cfg.rooms.perIp) return no(429, 'Too Many');
  roomIp.set(ip, (roomIp.get(ip) || 0) + 1);
  return rwss.handleUpgrade(req, socket, head, (ws) => {
    ws.once('close', () => release(roomIp, ip));
    rooms.attach(ws, ip);
  });
}
// /health (:113) gains: rooms: { rooms: n, players: n, racing: n }
// close() (:237) gains: rooms.close()   (sends {t:'end', why:'restart'} then closes)
```

`config.mjs`: `rooms: { max: 200, maxPlayers: 1600, perRoom: 8, perIp: 8, createPer10Min: 3, joinMissPerMin: 10 }`
(env `TRENCH_ROOMS_MAX`, `TRENCH_ROOM_PLAYERS`, … with the same `int()` clamps; `TRENCH_ROOMS=off` closes `/room`
with 404).

### B.3 Protocol (JSON, ≤ 1 KB each, `v:1`)

Browser → relay (`op`):

| op | Fields | Rules |
|---|---|---|
| `create` | `name?` (≤16), `set: { kind: 'free'|'challenge', challenge?, minutes?: 5|10|15|30, start?: 1|5|10|50, terminal? }` | ≤ `createPer10Min` per IP; relay picks the seed, the code, the host token |
| `join` | `code` (6 of `ABCDEFGHJKMNPQRSTUVWXYZ23456789`), `name?` | wrong codes count toward `joinMissPerMin` (then 1008); full room → `err room_full`; race started → `err started` (or spectate) |
| `resume` | `code`, `token` | within 60 s of a drop; restores the seat (and host) |
| `name` | `name` | lobby only; cleaned (B.5) |
| `ready` | `on: bool` | lobby only |
| `start` | (host only) | ≥ 2 players (or 1 for a test); sends `go` |
| `kick` | `id` (host, lobby only) | |
| `p` | `w` worth (SOL, number), `x` multiple, `c` run clock (s), `o?` outcome so far | ≤ 1 per second used (token bucket burst 5, 2/s like hub `take()`); only while racing; numbers clamped (`0 ≤ w < 1e7`, `0 ≤ c ≤ seconds+5`) |
| `done` | `w`, `x`, `c`, `outcome: 'win'|'time'|'busted'|'cashout'|'rugged'`, `timeUsed?` | once; locks the player's result |
| `leave` | — | frees the seat |

Relay → browser (`t`):

| t | Fields |
|---|---|
| `room` | `code, you: { id, token, host }, players: [{ id, name, ready, host }], set, state: 'lobby'|'countdown'|'racing'|'ended', max` |
| `go` | `seed: 'race-K7QX2M-1', solUsd, startSol, set, startAt (relay ms), now (relay ms), seconds` |
| `board` | `at, rows: [{ id, name, w, x, c, o, done, gone }]` sorted (B.4), sent every 2 s while racing (only when changed) |
| `end` | `rows` (final), `why: 'all_done'|'time'|'host_ended'|'restart'|'expired'` |
| `err` | `code: 'bad'|'no_room'|'room_full'|'started'|'too_many'|'not_host'|'rooms_full'` |
| `bye` | `why` (kicked, expired) |

- `solUsd`: the relay's own SOL price (dex.mjs `prices()` already has it; `hub` keeps `px`), else 150, so every player's
  dollars match. `seed`: `race-<code>-<n>` with `n` the room's race count (a rematch gets a new market).
- Clock sync: client sets `offset = msg.now - Date.now()` on `go` (+ RTT/2 from the WebSocket ping, optional) and starts
  its `createRun({ realTime: true, seed, solUsd, startSol, mode, challenge, … })` at `startAt - offset`, a 5 s countdown
  ("3, 2, 1, trench!"). Each run ends on its own clock; the relay ends the race at `startAt + seconds + 15 s` grace.

### B.4 Standings

- Free race: highest worth (`w`) at the end; ties by earlier `done`.
- Challenge race: `outcome:'win'` first, by `timeUsed` ascending; then everyone else by multiple `x`.
- A player who drops keeps their last report (`gone: true` greyed); `busted` sorts last.
- **Self-reported, for fun** (the page says so). Rooms never feed the leaderboards directly. If wanted, a player's end
  log can be sent to Vercel (`/api/wallet`, the leaderboard's own action) where `replay()` verifies it (~0.3 s per 10
  minutes, A.3); the relay never replays (CPU).

### B.5 Names, caps, expiry

- Name: optional, 1–16 chars, made safe like `cleanText()` (parse.mjs:50: no invisible / direction characters), single
  spaces; never one that poses as AGI-1, the team or a moderator; crude words masked (the relay needs its own small list
  in `lib/`, since the build context can't reach `server/coins.js`); blank → "Trader 3". Shown with `textContent` only.
- Caps (proposed): 8 players a room · 200 rooms · 1,600 room sockets · 8 room sockets per IP · 3 rooms created per IP per
  10 min · 10 wrong codes per IP per minute · 1 KB a message · ~2 messages/s (burst 5) · pings every 25 s, no pong →
  terminate (hub.mjs:225 pattern) · backpressure: drop a socket with > 256 KB waiting.
- Expiry: lobby not started in 15 min → `bye expired`; a room with no sockets for 60 s → deleted; a race → hard end at
  its length + 15 s (max 30 min + grace); an ended room's board kept 5 min for rematch / late reconnects, then deleted;
  resume tokens valid 60 s after a drop.
- Codes: `crypto.randomInt` over 31 symbols, 6 long (31⁶ ≈ 887 M); with ≤ 200 live rooms and 10 misses/min/IP, guessing
  is hopeless. Host token / resume tokens: 16 random bytes, base64url, never logged.

### B.6 CPU / memory budget (CX23, relay `--cpus 0.75 --memory 512m`)

- Worst case 200 rooms × 8 = 1,600 sockets × 1 report/s = 1,600 tiny `JSON.parse` a second + 100 board
  `JSON.stringify` a second (one per room every 2 s, shared by its players) ≈ a few % of one core. Memory: a room is a
  few KB → < 2 MB for all. TLS is Caddy's (uncapped: it shares the 2 cores with her live show): 1,600 idle-ish sockets
  are fine; outbound ≈ 1,600 × ~600 B / 2 s ≈ 0.5 MB/s at the very worst.
- No engine work on the relay. Racing never touches the Live feed's hub (separate server object, separate caps).

### B.7 Client module `src/games/trenchingsimulator/race.js` (mirrors `createLiveFeed`)

```js
export const RACE_URL = 'wss://live.agi1.app/room';           // raceUrl(loc): like relayUrl(), /ws → /room, ?relay= localhost only
export const CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
export const parseRaceLink = (hash) => …                       // '#race=K7QX2M' → 'K7QX2M' | null
export function parseRaceMessage(text) { … }                    // every field checked, like parseMessage()
export function createRace({ url = RACE_URL, WebSocket, timers, now = Date.now, storage }) {
  return {
    create({ name, set }), join(code, { name }), resume(), setName(name), ready(on), start(), kick(id),
    report({ worth, multiple, clock, outcome }),   // throttled to 1/s inside
    finish(result), leave(), on(fn),               // events: status, room, go, board, end, err, bye
    get status() /* idle|connecting|lobby|countdown|racing|ended|down|full */, get room(), get board(), get me(),
    get isHost(), get offset(),
  };
}
```
- `token` kept in `sessionStorage` (`agi_race`, try/catch) for `resume` after a reload; reconnect with the live feed's
  backoff (2 s … 30 s) while the race lasts.
- Shell: a "Race a friend" card on Pick a mode (only Simulated), lobby screen (code, Copy link, players, ready, host's
  settings, Start), the run's bar gets a compact standings strip (top 3 + you), results get the final board.
- Name: the optional player name (the leaderboard's, kept in localStorage `trench_v1`) pre-fills `join`/`create`.

### B.8 Tests to add (new `tests/trench-race.test.js`, plus edits)

- Relay (real `startRelay(port 0)` + `ws` clients, injectable `now`/timers): code format and uniqueness; create/join/
  leave; 8-seat cap; rooms-per-IP and total caps; wrong-code cap; origin 403; not-host `start` refused; `go` has the
  same seed/solUsd/startSol for all; `board` order for free and challenge races; `p` throttled and clamped; `done` once;
  resume within 60 s (host kept), not after; lobby/empty/ended expiry; restart → `end restart`; names cleaned; message
  > 1 KB closes; `/health` counts; nothing written to disk.
- Client: `parseRaceMessage` rejects junk; `createRace` with a fake WebSocket (like the live-feed tests); invite-link
  parse and the fragment taken out.
- Edits: `tests/trench-live.test.js:1498` "Live files" list gains `race.js` (and the new GMGN-style board file); the CSP
  test stays as is (proves no new host).

---

## C. GMGN's chains vs. Live mode

### C.1 GMGN's chain list

[PRIOR] 13 chain ids in GMGN's own client types (`gmgn-live.md` §2): `sol, eth, bsc, base, tron, monad, megaeth,
hyperevm, robinhood, arbitrum, arc, stable, xlayer`. GMGN's blog lists 10 (Solana, BSC, Base, Ethereum, X Layer,
HyperEVM, MegaETH, Monad, Robinhood, Tron), its FAQ 11 (+Arbitrum). DefiLlama (30 days to 2026-09-13): Robinhood 54.8%,
BSC 29.7% of GMGN's fees.

### C.2 Per chain

| GMGN chain | DexScreener chainId | Verified? | Native coin → how the relay prices it | Launchpads (GMGN's filters) | Live without a new key? | Relay today |
|---|---|---|---|---|---|---|
| sol | `solana` | [CODE] | SOL: `/tokens/v1/solana/<WSOL>` (parse.mjs:22) | Pump.fun, Bonk.fun, bags, believe, moonshot, … | yes; every launch via PumpPortal/PumpDev + Helius (**key already set**) | ✅ |
| robinhood | `robinhood` | [CODE] (relay live 2026-10-21) | ETH (base WETH price) | clank.trade, pools.trade, Pons, Long, Hookr | yes: clank.trade API + DexScreener | ✅ |
| bsc | `bsc` | [CODE] | BNB: `/tokens/v1/bsc/0xbb4c…c095c` | four.meme (+agent/xmode), flap, clanker, lunafun… | yes: DexScreener profiles (four.meme curve dexId already mapped, parse.mjs:29) | ✅ as `bnb` |
| base | `base` | [CODE] | ETH: `/tokens/v1/base/0x4200…0006` | clanker, zora, flaunch, bankr, virtuals, klik… | yes: DexScreener profiles | ✅ |
| eth | `ethereum` | [WEB] (`dexscreener.com/ethereum/0x3c91…`) | ETH: **reuse** the eth price (no new request) | trench, clanker, klik, livo, stroid, printr + Uniswap pools | yes: DexScreener profiles | ❌ |
| arbitrum | `arbitrum` | [U] (DexScreener's long-standing id) | ETH: reuse | (GMGN lists none; Uniswap/Camelot pools) | yes | ❌ |
| hyperevm | `hyperevm` | [WEB] (`dexscreener.com/hyperevm/0xaeba…`) | HYPE: `/tokens/v1/hyperevm/0x5555555555555555555555555555555555555555` (WHYPE, Hyperliquid docs [WEB]) | [U] (GMGN lists none) | yes | ❌ |
| monad | `monad` | [WEB] (`dexscreener.com/monad/0x16d5…`, `/monad/uniswap`) | MON: `/tokens/v1/monad/0x3bd359c1119da7da1d913d1c4d2b7c461115433a` (WMON, Monad docs [WEB]); MON ≈ $0.02 in snapshots → tiny unit price | nad.fun (bonding curve → graduates; its REST API `api.nadapp.net` mentions API-key management [WEB], so **not** used) | yes (DexScreener) | ❌ |
| megaeth | `megaeth` | [U] (chain is live: DefiLlama has a MegaETH chain page with DEX volume [WEB]; no DexScreener URL seen) | ETH: reuse | [U] | yes if the id exists | ❌ |
| xlayer | `xlayer` | [U] (no DexScreener URL seen) | OKB: `/tokens/v1/xlayer/0xe538905cf8410324e03a5a23c1c177a474d59b2b` (WOKB, Uniswap's X Layer deployments [WEB]) | [U] | yes if the id exists | ❌ |
| tron | `tron` | [WEB] (`dexscreener.com/tron/TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR` = WTRX/USDT) | TRX: `/tokens/v1/tron/TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR` (WTRX) | SunPump (curve → SunSwap V2 at ~$69,420 [WEB]) | yes via DexScreener, but **addresses are base58 `T…`, case-sensitive**: needs code (C.4) | ❌ |
| arc | ? | [U] probably not on DexScreener | stable gas [U] | dyorfun_v3, dyorswap, trench, onmifun, sharcfun, klik | skip | ❌ |
| stable | ? | [U] probably not on DexScreener | stable gas [U] | dyorfun_v3, dyorswap, trench | skip | ❌ |

**Coverage by the free `token-profiles/latest/v1` feed:** those are coins whose makers paid DexScreener for "Enhanced
Token Info" (not every launch), all chains mixed in one list (~30 newest per call). Couldn't tally live today (blocked).
Expect Solana to dominate, then BSC/Base; Ethereum, Monad, HyperEVM, Tron, X Layer, MegaETH will often be **quiet**
(fewer than `REAL_ENOUGH = 8` coins → made-up stand-ins fill in, as BNB/Base already do). `token-boosts/latest/v1`
(also keyless, also paid listings) is a second discovery source worth adding for quiet chains (+2 requests/min).

### C.3 Do new chains need API keys? (the owner's question)

- **No new key** for any of Ethereum, Arbitrum, HyperEVM, Monad, Tron, X Layer, MegaETH when added the way BNB Chain and
  Base already are (DexScreener's keyless profiles + `/tokens/v1` markets). The only key in the relay stays Helius.
- **A key (or fragile public RPCs) would only be needed** to see *every* launch live per launchpad (like Solana today):
  public HTTP RPCs exist keyless for most EVM chains but are rate-limited and rarely offer WebSockets; reliable WS needs a
  provider key (Alchemy/QuickNode/Ankr free tiers); Tron's TronGrid asks for a free API key beyond light use; nad.fun's
  API mentions keys. **Not recommended now.**
- **Request budget** (dex.mjs `perMinute = 240`; DexScreener: profiles/boosts ≈ 60/min, tokens/pairs ≈ 300/min [PRIOR],
  docs unreachable here): today ≈ 3 price + 2 profile + ~18 market (3 chains × 2 batches × 3/min) + Solana pools. Adding
  7 chains: +4 price (HYPE, MON, OKB, TRX; ETH-chains reuse) + up to 6/min per busy chain (≤ +42) ⇒ ≈ 70–80/min worst
  case. Comfortable. Profiles stay one call for all chains.

### C.4 Code changes to add chains (all files, by line)

1. `tools/trench-relay/lib/config.mjs:5` `CHAIN_IDS` += `ethereum, arbitrum, hyperevm, monad, megaeth, xlayer, tron`.
2. `lib/hub.mjs:16` `PREFIX` new letters (e.g. ethereum `e`, arbitrum `f`, hyperevm `h`, monad `m`, megaeth `g`, xlayer
   `x`, tron `t`); `:17` `ID = /^[srbaefhmgxt][0-9]{1,9}$/`; `:21` `QUIET_MS` 30–60 min each.
3. `lib/sources/dex.mjs:15` `EVM_CHAINS` → a `DEX_CHAINS` map incl. `tron:'tron'`; `prices()` :57 loops `WRAPPED`;
   `JUDGED` :18 maybe all non-curve chains.
4. `lib/parse.mjs:22` `WRAPPED` += `hype {hyperevm, 0x5555…5555}`, `mon {monad, 0x3bd3…433a}`, `okb {xlayer, 0xe538…9b2b}`,
   `trx {tron, TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR}`; `:27` `PRICE_RANGE` += `hype [1,1e4]`, `mon [1e-4,1e3]`,
   `okb [1,1e4]`, `trx [0.01,100]`; `:226-230` `parseProfiles` accepts Tron when `chainId==='tron'` with
   `TRON = /^T[1-9A-HJ-NP-Za-km-z]{33}$/` and **never lower-cases it**; the same in `encodeCoin`/markets batching.
5. `fakes.mjs` maps for the new ids.
6. Client `live-chains.js:17` `CHAINS` entries (+ `coin`), `:156` `ID` regex (same letters), `:158` address check per
   chain (EVM lower-cased; Tron as is), `:207` `parseCoin`, `:248-252` `px` keys += `hype, mon, okb, trx`;
   `liveCurrency()` :35 terminal ids renamed with the parody names (`gngm`, `pomp`, `axium`, `basedbott`, `fomoo`, or
   whatever ids are chosen) and a native coin for every chain; `format.js` units/symbols (HYPE, MON, OKB, TRX; MON
   needs more digits at ~$0.02); `challenges.js` `startSolFor`/`freeStartSol` already round to 2 significant figures.
7. Tests: `tests/trench-live.test.js` fixtures for each new chain (ids, prices, a Tron profile with mixed case kept).
8. Measure first (zero cost): add to `/health` a 24 h tally `profilesByChain` of every `chainId` the profiles call
   returns (dex.mjs:88), so the owner sees on his server which chains actually get listings before they're shown.

### C.5 Recommendation (zero new keys)

- **Add now:** `ethereum`, `monad`, `hyperevm` (ids verified, simple EVM path; ETH price reused for Ethereum), then
  `tron` (verified id; needs the base58 address path, ~1 extra day of care), and `arbitrum` (well-known id).
- **Add after the `/health` tally confirms the id and some listings:** `xlayer`, `megaeth`.
- **Skip:** `arc`, `stable` (not on DexScreener as far as seen; stablecoin gas makes "money in the chain's coin" odd).
- Order in the chain picker like GMGN's (by its fee share): Robinhood, BSC, Solana, Base, Ethereum, Monad, HyperEVM, Tron,
  Arbitrum, X Layer, MegaETH. Quiet chains keep the "Simulated coins fill in" line.

### C.6 Why "never Ethereum"?

CLAUDE.md states it twice — Live mode notes (`CLAUDE.md:9662-9663`: "**Base**; never Ethereum") and the decisions log
(`CLAUDE.md:12784`: "four chains (… BNB Chain, Base; never Ethereum)") — **but records no reason.** Inferred (not
documented): mainnet gas makes meme launches rare and mostly paid DexScreener listings of bigger projects (few, slow
"new coins"), there's no keyless every-launch feed, and Robinhood Chain/Base already give an ETH-priced chain. If the
owner now wants Ethereum (GMGN has it), both lines should be changed in the same push.

---

## D. Sources

- Repo files above (read only). Benchmark script: `research/bench/bench.mjs` (scratchpad).
- [dexscreener.com/hyperevm/0xaebaa46eef7d1fdce94610c5ed2d2e14085d6752](https://dexscreener.com/hyperevm/0xaebaa46eef7d1fdce94610c5ed2d2e14085d6752)
- [dexscreener.com/monad/0x16d564690d32802a0562b4a8a2378350525b365f](https://dexscreener.com/monad/0x16d564690d32802a0562b4a8a2378350525b365f) · [dexscreener.com/monad/uniswap](https://dexscreener.com/monad/uniswap)
- [dexscreener.com/tron/TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR](https://dexscreener.com/tron/TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR)
- [dexscreener.com/ethereum/0x3c91b6ea42c9cdff007ef65629c1d7f68e6b74a0](https://dexscreener.com/ethereum/0x3c91b6ea42c9cdff007ef65629c1d7f68e6b74a0)
- [Monad network information (WMON)](https://docs.monad.xyz/getting-started/network-information)
- [Hyperliquid docs: Wrapped HYPE](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm/wrapped-hype)
- [Uniswap v3 X Layer deployments (WOKB)](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-xlayer-deployments)
- [DefiLlama MegaETH](https://defillama.com/chain/MegaETH) · [GetBlock: SunPump](https://getblock.io/blog/what-is-sunpump-on-tron/) · [Bitquery: Tron SunPump](https://docs.bitquery.io/docs/examples/Tron/tron-sunpump/)
- [Alchemy dapps: nad.fun](https://www.alchemy.com/dapps/nad-fun) · [clawhub.ai nadfun skill (API, keys)](https://clawhub.ai/portdeveloper/nadfun)
- Sibling notes: `research/gmgn-web.md` §2.3, §15; `research/gmgn-live.md` §2.
