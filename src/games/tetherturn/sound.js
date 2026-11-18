// Capsule radio instruments use variable-pitch glides; flame and constellation colors have interval partners.
export const tones = {
  wind: [[240, 590, 0, .15, .055]],
  launch: [[670, 108, 0, .26, .11], [990, 278, .04, .15, .045]],
  port: [[440, 690, 0, .14, .095]],
  starboard: [[659, 440, 0, .14, .095]],
  brake: [[180, 117, 0, .2, .106], [365, 242, .025, .12, .05]],
  flip: [[783, 784, 0, .11, .08], [620, 625, .045, .11, .07], [496, 495, .09, .15, .07]],
  ring: [[988, 990, 0, .27, .10], [1480, 1480, .03, .16, .038]],
  close: [[1100, 625, 0, .08, .038], [1420, 710, .03, .08, .029]],
  capture: [[330, 329, 0, .43, .12], [494, 494, .06, .38, .083]],
  sink: [[523, 523, 0, .26, .09], [659, 659, .09, .25, .084], [784, 784, .17, .45, .09]],
  miss: [[344, 230, 0, .23, .078], [196, 146, .115, .24, .07]],
  stamp: [[209, 120, 0, .07, .09], [1046, 1046, .05, .33, .088]]
};
export function radio(kit) {
  const ctx = kit?.ctx,
    live = new Set();
  function play(id, fuel = 2) {
    if (!ctx || !kit.sfxBus?.()) return;
    for (const [lo, hi, delay, dur, amp] of tones[id] || []) {
      const at = ctx.currentTime + .004 + delay,
        osc = ctx.createOscillator(),
        env = ctx.createGain(),
        ratio = ['port', 'starboard'].includes(id) ? 1 + .07 * fuel : 1;
      osc.type = ['brake', 'launch', 'wind', 'close', 'stamp'].includes(id) ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(lo * ratio, at);
      osc.frequency.exponentialRampToValueAtTime(hi * ratio, at + dur);
      env.gain.setValueAtTime(.00001, at);
      env.gain.exponentialRampToValueAtTime(amp, at + .008);
      env.gain.exponentialRampToValueAtTime(.00001, at + dur);
      osc.connect(env);
      env.connect(kit.sfxBus());
      live.add(osc);
      osc.onended = () => {
        live.delete(osc);
        osc.disconnect();
        env.disconnect();
      };
      osc.start(at);
      osc.stop(at + dur + .014);
    }
  }
  return {
    play,
    stop() {
      for (const o of live) try {
        o.stop();
      } catch {}
      live.clear();
    }
  };
}
