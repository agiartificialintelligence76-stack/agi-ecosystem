// The roadmap's video (2026-10-14, the owner: "can you create a graphic and just short promotional video for the
// roadmap"; the owner's choices: 16:9 for X, about 20 seconds, music made in code and AGI-1's voice): its clock, shared
// by the picture (tools/roadmap-promo/page) and the sound (tools/roadmap-promo/music.js), so every slam, check, stamp and
// hit lands on the same frame. Pure: no browser, no Node.
// Since 2026-10-19 (the owner: four more steps, "say the roadmap is not in order", "and update the roadmap video also"):
// ten stops, and after "We're here" the road shows "What's next, in no particular order" in three holds, each step
// stamped Coming soon or Under way as the page marks it. 23.5 s.
// 120 beats a minute: a beat is half a second, a bar (4 beats) two seconds. Scenes start on bars.
export const BPM = 120;
export const BEAT = 60 / BPM;                  // 0.5 s
export const BAR = BEAT * 4;                   // 2 s
// a time in seconds from a bar and a beat (both may be fractions): at(4) = 8 s, at(4, 2) = 9 s
export const at = (bar, beat = 0) => (bar * 4 + beat) * BEAT;

// The story: the roadmap's title, then its road, one stop after another (the camera travels along it: the two live
// steps, "We're here", what's next in three holds, the locked one), the whole road at once, and where to see it.
// [id, first bar, bar it ends on]. `live`, `next` and `secret` are one world (the road) seen by one moving camera:
// no cut between them.
export const SCENES = [
  ['title', 0, 2],         //   0–4 s    The AGI roadmap: what's live today, and what's coming next; its ten stops
  ['live', 2, 4],          //   4–8 s    Live now: 01 Talk to AGI-1, 02 AGI Studio, checked
  ['next', 4, 8],          //   8–16 s   We're here. What's next, in no particular order: 03–05, 06–08, 09, stamped
  ['secret', 8, 10],       //  16–20 s   10, locked: 18+ ???; then the whole road, 2 of 10 live
  ['end', 10, 11.75],      //  20–23.5 s the end card: agi1.app/roadmap
].map(([id, from, to]) => ({ id, from: at(from), to: at(to) }));
export const TOTAL = SCENES.at(-1).to;          // 23.5 s
export const sceneAt = (t) => SCENES.find((s) => t >= s.from && t < s.to) || SCENES.at(-1);
export const sceneOf = (id) => SCENES.find((s) => s.id === id);
// the scenes that are the road (one world, one camera)
export const ROAD = ['live', 'next', 'secret'];

// The moments the picture and the sound share (seconds). Her lines (VOICE, below) go between the big hits: under her
// words only soft sounds (pops, blips, whooshes, ticks, bells), never an impact or a crash (the music dips under her and
// leaves its hits alone: tools/studio-promo/voice.js planDucks).
const steps = (t0, n, gap) => Array.from({ length: n }, (_, k) => t0 + k * gap);
export const MOMENTS = {
  // ---- title ----
  open: at(0),                                        // the violet field, its focus lines
  reveal: at(0, 0.25),                                // her art, revealed in halftone dots
  kicker: at(0, 0.5),                                 // "Roadmap · October 2026"
  titleWords: [at(0, 1), at(0, 1.5), at(0, 2)],       // The · AGI · roadmap: a slam each (the last with a crash)
  sub: at(0, 3),                                      // "What's live today, and what's coming next."
  road: at(1, 0.75),                                  // the road draws in along the bottom
  dots: steps(at(1, 1.25), 10, 0.1),                  // its ten stops, a blip each: two live, three under way, the rest
  breath: at(1, 3.5),                                 // a breath before the drop
  // ---- live ----
  drop: at(2),                                        // the drop: the road, "Live now"
  nodes: [at(2, 1), at(2, 1.5)],                      // its first two stops land on the road
  cards: [at(2, 2.5), at(3)],                         // 01 Talk to AGI-1 (as she says "me") · 02 AGI Studio
  checks: [at(3, 1), at(3, 1.5)],                     // their checks, stamped
  pan: at(3, 3),                                      // on to "We're here"
  breath2: at(3, 3.5),
  // ---- next (what's next, in no particular order: three holds) ----
  drop2: at(4),                                       // the second drop: the "We're here" pin lands
  nextHead: at(4, 0.25),                              // "What's next"
  note: at(4, 0.75),                                  // "In no particular order: any of these could come first."
  fine: at(4, 1),                                     // "Coming soon · not financial advice · 18+" (bottom left, to the end)
  // 03 Stake $AGI · 04 AGI games · 05 Buybacks… (the first hold), 06 · 07 · 08 (the second), 09 Giveaways (the third)
  nextCards: [at(4, 0.5), at(4, 2), at(4, 3), at(5, 3), at(6), at(6, 1), at(7, 0.5)],
  chips: steps(at(4, 1.25), 3, 0.125),                // staking's ways: in USDG only · in $AGI only · free AI with sAGI
  // each stamped as the page marks it: COMING SOON or UNDER WAY
  stamps: [at(5), at(5, 0.5), at(5, 1), at(6, 2), at(6, 2.5), at(6, 3), at(7, 1.5)],
  panB: at(5, 2),                                     // on to the second hold
  panC: at(6, 3.5),                                   // on to the third
  pan2: at(7, 3),                                     // on to the last stop
  breathLock: at(7, 3.5),                             // a breath before the lock
  // ---- secret ----
  lock: at(8),                                        // the locked card slams in, the lights go down
  adult: at(8, 0.5),                                  // "18+"
  scramble: [at(8), at(8, 2)],                        // its "???" scrambles, then settles
  lockShake: at(9),                                   // the lock rattles (in her pause): a secret
  zoomOut: at(9, 1),                                  // the whole road at once, the lights back up
  pulses: steps(at(9, 1.5), 10, 0.1),                 // each stop lights up in turn
  meter: at(9, 2.5),                                  // "2 of 10 · live now · 3 under way · 5 coming soon"
  breath3: at(9, 3.5),
  // ---- end ----
  end: at(10),                                        // the end card: a hit, a crash, the end chord
  url: at(10, 1),                                     // agi1.app/roadmap
  say: at(10, 1.5),                                   // her bubble: two live, eight on the way (typed out in a second)
  handle: at(10, 1.75),                               // Follow @agi1dotapp
  fineEnd: at(10, 2.25),                              // the fine print
  lastHits: [at(11), at(11, 1)],
};

// AGI-1's voice over its music (the owner's "Music + AGI-1's voice"): her lines (words.js VOICE), each where her first
// word goes, after the music's hit at its moment, so the hit gets through at full level (tools/studio-promo/voice.js dips
// the music under her, and leaves the hits alone). Her takes (made in Google AI Studio with the owner's account, the best
// of sixteen) were picked first, and the picture placed around their words: card 01 lands as she says "me", card 02 as
// she says "AGI Studio", the lock rattles in her pause. `len`: how long her words last in her take (voice.js
// readyLine): a take that lasts much longer or shorter needs its place checked again (make.mjs says so).
export const VOICE = [
  { id: 'title', at: MOMENTS.titleWords[2] + 0.25, len: 1.92 },        // "This is the AGI roadmap.", as its title lands
  { id: 'live', at: MOMENTS.drop + 0.25, len: 2.96 },                   // "Two are live: me and AGI Studio."
  { id: 'secret', at: MOMENTS.lock + 0.3, len: 2.77 },                  // "And one more… that's a secret.", hushed
];
