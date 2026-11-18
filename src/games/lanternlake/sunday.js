import { episode as c, round as r, context as q, exhibit as e } from './author.js';
export default [
  c(
    17,
    'Window Choir',
    6,
    ['Tali, the choir teacher', 'Bo, the window cleaner'],
    'Two upstairs windows sent in recordings of the same rain. Beneath the rain, a voice at each window seems to carry the fourth note.',
    'The rain aligns, but the two hums take different breaths. Two people stood at different windows singing along with the same unfinished ident.',
    'Bo sends a pair of wet paper umbrellas. Tali has written a different breathing mark on each one.',
    q(
      'Rain was falling at both open windows.',
      'Each recording catches the same hard splash against the shared metal drain.',
      'weather at windows',
      'rain',
      e(
        'Drain contact mic',
        'The drain mic captures the shared splash audible from both windows. Rain can accompany either one singer or two.',
        '',
        'mic',
        'rain'
      )
    ),
    [
      r(
        0,
        'The second caller sent an exact duplicate of the entire first window recording.',
        'I mean a duplicate of every sound in the first file: rain, humming and the breath before the end.',
        'The splash aligns, but the second hum continues through the first singer’s breath. The complete recordings differ.',
        'complete recordings',
        'identical',
        'different',
        e(
          'Window pair',
          'Align the captions at the shared gutter splash, then compare the voices.',
          'Window A hums, takes a breath, then hums again. Window B holds a rising hum without a break through the same interval. The rain transients still align.',
          'tape',
          'choir'
        ),
        [
          'Two lit windows place people in two places. Either person could still send the same audio file.',
          'Matching rain is compatible with both exact duplication and independent nearby recordings.',
        ]
      ),
      r(
        1,
        'Tali was at the landing window during the held note. I was at the attic window.',
        'We each sang from a window. I thought I had the room with the attic drainpipe and Tali had my landing.',
        'At the shared flash Tali was in the attic and I was on the landing. We sustained different notes together.',
        'occupants during shared flash',
        'Tali landing and Bo attic',
        'Tali attic and Bo landing',
        e(
          'Synchronized portraits',
          'Both window cameras captured the same lightning flash. The attic camera shows Tali singing; the landing camera shows Bo with the cleaning cloth, also singing. Both faces are identified on the signed contact strip.',
          '',
          'photo'
        ),
        [
          'Different hums establish independent sound. They do not identify the bodies at either window.',
          'The common drain splash is audible from both places without naming either singer.',
        ]
      ),
    ]
  ),
  c(
    18,
    'The Fourth Note',
    6,
    ['Jo, the night engineer', 'Mina, the coat checker', 'AGI-1, the host'],
    'The original reel is still missing. We have three notes on tape and one note bouncing around the block. Tonight the booth has kept every channel and every signature.',
    'Jo opened the room mic for the gap after the three-note ident. Mina sang on Monday, Bo on Friday and a neighborhood voice on each of the other nights. The fourth note was a handoff. AGI-1 leaves tonight’s fader open.',
    'The station sends one letter signed in seven inks. “Nobody had the missing reel. Everybody had the last note.”',
    q(
      'The three-note ident was played from the numbered booth reel.',
      'Its little leader tick is on every opening. That tick is my favorite part to leave in.',
      'first three source',
      'numbered booth reel',
      e(
        'Booth leader',
        'All seven broadcasts start with the numbered three-note booth reel’s leader tick. The shared opening says nothing about what happens afterward.',
        '',
        'tape',
        'three'
      )
    ),
    [
      r(
        0,
        'The room microphone stayed muted after the third note on every broadcast.',
        'I mean the room-mic relay in the quiet space after the third recorded note, over the whole week.',
        'Every relay row reopens the room mic in that gap. The engineer deliberately left a place for an answer.',
        'weekly room relay after third',
        'always muted',
        'reopens each night',
        e(
          'Seven-night dial log',
          'Read the relay column beside each numbered three-note ident.',
          'All seven dated rows change ROOM MIC from MUTE to AIR immediately after note three. This is the actual relay, independent of the tape fader.',
          'fader',
          'gap'
        ),
        [
          'An isolated room sound can be recorded even while a broadcast relay is muted. Audio on a track alone does not establish the relay state.',
          'A caller roster identifies performers and does not report fader positions.',
          'A shared tape leader establishes the opening, without showing the microphone relay.',
        ]
      ),
      r(
        1,
        'The fourth note on air was already recorded on the same booth reel as the first three.',
        'I mean the isolated reel channel, not the mixed broadcast. I thought someone had restored the missing note to that reel.',
        'The reel is silent after three. Only the simultaneous room channel carries the unmatched fourth note.',
        'fourth note on isolated reel',
        'present',
        'absent',
        e(
          'Isolated track pair',
          'Compare the REEL and ROOM captions at the fourth-note marker.',
          'REEL: three notes, then digital silence. ROOM: a breath followed by the fourth pitch at the same marker. The combined broadcast contains both channels.',
          'tape',
          'fourth'
        ),
        [
          'An open relay makes a live note possible. It cannot establish the contents of a separate reel.',
          'The roster identifies who was in the room, independent of what the reel contains.',
          'The common leader dates only the first three notes.',
        ]
      ),
      r(
        2,
        'The same neighbor supplied the room note on all seven nights.',
        'That was my on-air shorthand. I meant the same actual person at the live cue microphone every night.',
        'The signed cue slips name seven people, and each confirms singing their own night. I owe the whole block a credit.',
        'room singers across week',
        'one person',
        'seven performers',
        e(
          'Signed cue roster',
          'Turn over the attendance roster to reach the individual performance acknowledgments.',
          'Seven different neighbors each signed “I sang the live fourth note” for one specific night. The booth engineer countersigned each cue, including Mina on Monday and Bo on Friday.',
          'roster'
        ),
        [
          'The dial follows a relay, not an individual voice.',
          'The track pair isolates a live fourth note but does not identify seven nights of singers.',
          'The same recorded opening can introduce a different person every night.',
        ]
      ),
    ]
  ),
];
