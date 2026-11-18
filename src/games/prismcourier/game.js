import { chamber,choose,createTake,readGallery,accessible,recordClear } from './rehearsal.js';
import { frames,galleries } from './chambers.js';
import { arrows,names,search,stars } from './maze.js';
import { lines } from './lines.js';
import { mirrorSound } from './sound.js';
import { render } from './render.js';

const directionIds=['up','right','down','left','rest','exchange'];
const keyboard={ArrowUp:'up',ArrowRight:'right',ArrowDown:'down',ArrowLeft:'left',KeyW:'up',KeyD:'right',KeyS:'down',KeyA:'left',Space:'rest',KeyX:'exchange',KeyZ:'undo',KeyH:'hint',KeyB:'file',Enter:'next',KeyT:'tape',KeyN:'drill'};
const pads=['↑ Up','→ Right','↓ Down','← Left'].map((label,i)=>({id:directionIds[i],label}));
const finish={id:'file',label:'File rehearsal',key:'B'};
const next={id:'next',label:'Next chamber',key:'Enter'};
export default {
 title:'SPLIT PERSONALITY',tagline:'One arrow, two sets of footsteps. Bring both AGI-1s onto their stars in forty mirror chambers.',
 modes:[{id:'gallery',label:'Five galleries'},{id:'daily',label:'Daily mirror'},{id:'studio',label:'Mirror studio'}],
 options:[{id:'room',label:'Chamber',values:[{id:'continue',label:'Continue / shuffle studio'},...frames.map(r=>({id:String(r.id),label:(r.id+1)+'. '+r.name}))]}],
 controls:pads,keys:[['Arrows / WASD','Direct both girls'],['Space / X','Rest in a delay room / exchange on a relay'],['H / Z / B','Show the next step / undo / file this rehearsal']],
 touch:[['Swipe a floor or use the arrows','Give one command to both performers'],['Hint / Undo','Preview an optimal step or take one back']],
 instructions:[
   ['Meet on both stars','Coral follows the arrow. In the dressing room Cyan mirrors it left to right. Bumping a wall lets the other girl move alone.'],
   ['Read her compass','Each gallery changes one rule. Ice carries a girl to a dry tile. A colored signature opens the other girl’s door. Exchange their parts at a gold relay.'],
   ['Keep your choreography','Gold means matching the shortest sequence. Five completed chambers open the next gallery. In the studio you can replay a saved sequence one step at a time.'],
 ],
 progress(save){const rooms=Object.values(readGallery(save));return rooms.length+' / 40 reunions · '+rooms.reduce((s,r)=>s+r.stars,0)+' / 120 stars';},
 create(api){
   const mode=api.mode||'gallery',seed=api.seed??Math.floor(api.rng()*4294967296),selection=api.options?.room;
   const book=()=>readGallery(api.store?.read());
   let room=api.demo?chamber(10):choose(seed,mode,selection,book()), take,from,clock=0,tween=1,flash=0,ended=false;
   let score=0,clears=0,lastBeat=-1,demoAge=0,demoPath=[],preview=null,earned=0,drag=null,paused=false,seen=new Set(),studioTape='';
   const sound=mirrorSound(api), voiceCounts={};
   function tell(kind,custom){
     const n=voiceCounts[kind]||0;voiceCounts[kind]=n+1;
     api.say?.(custom||lines[kind][n%lines[kind].length]);
   }
   function controls(){
     if(take.solved){api.controls?.(mode==='gallery'&&room.id<39?[next,finish]:[finish]);return;}
     const extra=[];
     if(room.delay)extra.push({id:'rest',label:'Rest ·',key:'Space'});
     if(room.exchange)extra.push({id:'exchange',label:'Exchange ⇄',key:'X'});
     if(mode==='studio')extra.push({id:'drill',label:'New blocking',key:'N'});
     if(mode==='studio'&&studioTape)extra.push({id:'tape',label:'Step best take',key:'T'});
     api.controls?.([...pads,...extra,{id:'undo',label:'Undo',key:'Z'},{id:'hint',label:'Hint',key:'H'},finish]);
   }
   function hud(){api.hud('Moves',take.length+' / '+room.par,'Chamber',(room.id+1)+' / 40');}
   function open(r){
     room=r;take=createTake(r);from=take.state;tween=1;earned=0;seen=new Set();preview=r.id===0?1:null;demoPath=[];studioTape=r.edition===0?(book()[r.id]?.tape||''):'';
     controls();hud();tell(r.delay?'queue':r.gallery===1?'rotate':'opening');
   }
   function done(){
     if(ended)return;ended=true;sound('closing');
     api.end(score,[['Reunions',clears],['Current chamber',room.name],['Shortest solution',room.par+' commands'],['Moves this take',take.length],['Hints this take',take.hints]],lines.closing[clears%2]);
   }
   function move(cmd){
     const prior=take.state;from=prior;preview=cmd;
     const moved=take.step(cmd),s=take.state;
     if(!moved){sound('scuff');tell(s.a===prior.a?'coral':'cyan');return;}
     tween=0;lastBeat=clock;hud();
     const sideA=prior.a!==s.a,sideB=prior.b!==s.b;
     const slid=[['a',0],['b',1]].some(([key])=>Math.abs(prior[key]%5-s[key]%5)+Math.abs(Math.floor(prior[key]/5)-Math.floor(s[key]/5))>1);
     const tagged=s.seals!==prior.seals,half=s.a===room.goal[0]||s.b===room.goal[1];
     const kind=cmd===5?'exchange':tagged?'plate':cmd===4?'rest':slid?'slide':half?'half':!sideA?'coral':!sideB?'cyan':room.delay?'queue':room.gallery===1?'rotate':'mirror';
     sound(kind==='coral'||kind==='cyan'?'scuff':kind,sideA&&!sideB?-1:sideB&&!sideA?1:0);
     if(!seen.has(kind)||cmd===5||tagged||cmd===4){tell(kind);seen.add(kind);}
     if(tagged){api.effect?.('unlock','SIGNED');tell('doors');}
     if(!take.solved)return;
     earned=stars(room.par,take.length);flash=1;score+=take.score();clears++;
     if(!api.demo)api.store?.update(d=>recordClear(d,room,take,mode,seed));
     sound(room.id%8===7?'gallery':'reunion');api.effect?.('clear',earned===3?'PERFECT REUNION':'REUNITED');api.haptic?.([15,35,18]);
     tell(earned===3?'exact':'near');controls();
   }
   function action(id,phase){
     if(ended||paused||phase!=='down')return;
     if(id==='file'){done();return;}
     if(id==='drill'&&mode==='studio'){open(chamber(room.id,room.edition+1));sound('tape');return;}
     if(take.solved){
       if(id==='next'){
         if(mode!=='gallery'||room.id===39){done();return;}
         open(chamber(room.id+1));
       } return;
     }
     const cmd=directionIds.indexOf(id);if(cmd>=0){move(cmd);return;}
     if(id==='undo'){
       from=take.state;if(take.undo()){tween=0;preview=null;hud();sound('undo');tell('undo');}
     }else if(id==='hint'){
       preview=take.hint();sound('hint');
       tell('mirror',preview==null?'that turn closed our duet. undo until the ribbons meet again.':'try '+names[preview].toLowerCase()+'. see where both ribbons point.');
     }else if(id==='tape'&&studioTape){
       if(!studioTape.startsWith(take.tape)) {tell('undo','undo to rejoin the choreography on your sleeve.');return;}
       const ch=studioTape[take.length];if(ch!=null)move(Number(ch));
     }
   }
   open(room);
   return {
     action,key(type,code){if(keyboard[code])action(keyboard[code],type);},
     pointer(type,x,y){
       if(type==='down'){drag=[x,y];return;}
       if(type==='cancel'){drag=null;return;}
       if(type==='up'&&drag){
         const dx=x-drag[0],dy=y-drag[1];drag=null;
         if(Math.max(Math.abs(dx),Math.abs(dy))<15)return;
         action(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up','down');
       }
     },
     pause(){paused=true;drag=null;},resume(){paused=false;},cancelInput(){drag=null;},
     update(dt){if(ended||paused)return;clock+=dt;tween=Math.min(1,tween+dt*5.5);flash=Math.max(0,flash-dt);if(take.length&&clock-lastBeat>1.2&&tween===1&&!take.hints)preview=null;},
     demo(dt){
       if(ended||paused)return;
       demoAge+=dt;if(demoAge<.62)return;demoAge=0;
       if(take.solved){if(clears>=4)done();else open(chamber((room.id+3)%40));return;}
       if(!demoPath.length)demoPath=search(room,take.state)||[];
       if(demoPath.length)move(demoPath.shift());else done();
     },
     draw(c,w=480,h=480){render(c,w,h,{room,take,from,tween,flash,clock,preview,earned,reduced:api.reducedMotion});},
   };
 },
};
