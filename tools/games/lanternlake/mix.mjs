import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_BIN });
try {
  const page = await browser.newPage();
  await page.goto((process.argv[2] || 'http://127.0.0.1:5173') + '/');
  const result = await page.evaluate(async () => {
    const { cueNames, radioSound } = await import('/src/games/lanternlake/sound.js'),
      rate = 48000,
      ctx = new OfflineAudioContext(2, rate * 42, rate);
    let now = 0;
    const clock = new Proxy(ctx, {
        get(obj, k) {
          if (k === 'currentTime') return now;
          const v = obj[k];
          return typeof v === 'function' ? v.bind(obj) : v;
        },
      }),
      mix = radioSound({ ctx: clock, sfxBus: () => ctx.destination, musicBus: () => ctx.destination });
    cueNames.forEach((cue, i) => {
      now = i * 0.65;
      mix.play(cue, i % 7, true);
      mix.bed(i % 7, i % 4);
    });
    for (let i = 0; i < 150; i++) {
      now = 18 + i * 0.145;
      mix.bed(i % 7, i % 4);
      mix.play(
        ['mark', 'press', 'paper', 'flip', 'proof', 'listen', 'recover', 'miss', 'sealed'][i % 9],
        i % 7,
        true
      );
      if (i % 4 === 0) mix.play(['three', 'fourth', 'choir', 'sneeze'][(i % 5) % 4], i % 7, true);
    }
    const out = await ctx.startRendering();
    let peak = 0,
      sum = 0,
      clipped = 0;
    const chan = [];
    for (let c = 0; c < out.numberOfChannels; c++) {
      let p = 0;
      for (const x of out.getChannelData(c)) {
        p = Math.max(p, Math.abs(x));
        sum += x * x;
        if (Math.abs(x) >= 1) clipped++;
      }
      chan.push(p);
      peak = Math.max(peak, p);
    }
    return {
      cues: cueNames.length,
      chan,
      samples: out.length * 2,
      peak,
      db: 20 * Math.log10(peak),
      clipped,
      rms: Math.sqrt(sum / (out.length * 2)),
    };
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.clipped || !result.peak) throw Error('Invalid audio mix.');
} finally {
  await browser.close();
}
