import { painting } from '../kit/illustration.js';
const paintHarbor=painting(new URL('./night-harbor.webp',import.meta.url).href);
const TAU=Math.PI*2;
const skies=[['#112a3d','#285668'],['#1b303e','#386668'],['#182d45','#42657a'],['#342c44','#70495c'],['#32384b','#8b786c']];
function silhouette(c,p,fill){
  c.fillStyle=fill;c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();
}
export function harborSea(c,time,stage,map,pixel){
  const g=c.createLinearGradient(0,0,480,480),[night,foam]=skies[stage];g.addColorStop(0,night);g.addColorStop(1,foam);c.fillStyle=g;c.fillRect(0,0,480,480);
  paintHarbor(c,0,0,480,480);
  for(let i=0;i<111;i++){
    const x=(i*114+Math.sin(time*.33+i)*2)%487,y=(i*67.4)%476;
    c.strokeStyle=i%6?'#acc5c51d':'#f5c78c55';c.lineWidth=i%5?1:2;c.beginPath();c.moveTo(x-8,y);c.quadraticCurveTo(x-4,y+2,x,y);c.quadraticCurveTo(x+4,y-1,x+8,y);c.stroke();
  }
  for(let i=0;i<8;i++){
    const yy=80+i*44;const x=(i%2?468:9)+Math.sin(time*.5+i)*2;
    c.save();c.translate(x,yy);c.rotate(i%2?.22:-.38);
    silhouette(c,[[-6,-17],[2,-23],[8,-14],[7,14],[1,20],[-6,13]],'#191e2c');
    silhouette(c,[[-4,-12],[1,-17],[5,-10],[4,12],[-3,11]],i%2?'#aa7764':'#6b8f96');c.fillStyle='#eac59b';c.fillRect(-4,-3,9,4);c.restore();
  }
  map.forEach((row,y)=>[...row].forEach((tile,x)=>{
    if(tile!=='#')return;const [a,b]=pixel([x,y]),odd=(x+y)%3;
    if(odd===0){ // floating glass lamps and their shifting reflections
      const bob=Math.sin(time*1.3+x*.7+y)*1.5;c.fillStyle='#d3b78144';
      for(let j=0;j<4;j++)c.fillRect(a-3-j,b+4+j*4+(j%2),6+j*2,1);
      silhouette(c,[[a-7,b+bob],[a+7,b+bob],[a+4,b+4+bob],[a-4,b+4+bob]],'#ad8062');c.fillStyle='#ffe0a1';c.fillRect(a-3,b-6+bob,6,6);
    }else if(odd===1){
      for(let j=0;j<2;j++){c.beginPath();c.ellipse(a+Math.sin(time*.4+j)*2,b+3*j,8+j*7,2+j*2,0,.18,Math.PI*1.75);c.strokeStyle='#87b5ba66';c.lineWidth=1;c.stroke();}
    }
  }));
}
export function butterfly(c,x,y,t,scale=1){
  c.save();c.translate(x,y);c.scale(scale,scale);
  const w=8+4*Math.sin(t*14);silhouette(c,[[-1,1],[-w,-8],[-w-3,-5],[-w+1,2],[-5,5],[0,3]],'#ace6da');
  silhouette(c,[[1,1],[w,-8],[w+3,-5],[w-1,2],[5,5],[0,3]],'#e4c2e8');
  c.strokeStyle='#ffe1a5';c.lineWidth=2;c.beginPath();c.moveTo(0,5);c.lineTo(0,-5);c.stroke();c.restore();
}
export function harborPennants(c,t,stage){
  c.save(); c.beginPath();c.rect(0,41,480,26);c.clip();
  c.beginPath();c.moveTo(0,44);c.quadraticCurveTo(138,65,251,46);c.quadraticCurveTo(365,64,480,44);c.strokeStyle='#243444';c.lineWidth=2;c.stroke();
  for(let i=0;i<19;i++){const x=i*27+5,y=46+Math.sin((x%240)/240*Math.PI)*8;
    silhouette(c,[[x,y],[x+9,y+.3],[x+6+Math.sin(t*2+i)*2,y+9]],['#e6ba82','#ba7771','#91b9ac'][(i+stage)%3]);
  }
  c.restore();
}
