const chords = {
  tip: [[1080, .055, 0, .07], [152, .10, .012, .09]],
  rail: [[185, .16, 0, .12], [492, .07, .008, .045]],
  pocket: [[485, .096, 0, .1], [289, .14, .044, .11], [104, .21, .115, .11]],
  scratch: [[310, .19, 0, .11], [218, .22, .11, .075]],
  turn: [[420, .17, 0, .066], [315, .21, .10, .063]],
  moon: [[554, .28, 0, .095], [698, .32, .055, .08], [831, .37, .10, .08], [1109, .45, .17, .076]],
  chalk: [[1800, .032, 0, .022], [2190, .038, .05, .03], [1400, .044, .10, .024]],
  well: [[123, .30, 0, .026], [184, .29, .05, .017]],
  roll: [[139, .10, 0, .035], [202, .055, .035, .02]]
};
export const sounds = Object.keys(chords).concat(['clack']);
export function tableSound(kit) {
  const ctx = kit?.ctx,
    nodes = new Set();
  let last = -2;
  function play(name, speed = 220) {
    if (!ctx || !kit.sfxBus?.()) return;
    if (name === 'clack' && ctx.currentTime - last < .026) return;
    if (name === 'clack') last = ctx.currentTime;
    const band = Math.min(4, Math.floor(speed / 95)),
      list = name === 'clack' ? [[490 + band * 105, .051, 0, .045 + band * .023], [1075 + band * 170, .034, .002, .038 + band * .012]] : chords[name] || [];
    for (const [hz, d, delay, amp] of list) {
      const at = ctx.currentTime + .004 + delay,
        osc = ctx.createOscillator(),
        g = ctx.createGain();
      osc.type = ['tip', 'clack', 'chalk', 'rail'].includes(name) ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(hz, at);
      osc.frequency.exponentialRampToValueAtTime(hz * (name === 'moon' ? .995 : .73), at + d);
      g.gain.setValueAtTime(.00001, at);
      g.gain.exponentialRampToValueAtTime(amp, at + .003);
      g.gain.exponentialRampToValueAtTime(.00001, at + d);
      osc.connect(g);
      g.connect(kit.sfxBus());
      nodes.add(osc);
      osc.onended = () => {
        nodes.delete(osc);
        osc.disconnect();
        g.disconnect();
      };
      osc.start(at);
      osc.stop(at + d + .01);
    }
  }
  return {
    play,
    stop() {
      for (const n of nodes) try {
        n.stop();
      } catch {}
      nodes.clear();
    }
  };
}
