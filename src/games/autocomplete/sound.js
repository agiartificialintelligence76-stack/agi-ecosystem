// AUTOCOMPLETE (2026-11-09): its sounds, made in the browser with the kit's synth (src/games/kit/audio.js): a key's
// click that climbs a scale as the word grows, the word played back as a little run of notes, a soft bonk for a
// non-word, stamps for long words, the glitch's crackle, and a small looping tune.
import { createLoopMusic } from '../kit/audio.js';

// a major pentatonic, two octaves and a bit (a word's keys climb it)
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093, 2349.3, 2637];
const note = (k) => SCALE[Math.max(0, Math.min(SCALE.length - 1, k))];

export function createSound(audio) {
  const a = audio;
  const jitter = () => 1 + (Math.random() * 2 - 1) * 0.012;
  return {
    // a key joins the word (n: its place in the word)
    key(n) {
      a.noise({ dur: 0.018, vol: 0.13, filter: 5200, type: 'highpass' });
      a.tone({ freq: note(n) * jitter(), type: 'triangle', dur: 0.09, vol: 0.13, attack: 0.002 });
    },
    // a key comes off (slid back)
    back(n) { a.tone({ freq: note(Math.max(0, n)) * 0.75, type: 'triangle', dur: 0.07, vol: 0.09, slide: note(Math.max(0, n)) * 0.6 }); },
    // the letters so far make a word
    valid() { a.tone({ freq: 1975, type: 'sine', dur: 0.06, vol: 0.05 }); },
    // a word played: its keys as a quick run up, then a chord (bigger for longer words)
    word(len, kind) {
      const n = Math.min(len, 9);
      for (let i = 0; i < n; i++) a.tone({ freq: note(i + 1) * jitter(), type: 'square', dur: 0.07, vol: 0.06, at: i * 0.035, filter: 3200 });
      const at = n * 0.035;
      const root = kind === 'longer' ? 1.5 : kind === 'surprise' ? 1.25 : 1;
      a.chord([523.25 * root, 659.25 * root, 783.99 * root], { dur: 0.26, type: 'triangle', vol: 0.09, at, strum: 0.02 });
      if (len >= 6) a.chord([1046.5 * root, 1318.5 * root], { dur: 0.35, type: 'sine', vol: 0.07, at: at + 0.08 });
    },
    predictable() { a.tone({ freq: 659, type: 'sine', dur: 0.12, vol: 0.08, at: 0.12 }); a.tone({ freq: 523, type: 'sine', dur: 0.18, vol: 0.08, at: 0.22 }); },
    surprise() { a.tone({ freq: 380, type: 'triangle', dur: 0.24, vol: 0.12, slide: 1250, at: 0.08 }); a.noise({ dur: 0.18, vol: 0.06, filter: 2400, type: 'bandpass', q: 1.2, slideFilter: 6000, at: 0.08 }); },
    longer() {
      a.tone({ freq: 300, type: 'sawtooth', dur: 0.32, vol: 0.07, slide: 1500, filter: 3000, at: 0.06 });
      [1046.5, 1318.5, 1568, 2093].forEach((f, i) => a.tone({ freq: f, type: 'triangle', dur: 0.12, vol: 0.06, at: 0.24 + i * 0.05 }));
    },
    // SIX! SEVEN!!
    stamp() { a.tone({ freq: 140, slide: 55, type: 'sine', dur: 0.22, vol: 0.32, attack: 0.002 }); a.noise({ dur: 0.12, vol: 0.18, filter: 1200, type: 'lowpass' }); },
    bonk() { a.tone({ freq: 210, slide: 120, type: 'sine', dur: 0.16, vol: 0.22, attack: 0.002 }); a.tone({ freq: 160, type: 'square', dur: 0.06, vol: 0.04, filter: 900, at: 0.02 }); },
    glitch() { for (let i = 0; i < 4; i++) a.noise({ dur: 0.03, vol: 0.12, filter: 1800 + i * 900, type: 'bandpass', q: 3, at: i * 0.05 }); a.tone({ freq: 90, type: 'square', dur: 0.2, vol: 0.05, filter: 600 }); },
    fixed() { [784, 988, 1175, 1568].forEach((f, i) => a.tone({ freq: f, type: 'square', dur: 0.08, vol: 0.06, at: i * 0.05 })); },
    corrupt() { a.noise({ dur: 0.45, vol: 0.35, filter: 1100, type: 'lowpass', slideFilter: 140 }); a.tone({ freq: 120, slide: 40, type: 'sawtooth', dur: 0.35, vol: 0.12, filter: 700 }); },
    hint() { [1318.5, 1568, 2093, 2637].forEach((f, i) => a.tone({ freq: f, type: 'sine', dur: 0.16, vol: 0.06, at: i * 0.06 })); },
    tick() { a.tone({ freq: 1320, type: 'square', dur: 0.025, vol: 0.04 }); },
    low() { a.tone({ freq: 196, type: 'sine', dur: 0.12, vol: 0.12 }); a.tone({ freq: 196, type: 'sine', dur: 0.1, vol: 0.09, at: 0.16 }); },
    end() { [523, 440, 392, 330].forEach((f, i) => a.tone({ freq: f, type: 'triangle', dur: 0.22, vol: 0.12, at: i * 0.12 })); },
    select() { a.sfx('select'); },
  };
}

// a small lo-fi loop under the game: soft chords, a walking bass, a quiet beat (silent in a demo)
export function createMusic() {
  const chord = (root, third, fifth, seventh) => [root, null, third, null, fifth, null, seventh, null, fifth, null, third, null, root, null, null, null];
  return createLoopMusic({
    bpm: 84, steps: 16, bars: 4,
    tracks: [
      { type: 'triangle', vol: 0.028, dur: 2, octave: 0, notes: [...chord(65, 69, 72, 76), ...chord(62, 65, 69, 72), ...chord(60, 64, 67, 71), ...chord(62, 65, 69, 72)] },
      { type: 'sine', vol: 0.05, dur: 3, octave: -1, notes: [53, null, null, null, null, null, 53, null, 50, null, null, null, null, null, 50, null,
        48, null, null, null, null, null, 48, null, 50, null, null, null, 52, null, 50, null].flatMap((n) => [n]).concat([]) },
    ],
    drums: { kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0], hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1] },
  });
}
