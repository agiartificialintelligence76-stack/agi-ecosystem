import test from 'node:test';
import assert from 'node:assert/strict';
import game,{chooseNap} from '../src/games/rookery/game.js';
import {buildBoard,initial,finished,command,watched,pack,unpack,prefixAfter,CALL,DOT,WAIT,LEFT,RIGHT} from '../src/games/rookery/rules.js';
import {solve,replay} from '../src/games/rookery/solver.js';
import {NAPS,SPECS} from '../src/games/rookery/levels.js';
import {PROOFS} from '../src/games/rookery/proofs.js';
import {dailyNap} from '../src/games/rookery/daily.js';
import {readBook,archive,grade,nextNap,isOpen,posesFor,starTotal} from '../src/games/rookery/progress.js';
import {geometry,picked} from '../src/games/rookery/render.js';
import {VOICE} from '../src/games/rookery/lines.js';
import {instrument} from '../src/games/rookery/sound.js';

const tiny=(map,extra={})=>buildBoard({name:'Test keys',map,world:0,...extra});
function brute(b){
 const key=s=>[s.agi,s.cat,b.shy?s.face:0,s.lure,s.typed].join('/');
 const seen=new Set(),queue=[{s:initial(b),cost:0}];
 for(let i=0;i<queue.length;i++){
  const {s,cost}=queue[i];if(finished(b,s))return cost;
  for(const a of b.actions){const v=command(b,s,a),code=key(v);
   if(v===s||seen.has(code))continue;seen.add(code);queue.push({s:v,cost:cost+1});}
 }
 return null;
}
function run(opts={}){
 let raw=opts.raw||{};const end=[],voice=[],huds=[],controls=[];let writes=0;
 const model=game.create({seed:7,mode:'story',...opts,store:{read:()=>raw,update(fn){writes++;raw=fn(raw);return raw;}},
  hud:(...x)=>huds.push(x),end:(...x)=>end.push(x),say:x=>voice.push(x),controls:x=>controls.push(x)});
 return {model,end,voice,huds,controls,get raw(){return raw;},get writes(){return writes;},
  action:id=>model.action(id,'down'),key:k=>model.key('down',k),tick:t=>{for(let i=0;i<t*60;i++)model.update(1/60);}};
}
const whole=Object.fromEntries(PROOFS.map(p=>[p.id,p.witness]));
test('45 individual handmade maps across five keyboard families have distinct physical arrangements',()=>{
 assert.equal(NAPS.length,45);assert.equal(new Set(SPECS.map(s=>s.name)).size,45);
 assert.equal(new Set(SPECS.map(s=>s.map.join('/'))).size,45);
 for(let w=0;w<5;w++)assert.equal(NAPS.filter(b=>b.world===w).length,9);
});
test('every shortest witness and counterfactual is freshly verified against the authored map',()=>{
 for(const b of NAPS){
  const proof=PROOFS[b.id-1],plan=solve(b);assert.deepEqual(plan.path,proof.witness,b.name);
  assert.equal(plan.path.length,proof.par);assert.equal(finished(b,replay(b,plan.path).state),true,b.name);
  const alt=b.feature==='word'?solve(buildBoard({...SPECS[b.id-1],word:''})):solve(b,initial(b),b.feature);
  assert.equal(alt?.path.length??null,proof.without,b.name);
  if(b.feature==='word')assert.ok(proof.without<proof.par,b.name);
  else assert.ok(proof.without===null||proof.without>proof.par,b.name);
 }
});
test('an independent string-keyed queue agrees on every small chapter opener plus an impossible desk',()=>{
 const rooms=[0,8,16,24,32].map(i=>NAPS[i]);rooms.push(tiny(['c#o','###','@..']));
 for(const b of rooms)assert.equal(brute(b),solve(b)?.path.length??null,b.name);
});
test('encoded identity preserves every rule-relevant field including gaze, lure, typed prefix',()=>{
 const b=NAPS[39];let s=initial(b);for(const a of PROOFS[39].witness){s=command(b,s,a);assert.deepEqual(unpack(b,pack(b,s)),s);}
});
test('a call needs unobstructed orthogonal hearing, moves once and leaves the caller alone',()=>{
 for(const b of [tiny(['@#co']),tiny(['@.o','..c'])]){const s=initial(b);assert.equal(command(b,s,CALL),s);}
 const b=tiny(['@..co']),s=initial(b),e={};const n=command(b,s,CALL,e);assert.equal(n.cat,2);assert.equal(n.agi,s.agi);assert.equal(e.kind,'call');assert.equal(command(b,n,CALL).cat,1);
});
test('polished keycaps coast to dry ground or stop at her shoes and off-desk edges',()=>{
 const b=tiny(['@c~~o']),e={};assert.equal(command(b,initial(b),1,e).cat,4);assert.equal(e.slide,true);
 const k=tiny(['@~~co']);const next=command(k,initial(k),CALL);assert.equal(next.cat,1);assert.equal(next.agi,0);
 const wall=tiny(['@c~~#o']);assert.equal(command(wall,initial(wall),1).cat,3);
});
test('laser only accepts marked caps, persists between turns and toggles off',()=>{
 const b=tiny(['@#c.o*']);let s=initial(b);assert.equal(command(b,s,DOT+99),s);s=command(b,s,DOT);
 assert.equal(s.cat,3);assert.equal(s.lure,1);const off=command(b,s,DOT);assert.equal(off.lure,0);assert.equal(off.cat,3);
 assert.equal(command(b,s,WAIT).cat,4);
});
test('shy cat freezes under observation, walks on turned gaze, and blockers interrupt a gaze ray',()=>{
 const b=NAPS[32];let s=initial(b);assert.ok(watched(b,s));assert.equal(command(b,s,WAIT),s);
 s=command(b,s,LEFT);assert.equal(s.cat,b.cat+1);assert.equal(watched(b,s),false);s=command(b,s,LEFT);assert.ok(finished(b,s));
 const blocked=tiny(['@#c.o'],{world:4});assert.equal(watched(blocked,initial(blocked)),false);
});
test('active lure has priority over a clear call, and no turn gives a second autonomous cat step',()=>{
 const b=tiny(['@.c..*o'],{world:4,face:3});let s=initial(b);const active=command(b,s,DOT);
 const e={};s=command(b,active,CALL,e);assert.equal(s.cat,4);assert.equal(e.kind,'laser');assert.equal(s.agi,0);
});
test('only the final landing types; a correct complete word remains latched while walking home',()=>{
 const b=tiny(['@c~Zo'],{word:'Z'});let s=command(b,initial(b),1);assert.equal(s.cat,3);assert.equal(s.typed,1);s=command(b,s,1);s=command(b,s,1);assert.ok(finished(b,s));
 assert.equal(prefixAfter('ABA',2,'A'),3);assert.equal(prefixAfter('ABA',2,'B'),0);assert.equal(prefixAfter('ABA',1,'A'),1);assert.equal(prefixAfter('ABA',3,'B'),3);
});
test('final piano witness contains a nudge, call, glide, laser, type and voluntary creep',()=>{
 assert.deepEqual(new Set(PROOFS[39].habits),new Set(['push','call','slide','laser','type','creep']));
});
test('each UTC seed builds a genuinely changed physical board with a valid, exact witness',()=>{
 const seen=new Set();
 for(let seed=20261101;seed<=20261196;seed++){
  const d=dailyNap(seed);assert.notDeepEqual(d.board.map,SPECS[d.board.id-1].map);seen.add(d.signature);
  assert.deepEqual(dailyNap(seed).proof,d.proof);assert.equal(solve(d.board).path.length,d.proof.par);assert.ok(finished(d.board,replay(d.board,d.proof.witness).state));
 }
 assert.ok(seen.size>75);
});
test('stars separate par, par+3 and completion; saved witnesses reject corrupt or unfinished input',()=>{
 assert.deepEqual([grade(5,5),grade(8,5),grade(9,5)],[3,2,1]);
 const book=readBook({napBook:{runs:{1:[1],2:[4],3:[999],4:'not a replay'},daily:{date:'bad'}}});
 assert.deepEqual(book.runs,{1:[1]});assert.equal(book.daily,null);assert.equal(starTotal(book),3);
});
test('the fifth nap opens a family, the eighth opens its encore, and all 45 unlock six journal poses',()=>{
 let raw={};for(const b of NAPS.slice(0,8)){
  raw={napBook:archive(raw,b,PROOFS[b.id-1].witness,PROOFS[b.id-1].par,9)};
  assert.equal(isOpen(NAPS[8],raw.napBook),b.id>=5);assert.equal(isOpen(NAPS[40],raw.napBook),b.id>=8);
 }
 assert.equal(posesFor(readBook({napBook:{runs:whole}})).length,6);assert.equal(starTotal(readBook({napBook:{runs:whole}})),135);
 assert.equal(nextNap(readBook(raw)).id,9);
});
test('a longer replay never overwrites a better personal path, and fresh run advances while same seed retries',()=>{
 const b=NAPS[0];let book=archive({},b,[1],1,7);
 book=archive({napBook:book},b,[0,2,1],1,7);assert.deepEqual(book.runs[1],[1]);
 assert.equal(chooseNap(book,7,'next').id,1);assert.equal(chooseNap(book,9,'next').id,2);assert.equal(chooseNap(book,9,'40').id,2);
});
test('daily has a separate dated best, while a story uses its own witness and preserves prior user data',()=>{
 const g=run({raw:{existing:'preserve'}});g.key('ArrowRight');g.tick(1.3);assert.equal(g.raw.existing,'preserve');assert.deepEqual(g.raw.napBook.runs[1],[1]);
 const b=NAPS[0],day='2026-11-18';const d=archive(g.raw,b,[1],1,2,day);assert.deepEqual(d.daily,{date:day,moves:1,stars:3});assert.deepEqual(d.runs,{1:[1]});
});
test('pointer targeting uses the exact keyboard-focusable anchors and agrees with digit plus wait on the numpad',()=>{
 const raw={napBook:{runs:whole}},opts={raw,options:{nap:'17'}};
 const a=run(opts),b=run(opts);const board=NAPS[16],g=geometry(board,360,420-35),target=board.anchors[0],px=g.gridX+(target%board.cols+.5)*g.cw,py=g.gridY+(Math.floor(target/board.cols)+.5)*g.ch;
 assert.equal(picked(board,g,px,py),target);a.model.pointer('down',px,py,360,420);a.model.pointer('up',px,py,360,420);
 b.key('Digit1');assert.ok(a.controls.at(-1).find(c=>c.id==='dot-0').pressed);a.action('wait');b.key('KeyT');a.tick(1.4);b.tick(1.4);
 assert.deepEqual(a.end,b.end);assert.equal(a.end.length,1);
});
test('undo restores the whole gaze/lure snapshot, hint shows paw response before giving the action, and a canceled swipe is inert',()=>{
 const g=run({raw:{napBook:{runs:whole}},options:{nap:'40'}});g.key('Digit2');g.key('KeyE');g.key('KeyZ');g.key('KeyZ');assert.equal(g.huds.at(-1)[1],0);
 g.action('hint');assert.match(g.voice.at(-1),/Ask again/);g.action('hint');assert.match(g.voice.at(-1),/Try dot/);
 g.model.pointer('down',67,130,360,400);g.model.pointer('cancel',67,130,360,400);g.model.pointer('up',135,130,360,400);assert.equal(g.huds.at(-1)[1],0);
});
test('normal keyboard/touch wins are positive, pause freezes a pending ending, and demo does not save',()=>{
 const g=run();g.key('ArrowRight');g.model.pause();g.tick(2);assert.equal(g.end.length,0);g.model.resume();g.tick(1.35);assert.equal(g.end[0][0],728);
 const a=run({demo:true});for(let i=0;i<1200;i++){a.model.demo(1/60);a.model.update(1/60);}assert.equal(a.writes,0);assert.ok(a.end.length);
});
test('journal replays the recorded best path without resaving or ending the journal',()=>{
 const g=run({mode:'journal',raw:{napBook:{runs:{1:[1]}}}});g.action('pet');g.action('pose');g.key('KeyV');assert.ok(g.controls.at(-1).some(c=>c.id==='stop-replay'));g.tick(3);
 assert.equal(g.end.length,0);assert.equal(g.writes,0);assert.ok(g.controls.at(-1).some(c=>c.id==='pet'));
});
test('45 custom lines and color-independent reactions; distinct material sounds are quiet and rate limited',()=>{
 assert.ok(new Set(VOICE).size>=40);const sounds=[],audio={ctx:{currentTime:0},tone:o=>sounds.push(o),noise:o=>sounds.push(o)};
 const s=instrument(audio),types=[];
 for(let i=0;i<5;i++){audio.ctx.currentTime+=.1;const before=sounds.length;s('step',i);types.push(sounds[before].freq);s('step',i);assert.equal(sounds.length,before+2);}
 assert.equal(new Set(types).size,5);audio.ctx.currentTime+=1;s('nap');assert.ok(sounds.every(o=>o.bus==='sfx'&&o.vol<=.13));
 const was=sounds.length;instrument(audio,true)('nap');assert.equal(sounds.length,was);
});
test('all 45 campaigns can be earned through the public keyboard route, including grants and encores',()=>{
 const keys=['ArrowUp','ArrowRight','ArrowDown','ArrowLeft','KeyC','KeyQ','KeyE','KeyT','Digit1','Digit2','Digit3','Digit4','Digit5'];
 let raw={};
 for(const b of NAPS){
  const g=run({raw,seed:b.id*103+77,options:{nap:String(b.id)}});
  for(const a of PROOFS[b.id-1].witness)g.key(keys[a]);
  g.tick(1.3);assert.equal(g.end.length,1,b.name);assert.equal(g.end[0][1][0][1],b.name);
  assert.equal(g.end[0][1][1][1],'★★★');raw=g.raw;
 }
 assert.equal(Object.keys(raw.napBook.runs).length,45);assert.match(game.progress(raw),/135\/135/);
});

test('shortest certified Daily Cat can be completed through native actions and writes the dated daily only',()=>{
 const d=dailyNap(20261118),g=run({mode:'daily',seed:20261118});
 const ids=['up','right','down','left','call','look-left','look-right','wait','dot-0','dot-1','dot-2','dot-3','dot-4'];
 for(const a of d.proof.witness)g.action(ids[a]);g.tick(1.3);
 assert.equal(g.end[0][1][1][1],'★★★');assert.deepEqual(g.raw.napBook.runs,{});
 assert.equal(g.raw.napBook.daily.moves,d.proof.par);
});
