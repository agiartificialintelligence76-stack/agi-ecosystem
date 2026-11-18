import test from 'node:test';
import assert from 'node:assert/strict';
import candids from '../src/games/mothlight/game.js';
import { project, focusQuality, blockedBy } from '../src/games/mothlight/camera.js';
import sticker, { proofGrade } from '../src/games/nightpress/game.js';
import boba, { taste } from '../src/games/cloudkitchen/game.js';
import railway, { departures, quickest } from '../src/games/pocketgrove/game.js';

function play(game, seed=17){
 let hud, result, ends=0;
 const model=game.create({
  rng(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},
  hud(...values){hud=values;},sound(){},haptic(){},
  end(score,rows,line){ends++;result={score,stats:Object.fromEntries(rows),line};},
 });
 return {model,get hud(){return hud;},get result(){return result;},get ends(){return ends;},
  wait(sec,automatic=false){for(let k=0;k<Math.ceil(sec*60);k++){if(automatic)model.demo(1/60);model.update(1/60);}},
  key(k){model.key('down',k);model.key('up',k);},
  tap(x,y){model.pointer('down',x,y);model.pointer('up',x,y);},
 };
}
for(const game of [candids,sticker,boba,railway]){
 test(game.title+' can finish a repeatable full run from the real inputs used by its demo',()=>{
  const a=play(game),b=play(game);a.wait(130,true);b.wait(130,true);
  assert.equal(a.ends,1);assert.ok(a.result.score>0);assert.deepEqual(a.result,b.result);
 });
}
test('Candid Camera rewards a framed pose and correct focal length, and expires missed frames',()=>{
 const a=play(candids),b=play(candids);
 a.wait(115,true);b.wait(115);
 assert.equal(a.result.stats['Cover shots'],'6 / 6');assert.equal(b.result.score,0);
 const c=play(candids);c.key('Digit3');c.tap(379,433);c.wait(1.3);assert.equal(c.hud[1],'2/6');assert.ok(c.hud[3]>0);
});
test('Candid Camera gives the foreground faster parallax and allows physically stepping around a post',()=>{
 const camera={x:0,y:1.4},other={x:.4,y:1.4};
 const near={x:1,y:1.5,z:2},far={...near,z:8};
 assert.equal(project(near,camera,1).scale/project(far,camera,1).scale,4);
 assert.equal((project(near,camera,1).x-project(near,other,1).x)/(project(far,camera,1).x-project(far,other,1).x),4);
 const post=[{x:.25,z:2,h:2,radius:.06}];assert.ok(blockedBy(far,camera,post));assert.equal(blockedBy(far,other,post),false);
 assert.ok(focusQuality(2.4,0,2)>.95);assert.ok(focusQuality(2.4,2,2)<.15);
});
test('Candid Camera touch and keyboard focus dials change shutter scores independently of the lens',()=>{
 const inFocus=play(candids),softTouch=play(candids),softKeys=play(candids);
 softTouch.tap(220,435);softKeys.key('KeyE');
 for(const run of [inFocus,softTouch,softKeys])run.tap(379,433);
 assert.ok(inFocus.hud[3]>softTouch.hud[3]);assert.equal(softTouch.hud[3],softKeys.hud[3]);
});
test('Sticker Club grades placement, angle and layer order separately and refuses incomplete covers',()=>{
 const targets=[[100,160,-1],[265,215,1],[315,167,0]],pieces=targets.map(([x,y,rot])=>({x,y,rot}));
 assert.deepEqual(proofGrade(pieces,targets,[0,1,2],2),{alignment:60,angle:24,top:16});
 pieces[0].x+=42;pieces[1].rot=-1;const messy=proofGrade(pieces,targets,[2,0,1],2);
 assert.ok(messy.alignment<60);assert.ok(messy.angle<24);assert.equal(messy.top,0);
 const a=play(sticker);a.key('Space');a.wait(2);assert.equal(a.hud[1],'1/4');
 for(let i=0;i<3;i++){a.tap(37+i*85,440);a.tap(100+i*110,243);a.key('KeyE');}a.tap(405,436);a.wait(1.8);assert.equal(a.hud[1],'2/4');assert.ok(a.hud[3]>0);
});
test('Boba Break scores the actual liquid and topping counts and both input paths can pour and serve',()=>{
 const recipe={tea:4,milk:4,pearls:2,star:1},order={pearls:2,star:1,ice:0};assert.equal(taste(4,4,order,recipe),100);assert.equal(taste(0,0,order,recipe),0);assert.ok(taste(6,2,{...order,ice:2},recipe)<60);
 const a=play(boba);a.model.pointer('down',74,438);a.wait(1.6);a.model.pointer('up',74,438);a.model.key('down','KeyD');a.wait(1.6);a.model.key('up','KeyD');a.key('Space');a.wait(3);a.tap(391,438);a.wait(1.6);
 assert.equal(a.hud[1],'2/4');assert.ok(a.hud[3]>=37);
});
test('Window Seat charges for transfers, chooses a usable express leg and finishes seeded train schedules',()=>{
 assert.equal(departures(2,0).find(g=>g.to===5).cost,3);
 assert.equal(departures(2,1).find(g=>g.to===5).cost,2);
 const base=quickest(0,-1,[7,3],false),express=quickest(0,-1,[7,3],true);assert.ok(express.cost<base.cost);
 const a=play(railway);const before=parseInt(a.hud[3]);a.tap(391,81);a.key('Digit1');a.wait(.7);assert.equal(parseInt(a.hud[3]),before-1);
 for(const seed of [1,4,17,31,78]){const p=play(railway,seed);p.wait(90,true);assert.equal(p.result.stats['Made it home'],'3 / 3');assert.equal(p.result.stats['Ticket stamps'],'6 / 6');}
});
