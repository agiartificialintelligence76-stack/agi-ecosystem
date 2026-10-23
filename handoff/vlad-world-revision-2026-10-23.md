# VLAD RUNNER 2049: story, world and challenge revision

The owner requested larger, interactive stages, a continuing story featuring both heroes, stronger background music and more challenging combat. This extends the previously published quality revision.

## Changes

- Districts are 5,000 / 5,200 / 5,400 world pixels, about 41% longer in total. Each has nine jumpable surfaces, six breakable supply objects, four timed hazards and elevated rewards. Camera layers scroll at different speeds; distant traffic, foreground fixtures and world-anchored road detail add motion.
- Physical elevation affects landings, attacks, projectiles and enemy pursuit. Enemies can hop obstacles, launch, fall, recover and flank. Normal attacks deal 16% more damage and have 15% shorter cooldowns; anticipation remains readable. Story assistance remains available.
- A dodge timed to an incoming hit grants 18 energy and a 3.5-second counter window. The next attack gets 50% extra damage. The HUD shows the counter window and district progress. Steam, solar vents and electrical hazards warn for 0.85 seconds before a 0.65-second burst; jumping or higher ground can avoid them.
- Original story scenes cover the opening diner raid, each district transition, all three boss confrontations and the ending. Both heroes appear throughout. Scenes wait for the player, support skipping and keyboard navigation, and pause the run clock. Holding Enter advances only one beat. Endless and daily runs start directly.
- Original 32-bar musical arrangement with district variation, melody, keys, bass and swung percussion; combat and boss layers enter on bar boundaries. Story has a softer arrangement. Existing saved volume choices are preserved.
- New diner scenery and the final image prompt are recorded in [the story art record](vlad-story-art-2026-10-23.md).

## Verification

- Full `npm run build`: **1,192 passed, 0 failed, 6 skipped**; production bundle, share pages and secret scan pass. Existing dynamic/static i18n import warning remains.
- Deterministic campaign tests complete all 12 encounters with either solo hero and both co-op starting arrangements. Platform landing/rejump/falling, elevation-aware combat, breakable support, hazards, counters, bounded flanking and recovery have focused tests.
- Local browser: all opening beats and skip, held-Enter guard, gameplay starting at 0:00, actual movement/scrolling and raised-stall jumping, combat launch reactions and four-hit combo (444 points), pause/resume/back-to-title and direct endless start. No browser warnings/errors.
- Story layout checked at 1280x720, 390x844 and 844x390; no horizontal overflow or clipped next button. Viewport override removed afterward.
- Actual renderer proof for all three districts and enemy reactions: ignored `node_modules/.cache/vlad-world-proof/` (three district PNGs, enemy-states.png, scroll-reactions.mp4).
- Audio rendered with Chrome OfflineAudioContext: full 80-second theme, story and maximum-volume mixes. No clipping; extreme crowd peak -0.75 dBFS. This verifies technical levels, not subjective listening quality. Audition files are in ignored `node_modules/.cache/vlad-audio/`.

## Limits

Legacy shield/ranger/boss art still has only two locomotion drawings, supplemented by articulation and distinct attack/recovery poses. This is not a claim of frame-for-frame animation parity with the reference game. Browser testing exercised the opening and first encounter; automated deterministic tests, rather than a complete manual playthrough, cover campaign completion. No backend, database, SSH, paid service or deployment-security changes are needed.
