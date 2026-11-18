// Reproduce the production nodes in Chromium's OfflineAudioContext and read the
// resulting PCM at 48 kHz. The output is deliberately measured before the kit's
// master compressor, including the coincident foley and pit in the theatre.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
export async function measure(id, base = process.argv[2] || 'http://127.0.0.1:5173') {
  const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_BIN });
  try {
    const page = await browser.newPage();
    await page.goto(base + '/');
    const measured = await page.evaluate(async (id) => {
      const rate = 48000,
        ctx = new OfflineAudioContext(1, rate * 36, rate);
      let now = 0;
      const proxy = new Proxy(ctx, {
        get(target, key) {
          if (key === 'currentTime') return now;
          const v = target[key];
          return typeof v === 'function' ? v.bind(target) : v;
        },
      });
      const kit = { ctx: proxy, sfxBus: () => ctx.destination, musicBus: () => ctx.destination };
      if (id === 'waxworks') {
        const { foley, impacts } = await import('/src/games/waxworks/sound.js'),
          bank = foley(kit);
        const cues = Object.keys(impacts);
        for (const [i, name] of cues.entries()) {
          now = i * 0.65;
          bank.strike(name, i % 5);
        }
        for (let i = 0; i < 145; i++) {
          now = 12 + i * 0.067;
          bank.strike(cues[(i * 7) % cues.length], 4);
          if (i % 9 === 0) {
            bank.strike('stamp');
            bank.strike('win');
          }
        }
      } else {
        const { pit, voices } = await import('/src/games/starlingrelay/sound.js'),
          band = pit(kit);
        for (const [i, name] of Object.keys(voices).entries()) {
          now = i * 0.65;
          band.play(name, i % 5);
        }
        for (let i = 0; i < 82; i++) {
          now = 10 + i * 0.21;
          band.beat(i, i % 5, i % 3 === 0 ? 'B' : 'S');
          band.play(['step', 'turn', 'lamp', 'bow', 'encore', 'routine', 'cat', 'cheers'][i % 8]);
          if (i % 11 === 0) {
            band.play('cheers');
            band.play('insert');
          }
        }
      }
      const clip = await ctx.startRendering(),
        data = clip.getChannelData(0);
      let peak = 0,
        power = 0,
        clipped = 0;
      for (const v of data) {
        const a = Math.abs(v);
        peak = Math.max(peak, a);
        power += v * v;
        if (a >= 1) clipped++;
      }
      return {
        peak,
        db: 20 * Math.log10(peak),
        rms: Math.sqrt(power / data.length),
        clipped,
        samples: data.length,
      };
    }, id);
    console.log(
      id +
        ' · 48 kHz rendered PCM · peak ' +
        measured.peak.toFixed(4) +
        ' (' +
        measured.db.toFixed(2) +
        ' dBFS) · RMS ' +
        measured.rms.toFixed(4) +
        ' · ' +
        measured.clipped +
        ' clipped / ' +
        measured.samples +
        ' samples'
    );
    if (measured.clipped || measured.peak <= 0) throw Error('Invalid rendered peak');
    return measured;
  } finally {
    await browser.close();
  }
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await measure('starlingrelay');
