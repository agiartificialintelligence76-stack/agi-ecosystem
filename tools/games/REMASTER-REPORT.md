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

## Music and listening

Source sizes exclude the shared kit, chart data, recordings and artwork. The test column counts named cases in each game's new dedicated suite. All five began with one mode and zero dedicated tests.

| Game | JS bytes before → after (files) | Content before → after | Modes after | Median seconds, beginner / steady / expert | AGI-1 lines | Dedicated tests | Screens |
|---|---:|---|---|---:|---:|---:|---|
| DUET AFTER DARK | 9,252 → 49,149 (11) | 5 short phrases → 7 originals, 380 call/answer pairs, 3 arrangements and 3 vocal parts | Setlist, chorus rehearsal, daily | 193 / 193 / 193 | 32 | 14 | [Phone](remaster-evidence/echoforge-phone.jpg) · [Desktop](remaster-evidence/echoforge-desktop.jpg) |
| NEEDLE DROP | 8,036 → 24,990 (8) | 4 short sides → 7 full sides, 3 cuts and 21 graded sleeves | Tour, practice, daily | 59 / 236 / 1,380 | 32 | 10 | [Phone](remaster-evidence/returnaddress-phone.jpg) · [Desktop](remaster-evidence/returnaddress-desktop.jpg) |
| CABLE CHOIR | 9,697 → 36,619 (10) | 6 concerts → 24 authored songs, 7 growing phrases per song, 8 stations and chords | Concert book, endless climb, daily | 64 / 147 / 266 | 32 | 12 | [Phone](remaster-evidence/summitline-phone.jpg) · [Desktop](remaster-evidence/summitline-desktop.jpg) |
| SIDE B | 8,089 → 55,723 (13) | 6 picks → 7 originals, 8 hosted broadcasts, 2 live decks, unlockable edits | Hosted series, endless late shift, daily | 157 / 296 / 450 | 43 | 20 | [Phone](remaster-evidence/tidepool-phone.jpg) · [Desktop](remaster-evidence/tidepool-desktop.jpg) |
| ABYSS FM | 9,518 → 44,568 (11) | 5 whales → 32 watches with moving pods, depth layers, stereo calls and a recording log | Calm survey, night shift, daily | 147 / 277 / 353 | 32 | 11 | [Phone](remaster-evidence/pearlshift-phone.jpg) · [Desktop](remaster-evidence/pearlshift-desktop.jpg) |

DUET AFTER DARK plays each chosen recording to its end. Median accuracy was 44%, 82% and 99%. NEEDLE DROP measures a full tour. The other three measure escalating modes. An expert completed a 24m14s concert book and a 22m27s calm survey. The eight hosted broadcasts took a representative steady DJ 21.8 minutes. The seven complete recordings in NEEDLE DROP and DUET AFTER DARK total 22m59s. These are simulations of the rules.

| Game | Originally named shared presets | Sound after | Peak or conservative upper bound, dBFS |
|---|---:|---|---:|
| DUET AFTER DARK | 5 | Full recordings, two voices, harmony, held notes, pitch audition, applause and stage cues | −0.37 |
| NEEDLE DROP | 3 | Full recordings, 10 wheel, pickup, scratch, rewind and finishing sounds | −0.45 |
| CABLE CHOIR | 3 | 4 cabin voices, bass accompaniment, baton tick and 5 performance cues | −13.43 |
| SIDE B | 0 | 2 record decks, headphone cues, fader automation, booth and crowd sounds | −4.61 |
| ABYSS FM | 3 | Stereo whale voices, ambient bed, sonar echoes, tuning and reporting cues | −12.70 |

The original-recording checks use decoded PCM with allowances for overlapping effects. The two synthesizers use browser OfflineAudioContext measurements. In a separate live browser check, NEEDLE DROP restarted its 199.56-second source at 4.008 seconds after a backspin and resumed at the same position after pausing. SIDE B completed touch and keyboard broadcasts, archived scores and stopped every source at sign-off. All five reached genuine result cards. The local built pages were exercised under the website's production Content Security Policy at 360×640, 740×360, 884×1104, 1440×900 and 2560×1440. Physical phones, sustained 60 fps on mid-range handset hardware and listening by ear remain unverified.

### Balance tool output

#### DUET AFTER DARK

```text
newcomer n=63 · song seconds P10/P50/P90 150/193/240 · accuracy P10/P50/P90 30/44/55% · score P10/P50/P90 5761/7693/10464 · breaks headliner miss (2012), studio miss (1305)
regular  n=63 · song seconds P10/P50/P90 150/193/240 · accuracy P10/P50/P90 64/82/87% · score P10/P50/P90 12499/16378/20426 · breaks headliner miss (714), headliner wrong (197)
expert   n=63 · song seconds P10/P50/P90 150/193/240 · accuracy P10/P50/P90 96/99/100% · score P10/P50/P90 22543/31696/41709 · breaks headliner wrong (20), soundcheck wrong (13)
A song lasts for its recording. Skill changes accuracy, streaks and grade. Seven full recordings total 22.99 minutes.
```

#### NEEDLE DROP

```text
newbie | 80 tours | median 59.4 s | p10–90 50.2–74.1 s | score p10–90 2475–4500 | miss · SI (It's Better) (11), miss · Send It (10)
steady | 80 tours | median 235.6 s | p10–90 131.2–711.3 s | score p10–90 15275–98125 | miss · Send It (18), miss · After AGI (15)
expert | 80 tours | median 1379.5 s | p10–90 1379.5–1379.5 s | score p10–90 356150–411175 | tour clear (80)
```

#### CABLE CHOIR

```text
newbie  time p10/50/90=47.6/63.5/80.0s  score p25/50/75=1277/1596/1889  longest p50=6  phrases p50=5  errors p50=3
steady  time p10/50/90=121.0/146.9/169.8s  score p25/50/75=4444/5143/5861  longest p50=12  phrases p50=11  errors p50=3
expert  time p10/50/90=239.8/266.2/290.2s  score p25/50/75=12444/13313/13983  longest p50=19  phrases p50=18  errors p50=3
```

#### SIDE B

```text
hosted  | newcomer  | median 81.5s | score 113..432 | mixes 4 | missed 2 | offbeat 2 | energy 2 | curve 0
hosted  | steady    | median 70.7s | score 260..985 | mixes 6 | missed 0 | offbeat 2 | energy 1 | curve 0
hosted  | expert    | median 70.0s | score 573..1082 | mixes 6 | missed 0 | offbeat 0 | energy 0 | curve 0
late    | newcomer  | median 157.2s | score 0..735 | mixes 5 | missed 2 | offbeat 3 | energy 2 | curve 2
late    | steady    | median 296.0s | score 601..3076 | mixes 14 | missed 1 | offbeat 6 | energy 3 | curve 2
late    | expert    | median 449.8s | score 3113..8229 | mixes 24 | missed 0 | offbeat 0 | energy 0 | curve 0
daily   | newcomer  | median 161.8s | score 140..560 | mixes 6 | missed 2 | offbeat 4 | energy 2 | curve 2
daily   | steady    | median 150.9s | score 406..1503 | mixes 7 | missed 1 | offbeat 3 | energy 1 | curve 1
daily   | expert    | median 147.5s | score 665..1640 | mixes 8 | missed 0 | offbeat 0 | energy 0 | curve 0
Hosted series, representative steady broadcasts: 77s, 115s, 147s, 164s, 176s, 196s, 219s, 212s; 21.8 minutes.
```

#### ABYSS FM

```text
newbie  time p10/50/90=75.6/147.1/171.6s  score p25/50/75=1408/2496/2955  fixes=7  pings=18  misses=5  exact=1
steady  time p10/50/90=249.6/276.6/302.3s  score p25/50/75=6468/6819/7436  fixes=18  pings=39  misses=2  exact=7
expert  time p10/50/90=321.6/352.6/365.3s  score p25/50/75=12698/13233/13662  fixes=32  pings=67  misses=0  exact=24
```

### Clean release verification

Node 24.21.0, UTC, fresh checkout and locked dependencies. The production command finished with 2,274 passing tests, six existing skips and zero failures. All five routes passed the production CSP in the local build. All 25 game and viewport combinations passed the control-size and layout checks, and all ten full phone and desktop runs reached results, paused, resumed and replayed successfully.

The signed-in project preview passed interactive checks for all five games, including a 122-point Cable Choir phrase and an actual Side B mix. Production commit `83ff7f1` went live. The five public pages returned HTTP 200, matched the clean build’s game entry files, rendered moving playfields and served the new poster, clip and share card. [Music release](https://github.com/agiartificialintelligence76-stack/agi-ecosystem/commit/83ff7f199c10891d0f23ed012f235a49033b3f4a)

## Grid puzzles

The five games contain 205 authored puzzles. Every advertised par comes from the corresponding game’s complete rules. The times below model a full book, season or shift, including the simulated player’s decision time. They are estimates, not timed human sessions. All five previously had one mode and zero dedicated suites.

| Game | JS bytes before → after (files) | Content and modes | Modeled times, beginner / steady / expert | Lines | Dedicated tests | Screens |
|---|---:|---|---|---:|---:|---|
| HANDLE WITH CARE | 8,851 → 55,401 (9) | 6 depots → 42 authored depots in 5 worlds. Depot ledger, daily dispatch and practice shift. | 75.0 / 30.1 / 8.7 min | 36 | 13 | [Phone](remaster-evidence/waxworks-phone.jpg) · [Desktop](remaster-evidence/waxworks-desktop.jpg) |
| LAST TRAIN TO NOODLES | 10,601 → 70,183 (12) | 5 bowls → 36 yards, ordered cars, two kitchens and 144 mirrored certificates. Station pass, daily dish and replay. | 56.8 / 36.2 / 13.2 min | 44 | 15 | [Phone](remaster-evidence/switchyard-phone.jpg) · [Desktop](remaster-evidence/switchyard-desktop.jpg) |
| SPLIT PERSONALITY | 10,862 → 33,900 (11) | 6 mazes → 40 paired chambers, 5 rule galleries and 120 stars. Gallery, daily mirror and studio. | 62.9 / 31.9 / 14.9 min | 32 | 12 | [Phone](remaster-evidence/prismcourier-phone.jpg) · [Desktop](remaster-evidence/prismcourier-desktop.jpg) |
| KEYBOARD CATNAP | 11,123 → 60,027 (13) | 6 desks → 45 naps, 135 stars, 6 cat poses and saved replays. Bedtime Story, Daily Cat and Cat Journal. | 70 / 43 / 13 min | 45 | 23 | [Phone](remaster-evidence/rookery-phone.jpg) · [Desktop](remaster-evidence/rookery-desktop.jpg) |
| CURTAIN CALL | 10,704 → 66,631 (10) | 6 sets → 42 productions, 5 acts and 645 scored performance beats. Story season, daily matinée and free rehearsal. | 48.5 / 33.8 / 20.9 min | 32 | 11 | [Phone](remaster-evidence/starlingrelay-phone.jpg) · [Desktop](remaster-evidence/starlingrelay-desktop.jpg) |

| Game | Previous named shared effects | Sound after | Measured peak |
|---|---:|---|---:|
| HANDLE WITH CARE | 4 | 14 foley families for box landings, packing surfaces, breakage, stamp, conveyor, split and delivery. | −13.80 dBFS |
| LAST TRAIN TO NOODLES | 3 | 12 rail cues including coupling, engine, switch, turntable, serving bell, steam and station whistle. | −7.52 dBFS |
| SPLIT PERSONALITY | 3 | 16 stereo motifs for footfalls, stopped shoes, queued steps, ice slides, relays, signatures and two-part reunions. | −17.88 dBFS |
| KEYBOARD CATNAP | 4 | 16 measured cue combinations including five cap materials, paw steps, a purr, shut-eye, gaze, laser and paper feed. | −18.31 dBFS |
| CURTAIN CALL | 5 | 13 stage cue families and synthesized pit accompaniment, including spotlight, curtain and applause. | −12.79 dBFS |

### Balance tool output

#### HANDLE WITH CARE

```text
42 authored depots · five worlds · shortest routes 2–18 rolls.
12 seeded shifts per crew. Time includes modeled thinking, physical inputs, route checks and corrections. Every intermediate footprint uses the production reducer.
newcomer · solved 504/504 · season median 75.0 min · depot P50/P90 96/187 s · actions 18/39 · score P10/50/90 322/394/798 · edges/undo/hints 1756/985/792 · median world min 9.9/10.6/8.0/21.7/24.8
regular · solved 504/504 · season median 30.1 min · depot P50/P90 40/73 s · actions 12/22 · score P10/50/90 346/644/870 · edges/undo/hints 449/217/217 · median world min 4.0/4.5/3.7/8.1/9.8
expert · solved 504/504 · season median 8.7 min · depot P50/P90 11/18 s · actions 8/15 · score P10/50/90 798/846/930 · edges/undo/hints 0/0/0 · median world min 1.2/1.4/1.2/2.1/2.7
```

#### LAST TRAIN TO NOODLES

```text
36 certified yards per simulated shift. Time includes persona decision and ticket-reading time.
newbie · minutes p10/50/90 54.9/56.8/58.5 · score p25/50/75 17977/18145/18304 · buffer stops 72 · undone dead ends 20 · wrong-order window arrivals 17 · extra coupler changes 114 · exact yards 1/36 · most trouble Last Orders (1321 errors across 64 shifts)
  line action p25/50/75 and median yard seconds: Steam Counter 12/15/20 (68s) · Siding Street 18/21/24 (90s) · One-way Line 16/20/24 (92s) · Roundhouse 18/22/26 (95s) · Twin Kitchens 15/21/28 (95s) · Last Orders 23/28/32 (124s)
steady · minutes p10/50/90 35.2/36.2/37.2 · score p25/50/75 21219/21509/21659 · buffer stops 25 · undone dead ends 7 · wrong-order window arrivals 13 · extra coupler changes 36 · exact yards 9/36 · most trouble Last Orders (452 errors across 64 shifts)
  line action p25/50/75 and median yard seconds: Steam Counter 9/12/15 (43s) · Siding Street 13/15/19 (56s) · One-way Line 12/15/17 (58s) · Roundhouse 14/16/20 (60s) · Twin Kitchens 12/15/22 (60s) · Last Orders 17/20/25 (78s)
expert · minutes p10/50/90 12.9/13.2/13.4 · score p25/50/75 24062/24310/24652 · buffer stops 3 · undone dead ends 0 · wrong-order window arrivals 11 · extra coupler changes 6 · exact yards 30/36 · most trouble Last Orders (54 errors across 64 shifts)
  line action p25/50/75 and median yard seconds: Steam Counter 9/10/13 (15s) · Siding Street 12/13/16 (20s) · One-way Line 12/13/15 (21s) · Roundhouse 12/14/16 (22s) · Twin Kitchens 10/13/20 (21s) · Last Orders 15/18/21 (28s)
```

#### SPLIT PERSONALITY

```text
firstVisit | 12 seeded tours | median 62.9 min | score p10–90 11691–12791 | gold 11/40 | 145 detours, 59 undos | stalls none
steady | 12 seeded tours | median 31.9 min | score p10–90 15291–16091 | gold 27/40 | 58 detours, 42 undos | stalls none
expert | 12 seeded tours | median 14.9 min | score p10–90 16391–16791 | gold 35/40 | 9 detours, 3 undos | stalls none
```

#### KEYBOARD CATNAP

```text
nudge · book 70 min · nap 88s / 16 decisions · score 805 [468–1537] · 135/135 solved, 14 unaided · 85 blocked calls, 68 corner pushes, 9 idle dot changes, 121 rescues
lookahead · book 43 min · nap 45s / 12 decisions · score 883 [476–1416] · 135/135 solved, 99 unaided · 0 blocked calls, 57 corner pushes, 129 idle dot changes, 36 rescues
shortest · book 13 min · nap 16s / 11 decisions · score 1008 [728–1792] · 135/135 solved, 135 unaided · 0 blocked calls, 51 corner pushes, 6 idle dot changes, 0 rescues
```

#### CURTAIN CALL

```text
42 authored productions · five acts · total scored beats 645 · exact printed-ink range 2–23
All 42 scenes offered independently to each director, 12 seeds. Times model reading, composition, repairs and real beat playback.
newcomer · solved 432/504 · season median 48.5 min · scene P50/P90 73/104 s · score P10/50/90 0/930/1020 · attempts 2 · ink above par P50/P90 0/2 · rejected timing/ink 253/424
regular · solved 504/504 · season median 33.8 min · scene P50/P90 46/76 s · score P10/50/90 720/960/1060 · attempts 1 · ink above par P50/P90 0/1 · rejected timing/ink 73/63
expert · solved 504/504 · season median 20.9 min · scene P50/P90 30/46 s · score P10/50/90 930/1000/1070 · attempts 1 · ink above par P50/P90 0/0 · rejected timing/ink 0/0
```

Grid release verification used a clean Node 24 build in UTC. The full suite passed 2,337 tests with six existing skips. On the built pages all five games started, accepted input and reached scored results on phone and desktop. Pause, resume and replay worked. The sideways phone, foldable and large desktop checks found no layout or CSP violations across the five games. The linked contact sheets show the actual title, play and result screens.

Vercel published the grid batch at revision b920cfe. Each hosted preview accepted its opening solution or stage program. All five public pages subsequently matched the clean build and returned their new playable field, tile clip, poster and share card. A separate 20-minute real-time browser run completed 29 distinct Catnap puzzles and entered number 30 at 19:22.

## Physics and action

Each game uses its own physical rules. The browser checks used an actual leap, bank shot, orbit capture, tape steal and archive exit. Times below are simulated run medians, except where a campaign estimate is explicitly labeled. The visual checks used desktop Chrome at five viewport sizes. A physical device and listening review were unavailable.

| Game | JS bytes before → after (files) | Content and modes | Modeled times, beginner / steady / expert | Lines | Dedicated tests | Screens |
|---|---:|---|---|---:|---:|---|
| WINGWALK EXPRESS | 11,930 → 36,025 (10) | 8 leaps → 18 named round trips with 397 handoffs across 6 districts, Red-eye nonstop and Daily Airbill. | 59 / 178 / 468 s nonstop. Post Run modeled at 59 / 30 / 23 min. | 34 | 14 | [Phone](remaster-evidence/cloudfoil-phone.jpg) · [Desktop](remaster-evidence/cloudfoil-desktop.jpg) |
| MOONSHOT BILLIARDS | 11,522 → 66,999 (10) | 5 single shots → 36 trick tables, 18 conditions on the AI ladder, daily three-rack match and House Run. | 73 / 162 / 570 s in House Run. | 34 | 13 | [Phone](remaster-evidence/moonfreight-phone.jpg) · [Desktop](remaster-evidence/moonfreight-desktop.jpg) |
| SLINGSHOT GIRL | 14,242 → 51,318 (8) | 6 circuits → 36 tour flags, 144 certified variations, Daily Nine, Comet Carry and personal flight ghosts. | 85 / 227 / 329 s in Comet Carry. Tour modeled at 41 / 22.5 / 12 min. | 34 | 13 | [Phone](remaster-evidence/tetherturn-phone.jpg) · [Desktop](remaster-evidence/tetherturn-desktop.jpg) |
| CASSETTE BANDIT | 12,982 → 62,733 (12) | 1 race → 12 championship matches against 6 driving personalities, Radio Check, Marathon, Daily Rival and Local Duet. | 87 / 210 / 455 s in Marathon Radio. | 68 | 22 | [Phone](remaster-evidence/driftglass-phone.jpg) · [Desktop](remaster-evidence/driftglass-desktop.jpg) |
| AGI'S ALIBI | 12,979 → 93,983 (14) | 5 tape loops → 36 authored archives with quiet and unrestricted par, Daily and three-alert Noir. 256 variants solver-checked. | 110 / 226 / 312 s in Noir. Campaign modeled at 70.3 / 24.8 / 20.3 min. | 34 | 14 | [Phone](remaster-evidence/inkveil-phone.jpg) · [Desktop](remaster-evidence/inkveil-desktop.jpg) |

| Game | Previous named shared effects | Sound after | Measured peak |
|---|---:|---|---:|
| WINGWALK EXPRESS | 3 | 18 event motifs and an engine that follows takeoff charge. | −16.42 dBFS |
| MOONSHOT BILLIARDS | 2 | 10 original cues including collision-speed clacks, cushions, scratch, pocket, roll and gravity wells. | -10.69 dBFS |
| SLINGSHOT GIRL | 5 | 12 capsule-radio voices for burns, gravity changes, rings, captures and scorecards. | -14.67 dBFS |
| CASSETTE BANDIT | 6 | 22 cues from cassette gates and broadcast jingles to the two-car contest for possession. | −8.53 dBFS |
| AGI'S ALIBI | 5 | 15 tape, floor and patrol sounds and an adaptive tension bed. | −17.16 dBFS |

### Balance tool output

#### WINGWALK EXPRESS

```text
18 individually scored round trips, 397 outbound and return handoffs, six districts.
newbie · 64 red-eye runs · median 59s · handoffs 8 · score P10/50/90 376/956/1491 · chute openings {"long":85,"lane":57,"short":50}
  campaign pace 59.4 min extrapolated at measured seconds per handoff · clean single-flight cards 0/18
steady · 64 red-eye runs · median 178s · handoffs 38 · score P10/50/90 3743/5692/7537 · chute openings {"long":119,"short":58,"lane":13,"late":2}
  campaign pace 30.0 min extrapolated at measured seconds per handoff · clean single-flight cards 14/18
expert · 64 red-eye runs · median 468s · handoffs 135 · score P10/50/90 16609/45303/86670 · chute openings {"long":120,"short":57,"lane":15}
  campaign pace 23.0 min extrapolated at measured seconds per handoff · clean single-flight cards 18/18
```

#### MOONSHOT BILLIARDS

```text
newbie · seconds p10/50/90 59.8/71.8/88.4 · score p25/50/75 153/177/225 · first contact 67% · legal pots/stroke 0.17 · scratches/rack 0.45 · empty innings 5 · average leave 221 felt units · scored banks 0
steady · seconds p10/50/90 73.2/158.4/344.4 · score p25/50/75 378/1213/2058 · first contact 92% · legal pots/stroke 0.36 · scratches/rack 0.19 · empty innings 8 · average leave 198 felt units · scored banks 13
expert · seconds p10/50/90 117.7/552.4/1491.0 · score p25/50/75 1189/13497/18033 · first contact 92% · legal pots/stroke 0.60 · scratches/rack 0.07 · empty innings 20 · average leave 191 felt units · scored banks 140
```

#### SLINGSHOT GIRL

```text
newbie · seconds p10/50/90 71.9/84.8/109.0 · score p25/50/75 684/999/1389 · flags 3 · strokes 7 · rings 3 · recoveries 4 · fast/field/rim events 18/14/0 · full-tour median 41.0min
steady · seconds p10/50/90 139.3/227.0/314.0 · score p25/50/75 2002/3149/3918 · flags 8 · strokes 12 · rings 14 · recoveries 2 · fast/field/rim events 14/12/0 · full-tour median 22.5min
expert · seconds p10/50/90 187.9/329.1/498.8 · score p25/50/75 4565/7306/11236 · flags 17 · strokes 22 · rings 39 · recoveries 1 · fast/field/rim events 11/5/0 · full-tour median 12.1min
```

#### CASSETTE BANDIT

```text
novice · marathon 64/87/103s (P10/M/P90) · score 288/395/600 (Q1/M/Q3) · 16% airtime · steals 2/15, jams 0/0, 1 boosts, 3 crashes · 30s/round · ladder wins 0/64–0/64 · roadworks/BRIDGE 31
steady · marathon 119/210/301s (P10/M/P90) · score 1906/2838/3674 (Q1/M/Q3) · 59% airtime · steals 7/33, jams 8/9, 2 boosts, 9 crashes · 37s/round · ladder wins 44/64–30/64 · roadworks/ANTENNA 13
expert · marathon 307/455/572s (P10/M/P90) · score 6288/7660/8714 (Q1/M/Q3) · 82% airtime · steals 18/41, jams 17/19, 2 boosts, 12 crashes · 33s/round · ladder wins 64/64–64/64 · roadworks/ANTENNA 19
```

#### AGI'S ALIBI

```text
36 exhibits, 256 contracts. Both clean pars (5–16) and the unrestricted shortest exits are proved. Model times include inspection, committed footwork, aiming and recovery.
newcomer campaign · 392/432 exits · whole archive P50 70.3 min · median beats over clean par 4 · first/finale unassisted quiet 12/12, 0/12 · hints 65
newcomer Noir · time P10/50/90 43/110/187 s · median cases/turns 1/33 · score P10/50/90 0/1232/3759 · throws/diversions 88/87 · sightings patrol/camera 108/0 · footsteps heard/hood beats 38/0 · budget exhausted 36/36
regular campaign · 432/432 exits · whole archive P50 24.8 min · median beats over clean par 0 · first/finale unassisted quiet 12/12, 1/12 · hints 2
regular Noir · time P10/50/90 104/226/306 s · median cases/turns 6/73 · score P10/50/90 2264/5992/9555 · throws/diversions 265/257 · sightings patrol/camera 91/17 · footsteps heard/hood beats 44/2 · budget exhausted 36/36
expert campaign · 432/432 exits · whole archive P50 20.3 min · median beats over clean par 0 · first/finale unassisted quiet 12/12, 8/12 · hints 1
expert Noir · time P10/50/90 211/312/491 s · median cases/turns 10/120 · score P10/50/90 7957/10084/15982 · throws/diversions 543/518 · sightings patrol/camera 90/18 · footsteps heard/hood beats 34/19 · budget exhausted 36/36
```

The clean Node 24 UTC release passed 2,401 tests with six existing skips. All five titles reached nonzero scored endings on both a phone and a desktop and replayed. All 25 viewport checks passed the production CSP and the touch-control size checks. Cassette Bandit’s separate Radio Check was also won 18–2 by touch. The final championship rival changed possession 14 times in the median steady match, above the seven-change design target.
