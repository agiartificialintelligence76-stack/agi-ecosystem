import { painting } from '../kit/illustration.js';
const paintMarsh=painting(new URL('./field-guide.webp',import.meta.url).href);
const habitats=[
  {water:'#74978d',light:'#d9dfb5',shade:'#bac89f',grass:'#72917e',flower:'#fff2bc'},
  {water:'#69aab0',light:'#d1dcc0',shade:'#b0c6a9',grass:'#628477',flower:'#f8c3b0'},
  {water:'#6e9dad',light:'#e4d6a1',shade:'#cbc496',grass:'#7a916a',flower:'#eec88b'},
  {water:'#759cb2',light:'#d2d3cb',shade:'#b1bcbc',grass:'#7e8d85',flower:'#d4b5c5'},
  {water:'#8796a6',light:'#e5c699',shade:'#c9b389',grass:'#9b8667',flower:'#dca483'},
  {water:'#86adbe',light:'#e0e9dd',shade:'#c5d5d0',grass:'#92a9a2',flower:'#f4f2df'},
];
const TAU=Math.PI*2;
function oval(c,x,y,rx,ry,color,rot=0){
  c.beginPath();c.ellipse(x,y,rx,ry,rot,0,TAU);c.fillStyle=color;c.fill();
}
function blade(c,x,y,h,tilt,color) {
  c.beginPath();c.moveTo(x-1,y);c.quadraticCurveTo(x+tilt*.2,y-h*.6,x+tilt,y-h);
  c.quadraticCurveTo(x+tilt*.45,y-h*.4,x+2,y);c.fillStyle=color;c.fill();
}
export function folio(c,stage,t){
  const p=habitats[stage];const fade=c.createLinearGradient(0,0,480,480);fade.addColorStop(0,'#f0e8c9');fade.addColorStop(.6,'#d9d9be');fade.addColorStop(1,'#bebda4');c.fillStyle=fade;c.fillRect(0,0,480,480);
  paintMarsh(c,0,0,480,480);
  c.fillStyle='#f4e9c7de';c.fillRect(0,0,480,61);
  for(let i=0;i<153;i++){c.fillStyle=i%3?'#885e3717':'#fff9df60';c.fillRect((i*129.5)%480,(i*107.9)%480,3+i%11,.85);}
  // Ink-wash margins and tall plants bind the chessboard to its habitat.
  for(let side=0;side<2;side++){c.save();c.translate(side?480:0,0);c.scale(side?-1:1,1);
    for(let i=0;i<29;i++){const x=(i*19)%64,y=95+(i*67)%337,h=12+(i*11)%60;
      blade(c,x,y,h,Math.sin(i*7+t*.55)*7,p.grass);
      if(i%4===0){const xx=x+Math.sin(i*7+t*.55)*7;oval(c,xx,y-h,3,7,p.flower,-.2);}}
    c.restore();}
}
export function soil(c,x,y,size,index,stage,t,pool,high){
  const p=habitats[stage],lo=x-size/2,top=y-size/2,wet=pool && high;
  c.fillStyle=wet?p.water:(index%2?p.shade:p.light);c.fillRect(lo,top,size,size);
  c.save();c.globalAlpha=wet?.12:.24;
  paintMarsh(c,x-35,y-35,75,75,lo,top,size,size);c.restore();
  c.save();c.beginPath();c.rect(lo,top,size,size);c.clip();
  for(let i=0;i<6;i++){
    const xx=lo+((index*13+i*37)%size),yy=top+((i*23+index*31)%size);
    if(wet){c.beginPath();c.moveTo(xx-10,yy);c.quadraticCurveTo(xx,yy-3+Math.sin(t*2+i)*2,xx+11,yy);c.strokeStyle='#e3eee3a0';c.lineWidth=1.5;c.stroke();}
    else if(pool){oval(c,xx,yy,7+i%3,2.8,'#7e968556',-.1);oval(c,xx-1,yy-1,5,1.4,'#dedcbe');}
    else{oval(c,xx,yy,10+i%5,4,p.grass+'19',-.2);blade(c,xx,yy,3+i%6,2,p.grass+'82');}
  }c.restore();
  c.strokeStyle=wet?'#547a8140':'#5c62482b';c.lineWidth=1;c.strokeRect(lo+.5,top+.5,size-1,size-1);
  if(pool){c.fillStyle=high?'#426e79':'#718b83';c.fillRect(lo+3,top+3,17,12);c.beginPath();c.moveTo(lo+5,top+10);c.quadraticCurveTo(lo+8,top+6,lo+11,top+10);c.quadraticCurveTo(lo+14,top+13,lo+18,top+9);c.strokeStyle='#ebf2da';c.stroke();}
}
export function fledgling(c,x,y,t){
  const bob=Math.sin(t*3)*1.4;
  oval(c,x,y+8,16,6,'#92744b');oval(c,x,y+7,11,3,'#bf9760');
  oval(c,x,y+bob,8.5,7.5,'#f1cb71');oval(c,x+4,y-4+bob,6,6,'#f5dc8a');oval(c,x+6,y-5+bob,1.4,1.5,'#384843');
  c.fillStyle='#ca774d';c.beginPath();c.moveTo(x+9,y-4+bob);c.lineTo(x+15,y-2+bob);c.lineTo(x+9,y+bob);c.fill();
}
