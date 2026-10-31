// Every sound is synthesised in the browser. No audio files.
export class Sound {
  constructor() { this.enabled = true; this.context = null; this.lastStep = 0; this.windGain = null; this.noise = null; }

  unlock() {
    if (!this.context) this.context = new (window.AudioContext || window.webkitAudioContext)();
    this.context.resume().catch(() => {});
    if (!this.noise) {
      const c = this.context, buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buffer;
    }
    if (!this.windGain) {
      const c = this.context, source = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain();
      source.buffer = this.noise; source.loop = true;
      filter.type = 'bandpass'; filter.frequency.value = 520; filter.Q.value = 0.6;
      gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(c.destination); source.start();
      this.windGain = gain; this.windFilter = filter;
    }
  }

  tone(frequency, duration = .1, type = 'sine', volume = .05, end = frequency, delay = 0) {
    if (!this.enabled || !this.context) return;
    const c = this.context, o = c.createOscillator(), g = c.createGain(), t = c.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(frequency, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + duration);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(volume, t + 0.008); g.gain.exponentialRampToValueAtTime(.0001, t + duration);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + duration + 0.02);
  }

  burst(duration = .4, volume = .1, frequency = 400, type = 'lowpass', q = 0.7) {
    if (!this.enabled || !this.context || !this.noise) return;
    const c = this.context, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime;
    s.buffer = this.noise; f.type = type; f.frequency.value = frequency; f.Q.value = q;
    g.gain.setValueAtTime(volume, t); g.gain.exponentialRampToValueAtTime(.0001, t + duration);
    s.connect(f).connect(g).connect(c.destination); s.start(t, Math.random()); s.stop(t + duration);
  }

  play(name, amount = 1) {
    switch (name) {
      case 'jump': this.tone(220, .1, 'sine', .025, 450); break;
      case 'land': this.tone(95, .13, 'triangle', Math.min(.08, .012 + amount * .002), 40); break;
      case 'checkpoint': [440, 554, 659].forEach((n, i) => this.tone(n, .35, 'sine', .04, n * 1.005, i * .1)); break;
      case 'pad': this.tone(160, .32, 'sine', .055, 980); break;
      case 'grapple': this.tone(680, .14, 'triangle', .03, 1100); break;
      case 'crumble': case 'crash': this.tone(80, .2, 'sawtooth', .025, 35); this.burst(.25, .05, 300); break;
      case 'hazard': this.tone(130, .25, 'sawtooth', .05, 40); this.burst(.2, .06, 1200, 'bandpass', 2); break;
      case 'pump': [0, 1, 2, 3].forEach((i) => this.tone(330 * 2 ** (i * 4 / 12), .18, 'triangle', .035, 330 * 2 ** (i * 4 / 12) * 1.01, i * .07)); break;
      case 'dump': this.tone(520, .55, 'sawtooth', .03, 70); this.tone(260, .55, 'square', .015, 40); break;
      case 'rug': this.burst(.35, .09, 2400, 'bandpass', 1.5); this.tone(900, .3, 'sawtooth', .02, 120); break;
      case 'coin': { const n = 988 * 2 ** ((amount % 5) / 12); this.tone(n, .09, 'square', .018, n); this.tone(n * 1.5, .22, 'square', .016, n * 1.5, .07); break; }
      case 'zone': [262, 330, 392, 523].forEach((n, i) => this.tone(n, 1.1, 'sine', .028, n, i * .09)); break;
      case 'thunder': this.burst(1.6 + amount, .12 * amount, 140); this.burst(.3, .05 * amount, 900); break;
      case 'finish': [330, 440, 554, 659, 880].forEach((n, i) => this.tone(n, .8, 'sine', .05, n, i * .14)); break;
      default: break;
    }
  }

  /** A wind bed that rises with altitude, speed and long falls. */
  wind(level) {
    if (!this.windGain || !this.context) return;
    const target = this.enabled ? Math.min(.05, level * .05) : 0;
    this.windGain.gain.setTargetAtTime(target, this.context.currentTime, .25);
    this.windFilter.frequency.setTargetAtTime(380 + level * 900, this.context.currentTime, .3);
  }

  step(speed, time) { if (speed > 1 && time - this.lastStep > Math.max(.15, .35 - speed * .014)) { this.tone(110 + Math.sin(time) * 20, .035, 'triangle', .012, 65); this.lastStep = time; } }
}
