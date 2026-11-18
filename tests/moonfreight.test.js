import test from 'node:test';
import assert from 'node:assert/strict';
import game from '../src/games/moonfreight/game.js';
import {ball,DT,R,copyBalls,impact,tick,journal,simulateShot,openSpot,respot,guide,dist} from '../src/games/moonfreight/physics.js';
import {ATLAS,rack,dailySet} from '../src/games/moonfreight/tables.js';
import {certificates,leaves} from '../src/games/moonfreight/atlas-book.js';
import {ruling,featMet,targets} from '../src/games/moonfreight/rules.js';
import {choose,seeded,placement,options} from '../src/games/moonfreight/ai.js';
import {layout} from '../src/games/moonfreight/render.js';
import {lines} from '../src/games/moonfreight/lines.js';
import {play} from '../tools/games/moonfreight/balance.mjs';
const close=(a,b,d=.00001)=>assert.ok(Math.abs(a-b)<d);
function session(mode='atlas',card=0,seed=7){
 let end,hud,pressed,storage={legacy:11},calls=0;
 const api={seed,mode,options:{card},end:(score,stats)=>{calls++;end={score,...Object.fromEntries(stats)};},hud:(...v)=>hud=v,controls:v=>pressed=v,store:{read:()=>storage,update:fn=>storage=fn(structuredClone(storage))}};
 const m=game.create(api);const key=k=>{m.key('down',k);m.key('up',k);},tap=id=>{m.action(id,'down');m.action(id,'up');};
 const advance=(secs,dt=DT)=>{for(let n=0;n<Math.ceil(secs/dt);n++)m.update(dt);};return {m,key,tap,advance,get storage(){return storage;},get end(){return end;},get calls(){return calls;},get buttons(){return pressed;}};
}
test('36 named atlas arrangements in six chapters all replay at shot par including the actual bank, combo, English and called finish',()=>{
 assert.equal(ATLAS.length,36);assert.equal(new Set(ATLAS.map(c=>c.name)).size,36);assert.ok(ATLAS.filter(c=>c.par>1).length>=16);
 for(const c of ATLAS){let balls=copyBalls(c.balls);const tape=certificates[c.id];assert.ok(tape.length<=c.par,c.name);
 for(const [i,shot] of tape.entries()){const a=simulateShot(balls,c.wells,shot),b=simulateShot(balls,c.wells,shot);assert.deepEqual(a,b,c.name);assert.ok(!a.log.pots.some(x=>!x.id),c.name);
 if(!i){assert.ok(featMet(c,shot,a.log),c.name);if(['follow','draw'].includes(c.feat))assert.ok(dist(a.balls[0].x,a.balls[0].y,...leaves[c.id])<=2);}
 balls=a.balls;}for(const id of [c.target,...c.extra])assert.ok(balls.find(b=>b.id===id).potted,c.name);}
});
test('fast crossing transfers momentum, resting overlap does not add energy, and zero distance remains finite',()=>{
 const a=ball(0,130,190,'cue'),b=ball(1,172,190);a.vx=8000;const l=journal();tick([a,b],[],l,DT);assert.equal(l.first,1);assert.ok(b.vx>7400&&a.vx<180);
 const x=ball(0,90,90),y=ball(1,109,90);x.vx=100;impact(x,y);close(x.vx+y.vx,100);assert.ok(y.vx>96&&x.vx<4);
 const o=ball(1,80,80),p=ball(2,80,80);assert.equal(impact(o,p),false);assert.ok(Number.isFinite(o.x)&&Math.hypot(o.x-p.x,o.y-p.y)>=2*R);
 const sep=ball(1,40,40),away=ball(2,59,40);sep.vx=-20;away.vx=20;assert.equal(impact(sep,away),false);assert.equal(sep.vx,-20);
});
test('rounded pocket jaw deflects a grazing ball and a high-speed centered mouth captures it',()=>{
 const jaw=ball(1,375,23);jaw.vy=-400;const l=journal();for(let i=0;i<12;i++)tick([jaw],[],l);assert.ok(l.rails.some(r=>r.side==='jaw'));assert.ok(!jaw.potted);
 const mid=ball(2,400,50);mid.vy=-1500;const k=journal();for(let i=0;i<10;i++)tick([mid],[],k);assert.deepEqual(k.pots,[{id:2,pocket:1}]);
});
test('cue English changes the post-contact leave, and all moving bodies stop on the felt',()=>{
 const balls=[ball(0,230,200,'cue'),ball(1,365,200)];const f=simulateShot(balls,[],{angle:0,power:.56,spin:.8}),d=simulateShot(balls,[],{angle:0,power:.56,spin:-.8});
 assert.ok(f.balls[0].x>d.balls[0].x+15);assert.ok([...f.balls,...d.balls].every(v=>v.vx===0&&v.vy===0));assert.equal(balls[0].x,230);
});
test('first object, cushion after contact, scratch priority and called moon decide the turn',()=>{
 const balls=rack(0).balls,moon=balls.at(-1).id;
 const stroke=(first,pots=[],rails=[])=>({first,pots,rails});
 assert.equal(ruling(balls,stroke(1,[],[{after:true}]),0,1).foul,'');assert.ok(!ruling(balls,stroke(1,[],[{after:true}]),0,1).keep);
 assert.equal(ruling(balls,stroke(1),0,1).foul,'no rail');assert.equal(ruling(balls,stroke(2),0,1).foul,'wrong');
 assert.equal(ruling(balls,stroke(1,[{id:1,pocket:1},{id:0,pocket:4}]),0,1).foul,'scratch');
 for(const b of balls)if(b.suit==='sun')b.potted=true;assert.deepEqual(targets(balls,0),[moon]);
 assert.ok(ruling(balls,stroke(moon,[{id:moon,pocket:1}]),0,1).win);assert.ok(ruling(balls,stroke(moon,[{id:moon,pocket:1}]),0,0).returnMoon);
 assert.ok(!ruling(balls,stroke(moon,[{id:moon,pocket:1}]),0,1,1).win);assert.ok(ruling(balls,stroke(moon,[{id:moon,pocket:1}],[{id:moon,after:true}]),0,1,1).win);
 assert.ok(!ruling(balls,stroke(moon,[{id:moon,pocket:2}]),0,2,2).win);
});
test('ball in hand must clear mouths, rails and other balls; every opponent yields legal placement and reproducible shots',()=>{
 for(let skill=0;skill<6;skill++){const table=rack(skill,skill%3,3);assert.equal(openSpot(table.balls,13,13),false);assert.equal(openSpot(table.balls,table.balls[2].x,table.balls[2].y),false);
 const [x,y]=placement(table.balls,1,skill,seeded(19));assert.ok(openSpot(table.balls,x,y));assert.ok(respot(table.balls,0,x,y));
 const shot=choose(table.balls,table.wells,1,skill,seeded(77)),again=choose(table.balls,table.wells,1,skill,seeded(77));assert.deepEqual(shot,again);
 const r=simulateShot(table.balls,table.wells,shot);assert.ok(Number.isFinite(r.log.time)&&r.log.time>0);assert.ok(options(table.balls,1,table.wells).length);}
});
test('normal opening earns a preserved local three-star card, and a squeeze of the shell only files it once',()=>{
 for(const keyboard of [false,true]){const s=session();keyboard?s.key('Space'):s.tap('strike');s.advance(5);assert.equal(s.m.inspect().phase,'card');s.tap('file');s.key('KeyX');assert.equal(s.calls,1);assert.equal(s.end.score,620);assert.equal(s.end['Player pots'],1);assert.equal(s.storage.legacy,11);assert.equal(s.storage.moonSalon.tricks[0],3);}
});
test('keyboard fine aim, spin and power differ, and the short guide does not reveal a whole orbit',()=>{
 const s=session(),a=s.m.inspect().angle;s.key('ArrowRight');close(s.m.inspect().angle-a,.01);s.key('KeyD');close(s.m.inspect().angle-a,.095);
 s.key('KeyQ');assert.equal(s.m.inspect().spin,-.25);s.key('ArrowUp');assert.ok(s.m.inspect().power>.35);
 const cue=ball(0,240,180,'cue'),b=ball(1,322,180);const g=guide([cue,b],0);assert.equal(g.id,1);assert.ok(g.x<=303);assert.ok(guide([cue],0).x-cue.x<=180);
});
test('touch and mouse aim consistently after a portrait rotation, and cancellation cannot strike or spend a shot',()=>{
 for(const [w,h] of [[360,402],[844,345],[1440,770],[884,940]]){const s=session(),g=layout(w,h),b=s.m.inspect().balls[0],p=g.world(b.x,b.y),target=g.world(b.x+60,b.y+45),back=g.felt(...target);
 close(back[0],b.x+60);close(back[1],b.y+45);s.m.pointer('down',...target,w,h);s.m.pointer('up',...target,w,h);close(s.m.inspect().angle,Math.atan2(45,60));
 s.m.pointer('down',...p,w,h);s.m.pointer('cancel',...target,w,h);s.m.pointer('up',...target,w,h);assert.equal(s.m.inspect().stroke,0);}
});
test('fixed tick outcomes survive 30 and 120 Hz presentation and pause mid-stroke',()=>{
 const a=session(),b=session();a.key('Space');b.key('Space');a.advance(.3);const snap=copyBalls(a.m.inspect().balls);a.m.pause();a.advance(.8);assert.deepEqual(a.m.inspect().balls,snap);a.m.resume();a.advance(5);b.advance(5,1/30);assert.equal(a.m.inspect().score,b.m.inspect().score);
});
test('18 ladder racks are distinct and the daily schedule reproduces table permutation and well set for the day',()=>{
 const seen=new Set();for(let l=0;l<6;l++)for(let i=0;i<3;i++){const r=rack(l,i,7);seen.add(JSON.stringify(r.balls.map(b=>[b.x,b.y])));assert.ok(r.balls.length>=6&&r.balls.length<=8);}
 assert.equal(seen.size,18);assert.deepEqual(dailySet(7),dailySet(7));assert.notDeepEqual(dailySet(7),dailySet(8));assert.equal(dailySet(7).length,3);assert.ok(Object.keys(lines).length>=32);
});
test('real House Run opponents separate durability and legal scoring across the three physical profiles',()=>{
 const med=(name,k)=>{const vals=[173,8092,16011,23930,31849,39768,47687].map(s=>play(name,s)[k]).sort((a,b)=>a-b);return vals[3];};
 assert.ok(med('steady','score')>med('newbie','score'));assert.ok(med('expert','seconds')>med('steady','seconds'));
});

test('a full House Ladder rack completes through ordinary placement, aim, spin, call and strike controls on both turns',()=>{
 const s=session('ladder'),g=layout(1000,680),rng=seeded(409);let human=0,opponent=0;
 for(let step=0;step<100 && s.m.inspect().phase!=='card';step++){
  const state=s.m.inspect();
  if(state.seat===1){opponent++;s.tap('skip');s.advance(9);continue;}
  const balls=state.balls;
  if(state.aimHand){const [x,y]=placement(balls,0,5,rng),p=g.world(x,y);s.m.pointer('down',...p,1000,680);s.m.pointer('up',...p,1000,680);s.tap('place');}
  const view=s.m.inspect(),next=choose(view.balls,view.table.wells,0,5,rng,view.table.condition),cue=view.balls[0];
  // Tap on the same ray even when the projected 70-unit point is near a cushion.
  const stop=Math.max(4,Math.min(70,(Math.cos(next.angle)>0?795-cue.x:cue.x-5)/Math.max(.001,Math.abs(Math.cos(next.angle))),(Math.sin(next.angle)>0?395-cue.y:cue.y-5)/Math.max(.001,Math.abs(Math.sin(next.angle)))));
  const at=g.world(cue.x+Math.cos(next.angle)*stop,cue.y+Math.sin(next.angle)*stop);
  s.m.pointer('down',...at,1000,680);s.m.pointer('up',...at,1000,680);
  s.m.action('power','input',next.power*100);s.m.action('spin','input',next.spin*10);
  while(s.m.inspect().called!==next.called)s.tap('call');
  s.tap('strike');human++;s.advance(9);
 }
 assert.equal(s.m.inspect().phase,'card');assert.ok(human>0&&opponent>0);s.tap('file');assert.ok(s.end);assert.ok(s.end['Shots played']>0);
});
