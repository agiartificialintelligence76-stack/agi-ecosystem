// AGI-1's live show (2026-10-07, the owner: "add more actions", "can dance", "move not just steady", "make her act like a
// real streamer"): more of her body on stream, on top of the site's own controller (src/stage/agi1-2d.js: her breathing,
// blinking, looking around, her reactions). Her controller calls apply() every frame (its `moves` option, only on her
// show), which adds to her pose's targets:
//   • actions: a laugh, a surprise, thinking, presenting the card, clapping, heart hands, a "peace" with a wink, an excited
//     bounce, a stretch, a sip from her mug, a look at her phone, tucking her hair, a shrug, a glance at the chat;
//   • gestures while she talks (her hands explain, her hand to her chest, an open shrug), a little bigger on her louder words;
//   • by herself, now and then, while she's quiet: what a streamer does between things (a sip, a stretch, a look at chat…);
//   • dances on the beat of her music (a few routines: a sway, arm pumps, claps, hands waving, a groove), and her moves while
//     she sings her song;
//   • her weight moving around her chair, never quite still.
// Her upper arms never lift past what her drawing allows (src/stage/agi1-2d-arms.js REACH): her hands go up by bending her
// elbows. Angles in degrees (shoulder > 0 lifts the arm away from her body, elbow > 0 turns the forearm up and out); R is
// her right arm, on the left of the picture.

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
// a move's weight over its time: in, hold, out
const env = (a, len, inT = 0.28, outT = 0.38) => smooth(0, inT, a) * (1 - smooth(len - outT, len, a));
const ARM_KEYS = ['shR', 'elR', 'wrR', 'shL', 'elL', 'wrL'];
const ADD_KEYS = ['ax', 'ay', 'az', 'ex', 'ey', 'bx', 'by', 'bz', 'hip'];

// Each action: its length (s) and, at its own time `a` (s), { arms: absolute targets (blended in by the action's weight),
// add: added to her head, eyes and body, face: her face's extras, prop: what she holds, fx: an effect to ask the page for }
export const ACTIONS = {
  laugh: { len: 2.3, pose: (a) => ({
    arms: { shR: -30, elR: 184, wrR: 12 },
    add: { az: 5 * Math.sin(a * 13), ay: -3 + 2 * Math.sin(a * 13), by: 1.6 * Math.abs(Math.sin(a * 13)) },
    face: { happy: smooth(0.1, 0.25, a) * (1 - smooth(1.9, 2.2, a)), grin: 0.5, mouth: 0.3 + 0.12 * Math.abs(Math.sin(a * 13)), blush: 0.4 },
  }), fx: 'laugh' },
  surprised: { len: 1.8, pose: (a) => ({
    arms: { shR: -42, elR: 166, wrR: -16, shL: -42, elL: 166, wrL: -16 },
    add: { by: -3 * smooth(0, 0.15, a), ay: 6, ex: 0, ey: 0.15 },
    face: { mouth: 0.62 * env(a, 1.8, 0.08, 0.5), blush: 0.2 }, brows: 1,
  }), fx: 'surprise' },
  think: { len: 3.2, pose: (a) => ({
    arms: { shR: -32, elR: 182, wrR: 25 },
    add: { az: 8, ax: -5, ex: -0.55, ey: 0.6 },
    face: { lids: 0.35, mouth: 0 },
  }), fx: 'think' },
  present: { len: 2.6, pose: () => ({
    arms: { shR: -48, elR: 155, wrR: -12 },
    add: { ax: -10, az: -3, ex: -0.8, ey: 0.05, bz: 2 },
    face: { grin: 0.28 },
  }) },
  clap: { len: 2.2, pose: (a) => {
    const c = 0.5 - 0.5 * Math.cos(a * Math.PI * 2 * 3);
    return { arms: { shR: -48 - 8 * c, elR: 160 + 24 * c, wrR: 8, shL: -48 - 8 * c, elL: 160 + 24 * c, wrL: 8 }, add: { by: 1.2 * c, ay: -2 * c }, face: { grin: 0.42, happy: 0.4 } };
  }, fx: 'clap' },
  heart: { len: 2.6, pose: () => ({
    arms: { shR: -45, elR: 172, wrR: 10, shL: -45, elL: 172, wrL: 10 },
    add: { az: -4, by: 1 },
    face: { grin: 0.35, blush: 0.9, happy: 0.5 },
  }), fx: 'hearts' },
  peace: { len: 2.3, pose: (a) => ({
    arms: { shR: -30, elR: 186, wrR: 14 },
    add: { az: -9, ax: 4 },
    face: { grin: 0.4, winkR: smooth(0.2, 0.35, a) * (1 - smooth(1.6, 1.8, a)), blush: 0.3 },
  }), fx: 'sparkle' },
  bounce: { len: 1.8, pose: (a) => ({
    add: { by: 2.4 * Math.abs(Math.sin(a * 9)), hip: 0.008 * Math.sin(a * 9), az: 3 * Math.sin(a * 4.5) },
    arms: { shR: -42, elR: 150 + 14 * Math.abs(Math.sin(a * 9)), shL: -42, elL: 150 + 14 * Math.abs(Math.sin(a * 9)) },
    face: { grin: 0.45 },
  }) },
  stretch: { len: 3.6, pose: (a) => {
    const up = smooth(0.3, 1.1, a) * (1 - smooth(2.6, 3.4, a));
    return { arms: { shR: 12, elR: 172, wrR: 10, shL: 12, elL: 172, wrL: 10 }, add: { by: -3 * up, ay: 7 * up, az: 4 * up },
      face: { happy: up, mouth: 0.68 * smooth(0.9, 1.3, a) * (1 - smooth(1.9, 2.4, a)) } };
  } },
  sip: { len: 3.4, prop: 'mug', pose: (a) => {
    const at = smooth(0.9, 1.3, a) * (1 - smooth(2.2, 2.6, a));
    return { arms: { shR: -32, elR: 180, wrR: 12 }, add: { ay: -2 - 4 * at, az: 3 * at, ex: -0.1, ey: -0.3 * at },
      face: { happy: at * 0.9, mouth: 0 } };
  } },
  phone: { len: 3.8, prop: 'phone', pose: (a) => {
    const down = 1 - smooth(2.4, 2.8, a);
    return { arms: { shR: -50, elR: 150, wrR: 18 }, add: { ay: -10 * down, ax: -6 * down, ex: -0.4 * down, ey: -0.85 * down },
      face: { grin: a > 2.6 ? 0.45 : 0.1, happy: a > 2.7 ? 0.6 : 0 } };
  } },
  hairtuck: { len: 2.3, pose: () => ({
    arms: { shL: -28, elL: 188, wrL: -6 },
    add: { az: 8, ax: 3 },
    face: { grin: 0.18, blush: 0.35, lids: 0.3 },
  }) },
  shrug: { len: 1.9, pose: () => ({
    arms: { shR: -46, elR: 158, wrR: -14, shL: -46, elL: 158, wrL: -14 },
    add: { by: 2.4, az: 9 },
    face: { grin: 0.12, lids: 0.3 },
  }) },
  lookchat: { len: 2.6, pose: (a) => ({
    add: { ax: -9, ay: -4, ex: -0.9, ey: -0.35 },
    face: { grin: a > 1.5 ? 0.3 : 0.05 },
  }) },
  lean: { len: 3.4, pose: () => ({ add: { by: 3.5, ay: -2 }, face: { grin: 0.25 } }), cam: 'close' },
  // (2026-10-07, viewers' requests) a blush: her hands up by her chest, looking down and away, her cheeks pink
  blush: { len: 2.8, pose: () => ({
    arms: { shR: -45, elR: 172, wrR: 10, shL: -45, elL: 172, wrL: 10 },
    add: { ax: -8, ay: -6, az: 6, ex: -0.6, ey: -0.7 },
    face: { blush: 1, lids: 0.65, grin: 0.12 },
  }), fx: 'hearts-small' },
  // a wink, her head tilted, a little sparkle
  wink: { len: 1.6, pose: (a) => ({
    add: { az: -8, ax: 3 },
    face: { winkR: smooth(0.15, 0.3, a) * (1 - smooth(1.0, 1.3, a)), grin: 0.4, blush: 0.25 },
  }), fx: 'sparkle' },

  // (2026-10-07, the owner: "add more emotions as well") her emotions (server/live-acts.js EMOTIONS: the same names): her
  // face, her body and a cartoon mark on her face (`emote`: outfits.js draws it, heart eyes, tears…) or on the set (`fx`).
  // Always cute and PG-13: a playful pout, never mean. Her hands still never stick out flat at her hips (GESTURES says why).
  angry: { len: 2.6, emote: 'vein', pose: (a) => ({
    arms: { shR: -45, elR: 168 + 6 * Math.sin(a * 16), wrR: 6, shL: -45, elL: 168 - 6 * Math.sin(a * 16), wrL: 6 },
    add: { ax: 10 * smooth(0.2, 0.5, a), az: -5, by: 0.8 * Math.sin(a * 16), ey: 0.1 },
    face: { lids: 0.3, blush: 0.5 },
  }), fx: 'hmph' },
  cry: { len: 3.4, emote: 'tears', emoteW: (a) => 1 - smooth(2.4, 2.8, a), pose: (a) => {
    const sob = Math.abs(Math.sin(a * 9)), end = smooth(2.6, 3.0, a);
    return { arms: { shR: -32, elR: 184, wrR: 18, shL: -32, elL: 184, wrL: 18 },
      add: { ay: -6 * (1 - end) + 2 * end, by: 1.2 * sob * (1 - end), az: 3 * Math.sin(a * 4) },
      face: { lids: 0.75 * (1 - end), mouth: (0.22 + 0.12 * sob) * (1 - end), happy: end * 0.8, grin: end * 0.35, blush: 0.4 } };
  } },
  scared: { len: 2.4, emote: 'sweat', pose: (a) => ({
    arms: { shR: -45, elR: 172, wrR: 10, shL: -45, elL: 172, wrL: 10 },
    add: { az: 2.2 * Math.sin(a * 42), ax: 1.5 * Math.sin(a * 37), by: -2.5, ay: -2, ey: 0.15 },
    face: { mouth: 0.32, blush: 0.15 }, brows: 1,
  }), fx: 'bang' },
  sleepy: { len: 3.8, pose: (a) => {
    const yawn = smooth(0.5, 1.1, a) * (1 - smooth(1.9, 2.4, a));
    return { arms: { shR: -32, elR: 182, wrR: 20 }, add: { az: 8, ay: 3 * yawn - 2, ex: 0.1 },
      face: { mouth: 0.72 * yawn, lids: 0.6 + 0.3 * yawn, happy: 0.4 * (1 - yawn) } };
  }, fx: 'zzz' },
  excited: { len: 2.4, emote: 'stars', pose: (a) => {
    const shake = Math.sin(a * Math.PI * 2 * 2.2);
    return { arms: { shR: 8, elR: 124 + 8 * shake, wrR: 10 * shake, shL: 8, elL: 124 + 8 * shake, wrL: 10 * shake },
      add: { by: 2.2 * Math.abs(Math.sin(a * 9)), az: 3 * shake }, face: { grin: 0.55 } };
  }, fx: 'sparkle' },
  lovestruck: { len: 3.0, emote: 'hearts', pose: (a) => ({
    arms: { shR: -45, elR: 172, wrR: 10, shL: -45, elL: 172, wrL: 10 },
    add: { az: 7 * Math.sin(a * 2.4), by: 1 }, face: { blush: 1, grin: 0.35 },
  }), fx: 'hearts' },
  confused: { len: 2.6, pose: () => ({
    arms: { shR: 9, elR: 132, wrR: 8 },
    add: { az: 13, ax: 4, ex: 0.3, ey: 0.5 }, face: { lids: 0.2, mouth: 0.08 },
  }), fx: 'think' },
  dizzy: { len: 2.8, emote: 'spiral', pose: (a) => ({
    arms: { shR: 4 + 4 * Math.sin(a * 5), elR: 24, shL: 4 - 4 * Math.sin(a * 5), elL: 24 },
    add: { az: 9 * Math.sin(a * 5), bz: 6 * Math.cos(a * 5), ax: 6 * Math.sin(a * 5 + 1), hip: 0.01 * Math.sin(a * 5) },
    face: { mouth: 0.2, grin: 0.1 },
  }) },
  nervous: { len: 2.6, emote: 'sweat', pose: (a) => ({
    arms: { shR: -45, elR: 160 + 6 * Math.sin(a * 12), wrR: -6, shL: -45, elL: 160 - 6 * Math.sin(a * 12), wrL: -6 },
    add: { az: 3 * Math.sin(a * 3), ex: 0.4 * Math.sin(a * 2), ey: -0.2 },
    face: { grin: 0.3, mouth: 0.1 + 0.06 * Math.abs(Math.sin(a * 14)), blush: 0.35 },
  }) },
  proud: { len: 2.6, pose: () => ({
    arms: { shR: -45, elR: 170, wrR: 8 },
    add: { ay: 7, az: -4, by: -1.5 }, face: { happy: 0.75, grin: 0.45 },
  }), fx: 'sparkle' },
  shocked: { len: 2.0, pose: (a) => ({
    arms: { shR: -32, elR: 184, wrR: 18, shL: -32, elL: 184, wrL: 18 },
    add: { by: -3 * smooth(0, 0.12, a), ay: 4, ey: 0.15 }, face: { mouth: 0.7 * env(a, 2.0, 0.08, 0.5) }, brows: 1,
  }), fx: 'bang' },
  cold: { len: 3.0, pose: (a) => ({
    arms: { shR: -45, elR: 160, wrR: 10, shL: -45, elL: 160, wrL: 10 },
    add: { az: 1.6 * Math.sin(a * 46), by: -2, ay: -3 }, face: { lids: 0.35, mouth: 0.08 + 0.08 * Math.abs(Math.sin(a * 30)), blush: 0.5 },
  }), fx: 'snow' },
  hot: { len: 3.0, emote: 'sweat', pose: (a) => ({
    arms: { shR: -32, elR: 182, wrR: 10 + 22 * Math.sin(a * 15) },
    add: { ay: 3, az: -4 }, face: { lids: 0.45, mouth: 0.22, blush: 0.6 },
  }) },
  bow: { len: 2.4, pose: (a) => {
    const b = smooth(0.2, 0.7, a) * (1 - smooth(1.5, 2.0, a));
    return { arms: { shR: -16, elR: 22, wrR: 0, shL: -16, elL: 22, wrL: 0 }, add: { by: 7 * b, ay: -14 * b }, face: { happy: 0.7 * b, grin: 0.3 } };
  } },
  pout: { len: 2.4, pose: (a) => ({
    arms: { shR: -14, elR: 18, shL: -14, elL: 18 },
    add: { ax: -11, az: 6, by: a < 0.6 ? 0.6 * Math.sin(a * 14) : 0 }, face: { lids: 0.25, blush: 0.55 },
  }), fx: 'hmph' },
  giggle: { len: 2.2, pose: (a) => ({
    arms: { shR: -32, elR: 182, wrR: 20 },
    add: { by: 1.3 * Math.abs(Math.sin(a * 13)), az: 4 * Math.sin(a * 6.5), ay: -2 }, face: { happy: 0.8, grin: 0.25, blush: 0.4 },
  }), fx: 'hehe' },
  smug: { len: 2.6, pose: () => ({
    arms: { shL: -32, elL: 182, wrL: 20 },
    add: { ay: 5, az: -7, ax: 4 }, face: { lids: 0.5, grin: 0.38 },
  }), fx: 'sparkle' },
  bored: { len: 3.2, emote: 'gloom', pose: (a) => ({
    arms: { shL: -32, elL: 182, wrL: 20 },
    add: { ay: -4, az: 11, by: -1.5 * Math.sin(a * 1.2) }, face: { lids: 0.6, mouth: 0 },
  }), fx: 'dots' },
  determined: { len: 2.4, pose: (a) => {
    const pump = Math.exp(-((a * 2.2) % 1) * 5) * (a < 1.9 ? 1 : 0);
    return { arms: { shR: 10, elR: 140 + 22 * pump, wrR: 6 }, add: { ay: 3, by: 1.5 * pump, ax: -3 }, face: { grin: 0.3, lids: 0.15 } };
  }, fx: 'fire' },

  // (2026-10-07, the owner: "she can eat food in the stream, alot of types of food") eating: her hand brings it to her mouth
  // twice (a bite each time: `bites`, stage.js draws the bite out of it), she chews, then a happy "mmm". A drink: two sips.
  eat: { len: 5.4, prop: 'food', bites: [1.45, 3.15], pose: (a) => eatPose(a, [1.45, 3.15], false), fx: 'mmm', fxAt: 4.5 },
  drink: { len: 4.6, prop: 'food', bites: [1.5, 3.0], pose: (a) => eatPose(a, [1.5, 3.0], true), fx: 'mmm', fxAt: 3.9 },
};
// her hand up to her mouth for each bite (or sip), her mouth opening just before, chewing after
function eatPose(a, bites, drink) {
  let u = 0, open = 0, chew = 0;
  for (const b of bites) {
    u = Math.max(u, smooth(b - 0.55, b - 0.12, a) * (1 - smooth(b + 0.25, b + 0.7, a)));
    open = Math.max(open, smooth(b - 0.4, b - 0.15, a) * (1 - smooth(b - 0.02, b + 0.08, a)));
    if (!drink && a > b + 0.1 && a < b + 1.1) chew = 0.1 + 0.12 * Math.abs(Math.sin((a - b) * 13));
  }
  const last = bites[bites.length - 1];
  const happy = smooth(last + 1.0, last + 1.3, a);
  return { arms: { shR: lerp(-45, -32, u), elR: lerp(158, 184, u), wrR: lerp(-4, 18, u) },
    add: { ay: -3 * u + 3 * happy, az: 3 * u - 4 * happy, ex: -0.1 * (1 - happy), ey: -0.3 * (1 - u) * (1 - happy) },
    face: { mouth: Math.max(open * (drink ? 0.16 : 0.45), chew), happy: happy * 0.9, grin: 0.15 + 0.3 * happy, blush: 0.25 + 0.3 * happy } };
}
export const ACTION_IDS = Object.keys(ACTIONS);

// What she does with her hands while she talks: one gesture at a time, each a second or two. Her hands come up in front of
// her chest (2026-10-07, the owner's screenshot of her first upgraded stream, "what happened here lol": with her elbow at
// 110 to 140° and her upper arm pulled in, her forearm stuck out flat to the side at her hips, which her 2D drawing can't
// show as reaching toward us: it looked like a paddle). An arm pulled in front of her (shoulder under -20°) bends its
// elbow 140° or more (her hand up by her chest or face), or stays down (45° or less): tests/stream.test.js checks it.
export const GESTURES = {
  explainR: { arms: { shR: -44, elR: 152, wrR: -8 } },
  explainL: { arms: { shL: -44, elL: 152, wrL: -8 } },
  both: { arms: { shR: -44, elR: 150, wrR: -10, shL: -44, elL: 150, wrL: -10 } },
  chest: { arms: { shR: -45, elR: 170, wrR: 8 } },
  open: { arms: { shR: -46, elR: 160, wrR: -10, shL: -46, elL: 160, wrL: -10 } },
  present: { arms: { shR: -48, elR: 155, wrR: -12 } },
  chin: { arms: { shL: -32, elL: 182, wrL: 20 } },
};
const GESTURE_IDS = Object.keys(GESTURES);
// What she does by herself while she's quiet, and how often (weights)
export const IDLES = { lookchat: 30, sip: 12, hairtuck: 12, bounce: 8, phone: 8, think: 8, stretch: 6, peace: 6, laugh: 4, heart: 4 };

// ---------- dances: on the beat (b: beats since the music's first beat) ----------
const pulse = (b) => 0.5 - 0.5 * Math.cos(Math.PI * 2 * b);          // 1 on each beat
export const DANCES = {
  // her hips sway, her forearms up in front of her swaying with her
  sway: (b, w) => {
    const sw = Math.sin(Math.PI * b), sway = Math.sin(Math.PI * b - 0.4), bob = 0.5 - 0.5 * Math.cos(Math.PI * 2 * b - 0.5);
    return { add: { hip: 0.026 * sw, bz: -5 * sw, bx: 4 * Math.sin(Math.PI * b + 0.5), by: 3 * pulse(b), az: -6 * Math.sin(Math.PI * b + 1.1), ay: 3 * Math.sin(Math.PI * 2 * b) },
      arms: { shR: 0 - 5 * sway, elR: 116 + 16 * sway + 10 * bob, wrR: 10 * sway, shL: 0 + 5 * sway, elL: 116 - 16 * sway + 10 * bob, wrL: -10 * sway } };
  },
  // her arms pump up in turn (her right on the odd beats, her left on the even ones), her head nods on every beat
  pump: (b) => {
    const k = Math.floor(b) % 2, ph = b % 1, hit = Math.exp(-ph * 5);
    const up = (side) => (side === k ? 150 - 40 * (1 - hit) : 70);
    return { add: { ay: -4 * hit, by: 2.2 * hit, hip: 0.018 * Math.sin(Math.PI * b), bz: -3 * Math.sin(Math.PI * b) },
      arms: { shR: k === 0 ? 14 : -4, elR: up(0), wrR: 6, shL: k === 1 ? 14 : -4, elL: up(1), wrL: 6 } };
  },
  // a clap on beats 2 and 4, a sway in between
  clap: (b) => {
    const beat = Math.floor(b) % 4, ph = b % 1, hit = (beat === 1 || beat === 3) ? Math.exp(-ph * 7) : 0;
    return { add: { hip: 0.022 * Math.sin(Math.PI * b), bz: -4 * Math.sin(Math.PI * b), by: 2 * pulse(b), az: -4 * Math.sin(Math.PI * b) },
      arms: { shR: -44 - 10 * hit, elR: 152 + 30 * hit, wrR: 8, shL: -44 - 10 * hit, elL: 152 + 30 * hit, wrL: 8 }, face: { grin: 0.4 } };
  },
  // both hands up, waving from side to side
  wave: (b) => {
    const s = Math.sin(Math.PI * b);
    return { add: { hip: 0.024 * s, bz: -5 * s, by: 2 * pulse(b), az: -5 * s },
      arms: { shR: 6 + 4 * s, elR: 126 - 6 * s, wrR: 18 * s, shL: 6 - 4 * s, elL: 126 + 6 * s, wrL: 18 * s }, face: { grin: 0.45 } };
  },
  // a small groove: her shoulders bounce on each beat, her head bobs, her arms swing a little
  groove: (b) => {
    const s = Math.sin(Math.PI * b), p = pulse(b);
    return { add: { by: 2.6 * p, ay: -3 * p, hip: 0.016 * s, bz: -3 * s, az: 3 * Math.sin(Math.PI * b + 0.8) },
      arms: { shR: -12 + 3 * s, elR: 18 + 14 * p, shL: -12 - 3 * s, elL: 18 + 14 * p }, face: { grin: 0.25 } };
  },
  // both hands up by her face, shaking with joy (a "yay!")
  cheer: (b) => {
    const shake = Math.sin(b * Math.PI * 2 * 2);
    return { add: { by: 2.5 * pulse(b), az: 3 * shake }, arms: { shR: 8, elR: 124 + 8 * shake, wrR: 10 * shake, shL: 8, elL: 124 + 8 * shake, wrL: 10 * shake }, face: { grin: 0.5, happy: 0.6 } };
  },
  // her right hand out to everyone ("your turn"), swaying
  present: (b) => ({ add: { hip: 0.02 * Math.sin(Math.PI * b), by: 2 * pulse(b), ax: -6 }, arms: { shR: 16, elR: 34, wrR: -12, shL: -12, elL: 20 }, face: { grin: 0.4 } }),
};
export const DANCE_IDS = ['sway', 'pump', 'clap', 'wave', 'groove'];
// (2026-10-07) a dance break or a viewer's "dance!": the routines everyone can see from afar (her arms up), no small groove
export const BIG_DANCES = ['sway', 'pump', 'clap', 'wave', 'cheer'];

// ---------- her whole figure: jumps, a twirl, moving around the set ----------
// figure: { x (metres, sideways), y (metres, up), sx, sy (her squash and stretch) }: stage.js puts her there each frame.
// A jump: a crouch, up 4.5 cm, a soft landing (0.62 s); `times` of them in a row (2026-10-07: it was 16 cm, which on her
// stream, framed waist up, is a quarter of the screen: her head left the picture and her hips came into it; 4.5 cm keeps
// the top of her head inside it). A twirl: she turns like a paper doll (narrow, then back, never mirrored: the AGI on her
// shirt never reads backwards). Moving: little hops to a new place, leaning into it and looking where she goes.
export const JUMP_S = 0.62, TWIRL_S = 0.75, MOVE_S = 1.7, JUMP_UP = 0.045;
// how far the camera moves in on her (stage.js): a streamer leaning in (`close`), and by itself now and then while she talks
// (`mid`). Gentle (2026-10-07: 1.22 and 1.1 at first, which filled the screen with her face and cut the top of her head off)
export const CAM_ZOOM = { close: 1.06, mid: 1.035 };
export function jumpAt(t) {
  const p = (t % JUMP_S) / JUMP_S;
  if (p < 0.14) { const u = Math.sin((p / 0.14) * Math.PI / 2); return { y: 0, sy: 1 - 0.05 * u, sx: 1 + 0.025 * u, air: 0 }; }
  if (p < 0.86) { const q = (p - 0.14) / 0.72; return { y: Math.sin(q * Math.PI) * JUMP_UP, sy: 1 + 0.04 * Math.cos(q * Math.PI), sx: 1 - 0.02 * Math.cos(q * Math.PI), air: Math.sin(q * Math.PI) }; }
  const u = Math.sin(((p - 0.86) / 0.14) * Math.PI);
  return { y: 0, sy: 1 - 0.04 * u, sx: 1 + 0.02 * u, air: 0 };
}

// ---------- the moves ----------
// clock(): her set's clock in ms (the page's, with the same shift as her mouth: dances line up with the music heard).
// rnd: random numbers (tests pass a seeded one).
// places(): where she may go (metres from her usual place, sideways): stage.js keeps her clear of a card or her TV
// still(): true while she mustn't do anything by herself (2026-10-07, her first trip recording: in a vehicle's seat her "think"
// idle put a "?" by her head, which flew off with the plane and stayed on screen)
export function createMoves({ clock = () => Date.now(), rnd = Math.random, onFx = () => {}, onProp = () => {}, onCam = () => {}, places = () => ({ min: -0.7, max: 0.2 }), still = () => false } = {}) {
  let action = null;             // { id, a, len }
  let gesture = null;            // { id, a, len }
  let nextGesture = 1.5, nextIdle = 8 + rnd() * 8, quiet = 0, t = 0;
  let auto = true, gestures = true, singing = false;
  let dance = null;              // { bpm, beat0 (ms), until (ms), style, beats: [s] relative to beat0, w }
  let routine = 'sway', danceW = 0;
  const drift = { x: 0, vx: 0, next: 0, tx: 0 };
  let emphasis = 0, lastLevel = 0, brows = 0, held = 0, heldPose = null;
  const face = {};
  const figure = { x: 0, y: 0, sx: 1, sy: 1 };
  let jump = null;               // { t, times }
  let twirl = null;              // { t, times }
  let walk = null;               // { t, from, to, len }
  let nextWander = 40 + rnd() * 40;
  function goTo(to, len = MOVE_S) {
    const r = places();
    const x = clamp(to, r.min, r.max);
    if (Math.abs(x - figure.x) < 0.02) return false;
    walk = { t: 0, from: figure.x, to: x, len: len * clamp(Math.abs(x - figure.x) / 0.5, 0.7, 1.4) };
    gesture = null;
    return true;
  }
  function figureFrame(dt, tg) {
    let y = 0, sx = 1, sy = 1, air = 0;
    if (jump) {
      jump.t += dt;
      if (jump.t >= jump.times * JUMP_S) jump = null;
      else ({ y, sx, sy, air } = jumpAt(jump.t));
    }
    if (twirl) {
      twirl.t += dt;
      if (twirl.t >= twirl.times * TWIRL_S) twirl = null;
      else {
        const p = (twirl.t % TWIRL_S) / TWIRL_S;
        sx *= 0.28 + 0.72 * Math.abs(Math.cos(p * Math.PI)) ** 0.6;
        y += Math.sin(p * Math.PI) * 0.05;
        tg.az += 6 * Math.sin(p * Math.PI * 2);
      }
    }
    if (walk) {
      walk.t += dt;
      const p = clamp(walk.t / walk.len, 0, 1), e = p * p * (3 - 2 * p), dir = Math.sign(walk.to - walk.from);
      figure.x = walk.from + (walk.to - walk.from) * e;
      const hop = Math.abs(Math.sin(p * Math.PI * Math.max(2, Math.round(walk.len * 1.8))));
      y += hop * 0.045 * (1 - p * 0.3);
      tg.bz -= dir * 7 * Math.sin(p * Math.PI);
      tg.ax += dir * 9 * Math.sin(p * Math.PI);
      tg.ex = clamp(tg.ex + dir * 0.5 * Math.sin(p * Math.PI), -1, 1);
      if (p >= 1) walk = null;
    }
    // in the air, her arms lift a little and she smiles
    if (air > 0) {
      for (const k of ['shR', 'shL']) tg[k] += 10 * air;
      for (const k of ['elR', 'elL']) tg[k] += 30 * air;
      face.grin = Math.max(face.grin || 0, 0.4 * air);
    }
    figure.y = y; figure.sx = sx; figure.sy = sy;
  }

  // what she carries (2026-10-07: her umbrella in the rain): her right hand stays up holding it
  let carrying = null;
  const CARRY = { umbrella: { shR: -30, elR: 176, wrR: 6 } };
  const propNow = () => (action && ACTIONS[action.id].prop) || carrying || null;
  function start(id) {
    const def = ACTIONS[id];
    if (!def) return false;
    action = { id, a: 0, len: def.len };
    if (def.fx && !def.fxAt) onFx(def.fx);
    onProp(propNow());
    if (def.cam) onCam(def.cam, def.len);
    gesture = null;
    return true;
  }
  // the beat now: beats since the music's first beat (fractional), from its tempo or its own list of beats
  function beatNow(ms) {
    if (!dance) return 0;
    const s = (ms - dance.beat0) / 1000;
    const list = dance.beats;
    if (list && list.length > 1) {
      if (s <= list[0]) return (s - list[0]) / (list[1] - list[0]);
      let lo = 0, hi = list.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (list[mid] <= s) lo = mid; else hi = mid; }
      if (s >= list[list.length - 1]) return list.length - 1 + (s - list[list.length - 1]) / (60 / (dance.bpm || 120));
      return lo + (s - list[lo]) / (list[lo + 1] - list[lo]);
    }
    return (s * (dance.bpm || 120)) / 60;
  }

  function apply(dt, tg, now) {
    t += dt;
    for (const k in face) delete face[k];
    figureFrame(dt, tg);
    const ms = clock();
    const talking = now.talking > 0.15;
    const busy = now.waving || now.cheering || now.swaying;    // her own reactions win
    quiet = talking ? 0 : quiet + dt;

    // her weight moving around her chair: a slow drift of her hips and her lean, never quite still
    if (t >= drift.next) { drift.tx = (rnd() - 0.5) * 0.024; drift.next = t + 6 + rnd() * 10; }
    drift.vx += ((drift.tx - drift.x) * 1.6 - drift.vx * 2.2) * dt;
    drift.x += drift.vx * dt;
    tg.hip += drift.x;
    tg.bz -= drift.x * 120;

    // the dance (or her song's moves): on the beat
    const dancing = dance && ms < dance.until;
    danceW += ((dancing ? 1 : 0) - danceW) * (1 - Math.exp(-dt * 4));
    if (!dancing && dance && danceW < 0.01) dance = null;
    if (danceW > 0.001 && dance && !busy) {
      const b = beatNow(ms);
      const style = dance.cues ? cueAt(dance.cues, (ms - dance.beat0) / 1000) || 'groove' : routine;
      const d = (DANCES[style] || DANCES.sway)(b, danceW);
      blend(tg, d, danceW);
      if (!dance.cues && Math.floor(b / 16) !== dance.bar) {           // a new routine every four bars
        dance.bar = Math.floor(b / 16);
        if (dance.bar > 0) routine = pick(dance.styles.filter((x) => x !== routine));
      }
    }

    // a pose held as it is (her tests, and a look at a pose)
    if (heldPose) blend(tg, { arms: heldPose }, 1);

    // an action
    if (action) {
      const def = ACTIONS[action.id], was = action.a;
      action.a += dt;
      // (a bite or a sip: stage.js draws it; an effect later in the action: its "mmm")
      for (const b of def.bites || []) if (was < b && action.a >= b) onFx('bite');
      if (def.fxAt && was < def.fxAt && action.a >= def.fxAt) onFx(def.fx);
      if (action.a >= action.len) { action = null; onProp(propNow()); }
      else if (!busy) {
        const w = env(action.a, action.len);
        const p = def.pose(action.a);
        blend(tg, p, w * (1 - danceW * 0.6));
        if (p.brows) brows = Math.max(brows, p.brows * w);
      }
    }

    // gestures while she talks (not while she dances, sings or does something else)
    if (gestures && talking && !action && danceW < 0.2 && !busy && !singing && !jump && !twirl && !walk) {
      if (!gesture && t >= nextGesture) {
        gesture = { id: pick(GESTURE_IDS), a: 0, len: 1.4 + rnd() * 1.4 };
        nextGesture = t + gesture.len + 0.6 + rnd() * 2.2;
      }
    }
    if (gesture) {
      gesture.a += dt;
      if (!talking && gesture.len > gesture.a + 0.45) gesture.len = gesture.a + 0.45;   // (she stopped: her hand comes down)
      if (gesture.a >= gesture.len) gesture = null;
      if (gesture) {
        const w = env(gesture.a, gesture.len, 0.35, 0.45);
        // a little bigger on her louder words
        const jump = now.level - lastLevel;
        if (jump > 0.35) emphasis = 1;
        emphasis *= Math.exp(-dt * 6);
        const g = GESTURES[gesture.id].arms;
        const lift = { ...g };
        for (const k of ['elR', 'elL']) if (lift[k] !== undefined) lift[k] += 10 * emphasis;
        blend(tg, { arms: lift }, w);
      }
    }
    lastLevel = now.level;

    // by herself, while she's quiet: what a streamer does between things
    const stay = still();
    if (auto && !stay && !action && !talking && danceW < 0.05 && !busy && !singing && quiet > 3.5 && t >= nextIdle) {
      start(weighted(IDLES));
      nextIdle = t + 10 + rnd() * 14;
    }
    // …and now and then she moves to another spot (and comes back toward her place later)
    if (auto && !stay && !walk && !jump && !singing && danceW < 0.05 && quiet > 2 && t >= nextWander) {
      const r = places();
      goTo(Math.abs(figure.x) > 0.15 ? figure.x * 0.2 : clamp(figure.x + (rnd() < 0.5 ? -1 : 1) * (0.18 + rnd() * 0.25), r.min, r.max));
      nextWander = t + 35 + rnd() * 50;
    }
    if (!auto || stay) nextIdle = Math.max(nextIdle, t + 6);

    // what she carries: her right hand stays up holding it
    if (carrying && CARRY[carrying]) blend(tg, { arms: CARRY[carrying] }, action && ACTIONS[action.id].prop ? 0 : 0.9);

    // while she sings: her eyes close a little on the long notes, her head tilts with the phrase
    if (singing) {
      held = now.talking > 0.6 && now.level > 0.55 ? held + dt : Math.max(0, held - dt * 2);
      face.happy = Math.max(face.happy || 0, smooth(0.45, 0.9, held) * 0.7);
      face.grin = Math.max(face.grin || 0, 0.18);
    } else held = 0;
    brows *= Math.exp(-dt * 3);
    return face;
  }
  function blend(tg, p, w) {
    if (p.arms) for (const k of ARM_KEYS) if (p.arms[k] !== undefined) tg[k] = lerp(tg[k], p.arms[k], w);
    if (p.add) for (const k of ADD_KEYS) if (p.add[k] !== undefined) tg[k] += p.add[k] * w;
    if (p.face) for (const k in p.face) face[k] = Math.max(face[k] || 0, p.face[k] * w);
  }
  function pick(list) { return list[Math.floor(rnd() * list.length)]; }
  function weighted(table) {
    const total = Object.values(table).reduce((a, b) => a + b, 0);
    let x = rnd() * total;
    for (const [k, v] of Object.entries(table)) { x -= v; if (x <= 0) return k; }
    return Object.keys(table)[0];
  }
  function cueAt(cues, s) {
    let cur = null;
    for (const c of cues) { if (c.t <= s) cur = c.move; else break; }
    return cur;
  }

  return {
    apply,
    act: (id) => start(id),
    get figure() { return figure; },
    // (2026-10-07, viewers' requests) jumps, a twirl, moving around: `times` 1 to 5
    jump(times = 1) { gesture = null; jump = { t: 0, times: clamp(Math.round(Number(times) || 1), 1, 5) }; return true; },
    twirl(times = 1) { gesture = null; twirl = { t: 0, times: clamp(Math.round(Number(times) || 1), 1, 3) }; onFx('sparkle'); return true; },
    // where: 'left', 'right', 'center' (her usual place), 'around' (left, right, then back), or metres
    move(where = 'around') {
      const r = places();
      if (where === 'around') {
        const steps = [r.min * 0.85, Math.min(r.max, 0.18), 0];
        let k = 0;
        const next = () => { if (k < steps.length) { goTo(steps[k++]); setTimeout(next, 1900); } };
        next();
        return true;
      }
      return goTo(where === 'left' ? r.min * 0.85 : where === 'right' ? r.max : where === 'center' ? 0 : Number(where) || 0);
    },
    get moving() { return Boolean(walk || jump || twirl); },
    get action() { return action?.id || null; },
    // (2026-10-07) her cartoon mark right now ({ kind, w }: outfits.js draws it) or null
    get emote() {
      if (!action) return null;
      const def = ACTIONS[action.id];
      if (!def.emote) return null;
      return { kind: def.emote, w: env(action.a, action.len, 0.2, 0.35) * (def.emoteW ? def.emoteW(action.a) : 1) };
    },
    // something she carries in her right hand for a while ('umbrella') or null
    carry(what) { carrying = CARRY[what] ? what : null; onProp(propNow()); return true; },
    get carrying() { return carrying; },
    get brows() { return brows; },
    // a dance on the beat: { bpm, beat0: when its first beat is heard (ms, her set's clock), until (ms), beats: its own beat
    // times (s, from beat0) when it has them, cues: [{ t (s), move }] (her song's moves; else a new routine every 4 bars) }
    // styles: (2026-10-07) the routines to pick from (a dance break or a viewer's "dance!": the big ones, her arms up)
    dance(d) {
      if (!d) { if (dance) dance.until = clock(); return true; }
      const styles = Array.isArray(d.styles) ? d.styles.filter((x) => DANCES[x]) : [];
      dance = { bpm: Number(d.bpm) || 120, beat0: Number(d.beat0) || clock(), until: Number(d.until) || clock() + 30_000,
        beats: Array.isArray(d.beats) ? d.beats.map(Number) : null, cues: Array.isArray(d.cues) && d.cues.length ? d.cues : null, bar: 0,
        styles: styles.length > 1 ? styles : DANCE_IDS };
      routine = d.style && DANCES[d.style] ? d.style : pick(dance.styles);
      return true;
    },
    get dancing() { return Boolean(dance && clock() < dance.until); },
    get routine() { return routine; },
    sing(on) { singing = Boolean(on); return true; },
    hold(pose) { heldPose = pose && typeof pose === 'object' ? pose : null; return true; },
    auto(on) { auto = Boolean(on); return true; },
    gestures(on) { gestures = Boolean(on); return true; },
  };
}
