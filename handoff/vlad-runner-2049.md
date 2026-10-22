# VLAD RUNNER 2049

## Brief and scope

Build and publish a free browser arcade beat 'em up at `/games/vladrunner2049`, starring Vlad and AGI-1. The user's cartoon references define the heroes' identities. The world should feel like a rain-soaked futuristic city: glowing signs, deep night colors, dramatic silhouettes, and lively, readable combat. All artwork, environments, interface elements, and writing are original.

The game should make the two heroes feel distinct while remaining easy to start. Build a complete short arcade experience: a clear title screen and controls, movement and attacks, readable enemy encounters, health and score feedback, progression through the city, pause/restart, and a clear finish or defeat screen. Keyboard and touch controls must be usable, and the game should adapt to desktop and phone sizes. Implementation, local checks and the successful production publication are recorded below.

Presentation should combine the supplied cartoon character direction with cinematic neon scenery. Use the existing locally hosted Geist and Bangers fonts. The title is **VLAD RUNNER 2049**. Public descriptions emphasize two heroes, one neon city, and free browser play. Keep combat stylized and PG-13.

## Original art direction

These are concise direction summaries, not verbatim prompts. Keep the supplied heroes recognizable, with consistent cartoon proportions and readable silhouettes. Build original environments and enemies; do not reproduce another game's artwork or film characters. Combat poses stay stylized and PG-13. Gameplay atlases use transparent backgrounds and consistent frame grids.

| Final asset | Direction summary |
| --- | --- |
| `keyart.webp` | Vlad and AGI-1 as the two leads in a cinematic, rain-soaked neon city; dramatic lighting and space for the game's title interface. |
| `neon.webp` | Neon Downpour: cool luminous city streets, rain and depth, with a broad readable foreground for combat. |
| `orange.webp` | Orange Expanse: warm amber haze and abandoned futuristic solar-field atmosphere, contrasting with the first district. |
| `spire.webp` | Memory Spire: a violet futuristic skyline and imposing final-district atmosphere, keeping the action lane legible. |
| `vlad.webp` | Preserve Vlad's reference identity across eight consistent movement/combat poses in a four-column, two-row transparent atlas. |
| `agi.webp` | Preserve AGI-1's reference identity, outfit, and readable shirt lettering across eight consistent movement/combat poses. |
| `agi-left.webp` | Matching left-facing versions of AGI-1's eight poses, with lettering drawn naturally rather than reversed. |
| `enemies.webp` | Three original enforcer types—melee, shield, and ranged—with idle, walk, attack, and hurt poses in a four-column, three-row atlas. |
| `bosses.webp` | Three distinct district bosses—the Neon Warden, Solar Juggernaut, and Memory Archon—with four readable poses each and stronger silhouettes. |

## Integration

- Entry page: `vladrunner2049.html`, mounting `main#vr-root` and importing `/src/games/vladrunner2049/page.js`.
- Canonical URL: `https://agi1.app/games/vladrunner2049`; both trailing-slash forms are configured in development, preview, and production. Both public URL forms were verified, and the live trailing-slash page loaded `/assets/vladrunner2049-_pN7lU01.js`, matching the final local build.
- Vite builds the new HTML entry. Vercel maps the clean game URL to that entry.
- The games shelf has a third card using the existing `gm-*` layout and `/images/vladrunner2049/keyart.webp`.
- The card is standalone: no `data-gm-game`, ratings, player counters, or leaderboard requests. The existing two games retain their configured backend features.
- Page metadata uses the public key art for its share preview. `scripts/share-pages.js` substitutes the build's site origin and checks the required image exists.
- The package test command includes `tests/vlad-engine.test.js`, `tests/vlad-input.test.js`, and `tests/vlad-ui.test.js`.

## Implemented engine and controls

The deterministic 60 Hz engine now contains three original districts: Neon Downpour, Orange Expanse, and Memory Spire. Each has four encounters and its own boss. Story and daily runs end after the third district; Endless cycles through the districts with escalating enemies. Story-assist difficulty offers more health and gentler enemy damage. Solo can swap heroes; local co-op uses both. Vlad hits harder; AGI-1 moves, attacks, and recovers energy faster.

Combat includes light combos, heavy and aerial attacks, shield breaks, launches and juggling, invulnerable dodges, energy specials, a charged duo sweep, and health/energy/score pickups. Cleared districts offer three upgrade choices. The game awards combo, style, speed, and no-hit encounter bonuses. Defeated co-op partners return when the surviving partner clears the encounter. Boss light-hit interruption was reviewed and corrected so holding light attack cannot prevent all retaliation.

Solo character switching buffers one press for up to half a second through attack or dodge recovery, so a quick Tag press is not lost. Held or repeated inputs do not cause repeated swaps; co-op keeps each player's hero separate.

`createInput()` in `input.js` is initially disabled. The page enables it only for active gameplay. It returns `sample(coop)`, `setEnabled`, `setTouch`, `setStick`, `clear`, and `destroy`. It preserves brief action taps, handles held controls without keyboard-repeat retriggers, clears on blur and form focus, skips browser shortcuts, and removes its listeners when destroyed. Standard controllers are polled only while gameplay is enabled and focused. The adapter does not implement pause or consume Escape.

| Action | Player one | Player two |
| --- | --- | --- |
| Move | WASD; arrows also work in solo | Arrows |
| Light attack | J | N |
| Heavy attack | K | M |
| Special | L | Comma |
| Jump | Space | Period |
| Dodge | Shift | Slash |
| Tag hero | Q, solo only | — |
| Duo move | E | Enter |

Touch uses a virtual stick and action buttons supplied by the page. Standard gamepads use the left stick or directional pad, A for jump, X for attack, Y for heavy, B for dodge, RB for special, LB for tag, and RT for the duo move. A second controller can control player two; disconnecting player one does not move player two into their slot.

## Boundaries

This is a frontend game. No new service, API endpoint, database table, migration, wallet action, deposit, prize, or real-money mechanic is part of this release. Keep the existing security policy unchanged; use local scripts, styles, fonts, and artwork. No automatic social posting. Any saved best score is local to the browser unless a later request explicitly adds verified online scores.

## Validation and release status

**Published with the user's authorization.** Commit `6f2f5a25fe15850832be40218128bed3eff0913e` was pushed to `main` and the working branch. Vercel production deployment `2h12HJDm6QUZpNmEYPwepKEh28M7` became **Ready at 2026-10-23 00:21:52 GMT+8 (2026-10-22 16:21:52 UTC)** after **3 minutes 16 seconds**. The live game is [www.agi1.app/games/vladrunner2049](https://www.agi1.app/games/vladrunner2049). No SQL, database, relay or SSH modifications were needed.

Integration checks on 2026-10-22: `tests/page.test.js`, `tests/share.test.js`, and `tests/clips.test.js` passed **50 tests, 0 failures, 1 existing skip**. The new regression exercises development and preview URL rewriting, preserves query parameters, and verifies the standalone card cannot start unavailable ratings or count requests. JSON and script syntax checks passed.

Input checks: **7 passed, 0 failures**, covering opt-in controls, held keys and brief taps, solo/co-op separation, text fields and modifiers, touch release, mixed inputs, visibility changes, controller mappings/disconnects, and complete listener cleanup.

Independent source review covered menu focus, pause/help/settings, touch input, co-op, upgrades, result saving, restart, strict security-policy compatibility, and cleanup. It found and led to fixes for the joystick's inherited pointer blocking, permanent disposal on back/forward-cache navigation, hot-reload click-listener cleanup, modal background focus isolation, fullscreen labels, and personal-best retention beyond the recent-run list. The revised local-save reader validates and bounds saved JSON. These are source and automated checks, separate from browser verification.

Nine public artwork files ship with the game: `keyart.webp`; `neon.webp`, `orange.webp`, and `spire.webp`; the hero atlases `vlad.webp`, `agi.webp`, and `agi-left.webp`; and the enemy/boss atlases `enemies.webp` and `bosses.webp`. Key art and district backgrounds are **1672 × 941**. Each hero sprite sheet is **1536 × 1024**, with four columns and two rows. Each enemy/boss sheet is **1254 × 1254**, with four poses in each of three character rows. Every character frame contains visible artwork and transparent surroundings. Total artwork remains below 4 MiB. The key art is about 378 KB; page and card metadata use its actual dimensions.

AGI-1 has a dedicated left-facing atlas so her shirt lettering stays readable when she turns left. The renderer uses its natural orientation and retains the original atlas as a fallback. The renderer review passed 35 checks covering all eight poses, both orientations, Vlad's existing orientation behavior, and the fallback.

The final `npm run build`, including the Tag buffer, all nine artwork files, solo duo hologram, left-facing AGI lettering, and final focus/touch/UTC-refresh corrections, passed on **Node 24.21.0**: **1,150 tests total, 1,144 passed, 0 failed, 6 skipped**. The log is `vlad-build.log` (git-ignored). Vite built successfully, share pages resolved to `https://agi1.app`, and the secret check passed over 108 files with 0 configured secret values compared. The existing English-language mixed static/dynamic import warning remains; it did not fail the build. `git diff --check` passed.

Final built-output verification confirmed `dist/vladrunner2049.html` has no unresolved `__SITE__` marker, its canonical and share-image URLs are correct, its referenced entry bundle exists, and `dist/games.html` links to the new game. All nine built WebPs exactly match their public source files and decode successfully, totaling **3,436,438 bytes**. The renderer review also passed 49 pose/facing/telegraph checks, including isolated crops from the actual enemy and boss atlases. No production result is implied by these checks.

Local browser QA confirmed actual keyboard combat and solo Tag switching, then completed a full Story-assist playthrough using both heroes, defeating all three bosses and choosing both upgrades. The run finished with **28,888 score, 47 enforcers, a 10-hit combo and a 3:49 duration**. Victory, achievements and the downloaded PNG score card were verified. Local co-op with a 20-hit combo and phone joystick movement were also checked under the unchanged production CSP without console errors.

Production browser QA confirmed the title screen, all artwork, live keyboard combat, Tag switching and pause. Settings and Daily restrictions were verified, and AGI-1's left-facing shirt lettering was visibly correct. Browser warnings/errors: **none**. The full campaign victory and touch/co-op checks above were local; they are not claimed as full production playthroughs. Physical-controller play remains unverified; automated controller mapping and disconnect tests passed.

Screenshot evidence is saved locally under `C:/Users/User/.codex/visualizations/2026/10/22/01a1629f-50b9-7c20-bef4-5c97f41ce5c4/`: `vlad-runner-2049-published.png` and `vlad-runner-2049-combat.png` show production; `vlad-runner-2049-victory.png` records the local completed playthrough.

Additional compatibility runs followed HANDOFF section 7's test instructions and exact shifted-Date preload. Each full-suite run passed **1,144 tests, 0 failures, 6 skips**. This matrix preceded the final left-facing artwork/atlas-choice correction; the full normal build was rerun after that correction:

- All 73 deployment-setting names from HANDOFF section 9 populated with generated fake values; inherited real credentials excluded. Log: `vlad-fake-env-test.log`.
- UTC clock moved to `2026-10-22T23:59:20Z`, just before midnight. Log: `vlad-clock-2026-10-22.log`.
- UTC clock moved to `2026-10-26T00:00:30Z`, a Monday. Log: `vlad-clock-2026-10-26.log`.
- UTC clock moved to `2026-10-31T23:59:40Z`, just before month end. Log: `vlad-clock-2026-10-31.log`.

Node 20/22 were not available in the installed Node location, npm runtime cache, common version-manager locations, or bundled runtime cache. The available executables were Node 24.21.0 and two bundled Node 24.19.0 copies. No runtimes were downloaded; Node 20/22 compatibility for this release remains unverified locally.

Publication and final production checks are complete. The live trailing-slash URL loaded successfully and its entry `/assets/vladrunner2049-_pN7lU01.js` matched the final local build. The live `/games` page displayed the standalone third card and key art; clicking **Play VLAD RUNNER 2049** returned to the correct playable title. No tests or build were repeated for these documentation-only updates.
