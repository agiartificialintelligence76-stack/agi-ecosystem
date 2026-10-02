// AGI-1's live show (2026-10-02): the director. Decides what she does next, from the show's clock, her line of questions
// and the owner's controls; pure (no network, no clock of its own: tests/live.test.js runs a whole show in a moment).
//   intro → questions (up to 4 in a row) and a segment every ~6 minutes (every ~2.5 when nobody's asking) → a nudge to ask
//   at agi1.app/live when the line is empty → a little chat line when she's been quiet → the outro 40 seconds before the end.
//   The owner's "pause" puts her on "be right back" at once; "end" (or the show's length) goes to the outro.
import { SEGMENT_IDS, SEGMENTS, CHAT, PICKUP, READING, LAG, TIPS_A_SEGMENT } from './lines.js';

export const PACE = {
  OUTRO_MS: 40_000,            // the outro starts this long before the show's end (it takes about half a minute)
  SEGMENT_EVERY: 6 * 60_000,   // a segment at least this often, between questions
  SEGMENT_IDLE: 150_000,       // …and this often when nobody's asking
  FIRST_SEGMENT: 90_000,       // the first one comes a little after the intro
  QUESTIONS_IN_A_ROW: 4,       // then a segment, if one is due
  PICKUP_EVERY: 75_000,        // "ask me at agi1.app/live" when the line is empty
  CHAT_AFTER: 22_000,          // she says a little something when she's been quiet this long
  WAIT_MS: 4000,               // a quiet moment (she idles, the line is asked again)
};

// a seeded random number maker (mulberry32): the same seed, the same show
export function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffle = (list, rnd) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

// A new show. start: when it starts (ms) · minutes: how long · diary: her diary entry is there to read · seed
export function createShow({ start, minutes = 60, diary = false, seed = 1 } = {}) {
  const rnd = seeded(seed);
  const segments = SEGMENT_IDS.filter((id) => id !== 'diary' || diary);
  return {
    start, endsAt: start + minutes * 60_000, rnd, phase: 'intro',
    segments, order: [], lastSegment: null, lastSegmentAt: start - PACE.SEGMENT_EVERY + PACE.FIRST_SEGMENT,
    questionsInARow: 0, lastPickupAt: start, lastSpokeAt: start, answered: 0, segmentsDone: 0,
    used: { chat: new Set(), pickup: new Set(), reading: new Set(), tips: new Set(), wyr: new Set() },
  };
}

// What she does next. now (ms) · waiting: questions in line (or one already prepared) · paused / end: the owner's controls ·
// holding: questions are waiting but she can't answer them for a while (her answers aren't working): no "ask me" nudges
// → { kind: 'intro' | 'brb' | 'question' | 'segment' (id) | 'pickup' | 'chat' | 'wait' (ms) | 'outro' | 'end' }
// The owner's "end" and the show's length come before a pause: a paused show still ends (she comes back to say goodbye).
export function nextStep(show, { now, waiting = 0, paused = false, end = false, holding = false }) {
  if (show.phase === 'ended') return { kind: 'end' };
  if (show.phase === 'outro') return { kind: 'end' };
  if (end || now >= show.endsAt - PACE.OUTRO_MS) return { kind: 'outro' };
  if (paused) return { kind: 'brb' };
  if (show.phase === 'intro') return { kind: 'intro' };
  const segmentDue = now - show.lastSegmentAt >= (waiting > 0 ? PACE.SEGMENT_EVERY : PACE.SEGMENT_IDLE);
  if (waiting > 0 && !(segmentDue && show.questionsInARow >= PACE.QUESTIONS_IN_A_ROW)) return { kind: 'question' };
  if (segmentDue) return { kind: 'segment', id: nextSegment(show) };
  if (waiting <= 0 && !holding && now - show.lastPickupAt >= PACE.PICKUP_EVERY) return { kind: 'pickup' };
  if (now - show.lastSpokeAt >= PACE.CHAT_AFTER) return { kind: 'chat' };
  return { kind: 'wait', ms: PACE.WAIT_MS };
}
// the next segment: each once before any comes again, never the same one twice in a row
function nextSegment(show) {
  if (!show.order.length) {
    let order = shuffle(show.segments, show.rnd);
    if (order.length > 1 && order[0] === show.lastSegment) order = [...order.slice(1), order[0]];
    show.order = order;
  }
  return show.order[0];
}

// What happened: the step is done (at `now`). spoke: she said something (a question, a segment, a line)
export function didStep(show, step, now) {
  switch (step.kind) {
    case 'intro': show.phase = 'main'; show.lastSpokeAt = now; break;
    case 'question': show.questionsInARow += 1; show.answered += 1; show.lastSpokeAt = now; break;
    case 'segment':
      if (show.order[0] === step.id) show.order.shift();
      show.lastSegment = step.id;
      show.lastSegmentAt = now;
      show.questionsInARow = 0;
      show.segmentsDone += 1;
      show.lastSpokeAt = now;
      break;
    case 'pickup': show.lastPickupAt = now; show.lastSpokeAt = now; break;
    case 'chat': show.lastSpokeAt = now; break;
    case 'outro': show.phase = 'outro'; break;
    case 'end': show.phase = 'ended'; break;
    default: break;
  }
  return show;
}
// (a question that turned out not to be there: the line moved on meanwhile)
export const noQuestion = (show) => show;

// One of a list she hasn't used this show (all used: start again), by the show's own random numbers
export function pickFrom(show, kind, list) {
  const used = show.used[kind] || (show.used[kind] = new Set());
  if (used.size >= list.length) used.clear();
  const left = list.map((_, i) => i).filter((i) => !used.has(i));
  const i = left[Math.floor(show.rnd() * left.length)];
  used.add(i);
  return list[i];
}
export const chatLine = (show) => pickFrom(show, 'chat', CHAT);
export const pickupLine = (show) => pickFrom(show, 'pickup', PICKUP);
export const readingLine = (show) => pickFrom(show, 'reading', READING);
export const lagLine = (show) => pickFrom(show, 'lag', LAG);
export const tipsFor = (show, n = TIPS_A_SEGMENT) => Array.from({ length: n }, () => pickFrom(show, 'tips', SEGMENTS.tips.tips));
export const pairsFor = (show, n = 2) => Array.from({ length: n }, () => pickFrom(show, 'wyr', SEGMENTS.wyr.pairs));

// The segment's name for agi1.app/live ("Now: reading her diary"): the page knows these (src/live/words.js)
export const SEGMENT_STATUS = { intro: 'intro', question: 'questions', pickup: 'chat', chat: 'chat', wait: 'chat', brb: 'brb', outro: 'outro' };
