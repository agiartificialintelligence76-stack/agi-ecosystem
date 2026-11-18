import { gameStore } from '../kit/store.js';
import { NAPS,WORLDS } from './levels.js';
import { initial,finished,command,watched,actionName,DIRECTIONS,ARROWS,CALL,WAIT,DOT } from './rules.js';
import { PROOFS } from './proofs.js';
import { solve } from './solver.js';
import { dailyNap } from './daily.js';
import { readBook,nextNap,isOpen,grade,points,archive,posesFor,starTotal } from './progress.js';
import { drawBoard,drawJournal,geometry,picked } from './render.js';
import { say } from './lines.js';
import { instrument } from './sound.js';

const modes=[{id:'story',label:'Bedtime Story'},{id:'daily',label:'Daily Cat'},{id:'journal',label:'Cat Journal'}];
const options=[{id:'nap',label:'Bedtime puzzle',values:[{id:'next',label:'Continue my book'},
 ...NAPS.map(b=>({id:String(b.id),label:b.id+' · '+b.name}))]}];
const button=(id,label,key,extra={})=>({id,label,key,...extra});
const moves=DIRECTIONS.map((id,i)=>button(id,ARROWS[i]+' '+id[0].toUpperCase()+id.slice(1),['W','D','S','A'][i]));
const standard=[...moves,button('call','Pspsps','C'),button('hint','Hint','H')];
const mainKeys={ArrowUp:'up',KeyW:'up',ArrowRight:'right',KeyD:'right',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',
 KeyC:'call',Space:'call',KeyQ:'look-left',KeyE:'look-right',KeyT:'wait',KeyZ:'undo',Backspace:'undo',KeyH:'hint',KeyR:'reset',
 Digit1:'dot-0',Digit2:'dot-1',Digit3:'dot-2',Digit4:'dot-3',Digit5:'dot-4',KeyF:'tools'};
const actionId=(b,a)=>a<4?DIRECTIONS[a]:a===4?'call':a===5?'look-left':a===6?'look-right':a===7?'wait':'dot-'+(a-DOT);
function toAction(id,b){const a=DIRECTIONS.indexOf(id);if(a>=0)return a;
 if(id==='call')return CALL;if(id==='look-left')return 5;if(id==='look-right')return 6;if(id==='wait')return WAIT;
 if(/^dot-[0-9]+$/.test(id)){const k=Number(id.slice(4));if(k<b.anchors.length)return DOT+k;}return -1;}
export function chooseNap(book,seed,choice){
 const fallback=book.last?.seed===seed?NAPS[book.last.id-1]:nextNap(book);
 const wanted=NAPS[Number(choice)-1];return wanted&&isOpen(wanted,book)?wanted:fallback;
}
export default {
 title:'KEYBOARD CATNAP',tagline:'Walk a little keyboard. Learn one particular cat.',
 instructions:[['Find her moon key','Walk into the cat from behind to nudge her. A clear row or column lets her hear Pspsps. Each call brings her one key closer.'],
 ['Read her paws','Mint keys are slippery. A numbered red dot draws her one step per turn. Hover a cap or ask for a hint to see the next landing.'],
 ['Watch your gaze','On the piano she only follows while unwatched. Turn in place or wait. On the writer’s board her landing keys must spell the ribbon word.']],
 keys:[['Arrows / WASD','Walk or nudge'],['C / Space','Call down a row'],['Q / E / T','Look left / right / wait'],['1–5','Aim numbered dot'],['Z / H / R','Undo / two-stage hint / reset']],
 touch:[['Tap a cap or swipe','Walk one key or nudge'],['Numbered cap','Aim its laser dot'],['Pspsps / More','Call, wait, turn or undo']],
 modes,options,controls:standard,
 scoreGroup:({mode,options,seed,openingProgress})=>mode==='daily'?'daily/'+seed:'bedtime/'+chooseNap(readBook(openingProgress??gameStore('rookery').read()),openingProgress==null?seed:null,options?.nap).id,
 progress(raw){const book=readBook(raw);return Object.keys(book.runs).length+'/45 naps  ·  '+starTotal(book)+'/135 stars  ·  Next: '+nextNap(book).name;},
 create(api){
  const seed=api.seed??7,mode=api.mode||'story',day=mode==='daily'?new Date().toISOString().slice(0,10):'';
  let book=readBook(api.store?.read?.()),b,proof,s,prev,history=[],actions=[],event={},clock=0,age=1;
  let sleeping=false,closed=false,paused=false,pending=null,tools=false,hintPhase=0,hintAction=-1,preview=-1;
  let catFace=1,herFace=1,drag=null,demoClock=0,journal=mode==='journal'&&!api.demo,poseIndex=0,pet=0;
  let reel=null,reelPointer=0,reelClock=0,replayIndex=0,voiceCounter=seed;
  const sound=instrument(api.audio,api.demo);
  const sayLine=k=>api.say?.(say(k,voiceCounter++));
  function loadBoard(board,solution){
   b=board;proof=solution;s=initial(b);prev=s;history=[];actions=[];event={};age=1;sleeping=false;pending=null;
   hintPhase=0;hintAction=-1;preview=-1;tools=b.anchors.length>0&&b.steps[s.agi].every(k=>k<0||['#',':'].includes(b.tiles[k]));
   catFace=1;herFace=1;drag=null;
  }
  const opening=api.openingProgress==null?book:readBook(api.openingProgress);
  const target=api.demo?NAPS[15]:chooseNap(opening,api.openingProgress==null?seed:null,api.options?.nap);
  if(mode==='daily'&&!api.demo){const result=dailyNap(seed);loadBoard(result.board,result.proof);}
  else loadBoard(target,PROOFS[target.id-1]);
  function hud(){
   if(journal&&!reel){api.hud?.('Naps',Object.keys(book.runs).length+'/45','Stars',starTotal(book));return;}
   api.hud?.(reel?'Replay':'Moves',actions.length,'Par',proof.par);
  }
  function controlList(){
   if(journal){
    if(reel)return [button('stop-replay','Close replay','X')];
    const saves=Object.keys(book.runs),r=NAPS[Number(saves[replayIndex%saves.length])-1];
    return [button('pet','Scritch','Space'),button('pose','Next pose','→',{disabled:posesFor(book).length<2}),
     ...(r?[button('entry','Next nap','N',{disabled:saves.length<2}),button('replay','Replay '+r.name,'V')]:[])];
   }
   const extras=b.anchors.length||b.shy;
   if(tools&&extras)return [
     ...b.anchors.map((k,i)=>button('dot-'+i,'Dot '+(i+1),String(i+1),{pressed:s.lure===i+1})),
     ...(b.shy?[button('look-left','Look ↶','Q'),button('look-right','Look ↷','E')]:[]),
     button('wait','Wait','T'),button('tools','Walk','F'),
     button('undo','Undo','Z',{disabled:!history.length}),button('hint',hintPhase===1?'Show move':'Hint','H')];
   return [...moves,button('call','Pspsps','C'),...(extras?[button('tools',b.shy?(b.anchors.length?'Look / dot':'Look / wait'):'Laser tools','F')]:[]),
    button('undo','Undo','Z',{disabled:!history.length}),button('hint',hintPhase===1?'Show move':'Hint','H')];
  }
  function refresh(){hud();api.controls?.(controlList());}
  function outcome(){
   const stars=grade(actions.length,proof.par),old=book.runs[b.id],posesBefore=posesFor(book).length;
   let line=say(stars===3?'best':'nap',voiceCounter++);
   if(!api.demo){api.store?.update?.(raw=>{book=archive(raw,b,actions,proof.par,seed,day);return {...raw,napBook:book};});
    if(!day&&posesFor(book).length>posesBefore)line+=' Journal pose: '+posesFor(book).at(-1).name+'.';
    if(!day&&!old&&NAPS.some(c=>c.world===b.world+1&&isOpen(c,book))&&Object.keys(book.runs).filter(i=>NAPS[i-1].world===b.world).length===5)line+=' '+WORLDS[b.world+1].name+' is open.';}
   closed=true;api.end?.(points(actions.length,proof.par),[['Nap',b.name],['Stars','★'.repeat(stars)+'☆'.repeat(3-stars)],['Moves / par',actions.length+' / '+proof.par],['Journal',Object.keys(book.runs).length+' / 45']],line);
  }
  function step(a,quiet=false){
   if(closed||paused||sleeping||!b.actions.includes(a))return;
   const e={action:a},next=command(b,s,a,e);
   if(next===s){
    if(!quiet){sound(a===CALL?'call':'bump',b.world);sayLine(a===CALL?watched(b,s)?'gaze':'blocked':a===WAIT?'wait':'bump');}
    return;
   }
   history.push(s);actions.push(a);prev=s;s=next;event=e;age=0;preview=-1;hintPhase=0;
   if(a===1||a===3)herFace=a===1?1:-1;
   catFace=Math.sign(s.cat%b.cols-prev.cat%b.cols)||catFace;
   if(!quiet){
    let speech=null,effect='step';
    if(a===CALL){speech='call';effect='call';}
    if(a>=DOT){speech=e.kind==='laser'?'laser':s.lure?'hidden':'stop';effect='laser';}
    if(e.kind==='push'){speech='push';effect='push';}
    if(e.kind==='creep'){speech='away';effect='creep';}
    if(!e.moved&&b.shy&&watched(b,s)){speech='gaze';effect='gaze';}
    if(e.slide){speech='slide';effect='slide';}
    if(e.letter){const wrong=s.typed<=prev.typed&&prev.typed<b.word.length;speech=wrong?'typo':s.typed===b.word.length?'word':'first';effect=wrong?'typo':s.typed===b.word.length?'word':'letter';}
    if(speech)sayLine(speech);
    sound(effect,b.world,s.typed*2);if(e.moved)api.haptic?.(e.slide?14:8);
   }
   if(finished(b,s)){
    sleeping=true;pending=1.25;
    if(!quiet){sayLine('nap');sound('nap',b.world);api.haptic?.([9,40,12]);}
   }
   refresh();
  }
  function undo(){
   if(!history.length||sleeping||closed)return;
   prev=s;s=history.pop();actions.pop();age=0;event={};hintPhase=0;preview=-1;sayLine('undo');sound('undo',b.world);refresh();
  }
  function hint(){
   if(sleeping||closed)return;
   const p=solve(b,s);
   if(!p?.path.length){api.say?.('This position is stuck. Undo one pawprint, or press R to start over.');return;}
   hintAction=p.path[0];const forecast=command(b,s,hintAction);
   preview=forecast.cat!==s.cat?forecast.cat:forecast.agi;
   hintPhase=Math.min(2,hintPhase+1);
   const cap=String.fromCharCode(65+preview%b.cols)+(1+Math.floor(preview/b.cols));
   api.say?.(hintPhase===1?(forecast.cat!==s.cat?'Her next paw can land on ':'Make room on ')+cap+'. Ask again for the move.':'Try '+actionName(b,hintAction)+'.');
   refresh();
  }
  function beginReplay(){
   const ids=Object.keys(book.runs);if(!ids.length)return;
   const id=Number(ids[replayIndex%ids.length]);loadBoard(NAPS[id-1],PROOFS[id-1]);
   reel=book.runs[id];reelPointer=0;reelClock=.38;api.say?.('Your saved '+reel.length+'-move route.');refresh();
  }
  function stopReplay(){reel=null;sleeping=false;pending=null;refresh();}
  function action(id,phase){
   if(phase!=='down'||closed||paused)return;
   if(journal){
    if(id==='stop-replay'){stopReplay();return;}if(reel)return;
    if(id==='pose'){poseIndex=(poseIndex+1)%posesFor(book).length;sayLine('pet');}
    if(id==='pet'){pet=.85;sound('pet');sayLine('pet');}
    if(id==='entry'){replayIndex++;}if(id==='replay')beginReplay();refresh();return;
   }
   if(sleeping)return;
   if(id==='tools'){tools=!tools;refresh();return;}
   if(id==='undo'){undo();return;}if(id==='hint'){hint();return;}
   if(id==='reset'){loadBoard(b,proof);sayLine('reset');refresh();return;}
   step(toAction(id,b));
  }
  const requested=NAPS[Number(api.options?.nap)-1],lockedTip=requested&&!isOpen(requested,book)?(requested.encore?'Clear all eight '+WORLDS[requested.world].name+' naps to open its encore. ':'Clear five '+WORLDS[Math.max(0,requested.world-1)].name+' naps to open '+WORLDS[requested.world].name+'. '):'';
  refresh();if(!api.demo)api.say?.(journal?'she kept every nap in here.':mode==='daily'?say('daily',seed)+' Today: '+b.change+'.':lockedTip+b.tip);
  function key(type,k){
   if(journal){const ids={KeyV:'replay',KeyN:'entry',KeyX:'stop-replay',Escape:'stop-replay',ArrowRight:'pose',Space:'pet'};if(ids[k])action(ids[k],type);return;}
   if(mainKeys[k])action(mainKeys[k],type);
  }
  function pointer(type,x,y,width,height){
   if(closed||paused||sleeping)return;
   if(journal){if(type==='down'&&!reel)action('pet','down');return;}
   const h=api.demo?height:Math.max(100,height-35),g=geometry(b,width,h),k=picked(b,g,x,y);
   if(type==='cancel'){drag=null;return;}
   if(type==='down'){drag=[x,y];return;}
   if(type==='move'&&!drag){
    if(hintPhase||k<0)return;const ai=b.anchors.indexOf(k);const a=ai>=0?DOT+ai:b.steps[s.agi].indexOf(k);
    const n=a>=0?command(b,s,a):s;preview=n.cat!==s.cat?n.cat:-1;return;
   }
   if(type!=='up'||!drag)return;
   const dx=x-drag[0],dy=y-drag[1];drag=null;
   if(Math.max(Math.abs(dx),Math.abs(dy))>Math.max(16,g.cw*.25)){step(Math.abs(dx)>Math.abs(dy)?dx>0?1:3:dy>0?2:0);return;}
   const ai=b.anchors.indexOf(k);if(ai>=0){step(DOT+ai);return;}
   const dir=b.steps[s.agi].indexOf(k);if(k>=0&&dir>=0)step(dir);else if(k===s.cat)step(CALL);
  }
  return {action,key,pointer,cancelInput(){drag=null;},
   update(dt){if(closed||paused)return;clock+=dt;age+=dt;pet=Math.max(0,pet-dt);
    if(reel&&!sleeping){reelClock-=dt;if(reelClock<=0&&reelPointer<reel.length){reelClock=.47;step(reel[reelPointer++],true);}}
    if(pending!==null&&(pending-=dt)<=0){pending=null;if(reel)stopReplay();else outcome();}
   },
   demo(dt=.016){if(paused||closed||sleeping||journal)return;demoClock+=dt;if(demoClock<.64)return;demoClock=0;
    const a=proof.witness[actions.length];if(a!==undefined)step(a,true);},
   draw(c,w=480,h=480){const room=api.demo?h:Math.max(100,h-35);c.fillStyle='#b98d96';c.fillRect(0,0,w,h);
    const scene={time:clock,age,reduced:api.reducedMotion,moves:actions.length,event,preview,catFace,herFace,sleep:sleeping,pet};
    if(journal&&!reel)drawJournal(c,w,room,book,posesFor(book)[poseIndex],poseIndex,scene);
    else drawBoard(c,b,s,prev,proof,scene,w,room);
   },
   pause(){paused=true;drag=null;},resume(){paused=false;},dispose(){closed=true;drag=null;},
  };
 },
};
