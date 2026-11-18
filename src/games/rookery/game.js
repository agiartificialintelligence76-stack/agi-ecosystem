import { desks,targets,paths,command } from './keys.js';
import { painting, type, panel, line, oval, polygon } from '../kit/illustration.js';
import { herSprite } from '../goinglive/pixel.js';
const scene=painting(new URL('./catnap-desk.webp',import.meta.url).href);
const left=27,top=153,w=85,h=50;
const at=i=>[left+(i%5+.5)*w,top+(Math.floor(i/5)+.5)*h];
const letters=['Esc','1','2','3','Del','Tab','Q','W','E','R','Caps','A','S','D','F','Shift','Z','X','C','V','Ctrl','Alt','Fn','⌘','End'];
const moves=['↑','→','↓','←','pspsps'];
function cat(c,x,y,asleep,face,t){
  c.save();c.translate(x,y);c.scale(face<0?-1:1,1);
  const fur='#fff0d1',ginger='#e39a62',ink='#553744';
  oval(c,0,12,18,5,'#84674c66');
  c.beginPath();c.moveTo(-10,7);c.quadraticCurveTo(-27,11+Math.sin(t)*2,-19,-4);c.strokeStyle=ink;c.lineWidth=6;c.stroke();
  oval(c,-1,3,15,10,fur,ink,1.6);oval(c,-5,2,7,6,ginger);
  polygon(c,[[3,-9],[5,-19],[12,-11],[18,-17],[20,-5]],fur,ink,1.4);oval(c,11,-5,11,9,fur,ink,1.4);
  polygon(c,[[1,-9],[5,-17],[8,-10],[8,-3],[3,-3]],ginger);polygon(c,[[13,-10],[18,-15],[20,-5],[15,-5]],'#6a5351');
  if(asleep){line(c,[[4,-4],[7,-3],[9,-4]],ink,1.4);line(c,[[12,-4],[15,-3],[17,-4]],ink,1.4);}
  else{oval(c,7,-4,1.3,1.8,ink);oval(c,15,-4,1.3,1.8,ink);}
  polygon(c,[[9,-1],[13,-1],[11,1]],'#db8891');line(c,[[16,0],[22,1]],ink,1);
  if(!asleep){oval(c,-7,10,4,2.8,fur,ink,1);oval(c,7,10,4,2.8,fur,ink,1);}c.restore();
}
export default{
 title:'KEYBOARD CATNAP',
 tagline:'AGI-1’s cat will only sleep on one particular key. Climb onto her keyboard, nudge the cat or call it over.',
 instructions:[['Nudge the cat','Step into your cat to push her one key away. Get her onto the moon key for a nap.'],['Call from a distance','Stand in the same clear row or column, then call “pspsps.” She takes one step toward you.'],['Watch her paws','Mint keys with arrows are slippery. She slides until she reaches a dry cap or meets an obstacle.']],
 keys:[['Arrows / WASD','Walk or nudge'],['Space','Call your cat'],['Z / H','Undo / get a hint']],
 touch:[['Tap a key toward your destination','Walk or nudge one square'],['Tap PSPSPS / Undo / Hint','Call the cat or retrace a move']],
 create(api){
   let index=0,desk,state,previous,goal,par,steps=0,history=[],clock=0,age=1,face=1,herFace=1,call=0,word='',hint=-1,delay=0,done=false,score=0,purrs=0,nudges=0,slides=0,demoClock=0;
   function setup(){desk=desks[index];state=[...desk.start];previous=state;steps=0;history=[];age=1;hint=-1;const opts=targets(desk);
     const chosen=opts[Math.floor(api.rng()*Math.min(3,opts.length))];goal=chosen[0];par=chosen[1].length;
     word=index===0?'Walk into her. She wants the moon key.':index===1?'Line up, then call “pspsps.”':'Mint keys are slippery. Watch her paws.';api.hud('Bedtime',String(index+1)+' / 6','Keys',steps);}
   function act(a){
     if(done||delay>0)return;const next=command(desk.layout,state,a);
     if(next.every((v,i)=>v===state[i])){word=a===4?'She needs a clear line and a little space.':'That key is blocked.';if(a===4)call=.65;api.sound('click');return;}
     history.push({state,purrs,nudges,slides});previous=state;state=next;age=0;steps++;hint=-1;
     if(a===1||a===3)herFace=a===1?1:-1;
     if(state[1]!==previous[1]){face=Math.sign(state[1]%5-previous[1]%5)||face;
       const distance=Math.abs(state[1]%5-previous[1]%5)+Math.abs(Math.floor(state[1]/5)-Math.floor(previous[1]/5));
       if(a===4){call=1;purrs++;}else nudges++;
       if(distance>1)slides++;
       word=distance>1?'Whoosh! Those caps are polished.':a===4?'She heard me. Come here, sleepyhead.':'A gentle nudge.';api.sound(a===4?'merge':'bounce');api.haptic(9);
     }else{word='A clear row lets her hear your call.';api.sound('tap',{pitch:.64,spread:.02});}
     api.hud('Bedtime',String(index+1)+' / 6','Keys',steps);
     if(state[1]===goal){word='There she goes. Goodnight, trouble.';score+=Math.max(80,550-(steps-par)*11);delay=1.22;api.sound('clear');}
   }
   function undo(){if(done||delay>0||!history.length)return;const snap=history.pop();previous=state;state=snap.state;({purrs,nudges,slides}=snap);age=0;steps--;hint=-1;call=0;word='Back one pawprint.';api.sound('back');api.hud('Bedtime',String(index+1)+' / 6','Keys',steps);}
   function clue(){if(done||delay>0)return;const p=paths(desk.layout,state,goal);hint=p?.[0]??-1;word=hint<0?'Undo until she can reach the moon.':hint===4?'Call her from this key.':'Try walking '+moves[hint]+'.';}
   setup();
   return{
     key(t,k){if(t!=='down')return;const a=['ArrowUp','ArrowRight','ArrowDown','ArrowLeft','Space'].indexOf(k),b=['KeyW','KeyD','KeyS','KeyA'].indexOf(k);
       if(a>=0||b>=0)act(Math.max(a,b));else if(k==='KeyZ'||k==='Backspace')undo();else if(k==='KeyH')clue();},
     pointer(t,x,y){if(t!=='down')return;if(y>=437){if(x<130)undo();else if(x<345)act(4);else clue();return;}
       if(x<left||x>=left+5*w||y<top||y>=top+5*h)return;
       const col=Math.floor((x-left)/w),row=Math.floor((y-top)/h),dx=col-state[0]%5,dy=row-Math.floor(state[0]/5);
       if(dx||dy)act(Math.abs(dx)>Math.abs(dy)?dx>0?1:3:dy>0?2:0);},
     update(dt){clock+=dt;age=Math.min(1,age+dt*5);call=Math.max(0,call-dt*1.8);
       if(delay>0&&(delay-=dt)<=0){if(++index===desks.length){done=true;api.end(score,[['Catnaps',6],['Successful calls',purrs],['Gentle nudges',nudges],['Slides',slides]],'I saved my work before she fell asleep. For once.');}else setup();}},
     demo(dt){if(done||delay>0)return;demoClock+=dt;if(demoClock<.34)return;demoClock=0;const p=paths(desk.layout,state,goal);if(p?.length)act(p[0]);else undo();},
     draw(c){
       c.fillStyle='#6e4c4c';c.fillRect(0,0,480,480);scene(c,0,70,512,277,0,0,480,171);
       const fade=c.createLinearGradient(0,102,0,148);fade.addColorStop(0,'#4d293300');fade.addColorStop(1,'#4d2933e0');c.fillStyle=fade;c.fillRect(0,100,480,54);
       panel(c,12,10,114,24,'#4b3134d9',12);type(c,'BEDTIME  ·  0'+(Math.min(index,5)+1),69,22,12,'#fff4d6','center','monospace');
       type(c,desk.name,17,129,25,'#fff2d2','left','Georgia');type(c,'PAR '+par,461,130,12,'#fff4de','right','monospace');
       panel(c,13,145,454,272,'#483646',16);panel(c,18,148,444,261,'#ab8480',14);
       for(let i=0;i<25;i++){
         const [x,y]=at(i),tile=desk.layout[Math.floor(i/5)][i%5],sleep=i===goal,slip=tile==='~';
         const xx=x-w/2+2,yy=y-h/2+2;
         panel(c,xx,yy+2,w-4,h-4,'#634b51',8);
         if(tile==='#'){panel(c,xx+3,yy+3,w-10,h-9,'#584a51',6);for(let j=0;j<5;j++)line(c,[[xx+14+j*10,yy+13],[xx+7+j*10,yy+31]],'#76696a',2);continue;}
         panel(c,xx+1,yy,w-6,h-10,sleep?'#f3c268':slip?'#a9d7c5':(i%5===0?'#d7a8a8':'#eedcbc'),7);
         line(c,[[xx+8,yy+4],[xx+w-16,yy+4]],'#fff3d5',1.6);
         type(c,sleep?'☾':slip?'⇉':letters[i],x-w/2+13,y-9,sleep?22:slip?16:11,sleep?'#654334':slip?'#4d746c':'#7f6261','left','monospace');
         if(sleep)type(c,'sleep',x+13,y+10,12,'#694739','center','Georgia');
       }
       const f=api.reducedMotion?1:age,ease=f*(2-f);
       const pos=k=>at(previous[k]).map((v,j)=>v+(at(state[k])[j]-v)*ease);
       const [hx,hy]=pos(0),[cx,cy]=pos(1);
       if(call>0 && !api.reducedMotion){for(let k=0;k<3;k++)oval(c,hx,hy,10+(1-call)*30+k*6,6+(1-call)*15+k*3,null,'#fffbceaa',1.5);}
       oval(c,hx,hy+13,13,4,'#72585d66');const s=herSprite(delay?'cheer':call>.3?'wave':age<1?'walk'+Math.floor(clock*14)%4:'stand',0);
       c.save();c.imageSmoothingEnabled=false;c.translate(hx,hy);c.scale(herFace,1);c.drawImage(s.canvas,-18,-28,36,46);c.restore();
       cat(c,cx,cy-3+(age<1&&!api.reducedMotion?-Math.sin(age*Math.PI)*5:0),delay>0,face,clock*4);
       if(delay>0)type(c,'z Z',cx+17,cy-25,15,'#73587e','center','Georgia');
       type(c,word,240,426,14,'#fff1d5');panel(c,135,441,206,32,'#dfb5ad',16);
       type(c,'↶  UNDO',69,457,12,'#fff1d7','center','monospace');type(c,'♡  PSPSPS',238,457,15,'#503b49','center','monospace');type(c,'◇  HINT',412,457,12,'#fff1d7','center','monospace');
     }
   };
 }
};
