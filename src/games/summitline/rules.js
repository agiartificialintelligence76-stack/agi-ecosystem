import { REPERTOIRE, phrase, voices } from './repertoire.js';
export function hash(seed, index) {
  let n = (seed ^ Math.imul(index + 1, 2654435761)) >>> 0;
  n = Math.imul(n ^ n >>> 16, 0x7feb352d);
  n = Math.imul(n ^ n >>> 15, 0x846ca68b);
  return (n ^ n >>> 16) >>> 0;
}
export function createConcert({
  seed = 7,
  mode = 'book',
  start = 0,
  preview = false
} = {}) {
  const state = {
    seed: seed >>> 0,
    mode,
    preview,
    start: Math.max(0, Math.min(23, start | 0)),
    piece: 0,
    sheet: null,
    round: 0,
    songs: 0,
    errors: 0,
    hearts: 3,
    completed: 0,
    score: 0,
    longest: 0,
    perfect: 0,
    encores: 0,
    elapsed: 0,
    phase: 'listen',
    age: 0,
    cursor: 0,
    shown: 0,
    answers: [],
    marks: [],
    events: [],
    ended: false,
    glow: [0, 0, 0, 0],
    lastMask: 0,
    turn: 0
  };
  prepare(state);
  return state;
}
function selectPiece(s) {
  if (s.mode === 'book') return Math.min(23, s.start + s.songs);
  if (s.mode === 'daily') return hash(s.seed, s.songs) % REPERTOIRE.length;
  return hash(s.seed, Math.floor(s.round / 16)) % REPERTOIRE.length;
}
function prepare(s) {
  s.piece = selectPiece(s);
  s.sheet = REPERTOIRE[s.piece];
  const level = s.mode === 'book' ? s.sheet.station : s.mode === 'daily' ? Math.min(7, 2 + s.songs) : Math.min(8, Math.floor(s.round / 3));
  const size = s.mode === 'climb' ? 2 + s.round : s.mode === 'daily' ? 3 + s.songs + s.round : 2 + Math.min(4, level) + s.round;
  const variant = s.mode === 'book' ? s.sheet.id === 0 ? 0 : Math.floor(hash(s.seed, s.piece) % 4) * 4 : hash(s.seed, s.mode === 'climb' ? 0 : s.songs) % 16;
  s.melody = phrase(s.sheet, size, variant, level);
  if (s.mode === 'climb') {
    for (let i = 0; i < size; i++) {
      const block = Math.floor(i / 12),
        v = hash(s.seed, block) % 16;
      const piece = REPERTOIRE[hash(s.seed, block + 300) % 24];
      const n = piece.notes[(i % 12 + v) % 16],
        pair = i >= 6 && hash(s.seed, i) % 6 === 0;
      s.melody[i] = 1 << n | (pair ? 1 << (n + 2) % 4 : 0);
    }
  }
  if (s.preview && s.round === 0 && s.songs === 0) s.melody = [1, 4, 10, 8];
  s.beat = Math.max(.38, .79 - level * .045 - (s.mode === 'climb' ? Math.min(.13, s.round * .007) : 0));
  s.events.push({
    type: 'phrase',
    name: s.sheet.title
  });
  listen(s);
}
function listen(s) {
  s.phase = 'listen';
  s.age = 0;
  s.shown = 0;
  s.cursor = 0;
  s.answers = [];
  s.marks = [];
  s.turn++;
  s.times = s.melody.map((_, i) => .34 + i * s.beat + (i >= 4 ? Math.floor(i / 4) * .18 : 0));
  s.events.push({
    type: 'listen',
    times: [...s.times],
    notes: [...s.melody],
    tonic: s.sheet.tonic
  });
}
export function encore(s) {
  if (s.ended || s.phase !== 'echo') return false;
  s.encores++;
  listen(s);
  s.events.push({
    type: 'rehear'
  });
  return true;
}
export function finish(s, reason = 'bow') {
  if (s.ended) return;
  s.ended = true;
  s.phase = 'over';
  s.events.push({
    type: 'end',
    reason
  });
}
export function answer(s, mask) {
  if (s.ended || s.phase !== 'echo' || !Number.isInteger(mask) || mask < 1 || mask > 15) return false;
  s.lastMask = mask;
  for (const n of voices(mask)) s.glow[n] = 1;
  s.events.push({
    type: 'answer',
    mask,
    tonic: s.sheet.tonic
  });
  if (mask !== s.melody[s.cursor]) {
    s.hearts--;
    s.errors++;
    s.phase = 'retry';
    s.age = 0;
    s.events.push({
      type: 'miss',
      index: s.cursor,
      expected: s.melody[s.cursor]
    });
    if (s.hearts <= 0) finish(s, 'hearts');
    return false;
  }
  s.answers.push(mask);
  s.cursor++;
  s.score += 40 + voices(mask).length * 7;
  if (s.cursor === s.melody.length) {
    s.completed++;
    s.longest = Math.max(s.longest, s.cursor);
    s.score += s.cursor * 14;
    s.phase = 'applause';
    s.age = 0;
    s.events.push({
      type: 'clear',
      size: s.cursor
    });
  }
  return true;
}
export function step(s, dt) {
  if (s.ended) return;
  s.age += dt;
  s.elapsed += dt;
  for (let i = 0; i < 4; i++) s.glow[i] = Math.max(0, s.glow[i] - dt * 1.7);
  if (s.phase === 'listen') {
    while (s.shown < s.times.length && s.age >= s.times[s.shown]) {
      const mask = s.melody[s.shown++];
      s.lastMask = mask;
      for (const n of voices(mask)) s.glow[n] = 1;
      s.events.push({
        type: 'cue',
        mask
      });
    }
    if (s.shown === s.times.length && s.age > s.times.at(-1) + s.beat + .18) {
      s.phase = 'echo';
      s.age = 0;
      s.cursor = 0;
      s.lastMask = 0;
      s.events.push({
        type: 'echo'
      });
    }
  } else if (s.phase === 'retry' && s.age > .85) listen(s);else if (s.phase === 'applause' && s.age > .82) {
    s.round++;
    if (s.mode === 'book' && s.round >= 7 || s.mode === 'daily' && s.round >= 3) {
      s.songs++;
      s.score += 220;
      s.events.push({
        type: 'song',
        piece: s.piece
      });
      s.round = 0;
      if (s.mode === 'book' && s.start + s.songs >= 24 || s.mode === 'daily' && s.songs >= 4) {
        finish(s, 'summit');
        return;
      }
      s.hearts = Math.min(3, s.hearts + 1);
    }
    prepare(s);
  }
}
export function drain(s) {
  return s.events.splice(0);
}
