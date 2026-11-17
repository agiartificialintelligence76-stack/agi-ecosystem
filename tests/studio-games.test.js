import test from 'node:test';
import assert from 'node:assert/strict';
import { rng } from '../src/games/kit/fx.js';
import wax, { profiles } from '../src/games/waxworks/game.js';
import fish, { project } from '../src/games/lanternlake/game.js';
import court from '../src/games/returnaddress/game.js';
import sky, { projectStar } from '../src/games/starlingrelay/game.js';
import { landingDistance } from '../src/games/lanternlake/game.js';
import { makeMold, matches, pieceCount, toolStroke, undo } from '../src/games/waxworks/mold.js';
import { chartStars, tracePoint } from '../src/games/starlingrelay/chart.js';
import { laneAt, shotPower, stampPoints } from '../src/games/returnaddress/sort.js';

function start(game, seed=7) {
  let hud, result;
  const model = game.create({ rng:rng(seed).next, hud:(...v)=>{hud=v;}, end:(...v)=>{result=v;}, sound(){}, haptic(){} });
  const step=(seconds, auto=false)=>{
    for(let i=0; i<seconds*120 && !result; i++){if(auto)model.demo(1/120);model.update(1/120);}
  };
  return { model, step, get metrics(){return hud;}, get result(){return result;} };
}
test('the cast reproduces both independent projections and all six commissions are solvable',()=>{
  assert.deepEqual(profiles([[1,3],[2,0]]),{front:[2,3],side:[3,2]});
  for(const seed of [1,7,22]) {const g=start(wax,seed);g.step(120,true);assert.ok(g.result[0]>500);assert.equal(g.result[1][0][1],6);}
});
test('lantern lake gives six casts, fish nearer the dock project larger, and missed hooks consume a cast',()=>{
  assert.ok(project(10,.1).zoom>project(10,2).zoom);
  const g=start(fish);
  for(let i=0;i<6;i++){g.model.key('down','Space');g.model.key('up','Space');g.step(10);}
  assert.equal(g.result[0],0);
  const auto=start(fish);auto.step(120,true);assert.equal(auto.result[1][0][1],'6 / 6');
});
test('mail court serves by pointer and loses unreturned parcels',()=>{
  const g=start(court);
  for(let i=0;i<3;i++){g.model.pointer('down',240,218);g.model.pointer('up',240,218);g.step(.4);g.model.pointer('move',460,352);g.step(5);}
  assert.equal(g.metrics[3],0);assert.ok(g.result);
  const bot=start(court);bot.step(100,true);assert.equal(bot.result[1][0][1],'12 / 12');assert.ok(bot.result[1][1][1]>0);
});
test('observatory centers the tracked star across the right ascension seam and exposes six plates',()=>{
  assert.deepEqual(projectStar(.1,.1,.1,.1).map(Math.round),[240,202]);
  assert.ok(Math.abs(projectStar(-3.13,0,3.13,0)[0]-240)<15);
  const idle=start(sky);idle.step(102);assert.equal(idle.result[0],0);
  const bot=start(sky);bot.step(110,true);assert.equal(bot.result[1][0][1],'6 / 6');
});

test('a wire cuts all tied peaks and undo returns every bead; the commission accepts its original sculpture',()=>{
  for (let i=0;i<pieceCount;i++){
    const mold=makeMold(i,rng(637).next);
    const amount=()=>mold.pot+mold.board.flat().reduce((a,b)=>a+b,0);
    const supply=amount();
    const before=structuredClone(mold.board);
    assert.ok(!matches(mold));
    toolStroke(mold,0,0,'wire');assert.equal(amount(),supply);undo(mold);
    assert.deepEqual(mold.board,before);assert.equal(mold.moves,0);
    for (const [r,row] of mold.goal.entries()) for (const [x,height] of row.entries()){
      while(mold.board[r][x]>height)toolStroke(mold,r,x,'chisel');
    }
    for (const [r,row] of mold.goal.entries()) for (const [x,height] of row.entries()){
      while(mold.board[r][x]<height)assert.ok(toolStroke(mold,r,x,'pour'));
    }
    assert.equal(amount(),supply);assert.equal(mold.pot,0);assert.ok(matches(mold));
    assert.equal(toolStroke(mold,0,0,'pour'),false);
  }
});
test('bank shots reach the same addressed stamp along a different path, and a gold banked express earns more postage',()=>{
  const start={x:-40,y:12},target={x:90,y:54};
  assert.deepEqual(laneAt(start,target,true,1),target);
  assert.deepEqual(laneAt(start,target,false,1),target);
  assert.ok(laneAt(start,target,true,.55).x>laneAt(start,target,false,.55).x+80);
  assert.ok(shotPower(1.1)>.95);assert.ok(shotPower(0)<.1);
  assert.ok(stampPoints(true,true,3,true)>stampPoints(false,false,3,false));
});
test('bracing a running fish trades less line tension for faster retrieval; completed catches persist per species',()=>{
  const single=landingDistance(.3,true,true,false),braced=landingDistance(.3,true,true,true);
  assert.ok(braced.gain>single.gain);assert.ok(braced.tension<single.tension);
  const journal=new Map();let ended=false;
  const model=fish.create({rng:rng(14).next,hud(){},end(){ended=true;},sound(){},haptic(){},
    personalBest:k=>journal.get(k),rememberBest:(k,v)=>journal.set(k,Math.max(journal.get(k)||0,v))});
  for(let i=0;i<14400&&!ended;i++){model.demo(1/120);model.update(1/120);}
  assert.equal(journal.size,4);assert.ok([...journal.values()].every(v=>v>=20));
});
test('tracing a chart can revisit a junction, while an incorrect star leaves the path intact',()=>{
  const chart=chartStars([[0,0],[.1,.1],[0,0],[-.1,.1]],3);
  assert.deepEqual(chart.order,[0,1,0,2]);assert.equal(tracePoint(chart,3),false);
  assert.deepEqual(chart.ink,[]);assert.equal(chart.errors,1);
  for(const i of chart.order)assert.equal(tracePoint(chart,i),true);
  assert.deepEqual(chart.ink,chart.order);
});
