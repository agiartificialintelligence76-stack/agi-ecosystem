# OFF THE RECORD

Eighteen neighborhood mysteries unfold over seven late-night broadcasts. Mina hears the missing station ident in Monday’s doorway. By Sunday, three separate corrections establish how the neighbors supplied its last note. The player marks a particular statement, asks for more detail, inspects a physical exhibit, and puts a contradictory fact on air. The old account stays in the producer’s book alongside the caller’s correction.

## Inventory and replay

- 37 mandatory edits, 55 physical exhibits, 17 reverse-side comparisons and 77 individually written explanations for tempting exhibits that can coexist with the marked false claim.
- 41 event-driven AGI-1 lines in `lines.js`. The host reacts to a marked sentence, a correction, the listener lamps, the current caller, a recovery or the night’s particular clue.
- Story Week opens each new episode after filing the previous broadcast. Rehearsal opens all 18 episodes with topic cues. Daily Rebroadcast pins three different unlocked episodes for the UTC date. The first three are also available to new producers in Daily. Both exhibit order and transcript order vary.
- Three seals per show. A completed show earns one. A case completed without rehearsal earns the second. A clean broadcast with a relevant follow-up earns the third. The local book keeps corrected quotations, named failed pairings, surviving listeners, 18 follow-up letters, clean streak, practice and daily records. Replaying a run retains its cases.
- A code-drawn radio booth has an animated night shift, VU needle, working reels, moving host, four listener lamps and physical exhibit inserts. The reporter has golden hair, amber eyes, a cushioned headset and an AGI-1 lapel pass. The exhibit drawer switches between ink, glass, tape, paw prints, clock faces, faders and the other props as the player investigates.
- An exhibit’s spoken facts are available as text. The stereo clues have labeled traces and captions. Claim selection, follow-up, comparison, undo, redo, chronology and sign-off are available through native controls. Q asks a question. P retains the arcade’s pause behavior.

## Content and browser verification

The dedicated suite executes 912 combinations of active quotation, physical exhibit, follow-up state and inspection state. An independent enumeration requires exactly one refuting pair per edit. Additional cases cover the complete week, third-stage finale, redo, recovery, rehearsal, reordered daily material, stable replay, saving, fallback input and a real cat-call demo. Thirteen dedicated tests and the collection’s legacy gameplay smoke passed. The checker accepts neither an unrelated fact nor a compatible value of a shared fact as a refutation.

A separate reader reviewed the Monday bell and Wednesday cat cases before release. They identified the removed clapper and continuously muted fader as physical contradictions, and recognized the coat ticket as compatible with multiple sound sources. The protected camera’s shield test distinguishes the reflected collar image from a separate animal inside the booth. The writing pass also corrected four instances of witnesses referring to themselves in the third person and separated the room mic from the tape channel in the finale.

Real Chromium checks used 360×640, 844×390, 884×1104, 1440×900 and 2560×1440 layouts. A clean Monday reached 830 points with three seals. One unsupported pairing followed by a listener recovery earned 740. Pause and resume preserved the amended recording. All tested controls were at least 44 CSS pixels high. Additional reduced-motion runs played the three-finding Sunday rehearsal and the entire three-show daily using keyboard comparison, undo, redo and sign-off. The silent preview reaches the reverse of the Wednesday paw-print exhibit at 6.3 seconds and airs the caller’s correction at 9 seconds.

The pilot’s shortest normal route is the brass-bell statement, **Loose clapper**, **Put proof on air**, **Take the next account**, the live-mic statement, **Fader strip**, **Put proof on air**, **File this broadcast**, then **Sign off**. Asking for detail on either marked statement raises a clean score from 740 to 830.

## Sound and tempo

The desk uses 24 locally synthesized cue recipes plus a low two-note station bed. New callers transpose their pickup chime by night. The ident spaces its notes by 180 milliseconds. The slate repeats a clap at 200 and 400 milliseconds. The window comparison places a breathing voice on the left and a continuously rising voice on the right. The independent reel and room channels split the last note in stereo. Spoken reading has no metronome or deadline.

A 42-second, stereo, 48 kHz offline browser render exercised every cue, all seven bed transpositions and overlapping edits, replay and sign-off. Across **4,032,000 PCM samples**, the left peak was **0.11332**, the right peak was **0.10361**, the overall peak was **−18.91 dBFS**, RMS was **0.01276** and no samples clipped. The fixture bypasses master attenuation. Run `node tools/games/lanternlake/mix.mjs <local-site>` with Playwright and Chrome available to repeat it.

## Balance

Each policy played all 18 episodes for 48 seeded orderings, totaling 2,592 completed broadcasts. The runs exercise the live reducer, including compatibility explanations, listener recovery and rehearsal. Times combine the words each policy read with its per-action decision time. These are simulated reading times. They do not measure human completion rates.

The modeled new listener filed 97.9% of pilot broadcasts without forced rehearsal. The steady producer kept a clean two-edit show 73.5% of the time, and the experienced producer did so 96.1% of the time. Median weekly scores were 13,340, 14,490 and 15,010. The three-finding finale takes longer than the typical episode, particularly for a new listener who opens every card and presses both claims.

### Measured simulator output

```text
48 seeded exhibit and testimony orderings per 18-case week, per policy. Times model words actually read plus per-decision time.

New listener: 3.57 min/case, 64.3 min/week, pilot unaided 97.9%, clean two-edit 32.6%, assisted 1.2%, 1.31 lost lights/case.
Weekly score P10 / median / P90: 12830 / 13340 / 13760
Case | edits | seconds | lost lights | rehearsal %
01   | 2     | 192      | 1.17        | 2.1
02   | 2     | 202      | 1.35        | 2.1
03   | 2     | 184      | 1.35        | 0.0
04   | 2     | 189      | 1.27        | 0.0
05   | 2     | 198      | 1.15        | 0.0
06   | 2     | 192      | 1.02        | 2.1
07   | 2     | 246      | 1.44        | 0.0
08   | 2     | 201      | 1.56        | 4.2
09   | 2     | 187      | 1.27        | 2.1
10   | 2     | 216      | 1.35        | 0.0
11   | 2     | 208      | 1.31        | 2.1
12   | 2     | 214      | 1.29        | 4.2
13   | 2     | 199      | 1.29        | 0.0
14   | 2     | 205      | 1.33        | 0.0
15   | 2     | 214      | 1.52        | 0.0
16   | 2     | 211      | 1.06        | 0.0
17   | 2     | 215      | 1.33        | 0.0
18   | 3     | 389      | 1.52        | 2.1

Steady producer: 2.44 min/case, 43.9 min/week, pilot unaided 100.0%, clean two-edit 73.5%, assisted 0.0%, 0.30 lost lights/case.
Weekly score P10 / median / P90: 14190 / 14490 / 14750
Case | edits | seconds | lost lights | rehearsal %
01   | 2     | 127      | 0.17        | 0.0
02   | 2     | 134      | 0.33        | 0.0
03   | 2     | 121      | 0.33        | 0.0
04   | 2     | 129      | 0.31        | 0.0
05   | 2     | 134      | 0.31        | 0.0
06   | 2     | 132      | 0.21        | 0.0
07   | 2     | 171      | 0.33        | 0.0
08   | 2     | 130      | 0.19        | 0.0
09   | 2     | 126      | 0.29        | 0.0
10   | 2     | 150      | 0.25        | 0.0
11   | 2     | 142      | 0.27        | 0.0
12   | 2     | 145      | 0.29        | 0.0
13   | 2     | 139      | 0.48        | 0.0
14   | 2     | 138      | 0.33        | 0.0
15   | 2     | 145      | 0.29        | 0.0
16   | 2     | 148      | 0.27        | 0.0
17   | 2     | 148      | 0.25        | 0.0
18   | 3     | 274      | 0.50        | 0.0

Veteran editor: 1.95 min/case, 35.0 min/week, pilot unaided 100.0%, clean two-edit 96.1%, assisted 0.0%, 0.04 lost lights/case.
Weekly score P10 / median / P90: 14880 / 15010 / 15140
Case | edits | seconds | lost lights | rehearsal %
01   | 2     | 104      | 0.02        | 0.0
02   | 2     | 107      | 0.10        | 0.0
03   | 2     | 97      | 0.02        | 0.0
04   | 2     | 103      | 0.08        | 0.0
05   | 2     | 107      | 0.04        | 0.0
06   | 2     | 106      | 0.02        | 0.0
07   | 2     | 137      | 0.06        | 0.0
08   | 2     | 104      | 0.00        | 0.0
09   | 2     | 103      | 0.00        | 0.0
10   | 2     | 120      | 0.08        | 0.0
11   | 2     | 114      | 0.02        | 0.0
12   | 2     | 117      | 0.04        | 0.0
13   | 2     | 109      | 0.08        | 0.0
14   | 2     | 110      | 0.04        | 0.0
15   | 2     | 115      | 0.04        | 0.0
16   | 2     | 119      | 0.00        | 0.0
17   | 2     | 119      | 0.02        | 0.0
18   | 3     | 213      | 0.08        | 0.0
```
