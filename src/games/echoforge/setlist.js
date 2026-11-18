import recordings from './recordings.json' with { type: 'json' };
import { rng } from '../kit/fx.js';

// Each song has its own register, contour, and rhythmic language. Times below
// are musical beats. Exact seconds are interpolated from the recorded beat grid.
export const songs = recordings;
export const levels = ['soundcheck', 'studio', 'headliner'];
export const parts = ['lead', 'upper', 'lower'];
const signatures = {
  'feel-the-agi': { pitch: [0, 2, 1, 2, 0, 1], beats: [[0,1,2.5],[0,.75,2,3.5],[.5,1.5,2.5,3.25]], venue:'Velvet Room', ink:'#ed5ba0' },
  'si-its-better': { pitch: [2, 1, 0, 1, 2, 1], beats: [[0,1.5,3],[.5,1,2,3.5],[0,.75,2.5,3]], venue:'Honey Lounge', ink:'#ffb14d' },
  'send-it': { pitch: [0, 0, 2, 1, 2, 0], beats: [[0,1,3],[0,.5,1.5,2.75],[.25,1,2.5,3]], venue:'Postcard Club', ink:'#73dec5' },
  mainrunner: { pitch: [1, 0, 1, 2, 1, 2], beats: [[.5,1.5,3],[0,.75,1.5,3],[.25,1.25,2.75,3.5]], venue:'Night Platform', ink:'#b098ff' },
  'save-slot-2': { pitch: [1, 2, 0, 2, 1, 0], beats: [[0,2,3],[0,.5,2,3],[.5,1.75,2.5,3.25]], venue:'Pocket Theatre', ink:'#ff8986' },
  agi: { pitch: [2, 0, 1, 0, 2, 1], beats: [[0,1,2],[.5,1,2.5,3],[0,.75,2,3.5]], venue:'Ultraviolet', ink:'#f493ed' },
  'after-agi': { pitch: [0, 1, 2, 1, 0, 2], beats: [[0,1.5,2.5],[0,.75,2,2.75],[.25,1.5,2.5,3.5]], venue:'Daybreak Hall', ink:'#fab776' },
};
const sections = [
  {name:'Opening', from:0}, {name:'Verse', from:.12}, {name:'Chorus',from:.30},
  {name:'Bridge',from:.52}, {name:'Reprise',from:.67}, {name:'Final chorus',from:.85},
];
export function beatTime(grid, beat) {
  const n = Math.max(0, Math.min(grid.length - 2, Math.floor(beat)));
  return grid[n] + (beat - n) * (grid[n + 1] - grid[n]);
}
export function answerLane(lead, part) {
  return (lead + (part === 'upper' ? 1 : part === 'lower' ? 2 : 0)) % 3;
}
export function voicePitch(chord, lane, part, originalLane) {
  const base = 55 + ((chord[0] - 55 % 12 + 12) % 12);
  let midi = base + [0, chord[1], 7][lane];
  if (part === 'upper' && lane <= originalLane) midi += 12;
  if (part === 'lower' && lane >= originalLane) midi -= 12;
  return midi;
}
export function chooseTake(seed = 7, mode = 'setlist', options = {}) {
  const random = rng(seed || 7);
  const draw = () => songs[random.int(0, songs.length - 1)];
  const daily = mode === 'daily';
  const tune = daily ? draw() : songs.find(song => song.id === options.song) || draw();
  const difficulty = daily ? levels[random.int(0, 2)] : levels.includes(options.difficulty) ? options.difficulty : levels[0];
  const part = daily ? parts[random.int(0, 2)] : parts.includes(options.part) ? options.part : 'lead';
  return { tune, difficulty, part, seed };
}
function rhythm(profile, difficulty, index, section, dice) {
  if (index === 0) return [0,2];
  if (index === 1) return [0,3];
  const pattern = profile.beats[(index + dice.int(0, 2)) % profile.beats.length];
  if (difficulty === 'soundcheck') {
    const rounded = [...new Set(pattern.map(t => Math.min(3, Math.round(t))))];
    return rounded.slice(0, section < 2 ? 2 : 3);
  }
  if (difficulty === 'studio') return pattern.map(t => Math.round(t * 2) / 2).slice(0, section < 2 ? 3 : 4);
  if (section < 2 || pattern.length > 3) return pattern;
  return [...pattern, pattern.at(-1) < 3 ? 3.25 : 3.75];
}
export function arrange({tune, difficulty, part, seed}) {
  const profile = signatures[tune.id];
  const dice = rng(seed || 7);
  const phrases = [];
  const notes = [];
  const calls = [];
  for (let bar = tune.bar, i = 0; bar + 8 < tune.beats.length; bar += 8, i++) {
    const section = sections.findLastIndex(s => i / tune.harmony.length >= s.from);
    const shape = rhythm(profile, difficulty, i, section, dice);
    const chord = tune.harmony[i];
    const start = beatTime(tune.beats, bar);
    const reply = beatTime(tune.beats, bar + 4);
    const end = beatTime(tune.beats, bar + 8);
    const phrase = {index:i, section, label:sections[section].name, chord, start, reply, end, notes:[], calls:[]};
    const contour = i < 2 ? 0 : dice.int(0, profile.pitch.length - 1);
    shape.forEach((offset, k) => {
      const pitch = i < 2 ? [0,1][k] : profile.pitch[(contour + k) % profile.pitch.length];
      const lane = answerLane(pitch, part);
      const tailBeats = i >= 3 && k === shape.length - 1 && i % (difficulty === 'headliner' ? 2 : 3) === 0
        ? Math.min(1.2, 3.9 - offset) : 0;
      const hold = tailBeats >= .55 ? tailBeats : 0;
      const at = beatTime(tune.beats, bar + 4 + offset);
      const until = beatTime(tune.beats, bar + 4 + offset + hold);
      const note = {index:notes.length, phrase:i, lane, lead:pitch, offset, at, until,
        midi:voicePitch(chord, lane, part, pitch), leadMidi:voicePitch(chord, pitch, 'lead', pitch)};
      const callAt = beatTime(tune.beats, bar + offset);
      const call = {lane:pitch, at:callAt, midi:note.leadMidi,
        duration: hold ? beatTime(tune.beats, bar + offset + hold) - callAt : .13, phrase:i };
      notes.push(note); calls.push(call); phrase.notes.push(note); phrase.calls.push(call);
    });
    phrases.push(phrase);
  }
  return {song:tune.id, title:tune.title, duration:tune.duration, bpm:tune.bpm, beats:tune.beats,
    bar:tune.bar, difficulty, part, seed, phrases, notes, calls, ...profile};
}
export function phraseAt(chart, time) {
  let lo = 0, hi = chart.phrases.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (chart.phrases[mid].start <= time) lo = mid;
    else hi = mid - 1;
  }
  return chart.phrases[lo];
}
