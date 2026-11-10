import './style.css';
import { createShell,el } from '../kit/shell.js';
import { fitCanvas } from '../kit/canvas.js';
import { createLoop } from '../kit/loop.js';
import { pointer,keyboard } from '../kit/input.js';
import { DEMO,SEED,REDUCED,QUERY } from '../kit/env.js';
import { createDive,step,sonar,pilot,upgrades,WIDTH,HEIGHT,DOCK,atDock } from './engine.js';
const shell=createShell({game:'deepdive',name:'DEEP DIVE',root:document.getElementById('ak-root'),howTo:{intro:'Take her little salvage sub below the signal. Bring what you find back to the surface.',steps:[['Explore','Steer through three underwater zones. Touch a relic to take it aboard. Cargo makes the sub heavier.'],['Surface before empty','Return to the mint docking buoy to bank your hold and refill oxygen. An empty tank loses only the unbanked hold.'],['Ping the ruins','SONAR reveals hidden doubled relics nearby, but uses three oxygen. Jellyfish drain oxygen; rocks block the way.'],['Improve your rig','Bank 150, 500 and 1,200 lifetime salvage to unlock larger tanks, cargo holds and faster fins. Each expedition lasts 150 seconds.']],touch:[['Drag anywhere','Steer with a floating thumbstick'],['SONAR','Reveal nearby hidden relics']],keys:[['WASD / arrows','Steer'],['Space','Sonar'],['P / Esc','Pause']]},onRestart:()=>start(),onQuit:()=>title(),onPause:()=>{stick=null;keys?.clear();}});
const canvas=el('canvas',{role:'img','aria-label':'A yellow salvage submarine exploring glowing underwater ruins'});shell.stage.append(canvas);const view=fitCanvas(canvas),g=view.ctx;
const oxygen=shell.chip('O₂','100%'),cargo=shell.chip('Hold','0/5'),bank=shell.chip('Banked',0);
const sonarBtn=el('button',{type:'button',class:'dd-sonar'},'◎ SONAR'),note=el('div','dd-note','Collect relics · return to the docking buoy');shell.stage.append(el('div','dd-controls',sonarBtn),note);
let s=createDive(7),attract=true,done=false,t=0,camera={x:450,y:320,scale:1},stick=null,trail=[],floats=[];

const keys=keyboard({KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',Space:'sonar'},{down:n=>{if(n==='sonar')sonar(s);},blocked:()=>shell.state!=='play'||DEMO});
pointer(canvas,{down(p){if(shell.state==='play'&&!DEMO){shell.audio.unlock();stick={id:p.id,x:p.x,y:p.y,dx:0,dy:0};}},move(p){if(stick?.id===p.id){stick.dx=p.x-stick.x;stick.dy=p.y-stick.y;}},up(p){if(stick?.id===p.id)stick=null;}});
sonarBtn.addEventListener('click',()=>sonar(s));
function start(){const totalStart=Number(shell.store.read().salvage)||0;s=createDive(SEED||Math.floor(Math.random()*1e8),totalStart);attract=false;done=false;stick=null;trail=[];floats=[];shell.started();}
function title(){attract=true;s=createDive(19,500);s.y=400;const total=Number(shell.store.read().salvage)||0,gear=upgrades(total);shell.title({logo:['DEEP',{text:'DIVE',tone:'mint'}],tagline:'The signal ends. Your little adventure begins.',play:'Launch the sub',onPlay:start,best:shell.store.best(),bestLabel:'Best haul',extra:el('p','dd-gear',`RIG ${gear.level+1} · HOLD ${gear.capacity} · ${gear.tank} OXYGEN`) });}
function end(){done=true;shell.over({score:s.banked,title:s.phase==='complete'?'Back from the deep':'Rescue buoy deployed',label:'salvage safely banked',stats:[['Relic deliveries',s.deliveries],['Deepest',`${s.deepest} m`],['Lost hold',s.hold.length]],line:s.phase==='complete'?'look at all the little things we saved.':'the relics can wait. you come home first.',onAgain:start,onMenu:title});}
function round(x,y,w,h,r,fill,stroke){g.beginPath();g.roundRect(x,y,w,h,r);g.fillStyle=fill;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=3;g.stroke();}}
function draw(){
 view.begin();const w=view.w,h=view.h,bar=DEMO?0:shell.bar.getBoundingClientRect().height;camera.scale=Math.min(1.15,Math.max(.52,Math.min(w/650,(h-bar)/600)));const visibleW=w/camera.scale,visibleH=(h-bar)/camera.scale;
 camera.x=Math.max(visibleW/2,Math.min(WIDTH-visibleW/2,s.x));if(visibleW>WIDTH)camera.x=WIDTH/2;
 camera.y=Math.max(visibleH/2-20,Math.min(HEIGHT-visibleH/2,s.y+80));
 const left=camera.x-visibleW/2,top=camera.y-visibleH/2;
 const bg=g.createLinearGradient(0,0,0,h);bg.addColorStop(0,s.y<450?'#08617a':'#05364f');bg.addColorStop(1,s.y<750?'#032c46':'#07172f');g.fillStyle=bg;g.fillRect(0,0,w,h);
 if(!REDUCED){for(let i=0;i<5;i++){g.fillStyle='#7ff3dc07';g.beginPath();g.moveTo(w*(i/4)-70,0);g.lineTo(w*(i/4)+40,0);g.lineTo(w*(i/4)+200+Math.sin(t*.2)*30,h);g.lineTo(w*(i/4)+50,h);g.fill();}}
 g.save();g.translate(w/2,bar+(h-bar)/2);g.scale(camera.scale,camera.scale);g.translate(-camera.x,-camera.y);
 for(let i=0;i<80;i++){const x=(i*193.8)%WIDTH,y=(i*119.6)%HEIGHT;if(y<top-100||y>top+visibleH+100)continue;g.strokeStyle='#8ee3df24';g.lineWidth=1;g.beginPath();g.arc(x+Math.sin(t+i)*6,y-((t*8+i*11)%80),2+i%3,0,Math.PI*2);g.stroke();}
 // Chunky cliff edges and tiny luminous plants make each depth feel inhabited.
 for(let side=0;side<2;side++){g.fillStyle='#062236';g.beginPath();g.moveTo(side?WIDTH:0,0);for(let y=0;y<=HEIGHT;y+=60){const x=(side?WIDTH:0)+(side?-1:1)*(20+Math.sin(y*.037)*18+Math.cos(y*.081)*12);g.lineTo(x,y);}g.lineTo(side?WIDTH+100:-100,HEIGHT);g.lineTo(side?WIDTH+100:-100,0);g.fill();}
 for(let i=0;i<30;i++){const x=30+(i*221)%840,y=260+(i*89)%1240;g.strokeStyle=i%2?'#59d5b2':'#bd6ce8';g.lineWidth=5;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x-12,y-20,x+Math.sin(t+i)*8,y-45);g.moveTo(x,y-10);g.lineTo(x+18,y-28);g.stroke();}
 // The wreck corridor is a recognizable place, not an endless random field.
 g.save();g.translate(450,800);g.rotate(-.18);round(-145,-55,290,110,32,'#173d50','#36727b');for(let i=0;i<5;i++)round(-110+i*48,-28,26,37,8,'#092438','#4b8c91');g.fillStyle='#091e30';g.fillRect(-8,-62,28,125);g.restore();
 for(const rock of s.rocks){g.fillStyle='#123749';g.beginPath();for(let i=0;i<7;i++){const a=i*Math.PI*2/7,rr=rock.r*(.9+(i%2)*.15);const x=rock.x+Math.cos(a)*rr,y=rock.y+Math.sin(a)*rr;if(!i)g.moveTo(x,y);else g.lineTo(x,y);}g.closePath();g.fill();g.strokeStyle='#2b6272';g.lineWidth=3;g.stroke();}
 round(DOCK.x-70,35,140,27,9,'#5ce8c1','#022d3c');g.strokeStyle='#8cffe0';g.lineWidth=2;g.setLineDash([5,5]);g.beginPath();g.arc(DOCK.x,DOCK.y,64,0,Math.PI*2);g.stroke();g.setLineDash([]);g.textAlign='center';g.fillStyle='#d8fff3';g.font="900 16px 'AK Display',sans-serif";g.fillText('SURFACE DOCK',DOCK.x,26);
 for(const l of s.loot){if(l.taken||!l.revealed)continue;g.save();g.translate(l.x,l.y+Math.sin(t*2+l.id)*3);g.rotate(l.id*.3);g.shadowColor=l.rare?'#e7a8ff':'#ffda6c';g.shadowBlur=REDUCED?0:15;g.fillStyle=l.rare?'#c990ff':'#ffce62';g.strokeStyle='#5d411e';g.lineWidth=3;g.beginPath();g.moveTo(0,-12);g.lineTo(11,-3);g.lineTo(7,11);g.lineTo(-8,9);g.lineTo(-11,-4);g.closePath();g.fill();g.stroke();g.shadowBlur=0;g.fillStyle='#fff5bf';g.fillRect(-3,-6,4,7);g.restore();}
 for(const jelly of s.jellies){const x=jelly.x+Math.sin(s.time*.7+jelly.phase)*42;g.fillStyle='#e875b98c';g.beginPath();g.arc(x,jelly.y,21,Math.PI,0);g.quadraticCurveTo(x+15,jelly.y+8,x,jelly.y+5);g.quadraticCurveTo(x-15,jelly.y+8,x-21,jelly.y);g.fill();g.strokeStyle='#f2afd5';g.lineWidth=2;for(let i=-1;i<=1;i++){g.beginPath();g.moveTo(x+i*11,jelly.y+3);g.quadraticCurveTo(x+i*12+Math.sin(t*3+i)*8,jelly.y+22,x+i*10,jelly.y+32);g.stroke();}}
 if(s.scan>0){g.beginPath();g.arc(s.x,s.y,(1-s.scan)*400,0,Math.PI*2);g.strokeStyle=`rgba(100,255,216,${s.scan})`;g.lineWidth=4;g.stroke();}
 for(const p of trail){g.globalAlpha=p.life*.45;g.strokeStyle='#a7e8e2';g.lineWidth=2;g.beginPath();g.arc(p.x,p.y,4+(1-p.life)*9,0,Math.PI*2);g.stroke();}g.globalAlpha=1;
 g.save();g.translate(s.x,s.y);g.scale(s.facing,1);g.rotate(s.vy*.001);if(s.invulnerable>0&&!REDUCED)g.globalAlpha=.55+.45*Math.sin(t*25);
 // Her salvage pod: yellow hull, clear porthole, periscope, fins and turning propeller.
 round(-29,-16,58,32,17,'#ffd267','#765437');round(-7,-25,18,11,4,'#ffbb50','#765437');round(4,-33,7,12,2,'#ffd267');round(4,-35,16,6,2,'#fff1a1');round(-37,-7,11,14,3,'#e78947');g.fillStyle='#dc813e';g.fillRect(-27,10,14,12);g.fillRect(-27,-22,14,10);
 g.beginPath();g.arc(13,0,11,0,Math.PI*2);g.fillStyle='#4dc9dd';g.fill();g.strokeStyle='#fff1b1';g.lineWidth=4;g.stroke();g.fillStyle='#dbffff';g.beginPath();g.arc(15,-3,3,0,Math.PI*2);g.fill();g.strokeStyle='#a3ece5';g.lineWidth=4;g.beginPath();g.moveTo(-41,-9*Math.cos(t*20));g.lineTo(-41,9*Math.cos(t*20));g.stroke();g.restore();
 for(const f of floats){g.globalAlpha=f.life;g.textAlign='center';g.fillStyle='#fff0a7';g.font="900 18px 'AK Display',sans-serif";g.fillText(f.text,f.x,f.y-(1-f.life)*35);}g.globalAlpha=1;g.restore();
 // A dock compass is always visible when deep: it points home without revealing every treasure.
 if(!attract&&s.y>300){const angle=Math.atan2(DOCK.y-s.y,DOCK.x-s.x),x=36,y=bar+74;g.save();g.translate(x,y);g.fillStyle='#032237d9';g.beginPath();g.arc(0,0,24,0,Math.PI*2);g.fill();g.rotate(angle);g.fillStyle='#73f2cb';g.beginPath();g.moveTo(17,0);g.lineTo(-8,-8);g.lineTo(-4,0);g.lineTo(-8,8);g.closePath();g.fill();g.restore();g.textAlign='center';g.fillStyle='#a4e8df';g.font="700 9px 'AK Mono',monospace";g.fillText('DOCK',36,y+39);}
 if(stick&&!DEMO){g.strokeStyle='#a0ffdf77';g.lineWidth=2;g.beginPath();g.arc(stick.x,stick.y,42,0,Math.PI*2);g.stroke();const d=Math.max(1,Math.hypot(stick.dx,stick.dy)/35);g.fillStyle='#82f8d8aa';g.beginPath();g.arc(stick.x+stick.dx/d,stick.y+stick.dy/d,15,0,Math.PI*2);g.fill();}
 if(!attract&&!DEMO){g.textAlign='left';g.fillStyle='#93d6d4';g.font="700 11px 'AK Mono',monospace";g.fillText(s.y<500?'01 / CORAL GARDEN':s.y<1000?'02 / WRECK CORRIDOR':'03 / THE QUIET DEEP',16,h-20);}
}
createLoop({paused:()=>!attract&&shell.state!=='play',update(dt){let input;if(attract||DEMO){input=pilot(s);if(s.time%9<dt)sonar(s);}else if(stick){const n=Math.max(36,Math.hypot(stick.dx,stick.dy));input={x:stick.dx/n,y:stick.dy/n};}else input={x:Number(keys.held('right'))-Number(keys.held('left')),y:Number(keys.held('down'))-Number(keys.held('up'))};step(s,dt,input);
 for(const e of s.events.splice(0)){if(e.type==='loot'){floats.push({x:s.x,y:s.y-25,text:'RELIC ABOARD',life:1});if(!attract)shell.audio.sfx('pop');}if(e.type==='bank'){floats.push({x:s.x,y:s.y+35,text:`+${e.amount} BANKED`,life:1});if(!attract){shell.audio.sfx('win');shell.store.update(d=>{d.salvage=(Number(d.salvage)||0)+e.amount;});}}if(e.type==='sonar'&&!attract)shell.audio.sfx('select');if(e.type==='sting'&&!attract){shell.audio.sfx('error');shell.haptic(20);}}
 if(s.phase!=='play'){if(attract||DEMO){s=createDive(s.seed+1,500);}else if(!done)end();}
 oxygen.set(`${Math.ceil(s.oxygen/s.gear.tank*100)}%`);cargo.set(`${s.hold.length}/${s.gear.capacity}`);bank.set(s.banked);sonarBtn.disabled=s.sonar>0||s.oxygen<4;sonarBtn.textContent=s.sonar>0?`${Math.ceil(s.sonar)}s`:'◎ SONAR';note.textContent=atDock(s)?'DOCKED · Oxygen refilling':s.oxygen<35?'LOW OXYGEN · Follow the dock arrow':s.hold.length===s.gear.capacity?'HOLD FULL · Bring it home':`Dive ${Math.ceil(150-s.time)}s · drag to steer`;
 },render(a,dt){t+=dt;if(Math.hypot(s.vx,s.vy)>10&&Math.floor(t*12)!==Math.floor((t-dt)*12))trail.push({x:s.x-s.facing*40,y:s.y,life:1});for(const p of trail){p.y-=dt*9;p.life-=dt*.5;}trail=trail.filter(p=>p.life>0).slice(-55);for(const f of floats)f.life-=dt*.6;floats=floats.filter(f=>f.life>0);draw();}}).start();
if(QUERY.has('qa'))window.__deepdive={get state(){return Object.freeze(structuredClone(s));},get shell(){return shell.state;},get camera(){return Object.freeze({...camera});}};
if(DEMO){start();s=createDive(SEED||7,500);s.y=310;s.x=340;}else title();

