import './style.css';
import {createShell,el} from '../kit/shell.js';
import {fitCanvas} from '../kit/canvas.js';
import {createLoop} from '../kit/loop.js';
import {pointer,keyboard} from '../kit/input.js';
import {DEMO,REDUCED,QUERY} from '../kit/env.js';
import {LEVELS,SIZE,createBoard,rotate,moveOptic,hint,trace,starsFor} from './rules.js';

const shell=createShell({
  game: 'prism', name:'PRISM',root:document.getElementById('ak-root'),
  howTo:{intro:'A tiny light laboratory. Bend the beams until every receiver glows in its own color.',steps:[['Turn a mirror','Tap a silver mirror to change its diagonal. Beams bend through a right angle.'],['Split white light','Tap a triangular prism to change which direction red, green and blue leave.'],['Mix at the receiver','Two different colors arriving together mix. Red + blue makes violet. Match the colored ring exactly.'],['Keep it elegant','Solve near the move target for three stars. A hint restores one optic, but earns one star. Dotted optics can be dragged to an empty cell.']],touch:[['Tap optic','Rotate'],['Drag dotted optic','Move']],keys:[['Arrow keys','Select cell'],['Space / Enter','Turn selected optic'],['Shift + arrows','Move selected dotted optic'],['H','Hint'],['R','Reset level']]},
  onPause:()=>{drag=null;menu=false;},onRestart:()=>start(board.index),onQuit:()=>title()
});
const levelChip=shell.chip('LAB','01'),lightChip=shell.chip('LIT','0/1'),movesChip=shell.chip('TURNS',0);
const canvas=el('canvas',{class:'pr-canvas','aria-label':'Light laboratory puzzle. Arrow keys choose a tile; Enter rotates it.'});shell.stage.append(canvas);
const view=fitCanvas(canvas);const ctx=view.ctx;
const controls=el('div','pr-controls');const caption=el('p','pr-caption');shell.stage.append(caption,controls);
const button=(name,fn)=>el('button',{type:'button',onclick:fn},name);
controls.append(button('↺ Reset',()=>start(board.index)),button('Hint',()=>actHint()),button('Labs',()=>choose()));
const colors=['#716281','#ff6388','#76fbb8','#f9e37a','#77bfff','#dc94ff','#8df8ee','#fff8ec'];
let board=createBoard(0),rays=trace(board),clock=0,settle=0,demoTick=0,selected=[3,3],drag=null,menu=false;
let fit={x:0,y:0,scale:1};
function saved(){return shell.store.read().levels||{};}
function unlocked(){const completed=Object.keys(saved()).map(Number);return Math.min(17,completed.length?Math.max(...completed)+1:0);}
function start(index=0){menu=false;drag=null;board=createBoard(index);rays=trace(board);settle=0;demoTick=0;selected=[board.optics[0].x,board.optics[0].y];shell.started();controls.hidden=DEMO;caption.hidden=DEMO;refresh();}
function refresh(){rays=trace(board);levelChip.set(String(board.index+1).padStart(2,'0'));lightChip.set(`${rays.lit}/${LEVELS[board.index].targets.length}`);movesChip.set(board.moves);caption.textContent=`${LEVELS[board.index].chapter} · ${LEVELS[board.index].name.toUpperCase()} · TARGET ${LEVELS[board.index].par} TURNS`;}
function changed(){shell.audio.sfx('select');shell.haptic(6);settle=0;refresh();}
function actHint(){if(shell.state!=='play'||menu||rays.won)return;if(hint(board)!=null){shell.toast('one little nudge 💜');changed();}}
function title(){menu=false;controls.hidden=true;caption.hidden=true;board=createBoard(9);for(let i=0;i<2;i++)hint(board);rays=trace(board);shell.title({logo:[{text:'PRISM',tone:'mint'}],tagline:'Split the light. Find the color.',play:'Light it up',onPlay:()=>start(unlocked()),modes:[{label:'Choose a lab',sub:'18 light experiments',onClick:choose}],best:Object.values(saved()).reduce((a,b)=>a+b,0),bestLabel:'Stars collected',keysHint:'Tap to turn · Drag dotted optics'});}
function choose(){menu=true;const progress=saved(),open=unlocked();const grid=el('div','pr-levels',LEVELS.map((l,i)=>el('button',{type:'button',disabled:i>open,onclick:()=>start(i),'aria-label':`Lab ${i+1}: ${l.name}`},i+1,el('small',null,i>open?'LOCKED':'★'.repeat(progress[i]||0)||'·'))));const close=button('Back',()=>{menu=false;shell.closeCard();});close.className='ak-btn ak-btn-sm';shell.card(el('div','ak-card',el('p','ak-card-kicker','PRISM · 18 LABS'),el('h2','ak-card-title','Follow the light'),grid,close),{label:'Choose a light laboratory'});}
function complete(){const stars=starsFor(board);shell.audio.sfx('win');if(DEMO){start((board.index+1)%LEVELS.length);return;}shell.store.update(d=>{d.levels??={};d.levels[board.index]=Math.max(d.levels[board.index]||0,stars);});shell.over({title:'Spectrum complete',score:stars,label:'stars',best:null,stats:[['Lab',`${board.index+1} / 18`],['Turns',board.moves],['Hints',board.hints]],line:stars===3?'you make everything look brighter 💜':'a little light goes a long way.',again:board.index<17?'Next lab':'Replay lab',onAgain:()=>start(Math.min(17,board.index+1)),onMenu:title});controls.hidden=true;}
const cellAt=p=>({x:Math.floor((p.x-fit.x)/(fit.scale*60)),y:Math.floor((p.y-fit.y)/(fit.scale*60))});
pointer(canvas,{down(p){if(shell.state!=='play'||menu||rays.won)return;const c=cellAt(p);selected=[c.x,c.y];const t=board.optics.find(t=>t.x===c.x&&t.y===c.y);drag=t?{id:t.id,...c}:null;},up(p){if(!drag||shell.state!=='play'||menu)return;const old=drag;drag=null;if(p.event.type==='pointercancel')return;const c=cellAt(p);if(c.x===old.x&&c.y===old.y)rotate(board,old.id);else moveOptic(board,old.id,c.x,c.y);changed();}});
keyboard({ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',' ':'turn',Enter:'turn',h:'hint',r:'reset'},{blocked:()=>shell.state!=='play'||menu||DEMO,down(k,e){if(k==='hint')return actHint();if(k==='reset')return start(board.index);if(k==='turn'){const t=board.optics.find(t=>t.x===selected[0]&&t.y===selected[1]);if(t&&!rays.won){rotate(board,t.id);changed();}return;}const ds={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]}[k];if(e.shiftKey){const t=board.optics.find(t=>t.x===selected[0]&&t.y===selected[1]);if(t&&moveOptic(board,t.id,t.x+ds[0],t.y+ds[1])){selected=[t.x,t.y];changed();}}else selected=selected.map((v,i)=>(v+ds[i]+7)%7);}});
function round(x,y,w,h,r=10){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function draw(){
  view.begin();const bg=ctx.createRadialGradient(view.w*.5,view.h*.5,30,view.w*.5,view.h*.5,view.h*.7);bg.addColorStop(0,'#211941');bg.addColorStop(1,'#080714');ctx.fillStyle=bg;ctx.fillRect(0,0,view.w,view.h);
  for(let i=0;i<65;i++){const x=(i*149+17)%view.w,y=(i*257+91)%view.h;ctx.fillStyle=`rgba(187,167,255,${.15+(i%4)*.04})`;ctx.fillRect(x,y,1.5,1.5);}
  const top=DEMO?12:100,bottom=DEMO?12:view.h<500?50:84;fit=view.fit(420,420,{top,bottom,left:12,right:12,maxScale:1.45});
  ctx.save();ctx.translate(fit.x,fit.y);ctx.scale(fit.scale,fit.scale);
  ctx.fillStyle='#100b24';ctx.strokeStyle='#655780';ctx.lineWidth=2;round(-8,-8,436,436,24);ctx.fill();ctx.stroke();
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){const a=selected[0]===x&&selected[1]===y&&shell.state==='play';ctx.fillStyle=a?'#2e2447':'#19132d';round(x*60+3,y*60+3,54,54,8);ctx.fill();ctx.fillStyle='#413654';ctx.beginPath();ctx.arc(x*60+30,y*60+30,2,0,Math.PI*2);ctx.fill();}
  ctx.lineCap='round';
  for(const s of rays.segments){const x=s.x*60+30,y=s.y*60+30,nx=s.nx*60+30,ny=s.ny*60+30;ctx.strokeStyle=colors[s.color];ctx.shadowColor=colors[s.color];ctx.shadowBlur=REDUCED?0:14;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(nx,ny);ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle='#fff9';ctx.lineWidth=1.4;ctx.stroke();if(!REDUCED){const p=(clock*1.5)%1;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x+(nx-x)*p,y+(ny-y)*p,2.2,0,Math.PI*2);ctx.fill();}}
  const def=LEVELS[board.index];
  for(const t of def.obstacles){const x=t.x*60+6,y=t.y*60+6;ctx.fillStyle='#30273d';ctx.strokeStyle='#514262';ctx.lineWidth=2;round(x,y,48,48,8);ctx.fill();ctx.stroke();ctx.strokeStyle='#796589';ctx.beginPath();ctx.moveTo(x+12,y+12);ctx.lineTo(x+36,y+36);ctx.moveTo(x+36,y+12);ctx.lineTo(x+12,y+36);ctx.stroke();}
  for(const t of def.sources){ctx.save();ctx.translate(t.x*60+30,t.y*60+30);ctx.rotate(t.dir*Math.PI/2);ctx.fillStyle='#171124';ctx.strokeStyle=colors[t.color];ctx.lineWidth=3;round(-21,-21,42,42,12);ctx.fill();ctx.stroke();ctx.fillStyle=colors[t.color];ctx.beginPath();ctx.moveTo(-6,-10);ctx.lineTo(10,0);ctx.lineTo(-6,10);ctx.closePath();ctx.fill();ctx.restore();}
  def.targets.forEach((t,i)=>{const x=t.x*60+30,y=t.y*60+30,hit=rays.received[i]===t.color;ctx.fillStyle=hit?colors[t.color]:'#0c0918';ctx.strokeStyle=colors[t.color];ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,21,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle=hit?'#170a36':'#726387';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.stroke();if(hit){ctx.strokeStyle='#170a36';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-7,y);ctx.lineTo(x-1,y+6);ctx.lineTo(x+8,y-6);ctx.stroke();}});
  for(const t of board.optics){const x=t.x*60+30,y=t.y*60+30;ctx.fillStyle='#392851';ctx.strokeStyle=t.movable?'#f7da8d':'#9583b8';ctx.lineWidth=2;if(t.movable)ctx.setLineDash([3,4]);ctx.beginPath();ctx.arc(x,y,22,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);if(t.type==='mirror'){ctx.strokeStyle='#e7f6ff';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x-14,y+(t.rot? -14:14));ctx.lineTo(x+14,y+(t.rot?14:-14));ctx.stroke();ctx.strokeStyle='#8ac6ef';ctx.lineWidth=1.5;ctx.stroke();}else{ctx.save();ctx.translate(x,y);ctx.rotate(t.rot*Math.PI*2/3);ctx.fillStyle='#d8e6ff';ctx.beginPath();ctx.moveTo(0,-17);ctx.lineTo(17,13);ctx.lineTo(-17,13);ctx.closePath();ctx.fill();ctx.fillStyle='#b6a2f9';ctx.beginPath();ctx.moveTo(0,-17);ctx.lineTo(0,13);ctx.lineTo(-17,13);ctx.closePath();ctx.fill();ctx.restore();}}
  ctx.restore();
}
createLoop({paused:()=>shell.state!=='play'||menu,update(dt){clock+=dt;if(DEMO){demoTick+=dt;if(demoTick>1.15&&!rays.won){hint(board);refresh();demoTick=0;}}if(rays.won){settle+=dt;if(settle>1.3)complete();}},render:draw}).start();
if(QUERY.has('qa'))window.__prism={get board(){return structuredClone(board);},get rays(){return rays;},get fit(){return fit;},get state(){return shell.state;}};
if(DEMO)start(9);else title();
