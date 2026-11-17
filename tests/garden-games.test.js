import test from 'node:test';
import assert from 'node:assert/strict';
import mothlight from '../src/games/mothlight/game.js';
import tidepool, { thriving, reefLinks } from '../src/games/tidepool/game.js';
import nightpress, { scorePull } from '../src/games/nightpress/game.js';
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
test('night press registers two axes, inks both physical plates, and can retry a collector proof',()=>{
  const a=start(nightpress);
  a.key('KeyF');a.key('Space');a.key('KeyZ');
  for(let pass=0;pass<2;pass++){
    a.key('Space');a.tick(.4);a.tap(200,200);
    a.tick(1);assert.equal(a.hud[3],(pass+1)+'/2','a registered plate waits for pressure');
    a.model.pointer('down',233,431);a.tick(.9);a.model.pointer('up',233,431);a.tick(2);
  }
  assert.equal(a.hud[1],'2/6');assert.equal(a.hud[3],'1/2');
  a.tick(130,true);assert.equal(a.result.stats['Proof sheets used'],1);
  assert.equal(a.result.stats['Posters printed'],6);
  assert.ok(scorePull(1,.65,.66,true).score>scorePull(1,.65,.66,false).score);
  assert.ok(scorePull(7,.87,.65,true).score<scorePull(7,.87,.65,false).score);
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

test('moth photography spends one frame per perched visitor and completes a cover commission',()=>{
  const a=start(mothlight);
  a.tick(5.55);a.key('KeyQ');a.key('KeyQ');a.tick(60);
  assert.equal(a.result.stats['Cover shots'],1);
  assert.match(a.result.stats['Sharp photos'],/ \/ 1$/);
});
test('a sheltered resident survives its forecast surge and an intact reef needs three trophic levels',()=>{
  const a=start(tidepool), board=Array(16).fill(null);
  board[0]=0;board[1]=1;board[2]=2;
  assert.equal(reefLinks(board),1);board[0]=null;assert.equal(reefLinks(board),0);
  a.tap(319,124);a.key('KeyR');a.tap(319,124);
  assert.equal(a.hud[1],'2/12','sheltering is a free preparation for the tide');
  a.tick(130,true);assert.ok(a.result.stats['Sheltered through surges']>=1);
});
test('routing high flame changes cooking speed and awards a manually timed golden sear',()=>{
  const a=start(cloudkitchen);
  a.tap(70,370);a.key('Digit1');a.tick(2.12);a.tap(70,432);a.tick(67);
  assert.equal(a.result.stats['Golden sears'],1);
});
test('canals require two distinct trees, irrigate connected roots, and support a honey crop',()=>{
  const a=start(pocketgrove);
  a.key('KeyR');a.key('Digit1');a.key('Digit1');
  assert.equal(a.hud[3],'1/20');
  a.key('Digit1');a.key('Digit2');assert.equal(a.hud[3],'2/20');
  a.key('KeyQ');a.key('Digit1');a.tick(130,true);
  assert.ok(a.result.stats.Canals>=1);assert.ok(a.result.stats['Honey jars']>0);
  assert.ok(a.result.stats['Roots irrigated']>=2);
});
