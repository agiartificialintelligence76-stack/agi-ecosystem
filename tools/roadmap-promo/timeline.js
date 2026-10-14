// The roadmap's video (2026-10-14, the owner: "can you create a graphic and just short promotional video for the
// roadmap"; the owner's choices: 16:9 for X, about 20 seconds, music made in code and AGI-1's voice): its clock, shared
// by the picture (tools/roadmap-promo/page) and the sound (tools/roadmap-promo/music.js), so every slam, check, stamp and
// hit lands on the same frame. Pure: no browser, no Node.
// 120 beats a minute: a beat is half a second, a bar (4 beats) two seconds. Scenes start on bars.
export const BPM = 120;
export const BEAT = 60 / BPM;                  // 0.5 s
export const BAR = BEAT * 4;                   // 2 s
// a time in seconds from a bar and a beat (both may be fractions): at(4) = 8 s, at(4, 2) = 9 s
export const at = (bar, beat = 0) => (bar * 4 + beat) * BEAT;

// The story: the roadmap's title, then its road, one stop after another (the camera travels along it: the two live
// steps, "We're here", the three coming soon, the locked one), the whole road at once, and where to see it.
// [id, first bar, bar it ends on]. `live`, `soon` and `secret` are one world (the road) seen by one moving camera:
// no cut between them.
export const SCENES = [
  ['title', 0, 2],         //   0–4 s    The AGI roadmap: what's live today, and what's coming next; its six stops
  ['live', 2, 4],          //   4–8 s    Live now: 01 Talk to AGI-1, 02 AGI Studio, checked
  ['soon', 4, 7],          //   8–14 s   We're here. Coming soon: 03 Stake $AGI, 04 AGI games, 05 Giveaways, stamped
  ['secret', 7, 9],        //  14–18 s   06, locked: 18+ ???; then the whole road, 2 of 6 live
  ['end', 9, 10.75],       //  18–21.5 s the end card: agi1.app/roadmap
].map(([id, from, to]) => ({ id, from: at(from), to: at(to) }));
export const TOTAL = SCENES.at(-1).to;          // 21.5 s
export const sceneAt = (t) => SCENES.find((s) => t >= s.from && t < s.to) || SCENES.at(-1);
export const sceneOf = (id) => SCENES.find((s) => s.id === id);
// the scenes that are the road (one world, one camera)
export const ROAD = ['live', 'soon', 'secret'];

// The moments the picture and the sound share (seconds). Her four lines (VOICE, below) go between the big hits: under
// her words only soft sounds (pops, blips, whooshes, ticks), never an impact or a crash (the music dips under her and
// leaves its hits alone: tools/studio-promo/voice.js planDucks).
const steps = (t0, n, gap) => Array.from({ length: n }, (_, k) => t0 + k * gap);
export const MOMENTS = {
  // ---- title ----
  open: at(0),                                        // the violet field, its focus lines
  reveal: at(0, 0.25),                                // her art, revealed in halftone dots
  kicker: at(0, 0.5),                                 // "Roadmap · October 2026"
  titleWords: [at(0, 1), at(0, 1.5), at(0, 2)],       // The · AGI · roadmap: a slam each (the last with a crash)
  sub: at(0, 3),                                      // "What's live today, and what's coming next."
  road: at(1, 1),                                     // the road draws in along the bottom
  dots: steps(at(1, 1.5), 6, 0.125),                  // its six stops, a blip each: two live, three soon, one locked
  breath: at(1, 3.5),                                 // a breath before the drop
  // ---- live ----
  drop: at(2),                                        // the drop: the road, "Live now"
  nodes: [at(2, 1), at(2, 1.5)],                      // its first two stops land on the road
  cards: [at(2, 2.5), at(3)],                         // 01 Talk to AGI-1 (as she says "me") · 02 AGI Studio
  checks: [at(3, 1), at(3, 1.5)],                     // their checks, stamped
  pan: at(3, 3),                                      // on to "We're here"
  breath2: at(3, 3.5),
  // ---- soon ----
  drop2: at(4),                                       // the second drop: the "We're here" pin lands
  soonHead: at(4, 0.25),                              // "Coming soon"
  soonCards: [at(4, 0.5), at(4, 2.5), at(5, 0.5)],    // 03 Stake $AGI · 04 AGI games · 05 Giveaways, as she names them
  chips: steps(at(4, 1.25), 3, 0.125),                // staking's three ways: in USDG only · in $AGI only · free AI with sAGI
  fine: at(4, 1),                                     // "Coming soon · not financial advice · 18+" (bottom left, to the end)
  stamps: [at(6), at(6, 0.5), at(6, 1)],              // COMING SOON, stamped on each (after her words)
  pan2: at(6, 3),                                     // on to the last stop
  breathLock: at(6, 3.5),                             // a breath before the lock
  // ---- secret ----
  lock: at(7),                                        // the locked card slams in, the lights go down
  adult: at(7, 0.5),                                  // "18+"
  scramble: [at(7), at(7, 2)],                        // its "???" scrambles, then settles
  lockShake: at(8),                                   // the lock rattles (in her pause): a secret
  zoomOut: at(8, 1),                                  // the whole road at once, the lights back up
  pulses: steps(at(8, 1.5), 6, 0.125),                // each stop lights up in turn
  meter: at(8, 2.5),                                  // "2 of 6 · live now · 4 coming soon"
  breath3: at(8, 3.5),
  // ---- end ----
  end: at(9),                                         // the end card: a hit, a crash, the end chord
  url: at(9, 1),                                      // agi1.app/roadmap
  say: at(9, 1.5),                                    // her bubble: two live, four on the way (typed out in a second)
  handle: at(9, 1.75),                                // Follow @agi1dotapp
  fineEnd: at(9, 2.25),                               // the fine print
  lastHits: [at(10), at(10, 1)],
};

// AGI-1's voice over its music (the owner's "Music + AGI-1's voice"): her lines (words.js VOICE), each where her first
// word goes, after the music's hit at its moment, so the hit gets through at full level (tools/studio-promo/voice.js dips
// the music under her, and leaves the hits alone). Her takes (made in Google AI Studio with the owner's account, the four
// best of sixteen) were picked first, and the picture placed around their words: card 01 lands as she says "me", card 02
// as she says "AGI Studio", each coming-soon card just before she names it. `len`: how long her words last in her take
// (voice.js readyLine): a take that lasts much longer or shorter needs its place checked again (make.mjs says so).
export const VOICE = [
  { id: 'title', at: MOMENTS.titleWords[2] + 0.25, len: 1.92 },        // "This is the AGI roadmap.", as its title lands
  { id: 'live', at: MOMENTS.drop + 0.25, len: 2.96 },                   // "Two are live: me and AGI Studio."
  { id: 'next', at: MOMENTS.drop2 + 0.3, len: 3.39 },                   // "Staking, games and giveaways are next."
  { id: 'secret', at: MOMENTS.lock + 0.3, len: 2.77 },                  // "And one more… that's a secret.", hushed
];
