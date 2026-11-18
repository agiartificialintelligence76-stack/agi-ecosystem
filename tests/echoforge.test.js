import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import game from '../src/games/echoforge/game.js';
import {songs,arrange,chooseTake,answerLane,voicePitch,phraseAt,beatTime,levels,parts} from '../src/games/echoforge/setlist.js';
import {Performance,timing,gradeOf,WINDOWS} from '../src/games/echoforge/performance.js';
import {player,excerpt,skillNames} from '../src/games/echoforge/player.js';
import {readBook,keepTake,takeKey} from '../src/games/echoforge/progress.js';
import {LINES,say} from '../src/games/echoforge/lines.js';
import {soundtrack,heardAt,MIX} from '../src/games/echoforge/sound.js';
import {layout} from '../src/games/echoforge/layout.js';

const chart=(difficulty='studio',part='lead',seed=7)=>arrange({tune:songs[0],difficulty,part,seed});
const original=id=>JSON.parse(readFileSync(new URL('../src/games/heartbeat/charts/'+id+'.json',import.meta.url)));
const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function memory(){
 let data={ownerSetting:'preserved',oldScore:600};
 return {read:()=>structuredClone(data),update(fn){const next=structuredClone(data);data=fn(next)||next;}};
}
function watch(extra={}){
 const hud=[],end=[],lines=[],effects=[];
 const api={seed:7,mode:'setlist',options:{song:'agi'},reducedMotion:true,store:memory(),hud:(...a)=>hud.push(a),
  say:l=>lines.push(l),effect:(...a)=>effects.push(a),end:(...a)=>end.push(a),...extra};
 const model=game.create(api);
 function tick(seconds,auto=false){for(let n=0;n<Math.round(seconds*120);n++){if(auto)model.demo();model.update(1/120);}}
 return {api,model,tick,hud,end,lines,effects};
}

test('seven independent full recordings retain each source downbeat, tempo drift, duration and original MP3',()=>{
 assert.equal(songs.length,7);
 assert.ok(songs.reduce((n,s)=>n+s.duration,0)>22*60);
 for(const tune of songs){
  const src=original(tune.id);
  assert.deepEqual(tune.beats,src.beats);
  assert.equal(tune.bar,src.bar);assert.equal(tune.duration,src.duration);
  assert.equal(tune.harmony.length,Math.ceil((tune.beats.length-tune.bar-8)/8));
  assert.ok(tune.harmony.every(([root,third])=>Number.isInteger(root)&&root>=0&&root<12&&[3,4].includes(third)));
  const mp3=readFileSync(new URL('../public/games/heartbeat/audio/'+tune.id+'.mp3',import.meta.url));
  assert.ok(mp3.length>1000000);
 }
});
test('all 63 song, arrangement and part combinations keep musical order and leave breathing room',()=>{
 for(const tune of songs)for(const difficulty of levels)for(const part of parts){
  const c=arrange({tune,difficulty,part,seed:17});
  assert.equal(c.phrases.length,tune.harmony.length);assert.ok(c.notes.length>=80);
  assert.ok(c.phrases.every(p=>p.start<p.reply&&p.reply<p.end&&p.end<c.duration));
  assert.ok(c.notes.every((n,i)=>n.index===i && n.at<=n.until && n.until<c.phrases[n.phrase].end
   && n.at>=c.phrases[n.phrase].reply && n.lane===answerLane(n.lead,part)));
  assert.ok(c.calls.every((n,i)=>n.at<c.notes[i].at));
  assert.ok(c.notes.every((n,i)=>!i||n.at>c.notes[i-1].at));
  assert.ok(c.notes.some(n=>n.until>n.at));
  assert.equal(c.phrases[0].notes.length,2);assert.equal(c.phrases[1].notes.length,2);
  assert.deepEqual(c.phrases[0].notes.map(n=>n.lead),c.phrases[1].notes.map(n=>n.lead));
  assert.notDeepEqual(c.phrases[0].notes.map(n=>n.offset),c.phrases[1].notes.map(n=>n.offset));
 }
});
test('upper and lower harmonies resolve to actual chord tones above and below the original lead',()=>{
 for(const [root,third] of [[1,3],[0,4],[11,3]])for(let note=0;note<3;note++){
  const lead=voicePitch([root,third],note,'lead',note);
  const upper=voicePitch([root,third],answerLane(note,'upper'),'upper',note);
  const lower=voicePitch([root,third],answerLane(note,'lower'),'lower',note);
  assert.ok(upper>lead && upper-lead<=5);assert.ok(lower<lead && lead-lower<=5);
 }
});
test('daily selection ignores menu overrides, deterministic arrangements vary with their seed and phrase lookup follows real beats',()=>{
 const a=chooseTake(20261118,'daily',{song:'agi',difficulty:'headliner'});
 assert.deepEqual(a,chooseTake(20261118,'daily',{song:'send-it',part:'lower'}));
 const signatures=new Set();
 for(let d=1;d<14;d++){
  const b=chooseTake(20261100+d,'daily');signatures.add([b.tune.id,b.part,b.difficulty].join());
 }
 assert.ok(signatures.size>7);
 const c1=chart(),c2=chart('studio','lead',9);assert.deepEqual(c1,chart());assert.notDeepEqual(c1.notes,c2.notes);
 for(const p of c1.phrases){assert.equal(phraseAt(c1,p.start),p);assert.equal(phraseAt(c1,p.end-.001),p);}
 assert.ok(Math.abs(beatTime([.1,.6,1.2],1.5)-.9)<1e-12);
});
test('exact millisecond windows and the grades agree on both early and late boundaries',()=>{
 for(const d of levels)for(const sign of [-1,1]){
  for(const name of ['perfect','great','good'])assert.equal(timing(sign*WINDOWS[d][name],d),name);
  assert.equal(timing(sign*(WINDOWS[d].good+.001),d),'miss');
 }
 assert.deepEqual([1,.965,.86,.7,.50,0].map(gradeOf),['S','S','A','B','C','D']);
});
test('wrong pitch spends that note, misses expire, rehearsal rests stay clean and holding a pad cannot retrigger it',()=>{
 const c=chart(),run=new Performance(c),n=c.notes[0];
 run.press(2,c.phrases[0].start);run.release(2,c.phrases[0].start+.04);assert.equal(run.strays,0);
 run.press((n.lane+1)%3,n.at);run.press(n.lane,n.at);assert.equal(run.counts.wrong,1);assert.equal(run.counts.perfect,0);
 run.advance(c.notes[1].at+.4);assert.equal(run.counts.miss,1);
 const good=new Performance(c);good.press(n.lane,n.at);good.press(n.lane,n.at+.005);assert.equal(good.judged,1);
});
test('held tails follow the real release, early lifts cost the note, and a completed hold is judged only once',()=>{
 const c=chart(),n=c.notes.find(x=>x.until>x.at);
 for(const [when,kind] of [[n.at+.02,'short'],[n.until,'perfect']]){
  const run=new Performance(c);
  run.press(n.lane,n.at);assert.equal(run.state[n.index].kind,'holding');
  run.release(n.lane,when);run.advance(n.until+.2);
  assert.equal(run.state[n.index].kind,kind);
  assert.equal(run.counts[kind],1);
 }
 const run=new Performance(c);run.press(n.lane,n.at);run.releaseInputs();run.advance(n.until);
 assert.equal(run.state[n.index].kind,'perfect');
});
test('three different skill profiles finish an entire original track with ordered grades and no unjudged notes',()=>{
 const c=chart('studio','upper'),results=[];
 for(const skill of skillNames){
  const run=new Performance(c),actions=player(c,skill,3);
  for(let t=0;t<=c.duration+.2;t+=1/60){
   actions(t,(down,k,at)=>down?run.press(k,at):run.release(k,at));run.advance(t);
  }
  const summary=run.report();assert.equal(summary.judged,c.notes.length);results.push(summary);
 }
 assert.ok(results[2].accuracy>.95);assert.ok(results[1].accuracy>results[0].accuracy+.15);assert.ok(results[2].accuracy>results[1].accuracy+.08);
});
test('a chorus excerpt reindexes notes and references independently and starts on a musical boundary',()=>{
 const c=chart(),sub=excerpt(c,17,12);
 assert.equal(sub.phrases.length,12);assert.equal(sub.start,c.phrases[17].start-.25);
 assert.equal(sub.notes[0].index,0);assert.equal(sub.notes[0].phrase,0);
 assert.equal(sub.duration,c.phrases[28].end+.45);
 assert.ok(sub.notes.at(-1).until<sub.duration);
});
test('songbook retains the better take per arrangement, daily results, attempts and older unrelated save values',()=>{
 const store=memory(),c=chart(),result={score:1500,grade:'A',accuracy:.86,bestCombo:13};
 keepTake(store,c,result,'20261118');keepTake(store,c,{...result,grade:'C',accuracy:.54},'20261118');
 assert.equal(readBook(store).records[takeKey(c)].takes,2);
 assert.equal(readBook(store).records[takeKey(c)].grade,'A');assert.equal(readBook(store).days['20261118'].grade,'A');
 assert.equal(store.read().ownerSetting,'preserved');assert.equal(store.read().oldScore,600);
 assert.match(game.progress(store.read()),/1 of 7/);
 assert.deepEqual(readBook({read:()=>({duetBook:{version:1,records:null}})}).records,{});
});
test('the headless audio clock and returned event positions freeze through pause and resume without drift',()=>{
 let perf=0;const s=soundtrack({demo:true},chart(),3,()=>perf);
 perf=48;assert.equal(s.update(.048),3.048);assert.equal(s.eventTime(400),3.048);
 s.pause();perf=5000;s.update(4);assert.equal(s.now,3.048);s.resume();s.update(.02);
 assert.ok(Math.abs(s.now-3.068)<1e-6);s.dispose();
 const ctx={currentTime:10,outputLatency:.05,getOutputTimestamp:()=>({contextTime:9.96,performanceTime:640})};
 assert.equal(heardAt(ctx,660),9.98);assert.equal(heardAt({...ctx,getOutputTimestamp:()=>({contextTime:2,performanceTime:2})},640),9.95);
 assert.ok(MIX.song<.7&&MIX.voice<.1);
});
test('DOM pad actions and physical keys score a live answer, use its configured offset, and survive paused inputs',()=>{
 for(const source of ['pad','key']){
  const g=watch({options:{song:'agi',sync:'100'}});
  const c=arrange(chooseTake(7,'setlist',g.api.options)),n=c.notes[0];
  g.tick(n.at+.10);g.model.pause();g.tick(2);g.model.resume();
  if(source==='key'){g.model.key('down',['KeyA','KeyS','KeyD'][n.lane]);g.model.key('up',['KeyA','KeyS','KeyD'][n.lane]);}
  else{g.model.action(['low','middle','high'][n.lane],'down');g.model.action(['low','middle','high'][n.lane],'up');}
  g.tick(.01);assert.equal(g.hud.at(-1)[1],100);
 }
});
test('normal full take writes a grade once; daily records its date; rehearsal and silent demo never add a saved take',()=>{
 for(const [mode,demo,duration] of [['setlist',false,172],['daily',false,245],['rehearse',false,48],['setlist',true,40]]){
  const g=watch({mode,demo});g.tick(duration,true);
  assert.equal(g.end.length,1,mode);assert.ok(g.end[0][0]>0);
  const saved=readBook(g.api.store);
  assert.equal(Object.keys(saved.records).length,(mode==='rehearse'||demo)?0:1);
  assert.equal(Object.keys(saved.days).length,mode==='daily'?1:0);
  assert.equal(g.end[0][1].find(s=>s[0]==='Grade')[1],'S');
 }
});
test('the venue and sheet fit five different screens, the voice script has 32 contextual choices, and the stage uses kit fonts and code art',()=>{
 for(const [w,h] of [[360,480],[720,272],[884,900],[1440,720],[2560,1250]]){
  const l=layout(w,h);assert.equal(l.wide,w>=h*1.12);
  for(const r of [l.stage,l.sheet]){assert.ok(r.x>=0&&r.y>=0&&r.w>0&&r.h>0);assert.ok(r.x+r.w<=w&&r.y+r.h<=h);}
 }
 const lines=Object.values(LINES).flat();assert.equal(new Set(lines).size,32);
 assert.ok(lines.every(s=>s===s.toLowerCase()&&!/\b(?:buy|price|profit|invest|pump)\b|\$agi/i.test(s)));
 for(const [key,bank] of Object.entries(LINES))assert.ok(bank.includes(say(key,()=>.5)));
 assert.ok(file('src/games/echoforge/page.js').trimStart().startsWith("import '../intro.js'"));
 assert.doesNotMatch(file('src/games/echoforge/stage.js'),/\.webp|drawImage|eval\(/);
 assert.equal(new Set(game.controls.map(x=>x.id)).size,3);
});
