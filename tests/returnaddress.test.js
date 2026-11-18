import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSide, records, setlist, press, grade } from '../src/games/returnaddress/record.js';
import { stageLayout,ellipsePoint } from '../src/games/returnaddress/stage-layout.js';
import { rng } from '../src/games/kit/fx.js';
import { lines } from '../src/games/returnaddress/lines.js';
import { players,simulate } from '../src/games/returnaddress/skater.js';
import game from '../src/games/returnaddress/game.js';

test('all seven sides use the original measured beats, downbeat offsets and complete durations',()=>{
  assert.equal(records.length,7);assert.ok(records.reduce((s,r)=>s+r.duration,0)>22*60);
  for(const r of records){
    const chart=JSON.parse(readFileSync(new URL('../src/games/heartbeat/charts/'+r.id+'.json',import.meta.url)));
    assert.deepEqual(r.beats,chart.beats.map(t=>Math.round(t*1000)));
    assert.equal(r.bar,chart.bar);assert.equal(r.duration,chart.duration);
    assert.ok(Math.abs(r.duration-r.beats.at(-1)/1000)<5);
  }
});
test('seeded grooves remain reachable on every record at every cut',()=>{
  for(const r of records)for(const cut of ['mellow','club','dub'])for(const seed of [1,7,97]){
    const events=press(r,cut,seed);
    assert.deepEqual(events,press(r,cut,seed));
    assert.ok(events.length>65);
    for(const [i,e] of events.entries()){
      assert.equal(e.time,r.beats[e.beat]/1000);assert.ok(e.lane>=0&&e.lane<=2);
      if(i) { assert.ok(e.time-events[i-1].time>.55); assert.ok(Math.abs(e.lane-events[i-1].lane)<=1); }
    }
    assert.ok(events.at(-1).time>r.duration-5);
  }
});
test('tomorrow and a different tour seed give a different pressing',()=>{
  assert.notDeepEqual(press(records[0],'club',1),press(records[0],'club',2));
  assert.equal(setlist(9,'agi','tour')[0].id,'agi');
  assert.deepEqual(setlist(9,'agi','daily'),setlist(9,'after-agi','daily'));
  assert.equal(setlist(9,'after-agi','practice')[0].id,'after-agi');
  assert.equal(new Set(setlist(9,null,'tour')).size,7);
});
test('skating has travel time, jumping clears a scratch but cannot collect a star',()=>{
  const b=createSide(records[0],'club',9,true),s=b.state;
  const first=s.events[0];
  b.advance(first.time-.005); b.shift(1); b.advance(first.time);
  assert.equal(s.ledger.hits,1); assert.ok(s.position<1.04);
  const second=s.events[1];b.advance(second.time-.12);b.jump();b.advance(second.time);assert.equal(s.last.kind,'miss');
  const crack=s.events.find(e=>e.scratch);b.advance(crack.time-.18);b.jump();b.advance(crack.time);
  assert.equal(s.last.kind,'clear');
});
test('backspin restores the original ledger and spends a permanent charge',()=>{
  const b=createSide(records[0],'club',9,true),s=b.state, saved=[];
  for(let i=0;i<15;i++){saved[i]={...s.ledger};b.advance(s.events[i].time+.001);}
  assert.ok(b.rewind());assert.deepEqual(s.ledger,saved[s.index]);assert.equal(s.spin,1);
  const at=s.index;b.advance(s.events[at+6].time+.001);
  assert.ok(b.rewind());assert.equal(s.spin,0);
  assert.equal(b.rewind(),false);
});
test('the needle survives early mistakes and practice reaches the end with any wear',()=>{
  const normal=createSide(records[1],'dub',14);
  normal.advance(27);assert.equal(normal.state.ledger.damage,0);
  normal.advance(190);assert.ok(normal.state.failed);
  const practice=createSide(records[1],'dub',14,true);practice.advance(records[1].duration);
  assert.ok(practice.state.finished);assert.equal(practice.state.failed,false);
  assert.notEqual(grade(practice.state.ledger),'FULL COMBO');
});
test('tour demo clears all seven sides through real controls, saves each sleeve exactly once',()=>{
  let end,saved={};const model=game.create({rng:rng(7).next,seed:7,hud(){},say(){},store:{update(fn){fn(saved);}},end(...args){end=args;}});
  for(let frame=0;frame<120*1400&&!end;frame++){model.demo();model.update(1/120);}
  assert.equal(end[1].at(-1)[1],7);assert.equal(Object.keys(saved.vinylSleeves).length,7);
  assert.ok(Object.values(saved.vinylSleeves).every(s=>s.grade==='FULL COMBO'));
  assert.ok(end[0]>100000);assert.match(game.progress(saved),/7 full combos/);
});
test('simulation separates skill levels using the same needle, pressings and collision rules',()=>{
  const medians=Object.values(players).map(p=>Array.from({length:80},(_,i)=>simulate(i+1,p).elapsed).sort((a,b)=>a-b)[39]);
  assert.ok(medians[0]>=45 && medians[0]<medians[1]);
  assert.ok(medians[1]>=120&&medians[1]<=300);assert.ok(medians[2]>medians[1]*2);
});
test('portrait, landscape, foldable and desktop keep all three orbit rings inside the stage',()=>{
  for(const [w,h] of [[360,490],[510,290],[884,950],[1440,750],[2560,1280]]){
    const l=stageLayout(w,h);
    for(let a=0;a<6.29;a+=.15)for(let lane=0;lane<3;lane++){
      const [x,y]=ellipsePoint(l,lane,a);assert.ok(x>0&&x<w&&y>l.header&&y<h);
    }
  }
});
test('every contextual line is unique and every physical action has an accessible control',()=>{
  const script=Object.values(lines).flat();
  assert.ok(new Set(script).size>=30);
  assert.ok(script.every(s=>s===s.toLowerCase()));
  assert.equal(new Set(game.controls.map(c=>c.id)).size,4);
});
