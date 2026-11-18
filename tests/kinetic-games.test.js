import test from 'node:test';
import assert from 'node:assert/strict';
import alibi from '../src/games/inkveil/game.js';
import { rooms,indexRoom,record,advance,solve,cleared } from '../src/games/inkveil/tape.js';
import space from '../src/games/tetherturn/game.js';
import { presets,course,launch,integrate,passage,wreck,reverse,closePass,STEP } from '../src/games/tetherturn/orbit.js';

function run(game,seed=7){
  const hud=[],end=[],sound=[],tone=[];
  const g=game.create({rng:()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296),hud:(...a)=>hud.push(a),
    end:(...a)=>end.push(a),sound:(...a)=>sound.push(a),tone:o=>tone.push(o),haptic(){}});
  const tick=(seconds,demo=false)=>{for(let i=0;i<Math.round(seconds*120);i++){if(demo)g.demo(1/120);g.update(1/120);}};
  return {g,hud,sound,tone,end,tick,press:k=>g.key('down',k),tap:(x,y)=>g.pointer('down',x,y)};
}

test('each archive has a working looping decoy and rejects a tape that never visits a required camera',()=>{
  for(const raw of rooms){
    const room=indexRoom(raw),tape=record(room,room.script),route=solve(room,tape);
    assert.ok(route?.length>0,raw.name);
    assert.equal(solve(room,[room.start]),null,raw.name);
    let state=[room.start,0,0];for(const a of route)state=advance(room,tape,state,a);
    assert.ok(cleared(room,state));assert.ok(room.script.length<=room.cap);
  }
});

test('keyboard and touch record the first alibi, recover its diary and unlock the second case',()=>{
  for(const useTouch of [false,true]){
    const g=run(alibi);if(useTouch){g.tap(184,209);g.tap(405,450);for(let i=0;i<3;i++)g.tap(380,270);}
    else{g.press('ArrowUp');g.press('Space');for(let i=0;i<3;i++)g.press('ArrowRight');}
    g.tick(1.3);assert.equal(g.hud.at(-1)[1],'2 / 5');
  }
});

test('all safe slingshot routes pass the buoy and finish for every allowed course variation',()=>{
  for(const preset of presets)for(const jitter of [-2,-1,0,1,2]){
    const arena=course(preset,jitter),pod=launch(arena,arena.solution,arena.power);let checkpoint=false,win=false;
    while(pod.age<preset.duration+.1){
      if(preset.flip && pod.age>=preset.flip)reverse(pod);integrate(pod,arena.moons);
      assert.equal(wreck(pod,arena.moons),false,preset.name);
      const pass=passage(arena,pod,checkpoint);checkpoint=pass.marked;if(pass.finish){win=true;break;}
    }assert.ok(win,preset.name);
    if(preset.flip){assert.equal(reverse(pod),false);pod.flipped=false;assert.equal(passage(arena,pod,true).finish,false);}
  }
  assert.equal(STEP,1/120);
  const moon=[100,100,25,100000];
  assert.equal(closePass({x:133,y:100},moon),true);
  assert.equal(closePass({x:129,y:100},moon),false);
  assert.equal(closePass({x:161,y:100},moon),false);
});

test('a pulled sling launches, cancel releases the drag and the keyboard can recall a shot',()=>{
  const g=run(space);g.tap(120,190);g.g.pointer('move',57,217);g.g.pointer('cancel',57,217);g.g.pointer('up',57,217);
  assert.equal(g.hud.at(-1)[3],0);
  g.tap(120,190);g.g.pointer('up',57,217);assert.equal(g.hud.at(-1)[3],1);
  g.press('KeyR');g.press('ArrowUp');g.g.key('up','ArrowUp');g.press('Space');assert.equal(g.hud.at(-1)[3],2);
});

for(const [game,stat,expected] of [[alibi,'Cases recovered',5],[space,'Circuits docked',6]]){
 test(game.title+' plays a complete normal demo across fresh seeds and reports one result',()=>{
   for(const seed of [1,7,303]){
     const g=run(game,seed);g.tick(140,true);assert.equal(g.end.length,1,game.title);
     const [score,stats]=g.end[0];assert.ok(Number.isSafeInteger(score)&&score>0);assert.equal(Object.fromEntries(stats)[stat],expected);
   }
 });
}
