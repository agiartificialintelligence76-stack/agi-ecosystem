// STACKED's sounds (2026-11-08): all synthesized with the kit's audio (no files). Every drop is a crisp click and a
// short tone; perfects climb a pentatonic scale with the streak (the higher the streak, the brighter it rings).

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];
const BASE = 392;                                  // G4
const note = (semi) => BASE * 2 ** (semi / 12);

export function createSound(audio) {
  const click = (vol = 0.22, f = 5200) => audio.noise({ dur: 0.018, vol, filter: f, type: 'highpass' });
  return {
    // a floor lands: perfect (its streak), a cut, and the extras (a close one, a grow)
    drop({ kind, streak = 0, close = false, grew = 0 }) {
      click();
      if (kind === 'perfect') {
        const i = Math.min(streak - 1, PENTA.length - 1);
        const f = note(PENTA[Math.max(0, i)]);
        audio.tone({ freq: f, type: 'triangle', dur: 0.26, vol: 0.2, attack: 0.002 });
        audio.tone({ freq: f * 2, type: 'sine', dur: 0.2, vol: 0.08, attack: 0.002, at: 0.012 });
        audio.tone({ freq: 150, type: 'sine', dur: 0.09, vol: 0.18, slide: 70, attack: 0.001 });
        if (streak >= PENTA.length) audio.tone({ freq: f * 3, type: 'sine', dur: 0.16, vol: 0.05, at: 0.05 });
        if (grew > 0) audio.tone({ freq: f, type: 'sine', dur: 0.18, vol: 0.07, slide: f * 1.5, at: 0.06 });
      } else {
        audio.noise({ dur: 0.1, vol: 0.18, filter: 4200, type: 'highpass' });
        audio.tone({ freq: 175, type: 'sine', dur: 0.12, vol: 0.24, slide: 85, attack: 0.001 });
        audio.tone({ freq: note(-5) * (0.97 + 0.06 * ((streak * 7919) % 13) / 13), type: 'triangle', dur: 0.12, vol: 0.07, at: 0.01 });
        if (close) { audio.tone({ freq: note(7), type: 'sine', dur: 0.09, vol: 0.06, at: 0.08 }); audio.tone({ freq: note(12), type: 'sine', dur: 0.14, vol: 0.06, at: 0.15 }); }
      }
    },
    // ten in a row: a little run up
    milestone() {
      [0, 4, 7, 12, 16].forEach((s, i) => audio.tone({ freq: note(12 + s), type: 'square', dur: 0.09, vol: 0.05, at: 0.06 + i * 0.05 }));
    },
    // the floor misses: a whoosh as it goes, a soft thud far below
    miss() {
      click(0.18, 3000);
      audio.noise({ dur: 0.5, vol: 0.2, filter: 2400, type: 'bandpass', q: 0.9, slideFilter: 300 });
      audio.tone({ freq: 330, type: 'triangle', dur: 0.5, vol: 0.1, slide: 110 });
      audio.tone({ freq: 90, type: 'sine', dur: 0.4, vol: 0.32, slide: 38, at: 0.42, attack: 0.002 });
      audio.noise({ dur: 0.25, vol: 0.14, filter: 500, type: 'lowpass', at: 0.42 });
    },
    // a new zone: an airy chord
    zone(i) {
      const roots = [0, 2, 5, 7, 9];
      const r = roots[i % roots.length];
      audio.noise({ dur: 0.7, vol: 0.08, filter: 500, type: 'bandpass', q: 0.7, slideFilter: 4200 });
      [0, 4, 7, 11, 14].forEach((s, k) => audio.tone({ freq: note(r + s), type: 'triangle', dur: 0.9, vol: 0.06, at: 0.05 + k * 0.07, release: 0.6 }));
    },
    thunder() {
      audio.noise({ dur: 1.4, vol: 0.2, filter: 380, type: 'lowpass', slideFilter: 70 });
      audio.noise({ dur: 0.25, vol: 0.12, filter: 1400, type: 'lowpass', at: 0.05 });
    },
    start() {
      audio.tone({ freq: note(0), type: 'triangle', dur: 0.1, vol: 0.1 });
      audio.tone({ freq: note(7), type: 'triangle', dur: 0.14, vol: 0.1, at: 0.07 });
    },
  };
}
