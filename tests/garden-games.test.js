import test from 'node:test';
import assert from 'node:assert/strict';
import mothlight from '../src/games/mothlight/game.js';
import tidepool, { thriving } from '../src/games/tidepool/game.js';
import nightpress from '../src/games/nightpress/game.js';
import cloudkitchen from '../src/games/cloudkitchen/game.js';
import pocketgrove from '../src/games/pocketgrove/game.js';

function start(game, seed = 17) {
  let hud, result, finishes = 0;
  const model=game.create({
    rng() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; },
    hud(...v) { hud = v; },
    sound() {}, haptic() {},
    end(points, stats, line) { finishes++; result = { points, stats: Object.fromEntries(stats), line }; },
  });
  return {
    model, get hud() { return hud; }, get result() { return result; }, get finishes() { return finishes; },
    tick(seconds, autoplay=false) {
      const frames = Math.round(seconds*60);
      for(let i=0;i<frames;i++){if(autoplay)model.demo(1/60);model.update(1/60);}
    },
    key(code) { model.key('down', code); model.key('up', code); },
    tap(x,y) { model.pointer('down',x,y);model.pointer('up',x,y); },
  };
}
for(const game of [mothlight,tidepool,nightpress,cloudkitchen,pocketgrove]){
  test(game.title+' completes a scored, repeatable full run',()=>{
    const a=start(game),b=start(game);
    a.tick(130,true);b.tick(130,true);
    assert.equal(a.finishes,1);assert.equal(b.finishes,1);
    assert.ok(a.result.points>0);
    assert.deepEqual(a.result,b.result);
  });
}

test('mothlight lets lantern choices change visits and collect the six species',()=>{
  const matched=start(mothlight),ignored=start(mothlight);
  matched.tick(60,true);ignored.tick(60);
  assert.equal(matched.result.stats.Species,'6 / 6');
  assert.ok(matched.result.stats.Visitors>ignored.result.stats.Visitors);
});
test('tidepool models grazing, predation and space that changes between high and low tide',()=>{
  const board=Array(16).fill(null);
  board[0]=0;board[1]=1;board[2]=2;
  assert.ok(thriving(board,1,true));
  assert.ok(thriving(board,2,true));
  board[0]=null;assert.equal(thriving(board,1,true),false);
  board[0]=0;board[4]=2;assert.ok(thriving(board,0,true));
  assert.equal(thriving(board,0,false),false);
});
test('tidepool ignores occupied pockets and lets touch and keyboard finish tides',()=>{
  const a=start(tidepool);
  a.tap(94,160);assert.equal(a.hud[1],'2/12');
  a.tap(94,160);assert.equal(a.hud[1],'2/12');
  a.key('Digit2');a.key('Space');assert.equal(a.hud[1],'3/12');
});
test('night press requires two locks on each ink, then changes edition after both inks',()=>{
  const a=start(nightpress);
  assert.equal(a.hud[3],'1/2');
  a.key('Space');a.tick(.4);assert.equal(a.hud[3],'1/2');
  a.tap(200,200);a.tick(1.1);assert.equal(a.hud[3],'2/2');
  a.tap(200,200);a.key('Enter');a.tick(1.1);
  assert.equal(a.hud[1],'2/5');assert.equal(a.hud[3],'1/2');
});
test('cloud kitchen completes a two-ingredient ticket and early taps keep cooking',()=>{
  const a=start(cloudkitchen);
  a.key('Digit1');a.tap(240,425);a.tick(1);a.key('Digit1');
  a.tick(2.4);a.tap(70,433);assert.equal(a.hud[1],0);
  a.tick(2.4);a.key('Digit2');a.tick(.1);assert.equal(a.hud[1],1);
  a.tick(65);assert.equal(a.result.stats['Tickets served'],1);
});
test('orchard baskets use picked inventory and invalid grafts preserve the day',()=>{
  const a=start(pocketgrove);
  a.key('KeyW');a.key('Digit3');assert.equal(a.hud[3],'1/20');
  a.key('KeyE');a.key('Digit1');a.tap(322,170);a.key('Digit3');
  assert.equal(a.hud[1],1);
  assert.equal(a.hud[3],'4/20');
});
