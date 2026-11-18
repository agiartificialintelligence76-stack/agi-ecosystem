import test from 'node:test';
import assert from 'node:assert/strict';
import game,{compactDuet} from '../src/games/driftglass/game.js';
import {configuration,createDuel,tick,DT,drain,radio,aim,useBoost,closeRound,scoreFor} from '../src/games/driftglass/duel.js';
import {view,project,inverse,swept,canLink,safeLanes,newWave,DISTRICTS,LANES,X_LIMIT,Z_MIN,Z_MAX} from '../src/games/driftglass/road.js';
import {makeDriver} from '../src/games/driftglass/drivers.js';
import {MEETS,RIVALS} from '../src/games/driftglass/rivals.js';
import {readLibrary,saveResult,selection,DECKS} from '../src/games/driftglass/library.js';
import {CUES,radioSound} from '../src/games/driftglass/sound.js';
import {LINES} from '../src/games/driftglass/lines.js';
import {runProfile} from '../tools/games/driftglass/balance.mjs';

const fresh=(mode='check',seed=7)=>createDuel(configuration(mode,0,seed));
function align(s,owner=1){
 s.owner=owner;s.lock=0;s.released=true;s.traffic=[];s.nextTraffic=99;
 for(let i=0;i<2;i++){Object.assign(s.cars[i],{x:i*.7-.35,z:2,vx:0,vz:0,targetX:i*.7-.35,targetZ:2,stun:0});}
}
function advance(s,sec){for(let i=0;i<Math.round(sec/DT);i++)tick(s,DT);}
function harness(options={}){
 let raw=options.raw||{},writes=0;const voice=[],huds=[],end=[],controls=[];
 const model=game.create({mode:'check',seed:7,...options,store:{read:()=>raw,update(fn){writes++;raw=fn(raw);return raw;}},
  say:v=>voice.push(v),hud:(...v)=>huds.push(v),end:(...v)=>end.push(v),controls:v=>controls.push(v)});
 return {model,end,voice,huds,controls,get raw(){return raw;},get writes(){return writes;},wait(sec){for(let i=0;i<sec*120;i++)model.update(DT);},
  action(id){model.action(id,'down');model.action(id,'up');},key(code){model.key('down',code);model.key('up',code);}};
}
test('six named rivals, twelve authored matches, four districts and more than thirty unique contextual lines',()=>{
 assert.equal(MEETS.length,12);assert.equal(new Set(MEETS.map(m=>m.title)).size,12);assert.equal(new Set(RIVALS.map(r=>r.style)).size,6);
 assert.equal(DISTRICTS.length,4);assert.equal(new Set(MEETS.map(m=>m.rival)).size,6);assert.ok(new Set(Object.values(LINES).flat()).size>60);
});
test('physical depth projection and touch inverse agree for every lane, camera size, curve and gameplay depth',()=>{
 for(const size of [[360,640],[640,360],[884,1104],[1440,900],[2560,1440]]){
  const v=view(...size);for(let district=0;district<4;district++)for(const z of [.4,1.7,3.74,8])for(const x of LANES){
   const p=project(v,x,z,0,42,district),q=inverse(v,p.x,p.y,42,district);
   assert.ok(Math.abs(x-q.x)<1e-9&&Math.abs(z-q.z)<1e-9);
   assert.ok(project(v,x,z+1).s<p.s);
  }
 }
});
test('physical positions have bounded acceleration, no teleports, and hard road limits',()=>{
 const s=fresh();aim(s,0,100,-100);assert.equal(s.cars[0].targetX,X_LIMIT);assert.equal(s.cars[0].targetZ,Z_MIN);
 for(let t=0;t<240;t++){const c=s.cars[0],x=c.x,z=c.z;tick(s,DT);assert.ok(Math.abs(c.x-x)<=2.29*DT&&Math.abs(c.z-z)<3.7*DT);}
 assert.ok(s.cars[0].z>=Z_MIN&&s.cars[0].x<=X_LIMIT);
});
test('a deliberate snatch needs two level unobstructed doors and a full visible tell',()=>{
 const s=fresh();align(s);assert.ok(canLink(s));assert.ok(radio(s,0));assert.equal(s.owner,1);advance(s,.4);assert.ok(s.pending&&s.cars[0].signal>0);
 advance(s,.53);assert.equal(s.owner,0);assert.equal(s.stats[0].steals,1);assert.ok(s.handoff);
});
test('a blocking van, stacked cars, separated doors or a stunned car prevents transfer',()=>{
 const s=fresh();align(s);s.traffic=[{kind:'van',x:0,z:2,width:.24}];assert.equal(canLink(s),false);assert.equal(radio(s,0),false);s.traffic=[];
 s.cars[0].x=s.cars[1].x;assert.equal(canLink(s),false);align(s);s.cars[0].z=Z_MAX;assert.equal(canLink(s),false);
 align(s);s.cars[1].stun=.1;assert.equal(canLink(s),false);
});
test('one physical overlap permits one transfer, separating and returning restores a legal challenge',()=>{
 const s=fresh();align(s);radio(s,0);advance(s,4.3);assert.equal(s.owner,0);assert.equal(s.released,false);assert.equal(radio(s,1),false);
 aim(s,1,1.48,3.6);advance(s,1.25);assert.ok(s.released);align(s,0);assert.ok(radio(s,1));advance(s,1);assert.equal(s.owner,1);
});
test('simultaneous snatch and defend have the same physical outcome under either dispatch order',()=>{
 for(const seq of [[0,1],[1,0]]){
  const s=fresh();align(s);for(const i of seq)radio(s,i);advance(s,.15);
  assert.equal(s.owner,1);assert.equal(s.stats[1].blocks,1);assert.equal(s.stats[0].steals,0);assert.equal(s.pending,null);
 }
});
test('jamming early expires, a shoulder feint breaks an actual warning, and neither gives a free steal',()=>{
 const s=fresh();align(s);radio(s,1);advance(s,.84);assert.equal(s.cars[1].jam,0);assert.ok(s.cars[1].jamCool>0);
 radio(s,0);advance(s,1);assert.equal(s.owner,0);
 const q=fresh();align(q);radio(q,0);aim(q,1,1.52,3.75);advance(q,1);assert.equal(q.owner,1);assert.equal(q.stats[1].breaks,1);
});
test('charge builds in an actual slipstream, boost consumes it exactly once, and near passes count once',()=>{
 const s=fresh();align(s);Object.assign(s.cars[1],{x:s.cars[0].x,z:2.85,targetX:s.cars[0].x,targetZ:2.85});advance(s,2.15);
 assert.equal(s.cars[0].charge,1);assert.ok(useBoost(s,0));assert.equal(useBoost(s,0),false);assert.equal(s.stats[0].boosts,1);
 const q=fresh();align(q);q.traffic=[{id:1,kind:'cone',x:q.cars[0].x+.43,z:2.7,width:.2,speed:1,near:[false,false],hit:[false,false],pass:[false,false]}];
 advance(q,2);assert.equal(q.stats[0].near,1);assert.equal(q.stats[0].hits,0);advance(q,1);assert.equal(q.stats[0].near,1);
});
test('swept contact catches a car crossed between samples; an unrelated lane is safe',()=>{
 const a={x:0,z:2,prevX:0,prevZ:2},o={x:0,z:1.1,width:.22};
 assert.equal(swept(a,'hit',o,2),true);assert.equal(swept({...a,x:1,prevX:1},'hit',o,2),false);
});
test('roadworks leave a visibly reachable escape lane for both drivers using their acceleration envelope',()=>{
 for(let seed=1;seed<60;seed++){const s=fresh('marathon',seed);s.level=11;
  for(let j=0;j<45;j++){s.cars[0].x=LANES[j%4];s.cars[1].x=LANES[(j+2)%4];s.cars[0].vx=j%2?1.8:-1.8;
   const wave=newWave(s);if(!wave.length)continue;const lanes=safeLanes(s.cars,wave[0].z,wave[0].speed,wave.map(x=>x.lane));assert.ok(lanes.every(l=>l.length));}
 }
});
test('two local seats have equivalent steering, steal geometry and airtime when swapped',()=>{
 const vals=[];
 for(const seat of [0,1]){const s=fresh('local');align(s,1-seat);radio(s,seat);advance(s,1.04);assert.equal(s.owner,seat);
  const other=s.cars[1-seat];aim(s,1-seat,other.x,3.65);advance(s,1.3);vals.push([s.stats[seat].steals,Math.round(s.stats[seat].air*100),scoreFor(s,seat)]);}
 assert.deepEqual(vals[0],vals[1]);
});
test('bounded sudden death is decided by uninterrupted airtime; no tied round hangs',()=>{
 const s=fresh('local');align(s,0);s.roundTime=s.target*1.82+2.15;s.air=[8.01,8];tick(s);assert.equal(s.sudden,true);advance(s,1.6);
 assert.equal(s.phase,'break');assert.equal(s.record[0].winner,0);
});
test('best-of-three takes two wins and records both air clocks for each round',()=>{
 const s=fresh('ladder');closeRound(s,0);advance(s,1.56);closeRound(s,1);advance(s,1.56);closeRound(s,0);
 assert.deepEqual(s.wins,[2,1]);assert.equal(s.record.length,3);assert.equal(s.ended,true);assert.equal(s.winner,0);
});
test('daily fixes three distinct hands, road and opponent, without using campaign unlocks',()=>{
 const c=configuration('daily',11,20261118);assert.deepEqual(c,configuration('daily',0,20261118));assert.notDeepEqual(c.hands,configuration('daily',0,20261119).hands);
 const s=createDuel(c);for(let i=0;i<3;i++){assert.equal(s.cars[0].charge,c.hands[i].charge);advance(s,2.2);assert.equal(s.owner,c.hands[i].first);if(i<2){closeRound(s,i);advance(s,1.52);}}
});
test('AI rivals and player use legal telegraphed inputs, and repeat identical same-seed outcomes on phone and desktop',()=>{
 const a=runProfile('steady',7,'ladder',0,[360,640]),b=runProfile('steady',7,'ladder',0,[1440,900]);assert.deepEqual(a,b);
 assert.ok(a.events.tell>=a.changes&&a.steals>0&&a.share>0);
});
test('the six rival personalities produce different actual trajectories; Blink really feints',()=>{
 const logs=[];let bluffs=0;
 for(let r=0;r<6;r++){const s=createDuel(configuration('ladder',r,18));const a=makeDriver('expert',0,18),b=makeDriver('rival',1,18);let signature='';
  for(let i=0;i<7800&&!s.ended;i++){a.think(s,DT);b.think(s,DT);tick(s);if(i%600===0)signature+=s.cars[1].x.toFixed(2)+'/';drain(s);}
  logs.push(signature);if(r===2)bluffs=b.log.bluffs;
 }
 assert.equal(new Set(logs).size,6);assert.ok(bluffs>0);
});
test('earned sleeves, defensive deck paint and the championship next/retry distinction survive reload',()=>{
 let raw={older:9};for(let i=0;i<12;i++){
  const s=createDuel(configuration('ladder',i,91+i));s.winner=0;s.stats[0].blocks=1;s.stats[0].longest=11.5;
  raw={...raw,bandit:saveResult(raw,s,100,'')};
  assert.ok(raw.bandit.wins[i]);assert.equal(selection(raw.bandit,'next',91+i),i);
 }
 assert.equal(raw.older,9);assert.equal(raw.bandit.sleeves.length,6);assert.equal(DECKS.filter(p=>p.blocks<=raw.bandit.blocks).length,3);
 const clean=readLibrary({bandit:{wins:[false,true,true],blocks:'bad',daily:4}});assert.equal(clean.unlocked,0);assert.equal(clean.blocks,0);assert.equal(clean.daily,null);
});
test('normal keyboard run scores from a real steal, canceled controls release, chart and pause freeze clocks',()=>{
 const h=harness();h.wait(3.25);h.key('Space');h.wait(1);h.action('chart');const before=h.huds.at(-1);h.wait(1);assert.deepEqual(h.huds.at(-1),before);
 h.action('chart');h.model.pause();h.wait(1);h.model.resume();h.model.cancelInput();h.wait(32);
 assert.equal(h.end.length,1);assert.ok(h.end[0][0]>=140);assert.ok(h.raw.bandit.longest>2);assert.equal(h.writes,1);
});
test('duet offers two independent keyboard/touch seats on wide screens and two identical heats on a compact phone',()=>{
 assert.ok(compactDuet(360,640));assert.equal(compactDuet(1440,900),false);
 const wide=harness({mode:'local',compact:false});const ids=wide.controls.at(-1).map(a=>a.id);assert.ok(ids.includes('rose-radio')&&ids.includes('mint-boost'));
 wide.model.action('mint-left','down');wide.model.action('rose-right','down');wide.wait(.2);wide.model.cancelInput();wide.key('Enter');
 const phone=harness({mode:'local',compact:true});phone.wait(70);assert.ok(phone.controls.at(-1).some(d=>d.id==='handoff'));
 assert.equal(phone.end.length,0);phone.key('Enter');phone.wait(70);assert.equal(phone.end.length,1);const stats=Object.fromEntries(phone.end[0][1]);
 assert.equal(stats['Mint score'],stats['Rose score']);assert.equal(phone.writes,0);
});
test('demo shows a legal tape crossing then an honest headlight counter in the preview interval and never saves',()=>{
 const s=fresh(),demo=makeDriver('demo',0,7),rival=makeDriver('rival',1,7),events=[];for(let i=0;i<1500;i++){demo.think(s,DT);rival.think(s,DT);tick(s);events.push(...drain(s));}
 assert.ok(events.some(e=>e.kind==='steal'&&e.who===0&&e.at>5.7&&e.at<8));assert.ok(events.some(e=>e.kind==='tell'&&e.who===1&&e.at<11.7));
 const g=harness({demo:true});g.wait(65);assert.equal(g.writes,0);
});
test('audio separates music and action, suppresses repeats while paused, and demo remains silent',()=>{
 const out=[],a={tone:o=>out.push(o),noise:o=>out.push(o)},snd=radioSound(a),s=fresh();align(s);
 for(const [i,k] of CUES.entries())snd.play(k,i*2);snd.update(s);assert.ok(out.some(o=>o.bus==='music')&&out.some(o=>o.bus==='sfx'));
 const n=out.length;snd.pause();snd.play('steal',200);snd.update(s);assert.equal(out.length,n);snd.resume();snd.play('steal',201);assert.ok(out.length>n);
 const after=out.length;radioSound(a,true).play('steal',300);assert.equal(out.length,after);
});
