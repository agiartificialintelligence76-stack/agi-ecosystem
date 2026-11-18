export const WINDOWS = Object.freeze({
  soundcheck:{perfect:.066, great:.119, good:.205},
  studio:{perfect:.050, great:.092, good:.155},
  headliner:{perfect:.040, great:.073, good:.121},
});
const weights = {perfect:1, great:.83, good:.60, short:.30, miss:0, wrong:0};
export function timing(delta, difficulty) {
  const gap = Math.abs(delta), limits = WINDOWS[difficulty];
  if (gap <= limits.perfect + 1e-9) return 'perfect';
  if (gap <= limits.great + 1e-9) return 'great';
  if (gap <= limits.good + 1e-9) return 'good';
  return 'miss';
}
export function gradeOf(value) {
  if (value >= .965) return 'S';
  if (value >= .86) return 'A';
  if (value >= .70) return 'B';
  if (value >= .50) return 'C';
  return 'D';
}

// Both a human and the rehearsal player go through these same down/up events.
// No frame count, RNG or DOM state contributes to a judgement.
export class Performance {
  constructor(chart, onEvent = () => {}) {
    this.chart = chart;
    this.onEvent = onEvent;
    this.state = Array(chart.notes.length).fill(null);
    this.held = new Set();
    this.sustains = new Map();
    this.counts = {perfect:0,great:0,good:0,short:0,wrong:0,miss:0};
    this.combo = 0;
    this.bestCombo = 0;
    this.points = 0;
    this.value = 0;
    this.judged = 0;
    this.strays = 0;
    this.firstPending = 0;
    this.deltas = [];
    this.byPhrase = chart.phrases.map(p => ({count:p.notes.length, done:0, value:0}));
  }
  get accuracy() {
    return this.judged ? this.value / (this.judged + this.strays * .12) : 0;
  }
  final(note, kind, delta = null) {
    if (this.state[note.index]?.done) return;
    this.state[note.index] = {kind, done:true, delta};
    this.judged++;
    this.counts[kind]++;
    this.value += weights[kind];
    this.combo = weights[kind] >= .6 ? this.combo + 1 : 0;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.points += Math.round(100 * weights[kind] * (1 + Math.min(4, Math.floor(this.combo / 8)) * .25));
    if (delta !== null && kind !== 'wrong') this.deltas.push(delta);
    const phrase = this.byPhrase[note.phrase];
    phrase.done++;
    phrase.value += weights[kind];
    this.onEvent({type:'judge', note, kind, delta});
    if (phrase.done === phrase.count) this.onEvent({type:'phrase', index:note.phrase, accuracy:phrase.value / phrase.count});
  }
  press(lane, when) {
    if (this.held.has(lane)) return null;
    this.held.add(lane);
    const horizon = WINDOWS[this.chart.difficulty].good;
    let nearest = null;
    let distance = horizon + 1e-8;
    for (let i = this.firstPending; i < this.chart.notes.length; i++) {
      const n = this.chart.notes[i];
      if (n.at > when + horizon) break;
      if (this.state[i]) continue;
      const gap = Math.abs(when - n.at);
      if (gap < distance) { nearest = n; distance = gap; }
    }
    if (!nearest) {
      const inReply = this.chart.phrases.some(p => when >= p.reply && when <= p.end);
      if (inReply) {
        this.strays++;
        this.onEvent({type:'stray'});
      }
      return null;
    }
    const delta = when - nearest.at;
    if (nearest.lane !== lane) {
      this.final(nearest, 'wrong', delta);
    } else {
      const kind = timing(delta, this.chart.difficulty);
      if (nearest.until > nearest.at) {
        this.state[nearest.index] = {kind:'holding',done:false};
        this.sustains.set(lane, {note:nearest,kind,delta});
        this.onEvent({type:'hold', note:nearest, kind});
      } else {
        this.final(nearest, kind, delta);
      }
    }
    return nearest;
  }
  release(lane, when) {
    this.held.delete(lane);
    const held = this.sustains.get(lane);
    if (!held) return;
    this.sustains.delete(lane);
    const tailWindow = WINDOWS[this.chart.difficulty].great;
    this.final(held.note, when >= held.note.until - tailWindow ? held.kind : 'short', held.delta);
  }
  advance(when) {
    for (const [lane, hold] of this.sustains) {
      if (when >= hold.note.until) {
        this.sustains.delete(lane);
        this.final(hold.note, hold.kind, hold.delta);
      }
    }
    const late = WINDOWS[this.chart.difficulty].good + .028;
    while (this.firstPending < this.chart.notes.length) {
      const note = this.chart.notes[this.firstPending];
      if (this.state[note.index]) this.firstPending++;
      else if (when > note.at + late) {
        this.final(note, 'miss');
        this.firstPending++;
      } else break;
    }
  }
  releaseInputs() {
    // A pause releases physical switches. Resuming re-arms a pending sustain.
    // An unseen tab cannot turn a well-timed note into a short hold.
    this.held.clear();
  }
  report() {
    return {score:this.points,grade:gradeOf(this.accuracy),accuracy:this.accuracy,judged:this.judged,
      total:this.chart.notes.length,bestCombo:this.bestCombo,counts:{...this.counts},strays:this.strays};
  }
}
