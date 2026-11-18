export const impacts = {
  grip: [[230, 0.045, 0.065, 0]],
  flat: [
    [145, 0.135, 0.085, 0],
    [76, 0.095, 0.07, 0.021],
  ],
  up: [
    [96, 0.16, 0.095, 0],
    [260, 0.11, 0.052, 0.016],
  ],
  edge: [
    [173, 0.08, 0.07, 0],
    [160, 0.08, 0.065, 0.095],
  ],
  glass: [
    [910, 0.24, 0.049, 0],
    [1370, 0.17, 0.029, 0.018],
  ],
  break: [
    [1110, 0.12, 0.055, 0],
    [741, 0.16, 0.048, 0.044],
    [1680, 0.18, 0.026, 0.068],
  ],
  belt: [
    [99, 0.055, 0.055, 0],
    [151, 0.07, 0.045, 0.068],
    [107, 0.08, 0.052, 0.133],
  ],
  split: [
    [320, 0.045, 0.07, 0],
    [460, 0.04, 0.06, 0.037],
    [710, 0.07, 0.055, 0.073],
  ],
  seam: [
    [220, 0.095, 0.055, 0],
    [480, 0.13, 0.06, 0.035],
  ],
  chute: [
    [280, 0.13, 0.056, 0],
    [560, 0.15, 0.055, 0.085],
    [890, 0.17, 0.045, 0.142],
  ],
  switch: [
    [620, 0.07, 0.04, 0],
    [820, 0.06, 0.035, 0.055],
  ],
  stamp: [
    [79, 0.19, 0.09, 0],
    [171, 0.13, 0.075, 0.012],
    [920, 0.08, 0.03, 0.05],
  ],
  post: [
    [900, 0.05, 0.035, 0],
    [1040, 0.05, 0.044, 0.065],
  ],
  win: [
    [294, 0.17, 0.07, 0],
    [370, 0.19, 0.06, 0.1],
    [440, 0.23, 0.06, 0.2],
    [588, 0.31, 0.065, 0.31],
  ],
  undo: [
    [590, 0.055, 0.04, 0],
    [370, 0.1, 0.045, 0.05],
  ],
};
export function foley(kit) {
  const ctx = kit?.ctx,
    active = new Set();
  function strike(name, streak = 0) {
    if (!ctx) return;
    const at = ctx.currentTime + 0.006;
    for (const [frequency, length, volume, delay] of impacts[name] || impacts.grip) {
      const osc = ctx.createOscillator(),
        env = ctx.createGain(),
        start = at + delay;
      osc.type = ['glass', 'break', 'win', 'chute', 'switch', 'post'].includes(name) ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(frequency * (1 + Math.min(5, streak) * 0.018), start);
      if (['flat', 'up', 'edge', 'stamp'].includes(name))
        osc.frequency.exponentialRampToValueAtTime(frequency * 0.55, start + length);
      env.gain.setValueAtTime(0.0001, start);
      env.gain.exponentialRampToValueAtTime(volume, start + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, start + length);
      osc.connect(env);
      env.connect(kit.sfxBus());
      active.add(osc);
      osc.onended = () => {
        active.delete(osc);
        osc.disconnect();
        env.disconnect();
      };
      osc.start(start);
      osc.stop(start + length + 0.008);
    }
  }
  return {
    strike,
    stop() {
      for (const osc of active) {
        try {
          osc.stop();
        } catch {
          /* ended */
        }
      }
      active.clear();
    },
  };
}
