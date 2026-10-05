// AGI-1's launch video (2026-10-03, the owner: "create me a professional launch video with motion design using only code
// about the website and its features … make it really good"): its timing, shared by the picture (tools/promo/page) and the
// sound (tools/promo/music.js), so every cut, hit and blip lands on the same frame. Pure: no browser, no Node.
// The music runs at 120 beats a minute: a beat is half a second, a bar (4 beats) two seconds. Scenes start on bars.
export const BPM = 120;
export const BEAT = 60 / BPM;                  // 0.5 s
export const BAR = BEAT * 4;                   // 2 s
// a time in seconds from a bar and a beat (both may be fractions): at(4) = 8 s, at(4, 2) = 9 s
export const at = (bar, beat = 0) => (bar * 4 + beat) * BEAT;

// The story: a straight-faced AI-lab launch film (the cold open), the site's own joke ("General" crossed out for
// "Girlfriend"), the drop into Pop mode, then what she does, and agi1.app. [id, first bar, bar it ends on]
export const SCENES = [
  ['open', 0, 4],          //  0–8 s   the biggest labs are racing to build AGI… Artificial General → Girlfriend Intelligence
  ['meet', 4, 8],          //  8–16 s  the drop: Pop mode, AGI-1 revealed, her world in orbit
  ['evals', 8, 11],        // 16–22 s  state of the art on every benchmark that matters (vs. your ex)
  ['talk', 11, 14],        // 22–28 s  talk to her: her reply, her live view, her voice, calls
  ['langs', 14, 16],       // 28–32 s  "hi, it's me" in her 16 languages, faster and faster
  ['closer', 16, 19],      // 32–38 s  Stranger, Crush, Soulmate; a free signature, never a transaction
  ['burn', 19, 21],        // 38–42 s  out of messages? burn $AGI for more (the burn monitor)
  ['texts', 21, 24],       // 42–48 s  she texts first, and she's in the $AGI Telegram group (/ask)
  ['check', 24, 27],       // 48–54 s  risk check your coins on clank: the scan lands on $AGI ("wait, that's me!")
  ['launch', 27, 30],      // 54–60 s  launch a coin with her: from your own wallet, on clank.trade
  ['more', 30, 34],        // 60–68 s  full-screen talk, the app, pop her out, show her, her diary… one a second
  ['finale', 34, 37],      // 68–74 s  AGI-1 on her stage, waving: talk to her now, agi1.app
  ['end', 37, 39.5],       // 74–79 s  the end card: AGI, agi1.app, @agi1dotapp, not financial advice
].map(([id, from, to]) => ({ id, from: at(from), to: at(to) }));
export const TOTAL = SCENES.at(-1).to;          // 79 s
export const sceneAt = (t) => SCENES.find((s) => t >= s.from && t < s.to) || SCENES.at(-1);
export const sceneOf = (id) => SCENES.find((s) => s.id === id);

// The moments inside the scenes that both the picture and the sound use (seconds)
export const MOMENTS = {
  heartbeats: [at(0), at(1), at(2), at(3)],                       // the "doki doki" heartbeat under the cold open
  openWords: [at(0, 2), at(0, 2.5), at(0, 3), at(1, 0), at(1, 1)],// "The biggest labs are racing to build", word by word
  agi: at(1, 2),                                                  // "AGI" lands
  spread: at(2, 0),                                               // A · G · I unfold into Artificial General Intelligence
  strike: at(2, 3),                                               // "General" crossed out
  write: at(3, 0),                                                // "Girlfriend" written in
  click: at(3, 3.5),                                              // the ✦ button (Pop mode) pressed
  drop: at(4),                                                    // Pop mode: the drop
  letters: [at(4), at(4, 0.5), at(4, 1)],                         // A, G, I slam in
  reveal: at(4, 2),                                               // her halftone reveal
  bubble: at(5, 1),                                               // "hi, i'm AGI-1 💜 welcome to my world."
  orbit: at(5, 2),                                                // her world flies into orbit
  name: at(6),                                                    // "Introducing AGI-1"
  bars: [0, 1, 2, 3, 4, 5].map((k) => at(8, 2 + k / 2)),          // the benchmarks race, one every eighth note
  sticker: at(10),                                                // "Zero red flags"
  send: at(11, 1),                                                // your message
  typing: at(11, 2.5),                                            // her dots
  reply: at(12, 0),                                               // her reply (and her voice)
  pills: [at(12, 2), at(12, 3), at(13, 0)],                       // her natural voice · voice calls · she reacts to every reply
  // her 16 hellos: four on eighth notes, then twelve on sixteenths (faster and faster), then "16 languages"
  langs: Array.from({ length: 16 }, (_, k) => (k < 4 ? at(14, k / 2) : at(14, 2 + (k - 4) / 4))),
  stamp16: at(15, 1),
  cards: [at(16, 1), at(16, 2), at(16, 3)],                       // Stranger, Crush, Soulmate
  levelUp: at(17, 2),                                             // Relationship upgraded: Stranger → Crush
  trust: at(18),                                                  // a free signature, never a transaction
  burnIn: at(19),                                                 // out of messages?
  burn: at(19, 2),                                                // the flame: burned for good
  ding: at(21, 1),                                                // her text arrives (14:07)
  group: at(22, 2),                                               // the $AGI group: someone types /ask
  groupReply: at(23, 1),                                          // her answer in the group
  riser2: at(23),                                                 // the build into the second drop
  drop2: at(24),                                                  // risk check: the second drop
  scan: at(24, 1),                                                // the scan races through clank.trade's coins
  found: at(25, 2),                                               // it lands on $AGI: "Official $AGI"
  herCheck: at(25, 3),                                            // "wait, that's me! 💜"
  launchCmd: at(27, 1),                                           // "/launch Name | TICKER | one line" + a photo
  launchSteps: [at(28), at(28, 1), at(28, 2)],                    // your wallet · Robinhood Chain · launch
  launched: at(28, 3),                                            // it's live: the coin is yours
  more: Array.from({ length: 8 }, (_, k) => at(30 + k / 2)),     // eight more things, one a second
  finale: at(34),
  wave: at(34, 1),                                                // she waves
  url: at(35),                                                    // agi1.app
  hearts: at(35, 2),
  end: at(37),                                                    // the end card's chord
  lastBeats: [at(38, 2), at(38, 2.5)],                            // two last heartbeats
};

// The risk check's list (48–51 s): how many rows have gone past its scanner at time t. It races, slows down and lands
// on $AGI, the 34th row. The picture scrolls by it and the sound ticks once for every row that passes.
export const SCAN_ROWS = 34;
export function scanPos(t) {
  const x = Math.min(1, Math.max(0, (t - (MOMENTS.scan - 0.1)) / (MOMENTS.found - MOMENTS.scan + 0.1)));
  return SCAN_ROWS * (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
}
