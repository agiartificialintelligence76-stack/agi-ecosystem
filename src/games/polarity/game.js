import './style.css';
import { createShell, el } from '../kit/shell.js';
import { fitCanvas } from '../kit/canvas.js';
import { createLoop } from '../kit/loop.js';
import { keyboard, pointer } from '../kit/input.js';
import { DEMO, SEED, REDUCED, QUERY } from '../kit/env.js';
import { createRun, step, flip, burst, autopilot, TAU } from './engine.js';

const shell = createShell({ game: 'polarity', name: 'POLARITY', root: document.getElementById('ak-root'),
  howTo: { intro:'Two magnetic rails. One tiny spark. Switch before the red gates reach you.', steps:[['Flip polarity','Tap to jump between the inner cyan rail and outer pink rail. Your spark stays at the top.'],['Read the circuit','Red barricades travel toward your spark. Their other rail is always open.'],['Build a chain','Catch diamonds to increase your multiplier and charge an EMP. Missing a diamond resets your chain.'],['Release an EMP','Eight diamonds charge a pulse that clears approaching gates. Three hits end a run.']], touch:[['Tap field or FLIP','Switch rail'],['EMP button','Clear nearby gates when charged']], keys:[['Space / ↑ / ↓','Switch rail'],['X','EMP pulse'],['P / Esc','Pause']] }, onRestart:()=>start(mode), onQuit:()=>title() });
const canvas = el('canvas',{role:'img','aria-label':'Two circular magnetic rails with approaching gates and a travelling energy spark'}); shell.stage.append(canvas);
const view = fitCanvas(canvas); const ctx=view.ctx;
const score=shell.chip('Score',0), chain=shell.chip('Chain','×1'), life=shell.chip('', '◆ ◆ ◆');
const flipBtn=el('button',{class:'po-flip',type:'button'},'⇅ FLIP'), pulseBtn=el('button',{class:'po-pulse',type:'button'},'EMP 0/8');
shell.stage.append(el('div','po-actions',flipBtn,pulseBtn));
let mode='endless', state=createRun(7), visualTime=0, finished=false, particles=[], attract=true;
const colors=['#69ffd5','#ff72ae','#ffc94e'];
function action(){if(shell.state==='play'&&!DEMO){shell.audio.unlock();flip(state);}}
flipBtn.addEventListener('click',action);pulseBtn.addEventListener('click',()=>burst(state));pointer(canvas,{down:action});
keyboard({Space:'flip',ArrowUp:'flip',ArrowDown:'flip',KeyX:'pulse'},{down:n=>n==='flip'?action():burst(state),blocked:()=>shell.state!=='play'||DEMO});
function start(m='endless'){mode=m;state=createRun(SEED||Math.floor(Math.random()*1e8),m);finished=false;attract=false;particles=[];shell.started();}
function title(){attract=true;state=createRun(11);shell.title({logo:[{text:'SWITCH THE',small:true},{text:'POLARITY',tone:'mint'}],tagline:'One touch. Two rails. Zero room for hesitation.',play:'Enter the circuit',onPlay:()=>start(),modes:[{label:'90-second overload',sub:'Survive the timed circuit',onClick:()=>start('sprint')}],best:shell.store.best(),extra:el('p','ak-tagline','tap. switch. survive. 💜')});}
function end(){finished=true;shell.over({score:state.score,title:state.phase==='won'?'Circuit complete':'Signal lost',label:'charge points',stats:[['Gates',state.gates],['Diamonds',state.collected],['Time',`${state.time.toFixed(1)}s`]],line:state.phase==='won'?'you kept my heart running.':'opposites attract. red gates do not.',onAgain:()=>start(mode),onMenu:title});}
function draw(){
  const g=view.begin(); const w=view.w,h=view.h;const top=DEMO?0:shell.bar.getBoundingClientRect().height;
  const bottom=DEMO?12:(h<520?18:104); const r=Math.max(70,Math.min(w*.43,(h-top-bottom)*.44)); const cx=w/2,cy=top+(h-top-bottom)/2;
  g.fillStyle='#080e24';g.fillRect(0,0,w,h);
  const glow=g.createRadialGradient(cx,cy,0,cx,cy,r*1.6);glow.addColorStop(0,'#27305b');glow.addColorStop(1,'#080e24');g.fillStyle=glow;g.fillRect(0,0,w,h);
  for(let i=0;i<45;i++){const x=((i*137.19)%w),y=((i*83.7)%h);g.globalAlpha=.2+.15*Math.sin(visualTime+i);g.fillStyle='#b3c9ff';g.fillRect(x,y,2,2);}g.globalAlpha=1;
  g.save();g.translate(cx,cy);
  for(let i=0;i<32;i++){const a=i*TAU/32-state.distance*.22;g.rotate(a);g.fillStyle=i%2?'#172740':'#223554';g.fillRect(r+9,-3,11,6);g.rotate(-a);}
  const radii=[r*.67,r];
  for(let lane=0;lane<2;lane++){g.beginPath();g.arc(0,0,radii[lane],0,TAU);g.strokeStyle=lane?'#78334e':'#1a675e';g.lineWidth=18;g.stroke();g.strokeStyle=lane?'#ff72ae':'#69ffd5';g.lineWidth=2;g.stroke();g.setLineDash([2,14]);g.lineDashOffset=state.distance*22;g.beginPath();g.arc(0,0,radii[lane]-7,0,TAU);g.strokeStyle='#d1eafa55';g.lineWidth=1;g.stroke();g.setLineDash([]);}
  for(let i=0;i<12;i++){const a=i*TAU/12-state.distance*.08;g.beginPath();g.moveTo(Math.cos(a)*r*.35,Math.sin(a)*r*.35);g.lineTo(Math.cos(a)*r*.56,Math.sin(a)*r*.56);g.strokeStyle='#6274b52a';g.lineWidth=2;g.stroke();}
  g.save();g.rotate(REDUCED?0:visualTime*.22);g.strokeStyle='#4d6688';g.lineWidth=2;g.strokeRect(-r*.18,-r*.18,r*.36,r*.36);g.rotate(Math.PI/4);g.strokeRect(-r*.18,-r*.18,r*.36,r*.36);g.restore();
  g.textAlign='center';g.fillStyle='#d4e8ff';g.font=`900 ${Math.max(15,r*.13)}px 'AK Display',sans-serif`;g.fillText('POLARITY',0,-5);g.font=`700 ${Math.max(11,r*.075)}px 'AK Mono',monospace`;g.fillStyle=colors[Math.floor(state.time/25)%3];g.fillText(state.combo>1?`CHAIN ×${Math.min(20,state.combo)}`:mode==='sprint'?`${Math.max(0,Math.ceil(90-state.time))} SEC`:'KEEP THE SIGNAL',0,19);
  for(const o of state.objects){const ahead=o.at-state.distance;if(o.done||ahead<-.1||ahead>TAU-.2)continue;const a=-Math.PI/2+ahead,rr=radii[o.lane];g.save();g.rotate(a);g.translate(rr,0);if(o.kind==='gate'){g.fillStyle='#ff496b';g.shadowColor='#ff496b';g.shadowBlur=REDUCED?0:12;g.fillRect(-15,-7,30,14);g.shadowBlur=0;g.strokeStyle='#200a28';g.lineWidth=3;g.strokeRect(-15,-7,30,14);g.fillStyle='#fff1da';g.fillRect(-10,-2,20,4);}else{g.rotate(visualTime);g.fillStyle='#ffdf69';g.shadowColor='#ffdf69';g.shadowBlur=10;g.beginPath();g.moveTo(0,-8);g.lineTo(7,0);g.lineTo(0,8);g.lineTo(-7,0);g.closePath();g.fill();g.shadowBlur=0;}g.restore();}
  const py=-(radii[0]+(radii[1]-radii[0])*state.radial);
  if(state.pulse>0){g.beginPath();g.arc(0,py,(1-state.pulse)*r*2,0,TAU);g.strokeStyle=`rgba(100,255,214,${state.pulse})`;g.lineWidth=8*state.pulse;g.stroke();}
  g.globalAlpha=state.shield>0&&!REDUCED ? .6+.4*Math.sin(visualTime*25) : 1;g.shadowColor=state.lane?'#ff72ae':'#69ffd5';g.shadowBlur=22;g.fillStyle=state.lane?'#ff72ae':'#69ffd5';g.beginPath();g.arc(0,py,14,0,TAU);g.fill();g.shadowBlur=0;g.strokeStyle='#eefaff';g.lineWidth=3;g.stroke();g.globalAlpha=1;
  g.fillStyle='#10152b';g.fillRect(-6,py-3,3,4);g.fillRect(3,py-3,3,4);g.beginPath();g.arc(0,py+1,5,.2,Math.PI-.2);g.lineWidth=2;g.strokeStyle='#10152b';g.stroke();
  for(const p of particles){g.globalAlpha=p.life;g.fillStyle=p.color;g.fillRect(p.x,p.y,4,4);}g.globalAlpha=1;g.restore();
  if(state.time<6&&!attract&&!DEMO){g.font="700 12px 'AK Mono',monospace";g.textAlign='center';g.fillStyle='#c4d4f7';g.fillText('TAP TO SWITCH RAILS · AVOID RED',cx,Math.min(h-bottom+12,cy+r+32));}
}
createLoop({paused:()=>!attract&&shell.state!=='play',update(dt){if(attract||DEMO)autopilot(state);step(state,dt);for(const e of state.events.splice(0)){if(e.type==='spark'){if(!attract)shell.audio.sfx('pop',{pitch:1+state.combo*.03});for(let i=0;i<(REDUCED?3:9);i++)particles.push({x:0,y:-Math.min(view.w*.43,view.h*.36)*(.67+.33*state.radial),vx:Math.sin(i*3)*70,vy:Math.cos(i*3)*70,life:1,color:'#ffdf69'});}if(e.type==='flip'&&!attract)shell.audio.sfx('select');if(e.type==='hit'&&!attract){shell.audio.sfx('error');shell.haptic(25);}if(e.type==='burst'&&!attract)shell.audio.sfx('win');}if(state.phase!=='play'){if(attract||DEMO)state=createRun(state.seed+1);else if(!finished)end();}score.set(state.score);chain.set(`×${Math.max(1,state.combo)}`);life.set('◆'.repeat(state.hp)+'◇'.repeat(3-state.hp));pulseBtn.disabled=state.charge<8;pulseBtn.textContent=state.charge===8?'⚡ EMP READY':`EMP ${state.charge}/8`;},render(a,dt){visualTime+=dt;for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt*2;}particles=particles.filter(p=>p.life>0);draw();}}).start();
if(QUERY.has('qa'))window.__polarity={get state(){return Object.freeze(structuredClone({...state,random:undefined}));},get shell(){return shell.state;}};
if(DEMO){start();state=createRun(SEED||7);}else title();

