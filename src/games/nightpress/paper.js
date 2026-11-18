import {line,oval,polygon} from '../kit/illustration.js';
import {rr,star,text,ink} from './decals.js';
export function stockArt(c,volume,x,y,z){
 c.save();c.translate(x,y);c.scale(z,z);c.globalAlpha=.21;
 const sw=['#a57c72','#9c5e77','#64877e','#987ca0','#7d9471','#937786'][volume];
 if(volume===0||volume===4){
  // Loose botanical monoprint. Paired leaf cuts catch a second, paler ink.
  for(const [ax,ay,k] of [[.17,3.98,.8],[4.84,4.93,1.12],[3.71,4.89,.61]]){
   c.save();c.translate(ax,ay);c.rotate(ax>2?-.58:.49);line(c,[[0,.18],[.02,-.47*k],[-.13*k,-1.42*k]],sw,.029);
   for(let j=0;j<4;j++){const yy=-.20*k-j*.26*k;for(const sign of [-1,1]){c.save();c.translate(-j*.027*k,yy);c.rotate(sign*.73);
    oval(c,sign*.077*k,-.16*k,.09*k,.20*k,sw);c.restore();}}c.restore();
  }
 }else if(volume===1||volume===3){
  for(let j=0;j<5;j++){const a=.12+j*.145;line(c,[[4.9-a,2.9],[4.9-a,4.85-a],[2.9,4.85-a]],sw,.029);}
  for(let j=0;j<22;j++)for(let k=0;k<4;k++)oval(c,.13+j*.13,4.79-k*.12,.015+k*.004,.015+k*.004,sw);
 }else{
  for(let i=0;i<19;i++){const xx=((i*17)%29)/6+.12,yy=((i*27+7)%31)/6;
   if(i%3===0)star(c,xx,yy,.094,sw,null,4);else oval(c,xx,yy,.035,.035,sw);}
  c.beginPath();c.arc(4.75,4.4,1.22,0,Math.PI*2);c.strokeStyle=sw;c.lineWidth=.043;c.stroke();
 }
 c.restore();
}
export function tableProps(c,l,t){
 const {w,h,x,y,pw,ph,side,cell:z}=l;
 if(side){
  const xx=Math.min(w*.89,l.rx+l.rw*.70),yy=Math.max(8,l.ry-z*.53);c.save();c.translate(xx,yy);c.rotate(-.13);
  rr(c,-z*1.09,-z*.075,z*1.87,z*.15,z*.04,'#e1aa69','#766556',.85);
  line(c,[[-z,0],[z*.64,0]],'#f2c786',Math.max(1,z*.027));polygon(c,[[z*.78,-z*.074],[z*1.08,0],[z*.78,z*.074]],'#d9bd91','#736052',.8);
  polygon(c,[[z*1.02,-z*.019],[z*1.11,0],[z*1.02,z*.019]],ink);rr(c,-z*1.22,-z*.075,z*.17,z*.15,1,'#d39594','#886a69',.8);c.restore();
  const bx=Math.max(7,x-z*.96),by=y+ph*.68;c.save();c.translate(bx,by);c.rotate(-.14);
  rr(c,-z*.47,-z*.60,z*.80,z*1.28,z*.04,'#f5d6bb','#8f7778',1);
  for(let j=0;j<5;j++)rr(c,-z*.34,-z*.46+j*z*.20,z*(.47+j%2*.08),z*.09,.8,['#d49090','#e2bb77','#a9a3ba','#99b19f','#8a9ca6'][j]);
  c.restore();
 }
 for(const [fx,fy] of [[x+.09*z,y+.13*z],[x+pw-.12*z,y+ph-.13*z]]){
  oval(c,fx+1,fy+2,z*.047,z*.035,'#725d6136');oval(c,fx,fy,z*.038,z*.038,'#b9bdad','#8c9291',.65);
 }
}
