import { CABINS, voices } from './repertoire.js';
// Local modal percussion. Four sizes of brass strike, a wooden clapper and a quiet return from the far hillside.
export const VOICINGS = [[1, 2.02, 2.97, 4.16], [1, 2.4, 3.08, 4.75], [1, 1.98, 3.37, 5.21], [1, 2.12, 3.97, 5.36]];
export function createBand(kit) {
  const ctx = kit?.ctx,
    active = new Set();
  let origin = null;
  function partial(destination, frequency, at, duration, gain, kind = 'sine', pan = 0, fall = null) {
    if (!ctx || !destination) return;
    const osc = ctx.createOscillator(),
      env = ctx.createGain();
    osc.type = kind;
    osc.frequency.setValueAtTime(frequency, at);
    if (fall) osc.frequency.exponentialRampToValueAtTime(fall, at + duration * .83);
    env.gain.setValueAtTime(.00001, at);
    env.gain.exponentialRampToValueAtTime(gain, at + .009);
    env.gain.exponentialRampToValueAtTime(.00001, at + duration);
    osc.connect(env);
    let stereo;
    if (ctx.createStereoPanner) {
      stereo = ctx.createStereoPanner();
      stereo.pan.value = pan;
      env.connect(stereo);
      stereo.connect(destination);
    } else env.connect(destination);
    active.add(osc);
    osc.onended = () => {
      active.delete(osc);
      osc.disconnect();
      env.disconnect();
      stereo?.disconnect();
    };
    osc.start(at);
    osc.stop(at + duration + .015);
  }
  const out = () => kit?.sfxBus?.(),
    music = () => kit?.musicBus?.();
  function bell(mask, root, at = ctx?.currentTime ?? 0) {
    const group = voices(mask),
      weight = 1 / Math.sqrt(group.length || 1);
    group.forEach(n => {
      const f = root * CABINS[n].tone,
        pan = (n - 1.5) * .31;
      VOICINGS[n].forEach((ratio, i) => partial(out(), f * ratio, at, [.95, .50, .28, .13][i], [.125, .048, .026, .016][i] * weight, 'sine', pan));
      partial(out(), f * .52, at, .065, .047 * weight, 'triangle', pan, f * .31);
      partial(out(), f, at + .195, .49, .028 * weight, 'sine', -pan * .7);
    });
  }
  function stop() {
    for (const node of [...active]) {
      try {
        node.stop(ctx.currentTime + .008);
      } catch {/* already ended */}
    }
    origin = null;
  }
  function phrase(event, age = 0) {
    stop();
    if (!ctx) return;
    origin = ctx.currentTime + .028 - age;
    event.times.forEach((beat, i) => {
      if (beat < age - .015) return;
      const at = Math.max(ctx.currentTime + .006, origin + beat);
      bell(event.notes[i], event.tonic, at);
      if (i % 4 === 0) partial(music(), event.tonic * (i % 8 ? .375 : .25), at, 1.6, .08, 'triangle', 0);
    });
    if (age < .12) {
      partial(out(), 1100, Math.max(ctx.currentTime + .005, origin + .05), .055, .045, 'triangle', -.2, 510);
    }
  }
  return {
    phrase,
    bell,
    stop,
    heard() {
      return origin === null || ctx?.state !== 'running' ? null : Math.max(0, ctx.currentTime - origin - (ctx.outputLatency || 0));
    },
    effect(name, root = 261.6) {
      if (!ctx) return;
      const at = ctx.currentTime + .008;
      if (name === 'summit') {
        [1, 1.26, 1.5, 2].forEach((r, i) => partial(out(), root * r, at + i * .095, .48, .11, 'triangle', i * .12 - .18));
      } else if (name === 'miss') {
        partial(out(), root * .74, at, .22, .085, 'triangle', 0, root * .5);
      } else if (name === 'join') {
        partial(out(), root * 1.52, at, .11, .055, 'sine', .2);
      } else if (name === 'echo') {
        partial(out(), root * 2, at, .13, .035, 'sine', 0);
      } else if (name === 'bow') {
        partial(music(), root * .5, at, .9, .08, 'triangle', 0);
      }
    }
  };
}
