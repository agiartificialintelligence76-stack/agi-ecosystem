import test from 'node:test';
import assert from 'node:assert/strict';
import forge from '../src/games/echoforge/game.js';
import harbor, { pathTo, wharves } from '../src/games/inkveil/game.js';
import courier, { trace, routes, variant } from '../src/games/prismcourier/game.js';
import rookery, { flights, legalMoves, wetlands } from '../src/games/rookery/game.js';
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

test('a quench in the gold band tempers metal on touch and keyboard; the next cold quench has no bonus',()=>{
  for(const keyboard of [false,true]){
    const g=run(forge);
    for(const beat of [0,2,4,6,8]){
      g.tick((beat===0?3:2)*60/82);
      const lane=[2,6].includes(beat)?1:0;
      if(keyboard)g.instance.key('down',lane?'KeyL':'KeyA');else g.instance.pointer('down',lane?250:90,412);
    }
    const before=g.hud.at(-1)[1];
    if(keyboard)g.instance.key('down','KeyQ');else g.instance.pointer('down',410,416);
    assert.ok(g.hud.at(-1)[1]>before+90);
    const tempered=g.hud.at(-1)[1];g.tick(.6);g.instance.key('down','KeyQ');assert.equal(g.hud.at(-1)[1],tempered);
  }
});

test('the courier must rewind the clockwork moth before sending another decoy',()=>{
  for(const keyboard of [false,true]){
    const g=run(harbor);
    const launch=()=>keyboard?g.instance.key('down','KeyM'):g.instance.pointer('down',402,463);
    launch(); launch();
    assert.equal(g.sound.filter(s=>s==='whoosh').length,1);
  }
});

test('both mirror-image arrangements of every fork light all receivers, and turning its gold lens changes delivery',()=>{
  for(const route of routes) for(const flip of [false,true]){
    const layout=variant(route,flip), slots=layout.rails.map(r=>r[6]);
    const rays=trace(layout,slots);
    assert.ok(rays.every(ray=>ray.delivered),route.name);
    if(!route.forks)continue;
    assert.ok(rays.some(ray=>ray.strands.length>1),route.name);
    assert.ok(trace(layout,slots,layout.rails.map(r=>Boolean(r[7]))).some(ray=>!ray.delivered),route.name);
  }
});

test('the active gold lens turns from either control scheme in the first forked dispatch',()=>{
  for(const keyboard of [false,true]){
    const g=run(courier);
    for(let i=0;i<30 && g.hud.at(-1)[1]!=='3/10';i++)g.tick(.25,true);
    assert.equal(g.hud.at(-1)[1],'3/10');
    const before=g.hud.at(-1)[3];
    if(keyboard)g.instance.key('down','KeyR');else g.instance.pointer('down',410,450);
    assert.equal(g.hud.at(-1)[3],before+1);assert.equal(g.sound.at(-1),'power');
  }
});

test('both orbital rudders spend a measured amount of propellant when held during flight',()=>{
  for(const keyboard of [false,true]){
    const g=run(tether);
    for(let shot=0;shot<8 && !g.end.length;shot++){
      g.tick(1.85);g.instance.key('down','Space');
      if(keyboard)g.instance.key('down','ArrowDown');else g.instance.pointer('down',360,310);
      g.tick(.7);
      if(keyboard)g.instance.key('up','ArrowDown');else g.instance.pointer('up',360,310);
      g.tick(2);
    }
    assert.ok(Object.fromEntries(g.end[0][1])['Thruster seconds']>=1);
  }
});

test('rising water closes dry landing squares and changes a rook stopping point; the solver tracks the chick',()=>{
  const low=legalMoves([], [5,24,0,0],0,{pools:[7],egg:12});
  const high=legalMoves([], [5,24,1,0],0,{pools:[7],egg:12});
  assert.ok(low.includes(9));assert.ok(high.includes(6));assert.ok(!high.includes(9));
  const states=[...flights([6,12,18],[20,4,0,0],wetlands[2]).values()];
  assert.ok(states.some(n=>n.state[3]===1));
  assert.ok(states.some(n=>n.state[3]===0 && n.state[2]===1));
});

for(const [game,label,expected] of [[forge,'Commissions','5 / 5'],[harbor,'Mail bags delivered',5],
  [courier,'Dispatches',10],[rookery,'Habitats',6],[tether,'Transfers','16 / 16']]){
  test(`${game.title} can finish through its normal game loop and reports one result`,()=>{
    for(const seed of [1,7,212]){
      const g=run(game,seed);g.tick(95,true);
      assert.equal(g.end.length,1);
      const [score,summary]=g.end[0];
      assert.ok(Number.isSafeInteger(score) && score>0);
      assert.deepEqual(summary[0],[label,expected]);
      const stats=Object.fromEntries(summary);
      if(game===forge){assert.ok(stats['Drawn notes']>=4);assert.ok(stats['True tempers']>=5);}
      if(game===harbor)assert.ok(stats['Moths released']>=1);
      if(game===rookery)assert.equal(stats['Chicks rescued'],4);
      if(game===tether)assert.equal(stats['Pilots rescued'],6);
    }
  });
}
