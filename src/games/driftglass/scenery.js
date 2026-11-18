import {project} from './road.js';
import {box,oval,polygon,line,curve,label,ink} from './art.js';

// Painted roadside pieces stand in world space. Their scale and overlap follow
// the same camera as the cars, so a phone still sees the same racing line.
function tent(c,x,y,sz,variant){
 c.save();c.translate(x,y);c.scale(sz,sz);
 const a=variant?'#cf7f75':'#86a598',shade=variant?'#965a63':'#567a79';
 polygon(c,[[-22,5],[15,7],[28,3],[23,8],[-17,10]],'#6e5960','#574853',.8);
 line(c,[[-16,-15],[-16,5]],'#665259',1.3);line(c,[[16,-13],[16,5]],'#665259',1.3);
 polygon(c,[[-24,-13],[-12,-24],[8,-22],[25,-13],[23,-10],[-22,-11]],a,'#735b62',1);
 polygon(c,[[8,-22],[25,-13],[23,-10],[5,-13]],shade);
 for(let j=0;j<4;j++){const px=-20+j*8;polygon(c,[[px,-13],[px+4,-13],[px+3,-9],[px,-10]],'#f6d7ae');}
 box(c,-12,-1,11,6,1,'#a67c65','#72585b');for(let j=0;j<5;j++)oval(c,-11+j*2.2,-2-(j%2)*2,1.9,1.8,j%2?'#d99b5e':'#a7ab6e');
 box(c,2,-1,9,6,1,'#b0846d','#72585b');oval(c,7,-3,3.3,3.3,'#e3b977');
 line(c,[[20,-11],[20,-5]],'#73535a',.7);oval(c,20,-4,2.5,3.1,'#edac7d','#8f6963',.7);
 c.restore();
}
function cabin(c,x,y,span,i){
 const h=span*(.27+(i%3)*.036),w=span*.81;
 box(c,x-w*.37,y-h,w*.75,h,1,i%2?'#c69682':'#cfa786');
 polygon(c,[[x-w*.47,y-h],[x-w*.12,y-h*1.66],[x+w*.43,y-h*1.12],[x+w*.49,y-h*.86],[x-w*.48,y-h*.89]],i%2?'#99747b':'#a57671');
 for(let j=0;j<4;j++)line(c,[[x-w*.29+j*w*.16,y-h*1.02],[x-w*.20+j*w*.16,y-h*1.27]],'#bc9183',1);
 for(let j=0;j<3;j++){const px=x-w*.27+j*w*.20;box(c,px,y-h*.72,w*.10,h*.43,0,'#856a6c');line(c,[[px,y-h*.5],[px+w*.1,y-h*.5]],'#ddaa88',.7);}
 for(const q of [-1,1])line(c,[[x+q*w*.29,y-1],[x+q*w*.29,y+span*.038]],'#8d716d',1.4);
}
function mountain(c,v,color,offset,h){
 const p=[[-v.w*.1,v.horizon+8]];for(let i=-1;i<=15;i++){const x=v.w*i/14;
 p.push([x,v.horizon-h*(.25+Math.sin(i*.77+offset)*.29+Math.sin(i*1.73+offset)*.16)]);}
 p.push([v.w*1.1,v.horizon+8]);polygon(c,p,color);
}
export function horizonDetail(c,v,s,d){
 const hz=v.horizon,w=v.w,hh=v.h,shift=s.distance*.53;
 mountain(c,v,['#bda0a6','#b0afa0','#afa7a5','#b1a0b3'][s.district],shift*.007,hh*.19);
 if(s.district===1){
  for(let i=-1;i<14;i++){const x=(i-.12)*w*.085-shift%(w*.085);cabin(c,x,hz+hh*.003,w*.086,i+2);}
  const start=hz-hh*.054;
  curve(c,[-3,start,w*.30,start+hh*.076,w*.66,start-hh*.016,w+3,start+hh*.035],'#9b7b788c',1.2);
  for(let j=0;j<21;j++){const x=w*j*.052,y=start+hh*(.024*Math.sin(j*.26)+.010);line(c,[[x,y],[x,y+3]],'#a77f72',.7);oval(c,x,y+4.5,1.6,2.2,j%2?'#d7a379':'#c48a7a');}
 }else if(s.district===2){
  const y=hz-hh*.04;for(let i=-1;i<8;i++){const x=w*i*.161-shift%(w*.161);
   line(c,[[x,y+2],[x+w*.08,y-hh*.085],[x+w*.16,y+2]],'#a28882',Math.max(1,w*.002));
   line(c,[[x,y+1],[x+w*.16,y+1]],'#967c77',Math.max(2,w*.003));
   box(c,x-1,y,Math.max(3,w*.004),hh*.08,0,'#8a807e');
  }
 }else if(s.district===3){
  mountain(c,v,'#9c8eaa',shift*.017+1.3,hh*.095);
  for(let i=0;i<14;i++){const x=w*(i+.2)/14-shift%(w*.075);polygon(c,[[x-4,hz],[x,hz-hh*.03*(1+i%3)],[x+4,hz]],'#867e95');}
 }else{
  for(let i=0;i<11;i++){const x=w*(i-.3)/10-shift%(w*.1);const h=hh*(.028+(i%3)*.015);
   box(c,x,hz-h,w*.064,h,0,'#927986');for(let j=0;j<3;j++)box(c,x+w*.009*(j+1),hz-h*.70,w*.006,3,0,'#d4ac93');}
 }
}
export function groundDetail(c,v,s,d){
 const a=v.horizon,w=v.w,h=v.h,pr=(x,z)=>project(v,x,z,0,s.distance,s.district);
 const gradient=c.createLinearGradient(0,a,0,h);
 const palettes=[['#a68a8f','#98746f'],['#96b7aa','#648f8d'],['#c6ad93','#ad866e'],['#b6a0a7','#948295']][s.district];
 gradient.addColorStop(0,palettes[0]);gradient.addColorStop(1,palettes[1]);c.fillStyle=gradient;c.fillRect(0,a,w,h-a);
 const nearL=pr(-2,-2),nearR=pr(2,-2);polygon(c,[[v.center-1,a],[v.center+1,a],[nearR.x,nearR.y],[nearL.x,nearL.y]],d.road);
 if(s.district===1){
  for(let row=0;row<16;row++){const f=(row+1)/17,yy=a+(h-a)*f*f;
   for(let j=0;j<7;j++){const xx=(w*(j*.171+Math.sin(row*4.2)*.045)-s.distance*(.18+f))%(w*1.1);
    line(c,[[xx,yy],[xx+w*(.021+f*.044),yy]],row%3?'#e5d9b441':'#f7e8c96b',Math.max(.7,f*2));}}
 }else{
  for(let row=0;row<7;row++)for(let i=0;i<7;i++){const p=pr((i%2?1:-1)*(2.55+(i%3)*.63),3+row*3.3-s.distance%3.3);
   line(c,[[p.x,p.y],[p.x+p.s*.12,p.y-1]],'#755e6745',1.1);}
 }
}
export function roadsideDetail(c,v,s){
 const at=(x,z)=>project(v,x,z,0,s.distance,s.district);
 for(let j=7;j>=0;j--){
  const z=3.0+j*3.38-s.distance%3.38;if(z<-.5)continue;
  const flip=(j+Math.floor(s.distance/3.38))%2?1:-1;
  for(const side of [-1,1]){
   const x=side*(s.district===0?2.08:2.31+(j%2)*.22),p=at(x,z),size=p.s,S=size/85;
   if(s.district===1){
    if(side===flip){
     for(let i=0;i<3;i++)line(c,[[p.x-size*.29,p.y+size*(.11+i*.042)],[p.x+size*(.1+i*.08),p.y+size*(.11+i*.042)]],'#e9d7aa99',Math.max(.7,S));
     tent(c,p.x,p.y,S*(j%3===1?1.35:1.1),j%2);
    }else{
     oval(c,p.x,p.y+size*.02,size*.24,size*.045,'#476b714a');
     polygon(c,[[p.x-size*.23,p.y],[p.x-size*.11,p.y+size*.069],[p.x+size*.13,p.y+size*.055],[p.x+size*.25,p.y-size*.018]],'#ad8265','#79605e',Math.max(.7,S));
     for(let f=0;f<3;f++)oval(c,p.x+(f-1)*size*.055,p.y-size*.014,size*.037,size*.029,f%2?'#dfb36f':'#a7ad6f');
    }
   }else if(s.district===0&&side===flip){
    const high=size*.54;box(c,p.x-size*.14,p.y-high,size*.28,high*.22,Math.max(1,S*2),'#c8a78b','#86676d',Math.max(.6,S));
    line(c,[[p.x,p.y-high*.76],[p.x,p.y]],'#705c65',Math.max(1,size*.019));
    for(let i=0;i<3;i++)line(c,[[p.x-size*.067+i*size*.054,p.y-high*.94],[p.x-size*.025+i*size*.05,p.y-high*.87]],'#866b70',Math.max(.6,S));
   }else if(s.district===2&&side===flip){
    const base=p.y,xx=p.x,S=p.s*.58;
    line(c,[[xx,base],[xx,base-S],[xx+side*S*.83,base-S*.94]],'#9c705e',Math.max(2,S*.052));
    line(c,[[xx,base-S*.75],[xx+side*S*.40,base-S*.97]],'#ac7c63',Math.max(1,S*.032));
    line(c,[[xx+side*S*.66,base-S*.94],[xx+side*S*.66,base-S*.57]],'#78656a',Math.max(.7,S*.014));
    box(c,xx+side*S*.66-2,base-S*.57,4,2,1,'#806668');
   }else if(s.district===3&&side===flip){
    const r=p.s*.16;oval(c,p.x,p.y-r,r*.9,r*1.12,'#808b82','#6d7780',Math.max(.6,S*.6));line(c,[[p.x,p.y],[p.x,p.y-r]],'#76636d',Math.max(.8,S));
   }
  }
 }
}
