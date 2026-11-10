# Ten more games — 2026-11-10

The owner requested ten additional games and supplied a community request for a farming simulator. When asked about its direction, they explicitly chose **a fictional stock-market farming sim**. This batch starts from production `f8c9e04` in the isolated `codex/ten-more-games` worktree (`output/games-ten-release`). The original Desktop checkout remains untouched.

| Route | Game | Content |
| --- | --- | --- |
| `/games/harvest` | HARVEST EXCHANGE | Six crops, twelve plots, weather, physical produce, separate fictional crop shares, price news, dividends, deliveries and farm upgrades |
| `/games/nightshift` | NIGHT SHIFT | Eight café shifts, recipes, timed brewing, guest patience, upgrades and endless service |
| `/games/switchyard` | SWITCHYARD | Six railway dispatch challenges, junctions, hold signals and endless dispatch |
| `/games/orbital` | ORBITAL | Twelve gravity missions with launch aiming, fuel and collectible shards |
| `/games/polarity` | POLARITY | Magnetic lane changes, obstacles and score chains |
| `/games/timeloop` | TIME LOOP | Twelve rooms with recorded echoes, pressure plates, gates and memories |
| `/games/deepdive` | DEEP DIVE | Underwater salvage, oxygen, sonar, cargo banking and upgrades |
| `/games/prism` | PRISM | Eighteen light labs with mirrors, RGB splitting/mixing and movable optics |
| `/games/botworks` | BOTWORKS | Ten factory blueprints with conveyors and ordered processors |
| `/games/drift` | AFTERDRIFT | Three drift circuits and a saved personal ghost |

All ten use the existing arcade kit for menus, pause, sound, settings, local saves and play counting. The games have no direct backend calls. The arcade now lists 39 games, with these ten featured and tagged New. Ratings, the picker, filters, owner catalog, review contexts, build entries, slash/non-slash routes and share pages include all ten.

HARVEST EXCHANGE's fictional economy is explicitly authorized by the owner's request, overriding the old blanket no-price-talk guideline for this game only. Its credits, crop shares, news and prices are local simulation data. No real assets, purchases, trading services or new server configuration are involved.

Every game has a silent six-second H.264 gameplay loop, 600px WebP tile image and 1200×630 JPEG share card. The arcade's overall share card shows 39 games. Capture recipes are in `tools/games/capture-previews.mjs`; cover generation is in `tools/games/covers.mjs`. Optional `PLAYWRIGHT_MODULE`, `CHROME_BIN` and `FFMPEG_BIN` paths support Windows. Capture folders are uniquely allocated and checked before cleanup.

Validation includes 88 new rule tests across the ten games, level-solvability and seeded autoplay checks, plus actual controls and completion at phone, landscape and desktop sizes. Browser checks found and fixed narrow HUDs, landscape title layouts, the farm chart's canvas positioning, periodic panel replacement, a title-screen save overwrite, focused-plot keyboard handling and one missing ratings-container closing tag. The farm's regression scenario preserves a saved day-14 farm when reopening and leaving its title screen.

Final release checks: **2,171 tests: 2,165 passed, six skipped, zero failures**; Vite build, share-page generation and secret scanning passed. All ten compiled games passed phone and desktop smoke checks (20 cases) under the production Content Security Policy, with no JavaScript errors, missing assets or CSP violations. The compiled farm also passed its save/input regression.

No database migration, package installation, new environment variable or paid service is required. Production publication is separate from the completed implementation; record the final deployed commit and verification here when published.
