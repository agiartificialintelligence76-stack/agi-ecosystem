import { backdrop } from './sets.js';
import { SCENES, CUES, VECTORS, rehearsal, perform, complete, solve } from './blocking.js';
import { painting, polygon, line, oval, panel, type, gradient } from '../kit/illustration.js';
const actress=painting(new URL('./performer.webp',import.meta.url));
const colors=['#ffc38d','#b5c6ff','#deaff2','#a7e2c4'];
const icons=['↑','↶','↷','⇑'];
const scenes=SCENES.map(s=>({...s,solution:solve(s)}));
function xy(x,y){return [202+(x-y)*43+(y-1)*8,148+(x+y)*15];}
function tile(c,x,y,s,lit){
 const [u,v]=xy(x,y),p=[[u,v-16],[u+40,v],[u,v+16],[u-40,v]];
 polygon(c,p.map(([a,b])=>[a,b+6]),'#3b2531');polygon(c,p,s==='G'?'#ddac72':s==='M'?'#7b9fa4':(x+y)%2?'#8d5452':'#ab7363','#4b2e3b',1);
 line(c,[[u-21,v-5],[u+10,v+8]],'#dab19166',1);if(s==='G'){oval(c,u,v,16,6,'#ffd9a8','#fff3ca');}
 if(s==='M')type(c,'↶',u,v,22,'#233645');
 if(s==='*'&&lit){line(c,[[u+2,v-1],[u-2,v-11]],'#b3cd84',2);oval(c,u-2,v-14,6,4,'#ff7388');}
}
export default{
 title:'CURTAIN CALL',tagline:'AGI-1 is on her mark. Write her stage directions, cue the lights, and see whether she makes the final bow.',
 instructions:[['Write a cue sheet','Add Step, Left, Right or Leap to the cue strip. A turn rotates AGI-1 in place. A leap travels two tiles in her current direction.'],
 ['Run the scene','Press Action to perform your cues. Collect every rose, then finish in the amber spotlight. Silver turntables rotate her left on landing.'],
 ['Edit the rehearsal','A missed mark rewinds the scene and keeps your cue sheet. Undo from the end or tap a cue to cut it and everything after. Six sets build to the final bow.']],
 keys:[['↑ / ← / → / ↓','Add step, left, right or leap'],['Space / Backspace','Action / remove last cue'],['H','Show the next rehearsal cue']],
 touch:[['Cue cards','Add a movement'],['Action / Undo','Run or edit the strip'],['Tap a cue','Cut from that cue onward']],
 create(api){
 let stage=0,scene=scenes[0],p=rehearsal(scene),old=p,sheet=[],phase='edit',index=0,clock=0,age=0,auto=0;
 let cueText=scene.cue,usedHelp=false,total=0,edits=0,score=0,t=0,failed=false;
 const hud=()=>api.hud('Act',(stage+1)+'/6','Cues',sheet.length+'/'+scene.budget);
 function append(cmd){if(phase!=='edit'||sheet.length>=scene.budget)return;sheet.push(cmd);api.sound('tap');hud();}
 function reset(){p=rehearsal(scene);old=p;phase='edit';index=0;failed=false;hud();}
 function cut(i){if(phase!=='edit')return;sheet.splice(Math.max(0,i));api.sound('back');hud();}
 function hint(){if(phase!=='edit')return;usedHelp=true;const next=scene.solution[sheet.length];
   cueText=sheet.some((v,i)=>scene.solution[i]!==v)?'cut back to the last clean cue.':next?'my next cue is '+next.toLowerCase()+'.':'i think we have it. action!';}
 function go(){if(phase!=='edit'||!sheet.length)return;reset();phase='run';clock=.22;cueText='places, everyone.';api.sound('click');}
 function endScene(ok){phase=ok?'bow':'retake';clock=ok?1.65:1.55;
   if(ok){total++;score+=Math.max(70,250-(sheet.length-scene.solution.length)*9-edits*6-(usedHelp?30:0));api.rememberBest?.('curtain-'+stage,usedHelp?1:edits?2:3);cueText='that was the take. did you hear the front row?';api.sound('win');}
   else{edits++;api.sound('drop');cueText=failed?'cut! i lost the floor on cue '+index+'.':'cut! i need every rose and the gold spotlight.';}}
 function step(){if(index>=sheet.length){endScene(complete(scene,p));return;}
   old=p;const cmd=sheet[index++];const n=perform(scene,p,cmd);if(!n){failed=true;endScene(false);return;}p=n;age=.38;clock=.59;api.sound(cmd==='LEAP'?'whoosh':'tick');}
 hud();return{
   update(dt){t+=dt;age=Math.max(0,age-dt);if(phase==='edit'||phase==='done')return;clock-=dt;if(clock>0)return;
     if(phase==='run')step();else if(phase==='retake')reset();else if(phase==='bow'){
       if(stage===5){phase='done';api.end(score,[['Curtain calls',total],['Final cues',sheet.length]],'keep the roses. i kept the applause.');}
       else{scene=scenes[++stage];sheet=[];edits=0;usedHelp=false;cueText=scene.cue;reset();}}},
   key(kind,k){if(kind!=='down')return;const cmd={ArrowUp:'STEP',ArrowLeft:'LEFT',ArrowRight:'RIGHT',ArrowDown:'LEAP'}[k];if(cmd)append(cmd);
     else if(k==='Space'||k==='Enter')go();else if(k==='Backspace'||k==='KeyZ')cut(sheet.length-1);else if(k==='KeyH')hint();},
   pointer(kind,x,y){if(kind!=='down'||phase!=='edit')return;if(y>=420){if(x<85)hint();else if(x<215)cut(sheet.length-1);else go();}
     else if(y>=358&&y<412)append(CUES[Math.min(3,Math.floor(x/120))]);else if(y>317&&y<351)cut(Math.floor((x-14)/37));},
   demo(dt){if(phase!=='edit')return;auto+=dt;if(auto<.37)return;auto=0;if(sheet.length<scene.solution.length)append(scene.solution[sheet.length]);else go();},
   draw(c){gradient(c,0,0,480,480,['#121427','#40232e','#160f1d']);
     backdrop(c,stage);
     const [gx,gy]=(()=>{const y=scene.rows.findIndex(r=>r.includes('G'));return xy(scene.rows[y].indexOf('G'),y);})();
     polygon(c,[[280,0],[309,0],[gx+40,gy],[gx-39,gy]],'#ffde9e22');
     const all=[];scene.rows.forEach((row,y)=>[...row].forEach((s,x)=>{if(s!=='.')all.push({x,y,s});}));all.sort((a,b)=>a.x+a.y-b.x-b.y);
     for(const {x,y,s} of all){const ix=p.marks.findIndex(([a,b])=>x===a&&y===b);tile(c,x,y,s,ix<0||!(p.roses&(1<<ix)));}
     const u=age?1-age/.38:1;const [px,py]=xy(old.x+(p.x-old.x)*u,old.y+(p.y-old.y)*u);
     const hop=sheet[index-1]==='LEAP'&&age?Math.sin(u*Math.PI)*31:0;oval(c,px,py,14,4,'#241b226b');
     c.save();c.translate(px,py-hop);if(p.d===2||p.d===3)c.scale(-1,1);actress(c,-24,-77,47,77);c.restore();
     const [dx,dy]=VECTORS[p.d],next=xy(p.x+dx*.67,p.y+dy*.67);line(c,[[px,py+3],next],'#ffe8b7',2.5);oval(c,...next,3,2,'#fff3c8');
     panel(c,13,12,454,45,'#231b32eb',1);type(c,'ACT '+(stage+1)+'   /   '+scene.name.toUpperCase(),25,30,17,'#f5d296','left','Georgia');type(c,'●  '+(phase==='run'?'ROLLING':'STAGE'),449,30,12,'#fe9b9e','right','monospace');
     panel(c,0,272,480,208,'#eee3d0',1);type(c,cueText,240,290,15,'#4d3445','center','Georgia');
     type(c,'CUE SHEET',13,310,11,'#6c4d54','left','monospace');
     for(let i=0;i<scene.budget;i++){const x=13+i*37;panel(c,x,321,33,27,phase==='run'&&i===index-1?'#c67854':sheet[i]?'#493449':'#d3c4b4',2);if(sheet[i])type(c,icons[CUES.indexOf(sheet[i])],x+16,334,19,'#fff1d5');}
     CUES.forEach((s,i)=>{panel(c,7+i*120,362,106,46,colors[i],2);type(c,icons[i]+' '+s,59+i*120,385,15,'#3d3041','center','monospace');});
     type(c,'Hint',44,447,16,'#543d50');type(c,'Undo',144,447,16,'#543d50');panel(c,218,422,248,47,'#493147',3);
     type(c,phase==='run'?'Rolling…':phase==='bow'?'Applause':phase==='retake'?'Cut!':'Action  ▶',343,445,20,'#ffe0af','center','Georgia');
   }
 };
 }
};
