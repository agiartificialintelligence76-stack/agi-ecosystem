// Each instrument is built from a brief tonal or swept mechanical partial, before the kit's SFX bus.
// [wave, start Hz, end Hz, onset s, length s, linear amplitude].
export const instruments = {
  roll: [['triangle', 104, 58, 0, .095, .115], ['sine', 155, 93, .055, .1, .071]],
  reverse: [['triangle', 162, 76, 0, .09, .085], ['triangle', 112, 56, .08, .13, .075]],
  frog: [['square', 525, 186, 0, .028, .044], ['triangle', 625, 211, .065, .048, .083]],
  couple: [['triangle', 1130, 184, 0, .047, .16], ['sine', 241, 118, .034, .105, .092]],
  release: [['sine', 1318, 1160, 0, .17, .093], ['triangle', 508, 320, .006, .045, .065]],
  points: [['triangle', 279, 681, 0, .06, .092], ['square', 450, 110, .053, .047, .066]],
  bridge: [0, .051, .103, .155].map((t, i) => ['triangle', 316 + i * 71, 123 + i * 15, t, .063, .090]),
  buffer: [['sine', 417, 181, 0, .23, .104], ['triangle', 173, 78, .12, .09, .060]],
  bell: [['sine', 1174, 1167, 0, .48, .145], ['sine', 2638, 2549, 0, .21, .058]],
  pour: [['triangle', 280, 480, 0, .15, .038], ['sine', 620, 190, .085, .22, .07], ['sine', 720, 311, .18, .12, .045]],
  route: [['sine', 784, 880, 0, .12, .093], ['triangle', 988, 1047, .102, .16, .068]],
  chord: [0, 4, 7, 12].map((n, i) => ['sine', 440 * 2 ** (n / 12), 440 * 2 ** (n / 12), i * .09, .51, .090])
};
export function createWhistle(kit) {
  const ctx = kit?.ctx,
    active = new Set();
  let lastRoll = -10;
  function ring(id) {
    if (!ctx || !kit.sfxBus?.() || !instruments[id]) return;
    if (['roll', 'reverse', 'frog'].includes(id)) {
      if (ctx.currentTime - lastRoll < .055) return;
      lastRoll = ctx.currentTime;
    }
    for (const [wave, f, end, offset, length, amp] of instruments[id]) {
      const osc = ctx.createOscillator(),
        env = ctx.createGain(),
        at = ctx.currentTime + .005 + offset;
      osc.type = wave;
      osc.frequency.setValueAtTime(f, at);
      osc.frequency.exponentialRampToValueAtTime(end, at + length);
      env.gain.setValueAtTime(.00001, at);
      env.gain.exponentialRampToValueAtTime(amp, at + .006);
      env.gain.exponentialRampToValueAtTime(.00001, at + length);
      osc.connect(env);
      env.connect(kit.sfxBus());
      osc.onended = () => {
        active.delete(osc);
        osc.disconnect();
        env.disconnect();
      };
      active.add(osc);
      osc.start(at);
      osc.stop(at + length + .009);
    }
  }
  function stop() {
    for (const node of active) try {
      node.stop();
    } catch {}
    active.clear();
  }
  return {
    ring,
    stop
  };
}
