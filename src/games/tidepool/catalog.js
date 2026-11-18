import records from './records.json' with { type: 'json' };
import { beatAt, isDownbeat } from '../heartbeat/chart.js';

export const EDITS = [
  { id: 'hook', name: 'Hook', hint: 'the record’s signature phrase', fadeBeats: 4 },
  { id: 'intro', name: 'Lead-in', hint: 'a softer entrance', fadeBeats: 8 },
  { id: 'break', name: 'Break', hint: 'a quick change of texture', fadeBeats: 2 },
  { id: 'encore', name: 'Encore', hint: 'the strongest late phrase', fadeBeats: 8 },
];
const signatureLevel = { 'feel-the-agi':4.6, 'si-its-better':3.2, 'send-it':8.2, mainrunner:6.6, 'save-slot-2':2.25, agi:5.8, 'after-agi':4.1 };
const colors = ['#ff94c2', '#efb87c', '#ef96bd', '#bca0fb', '#91dbed', '#cf9fe9', '#a0dbbd'];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export function measuredEnergy(song, beat, length = 8) {
  let sum = 0;
  for (let i = 0; i < length; i++) sum += Number(song.energy[clamp(beat + i, 0, song.energy.length - 1)]);
  return sum / length;
}

function makeCut(song, edit) {
  const length = song.beats.length;
  const starts = [];
  for (let i = song.bar; i < length - 85; i += 4) starts.push(i);
  const previewStart = beatAt(song.beats, song.preview[0]);
  const zone = {
    hook: [.25,.75], intro: [.025,.23], break: [.25,.7], encore: [.45,.83],
  }[edit];
  const allowed = starts.filter(i => i >= length * zone[0] && i <= length * zone[1]);
  const pool = allowed.length ? allowed : starts;
  function desirability(i) {
    const opening = measuredEnergy(song, i);
    const later = measuredEnergy(song, i + 8);
    if (edit === 'hook') return -Math.abs((opening+later)/2-signatureLevel[song.id])*2 - Math.abs(i-previewStart)/125;
    if (edit === 'intro') return -opening + (later - opening) * .3;
    if (edit === 'break') return Math.abs(later - opening) - opening * .24;
    return opening + later * .3;
  }
  const start = pool.reduce((best, i) => desirability(i) > desirability(best) ? i : best, pool[0]);
  const opening = measuredEnergy(song, start);
  const ending = measuredEnergy(song, start + 8);
  const heat = clamp(Math.round((opening + ending) * .42 - 1), 1, 5);
  const curve = ending - opening > .45 ? 'rise' : opening - ending > .45 ? 'ease' : 'level';
  return { edit, start, heat, curve, offset: song.beats[start] };
}

export const SONGS = records.map((record, index) => {
  const song = { ...record, color: colors[index] };
  song.cuts = Object.fromEntries(EDITS.map(edit => [edit.id, makeCut(song, edit.id)]));
  return song;
});
export const byId = Object.fromEntries(SONGS.map(song => [song.id, song]));
export const editById = Object.fromEntries(EDITS.map(edit => [edit.id, edit]));

export function barDuration(song, at) {
  const index = clamp(Math.floor(beatAt(song.beats, at)), 0, song.beats.length - 5);
  return song.beats[index + 4] - song.beats[index];
}

export function playback(track, edit = 'hook', rate = 1) {
  const cut = byId[track].cuts[edit];
  return { track, edit, startBeat: cut.start, offset: cut.offset, rate };
}

export function chartTime(deck, elapsed) {
  return deck.offset + Math.max(0, elapsed) * deck.rate;
}

export function barLine(song, time, afterBars = 0) {
  let index = Math.max(0, Math.ceil(beatAt(song.beats, time)));
  while (!isDownbeat(index, song.bar)) index++;
  return Math.min(song.beats.length - 1, index + 4 * afterBars);
}

export function phaseAt(song, time) {
  const beat = beatAt(song.beats, time);
  const nearestBeat = Math.round(beat);
  const inBar = ((beat - song.bar) % 4 + 4) % 4;
  return { beat, inBar, nearestBeat, downbeatDistance: Math.min(inBar, 4 - inBar) };
}
