# Leaderboards for AGI games: research and design (2026-10-22)

Research only: nothing in the repo was changed. Measurements were made on copies in
`/tmp/claude-0/-home-user-agi-ecosystem/3a68cf55-88eb-5b1b-9a13-4a2b793da4f7/scratchpad/replay/`
(scripts `bench.mjs`, `bench2.mjs`, `stress.mjs`, `batch*.sh`, `ride/calib.mjs`; a patched copy of `run.js` in `ts/`).

## 1. Recommendation in one paragraph

Put leaderboards inside `/api/wallet` (no 13th function), with the arcade's conventions (HMAC codes, a daily visitor
code, burst limits, `supabase/arcade.sql`'s style). **TRENCHING SIMULATOR: verify by exact replay.** A ranked run starts
with a server ticket (server-chosen seed and SOL price); the client sends its order log at the end; the server replays the
whole run with the game's own `run.js` + `engine.js` and ranks the server's result, never the client's claim. Replay of a
30-minute run with 225 orders takes 1.4 s and +39 MB heap here (engine alone 0.7 s): far under Vercel's 25 s. It needs one
small change to `run.js` (checks once per engine step, §3.3) so that the client and the server end a run on the same step;
with it, 48 of 48 runs were identical even with frame hitches. **Ride 'Em, AGI!: no replay** (variable-dt physics in a
DOM bundle); a ticket, a submitted result and sanity checks calibrated on the game's own QA bot (§4). Boards are bragging
rights only (no prizes): neither game can be made cheat-proof client-side (§7), and the owner can hide any row.

## 2. What exists today (conventions to follow)

- `server/arcade.js`: `code(secret, text)` = HMAC-SHA256 base64url sliced to 32; `playerCode(secret, game, id)` (per
  game, never the id); `reviewerCode()`; `countPlays()` → `arcade_play`; `reviewName()` (the live show's name rules:
  1–24 chars, no links, `0x…`, contacts, crude words, posing as her/team/mod); `ARCADE` limits; AI loaded lazily only for
  reviews.
- `api/wallet.js`: `MAX_BODY = 6000` checked **before** `JSON.parse` (line 217); `GAME_ASK` regex for `GET ?game=`;
  `SHARED` cache headers (CDN 60 s); POST switch: `game-play`, `game-mine`, `game-review`, `game-review-delete`; `who()` =
  `visitorCodeForDay(PASS_SECRET, ip, UTC day)`.
- `server/burst.js`: `arcadePlayBurst` (30/min), `reviewBurst` (20/min), per server copy.
- `supabase/arcade.sql`: 5 tables, 8 functions; each function validates then returns `{ok:false, why:'bad'}`, counts
  the site row before the visitor's, deletes days older than yesterday, `grant execute … to service_role`,
  `notify pgrst, 'reload schema'`, ends with `arcade_functions_found = 8`. `tests/arcade.test.js` forbids any game name
  and any `drop` in it (a game's row comes with its first play).
- `src/games/list.js` (`GAMES`, `PLAYER`, `PLAYER_KEY` = `agi_player`, a random 32-hex id in localStorage),
  `page.js` (one box per game, `mountGame(panel, session)`, tabs), `words.js` (pure sums + words).

## 3. TRENCHING SIMULATOR

### 3.1 Determinism (read from the code)
- `engine.js`: sfc32 streams seeded by `seedOf(seed, label…)`; 10 steps a second (`STEPS_PER_S`), warm-up 6000 steps;
  no `Date`, no `Math.random`. Reads never draw. `order()` draws latency and the MEV roll from the player stream `pr`
  **only after every refusal check** (lines 554–588), so a refused order changes nothing; a placed one is logged as
  `{ n, coin, side, sol, frac, slippage, priority }` (line 606).
- `replay({ seed, solUsd, startSol, config, log, until })` already exists (engine only: no goal, clock or outcome).
- `challenges.js`: 9 challenges; daily pool of 7; `dailySeed(key)` = `daily-${UTC date}` (public, same for everyone).
  `solUsd` only changes `five-hundred`'s start (`1000/px` SOL) and what's shown.
- `shell.js`: today a challenge's seed is `${id}-${Date.now() base36}-${Math.random()…}`, free play `free-…`, the price
  from DexScreener (5-minute cache, $150 fallback), engine `config` always `{}` (slippage and priority go with each order).
- `run.js` `tick(dt)`: clamps dt (0.25 s × speed), `market.advanceTo(clock)`, then `checkOrders/Feed/Worth/Goal`,
  `checkTime`, `checkBust`, `checkIdle` **once per frame**.

### 3.2 Replay measured (Node 22, this container)
| Run | Orders | Server replay (createRun + per-step ticks) | Engine-only replay | Heap | RSS |
|---|---|---|---|---|---|
| ten-bagger, 30 min, bot | 225 | 1.4 s | 0.7 s | +39 MB | ~187 MB |
| stress, 30 min | 3000 | — | 0.8 s | — | — |
| 8 challenges × 6 seeds | 1–121 each | 0.15–0.8 s each | — | — | — |

Even 5× slower on Vercel it's under 8 s. Load the engine lazily (dynamic import) only for this action.

### 3.3 The one divergence, and its fix
With normal 60 fps frames (each frame < one 0.1 s step) client and server agreed 48/48. With hitchy frames (a frame
spanning several steps) **7 of 48** runs ended at a different time (4 with a different final worth): the client checks
the goal/time/bust once per frame, the server once per step. Fix in `run.js`: when not live, step the market one step at a
time and run the checks after each step (prototype, tested 48/48 identical with normal and hitchy frames, and
`run`-related tests pass):

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
(and `import { STEPS_PER_S } from './engine.js'`). A run then ends on a step boundary (≤0.1 s different from today).

### 3.4 Recording and submission
- The engine already keeps the log (`market.log()`); the client also records its end: `end` = the step it ended on and
  how (`won`/`time`/`bust`/`rug`/`ended`).
- Packed log: one string per order `n36,coin36,side,amount,slip,prio` (~24 bytes; JSON numbers round-trip exactly):
  225 orders ≈ 5.4 KB packed (21 KB as plain JSON objects). Cap: 1000 orders, 40 KB body for `game-score` only.
- Body cap: read the text, allow ≤ 48 KB only when it parses to `action: 'game-score'`; keep 6000 for every other action
  (check `raw.length` against 6000 unless `raw` starts with the score action's marker, then parse; or read the action
  from a header `X-Agi-Action`, checked first).

### 3.5 Protocol (all in `/api/wallet`)
1. `POST {action:'game-ticket', game:'trenchingsimulator', player, kind:'challenge'|'daily', challenge}` → server picks the
   seed (challenge: 128 random bits; daily: `dailySeed(today UTC)`), the SOL price (its own cached DexScreener read, else
   150), and returns `{ ticket, seed, solUsd, startSol }`. Ticket = base64url(JSON `{v,g,k,c,d,s,px,t,j}`) + HMAC
   (PASS_SECRET), `j` a random id, `t` issued-at. Counted: 60 tickets/day per visitor code, 50,000/day site.
2. The client plays with exactly that seed and price (speed 1; ranked only for challenges and the daily market: never
   free play, Live mode or 2×/4×).
3. `POST {action:'game-score', game, player, ticket, name?, claim:{outcome, end, timeUsed, worth}, log:[…]}`:
   checks in order: ticket's HMAC, game, age ≤ duration + 15 min; `now − t ≥ timeUsed − 5 s` (it took real time); the
   claim would place (better than the player's best or the board's 100th: `arcade_board_cut`) — else record nothing and
   answer `{ranked:false}` without replaying (saves CPU); replay with `createRun` (step-exact) placing each order at its
   `n`; any order the replay refuses, an out-of-order `n`, or a claim ≠ replay → `422 replay`; then `arcade_score_put`
   (marks `j` used once). Only wins rank on challenge boards (rug-dodger: survived).
4. Burst: `scoreBurst` 12/min per server copy; 30 submits/day per visitor code; 2,000 replays/day for the site
   (Hobby's 4 h CPU/month ≈ 7,000 replays at 2 s: the "would place" shortcut keeps it far lower).

### 3.6 Boards and ranking
- Daily market: `daily:<UTC date>`; wins first by `timeUsed` asc, then the rest by final multiple desc.
- Each challenge: `c:<id>:all` and `c:<id>:w<Monday UTC>`; wins by `timeUsed` asc, ties by multiple desc;
  rug-dodger by multiple desc.
- One row per player per board (best kept).

## 4. Ride 'Em, AGI!

### 4.1 The run
- `App.begin()` → `Missions.runStart(); Site.play();` (our patch). End: `App.finishRun(r)` (game.js line 3436), called
  again after each revive (≤2, `reviveCost` [100, 250] treats). `r`: `mode` (`endless`/`daily`/`level`), `score`,
  `dist` (m), `treats`, `stomps`, `bestMult`, `daily` (date/mod), `win`, `hits`.
- Speed: `PX_PER_M` 40; endless `v = 650 + min(500, m·0.105)` px/s → 16.25 + 0.002625·m m/s, capped 28.75 m/s at
  4,762 m (≈217 s); turbo ×1.12; zoomies ramp (generous ceiling ≈ 51.5 m/s). Score = distance + bonuses (multiplier up
  to ×5, catnip ×2); upgrades from the player's own save. Endless seed from `Math.random`; daily from the **local** date
  (`todayKey()`, `dailyInfo(date)` hashes `'ride-em-agi:'+date` → seed, world, mod).
- Calibration with the game's own QA bot, headless (`ride/calib.mjs`, no upgrades):

| Mode | Seconds | Metres | Score | Score/m | m/s |
|---|---|---|---|---|---|
| endless ×3 | 180 | 3801–3864 | 80,551–83,914 | 21.2–21.9 | 21.1–21.5 |
| endless (earlier) | 266 | 6,151 | 119,189 | 19.4 | 23.1 |
| daily springs | 120 | 2,292 | 61,512 | 26.8 | 19.1 |
| daily lowgrav | 120 | 2,292 | 43,342 | 18.9 | 19.1 |
| daily powers ×2 | 120 | 2,346–2,454 | 50,786–56,804 | 21.7–23.2 | 19.6–20.5 |

### 4.2 Hook (the import tool's way)
- New `PATCHES` entry in `tools/games/import-rideemagi.mjs` on the file holding `finishRun` (the same `50_main.js` as the
  `Site.play` patch: confirm when the tool next runs), text `    const out = Prog.apply(r);\n` → itself +
  `    Site.result(r, st);\n`, times 1; `Site.play()` also asks for a ticket. The tool needs the owner's source folder (not
  in the repo), so the same lines are applied to `game.js` by hand once, and a **new test** checks every `PATCHES` entry's
  new text appears in `game.js` (none does today).
- `site.js`: `Site.result()` posts `{action:'game-score', game:'rideemagi', player, ticket, name?, run:{mode, dist,
  score, stomps, bestMult, revives, ms, daily:{date, mod}}}`; the same ticket may be used up to 3 times (two revives),
  each time with `dist` ≥ the last.

### 4.3 Sanity checks (server)
- Ticket age ≤ 2 h; `now − t ≥ dist / 52 − 10 s` and `ms ≥ 1000·dist/52`; `dist ≤ 60 000`; `revives ≤ 2`;
  `score ≤ 40·dist + 5000` (bot's max 26.8/m; upgrades and multipliers: generous, recalibrate after launch from real
  rows); `score ≥ dist` ; `bestMult ≤ 5`.
- Daily: `date` within ±1 day of the server's UTC date, and `mod` = `dailyInfo(date).mod.key` (port `hashStr`/`dailyInfo`
  into a shared pure module, tested against game.js's own).
- Boards: endless `e:all`, `e:w<Monday>`, `e:d<UTC date>`; daily mod `m:<date>`; by `dist` desc, then `score` desc.
  Levels never rank.

## 5. SQL (added to `supabase/arcade.sql`, generic: no game names, no drop)
- `agi1_arcade_scores(id bigserial pk, game text, board text check (board ~ '^[a-z0-9:_-]{1,40}$'), player text,
  name text check (char_length(name) <= 24), k1 numeric, k2 numeric, detail jsonb (≤ 1 KB), created timestamptz,
  hidden boolean default false, unique (game, board, player))` — lower `k1, k2` is better (wins: `timeUsed`; others:
  `100000 − multiple`; Ride 'Em: `−dist`, `−score`); index `(game, board, hidden, k1, k2)`.
- `agi1_arcade_tickets_used(j text pk, game text, uses int, last numeric, at timestamptz)`: kept 2 days.
- `agi1_arcade_score_days(day, who, tickets, scores, replays)` with a site row (`who = '*'`), like `agi1_arcade_days`.
- Functions (8 → 13): `arcade_ticket_take(game, who, day, cap, site_cap)`; `arcade_board_cut(game, boards text[],
  player)` (the 100th and the player's best, per board); `arcade_score_put(game, j, max_uses, last, player, name,
  boards text[], k1, k2, detail, who, day, caps)` (uses the ticket, upserts each board if better, returns ranks);
  `arcade_board(game, board, lim)` (top N shown rows: name, k1, k2, detail, created; never `player`);
  `arcade_score_mine(game, player, boards)` (its rows and ranks); owner: `arcade_score_hide(id, hidden)`. Weekly and
  daily rows older than 35 days deleted. RLS on, service_role only, `arcade_functions_found = 13`.

## 6. Names
- Optional, chosen before playing (one field, kept as `agi_player_name` in localStorage, shared by both games, editable
  on agi1.app/games); sent with each score; checked by `reviewName()` (24 chars, no links/addresses/contacts/crude/posing,
  never a ticker); refused → saved as "A player" and the result says why. No AI look (cost, and it's short); the owner
  hides a row. Shown with `textContent`. Never the player id or its code.

## 7. Anti-abuse and its limits (say so on the page)
- Per visitor: 60 tickets/day, 30 submits/day, burst 12/min; site caps; tickets used once (Ride 'Em: ≤3, rising).
- TRENCHING SIMULATOR: the replay proves the run is *possible* with that seed; it can't prove a human played it. The
  engine is public and fast (30 minutes simulated in < 1 s), so a bot can pause and look ahead. The wall-clock check
  makes it take real time; the server-random seed stops precomputing before the ticket. Daily market seeds are public by
  design.
- Ride 'Em: numbers are the client's, inside generous bounds; a script can post a plausible fake.
- So: "bragging rights only, no prizes"; `arcade_score_hide`; never pay prizes from these boards without a stronger
  design (server-side play).

## 8. What the page shows
- agi1.app/games, each game's tab: a "Leaderboard" panel: board picker (TS: Today's daily market · each challenge This
  week / All time; Ride 'Em: Today · This week · All time · Today's daily mod), top 20 (rank, name or "A player", metric:
  TS "2:41 · ×10.2", Ride 'Em "6,151 m · 119,189"), "Your best: #37" (POST `game-score-mine`), fine print ("bragging
  rights, no prizes; checked but not cheat-proof; names are shown publicly"). `GET /api/wallet?board=<game>:<board>`
  shared by the CDN 60 s (exact-match regex like `GAME_ASK`).
- In game: the results screen says "Ranked #12 · 10x in 30 · this week" or why not ("free play isn't ranked", "2× speed
  isn't ranked", "Live coins aren't ranked").

## 9. Tests to add
- `trench-game.test.js`: step-exact ticks (a run with hitchy frames ends on the same step and outcome as one-step ticks);
  replay of a recorded run equals the client's result; packed log round-trip; a tampered order / out-of-order `n` /
  wrong claim is refused.
- `arcade.test.js`: ticket HMAC, age, used once; would-place shortcut; caps; board order for each kind; names; GET
  board's address rules and caching; SQL promises (13 functions, no game names, no drop).
- A test that every `PATCHES` new text appears in `game.js`; Ride 'Em sanity bounds; `dailyInfo` port equals game.js's.
