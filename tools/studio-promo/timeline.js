// AGI Studio's launch video (2026-10-13, the owner: "go make a promotional marketing launch video of AGI studio. all the
// features there, do it with top notch motion design and easy to understand and visible make it 4:3 video"): its clock,
// shared by the picture (tools/studio-promo/page) and the sound (tools/studio-promo/music.js), so every cut, tap, shutter
// and hit lands on the same frame. Pure: no browser, no Node.
// 120 beats a minute: a beat is half a second, a bar (4 beats) two seconds. Scenes start on bars.
export const BPM = 120;
export const BEAT = 60 / BPM;                  // 0.5 s
export const BAR = BEAT * 4;                   // 2 s
// a time in seconds from a bar and a beat (both may be fractions): at(4) = 8 s, at(4, 2) = 9 s
export const at = (bar, beat = 0) => (bar * 4 + beat) * BEAT;

// The story: an influencer's feed (she's not real: you made her), AGI Studio, how one is made, then what it makes (photos,
// memes, X banners, edits, trend videos, videos, the tools around them, a 3D model and a coin), what it costs and what
// holders get, the community, and where to start. [id, first bar, bar it ends on]
export const SCENES = [
  ['hook', 0, 4],          //   0–8 s   Meet Nova. She posts every day. She's not real. You made her.
  ['brand', 4, 7],         //   8–14 s  the drop: AGI Studio. Create your own influencer · AGI-1 · AI · viral content
  ['create', 7, 13],       //  14–26 s  design it in a few taps, 4 looks, its full body; or start from a photo
  ['styles', 13, 15],      //  26–30 s  any look, any style: the four of them, then 26 styles
  ['photos', 15, 18],      //  30–36 s  photos in any scene: type it, make it; a montage
  ['memes', 18, 20],       //  36–40 s  memes in its face; X banners, 1500 × 500
  ['edit', 20, 23],        //  40–46 s  edit with words; the photo editor (free); now make it move
  ['trends', 23, 29],      //  46–58 s  the second drop: trend videos, a clip and the influencer in it, four times
  ['videos', 29, 32],      //  58–64 s  videos from a photo: Standard, Pro, Anime, Long
  ['tools', 32, 36],       //  64–72 s  the video editor, captions, make another, Instant, progress, profile pictures…
  ['model', 36, 39],       //  72–78 s  a 3D model that moves; a coin with its face
  ['pay', 39, 42],         //  78–84 s  pay as you go (credits); $AGI holders get more
  ['community', 42, 45],   //  84–90 s  likes, the spotlight of the week, gifts and invites
  ['finale', 45, 49],      //  90–98 s  everything at once: create your own influencer, agi1.app/studio
  ['end', 49, 51.5],       //  98–103 s the end card
].map(([id, from, to]) => ({ id, from: at(from), to: at(to) }));
export const TOTAL = SCENES.at(-1).to;          // 103 s
export const sceneAt = (t) => SCENES.find((s) => t >= s.from && t < s.to) || SCENES.at(-1);
export const sceneOf = (id) => SCENES.find((s) => s.id === id);

// The moments the picture and the sound share (seconds)
const steps = (t0, n, gap) => Array.from({ length: n }, (_, k) => t0 + k * gap);
export const MOMENTS = {
  // ---- hook ----
  shots: [at(0), at(0, 2), at(0, 3)],                 // her photos, a shutter each: the beach, the café, the rooftop
  meet: at(0, 0.5),                                   // "Meet Nova."
  feed: at(1),                                        // "She posts every day." (her grid)
  grid: steps(at(1), 6, 0.125),                       // its six photos
  likes: steps(at(1, 2), 4, 0.25),                    // hearts on them
  zoom: at(2),                                        // one of them comes alive (a trend video of her)
  notReal: at(2, 2),                                  // "She's not real."
  aiPill: at(2, 3),                                   // "AI-generated"
  youMade: at(3),                                     // "You made her."
  createClick: at(3, 1.5),                            // ✦ Create
  squad: [at(3, 2), at(3, 2.5), at(3, 3)],            // Kai, Mika and Juno pop in
  breath: at(3, 3.5),                                 // a breath before the drop
  // ---- brand ----
  drop: at(4),                                        // the drop: AGI Studio
  headline: at(4, 2),                                 // "Create your own"
  rotate: [at(4, 3), at(5, 1), at(5, 3), at(6, 1)],   // influencer · AGI-1 · AI · viral content
  sub: at(6, 2),                                      // photos, videos and trends of it, in minutes
  url: at(6, 3),                                      // agi1.app/studio
  // ---- create ----
  appIn: at(7),
  taps: steps(at(7, 1), 7, BEAT),                     // Design it, Feminine, 20s, Wavy, Smart casual, Cheerful, Realistic
  typeName: at(8, 4),                                 // "Nova"
  create: at(9, 2),                                   // ✦ Create · 100
  looks: steps(at(10), 4, 0.25),                      // its 4 looks
  pickLook: at(10, 2.5),
  useLook: at(10, 3.5),
  body: at(11),                                       // its full body
  ready: at(11, 1),
  photoMode: at(11, 2),                               // From a photo
  photoDrop: at(11, 3),
  consent: at(12),
  ways: [at(12, 1), at(12, 1.5), at(12, 2)],          // 4 looks · just its full body · as it is
  pickWay: at(12, 3),
  // ---- styles ----
  lineup: steps(at(13), 4, 0.25),                     // Nova, Kai, Mika, Juno
  styleTiles: steps(at(14), 9, 0.0625),               // a quick cascade, a thirty-second each
  stamp26: at(14, 1),                                 // "26 styles", with the clap
  anyStyle: at(14, 2),                                // "Or Any style": a whole second before the cut
  // ---- photos ----
  typeScene: at(15),                                  // the scene typed
  makePhoto: at(15, 2),
  developed: at(15, 3),
  montage: steps(at(16), 6, BEAT),                    // six more, a shutter each
  photoModels: steps(at(16, 3), 4, 0.25),             // Classic · Crisp · up to 4K · references, beside the montage
  // ---- memes ----
  memes: [at(18), at(18, 1)],
  formats: steps(at(18, 2), 5, 0.125),
  banner: at(19),
  bannerSize: at(19, 1.5),
  // ---- edit ----
  typeEdit: at(20, 0.5),                              // "Make the jacket red"
  editClick: at(20, 2),
  editWipe: at(20, 2.5),
  onlyThat: at(20, 3.5),
  editor: at(21),                                     // the photo editor
  filters: [at(21, 1), at(21, 1.5), at(21, 2)],       // Vivid, Mono, Warm
  sticker: at(21, 2.5),
  editText: at(21, 3),
  move: at(22),                                       // "Now make it move."
  breath2: at(22, 3.5),
  // ---- trends ----
  drop2: at(23),                                      // the second drop: trend videos
  pickTrend: at(23, 3),
  pairs: [at(24), at(25), at(26), at(27)],            // four clips, each with the influencer put into it
  swaps: [at(24, 1), at(25, 1), at(26, 1), at(27, 1)],
  ownClip: at(28),
  four: at(28, 1),
  // ---- videos ----
  videoIn: at(29),
  videoClick: at(29, 1),
  alive: at(29, 2),
  row: [at(30), at(30, 0.5), at(30, 1)],
  videoModels: steps(at(30, 2), 4, 0.25),             // Standard · Pro · Anime · Long
  sound: at(31),
  // ---- tools ----
  tools: steps(at(32), 8, BEAT),                      // eight of them, one a beat, into their grid
  toolsRead: [at(34), at(35)],                        // then the camera reads them: the top row, the bottom row
  // ---- model ----
  model: at(36),
  modelSteps: [at(36, 1), at(36, 2), at(36, 3)],      // shaping it · giving it bones · teaching it moves
  wave: at(37),
  coin: at(37, 2),
  coinFlip: at(37, 3),
  coinLand: at(38),
  // ---- pay ----
  pay: at(39),
  count: at(39, 0.5),
  prices: steps(at(39, 1.5), 6, 0.125),              // what things cost, a row each sixteenth
  holders: at(40, 2),                                 // "$AGI holders get more."
  holderRows: [at(40, 3), at(41)],                    // Crush, Soulmate: the prices fall to theirs
  // ---- community ----
  likesWall: at(42),
  hearts: steps(at(42, 1), 6, 0.25),
  spotlight: at(43),
  gifts: at(44),                                      // a gift card
  claim: at(44, 1),                                   // Claim
  invite: at(44, 1.5),                                // invite a friend
  breath3: at(44, 3.5),
  // ---- finale ----
  finale: at(45),
  logo: at(46),
  line: at(46, 1),
  cta: at(47),
  live: at(47, 1),
  // ---- end ----
  end: at(49),
  lastHits: [at(50), at(50, 1)],
};
