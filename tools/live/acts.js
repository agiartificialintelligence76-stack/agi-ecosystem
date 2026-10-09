// AGI-1's live show (2026-10-07, the owner: "she will do also what viewers ask her. like jump, jump many times, wave, blush,
// dance, sing, sing some parts of her song like the rap part, can sing the whole song also, wink, move on the screen not on
// just one place etc … i just want her to be very interactive to the viewers"): the stream's side of viewers' requests.
// What she can do is server/live-acts.js (shared with the site, whose AI picks one from her answer); here: what she can do
// right now, her own pace between her extras (a few take minutes, so she rests a while before doing them again by
// herself), and what each one does on her set (tools/live/page: stage.js, moves.js). Pure.
// (2026-10-09, the owner: "she will do everything asked to her", "she can sing the full song everytime if requested": a
// viewer's request never waits for a rest any more; the rests only pace what she does by herself)
import { ACT_IDS, PART_IDS, COOLDOWN, OUTFITS, ROOMS, EMOTION_IDS } from '../../server/live-acts.js';
import { ACTIONS, JUMP_S, TWIRL_S } from './page/moves.js';
import { SHOW_OUTFITS } from './page/outfits.js';
import { SHOW_ROOMS } from './page/rooms.js';

// what each request is on her set: one of her moves (moves.js ACTIONS: studio.act), one of her reactions (agi1-2d.js:
// studio.react), or something of its own
export const DOES = {
  jump: { page: 'jump' }, spin: { page: 'twirl' }, move: { page: 'move' }, wave: { react: 'wave' }, shy: { react: 'shy' }, celebrate: { react: 'celebrate' },
  blush: { act: 'blush' }, wink: { act: 'wink' }, clap: { act: 'clap' }, heart: { act: 'heart' }, peace: { act: 'peace' }, laugh: { act: 'laugh' },
  think: { act: 'think' }, sip: { act: 'sip' }, stretch: { act: 'stretch' }, bounce: { act: 'bounce' },
  confetti: { own: 'confetti' }, dance: { own: 'dance' }, sing: { own: 'sing' }, outfit: { own: 'outfit' }, room: { own: 'room' },
  // (2026-10-07) a trip, a snack, the weather, someone she meets; and her emotions (moves.js: each one of her moves)
  trip: { own: 'trip' }, eat: { own: 'eat' }, weather: { own: 'weather' }, meet: { own: 'meet' },
  // (2026-10-09) $AGI's live trading chart on her screen
  chart: { own: 'chart' },
  ...Object.fromEntries(EMOTION_IDS.map((id) => [id, { act: id }])),
};
// how long each takes on her set (ms), so she does one at a time
export function actMs(a) {
  const d = DOES[a?.act];
  if (!d) return 0;
  if (d.act) return Math.round((ACTIONS[d.act]?.len || 2) * 1000) + 200;
  if (a.act === 'jump') return Math.round(JUMP_S * 1000 * (a.times || 1)) + 300;
  if (a.act === 'spin') return Math.round(TWIRL_S * 1000 * (a.times || 1)) + 300;
  if (a.act === 'wave') return 2100 * (a.times || 1);
  if (a.act === 'move') return a.to === 'around' || !a.to ? 6000 : 2200;
  if (a.act === 'celebrate' || a.act === 'shy') return 2600;
  if (a.act === 'confetti') return 2500;
  return 1500;
}

// her own pace (server/live-acts.js COOLDOWN): after a sung part she sings by herself again only after 6 minutes, the whole
// song after 30; the rest by their names
const keysOf = (a) => (a.act === 'sing' ? (a.part === 'whole' ? ['sing', 'sing_whole'] : ['sing']) : [a.act]);
// (2026-10-07) meet: whether she can meet someone right now (only where she's visiting, or her café)
export function createActs({ now = Date.now, song = true, dance = true, meet = () => true, chart = () => true } = {}) {
  const until = new Map();
  const resting = (key, t) => (until.get(key) || 0) > t;
  return {
    // what she can do right now (her stream tells the site with each "next"): server/live-acts.js's names, sing:<part>.
    // Whatever she did lately (2026-10-09): only what her set can't do at all is left out (her song when its file isn't
    // there, a dance without her dance songs, meeting someone where nobody is, her chart when $AGI's trades can't be read)
    can() {
      const out = [];
      for (const id of ACT_IDS) {
        if (id === 'sing') {
          if (!song) continue;
          for (const p of PART_IDS) out.push(`sing:${p}`);
        } else if (!(id === 'dance' && !dance) && !(id === 'meet' && !meet()) && !(id === 'chart' && !chart())) out.push(id);
      }
      return out;
    },
    // she did it (asked, or by herself): her own pace starts from now (what she does by herself waits a while)
    take(a, t = now()) {
      if (!a?.act) return;
      for (const k of keysOf(a)) if (COOLDOWN[k]) until.set(k, Math.max(until.get(k) || 0, t + COOLDOWN[k]));
    },
    // it didn't happen after all (the question went back in line): it's free again
    release(a) { if (a?.act) for (const k of keysOf(a)) until.delete(k); },
    resting: (key, t = now()) => resting(key, t),
  };
}

// her next room or outfit when nobody said which: the next one of her show's (never the one she's in; the concert stage and
// her stage outfit only when she sings, or when a viewer asks for them by name)
export function nextOf(list, current, rnd = Math.random) {
  const left = list.filter((x) => x !== current);
  return left[Math.floor(rnd() * left.length)] || list[0];
}
export const nextRoom = (current, rnd) => nextOf(SHOW_ROOMS, current, rnd);
export const nextOutfit = (current, rnd) => nextOf(SHOW_OUTFITS, current, rnd);
// a request's room or outfit: the one asked for, else the next one
export const roomFor = (a, current, rnd) => (ROOMS[a?.to] && a.to !== current ? a.to : nextRoom(current, rnd));
export const outfitFor = (a, current, rnd) => (OUTFITS[a?.to] && a.to !== current ? a.to : nextOutfit(current, rnd));
