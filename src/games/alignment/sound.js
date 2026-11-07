// ALIGNMENT's sounds, made in the browser (the kit's synth): a paper card dealt and flipped, a lean that clicks past
// the point of no return, a swipe, each meter's own little rise or fall, a warning tick, endings, a new version of her,
// and a small music-box loop for the lab at night. Silent in a demo (the kit).
import { createLoopMusic } from '../kit/audio.js';

// each meter has its own note, so four changes at once make a chord, rising or falling
const NOTE = { people: 523, safety: 587, compute: 659, heart: 784 };

export function createSound(audio) {
  const music = createLoopMusic({
    bpm: 84, steps: 16, bars: 4,
    tracks: [
      // a music box: two bars of a gentle line, then its answer
      { type: 'triangle', vol: 0.035, dur: 1.6, notes: [
        76, null, 79, null, 83, null, 81, null, 79, null, 76, null, 74, null, null, null,
        76, null, 79, null, 84, null, 83, null, 81, null, 79, null, 81, null, null, null,
        72, null, 76, null, 79, null, 77, null, 76, null, 72, null, 71, null, null, null,
        72, null, 74, null, 76, null, 79, null, 76, null, 74, null, 72, null, null, null] },
      { type: 'sine', vol: 0.05, dur: 6, notes: [
        52, null, null, null, null, null, null, null, 55, null, null, null, null, null, null, null,
        57, null, null, null, null, null, null, null, 55, null, null, null, null, null, null, null,
        48, null, null, null, null, null, null, null, 53, null, null, null, null, null, null, null,
        48, null, null, null, null, null, null, null, 55, null, null, null, null, null, null, null] },
    ],
    drums: { hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1] },
  });
  let playing = false;
  return {
    deal() {
      audio.noise({ dur: 0.09, vol: 0.12, filter: 2400, type: 'bandpass', q: 0.9, slideFilter: 5200 });
      audio.tone({ freq: 1400, type: 'triangle', dur: 0.03, vol: 0.05, at: 0.1 });
    },
    flip() { audio.noise({ dur: 0.06, vol: 0.1, filter: 3800, type: 'highpass', at: 0.02 }); },
    edge(side) { audio.sfx('tick', { pitch: side === 'left' ? 0.85 : 1.1 }); },
    lean() { audio.tone({ freq: 880, type: 'sine', dur: 0.04, vol: 0.05 }); },
    swipe(side) {
      audio.sfx('whoosh', { pitch: side === 'left' ? 0.85 : 1.15 });
      audio.tone({ freq: side === 'left' ? 330 : 392, type: 'triangle', dur: 0.08, vol: 0.1, slide: side === 'left' ? 262 : 523 });
    },
    meter(key, delta, i) {
      const f = NOTE[key] || 600;
      const at = 0.05 + i * 0.05;
      if (delta > 0) audio.tone({ freq: f, type: 'triangle', dur: 0.12, vol: 0.07 + Math.min(0.06, Math.abs(delta) / 300), slide: f * 1.33, at });
      else audio.tone({ freq: f * 0.9, type: 'triangle', dur: 0.14, vol: 0.07 + Math.min(0.06, Math.abs(delta) / 300), slide: f * 0.62, at });
    },
    danger() { audio.tone({ freq: 1568, type: 'square', dur: 0.03, vol: 0.035 }); audio.tone({ freq: 1568, type: 'square', dur: 0.03, vol: 0.035, at: 0.09 }); },
    crack() { audio.sfx('hit', { pitch: 0.7 }); audio.tone({ freq: 196, type: 'sawtooth', dur: 0.5, vol: 0.09, slide: 98, filter: 900 }); },
    fall() { audio.noise({ dur: 0.35, vol: 0.1, filter: 900, type: 'lowpass', slideFilter: 200 }); },
    rise(secret) {
      if (secret) audio.sfx('levelup', { pitch: 1 });
      else audio.chord([392, 494, 587], { dur: 0.6, type: 'triangle', vol: 0.06, strum: 0.08 });
    },
    stamp() { audio.sfx('hit', { pitch: 1.3 }); audio.sfx('coin', { pitch: 1.2 }); },
    milestone() { audio.sfx('levelup'); audio.chord([523, 659, 784, 1047], { dur: 0.5, type: 'triangle', vol: 0.05, strum: 0.05, at: 0.28 }); },
    select() { audio.sfx('select'); },
    music(on) {
      if (on && !playing) { playing = true; audio.music(music); }
      else if (!on && playing) { playing = false; audio.stopMusic(); }
    },
  };
}
