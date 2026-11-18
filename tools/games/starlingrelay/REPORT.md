# Curtain Call verification

The original production build had six sets, one mode and 10,704 bytes across four JavaScript files. Its three sampled automated shows each finished in 37.67 seconds. The revised game has 42 hand-scored productions in five acts, 645 performed beats across all lighting plots, three modes, 32 event lines and ten JavaScript modules. It includes a browsable local playbill with scene stars, sellout stickers and rehearsals the player can save and play back.

## Choreography proofs

`node tools/games/starlingrelay/prove.mjs` reconstructs all 42 shortest scores and checks the stored witnesses against the player-facing interpreter. Every production has a minimum printed cost between 2 and 23 ink. The interval search evaluates single cues, every split, legal repeated phrases and reusable single-dance definitions. Complementary sun and moon rehearsals distinguish both outcomes of a conditional. The third lighting crew in Dress Run adds a different performance sequence. The focused test independently enumerates tiny score grammars, then checks legal calls, nesting, source tracking, expiry, occupancy, achievements and saves.

## Balance

`node tools/games/starlingrelay/balance.mjs` runs each director over all 42 scenes and 12 seeds. Each scene is offered independently. The whole-season durations add modeled reading and composition time to the actual number of rehearsal beats. Human completion time and retention were not measured.

| Director | Cleared | Median season | Scene seconds P50 / P90 | Score P10 / P50 / P90 | Ink over par P50 / P90 | Rejected wrong cue / full tray |
| --- | --- | --- | --- | --- | --- | --- |
| Newcomer | 432 / 504 | 48.5 min | 73 / 104 | 0 / 930 / 1020 | 0 / 2 | 253 / 424 |
| Regular | 504 / 504 | 33.8 min | 46 / 76 | 720 / 960 / 1060 | 0 / 1 | 73 / 63 |
| Expert | 504 / 504 | 20.9 min | 30 / 46 | 930 / 1000 / 1070 | 0 / 0 | 0 / 0 |

## Audio and displays

The stage has 13 synthesized effects and a pitched accompaniment scheduled on the arcade audio clock. `node tools/games/starlingrelay/mix.mjs <local-vite-origin>` renders the real nodes at 48 kHz. Stacked performance and editing cues produced a peak of 0.2293 (−12.79 dBFS), RMS 0.0177 and zero clipped samples out of 1,728,000 before the kit’s master compressor. The measurement covers browser audio output. Physical speakers and a listening panel were unavailable.

The first show starts with Step. Add Bow, run the show and file the playbill after the second beat. The normal route reached a nonzero end card at 360 × 640, 844 × 390, 884 × 1104, 1440 × 900 and 2560 × 1440. A later browser pass assembled Dance A and the branching Dress Run score through the real cue editor, advanced all three lighting plots, opened the collection and filed the result on phone, landscape and desktop emulation. No physical handset timing was measured.

`node --test tests/starlingrelay.test.js` covers eleven dedicated cases. [Phone](../remaster-evidence/starlingrelay-phone.jpg) · [Desktop](../remaster-evidence/starlingrelay-desktop.jpg)
