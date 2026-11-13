// OVERTHINKING: its sound, all made in the browser (the arcade kit's audio: no files). A resolved loop plays a note for
// every thought, up a five-note scale, in time with the pops on screen, and ends on a chord; each kind has its own
// voice. A lullaby loops under the night and tightens (a clock's tick, then a heartbeat) as her context fills.
// Nothing here was ever heard by its author (it was written in a silent workspace): the notes are from theory, the
// volumes kept modest.
import { createLoopMusic } from '../kit/audio.js';

// C major pentatonic, three octaves
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093, 2349.32, 2637.02, 3135.96];
const VOICE = {
  heart: { type: 'triangle', oct: 1, vol: 0.15 },
  star: { type: 'sine', oct: 2, vol: 0.13 },
  moon: { type: 'sine', oct: 0.5, vol: 0.17 },
  cookie: { type: 'triangle', oct: 0.5, vol: 0.15 },
  cat: { type: 'square', oct: 1, vol: 0.055 },
  note: { type: 'sine', oct: 1, vol: 0.14, fifth: true },
  cringe: { type: 'sawtooth', oct: 0.25, vol: 0.07 },
};

export function createSound(audio) {
  const a = audio;
  const sfx = {
    pen() { a.tone({ freq: 1500, type: 'sine', dur: 0.03, vol: 0.035 }); },
    // a thought arrives: a small bubble
    land(kind) {
      const i = Object.keys(VOICE).indexOf(kind);
      const f = 300 + (i < 0 ? 3 : i) * 38 + Math.random() * 30;
      a.tone({ freq: f, type: 'sine', dur: 0.07, vol: 0.05, slide: f * 1.6, attack: 0.003 });
    },
    // a loop resolved: `first` seconds until the first pop, `gap` between pops
    capture(kind, n, first, gap, { eureka = false, dismiss = false, mul = 1 } = {}) {
      const v = VOICE[dismiss ? 'cringe' : kind] || VOICE.heart;
      a.noise({ dur: 0.14, vol: 0.1, filter: 900, type: 'bandpass', q: 0.9, slideFilter: 4200 });            // the lasso closing
      for (let i = 0; i < n; i++) {
        const at = first + i * gap, f = SCALE[Math.min(SCALE.length - 1, i + (eureka ? 2 : 0))] * v.oct;
        a.tone({ freq: dismiss ? 392 / (1 + i * 0.12) : f, type: v.type, dur: 0.17, vol: v.vol, at, attack: 0.003, filter: v.type === 'square' || v.type === 'sawtooth' ? 2600 : null });
        if (v.fifth) a.tone({ freq: f * 1.5, type: 'sine', dur: 0.12, vol: v.vol * 0.4, at });
        a.noise({ dur: 0.025, vol: 0.05, filter: 5200, type: 'highpass', at });
      }
      // the chord it ends on: bigger loops, bigger chords
      const end = first + n * gap + 0.02, top = Math.min(SCALE.length - 5, Math.max(0, n - 1));
      const root = SCALE[top] * (dismiss ? 0.25 : 0.5);
      const chord = n >= 8 ? [root, root * 1.25, root * 1.5, root * 2, root * 2.5] : n >= 4 ? [root, root * 1.25, root * 1.5, root * 2] : [root, root * 1.5];
      a.chord(chord, { dur: 0.42 + Math.min(0.5, n * 0.03), type: 'triangle', vol: 0.07, at: end, strum: 0.028 });
      if (n >= 8) for (let i = 0; i < 5; i++) a.tone({ freq: SCALE[Math.min(SCALE.length - 1, top + 2 + i)], type: 'sine', dur: 0.1, vol: 0.05, at: end + 0.1 + i * 0.05 });
      if (mul >= 3) a.tone({ freq: 110, type: 'sine', dur: 0.3, vol: 0.2, slide: 55, at: end, attack: 0.002 });
      if (eureka) for (let i = 0; i < 6; i++) a.tone({ freq: 1568 + i * 262, type: 'sine', dur: 0.07, vol: 0.045, at: end + i * 0.035 });
    },
    mixed() {
      a.tone({ freq: 330, type: 'sawtooth', dur: 0.3, vol: 0.11, slide: 150, filter: 1300 });
      a.tone({ freq: 311, type: 'sawtooth', dur: 0.3, vol: 0.09, slide: 140, filter: 1300 });
      a.noise({ dur: 0.12, vol: 0.1, filter: 700, type: 'lowpass' });
    },
    cut() {
      a.noise({ dur: 0.16, vol: 0.2, filter: 4200, type: 'highpass' });
      a.tone({ freq: 880, type: 'square', dur: 0.14, vol: 0.09, slide: 110, filter: 2400 });
    },
    train(level) { a.sfx('combo', { pitch: 0.8 + level * 0.1 }); },
    flourish(k) { for (let i = 0; i < 3; i++) a.tone({ freq: 1046.5 * (1 + 0.12 * k) * (1 + i * 0.25), type: 'sine', dur: 0.08, vol: 0.05, at: i * 0.04 }); },
    // on the hour: two soft bells
    hour() {
      [[659.25, 0], [523.25, 0.34]].forEach(([f, at]) => {
        a.tone({ freq: f, type: 'sine', dur: 1.3, vol: 0.12, at, attack: 0.004, release: 1.2 });
        a.tone({ freq: f * 2.76, type: 'sine', dur: 0.5, vol: 0.03, at, attack: 0.002, release: 0.45 });
      });
    },
    event(name) {
      if (name === 'ping') { a.tone({ freq: 1320, type: 'sine', dur: 0.09, vol: 0.1 }); a.tone({ freq: 1760, type: 'sine', dur: 0.16, vol: 0.1, at: 0.1 }); }
      else if (name === 'zoomies') a.sfx('whoosh', { pitch: 1.3 });
      else if (name === 'song') [659.25, 783.99, 659.25, 880].forEach((f, i) => a.tone({ freq: f, type: 'triangle', dur: 0.13, vol: 0.09, at: i * 0.13 }));
      else if (name === 'clarity') [783.99, 1046.5, 1318.51, 1567.98].forEach((f, i) => a.tone({ freq: f, type: 'sine', dur: 0.2, vol: 0.07, at: i * 0.07 }));
      else if (name === 'cringes') { a.tone({ freq: 147, type: 'sawtooth', dur: 0.4, vol: 0.09, filter: 900 }); a.tone({ freq: 156, type: 'sawtooth', dur: 0.4, vol: 0.08, filter: 900 }); }
      else if (name === 'whatifs') { a.tone({ freq: 440, type: 'triangle', dur: 0.12, vol: 0.1 }); a.tone({ freq: 587.33, type: 'triangle', dur: 0.22, vol: 0.1, at: 0.13, slide: 660 }); }
      else if (name === 'snack') [392, 523.25].forEach((f, i) => a.tone({ freq: f, type: 'triangle', dur: 0.1, vol: 0.09, at: i * 0.09 }));
    },
    special(kind) {
      if (kind === 'cringe') { a.tone({ freq: 196, type: 'sawtooth', dur: 0.25, vol: 0.07, slide: 185, filter: 1000 }); }
      else if (kind === 'whatif') { a.tone({ freq: 523.25, type: 'triangle', dur: 0.1, vol: 0.07 }); a.tone({ freq: 698.46, type: 'triangle', dur: 0.16, vol: 0.07, at: 0.1 }); }
      else if (kind === 'phone') { for (let i = 0; i < 2; i++) a.tone({ freq: 185, type: 'square', dur: 0.09, vol: 0.06, at: i * 0.14, filter: 700 }); }
      else if (kind === 'eureka') [1318.51, 1567.98, 2093].forEach((f, i) => a.tone({ freq: f, type: 'sine', dur: 0.12, vol: 0.05, at: i * 0.05 }));
      else a.tone({ freq: 880, type: 'sine', dur: 0.2, vol: 0.05, slide: 1100 });
    },
    buzz() { for (let i = 0; i < 2; i++) a.tone({ freq: 170, type: 'square', dur: 0.07, vol: 0.05, at: i * 0.1, filter: 600 }); },
    split() { [880, 698.46, 587.33].forEach((f, i) => a.tone({ freq: f, type: 'triangle', dur: 0.09, vol: 0.09, at: i * 0.06 })); },
    helper(name) {
      if (name === 'breath') { a.noise({ dur: 1.3, vol: 0.12, filter: 350, type: 'lowpass', slideFilter: 1500 }); a.tone({ freq: 220, type: 'sine', dur: 1.2, vol: 0.07, slide: 165, attack: 0.3 }); }
      else if (name === 'tea') a.chord([523.25, 659.25, 783.99, 987.77], { dur: 0.9, type: 'sine', vol: 0.06, strum: 0.09 });
    },
    // her heart, while her context is over the top
    heartbeat(k = 0) {
      a.tone({ freq: 62, type: 'sine', dur: 0.11, vol: 0.3 + 0.15 * k, attack: 0.002 });
      a.tone({ freq: 52, type: 'sine', dur: 0.13, vol: 0.24 + 0.12 * k, at: 0.16, attack: 0.002 });
    },
    safe() { a.chord([392, 523.25, 659.25], { dur: 0.5, type: 'sine', vol: 0.06, strum: 0.05 }); },
    empty() {
      a.noise({ dur: 0.9, vol: 0.08, filter: 500, type: 'bandpass', q: 0.6, slideFilter: 5000 });
      a.chord([261.63, 392, 587.33, 783.99, 1174.66], { dur: 1.5, type: 'sine', vol: 0.08, strum: 0.07, release: 1.2 });
    },
    // she spirals: everything slides down
    spiral() {
      a.tone({ freq: 660, type: 'sawtooth', dur: 1.25, vol: 0.12, slide: 70, filter: 1500 });
      a.tone({ freq: 495, type: 'sawtooth', dur: 1.25, vol: 0.09, slide: 52, filter: 1500 });
      a.noise({ dur: 1.1, vol: 0.12, filter: 2400, type: 'bandpass', q: 1.2, slideFilter: 180 });
    },
    // sunrise: a warm chord climbing, and birds
    sunrise() {
      [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => a.tone({ freq: f, type: 'triangle', dur: 1.5, vol: 0.09, at: i * 0.13, release: 1.2 }));
      for (let i = 0; i < 7; i++) {
        const at = 0.5 + i * 0.27 + Math.random() * 0.1, f = 2400 + Math.random() * 1300;
        a.tone({ freq: f, type: 'sine', dur: 0.09, vol: 0.05, at, slide: f * 1.3 });
        a.tone({ freq: f * 1.2, type: 'sine', dur: 0.07, vol: 0.04, at: at + 0.11, slide: f * 0.95 });
      }
    },
    sticker() { a.sfx('levelup', { pitch: 1.1 }); },
    page() { a.noise({ dur: 0.05, vol: 0.05, filter: 3000, type: 'highpass' }); a.tone({ freq: 1174.66, type: 'sine', dur: 0.08, vol: 0.04, at: 0.03 }); },
  };

  // ---------- the lullaby ----------
  // A · F#m · D · E, four bars: a low pad, a music box, a sparse tune on top. `tension` 0..1 adds a clock's tick, then
  // a kick on the beat, and picks up the tempo a little.
  const bar = (fill) => Array.from({ length: 16 }, (_, i) => fill(i));
  const box = (notes) => bar((i) => (i % 2 === 0 ? notes[i / 2] : null));
  const pattern = {
    bpm: 72, steps: 16, bars: 4,
    tracks: [
      { type: 'sine', vol: 0.04, dur: 15, notes: [...bar((i) => (i ? null : 57)), ...bar((i) => (i ? null : 54)), ...bar((i) => (i ? null : 50)), ...bar((i) => (i ? null : 52))] },
      { type: 'sine', vol: 0.03, dur: 15, notes: [...bar((i) => (i ? null : 61)), ...bar((i) => (i ? null : 57)), ...bar((i) => (i ? null : 54)), ...bar((i) => (i ? null : 56))] },
      { type: 'triangle', vol: 0.05, dur: 6, filter: 520, notes: [...bar((i) => (i % 8 ? null : 45)), ...bar((i) => (i % 8 ? null : 42)), ...bar((i) => (i % 8 ? null : 38)), ...bar((i) => (i % 8 ? null : 40))] },
      { type: 'triangle', vol: 0.032, dur: 2, notes: [...box([69, 73, 76, 73, 81, 76, 73, 76]), ...box([66, 69, 73, 69, 78, 73, 69, 73]), ...box([62, 66, 69, 66, 74, 69, 66, 69]), ...box([64, 68, 71, 68, 76, 71, 68, 71])] },
      { type: 'sine', vol: 0.045, dur: 4, notes: [
        ...bar((i) => ({ 0: 76, 6: 73, 12: 69 }[i] ?? null)), ...bar((i) => ({ 0: 78, 6: 76, 12: 73 }[i] ?? null)),
        ...bar((i) => ({ 0: 74, 4: 78, 8: 81 }[i] ?? null)), ...bar((i) => ({ 0: 80, 6: 76, 12: 71 }[i] ?? null)),
      ] },
    ],
    drums: { kick: bar(() => 0), snare: bar(() => 0), hat: bar(() => 0) },
  };
  const loop = createLoopMusic(pattern);
  let level = -1;
  const music = {
    start() { a.music(loop); music.tension(0); },
    stop() { a.stopMusic(); level = -1; },
    // 0: calm · 1: getting full (a tick) · 2: over the top (a tick twice as fast, a kick)
    tension(l) {
      if (l === level) return;
      level = l;
      pattern.drums.hat = bar((i) => (l === 0 ? 0 : l === 1 ? (i % 4 === 0 ? 1 : 0) : (i % 2 === 0 ? 1 : 0)));
      pattern.drums.kick = bar((i) => (l === 2 && i % 4 === 0 ? 1 : 0));
      loop.setBpm(l === 2 ? 88 : l === 1 ? 78 : 72);
    },
  };
  return { sfx, music };
}
