// AIR GAP: its sounds, made in the browser (the kit's synth): a "thock" on each hit (higher the harder), a rail's
// "clack", the air table's hiss under a fast puck, the goal horns, the power-ups, and a quiet midnight groove while you
// play. Silent in a demo (the kit's audio is), and nothing here is touched before the first tap.
import { createLoopMusic } from '../kit/audio.js';
import { clamp } from '../kit/fx.js';

export function createSound(audio) {
  let hiss = null;
  const on = () => audio.running;
  function ensureHiss() {
    if (hiss || !on()) return hiss;
    try {
      const ctx = audio.ctx;
      const n = Math.floor(ctx.sampleRate * 0.8);
      const buf = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.55;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(audio.sfxBus());
      src.start();
      hiss = { src, f, g, ctx };
    } catch { hiss = null; }
    return hiss;
  }
  return {
    hit(speed, smash = false) {
      if (!on()) return;
      const k = clamp(speed / 2600, 0, 1);
      audio.tone({ freq: 140 + 240 * k, type: 'sine', dur: 0.07 + 0.04 * k, vol: 0.2 + 0.26 * k, slide: 62 + 50 * k, attack: 0.002 });
      audio.noise({ dur: 0.03, vol: 0.1 + 0.18 * k, filter: 1600 + 2600 * k, type: 'bandpass', q: 1.3 });
      if (smash) { audio.noise({ dur: 0.16, vol: 0.2, filter: 700, type: 'lowpass', slideFilter: 160 }); audio.tone({ freq: 95, type: 'sine', dur: 0.16, vol: 0.28, slide: 45 }); }
    },
    rail(speed) {
      if (!on()) return;
      const k = clamp(speed / 2600, 0, 1);
      audio.noise({ dur: 0.02, vol: 0.05 + 0.16 * k, filter: 3000 + 1800 * k, type: 'bandpass', q: 2.4 });
      audio.tone({ freq: 700 + 340 * k, type: 'triangle', dur: 0.03, vol: 0.025 + 0.05 * k });
    },
    post(speed) {
      if (!on()) return;
      const k = clamp(speed / 2600, 0.3, 1);
      audio.tone({ freq: 1480, type: 'triangle', dur: 0.24, vol: 0.1 * k, slide: 1420 });
      audio.tone({ freq: 2210, type: 'sine', dur: 0.18, vol: 0.05 * k });
      audio.noise({ dur: 0.02, vol: 0.12 * k, filter: 5000, type: 'highpass' });
    },
    clink(speed) {
      if (!on()) return;
      const k = clamp(speed / 2600, 0, 1);
      audio.tone({ freq: 1100 + 500 * k, type: 'triangle', dur: 0.04, vol: 0.05 + 0.08 * k });
      audio.noise({ dur: 0.015, vol: 0.08 + 0.1 * k, filter: 4200, type: 'highpass' });
    },
    block() { if (!on()) return; audio.tone({ freq: 220, type: 'square', dur: 0.1, vol: 0.08, slide: 440, filter: 2200 }); audio.noise({ dur: 0.06, vol: 0.12, filter: 2600, type: 'bandpass', q: 2 }); },
    goal(yours) {
      if (!on()) return;
      if (yours) {
        audio.noise({ dur: 0.35, vol: 0.18, filter: 900, type: 'lowpass', slideFilter: 3200 });
        [523, 659, 784, 1047].forEach((f, i) => audio.tone({ freq: f, type: 'square', dur: 0.14, vol: 0.07, at: 0.04 + i * 0.07, filter: 3000 }));
        audio.chord([523, 659, 784], { type: 'sawtooth', dur: 0.5, vol: 0.05, at: 0.32, filter: 2000 });
      } else {
        audio.noise({ dur: 0.3, vol: 0.16, filter: 600, type: 'lowpass' });
        [784, 659, 523].forEach((f, i) => audio.tone({ freq: f, type: 'triangle', dur: 0.16, vol: 0.1, at: 0.05 + i * 0.09 }));
        audio.tone({ freq: 392, type: 'triangle', dur: 0.35, vol: 0.1, at: 0.32, slide: 370 });
      }
    },
    serve() { if (on()) audio.tone({ freq: 420, type: 'sine', dur: 0.09, vol: 0.18, slide: 900, attack: 0.002 }); },
    live() { if (on()) audio.tone({ freq: 1320, type: 'square', dur: 0.03, vol: 0.04 }); },
    chipIn() { if (!on()) return; audio.noise({ dur: 0.3, vol: 0.12, filter: 500, type: 'bandpass', q: 0.8, slideFilter: 3600 }); audio.tone({ freq: 1568, type: 'triangle', dur: 0.12, vol: 0.06, at: 0.25 }); },
    powerup(kind, mine) {
      if (!on()) return;
      const p = mine ? 1 : 0.8;
      if (kind === 'split') [0, 0.06, 0.12].forEach((t, i) => audio.tone({ freq: [660, 880, 1175][i] * p, type: 'square', dur: 0.08, vol: 0.08, at: t }));
      else if (kind === 'lag') [0, 0.05, 0.1, 0.15].forEach((t, i) => audio.tone({ freq: (i % 2 ? 300 : 560) * p, type: 'square', dur: 0.04, vol: 0.07, at: t }));
      else if (kind === 'firewall') { audio.tone({ freq: 180 * p, type: 'sawtooth', dur: 0.32, vol: 0.1, slide: 520 * p, filter: 1800 }); audio.noise({ dur: 0.3, vol: 0.08, filter: 1200, type: 'bandpass' }); }
      else if (kind === 'big') audio.tone({ freq: 220 * p, type: 'triangle', dur: 0.3, vol: 0.18, slide: 660 * p });
      else if (kind === 'patch') { audio.tone({ freq: 880 * p, type: 'square', dur: 0.04, vol: 0.07 }); audio.tone({ freq: 660 * p, type: 'square', dur: 0.06, vol: 0.07, at: 0.07 }); audio.noise({ dur: 0.04, vol: 0.12, filter: 3000, type: 'highpass', at: 0.07 }); }
      audio.tone({ freq: 1047 * p, type: 'triangle', dur: 0.18, vol: 0.06, at: 0.16 });
    },
    powerEnd() { if (on()) audio.tone({ freq: 660, type: 'triangle', dur: 0.12, vol: 0.06, slide: 330 }); },
    merge() { if (on()) audio.tone({ freq: 900, type: 'sine', dur: 0.1, vol: 0.06, slide: 1600 }); },
    matchPoint() { if (!on()) return; [0, 0.16, 0.32].forEach((t) => { audio.tone({ freq: 988, type: 'square', dur: 0.08, vol: 0.06, at: t }); audio.tone({ freq: 740, type: 'square', dur: 0.08, vol: 0.06, at: t + 0.08 }); }); },
    tick() { if (on()) audio.tone({ freq: 1200, type: 'square', dur: 0.03, vol: 0.06 }); },
    stall() { if (on()) audio.tone({ freq: 160, type: 'sawtooth', dur: 0.35, vol: 0.1, filter: 900 }); },
    win() { if (on()) [523, 659, 784, 1047, 1319].forEach((f, i) => audio.tone({ freq: f, type: 'square', dur: 0.14, vol: 0.08, at: i * 0.08, filter: 3200 })); },
    lose() { if (on()) [523, 494, 440, 392].forEach((f, i) => audio.tone({ freq: f, type: 'triangle', dur: 0.24, vol: 0.12, at: i * 0.13 })); },
    // the air table under a fast puck (0..1), and a faint blower while a point is on
    air(level, playing) {
      if (!on()) { if (hiss) hiss.g.gain.value = 0; return; }
      const h = ensureHiss();
      if (!h) return;
      const t = h.ctx.currentTime;
      const v = playing ? 0.006 + clamp(level, 0, 1) ** 1.6 * 0.055 : 0;
      h.g.gain.setTargetAtTime(v, t, 0.06);
      h.f.frequency.setTargetAtTime(1200 + clamp(level, 0, 1) * 2600, t, 0.08);
    },
    mute() { if (hiss) hiss.g.gain.value = 0; },
  };
}

// a quiet midnight groove (A minor: Am, F, C, G), the arcade's music setting
export function matchMusic() {
  const bar = (root) => [root, null, null, root, null, null, root + 12, null, root, null, null, root, null, null, root + 7, null];
  const arp = (a, b, c) => [a, null, b, null, c, null, b, null, a + 12, null, c, null, b, null, c, null];
  return createLoopMusic({
    bpm: 102, steps: 16, bars: 4,
    tracks: [
      { type: 'triangle', vol: 0.09, notes: [...bar(45), ...bar(41), ...bar(48), ...bar(43)], dur: 1.6, octave: -1 },
      { type: 'square', vol: 0.022, notes: [...arp(69, 72, 76), ...arp(65, 69, 72), ...arp(67, 72, 76), ...arp(67, 71, 74)], dur: 1, filter: 1700 },
    ],
    drums: {
      kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
    },
  });
}
