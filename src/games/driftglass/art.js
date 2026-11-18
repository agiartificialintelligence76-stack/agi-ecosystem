import {oval,polygon,line} from '../kit/illustration.js';
export {oval,polygon,line};
export const ink='#402940';
export function box(c,x,y,w,h,r,fill,stroke,lw=1){
 if(w<=0||h<=0)return;c.beginPath();c.roundRect(x,y,w,h,Math.min(r,w*.5,h*.5));if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}
}
export function label(c,text,x,y,size,color,align='left',family='AK Sans',max=10000){
 c.font='800 '+size+'px "'+family+'",sans-serif';c.textAlign=align;c.textBaseline='middle';c.fillStyle=color;c.fillText(text,x,y,max);
}
export function curve(c,coords,color,lw){
 c.beginPath();c.moveTo(coords[0],coords[1]);c.bezierCurveTo(...coords.slice(2));c.strokeStyle=color;c.lineWidth=lw;c.lineCap='round';c.stroke();
}
export function cassette(c,x,y,width,t,paper='#ffe292'){
 c.save();c.translate(x,y);c.scale(width/64,width/64);
 box(c,-32,-19,64,38,4,'#3f3948',ink,2);box(c,-27,-15,54,24,3,paper,ink,1.2);
 box(c,-19,-6,38,10,5,'#8e6a79','#4b3649');
 for(const s of [-1,1]){
  oval(c,s*14,-1,6.3,6.3,'#fff0cd',ink,1.2);oval(c,s*14,-1,2.5,2.5,ink);
  for(let i=0;i<3;i++){const a=t*4+i*Math.PI*2/3;line(c,[[s*14+Math.cos(a)*3.6,-1+Math.sin(a)*3.6],[s*14+Math.cos(a)*5.6,-1+Math.sin(a)*5.6]],'#855d65',1.4);}
 }
 polygon(c,[[-21,16],[-16,9],[16,9],[21,16]],'#997d83',ink,1);
 for(const q of [-1,1])for(const n of [-1,1])oval(c,q*28,n*15,1.3,1.3,'#d7bfb0');
 c.restore();
}
// The driver's blonde bob, lilac jacket, pink cheeks and white glove move
// independently of the car. Her head turns toward the live cassette.
export function agi(c,x,y,size,{turn=0,reach=0,blink=false}={}){
 c.save();c.translate(x,y);c.scale(size/45,size/45);c.rotate(turn*.075);
 oval(c,0,11,15,8,'#b78cce',ink,1.6);polygon(c,[[-11,7],[-3,11],[0,16],[3,11],[11,7]],'#e9d8ed','#94688c');
 oval(c,0,-3,14,16,'#e9b959',ink,1.9);
 oval(c,turn*2,-3,10.5,12,'#ffddcd',ink,1.05);
 polygon(c,[[-13,1],[-14,-6],[-10,-15],[-1,-19],[9,-15],[14,-7],[11,-3],[8,-11],[6,-6],[2,-10],[-1,-6],[-6,-8],[-8,0],[-9,8],[-13,6]],'#f0be62',ink,1.15);
 for(const side of [-1,1]){oval(c,turn*2+side*4,-2,1.05,blink?.45:1.65,ink);oval(c,turn*2+side*7,1,2.3,1,'#eea1a4');}
 curve(c,[-2,3,0,5,2,5,4,2],ink,.85);
 line(c,[[7,12],[13+reach*7,12-reach*7]],'#9c6bae',4.2);oval(c,13+reach*7,12-reach*7,3.2,2.7,'#fff2df',ink,.9);
 c.restore();
}
export function car(c,x,y,scale,driver,s,color,kind='convertible',reduced=false){
 const w=scale*.62,tilt=reduced?0:driver.vx*.043,shiver=driver.stun&&!reduced?Math.sin(s.time*49)*2:0;
 c.save();c.translate(x+shiver,y);c.scale(w/64,w/64);c.rotate(tilt);
 oval(c,2,13,34,12,'#60485a41');
 if(driver.boost>0){for(const q of [-1,1])polygon(c,[[q*17-6,17],[q*17+5,16],[q*17,27+Math.sin(s.time*22)*4]],'#ffdb72','#c67c59',1.2);}
 for(const q of [-1,1]){box(c,q*26-4,-32,8,14,3,'#443b4b','#332836');box(c,q*28-4,1,8,17,3,'#443b4b','#332836');}
 const coupe=driver.id===0||kind==='courier';
 const points=coupe?[[-24,-37],[-13,-43],[15,-43],[25,-35],[28,1],[30,13],[22,19],[-22,19],[-29,14],[-27,-4]]:[[-26,-30],[-21,-38],[15,-40],[24,-35],[26,-17],[29,-2],[31,9],[26,18],[-24,18],[-31,11],[-28,-4]];
 polygon(c,points,color,ink,2.3);
 polygon(c,[[-18,-32],[17,-33],[21,-19],[-21,-18]],'#5f7480',ink,1.5);
 line(c,[[-16,-29],[-10,-31],[6,-31]],'#d4f3e7',1.6);
 box(c,-22,-17,44,18,5,coupe?'#b4c9bd':'#755565',ink,1.2);
 if(driver.id===0){box(c,2,-15,14,13,2,'#859b98',ink,.8);for(let i=0;i<2;i++)oval(c,9,-12+i*6,2.2,2.2,'#4e606c','#c7d7c2',.75);
 line(c,[[18,-28],[23,-47]],'#615368',1.15);oval(c,23,-47,1.6,1.6,'#efd27c',ink,.7);}
 else{for(const side of [-1,1])oval(c,side*23,-12,3,9,'#d680a0','#80546b',.8);}
 if(coupe&&driver.id!==0){line(c,[[-17,-13],[17,-13]],'#9d969b',1.4);line(c,[[-17,-9],[17,-9]],'#9d969b',1.4);}
 if(driver.id===1){
  const reaching=driver.signal>0?1:driver.jam>0?.6:0;
  agi(c,3,-13,25,{turn:s.cars[0].x<driver.x?-1:1,reach:reaching,blink:s.time%4.3>4.11});
 }else{
  oval(c,-7,-12,6,6,'#634d5c',ink,1.05);line(c,[[-10,-12],[-3,-12]],'#b1e6da',1.3);
 }
 polygon(c,[[-24,-1],[23,-1],[25,11],[-25,11]],color,'#725365',1.1);
 if(driver.id===0){line(c,[[-9,-1],[-10,11]],'#f9e7b5',3.4);line(c,[[-3,-1],[-3,11]],'#f9e7b5',1.5);}
 else{curve(c,[0,7,6,12,8,-2,15,2],'#ffe4c1',1.9);}
 for(const q of [-1,1])box(c,q*21-5,9,10,3.5,1.3,driver.signal||driver.blink?'#ffe165':'#ff9c9c',ink,.8);
 box(c,-9,12,18,4.3,1,'#f5deb3',ink,.7);for(let i=0;i<4;i++)line(c,[[-6+i*3,13.3],[-5+i*3,15]],'#795e68',.55);
 for(const q of [-1,1])line(c,[[q*25,-5],[q*26,4]],'#fff0d49e',1.2);box(c,-22,17,44,3,1,'#c3bbc0','#625664',.9);
 if(driver.jam>0){for(let j=0;j<2;j++)oval(c,0,1,33+j*5,19+j*3,null,'#77e7dacf',1.6);}
 c.restore();
}
export function trafficCar(c,p,o){
 const scale=p.s;
 c.save();c.translate(p.x,p.y);c.scale(scale/75,scale/75);
 if(o.kind==='cone'){
  oval(c,0,3,16,5,'#57465555');box(c,-13,-1,26,5,2,'#724e52',ink,1);polygon(c,[[-9,0],[-1,-22],[3,-22],[10,0]],'#ee995e',ink,1.4);
  polygon(c,[[-5,-9],[-3,-13],[5,-13],[7,-9]],'#ffedc7');
 }else if(o.kind==='barrier'){
  for(const a of [-1,1])box(c,a*12-2,-4,5,12,1,'#635569',ink);
  box(c,-21,-19,42,19,2,'#ffdda6',ink,1.6);
  for(let i=0;i<4;i++)polygon(c,[[-19+i*10,-4],[-15+i*10,-4],[-8+i*10,-17],[-13+i*10,-17]],'#c46c5e');
  oval(c,0,-23,4,4,'#ffd36c',ink,1);
 }else{
  const van=o.kind==='van';oval(c,0,5,23,7,'#5c4b5e44');
  for(const a of [-1,1])box(c,a*16-3,-4,6,12,2,ink);
  box(c,-19,van?-38:-28,38,van?44:34,van?5:8,van?'#f0cc92':'#e9a36d',ink,1.6);
  box(c,-15,van?-31:-24,30,13,3,'#78959b',ink,1);
  if(van){line(c,[[0,-17],[0,2]],'#826a70',1.2);label(c,'FM',0,-8,8,ink,'center','AK Mono');}
  for(const a of [-1,1])box(c,a*13-3,0,6,3,1,'#f07e78',ink,.7);
 }
 c.restore();
}
