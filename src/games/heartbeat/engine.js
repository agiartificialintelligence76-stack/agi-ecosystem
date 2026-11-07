// HEARTBEAT (2026-11-08): one run of a chart (pure: no DOM, no clock of its own; tests/heartbeat.test.js plays it).
//
//   const run = createRun(notes)            notes: [{ t, lane, hold }] (seconds of the song; hold 0 = a tap)
//   run.press(lane, t) / run.release(lane, t)   a finger or a key, at song time t (when it really happened)
//   run.update(t)                            the song reached t: notes let through are missed, holds held to the end
//   run.drain()                              what happened since the last call (the screen's hits, misses, FEVER)
//   run.score, run.accuracy, run.grade, run.combo, run.counts, run.done …
//
// The game asks it nothing else: the song's clock, the screen and the sound stay outside, so a run plays the same in a
// test, in the demo (its own AI pressing) and in the browser.
import {
  LANES, WINDOW, WORTH, FEVER_AT, FEVER_X, HOLD_GRACE, COMBO_CAP, judge, scoreOf, accuracyOf, gradeOf, stampOf,
} from './rules.js';

// a note let through is called a MISS a little after its window closes: a tap that happened in time but reached the
// page late (a busy frame) is still judged by when it happened
export const MISS_GRACE = 0.06;

export function createRun(input, { from = -Infinity } = {}) {
  const notes = input
    .filter((n) => n.t >= from - 1e-9)
    .map((n, i) => ({ i, t: n.t, lane: n.lane, hold: n.hold || 0, end: n.t + (n.hold || 0), head: null, tail: null, err: 0, regrab: false, cut: null }))
    .sort((a, b) => a.t - b.t || a.lane - b.lane);
  notes.forEach((n, i) => { n.i = i; });
  const lanes = Array.from({ length: LANES }, () => ({ queue: [], cursor: 0, active: null, down: false }));
  for (const n of notes) lanes[n.lane].queue.push(n);
  const units = notes.length + notes.filter((n) => n.hold > 0).length;
  const counts = { perfect: 0, great: 0, good: 0, miss: 0, break: 0 };
  const st = { combo: 0, maxCombo: 0, fever: false, value: 0, comboSum: 0, worth: 0, judged: 0, last: -Infinity, regrabUntil: Infinity };
  let events = [];
  const emit = (e) => { events.push(e); return e; };

  // one judged unit (a note's head, or a hold's tail)
  function unit(kind, note, t, tail = false) {
    const mult = st.fever ? FEVER_X : 10;
    const worth = WORTH[kind];
    st.judged++;
    st.worth += worth;
    st.value += worth * mult;
    if (kind === 'miss' || kind === 'break') {
      counts[kind]++;
      if (st.fever) emit({ type: 'fever', on: false, t });
      st.fever = false;
      st.combo = 0;
    } else {
      if (!tail) counts[kind]++;
      st.combo++;
      if (st.combo > st.maxCombo) st.maxCombo = st.combo;
      if (!st.fever && st.combo >= FEVER_AT) { st.fever = true; emit({ type: 'fever', on: true, t }); }
      if (st.combo % 100 === 0 || st.combo === FEVER_AT) emit({ type: 'milestone', combo: st.combo, t });
    }
    if (tail && kind === 'perfect') counts.perfect++;
    st.comboSum += Math.min(st.combo, COMBO_CAP);
  }

  function missHead(note, t) {
    note.head = 'miss';
    unit('miss', note, t);
    if (note.hold > 0) { note.tail = 'miss'; unit('miss', note, t, true); }
    emit({ type: 'miss', lane: note.lane, note, t });
  }

  function advance(L) {
    while (L.cursor < L.queue.length && L.queue[L.cursor].head !== null) L.cursor++;
  }

  const api = {
    notes, units, counts,
    // notes before `t` that nobody pressed: missed. Holds held to their end: done.
    update(t) {
      for (let l = 0; l < LANES; l++) {
        const L = lanes[l];
        advance(L);
        while (L.cursor < L.queue.length) {
          const n = L.queue[L.cursor];
          if (n.head === null && t > n.t + WINDOW.good + MISS_GRACE) { missHead(n, n.t + WINDOW.good); L.cursor++; advance(L); } else break;
        }
        const a = L.active;
        if (a) {
          if (a.regrab && !L.down && t > st.regrabUntil) {
            // after a pause the hold wasn't picked up again in time
            a.tail = 'break'; a.cut = t; L.active = null; unit('break', a, t, true);
            emit({ type: 'tail', lane: l, kind: 'break', note: a, t });
          } else if (t >= a.end) {
            a.tail = 'perfect'; L.active = null; unit('perfect', a, a.end, true);
            emit({ type: 'tail', lane: l, kind: 'perfect', note: a, t: a.end });
          }
        }
      }
      st.last = Math.max(st.last, t);
    },
    press(lane, t) {
      const L = lanes[lane];
      if (!L) return null;
      L.down = true;
      if (L.active && L.active.regrab) { L.active.regrab = false; return emit({ type: 'regrab', lane, t }); }
      api.update(t);
      advance(L);
      // notes whose window closed before this press: missed (the next one may be the one meant)
      while (L.cursor < L.queue.length && t > L.queue[L.cursor].t + WINDOW.good) {
        missHead(L.queue[L.cursor], L.queue[L.cursor].t + WINDOW.good);
        L.cursor++;
        advance(L);
      }
      const n = L.queue[L.cursor];
      const err = n ? t - n.t : 0;
      const kind = n ? judge(err) : null;
      if (!n || kind === null) return emit({ type: 'tap', lane, t });   // too early, or nothing coming: no harm
      n.head = kind;
      n.err = err;
      unit(kind, n, t);
      L.cursor++;
      advance(L);
      if (n.hold > 0) L.active = n;
      return emit({ type: 'hit', lane, kind, err, note: n, t });
    },
    release(lane, t) {
      const L = lanes[lane];
      if (!L) return null;
      L.down = false;
      const a = L.active;
      if (!a || a.regrab) return null;
      L.active = null;
      if (t >= a.end - HOLD_GRACE) {
        a.tail = 'perfect'; unit('perfect', a, t, true);
        return emit({ type: 'tail', lane, kind: 'perfect', note: a, t });
      }
      a.tail = 'break'; a.cut = t; unit('break', a, t, true);
      return emit({ type: 'tail', lane, kind: 'break', note: a, t });
    },
    // a pause: fingers lift while the card is up, so held holds wait to be picked up again (until `resumeHolds`)
    pauseHolds() {
      for (const L of lanes) { L.down = false; if (L.active) L.active.regrab = true; }
      st.regrabUntil = Infinity;
    },
    // the run goes on (after the rewind): a hold not pressed again by song time `deadline` breaks
    resumeHolds(deadline) { st.regrabUntil = deadline; },
    // the demo starts mid-song with a combo already going (so FEVER burns from its first second)
    warm(combo) {
      st.combo = combo; st.maxCombo = Math.max(st.maxCombo, combo);
      if (combo >= FEVER_AT) st.fever = true;
    },
    isDown: (lane) => Boolean(lanes[lane]?.down),
    activeHold: (lane) => lanes[lane]?.active || null,
    drain() { const e = events; events = []; return e; },
    get combo() { return st.combo; },
    get maxCombo() { return st.maxCombo; },
    get fever() { return st.fever; },
    get judged() { return st.judged; },
    get score() { return scoreOf(st, units); },
    get accuracy() { return accuracyOf(st.worth, st.judged); },
    // the final accuracy counts every unit of the chart (one not judged yet is worth nothing)
    get finalAccuracy() { return accuracyOf(st.worth, units); },
    get grade() { return gradeOf(accuracyOf(st.worth, units)); },
    get stamp() { return api.done ? stampOf(counts) : null; },
    get done() { return st.judged >= units; },
    get lastTime() { return notes.length ? notes[notes.length - 1].end : 0; },
  };
  return api;
}
