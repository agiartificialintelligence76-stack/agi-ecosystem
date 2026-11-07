// GRADIENT DESCENT's sounds (2026-11-08): all made in the browser with the kit's audio (no files). A woody "tock" for
// the putt (higher for a soft one), a low rolling hum that follows the ball's speed, rubbery bonks off the rails and the
// posts, a metal "clink" for a lip-out, a plunk and a bright chord for the drop, a bit-crushed glitch for a NaN pit.
// A demo is silent (the kit's buses are muted there, and the hum is never built).
import { createLoopMusic } from '../kit/audio.js';
import { DEMO } from '../kit/env.js';

const NOTE = (semi) => 523.25 * 2 ** (semi / 12);   // C5

export function createSound(audio) {
  let hum = null;
  function ensureHum() {
    if (hum || DEMO || !audio.running) return hum;
    const ctx = audio.ctx;
    if (!ctx) return null;
    try {
      const len = Math.floor(ctx.sampleRate * 2);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let b = 0;
      for (let i = 0; i < len; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.5; }   // brown-ish rumble
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 220; bp.Q.value = 0.8;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(bp); bp.connect(g); g.connect(audio.sfxBus());
      src.start();
      hum = { g, bp, ctx, level: 0 };
    } catch { hum = null; }
    return hum;
  }
  return {
    putt(power) {
      const p = Math.max(0.05, Math.min(1, power));
      audio.noise({ dur: 0.03, vol: 0.32, filter: 2600 + p * 2200, type: 'bandpass', q: 1.4 });
      audio.tone({ freq: 760 - p * 280, type: 'triangle', dur: 0.07, vol: 0.24, slide: 420 - p * 140, attack: 0.001 });
      audio.tone({ freq: 140 + p * 30, type: 'sine', dur: 0.09, vol: 0.18 + p * 0.12, slide: 70, attack: 0.001 });
    },
    // the ball's speed (units/s) each frame: the hum follows it
    roll(speed, onSticky = false) {
      const h = ensureHum();
      if (!h) return;
      const target = Math.min(0.2, speed * 0.028) * (onSticky ? 0.5 : 1);
      if (Math.abs(target - h.level) < 0.004) return;
      h.level = target;
      const t = h.ctx.currentTime;
      h.g.gain.setTargetAtTime(target, t, 0.06);
      h.bp.frequency.setTargetAtTime(160 + speed * 38, t, 0.08);
    },
    bounce(v, post = false) {
      const k = Math.min(1, v / 8);
      if (k < 0.04) return;
      if (post) {
        audio.tone({ freq: 300 + k * 260, type: 'sine', dur: 0.14, vol: 0.12 + k * 0.2, slide: 180, attack: 0.001 });
        audio.tone({ freq: 900 + k * 300, type: 'triangle', dur: 0.05, vol: 0.06 + k * 0.06, attack: 0.001 });
      } else {
        audio.noise({ dur: 0.04, vol: 0.1 + k * 0.22, filter: 900 + k * 1200, type: 'bandpass', q: 1 });
        audio.tone({ freq: 160 + k * 90, type: 'sine', dur: 0.08, vol: 0.1 + k * 0.18, slide: 90, attack: 0.001 });
      }
    },
    lip() {
      audio.tone({ freq: 1760, type: 'sine', dur: 0.1, vol: 0.12, attack: 0.001 });
      audio.tone({ freq: 2349, type: 'sine', dur: 0.16, vol: 0.08, at: 0.03, attack: 0.001 });
      audio.tone({ freq: 3136, type: 'triangle', dur: 0.06, vol: 0.04, at: 0.05, attack: 0.001 });
    },
    // the drop: a plunk, then a chord (brighter for a better score: 0 par … 3 an ace)
    sink(tier = 0) {
      audio.tone({ freq: 220, type: 'sine', dur: 0.16, vol: 0.3, slide: 110, attack: 0.001 });
      audio.noise({ dur: 0.06, vol: 0.14, filter: 700, type: 'lowpass', at: 0.02 });
      const chord = [[0, 4, 7], [0, 4, 7, 11], [0, 4, 7, 12, 16], [0, 4, 7, 11, 14, 19]][Math.max(0, Math.min(3, tier))];
      chord.forEach((s, i) => audio.tone({ freq: NOTE(s), type: 'triangle', dur: 0.5 + i * 0.05, vol: 0.09, at: 0.12 + i * 0.055, release: 0.35 }));
      if (tier >= 2) [12, 16, 19, 24].forEach((s, i) => audio.tone({ freq: NOTE(s), type: 'square', dur: 0.08, vol: 0.035, at: 0.45 + i * 0.06 }));
    },
    pit() {
      for (let i = 0; i < 7; i++) audio.tone({ freq: 200 + ((i * 7919) % 11) * 140, type: 'square', dur: 0.04, vol: 0.07, at: i * 0.035, attack: 0.001 });
      audio.noise({ dur: 0.35, vol: 0.18, filter: 3200, type: 'bandpass', q: 3, slideFilter: 200 });
      audio.tone({ freq: 440, type: 'sawtooth', dur: 0.45, vol: 0.08, slide: 55, filter: 1800 });
    },
    respawn() { audio.tone({ freq: NOTE(7), type: 'triangle', dur: 0.08, vol: 0.08 }); audio.tone({ freq: NOTE(12), type: 'triangle', dur: 0.1, vol: 0.08, at: 0.06 }); },
    localMin() { audio.tone({ freq: NOTE(-5), type: 'triangle', dur: 0.18, vol: 0.08 }); audio.tone({ freq: NOTE(-8), type: 'triangle', dur: 0.24, vol: 0.08, at: 0.12 }); },
    hole() {
      audio.noise({ dur: 0.5, vol: 0.06, filter: 400, type: 'bandpass', q: 0.7, slideFilter: 3600 });
      [0, 7, 12].forEach((s, i) => audio.tone({ freq: NOTE(s - 12), type: 'triangle', dur: 0.4, vol: 0.06, at: 0.08 + i * 0.07, release: 0.3 }));
    },
    tick() { audio.tone({ freq: 1400, type: 'square', dur: 0.015, vol: 0.025 }); },
    stop() { if (hum) { try { hum.g.gain.setTargetAtTime(0, hum.ctx.currentTime, 0.04); hum.level = 0; } catch { /* closed */ } } },
  };
}

// A slow, warm loop under the course: soft pads and a lazy bass in F, a little shuffle on the hats
export function courseMusic() {
  const chords = [[53, 57, 60, 64], [50, 53, 57, 60], [46, 50, 53, 57], [48, 52, 55, 58]];
  const arp = [], bass = [], pad = [];
  for (const ch of chords) {
    for (let i = 0; i < 16; i++) {
      arp.push(i % 4 === 2 ? ch[(i >> 2) % 4] + 12 : null);
      bass.push(i === 0 ? ch[0] - 12 : i === 10 ? ch[0] - 5 : null);
      pad.push(i === 0 ? ch[2] : null);
    }
  }
  return createLoopMusic({
    bpm: 78, steps: 16, bars: 4,
    tracks: [
      { type: 'sine', vol: 0.03, notes: arp, dur: 3, attack: 0.02 },
      { type: 'triangle', vol: 0.05, notes: bass, dur: 6, filter: 500, attack: 0.03 },
      { type: 'triangle', vol: 0.02, notes: pad, dur: 15, filter: 1200, attack: 0.3 },
    ],
    drums: { hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1] },
  });
}
