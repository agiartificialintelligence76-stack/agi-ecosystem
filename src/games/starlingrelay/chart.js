import { type, line, oval, panel, polygon, gradient, TAU } from '../kit/illustration.js';

export function chartStars(points, stage) {
  const stars=[];
  for(const [dx,dy] of points)if(!stars.some(s=>s.dx===dx&&s.dy===dy)){
    stars.push({dx,dy,x:245+dx*800,y:236+dy*720});
  }
  const order=points.map(([dx,dy])=>stars.findIndex(s=>s.dx===dx&&s.dy===dy));
  const decoys=[{x:105,y:305},{x:371,y:138},{x:330,y:323}];
  for(const star of decoys.slice(0,Math.min(3,stage)))if(stars.every(s=>Math.hypot(s.x-star.x,s.y-star.y)>34))stars.push(star);
  return {stars,order,cursor:order[0],ink:[],errors:0,age:0,idle:0,satellite:false,faded:0};
}
export function transit(ch) {
  return {x:52+((ch.age*51+35)%369),y:309+Math.sin(ch.age*1.15)*21};
}
export function tracePoint(ch,index) {
  if(index!==ch.order[ch.ink.length]){ch.errors++;ch.faded=.38;return false;}
  ch.ink.push(index);ch.cursor=index;ch.idle=0;return true;
}
function burst(c,x,y,r,color) {
  const points=Array.from({length:8},(_,i)=>{const rad=i%2?r*.27:r,a=i*Math.PI/4;return [x+Math.sin(a)*rad,y+Math.cos(a)*rad];});
  polygon(c,points,color);
}
export function drawChart(c,ch,title,sky){
  gradient(c,0,0,480,480,['#182846','#1c2642','#151c2d']);
  c.save();c.globalAlpha=.55;sky(c,0,0,480,400);c.restore();
  for(let x=18;x<475;x+=34)line(c,[[x,92],[x,365]],'#b7c4cd28');
  for(let y=92;y<367;y+=34)line(c,[[14,y],[466,y]],'#b7c4cd28');
  panel(c,12,12,456,70,'#17243ce6');type(c,title,28,34,24,'#f4dfaf','left','Georgia');
  type(c,'Trace the atlas in order',28,61,16,'#cddeeb','left');
  // The printed plate is a reference map, including repeated junctions.
  const inset=ch.order.map(i=>{const s=ch.stars[i];return [378+(s.x-240)*.36,48+(s.y-230)*.23];});
  line(c,inset,'#99acb9',1.6);const next=ch.ink.length;
  inset.forEach(([x,y],i)=>{oval(c,x,y,i===next?4:2.2,i===next?4:2.2,i===next?'#ffcd7f':'#d6dce4');});
  if(ch.ink.length>1)line(c,ch.ink.map(i=>[ch.stars[i].x,ch.stars[i].y]),'#f7ce88',3);
  ch.stars.forEach((s,i)=>{
    const active=i===ch.order[next],seen=ch.ink.includes(i);
    const guide=active&&(next===0||ch.idle>2.5);
    burst(c,s.x,s.y,seen?9:11,seen?'#f5cb85':'#d9efff');
    if(guide){const radius=14+3*Math.sin(ch.age*2);oval(c,s.x,s.y,radius,radius,null,'#f7cf82b0',1.4);}
    if(i===ch.cursor)oval(c,s.x,s.y,18,18,null,'#a9e1ee',1.5);
  });
  if(!ch.satellite){
    const s=transit(ch);
    for(const x of [171,317])line(c,[[x,288],[x,335]],'#d8a9e187',1.5);
    line(c,[[s.x-14,s.y+5],[s.x,s.y]],'#e9b5ffaa',2);burst(c,s.x,s.y,7,'#e4b3ff');
  }
  panel(c,12,375,456,92,'#172335f2');
  const msg=ch.faded?'Check the highlighted star on the atlas':ch.satellite?'Transit recorded':'Bonus · tag the comet between the bars';
  type(c,'Ink the plate   '+ch.ink.length+' / '+ch.order.length,240,400,22,'#f6dcaa','center','Georgia');
  type(c,msg,240,431,16,ch.faded?'#f9b699':'#c8d3ea');
  type(c,'Tap a star   /   ← → select, Space mark',240,452,14,'#b1c3d4');
}
