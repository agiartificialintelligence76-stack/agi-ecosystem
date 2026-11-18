import {hole,HOLES,systems,dailyNine} from './courses.js';
import {DT,launch,control,advance,clamp,quantAngle,quantPower,gap} from './flight.js';
import {ghostPath,recordFlight,rankFlight} from './ghost.js';
import {chart,draw} from './render.js';
import {radio} from './sound.js';
import {lines} from './lines.js';
const button=(id,label,key,extra={})=>({id,label,key,...extra});
const slider=(power)=>({id:'power',label:'Sling power %',type:'range',min:8,max:100,step:1,value:Math.round(power*100)});
const start=[button('launch','Launch capsule','Space')];
const words={port:'Port',starboard:'Starboard',flip:'Flip',brake:'Brake'};
export default {title:'SLINGSHOT GIRL',tagline:'Launch AGI-1 into a pocket solar system. Fly the bend, flip her field and brake into orbit.',
 modes:[{id:'course',label:'Constellation tour'},{id:'daily',label:'Daily nine'},{id:'endless',label:'Comet Carry'}],
 options:[{id:'flag',label:'Tour starting hole',values:HOLES.map(h=>({id:String(h.id),label:(h.id+1)+' · '+h.name}))},{id:'ghost',label:'Best flight ghost',values:[{id:'off',label:'Hidden'},{id:'on',label:'Show my best'}]}],controls:start,
 instructions:[['Stretch the sling','Drag back from the capsule for angle and power. Release to fly, or tap a point to aim and press Launch.'],
 ['Fly the shot','Port and starboard turn the flight path. Brake sheds speed. You can invert gravity once during each launch.'],
 ['Catch the cup','Enter the open arc at capture speed and stay through the orbit. Pink flags need inverted gravity. Pulse zones need a thrust or brake inside the dashed circle.'],
 ['Keep a postcard','Play 36 flags across six systems, the daily nine or a reserve-limited run. Pair two all-ring par flags for an extra reserve. Your best input flight can become a ghost.']],
 keys:[['← / →, ↑ / ↓','Aim and power at the tee'],['Space','Launch'],['A / D, S, F','Port, starboard, brake and flip in flight'],['N, G, X','Flight notes, show ghost, file the completed card']],
 touch:[['Tee','Tap an aim point or pull back from the ship and release. The Launch button also takes off.'],['Flight','The labeled thrusters, brake and polarity control work in flight. A purple pulse zone must receive an impulse.']],
 progress(data){const n=Object.keys(data?.orbitPost?.flags||{}).length;return n?n+' of 36 flags in your postcard album.':'';},
 create(api){
 const seed=api.seed??Math.floor((api.rng?.()??.5)*0xffffffff),mode=api.mode||'course',daily=dailyNine(seed),audio=radio(api.audio);
 const first=api.demo?26:clamp(Number(api.options?.flag)||0,0,35),saved=()=>api.store?.read?.().orbitPost||{};
 let course,leg,legId=0,phase='aim',f=null,angle=0,power=.5,strokes=0,spent=0,rings=0,score=0,totalStrokes=0,flags=0,failures=0,reserve=7,cleanChain=0,stars=0,run=0,clock=0,acc=0,blast=0,notice='',drag=null,aimHeld=null,tape=null,tapes=[],ghost=null,showGhost=api.options?.ghost==='on',ended=false,paused=false,notes=false,delay=0,demoDelay=.82,demoStep=0,autoDemo=!!api.demo;
 const heldKeys=new Set(),heldPads=new Set();
 const say=k=>api.say?.(lines[k]||k);
 function hud(){api.hud?.(mode==='endless'?'Reserve':'Strokes',mode==='endless'?reserve:strokes+' / '+course.par,'Flags',flags);}
 function dock(){
  if(phase==='card'){api.controls?.([button('next',mode==='daily'&&run===8?'File daily nine':'Next flag','Enter'),button('file','File postcard','X'),...(mode==='endless'?[]:[button('replay','Refly this hole','R')])]);return;}
  if(phase==='relay'||phase==='lost'){api.controls?.([button('ready',phase==='relay'?'Launch from relay':'Return to recovery tee','Enter'),button('note','Flight notes','N')]);return;}
  if(phase==='aim'){api.controls?.([button('launch','Launch capsule','Space'),slider(power),button('left','Aim left','←'),button('right','Aim right','→'),button('note','Flight notes','N'),button('ghost',showGhost?'Hide ghost':'Best ghost','G')]);return;}
  const lock=phase!=='flight';api.controls?.([button('port','Port thrust','A',{disabled:lock||f.fuel<=0}),button('starboard','Starboard thrust','D',{disabled:lock||f.fuel<=0}),button('brake','Brake','S',{disabled:lock||f.fuel<=0}),button('flip',f.flip?'Invert gravity':'Polarity flipped','F',{disabled:lock||!f.flip})]);
 }
 function tee(){
  leg=course.legs[legId];phase='aim';f=null;tape=null;acc=0;drag=aimHeld=null;notes=false;demoStep=0;
  angle=quantAngle(leg.input.angle+(course.id&&!autoDemo?(course.id%2?.055:-.07):0));power=course.id&&!autoDemo?quantPower(leg.input.power-.025):leg.input.power;
  ghost=showGhost?ghostPath(course,legId,saved().bests?.[course.id+'/'+course.variant]):null;
  notice=course.id===0?'Launch through the golden ring into the mint cup.':leg.beacon?'Pulse inside the dashed zone, then enter the cup’s open arc.':leg.phaseRequired?'An amber flag needs inverted gravity. Watch your speed.':'Line up the open cup and save a puff to brake.';
  if(legId)say('Recovery tee');else if(mode==='daily')say('Daily');else if(course.system===5)say('Moving cup');else if(course.system===2)say('Binary well');else say('First tee');
  hud();dock();
 }
 function load(id,variant=0){course=hole(id,variant);legId=0;strokes=spent=rings=0;tapes=[];stars=0;tee();}
 function fire(){if(phase!=='aim'||ended)return;if(mode==='endless'&&reserve<=0){finish();return;}if(mode==='endless')reserve--;
  f=launch(leg.tee,angle,power,leg.fuel);tape={angle:quantAngle(angle),power:quantPower(power),controls:[]};strokes++;totalStrokes++;phase='flight';drag=aimHeld=null;acc=0;demoStep=0;blast=1;audio.play('launch');api.haptic?.(10);say('Release');notice=leg.beacon?'Watch the purple pulse zone.':leg.phaseRequired?'Invert before entering the pink cup.':'Port / starboard to bend. Brake to settle.';hud();dock();}
 function burn(id){if(phase!=='flight')return;
  if(!control(f,id,leg)){say(id==='flip'?'Flip ready':'No fuel');return;}tape.controls.push({tick:f.tick,id});if(id!=='flip')spent++;blast=1;audio.play(id,f.fuel);api.haptic?.(id==='flip'?17:7);
  if(id==='flip'){say(f.near<65?'Perfect periapsis':'Inversion');notice='Field inverted. Your capsule now repels the wells.';}
  else if(f.charged&&leg.beacon&&gap(f,leg.beacon)<leg.beacon.radius){say('Perfect periapsis');notice='Relay charged · find the open cup.';}
  else if(id==='brake'){say('Brake');notice='Braking · relative speed decreased.';}else{say(f.burns===1?'First nudge':f.fuel===1?'Saved burn':f.tick<46?'Early burn':'Late burn');notice=f.fuel+' thrust charge'+(f.fuel===1?'':'s')+' left.';}dock();
 }
 function finish(){if(ended)return;ended=true;audio.stop();api.end?.(score,[['Flags captured',flags],['Strokes',totalStrokes],['Recoveries',failures],['Latest postcard',course.name],['Latest stars','★'.repeat(stars)||'—']],lines[flags?'One stroke':'Reserve empty']);}
 function capture(){
  rings+=f.rings;tapes[legId]=tape;blast=0;audio.play('sink');api.haptic?.(27);
  if(legId<course.legs.length-1){phase='relay';notice='Relay secured · one more sling toward the final cup.';say('Recovery tee');dock();return;}
  phase='card';flags++;stars=1+Number(strokes<=course.par)+Number(rings>=course.legs.reduce((a,l)=>a+l.rings.length,0));
  const prior=saved().bests?.[course.id+'/'+course.variant];const value=recordFlight(api.store,course,strokes,spent,rings,tapes);score+=value;
  const flagSet=saved().flags||{},pin=Array.from({length:6},(_,i)=>!!flagSet[course.system*6+i]).every(Boolean);
  if(mode==='endless'){if(strokes===course.par&&stars===3){cleanChain++;if(cleanChain===2){reserve++;cleanChain=0;}}else cleanChain=0;}
  if(mode==='endless'&&flags%6===0){reserve+=flags===12?5:3;say('Reserve refill');}else say(pin?'Pin earned':prior&&value>prior.score?'Beat ghost':strokes===1?'One stroke':strokes===course.par?'Par':'Sink');
  notice='Postcard sealed · '+('★'.repeat(stars))+' · '+rings+' ring'+(rings===1?'':'s')+' collected.';api.effect?.('clear');audio.play('stamp');hud();dock();
 }
 function lose(){phase='lost';failures++;audio.play('miss');say(f.fast?'Too fast':f.gateMiss?'Gate misses':f.energyMiss?'Flip ring':'Recovery tee');notice=f.fast?'Too fast. Save a brake for the cup.':f.energyMiss?'The cup needs its phase or relay charge.':'Your capsule drifted clear. The tee is ready.';
  if(mode==='endless'&&reserve<=0){finish();return;}dock();}
 function act(id,ev='down',value){
  if(ended||paused)return;if(ev==='input'&&id==='power'&&phase==='aim'){power=quantPower(value/100);return;}if(ev!=='down')return;
  if(id==='file'&&phase==='card'){finish();return;}
  if(id==='note'){notes=!notes;notice=notes?'Pilot notes · '+Math.round(leg.input.power*100)+'%  '+(leg.input.controls.map(v=>words[v.id]+' '+(v.tick*DT).toFixed(1)+'s').join(' / ')||'clean launch, no burns'):'Fly the open arc at capture speed.';return;}
  if(phase==='card'){
   if(id==='replay'&&mode!=='endless'){load(course.id,course.variant);return;}
   if(id!=='next')return;run++;
   if(mode==='daily'){if(run>=9){finish();return;}load(daily[run].id,daily[run].variant);}
   else if(mode==='endless'){if(reserve<=0){finish();return;}const item=dailyNine(seed+run*829)[run%9];load(item.id,item.variant);}
   else load((course.id+1)%36);return;
  }
  if((phase==='lost'||phase==='relay')&&id==='ready'){if(phase==='relay')legId++;tee();return;}
  if(phase==='aim'){if(id==='launch')fire();else if(id==='left'||id==='right')angle=quantAngle(angle+(id==='left'?-1:1)*Math.PI/90);
   else if(id==='ghost'){showGhost=!showGhost;ghost=showGhost?ghostPath(course,legId,saved().bests?.[course.id+'/'+course.variant]):null;notice=ghost?'Best flight is traced in violet.':showGhost?'Complete this flag to record its ghost.':'Ghost hidden.';if(ghost)say('Ghost ahead');dock();}return;}
  if(['brake','port','starboard','flip'].includes(id))burn(id);
 }
 const firstCourse=mode==='daily'?daily[0]:mode==='endless'?{id:0,variant:0}:{id:first,variant:0};load(firstCourse.id,firstCourse.variant);
 return {action(id,ev,value){if(ev==='up'){heldPads.delete(id);return;}if(ev==='down'){if(heldPads.has(id))return;heldPads.add(id);}act(id,ev,value);},key(ev,code){if(ev==='up'){heldKeys.delete(code);if(aimHeld?.code===code)aimHeld=null;return;}if(ended||paused||heldKeys.has(code))return;heldKeys.add(code);
  const map={Space:'launch',KeyA:'port',KeyD:'starboard',KeyS:'brake',KeyF:'flip',KeyX:'file',KeyG:'ghost',KeyN:'note',KeyR:'replay',Enter:phase==='card'?'next':'ready'};
  if(phase==='aim'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(code)){
   if(code==='ArrowLeft'||code==='ArrowRight'){const sign=code==='ArrowLeft'?-1:1;angle=quantAngle(angle+sign*Math.PI/360);aimHeld={code,sign,t:0};}
   else{power=quantPower(power+(code==='ArrowUp'?.025:-.025));dock();}return;}if(map[code])act(map[code]);},
 pointer(ev,x,y,w,h){if(ended||paused||phase!=='aim')return;if(ev==='cancel'){if(drag){angle=drag.oldAngle;power=drag.oldPower;}drag=null;return;}const g=chart(leg,w,h),[xx,yy]=g.flight(x,y),[tx,ty]=g.world(leg.tee.x,leg.tee.y);
  if(ev==='down'){drag={x,y,tee:Math.hypot(x-tx,y-ty)<Math.max(25,g.s*32),oldAngle:angle,oldPower:power};if(drag.tee){audio.play('wind');say('Pull back');}return;}
  if(!drag)return;const far=Math.hypot(x-drag.x,y-drag.y)>10;
  if(far&&drag.tee){angle=quantAngle(Math.atan2(leg.tee.y-yy,leg.tee.x-xx));power=quantPower(Math.hypot(x-drag.x,y-drag.y)/Math.min(118,w*.29));dock();}
  if(ev==='up'){const shoot=drag.tee&&far;if(!far&&!drag.tee)angle=quantAngle(Math.atan2(yy-leg.tee.y,xx-leg.tee.x));drag=null;if(shoot)fire();}},
 update(dt){if(ended||paused)return;clock+=dt;blast=Math.max(0,blast-dt*3.7);if(aimHeld){aimHeld.t+=dt;if(aimHeld.t>.22)angle+=aimHeld.sign*dt*.85;}
  if(phase!=='flight'&&phase!=='capture')return;acc+=Math.min(dt,.1);
  while(acc+1e-9>=DT&&(phase==='flight'||phase==='capture')){acc-=DT;
   if(autoDemo)while(leg.input.controls[demoStep]?.tick===f.tick){burn(leg.input.controls[demoStep++].id);}
   const events=advance(f,leg);for(const e of events){
    if(e==='ring'){audio.play('ring');say(f.rings>1?'Ring procession':'First ring');}
    else if(e==='satellite'){audio.play('stamp');say('Reserve refill');notice='Satellite mail · one spare thrust charge.';dock();}
    else if(e==='close'){audio.play('close');say('Close pass');}
    else if(e==='fast'){say('Too fast');notice='Fly-by · relative speed exceeds the cup limit.';}
    else if(e==='field'){say('Flip ring');notice='Field mismatch · the cup could not catch you.';}
    else if(e==='rim'){say('Gate misses');notice='Rim contact · approach through the open arc.';}
    else if(e==='capture'){phase='capture';audio.play('capture');say('Capture begins');notice='Orbit capture · hold through the gold arc.';dock();}
    else if(e==='sink')capture();else if(e==='lost')lose();}
  }},
 demo(dt){if(ended||paused)return;autoDemo=true;if(phase==='flight'||phase==='capture')return;demoDelay-=dt;if(demoDelay>0)return;
  if(phase==='aim'){angle=leg.input.angle;power=leg.input.power;fire();demoDelay=.8;}
  else if(phase==='card'){load((course.id+1)%36);demoDelay=1.25;}else{act('ready');demoDelay=.50;}},
 draw(c,w,h){draw(c,w,h,{course,leg,f,phase,time:clock,angle,power,notice,blast,ghost,reduced:api.reducedMotion});},
 pause(){paused=true;heldKeys.clear();heldPads.clear();drag=aimHeld=null;audio.stop();},resume(){paused=false;},cancelInput(){heldKeys.clear();heldPads.clear();if(drag){angle=drag.oldAngle;power=drag.oldPower;}drag=aimHeld=null;},dispose(){ended=true;audio.stop();},
 inspect(){return {phase,id:course.id,legId,angle,power,score,strokes,flags,reserve,stars,f,notice,tape,showGhost};}};
 }};
