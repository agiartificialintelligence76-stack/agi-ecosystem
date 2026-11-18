import { oval, polygon, line } from '../kit/illustration.js';
export { oval,polygon,line };
export const ink='#412a3e';
export function box(c,x,y,w,h,r,fill,stroke=null,lw=1){
 if(w<1||h<1)return;
 c.beginPath();c.roundRect(x,y,w,h,Math.max(0,Math.min(r,w/2,h/2)));
 if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.lineWidth=lw;c.strokeStyle=stroke;c.stroke();}
}
export function label(c,t,x,y,size,color=ink,align='left',font='AK Sans',max=9999,weight=750){
 c.font=weight+' '+size+'px "'+font+'",sans-serif';c.textAlign=align;c.textBaseline='middle';c.fillStyle=color;c.fillText(t,x,y,max);
}
export function path(c,ops,fill,stroke=null,lw=1){
 c.beginPath();
 for(const [m,...p] of ops)c[m](...p);
 if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.lineCap='round';c.lineJoin='round';c.stroke();}
}
export function moon(c,x,y,r,color){
 path(c,[['moveTo',x+r*.49,y-r*.8],['bezierCurveTo',x-r*.94,y-r*1.08,x-r*1.14,y+r*.77,x+.12*r,y+r*.84],
 ['quadraticCurveTo',x+.81*r,y+r*.82,x+r,y+r*.16],['bezierCurveTo',x+r*.18,y+r*.37,x-r*.1,y-r*.3,x+r*.49,y-r*.8],['closePath']],color);
}
export function paw(c,x,y,r,color){
 oval(c,x,y+r*.16,r*.46,r*.32,color);
 for(let i=0;i<3;i++)oval(c,x+(i-1)*r*.38,y-r*(i===1?.42:.26),r*.17,r*.19,color);
}
export function star(c,x,y,r,fill){const p=Array.from({length:8},(_,i)=>{const a=i*Math.PI/4-Math.PI/2,l=i%2?r*.29:r;return [x+Math.cos(a)*l,y+Math.sin(a)*l];});polygon(c,p,fill);}
export function cat(c,x,y,size,{time=0,face=1,pose='sit',moving=0,attentive=false}={}){
 const fur='#fff1d7',honey='#ea986f',dark='#725253',pink='#f5a4aa',breath=Math.sin(time*2)*.6;
 c.save();c.translate(x,y);c.scale(size/52,size/52);oval(c,0,13,23,5,'#48324342');c.scale(face<0?-1:1,1);
 if(pose==='roll')c.rotate(Math.sin(time*2.5)*.29-.3);
 const curled=pose==='bagel',stretch=pose==='stretch'||pose==='glide';
 c.translate(0,breath-(moving?Math.sin(Math.PI*moving)*4:0));
 c.scale(stretch?1.12:1,stretch?.86:1);
 // The tail is inked twice for a continuous outline even when it curls up.
 const tail=[['moveTo',-12,8],['bezierCurveTo',-30,12,-31,curled?0:-12,-23,curled?1:-10+Math.sin(time*3)*4]];
 path(c,tail,null,ink,7);path(c,tail,null,honey,4.4);
 oval(c,-2,3,20,13,fur,ink,1.8);oval(c,-9,-1,8,6,honey);oval(c,-14,2,3,3,dark);
 const stride=moving?Math.sin(moving*Math.PI*2)*3:0;
 if(!curled){oval(c,-10+stride,13,5,2.9,fur,ink,1.2);oval(c,10-stride+(stretch?4:0),pose==='knead'?12+Math.sin(time*7)*2:13,5,2.7,fur,ink,1.2);}
 c.translate(curled?-5:0,curled?7:attentive?-2:0);
 polygon(c,[[0,-9],[0,-22],[11,-15],[20,-23],[23,-5]],fur,ink,1.6);
 polygon(c,[[1,-19],[8,-14],[2,-11]],pink);polygon(c,[[15,-15],[20,-20],[20,-11]],dark);
 oval(c,11,-6,13,10,fur,ink,1.6);
 path(c,[['moveTo',-1,-9],['quadraticCurveTo',0,-17,11,-15],['quadraticCurveTo',10,-7,5,-6],['quadraticCurveTo',2,-6,-1,-9]],honey);
 const blink=curled||pose==='knead'||(time%4.9)>4.67;
 for(const ex of [6,16])if(blink)path(c,[['moveTo',ex-2,-5],['quadraticCurveTo',ex,-3,ex+2,-5]],null,ink,1.5);
 else{oval(c,ex,-5,2.1,attentive?3.2:2.5,ink);oval(c,ex+.65,-6.15,.6,.6,'#fff');}
 polygon(c,[[9,-2],[14,-2],[11.7,.4]],pink);line(c,[[11.7,.5],[10,2],[8.4,1.7]],ink,.9);
 for(const s of [-1,1]){const p=s<0?2:20;line(c,[[p,-1],[p+s*8,-2.5]],ink,.85);line(c,[[p,.8],[p+s*7,2.3]],ink,.85);}
 if(pose==='wave'){c.save();c.translate(16,6);c.rotate(Math.sin(time*5)*.24);oval(c,0,-3,4.2,6.5,fur,ink,1.2);paw(c,0,-4,5,pink);c.restore();}
 c.restore();
}
