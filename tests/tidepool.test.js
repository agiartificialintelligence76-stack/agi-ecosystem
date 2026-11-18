import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import game, { controlsFor } from '../src/games/tidepool/game.js';
import { SONGS, byId, EDITS, phaseAt, chartTime, barDuration } from '../src/games/tidepool/catalog.js';
import { grade, equalPower, configFor, openShow, advance, cutOf, selectSleeve, changeEdit, beginFade, handFader, drain, resultOf } from '../src/games/tidepool/rules.js';
import { availableEdits, readLibrary, archiveRun } from '../src/games/tidepool/progress.js';
import { createRecordBank, createDeskSound, fadeCurve, trackURLs, DECK_GAIN, CUE_GAIN } from '../src/games/tidepool/sound.js';
import { LINES } from '../src/games/tidepool/lines.js';
import { SHIFTS } from '../src/games/tidepool/shifts.js';
import { deskLayout } from '../src/games/tidepool/layout.js';
import { broadcast } from '../tools/games/tidepool/balance.mjs';

const allEdits=EDITS.map(e=>e.id);
const host=(seed=7,shift=0)=>openShow(configFor({mode:'hosted',seed,shift,edits:allEdits}));
function bestCut(s){
 let best={points:-1};
 s.choices.forEach((id,i)=>s.config.edits.forEach((edit,j)=>{
   const c=byId[id].cuts[edit],points=26-9*Math.abs(c.heat-s.request.heat)+(c.curve===s.request.curve?13:0);
   if(points>best.points)best={points,i,j};
 }));
 selectSleeve(s,best.i);
 while(s.edit!==best.j)changeEdit(s);
}
function settle(s){advance(s,s.fade.when+s.fade.duration+.01);}
test('all seven records use real MP3 masters and cuts on the measured downbeat grid',()=>{
 assert.equal(SONGS.length,7);
 const energies=new Set();
 for(const song of SONGS){
  assert.ok(existsSync(new URL('../public'+trackURLs(song.id)[0],import.meta.url)));
  const source=JSON.parse(readFileSync(new URL('../src/games/heartbeat/charts/'+song.id+'.json',import.meta.url)));
  assert.deepEqual(song.beats,source.beats);assert.equal(song.energy,source.energy);
  for(const c of Object.values(song.cuts)){assert.equal((c.start-song.bar)%4,0);assert.equal(c.offset,song.beats[c.start]);assert.ok(song.beats.length-c.start>=85);assert.ok(c.heat>=1&&c.heat<=5);}
  energies.add(song.cuts.hook.heat);
 }
 assert.ok(energies.size>=4);
});
test('first crate teaches a legible two-way energy choice and every request has a valid cut',()=>{
 for(let seed=1;seed<=100;seed++){
  const first=host(seed);
  assert.equal(first.choices.length,2);
  assert.equal(new Set(first.choices.map(id=>byId[id].cuts.hook.heat)).size,2);
  const s=host(seed,7);bestCut(s);
  assert.equal(cutOf(s).heat,s.request.heat);assert.equal(cutOf(s).curve,s.request.curve);
  assert.ok(!s.choices.includes(s.onAir.track));
 }
});
test('a cue never takes over the air deck and locked/missing sleeves are rejected',()=>{
 const s=host();const id=s.onAir.track;assert.equal(selectSleeve(s,9),false);assert.ok(selectSleeve(s,1));
 changeEdit(s);assert.equal(s.onAir.track,id);assert.equal(s.edit,1);
 assert.equal(beginFade(s,0),false);assert.equal(s.fade,null);assert.ok(drain(s).some(e=>e.kind==='early'));
});
test('downbeat and phrase grading follow drifting song landmarks and wrong energy costs points',()=>{
 const s=host(19,4);bestCut(s);const target=s.request.target,best=grade(s,target);
 assert.equal(best.timing,27);assert.equal(best.phrase,22);assert.equal(best.energy,26);assert.equal(best.curve,13);
 assert.ok(grade(s,target+.21).timing<6);assert.ok(grade(s,target+s.request.bar).phrase<best.phrase);
 const song=byId[s.onAir.track],beat=phaseAt(song,chartTime(s.onAir,target-s.started)).beat;
 assert.equal(Math.round(beat),s.request.phraseBeat);
 let found=false;for(let i=0;i<s.choices.length;i++){selectSleeve(s,i);for(let j=0;j<allEdits.length;j++){if(grade(s,target).energy<26)found=true;changeEdit(s);}}assert.ok(found);
});
test('a real crossfade tempo-matches the incoming measured bar and marks exactly one listener request',()=>{
 const s=host(9);bestCut(s);advance(s,s.request.target);assert.ok(beginFade(s));const next=s.fade.next;
 const raw=barDuration(byId[next.track],next.offset)/s.request.bar;
 assert.equal(next.rate,Math.min(1.18,Math.max(.84,raw)));assert.equal(selectSleeve(s,1),false);
 advance(s,s.time+s.fade.duration*.5);assert.ok(Math.abs(s.fade.position-.5)<1e-7);
 settle(s);assert.equal(s.onAir.track,next.track);assert.equal(s.turn,1);assert.equal(s.side,1);assert.ok(s.blends===1);assert.ok(s.score>70);
});
test('manual fader runs either direction, does not silently advance, and rescues a stalled middle',()=>{
 const s=host(2,6);advance(s,s.request.target);assert.ok(handFader(s,.14));advance(s,s.time+.2);
 assert.equal(s.fade.position,.14);handFader(s,.59);advance(s,s.time+.6);handFader(s,1);assert.equal(s.side,1);
 advance(s,s.request.target);assert.ok(handFader(s,.8));assert.ok(Math.abs(s.fade.position-.2)<1e-8);
 advance(s,s.time+s.fade.duration*2.6);assert.equal(s.turn,2);assert.equal(s.side,0);
});
test('missed shows keep a continuous outgoing bed, and cannot mint a blend or signature',()=>{
 const s=host();advance(s,s.request.deadline+.05);assert.equal(s.fade.missed,true);settle(s);assert.equal(s.points,0);assert.equal(s.blends,0);assert.equal(s.misses,1);assert.deepEqual(s.signatures,[]);
});
test('archive tolerates legacy/damaged saves, enforces unlock sequence and merges pairing bests',()=>{
 const blank=readLibrary({best:900,dj:{grades:[0,3],mixes:[{points:100,a:'n/a',b:'agi'}],daily:{day:'bad'}}});assert.equal(blank.unlocked,0);assert.deepEqual(blank.mixes,[]);assert.equal(blank.daily,null);
 const base=broadcast('expert',77,'hosted',0);
 const saved=archiveRun(readLibrary({}),base);assert.ok(saved.grades[0]>=2);assert.equal(saved.unlocked,1);
 assert.deepEqual(availableEdits(saved,0,'hosted'),['hook','intro']);
 const twice=archiveRun(saved,{...base,mixes:base.mixes.map(m=>({...m,points:1}))});assert.equal(twice.mixes[0].points,saved.mixes[0].points);
 assert.equal(archiveRun(saved,{...base,mode:'daily',day:'2026-11-18'}).daily.day,'2026-11-18');
});
test('every hosted programme reaches sign-off, new seeds alter pairings, and campaign exceeds twenty active minutes',()=>{
 let duration=0;
 for(let i=0;i<SHIFTS.length;i++){const result=broadcast('steady',22703+i*73,'hosted',i);assert.equal(result.count,SHIFTS[i].count);assert.ok(result.finished);duration+=result.seconds;}
 assert.ok(duration>=20*60);
 assert.deepEqual(broadcast('expert',43,'daily'),broadcast('expert',43,'daily'));
 assert.notDeepEqual(broadcast('expert',43,'daily').mixes,broadcast('expert',44,'daily').mixes);
});
test('endless distinguishes the three simulated DJs across seeds',()=>{
 const median=name=>{const secs=Array.from({length:24},(_,i)=>broadcast(name,2003+i*73,'late').seconds).sort((a,b)=>a-b);return secs[Math.floor(secs.length/2)];};
 const beginner=median('newcomer'),normal=median('steady'),expert=median('expert');
 assert.ok(beginner>=45);assert.ok(normal>=120&&normal<=310);assert.ok(expert>normal*1.35);
});
test('equal-power envelopes preserve power, endpoints and master headroom across the whole fade',()=>{
 const a=fadeCurve(false),b=fadeCurve(true);assert.equal(a.length,b.length);assert.ok(a[0]>.45&&b[0]===0);assert.ok(a.at(-1)<1e-6&&b.at(-1)>.45);
 for(let i=0;i<=128;i++){const [left,right]=equalPower(i/128);assert.ok(Math.abs(left*left+right*right-1)<1e-10);assert.ok(DECK_GAIN*(left+right)+CUE_GAIN+.15<1);}
});
test('loading the full recording falls back to its same-origin original, reuses a live load and releases superseded ones',async()=>{
 const seen=[],ctx={decodeAudioData:async data=>({duration:10,length:data.byteLength})};
 const bank=createRecordBank(ctx,async(url,options)=>{seen.push([url,options.signal]);return {ok:url.startsWith('/music/'),status:404,arrayBuffer:async()=>new ArrayBuffer(8)};});
 const p=bank.load('agi');assert.equal(bank.load('agi'),p);assert.equal((await p).length,8);assert.deepEqual(seen.map(v=>v[0]),trackURLs('agi'));
 bank.retain([]);assert.equal(bank.size,0);assert.ok(seen[0][1].aborted);
});
test('strictly silent demos create no audio nodes and never touch the player library',()=>{
 const silent=createDeskSound({get ctx(){throw new Error('audio opened in demo');}},{demo:true});silent.sync({});silent.cue({});silent.pause();silent.dispose();assert.equal(silent.now(3),3);
 let writes=0,over=0;const m=game.create({demo:true,seed:7,store:{read:()=>({}),update:()=>writes++},hud(){},end(){over++;}});
 for(let i=0;i<120*130;i++){m.demo();m.update(1/120);}assert.equal(over,1);m.dispose();assert.equal(writes,0);
});
test('screen-specific layout preserves reachable boards and geometry over all required aspect ratios',()=>{
 for(const [w,h] of [[360,370],[450,210],[884,780],[2560,1130],[480,480]]){
  const layout=deskLayout(w,h);
  for(const a of [...layout.decks,layout.request,layout.meters]){assert.ok(a.x>=0&&a.y>=0&&a.x+a.w<=w+.01&&a.y+a.h<=h+.01);assert.ok(a.w>100&&a.h>=30);}
 }
 assert.equal(deskLayout(450,210).side,true);assert.equal(deskLayout(360,370).side,false);
});
test('all scripts have contextual, lowercase AGI-1 lines and use the native kit structure',()=>{
 const lines=Object.values(LINES).flat();assert.ok(new Set(lines).size>=36);
 for(const line of lines){assert.equal(line,line.toLowerCase());assert.ok(line.length<92);assert.doesNotMatch(line,/\b(?:profit|price|invest|buy|pump)\b/i);}
 const entry=readFileSync(new URL('../src/games/tidepool/page.js',import.meta.url),'utf8');assert.match(entry,/mountRemaster/);
 for(const mode of ['hosted','late','daily'])assert.ok(game.modes.some(m=>m.id===mode));
});

test('an early tap arms exactly one assisted entry, a second tap cancels and a hand movement does not arm it',()=>{
 const s=host(3);beginFade(s,0);assert.equal(s.armed,true);beginFade(s,.1);assert.equal(s.armed,false);
 handFader(s,.3,.11);assert.equal(s.armed,false);beginFade(s,.12);advance(s,s.request.open+.02);assert.ok(s.fade);
 assert.ok(drain(s).some(e=>e.kind==='assisted'));settle(s);assert.equal(s.blends,1);assert.equal(s.armed,false);
});
test('idle broadcasts never open the next show and the seed of a completed broadcast can replay its original episode',()=>{
 const s=host(7);
 while(!s.ended){advance(s,s.request.deadline+.1);settle(s);}
 const empty=archiveRun(readLibrary({}),resultOf(s));assert.equal(empty.unlocked,0);assert.equal(empty.grades[0],0);
 const complete=archiveRun(readLibrary({}),broadcast('expert',7,'hosted',0));assert.equal(complete.unlocked,1);assert.deepEqual(complete.lastHosted,{seed:7,shift:0});
 assert.equal(readLibrary({dj:{grades:[0,3,3]}}).grades[2],0);
});
test('the transport schedules two sources on one audio clock, keeps one per deck and releases them on pause or dispose',async()=>{
 const starts=[],stops=[],curves=[];
 function param(){return {value:0,setValueAtTime(){},setTargetAtTime(){},cancelScheduledValues(){},linearRampToValueAtTime(){},setValueCurveAtTime(values,start,length){curves.push({values,start,length});}};}
 const base=()=>({connect(){},disconnect(){}});
 const c={currentTime:0,state:'running',decodeAudioData:async()=>({duration:240}),
  createBufferSource:()=>({...base(),playbackRate:param(),start(when,offset){starts.push([when,offset]);},stop(){stops.push(1);}}),
  createGain:()=>({...base(),gain:param()}),createAnalyser:()=>({...base(),fftSize:0,getFloatTimeDomainData(data){data.fill(.05);}})};
 const ctx=createDeskSound({ctx:c,musicBus:base},{fetcher:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(10)})});
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 const s=host(9);ctx.sync(s);await flush();ctx.sync(s);ctx.sync(s);assert.equal(starts.length,1);assert.ok(starts[0][1]>=s.onAir.offset);
 c.currentTime=s.request.target;advance(s,c.currentTime);beginFade(s);ctx.sync(s);await flush();ctx.sync(s);assert.equal(starts.length,2);assert.ok(curves.length>=2);
 assert.ok(ctx.meter(0)>0);ctx.pause();assert.equal(stops.length,2);
 c.currentTime+=10;ctx.resume(s.time);ctx.sync(s);await flush();ctx.sync(s);assert.equal(starts.length,4);
 assert.ok(Math.abs(ctx.now(0)-s.time)<1e-7);ctx.dispose();assert.equal(starts.length,stops.length);
});
test('the empty first crate reaches a real keeper and scores it during the preview capture window',()=>{
 let points=0;const m=game.create({seed:7,demo:true,hud:(a,n)=>{points=n;},end(){}});
 for(let i=0;i<120*8.5;i++){m.demo();m.update(1/120);}
 assert.ok(points>0);m.dispose();
});

test('the native fader unlocks on its real cue and preserves the rest of the dock throughout a finger gesture',()=>{
 const s=host(21,4);
 assert.equal(controlsFor(s,-1).find(c=>c.id==='fader').disabled,true);
 advance(s,s.request.target);const before=controlsFor(s,-1).map(({value,...descriptor})=>descriptor);
 handFader(s,.3);assert.equal(s.fade.manual,true);
 assert.deepEqual(controlsFor(s,-1).map(({value,...descriptor})=>descriptor),before);
 handFader(s,.7);assert.equal(controlsFor(s,-1).find(c=>c.id==='fader').value,70);
});
