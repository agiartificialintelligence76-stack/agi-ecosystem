import {ATLAS,rivals,chapters,rack,dailySet} from './tables.js';
import {certificates,leaves} from './atlas-book.js';
import {copyBalls,strike,tick,DT,journal,moving,clamp,openSpot,respot,dist} from './physics.js';
import {targets,ruling,featMet} from './rules.js';
import {choose,seeded,placement} from './ai.js';
import {tableSound} from './sound.js';
import {paint,layout,pocketNames} from './render.js';
import {lines} from './lines.js';
const btn=(id,label,key,other={})=>({id,label,key,...other});
const range=(id,label,value,min,max,step)=>({id,label,type:'range',value,min,max,step});
const starter=[btn('strike','Strike cue','Space')];
export const scoreTrick=(moves,par,feat)=>220+Math.min(3,1+Number(moves<=par)+Number(feat))*110+Math.max(0,70-10*Math.max(0,moves-par));
export default {title:'MOONSHOT BILLIARDS',tagline:'Line up a comet, work the cushions and leave AGI-1 a difficult next shot.',
 modes:[{id:'atlas',label:'Trick Atlas'},{id:'ladder',label:'House Ladder vs AGI-1'},{id:'daily',label:'Daily three-rack match'},{id:'house',label:'House Run'}],
 options:[{id:'card',label:'Trick Atlas table',values:ATLAS.map((c,i)=>({id:String(i),label:String(i+1).padStart(2,'0')+' · '+c.name}))}],controls:starter,
 instructions:[['Take aim','Tap the felt to aim toward a point, or drag back from the white cue comet. Adjust your power and press Strike.'],
 ['Use the leave','The short chalk line stops at first contact. Follow carries the cue forward. Draw pulls it back. The glowing wells bend moving balls.'],
 ['Play the rack','In a match you play suns. AGI-1 plays striped comets. Hit your own ball first, then pot a ball or reach a cushion. A foul awards ball in hand.'],
 ['Call the moon','Clear your suit, call one of six pockets, then sink the final moon. In the atlas, pot the ringed object at the called pocket and clear each listed extra.']],
 keys:[['← / →, A / D','Fine / coarse aim'],['↑ / ↓, Q / E','Power up/down, draw/follow'],['Space, C','Strike, call next pocket'],['B, R, X','Review stroke, rerack atlas, file scorecard']],
 touch:[['Felt','Tap to aim or pull back on the cue for angle and power. Release the drag, then strike.'],['Ball in hand','Tap an empty part of the felt to place the cue. Confirm your placement with the dock.']],
 progress(d){const p=d?.moonSalon;return p?Object.keys(p.tricks||{}).length+' / 36 trick cards · '+(p.patches?.length||0)+' / 6 felt patches · '+(p.wins||0)+' house wins':'';},
 create(api){
 const mode=api.mode||'atlas',seed=api.seed??Math.floor((api.rng?.()??.5)*0xffffffff),random=seeded(seed),sound=tableSound(api.audio),daily=dailySet(seed),save=api.store?.read?.().moonSalon||{};
 let patches=save.patches||[];let card,table,balls,wells,phase,seat,angle,power,spin,called,aimHand=false,historyTrail=[],lastHistory='',log,before,input,clock=0,acc=0,stroke=0,shots=0,turns=0,playerPots=0,scratches=0,score=0,stars=0,ends=0,opWait=0,queueShot=null;
 let index=api.demo?21:clamp(Number(api.options?.card)||0,0,35),racks=0,ladder=Math.min(17,save.ladder||0),innings=5,chalk=0,won=0,everScored=false,done=false,paused=false,drag=null,notice='',primaryMet=false,feature=false,sparks=[],demoWait=.85,demoFirst=true,compact=false,settingsOpen=false,readHistory=false,aimHeld=null;
 const speak=k=>api.say?.(lines[k]||k);
 const remember=fn=>api.store?.update?.(d=>({...d,moonSalon:fn({...d.moonSalon})}));
 const activeAtlas=()=>mode==='atlas'||api.demo;
 function hud(){api.hud?.('Score',score,activeAtlas()?'Shots':mode==='house'?'Innings':'Turn',activeAtlas()?stroke+' / '+card.par:mode==='house'?innings:seat?'AGI-1':'Yours');}
 function controls(){
  if(phase==='card'){api.controls?.([btn('next',activeAtlas()?'Next table':'Next rack','Enter'),btn('file','File scorecard','X'),...(activeAtlas()?[btn('reset','Try this table','R')]:[])]);return;}
  if(phase==='rolling'){api.controls?.([btn('history','Stroke log','B')]);return;}
  if(seat===1){api.controls?.([btn('skip','Play her shot now','Enter'),btn('history','Stroke log','B')]);return;}
  if(aimHand){api.controls?.([btn('place','Confirm cue position','Enter'),btn('moveL','Left','←'),btn('moveR','Right','→'),btn('moveU','Up','↑'),btn('moveD','Down','↓')]);return;}
  if(compact&&!settingsOpen){api.controls?.([btn('strike','Strike cue','Space'),btn('settings','Cue setup'),btn('call','Call pocket','C'),btn('history','Stroke log','B'),...(everScored&&!activeAtlas()?[btn('file','File run','X')]:[])]);return;}
  const pads=[btn('strike','Strike cue','Space'),range('power','Power %',Math.round(power*100),10,100,1),range('spin','Draw / follow',Math.round(spin*10),-10,10,1),btn('call','Call '+pocketNames[called],'C'),btn('history','Stroke log','B')];
  if(activeAtlas())pads.push(btn('reset','Rerack','R'));if(everScored&&!activeAtlas())pads.push(btn('file','File run','X'));
  if(compact)pads.push(btn('settings','Close setup'));api.controls?.(pads);
 }
 function prep(){
  phase='aim';acc=0;opWait=seat?1.6:0;queueShot=null;aimHeld=null;drag=null;
  if(seat){queueShot=choose(balls,wells,1,table.level,random,table.condition);angle=queueShot.angle;power=queueShot.power;spin=queueShot.spin;called=queueShot.called;speak('Opponent turn');}
  controls();hud();
 }
 function load(){
  phase='aim';seat=0;stroke=0;turns=0;stars=0;primaryMet=feature=false;aimHand=false;sparks=[];historyTrail=[];lastHistory='';readHistory=false;settingsOpen=false;
  if(activeAtlas()){card=ATLAS[index];wells=card.wells;balls=copyBalls(card.balls);const cert=certificates[index][0];angle=cert.angle+(index&&!api.demo?(index%2?1:-1)*(.065+(index%4)*.025):0);power=index===0||api.demo?cert.power:.48;spin=0;called=card.pocket;
   notice=card.feat==='bank'?'Bank the ringed comet into '+pocketNames[called]+'.':card.feat==='combo'?'Send comet 1 into comet 2, then into '+pocketNames[called]+'.':card.feat==='draw'||card.feat==='follow'?'Use '+card.feat+' and leave the cue in the chalk circle.':'Pot the ringed comet at '+pocketNames[called]+'.';}
  else{const spec=mode==='daily'?daily[racks%3]:mode==='house'?{level:Math.min(5,racks),condition:racks%3,seed:seed+racks}:{level:Math.floor(ladder/3),condition:ladder%3,seed};table=rack(spec.level,spec.condition,spec.seed);
   balls=copyBalls(table.balls);wells=table.wells;const hint=choose(balls,wells,0,3,()=>.5,table.condition);angle=hint.angle;power=hint.power;spin=0;called=hint.called;
   notice='Your suns ('+targets(balls,0).join(', ')+'). '+(table.condition===1?'Bank the last moon.':table.condition===2?'Call the moon at a middle pocket.':'Call a pocket for the last moon.');}
  prep();if(wells.length)sound.play('well');speak(mode==='daily'?'Daily replay':wells.length?'Well drift':'Opening');
 }
 function finish(){if(done)return;done=true;sound.stop();api.end?.(Math.round(score),[['Player pots',playerPots],['Shots played',shots],['Racks won',won],['Scratches',scratches],['Trick stars',stars?('★'.repeat(stars)):'—']],lines[won?'New chalk patch':activeAtlas()?'Trick par':'Leave']);}
 function deal(){
  if(phase!=='aim'||aimHand)return;input={angle,power,spin,called};before=copyBalls(balls);if(!strike(balls,angle,power,spin))return;
  stroke++;if(!seat)shots++;log=journal();phase='rolling';acc=0;historyTrail=[];readHistory=false;drag=null;aimHeld=null;
  sound.play('tip');sound.play('roll');if(spin>.35)speak('Follow');else if(spin<-.35)speak('Draw');else if(power>.8)speak('Full power');else if(power<.4)speak('Half power');
  controls();hud();
 }
 function winAtlas(){stars=1+Number(stroke<=card.par)+Number(feature);score+=scoreTrick(stroke,card.par,feature);everScored=true;phase='card';racks++;sound.play('moon');speak(stroke<=card.par?'Trick par':'Personal best');api.effect?.('clear');api.haptic?.(35);
  remember(old=>({...old,tricks:{...old.tricks,[index]:Math.max(stars,old.tricks?.[index]||0)}}));notice='Signed trick card · '+('★'.repeat(stars));controls();hud();}
 function matchEnd(winner){
  phase='card';racks++;won+=Number(winner===0);if(!winner){score+=400+table.level*115;everScored=true;api.effect?.('clear');sound.play('moon');}
  if(mode==='ladder'&&!winner){patches=[...new Set([...patches,table.level])];ladder=Math.min(17,ladder+1);remember(o=>({...o,ladder:Math.max(o.ladder||0,ladder),wins:(o.wins||0)+1,patches:[...new Set([...(o.patches||[]),table.level])]}));}
  if(mode==='house'){innings=Math.min(6,innings+2);remember(o=>({...o,houseBest:Math.max(o.houseBest||0,racks)}));}
  speak(winner?'Opponent clearance':ladder===17?'Ladder ending':'Called moon success');notice=winner?'AGI-1 wins the rack.':'Rack cleared · signed house patch.';
  if(mode==='daily'&&racks>=3){finish();return;}controls();hud();
 }
 function settle(){
  const firstObject=before.find(b=>b.id===log.first),cue=before[0],thin=firstObject&&Math.abs((firstObject.x-cue.x)*Math.sin(input.angle)-(firstObject.y-cue.y)*Math.cos(input.angle))>7;
  const pots=log.pots.filter(p=>p.id>0),scratch=log.pots.some(p=>p.id===0),moment=log.contacts.some(([a,b])=>a&&b)?'Combination':pots.length>1?'Double pot':log.rails.length>=2?'Double bank':log.rails.length?'First bank':pots.length?(thin?'Thin cut':'Straight pot'):'Miss';
  lastHistory=(log.first===null?'No object':'First #'+log.first)+' · '+log.rails.length+' rail'+(log.rails.length===1?'':'s')+' · '+(log.pots.map(p=>(p.id?'#'+p.id:'cue')+' → '+pocketNames[p.pocket]).join(', ')||'no pot');notice=lastHistory;
  if(activeAtlas()){
   if(scratch){scratches++;respot(balls,0);speak('Scratch');}
   const targetPot=pots.find(p=>p.id===card.target);
   if(targetPot&&(!primaryMet)&&(scratch||targetPot.pocket!==card.pocket||card.feat==='called'&&input.called!==card.pocket)){const orig=card.balls.find(b=>b.id===card.target);respot(balls,card.target,orig.x,orig.y);notice='Wrong pocket or scratch. The marked comet returns.';speak('Overcut');}
   else if(targetPot&&!scratch){primaryMet=true;feature=featMet(card,input,log)&&(!['draw','follow'].includes(card.feat)||dist(balls[0].x,balls[0].y,...leaves[index])<=31);}
   if(!scratch){playerPots+=pots.length;speak(moment);}
   if(primaryMet&&card.extra.every(id=>balls.find(b=>b.id===id).potted)){winAtlas();return;}
   if(primaryMet)notice='Clear remaining '+card.extra.filter(id=>!balls.find(b=>b.id===id).potted).map(n=>'#'+n).join(' + ')+'.';
   if(card.feat==='combo'&&!primaryMet&&balls.find(b=>b.id===1).potted){const b=card.balls[1];respot(balls,1,b.x,b.y);}
   prep();return;
  }
  const rule=ruling(before,log,seat,called,table.condition);if(rule.returnMoon){const moon=balls.find(b=>b.suit==='moon');respot(balls,moon.id,530,200);}
  if(!seat&&!rule.foul){playerPots+=rule.own;score+=105*rule.own+(mode==='house'?24:0);if(mode==='house'&&rule.own){chalk+=rule.own;if(chalk>=2){innings=Math.min(8,innings+1);chalk-=2;}}if(rule.own){everScored=true;api.effect?.('pot');}}
  if(scratch){scratches+=Number(!seat);respot(balls,0);}
  if(rule.win){matchEnd(seat);return;}
  if(stroke===1&&power<.25&&rule.foul)speak('Soft break');else if(stroke===1&&log.contacts.length>=3)speak('Clean break');
  if(!rule.keep){sound.play('turn');turns++;if(mode==='house'){innings--;if(innings<=0){finish();return;}}else seat=1-seat;}
  if(rule.ballInHand){if(seat){const [x,y]=placement(balls,1,table.level,random);respot(balls,0,x,y);}else aimHand=true;}
  const calledRule=rule.foul?('Foul · '+rule.foul+'. '+(seat?'AGI-1':'You')+' may place the cue.'):rule.keep?'Legal pot · shoot again.':'Legal safety · turn passes.';
  notice=calledRule;speak(rule.foul?scratch?(seat?'Scratch':'Rival scratch'):rule.foul==='wrong'?'Wrong first contact':'Ball in hand':rule.keep?moment:'Safety');
  if(turns>=42&&mode!=='house'){const left=n=>balls.filter(b=>!b.potted&&b.suit===(n?'stripe':'sun')).length;matchEnd(left(0)<=left(1)?0:1);return;}prep();
 }
 function fireDemo(){if(phase==='card'){index=demoFirst?12:(index+1)%36;demoFirst=false;load();demoWait=.72;return;}if(phase!=='aim')return;
  const cert=certificates[index][Math.min(stroke,certificates[index].length-1)];({angle,power,spin,called}=cert);deal();}
 function act(id,phaseIn,value){
  if(done||paused)return;
  if(phaseIn==='input'&&phase==='aim'&&!seat){if(id==='power')power=clamp(value/100,.1,1);if(id==='spin')spin=clamp(value/10,-1,1);return;}
  if(phaseIn!=='down')return;
  if(id==='file'&&(phase==='card'||everScored)){finish();return;}
  if(id==='settings'){settingsOpen=!settingsOpen;controls();return;}
  if(id==='history'){speak('Chalk');readHistory=!readHistory;notice=readHistory?(lastHistory||'No stroke on the chalkboard yet.'):'Aim with the short chalk guide.';sound.play('chalk');return;}
  if(id==='reset'&&activeAtlas()){load();return;}
  if(phase==='card'){if(id==='next'){if(activeAtlas())index=(index+1)%36;load();}return;}
  if(phase!=='aim')return;
  if(seat){if(id==='skip')opWait=0;return;}
  if(aimHand){if(id==='place'){aimHand=false;controls();speak('Aim');return;}const dirs={moveL:[-18,0],moveR:[18,0],moveU:[0,-18],moveD:[0,18]};if(dirs[id]){const [dx,dy]=dirs[id],b=balls[0];if(openSpot(balls,b.x+dx,b.y+dy))respot(balls,0,b.x+dx,b.y+dy);}return;}
  if(id==='strike')deal();else if(id==='call'){called=(called+1)%6;notice='Called pocket · '+pocketNames[called];speak('Called pocket');controls();}
 }
 load();
 return {action:act,key(edge,code){if(done||paused)return;if(edge==='up'){if(aimHeld?.code===code)aimHeld=null;return;}
  const keys={Space:'strike',KeyC:'call',KeyX:'file',KeyB:'history',KeyR:'reset',Enter:phase==='card'?'next':seat?'skip':'place'};
  if(aimHand&&code.startsWith('Arrow')){act({ArrowLeft:'moveL',ArrowRight:'moveR',ArrowUp:'moveU',ArrowDown:'moveD'}[code],'down');return;}
  if(keys[code]){act(keys[code],'down');return;}if(phase!=='aim'||seat)return;
  if(['ArrowLeft','ArrowRight','KeyA','KeyD'].includes(code)){const sign=code==='ArrowRight'||code==='KeyD'?1:-1,coarse=code.startsWith('Key');angle+=sign*(coarse?.085:.010);aimHeld={code,sign,coarse,age:0};speak('Aim');}
  if(code==='ArrowUp'||code==='ArrowDown'){power=clamp(power+(code==='ArrowUp'?.04:-.04),.1,1);speak(power>.78?'Full power':'Half power');}
  if(code==='KeyQ'||code==='KeyE'){spin=clamp(spin+(code==='KeyQ'?-.25:.25),-1,1);speak(spin<0?'Draw':'Follow');}controls();},
 pointer(type,x,y,w,h){if(done||paused||phase!=='aim'||seat)return;if(type==='cancel'){drag=null;return;}const g=layout(w,h),[xx,yy]=g.felt(x,y);
  if(type==='down'){if(xx<0||xx>800||yy<0||yy>400)return;drag={x:xx,y:yy,px:x,py:y,onCue:dist(xx,yy,balls[0].x,balls[0].y)<Math.max(32,24/g.scale)};return;}
  if(!drag)return;const far=Math.hypot(x-drag.px,y-drag.py)>9;
  if(aimHand){if(type==='up'){if(openSpot(balls,xx,yy)){respot(balls,0,xx,yy);speak('Ball in hand');}drag=null;}return;}
  if(drag.onCue&&far){angle=Math.atan2(drag.y-yy,drag.x-xx);power=clamp(dist(xx,yy,drag.x,drag.y)/145,.1,1);controls();}
  if(type==='up'){if(!far||!drag.onCue){angle=Math.atan2(yy-balls[0].y,xx-balls[0].x);speak('Aim');}drag=null;}},
 update(dt){if(done||paused)return;clock+=dt;if(aimHeld){aimHeld.age+=dt;if(aimHeld.age>.21)angle+=aimHeld.sign*(aimHeld.coarse?1.4:.36)*dt;}
  sparks=sparks.filter(e=>(e.t+=dt)<.56);if(phase==='aim'&&seat){opWait-=dt;if(opWait<=0)deal();return;}if(phase!=='rolling')return;
  acc+=Math.min(dt,.1);while(acc+1e-9>=DT&&phase==='rolling'){acc-=DT;const old=log.events.length;tick(balls,wells,log);if(Math.floor(log.time/DT)%5===0){historyTrail.push([balls[0].x,balls[0].y]);if(historyTrail.length>72)historyTrail.shift();}
   for(const ev of log.events.slice(old)){if(ev.type==='contact')sound.play('clack',ev.speed);if(ev.type==='rail')sound.play('rail',ev.speed);if(ev.type==='pot'){sound.play(ev.id?'pocket':'scratch');}if(ev.type==='rail'&&log.rails.length===1&&ev.speed>170)speak('Rail contact');if(!api.reducedMotion&&ev.type!=='pot'&&ev.speed>70)sparks.push({x:ev.x,y:ev.y,col:ev.type==='pot'?'#ffe1a5':'#adede1',t:0});}
   if(!balls.some(moving))settle();}},
 demo(dt){if(paused||done||phase==='rolling')return;demoWait-=dt;if(demoWait<=0){demoWait=phase==='card'?1.25:.9;fireDemo();}},
 draw(c,w,h){if(compact!==(w<530)){compact=w<530;controls();}const active=activeAtlas(),pr=active?(primaryMet?card.extra.find(id=>!balls.find(b=>b.id===id).potted):card.target):targets(balls,seat)[0];
 paint(c,w,h,{phase,seat,angle,power,spin,called,balls,wells,log,notice,hand:aimHand,time:clock,primary:pr,sparks,historyTrail:phase==='rolling'||readHistory?historyTrail:null,leave:active&&!primaryMet&&['draw','follow'].includes(card.feat)?leaves[index]:null,
 chapter:active?card.chapter:table.level,head:active?card.name:table.name,sub:active?chapters[card.chapter].toUpperCase()+'  /  '+String(index+1).padStart(2,'0')+'   ·   PAR '+card.par:mode==='house'?'HOUSE RUN   ·   RACK '+(racks+1):'HOUSE MATCH   ·   '+(seat?'STRIPES':'SUNS'),patches,reduced:api.reducedMotion});},
 pause(){paused=true;drag=aimHeld=null;sound.stop();},resume(){paused=false;},cancelInput(){drag=aimHeld=null;},dispose(){done=true;sound.stop();},
 inspect(){return {phase,seat,angle,power,spin,called,score,stars,index,stroke,playerPots,aimHand,innings,balls,log,turns,notice,table};}};
 }};
