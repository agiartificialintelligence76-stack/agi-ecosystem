import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRun,setLane,hold,launch,tick,deck,crossing,sweptParcel,solution,STEP} from '../src/games/cloudfoil/flight.js';
import {survey,flightDirector,pilots} from '../src/games/cloudfoil/pilot.js';
import {fileCard,routes,shelf,weather} from '../src/games/cloudfoil/routes.js';
import {lines} from '../src/games/cloudfoil/lines.js';
import {cues} from '../src/games/cloudfoil/sound.js';
import game from '../src/games/cloudfoil/game.js';
const body=(x,y,z=0)=>({x,y,z});
const wing=(y=0,slope=0)=>({x:2,y,z:0,half:.5,slope});
test('swept touchdown follows the top of a rising or falling tilted deck',()=>{
 for(const [a,b] of [[-.2,.1],[.2,-.1]])assert.ok(crossing(body(2,.65),body(2,-.5),wing(a,.2),wing(b,.2)));
 assert.equal(crossing(body(2,-.3),body(2,.3),wing(),wing()),null);
 assert.equal(crossing(body(2,.3,.5),body(2,-.3,.5),wing(),wing()),null);
 assert.equal(crossing(body(2.51,.3),body(2.51,-.3),wing(),wing()),null);
 assert.ok(crossing(body(2.5,.3),body(2.5,-.3),wing(),wing()));
});
test('parcel sensors see high-speed contacts and respect the third axis',()=>{
 const parcel={x:2,y:1,z:0,radius:.15};
 assert.ok(sweptParcel(body(-3,1),body(5,1),parcel));
 assert.equal(sweptParcel(body(-3,1,1),body(5,1,1),parcel),false);
});
test('a parcel touching the deck scores before touchdown exactly once',()=>{
 const s=makeRun(4);s.dest={...s.dest,x:1,y:0,z:0,amp:0,slope:0,bank:0,half:1};s.letter={x:1,y:.02,z:0,radius:.08,taken:false};
 Object.assign(s,{phase:'air',x:1,y:.04,z:0,vx:0,vy:-4});
 tick(s,.02);assert.deepEqual(s.events.slice(0,2),['parcel','center']);assert.equal(s.delivered,1);
 const score=s.score;tick(s,STEP);assert.equal(s.score,score);
});
test('mail below a wing cannot be collected after touchdown in the same timestep',()=>{
 const s=makeRun(4);s.dest={...s.dest,x:1,y:0,z:0,amp:0,bank:0,half:1};s.letter={x:1,y:-.25,z:0,radius:.05};
 Object.assign(s,{phase:'air',x:1,y:.04,z:0,vx:0,vy:-6});tick(s,.075);assert.equal(s.letters,0);assert.equal(s.delivered,1);
});
test('a whole missed wing spends a chute and the third opening ends a run',()=>{
 const s=makeRun();
 for(let i=0;i<3;i++){
  hold(s);launch(s);
  for(let j=0;j<400&&(s.phase!=='deck'||j===0)&&!s.ended;j++)tick(s);
  assert.equal(s.chutes,2-i);
 }
 assert.ok(s.ended);assert.equal(s.delivered,0);
});
test('each of the 18 manifests is individually authored, distinct and flyable in both directions',()=>{
 assert.equal(new Set(routes.map(r=>r.legs)).size,18);assert.ok(routes.every(r=>r.turn>=9&&r.turn<r.legs.length));
 for(const r of routes){
  const run=survey(37+r.id,'courier','post',r.id);assert.equal(run.cards,r.legs.length,r.name);assert.equal(run.saves,0,r.name);
 }
});
test('the instrument pilot flies 256 independent endless receivers with actual charged launches',()=>{
 for(let seed=0;seed<8;seed++){
  const flight=survey(seed,'courier','red',0,32);
  assert.equal(flight.cards,32);assert.equal(flight.saves,0);
 }
});
test('fresh routes differ, seed replay preserves physical timestamps, score and chute reasons',()=>{
 for(const seed of [3,33])assert.deepEqual(survey(seed,'steady'),survey(seed,'steady'));
 assert.notDeepEqual(survey(3,'steady'),survey(33,'steady'));
 assert.deepEqual(weather(7,'daily',routes[0],5),weather(7,'daily',routes[0],5));
 assert.notDeepEqual(weather(8,'daily',routes[0],5),weather(7,'daily',routes[0],5));
});
test('adjusting depth in flight changes physical position and charging bends before launch',()=>{
 const s=makeRun();assert.ok(hold(s));for(let i=0;i<54;i++)tick(s);assert.ok(s.charge>.3&&s.charge<.5);
 const x=s.x;setLane(s,1);assert.ok(launch(s));assert.equal(launch(s),false);tick(s);assert.ok(s.x>x&&s.z>0&&s.z<1);
 assert.ok(solution(s)>=0&&solution(s)<=1);assert.ok(Number.isFinite(deck(s.origin,s.t).slope));
});
test('first class produces a stamp on the fourth center, and red-eye dispatch ends for late boarders',()=>{
 const s=makeRun(1,'red'),driver=flightDirector(pilots.courier,1);
 for(let i=0;i<5000&&s.delivered<4;i++){driver(s);tick(s);}
 assert.ok(s.events.includes('firstclass'));assert.equal(s.chain,4);
 for(let i=0;i<5000&&!s.ended;i++)tick(s);assert.equal(s.cause,'late');assert.ok(s.ended);
});
test('daily ends at fifteen deliveries, saves retain earlier high grades and unrelated data',()=>{
 const run=survey(20261118,'courier','daily');assert.equal(run.cards,15);assert.ok(run.ended);
 const before={other:true},high=fileCard(before,3,3,1200),again=fileCard(high,3,1,17);
 assert.equal(before.wingwalk,undefined);assert.equal(again.other,true);assert.deepEqual(shelf(again)[3],{grade:3,score:1200});
});
test('cancelling a charge on pause or pointer interruption never releases a jump',()=>{
 for(const type of ['key','pointer']){
  let current,said=[];const model=game.create({seed:7,mode:'post',hud:(...a)=>current=a,say:s=>said.push(s),end(){}});
  if(type==='key')model.key('down','Space');else model.pointer('down',0,0);
  for(let i=0;i<65;i++)model.update(STEP);
  model.cancelInput();model.pause();model.resume();
  if(type==='key')model.key('up','Space');else model.pointer('up',0,0);
  for(let i=0;i<160;i++)model.update(STEP);
  assert.ok(!said.includes(lines.launch));assert.equal(current[1],0);
 }
});
test('the same opening delivery works with a held key and a held sky gesture, and files a real score',()=>{
 for(const type of ['pointer','key']){
  let score,ending,uses=0;const model=game.create({seed:7,hud(){},end:(s,stats)=>{score=s;ending=Object.fromEntries(stats);uses++;}});
  const press=p=>type==='pointer'?model.pointer(p,100,80,360,440):model.key(p,'Space');
  press('down');for(let i=0;i<68;i++)model.update(STEP);press('up');
  for(let i=0;i<180;i++)model.update(STEP);
  model.action('file','down');model.action('file','down');assert.ok(score>=65);assert.equal(ending.Handoffs,1);assert.equal(uses,1);
 }
});
test('the flight deck has distinct action voices and contextual lowercase dialogue',()=>{
 assert.ok(Object.keys(cues).length>=16);assert.ok(Object.keys(lines).length>=30);
 assert.ok(Object.values(lines).every(line=>line===line.toLowerCase()));
});
