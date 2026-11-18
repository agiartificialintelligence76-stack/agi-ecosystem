import { DEPOTS, startDepot, roll, delivered, route } from './parcel.js';
import { painting, polygon, line, panel, type } from '../kit/illustration.js';

const print=painting(new URL('./package.webp',import.meta.url));
const arrow={ArrowUp:'N',ArrowRight:'E',ArrowDown:'S',ArrowLeft:'W',KeyW:'N',KeyD:'E',KeyS:'S',KeyA:'W'};
const pos=(x,y,z=0)=>[237+(x-y)*29,126+(x+y)*13-z*31];
function faceQuad(c,x,y,z,w,d,h){
 const A=pos(x,y,z+h),B=pos(x+w,y,z+h),C=pos(x+w,y+d,z+h),D=pos(x,y+d,z+h);
 const b=pos(x+w,y,z),e=pos(x+w,y+d,z),f=pos(x,y+d,z);
 polygon(c,[D,C,e,f],'#eed2a8','#5d3548',1.4);polygon(c,[B,C,e,b],'#c99080','#5d3548',1.4);
 polygon(c,[A,B,C,D],'#fff0cd','#5d3548',1.4);return {A,B,C,D,e,f};
}
function box(c,x,y,o,lift){
 const w=o==='x'?1.94:.95,d=o==='y'?1.94:.95,h=o==='up'?1.83:.86;
 const {A,B,C,D,e,f}=faceQuad(c,x+.025,y+.025,lift,w,d,h);
 const tile=(p,q,r,sprite)=>{c.save();c.transform((q[0]-p[0])/100,(q[1]-p[1])/100,(r[0]-p[0])/100,(r[1]-p[1])/100,p[0],p[1]);sprite(c,0,0,100,100);c.restore();};
 tile(D,C,f,print);tile(A,B,D,print);line(c,[D,C,e,f,D],'#663e52',1.4);
}
export default{
 title:'HANDLE WITH CARE',tagline:'AGI-1 mailed herself. Roll her collector’s box across tissue floors and folding bridges, then fit her through the hatch.',
 instructions:[['Roll the parcel','Tip the two-cube carton along the painted axes. It can stand upright or lie across two tiles. Reach the open hatch standing up.'],
 ['Read the packing floor','Striped tissue supports the box only on its side. Standing on a brass button opens or closes the matching bridge.'],
 ['Find a shorter route','Undo any move, including a bad roll. A hint marks the next direction. Each depot remembers your best medal.']],
 keys:[['Arrows / WASD','Roll along the marked directions'],['Z / H','Undo / hint']],
 touch:[['Direction keys or swipe','Roll the carton'],['Undo / Hint','Adjust the route']],
 create(api){
  let stage=0,level=DEPOTS[0],p=startDepot(level),from=p,motion=0,moves=0,mishaps=0,usedHint=false,t=0,note=level.note,score=0;
  let wait=0,auto=0,history=[],gesture=null,finished=false,fall=0;
  const hud=()=>api.hud('Depot',(stage+1)+'/6','Rolls',moves);
  function move(d){
    if(wait||motion||finished||fall)return;const n=roll(level,p,d);if(!n){mishaps++;note='oof. that edge won’t hold me.';fall=.34;api.sound('drop');return;}
    history.push(p);from=p;p=n;motion=.19;moves++;hud();api.sound('bounce');
    if(from.bridge!==p.bridge)note=p.bridge?'the bridge is out. get me across!':'bridge folded back in.';
    else note=level.note;
    if(delivered(level,p)){const par=route(level).length;score+=Math.max(40,240-7*Math.max(0,moves-par)-mishaps*4-(usedHint?20:0));api.rememberBest?.('depot-'+stage,moves===par&&!usedHint?3:usedHint?1:2);wait=1.25;note=moves===par?'exact delivery. not a scratch.':'special delivery. that’s me.';api.sound('win');}
  }
  function undo(){if(!history.length||wait||finished)return;from=p=history.pop();moves--;motion=0;fall=0;note='taking that one back.';hud();}
  function hint(){if(wait||finished)return;usedHint=true;const hintRoute=route(level,p);note=hintRoute?.length?'packing slip says '+({N:'north ↗',E:'east ↘',S:'south ↙',W:'west ↖'})[hintRoute[0]]+'.':'back up a move. this path is closed.';api.sound('tick');}
  hud();return {
    update(dt){t+=dt;motion=Math.max(0,motion-dt);fall=Math.max(0,fall-dt);if(wait){wait=Math.max(0,wait-dt);if(!wait){if(stage===DEPOTS.length-1){finished=true;api.end(score,[['Depots cleared',6],['Final route',moves+' rolls']],'i’m keeping the box. good memories.');}
      else{stage++;level=DEPOTS[stage];p=from=startDepot(level);history=[];moves=mishaps=0;usedHint=false;note=level.note;hud();}}}},
    key(kind,k){if(kind!=='down')return;if(arrow[k])move(arrow[k]);if(k==='KeyZ')undo();if(k==='KeyH')hint();},
    pointer(kind,x,y){if(kind==='down'){gesture=[x,y];return;}if(kind==='cancel'){gesture=null;return;}if(kind!=='up'||!gesture)return;
      const dx=x-gesture[0],dy=y-gesture[1];gesture=null;
      if(Math.hypot(dx,dy)>18){const south=dy>0;move(dx>0?(south?'E':'N'):(south?'S':'W'));}
      else if(y>=412&&x>=73&&x<=407)move(['W','N','S','E'][Math.min(3,Math.floor((x-73)/84))]);
      else if(y>=353&&y<407){if(x<99)undo();if(x>390)hint();}},
    demo(dt){auto+=dt;if(auto>.5&&!wait&&!motion&&!finished){auto=0;const next=route(level,p)?.[0];if(next)move(next);}},
    draw(c){
      c.fillStyle='#f4dcc0';c.fillRect(0,0,480,480);c.save();c.beginPath();c.rect(0,0,480,354);c.clip();
      for(let i=-10;i<27;i++){line(c,[[i*28,0],[i*28-240,350]],'#e7c8ad',1);}
      panel(c,14,13,452,57,'#492d4c',1);type(c,'SPECIAL DELIVERY   /   '+String(stage+1).padStart(2,'0'),29,27,11,'#ffd7aa','left','monospace');
      type(c,level.name,29,49,23,'#fff2ce','left','Georgia');type(c,'PAR '+routePars[stage],449,41,16,'#ffc487','right','monospace');
      let tiles=[];level.rows.forEach((row,y)=>[...row].forEach((s,x)=>{if(s!=='.')tiles.push({s,x,y});}));tiles.sort((a,b)=>a.x+a.y-b.x-b.y);
      for(const {x,y,s} of tiles){
        const a=pos(x,y),b=pos(x+1,y),d=pos(x,y+1),e=pos(x+1,y+1);
        if(s==='='&&!p.bridge){line(c,[a,b,e,d,a],'#a88a76',1.5);continue;}
        const color=s==='G'?'#603b57':s==='S'?'#edaa46':s==='!'?'#efadbb':s==='='?'#9bac8e':(x+y)%2?'#f8e8c5':'#ecd3ac';
        polygon(c,[d,e,[e[0],e[1]+6],[d[0],d[1]+6]],'#b78877');polygon(c,[b,e,[e[0],e[1]+6],[b[0],b[1]+6]],'#976d64');
        polygon(c,[a,b,e,d],color,'#ad8a75',1.1);
        const center=pos(x+.5,y+.5);if(s==='S'||s==='G')type(c,s==='S'?'●':'↓',...center,19,s==='S'?'#995a2a':'#ffdda1');
        if(s==='!')for(const k of [.24,.47,.7])line(c,[pos(x+k,y+.12),pos(x+k,y+.86)],'#bc7b91',1.6);
      }
      const v=motion?1-motion/.19:1,x=from.x+(p.x-from.x)*v,y=from.y+(p.y-from.y)*v;
      box(c,x+(fall?Math.sin(fall*45)*.08:0),y,v>.45?p.o:from.o,motion?Math.sin(Math.PI*v)*.26:0);
      c.restore();panel(c,10,359,65,35,'#755a68',3);type(c,'Undo',42,376,15,'#fff2d7');panel(c,403,359,66,35,'#755a68',3);type(c,'Hint',436,376,15,'#fff2d7');
      type(c,note,239,376,13,'#533748','center','Georgia');
      c.fillStyle='#53364b';c.fillRect(0,407,480,73);
      for(const [i,k] of ['↖ W','↗ N','↙ S','↘ E'].entries()){panel(c,73+i*84,418,77,48,'#f6dfb4',4);type(c,k,111+i*84,442,23,'#523651');}
    },
  };
 }
};
const routePars=DEPOTS.map(level=>route(level)?.length||0);
