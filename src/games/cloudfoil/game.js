import {routes,shelf,fileCard} from './routes.js';
import {makeRun,solution,setLane,hold,launch,tick,clamp} from './flight.js';
import {flightDirector,pilots} from './pilot.js';
import {lines} from './lines.js';
import {airSound} from './sound.js';
import {render} from './render.js';

const pads=[{id:'jump',label:'Hold to leap',key:'Space'},{id:'left',label:'Trim −'},{id:'right',label:'Trim +'},
 {id:'far',label:'Far'},{id:'middle',label:'Mid'},{id:'near',label:'Near'}];
const keyboard={Space:'jump',ArrowLeft:'left',ArrowRight:'right',KeyA:'left',KeyD:'right',KeyF:'file',
 Digit1:'far',Digit2:'middle',Digit3:'near',ArrowUp:'up',ArrowDown:'down'};
const report={id:'file',label:'File airbill',key:'F'};
function chooseRoute(api){
 const book=shelf(api.openingProgress ?? api.store?.read());
 const next=routes.findIndex(r=>!book[r.id]);
 const requested=api.options?.route;
 return requested==null||requested==='next'?Math.max(0,next):clamp(parseInt(requested,10)||0,0,routes.length-1);
}
export default {
 title:'WINGWALK EXPRESS',tagline:'The runway is another pilot’s wing. Bend your knees, read the wind and deliver the morning post.',
 modes:[{id:'post',label:'Post Run'},{id:'red',label:'Red-eye nonstop'},{id:'daily',label:'Daily airbill'}],
 options:[{id:'route',label:'Postal route',values:[{id:'next',label:'Next unsigned route'},...routes.map(r=>({id:String(r.id),label:(r.id+1)+' · '+r.name}))]}],
 controls:pads,
 keys:[['Space','Hold to load the spring in her knees. Release at the green mark.'],['← / →','Trim forward or back in flight.'],['↑ / ↓ or 1–3','Choose the far, middle or near row of sky. F files an airbill once you have a delivery.']],
 touch:[['Hold and release','Use Hold to leap, or press and release anywhere on the sky.'],['Depth tabs and trim','Set the destination row before takeoff. Hold a trim pad to correct your landing.']],
 instructions:[['Stamp the wing','Hold and release at the green stripe. Aim AGI-1’s feet at the mint stripe on the next plane. Four center landings earn First Class.'],
 ['Read the destination','Each receiver is marked FAR, MID or NEAR. Choose that depth. Its ribbon points with the gust. A letter in the air adds to the bill.'],
 ['Collect the post','Fly both halves of eighteen routes to keep the postcards. Red-eye runs until your three parachutes open. The daily airbill has fifteen handoffs.']],
 progress(data){const cards=Object.values(shelf(data));return cards.length+' / 18 postal cards · '+cards.reduce((n,p)=>n+(p.grade||0),0)+' / 54 postmarks';},
 scoreGroup:({mode,options,seed})=>mode==='daily'?'daily/'+seed:mode==='post'?'post/'+options.route:mode,
 create(api){
  const mode=api.mode||'post',seed=api.seed??Math.floor(api.rng()*4294967296),route=api.demo?4:chooseRoute(api);
  const s=makeRun(seed,mode,route),sound=airSound(api);
  const view={camera:(s.origin.x+s.dest.x)*.5,quiet:!!api.reducedMotion,mark:solution(s),stamp:0,label:''};
  const demo=flightDirector(pilots.courier,seed);let paused=false,finished=false,heldL=false,heldR=false,nextInstrument=0,soundClock=0,oldChain=0,carried=false;
  function say(key){if(lines[key])api.say?.(lines[key]);}
  function controls(){api.controls?.([...pads.map(p=>['far','middle','near'].includes(p.id)?{...p,pressed:p.id===['far','middle','near'][s.lane+1]}:p),...(s.delivered?[report]:[])]);}
  function hud(){api.hud('Handoffs',s.delivered,'First class','×'+s.chain);}
  function stamp(label){view.label=label;view.stamp=1.08;}
  function finish(clear=false){
   if(finished)return;finished=true;s.ended=true;sound.stop();
   const grade=s.chutes>=2&&s.perfect>=Math.floor(s.delivered*.5)?3:s.chutes>0?2:1;
   if(!api.demo&&s.delivered)api.store?.update(d=>{
    const out=clear&&mode==='post'?fileCard(d,route,grade,s.score):d;
    const book=out.wingwalk||{},counter={...book,bestChain:Math.max(book.bestChain||0,s.bestChain),longest:Math.max(book.longest||0,s.delivered)};
    if(mode==='daily')counter.daily={...book.daily,[seed]:Math.max(book.daily?.[seed]||0,s.score)};
    return {...out,wingwalk:counter};
   });
   const previous=api.personalBest?.('airbill');
   if(!api.demo&&s.score>0)api.rememberBest?.('airbill',s.score);
   api.end(s.score,[['Handoffs',s.delivered],['Center landings',s.perfect],['Flying letters',s.letters],['Best First Class','×'+s.bestChain],['Flight time',Math.round(s.t)+' s']],
    clear&&mode==='post'&&route===17?lines.final:clear?lines.district:previous!=null&&s.score>previous?lines.best:lines.finish);
  }
  function events(){
   for(const e of s.events){
    if(e==='complete'||e==='finish'){finish(e==='complete');break;}
    sound.cue(e,s.chain);
    if(e==='charge') {if(s.delivered<1)say('charge');}
    else if(e==='launch'){oldChain=s.chain;carried=!!s.letter;if(s.delivered<1)say('launch');}
    else if(e==='parcel'){carried=false;say('parcel');api.effect?.('parcel','+45');}
    else if(e==='center'||e==='edge'){
     hud();controls();api.haptic?.(e==='center'?20:10);
     say(e==='edge'?'edge':s.chain===2?'twice':s.chain===3?'triple':'center');
     api.effect?.(e==='edge'?'edge':'perfect',e==='edge'?'EDGE SAVE':'STAMPED');nextInstrument=0;
     if(s.delivered===1)say('safe');
     else if(s.seg.glyph==='g'||s.seg.glyph==='t'){say('gust');sound.cue('gust');}
     else if(s.seg.glyph==='c')say('climb');
     else if(s.seg.level===5&&s.seg.glyph==='r')say('storm');
     else if(oldChain>1&&e==='edge')say('lost');
     else if(carried)say('skip');
     else if(s.seg.glyph==='b')say('bank');
     else if(s.letter&&!s.letter.taken)say('optional');
    }else if(e==='firstclass'){stamp('FIRST CLASS ×'+s.chain);api.effect?.('streak');say('firstclass');}
    else if(e==='relay'||e==='home'){stamp(e==='home'?'HOMEWARD POST':'AIR RELAY');api.effect?.('combo');say(e==='home'?'district':s.seg.level===5?'dry':mode==='red'?'milestone':'relay');}
    else if(e==='chute'){hud();say(s.chutes===1?'last':'chute');api.effect?.('miss','CHUTE');api.haptic?.([12,25,12]);}
    else if(e==='reboard'){say(s.saves%2===0?'reboard':s.cause==='late'?'late':s.cause==='lane'?'lane':s.cause==='short'?'short':'long');}
    else if(e==='far'||e==='near'){say(e);controls();}
    else if(e==='middle')controls();
   }
   s.events.length=0;
  }
  function cancel(){s.held=false;s.charge=0;s.trim=0;heldL=heldR=false;}
  function action(id,phase){
   if(finished||paused)return;
   if(phase==='cancel'){cancel();return;}
   if(id==='jump'){if(phase==='down')hold(s);else if(phase==='up')launch(s);}
   else if(id==='left'||id==='right'){
    const down=phase==='down';if(id==='left')heldL=down;else heldR=down;
    s.trim=Number(heldR)-Number(heldL);if(down)sound.cue('trim');
   }else if(phase==='down'){
    if(id==='file'&&s.delivered){finish();return;}
    const n=['far','middle','near'].indexOf(id);
    if(n>=0)setLane(s,n-1);
    if(id==='up'||id==='down')setLane(s,s.lane+(id==='up'?-1:1));
   }
   events();
  }
  controls();hud();say(mode==='daily'?'daily':'boarding');
  return {action,key(phase,code){if(keyboard[code])action(keyboard[code],phase);},
   pointer(phase){if(phase!=='move')action('jump',phase);},
   pause(){paused=true;cancel();sound.stop();},resume(){paused=false;},cancelInput:cancel,dispose(){paused=true;sound.stop();},
   update(dt){
    if(paused||finished)return;
    tick(s,dt);events();
    const center=(s.origin.x+s.dest.x)*.5;
    view.camera+=(center-view.camera)*(1-Math.exp(-dt*(view.quiet?8:3.1)));
    view.stamp=Math.max(0,view.stamp-dt);
    if(s.t>=nextInstrument){nextInstrument=s.t+.13;view.mark=solution(s);}
    if(s.t>=soundClock&&!finished){soundClock=s.t+.09;sound.engine(s.charge,s.phase==='air');}
   },
   demo(){if(!finished&&!paused)demo(s);},draw(c,w=480,h=480){render(c,w,h,s,view);},
  };
 },
};
