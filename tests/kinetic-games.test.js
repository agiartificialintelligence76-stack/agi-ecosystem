import test from 'node:test';
import assert from 'node:assert/strict';
import alibi from '../src/games/inkveil/game.js';
import { rooms,indexRoom,record,advance,solve,cleared } from '../src/games/inkveil/tape.js';
import split from '../src/games/prismcourier/game.js';
import { mirrors,reach,shift } from '../src/games/prismcourier/maze.js';
import cat from '../src/games/rookery/game.js';
import { desks,targets,command,paths } from '../src/games/rookery/keys.js';
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

test('each paired maze has reachable simultaneous docks and the four advanced ones require negative polarity',()=>{
  for(const [i,room] of mirrors.entries()){
    const start=[...room.starts,0],all=reach(room,start);assert.ok(all.length>=5,room.name);
    for(const {state,path} of all.slice(0,5)){
      assert.ok(path.length>=room.depth);
      assert.deepEqual(path.reduce((s,a)=>shift(room,s,a),start),state);
      if(i>=2){assert.ok(path.includes(4));assert.equal(state[2],1);}
    }
  }
});

test('the mirror reverses only on a relay and both controls undo a simultaneous movement',()=>{
  assert.deepEqual(shift(mirrors[2],[0,24,0],4),[0,24,0]);
  assert.deepEqual(shift(mirrors[2],[12,24,0],4),[12,24,1]);
  for(const touch of [true,false]){
    const g=run(split);if(touch){g.tap(121,415);g.tap(112,459);}else{g.press('ArrowUp');g.press('KeyZ');}
    assert.deepEqual(g.hud.map(h=>h[3]),[0,1,0]);
  }
});

test('every chosen sleep key has a solution, later desks need the call, and polished keys carry momentum',()=>{
  let slides=0;
  for(const [i,desk] of desks.entries()){
    for(const [tile,solution] of targets(desk)){
      assert.ok(solution?.length,desk.name);
      const end=solution.reduce((s,a)=>{const n=command(desk.layout,s,a);
        if(Math.abs(n[1]%5-s[1]%5)+Math.abs(Math.floor(n[1]/5)-Math.floor(s[1]/5))>1)slides++;
        return n;},desk.start);assert.equal(end[1],tile);
      if(i>0){assert.ok(solution.includes(4));assert.equal(paths(desk.layout,desk.start,tile,false),null);}
    }
  }
  assert.ok(slides>=4);
  assert.deepEqual(command(['.....','.#...','.....','.....','.....'],[1,11],4),[1,11]);
});

test('AGI-1 can nudge her cat to the moon key on touch or keyboard',()=>{
  for(const touch of [true,false]){
    const g=run(cat);for(let n=0;n<2;n++){if(touch)g.tap(400,274);else g.press('ArrowRight');}
    g.tick(1.4);assert.equal(g.hud.at(-1)[1],'2 / 6');
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

for(const [game,stat,expected] of [[alibi,'Cases recovered',5],[split,'Mirrors reunited',6],[cat,'Catnaps',6],[space,'Circuits docked',6]]){
 test(game.title+' plays a complete normal demo across fresh seeds and reports one result',()=>{
   for(const seed of [1,7,303]){
     const g=run(game,seed);g.tick(140,true);assert.equal(g.end.length,1,game.title);
     const [score,stats]=g.end[0];assert.ok(Number.isSafeInteger(score)&&score>0);assert.equal(Object.fromEntries(stats)[stat],expected);
   }
 });
}
