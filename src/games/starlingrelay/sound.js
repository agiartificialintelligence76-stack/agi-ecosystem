const bank = {
  insert: [
    [680, 0.055, 0.07],
    [1020, 0.035, 0.035],
  ],
  erase: [
    [340, 0.065, 0.07],
    [165, 0.09, 0.035],
  ],
  run: [
    [220, 0.12, 0.075],
    [330, 0.16, 0.06],
  ],
  step: [
    [152, 0.075, 0.085],
    [67, 0.1, 0.045],
  ],
  turn: [
    [330, 0.12, 0.065],
    [440, 0.08, 0.045],
  ],
  rest: [[590, 0.09, 0.045]],
  bow: [
    [440, 0.19, 0.07],
    [660, 0.3, 0.065],
  ],
  lamp: [
    [760, 0.055, 0.06],
    [1130, 0.09, 0.025],
  ],
  encore: [
    [330, 0.12, 0.06],
    [494, 0.14, 0.055],
    [660, 0.18, 0.05],
  ],
  routine: [
    [294, 0.07, 0.06],
    [370, 0.09, 0.06],
    [440, 0.14, 0.06],
  ],
  cat: [
    [1160, 0.13, 0.055],
    [1740, 0.16, 0.025],
  ],
  miss: [
    [184, 0.13, 0.07],
    [141, 0.21, 0.05],
  ],
  shuffle: [
    [107, 0.07, 0.07],
    [740, 0.035, 0.025],
  ],
  cheers: [
    [392, 0.2, 0.07],
    [494, 0.26, 0.065],
    [587, 0.3, 0.06],
    [784, 0.45, 0.06],
  ],
};
export { bank as voices };
export function pit(kit) {
  const context = kit?.ctx,
    active = new Set();
  function note(bus, freq, at, length, level, type) {
    if (!context || !bus) return;
    const osc = context.createOscillator(),
      gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + 0.009);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(gain);
    gain.connect(bus);
    active.add(osc);
    osc.onended = () => {
      active.delete(osc);
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(at);
    osc.stop(at + length + 0.006);
  }
  function play(name, accent = 0) {
    if (!context) return;
    const at = context.currentTime + 0.006;
    (bank[name] || bank.step).forEach(([f, d, v], i) =>
      note(kit.sfxBus(), f * (1 + Math.min(4, accent) * 0.035), at + i * 0.038, d, v, 'triangle')
    );
  }
  function beat(index, act, code) {
    if (!context) return;
    const at = context.currentTime + 0.012,
      scale = [0, 3, 5, 7, 10, 7, 5, 3];
    const root = 130.81 * 2 ** ([0, 2, 5, -2, 3][act] / 12);
    const pitch = root * 2 ** (scale[(index + (code === 'B' ? 3 : 0)) % 8] / 12);
    note(kit.musicBus(), pitch * 2, at, 0.26, 0.082, 'triangle');
    if (index % 2 === 0) note(kit.musicBus(), root * (index % 4 === 0 ? 0.5 : 0.75), at, 0.33, 0.075, 'sine');
  }
  function stop() {
    for (const osc of active) {
      try {
        osc.stop();
      } catch {
        /* expired */
      }
    }
    active.clear();
  }
  return { play, beat, stop };
}
