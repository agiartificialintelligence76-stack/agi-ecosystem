# VLAD RUNNER 2049 combat preview — 2026-10-23

The owner rejected the published version's sound, stiff gameplay and animation. This revision is a separate preview for their review; production remains at 6f2f5a2. Do not describe it as matching or surpassing Fist Punch.

## Changes
- Eight-frame runs and twelve-frame jab/cross/kick sequences for each hero, with separate left-facing AGI artwork. Per-frame pelvis/floor anchors and a fixed anatomical scale preserve crouches and airborne poses.
- A twelve-frame common enforcer atlas adds running, attack anticipation/contact/recovery, recoil and landing.
- Buffered combos, separate attack windows, recovery dodge/jump cancels, quicker acceleration/braking, limited lane assistance, real contact hitstop, controlled lunges, enemy separation and bounded ranger retreat.
- Twenty-one local CC0 impact/foley WAVs (about 569 KB), varied layers, stereo positioning, restrained ambient score and music ducking. Pause, hidden-tab behavior, category volume and reverb obey settings.
- Sprite silhouettes are isolated and prepared before play to avoid first-use extraction work.

## Verification
- Full build on installed Node 24.21.0: 1,169 passed, zero failed, six skipped (1,175 total), Vite build and secret check passed. Local log: vlad-revision-build-verified.log.
- Initial sandboxed build could not run socket tests; rerun with local networking passed. No product workaround was introduced.
- Real browser opening encounters: VLAD and AGI tag, direction changes, combo, heavy, jump, dodge, two encounters cleared, score 4,115, 15-hit combo. No browser warning/error output.
- Offline native-canvas contact sheet and 120-frame animation proof checked actual shipped art; no clipped limbs or neighboring sprite fragments. Corrected AGI left-run letters retain anchors within one source pixel.
- Real Chrome OfflineAudioContext decoded all21 WAVs. Default mix peak -8.26dBFS typical / -3.12 stress; maximum sliders -3.39 typical / -0.64 stress; zero clipped samples in the measured16-second sequences. This is signal validation, not a subjective listening claim.
- Engine simulations complete normal campaigns for both solo characters and both co-op starting assignments. Physical controllers and a subjective human listening pass have not been performed this revision.

## Remaining quality limits
The three backgrounds remain static paintings. Rangers, shield enemies and bosses retain their earlier, smaller pose sets, and hero jump/special/hurt actions retain earlier drawings. The campaign still uses encounter arenas, rather than a fully authored platforming progression. This is a substantial combat preview, not evidence that the entire reference-quality gap is closed.

## Assets and sources
Artwork: public/images/vladrunner2049/*-run*.webp, *-combo*.webp and enforcer-motion.webp.
Full artwork directions: [prompt set](vlad-motion-prompts-2026-10-23.md).
Audio: [source credits](../public/audio/vladrunner2049/CREDITS.txt), with CC0 license included.
Local QA media: node_modules/.cache/vlad-animation-proof/contact.png and animation.mp4; node_modules/.cache/vlad-audio/audition.wav and mix-results.json. These generated QA outputs are ignored, not visitor assets.
