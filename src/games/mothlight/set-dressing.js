import {oval,line,polygon} from '../kit/illustration.js';
import {form} from './figure.js';
const dust=n=>{const a=Math.sin(n*71.13+10.17)*12341.1;return a-Math.floor(a);};
function bloom(c,x,y,s,color){
 for(let j=0;j<5;j++){const a=j*Math.PI*.4-.4;oval(c,x+Math.cos(a)*s*.46,y+Math.sin(a)*s*.42,s*.36,s*.31,color);}
 oval(c,x,y,s*.18,s*.17,'#f4d19e');
}
function lantern(c,x,y,s){
 line(c,[[x,y-s*.18],[x,y]],'#6c616b',Math.max(.7,s*.025));
 oval(c,x,y+s*.17,s*.115,s*.16,'#eeaf99','#996f75',Math.max(.6,s*.009));
 for(const q of [-1,0,1])line(c,[[x+q*s*.052,y+s*.045],[x+q*s*.074,y+s*.19],[x+q*s*.047,y+s*.30]],'#bd887e',Math.max(.55,s*.009));
 line(c,[[x-s*.07,y+s*.31],[x+s*.07,y+s*.31]],'#745c68',Math.max(.7,s*.02));line(c,[[x,y+s*.31],[x,y+s*.40]],'#c48e77',Math.max(.7,s*.014));
}
export function detail(c,sc,at,w,h){
 const id=sc.a.place;
 if(id===0){
  // A cedar viewing pavilion, the slats of its rail, and flowerbeds on the path.
  for(const offset of [-5.7,3.5]){
   const z=8.4,l=at(offset-1.85,.84,z),r=at(offset+1.85,.84,z),roof=at(offset,2.35,z),foot=at(offset,0,z);
   for(const k of [-1.42,-.48,.48,1.42]){const f=at(offset+k,.10,z),t=at(offset+k,1.58,z);line(c,[[f.x,f.y],[t.x,t.y]],'#826e70',Math.max(1.5,f.s*.067));}
   polygon(c,[[l.x,l.y-l.s*.72],[roof.x,roof.y],[r.x,r.y-r.s*.72],[r.x-r.s*.12,r.y-r.s*.62],[l.x+l.s*.12,l.y-l.s*.62]],'#9f8386','#7a717a',Math.max(.7,foot.s*.015));
   for(let j=-6;j<=6;j++){const f=at(offset+j*.23,.23,z),t=at(offset+j*.23,.51,z);line(c,[[f.x,f.y],[t.x,t.y]],'#aa8d80',Math.max(.7,f.s*.027));}
   line(c,[[l.x,foot.y-foot.s*.53],[r.x,foot.y-foot.s*.53]],'#977c78',Math.max(.9,foot.s*.052));
  }
  for(let i=-5;i<6;i++){const xx=i*2.2+.61,z=6.01+Math.abs(i%3)*.6;
   // Twig forks and irregular blossom clusters break up the large canopy shapes.
   const base=at(xx-.17,1.62,z);if(base.x< -base.s*1.66||base.x>w+base.s*1.66)continue;
   for(let k=0;k<6;k++){
    const tx=xx+(dust(i*13+k)-.5)*1.75,ty=2.34+dust(i*27+k)*.72,p=at(tx,ty,z),joint=at(xx+(tx-xx)*.54,1.90+(ty-2.2)*.37,z);
    line(c,[[base.x,base.y],[joint.x,joint.y],[p.x,p.y]],'#9a7980',Math.max(.75,p.s*.021));
    for(let j=0;j<3;j++){const q=at(tx+(dust(i*173+k*5+j)-.5)*.28,ty+(dust(i*81+k*13+j)-.5)*.23,z);
     if(q.x< -10||q.x>w+10||q.y< -10||q.y>h+10)continue;
     bloom(c,q.x,q.y,q.s*(.042+dust(4+j+k)*.035),j%2?'#ffe0df':'#f4c6cd');}
   }
   if(i%2){const p=at(xx+.49,2.12,z);lantern(c,p.x,p.y,p.s*.78);}
  }
  for(let i=-21;i<=21;i++){const row=Math.abs(i)%3,z=4.9+row*.14,xx=i*.25,p=at(xx,0,z),q=at(xx,.13,z);
   if(p.x< -p.s*.2||p.x>w+p.s*.2)continue;
   oval(c,p.x,p.y,p.s*.19,p.s*.06,'#9eac91');line(c,[[p.x,p.y],[q.x,q.y]],'#839d87',Math.max(.65,p.s*.012));
   bloom(c,q.x,q.y,q.s*.055,i%3?'#e7adba':'#f7dcb8');
  }
  for(let i=0;i<64;i++){const p=at((dust(i+53)-.5)*9,.004,1.8+dust(i+73)*4.1);
   oval(c,p.x,p.y,p.s*.024,p.s*.008,i%2?'#f5d1ce':'#dab4ad');}
 }
 if(id===1){
  const z=8.7;for(let k=-2;k<=2;k++){
   const x=k*3.4+Math.sin(sc.t*.18)*.25,p=at(x,0,z),S=p.s;
   polygon(c,[[p.x-S*.78,p.y],[p.x-S*.48,p.y+S*.12],[p.x+S*.46,p.y+S*.11],[p.x+S*.72,p.y-S*.04]],'#b6846a','#776167',1);
   line(c,[[p.x-S*.3,p.y-2],[p.x-S*.3,p.y-S*.34],[p.x+S*.34,p.y-S*.34],[p.x+S*.34,p.y]],'#846b6a',Math.max(1,S*.021));
   polygon(c,[[p.x-S*.48,p.y-S*.31],[p.x-S*.27,p.y-S*.52],[p.x+S*.34,p.y-S*.49],[p.x+S*.48,p.y-S*.30]],'#b78186','#846b72',1);
  }
 }
 if(id===2||id===7){
  for(let i=-5;i<=5;i++){const p=at(i*2.2+.65,0,8.3),s=p.s;const tower=id===2&&i%2;
   if(tower){line(c,[[p.x,p.y],[p.x,p.y-s*3.25]],'#797c87',Math.max(1,s*.026));for(let j=0;j<3;j++)line(c,[[p.x-s*.26,p.y-s*(2.55+j*.21)],[p.x+s*.26,p.y-s*(2.55+j*.21)]],'#7e7b85',1.4);}
   else{for(let j=0;j<6;j++){const k=at(i*2.2+.65+(j-2)*.14,.49+Math.sin(j*4)*.12,8);oval(c,k.x,k.y,s*.14,s*.22,'#8b9b8d');}}
  }
 }
 if(id===3){
  for(let i=-6;i<=6;i++){const p=at(i*1.55+.33,1.35+(i%2)*.16,6.9),s=p.s;
   c.fillStyle=i%2?'#b485a3':'#71909d';c.fillRect(p.x,p.y-s*.24,s*.65,s*.27);
   for(let j=0;j<4;j++)line(c,[[p.x+s*(.08+.14*j),p.y-s*.17],[p.x+s*(.14+.14*j),p.y-s*.08]],i%2?'#ffb2cd':'#b6ede1',Math.max(1,s*.03));}
 }
 if(id===4){
  for(let i=-4;i<=4;i++){const x=i*1.66+.45,p=at(x,.58,5.8),s=p.s;
   c.fillStyle='#a87d79';c.fillRect(p.x-s*.22,p.y-s*.22,s*.46,s*.45);for(let j=0;j<3;j++)line(c,[[p.x-s*.15,p.y+s*(j*.10-.12)],[p.x+s*.16,p.y+s*(j*.10-.12)]],'#ccb09a',1);
   if(i%2===0)lantern(c,p.x+s*.18,p.y-s*.82,s);
  }
 }
 if(id===5){
  const p=at(-2.4,2.25,9),r=p.s*1.66;oval(c,p.x,p.y,r,r,null,'#a77b86',Math.max(1,r*.035));
  for(let j=0;j<10;j++){const a=j*Math.PI*.2+sc.t*.034,xx=p.x+Math.sin(a)*r,yy=p.y+Math.cos(a)*r;line(c,[[p.x,p.y],[xx,yy]],'#c79d96',1);oval(c,xx,yy+r*.075,r*.065,r*.075,j%2?'#e0b195':'#a2b5ac');}
  for(const dx of [-.64,.64])line(c,[[p.x,p.y],[p.x+r*dx,p.y+r*1.38]],'#9e8088',Math.max(1,r*.042));
 }
 if(id===6){
  const p=at(0,.55,8),s=p.s;c.fillStyle='#b2c1b3';c.fillRect(0,p.y-s*.85,w,s*.82);
  c.fillStyle='#dfba84';c.fillRect(0,p.y-s*.16,w,s*.09);
  for(let i=-13;i<=13;i++){const z=at(i*.72+sc.t*.028,.93,8);c.fillStyle='#82969c';c.fillRect(z.x,z.y-s*.19,s*.45,s*.33);}
 }
}
