// REAL OR AI? (2026-11-08): its sounds, made in the browser with the kit's synth (no files): a print flicked off the
// stack, a camera's shutter for REAL, a synth bleep for AI, the stamp's thud, a sweet or a sour sting for the verdict,
// the clock's last ticks, the streak climbing in pitch, a heart cracking, the loupe's glass.
export function createSounds(audio) {
  const a = audio;
  const jit = (p = 0.04) => 1 + (Math.random() * 2 - 1) * p;
  return {
    deal() {
      const p = jit(0.08);
      a.noise({ dur: 0.1, vol: 0.13, filter: 1800 * p, type: 'bandpass', q: 0.8, slideFilter: 5600 * p });
      a.tone({ freq: 210 * p, type: 'sine', dur: 0.06, vol: 0.05, slide: 320 * p });
    },
    flip() {
      const p = jit(0.06);
      a.noise({ dur: 0.045, vol: 0.16, filter: 4400 * p, type: 'highpass' });
      a.tone({ freq: 620 * p, type: 'triangle', dur: 0.04, vol: 0.04, at: 0.01 });
    },
    // REAL: a mechanical shutter: the curtain's two clicks and a small whir between
    shutter() {
      const p = jit(0.05);
      a.noise({ dur: 0.022, vol: 0.34, filter: 3400 * p, type: 'bandpass', q: 1.3 });
      a.tone({ freq: 2100 * p, type: 'square', dur: 0.01, vol: 0.04 });
      a.noise({ dur: 0.07, vol: 0.06, filter: 1200 * p, type: 'lowpass', at: 0.012 });
      a.noise({ dur: 0.03, vol: 0.28, filter: 2500 * p, type: 'bandpass', q: 1.5, at: 0.06 });
    },
    // AI: a quick bright chord, a little digital
    bleep() {
      const p = jit(0.03);
      a.chord([784 * p, 988 * p, 1175 * p], { type: 'square', dur: 0.08, vol: 0.045, strum: 0.022 });
      a.tone({ freq: 1568 * p, type: 'sine', dur: 0.12, vol: 0.05, at: 0.07, slide: 2093 * p });
    },
    stamp() {
      const p = jit(0.06);
      a.tone({ freq: 150 * p, type: 'sine', dur: 0.18, vol: 0.42, slide: 48, attack: 0.002 });
      a.noise({ dur: 0.09, vol: 0.3, filter: 650 * p, type: 'lowpass' });
      a.noise({ dur: 0.025, vol: 0.14, filter: 3200, type: 'highpass' });
    },
    good(mult = 1) {
      const p = 1 + Math.min(4, mult - 1) * 0.06;
      [523, 659, 784, 1047].forEach((f, i) => a.tone({ freq: f * p, type: 'triangle', dur: 0.17, vol: 0.11, at: 0.04 + i * 0.055 }));
    },
    sour() {
      a.tone({ freq: 330, type: 'sawtooth', dur: 0.2, vol: 0.08, filter: 1300, at: 0.03 });
      a.tone({ freq: 311, type: 'sawtooth', dur: 0.34, vol: 0.08, filter: 1100, at: 0.15, slide: 233 });
    },
    timeout() {
      a.tone({ freq: 220, type: 'square', dur: 0.12, vol: 0.08, filter: 1600 });
      a.tone({ freq: 196, type: 'square', dur: 0.24, vol: 0.08, filter: 1400, at: 0.13 });
    },
    tick(urgent) { a.tone({ freq: urgent ? 1320 : 990, type: 'square', dur: 0.022, vol: urgent ? 0.06 : 0.035 }); },
    // each right answer in a row a little higher
    climb(n) { a.tone({ freq: 660 * (1 + Math.min(n, 20) * 0.045), type: 'square', dur: 0.05, vol: 0.05, at: 0.2 }); },
    multUp(m) { [523, 659, 784, 1047, 1319].forEach((f, i) => a.tone({ freq: f * (1 + (m - 2) * 0.08), type: 'square', dur: 0.09, vol: 0.07, at: 0.25 + i * 0.05 })); },
    heart() {
      a.noise({ dur: 0.2, vol: 0.2, filter: 5200, type: 'highpass' });
      [1480, 1180, 880].forEach((f, i) => a.tone({ freq: f, type: 'triangle', dur: 0.09, vol: 0.07, at: 0.03 + i * 0.06 }));
      a.tone({ freq: 180, type: 'sine', dur: 0.2, vol: 0.18, slide: 70, at: 0.02 });
    },
    loupeOn() { a.tone({ freq: 880, type: 'sine', dur: 0.09, vol: 0.05, slide: 1320 }); a.noise({ dur: 0.05, vol: 0.03, filter: 6000, type: 'highpass' }); },
    loupeOff() { a.tone({ freq: 1100, type: 'sine', dur: 0.07, vol: 0.03, slide: 700 }); },
    whoosh() { a.sfx('whoosh', { pitch: 1.25 }); },
    nudge() { a.sfx('tap', { pitch: 0.8 }); },
    perfect() { a.sfx('levelup'); a.sfx('win', { pitch: 1.5 }); },
  };
}

// a slow, quiet darkroom loop (the arcade's Music switch): soft triangle chords and a brushed beat
export function labMusic() {
  return {
    bpm: 84, steps: 16, bars: 4,
    tracks: [
      { type: 'triangle', vol: 0.03, dur: 14, notes: [57, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
        53, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
        48, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
        55, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null] },
      { type: 'triangle', vol: 0.022, dur: 14, notes: [64, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
        60, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
        55, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
        62, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null] },
      { type: 'sine', vol: 0.03, dur: 2, notes: [76, null, null, 72, null, null, 69, null, 72, null, null, null, 74, null, null, null,
        72, null, null, 69, null, null, 65, null, 69, null, null, null, 72, null, null, null,
        67, null, null, 64, null, null, 60, null, 64, null, null, null, 67, null, null, null,
        71, null, null, 67, null, null, 62, null, 67, null, null, null, 69, null, 71, null] },
    ],
    drums: { hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1] },
  };
}
