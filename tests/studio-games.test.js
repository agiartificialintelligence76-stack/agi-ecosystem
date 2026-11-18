import test from 'node:test';
import assert from 'node:assert/strict';
import detective, { program } from '../src/games/lanternlake/game.js';
import { CASES } from '../src/games/lanternlake/cases.js';
import { mountCorners } from '../src/games/lanternlake/exhibit.js';
import parcel from '../src/games/waxworks/game.js';
import { DEPOTS, startDepot, roll, route, delivered } from '../src/games/waxworks/parcel.js';
import vinyl from '../src/games/returnaddress/game.js';
import { pressRecord, judge, restoreTape } from '../src/games/returnaddress/record.js';
import theatre from '../src/games/starlingrelay/game.js';
import { SCENES, rehearsal, perform, solve, complete } from '../src/games/starlingrelay/blocking.js';
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
test('every parcel can be delivered upright, fragile pads reject a standing carton and a closed bridge cannot be crossed',()=>{
 for(const depot of DEPOTS){let state=startDepot(depot);const best=route(depot);assert.ok(best?.length>=4);
   for(const dir of best){state=roll(depot,state,dir);assert.ok(state);}assert.ok(delivered(depot,state));}
 const level={rows:['A##!G']};
 assert.equal(roll(level,roll(level,startDepot(level),'E'),'E'),null);
 const gate={rows:['A##=G']},lying=roll(gate,startDepot(gate),'E');
 assert.equal(roll(gate,lying,'E'),null);assert.ok(roll(gate,{...lying,bridge:true},'E'));
 const game=run(parcel);game.model.key('down','ArrowRight');game.step(.25);assert.equal(game.hud[3],1);
 game.model.key('down','KeyZ');assert.equal(game.hud[3],0);
});
test('cue strips are executable, rose collection precedes the bow, and the turntable rotates her on landing',()=>{
 for(const scene of SCENES){let state=rehearsal(scene);const sheet=solve(scene);assert.ok(sheet&&sheet.length<=scene.budget);
  for(const cue of sheet){state=perform(scene,state,cue);assert.ok(state);}assert.ok(complete(scene,state));}
 const scene=SCENES[3],s=perform(scene,rehearsal(scene),'LEAP');assert.equal(s.d,0);
 assert.equal(perform(SCENES[0],rehearsal(SCENES[0]),'LEFT').d,0);
 assert.equal(complete(SCENES[0],{...rehearsal(SCENES[0]),x:3}),false);
 const game=run(theatre);game.model.key('down','ArrowUp');game.model.key('down','Backspace');assert.match(game.hud[3],/^0\//);
});
test('vinyl scratches require a jump, pickups require the right groove, and backspins restore the earlier score exactly once',()=>{
 const record=pressRecord(rng(93).next);assert.equal(record.length,48);assert.ok(record.every((n,i)=>!i||record[i-1].time<n.time));
 assert.equal(judge({seam:true},2,false),'scratch');assert.equal(judge({seam:true},0,true),'clear');
 assert.equal(judge({lane:1},1,false),'groove');assert.equal(judge({lane:1},1,true),'miss');
 const before={score:60,streak:2,faults:0,rewinds:2};
 assert.deepEqual(restoreTape({...before,score:160,rewinds:1},[before],2),{...before,rewinds:0,at:0});assert.equal(restoreTape({rewinds:0},[before],1),null);
});
for(const [game,expected,label] of [[detective,'4 / 4','Cases closed'],[parcel,6,'Depots cleared'],[vinyl,null,'Stars caught'],[theatre,6,'Curtain calls']]){
 test(game.title+' completes its authored campaign through its own game actions',()=>{
   for(const seed of [1,7,23,91]){const g=run(game,seed);g.step(210,true);assert.ok(g.result&&g.result[0]>0);
     assert.equal(g.result[1][0][0],label);if(expected!==null)assert.equal(g.result[1][0][1],expected);else assert.ok(g.result[1][0][1]>30);}
 });
}
