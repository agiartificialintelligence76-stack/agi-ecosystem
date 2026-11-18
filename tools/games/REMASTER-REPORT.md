# Arcade remaster release record

## Before the remaster

Production commit `84edf7b7a6efd0c3922e25aaedacb4173155b8ba` was the clean source for the audit. Each built entry ran in Chromium on a 360 × 640 phone viewport and a 1440 × 900 desktop viewport. The three demo durations below use the actual game model, fixed 1/120-second steps and seeds 7, 23 and 91. Code size counts JavaScript in the individual game directory, excluding binary assets and the shared kit. The sound column counts literally named shared presets only. All twenty had coverage through grouped suites but none had a dedicated test file. No game had a dedicated sound or dialogue module.

| Game | Existing ID | JS bytes | JS files | Baseline stages or rounds | Modes | Demo seconds for three seeds | Named presets | Phone field px | Desktop field px |
|---|---|---:|---:|---:|---:|---|---:|---:|---:|
| WINGWALK EXPRESS | cloudfoil | 11930 | 2 | 8 | 1 | 18.52, 18.42, 18.69 | 3 | 360 | 900 |
| CANDID CAMERA | mothlight | 16098 | 4 | 6 | 1 | 25.43, 26.43, 29.88 | 1 | 360 | 900 |
| HANDLE WITH CARE | waxworks | 8851 | 3 | 6 | 1 | 36.04, 36.04, 36.04 | 4 | 360 | 900 |
| DUET AFTER DARK | echoforge | 9252 | 2 | 5 | 1 | 41.57, 41.57, 41.57 | 5 | 360 | 900 |
| LAST TRAIN TO NOODLES | switchyard | 10601 | 2 | 5 | 1 | 20.03, 20.03, 20.03 | 3 | 360 | 900 |
| OFF THE RECORD | lanternlake | 14176 | 4 | 6 | 1 | 26.46, 26.46, 27.52 | 6 | 360 | 900 |
| AGI'S ALIBI | inkveil | 12979 | 3 | 5 | 1 | 27.20, 27.20, 27.20 | 5 | 360 | 900 |
| STICKER CLUB | nightpress | 10005 | 2 | 4 | 1 | 18.40, 18.40, 18.40 | 2 | 360 | 900 |
| MOONSHOT BILLIARDS | moonfreight | 11522 | 2 | 5 | 1 | 14.77, 14.77, 14.77 | 2 | 360 | 900 |
| SPLIT PERSONALITY | prismcourier | 10862 | 3 | 6 | 1 | 28.88, 28.88, 29.25 | 3 | 360 | 900 |
| CASSETTE BANDIT | driftglass | 12982 | 2 | 1 | 1 | 18.26, 16.63, 18.26 | 6 | 360 | 900 |
| BOBA BREAK | cloudkitchen | 9959 | 2 | 4 | 1 | 38.27, 38.27, 38.22 | 1 | 360 | 900 |
| NEEDLE DROP | returnaddress | 8036 | 3 | 4 | 1 | 43.23, 43.23, 43.23 | 3 | 360 | 900 |
| KEYBOARD CATNAP | rookery | 11123 | 3 | 6 | 1 | 35.66, 31.22, 33.95 | 4 | 360 | 900 |
| ABYSS FM | pearlshift | 9518 | 2 | 5 | 1 | 22.67, 22.67, 22.67 | 3 | 360 | 900 |
| WINDOW SEAT | pocketgrove | 11256 | 2 | 3 | 1 | 27.85, 27.85, 31.30 | 4 | 360 | 900 |
| SLINGSHOT GIRL | tetherturn | 14242 | 3 | 6 | 1 | 22.23, 22.23, 22.23 | 5 | 360 | 900 |
| CURTAIN CALL | starlingrelay | 10704 | 4 | 6 | 1 | 37.67, 37.67, 37.67 | 5 | 360 | 900 |
| CABLE CHOIR | summitline | 9697 | 2 | 6 | 1 | 41.11, 41.11, 41.11 | 3 | 360 | 900 |
| SIDE B | tidepool | 8089 | 2 | 6 | 1 | 13.25, 13.25, 13.25 | 0 | 360 | 900 |

The baseline is a deterministic demonstration, not an estimate of human play time. Real-device performance and subjective listening need separate observation. The Desktop checkout had unrelated edits and a zero-byte Git index lock. The release uses a separate branch from current GitHub main. The existing switchyard URL and ID are retained.
