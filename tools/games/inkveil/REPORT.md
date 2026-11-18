# AGI's Alibi verification

The former five-room tape-loop campaign had 12,979 bytes of JavaScript in three files. Its automated run lasted 27.20 seconds at each sampled seed. The new game uses a real audible object to change the toy archive docents’ behavior while AGI-1 moves. It contains 36 different authored rooms across six wings, two selectable sounds, 34 event lines, 36 written diary entries and six illustrated collectibles. Campaign, Film Noir and Daily Dossier have independent records.

## Proofs

`node tools/games/inkveil/prove.mjs` reconstructs both the exact shortest quiet route and the unrestricted shortest escape for every campaign room. A* uses the least possible walking distance to collect all remaining pages with all doors open and all observers removed. The verifier rejects every bound below each claimed par. Independent breadth-first search also checks small rooms in the focused test. All 256 signed contract variants replay through the same production guards, camera phases, pickup and acoustic rules. Quiet pars range from 5–16 turns. Removing the tape makes 25 rooms impossible to clear silently and strictly increases quiet par in another five.

## Balance

`node tools/games/inkveil/balance.mjs` plays all cases with three decision policies over twelve seeds and then plays 36 Film Noir shifts per policy. Thinking time, reading and physical inputs are modeled. These figures do not measure human completion time or retention. Film Noir keeps one three-alert budget across contracts.

| Player | Campaign exits | Whole campaign P50 | First / last case, quiet without help | Noir seconds P10 / P50 / P90 | Noir cases / turns P50 | Noir score P10 / P50 / P90 |
| --- | --- | --- | --- | --- | --- | --- |
| Newcomer | 392 / 432 | 70.3 min | 12 / 12 · 0 / 12 | 43 / 110 / 187 | 1 / 33 | 0 / 1232 / 3759 |
| Regular | 432 / 432 | 24.8 min | 12 / 12 · 1 / 12 | 104 / 226 / 306 | 6 / 73 | 2264 / 5992 / 9555 |
| Expert | 432 / 432 | 20.3 min | 12 / 12 · 8 / 12 | 211 / 312 / 491 | 10 / 120 | 7957 / 10084 / 15982 |

All simulated Noir sessions ended through three actual alerts. In the 36 shifts the newcomer, regular and expert threw 88, 265 and 543 tapes and generated 87, 257 and 518 initial guard diversions. The newcomer median ran ten seconds over the brief’s target range; the expert median finished eight seconds under. The regular median fell within its target.

## Input, rendering and sound

One normal opening route is Wait, Aim tape, Throw at the selected position three tiles east, East, East, South, East, South, File dossier. This reaches a 1,036-point, seven-beat result. The first room, aim cancellation, pause, completed route trace, local journal and score screen were exercised in Chrome at 360 × 640, 844 × 390, 884 × 1104, 1440 × 900 and 2560 × 1440. The smallest touch control was 44 pixels high.

`node tools/games/inkveil/mix.mjs <local-vite-origin>` rendered the actual stereo nodes at 48 kHz with repeated hard soles, dropped keys, page turns, footsteps, exposure cues and a scheduled tension pulse. The 3,456,000 samples peaked at 0.1386 (−17.16 dBFS), with RMS of 0.0103 and zero clips before the arcade master compressor. The game has fifteen distinct effect families alongside its adaptive pulse. Physical handsets, speakers and headphone listening were unavailable.

`node --test tests/inkveil.test.js` exercises fourteen dedicated checks. [Phone](../remaster-evidence/inkveil-phone.jpg) · [Desktop](../remaster-evidence/inkveil-desktop.jpg)
