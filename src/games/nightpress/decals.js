import {oval,line,polygon} from '../kit/illustration.js';
import {DECALS} from './issues.js';
export const ink='#392738';
const white='#fff4d9';
export function rr(c,x,y,w,h,r,fill,stroke,width=1){if(w<=0||h<=0)return;c.beginPath();c.roundRect(x,y,w,h,Math.max(0,Math.min(r,w/2,h/2)));if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
export function text(c,label,x,y,size,color=ink,align='left',family='AK Sans',width=3000){c.fillStyle=color;c.textAlign=align;c.textBaseline='middle';c.font='800 '+Math.max(.0001,size)+'px "'+family+'",sans-serif';c.fillText(String(label),x,y,width);}
export function star(c,x,y,r,fill,outline,n=5){const pts=[];for(let i=0;i<n*2;i++){const a=i*Math.PI/n-Math.PI/2,rad=i%2?r*.42:r;pts.push([x+Math.cos(a)*rad,y+Math.sin(a)*rad]);}polygon(c,pts,fill,outline,r*.08);}
function path(c,points,fill,stroke,w=.035){c.beginPath();for(const [op,...a] of points){if(op==='M')c.moveTo(...a);if(op==='B')c.bezierCurveTo(...a);if(op==='Q')c.quadraticCurveTo(...a);if(op==='L')c.lineTo(...a);if(op==='Z')c.closePath();}if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.lineWidth=w;c.strokeStyle=stroke;c.stroke();}}
export function portrait(c,x,y,s,blink=false){
 c.save();c.translate(x,y);c.scale(s,s);
 path(c,[['M',-.91,.34],['Q',-.95,-.67,-.37,-.93],['Q',.40,-1.27,.81,-.62],['Q',.99,-.27,.96,.46],['Q',1.01,.84,.81,.94],['L',.67,.74],['L',.43,.93],['L',-.20,.70],['L',-.65,.95],['L',-.65,.68],['Q',-.96,.87,-.91,.34],['Z']],'#e8b65e',ink,.052);
 path(c,[['M',-.70,-.12],['Q',-.71,-.62,-.10,-.73],['Q',.57,-.89,.71,-.20],['L',.68,.34],['Q',.57,.70,.05,.83],['Q',-.40,.72,-.61,.43],['Z']],'#ffe2ba',ink,.043);
 for(const xx of [-.39,.40]){if(blink)line(c,[[xx-.15,.14],[xx,.08],[xx+.14,.14]],ink,.058);else{
  oval(c,xx,.13,.142,.187,'#fff4dc',ink,.030);oval(c,xx+.018,.146,.09,.139,'#83709f');oval(c,xx+.027,.153,.047,.11,ink);oval(c,xx+.055,.075,.036,.050,'#fffbe3');
  path(c,[['M',xx-.17,.055],['Q',xx-.02,-.11,xx+.16,.053]],null,ink,.058);}
  oval(c,xx,.389,.155,.056,'#efb39e');
 }
 path(c,[['M',-.14,.49],['Q',.08,.63,.23,.46]],null,ink,.037);
 path(c,[['M',-.82,-.18],['Q',-.72,-.93,-.09,-.89],['Q',.67,-.99,.82,-.14],['Q',.47,-.18,.43,-.56],['Q',.32,-.20,.12,-.11],['L',.12,-.43],['Q',-.08,-.12,-.36,-.07],['L',-.28,-.32],['Q',-.57,-.07,-.82,-.04],['Z']],'#f4cd76',ink,.041);
 path(c,[['M',-.51,-.78],['Q',-.30,-1.04,-.03,-.98],['Q',.02,-1.22,.15,-1.27]],null,'#81614c',.038);
 path(c,[['M',.50,-.66],['L',.86,-.97],['L',.86,-.58],['L',1.06,-.41],['L',.66,-.43],['Z']],'#a58ec3',ink,.04);oval(c,.69,-.59,.092,.097,'#e0c2e1',ink,.03);
 c.restore();
}
const loops=new Map();
function outlines(id){
 if(loops.has(id))return loops.get(id);
 const rows=DECALS[id].rows,solid=(x,y)=>rows[y]?.[x]&&'#E'.includes(rows[y][x]),edges=[];
 for(let y=0;y<rows.length;y++)for(let x=0;x<rows[y].length;x++)if(solid(x,y)){
  if(!solid(x,y-1))edges.push([[x,y],[x+1,y]]);if(!solid(x+1,y))edges.push([[x+1,y],[x+1,y+1]]);
  if(!solid(x,y+1))edges.push([[x+1,y+1],[x,y+1]]);if(!solid(x-1,y))edges.push([[x,y+1],[x,y]]);
 }
 const paths=[];while(edges.length){const [first,last]=edges.shift(),a=[first];let p=last;
  while(p[0]!==first[0]||p[1]!==first[1]){a.push(p);const i=edges.findIndex(q=>q[0][0]===p[0]&&q[0][1]===p[1]);if(i<0)break;p=edges.splice(i,1)[0][1];}paths.push(a);}
 loops.set(id,paths);return paths;
}
function contour(c,id){c.beginPath();for(const points of outlines(id)){const n=points.length;for(let j=0;j<n;j++){
 const cur=points[j],prev=points[(j+n-1)%n],next=points[(j+1)%n],dx=cur[0]+(prev[0]-cur[0])*.15,dy=cur[1]+(prev[1]-cur[1])*.15;
 if(!j)c.moveTo(dx,dy);else c.lineTo(dx,dy);c.quadraticCurveTo(...cur,cur[0]+(next[0]-cur[0])*.15,cur[1]+(next[1]-cur[1])*.15);
 }c.closePath();}}
function motif(c,id,w,h,t){
 const d=DECALS[id],cx=w/2,cy=h/2;
 if(id==='agi'){rr(c,-.15,1.55,2.3,1.80,.59,'#a68fb9',ink,.05);polygon(c,[[.55,1.59],[1,2.06],[1.45,1.59]],'#fff1d6',ink,.04);portrait(c,1,.76,.90);polygon(c,[[.82,1.8],[1,2.01],[1.15,1.80],[1.11,2.06],[1.26,2.37],[1.03,2.53],[.91,2.34],[.95,2.04]],'#e4c0c2',ink,.037);line(c,[[1.20,2.58],[1.85,2.58]],'#ead9db',.035);star(c,1.55,2.48,.17,'#ffe49c',ink);return;}
 if(id==='calico'){
  path(c,[['M',.18,1.52],['L',.19,.25],['L',1.04,1.01],['Q',1.45,.81,1.92,1.01],['L',2.74,.24],['L',2.80,1.73],['Q',2.90,2.57,1.48,2.84],['Q',.30,2.59,.18,1.52],['Z']],'#f5d7b1',ink,.065);
  polygon(c,[[.30,.54],[.37,1.1],[.78,.96]],'#db9796');polygon(c,[[2.63,.53],[2.52,1.05],[2.12,.99]],'#d8959a');
  oval(c,.63,1.48,.50,.42,'#dc9c69');oval(c,1.62,1.44,.42,.43,'#a49696');
  for(const x of [.55,1.53]){oval(c,x,1.51,.17,.18,'#a4b494',ink,.05);oval(c,x,1.51,.053,.135,ink);oval(c,x+.056,1.44,.045,.049,white);}
  polygon(c,[[1.02,1.83],[1.31,1.83],[1.15,2.05]],'#be7979',ink,.05);for(const dx of [-1,1])for(let j=0;j<3;j++)line(c,[[1.14+dx*.59,2.01+j*.085],[1.14+dx*1.06,1.88+j*.17]],ink,.025);
  return;}
 if(id==='moon'){oval(c,1.43,1.38,1.27,1.27,'#f8dc8c',ink,.055);oval(c,2.12,.97,.94,1.02,'#8d91a3',ink,.047);
  for(const [x,y,r] of [[.52,1.2,.15],[.83,2,.2],[1.26,2.32,.10],[.85,.53,.12]])oval(c,x,y,r,r,'#ddaf6b','#ba8e64',.022);
  star(c,2.3,2.38,.30,'#ffedaa',ink);return;}
 if(id==='tape'){rr(c,.11,.12,w-.22,h-.24,.22,'#bba9ce',ink,.05);rr(c,.29,.28,2.41,.82,.14,'#f7dfbf',ink,.045);
  for(const xx of [.78,2.20]){oval(c,xx,.69,.27,.27,'#72657b',ink,.038);oval(c,xx,.69,.12,.12,'#fff0bf');for(let j=0;j<6;j++){const a=j*1.047;line(c,[[xx+.14*Math.cos(a),.69+.14*Math.sin(a)],[xx+.20*Math.cos(a),.69+.20*Math.sin(a)]],white,.025);}}
  polygon(c,[[.44,1.66],[.66,1.32],[2.32,1.32],[2.52,1.66]],'#8a789b',ink,.04);return;}
 if(id==='ticket'||id==='stamp'){rr(c,.14,.13,w-.28,h-.27,.13,null,ink,.053);line(c,[[.24,.76],[w-.25,.76]],ink,.039);
  if(id==='ticket'){text(c,'ADMIT ONE',1.49,.46,.37,ink,'center','AK Mono');for(let j=0;j<15;j++)rr(c,.64+j*.099,1.04,.032+(j%3)*.009,.49,.01,ink);}
  else{polygon(c,[[.22,1.58],[.44,.96],[1.2,.82],[.72,1.55],[.60,1.22]],'#e9e4b8',ink,.042);text(c,'POST',1.05,.47,.43,ink,'center','AK Serif');}return;}
 if(id==='frame'||id==='arch'){for(let j=0;j<7;j++){rr(c,.23+j*.39,.22,.18,.12,.02,'#f3d9af',ink,.02);rr(c,.23+j*.39,h-.35,.18,.12,.02,'#f3d9af',ink,.02);}
  text(c,id==='frame'?'VIEW • 35':'IRIS • 12',w*.5,.69,.32,ink,'center','AK Mono');for(const x of [.43,w-.43])for(let j=1;j<h-1;j++)oval(c,x,j+.43,.13,.13,'#e7bd77',ink,.033);return;}
 if(id==='veil'||id==='film'){for(let j=-2;j<6;j++)line(c,[[j,0],[j-1.3,h]],'#fff6db99',.075);
  if(id==='veil')star(c,cx,cy,.76,'#ebedc639','#476e71',6);else for(let i=0;i<8;i++)rr(c,.12+i*.36,.19,.16,.11,.025,'#ffedc9aa');
  return;}
 if(id==='foil'||id==='prism'){const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'#d0a4bb');g.addColorStop(.29,'#ffdf91');g.addColorStop(.50,'#fcf1bf');g.addColorStop(.66,'#93b9b5');g.addColorStop(1,'#a18fa9');
  rr(c,.07,.07,w-.14,h-.14,.15,g,ink,.044);star(c,cx,cy,.33,'#f9e7b1',ink,id==='foil'?8:4);
  const k=.15+.16*Math.sin(t*1.4);line(c,[[k,.18],[k+.18,.04]],'#fff7ce',.036);return;}
 if(id==='blossom'){for(const [xx,yy,r] of [[1.45,.58,.44],[.60,1.38,.45],[1.43,2.05,.53],[2.45,.52,.41]]){for(let j=0;j<5;j++){const a=j*Math.PI*.4;oval(c,xx+Math.cos(a)*r*.51,yy+Math.sin(a)*r*.51,r*.46,r*.38,'#f9c4c6',ink,.025);}oval(c,xx,yy,.13,.13,'#d7a451',ink,.02);}return;}
 if(id==='bolt'){polygon(c,[[1.58,.14],[2.72,.14],[1.87,.85],[2.31,.88],[.53,1.86],[1.11,1.20],[.67,1.12]],'#ffe397',ink,.068);return;}
 path(c,[['M',.18,.77],['Q',.61,-.02,1.47,.53],['Q',2.10,.79,2.84,1.54]],null,'#6d4f76',.29);
 path(c,[['M',.18,.70],['Q',.62,-.07,1.47,.45],['Q',2.10,.70,2.84,1.46]],null,'#f6c0ce',.12);star(c,1.52,1.06,.31,'#f3dc95',ink);
}
export function decal(c,id,x,y,z,turn=0,t=0,{ghost=false,selected=false}={}){
 const d=DECALS[id],h=d.rows.length,w=d.rows[0].length;c.save();c.translate(x,y);c.scale(z,z);
 if(turn===1){c.translate(h,0);c.rotate(Math.PI/2);}if(turn===2){c.translate(w,h);c.rotate(Math.PI);}if(turn===3){c.translate(0,w);c.rotate(-Math.PI/2);}
 c.lineJoin='round';c.lineCap='round';if(ghost)c.globalAlpha*=.55;
 contour(c,id);if(!d.film){c.fillStyle=white;c.fill('evenodd');}c.strokeStyle=ink;c.lineWidth=.124;c.stroke();
 c.strokeStyle=d.film?'#e7f4d8':'#fff3db';c.lineWidth=.077;c.stroke();
 c.save();contour(c,id);c.clip('evenodd');c.fillStyle=d.film?d.color+'61':d.color;c.fillRect(0,0,w,h);
 motif(c,id,w,h,t);c.restore();
 if(selected){contour(c,id);c.lineWidth=.042;c.strokeStyle='#392738';c.setLineDash([.14,.12]);c.stroke();c.setLineDash([]);}
 c.restore();
}
