import { box, ink, line, oval, polygon, record, txt } from './art.js';
import { deskLayout } from './layout.js';
import { byId, chartTime, phaseAt } from './catalog.js';
import { operatorPanel, signal } from './panel.js';
import { cutOf } from './rules.js';

const cream='#fff1d7', plum='#4c2c4b';
function deckPanel(c,s,a,side,meters,reduce){
 const now=s.time,live=side===s.side,deck=live?s.onAir:s.fade?.next;
 const song=deck?byId[deck.track]:byId[s.choices[s.selected]];
 const color=side===0?'#ef9b8d':'#a3d2bf';
 const x=a.x+3,y=a.y+3,w=a.w-6,h=a.h-6;
 box(c,x+2,y+3,w,h,12,ink);box(c,x,y,w,h-2,12,color,ink,2.4);
 const tx=x+8,right=x+w-8;
 const top=Math.max(13,Math.min(28,h*.14));
 const elapsed=live?s.time-s.started:s.fade?s.time-s.fade.when:0;
 const offset=deck?chartTime(deck,elapsed):cutOf(s).offset;
 const clock=Math.floor(offset/60)+':'+String(Math.floor(offset%60)).padStart(2,'0');
 txt(c,clock,right,y+top*.65,Math.min(14,top*.53),plum,'right','AK Mono',750,w*.25);
 txt(c,(side===0?'A':'B')+'  '+(live?'ON AIR':s.fade?'MIXING':'CUE'),tx,y+top*.65,Math.min(15,top*.6),ink,'left','AK Mono',850,w-18);
 const meterY=y+top+3;
 const fallback=live||s.fade?(.32+.43*(.5+.5*Math.sin(now*4.4+side))):.08;
 const volume=meters[side]??fallback;
 const steps=Math.max(6,Math.min(17,Math.floor(w/13)));
 for(let n=0;n<steps;n++){const gap=(w-18)/steps;box(c,tx+n*gap,meterY,gap-2,4,1,n/steps<=volume?(n>steps*.8?'#d75860':'#446858'):'#6b6d7060');}
 const bottom=h>115?Math.min(94,Math.max(47,h*.25)):22;
 for(const [xx,yy] of [[x+6,y+6],[x+w-6,y+6],[x+6,y+h-7],[x+w-6,y+h-7]]){
   oval(c,xx,yy,1.6,1.6,'#674b5c');
 }
 const plate=c.createLinearGradient(x,y,x+w,y+h);
 plate.addColorStop(0,side===0?'#e39a8d':'#a2c8bd');plate.addColorStop(1,side===0?'#bc7983':'#719b9c');
 box(c,x+6,y+top+11,w-12,h-top-bottom-9,7,plate,'#5b4f62',1);

 const r=Math.max(8,Math.min(w*.333,(h-top-bottom-13)*.5));
 const cx=x+w*.46,cy=y+top+12+r+Math.max(0,(h-top-bottom-15-r*2)*.44);
 record(c,cx,cy,r,song,now,live||Boolean(s.fade),reduce);
 const baseX=x+w*.82,baseY=cy-r*.49;
 oval(c,baseX,baseY,r*.102,r*.102,ink);
 line(c,[[baseX,baseY],[baseX+2,cy+r*.39],[cx+r*.60,cy+r*.52]],ink,Math.max(2,r*.064));
 line(c,[[baseX,baseY],[baseX+2,cy+r*.39],[cx+r*.60,cy+r*.52]],'#ebd9ca',Math.max(1,r*.027));
 box(c,cx+r*.48,cy+r*.48,r*.18,r*.11,2,'#fde1a8',ink,1);
 if(bottom>=45){
   const cut=deck?song.cuts[deck.edit]:cutOf(s),age=live?s.time-s.started:s.fade?s.time-s.fade.when:0;
   const at=phaseAt(song,cut.offset+age*(deck?.rate||1)).beat;
   const stripH=Math.min(31,Math.max(10,bottom*.27));
   signal(c,song,at,tx,y+h-bottom+3,w-16,stripH,side===0?'#ffbb9e':'#b6e6ca',reduce);
 }
 txt(c,song.title,tx,y+h-(bottom>28?27:13),Math.min(22,Math.max(13,w*.09)),ink,'left','AK Display',830,right-tx);
 if(bottom>28){
   const cut=deck?song.cuts[deck.edit]:cutOf(s);
   txt(c,cut.edit+'  ·  '+Math.round(song.bpm)+' bpm',tx,y+h-12,13,plum,'left','AK Mono',650,right-tx);
 }
}
function beatStrip(c,s,a,reduce){
 const x=a.x+7,y=a.y+4,w=a.w-14,h=a.h-9;
 box(c,x,y,w,h,8,'#38263e',ink,2);
 const pos=chartTime(s.onAir,s.time-s.started),p=phaseAt(byId[s.onAir.track],pos);
 const to=s.request.target-s.time, beat=s.request.bar/4;
 const compact=h<67;
 const title=s.fade?(s.fade.manual?'RIDE THE FADER':'CROSSFADING'):s.armed?'QUEUED ON THE BAR':s.time<s.request.open?'CUE THE NEXT RECORD':to>beat*.25?'NEXT DOWNBEAT':'MIX ON THE ONE';
 txt(c,title,x+8,y+(compact?12:15),Math.min(15,h*.22),'#ffe2b2','left','AK Mono',850,w-14);
 const gap=4,bw=(w-19-3*gap)/4,barH=Math.max(6,Math.min(15,h*.21)),by=y+h-(compact?barH+5:barH+11);
 for(let j=0;j<4;j++){
   const active=Math.floor(p.inBar)===j;
   const pulse=reduce?0:Math.max(0,1-(p.inBar%1)*3);
   box(c,x+9+j*(bw+gap),by-(active?pulse*2:0),bw,barH,3,active?(j===0?'#fff4ad':'#f9ced8'):'#71576f');
 }
 const metric=s.fade?Math.round(s.fade.position*100)+'%':(to>0?Math.ceil(to/beat)+' beats':'on the one');
 txt(c,metric,x+w-9,y+(compact?12:15),13,'#bde3cb','right','AK Mono',700,w*.38);
 if(h>95){
   const stageX=x+13,stageY=y+h*.54,stageW=w-26;
   const start=s.request.target-s.request.bar*(s.config.episode.bars+1);
   const progress=Math.max(0,Math.min(1,(s.time-start)/(s.request.deadline-start)));
   const seal=(s.request.target-start)/(s.request.deadline-start);
   const cut=cutOf(s);
   txt(c,'PHRASE',stageX,y+h*.34,13,'#cea7b4','left','AK Mono',800,stageW*.4);
   txt(c,cut.edit+' → '+cut.curve,x+w-12,y+h*.34,14,'#ffe1bc','right','AK Mono',700,stageW*.56);
   for(let j=0;j<22;j++){
     const px=stageX+stageW*j/21,hh=(j%4===0?11:5);
     line(c,[[px,stageY-hh],[px,stageY+hh]],j/21<progress?'#f3c894':'#80637e',2);
   }
   const mark=stageX+stageW*seal;polygon(c,[[mark-5,stageY-14],[mark+5,stageY-14],[mark,stageY-8]],'#ffe7a2');line(c,[[stageX+stageW*progress,stageY-15],[stageX+stageW*progress,stageY+15]],'#a7e8c6',2.4);
   txt(c,'LISTENERS  '+Math.round(s.crowd)+'%',stageX,y+h*.76,13,'#ffdfbd','left','AK Mono',650,stageW);
 }
}
export function drawDesk(c,s,width,height,{meters=[null,null],reduce=false}={}) {
 const layout=deskLayout(width,height);
 c.save();c.fillStyle='#603850';c.fillRect(0,0,width,height);
 for(let k=0;k<17;k++){const x=k*width/13-height*.12;line(c,[[x,0],[x+height*.26,height]],'#75435b',1);}
 operatorPanel(c,s,layout.request,reduce);deckPanel(c,s,layout.decks[0],0,meters,reduce);deckPanel(c,s,layout.decks[1],1,meters,reduce);
 beatStrip(c,s,layout.meters,reduce);
 if(!reduce&&s.lastGrade&&s.time-s.lastGrade.at<1.25&&!s.lastGrade.missed&&s.lastGrade.points>=78){
   const age=s.time-s.lastGrade.at,dy=age*9.5;
   const a=layout.decks[s.side],px=a.x+a.w*.75,py=a.y+a.h*.34-dy;
   c.globalAlpha=Math.min(1,(1.25-age)*3);
   for(let i=0;i<5;i++){const angle=i*1.8;const dx=Math.cos(angle)*(6+age*15),yy=Math.sin(angle)*(6+age*13);
    polygon(c,[[px+dx,py+yy-2.6],[px+dx+2,py+yy],[px+dx,py+yy+3],[px+dx-2.4,py+yy]],'#fff5c0');}
   txt(c,'+'+s.lastGrade.points,px,py,16,'#fff4bf','center','AK Display',900);
 }
 c.restore();
}
