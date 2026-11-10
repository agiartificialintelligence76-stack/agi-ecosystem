// PACKET LOSS: its sounds, made in the browser with the kit's synth (no files). Bits tick on two alternating pitches,
// a key drops the bass, a quarantine crunches (higher each time in a chain), packet loss glitches, the clear plays a
// little fanfare, and losing the connection is a sad modem. The music is a small looping bassline, faster each maze,
// and brighter while you're encrypted.
import { createLoopMusic } from '../kit/audio.js';

export function createSfx(audio) {
  const last = new Map();
  const ok = (k, gap) => {
    const now = performance.now() / 1000;
    if (now - (last.get(k) || -9) < gap) return false;
    last.set(k, now);
    return true;
  };
  let tick = 0;
  return {
    bit() {
      if (!ok('bit', 0.03)) return;
      tick ^= 1;
      audio.tone({ freq: tick ? 1568 : 1319, type: 'square', dur: 0.032, vol: 0.04, attack: 0.001 });
    },
    key() {
      audio.tone({ freq: 170, type: 'sine', dur: 0.5, vol: 0.32, slide: 42, attack: 0.002 });
      audio.tone({ freq: 85, type: 'square', dur: 0.32, vol: 0.06, slide: 40, filter: 500 });
      [784, 988, 1319].forEach((f, i) => audio.tone({ freq: f, type: 'triangle', dur: 0.14, vol: 0.06, at: 0.05 + i * 0.05 }));
    },
    quarantine(chain) {
      const p = 1 + 0.12 * (chain - 1);
      audio.noise({ dur: 0.12, vol: 0.28, filter: 1500, type: 'lowpass', slideFilter: 260 });
      audio.tone({ freq: 220 * p, type: 'square', dur: 0.09, vol: 0.09, slide: 90 });
      audio.tone({ freq: 660 * p, type: 'triangle', dur: 0.16, vol: 0.09, at: 0.07, slide: 1320 * p });
    },
    hit() {
      audio.noise({ dur: 0.28, vol: 0.22, filter: 2600, type: 'bandpass', q: 1.4, slideFilter: 300 });
      audio.tone({ freq: 520, type: 'sawtooth', dur: 0.32, vol: 0.12, slide: 70, filter: 1800 });
      for (let i = 0; i < 4; i++) audio.tone({ freq: 300 + Math.random() * 1400, type: 'square', dur: 0.025, vol: 0.05, at: 0.03 + i * 0.045 });
    },
    land() { if (ok('land', 0.05)) audio.tone({ freq: 1760 + Math.random() * 200, type: 'sine', dur: 0.04, vol: 0.05 }); },
    echo() {
      audio.tone({ freq: 220, type: 'sawtooth', dur: 0.6, vol: 0.05, slide: 440, filter: 900, attack: 0.4 });
      audio.tone({ freq: 330, type: 'triangle', dur: 0.6, vol: 0.06, slide: 165, at: 0.1 });
    },
    calm(on) { if (on) audio.chord([392, 494, 587], { dur: 0.6, type: 'sine', vol: 0.035, strum: 0.08, attack: 0.08 }); },
    gate(open) { if (ok('gate', 0.25)) audio.tone({ freq: open ? 520 : 260, type: 'square', dur: 0.05, vol: 0.03, slide: open ? 780 : 160 }); },
    receiptOn() { audio.tone({ freq: 1047, type: 'sine', dur: 0.1, vol: 0.08 }); audio.tone({ freq: 1319, type: 'sine', dur: 0.14, vol: 0.08, at: 0.1 }); },
    receiptGot() { [1047, 1319, 1568, 2093].forEach((f, i) => audio.tone({ freq: f, type: 'triangle', dur: 0.1, vol: 0.07, at: i * 0.05 })); },
    repeaterOn() { audio.tone({ freq: 440, type: 'triangle', dur: 0.3, vol: 0.06, slide: 880 }); },
    repeaterGot() { audio.sfx('levelup', { pitch: 1.1 }); },
    turn() { if (ok('turn', 0.07)) audio.tone({ freq: 2400, type: 'square', dur: 0.012, vol: 0.018 }); },
    go() { audio.tone({ freq: 660, type: 'square', dur: 0.07, vol: 0.06 }); audio.tone({ freq: 990, type: 'square', dur: 0.12, vol: 0.06, at: 0.08 }); },
    ready() { audio.tone({ freq: 440, type: 'triangle', dur: 0.12, vol: 0.06 }); },
    flash() { [0, 0.12, 0.24].forEach((t) => audio.tone({ freq: 880, type: 'square', dur: 0.04, vol: 0.035, at: t })); },
    decrypt() { audio.tone({ freq: 660, type: 'triangle', dur: 0.2, vol: 0.05, slide: 330 }); },
    release() { if (ok('release', 0.2)) audio.tone({ freq: 300, type: 'triangle', dur: 0.1, vol: 0.05, slide: 520 }); },
    clear() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => audio.tone({ freq: f, type: 'square', dur: 0.1, vol: 0.06, at: i * 0.06 }));
      audio.chord([1047, 1319, 1568], { dur: 0.5, type: 'triangle', vol: 0.06, at: 0.32 });
    },
    tally(i) { audio.tone({ freq: 880 + i * 120, type: 'square', dur: 0.05, vol: 0.05 }); },
    lost() {
      [880, 740, 622, 523, 392].forEach((f, i) => audio.tone({ freq: f, type: 'square', dur: 0.12, vol: 0.05, at: i * 0.1, slide: f * 0.97 }));
      audio.noise({ dur: 0.9, vol: 0.12, filter: 3000, type: 'bandpass', q: 0.5, at: 0.5, slideFilter: 400 });
    },
    select() { audio.sfx('select'); },
  };
}

// the bassline: E minor, two bars, a kick on one and three-and; while encrypted, a quicker arpeggio on top and hats on
// every step. Original, made of notes (no files)
const _ = null;
export function createMusic(n = 0, encrypted = false) {
  const bpm = Math.min(150, 108 + n * 5) + (encrypted ? 10 : 0);
  const bass = [40, _, 52, _, 40, _, 50, 52, 43, _, 55, _, 45, _, 47, _, 40, _, 52, _, 40, _, 50, 52, 38, _, 50, _, 43, _, 42, _];
  const lead = encrypted
    ? [76, 79, 83, 79, 76, 79, 83, 86, 74, 79, 83, 79, 74, 78, 81, 78, 76, 79, 83, 79, 76, 79, 83, 86, 74, 78, 81, 86, 79, 78, 74, 71]
    : [_, _, _, _, 71, _, _, 74, _, _, 76, _, _, 74, _, _, _, _, _, _, 71, _, _, 74, _, _, 79, _, 78, _, 76, _];
  return createLoopMusic({
    bpm, steps: 16, bars: 2,
    tracks: [
      { type: 'square', vol: 0.05, dur: 1.1, filter: 900, notes: bass },
      { type: 'triangle', vol: encrypted ? 0.022 : 0.03, dur: encrypted ? 0.9 : 1.6, notes: lead },
    ],
    drums: {
      kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat: encrypted ? [1, 1, 1, 1] : [0, 0, 1, 0],
    },
  });
}
