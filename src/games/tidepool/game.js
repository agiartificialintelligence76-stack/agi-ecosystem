import { rng } from '../kit/fx.js';
import { byId, EDITS } from './catalog.js';
import { configFor, openShow, advance, selectSleeve, changeEdit, beginFade, handFader, drain, resultOf } from './rules.js';
import { readLibrary, archiveRun, availableEdits } from './progress.js';
import { SHIFTS } from './shifts.js';
import { makeDJ } from './ai.js';
import { say } from './lines.js';
import { createDeskSound } from './sound.js';
import { drawDesk } from './render.js';
import { box, txt, ink } from './art.js';

const modes=[
  {id:'hosted',label:'Hosted series'},{id:'late',label:'Late shift · endless'},{id:'daily',label:'Daily requests'},
];
const options=[{id:'episode',label:'Hosted broadcast',values:[
  {id:'next',label:'Continue the series'},...SHIFTS.map((shift,i)=>({id:String(i),label:(i+1)+'. '+shift.title})),
]}];
const staticControls=[{id:'mix',label:'Crossfade',key:'Space'}];
const symbol={rise:'↗',ease:'↘',level:'→'};
export function controlsFor(s,logPage) {
 if(logPage>=0)return [{id:'log-next',label:'Next page',key:'→'},{id:'log',label:'Return to booth',key:'N'}];
 const busy=Boolean(s.fade&&!s.fade.manual);
 const list=s.choices.map((id,i)=>{
   const cut=byId[id].cuts[s.config.edits[s.edit]];
   return {id:'sleeve-'+i,label:byId[id].title+'  '+cut.heat+'/5 '+symbol[cut.curve],key:String(i+1),pressed:i===s.selected,disabled:busy};
 });
 if(s.config.edits.length>1)list.push({id:'edit',label:EDITS.find(d=>d.id===s.config.edits[s.edit]).name+' cut ↻',key:'E',disabled:busy});
 list.push({id:'cue',label:'Listen in',key:'Q',disabled:busy},
   {id:'mix',label:busy?'Mixing…':s.armed?'Cancel queued mix':'Crossfade',key:'Space',disabled:busy});
 if(s.turn>0||s.config.mode!=='hosted'||s.config.shift>0){
  const f=s.fade?.position||0;
  list.push({id:'fader',label:'A ⇄ B',type:'range',min:0,max:100,step:1,disabled:!s.clocked&&!s.fade,value:Math.round(100*(s.side===0?f:1-f))});
 }
 list.push({id:'log',label:'Sleeve notes',key:'N'});
 return list;
}
function drawArchive(c,w,h,library,page) {
 c.fillStyle='#58334e';c.fillRect(0,0,w,h);
 const pad=Math.max(12,Math.min(w,h)*.05),wide=w-pad*2;
 box(c,pad,pad,wide,h-pad*2,11,'#fff0d4',ink,3);
 const left=pad*1.7,top=pad+24;
 const titles=['Station stamps','Listener signatures','Best transitions'];
 txt(c,titles[page],left,top,Math.min(34,w*.065),ink,'left','AK Display',850,wide-38);
 const rows=page===0?SHIFTS.map((a,i)=>(library.grades[i]?'★'.repeat(library.grades[i]):'○')+'  '+a.title)
   :page===1?(library.signatures.length?library.signatures:['Land the right song and its listener signs here.'])
   :(library.mixes.length?library.mixes.slice(0,8).map(m=>byId[m.a].title+' → '+byId[m.b].title+'   '+m.points):['Your first completed mix starts this page.']);
 const step=Math.min(32,(h-pad*2-52)/Math.max(1,Math.min(rows.length,8)));
 rows.slice(0,8).forEach((row,i)=>txt(c,row,left,top+32+i*step,Math.min(16,step*.76),'#653d53','left','AK Sans',650,wide-38));
}
export default {
 title:'SIDE B',tagline:'Seven records. Two decks. Your late-night radio show.',
 instructions:[['Cue a record','A listener requests an energy from one to five. Choose a sleeve and listen to its entrance.'],
  ['Time the blend','The four lamps follow the outgoing recording. Bring in the next deck on the bright first beat, near the golden phrase mark.'],
  ['Shape a set','Later broadcasts add rising and easing cuts. Use Crossfade or move the fader by hand. Strong pairings and listener signatures go in Sleeve notes.']],
 keys:[['1 / 2 / 3','Choose sleeve'],['Q / E','Listen / change edit'],['Space','Crossfade'],['[ / ]','Hand fader'],['N','Sleeve notes']],
 touch:[['Sleeve','Cue a recording'],['Crossfade / slider','Blend onto air'],['Sleeve notes','Open your collection']],
 modes,options,controls:staticControls,
 progress(raw){
   const library=readLibrary(raw);
   const grades=library.grades.reduce((sum,value)=>sum+value,0);
   return 'Next broadcast · '+SHIFTS[library.unlocked].title+'  ·  '+grades+'/24 stars  ·  '+library.signatures.length+' signed sleeves';
 },
 create(api){
  let library=readLibrary(api.store?.read?.());
  const mode=modes.some(m=>m.id===api.mode)?api.mode:'hosted';
  const seed=api.seed??Math.floor((api.rng?.()??.3)*0xffffffff);
  const next=library.lastHosted?.seed===seed?library.lastHosted.shift:library.unlocked;
  const wanted=api.options?.episode==='next'||api.options?.episode==null?next:Number(api.options.episode)||0;
  const shift=mode==='hosted'?Math.min(wanted,library.unlocked):mode==='daily'?4:library.unlocked;
  const day=mode==='daily'?new Date().toISOString().slice(0,10):'';
  const config=configFor({mode,shift,seed,day,edits:availableEdits(library,shift,mode)});
  const sim=openShow(config), bot=makeDJ('demo',rng(seed^0x71bb15).next);
  const sound=createDeskSound(api.audio,{demo:api.demo,onUnavailable:()=>api.say?.('the recording is offline. the beat lights still run the show.')});
  let logPage=-1,paused=false,saved=false,closed=false,elapsed=0,controlsDirty=true,lastFader=-1;
  let recent='';
  function speak(message){if(message!==recent){recent=message;api.say?.(message);}}
  function progress(){
    if(saved||api.demo||!sim.turn)return;
    saved=true;
    api.store?.update?.(old=>{
      library=archiveRun(readLibrary(old),resultOf(sim));
      return {...old,dj:library};
    });
  }
  function hud(){
    api.hud?.('Mix',sim.score,mode==='late'?'Listeners':'Requests',mode==='late'?Math.round(sim.crowd)+'%':Math.min(config.limit,sim.turn+1)+'/'+config.limit);
  }
  function flush(){
    for(const e of drain(sim)){
      controlsDirty=true;
      if(e.kind==='request'){
        if(e.turn)sound.sfx('request');
        if(e.turn===0)speak(mode==='hosted'&&wanted>shift?'that broadcast opens later. tonight is '+config.episode.title.toLowerCase()+'.':say('opening',seed));
      }
      if(e.kind==='select'||e.kind==='edit'){sound.sfx(e.kind);sound.cue(sim);speak(say(e.kind==='edit'?'unlock':'cue',seed+sim.selected+sim.turn));}
      if(e.kind==='early'){sound.sfx('early');speak(e.armed?'queued for the first open bar. tap again to cancel.':'manual timing. blend when the first lamp lights.');}
      if(e.kind==='assisted')speak('auto cue caught the bar. try timing the next one.');
      if(e.kind==='window'){sound.sfx('window');speak('the line is open. blend on the bright first beat.');}
      if(e.kind==='fade'){sound.sfx(e.missed?'miss':'fade');if(!e.missed){api.haptic?.(10);speak(say(e.manual?'manual':'blend',sim.turn));}}
      if(e.kind==='land'){
        sound.sfx(e.missed?'miss':'land',e.streak);
        const message=e.missed?say('missed',sim.turn):e.streak>=3?say('streak',e.streak):e.points>=78?say('blend',sim.turn):e.energy<20?'good hands. that caller asked for a different energy.':say('mistake',sim.turn);
        speak(message);api.effect?.(e.missed?'miss':e.streak>=3?'streak':e.points>=85?'perfect':'beat',e.missed?'Missed':e.streak>=3?'Mix ×'+e.streak:'+'+e.points);hud();
      }
      if(e.kind==='end'&&!closed){
        closed=true;progress();sound.sfx('signoff');sound.pause();
        const stars=library.grades[shift],stamp=mode==='hosted'?'★'.repeat(stars)||'On air':mode==='daily'?day:'Late shift';
        api.end?.(sim.score,[['Broadcast',stamp],['Completed blends',sim.blends+'/'+sim.turn],['Best mix',sim.best+'/100'],['Longest streak',sim.peak],['Signed requests',sim.signatures.length]],say('closing',sim.peak));
      }
    }
    if(!closed && !paused && logPage<0)sound.sync(sim);
    if(controlsDirty){api.controls?.(controlsFor(sim,logPage));controlsDirty=false;}
  }
  function showLog(){
    if(logPage>=0){logPage=-1;sound.resume(sim.time);speak(say('opening',sim.turn));}
    else{logPage=0;sound.pause();speak('i keep the good pairings on the inside sleeve.');}
    controlsDirty=true;flush();
  }
  function action(id,type,value,stamp){
    if(closed||paused)return;
    if(type==='down'&&id==='log'){showLog();return;}
    if(logPage>=0){if(id==='log-next'&&type==='down'){logPage=(logPage+1)%3;}return;}
    const now=sound.input(sim.time,stamp),when=Math.min(sim.time+.05,Math.max(0,now));
    if(type==='input'&&id==='fader'){handFader(sim,Number(value)/100,when);flush();return;}
    if(type!=='down')return;
    if(id.startsWith('sleeve-'))selectSleeve(sim,Number(id.slice(7)));
    else if(id==='edit')changeEdit(sim);
    else if(id==='cue'){sound.cue(sim);sound.sfx('select');speak(say('audition',sim.turn+sim.selected));}
    else if(id==='mix')beginFade(sim,when);
    else if(id==='fader-left'||id==='fader-right'){
      const f=sim.fade?.position||0,current=sim.side===0?f:1-f;
      handFader(sim,current+(id==='fader-left'?-.1:.1),when);
    }
    flush();
  }
  hud();flush();
  return {
    action,
    key(type,code,stamp){
      const map={Digit1:'sleeve-0',Digit2:'sleeve-1',Digit3:'sleeve-2',KeyE:'edit',KeyQ:'cue',Space:'mix',Enter:'mix',KeyN:'log',
        BracketLeft:'fader-left',BracketRight:'fader-right',ArrowRight:logPage>=0?'log-next':'fader-right',ArrowLeft:'fader-left'};
      if(map[code])action(map[code],type,undefined,stamp);
    },
    pointer(){}, // The physical desk is read-only. Keyboard, touch and mouse operate its native controls.
    demo(){if(!closed&&logPage<0)bot(sim);},
    update(dt){
      if(closed||paused||logPage>=0)return;
      elapsed+=dt;
      advance(sim,sound.now(elapsed));
      const percent=sim.fade?Math.floor(sim.fade.position*20):-1;
      if(percent!==lastFader){controlsDirty=true;lastFader=percent;}
      flush();
    },
    draw(ctx,w=480,h=480){
      if(logPage>=0){const liveLibrary=archiveRun(library,{...resultOf(sim),finished:false});drawArchive(ctx,w,Math.max(100,h-34),liveLibrary,logPage);return;}
      const room=api.demo?h:Math.max(100,h-34);
      ctx.fillStyle='#51384b';ctx.fillRect(0,0,w,h);
      drawDesk(ctx,sim,w,room,{meters:[sound.meter(0),sound.meter(1)],reduce:api.reducedMotion});
    },
    pause(){if(paused)return;paused=true;sound.pause();},
    resume(){if(!paused)return;paused=false;elapsed=sim.time;if(logPage<0)sound.resume(sim.time);},
    dispose(){progress();closed=true;sound.dispose();},
  };
 },
};
