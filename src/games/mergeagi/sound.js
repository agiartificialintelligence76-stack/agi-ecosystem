// MERGE TO AGI (2026-11-08): its sounds, made in the browser with the arcade kit's synth (no files): a soft tap as an
// orb lands, a bubbly bloop for each merge (bigger tiers deeper, each step of a chain a note higher on a pentatonic
// scale), a thump and a chord for the big ones, a sparkle for AGI-1, a shockwave for the SINGULARITY, a ticking red
// line, and a quiet lo-fi loop. Silent in a demo (the kit).
import { createLoopMusic } from '../kit/audio.js';

// the note each tier sings when it's made (C pentatonic, high to low as the orbs grow)
const NOTE = [0, 1318.5, 1046.5, 880, 784, 659.3, 587.3, 523.3, 440, 392, 329.6, 261.6, 196];
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
const st = (n) => 2 ** (n / 12);

export function createSound(audio) {
  let lastLand = 0, lastTick = 0, music = null;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);

  return {
    drop(tier) {
      audio.tone({ freq: 620 - tier * 40, type: 'sine', dur: 0.07, vol: 0.12, slide: 300 - tier * 20 });
      audio.noise({ dur: 0.025, vol: 0.05, filter: 5200, type: 'highpass' });
    },
    land(tier, speed) {
      const t = now();
      if (t - lastLand < 45 || speed < 300) return;
      lastLand = t;
      const v = Math.min(1, (speed - 300) / 1400);
      audio.tone({ freq: 230 - tier * 12, type: 'sine', dur: 0.09, vol: 0.05 + v * 0.14, slide: 120 - tier * 6, attack: 0.002 });
      audio.noise({ dur: 0.05, vol: 0.03 + v * 0.07, filter: 700 - tier * 25, type: 'lowpass' });
    },
    merge(tier, chain = 1) {
      const f = NOTE[Math.min(12, tier)] * st(PENTA[Math.min(PENTA.length - 1, chain - 1)]);
      audio.tone({ freq: f * 0.8, type: 'sine', dur: 0.14, vol: 0.22, slide: f * 1.25, attack: 0.003 });
      audio.tone({ freq: f * 2, type: 'triangle', dur: 0.09, vol: 0.06, at: 0.02 });
      audio.noise({ dur: 0.035, vol: 0.07, filter: 2600, q: 1.4, type: 'bandpass' });
      if (tier >= 6) {
        audio.tone({ freq: 110, type: 'sine', dur: 0.28, vol: 0.12 + (tier - 6) * 0.04, slide: 42, attack: 0.002 });
        audio.chord([f * 0.5, f * 0.63, f * 0.75], { type: 'triangle', dur: 0.42, vol: 0.05, at: 0.04, strum: 0.03 });
      }
      if (chain >= 2) audio.sfx('combo', { pitch: st(PENTA[Math.min(PENTA.length - 1, chain - 1)]) * 0.9, spread: 0 });
    },
    her() {
      [523.3, 659.3, 784, 1046.5, 1318.5, 1568].forEach((f, i) => audio.tone({ freq: f, type: 'triangle', dur: 0.22, vol: 0.1, at: i * 0.06 }));
      audio.noise({ dur: 0.6, vol: 0.06, filter: 6000, type: 'highpass', at: 0.1 });
    },
    singularity() {
      audio.sfx('explode', { pitch: 0.8 });
      audio.noise({ dur: 0.9, vol: 0.14, filter: 300, type: 'bandpass', q: 0.8, slideFilter: 6000 });
      audio.chord([261.6, 329.6, 392, 523.3, 659.3], { type: 'triangle', dur: 1.2, vol: 0.07, at: 0.35, strum: 0.05 });
    },
    discover() { audio.sfx('levelup', { pitch: 1 }); },
    tick(level) {
      const t = now(), gap = 520 - level * 380;
      if (t - lastTick < gap) return;
      lastTick = t;
      audio.tone({ freq: 880 + level * 440, type: 'square', dur: 0.03, vol: 0.045 + level * 0.05 });
    },
    over() { audio.sfx('lose'); },
    flush() { audio.sfx('whoosh', { pitch: 1.3 }); },
    // a quiet loop under the run (the arcade's Music switch); faster when the jar is nearly full
    music(on, tense = false) {
      if (!on) { audio.stopMusic(); music = null; return; }
      if (!music) { music = createLoopMusic(PATTERN); audio.music(music); }
      music.setBpm(tense ? 104 : 90);
    },
  };
}

// Am · F · C · G: an eighth-note arpeggio, a bass on the half notes, a soft hat on the off-beats
const ARP = [
  [69, 72, 76, 72, 69, 76, 72, 76],
  [65, 69, 72, 69, 65, 72, 69, 72],
  [64, 67, 72, 67, 64, 72, 67, 72],
  [62, 67, 71, 67, 62, 71, 67, 74],
];
const BASS = [45, 41, 48, 43];
const PATTERN = {
  bpm: 90, steps: 16, bars: 4,
  tracks: [
    { type: 'triangle', vol: 0.028, filter: 2400, dur: 1.6, notes: ARP.flatMap((bar) => bar.flatMap((n) => [n, null])) },
    { type: 'sine', vol: 0.06, dur: 6, notes: BASS.flatMap((n) => [n, ...Array(7).fill(null), n, ...Array(7).fill(null)]) },
  ],
  drums: { hat: [0, 0, 1, 0] },
};
