import {configFor,openRoll,adjust,expose,keep,another,candid,tick,turnSpread,resultOf,printOf} from './run.js';
import {sceneAt,gradeShot,schedule,anchor} from './scene.js';
import {PLACES,BY_ID,LENSES} from './assignments.js';
import {bounds,clamp,pointAt,optics} from './camera.js';
import {makePhotographer} from './photographers.js';
import {readAlbum,archive,flipPin,selectedRoll,frameStyles,turnFrame} from './album.js';
import {drawFinder,drawReview,drawSpread,drawAlbum,finderLayout} from './render.js';
import {soundFor} from './sound.js';
import {LINES} from './lines.js';
import {gameStore} from '../kit/store.js';

const modes=[{id:'campaign',label:'Commission rolls'},{id:'daily',label:'Daily Photo Walk'},{id:'darkroom',label:'Darkroom practice'},{id:'album',label:'My print album'}];
const options=[{id:'roll',label:'Location',values:[{id:'next',label:'Continue my walk'},...PLACES.map((p,i)=>({id:String(i),label:p.name}))]},
 {id:'exercise',label:'Practice appointment',values:[0,1,2,3].map(n=>({id:String(n),label:'Appointment '+(n+1)}))}];
const btn=(id,label,key,disabled=false)=>({id,label,key,disabled});
const intro=[btn('shoot','Shutter','Space')];
export default {
 title:'CANDID CAMERA',tagline:'One camera, a moving subject, and two chances to get the shot.',
 instructions:[['Read the assignment','Watch her gesture and the distance to her eyes. Press the shutter at the peak. Each commission gives you two exposures.'],
 ['Work the optics','Drag to aim. Switch to Sidestep to move past foreground posts. Lens changes framing. Turn focus until the split marks meet.'],
 ['Edit the roll','Keep the negative you like, pair a wide print with a detail, then file the spread. Pins protect favorites in your album.']],
 keys:[['Arrows','Truck sideways / tilt'],['A / D','Pan left / right'],['Shift','Fine adjustment'],['1 / 2 / 3','28 / 50 / 85 mm'],['Q / E','Pull focus near / far'],['Space','Shutter / choose / file']],
 touch:[['Drag or tap the viewfinder','Aim the lens; switch to Sidestep to move the camera'],['Focus slider / lens','Set optical distance and framing'],['Shutter / keep','Develop and choose a negative']],
 modes,options,controls:intro,
 progress(raw){const b=readAlbum(raw);return b.stars.filter(Boolean).length+'/8 rolls  ·  '+b.rows.flat().length+' album prints  ·  Next: '+PLACES[b.unlocked].name;},
 scoreGroup:({mode,options,seed,openingProgress})=>mode==='daily'?'daily/'+seed:mode+'/'+selectedRoll(readAlbum(openingProgress??gameStore('mothlight').read()),options?.roll,openingProgress==null?seed:null,mode==='darkroom'),
 create(api){
  let book=readAlbum(api.store?.read?.());const seed=api.seed??7,mode=modes.some(m=>m.id===api.mode)?api.mode:'campaign';
  const opening=api.openingProgress==null?book:readAlbum(api.openingProgress);
  const practice=mode==='darkroom',roll=selectedRoll(opening,api.options?.roll,api.openingProgress==null?seed:null,practice),config=configFor(mode,roll,seed);
  if(practice)config.plans[0]=schedule(roll*4+Math.max(0,Math.min(3,Number(api.options?.exercise)||0)),config.plans[0].seed);
  if(api.demo){config.mode='campaign';config.roll=0;config.plans=[schedule(2,9),schedule(1,9083),schedule(3,529930)];}
  const s=openRoll(config),snd=soundFor(api.audio,api.demo),bot=makePhotographer('demo',seed),held=new Set();
  const day=new Date().toISOString().slice(0,10);
  let album=mode==='album'&&!api.demo,albumIdx=0,albumPrint=null,albumEntry=null,paused=false,closed=false,drag=null,truckMode=false;
  let prevControls='',prevHUD='',cueAt=-8,lastCue='',wasOccluded=false,wasPeak=false,lastKeep=0,auto=false,showedMiss=0;
  function speak(k,force=false){
   if(!LINES[k]||(!force&&(k===lastCue||s.time-cueAt<1.65)))return;
   cueAt=s.time;lastCue=k;api.say?.(LINES[k]);
  }
  function updateAlbum(delta=0){
   const entries=book.rows.flat();albumIdx=entries.length?(albumIdx+delta+entries.length)%entries.length:0;
   albumEntry=entries[albumIdx];albumPrint=albumEntry?printOf(albumEntry.recipe):null;
  }
  updateAlbum();
  function controls(force=false){
   let items;
   if(album)items=[btn('album-prev','Previous','←',book.rows.flat().length<2),btn('album-next','Next print','→',book.rows.flat().length<2),btn('pin',albumEntry?.pinned?'Unpin print':'Pin print','Enter',!albumEntry),...(albumEntry&&frameStyles(book).length>1?[btn('frame','Frame · '+albumEntry.frame,'V')]:[])];
   else if(s.phase==='review')items=[...s.takes.map((p,i)=>btn('keep-'+i,'Keep '+(i+1)+' · '+p.grade.score,'Enter')),
    ...(s.takes.length===1&&(practice||s.age<s.plan.budget-.25)?[btn('spare','Try second exposure','R')]:[])];
   else if(s.phase==='spread')items=[...(s.kept.filter(Boolean).length>1?[btn('context','Change context','←'),btn('detail','Change detail','→')]:[]),
    ...(config.mode==='campaign'&&!s.bonus?[btn('candid','Optional candid','C')]:[]),btn('file','File spread','Space')];
   else items=[btn('shoot','Shutter','Space'),btn('lens',LENSES[s.cam.lens]+' mm','L'),btn('tool',truckMode?'Sidestep ↔':'Aim lens','T'),
    {id:'focus',label:'Focus '+s.cam.focus.toFixed(1)+' m',type:'range',min:1.7,max:8,step:.05,value:Math.round(s.cam.focus*20)/20}];
   const key=items.map(q=>q.id+q.label+q.disabled+q.value).join('/');
   if(force||key!==prevControls){prevControls=key;api.controls?.(items);}
   const vals=album?['Prints',book.rows.flat().length,'Pinned',book.rows.flat().filter(p=>p.pinned).length]:
    ['Roll',s.index+1+' / '+s.plans.length,'Prints',s.kept.filter(Boolean).length];
   if(force||prevHUD!==vals.join('/')){prevHUD=vals.join('/');api.hud?.(...vals);}
  }
  function finish(){
   if(closed)return;closed=true;const r=resultOf(s),before=book.rows.flat().length;
   if(!api.demo)api.store?.update?.(raw=>{book=archive(raw,config,r,day);return {...raw,photoBook:book};});
   const note=mode==='daily'?LINES.daily:r.paired?LINES.pair:book.rows.flat().length>before?LINES.best:LINES.end;
   api.end?.(r.score,[['Contact sheet',r.prints.length+' / '+r.count],['Keepers',r.keepers],['Average',r.avg+' / 100'],['Grade','★'.repeat(r.grade)+'☆'.repeat(3-r.grade)]],note);
  }
  function cut(type,value){
   if(!adjust(s,type,value))return;
   const sc=sceneAt(s.plan,s.age),grade=gradeShot(sc,s.cam);
   if(type==='focus'){snd.play(grade.sharp>.92?'lock':'focus',s.time);speak(grade.sharp>.92?'focus':s.cam.focus>grade.focusDepth?'behind':'ahead');}
   else if(type==='lens'){snd.play('lens',s.time);speak(value===0?'wide':'long');}else snd.play('pan',s.time);
   controls();
  }
  function shoot(){
   const p=expose(s);if(!p)return;held.clear();drag=null;snd.play('shutter',s.time);snd.play('paper',s.time);snd.play('bath',s.time);
   api.haptic?.(13);speak(p.note,true);controls();
  }
  function choose(i){
   const p=s.takes[i];if(!p||!keep(s,i))return;snd.play('wind',s.time);if(p.keeper){api.effect?.('clear');lastKeep++;snd.play('keeper',s.time,1+.07*Math.min(lastKeep,4));}else lastKeep=0;
   speak(lastKeep===3?'streak':s.phase==='spread'?'pair':p.keeper?'keeper':'edit',true);controls();
  }
  function action(id,phase,value){
   if(closed||paused)return;
   if(phase==='input'&&id==='focus'){cut('focus',Number(value));return;}if(phase!=='down')return;
   if(album){
    if(id==='pin'&&albumEntry&&!api.demo){const k=albumEntry.recipe.key;api.store?.update?.(raw=>{book=flipPin(raw,k);return {...raw,photoBook:book};});updateAlbum();snd.play('pin',s.time);speak(albumEntry?.pinned?'pin':'unpin',true);}
    if(id==='frame'&&albumEntry&&!api.demo){const key=albumEntry.recipe.key;api.store?.update?.(raw=>{book=turnFrame(raw,key);return {...raw,photoBook:book};});updateAlbum();snd.play('select',s.time);}
    if(id==='album-next'||id==='album-prev'){updateAlbum(id==='album-next'?1:-1);snd.play('select',s.time);speak('album');}
   }else if(s.phase==='live'){
    if(id==='shoot')shoot();if(id==='lens')cut('lens',(s.cam.lens+1)%3);if(id==='tool'){truckMode=!truckMode;api.say?.(truckMode?'drag sideways to move behind the foreground.':'tap to aim, or drag the lens.');snd.play('select',s.time);}
   }else if(s.phase==='review'){
    if(id.startsWith('keep-'))choose(Number(id.slice(5)));if(id==='spare'&&another(s)){snd.play('wind',s.time);speak('spare',true);}
   }else if(s.phase==='spread'){if(id==='file'){snd.play('roll',s.time);finish();}else if(id==='candid'){if(candid(s))speak('approach',true);}
    else if(id==='context'||id==='detail'){turnSpread(s,id);snd.play('select',s.time);speak('edit');}}
   controls();
  }
  function key(phase,k){
   if(phase==='up'){held.delete(k);return;}if(paused||closed)return;
   if(album){const map={ArrowLeft:'album-prev',ArrowRight:'album-next',Enter:'pin',Space:'pin',KeyV:'frame'};if(map[k])action(map[k],'down');return;}
   if(s.phase==='review'){if(['Enter','Space','Digit1','Digit2'].includes(k))choose(k==='Digit2'?1:k==='Digit1'?0:s.selected);if(k==='KeyR')action('spare','down');return;}
   if(s.phase==='spread'){const map={Space:'file',Enter:'file',KeyC:'candid',ArrowLeft:'context',ArrowRight:'detail'};if(map[k])action(map[k],'down');return;}
   if(k==='Space'||k==='Enter'){shoot();return;}if(k==='KeyT'){action('tool','down');return;}if(k==='KeyL'){action('lens','down');return;}
   if(/^Digit[123]$/.test(k)){cut('lens',Number(k.slice(-1))-1);return;}
   if(k==='KeyQ'||k==='KeyE'){const d=k==='KeyQ'?-1:1;cut('focus',s.cam.focus+d*(held.has('ShiftLeft')?.05:.24));return;}
   if(!held.has(k)){if(k==='ArrowLeft'||k==='ArrowRight')cut('truck',s.cam.truck+(k==='ArrowRight'?.09:-.09));}
   held.add(k);
  }
  function cancel(){held.clear();drag=null;}
  controls(true);if(!api.demo){if(album)speak('album',true);else{api.say?.(practice?'Darkroom · take a print and inspect its four scores.':BY_ID[s.plan.id].note);snd.play('select',0);}}
  return {action,key,cancelInput:cancel,
   pointer(type,x,y,w,h){
    if(closed||paused||album||s.phase!=='live')return;
    if(type==='cancel'){drag=null;return;}const g=finderLayout(w,api.demo?h:Math.max(100,h-35));
    const inside=x>=g.x&&x<=g.x+g.w&&y>=g.y&&y<=g.y+g.h;
    if(type==='down'&&inside){drag={x,y,ox:x,oy:y,moved:false};snd.play('pan',s.time);return;}
    if(!drag)return;
    if(type==='move'){const dx=(x-drag.x)/g.w,dy=(y-drag.y)/g.h;drag.moved||=Math.hypot(x-drag.ox,y-drag.oy)>4;
     if(truckMode){adjust(s,'truck',s.cam.truck-dx*3.2);adjust(s,'tilt',s.cam.tilt+dy*.33);}
     else{adjust(s,'pan',s.cam.pan-dx/optics[s.cam.lens]);adjust(s,'tilt',s.cam.tilt+dy/(1.5*optics[s.cam.lens]));}drag.x=x;drag.y=y;}
    if(type==='up'){if(!drag.moved&&inside){const u=(x-g.x)/g.w,v=(y-g.y)/g.h;
     if(truckMode)cut('truck',s.cam.truck+(u-.5)*1.7);
     else{const target=anchor(sceneAt(s.plan,s.age));adjust(s,'pan',s.cam.pan+Math.atan((u-target.u)/optics[s.cam.lens]));adjust(s,'tilt',s.cam.tilt-Math.atan((v-target.v)/(1.5*optics[s.cam.lens])));}}
     drag=null;}
   },
   demo(){auto=true;},
   update(dt){
    if(closed||paused)return;if(album){s.time+=dt;return;}
    if(auto){bot(s,dt);if(s.ended){finish();return;}}
    if(s.phase==='live'){
     const speed=held.has('ShiftLeft')||held.has('ShiftRight')?.32:1;
     const axis=(a,b)=>Number(held.has(a))-Number(held.has(b));
     adjust(s,'truck',s.cam.truck+axis('ArrowRight','ArrowLeft')*dt*1.3*speed);
     adjust(s,'pan',s.cam.pan+axis('KeyD','KeyA')*dt*.42*speed);
     adjust(s,'tilt',s.cam.tilt+axis('ArrowUp','ArrowDown')*dt*.30*speed);
    }
    tick(s,dt);snd.update(s.time,BY_ID[s.plan.id].place);
    if(s.phase==='live'){
     const sc=sceneAt(s.plan,s.age),g=gradeShot(sc,s.cam),covered=g.cover>.22,peak=sc.gesture>.80;
     if(s.index===0&&s.age>1&&s.age<1.10)speak('first');
     if(s.age>2.1&&s.age<2.25&&sc.a.place===4)speak('rain');
     if(sc.falseWave>.84)speak('false');
     if(sc.a.ask==='pair'&&sc.catVisible&&s.age>3.2&&s.age<3.32)speak('approach');
     if(g.eye.v<.12)speak('headroom');
     if(covered&&!wasOccluded){snd.play('cat',s.time);speak(sc.catVisible?'understudy':'post');}
     if(!covered&&wasOccluded)speak('clear');if(peak&&!wasPeak)speak(sc.a.pose==='twirl'?'twirlPeak':'peak');
     wasOccluded=covered;wasPeak=peak;
    }
    if(s.missed>showedMiss){showedMiss=s.missed;speak('miss',true);}controls();
   },
   draw(c,w=480,h=480){const room=api.demo?h:Math.max(100,h-35);c.fillStyle='#a78080';c.fillRect(0,0,w,h);
    if(album)drawAlbum(c,albumPrint,albumEntry,albumIdx,book.rows.flat().length,w,room);
    else if(s.phase==='review')drawReview(c,s,w,room,api.reducedMotion);else if(s.phase==='spread')drawSpread(c,s,w,room);else drawFinder(c,s,w,room,api.reducedMotion);
   },
   pause(){paused=true;cancel();snd.pause();},resume(){paused=false;snd.resume();},dispose(){closed=true;cancel();snd.dispose();},
  };
 },
};
