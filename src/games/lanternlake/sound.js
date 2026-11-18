const ident = [294, 370, 440, 554];
const recipes = {
  pickup: [
    [391, 0, 0.1],
    [523, 0.12, 0.18],
  ],
  caller: [
    [330, 0, 0.1],
    [494, 0.13, 0.24],
  ],
  mark: [
    [783, 0, 0.054],
    [196, 0.045, 0.085],
  ],
  press: [
    [494, 0, 0.08],
    [440, 0.065, 0.11],
  ],
  back: [[220, 0, 0.085]],
  paper: [
    [740, 0, 0.04],
    [510, 0.035, 0.055],
  ],
  flip: [
    [630, 0, 0.05],
    [440, 0.045, 0.065],
    [280, 0.08, 0.075],
  ],
  proof: [
    [370, 0, 0.2],
    [554, 0.085, 0.22],
    [740, 0.17, 0.24],
  ],
  miss: [
    [196, 0, 0.17],
    [185, 0.08, 0.18],
  ],
  guide: [
    [247, 0, 0.2],
    [185, 0.15, 0.23],
  ],
  recover: [
    [440, 0, 0.12],
    [554, 0.12, 0.15],
    [660, 0.23, 0.22],
  ],
  listen: [
    [740, 0, 0.065],
    [554, 0.055, 0.075],
    [370, 0.11, 0.09],
  ],
  sealed: ident.map((h, i) => [h, i * 0.18, 0.3]),
  bell: [
    [880, 0, 0.43],
    [1319, 0, 0.24],
    [1760, 0, 0.14],
  ],
  collar: [
    [1175, 0, 0.17],
    [1568, 0.08, 0.2],
    [1175, 0.19, 0.21],
  ],
  ident: ident.map((h, i) => [h, i * 0.18, 0.16]),
  three: ident.slice(0, 3).map((h, i) => [h, i * 0.21, 0.18]),
  fourth: [
    [294, 0, 0.15],
    [370, 0.2, 0.15],
    [440, 0.4, 0.15],
    [554, 0.67, 0.49],
  ],
  gap: [
    [294, 0, 0.1],
    [294, 0.6, 0.1],
  ],
  echo: [
    [390, 0, 0.085],
    [390, 0.2, 0.068],
    [390, 0.4, 0.049],
  ],
  thunder: [
    [65, 0, 0.58],
    [61, 0.13, 0.53],
    [87, 0.35, 0.34],
  ],
  sneeze: [
    [720, 0, 0.035],
    [150, 0.095, 0.14],
    [290, 0.32, 0.045],
    [720, 0.95, 0.035],
    [150, 1.045, 0.14],
    [290, 1.27, 0.045],
  ],
  rain: [
    [1660, 0, 0.03],
    [1330, 0.09, 0.045],
    [1080, 0.24, 0.04],
    [1660, 0.52, 0.03],
    [1330, 0.61, 0.045],
  ],
  choir: [
    [330, 0, 0.22, -0.78],
    [392, 0, 0.68, 0.78, 466],
    [330, 0.39, 0.3, -0.78],
  ],
};
export const cueNames = Object.keys(recipes);
export function radioSound(kit) {
  const ctx = kit?.ctx,
    live = new Set();
  let nextBed = 0,
    cueUntil = -1;
  function note(h, offset, len, level, type, pan, bus, endPitch) {
    const osc = ctx.createOscillator(),
      amp = ctx.createGain(),
      t = ctx.currentTime + 0.008 + offset;
    osc.type = type;
    osc.frequency.setValueAtTime(h, t);
    if (endPitch) osc.frequency.linearRampToValueAtTime(endPitch, t + len);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(level, t + Math.min(0.018, len / 3));
    amp.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(amp);
    const stereo = ctx.createStereoPanner?.();
    if (stereo) {
      stereo.pan.value = pan;
      amp.connect(stereo);
      stereo.connect(bus);
    } else amp.connect(bus);
    live.add(osc);
    osc.onended = () => {
      live.delete(osc);
      osc.disconnect();
      amp.disconnect();
      stereo?.disconnect();
    };
    osc.start(t);
    osc.stop(t + len + 0.012);
  }
  function play(name, night = 0, force = false) {
    if (!ctx || (!force && ctx.currentTime < cueUntil)) return;
    cueUntil = ctx.currentTime + 0.027;
    const seq = recipes[name] || recipes.paper,
      shift = ['pickup', 'caller'].includes(name) ? Math.pow(2, (night % 7) / 12) : 1;
    seq.forEach(([h, delay, len, pan, endPitch], i) =>
      note(
        h * shift,
        delay,
        len,
        name === 'bell' ? 0.051 / (i + 1) : 0.061,
        name === 'miss' || name === 'thunder'
          ? 'sawtooth'
          : name === 'paper' || name === 'flip'
            ? 'triangle'
            : 'sine',
        pan ?? (name === 'fourth' ? (i === 3 ? 0.8 : -0.8) : i % 2 ? 0.45 : -0.45),
        kit.sfxBus(),
        endPitch
      )
    );
  }
  function bed(night, lights) {
    if (!ctx || ctx.currentTime < nextBed) return;
    nextBed = ctx.currentTime + 4.5;
    const root = [110, 98, 123.47, 103.83, 116.54, 98, 110][night];
    note(root, 0, 1.15, 0.017, 'sine', -0.25, kit.musicBus());
    note(root * (lights <= 1 ? 1.19 : 1.5), 0.23, 1.05, 0.011, 'sine', 0.25, kit.musicBus());
  }
  function stop() {
    for (const n of live) {
      try {
        n.stop();
      } catch {}
    }
    live.clear();
    nextBed = 0;
    cueUntil = -1;
  }
  return { play, bed, stop };
}
