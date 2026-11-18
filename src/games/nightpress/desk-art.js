import {stockArt,tableProps} from './paper.js';
import {ISSUES,DECALS,VOLUMES} from './issues.js';
import {rotCells,geometry} from './press.js';
import {rr,text,portrait,decal,star,ink} from './decals.js';
import {line,oval,polygon} from '../kit/illustration.js';
const cream='#fff1d4',yellow='#e6b866',good='#396b55',bad='#9d4a55';
const ns=n=>{const a=Math.sin(n*42.37)*29464.65;return a-Math.floor(a);};
export function layout(w,h){
 const side=w>h*1.23&&w>=475;
 const z=side?Math.max(13,Math.min((w*.56-25)/5.55,(h-24)/6.95,99)):Math.max(12,Math.min((w-34)/5.68,(h-94)/6.25,94));
 const cell=z,pw=5.62*z,ph=6.35*z;
 let x=side?Math.max(14,(w*.60-pw)*.5):(w-pw)/2;
 const y=side?(h-ph)*.51:Math.max(4,Math.min(30,(h-ph-76)*.30));
 return {w,h,side,cell,x,y,pw,ph,gx:x+.31*z,gy:y+1.01*z,rx:side?Math.max(x+pw+17,w*.595):Math.max(8,x-3),ry:side?Math.max(8,(h-Math.min(5.23*z,h-25))*.49):y+ph+5,rw:side?w-Math.max(x+pw+17,w*.595)-12:Math.min(w-16,pw+6),rh:side?Math.min(5.23*z,h-25):Math.max(62,h-y-ph-8)};
}
function cloth(c,w,h,t,reduce){const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'#a0b9a9');g.addColorStop(.62,'#a8baaa');g.addColorStop(1,'#83a398');c.fillStyle=g;c.fillRect(0,0,w,h);
 const gap=Math.max(14,Math.min(w,h)/21);for(let x=gap*.6;x<w;x+=gap)line(c,[[x,0],[x,h]],'#6c978d68',.75);
 for(let y=gap*.7;y<h;y+=gap)line(c,[[0,y],[w,y]],'#6c978d68',.75);
 for(let i=0;i<38;i++){const x=ns(i+4)*w,y=ns(i+22)*h;line(c,[[x,y],[x+3+ns(i+10)*3,y+1]],'#d7d2ad6b',.8);}
 // Brass cutting ruler, with inch marks sunk into its edge.
 c.save();c.translate(-3,0);c.rotate(-.024);rr(c,-9,0,Math.min(22,w*.024),h*1.1,1,'#e3c58e','#8b795d',1);
 for(let j=0;j<h/8;j++)line(c,[[0,j*8],[j%5===0?8:4,j*8]],'#8e816a',.7);c.restore();
}
function page(c,d,l,t,opts={}){
 const {x,y,gx,gy,cell:z,pw,ph}=l,vol=VOLUMES[d.stock],issue=d.issue;c.save();
 rr(c,x+z*.09,y+z*.105,pw,ph,z*.04,'#4c655547');rr(c,x+z*.055,y+z*.064,pw,ph,z*.04,'#eee0ba','#786374',.85);
 rr(c,x,y,pw,ph,z*.04,vol[2],ink,Math.max(1,z*.028));
 // offset lithograph fibres, paper edge and staple
 for(let i=0;i<52;i++){const xx=x+pw*ns(i+41),yy=y+ph*ns(21+i);line(c,[[xx,yy],[xx+z*.079,yy-.8]],'#73615f22',Math.max(.55,z*.009));}
 for(const k of [.42,4.95]){line(c,[[x+k*z,y+z*.135],[x+(k+.21)*z,y+z*.135]],'#648281',Math.max(1,z*.036));}
 text(c,'AGI—1 EDITIONS',gx,y+z*.235,z*.139,vol[4],'left','AK Mono',pw*.46);
 text(c,'NO. '+String(issue.id+1).padStart(2,'0')+'   /   '+VOLUMES[d.stock][0].toUpperCase(),x+pw-z*.29,y+z*.235,z*.124,vol[4],'right','AK Mono',pw*.48);
 text(c,issue.title,gx,y+z*.61,z*.51,ink,'left','AK Display',pw-.60*z);
 line(c,[[gx,y+z*.887],[gx+z*5,y+z*.887]],ink,Math.max(1,z*.045));
 c.save();c.beginPath();c.rect(gx,gy,z*issue.w,z*issue.h);c.clip();
 stockArt(c,d.stock,gx,gy,z);
 if(issue.rules.includes('gutter')){c.fillStyle='#977d8033';c.fillRect(gx+2*z,gy,z,5*z);line(c,[[gx+2.5*z,gy],[gx+2.5*z,gy+z*5]],'#8a7889',Math.max(.8,z*.028));}
 if(issue.rules.includes('border')){c.fillStyle='#ebe1bd88';c.fillRect(gx,gy+4*z,z*5,z);}
 if(!opts.clean){for(let yy=0;yy<=5;yy++)for(let xx=0;xx<=5;xx++){const a=gx+xx*z,b=gy+yy*z;line(c,[[a-z*.08,b],[a+z*.08,b]],'#8d798565',Math.max(.7,z*.013));line(c,[[a,b-z*.07],[a,b+z*.07]],'#8d798565',Math.max(.7,z*.013));}}
 issue.head.forEach((xx,i)=>{const a=gx+xx*z,b=gy;rr(c,a+z*.09,b+z*.08,z*.82,z*.78,z*.095,vol[4]);text(c,i?'1':'A',a+z*.50,b+z*.48,z*.60,cream,'center','AK Display');});
 for(const p of d.layers){if(opts.drag&&p.id===d.selected)c.globalAlpha=.34;decal(c,p.id,gx+p.x*z,gy+p.y*z,z,p.turn,t);c.globalAlpha=1;}
 if(!opts.clean&&d.phase==='desk'&&(opts.drag||opts.preview)){
  const p=d.cursor;decal(c,d.selected,gx+p.x*z,gy+p.y*z,z,p.turn,t,{ghost:true,selected:true});
  // Offset under the fingertip, with a lifted corner and a visible trim mark.
  const q=rotCells(d.selected,p.turn);const xx=gx+(p.x+q.w)*z,yy=gy+p.y*z;
  polygon(c,[[xx-z*.27,yy+.5],[xx-.5,yy+.5],[xx-.5,yy+z*.27]],'#fff0d3',ink,Math.max(1,z*.026));
 }
 c.restore();
 // Four real registration marks frame the trim.
 for(const [xx,yy,dx,dy] of [[gx,gy,-1,-1],[gx+5*z,gy,1,-1],[gx,gy+5*z,-1,1],[gx+5*z,gy+5*z,1,1]]){
  line(c,[[xx+dx*z*.24,yy],[xx+dx*z*.04,yy]],vol[4],1);line(c,[[xx,yy+dy*z*.06],[xx,yy+dy*z*.19]],vol[4],1);}
 text(c,'HAND PULLED   ✦   AGI PRINT CLUB',gx,y+ph-z*.125,z*.126,vol[4],'left','AK Mono');
 text(c,'♥  '+String(d.moves).padStart(2,'0'),x+pw-z*.3,y+ph-z*.125,z*.138,vol[4],'right','AK Mono');
 c.restore();
}
function wrap(c,str,x,y,width,sz,color,maxLines=2){
 const words=str.split(' '),rows=[''];c.font='800 '+sz+'px "AK Sans",sans-serif';
 for(const s of words){const i=rows.length-1,v=rows[i]?rows[i]+' '+s:s;if(c.measureText(v).width>width&&rows[i]&&rows.length<maxLines)rows.push(s);else rows[i]=v;}
 rows.slice(0,maxLines).forEach((row,i)=>text(c,row,x,y+sz*1.18*i,sz,color,'left','AK Sans',width));return rows.length*sz*1.18;
}
function docket(c,d,l,t,opts){
 const {rx:x,ry:y,rw:w,rh:h,side}=l;const v=VOLUMES[d.stock],z=l.cell,pad=side?Math.max(8,w*.064):7;
 rr(c,x+2,y+3,w,h,6,'#51675252');rr(c,x,y,w,h,6,'#fff1ce',ink,Math.max(1.1,z*.025));
 const check=d.checks.checks,n=check.filter(q=>q.ok).length,ok=!d.checks.failed.length;
 if(side){
  const fs=Math.max(10,Math.min(18,h*.069,w*.057)),head=Math.max(15,Math.min(w*.10,h*.092));
  rr(c,x+w*.33,y-4,w*.34,9,2,'#d4b88cbf','#9d957c',.8);
  portrait(c,x+w-pad-head*.58,y+head*1.08,head*.82,ok&&Math.sin(t*1.8)>.91);
  text(c,'DESK NOTE',x+pad,y+head*.95,head,ink,'left','AK Display',w*.63);
  let yy=y+head*1.95;yy+=wrap(c,d.issue.note,x+pad,yy,w-pad*2,fs,ink,3)+fs*.55;
  for(const q of check){if(yy>y+h-fs*.70)break;rr(c,x+pad,yy-fs*.48,fs*.84,fs*.84,2,q.ok?good:'#f2d9c4',q.ok?good:bad,1);
    if(q.ok)text(c,'✓',x+pad+fs*.42,yy,fs*.78,cream,'center');text(c,q.label,x+pad+fs*1.3,yy,fs,q.ok?good:ink,'left','AK Sans',w-pad*2-fs);yy+=fs*1.48;}
  if(yy+fs*2<y+h){line(c,[[x+pad,yy],[x+w-pad,yy]],'#ae917f',.9);text(c,ok?'READY FOR PRESS':'IN THE RACK',x+pad,yy+fs*1.13,fs*.84,v[4],'left','AK Mono');}
 }else{
  const fs=Math.min(15,Math.max(12,h*.16)),header=Math.max(12,fs*.86);portrait(c,x+w-22,y+17,12.5,ok);
  text(c,ok?'PROOF READY':'BRIEF   '+n+'/'+check.length,x+pad,y+header,header,ok?good:v[4],'left','AK Mono',w-45);
  const hh=wrap(c,d.issue.note,x+pad,y+header+fs*.91,w-pad*2-17,fs,ink,2);
  const missing=check.filter(q=>!q.ok).map(q=>q.label).slice(0,2);
  if(y+header+fs+hh+2<y+h)text(c,missing.length?missing.join('  ·  '):'All requirements satisfied',x+pad,y+h-fs*.64,Math.max(12,fs*.82),ok?good:bad,'left','AK Mono',w-pad*2);
 }
}
function over(c,d,l,t,opts){
 const {w,h}=l,passed=d.phase==='fold';c.fillStyle='#3c3d4773';c.fillRect(0,0,w,h);
 const ww=Math.min(w*.91,430),maxH=Math.min(h*.89,375),rows=d.checks.checks,hh=Math.min(maxH,passed?210:58+rows.length*24),x=(w-ww)/2,y=(h-hh)/2;
 c.save();if(passed&&!opts.reduced){const f=Math.min(1,Math.max(0,1-d.flash)),a=1-(1-f)**3,open=.32+.68*a;c.translate(x+ww/2,y+hh/2);c.scale(open,.89+.11*a);c.rotate((1-a)*-.06);c.translate(-x-ww/2,-y-hh/2);}
 rr(c,x+4,y+6,ww,hh,5,'#40384865');rr(c,x,y,ww,hh,5,passed?'#f3dfba':'#fff1d2',ink,2.4);
 const fs=Math.min(17,ww*.047,hh/(rows.length+4)),sz=Math.min(32,ww*.09);
 if(passed){
  const g=c.createLinearGradient(x,y,x+ww,y);g.addColorStop(0,'#f5e7bd');g.addColorStop(.48,'#fff3d0');g.addColorStop(.50,'#bc9b91');g.addColorStop(.54,'#ead7ad');g.addColorStop(1,'#f8e7c2');rr(c,x+6,y+5,ww-12,hh-10,4,g);
  const z=Math.min(ww*.068,hh*.132),px=x+(ww*.50-5.62*z)*.50,py=y+(hh-6.35*z)*.50;
  page(c,d,{x:px,y:py,gx:px+.31*z,gy:py+1.01*z,cell:z,pw:z*5.62,ph:z*6.35},t,{clean:true});
  text(c,'FRESH OFF',x+ww*.71,y+hh*.31,sz*.7,ink,'center','AK Display',ww*.40);text(c,'THE PRESS',x+ww*.71,y+hh*.48,sz*.7,ink,'center','AK Display',ww*.40);
  text(c,'★'.repeat(d.rating||1),x+ww*.71,y+hh*.70,sz*.80,'#9c722f','center');
 }else{
  text(c,'PULL PROOF',x+19,y+sz*.79,sz,ink,'left','AK Display');const start=y+sz*1.65;
  rows.forEach((q,i)=>{const yy=start+i*Math.min(24,(hh-sz*1.85)/rows.length);text(c,q.ok?'✓':'×',x+23,yy,fs*1.2,q.ok?good:bad);text(c,q.label,x+47,yy,fs,q.ok?good:bad,'left','AK Sans',ww-64);});
 }
 c.restore();
}
export function rackSlots(l,d){
 const {side,rx,ry,rw,rh}=l;
 const available=side?rh>210:rh>98;if(!available)return [];
 const n=d.issue.pieces.length,gap=4,pad=6,ww=(rw-pad*2-gap*(n-1))/n,hh=side?Math.min(58,rh*.18):Math.min(35,rh*.29);
 return d.issue.pieces.map((id,i)=>({id,x:rx+pad+i*(ww+gap),y:ry+rh-hh-4,w:ww,h:hh}));
}
function rack(c,l,d,t){
 for(const a of rackSlots(l,d)){rr(c,a.x,a.y,a.w,a.h,4,a.id===d.selected?'#e2d59b':'#eadfc4',a.id===d.selected?ink:'#a89483',a.id===d.selected?1.4:.8);
  const z=Math.min((a.w-6)/DECALS[a.id].rows[0].length,(a.h-5)/DECALS[a.id].rows.length);
  decal(c,a.id,a.x+(a.w-z*DECALS[a.id].rows[0].length)/2,a.y+(a.h-z*DECALS[a.id].rows.length)/2,z,0,t);}
}
export function drawDesk(c,d,w,h,t,opts={}){
 const l=layout(w,h);cloth(c,w,h,t,opts.reduced);tableProps(c,l,t);page(c,d,l,t,opts);docket(c,d,l,t,opts);rack(c,l,d,t);if(d.phase==='proof'||d.phase==='fold')over(c,d,l,t,opts);
 if(!opts.reduced&&d.phase==='desk'&&d.lastDrop&&d.flash>0){const f=1-Math.min(1,d.flash/.4),p=d.lastDrop;for(let i=0;i<9;i++){const a=i*2.399,rad=l.cell*(.23+.62*f);c.globalAlpha=(1-f)*.76;star(c,l.gx+(p.x+.55)*l.cell+Math.cos(a)*rad,l.gy+(p.y+.47)*l.cell+Math.sin(a)*rad,l.cell*.047*(1-f*.52),i%2?'#b37c80':'#d6ae66',null,4);}c.globalAlpha=1;}
}
export function drawGallery(c,d,entry,index,count,w,h,t){
 if(d){const l=layout(w,h);cloth(c,w,h,t);page(c,d,l,t,{clean:true});const x=l.rx,y=l.ry,ww=l.rw,hh=l.rh;rr(c,x,y,ww,hh,5,cream,ink,2);
 text(c,'LOCAL PRINTS   '+(index+1)+' / '+count,x+9,y+15,12,'#705770','left','AK Mono',ww-18);text(c,entry.title,x+9,y+42,Math.min(24,ww*.09),ink,'left','AK Display',ww-17);
 if(hh>78)wrap(c,entry.comment||'Filed in your print drawer.',x+9,y+68,ww-18,13,ink,3);return;}
 cloth(c,w,h,t);const xx=w*.1,yy=h*.25;rr(c,xx,yy,w*.8,h*.48,8,cream,ink,2);
 portrait(c,w*.5,yy+h*.14,Math.min(38,h*.10));text(c,'OPEN PRINT DRAWER',w*.5,yy+h*.31,Math.min(25,w*.054),ink,'center','AK Display');
 text(c,'Make a cover in Free Studio to fill this drawer.',w*.5,yy+h*.40,13,ink,'center','AK Sans',w*.68);
}
