// I'M NOT A ROBOT: what the ?demo preview shows second by second (the recorder films 5.7 s to 11.7 s after the page
// opens). node tools/games/notarobot/demo-timeline.mjs [seed] [tempo] [passed] [startDelay]
import { CHECKS } from '../../../src/games/notarobot/checks/index.js';
import { Run } from '../../../src/games/notarobot/run.js';
import { createBot } from '../../../src/games/notarobot/bot.js';
const [seed = 7, tempo = 4, passed = 8, delay = 0.5] = process.argv.slice(2).map(Number);
const FIRST = (process.env.FIRST || 'odd,smile,cats,tick,dont,slide,findbot,type,turn,count,swat,hold').split(',');
const BL = (process.env.BLUNDER || '5').split(',').map(Number);
const run = new Run({ seed, checks: CHECKS, tempo, passed, score: 151, suspicion: 1, demo: true, first: FIRST, startDelay: delay });
const bot = createBot(seed, { blunders: (n) => BL.includes(n) });
const DT = 1 / 120;
let t = 0, last = '';
for (let k = 0; k < 120 * 14; k++) {
  bot.update(DT, run); run.update(DT); t += DT;
  for (const e of run.events) if (['pass', 'fail', 'tempo', 'bossIntro'].includes(e.type)) console.log(`${t.toFixed(2).padStart(6)}  ${e.type}${e.label ? ' ' + e.label : ''}`);
  run.events.length = 0;
  const now = `${run.phase}:${run.cur?.def.id ?? ''}`;
  if (now !== last) { console.log(`${t.toFixed(2).padStart(6)} ${t >= 5.7 && t <= 11.7 ? '*' : ' '} ${now}`); last = now; }
}
