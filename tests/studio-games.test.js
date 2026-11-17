import test from 'node:test';
import assert from 'node:assert/strict';
import { rng } from '../src/games/kit/fx.js';
import wax, { profiles } from '../src/games/waxworks/game.js';
import fish, { project } from '../src/games/lanternlake/game.js';
import court from '../src/games/returnaddress/game.js';
import sky, { projectStar } from '../src/games/starlingrelay/game.js';

function start(game, seed=7) {
  let hud, result;
  const model = game.create({ rng:rng(seed).next, hud:(...v)=>{hud=v;}, end:(...v)=>{result=v;}, sound(){}, haptic(){} });
  const step=(seconds, auto=false)=>{
    for(let i=0; i<seconds*120 && !result; i++){if(auto)model.demo(1/120);model.update(1/120);}
  };
  return { model, step, get metrics(){return hud;}, get result(){return result;} };
}
test('the cast reproduces both independent projections and all six commissions are solvable',()=>{
  assert.deepEqual(profiles([[1,3],[2,0]]),{front:[2,3],side:[3,2]});
  for(const seed of [1,7,22]) {const g=start(wax,seed);g.step(120,true);assert.ok(g.result[0]>500);assert.equal(g.result[1][0][1],6);}
});
test('lantern lake gives six casts, fish nearer the dock project larger, and missed hooks consume a cast',()=>{
  assert.ok(project(10,.1).zoom>project(10,2).zoom);
  const g=start(fish);
  for(let i=0;i<6;i++){g.model.key('down','Space');g.model.key('up','Space');g.step(10);}
  assert.equal(g.result[0],0);
  const auto=start(fish);auto.step(120,true);assert.equal(auto.result[1][0][1],'6 / 6');
});
test('mail court serves by pointer and loses unreturned parcels',()=>{
  const g=start(court);
  for(let i=0;i<3;i++){g.model.pointer('down',240,218);g.step(.4);g.model.pointer('move',460,352);g.step(5);g.model.pointer('move',240,218);g.step(1);}
  assert.equal(g.metrics[3],0);assert.ok(g.result);
  const bot=start(court);bot.step(60,true);assert.ok(bot.metrics[1]>0);
});
test('observatory centers the tracked star across the right ascension seam and exposes six plates',()=>{
  assert.deepEqual(projectStar(.1,.1,.1,.1).map(Math.round),[240,202]);
  assert.ok(Math.abs(projectStar(-3.13,0,3.13,0)[0]-240)<15);
  const idle=start(sky);idle.step(92);assert.equal(idle.result[0],0);
  const bot=start(sky);bot.step(90,true);assert.equal(bot.result[1][0][1],'6 / 6');
});
