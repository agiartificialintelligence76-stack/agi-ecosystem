import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_BIN });
try {
  const page = await browser.newPage();
  await page.goto((process.argv[2] || 'http://127.0.0.1:5173') + '/');
  const m = await page.evaluate(async () => {
    const { colors, soundscape } = await import('/src/games/inkveil/sound.js'),
      rate = 48000,
      context = new OfflineAudioContext(2, rate * 36, rate);
    let now = 0;
    const proxy = new Proxy(context, {
      get(t, k) {
        if (k === 'currentTime') return now;
        if (k === 'state') return 'running';
        const v = t[k];
        return typeof v === 'function' ? v.bind(t) : v;
      },
    });
    const fx = soundscape({ ctx: proxy, sfxBus: () => context.destination, musicBus: () => context.destination });
    for (const [i, name] of Object.keys(colors).entries()) {
      now = i * 0.55;
      fx.cue(name, i % 2 ? -0.65 : 0.65);
    }
    for (let i = 0; i < 153; i++) {
      now = 10 + i * 0.115;
      fx.tension(true, i % 9 < 4);
      fx.cue(i % 3 === 0 ? 'hard' : 'soft', Math.sin(i) * 0.6, i % 5);
      if (i % 5 === 0) {
        fx.cue('keys', 0.7);
        fx.cue('boot', -0.7);
      }
      if (i % 9 === 0) {
        fx.cue('sight');
        fx.cue('page');
      }
      if (i % 13 === 0) fx.cue('exit');
    }
    const rendered = await context.startRendering();
    let peak = 0,
      clipped = 0,
      power = 0;
    for (let ch = 0; ch < 2; ch++)
      for (const v of rendered.getChannelData(ch)) {
        peak = Math.max(peak, Math.abs(v));
        power += v * v;
        if (Math.abs(v) >= 1) clipped++;
      }
    return { peak, clipped, samples: rendered.length * 2, rms: Math.sqrt(power / (rendered.length * 2)) };
  });
  console.log(
    '48 kHz stereo · ' +
      m.samples +
      ' PCM samples · peak ' +
      m.peak.toFixed(4) +
      ' (' +
      (20 * Math.log10(m.peak)).toFixed(2) +
      ' dBFS) · RMS ' +
      m.rms.toFixed(4) +
      ' · ' +
      m.clipped +
      ' clipped.'
  );
  if (m.clipped || m.peak <= 0) throw Error('Invalid output peak');
} finally {
  await browser.close();
}
