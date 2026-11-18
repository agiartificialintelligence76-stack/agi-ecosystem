import { SIDES, laneNames, pressRecord, judge, restoreTape } from './record.js';
import { painting, oval, type, line, panel, polygon, clip, TAU } from '../kit/illustration.js';
const sleeve=painting(new URL('./disco.webp',import.meta.url));
const sprite=painting(new URL('./skater.webp',import.meta.url));
const palette=['#ffe377','#ff87bf','#77ecdf'];
const spin=1.73;
const rad=lane=>92+lane*48;
const point=(lane,angle)=>[238+Math.cos(angle)*rad(lane),225+Math.sin(angle)*rad(lane)*.57];
export default{
 title:'NEEDLE DROP',tagline:'Skate AGI-1 around a spinning record. Switch grooves for the stars, jump the scratches, and pull the vinyl back for a second chance.',
 instructions:[['Read the pressing','AGI-1 skates at the white timing line. Move inward or outward so an approaching star meets her on the same groove. The large cue at the top names the next groove.'],
 ['Hop the scratches','A coral scratch crosses all three grooves. Jump just before it reaches her. Missing stars breaks the combo. Three collisions lift the needle.'],
 ['Use the backspin','Twice per show you can rewind two beats to undo a mistake. Four sides get quicker. Keep a perfect streak to build the groove multiplier.']],
 keys:[['↑ / ↓','Inside / outside groove'],['Space','Jump'],['R','Backspin two beats']],
 touch:[['In / Out','Change groove'],['Jump / ↶','Hop or rewind']],
 create(api){
   const beats=pressRecord(api.rng),marks=[];let i=0,lane=1,target=1,time=0,jump=0,rewindFx=0,t=0,done=false,last='get me on the yellow star.',flash=0;
   let state={score:0,streak:0,best:0,hits:0,faults:0,rewinds:2};const keysAt=[0,1,2];
   const hud=()=>api.hud('Side',Math.min(4,1+(beats[i]?.side??3))+'/4','Groove',state.score);
   function shift(d){target=clip(target+d,0,2);api.sound('tap',{pitch:.88+target*.14});}
   function leap(){if(!jump){jump=.61;api.sound('whoosh');}}
   function backspin(){const restored=restoreTape(state,marks,i);if(!restored)return;
     const {at,...values}=restored;state=values;i=at;time=Math.max(0,beats[at].time-1.12);jump=0;rewindFx=.55;
     marks.length=at;flash=.7;last='take it back, dj.';api.sound('back');hud();}
   function finish(){done=true;api.end(state.score,[['Stars caught',state.hits],['Longest groove',state.best],['Sides played',Math.min(4,(beats[Math.min(i,beats.length-1)].side+1))]],i===beats.length?'that was our encore. somebody keep the record spinning.':'okay, we scratched the vinyl. it has character now.');}
   function cross(){
     const beat=beats[i];marks[i]={...state};const result=judge(beat,lane,jump>.045&&jump<.59);
     if(result==='groove'||result==='clear'){state.streak++;state.best=Math.max(state.best,state.streak);state.score+=(result==='clear'?40:30)*Math.min(4,1+Math.floor(state.streak/6));state.hits+=Number(result==='groove');
       api.tone?.({freq:[330,392,494][beat.lane]*(1+beat.side*.06),type:'triangle',dur:.13,vol:.19});api.sound(result==='clear'?'bounce':'coin',{pitch:.92+beat.lane*.13});last=result==='clear'?'clean jump!':'right in the groove.';}
     else{state.streak=0;state.faults+=Number(result==='scratch');api.sound(result==='scratch'?'hurt':'tick');last=result==='scratch'?'ow. jump the coral scratch.':'missed it. rewind if you want it back.';}
     i++;flash=.5;hud();if(i===beats.length||state.faults>=3)finish();
   }
   hud();return{
     update(dt){if(done)return;t+=dt;time+=dt;flash=Math.max(0,flash-dt);jump=Math.max(0,jump-dt);rewindFx=Math.max(0,rewindFx-dt);lane+=(target-lane)*(1-Math.exp(-17*dt));
       if(i<beats.length&&time>=beats[i].time)cross();},
     key(k,code){if(k!=='down'||done)return;if(code==='ArrowUp'||code==='KeyW')shift(-1);if(code==='ArrowDown'||code==='KeyS')shift(1);if(code==='Space')leap();if(code==='KeyR')backspin();},
     pointer(k,x,y){if(k!=='down'||done)return;if(y>=401){if(x<102)shift(-1);else if(x<202)shift(1);else if(x<358)leap();else backspin();}
       else if(y>=210&&y<390){let l=0;for(const n of keysAt){if(Math.abs(point(n,Math.PI/2)[1]-y)<Math.abs(point(l,Math.PI/2)[1]-y))l=n;}target=l;}},
     demo(){if(done||!beats[i])return;const b=beats[i];if(!b.seam)target=b.lane;else if(b.time-time<.22&&b.time>time&&!jump)leap();},
     draw(c){
       c.fillStyle='#311c37';c.fillRect(0,0,480,480);sleeve(c,0,-30,480,480);
       c.fillStyle='#29162966';c.fillRect(0,82,480,315);
       const side=beats[Math.min(i,beats.length-1)].side;
       panel(c,11,12,458,54,'#27172de8',5);type(c,'SIDE '+String.fromCharCode(65+side)+'   /   '+SIDES[side].toUpperCase(),23,27,13,'#f8c694','left','monospace');
       const b=beats[i];type(c,b?(b.seam?'JUMP THE SCRATCH':laneNames[b.lane].toUpperCase()+' GROOVE'):'ENCORE',23,48,20,b&&!b.seam?palette[b.lane]:'#ff977e','left');
       type(c,'×'+Math.min(4,1+Math.floor(state.streak/6)),446,41,26,'#fff2c9','right','Georgia');
       oval(c,238,235,222,128,'#221322','#ffb7a1',3);oval(c,238,225,222,128,'#282134','#72446f',4);
       for(let rr=68;rr<214;rr+=5)oval(c,238,225,rr,rr*.57,null,rr%2?'#4b354c':'#382e43',1);
       for(const n of keysAt){const r=rad(n);oval(c,238,225,r,r*.57,null,palette[n]+'a6',2);}
       c.save();c.translate(238,225);c.scale(1,.57);c.rotate((time+(rewindFx?rewindFx*4:0))*.8);
       c.beginPath();c.arc(0,0,50,0,TAU);c.clip();sleeve(c,-50,-50,100,100);c.restore();
       oval(c,238,225,5,3,'#fff7d4');
       for(let k=Math.min(i+3,beats.length-1);k>=i;k--){const ev=beats[k],ahead=ev.time-time;if(ahead>3.22)continue;
         const ang=Math.PI/2-ahead*spin;const [x,y]=point(ev.lane,ang);
         if(ev.seam){const a=point(-.22,ang),z=point(2.2,ang);line(c,[a,z],'#5d2437',9);line(c,[a,z],'#ff8a77',4);type(c,'!',...point(1,ang),17,'#fff8ce');}
         else{const star=[];for(let j=0;j<10;j++){const a=j*Math.PI/5-Math.PI/2;const r=j%2?4.7:11;star.push([x+Math.cos(a)*r,y+Math.sin(a)*r*.85]);}polygon(c,star,palette[ev.lane],'#fff6cc',1);}
       }
       line(c,[point(-.3,Math.PI/2),point(2.21,Math.PI/2)],'#fff4d3',2);
       const [px,py]=point(lane,Math.PI/2),up=jump?Math.sin(Math.PI*jump/.61)*52:0;
       oval(c,px,py,18,5,'#100e218a');const frame=Math.floor(t*6)%4;
       sprite(c,frame*112,0,112,136,px-25,py-64-up,50,64);for(let w=-1;w<=1;w++)oval(c,px+w*7,py-up+1,2.8,2.8,'#ffa4c6');
       panel(c,0,354,480,126,'#251629',0);type(c,'AGI-1   /   '+last,18,372,13,'#ffddce','left','Georgia');
       type(c,'NEEDLE  '+('♥'.repeat(3-state.faults)||'—'),18,391,11,'#f2a1be','left','monospace');type(c,'STREAK '+state.streak,461,391,11,'#b6eddb','right','monospace');
       const buttons=[[9,88,'IN ↑'],[103,90,'OUT ↓'],[201,146,'JUMP'],[355,117,'↶ '+state.rewinds]];
       buttons.forEach(([x,w,s],j)=>{panel(c,x,407,w,57,j===2?'#ffd88c':'#523348',4);type(c,s,x+w/2,435,18,j===2?'#432a40':'#ffe8cf','center','monospace');});
     },
   };
 }
};
