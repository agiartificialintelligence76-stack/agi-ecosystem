# Handle With Care verification

The original build had six depots, one mode and 8,851 bytes across three JavaScript files. Its three sampled automated shifts each finished in 36.04 seconds. The revised game has 42 distinct handmade shipping floors in five worlds, three modes, nine JavaScript modules, a literal floor catalog, 36 event lines and a local routing ledger with five collectible emblems.

## Depot proofs

`node tools/games/waxworks/bake.mjs` carves the individually written shipping plans into literal floors, checks the original route, and writes the shortest witness and complete smaller-depth frontier counts for every depot. The shipping reducer handles standing and flat footprints, individually broken panes, postage, forced belt travel, paired chutes and two independently selected parcels that bind only at the correct seam. The shortest routes take 2–18 actions. The dedicated test reconstructs every frontier with separate layer enumeration. It checks that a taught floor material participates in each applicable shortest witness. Each seeded daily rotation and pallet change goes through the same solver before play.

## Balance

`node tools/games/waxworks/balance.mjs` runs 12 seeded shifts for each crew across all 42 floors. All three crews can consult hints and undo, so solve rates include recovered errors. The expert uses a certified shortest route. The regular and newcomer still pay for out-and-back rolls left on the receipt. Time includes simulated inspection and correction. Human completion time and retention were not measured.

| Crew | Delivered | Median shift | Depot seconds P50 / P90 | Input actions P50 / P90 | Score P10 / P50 / P90 | Edge checks / undo / hints |
| --- | --- | --- | --- | --- | --- | --- |
| Newcomer | 504 / 504 | 75.0 min | 96 / 187 | 18 / 39 | 322 / 394 / 798 | 1756 / 985 / 792 |
| Regular | 504 / 504 | 30.1 min | 40 / 73 | 12 / 22 | 346 / 644 / 870 | 449 / 217 / 217 |
| Expert | 504 / 504 | 8.7 min | 11 / 18 | 8 / 15 | 798 / 846 / 930 | 0 / 0 / 0 |

## Audio and displays

Each action uses one of 14 family-specific synthesized effects. `node tools/games/waxworks/mix.mjs <local-vite-origin>` rendered the actual nodes at 48 kHz with quick rolls, repeated events and coincident stamps and fanfares. Peak output was 0.2042 (−13.80 dBFS), RMS 0.0154 and zero clipped samples out of 1,728,000 before the master compressor. Physical speakers and a listening panel were unavailable.

For the first signed receipt, roll east twice and choose File receipt. Normal input and the nonzero result worked at 360 × 640, 844 × 390, 884 × 1104, 1440 × 900 and 2560 × 1440 in Chrome. A separate pass entered the later Half Speed floor, opened the ledger and footprint tools, split the parcel, selected the other half, used the belt, bound the seam and filed the result at phone, landscape and desktop sizes. Physical handset timing was unavailable.

`node --test tests/waxworks.test.js` covers thirteen dedicated cases. [Phone](../remaster-evidence/waxworks-phone.jpg) · [Desktop](../remaster-evidence/waxworks-desktop.jpg)
