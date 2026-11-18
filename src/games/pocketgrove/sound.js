// Tuned station bells, short wooden board flips and rail joints. Transit plays
// at the carriage pace. All envelopes enter the arcade's user-controlled bus.
export const tones = {
  select: ['triangle', 620, 371, .07],
  pin: ['sine', 520, 780, .13],
  erase: ['triangle', 330, 215, .1],
  wait: ['sine', 390, 295, .12],
  ticket: ['square', 182, 73, .055],
  express: ['sine', 622, 932, .20],
  door: ['sine', 466, 587, .18],
  rail: ['triangle', 103, 61, .062],
  switch: ['triangle', 275, 170, .095],
  seat: ['sine', 381, 476, .09],
  stamp: ['triangle', 213, 100, .12],
  view: ['sine', 784, 988, .19],
  arrival: ['sine', 392, 523, .24],
  home: ['sine', 523, 784, .26],
  late: ['triangle', 330, 220, .25],
  book: ['triangle', 556, 220, .085],
  route: ['sine', 440, 660, .13],
  clock: ['sine', 900, 610, .05]
};
export function stationSound(api, city) {
  const live = new Set();
  let previous = '',
    last = -1;
  function play(id) {
    const kit = api.audio;
    if (api.demo || !kit?.ctx || kit.settings?.sound === false || !tones[id]) return;
    const ctx = kit.ctx,
      t = ctx.currentTime;
    if (id === previous && t - last < .052) return;
    last = t;
    previous = id;
    const [type, f1, f2, duration] = tones[id],
      notes = id === 'home' ? [1, 1.25, 1.5, 2] : id === 'arrival' || id === 'express' ? [1, 1.25, 1.5] : id === 'switch' || id === 'door' ? [1, 1.18] : [1];
    for (const [i, n] of notes.entries()) {
      const osc = ctx.createOscillator(),
        g = ctx.createGain(),
        start = t + i * .092;
      osc.type = type;
      const pitch = n * (1 + city * .027);
      osc.frequency.setValueAtTime(f1 * pitch, start);
      osc.frequency.exponentialRampToValueAtTime(f2 * pitch, start + duration);
      g.gain.setValueAtTime(.0001, start);
      g.gain.exponentialRampToValueAtTime(id === 'rail' ? .027 : id === 'ticket' ? .037 : .067, start + .006);
      g.gain.exponentialRampToValueAtTime(.0001, start + duration);
      osc.connect(g);
      g.connect(kit.sfxBus());
      live.add(osc);
      osc.start(start);
      osc.stop(start + duration + .01);
      osc.onended = () => {
        live.delete(osc);
        osc.disconnect();
        g.disconnect();
      };
    }
  }
  return {
    play,
    stop() {
      for (const osc of live) {
        try {
          osc.stop();
        } catch {}
      }
    }
  };
}
