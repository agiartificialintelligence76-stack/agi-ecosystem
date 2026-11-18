import {photograph,box,txt} from './view.js';
import {negativeLayer} from './layers.js';
import {PLACES,LENSES} from './assignments.js';
import {sceneAt,gradeShot,anchor} from './scene.js';
import {project} from './camera.js';
import {resultOf} from './run.js';
import {LINES} from './lines.js';
import {oval,line} from '../kit/illustration.js';
const ink='#372e42',paper='#fff0d6',amber='#ffe299';
export function finderLayout(w,h){
 const side=w>=830&&w/h>1.32,pad=Math.min(19,Math.max(6,Math.min(w,h)*.028)),header=Math.max(29,Math.min(55,h*.092));
 const aw=(side?w*.72:w)-2*pad,ah=h-header-2*pad-(side?0:Math.min(90,h*.22));
 const fw=Math.max(35,Math.min(aw,ah*1.5)),fh=fw/1.5;
 const x=pad+(aw-fw)/2,y=header+pad+Math.max(0,(ah-fh)*.35);
 return {x,y,w:fw,h:fh,pad,side,header,caption:side?{x:w*.735,y:pad+header,w:w*.24,h:h-header-pad*2}:{x:pad,y:y+fh+pad,w:w-2*pad,h:Math.max(13,h-(y+fh+pad)-4)}};
}
function housing(c,w,h){
 c.fillStyle='#493e4a';c.fillRect(0,0,w,h);const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'#a28280');g.addColorStop(.56,'#c19a88');g.addColorStop(1,'#9d7978');c.fillStyle=g;c.fillRect(0,0,w,h);
 c.strokeStyle='#ffe4be1b';c.lineWidth=.8;c.beginPath();for(let i=-h;i<w;i+=12){c.moveTo(i,0);c.lineTo(i+h*.51,h);}c.stroke();
}
function pill(c,text,x,y,width,height,color,fg,align='center'){
 box(c,x,y,width,height,5,color,'#4d3a4b',.9);txt(c,text,align==='center'?x+width*.5:x+6,y+height*.5,Math.max(12,Math.min(17,height*.58)),fg,align,'AK Mono',width-9);
}
function strap(c,s,g,W){
 const h=g.header-3,x=g.pad,ww=W-g.pad*2;
 box(c,x,2,ww,h,6,'#f9e8cc',ink,1.6);
 const place=PLACES[s.plan.id>=32?s.plan.id-32:Math.floor(s.plan.id/4)];
 txt(c,place.name.toUpperCase(),x+9,2+h*.52,Math.min(21,Math.max(13,h*.49)),ink,'left','AK Display',ww*.52);
 txt(c,'FRAME '+(s.index+1)+' / '+s.plans.length,x+ww-8,2+h*.52,Math.max(12,Math.min(16,h*.37)),'#75616d','right','AK Mono',ww*.41);
}
function wrap(c,text,x,y,maxWidth,fontSize,row,maxRows=3,color=ink,family='AK Sans'){
 c.font='750 '+fontSize+'px "'+family+'",sans-serif';const words=text.split(' '),rows=[];let line='';
 for(const word of words){const n=line?line+' '+word:word;if(line&&c.measureText(n).width>maxWidth){rows.push(line);line=word;}else line=n;}if(line)rows.push(line);
 rows.slice(0,maxRows).forEach((t,i)=>txt(c,t,x,y+i*row,fontSize,color,'left',family,maxWidth));return Math.min(rows.length,maxRows);
}
export function drawFinder(c,s,W,H,reduced){
 const g=finderLayout(W,H),sc=sceneAt(s.plan,s.age),grade=gradeShot(sc,s.cam);
 housing(c,W,H);strap(c,s,g,W);const {x,y,w,h}=g;
 box(c,x-3,y-3,w+6,h+6,5,'#3e3642');photograph(c,sc,s.cam,x,y,w,h);
 const r=project(sc.eye,s.cam,s.cam.lens,s.cam.focus),eye={x:x+r.u*w,y:y+r.v*h};
 c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
 for(const u of [1/3,2/3])line(c,[[x+u*w,y],[x+u*w,y+h]],'#fffae455',1);
 for(const v of [1/3,2/3])line(c,[[x,y+v*h],[x+w,y+v*h]],'#fffae455',1);
 const mark=anchor(sc),size=Math.max(13,Math.min(w,h)*.086),mx=x+mark.u*w,my=y+mark.v*h,shade=grade.cover>.23?'#ff998c':grade.sharp>.88?'#d7ffab':'#ffe1a3';
 for(const a of [-1,1])for(const b of [-1,1])line(c,[[mx+a*size*.64,my+b*size],[mx+a*size,my+b*size],[mx+a*size,my+b*size*.51]],shade,Math.max(1.5,w*.0034));
 const split=(1-grade.sharp)*size*.68;
 line(c,[[eye.x-size*.30-split,eye.y],[eye.x-split,eye.y]],shade,1.6);
 line(c,[[eye.x+split,eye.y+1],[eye.x+size*.30+split,eye.y+1]],shade,1.6);
 const pH=Math.max(18,Math.min(28,h*.083)),py=y+6;
 pill(c,sc.gesture>.74?'GESTURE PEAK':sc.falseWave>.65?'HAIR FIX':'WATCH HER',x+6,py,Math.max(82,Math.min(150,w*.26)),pH,'#3c3447d9',amber);
 pill(c,grade.focusDepth.toFixed(1)+' m',x+w-Math.min(98,w*.22)-6,py,Math.min(98,w*.22),pH,'#3c3447d9',paper);
 const status=grade.cover>.23?'FACE BLOCKED':grade.sharp>.88?'FOCUS LOCK':'PULL FOCUS';
 pill(c,status,x+6,y+h-pH-6,Math.max(86,Math.min(137,w*.27)),pH,'#3b3546df',shade);
 if(s.config.mode!=='darkroom')txt(c,Math.ceil(Math.max(0,s.plan.budget-s.age))+'s',x+w-9,y+h-pH*.60-6,Math.max(12,Math.min(18,h*.065)),paper,'right','AK Mono');
 c.restore();
 const b=g.caption;
 box(c,b.x,b.y,b.w,b.h,Math.min(8,b.h*.18),'#faead1',ink,1.4);
 const inner=b.x+Math.max(7,b.w*.035),ww=b.w-(inner-b.x)*2;
 if(g.side){
  txt(c,'COMMISSION',inner,b.y+b.h*.105,Math.min(18,Math.max(13,b.w*.053)),'#94716f','left','AK Mono',ww);
  wrap(c,sc.a.name,inner,b.y+b.h*.22,ww,Math.min(31,Math.max(20,b.w*.11)),30,2,ink,'AK Display');
  wrap(c,sc.a.note,inner,b.y+b.h*.44,ww,Math.min(20,Math.max(15,b.w*.070)),24,4);
  txt(c,LENSES[s.cam.lens]+' mm   •   '+s.cam.focus.toFixed(1)+' m',inner,b.y+b.h*.76,Math.max(13,Math.min(19,b.w*.067)),ink,'left','AK Mono',ww);
  txt(c,(2-s.takes.length)+' exposures left',inner,b.y+b.h*.89,Math.max(13,Math.min(18,b.w*.055)),'#965f70','left','AK Sans',ww);
 }else{
  const room=b.h;txt(c,sc.a.name,inner,b.y+room*.23,Math.min(23,Math.max(14,room*.24)),ink,'left','AK Display',ww*.63);
  txt(c,LENSES[s.cam.lens]+' mm  '+s.cam.focus.toFixed(1)+'m',b.x+b.w-7,b.y+room*.23,Math.max(12,Math.min(16,room*.17)),'#795b6d','right','AK Mono',ww*.38);
  if(room>33)wrap(c,sc.a.note,inner,b.y+room*.59,ww,Math.max(12,Math.min(17,room*.20)),Math.max(13,room*.19),2);
 }
}
export function printCard(c,p,x,y,w,h,{develop=0,pinned=false,num='',reduced=false,frame='paper'}={}){
 box(c,x+2,y+3,w,h,3,'#664e5c55');box(c,x,y,w,h,3,frame==='film'?'#4d4350':frame==='foil'?'#f1d3aa':'#fff3d9','#654e60',1.3);
 if(frame==='foil')box(c,x+2,y+2,w-4,h-4,2,null,'#fff1be',1.4);
 if(frame==='film')for(let i=0;i<10;i++){const hx=x+w*(.03+i*.1);box(c,hx,y+h*.91,w*.041,Math.max(2,h*.027),1,'#ccb69e');}
 if(!p){txt(c,'Unexposed',x+w*.5,y+h*.5,15,'#846e78','center');return;}
 const pad=Math.max(4,w*.023),aw=w-2*pad,ah=Math.min(h*.79,aw/1.5);
 const negative=negativeLayer(c,p,aw,ah,layer=>photograph(layer,p.scene,p.recipe.cam,0,0,aw,ah));
 if(negative){
  c.save();
  if(develop>0&&!reduced)c.filter='saturate('+Math.max(.02,1-develop*1.22)+')';
  c.drawImage(negative,x+pad,y+pad,aw,ah);c.restore();
 }else photograph(c,p.scene,p.recipe.cam,x+pad,y+pad,aw,ah);
 if(develop>0&&!reduced){c.fillStyle='rgba(248,235,210,'+Math.min(.95,develop**2)+')';c.fillRect(x+pad,y+pad,aw,ah);}
 txt(c,(num?num+'  ·  ':'')+p.grade.score+'/100',x+pad,y+ah+(h-ah)*.52,Math.max(12,Math.min(21,w*.055)),frame==='film'?paper:ink,'left','AK Mono',w*.65);
 if(pinned)txt(c,'PINNED',x+w-pad,y+ah+(h-ah)*.52,12,'#aa6678','right','AK Mono',w*.33);
}
export function drawReview(c,s,W,H,reduced){
 housing(c,W,H);const g=finderLayout(W,H);strap(c,s,g,W);
 const photos=s.takes.length===2?s.takes:[s.takes[0]],top=g.header+g.pad,photoW=Math.min(photos.length===2?(W-g.pad*3)*.5:W-g.pad*2,(H-top)*1.10);
 const photoH=photoW*.80,left=(W-photoW*photos.length-g.pad*(photos.length-1))/2;
 photos.forEach((p,i)=>printCard(c,p,left+i*(photoW+g.pad),top,photoW,photoH,{develop:i===photos.length-1?s.develop:0,num:'NEG '+(i+1),reduced}));
 const p=photos.at(-1),by=top+photoH+g.pad,room=H-by;
 if(!p||room<20)return;
 const x=g.pad,ww=W-g.pad*2;box(c,x,by,ww,room-2,6,'#f8e9cf',ink,1);
 const vals=[['Frame',30,p.grade.parts.framing],['Focus',25,p.grade.parts.focus],['Gesture',25,p.grade.parts.gesture],['Request',20,p.grade.parts.request]];
 const best=vals.reduce((winner,q,i)=>q[2]/q[1]>vals[winner][2]/vals[winner][1]?i:winner,0);
  for(let i=0;i<4;i++){const base=x+ww*(.025+i*.246),unit=ww*.22;
   if(i===best)box(c,base-3,by+room*.07,unit+3,room*.79,3,'#dfe1b5');
  txt(c,vals[i][0],base,by+Math.min(room*.22,24),Math.max(12,Math.min(18,ww*.035)),ink,'left','AK Sans',unit);
  txt(c,vals[i][2]+'/'+vals[i][1],base,by+Math.min(room*.60,53),Math.max(12,Math.min(20,ww*.041)),'#8b5e73','left','AK Mono',unit);
 }
 if(room>76)wrap(c,LINES[p.note],x+ww*.025,by+Math.min(room*.85,90),ww*.95,Math.max(12,Math.min(17,ww*.034)),17,2,ink,'AK Serif');
}
export function drawSpread(c,s,W,H){
 housing(c,W,H);const res=resultOf(s),pad=Math.max(9,Math.min(W,H)*.035),ww=(W-pad*3)*.5,hh=Math.min(ww*.8,H*.58);
 txt(c,'THE CONTACT SHEET',W*.5,H*.105,Math.max(18,Math.min(36,W*.066)),paper,'center','AK Display',W*.96);
 for(const [i,k] of [s.context,s.detail].entries())printCard(c,s.kept[k],pad+i*(ww+pad),H*.22,ww,hh,{num:i?'DETAIL':'CONTEXT'});
 txt(c,res.spread,W*.5,H*.83,Math.max(14,Math.min(24,W*.046)),paper,'center','AK Serif',W*.9);
}
export function drawAlbum(c,p,entry,index,total,W,H){
 housing(c,W,H);const pw=Math.min(W*.84,H*.90),ph=pw*.80,x=(W-pw)*.5,y=(H-ph)*.48;
 txt(c,'MY PRINT ALBUM',W*.5,H*.10,Math.max(18,Math.min(32,W*.066)),paper,'center','AK Display',W*.95);
 if(p)printCard(c,p,x,y,pw,ph,{pinned:entry.pinned,frame:entry.frame,num:(index+1)+' / '+total});
 else{box(c,x,y,pw,ph,4,'#f6e4c5',ink);txt(c,'Your first print goes here.',W*.5,y+ph*.5,Math.max(15,Math.min(22,pw*.075)),ink,'center','AK Serif',pw*.9);}
 if(p){txt(c,PLACES[p.scene.a.place].name+'  ·  '+p.scene.a.name,W*.5,H*.865,Math.max(13,Math.min(21,W*.045)),paper,'center','AK Sans',W*.94);txt(c,LINES[entry.comment]||LINES[p.note],W*.5,H*.94,Math.max(12,Math.min(18,W*.038)),paper,'center','AK Serif',W*.94);}
}
