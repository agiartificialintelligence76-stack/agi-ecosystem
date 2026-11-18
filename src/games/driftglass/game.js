import {configuration,createDuel,tick,aim,radio,useBoost,drain,scoreFor,DT} from './duel.js';
import {makeDriver} from './drivers.js';
import {view,inverse,Z_MIN,Z_MAX,clamp,canLink} from './road.js';
import {readLibrary,saveResult,selection,DECKS} from './library.js';
import {RIVALS,MEETS} from './rivals.js';
import {radioSound} from './sound.js';
import {voice} from './lines.js';
import {drawDuel} from './render.js';
import {box,label,cassette,ink} from './art.js';
import {gameStore} from '../kit/store.js';

const modes=[{id:'ladder',label:'Championship · 12 matches'},{id:'check',label:'Radio Check · quick round'},
 {id:'marathon',label:'Marathon Radio'},{id:'daily',label:'Daily Rival'},{id:'local',label:'Local Duet · 2 players'}];
const options=[{id:'match',label:'Championship match',values:[{id:'next',label:'Continue my ladder'},...MEETS.map(m=>({id:String(m.id),label:(m.id+1)+'. '+m.title}))]},
 {id:'deck',label:'Deck paint',values:DECKS.map(d=>({id:d.id,label:d.label+(d.blocks?' · '+d.blocks+' jams':'')}))}];
const btn=(id,label,key,disabled=false)=>({id,label,key,disabled});
const directions=['left','right','up','down'];
const icons=['←','→','↑','↓'];
export const compactDuet=(w,h)=>w<750||h<430;
function pads(s,local,chart,handoff){
 if(handoff)return [btn('handoff','Rose is ready','Enter')];
 if(chart)return [btn('chart','Back to the road','C')];
 const result=[];
 for(let i=0;i<(local?2:1);i++){
  const pre=i?'rose-':'mint-',who=local?(i?'Rose ':'Mint '):'',c=s.cars[i];
  const keys=local?(i?['←','→','↑','↓']:['A','D','W','S']):['A','D','W','S'];
  for(let j=0;j<4;j++)result.push(btn(pre+directions[j],who+icons[j],keys[j]));
  result.push(btn(pre+'radio',who+(s.owner===i?(c.jamCool>.05?'Jam cooling':'Jam'):'Snatch'),local?(i?'Enter':'F'):'Space'));
  result.push(btn(pre+'boost',who+(c.charge>=.995?'Boost!':'Boost'),local?(i?'Shift':'G'):'Shift',c.charge<.995));
 }
 if(!local)result.push(btn('chart','Radio chart','C'));
 return result;
}
function chartPage(c,w,h,s,book){
 c.fillStyle='#b18084';c.fillRect(0,0,w,h);
 const ww=Math.min(w*.94,720),hh=h*.87,x=(w-ww)/2,y=h*.06;box(c,x+3,y+4,ww,hh,12,'#624858');box(c,x,y,ww,hh,12,'#fff0d5',ink,2);
 const left=x+ww*.07,top=y+hh*.13,size=Math.max(17,Math.min(30,ww*.074));
 label(c,'RADIO CHART',left,top,size,ink,'left','AK Display',ww*.65);cassette(c,x+ww*.83,top,Math.min(76,ww*.18),0);
 const rows=s.record.length?s.record.map(r=>({round:r.round,rival:r.rival,a:Math.round(r.air[0]),b:Math.round(r.air[1]),winner:r.winner})):book.chart;
 label(c,'MINT   /   ROSE · seconds on air',left,y+hh*.28,Math.max(12,Math.min(17,ww*.042)),'#886176','left','AK Mono',ww*.84);
 if(!rows.length)label(c,'Round '+s.round+' is on air now.',left,y+hh*.43,Math.max(15,Math.min(22,ww*.056)),ink);
 for(const [j,r] of rows.slice(-5).entries())label(c,'R'+r.round+'   '+r.a+' / '+r.b+'    '+RIVALS[r.rival].name,left,y+hh*(.38+j*.072),Math.max(12,Math.min(18,ww*.044)),ink,'left','AK Mono',ww*.85);
 label(c,(book.sleeves.length?book.sleeves.join('  ·  '):'Win a championship match to collect its sleeve.'),left,y+hh*.78,Math.max(12,Math.min(18,ww*.042)),'#93566a','left','AK Sans',ww*.85);
 label(c,'Longest broadcast   '+Math.max(book.longest,s.stats[0].longest).toFixed(1)+'s',left,y+hh*.89,Math.max(13,Math.min(20,ww*.048)),ink,'left','AK Sans',ww*.85);
}
export default {
 title:'CASSETTE BANDIT',tagline:'Pull door to door. Steal her mixtape. Keep your station on the air.',
 instructions:[['Steal the station','Mint is yours. Steer until your doors line up and the gold cable appears. Press Snatch and stay level until the tape crosses. Airtime wins the round.'],
 ['Defend the cassette','Two flashes warn of a steal. Jam during the tell, or break the link by changing your line. The radio chart keeps every round.'],
 ['Draft, then break out','Follow a van or the other driver to charge Boost. A clean close pass adds charge, too. Three jams can earn a spare fuse in Marathon.']],
 keys:[['Arrows / WASD','Steer and set pace'],['Space / Shift','Snatch or jam / boost'],['C','Round chart'],['Local Mint','WASD + F / G'],['Local Rose','Arrows + Enter / right Shift']],
 touch:[['Drag the road','Set lateral position and pace'],['Steering pads','Tap a lane or hold to keep moving'],['Snatch / Jam / Boost','Work the pirate radio'],['Local Duet','Two sets of pads on wide screens. On a phone, alternate identical heats.']],
 modes,options,controls:[btn('mint-radio','Snatch','Space')],
 progress(raw){const b=readLibrary(raw);return b.wins.filter(Boolean).length+'/12 wins  ·  '+b.sleeves.length+'/6 sleeves  ·  Next: '+MEETS[b.unlocked].title;},
 scoreGroup:({mode,options,seed})=>mode==='daily'?'daily/'+seed:mode==='ladder'?'ladder/'+selection(readLibrary(gameStore('driftglass').read()),options?.match,seed):mode,
 create(api){
  let book=readLibrary(api.store?.read?.());const seed=api.seed??7,mode=modes.some(x=>x.id===api.mode)?api.mode:'ladder';
  const compact=api.compact??compactDuet(globalThis.innerWidth??1024,globalThis.innerHeight??768);
  const passes=mode==='local'&&compact&&!api.demo,local=mode==='local'&&!passes&&!api.demo;
  const requested=selection(book,api.options?.match,seed),normal=api.demo?'check':passes?'pass':mode;
  const config=configuration(normal,requested,seed),day=new Date().toISOString().slice(0,10);
  const selected=DECKS.find(d=>d.id===api.options?.deck&&d.blocks<=book.blocks)||DECKS[0];
  let s=createDuel(config),opponent=makeDriver('rival',1,seed),auto=makeDriver('demo',0,seed);
  const sound=radioSound(api.audio,api.demo),held=[new Set(),new Set()];let paused=false,closed=false,chart=false,handoff=false,passFirst=null,
    pointer=false,autoplay=Boolean(api.demo),acc=0,lastControls='',lastHUD='',lastVoice=-8,counter=seed,finishIn=null;
  function controls(){
   const data=pads(s,local,chart,handoff),key=data.map(x=>x.id+x.label+x.disabled).join('/');
   if(lastControls!==key){lastControls=key;api.controls?.(data);}
   const first=mode==='marathon'?'Signal':passes?passFirst?'Rose heat':'Mint heat':'Match',val=mode==='marathon'?s.health+' / 3':passes?'1 round':s.wins.join(' – ');
   const other=mode==='ladder'?MEETS[requested].id+1+' / 12':Math.floor(s.time)+'s',sign=[first,val,other].join('/');
   if(sign!==lastHUD){lastHUD=sign;api.hud?.(first,val,mode==='ladder'?'Ladder':'Time',other);}
  }
  function speak(kind,force=false){
   if(!force&&s.time-lastVoice<1.35)return;const msg=voice(kind,counter++);if(msg){api.say?.(msg);lastVoice=s.time;}
  }
  function release(){held[0].clear();held[1].clear();pointer=false;}
  function events(){
   for(const e of drain(s)){
    const i=e.who;
    if(e.kind==='district'){if(s.round>1)api.say?.(voice('districts',e.v));continue;}
    if(e.kind==='round-open'||e.kind==='end')continue;
    const kind=e.kind==='steal'?(i===0?'steal':'taken'):e.kind==='round'?(i===0?'win':'lose'):e.kind;
    if(e.kind==='drop'&&e.who===0){api.say?.('mint is on air. watch her headlights.');}
    else if(i===0||['tell','round','drop','turnaround','work','overtime','steal','fake','mile'].includes(e.kind))
     speak(kind,['steal','round','tell','turnaround','block','drop','fake','fuse'].includes(e.kind));
    sound.play(e.kind,s.time);if(e.kind==='steal'||e.kind==='block'||e.kind==='bump')api.haptic?.(e.kind==='bump'?15:8);
   }
  }
  function finish(){
   release();const score=scoreFor(s);
   if(passes&&!passFirst){passFirst={score,air:s.stats[0].air,steals:s.stats[0].steals};handoff=true;api.say?.('Pass the phone. Rose gets the same traffic and opponent.');controls();return;}
   closed=true;let finalScore=score,line=voice(s.winner===0?'win':'loss',counter),stats=[
    ['Broadcast',s.winner===0?'Mint station':'Rose station'],['Rounds',s.wins.join(' – ')],['Steals / blocks',s.stats[0].steals+' / '+s.stats[0].blocks],
    ['Clean passes',s.stats[0].near],['Best airtime',s.stats[0].longest.toFixed(1)+'s']];
   if(passes){
    finalScore=Math.max(passFirst.score,score);stats=[['Mint score',passFirst.score],['Rose score',score],['Mint airtime',passFirst.air.toFixed(1)+'s'],['Rose airtime',s.stats[0].air.toFixed(1)+'s']];
    line=passFirst.score===score?'both stations tied on the same road.':(passFirst.score>score?'mint':'rose')+' takes the two-driver broadcast.';
   }else if(local){finalScore=scoreFor(s,s.winner);stats=[['Station',s.winner===0?'Mint':'Rose'],['Rounds',s.wins.join(' – ')],['Mint steals',s.stats[0].steals],['Rose steals',s.stats[1].steals]];}
   else if(!api.demo){
    const previous=book;api.store?.update?.(raw=>{book=saveResult(raw,s,score,day);return {...raw,bandit:book};});
    if(mode==='ladder'&&s.winner===0&&requested===11)line=voice('champ',counter);
    else if(book.sleeves.length>previous.sleeves.length)line=voice('sleeve',counter)+' '+RIVALS[s.rival].name+' sleeve collected.';
    else if(book.longest>previous.longest+.3)line=voice('best',counter);
   }
   api.end?.(finalScore,stats,line);
  }
  function action(id,phase){
   if(closed||paused)return;
   if(id==='handoff'&&phase==='down'&&handoff){s=createDuel(config);opponent=makeDriver('rival',1,seed);auto=makeDriver('demo',0,seed);
    handoff=false;finishIn=null;lastVoice=-8;lastControls='';lastHUD='';release();controls();api.say?.('Rose is driving mint this heat. Same start, same road.');return;}
   if(handoff)return;
   if(id==='chart'&&phase==='down'&&!local){chart=!chart;release();chart?sound.pause():sound.resume();api.say?.(chart?'the station log saves every round.':'back on air.');controls();return;}
   if(chart||s.phase!=='live')return;
   const parts=id.split('-'),i=parts[0]==='rose'?1:0,k=parts[1];if(i&&!local)return;
   const c=s.cars[i],button=held[i];
   if(phase==='up'){button.delete(k);return;}
   if(phase!=='down'||button.has(k))return;button.add(k);
   if(k==='radio')radio(s,i);
   if(k==='boost')useBoost(s,i);
   if(directions.includes(k)){
    const dx=k==='left'?-1:k==='right'?1:0,dz=k==='up'?1:k==='down'?-1:0;
    aim(s,i,c.targetX+dx*.78,c.targetZ+dz*.56);sound.play('shift',s.time);
   }
   events();controls();
  }
  function key(phase,k){
   if(handoff&&k==='Enter'){action('handoff',phase);return;}if(k==='KeyC'){action('chart',phase);return;}
   const p1={KeyA:'left',KeyD:'right',KeyW:'up',KeyS:'down',KeyF:'radio',KeyG:'boost'};
   const p2={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',Enter:'radio',ShiftRight:'boost'};
   if(p1[k])action('mint-'+p1[k],phase);else if(p2[k])action((local?'rose-':'mint-')+p2[k],phase);
   else if(k==='Space'||k==='ShiftLeft')action(k==='Space'?'mint-radio':'mint-boost',phase);
  }
  function steer(dt){
   for(let i=0;i<(local?2:1);i++){
    const car=s.cars[i],buttons=held[i],dx=Number(buttons.has('right'))-Number(buttons.has('left')),dz=Number(buttons.has('up'))-Number(buttons.has('down'));
    if(dx||dz)aim(s,i,car.targetX+dx*1.65*dt,car.targetZ+dz*1.40*dt);
   }
  }
  controls();drain(s);api.say?.(passes?'Local Duet · Mint takes the first heat. Rose gets the identical road.':local?voice('local',seed):
   mode==='daily'?voice('daily',seed):mode==='marathon'?'Three signal fuses. Win rounds, draft and protect your broadcast.':'Mint is yours. When your doors glow gold, press Snatch.');
  return {action,key,
   pointer(type,x,y,w,h){
    if(paused||closed||chart||handoff||local)return;
    if(type==='cancel'||type==='up'){pointer=false;return;}if(type==='down')pointer=true;if(!pointer)return;
    const v=view(w,api.demo?h:Math.max(100,h-35));if(y<v.top)return;
    const p=inverse(v,x,y,s.distance,s.district);aim(s,0,p.x,clamp(p.z,Z_MIN,Z_MAX));
   },
   cancelInput:release,demo(){autoplay=true;},
   update(dt){
    if(closed||paused||chart||handoff)return;
    if(finishIn!==null){finishIn-=dt;if(finishIn<=0){finishIn=null;finish();}return;}
    acc+=Math.min(dt,.5);
    while(acc+1e-9>=DT&&!s.ended){steer(DT);if(autoplay)auto.think(s,DT);if(!local)opponent.think(s,DT);tick(s,DT);acc-=DT;}
    events();sound.update(s);controls();if(s.ended)finishIn=.65;
   },
   draw(c,w=480,h=480){const room=api.demo?h:Math.max(100,h-35);c.fillStyle='#946f7e';c.fillRect(0,0,w,h);
    if(chart)chartPage(c,w,room,s,book);else drawDuel(c,s,w,room,{color:selected.color,local,handoff,reduced:api.reducedMotion});
   },
   pause(){paused=true;release();sound.pause();},resume(){paused=false;if(!chart)sound.resume();},
   dispose(){closed=true;release();sound.dispose();},
  };
 },
};
