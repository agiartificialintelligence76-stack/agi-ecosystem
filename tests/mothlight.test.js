import test from 'node:test';
import assert from 'node:assert/strict';
import camera from '../src/games/mothlight/game.js';
import {COMMISSIONS, CANDIDS} from '../src/games/mothlight/assignments.js';
import {project,neutral,pointAt,focusQuality,reflected,occlusion} from '../src/games/mothlight/camera.js';
import {sceneAt,schedule,gradeShot,anchor} from '../src/games/mothlight/scene.js';
import {openRoll,configFor,adjust,expose,keep,another,candid,tick,resultOf,turnSpread,recipe,readRecipe,printOf} from '../src/games/mothlight/run.js';
import {readAlbum,archive,filePrint,flipPin,turnFrame,selectedRoll} from '../src/games/mothlight/album.js';
import {bestCamera,makePhotographer} from '../src/games/mothlight/photographers.js';
import {soundFor,CUES} from '../src/games/mothlight/sound.js';

const close=(a,b,e=.00001)=>assert.ok(Math.abs(a-b)<=e,a+' vs '+b);
const campaign=(roll=0)=>openRoll(configFor('campaign',roll,71));
const snap=(i=0,seed=7,offset=0)=>{
 const plan=schedule(i,seed),t=plan.first+offset,scene=sceneAt(plan,t),cam=bestCamera(scene,neutral()).cam;
 return printOf(recipe(plan,t,cam));
};
function harness(mode='darkroom',demo=false){
 let saved={},end=null,controls=[],tones=0,says=[];
 const model=camera.create({mode,seed:9,options:{},demo,store:{read:()=>saved,update(fn){saved=fn(saved);}},
 controls:a=>{controls=a;},say:s=>says.push(s),end:(score,stats)=>{end={score,stats};},
 audio:{tone(){tones++;},noise(){tones++;}}});
 return {model,get saved(){return saved;},get end(){return end;},get controls(){return controls;},get tones(){return tones;},says};
}
test('eight four-appointment sets and eight bonus candids all have unique ids',()=>{
 assert.equal(COMMISSIONS.length,32);assert.equal(CANDIDS.length,8);
 assert.equal(new Set([...COMMISSIONS,...CANDIDS].map(a=>a.id)).size,40);
 for(let i=0;i<8;i++)assert.equal(COMMISSIONS.filter(a=>a.place===i).length,4);
});
test('truck displacement and projected size depend on true depth',()=>{
 const n=neutral(),a={x:.1,y:1.30,z:2},b={...a,z:6};
 close(project(a,n,1).scale/project(b,n,1).scale,3);
 const delta=p=>project(p,n,1).u-project(p,{...n,truck:.5},1).u;close(delta(a)/delta(b),3);
});
test('panning to a near eye changes film position independently of focus and zoom',()=>{
 const p={x:.44,y:1.73,z:3.25};const n=pointAt(neutral(),p,{u:.5,v:.35}),v=project(p,n,1);
 close(v.u,.5);close(v.v,.35);assert.ok(project(p,n,2).scale>v.scale);
 assert.equal(focusQuality(4,4,2),1);assert.ok(focusQuality(4,2,2)<focusQuality(4,2,0));
});
test('depth-aware strips union, partial obstruction and horizontal parallax',()=>{
 const p={x:0,y:1.4,z:4},cam=neutral(),post={x:0,z:2,r:.025,bottom:0,top:2};
 const partial=occlusion(p,cam,[post]);assert.ok(partial>0&&partial<1);close(partial,occlusion(p,cam,[post,post]));
 assert.equal(occlusion(p,{...cam,truck:.55},[post]),0);assert.equal(occlusion(p,cam,[{...post,z:5}]),0);
 assert.equal(occlusion(p,cam,[{...post,top:.25}]),0);
});
test('reflections are mirrored around the set floor at the same physical depth',()=>{
 const pt={x:.2,y:1.44,z:3.461};assert.deepEqual(reflected(pt),{...pt,y:-1.44});
 const sc=sceneAt(schedule(COMMISSIONS.find(a=>a.ask==='reflection').id,7),5);
 const aim=bestCamera(sc,neutral()).cam,low=pointAt(aim,sc.foot,{u:.5,v:.98}),high=pointAt(aim,sc.foot,{u:.5,v:.51});
 assert.ok(gradeShot(sc,high).request>gradeShot(sc,low).request);
});
test('the waveback decoy and true turnaround score different gesture timing',()=>{
 const p=schedule(COMMISSIONS.find(a=>a.pose==='waveback').id,9),fake=sceneAt(p,p.first-2.2),real=sceneAt(p,p.first);
 assert.ok(fake.falseWave>.99&&real.gesture>.99);
 assert.ok(gradeShot(real,neutral()).parts.gesture-gradeShot(fake,neutral()).parts.gesture>19);
});
test('all forty commissions have a clean reachable peak across 48 seeds',()=>{
 let minimum=100;
 for(const a of [...COMMISSIONS,...CANDIDS])for(let n=1;n<=48;n++){
  const p=schedule(a.id,n);
  const g=[0,1,2].map(cycle=>bestCamera(sceneAt(p,p.first+cycle*p.period),neutral()).grade).sort((a,b)=>b.score-a.score)[0];
  assert.equal(Object.values(g.parts).reduce((x,y)=>x+y),g.score);assert.equal(g.parts.gesture,25);
  assert.ok(g.parts.framing<=30&&g.parts.focus<=25&&g.parts.request<=20);
  assert.ok(g.cover<.3,JSON.stringify([a.id,n,g.cover]));minimum=Math.min(minimum,g.score);
 }
 assert.ok(minimum>=80,String(minimum));
});
test('only two negatives, frozen exposure, and explicit first-print selection',()=>{
 const s=campaign();tick(s,2.5);const p=expose(s);assert.equal(expose(s),null);const age=s.age;
 tick(s,6);assert.equal(s.age,age);assert.equal(s.develop,0);
 assert.equal(another(s),true);adjust(s,'lens',2);const q=expose(s);assert.notEqual(p.recipe.key,q.recipe.key);
 assert.equal(another(s),false);assert.equal(keep(s,0),true);assert.equal(s.kept[0].recipe.key,p.recipe.key);assert.equal(s.index,1);
});
test('appointments expire honestly and Darkroom preserves both exposures after long study',()=>{
 const s=campaign();tick(s,90);assert.equal(s.missed,1);assert.equal(s.kept[0],null);
 const d=openRoll(configFor('darkroom',0,4));tick(d,320);assert.equal(d.phase,'live');assert.ok(expose(d));assert.equal(another(d),true);assert.ok(expose(d));assert.ok(keep(d));assert.equal(d.phase,'spread');
});
test('late second chance retains its first negative',()=>{
 const s=campaign();tick(s,3);expose(s);another(s);tick(s,90);assert.equal(s.phase,'review');assert.equal(s.takes.length,1);assert.ok(keep(s));assert.ok(s.kept[0]);
});
test('edits pair two distinct prints, optional candid extends exactly once',()=>{
 const s=campaign();for(let i=0;i<4;i++){tick(s,s.plan.first);expose(s);keep(s);}
 assert.equal(s.phase,'spread');assert.equal(resultOf(s).count,4);const before=s.context;turnSpread(s,'context');assert.notEqual(before,s.context);assert.notEqual(s.context,s.detail);
 assert.equal(candid(s),true);assert.equal(s.plan.id,CANDIDS[0].id);expose(s);keep(s);assert.equal(candid(s),false);assert.equal(resultOf(s).prints.length,5);
});
test('same camera recipe regenerates the exact frozen subject and four scores',()=>{
 const p=snap(2,931);const raw=JSON.parse(JSON.stringify(p.recipe));assert.deepEqual(printOf(raw),p);
 assert.ok(JSON.stringify(raw).length<300);assert.equal(readRecipe({...raw,t:NaN}),null);assert.equal(readRecipe({...raw,cam:{...raw.cam,focus:0}}),null);
});
test('same daily seed has three fixed jobs across locations',()=>{
 const a=configFor('daily',0,831),b=configFor('daily',4,831);assert.deepEqual(a.plans,b.plans);assert.equal(a.plans.length,3);assert.notDeepEqual(a.plans,configFor('daily',0,854).plans);
});
test('best-three shelf protects pinned prints and never admits a duplicate',()=>{
 let b=readAlbum();const first=snap(0,1,2.4);filePrint(b,first);b=flipPin({photoBook:b},first.recipe.key);
 for(let i=2;i<10;i++)filePrint(b,snap(0,i));filePrint(b,first);assert.equal(b.rows[0].length,3);
 assert.ok(b.rows[0].find(p=>p.recipe.key===first.recipe.key)?.pinned);
 for(const p of b.rows[0])p.pinned=true;const keys=b.rows[0].map(p=>p.recipe.key);filePrint(b,snap(0,639));assert.deepEqual(b.rows[0].map(p=>p.recipe.key),keys);
});
test('frame styles unlock with finished venues and captions persist',()=>{
 const p=snap();const r={prints:[p],score:99,grade:3,spread:'Spring in two frames.'};
 let b=archive({},configFor('campaign',0,7),r,'2026-11-17');assert.equal(b.unlocked,1);assert.equal(b.captions[0],r.spread);
 assert.equal(selectedRoll(b,'next',8),1);assert.equal(selectedRoll(b,7,8,true),0);
 b=turnFrame({photoBook:b},p.recipe.key);assert.equal(b.rows[0][0].frame,'film');
 b=archive({photoBook:b},configFor('daily',0,7),r,'2026-11-17');b=archive({photoBook:b},configFor('daily',0,7),{...r,score:2},'2026-11-17');assert.equal(b.daily.score,99);
});
test('an invalid row, broken comment or nonsequential grades recover',()=>{
 const p=snap();const b=readAlbum({photoBook:{rows:[[{recipe:null},{recipe:p.recipe,comment:'constructor'}]],stars:[0,3,3]}});
 assert.equal(b.rows[0].length,1);assert.equal(b.rows[0][0].comment,p.note);assert.equal(b.unlocked,0);assert.deepEqual(b.stars,[0,0,0,0,0,0,0,0]);
});
test('public touch and keyboard controls make a real saved print',()=>{
 const h=harness(),m=h.model;assert.ok(h.controls.find(d=>d.type==='range'));
 m.action('focus','input',5.15);m.action('lens','down');m.key('down','KeyE');m.action('tool','down');
 m.pointer('down',180,140,360,440);m.pointer('move',217,143,360,440);m.pointer('up',217,143,360,440);
 m.key('down','Space');m.action('keep-0','down');m.action('file','down');
 assert.ok(h.end.score>0);const p=h.saved.photoBook.rows[0][0].recipe;close(p.cam.focus,5.39);assert.equal(p.cam.lens,1);assert.notEqual(p.cam.truck,0);
});
test('pause freezes appointment and clears input, disposal does not save',()=>{
 const h=harness();h.model.pause();h.model.update(400);h.model.key('down','Space');assert.ok(h.controls.some(q=>q.id==='shoot'));
 h.model.resume();h.model.action('shoot','down');h.model.action('keep-0','down');h.model.action('file','down');
 assert.equal(h.saved.photoBook.rows[0][0].recipe.t,0);
 const q=harness();q.model.dispose();q.model.action('shoot','down');assert.deepEqual(q.saved,{});
});
test('preview really encounters the photobomb and develops a clear, sharp photograph',()=>{
 const cfg=configFor('campaign',0,7);cfg.plans=[schedule(2,9)];const s=openRoll(cfg),agent=makePhotographer('demo',7);let maxCover=0,minCover=1;
 for(let k=0;k<9*60;k++){agent(s,1/60);tick(s,1/60);if(s.phase==='live'){const g=gradeShot(sceneAt(s.plan,s.age),s.cam);maxCover=Math.max(maxCover,g.cover);if(s.age>6.3)minCover=Math.min(minCover,g.cover);}}
 assert.ok(maxCover>.75,String(maxCover));assert.ok(minCover<.15,String(minCover));assert.ok(s.takes[0].grade.score>=80);assert.equal(s.takes[0].grade.cover,0);
});
test('quiet gallery previews never create audio or write the album',()=>{
 const h=harness('campaign',true);h.model.demo();for(let k=0;k<2000;k++)h.model.update(1/60);
 assert.equal(h.tones,0);assert.deepEqual(h.saved,{});
 const calls=[],audio={tone:p=>calls.push(p),noise:p=>calls.push(p)},mix=soundFor(audio);
 for(const cue of Object.keys(CUES))mix.play(cue,1);assert.ok(calls.length<10);mix.update(2,4);assert.equal(calls.at(-1).bus,'music');
 mix.pause();const count=calls.length;mix.play('keeper',2.8);assert.equal(calls.length,count);
});
