// LAST MODEL STANDING: its sounds, made in the browser with the arcade kit's synth (no files). A horde makes hundreds of
// hits a second, so every sound has a gap it waits before playing again; chips picked up one after another climb a
// pentatonic scale (the "keep collecting" chime). Two short loops of its own music: the run, and a boss.
import { createLoopMusic } from '../kit/audio.js';

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];
const semis = (n) => 2 ** (n / 12);

// the run's loop: A minor, i–VI–III–VII, four bars at 128
const ROOTS = [[45, 57, 52], [41, 53, 48], [48, 60, 55], [43, 55, 50]];
const ARPS = [[69, 72, 76, 81], [65, 69, 72, 77], [67, 72, 76, 79], [67, 71, 74, 79]];
function bassBar([r, o, f]) { return [r, null, r, null, o, null, r, null, r, null, r, null, o, null, f, null]; }
function arpBar(ch) { const out = []; for (let i = 0; i < 16; i++) out.push(i % 2 ? null : ch[[0, 1, 2, 3, 2, 1, 2, 3][(i / 2) % 8]]); return out; }
const LEAD = [
  76, null, null, null, 74, null, 72, null, 74, null, null, null, null, null, null, null,
  72, null, null, null, 69, null, 72, null, 77, null, null, null, 76, null, null, null,
  76, null, null, null, 79, null, 76, null, 74, null, null, null, 72, null, 74, null,
  71, null, null, null, 74, null, null, null, 79, null, null, null, null, null, null, null,
];
export const RUN_LOOP = {
  bpm: 128, steps: 16, bars: 4,
  tracks: [
    { type: 'square', vol: 0.05, filter: 900, notes: ROOTS.flatMap(bassBar) },
    { type: 'triangle', vol: 0.035, notes: ARPS.flatMap(arpBar) },
    { type: 'square', vol: 0.022, filter: 2600, dur: 3, notes: LEAD },
  ],
  drums: {
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0],
  },
};
// a boss: D minor with its flat second, quicker, the bass hammering
const BROOTS = [[38, 50, 45], [38, 50, 44], [39, 51, 46], [37, 49, 44]];
const BARPS = [[62, 65, 69, 74], [62, 65, 68, 74], [63, 67, 70, 75], [61, 65, 68, 73]];
export const BOSS_LOOP = {
  bpm: 142, steps: 16, bars: 4,
  tracks: [
    { type: 'sawtooth', vol: 0.04, filter: 700, notes: BROOTS.flatMap(([r, o]) => [r, r, null, r, o, null, r, r, null, r, o, null, r, null, o, null]) },
    { type: 'square', vol: 0.028, filter: 2200, notes: BARPS.flatMap((c) => Array.from({ length: 16 }, (_, i) => c[i % 4] + (i >= 8 ? 12 : 0))) },
  ],
  drums: {
    kick: [1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1],
  },
};

export function createSound(audio) {
  const last = new Map();
  let chain = 0, chainAt = 0, music = null, which = '', pops = 0;
  const now = () => performance.now();
  const can = (name, gap) => {
    const t = now();
    if (t - (last.get(name) || -1e9) < gap) return false;
    last.set(name, t);
    return true;
  };
  return {
    shoot() { if (can('shoot', 85)) audio.tone({ freq: 1250, type: 'square', dur: 0.03, vol: 0.03, slide: 820 }); },
    zap() { if (can('zap', 120)) audio.noise({ dur: 0.16, vol: 0.09, filter: 2400, type: 'bandpass', q: 2, slideFilter: 7000 }); },
    hit(crit) {
      if (!can('hit', crit ? 60 : 45)) return;
      audio.noise({ dur: 0.035, vol: crit ? 0.11 : 0.05, filter: crit ? 4200 : 2600, type: 'bandpass', q: 1.4 });
      if (crit) audio.tone({ freq: 1800, type: 'square', dur: 0.04, vol: 0.03 });
    },
    kill(big) {
      if (big) { if (can('killBig', 90)) audio.sfx('explode', { pitch: 1.4 }); return; }
      // a different pitch each pop (a golden-ratio walk: never the same twice in a row, no dice needed)
      if (can('kill', 38)) audio.sfx('pop', { pitch: 0.75 + ((pops++ * 0.618034) % 1) * 0.55, spread: 0 });
    },
    xp(tier) {
      const t = now();
      if (t - chainAt > 650) chain = 0;
      chainAt = t;
      if (!can('xp', 30)) return;
      const n = PENTA[Math.min(PENTA.length - 1, chain++)];
      audio.tone({ freq: 880 * semis(n) * (tier === 2 ? 0.5 : 1), type: 'square', dur: 0.05, vol: 0.035 + tier * 0.01 });
    },
    levelup() { audio.sfx('levelup'); },
    pick(kind) {
      if (kind === 'heart') audio.sfx('merge', { pitch: 1.2 });
      else if (kind === 'magnet') audio.sfx('power', { pitch: 1.4 });
      else if (kind === 'purge') { audio.sfx('explode'); audio.sfx('clear'); }
      else { audio.tone({ freq: 988, type: 'square', dur: 0.05, vol: 0.08 }); audio.tone({ freq: 1319, type: 'square', dur: 0.14, vol: 0.08, at: 0.05 }); }
    },
    cache() { audio.sfx('power'); setTimeout(() => audio.sfx('win', { pitch: 1.25 }), 140); },
    hurt() { if (can('hurt', 120)) audio.sfx('hurt'); },
    blast() { if (can('blast', 70)) audio.noise({ dur: 0.18, vol: 0.12, filter: 1400, type: 'lowpass', slideFilter: 200 }); },
    strike() { if (can('strike', 60)) { audio.noise({ dur: 0.12, vol: 0.1, filter: 5200, type: 'highpass' }); audio.tone({ freq: 220, type: 'sine', dur: 0.12, vol: 0.12, slide: 70 }); } },
    nova() { audio.sfx('whoosh', { pitch: 0.7 }); audio.tone({ freq: 110, type: 'sine', dur: 0.25, vol: 0.2, slide: 40 }); },
    wall() { if (can('wall', 300)) audio.noise({ dur: 0.3, vol: 0.08, filter: 900, type: 'bandpass', q: 0.8, slideFilter: 2800 }); },
    toss() { if (can('toss', 120)) audio.sfx('whoosh', { pitch: 1.3 }); },
    enemyShot() { if (can('eshot', 140)) audio.tone({ freq: 520, type: 'triangle', dur: 0.08, vol: 0.05, slide: 300 }); },
    crate() { audio.noise({ dur: 0.12, vol: 0.14, filter: 1800, type: 'bandpass' }); audio.sfx('click'); },
    warn() {
      // a siren: three rising wails
      for (let i = 0; i < 3; i++) audio.tone({ freq: 330, type: 'sawtooth', dur: 0.32, vol: 0.07, slide: 660, filter: 1600, at: i * 0.36 });
    },
    bossDown() { audio.sfx('explode', { pitch: 0.7 }); setTimeout(() => audio.sfx('win'), 260); },
    win() { audio.chord([523, 659, 784, 1047], { type: 'triangle', dur: 0.6, vol: 0.09, strum: 0.07 }); setTimeout(() => audio.sfx('win', { pitch: 1.5 }), 380); },
    death() { audio.sfx('lose'); audio.noise({ dur: 0.5, vol: 0.12, filter: 600, type: 'lowpass', slideFilter: 80 }); },
    card() { audio.sfx('select'); },
    // the music: 'run', 'boss' or '' (off)
    music(name) {
      if (name === which) return;
      which = name;
      if (music) { audio.stopMusic(); music = null; }
      if (!name) return;
      music = createLoopMusic(name === 'boss' ? { ...BOSS_LOOP } : { ...RUN_LOOP });
      audio.music(music);
    },
    get track() { return which; },
  };
}
