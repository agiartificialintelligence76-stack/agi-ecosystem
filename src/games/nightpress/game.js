import {ISSUES,DECALS,VOLUMES} from './issues.js';
import {PROOFS} from './proofs.js';
import {geometry,rotCells,evaluate} from './press.js';
import {begin,choose,nudge,turn,drop,depth,undo,pull,cover,reopen,studioIssue,swapMotif,createDesk,nextRush,deadline} from './editor.js';
import {readBinder,nextIssue,earned,fileArt,recoverArt,removeArt,renameArt} from './binder.js';
import {drawDesk,drawGallery,layout,rackSlots} from './desk-art.js';
import {LINE,reaction,proofLine} from './lines.js';
import {pressSound} from './sound.js';
import {gameStore} from '../kit/store.js';
const modes=[{id:'campaign',label:'Editorial run'},{id:'rush',label:'Rush deadline'},{id:'studio',label:'Free Studio'},{id:'daily',label:'Daily commission'},{id:'gallery',label:'Local print drawer'}];
const btn=(id,label,key='',disabled=false,pressed=null)=>({id,label,key,disabled,pressed});
export default {
 title:'STICKER CLUB',tagline:'Peel it, print it, put your name on the cover.',
 instructions:[['Make the cover','Choose a sticker and tap or drag it onto the paper. The A and 1 form the masthead. Keep them readable.'],
 ['Work in layers','Turn a lifted sticker before placing it. Open Tools for layer order and Undo. A clear decal leaves the ink beneath it visible.'],
 ['Pull a proof','Print checks her brief. Fix any red marks, or file the issue and open the next. Free Studio saves editable covers to your local print drawer.']],
 keys:[['1 / 2 / 3','Select sticker'],['Arrows','Preview position'],['Q / E','Turn preview'],['Enter','Stick down'],['[ / ]','Lower / raise'],['U','Undo'],['Space','Proof / next / file']],
 touch:[['Rack or sticker buttons','Lift a sticker'],['Tap / drag cover','Place / reposition'],['Turn / Tools','Rotate preview, layer or undo'],['Print','Inspect the proof']],
 modes,options:[{id:'issue',label:'Editorial issue',values:[{id:'next',label:'Continue my edition'},...ISSUES.map(q=>({id:String(q.id),label:(q.id+1)+'. '+q.title}))]}],
 controls:[btn('print','Print','Space')],
 progress(raw){const b=readBinder(raw);return b.stars.filter(Boolean).length+'/36 issues  ·  '+earned(b).length+' stickers  ·  '+b.gallery.length+' local prints';},
 scoreGroup:({mode,options,seed,openingProgress})=>mode==='daily'?'daily/'+seed:mode==='campaign'?'issue/'+begin(mode,readBinder(openingProgress ?? gameStore('nightpress').read()),seed,options?.issue).desk.issue.id:mode,
 create(api){
  let mode=modes.some(q=>q.id===api.mode)?api.mode:'campaign';const seed=api.seed??7;
  let binder=readBinder(api.store?.read?.());
  const opening=api.openingProgress ? readBinder(api.openingProgress) : binder;
  let s=begin(mode,opening,seed,api.options?.issue),d=s.desk;
  let gallery=mode==='gallery',gi=0,giDesk=null,editing=null,tools=false,paused=false,closed=false,drag=null,armed=true,preview=false,auto=false,autoStep=-1,remove=false;
  let pTitle='',pHUD='',cue='',cueAt=-9;const mix=pressSound(api.audio,api.demo),day=new Date().toISOString().slice(0,10);
  if(api.demo){s.desk=d=createDesk(ISSUES[18]);gallery=false;}
  const art=()=>binder.gallery[gi];
  const say=(k,force=false)=>{if(!LINE[k]||(!force&&(k===cue||s.time-cueAt<.70)))return;cue=k;cueAt=s.time;api.say?.(LINE[k]);};
  const noise=(k,p=1)=>mix.play(k,s.time,p);
  function save(fn){if(api.demo)return;const transform=raw=>{binder=readBinder(raw);fn(binder);return {...raw,pressBinder:binder};};
   if(api.store?.update)api.store.update(transform);else transform({pressBinder:binder});}
  function galleryAt(delta=0){const n=binder.gallery.length;gi=n?(gi+delta+n)%n:0;giDesk=art()?reopen(art()):null;remove=false;}
  galleryAt();
  function setControls(){
   let a=[];
   if(gallery){const n=binder.gallery.length;a=[btn('prev','Previous','←',n<2),btn('next-art','Next','→',n<2),btn('edit','Edit print','Enter',!n),btn('name','Rename','N',!n),
    btn('remove',remove?'Confirm delete':'Delete print','D',!n),btn('restore','Undo change','U',!binder.change),btn('new','New cover','C')];}
   else if(d.phase==='proof')a=[btn('revise','Back to cover','Enter'),...(d.history.length?[btn('undo','Undo last','U')]:[])];
   else if(d.phase==='fold'){
    a=[...(mode==='campaign'&&d.issue.id<35?[btn('next','Next issue','Enter')]:[]),...(mode==='rush'?[btn('next','Next commission','Enter')]:[]),
     ...(mode==='studio'||editing?[btn('drawer','Open print drawer','G')]:[]),btn('file',mode==='rush'?'End shift':'File edition','Space')];
   }else if(tools){
    const i=d.layers.findIndex(p=>p.id===d.selected);a=[btn('back','Back','T'),btn('raise','Raise layer',']',i<0||i===d.layers.length-1),btn('lower','Lower layer','[',i<=0),
     btn('undo','Undo peel','U',!d.history.length),...(mode==='studio'||editing?[btn('motif','Change motif','M',earned(binder).every(id=>d.issue.pieces.includes(id))),btn('paper','Change paper','V'),btn('name','Name cover','N'),btn('drawer','Print drawer','G')]:[])];
   }else{
    a=[...d.issue.pieces.map((id,i)=>btn('pick-'+id,DECALS[id].name,String(i+1),false,id===d.selected)),btn('rotate','Turn','E'),btn('place','Stick down','Enter'),
     btn('tools','Tools','T'),btn('print',mode==='studio'||editing?'Save print':'Print','Space')];
   }
   const sig=a.map(q=>[q.id,q.label,q.disabled,q.pressed].join('')).join('|');if(sig!==pTitle){pTitle=sig;api.controls?.(a);}
   const h=gallery?['Prints',binder.gallery.length,'Stock',giDesk?VOLUMES[giDesk.stock][0]:'Drawer']:mode==='rush'?['Time',Math.max(0,Math.ceil(s.left))+'s','Printed',s.index+(d.phase==='fold'?1:0)]:
    ['Issue',mode==='studio'||editing?'Studio':d.issue.id+1,'Peels',d.moves+' / '+d.issue.pieces.length];
   if(pHUD!==h.join('/')){pHUD=h.join('/');api.hud?.(...h);}
  }
  function select(id){if(choose(d,id)){preview=true;armed=true;noise('lift');say(id==='agi'?'face':DECALS[id].foil?'foil':'lift');}}
  function stamp(){const old=d.checks;if(!drop(d)){noise('blocked');return;}const fresh=d.checks.checks.filter(q=>q.ok&&!old.pass[q.id]).length;
   noise('peel',DECALS[d.selected].film?1.24:1);if(fresh){noise('rule',1+Math.min(5,d.checks.checks.filter(q=>q.ok).length)*.12);api.haptic?.(8);if(!d.checks.failed.length)api.effect?.('clear','Print ready');}
   if(DECALS[d.selected].foil)noise('foil');say(reaction(d,old,d.selected),!d.checks.failed.length);preview=false;armed=false;}
  function layer(k){const prev=d.checks;if(depth(d,k)){noise('slip');say(d.checks.failed.length?k>0?'raise':'lower':'green',true);if(prev.failed.length>d.checks.failed.length)noise('rule',1.26);}}
  function turnIt(k=1){turn(d,k);preview=true;armed=true;noise('rotate');say('turn');}
  function back(){d.phase='desk';tools=false;}
  function rate() {
   const studio=mode==='studio'||!!editing;const r=pull(d,studio);noise('roller');tools=false;preview=false;
   if(!r){api.effect?.('fault');noise('blocked');api.haptic?.(12);say(proofLine(d),true);return;}
   d.rating=r.stars;d.published=true;api.effect?.('perfect');s.total+=r.score;s.last=r;noise('staple');noise('fold');api.haptic?.(21);
   if(studio){save(b=>{editing=fileArt(b,cover(d,d.issue.title,LINE.save),editing);});say('save',true);}
   else if(mode==='campaign'){const unlocked=earned(binder).length;save(b=>{if(d.issue.id<=nextIssue(b))b.stars[d.issue.id]=Math.max(b.stars[d.issue.id],r.stars);});
    say(d.issue.slot===5?'volume':earned(binder).length>unlocked?'unlock':r.stars===3?'par':'perfect',true);}
   else if(mode==='daily'){const best=binder.daily?.day===day?binder.daily.score:0;save(b=>{if(b.daily?.day!==day||r.score>b.daily.score)b.daily={day,score:r.score};});say(r.score>best?'daily':'perfect',true);}
   else{say('recover',true);s.left=deadline(seed,s.index+1);}
  }
  function finish(){if(closed)return;closed=true;
   if(mode==='rush')save(b=>{b.rush=Math.max(b.rush,s.total);});
   const count=mode==='rush'?s.index+(d.phase==='fold'?1:0):s.index+(d.published?1:0);
   api.end?.(s.total,[['Printed',count],['Last issue',d.issue.title],['Grade',s.last?'★'.repeat(s.last.stars):'—'],['Peels',d.moves]],mode==='rush'&&s.left<=0?LINE.late:LINE.save);}
  function advance(){
   if(mode==='rush'){nextRush(s);d=s.desk;}
   else if(mode==='campaign'&&d.issue.id<35){s.index++;s.desk=d=createDesk(ISSUES[d.issue.id+1]);}
   else return;
   tools=false;preview=false;armed=true;drag=null;api.say?.(d.issue.note);
  }
  function nameIt(){const name=typeof window==='undefined'?null:window.prompt('Name this local cover',gallery?art()?.title:d.issue.title);
   if(!name?.trim())return;const clean=name.trim().slice(0,32);
   if(gallery&&art()){const key=art().key;save(b=>renameArt(b,key,clean));galleryAt();}
   else d.issue={...d.issue,title:clean};}
  function action(id,phase){if(phase!=='down'||closed||paused)return;
   if(gallery){
    if(id==='prev'||id==='next-art'){galleryAt(id==='prev'?-1:1);noise('slip');say('visit');}
    if(id==='edit'&&art()){mode='studio';editing=art().key;s.desk=d=reopen(art());gallery=false;tools=false;armed=true;say('visit',true);}
    if(id==='new'){mode='studio';editing=null;s.mode='studio';s.desk=d=createDesk(studioIssue(binder));gallery=false;tools=false;armed=true;}
    if(id==='restore'){save(b=>recoverArt(b));galleryAt();noise('undo');}
    if(id==='name')nameIt();if(id==='remove'&&art()){if(remove){const key=art().key;save(b=>removeArt(b,key));galleryAt();noise('snip');}else remove=true;}
   }else if(d.phase==='fold'){
    if(id==='file')finish();if(id==='next')advance();if(id==='drawer'){gallery=true;galleryAt();say('visit',true);}
   }else if(d.phase==='proof'&&id==='revise'){back();noise('lift');}
   else if(d.phase==='desk'||d.phase==='proof'){
    if(id.startsWith('pick-'))select(id.slice(5));if(id==='rotate')turnIt();if(id==='place')stamp();if(id==='print')rate();
    if(id==='tools'||id==='back')tools=!tools;if(id==='raise')layer(1);if(id==='lower')layer(-1);
    if(id==='undo'&&undo(d)){noise('undo');say('undo',true);preview=false;armed=false;}
    if(id==='motif'&&swapMotif(d,binder)){noise('stock');preview=true;}if(id==='paper'){d.stock=(d.stock+1)%6;noise('stock');}
    if(id==='drawer'){gallery=true;galleryAt();say('visit',true);}if(id==='name')nameIt();
   }setControls();
  }
  function key(phase,k){if(phase!=='down'||closed||paused)return;
   if(gallery){const key={ArrowLeft:'prev',ArrowRight:'next-art',Enter:'edit',KeyN:'name',KeyD:'remove',KeyU:'restore',KeyC:'new'}[k];if(key)action(key,'down');return;}
   if(d.phase==='fold'){if(k==='Space')action('file','down');if(k==='Enter')action('next','down');if(k==='KeyG')action('drawer','down');return;}
   if(d.phase==='proof'){if(k==='Enter'||k==='Space')action('revise','down');if(k==='KeyU')action('undo','down');return;}
   if(/^Digit[1234]$/.test(k)){const p=d.issue.pieces[Number(k.slice(-1))-1];if(p)select(p);}
   const xy={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[k];if(xy){nudge(d,...xy);armed=true;preview=true;noise('tap');}
   if(k==='KeyQ'||k==='KeyE')turnIt(k==='KeyQ'?-1:1);
   const id={Space:'print',Enter:'place',BracketLeft:'lower',BracketRight:'raise',KeyU:'undo',KeyT:'tools',KeyM:'motif',KeyV:'paper',KeyN:'name',KeyG:'drawer'}[k];
   if(id&&(!['motif','paper','name','drawer'].includes(id)||mode==='studio'||editing))action(id,'down');setControls();
  }
  function pointer(type,x,y,w,h){
   if(paused||closed||gallery||d.phase!=='desk')return;if(type==='cancel'){drag=null;preview=false;return;}
   const l=layout(w,api.demo?h:Math.max(90,h-37));const px=Math.floor((x-l.gx)/l.cell),py=Math.floor((y-l.gy)/l.cell),inside=px>=0&&py>=0&&px<5&&py<5;
   if(type==='down'){const slot=rackSlots(l,d).find(p=>x>=p.x&&y>=p.y&&x<p.x+p.w&&y<p.y+p.h);
    if(slot){select(slot.id);drag={rack:true,moved:false,x,y,dx:0,dy:0};setControls();return;}if(!inside)return;
    let dx=0,dy=0;if(!armed){const bit=1<<(py*d.issue.w+px),p=[...d.layers].reverse().find(p=>geometry(d.issue,p).mask&bit);
     if(p){select(p.id);dx=px-p.x;dy=py-p.y;}}
    drag={x,y,moved:false,dx,dy};d.cursor.x=px-dx;d.cursor.y=py-dy;preview=true;noise('lift');}
   else if(drag&&type==='move'){if(Math.hypot(x-drag.x,y-drag.y)>4)drag.moved=true;
    d.cursor.x=Math.min(5,Math.max(-1,px-drag.dx));d.cursor.y=Math.min(5,Math.max(-1,py-drag.dy));preview=true;}
   else if(drag&&type==='up'){if((inside||d.issue.rules.includes('clip')&&px>=-1&&px<=5&&py>=-1&&py<=5)&&(!drag.rack||drag.moved)){
     d.cursor.x=px-drag.dx;d.cursor.y=py-drag.dy;stamp();}drag=null;setControls();}
  }
  function demo(){
   if(!api.demo&&!auto)return;auto=true;
   const p=PROOFS[18].witnesses[0],hero=p.find(q=>q.id==='agi'),frame=p.find(q=>q.id==='frame'),t=s.time;
   if(autoStep<0){choose(d,'frame');Object.assign(d.cursor,frame);drop(d);choose(d,'agi');Object.assign(d.cursor,hero);d.cursor.x=Math.max(0,hero.x-1);drop(d);autoStep=0;}
   if(t>2&&autoStep===0){choose(d,'agi');Object.assign(d.cursor,hero);preview=true;autoStep=1;}
   if(t>2&&t<=3.8&&autoStep===1){d.cursor.x=hero.x-.87*(1-(t-2)/1.8);d.cursor.y=hero.y+.52*(1-(t-2)/1.8);}
   if(t>3.8&&autoStep===1){Object.assign(d.cursor,hero);drop(d);preview=false;autoStep=2;}
   if(t>5.05&&autoStep===2){depth(d,-1);autoStep=3;}
   if(t>7.7&&autoStep===3){const r=pull(d);if(r)d.rating=r.stars;autoStep=4;}
   if(t>12.8&&!closed)finish();
  }
  say(gallery?'visit':mode==='rush'?'rush':'first',true);setControls();
  return {action,key,pointer,demo(){auto=true;demo();},
   update(dt){if(paused||closed)return;s.time+=dt;d.elapsed+=dt;d.flash=Math.max(0,d.flash-dt);mix.update(s.time,d.stock);
    if(!api.demo&&mode==='rush'&&d.phase!=='fold'&&!gallery){const old=s.left;s.left=Math.max(0,s.left-dt);
     if(old>10&&s.left<=10){noise('alarm');say('ten',true);}if(!s.left){say('late',true);finish();}}
    setControls();},
   draw(c,w=480,h=480){const hh=api.demo?h:Math.max(90,h-37);c.fillStyle='#9cb0a1';c.fillRect(0,0,w,h);
    if(gallery)drawGallery(c,giDesk,art(),gi,binder.gallery.length,w,hh,s.time);else drawDesk(c,d,w,hh,s.time,{drag:!!drag,preview,reduced:api.reducedMotion});},
   pause(){paused=true;drag=null;mix.pause();},resume(){paused=false;mix.resume();},cancelInput(){drag=null;},dispose(){closed=true;drag=null;mix.dispose();},
  };
 },
};
