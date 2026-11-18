import { rooms,indexRoom,step,record,advance,solve,cleared,symbols } from './tape.js';
import { painting, panel, type, line, oval } from '../kit/illustration.js';
import { herSprite } from '../goinglive/pixel.js';

const archive=painting(new URL('./alibi-archive.webp',import.meta.url).href);
const left=41,top=127,size=57,cyan='#79e6d3',amber='#ffbc80',rose='#ff6f88';
const center=i=>[left+(i%7+.5)*size,top+(Math.floor(i/7)+.5)*size];
function actor(c,pos,ghost,pose,alpha=1){
  const [x,y]=pos;c.save();c.globalAlpha=alpha;
  oval(c,x,y+18,15,4,ghost?'#49cfbf':'#463145');
  const spr=herSprite(pose,ghost?2:4);c.imageSmoothingEnabled=false;
  if(ghost){c.shadowColor=cyan;c.shadowBlur=9;}c.drawImage(spr.canvas,x-18,y-26,36,46);c.restore();
}
function door(c,x,y,color,open){
  const gap=open?12:1;
  for(const side of [-1,1]){const sx=x+side*gap;line(c,[[sx+side*19,y-20],[sx,y-20],[sx,y+20],[sx+side*19,y+20]],color,3);}
  type(c,open?'⇄':'×',x,y,19,color);
}
export default{
 title:"AGI'S ALIBI",
 tagline:'AGI-1 needs the diary the archive confiscated. Give the cameras a recording of her while the real girl slips through.',
 instructions:[['Record your alibi','Move the mint double onto a numbered camera mat. Each step or Wait adds a frame to her looping tape.'],['Run the take','Start playback. Move the real AGI-1 one turn at a time. A door opens when the NEXT mint frame lands on its matching mat.'],['Take the diary','Pick up every red diary and reach the exit. Later rooms have two doors and laser bars that sleep between red frames.']],
 keys:[['Arrows / WASD','Move AGI-1'],['Space / Enter','Play tape or record again'],['X / Z / H','Wait / undo / hint']],
 touch:[['Tap a direction from AGI-1','Move one tile toward your tap'],['Use the tape deck','Wait, play, undo or get a clue']],
 create(api){
   let index=0,room,script=[],tape=[],state,lastPos,oldGhost,live=false,score=0,steps=0,frames=0,elapsed=0,moveAge=0,delay=0,done=false;
   let feedback='',guide=-1,demoClock=0,history=[];
   function updateHud(){api.hud('Case',String(index+1)+' / 5',live?'Turns':'Tape',live?steps:script.length+' / '+room.cap);}
   function setup(){room=indexRoom(rooms[index]);rewind();}
   function rewind(){live=false;script=[];tape=[];state=[room.start,0,0];lastPos=room.start;oldGhost=room.start;steps=0;history=[];guide=-1;moveAge=1;
     feedback='Record a double on mat 1.';updateHud();}
   function start(){
     if(done||delay>0)return;if(live){rewind();api.sound('back');return;}
     if(!tape.length){feedback='Move the double to make a frame first.';api.sound('click');return;}
     live=true;state=[room.start,0,0];lastPos=room.start;oldGhost=room.start;guide=-1;moveAge=1;feedback='Tape rolling. Get my diary.';api.sound('power');updateHud();
   }
   function undo(){if(done||delay>0)return;if(live&&history.length){state=history.pop();steps--;lastPos=state[0];oldGhost=tape[(state[1]+tape.length-1)%tape.length];}
     else if(!live&&script.length){script.pop();tape=record(room,script);state[0]=tape.at(-1)??room.start;lastPos=state[0];}
     else return;guide=-1;moveAge=1;feedback='Rewound one frame.';api.sound('back');updateHud();}
   function act(a){
     if(done||delay>0)return;
     if(!live){
       if(script.length>=room.cap){feedback='Tape full. Press PLAY or undo a frame.';return;}
       lastPos=state[0];const next=step(state[0],a,room.cells);
       if(next===state[0]&&a!==4){feedback='Wall. Tap WAIT to hold this frame.';return;}
       script.push(a);state[0]=next;tape.push(next);moveAge=0;guide=-1;
       feedback=room.pads.includes(next)?'Camera sees me. Play when ready.':'The tape records each footstep.';
       api.sound('tick');updateHud();return;
     }
     lastPos=state[0];oldGhost=history.length?tape[(state[1]-1+tape.length)%tape.length]:room.start;
     history.push(state);const previous=state;state=advance(room,tape,state,a);steps++;moveAge=0;guide=-1;
     feedback=state[2]!==previous[2]?'Got it. Head for the green exit.':a!==4 && state[0]===previous[0]?'Door shut or wall. Watch the NEXT frame.':'Keep walking. They see my double.';
     api.sound(state[2]!==previous[2]?'coin':'tap');
     if(cleared(room,state)){feedback='Recovered '+room.file+'.';score+=Math.max(100,650-steps*8-script.length*5);frames+=script.length;delay=1.2;api.sound('clear');api.haptic(24);}
     updateHud();
   }
   function clue(){if(done||delay>0)return;
     if(!live){
       if(script.every((v,i)=>v===room.script[i])){
         if(script.length===room.script.length){feedback='The rehearsal is ready. Press PLAY.';guide=5;}
         else{guide=room.script[script.length];feedback='Record '+(guide===4?'a wait':symbols[guide])+' next.';}
       }else{guide=-1;feedback='Undo to the rehearsal marks, or try your tape.';}
     }else{const p=solve(room,tape,state);guide=p?.[0]??-1;feedback=guide<0?'This tape cannot open the route. Re-record.':'On this turn, '+(guide===4?'wait.':'move '+symbols[guide]+'.');}
   }
   setup();
   return {
     key(t,k){if(t!=='down')return;const a=['ArrowUp','ArrowRight','ArrowDown','ArrowLeft','KeyX'].indexOf(k),b=['KeyW','KeyD','KeyS','KeyA'].indexOf(k);
       if(a>=0||b>=0)act(Math.max(a,b));else if(k==='Space'||k==='Enter')start();else if(k==='KeyZ'||k==='Backspace')undo();else if(k==='KeyH')clue();},
     pointer(t,x,y){if(t!=='down')return;if(y>=437){if(x<98)act(4);else if(x<183)undo();else if(x<310)clue();else start();return;}
       if(y<top || y>=top+size*5 || x<left || x>=left+size*7)return;
       const [cx,cy]=center(state[0]),dx=x-cx,dy=y-cy;if(Math.max(Math.abs(dx),Math.abs(dy))<18){act(4);return;}act(Math.abs(dx)>Math.abs(dy)?dx>0?1:3:dy>0?2:0);},
     update(dt){elapsed+=dt;moveAge=Math.min(1,moveAge+dt*7);if(delay>0&&(delay-=dt)<=0){if(++index===rooms.length){done=true;api.end(score,[['Cases recovered',5],['Recorded frames',frames]],'If anyone asks, I was on camera the whole time.');}else setup();}},
     demo(dt){if(done||delay>0)return;demoClock+=dt;if(demoClock<.4)return;demoClock=0;
       if(!live){if(script.length<room.script.length)act(room.script[script.length]);else start();}else{const path=solve(room,tape,state);if(path?.length)act(path[0]);else rewind();}},
     draw(c){
       c.fillStyle='#091e25';c.fillRect(0,0,480,480);archive(c,0,91,512,227,0,0,480,122);
       const fog=c.createLinearGradient(0,64,0,124);fog.addColorStop(0,'#071a2100');fog.addColorStop(1,'#091e25');c.fillStyle=fog;c.fillRect(0,52,480,72);
       panel(c,12,10,126,21,'#0a1b21dc',2);type(c,(live?'●  LIVE':'●  REHEARSAL')+'  /  0'+(Math.min(4,index)+1),75,21,11,live?rose:cyan,'center','monospace');
       type(c,room.name,16,87,25,'#fff1d4','left','Georgia');
       type(c,live?'NEXT FRAME '+(state[1]+1):'TAPE '+script.length+' / '+room.cap,462,88,12,'#fff0d2','right','monospace');
       const n=tape.length;for(let i=0;i<room.cap;i++){const x=18+i*33;panel(c,x,104,29,19,i===state[1]&&live?'#e4f6d3':i<n?'#244e4c':'#183238',2);type(c,i<n?symbols[script[i]]:'·',x+14,113,13,i===state[1]&&live?'#162c30':cyan);}
       type(c,live?'REAL AGI-1':'DECOY AGI-1',465,113,11,live?amber:cyan,'right','monospace');
       const ghost=live?tape[state[1]]:state[0];
       for(let i=0;i<room.cells.length;i++){
         const [x,y]=center(i),tile=room.cells[i],xx=x-size/2,yy=y-size/2;
         if(tile==='#'){
           panel(c,xx+2,yy+2,size-4,size-4,'#162c31',3);
           if(i%8===0){
             // The guards' live feed follows her rehearsal double.
             panel(c,xx+8,yy+10,40,28,'#445555',3);panel(c,xx+11,yy+13,34,21,'#173b3b',2);
             const signal=c.createRadialGradient(x,y-5,1,x,y-5,17);signal.addColorStop(0,'#7cbd9d99');signal.addColorStop(1,'#779b8800');
             c.fillStyle=signal;c.fillRect(x-15,y-12,30,17);
             for(let j=0;j<4;j++)line(c,[[xx+13,yy+16+j*4],[xx+43,yy+16+j*4]],'#699f8c55',1);
             oval(c,xx+43,yy+43,2,2,live?rose:cyan);line(c,[[xx+11,yy+43],[xx+32,yy+43]],'#65736c',2);
           }else{
             // Book colours and unfilled spaces make the archive's shelves legible at a glance.
             for(let row=0;row<2;row++){
               const base=yy+23+row*22;line(c,[[xx+4,base+2],[xx+51,base+2]],'#697063',2);
               for(let j=0;j<7;j++){
                 if((i+row+j)%7===0)continue;const height=9+(i*3+j*7+row)%8,bx=xx+6+j*6;
                 const shade=['#46534b','#354b4e','#4f5553','#425754','#62574c'][(i+j+row)%5];
                 panel(c,bx,base-height,4,height,shade,1);line(c,[[bx,base-3],[bx+3,base-3]],'#abad8644',1);
               }
             }
           }continue;
         }
         panel(c,xx+1,yy+1,size-2,size-2,(i+Math.floor(i/7))%2?'#365354':'#3b5959',2);
         line(c,[[xx+4,yy+5],[xx+12,yy+5]],'#6c8380',1);
         if(tile==='p'||tile==='q'){oval(c,x,y+4,21,16,'#163b39',cyan,2);type(c,tile==='p'?'1':'2',x,y+4,20,cyan,'center','monospace');}
         if(tile==='g'||tile==='h'){door(c,x,y,amber,ghost===room.pads[Number(tile==='h')]);type(c,tile==='g'?'1':'2',x-17,y-15,10,amber);}
         if(tile==='S')type(c,'⌂',x,y+1,25,'#b8c6a9');
         if(tile==='E'){panel(c,x-19,y-17,38,34,'#163b37',5);type(c,'EXIT',x,y+1,12,'#a8efbd','center','monospace');}
         if(tile==='!' && (!live || state[1]%3===0)){for(let j=-1;j<=1;j++)line(c,[[x-21,y+j*9],[x+21,y+j*9]],rose,2);}
         const id=room.diaries.indexOf(i);if(id>=0 && !(state[2]&(1<<id))){
           c.save();c.translate(x,y);c.rotate(-.18);panel(c,-12,-17,25,32,rose,3);line(c,[[-7,-14],[-7,12]],'#652434',2);type(c,'♥',3,-1,13,'#ffefc0');c.restore();}
       }
       const mixPos=(a,b)=>center(a).map((v,k)=>v+(center(b)[k]-v)*(api.reducedMotion?1:moveAge));
       if(live){
         const shown=history.length?tape[(state[1]+n-1)%n]:room.start;
         actor(c,mixPos(oldGhost,shown),true,'walk'+Math.floor(elapsed*8)%4,.58);
         const [gx,gy]=center(ghost);line(c,[[gx-16,gy-18],[gx-16,gy-24],[gx-9,gy-24]],cyan,2);
       }
       actor(c,mixPos(lastPos,state[0]),!live,delay>0?'hold:book':moveAge<1?'run'+Math.floor(elapsed*12)%4:Math.floor(elapsed*2)%9===0?'blink':'stand',live?1:.88);
       type(c,feedback,240,423,13,'#fff2d3');const btns=[['WAIT',10,83],['UNDO',100,80],['HINT',187,95],[live?'RE-RECORD':'PLAY  ▸',299,170]];
       btns.forEach(([label,x,w],i)=>{panel(c,x,440,w,32,i===3?'#adcfc4':'#203940',4);type(c,label,x+w/2,456,13,i===3?'#10292e':cyan,'center','monospace');});
     }
   };
 }
};
