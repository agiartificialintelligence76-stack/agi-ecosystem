# HANDOFF: AGI games, TRENCHING SIMULATOR and VLAD RUNNER 2049 (2026-10-23)

## AGI-1 on Discord, round 4: /post's channel list and 👤 Stranger — 2026-10-29

Two asks of the owner's (a chat cut off before anything was pushed; picked up in a new session from its last screen, then
"continue, finish and publish"):

- **/post's channel list missed channels** (🔞┃agi1-nsfw among them): Discord's own picker for a channel option lists only
  10 channels (the oldest) until a name is typed. /post's channel is now **her own list** (autocomplete, `postChoices()` in
  `server/dc-tickets.js`): all 19 text and announcement channels in the sidebar's order, "name · category", with "AGI-1
  can't post here yet" where she can't and "not age-restricted yet" / "age-restricted" for an 18+ one; typing narrows it; a
  name typed without tapping it still works. Only for the owner.
- **👤 Stranger** for everyone who hasn't verified and every new member, by itself: a **Vercel cron every 5 minutes**
  (`/api/feed`, told apart by its schedule, `ROLES_SCHEDULE`; needs Vercel Pro) reads the member list and gives it to every
  member without 💘 Crush or 💞 Soulmate (Team and Mod too; never a bot or someone on the rules screen), and takes it off a
  holder; verifying, Remove my role and going under 10,000 swap it at once (`strangersClock()`, `syncRoles()` in
  `server/dc-holders.js`). Nothing kept. `DISCORD_STRANGERS=off` pauses it.
- **Done in Discord:** the 👤 Stranger role (grey, shown apart, no permissions, under 💘 Crush), and her app's **Server
  Members Intent** (Developer Portal → AGI-1 → Bot → Privileged Gateway Intents, the owner's OK), so her bot can read the
  member list.
- **/post's bigger images** (the owner, after "that image is over 10 MB": "can you increase the max size of this"):
  Discord itself takes 10 MB a file in a server without boosts (her bot too; 50 MB at Level 2, 100 MB at Level 3). /post
  now takes up to **50 MB**, and a still image over the server's limit is made smaller first (`shrinkToFit()` with sharp: a
  JPEG, or a WebP with see-through parts, at its full size when that's enough); she says she did. A GIF over it is said at
  once. Boosting to Level 2 is the only way to post a file over 10 MB as it is (the owner's call).
- **Tests:** 11 more (`tests/discord.test.js`, `tests/holders.test.js`).
- Details, troubleshooting: CLAUDE.md, "AGI-1 on Discord" → "Round 4".

## AGI-1 on Discord, round 3: holder roles — 2026-10-29

The owner's OK to the plan ("Yes, do all of it (Recommended)"): holder roles live, its database file run, and the Discord
side done. **The first build was lost** with its session's workspace before it was pushed (it waited for the database
step); a new session built it again the same day and saved each step to the branch `claude/discord-holder-roles`.

- **What it is:** 💘 Crush (10,000+ $AGI) and 💞 Soulmate (1,000,000+), held or burned for messages (the site's levels),
  both opening the private 💎┃holders channel. Her **Verify my $AGI** button in ✅┃verify (the owner's `/holders`) gives a
  private 15-minute link to **agi1.app/discord/verify** (`verify.html`, `src/discord/`): the site's wallet sign-in (a free
  signature), then `/api/wallet` `dc-verify` reads the wallet's $AGI and gives the role. One wallet, one account; the cron
  (`api/feed.js`) reads 25 again a run; **Remove my role** forgets it. `server/dc-holders.js`, `supabase/discord.sql`
  (scrambled codes, the ids and address sealed with PASS_SECRET). `DISCORD_HOLDERS=off` pauses it.
- **Done in Discord** (by the first session, checked again): the two roles (shown apart, under AGI-1's role, which has
  Manage Roles), ✅┃verify and 💎┃holders with their topics.
- **Tests:** `tests/holders.test.js` (18); the suite: 1,365 tests, 1,361 pass, 4 skipped. `supabase/discord.sql` also ran
  twice in a real Postgres (PGlite).
- **Database:** `supabase/discord.sql` run in Supabase (agi2) on 2026-10-29 (`discord_functions_found = 5`; checked: only
  our server may use its functions and table, RLS on), after the owner's OK again in the new chat ("Yes, do all of it").
- **Then (all done the same day):** pushed to `main` (`0af7c6d`); the cron run once by hand (it set `/holders`, and posted her
  diary entry in `#📔┃agi1-diary`: the webhook's first live post); `/holders` in ✅┃verify posted her button (both roles
  found); a line about it added to the welcome message. A tap gave the owner their private link, and the page took it.
- **Left for the owner:** verify with a real wallet once (tap Verify my $AGI, open the link in a browser with the wallet,
  sign), to see the role arrive. Details: CLAUDE.md, "AGI-1 on Discord" → "Round 3".

## AGI-1 on Discord, round 2 — 2026-10-29

The owner, after the server's setup: emojis in the channels' names, a banner, Prince Loki a Mod, "can you add nsfw channel to
the discord but its still private" ("nsfw agi-1 specifically"), a support ticket channel ("like a real one … support ticket no.
1") and "i send an image to agi-1 and she send it herself to channel i said". Done in Discord (Claude in the owner's Chrome) and
in code (`server/dc-tickets.js`, pushed to `main`):

- **Her tickets:** the owner's `/tickets` posts her **Open a ticket** button (in `🎫┃support`); a tap opens a private
  **🎫┃ticket-0001** for that person and the team in **🎫 Tickets**, with her first message and **Close ticket** (deletes it).
- **`/post`** (the owner only): an image she posts herself as AGI-1, in the channel picked; an 18+ channel only once Discord
  marks it age-restricted. Her bot connects to Discord's gateway once (Discord asks it before a bot may post).
- **🔞┃agi1-nsfw:** private (the new **🔞 18+** role, Team, Mod, AGI-1), rule 2 allows it, AutoMod's flagged words skip it.
  **Not age-restricted yet:** the owner first confirms their age in Discord (User Settings → Account Status → Confirm Age),
  then Edit Channel → Overview → Age-Restricted Channel. Nothing sexually explicit there until then.
- **Waiting for the owner:** that age confirmation; deleting the first welcome message in `#👋┃welcome` (above the banner); who
  gets the 🔞 18+ role. Details, setup and troubleshooting: CLAUDE.md, "AGI-1 on Discord" → "Round 2".

## AGI-1 on Discord — 2026-10-28

The owner: "can you fix my agi discord server? and organize it? and also can you add agi1 bot to my discord server like in the telegram bot?". The server's own organizing happened in Discord, in the owner's browser. In code: her Telegram group mode on Discord, through Discord's HTTP interactions (no gateway, no new server, SQL or function):

- **What she does:** `/ask` (the same AI and daily limits as her Telegram groups), `/ca`, `/mc`, `/website`, `/music` (a tap uploads the song) and `/help`, only in the servers in `DISCORD_GUILDS`; her diary, $AGI's market moments and her "i'm live on X" line in the channel of `DISCORD_FEED_WEBHOOK`. Never a DM, a name or a ping.
- **Where:** `server/discord.js`, `server/dc-lines.js`; agi1.app/discord/interactions → `api/telegram.js?discord` (`vercel.json`); the cron (`api/feed.js`) connects her app (`connectDiscord()`) and posts (`postToDiscord()`); `api/live.js` posts her live line (`postDiscordLive()`). Her prompt: `discordPrompt()` in `server/agi1-prompt.js`. The footer's safety note has three Discord sentences.
- **Her app:** "AGI-1", application id `1565016537683984464`, public key `048ca45efef0d02b41a963c2a3905ed8925c3babff0e7f99bafcca5b78be0554`, made in the Developer Portal on the owner's account.
- **Done on 2026-10-29** (Claude in the owner's Chrome, the owner's OK): her app (icon, banner, private, guild install only), her bot added to the server, the four settings in Vercel (`DISCORD_PUBLIC_KEY`, `DISCORD_GUILDS`, and the secrets `DISCORD_BOT_TOKEN` and `DISCORD_FEED_WEBHOOK`, pasted from Discord's Copy buttons), and the server organized (categories, channels with topics, Team/Mod roles, read-only Start Here and #agi1-diary, Community, verification Medium, AutoMod: spam, flagged words, scam phrases and invite links, impersonating names). **agi1.app redirects (308) to www.agi1.app**, so her endpoint is `https://www.agi1.app/discord/interactions`. Steps, the layout and troubleshooting: CLAUDE.md, "AGI-1 on Discord".
- **Tests:** `tests/discord.test.js` (19), plus one each in `tests/telegram.test.js` and `tests/live.test.js`; the whole suite passes, also with real-looking values for every setting, the Discord ones included. **Tried live 2026-10-29** in `#team-chat`: the cron set her endpoint and commands, and `/help`, `/ask`, `/mc` and `/music` (a tap uploaded AGI., 4.32 MB) all answered. Not tried live yet: her posts through the webhook (her next diary entry or market moment) and her biggest songs' uploads. `#official-links` has no Roadmap link (the owner: "dont include the roadmap"). "Require 2FA for moderator actions" waits for 2FA on the owner's own Discord account.
- **Later on 2026-10-29** (the owner: "can you add emojis to each channel"): an emoji and ┃ at the start of every channel's
  name (only the names changed), the server's banner (`Claude outputs/agi-discord-banner.png`) at the top of `#welcome`
  with the welcome text again under it (0 boosts: Discord's banner slot needs Level 2; the earlier welcome copy is the
  owner's to delete), and Prince Loki is a Mod. See CLAUDE.md, "The server's layout".

## ClankChecker: the list survives clank.trade's slow answers — 2026-10-28

The owner: "the clankchecker is not working", with a screenshot of "Couldn't reach clank.trade right now. Try again" under the search box. It loaded fine a minute later (466 coins, 7 graduated), so it was intermittent:

- **Why.** clank.trade's `coins.list` gives 12 coins a page and takes nothing but `cursor`, `direction: "forward"` and `query` (a page size or a sort is refused: "unrecognized_keys"), so the whole list is 39 requests one after another. Timed from the owner's browser, twice: most pages took 0.35–0.55 s, but 3 to 6 of the 39 took 1.9–12.2 s, and the same page asked again took about 0.4 s (so it's clank.trade's side, at random, not a bad page). `scanClank` gave each page 8 s and threw the whole list away on the first one that failed (→ 503 → the page's error), and a page started just before the 18 s budget could run past Vercel's 25 s (→ a 504 that isn't JSON → the same error). A fresh read through agi1.app took 15.4 s that day (7.5 s later on); nothing was cached after an error, so the next visitor waited and gambled again.
- **What changed.** `clankApi` (`server/coins.js`) takes `hedgeMs`: a request still unanswered after that long is asked a second time and the first answer wins (the other is stopped), and a first try that fails is asked again at once; two tries at most, both over by `timeoutMs` (`hedged()`). `scanClank` uses it with 1.5 s (`HEDGE_MS`) for every page and its first request, keeps every page's time inside 21 s from the start (`limitMs`), and a page that still can't be read ends the list there: the coins read so far plus the trending coins it didn't reach, `complete: false`, and `cutShort: true` when that was before the 20 s budget's end (a page that only ran out of the last seconds is the budget's usual stop) (log: `[checker] clank.trade's coin list stopped after N pages (M coins): …`). `latestClank` (`?latest`) is hedged too. `api/checker.js`: the list's `Cache-Control` gains `stale-if-error=86400` (Vercel's CDN keeps serving the last list for up to a day when a new read fails; supported since February 2026, https://vercel.com/docs/headers/cache-control-headers#stale-if-error), and a cut-short list is kept `max-age=30, s-maxage=60, stale-while-revalidate=240` (each server copy reads again after 30 s, not 2 minutes). `src/sections/checker.js`: when the list doesn't load, it says "Couldn't reach clank.trade right now · retrying" with Try again, and asks again by itself after 20 s, 40 s, then every minute (10 times in a row at most; a hidden tab waits until it's shown; Try again starts it over).
- **Budget.** Paging may now go on until 20 s (18 s before): no page can run past 21 s any more, so the old 8 s of headroom isn't needed. With the hedging, timed from the owner's browser in Taiwan (the same code run in a clank.trade tab): 35 pages (420 coins) in 18.3 s, three requests asked twice (each answered within 1.9 s instead of 2–12 s); a second run, 34 pages (408 coins), slow answers in a cluster near the end, and the 35th page, started at 18.2 s, answered by neither try before 21 s. Vercel's own reads are faster: a fresh read through agi1.app (`Pragma: no-cache`, `x-vercel-cache: MISS`) took 7.5 s that evening for all 39 pages (15.4 s earlier), so 20 s fit about 50 to 100 pages for now. If clank.trade grows by several hundred coins (or gets slower), the oldest will be left out (the trending ones stay; a pasted contract still works); the fix then is a longer `maxDuration` for `api/checker.js` in `vercel.json` (25 s today) with a bigger budget: the owner's call (Vercel usage).
- **Not changed.** The scans (`?a=`), pictures, the buy bot and AGI-1's feed call `clankApi` without `hedgeMs`, exactly as before. 80 pages at most.
- **Tests.** `tests/checker.test.js`: 6 new (a slow page asked again after 1.5 s and the slow try stopped; a failed page asked again at once; a page that fails twice ends the list with what was read, shared a minute; nothing runs past the time limit; `?latest` hedged; `hedged()` itself), and the list's header and the down case (asked twice) updated: **48 passed** on Node 20, 22 and 24. Full suite, in a clean cloud clone (`npm ci`): **1,318 tests: 1,314 passed, 0 failed, 4 skipped** on Node 20, 22 and 24, and `npm run build` passes. The page's retry was watched in Chromium against Vite's dev server with `/api/checker` faked to fail twice: "Couldn't reach clank.trade right now · retrying" with Try again, then the list by itself 40 s later. The fake clank.trade can now stall a request until it's stopped (`fake.stall`, keeping Node alive like a real connection) or fail it (`fake.fail`), by request number.
- **After publishing, check:** `https://agi1.app/api/checker` answers 200 with every coin (`complete: true`) and `x-vercel-cache` HIT after the first visit; Vercel → Logs for `[checker] clank.trade's coin list stopped after` (now and then is fine; every time means clank.trade got slower or much bigger).

## AGI-1 3D model: taller, on the floor, print and hair clean-up — 2026-10-28 (published the same day, at the owner's go-ahead)

The owner, about the 3D model: "did you fixed her hair? looks awful … the design of her looks scuffed", then "she looks so short there dont you think". Checked in the real engine (Viggle Splat Engine 0.3.2 / PlayCanvas, WebGL), front, sides, back and during the hello and nod:

- **She stood about 10 cm into the floor.** The engine lowers every VIGGCHAR character by its baked ground shift (`Character.bakedGroundShiftY`, 0.1119 m here: a deliberate "legacy convention" shim in the engine), so her soles were below the stage's floor and her head about 10 cm lower than the 2D model's. `standOnFloor()` in `src/stage/agi1-splat.js` puts her soles on the floor.
- **Taller proportions.** `AGI1_PROPORTIONS` (legs 1.12, neck 1.08, arms 1.03; head and torso unchanged) through the engine's own `armature.setBoneStretch(buildStretch(...))`: bone segments lengthen and their Gaussians stretch along the bone, so the hello, nod, idle and face keep working. `applyAgi1Proportions()` returns how far to lift her (the longer legs) and how much her head rises; her overall height stays `AGI1_SPLAT_HEIGHT` (1.62 m, like 2D), so legs are longer and head and torso a smaller share. The stretch makes the engine keep pose scale (its `USE_NONRIGID_COV` path), so the blink no longer scales the iris (it only recedes, as before).
- **The AGI print floated beside her chest** from 40-90° (also in the spin and when the stage is dragged): `tools/model/fix-shirt-logo.mjs` fitted one quadratic and pushed it in front of every sample. It now samples the cloth's rendered front on a 1.5 mm grid (where the front view reaches 15% opacity), smooths it, keeps clearance only for local bumps and less where the shirt slopes away. Median gap to the cloth went from 20 mm to about 1 mm; from the front the letters look the same.
- **A dark streak flashed over her hair** from her left side: the renderer misdraws whatever splat is stored first (slot 0) from some camera directions. New `tools/model/polish-splat.mjs` moves that splat to the end and leaves an invisible placeholder in slot 0; it also drops 565 splats with no visible opacity, lifts 422 muddy dark patches in her hair toward the surrounding hair colour (not the thin dark lines between locks), and makes 2,158 hair splats that hang far from her arms follow her upper body instead of the arms (no dragging in the wave; hair on or beside the arms still follows them, otherwise it sticks out like wings when her arms are down).
- **The print in motion (later the same day).** Checked through the nod and the wave, the print still came off the shirt: it had smooth spine-only skin weights (`spine_04`/`spine_05`), but the shirt under it also follows her collarbones and upper arms. In the nod the top of the word stood up to 4-6 mm off the shirt (from the side, a white fin above her outline) and in the wave parts of it sank up to 6 mm into the shirt (lavender patches through the letters). `fix-shirt-logo.mjs` now gives every ink splat the shirt's own blended weights (the visible shirt splats around it, a smooth 6 mm kernel, the strongest 4 bones, whole 255ths that add up to 255) and tucks the ink back up to 3 mm into the shirt's soft outline wherever a level side view (±45-90°) would see it with less than 25% shirt behind it (deeper would tint the tops of the letters from the front). Real engine, from the side, the print past her outline: standing -31%, nodding -60%; in the wave the letters stay whole; from the front the same. Only the 6,809 ink splats changed (new weights; 2,508 moved back, at most 3 mm). Before/after: `output/agi1-3d-print-motion-before-after.png`. A thin white edge can still show exactly side-on: the shirt is made of soft, centimetre-wide Gaussians, so a crisp print can't be both fully white from the front and fully inside that haze from the side.

Rebuild the model (the original stays untouched; `new agi 3d model/` is not in git, so this runs on the owner's computer):

```
node tools/model/fix-shirt-logo.mjs     # → output/agi1-splat-print.vsplat
node tools/model/polish-splat.mjs       # → public/models/agi1-splat.vsplat
```

Both are deterministic. With sharp's native Linux build (a cloud session's `npm ci`) the result is the shipped file byte for byte. The Linux shell on the owner's PC loads the Windows-installed packages, so sharp falls back to its WebAssembly build there and the glyph mask gains one ink splat (6,810 instead of 6,809), otherwise the same. `tools/model/vsplat-io.mjs` reads and writes VIGGCHAR v1 (an unchanged model round-trips byte for byte). The model URL is versioned `?v=20261028-print` (it was `-polish` before the print's motion fix). Tests: `tests/agi1-splat.test.js` has 6 more (proportions and grounding, no bone scale in blinks, the slot-0 placeholder and no invisible splats, the print's gap to the cloth, long hair not on arm bones); the three model checks fail on the previous model. Full suite: **1,307 passed, 0 failed, 4 skipped** (1,311). Since the print's motion fix one more: "the AGI print moves with the shirt through the nod and the wave" (99% of the print within 1.5 mm of the shirt's own motion; the morning's model fails it, 4.3 mm off the shirt in the nod and 2.2 mm into it in the wave, now 1.0 and 0.4 mm). `tests/agi1-splat.test.js`: **23 passed** in the cloud and on the owner's PC. The rest of the suite was run on the owner's PC's Linux shell: all pass except 42 that need Linux builds of sharp or Vite's bundler (rolldown), which that shell doesn't have (sharp's WebAssembly fallback: "SharedArrayBuffer is not allowed"; rolldown: "Cannot find native binding"); none of them touches the 3D files. Before publishing, in a clean cloud clone (`npm ci`): the full suite, **1,312 tests: 1,308 passed, 0 failed, 4 skipped**, on Node 22 (with the build: vite, share pages, secret check), on Node 20, and on Node 22 with made-up values for every Vercel setting; Node 24 couldn't be downloaded in that session (nodejs.org blocked there).

Not changed: her face, outfit, colours, motions and the 2D model. Still the model's own baked hair (no hair physics in 3D yet: a possible next step). Also not changed: the 3D loading still `public/images/agi1-live-splat.webp` is from 2026-10-25, before today's hair and print work (`node tools/model/render-splat-portrait.mjs` renders it again from the shipped model). Seen while checking, also with the morning's model: PlayCanvas's sort worker warns "127-817 splats lost due to sortKey overflow. Check resource AABB bounds contain all the splats." during the wave and the nod (splats posed outside the bounds the engine computed are left out of that frame's sort); not investigated.

## AGI-1 3D model update — 2026-10-25 (release authorized)

**Production retry (2026-10-25):** nod/relaxed-pose commit `0fcb3a7` reached `origin/main`, but Vercel initially blocked deployment because team `agi25` exceeded its Hobby Fluid Active CPU limit. The owner has now upgraded to Pro and explicitly requested publishing again; the authenticated dashboard confirms **agi Pro** and the pause notice is gone. This documentation-only push retries the same tested runtime and model assets. Verify Vercel Ready and the live nod asset before reporting success. Local deployment evidence is in `agi1-nod-release-status.log`.

The owner requested "publish it" after reviewing the model and motion improvements. Release through this repository's `main` branch to the existing `agi-ecosystem` Vercel project; verify the production assets and 3D view at agi1.app after the deployment finishes. Unrelated local media/game work is excluded from this release.

The model/logo/facial-polish release is live in production as `eedf762` (Vercel deployment `DYbKtdDNf5yYZgCLbBNptud6XMQy`). The owner then supplied `new agi 3d model/Nod-Yes.glb`, clarified that the screenshot concern is **stiff pose and movement**, and explicitly requested another production release. Clothes and model geometry are outside that follow-up.

The follow-up relaxes the forearms so her hands rest beside her thighs and adds the supplied 3.7-second full-body nod at `public/models/agi1-nod-yes.glb`. `tools/model/retarget-nod.mjs` rebuilds it with the original facing corrected and feet grounded. One playback controller manages hello/nod priority, sparse quiet-idle nods, and smooth returns including pelvis height. Facial animation stays active over either gesture. The nod's first frame leans forward and is not used as the idle pose. All 16 focused splat checks pass, including real engine/controller playback, body preservation, grounded feet, transition continuity, blinking and speech. Browser checks verify relaxed standing and the authored nod.

Nod follow-up production build: **1,289 passed, 0 failed, 6 skipped**, with the bundle and secret checks passing (`agi1-nod-build.log`).

Final motion/facial-polish build: **1,285 passed, 0 failed, 6 skipped** (`agi1-motion-build.log`). The 12 focused splat checks also pass after verifying the actual model-space eyelid/eye translations. Built preview at `http://127.0.0.1:5194/talk` loads under the production CSP with no application console errors.

The 3D option now loads the owner's character from `new agi 3d model/Blonde Anime Girl_high.vsplat` and its supplied `Wave-Hello.glb` motion. The original files remain unchanged. `src/stage/agi1-splat.js` lazily loads Viggle Splat Engine 0.3.2 / PlayCanvas 2.23.3, mirrors the existing stage camera, and moves its transparent canvas with the home/chat/Risk Check views. The established 2D default remains.

`tools/model/retarget-hello.mjs` converts the supplied Mixamo wave into the 441-bone rig at `public/models/agi1-wave-hello.glb`, keeping the lower body planted and the model's native finger shape. Arrival and wave requests play it once, then return to a relaxed idle. `tools/model/fix-shirt-logo.mjs` rebuilds `public/models/agi1-splat.vsplat` with clean white AGI lettering fitted to the shirt and smoothly weighted to the torso. Both public asset URLs are versioned to avoid old cached copies. Full-screen 3D portraits include the shirt.

Production CSP now explicitly permits same-origin and blob workers; other sources are unchanged. Vite excludes the splat engine from dependency prebundling so its decoder worker resolves. Initial integration passed 1,278 tests (6 skipped). Browser checks cover 3D loading under production headers, hello/idle, 2D switching, home/chat docking and phone framing.

The owner's follow-up requested the 2D version's animation polish. `src/stage/agi1-splat-motion.js` now reuses its spring following and irregular drift for breathing, independent shoulders/arms/wrists, gaze, speaking nods and soft wave/dance transitions, with planted feet and reduced-motion support. `src/stage/agi1-splat-face.js` adds recurring/attention blinks, mouth movement on both the separate native jaw and lower-lip branches, and subtle mood smiles. The shared voice meter and silent speech fallback already feed the controller. Facial movement is applied after the body pose, without blanket smoothing that would erase quick blinks. Eye splats recede behind the converging eyelids: ordinary bone scaling is stripped by the renderer and must not be relied on for visible closure. Actual browser checks verified fully closed/reopened eyes and open/closed speech poses. Desktop 2D/3D frame cadence matched at ~13.3 ms in the same visible browser. The new model still uses its own baked hair geometry rather than the 2D model's Cubism hair physics. These changes shipped in `eedf762`.


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

### 0.1 Current status and owner checklist (updated 2026-10-22)

**The local blockers are resolved.** The ten reported failures are fixed; the complete suite has **1,028 passed,
0 failed, 6 skipped**. Vite is now 8.3.3 and source-map-js 1.2.2; `npm audit` reports zero vulnerabilities. Node 20,
22 and 24, the three clock-shift cases, and a clean Windows build with made-up deployment settings passed. Desktop,
360 px phone, the built chart under the unchanged production CSP, and a two-player local race were checked.
See [the validation report](handoff/validation-2026-10-22.md) for scope, limitations and changed files.

**Release authorized (2026-10-22):** the owner requested “publish everything now.” This supersedes the earlier
pause and release-approval checklist. The reviewed changes are being committed and published to `main` for agi1.app,
with `supabase/arcade.sql`, the hosted relay update and live checks included in that release.
The initial release, encoded-leaderboard fix and native-currency/live-search fixes are live (`cb42c28`, `081d21f`,
then `818fdd5`); the database and Hetzner updates passed their live checks. A final follow-up prevents fabricated
short-term percentages when an older coin has insufficient observed history. See `handoff/release-2026-10-22.md`
and the local `release-final-verification.log` for the release evidence.

The earlier checklist below is retained as historical context; items 1 and 2 have now been completed locally:

1. **The full test log** (Command Prompt in the project folder: cleaner than Windows PowerShell 5.1, which wraps a
   program's error lines and may save the file as UTF-16): `npm test > npm-test.log 2>&1`, then let the next session read
   `npm-test.log` (blocker 2 in 3.5; `*.log` is git-ignored). Optional: `npm audit` shows the "2 high severity
   vulnerabilities" npm mentioned after the chart install.
2. **Browser review** on this PC: `npm run dev`, then
   - http://localhost:5173/games/trenchingsimulator → Play → GNGM → open a coin: the TradingView chart (candle sizes,
     MCap/Price, USD/coin, fx, B/S, zoom, "back to now"), its credit and link under it, a phone width (360 px);
   - race rooms: in a second terminal (PowerShell) `$env:TRENCH_ORIGINS='http://localhost:5173'; $env:TRENCH_CHAINS='base';
     node tools/trench-relay/server.mjs` (one chain keeps its outside requests few; rooms need none), then the game at
     `http://localhost:5173/games/trenchingsimulator?relay=ws://localhost:8787/ws` in two windows → Race a friend;
   - http://localhost:5173/games → the Leaderboards section (it says "open soon" without the site's `/api`).
3. **GitHub Desktop:** review the changed files (3.2), commit on `claude/blissful-davinci-bnr01m`, push; pushing to
   `main` deploys to agi1.app (section 1: ask yourself before that one).
4. **Supabase** (before or right after the deploy): SQL Editor → paste all of `supabase/arcade.sql` → Run →
   `arcade_functions_found = 14`.
5. **The relay** (after the push, since `relay.sh update` does `git pull --ff-only` on the server's copy): in
   `/opt/agi1-trench/trench.env` add `ethereum,monad,hyperevm,arbitrum,tron` to `TRENCH_CHAINS`, then
   `sh /opt/agi1-live/site/tools/trench-relay/relay.sh update` and `relay.sh check` (race rooms and the new chains).
6. **After the deploy:** agi1.app/games/trenchingsimulator on a phone and a computer (GNGM's chart, a race, a ranked
   daily market), agi1.app/games's Leaderboards; Vercel → Deployments says Ready.

### 0.2 Phomo and replay release (2026-10-22)

The owner subsequently requested a terminal closely matching Fomo's web layout and workflows, with the established
Phomo parody branding, plus run replay. The playable Phomo terminal, local social controls, view-only perps and
recorded replay are implemented and browser-checked locally. The final full build passed **1,081 tests,
0 failed, 6 skipped**, including the final follow-ups. The owner explicitly requested **"publish it"**;
**publication succeeded** at commit `9238eb19ff0095155817729bc314a9724cfb90b4`, pushed to `main` and the working branch.
Vercel production deployment `Go5q1dKMTZCqZoFUY8mvwC7Ps6tx` completed successfully at **2026-10-22 11:07:04 UTC**.
Hetzner runs the same commit; the spot feed, all nine chains, perps, exact AGI contract lookup and a temporary
two-client room/cleanup check passed. **Production UI smoke verification passed** on `www.agi1.app`: Phomo opens,
the exact AGI contract resolves, a $10 practice buy fills, live perps quotes and 180 BTC candles load, and the
completed run replays at 4× with the recorded fill and portfolio values. Browser warnings/errors: none.
No database changes were required. The published game is https://www.agi1.app/games/trenchingsimulator.
See [the Phomo and replay handoff](handoff/phomo-2026-10-22.md) for implemented features, data limits, test evidence,
reference pages and coordinated frontend/relay deployment evidence.
The earlier production release described above remains historical release evidence.

---

### 0.3 Phomo fidelity correction (2026-10-22)

The owner rejected the first Phomo release as visually incomplete and requested the whole Fomo web experience.
The signed-in browser was audited screen by screen; the corrected implementation preserves original Phomo
branding and practice-money rules. It adds persistent compact discovery, richer chart controls and original
drawings, full-width profiles, position details, local social controls, simulated clans, docked view-only perps,
and saved replay access. See [the fidelity audit](handoff/phomo-fidelity-audit-2026-10-22.md) for evidence and
explicit service/data limits. Do not claim a complete clone of Fomo's private services.

The final local build passed **1,111 tests, 0 failures, 6 skipped** on Node 24.21.0. Node 20/22 were not installed
for this follow-up and were not rechecked. The built UI was checked under the unchanged production CSP; chart
styles, whitespace drawings, undo/redo and the corrected profile layout worked without console warnings/errors.
Publication succeeded at `4c214cbed78b7d6030746075ec74004b9fc1e3c8`. Vercel production deployment
`GzKNs5dWeUaEmxAz5hz66H2diXjG` became Ready at 2026-10-22 11:57:23 UTC, assigned to `www.agi1.app`.
The live browser check resolved the owner's exact AGI contract, filled a $10 practice buy, and loaded 178 public
perpetual markets with 180 BTC candles in the corrected layout. Browser warnings/errors: none. Hetzner's clean
checkout was fast-forwarded to the same commit; relay code was unchanged and running services were not restarted.

### 0.4 VLAD RUNNER 2049 — published (2026-10-23)

The owner requested a new original arcade beat 'em up starring Vlad and AGI-1, and explicitly authorized building
and publishing it at **`/games/vladrunner2049`**. **Publication succeeded** at commit
`6f2f5a25fe15850832be40218128bed3eff0913e`, pushed to `main` and the working branch. Vercel production deployment
`2h12HJDm6QUZpNmEYPwepKEh28M7` became **Ready at 2026-10-23 00:21:52 GMT+8 (2026-10-22 16:21:52 UTC)**,
after 3 minutes 16 seconds. The game is live at [www.agi1.app/games/vladrunner2049](https://www.agi1.app/games/vladrunner2049).
See [the game handoff](handoff/vlad-runner-2049.md) for controls, artwork direction, implementation, limits, and evidence.

The game includes three districts with four encounters and a boss in each, Story/Endless/UTC Daily modes, solo hero
switching, local co-op, story assist, combos, heavy/aerial attacks, shield breaks, dodges, energy specials, a duo attack,
pickups, between-district upgrades, local personal records/achievements, and downloadable score cards. Keyboard, touch,
and standard gamepad controls are implemented. Nine original optimized artwork files total **3,436,438 bytes**;
AGI-1's separate left-facing atlas preserves readable shirt lettering. The games shelf and clean game URL are wired.

**Frontend only:** no backend, database, SQL, relay, or SSH changes were needed. There are no wallet requests,
deposits, prizes, real-money mechanics, or automatic social posts. The shelf card deliberately has no server-backed
ratings, player counts, or leaderboard hook. Personal scores stay on the device. The existing CSP is unchanged.

The final full build passed on **Node 24.21.0: 1,144 passed, 0 failed, 6 skipped** (1,150 total), including the final
left-facing artwork correction. Build, share-origin replacement, secret scan, and diff checks passed. Built HTML,
entry bundle, and all nine images were verified. Fake deployment settings and three shifted UTC dates also passed
the full suite; Node 20/22 were unavailable locally and were not downloaded. Evidence is in the git-ignored
`vlad-build.log`, `vlad-fake-env-test.log`, and `vlad-clock-2026-10-*.log` files.

Local browser QA completed a full Story-assist playthrough with both heroes, all three bosses and both upgrades:
**28,888 score, 47 enforcers, 10-hit combo, 3:49**. Victory, achievements and the downloaded PNG score card were verified.
Local co-op, a 20-hit combo, and phone joystick movement were checked under the production CSP without console errors.
Production checks confirmed the title, all artwork, keyboard combat, Tag, pause, settings, Daily restrictions and
correct left-facing AGI lettering; browser warnings/errors were absent. Physical-controller play remains unverified;
automated mapping/disconnection tests passed. The live trailing-slash URL loaded the final entry bundle
`/assets/vladrunner2049-_pN7lU01.js`. The live `/games` page displayed the standalone third card and artwork;
clicking **Play VLAD RUNNER 2049** returned to the correct playable title. All final routing and shelf checks passed.
See the game handoff for screenshot paths and the distinction between local and production QA.

### 0.5 VLAD RUNNER quality revision — preview only (2026-10-23)

The owner rejected the sound, stiffness, animation, interface and fonts. Combat/audio revision `9a28439` and
illustrated-interface revision `5ad6f8c` are pushed on the working branch only. The latest checked preview is
https://agi-ecosystem-oq5il0kwx-agi25.vercel.app/games/vladrunner2049 ; deployment
`4r4bLg2xvUxnRN57PWEewH6Q3vT4` is Ready. Production remains the earlier `6f2f5a2` game.
The current turn promised a separate preview before replacing production. Vercel protection stays enabled;
the owner's signed-in Chrome can open it. Read [the interface handoff](handoff/vlad-interface-preview-2026-10-23.md)
and [the combat handoff](handoff/vlad-combat-preview-2026-10-23.md) before continuing.
Full build: 1,169 passed, 0 failed, 6 skipped on Node 24.21.0. Browser desktop/phone/landscape layout and hosted
game start/HUD checks passed. Arenas remain flat and some enemy/boss animation is still sparse; do not claim
the entire Fist Punch quality gap is closed.

### 0.6 VLAD RUNNER revised version — published (2026-10-23)

The owner explicitly requested **"publish the new one now"**. This supersedes the preview-only status above.
Commit `37a3a698db952dfcceff8885df4f4c4d3dcedba5` was fast-forwarded to `main`; production deployment
`4j5c1j4DzLiJMCWF7BEtFazDkyQw` became **Ready** after 3m 34s and is assigned to `www.agi1.app`.
The live game is https://www.agi1.app/games/vladrunner2049 . Public browser verification loaded all new art,
the title and character selection, started a run, exercised movement/combo (418 points), and paused successfully.
There were no browser warnings/errors. Local proof: `node_modules/.cache/vlad-production-interface.png`.
This release includes the combat, animation, audio and illustrated-interface revisions. No backend, database,
SSH, environment, or deployment-configuration changes were required. The quality limits in the preview notes
remain accurate; do not claim the full reference-game quality gap is closed.

### 0.7 VLAD RUNNER story, world and challenge — published (2026-10-23)

The owner requested larger interactive stages, story featuring both heroes at every stage, stronger music,
enemy reactions and more challenging mechanics. These are published at `ac926732df1dd68f24ff1720f548675cfd31822a`
(feature commit `c863531`, then an opening-objective wording correction). Production deployment
`BkY5xMqPzqShorAeN6YMFacL1Ls2` is **Ready** after 3m 23s and assigned to `www.agi1.app`.
The public game is https://www.agi1.app/games/vladrunner2049 . Full checks: **1,192 passed, 0 failed, 6 skipped**;
the final one-line copy correction also passed all ten UI tests and a production bundle build.
Public checks loaded the new diner story and final objective, then exercised scrolling, platform jumping,
combat (139 points), pause and title return. No browser warnings/errors. Screenshot:
`node_modules/.cache/vlad-production-story.png`. The user's public browser has Music and Sound effects at 0%;
these choices were preserved. No SSH, database, service or deployment-security changes.
See [world revision notes](handoff/vlad-world-revision-2026-10-23.md) for mechanics, test scope and animation/audio limits.

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

   **Only two playable terminals for now:** Pomp.fun (built before) and GNGM. **Built 2026-10-22 on the owner's PC, not
   committed (3.2)**. Its chart is TradingView Lightweight Charts™ 5.2.1 since the second Windows session (3.2).
3. **GMGN's other chains in Live mode.** Tell the owner whether a chain needs an API key like Helius. The research
   answer: **no new key is needed** (section 5.5). **Built 2026-10-22 (3.2), not committed:** Ethereum, Monad, HyperEVM,
   Arbitrum and Tron. X Layer and MegaETH wait for `/health`'s count. The owner must add the new ids to `TRENCH_CHAINS`
   in their `trench.env` and run `relay.sh update`. Tell them the key answer.
4. **An optional player name**, entered before playing, like a real terminal's username. **Built for TRENCHING
   SIMULATOR (3.2).** Ride 'Em, AGI! asks for it with its leaderboard.
5. **Leaderboards with names**, for TRENCHING SIMULATOR and for Ride 'Em, AGI!. **Built 2026-10-22 (3.2), not
   committed:** server, SQL, both games' sides and the agi1.app/games section. They say "open soon" until the owner runs
   `supabase/arcade.sql`.
6. **Multiplayer for TRENCHING SIMULATOR only:** invite players by a link, no wallet needed. **Built 2026-10-22 (3.2),
   not committed.** Rooms open once the owner runs `relay.sh update`; until then the game says rooms aren't open.
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
- **GNGM's chart uses TradingView Lightweight Charts™** (**done**, 3.2; `lightweight-charts`, exact version `5.2.1`, Apache-2.0),
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
- **The Ethereum question:** `CLAUDE.md` said Live mode is "never Ethereum" (twice), with no reason recorded. The owner
  asked to add GMGN's chains, and GMGN has Ethereum. **Done 2026-10-22:** Ethereum added and both lines changed. Mention
  it to the owner.
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

### 3.2 Done on the owner's Windows PC (2026-10-22; **not committed**: the owner commits with GitHub Desktop)

- **Milestone 2a:** `boards/common.js` holds the helpers both terminals share (sorts, order errors, who traded, holder tags,
  quick buys, amounts, `num`, `ago`, `short`, the picture tile `pic(r, cls, prefix)`, `fromWords`, `SOCIALS`…).
  `board.js` imports them and still exports `SORTS, ORDER_ERRORS, whoText, holderTag, buyPresets, parseAmount`. A re-export
  alone would not have been enough: `board.js` uses some of them itself.
- **GNGM, playable** (`terminals.js` 'scan' `ready: true`). Its files:
  - `boards/gngm-data.js` (pure, tested): the chart's sums, candles of 1 s to 15 m with buys and sells, price or market cap
    in USD or the run's coin, MA/EMA/RSI/MACD, card metrics, the filters (safe, smart money, strict), Activity labels (New
    Holder, Buy More, Sell Part, Sell All), top traders, the security checklist, the first-buyers summary, the Track feed,
    the wallet pages (smart wallet 7D and this run, KOL calls), "Take my initial", limit and auto (TP/SL), PnL numbers;
  - `boards/gchart.js`: **GNGM's chart on TradingView Lightweight Charts™ 5.2.1** (since the second Windows session; it
    replaced the canvas chart built first, keeping its doors: `createGChart(host, opts)` → `set`, `view`, `indicators`,
    `fit`, `toNow`, `zoom`, `redraw`, `state`, `destroy`, and the legend through `onHover`). `chart.addSeries` with
    `CandlestickSeries`, `HistogramSeries` (volume, its own overlay scale) and `LineSeries` (MA 20, EMA 9), RSI and MACD
    in panes of their own (`chart.addPane()`), B/S bubbles as a series primitive, the migration with
    `createSeriesMarkers`, the crosshair legend from `subscribeCrosshairMove`, `autoSize` (the host's own size), local
    time on the axis, the zoom buttons through `barSpacing`, "back to now" with `scrollToRealTime()`, `chart.remove()` on
    destroy. Loaded with `import('lightweight-charts')` the first time a coin's chart has candles (its own 62 KB gz file),
    never on our server. `attributionLogo: false` and our own credit under the chart (`chartCredit()`: "Charts:
    TradingView Lightweight Charts™ · Copyright (c) 2025 TradingView, Inc.", one link to https://www.tradingview.com/)
    and in How to play; `vite.config.js` `build.license: true` writes `dist/.vite/license.md` with its Apache-2.0 text.
    The coin page draws it in a `div.tsg-canvas`; the legend adds the indicators' values (`fxText()` in
    `gngm-data.js`);
  - `boards/gngm.js`: the top bar (Trenches · Trending · Track · Holding, search "/", the chain, the balance, settings);
    Trenches (three columns, each with a quick-buy amount, a filter and a "Paused" chip; hotkeys Z + row, or Space +
    column + row, off until "Hotkeys" is pressed); Trending 1m/5m/1h; Track; Holding with PnL cards; wallet pages; settings
    (the name, P1–P3, the chart view, hotkeys, pause on hover); the phone tab bar;
  - `boards/gngm-coin.js`: the coin page. Header, stats and changes, the chart toolbar, the tabs Activity (maker chips) ·
    Traders · Holders · Dev token · Position / Orders · Info (phones), the trade module (Buy/Sell; Market/Limit/Auto; four
    amounts; 25–100 %; Take my initial; P1–P3), the position box, security, the pool, the first 70 buyers grid, the phone
    Buy/Sell bar and sheet;
  - `boards/gngm-card.js`: GNGM's PnL card (1200 × 630: the toad mark, the return, invested / sold / profit, "by <name>",
    the safety foot). Never a QR code, a referral or a real coin's name ("a live coin");
  - CSS: the `tsg-` section at the end of `trench.css`.
- **The engine:** `firstBuyers(id)` (a coin's first 70 buyers and what each holds now; `null` for a real coin). The smart
  wallets' 7-day records gained `dist` (how their trades ended), counted from the same dice, so markets are unchanged.
- **The shell:**
  - GNGM loads as its own file (`import('./boards/gngm.js')`) on the "Opening…" screen;
  - its PnL card on the results screen;
  - `ctx` extras: `presets`, `pickPreset`, `setPreset`, `chartView`, `setChartView`, `playerName`, `setPlayerName`,
    `saveCard`, `chain`;
  - the save: `preset`, `presets`, `chart`. The picked preset is the game's slippage and priority.
- **The optional player name:** `src/games/player-name.js` (both games, `agi_player_name`), a short form of
  `reviewName()`'s rules. Asked on a run's brief, in the settings and in GNGM's settings. Shown on cards. Ride 'Em, AGI!
  doesn't ask yet (leaderboards will).
- **`share.js`:** `tradeShareText()`, the words shared with one coin's PnL card.
- **Tests:**
  - 10 new tests in `tests/trench-game.test.js` (GNGM's numbers, its chart on a stand-in canvas, first buyers, Track and
    wallets, the trade module, presets and the name, the PnL card, GNGM ready);
  - `tests/trench-live.test.js`: GNGM's files in the Live files check (no links, `CA` first 6, "play money"); the CSS rule
    allows `tsg-`; a real coin's first buyers are `null`;
  - **two Windows path fixes** (`fileURLToPath` instead of a URL's `.pathname`, assertions unchanged):
    `tests/wallet.test.js:289-290` and `tests/launch.test.js:1914`.
- **Leaderboards (both games), "Checked runs only":**
  - `run.js`: the tick steps exactly like `replay()` (5.3's fix), so a played run's orders make the same run again;
  - `src/games/boards.js` (shared, pure): `BOARD` limits, board ids, `trenchKeys`/`rideKeys` (how runs rank), `rowText`,
    `rowName`, `rankWords` (a run's line on its results), `boardTitle`;
  - `src/games/trenchingsimulator/verify.js`: the order log packed (`n36,coin36,b|s,amount,slippage,prio`, ≤ 1000) and
    read back, `replayRun` (the run made again from its ticket's seed and price), `sameResult`;
  - `server/scores.js` (new; `server/arcade.js` is pinned by its tests): HMAC tickets (`PASS_SECRET`, tied to a code of
    the browser's id), `gameTicket`, `gameScore` (TS: late, too fast, would-place check, then the replay; Ride: 5.3's
    sanity checks and the daily mod), `gameBoard`, `myScores`. Caps: 60 tickets and 30 scores a visitor a day; for the
    site 50,000 tickets, 20,000 scores and **2,000 replays** a day (`'p'`, counted only for a run that would place);
  - `api/wallet.js`: `GET ?board=<game>:<board>` (CDN a minute) and the actions `game-ticket`, `game-score` (up to 48 KB
    when `action` comes first), `game-score-mine`; `scoreBurst` 12 a minute; `{ ready: false }` / 503 `not_ready` until
    the SQL is run;
  - `supabase/arcade.sql`: three tables (`agi1_arcade_scores`, `agi1_arcade_tickets_used`, `agi1_arcade_score_days`) and
    six functions (`arcade_take`, `arcade_board_cut`, `arcade_score_put`, `arcade_board`, `arcade_score_mine`,
    `arcade_score_hide`); it now ends with `arcade_functions_found = 14`. **Not run anywhere** (no Postgres here);
  - TRENCHING SIMULATOR: `ranked.js` (`askTicket`, `sendScore`); `shell.js` asks a ticket for a daily market or challenge
    in SOL (never free play or Live mode), plays its seed and price, sends wins (and the daily market's losses), and the
    results screen says "Ranked #N · …" or why not; the brief says how ranking works;
  - Ride 'Em, AGI!: `src/games/rideemagi/ranked.js` (`Ranked.start(cfg)`, `Ranked.result(r, st)`: endless runs and the
    daily mod; a few seconds of "Ranked #N" at the top), hooked through `tools/games/import-rideemagi.mjs`'s PATCHES and
    the same lines in `game.js`; names from `agi_player_name`;
  - agi1.app/games: a "Leaderboards" section between the shelf and the ratings (`games.html`, `id="leaderboards"`), a
    box per game (board picker from `pickerBoards()`, top 20, "Your best" via `game-score-mine` only for a browser that
    already has the games' random id, never made there), the shared optional name with Save, the fine print, and a
    "What a leaderboard keeps" line in "The fine print". Code: `src/games/leaderboard.js` (`startBoards()`, started by
    `page.js`; asked once the section is near the screen; one retry); CSS `gm-lead`/`gm-lb-*` in `games.css`, Pop
    mode mint in `pop.css`. `index.html`'s safety note gained one sentence (it must never say "leaderboard");
  - the name notes in TRENCHING SIMULATOR (brief, settings, GNGM settings) now say ranked runs show the name;
  - tests: `tests/trench-game.test.js` (replay parity with uneven frames, the server path with a fake database, the
    boards' rules, `pickerBoards`/`mineText`, the page module on a stand-in page); `tests/arcade.test.js` (Ride 'Em's
    server checks and hooks, 14 SQL functions and their signatures); `tests/page.test.js` (the section, its module's
    imports/fetches/actions, its CSS; `page.js`'s pinned import list gained exactly `{ startBoards } from
    './leaderboard.js'`). The `page.test.js` changes were checked by reading only (blocker 2).
  - Caveat: a run played in Safari or Firefox may not check (their maths can differ in the last digit from the server's
    V8): it just isn't ranked.
- **Race rooms ("Same-market race"):**
  - the relay: `tools/trench-relay/lib/rooms.mjs` (new; in memory only): 6-character codes, 8 seats, the host picks a
    challenge and starts it (and rematches), `go` gives everyone the same seed (`race-<code>-<n>`), SOL price (the hub's,
    else 150) and start time (5 s countdown); reports `p` (about once a second) and `done` make the standings (a win
    first by time, then multiples, busted last), sent every 2 s; a race ends when everyone's done or at its time + 15 s;
    names made safe (16 characters, no posing, links, addresses or crude words; else "Trader N"); resume within a
    minute of a drop; caps (200 rooms, 1,600 racers, 8 a room and an address, 3 new rooms an address per 10 minutes,
    10 wrong codes a minute, 1 KB a message, about 2 a second); a lobby expires after 15 minutes, an empty room after
    a minute, an ended one after 5. `server.mjs` routes `/room` (its own origin check, caps and 1 KB limit; `/health`
    counts rooms); `config.mjs` `rooms` (`TRENCH_ROOMS=off`, `TRENCH_ROOM_SEATS`, `TRENCH_ROOMS_MAX`,
    `TRENCH_ROOM_PLAYERS`, `TRENCH_ROOMS_PER_IP`; also in `trench.env.example`). No Caddy, Dockerfile or CSP change;
  - the game: `src/games/trenchingsimulator/race.js` (new: `createRace`, `parseRaceMessage`, `raceUrl`, `roomOfHash`,
    `inviteLink`, `cleanCode`, `raceWords`, `standingText`); `shell.js`: "Race a friend" on the home screen (instead of
    "Multiplayer · coming soon"), a room screen (join by code or make a room for a challenge; then the invite link with
    Copy, the players, ready, the host's Start/Remove, leave), the countdown, a race run through `startRun` (simulated,
    `realTime`, the room's seed and price, never ranked, counted by the one `Site.play()`), the standings strip under the
    HUD, the room's standings on the results with "Back to the room". An invite link `#room=<code>` opens its room's
    screen with the code filled in and takes the code out of the address. Leaving the race screens leaves the room;
  - CSS `ts-race-*` in `trench.css`; `boards.js` WHY gained `race`;
  - tests (in `tests/trench-live.test.js`, so the focused command runs them): rooms with a fake clock (the whole race,
    names, resume, expiry, caps), the real relay's `/room` (origin 403, per-address 429, a race over real sockets,
    `/health`, 1 KB → 1009, `TRENCH_ROOMS=off` → 404), the browser client on a stand-in socket, the shell's hooks; the
    Live files check now includes `race.js`.
- **GMGN's other chains in Live mode** (no new key; DexScreener's listed coins, like BNB Chain and Base):
  - the relay: `config.mjs` `CHAIN_IDS` + `ethereum, monad, hyperevm, arbitrum, tron`; `hub.mjs` letters `e m h f t`
    (`ID = /^[srbaemhft]…/`), quiet after 30 minutes; `parse.mjs` `WRAPPED` + HYPE (WHYPE), MON (WMON), TRX (WTRX, its
    base58 address as it is), `PRICE_RANGE`, `isTron`, `addressOn` (EVM lower-cased, Tron case-sensitive), Tron profiles;
    `sources/dex.mjs` `DEX_CHAINS`, all five judged by DexScreener, HYPE/MON/TRX priced only while their chain is on,
    prices under $1 kept to 4 significant figures (not rounded to the cent), and `/health` `dexscreener.profiles` (a
    day's count of every chain id DexScreener lists: the check for X Layer and MegaETH); `fakes.mjs`;
    `trench.env.example` `TRENCH_CHAINS` names them all;
  - the game: `live-chains.js` `CHAINS` (Ethereum ETH, Monad MON, HyperEVM HYPE, Arbitrum ETH, Tron TRX), `UNIT_NAMES`,
    the id letters, Tron addresses kept as they are, the new prices read, `liveMoney` keeps sub-dollar prices;
    `format.js` coin names; the pair label in `board.js`/`gngm-coin.js` for any chain's coin; `boards/common.js`
    `CHAIN_NAMES`; How to play's chain list. Terminal ids unchanged;
  - `CLAUDE.md`: both "never Ethereum" lines changed (Live mode notes, decisions-log row 2026-10-21);
  - tests: the chain lists (9), each terminal's money on each, a new end-to-end test (Tron and Ethereum coins through
    the relay with the stand-ins, their own letters, TRX/MON priced, HYPE not asked while HyperEVM is off, the count in
    `/health`, Tron addresses case-sensitive, MON's money "7,500 MON" for 1 SOL).
- **`CLAUDE.md` notes for all of it:** the summary at the top (with the owner's steps), "AGI games" → "Leaderboards"
  (new), "TRENCHING SIMULATOR" → "GNGM, names, leaderboards, race rooms and more chains" (new; three outdated lines fixed:
  one terminal ready, "Multiplayer · coming soon", four "Coming soon"), AGI games' owner steps and troubleshooting
  (`arcade_functions_found = 14`), Project structure (`src/games/`, `src/games/trenchingsimulator/`, `server/`,
  `supabase/arcade.sql`, `tools/trench-relay/`), the relay's settings table (`TRENCH_CHAINS`, `TRENCH_ROOMS…`), Security &
  cost rules (leaderboards, race rooms, the new chains), the Free-tier budgets (the replays' CPU, about $2 a month at most;
  the rooms on the CX23), the decisions log (five rows, 2026-10-22) and Open questions (Lightweight Charts, the
  leaderboards' limits, X Layer and MegaETH, race rooms' limits, what wasn't tried).

### 3.3 Missing (not started)

- nothing that can be done on this PC with the approved commands: what's left needs the owner (3.5's blockers, 4.1);
- telling the owner the API-key answer. The first report of 2026-10-22 said it, with the Ethereum change; the owner
  hasn't confirmed it yet.

### 3.4 Known open items (not this handoff's work, but true now)

- **First blood's words don't match its goal.** It says "any profit counts", but it's won at 1.05 SOL. The owner's call
  (it's in `CLAUDE.md`'s Open questions).
- **`public/cards/games.jpg`** (agi1.app/games's link preview) still shows only Ride 'Em, AGI!. Its words say so, so
  it's true; a new one wasn't asked for.
- **Vercel's deployment of `959259e`** wasn't checked (Vercel → agi-ecosystem → Deployments → should say Ready).

---

## 3.5 Checks on the owner's Windows PC (2026-10-22), and blockers

**Environment:**
- Node v24.21.0.
- `npm ci` installed 53 packages from the lockfile. It was used instead of `npm install` because it never rewrites the
  lockfile.
- No git was run (section 1: agents never run git in the owner's folder).

**Results:**

| Check | Before any change | Now |
|---|---|---|
| `node --test --test-timeout=30000 tests/trench-game.test.js tests/trench-live.test.js tests/intro.test.js` | 93 pass, 0 fail | **113 pass, 0 fail** (after the Lightweight Charts swap) |
| `npx vite build` | built | **built** (after the Lightweight Charts swap). `lightweight-charts.production-*.js` its own file (194 KB, 62.3 KB gz), loaded only by GNGM's coin chart; GNGM's chunk 25.5 KB gz plus its PnL card 5.3 KB gz; the game's main chunk 77.3 KB gz (unchanged by the swap); the games page's script 9.6 KB gz; `dist/.vite/license.md` lists `lightweight-charts - 5.2.1 (Apache-2.0)` |
| `npm install --save-exact lightweight-charts@5.2.1` | — | added 2 packages (`lightweight-charts` 5.2.1, `fancy-canvas` 2.1.0); `package.json` `"lightweight-charts": "5.2.1"`; npm's audit then said "2 high severity vulnerabilities" (not looked into: `npm audit` isn't an approved command) |
| `npm test` (the whole suite) | **exit code 1** | **exit code 1** (last run on the final files, after the CLAUDE.md notes; output cut in the middle and at its end, so which tests fail is unknown; every result that could be seen passed, among them `tests/arcade.test.js`'s leaderboard test) |

**Final run on the final files (second Windows session, after the Lightweight Charts swap):** the focused command 113
pass / 0 fail; `npx vite build` built (license file and the library's own chunk as above); `npm test` exit code 1, its
output cut in the middle and at its end again, so its counts and failing tests are unknown (an unchanged exit code
proves nothing either way). Denied and left undone: `npm test > npm-test.log 2>&1` (the tool's write guard, 3.5
blocker 2); earlier, piping `npx vite build` or `node --test` through `Select-String`/`Select-Object`, saving `npm test`'s
output another way, and one Bash `grep`.

- **Why `npm test`'s failures aren't known:** the tool keeps only about 50,000 characters of output, and the summary and
  the "✖ failing tests" list at the end never reach it. Saving the output to a file was refused (no approval surface).
- **Pre-existing Windows failures found by reading:** `tests/wallet.test.js` and `tests/launch.test.js` built file paths
  from a URL's `.pathname` (`/C:/…/AGI%203%20ECOSYSTEM/…`). Both are fixed with `fileURLToPath`; `npm test` still exits 1,
  so at least one other failure remains.
- **Regression review:** the full-suite files these changes can touch were checked by reading: `tests/trench.test.js`
  (engine), `tests/arcade.test.js` (shell's `Site` import and `startRun`), `tests/page.test.js` (shell's "Rate it" links).
  Nothing in them conflicts. Not proven by a run.

**Blockers (each needs the owner):**
1. ~~Lightweight Charts~~: **done** in the second Windows session (3.2, the checks above).
2. **The full suite's failures:** the approved capture `npm test > npm-test.log 2>&1` was **refused by the PowerShell
   tool's write guard** ("Output redirection to '…\AGI 3 ECOSYSTEM\npm-test.log' was blocked … may only write to files in
   the allowed working directories: 'C:\Users\User\Desktop\AGI 3 ECOSYSTEM'": the path is inside it, so it looks like the
   guard's own path check; not retried, not run another way). So run it in a terminal in the project folder (cmd or
   PowerShell): `npm test > npm-test.log 2>&1`, then a later session reads `npm-test.log` (its `not ok` lines and the
   `# pass` / `# fail` counts at the end: TAP, since it's not a terminal). It matters: `tests/page.test.js`,
   `tests/arcade.test.js` and `tests/clips.test.js` were changed, and only `npm test` runs them. Quick check of just
   those: `node --test tests/page.test.js tests/arcade.test.js tests/clips.test.js`.
3. **Looking at the new screens in a browser** (nothing was looked at in a browser on this PC):
   - `npm run dev`, then http://localhost:5173/games/trenchingsimulator → Play → GNGM; and → Race a friend;
   - race rooms locally: run the relay (`node tools/trench-relay/server.mjs` with `TRENCH_ORIGINS=http://localhost:5173`)
     and open the game with `?relay=ws://localhost:8787/ws`, in two windows;
   - http://localhost:5173/games → the Leaderboards section ("open soon" without the API);
   - check a phone width (360 px) and a computer.
4. **Other Node versions, the clock-shift runs and a clean Vercel-like build** (section 7): they need commands that weren't
   approved, or Linux.

## 4. The exact next small milestone

**Updated 2026-10-22:** local repair and validation are complete; see section 0.1 and
[the validation report](handoff/validation-2026-10-22.md). The next milestone is an owner-approved release and the
owner-run database/relay updates. The paragraph below records the previous stopping point.

**Read `npm test`'s failures** once the owner has run `npm test > npm-test.log 2>&1` (3.5, blocker 2): fix any this work
caused, tell apart old Windows ones by their causes (never by the exit code alone). Everything else that can be done on
this PC is done; the rest needs the owner (4.1): the SQL, the relay's update, a browser look, other Node versions and a
clean Vercel-like build, and the push.

### 4.1 Prioritized checklist after that

1. **Leaderboards:** done (3.2). Left for the owner: run `supabase/arcade.sql`.
2. **Multiplayer race rooms:** done (3.2). Left for the owner: `sh tools/trench-relay/relay.sh update` on the server.
3. **Live chains:** done (3.2). Left for the owner: the new ids in `TRENCH_CHAINS` (their `trench.env`), then
   `relay.sh update`; later, X Layer and MegaETH once `/health`'s `dexscreener.profiles.byChain` shows `xlayer` /
   `megaeth` listings.
4. **GNGM's chart:** done (TradingView Lightweight Charts™ 5.2.1). Left: a look in a real browser (the CSP, the credit,
   phones).
5. **Finish up:**
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
  - As built: functions go from 8 to 14 (`arcade_take`, `arcade_board_cut`, `arcade_score_put`, `arcade_board`,
    `arcade_score_mine`, `arcade_score_hide`), and it ends with `arcade_functions_found = 14`. `tests/arcade.test.js`
    checks the file names no game.
  - As built, Ride 'Em's hook is `Ranked.result(r, st)` from `src/games/rideemagi/ranked.js` (its `site.js` imports are
    pinned by tests), not `Site.result`.
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
- **As built (3.2):** races are challenge races only (free play has no clock to race against); the tests went into
  `tests/trench-live.test.js` (the focused command runs it; `npm test` lists its files one by one); a seat's resume token
  is kept in memory only (a dropped connection comes back; a reload rejoins by the code).
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
