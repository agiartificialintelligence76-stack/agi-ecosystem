// GUARDRAILS: its sounds, made in the browser (the kit's synth): each guardrail its own shot, a squeaky pop for a
// stopped gremlin, a horn when a wave starts, a fanfare when it's held. A busy wave plays only so many at once.
import { createLoopMusic } from '../kit/audio.js';

export function createSound(audio) {
  const last = new Map();
  // at most one of a kind every `gap` seconds (a swarm of pops stays a sound, not a noise)
  const ok = (key, gap) => {
    const now = performance.now() / 1000;
    if (now - (last.get(key) || 0) < gap) return false;
    last.set(key, now);
    return true;
  };
  const rnd = (a, b) => a + Math.random() * (b - a);
  return {
    filter() { if (ok('filter', 0.06)) audio.tone({ freq: rnd(1300, 1500), type: 'square', dur: 0.035, vol: 0.035, slide: 900 }); },
    lob() { if (ok('lob', 0.08)) audio.tone({ freq: 240, type: 'triangle', dur: 0.12, vol: 0.12, slide: 420 }); },
    splat() { if (ok('splat', 0.07)) { audio.noise({ dur: 0.14, vol: 0.16, filter: rnd(700, 1000), type: 'lowpass', slideFilter: 200 }); audio.tone({ freq: 140, type: 'sine', dur: 0.1, vol: 0.12, slide: 60 }); } },
    pulse() { if (ok('pulse', 0.1)) { audio.tone({ freq: 180, type: 'sine', dur: 0.3, vol: 0.18, slide: 90 }); audio.tone({ freq: 720, type: 'triangle', dur: 0.12, vol: 0.05, slide: 360 }); } },
    beam(big) {
      audio.tone({ freq: big ? 220 : 330, type: 'sawtooth', dur: big ? 0.4 : 0.22, vol: 0.09, slide: big ? 1200 : 1500, filter: 3000 });
      audio.noise({ dur: big ? 0.3 : 0.16, vol: 0.12, filter: 4000, type: 'highpass' });
    },
    pop(big) {
      if (big) { audio.sfx('explode', { pitch: 1.1 }); return; }
      if (ok('pop', 0.035)) audio.sfx('pop', { pitch: rnd(0.9, 1.35) });
    },
    block() { if (ok('block', 0.12)) audio.tone({ freq: 1900, type: 'square', dur: 0.03, vol: 0.04 }); },
    shieldDown() { audio.tone({ freq: 900, type: 'square', dur: 0.06, vol: 0.06, slide: 300 }); audio.noise({ dur: 0.12, vol: 0.1, filter: 3000, type: 'highpass' }); },
    reveal() { if (ok('reveal', 0.15)) audio.chord([880, 1320], { dur: 0.1, type: 'triangle', vol: 0.06, strum: 0.04 }); },
    heal() { if (ok('heal', 0.4)) audio.chord([523, 784], { dur: 0.18, type: 'sine', vol: 0.05, strum: 0.06 }); },
    blink() { audio.tone({ freq: 600, type: 'sine', dur: 0.2, vol: 0.1, slide: 1600 }); },
    argue() { if (ok('argue', 0.25)) audio.tone({ freq: rnd(500, 700), type: 'square', dur: 0.05, vol: 0.03, slide: rnd(300, 900) }); },
    honeyBreak() { audio.sfx('hit', { pitch: 1.3 }); },
    leak() { audio.sfx('hurt'); },
    build() { audio.sfx('drop', { pitch: 1.2 }); audio.tone({ freq: 660, type: 'triangle', dur: 0.08, vol: 0.1, at: 0.06 }); },
    upgrade() { audio.sfx('levelup', { pitch: 1 }); },
    sell() { audio.sfx('coin', { pitch: 0.9 }); },
    nope() { audio.sfx('error'); },
    select() { audio.sfx('tap', { pitch: 1.1 }); },
    // a wave's horn: two brassy notes
    horn(boss) {
      const f = boss ? 110 : 147;
      audio.tone({ freq: f, type: 'sawtooth', dur: 0.32, vol: 0.12, filter: 900 });
      audio.tone({ freq: f * 1.5, type: 'sawtooth', dur: 0.5, vol: 0.12, filter: 1100, at: 0.22 });
      if (boss) audio.tone({ freq: f * 0.5, type: 'sine', dur: 0.9, vol: 0.2, at: 0.22, slide: f * 0.4 });
    },
    fanfare(perfect) {
      [523, 659, 784, 1047].forEach((f, i) => audio.tone({ freq: f, type: 'triangle', dur: 0.16, vol: 0.1, at: i * 0.08 }));
      if (perfect) audio.chord([1047, 1319, 1568], { dur: 0.35, type: 'square', vol: 0.04, at: 0.34 });
    },
    victory() { audio.sfx('win'); setTimeout(() => audio.sfx('levelup'), 450); },
    lose() { audio.sfx('lose'); },
  };
}

// A cozy marching loop while a run is on (the arcade's Music switch turns it off): Am · F · C · G, a plucked eighth-note
// figure over a round bass, a soft kick on the beat and a whisper of hat. Made of notes, no files.
const _ = null;
const bars = (...b) => b.flat();
export function createMusic() {
  return createLoopMusic({
    bpm: 96, steps: 16, bars: 4,
    tracks: [
      { type: 'triangle', vol: 0.03, dur: 1.4, filter: 2400, notes: bars(
        [69, _, 72, _, 76, _, 72, _, 69, _, 72, _, 76, _, 79, _],
        [65, _, 69, _, 72, _, 69, _, 65, _, 69, _, 72, _, 77, _],
        [64, _, 67, _, 72, _, 67, _, 64, _, 67, _, 72, _, 76, _],
        [62, _, 67, _, 71, _, 67, _, 62, _, 67, _, 71, _, 74, _]) },
      { type: 'sine', vol: 0.02, dur: 14, attack: 0.2, notes: bars(
        [57, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _], [53, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
        [55, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _], [55, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _]) },
      { type: 'triangle', vol: 0.07, dur: 3, filter: 800, notes: bars(
        [45, _, _, _, 45, _, _, _, 45, _, _, _, 52, _, _, _], [41, _, _, _, 41, _, _, _, 41, _, _, _, 48, _, _, _],
        [48, _, _, _, 48, _, _, _, 48, _, _, _, 43, _, _, _], [43, _, _, _, 43, _, _, _, 43, _, _, _, 50, _, _, _]) },
    ],
    drums: { kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], hat: [0, 0, 1, 0] },
  });
}
