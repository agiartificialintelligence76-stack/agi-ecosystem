import { SPECIES } from './catalog.js';
// Each species gets its own contour, syllable spacing and register. Layer and range affect a real low-pass filter.
export function stationSound(kit) {
  const ctx = kit?.ctx,
    voices = new Set();
  function syllable(out, at, freq, end, duration, level, wave, pan = 0, filter = 3600) {
    if (!ctx || !out) return;
    const osc = ctx.createOscillator(),
      volume = ctx.createGain(),
      low = ctx.createBiquadFilter();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, at);
    osc.frequency.exponentialRampToValueAtTime(Math.max(24, end), at + duration * .8);
    low.type = 'lowpass';
    low.frequency.value = filter;
    low.Q.value = .55;
    volume.gain.setValueAtTime(.00001, at);
    volume.gain.exponentialRampToValueAtTime(Math.max(.00002, level), at + Math.min(.085, duration * .24));
    volume.gain.exponentialRampToValueAtTime(.00001, at + duration);
    osc.connect(low);
    low.connect(volume);
    let stereo;
    if (ctx.createStereoPanner) {
      stereo = ctx.createStereoPanner();
      stereo.pan.value = Math.min(1, Math.max(-1, pan));
      volume.connect(stereo);
      stereo.connect(out);
    } else volume.connect(out);
    voices.add(osc);
    osc.onended = () => {
      voices.delete(osc);
      osc.disconnect();
      low.disconnect();
      volume.disconnect();
      stereo?.disconnect();
    };
    osc.start(at);
    osc.stop(at + duration + .015);
  }
  const effectBus = () => kit?.sfxBus?.(),
    musicBus = () => kit?.musicBus?.();
  function sing(species, at, level = 1, pan = 0, filter = 3400) {
    if (!ctx) return;
    const f = SPECIES[species];
    f.notes.forEach((ratio, i) => {
      const start = at + f.beats[i],
        hz = f.hz * ratio,
        next = f.hz * (f.notes[i + 1] ?? ratio * .89);
      const duration = i < f.beats.length - 1 ? Math.min(.63, .91 * (f.beats[i + 1] - f.beats[i])) : .49;
      syllable(effectBus(), start, hz, hz * .62 + next * .38, duration, .145 * level, f.wave, pan, filter);
      syllable(effectBus(), start + .009, hz * 2.01, hz * 1.91, duration * .76, .030 * level, 'sine', pan, filter);
      syllable(effectBus(), start + .13, hz, hz * .93, duration * .77, .023 * level, 'sine', pan * .74, filter * .73);
    });
  }
  function chorus(observations, tuned, bed = true) {
    if (!ctx) return;
    const now = ctx.currentTime + .018;
    observations.forEach((o, i) => sing(o.species, now + i * .19, (o.species === tuned ? .96 : .48) * (.46 + .52 * o.strength), o.pan * .92, o.filter));
    if (bed) {
      syllable(musicBus(), now, 54, 55.1, 2.8, .062, 'sine', -.35, 340);
      syllable(musicBus(), now + .18, 81, 79, 2.3, .033, 'triangle', .38, 380);
    }
  }
  return {
    chorus,
    archive(species) {
      if (ctx) sing(species, ctx.currentTime + .02, .95, 0, 3500);
    },
    cue(kind) {
      if (!ctx) return;
      const t = ctx.currentTime + .009,
        b = effectBus();
      if (kind === 'ping') {
        syllable(b, t, 1046, 719, .36, .115, 'sine');
        syllable(b, t + .17, 866, 631, .31, .056, 'sine', .47);
        syllable(b, t + .35, 765, 590, .26, .035, 'sine', -.48);
      } else if (kind === 'depth') {
        syllable(b, t, 390, 115, .25, .08, 'triangle', 0, 960);
      } else if (kind === 'miss') {
        syllable(b, t, 144, 81, .31, .09, 'sawtooth', 0, 620);
        syllable(b, t + .07, 211, 95, .14, .035, 'triangle');
      } else if (kind === 'lock') {
        [1, 1.25, 1.5].forEach((r, i) => syllable(b, t + i * .07, 275 * r, 279 * r, .28, .063, 'sine'));
      } else if (kind === 'stamp') {
        syllable(b, t, 620, 96, .09, .09, 'triangle');
        syllable(b, t + .08, 528, 396, .18, .075, 'sine');
      } else {
        syllable(b, t, 480, 596, .076, .065, 'triangle');
      }
    },
    stop() {
      if (!ctx) return;
      for (const o of [...voices]) {
        try {
          o.stop(ctx.currentTime + .005);
        } catch {/* source already stopped */}
      }
    }
  };
}
