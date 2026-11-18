import { beatAt } from '../heartbeat/chart.js';
import { rng } from '../kit/fx.js';
import { SONGS, byId, barDuration, barLine, chartTime, editById, playback, phaseAt } from './catalog.js';
import { CAPTIONS, LISTENERS, SHIFTS } from './shifts.js';

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const pick = (random, pool) => pool[Math.floor(random()*pool.length)];
const emit = (s, kind, data = {}) => s.events.push({ kind, ...data });

export function equalPower(position) {
  const t = clamp(position, 0, 1) * Math.PI / 2;
  return [Math.cos(t), Math.sin(t)];
}

export function configFor({ mode='hosted', shift=0, seed=7, day='', edits=['hook'] }) {
  const index = clamp(shift,0,SHIFTS.length-1);
  return { mode, shift:index, seed, day, edits, episode:SHIFTS[index],
    limit:mode==='late'?Infinity:mode==='daily'?8:SHIFTS[index].count };
}
export function openShow(config) {
  const random = rng(config.seed).next;
  const first = pick(random,SONGS);
  const S = {
    config, random, time:0, turn:0, side:0, onAir:playback(first.id), started:0, selected:0, edit:0,
    crowd:76, points:0, score:0, blends:0, peak:0, streak:0, best:0, misses:0, survived:false,
    request:null, choices:[], fade:null, lastGrade:null, events:[], mixes:[], signatures:[], ended:false,
    clocked:false, message:null, phase:'prepare',
  };
  newRequest(S);
  emit(S,'air',{ deck:{...S.onAir} });
  return S;
}
function shuffledCrate(S) {
  const shelf = SONGS.filter(song => song.id !== S.onAir.track);
  const n = S.config.mode==='hosted' && S.config.shift===0 && S.turn===0 ? 2 : 3;
  const cards=[];
  while(cards.length<n){
    const used=new Set(cards.map(id=>byId[id].cuts.hook.heat));
    const varied=shelf.filter(song=>!used.has(song.cuts.hook.heat));
    const song=pick(S.random,varied.length?varied:shelf);
    cards.push(song.id);
    shelf.splice(shelf.indexOf(song),1);
  }
  return cards;
}
export function cutOf(S, index=S.selected, edit=S.edit) {
  const track = byId[S.choices[index]];
  return track.cuts[S.config.edits[edit]];
}
function newRequest(S) {
  S.choices = shuffledCrate(S);
  S.selected=0;
  S.edit=0;
  S.clocked=false;
  S.armed=false;
  const { config, turn } = S;
  const record=byId[S.onAir.track];
  const requestedTrack=pick(S.random,S.choices);
  const targetCut=byId[requestedTrack].cuts[pick(S.random,config.edits)];
  const advanced=config.mode==='daily'?5:config.mode==='late'?Math.min(7,Math.floor(turn/3)+2):config.shift;
  let special='',hint='';
  if(turn%3===2&&advanced>=3){
    if(advanced===3){special='cut';hint=targetCut.edit+' cut';}
    else if(advanced===4||advanced===6){special='named';hint=byId[requestedTrack].title+' requested';}
    else if(advanced===5){special='hand';hint='hand-ridden fade';}
    else{special=turn%2?'named':'hand';hint=special==='hand'?'hand-ridden fade':byId[requestedTrack].title+' requested';}
  }
  const speaker=turn===0 && config.mode==='hosted'?config.episode.host:pick(S.random,LISTENERS)[0];
  const requestCurve=config.mode!=='hosted'||config.shift>=2;
  let bars=config.episode.bars;
  if(config.mode==='late')bars=Math.max(4,9-Math.floor(turn/9));
  if(config.mode==='daily')bars=7+turn%3;
  if(config.mode==='hosted'&&config.shift===0&&turn===0)bars=2;
  const position=chartTime(S.onAir,S.time-S.started);
  const targetIndex=barLine(record,position,bars);
  const target=S.started+(record.beats[targetIndex]-S.onAir.offset)/S.onAir.rate;
  const bar=barDuration(record,position)/S.onAir.rate;
  const allowance=config.mode==='late'?Math.max(.8,2.22-turn*.034):2.2;
  S.request={ speaker, caption:pick(S.random,CAPTIONS), heat:targetCut.heat, curve:targetCut.curve, askCurve:requestCurve,
    phraseBeat:targetIndex, target, bar, open:Math.max(S.time,target-bar*1.01), deadline:target+bar*allowance,
    example:targetCut.edit,special,hint,requestedTrack };
  S.phase='prepare';
  emit(S,'request',{turn});
}

export function grade(S, when=S.time) {
  const song=byId[S.onAir.track], incoming=byId[S.choices[S.selected]], cut=cutOf(S);
  const chart=chartTime(S.onAir,when-S.started);
  const phase=phaseAt(song,chart);
  const nearest=Math.max(0,Math.min(song.beats.length-1,phase.nearestBeat));
  const error=Math.abs(chart-song.beats[nearest])/S.onAir.rate;
  const downbeat=phase.downbeatDistance < .53;
  const targetError=Math.abs(when-S.request.target)/S.request.bar;
  const timing=Math.round(27*clamp(1-error/.225,0,1));
  const phrase=Math.round((downbeat?14:2)+8*clamp(1-targetError/1.05,0,1));
  const energy=Math.max(0,26-9*Math.abs(cut.heat-S.request.heat));
  const curve=!S.request.askCurve||cut.curve===S.request.curve?13:4;
  const tempoGap=Math.abs(barDuration(incoming,cut.offset)-S.request.bar)/S.request.bar;
  const tempo=Math.round(12*clamp(1-Math.max(0,tempoGap-.045)*2,0,1));
  let craft=0;
  if(S.request.special==='cut')craft=cut.edit===S.request.example?4:-5;
  if(S.request.special==='named')craft=incoming.id===S.request.requestedTrack?4:-5;
  return { points:clamp(timing+phrase+energy+curve+tempo+craft,0,100), timing,phrase,energy,curve,tempo,error,downbeat,targetError };
}

export function selectSleeve(S, index) {
  if(S.ended||S.fade||index<0||index>=S.choices.length)return false;
  S.selected=index;
  emit(S,'select',{track:S.choices[index],edit:S.config.edits[S.edit]});
  return true;
}
export function changeEdit(S, step=1) {
  if(S.ended||S.fade||S.config.edits.length<2)return false;
  S.edit=(S.edit+step+S.config.edits.length)%S.config.edits.length;
  emit(S,'edit',{track:S.choices[S.selected],edit:S.config.edits[S.edit]});
  return true;
}

export function beginFade(S, when=S.time, manual=false, missed=false) {
  if(S.ended||S.fade)return false;
  if(when<S.request.open-.11 && !missed) {
    if(!manual)S.armed=!S.armed;
    emit(S,'early',{seconds:S.request.open-when,armed:S.armed});
    return false;
  }
  S.armed=false;
  const cut=cutOf(S),song=byId[S.choices[S.selected]];
  const inBar=barDuration(song,cut.offset);
  const rate=clamp(inBar/S.request.bar,.84,1.18);
  const next=playback(song.id,cut.edit,rate);
  const result=grade(S,when);
  if(missed)result.points=0;
  const duration=editById[cut.edit].fadeBeats*S.request.bar/4;
  S.fade={ when,duration,manual,missed,next,result,position:0,lastMoved:when,travel:0 };
  S.phase='mix';
  emit(S,'fade',{ deck:{...next}, when, duration, manual, missed });
  return true;
}

export function handFader(S, value, when=S.time) {
  if(S.ended)return false;
  const towards=S.side===0?clamp(value,0,1):1-clamp(value,0,1);
  if(!S.fade){
    if(towards<.035||!beginFade(S,when,true))return false;
  }
  const f=S.fade;
  if(!f.manual)return false;
  f.travel+=Math.abs(towards-f.position);
  f.position=towards;
  f.lastMoved=when;
  emit(S,'ride',{position:towards});
  if(towards>=.985)finishFade(S,when);
  return true;
}

function finishFade(S, when) {
  const fade=S.fade;
  const g={...fade.result};
  if(fade.manual&&!fade.missed){
    const length=(when-fade.when)/fade.duration;
    const goodLength=length>=.55&&length<=1.65;
    g.points=clamp(g.points+(goodLength&&fade.travel<1.28?(S.request.special==='hand'?8:4):0)-(length<.25?9:0),0,100);
  }
  if(!fade.manual&&S.request.special==='hand'&&!fade.missed)g.points=Math.max(0,g.points-5);
  S.lastGrade={...g,missed:fade.missed,at:when};
  if(fade.missed)S.misses++;
  else S.blends++;
  S.streak=g.points>=75?S.streak+1:0;
  S.peak=Math.max(S.peak,S.streak);
  S.points+=g.points;
  S.best=Math.max(S.best,g.points);
  S.score+=g.points*Math.min(4,1+Math.floor(S.streak/3));
  const strain=S.config.mode==='late'?S.turn*1.65:0;
  const audienceDelta=fade.missed?-26:g.points-65;
  S.crowd=clamp(S.crowd+clamp(audienceDelta*.66-strain,-32,12),0,100);
  if(!fade.missed)S.mixes.push({a:S.onAir.track,b:fade.next.track,points:g.points});
  if(g.energy===26&&g.curve===13&&g.points>=70&&!S.signatures.includes(S.request.speaker))S.signatures.push(S.request.speaker);
  S.onAir=fade.next;S.started=fade.when;S.side=1-S.side;S.fade=null;S.turn++;
  emit(S,'land',{...g,missed:fade.missed,streak:S.streak});
  if(S.turn>=S.config.limit||(S.config.mode==='late'&&S.crowd<=0)){
    S.ended=true;S.survived=S.turn>=S.config.limit;S.phase='closed';emit(S,'end');return;
  }
  newRequest(S);
}

// The same timestamp drives record samples, grading, the meters and deterministic headless runs.
export function advance(S, time) {
  if(S.ended)return;
  S.time=Math.max(S.time,time);
  if(S.fade){
    const f=S.fade;
    if(!f.manual)f.position=clamp((S.time-f.when)/f.duration,0,1);
    const stuck=f.manual&&S.time>f.when+f.duration*2.4;
    if(stuck){f.result.points=Math.max(0,f.result.points-9);f.position=1;}
    if(f.position>=1)finishFade(S,S.time);
    return;
  }
  if(S.time>S.request.deadline){beginFade(S,S.time,false,true);return;}
  if(S.time>=S.request.open&&!S.clocked){
    S.clocked=true;S.phase='live';emit(S,'window');
    if(S.armed){
      beginFade(S,S.request.open);
      S.fade.result.points=Math.max(0,S.fade.result.points-12);
      emit(S,'assisted');
    }
  }
}
export function resultOf(S) {
  return {seed:S.config.seed,score:S.score,points:S.points,count:S.turn,blends:S.blends,shift:S.config.shift,mode:S.config.mode,day:S.config.day,
    finished:S.survived,mixes:S.mixes,signatures:S.signatures,streak:S.peak,misses:S.misses,best:S.best};
}
export function drain(S) { return S.events.splice(0,S.events.length); }
