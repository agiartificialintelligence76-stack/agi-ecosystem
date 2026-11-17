import test from 'node:test';
import assert from 'node:assert/strict';
import forge from '../src/games/echoforge/game.js';
import harbor, { pathTo, wharves } from '../src/games/inkveil/game.js';
import courier, { trace, routes } from '../src/games/prismcourier/game.js';
import rookery, { flights, legalMoves } from '../src/games/rookery/game.js';
import tether, { aimAt } from '../src/games/tetherturn/game.js';

function run(game, seed=7) {
  const events={hud:[],end:[],sound:[]};
  const instance=game.create({
    rng:()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296),
    hud:(...args)=>events.hud.push(args),end:(...args)=>events.end.push(args),
    sound:(name)=>events.sound.push(name),haptic(){},
  });
  const tick=(seconds,autoplay=false)=>{
    for(let i=0;i<Math.round(seconds*120);i++){
      if(autoplay)instance.demo(1/120);
      instance.update(1/120);
    }
  };
  return {instance,tick,...events};
}

test('ECHO FORGE grades the right hammer inside its beat window on both input types',()=>{
  for(const keyboard of [false,true]){
    const g=run(forge);
    g.tick(3*60/82);
    if(keyboard)g.instance.key('down','KeyL');else g.instance.pointer('down',336,410);
    assert.equal(g.hud.at(-1)[1],0);
    if(keyboard)g.instance.key('down','KeyA');else g.instance.pointer('down',80,410);
    assert.equal(g.hud.at(-1)[1],120);
    g.tick(20);
    assert.equal(g.end.length,1);
    assert.equal(g.end[0][1][0][1],'0 / 5');
  }
});

test('every INK VEIL stamp and exit can be reached by cardinal moves on the docks',()=>{
  for(const {map} of wharves){
    const flat=map.join(''),start=flat.indexOf('S');
    assert.equal(flat.split('*').length-1,3);
    for(let i=0;i<flat.length;i++){
      if(!'*E'.includes(flat[i]))continue;
      const path=pathTo(map,start,i);
      assert.equal(path.at(-1),i);
      let previous=start;
      for(const tile of path){
        assert.notEqual(flat[tile],'#');
        assert.equal(Math.abs(tile%7-previous%7)+Math.abs(Math.floor(tile/7)-Math.floor(previous/7)),1);
        previous=tile;
      }
    }
  }
  for(const keyboard of [false,true]){
    const g=run(harbor);
    if(keyboard){g.instance.key('down','ArrowUp');g.instance.key('up','ArrowUp');}
    else g.instance.pointer('down',75,368);
    g.tick(.35);
    assert.deepEqual(g.hud.at(-1),['Stamps','1/3','Seals',3]);
  }
});

test('PRISM COURIER traces authored rays to their own receivers and updates a slide immediately',()=>{
  for(const r of routes)assert.ok(trace(r,r.rails.map(p=>p[6])).every(ray=>ray.delivered));
  const first=routes[0];
  assert.equal(trace(first,[0])[0].delivered,false);
  for(const keyboard of [false,true]){
    const g=run(courier);
    if(keyboard)g.instance.key('down','Space');else g.instance.pointer('down',112.5+3*51,112.5+3*51);
    assert.equal(g.hud.at(-1)[3],1);
  }
});

test('ROOKERY stops the rook against reeds and its partner, while the owl jumps over them',()=>{
  assert.deepEqual(legalMoves([14],[10,12],0).sort((a,b)=>a-b),[0,11,20]);
  assert.ok(legalMoves([7,11],[1,12],1).includes(5));
  const tree=flights([7,17],[20,24]);
  for(const node of tree.values()){
    if(!node.first)continue;
    const [bird,cell]=node.first;
    assert.ok(legalMoves([7,17],[20,24],bird).includes(cell));
    assert.ok(node.depth>0);
  }
  const g=run(rookery);
  g.instance.key('down','KeyH');g.instance.key('down','Enter');
  assert.equal(g.hud.at(-1)[3],1);
  g.instance.pointer('down',132,454);
  assert.equal(g.hud.at(-1)[3],0);
});

test('TETHER TURN distinguishes a core pass, a near miss, and an anchor behind the pilot',()=>{
  assert.deepEqual(aimAt({x:1,y:2},0,{x:80,y:7}),{along:79,offset:5});
  assert.equal(aimAt({x:1,y:2},0,{x:50,y:70}).offset,68);
  assert.ok(aimAt({x:1,y:2},0,{x:-10,y:3}).along<0);
  const g=run(tether);
  for(let i=0;i<3;i++){
    g.tick(1.85);if(i%2)g.instance.key('down','Space');else g.instance.pointer('down',240,300);g.tick(2);
  }
  assert.equal(g.end.length,1);
  assert.equal(g.end[0][0],0);
});

for(const [game,label,expected] of [[forge,'Commissions','5 / 5'],[harbor,'Mail bags delivered',5],
  [courier,'Dispatches',7],[rookery,'Habitats',6],[tether,'Transfers','16 / 16']]){
  test(`${game.title} can finish through its normal game loop and reports one result`,()=>{
    for(const seed of [1,7,212]){
      const g=run(game,seed);g.tick(95,true);
      assert.equal(g.end.length,1);
      const [score,summary]=g.end[0];
      assert.ok(Number.isSafeInteger(score) && score>0);
      assert.deepEqual(summary[0],[label,expected]);
    }
  });
}
