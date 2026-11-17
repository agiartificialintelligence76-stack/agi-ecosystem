import { painting } from '../kit/illustration.js';
const paintSmithy=painting(new URL('./clockwork-smithy.webp',import.meta.url).href);
const tau = Math.PI * 2;
function shape(c,points,fill,edge) {
  c.beginPath(); points.forEach(([x,y],i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.closePath(); c.fillStyle=fill;c.fill();
  if (edge) { c.strokeStyle=edge;c.lineWidth=1.5;c.stroke(); }
}
function circle(c,x,y,r,color) {
  c.beginPath(); c.arc(x,y,r,0,tau);c.fillStyle=color;c.fill();
}
function rail(c,points,color,width) {
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();
}
const steel=['#383846','#4d4453','#777584','#a7a296','#e6d8b1'];
const profiles=[
  [[-38,0],[-18,-4],[-11,-9],[22,-9],[39,-4],[42,1],[8,3],[-30,4]],
  [[-37,4],[-32,-1],[-7,-1],[6,-12],[17,-17],[32,-16],[36,-8],[28,-5],[26,-11],[18,-11],[2,5]],
  Array.from({length:16},(_,i)=>{const a=i*tau/16;return [Math.cos(a)*(i%2?9:21),Math.sin(a)*(i%2?9:13)-1];}),
  [[-36,3],[-30,-2],[-28,-9],[-25,-8],[-24,-2],[-18,-2],[-17,-12],[-14,-12],[-13,-2],[-7,-2],[-5,-16],[-2,-16],[-1,-2],[8,-2],[9,-10],[12,-10],[13,-2],[24,-2],[28,-7],[31,-7],[32,3]],
  Array.from({length:28},(_,i)=>{const a=i*tau/28;return [Math.cos(a)*(i%4<2?21:17),Math.sin(a)*(i%4<2?17:13)];}),
];
export function workshop(c,{time,order,hit,notes,heat,swings,steam,sparks}) {
  const g=c.createLinearGradient(0,33,0,201);g.addColorStop(0,'#191f35');g.addColorStop(.58,'#4a3040');g.addColorStop(1,'#823f35');c.fillStyle=g;c.fillRect(0,33,480,173);
  const glow=c.createRadialGradient(207,143,3,207,143,192);
  glow.addColorStop(0,'#ffb55caa');glow.addColorStop(.48,'#fb6c3b40');glow.addColorStop(1,'#ff603000');c.fillStyle=glow;c.fillRect(0,35,430,165);
  // Cast-iron roof trusses, glazed clerestory and suspended chains.
  for(let i=0;i<7;i++) {
    const x=i*76-47;shape(c,[[x,40],[x+9,40],[x+62,86],[x+54,87]],'#202338');
    rail(c,[[x,42],[x+52,84]],'#665662',1);
  }
  for(let row=0;row<4;row++)for(let col=0;col<12;col++){
    const x=col*43+(row%2)*21-20,y=75+row*25;
    c.fillStyle=(row*9+col*7)%3?'#503643':'#604047';c.fillRect(x,y,42,23);
    c.fillStyle='#8e5d581e';c.fillRect(x+2,y+1,35,2);
  }
  for(const x of [59,420]){
    c.fillStyle='#161b2c';c.fillRect(x-21,48,43,65);
    for(let i=0;i<3;i++)for(let j=0;j<3;j++){c.fillStyle=['#695568','#857084','#b59587'][(i+2*j)%3];c.fillRect(x-17+i*12,52+j*18,10,15);}
  }
  for(let side=0;side<2;side++){
    const x=side?450:18;for(let i=0;i<8;i++) {c.strokeStyle=i%2?'#9a7f76':'#514757';c.lineWidth=2;c.beginPath();c.ellipse(x,36+7*i,2+i%2,5,0,0,tau);c.stroke();}
  }
  paintSmithy(c,0,60,512,290,0,33,480,163);
  // Each firebrick follows the arch.
  c.fillStyle='#292337';c.beginPath();c.arc(203,145,65,Math.PI,tau);c.lineTo(268,175);c.lineTo(138,175);c.fill();
  for(let i=0;i<12;i++){const a=Math.PI+i*Math.PI/12,b=a+.245;
    shape(c,[[203+Math.cos(a)*69,145+Math.sin(a)*69],[203+Math.cos(b)*69,145+Math.sin(b)*69],
      [203+Math.cos(b)*79,145+Math.sin(b)*79],[203+Math.cos(a)*79,145+Math.sin(a)*79]],['#8f6461','#a27870','#b08773'][i%3]);}
  c.save();c.beginPath();c.arc(203,144,63,Math.PI,tau);c.lineTo(266,175);c.lineTo(140,175);c.clip();
  for(let layer=0;layer<3;layer++)for(let i=0;i<13;i++){
    const x=137+i*10,h=23+layer*3+(20+heat*.13)*(Math.sin(i*41+time*(2+layer)+layer)*.5+.5);
    c.fillStyle=['#ce4a37','#ff9b45','#ffe08b'][layer];c.beginPath();c.moveTo(x-12,176);c.quadraticCurveTo(x-13,167-h*.6,x+5,175-h+5*layer);c.quadraticCurveTo(x+1,161,x+14,176);c.fill();
  } c.restore();
  for(let i=0;i<21;i++) {
    const phase=(time*(.18+i%3*.06)+i*.41)%1,x=177+i*2.9+Math.sin(phase*5+i)*10;
    c.fillStyle='#ffd794';c.globalAlpha=.8*(1-phase);c.fillRect(x,150-phase*94,2,2+i%3);
  }c.globalAlpha=1;
  // Power hammer, flywheel and its reciprocating connecting rod.
  const wx=362,wy=92,angle=time*1.75;
  circle(c,wx,wy,47,'#242438');circle(c,wx,wy,42,'#8d7673');circle(c,wx,wy,37,'#343244');
  for(let i=0;i<7;i++){const a=angle+i*tau/7;rail(c,[[wx,wy],[wx+Math.cos(a)*37,wy+Math.sin(a)*37]],'#af8d78',5);}
  circle(c,wx,wy,10,'#c59879');circle(c,wx,wy,4,'#514454');
  const crank=[wx+Math.cos(angle)*26,wy+Math.sin(angle)*26];
  rail(c,[crank,[310,115+Math.sin(angle)*10]],'#292b3d',9);rail(c,[crank,[310,115+Math.sin(angle)*10]],'#a88c7a',4);circle(c,...crank,5,'#dcc5a4');
  // Inlay, bevel and elongated horn give the anvil a readable silhouette.
  shape(c,[[111,142],[176,142],[184,135],[305,135],[307,146],[290,160],[263,161],[255,172],[276,181],[275,190],[178,190],[179,182],[200,170],[196,157],[156,155]],steel[0],steel[1]);
  shape(c,[[112,142],[176,142],[184,134],[305,134],[303,142],[179,148]],steel[3]);
  rail(c,[[184,135],[304,135]],'#f1dfaf',2);
  shape(c,[[198,159],[259,159],[253,170],[203,170]],steel[1]);rail(c,[[186,184],[271,184]],steel[2],2);
  const ratio=hit/notes.length; c.save();c.translate(237,131);c.scale(.7+ratio*.4,.55+ratio*.5);
  shape(c,profiles[order],heat>73?'#ffe689':heat>40?'#ffac65':'#de7d71','#fff2b2');
  for(let k=0;k<Math.floor(ratio*5);k++)circle(c,-13+k*6,-1.5,1.5,'#9f5551');
  c.restore();
  for(let i=0;i<2;i++){
    c.save();c.translate(i?335:128,138);c.scale(i?-1:1,1);c.rotate(-.68+swings[i]*.68);
    rail(c,[[8,0],[96,0]],'#392d36',10);rail(c,[[8,-1],[96,-1]],'#bf8d63',6);
    for(let k=0;k<5;k++)rail(c,[[17+k*5,-3],[15+k*5,4]],'#684d45',2);
    shape(c,[[76,-20],[101,-19],[110,-10],[105,8],[78,12],[71,3]],i?'#eed598':'#b0cad0','#453d48');
    shape(c,[[76,-20],[101,-19],[106,-14],[83,-12],[76,-8]],'#fff0cf');
    c.restore();
  }
  if(steam>0)for(let i=0;i<13;i++){
    const p=(1-steam)*1.4+i/18;c.globalAlpha=Math.max(0,.33-p*.17);circle(c,224+Math.sin(i*4+p*4)*24,130-p*48,4+p*8,'#daf5eb');
  }c.globalAlpha=1;
  for(const p of sparks){c.strokeStyle=p.life>.25?'#fff1ab':'#ff9a5b';c.lineWidth=2;c.beginPath();c.moveTo(p.x,p.y+3);c.lineTo(p.x-p.vx*.023,p.y+3-p.vy*.018);c.stroke();}
}
