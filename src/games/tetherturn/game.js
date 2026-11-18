import { presets, course, integrate, launch, reverse, passage, wreck, closePass, STEP } from './orbit.js';
import { painting, type, line, oval, panel, polygon, gradient, clip } from '../kit/illustration.js';
const cover=painting(new URL('./pilot.webp',import.meta.url).href),face=painting('/images/agi1-portrait-2d.webp');
const spaceSky=painting(new URL('./cup-sky.webp',import.meta.url).href);
const ink='#182640',mint='#8cf1cf',orange='#ffb785';
const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];
const skies=[
 ['#182c49','#423653'],['#3d2440','#824d56'],['#152f48','#255767'],
 ['#231f47','#634a67'],['#38293f','#805947'],['#191e46','#384369'],
];
function pilot(c,x,y,heading,thrust,polarity){
  c.save();c.translate(x,y);c.rotate(heading);
  if(thrust){polygon(c,[[-12,-4],[-20-thrust*6,0],[-12,4]],orange);polygon(c,[[-11,-2],[-19,0],[-11,2]],'#fff1ae');}
  polygon(c,[[-13,0],[-21,-10],[-4,-7],[12,-3],[18,1],[4,7],[-14,8]],'#f4dac1',ink,2);
  line(c,[[-13,4],[8,3]],'#af6d82',2);c.restore();
  c.save();c.beginPath();c.arc(x,y-3,11,0,Math.PI*2);c.clip();c.fillStyle='#6e91b4';c.fillRect(x-12,y-15,24,24);face(c,x-11,y-14,22,24);c.restore();
  oval(c,x,y-3,11.8,11.8,null,polarity<0?'#dbb8ff':'#d7fcf2',1.8);
  line(c,[[x-7,y-9],[x-4,y-11],[x-1,y-12]],'#fffef4',1.5);
}
function planet(c,[x,y,r],i){
  const palettes=[['#f1b094','#c47c87','#804e71'],['#a0d4c9','#6f9cae','#585375']];
  const colors=palettes[i%2];
  if(i===0){c.save();c.translate(x,y);c.rotate(-.28);oval(c,0,0,r*1.65,r*.31,null,'#f7c6a7aa',3);c.restore();}
  c.save();c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.clip();
  const g=c.createLinearGradient(x-r,y-r,x+r,y+r);colors.forEach((k,i)=>g.addColorStop(i/2,k));c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
  for(let j=0;j<7;j++){
    const yy=y-r+j*r*.31;c.beginPath();c.moveTo(x-r-6,yy);c.bezierCurveTo(x-r*.4,yy+9,x+r*.3,yy-10,x+r+5,yy+1);c.strokeStyle=j%2?'#563f6b55':'#ffe6b76b';c.lineWidth=j%2?4:2;c.stroke();
  }c.restore();oval(c,x,y,r,r,null,'#f3c9b982',1.3);
}
function gate(c,x,y,r,col,star=false){
  c.save();c.translate(x,y);if(star){polygon(c,[[0,-r],[r*.7,0],[0,r],[-r*.7,0]],null,col,2.8);polygon(c,[[0,-5],[4,0],[0,5],[-4,0]],col);}
  else{oval(c,0,0,r,r,null,col,2.6);oval(c,0,0,r-5,r-5,null,col+'88',1);for(let i=0;i<4;i++){c.rotate(Math.PI/2);line(c,[[0,r-1],[0,r+5]],col,2);}}c.restore();
}
export default {
 title:'SLINGSHOT GIRL',
 tagline:'AGI-1 strapped a cockpit to a space-golf ball. Pull back to launch her, skim the moons and flip gravity in flight.',
 instructions:[['Pull back and release','Drag backward on the course to set angle and speed, then release. You can also tap a direction and use the launch button.'],['Skim the moons','Fly through the diamond buoy and the finish ring. A close pass earns 75 extra points if you dock. Touching a moon ends the shot.'],['Flip a moonshot','On violet circuits, switch polarity once in flight. Try flipping after the buoy when the flight timer reaches its gold mark.']],
 keys:[['← / →','Aim'],['↑ / ↓','Power'],['Space / R','Launch or flip / recall']],
 touch:[['Pull back and release','Aim and launch, or tap a direction'],['− / + / Launch / Recall','Adjust power, fly or rewind']],
 create(api){
   let index=0,arena,angle,power,body=null,clock=0,ready=0,wait=0,won=false,done=false,marked=false,drag=null;
   let trail=[],message='',shot=0,strokes=0,points=0,flips=0,acc=0,held=new Set(),repeat=0,flare=0,previousPath=[];
   let close=new Set(),totalSkims=0;
   function hud(){api.hud('Circuit',String(index+1)+' / 6','Shots',shot);}
   function setup(){arena=course(presets[index],(api.rng()-.5)*4);angle=arena.solution+(index===0?3:10)*(index%2?-1:1);
     power=index===0?arena.power:arena.power-13;body=null;drag=null;marked=!arena.beacon;trail=[];previousPath=[];shot=0;ready=0;wait=0;won=false;acc=0;held.clear();
     message=index===0?'Pull back and launch me into the ring.':arena.flip?'Catch the buoy, then flip gravity.':'Fly through the diamond, then dock.';hud();}
   function fire(){if(done||body||wait>0)return;body=launch(arena,angle,power);marked=!arena.beacon;trail=[];close.clear();shot++;strokes++;acc=0;held.clear();
     message=arena.beacon?'First the diamond. Then the ring.':'That is our finish ring!';api.sound('whoosh');api.haptic(12);hud();}
   function flip(){if(!body||wait>0||!arena.flip)return;if(reverse(body)){flips++;flare=1;message='Polarity reversed. Ride it out.';api.sound('power');api.haptic(20);}}
   function reset(){if(done||wait>0)return;if(!body)return;previousPath=[...trail];body=null;trail=[];marked=!arena.beacon;message='Recalled. Try a different arc.';api.sound('back');}
   function finish(finished){won=finished;wait=finished?1.02:.82;flare=1;previousPath=[...trail];api.sound(finished?'clear':'hit');api.haptic(finished?24:12);message=finished?'Docked! That is going on my trophy shelf.':'Missed the ring. The dotted trail is yours.';
     if(finished){totalSkims+=close.size;points+=Math.max(130,850-70*(shot-1))+75*close.size;}}
   function adjust(k,amount=1){if(body||wait>0||done)return;
     if(k===keys[0]||k===keys[1])angle+=(k===keys[0]?-1:1)*2*amount;
     else power=clip(power+(k===keys[2]?1:-1)*5*amount,75,235);}
   function flightTick(){
     integrate(body,arena.moons);const through=passage(arena,body,marked);
     arena.moons.forEach((moon,i)=>{
       if(!close.has(i)&&closePass(body,moon)){
         close.add(i);flare=.65;message='Moon skim! Dock to bank +75.';api.sound('select',{pitch:1.35,spread:0});
       }
     });
     if(through.marked&&!marked){message=arena.flip?'Buoy tagged. Flip at the gold tick.':'Buoy tagged. Head for the ring.';api.sound('coin');flare=.5;}
     marked=through.marked;if(!trail.length||Math.hypot(trail.at(-1)[0]-body.x,trail.at(-1)[1]-body.y)>4)trail.push([body.x,body.y]);
     if(through.finish)finish(true);else if(wreck(body,arena.moons))finish(false);
   }
   setup();
   return {
     key(t,k){if(t==='up'){held.delete(k);return;}if(t!=='down')return;if(keys.includes(k)&&!body){adjust(k);held.add(k);repeat=.3;}else if(k==='Space'||k==='Enter'){if(body)flip();else fire();}else if(k==='KeyR')reset();},
     pointer(t,x,y){
       if(done||wait>0)return;if(t==='cancel'){drag=null;return;}
       if(t==='down'){
         if(y>=430){drag=null;if(x<80)adjust(keys[3]);else if(x<163)adjust(keys[2]);else if(x<295)reset();else if(body)flip();else fire();return;}
         if(y<97)return;if(body){flip();return;}drag={x,y,moved:false};
       }
       if((t==='move'||t==='up')&&drag){
         const dx=drag.x-x,dy=drag.y-y,d=Math.hypot(dx,dy);
         if(d>9){drag.moved=true;angle=Math.atan2(dy,dx)*180/Math.PI;power=clip(65+d*1.45,75,235);}
         if(t==='up'){const moved=drag.moved;drag=null;if(moved)fire();else{angle=Math.atan2(y-arena.start[1],x-arena.start[0])*180/Math.PI;message='Aim set. Launch when ready.';}}
       }
     },cancelInput(){drag=null;held.clear();},
     update(dt){
       if(done)return;clock+=dt;flare=Math.max(0,flare-dt*1.9);
       if(wait>0){wait-=dt;if(wait<=0){if(won){if(++index===presets.length){done=true;api.end(points,[['Circuits docked',6],['Launches',strokes],['Moon skims',totalSkims],['Polarity flips',flips]],'Six rings, zero parking tickets. Best commute ever.');}else setup();}
         else{body=null;trail=[];marked=!arena.beacon;}}return;}
       if(!body){ready+=dt;if(held.size&&(repeat-=dt)<=0){repeat=.09;for(const key of held)adjust(key);}}
       else{acc+=dt;while(acc>=STEP-1e-8&&wait<=0){acc-=STEP;flightTick();}}
     },
     demo(){if(done||wait>0)return;if(!body&&ready>.7){angle=arena.solution;power=arena.power;fire();}
       else if(body&&arena.flip&&body.age>=arena.flip)flip();},
     draw(c){
       const palette=skies[Math.min(index,5)];gradient(c,0,0,480,480,palette);
       cover(c,0,120,512,177,0,0,480,99);
       const fade=c.createLinearGradient(0,58,0,100);fade.addColorStop(0,'#14213b00');fade.addColorStop(1,'#14213b');c.fillStyle=fade;c.fillRect(0,54,480,49);
       panel(c,10,9,127,22,'#19253de6',10);type(c,'ORBIT CUP  /  0'+(Math.min(index,5)+1),74,20,11,'#ffdeaf','center','monospace');
       type(c,arena.name,14,79,24,'#fff5d8','left','Georgia');type(c,arena.flip?'±  POLARITY':'●  GRAVITY',465,81,12,'#e3e2ff','right','monospace');
       c.save();c.beginPath();c.rect(0,98,480,305);c.clip();
       c.save();
       if(index%2){c.translate(480,0);c.scale(-1,1);}
       const skyLoaded=spaceSky(c,0,97,480,307);c.restore();
       if(skyLoaded && index){c.save();c.globalAlpha=.18;c.fillStyle=palette[1];c.fillRect(0,98,480,305);c.restore();}
       for(let i=0;i<(skyLoaded?16:98);i++){const x=(i*137+17)%479,y=99+((i*i*13+i*17)%300),s=i%12===0?2:1;c.fillStyle=i%4?'#fddfc899':'#c1eee8cc';c.fillRect(x,y,s,s);if(s>1){c.fillRect(x-2,y+.5,6,1);c.fillRect(x+.5,y-2,1,6);}}
       const [sx,sy]=arena.start;oval(c,sx,sy+10,23,8,'#18263d99',orange,2);arena.moons.forEach((m,i)=>planet(c,m,i));
       if(arena.beacon)gate(c,...arena.beacon,marked?10:15,marked?'#92c8b4':orange,true);
       gate(c,...arena.ring,19,arena.flip&&!body?.flipped?'#dbc2fc':mint);
       if(wait>0 && won && !api.reducedMotion){
         const radius=22+(1.02-wait)*44;for(let i=0;i<12;i++){
           const a=i*Math.PI/6,ux=Math.cos(a),uy=Math.sin(a),[gx,gy]=arena.ring;
           line(c,[[gx+ux*(radius-4),gy+uy*(radius-4)],[gx+ux*radius,gy+uy*radius]],i%2?mint:orange,2);
         }
       }
       if(previousPath.length>1){c.setLineDash([2,5]);line(c,previousPath,'#dac1ce6b',1.3);c.setLineDash([]);}
       if(!body){
         const p=launch(arena,angle,power);const dots=[];for(let i=0;i<215;i++){integrate(p,arena.moons);if(wreck(p,arena.moons))break;if(i%10===0)dots.push([p.x,p.y]);}
         dots.forEach(([x,y],i)=>oval(c,x,y,i<10?2:1.3,i<10?2:1.3,i<10?mint:'#c4dad099'));
         if(drag?.moved){line(c,[[sx,sy],[sx-Math.cos(angle*Math.PI/180)*43,sy-Math.sin(angle*Math.PI/180)*43]],orange,2);}
         pilot(c,sx,sy,angle*Math.PI/180,0,1);
       }else{
         if(trail.length>1){line(c,trail,body.flipped?'#d6afff88':'#91efd28a',3);line(c,trail.slice(-12),'#ffebc8',1.3);}
         pilot(c,body.x,body.y,Math.atan2(body.vy,body.vx),.5+Math.sin(clock*22)*.4,body.polarity);
         if(flare>.1&&!api.reducedMotion)oval(c,body.x,body.y,16+(1-flare)*23,16+(1-flare)*23,null,body.flipped?'#c9b7ff88':'#ffcf9577',1.5);
       }c.restore();
       panel(c,0,403,480,77,'#18263e',0);
       type(c,message,240,415,13,'#fff0d6');const bx=15,by=428,bw=450;
       line(c,[[bx,by],[bx+bw,by]],'#44536c',2);
       if(arena.flip)line(c,[[bx+bw*arena.flip/3,by-3],[bx+bw*arena.flip/3,by+3]],orange,3);
       if(body)line(c,[[bx,by],[bx+bw*Math.min(1,body.age/3),by]],mint,2);
       const btns=[['−',13,65],['+',83,65],['RECALL',164,119],[body?(body.flipped?'FLIPPED':arena.flip?'FLIP ±':'IN FLIGHT'):'LAUNCH ▸',298,169]];
       btns.forEach(([text,x,w],i)=>{panel(c,x,438,w,32,i===3?body&&arena.flip?'#c0a7dd':mint:'#31425b',13);type(c,text,x+w/2,455,i<2?21:13,i===3?ink:'#eee4dc','center','monospace');});
       panel(c,8,103,127,21,'#16233bd9',10);type(c,Math.round((angle%360+360)%360)+'°   '+Math.round(power)+' m/s',71,114,11,'#efefdc','center','monospace');
     }
   };
 }
};
