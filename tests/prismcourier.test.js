import test from 'node:test';
import assert from 'node:assert/strict';
import { frames } from '../src/games/prismcourier/chambers.js';
import { advance,opening,search,isHome,stars } from '../src/games/prismcourier/maze.js';
import { chamber,createTake,recordClear,choose,accessible,readGallery } from '../src/games/prismcourier/rehearsal.js';
import { lines } from '../src/games/prismcourier/lines.js';
import { layout,cellPoint } from '../src/games/prismcourier/layout.js';
import { rng } from '../src/games/kit/fx.js';
import game from '../src/games/prismcourier/game.js';

test('forty uniquely drawn pairs have passable starts, goals and five different rules',()=>{
  assert.equal(frames.length,40);assert.equal(new Set(frames.map(f=>f.boards.join('/'))).size,40);
  assert.equal(new Set(frames.map(f=>f.name)).size,40);assert.equal(new Set(frames.map(f=>f.gallery)).size,5);
  for(const f of frames)for(let j=0;j<2;j++)assert.notEqual(f.boards[j][f.start[j]],'#');
});
test('breadth-first search proves every printed par and every published daily witness',()=>{
  for(const f of frames)for(let edition=0;edition<5;edition++){
    const r=chamber(f.id,edition),start=opening(r);
    const exact=search(r,start);assert.equal(exact.length,r.par,r.name);
    const end=[...r.witness].reduce((s,k)=>advance(r,s,Number(k)),start);
    assert.ok(isHome(r,end));assert.equal(r.witness.length,r.par);
  }
});
test('the same arrow moves two independent bodies from the same previous turn',()=>{
  const r=chamber(0),s=opening(r),n=advance(r,s,1);
  assert.equal(n.a,s.a+1);assert.equal(n.b,s.b-1);assert.ok(isHome(r,n));
  assert.deepEqual(s,opening(r));
});
test('rest is a real command and wins its teaching chamber one beat earlier',()=>{
  const r=chamber(17),solution=search(r);
  assert.ok(solution.includes(4));assert.equal(search(r,opening(r),undefined,{omit:4}).length,solution.length+1);
  const a=advance(r,opening(r),1);assert.equal(a.b,r.start[1]);
  assert.equal(advance(r,a,4).previous,4);
});
test('keyed stage doors require the other girl’s signature and never displace a standing body',()=>{
  const r=chamber(32),keyed={...opening(r),a:6,b:11};
  assert.equal(advance(r,keyed,3).b,11);
  assert.equal(advance(r,{...keyed,seals:1},3).b,12);
  const signed=advance(r,{...opening(r),a:1},1);assert.equal(signed.seals&1,1);
  const end=[...r.witness].reduce((s,k)=>advance(r,s,+k),opening(r));assert.ok(end.b%5>=3);
});
test('swap is available at a relay, persists, costs one command and is required at a signature finale',()=>{
  const r=chamber(39),s=opening(r);assert.equal(advance(r,s,5),s);
  const onRelay={...s,a:r.boards[0].indexOf('R')};assert.equal(advance(r,onRelay,5).swapped,1);
  assert.equal(search(r,s,undefined,{omit:5}),null);
});
test('a slide crosses several cells, and undo returns both girls and their queued direction exactly',()=>{
  const r=chamber(24),take=createTake(r);let glided=false;
  for(const ch of r.witness){
    const prev=take.state;take.step(+ch);const next=take.state;
    if(Math.abs(next.b%5-prev.b%5)+Math.abs(Math.floor(next.b/5)-Math.floor(prev.b/5))>1)glided=true;
    take.undo();assert.deepEqual(take.state,prev);take.step(+ch);
  }
  assert.ok(glided);assert.ok(take.solved);
});
test('stars reward shortest solutions and save the shortest versioned input tape',()=>{
  const room=chamber(0),s=createTake(room),data={legacy:42};
  s.step(0);s.step(2);s.step(1);recordClear(data,room,s,'gallery',7);
  assert.equal(readGallery(data)[0].stars,2); const exact=createTake(room);exact.step(1);
  recordClear(data,room,exact,'gallery',8);recordClear(data,room,s,'gallery',9);
  assert.equal(readGallery(data)[0].tape,'1');assert.equal(data.legacy,42);
  recordClear(data,room,exact,'daily',20261118);assert.equal(data.mirrorDaily[20261118],3);
  assert.equal(stars(4,9),1);assert.deepEqual(readGallery({mirrorBook:{version:0}}),{});
});
test('each five-starred-room threshold opens a gallery, and daily setups repeat by date',()=>{
  const book=Object.fromEntries([0,1,2,3,4].map(i=>[i,{stars:1}]));
  assert.ok(accessible(book,8));assert.equal(accessible({},8),false);assert.equal(accessible(book,16),false);
  assert.deepEqual(choose(20261118,'daily',undefined,book),choose(20261118,'daily','37',{}));
  assert.ok(new Set(Array.from({length:10},(_,i)=>choose(20261118+i,'daily','2',{}).id)).size>3);
});
test('phone, sideways, foldable and desktop give both floors actual reachable space',()=>{
  for(const [w,h] of [[360,417],[590,285],[884,940],[1440,770],[2560,1290]]){
    const l=layout(w,h);
    for(const b of l.boxes)for(let n=0;n<25;n++){
      const [x,y]=cellPoint(b,n);assert.ok(x>0&&x<w&&y>0&&y<h);
    }
  }
});
test('normal DOM actions reunite both girls, persist progress, then file a nonzero card',()=>{
  let save={},result,hud;const m=game.create({rng:rng(7).next,seed:7,hud:(...a)=>hud=a,store:{read:()=>save,update(fn){fn(save);}},end:(...a)=>result=a});
  m.action('right','down');assert.equal(readGallery(save)[0].best,1);assert.ok(hud);
  m.action('file','down');assert.ok(result[0]>0);assert.deepEqual(result[1][0],['Reunions',1]);
});
test('all contextual lines are lowercase and the seeded demonstration clears four actual chambers',()=>{
  assert.equal(new Set(Object.values(lines).flat()).size,32);
  let end;const m=game.create({demo:true,rng:rng(7).next,hud(){},end:(...v)=>end=v});
  for(let i=0;i<120*120&&!end;i++){m.demo(1/120);m.update(1/120);}
  assert.deepEqual(end[1][0],['Reunions',4]);
});
