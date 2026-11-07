// BLOCKCHAIN's sounds (2026-11-08): made in the browser with the kit's synth (no files). A pick-up chirp, a soft tick as
// the landing spot moves, a thud by the piece's size, clears that climb a pentatonic scale as the chain grows, chords for
// big moments. The kit keeps them silent in a demo and when the player turned sound off.
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];
export const chainPitch = (n) => 2 ** (SCALE[Math.min(Math.max(n - 1, 0), SCALE.length - 1)] / 12);

export function createSfx(audio) {
  let lastTick = 0;
  const jitter = (k = 0.03) => 1 + (Math.random() * 2 - 1) * k;
  return {
    pick(n = 3) {
      const p = (1.14 - n * 0.025) * jitter();
      audio.tone({ freq: 480 * p, type: 'triangle', dur: 0.075, vol: 0.12, slide: 760 * p, attack: 0.003 });
    },
    // the landing spot moved (quiet, and never more than every 40 ms)
    hover(row = 0) {
      const now = performance.now();
      if (now - lastTick < 40) return;
      lastTick = now;
      audio.tone({ freq: 1500 + row * 40, type: 'sine', dur: 0.02, vol: 0.028, attack: 0.001 });
    },
    place(n = 3) {
      const p = Math.max(0.7, 1.22 - n * 0.055) * jitter(0.025);
      audio.tone({ freq: 210 * p, type: 'sine', dur: 0.13, vol: 0.34, slide: 82 * p, attack: 0.002 });
      audio.tone({ freq: 1250 * p, type: 'triangle', dur: 0.028, vol: 0.06, attack: 0.001 });
      audio.noise({ dur: 0.05, vol: 0.09, filter: 1600 * p, type: 'lowpass' });
    },
    back() {
      audio.tone({ freq: 520, type: 'triangle', dur: 0.14, vol: 0.09, slide: 300 });
      audio.noise({ dur: 0.16, vol: 0.05, filter: 900, type: 'bandpass', q: 0.8, slideFilter: 400 });
    },
    nope() {
      audio.tone({ freq: 200, type: 'square', dur: 0.07, vol: 0.06, filter: 900 });
      audio.tone({ freq: 180, type: 'square', dur: 0.09, vol: 0.06, filter: 900, at: 0.08 });
    },
    deal() { [0, 0.06, 0.12].forEach((at, i) => audio.tone({ freq: [740, 880, 990][i] * jitter(0.01), type: 'triangle', dur: 0.05, vol: 0.05, at })); },
    clear(lines, chain) {
      const p = chainPitch(chain);
      const root = 523.25 * p;
      const notes = [1, 1.25, 1.5, 2, 2.5, 3].slice(0, Math.min(6, 2 + lines));
      audio.chord(notes.map((k) => root * k), { type: 'triangle', dur: 0.26 + lines * 0.05, vol: 0.085, strum: 0.028 });
      audio.tone({ freq: root * 2, type: 'sine', dur: 0.32, vol: 0.05, at: 0.05, slide: root * 4 });
      audio.noise({ dur: 0.3, vol: 0.07 + lines * 0.02, filter: 2400, type: 'highpass', slideFilter: 9000 });
      if (lines >= 2) audio.tone({ freq: 110 * p, type: 'sine', dur: 0.28, vol: 0.26, slide: 55 * p, attack: 0.002 });
    },
    chainUp(n) {
      const p = chainPitch(n);
      [0, 0.055, 0.11].forEach((at, i) => audio.tone({ freq: [784, 988, 1319][i] * p * 0.5, type: 'square', dur: 0.07, vol: 0.045, at, filter: 3200 }));
    },
    linkLost() { audio.tone({ freq: 660, type: 'triangle', dur: 0.06, vol: 0.05, slide: 440 }); },
    broke() {
      audio.tone({ freq: 330, type: 'sawtooth', dur: 0.2, vol: 0.07, slide: 120, filter: 1100 });
      audio.noise({ dur: 0.12, vol: 0.09, filter: 3200, type: 'highpass' });
      audio.tone({ freq: 1760, type: 'triangle', dur: 0.04, vol: 0.05, at: 0.02 });
    },
    perfect() {
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => audio.tone({ freq: f, type: 'triangle', dur: 0.2, vol: 0.09, at: i * 0.06 }));
      audio.chord([523, 659, 784, 1047], { type: 'sine', dur: 0.9, vol: 0.06, at: 0.38 });
      audio.noise({ dur: 0.7, vol: 0.06, filter: 5000, type: 'highpass', slideFilter: 12000, at: 0.3 });
    },
    best() { [659, 784, 988, 1319].forEach((f, i) => audio.tone({ freq: f, type: 'square', dur: 0.09, vol: 0.05, at: i * 0.07, filter: 3600 })); },
    danger() { audio.tone({ freq: 196, type: 'sine', dur: 0.18, vol: 0.12 }); audio.tone({ freq: 185, type: 'sine', dur: 0.22, vol: 0.1, at: 0.2 }); },
    over() {
      [392, 330, 262, 196].forEach((f, i) => audio.tone({ freq: f, type: 'triangle', dur: 0.24, vol: 0.12, at: 0.1 + i * 0.13 }));
      audio.noise({ dur: 0.5, vol: 0.06, filter: 700, type: 'lowpass', slideFilter: 150 });
    },
  };
}
