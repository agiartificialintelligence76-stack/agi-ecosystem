// AGI-1's live show (2026-10-07, the owner: "add more actions", "can dance", "move not just steady", "make her act like a
// real streamer"): more of her body on stream, on top of the site's own controller (src/stage/agi1-2d.js: her breathing,
// blinking, looking around, her reactions). Her controller calls apply() every frame (its `moves` option, only on her
// show), which adds to her pose's targets:
//   • actions: a laugh, a surprise, thinking, presenting the card, clapping, a blown kiss, a little wave with a wink, an
//     excited bounce, a stretch, a sip from her mug, showing her phone, her hand in her hair, a shrug, a glance at the
//     chat, her emotions, eating and drinking;
//   • gestures while she talks, now and then (a palm up at her side, her hand in her hair, her fingertips at her chin, an
//     open "you know?"), a little
//     bigger on her louder words;
//   • by herself, now and then, while she's quiet: what a streamer does between things (a sip, a stretch, a look at chat…);
//   • dances on the beat of her music (a sway, her hands up in turn, claps, hands waving, a cheer, a groove), and her moves while she
//     sings her song;
//   • her weight moving around her chair, never quite still.
// (2026-10-08, the owner: "her arms doesnt even move naturally lol it so bad and clnky looks and when she holds things she
// doesnt even look shes holding it") Her poses say where her hands go, by her face (her mouth, her chin, her cheeks, her
// eyes: they follow her head as it moves) or her body (her shoulders), which way they point and how curled her fingers
// are: her arm reaches there (src/stage/agi1-2d-arms.js reach: her elbow comes forward, her forearm toward us). A hand by
// her face is drawn over it (`front`). Her hand is one drawing, her palm, so every pose shows her palm, her own hand the
// right way round: a wave, her hands up ("yay!"), by her face, over her mouth, her fingertips at her lips, behind her head
// or in her hair, palms out low, on her hips. Never her palm drawing flipped to stand in for the back of her hand (the
// owner, of her hands on her cheeks: "why did you switched her hands": a flipped palm is her other hand's), never turned
// past HAND_TURN (a hand turned further is squeezed thin: "are you even fixing it lol"), never a fist (one cut from her
// drawing read as a claw), her fingers relaxed (CURL.open; holding something, CURL.hold). What she holds is in front of her
// palm, her fingers drawn again over it (HOLD, outfits.js): a cookie at her fingertips, her mug and a drink in both hands,
// her phone with her thumb over its edge. Her hands stay off her chest (PG-13: by her face, at her sides, or low). Her
// right hand leads, her left a moment behind, never in lockstep. Her upper arms never lift past what her drawing allows
// (REACH): her hands go up by bending her elbows. Angles in degrees (shoulder > 0 lifts the arm away from her body, elbow
// > 0 turns the forearm up and out, < 0 in across her body); R is her right arm, on the left of the picture.
import { reach } from '../../../src/stage/agi1-2d-arms.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const RAD = Math.PI / 180;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
// a move's weight over its time: in, hold, out
const env = (a, len, inT = 0.42, outT = 0.5) => smooth(0, inT, a) * (1 - smooth(len - outT, len, a));
const ARM_KEYS = ['shR', 'elR', 'wrR', 'upR', 'foR', 'twR', 'cuR', 'shL', 'elL', 'wrL', 'upL', 'foL', 'twL', 'cuL'];
const ADD_KEYS = ['ax', 'ay', 'az', 'ex', 'ey', 'bx', 'by', 'bz', 'hip'];
// (her arms as drawn, her hand palm to us, her fingers straight: when her controller hasn't set them)
const ARM_DEFAULT = { upR: 1, upL: 1, foR: 1, foL: 1, twR: 0, twL: 0, cuR: 0, cuL: 0 };
// her left hand a moment behind her right (s)
const LAG = 0.08;

// ---------- where her hands go ----------
// Her body at rest (her model, measured with src/stage/agi1-2d-arms.js measureArm, model units): her arms as they hang (her
// shoulder, then her upper arm, forearm and hand), and the spots of her face and body her hands go to (her face's width:
// `fw`). On her set they come from her model every frame (outfits.js anchors, as she moves); these are for working a pose
// out without her model (tests).
const BASE = (S, up, fo, ha) => ({ S, up, fo, ha });
export const REST_ARMS = {
  R: { sign: -1, inward: 1, now: { base: BASE([-0.12354, 0.36389], [-0.07492, -0.1738], [-0.0967, -0.13919], [-0.05907, -0.12468]) } },
  L: { sign: 1, inward: -1, now: { base: BASE([0.11546, 0.35854], [0.07921, -0.16834], [0.10004, -0.13689], [0.05878, -0.12737]) } },
};
export const SPOTS_REST = {
  mouth: [0.0015, 0.53], chin: [-0.001, 0.489], cheekR: [-0.058, 0.545], cheekL: [0.06, 0.545], eyeR: [-0.035, 0.5775],
  eyeL: [0.038, 0.577], earR: [-0.0635, 0.5645], earL: [0.0685, 0.5645], top: [0, 0.736], face: [-0.001, 0.58],
  shoulderR: [-0.12354, 0.36389], shoulderL: [0.11546, 0.35854], fw: 0.148, roll: 0,
};
// the spots on her face (they turn with her head; the rest stay as her body has them)
const ON_FACE = new Set(['mouth', 'chin', 'cheekR', 'cheekL', 'eyeR', 'eyeL', 'earR', 'earL', 'top', 'face']);
// What she holds, and how (2026-10-08; it floated past her fingertips, her open hand under it, the owner's screenshots;
// then of a cookie in front of her hand: "she doesnt even grabbed it lol"). Her hand is drawn open, palm to us, so it
// holds things the way a hand seen from its palm's side does: a cup or her phone in front of her palm, hiding it, her thumb
// round its edge, her wrist under it; a snack up at her fingertips, her fingertips over its bottom. In her hand's own frame
// (src/stage/agi1-2d-arms.js HAND: along her hand from her wrist to her fingertips, across it from her thumb's side to her
// little finger's, in hand lengths): where its middle is (a, b), its width (w, hand lengths; its height from its
// picture), its turn from her hand's direction (rot, degrees) or how much it stays upright instead (upright 0..1), and
// which part of her hand is drawn again in front of it (grip): her thumb ('thumb'), or her fingers and her thumb
// ('fingers'); the rest of her hand is behind it. Her poses put that point where it should be (her mug's rim at her
// lips). Tuned by eye, up close, at the stream's size.
export const HOLD = {
  // her phone up beside her face, its screen to us (she shows it)
  phone: { a: 0.62, b: 0.02, w: 0.44, upright: 1, grip: 'thumb' },
  // her mug, its rim at her lips
  mug: { a: 0.62, b: 0.02, w: 0.8, upright: 1, grip: 'thumb' },
  // a snack up at her fingertips
  food: { a: 1.0, b: -0.06, w: 0.62, upright: 1, grip: 'fingers' },
  // a drink (food.js: boba, a coconut…), its straw at her lips
  drink: { a: 0.62, b: 0, w: 0.85, upright: 1, grip: 'thumb' },
};
// how far her hand ever turns about its length (degrees: a hand turned 40° is 0.81 as wide; past that it's squeezed thin),
// and how curled her fingers are: relaxed (at most), and round something she holds (at most)
export const HAND_TURN = 40;
// how much shorter her forearm is seen at most on its way (moves.apply): when it still has far to go, and (TRANSIT_DIP)
// halfway into or out of a pose that turns it a lot (from her side up to her face)
export const SWING_DIP = 0.5;
export const TRANSIT_DIP = 0.75, TRANSIT_TAIL = 0.35;
export const CURL = { open: 0.35, hold: 0.5 };
// A hand's spot: `to` one of the spots above, offset by (dx, dy) of her face's width (on her face: turning with her head),
// her hand pointing `deg` (90 up; on her face: plus her head's tilt), the point of her hand that goes there (a along it, b
// across: HAND's frame; HOLD's point for something she holds), turned `tw` (degrees) and curled `cu` (0..1), her shoulder
// near `sh`, her forearm up across her body (bend 'in') or out to her side ('out'), drawn over her face (front).
const at = (to, dx, dy, deg, o = {}) => ({ to, dx, dy, deg, ...o });
const holding = (what, o = {}) => ({ a: HOLD[what].a, b: HOLD[what].b, ...o });
// her left hand where her right is, mirrored (her face's spots swapped)
const SWAP = { cheekR: 'cheekL', cheekL: 'cheekR', eyeR: 'eyeL', eyeL: 'eyeR', earR: 'earL', earL: 'earR', shoulderR: 'shoulderL', shoulderL: 'shoulderR' };
const mirror = (h) => (h.mix ? { mix: [mirror(h.mix[0]), mirror(h.mix[1]), h.mix[2]] }
  : { ...h, to: SWAP[h.to] || h.to, dx: -(h.dx || 0), deg: 180 - (h.deg ?? 90) });
const both = (h, o = {}) => ({ R: { ...h, ...o }, L: { ...mirror(h), ...o } });
// her hand on its way between two spots (u: 0 at the first, 1 at the second): her arm moves between the two, joint by
// joint, so her hand comes along an arc, as a real arm's does
const between = (h1, h2, u) => (u <= 0 ? h1 : u >= 1 ? h2 : { mix: [h1, h2, u] });

// A spot → her arm's targets (shoulder, upper, elbow, wrist, fore, twist, curl). `body`: her model's arms and spots this
// frame (or her rest, for tests); `hint`: where her elbow is now (so her arm never flips round).
const tmpSpot = [0, 0];
function spotOf(h, spots) {
  const s = spots[h.to] || spots.chin, fw = spots.fw;
  const dx = (h.dx || 0) * fw, dy = (h.dy || 0) * fw;
  if (ON_FACE.has(h.to)) {
    const c = Math.cos(spots.roll || 0), sn = Math.sin(spots.roll || 0);
    tmpSpot[0] = s[0] + dx * c - dy * sn; tmpSpot[1] = s[1] + dx * sn + dy * c;
    return (h.deg ?? 90) + ((spots.roll || 0) * 180) / Math.PI;
  }
  tmpSpot[0] = s[0] + dx; tmpSpot[1] = s[1] + dy;
  return h.deg ?? 90;
}
export function armFor(side, h, { arms = REST_ARMS, spots = SPOTS_REST, hint = null } = {}) {
  if (h.mix) {
    // (the second spot's elbow the nearest turn from the first's, whichever way it would come up from her side: a blown
    // kiss went from her lips down across her chest and back up to her cheek, 2026-10-08)
    const [h1, h2, u] = h.mix, p = armFor(side, h1, { arms, spots, hint }), q = armFor(side, { ...h2, bend: null }, { arms, spots, hint: { elbow: p[`el${side}`] } });
    const e = u * u * (3 - 2 * u), out = {};
    for (const k in p) out[k] = lerp(p[k], q[k], e);
    return out;
  }
  const deg = spotOf(h, spots);
  const r = reach(arms[side], tmpSpot[0], tmpSpot[1], deg, { a: h.a ?? 0.4, b: h.b ?? 0, twist: h.tw || 0, curl: h.cu || 0,
    shoulder: h.sh ?? -10, hint, bend: h.bend ?? null });
  return { [`sh${side}`]: r.shoulder, [`up${side}`]: r.upper, [`el${side}`]: r.elbow, [`wr${side}`]: r.wrist, [`fo${side}`]: r.fore,
    [`tw${side}`]: h.tw || 0, [`cu${side}`]: h.cu || 0 };
}
// a pose's hands as her arms' targets, worked out at rest (tests, and a look at a pose without her model)
export function restArms(hands) {
  const out = {};
  for (const side of ['R', 'L']) if (hands?.[side]) Object.assign(out, armFor(side, hands[side]));
  return out;
}

// Each action: its length (s) and, at its own time `a` (s), { hands: where her hands go (R, L), arms: her arms' targets
// as angles instead, add: added to her head, eyes and body, face: her face's extras }, prop: what she holds, fx: an effect
// to ask the page for (at fxAt s, else as it starts). Each is blended in and out by its weight (env).
// (her hand by her face: drawn over it; her elbow bends the shorter way from where it is)
const FRONT = { front: true };
// her hand up beside her head, her palm to us (a "yay!", a cheer, a stretch, her dances)
const UP = { a: 0.4, cu: 0.12, sh: 10, bend: 'out' };
const up = (dx, dy, deg = 95) => at('earR', dx, dy, deg, UP);
// her hands on her hips (her elbows out)
const ON_HIPS = at('shoulderR', -0.35, -1.45, -55, { a: 0.3, cu: 0.3, sh: 16, bend: 'out' });
// her palms up low at her sides
const PALMS_LOW = at('shoulderR', -0.6, -0.35, 140, { a: 0.35, cu: 0.15, sh: 8, bend: 'out' });
// her hand over her mouth, her fingers across it; her fingertips at her lips
const OVER_MOUTH = at('mouth', -0.2, -0.12, 22, { a: 0.6, cu: 0.3, ...FRONT });
const AT_LIPS = at('mouth', -0.04, 0, 80, { a: 0.92, cu: 0.3, ...FRONT });
export const ACTIONS = {
  // her hand over her mouth as she laughs, her shoulders bouncing
  laugh: { len: 2.3, pose: (a) => ({
    hands: { R: OVER_MOUTH },
    add: { az: 5 * Math.sin(a * 13), ay: -3 + 2 * Math.sin(a * 13), by: 1.6 * Math.abs(Math.sin(a * 13)) },
    face: { happy: smooth(0.1, 0.25, a) * (1 - smooth(1.9, 2.2, a)), grin: 0.5, mouth: 0.3 + 0.12 * Math.abs(Math.sin(a * 13)), blush: 0.4 },
  }), fx: 'laugh' },
  // both hands up beside her face ("oh!")
  surprised: { len: 1.8, pose: (a) => ({
    hands: both(at('cheekR', -0.3, -0.36, 94, { a: 0.45, cu: 0.18, ...FRONT })),
    add: { by: -3 * smooth(0, 0.15, a), ay: 6, ex: 0, ey: 0.15 },
    face: { mouth: 0.62 * env(a, 1.8, 0.08, 0.5), blush: 0.2 }, brows: 1,
  }), fx: 'surprise' },
  // her fingertips at her chin, looking up ("hmm")
  think: { len: 3.2, pose: () => ({
    hands: { R: at('chin', -0.3, 0.02, 72, { a: 0.85, cu: 0.32, ...FRONT }) },
    add: { az: 8, ax: -5, ex: -0.55, ey: 0.6 },
    face: { lids: 0.35, mouth: 0 },
  }) },
  // her hand out to her side, palm up, toward the card ("here's the question")
  present: { len: 2.6, pose: () => ({
    hands: { R: at('shoulderR', -0.85, 0.42, 150, { a: 0.35, cu: 0.15, sh: 12, bend: 'out' }) },
    add: { ax: -10, az: -3, ex: -0.8, ey: 0.05, bz: 2 },
    face: { grin: 0.28 },
  }) },
  // claps in front of her chin: her hands together (turned toward each other as far as a hand turns), apart a little
  // between (never in front of her chest: 2026-10-08, up by her chin, they were at her neckline)
  clap: { len: 2.2, pose: (a) => {
    const c = 0.5 - 0.5 * Math.cos(a * Math.PI * 2 * 3);
    return { hands: both(at('chin', -0.1 - 0.22 * (1 - c), -0.06, 84, { a: 0.6, tw: HAND_TURN, cu: 0.1, ...FRONT })),
      add: { by: 1.2 * c, ay: -2 * c }, face: { grin: 0.42, happy: 0.4 } };
  }, fx: 'clap' },
  // a kiss blown to everyone: her fingertips at her lips, then her hand out to us, and hearts
  heart: { len: 2.6, pose: (a) => {
    const u = smooth(0.95, 1.45, a);
    return { hands: { R: between(AT_LIPS, at('cheekR', -0.75, -0.15, 110, { a: 0.4, cu: 0.1, sh: 4, bend: 'out' }), u) },
      add: { az: -4 + 6 * u, by: 1 }, face: { blush: 0.8, grin: 0.15 + 0.3 * u, happy: 0.6 * u, mouth: 0 } };
  }, fx: 'hearts', fxAt: 1.15 },
  // a little wave by her cheek, with a wink
  peace: { len: 2.3, pose: (a) => ({
    hands: { R: at('cheekR', -0.62, -0.06, 98 + 9 * Math.sin(a * 9), { a: 0.35, cu: 0.2, sh: 0, bend: 'out' }) },
    add: { az: -9, ax: 4 },
    face: { grin: 0.4, winkR: smooth(0.2, 0.35, a) * (1 - smooth(1.6, 1.8, a)), blush: 0.3 },
  }), fx: 'sparkle' },
  // her hands up by her shoulders, bouncing
  bounce: { len: 1.8, pose: (a) => {
    const b = Math.abs(Math.sin(a * 9));
    return { hands: both(up(-0.85, -0.3 + 0.1 * b)),
      add: { by: 2.4 * b, hip: 0.008 * Math.sin(a * 9), az: 3 * Math.sin(a * 4.5) }, face: { grin: 0.45 } };
  } },
  // a stretch with a yawn: her left hand up high, her right over her mouth
  stretch: { len: 3.6, pose: (a) => {
    const lift = smooth(0.3, 1.1, a) * (1 - smooth(2.6, 3.4, a));
    return { hands: { L: mirror(up(-0.95, 0.05 + 0.35 * lift)), R: OVER_MOUTH },
      add: { by: -3 * lift, ay: 7 * lift, az: 4 * lift },
      face: { happy: lift, mouth: 0.68 * smooth(0.9, 1.3, a) * (1 - smooth(1.9, 2.4, a)) } };
  } },
  // her mug: up beside her chin, to her lips, a sip, down again
  sip: { len: 3.4, prop: 'mug', pose: (a) => {
    const u = smooth(0.85, 1.3, a) * (1 - smooth(2.2, 2.65, a));
    const hold = holding('mug', { cu: CURL.hold, ...FRONT });
    return { hands: { R: between(at('chin', -0.62, 0.1, 82, hold), at('mouth', -0.04, -0.3, 82, hold), u) },
      add: { ay: -2 - 4 * u, az: 2 * u, ex: -0.1, ey: -0.3 * u }, face: { happy: u * 0.9, mouth: 0 } };
  } },
  // her phone held up beside her face, its screen to everyone: a glance at it, then a smile at us
  phone: { len: 3.8, prop: 'phone', pose: (a) => {
    const look = smooth(0.5, 0.9, a) * (1 - smooth(1.9, 2.3, a));
    return { hands: { R: at('cheekR', -0.75, -0.35, 85, holding('phone', { cu: 0.3, sh: 2, bend: 'out' })) },
      add: { ay: -2 * look, ax: -5 * look, ex: -0.6 * look, ey: -0.1 * look },
      face: { grin: a > 2.1 ? 0.45 : 0.12, happy: a > 2.4 ? 0.6 : 0 } };
  } },
  // her left hand in her hair beside her ear, smoothing it down
  hairtuck: { len: 2.3, pose: (a) => ({
    hands: { L: at('earL', 0.25, -0.1 - 0.18 * smooth(0.6, 1.6, a), 100, { a: 0.55, cu: 0.25 }) },
    add: { az: 8, ax: 3 },
    face: { grin: 0.18, blush: 0.35, lids: 0.3 },
  }) },
  // her palms up low at her sides
  shrug: { len: 1.9, pose: () => ({
    hands: both(PALMS_LOW),
    add: { by: 2.4, az: 9 },
    face: { grin: 0.12, lids: 0.3 },
  }) },
  lookchat: { len: 2.6, pose: (a) => ({
    add: { ax: -9, ay: -4, ex: -0.9, ey: -0.35 },
    face: { grin: a > 1.5 ? 0.3 : 0.05 },
  }) },
  lean: { len: 3.4, pose: () => ({ add: { by: 3.5, ay: -2 }, face: { grin: 0.25 } }), cam: 'close' },
  // (2026-10-07, viewers' requests) a blush: her hands up beside her jaw, looking down and away, her cheeks pink
  blush: { len: 2.8, pose: () => ({
    hands: both(at('cheekR', -0.24, -0.46, 88, { a: 0.5, cu: 0.25, ...FRONT })),
    add: { ax: -6, ay: -6, az: 6, ex: -0.6, ey: -0.7 },
    face: { blush: 1, lids: 0.65, grin: 0.12 },
  }), fx: 'hearts-small' },
  // a wink, her head tilted, a little sparkle
  wink: { len: 1.6, pose: (a) => ({
    add: { az: -8, ax: 3 },
    face: { winkR: smooth(0.15, 0.3, a) * (1 - smooth(1.0, 1.3, a)), grin: 0.4, blush: 0.25 },
  }), fx: 'sparkle' },

  // (2026-10-07, the owner: "add more emotions as well") her emotions (server/live-acts.js EMOTIONS: the same names): her
  // face, her body and a cartoon mark on her face (`emote`: outfits.js draws it, heart eyes, tears…) or on the set (`fx`).
  // Always cute and PG-13: a playful pout, never mean.
  // her hands on her hips, leaning in, "hmph"
  angry: { len: 2.6, emote: 'vein', pose: (a) => ({
    hands: both(ON_HIPS),
    add: { ax: 10 * smooth(0.2, 0.5, a), az: -5, by: 0.8 * Math.sin(a * 16), ey: 0.1 },
    face: { lids: 0.3, blush: 0.5 },
  }), fx: 'hmph' },
  // the backs of her hands wiping her eyes, then a smile through it
  cry: { len: 3.4, emote: 'tears', emoteW: (a) => 1 - smooth(2.4, 2.8, a), pose: (a) => {
    const sob = Math.abs(Math.sin(a * 9)), end = smooth(2.5, 3.0, a), rub = 0.05 * Math.sin(a * 7);
    return { hands: both(at('eyeR', -0.22 + rub, -0.2 - 0.5 * end, 76, { a: 0.35, cu: 0.3, ...FRONT })),
      add: { ay: -6 * (1 - end) + 2 * end, by: 1.2 * sob * (1 - end), az: 3 * Math.sin(a * 4) },
      face: { lids: 0.75 * (1 - end), mouth: (0.22 + 0.12 * sob) * (1 - end), happy: end * 0.8, grin: end * 0.35, blush: 0.4 } };
  } },
  // "eek!": her hands up in front of her, palms out, trembling, leaning away
  scared: { len: 2.4, emote: 'sweat', pose: (a) => ({
    hands: both(at('cheekR', -0.78, 0.02 + 0.025 * Math.sin(a * 40), 96, { a: 0.4, cu: 0.18, sh: 0, bend: 'out' })),
    add: { az: 2.2 * Math.sin(a * 42), ax: 1.5 * Math.sin(a * 37), by: -2.5, ay: -2, ey: 0.15 },
    face: { mouth: 0.32, blush: 0.15 }, brows: 1,
  }), fx: 'bang' },
  // a yawn behind her hand, then she rubs an eye with the back of it
  sleepy: { len: 3.8, pose: (a) => {
    const yawn = smooth(0.5, 1.1, a) * (1 - smooth(1.9, 2.4, a)), rub = smooth(2.3, 2.7, a);
    const eye = at('eyeR', -0.2 + 0.04 * Math.sin(a * 8), -0.18, 76, { a: 0.35, cu: 0.3, ...FRONT });
    return { hands: { R: between(OVER_MOUTH, eye, rub) }, add: { az: 8, ay: 3 * yawn - 2, ex: 0.1 },
      face: { mouth: 0.72 * yawn, lids: 0.6 + 0.3 * yawn, happy: 0.4 * (1 - yawn) } };
  }, fx: 'zzz' },
  // her hands up beside her head, shaking with excitement ("yay!")
  excited: { len: 2.4, emote: 'stars', pose: (a) => {
    const shake = Math.sin(a * Math.PI * 2 * 2.2);
    return { hands: both(up(-0.9, 0.2 + 0.05 * shake)),
      add: { by: 2.2 * Math.abs(Math.sin(a * 9)), az: 3 * shake }, face: { grin: 0.55 } };
  }, fx: 'sparkle' },
  // her head on her hand, swaying, dreamy
  lovestruck: { len: 3.0, emote: 'hearts', pose: (a) => ({
    hands: { R: at('cheekR', -0.3, -0.28, 84, { a: 0.45, cu: 0.2, ...FRONT }) },
    add: { az: 5 + 4 * Math.sin(a * 2.4), ay: 3, by: 1 }, face: { blush: 1, grin: 0.35 },
  }), fx: 'hearts' },
  // "I don't know?": her palms up low at her sides, her head tilted
  confused: { len: 2.6, pose: () => ({
    hands: both(PALMS_LOW),
    add: { az: 13, ax: 4, ex: 0.3, ey: 0.5 }, face: { lids: 0.2, mouth: 0.08 },
  }), fx: 'think' },
  dizzy: { len: 2.8, emote: 'spiral', pose: (a) => ({
    arms: { shR: 4 + 4 * Math.sin(a * 5), elR: 24, shL: 4 - 4 * Math.sin(a * 5), elL: 24 },
    add: { az: 9 * Math.sin(a * 5), bz: 6 * Math.cos(a * 5), ax: 6 * Math.sin(a * 5 + 1), hip: 0.01 * Math.sin(a * 5) },
    face: { mouth: 0.2, grin: 0.1 },
  }) },
  // a hand behind her head, a nervous little laugh ("ehehe")
  nervous: { len: 2.6, emote: 'sweat', pose: (a) => ({
    hands: { R: at('earR', -0.15, 0.1 + 0.03 * Math.sin(a * 9), 75, { a: 0.6, cu: 0.25 }) },
    add: { az: 3 * Math.sin(a * 3), ex: 0.4 * Math.sin(a * 2), ey: -0.2 },
    face: { grin: 0.3, mouth: 0.1 + 0.06 * Math.abs(Math.sin(a * 14)), blush: 0.35 },
  }) },
  // her hands on her hips, her chin up
  proud: { len: 2.6, pose: () => ({
    hands: both(ON_HIPS),
    add: { ay: 7, az: -4, by: -1.5 }, face: { happy: 0.75, grin: 0.45 },
  }), fx: 'sparkle' },
  // her hands up beside her face, her mouth open
  shocked: { len: 2.0, pose: (a) => ({
    hands: both(at('cheekR', -0.34, -0.06, 96, { a: 0.45, cu: 0.15, ...FRONT })),
    add: { by: -3 * smooth(0, 0.12, a), ay: 4, ey: 0.15 }, face: { mouth: 0.7 * env(a, 2.0, 0.08, 0.5) }, brows: 1,
  }), fx: 'bang' },
  // her arms tight to her sides, her shoulders up, shivering
  cold: { len: 3.0, pose: (a) => ({
    arms: { shR: -16, elR: 14, shL: -16, elL: 14 },
    add: { az: 1.6 * Math.sin(a * 46), by: -2, ay: -3 }, face: { lids: 0.35, mouth: 0.08 + 0.08 * Math.abs(Math.sin(a * 30)), blush: 0.5 },
  }), fx: 'snow' },
  // fanning herself with her hand
  hot: { len: 3.0, emote: 'sweat', pose: (a) => ({
    hands: { R: at('cheekR', -0.72, -0.08, 100 + 18 * Math.sin(a * 15), { a: 0.35, cu: 0.12, sh: 0, bend: 'out' }) },
    add: { ay: 3, az: -4 }, face: { lids: 0.45, mouth: 0.22, blush: 0.6 },
  }) },
  bow: { len: 2.4, pose: (a) => {
    const b = smooth(0.2, 0.7, a) * (1 - smooth(1.5, 2.0, a));
    return { arms: { shR: -16, elR: 22, wrR: 0, shL: -16, elL: 22, wrL: 0 }, add: { by: 7 * b, ay: -14 * b }, face: { happy: 0.7 * b, grin: 0.3 } };
  } },
  // "hmph": her arms down at her sides, her head turned away
  pout: { len: 2.4, pose: (a) => ({
    arms: { shR: -10, elR: 6, shL: -10, elL: 6 },
    add: { ax: -11, az: 6, by: a < 0.6 ? 0.6 * Math.sin(a * 14) : 0 }, face: { lids: 0.25, blush: 0.55 },
  }), fx: 'hmph' },
  // a giggle, her fingertips at her lips
  giggle: { len: 2.2, pose: (a) => ({
    hands: { R: AT_LIPS },
    add: { by: 1.3 * Math.abs(Math.sin(a * 13)), az: 4 * Math.sin(a * 6.5), ay: -2 }, face: { happy: 0.8, grin: 0.25, blush: 0.4 },
  }), fx: 'hehe' },
  // "ohoho": her hand by her mouth, her chin up
  smug: { len: 2.6, pose: () => ({
    hands: { L: mirror(OVER_MOUTH) },
    add: { ay: 5, az: -7, ax: 4 }, face: { lids: 0.5, grin: 0.38 },
  }), fx: 'sparkle' },
  // her cheek on her hand
  bored: { len: 3.2, emote: 'gloom', pose: (a) => ({
    hands: { R: at('cheekR', -0.12, -0.5, 66, { a: 0.5, cu: 0.3, ...FRONT }) },
    add: { ay: -4, az: 11, by: -1.5 * Math.sin(a * 1.2) }, face: { lids: 0.6, mouth: 0 },
  }), fx: 'dots' },
  // "let's go!": her hand up beside her head, a pump or two
  determined: { len: 2.4, pose: (a) => {
    const pump = Math.exp(-((a * 2.2) % 1) * 5) * (a < 1.9 ? 1 : 0);
    return { hands: { R: up(-0.85, 0.05 + 0.22 * pump) },
      add: { ay: 3, by: 1.5 * pump, ax: -3 }, face: { grin: 0.3, lids: 0.15 } };
  }, fx: 'fire' },

  // (2026-10-07, the owner: "she can eat food in the stream, alot of types of food") eating: up beside her chin, then to
  // her mouth twice (a bite each time: `bites`, stage.js draws the bite out of it), she chews, then a happy "mmm". A
  // drink: in both hands, two sips through its straw.
  eat: { len: 5.4, prop: 'food', bites: [1.45, 3.15], pose: (a) => eatPose(a, [1.45, 3.15], false), fx: 'mmm', fxAt: 4.5 },
  drink: { len: 4.6, prop: 'food', bites: [1.5, 3.0], pose: (a) => eatPose(a, [1.5, 3.0], true), fx: 'mmm', fxAt: 3.9 },
};
// her hand up to her mouth for each bite (or sip), her mouth opening just before, chewing after
function eatPose(a, bites, drink) {
  let u = 0, open = 0, chew = 0;
  for (const b of bites) {
    u = Math.max(u, smooth(b - 0.55, b - 0.1, a) * (1 - smooth(b + 0.25, b + 0.7, a)));
    open = Math.max(open, smooth(b - 0.4, b - 0.15, a) * (1 - smooth(b - 0.02, b + 0.08, a)));
    if (!drink && a > b + 0.1 && a < b + 1.1) chew = 0.1 + 0.12 * Math.abs(Math.sin((a - b) * 13));
  }
  const last = bites[bites.length - 1];
  const happy = smooth(last + 1.0, last + 1.3, a);
  const add = { ay: -3 * u + 3 * happy, az: 3 * u - 4 * happy, ex: -0.1 * (1 - happy), ey: -0.3 * (1 - u) * (1 - happy) };
  const face = { mouth: Math.max(open * (drink ? 0.16 : 0.45), chew), happy: happy * 0.9, grin: 0.15 + 0.3 * happy, blush: 0.25 + 0.3 * happy };
  // up beside her chin, then to her mouth: a drink's straw at her lips, a snack's top
  const hold = drink ? holding('drink', { cu: CURL.hold, ...FRONT }) : holding('food', { cu: 0.32, ...FRONT });
  const lips = drink ? at('mouth', -0.04, -0.36, 82, hold) : at('mouth', -0.04, -0.26, 80, hold);
  return { hands: { R: between(at('chin', -0.62, drink ? 0.1 : 0.02, 81, hold), lips, u) }, add, face };
}
export const ACTION_IDS = Object.keys(ACTIONS);
// which of her actions use her right hand (her umbrella is in it: she puts it down for them)
export const USES_R = Object.fromEntries(Object.entries(ACTIONS).map(([id, d]) => {
  const p = d.pose(d.len / 2);
  return [id, Boolean(p.hands?.R || (p.arms && p.arms.shR !== undefined))];
}));

// What she does with her hands while she talks: now and then (not all the time: a streamer mostly talks with her face), one
// hand, a couple of seconds, moving a little as she speaks and a little more on her louder words. Never flat palms up by her
// chest (the owner's screenshot, 2026-10-08), never a forearm stuck out flat (2026-10-07).
export const GESTURES = {
  // a palm up out at her side ("so…")
  side: { hands: { R: at('shoulderR', -0.62, -0.32, 138, { a: 0.35, cu: 0.15, sh: 6, bend: 'out' }) } },
  sideL: { hands: { L: at('shoulderL', 0.62, -0.32, 42, { a: 0.35, cu: 0.15, sh: 6, bend: 'out' }) } },
  // her hand in her hair
  hair: { hands: { L: at('earL', 0.25, -0.12, 100, { a: 0.55, cu: 0.25 }) } },
  // her fingertips at her chin
  chin: { hands: { R: at('chin', -0.3, 0.02, 72, { a: 0.85, cu: 0.32, ...FRONT }) } },
  // both palms up low ("you know?")
  open: { hands: both(PALMS_LOW) },
};
const GESTURE_IDS = Object.keys(GESTURES);
// What she does by herself while she's quiet, and how often (weights)
export const IDLES = { lookchat: 30, sip: 12, hairtuck: 12, bounce: 8, phone: 8, think: 8, stretch: 6, peace: 6, laugh: 4, heart: 4 };

// ---------- dances: on the beat (b: beats since the music's first beat) ----------
const pulse = (b) => 0.5 - 0.5 * Math.cos(Math.PI * 2 * b);          // 1 on each beat
export const DANCES = {
  // her hips sway, her hands up beside her head swaying with her
  sway: (b) => {
    const sw = Math.sin(Math.PI * b), sway = Math.sin(Math.PI * b - 0.4), bob = 0.5 - 0.5 * Math.cos(Math.PI * 2 * b - 0.5);
    return { add: { hip: 0.026 * sw, bz: -5 * sw, bx: 4 * Math.sin(Math.PI * b + 0.5), by: 3 * pulse(b), az: -6 * Math.sin(Math.PI * b + 1.1), ay: 3 * Math.sin(Math.PI * 2 * b) },
      hands: { R: up(-0.9 - 0.12 * sway, 0.1 + 0.12 * bob), L: mirror(up(-0.9 + 0.12 * sway, 0.1 + 0.12 * bob)) } };
  },
  // her hands up in turn (her right on the odd beats, her left on the even ones), her head nodding on every beat
  pump: (b) => {
    const k = Math.floor(b) % 2, ph = b % 1, hit = Math.exp(-ph * 5);
    const hand = (side) => up(-0.88, side === k ? 0.05 + 0.3 * hit : -0.28);
    return { add: { ay: -4 * hit, by: 2.2 * hit, hip: 0.018 * Math.sin(Math.PI * b), bz: -3 * Math.sin(Math.PI * b) },
      hands: { R: hand(0), L: mirror(hand(1)) } };
  },
  // a clap on beats 2 and 4 in front of her chin, a sway in between
  clap: (b) => {
    const beat = Math.floor(b) % 4, ph = b % 1, hit = (beat === 1 || beat === 3) ? Math.exp(-ph * 7) : 0;
    return { add: { hip: 0.022 * Math.sin(Math.PI * b), bz: -4 * Math.sin(Math.PI * b), by: 2 * pulse(b), az: -4 * Math.sin(Math.PI * b) },
      hands: both(at('chin', -0.1 - 0.22 * (1 - hit), -0.06, 84, { a: 0.6, tw: HAND_TURN, cu: 0.1, ...FRONT })), face: { grin: 0.4 } };
  },
  // both hands up by her head, waving from side to side
  wave: (b) => {
    const s = Math.sin(Math.PI * b);
    return { add: { hip: 0.024 * s, bz: -5 * s, by: 2 * pulse(b), az: -5 * s },
      hands: { R: up(-0.95, 0.12, 96 + 16 * s), L: mirror(up(-0.95, 0.12, 96 - 16 * s)) }, face: { grin: 0.45 } };
  },
  // a small groove: her shoulders bounce on each beat, her head bobs, her arms swing a little low
  groove: (b) => {
    const s = Math.sin(Math.PI * b), p = pulse(b);
    return { add: { by: 2.6 * p, ay: -3 * p, hip: 0.016 * s, bz: -3 * s, az: 3 * Math.sin(Math.PI * b + 0.8) },
      arms: { shR: -12 + 3 * s, elR: 18 + 14 * p, shL: -12 - 3 * s, elL: 18 + 14 * p }, face: { grin: 0.25 } };
  },
  // both hands up by her head, shaking with joy (a "yay!")
  cheer: (b) => {
    const shake = Math.sin(b * Math.PI * 2 * 2);
    return { add: { by: 2.5 * pulse(b), az: 3 * shake },
      hands: both(up(-0.88, 0.18 + 0.06 * shake)), face: { grin: 0.5, happy: 0.6 } };
  },
  // her right hand out to everyone ("your turn"), swaying
  present: (b) => ({ add: { hip: 0.02 * Math.sin(Math.PI * b), by: 2 * pulse(b), ax: -6 },
    hands: { R: at('shoulderR', -0.95, 0.04, 160, { a: 0.35, cu: 0.15, sh: 12, bend: 'out' }) }, face: { grin: 0.4 } }),
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
// body(): (2026-10-08) her model's arms and the spots of her face and body this frame ({ arms, spots }: stage.js, outfits.js
// anchors), so her hands reach where they should as she moves; without it (tests), her body at rest.
export function createMoves({ clock = () => Date.now(), rnd = Math.random, onFx = () => {}, onProp = () => {}, onCam = () => {}, places = () => ({ min: -0.7, max: 0.2 }), still = () => false, body = () => null } = {}) {
  let action = null;             // { id, a, len }
  let gesture = null;            // { id, a, len }
  let nextGesture = 2.5, nextIdle = 8 + rnd() * 8, quiet = 0, t = 0, talked = 0;
  let auto = true, gestures = true, singing = false;
  let dance = null;              // { bpm, beat0 (ms), until (ms), style, beats: [s] relative to beat0, w }
  let routine = 'sway', danceW = 0;
  const drift = { x: 0, vx: 0, next: 0, tx: 0 };
  let emphasis = 0, lastLevel = 0, brows = 0, held = 0, heldPose = null, lastGesture = null;
  const face = {};
  // (2026-10-08) which of her hands is by her face right now: drawn over her face and hair (outfits.js)
  const frontNow = { R: false, L: false };
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

  // what she carries (2026-10-07: her umbrella in the rain; 2026-10-08: resting on her right shoulder, held behind her,
  // outfits.js): her right hand is behind her holding it, so while she carries it her talking gestures are her left
  // hand's, and something her right hand does (an action) puts it down until she's done
  let carrying = null;
  const CARRY = { umbrella: true };
  const propNow = () => (action && ACTIONS[action.id].prop) || (carrying && !(action && USES_R[action.id]) ? carrying : null);
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

  let pose = null, bodyNow = null;
  // (when each of her arms was last on its way into or out of a pose, moves' own time; that pose's turn of her elbow; and
  // her elbows' targets this frame: post())
  const transitAt = { R: -9, L: -9 };
  const transit = { R: { from: 0, to: 0, turn: 0, seen: -9 }, L: { from: 0, to: 0, turn: 0, seen: -9 } };
  const targetEl = { R: null, L: null };
  function apply(dt, tg, now) {
    t += dt;
    for (const k in face) delete face[k];
    frontNow.R = false; frontNow.L = false;
    pose = now.pose || null;
    bodyNow = body() || null;
    figureFrame(dt, tg);
    const ms = clock();
    const talking = now.talking > 0.15;
    const busy = now.waving || now.cheering || now.swaying;    // her own reactions win
    quiet = talking ? 0 : quiet + dt;
    talked = talking ? talked + dt : 0;

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
      blend(tg, d, danceW, danceW);
      if (!dance.cues && Math.floor(b / 16) !== dance.bar) {           // a new routine every four bars
        dance.bar = Math.floor(b / 16);
        if (dance.bar > 0) routine = pick(dance.styles.filter((x) => x !== routine));
      }
    }

    // a pose held as it is (her tests, and a look at a pose)
    if (heldPose) blend(tg, heldPose.hands ? heldPose : { arms: heldPose, front: heldPose.front }, 1);

    // an action
    if (action) {
      const def = ACTIONS[action.id], was = action.a;
      action.a += dt;
      // (a bite or a sip: stage.js draws it; an effect later in the action: its "mmm")
      for (const b of def.bites || []) if (was < b && action.a >= b) onFx('bite');
      if (def.fxAt && was < def.fxAt && action.a >= def.fxAt) onFx(def.fx);
      if (action.a >= action.len) { action = null; onProp(propNow()); }
      else if (!busy) {
        const k = 1 - danceW * 0.6, w = env(action.a, action.len), wL = env(action.a - LAG, action.len - LAG);
        const p = def.pose(action.a);
        blend(tg, p, w * k, wL * k, w, wL);
        if (p.brows) brows = Math.max(brows, p.brows * w);
      }
    }

    // gestures while she talks, now and then (not while she dances, sings or does something else): a streamer mostly talks
    // with her face, and a hand comes up for a couple of seconds after a while
    if (gestures && talking && talked > 2.5 && !action && danceW < 0.2 && !busy && !singing && !jump && !twirl && !walk) {
      if (!gesture && t >= nextGesture) {
        const ids = GESTURE_IDS.filter((id) => id !== lastGesture && !(carrying && GESTURES[id].hands.R));
        gesture = { id: pick(ids), a: 0, len: 1.8 + rnd() * 1.4, ph: rnd() * 6 };
        lastGesture = gesture.id;
        nextGesture = t + gesture.len + 4 + rnd() * 7;
      }
    }
    // a little bigger on her louder words
    if (now.level - lastLevel > 0.35) emphasis = 1;
    emphasis *= Math.exp(-dt * 6);
    if (gesture) {
      gesture.a += dt;
      if (!talking && gesture.len > gesture.a + 0.5) gesture.len = gesture.a + 0.5;   // (she stopped: her hand comes down)
      if (gesture.a >= gesture.len) gesture = null;
      if (gesture) {
        const w = env(gesture.a, gesture.len, 0.5, 0.55), wL = env(gesture.a - LAG, gesture.len - LAG, 0.5, 0.55);
        // her hand moves a little as she talks (never still), and up a little on a louder word
        const g = GESTURES[gesture.id].hands, live = {}, ph = gesture.ph + gesture.a;
        for (const side in g) live[side] = { ...g[side], dx: (g[side].dx || 0) + 0.05 * Math.sin(ph * 2.1), dy: (g[side].dy || 0) + 0.04 * Math.sin(ph * 3.3) + 0.12 * emphasis };
        blend(tg, { hands: live }, w, wL);
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


    // while she sings: her eyes close a little on the long notes, her head tilts with the phrase
    if (singing) {
      held = now.talking > 0.6 && now.level > 0.55 ? held + dt : Math.max(0, held - dt * 2);
      face.happy = Math.max(face.happy || 0, smooth(0.45, 0.9, held) * 0.7);
      face.grin = Math.max(face.grin || 0, 0.18);
    } else held = 0;
    brows *= Math.exp(-dt * 3);
    // (her elbows' targets, for post())
    targetEl.R = tg.elR ?? null; targetEl.L = tg.elL ?? null;
    return face;
  }
  // a pose blended into her targets: its hands worked out where her body is this frame (her elbow from where it is now);
  // her left hand at its own weight (wL: a moment behind her right). tr, trL: how far into (or out of) the pose she is
  // (0..1, without a dance's share: a pose held at part weight isn't on its way)
  function blend(tg, p, w, wL = w, tr = w, trL = wL) {
    const weight = (k) => (k.endsWith('L') ? wL : w);
    if (p.arms) for (const k of ARM_KEYS) if (p.arms[k] !== undefined) tg[k] = lerp(tg[k] ?? ARM_DEFAULT[k] ?? 0, p.arms[k], weight(k));
    if (p.hands) {
      for (const side of ['R', 'L']) {
        const h = p.hands[side];
        if (!h || (side === 'L' ? wL : w) <= 0.001) continue;
        const el = pose?.[`el${side}`] ?? tg[`el${side}`];
        const arms = armFor(side, h, { arms: bodyNow?.arms || REST_ARMS, spots: bodyNow?.spots || SPOTS_REST, hint: el === undefined ? null : { elbow: el } });
        const from = tg[`el${side}`] ?? 0;
        // (2026-10-08) her hand going from down by her side up to her face comes up at her side, then in (her elbow turns
        // her forearm out and up): never across her chest, her forearms crossing in an X on the way (the nearest way round
        // from her side to a hand pointing up at her face is often across her)
        const ek = `el${side}`, e0 = arms[ek], cur0 = pose?.[ek] ?? from;
        if (Math.abs(from) < 60 && Math.abs(cur0) < 60 && e0 < -45 && Math.abs(e0 - 360 * Math.round(e0 / 360)) > 120) arms[ek] = e0 + 360;
        for (const k in arms) tg[k] = lerp(tg[k] ?? ARM_DEFAULT[k] ?? 0, arms[k], weight(k));
        // (2026-10-08, her clap: her hands crossed in an X over her chest on their way up and down) her hand on its way
        // from her side to her face (or back) comes toward us, as a forearm bending in front of a body does: seen shorter
        // the more it points across her, most halfway (her forearm swung out flat across her chest before). Halfway is
        // where her forearm is now (her elbow follows its target a moment behind) between where it started and the pose's;
        // only while she goes into or out of a pose, and a moment after (her elbow still on its way): never while she holds
        // it, nor between a dance's moves
        // (post(), after her springs: in step with her elbow as it really is)
        const to = arms[`el${side}`], turn = Math.abs(to - from), go = side === 'L' ? trL : tr;
        if (go > 0.01 && go < 0.985) transitAt[side] = t;
        if (turn > 60) Object.assign(transit[side], { from, to, turn, seen: t });
        if ((h.front || h.mix?.[0].front) && (side === 'L' ? wL : w) > 0.2) frontNow[side] = true;
      }
    }
    if (p.front && w > 0.2) for (const side of ['R', 'L']) if (p.front[side]) frontNow[side] = true;
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

  // (2026-10-08, the owner: "her arms doesnt even move naturally … clnky") After her springs (her controller calls it with
  // her pose as it will be drawn): her forearm comes toward us on its way up or down, as an elbow bending in front of her
  // does, so it's seen shorter while it points across her: when it still has far to go (SWING_DIP), and halfway on its way
  // into or out of a pose that turns it a lot, from her side up to her face (TRANSIT_DIP). It swept out flat across her
  // chest before, her hands crossing in front of her on their way; worked out on her targets, it came a moment late
  // (her elbow follows them a moment behind) and pulled her hand down across her chest just as it turned across.
  function post(pz) {
    for (const side of ['R', 'L']) {
      const z = pz?.[side];
      if (!z) continue;
      const cur = z.elbow ?? 0, across = Math.sin(cur * RAD) ** 2;
      let k = 1;
      if (targetEl[side] !== null) k *= 1 - SWING_DIP * clamp(Math.abs(targetEl[side] - cur) / 70, 0, 1) * across;
      const tr = transit[side];
      if (t - tr.seen < TRANSIT_TAIL && t - transitAt[side] < TRANSIT_TAIL && tr.turn > 60) {
        const u = clamp((cur - tr.from) / (tr.to - tr.from), 0, 1);
        k *= 1 - TRANSIT_DIP * 4 * u * (1 - u) * clamp((tr.turn - 60) / 60, 0, 1) * across;
      }
      z.fore = (z.fore ?? 1) * k;
    }
  }

  return {
    apply,
    post,
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
    get front() { return frontNow; },
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
