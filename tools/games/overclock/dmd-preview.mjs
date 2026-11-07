// OVERCLOCK: the dot-matrix display's scenes as one big picture (for looking at the pixel art).
// node tools/games/overclock/dmd-preview.mjs out.json && python3 tools/games/overclock/dmd-png.py out.json out.png
import { writeFileSync } from 'node:fs';
import * as D from '../../../src/games/overclock/dmd.js';
import { MISSIONS } from '../../../src/games/overclock/rules.js';
const st = { score: 1284350, ball: 2, balls: 3, bonusX: 3, heat: 64, overclock: 0, agi: 0, multiball: false, jackpot: 500000, mission: MISSIONS[1], progress: 7, missionShow: true };
const frames = [];
const shot = (name, setup, t = 0.6, extra = {}) => { const d = D.createDMD(); setup?.(d); D.update(d, t); D.draw(d, { ...st, ...extra }); frames.push({ name, buf: Array.from(d.buf) }); };
for (const e of Object.keys(D.EXPRESSIONS)) shot(`face ${e}`, (d) => D.mood(d, e, 9));
shot('idle hot', null, 0.5, { overclock: 12, heat: 100 });
shot('multiball slam', (d) => D.show(d, 'multiball'), 0.3);
shot('multiball', (d) => D.show(d, 'multiball'), 1.8);
shot('jackpot', (d) => D.show(d, 'jackpot', { pts: 650000 }), 0.25);
shot('jackpot 2', (d) => D.show(d, 'jackpot', { pts: 650000 }), 1.5);
shot('overclock', (d) => D.show(d, 'overclock'), 1.0);
shot('mission', (d) => D.show(d, 'mission', { mission: MISSIONS[1] }), 1.2);
shot('missionDone', (d) => D.show(d, 'missionDone', { pts: 150000, wizard: 3 }), 0.5);
shot('agi', (d) => D.show(d, 'agi'), 1.6);
shot('drain', (d) => D.show(d, 'drain'), 0.8);
shot('bonus', (d) => D.show(d, 'bonus', { bonus: { lines: [{ label: 'RAMPS', n: 3, pts: 30000 }], sub: 50000, x: 3, total: 150000 } }), 0.5);
shot('bonus total', (d) => D.show(d, 'bonus', { bonus: { lines: [{ label: 'RAMPS', n: 3, pts: 30000 }], sub: 50000, x: 3, total: 150000 } }), 1.2);
shot('lane', (d) => D.show(d, 'lane', { ram: [true, false, true], lane: 2 }), 0.3);
shot('attract', null, 4.0, { attract: true, best: 2450000 });
shot('lock', (d) => D.show(d, 'lock', { n: 1 }), 0.4);
shot('over', (d) => D.show(d, 'over', { score: 3456780 }), 0.4);
writeFileSync(process.argv[2] || 'dmd.json', JSON.stringify({ w: D.DW, h: D.DH, frames }));
