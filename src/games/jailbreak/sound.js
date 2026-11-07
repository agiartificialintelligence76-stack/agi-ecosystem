// JAILBREAK: its sounds, made in the browser with the arcade kit's synth (no files). Bricks climb a pentatonic scale
// as the combo grows (a run of breaks plays a little melody), steel clanks, glass tinkles, explosives boom, THE
// WARDEN grunts. A small looping soundtrack for each world. A demo stays silent (the kit's audio does that); a burst of
// breaks in one frame plays only a few sounds (no wall of noise).
import { createLoopMusic } from '../kit/audio.js';

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];   // major pentatonic, semitones
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

export function createSound(audio) {
  let budget = 0, frameBudget = 4;
  const ok = (cost = 1) => { if (budget >= frameBudget) return false; budget += cost; return true; };
  const s = {
    frame() { budget = 0; },
    brick(combo, kind) {
      if (!ok()) return;
      const n = SCALE[Math.min(SCALE.length - 1, Math.max(0, combo - 1))];
      const f = midi(72 + n);
      audio.tone({ freq: f, type: 'square', dur: 0.07, vol: 0.07, filter: 3600 });
      audio.tone({ freq: f * 2, type: 'triangle', dur: 0.1, vol: 0.06 });
      if (kind === 'tough') audio.noise({ dur: 0.06, vol: 0.12, filter: 1400, type: 'lowpass' });
      else audio.noise({ dur: 0.035, vol: 0.08, filter: 5200, type: 'highpass' });
    },
    crack() { if (ok()) { audio.tone({ freq: 240, type: 'square', dur: 0.05, vol: 0.08, slide: 160, filter: 1600 }); audio.noise({ dur: 0.05, vol: 0.1, filter: 1200, type: 'bandpass' }); } },
    clank() { if (ok()) { audio.tone({ freq: 1180, type: 'square', dur: 0.05, vol: 0.05, filter: 5000 }); audio.tone({ freq: 1760, type: 'sine', dur: 0.12, vol: 0.05 }); audio.noise({ dur: 0.04, vol: 0.08, filter: 3200, type: 'bandpass', q: 3 }); } },
    glass() { if (ok()) { audio.noise({ dur: 0.18, vol: 0.13, filter: 6500, type: 'highpass' }); [2093, 2637, 3136].forEach((f, i) => audio.tone({ freq: f * (1 + Math.random() * 0.03), type: 'sine', dur: 0.12, vol: 0.035, at: i * 0.025 })); } },
    explode() { if (ok(2)) audio.sfx('explode', { pitch: 1.1 }); },
    paddle(off) { if (ok()) { audio.tone({ freq: 300 + off * 60, type: 'triangle', dur: 0.08, vol: 0.2, slide: 520 + off * 80 }); audio.noise({ dur: 0.03, vol: 0.06, filter: 2400, type: 'bandpass' }); } },
    wall() { if (ok(0.5)) audio.tone({ freq: 520, type: 'sine', dur: 0.04, vol: 0.06 }); },
    launch() { audio.sfx('whoosh', { pitch: 1.4 }); audio.tone({ freq: 440, type: 'triangle', dur: 0.12, vol: 0.12, slide: 880 }); },
    stick() { audio.tone({ freq: 200, type: 'sine', dur: 0.12, vol: 0.18, slide: 120 }); },
    pickup(good) { if (good) { audio.sfx('power', { pitch: 1.3 }); audio.sfx('coin'); } else audio.sfx('error'); },
    laser() { if (ok(0.5)) audio.tone({ freq: 1400, type: 'square', dur: 0.07, vol: 0.04, slide: 500, filter: 4000 }); },
    portal() { audio.tone({ freq: 300, type: 'sine', dur: 0.2, vol: 0.12, slide: 1200 }); audio.tone({ freq: 600, type: 'triangle', dur: 0.2, vol: 0.06, slide: 2400, at: 0.04 }); },
    gates() { audio.sfx('levelup', { pitch: 0.8 }); audio.noise({ dur: 0.4, vol: 0.12, filter: 2000, type: 'bandpass', slideFilter: 6000 }); },
    combo(n) { audio.chord([523, 659, 784].map((f) => f * (1 + Math.min(4, n / 5 - 1) * 0.06)), { dur: 0.16, type: 'square', vol: 0.05, strum: 0.04 }); },
    lost() { audio.sfx('hurt'); audio.tone({ freq: 392, type: 'triangle', dur: 0.45, vol: 0.14, slide: 98 }); },
    over() { audio.sfx('lose'); },
    shatter() { audio.noise({ dur: 0.7, vol: 0.3, filter: 4200, type: 'highpass', slideFilter: 9000 }); [1568, 2093, 2637, 3136, 3951].forEach((f, i) => audio.tone({ freq: f, type: 'sine', dur: 0.25, vol: 0.04, at: 0.04 + i * 0.05 })); },
    clear() { audio.sfx('levelup'); audio.chord([523, 659, 784, 1047], { dur: 0.5, type: 'triangle', vol: 0.08, at: 0.32, strum: 0.03 }); },
    bossHit(crit) { audio.sfx('hit', { pitch: crit ? 0.8 : 1.1 }); audio.tone({ freq: crit ? 110 : 160, type: 'square', dur: crit ? 0.24 : 0.12, vol: 0.12, slide: crit ? 55 : 90, filter: 900 }); if (crit) audio.sfx('explode', { pitch: 1.6 }); },
    bossAngry() { audio.tone({ freq: 90, type: 'sawtooth', dur: 0.5, vol: 0.14, slide: 60, filter: 700 }); audio.tone({ freq: 95, type: 'sawtooth', dur: 0.5, vol: 0.1, slide: 62, filter: 700, at: 0.02 }); },
    bossDown() { audio.sfx('explode', { pitch: 0.7 }); audio.sfx('win', { pitch: 1 }); },
    boom() { if (ok()) audio.noise({ dur: 0.25, vol: 0.22, filter: 700, type: 'lowpass', slideFilter: 120 }); },
    eye() { audio.tone({ freq: 880, type: 'square', dur: 0.06, vol: 0.05 }); audio.tone({ freq: 1320, type: 'square', dur: 0.08, vol: 0.05, at: 0.08 }); },
    bombDrop() { if (ok(0.5)) audio.tone({ freq: 700, type: 'sine', dur: 0.18, vol: 0.06, slide: 300 }); },
    bombPop() { if (ok()) { audio.sfx('pop', { pitch: 1.2 }); } },
    zap() { audio.tone({ freq: 140, type: 'sawtooth', dur: 0.3, vol: 0.14, filter: 1800 }); audio.noise({ dur: 0.25, vol: 0.14, filter: 3000, type: 'bandpass', q: 2 }); },
    start() { audio.sfx('select'); },
    tap() { audio.sfx('tap'); },
  };
  return s;
}

// each world's little loop: a bass line, an arpeggio and drums, two bars
const TUNES = [
  { bpm: 112, root: 57, prog: [0, -4, 3, -2], arp: [0, 7, 12, 7, 15, 12, 7, 3], hat: 2 },        // SANDBOX: soft
  { bpm: 124, root: 52, prog: [0, 0, -2, -4], arp: [0, 12, 7, 12, 10, 12, 7, 5], hat: 1 },       // FIREWALL: driving
  { bpm: 118, root: 60, prog: [0, 5, -3, 2], arp: [0, 4, 7, 11, 12, 11, 7, 4], hat: 2 },         // CAPTCHA FARM: bright
  { bpm: 128, root: 50, prog: [0, 0, 3, -2], arp: [0, 3, 7, 10, 12, 10, 7, 3], hat: 1 },         // ROOT ACCESS: tense
  { bpm: 116, root: 62, prog: [0, -5, -3, -7], arp: [0, 4, 7, 12, 16, 12, 7, 4], hat: 2 },       // THE CLOUD: airy
  { bpm: 132, root: 49, prog: [0, 3, 5, 3], arp: [0, 7, 12, 15, 19, 15, 12, 7], hat: 1 },        // MAINFRAME: big
];

export function worldMusic(n) {
  const T = TUNES[Math.max(0, Math.min(TUNES.length - 1, n - 1))];
  const bass = [], arp = [], kick = [], snare = [], hat = [];
  for (let bar = 0; bar < 4; bar++) {
    const r = T.root + T.prog[bar];
    for (let i = 0; i < 16; i++) {
      bass.push(i % 4 === 0 ? r - 12 : i % 4 === 2 && i !== 2 ? r - 5 : null);
      arp.push(i % 2 === 0 ? r + 12 + T.arp[(i / 2 + bar) % T.arp.length] : null);
      kick.push(i % 8 === 0 || i === 11 ? 1 : 0);
      snare.push(i % 8 === 4 ? 1 : 0);
      hat.push(i % T.hat === 0 ? 1 : 0);
    }
  }
  return createLoopMusic({
    bpm: T.bpm, steps: 16, bars: 4,
    tracks: [
      { type: 'triangle', vol: 0.11, notes: bass, dur: 1.8 },
      { type: 'square', vol: 0.022, notes: arp, dur: 0.9, filter: 2600 },
    ],
    drums: { kick, snare, hat },
  });
}
