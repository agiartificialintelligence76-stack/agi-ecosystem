import test from 'node:test';
import assert from 'node:assert/strict';
import detective, { program } from '../src/games/lanternlake/game.js';
import { CASES } from '../src/games/lanternlake/cases.js';
import { mountCorners } from '../src/games/lanternlake/exhibit.js';
import { rng } from '../src/games/kit/fx.js';

function run(game,seed=7){
  let result,hud;const records=new Map();
  const model=game.create({rng:rng(seed).next,sound(){},tone(){},haptic(){},hud:(...args)=>{hud=args;},end:(...args)=>{result=args;},
    rememberBest:(k,v)=>records.set(k,Math.max(v,records.get(k)||0))});
  function step(seconds,auto=false){for(let i=0;i<seconds*120&&!result;i++){if(auto)model.demo(1/120);model.update(1/120);}}
  return {model,step,records,get hud(){return hud;},get result(){return result;}};
}
test('a radio show draws four different cases; each statement and physical exhibit can be cross-checked',()=>{
 for(const seed of [1,7,61,93]){const show=program(rng(seed).next);assert.equal(show.length,4);assert.equal(new Set(show).size,4);}
 for(const c of CASES){assert.equal(c.statements.length,3);assert.equal(c.exhibits.length,3);assert.ok(c.statements[c.answer[0]]&&c.exhibits[c.answer[1]]);}
 assert.ok(mountCorners(Math.PI/2).every(([x])=>Math.abs(240-x)<.00001));
 assert.ok(mountCorners(0)[0][0]<mountCorners(Math.PI)[0][0]);
 const game=run(detective),press=k=>game.model.key('down',k);
 press('Space');press('Space');assert.equal(game.hud[3],'●●●','an unexamined exhibit cannot cost an audience light');
 press('KeyF');press('Space');
 const first=program(rng(7).next)[0];assert.equal(game.hud[3],first.answer.join()==='0,0'?'●●●':'●●');
});
for(const [game,expected,label] of [[detective,'4 / 4','Cases closed']]){
 test(game.title+' completes its authored campaign through its own game actions',()=>{
   for(const seed of [1,7,23,91]){const g=run(game,seed);g.step(210,true);assert.ok(g.result&&g.result[0]>0);
     assert.equal(g.result[1][0][0],label);if(expected!==null)assert.equal(g.result[1][0][1],expected);else assert.ok(g.result[1][0][1]>30);}
 });
}
