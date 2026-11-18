export const percussive = {
  pearl: [[720, 225, 0, .075, .080], [1250, 590, .026, .05, .043]],
  star: [[1190, 930, 0, .12, .071], [1550, 1340, .044, .11, .040]],
  ice: [[1330, 792, 0, .11, .076], [1930, 1140, .038, .14, .046]],
  shake: [[432, 141, 0, .068, .075], [890, 233, .033, .048, .043]],
  seal: [[142, 65, 0, .13, .17], [580, 150, .039, .066, .085]],
  guest: [[659, 659, 0, .22, .068], [880, 880, .095, .24, .072]],
  printer: [[466, 225, 0, .03, .055], [513, 216, .04, .033, .056], [570, 210, .077, .035, .044]],
  kettle: [[820, 1100, 0, .25, .060], [1240, 1380, .08, .18, .040]],
  streak: [[523, 523, 0, .24, .083], [659, 659, .075, .24, .082], [784, 784, .15, .30, .08], [1046, 1046, .22, .33, .065]],
  miss: [[274, 180, 0, .19, .088]],
  latch: [[640, 330, 0, .07, .051]],
  brush: [[595, 187, 0, .04, .022]],
  bass: [[130, 105, 0, .22, .045]]
};
export function kitchenAudio(kit) {
  const ctx = kit?.ctx,
    voices = new Set(),
    streams = new Map();
  let seed = 77,
    noise = null,
    beat = -1;
  function ring(id, side = 1) {
    if (!ctx || !kit.sfxBus?.()) return;
    const dest = ['bass', 'brush'].includes(id) ? kit.musicBus?.() : kit.sfxBus();
    if (!dest) return;
    for (const [from, to, delay, dur, amp] of percussive[id] || []) {
      const t = ctx.currentTime + .003 + delay,
        osc = ctx.createOscillator(),
        env = ctx.createGain(),
        ratio = id === 'shake' && side < 0 ? 1.24 : 1;
      osc.type = ['seal', 'pearl', 'shake', 'printer', 'brush'].includes(id) ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(from * ratio, t);
      osc.frequency.exponentialRampToValueAtTime(to * ratio, t + dur);
      env.gain.setValueAtTime(.00001, t);
      env.gain.exponentialRampToValueAtTime(amp, t + .003);
      env.gain.exponentialRampToValueAtTime(.00001, t + dur);
      osc.connect(env);
      env.connect(dest);
      voices.add(osc);
      osc.onended = () => {
        voices.delete(osc);
        osc.disconnect();
        env.disconnect();
      };
      osc.start(t);
      osc.stop(t + dur + .008);
    }
  }
  function tap(id, flow, level) {
    if (!ctx || !kit.sfxBus?.()) return;
    if (!streams.has(id) && flow < .045) return;
    if (!streams.has(id)) {
      if (!noise) {
        noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * .65), ctx.sampleRate);
        const data = noise.getChannelData(0);
        let smooth = 0;
        for (let i = 0; i < data.length; i++) {
          seed = Math.imul(seed, 1664525) + 1013904223 >>> 0;
          smooth = .3 * smooth + .7 * (2 * seed / 4294967296 - 1);
          data[i] = smooth;
        }
      }
      const src = ctx.createBufferSource(),
        filter = ctx.createBiquadFilter(),
        gain = ctx.createGain();
      src.buffer = noise;
      src.loop = true;
      filter.type = id % 2 ? 'lowpass' : 'bandpass';
      filter.Q.value = id % 2 ? .8 : 1.4;
      gain.gain.value = .00001;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(kit.sfxBus());
      src.start();
      streams.set(id, {
        src,
        filter,
        gain
      });
    }
    const stream = streams.get(id);
    stream.gain.gain.setTargetAtTime(Math.max(.00001, Math.min(1, flow / 1.45) * .10), ctx.currentTime, .033);
    stream.filter.frequency.setTargetAtTime((id % 2 ? 470 : 1150) + Math.min(8, level) * (id % 2 ? 61 : 96), ctx.currentTime, .055);
  }
  function sync(s) {
    s.cups.forEach((c, i) => c.flow.forEach((f, k) => tap(i * 2 + k, f, c.tea + c.milk)));
    if (s.mode === 'bench') return;
    const b = Math.floor(s.time / .53);
    if (b !== beat) {
      beat = b;
      if (b % 4 === 0) ring('bass');
      if (s.wave && b % 2 === 1) ring('brush');
    }
  }
  function stop() {
    for (const a of voices) try {
      a.stop();
    } catch {}
    voices.clear();
    for (const o of streams.values()) {
      try {
        o.src.stop();
      } catch {}
      o.src.disconnect();
      o.filter.disconnect();
      o.gain.disconnect();
    }
    streams.clear();
  }
  return {
    ring,
    tap,
    sync,
    stop
  };
}
