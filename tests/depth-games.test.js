import test from 'node:test';
import assert from 'node:assert/strict';
import cloudfoil from '../src/games/cloudfoil/game.js';
import switchyard from '../src/games/switchyard/game.js';
import pearlshift from '../src/games/pearlshift/game.js';
import moonfreight from '../src/games/moonfreight/game.js';
import summitline from '../src/games/summitline/game.js';
import driftglass from '../src/games/driftglass/game.js';

const circuits = [
  [cloudfoil, 'Hoops', v => v === '12 / 12'],
  [switchyard, 'Correct platforms', v => v === 15],
  [pearlshift, 'Pearls landed', v => v >= 10],
  [moonfreight, 'Freight delivered', v => v === '5/5'],
  [summitline, 'Stations served', v => v === '5/5'],
  [driftglass, 'Clean gates', v => v === '18/18'],
];
function trial(game, autopilot, seed) {
  let result = null, state = seed;
  const model = game.create({
    rng: () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296),
    sound() {}, haptic() {}, hud() {},
    end(score, stats) {
      assert.equal(result, null, 'one result per run');
      assert.ok(Number.isFinite(score) && score >= 0);
      result = { score, stats: Object.fromEntries(stats) };
    },
  });
  const dt = 1 / 60;
  for (let frame = 0; !result && frame < 120 * 60; frame++) {
    if (autopilot) model.demo(dt);
    model.update(dt);
  }
  assert.ok(result, 'the run reaches a result');
  for (let n = 0; n < 120; n++) model.update(dt);
  return result;
}
for (const [game, label, finished] of circuits) {
  test(game.title + ' can be completed, repeats a seeded run, and rewards active play', () => {
    const idle = trial(game, false, 7);
    const played = trial(game, true, 7);
    assert.deepEqual(trial(game, true, 7), played);
    assert.ok(finished(played.stats[label]), label);
    assert.ok(played.score > idle.score);
    assert.ok(finished(trial(game, true, 91).stats[label]), 'alternate course');
  });
}

test('PEARL SHIFT lets both touch and keyboard pilots gather a shell, then bank it at the surface', () => {
  for (const input of ['pointer', 'keyboard']) {
    let catchScore = 0;
    const model = pearlshift.create({
      rng: () => .5, sound() {}, haptic() {},
      hud(_label, score) { catchScore = score; },
      end() { assert.fail('a single dive does not end the shift'); },
    });
    const wait = seconds => {
      for (let i = 0; i < Math.round(seconds * 60); i++) model.update(1 / 60);
    };
    const tap = (x, y) => {
      model.pointer('down', x, y);
      model.pointer('up', x, y);
    };
    const space = () => { model.key('down', 'Space'); model.key('up', 'Space'); };
    if (input === 'pointer') {
      tap(362, 267);
      tap(360, 440);
    } else {
      space();
      model.key('down', 'ArrowRight');
      wait(1.58);
      model.key('up', 'ArrowRight');
    }
    wait(3.5);
    assert.equal(catchScore, 0, 'the pearl still sits inside the bell');
    if (input === 'pointer') tap(360, 440); else space();
    wait(2.6);
    assert.equal(catchScore, 100, input);
  }
});

function manual(game, input) {
  let result, points = 0;
  const sounds = [];
  const model = game.create({
    rng: () => .5, sound: preset => sounds.push(preset), haptic() {},
    hud(_label, score) { points = score; },
    end(score, stats) { result = {score, stats:Object.fromEntries(stats)}; },
  });
  const wait = seconds => { for(let i=0;i<Math.round(seconds*120);i++) model.update(1/120); };
  const press = (key, x, y) => {
    if(input==='touch'){model.pointer('down',x,y);model.pointer('up',x,y);}
    else {model.key('down',key);model.key('up',key);}
  };
  return {model,wait,press,sounds,get points(){return points;},get result(){return result;}};
}

for(const input of ['keyboard','touch']) {
  test('the six expanded controls work directly with '+input, () => {
    const air=manual(cloudfoil,input);
    air.wait(3.22);
    air.press('Space',375,438);
    if(input==='touch') {
      const scale=165/(165+485-74*3.22);
      air.press('',240+85*scale,156+(130-14)*scale);
    } else {
      air.model.key('down','ArrowRight');air.wait(85/205);air.model.key('up','ArrowRight');
      air.model.key('down','ArrowUp');air.wait(14/146);air.model.key('up','ArrowUp');
    }
    air.wait(120);
    assert.ok(air.result.stats['Needle shortcuts']>=1,'a folded glider can thread the needle');

    const rail=manual(switchyard,input);
    rail.wait(2);rail.press('Space',360,345);rail.wait(95);
    assert.ok(rail.result.stats['Correct platforms']>=1,'ringing the bell lets the first service reach A');

    const reef=manual(pearlshift,input);
    reef.press('Space',366,440);reef.wait(2);reef.press('KeyE',199,440);
    if(input==='touch') reef.press('',148,273);
    else {
      reef.model.key('down','ArrowLeft');reef.model.key('down','ArrowUp');reef.wait(.80);
      reef.model.key('up','ArrowUp');reef.wait(.42);reef.model.key('up','ArrowLeft');
    }
    reef.wait(1.7);reef.press('Space',366,440);reef.wait(3.1);
    assert.equal(reef.points,400,'sonar reveals a four-point opal and the bell banks it');

    const tug=manual(moonfreight,input);
    tug.wait(2.3);tug.press('KeyE',370,371);tug.wait(100);
    assert.equal(tug.result.stats['Salvage retrieved'],1,'the deck winch captures a floating supply pod');

    const cable=manual(summitline,input);
    cable.wait(4.2);cable.press('Space',370,40);cable.wait(1/120);
    const exposure=cable.points;
    assert.ok(exposure>=60,'a wildlife exposure earns stars');
    cable.press('Space',370,40);cable.wait(1/120);assert.equal(cable.points,exposure,'one exposure per species');
    cable.wait(120);assert.equal(cable.result.stats['Field guide'],'1/5');

    const race=manual(driftglass,input);
    race.press('KeyB',100,443);race.press('KeyB',100,443);race.wait(120);
    assert.equal(race.result.stats.Boosts,1,'the second tap cannot spend the same charge');
  });
}

test('advanced flight lines, convoys, salvage, wildlife, sonar and racing are attainable within the clock', () => {
  const best=circuits.map(([game])=>trial(game,true,91).stats);
  assert.ok(best[0]['Needle shortcuts']>=4);
  assert.ok(best[1]['Double dispatches']>=1);
  assert.ok(best[2]['Wreck opals']>=1);
  assert.equal(best[3]['Pods unloaded'],5);
  assert.equal(best[4]['Field guide'],'5/5');
  assert.ok(best[5]['Apex clips']>=8);
  assert.equal(best[5].Finish,'1st of 2');
});
