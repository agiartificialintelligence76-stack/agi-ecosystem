// LAST MODEL STANDING: a balance run without a browser. The demo's AI plays whole runs (a decent card pick, no Patch shop)
// and this prints, minute by minute, her level, kills, the bots alive, her HP, and when the bosses fell, so the pacing can
// be tuned with numbers. Run: node tools/games/lastmodel/balance.mjs [seeds=3] [minutes=11] [view=phone|desk]
import { createSim, STEP, EV, topWeapon } from '../../../src/games/lastmodel/sim.js';
import { createAI, pickSmart } from '../../../src/games/lastmodel/ai.js';
import { fmtTime } from '../../../src/games/kit/fx.js';

const seeds = Number(process.argv[2] || 3), mins = Number(process.argv[3] || 11);
const view = process.argv[4] === 'desk' ? { hw: 360, hh: 225 } : { hw: 130, hh: 281 };
const god = process.argv.includes('god');
for (let s = 1; s <= seeds; s++) {
  const sim = createSim({ seed: s * 101, view, god });
  const ai = createAI({ spin: s % 2 ? 1 : -1 });
  const log = [];
  let nextMark = 30, bossT = {}, maxAlive = 0, hurt = 0, levelUps = [];
  const t0 = performance.now();
  const owned = new Float64Array(8);
  const WIDS = ['bolt', 'firewall', 'stream', 'rain', 'heads', 'backprop', 'field', 'nova'];
  while (sim.t < mins * 60 && !(sim.player.dead && sim.player.deadT > 1)) {
    if (sim.choosing) { sim.choose(pickSmart(sim.offers, sim.loadout)); continue; }
    if (sim.winPause) sim.resumeAfterWin();
    const [mx, my] = ai.move(sim, STEP);
    sim.update(STEP, mx, my);
    for (let i = 0; i < sim.nev; i++) {
      const e = sim.events[i];
      if (e.type === EV.BOSS) bossT[e.s] = { at: sim.t };
      if (e.type === EV.BOSSDOWN) bossT[e.s].down = sim.t;
      if (e.type === EV.HURT) hurt += e.a;
      if (e.type === EV.LEVEL) levelUps.push(Math.round(sim.t));
    }
    sim.consume();
    maxAlive = Math.max(maxAlive, sim.en);
    for (let w = 0; w < 8; w++) if (sim.loadout.weapons[WIDS[w]]) owned[w] += STEP;
    if (sim.t >= nextMark) {
      log.push(`${fmtTime(sim.t)} lv${sim.player.level} kills ${sim.kills} alive ${sim.en} hp ${Math.round(sim.player.hp)}/${sim.player.maxHp} gems ${sim.gn} W:${Object.entries(sim.loadout.weapons).map(([k, v]) => `${k}${v}`).join(',')} P:${Object.entries(sim.loadout.passives).map(([k, v]) => `${k}${v}`).join(',')}`);
      nextMark += 30;
    }
  }
  const ms = performance.now() - t0;
  console.log(`\n=== seed ${s * 101}: ${sim.player.dead ? 'DIED' : 'ALIVE'} at ${fmtTime(sim.t)} · level ${sim.player.level} · kills ${sim.kills} · damage taken ${Math.round(hurt)} · max alive ${maxAlive} · top ${topWeapon(sim)} · ${Math.round(ms)} ms`);
  console.log(`first level-ups at: ${levelUps.slice(0, 12).join(', ')}`);
  console.log('bosses:', JSON.stringify(Object.fromEntries(Object.entries(bossT).map(([k, v]) => [k, `${fmtTime(v.at)} → ${v.down ? fmtTime(v.down) + ` (${Math.round(v.down - v.at)} s)` : 'alive'}`]))));
  console.log(log.join('\n'));
  console.log('DPS while owned:', WIDS.map((id, i) => owned[i] ? `${id} ${Math.round(sim.dmgBy[i] / owned[i])}` : null).filter(Boolean).join(' · '));
}
