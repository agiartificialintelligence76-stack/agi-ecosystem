export const colors = {
  soft: [
    [116, 0.075, 0.052, 0, 'triangle'],
    [82, 0.095, 0.04, 0.022, 'sine'],
  ],
  hard: [
    [680, 0.045, 0.055, 0, 'triangle'],
    [171, 0.12, 0.06, 0.025, 'sine'],
  ],
  cloth: [
    [146, 0.07, 0.043, 0, 'triangle'],
    [220, 0.09, 0.03, 0.018, 'triangle'],
  ],
  latch: [
    [210, 0.07, 0.065, 0, 'triangle'],
    [407, 0.1, 0.038, 0.04, 'sine'],
  ],
  card: [
    [415, 0.073, 0.053, 0, 'sine'],
    [622, 0.095, 0.048, 0.084, 'sine'],
  ],
  ready: [
    [990, 0.04, 0.036, 0, 'triangle'],
    [220, 0.1, 0.052, 0.03, 'sine'],
  ],
  click: [
    [1550, 0.036, 0.06, 0, 'triangle'],
    [760, 0.075, 0.054, 0.022, 'sine'],
  ],
  keys: [
    [1174, 0.14, 0.048, 0, 'sine'],
    [1568, 0.15, 0.041, 0.048, 'sine'],
    [1976, 0.18, 0.038, 0.091, 'sine'],
  ],
  boot: [
    [90, 0.12, 0.055, 0, 'triangle'],
    [128, 0.13, 0.045, 0.08, 'triangle'],
  ],
  lens: [
    [470, 0.2, 0.04, 0, 'sine'],
    [700, 0.16, 0.027, 0.07, 'sine'],
  ],
  sight: [
    [311, 0.24, 0.07, 0, 'triangle'],
    [293, 0.25, 0.06, 0.018, 'sine'],
  ],
  page: [
    [480, 0.09, 0.035, 0, 'triangle'],
    [684, 0.095, 0.03, 0.055, 'triangle'],
    [880, 0.16, 0.042, 0.1, 'sine'],
  ],
  exit: [
    [220, 0.12, 0.068, 0, 'triangle'],
    [330, 0.18, 0.055, 0.07, 'sine'],
    [440, 0.22, 0.055, 0.15, 'sine'],
    [660, 0.31, 0.05, 0.23, 'sine'],
  ],
  exhale: [
    [333, 0.17, 0.04, 0, 'sine'],
    [247, 0.26, 0.04, 0.11, 'sine'],
  ],
  reel: [
    [540, 0.06, 0.04, 0, 'triangle'],
    [315, 0.07, 0.033, 0.037, 'triangle'],
  ],
};
export function soundscape(kit) {
  const ctx = kit?.ctx,
    nodes = new Set();
  let pulseAt = 0;
  function note(bus, freq, dur, vol, at, type, pan) {
    if (!ctx) return;
    const osc = ctx.createOscillator(),
      env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(vol, at + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(env);
    let stereo;
    if (ctx.createStereoPanner) {
      stereo = ctx.createStereoPanner();
      stereo.pan.value = pan;
      env.connect(stereo);
      stereo.connect(bus);
    } else env.connect(bus);
    nodes.add(osc);
    osc.onended = () => {
      nodes.delete(osc);
      osc.disconnect();
      env.disconnect();
      stereo?.disconnect();
    };
    osc.start(at);
    osc.stop(at + dur + 0.007);
  }
  function cue(name, pan = 0, raise = 0) {
    if (!ctx) return;
    const now = ctx.currentTime + 0.007;
    for (const [hz, length, vol, delay, type] of colors[name] || colors.soft)
      note(
        kit.sfxBus(),
        hz * (1 + Math.min(4, raise) * 0.03),
        length,
        vol,
        now + delay,
        type,
        Math.max(-1, Math.min(1, pan))
      );
  }
  function tension(near, alarm) {
    if (!ctx || ctx.state !== 'running' || ctx.currentTime < pulseAt - 0.09) return;
    const at = Math.max(ctx.currentTime + 0.015, pulseAt);
    pulseAt = at + (alarm ? 0.43 : near ? 0.77 : 1.85);
    if (!near && !alarm) return;
    note(kit.musicBus(), alarm ? 79 : 60, 0.24, alarm ? 0.065 : 0.043, at, 'sine', -0.13);
    note(kit.musicBus(), alarm ? 99 : 89, 0.18, 0.032, at + 0.115, 'triangle', 0.13);
  }
  function stop() {
    for (const n of nodes) {
      try {
        n.stop();
      } catch {
        /* already ended */
      }
    }
    nodes.clear();
    pulseAt = 0;
  }
  return { cue, tension, stop };
}
