// ROBOTAXI RUSH: its sounds, all made in the browser (the arcade kit's Web Audio): an engine hum and the wind that follow
// the speed, the effects (near misses climb a note with each link of the chain), and a little synthwave loop per zone.
// Nothing is made until a tap or a key has woken the sound (and never in a demo): the kit's `audio.running`.
import { createLoopMusic } from '../kit/audio.js';

const TRIAD = { maj: [0, 4, 7], min: [0, 3, 7] };
// a zone's loop: four chords, octave-bouncing bass, an arpeggio, soft pads, four-on-the-floor
function loop({ bpm, chords }) {
  const steps = 16, bars = chords.length, total = steps * bars;
  const notes = (fn) => Array.from({ length: total }, (_, s) => fn(s, chords[Math.floor(s / steps)], s % steps));
  const tone = (ch, i) => ch[0] + TRIAD[ch[1]][i % 3] + 12 * Math.floor(i / 3);
  return createLoopMusic({
    bpm, steps, bars,
    tracks: [
      { type: 'sawtooth', vol: 0.05, filter: 650, dur: 1.5, notes: notes((s, ch, k) => (k % 2 === 0 ? ch[0] - 24 + (k % 4 === 2 ? 12 : 0) : null)) },
      { type: 'square', vol: 0.022, filter: 2400, dur: 0.85, notes: notes((s, ch, k) => (k % 2 === 0 ? tone(ch, [0, 1, 2, 3, 2, 1, 0, 2][(k / 2) % 8]) + 12 : null)) },
      { type: 'triangle', vol: 0.02, dur: 15, attack: 0.3, notes: notes((s, ch, k) => (k === 0 ? tone(ch, 0) : null)) },
      { type: 'triangle', vol: 0.016, dur: 15, attack: 0.3, notes: notes((s, ch, k) => (k === 0 ? tone(ch, 1) : null)) },
      { type: 'triangle', vol: 0.016, dur: 15, attack: 0.3, notes: notes((s, ch, k) => (k === 0 ? tone(ch, 2) : null)) },
    ],
    drums: {
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
    },
  });
}
const SONGS = {
  dusk: () => loop({ bpm: 112, chords: [[57, 'min'], [53, 'maj'], [48, 'maj'], [55, 'maj']] }),
  night: () => loop({ bpm: 118, chords: [[53, 'min'], [49, 'maj'], [56, 'maj'], [51, 'maj']] }),
  rain: () => loop({ bpm: 104, chords: [[50, 'min'], [58, 'maj'], [53, 'maj'], [48, 'maj']] }),
  coast: () => loop({ bpm: 120, chords: [[48, 'maj'], [55, 'maj'], [57, 'min'], [53, 'maj']] }),
};

export function createSound(audio) {
  let eng = null, song = '', lastScrape = 0;

  function ensure() {
    if (eng) return eng;
    if (!audio.running) return null;
    const c = audio.ctx, bus = audio.sfxBus();
    const out = c.createGain(); out.gain.value = 0; out.connect(bus);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 3; lp.connect(out);
    const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 60; o1.connect(lp);
    const sub = c.createGain(); sub.gain.value = 0.6; sub.connect(lp);
    const o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.value = 30; o2.connect(sub);
    const len = Math.floor(c.sampleRate * 1.5);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const ns = c.createBufferSource(); ns.buffer = buf; ns.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.7;
    const wg = c.createGain(); wg.gain.value = 0;
    ns.connect(bp); bp.connect(wg); wg.connect(bus);
    o1.start(); o2.start(); ns.start();
    eng = { c, out, lp, o1, o2, wg, bp };
    return eng;
  }

  // every frame: on (a run is being driven), speed 0..1+, boost 0..1, rumble (on the strips)
  function update(on, speed, boost, rumble) {
    const e = ensure();
    if (!e) return;
    const t = e.c.currentTime;
    const f = 46 + speed * 62 + boost * 24;
    e.o1.frequency.setTargetAtTime(f, t, 0.09);
    e.o2.frequency.setTargetAtTime(f * 0.5, t, 0.09);
    e.lp.frequency.setTargetAtTime(380 + speed * 760 + boost * 900 + (rumble ? 300 : 0), t, 0.1);
    e.out.gain.setTargetAtTime(on ? 0.045 + boost * 0.03 : 0, t, 0.18);
    e.wg.gain.setTargetAtTime(on ? 0.012 + speed * 0.04 + boost * 0.05 + (rumble ? 0.07 : 0) : 0, t, 0.2);
    e.bp.frequency.setTargetAtTime(rumble ? 260 : 500 + speed * 1500, t, 0.12);
  }

  const a = audio;
  const sfx = {
    near(combo, close) {
      a.noise({ dur: 0.2, vol: close ? 0.2 : 0.14, filter: 500, type: 'bandpass', q: 0.9, slideFilter: 3200 });
      const f = 523 * 2 ** (Math.min(combo - 1, 14) / 12);
      a.tone({ freq: f, type: 'square', dur: 0.07, vol: 0.07, at: 0.02 });
      a.tone({ freq: f * 1.5, type: 'triangle', dur: 0.12, vol: 0.06, at: 0.07 });
      if (close) a.tone({ freq: f * 2, type: 'sine', dur: 0.16, vol: 0.06, at: 0.11, slide: f * 2.5 });
    },
    ready() { [523, 659, 784, 1047].forEach((fr, i) => a.tone({ freq: fr, type: 'square', dur: 0.08, vol: 0.06, at: i * 0.05 })); },
    boost() { a.sfx('power', { pitch: 1.1 }); a.noise({ dur: 0.6, vol: 0.2, filter: 300, type: 'bandpass', q: 0.6, slideFilter: 4200 }); a.tone({ freq: 90, slide: 45, type: 'sine', dur: 0.3, vol: 0.3 }); },
    boostEnd() { a.tone({ freq: 660, slide: 220, type: 'triangle', dur: 0.3, vol: 0.06 }); },
    ram() { a.sfx('hit', { pitch: 0.9 }); a.noise({ dur: 0.25, vol: 0.18, filter: 1400, type: 'lowpass', slideFilter: 200 }); a.tone({ freq: 880, type: 'square', dur: 0.06, vol: 0.05, at: 0.05 }); },
    crash() { a.sfx('hurt'); a.noise({ dur: 0.35, vol: 0.32, filter: 1600, type: 'lowpass', slideFilter: 150 }); a.tone({ freq: 120, slide: 50, type: 'sine', dur: 0.3, vol: 0.32 }); },
    wreck() { a.sfx('explode'); a.sfx('lose', { pitch: 0.9 }); },
    fare() { a.sfx('coin'); a.tone({ freq: 1568, type: 'triangle', dur: 0.12, vol: 0.06, at: 0.12 }); },
    shield() { a.sfx('power', { pitch: 1.4 }); a.chord([784, 988, 1175], { dur: 0.25, type: 'triangle', vol: 0.06, at: 0.08, strum: 0.04 }); },
    checkpoint() { a.sfx('levelup'); },
    barrier() { a.noise({ dur: 0.12, vol: 0.2, filter: 3000, type: 'highpass' }); a.tone({ freq: 220, type: 'square', dur: 0.05, vol: 0.05 }); },
    scrape(now) { if (now - lastScrape < 0.09) return; lastScrape = now; a.noise({ dur: 0.07, vol: 0.09, filter: 5000, type: 'highpass' }); },
    chain(n) { a.sfx('combo', { pitch: 1 + Math.min(n, 12) * 0.03 }); },
    pin() { a.sfx('tap'); },
  };

  return {
    update,
    sfx,
    music(zone) {
      if (song === zone) return;
      song = zone;
      if (!zone) { a.stopMusic(); return; }
      a.music(SONGS[zone]());
    },
    stopMusic() { song = ''; a.stopMusic(); },
  };
}
